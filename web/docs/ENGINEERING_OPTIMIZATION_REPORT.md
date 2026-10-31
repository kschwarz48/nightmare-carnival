# Engineering optimization report — Nightmare Carnival

*Engineering optimization pass, 2026-10-31 (decision D-73). Branch `web-threejs-rebuild`.*

## Executive summary

Everything below was measured on the owner's PC: Intel i9-9900K, NVIDIA RTX 2070, 32 GB RAM, Windows 11,
primary display 3440×1440 @ 165 Hz. Browser measurements ran in Electron 44 (Chromium 152) on the real GPU,
using GPU timer queries. Node 22 measurements are headless.

**What was wrong (measured, not guessed)**

- **The frame is GPU-bound.** The simulation costs 0.05–0.6 ms a tick. Every world pixel looped over all 24
  pooled lights, which alone cost up to **16 ms of GPU time** in heavy late-game scenes.
- **Stutter came from work done on first use, on the main thread:**
  - each character took **0.6–0.8 s** to sculpt the first time it was drawn (a co-op partner, the Midway's cast);
  - audio unlocking synthesized 152 sound recipes on the first key press (**~1.6–1.9 s**);
  - new shaders compiled synchronously (**~200 ms** stalls);
  - shipped builds read every shader's info log, which forces each compile to finish synchronously.
- **Co-op latency leaked.** After any late or lost input packet the host's input queue stayed a tick deeper
  for the rest of the night, adding up to ~67 ms. Snapshots ran at 20 Hz even when tiny.

**What changed (implemented, tested, measured)**

- **Overall, on the production build** (identical code, `?legacy` turns the new paths off; real time, fixed
  loadout): 3440×1440 frame rates are up in 9 of 10 scenarios. For example: Carnival late 63 → 76 fps,
  Boardwalk late 57 → 73, Leviathan 77 → 92, Medium 63 → 83, Low 69 → 97, the title screen 97 → 133 (its
  1%-low 12 → 76). At 1080p, heavy-scene GPU time is down 12–17% and frames over 25 ms mostly disappear.
- **Tiled light culling:** pixel-identical pictures, **−9 to −11 ms GPU** in heavy scenes at 3440×1440.
- **Work moved off first use and off the main thread:**
  - shaders compile in the background;
  - characters and creatures are sculpted in Web Workers;
  - sound synthesis runs in a worker;
  - shader info logs are no longer read in shipped builds.

  Worker outputs are checksum-identical to the old main-thread results. Run start dropped from 2.4 s to
  0.8 s of blocking work.
- **Boot:** shaders are now compiled behind the loading screen. The first frame after it used to freeze for
  **6.4 s** compiling ~30 shaders; now it takes **62 ms**, and the title screen is interactive at ~6.5 s
  instead of ~9.8 s.
- **Co-op:**
  - the host input queue no longer accumulates latency (mean queue up to 3.2 → 0.5–1.6 ticks under loss and
    jitter; big corrections under 1% loss gone);
  - small snapshots go out at 30 Hz (−16 to −18 ms of view lag at every latency);
  - a guest's own shots now start from its character on screen;
  - mixed builds can't share a night (protocol 11 plus a simulation fingerprint, with a message saying who
    should update).
- **Developer tools:** a performance overlay (F2) with a network section, `?legacy` A/B switches, and
  reproducible benchmarks for the simulation, models, browser frames and the network.
- **Windows desktop client** (`web/desktop/`): a locked-down Electron shell around the hosted game and
  electron-updater wired to GitHub Releases. The NSIS installer (121 MB, unsigned) was built, silently
  installed, launched and uninstalled on this machine.
- **Live updates:** every build publishes `version.json`; browser and desktop games offer *Restart & Update*
  only at safe moments, verify the new build after reloading, and never interrupt a match. Deploys keep the
  previous builds' assets so games already running can finish.
- **CI:** web checks on every push; a tag-triggered Windows release workflow that creates a *draft* release.
- **Not deployed or published.** Nothing was pushed, deployed to Netlify or released on GitHub. That needs the
  owner's go-ahead (see *Deployment instructions*).

## Original bottlenecks

### Architecture as found

- **Main loop** (`App.frame`): one `requestAnimationFrame` loop. A fixed 60 Hz simulation with an
  accumulator, capped at 5 catch-up ticks per frame and a 0.25 s maximum frame gap. Rendering is
  interpolated by `alpha`, so movement and timing don't depend on the display's refresh rate.
  - No duplicate loops.
  - A worker clock keeps a co-op host simulating in background tabs.
- **Simulation** (`Game.step`): all entities are pooled (enemies, projectiles, bullets, pickups, zones,
  summons). Collision uses a linked-list spatial grid. The order is fixed: players, director, enemies, separation,
  bosses, weapons, world, contact, map.
- **Rendering** (`GameRenderer3D`): instanced batches per model (`ActorBatch`), billboard layers for particles,
  one practical-light pool shared by every world shader, shadow maps (moon, lantern), ink outlines and
  post-processing (bloom, grade).
  - Before this pass, models were sculpted and batches (with their shaders) created on first use.
