#!/usr/bin/env node
// EvoGuard — minero de bases V0 para el estrato semi-real.
//
// Busca repositorios React públicos que sirvan como estado base V0: sobre ese
// commit el equipo introduce sus propios cambios (T1..Tn) y usa la suite de
// tests existente del repo como detector de regresiones (pass-to-pass), junto
// al oráculo propio de cada cambio.
//
// Un buen V0 tiene:
//   - una app React web (no React Native) con runner unitario (vitest o jest);
//   - tests de componente/UI (Testing Library, .test.tsx) en cantidad y densidad;
//   - un tamaño manejable (miles o decenas de miles de líneas, no cientos de miles);
//   - lockfile (instalación reproducible) y pocas dependencias de servicios
//     (BD, colas) que obliguen a levantar infraestructura para los tests;
//   - licencia abierta e historia escrita mayoritariamente por personas.
//
// Sin dependencias: Node >= 18 y git en el PATH.
//
// Uso típico:
//   node mine-baselines.mjs --forges github,gitlab,codeberg          # descubre y analiza
//   node mine-baselines.mjs --repos repos.txt                        # lista manual
//   node mine-baselines.mjs --repos repos.txt --verify 40            # + línea base ejecutada
//
// Verificación de línea base (ejecuta código de terceros: hazlo en un contenedor
// o VM desechable). Se puede partir en dos fases para correr los tests sin red:
//   node mine-baselines.mjs --repos r.txt --verify 40 --verify-step install   (con red)
//   docker run --network none ... node mine-baselines.mjs --repos r.txt --verify 40 --verify-step test
//
// Opciones [por defecto]:
//   --forges LIST        github,gitlab,codeberg                 [github,gitlab,codeberg]
//   --repos FILE         una URL clonable u owner/repo (GitHub) por línea; '#' comenta
//   --min-stars N        [10]            --max-stars N           [100000]
//   --pages N            páginas por consulta de búsqueda         [2]
//   --active-since DATE  último commit posterior a esta fecha     [2025-09-01]
//   --v0-before DATE     V0 = último commit anterior a esta fecha [hoy]
//   --min-loc N          líneas mínimas del paquete UI            [2000]
//   --max-loc N          líneas máximas del paquete UI            [100000]
//   --min-ui-tests N     archivos de test de componente mínimos   [10]
//   --min-tests N        archivos de test unitario mínimos        [15]
//   --min-cases N        casos de test (it/test) mínimos          [80]
//   --include-libs yes   acepta librerías de componentes además de apps [no]
//   --max-ai X           proporción máxima de commits con trazas de agentes IA [0.3]
//   --max-per-owner N    máximo de repos por organización en la selección [3]
//   --depth N            commits de historia a descargar          [300]
//   --limit N            máximo de repos a analizar               [400]
//   --concurrency N      clones en paralelo                       [6]
//   --verify N           ejecuta la suite en V0 para los N primeros [0]
//   --verify-step S      install | test | both                    [both]
//   --verify-runs N      repeticiones de la suite (detecta flaky)  [2]
//   --workers N          workers de jest/vitest por suite          [2]
//   --test-timeout MIN   minutos máximos por ejecución de la suite [20]
//   --workdir DIR        caché de clones                          [.cache/mine]
//   --out DIR            resultados                               [.artifacts/baselines]
//
// Tokens opcionales: GITHUB_TOKEN, GITLAB_TOKEN, CODEBERG_TOKEN.
//
// Salidas: baselines.csv (seleccionados y reservas, ordenados), baselines.json
// (todas las métricas), screened.csv (todos los repos y motivo de descarte),
// summary.md.

