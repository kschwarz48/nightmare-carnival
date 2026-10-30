# Nightmare Carnival — Implementation Audit (Godot → Three.js)

Audit date: 2026-10-30 · Source: `main`/`m5-content` Godot 4.7 project at repo root (68 commits, ~5,450 lines GDScript, 9 design docs).
This audit was produced by reading every design doc (`docs/01`–`09`), every `resources/*.tres`, and the
scripts under `scripts/` (autoloads, components, enemies + behaviors, bosses + attacks, weapons, systems, UI).
Where the docs and the code disagree, **the code is treated as the newer tuning** unless noted.

---

## 1. Existing functional systems (Godot)

| System | Where | State |
|---|---|---|
| Autoloads: EventBus, GameState, SaveManager, ContentDB, ObjectPool, EnemyDirector, GemDirector, MapBounds, AudioManager (stub) | `scripts/autoload/` | Working |
| Components: Health / Hurtbox / Hitbox / Flash | `scripts/components/` | Working |
| Player: movement 220 px/s, PlayerStats (all axes), slow debuff, regen, revives, Strongman shove | `scripts/player/` | Working |
| XP curve `5 + 3L + L^1.6`, ticket gems (blue/green/red by value), 400-gem cap + Red Gem Bank, magnet | `level_system.gd`, `gem_director.gd`, `ticket_gem.gd` | Working |
| Draft: weighted sampling, luck rarity weight, build-relevance (×1.5 / ×3 / ×2.5), guaranteed evolution card | `systems/draft_generator.gd`, `data/upgrade_data.gd` | Working |
| Evolution detection (Lv8 + passive ≥1) & slot replacement | `systems/evolution_system.gd`, `weapon_manager.gd` | Working |
| EnemyDirector: VS-style rectangular spawn band, spawn blocking, despawn leash (1.7× view), min-alive top-up + interval batches, flyby swarm overlay, elite bursts, miniboss timer, time scaling `hp 1+0.06m / dmg 1+0.04m / spd 1+0.01m (≤1.6)` | `enemy_director.gd` | Working |
| Wave timeline w_0000 → w_2400 (16 waves, four Acts) | `resources/waves/` | Working |
| Enemy behaviors: chaser, erratic_chaser, burst_charger, flyby, shooter, spawner, ambusher, pop_up, rail_strafer | `scripts/enemies/behaviors/` | Working (programmer art) |
| 15 EnemyData incl. Carnival Brute miniboss (chest 1–7 rolls) | `resources/enemies/` | Working |
| Boss framework: dormant → wake at gate → roam → weighted attack loop → HP-threshold phases → soft enrage → chest + ticket burst | `scripts/bosses/boss.gd` | Working |
| Carnival Tent (full bible moveset incl. Rotating Pole, Ring of Fire) | `tent_boss.gd` + 10 attacks | Working |
| Ferris Wheel (spiral, gondola drop, roll, stampede) | `ferris_boss.gd` | Partial (no spoke sweep / sparks / spoke boomerangs / gondola bombs) |
| Puppet King (slam, string sweep, levy, cuttable strings → stagger, free lunge) | `puppet_boss.gd` | Partial (no crossbar drop, tangle lash, crown toss, flailing limbs) |
| Ringmaster (whip, bullet rings, summon, parade of horrors) | `ringmaster_boss.gd` | Partial (no spotlight/grand bow, cane shockwave, hellfire burn ground, finale barrage, demon transform) |
| Weapons: Throwing Cards, Mallet, Fireworks, Ring Toss, Crystal Orbs, Plush Companion (+6 evolutions) | `scripts/weapons/`, `resources/weapons/` | Working |
| Passives (8): Strongman Belt, Energy Drink, Spectacles, Foam Finger, Extra Token, Running Shoes, Sugar Rush, Lucky Ticket | `resources/passives/` | Working |
| Characters: Carny, Strongman | `resources/characters/` | Working |
| Difficulties: Midway / Carnival / Nightmare (hp 1/1.5/2.2, dmg 1/1.25/1.6, greed 0/.3/.6) | `resources/difficulties/` | Working |
| Meta: Lost Tickets payout `t/6 + 50·bosses + kills/25 + 100·win` × greed; 5 perks (HP, Might, Speed, Pickup, Revive); unlock gating; pedia discovery; JSON save | `save_manager.gd`, `game_state.gd` | Working, unversioned save |
| Menus: main, character select, Lost & Found, pause (volume, reduce flashes), HUD, draft, results | `scripts/ui/` | Working (unstyled) |
| Pickups: food (+20 HP every 70–110 s), Golden Ticket vacuum (280–440 s), chests | `scripts/pickups/` | Working |
| Events: EventData + EventRunner with one `elite_pack` (Clown Pack @ 8:00) | `systems/event_runner.gd` | Skeleton |

