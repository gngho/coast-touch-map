import {request} from '../sync.js';

// Only the command endpoint deduplicates this event ID before checking revisions.
// Never regenerate the ID/baseGeneration when a response might have been lost.
export async function requestCommand(path,options,{isCurrent=()=>true,onRetry=()=>{},
  timeoutMs=2500,budgetMs=8000,send=request,now=()=>performance.now(),wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  const data=structuredClone(options.data),deadline=now()+budgetMs;
  for(let attempt=1;attempt<=3;attempt++){
    if(!isCurrent())throw Object.assign(new Error('취소된 재생 명령입니다.'),{code:'COMMAND_CANCELLED'});
    try{return await send(path,{...options,data,timeoutMs:Math.max(1,Math.min(timeoutMs,deadline-now()))});}
    catch(error){
      Object.assign(error,{action:data.action,commandId:data.id,attempts:attempt});
      const transient=['REQUEST_TIMEOUT','CONNECTION_ERROR','SERVER_UNAVAILABLE'].includes(error.code);
      if(!transient||attempt===3||now()+250>=deadline||!isCurrent())throw error;
      onRetry({action:data.action,commandId:data.id,attempt,code:error.code,status:error.status,ray:error.ray,elapsedMs:error.elapsedMs});
      await wait(250);
    }
  }
}
