import {config} from '../../server/src/config';
async function main(){
 const r=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error('Model catalog HTTP '+r.status);
 const body:any=await r.json();const exact=body.data?.find((m:any)=>m.id===config.llmModel);
 const describe=(m:any)=>({id:m.id,input:m.architecture?.input_modalities,parameters:m.supported_parameters,pricing:m.pricing});
 console.log(JSON.stringify({requested:config.llmModel,listed:!!exact,model:exact?describe(exact):null,freeVisionCandidates:body.data?.filter((m:any)=>m.id.endsWith(':free')&&m.architecture?.input_modalities?.includes('image')).map(describe)},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
