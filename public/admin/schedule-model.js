import * as legacy from './schedule-legacy.js';
export const DESIGN='williams12-paired-v2';
export const {RELATIONS,METHODS,CONDITIONS,designRows}=legacy;
export const CASES=['restaurant','cafe','weather','road'];
export const CASE_LABELS={restaurant:'식당',cafe:'카페',weather:'날씨',road:'도로',museum:'박물관'};
export const DESIGN_NOTE='12조건 묶음 × 2시나리오 = 24회 경험, 묶음 설문 12회. 각 묶음은 같은 관계·AI 방식으로 장소 1회와 정보 1회를 진행합니다. 식당·카페·날씨·도로 각 6회, 관계별 각 2회입니다. 장소 먼저/정보 먼저 각 6묶음. 12명 단위로 묶음 위치와 직전 조건이, 24명 단위로 조건별 시나리오 조합과 묶음 내 순서가 균형을 이룹니다. 미완성 모집 블록에서는 완전한 균형을 보장하지 않습니다.';
export function validateConfig(config){
  if(config?.design===legacy.DESIGN)return legacy.validateConfig(config);
  if(config?.design!==DESIGN)throw Error('지원하지 않는 배정 방식입니다.');
  return {...legacy.validateConfig({...config,design:legacy.DESIGN}),design:DESIGN};
}
export function allocate(config){
  const c=validateConfig(config);
  if(c.design===legacy.DESIGN)return legacy.allocate(c);
  const rows=designRows(c.seed);
  return c.participants.map((participant,index)=>{
    const d=rows[index%12],cycle=Math.floor(index/12);
    return {participant,allocationIndex:index+1,block:cycle+1,row:d.row,caseVariant:`P${index%4+1}-${cycle%2?'B':'A'}`,steps:d.conditions.flatMap((ci,b)=>{
      const variant=(Math.floor(ci/4)+ci%4+index%4)%4;
      const pair=[variant<2?'restaurant':'cafe',variant%2?'road':'weather'];
      const informationFirst=(ci%4+cycle)%2===1;
      if(informationFirst)pair.reverse();
      return pair.map((subtype,e)=>({position:b*2+e+1,blockPosition:b+1,episodePosition:e+1,condition:`C${String(ci+1).padStart(2,'0')}`,...CONDITIONS[ci],family:['restaurant','cafe'].includes(subtype)?'place':'information',subtype,poi:subtype,pairOrder:informationFirst?'information-first':'place-first',scenario:`${subtype}-${CONDITIONS[ci].relationship}-${CONDITIONS[ci].intervention}`}));
    })};
  });
}
export function planProgress(config,attempts=[],surveys=[]){
  if(config.design===legacy.DESIGN)return legacy.planProgress(config,attempts);
  return allocate(config).map(p=>{
    const steps=p.steps.map(step=>{
      const records=attempts.filter(a=>a.participant===p.participant&&a.position===step.position).sort((a,b)=>a.number-b.number);
      return {...step,attempts:records,status:records.some(a=>a.status==='ended')?'complete':records.some(a=>['prepared','running'].includes(a.status))?'active':records.length?'retry':'pending'};
    });
    const blocks=Array.from({length:12},(_,i)=>{
      const pair=steps.slice(i*2,i*2+2),episodesComplete=pair.every(s=>s.status==='complete');
      const survey=surveys.find(s=>s.participant===p.participant&&s.blockPosition===i+1);
      return {blockPosition:i+1,episodesComplete,surveyCompleted:episodesComplete&&!!survey,surveyAt:survey?.completedAt||null};
    });
    const nextBlock=blocks.find(b=>!b.surveyCompleted),pendingSurvey=nextBlock?.episodesComplete?nextBlock.blockPosition:null;
    return {...p,steps,blocks,completed:steps.filter(s=>s.status==='complete').length,completedBlocks:blocks.filter(b=>b.surveyCompleted).length,pendingSurvey,nextPosition:pendingSurvey||!nextBlock?null:steps.find(s=>s.blockPosition===nextBlock.blockPosition&&s.status!=='complete')?.position||null};
  });
}
