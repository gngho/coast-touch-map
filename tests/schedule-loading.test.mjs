import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as model from '../public/admin/schedule-model.js';
import * as report from '../public/admin/report-model.js';
import {requestSchedule,retryableRead} from '../public/admin/schedule-request.js';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id))elements.set(id,{value:({'schedule-count':'1','schedule-first':'1','schedule-prefix':'P'})[id]||'',open:false,disabled:false,textContent:'',innerHTML:'',addEventListener(){},dispatchEvent(){},replaceChildren(...items){this.children=items;this.value=items[0]?.value||'';}});
    return elements.get(id);
  };
  const config=model.validateConfig({design:model.DESIGN,seed:'test',participants:['P001']});
  const plan={id:'plan',createdAt:1,config,participants:model.planProgress(config)};
  let snapshot={state:{generation:0,mode:'setup'}},calls=0,time=1000,busy=false;
  const pending=[],commands=[],paths=[];
  const context={...model,...report,requestSchedule:(path,opts)=>requestSchedule(path,{...opts,wait:async()=>{},send:()=>{calls++;paths.push(path);return new Promise((resolve,reject)=>pending.push({resolve,reject}));}}),retryableRead,
    endpoint:()=>'/schedule',crypto,encodeURIComponent,Option:class{constructor(text,value){this.text=text;this.value=value;}},Event,
    document:{getElementById:element,querySelectorAll:()=>[]},Date:{now:()=>time},console};
  vm.createContext(context);
  const source=fs.readFileSync(new URL('../public/admin/schedules.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
  vm.runInContext(source+'\nglobalThis.initialize=initSchedules;',context);
  const ui=context.initialize({getAuth:()=>({id:'session',token:'test'}),getSnapshot:()=>snapshot,isBusy:()=>busy,isConnected:()=>true,command:async(action)=>{commands.push(action);}});
  return {element,ui,plan,pending,commands,paths,get calls(){return calls;},setState(state){snapshot={state};},advance(ms){time+=ms;},setBusy(value){busy=value;}};
}

test('a failed schedule read retries, preserves the visible plan, and refreshes automatically after cooldown',async()=>{
  const f=fixture();f.element('schedule-section').open=true;f.ui.update();
  f.pending.shift().resolve({plans:[f.plan]});await tick();assert.equal(f.element('schedule-next').disabled,false);
  const table=f.element('schedule-table').innerHTML;
  const loading=f.element('schedule-load').onclick();
  for(let i=0;i<3;i++){f.pending.shift().reject(Object.assign(Error('slow'),{code:'REQUEST_TIMEOUT'}));await tick();}
  await loading;assert.equal(f.element('schedule-table').innerHTML,table);assert.equal(f.element('schedule-next').disabled,true);
  assert.match(f.element('schedule-status').textContent,/자동 재조회/);const calls=f.calls;
  f.ui.update();assert.equal(f.calls,calls);
  f.advance(5001);f.ui.update();f.pending.shift().resolve({plans:[f.plan]});await tick();
  assert.equal(f.element('schedule-next').disabled,false);assert.equal(f.calls,calls+1);
});

test('state changes during a read trigger a fresh read rather than publishing the old plan',async()=>{
  const f=fixture();f.element('schedule-section').open=true;f.ui.update();
  f.setState({trial:{id:'new',status:'ended'}});f.ui.update();
  f.pending.shift().resolve({plans:[f.plan]});await tick();assert.equal(f.calls,2);
  assert.equal(f.element('schedule-next').disabled,true);
  f.pending.shift().resolve({plans:[f.plan]});await tick();assert.equal(f.element('schedule-next').disabled,false);
});

test('refresh callers share the pending request; auth errors do not retry automatically',async()=>{
  const f=fixture();const first=f.element('schedule-load').onclick(),second=f.element('schedule-load').onclick();
  assert.equal(first,second);assert.equal(f.calls,1);
  f.pending.shift().reject(Object.assign(Error('login'),{status:401,code:'AUTHENTICATION_REQUIRED'}));await first;
  f.element('schedule-section').open=true;f.advance(100000);f.ui.update();assert.equal(f.calls,1);
  assert.match(f.element('schedule-status').textContent,/로그인/);
});

test('clearing records while a read is pending cannot restore the old plan',async()=>{
  const f=fixture();const loading=f.element('schedule-load').onclick();f.ui.clear();
  f.pending.shift().resolve({plans:[f.plan]});await loading;
  assert.equal(f.element('schedule-view').hidden,true);assert.equal(f.element('schedule-plan').children.length,0);
});

test('progress refresh scopes the selected plan, retains the catalog, and never polls an unchanged allocation',async()=>{
 const f=fixture(),other={...f.plan,id:'other',createdAt:2};
 f.setState({schedule:{id:'other'},trial:{id:'old',status:'ended',schedule:{planId:'plan'}}});
 f.element('schedule-section').open=true;f.ui.update();f.pending.shift().resolve({plans:[f.plan,other]});await tick();
 assert.equal(f.element('schedule-plan').value,'plan','restore the actual trial plan, not the last created plan');
 for(let i=0;i<20;i++)f.ui.update();assert.equal(f.calls,1);
 f.setState({schedule:{id:'other'},trial:{id:'new',status:'prepared',schedule:{planId:'plan'}}});f.ui.update();
 assert.equal(f.paths.at(-1),'/schedule?planId=plan');
 f.pending.shift().resolve({plans:[f.plan]});await tick();assert.equal(f.element('schedule-plan').children.length,2);
 f.element('schedule-plan').value='other';f.element('schedule-plan').onchange();assert.equal(f.paths.at(-1),'/schedule?planId=other');
 f.pending.shift().resolve({plans:[other]});await tick();assert.equal(f.element('schedule-plan').value,'other');
 const explicit=f.element('schedule-load').onclick();assert.equal(f.paths.at(-1),'/schedule');f.pending.shift().resolve({plans:[f.plan,other]});await explicit;
});
