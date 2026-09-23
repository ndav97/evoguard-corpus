import { fileURLToPath } from 'node:url';
import { openSandbox,execSandbox,closeSandbox } from './docker.mjs';
import { readContainerLock } from './lock.mjs';
import { saveSession,loadSession,forgetSession } from './sessions.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
try {
  const [action,name,...argv]=process.argv.slice(2);
  if(action==='open'&&!name) {
    const session=openSandbox(root);
    try {saveSession(root,session);} catch(error) {closeSandbox(session.name,session.image);throw error;}
    console.log(JSON.stringify(session,null,2));
  }
  else if(action==='exec'&&name&&argv.length) console.log(execSandbox(name,readContainerLock(root).image_id,argv));
  else if(action==='close'&&name&&!argv.length) {
    const session=loadSession(root,name);closeSandbox(name,session.image);forgetSession(root,name);
  }
  else throw new Error('Uso: sandbox open | sandbox exec <nombre> <programa> [argumentos] | sandbox close <nombre>');
} catch(error) {console.error(error.message);process.exitCode=1;}
