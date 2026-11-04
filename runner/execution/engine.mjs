import { isDeepStrictEqual } from 'node:util';
import { ACTION_TYPES, actionKey } from '../protocol/actions.mjs';
import { performAction, workspaceOverview, PROTOCOL_CONFIG } from '../protocol/execute.mjs';
const RING=['openai','anthropic','google','local_a','local_b'];
// Modelos que solo se miden en episodios de un único proveedor (singleProvider), nunca en la rotación del corpus
// (decisión 2026-10-31: Qwen3.8 y GLM-4.7-Flash reemplazan a los comerciales como modelos del estudio).
const SINGLE_ONLY=['local_c','local_d'];
const STAGES=['typecheck','build','development_tests','independent_oracle','architecture'];
const VISIBLE=new Set(STAGES.slice(0,3));
const clone=value=>structuredClone(value);
const MODES={
  simulation:{artifact:'runner_simulation',accepted:'SIMULATED_ACCEPTED',blocked:'SIMULATED_BLOCKED'},
  rehearsal:{artifact:'pipeline_rehearsal',accepted:'ACCEPTED',blocked:'BLOCKED'},
  experimental:{artifact:'corpus_generation',accepted:'ACCEPTED',blocked:'BLOCKED'}
};
const MODEL_OUTPUT_ERRORS=new Set(['INVALID_ACTION_JSON','INVALID_ACTION','MODEL_REFUSAL','INCOMPLETE_RESPONSE']);
const CONTEXT_ERRORS=new Set(['CONTEXT_CORE_TOO_LARGE','CONTEXT_WINDOW_TOO_SMALL']);
const timeoutError=()=>Object.assign(new Error('Límite temporal del intento'),{code:'ATTEMPT_TIMEOUT'});
// Desde el 2026-10-07 el límite del intento (policy.timeout_seconds) mide solo el trabajo del modelo: sus respuestas y
// sus acciones, incluidos sus run_checks. La evaluación del pipeline tras deliver (etapas, snapshot y commit) no lo
// consume: cada operación tiene su propio límite, porque su duración depende del repositorio y no del modelo.
const PIPELINE_STEP_MS=30*60000;

function validate(options) {
  const p=options.policy;
  // simulation: ensayo guionado del motor. rehearsal: contenedores y evaluación reales con adaptador instrumental.
  // experimental: generación real; exige preflight sin bloqueos, calculado por quien invoca (runner/preflight.mjs).
  if(!MODES[options.mode]) throw new Error('Modo desconocido');
  if(options.mode==='experimental'&&(!Array.isArray(options.preflightBlockers)||options.preflightBlockers.length)) throw new Error('Generación experimental bloqueada por preflight');
  if(!p || p.max_attempts!==3 || p.max_agent_cycles!==25 || p.max_provider_assignments!==5 || !isDeepStrictEqual(p.provider_ring,RING) || p.timeout_seconds?.api!==1800 || p.timeout_seconds?.local!==3600 || p.oracle_visible!==false || p.oracle_failure!=='immediate_reassignment_no_feedback' || p.repair_base!=='own_previous_attempt' || p.reassignment_base!=='previous_validated_reference_or_scaffold') throw new Error('Política incompatible');
  if(!(options.singleProvider===true?[...RING,...SINGLE_ONLY]:RING).includes(options.initialProvider) || !(options.mode==='simulation'?['V0']:['V0','V1','V2','V3','V4','V5']).includes(options.packet?.version)) throw new Error('Proveedor o versión no disponible');
  if(options.simulationTimeoutMs!==undefined && options.mode!=='simulation') throw new Error('Timeout reducido solo en simulación');
  // singleProvider (banco de prueba): solo la primera asignación, sin reasignar; nunca en generación experimental.
  if(options.singleProvider!==undefined && (options.singleProvider!==true || options.mode!=='rehearsal')) throw new Error('singleProvider solo en ensayo');
  if(options.simulationTimeoutMs!==undefined && (!Number.isInteger(options.simulationTimeoutMs)||options.simulationTimeoutMs<1||options.simulationTimeoutMs>1800000)) throw new Error('Timeout simulado inválido');
  for(const [object,method] of [[options.adapter,'next'],[options.workspaces,'open'],[options.evaluator,'check']]) if(typeof object?.[method]!=='function') throw new Error(`Falta interfaz ${method}`);
}

