// Fixed stimuli only. No microphone, speech recognition, or generated answers.
import {cueDelay} from '../cue-timing.js';
export class AudioFlow {
  constructor({claim,command,play,chime,stop,log,changed,now=()=>performance.now(),wait=ms=>new Promise(r=>setTimeout(r,ms))}) {
    Object.assign(this,{claim,command,play,chime,stop,log,changed,wait,now});
    this.phase='idle';this.run=null;this.epoch=0;this.snapshot=null;this.connected=false;this.message='음원 선택 후 시행을 시작하세요.';
  }
  get active(){return !['idle','complete','stopped','error'].includes(this.phase);}
  get hasTouch(){
    const s=this.snapshot?.state,a=s?.activation;
    return !!(this.armedCueId&&s?.touched===true&&s.trial?.id===this.run?.trialId&&s.audioRun?.id===this.run?.id&&s.cueId===this.armedCueId&&a?.id&&a.pageId&&a.cueId===this.armedCueId&&a.trialId===this.run.trialId&&a.runId===this.run.id);
  }
  get canConfirm(){return this.phase==='response_wait'&&this.ready&&!this.snapshot?.state.suspended&&(this.run?.intervention!=='reactive'||this.hasTouch);}
  set(phase,message){this.phase=phase;this.message=message;this.changed();}
  update(snapshot,connected,ready=connected,diagnostics={}){
    const wasReady=this.ready;this.snapshot=snapshot;this.connected=connected;this.ready=ready;this.diagnostics=diagnostics;
    if(this.active&&(!connected||snapshot?.state.suspended||(this.claimed&&(snapshot?.state.audioRun?.id!==this.run?.id||snapshot.state.audioRun?.status==='stopped'))||snapshot?.state.trial?.id!==this.run?.trialId||snapshot.state.trial.status!=='running')){
      const cause=!connected?'connection_timeout':snapshot?.state.suspended?'participant_suspended':'trial_changed';
      const reason={connection_timeout:'10초 이상 연결 확인이 되지 않아 자동 재생을 멈췄습니다.',participant_suspended:'iPad가 안전 대기 상태로 전환되어 자동 재생을 멈췄습니다. 화면 이탈·재접속 기록을 확인해 주세요.',trial_changed:'현재 시행이 종료·중단되거나 다른 시행으로 바뀌어 자동 재생을 멈췄습니다.'}[cause];
      this.cancel(reason,{cause,...diagnostics});return;
    }
    if(this.active&&this.claimed&&wasReady!==undefined&&wasReady!==ready)void this.emit(ready?'audio_connection_restored':'audio_connection_delayed',diagnostics).catch(()=>{});
    if(this.phase==='reactive_wait'&&this.hasTouch){
      this.set('response_wait','참가자의 음성 요청이 끝나면 Space 또는 응답 확인을 누르세요.');
    }
    if(this.phase==='cue_wait'&&this.hasTouch){
      const epoch=this.epoch;this.set('delay','Cue 터치 확인 · 응답 준비');
      void this.answer(epoch).catch(e=>this.fail(e,epoch));
    }
  }
  valid(epoch){return epoch===this.epoch&&this.active;}
  async awaitReady(epoch){
    while(this.valid(epoch)&&!this.ready)await this.wait(100);
    return this.valid(epoch);
  }
  async control(action,data,epoch){
    if(!await this.awaitReady(epoch))return;
    const result=await this.command(action,{...data,runId:this.run.id,trialId:this.run.trialId});
    const armed=['show_cue','arm_reactive'].includes(action);
    if(armed)this.armedCueId=result?.state?.cueId||this.snapshot?.state.cueId;
    // Scheduled Cue onset must not wait for the post-render ACK round trip.
    if(action==='show_cue'&&Number.isFinite(result?.state?.cueAt))return result;
    // Visual changes do not wait for audit uploads and a return ACK poll.
    if(!armed||!result?.state)return result;
    const generation=result.state.generation,deadline=performance.now()+10000;
    while(this.valid(epoch)){
      const s=this.snapshot?.state;
      // A fast valid touch can consume the just-armed state before its ACK poll.
      if(this.hasTouch)return;
      if(s?.generation===generation&&this.snapshot.applied)return;
      if(s?.generation>generation)throw Error('화면 상태가 변경되어 재생을 중지했습니다.');
      if(performance.now()>deadline)throw Error('iPad 화면 적용을 10초 안에 확인하지 못했습니다.');
      await this.wait(100);
    }
  }
  async icon(icon,epoch){await this.control('set_icon',{icon},epoch);}
  emit(type,detail={}){
    if(!this.claimed)return Promise.resolve();
    const epoch=this.epoch;
    // Capture event time now; persistence/upload must not stretch the stimulus.
    Promise.resolve(this.log(type,detail,this.run)).catch(error=>this.fail(error,epoch));
    return Promise.resolve();
  }
  async begin({trial,assets,delayMs,pageId}){
    if(this.active||this.snapshot?.state.audioRun||!this.ready||this.snapshot?.state.suspended||trial?.status!=='running'||trial.id!==this.snapshot?.state.trial?.id||trial.intervention!==this.snapshot.state.trial.intervention||!['reactive','cue','suggestion','direct'].includes(trial.intervention))return false;
    const epoch=++this.epoch;this.claimed=false;this.armedCueId=null;
    this.run={id:crypto.randomUUID(),trialId:trial.id,intervention:trial.intervention,pageId,assets,delayMs};
    const run=this.run;
    this.set('claiming','재생 준비 중');
    try{
      await this.claim(run);
      if(!this.valid(epoch)){
        this.resetIcon(run,true);
        await this.log('audio_flow_stopped',{reason:'재생 시작 확인 전에 흐름이 취소되었습니다.'},run);return false;
      }
      this.claimed=true;
      await this.clip('dialogue',epoch);
      if(!this.valid(epoch))return false;
      if(trial.intervention==='cue'){
        const cue=await this.control('show_cue',{synchronizeCue:true},epoch);
        if(!this.valid(epoch))return false;
        if(cue?.state?.cueAt)await this.wait(cueDelay(cue));
        if(!await this.awaitReady(epoch))return false;
        // One sound per newly displayed cue, never per state poll. Keep a fast
        // touch pending until this sound ends so two chimes cannot overlap.
        this.set('cue_chime','정보 제공 가능 · 알림음');
        await this.chime(asset=>this.emit('audio_started',{clip:'cue_chime',cueId:this.armedCueId,asset,clock:'pc_source_start_call'}));
        if(!this.valid(epoch))return false;
        this.emit('audio_ended',{clip:'cue_chime',cueId:this.armedCueId,clock:'pc_audio_ended_callback'});
        if(this.valid(epoch)){this.set('cue_wait','iPad의 Cue 터치를 기다립니다.');this.update(this.snapshot,this.connected,this.ready,this.diagnostics);}
      }else if(trial.intervention==='suggestion'){
        this.set('delay','대화 종료 · AI 제안 대기');
        await this.think(epoch);if(!this.valid(epoch))return false;
        await this.icon('speaking',epoch);if(!this.valid(epoch))return false;
        await this.clip('prompt',epoch);
        if(!this.valid(epoch))return false;
        await this.icon('listening',epoch);
        if(this.valid(epoch))this.set('response_wait','참가자의 승인 발화를 확인한 뒤 Space를 누르세요.');
      }else if(trial.intervention==='reactive'){
        await this.control('arm_reactive',undefined,epoch);
        if(this.valid(epoch)){this.set('reactive_wait','iPad 아이콘 터치를 기다립니다. 터치 후 참가자가 음성으로 요청합니다.');this.update(this.snapshot,this.connected,this.ready,this.diagnostics);}
      }else{
        this.set('delay','대화 종료 · 응답 준비');await this.answer(epoch);
      }
      return true;
    }catch(error){this.fail(error,epoch);return false;}
  }
  async confirm(source){
    if(!this.canConfirm)return false;
    const epoch=this.epoch;
    // Consume synchronously so repeats/double clicks cannot launch another answer.
    this.set('delay','진행자 발화 확인 · 응답 준비');
    try{this.emit('operator_confirm',{source,meaning:'operator_confirmed_participant_response'});if(this.valid(epoch))await this.answer(epoch);return true;}
    catch(error){this.fail(error,epoch);return false;}
  }
  async clip(kind,epoch){
    if(!await this.awaitReady(epoch))return;
    if(kind==='prompt'||kind==='answer'){
      this.set('chime','AI 발화 전 알림음');
      await this.chime(asset=>this.emit('audio_started',{clip:'chime',beforeClip:kind,asset,clock:'pc_source_start_call'}));
      if(!this.valid(epoch))return;
      await this.emit('audio_ended',{clip:'chime',beforeClip:kind,clock:'pc_audio_ended_callback'});
      await this.wait(180);
      if(!await this.awaitReady(epoch))return;
    }
    this.set(kind,({dialogue:'동승자 대화 재생 중',prompt:'AI 제안 재생 중',answer:'AI 답변 재생 중'})[kind]);
    const asset=this.run.assets[kind];
    let visual;
    await this.play(asset,()=>{
      this.emit('audio_started',{clip:kind,asset:asset.meta,clock:'pc_source_start_call'});
      if(kind==='dialogue'){
        // Send Listening only AFTER source.start(), never before the dialogue.
        visual=this.icon(this.run.intervention==='reactive'?'idle':'listening',epoch);
        void visual.catch(error=>this.fail(error,epoch));
      }
    });
    if(this.valid(epoch))await this.emit('audio_ended',{clip:kind,clock:'pc_audio_ended_callback'});
    if(visual)await visual;
  }
  async think(epoch){
    const start=this.now();
    const s=this.snapshot?.state;
    const alreadyThinking=this.run.intervention==='cue'&&this.hasTouch&&s.icon==='thinking'&&Number.isFinite(s.activation.at)&&Number.isFinite(this.snapshot.serverTime);
    const elapsed=alreadyThinking?Math.max(0,this.snapshot.serverTime-s.activation.at):0;
    if(!alreadyThinking)await this.icon('thinking',epoch);
    if(this.valid(epoch))await this.wait(Math.max(0,this.run.delayMs-elapsed-(this.now()-start)));
  }
  async answer(epoch){
    if(['reactive','cue'].includes(this.run.intervention)&&!this.hasTouch)throw Error('현재 시행의 참가자 터치가 확인되지 않았습니다.');
    await this.think(epoch);
    if(!this.valid(epoch))return;
    if(['reactive','cue'].includes(this.run.intervention)&&!this.hasTouch)throw Error('참가자 터치 확인이 해제되었습니다.');
    await this.icon('speaking',epoch);if(!this.valid(epoch))return;
    await this.clip('answer',epoch);if(!this.valid(epoch))return;
    await this.control('finish_audio',undefined,epoch);if(!this.valid(epoch))return;
    await this.emit('audio_flow_complete');
    if(this.valid(epoch))this.set('complete','답변 재생 완료 · 시행 종료는 진행자가 선택하세요.');
  }
  cancel(reason='진행자가 자동 재생을 멈췄습니다.',diagnostics={},reset=true){
    if(!this.active)return;
    ++this.epoch;this.stop();this.set('stopped',reason+' 재실행은 새 시행으로 준비하세요.');
    if(reset)this.resetIcon();
    void this.emit('audio_flow_stopped',{reason,...diagnostics}).catch(()=>{this.message+=' 재생 로그 저장을 확인해 주세요.';this.changed();});
  }
  fail(error,epoch){
    if(!this.valid(epoch))return;
    ++this.epoch;this.stop();this.set('error',(error.message||'음원을 재생하지 못했습니다.')+' 재실행은 새 시행으로 준비하세요.');
    this.resetIcon();
    void this.emit('audio_flow_error',{message:String(error.message||error).slice(0,1000)}).catch(()=>{});
  }
  resetIcon(run=this.run,claimed=this.claimed){
    if(!claimed||this.snapshot?.state.suspended||this.snapshot?.state.audioRun?.status==='stopped'||this.snapshot?.state.trial?.id!==run?.trialId||this.snapshot.state.trial.status!=='running')return;
    void this.command('stop_audio',{runId:run.id,trialId:run.trialId}).catch(()=>{});
  }
}

export function acceptsSpace(event){
  return event.code==='Space'&&!event.repeat&&!event.isComposing&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey
    &&!event.target?.closest?.('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
}
