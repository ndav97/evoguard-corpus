import { readFileSync, mkdirSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const {files}=JSON.parse(readFileSync(0,'utf8'));
const expected=['package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html','src/App.tsx','src/main.tsx','fixtures/products.json','TASK.json','.gitignore'];
if(!files||Object.keys(files).sort().join()!==expected.sort().join()) throw new Error('Payload fuera de allowlist');
if(existsSync('/workspace/app')) throw new Error('Workspace ya inicializado');
const packet=JSON.parse(files['TASK.json']);
if(packet.version!=='V0'||packet.requirements.map(r=>r.id).join()!=='R001,R002') throw new Error('Solo scaffold V0 preparatorio');
for(const [path,content] of Object.entries(files)) {
  if(typeof content!=='string') throw new Error('Contenido no textual');
  const target=join('/workspace/app',path);
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,content);
}
cpSync('/opt/npm-cache','/tmp/npm-cache',{recursive:true});
// Herramientas instaladas durante build, idénticas al lockfile visible.
cpSync('/opt/deps/node_modules','/workspace/app/node_modules',{recursive:true});
const env={...process.env,GIT_AUTHOR_DATE:'2000-01-01T00:00:00Z',GIT_COMMITTER_DATE:'2000-01-01T00:00:00Z'};
const git=args=>execFileSync('git',args,{cwd:'/workspace/app',env,encoding:'utf8'}).trim();
git(['init','-b','main']);
git(['config','user.name','EvoGuard Pipeline']);git(['config','user.email','pipeline@evoguard.invalid']);
git(['add','.']);git(['commit','-m','scaffold: isolated baseline (not V0)']);
const hash=s=>createHash('sha256').update(s).digest('hex');
console.log(JSON.stringify({baseline_commit:git(['rev-parse','HEAD']),fixture_sha256:hash(files['fixtures/products.json']),packet_sha256:hash(files['TASK.json']),file_count:Object.keys(files).length}));
