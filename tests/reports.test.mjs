import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,clockDelta,summaryRows,eventRows,toCsv,summaryHtml,timelineHtml,kst} from '../public/admin/report-model.js';
const trial=(intervention='reactive')=>({id:'t',number:1,participant:'P001',relationship:'friend',intervention,scenario:'RFR',status:'ended',started_at:1000,ended_at:43020});
const e=(id,type,payload={},extra={})=>({id,type,payload,trial_id:'t',server_time:2000,page_id:'pc',actor:'admin',...extra});
const audio=(id,type,clip,ms,extra={})=>e(id,type,{clip,monotonicMs:ms,runId:'run'},{...extra});
test('report pairs audio on same page and run, separates start-preparation faults from running faults',()=>{
  const input={trials:[trial()],events:[e('gap','connection_lost',{}, {server_time:500}),audio('d','audio_ended','dialogue',171248.4),audio('c','operator_confirm',null,179504.5),audio('a','audio_started','answer',180520.9),e('done','audio_flow_complete')]};
  const s=summarize(input)[0];assert.equal(s.totalMs,42020);assert.ok(Math.abs(s.confirmMs-8256.1)<.001);assert.ok(Math.abs(s.delayMs-1016.4)<.001);assert.equal(s.during,'');assert.match(s.before,/연결 끊김/);assert.equal(s.audioStatus,'재생 완료');
  const rows=summaryRows(input);assert.equal(rows[0]['진행자 확인까지 (초·PC)'],8.256);assert.equal(rows[0]['Cue 표시→첫 터치 (초·iPad)'],'');
  assert.equal(clockDelta(input.events[1],{...input.events[2],page_id:'other'}),null);
  assert.equal(clockDelta(input.events[1],{...input.events[2],payload:{...input.events[2].payload,runId:'other'}}),null);
});
test('cue reaction only comes from valid accepted touch with linked display; missing values never become zero',()=>{
  const input={trials:[trial('cue')],events:[e('display','cue_displayed',{cueId:'cue',monotonicMs:100},{page_id:'ipad'}),e('touch','cue_touch',{cueId:'cue',displayEventId:'display',accepted:true,reactionMs:3558},{page_id:'ipad'})]};
  assert.equal(summarize(input)[0].cueMs,3558);assert.equal(summarize(input)[0].confirmMs,null);
  input.events[1].payload.accepted=false;assert.equal(summarize(input)[0].cueMs,null);
  input.events[1].payload.accepted=true;input.events[1].payload.displayEventId='missing';assert.equal(summarize(input)[0].cueMs,null);
  input.trials[0].started_at='null';assert.equal(summarize(input)[0].totalMs,null);
  input.events[1].payload.displayEventId='display';input.events[1].payload.reactionMs=0;assert.equal(summarize(input)[0].cueMs,0);
});
test('suggestion uses prompt end and direct has no response metric; delayed events keep their clocks',()=>{
  const events=[audio('d','audio_ended','dialogue',10),audio('p','audio_ended','prompt',30),audio('c','operator_confirm',null,40),audio('a','audio_started','answer',70)];
  assert.equal(summarize({trials:[trial('suggestion')],events})[0].confirmMs,10);
  assert.equal(summarize({trials:[trial('direct')],events})[0].confirmMs,null);
  assert.equal(summarize({trials:[trial()],events:[...events,events[2]]})[0].events.length,4);
  events[2].payload.monotonicMs=null;assert.equal(summarize({trials:[trial()],events})[0].confirmMs,null);
});
test('Korean exports preserve provenance and escape user strings; session and after-end events are distinct',()=>{
  const input={trials:[{...trial(),scenario:'<img src=x onerror=alert(1)>'}],events:[e('n','note',{note:'=1+1'}),e('x','suspend',{reason:'reload'},{server_time:50000}),e('s','resume',{}, {trial_id:null}),e('a','applied')]};
  const rows=eventRows(input);assert.equal(rows.find(r=>r['이벤트 ID']==='x')['구간 (서버 저장 기준)'],'종료 후');assert.equal(rows.find(r=>r['이벤트 ID']==='s')['구간 (서버 저장 기준)'],'세션 기록');
  assert.match(toCsv(rows),/'=1\+1/);assert.ok(toCsv(rows).startsWith('\uFEFF'));assert.doesNotMatch(summaryHtml(input),/<img/);assert.match(summaryHtml(input),/&lt;img/);
  assert.doesNotMatch(timelineHtml(input),/iPad 화면 적용 확인/);assert.match(timelineHtml(input,'',true),/iPad 화면 적용 확인/);
  assert.equal(kst(1790493937258),'2026-09-27 16:25:37.258');assert.equal(kst('null'),'');
});


test('Reactive touch uses its own linked display metric and never becomes Cue reaction time',()=>{
  const input={trials:[trial('reactive')],events:[e('ready','reactive_ready',{cueId:'r'},{page_id:'ipad'}),e('touch','reactive_touch',{cueId:'r',displayEventId:'ready',accepted:true,reactionMs:750},{page_id:'ipad'})]};
  assert.equal(summarize(input)[0].reactiveMs,750);assert.equal(summarize(input)[0].cueMs,null);
  assert.equal(summaryRows(input)[0]['Reactive 터치 준비→첫 터치 (초·iPad)'],.75);
  input.events[1].payload.accepted=false;assert.equal(summarize(input)[0].reactiveMs,null);
});
