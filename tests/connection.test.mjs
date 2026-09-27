import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {connectionHealth,WARN_MS,LOST_MS,singleFlight} from '../public/connection.js';
const tick=()=>new Promise(r=>setImmediate(r));
test('3s locks controls, 10s ends grace; peer age advances even when a cached snapshot reports connected',()=>{
  const s={paired:true,deviceAgeMs:100,deviceConnected:true};
  assert.equal(connectionHealth(s,100,200).ready,true);
  assert.equal(connectionHealth(s,100,3100).ready,false);assert.equal(connectionHealth(s,100,3100).alive,true);
  assert.equal(connectionHealth(s,100,10000).alive,false);
  assert.equal(connectionHealth({...s,deviceAgeMs:3500},100,200).ready,false);
  assert.equal(connectionHealth(s,null,100).alive,false);
  assert.equal(connectionHealth({...s,paired:false},100,100).alive,false);
});
test('participant heartbeat progresses while an event upload remains unresolved',async()=>{
  const source=fs.readFileSync(new URL('../public/experiment.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
  const elements=new Map(),timers=[],queue=[],requests=[];let release,clock=100;
  const snapshot={state:{mode:'setup',generation:1,trial:null,suspended:false},adminConnected:true,adminAlive:true};
  const context={initializeAiWidget:()=>({setMode(){},setVisible(){},setState(){}}),singleFlight,WARN_MS,LOST_MS,
    crypto:globalThis.crypto,performance:{now:()=>clock},Date,console,
    document:{hidden:false,addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id);}},
    load:key=>key==='coast.device.v2'?{id:'s',token:'t'}:false,save(){},localStorage:{removeItem(){}},endpoint:(_,op)=>op,
    Outbox:class{db=Promise.resolve();async put(e){queue.push(e);}async all(){return [...queue];}async remove(id){queue.splice(queue.findIndex(e=>e.id===id),1);}},
    setInterval(){},setTimeout(fn){timers.push(fn);},request:async(path)=>{requests.push(path);if(path==='event')await new Promise(r=>release=r);return structuredClone(snapshot);},structuredClone};
  vm.createContext(context);vm.runInContext(source+'\ninitializeExperiment({reset(){}});',context);
  await tick();assert.ok(requests.includes('event'));assert.equal(requests.filter(x=>x.startsWith('state?')).length,1);
  clock+=1000;await timers.shift()();await tick();assert.equal(requests.filter(x=>x.startsWith('state?')).length,2);
  assert.equal(requests.filter(x=>x==='event').length,1,'event loop is single-flight');
  release();await tick();
});
