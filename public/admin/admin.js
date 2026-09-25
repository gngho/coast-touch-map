import {load,save,request,endpoint} from '/sync.js';
import {createNotice} from './notice.js';
const $=id=>document.getElementById(id);
const relations={friend:'친구',partner:'연인',coworker:'직장동료'},methods={reactive:'Reactive',cue:'Proactive cue',suggestion:'Proactive suggestion',direct:'Proactive direct'};
const icons={hidden:'숨김',idle:'Cue 대기',listening:'Listening',thinking:'Thinking',speaking:'Speaking'};
const statuses={prepared:'준비 완료',running:'진행 중',ended:'종료',aborted:'중단'};
const eventLabels={prepare:'시행 준비',start:'시행 시작',end:'시행 종료',abort:'시행 중단',setup:'준비 모드 복귀',show_cue:'Cue 표시 요청',set_icon:'아이콘 상태 변경',applied:'iPad 화면 적용',cue_displayed:'iPad Cue 표시',cue_touch:'Cue 터치',suspend:'안전 대기',resume:'연결 재개',note:'메모',connection_lost:'연결 끊김',visibility_hidden:'iPad 화면 비활성'};
let auth=load('coast.admin.v2'),snapshot=null,busy=false,lastSuccess=0,codeExpiry=0,pollBusy=false;
const messages=createNotice($('notice'));
const notice=messages.show;
function render(){
  const s=snapshot?.state,t=s?.trial,connected=snapshot?.deviceConnected&&performance.now()-lastSuccess<3000,active=t&&['prepared','running'].includes(t.status),ready=connected&&!busy,control=ready&&!s?.suspended;
  $('connection-status').textContent=connected?(s.suspended?'iPad 연결됨 · 재개 대기':'iPad 연결됨'):'iPad 연결 확인 필요';
  $('connection-detail').textContent=s?.suspended?'재개해도 이전 Cue는 다시 나타나지 않습니다.':connected?'진행자 명령과 참가자 화면의 적용 여부를 구분해 표시합니다.':'iPad에서 Coast를 열어 두세요. 연결이 확인될 때까지 조작이 잠깁니다.';
  $('create-code').disabled=!auth||busy; $('pair-code-area').hidden=!!snapshot?.paired;
  $('recover').hidden=!!auth;$('unpair').hidden=!snapshot?.paired;$('unpair').disabled=!!active||busy;
  $('resume').hidden=!s?.suspended;$('resume').disabled=!ready;
  $('trial-fields').disabled=!!active||busy;
  $('prepare').disabled=!ready||!!active;
  $('start').disabled=!control||t?.status!=='prepared'||!snapshot?.applied;
  $('end').disabled=!control||!active;
  $('abort').disabled=!auth||busy||!active;
  $('setup').disabled=!control||!!active||s?.mode==='setup';
  const cue=control&&t?.status==='running'&&t.intervention==='cue';
  $('show-cue').disabled=!cue||!!s?.cueId;
  document.querySelectorAll('[data-icon]').forEach(b=>{b.disabled=!cue||(b.dataset.icon!=='hidden'&&!s?.touched);b.classList.toggle('selected',s?.icon===b.dataset.icon);});
  $('save-note').disabled=!t||busy;$('note').disabled=!t||busy;
  $('trial-number').textContent=t?`시행 ${String(t.number).padStart(2,'0')}`:'새 시행';
  $('trial-status').textContent=s?.mode==='setup'?'준비 모드':statuses[t?.status]||'대기';
  $('current-condition').textContent=t?`${relations[t.relationship]} · ${methods[t.intervention]}`:'조건을 선택해 주세요';
  $('current-participant').textContent=t?`${t.participant}${t.scenario?' / '+t.scenario:''}`:'시행을 준비하면 적용 상태를 확인할 수 있습니다.';
  $('applied').textContent=!connected?'확인 불가':snapshot?.applied?'적용 완료':'명령 전달 중';
  $('touched').textContent=t?.intervention==='cue'?(s?.touched?'터치됨':s?.cueId?'터치 대기':'표시 전'):'해당 없음';
  $('pending').textContent=!connected?'확인 불가':`${snapshot?.pendingEvents||0}건`;
  $('icon-state').textContent=icons[s?.icon]||'숨김';$('preview-icon').hidden=!s||s.icon==='hidden';$('preview-hidden').hidden=!!s&&s.icon!=='hidden';
  document.querySelectorAll('[data-export]').forEach(b=>b.disabled=!auth||busy);
  if(snapshot?.recentEvents){$('events').replaceChildren(...snapshot.recentEvents.map(e=>{const li=document.createElement('li'),time=document.createElement('time'),span=document.createElement('span');time.textContent=new Date(e.server_time).toLocaleTimeString('ko-KR',{hour12:false});let payload;try{payload=JSON.parse(e.payload);}catch{payload={};}span.textContent=(eventLabels[e.type]||e.type)+(payload.icon?' · '+icons[payload.icon]:'')+(e.type==='note'?' · '+payload.note:'')+(e.type==='cue_touch'?` · ${payload.accepted?'수락':'지연 기록'} · ${Math.round(payload.reactionMs)} ms`:'');li.append(time,span);return li;}));}
}
async function command(action,extra={}){
  if(busy||!auth||!snapshot)return;busy=true;render();
  const data={id:crypto.randomUUID(),action,baseGeneration:snapshot.state.generation,...extra};
  try{snapshot=await request(endpoint(auth,'command'),{auth,method:'POST',data});notice('명령을 저장했습니다. iPad의 적용 확인을 기다립니다.');}
  catch(error){messages.error(error);}
  finally{busy=false;render();}
}
$('trial-form').onsubmit=e=>{e.preventDefault();command('prepare',{participant:$('participant').value.trim(),relationship:$('relationship').value,intervention:$('intervention').value,scenario:$('scenario').value.trim()});};
for(const [id,action] of [['start','start'],['end','end'],['abort','abort'],['setup','setup'],['show-cue','show_cue'],['resume','resume']])$(id).onclick=()=>command(action);
document.querySelectorAll('[data-icon]').forEach(b=>b.onclick=()=>command('set_icon',{icon:b.dataset.icon}));
$('note-form').onsubmit=async e=>{e.preventDefault();const value=$('note').value;if(value.trim())await command('note',{note:value});};
$('create-code').onclick=async()=>{try{const result=await request(endpoint(auth,'code'),{auth,method:'POST',data:{}});$('code').textContent=result.code;codeExpiry=result.expires;notice('iPad의 설정 → 진행자 PC 연결에 코드를 입력하세요.');}catch(error){messages.error(error);}};
$('unpair').onclick=async()=>{await command('unpair');$('code').textContent='';codeExpiry=0;};
$('recover').onclick=async()=>{try{const result=await request('/api/recover',{method:'POST',data:{}});auth={id:result.id,token:result.adminToken};save('coast.admin.v2',auth);snapshot=result;notice('세션을 복구했습니다. iPad 연결을 확인한 뒤 재개하세요.');}catch(error){messages.error(error);}render();};
document.querySelectorAll('[data-export]').forEach(button=>button.onclick=async()=>{
  try{const format=button.dataset.export==='json'?'json':'csv',kind=button.dataset.export;const response=await fetch(endpoint(auth,`export?format=${format}&kind=${kind}`),{cache:'no-store',headers:{'X-Coast-Token':auth.token,'X-Coast-Role':'admin'}});if(!response.ok)throw Error('로그를 내려받지 못했습니다.');const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=`coast-${kind}-${new Date().toISOString().slice(0,10)}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('서버에 저장된 로그를 내보냈습니다. 미전송 로그가 0건인지 확인하세요.');}catch(error){notice(error.message,true);}
});
async function boot(){
  render();try{if(!auth){const result=await request('/api/session',{method:'POST',data:{}});auth={id:result.id,token:result.adminToken};save('coast.admin.v2',auth);snapshot=result;}notice('iPad 연결 후 조건을 준비하세요.');}catch(error){messages.error(error);}
  poll();
}
async function poll(){
  if(pollBusy)return;pollBusy=true;
  try{if(!auth||busy)return;const next=await request(endpoint(auth,'state'),{auth});if(!snapshot||next.state.generation>=snapshot.state.generation)snapshot=next;lastSuccess=performance.now();messages.connectionRestored();}
  catch(error){messages.error(error);if(error.status===403){auth=null;localStorage.removeItem('coast.admin.v2');}}
  finally{pollBusy=false;render();setTimeout(poll,250);}
}
setInterval(()=>{render();if(codeExpiry)$('code-expiry').textContent=Date.now()<codeExpiry?`유효 시간 ${Math.ceil((codeExpiry-Date.now())/1000)}초`:'코드가 만료되었습니다. 다시 생성하세요.';},1000);
boot();