import { execFile, exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const pexec = promisify(execFile);
const pexecShell = promisify(exec);
const log = (...a) => console.error(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ opciones
function parseArgs(argv) {
  const o = {
    forges: 'github,gitlab,codeberg', repos: null, minStars: 10, maxStars: 100000, pages: 2,
    activeSince: '2025-09-01', v0Before: new Date().toISOString().slice(0, 10),
    minLoc: 2000, maxLoc: 100000, minUiTests: 10, minTests: 15, minCases: 80, includeLibs: 'no', maxAi: 0.3, maxPerOwner: 3,
    depth: 300, limit: 400, concurrency: 6, verify: 0, verifyStep: 'both', verifyRuns: 2, workers: 2, testTimeout: 20,
    workdir: '.cache/mine', out: '.artifacts/baselines',
  };
  const keys = Object.fromEntries(Object.keys(o).map((k) => [`--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, k]));
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help') { console.log('Ver la cabecera del script.'); process.exit(0); }
    const k = keys[argv[i]];
    if (!k) throw new Error(`Opción desconocida: ${argv[i]}`);
    const v = argv[++i];
    o[k] = typeof o[k] === 'number' ? Number(v) : v;
  }
  if (o.repos && !argv.includes('--forges')) o.forges = '';
  return o;
}

// ------------------------------------------------------------------ constantes
const OPEN_LICENSES = new Set(['MIT', 'APACHE-2.0', 'BSD-2-CLAUSE', 'BSD-3-CLAUSE', 'ISC', 'MPL-2.0', '0BSD',
  'UNLICENSE', 'CC0-1.0', 'AGPL-3.0', 'GPL-3.0', 'GPL-2.0', 'LGPL-3.0', 'LGPL-2.1', 'EPL-2.0', 'POSTGRESQL']);
const AI_RE = /co-authored-by:[^\n]*(claude|copilot|codex|cursor|devin|gemini|openai|anthropic|aider|windsurf|jules|sweep)|generated with \[?(claude|codex|cursor)|🤖 generated|\b(copilot-swe-agent|codex-bot|devin-ai-integration|claude\[bot\]|cursoragent)\b/i;
const AI_SUBJECT_RE = /^\s*\[(ai|llm|gpt|claude|copilot|codex)\]/i;
const BOT_RE = /\b(bot|dependabot|renovate|github-actions|greenkeeper|semantic-release|transifex|weblate|crowdin|l10n|i18n-bot)\b|\[bot\]/i;
const CODE_RE = /\.(tsx|jsx|ts|js|mjs|cjs)$/i;
const UI_RE = /\.(tsx|jsx)$/i;
const TEST_RE = /(^|\/)(__tests__|__test__|tests?|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$/i;
const E2E_RE = /(^|\/)(e2e|cypress|playwright|integration-tests|browser-tests|visual|acceptance)(\/|$)|\.(e2e|cy|pw|playwright)\.[cm]?[jt]sx?$/i;
const IGNORE_RE = /(^|\/)(node_modules|dist|build|out|coverage|\.next|\.nuxt|vendor|vendors|third[_-]?party|public|storybook-static|__generated__|generated|gen|locales?|i18n|translations|fixtures?|__fixtures__|__mocks__|mocks?|examples?|demo|docs?|website|templates?|scripts|\.storybook|\.github)(\/|$)|\.(d\.ts|min\.js|stories\.[jt]sx?|story\.[jt]sx?|config\.[cm]?[jt]s)$/i;
const INFRA_DEPS = ['prisma', '@prisma/client', 'pg', 'postgres', 'mysql', 'mysql2', 'mongodb', 'mongoose', 'redis', 'ioredis',
  'firebase-admin', 'typeorm', 'sequelize', 'knex', 'drizzle-orm', 'kysely', '@neondatabase/serverless', 'better-sqlite3', 'bullmq'];

// ------------------------------------------------------------------ HTTP
class AuthError extends Error {}
async function getJson(url, headers = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'evoguard-miner', Accept: 'application/json', ...headers } });
    if (r.status === 401 || (r.status === 403 && r.headers.get('x-ratelimit-remaining') !== '0' && !r.headers.get('retry-after'))) {
      throw new AuthError(`${r.status} en ${new URL(url).host}: ${(await r.text()).slice(0, 160)}`);
    }
    if (r.status === 403 || r.status === 429) {
      const reset = Number(r.headers.get('x-ratelimit-reset'));
      const wait = reset ? Math.max(1000, reset * 1000 - Date.now()) : 15000 * (attempt + 1);
      if (wait > 120000) throw new Error(`Límite de API en ${new URL(url).host}; usa un token.`);
      log(`  límite de API, espero ${Math.round(wait / 1000)} s`); await sleep(wait); continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }
  throw new Error(`Sin respuesta útil: ${url}`);
}

// ------------------------------------------------------------------ descubrimiento
async function discoverGitHub(o) {
  const h = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const queries = [
    'topic:react topic:vitest', 'topic:react topic:jest', 'topic:react-testing-library',
    'topic:react topic:testing-library', 'topic:react topic:msw', 'topic:nextjs topic:vitest',
    'topic:react topic:self-hosted', 'topic:react topic:dashboard language:TypeScript',
    'topic:react-app language:TypeScript', 'topic:vite topic:react language:TypeScript',
  ];
  const out = [];
  for (const base of queries) {
    const q = `${base} stars:${o.minStars}..${o.maxStars} pushed:>${o.activeSince} archived:false fork:false`;
    for (let p = 1; p <= o.pages; p++) {
      try {
        const d = await getJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=100&page=${p}`, h);
        for (const r of d.items ?? []) out.push({ forge: 'github', full_name: r.full_name, clone_url: r.clone_url, web_url: r.html_url,
          stars: r.stargazers_count, license: r.license?.spdx_id ?? null, fork: r.fork, archived: r.archived });
        if ((d.items ?? []).length < 100) break;
        await sleep(h.Authorization ? 2200 : 6500);
      } catch (e) { log(`github: ${e.message}`); if (e instanceof AuthError) return out; break; }
    }
  }
  return out;
}

async function discoverGitLab(o) {
  const h = process.env.GITLAB_TOKEN ? { 'PRIVATE-TOKEN': process.env.GITLAB_TOKEN } : {};
  const out = [];
  for (const topic of ['react', 'reactjs', 'nextjs', 'vitest']) {
    for (let p = 1; p <= o.pages; p++) {
      try {
        const d = await getJson(`https://gitlab.com/api/v4/projects?topic=${topic}&visibility=public&order_by=star_count&sort=desc&last_activity_after=${o.activeSince}T00:00:00Z&per_page=100&page=${p}`, h);
        for (const r of d) if (r.star_count >= o.minStars && r.star_count <= o.maxStars) out.push({ forge: 'gitlab', full_name: r.path_with_namespace,
          clone_url: r.http_url_to_repo, web_url: r.web_url, stars: r.star_count, license: null, fork: Boolean(r.forked_from_project), archived: r.archived });
        if (d.length < 100) break;
      } catch (e) { log(`gitlab: ${e.message}`); break; }
    }
  }
  return out;
}

async function discoverGitea(o, host = 'codeberg.org', forge = 'codeberg') {
  const h = process.env.CODEBERG_TOKEN ? { Authorization: `token ${process.env.CODEBERG_TOKEN}` } : {};
  const out = [];
  for (const q of ['react', 'nextjs', 'vitest']) {
    for (let p = 1; p <= o.pages; p++) {
      try {
        const d = await getJson(`https://${host}/api/v1/repos/search?q=${q}&topic=true&sort=stars&order=desc&limit=50&page=${p}`, h);
        for (const r of d.data ?? []) if (r.stars_count >= o.minStars && r.updated_at >= o.activeSince) out.push({ forge, full_name: r.full_name,
          clone_url: r.clone_url, web_url: r.html_url, stars: r.stars_count, license: null, fork: r.fork, archived: r.archived });
        if ((d.data ?? []).length < 50) break;
      } catch (e) { log(`${forge}: ${e.message}`); break; }
    }
  }
  return out;
}

async function readRepoList(file) {
  const lines = (await fs.readFile(file, 'utf8')).split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
  return lines.map((line) => {
    // Formato: owner/repo | URL, opcionalmente con @SHA para fijar V0 (owner/repo@3c21d10…)
    const m = line.match(/^(.*?)(?:@([0-9a-f]{7,40}))?$/i);
    const l = m[1].trim(); const pin = m[2] ?? null;
    const url = /^[\w.-]+\/[\w.-]+$/.test(l) ? `https://github.com/${l}` : l.replace(/\.git$/, '');
    const u = new URL(url);
    const forge = u.host.includes('github') ? 'github' : u.host.includes('gitlab') ? 'gitlab' : u.host.includes('codeberg') ? 'codeberg' : u.host;
    return { forge, full_name: u.pathname.replace(/^\//, ''), clone_url: `${url}.git`, web_url: url, stars: null, license: null, fork: false, archived: false, pin };
  });
}

// ------------------------------------------------------------------ git
const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
async function git(cwd, args, timeout = 600000) {
  const { stdout } = await pexec('git', args, { cwd, maxBuffer: 512 * 1024 * 1024, timeout, env: gitEnv });
  return stdout;
}
async function gitOk(cwd, args) { try { return await git(cwd, args); } catch (e) { return e.code === 1 ? '' : Promise.reject(e); } }

async function cloneRepo(r, o) {
  const dir = path.resolve(o.workdir, `${r.forge}__${r.full_name.replace(/\//g, '__')}`);
  if (existsSync(path.join(dir, 'HEAD'))) return dir;
  await fs.mkdir(o.workdir, { recursive: true });
  await pexec('git', ['clone', '--quiet', '--bare', '--single-branch', `--depth=${o.depth}`, r.clone_url, dir],
    { timeout: 1200000, maxBuffer: 64 * 1024 * 1024, env: gitEnv });
  return dir;
}

async function pickV0(dir, before, pin) {
  if (pin) {
    // V0 fijado: si el clon superficial no lo contiene, se pide ese commit al remoto.
    const has = await git(dir, ['cat-file', '-e', `${pin}^{commit}`]).then(() => true, () => false);
    if (!has) await git(dir, ['fetch', '--quiet', '--depth=1', 'origin', pin]).catch(() => {});
    const l = (await git(dir, ['log', '-1', '--format=%H%x1f%cI%x1f%s', pin]).catch(() => '')).trim();
    if (!l) return null;
    const [sha, date, subject] = l.split('\u001f');
    return { sha, date, subject, pinned: true };
  }
  const line = (await git(dir, ['log', '-1', '--first-parent', `--before=${before}T23:59:59`, '--format=%H%x1f%cI%x1f%s', 'HEAD'])).trim();
  if (!line) return null;
  const [sha, date, subject] = line.split('\u001f');
  return { sha, date, subject };
}

async function readJsonAt(dir, rev, file) {
  try { return JSON.parse(await git(dir, ['show', `${rev}:${file}`])); } catch { return null; }
}

function detectLicense(t) {
  return /Mozilla Public License/i.test(t) ? 'MPL-2.0' : /GNU AFFERO/i.test(t) ? 'AGPL-3.0' : /GNU LESSER/i.test(t) ? (/version 2\.1/i.test(t) ? 'LGPL-2.1' : 'LGPL-3.0')
    : /GNU GENERAL PUBLIC/i.test(t) ? (/Version 2,/i.test(t) ? 'GPL-2.0' : 'GPL-3.0')
    : /Apache License/i.test(t) ? 'APACHE-2.0' : /Mozilla Public License/i.test(t) ? 'MPL-2.0'
    : /Business Source License|\bBSL\b|Elastic License|Server Side Public License|Commons Clause|Sustainable Use License|Fair Source/i.test(t) ? 'NO-ABIERTA'
    : /Permission is hereby granted, free of charge/i.test(t) ? 'MIT'
    : /Redistribution and use in source and binary forms/i.test(t) ? (/Neither the name|names of its contributors/i.test(t) ? 'BSD-3-CLAUSE' : 'BSD-2-CLAUSE')
    : /PostgreSQL Licen[cs]e/i.test(t) ? 'POSTGRESQL' : /Eclipse Public License/i.test(t) ? 'EPL-2.0'
    : /Permission to use, copy, modify, and\/or distribute/i.test(t) ? 'ISC' : /This is free and unencumbered software/i.test(t) ? 'UNLICENSE'
    : /CC0 1\.0|Creative Commons Legal Code|public domain/i.test(t) ? 'CC0-1.0' : 'OTRA';
}

// Cuenta líneas por archivo en un árbol: { path: lines }
async function countLines(dir, rev, prefix) {
  const out = await gitOk(dir, ['grep', '-c', '-I', '', rev, '--', prefix === '.' ? '.' : prefix]);
  const m = {};
  for (const l of out.split('\n')) { const i = l.lastIndexOf(':'); if (i > 0) m[l.slice(rev.length + 1, i)] = Number(l.slice(i + 1)); }
  return m;
}
async function grepFiles(dir, rev, prefix, pattern) {
  const out = await gitOk(dir, ['grep', '-l', '-I', '-E', pattern, rev, '--', prefix === '.' ? '.' : prefix]);
  return new Set(out.split('\n').filter(Boolean).map((l) => l.slice(rev.length + 1)));
}
async function grepCount(dir, rev, prefix, pattern) {
  const out = await gitOk(dir, ['grep', '-c', '-I', '-E', pattern, rev, '--', prefix === '.' ? '.' : prefix]);
  const m = {};
  for (const l of out.split('\n')) { const i = l.lastIndexOf(':'); if (i > 0) m[l.slice(rev.length + 1, i)] = Number(l.slice(i + 1)); }
  return m;
}

// ------------------------------------------------------------------ análisis
async function analyze(r, o) {
  const dir = await cloneRepo(r, o);
  const v0 = await pickV0(dir, o.v0Before, r.pin);
  if (!v0) return { dir, reject: 'sin commits antes de la fecha V0' };
  const rev = v0.sha;
  const files = (await git(dir, ['ls-tree', '-r', '--name-only', rev])).split('\n').filter(Boolean);
  const res = { dir, v0, files_total: files.length };

  // Licencia
  const lic = files.find((f) => /^(LICEN[CS]E|COPYING)(\.(md|txt))?$/i.test(f));
  res.license = r.license && r.license !== 'NOASSERTION' ? r.license.toUpperCase() : null;
  if (lic) res.license_file = detectLicense((await git(dir, ['show', `${rev}:${lic}`])).slice(0, 6000));
  res.license = res.license_file && res.license_file !== 'OTRA' ? res.license_file : res.license ?? res.license_file ?? null;

  // Paquetes
  const pkgFiles = files.filter((f) => /(^|\/)package\.json$/.test(f) && !IGNORE_RE.test(path.posix.dirname(f) + '/'));
  const rootPkg = await readJsonAt(dir, rev, 'package.json');
  const pkgs = [];
  for (const pf of pkgFiles.slice(0, 80)) {
    const j = pf === 'package.json' ? rootPkg : await readJsonAt(dir, rev, pf);
    if (!j) continue;
    const deps = { ...j.dependencies, ...j.devDependencies, ...j.peerDependencies };
    pkgs.push({ path: path.posix.dirname(pf), json: j, deps });
  }
  res.packages = pkgs.length;
  const REACT_HINTS = ['react', 'react-dom', 'next', '@dhis2/ui', '@dhis2/app-runtime', '@dhis2/cli-app-scripts', '@openedx/frontend-platform', '@openedx/frontend-base', '@edx/frontend-platform', '@openmrs/esm-framework'];
  const reactPkgs = pkgs.filter((p) => REACT_HINTS.some((d) => d in p.deps));
  if (!reactPkgs.length) return { ...res, reject: 'sin React' };
  if (reactPkgs.every((p) => 'react-native' in p.deps || 'expo' in p.deps)) return { ...res, reject: 'React Native' };

  // Tests y código por paquete React: se elige el paquete UI con más tests de componente.
  const rtlFiles = await grepFiles(dir, rev, '.', '@testing-library/(react|user-event|dom)|react-test-renderer|from .enzyme.|@testing-library/jest-dom');
  const allLines = await countLines(dir, rev, '.');
  const rootRunners = runnersOf(rootPkg ? { ...rootPkg.dependencies, ...rootPkg.devDependencies } : {});
  const reactImports = await grepFiles(dir, rev, '.', `from ['"]react['"]|require\\(['"]react['"]\\)`);
  const candidates = [];
  for (const p of reactPkgs) {
    if ('react-native' in p.deps && !('react-dom' in p.deps)) continue;
    const pre = p.path === '.' ? '' : `${p.path}/`;
    // Archivos de este paquete sin contar subpaquetes anidados
    const nested = pkgs.filter((q) => q !== p && q.path !== '.' && (pre === '' || q.path.startsWith(pre))).map((q) => `${q.path}/`);
    const own = files.filter((f) => f.startsWith(pre) && !nested.some((n) => f.startsWith(n)));
    const rel = (f) => f.slice(pre.length);
    const code = own.filter((f) => CODE_RE.test(f) && !IGNORE_RE.test(rel(f)));
    const tests = code.filter((f) => TEST_RE.test(rel(f)));
    const unitTests = tests.filter((f) => !E2E_RE.test(rel(f)));
    const src = code.filter((f) => !TEST_RE.test(rel(f)) && !E2E_RE.test(rel(f)));
    const uiTests = unitTests.filter((f) => UI_RE.test(f) || rtlFiles.has(f));
    const runners = runnersOf(p.deps);
    const allRunners = [...new Set([...runners, ...(runners.length ? [] : rootRunners)])];
    candidates.push({
      pkg: p, pre, own, src, unitTests, uiTests, runners: allRunners,
      loc: src.reduce((s, f) => s + ((allLines[f] ?? 0) > 5000 ? 0 : allLines[f] ?? 0), 0), // >5000 líneas: probablemente generado
      test_loc: unitTests.reduce((s, f) => s + (allLines[f] ?? 0), 0),
      components: src.filter((f) => UI_RE.test(f) || reactImports.has(f)).length,
      kind: pkgKind(p, own, pre),
    });
  }
  if (!candidates.length) return { ...res, reject: 'solo React Native' };
  const pool = o.includeLibs === 'yes' ? candidates : candidates.filter((x) => x.kind === 'app');
  if (!pool.length) return { ...res, reject: 'librería, no app' };
  // Entre las apps, la que tenga más tests de UI (a igualdad, más código).
  pool.sort((a, b) => b.uiTests.length - a.uiTests.length || b.loc - a.loc);
  const c = pool[0];
  const p = c.pkg;
  Object.assign(res, {
    pkg_path: p.path, kind: c.kind, loc: c.loc, test_loc: c.test_loc, src_files: c.src.length, components: c.components,
    unit_test_files: c.unitTests.length, ui_test_files: c.uiTests.length, runners: c.runners,
    ts_share: c.src.length ? +(c.src.filter((f) => /\.tsx?$/.test(f)).length / c.src.length).toFixed(2) : 0,
  });
  const unitRunner = c.runners.includes('vitest') ? 'vitest' : c.runners.includes('jest') ? 'jest' : null;
  res.unit_runner = unitRunner;

  // Casos de test y snapshots
  const pre = c.pre || '.';
  const cases = await grepCount(dir, rev, pre, '(^|[^.\\w])(it|test)(\\.(each|concurrent|only|skip)[^(]*)?\\(');
  const snaps = await grepCount(dir, rev, pre, 'toMatch(Inline)?Snapshot\\(');
  const unitSet = new Set(c.unitTests);
  res.test_cases = Object.entries(cases).filter(([f]) => unitSet.has(f)).reduce((s, [, n]) => s + n, 0);
  res.snapshot_asserts = Object.entries(snaps).filter(([f]) => unitSet.has(f)).reduce((s, [, n]) => s + n, 0);

  // Entorno y dependencias
  const deps = { ...(rootPkg ? { ...rootPkg.dependencies, ...rootPkg.devDependencies } : {}), ...p.deps };
  res.framework = 'next' in deps ? 'next' : ('@remix-run/react' in deps || '@react-router/dev' in deps) ? 'remix/react-router'
    : 'react-scripts' in deps ? 'cra' : 'vite' in deps ? 'vite' : 'webpack' in deps ? 'webpack' : 'rsbuild' in deps || '@rsbuild/core' in deps ? 'rsbuild' : 'otro';
  res.desktop = 'electron' in deps ? 'electron' : '@tauri-apps/api' in deps ? 'tauri' : null;
  res.msw = 'msw' in deps || 'nock' in deps || 'fetch-mock' in deps || 'axios-mock-adapter' in deps;
  res.infra_deps = INFRA_DEPS.filter((d) => d in deps);
  res.pm = files.includes('pnpm-lock.yaml') ? 'pnpm' : files.includes('yarn.lock') ? 'yarn' : files.some((f) => /^bun\.lockb?$/.test(f)) ? 'bun'
    : files.includes('package-lock.json') ? 'npm' : null;
  const pkgLock = [`${c.pre}pnpm-lock.yaml`, `${c.pre}yarn.lock`, `${c.pre}package-lock.json`].find((f) => files.includes(f));
  if (!res.pm && pkgLock) res.pm = pkgLock.endsWith('pnpm-lock.yaml') ? 'pnpm' : pkgLock.endsWith('yarn.lock') ? 'yarn' : 'npm';
  const rootLock = files.includes('package.json') && files.some((f) => /^(pnpm-lock\.yaml|yarn\.lock|package-lock\.json|bun\.lockb?)$/.test(f));
  res.lock_dir = pkgLock && p.path !== '.' && !rootLock ? p.path : rootLock ? '.' : pkgLock ? p.path : null;
  const nvm = files.find((f) => f === '.nvmrc' || f === '.node-version' || f === `${c.pre}.nvmrc`);
  const nodeSpec = (nvm ? (await git(dir, ['show', `${rev}:${nvm}`])).trim() : '') || p.json.engines?.node || rootPkg?.engines?.node || '';
  res.node = nodeSpec.slice(0, 20);
  res.node = (nodeSpec.match(/\d{2}[\d.x]*/) ?? [''])[0] || nodeSpec.split('\n')[0].slice(0, 20);
  res.node_major = Number((nodeSpec.match(/(\d{2})/) ?? [])[1]) || null;
  res.node_required = requiredNodeMajor(nodeSpec);

  res.test_script = p.json.scripts?.test ?? rootPkg?.scripts?.test ?? null;
  res.ci_tests = files.filter((f) => /^\.github\/workflows\/.+\.ya?ml$|^\.gitlab-ci\.yml$|^\.woodpecker/.test(f)).length > 0
    && (await grepFiles(dir, rev, '.github', '(vitest|jest|npm (run )?test|yarn test|pnpm test|test:unit|run test)')).size > 0;

  // Historia: actividad, autores humanos y trazas de agentes IA
  const SEP = '\u001e';
  const hist = (await git(dir, ['log', '--first-parent', `--max-count=${o.depth}`, rev, `--format=${SEP}%an%x1f%ae%x1f%cI%x1f%s%x1f%b`])).split(SEP).slice(1)
    .map((b) => { const [an, ae, date, s, body] = b.split('\u001f'); return { an, ae, date, s, body }; });
  const human = hist.filter((h) => !BOT_RE.test(`${h.an} ${h.ae}`));
  const ai = hist.filter((h) => AI_RE.test(`${h.an}\n${h.ae}\n${h.body}`) || AI_SUBJECT_RE.test(h.s));
  const since180 = new Date(new Date(v0.date).getTime() - 180 * 864e5).toISOString();
  Object.assign(res, {
    history_commits: hist.length, ai_share: hist.length ? +(ai.length / hist.length).toFixed(2) : 0,
    human_authors: new Set(human.map((h) => h.ae.toLowerCase())).size,
    commits_180d: hist.filter((h) => h.date >= since180).length,
    first_commit_in_window: hist.at(-1)?.date ?? null,
  });

  // Filtros duros
  const rej = [];
  if (!unitRunner) rej.push('sin vitest/jest');
  if (c.uiTests.length < o.minUiTests) rej.push(`pocos tests de UI (${c.uiTests.length})`);
  if (c.unitTests.length < o.minTests) rej.push(`pocos tests (${c.unitTests.length})`);
  if (res.test_cases < o.minCases) rej.push(`pocos casos de test (${res.test_cases})`);
  if (c.loc < o.minLoc) rej.push(`muy pequeño (${c.loc} líneas)`);
  if (c.loc > o.maxLoc) rej.push(`muy grande (${c.loc} líneas)`);
  if (!res.lock_dir) rej.push('sin lockfile');
  if (res.license === 'NO-ABIERTA') rej.push('licencia no abierta');
  if (res.ai_share > o.maxAi) rej.push(`${Math.round(res.ai_share * 100)} % commits con trazas IA`);
  if (v0.date < o.activeSince) rej.push(`inactivo desde ${v0.date.slice(0, 10)}`);
  if (rej.length) return { ...res, reject: rej.join('; ') };

  res.score = score(res);
  res.flags = flags(res);
  return res;
}

// App: paquete privado o con punto de entrada de aplicación; librería: se publica (main/exports) y no es privado.
function pkgKind(p, own, pre) {
  const j = p.json;
  const appFiles = own.some((f) => new RegExp(`^${pre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(index\\.html|public/index\\.html|next\\.config\\.[cm]?[jt]s|app/(layout|root)\\.[jt]sx|src/app/layout\\.[jt]sx|pages/_app\\.[jt]sx|src/pages/_app\\.[jt]sx|src/(main|index)\\.[jt]sx|electron|src-tauri/)`).test(f));
  const deps = p.deps;
  const appDeps = ['next', 'react-scripts', '@remix-run/react', '@react-router/dev', 'electron', '@tauri-apps/api', 'react-router-dom', 'react-router', '@tanstack/react-router', 'wouter'].some((d) => d in (j.dependencies ?? {}) || d in (j.devDependencies ?? {}));
  // 'main' por sí solo no indica publicación (muchas apps lo declaran para su servidor).
  const published = !j.private && (j.module || j.exports || j.types || j.typings || j.files || j.publishConfig) && !('next' in deps);
  const namedApp = /(-app|-frontend|-web|-webapp|-client|-dashboard|-console|-ui)$/i.test(j.name ?? '');
  if (appFiles || namedApp) return 'app';
  if (published) return 'lib';
  if (appDeps) return 'app';
  return p.path === '.' ? 'app' : 'lib'; // paquete interno de un monorepo sin punto de entrada propio
}

// Wrappers que traen jest por dentro (Open edX, DHIS2, CRA, craco, kcd-scripts…)
const JEST_WRAPPERS = ['react-scripts', '@openedx/frontend-build', '@edx/frontend-build', '@openedx/frontend-base', '@dhis2/cli-app-scripts', '@craco/craco',
  'react-app-rewired', 'kcd-scripts', 'razzle', '@nrwl/jest', '@nx/jest', 'ts-jest', 'babel-jest', '@swc/jest'];
// Versión mayor de Node que el repo exige (si la fija). Rangos abiertos (">=22") no fijan nada.
function requiredNodeMajor(spec) {
  const s = String(spec ?? '').split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#')) ?? '';
  if (!s || /^lts\/|^node$|^latest$|^current$|^stable$/i.test(s)) return null;
  if (/^>=?\s*v?\d+(\.[\dx*]+)*\s*$/.test(s)) return null;
  const m = s.match(/(\d{2})/);
  return m ? Number(m[1]) : null;
}

function runnersOf(deps) {
  const r = ['vitest', 'jest', '@playwright/test', 'cypress', 'mocha'].filter((d) => d in deps);
  if (JEST_WRAPPERS.some((d) => d in deps) && !r.includes('jest')) r.push('jest');
  return r;
}

function score(r) {
  const density = Math.min(1, r.ui_test_files / Math.max(1, r.components));   // tests de UI por componente
  const cases = Math.min(1, Math.log10(Math.max(1, r.test_cases)) / 3);         // 1000 casos = máximo
  const ratio = Math.min(1, r.test_loc / Math.max(1, r.loc));                    // líneas de test / código
  const size = r.loc >= 5000 && r.loc <= 40000 ? 1 : r.loc <= 80000 ? 0.6 : 0.25;
  const pk = r.packages <= 1 ? 1 : r.packages <= 4 ? 0.6 : 0.2;
  const snapRatio = r.test_cases ? r.snapshot_asserts / r.test_cases : 0;
  let s = 25 * density + 15 * cases + 10 * ratio + 20 * size + 10 * pk + 5 * r.ts_share
    + (r.msw ? 5 : 0) + (r.ci_tests ? 5 : 0) + (r.commits_180d >= 10 ? 5 : r.commits_180d > 0 ? 2 : 0)
    - (r.infra_deps.length ? 10 : 0) - (snapRatio > 0.4 ? 5 : 0) - (r.desktop ? 3 : 0) - r.ai_share * 10;
  return +s.toFixed(1);
}

function flags(r) {
  const f = [];
  if (r.packages > 4) f.push(`monorepo (${r.packages} paquetes)`);
  if (r.infra_deps.length) f.push(`deps de servicios: ${r.infra_deps.join(' ')}`);
  if (r.desktop) f.push(r.desktop);
  if (r.node_major && r.node_major > 24) f.push(`Node ${r.node_major}`);
  if (r.test_cases && r.snapshot_asserts / r.test_cases > 0.4) f.push('muchos snapshots');
  if (!r.license || r.license === 'OTRA') f.push('licencia por revisar');
  if (r.ai_share > 0.1) f.push(`IA ${Math.round(r.ai_share * 100)} %`);
  if (r.human_authors <= 1) f.push('un solo autor');
  return f;
}

// ------------------------------------------------------------------ verificación de línea base
// Ejecuta un comando y, al vencer el plazo, mata TODO su grupo de procesos (jest y
// vitest lanzan workers que, si no, siguen vivos y bloquean la espera).
// Cada 5 minutos escribe una línea para que se vea que sigue trabajando.
function sh(cmd, cwd, timeout, extraEnv = {}, label = null) {
  return new Promise((resolve) => {
    const t0 = Date.now(); let out = ''; let timedOut = false;
    const child = spawn(cmd, { cwd, shell: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1', FORCE_COLOR: '0', ...extraEnv } });
    const add = (d) => { out += d; if (out.length > 400000) out = out.slice(-200000); };
    child.stdout.on('data', add); child.stderr.on('data', add);
    const kill = () => {
      try {
        if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
        else process.kill(-child.pid, 'SIGKILL');
      } catch { /* ya terminó */ }
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, timeout);
    const beat = label ? setInterval(() => log(`      … ${label}: ${Math.round((Date.now() - t0) / 60000)} min`), 300000) : null;
    const done = (code) => {
      clearTimeout(timer); if (beat) clearInterval(beat);
      resolve({ ok: code === 0 && !timedOut, out: `${out}${timedOut ? '\n[TIMEOUT]' : ''}`.slice(-4000), ms: Date.now() - t0, timeout: timedOut });
    };
    child.on('close', done);
    child.on('error', (e) => { out += String(e); done(1); });
  });
}
function installCmd(pm) {
  return {
    pnpm: 'pnpm install --frozen-lockfile || corepack pnpm install --frozen-lockfile || npx -y pnpm@9 install --frozen-lockfile || npx -y pnpm@8 install --frozen-lockfile',
    yarn: 'yarn install --immutable || yarn install --frozen-lockfile || yarn install --frozen-lockfile --ignore-engines || corepack yarn install --immutable',
    bun: 'bun install --frozen-lockfile || npx -y bun install --frozen-lockfile',
    npm: 'npm ci --no-audit --no-fund || npm ci --no-audit --no-fund --legacy-peer-deps || npx -y npm@latest ci --no-audit --no-fund --legacy-peer-deps',
  }[pm ?? 'npm'];
}

// Node del repo: si exige otra versión mayor, se descarga el binario oficial (fase con red)
// y se guarda en la caché para la fase sin red.
async function nodeEnv(r, o, allowDownload) {
  const want = r.node_required;
  const have = Number(process.versions.node.split('.')[0]);
  if (!want || want === have) return { env: {}, node: process.versions.node };
  const dir = path.resolve(o.workdir, '_node', `v${want}`);
  const bin = path.join(dir, 'bin');
  if (!existsSync(path.join(bin, 'node'))) {
    if (!allowDownload) return { env: {}, node: process.versions.node, missing: want };
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const sums = await (await fetch(`https://nodejs.org/dist/latest-v${want}.x/SHASUMS256.txt`)).text();
    const file = (sums.match(new RegExp(`node-v[\\d.]+-linux-${arch}\\.tar\\.xz`)) ?? [])[0];
    if (!file) throw new Error(`No encuentro Node ${want} para linux-${arch}`);
    await fs.mkdir(dir, { recursive: true });
    const res = await sh(`curl -fsSL https://nodejs.org/dist/latest-v${want}.x/${file} | tar -xJ --strip-components=1 -C "${dir}"`, dir, 600000);
    if (!res.ok) throw new Error(`No se pudo descargar Node ${want}: ${res.out.slice(-300)}`);
  }
  const ver = (await sh(`"${path.join(bin, 'node')}" -v`, dir, 30000)).out.trim();
  return { env: { PATH: `${bin}${path.delimiter}${process.env.PATH}` }, node: ver };
}

async function readReport(file, runner) {
  try {
    const j = JSON.parse(await fs.readFile(file, 'utf8'));
    const suites = j.testResults ?? [];
    return { total: j.numTotalTests, passed: j.numPassedTests, failed: j.numFailedTests, skipped: (j.numPendingTests ?? 0) + (j.numTodoTests ?? 0),
      suites_failed: (j.numRuntimeErrorTestSuites ?? 0) + suites.filter((t) => t.status === 'failed' && !(t.assertionResults ?? []).some((a) => a.status === 'failed')).length,
      failing: suites.flatMap((t) => (t.assertionResults ?? []).filter((a) => a.status === 'failed').map((a) => `${path.basename(t.name ?? t.testFilePath ?? '')} › ${a.fullName ?? a.title}`)).sort().slice(0, 1000), runner };
  } catch { return null; }
}
// Estado de la línea base a partir de las ejecuciones. Los fallos que se repiten
// idénticos en todas las ejecuciones son «fallos conocidos»: se excluyen del oráculo
// pass-to-pass (como en SWE-bench) si no pasan del 5 % de los tests.
function classifyRuns(runs) {
  const first = runs[0] ?? {};
  const rep = first.report;
  const sig = (x) => JSON.stringify([x.report?.failing ?? [], x.report?.suites_failed ?? 0, x.report?.total ?? null]);
  const same = runs.every((x) => sig(x) === sig(first));
  const out = { tests_total: rep?.total ?? null, tests_failed: rep?.failed ?? null, suites_failed: rep?.suites_failed ?? null,
    suite_seconds: first.ms ? Math.round(first.ms / 1000) : null, known_failures: rep?.failing ?? [] };
  out.status = runs.some((x) => x.timeout) ? 'TIMEOUT' : !rep ? 'NO_REPORT' : !rep.total ? 'NO_TESTS'
    : !same ? 'FLAKY' : rep.failed === 0 && !rep.suites_failed ? 'GREEN'
    : rep.failed / rep.total <= 0.05 && (rep.suites_failed ?? 0) <= 2 ? 'GREEN_WITH_KNOWN_FAILURES' : 'RED';
  return out;
}

async function verifyBaseline(r, o) {
  const wt = path.resolve(o.workdir, '_baselines', `${r.forge}__${r.full_name.replace(/\//g, '__')}`);
  const res = { v0: r.v0.sha };
  if (o.verifyStep !== 'test') {
    await fs.rm(wt, { recursive: true, force: true });
    await git(r.dir, ['worktree', 'prune']);
    await git(r.dir, ['worktree', 'add', '--force', '--detach', wt, r.v0.sha]);
    let ne;
    try { ne = await nodeEnv(r, o, true); } catch (e) { res.status = 'INSTALL_FAILED'; res.log = String(e.message); return res; }
    res.node = ne.node.replace(/^v/, '');
    const inst = await sh(installCmd(r.pm), path.join(wt, r.lock_dir ?? '.'), 1800000, ne.env, `${r.full_name} (instalación)`);
    res.install_ok = inst.ok; res.install_ms = inst.ms;
    if (!inst.ok) { res.status = 'INSTALL_FAILED'; res.log = inst.out; return res; }
    if (o.verifyStep === 'install') { res.status = 'INSTALLED'; return res; }
  }
  if (!existsSync(wt)) { res.status = 'NOT_INSTALLED'; return res; }
  const cwd = path.join(wt, r.pkg_path);
  // Misma versión de Node que en la instalación (las bases instaladas antes con el Node
  // del contenedor siguen con él).
  const instFile = path.join(o.out, 'verify', `${r.forge}__${r.full_name.replace(/\//g, '__')}.install.json`);
  const inst = existsSync(instFile) ? JSON.parse(await fs.readFile(instFile, 'utf8')) : {};
  const usedOther = inst.node && inst.node.replace(/^v/, '').split('.')[0] !== process.versions.node.split('.')[0];
  const ne = usedOther ? await nodeEnv(r, o, false) : { env: {}, node: process.versions.node };
  res.node = ne.node;
  // Dos formas de lanzar la suite: el runner directo (sin descargar nada) y, si no deja
  // informe, el script `test` del repo con los mismos argumentos (wrappers como
  // fedx-scripts o d2-app-scripts reenvían los argumentos a jest).
  // Pocos workers: con muchos, las suites grandes agotan la memoria del contenedor.
  const w = o.workers;
  const reporterArgs = (rep) => (r.unit_runner === 'vitest'
    ? `--run --reporter=json --outputFile="${rep}" --passWithNoTests --maxWorkers=${w}`
    : `--ci --json --outputFile="${rep}" --passWithNoTests --watchAll=false --maxWorkers=${w} --forceExit`);
  const direct = (rep) => (r.unit_runner === 'vitest'
    ? `npx --no-install vitest run --reporter=json --outputFile="${rep}" --passWithNoTests --maxWorkers=${w}`
    : `npx --no-install jest --ci --json --outputFile="${rep}" --passWithNoTests --maxWorkers=${w} --forceExit`);
  const viaScript = (rep) => `${r.pm === 'yarn' ? 'yarn' : r.pm === 'pnpm' ? 'pnpm' : 'npm'} run test ${r.pm === 'npm' ? '-- ' : ''}${reporterArgs(rep)}`;
  const runs = [];
  let mode = null;
  for (let i = 0; i < o.verifyRuns; i++) {
    const rep = path.join(wt, `.evoguard-report-${i}.json`);
    await fs.rm(rep, { force: true });
    let run = null; let report = null;
    for (const [name, build] of mode ? [[mode, mode === 'direct' ? direct : viaScript]] : [['direct', direct], ['script', viaScript]]) {
      run = await sh(build(rep), cwd, o.testTimeout * 60000, ne.env, `${r.full_name} (ejecución ${i + 1}/${o.verifyRuns}, ${name})`);
      report = await readReport(rep, r.unit_runner);
      if ((report && (report.total > 0 || name === 'script')) || run.timeout) { mode = name; break; }
    }
    runs.push({ ok: run.ok, ms: run.ms, timeout: run.timeout, mode, report, tail: report?.failed === 0 ? undefined : run.out.slice(-1500) });
    if (run.timeout) break;
  }
  res.mode = mode;
  res.runs = runs;
  Object.assign(res, classifyRuns(runs));
  return res;
}

// ------------------------------------------------------------------ salida
function csvCell(v) { const s = v == null ? '' : Array.isArray(v) ? v.join(' | ') : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function toCsv(rows) { const cols = Object.keys(rows[0] ?? {}); return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n'); }
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

// ------------------------------------------------------------------ main
async function main() {
  const o = parseArgs(process.argv.slice(2));
  await fs.mkdir(o.out, { recursive: true });
  let repos = o.repos ? await readRepoList(o.repos) : [];
  const forges = o.forges.split(',').filter(Boolean);
  if (forges.includes('github')) repos.push(...await discoverGitHub(o));
  if (forges.includes('gitlab')) repos.push(...await discoverGitLab(o));
  if (forges.includes('codeberg')) repos.push(...await discoverGitea(o));
  const uniq = [...new Map(repos.map((r) => [`${r.forge}:${r.full_name.toLowerCase()}`, r])).values()]
    .filter((r) => !r.fork && !r.archived).slice(0, o.limit);
  log(`Analizando ${uniq.length} repos.`);

  const analyzed = await pool(uniq, o.concurrency, async (r, k) => {
    try { const a = await analyze(r, o); log(`[${k + 1}/${uniq.length}] ${r.full_name}: ${a.reject ?? `OK ${a.score}`}`); return { ...r, ...a }; }
    catch (e) { log(`[${k + 1}/${uniq.length}] ${r.full_name}: error`); return { ...r, reject: `error: ${String(e.message).split('\n')[0].slice(0, 160)}` }; }
  });

  const ok = analyzed.filter((r) => !r.reject).sort((a, b) => b.score - a.score);
  const perOwner = {};
  for (const r of ok) {
    const owner = r.full_name.split('/')[0].toLowerCase();
    perOwner[owner] = (perOwner[owner] ?? 0) + 1;
    r.tier = perOwner[owner] <= o.maxPerOwner ? 'seleccion' : 'reserva';
  }
  const ranked = [...ok.filter((r) => r.tier === 'seleccion'), ...ok.filter((r) => r.tier === 'reserva')];

  if (o.verify > 0) {
    // Reanudable: cada repo deja su resultado en <out>/verify/ y, si se vuelve a lanzar
    // el mismo comando, los ya terminados se saltan.
    const vdir = path.join(o.out, 'verify');
    await fs.mkdir(vdir, { recursive: true });
    const list = ranked.slice(0, o.verify);
    for (const [k, r] of list.entries()) {
      const f = path.join(vdir, `${r.forge}__${r.full_name.replace(/\//g, '__')}.${o.verifyStep}.json`);
      const prev = existsSync(f) ? JSON.parse(await fs.readFile(f, 'utf8')) : null;
      if (prev?.runs) Object.assign(prev, classifyRuns(prev.runs)); // criterios actuales
      const retry = o.verifyStep === 'install' ? ['ERROR', 'INSTALL_FAILED'] : ['ERROR', 'TIMEOUT', 'NO_REPORT', 'NO_TESTS'];
      const running = f.replace(/\.json$/, '.running');
      if (o.verifyStep === 'test' && existsSync(running) && !(prev && prev.v0 === r.v0.sha && !retry.includes(prev.status))) {
        // Un intento anterior empezó y nunca terminó (equipo suspendido, Docker colgado…): se marca y se salta.
        r.baseline = { v0: r.v0.sha, status: 'HUNG', log: `Intento iniciado ${await fs.readFile(running, 'utf8')} sin terminar` };
        await fs.writeFile(f, JSON.stringify(r.baseline, null, 2)); await fs.rm(running, { force: true });
        log(`[${k + 1}/${list.length}] ${r.full_name}: se salta (un intento anterior se colgó)`); continue;
      }
      if (prev && prev.v0 === r.v0.sha && !retry.includes(prev.status)) { r.baseline = prev; log(`[${k + 1}/${list.length}] ${r.full_name}: ya hecho (${prev.status})`); continue; }
      const instFile = f.replace(/\.test\.json$/, '.install.json');
      if (o.verifyStep === 'test' && existsSync(instFile)) {
        const inst = JSON.parse(await fs.readFile(instFile, 'utf8'));
        if (inst.status === 'INSTALL_FAILED' || inst.status === 'ERROR') { r.baseline = inst; log(`[${k + 1}/${list.length}] ${r.full_name}: se salta (${inst.status} en la instalación)`); continue; }
      }
      log(`[${k + 1}/${list.length}] línea base (${o.verifyStep}): ${r.full_name} …`);
      const runningFile = f.replace(/\.json$/, '.running');
      if (o.verifyStep === 'test') await fs.writeFile(runningFile, new Date().toISOString());
      r.baseline = await verifyBaseline(r, o).catch((e) => ({ v0: r.v0.sha, status: 'ERROR', log: String(e.message).slice(0, 2000) }));
      await fs.rm(runningFile, { force: true });
      await fs.writeFile(f, JSON.stringify(r.baseline, null, 2));
      log(`[${k + 1}/${list.length}] ${r.full_name}: ${r.baseline.status}${r.baseline.tests_total != null ? ` (${r.baseline.tests_total} tests, ${r.baseline.tests_failed} fallan, ${r.baseline.suite_seconds} s)` : ''}`);
    }
    // En la fase de test, el estado de instalación se toma de la fase previa si existe.
  }

  const rows = ranked.map((r, i) => ({
    rank: i + 1, tier: r.tier, forge: r.forge, repo: r.full_name, score: r.score, license: r.license,
    v0_sha: r.v0.sha.slice(0, 12), v0_date: r.v0.date.slice(0, 10), pkg_path: r.pkg_path, framework: r.framework,
    unit_runner: r.unit_runner, pm: r.pm, node: r.node, loc: r.loc, components: r.components,
    ui_test_files: r.ui_test_files, unit_test_files: r.unit_test_files, test_cases: r.test_cases,
    test_loc_ratio: +(r.test_loc / Math.max(1, r.loc)).toFixed(2), msw: r.msw, packages: r.packages,
    ai_share: r.ai_share, human_authors: r.human_authors, commits_180d: r.commits_180d, ci_tests: r.ci_tests,
    flags: r.flags.join('; '), baseline: r.baseline?.status ?? '', baseline_tests: r.baseline?.tests_total ?? '',
    baseline_seconds: r.baseline?.suite_seconds ?? '', url: r.web_url,
  }));
  const strip = ({ dir, ...r }) => r;
  await fs.writeFile(path.join(o.out, 'baselines.json'), JSON.stringify({ generated_at: new Date().toISOString(), options: o, baselines: ranked.map(strip) }, null, 2));
  if (rows.length) await fs.writeFile(path.join(o.out, 'baselines.csv'), toCsv(rows));
  await fs.writeFile(path.join(o.out, 'screened.csv'), toCsv(analyzed.map((r) => ({
    forge: r.forge, repo: r.full_name, status: r.reject ? 'descartado' : 'aprobado', reason: r.reject ?? '', loc: r.loc ?? '',
    ui_test_files: r.ui_test_files ?? '', unit_test_files: r.unit_test_files ?? '', ai_share: r.ai_share ?? '', license: r.license ?? '', url: r.web_url }))));
  const sel = rows.filter((r) => r.tier === 'seleccion');
  await fs.writeFile(path.join(o.out, 'summary.md'), [
    `# Bases V0 — ${new Date().toISOString().slice(0, 10)}`, '',
    `Analizados ${analyzed.length} repos; aprobados ${ok.length}; selección ${sel.length} (máx. ${o.maxPerOwner} por organización); reservas ${rows.length - sel.length}.`,
    `V0 = último commit antes de ${o.v0Before}. Filtros: vitest/jest, ≥${o.minUiTests} tests de UI, ≥${o.minTests} tests, ${o.minLoc}–${o.maxLoc} líneas, lockfile, licencia abierta, IA ≤ ${o.maxAi * 100} %, activo desde ${o.activeSince}.`, '',
    '| # | Repo | Puntos | Licencia | V0 | Paquete | Líneas | Tests UI | Casos | Runner | Avisos |', '|---|---|---|---|---|---|---|---|---|---|---|',
    ...sel.map((r) => `| ${r.rank} | ${r.repo} | ${r.score} | ${r.license ?? '?'} | \`${r.v0_sha}\` ${r.v0_date} | ${r.pkg_path} | ${r.loc} | ${r.ui_test_files} | ${r.test_cases} | ${r.unit_runner} | ${r.flags} |`),
  ].join('\n'));
  log(`Listo: ${ok.length} aprobados (${sel.length} en selección) → ${o.out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
