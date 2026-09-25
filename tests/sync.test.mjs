import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from '../public/sync.js';
import {createNotice} from '../public/admin/notice.js';

function noticeFixture(){
  const classes=new Set(),element={textContent:'',classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}};
  return {element,classes,messages:createNotice(element)};
}

test('actual request timeout is Korean and a successful status request clears its error styling',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  t.mock.method(globalThis,'fetch',(_path,{signal})=>new Promise((resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(new DOMException('The user aborted a request.','AbortError')),{once:true});
  }));
  const pending=request('/api/status');
  const checked=assert.rejects(pending,error=>{
    assert.equal(error.code,'REQUEST_TIMEOUT');assert.match(error.message,/서버 응답이 지연/);assert.doesNotMatch(error.message,/aborted/);
    return true;
  });
  t.mock.timers.tick(2500);await checked;
  const {messages,element,classes}=noticeFixture();
  messages.error(await pending.catch(error=>error));assert.ok(classes.has('error'));
  globalThis.fetch.mock.mockImplementation(async()=>new Response(JSON.stringify({state:{generation:1}})));
  await request('/api/status');messages.connectionRestored();
  assert.equal(classes.has('error'),false);assert.match(element.textContent,/서버 연결이 복구/);
  assert.doesNotMatch(element.textContent,/명령.*완료/);
});

test('network errors are Korean but HTTP application errors retain their status',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('Failed to fetch');});
  await assert.rejects(request('/api/status'),error=>error.code==='CONNECTION_ERROR'&&/서버에 연결하지 못했습니다/.test(error.message));
  globalThis.fetch.mock.mockImplementation(async()=>new Response(JSON.stringify({error:'권한이 없습니다.'}),{status:403}));
  await assert.rejects(request('/api/status'),error=>error.status===403&&!error.code&&error.message==='권한이 없습니다.');
});

test('connection recovery preserves validation/authentication errors and newer notices',()=>{
  const {messages,element,classes}=noticeFixture();
  for(const status of [403,409]){
    messages.error(Object.assign(new Error('확인해야 할 조작 오류'),{status}));messages.connectionRestored();
    assert.equal(element.textContent,'확인해야 할 조작 오류');assert.ok(classes.has('error'));
  }
  messages.error(Object.assign(new Error('지연'),{code:'REQUEST_TIMEOUT'}));
  messages.show('새 연결 코드를 입력하세요.');messages.connectionRestored();
  assert.equal(element.textContent,'새 연결 코드를 입력하세요.');assert.equal(classes.has('error'),false);
  messages.error(Object.assign(new Error('연결 오류'),{code:'CONNECTION_ERROR'}));messages.connectionRestored();
  const restored=element.textContent;messages.connectionRestored();assert.equal(element.textContent,restored);
});
