import {request,endpoint} from '/sync.js';
import {summaryHtml,timelineHtml,summaryRows,eventRows,toCsv,kst,measurementNote} from './report-model.js';
export function initReports({getAuth}){
  const $=id=>document.getElementById(id);let data=null,loading=false,revision=0;
  $('report-method').textContent=measurementNote;
  function timeline(){if(data)$('report-timeline').innerHTML=timelineHtml(data,$('report-trial').value,$('report-technical').checked);}
  async function refresh(){
    if(loading)return false;const version=revision;loading=true;$('report-refresh').disabled=true;
    try{
      const auth=getAuth();if(!auth)throw Error('진행자 세션을 연결한 뒤 기록을 불러오세요.');
      const result=await request(endpoint(auth,'export?format=json'),{auth});
      // Ignore results from an auth/session replaced while loading.
      if(version!==revision)return false;
      if(getAuth()?.token!==auth.token)throw Error('세션이 변경되었습니다. 다시 불러오세요.');
      data=result;$('report-summary').innerHTML=summaryHtml(data);
      const selected=$('report-trial').value;
      $('report-trial').replaceChildren(new Option('전체 시행과 세션 기록',''),...data.trials.map(t=>new Option(`시행 ${t.number} · ${t.participant} · ${t.scenario||'미입력'}`,t.id)));
      if(data.trials.some(t=>t.id===selected))$('report-trial').value=selected;
      timeline();$('report-status').textContent=`${data.trials.length}개 시행 · ${data.events.length}개 이벤트 · 불러온 시각 ${kst(Date.now())} KST. iPad·PC 저장 대기가 0건인지 확인하세요. 새 기록은 ‘기록 다시 불러오기’로 갱신합니다.`;return true;
    }catch(e){$('report-status').textContent=`불러오기 실패: ${e.message}${data?' 기존에 불러온 기록을 표시 중입니다.':''}`;return false;}
    finally{loading=false;$('report-refresh').disabled=false;}
  }
  $('open-reports').onclick=()=>{$('reports').open=true;$('reports').scrollIntoView({behavior:'smooth'});};
  $('reports').addEventListener('toggle',()=>{if($('reports').open&&!data)void refresh();});
  $('report-refresh').onclick=refresh;$('report-trial').onchange=timeline;$('report-technical').onchange=timeline;
  document.querySelectorAll('[data-report-export]').forEach(b=>b.onclick=async()=>{
    if(loading)return;
    if(!await refresh())return;
    const summary=b.dataset.reportExport==='summary',rows=summary?summaryRows(data):eventRows(data);
    if(!rows.length){$('report-status').textContent='내보낼 기록이 없습니다.';return;}
    const url=URL.createObjectURL(new Blob([toCsv(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download=`coast-${summary?'summary':'readable-events'}-${kst(Date.now()).slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  return {clear(){revision++;data=null;$('report-summary').replaceChildren();$('report-timeline').replaceChildren();$('report-trial').replaceChildren(new Option('전체 시행과 세션 기록',''));$('report-status').textContent='기록이 초기화되었습니다. 새 시행 후 다시 불러오세요.';}};
}