- **Networking:** PeerJS WebRTC.
  - A reliable, ordered channel for control messages.
  - An unreliable, unordered channel for binary snapshots (host → guest, 20 Hz, delta-compressed against
    acks, interest-managed) and inputs (guest → host, 60 Hz, 6× redundant).
  - The host is authoritative and the guest predicts its own movement, replaying unacknowledged inputs.
  - Remote entities are interpolated about one snapshot behind.

### Measurements that located the problems

- **Simulation** (`npm run bench:sim`, whole bot nights; only `g.tick()` timed):
  - **Solo, every map:** 0.05–0.15 ms mean per tick, p99 ≤ 0.4 ms.
  - **Four-player host, late night** (452 monsters on average, 527 at most, 285 enemy bullets): 0.60 ms mean,
    p99 1.63 ms, max 11 ms, with about one garbage collection a second (~0.9 ms each).
  - **Host snapshot encoding for that party:** 0.62 ms mean per guest; 5.8 KB mean, 12 KB p99.
  - **Conclusion:** the simulation is not the bottleneck.
- **Models** (`npm run bench:models`):
  - characters take 598–820 ms each to sculpt, and boot built only one;
  - the first map's 38 creatures took 2.5 s at boot;
  - Carnival boss rigs take 162 ms (built at boot); Fun House and Boardwalk rigs 6–18 ms each.
- **First frames of a run** (CPU profile of run start, Chromium profiler):
  - `synth.render` 1,569 ms;
  - `AudioEngine.unlock` 333 ms;
  - `startAmbience` 161 ms;
  - `getProgramInfoLog` 152 ms;
  - `toDataURL` 130 ms.
- **First use in real time** (75 s of real-time play from the start of a night):
  - a 2.4 s freeze at run start;
  - a 205 ms frame when the first card was thrown (a new shader program);
  - further 110–258 ms frames.
- **GPU breakdown of a heavy late scene** (Carnival, 400 monsters, an effects-heavy late build, 3440×1440,
  frozen; GPU time from timer queries, with each part toggled off in turn):
  - whole frame: 46.7 ms;
  - monsters' main pass: ~12 ms;
  - world: ~10–17 ms;
  - light pool: up to 16.4 ms (10.6 ms saved by capping it at 8 lights);
  - moon shadow: 4.7 ms;
  - outlines: 1.8 ms;
  - monster shadows: 1.2 ms;
  - particles, glows, numbers and bloom: about 1 ms each.
  - Half resolution saved only 12 ms, so most of the frame is geometry rather than fill.
- **Co-op:**
  - at 100 ms RTT, the guest saw the world 105 ms behind the host;
  - the host's input queue averaged 1.1–3.2 ticks under jitter or loss, never draining after a loss episode;
  - 1–3% loss produced prediction corrections with p95 28–32 units.

A false lead worth recording: Medium and Low quality first measured *slower* than High. Re-measured with a
fixed loadout, they are faster. The difference came from the bot's build, which changed with the benchmark
profile's save. Benchmarks now use a fresh profile and a fixed late-game loadout.

## Performance results

Method: `web/desktop/bench.js` runs each scenario in real time with the game's own frame loop.
- **Setup:** a fresh profile, fast-forward to the scenario's time, apply a fixed late-game loadout
  (throwing cards 8, inferno grill 5, popcorn 7, mallet 7, death card 2, darts 6) and keep the crowd topped up.
- **Recorded:** requestAnimationFrame intervals, the frame's CPU split, GPU time (timer queries), draw calls,
  triangles, heap and long tasks.
- **Same build both ways:** "before" is the production build opened with `?legacy`, which turns off tiled
  culling, background compiles, workers and the shader-check skip. "After" is the same build without it.
- **vsync on:** frame times are quantized to the 165 Hz display (6.06 ms steps).
- **Raw JSON:** `web/artifacts/bench/prod-*.json` (not committed).

### 1920×1080 window (the target resolution)

Columns: fps; frame-interval mean / p95 / p99 / max; 1%-low fps; frames over 25 / 50 ms; CPU per frame (mean / p99) and its render, simulation and HUD parts; GPU per frame from timer queries (mean / p99); draw calls; triangles (millions, all passes); monsters alive; JS heap range; long tasks. Each cell is *before → after*.

