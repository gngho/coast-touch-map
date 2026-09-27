import test from 'node:test';import assert from 'node:assert/strict';
import {allocate,DESIGN,RELATIONS,METHODS,validateConfig,planProgress} from '../public/admin/schedule-model.js';
const config=(seed='study',count=24)=>({design:DESIGN,seed,participants:Array.from({length:count},(_,i)=>`P${String(i+1).padStart(3,'0')}`)});
test('Williams 12 positions and all directed adjacent condition pairs balance; POI cases balance independently',()=>{
  for(let n=0;n<60;n++){
    const people=allocate(config(`seed${n}`));const first=people.slice(0,12),edges=new Map();
    for(const p of people){assert.equal(new Set(p.steps.map(s=>s.condition)).size,12);assert.equal(p.steps.filter(s=>s.poi==='restaurant').length,6);
      for(const r of RELATIONS)assert.equal(p.steps.filter(s=>s.relationship===r&&s.poi==='restaurant').length,2);
      for(const m of METHODS)assert.ok([1,2].includes(p.steps.filter(s=>s.intervention===m&&s.poi==='restaurant').length));}
    for(let i=0;i<12;i++){assert.equal(new Set(first.map(p=>p.steps[i].condition)).size,12);assert.equal(people.filter(p=>p.steps[i].poi==='restaurant').length,12);}
    for(const p of first)for(let i=1;i<12;i++){const key=p.steps[i-1].condition+'>'+p.steps[i].condition;edges.set(key,(edges.get(key)||0)+1);}
    assert.equal(edges.size,132);assert.ok([...edges.values()].every(n=>n===1));
    for(let i=1;i<=12;i++){const code=`C${String(i).padStart(2,'0')}`;assert.equal(first.flatMap(p=>p.steps).filter(s=>s.condition===code&&s.poi==='restaurant').length,6);}
  }
});
test('seed and participant order reproduce allocations, partial blocks are deterministic, invalid IDs refused',()=>{
  assert.deepEqual(allocate(config()),allocate(config()));assert.notDeepEqual(allocate(config()),allocate(config('another')));
  assert.deepEqual(allocate(config('study',5)),allocate(config()).slice(0,5));
  assert.throws(()=>validateConfig({...config(),participants:['P1','P1']}));assert.throws(()=>validateConfig({...config(),seed:'<script>'}));assert.throws(()=>validateConfig(config('s',121)));
});
test('aborted attempts do not consume an allocation, replay adds attempts, ended advances to next',()=>{
  const c=config('x',1),attempts=[{id:'a',number:1,participant:'P001',position:1,status:'aborted'}];
  assert.equal(planProgress(c,attempts)[0].nextPosition,1);assert.equal(planProgress(c,attempts)[0].steps[0].status,'retry');
  attempts.push({id:'b',number:2,participant:'P001',position:1,status:'ended'});
  const p=planProgress(c,attempts)[0];assert.equal(p.nextPosition,2);assert.equal(p.completed,1);assert.equal(p.steps[0].attempts.length,2);
});
