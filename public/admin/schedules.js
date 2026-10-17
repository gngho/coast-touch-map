import {endpoint} from '/sync.js';
import {requestSchedule,retryableRead} from './schedule-request.js';
import {DESIGN,DESIGN_NOTE,CASE_LABELS,validateConfig,planProgress,designInfo,RELATION_CODES,METHOD_CODES} from './schedule-model.js';
const scenarioId=step=>step.subtype||step.poi;
import {escape,toCsv,kst,relationships,interventions} from './report-model.js';
const poiLabels=CASE_LABELS,statusLabels={complete:'완료',active:'준비/진행 중',retry:'중단 · 재시도 필요',pending:'대기'};
export function initSchedules({getAuth,getSnapshot,command,isBusy,isConnected,diagnostic=()=>{}}){
  const $=id=>document.getElementById(id);let plans=[],preview=null,loading=false,loadedKey=null,revision=0,inflight=null,preferredPlan=null,nextRetryAt=0,observedAuth=null;
  const stateKey=()=>{const s=getSnapshot()?.state;return `${getAuth()?.id||''}|${s?.resetGeneration||0}|${s?.trial?.id||''}|${s?.trial?.status||''}|${s?.schedule?.id||''}|${s?.lastSurvey?.completedAt||''}`;};
  const stale=()=>loadedKey!==stateKey();
  $('schedule-note').textContent=DESIGN_NOTE;$('schedule-seed').value=crypto.randomUUID().slice(0,8);
  const current=()=>preview||plans.find(p=>p.id===$('schedule-plan').value);
  const selected=()=>current()?.participants.find(p=>p.participant===$('schedule-person').value);
  function fillIds(){const count=Number($('schedule-count').value),start=Number($('schedule-first').value),prefix=$('schedule-prefix').value.trim();
    if(!Number.isInteger(count)||count<1||count>120||!Number.isInteger(start)||start<1||start>999999)throw Error('인원은 1–120명, 시작 번호는 1–999999로 입력하세요.');
    $('schedule-ids').value=Array.from({length:count},(_,i)=>prefix+String(start+i).padStart(3,'0')).join('\n');
  }
  function config(){return validateConfig({design:DESIGN,seed:$('schedule-seed').value.trim(),participants:$('schedule-ids').value.trim().split(/\s+/).filter(Boolean)});}
  function message(text){$('schedule-status').textContent=text;}
  function showPeople(){const keep=$('schedule-person').value;const p=current();$('schedule-person').replaceChildren(...(p?.participants||[]).map(x=>new Option(`${x.participant} · ${x.completed}/${x.steps.length} 시나리오 완료${x.blocks?` · 설문 ${x.completedBlocks}/${x.blocks.length}`:""}`,x.participant)));if(p?.participants.some(x=>x.participant===keep))$('schedule-person').value=keep;show();}
  function show(){const p=current(),person=selected();$('schedule-note').textContent=p?designInfo(p.config.design).note:DESIGN_NOTE;$('schedule-view').hidden=!p;
    if(!p||!person){$('schedule-table').replaceChildren();update();return;}
    $('schedule-info').textContent=`${preview?'저장 전 미리보기':'서버 저장됨'} · ${p.config.participants.length}명 · ${person.steps.length}회${person.blocks?`/설문 ${person.blocks.length}회`:""} · 시드 ${p.config.seed} · 참가자 배정 ${person.allocationIndex}번 · ${person.block}블록 / 행 ${person.row} / 사례 ${person.caseVariant}${p.config.participants.length%designInfo(p.config.design).cycle?' · 마지막 불완전 블록은 조건 순서 균형이 완성되지 않습니다.':''}`;
    $('schedule-table').innerHTML=`<div class="report-table-wrap"><table class="report-table"><thead><tr>${['시나리오 순서 / 묶음','동승자','AI 개입 방식','시나리오 유형','시나리오 식별자','실제 시행 / 설문 상태','직접 선택'].map(s=>`<th scope="col">${s}</th>`).join('')}</tr></thead><tbody>${person.steps.map(s=>`<tr${s.position===person.nextPosition?' class="schedule-next-row"':''}><td>${s.position}${s.position===person.nextPosition?' · 다음':''}${s.blockPosition?`<small>묶음 ${s.blockPosition}/${person.blocks.length} · ${s.episodePosition}/2</small>`:''}</td><td>${RELATION_CODES[s.relationship]}</td><td>${METHOD_CODES[s.intervention]}</td><td>${s.family?`${s.family==='place'?'장소':'정보'} / `:''}${poiLabels[s.poi]}</td><td>${escape(scenarioId(s))}</td><td>${statusLabels[s.status]}<small>${s.attempts.map(a=>`시행 ${a.number}${a.selection==='manual'?' · 수동':''} (${({ended:'종료',aborted:'중단',prepared:'준비',running:'진행'})[a.status]})`).join(', ')||'아직 시행하지 않음'}</small>${s.episodePosition===2?`<small>묶음 설문: ${person.blocks[s.blockPosition-1].surveyCompleted?'완료':person.pendingSurvey===s.blockPosition?'진행 후 완료 확인 필요':'대기'}</small>`:''}</td><td><button type="button" data-schedule-position="${s.position}">${s.attempts.length?'재시행 준비':'선택 준비'}</button></td></tr>`).join('')}</tbody></table></div>`;
    update();
  }
  function update(){const state=getSnapshot()?.state,active=['prepared','running'].includes(state?.trial?.status),person=selected();
    if(observedAuth!==getAuth()?.token){observedAuth=getAuth()?.token;loadedKey=null;nextRetryAt=0;}
    $('schedule-save').disabled=!getAuth()||loading||isBusy()||active;
    $('schedule-load').disabled=!getAuth()||loading;
    $('schedule-next').disabled=!!preview||stale()||!current()||!person?.nextPosition||loading||isBusy()||active||!isConnected()||!!state?.suspended;
    $('schedule-next').textContent=person?.pendingSurvey?`묶음 ${person.pendingSurvey} 설문 대기`:person?.nextPosition?`다음 시나리오 준비 · ${person.nextPosition}/${person.steps.length}`:'배정 시행 모두 완료';
    $('schedule-survey').hidden=!person?.pendingSurvey;
    $('schedule-survey').disabled=!!preview||stale()||loading||isBusy()||active||!person?.pendingSurvey;
    $('schedule-survey').textContent=`묶음 ${person?.pendingSurvey||''} 설문 완료 확인`;
    $('schedule-csv').disabled=!current();
    document.querySelectorAll('[data-schedule-position]').forEach(button=>{button.disabled=!!preview||stale()||loading||isBusy()||active||!isConnected()||!!state?.suspended;});
    if(stale()&&$('schedule-section').open&&!preview&&!loading&&!isBusy()&&Date.now()>=nextRetryAt)void refresh();
  }
  function refresh(preferred,force=false){
    if(preferred)preferredPlan=preferred;
    if(loading)return inflight;
    if(!getAuth())return Promise.resolve(false);
    if(!force&&!stale()&&(!preferred||preferred===$('schedule-plan').value))return Promise.resolve(true);
    const selectedPlan=preferred||$('schedule-plan').value;
    const scoped=!force&&plans.some(p=>p.id===selectedPlan)&&plans.some(p=>p.id===getSnapshot()?.state?.schedule?.id||!getSnapshot()?.state?.schedule?.id)?selectedPlan:null;
    loading=true;nextRetryAt=0;const v=revision,key=stateKey(),auth=getAuth();loadedKey=null;update();message('배정표 진행 상태를 확인하고 있습니다…');
    inflight=(async()=>{try{
      const result=await requestSchedule(endpoint(auth,'schedule')+(scoped?'?planId='+encodeURIComponent(scoped):''),{auth,isCurrent:()=>v===revision&&auth.token===getAuth()?.token&&!preview,onRetry:detail=>{diagnostic('schedule_retry',detail);message('배정표 응답 지연 · 자동으로 다시 확인하고 있습니다…');}});
      if(v!==revision||auth.token!==getAuth()?.token||preview)return false;
      if(key!==stateKey()){message('시행 상태가 변경되어 최신 배정표를 다시 확인합니다…');return false;}
      plans=scoped?[...plans.filter(p=>p.id!==scoped),...result.plans].sort((a,b)=>a.createdAt-b.createdAt):result.plans;preview=null;const keep=preferred||$('schedule-plan').value||getSnapshot()?.state?.trial?.schedule?.planId||getSnapshot()?.state?.schedule?.id;
      $('schedule-plan').replaceChildren(...plans.map((p,i)=>new Option(`배정표 ${i+1} · ${p.config.participants.length}명 · ${p.config.seed} · ${kst(p.createdAt).slice(0,16)}`,p.id)));
      const wanted=preferredPlan||keep;preferredPlan=null;
      $('schedule-plan').value=plans.some(p=>p.id===wanted)?wanted:plans.at(-1)?.id||'';
      loadedKey=key;nextRetryAt=0;
      showPeople();message(plans.length?'배정표와 실제 시행 진행 상태를 불러왔습니다.':'저장된 배정표가 없습니다. 참가자 ID를 확인하고 저장하세요.');
      return true;
    }catch(e){if(v!==revision||auth.token!==getAuth()?.token||preview)return false;
      diagnostic('schedule_error',e);nextRetryAt=retryableRead(e)?Date.now()+5000:Infinity;
      message('배정표 최신 상태 확인 실패: '+e.message+(retryableRead(e)?' 기존 표를 유지하고 잠시 후 자동 재조회합니다.':' 다시 로그인하거나 배정표 다시 불러오기를 눌러 주세요.'));return false;
    }finally{loading=false;inflight=null;update();}})();return inflight;
  }
  $('schedule-fill').onclick=()=>{try{fillIds();message('ID 목록을 채웠습니다. 미리보기 후 저장하세요.');}catch(e){message(e.message);}};
  $('schedule-preview').onclick=()=>{try{const c=config();preview={config:c,participants:planProgress(c)};showPeople();message('미리보기입니다. 서버에 저장해야 시행을 준비할 수 있습니다.');}catch(e){message(e.message);}};
  $('schedule-form').onsubmit=async e=>{e.preventDefault();if($('schedule-save').disabled)return;
    try{const c=config();preview={config:c,participants:planProgress(c)};showPeople();const result=await command('create_schedule',{config:c},true);preview=null;await refresh(result.state.schedule.id);}catch(error){message(error.message);}
  };
  $('schedule-load').onclick=()=>refresh(undefined,true);$('schedule-plan').onchange=()=>{preview=null;revision++;loadedKey=null;nextRetryAt=0;showPeople();void refresh();};$('schedule-person').onchange=show;
  $('schedule-section').addEventListener('toggle',()=>{if($('schedule-section').open&&!preview)void refresh();});
  async function prepareStep(position,manual=false){
    const plan=current(),person=selected(),step=person?.steps.find(s=>s.position===position);
    if(!plan||!step||preview||stale()||loading||isBusy())return;
    const state=getSnapshot()?.state;
    if(['prepared','running'].includes(state?.trial?.status)||!isConnected()||state?.suspended)return;
    // Invalidate old audio assets through the normal condition-change event.
    $('participant').value=person.participant;
    for(const [id,value] of Object.entries({relationship:step.relationship,intervention:step.intervention,scenario:scenarioId(step)}))$(id).value=value;
    $('scenario').dispatchEvent(new Event('change',{bubbles:true}));
    const schedule={planId:plan.id,position:step.position};
    if(manual){schedule.selection='manual';schedule.reason=$('schedule-reason').value.trim();}
    try{await command('prepare',{participant:person.participant,relationship:step.relationship,intervention:step.intervention,scenario:step.scenario,schedule},true);
      if(await refresh(plan.id))message(person.participant+' · 순서 '+step.position+(manual?' 수동 선택':'')+' 조건을 준비했습니다. 음원을 다시 선택하고 iPad 적용 확인 후 시작하세요.');
      else message('시행 준비는 서버에 저장됐습니다. 배정표 최신 상태를 다시 확인 중입니다. 같은 시나리오를 중복 준비하지 마세요.');
    }catch(error){message(error.message);}
  }
  $('schedule-next').onclick=()=>{if(!$('schedule-next').disabled)void prepareStep(selected()?.nextPosition);};
  $('schedule-table').addEventListener('click',event=>{
    const button=event.target.closest('[data-schedule-position]');
    if(button&&!button.disabled)void prepareStep(Number(button.dataset.schedulePosition),true);
  });
  $('schedule-survey').onclick=async()=>{
    if($('schedule-survey').disabled)return;
    const plan=current(),person=selected();
    try{await command('complete_survey',{planId:plan.id,participant:person.participant,blockPosition:person.pendingSurvey},true);if(await refresh(plan.id))message('묶음 설문 완료를 기록했습니다. 다음 조건을 진행할 수 있습니다.');else message('묶음 설문 완료는 서버에 저장됐습니다. 배정표 최신 상태를 다시 확인 중입니다.');}catch(e){message(e.message);}
  };
  $('schedule-csv').onclick=()=>{const plan=current();if(!plan)return;const rows=plan.participants.flatMap(p=>p.steps.map(s=>({'참가자':p.participant,'참가자 배정 번호':p.allocationIndex,'블록':p.block,'라틴 행':p.row,'사례 변형':p.caseVariant,'참가자 내 순서':s.position,'조건 코드':s.condition,'동승자 관계':relationships[s.relationship],'개입 방식':interventions[s.intervention],'묶음 순서':s.blockPosition||'','묶음 내 순서':s.episodePosition||'','시나리오군':s.family==='place'?'장소':s.family==='information'?'정보':'','시나리오 유형':poiLabels[s.poi],'묶음 내 배정 순서':s.pairOrder||'','묶음 설문 완료':s.blockPosition?(p.blocks[s.blockPosition-1].surveyCompleted?'완료':'대기'):'','설문 완료 시각':s.blockPosition?kst(p.blocks[s.blockPosition-1].surveyAt):'','시나리오':scenarioId(s),'저장된 원본 식별자':s.scenario,'수동 선택 시행 번호':s.attempts.filter(a=>a.selection==='manual').map(a=>a.number).join(';'),'수동 선택 사유':s.attempts.filter(a=>a.selection==='manual').map(a=>a.number+': '+(a.reason||'')).join(';'),'진행 상태':statusLabels[s.status],'실제 시행 번호':s.attempts.map(a=>a.number).join(';'),'배정 시드':plan.config.seed,'배정 방식':plan.config.design,'배정표 ID':plan.id||'미저장'})));
    const url=URL.createObjectURL(new Blob([toCsv(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`coast-allocation-${plan.config.seed}-${kst(Date.now()).slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  fillIds();return {update,clear(){revision++;loadedKey=null;nextRetryAt=0;preferredPlan=null;plans=[];preview=null;$('schedule-plan').replaceChildren();showPeople();message('기록 초기화로 배정표도 초기화되었습니다.');}};
}
