// Protocolo de acciones del constructor, versión 1.1 (docs/protocol-v1.1-actions.md).
// Un único esquema plano (todas las claves obligatorias) para que funcione igual con salida estructurada estricta
// de OpenAI, Anthropic, Gemini y la gramática JSON de Ollama. Los campos que un tipo no usa van vacíos.
import { createHash } from 'node:crypto';

export const PROTOCOL_VERSION = '1.1';
export const ACTION_TYPES = ['read_file', 'list_files', 'write_file', 'edit_file', 'run_checks', 'tool', 'deliver', 'technical_failure'];
export const ACTION_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ACTION_TYPES },
    path: { type: 'string' },
    content: { type: 'string' },
    find: { type: 'string' },
    replace: { type: 'string' },
    argv: { type: 'array', items: { type: 'string' } }
  },
  required: ['type', 'path', 'content', 'find', 'replace', 'argv'],
  additionalProperties: false
};

export const INSTRUCTION = [
  'You are a coding agent working in an isolated Linux workspace (React + TypeScript + Vite). Each turn, return exactly one JSON action matching the schema; unused fields must be "" or [].',
  'Actions: read_file {path} shows a file. list_files {path} lists a directory ("" = root). write_file {path, content} creates or replaces a whole file. edit_file {path, find, replace} replaces one exact, unique occurrence of find. run_checks runs typecheck, build and the Vitest tests and shows their output. tool {argv} runs a command (use ["sh","-lc","..."] for a shell). deliver submits the work. technical_failure gives up.',
  'Work step by step: inspect the relevant files, change the code, run_checks, fix problems, then deliver. Do not repeat an action that already succeeded; each result is in the history. Paths are relative to the repository root.',
  'Do not execute tools yourself. Use only the current packet and visible history. No Internet or new dependencies.'
].join(' ');

export const RESPONSE_CONTRACT = {
  schema: ACTION_SCHEMA,
  instruction: 'Return exactly one JSON object matching this schema. No Markdown, code fences, commentary or additional fields. Fields not used by the chosen type must be "" (strings) or [] (argv).'
};

const MAX_FIELD = 262144;
const fail = code => Object.assign(new Error(code), { code });
const PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._@\-/ ]+$/;

// Normalización acotada (documentada): solo espacios alrededor y un único bloque de código Markdown que envuelve
// TODO el objeto. Cualquier otro texto alrededor del JSON sigue siendo inválido. Devuelve el modo aplicado.
export function extractJson(text) {
  if (typeof text !== 'string') throw fail('INVALID_ACTION_JSON');
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json|JSON)?[ \t]*\r?\n([\s\S]*?)\r?\n?```$/);
  const body = fence ? fence[1].trim() : trimmed;
  try { return { value: JSON.parse(body), normalization: fence ? 'markdown_fence' : trimmed === text ? 'none' : 'whitespace' }; }
  catch { throw fail('INVALID_ACTION_JSON'); }
}

// Valida y reduce la acción a sus campos significativos.
export function validateAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) throw fail('INVALID_ACTION');
  const keys = Object.keys(action).sort().join();
  const legacy = keys === 'argv,type';
  if (!legacy && keys !== 'argv,content,find,path,replace,type') throw fail('INVALID_ACTION');
  const { type, argv } = action;
  const path = legacy ? '' : action.path, content = legacy ? '' : action.content, find = legacy ? '' : action.find, replace = legacy ? '' : action.replace;
  if (!ACTION_TYPES.includes(type)) throw fail('INVALID_ACTION');
  if (![path, content, find, replace].every(v => typeof v === 'string' && !v.includes('\0') && v.length <= MAX_FIELD)) throw fail('INVALID_ACTION');
  if (!Array.isArray(argv) || argv.length > 128 || argv.some(v => typeof v !== 'string' || v.includes('\0') || v.length > 16384)) throw fail('INVALID_ACTION');
  const empty = fields => fields.every(f => ({ path, content, find, replace })[f] === '');
  const validPath = p => p.length > 0 && p.length <= 512 && PATH.test(p);
  switch (type) {
    case 'tool':
      if (!argv.length || !empty(['path', 'content', 'find', 'replace'])) throw fail('INVALID_ACTION');
      return { type, argv };
    case 'read_file':
      if (!validPath(path) || argv.length || !empty(['content', 'find', 'replace'])) throw fail('INVALID_ACTION');
      return { type, path };
    case 'list_files':
      if ((path !== '' && !validPath(path)) || argv.length || !empty(['content', 'find', 'replace'])) throw fail('INVALID_ACTION');
      return { type, path };
    case 'write_file':
      if (!validPath(path) || argv.length || !empty(['find', 'replace'])) throw fail('INVALID_ACTION');
      return { type, path, content };
    case 'edit_file':
      if (!validPath(path) || !find || argv.length || content !== '') throw fail('INVALID_ACTION');
      return { type, path, find, replace };
    default:
      if (argv.length || !empty(['path', 'content', 'find', 'replace'])) throw fail('INVALID_ACTION');
      return { type };
  }
}

export function parseAction(text) {
  const { value, normalization } = extractJson(text);
  return { action: validateAction(value), normalization };
}

// Resumen seguro del texto rechazado para diagnóstico: recorte, hash y redacción de posibles secretos.
const SECRET = /(sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----|(?:x-api-key|authorization)\s*[:=]\s*\S+|[A-Z_]*API_KEY\s*=\s*\S+)/gi;
export function rejectedSample(text, limit = 2000) {
  if (typeof text !== 'string') return { length: null, sha256: null, head: null, tail: null };
  const redacted = text.replace(SECRET, '[REDACTED]').replace(/x-api-key|SYNTEROLINK_[A-Z_]*KEY/gi, '[REDACTED]');
  return {
    length: text.length,
    sha256: createHash('sha256').update(text).digest('hex'),
    head: redacted.slice(0, limit),
    tail: redacted.length > limit ? redacted.slice(-Math.min(500, redacted.length - limit)) : ''
  };
}

// Clave estable de una acción para detectar repeticiones.
export const actionKey = action => JSON.stringify(action);
