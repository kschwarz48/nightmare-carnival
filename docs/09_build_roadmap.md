# 09 · Build Roadmap

A staged plan from empty project to shippable game, ordered so the game is **fun before it is big**. Each milestone has a goal, exit criteria, a Cursor-ready task list, and verification. Build milestones in order — later ones assume earlier systems exist.

**The cardinal rule (from doc 01 §13):** the M1 core loop must be fun with programmer art before you commission a single final asset. If it isn't, fix the loop — don't add content.

> **Working with Cursor:** tackle one task line at a time. Prefix prompts with the system doc, e.g. `@docs/08_core_systems_implementation.md §13 implement EnemyDirector + SpatialHash, then wire EnemyData for the Living Balloon from @docs/04_enemy_bible.md`. Commit per task.

---

## Milestone 0 — Project scaffold

**Goal:** an empty but correctly-structured Godot 4.7 project that compiles and runs an empty scene, with all conventions in place.

**Tasks**
- [ ] Create the Godot 4.7 project; set Project Settings per `07 §1` (renderer, 1920×1080, stretch `canvas_items`/`expand`, default texture filter, max_fps, vsync).
- [ ] Define the **Input Map** actions (`move_*`, `aim`, `dash`, `pause`, `confirm`, `cancel`, `reroll`) for keyboard + gamepad.
- [ ] Create the folder structure from `07 §2`.
- [ ] Add `.cursorrules` (repo root) and copy `/docs` into the repo.
- [ ] Implement & register autoloads (stubs OK): `CollisionLayers`, `EventBus` (full signal list, `07 §7`), `GameState`, `ObjectPool`, `AudioManager` (stub), `SaveManager`, `EnemyDirector` (stub).
- [ ] Name the 2D physics layers in Project Settings to match `07 §6`.
- [ ] Set up Git; first commit.

**Exit criteria:** project runs; autoloads load without error; `EventBus` signals exist; layers named.

**Verify:** open the project, run an empty `main.tscn`, confirm no autoload errors in the console.

---

## Milestone 1 — "Is it fun?" core loop (vertical slice)

**Goal:** the minimal survivors loop with **programmer art** (colored rectangles/circles). This is the make-or-break milestone.

**Tasks**
- [ ] `HealthComponent`, `DamageInfo` (`08 §1–2`).
- [ ] `HurtboxComponent` / `HitboxComponent` + collision wiring (`08 §3`, `07 §6`).
- [ ] `Player`: movement, `PlayerStats` (subset: move speed, might, cooldown), HealthComponent (`08 §6–7`).
- [ ] `ObjectPool` (`08 §15`) + pool hooks pattern.
- [ ] One enemy: generic `Enemy` + `EnemyData` + `ChaserBehavior` (`08 §10–11`), as a colored circle that chases.
- [ ] `SpatialHash` + `EnemyDirector` minimal: ring spawn, fixed spawn rate, one enemy type, population cap, separation service (`08 §12–13`).
- [ ] One weapon: generic `ProjectileWeapon` + `Projectile` + `WeaponManager` auto-firing at nearest (`08 §8`).
- [ ] `TicketGem` + player `PickupMagnet` + `LevelSystem` (XP→level) (`08 §9, §14`).
- [ ] Level-up draft: pause + 3 placeholder options (e.g., +might, +speed, level the weapon) (`08 §9`).

**Exit criteria:** move → auto-fire → enemies stream in and die → gems fly in → XP → draft → pick → measurably stronger. Loop runs 5+ minutes without error.

**Verify:** play it. Is dodging + watching numbers go up *fun* with rectangles? Get honest outside eyes. Profile at ~150 enemies (should be trivial). **Do not proceed until this is fun.**

---

## Milestone 2 — Combat depth & feel

**Goal:** enough weapons/enemies/juice that build decisions and moment-to-moment combat feel good.

