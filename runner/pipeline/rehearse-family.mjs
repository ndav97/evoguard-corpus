// Ensayo de generación y auditoría de una familia sintética nueva, sin modelos (tarea 4 de
// docs/progreso-tareas-sin-modelos.md). Uso: npm run pipeline:rehearse-family -- F002
// Copia el repositorio (con los cambios sin confirmar) a un directorio temporal, genera V0→V3 con un constructor
// guionado que escribe los candidatos de tests/fixtures/rehearsal-family/<Fxxx>.mjs mediante las acciones del
// protocolo 1.1, audita con congelamiento y guarda la evidencia en docs/verification/family-rehearsal-<fxxx>.json.
// El corpus real no cambia: las referencias y los commits quedan en la copia desechable.
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const VERSIONS = ['V0', 'V1', 'V2', 'V3'];

// Constructor guionado: inspecciona, escribe cada archivo, ejecuta run_checks y entrega.
function scriptedAdapter(files, seen) {
  return {
    async next(context) {
      seen.push(context.provider);
      const steps = [{ type: 'list_files', path: '' }, { type: 'read_file', path: 'src/App.tsx' },
        ...Object.entries(files).map(([path, content]) => ({ type: 'write_file', path, content })),
        { type: 'run_checks' }, { type: 'deliver' }];
      return steps[Math.min(context.cycle, steps.length) - 1];
    }
  };
}

async function main() {
  const familyId = process.argv[2];
  if (!/^F\d{3}$/.test(familyId ?? '') || familyId === 'F001') throw new Error('Uso: npm run pipeline:rehearse-family -- Fxxx (familia sintética nueva)');
  const candidates = join(root, 'tests/fixtures/rehearsal-family', `${familyId}.mjs`);
  if (!existsSync(candidates)) throw new Error(`Faltan los candidatos instrumentales ${candidates}`);
  const { candidate } = await import(pathToFileURL(candidates).href);

  const copy = mkdtempSync(join(tmpdir(), `evoguard-${familyId.toLowerCase()}-`));
  const git = args => execFileSync('git', args, { cwd: copy, encoding: 'utf8' }).trim();
  const started = new Date().toISOString();
  try {
    cpSync(root, copy, { recursive: true, verbatimSymlinks: true, filter: source => !source.includes(`${join(root, '.artifacts')}`) });
    git(['add', '-A']);
    git(['-c', 'user.name=EvoGuard Rehearsal', '-c', 'user.email=rehearsal@invalid', 'commit', '-q', '--allow-empty', '-m', 'rehearsal: disposable base']);
    // Los módulos del pipeline fijan su raíz al importarse: se cargan desde la copia.
    const load = path => import(pathToFileURL(join(copy, path)).href);
    const { generate } = await load('runner/pipeline/generate.mjs');
    const { auditCorpus } = await load('runner/pipeline/audit.mjs');
    const { loadCorpus } = await load('runner/validation/corpus.mjs');

    const outcomes = [];
    for (const version of VERSIONS) {
      const seen = [];
      const status = await generate(version, { familyId, repoRoot: copy, adapterFactory: () => scriptedAdapter(candidate(version), seen) });
      assert.equal(status, 'ACCEPTED', `${familyId} ${version}: ${status}`);
      const family = loadCorpus(copy, familyId).family;
      outcomes.push({ version, status, provider: family.generation_plan[version], reference: family.reference_versions[version] });
    }
    const audit = await auditCorpus(copy, { familyId, freeze: true });
    assert.equal(audit.status, 'PASS', `auditoría: ${JSON.stringify(audit.findings)}`);
    const family = loadCorpus(copy, familyId).family;
    assert.equal(family.status, 'FROZEN', `${familyId} no quedó FROZEN`);
    const evidence = {
      artifact_type: 'family_generation_rehearsal', status: 'PASS', experimental: false, family_id: familyId,
      note: 'Constructores guionados en una copia desechable; el corpus real no cambia.',
      started_at: started, finished_at: new Date().toISOString(),
      versions: outcomes, audit: { status: audit.status, stability_runs: audit.stability_runs, findings: audit.findings, frozen: Boolean(audit.frozen) }, final_status: family.status,
      commits_in_copy: git(['log', '--format=%s', 'HEAD~12..HEAD']).split('\n')
    };
    writeFileSync(join(root, `docs/verification/family-rehearsal-${familyId.toLowerCase()}.json`), JSON.stringify(evidence, null, 2) + '\n');
    console.log(`PASS: ${familyId} V0→V3 aceptadas, auditoría y congelamiento en la copia ${copy}`);
  } finally {
    if (!process.env.EVOGUARD_KEEP_COPY) rmSync(copy, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
