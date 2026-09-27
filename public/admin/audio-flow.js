// Fixed stimuli only. No microphone, speech recognition, or generated answers.
export class AudioFlow {
  constructor({claim,command,play,stop,log,changed,wait=ms=>new Promise(r=>setTimeout(r,ms))}) {
    Object.assign(this,{claim,command,play,stop,log,changed,wait});
    this.phase='idle';this.run=null;this.epoch=0;this.snapshot=null;this.connected=false;this.message='음원 선택 후 시행을 시작하세요.';
  }
  get active(){return !['idle','complete','stopped','error'].includes(this.phase);}
  get canConfirm(){return this.phase==='response_wait'&&this.ready&&!this.snapshot?.state.suspended;}
  set(phase,message){this.phase=phase;this.message=message;this.changed();}
  update(snapshot,connected,ready=connected,diagnostics={}){
    const wasReady=this.ready;this.snapshot=snapshot;this.connected=connected;this.ready=ready;this.diagnostics=diagnostics;
    if(this.active&&(!connected||snapshot?.state.suspended||snapshot?.state.trial?.id!==this.run?.trialId||snapshot.state.trial.status!=='running')){
      const cause=!connected?'connection_timeout':snapshot?.state.suspended?'participant_suspended':'trial_changed';
      this.cancel('연결 또는 시행 상태가 변경되어 자동 재생을 멈췄습니다. 자동으로 다시 재생하지 않습니다.',{cause,...diagnostics});return;
    }
    if(this.active&&this.claimed&&wasReady!==undefined&&wasReady!==ready)void this.emit(ready?'audio_connection_restored':'audio_connection_delayed',diagnostics).catch(()=>{});
    if(this.phase==='cue_wait'&&snapshot?.state.touched){
      const epoch=this.epoch;this.set('delay','Cue 터치 확인 · 응답 준비');
      void this.answer(epoch).catch(e=>this.fail(e,epoch));
    }
  }
  valid(epoch){return epoch===this.epoch&&this.active;}
  async awaitReady(epoch){
    while(this.valid(epoch)&&!this.ready)await this.wait(100);
    return this.valid(epoch);
  }
  async control(action,data,epoch){if(await this.awaitReady(epoch))await this.command(action,data);}
  async emit(type,detail={}){if(this.claimed)await this.log(type,detail,this.run);}
  async begin({trial,assets,delayMs,pageId}){
    if(this.active||this.snapshot?.state.audioRun||!this.ready||this.snapshot?.state.suspended||trial?.status!=='running')return false;
    const epoch=++this.epoch;this.claimed=false;
    this.run={id:crypto.randomUUID(),trialId:trial.id,intervention:trial.intervention,pageId,assets,delayMs};
    this.set('claiming','재생 준비 중');
    try{
      await this.claim(this.run);
      this.claimed=true;
      if(!this.valid(epoch)){await this.emit('audio_flow_stopped',{reason:'재생 시작 확인 전에 흐름이 취소되었습니다.'});return false;}
      await this.clip('dialogue',epoch);
      if(!this.valid(epoch))return false;
      if(trial.intervention==='cue'){
        await this.control('show_cue',undefined,epoch);
        if(this.valid(epoch)){this.set('cue_wait','iPad의 Cue 터치를 기다립니다.');this.update(this.snapshot,this.connected,this.ready,this.diagnostics);}
      }else if(trial.intervention==='suggestion'){
        this.set('delay','대화 종료 · AI 제안 대기');
        await this.wait(this.run.delayMs);if(!this.valid(epoch))return false;
        await this.clip('prompt',epoch);
        if(this.valid(epoch))this.set('response_wait','참가자의 승인 발화를 확인한 뒤 Space를 누르세요.');
      }else if(trial.intervention==='reactive'){
        this.set('response_wait','참가자의 호출 발화를 확인한 뒤 Space를 누르세요.');
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
    try{await this.emit('operator_confirm',{source,meaning:'operator_confirmed_participant_response'});if(this.valid(epoch))await this.answer(epoch);return true;}
    catch(error){this.fail(error,epoch);return false;}
  }
  async clip(kind,epoch){
    if(!await this.awaitReady(epoch))return;
    this.set(kind,({dialogue:'동승자 대화 재생 중',prompt:'AI 제안 재생 중',answer:'AI 답변 재생 중'})[kind]);
    const asset=this.run.assets[kind];
    await this.play(asset,()=>this.emit('audio_started',{clip:kind,asset:asset.meta,clock:'pc_source_start_call'}));
    if(this.valid(epoch))await this.emit('audio_ended',{clip:kind,clock:'pc_audio_ended_callback'});
  }
  async answer(epoch){
    const cue=this.run.intervention==='cue',delay=this.run.delayMs;
    if(cue){
      await this.wait(Math.min(300,delay));if(!this.valid(epoch))return;
      await this.control('set_icon',{icon:'thinking'},epoch);if(!this.valid(epoch))return;
      await this.wait(Math.max(0,delay-300));
    }else await this.wait(delay);
    if(!this.valid(epoch))return;
    if(cue){await this.control('set_icon',{icon:'speaking'},epoch);if(!this.valid(epoch))return;}
    await this.clip('answer',epoch);if(!this.valid(epoch))return;
    if(cue){await this.control('set_icon',{icon:'hidden'},epoch);if(!this.valid(epoch))return;}
    await this.emit('audio_flow_complete');
    if(this.valid(epoch))this.set('complete','답변 재생 완료 · 시행 종료는 진행자가 선택하세요.');
  }
  cancel(reason='진행자가 자동 재생을 멈췄습니다.',diagnostics={}){
    if(!this.active)return;
    ++this.epoch;this.stop();this.set('stopped',reason+' 재실행은 새 시행으로 준비하세요.');
    void this.emit('audio_flow_stopped',{reason,...diagnostics}).catch(()=>{this.message+=' 재생 로그 저장을 확인해 주세요.';this.changed();});
  }
  fail(error,epoch){
    if(!this.valid(epoch))return;
    ++this.epoch;this.stop();this.set('error',(error.message||'음원을 재생하지 못했습니다.')+' 재실행은 새 시행으로 준비하세요.');
    void this.emit('audio_flow_error',{message:String(error.message||error).slice(0,1000)}).catch(()=>{});
  }
}

export function acceptsSpace(event){
  return event.code==='Space'&&!event.repeat&&!event.isComposing&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey
    &&!event.target?.closest?.('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
}
