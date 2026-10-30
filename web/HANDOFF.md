# Handoff — Nightmare Carnival Web Edition

For the next engineer picking up the Three.js rebuild. Read this first, then `README.md` (how to run it)
and `docs/DESIGN_DECISIONS.md` (why the numbers are what they are). Rendering: `docs/RENDERING.md`;
visual QA loop and the latest scorecard: `docs/VISUAL_QA.md`; progression maths: `docs/PROGRESSION.md`;
the secret quest (developer-only spoilers): `docs/EASTER_EGG_SOLUTION.md`; online co-op (rules, netcode,
deployment, TURN, testing status): `docs/MULTIPLAYER.md`.

_Updated 2026-10-30. Branch: `web-threejs-rebuild` (not pushed, no PR)._

---

## 1. TL;DR

- The game is **feature-complete and playable**: all 6 characters, 15 enemies, 4 three-phase bosses plus
  the secret Calliope, 18 weapons + evolutions (one secret), 16 passives, events, meta-progression, all
  modes, audio, menus, settings, the Last Song quest chain, prize-wheel chests.
- Rendering is a **true 2.5D Three.js renderer** (`src/render3d/`): procedural 3D models (sculpted, rigged
  cast and enemies; kit-built architecture), an analytic relief ground, a practical-light pool, ground
  mist, soft bloom and a vintage grade. The latest graphics pass (D-45…D-50) is scored in `docs/VISUAL_QA.md`.
- **Online two-player co-op (alpha)** with Vampire Survivors rules: host-authoritative, peer-to-peer
  over WebRTC with PeerJS matchmaking, delta snapshots, client prediction, lobby codes, reconnect
  (D-51…D-53, `docs/MULTIPLAYER.md`). **Deployed** at https://nightmare-carnival.netlify.app (Netlify; `netlify.toml`,
  `docs/MULTIPLAYER.md` §4). Verified with two tabs on one machine over real PeerJS, on the dev server and on
  the deployed site; **not yet verified across two networks**, which is the next job.
- **166 tests pass**, typecheck is clean, `npm run build` produces a static site.
- The **biggest open item is human playtesting** (balance and readability). All tuning so far used bots.
- The original Godot project at the repo root is untouched. Two Godot files (`export_presets.cfg`,
  `project.godot`) had **uncommitted local edits before this work started** — they're the repo owner's,
  leave them alone.

```bash
cd web
npm install
npm run dev     # http://127.0.0.1:5173
npm test        # ~60 s
npm run build   # → web/dist (static, relative paths)
```

---

## 2. Where things are

```
web/src/
  main.ts, app.ts   Boot, screen state machine, 60 Hz fixed-step loop, sim→audio/HUD/save wiring
  dev.ts            Dev-only tools (window.__nc). Dynamically imported under import.meta.env.DEV
  core/             math, seeded Rng, typed EventBus, SpatialGrid (linked-list cells)
  data/             ALL content and tuning numbers — this is where balance lives
  sim/              Render-free simulation (never imports three)
    game.ts         The Game: pools, party of players, damage, pickups, XP/drafts, hazards, dawn/endless/end
    movement.ts     Player locomotion shared by the sim and the co-op guest's prediction
    director.ts     Waves, spawn band, leash, swarms, formations, boss gates, miniboss, endless
    enemyAI.ts      13 behaviours (switch on def.behavior)
    weapons.ts      All weapon logic (switch on def.kind), projectiles, summons, mirror replay
    draft.ts        Draft generation, evolutions, chest rewards
    carnivalEvents.ts  The 9 timed events
    bosses/         boss.ts (framework) + tent / ferris / puppet / ringmaster
    script.ts       Generator coroutines advanced by sim time (boss attack scripts)
  render3d/         The 3D renderer (see docs/RENDERING.md)
    renderer3d.ts   Frame orchestration: camera, lighting, batches, enemies/death scenes, post
    core/           materials (actor shader, light pool, mist, outlines), batches, billboards/decals
    models/         Procedural models: characters, creatures, enemies, bosses' parts, props, items,
                    arch.ts (architecture kit: canvas roofs, canopies, pagoda roofs, headers…)
    sculpt/         SDF sculpting (surface nets), rigs (bone textures), human proportions/anatomy
    world/          ground (analytic relief + baked fields), props, clutter, atmosphere
    bosses.ts, prizeWheel.ts, post.ts
  render/           2D leftovers still used by the 3D side: particle/number atlas (art/, assets.ts), fx.ts
  audio/            audio.ts (engine, music, boss sequencer), synth.ts (SFX recipes)
  ui/               hud.ts (HUD + co-op layer, draft, chest), screens.ts (menus), lobby.ts (co-op menus/lobby), dom.ts, style.css
  net/              Online co-op (D-52): codec, snapshot (delta encoder), replica (guest mirror + prediction),
                    protocol (validation), session (Host/GuestSession), link (NetLink + loopback), peer (PeerJS),
                    codes, config — see docs/MULTIPLAYER.md §2
  meta/save.ts      Versioned save (localStorage) with migrations + backup slot
  input/input.ts    Keyboard (rebindable), mouse aim, gamepad
web/tests/          Vitest suite + autopilot helpers (helpers.ts)
web/scripts/        Balance/profiling scripts (run with `npx vite-node scripts/<name>.ts`)
web/docs/           Audit, design decisions, asset manifest, QA report, progress
web/public/audio/   The two original Bradley Schwarz tracks (mp3, converted from the repo's .m4a)
```

