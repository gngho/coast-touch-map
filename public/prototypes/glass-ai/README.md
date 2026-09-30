# Glass AI prototype

Open `/prototypes/glass-ai/` through the local development server (`npm start`), or serve `public/` with an HTTP server. Opening `index.html` directly with `file://` cannot load the SVG via fetch.

- `orb.svg`: editable vector sphere, light ribbons, highlights, orbit and sparkle layers.
- `styles.css`: five state animations, responsive placement and reduced-motion support.
- `preview.js`: state selector and a visual Cue sequence. Each inline SVG receives unique IDs.
- `index.html`: simulated map, bottom AI dock and side controls.

Figma: https://www.figma.com/design/PC5DqjyxPbhBPYHaoF81yz?node-id=9-184

The SVG/CSS treatment approximates the reference's glass and luminous fluid appearance; it does not simulate physical refraction. Figma provides editable static state variants; the browser prototype demonstrates animation.

Cue preview: Idle (1.2 s) → Listening (2.8 s) → Twinkle (wait for touch) → Thinking (500 ms) → Speaking (3.5 s) → Idle. These are demonstration timings, not changes to experiment playback. Selecting another state cancels pending transitions.

Speaking pulses are illustrative, not derived from microphone or audio amplitude. No audio, experiment API, trial logs or production UI modules are connected. A production integration should use the existing audio-flow state events and accepted touch handling rather than these preview timers.
