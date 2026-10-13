// Allow brief WAN jitter; a sustained loss still stops the stimulus at 10 s.
export const WARN_MS=5000, LOST_MS=10000;
export function connectionHealth(snapshot,lastSuccess,now){
  const localAgeMs=lastSuccess==null?Infinity:Math.max(0,now-lastSuccess);
  const peerAgeMs=snapshot?.deviceAgeMs==null?(snapshot?.deviceConnected?0:Infinity):snapshot.deviceAgeMs;
  const ageMs=Math.max(localAgeMs,peerAgeMs+localAgeMs);
  return {ready:!!snapshot?.paired&&ageMs<WARN_MS,alive:!!snapshot?.paired&&ageMs<LOST_MS,localAgeMs,peerAgeMs,ageMs};
}
// Event upload and heartbeat each have their own single-flight loop.
export function singleFlight(task){let busy=false;return async(...args)=>{if(busy)return;busy=true;try{return await task(...args);}finally{busy=false;}};}
