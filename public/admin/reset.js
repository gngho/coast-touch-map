export function initRecordReset({getSnapshot,command,onSuccess}){
  const $=id=>document.getElementById(id),dialog=$('reset-dialog');let target=null,requestId=null,sending=false;
  function finish(){dialog.close();target=null;requestId=null;onSuccess();}
  function update(){
    const s=getSnapshot()?.state;
    $('reset-records').disabled=!s||!s.trialCount;
    if(!dialog.open)return;
    if(requestId&&s?.lastReset?.id===requestId){finish();return;}
    const active=['prepared','running'].includes(s?.trial?.status),changed=s?.generation!==target?.generation;
    $('reset-confirm').disabled=sending||active||changed||$('reset-text').value!=='초기화';
    $('reset-text').disabled=sending||active||changed;
    $('reset-cancel').disabled=sending;
    if(active)$('reset-error').textContent='현재 시행을 종료하거나 중단한 뒤 초기화해 주세요.';
    else if(changed)$('reset-error').textContent='시행 상태가 변경되었습니다. 창을 닫고 다시 열어 삭제 범위를 확인하세요.';
  }
  $('reset-records').onclick=()=>{
    const s=getSnapshot()?.state;if(!s?.trialCount)return;
    target={generation:s.generation,count:s.trialCount};requestId=null;
    $('reset-count').textContent=`현재 세션의 시행 ${s.trialCount}개와 모든 메모·터치·재생 로그를 삭제합니다.`;
    $('reset-text').value='';$('reset-error').textContent='';dialog.showModal();update();$('reset-cancel').focus();
  };
  $('reset-text').oninput=update;
  $('reset-cancel').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',event=>{if(sending)event.preventDefault();});
  $('reset-form').onsubmit=async event=>{
    event.preventDefault();update();if($('reset-confirm').disabled)return;
    requestId??=crypto.randomUUID();sending=true;update();
    try{
      const result=await command('reset_records',{id:requestId,baseGeneration:target.generation,expectedTrialCount:target.count,confirmation:$('reset-text').value},true);
      if(result&&dialog.open)finish();
    }catch(error){$('reset-error').textContent=error.message;}
    finally{sending=false;update();}
  };
  return {update};
}
