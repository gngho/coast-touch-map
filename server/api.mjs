import {VERSION,Problem,requireThat,initialState,transition} from './domain.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const rowState=r=>JSON.parse(r.state);
const query=(db,sql,...args)=>db.prepare(sql).bind(...args);
const first=(db,sql,...args)=>query(db,sql,...args).first();
const now=()=>Date.now();
const wasReset=async(db,id,generation)=>generation<(rowState(await first(db,'SELECT * FROM sessions WHERE id=?',id)).resetGeneration||0);
function view(row){const s=rowState(row);return {id:row.id,state:s,version:VERSION,serverTime:now(),paired:!!row.device_hash,deviceConnected:!!row.device_hash&&now()-row.device_seen<3000,adminConnected:now()-row.admin_seen<3000,applied:row.applied_generation===s.generation&&(row.applied_trial||null)===(s.trial?.id||null),appliedGeneration:row.applied_generation,pendingEvents:row.pending_events};}
async function body(request){requireThat(Number(request.headers.get('content-length')||0)<32768,'요청이 너무 큽니다.',413);const text=await request.text();requireThat(text.length<32768,'요청이 너무 큽니다.',413);try{return JSON.parse(text);}catch{throw new Problem('요청 형식이 올바르지 않습니다.');}}
async function authorized(db,id,user,secret,role){
  const row=await first(db,'SELECT * FROM sessions WHERE id=? AND owner=?',id,user);
  requireThat(row&&secret&&await hash(secret)===row[role==='admin'?'admin_hash':'device_hash'],'세션 접근 권한이 없습니다.',403);return row;
}
async function commit(db,row,eventId,action,data,actor,extra={}){
  requireThat(validId(eventId),'이벤트 ID가 올바르지 않습니다.');
  for(let attempt=0;attempt<5;attempt++){
    if(await first(db,'SELECT id FROM events WHERE id=? AND session_id=?',eventId,row.id))return first(db,'SELECT * FROM sessions WHERE id=?',row.id);
    const before=rowState(row),stamp=now();
    if(action==='reset_records'&&before.lastReset?.id===eventId)return row;
    if(actor==='device'&&action==='touch'&&Number.isInteger(extra.generation)&&extra.generation<(before.resetGeneration||0))return row;
    if(actor==='admin'){
      requireThat(data.baseGeneration===before.generation,'다른 변경이 반영되었습니다. 현재 상태를 확인한 뒤 다시 눌러 주세요.',409);
      if(!['abort','note','unpair','reset_records'].includes(action))requireThat(row.device_hash&&stamp-row.device_seen<3000,'iPad 연결을 확인해 주세요.',409);
    }
    const {state,event}=transition(before,action,data,{now:stamp,newId:crypto.randomUUID(),applied:row.applied_generation===before.generation&&row.applied_trial===before.trial?.id});
    const trial=state.trial;
    if(action==='reset_records'){
      // One transaction: a failed revision check must never delete any records.
      const marker=crypto.randomUUID();
      const result=await db.batch([
        query(db,'UPDATE sessions SET state=?,revision=revision+1,mutation=?,applied_generation=-1,applied_trial=NULL,pending_events=0 WHERE id=? AND revision=?',JSON.stringify(state),marker,row.id,row.revision),
        query(db,'DELETE FROM events WHERE session_id=? AND EXISTS (SELECT 1 FROM sessions WHERE id=? AND mutation=?)',row.id,row.id,marker),
        query(db,'DELETE FROM trials WHERE session_id=? AND EXISTS (SELECT 1 FROM sessions WHERE id=? AND mutation=?)',row.id,row.id,marker)
      ]);
      if(result[0].meta.changes)return first(db,'SELECT * FROM sessions WHERE id=?',row.id);
      row=await first(db,'SELECT * FROM sessions WHERE id=?',row.id);continue;
    }
    const statements=[query(db,'UPDATE sessions SET state=?,revision=revision+1,mutation=? WHERE id=? AND revision=?',JSON.stringify(state),eventId,row.id,row.revision),
      query(db,'INSERT OR IGNORE INTO events (id,session_id,trial_id,type,actor,server_time,client_time,page_id,generation,payload) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE id=? AND mutation=?)',eventId,row.id,data.trialId||trial?.id||null,event.type,actor,stamp,extra.clientTime||null,extra.pageId||null,state.generation,JSON.stringify(event.payload),row.id,eventId)];
    if(trial)statements.push(query(db,`INSERT INTO trials (id,session_id,number,participant,relationship,intervention,scenario,app_version,status,prepared_at,started_at,ended_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE id=? AND mutation=?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,started_at=excluded.started_at,ended_at=excluded.ended_at`,trial.id,row.id,trial.number,trial.participant,trial.relationship,trial.intervention,trial.scenario,trial.appVersion,trial.status,trial.preparedAt,trial.startedAt,trial.endedAt,row.id,eventId));
    const result=await db.batch(statements);
    if(result[0].meta.changes)return first(db,'SELECT * FROM sessions WHERE id=?',row.id);
    row=await first(db,'SELECT * FROM sessions WHERE id=?',row.id);
  }
  throw new Problem('동시 조작을 처리 중입니다. 다시 시도해 주세요.',409);
}
function csv(rows,columns){const cell=v=>{let t=String(v??'');if(/^[=+@-]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"';};return '\uFEFF'+[columns,...rows.map(r=>columns.map(k=>typeof r[k]==='object'?JSON.stringify(r[k]):r[k]))].map(r=>r.map(cell).join(',')).join('\r\n');}
export async function api(request,env){
  try{
    const url=new URL(request.url),db=env.DB,user=request.headers.get('oai-authenticated-user-id');
    requireThat(user,'사이트에 로그인해 주세요.',401);requireThat(db,'저장소를 사용할 수 없습니다.',503);
    requireThat(['GET','POST'].includes(request.method),'지원하지 않는 요청입니다.',405);
    if(request.method==='POST')requireThat(request.headers.get('origin')===url.origin,'동일한 사이트에서 요청해 주세요.',403);
    const path=url.pathname,post=request.method==='POST',data=post?await body(request):{},secret=request.headers.get('x-coast-token');
    if(path==='/api/session'&&post){
      const old=await first(db,'SELECT * FROM sessions WHERE owner=?',user);
      if(old){requireThat(secret&&await hash(secret)===old.admin_hash,'기존 제어 세션이 있습니다. 세션 복구를 사용해 주세요.',409);return json(view(old));}
      const id=crypto.randomUUID(),adminToken=token(),stamp=now();
      await query(db,'INSERT INTO sessions (id,owner,admin_hash,state,created_at,admin_seen) VALUES (?,?,?,?,?,?)',id,user,await hash(adminToken),JSON.stringify(initialState()),stamp,stamp).run();
      return json({...view(await first(db,'SELECT * FROM sessions WHERE id=?',id)),adminToken});
    }
    if(path==='/api/recover'&&post){
      const row=await first(db,'SELECT * FROM sessions WHERE owner=?',user);requireThat(row,'복구할 세션이 없습니다.',404);
      const adminToken=token();
      await query(db,'UPDATE sessions SET admin_hash=?,admin_seen=? WHERE id=?',await hash(adminToken),now(),row.id).run();
      const updated=await commit(db,row,crypto.randomUUID(),'suspend',{reason:'admin_recovery'},'system');
      return json({...view(updated),adminToken});
    }
    if(path==='/api/pair'&&post){
      requireThat(typeof data.code==='string'&&/^\d{6}$/.test(data.code)&&validId(data.pageId),'연결 코드를 확인해 주세요.');
      const row=await first(db,'SELECT * FROM sessions WHERE owner=? AND code_hash=? AND code_expires>? AND device_hash IS NULL',user,await hash(data.code),now());
      requireThat(row,'코드가 만료되었거나 이미 연결되었습니다.',409);
      const deviceToken=token();
      const result=await query(db,'UPDATE sessions SET device_hash=?,page_id=?,device_seen=?,code_hash=NULL,code_expires=NULL WHERE id=? AND device_hash IS NULL',await hash(deviceToken),data.pageId,now(),row.id).run();
      requireThat(result.meta.changes===1,'이미 다른 iPad가 연결되었습니다.',409);
      return json({...view(await first(db,'SELECT * FROM sessions WHERE id=?',row.id)),deviceToken});
    }
    const match=path.match(/^\/api\/sessions\/([\w-]+)\/(state|code|command|event|audio-event|rejoin|export)$/);requireThat(match,'요청한 기능이 없습니다.',404);
    const [,id,operation]=match,role=request.headers.get('x-coast-role');requireThat(['admin','device'].includes(role),'접근 역할을 확인해 주세요.',403);
    let row=await authorized(db,id,user,secret,role);
    if(operation==='state'&&!post){
      const stamp=now();
      if(role==='device'){
        requireThat(url.searchParams.get('pageId')===row.page_id,'다른 화면이 연결되었습니다. 다시 연결해 주세요.',409);
        const count=Math.max(0,Math.min(10000,Number(url.searchParams.get('pending'))||0));
        await query(db,'UPDATE sessions SET device_seen=?,pending_events=? WHERE id=?',stamp,count,id).run();row.device_seen=stamp;row.pending_events=count;
      }else{await query(db,'UPDATE sessions SET admin_seen=? WHERE id=?',stamp,id).run();row.admin_seen=stamp;}
      const response=view(row);
      if(role==='admin')response.recentEvents=(await query(db,'SELECT type,server_time,payload FROM events WHERE session_id=? ORDER BY server_time DESC,id DESC LIMIT 12',id).all()).results;
      return json(response);
    }
    if(operation==='code'&&post){
      requireThat(role==='admin','진행자만 코드를 생성할 수 있습니다.',403);
      requireThat(!row.device_hash,'이미 연결된 iPad가 있습니다.',409);
      const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'),expires=now()+600000;
      await query(db,'UPDATE sessions SET code_hash=?,code_expires=? WHERE id=?',await hash(code),expires,id).run();return json({code,expires});
    }
    if(operation==='command'&&post){
      requireThat(role==='admin','진행자만 화면을 제어할 수 있습니다.',403);
      requireThat(['prepare','start','end','abort','setup','show_cue','set_icon','resume','note','unpair','begin_audio','reset_records'].includes(data.action),'잘못된 조작입니다.');
      row=await commit(db,row,data.id,data.action,data,'admin');
      if(data.action==='unpair'){
        await query(db,'UPDATE sessions SET device_hash=NULL,page_id=NULL,device_seen=0,applied_generation=-1 WHERE id=?',id).run();
        row=await first(db,'SELECT * FROM sessions WHERE id=?',id);
      }
      return json({...view(row),...(data.action==='reset_records'?{recentEvents:[]}: {})});
    }
    if(operation==='audio-event'&&post){
      requireThat(role==='admin','진행자만 재생 기록을 전송할 수 있습니다.',403);
      requireThat(validId(data.id)&&validId(data.runId)&&validId(data.pageId),'재생 이벤트를 확인해 주세요.');
      requireThat(['audio_started','audio_ended','operator_confirm','audio_flow_complete','audio_flow_stopped','audio_flow_error'].includes(data.type),'지원하지 않는 재생 이벤트입니다.');
      const run=await first(db,"SELECT trial_id,payload FROM events WHERE id=? AND session_id=? AND type='begin_audio'",data.runId,id);
      if(!run){
        const reset=rowState(await first(db,'SELECT * FROM sessions WHERE id=?',id)).resetGeneration||0;
        // A late stop callback may observe the new generation but belongs to a deleted run.
        if(reset&&((Number.isInteger(data.generation)&&data.generation<reset)||!await first(db,'SELECT id FROM trials WHERE id=? AND session_id=?',data.trialId||'',id)))return json({saved:true,discarded:true});
      }
      requireThat(run&&run.trial_id===data.trialId&&JSON.parse(run.payload).pageId===data.pageId,'다른 시행 또는 화면의 재생 기록입니다.',403);
      requireThat(Number.isFinite(data.monotonicMs)&&data.monotonicMs>=0&&typeof data.clientTime==='string'&&Number.isFinite(Date.parse(data.clientTime)),'재생 시점을 확인해 주세요.');
      const detail=data.detail||{};requireThat(JSON.stringify(detail).length<=3000,'재생 기록이 너무 깁니다.');
      await query(db,"INSERT OR IGNORE INTO events (id,session_id,trial_id,type,actor,server_time,client_time,page_id,generation,payload) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM events WHERE id=? AND session_id=? AND type='begin_audio')",data.id,id,data.trialId,data.type,'admin',now(),data.clientTime.slice(0,40),data.pageId,Number.isInteger(data.generation)?data.generation:0,JSON.stringify({...detail,runId:data.runId,monotonicMs:data.monotonicMs}),data.runId,id).run();
      return json({saved:true});
    }
    if(operation==='rejoin'&&post){
      requireThat(role==='device'&&validId(data.pageId),'iPad 연결 요청을 확인해 주세요.',403);
      requireThat(['reload','connection_gap','visibility'].includes(data.reason),'연결 사유를 확인해 주세요.');
      row=await commit(db,row,data.id,'suspend',{reason:data.reason},'device',{pageId:data.pageId,clientTime:data.clientTime});
      await query(db,'UPDATE sessions SET page_id=?,device_seen=?,applied_generation=-1 WHERE id=?',data.pageId,now(),id).run();return json(view(await first(db,'SELECT * FROM sessions WHERE id=?',id)));
    }
    if(operation==='event'&&post){
      requireThat(role==='device'&&validId(data.id)&&validId(data.pageId),'이벤트를 확인해 주세요.',403);
      requireThat(['applied','cue_displayed','touch','connection_lost','visibility_hidden'].includes(data.type),'지원하지 않는 이벤트입니다.');
      requireThat(Number.isInteger(data.generation)&&data.generation>=0,'화면 버전을 확인해 주세요.');
      const resetGeneration=rowState(await first(db,'SELECT * FROM sessions WHERE id=?',id)).resetGeneration||0;
      if(data.generation<resetGeneration)return json({saved:true,discarded:true});
      if(data.trialId){
        const trial=await first(db,'SELECT id FROM trials WHERE id=? AND session_id=?',data.trialId,id);
        if(!trial&&await wasReset(db,id,data.generation))return json({saved:true,discarded:true});
        requireThat(trial,'다른 시행의 이벤트입니다.',403);
      }
      if(data.type==='touch'){
        requireThat(Number.isFinite(data.reactionMs)&&data.reactionMs>=0&&data.reactionMs<86400000&&validId(data.cueId)&&validId(data.displayEventId),'터치 시점을 확인해 주세요.');
        const display=await first(db,"SELECT * FROM events WHERE id=? AND session_id=? AND trial_id=? AND type='cue_displayed' AND page_id=? AND generation=?",data.displayEventId,id,data.trialId,data.pageId,data.generation);
        if(!display&&await wasReset(db,id,data.generation))return json({saved:true,discarded:true});
        requireThat(display&&JSON.parse(display.payload).cueId===data.cueId,'Cue 표시 기록을 먼저 저장해 주세요.',409);
        // A queued event from an older page is retained but can never change the live state.
        const touchData=data.pageId===row.page_id?data:{...data,generation:-1};
        return json(view(await commit(db,row,data.id,'touch',touchData,'device',data)));
      }
      await query(db,"INSERT OR IGNORE INTO events (id,session_id,trial_id,type,actor,server_time,client_time,page_id,generation,payload) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE id=? AND COALESCE(json_extract(state,'$.resetGeneration'),0)<=?)",data.id,id,data.trialId||null,data.type,'device',now(),String(data.clientTime||'').slice(0,40),data.pageId,data.generation,JSON.stringify({cueId:data.cueId||null,monotonicMs:data.monotonicMs??null}),id,data.generation).run();
      if(data.type==='applied'&&data.pageId===row.page_id){
        await query(db,"UPDATE sessions SET applied_generation=?,applied_trial=? WHERE id=? AND json_extract(state,'$.generation')=? AND COALESCE(json_extract(state,'$.trial.id'),'')=?",data.generation,data.trialId||null,id,data.generation,data.trialId||'').run();
      }
      return json({saved:true});
    }
    if(operation==='export'&&!post){
      requireThat(role==='admin','진행자만 로그를 내보낼 수 있습니다.',403);
      const trials=(await query(db,'SELECT * FROM trials WHERE session_id=? ORDER BY number',id).all()).results;
      const events=(await query(db,'SELECT * FROM events WHERE session_id=? ORDER BY server_time,id',id).all()).results.map(e=>({...e,payload:JSON.parse(e.payload)}));
      const format=url.searchParams.get('format');
      if(format==='json')return json({appVersion:VERSION,exportedAt:new Date().toISOString(),timingNote:'Cue RT is iPad-local display-to-touch. Audio timestamps are PC browser callbacks, not TV acoustic onset. Operator confirmation is not measured participant speech onset. Monotonic clocks are page-local; do not subtract across devices.',trials,events});
      const kind=url.searchParams.get('kind')==='trials'?'trials':'events',rows=kind==='trials'?trials:events;
      const columns=kind==='trials'?['id','number','participant','relationship','intervention','scenario','app_version','status','prepared_at','started_at','ended_at']:['id','trial_id','type','actor','server_time','client_time','page_id','generation','payload'];
      return new Response(csv(rows,columns),{headers:{'Content-Type':'text/csv; charset=utf-8','Cache-Control':'no-store','Content-Disposition':`attachment; filename="coast-${kind}.csv"`}});
    }
    throw new Problem('지원하지 않는 요청입니다.',405);
  }catch(error){if(!(error instanceof Problem))console.error('Coast API failure',error.message);return json({error:error instanceof Problem?error.message:'저장소 응답을 확인하지 못했습니다. 연결 후 다시 시도해 주세요.'},error.status||503);}
}
