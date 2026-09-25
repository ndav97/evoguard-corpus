// Ejecución de acciones del protocolo 1.1 sobre un workspace aislado.
// Todas las acciones se traducen en `workspace.exec(argv)` dentro del contenedor del candidato: el host nunca
// lee ni escribe archivos del candidato. Los resultados tienen la misma forma que una herramienta de shell
// ({status, output}) para que el historial y la política de contexto los traten igual.
import { readFileSync } from 'node:fs';

const CONFIG = JSON.parse(readFileSync(new URL('../../config/protocol.json', import.meta.url), 'utf8'));
export const PROTOCOL_CONFIG = CONFIG;

// Rutas que el constructor no puede escribir: paquete de la tarea, fixture, historia Git y dependencias instaladas.
const PROTECTED = /^(TASK\.json$|fixtures\/|\.git(\/|$)|node_modules(\/|$)|dist\/)/;

// Script único dentro del contenedor; recibe la operación y sus datos en base64 (sin shell).
const SCRIPT = `const fs=require('node:fs'),path=require('node:path');
const [op,rel,a,b,limit]=process.argv.slice(1);const dec=s=>Buffer.from(s,'base64').toString('utf8');
const root=process.cwd();const target=path.resolve(root,rel||'.');
const out=(status,output)=>{process.stdout.write(JSON.stringify({status,output}));process.exit(0);};
if(target!==root&&!target.startsWith(root+path.sep))out('FAIL','ruta fuera del repositorio');
const real=p=>{let cur=p;while(!fs.existsSync(cur))cur=path.dirname(cur);const r=fs.realpathSync(cur);if(r!==root&&!r.startsWith(root+path.sep))out('FAIL','ruta fuera del repositorio (enlace)');};
real(target);
if(op==='read'){if(!fs.existsSync(target))out('FAIL','no existe: '+rel);const st=fs.statSync(target);if(st.isDirectory())out('FAIL','es un directorio; usa list_files: '+rel);
 const text=fs.readFileSync(target,'utf8');const max=Number(limit);
 out('PASS',text.length>max?text.slice(0,max)+'\\n[... archivo recortado: '+(text.length-max)+' caracteres más; lee por partes con tool sed -n ...]':text);}
if(op==='list'){if(!fs.existsSync(target))out('FAIL','no existe: '+(rel||'.'));const rows=[];const skip=new Set(['node_modules','.git','dist','coverage']);
 const walk=(d,depth)=>{for(const e of fs.readdirSync(d,{withFileTypes:true}).sort((x,y)=>x.name<y.name?-1:1)){if(skip.has(e.name))continue;const f=path.join(d,e.name),r=path.relative(root,f).split(path.sep).join('/');
  if(e.isDirectory()){rows.push(r+'/');if(depth<6)walk(f,depth+1);}else rows.push(r+'  ('+fs.statSync(f).size+' B)');if(rows.length>=Number(limit))return;}};
 walk(target,0);out('PASS',rows.join('\\n')||'(vacío)');}
if(op==='write'){const content=dec(a);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);out('PASS','escrito '+rel+' ('+Buffer.byteLength(content)+' B)');}
if(op==='edit'){if(!fs.existsSync(target))out('FAIL','no existe: '+rel);const text=fs.readFileSync(target,'utf8'),find=dec(a),rep=dec(b);
 const n=text.split(find).length-1;if(n===0)out('FAIL','find no aparece en '+rel+'; léelo con read_file y copia el texto exacto');if(n>1)out('FAIL','find aparece '+n+' veces en '+rel+'; amplía find para que sea único');
 fs.writeFileSync(target,text.replace(find,()=>rep));out('PASS','editado '+rel);}
if(op==='overview'){const skip=new Set(['node_modules','.git','dist','coverage']);const files=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true}).sort((x,y)=>x.name<y.name?-1:1)){if(skip.has(e.name))continue;const f=path.join(d,e.name);if(e.isDirectory())walk(f);else files.push({path:path.relative(root,f).split(path.sep).join('/'),bytes:fs.statSync(f).size});}};walk(root);
 const budget=Number(limit);let used=0;const contents={};for(const f of files){if(!/^src\\//.test(f.path))continue;if(used+f.bytes>budget)continue;contents[f.path]=fs.readFileSync(path.join(root,f.path),'utf8');used+=f.bytes;}
 out('PASS',JSON.stringify({files,contents}));}
out('FAIL','operación desconocida');`;