**Tasks**
- [ ] Finalize `PlayerStats` (all axes, `08 §6`) and `PassiveData`; pipe stats through weapons.
- [ ] `FlashComponent` + flash shader; hit feedback on all actors (`08 §4`).
- [ ] `DamageNumber` pooled + concurrency cap (`08 §16`).
- [ ] Enemies: add **Wind-Up Monkey** (`BurstChargerBehavior`) and **Possessed Stuffie** (slow chaser) (`04`).
- [ ] Weapons: 4 total with distinct shapes — e.g., Throwing Cards (fan), Fireworks (lob-AoE), Ring Toss (boomerang), Whack-a-Mole Mallet (around-self) (`06`, `08 §8`).
- [ ] Passives: 4 — Strongman Belt, Energy Drink, Spectacles, Foam Finger (`06 §3`).
- [ ] `DraftGenerator` proper (weighting, legality, rarity) + `ContentDB` loader (`08 §9`).
- [ ] First **evolution** end-to-end (e.g., Fireworks + Extra Token → Grand Finale) + `EvolutionSystem` (`06 §5`, `08 §9`).
- [ ] Tune the XP curve and a few weapon level curves.

**Exit criteria:** 3 enemies, 4 weapons, 4 passives, 1 evolution; combat *feels* punchy; at least two distinct build paths are playable.

**Verify:** playtest each weapon to Lv8; confirm the evolution triggers and feels like a payoff; profile at ~300 enemies (target 60fps).

---

## Milestone 3 — First boss, director & first zone

**Goal:** a real run shape — timed waves, scaling, and a climactic boss in an actual map.

**Tasks**
- [x] `EnemyDirector` full: `WaveData` tables, `DifficultyData` scaling, elite spawns, boss gates (`08 §13`, `03 §7`).
- [x] Author the **Carnival Core** zone (`world.tscn`): `StaticBody2D` obstacles/chokepoints (3 labeled gates), `CanvasModulate` + a few `PointLight2D`, `MapBounds`, Y-sort, camera limits (`03 §9`, `02 §3`). *(Ground is a programmer-art grid; real TileMapLayer tile art is the one item left to the M6 art pass.)*
- [x] Boss framework: `Boss`, `BossPhase`, `BossAttack`, `BossData` (`08 §17`).
- [x] Implement **The Carnival Tent** (3 phases, its attacks, defeat → chest) (`05`). *(Roams + leashes the player instead of a hard soft-wall arena — same set-piece pressure, fewer pathing issues.)*
- [x] Boss-incoming flow: pause ambient spawns, warning, intro; boss bar UI.
- [x] Chest pickup → grants an upgrade (`03 §6`).

**Exit criteria:** a 6-minute run that scales, spawns elites, and ends in the Tent fight with a reward.

**Verify:** the Tent's telegraphs are readable and dodgeable; phase transitions fire at the right HP; director caps hold; play the full 0:00→6:00→Tent arc.

> **Implemented (programmer-art pass):** boss framework (`Boss`/`BossPhase`/`BossAttack`/`BossData`), the **Carnival Tent** with a curated 2-attacks-per-phase moveset (P1 Stomp+Spew · P2 Inhale+Popcorn Exhale · P3 Frenzy Stomp+Clown Call), director boss-gate flow (warning → spawn → **ambient paused** → defeat resumes), boss bar + warning banner, guaranteed **chest** (opens a draft pick) + ticket burst. The Tent now sits **dormant at center from run start** and **roams** the player when it wakes (no hard arena). The **Carnival Core** zone is authored in programmer art (`world.gd` data-driven elements: CAROUSEL, STALLS, TICKET BOOTH, PRIZE STAND, 3 labeled GATE chokepoints, FERRIS WHEEL/SEA markers) with text labels. Enemies use **direct vector seek + separation and walk through obstacles** (VS-style, no pathfinding); solids block the player only. Deferred: remaining Tent attacks (Pennant Flap, Stake Drop, rotating pole, Ring of Fire), real TileMapLayer/lighting (M6), and bosses 2–4 (M5).

---

## Milestone 4 — Meta loop & run lifecycle

**Goal:** death and victory feed progression; the "one more night" hook closes.

