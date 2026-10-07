// Derived views only: never alter observations or combine clocks across pages/devices.
export const relationships={friend:'친구',partner:'연인',coworker:'직장 관계'};
export const interventions={reactive:'RA',cue:'PC',suggestion:'PS',direct:'PD'};
const labels={survey_completed:'묶음 설문 완료',arm_reactive:'Reactive 터치 준비',reactive_ready:'iPad Reactive 터치 준비',reactive_touch:'Reactive 아이콘 터치',finish_audio:'재생 완료 · Idle',stop_audio:'재생 정지 · Idle',audio_connection_delayed:'재생 중 연결 응답 지연',audio_connection_restored:'재생 중 연결 응답 복구',schedule_created:'배정표 저장',prepare:'시행 준비',start:'시행 시작',end:'시행 종료',abort:'시행 중단',setup:'준비 모드 복귀',unpair:'iPad 연결 해제',show_cue:'Cue 표시 요청',set_icon:'아이콘 변경 요청',applied:'iPad 화면 적용 확인',cue_displayed:'iPad Cue 표시 기록',cue_touch:'Cue 첫 터치 기록',suspend:'안전 대기',resume:'연결 재개',note:'진행자 메모',connection_lost:'연결 끊김 감지',visibility_hidden:'iPad 화면 비활성',begin_audio:'자동 재생 시작 요청',audio_started:'PC 음원 재생 시작',audio_ended:'PC 음원 재생 종료',operator_confirm:'진행자 응답 확인',audio_flow_complete:'자동 재생 완료',audio_flow_stopped:'자동 재생 정지',audio_flow_error:'자동 재생 오류'};
const clips={chime:'AI 발화 전 알림음',cue_chime:'정보 제공 가능 알림음',dialogue:'동승자 대화',prompt:'AI 제안 질문',answer:'AI 최종 답변'};
const reasons={admin_recovery:'진행자 세션 복구',connection_gap:'연결 응답 지연',reload:'iPad 페이지 재진입',visibility:'iPad 화면 전환'};
const icons={idle:'Idle',twinkle:'Twinkle',listening:'Listening',thinking:'Thinking',speaking:'Speaking',hidden:'숨김 (이전 버전)'};
export const number=value=>value==null||value===''||value==='null'||!Number.isFinite(Number(value))?null:Number(value);
export const seconds=value=>number(value)==null?'':Number((Number(value)/1000).toFixed(3));
export const duration=value=>number(value)==null?'기록 없음':`${seconds(value).toFixed(3)}초`;
export function kst(value){
  if(value==null||value===''||value==='null')return '';
  const date=new Date(typeof value==='string'&&!/^\d+$/.test(value)?value:Number(value));
  if(!Number.isFinite(date.getTime()))return '';
  return new Date(date.getTime()+9*3600000).toISOString().replace('T',' ').replace('Z','');
}
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function detail(value){if(value&&typeof value==='object')return value;try{return JSON.parse(value)||{};}catch{return {};}}
export function normalize(data){return {trials:data.trials||[],events:[...new Map((data.events||[]).map(e=>[e.id,{...e,payload:detail(e.payload)}])).values()].sort((a,b)=>Number(a.server_time)-Number(b.server_time)||String(a.id).localeCompare(String(b.id)))};}
export function clockDelta(from,to){
  if(!from||!to||!from.page_id||from.page_id==='null'||from.page_id!==to.page_id||!from.payload.runId||from.payload.runId!==to.payload.runId)return null;
  const a=number(from.payload.monotonicMs),b=number(to.payload.monotonicMs);
  return a!=null&&b!=null&&b>=a?b-a:null;
}
export function phase(event,trial){
  if(!trial)return '세션 기록';
  const stamp=number(event.server_time),start=number(trial.started_at),end=number(trial.ended_at);
  if(event.type==='end'||event.type==='abort')return '종료 조작';
  if(end!=null&&stamp>end)return '종료 후';
  if(start==null||stamp<start)return '시작 전';
  return '시행 중';
}
export function describe(event){
  const p=event.payload;
  if(event.type==='survey_completed')return `${p.participant} · 묶음 ${p.blockPosition} 설문 완료 · 배정표 ${p.planId}`;
  if(event.type==='schedule_created')return `라틴스퀘어 배정표 저장 · ${p.config?.participants?.length||0}명 · 시드 ${p.config?.seed||''}`;
  if(event.type==='prepare')return `${p.participant||''} · ${relationships[p.relationship]||p.relationship||''} · ${interventions[p.intervention]||p.intervention||''} · ${p.scenario||'시나리오 미입력'}`;
  if(['cue_touch','reactive_touch'].includes(event.type))return `${p.accepted?'수락됨':'수락되지 않은 지연 기록'} · 표시 후 ${duration(p.reactionMs)}`;
  if(event.type==='begin_audio')return `설정 대기 ${duration(p.delayMs)} · ${Object.entries(p.assets||{}).map(([k,v])=>`${clips[k]||k}: ${v.name} (${Number(v.duration).toFixed(3)}초)`).join(' / ')}`;
  if(event.type==='operator_confirm')return `${p.source==='Space'?'Space 키':'확인 버튼'} · 진행자가 발화를 확인한 시점`;
  if(p.clip)return `${clips[p.clip]||p.clip}${p.asset?.name?' · '+p.asset.name:''}`;
  if(p.icon)return icons[p.icon]||p.icon;
  if(p.note)return p.note;
  if(p.reason)return (reasons[p.reason]||p.reason)+(p.cause?' · '+({connection_timeout:'10초 연결 확인 실패',participant_suspended:'참가자 화면 안전 대기',trial_changed:'시행 변경'}[p.cause]||p.cause):'');
  if(event.type.startsWith('audio_connection_'))return `PC 응답 경과 ${duration(p.localAgeMs)} · iPad 응답 경과 ${duration(p.peerAgeMs)} (관측값)`;
  if(p.message)return p.message;
  if(event.type==='cue_displayed')return 'iPad Cue 신호 표시 기록 (2.4부터 Twinkle). 물리적 발광 시점은 아님';
  if(event.type==='reactive_ready')return 'Idle 아이콘의 터치 입력을 받을 준비가 된 시점';
  if(event.type==='applied')return '화면 변경 적용 확인';
  return '';
}
export function summarize(input){
  const {trials,events}=normalize(input);
  return [...trials].sort((a,b)=>Number(a.number)-Number(b.number)).map(t=>{
    const es=events.filter(e=>e.trial_id===t.id),find=(type,clip)=>es.find(e=>e.type===type&&(!clip||e.payload.clip===clip));
    const start=number(t.started_at),end=number(t.ended_at),run=find('begin_audio');
    const confirm=find('operator_confirm');
    const antecedent=es.find(e=>e.type==='audio_ended'&&e.payload.clip===(t.intervention==='suggestion'?'prompt':'dialogue')&&clockDelta(e,confirm)!=null);
    const answer=es.find(e=>e.type==='audio_started'&&e.payload.clip==='answer'&&(!confirm||clockDelta(confirm,e)!=null));
    const touches=es.filter(e=>e.type==='cue_touch'&&e.payload.accepted===true);
    const touch=touches.find(e=>es.some(d=>d.id===e.payload.displayEventId&&d.type==='cue_displayed'&&d.page_id===e.page_id&&d.payload.cueId===e.payload.cueId)&&number(e.payload.reactionMs)!=null&&number(e.payload.reactionMs)>=0);
    const issues=es.filter(e=>['connection_lost','suspend','visibility_hidden','audio_flow_stopped','audio_flow_error','audio_connection_delayed'].includes(e.type));
    const issueText=prefix=>issues.filter(e=>phase(e,t)===prefix).map(e=>`${labels[e.type]}${e.payload.reason?' ('+(reasons[e.payload.reason]||e.payload.reason)+')':''}`).join(' / ');
    const before=issueText('시작 전'),during=issueText('시행 중'),after=issueText('종료 후');
    const reactiveTouch=es.find(e=>e.type==='reactive_touch'&&e.payload.accepted===true&&es.some(d=>d.id===e.payload.displayEventId&&d.type==='reactive_ready'&&d.page_id===e.page_id&&d.payload.cueId===e.payload.cueId));
    const reactiveMs=t.intervention==='reactive'&&reactiveTouch&&number(reactiveTouch.payload.reactionMs)>=0?number(reactiveTouch.payload.reactionMs):null;
    const cueMs=t.intervention==='cue'&&touch?number(touch.payload.reactionMs):null;
    const confirmMs=['reactive','suggestion'].includes(t.intervention)?clockDelta(antecedent,confirm):null;
    const delayMs=['reactive','suggestion'].includes(t.intervention)?clockDelta(confirm,answer):null;
    const warnings=[];
    if(start==null)warnings.push('시작 전 중단/미시작');
    if(t.status==='aborted')warnings.push('중단 시행');
    if(during)warnings.push('시행 중 연결/재생 기록 확인');
    if(before)warnings.push('시작 전 연결/화면 기록 있음');
    if(start!=null&&t.intervention==='cue'&&cueMs==null)warnings.push('유효 Cue 반응시간 없음');
    if(start!=null&&['reactive','suggestion'].includes(t.intervention)&&confirmMs==null)warnings.push('진행자 확인 간격 없음');
    if(touches.length>1)warnings.push('복수 수락 기록 확인');
    const audioComplete=!!find('audio_flow_complete');
    if(run&&!audioComplete)warnings.push('자동 재생 완료 기록 없음');
    return {trial:t,events:es,condition:`${relationships[t.relationship]||t.relationship} · ${interventions[t.intervention]||t.intervention}`,status:({prepared:'준비 완료',running:'진행 중',ended:'정상 종료',aborted:'중단'})[t.status]||t.status,reactiveMs,totalMs:start!=null&&end!=null&&end>=start?end-start:null,cueMs,confirmMs,delayMs,cueStatus:t.intervention!=='cue'?'해당 없음':touch?'첫 터치 수락':find('cue_displayed')?'표시됨 · 유효 터치 없음':'표시 기록 없음',audioStatus:audioComplete?'재생 완료':run?'완료 기록 없음':'재생 시작 기록 없음',delaySetting:number(run?.payload.delayMs),assets:run?.payload.assets||{},before,during,after,review:warnings.join(' / ')||'기록상 특이사항 없음',notes:es.filter(e=>e.type==='note').map(e=>e.payload.note).join(' / ')};
  });
}
export function summaryRows(input){return summarize(input).map(s=>({
  '시행 번호':s.trial.number,'참가자':s.trial.participant,'동승자 관계':relationships[s.trial.relationship]||s.trial.relationship,'개입 방식':interventions[s.trial.intervention]||s.trial.intervention,'시나리오':s.trial.scenario,'결과':s.status,
  '시작 시각 (KST·서버)':kst(s.trial.started_at),'종료 시각 (KST·서버)':kst(s.trial.ended_at),'전체 시행 시간 (초)':seconds(s.totalMs),
  'Reactive 터치 준비→첫 터치 (초·iPad)':seconds(s.reactiveMs),'Cue 표시→첫 터치 (초·iPad)':seconds(s.cueMs),'Cue 상태':s.cueStatus,
  '진행자 확인까지 (초·PC)':seconds(s.confirmMs),'확인 간격 기준':s.trial.intervention==='reactive'?'동승자 대화 종료→진행자 확인 (2.4부터 터치 대기 포함)':s.trial.intervention==='suggestion'?'AI 제안 종료→진행자 확인':'해당 없음',
  '진행자 확인→답변 재생 (초·PC)':seconds(s.delayMs),'설정 응답 대기 (초)':seconds(s.delaySetting),'음원 재생':s.audioStatus,
  '동승자 대화 파일':s.assets.dialogue?.name||'','AI 제안 파일':s.assets.prompt?.name||'','AI 답변 파일':s.assets.answer?.name||'',
  '시작 전 주의 기록':s.before,'시행 중 주의 기록':s.during,'종료 후 주의 기록':s.after,'검토 사항':s.review,'메모':s.notes,'시행 ID':s.trial.id,'앱 버전':s.trial.app_version,
  ...allocationColumns(s.events.find(e=>e.type==='prepare')?.payload.schedule)
}));}
function allocationColumns(ref){return {'배정 선택 방식':ref?.selection||'next','수동 선택 사유':ref?.reason||'','이전 시행 ID':(ref?.previousAttemptIds||[]).join(';'),'선택 당시 다음 순서':ref?.expectedNextPosition??'','조건 묶음 순서':ref?.blockPosition??'','묶음 내 시나리오 순서':ref?.episodePosition??'','시나리오군':ref?.family||'','시나리오 유형':ref?.subtype||'','묶음 내 배정 순서':ref?.pairOrder||'','배정표 ID':ref?.planId||'','참가자 내 배정 순서':ref?.position??'','라틴 행':ref?.row??'','배정 블록':ref?.block??'','POI 사례':({restaurant:'식당',museum:'박물관',cafe:'카페',weather:'날씨',road:'도로'})[ref?.poi]||'','배정 시드':ref?.seed||'','배정 방식':ref?.design||''};}
export function eventRows(input){const {trials,events}=normalize(input),byId=new Map(trials.map(t=>[t.id,t]));return events.map(e=>{const t=byId.get(e.trial_id);return {
  '시행 번호':t?.number||'','참가자':t?.participant||'','동승자 관계':relationships[t?.relationship]||'','개입 방식':interventions[t?.intervention]||'','시나리오':t?.scenario||'',
  '구간 (서버 저장 기준)':phase(e,t),'서버 저장 시각 (KST)':kst(e.server_time),'기기 기록 시각 (KST·기기간 비교 금지)':kst(e.client_time),
  '이벤트':labels[e.type]||e.type,'내용':describe(e),'기록 주체':({admin:'PC 진행자',device:'iPad',system:'서버'})[e.actor]||e.actor,
  'Reactive 첫 터치 대기 (초)':e.type==='reactive_touch'&&e.payload.accepted===true?seconds(e.payload.reactionMs):'',
  'Cue 반응시간 (초)':e.type==='cue_touch'&&e.payload.accepted===true?seconds(e.payload.reactionMs):'',
  '원본 이벤트 종류':e.type,'이벤트 ID':e.id,'시행 ID':t?.id||'','기기 페이지 ID':e.page_id==='null'?'':e.page_id,'재생 실행 ID':e.payload.runId||'','기기 경과 시각 (ms)':number(e.payload.monotonicMs)??''
};});}
export function toCsv(rows){if(!rows.length)return '\uFEFF';const cols=Object.keys(rows[0]);const cell=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\uFEFF'+[cols,...rows.map(r=>cols.map(c=>r[c]))].map(r=>r.map(cell).join(',')).join('\r\n');}
export const measurementNote='Cue는 Twinkle 표시→첫 터치, Reactive는 터치 준비→첫 터치를 iPad에서 각각 측정합니다. 2.4 이전 Cue 표시는 Idle 애니메이션이었습니다. 진행자 확인 간격은 발화와 진행자 판단 시간을 포함하므로 Cue 반응시간과 직접 비교하지 마세요. 빈 수치는 미측정 또는 해당 없음이며 0초가 아닙니다. 시각은 한국 표준시(KST), 이벤트 순서와 구간은 서버 저장 기준입니다. 기기별 시계 차이·전송 지연 때문에 실제 발생 순서와 다를 수 있습니다.';
export function summaryHtml(input){const summaries=summarize(input);if(!summaries.length)return '<p>저장된 시행이 없습니다.</p>';return `<div class="report-table-wrap" tabindex="0" aria-label="시행 요약 표"><table class="report-table"><thead><tr>${['시행 / 참가자','조건 / 시나리오','결과 / 전체 시간','아이콘 첫 터치','진행자 확인까지','음원','검토 사항'].map(c=>`<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${summaries.map(s=>`<tr><td><strong>${escape(s.trial.number)} · ${escape(s.trial.participant)}</strong></td><td>${escape(s.condition)}<small>${escape(s.trial.scenario||'미입력')}</small></td><td>${escape(s.status)}<small>${s.totalMs==null?'미시작/미종료':duration(s.totalMs)}</small></td><td>${s.trial.intervention==='cue'?escape(duration(s.cueMs)):s.trial.intervention==='reactive'?escape(duration(s.reactiveMs)):'해당 없음'}<small>${s.trial.intervention==='reactive'?'Reactive 터치 준비 기준':escape(s.cueStatus)}</small></td><td>${['reactive','suggestion'].includes(s.trial.intervention)?escape(duration(s.confirmMs)):'해당 없음'}<small>${s.trial.intervention==='reactive'?'대화 종료 기준':s.trial.intervention==='suggestion'?'제안 종료 기준':''}</small></td><td>${escape(s.audioStatus)}</td><td>${escape(s.review)}</td></tr>`).join('')}</tbody></table></div>`;}
export function timelineHtml(input,trialId='',technical=false){const rows=eventRows(input).filter(r=>(!trialId||r['시행 ID']===trialId)&&(technical||r['원본 이벤트 종류']!=='applied'));return `<ol class="report-timeline">${rows.map(r=>`<li><div><time>${escape(r['서버 저장 시각 (KST)'])}</time><small>${r['시행 번호']?'시행 '+escape(r['시행 번호']):'세션'} · ${escape(r['구간 (서버 저장 기준)'])}</small></div><div><strong>${escape(r['이벤트'])}</strong><p>${escape(r['내용'])}</p></div></li>`).join('')}</ol>`;}