| scenario | fps | frame mean / p95 / p99 / max ms | 1% low fps | spikes >25 / >50 ms | CPU mean / p99 ms | render CPU | sim CPU | HUD CPU | GPU mean / p99 ms | draw calls | tris (M) | enemies | heap MB (min–max) | long tasks |
|---|---:|---|---:|---|---|---:|---:|---:|---|---:|---:|---:|---|---:|
| menu (attract demo) | 136 → 166 | 7.44 / 12.1 / 18.0 / 831 → 6.08 / 6.2 / 6.3 / 18 | 12 → 123 | 1 / 1 → 0 / 0 | 3.75 / 7.2 → 3.75 / 6.8 | 3.55 → 3.54 | 0.12 → 0.14 | 0.00 → 0.00 | 6.26 / 10.0 → 5.72 / 10.1 | 269 → 261 | 2.25 → 2.12 | 0 → 0 | 84–111 → 111–125 | 1 → 0 |
| carnival early 2:00 | 143 → 144 | 7.05 / 12.1 / 18.2 / 516 → 6.98 / 12.1 / 18.1 / 449 | 19 → 21 | 5 / 2 → 3 / 2 | 4.43 / 7.7 → 5.03 / 9.4 | 3.96 → 4.54 | 0.11 → 0.11 | 0.28 → 0.30 | 6.33 / 9.7 → 6.08 / 10.8 | 267 → 271 | 2.27 → 2.28 | 33 → 32 | 112–142 → 135–149 | 1 → 1 |
| carnival mid 10:00 | 108 → 115 | 9.36 / 18.2 / 18.3 / 25 → 8.75 / 18.1 / 18.2 / 37 | 50 → 52 | 0 / 0 → 1 / 0 | 6.15 / 11.0 → 6.14 / 9.8 | 5.53 → 5.55 | 0.20 → 0.17 | 0.33 → 0.34 | 7.94 / 11.7 → 6.92 / 10.4 | 279 → 280 | 3.74 → 3.92 | 105 → 109 | 114–143 → 137–162 | 0 → 0 |
| carnival late, crowd 400 | 71 → 78 | 14.17 / 18.4 / 24.3 / 30 → 12.83 / 18.3 / 24.2 / 30 | 35 → 40 | 9 / 0 → 2 / 0 | 8.58 / 13.6 → 8.19 / 12.6 | 7.44 → 7.16 | 0.59 → 0.49 | 0.42 → 0.43 | 13.11 / 16.8 → 11.11 / 14.9 | 269 → 255 | 10.54 → 10.37 | 401 → 400 | 118–144 → 137–162 | 0 → 0 |
| carnival boss: Ringmaster | 87 → 86 | 11.51 / 18.3 / 24.2 / 61 → 11.66 / 18.3 / 24.1 / 30 | 34 → 40 | 6 / 2 → 2 / 0 | 6.91 / 12.3 → 7.70 / 14.0 | 6.03 → 6.70 | 0.31 → 0.36 | 0.48 → 0.55 | 9.97 / 14.6 → 8.43 / 13.1 | 285 → 288 | 5.31 → 5.22 | 151 → 150 | 116–146 → 137–164 | 1 → 0 |
| fun house late, crowd 400 | 63 → 64 | 16.01 / 30.2 / 36.4 / 55 → 15.82 / 24.4 / 30.5 / 49 | 24 → 26 | 68 / 1 → 57 / 0 | 10.52 / 22.5 → 10.40 / 19.5 | 9.34 → 9.24 | 0.65 → 0.63 | 0.41 → 0.41 | 13.49 / 23.5 → 13.39 / 21.2 | 364 → 406 | 18.30 → 21.37 | 395 → 396 | 136–165 → 155–180 | 0 → 0 |
| boardwalk late, crowd 400 | 68 → 71 | 14.69 / 18.3 / 24.3 / 43 → 14.17 / 24.2 / 24.4 / 73 | 36 → 31 | 5 / 0 → 9 / 1 | 9.21 / 15.6 → 9.42 / 16.0 | 7.99 → 8.19 | 0.71 → 0.70 | 0.40 → 0.42 | 13.77 / 17.2 → 12.11 / 15.7 | 357 → 358 | 14.28 → 14.31 | 398 → 398 | 198–227 → 215–241 | 0 → 0 |
| boardwalk boss: Leviathan | 85 → 81 | 11.83 / 18.3 / 24.2 / 31 → 12.49 / 18.3 / 24.4 / 79 | 41 → 31 | 1 / 0 → 8 / 2 | 8.13 / 13.5 → 9.06 / 16.8 | 7.25 → 8.05 | 0.36 → 0.44 | 0.44 → 0.48 | 9.15 / 13.2 → 8.38 / 14.3 | 374 → 368 | 6.04 → 6.03 | 149 → 150 | 199–229 → 215–241 | 0 → 0 |
| carnival late, crowd 400 (Medium) | 71 → 81 | 14.23 / 24.2 / 30.2 / 48 → 12.53 / 18.2 / 24.1 / 37 | 31 → 39 | 10 / 0 → 1 / 0 | 9.34 / 17.1 → 8.57 / 13.5 | 8.11 → 7.48 | 0.67 → 0.55 | 0.45 → 0.45 | 12.24 / 16.8 → 10.10 / 14.2 | 203 → 202 | 9.73 → 9.19 | 402 → 399 | 200–227 → 216–240 | 0 → 0 |
| carnival late, crowd 400 (Low) | 89 → 89 | 11.38 / 18.2 / 18.3 / 30 → 11.39 / 18.2 / 18.3 / 25 | 43 → 47 | 1 / 0 → 0 / 0 | 7.99 / 13.6 → 9.27 / 14.5 | 6.92 → 8.06 | 0.53 → 0.58 | 0.46 → 0.53 | 9.21 / 13.2 → 9.00 / 14.1 | 109 → 108 | 5.90 → 6.16 | 400 → 401 | 199–238 → 216–243 | 0 → 0 |

