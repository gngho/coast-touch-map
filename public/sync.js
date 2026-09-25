export function load(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
export function save(key,value){localStorage.setItem(key,JSON.stringify(value));}
export async function request(path,{auth,method='GET',data,role='admin'}={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),2500);
  try{
    const response=await fetch(path,{method,cache:'no-store',signal:controller.signal,headers:{...(method==='POST'?{'Content-Type':'application/json'}:{}),...(auth?{'X-Coast-Token':auth.token,'X-Coast-Role':role}:{})},...(data?{body:JSON.stringify(data)}:{})});
    const result=await response.json();if(!response.ok){const error=new Error(result.error||'요청에 실패했습니다.');error.status=response.status;throw error;}return result;
  }finally{clearTimeout(timer);}
}
export const endpoint=(auth,operation)=>`/api/sessions/${auth.id}/${operation}`;
export class Outbox{
  constructor(){this.db=new Promise((resolve,reject)=>{const r=indexedDB.open('coast-events-v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('events',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async operation(mode,fn){const db=await this.db;return new Promise((resolve,reject)=>{const tx=db.transaction('events',mode);const r=fn(tx.objectStore('events'));let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('로그 저장 실패'));});}
  put(event){return this.operation('readwrite',s=>s.put(event));}
  remove(id){return this.operation('readwrite',s=>s.delete(id));}
  all(){return this.operation('readonly',s=>s.getAll()).then(rows=>rows.sort((a,b)=>a.order-b.order));}
}
