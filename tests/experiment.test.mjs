import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../server/api.mjs';
import {localDatabase} from '../server/dev-db.mjs';
import {RELATIONSHIPS,INTERVENTIONS} from '../server/domain.mjs';
const uid=()=>crypto.randomUUID();
async function fixture(){
  const DB=localDatabase();let admin,device,pageId=uid(),state;
  async function call(path,{data,auth,role='admin',user='owner',origin='https://coast.test'}={}){
    const headers={'origin':origin};if(user)headers['oai-authenticated-user-id']=user;if(auth){headers['x-coast-token']=auth.token;headers['x-coast-role']=role;}
    const response=await api(new Request('https://coast.test'+path,{method:data?'POST':'GET',headers,...(data?{body:JSON.stringify(data)}:{})}),{DB});
    const result=await response.json();return {status:response.status,result};
  }
  const created=await call('/api/session',{data:{}});assert.equal(created.status,200);admin={id:created.result.id,token:created.result.adminToken};state=created.result.state;
  const path=op=>`/api/sessions/${admin.id}/${op}`;
  const code=await call(path('code'),{auth:admin,data:{}});
  const paired=await call('/api/pair',{data:{code:code.result.code,pageId}});assert.equal(paired.status,200);device={id:admin.id,token:paired.result.deviceToken};
  async function refresh(){const r=await call(path('state'),{auth:admin});state=r.result.state;return r.result;}
  async function command(action,data={},eventId=uid()){const r=await call(path('command'),{auth:admin,data:{id:eventId,action,baseGeneration:state.generation,...data}});if(r.status===200)state=r.result.state;return r;}
  async function event(type,extra={}){return call(path('event'),{auth:device,role:'device',data:{id:uid(),type,pageId,clientTime:new Date().toISOString(),generation:state.generation,trialId:state.trial?.id||null,...extra}});}
  const apply=()=>event('applied');
  async function start(relationship='friend',intervention='cue'){
    assert.equal((await command('prepare',{participant:'P001',scenario:'restaurant',relationship,intervention})).status,200);
    await apply();assert.equal((await command('start')).status,200);await apply();
  }
  return {DB,admin,device,get pageId(){return pageId;},setPageId(value){pageId=value;},path,call,command,event,apply,start,refresh,get state(){return state;},close:()=>DB.close()};
}
test('12 conditions preserve their metadata and only Cue can display an icon',async()=>{
  const f=await fixture();try{
    for(const relationship of RELATIONSHIPS)for(const intervention of INTERVENTIONS){
      await f.start(relationship,intervention);assert.equal(f.state.icon,'hidden');
      const result=await f.command('show_cue');assert.equal(result.status,intervention==='cue'?200:409);
      await f.command('end');assert.equal(f.state.icon,'hidden');
    }
    const exported=await f.call(f.path('export?format=json'),{auth:f.admin});
    assert.equal(exported.result.trials.length,12);assert.deepEqual(exported.result.trials.map(t=>t.number),Array.from({length:12},(_,i)=>i+1));
    assert.equal(exported.result.events.filter(e=>e.type==='show_cue').length,3);
  }finally{f.close();}
});
test('start requires display acknowledgement; double touch and command retries are idempotent',async()=>{
  const f=await fixture();try{
    await f.command('prepare',{participant:'P001',scenario:'',relationship:'friend',intervention:'cue'});
    assert.equal((await f.command('start')).status,409);await f.apply();await f.command('start');
    const commandId=uid(),generation=f.state.generation;
    const first=await f.command('show_cue',{},commandId);assert.equal(first.status,200);
    const retry=await f.command('show_cue',{baseGeneration:generation},commandId);assert.equal(retry.status,200);assert.equal(retry.result.state.generation,first.result.state.generation);
    const displayId=uid(),touchId=uid(),cueId=f.state.cueId,shown=f.state.generation;
    await f.event('cue_displayed',{id:displayId,cueId,monotonicMs:100});
    const touch={id:touchId,cueId,displayEventId:displayId,generation:shown,reactionMs:432};
    assert.equal((await f.event('touch',touch)).status,200);await f.refresh();assert.equal(f.state.icon,'listening');
    await f.event('touch',touch);await f.event('touch',{...touch,id:uid()});
    const e=await f.call(f.path('export?format=json'),{auth:f.admin});const touches=e.result.events.filter(e=>e.type==='cue_touch');
    assert.equal(touches.length,2);assert.equal(touches.filter(e=>e.payload.accepted).length,1);
    assert.equal(touches[0].payload.reactionMs,432);
    await f.command('set_icon',{icon:'thinking'});assert.equal(f.state.icon,'thinking');await f.command('set_icon',{icon:'speaking'});assert.equal(f.state.icon,'speaking');
  }finally{f.close();}
});
test('page re-entry hides Cue and old-page events cannot revive it',async()=>{
  const f=await fixture();try{
    await f.start();await f.command('show_cue');const old={generation:f.state.generation,cueId:f.state.cueId,trialId:f.state.trial.id};const displayId=uid();
    await f.event('cue_displayed',{id:displayId,cueId:old.cueId,monotonicMs:100});
    const newPage=uid();const rejoin=await f.call(f.path('rejoin'),{auth:f.device,role:'device',data:{id:uid(),pageId:newPage,reason:'reload'}});assert.equal(rejoin.status,200);
    await f.refresh();assert.equal(f.state.icon,'hidden');assert.equal(f.state.suspended,true);
    await f.event('touch',{...old,displayEventId:displayId,reactionMs:500});await f.refresh();assert.equal(f.state.touched,false);
    await f.command('resume');assert.equal(f.state.icon,'hidden');assert.equal(f.state.suspended,false);
    f.setPageId(newPage);await f.command('abort');await f.start('coworker','reactive');assert.equal(f.state.icon,'hidden');assert.equal(f.state.cueId,null);
  }finally{f.close();}
});
test('private owner, origin, role, single device and code expiry are enforced',async()=>{
  const f=await fixture();try{
    assert.equal((await f.call(f.path('state'),{auth:f.admin,user:null})).status,401);
    assert.equal((await f.call(f.path('state'),{auth:f.admin,user:'other'})).status,403);
    assert.equal((await f.call(f.path('command'),{auth:f.device,role:'device',data:{id:uid(),action:'prepare'}})).status,403);
    assert.equal((await f.call(f.path('code'),{auth:f.admin,data:{},origin:'https://other.test'})).status,403);
    assert.equal((await f.call(f.path('code'),{auth:f.admin,data:{}})).status,409);
    await f.command('unpair');const code=await f.call(f.path('code'),{auth:f.admin,data:{}});
    await f.DB.prepare('UPDATE sessions SET code_expires=0 WHERE id=?').bind(f.admin.id).run();
    assert.equal((await f.call('/api/pair',{data:{code:code.result.code,pageId:uid()}})).status,409);
    assert.equal((await f.call(f.path('state')+'?pageId='+f.pageId,{auth:f.device,role:'device'})).status,403);
  }finally{f.close();}
});
test('connection timeout blocks normal controls, permits abort, preserves records',async()=>{
  const f=await fixture();try{
    await f.start();await f.DB.prepare('UPDATE sessions SET device_seen=0 WHERE id=?').bind(f.admin.id).run();
    assert.equal((await f.command('show_cue')).status,409);assert.equal((await f.command('abort')).status,200);
    const data=await f.call(f.path('export?format=json'),{auth:f.admin});assert.equal(data.result.trials[0].status,'aborted');
  }finally{f.close();}
});
test('concurrent retries produce one command event and CSV preserves Unicode notes safely',async()=>{
  const f=await fixture();try{
    await f.start();const id=uid(),data={id,action:'show_cue',baseGeneration:f.state.generation};
    const results=await Promise.all([f.call(f.path('command'),{auth:f.admin,data}),f.call(f.path('command'),{auth:f.admin,data})]);
    assert.deepEqual(results.map(r=>r.status),[200,200]);await f.refresh();
    await f.command('note',{note:'=시험 메모, "한식당"'});
    const exported=await f.call(f.path('export?format=json'),{auth:f.admin});assert.equal(exported.result.events.filter(e=>e.type==='show_cue').length,1);
    const response=await api(new Request('https://coast.test'+f.path('export?format=csv&kind=events'),{headers:{'oai-authenticated-user-id':'owner','x-coast-token':f.admin.token,'x-coast-role':'admin'}}),{DB:f.DB});
    assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/csv/);assert.match(await response.text(),/한식당/);
    const recovery=await f.call('/api/recover',{data:{}});assert.equal(recovery.status,200);assert.equal(recovery.result.state.suspended,true);
    assert.equal((await f.call(f.path('state'),{auth:f.admin})).status,403);
  }finally{f.close();}
});

