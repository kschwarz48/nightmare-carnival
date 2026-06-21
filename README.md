# NIGHTMARE CARNIVAL

> A survivors-like roguelite. You're trapped on a haunted boardwalk at midnight. Everything is alive, everything wants you dead, and the rides don't stop until dawn.

**Engine:** Godot 4.7 · **Language:** GDScript · **Genre:** Survivors-like / bullet-heaven roguelite · **Perspective:** Top-down 2D · **Art target:** 1930s rubber-hose "Cuphead" cartoon horror.

---

## What this folder is

This is the **design + implementation bible** for Nightmare Carnival. It lives in the repo so that you (and Cursor) always have the full design context one file away from the code. Every system described here is meant to be buildable directly from these docs.

When working in Cursor, **@-reference the relevant doc** before asking it to write a feature. Example: `@docs/08_core_systems_implementation.md implement the EnemyDirector spawn ring`.

---

## Read order

| # | Doc | What it covers |
|---|-----|----------------|
| — | `README.md` (this file) | Index, tech stack, conventions, how to use with Cursor |
| 01 | [`docs/01_game_design_document.md`](docs/01_game_design_document.md) | Core fantasy, pillars, core loop, run structure, meta-progression, economy |
| 02 | [`docs/02_art_direction.md`](docs/02_art_direction.md) | Cuphead-style visual target, palettes, animation, audio, asset specs |
| 03 | [`docs/03_map_and_level_design.md`](docs/03_map_and_level_design.md) | The boardwalk map, three zones, chokepoints, spawn pacing |
| 04 | [`docs/04_enemy_bible.md`](docs/04_enemy_bible.md) | Every enemy: stats, behavior, attack patterns, spawn windows |
| 05 | [`docs/05_boss_bible.md`](docs/05_boss_bible.md) | The four bosses: phases, attacks, telegraphs, arenas, rewards |
| 06 | [`docs/06_weapons_and_upgrades.md`](docs/06_weapons_and_upgrades.md) | Weapons, passives, level-up choices, synergies, evolutions |
| 07 | [`docs/07_godot_architecture.md`](docs/07_godot_architecture.md) | Folder layout, scene/node structure, autoloads, data-driven Resources, collision layers, conventions |
| 08 | [`docs/08_core_systems_implementation.md`](docs/08_core_systems_implementation.md) | Heavy GDScript: components, player, enemies, spawning, weapons, XP, pooling, save |
| 09 | [`docs/09_build_roadmap.md`](docs/09_build_roadmap.md) | Milestones from prototype → vertical slice → 1.0, Cursor-ready task list |

If you read nothing else before coding: **07 (architecture)** and **08 (systems)**.

---

## The pitch in three sentences

The midway gates lock behind you at 11:59 PM. From midnight to dawn (a ~25-minute run) the carnival's attractions wake up hungry — balloons with teeth, wind-up monkeys, marching puppet soldiers, a Ferris Wheel that tears itself off its axle to chase you — and you survive by collecting tickets (XP), leveling up, and stacking absurd carnival weaponry into a screen-clearing build. Beat the four ride-bosses, survive to 25:00, and the gates open at dawn.

---

## Design pillars

1. **The carnival is the monster.** Every enemy and boss is a personified attraction. Nothing is a generic "zombie." If it exists at a real carnival, it can try to kill you.
2. **Readable chaos.** Hundreds of enemies and thousands of projectiles, but the player can always parse the screen. Silhouette, color, and telegraph discipline over detail.
3. **Build-craft is the game.** The minute-to-minute is dodging; the run is about assembling a broken weapon/passive combo. Evolutions are the payoff.
4. **Cartoon horror, not gore.** Cuphead's charm with a midnight edge. Squash-and-stretch, rubber-hose limbs, googly menace. Funny *and* threatening.
5. **One more night.** Meta-progression (the Lost & Found) makes every failed run feed the next.

---

## Tech stack & key decisions

