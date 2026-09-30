const states = {
  idle: ['Idle', '대기 중', '필요할 때 터치해 주세요', 'Idle · 낮은 강도로 빛이 흐릅니다. 아이콘은 계속 표시됩니다.'],
  listening: ['Listening', '듣고 있어요', '말씀해 주세요', 'Listening · 내부 빛이 중심으로 모였다 퍼지며 천천히 맥동합니다.'],
  thinking: ['Thinking', '생각 중이에요', '잠시만 기다려 주세요', 'Thinking · 외곽의 빛이 회전합니다. 여기서는 디자인 검토를 위해 상태를 유지합니다.'],
  speaking: ['Speaking', '안내 중이에요', 'AI가 이야기하고 있어요', 'Speaking · 내부 빛이 빠르고 불규칙하게 맥동합니다. 현재는 음원 없는 예시 애니메이션입니다.'],
  twinkle: ['Twinkle', '정보를 드릴 수 있어요', '터치하면 안내해 드릴게요', 'Twinkle · 반짝임과 안내 문구로 개입 가능성을 알립니다. 터치하기 전에는 넘어가지 않습니다.'],
};
const hero = document.querySelector('#hero');
let timers = [];
let sequenceActive = false;
function cancelSequence() { timers.forEach(clearTimeout); timers = []; sequenceActive = false; document.querySelector('#sequence').textContent = 'Cue 흐름 재생'; }
function setState(state) {
  if (!states[state]) return;
  hero.dataset.state = state;
  const [, label, hint, description] = states[state];
  document.querySelector('#state-label').textContent = label;
  document.querySelector('#state-hint').textContent = hint;
  document.querySelector('#description').textContent = description;
  hero.setAttribute('aria-label', `AI ${label}. ${hint}`);
  document.querySelectorAll('[data-select]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.select === state)));
}
// Prefix all SVG IDs so multiple inline instances never share gradient/filter references.
function instance(svg, prefix) { return svg.replace(/id="([^"]+)"/g, `id="${prefix}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`); }
try {
  const response = await fetch('./orb.svg');
  if (!response.ok) throw new Error(`SVG ${response.status}`);
  const svg = await response.text();
  hero.querySelector('.orb-slot').innerHTML = instance(svg, 'hero');
  hero.querySelector('svg').setAttribute('aria-hidden', 'true');
  for (const [key, [name, label]] of Object.entries(states)) {
    const button = document.createElement('button');
    button.textContent = name; button.dataset.select = key; button.type = 'button';
    button.addEventListener('click', () => { cancelSequence(); setState(key); });
    document.querySelector('#states').append(button);
    const card = document.createElement('article'); card.className = 'state-card';
    card.innerHTML = `<h2>${name}</h2><div class="ai" data-state="${key}" aria-hidden="true"><span class="orb-slot">${instance(svg, key)}</span></div><p>${label}</p>`;
    document.querySelector('#comparison').append(card);
  }
  setState('idle');
} catch (error) { document.querySelector('#description').textContent = `시안을 불러오지 못했습니다. HTTP 서버로 열어 주세요. ${error.message}`; }
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
window.addEventListener('pagehide', cancelSequence);