run start (startRun ms) and worst warm-up frame (ms):
- carnival early 2:00: start 1477 → 466 ms, worst warm-up frame 18 → 18 ms (CPU 9 → 9)
- carnival mid 10:00: start 2 → 2 ms, worst warm-up frame 91 → 55 ms (CPU 11 → 12)
- carnival late, crowd 400: start 3 → 3 ms, worst warm-up frame 24 → 24 ms (CPU 12 → 14)
- carnival boss: Ringmaster: start 4 → 3 ms, worst warm-up frame 30 → 25 ms (CPU 20 → 17)
- fun house late, crowd 400: start 137 → 110 ms, worst warm-up frame 30 → 24 ms (CPU 16 → 14)
- boardwalk late, crowd 400: start 516 → 327 ms, worst warm-up frame 37 → 37 ms (CPU 20 → 22)
- boardwalk boss: Leviathan: start 5 → 3 ms, worst warm-up frame 24 → 18 ms (CPU 13 → 14)
- carnival late, crowd 400 (Medium): start 3 → 2 ms, worst warm-up frame 61 → 43 ms (CPU 16 → 23)
- carnival late, crowd 400 (Low): start 3 → 2 ms, worst warm-up frame 36 → 24 ms (CPU 25 → 20)

### 3440×1440 full screen (the owner's display)

| scenario | fps | frame mean / p95 / p99 / max ms | 1% low fps | spikes >25 / >50 ms | CPU mean / p99 ms | render CPU | sim CPU | HUD CPU | GPU mean / p99 ms | draw calls | tris (M) | enemies | heap MB (min–max) | long tasks |
|---|---:|---|---:|---|---|---:|---:|---:|---|---:|---:|---:|---|---:|
| menu (attract demo) | 97 → 133 | 10.40 / 12.2 / 12.3 / 625 → 7.60 / 12.2 / 12.3 / 18 | 12 → 76 | 1 / 1 → 0 / 0 | 3.23 / 6.3 → 3.18 / 5.6 | 3.02 → 3.01 | 0.14 → 0.11 | 0.00 → 0.00 | 9.34 / 11.8 → 7.13 / 9.8 | 258 → 267 | 2.23 → 2.23 | 0 → 0 | 86–114 → 111–124 | 1 → 0 |
| carnival early 2:00 | 95 → 122 | 10.66 / 12.3 / 18.2 / 467 → 8.26 / 12.2 / 12.3 / 158 | 16 → 34 | 4 / 2 → 3 / 2 | 4.34 / 7.1 → 3.86 / 6.4 | 3.84 → 3.42 | 0.16 → 0.12 | 0.27 → 0.25 | 9.74 / 12.0 → 7.54 / 10.4 | 267 → 266 | 2.21 → 2.27 | 33 → 33 | 115–141 → 135–148 | 1 → 0 |
| carnival mid 10:00 | 86 → 110 | 11.77 / 18.1 / 18.3 / 24 → 9.17 / 12.3 / 18.1 / 24 | 48 → 54 | 0 / 0 → 0 / 0 | 5.19 / 9.4 → 4.98 / 8.2 | 4.60 → 4.47 | 0.21 → 0.14 | 0.30 → 0.29 | 11.21 / 14.0 → 8.53 / 11.3 | 276 → 277 | 3.52 → 3.48 | 104 → 101 | 118–148 → 137–162 | 0 → 0 |
| carnival late, crowd 400 | 63 → 76 | 15.88 / 18.3 / 24.1 / 30 → 13.31 / 18.2 / 24.2 / 30 | 40 → 39 | 1 / 0 → 4 / 0 | 7.17 / 12.1 → 7.48 / 12.8 | 6.10 → 6.45 | 0.58 → 0.52 | 0.39 → 0.40 | 15.26 / 19.2 → 12.36 / 15.0 | 259 → 251 | 9.48 → 9.96 | 400 → 400 | 119–146 → 137–164 | 0 → 0 |
| carnival boss: Ringmaster | 79 → 92 | 12.71 / 18.2 / 24.2 / 79 → 10.89 / 18.1 / 24.2 / 42 | 33 → 40 | 6 / 1 → 1 / 0 | 6.15 / 10.4 → 5.95 / 9.4 | 5.34 → 5.18 | 0.30 → 0.26 | 0.44 → 0.44 | 11.99 / 15.0 → 10.02 / 13.2 | 270 → 280 | 4.48 → 5.10 | 150 → 151 | 119–147 → 137–165 | 1 → 0 |
| fun house late, crowd 400 | 56 → 53 | 18.10 / 24.3 / 30.4 / 49 → 18.83 / 30.3 / 36.5 / 85 | 27 → 21 | 22 / 0 → 85 / 2 | 8.85 / 16.1 → 11.76 / 25.6 | 7.60 → 10.48 | 0.77 → 0.76 | 0.36 → 0.41 | 17.23 / 24.4 → 16.57 / 22.6 | 339 → 470 | 16.07 → 25.82 | 395 → 396 | 139–165 → 154–183 | 0 → 0 |
| boardwalk late, crowd 400 | 57 → 73 | 17.79 / 24.2 / 24.3 / 30 → 13.82 / 18.2 / 18.3 / 30 | 40 → 39 | 1 / 0 → 3 / 0 | 8.11 / 14.9 → 8.12 / 12.5 | 6.85 → 7.04 | 0.81 → 0.61 | 0.35 → 0.36 | 17.25 / 20.9 → 13.14 / 15.7 | 357 → 358 | 14.59 → 14.07 | 398 → 398 | 203–231 → 216–241 | 0 → 0 |
| boardwalk boss: Leviathan | 77 → 92 | 13.08 / 18.2 / 18.3 / 36 → 10.91 / 18.2 / 18.4 / 30 | 39 → 41 | 3 / 0 → 2 / 0 | 7.40 / 11.9 → 6.99 / 11.9 | 6.55 → 6.23 | 0.38 → 0.29 | 0.37 → 0.39 | 12.37 / 15.2 → 9.53 / 12.9 | 369 → 372 | 5.89 → 5.90 | 149 → 149 | 202–231 → 215–242 | 0 → 0 |
| carnival late, crowd 400 (Medium) | 63 → 83 | 15.99 / 18.3 / 18.4 / 79 → 12.23 / 18.2 / 18.3 / 24 | 30 → 42 | 4 / 1 → 0 / 0 | 7.85 / 12.0 → 7.29 / 10.7 | 6.69 → 6.37 | 0.69 → 0.46 | 0.37 → 0.37 | 15.28 / 17.9 → 11.37 / 13.6 | 199 → 196 | 8.97 → 9.06 | 399 → 399 | 202–227 → 216–239 | 0 → 0 |
| carnival late, crowd 400 (Low) | 69 → 97 | 14.61 / 24.2 / 30.4 / 91 → 10.45 / 18.2 / 18.3 / 24 | 25 → 50 | 22 / 1 → 0 / 0 | 8.34 / 15.8 → 6.85 / 12.3 | 7.10 → 5.98 | 0.69 → 0.41 | 0.45 → 0.38 | 12.71 / 16.5 → 9.14 / 12.0 | 109 → 107 | 5.74 → 6.16 | 400 → 399 | 202–231 → 215–247 | 1 → 0 |