---

## 3. Architecture in five minutes

**Sim / render split.** `src/sim` is pure TypeScript with no Three.js or DOM. It emits:
- `game.bus` events (typed in `GameEvents` in `game.ts`) → consumed by `app.ts` for audio, HUD, saves.
- `game.fx` queue of pure-data visual cues → drained by `render/fx.ts` each frame.

This is why the full 25-minute game runs headless in tests. Keep it that way: **never import render,
audio, or DOM code from `sim/`.**

**Loop.** `app.ts` accumulates real time and calls `game.tick()` at 60 Hz (`TICK` in `sim/constants.ts`),
then renders with an interpolation alpha. Entities keep `px/py` (previous position) for that.

**Coordinates.** Sim space is **y-down** (north = negative y), matching Godot. The 3D view maps sim
(x, y) → world (X, Z) with Y up; models face +Z (south, toward the camera). Map is 4400×4400 centred on
0,0; the sea is south of `SEA_Y`.

**Pools.** Enemies, projectiles, bullets, hazards, pickups, zones, summons are preallocated in `Game`.
`game.active` is the live enemy list, compacted at the end of each tick.

**Damage entry points.** `game.damageEnemy` / `game.damageTarget` (dispatches boss parts) /
`game.hurtPlayer`. Go through these — they handle crits, shields, knockback, stats and FX.

**Hazards** (`Hazard` in `entities.ts`) are the generic "telegraph then hurt" primitive behind every boss
attack and many enemy tells: shape + `tele` (warning time, no damage) + `active` + optional motion,
pull, `onActivate` callback. The renderer draws them by `shape`/`style`. `owner` = boss/enemy uid so they
get cleaned up on death.

**Co-op (D-51/D-52).** `g.players` holds the party; `g.player`/`g.input`/`g.weapons` are a *context* the
tick points at each player in turn (their weapons, each enemy's nearest target, a boss's target, a draft,
a pickup) and that rests on player 0 between ticks — so single-player code works unchanged, but anything
new that reads `g.player` outside the tick should ask "which player?". Per-player bus events carry
`player`. Online, the host's `Game` is the only simulation: `HostSession.beforeTick()` feeds the guest's
input into `g.inputs[1]`, snapshots go out from `update()`, and the guest's `Replica` writes them into a
mirror `Game` that is never ticked (so render/HUD/audio code is shared). Keep any new gameplay-relevant
state replicated in `net/snapshot.ts`, or the guest won't see it.

**Bosses** extend `BossBase`. Each defines `attacks(phase)` returning weighted generator functions.
The base handles waking, intro, attack loop (no immediate repeats), HP-threshold phase transitions,
soft enrage, defeat sequence and rewards. Attack scripts `yield` seconds to wait.

**Rendering.** A fixed orthographic camera 50° above the ground; every repeated model is an instanced
batch; the 24 strongest practical lights live in shared uniforms evaluated by every world shader with
the same falloff (`core/pool.ts`). Details, techniques and performance numbers: `docs/RENDERING.md`.

**Art.** Everything is procedural — no model or texture files. Characters and enemies are SDF sculpts on
real skeletons (`sculpt/`, `models/characters.ts`, `models/creatures.ts`); props are built from geometry
helpers and the architecture kit; the ground is a shader. The only files are the two original music tracks
and web fonts.

---

## 4. Common tasks

