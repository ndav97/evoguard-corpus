// Política de contexto para modelos con ventana limitada (config/context.json, applies_to: locales de 8192).
// Los modelos comerciales NO pasan por aquí: reciben el paquete completo y el historial íntegro, como en uso real.
// Para los modelos alcanzados, construye en cada ciclo la entrada visible dentro del presupuesto de tokens:
// - Núcleo obligatorio: contrato de respuesta, paquete (requisitos, ui_contract, solicitud) y feedback visible.
//   Si el núcleo no cabe, se rechaza (CONTEXT_CORE_TOO_LARGE): nunca se recortan requisitos en silencio.
// - Historial en ventana: pasos recientes con límites amplios, antiguos comprimidos, el resto omitido con aviso.
// - Estimación conservadora de tokens por bytes UTF-8; el adaptador contrasta después con los tokens reportados.
// Solo usa los campos permitidos del contexto; nunca serializa campos privados del coordinador.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function loadContextPolicy(root = new URL('../../', import.meta.url)) {
  const policy = JSON.parse(readFileSync(new URL('config/context.json', root), 'utf8'));
  validatePolicy(policy);
  return policy;
}

export function validatePolicy(policy) {
  const b = policy?.budget, e = policy?.estimator, h = policy?.history;
  const positive = value => Number.isFinite(value) && value > 0;
  if (policy?.schema_version !== '1.0.0' || !['PROVISIONAL', 'CALIBRATED'].includes(policy.status) || policy.scope !== 'context_limited_models' || !Array.isArray(policy.applies_to) || !policy.applies_to.length) throw new Error('Política de contexto inválida');
  if (!b || b.input_tokens !== b.context_tokens - b.output_reserve_tokens - b.template_reserve_tokens || b.input_tokens <= 0) throw new Error('Presupuesto de contexto inconsistente');
  if (!e || e.method !== 'utf8_bytes_per_token_lower_bound' || !positive(e.bytes_per_token) || !(e.safety_factor > 0 && e.safety_factor <= 1)) throw new Error('Estimador de contexto inválido');
  if (policy.status === 'CALIBRATED' && !e.calibration) throw new Error('Política CALIBRATED sin evidencia de calibración');
  if (!h || !Number.isInteger(h.recent_steps) || h.recent_steps < 1 || !['tool_output_recent_bytes', 'tool_output_old_bytes', 'argument_recent_bytes', 'argument_old_bytes', 'feedback_latest_bytes', 'feedback_old_bytes'].every(k => Number.isInteger(h[k]) && h[k] > 0) || !(h.head_fraction > 0 && h.head_fraction < 1)) throw new Error('Límites de historial inválidos');
}

const bytes = text => Buffer.byteLength(text, 'utf8');

// Cota superior de tokens: bytes / (bytes_por_token × factor de seguridad).
export function estimateTokens(text, policy) {
  return Math.ceil(bytes(text) / (policy.estimator.bytes_per_token * policy.estimator.safety_factor));
}

// Recorte explícito conservando inicio y final (los errores suelen estar al final).
export function clip(text, limit, headFraction) {
  if (typeof text !== 'string') return text;
  const size = bytes(text);
  if (size <= limit) return text;
  const buffer = Buffer.from(text, 'utf8');
  const headBytes = Math.floor(limit * headFraction);
  const tailBytes = limit - headBytes;
  const head = buffer.subarray(0, headBytes).toString('utf8').replace(/�+$/, '');
  const tail = buffer.subarray(size - tailBytes).toString('utf8').replace(/^�+/, '');
  return `${head}\n[… ${size - headBytes - tailBytes} bytes omitidos por la política de contexto; repite el comando con head, tail o grep para ver esa parte …]\n${tail}`;
}

