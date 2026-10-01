import test from 'node:test';import assert from 'node:assert/strict';
import {allocate,DESIGN,RELATIONS,METHODS,validateConfig,planProgress} from '../public/admin/schedule-model.js';
const config=(seed='study',count=16)=>({design:DESIGN,seed,participants:Array.from({length:count},(_,i)=>`P${String(i+1).padStart(3,'0')}`)});
test('paired Williams schedules balance blocks, all four subtypes and within-pair order',()=>{
  for(let seed=0;seed<60;seed++){
    const people=allocate(config(`seed${seed}`)),edges=new Map();
    for(const p of people){
      assert.equal(p.steps.length,16);
      const blocks=p.steps.filter(s=>s.episodePosition===1);
      assert.equal(new Set(blocks.map(s=>s.condition)).size,8);
      assert.equal(blocks.filter(s=>s.family==='place').length,4);
      for(const subtype of ['restaurant','cafe','weather','road']){
        assert.equal(p.steps.filter(s=>s.subtype===subtype).length,4);
        for(const r of RELATIONS)assert.equal(p.steps.filter(s=>s.relationship===r&&s.subtype===subtype).length,2);
      }
      for(let i=0;i<16;i+=2){const [a,b]=p.steps.slice(i,i+2);assert.equal(a.condition,b.condition);assert.equal(a.blockPosition,b.blockPosition);assert.notEqual(a.family,b.family);}
    }
    for(let i=0;i<8;i++)assert.equal(new Set(people.slice(0,8).map(p=>p.steps[i*2].condition)).size,8);
    for(const p of people.slice(0,8))for(let i=2;i<16;i+=2){const key=p.steps[i-2].condition+'>'+p.steps[i].condition;edges.set(key,(edges.get(key)||0)+1);}
    assert.equal(edges.size,56);assert.ok([...edges.values()].every(n=>n===1));
    for(const condition of new Set(people[0].steps.map(s=>s.condition))){
      const combinations=new Map();
      for(const p of people){const pair=p.steps.filter(s=>s.condition===condition),key=pair.map(s=>s.subtype).join('>');combinations.set(key,(combinations.get(key)||0)+1);}
      assert.equal(combinations.size,8);assert.ok([...combinations.values()].every(n=>n===2));
    }
  }
});
test('both episodes and survey are required before advancing blocks; final survey completes participant',()=>{
 const c=config('paired',1),attempts=[];const surveys=[];
 for(let block=1;block<=8;block++){
  for(let episode=1;episode<=2;episode++){
   const position=(block-1)*2+episode;
   assert.equal(planProgress(c,attempts,surveys)[0].nextPosition,position);
   attempts.push({participant:'P001',position,number:position,status:'ended'});
  }
  const p=planProgress(c,attempts,surveys)[0];assert.equal(p.nextPosition,null);assert.equal(p.pendingSurvey,block);
  surveys.push({participant:'P001',blockPosition:block,completedAt:block});
 }
 const p=planProgress(c,attempts,surveys)[0];assert.equal(p.completed,16);assert.equal(p.completedBlocks,8);assert.equal(p.nextPosition,null);assert.equal(p.pendingSurvey,null);
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

test('old saved plans preserve exact allocation and progress through the versioned dispatcher',async()=>{
 const legacy=await import('../public/admin/schedule-legacy.js');
 const c={...config('old',24),design:legacy.DESIGN};
 const attempts=[{participant:'P001',position:1,number:1,status:'ended'}];
 assert.deepEqual(allocate(c),legacy.allocate(c));
 assert.deepEqual(planProgress(c,attempts),legacy.planProgress(c,attempts));
});

test('v2 paired plans retain their original 24 scenarios and survey gates',async()=>{
 const old=await import('../public/admin/schedule-paired-v2.js');
 const c={...config('paired-old'),design:old.DESIGN};
 const attempts=[{participant:'P001',position:1,number:1,status:'ended'}];
 assert.deepEqual(allocate(c),old.allocate(c));
 assert.deepEqual(planProgress(c,attempts),old.planProgress(c,attempts));
});

test('new identifiers contain only FR or BU and scenario, independently of intervention',()=>{
 for(const p of allocate(config()))for(const s of p.steps){
  assert.match(s.scenario,/^(FR|BU)-(restaurant|cafe|weather|road)$/);
  assert.equal(s.relationship==='friend',s.scenario.startsWith('FR-'));
  assert.notEqual(s.relationship,'partner');
 }
});
