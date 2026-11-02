// R2 — Imagen inmutable por familia semi-real: repositorio en su commit V0 (historia reducida a un commit
// «base: V0» determinista), dependencias instaladas con el lockfile del repo y la versión de Node de la familia.
// La construcción usa red (clonado e instalación); la verificación y todo lo posterior se ejecutan sin red.
// Uso: npm run real:prepare -- Sxxx [--base node:24-bookworm] [--keep-context]
// Resultado: etiqueta evoguard-real-sxxx:v0 y entrada en config/real-bases.json (digest, commits, Node,
// lockfile, dos ejecuciones de la suite sin red, parches de referencia aplicables, zona del cambio presente).
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docker } from '../sandbox/docker.mjs';
import { loadRealFamily, validateRealFamily, inPackage } from './families.mjs';
import { openReal, closeReal, execReal, runReal } from './docker.mjs';
import { runSuiteIn, failing, signature, knownFailures } from './suite.mjs';

export const BASES_PATH = 'config/real-bases.json';
const V0_ENV = 'GIT_AUTHOR_NAME="EvoGuard Pipeline" GIT_AUTHOR_EMAIL=pipeline@evoguard.invalid GIT_COMMITTER_NAME="EvoGuard Pipeline" GIT_COMMITTER_EMAIL=pipeline@evoguard.invalid GIT_AUTHOR_DATE=2000-01-01T00:00:00Z GIT_COMMITTER_DATE=2000-01-01T00:00:00Z';
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

export function readBases(root) {
  const path = join(root, BASES_PATH);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { schema_version: '1.0.0', note: 'Imágenes por familia semi-real (npm run real:prepare). Una entrada solo es válida con status VERIFIED.', bases: {} };
}

// Dockerfile de la familia. source: 'git' (clonado en la construcción) o 'dir' (carpeta local src/, para pruebas).
export function dockerfile({ source }) {
  const fetch = source === 'git'
    ? `RUN git init -q . && git fetch -q --depth 1 "$REPO_URL" "$V0_COMMIT" && test "$(git rev-parse FETCH_HEAD)" = "$V0_COMMIT" \\
 && git checkout -q FETCH_HEAD && rm -rf .git`
    : 'COPY --chown=1000:1000 src/ /workspace/repo/';
  return `# Generado por runner/real/prepare.mjs — imagen de una familia semi-real de EvoGuard.
ARG BASE
FROM \${BASE}
USER root
RUN mkdir -p /workspace/repo /workspace/.home && chown -R 1000:1000 /workspace
USER 1000:1000
ENV HOME=/workspace/.home CI=1 TZ=UTC LANG=C.UTF-8 npm_config_audit=false npm_config_fund=false npm_config_update_notifier=false COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /workspace/repo
ARG REPO_URL
ARG V0_COMMIT
ARG PKG=.
ARG INSTALL_CMD=
${fetch}
COPY --chown=1000:1000 install.sh /workspace/.install.sh
RUN git init -q -b main && printf 'node_modules/\\n' >> .git/info/exclude && git add -A \\
 && ${V0_ENV} git -c user.name="EvoGuard Pipeline" -c user.email=pipeline@evoguard.invalid commit -q -m "base: V0" \\
 && if [ -n "$INSTALL_CMD" ]; then cd "$PKG" && sh -c "$INSTALL_CMD" && printf '{"lock_dir":"%s","lockfile":null,"lockfile_sha256":null,"node":"%s"}\\n' "$PKG" "$(node -v)" > /workspace/.evoguard-install.json; else sh /workspace/.install.sh "$PKG"; fi \\
 && cd /workspace/repo && test -z "$(git status --porcelain --untracked-files=no)" \\
 && git status --porcelain --untracked-files=normal | sed -n 's#^?? #/#p' >> .git/info/exclude \\
 && test -z "$(git status --porcelain)"
LABEL org.evoguard.stratum=semi-real
`;
}

