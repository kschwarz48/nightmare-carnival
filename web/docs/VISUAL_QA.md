# Visual QA workflow

How graphics changes are checked against the real game (threejs-qa-release /
threejs-aaa-graphics-builder workflow, adapted to this project). Dev builds only.

## Tooling

* **Test hooks** (`src/dev.ts`) — the skill's determinism contract on
  `window.__THREE_GAME_TEST_HOOKS__`: `seed(n)`, `setState(name)` (returns `{state}`, throws on
  unknown), `setPausedForScreenshot(on)`, `hideDebugUi()`, `states`. Named states:
  `active-play-desktop` (a minute into a night, plaza), `late-combat` (Act IV density, evolved
  arsenal), `boss-ringmaster` (boss lighting, telegraphs, summons). Runs are seeded
  (`startRun({ seed })`).
* **Diagnostics** — `window.__THREE_GAME_DIAGNOSTICS__` (getter): frame, state, time, player,
  enemies, per-frame renderer totals (calls, triangles, geometries, textures).
* **Pixel metrics** — `__nc.metrics()` renders a frame and computes the canvas inspector's metrics
  in-page from the live framebuffer (same 160×90 luminance grid, 4-bit colour buckets, edge
  threshold): `colorEntropyBits`, `edgeDensity`, `luminance {mean,p5,p95,contrast}`,
  `dominantColorShare`, plus renderer totals.
* **Captures** — `await __nc.capture(run, name)` saves the frame to
  `artifacts/visual/<run>/<name>.png` with a `.json` of metrics + diagnostics, through a
  dev-server-only endpoint (`vite.config.ts`, `apply: 'serve'`). `artifacts/` is git-ignored.
* **Framing** — `__nc.shot({ x, y, zoom, dx, dy, restart, char })`; `__nc.bench(frames)` for frame
  time (CPU+GPU with `gl.finish`), draw calls and triangles.

The packaged Playwright inspector (`inspect-threejs-canvas.mjs`) needs `@playwright/test`, `pngjs`
and a downloaded Chromium, which this project does not ship; the in-app browser plus the in-page
port above covered the same checks. The hook contract is implemented, so the inspector can be run
later if those dev dependencies are added.

## Loop

1. `npm run dev`, open the game, wait for the boot screen to finish ("Sculpting the crowd…").
2. For each state: `hooks.seed(42); await hooks.setState(s); await __nc.capture(run, s)`.
3. Inspect the PNGs; note weaknesses against the scorecard; change code; re-capture under a new run
   id; compare side by side. Motion: step the sim and capture a short frame sequence (the death
   scenes were checked this way, `artifacts/visual/motion/`).

## Graphics pass, 2026-10-30 — evidence

Runs captured (all inspected): `before`, `iter1`…`iter8`, `after`, `motion`, `probe`.

### Measured (1600×900, High)

| Capture | entropy (bits) | edge density | contrast | calls | triangles |
|---|---|---|---|---|---|
| before / midway | 4.75 | 0.160 | 83.2 | 233 | 1.23 M |
| after / midway | 4.53 | 0.225 | 68.5 | 263 | 1.70 M |
| before / funhouse | 4.43 | 0.126 | 66.4 | 231 | 1.13 M |
| after / funhouse | 4.15 | 0.170 | 65.2 | 249 | 1.53 M |
| before / east concessions | 4.30 | 0.138 | 61.4 | 231 | 1.18 M |
| after / east concessions | 4.61 | 0.179 | 67.6 | 255 | 1.64 M |
| before / late combat | 5.32 | 0.322 | 105.6 | 245 | 2.23 M |
| after (iter7) / late combat | 5.37 | 0.420 | 113.3 | 278 | 2.59 M |

Edge density (authored detail) rose in every view (+27–40%). Entropy and contrast moved little or
fell slightly in the midway and funhouse views: those frames are now darker between pools by design
(tight pools, deep night). Metrics are advisory; the images are the evidence.

Late-combat frame time (CPU+GPU): 3.46 ms before → ≈4.65 ms steady after (ground ≈1.26 ms after
the GPU field bake; clutter ≈0.7 ms).

### Scorecard (genre equivalents: Hero = the playable carny; Obstacles = enemies + telegraphs;
Rewards = tickets/chests; World = the midway)

| Category | Before | After | Evidence |
|---|---|---|---|
| Art direction | 1.5 | 2 | theme now drives forms (booths, canopies, shingles, queue, generator), not just colour |
| Hero | 2 | 2 | sculpted, inked, rigged carny with realistic anatomy (previous pass) |
| Obstacles/enemies | 1.5 | 2 | death scenes, grimier balloons, telegraphs as painted hazard striping |
| Rewards | 2 | 2 | neon tickets unchanged |
| World | 1 | 2 | relief ground with ruts/puddles/curbs, booth kit, clutter, dressing |
| Materials | 1 | 2 | procedural grain, canvas weathering, chipped paint, rust; relief normals on the ground |
| Lighting/render | 1.5 | 2 | tight pools with sources, long moon shadows, lamp reflections, searchlights, luminous mist |
| VFX/motion | 1.5 | 2 | death scenes, wind-swept grass, crawling telegraphs |
| UI/HUD | 2 | 2 | not in scope |
| Performance evidence | 2 | 2 | per-frame totals, bench before/after, cost attribution |

Average ≈ 2.0 (before ≈ 1.6). Premium threshold (all ≥ 2, average ≥ 2.3) **not yet met**: World,
Materials and Lighting are at 2, not above. Next passes that would raise them: authored dressing
for the remaining attractions (caravans, carts, gate arches, coaster ruin), more distinct enemy
silhouettes for the toy roster, searchlight beams through the mist, and a human playtest of
readability during heavy combat.