function slimPacket(packet, policy) {
  const slim = {};
  for (const [key, value] of Object.entries(packet ?? {})) if (!policy.packet.omit_from_message.includes(key)) slim[key] = value;
  if (Array.isArray(packet?.products)) {
    slim.workspace_files = {
      [policy.packet.workspace_references.task]: 'Paquete completo de la tarea (solicitud, requisitos y ui_contract).',
      [policy.packet.workspace_references.products]: `Fixture de ${packet.products.length} productos; úsalo sin modificarlo.`
    };
  } else if (packet?.fixture !== undefined && typeof packet.fixture_path === 'string') {
    slim.workspace_files = {
      [policy.packet.workspace_references.task]: 'Paquete completo de la tarea (solicitud, requisitos y ui_contract).',
      [packet.fixture_path]: 'Fixture de la familia; impórtalo y úsalo sin modificarlo.'
    };
  }
  return slim;
}

// Agrupa el historial en pasos: acción del asistente + resultado de herramienta; el feedback visible va aparte.
function steps(messages) {
  const result = [];
  for (const [index, message] of messages.entries()) {
    if (message.role === 'user' && message.content?.source === 'workspace') result.push({ kind: 'workspace', index, message });
    else if (message.role === 'user') result.push({ kind: 'feedback', index, message });
    else if (message.role === 'assistant') result.push({ kind: 'step', index, action: message, tool: null });
    else if (message.role === 'tool') {
      const last = result.at(-1);
      if (last?.kind === 'step' && !last.tool) last.tool = message;
      else result.push({ kind: 'step', index, action: null, tool: message });
    }
  }
  return result;
}

function compressStep(step, level, h) {
  const argLimit = level === 'recent' ? h.argument_recent_bytes : h.argument_old_bytes;
  const outLimit = level === 'recent' ? h.tool_output_recent_bytes : h.tool_output_old_bytes;
  const out = [];
  let clipped = 0;
  if (step.action) {
    const content = structuredClone(step.action.content);
    if (Array.isArray(content?.argv)) content.argv = content.argv.map(arg => { const c = clip(arg, argLimit, h.head_fraction); if (c !== arg) clipped++; return c; });
    // Protocolo 1.1: el contenido de write_file/edit_file se recorta como los argumentos.
    for (const field of ['content', 'find', 'replace']) {
      if (typeof content?.[field] === 'string') { const c = clip(content[field], argLimit, h.head_fraction); if (c !== content[field]) clipped++; content[field] = c; }
    }
    out.push({ role: 'assistant', content });
  }
  if (step.tool) {
    const content = { status: step.tool.content?.status, output: clip(step.tool.content?.output ?? '', outLimit, h.head_fraction) };
    if (content.output !== (step.tool.content?.output ?? '')) clipped++;
    out.push({ role: 'tool', content });
  }
  return { messages: out, clipped };
}

function compressFeedback(message, limit, h) {
  const content = { ...message.content, feedback: clip(message.content?.feedback ?? '', limit, h.head_fraction) };
  return { role: 'user', content };
}

const NOTICE = 'Contexto gestionado por el runner: los pasos antiguos pueden aparecer comprimidos u omitidos y las salidas largas recortadas con aviso. El estado real está en el workspace; TASK.json contiene el paquete completo.';

