// Visual state preview only. No microphone, audio, or network connection.
export function initializeAiWidget({onTouch = () => {}} = {}) {
  let experiment = false;
  const widget = document.getElementById('ai-widget');
  const toggle = document.getElementById('ai-toggle');
  const panel = document.getElementById('ai-panel');
  const label = document.getElementById('ai-state-label');
  const choices = [...panel.querySelectorAll('[data-ai-state]')];
  const labels = {idle: '대기', twinkle: '정보 제공 가능', listening: '듣는 중', thinking: '생각 중', speaking: '말하는 중'};

  function close(restoreFocus = false) {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus({preventScroll: true});
  }

  toggle.addEventListener('click', () => {
    if (experiment) { onTouch(); return; }
    if (!panel.hidden) return close();
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    choices.find(button => button.dataset.aiState === widget.dataset.state).focus({preventScroll: true});
  });
  document.getElementById('ai-close').addEventListener('click', () => close(true));
  for (const button of choices) {
    button.addEventListener('click', () => {
      const state = button.dataset.aiState;
      widget.dataset.state = state;
      label.textContent = labels[state];
      toggle.setAttribute('aria-label', `AI ${labels[state]} · 상태 미리보기`);
      for (const choice of choices) choice.setAttribute('aria-pressed', String(choice === button));
      close(true);
    });
  }
  document.addEventListener('pointerdown', event => {
    if (!widget.contains(event.target)) close();
  });
  widget.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  });
  // Safari can blur a button with relatedTarget=null before a touch generates
  // click. Closing on that blur removes the tapped button too early. Dismiss
  // only when focus actually lands outside; pointerdown handles outside taps.
  document.addEventListener('focusin', event => {
    if (!widget.contains(event.target)) close();
  });
  return {
    setMode(value) {
      if(experiment===value)return;experiment=value;widget.dataset.mode=value?'experiment':'setup';close();
      if(value){toggle.removeAttribute('aria-expanded');toggle.removeAttribute('aria-controls');}
      else{toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','ai-panel');}
      toggle.setAttribute('aria-label',value?'AI 탐색 요청':`AI ${labels[widget.dataset.state]} · 상태 미리보기`);
    },
    setVisible() { widget.hidden=false; },
    setTouchEnabled(value) { toggle.disabled=!value;toggle.setAttribute('aria-disabled',String(!value)); },
    setState(state) {
      widget.dataset.state=state;label.textContent=labels[state];
      toggle.setAttribute('aria-label',experiment?`AI ${labels[state]}${state==='twinkle'?' · 터치하여 정보 받기':''}`:`AI ${labels[state]} · 상태 미리보기`);
      for (const choice of choices) choice.setAttribute('aria-pressed',String(choice.dataset.aiState===state));
    }
  };
}