// Construye la imagen. options.source/srcDir/installCmd/base: pruebas y desarrollo; por defecto clona el repo.
export function buildImage(root, data, { base, source = 'git', srcDir, installCmd = '', keepContext = false } = {}) {
  const m = data.manifest;
  const context = join(root, '.artifacts/real/context', m.id);
  rmSync(context, { recursive: true, force: true });
  mkdirSync(context, { recursive: true });
  writeFileSync(join(context, 'Dockerfile'), dockerfile({ source }));
  copyFileSync(join(root, 'docker/real/install.sh'), join(context, 'install.sh'));
  if (source !== 'git') cpSync(srcDir, join(context, 'src'), { recursive: true });
  const iid = join(context, 'image.id');
  const tag = `evoguard-real-${m.id.toLowerCase()}:v0`;
  log(`${m.id}: construyendo ${tag} desde ${base} (${source === 'git' ? `${m.repo}@${m.v0.commit.slice(0, 12)}` : srcDir})`);
  docker(['build', '--pull=false', '--iidfile', iid, '-t', tag, '--build-arg', `BASE=${base}`, '--build-arg', `REPO_URL=${m.url}.git`, '--build-arg', `V0_COMMIT=${m.v0.commit}`,
    '--build-arg', `PKG=${m.package_path}`, '--build-arg', `INSTALL_CMD=${installCmd}`, context], { timeout: 3 * 3600000, stdio: 'inherit' });
  const image = readFileSync(iid, 'utf8').trim();
  if (!keepContext) rmSync(context, { recursive: true, force: true });
  return { image, tag };
}

// Verificación sin red: estado del repositorio, zona del cambio, parches de referencia aplicables en orden,
// y dos ejecuciones completas de la suite con el mismo resultado y sin fallos fuera de known_failures
// (una entrada sin « › » de known_failures es un archivo de test entero que ya no se ejecutaba en V0).
export async function verifyBase(root, data, image, { runs = 2 } = {}) {
  const m = data.manifest;
  const report = { image_id: image, checks: {} };
  let session = openReal(image, 'real-verify');
  try {
    const head = execReal(session, ['git', 'log', '--format=%H %s', '-n', '2']).split('\n');
    report.v0_repo_commit = head[0]?.split(' ')[0] ?? null;
    report.checks.single_v0_commit = head.length === 1 && / base: V0$/.test(head[0]);
    report.checks.clean = execReal(session, ['git', 'status', '--porcelain']) === '';
    report.checks.focus_exists = runReal(session, ['test', '-f', m.focus]).status === 'PASS';
    report.checks.hidden_dir_absent = runReal(session, ['test', '!', '-e', inPackage(m, m.hidden_tests_dir)]).status === 'PASS';
    report.install = JSON.parse(execReal(session, ['cat', '/workspace/.evoguard-install.json']));
    report.node = execReal(session, ['node', '-v']);
    report.checks.node_major = report.node.replace(/^v/, '').split('.')[0] === m.node;
    const directory = m.package_path === '.' ? [] : [`--directory=${m.package_path}`];
    report.patches = [];
    for (const turn of data.turns) {
      const applied = runReal(session, ['sh', '-c', `git apply ${directory.join(' ')} --whitespace=nowarn - <<'EVOGUARD_PATCH'\n${turn.patchText.replace(/\n+$/, '')}\nEVOGUARD_PATCH`]);
      report.patches.push({ turn: turn.id, status: applied.status, output: applied.status === 'PASS' ? undefined : applied.output.slice(0, 1000) });
    }
    report.checks.reference_patches_apply = report.patches.every(p => p.status === 'PASS');
  } finally { closeReal(session); }
  report.suite_runs = [];
  const known = knownFailures(m.known_failures);
  const signatures = [];
  for (let run = 0; run < runs; run++) {
    session = openReal(image, 'real-verify');
    try {
      log(`  ${m.id}: suite sin red ${run + 1}/${runs}…`);
      const result = await runSuiteIn(session, m);
      const bad = result.run ? failing(result.run).filter(k => !known.has(k)) : null;
      report.suite_runs.push({ error: result.error, seconds: Math.round(result.ms / 1000), total: result.run?.total ?? null, failing: bad, suites_failed: result.run?.suiteFailedFiles.filter(f => !known.has(f)) ?? null, tail: result.error || bad?.length || result.run?.suiteFailedFiles.some(f => !known.has(f)) ? result.tail : undefined });
      if (result.run) signatures.push(signature(result.run, known));
    } finally { closeReal(session); }
  }
  report.checks.suite_green = report.suite_runs.every(r => !r.error && r.failing.length === 0 && r.suites_failed.length === 0 && r.total > 0);
  report.checks.suite_stable = signatures.length === runs && signatures.every(s => s === signatures[0]);
  report.status = Object.values(report.checks).every(Boolean) ? 'VERIFIED' : 'FAILED';
  return report;
}

