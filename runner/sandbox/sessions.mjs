import { mkdirSync,writeFileSync,readFileSync,unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { assertManagedName } from './policy.mjs';
export function sessionPath(root,name) {assertManagedName(name);return join(root,'.artifacts/sessions',name+'.json');}
export function saveSession(root,session) {
  const path=sessionPath(root,session.name);mkdirSync(join(root,'.artifacts/sessions'),{recursive:true});
  writeFileSync(path,JSON.stringify({name:session.name,image:session.image})+'\n',{flag:'wx'});
}
export function loadSession(root,name) {
  const s=JSON.parse(readFileSync(sessionPath(root,name),'utf8'));
  if(s.name!==name||!/^sha256:[a-f0-9]{64}$/.test(s.image)) throw new Error('Sesión inválida');
  return s;
}
export function forgetSession(root,name) {unlinkSync(sessionPath(root,name));}