## 2. Partially implemented systems

- **Bosses 2–4**: attack pools are subsets of the bible (see table above). Puppet King reuses Tent attacks as stand-ins.
- **Formation behavior** for Puppet Soldiers (they use the generic shooter).
- **Carousel Horse / Bumper Car** reuse burst_charger; no "wheel around for another pass", no ricochet.
- **Carnival events**: only Clown Pack. No Lights Out, Funnel Cake, Stampede, Last Ticket, Carousel Spins Up, Calliope Crescendo.
- **Hazards**: none of Tilt-a-Whirl, grease slicks, stakes; no environmental interactions.
- **Elite affixes** (Explosive, Splitter, Hasted, Shielded, Magnetic): not implemented; only the ×6 HP/×1.5 dmg elite flag.
- **Win condition**: Ringmaster defeat ends the run immediately; 25:00 timer also ends it → contradiction (see §5).
- **Audio**: `AudioManager` is a stub; the two Bradley Schwarz tracks exist as WAV but aren't wired to scenes beyond import.
- **Settings**: master volume + reduce flashes only.

## 3. Missing gameplay

- 4 characters (Fortune Teller, Ride Operator, Lost Child, Ringleader) and their quirks.
- 12 weapons: Tarot Toss, Bumper Car, Top Hat, Popcorn Popper, Balloon Darts, Cotton-Candy Gun, Carnival Cannon, Snow-Cone Machine, Hot-Dog Grill, Laser Light Show, Strongman Bell, Funhouse Mirror (needs `dash`, `clone`, `beam`, `cone`, `lob` styles).
- 11 evolutions (Death Card, Demolition Derby, Grand Menagerie\*, Kettle-Korn Cannon, Sharpshooter's Bouquet, Sticky Situation, Cannonball Special, Blizzard Machine, Inferno Grill, Grand Illumination, High Striker, Hall of Mirrors). \*Grand Menagerie is referenced by Top Hat but absent from the evolution table.
- 8 passives: Spinning Top, Caffeine, Funnel Cake, Safety Goggles, Magnet Glove, Season Pass, Coin Purse, Rabbit's Foot.
- Status effects: slow, chill→freeze, burn DoT, sticky DoT.
- Draft QoL: Reroll, Banish, Skip; 4th card (Fortune Teller / high luck); rarity ribbons.
- Endless / Lock-In, Curse, Daily Run (seeded), victory lap, dawn sequence.
- Achievements; Carnival-pedia browsing UI and set-completion rewards.
- Manual / hybrid aim; gamepad UI navigation; key remapping.

## 4. Missing content & assets

- **All art.** Every entity in Godot is a `Blob` (colored circle/square/triangle) or a text `Label`. The map is a grid with labeled rectangles. No sprites, portraits, icons, logo, or environment textures exist in the repo.
- **SFX**: none. **Music**: two original tracks (Freaky Funk Circus with Intro 84 s, Loop 64 s) — no boss/act music.
- Shaders: only `flash.gdshader`.

## 5. Unresolved design contradictions

| # | Contradiction | Resolution (see DESIGN_DECISIONS.md) |
|---|---|---|
| C1 | Ringmaster spawns 24:00 with ~100–120 s expected fight; Dawn at 25:00; GDD says "beat him to win" but GameState also wins at 25:00 regardless. | Dawn requires the Ringmaster's defeat. If he is alive at 25:00 the clock **stalls at 24:59** ("he holds back the dawn"). Defeat before 25:00 → victory lap until 25:00; after → dawn immediately. D-01 |
| C2 | Population caps: doc 03 says 180/280/400; resources say 280/320/360. | Use doc caps 180/280/400 (prompt + newest design text). D-02 |
| C3 | Tier HP mults: doc 1.0/1.35/1.8 vs resources 1.0/1.5/2.2. | Keep resource values (newest tuning). D-02 |
| C4 | Enemy contact damage: bible (balloon 6, stuffie 10, clown 12) vs resources (3, 5, 6). Monkey speed 165/95. | Resources (they were retuned against 220 px/s player). D-03 |
| C5 | GDD §8 Gold + Intermission Wagon vs doc 03 pre-M5 update removing them. | No Gold, no Wagon. Greed boosts Lost Tickets only. D-04 |
| C6 | Three zones (Beach/Boardwalk/Carnival) vs single Carnival Core. | Single Carnival Core; the sea is the southern boundary; boardwalk becomes a plank promenade inside the core. D-05 |
| C7 | Chests: doc 05 "weapon/passive/evolution weighted to build" vs doc 03 VS-style "N random upgrades to equipped items". | VS-style rolls, **but** an evolution that is ready is always granted first. D-06 |
| C8 | Grand Menagerie missing from evolution table; Nightmare Menagerie and Grand Menagerie both "pack" fantasies. | Grand Menagerie = Top Hat Lv8 + Strongman Belt: a three-ring circus troupe (lion, elephant, acrobats) with distinct roles. D-07 |
| C9 | Extra Token: doc "+1 every 2 levels, 5 levels" vs resource "+1 per level, max 2". | 5 levels, +1 Amount at L1/L3/L5 (+3 total). D-08 |
| C10 | Strongman Belt gates three evolutions (Ring Toss, Hot-Dog Grill, Top Hat); Spinning Top gates two; Lucky Ticket two; Energy Drink two; Spectacles two; Foam Finger two. | Allowed — a passive can unlock several evolutions; each passive slot then carries more weight. Documented. D-09 |
| C11 | Evolution passive threshold "≥ a threshold level, default ≥1". | ≥1. D-09 |
| C12 | Doc says Fortune Teller "sees next draft rarity"; also "4 choices with Fortune Teller". | Fortune Teller always gets 4 draft cards and a rarity preview on the XP bar. D-10 |
| C13 | Lost Child "1 HP-ish balloon shield economy". | Balloon Shield mechanic (absorb one hit, regrows) + 1 revive balloon. D-11 |
| C14 | Old 600-enemy perf benchmark vs 180/280/400 caps. | Measure against 400 (Nightmare) + boss + projectiles. D-12 |

## 6. Godot → Three.js migration decisions

| Godot concept | Web implementation |
|---|---|
| Physics process / CharacterBody2D | Fixed 60 Hz simulation (`src/sim`) in pure TypeScript with **no rendering dependency** (headless-testable). Render interpolates. |
| EventBus autoload | Typed `EventBus` (`src/core/events.ts`). |
| ContentDB + `.tres` resources | Typed data tables in `src/data/*.ts` (ported values from every `.tres`). |
| GameState | `Run` object owned by `Game` (`src/sim/game.ts`). |
| SaveManager | `src/meta/save.ts` — versioned JSON in `localStorage`, migration chain, corruption fallback + backup slot. |
| EnemyDirector + SpatialHash | `src/sim/director.ts` + allocation-free uniform grid (`src/core/grid.ts`, linked-list cells). |
| ObjectPool | Fixed-capacity typed pools per entity kind (enemies, projectiles, hazards, pickups, particles). |
| Area2D hit detection | Grid broad-phase + circle/segment/arc tests in `src/sim/combat.ts`. |
| `await`-based boss attacks | Generator coroutines advanced by sim time (`src/sim/script.ts`) — pause-safe and deterministic. |
| Blob programmer art | Procedural vector art painted with Canvas2D into texture atlases at boot (`src/render/art/*`), drawn with instanced sprite batches + custom shaders. |
| CanvasModulate + PointLight2D | Ground/sprite shaders sample a shared light uniform array (night tint, attraction pools, player lantern, flicker). |
| Godot UI scenes | DOM/CSS overlay screens (`src/ui`). |
| AudioManager stub | Web Audio graph with master/music/sfx/ambience buses; original tracks streamed + decoded; synthesized SFX and procedural boss score. |
| `randf()` | Seeded PRNG for all simulation randomness (deterministic Daily Runs); visual-only noise uses Math.random. |

## 7. Completion criteria (web build)

The build is complete when the checklist in the brief §19 holds. Concretely, verified by:
1. `npm test` — unit tests for stats, damage, i-frames, XP, draft legality/caps, evolutions (every pair reachable), weapons (each fires & damages), bosses (spawn, every phase reached, defeat rewards), save migration, meta purchases, unlocks; plus an accelerated **headless full run** to dawn with autopilot.
2. `npm run build` succeeds with no type errors.
3. Browser playthrough screenshots of every major screen and each boss (dev timeline-jump tools, hidden in production).
4. Measured frame time at the Nightmare 400-enemy cap.
