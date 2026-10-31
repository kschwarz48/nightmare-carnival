# The Boardwalk — handoff (D-68, 2026-10-31)

What was built, where it lives, how to look at it, and what is still weak.

Design: `BOARDWALK.md`. Quest solution (developer-only): `EASTER_EGG_BOARDWALK.md`. Decision: D-68 in
`DESIGN_DECISIONS.md`. Evidence: `QA_REPORT.md` and `VISUAL_QA.md`.

## Play it

- **Unlocking:**
  - In the game, beat the Proprietor (the Fun House) and the Midway's Boardwalk gate opens. The solo
    picker and the co-op lobby list it third.
  - For alpha testing, open the game with `?unlock=boardwalk`.
- **Dev build:** `window.__THREE_GAME_TEST_HOOKS__.setState(name)` jumps straight to a view.

  | Kind | States |
  |---|---|
  | Regions | `bw-plaza`, `bw-arcade-row`, `bw-coaster`, `bw-wharf-gate`, `bw-beach`, `bw-shore`, `bw-pier`, `bw-pier-end`, `bw-wheel` |
  | Interiors | `bw-arcade`, `bw-giftshop` |
  | Crowd | `bw-bestiary` (every new creature in a line-up), `bw-rising` (the drowned climbing out, swimmers offshore) |
  | Combat | `bw-midway-combat`, `bw-beach-combat` |
  | Bosses | `bw-boss-barker`, `bw-boss-captain`, `bw-boss-ride`, `bw-boss-leviathan`, `bw-boss-commodore` |
  | Quest stages | `bw-egg-shop`, `bw-egg-games`, `bw-egg-wheel`, `bw-egg-wreck`, `bw-egg-pier`, `bw-egg-bell` |

## Where things live

| What | Files |
|---|---|
| Map data (bounds, shore and tide, pier, buildings and doors, rides, track, props, quest positions, Ada's lines, ambience mix) | `src/data/boardwalk.ts` |
| Waves / bosses / events / map entry | `src/data/waves.ts` (`BOARDWALK_*`), `src/data/bosses.ts` (`BOARDWALK_BOSSES`, `COMMODORE_DEF`), `src/data/events.ts` (`BOARDWALK_EVENTS`), `src/data/maps.ts` |
| Enemies | `src/data/enemies.ts` (defs), `src/sim/boardwalkAI.ts` (behaviours), `src/render3d/models/boardwalkCreatures.ts` (sculpts), `src/render/art/boardwalkEnemies.ts` (Pedia art) |
| Sea, coaster, spawns | `src/sim/boardwalk.ts` |
| Bosses | `src/sim/bosses/bwBoss.ts`, `barker.ts`, `captain.ts`, `lastRide.ts`, `leviathan.ts`, `commodore.ts`; rigs in `src/render3d/boardwalkBosses.ts`; portraits in `src/render/art/boardwalkBosses.ts` |
| Quest | `src/sim/quest/summersEnd.ts`; world visuals in `src/render3d/world/boardwalk/quest.ts`; presentation in `src/app.ts` (`onSummersEnd`) |
| World | `src/render3d/world/boardwalk/` (`world.ts` assembles `floor`, `ocean`, `pier`, `structures`, `interiors`, `props`, `rides`, `lighting`, `quest`) |
| Audio | `src/audio/audio.ts` (`bw_*` waltz themes, three ambience beds, `setShoreMix`), `src/audio/synth.ts` (new SFX) |
| Tests | `tests/boardwalk.test.ts`, `tests/boardwalkBosses.test.ts`, `tests/summersEnd.test.ts` |

## Balance knobs

- **Crowd:**
  - `BOARDWALK_WAVES` weights, and the enemy defs' HP, speed and contact.
  - A barnacle's crust: `shell: { mult, soak, cracked, haste }`.
  - The mark: `MARKED_HASTE` (1.22) in `boardwalkAI.ts`, and `MARK_TIME` (5 s) in `game.ts`.
  - Wading: `wadeFactor` in `sim/boardwalk.ts`.
- **Bosses:** HP in `data/bosses.ts`; per-attack timings and damage in each boss file; tuning exports
  (`BARKER`, `CAPTAIN`, `LAST_RIDE`, `LEVIATHAN`, `COMMODORE`) are what the tests read.
- **Quest:** `SUMMERS_END` in `data/boardwalk.ts` (windows, fire time, bell hold, strike range).
- **Measuring:** `npx vite-node scripts/maphp.ts 3 carnival_core,fun_house,boardwalk` compares crowd
  health per spawn across the maps.

Per the standing rule, tune from playtests in small steps (about 10–20%); bots only rule out extremes.

## Weak spots and next steps

1. **The beach is the weakest view:** dark, sparse and low-contrast, even after the lantern and fire-pit
   pass. It needs more dressing (snow fences, washed-up debris, footprints into the surf) and maybe a
   touch more moonlight on wet sand.
2. **Not playtested by a person**; not tried in co-op on two machines (PROTO 10); not heard (the new
   ambience beds and waltz were built but not listened to).
3. **Acts III–IV crowd balance** was measured with one noisy seed. Re-run `maphp.ts` with three seeds
   now that the real bosses are in.
4. **The ocean still lacks some planned effects:** foam rings at every pier piling and boat hull, and
   screen-space spray where breakers hit the pilings.
5. **The Leviathan's head faces its player, so from the south the camera mostly sees its back and
   crown.** A three-quarter turn toward the camera while it's up might read better.
6. **The Grand Display miniboss (Fun House) uses the regular mannequin sculpt at the same size.** Its lore
   says "giant". Noticed while sizing the Great Barnacle, which uses a 1.5× sculpt; left untouched, since
   it's outside this change.
7. **Mobile viewports were not checked** (the project's QA has been desktop-only).

## Release

Committed on `web-threejs-rebuild`. Not pushed or deployed: both need the owner's go-ahead. The usual
redeploy is the Netlify CLI command in the project notes.
