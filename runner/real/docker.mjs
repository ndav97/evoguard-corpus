// Contenedores del estrato semi-real: imagen por familia (repositorio en V0 + dependencias instaladas) y
// contenedores de trabajo, oráculo y verificación creados desde ella.
// Aislamiento igual que en el estrato sintético (sin red, sin capacidades, uid 1000, límites) salvo la raíz de
// solo lectura: el repositorio y sus dependencias viven en la capa escribible del contenedor, que se destruye
// al cerrarlo (decisión documentada en docs/diseno-integracion-semi-real.md).
import { randomUUID } from 'node:crypto';
import { docker } from '../sandbox/docker.mjs';

export const REAL_ROLES = { 'real-sandbox': 'evoguard-realbox-', 'real-oracle': 'evoguard-realora-', 'real-verify': 'evoguard-realver-' };
export const REPO_DIR = '/workspace/repo';
// Memoria por contenedor (MB). En Windows el lanzador la fija al 75 % de la memoria de Docker Desktop.
export const MEMORY_MB = Number(process.env.EVOGUARD_REAL_MEMORY_MB) > 1024 ? Math.floor(Number(process.env.EVOGUARD_REAL_MEMORY_MB)) : 6144;

export function assertRealName(name, role) {
  const prefixes = role ? [REAL_ROLES[role]] : Object.values(REAL_ROLES);
  if (!prefixes.some(prefix => prefix && new RegExp(`^${prefix}[a-f0-9]{32}$`).test(name))) throw new Error('Nombre de contenedor no administrado por EvoGuard (semi-real)');
}

export function realRunArgs(image, name, role) {
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('La imagen debe ser un digest local inmutable');
  if (!REAL_ROLES[role]) throw new Error('Rol de contenedor desconocido');
  assertRealName(name, role);
  return ['create', `--name=${name}`, `--label=org.evoguard.role=${role}`, '--pull=never',
    '--network=none', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--user=1000:1000', '--init',
    '--pids-limit=1024', `--memory=${MEMORY_MB}m`, `--memory-swap=${MEMORY_MB}m`, '--cpus=2', '--shm-size=512m',
    '--tmpfs=/tmp:rw,exec,nosuid,nodev,size=2048m,mode=1777',
    `--workdir=${REPO_DIR}`, '--env=HOME=/tmp/home', '--env=CI=1', '--env=TZ=UTC', '--env=LANG=C.UTF-8', '--env=LC_ALL=C.UTF-8', '--env=FORCE_COLOR=0', `--env=NODE_OPTIONS=--max-old-space-size=${Math.max(1024, Math.floor(MEMORY_MB * 0.5))}`,
    '--env=npm_config_offline=true', '--env=npm_config_audit=false', '--env=npm_config_fund=false', '--env=npm_config_update_notifier=false',
    '--env=GIT_CONFIG_NOSYSTEM=1', '--env=GIT_CONFIG_GLOBAL=/dev/null',
    ...['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy'].map(k => `--env=${k}=`),
    image, 'sleep', 'infinity'];
}

export function assertRealContainer(name, image, role) {
  assertRealName(name, role);
  const c = JSON.parse(docker(['inspect', name]))[0];
  const h = c.HostConfig;
  if (c.Config.Labels?.['org.evoguard.role'] !== role || c.Image !== image || h.NetworkMode !== 'none' || c.Config.User !== '1000:1000' || h.Privileged
    || c.Mounts.some(m => m.Type !== 'tmpfs') || Object.keys(h.PortBindings ?? {}).length || !h.CapDrop?.includes('ALL') || !h.SecurityOpt?.includes('no-new-privileges')) {
    throw new Error('Configuración del contenedor semi-real no cumple aislamiento');
  }
  return c;
}

export function openReal(image, role) {
  docker(['image', 'inspect', image]);
  const name = REAL_ROLES[role] + randomUUID().replaceAll('-', '');
  let created = false;
  try {
    docker(realRunArgs(image, name, role)); created = true;
    docker(['start', name]);
    assertRealContainer(name, image, role);
    execReal({ name, image, role }, ['mkdir', '-p', '/tmp/home']);
    return { name, image, role };
  } catch (error) {
    if (created) closeReal({ name, image, role });
    throw error;
  }
}

export function execReal(session, argv, { input, timeout = 60000, raw = false, cwd = REPO_DIR } = {}) {
  assertRealContainer(session.name, session.image, session.role);
  if (!Array.isArray(argv) || !argv.length || argv.some(a => typeof a !== 'string' || a.includes('\0'))) throw new Error('Comando inválido');
  try { return docker(['exec', '-i', '--user=1000:1000', `--workdir=${cwd}`, session.name, ...argv], { input, timeout, raw }); }
  catch (error) {
    if (error.clientAborted) closeReal(session);
    throw error;
  }
}

// Como execReal, pero devuelve { status, output } sin lanzar por código de salida distinto de cero.
export function runReal(session, argv, { timeout = 60000, cwd = REPO_DIR, limit = 400000 } = {}) {
  const script = `const {spawnSync}=require('node:child_process');const [cmd,...args]=JSON.parse(process.argv[1]);
const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:256*1024*1024,stdio:['ignore','pipe','pipe']});
const out=((r.stdout||'')+(r.stderr||''));process.stdout.write(JSON.stringify({code:r.status,signal:r.signal,output:out.length>${limit}?out.slice(-${limit}):out}));`;
  try {
    const text = execReal(session, ['node', '-e', script, JSON.stringify(argv)], { timeout, cwd, raw: true });
    const result = JSON.parse(text);
    return { status: result.code === 0 ? 'PASS' : 'FAIL', code: result.code, output: result.output };
  } catch (error) {
    if (error.clientAborted) return { status: 'TIMEOUT', output: '' };
    return { status: 'INFRA_ERROR', output: String(error.message).slice(0, 2000) };
  }
}

export function closeReal(session) {
  assertRealName(session.name, session.role);
  if (!docker(['container', 'ls', '--all', '--filter', `name=^/${session.name}$`, '--format', '{{.Names}}'])) return;
  assertRealContainer(session.name, session.image, session.role);
  docker(['rm', '--force', session.name]);
}
