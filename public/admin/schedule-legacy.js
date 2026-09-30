// Versioned deterministic allocation. Conditions are the 3 x 4 combinations;
// POI is a counterbalanced case assignment, not a 24-level condition factor.
export const DESIGN='williams12-poi-v1';
export const RELATIONS=['friend','partner','coworker'];
export const METHODS=['reactive','cue','suggestion','direct'];
export const CASES=['restaurant','museum'];
export const CONDITIONS=RELATIONS.flatMap(relationship=>METHODS.map(intervention=>({relationship,intervention})));
export const DESIGN_NOTE='참가자당 12조건 각 1회, 식당·박물관 각 6회. 관계별로 각 사례 2회씩 배정합니다. 12명 완성 블록에서 조건의 제시 위치·직전 조건과 조건별 사례 수가 균형을 이룹니다. 24명 완성 블록에서는 제시 위치별 사례 수도 균형을 이룹니다. 중도 탈락·미완료·재시도는 실제 시행의 균형에 영향을 줄 수 있습니다.';
export function validateConfig(config){
  if(config?.design!==DESIGN)throw Error('지원하지 않는 배정 방식입니다.');
  if(typeof config.seed!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(config.seed))throw Error('배정 시드는 영문·숫자·밑줄·하이픈 1–40자로 입력하세요.');
  if(!Array.isArray(config.participants)||config.participants.length<1||config.participants.length>120)throw Error('참가자는 1–120명으로 입력하세요.');
  if(config.participants.some(p=>typeof p!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(p))||new Set(config.participants).size!==config.participants.length)throw Error('참가자 ID를 중복 없이 영문·숫자·밑줄·하이픈 1–40자로 입력하세요.');
  return {design:DESIGN,seed:config.seed,participants:[...config.participants]};
}
function random(seed){let a=2166136261;for(const c of seed)a=Math.imul(a^c.charCodeAt(0),16777619);return ()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
function shuffled(items,rng){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function designRows(seed){
  const rng=random(seed),base=[0,1,11,2,10,3,9,4,8,5,7,6];
  const symbols=shuffled(Array.from({length:12},(_,i)=>i),rng),order=shuffled(Array.from({length:12},(_,i)=>i),rng);
  const patterns=[];
  for(let r=0;r<12;r+=2){
    let bits;
    // Each relationship has 2 restaurant + 2 museum cases, and each AI method
    // has both cases represented (1/2 split across its three relationships).
    do{bits=RELATIONS.flatMap(()=>{const selected=shuffled([0,1,2,3],rng).slice(0,2);return METHODS.map((_,j)=>Number(selected.includes(j)));});}
    while(METHODS.some((_,m)=>{const n=bits[m]+bits[m+4]+bits[m+8];return n===0||n===3;}));
    patterns.push(bits,bits.map(n=>1-n));
  }
  return order.map((offset,row)=>({row:offset+1,conditions:base.map(n=>symbols[(n+offset)%12]),cases:patterns[row]}));
}
export function allocate(config){
  const c=validateConfig(config),rows=designRows(c.seed);
  return c.participants.map((participant,index)=>{
    const design=rows[index%12],cycle=Math.floor(index/12),flip=cycle%2;
    return {participant,allocationIndex:index+1,block:cycle+1,row:design.row,caseVariant:flip?'B':'A',steps:design.conditions.map((conditionIndex,i)=>{
      const condition=CONDITIONS[conditionIndex],poi=CASES[design.cases[conditionIndex]^flip];
      return {position:i+1,condition:`C${String(conditionIndex+1).padStart(2,'0')}`,...condition,poi,scenario:`${poi}-${condition.relationship}-${condition.intervention}`};
    })};
  });
}
export function planProgress(config,attempts=[]){return allocate(config).map(p=>{
  const steps=p.steps.map(step=>{
    const records=attempts.filter(a=>a.participant===p.participant&&a.position===step.position).sort((a,b)=>a.number-b.number);
    const complete=records.some(a=>a.status==='ended'),active=records.some(a=>['prepared','running'].includes(a.status));
    return {...step,attempts:records,status:complete?'complete':active?'active':records.length?'retry':'pending'};
  });
  return {...p,steps,completed:steps.filter(s=>s.status==='complete').length,nextPosition:steps.find(s=>s.status!=='complete')?.position||null};
});}
