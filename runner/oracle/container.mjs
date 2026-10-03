// Ejecución del oráculo contra el build del candidato en un contenedor de evaluación nuevo y aislado.
// El candidato solo aporta su build estático (dist): su código corre como JavaScript de página en el
// Chromium del contenedor, nunca como proceso Node ni en el host. El oráculo no entra jamás al
// contenedor del constructor, y este contenedor se destruye tras cada evaluación.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { openEvaluator, execSandbox, closeSandbox } from '../sandbox/docker.mjs';
import { familyDir } from '../families.mjs';

// Archivos del oráculo que viajan al contenedor de evaluación: código común, módulo de la familia evaluada,
// sus casos canónicos y su fixture (mínimo necesario para evaluate.mjs).
const COMMON = [
  'runner/oracle/evaluate.mjs', 'runner/oracle/spec.mjs', 'runner/oracle/generic-adapter.mjs', 'runner/oracle/remote.mjs',
  'runner/oracle/families/index.mjs'
];
export function oracleBundle(root, familyId = 'F001') {
  if (!/^F\d{3}$/.test(familyId)) throw new Error(`Familia inválida: ${familyId}`);
  const dir = familyDir(root, familyId);
  const family = JSON.parse(readFileSync(join(root, dir, 'family.yaml'), 'utf8'));
  const own = readdirSync(join(root, 'runner/oracle/families', familyId)).filter(name => /\.(mjs|json)$/.test(name)).map(name => `runner/oracle/families/${familyId}/${name}`);
  const cases = ['R001', 'R002', 'R003', 'R004', 'R005'].map(r => `archive/sintetico/oracle/${familyId}/${r}.cases.yaml`);
  const f001 = familyId === 'F001' ? ['runner/oracle/plans.mjs', 'runner/oracle/reference.mjs', 'runner/oracle/ui-adapter.mjs'] : [];
  return [...COMMON, ...f001, ...own.sort(), ...cases, `${dir}/${family.fixture.path}`];
}

const WRITER = `const fs=require('node:fs'),path=require('node:path');
const {bundle,site}=JSON.parse(fs.readFileSync(0,'utf8'));
const put=(base,rel,data)=>{if(rel.split('/').some(s=>!s||s==='.'||s==='..'))throw new Error('ruta inválida');const t=path.join(base,rel);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,Buffer.from(data,'base64'));};
for(const [rel,data] of Object.entries(bundle))put('/workspace/oracle',rel,data);
for(const [rel,data] of Object.entries(site))put('/workspace/site',rel,data);
fs.mkdirSync('/workspace/oracle/templates/react-vite',{recursive:true});
fs.symlinkSync('/opt/deps/node_modules','/workspace/oracle/templates/react-vite/node_modules');
console.log(JSON.stringify({bundle:Object.keys(bundle).length,site:Object.keys(site).length}));`;

// dist: { ruta: Buffer }. Devuelve el informe completo (privado) de runSuite.
export function runOracleInContainer(root, version, dist, { timeout = 600000, pageTimeout = 5000, familyId = 'F001' } = {}) {
  if (!dist || !dist['index.html']) throw Object.assign(new Error('Build sin index.html'), { code: 'NO_BUILD' });
  const bundle = Object.fromEntries(oracleBundle(root, familyId).map(path => [path, readFileSync(join(root, path)).toString('base64')]));
  const site = Object.fromEntries(Object.entries(dist).map(([path, data]) => [path, Buffer.from(data).toString('base64')]));
  const session = openEvaluator(root);
  const options = { role: 'oracle-evaluator' };
  try {
    execSandbox(session.name, session.image, ['node', '-e', WRITER], { ...options, input: JSON.stringify({ bundle, site }), timeout: 120000 });
    const output = execSandbox(session.name, session.image, ['node', '/workspace/oracle/runner/oracle/remote.mjs', version, String(pageTimeout), familyId], { ...options, timeout });
    return JSON.parse(output);
  } finally {
    closeSandbox(session.name, session.image, 'oracle-evaluator');
  }
}