// context: { packet, messages, attempt, cycle } — solo se leen esos campos.
// overhead: texto que el proveedor recibe fuera de `input` (instrucción de sistema y esquema).
export function buildContextInput(context, { policy = loadContextPolicy(), responseContract, overhead = '' } = {}) {
  const h = policy.history;
  const budget = policy.budget.input_tokens;
  const all = steps(context.messages ?? []);
  const feedback = all.filter(item => item.kind === 'feedback');
  // Vista del workspace (protocolo 1.1): completa hasta workspace_bytes o solo el árbol de archivos.
  const workspaceItems = all.filter(item => item.kind === 'workspace');
  const workspaceLevel = level => workspaceItems.map(item => {
    const overview = item.message.content.overview ?? {};
    if (level === 'tree') return { index: item.index, messages: [{ role: 'user', content: { source: 'workspace', overview: { note: overview.note, files: overview.files, contents: {}, omitted: 'contenidos omitidos por la política de contexto; usa read_file' } } }] };
    let used = 0;
    const contents = {};
    for (const [path, text] of Object.entries(overview.contents ?? {})) {
      const size = Buffer.byteLength(text);
      if (used + size > (h.workspace_bytes ?? 6000)) continue;
      contents[path] = text; used += size;
    }
    return { index: item.index, messages: [{ role: 'user', content: { source: 'workspace', overview: { note: overview.note, files: overview.files, contents } } }] };
  });
  const history = all.filter(item => item.kind === 'step');
  const latestFeedback = feedback.at(-1);

  const render = (feedbackMessages, included, omitted) => {
    const ordered = [...feedbackMessages, ...included].sort((a, b) => a.index - b.index).flatMap(item => item.messages);
    return JSON.stringify({
      response_contract: responseContract,
      packet: slimPacket(context.packet, policy),
      context_policy: NOTICE,
      history: { omitted_steps: omitted, messages: ordered },
      attempt: context.attempt,
      cycle: context.cycle
    });
  };
  const fits = text => estimateTokens(overhead + text, policy) <= budget;

  // Núcleo: paquete + feedback. Nivel 1: último feedback amplio; nivel 2: todo el feedback comprimido.
  const latest = feedback.map(item => ({ index: item.index, messages: [compressFeedback(item.message, item === latestFeedback ? h.feedback_latest_bytes : h.feedback_old_bytes, h)] }));
  const compressed = feedback.map(item => ({ index: item.index, messages: [compressFeedback(item.message, h.feedback_old_bytes, h)] }));
  const feedbackLevels = [
    [...workspaceLevel('full'), ...latest],
    [...workspaceLevel('full'), ...compressed],
    [...workspaceLevel('tree'), ...compressed]
  ];
  // Ventana: del paso más reciente al más antiguo; recientes con límites amplios, luego comprimidos.
  const windowFor = feedbackItems => {
    const included = [];
    let clipped = 0;
    for (let position = history.length - 1; position >= 0; position--) {
      const step = history[position];
      const levels = history.length - 1 - position < h.recent_steps ? ['recent', 'old'] : ['old'];
      let added = false;
      for (const level of levels) {
        const candidate = compressStep(step, level, h);
        const trial = [...included, { index: step.index, messages: candidate.messages }];
        if (fits(render(feedbackItems, trial, position))) {
          included.push({ index: step.index, messages: candidate.messages });
          clipped += candidate.clipped;
          added = true;
          break;
        }
      }
      if (!added) break; // se omite este paso y todos los anteriores, para conservar la continuidad reciente
    }
    return { included, clipped };
  };
  let feedbackItems = null, included = [], clipped = 0, coreFits = false;
  for (const level of feedbackLevels) {
    if (!fits(render(level, [], history.length))) continue;
    coreFits = true;
    const window = windowFor(level);
    feedbackItems = level; included = window.included; clipped = window.clipped;
    // Sin el paso más reciente el modelo trabajaría a ciegas: se intenta el siguiente nivel de compresión.
    if (!history.length || included.some(item => item.index === history.at(-1).index)) break;
  }
  if (!coreFits) throw Object.assign(new Error('CONTEXT_CORE_TOO_LARGE'), { code: 'CONTEXT_CORE_TOO_LARGE' });
  if (history.length && !included.some(item => item.index === history.at(-1).index)) throw Object.assign(new Error('CONTEXT_WINDOW_TOO_SMALL'), { code: 'CONTEXT_WINDOW_TOO_SMALL' });
  const omitted = history.length - included.length;
  const input = render(feedbackItems, included, omitted);
  const trace = {
    policy_status: policy.status,
    budget_tokens: budget,
    estimated_tokens: estimateTokens(overhead + input, policy),
    input_bytes: bytes(input),
    steps_total: history.length,
    steps_included: included.length,
    steps_omitted: omitted,
    items_clipped: clipped,
    feedback_messages: feedbackItems.length,
    input_sha256: createHash('sha256').update(input).digest('hex')
  };
  return { input, trace };
}
