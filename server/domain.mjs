export const VERSION = '2.1.0';
export const RELATIONSHIPS = ['friend','partner','coworker'];
export const INTERVENTIONS = ['reactive','cue','suggestion','direct'];
export class Problem extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const requireThat = (ok,message,status=400)=>{if(!ok)throw new Problem(message,status);};
export function initialState(){return {mode:'setup',generation:0,trial:null,icon:'hidden',cueId:null,touched:false,suspended:false,trialCount:0};}
export function transition(previous,action,data,context){
  const s=structuredClone(previous), now=context.now;
  const active=s.trial && ['prepared','running'].includes(s.trial.status);
  const event={type:action,payload:{}};
  const advance=()=>{s.generation++;};
  const hidden=()=>{s.icon='hidden';};
  if(action==='prepare'){
    requireThat(!active,'먼저 현재 시행을 종료하거나 중단해 주세요.',409);
    requireThat(typeof data.participant==='string' && /^[A-Za-z0-9_-]{1,40}$/.test(data.participant),'참가자 ID는 영문·숫자·밑줄·하이픈 1–40자로 입력해 주세요.');
    requireThat(RELATIONSHIPS.includes(data.relationship)&&INTERVENTIONS.includes(data.intervention),'조건을 선택해 주세요.');
    requireThat(typeof data.scenario==='string'&&data.scenario.length<=100,'시나리오 식별자는 100자 이하로 입력해 주세요.');
    s.trialCount++;s.trial={id:context.newId,number:s.trialCount,participant:data.participant,relationship:data.relationship,intervention:data.intervention,scenario:data.scenario,appVersion:VERSION,status:'prepared',preparedAt:now,startedAt:null,endedAt:null};
    s.mode='experiment';s.suspended=false;s.cueId=null;s.touched=false;s.audioRun=null;hidden();advance();event.payload={...s.trial};
  }else if(action==='start'){
    requireThat(s.trial?.status==='prepared'&&!s.suspended,'준비된 시행이 필요합니다.',409);
    requireThat(context.applied,'iPad에 조건이 적용될 때까지 기다려 주세요.',409);
    s.trial.status='running';s.trial.startedAt=now;hidden();advance();
  }else if(action==='end'||action==='abort'){
    requireThat(active,'진행 중인 시행이 없습니다.',409);
    s.trial.status=action==='end'?'ended':'aborted';s.trial.endedAt=now;hidden();advance();
  }else if(action==='setup'||action==='unpair'){
    requireThat(!active,'현재 시행을 먼저 종료해 주세요.',409);
    s.mode='setup';s.suspended=false;s.cueId=null;s.touched=false;hidden();advance();
  }else if(action==='show_cue'){
    requireThat(s.trial?.status==='running'&&s.trial.intervention==='cue'&&!s.suspended,'진행 중인 Cue 조건에서만 표시할 수 있습니다.',409);
    requireThat(!s.cueId,'이 시행의 Cue는 이미 표시했습니다. 재실행은 새 시행으로 시작해 주세요.',409);
    s.cueId=context.newId;s.touched=false;s.icon='idle';advance();event.payload={cueId:s.cueId};
  }else if(action==='set_icon'){
    requireThat(s.trial?.status==='running'&&s.trial.intervention==='cue'&&!s.suspended,'진행 중인 Cue 조건에서만 변경할 수 있습니다.',409);
    requireThat(['listening','thinking','speaking','hidden'].includes(data.icon),'잘못된 아이콘 상태입니다.');
    requireThat(data.icon==='hidden'||s.touched,'참가자의 Cue 터치 이후 상태를 변경해 주세요.',409);
    s.icon=data.icon;advance();event.payload={icon:data.icon};
  }else if(action==='touch'){
    const accepted=s.trial?.id===data.trialId&&s.trial?.status==='running'&&s.trial.intervention==='cue'&&s.cueId===data.cueId&&!s.touched&&!s.suspended&&s.icon==='idle'&&data.generation===s.generation;
    event.type='cue_touch';event.payload={cueId:data.cueId,accepted,reactionMs:data.reactionMs,displayEventId:data.displayEventId};
    if(accepted){s.touched=true;s.icon='listening';advance();}
  }else if(action==='suspend'){
    s.suspended=true;hidden();advance();event.payload={reason:data.reason};
  }else if(action==='resume'){
    requireThat(s.suspended,'재개할 연결 중단이 없습니다.',409);
    s.suspended=false;hidden();advance();event.payload={cueWillRemainHidden:true};
  }else if(action==='begin_audio'){
    requireThat(s.trial?.status==='running'&&!s.suspended,'진행 중인 시행이 필요합니다.',409);
    requireThat(!s.audioRun,'이 시행의 자동 재생은 이미 시작되었습니다. 재실행은 새 시행으로 준비해 주세요.',409);
    requireThat(!s.cueId,'이미 수동 Cue가 표시되었습니다. 자동 재생은 새 시행으로 시작해 주세요.',409);
    requireThat(typeof data.pageId==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(data.pageId),'진행자 화면을 확인해 주세요.');
    requireThat(Number.isInteger(data.delayMs)&&data.delayMs>=0&&data.delayMs<=10000,'응답 대기는 0–10,000ms로 설정해 주세요.');
    const kinds=s.trial.intervention==='suggestion'?['dialogue','prompt','answer']:['dialogue','answer'];
    requireThat(data.assets&&kinds.every(k=>typeof data.assets[k]?.name==='string'&&data.assets[k].name.length<=255&&Number.isFinite(data.assets[k].duration)&&data.assets[k].duration>0&&/^[a-f0-9]{64}$/.test(data.assets[k].sha256)),'필요한 음원 파일을 선택해 주세요.');
    s.audioRun={id:data.id,pageId:data.pageId,trialId:s.trial.id};advance();
    event.payload={...s.audioRun,delayMs:data.delayMs,assets:Object.fromEntries(kinds.map(k=>[k,data.assets[k]])),voiceInput:'operator_confirmation',output:'operator_pc'};
  }else if(action==='note'){
    requireThat(s.trial,'시행을 준비한 뒤 메모를 추가해 주세요.',409);
    requireThat(typeof data.note==='string'&&data.note.trim().length>0&&data.note.length<=2000,'메모는 1–2,000자로 입력해 주세요.');
    event.payload={note:data.note.trim()};
  }else throw new Problem('지원하지 않는 조작입니다.');
  return {state:s,event};
}
