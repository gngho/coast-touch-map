import {GlassRenderer} from '/ai-renderer.js';

// Read-only preview of the server state, sharing the participant renderer.
export function initializeAiPreview(canvas) {
  let renderer;
  try {
    renderer = new GlassRenderer([{canvas, state: 'idle'}]);
    canvas.dataset.renderer = 'webgl';
  } catch (error) {
    canvas.hidden = true;
    console.warn('AI preview unavailable; state remains visible as text.', error);
  }
  window.addEventListener('pagehide', () => renderer?.dispose(), {once: true});
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  return state => renderer?.setState(state);
}
