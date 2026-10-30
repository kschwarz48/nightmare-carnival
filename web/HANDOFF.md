# Handoff — Nightmare Carnival Web Edition

For the next engineer picking up the Three.js rebuild. Read this first, then `README.md` (how to run it)
and `docs/DESIGN_DECISIONS.md` (why the numbers are what they are).

_Written 2026-10-30. Branch: `web-threejs-rebuild` (4 commits on top of `m5-content`, not pushed, no PR)._

---

## 1. TL;DR

- The game is **feature-complete and playable**: all 6 characters, 15 enemies, 4 three-phase bosses,
  18 weapons + 18 evolutions, 16 passives, events, meta-progression, all modes, audio, menus, settings.
- **106 tests pass**, typecheck is clean, `npm run build` produces a static site.
- The **biggest open item is human balance playtesting.** All tuning so far was done with bots.
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
    game.ts         The Game: pools, player, damage, pickups, XP/drafts, hazards, dawn/endless/end
    director.ts     Waves, spawn band, leash, swarms, formations, boss gates, miniboss, endless
    enemyAI.ts      13 behaviours (switch on def.behavior)
    weapons.ts      All weapon logic (switch on def.kind), projectiles, summons, mirror replay
    draft.ts        Draft generation, evolutions, chest rewards
    carnivalEvents.ts  The 9 timed events
    bosses/         boss.ts (framework) + tent / ferris / puppet / ringmaster
    script.ts       Generator coroutines advanced by sim time (boss attack scripts)
  render/           Three.js side
    art/            Every sprite is drawn here in Canvas2D code (no image files)
    assets.ts       Registers every frame into atlases at boot; DOM images (icons/portraits)
    renderer.ts     Draws the world from sim state each frame
    sprites.ts, shapes.ts, lights.ts, ground.ts, fx.ts, post.ts
  audio/            audio.ts (engine, music, boss sequencer), synth.ts (SFX recipes)
  ui/               hud.ts (HUD, draft, chest), screens.ts (menus), dom.ts, style.css
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

**Coordinates.** Sim space is **y-down** (north = negative y), matching Godot. The sprite and shape
shaders flip to Three.js y-up. Map is 4400×4400 centred on 0,0; the sea is south of `SEA_Y`.

**Pools.** Enemies, projectiles, bullets, hazards, pickups, zones, summons are preallocated in `Game`.
`game.active` is the live enemy list, compacted at the end of each tick.

**Damage entry points.** `game.damageEnemy` / `game.damageTarget` (dispatches boss parts) /
`game.hurtPlayer`. Go through these — they handle crits, shields, knockback, stats and FX.

**Hazards** (`Hazard` in `entities.ts`) are the generic "telegraph then hurt" primitive behind every boss
attack and many enemy tells: shape + `tele` (warning time, no damage) + `active` + optional motion,
pull, `onActivate` callback. The renderer draws them by `shape`/`style`. `owner` = boss/enemy uid so they
get cleaned up on death.

**Bosses** extend `BossBase`. Each defines `attacks(phase)` returning weighted generator functions.
The base handles waking, intro, attack loop (no immediate repeats), HP-threshold phase transitions,
soft enrage, defeat sequence and rewards. Attack scripts `yield` seconds to wait.

**Rendering.** Instanced sprite batches (one draw per layer per atlas page). The world layer uses alpha
cutout + depth for y-sorting (`zOf(y)` in `renderer.ts`). Lighting is a shared uniform array
(`lights.ts`) evaluated in both the ground and sprite shaders.

**Art.** Everything is procedural: `render/art/*.ts` draw functions are called by `assets.ts` at boot to
paint frames into 4096² atlases. To change a sprite, edit its draw function — there is no image file.

---

## 4. Common tasks

| Task | Where |
|---|---|
| Tune balance (HP, speed, damage, spawn rates, boss HP, perk costs) | `src/data/*.ts` only. Log meaningful changes in `docs/DESIGN_DECISIONS.md` |
| Add an enemy | `data/enemies.ts` entry → behaviour in `sim/enemyAI.ts` (or reuse one) → art in `render/art/enemies.ts` + `ENEMY_ART` box → add to a wave in `data/waves.ts`. Tests check art/wave integrity automatically |
| Add a weapon | `data/weapons.ts` (base + evolution) → logic in `sim/weapons.ts` keyed by `kind` → icon in `render/art/icons.ts` → projectile art/rendering if needed. The content test will fail until it deals damage |
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
8. **Dev tools must stay dynamically imported** (`import('./dev')` inside `if (import.meta.env.DEV)`)
   so they're stripped from production. Verify with a grep for `__nc.` in `dist/assets/*.js` (the only
   allowed hit is the `__nc_probe` localStorage key).

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

1. **Human balance playtests** on all three tiers and all six characters. The kiting bot under-represents
   melee (Strongman) and summoners (Ringleader). Optimised god-mode builds kill bosses in 20–60 s vs. the
   75–110 s design target; human builds should be slower, but verify.
2. **Real-time fps on real hardware** at 1080p/1440p/4K. Measured frame cost is ~2–3 ms at 800×510; the
   ground shader loops over up to 40 lights per pixel and is the likely first cost at high resolution.
3. **Physical gamepad testing** (implemented to the standard mapping, never tried on a device).
   No touch controls.
4. **Colourblind palettes** — only a high-contrast telegraph toggle exists.
5. Optional: more animation frames for common enemies (currently walk ×4 + wind-up), recorded boss
   music, localisation.

Known non-critical noise: at synthetic extreme densities, damage numbers clutter the screen — consider
merging numbers per enemy or capping them lower in `render/fx.ts`.

---

## 9. Suggested first steps

1. `npm install && npm test` to confirm a green baseline.
2. `npm run dev`, play a few honest runs on Midway with different characters, note where you die and
   how long bosses take.
3. Tune in `src/data/`, re-run `npm test` and `npx vite-node scripts/survival.ts midway`.
4. Decide with the repo owner whether to push `web-threejs-rebuild` and open a PR against `main`.
