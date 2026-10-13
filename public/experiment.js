import {initializeAiWidget} from './ai.js';
import {load,save,request,endpoint,Outbox} from './sync.js';
import {WARN_MS,LOST_MS,singleFlight} from './connection.js';
import {cueDelay} from './cue-timing.js';
export function initializeExperiment(coast){
  const $=id=>document.getElementById(id), pageId=crypto.randomUUID(),outbox=new Outbox();
  let auth=load('coast.device.v2'),snapshot=null,lastSuccess=0,needsRejoin=!!auth,reason='reload',lastApplied=-1,resetTrial=null;
  let display=null,pendingTouch=null,order=Date.now(),storageOK=true,polling=false,rejoinId=crypto.randomUUID(),superseded=false;
  let pending=0,lastError=null,gapDiagnostics=null;
  let cueTimer=null,cueTimerId=null,cueDue=false;
  function clearCueTimer(){if(cueTimer!==null)clearTimeout(cueTimer);cueTimer=null;cueTimerId=null;cueDue=false;}
  const diagnostics=cause=>({cause,localAgeMs:lastSuccess?performance.now()-lastSuccess:0,peerAgeMs:snapshot?.adminAgeMs,pendingEvents:pending,lastError});
  function loseConnection(cause){if(needsRejoin)return;gapDiagnostics=diagnostics(cause);needsRejoin=true;reason='connection_gap';safeIdle();void enqueue('connection_lost',{diagnostics:gapDiagnostics}).catch(()=>{});}
  const ai=initializeAiWidget({onTouch:touch});
  function setup(){ai.setMode(false);ai.setVisible(true);ai.setTouchEnabled?.(true);$('settings-open').hidden=false;}
  function safeIdle(){clearCueTimer();ai.setVisible(true);ai.setState('idle');ai.setTouchEnabled?.(false);display=null;pendingTouch=null;}
  function status(text){$('pair-status').textContent=text;}
  function mode(experiment){ai.setMode(experiment);$('settings-open').hidden=experiment;if(experiment&&$('settings').open)$('settings').close();try{save('coast.experiment-mode',experiment);}catch{}}
  if(auth&&load('coast.experiment-mode',false)){mode(true);safeIdle();}else setup();
  async function enqueue(type,extra={}){
    const event={id:crypto.randomUUID(),type,pageId,clientTime:new Date().toISOString(),generation:snapshot?.state.generation??0,trialId:snapshot?.state.trial?.id??null,sessionId:auth.id,order:++order,...extra};
    try{await outbox.put(event);pending++;void flushCritical();void flushApplied();return event;}catch{storageOK=false;safeIdle();needsRejoin=true;reason='connection_gap';status('기기 로그 저장 공간을 사용할 수 없습니다. 진행자에게 알려 주세요.');throw Error('로그 임시 저장 실패');}
  }
  async function touch(){
    if(!display||pendingTouch||!storageOK||needsRejoin||!snapshot||snapshot.state.touched||!snapshot.state.touchReady)return;
    const shown=display;pendingTouch='saving';ai.setTouchEnabled?.(false);ai.setState(snapshot.state.trial.intervention==='reactive'?'listening':'thinking');
    try{const event=await enqueue('touch',{cueId:shown.cueId,displayEventId:shown.id,generation:shown.generation,reactionMs:performance.now()-shown.monotonicMs});pendingTouch=event.id;}catch{pendingTouch=null;}
  }
  async function apply(next){
    if(snapshot&&next.state.generation<snapshot.state.generation)return;
    snapshot=next;const s=next.state,experiment=s.mode==='experiment';mode(experiment);
    const scheduled=experiment&&!s.suspended&&!needsRejoin&&storageOK&&s.trial?.status==='running'&&s.icon==='twinkle'&&!s.touched&&s.cueAt;
    if(!scheduled||cueTimerId!==s.cueId)clearCueTimer();
    if(scheduled&&!cueDue&&cueDelay(next)>0){
      ai.setState('listening');ai.setTouchEnabled?.(false);
      if(!cueTimer){cueTimerId=s.cueId;cueTimer=setTimeout(()=>{cueTimer=null;cueDue=true;if(!document.hidden)void apply(snapshot);},cueDelay(next));}
      return;
    }
    if(s.trial?.id!==resetTrial&&s.trial?.status==='prepared'){coast.reset();resetTrial=s.trial.id;}
    if(s.suspended||needsRejoin||!storageOK){safeIdle();}
    else if(!experiment){setup();display=null;pendingTouch=null;}
    else{
      const running=s.trial?.status==='running';
      const armed=running&&s.touchReady&&!s.touched&&['reactive','cue'].includes(s.trial.intervention);
      // Keep the local touch latch until the authoritative state consumes it.
      if(!armed||s.touched)pendingTouch=null;
      ai.setVisible(true);
      if(!pendingTouch)ai.setState(running&&s.icon!=='hidden'?s.icon:'idle');
      if(!armed||display?.cueId!==s.cueId||display?.generation!==s.generation)display=null;
      if(!armed||!display||pendingTouch)ai.setTouchEnabled?.(false);
      if(armed&&!display&&!pendingTouch){
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        if(needsRejoin||document.hidden||snapshot.state.generation!==s.generation)return;
        const monotonicMs=performance.now();
        const event=await enqueue(s.trial.intervention==='cue'?'cue_displayed':'reactive_ready',{cueId:s.cueId,monotonicMs});
        if(needsRejoin||document.hidden||snapshot.state.generation!==s.generation)return;
        display={id:event.id,cueId:s.cueId,generation:s.generation,monotonicMs};
      }
      ai.setTouchEnabled?.(armed&&!!display&&!pendingTouch);
    }
    if(!needsRejoin&&storageOK&&lastApplied!==s.generation){
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(needsRejoin||document.hidden||snapshot.state.generation!==s.generation)return;
      await enqueue('applied');lastApplied=s.generation;
    }
    status(s.suspended?'연결됨 · 진행자의 재개 대기':'진행자 PC에 연결됨');
    $('pair-form').hidden=true;
  }
  $('pair-form').onsubmit=async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
    try{
      const result=await request('/api/pair',{method:'POST',data:{code:$('pair-code').value.trim(),pageId}});
      auth={id:result.id,token:result.deviceToken};save('coast.device.v2',auth);needsRejoin=false;lastSuccess=performance.now();await apply(result);
    }catch(error){status(error.message);}finally{button.disabled=false;}
  };
  const criticalTypes=new Set(['cue_displayed','reactive_ready','touch']);
  const lane=event=>criticalTypes.has(event.type)?'touch':event.type==='applied'?'applied':'audit';
  const makeFlush=kind=>singleFlight(async()=>{
    if(!auth||document.hidden||superseded||needsRejoin)return;
    const target=auth;
    try{
      const queue=(await outbox.all()).filter(e=>e.sessionId===target.id);pending=queue.length;
      for(const event of queue.filter(e=>lane(e)===kind).slice(0,20)){
        if(auth!==target||needsRejoin||document.hidden||superseded)break;
        const result=await request(endpoint(target,'event'),{auth:target,role:'device',method:'POST',data:event});
        if(event.type==='touch'&&result.state)await apply(result);
        await outbox.remove(event.id);pending=Math.max(0,pending-1);
      }
    }catch(error){lastError=error.code||'HTTP_ERROR';status('로그 저장 대기 · '+error.message);}
  });
  const flush=makeFlush('audit'),flushCritical=makeFlush('touch'),flushApplied=makeFlush('applied');
  async function tick(){
    if(polling)return;polling=true;
    try{
      if(!auth||document.hidden||superseded)return;
      if(needsRejoin){
        safeIdle();const result=await request(endpoint(auth,'rejoin'),{auth,role:'device',method:'POST',data:{id:rejoinId,pageId,reason,diagnostics:gapDiagnostics,clientTime:new Date().toISOString()}});
        needsRejoin=false;rejoinId=crypto.randomUUID();lastApplied=-1;pendingTouch=null;lastSuccess=performance.now();await apply(result);
      }
      const result=await request(endpoint(auth,`state?pageId=${pageId}&pending=${pending}`),{auth,role:'device',timeoutMs:4500});
      lastSuccess=performance.now();
      if(result.state.mode==='experiment'&&!result.state.suspended&&!(result.adminAlive??result.adminConnected)){snapshot=result;loseConnection('admin_timeout');return;}
      await apply(result);
      if(!result.adminConnected)status('진행자 연결 응답 지연 · 복구 확인 중');
    }catch(error){lastError=error.code||'HTTP_ERROR';status(error.message);if(error.status===409&&error.message.includes('다른 화면')){superseded=true;safeIdle();}if(error.status===403){safeIdle();auth=null;snapshot=null;needsRejoin=false;localStorage.removeItem('coast.device.v2');mode(false);setup();$('pair-form').hidden=false;status('연결이 해제되었습니다. 새 연결 코드를 입력하세요.');}}
    finally{polling=false;void flush();void flushCritical();void flushApplied();setTimeout(tick,150);}
  }
  setInterval(()=>{
    if(auth&&!superseded&&!needsRejoin&&lastSuccess){const age=performance.now()-lastSuccess;if(age>=LOST_MS)loseConnection('local_timeout');else if(age>=WARN_MS)status('연결 응답 지연 · 복구 확인 중');}
  },250);
  document.addEventListener('visibilitychange',()=>{
    if(!auth)return;
    if(document.hidden){safeIdle();needsRejoin=true;reason='visibility';gapDiagnostics=diagnostics('visibility');enqueue('visibility_hidden',{diagnostics:gapDiagnostics}).catch(()=>{});}
  });
  outbox.db.catch(()=>{storageOK=false;safeIdle();status('이 브라우저에서 실험 로그를 저장할 수 없습니다.');});
  tick();
}