run start (startRun ms) and worst warm-up frame (ms):
- carnival early 2:00: start 1343 → 348 ms, worst warm-up frame 388 → 12 ms (CPU 10 → 8)
- carnival mid 10:00: start 2 → 5 ms, worst warm-up frame 55 → 55 ms (CPU 11 → 11)
- carnival late, crowd 400: start 3 → 3 ms, worst warm-up frame 36 → 42 ms (CPU 15 → 12)
- carnival boss: Ringmaster: start 2 → 3 ms, worst warm-up frame 61 → 24 ms (CPU 16 → 10)
- fun house late, crowd 400: start 122 → 114 ms, worst warm-up frame 30 → 18 ms (CPU 15 → 11)
- boardwalk late, crowd 400: start 344 → 331 ms, worst warm-up frame 36 → 30 ms (CPU 17 → 18)
- boardwalk boss: Leviathan: start 2 → 3 ms, worst warm-up frame 55 → 24 ms (CPU 15 → 12)
- carnival late, crowd 400 (Medium): start 3 → 2 ms, worst warm-up frame 61 → 42 ms (CPU 18 → 19)
- carnival late, crowd 400 (Low): start 2 → 2 ms, worst warm-up frame 30 → 55 ms (CPU 17 → 17)

### Other measured results

- **Tiled light culling, A/B in one session on a frozen heavy scene at 3440×1440:**

  | Map | GPU culling off | GPU culling on | Off again |
  |---|---:|---:|---:|
  | Carnival | 46.4 ms | 35.6 ms | 45.4 ms |
  | Boardwalk | 41.9 ms | 32.5 ms | 42.4 ms |
  | Fun House | 51.1 ms | 41.8 ms | 52.5 ms |

  Pixel comparison of on against off: Carnival maximum difference 1/255, Fun House 0. On the Boardwalk the
  differences equal its own frame-to-frame animation (an on-vs-on control gives the same numbers).
- **Run start** (starting a night as a character other than the last played):
  - blocking work 2,393 → 787 ms;
  - the first frame after it 2,456 → 899 ms;
  - the sound effects were ready before the first key press.
- **Worker outputs are identical:** six of six characters match a main-thread sculpt by vertex count and
  position checksum; seven sampled sounds match by checksum.

### Targets

- **60 fps at 1080p on a midrange PC:** see the 1080p table. On a 60 Hz display a frame has 16.7 ms; the
  heaviest scenes' GPU p99 is shown there.
- **Higher refresh rates:** the simulation is a fixed 60 Hz step with interpolated rendering, so 120/144/165 Hz
  displays get smooth motion with unchanged gameplay timing. Measured frame rates above 60 are in the tables.
- **Not measured:** other GPUs, laptops and integrated graphics; controller input latency.

## Multiplayer results