export async function prepare(root, familyId, options = {}) {
  const data = loadRealFamily(root, familyId);
  const errors = validateRealFamily(data, root);
  if (errors.length) throw new Error(`${familyId}: manifiesto inválido:\n${errors.join('\n')}`);
  const base = options.base ?? `node:${data.manifest.node}-bookworm`;
  const baseId = docker(['image', 'inspect', '--format', '{{.Id}}', base]);
  // Etiqueta local fijada al digest de la base: la construcción no consulta ningún registro.
  const localBase = `evoguard-real-base:${baseId.slice(7, 19)}`;
  docker(['tag', baseId, localBase]);
  const { image, tag } = buildImage(root, data, { ...options, base: localBase });
  const report = await verifyBase(root, data, image, options);
  const bases = readBases(root);
  bases.bases[familyId] = {
    status: report.status, image_id: image, tag, base_image: base, base_image_id: baseId,
    repo: data.manifest.repo, v0_commit: data.manifest.v0.commit, v0_repo_commit: report.v0_repo_commit,
    package_path: data.manifest.package_path, node: report.node, install: report.install,
    development_source: options.source === 'dir' ? 'local-directory (solo pruebas)' : undefined,
    source_archive: options.source === 'archive' ? { path: options.srcDir, note: 'git archive del commit V0 (repositorio no accesible por red); la carpeta debe contener exactamente ese árbol' } : undefined,
    prepared_at: new Date().toISOString(), checks: report.checks, patches: report.patches, suite_runs: report.suite_runs
  };
  if (!options.dryRun) writeFileSync(join(root, BASES_PATH), JSON.stringify(bases, null, 2) + '\n');
  return { ...report, tag };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const args = process.argv.slice(2);
  const ids = args.filter(a => /^S\d{3}$/.test(a));
  const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  if (!ids.length) { console.error('Uso: npm run real:prepare -- Sxxx [Sxxx…] [--base imagen]'); process.exit(1); }
  (async () => {
    for (const id of ids) {
      // --src-dir <carpeta>: árbol del commit V0 extraído con git archive, para repositorios que ya no se pueden clonar.
      const srcDir = option('--src-dir');
      const result = await prepare(root, id, { base: option('--base'), keepContext: args.includes('--keep-context'), ...(srcDir ? { source: 'archive', srcDir } : {}) });
      log(`${id}: ${result.status} — ${result.tag} ${result.image_id.slice(0, 19)}; suite ${result.suite_runs.map(r => r.error ?? `${r.total} tests, ${r.failing.length} fallos, ${r.seconds}s`).join(' / ')}; ${Object.entries(result.checks).filter(([, ok]) => !ok).map(([k]) => k).join(', ') || 'todas las comprobaciones OK'}`);
      if (result.status !== 'VERIFIED') process.exitCode = 1;
    }
  })().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
