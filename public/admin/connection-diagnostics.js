const key='coast.connection-diagnostics.v1';
export function connectionDetail(health,snapshot,lastError){
  const seconds=ms=>Number.isFinite(ms)?`${(ms/1000).toFixed(1)}초`:'미확인';
  return `PC↔서버 마지막 응답 ${seconds(health.localAgeMs)} 전 · iPad↔서버 마지막 접속 ${seconds(health.peerAgeMs+health.localAgeMs)} 전`+
    (Number.isFinite(snapshot?._timing?.roundTrip)?` · PC 왕복 ${Math.round(snapshot._timing.roundTrip)}ms`:'')+
    (lastError?` · 최근 오류 ${lastError.code||'HTTP_ERROR'}${lastError.status?' / HTTP '+lastError.status:''}`:'');
}
export function createDiagnostics(storage){
  let entries=[];
  try{const saved=JSON.parse(storage.getItem(key));if(Array.isArray(saved))entries=saved.slice(-100);}catch{}
  return {
    record(kind,error={},health={}){
      // Never persist authentication, participant IDs or request URLs.
      const entry={time:new Date().toISOString(),kind};
      for(const field of ['code','status','ray','elapsedMs','action','attempt','attempts'])if(error[field]!=null)entry[field]=error[field];
      for(const field of ['localAgeMs','peerAgeMs'])if(Number.isFinite(health[field]))entry[field]=Math.round(health[field]);
      entries.push(entry);entries=entries.slice(-100);
      try{storage.setItem(key,JSON.stringify(entries));}catch{}
    },
    export:()=>({exportedAt:new Date().toISOString(),scope:'PC connection diagnostics; not the experiment event log',entries:[...entries]})
  };
}
