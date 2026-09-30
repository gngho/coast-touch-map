# WebGL Glass AI study

Serve `public/` over HTTP and open `/prototypes/webgl-ai/`. Use the state buttons, **구체 크게 보기**, and **Cue 흐름 재생** to inspect motion. The earlier SVG study remains at `/prototypes/glass-ai/`.

`renderer.js` uses one shared WebGL context, five deforming 3D ribbon meshes, procedural lighting, translucent additive blending, an illustrated glass shell, and bloom. The geometry changes continuously. Glass is stylized, not physically accurate refraction; transparent layers combine light rather than fully occluding each other.

- Idle: slow evolution and low deformation.
- Listening: moderate deformation with two subtle circular wavefronts spreading outward from behind the sphere.
- Thinking: faster circulation and twisting.
- Speaking: large deformation with overlapping pulse frequencies; illustrative, not audio-reactive.
- Twinkle: moving ribbons with a softly breathing blue-violet backlight halo, without stars; waits for touch.

Speed and energy interpolate without resetting animation phase. Demo sequence: Idle 1.2 s → Listening 2.8 s → Twinkle until touch → Thinking 500 ms → Speaking 3.5 s → Idle. Manual selection cancels pending timers.

A fixed 400×400 GPU surface and cached geometry are shared across previews. Main view targets 30 fps, thumbnails 15 fps; these are caps, not measured performance guarantees. Rendering pauses in hidden tabs, honors reduced motion, and rebuilds after context restoration. GPU frames are copied to visible 2D canvases.

No packages, CDNs, microphone access, experiment API or production playback changes. A production integration should use accepted-touch and audio-state events instead of demo timers. Actual iPad/Safari performance and audio synchronization require device testing.
