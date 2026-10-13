import test from 'node:test';
import assert from 'node:assert/strict';
import {requestCommand} from '../public/admin/command-request.js';
import {createDiagnostics,connectionDetail} from '../public/admin/connection-diagnostics.js';
const options={method:'POST',data:{id:'fixed',baseGeneration:7,action:'set_icon',icon:'listening'}};

test('lost command response retries the same ID and revision without retrying rejection or auth failures',async()=>{
  const sent=[],retries=[];
  const result=await requestCommand('/command',options,{send:async(_path,request)=>{
    sent.push(structuredClone(request.data));
    if(sent.length===1)throw Object.assign(Error('lost response'),{code:'REQUEST_TIMEOUT'});
    return {saved:true};
  },onRetry:d=>retries.push(d),wait:async()=>{}});
  assert.equal(result.saved,true);assert.deepEqual(sent,[options.data,options.data]);assert.equal(retries.length,1);
  for(const status of [400,401,403,409]){
    let count=0;
    await assert.rejects(requestCommand('/command',options,{send:async()=>{count++;throw Object.assign(Error('rejected'),{status});},wait:async()=>{}}));
    assert.equal(count,1);
  }
});

test('persistent failure is bounded; cancellation during backoff prevents a late command',async()=>{
  let count=0,active=true;
  const send=async()=>{count++;throw Object.assign(Error('unavailable'),{code:'SERVER_UNAVAILABLE'});};
  await assert.rejects(requestCommand('/command',options,{send,wait:async()=>{}}),e=>e.attempts===3&&e.action==='set_icon');
  assert.equal(count,3);count=0;
  await assert.rejects(requestCommand('/command',options,{send,isCurrent:()=>active,wait:async()=>{active=false;}}),e=>e.code==='COMMAND_CANCELLED');
  assert.equal(count,1);
});

test('diagnostics remain bounded and downloadable without a server, and omit secrets',()=>{
  let saved=null;const storage={getItem:()=>saved,setItem:(_key,value)=>saved=value};
  const log=createDiagnostics(storage);
  for(let i=0;i<110;i++)log.record('state_error',{status:503,code:'SERVER_UNAVAILABLE',ray:'ray-ICN',token:'SECRET',participant:'P001'},{localAgeMs:3100});
  assert.equal(log.export().entries.length,100);assert.equal(createDiagnostics(storage).export().entries.length,100);
  assert.doesNotMatch(saved,/SECRET|P001/);
  assert.match(connectionDetail({localAgeMs:100,peerAgeMs:500},{_timing:{roundTrip:700}},{status:503}),/PC↔서버.*iPad↔서버.*700ms.*503/);
  const unavailable=createDiagnostics({getItem(){throw Error();},setItem(){throw Error();}});unavailable.record('state_error');assert.equal(unavailable.export().entries.length,1);
});
