// Workspaces reales del constructor sobre sandboxes Docker (runner/sandbox).
// Toda ejecución ocurre dentro del contenedor del candidato mediante argv; nunca en un shell del host.
import { openSandbox, execSandbox, closeSandbox } from '../sandbox/docker.mjs';

// Ejecuta argv dentro del contenedor con límite de tiempo y salida acotada.
const WRAPPER = `import {spawnSync} from 'node:child_process';
const argv=JSON.parse(process.argv[1]);
const r=spawnSync(argv[0],argv.slice(1),{encoding:'utf8',timeout:Number(process.argv[2]),maxBuffer:4*1024*1024,shell:false,killSignal:'SIGKILL'});
console.log(JSON.stringify({status:r.error?.code==='ETIMEDOUT'?'TIMEOUT':r.error?(r.error.code==='ENOENT'?'FAIL':'INFRA_ERROR'):r.status===0?'PASS':'FAIL',output:((r.stdout??'')+(r.stderr??'')+(r.error?.code==='ENOENT'?'command not found: '+argv[0]:'')).slice(0,65536)}));`;

// Diff del árbol de trabajo respecto de HEAD (incluye archivos nuevos) con un índice temporal: no altera el índice
// del constructor, así que sus comandos git (checkout, diff, stash) siguen viendo su propio estado.
const SNAPSHOT = `const {execFileSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const idx=path.join(os.tmpdir(),'evoguard-index-'+process.pid);const own=execFileSync('git',['rev-parse','--git-path','index'],{encoding:'utf8'}).trim();
if(fs.existsSync(own))fs.copyFileSync(own,idx);const env={...process.env,GIT_INDEX_FILE:idx};
try{execFileSync('git',['add','--all'],{env});process.stdout.write(execFileSync('git',['diff','--cached','--binary','--no-ext-diff','HEAD'],{env,maxBuffer:16*1024*1024}));}
finally{fs.rmSync(idx,{force:true});}`;

// Exporta archivos regulares bajo un directorio (sin enlaces), en base64, con límites.
const EXPORT = `const fs=require('node:fs'),path=require('node:path');
const [root,maxFiles,maxBytes,excluded]=[process.argv[1],Number(process.argv[2]),Number(process.argv[3]),JSON.parse(process.argv[4])];
const files={};let count=0,total=0;
if(!fs.existsSync(root)){console.log(JSON.stringify({missing:true}));process.exit(0);}
const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1)){
  const full=path.join(dir,entry.name),rel=path.relative(root,full).split(path.sep).join('/');
  if(excluded.includes(rel.split('/')[0]))continue;
  const stat=fs.lstatSync(full);
  if(stat.isSymbolicLink())throw new Error('enlace no permitido: '+rel);
  if(stat.isDirectory()){walk(full);continue;}
  if(!stat.isFile())throw new Error('tipo no permitido: '+rel);
  if(++count>maxFiles)throw new Error('demasiados archivos');
  total+=stat.size;if(total>maxBytes)throw new Error('exportación demasiado grande');
  files[rel]=fs.readFileSync(full).toString('base64');}};
walk(root);console.log(JSON.stringify({files}));`;

const COMMIT = `const {execFileSync}=require('node:child_process');
const env={...process.env,GIT_AUTHOR_NAME:'EvoGuard Pipeline',GIT_AUTHOR_EMAIL:'pipeline@evoguard.invalid',GIT_COMMITTER_NAME:'EvoGuard Pipeline',GIT_COMMITTER_EMAIL:'pipeline@evoguard.invalid',GIT_AUTHOR_DATE:'2000-01-01T00:00:00Z',GIT_COMMITTER_DATE:'2000-01-01T00:00:00Z'};
execFileSync('git',['add','--all'],{env});
execFileSync('git',['commit','--allow-empty','-q','-m',process.argv[1]],{env});
process.stdout.write(execFileSync('git',['rev-parse','HEAD'],{env,encoding:'utf8'}).trim());`;

export function workspaceOps(session, { exec = execSandbox } = {}) {
  const run = (argv, options) => exec(session.name, session.image, argv, options);
  return {
    name: session.name,
    initialization: session.initialization,
    async exec(argv, { timeout = 60000 } = {}) {
      try {
        return JSON.parse(run(['node', '--input-type=module', '-e', WRAPPER, JSON.stringify(argv), String(Math.max(1, timeout - 1000))], { timeout }));
      } catch (error) {
        if (error.clientAborted && /ETIMEDOUT/.test(error.message)) return { status: 'TIMEOUT', output: '' };
        throw error;
      }
    },
    async snapshot({ timeout = 60000 } = {}) {
      // Sin recortar: el parche debe conservar su salto final y líneas de contexto en blanco.
      return run(['node', '-e', SNAPSHOT], { timeout, raw: true });
    },
    // Árbol de archivos del workspace (relativo a /workspace/app) para evaluaciones fuera del contenedor.
    async exportTree(directory = '.', { maxFiles = 400, maxBytes = 8 * 1024 * 1024, exclude = ['node_modules', 'dist', '.git', 'coverage'], timeout = 60000 } = {}) {
      if (!/^[A-Za-z0-9._/-]+$/.test(directory) || directory.split('/').includes('..')) throw new Error('Directorio de exportación inválido');
      const output = JSON.parse(run(['node', '-e', EXPORT, directory, String(maxFiles), String(maxBytes), JSON.stringify(exclude)], { timeout }));
      if (output.missing) return null;
      return Object.fromEntries(Object.entries(output.files).map(([path, data]) => [path, Buffer.from(data, 'base64')]));
    },
    async commit(message, { timeout = 60000 } = {}) {
      const hash = run(['node', '-e', COMMIT, message], { timeout });
      if (!/^[a-f0-9]{40}$/.test(hash)) throw new Error('Commit de candidato inválido');
      return hash;
    }
  };
}

// Fábrica para runTask: cada open() crea un contenedor nuevo con el seed indicado.
export function sandboxWorkspaces(root, { seed, onOpen = () => {}, onClose = () => {} } = {}) {
  return {
    async open() {
      const session = openSandbox(root, { seed });
      onOpen(session);
      const ops = workspaceOps(session);
      return {
        ...ops,
        async close() {
          closeSandbox(session.name, session.image);
          onClose(session);
        }
      };
    }
  };
}
