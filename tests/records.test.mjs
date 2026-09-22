import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { schemaValidators, validateRecord } from '../runner/validation/corpus.mjs';
const validators = schemaValidators(fileURLToPath(new URL('../', import.meta.url)));
const hash = 'a'.repeat(64);
const commit = 'b'.repeat(40);
const generation = () => ({
  schema_version:'1.0.0',family_id:'F001',version:'V0',artifact_type:'reference_candidate',
  generator:{provider:'openai',model:'test-only-model',temperature:null,seed:null},
  attempt:1,repair_count:0,base_commit:commit,candidate_commit:null,
  prompt_sha256:hash,fixture_sha256:hash,stack_sha256:hash,
  started_at:'2026-09-22T00:00:00Z',finished_at:null,
  tokens:{input:null,output:null},cost_usd:null,cycles:0,duration_seconds:null,
  validation:{build:'NOT_RUN',typecheck:'NOT_RUN',development_tests:'NOT_RUN',independent_oracle:'NOT_RUN',architecture:'NOT_RUN'},
  outcome:'IN_PROGRESS',failure_reason:null,logs_path:'test-only/logs'
});
const run = () => ({
  schema_version:'1.0.0',run_id:'test-only',family_id:'F001',episode_id:'E001',turn_id:'T001',artifact_type:'pi0_evaluation',
  pi0_config_sha256:hash,base_commit:commit,candidate_commit:null,prompt_sha256:hash,fixture_sha256:hash,stack_sha256:hash,
  started_at:'2026-09-22T00:00:00Z',finished_at:null,previous_active_requirements:['R001','R002'],
  outcomes:[{requirement_id:'R001',previous_result:'PASS',current_result:'FAIL',regression:true},
    {requirement_id:'R002',previous_result:'PASS',current_result:'PASS',regression:false},
    {requirement_id:'R003',previous_result:'NOT_RUN',current_result:'FAIL',regression:null}],
  infrastructure_error:null,logs_path:'test-only/logs'
});

test('registro sintético en memoria cumple generation schema',()=>assert.deepEqual(validateRecord(generation(),'generation',validators),[]));
test('commits solo aceptan hashes completos de 40 o 64 caracteres',()=>{
  for (const [kind, factory] of [['generation',generation],['run',run]]) {
    const r=factory(); r.base_commit='b'.repeat(41);
    assert.notDeepEqual(validateRecord(r,kind,validators),[]);
    r.base_commit='b'.repeat(64);
    assert.deepEqual(validateRecord(r,kind,validators),[]);
  }
});
test('no acepta referencia sin pruebas y commit',()=>{
  const r=generation(); r.outcome='ACCEPTED';
  assert.match(validateRecord(r,'generation',validators).join(),/ACCEPTED/);
});
test('fallo del oráculo no habilita reparación',()=>{
  const r=generation(); r.validation.independent_oracle='FAIL'; r.outcome='REPAIR';
  assert.match(validateRecord(r,'generation',validators).join(),/REASSIGN/);
});
test('no permite cuarta entrega ni reparación después de la tercera',()=>{
  const r=generation(); r.attempt=4;
  assert.notDeepEqual(validateRecord(r,'generation',validators),[]);
  r.attempt=3; r.repair_count=2; r.outcome='REPAIR';
  assert.match(validateRecord(r,'generation',validators).join(),/reparación/);
});
test('distingue regresión previa de fallo en requisito nuevo',()=>assert.deepEqual(validateRecord(run(),'run',validators),[]));
test('rechaza nuevo requisito etiquetado como regresión',()=>{
  const r=run(); r.outcomes[2].regression=true;
  assert.match(validateRecord(r,'run',validators).join(),/regresión/);
});
test('fallo de infraestructura no produce etiquetas funcionales',()=>{
  const r=run(); r.infrastructure_error='test-only container unavailable';
  assert.match(validateRecord(r,'run',validators).join(),/regresión/);
  r.outcomes.forEach(o=>o.regression=null);
  assert.deepEqual(validateRecord(r,'run',validators),[]);
});
test('rechaza omisiones y duplicados de resultados',()=>{
  const r=run(); r.outcomes.pop(); r.outcomes.pop();
  assert.match(validateRecord(r,'run',validators).join(),/faltan/);
  r.outcomes.push({...r.outcomes[0],current_result:'PASS',regression:false});
  assert.match(validateRecord(r,'run',validators).join(),/repetido/);
});