| Task | Where |
|---|---|
| Tune balance (HP, speed, damage, spawn rates, boss HP, perk costs) | `src/data/*.ts` only. Log meaningful changes in `docs/DESIGN_DECISIONS.md` |
| Add an enemy | `data/enemies.ts` entry → behaviour in `sim/enemyAI.ts` (or reuse one) → model in `render3d/models/creatures.ts` (or `enemies.ts`) registered in `ENEMY_MODELS` → add to a wave in `data/waves.ts`. Tests check model/wave integrity automatically |
| Add a weapon | `data/weapons.ts` (base + evolution) → logic in `sim/weapons.ts` keyed by `kind` → icon in `render/art/icons.ts` → projectile model in `render3d/models/items.ts` (`ITEM_MODELS`). The content test will fail until it deals damage |
| Add a prop or building | Builder in `render3d/models/props.ts` (use `models/arch.ts`), register in `PROP_SPECS` (`world/props.ts`), footprint in `data/map.ts` if solid. See `docs/RENDERING.md` › Adding content |
| Check visuals | `docs/VISUAL_QA.md`: seeded states, `__nc.capture()` → `artifacts/visual/`, pixel metrics, `__nc.bench()` |
| Add a boss attack | Generator method on the boss class, add to `attacks(phase)`. Use `this.hz(...)` for telegraphed zones so ownership/damage scaling is handled |
| Add a sound | Recipe in `audio/synth.ts`, emit `bus.emit('sfx', { id })` from the sim |
| Add a setting | `Settings` + `defaultSettings()` in `meta/save.ts`, UI row in `ui/screens.ts` `settingsScreen`, apply in `app.applySettings()` |
| Change the save schema | Bump `SAVE_VERSION`, add a step to `MIGRATIONS` in `meta/save.ts`, add a migration test |

---

## 5. Testing & tools

- `npm test` — see `docs/QA_REPORT.md` §1 for what's covered. Key ones:
  - `tests/fullrun.test.ts`: god-mode autopilot plays a whole night; guards the end-to-end flow.
  - `tests/bosses.test.ts`: every boss through every phase, dawn rules, endless.
  - `tests/content.test.ts`: every weapon deals damage, every enemy runs, data/art integrity.
  - `tests/coop.test.ts`: co-op rules in the sim; `tests/net.test.ts`: codec, delta replication under loss,
    prediction, validation, lobby/session flows over a lossy loopback network, disconnect/reconnect.
- **Two-tab co-op harness** (dev server): `await __nc.coop.host()` in tab A, `await __nc.coop.join(code)` in
  tab B, `__nc.coop.start()` in A; `__nc.coop.autopick()` and `__nc.coop.diag()`. F3 in a co-op run shows
  live network diagnostics.
- **Balance proxy:** `npx vite-node scripts/survival.ts midway` (or `midway,carnival`) — the smart
  potential-field bot, 3 seeds × 6 characters, no god mode. `scripts/deaths.ts` breaks down damage sources.
