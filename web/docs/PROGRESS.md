# Progress

_Last updated: 2026-10-30 · branch `web-threejs-rebuild`_

## Status: feature-complete & playable; balance needs human playtesting

All four Acts, six characters, 15 enemies, four multi-phase bosses, 18 weapons + 18 evolutions +
16 passives, events, meta-progression, modes (tiers, Curse, Endless, Daily), audio, accessibility and
the full menu flow are implemented and verified by 106 automated tests and browser screenshots.
See `QA_REPORT.md` for evidence and limitations.

## Completed

- [x] Implementation audit and design-decision log (D-01 … D-30)
- [x] Headless fixed-timestep simulation (pools, spatial grid, director, AI, weapons, bosses, events)
- [x] Procedural rubber-hose art pipeline for every asset (see `ASSET_MANIFEST.md`)
- [x] Three.js renderer: instanced lit sprites, shapes, ground/sea shader, lights, FX, post
- [x] Web Audio: original tracks (per-Act darkening), boss sequencer, ~100 synthesized SFX, ambience
- [x] UI: title, select, daily, HUD, draft, chest, pause, results, Lost & Found, pedia, settings
- [x] Save system with migration + backup; keyboard/mouse/gamepad input with rebinding
- [x] Dev tools (dev-only) and accelerated test harness; production build
- [x] Online two-player co-op alpha (D-51…D-53): VS rules in the sim, host-authoritative WebRTC netcode
      with delta snapshots and prediction, lobby/codes/reconnect, co-op HUD — `MULTIPLAYER.md`
- [x] Alpha deployed on Netlify: https://nightmare-carnival.netlify.app — `MULTIPLAYER.md` §4

## Outstanding / recommended next steps

0. **Co-op alpha:** verify on two machines on different networks on the live site (`MULTIPLAYER.md` §5);
   tune `COOP.density` / `COOP.hp` from feedback.
1. **Human balance playtests** on Midway/Carnival/Nightmare for all six characters (especially melee
   Strongman and summoner Ringleader); tune via `src/data/*.ts` only.
2. Real-time fps profiling on target hardware at 1080p/1440p/4K; consider lowering the ground shader's
   light count on Medium.
3. Physical gamepad pass (button glyphs, menu nav feel); optional touch controls for tablets.
4. Optional art upgrades: extra animation frames (attack/death poses) for common enemies.
5. Colourblind palette presets for telegraphs and pickups.

## Exact next implementation step

Run a human playtest session (`npm run dev`), record deaths/boss kill times per character, and adjust
`src/data/waves.ts` (min/max alive, intervals) and boss HP in `src/data/bosses.ts` accordingly; re-run
`npm test` (the full-run test guards the end-to-end flow) and `npx vite-node scripts/survival.ts midway`.
