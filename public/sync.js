export function load(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
export function save(key,value){localStorage.setItem(key,JSON.stringify(value));}
export async function request(path,{auth,method='GET',data,role='admin',timeoutMs=2500}={}){
  const sentAt=performance.now();
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  let responseStatus,ray;
  try{
    const response=await fetch(path,{method,cache:'no-store',signal:controller.signal,headers:{...(method==='POST'?{'Content-Type':'application/json'}:{}),...(auth?{'X-Coast-Token':auth.token,'X-Coast-Role':role}:{})},...(data?{body:JSON.stringify(data)}:{})});
    responseStatus=response.status;ray=response.headers.get('cf-ray');
    if(response.status===401||(response.redirected&&/cloudflareaccess\.com|\/cdn-cgi\/access\//.test(response.url))){
      const error=new Error('로그인이 만료되었습니다. 시행을 중단한 뒤 이 화면에서 다시 로그인해 주세요.');
      error.code='AUTHENTICATION_REQUIRED';error.status=401;throw error;
    }
    let result;
    try{result=await response.json();}catch{
      const error=new Error('서버 응답을 읽지 못했습니다. 연결 상태를 다시 확인합니다.');
      error.status=response.status;if(response.status>=500)error.code='SERVER_UNAVAILABLE';throw error;
    }
    if(!response.ok){const error=new Error(result.error||'요청에 실패했습니다.');error.status=response.status;if(response.status>=500)error.code='SERVER_UNAVAILABLE';throw error;}
    if(Number.isFinite(result?.serverTime)){const receivedAt=performance.now();result._timing={receivedAt,roundTrip:receivedAt-sentAt};}return result;
  }catch(error){
    if(controller.signal.aborted){
      const timeout=new Error('서버 응답이 지연되어 요청 결과를 확인하지 못했습니다. 연결 상태를 확인해 주세요.');
      timeout.code='REQUEST_TIMEOUT';timeout.status=responseStatus;timeout.ray=ray;timeout.elapsedMs=performance.now()-sentAt;throw timeout;
    }
    if(error instanceof TypeError&&!error.status){
      const connection=new Error('서버에 연결하지 못했습니다. 네트워크 연결을 확인해 주세요.');
      connection.code='CONNECTION_ERROR';connection.elapsedMs=performance.now()-sentAt;throw connection;
    }
    error.elapsedMs=performance.now()-sentAt;error.ray=ray;throw error;
  }finally{clearTimeout(timer);}
}
export const endpoint=(auth,operation)=>`/api/sessions/${auth.id}/${operation}`;
export class Outbox{
  constructor(name='coast-events-v2'){this.db=new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('events',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async operation(mode,fn){const db=await this.db;return new Promise((resolve,reject)=>{const tx=db.transaction('events',mode);const r=fn(tx.objectStore('events'));let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('로그 저장 실패'));});}
  put(event){return this.operation('readwrite',s=>s.put(event));}
  remove(id){return this.operation('readwrite',s=>s.delete(id));}
  all(){return this.operation('readonly',s=>s.getAll()).then(rows=>rows.sort((a,b)=>a.order-b.order));}
}
