// Shared participant/admin visual. No audio, timers, or experiment commands.
export function initializeDotAi(host) {
  if (!host) return () => {};
  host.classList.add('dot-ai');
  host.innerHTML='<span class="dot-bounce-group"><span class="dot-orbit">'+Array.from({length:4},(_,i)=>`<span class="ai-dot" style="--i:${i}"><span class="dot-upright"><span class="dot-face"></span></span></span>`).join('')+'</span></span>';
  const panel = host.closest('.ai-area, .icon-preview');
  if (panel && !panel.querySelector('.cue-stars')) {
    const stars = document.createElement('span');
    stars.className = 'cue-stars';
    stars.setAttribute('aria-hidden', 'true');
    // Fixed positions keep the visual consistent between participants.
    let seed = 4173;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    stars.innerHTML = Array.from({length:128}, (_, i) => {
      const x = random() * 100;
      const y = i < 92 ? 78 - x * .56 + (random() + random() - 1) * 32 : random() * 100;
      const size = 1 + random() * 1.8;
      return `<i style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--star-size:${size.toFixed(2)}px;--star-time:${(2.4 + random() * 3).toFixed(2)}s;--star-delay:-${(random() * 6).toFixed(2)}s"></i>`;
    }).join('');
    panel.prepend(stars);
  }
  return state => { host.dataset.state=state; };
}
