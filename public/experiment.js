import {initializeAiWidget} from './ai.js';
import {load,save,request,endpoint,Outbox} from './sync.js';
export function initializeExperiment(coast){
  const $=id=>document.getElementById(id), pageId=crypto.randomUUID(),outbox=new Outbox();
  let auth=load('coast.device.v2'),snapshot=null,lastSuccess=0,needsRejoin=!!auth,reason='reload',lastApplied=-1,resetTrial=null;
  let display=null,pendingTouch=null,order=Date.now(),storageOK=true,polling=false,rejoinId=crypto.randomUUID(),superseded=false;
  const ai=initializeAiWidget({onTouch:touch});
  $('ai-visible').checked=load('coast.ai-visible',false);
  function setup(){ai.setMode(false);ai.setVisible($('ai-visible').checked);$('settings-open').hidden=false;}
  function safeHide(){ai.setVisible(false);display=null;}
  function status(text){$('pair-status').textContent=text;}
  function mode(experiment){ai.setMode(experiment);$('settings-open').hidden=experiment;if(experiment&&$('settings').open)$('settings').close();try{save('coast.experiment-mode',experiment);}catch{}}
  if(auth&&load('coast.experiment-mode',false)){mode(true);safeHide();}else setup();
  $('ai-visible').onchange=()=>{try{save('coast.ai-visible',$('ai-visible').checked);}catch{}if(snapshot?.state.mode!=='experiment')setup();};
  async function enqueue(type,extra={}){
    const event={id:crypto.randomUUID(),type,pageId,clientTime:new Date().toISOString(),generation:snapshot?.state.generation??0,trialId:snapshot?.state.trial?.id??null,sessionId:auth.id,order:++order,...extra};
    try{await outbox.put(event);return event;}catch{storageOK=false;safeHide();needsRejoin=true;reason='connection_gap';status('기기 로그 저장 공간을 사용할 수 없습니다. 진행자에게 알려 주세요.');throw Error('로그 임시 저장 실패');}
  }
  async function touch(){
    if(!display||pendingTouch||!storageOK||needsRejoin||!snapshot||snapshot.state.touched||snapshot.state.icon!=='idle')return;
    const shown=display;pendingTouch='saving';ai.setState('listening');
    try{const event=await enqueue('touch',{cueId:shown.cueId,displayEventId:shown.id,generation:shown.generation,reactionMs:performance.now()-shown.monotonicMs});pendingTouch=event.id;}catch{pendingTouch=null;}
  }
  async function apply(next){
    snapshot=next;const s=next.state,experiment=s.mode==='experiment';mode(experiment);
    if(s.trial?.id!==resetTrial&&s.trial?.status==='prepared'){coast.reset();resetTrial=s.trial.id;}
    if(s.suspended||needsRejoin||!storageOK){safeHide();}
    else if(!experiment){setup();display=null;pendingTouch=null;}
    else{
      const visible=s.trial?.status==='running'&&s.trial.intervention==='cue'&&s.icon!=='hidden';
      ai.setVisible(visible);if(!pendingTouch)ai.setState(s.icon==='hidden'?'idle':s.icon);
      if(!visible)display=null;
      if(visible&&s.icon==='idle'&&!s.touched&&!display&&!pendingTouch){
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        if(needsRejoin||document.hidden)return;
        const monotonicMs=performance.now();
        const event=await enqueue('cue_displayed',{cueId:s.cueId,monotonicMs});
        display={id:event.id,cueId:s.cueId,generation:s.generation,monotonicMs};
      }
    }
    if(!needsRejoin&&storageOK&&lastApplied!==s.generation){await enqueue('applied');lastApplied=s.generation;}
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
  async function tick(){
    if(polling)return;polling=true;
    try{
      if(!auth||document.hidden||superseded)return;
      if(needsRejoin){
        safeHide();const result=await request(endpoint(auth,'rejoin'),{auth,role:'device',method:'POST',data:{id:rejoinId,pageId,reason,clientTime:new Date().toISOString()}});
        needsRejoin=false;rejoinId=crypto.randomUUID();lastApplied=-1;pendingTouch=null;await apply(result);
      }
      const queue=await outbox.all();
      for(const event of queue.slice(0,20)){
        if(event.sessionId!==auth.id)continue;
        await request(endpoint(auth,'event'),{auth,role:'device',method:'POST',data:event});await outbox.remove(event.id);
        if(pendingTouch===event.id)pendingTouch=null;
      }
      const pending=(await outbox.all()).filter(e=>e.sessionId===auth.id).length;
      const result=await request(endpoint(auth,`state?pageId=${pageId}&pending=${pending}`),{auth,role:'device'});
      lastSuccess=performance.now();
      if(result.state.mode==='experiment'&&!result.state.suspended&&!result.adminConnected){needsRejoin=true;reason='connection_gap';safeHide();return;}
      await apply(result);
    }catch(error){status(error.message);if(error.status===409&&error.message.includes('다른 화면')){superseded=true;safeHide();}if(error.status===403){safeHide();auth=null;snapshot=null;needsRejoin=false;localStorage.removeItem('coast.device.v2');mode(false);setup();$('pair-form').hidden=false;status('연결이 해제되었습니다. 새 연결 코드를 입력하세요.');}}
    finally{polling=false;setTimeout(tick,250);}
  }
  setInterval(()=>{
    if(auth&&!superseded&&!needsRejoin&&lastSuccess&&performance.now()-lastSuccess>3000){needsRejoin=true;reason='connection_gap';safeHide();enqueue('connection_lost').catch(()=>{});}
  },250);
  document.addEventListener('visibilitychange',()=>{
    if(!auth)return;
    if(document.hidden){safeHide();needsRejoin=true;reason='visibility';enqueue('visibility_hidden').catch(()=>{});}
  });
  outbox.db.catch(()=>{storageOK=false;safeHide();status('이 브라우저에서 실험 로그를 저장할 수 없습니다.');});
  tick();
}
