import {Outbox,request,endpoint} from '/sync.js';
import {AudioFlow,acceptsSpace} from './audio-flow.js';

export function initAudio({getAuth,getSnapshot,command,refresh}){
  const $=id=>document.getElementById(id),pageId=crypto.randomUUID(),outbox=new Outbox('coast-pc-audio-events-v1');
  const assets={},versions={};let context,source,rejectPlayback,flushing=false,preparing=false,pending=0,queueError='',configKey=null,testing=false;
  const ctx=()=>context||(context=new AudioContext());
  function stop(){const s=source;source=null;if(s){s.onended=null;try{s.stop();}catch{}}if(rejectPlayback){const reject=rejectPlayback;rejectPlayback=null;reject(new Error('재생이 중지되었습니다.'));}}
  function play(asset,started){
    return new Promise((resolve,reject)=>{
      if(ctx().state!=='running'){reject(new Error('PC 소리가 준비되지 않았습니다. 소리 테스트를 실행해 주세요.'));return;}
      const current=ctx().createBufferSource();source=current;current.buffer=asset.buffer;current.connect(ctx().destination);rejectPlayback=reject;
      current.onended=()=>{if(source!==current)return;source=null;rejectPlayback=null;current.disconnect();resolve();};
      try{current.start();Promise.resolve(started()).catch(error=>{stop();reject(error);});}catch(error){source=null;rejectPlayback=null;reject(error);}
    });
  }
  async function log(type,detail,run){
    if(!run)return;
    const event={id:crypto.randomUUID(),runId:run.id,trialId:run.trialId,pageId:run.pageId,type,detail,clientTime:new Date().toISOString(),monotonicMs:performance.now(),generation:getSnapshot()?.state.generation||0,sessionId:getAuth()?.id,order:Date.now()};
    await outbox.put(event);pending++;render();void flush();
  }
  async function flush(){
    if(flushing||!getAuth())return;flushing=true;
    try{
      const rows=await outbox.all();pending=rows.length;
      for(const event of rows){
        if(event.sessionId!==getAuth()?.id)continue;
        await request(endpoint(getAuth(),'audio-event'),{auth:getAuth(),method:'POST',data:event});
        await outbox.remove(event.id);pending--;
      }
      queueError='';
    }catch(error){queueError=error.message;}
    finally{flushing=false;render();}
  }
  const flow=new AudioFlow({
    claim:run=>command('begin_audio',{id:run.id,pageId:run.pageId,delayMs:run.delayMs,assets:Object.fromEntries(Object.entries(run.assets).map(([key,a])=>[key,a.meta]))},true),
    command:(action,data)=>command(action,data,true),play,stop,log,
    changed:()=>{render();refresh();}
  });
  function render(){
    const s=getSnapshot()?.state,t=s?.trial,locked=flow.active||preparing||testing;
    $('audio-files').disabled=locked||!!s?.audioRun;
    const suggestion=(t&&['prepared','running'].includes(t.status)?t.intervention:$('intervention').value)==='suggestion';
    $('prompt-file-row').hidden=!suggestion;
    const ready=assets.dialogue&&assets.answer&&(!suggestion||assets.prompt);
    $('audio-begin').disabled=!ready||locked||!!s?.audioRun||!flow.ready||s?.suspended||t?.status!=='running'||!!s?.cueId;
    $('audio-confirm').disabled=!flow.canConfirm;
    $('audio-stop').disabled=!flow.active;
    $('audio-test').disabled=locked;
    $('audio-status').textContent=s?.audioRun&&s.audioRun.pageId!==pageId?'이 시행은 다른 화면 또는 이전 접속에서 자동 재생을 시작했습니다. 중복 재생하지 않습니다. 새 시행을 준비해 주세요.':flow.run?.trialId===t?.id?(flow.active&&!flow.ready?'연결 응답 지연 · 현재 음원 유지 / 다음 동작 대기':flow.message):'음원을 선택하고 시행 시작 후 대화를 재생하세요.';
    $('audio-status').classList.toggle('error',['error','stopped'].includes(flow.phase));
    $('audio-pending').textContent=`PC 재생 로그 저장 대기 ${pending}건${queueError?' · '+queueError:''}`;
  }
  for(const kind of ['dialogue','prompt','answer']){
    $(kind+'-file').onchange=async event=>{
      const file=event.target.files[0],version=(versions[kind]||0)+1;versions[kind]=version;delete assets[kind];render();
      if(!file){$(kind+'-info').textContent='선택된 파일 없음';return;}
      $(kind+'-info').textContent='음원 확인 중…';
      try{
        if(file.size>64*1024*1024)throw new Error('64MB 이하의 음원을 선택해 주세요.');
        const bytes=await file.arrayBuffer(),buffer=await ctx().decodeAudioData(bytes.slice(0));
        const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        if(versions[kind]!==version)return;
        assets[kind]={buffer,meta:{name:file.name.slice(0,255),size:file.size,duration:buffer.duration,sha256}};
        $(kind+'-info').textContent=`${file.name} · ${buffer.duration.toFixed(1)}초`;
      }catch(error){if(versions[kind]===version)$(kind+'-info').textContent=error.message?.includes('64MB')?error.message:'재생할 수 없는 파일입니다. MP3 또는 WAV 음원을 선택해 주세요.';}
      render();
    };
  }
  $('audio-test').onclick=async()=>{
    testing=true;render();
    try{await ctx().resume();if(ctx().state!=='running')throw Error();const tone=ctx().createOscillator(),gain=ctx().createGain();tone.frequency.value=660;gain.gain.setValueAtTime(.08,ctx().currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx().currentTime+.35);tone.connect(gain).connect(ctx().destination);tone.onended=()=>{tone.disconnect();gain.disconnect();testing=false;render();};tone.start();tone.stop(ctx().currentTime+.4);$('audio-test-result').textContent='테스트 소리가 TV에서 들리는지 확인하세요. PC 소리 출력 장치를 TV로 선택해야 합니다.';}
    catch{$('audio-test-result').textContent='소리를 시작하지 못했습니다. 브라우저와 PC 소리 설정을 확인해 주세요.';testing=false;render();}
  };
  $('audio-begin').onclick=async()=>{
    if($('audio-begin').disabled)return;
    $('audio-begin').blur();
    const delayMs=Number($('audio-delay').value);
    if(!Number.isInteger(delayMs)||delayMs<0||delayMs>10000){$('audio-test-result').textContent='응답 대기는 0–10,000ms 정수로 입력하세요.';return;}
    preparing=true;render();
    try{await ctx().resume();if(ctx().state!=='running')throw new Error('PC 소리를 시작하지 못했습니다.');const t=getSnapshot().state.trial;await flow.begin({trial:t,assets:{...assets},delayMs,pageId});}
    catch(error){$('audio-test-result').textContent=error.message;}
    finally{preparing=false;render();}
  };
  $('audio-confirm').onclick=()=>void flow.confirm('button');
  $('audio-stop').onclick=()=>flow.cancel();
  document.addEventListener('keydown',event=>{if(flow.canConfirm&&acceptsSpace(event)){event.preventDefault();void flow.confirm('Space');}});
  window.addEventListener('pagehide',()=>flow.cancel('진행자 화면을 나가 재생을 멈췄습니다.'));
  function changedCondition(){
    const key=[$('relationship').value,$('intervention').value,$('scenario').value].join('|');
    if(configKey!==null&&configKey!==key&&!flow.active){
      for(const kind of ['dialogue','prompt','answer']){versions[kind]=(versions[kind]||0)+1;delete assets[kind];$(kind+'-file').value='';$(kind+'-info').textContent='조건 변경 · 음원을 다시 선택하세요.';}
    }
    configKey=key;render();
  }
  for(const id of ['relationship','intervention','scenario'])$(id).addEventListener('change',changedCondition);
  changedCondition();void flush();setInterval(flush,1000);
  return {update(snapshot,connected,ready=connected,diagnostics={}){flow.update(snapshot,connected,ready,diagnostics);render();},get active(){return flow.active;},cancel:reason=>flow.cancel(reason,{},false)};
}
