import * as legacy from './schedule-legacy.js';
import * as pairedV2 from './schedule-paired-v2.js';
export const DESIGN='williams8-paired-v3';
export const RELATIONS=['friend','coworker'];
export const METHODS=legacy.METHODS;
export const CONDITIONS=RELATIONS.flatMap(relationship=>METHODS.map(intervention=>({relationship,intervention})));
export const RELATION_CODES={friend:'FR',coworker:'BU',partner:'연인'};
export const METHOD_CODES={reactive:'RA',cue:'PC',suggestion:'PS',direct:'PD'};
export const scenarioId=step=>`${RELATION_CODES[step.relationship]}-${step.subtype||step.poi}`;
export function designInfo(design){return design===DESIGN?{blocks:8,episodes:16,cycle:8,note:DESIGN_NOTE}:design===pairedV2.DESIGN?{blocks:12,episodes:24,cycle:12,note:pairedV2.DESIGN_NOTE}:{blocks:0,episodes:12,cycle:12,note:legacy.DESIGN_NOTE};}
export function designRows(seed){
  let a=2166136261;for(const c of seed)a=Math.imul(a^c.charCodeAt(0),16777619);
  const rng=()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};
  const shuffle=()=>{const x=Array.from({length:8},(_,i)=>i);for(let i=7;i>0;i--){const j=Math.floor(rng()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;};
  const symbols=shuffle(),order=shuffle(),base=[0,1,7,2,6,3,5,4];
  return order.map(offset=>({row:offset+1,conditions:base.map(n=>symbols[(n+offset)%8])}));
}
export const CASES=['restaurant','cafe','weather','road'];
export const CASE_LABELS={restaurant:'식당',cafe:'카페',weather:'날씨',road:'도로',museum:'박물관'};
export const DESIGN_NOTE='친구(FR)·직장 관계(BU) × RA·PC·PS·PD: 8조건 묶음 × 2시나리오 = 16회, 묶음 설문 8회. 각 묶음은 장소 1회와 정보 1회이며 식당·카페·날씨·도로 각 4회, 관계별 각 2회입니다. 장소 먼저/정보 먼저 각 4묶음. 8명 단위로 위치·직전 조건, 16명 단위로 조건별 사례 조합·묶음 내 순서가 균형을 이룹니다. 수동 선택과 재시행은 실제 순서 균형을 바꾸며 별도 이력으로 기록됩니다.';
export function validateConfig(config){
  if(config?.design===legacy.DESIGN)return legacy.validateConfig(config);
  if(config?.design===pairedV2.DESIGN)return pairedV2.validateConfig(config);
  if(config?.design!==DESIGN)throw Error('지원하지 않는 배정 방식입니다.');
  return {...legacy.validateConfig({...config,design:legacy.DESIGN}),design:DESIGN};
}
export function allocate(config){
  const c=validateConfig(config);
  if(c.design===legacy.DESIGN)return legacy.allocate(c);
  if(c.design===pairedV2.DESIGN)return pairedV2.allocate(c);
  const rows=designRows(c.seed);
  return c.participants.map((participant,index)=>{
    const d=rows[index%8],cycle=Math.floor(index/8);
    return {participant,allocationIndex:index+1,block:cycle+1,row:d.row,caseVariant:`P${index%4+1}-${cycle%2?'B':'A'}`,steps:d.conditions.flatMap((ci,b)=>{
      const variant=(Math.floor(ci/4)+ci%4+index%4)%4;
      const pair=[variant<2?'restaurant':'cafe',variant%2?'road':'weather'];
      const informationFirst=(ci%4+cycle)%2===1;
      if(informationFirst)pair.reverse();
      return pair.map((subtype,e)=>({position:b*2+e+1,blockPosition:b+1,episodePosition:e+1,condition:`C${String(ci+1).padStart(2,'0')}`,...CONDITIONS[ci],family:['restaurant','cafe'].includes(subtype)?'place':'information',subtype,poi:subtype,pairOrder:informationFirst?'information-first':'place-first',scenario:scenarioId({...CONDITIONS[ci],subtype})}));
    })};
  });
}
export function planProgress(config,attempts=[],surveys=[]){
  if(config.design===legacy.DESIGN)return legacy.planProgress(config,attempts);
  if(config.design===pairedV2.DESIGN)return pairedV2.planProgress(config,attempts,surveys);
  return allocate(config).map(p=>{
    const steps=p.steps.map(step=>{
      const records=attempts.filter(a=>a.participant===p.participant&&a.position===step.position).sort((a,b)=>a.number-b.number);
      return {...step,attempts:records,status:records.some(a=>a.status==='ended')?'complete':records.some(a=>['prepared','running'].includes(a.status))?'active':records.length?'retry':'pending'};
    });
    const blocks=Array.from({length:8},(_,i)=>{
      const pair=steps.slice(i*2,i*2+2),episodesComplete=pair.every(s=>s.status==='complete');
      const survey=surveys.find(s=>s.participant===p.participant&&s.blockPosition===i+1);
      return {blockPosition:i+1,episodesComplete,surveyCompleted:episodesComplete&&!!survey,surveyAt:survey?.completedAt||null};
    });
    const nextBlock=blocks.find(b=>!b.surveyCompleted),pendingSurvey=nextBlock?.episodesComplete?nextBlock.blockPosition:null;
    return {...p,steps,blocks,completed:steps.filter(s=>s.status==='complete').length,completedBlocks:blocks.filter(b=>b.surveyCompleted).length,pendingSurvey,nextPosition:pendingSurvey||!nextBlock?null:steps.find(s=>s.blockPosition===nextBlock.blockPosition&&s.status!=='complete')?.position||null};
  });
}
