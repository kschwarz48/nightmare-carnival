# Nightmare Carnival — Web Edition (Three.js)

A 1930s rubber-hose cartoon-horror **survivors-like** for the browser. Survive from midnight to dawn
on the haunted Carnival Core: dodge telegraphed attacks, let your carnival weapons fire on their own,
collect Tickets, draft upgrades, evolve your arsenal, and topple the four ride-bosses — the Carnival
Tent, the Ferris Wheel, the Puppet King and the Ringmaster — before the sun crests the sea.

This is a complete rebuild of the Godot project in the repository root (which is left untouched),
written in **TypeScript + Three.js + Vite**, with Web Audio sound and DOM/CSS menus.

---

## Quick start

Requires **Node.js 18+** (developed on Node 22).

```bash
cd web
npm install
npm run dev        # http://127.0.0.1:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload and the dev-only testing tools |
| `npm test` | Vitest suite (106 tests, including an accelerated full 25-minute run) |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm run build` | Type-checks, then produces a static production build in `web/dist/` |
| `npm run preview` | Serves `web/dist/` locally to check the production build |

### Deploying

`npm run build` outputs a fully static site (`dist/index.html`, `dist/assets/*`, `dist/audio/*`).
It uses relative paths (`base: './'`), so it can be dropped onto any static host — GitHub Pages,
Netlify, itch.io (upload `dist/` as an HTML5 game zip), an S3 bucket, or any web server. No backend
is required; progress is stored in the browser's `localStorage`.

---

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move | WASD / arrow keys | Left stick / D-pad |
| Aim (Hybrid/Manual aim modes) | Mouse | Right stick |
| Weapons | fire automatically | — |
| Pause | Esc / P | Start / Select |
| Confirm / pick a card | Enter / Space / click, or 1–4 | A |
| Back | Backspace | B |
| Reroll / Banish / Skip (when owned) | R / B / X | X / Y / LB |

All keyboard actions are rebindable in **Settings → Controls**. Every menu is navigable with the
D-pad / arrow keys.

---

## What's in the game

- **One night, four Acts (~25 min):** Warm-Up → The Crowd → The Parade → Last Call, each ending in a
  ride-boss (6:00 / 12:00 / 18:00 / 24:00). Dawn requires defeating the Ringmaster (see
  `docs/DESIGN_DECISIONS.md` D-01), followed by a sunrise sequence and an optional **Endless /
  Lock-In** continuation.
- **6 characters** with distinct starting weapons, stats and quirks; 4 are unlocked through play.
- **15 enemies** with 13 AI patterns (chasers, erratic chasers, burst & line chargers, ricocheting
  bumper cars, flyby swarms, kiting shooters, marching formations, spawners, ambush traps, burrowing
  pop-ups, screen-crossing rail serpents, a miniboss brute), elite variants and Nightmare affixes.
- **4 multi-phase bosses** built as cut-out puppets with full bible movesets, telegraphs, soft
  enrage, cinematic intros/defeats, segmented boss bars.
- **18 weapons + 18 evolutions + 16 passives**, weighted drafts with rarity, relevance and pity,
  rerolls/banishes/skips, reward chests.
- **Carnival events** (Lights Out, Free Funnel Cake, Stampede, Clown Car, Last Ticket, Carousel
  Spins Up, Calliope Crescendo, The Parade Marches, Mole Brigade) and map hazards (Tilt-a-Whirl,
  grease slicks).
- **Meta-progression:** Lost Tickets, the Lost & Found (perks, performers, new attractions),
  18 achievements, the Carnival-pedia, Midway/Carnival/Nightmare tiers, the Curse, and a seeded
  **Daily Run** with local best scores.
- **Accessibility:** volume buses (master/music/SFX/ambience), mute, reduced flashing, screen-shake
  slider, high-contrast telegraphs, damage-number toggle, UI scale, dyslexia-friendly font, aim
  modes, key rebinding, first-run tips (replayable), graphics quality presets.

---

## Project layout

```
web/
  index.html            page shell
  public/audio/         original soundtrack (converted from the repo's .m4a files)
  src/
    main.ts, app.ts     boot, screen state machine, fixed-timestep loop, event wiring
    dev.ts              DEV-only testing tools (never bundled in production)
    core/               math, seeded RNG, typed event bus, allocation-free spatial grid
    data/               all content as typed data (ported from resources/*.tres + design docs)
    sim/                the render-free simulation: game, player, enemies & AI, director,
                        weapons, draft/evolutions, events, bosses/* (coroutine attack scripts)
    render/             Three.js renderer, sprite/shape batches, lighting, ground, FX, post
      art/              procedural rubber-hose art (every sprite is painted here at boot)
    audio/              Web Audio engine + offline SFX synthesizer
    ui/                 HUD, draft, chest, menus (DOM/CSS)
    meta/               versioned save system
    input/              keyboard / mouse / gamepad
  tests/                Vitest suite + autopilot helpers
  scripts/              balance & profiling scripts (run with `npx vite-node scripts/<file>.ts`)
  docs/                 audit, design decisions, asset manifest, QA report, progress
```

The simulation never imports Three.js, so the whole game can run headless in tests: a full
god-mode night with an autopilot completes in ~15 s of CPU time.

## Development tools (dev server only)

Press <kbd>`</kbd> during a run for the dev panel, or use `window.__nc` in the console:
`__nc.jump(seconds)`, `__nc.speed(x)`, `__nc.god()`, `__nc.auto()`, `__nc.advance(seconds)`,
`__nc.bench(frames)`, `__nc.give('fireworks')`, `__nc.level(5)`, `__nc.bossHp(0.1)`,
`__nc.unlockAll()`, `__nc.tickets(1000)`. These are imported dynamically under
`import.meta.env.DEV` and are stripped from production builds.

## Documentation

- [`docs/IMPLEMENTATION_AUDIT.md`](docs/IMPLEMENTATION_AUDIT.md) — what the Godot project had, what was missing, migration decisions
- [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md) — every gap or contradiction resolved (D-01…)
- [`docs/ASSET_MANIFEST.md`](docs/ASSET_MANIFEST.md) — every visual/audio asset, its source and status
- [`docs/QA_REPORT.md`](docs/QA_REPORT.md) — tests, performance measurements, playtest notes, known limitations
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — status and next steps
- [`docs/RENDERING.md`](docs/RENDERING.md) — the 2.5D renderer, reusable graphics techniques, performance
- [`docs/VISUAL_QA.md`](docs/VISUAL_QA.md) — visual iteration workflow (seeded states, captures, metrics) and the latest scorecard
- [`docs/PROGRESSION.md`](docs/PROGRESSION.md) — XP, economy and pacing maths with measurements
- [`docs/EASTER_EGG_SOLUTION.md`](docs/EASTER_EGG_SOLUTION.md) — **developer-only spoilers**: the full Last Song solution

## Credits

- Game design & original Godot project: the Nightmare Carnival repository docs and code.
- Music: **"Freaky Funk Circus"** (intro + loop) by **Bradley Schwarz**, from the repository.
- All other art, sound effects and the procedural boss score were created for this rebuild
  (procedurally, in code). Fonts: Rye and Oswald (SIL Open Font License) via Fontsource.
