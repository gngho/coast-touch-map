import {request} from '../sync.js';
export const retryableRead=error=>['REQUEST_TIMEOUT','CONNECTION_ERROR','SERVER_UNAVAILABLE'].includes(error.code);
// Read-only retries; a replaced login or cleared plan must not publish old data.
export async function requestSchedule(path,{auth,isCurrent=()=>true,onRetry=()=>{},send=request,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  for(let attempt=1;attempt<=3;attempt++){
    if(!isCurrent())throw Object.assign(Error('배정표 조회가 취소되었습니다.'),{code:'READ_CANCELLED'});
    try{return await send(path,{auth,timeoutMs:4500});}
    catch(error){
      if(!retryableRead(error)||attempt===3||!isCurrent())throw error;
      onRetry({...error,attempt});await wait(250);
    }
  }
}
