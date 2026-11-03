# Performance audit and optimization — Nightmare Carnival (D-96)

2026-11-02. A measured audit of every map, solo and co-op, on the owner's PC, then the changes the measurements
pointed to, each re-measured on the same workloads. The earlier engineering pass (D-73) is in
`ENGINEERING_OPTIMIZATION_REPORT.md`; this one starts from where it left off.

**Machine:** Intel i9-9900K, NVIDIA RTX 2070, 32 GB, Windows 11; primary display 3440×1440 at 165 Hz.
**Builds measured:** a production build with the dev tools compiled in (`VITE_DEVTOOLS=1 npx vite build --outDir
dist-bench`), served by the benchmark runner itself (no dev server, no browser pane competing for the GPU), in
Electron 44.9.3 (Chromium 152) full screen with vsync; GPU time from `EXT_disjoint_timer_query_webgl2`. The
"before" build is the last commit before this pass (8766edb, D-95), kept as a copy and measured the same way.
Headless numbers come from Node 22 (V8 12.4). All numbers below were measured; none are estimates unless marked.
The raw results (JSON, logs, profiles, captures) are kept on the owner's PC in `artifacts/perf/`, outside the
repository; every command to reproduce them is in G.

## A. Audit summary

**Architecture as measured.** A fixed 60 Hz simulation (accumulator, up to 5 catch-up ticks) drives an interpolated
Three.js (r169) renderer: one instanced batch per model kind (crowd, characters, items, the world's kit), decal and
billboard layers rebuilt each frame, a pooled-light system with tiled culling, a moon shadow map, and a post chain
(half-float scene target, half-resolution bloom, ACES, a vintage grade). Sculpted models are built in workers at
boot. Co-op is host-authoritative over WebRTC (PeerJS): the host simulates everyone, sends delta-compressed,
interest-managed snapshots at 20–30 Hz on an unreliable channel, and receives redundant 60 Hz inputs; a guest
predicts its own movement (replaying unacknowledged inputs on each snapshot) and interpolates everything else.

**Where the time went (baseline, before this pass).**

- **GPU, late nights:** the frame was GPU-bound in every heavy scene at 3440×1440: Fun House 23.3 ms, Boardwalk
  24.5 ms of GPU per frame (42 and 40 fps), Ghost Train 13.7, Carnival 11.6. Switching one thing off at a time
  showed the crowd's models were 7–17 ms of it (geometry-bound: halving the resolution saved only ~3.6 ms), the
  shadow pass 1–2 ms, bloom ~0.2 ms; the Fun House mirrors 11 ms (they re-draw the crowd).
- **Even light scenes** needed ~6.5 ms of GPU at 3440×1440 (the menu), above the 6.06 ms a 165 Hz frame allows.
- **CPU, the Ghost Train's simulation:** 5–10 times any other map's (a two-player host night: 1.77 ms a tick on
  average, 3.8 ms at p99), half of it the creatures' wall push-out; ~80 minor collections a second in the browser in
  the late scenarios (534 ms of GC in 20 s), ~10 a second in Node.
- **CPU, rendering:** 4–7 ms a frame in heavy scenes, mostly three.js's per-object setup (program, material
  uniforms, buffers) in every pass; the costliest objects were batches with nothing to draw: every creature kind met
  so far that night (each with its own material) was set up in every pass, alive or not. The world kit of places off
  screen was drawn too (the Ghost Train drew all six places' kit every frame), but cheaply (one shared material).
  The game's own costliest function was the ground circles' trigonometry.
- **Not bottlenecks (measured):** bloom, the shadow pass after the crowd's fix, the HUD (0.2–0.4 ms), snapshot
  encoding (0.35–0.44 ms per guest per snapshot), GC outside the Ghost Train, the network (sizes unchanged).

**Headline results (same scenarios, before → after, 3440×1440 High, vsync at 165 Hz):**

| scenario | fps | GPU ms / frame | CPU ms / frame | frames over 25 ms |
|---|---|---|---|---|
| Fun House late, 400 creatures | 42 → **61** | 23.3 → 15.8 | 9.0 → 7.0 | 407 → 3 |
| Boardwalk late, 400 creatures | 40 → **61** | 24.5 → 15.9 | 7.9 → 7.6 | 175 → 3 |
| Ghost Train late, 400 creatures | 69 → **101** | 13.7 → 9.5 | 8.3 → 3.8 | 6 → 1 |
| Ghost Train, the Night Express | 82 → **118** | 10.6 → 8.0 | 7.9 → 3.6 | 0 → 0 |
| Ghost Train at 10:00 | 97 → **140** | 9.3 → 6.7 | 6.9 → 3.4 | 0 → 0 |
| Carnival late, 400 creatures (three runs each) | 81–82 → **108–115** | 11.7–11.9 → 8.3–8.9 | 4.7–5.0 → 3.6–3.8 | 1–6 → 1–5 |
| Boardwalk, the Leviathan (three runs each) | 69–70 → **92–94** | 13.6–13.8 → 10.2–10.4 | 5.8–6.6 → 4.8 | 1–3 → 0–2 |
| the menu | 146 → **161** | 6.5 → 6.0 | 2.6 → 2.5 | 0 → 0 |

- The Ghost Train's simulation is 4–5× cheaper (a two-player host night: 1.77 → 0.35 ms a tick); in the browser
  its late nights' minor collections fell from ~80 a second to ~6 (534 → 54 ms of GC in 20 seconds).
- A map's first night no longer freezes for 1.7–5.2 seconds: it waits 1.5–2.3 seconds behind the loading screen
  instead (its longest frame 0.4–0.8 s, while the screen is up) and then runs smoothly.
- Twelve nights in a row in one page: no growth after each map's first visit (heap 319–322 MB, programs 74).
- Nothing changed on the wire (snapshot sizes identical) and the bot nights came out the same.

## B. Implemented optimizations

Each change is listed with the problem, the evidence, what changed, the measured result and what it does to the
game. None changes a rule, a save, the network protocol (PROTO stays 19) or how anything looks at play size.

### 1. Packed wall sets: the Ghost Train's simulation 4–5× faster (`sim/walls.ts`)

- **Problem.** Every creature that walks pushed itself out of nearby walls each tick (`Nav.collide`), and players
  did too (`collideBody`, on the host and in a guest's prediction). The static walls were bucketed, but every one
  of the moving walls (the Ghost Train's 79 doors and partitions, the Fun House's panels) was checked by every
  creature every tick, and the player checked all 1,395 Ghost Train props unbucketed. The props are object
  literals of dozens of shapes, so each `pr.x`, `pr.r`, `pr.hw` read in the push-out was a megamorphic lookup.
- **Evidence.** CPU profile of a two-player Ghost Train night: `Nav.collide` 26.8% and `pushOut` 26.3% of all
  samples. Allocation profile (collected objects included): `pushOut` 87% of all allocation, about 1.5 MB per tick:
  a function of plain arithmetic allocates only while V8 runs it unoptimized (its trace showed `pushOut` deoptimized
  and re-optimized over and over), boxing every number. That churn was ~10 minor collections a second in Node and
  ~80 a second in the browser (1,605 in a 20-second late scenario, 534 ms of GC).
- **Change.** A `WallSet` copies a set of walls once into flat typed arrays (x, y, r, hw, hh) filed in 160-unit
  buckets (compressed rows); a body visits only its bucket's walls, every read a typed-array load. The rules are the
  old ones exactly: the same push-out per wall, the walls in their original order, each filed within 48 units of
  its edges (more than the widest walker, 39), so every wall that can touch a body is visited. The map's props are
  one set per map; the moving walls are one set per arrangement: the Fun House and the Ghost Train now hand over
  the same array while their walls stay put (built once per arrangement instead of every tick). Players, creatures
  and a guest's prediction all use these sets, so host and guest still collide alike.
- **Result.** Two-player Ghost Train host night: 1.774 → 0.349 ms a tick (mean), 3.82 → 1.82 ms (p99), 12,913 →
  2,171 collections; solo 0.889 → 0.221 ms. In the browser, the late Ghost Train scenarios' minor collections:
  1,605 → 121 and 1,665 → 168 in 20 seconds (534 → 54 ms and 541 → 66 ms of GC); the Ghost Train's sim share of the
  frame 2.88 → 0.46 ms (late) and 1.28 → 0.25 ms (boss). Fun House 0.162 → 0.105 ms a tick (its panels are moving
  walls too); the other maps 5–10% (the player's push-out). A co-op guest's prediction (the same push-out, replayed
  on each snapshot) gains the same way: see D.
- **Game impact.** None measured: tested against the old pass over every wall (`tests/walls.test.ts`: 12,754 random
  bodies, 4,010 of them pushed, identical to the last bit; wall checks identical over 20,000 points); the bot nights
  came out the same (identical crowd counts in every window, identical snapshot sizes); `scripts/gt_smoke.ts`: four
  train transfers, no faults.

### 2. The crowd's distance models: the late-night GPU frame down a third (`render3d/core/simplify.ts`)

- **Problem.** A sculpted creature is 5,000–35,000 triangles (mean 9,300), drawn four times (the picture, its ink
  hull, the moon's shadow, the silhouette shown behind scenery). At play size a creature is 60–120 pixels tall:
  two or more triangles to a pixel, which the GPU processes at full cost and mostly throws away.
- **Evidence.** GPU split of a frozen late frame at 3440×1440 (timer queries, one thing switched off at a time):
  hiding the crowd saved 7.2 ms of 13.5 (Carnival, 368 creatures), 17.1 of 23.9 (Fun House, 304; the mirrors
  re-draw it) and 13.8 of 19.9 (Boardwalk, 359), while halving the resolution saved only ~3.6 ms: geometry-bound,
  not fill-bound. Triangles per frame: 10.8 M, 31.1 M, 14.7 M.
- **Change.** The first time a crowd batch is drawn it sends its geometry to a worker (`models/lodWorker.ts`), which
  simplifies it by quadric error with half-edge collapses: a vertex is folded into a neighbour that stays where it
  is, so every surviving vertex is an original one (normal, colours, bones, pattern untouched; nothing
  interpolated). Kept: the edges of open parts, small separate parts (under 6 units: eyes, noses, buttons, teeth),
  folds across a change of pattern, surface, ink, main bone or colour, and any fold that would flip or crush a
  triangle; no fold may move the surface more than 1.2 model units (finer than the sculpts' 1.5–3-unit cells).
  The copy (about 30–45% of the triangles) shares the batch's instances, materials and shadow, with its own ink
  and silhouette twins (`ActorBatch.setLod`). `lodMode` 'auto' uses it while the view is at play size, no finer
  than 2.5 device pixels to a world unit (1.1 at 1080p, 1.8 at 3440×1440, 2.2 at 4K), and the full sculpt when
  zoomed closer (the inspector, close captures). Until the copy arrives (a moment after the kind first appears),
  without workers, or for a model already plain, the full model draws.
- **Result.** Same frozen frame, same session, full models → distance models: Carnival 11.9 → 9.1 ms GPU, Fun
  House 21.4 → 14.0 ms (its mirrors 11 → 2–5 ms, depending on which mirror rows a probe catches), Boardwalk 17.9 → 11.9 ms (before the ink hulls also took
  the copy, which the final numbers below include). Triangles across all 65 crowd models: 602 k → 263 k (43.6%),
  built in ~65 ms per model off the main thread.
- **Game impact.** Compared at play size and at twice play size against the full sculpts (`scripts/bench/lod-compare.js`,
  captures kept on the owner's PC in `artifacts/perf/lod/`, outside the repository): the same silhouettes and shading; the faces kept their eyes once small parts
  were left whole (the first cut, without that rule, smudged them, and was not kept). `tests/simplify.test.ts`
  checks the rules (only original vertices, attributes kept, small parts whole, deterministic, real models
  roughly halved).

### 3. Area filing: only the part of the map in view is drawn (`render3d/world/areas.ts`) — a small gain

- **Problem.** A world's kit is one instanced batch per kind of prop, and instanced batches are never frustum-culled,
  so maps larger than the view drew every lamp, bench and booth on the map every frame, in the picture and the
  shadow pass. The Ghost Train is six places 1,800+ units apart (the camera only ever shows one); the Boardwalk is an
  8,000-unit front (the view spans about 1,900).
- **Evidence.** Scene census: the Ghost Train submitted 274 visible meshes of which only 5 could be frustum-culled.
  (Source-mapped profiles put three.js's draw submission at two thirds of the Ghost Train's main thread, but that
  profile came after other maps in the same page: most of it was the empty batches of section 7. The kit's batches
  all share one material, so three.js submits them cheaply; see the result.)
- **Change.** The Ghost Train files its kit by place and the Boardwalk by 2,000-unit strips (each stretched piece of
  railing by where it stands); each frame only the areas the view reaches draw (each area grown by more than
  anything near its edge reaches: 400 units on the Ghost Train, 700 on the Boardwalk, whose widest prop reaches 600).
- **Result.** Draw calls at the same spots (filing off → on, the same build): Ghost Train ~285 → 54–110, Boardwalk
  ~390 → 220–330. In the Boardwalk's late scenarios (filing off → on): GPU 14.9 → 14.5 ms and 10.4 → 10.1 ms, draw
  calls 459 → 392 and 479 → 402. That is the Boardwalk's whole gain: its kit is spread along the front and the view
  with its margins spans two or three of the four strips, so against the old unsplit batches the draw calls come
  out about even (a kind standing in two visible strips draws twice). The Ghost Train's places are far apart, so
  only one is ever drawn, and the draw calls halve (the four scenarios, filing off → on: 302 → 125, 337 → 162, 322 →
  145, 353 → 175), but the frame barely moves: render CPU within ±0.05 ms, GPU −0.1 and −0.5 ms in the early and
  mid scenarios and within run-to-run noise in the late ones. Kept because it is free and exact, not for its size.
- **Game impact.** None: the same frozen frame drawn with every area and with only those in view, at 18 camera
  positions (both sides of every Boardwalk strip edge, every Ghost Train place), differs in 0 pixels
  (`scripts/bench/area-compare.js`).

### 4. Ground shapes from corner tables (`render/shapes.ts`)

- **Problem / evidence.** Every circle and ring on the ground (one under each ticket, each enemy bullet, each
  shadowless creature, every zone) called `Math.cos` and `Math.sin` for every corner every frame: `circle` was the
  costliest function of the game's own code in all three heavy-night profiles (6% of all samples, ~10% of the busy
  main thread).
- **Change / result.** The corners come from a table per corner count, computed with the loops' own expressions, so
  the vertices are the very same numbers (`tests/optimization.test.ts` compares them). `circle`: ~520 → ~105 ms per
  8 seconds of profile (5×).

### 5. The HUD writes only what changed

- **Problem / evidence.** The HUD set its level, clock, act, health text and bar widths every frame even when nothing
  had changed (each write dirties style and layout), and in co-op rebuilt the name tags from new elements every
  frame. HUD: 0.2–0.4 ms a frame.
- **Change.** A small write guard (`write(el, key, value)`) skips unchanged texts and styles; the co-op name tags are
  kept per player and only moved; markers, arrows and bars set `display`/`opacity` only when they change.
- **Result.** The HUD's own timer didn't move (0.17–0.45 ms a frame after, within noise): what this saves is the
  browser's style and layout work later in the frame, which that timer doesn't see, and the co-op tags' garbage.
  Kept as hygiene, not as a measured gain.

### 6. No multisampling on the canvas

- **Problem / evidence.** The canvas asked for a 4× multisampled buffer (`antialias: true`), but the scene draws into
  the post chain's own (non-multisampled) target and the canvas only ever receives the grade's full-screen quad:
  at 3440×1440 a large buffer and a resolve every frame for nothing.
- **Change / check.** `antialias: false`. A fixed frame captured in builds with and without it differs outside the
  player's (run-to-run varying) pose in 2,988 pixels, fewer than two captures of the same build (7,987).
  Its frame-time effect was not isolated: the attribute can't change in a running page and one run each way is
  inside run-to-run noise. By the buffers' sizes it frees about 160 MB of video memory at 3440×1440 (4× colour and
  depth samples; an estimate, not a measurement).

### 7. Empty batches are skipped (`render3d/core/batch.ts`)

- **Problem.** The renderer keeps one batch per model kind seen in the session, and three.js skips the draw call of
  an empty instanced mesh but still sets up its program, uniforms and buffers in every pass (the picture, the
  shadow, each Fun House mirror). So every creature kind met on any map tonight cost that each frame, alive or not,
  and so did a full model while its distance copy drew. The draw-call counter doesn't show it (no call is made).
- **Evidence.** The same Ghost Train scenario cost 3.72 ms of render CPU after the other maps' scenarios in one
  session, 2.15 ms on its own; source-mapped profiles showed three.js's per-object setup (`setProgram`, uniform
  uploads, vertex-array binding) dominating the main thread.
- **Change.** A batch's meshes are frustum-culled by a bounding sphere that is all of space while they hold instances
  (never culled, as before; the clutter keeps the real bounds it computes) and a point far below the world while
  empty; each mesh has its own spheres (three.js rewrites the one it finds). `visible` stays the callers'.
- **Result.** Boardwalk late night: render CPU 5.96 → 4.28 ms, frame CPU 7.10 → 5.37 ms (same build otherwise).
  In the final full run the Ghost Train's render CPU (after the other maps in the same page, as players move
  between maps): 3.83 → 2.18 ms (2:00), 5.61 → 2.86 (10:00), 5.07 → 2.97 (late), 6.16 → 2.95 (the boss), most of
  it this change (the same scenario on its own, before it: 2.15 ms).

### 8. A map's first night waits behind the loading screen (`renderer3d.prepareWorld`, `app.awaitWorld`)

- **Problem.** The boot warm-up compiles the menu's world in the background; every other map built its world and
  compiled its 6–12 new shader programs on the first frame of its first night, the game frozen meanwhile.
- **Evidence.** The long-session check: the first three seconds of each map's first night held a 1.3 s (Fun House),
  4.2 s (Boardwalk) and 4.8 s (Ghost Train) frame, then 12–30 ms on every later visit. Split: building the world
  70–715 ms, the rest compiling (ANGLE translates each shader on the main thread, then the driver compiles).
- **Change.** The night's first frame checks whether its map's world is ready; if not, the night doesn't tick or
  draw, the loading screen shows "Setting up The Boardwalk…", and the renderer builds the world and compiles its
  shaders in the background (`KHR_parallel_shader_compile`, against the post chain's target, as the boot warm-up
  does). Without the extension (or with `?legacy=compile`) every map counts as ready, as before; if anything fails,
  the map counts as ready and the night's first frame does the work on the spot. Co-op: each machine waits for its
  own; the host's night holds while it does.
- **Result.** See the table under C, "A long session": the worst frame 1.7–5.2 s → 0.4–0.8 s, playable 0.6–3.3 s
  sooner, the night's first seconds smooth (worst 49–109 ms).

### 9. Diagnostics (dev builds; a shipped build with `?devhud`)

- The F2 overlay adds: whether the crowd draws its distance models (and how many kinds have one), the heap's climb
  rate and visible drops (collections), and in co-op each snapshot's encoding (host) or decoding and applying
  (guest) time, mean and worst over the last second, and messages a second each way. The guest's decoding runs as
  snapshots arrive, between frames, so it appeared in no section of the frame's CPU split before.

### Tried and not kept

- **Priming the Game's fields as fractions.** Seven Game fields start as small integers and become fractions mid-night;
  each change replaces the Game's hidden class, and in Node's V8 the bullets' loop then re-entered stale optimized
  code and bailed out ~1,500 times in 150 seconds. Storing a fraction first removed the trigger, but measured no
  difference once the walls were fixed (each bail-out happens at the function's last line), so it was removed.
- **A coarser copy for the silhouettes and the shadow.** With the distance models in, the silhouette pass costs
  0.2–0.9 ms and the shadow pass 0.4–0.8 ms: too little to be worth another model level.

## C. Before and after

### Real-time, on the GPU (3440×1440 full screen, High, vsync at 165 Hz)

The thirteen scenarios of `desktop/bench.js` (each a fresh night fast-forwarded to its time, the autopilot playing,
a heavy late build in the late scenarios, the crowd topped up to 400 where named; 15–20 seconds measured after a
3-second warm-up), both builds the same day, GC traced (`--gc`). "Spikes" are frames over 25 ms. This run used the
build before the last two changes: the first-night veil (outside these windows) and a fix to the ground shapes'
corner tables, which had created a closure per circle (allocation, so the minor-GC column here is the pessimistic
one; the repeat runs below used the final build).

| scenario | fps | frame mean / p99 ms | spikes >25 ms | CPU ms | render / sim CPU ms | GPU ms | draw calls | triangles (M) | minor GCs (ms) |
|---|---|---|---|---|---|---|---|---|---|
| menu (attract demo) | 146 → **161** | 6.92 / 12.2 → 6.30 / 12.2 | 0 → 0 | 2.55 → 2.47 | 2.40 / 0.10 → 2.33 / 0.09 | 6.50 → **6.04** | 265 → 268 | 2.4 → 2.4 | 28 (11) → 34 (14) |
| carnival early 2:00 | 138 → **149** | 7.33 / 12.3 → 6.75 / 12.2 | 0 → 1 | 2.95 → 2.63 | 2.63 / 0.08 → 2.33 / 0.07 | 6.83 → **6.43** | 270 → 274 | 2.3 → 2.1 | 52 (26) → 70 (33) |
| carnival mid 10:00 | 108 → **130** | 9.35 / 12.3 → 7.73 / 12.3 | 4 → 1 | 3.86 → 3.24 | 3.39 / 0.15 → 2.82 / 0.13 | 8.66 → **7.30** | 284 → 282 | 4.0 → 2.7 | 91 (40) → 144 (61) |
| carnival late, crowd 400 | 82 → **101** | 12.20 / 18.3 → 9.95 / 18.2 | 1 → 6 | 4.53 → 4.72 | 3.83 / 0.37 → 3.94 / 0.39 | 11.60 → **9.45** | 250 → 255 | 10.2 → 5.7 | 96 (46) → 134 (63) |
| carnival boss: Ringmaster | 102 → **122** | 9.84 / 12.3 → 8.26 / 12.3 | 0 → 0 | 4.40 → 3.71 | 3.86 / 0.22 → 3.20 / 0.19 | 9.26 → **7.86** | 267 → 268 | 5.4 → 3.4 | 108 (53) → 129 (58) |
| fun house late, crowd 400 | 42 → **61** | 24.07 / 36.5 → 16.41 / 24.3 | 407 → 3 | 8.99 → 6.97 | 7.39 / 1.11 → 5.88 / 0.61 | 23.25 → **15.82** | 380 → 410 | 31.6 → 15.8 | 240 (100) → 184 (89) |
| boardwalk late, crowd 400 | 40 → **61** | 25.24 / 30.5 → 16.56 / 24.2 | 175 → 3 | 7.86 → 7.56 | 6.30 / 1.08 → 6.11 / 0.91 | 24.46 → **15.93** | 354 → 392 | 19.8 → 12.6 | 151 (70) → 210 (100) |
| boardwalk boss: Leviathan | 65 → **87** | 15.53 / 18.3 → 11.59 / 18.4 | 2 → 2 | 6.47 → 6.24 | 5.58 / 0.47 → 5.36 / 0.39 | 14.72 → **10.89** | 370 → 408 | 9.4 → 6.1 | 177 (72) → 173 (77) |
| ghost train early 2:00 | 157 → **165** | 6.42 / 12.2 → 6.10 / 6.3 | 0 → 0 | 4.29 → 2.51 | 3.83 / 0.22 → 2.18 / 0.10 | 5.84 → **5.57** | 250 → 125 | 2.2 → 1.3 | 179 (66) → 50 (24) |
| ghost train mid 10:00 | 97 → **140** | 10.44 / 18.3 → 7.18 / 12.2 | 0 → 0 | 6.90 → 3.39 | 5.61 / 0.89 → 2.86 / 0.19 | 9.30 → **6.73** | 287 → 162 | 7.5 → 4.1 | 637 (231) → 116 (48) |
| ghost train late, crowd 400 | 69 → **101** | 14.50 / 24.3 → 10.00 / 18.2 | 6 → 1 | 8.32 → 3.80 | 5.07 / 2.88 → 2.97 / 0.46 | 13.71 → **9.47** | 270 → 145 | 13.4 → 7.2 | 1605 (534) → 121 (54) |
| ghost train boss: Night Express | 82 → **118** | 12.22 / 24.3 → 8.49 / 12.3 | 0 → 0 | 7.89 → 3.58 | 6.16 / 1.28 → 2.95 / 0.25 | 10.55 → **7.97** | 302 → 175 | 7.5 → 3.9 | 1665 (541) → 168 (66) |

**Tails, repeated.** In the single full run above, two scenarios had worse tails after (Carnival late: 1% low 51 → 39
fps, frames over 25 ms 1 → 6; Boardwalk boss 48 → 41 fps). Run three times each, old build and final build in turn:

| | fps | frame p99 ms | 1% low fps | frames over 25 ms | CPU ms (p99) | GPU ms |
|---|---|---|---|---|---|---|
| Carnival late, before | 81, 81, 82 | 18.3 | 37, 51, 50 | 6, 1, 2 | 4.7–5.0 (6.7–8.9) | 11.7–11.9 |
| Carnival late, after | **109, 108, 115** | **12.3** | **57, 49, 66** | 2, 5, 1 | **3.6–3.8 (5.0–5.5)** | **8.3–8.9** |
| Boardwalk boss, before | 69, 70, 70 | 18.3 | 46, 44, 48 | 2, 3, 1 | 5.8–6.6 (8.3–11.4) | 13.6–13.8 |
| Boardwalk boss, after | **92, 94, 93** | **12.3** | **60, 68, 57** | 1, 0, 2 | **4.8 (6.6–7.4)** | **10.2–10.4** |

The single run's differences were run-to-run noise (frames over 25 ms vary 1–6 in the same build); on the final
build the tails are better, not worse. These repeats ran without GC tracing.

### The headless simulation (Node 22, whole bot nights, only `g.tick()` timed)

| scenario | tick mean ms | tick p99 ms | GCs during the night (ms) | snapshot encode per guest ms | snapshot bytes |
|---|---|---|---|---|---|
| carnival solo | 0.085 → **0.078** | 0.429 → 0.390 | 763 (221) → 715 (214) | – | – |
| fun house solo | 0.162 → **0.105** | 0.507 → 0.430 | 1385 (373) → 1029 (336) | – | – |
| boardwalk solo | 0.185 → **0.167** | 0.779 → 0.785 | 1243 (345) → 1129 (360) | – | – |
| carnival party of 4 (host) | 0.288 → **0.262** | 0.813 → 0.778 | 3141 (1831) → 2984 (1852) | 0.425 → 0.436 | 4082 → 4082 |
| ghost train solo | 0.889 → **0.221** | 2.477 → 1.605 | 6620 (1931) → 1486 (629) | – | – |
| boardwalk party of 2 (host) | 0.341 → **0.307** | 0.957 → 0.956 | 2401 (910) → 2171 (954) | 0.351 → 0.396 | 4064 → 4064 |
| ghost train party of 2 (host) | 1.774 → **0.349** | 3.824 → 1.816 | 12913 (4744) → 2171 (961) | 0.441 → 0.348 | 2968 → 2968 |

The nights are the same before and after: the same crowd counts in every window, the same snapshot sizes. Encoding
per guest moves within run-to-run noise (it does no new work). The first window of the two-player Ghost Train
night (1:00–3:00, 176 creatures): 2.22 → 0.33 ms a tick, 1,272 → 79 collections.

### Where the GPU frame goes, after

The same frozen late frames as the baseline split (`scripts/bench/gpu-split.js`; GPU timer queries, one thing
switched off at a time):

| scene | GPU ms, before | after | after, full models | after, no crowd | after, no shadow pass | after, no silhouettes | after, half resolution |
|---|---|---|---|---|---|---|---|
| carnival late, crowd 400 (368 creatures) | 13.5 | **9.7** | 13.7 | 6.3 | 9.3 | 10.2 | 6.3 |
| fun house late, crowd 400 (304 creatures) | 23.9 | **14.1** | 24.6 | 6.8 | 13.9 | 13.3 | 10.9 |
| boardwalk late, crowd 400 (359 creatures) | 19.9 | **12.3** | 19.7 | 6.5 | 11.8 | 12.1 | 9.3 |
| ghost train late, crowd 400 (126 creatures) | 5.7 | **5.8** | 5.6 | 5.7 | 5.8 | 5.8 | 5.5 |

The crowd now costs 3.4 ms of the Carnival's frame (7.2 before), 7.3 of the Fun House's (17.1) and 5.8 of the
Boardwalk's (13.8); the Fun House's mirrors 5.3 ms in this run (2.3 in an earlier one: it depends on which rows
the probe catches) against 11 before. The Ghost Train's late scene isn't crowd-bound (126 creatures: its places
spread the crowd). What is left in every scene is ~6 ms of world, shadow map and post at 5 megapixels (recommendation 1).

### A long session

`scripts/bench/long-session.js`: twelve nights in one page (each map three times, three characters), each 150
seconds fast-forwarded then 6 seconds of real frames, then back to the menu; measured after a full collection
(`--jsflags=--expose-gc`). Before the first-night veil (below):

| after | heap MB | geometries | textures | programs | DOM nodes | first 3 s of the night: worst frame |
|---|---|---|---|---|---|---|
| boot (menu) | 158 | 131 | 28 | 49 | 51 | |
| Carnival, Fun House, Boardwalk, Ghost Train (first visits) | 184 → 197 → 259 → 318 | 155 → 470 | 32 → 55 | 51 → 73 | 145–159 | 388, 1,310, 4,233, 4,834 ms |
| the same four, second time | 320, 321, 322, 319 | 473 → 494 | 56 → 70 | 73 → 74 | 145–163 | 30, 12, 18, 12 ms |
| the same four, third time | 322, 321, 321, 320 | 495 → 497 | 70 → 71 | 74 | 151–182 | 24, 18, 18, 12 ms |

No leak: each map's first visit builds its world and models and they stay; after that the heap holds at 319–322 MB
and the programs at 74; geometries creep as new creature kinds get their distance copies (+3 over the last four
nights). The first visits' freezes are what the veil now handles:

| first night on a fresh page | worst frame, before | after | playable from, before | after |
|---|---|---|---|---|
| Fun House | 1,698 ms | **503 ms** | 2.1 s | 1.5 s |
| Boardwalk | 4,160 ms | **784 ms** | 4.3 s | 2.5 s |
| Ghost Train | 5,228 ms | **437 ms** | 5.2 s | 1.9 s |

(`scripts/bench/first-visit.js`; "before" is the D-95 build; after, the remaining longest frame is the world's
build, 0.4–0.7 s, and falls while the loading screen is up.)

## D. Multiplayer findings

- **The wire is unchanged.** The headless party nights' snapshots are the same size before and after (4,082 bytes a
  snapshot for a guest of a party of four on the Carnival, 4,064 on the Boardwalk, 2,968 on the Ghost Train), and the
  network benchmark's every quality figure (prediction gap, corrections, view lag, where a guest's own shots first
  appear, loss, bandwidth, the host's input queue, convergence, drafts) is identical to the digit before and after.
  PROTO stays 19; the sim fingerprint changes (both machines need this build, as always).
- **A guest's work on the Ghost Train is 4–5× cheaper.** The guest replays its unacknowledged inputs on each
  snapshot, each step a push-out against the map's walls: every one of the Ghost Train's 1,395 props per step,
  until the packed wall sets. The network benchmark (`scripts/bench/net.ts --map=ghost_train`, a crowd of 250,
  45 seconds per condition; before = the D-95 sources), the guest's work per frame (decoding and applying snapshots,
  prediction, the replica's frame), mean (p99):

  | condition | guest, before | guest, after | host's session, before | after |
  |---|---|---|---|---|
  | RTT 0 | 0.315 ms (1.02) | **0.141 (0.72)** | 0.148 (0.69) | 0.129 (0.70) |
  | RTT 100 ± 10 ms (the owner's partner: 80–115) | 0.542 (1.82) | **0.116 (0.44)** | 0.145 (0.63) | 0.104 (0.42) |
  | RTT 100 ms, 1% loss | 0.516 (1.68) | **0.099 (0.35)** | 0.132 (0.49) | 0.093 (0.36) |
  | Carnival, RTT 100 ± 10 ms | 0.168 (0.99) | 0.172 (1.03) | 0.167 (1.05) | 0.163 (1.02) |

  The host's session work (inputs in, snapshots encoded and sent) moves within noise; the host's simulation, the
  bigger cost, is in the sim results (a Ghost Train party of two: 1.77 → 0.35 ms a tick).
- **Snapshot encoding:** 0.35–0.44 ms per guest per snapshot, unchanged (it does no new work); at 20–30 Hz that is
  ~1% of a host's frame budget per guest.
- **Over real WebRTC** (`desktop/coop-bench.js`: two windows in one Electron process, separate storage, joined
  through the PeerJS broker, the host's autopilot playing a Ghost Train night; both share this PC, so read costs, not
  frame rates): host 138 fps, CPU 2.5 ms a frame (session 0.09, sim 0.17, render 1.99, HUD 0.20); guest 138 fps,
  CPU 2.2 ms (session 0.01, sim 0.04, render 1.94, HUD 0.19), decoding and applying 0.28 ms a snapshot (worst 0.5);
  snapshots 30 Hz, ~1.5 KB, 41 KB/s; messages 62 in / 32 out a second on the host (60 input packets in), 33 / 62 on
  the guest; no loss (a local route, RTT ~0). (This run predates the first-night veil: each window's first visit
  was warmed by a solo start, timed at 822 and 390 ms.)
- **Not measured here:** a cross-network night on the owner's real link (the loopback benchmark covers RTT, jitter,
  loss and reordering; the earlier pass's report has the transport's behaviour on real routes).

## E. Regression testing

- `npm test`: 31 files, 448 tests pass (440 before this pass). New: `tests/walls.test.ts` (the wall sets against the old pass; one set per arrangement),
  `tests/simplify.test.ts` (the distance models' rules), the ground shapes' corners (`tests/optimization.test.ts`).
- `npx tsc --noEmit`: clean. `scripts/gt_smoke.ts 240`: four train transfers, no faults.
- Identical bot nights before and after (sim benchmark: the same crowd in every window, the same snapshot sizes).
- Pixel comparisons: area filing (0 pixels at 18 positions), canvas multisampling (no difference beyond run-to-run
  noise); the distance models by eye at play size and twice it.
- A two-window co-op night over real WebRTC (`desktop/coop-bench.js`, Ghost Train): both sides played 30 measured
  seconds without errors (host and guest at ~138 fps each, sharing this PC; snapshots 30 Hz, ~1.5 KB, 41 KB/s; no
  loss on the local route).
- The first-night veil was captured (on the owner's PC, `artifacts/perf/veil.png`: the loading screen over the HUD, "Setting up The
  Ghost Train…") and the first nights measured (C).
- Twelve nights in one page: no leak (C).

## F. Remaining recommendations (in order of expected gain)

1. **A render-scale setting (and optionally a dynamic one) for 165 Hz on large displays.** Even an empty scene needs
   ~5.6–6.4 ms of GPU at 3440×1440 (the world, the shadow map and five full-screen post passes at 5 megapixels),
   at or above the 6.06 ms a 165 Hz frame allows, so light scenes alternate 6 and 12 ms frames under vsync.
   Halving the resolution saved ~3.6 ms in every scene measured; a 75–85% scale would buy most of 165 Hz at a
   visible but small softening. This is a visual choice, so it was not made here.
2. **The Fun House mirrors' draw submissions.** Each reflected row re-submits the whole scene (≈45% of the Fun House
   frame's busy main thread before the empty-batch fix). Culling what a row can't reflect (the row's strip of the
   maze), or a lower update rate at High, would roughly halve it.
3. **Fewer draw calls for the static kit.** Kinds that share a material could merge into a few batches per area
   (instancing across kinds with a geometry atlas), cutting three.js's per-object setup, now the largest CPU cost.
4. **The moon's shadow pass with the distance models only for casters too far to matter**, and static casters
   rendered into a cached shadow map that only redraws when the camera moves a texel step (most casters never move).
5. **`matrixAutoUpdate = false` for static world objects:** three.js recomposes every object's matrix every frame
   (1–2.5% of the Ghost Train's samples); needs each world to mark what it animates.
6. **Node's deopt loop in `Game.updateBullets`:** after the Game's hidden class changes mid-night, Node 22 re-enters
   stale on-stack-replacement code ~10 times a second. It costs little now (the bail-out is at the function's last
   line, so it allocates nothing); whether Chromium's newer V8 does the same was not checked. Worth a watch, since
   the headless benchmarks run on Node.
7. **Prepare worlds in idle time.** The first-night veil still costs 1.5–2.3 seconds per map per session (the world's
   build blocks the main thread for up to 0.7 s, then the compile runs in the background). Building and compiling
   the other maps' worlds while the player is on the title screen or the Midway would remove even that, at the cost
   of a short hitch there and their memory (~150 MB heap for all four) for players who only play one map.

## G. Diagnostics and benchmarks

**In the game (F2 in a dev build; a shipped build once opened with `?devhud`):** frame rate and frame time (mean,
p95, p99, max), spikes over 25 ms, the frame's CPU split (net, sim with ticks per frame, render, HUD, other), the
sim's systems, GPU time (timer queries), draw calls, triangles, particles, the crowd's models, projectiles and
bullets, the heap (climb rate, drops) and long tasks; in co-op the link (RTT, jitter, route, snapshot rate, size,
bandwidth, loss, skips, buffered bytes, encode/decode time per snapshot, messages a second, the host's input queue,
the guest's prediction error, corrections and interpolation delay). F3 shows the link line in play.

**A/B switches** (one build both ways): `?legacy=lod,areas,aa` (this pass), with D-73's `tiles,compile,workers,
shaderchecks`; dev tools: `__nc.areaFiling.on`, `__nc.app.renderer.lodMode = 'auto' | 'on' | 'off'`.

**Benchmarks** (from `web/`; the real-GPU ones need a `VITE_DEVTOOLS=1` build, `--sourcemap` for mapped profiles):

| What | Command |
|---|---|
| Headless sim nights (7 scenarios incl. Ghost Train and parties of 2) | `npm run bench:sim -- [out.json] [--quick] [--only=ghost] [--profile=dir]` |
| Network conditions, host and guest net CPU | `npx vite-node scripts/bench/net.ts [out.json] [--map=ghost_train] [--only="RTT 100"] [--crowd=N]` |
| Real-GPU scenarios (13, incl. three Ghost Train nights) | `cd desktop && npx electron bench.js --serve=../dist-bench [--gc] [--only=ghost] [--size=1920x1080] [--repeat=N] [--query=legacy=lod]` |
| Where the GPU frame goes | `... bench.js --serve=../dist-bench --eval=../scripts/bench/gpu-split.js` |
| Where the CPU frame goes (marked profiles) | `... bench.js --serve=../dist-bench --eval=../scripts/bench/render-profile.js --profiles=<prefix>` then `node scripts/bench/profile-top.mjs <file> 40 --dist=dist-bench [--inclusive=render,tick]` |
| Co-op over real WebRTC, host and guest measured together | `cd desktop && npx electron coop-bench.js --serve=../dist-bench [--map=ghost_train] [--seconds=30]` |
| Long session (12 nights, leaks, first visits) | `... bench.js --serve=../dist-bench --jsflags=--expose-gc --eval=../scripts/bench/long-session.js` |
| Distance models vs full sculpts / area filing / a fixed frame | `scripts/bench/lod-compare.js`, `area-compare.js`, `fixed-frame.js` via `--eval`; `node scripts/bench/split-shots.mjs`, `npx electron desktop/imgdiff.js a.png b.png 2 [mask.png] [--exclude=x,y,w,h]`, `desktop/crop.js` |
| Allocation profile summary | `node scripts/bench/heap-top.mjs file.heapprofile` |
| Before/after tables | `node scripts/bench/table.mjs before.json after.json` |