Method: `npx vite-node scripts/bench/net.ts`.
- **Setup:** a two-player night (the guest throws cards) over the real `HostSession` and `GuestSession`, on
  the loopback network (`src/net/link.ts`, now with loss bursts). 250 monsters, 45 s per condition.
- **"View lag":** how far behind the host's present the guest draws the world.
- **"Prediction lead":** how far the guest's drawn self is ahead of the host's copy of it.

**Host input queue fix** (owed ticks after repeats, a 2-input cushion, trimming over 3), baseline → after:

| condition | host input queue (ticks) | starved inputs | correction p95 / max (units) | prediction lead mean | view lag mean (ms) | snapshot loss % | KB/s |
|---|---|---|---|---|---|---|---|
| RTT 0 | 0 → 0 | 6 → 6 | 0.03 / 7.31 → 0.03 / 7.31 | 3.13 → 3.13 | 66.67 → 66.67 | 0 → 0 | 54.84 → 54.84 |
| RTT 50, ±5 jitter | 0.05 → 0.05 | 2 → 2 | 0.03 / 0.04 → 0.03 / 0.04 | 6.3 → 6.3 | 82.81 → 82.81 | 0 → 0 | 57.3 → 57.3 |
| RTT 100, ±10 jitter | 1.14 → 0.8 | 1 → 7 | 0.03 / 2.64 → 0.03 / 7.33 | 14.73 → 12.89 | 105.23 → 105.23 | 0 → 0 | 57.38 → 58.41 |
| RTT 150, ±15 jitter | 1.15 → 0.68 | 21 → 194 | 0.03 / 39.6 → 3.67 / 40.32 | 19.85 → 17.52 | 128.52 → 128.72 | 0 → 0 | 56.84 → 55.67 |
| RTT 200, ±20 jitter | 1.56 → 0.6 | 34 → 223 | 0.04 / 47.65 → 4.25 / 46.76 | 24.2 → 24.54 | 150.27 → 150.34 | 0 → 0 | 59.9 → 57.75 |
| RTT 100, 1% loss | 1.27 → 0.68 | 6 → 23 | 32.2 / 64.4 → 0.03 / 10.96 | 15.22 → 12.8 | 106.2 → 105.82 | 1.43 → 1.21 | 54.93 → 57.7 |
| RTT 100, 3% loss | 2.08 → 0.85 | 8 → 48 | 28 / 56 → 28 / 64.4 | 17.49 → 13.8 | 107.02 → 107.03 | 2.54 → 1.98 | 55.45 → 55.01 |
| RTT 100, loss bursts | 3.21 → 1.61 | 29 → 31 | 3.32 / 11 → 0.92 / 25.67 | 21.96 → 16.48 | 118.49 → 118.49 | 5.29 → 5.29 | 54.53 → 54.64 |
| RTT 100, ±35 jitter (reordering) | 2.54 → 0.5 | 17 → 530 | 0.03 / 36.66 → 7.33 / 20.81 | 17.59 → 11.34 | 103 → 102.34 | 4.19 → 3.19 | 58.2 → 56.52 |

The tradeoff: under heavy jitter (±15–35 ms) a shallower queue starves more often. Corrections there are
slightly more frequent but small (p95 4–7 units, a fraction of a character, eased out over ~120 ms). Under
loss they are far smaller than before, and input latency is lower in every condition.

**30 Hz for small snapshots** (light crowd, 60 monsters, 20 s per condition), 20 Hz → 30 Hz:

| condition | view lag mean (ms) | view lag p95 | KB/s | snapshot bytes |
|---|---|---|---|---|
| RTT 0 | 66.67 → 50.03 | 66.67 → 50.02 | 25.77 → 38.22 | 1302 → 1293 |
| RTT 50, ±5 jitter | 82.92 → 66.38 | 83.33 → 66.69 | 25.4 → 37.27 | 1283 → 1261 |
| RTT 100, ±10 jitter | 105.04 → 88.44 | 118.4 → 101.7 | 24.72 → 37.62 | 1247 → 1271 |
| RTT 150, ±15 jitter | 127.34 → 109.88 | 152.7 → 135.93 | 24.71 → 36.8 | 1244 → 1244 |
| RTT 200, ±20 jitter | 151.3 → 134.86 | 169.25 → 153.82 | 25.4 → 37.6 | 1286 → 1276 |
| RTT 100, 1% loss | 106.41 → 88.37 | 120.54 → 102.15 | 24.81 → 36.16 | 1265 → 1230 |
| RTT 100, 3% loss | 106.94 → 89.92 | 123.44 → 104.94 | 24.2 → 35.98 | 1248 → 1260 |
| RTT 100, loss bursts | 110.75 → 94.96 | 119.73 → 119.93 | 24.68 → 37.37 | 1269 → 1319 |
| RTT 100, ±35 jitter (reordering) | 104.47 → 86.74 | 138.43 → 124.98 | 25.23 → 38.93 | 1251 → 1293 |

The higher "loss" at 30 Hz under heavy reordering is out-of-order snapshots correctly discarded as stale.
Newer data supersedes them, and view lag still improves.