- **Godot 4.7**, GDScript (statically typed where practical).
- **Data-driven content.** Enemies, weapons, and upgrades are defined as custom `Resource` types (`.tres`). Adding a new enemy = a new resource + (optionally) a behavior script, not a new hand-wired scene.
- **Component-based actors.** Shared behavior lives in reusable nodes: `HealthComponent`, `HurtboxComponent`, `HitboxComponent`, `VelocityComponent`. Players, enemies, and bosses compose these.
- **Object pooling everywhere.** Enemies, projectiles, XP gems, and damage numbers are pooled. A survivors-like instantiates/frees thousands of nodes per minute; pooling is not optional.
- **Decoupled via an EventBus.** A global signal hub (`EventBus`) lets systems talk without hard references (`EventBus.enemy_died.emit(...)`).
- **Autoload singletons** for cross-cutting state: `GameState`, `EventBus`, `EnemyDirector`, `ObjectPool`, `AudioManager`, `SaveManager`.

See `docs/07_godot_architecture.md` for the full rationale and folder map.

---

## Conventions (the short version)

- **Files:** scenes & scripts `snake_case` (`enemy_director.gd`, `living_balloon.tscn`). Classes `PascalCase` (`class_name LivingBalloon`).
- **Nodes in scene tree:** `PascalCase` (`HealthComponent`, `Sprite2D`).
- **Signals:** past-tense verbs (`died`, `health_changed`, `leveled_up`).
- **Typing:** always type `@export` vars and function signatures. `var hp: int = 100`, `func take_damage(amount: float) -> void:`.
- **No magic numbers in logic.** Tunable values live on `Resource` data or `@export` vars, never hardcoded in `_process`.
- **Collision layers** follow the table in `docs/07_godot_architecture.md`. Never use raw layer numbers — use the named constants in `scripts/autoload/collision_layers.gd`.

A ready-to-use `.cursorrules` file ships at the repo root so Cursor follows all of the above automatically.

---

## Project status

**Milestone 0 (scaffold) + Milestone 1 (the "is it fun?" core loop) are implemented** with programmer art. The vertical slice runs the full survivors loop:

> move → weapons auto-fire → enemies stream in from the spawn ring and die → ticket gems magnetize in → XP fills → **level-up draft** (pause, pick 1 of 3) → measurably stronger → repeat.

Run it: open the project in **Godot 4.7** and press Play (main scene is `scenes/main/game.tscn`), or from the CLI:

```bash
godot --path . res://scenes/main/game.tscn
```

**Controls:** WASD / arrows / left-stick to move. Weapons fire automatically. On level-up, click a card. `Esc` reserved for pause.

### What's built (per `docs/07` & `docs/08`)

- **Autoloads:** `CollisionLayers`, `EventBus`, `GameState`, `SaveManager`, `MapBounds`, `ContentDB`, `ObjectPool`, `AudioManager` (stub), `EnemyDirector`.
- **Components:** `HealthComponent`, `HurtboxComponent`, `HitboxComponent`, `FlashComponent` (collision layers wired in code via the named constants).
- **Player:** movement, `PlayerStats`, `WeaponManager`, `LevelSystem`, pickup magnet, camera.
- **Weapons:** data-driven `Weapon` → `ProjectileWeapon` → pooled `Projectile` (auto-nearest aim), `WeaponData`.
- **Enemies:** one generic pooled `Enemy` shell driven by `EnemyData` + a `ChaserBehavior`; `EnemyDirector` with ring spawn, time/difficulty scaling, population cap, elites, and a `SpatialHash` separation service.
- **Progression:** `TicketGem` → XP → `LevelSystem` → `DraftGenerator` → `UpgradeData` (weapons + passives), HUD, level-up draft UI.
- **Juice:** pooled damage numbers + death-pop VFX; hit flash + squash.
- **Content (`.tres`):** The Carny, Midway difficulty, Throwing Cards, Living Balloon + Possessed Stuffie, an Act I wave table, and a starter draft pool.

Programmer art is intentional — per the cardinal rule (`docs/01 §13`, `docs/09`), the loop must be fun with rectangles before any final art is commissioned. **Next:** Milestone 2 (combat depth — more weapons/enemies, the flash shader on real sprites, evolutions). See `docs/09_build_roadmap.md`.
