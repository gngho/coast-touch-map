import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioFlow,acceptsSpace} from '../public/admin/audio-flow.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(intervention,options={}){
  const commands=[],events=[],clips=[],waits=[];
  const snapshot={state:{trial:{id:'trial',status:'running',intervention},suspended:false,touched:false}};
  const flow=new AudioFlow({claim:async run=>{snapshot.state.audioRun={id:run.id};},command:async (action,data)=>{commands.push([action,data]);},play:async (asset,started)=>{clips.push(asset.meta.name);await started();},stop:()=>{},log:async (type,detail)=>events.push({type,detail}),changed:()=>{},wait:async ms=>waits.push(ms),...options});
  flow.update(snapshot,true);
  const begin=()=>flow.begin({trial:snapshot.state.trial,assets:Object.fromEntries(['dialogue','prompt','answer'].map(k=>[k,{meta:{name:k}}])),delayMs:1000,pageId:'page'});
  return {flow,snapshot,commands,events,clips,waits,begin};
}
test('Reactive and Suggestion require exactly one operator confirmation after the correct clips',async()=>{
  for(const mode of ['reactive','suggestion']){
    const f=fixture(mode);await f.begin();
    assert.equal(f.flow.phase,'response_wait');assert.deepEqual(f.clips,mode==='reactive'?['dialogue']:['dialogue','prompt']);
    const first=f.flow.confirm('Space'),second=f.flow.confirm('Space');
    assert.equal(await second,false);assert.equal(await first,true);
    assert.equal(f.flow.phase,'complete');assert.equal(f.clips.filter(x=>x==='answer').length,1);
    assert.equal(f.events.filter(e=>e.type==='operator_confirm').length,1);assert.equal(f.commands.length,0);
    assert.equal(await f.begin(),false);
  }
});
test('Cue waits for a touch, then animates once; Direct proceeds without a keyboard or icon',async()=>{
  const f=fixture('cue');await f.begin();assert.equal(f.flow.phase,'cue_wait');assert.deepEqual(f.clips,['dialogue']);
  f.snapshot.state.touched=true;f.flow.update(f.snapshot,true);f.flow.update(f.snapshot,true);
  await tick();assert.equal(f.flow.phase,'complete');assert.deepEqual(f.clips,['dialogue','answer']);
  assert.deepEqual(f.commands,[['show_cue',undefined],['set_icon',{icon:'thinking'}],['set_icon',{icon:'speaking'}],['set_icon',{icon:'hidden'}]]);
  const direct=fixture('direct');await direct.begin();assert.deepEqual(direct.clips,['dialogue','answer']);assert.equal(direct.flow.phase,'complete');assert.equal(direct.commands.length,0);
});
test('disconnect, suspension, trial switch and operator stop cancel pending answers without auto replay',async()=>{
  for(const reason of ['disconnect','suspend','switch','stop']){
    let release;const f=fixture('reactive',{wait:()=>new Promise(r=>release=r)});await f.begin();const response=f.flow.confirm('Space');await tick();
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
