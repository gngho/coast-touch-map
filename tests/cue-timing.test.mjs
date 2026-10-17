import {pollDelay} from '../public/poll-timing.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {cueDelay,scenarioLabel} from '../public/cue-timing.js';
import fs from 'node:fs';
import vm from 'node:vm';
import {singleFlight,WARN_MS,LOST_MS} from '../public/connection.js';
test('different client clocks converge on the same scheduled Cue onset',()=>{
 const pc={state:{cueAt:2200},serverTime:1000,_timing:{receivedAt:50,roundTrip:100}};
 const ipad={state:{cueAt:2200},serverTime:1400,_timing:{receivedAt:9000,roundTrip:60}};
 assert.equal(cueDelay(pc,100),1100);
 assert.equal(cueDelay(ipad,9020),750);
 assert.equal(cueDelay(pc,1200),0);
 assert.equal(cueDelay(ipad,9770),0);
 assert.equal(cueDelay({state:{}},0),0);
});

test('participant waits until scheduled onset and suspension cancels the pending visual',async()=>{
 for(const cancel of [false,true]){
  let clock=100;const timers=[],states=[],events=[],queue=[],elements=new Map();
  const snapshot={state:{mode:'experiment',generation:1,trial:{id:'trial',status:'running',intervention:'cue'},icon:'twinkle',cueId:'cue',cueAt:1300,touchReady:true,touched:false,suspended:false},adminConnected:true,adminAlive:true};
  const source=fs.readFileSync(new URL('../public/experiment.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
  const context={cueDelay:s=>cueDelay(s,clock),singleFlight,WARN_MS,LOST_MS,crypto:globalThis.crypto,performance:{now:()=>clock},Date,console,structuredClone,
   initializeAiWidget:()=>({setMode(){},setVisible(){},setTouchEnabled(){},setState:s=>states.push(s)}),
   document:{hidden:false,addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id);}},
   load:key=>key==='coast.device.v2'?{id:'s',token:'t'}:false,save(){},localStorage:{removeItem(){}},endpoint:(_,op)=>op,requestAnimationFrame:f=>f(),setInterval(){},
   setTimeout(fn,ms){const timer={fn,ms,cleared:false};timers.push(timer);return timer;},clearTimeout:t=>{t.cleared=true;},
   Outbox:class{db=Promise.resolve();async put(e){queue.push(e);events.push(e);}async all(){return [...queue];}async remove(id){queue.splice(queue.findIndex(e=>e.id===id),1);}},
   request:async()=>({...structuredClone(snapshot),serverTime:clock,_timing:{receivedAt:clock,roundTrip:0}})};
  Object.assign(context,{pollDelay});vm.createContext(context);vm.runInContext(source+'\ninitializeExperiment({reset(){}});',context);
  const settle=()=>new Promise(r=>setImmediate(r));await settle();
  assert.equal(states.includes('twinkle'),false);assert.equal(events.length,0);
  const onset=timers.find(t=>t.ms===1200);assert.ok(onset);
  if(cancel){snapshot.state.suspended=true;snapshot.state.generation++;clock=250;await timers.find(t=>t.ms===150).fn();await settle();assert.equal(onset.cleared,true);}
  else{clock=1300;onset.fn();await settle();assert.equal(states.at(-1),'twinkle');assert.equal(events.filter(e=>e.type==='cue_displayed').length,1);}
  if(cancel)assert.equal(states.includes('twinkle'),false);
 }
});
test('scenario display hides relation prefixes without changing stored records or free text',()=>{
 for(const relation of ['FR','BU'])for(const scenario of ['restaurant','cafe','weather','road'])assert.equal(scenarioLabel(`${relation}-${scenario}`),scenario);
 assert.equal(scenarioLabel('custom-scenario'),'custom-scenario');
});