test('audio claims are once per trial; authenticated logs are idempotent and remain attached after trial end',async()=>{
  const f=await fixture();try{
    await f.start('coworker','suggestion');
    const id=uid(),pageId=uid(),asset={name:'시험음원.wav',duration:1,sha256:'a'.repeat(64)},assets={dialogue:asset,prompt:asset,answer:asset};
    assert.equal((await f.command('begin_audio',{pageId,delayMs:1000,assets:{dialogue:asset,answer:asset}})).status,400);
    assert.equal((await f.command('begin_audio',{pageId,delayMs:1000,assets},id)).status,200);
    assert.equal((await f.command('begin_audio',{pageId,delayMs:1000,assets})).status,409);
    assert.equal((await f.command('begin_audio',{pageId,delayMs:1000,assets},id)).status,200);
    const trialId=f.state.trial.id;
    const event={id:uid(),trialId,runId:id,pageId,type:'operator_confirm',clientTime:new Date().toISOString(),monotonicMs:123,generation:f.state.generation,detail:{source:'Space'}};
    assert.equal((await f.call(f.path('audio-event'),{auth:f.device,role:'device',data:event})).status,403);
    assert.equal((await f.call(f.path('audio-event'),{auth:f.admin,data:{...event,pageId:uid()}})).status,403);
    assert.equal((await f.call(f.path('audio-event'),{auth:f.admin,data:{...event,trialId:uid()}})).status,403);
    await f.command('end');
    for(let i=0;i<2;i++)assert.equal((await f.call(f.path('audio-event'),{auth:f.admin,data:event})).status,200);
    const data=await f.call(f.path('export?format=json'),{auth:f.admin});
    assert.equal(data.result.events.filter(e=>e.type==='begin_audio').length,1);assert.equal(data.result.events.filter(e=>e.type==='operator_confirm').length,1);
    assert.equal(data.result.events.find(e=>e.type==='operator_confirm').trial_id,trialId);
    await f.start('friend','reactive');assert.equal(f.state.audioRun,null);
  }finally{f.close();}
});
