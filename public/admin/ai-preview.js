import {initializeDotAi} from '/dot-ai.js';
export function initializeAiPreview(host) { const update=initializeDotAi(host);update('idle');return update; }
