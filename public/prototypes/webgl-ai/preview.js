import { GlassRenderer } from './renderer.js';
let renderer;
const states = {
  idle: ['Idle', '대기 중', '필요할 때 터치해 주세요', 'Idle · 낮은 강도로 빛이 흐릅니다. 아이콘은 계속 표시됩니다.'],
  listening: ['Listening', '듣고 있어요', '말씀해 주세요', 'Listening · 구체 뒤에서 은은한 원형 파동이 바깥으로 퍼집니다.'],
  thinking: ['Thinking', '생각 중이에요', '잠시만 기다려 주세요', 'Thinking · 내부 리본이 빠르게 비틀리고 순환합니다. 여기서는 디자인 검토를 위해 상태를 유지합니다.'],
  speaking: ['Speaking', '안내 중이에요', 'AI가 이야기하고 있어요', 'Speaking · 내부 빛이 빠르고 불규칙하게 맥동합니다. 현재는 음원 없는 예시 애니메이션입니다.'],
  twinkle: ['Twinkle', '정보를 드릴 수 있어요', '터치하면 안내해 드릴게요', 'Twinkle · 구체 뒤의 부드러운 후광이 밝아졌다 잦아듭니다. 터치하기 전에는 넘어가지 않습니다.'],
};
const hero = document.querySelector('#hero');
let timers = [];
let sequenceActive = false;
function cancelSequence() { timers.forEach(clearTimeout); timers = []; sequenceActive = false; document.querySelector('#sequence').textContent = 'Cue 흐름 재생'; }
function setState(state) {
  if (!states[state]) return;
  hero.dataset.state = state;
  renderer?.setState(state);
  const [, label, hint, description] = states[state];
  document.querySelector('#state-label').textContent = label;
  document.querySelector('#state-hint').textContent = hint;
  document.querySelector('#description').textContent = description;
  hero.setAttribute('aria-label', `AI ${label}. ${hint}`);
  document.querySelectorAll('[data-select]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.select === state)));
}
function createCanvas(slot) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=400;
  canvas.setAttribute('aria-hidden','true');slot.append(canvas);return canvas;
}
const targets=[{canvas:createCanvas(hero.querySelector('.orb-slot')),state:'idle'}];
for (const [key,[name,label]] of Object.entries(states)) {
  const button=document.createElement('button');button.textContent=name;button.dataset.select=key;button.type='button';
  button.addEventListener('click',()=>{cancelSequence();setState(key);});document.querySelector('#states').append(button);
  const card=document.createElement('article');card.className='state-card';
  card.innerHTML=`<h2>${name}</h2><div class="ai" data-state="${key}" aria-hidden="true"><span class="orb-slot"></span></div><p>${label}</p>`;
  document.querySelector('#comparison').append(card);
  targets.push({canvas:createCanvas(card.querySelector('.orb-slot')),state:key});
}
try {
  renderer=new GlassRenderer(targets);setState('idle');document.body.dataset.renderer='webgl';
} catch(error) {
  document.querySelector('#description').textContent=`WebGL 초기화 실패: ${error.message}`;
  document.body.dataset.renderer='failed';console.error(error);
}
document.querySelector('#sequence').addEventListener('click', () => {
  if (sequenceActive) { cancelSequence(); setState('idle'); return; }
  cancelSequence(); sequenceActive = true;
  document.querySelector('#sequence').textContent = '재생 중지';
  setState('idle'); timers.push(setTimeout(() => setState('listening'), 1200));
  timers.push(setTimeout(() => setState('twinkle'), 4000));
});
hero.addEventListener('click', () => {
  if (hero.dataset.state !== 'twinkle') return;
  cancelSequence(); setState('thinking');
  timers.push(setTimeout(() => setState('speaking'), 500));
  timers.push(setTimeout(() => setState('idle'), 4000));
});
window.addEventListener('pagehide', () => { cancelSequence(); renderer?.dispose(); });
window.addEventListener('pageshow', event => { if(event.persisted) location.reload(); });
const focusButton=document.createElement('button');
focusButton.type='button';focusButton.textContent='구체 크게 보기';focusButton.setAttribute('aria-pressed','false');
document.querySelector('.toolbar').append(focusButton);
focusButton.addEventListener('click',()=>{
  const focused=document.querySelector('.workspace').classList.toggle('focused');
  focusButton.textContent=focused?'지도 배치 보기':'구체 크게 보기';focusButton.setAttribute('aria-pressed',String(focused));
});
