// Shared participant/admin visual. No audio, timers, or experiment commands.
export function initializeDotAi(host) {
  if (!host) return () => {};
  host.classList.add('dot-ai');
  host.innerHTML='<span class="dot-bounce-group"><span class="dot-orbit">'+Array.from({length:4},(_,i)=>`<span class="ai-dot" style="--i:${i}"></span>`).join('')+'</span></span>';
  return state => { host.dataset.state=state; };
}