**Tasks**
- [x] `SaveManager` meta persistence (`08 §18`) — perks table (buy/cost/cap), `apply_meta_perks`, spend, settings; JSON save/load.
- [x] Run end: ResultsScreen, payout formula → Lost Tickets (`01 §8`, `08 §18`) — `GameState._payout`; Results credits once.
- [x] **Lost & Found** hub: escalating capped stat perks + 1 unlock (Crystal Orbs gated via `UpgradeData.unlock_id`); Carnival-pedia count (`01 §9`).
- [x] Main menu → character select → run → results → (run again / menu) flow (`07 §4`) — `App` root swaps screens via EventBus nav signals.
- [x] Second character (The Strongman): mallet, +50% HP / −15% speed, **knockback-on-hit** quirk (`01 §6`).
- [x] "Run Again" one-click (re-uses last character); death→next-run measured ~0.2s (`01 §11`).
- [x] Pause menu + options (master volume, reduce-flashes), persisted to settings.

> **Implemented (M4):** the run is nested under the persistent `App` root, so it can't be the SceneTree's `current_scene` — spawn layers are registered on `GameState.{enemy,projectile,actor,pickup}_layer` by `game.gd` and read there by `EnemyDirector`/weapons. Difficulty is Midway-only (tiers → M5); only the death→payout path is reachable (the win path is coded but needs M5 content). Headless-verified: full loop, payout credit + persistence across reload, perk buy/cap, unlock gating, Strongman knockback, pause.

**Exit criteria:** full game loop from menu through a run to payout and back, with persistent meta and 2 characters.

**Verify:** earn Lost Tickets, buy a perk, confirm it persists across restart; confirm the loop is *tight* (fast restart).

---

## Milestone 5 — Content build-out

**Goal:** the full roster on one excellent zone. (Mostly data + behaviors, thanks to the data-driven architecture.) *Scope pivot: a single very good zone (Carnival Core), no in-run gold/shop — minibosses → chests instead.*

