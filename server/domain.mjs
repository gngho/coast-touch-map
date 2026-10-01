import {validateConfig} from '../public/admin/schedule-model.js';
export const VERSION = '2.9.1';
export const RELATIONSHIPS = ['friend','partner','coworker'];
export const INTERVENTIONS = ['reactive','cue','suggestion','direct'];
export class Problem extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const requireThat = (ok,message,status=400)=>{if(!ok)throw new Problem(message,status);};
export function initialState(){return {mode:'setup',generation:0,trial:null,icon:'idle',cueId:null,touchReady:false,activation:null,touched:false,suspended:false,trialCount:0};}
export function transition(previous,action,data,context){
  const s=structuredClone(previous), now=context.now;
  const active=s.trial && ['prepared','running'].includes(s.trial.status);
  const event={type:action,payload:{}};
  const advance=()=>{s.generation++;};
  const idle=()=>{s.icon='idle';s.touchReady=false;};
  // Old stored sessions stay readable; new transitions never emit hidden.
  if(s.icon==='hidden')s.icon='idle';
  if(['show_cue','arm_reactive','set_icon','finish_audio','stop_audio'].includes(action)){
    if(data.runId)requireThat(s.audioRun?.id===data.runId&&s.audioRun.status==='running'&&s.trial?.id===data.trialId,'종료되었거나 이전 시행의 재생 명령입니다.',409);
    else requireThat(s.audioRun?.status!=='running','자동 재생 중에는 수동 상태를 변경할 수 없습니다.',409);
  }
  if(action==='reset_records'){
    requireThat(!active,'시행을 먼저 종료하거나 중단한 뒤 기록을 초기화해 주세요.',409);
    requireThat(data.confirmation==='초기화','확인란에 초기화를 입력해 주세요.');
    requireThat(data.expectedTrialCount===s.trialCount,'시행 수가 변경되었습니다. 초기화 창을 다시 열어 주세요.',409);
    const count=s.trialCount;
    Object.assign(s,initialState(),{generation:previous.generation+1,audioRun:null,resetGeneration:previous.generation+1,lastReset:{id:data.id,at:now,clearedTrials:count}});
  }else if(action==='complete_survey'){
    requireThat(!active,'현재 시나리오를 먼저 종료해 주세요.',409);
    advance();s.lastSurvey={planId:data.planId,participant:data.participant,blockPosition:data.blockPosition,completedAt:now};
    event.type='survey_completed';event.payload={...s.lastSurvey};
  }else if(action==='create_schedule'){
    requireThat(!active,'현재 시행을 먼저 종료하거나 중단해 주세요.',409);
    let config;try{config=validateConfig(data.config);}catch(e){throw new Problem(e.message);}
    s.schedule={id:data.id,count:config.participants.length,seed:config.seed};advance();
    event.type='schedule_created';event.payload={id:data.id,config,createdAt:now,appVersion:VERSION};
  }else if(action==='prepare'){
    requireThat(!active,'먼저 현재 시행을 종료하거나 중단해 주세요.',409);
    requireThat(typeof data.participant==='string' && /^[A-Za-z0-9_-]{1,40}$/.test(data.participant),'참가자 ID는 영문·숫자·밑줄·하이픈 1–40자로 입력해 주세요.');
    requireThat(RELATIONSHIPS.includes(data.relationship)&&INTERVENTIONS.includes(data.intervention),'조건을 선택해 주세요.');
    requireThat(typeof data.scenario==='string'&&data.scenario.length<=100,'시나리오 식별자는 100자 이하로 입력해 주세요.');
    s.trialCount++;s.trial={id:context.newId,number:s.trialCount,participant:data.participant,relationship:data.relationship,intervention:data.intervention,scenario:data.scenario,appVersion:VERSION,status:'prepared',preparedAt:now,startedAt:null,endedAt:null};
    if(data.schedule)s.trial.schedule=structuredClone(data.schedule);
    s.mode='experiment';s.suspended=false;s.cueId=null;s.activation=null;s.touched=false;s.audioRun=null;idle();advance();event.payload={...s.trial};
  }else if(action==='start'){
    requireThat(s.trial?.status==='prepared'&&!s.suspended,'준비된 시행이 필요합니다.',409);
    requireThat(context.applied,'iPad에 조건이 적용될 때까지 기다려 주세요.',409);
    s.trial.status='running';s.trial.startedAt=now;idle();advance();
  }else if(action==='end'||action==='abort'){
    requireThat(active,'진행 중인 시행이 없습니다.',409);
    if(action==='end'&&s.trial.schedule)requireThat(s.trial.status==='running','배정 시행은 시작 후 종료하거나, 시작 전에는 중단해 주세요.',409);
    s.trial.status=action==='end'?'ended':'aborted';s.trial.endedAt=now;if(s.audioRun?.status==='running')s.audioRun.status='stopped';idle();advance();
  }else if(action==='setup'||action==='unpair'){
    requireThat(!active,'현재 시행을 먼저 종료해 주세요.',409);
    s.mode='setup';s.suspended=false;s.cueId=null;s.activation=null;s.touched=false;idle();advance();
  }else if(action==='show_cue'||action==='arm_reactive'){
    const cue=action==='show_cue';
    requireThat(s.trial?.status==='running'&&s.trial.intervention===(cue?'cue':'reactive')&&!s.suspended,'현재 조건에서 터치를 준비할 수 없습니다.',409);
    requireThat(!s.cueId,'이 시행의 터치 기회는 이미 준비했습니다. 재실행은 새 시행으로 시작해 주세요.',409);
    s.cueId=context.newId;s.touched=false;s.touchReady=true;s.icon=cue?'twinkle':'idle';advance();event.payload={cueId:s.cueId,icon:s.icon};
  }else if(action==='set_icon'){
    requireThat(s.trial?.status==='running'&&!s.suspended,'진행 중인 시행에서만 변경할 수 있습니다.',409);
    requireThat(['idle','listening','thinking','speaking'].includes(data.icon),'잘못된 아이콘 상태입니다.');
    if(['reactive','cue'].includes(s.trial.intervention)&&['thinking','speaking'].includes(data.icon)){
      const a=s.activation;
      requireThat(s.touched&&a?.id&&a.cueId===s.cueId&&a.trialId===s.trial.id&&(!data.runId||a.runId===data.runId),'현재 시행의 참가자 터치가 먼저 필요합니다.',409);
    }
    s.touchReady=false;s.icon=data.icon;advance();event.payload={icon:data.icon};
  }else if(action==='finish_audio'||action==='stop_audio'){
    requireThat(data.runId&&s.audioRun?.status==='running','진행 중인 재생이 없습니다.',409);
    s.audioRun.status=action==='finish_audio'?'complete':'stopped';idle();advance();event.payload={runId:data.runId,icon:'idle'};
  }else if(action==='touch'){
    const reactive=s.trial?.intervention==='reactive';
    const accepted=s.trial?.id===data.trialId&&s.trial?.status==='running'&&['reactive','cue'].includes(s.trial.intervention)&&data.touchKind===(reactive?'reactive_ready':'cue_displayed')&&s.cueId===data.cueId&&s.touchReady&&!s.touched&&!s.suspended&&s.icon===(reactive?'idle':'twinkle')&&data.generation===s.generation;
    event.type=data.touchKind==='reactive_ready'?'reactive_touch':'cue_touch';event.payload={cueId:data.cueId,accepted,reactionMs:data.reactionMs,displayEventId:data.displayEventId};
    if(accepted){s.activation={id:context.eventId,at:now,pageId:data.pageId,trialId:s.trial.id,cueId:s.cueId,runId:s.audioRun?.id||null};s.touched=true;s.touchReady=false;s.icon=reactive?'listening':'thinking';advance();}
  }else if(action==='suspend'){
    s.suspended=true;if(s.audioRun?.status==='running')s.audioRun.status='stopped';idle();advance();event.payload={reason:data.reason,...(data.diagnostics?{diagnostics:data.diagnostics}:{})};
  }else if(action==='resume'){
    requireThat(s.suspended,'재개할 연결 중단이 없습니다.',409);
    s.suspended=false;idle();advance();event.payload={icon:'idle',touchWillRemainDisabled:true};
  }else if(action==='begin_audio'){
    requireThat(s.trial?.status==='running'&&!s.suspended,'진행 중인 시행이 필요합니다.',409);
    requireThat(!s.audioRun,'이 시행의 자동 재생은 이미 시작되었습니다. 재실행은 새 시행으로 준비해 주세요.',409);
    requireThat(!s.cueId,'이미 수동 Cue가 표시되었습니다. 자동 재생은 새 시행으로 시작해 주세요.',409);
    requireThat(typeof data.pageId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(data.pageId),'진행자 화면을 확인해 주세요.');
    requireThat(Number.isInteger(data.delayMs)&&data.delayMs>=0&&data.delayMs<=10000,'응답 대기는 0–10,000ms로 설정해 주세요.');
    const kinds=s.trial.intervention==='suggestion'?['dialogue','prompt','answer']:['dialogue','answer'];
    requireThat(data.assets&&kinds.every(k=>typeof data.assets[k]?.name==='string'&&data.assets[k].name.length<=255&&Number.isFinite(data.assets[k].duration)&&data.assets[k].duration>0&&/^[a-f0-9]{64}$/.test(data.assets[k].sha256)),'필요한 음원 파일을 선택해 주세요.');
    s.audioRun={id:data.id,pageId:data.pageId,trialId:s.trial.id,status:'running'};idle();advance();
    event.payload={...s.audioRun,delayMs:data.delayMs,assets:Object.fromEntries(kinds.map(k=>[k,data.assets[k]])),voiceInput:'operator_confirmation',output:'operator_pc'};
  }else if(action==='note'){
    requireThat(s.trial,'시행을 준비한 뒤 메모를 추가해 주세요.',409);
    requireThat(typeof data.note==='string'&&data.note.trim().length>0&&data.note.length<=2000,'메모는 1–2,000자로 입력해 주세요.');
    event.payload={note:data.note.trim()};
  }else throw new Problem('지원하지 않는 조작입니다.');
  return {state:s,event};
}
