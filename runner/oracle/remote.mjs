// Punto de entrada del oráculo DENTRO del contenedor de evaluación (rol oracle-evaluator, sin red).
// Lee el build estático del candidato de /workspace/site, ejecuta la suite de la versión con el Chromium
// de la imagen y escribe el informe JSON en stdout. Nunca se copia al workspace del constructor.
import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { runSuiteOnSite, VERSIONS } from './evaluate.mjs';

const [version, timeoutText, family = 'F001'] = process.argv.slice(2);
if (!VERSIONS.includes(version)) throw new Error(`Versión desconocida: ${version}`);
if (!/^F\d{3}$/.test(family)) throw new Error(`Familia inválida: ${family}`);
const site = '/workspace/site';
const files = {};
const walk = directory => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error('Enlace no permitido en el build');
    if (stat.isDirectory()) walk(full);
    else if (stat.isFile()) files[relative(site, full).split(sep).join('/')] = readFileSync(full);
  }
};
walk(site);
const report = await runSuiteOnSite(version, files, { timeout: Number(timeoutText) || 5000, family });
process.stdout.write(JSON.stringify(report));