> **Pre-M5 hardening done** (so content doesn't breed debt): data-driven **boss scheduling** (ContentDB + `visible_when_dormant`); **Act timeline** (`act_changed`); **enemy projectile + `shooter` behavior**; **EventData + EventRunner** skeleton (`elite_pack`/`miniboss`); **minibosses → VS-style chests** (`ChestReward`, 1–7 upgrades to equipped items); **`summon` weapon style**; `weapon_evolved` wired. Each ships with a reference resource + headless test. Remaining `dash`/`clone`/`beam` styles build with their weapon.

**Tasks**
- [x] Enemy behaviors: `shooter`, `spawner`, `ambusher`, `pop_up`, `rail_strafer`; chargers reuse `burst_charger` (Carousel Horse / Bumper Car). `Formation` refinement deferred (Puppet Soldiers use `shooter`).
- [x] Enemy families as `EnemyData` (Act I–IV): slimes, whack-a-mole, jack-in-the-box, dunk-tank/puppet shooters, carousel/bumper chargers, ticket-booth spawner, roller-coaster snake, carnival-brute miniboss.
- [x] Remaining 3 bosses: Ferris Wheel (roll), Puppet King (cut-the-strings stagger), Ringmaster (parade → bullet-hell finale; defeat = Dawn) (`05`).
- [x] Evolutions wired for every evolvable weapon (Grand Finale, Saturn's Rings, Whack Frenzy, Cosmic Convergence, Nightmare Menagerie, Royal Flush) + Luck passive. *(`dash`/`clone`/`beam` styles + their weapons still to come.)*
- [ ] Remaining characters (Fortune Teller / Ride Operator / Lost Child / Ringleader) (`01 §6`).
- [ ] **Carnival Core** zone polish (the one zone), chokepoints, hazards (`03 §2–4`).
- [~] Carnival events: `EventData`/`EventRunner` + `ev_clown_pack`; more authored events + timed-hazard host to come (`03 §5`).
- [x] Full `WaveData` timeline (w_0000 → w_2400, all four Acts) + the 25:00 Dawn win condition.
- [x] Difficulty tiers Midway/Carnival/Nightmare + select picker. *(Endless + Curse still to come.)*

**Exit criteria (met):** a complete 25-minute run, all four bosses, evolutions reachable, on the Carnival Core, with selectable difficulty. *(Remaining M5 = more characters, more weapon styles/events, zone & Endless polish.)*

**Verify:** win a full run; every weapon/evolution reachable; every boss beatable; profile at Act IV peak (~600 enemies) — hit your platform budget.

---

## Milestone 6 — Art, audio & juice integration

**Goal:** replace programmer art and silence with the Cuphead-style identity from docs 02.

**Tasks**
- [ ] Lock the production path (`02 §2`); build the art pipeline (atlases, `SpriteFrames`, import presets, pivots).
- [ ] Integrate final sprites/animations for player, enemies, bosses (anim names per `02 §5`).
- [ ] Environment art + lighting pass per zone (`02 §3, §7`).
- [ ] VFX: themed death bursts, pickup/level-up FX, telegraph shapes, weapon spectacle (`02 §6`, `08 §16`).
- [ ] Screen feel: shake, bloom/HDR, low-HP vignette, hit-stop — all with reduction options (`02 §6`).
- [ ] Audio: music layers per Act + boss themes, dynamic intensity, full SFX set, `AudioManager` implemented (`02 §9`).
- [ ] UI/HUD final styling (marquee/ticket motifs), the juicy draft cards (`02 §8`).

**Exit criteria:** the game *looks and sounds* like Nightmare Carnival; juice makes clearing waves feel great.

**Verify:** silhouette/readability test in a 50+ crowd; colorblind palette check; A/B the juice on/off; confirm HDR/bloom doesn't hurt readability.

---

## Milestone 7 — Balance, modes & polish

**Goal:** tuned, replayable, and feature-complete.

**Tasks**
- [ ] Difficulty tiers (Midway→Nightmare) + Curse dial (`01 §10`).
- [ ] Endless / "Lock-In" mode after the 25:00 win (`01 §10`).
- [ ] Daily Run with seeded RNG (`08 §20`).
- [ ] Draft QoL unlocks: Reroll, Banish, Skip (`06 §4`).
- [ ] Full balance pass: weapon/evolution curves, enemy scaling, economy/payout, meta perk caps (so meta stays a head-start, `01 §9`).
- [ ] Full Carnival-pedia + collection rewards (`01 §9`).
- [ ] Accessibility suite (`01 §12`): aim modes, remap, contrast/telegraph options, damage multipliers, font scaling.
- [ ] Settings persistence, controller-first UI nav.

**Exit criteria:** every system tuned; multiple viable builds; difficulty ladder feels fair; modes work.

**Verify:** balance telemetry (win-rate by character/difficulty/build); ensure no single build trivializes all tiers and no character is unviable; full accessibility runthrough.

---

## Milestone 8 — Ship

**Goal:** release (recommend Steam Early Access first).

**Tasks**
- [ ] Performance pass for the lowest target platform (handheld budget, `03 §7.2`); pooling/soak verified (`08 §20`).
- [ ] Steam plumbing: achievements, cloud saves, store page, build pipeline; controller glyphs.
- [ ] Localization hooks (externalize strings) even if shipping English-first.
- [ ] Save-version migration safety in `SaveManager`.
- [ ] QA pass: crash/leak hunt, edge cases (alt-tab, resolution changes, controller unplug), boss-skip/softlock checks.
- [ ] Build, trailer, marketing beats; wishlists; EA launch → roadmap of post-launch content.

**Exit criteria:** stable, performant, store-ready build.

**Verify:** soak test (25-min auto-runs, memory plateaus); test on min-spec/handheld; clean QA checklist.

---

## Suggested order-of-operations cheat sheet

```
M0 scaffold ─► M1 FUN LOOP (gate!) ─► M2 combat depth ─► M3 first boss + director + zone
   ─► M4 meta loop ─► M5 all content ─► M6 art+audio+juice ─► M7 balance+modes ─► M8 ship
```

**Risk-burndown priority:** the two biggest risks are (1) **is the loop fun?** (retire at M1 with rectangles) and (2) **does it hold 600 enemies at 60fps?** (validate pooling + spatial hash at M1/M2, re-check every milestone). Everything else is content and polish that the data-driven architecture makes cheap to add.

> Cross-references: what to build → all prior docs · how to build each system → `08_core_systems_implementation.md` · how it should be structured → `07_godot_architecture.md`.