**Also verified:**
- **The guest's replica tracks the host exactly.** Enemy positions differ by 0.1 units on average
  (quantization), and drafts and prize wheels resolve under every condition.
- **Mixed builds are refused.** A `hello` with the same protocol but a different simulation fingerprint is
  refused with `version` / `host-newer` (unit test).
- **Desktop host and Chromium guest play together** over real WebRTC: see *Desktop client*.

**What remains uncertain:**
- No human has played co-op across the country after these changes. The 80–115 ms RTT figures above are
  simulated.
- Enemy bullets are still re-sent every snapshot while they fly.
- The guests' projectiles are still simulated by the host. The new visual offset hides the start position,
  not the round-trip delay before a shot appears.

## Desktop client

How it works: see `web/docs/DESKTOP.md`. In short:
- **Same build as the browser:** the Electron 44 shell loads the hosted game. Only a local dev server may
  stand in for it.
- **Locked down:** sandbox, context isolation, no Node, navigation and windows pinned to the game's origin,
  all permissions denied but fullscreen and clipboard writes, hardened fuses.
- **Narrow bridge:** `window.ncDesktop` offers sessions, reload, fullscreen and shell updates.
- **Window behaviour:** F11 and Alt+Enter toggle fullscreen; size and position are remembered; closing during
  a match asks first; the display stays awake in a night.
- **Offline:** an offline page that retries on its own.

**Built and tested on this machine** (Windows 11, Electron 44.9.3; 44.8.0 was replaced because of
advisory GHSA-jr5w-w6x2-84p9):

- **Installer:** `npm run dist` → `release/Nightmare-Carnival-Setup-0.1.0.exe` (121 MB), `latest.yml`
  (SHA-512) and a blockmap. No code-signing certificate was configured, so it is unsigned.