// Coordinador de confianza: adaptadores y evaluador nunca se ejecutan dentro del modelo.
// Solo el modo experimental puede producir referencias del corpus, y únicamente con preflight despejado.
export async function runTask(options) {
  validate(options);
  const {adapter,workspaces,evaluator,emit=()=>{}}=options;
  const packet=clone(options.packet), policy=clone(options.policy);
  const mode=MODES[options.mode];
  const result={artifact_type:mode.artifact,mode:options.mode,version:packet.version,status:mode.blocked,attempts:[],events:[]};
  const record=(type,data={})=>{
    const event={sequence:result.events.length+1,type,...clone(data)};
    emit(clone(event));result.events.push(event);
  };
  const start=RING.indexOf(options.initialProvider);
  let stop=false;
  const assignments=options.singleProvider?1:5;
  for(let assignment=0;assignment<assignments&&!stop;assignment++) {
    const provider=options.singleProvider?options.initialProvider:RING[(start+assignment)%5];
    let workspace;
    try {
      workspace=await workspaces.open();
      record('assignment',{provider,assignment:assignment+1});
      const messages=[];
      // Protocolo 1.1: vista inicial del workspace como primer mensaje visible (no en simulación guionada).
      if(options.mode!=='simulation') {
        const overview=await workspaceOverview(workspace,{timeout:60000}).catch(()=>null);
        if(overview) {messages.push({role:'user',content:{source:'workspace',overview}});record('workspace_overview',{provider,files:overview.files.length,contents:Object.keys(overview.contents).length});}
      }
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
        // Operaciones del pipeline tras la entrega: límite propio por operación, fuera del presupuesto del modelo.
        const pipelineLimit=options.simulationTimeoutMs??PIPELINE_STEP_MS;
        const pipelineBounded=async operation=>{
          const step=new AbortController();
          let timer;
          try {
            return await Promise.race([
              Promise.resolve().then(()=>operation({signal:step.signal,timeout:pipelineLimit})),
              new Promise((_,reject)=>{timer=setTimeout(()=>{step.abort();reject(timeoutError());},pipelineLimit);})
            ]);
          } finally {clearTimeout(timer);}
        };
        const row={provider,assignment:assignment+1,attempt,cycles:0,outcome:'REASSIGN',reason:null,validation:{},snapshot:null,base_commit:workspace.initialization?.baseline_commit??workspace.base_commit??null,candidate_commit:null,started_at:new Date().toISOString()};
        result.attempts.push(row);
        record('attempt_started',{provider,attempt,packet,messages});
        try {
          let delivered=false;
          const recent=[];
          for(let cycle=1;cycle<=25;cycle++) {
            row.cycles=cycle;
            let response;
            try {response=await bounded(opts=>adapter.next(clone({provider,attempt,cycle,packet,messages}),opts));}
            catch(error) {
              // Salida inválida del modelo: consume el ciclo y se informa visiblemente; no es infraestructura.
              if(MODEL_OUTPUT_ERRORS.has(error.code)) {
                record('model_output_error',{provider,attempt,cycle,code:error.code});
                messages.push({role:'user',content:{source:'runner',feedback:`Respuesta inválida (${error.code}). Devuelve exactamente un objeto JSON con las claves type, path, content, find, replace y argv según el contrato de respuesta (campos no usados: "" o []).`,attempt}});
                continue;
              }
              throw error;
            }
            if(!response || !ACTION_TYPES.includes(response.type) || JSON.stringify(response).length>400000) throw new Error('Respuesta de adaptador inválida');
            record('response',{provider,attempt,cycle,response});
            messages.push({role:'assistant',content:clone(response)});
            if(response.type==='deliver') {delivered=true;break;}
            if(response.type==='technical_failure') {row.reason='TECHNICAL_FAILURE';break;}
            if(response.type==='tool'&&(!Array.isArray(response.argv)||!response.argv.length||response.argv.length>128||response.argv.some(a=>typeof a!=='string'||a.includes('\0')||a.length>16384))) throw new Error('Tool argv inválido');
            const output=await bounded(opts=>performAction(workspace,response,opts));
            if(output?.status==='TIMEOUT') {controller.abort();throw timeoutError();}
            if(!output||!['PASS','FAIL','INFRA_ERROR'].includes(output.status)||typeof output.output!=='string') throw new Error('Resultado de herramienta inválido');
            if(output.status==='INFRA_ERROR') throw new Error('Infraestructura de herramienta');
            const visible={status:output.status,output:output.output.slice(0,65536)};
            messages.push({role:'tool',content:visible});record('tool_result',{provider,attempt,cycle,...visible});
            // Detección de bucles: la misma acción repetida loop_threshold veces seguidas recibe un aviso visible.
            recent.push(actionKey(response));
            if(recent.length>=PROTOCOL_CONFIG.loop_threshold&&recent.slice(-PROTOCOL_CONFIG.loop_threshold).every(k=>k===recent.at(-1))) {
              record('loop_detected',{provider,attempt,cycle,action_type:response.type});
              messages.push({role:'user',content:{source:'runner',feedback:`Has repetido la misma acción ${PROTOCOL_CONFIG.loop_threshold} veces sin progreso. Revisa el historial, inspecciona los archivos (read_file/list_files) y cambia de estrategia: modifica el código y ejecuta run_checks.`,attempt}});
              recent.length=0;
            }
          }
          if(delivered) {
            for(const stage of STAGES) {
              const check=await pipelineBounded(opts=>evaluator.check(stage,workspace,opts));
              if(check?.status==='TIMEOUT') throw timeoutError();
              if(!check||!['PASS','FAIL','INFRA_ERROR','NOT_APPLICABLE'].includes(check.status)) throw new Error('Evaluación inválida');
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
            // NOT_APPLICABLE: etapa sin comprobación definida para la familia (p. ej. build en el estrato semi-real).
            if(STAGES.every(s=>['PASS','NOT_APPLICABLE'].includes(row.validation[s]))&&STAGES.some(s=>row.validation[s]==='PASS')) row.outcome=mode.accepted;
          } else {row.reason??='CYCLE_LIMIT';}
          // Captura fuera del contexto del agente; preserva también los fallos.
          row.snapshot=await pipelineBounded(opts=>workspace.snapshot(opts));
          if(typeof row.snapshot!=='string') throw new Error('Snapshot inválido');
          // Referencia aceptada: commit determinista del pipeline dentro del workspace, antes de cerrarlo.
          if(row.outcome===mode.accepted&&options.mode!=='simulation'&&typeof workspace.commit==='function') {
            row.candidate_commit=await pipelineBounded(opts=>workspace.commit(`reference: ${packet.version}`,opts));
          }
          if(row.outcome===mode.accepted) {result.status=mode.accepted;stop=true;}
        } catch(error) {
          // Timeout y ventana de contexto insuficiente son límites del intento/modelo: reasignan. Lo demás es infraestructura.
          row.reason=error.code==='ATTEMPT_TIMEOUT'?'TIMEOUT':CONTEXT_ERRORS.has(error.code)?'CONTEXT_LIMIT':'INFRA_ERROR';
          row.outcome=row.reason==='INFRA_ERROR'?'INFRA_ERROR':'REASSIGN';
          if(row.outcome==='INFRA_ERROR') row.error_code=/^[A-Z0-9_]+$/.test(error.code??'')?error.code:null;
          if(row.outcome==='INFRA_ERROR') {result.status='INFRA_ERROR';stop=true;}
        } finally {
          controller.abort();row.duration_ms=Date.now()-started;row.finished_at=new Date().toISOString();
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
