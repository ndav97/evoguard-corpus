import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { IMAGE_FILES, VERIFICATION_FILES, readContainedFile, seedFiles } from './policy.mjs';
export const hashText=text=>createHash('sha256').update(text).digest('hex');
export function imageInputs(root) {return Object.fromEntries(IMAGE_FILES.map(p=>[p,hashText(readContainedFile(root,p))]));}
export function verificationInputs(root) {return Object.fromEntries(VERIFICATION_FILES.map(p=>[p,hashText(readContainedFile(root,p))]));}
export function validateContainerLock(lock,root,{allowCandidate=false}={}) {
  const errors=[];
  if(!lock || lock.schema_version!=='1.0.0') return ['Manifiesto de contenedor ausente o inválido'];
  if(!['VERIFIED',...(allowCandidate?['BUILT']:[])].includes(lock.status)) errors.push('Contenedor sin verificación vigente');
  if(!/^sha256:[a-f0-9]{64}$/.test(lock.image_id??'')) errors.push('Imagen sin digest inmutable');
  if(!/^node@sha256:[a-f0-9]{64}$/.test(lock.base_image??'')) errors.push('Base sin digest');
  if(lock.platform!=='linux/amd64') errors.push('Plataforma no permitida');
  if(lock.archive?.path!=='.artifacts/evoguard-runtime.tar' || !/^[a-f0-9]{64}$/.test(lock.archive?.sha256??'')) errors.push('Archivo de imagen sin checksum');
  if(!lock.inputs || Object.keys(lock.inputs).sort().join()!==[...IMAGE_FILES].sort().join()) errors.push('Allowlist de inputs inválida');
  for(const p of IMAGE_FILES) {
    try {if(lock.inputs?.[p]!==hashText(readContainedFile(root,p))) errors.push(`Imagen obsoleta: ${p}`);}
    catch(error) {errors.push(error.message);}
  }
  try {if(lock.base_image!==JSON.parse(readContainedFile(root,'docker/base.json')).image) errors.push('Base distinta de la especificada');} catch {errors.push('Base inválida');}
  if(lock.status==='VERIFIED'&&!allowCandidate) {
    if(JSON.stringify(lock.verification_inputs)!==JSON.stringify(verificationInputs(root))) errors.push('Verificación obsoleta: cambiaron controles o payload');
    if(lock.verification?.path!=='docs/verification/container.json') errors.push('Reporte de contenedor inválido');
    else {
      try {
        const bytes=readFileSync(join(root,lock.verification.path));
        const report=JSON.parse(bytes);
        if(report.cleanup?.timeout!==true || report.cleanup?.output_limit!==true) errors.push('Limpieza de procesos no verificada');
        const seed=seedFiles(root);
        const fixtureHash=hashText(seed['fixtures/products.json']);
        const packetHash=hashText(seed['TASK.json']);
        const lockfileHash=hashText(seed['package-lock.json']);
        const playwright=JSON.parse(seed['package.json']).devDependencies['@playwright/test'];
        if(hashText(bytes)!==lock.verification.sha256 || report.image_id!==lock.image_id || report.status!=='PASS' || report.clean_runs?.length!==2 || report.archive_sha256!==lock.archive.sha256 || JSON.stringify(report.verification_inputs)!==JSON.stringify(lock.verification_inputs)) errors.push('Evidencia de contenedor inconsistente');
        for(const run of report.clean_runs??[]) {
          if(run.fixture_sha256!==fixtureHash || run.lockfile_sha256!==lockfileHash || run.initialization?.fixture_sha256!==fixtureHash || run.initialization?.packet_sha256!==packetHash) errors.push('Payload verificado no coincide');
          if(run.runtime?.os!=='Linux' || run.runtime?.architecture!=='x64' || run.runtime?.playwright!==playwright || !/^\d+\.\d+\.\d+$/.test(run.runtime?.node??'') || !/^\d+\.\d+\.\d+$/.test(run.runtime?.npm??'')) errors.push('Runtime no verificado');
          if(run.status!=='PASS' || !run.runtime?.chromium || !/^[a-f0-9]{40}$/.test(run.initialization?.baseline_commit??'')) errors.push('Run de contenedor incompleto');
          for(const key of ['non_root','no_host_mounts_or_oracle','no_host_secrets','readonly_root_writable_workspace','no_future_in_packet','git_scaffold_only','external_network_and_host_denied','browser_localhost','inputs_unchanged']) if(run.checks?.[key]!==true) errors.push(`Control no verificado: ${key}`);
          if(!run.checks?.npm_ci_offline || !run.checks?.build) errors.push('Falta verificación offline/build');
        }
        if(report.clean_runs?.length===2 && (report.clean_runs[0].initialization?.baseline_commit!==report.clean_runs[1].initialization?.baseline_commit || JSON.stringify(report.clean_runs[0].runtime)!==JSON.stringify(report.clean_runs[1].runtime))) errors.push('Contenedores limpios inconsistentes');
      } catch {errors.push('Falta evidencia de contenedor');}
    }
  }
  return errors;
}
export function readContainerLock(root, options) {
  const p=join(root,'config/container.json');
  if(!existsSync(p)) throw new Error('Primero ejecutar npm run environment:build');
  const lock=JSON.parse(readFileSync(p,'utf8'));
  const errors=validateContainerLock(lock,root,options);
  if(errors.length) throw new Error(errors.join('\n'));
  return lock;
}
