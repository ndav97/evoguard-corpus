import { isDeepStrictEqual } from 'node:util';
const RING=['openai','anthropic','google','local_a','local_b'];
const STAGES=['typecheck','build','development_tests','independent_oracle','architecture'];
const VISIBLE=new Set(STAGES.slice(0,3));
const clone=value=>structuredClone(value);
const timeoutError=()=>Object.assign(new Error('Límite temporal del intento'),{code:'ATTEMPT_TIMEOUT'});

function validate(options) {
  const p=options.policy;
  if(options.mode!=='simulation') throw new Error('Solo simulaciones; generación real deshabilitada');
  if(!p || p.max_attempts!==3 || p.max_agent_cycles!==25 || p.max_provider_assignments!==5 || !isDeepStrictEqual(p.provider_ring,RING) || p.timeout_seconds?.api!==1800 || p.timeout_seconds?.local!==3600 || p.oracle_visible!==false || p.oracle_failure!=='immediate_reassignment_no_feedback' || p.repair_base!=='own_previous_attempt' || p.reassignment_base!=='previous_validated_reference_or_scaffold') throw new Error('Política incompatible');
  if(!RING.includes(options.initialProvider) || options.packet?.version!=='V0') throw new Error('Proveedor o versión no disponible');
  if(options.simulationTimeoutMs!==undefined && (!Number.isInteger(options.simulationTimeoutMs)||options.simulationTimeoutMs<1||options.simulationTimeoutMs>1800000)) throw new Error('Timeout simulado inválido');
  for(const [object,method] of [[options.adapter,'next'],[options.workspaces,'open'],[options.evaluator,'check']]) if(typeof object?.[method]!=='function') throw new Error(`Falta interfaz ${method}`);
}

// Coordinador de confianza: adaptadores y evaluador nunca se ejecutan dentro del modelo.
// El único modo expuesto es simulation; esto no autoriza ni crea referencias del corpus.
export async function runTask(options) {
  validate(options);
  const {adapter,workspaces,evaluator,emit=()=>{}}=options;
  const packet=clone(options.packet), policy=clone(options.policy);
  const result={artifact_type:'runner_simulation',status:'SIMULATED_BLOCKED',attempts:[],events:[]};
  const record=(type,data={})=>{
    const event={sequence:result.events.length+1,type,...clone(data)};
    emit(clone(event));result.events.push(event);
  };
  const start=RING.indexOf(options.initialProvider);
  let stop=false;
  for(let assignment=0;assignment<5&&!stop;assignment++) {
    const provider=RING[(start+assignment)%5];
    let workspace;
    try {
      workspace=await workspaces.open();
      record('assignment',{provider,assignment:assignment+1});
      const messages=[];
      for(let attempt=1;attempt<=3;attempt++) {
        const started=Date.now();
        const limit=options.simulationTimeoutMs??1000*policy.timeout_seconds[provider.startsWith('local_')?'local':'api'];
        const deadline=started+limit;
        const controller=new AbortController();
        const bounded=async operation=>{
          const remaining=deadline-Date.now();
          if(remaining<=0) {controller.abort();throw timeoutError();}
          let timer;
          try {
            const value=await Promise.race([
              Promise.resolve().then(()=>operation({signal:controller.signal,timeout:remaining})),
              new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(timeoutError());},remaining);})
            ]);
            if(Date.now()>=deadline) {controller.abort();throw timeoutError();}
            return value;
          } finally {clearTimeout(timer);}
        };
        const row={provider,assignment:assignment+1,attempt,cycles:0,outcome:'REASSIGN',reason:null,validation:{},snapshot:null};
        result.attempts.push(row);
        record('attempt_started',{provider,attempt,packet,messages});
        try {
          let delivered=false;
          for(let cycle=1;cycle<=25;cycle++) {
            row.cycles=cycle;
            const response=await bounded(opts=>adapter.next(clone({provider,attempt,cycle,packet,messages}),opts));
            if(!response || !['tool','deliver','technical_failure'].includes(response.type) || JSON.stringify(response).length>262144) throw new Error('Respuesta de adaptador inválida');
            record('response',{provider,attempt,cycle,response});
            messages.push({role:'assistant',content:clone(response)});
            if(response.type==='deliver') {delivered=true;break;}
            if(response.type==='technical_failure') {row.reason='TECHNICAL_FAILURE';break;}
            if(!Array.isArray(response.argv)||!response.argv.length||response.argv.length>128||response.argv.some(a=>typeof a!=='string'||a.includes('\0')||a.length>16384)) throw new Error('Tool argv inválido');
            const output=await bounded(opts=>workspace.exec(response.argv,opts));
            if(output?.status==='TIMEOUT') {controller.abort();throw timeoutError();}
            if(!output||!['PASS','FAIL','INFRA_ERROR'].includes(output.status)||typeof output.output!=='string') throw new Error('Resultado de herramienta inválido');
            if(output.status==='INFRA_ERROR') throw new Error('Infraestructura de herramienta');
            const visible={status:output.status,output:output.output.slice(0,65536)};
            messages.push({role:'tool',content:visible});record('tool_result',{provider,attempt,cycle,...visible});
          }
          if(delivered) {
            for(const stage of STAGES) {
              const check=await bounded(opts=>evaluator.check(stage,workspace,opts));
              if(check?.status==='TIMEOUT') {controller.abort();throw timeoutError();}
              if(!check||!['PASS','FAIL','INFRA_ERROR'].includes(check.status)) throw new Error('Evaluación inválida');
              row.validation[stage]=check.status;
              record('evaluation',{provider,attempt,stage,status:check.status});
              if(check.status==='INFRA_ERROR') throw new Error('Infraestructura del evaluador');
              if(check.status==='FAIL') {
                row.reason=stage;
                if(VISIBLE.has(stage)&&attempt<3) {
                  if(typeof check.feedback!=='string') throw new Error('Feedback técnico ausente');
                  messages.push({role:'user',content:{source:stage,feedback:check.feedback.slice(0,65536),attempt:attempt+1}});
                  row.outcome='REPAIR';
                }
                break;
              }
            }
            if(STAGES.every(s=>row.validation[s]==='PASS')) row.outcome='SIMULATED_ACCEPTED';
          } else {row.reason??='CYCLE_LIMIT';}
          // Captura fuera del contexto del agente; preserva también los fallos.
          row.snapshot=await bounded(opts=>workspace.snapshot(opts));
          if(typeof row.snapshot!=='string') throw new Error('Snapshot inválido');
          if(row.outcome==='SIMULATED_ACCEPTED') {result.status='SIMULATED_ACCEPTED';stop=true;}
        } catch(error) {
          row.reason=error.code==='ATTEMPT_TIMEOUT'?'TIMEOUT':'INFRA_ERROR';
          row.outcome=error.code==='ATTEMPT_TIMEOUT'?'REASSIGN':'INFRA_ERROR';
          if(row.outcome==='INFRA_ERROR') {result.status='INFRA_ERROR';stop=true;}
        } finally {
          controller.abort();row.duration_ms=Date.now()-started;
          record('attempt_finished',row);
        }
        if(row.outcome!=='REPAIR') break;
      }
    } catch {
      result.status='INFRA_ERROR';stop=true;
    } finally {
      if(workspace) {
        try {await workspace.close();record('workspace_closed',{provider});}
        catch {result.status='INFRA_ERROR';stop=true;}
      }
    }
  }
  record('task_finished',{status:result.status});
  return result;
}