- **Dev tools** (dev server only): press <kbd>`</kbd> in a run for the panel, or use `window.__nc`:
  `jump(sec)`, `speed(x)`, `god()`, `auto()`, `advance(sec)` (synchronous sim + render),
  `bench(frames)` (frame-cost measurement), `give(id)`, `evolve(id)`, `level(n)`, `bossHp(frac)`,
  `killAll()`, `unlockAll()`, `tickets(n)`.

---

## 6. Gotchas learned the hard way

1. **Don't recycle an enemy still in `game.active`.** A kill + respawn in the same tick once put the same
   enemy in the list twice, creating a self-loop in the spatial grid → infinite loop. The `inActive`
   flag on `Enemy` prevents it; keep it if you touch pooling.
2. **Import cycles with `game.ts`.** Shared constants live in `sim/constants.ts` because a top-level read
   of a value exported from `game.ts` caused a blank screen. Don't add top-level code that reads
   exports from modules that import `game.ts`.
3. **Canvas alpha is premultiplied.** The ground paint texture encodes surface type in alpha; alpha 0
   destroyed the colour. It now uses 255/170/85 — never 0.
4. **Boss gates hold (D-24).** A boss won't spawn while another is awake. In tests or when using
   `jump()`, earlier overdue bosses will spawn first and block later ones — kill or remove them
   (see how `bosses.test.ts` sets up each case).
5. **The Tent and Ferris Wheel exist from tick 0** as dormant scenery (`Director.init`). They wake only
   after their warning plays (`Director.gateOpen`).
6. **Embedded browser previews throttle `requestAnimationFrame`.** Real-time fps in the Claude preview
   pane is meaningless; use `__nc.advance()` / `__nc.bench()`. Screenshots there can also be a frame
   stale — wait a second and re-shoot.
7. **Line endings.** Some files were edited with tools that wrote CRLF; git normalises to LF and prints
   warnings on commit. Harmless.
8. **The byte codec clamps, never wraps** (`Writer.u8`). Decaying timers sit a hair below zero; masking
   once turned −0.01 into 252 and gave the guest a permanent hurt vignette.
9. **Co-op host frames tick unevenly** (a 144 Hz display has frames with no tick). Anything in
   `HostSession` that reasons about "the night is running" must be time-based, not per-frame — a per-frame
   check once dropped most of the guest's inputs.
10. **Dev tools must stay dynamically imported** (`import('./dev')` inside `if (import.meta.env.DEV)`)
   so they're stripped from production. Verify with a grep for `__nc.` in `dist/assets/*.js` (the only
   allowed hit is the `__nc_probe` localStorage key).

---

### Rendering gotchas (graphics passes)

- **Stripes need geometry seams.** Per-vertex colour functions smear stripes across triangles; build one
  patch per stripe (`patch()`, `canvasRoof()`, `stripedCanopy()`) for crisp canvas.
- **Pool selection is scored.** Only the 24 best-scoring lights reach the shaders; a light that must
  always show (searchlights) needs a higher `priority` or it silently drops out in busy areas.
- **Never put data in `iAnim.z`** on actor batches — it is the hit-flash channel (white-out). Wind/grass
  phase rides in `iAnim.y`; gusts read the instance translation.
- **Inverted `smoothstep` edges are undefined in GLSL** — write `1.0 - smoothstep(a, b, x)`.
- **A hidden in-app browser pane pauses `requestAnimationFrame`**: drive frames with
  `__nc.app.renderer.render(game, 1, dt)` or `__nc.capture()`, and wait for the boot overlay
  ("Sculpting the crowd…") to disappear before capturing.
- **`renderer.info` is reset manually once per frame** (`autoReset = false`), so its numbers include
  shadow and post passes.

---

## 7. Design decisions you should know about

Full list in `docs/DESIGN_DECISIONS.md`. The ones most likely to surprise you:

- **D-01:** the clock stalls at 24:59 until the Ringmaster dies; beating him early → victory lap → dawn.
- **D-02:** population caps 180/280/400 (from the docs) but tier HP/damage from the Godot resources.
- **D-07:** Grand Menagerie (Top Hat Lv8 + Strongman Belt) was invented — the docs referenced it without
  defining it.
- **D-24:** bosses never stack.
- **D-25:** cone weapons aim at the nearest enemy, not movement direction.
- **D-26:** chests are much stingier than the Godot values (evolutions were arriving by 5:30).
- **D-27:** large tickets are magenta, not red (red is reserved for danger).
- **D-29/D-30:** Act I was softened after instrumented bot runs (stuffie/clown HP, wave density,
  card pierce, pickup radius, Godot XP curve restored).

---

## 8. What's not done (priority order)

0. **Online co-op alpha:** verify across two machines on **different networks** on the live site
   (https://nightmare-carnival.netlify.app) with the checklist in `docs/MULTIPLAYER.md` §5 (note the F3 route — `relay` means
   TURN was needed). Redeploys use the Netlify CLI (§4); ask the repo owner before each one. Tune co-op
   scaling (`COOP.density`/`COOP.hp`) from what the duo reports.
1. **Human playtests** — balance on all tiers and characters (bots under-represent melee and summoners),
   and **readability in heavy combat** after the graphics pass (telegraph striping, darker spaces between
   light pools, ground cover). See the honest-uncertainty notes in `docs/PROGRESSION.md`.
2. **Real hardware performance** at 1080p/1440p/4K and on integrated GPUs. Measured here (1600×900, High,
   DPR 1): ≈4.7 ms/frame in late combat. The ground shader (≈1.3 ms) and the ink-outline/shadow passes on
   sculpted crowds are the first costs to watch; Low quality drops bloom, grain, shadows and grass.
3. **Graphics, still below the premium bar** (`docs/VISUAL_QA.md`): apply the architecture kit to the
   remaining attractions (caravans, carts, cotton/hotdog stands, gate arches, coaster ruin, dunk tank);
   bosses and summons are still built from the primitive kit (now with procedural surface detail); more
   distinct silhouettes for the toy enemy roster; searchlight beams through the mist; UI portraits and
   Pedia art are still the old 2D cartoon style.
4. **Physical gamepad testing** (standard mapping, never tried on a device). No touch controls.
5. **Colourblind palettes** — only a high-contrast telegraph toggle exists.
6. Optional: localisation, recorded boss music.

Known non-critical noise: at synthetic extreme densities, damage numbers clutter the screen — consider
merging numbers per enemy or capping them lower in `render/fx.ts`.

---

## 9. Suggested first steps

1. `npm install && npm test` to confirm a green baseline.
2. `npm run dev`, play a few honest runs on Midway with different characters, note where you die and
   how long bosses take.
3. Tune in `src/data/`, re-run `npm test` and `npx vite-node scripts/survival.ts midway`.
4. Decide with the repo owner whether to push `web-threejs-rebuild` and open a PR against `main`.
