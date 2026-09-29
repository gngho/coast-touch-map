// Fixed stimuli only. No microphone, speech recognition, or generated answers.
export class AudioFlow {
  constructor({claim,command,play,chime,stop,log,changed,wait=ms=>new Promise(r=>setTimeout(r,ms))}) {
    Object.assign(this,{claim,command,play,chime,stop,log,changed,wait});
    this.phase='idle';this.run=null;this.epoch=0;this.snapshot=null;this.connected=false;this.message='음원 선택 후 시행을 시작하세요.';
  }
  get active(){return !['idle','complete','stopped','error'].includes(this.phase);}
  get canConfirm(){return this.phase==='response_wait'&&this.ready&&!this.snapshot?.state.suspended;}
  set(phase,message){this.phase=phase;this.message=message;this.changed();}
  update(snapshot,connected,ready=connected,diagnostics={}){
    const wasReady=this.ready;this.snapshot=snapshot;this.connected=connected;this.ready=ready;this.diagnostics=diagnostics;
    if(this.active&&(!connected||snapshot?.state.suspended||snapshot?.state.trial?.id!==this.run?.trialId||snapshot.state.trial.status!=='running')){
      const cause=!connected?'connection_timeout':snapshot?.state.suspended?'participant_suspended':'trial_changed';
      const reason={connection_timeout:'10초 이상 연결 확인이 되지 않아 자동 재생을 멈췄습니다.',participant_suspended:'iPad가 안전 대기 상태로 전환되어 자동 재생을 멈췄습니다. 화면 이탈·재접속 기록을 확인해 주세요.',trial_changed:'현재 시행이 종료·중단되거나 다른 시행으로 바뀌어 자동 재생을 멈췄습니다.'}[cause];
      this.cancel(reason,{cause,...diagnostics});return;
    }
    if(this.active&&this.claimed&&wasReady!==undefined&&wasReady!==ready)void this.emit(ready?'audio_connection_restored':'audio_connection_delayed',diagnostics).catch(()=>{});
    if(this.phase==='reactive_wait'&&snapshot?.state.touched){
      this.set('response_wait','참가자의 음성 요청이 끝나면 Space 또는 응답 확인을 누르세요.');
    }
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
  async control(action,data,epoch){
    if(!await this.awaitReady(epoch))return;
    const result=await this.command(action,{...data,runId:this.run.id,trialId:this.run.trialId});
    if(!result?.state)return; // Unit adapters may apply synchronously.
    const generation=result.state.generation,deadline=performance.now()+10000;
    while(this.valid(epoch)){
      const s=this.snapshot?.state;
      // A fast valid touch can consume the just-armed state before its ACK poll.
      if(['show_cue','arm_reactive'].includes(action)&&s?.cueId===result.state.cueId&&s.touched)return;
      if(s?.generation===generation&&this.snapshot.applied)return;
      if(s?.generation>generation)throw Error('화면 상태가 변경되어 재생을 중지했습니다.');
      if(performance.now()>deadline)throw Error('iPad 화면 적용을 10초 안에 확인하지 못했습니다.');
      await this.wait(100);
    }
  }
  async icon(icon,epoch){await this.control('set_icon',{icon},epoch);}
  async emit(type,detail={}){if(this.claimed)await this.log(type,detail,this.run);}
  async begin({trial,assets,delayMs,pageId}){
    if(this.active||this.snapshot?.state.audioRun||!this.ready||this.snapshot?.state.suspended||trial?.status!=='running')return false;
    const epoch=++this.epoch;this.claimed=false;
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
      await this.icon(trial.intervention==='reactive'?'idle':'listening',epoch);
      if(!this.valid(epoch))return false;
      await this.clip('dialogue',epoch);
      if(!this.valid(epoch))return false;
      if(trial.intervention==='cue'){
        await this.control('show_cue',undefined,epoch);
        if(this.valid(epoch)){this.set('cue_wait','iPad의 Cue 터치를 기다립니다.');this.update(this.snapshot,this.connected,this.ready,this.diagnostics);}
      }else if(trial.intervention==='suggestion'){
        this.set('delay','대화 종료 · AI 제안 대기');
        await this.icon('thinking',epoch);if(!this.valid(epoch))return false;
        await this.wait(this.run.delayMs);if(!this.valid(epoch))return false;
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
    try{await this.emit('operator_confirm',{source,meaning:'operator_confirmed_participant_response'});if(this.valid(epoch))await this.answer(epoch);return true;}
    catch(error){this.fail(error,epoch);return false;}
  }
  async clip(kind,epoch){
    if(!await this.awaitReady(epoch))return;
    if(kind==='prompt'||kind==='answer'){
      this.set('chime','AI 발화 전 알림음');
      await this.chime(asset=>this.emit('audio_started',{clip:'chime',beforeClip:kind,asset,clock:'pc_source_start_call'}));
      if(!this.valid(epoch))return;
      await this.emit('audio_ended',{clip:'chime',beforeClip:kind,clock:'pc_audio_ended_callback'});
      if(!await this.awaitReady(epoch))return;
    }
    this.set(kind,({dialogue:'동승자 대화 재생 중',prompt:'AI 제안 재생 중',answer:'AI 답변 재생 중'})[kind]);
    const asset=this.run.assets[kind];
    await this.play(asset,()=>this.emit('audio_started',{clip:kind,asset:asset.meta,clock:'pc_source_start_call'}));
    if(this.valid(epoch))await this.emit('audio_ended',{clip:kind,clock:'pc_audio_ended_callback'});
  }
  async answer(epoch){
    await this.icon('thinking',epoch);if(!this.valid(epoch))return;
    await this.wait(this.run.delayMs);
    if(!this.valid(epoch))return;
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
