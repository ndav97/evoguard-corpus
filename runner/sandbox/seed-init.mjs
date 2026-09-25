// Inicializador del workspace del constructor. Se ejecuta DENTRO del contenedor (enviado por el host;
// sustituye a /opt/evoguard/init.mjs de la imagen para no reconstruirla). Lee /tmp/evoguard-seed.json.
// V0: scaffold + fixture + TASK.json V0 en un commit determinista.
// V1–V3: además reconstruye la historia validada: por cada versión previa, commit de tarea (si no es V0)
// y parche de referencia, comprobando que cada commit reproduce exactamente el hash registrado.
import { readFileSync, mkdirSync, writeFileSync, cpSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const SEED = '/tmp/evoguard-seed.json';
const { files, steps = [] } = JSON.parse(readFileSync(SEED, 'utf8'));
unlinkSync(SEED);
const expected = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'src/App.tsx', 'src/main.tsx', 'fixtures/products.json', 'TASK.json', '.gitignore'];
if (!files || Object.keys(files).sort().join() !== expected.sort().join()) throw new Error('Payload fuera de allowlist');
if (existsSync('/workspace/app')) throw new Error('Workspace ya inicializado');
const baselinePacket = JSON.parse(files['TASK.json']);
if (baselinePacket.version !== 'V0' || baselinePacket.requirements.map(r => r.id).join() !== 'R001,R002') throw new Error('La base debe ser el scaffold V0');
for (const [path, content] of Object.entries(files)) {
  if (typeof content !== 'string') throw new Error('Contenido no textual');
  const target = join('/workspace/app', path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
cpSync('/opt/npm-cache', '/tmp/npm-cache', { recursive: true });
cpSync('/opt/deps/node_modules', '/workspace/app/node_modules', { recursive: true });
const env = { ...process.env, GIT_AUTHOR_NAME: 'EvoGuard Pipeline', GIT_AUTHOR_EMAIL: 'pipeline@evoguard.invalid', GIT_COMMITTER_NAME: 'EvoGuard Pipeline', GIT_COMMITTER_EMAIL: 'pipeline@evoguard.invalid', GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z' };
const git = (args, input) => execFileSync('git', args, { cwd: '/workspace/app', env, encoding: 'utf8', input, maxBuffer: 16 * 1024 * 1024 }).trim();
git(['init', '-b', 'main']);
git(['config', 'user.name', 'EvoGuard Pipeline']); git(['config', 'user.email', 'pipeline@evoguard.invalid']);
git(['add', '.']); git(['commit', '-m', 'scaffold: isolated baseline (not V0)']);
const root = git(['rev-parse', 'HEAD']);
const history = [{ message: 'scaffold: isolated baseline (not V0)', commit: root }];
for (const [index, step] of steps.entries()) {
  if (step.type === 'patch') {
    if (typeof step.patch !== 'string' || !step.patch.length) throw new Error(`Parche vacío en paso ${index}`);
    git(['apply', '--index', '--binary', '--whitespace=nowarn', '-'], step.patch);
  } else if (step.type === 'task') {
    const packet = JSON.parse(step.content);
    if (!['V1', 'V2', 'V3'].includes(packet.version)) throw new Error('Tarea evolutiva inválida');
    writeFileSync('/workspace/app/TASK.json', step.content);
    git(['add', 'TASK.json']);
  } else if (step.type !== 'expect') throw new Error(`Paso desconocido: ${step.type}`);
  if (step.type !== 'expect') git(['commit', '--allow-empty', '-q', '-m', step.message]);
  const head = git(['rev-parse', 'HEAD']);
  if (step.expect && step.expect !== head) throw new Error(`Historia no reproducible en paso ${index} (${step.message ?? step.type}): ${head} ≠ ${step.expect}`);
  if (step.type !== 'expect') history.push({ message: step.message, commit: head });
}
const hash = s => createHash('sha256').update(s).digest('hex');
const task = readFileSync('/workspace/app/TASK.json', 'utf8');
console.log(JSON.stringify({ baseline_commit: git(['rev-parse', 'HEAD']), root_commit: root, history, fixture_sha256: hash(files['fixtures/products.json']), packet_sha256: hash(task), version: JSON.parse(task).version, file_count: Object.keys(files).length }));
