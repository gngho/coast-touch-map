import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioFlow,acceptsSpace} from '../public/admin/audio-flow.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(intervention,options={}){
  const commands=[],events=[],clips=[],waits=[];
  const snapshot={state:{trial:{id:'trial',status:'running',intervention},suspended:false,touched:false}};
  const flow=new AudioFlow({claim:async run=>{snapshot.state.audioRun={id:run.id,status:'running'};},command:async (action,data)=>{assert.equal(data.runId,snapshot.state.audioRun.id);assert.equal(data.trialId,'trial');commands.push([action,data.icon]);if(['show_cue','arm_reactive'].includes(action))snapshot.state.cueId='armed';},play:async (asset,started)=>{clips.push(asset.meta.name);await started();},chime:async started=>started({name:'ai-chime-v1',duration:.32}),stop:()=>{},log:async (type,detail)=>events.push({type,detail}),changed:()=>{},now:()=>0,wait:async ms=>waits.push(ms),...options});
  flow.update(snapshot,true);
  const begin=()=>flow.begin({trial:snapshot.state.trial,assets:Object.fromEntries(['dialogue','prompt','answer'].map(k=>[k,{meta:{name:k}}])),delayMs:1000,pageId:'page'});
  return {flow,snapshot,commands,events,clips,waits,begin};
}
function touch(f){f.snapshot.state.touched=true;f.snapshot.state.activation={id:'touch',pageId:'ipad',trialId:'trial',cueId:'armed',runId:f.flow.run.id};}
test('Reactive and Suggestion require exactly one operator confirmation after the correct clips',async()=>{
  for(const mode of ['reactive','suggestion']){
    const f=fixture(mode);await f.begin();
    if(mode==='reactive'){assert.equal(f.flow.phase,'reactive_wait');assert.equal(await f.flow.confirm('Space'),false);touch(f);f.flow.update(f.snapshot,true);}
    assert.equal(f.flow.phase,'response_wait');assert.deepEqual(f.clips,mode==='reactive'?['dialogue']:['dialogue','prompt']);
    const first=f.flow.confirm('Space'),second=f.flow.confirm('Space');
    assert.equal(await second,false);assert.equal(await first,true);
    assert.equal(f.flow.phase,'complete');assert.equal(f.clips.filter(x=>x==='answer').length,1);
    assert.equal(f.events.filter(e=>e.type==='operator_confirm').length,1);assert.deepEqual(f.commands.slice(-3),[['set_icon','thinking'],['set_icon','speaking'],['finish_audio',undefined]]);
    assert.equal(await f.begin(),false);
  }
});
test('Cue waits for a touch then answers once; Direct animates and answers automatically',async()=>{
  const f=fixture('cue');await f.begin();assert.equal(f.flow.phase,'cue_wait');assert.deepEqual(f.clips,['dialogue']);
  touch(f);f.flow.update(f.snapshot,true);f.flow.update(f.snapshot,true);
  await tick();assert.equal(f.flow.phase,'complete');assert.deepEqual(f.clips,['dialogue','answer']);
  assert.deepEqual(f.commands,[['set_icon','listening'],['show_cue',undefined],['set_icon','thinking'],['set_icon','speaking'],['finish_audio',undefined]]);
  const direct=fixture('direct');await direct.begin();assert.deepEqual(direct.clips,['dialogue','answer']);assert.equal(direct.flow.phase,'complete');assert.deepEqual(direct.commands,[['set_icon','listening'],['set_icon','thinking'],['set_icon','speaking'],['finish_audio',undefined]]);
});
test('disconnect, suspension, trial switch and operator stop cancel pending answers without auto replay',async()=>{
  for(const reason of ['disconnect','suspend','switch','stop']){
    let release;const f=fixture('reactive',{wait:()=>new Promise(r=>release=r)});await f.begin();touch(f);f.flow.update(f.snapshot,true);const response=f.flow.confirm('Space');await tick();
    if(reason==='stop')f.flow.cancel();
    else {if(reason==='suspend')f.snapshot.state.suspended=true;if(reason==='switch')f.snapshot.state.trial.id='other';f.flow.update(f.snapshot,reason!=='disconnect');}
    release();await response;assert.equal(f.flow.phase,'stopped');assert.deepEqual(f.clips,['dialogue']);
    f.snapshot.state.suspended=false;f.flow.update(f.snapshot,true);assert.equal(f.flow.canConfirm,false);assert.equal(await f.begin(),false);
  }
});
test('a failed claim cannot play audio or write events against an unowned run',async()=>{
  const f=fixture('direct',{claim:async()=>{throw Error('이미 시작');}});assert.equal(await f.begin(),false);assert.equal(f.flow.phase,'error');assert.equal(f.clips.length,0);assert.equal(f.events.length,0);
});
test('Space ignores key repeat, IME, modifiers and editable/interactive targets',()=>{
  const key={code:'Space',target:{closest:()=>null}};assert.equal(acceptsSpace(key),true);
  for(const extra of [{repeat:true},{isComposing:true},{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{code:'Enter'},{target:{closest:()=>({})}}])assert.equal(acceptsSpace({...key,...extra}),false);
});

test('Suggestion waits before its prompt and again after confirmation; cancel during prompt wait never plays it',async()=>{
  let release;const waits=[];
  const f=fixture('suggestion',{wait:ms=>{if(ms===180)return Promise.resolve();waits.push(ms);return new Promise(r=>release=r);}});
  const begin=f.begin();await tick();assert.deepEqual(f.clips,['dialogue']);assert.equal(f.flow.canConfirm,false);
  assert.deepEqual(waits,[1000]);release();await begin;assert.deepEqual(f.clips,['dialogue','prompt']);
  const confirm=f.flow.confirm('Space');await tick();assert.deepEqual(waits,[1000,1000]);assert.equal(f.clips.includes('answer'),false);
  release();await confirm;assert.deepEqual(f.clips,['dialogue','prompt','answer']);
  let cancelWait;const c=fixture('suggestion',{wait:()=>new Promise(r=>cancelWait=r)});const pending=c.begin();await tick();c.flow.cancel();cancelWait();await pending;assert.deepEqual(c.clips,['dialogue']);
});

test('transient delay keeps the current clip, gates the next prompt, and resumes once without replay',async()=>{
  let finishClip,releaseWait;let stops=0;const clips=[];
  const f=fixture('suggestion',{play:async(asset,started)=>{clips.push(asset.meta.name);await started();if(asset.meta.name==='dialogue')await new Promise(r=>finishClip=r);},stop:()=>stops++,wait:ms=>ms===100?new Promise(r=>releaseWait=r):Promise.resolve()});
  const begin=f.begin();await tick();f.flow.update(f.snapshot,true,false,{localAgeMs:3500});
  assert.equal(stops,0);assert.equal(f.flow.phase,'dialogue');finishClip();await tick();
  assert.deepEqual(clips,['dialogue']);assert.equal(f.flow.canConfirm,false);
  f.flow.update(f.snapshot,true,true,{localAgeMs:0});releaseWait();await begin;
  assert.deepEqual(clips,['dialogue','prompt']);assert.equal(f.flow.canConfirm,true);
  assert.deepEqual(f.events.filter(e=>e.type.startsWith('audio_connection')).map(e=>e.type),['audio_connection_delayed','audio_connection_restored']);
});

test('hard timeout during a soft-delay wait cancels and never resumes a queued answer',async()=>{
  let release;const f=fixture('direct',{wait:()=>new Promise(r=>release=r)});
  const begin=f.begin();await tick();f.flow.update(f.snapshot,true,false);f.flow.update(f.snapshot,false,false,{localAgeMs:10000});release();await begin;
  f.flow.update(f.snapshot,true,true);assert.equal(f.flow.phase,'stopped');assert.deepEqual(f.clips,['dialogue']);
  assert.equal(f.events.find(e=>e.type==='audio_flow_stopped').detail.cause,'connection_timeout');
});


test('dialogue starts before Listening command and does not wait for applied audit ACK',async()=>{
  const order=[];const f=fixture('suggestion',{play:async(asset,started)=>{order.push(asset.meta.name);await started();},command:async(action,data)=>{order.push(data.icon||action);return {state:{generation:3}};}});
  f.snapshot.state.generation=3;f.snapshot.applied=false;
  await f.begin();assert.deepEqual(order.slice(0,2),['dialogue','listening']);assert.equal(f.flow.phase,'response_wait');
});

test('cancellation while claiming stops a late successful claim without playing',async()=>{
  let release;const stopped=[];
  const f=fixture('direct',{claim:()=>new Promise(r=>release=r),command:async(action,data)=>stopped.push({action,data})});
  const begin=f.begin();await tick();f.flow.cancel();release();await begin;
  assert.deepEqual(f.clips,[]);assert.equal(stopped.length,1);assert.equal(stopped[0].action,'stop_audio');assert.equal(stopped[0].data.trialId,'trial');
});


test('late claim completion cannot stop or log against a newer run',async()=>{
  let release;const stopped=[],logged=[];
  const f=fixture('direct',{claim:()=>new Promise(r=>release=r),command:async(action,data)=>stopped.push(data),log:async(type,detail,run)=>logged.push(run.id)});
  const begin=f.begin();await tick();const oldRun=f.flow.run.id;f.flow.cancel();
  f.snapshot.state.trial={id:'new-trial',status:'running',intervention:'direct'};
  f.flow.run={id:'new-run',trialId:'new-trial'};f.flow.phase='claiming';f.flow.claimed=false;
  release();await begin;assert.deepEqual(stopped,[]);assert.deepEqual(logged,[oldRun]);assert.equal(f.flow.claimed,false);assert.equal(f.flow.phase,'claiming');
});


test('each AI utterance has one completed chime before voice; human dialogue has none',async()=>{
  for(const mode of ['reactive','cue','suggestion','direct']){
    const order=[];const f=fixture(mode,{chime:async started=>{order.push('chime');await started({name:'ai-chime-v1',duration:.32});},play:async(asset,started)=>{order.push(asset.meta.name);await started();}});
    await f.begin();
    if(['reactive','cue'].includes(mode)){touch(f);f.flow.update(f.snapshot,true);}
    if(['reactive','suggestion'].includes(mode))await f.flow.confirm('button');
    await tick();assert.equal(f.flow.phase,'complete');
    assert.deepEqual(order,mode==='suggestion'?['dialogue','chime','prompt','chime','answer']:['dialogue','chime','answer']);
    const chimes=f.events.filter(e=>e.detail.clip==='chime');
    assert.deepEqual(chimes.map(e=>e.type),mode==='suggestion'?['audio_started','audio_ended','audio_started','audio_ended']:['audio_started','audio_ended']);
  }
});

test('stop or playback failure during chime never starts the following AI voice',async()=>{
  for(const mode of ['direct','suggestion'])for(const fail of [false,true]){
    let finish;const f=fixture(mode,{chime:()=>new Promise((resolve,reject)=>finish=fail?()=>reject(Error('sound failed')):resolve)});
    const begin=f.begin();await tick();assert.equal(f.flow.phase,'chime');assert.deepEqual(f.clips,['dialogue']);
    if(!fail)f.flow.cancel();finish();await begin;
    assert.deepEqual(f.clips,['dialogue']);assert.equal(f.flow.phase,fail?'error':'stopped');
  }
});


test('Reactive and Cue cannot answer from a stale or unlinked touched flag, even after repeated polls',async()=>{
  for(const mode of ['reactive','cue']){
    const f=fixture(mode);await f.begin();
    for(const activation of [null,{id:'old',pageId:'ipad',runId:'old',trialId:'trial',cueId:'armed'},{id:'old',pageId:'ipad',runId:f.flow.run.id,trialId:'old',cueId:'armed'}]){
      f.snapshot.state.touched=true;f.snapshot.state.activation=activation;
      for(let i=0;i<10;i++)f.flow.update(f.snapshot,true);
      assert.equal(f.flow.canConfirm,false);assert.equal(await f.flow.confirm('Space'),false);assert.deepEqual(f.clips,['dialogue']);
      await assert.rejects(f.flow.answer(f.flow.epoch),/터치/);
    }
    touch(f);f.flow.update(f.snapshot,true);
    if(mode==='reactive')await f.flow.confirm('Space');await tick();assert.equal(f.flow.phase,'complete');
  }
});

test('Thinking subtracts command transit time; a stalled audit does not delay audio or the 180ms gap',async()=>{
  let time=0;const waits=[],order=[];
  const f=fixture('direct',{now:()=>time,command:async(action,data)=>{if(data.icon==='thinking')time+=350;},wait:async ms=>{waits.push(ms);time+=ms;},log:()=>new Promise(()=>{}),play:async(asset,started)=>{order.push(asset.meta.name);await started();}});
  await f.begin();assert.deepEqual(waits,[650,180]);assert.deepEqual(order,['dialogue','answer']);assert.equal(f.flow.phase,'complete');
});

test('Cue uses time already spent Thinking since accepted touch without restarting the timer',async()=>{
  const f=fixture('cue');await f.begin();touch(f);
  f.snapshot.serverTime=1800;f.snapshot.state.activation.at=1000;f.snapshot.state.icon='thinking';
  f.flow.update(f.snapshot,true);await tick();assert.deepEqual(f.waits,[200,180]);assert.equal(f.commands.filter(([action,icon])=>icon==='thinking').length,0);
});

test('cancelling in the post-chime gap never plays the AI voice',async()=>{
  let release;const f=fixture('direct',{wait:ms=>ms===180?new Promise(r=>release=r):Promise.resolve()});
  const begin=f.begin();await tick();assert.equal(f.flow.phase,'chime');f.flow.cancel();release();await begin;assert.deepEqual(f.clips,['dialogue']);
});
