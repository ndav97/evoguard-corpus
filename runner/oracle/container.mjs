// Ejecución del oráculo contra el build del candidato en un contenedor de evaluación nuevo y aislado.
// El candidato solo aporta su build estático (dist): su código corre como JavaScript de página en el
// Chromium del contenedor, nunca como proceso Node ni en el host. El oráculo no entra jamás al
// contenedor del constructor, y este contenedor se destruye tras cada evaluación.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openEvaluator, execSandbox, closeSandbox } from '../sandbox/docker.mjs';

// Archivos del oráculo que viajan al contenedor de evaluación (mínimo necesario para evaluate.mjs).
export const ORACLE_BUNDLE = [
  'runner/oracle/evaluate.mjs', 'runner/oracle/plans.mjs', 'runner/oracle/reference.mjs', 'runner/oracle/ui-adapter.mjs',
  'runner/oracle/remote.mjs', 'runner/oracle/spec-lock.json',
  'oracle/F001/R001.cases.yaml', 'oracle/F001/R002.cases.yaml', 'oracle/F001/R003.cases.yaml', 'oracle/F001/R004.cases.yaml', 'oracle/F001/R005.cases.yaml',
  'families/F001-product-catalog/fixtures/products.json'
];

const WRITER = `const fs=require('node:fs'),path=require('node:path');
const {bundle,site}=JSON.parse(fs.readFileSync(0,'utf8'));
const put=(base,rel,data)=>{if(rel.split('/').some(s=>!s||s==='.'||s==='..'))throw new Error('ruta inválida');const t=path.join(base,rel);fs.mkdirSync(path.dirname(t),{recursive:true});fs.writeFileSync(t,Buffer.from(data,'base64'));};
for(const [rel,data] of Object.entries(bundle))put('/workspace/oracle',rel,data);
for(const [rel,data] of Object.entries(site))put('/workspace/site',rel,data);
fs.mkdirSync('/workspace/oracle/templates/react-vite',{recursive:true});
fs.symlinkSync('/opt/deps/node_modules','/workspace/oracle/templates/react-vite/node_modules');
console.log(JSON.stringify({bundle:Object.keys(bundle).length,site:Object.keys(site).length}));`;

// dist: { ruta: Buffer }. Devuelve el informe completo (privado) de runSuite.
export function runOracleInContainer(root, version, dist, { timeout = 600000, pageTimeout = 5000 } = {}) {
  if (!dist || !dist['index.html']) throw Object.assign(new Error('Build sin index.html'), { code: 'NO_BUILD' });
  const bundle = Object.fromEntries(ORACLE_BUNDLE.map(path => [path, readFileSync(join(root, path)).toString('base64')]));
  const site = Object.fromEntries(Object.entries(dist).map(([path, data]) => [path, Buffer.from(data).toString('base64')]));
  const session = openEvaluator(root);
  const options = { role: 'oracle-evaluator' };
  try {
    execSandbox(session.name, session.image, ['node', '-e', WRITER], { ...options, input: JSON.stringify({ bundle, site }), timeout: 120000 });
    const output = execSandbox(session.name, session.image, ['node', '/workspace/oracle/runner/oracle/remote.mjs', version, String(pageTimeout)], { ...options, timeout });
    return JSON.parse(output);
  } finally {
    closeSandbox(session.name, session.image, 'oracle-evaluator');
  }
}