- **Install / uninstall:**
  - A silent install (`/S`) went to `%LOCALAPPDATA%\Programs\nightmare-carnival-desktop` without an
    administrator prompt, with a desktop shortcut, a Start Menu shortcut and an uninstall entry ("Nightmare
    Carnival 0.1.0", Kevin Schwarz).
  - The installed app opened https://nightmare-carnival.netlify.app (the current live build) and showed the
    title screen, with the bridge present (screenshot `web/artifacts/e2e/installed-app.png`).
  - A silent uninstall removed the files, both shortcuts and the uninstall entry, and kept the user-data
    folder (saves).
  - The test data was then deleted, leaving this PC as it was.
- **Packaged-app smoke test** (`node tools/smoke-packaged.mjs`): 7/7 passed. The RunAsNode fuse holds
  (`ELECTRON_RUN_AS_NODE` is ignored); the game boots inside the packaged shell; the bridge reports
  `packaged: true`; there is no `require`, `process` or `module` in the page; `window.open` is denied; the
  page reports its session.
- **Update scenarios** (`node tools/e2e-updates.mjs`): 21/21 passed, in the real shell against a local
  server, with three rebuilds standing in for deploys:
  - **security:** the bridge exists, the page has no Node, `window.open` is denied, navigation to
    `file:///…` is blocked;
  - **A**, an update at the menu: offered at once (screenshot `update-card-at-menu.png`);
  - **E**, the restart: loads the new build (id verified against the live `version.json`) and says
    "Updated to version …";
  - **B**, an update mid-night: known but not shown until the night ends;
  - **F**, a shell update: arrives mid-night (faked; development flag only) and the install is refused with
    `busy`; it is offered after the night and installs from the card (the shell quits to install);
  - **D**, the server gone at restart: the app stays put and says it can't reach the carnival.
  - Getting there took several harness fixes, recorded honestly:
    - errors had been counted as passes;
    - a stale debugging connection after the reload;
    - Windows stops drawing a window that other windows cover (the game's boot waits on a frame), so the
      test window now keeps drawing. A player who clicks Restart is looking at the window.
- **Desktop host, Chromium guest** (`node tools/e2e-coop.mjs`): 6/6 passed.
  - The shell hosted a lobby over the PeerJS signalling server and a separate Chromium client joined.
  - The night started on both, and the guest received 176 snapshots over the WebRTC datagram channel (direct
    route, 8–13 ms on one machine; the host sending at 30 Hz).
- **Not tested here:**
  - a different, clean Windows PC;
  - a physical controller (the Gamepad API is the same as Chrome's);
  - fullscreen toggling by hand (F11 and Alt+Enter are wired, not pressed);
  - a real shell update from a published release (none exists yet).

## Update system

- **Game updates (ordinary changes):**
  - every build gets an id (commit + time) and publishes `version.json`: id, version, protocol, simulation
    fingerprint, asset list;
  - games poll it at boot, every 10 minutes and at every safe moment;
  - a newer build is offered at safe moments only (menus, the Midway alone, results), never during a match,
    lobby or connection. *Later* hides it for 30 minutes.
  - *Restart & Update* checks the server first, saves, leaves any party politely, then reloads. The browser
    adds `?v=<id>`; the desktop shell clears its cache. The new page confirms the build it expected.
  - Netlify serves `version.json` and the page with `no-cache`; fingerprinted assets stay immutable.
  - `npm run deploy` copies the live build's and its predecessors' assets (up to 3 builds) into the new
    deploy, so running games can still load what they need.
- **Shell updates (only when `web/desktop` changes):**
  - electron-updater checks this repository's GitHub Releases 20 s after launch and every 4 hours;
  - it downloads in the background and verifies SHA-512 checksums;
  - it installs only from the in-game card at a safe moment (the shell refuses otherwise) or on quit.
  - Releases are created as drafts by the tag workflow and go live only when the owner publishes them.

## Deployment instructions

**Web game** (from `web/`):

```bash
npm test
```

```bash
npm run deploy
```

```bash
npm run deploy -- --deploy --no-build
```

The first command runs the checks. The second builds `dist/`, carries the last builds' assets forward and
doesn't upload. The third publishes to Netlify production and confirms the live `version.json`. Running
games offer the update at their next safe moment.

**Windows app** (only when `web/desktop` changes):
1. Bump `version` in `web/desktop/package.json` and commit.
2. Tag and push: `git tag vX.Y.Z` then `git push origin vX.Y.Z`. The *desktop release* workflow builds the
   installer and attaches it to a **draft** release.
3. Download and check the draft's installer, then publish the release. Installed apps update within hours.
4. Set `web/desktop-release.json` to the release's installer URL and deploy the web game. The title screen
   then shows *Download for Windows* (in browsers).

**Local installer build:** `cd web/desktop && npm ci && npm run dist` produces
`release/Nightmare-Carnival-Setup-<version>.exe`.

## Remaining setup

1. **Approve and run the first push and deploy.** This work is committed locally only. Pushing also
   uploads the two GitHub Actions workflows.
2. **First desktop release:** tag `v0.1.0` (or run the workflow by hand with "publish"), check the draft,
   publish it, then fill in `desktop-release.json` and deploy.
3. **Code signing** (recommended before sharing beyond family): an OV/EV certificate or Azure Trusted
   Signing, as CI secrets. Until then SmartScreen warns on first install ("More info → Run anyway") and
   updates are verified by checksum rather than publisher.
4. **Private distribution, if wanted:** the repository is public, so releases are public. A private beta
   needs a private host (electron-updater's generic or S3 provider). Don't embed a GitHub token.
5. **Optional CI deploys:** the web workflow never deploys. Automatic deploys would need a Netlify token as a
   CI secret and an explicit decision to give up the manual approval step.

## Remaining risks

- **Real-world co-op** at 80–115 ms with real routers and relays wasn't tested after these changes. The
  numbers are from the loopback simulator.
- **The input-queue tradeoff:** more small corrections under heavy jitter (measured above).
- **The tiled grid** covers the lit area around the camera. Fragments outside it evaluate every light (exact
  but not faster).
- **Background shader compiles** depend on `KHR_parallel_shader_compile`. Without it, the old behaviour
  stands (draw at once, compile on first use).
- **Workers:** if a browser blocks module workers, sculpting and synthesis fall back to the main thread.
- **Ambience beds** (~0.3 s at the first unlock and on each map's first run) are still generated on the main
  thread.
- **One unexplained 449 ms frame** remains early in a Carnival run in the final 1080p benchmark (no new
  shader or model at that moment). It needs a profile.
- **Found and removed during the pass:** a PeerJS prefetch I had added (so a deploy couldn't strand the
  multiplayer chunk) cost a 0.6 s stall on the title screen, because PeerJS probes WebRTC when loaded. The
  deploy carry-forward covers that risk instead.
- **Boot waits on a frame:** a window that is minimized or fully covered stops drawing, so the game finishes
  booting only once it is visible (in the browser too).
- **The Netlify badge:** the free plan's "Powered by Netlify" badge shows in the desktop app too (it is part
  of the hosted page).
- **Run start** still blocks ~0.8 s, mostly world setup and GPU uploads. It happens behind a scene change.
- **Not tested here:**
  - a clean Windows machine (only this PC; installed, launched and uninstalled here);
  - a physical controller in the desktop app;
  - a real shell update end to end (no release exists yet; the deferral logic was tested with a faked
    update);
  - a long session's memory growth.
- **Unsigned installer:** SmartScreen warning, and no publisher verification of updates.

## Recommended next steps

1. **Play a real cross-country co-op night** with the F2 overlay open, and tune the input cushion and the
   snapshot tiers from what it shows.
2. **Ballistic encoding for enemy bullets:** send spawn and velocity once, so bullet-hell snapshots shrink
   most.
3. **Crowd LOD for sculpted monsters.** The monsters' main pass is now the largest GPU cost. Lighter geometry
   at crowd screen sizes would look the same; keep High at full detail.
4. **Client-owned projectiles for guests** (the guest simulates its own shots; the host validates hits), for
   fully immediate attacks.
5. **Generate ambience beds in the synth worker,** and spread run-start world uploads over frames.
6. **Code-sign the installer.**
7. **Adaptive resolution** for weak GPUs, as an option that keeps the current look by default.
