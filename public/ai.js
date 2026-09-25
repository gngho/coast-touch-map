// Visual state preview only. No microphone, audio, or network connection.
export function initializeAiWidget() {
  const widget = document.getElementById('ai-widget');
  const toggle = document.getElementById('ai-toggle');
  const panel = document.getElementById('ai-panel');
  const label = document.getElementById('ai-state-label');
  const choices = [...panel.querySelectorAll('[data-ai-state]')];
  const labels = {idle: '대기', listening: '듣는 중', thinking: '생각 중', speaking: '말하는 중'};

  function close(restoreFocus = false) {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus({preventScroll: true});
  }

  toggle.addEventListener('click', () => {
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
}