const b64 = text => Buffer.from(text, 'utf8').toString('base64');

export async function performAction(workspace, action, options = {}) {
  // El script responde {status, output} en stdout; el workspace lo entrega dentro de su propio {status, output}.
  const run = async argv => {
    const result = await workspace.exec(['node', '-e', SCRIPT, ...argv], options);
    if (result?.status === 'TIMEOUT' || result?.status === 'INFRA_ERROR') return result;
    try {
      const inner = JSON.parse(result.output);
      if (['PASS', 'FAIL'].includes(inner?.status) && typeof inner.output === 'string') return inner;
    } catch { /* salida no estructurada: se devuelve tal cual */ }
    return result;
  };
  switch (action.type) {
    case 'tool':
      return workspace.exec(action.argv, options);
    case 'read_file':
      return run(['read', action.path, '', '', String(CONFIG.read_max_chars)]);
    case 'list_files':
      return run(['list', action.path, '', '', String(CONFIG.list_max_entries)]);
    case 'write_file':
      if (PROTECTED.test(action.path)) return { status: 'FAIL', output: `ruta protegida: ${action.path} no se puede escribir` };
      if (Buffer.byteLength(action.content) > CONFIG.write_max_bytes) return { status: 'FAIL', output: `contenido demasiado grande (máximo ${CONFIG.write_max_bytes} B); divide el código en varios archivos` };
      return run(['write', action.path, b64(action.content), '', '0']);
    case 'edit_file':
      if (PROTECTED.test(action.path)) return { status: 'FAIL', output: `ruta protegida: ${action.path} no se puede editar` };
      if (Buffer.byteLength(action.find) + Buffer.byteLength(action.replace) > CONFIG.write_max_bytes) return { status: 'FAIL', output: 'edición demasiado grande; usa write_file o varias ediciones' };
      return run(['edit', action.path, b64(action.find), b64(action.replace), '0']);
    case 'run_checks': {
      const parts = [];
      let status = 'PASS';
      for (const [name, argv] of Object.entries(CONFIG.check_commands)) {
        const result = await workspace.exec(argv, options);
        if (result.status === 'TIMEOUT' || result.status === 'INFRA_ERROR') return result;
        if (result.status !== 'PASS') status = 'FAIL';
        const output = result.output.length > CONFIG.check_output_chars ? result.output.slice(-CONFIG.check_output_chars) : result.output;
        parts.push(`== ${name}: ${result.status}\n$ ${argv.join(' ')}\n${output}`);
      }
      return { status, output: parts.join('\n') };
    }
    default:
      throw new Error(`Acción no ejecutable: ${action.type}`);
  }
}

// Vista inicial del workspace para el constructor: árbol de archivos y contenido de src/ hasta el presupuesto.
export async function workspaceOverview(workspace, options = {}) {
  const result = await workspace.exec(['node', '-e', SCRIPT, 'overview', '', '', '', String(CONFIG.overview_content_bytes)], options);
  if (result?.status !== 'PASS') return null;
  try {
    const inner = JSON.parse(result.output);
    if (inner.status !== 'PASS') return null;
    const { files, contents } = JSON.parse(inner.output);
    return { note: 'Vista inicial del repositorio (sin node_modules, .git ni dist). TASK.json contiene la tarea completa.', files: files.map(f => `${f.path} (${f.bytes} B)`), contents };
  } catch { return null; }
}
