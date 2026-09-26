import test from 'node:test';
import assert from 'node:assert/strict';
import {initRecordReset} from '../public/admin/reset.js';

test('reset dialog requires the exact confirmation and a stable inactive trial; cancel never deletes',async()=>{
  const nodes=new Map(),previous=globalThis.document;
  const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,open:false,showModal(){this.open=true;},close(){this.open=false;},focus(){},addEventListener(){}});return nodes.get(id);};
  globalThis.document={getElementById:get};
  try{
    let snapshot={state:{generation:8,trialCount:4,trial:{status:'ended'}}},requests=[],success=0;
    const ui=initRecordReset({getSnapshot:()=>snapshot,command:async(action,data)=>{requests.push({action,...data});snapshot={state:{generation:9,trialCount:0,trial:null,lastReset:{id:data.id}}};return snapshot;},onSuccess:()=>success++});
    get('reset-records').onclick();assert.equal(get('reset-confirm').disabled,true);assert.match(get('reset-count').textContent,/4개/);
    get('reset-text').value='초기';get('reset-text').oninput();assert.equal(get('reset-confirm').disabled,true);
    get('reset-text').value='초기화';get('reset-text').oninput();assert.equal(get('reset-confirm').disabled,false);
    get('reset-cancel').onclick();assert.equal(requests.length,0);assert.equal(get('reset-dialog').open,false);
    get('reset-records').onclick();snapshot.state.trial.status='running';ui.update();assert.equal(get('reset-confirm').disabled,true);
    snapshot.state.trial.status='ended';snapshot.state.generation++;ui.update();assert.equal(get('reset-confirm').disabled,true);
    get('reset-cancel').onclick();get('reset-records').onclick();get('reset-text').value='초기화';get('reset-text').oninput();
    await get('reset-form').onsubmit({preventDefault(){}});
    assert.equal(requests.length,1);assert.equal(requests[0].action,'reset_records');assert.equal(requests[0].expectedTrialCount,4);assert.equal(requests[0].baseGeneration,9);assert.equal(success,1);assert.equal(get('reset-dialog').open,false);
  }finally{globalThis.document=previous;}
});
