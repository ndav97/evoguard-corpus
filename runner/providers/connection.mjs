import {providerError} from './http.mjs';
const direct={
  openai:{base_url:'https://api.openai.com/v1',credential_env:['OPENAI_API_KEY']},
  anthropic:{base_url:'https://api.anthropic.com/v1',credential_env:['ANTHROPIC_API_KEY']},
  google:{base_url:'https://generativelanguage.googleapis.com/v1beta',credential_env:['GEMINI_API_KEY','GOOGLE_API_KEY']},
  local_a:{base_url:'http://127.0.0.1:11434',credential_env:[]},
  local_b:{base_url:'http://127.0.0.1:11434',credential_env:[]}
};
export function connectionFor(provider,config) {
  if(!Object.hasOwn(direct,provider))throw providerError('CONNECTION_INVALID');
  const access=config.access_provider??(provider.startsWith('local_')?'ollama':provider);
  if(access==='synterolink') {
    const expectedBase=provider==='google'?'https://api.synterolink.com/v1beta':'https://api.synterolink.com/v1';
    if(!['openai','anthropic','google'].includes(provider)||config.transport!==provider||config.base_url!==expectedBase)throw providerError('CONNECTION_UNCONFIRMED');
    return {access_provider:access,base_url:config.base_url,credential_env:[`SYNTEROLINK_${provider.toUpperCase()}_API_KEY`,'SYNTEROLINK_API_KEY']};
  }
  const expected=provider.startsWith('local_')?'ollama':provider;
  if(access!==expected||(config.base_url!==undefined&&config.base_url!==direct[provider].base_url))throw providerError('CONNECTION_INVALID');
  return {access_provider:access,...direct[provider]};
}
export function credentialsFromEnv(models,env) {
  return Object.fromEntries(Object.entries(models).map(([provider,config])=>{
    const connection=connectionFor(provider,config);
    return [provider,connection.credential_env.map(name=>env[name]).find(value=>typeof value==='string'&&value.trim()&&!value.includes('*'))];
  }));
}
