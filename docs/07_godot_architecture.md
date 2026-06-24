# 07 · Godot Architecture

How the project is structured in Godot 4.7. This doc defines the **skeleton** — folders, scenes, autoloads, the component model, collision layers, the event bus, and conventions. The actual gameplay code lives in `08_core_systems_implementation.md`; read this first so that code has a place to live.

**Guiding principles:** (1) **data-driven** content via `Resource`s, (2) **composition over inheritance** via component nodes, (3) **decoupling** via an autoload `EventBus`, (4) **pooling** for everything that spawns in bulk, (5) **performance is a feature** — this is a bullet-heaven.

> **Implemented reality (M1–M4):** the skeleton below is the target. Current state differs in two deliberate ways: (1) **programmer art** — actors draw themselves via a `Blob` (`scripts/vfx/blob.gd`) self-drawing `Node2D` instead of `Sprite2D`/`AnimatedSprite2D`; real art + lighting + tilemaps land in **M6**. (2) Only the components/behaviors/screens actually built so far exist (this doc flags what's aspirational vs. live). The **app root scene is `app.tscn` / `app.gd`** (not `main.tscn`).

---

## 1. Project settings (set these first)

- **Renderer:** `gl_compatibility` (desktop + mobile) — chosen for the programmer-art phase and broad perf headroom; the neon/bloom pass (Forward+ / 2D HDR) is an **M6** decision, not baked in yet.
- **Display → Window:** base resolution `1920×1080`; **Stretch mode** `canvas_items`, **Aspect** `expand` (clean ultrawide/letterbox). If pixel-art path: use `viewport` stretch + integer scale + nearest filter (Godot 4.7 nearest viewport scaling).
- **Rendering → Textures → Default filter:** Linear for HD art / Nearest for pixel art.
- **Physics:** 2D physics tick at 60 Hz; consider `physics_jitter_fix`. We lean on `Area2D` overlap for combat (not heavy rigid-body sim).
- **Time → `Engine.max_fps`** capped (e.g., 120) and vsync on by default.
- **Input Map:** actions defined in `project.godot`: `move_up/down/left/right`, `dash`, `pause` (Esc / controller Start), `confirm` (Space/Enter / A), `cancel`, `reroll`. The pause menu reads `pause`; the level-up draft reads `confirm`. Add `aim` (mouse) when manual-aim weapons land.
- **Layer names:** name 2D physics layers in Project Settings to match §6 (so the editor is readable), but **reference them in code via constants**, never raw numbers.

---

## 2. Folder structure

```
res://
├── docs/                         # these design docs (shipped in-repo for Cursor)
├── assets/                       # see 02_art_direction.md §10 for the full art/audio tree
│   ├── art/  audio/  fonts/  shaders/
├── scenes/                       # .tscn composed scenes
│   ├── main/
│   │   ├── app.tscn              # root: ScreenHolder + Fade; swaps screens via EventBus nav
│   │   ├── game.tscn             # the actual run: world + layers + HUD + draft + pause menu
│   │   └── world.tscn            # the map (programmer-art zone; tilemaps/lights = M6)
│   ├── player/
│   │   └── player.tscn
│   ├── enemies/
│   │   ├── enemy.tscn            # generic enemy shell (components + behavior slot)
│   │   └── roller_coaster_snake.tscn   # only enemies needing bespoke scenes get their own
│   ├── bosses/
│   │   ├── carnival_tent.tscn  ferris_wheel.tscn  puppet_king.tscn  ringmaster.tscn
│   ├── weapons/
│   │   ├── projectiles/          # firework_rocket.tscn, card.tscn, dart.tscn ...
│   │   └── attacks/              # melee_arc.tscn, orbit_orb.tscn, cone.tscn ...
│   ├── pickups/
│   │   ├── ticket_gem.tscn  gold_coin.tscn  health_pickup.tscn  chest.tscn
│   ├── vfx/
│   │   ├── vfx_pop.tscn  vfx_confetti.tscn  damage_number.tscn  telegraph_circle.tscn
│   └── ui/
│       ├── hud.tscn  level_up_draft.tscn  pause_menu.tscn
│       ├── main_menu.tscn  lost_and_found.tscn  results_screen.tscn
├── scripts/
│   ├── autoload/                 # singletons (registered in Project Settings → Autoload)
│   │   ├── game_state.gd         # GameState
│   │   ├── event_bus.gd          # EventBus
│   │   ├── enemy_director.gd     # EnemyDirector
│   │   ├── object_pool.gd        # ObjectPool
│   │   ├── audio_manager.gd      # AudioManager
│   │   ├── save_manager.gd       # SaveManager
│   │   └── collision_layers.gd   # CollisionLayers (named bit constants)
│   ├── components/               # reusable composition nodes
│   │   ├── health_component.gd  hurtbox_component.gd  hitbox_component.gd
│   │   ├── velocity_component.gd  animation_component.gd  flash_component.gd
│   │   └── stats_component.gd
│   ├── player/
│   │   ├── player.gd  player_stats.gd  weapon_manager.gd  level_system.gd
│   ├── enemies/
│   │   ├── enemy.gd               # generic enemy controller (uses EnemyData + a behavior)
│   │   ├── behaviors/             # AI modules (see doc 04 behavior names)
│   │   │   ├── enemy_behavior.gd  chaser_behavior.gd  burst_charger_behavior.gd
│   │   │   ├── shooter_behavior.gd  line_charger_behavior.gd  rail_strafer_behavior.gd
│   │   │   ├── spawner_behavior.gd  ambusher_behavior.gd  pop_up_behavior.gd
│   │   │   └── formation_behavior.gd
│   ├── bosses/
│   │   ├── boss.gd  boss_phase.gd  boss_attack.gd
│   ├── weapons/
│   │   ├── weapon.gd  projectile.gd  orbit_attack.gd  melee_attack.gd  summon.gd
│   ├── systems/
│   │   ├── damage_system.gd  draft_generator.gd  evolution_system.gd  event_runner.gd
│   └── data/                     # custom Resource class definitions (the schema)
│       ├── enemy_data.gd  boss_data.gd  weapon_data.gd  passive_data.gd
│       ├── upgrade_data.gd  evolution_data.gd  character_data.gd
│       ├── wave_data.gd  difficulty_data.gd  event_data.gd
├── resources/                    # the actual .tres content instances (data, not code)
│   ├── enemies/  bosses/  weapons/  passives/  characters/
│   ├── waves/  difficulties/  events/  evolutions/
└── project.godot
```

**Rule of thumb:** `scripts/data/*.gd` defines *schemas* (`class_name EnemyData extends Resource`). `resources/**/*.tres` are *instances* of those schemas (the Living Balloon, the Fireworks). Designers/Cursor add content by creating `.tres` files, not code.

> **Present in the repo today (M4)** — the rest of the tree above is the target:
> - **Autoloads:** `CollisionLayers, EventBus, GameState, SaveManager, MapBounds, ContentDB, ObjectPool, AudioManager, EnemyDirector, GemDirector` (see §5).
> - **Components:** `health_component, hurtbox_component, hitbox_component, flash_component` (no Velocity/Animation/Stats components yet — enemies move via their behavior, player stats live on the `PlayerStats` resource).
> - **Behaviors:** `enemy_behavior` (base) + `chaser, erratic_chaser, burst_charger, flyby`. The shooter/charger/spawner/etc. variants arrive with M5 content.
> - **Weapons (`scripts/weapons/`):** `weapon` (base), `projectile_weapon, melee_weapon, orbit_weapon`; attack nodes `projectile, boomerang, firework_rocket, explosion, melee_arc, orbit_orb`.
> - **Bosses:** `boss, boss_phase, boss_attack, tent_boss, rotating_pole` + `attacks/` (tent_stomp, concession_spew, pennant_flap, inhale, popcorn_exhale, stake_drop, frenzy_stomp, clown_call, ring_of_fire) + `shockwave, popcorn`.
> - **Pickups:** `ticket_gem, food_pickup, golden_ticket, chest`.
> - **UI screens (`scenes/ui/`):** `main_menu, character_select, results_screen, lost_and_found, hud, level_up_draft, pause_menu`.

---

## 3. Scene composition philosophy

- **Small, composable scenes.** An actor scene = a root node + **component children** + a sprite + collision. Behavior is injected via data/scripts, not deep inheritance.
- **Generic shells where possible.** Most enemies share **one** `enemy.tscn` whose look/stats/AI come from an `EnemyData` resource assigned at spawn. Only enemies that need unique node setups (e.g., the segmented Roller-Coaster Snake) get bespoke scenes.
- **Composition example — the generic enemy:**

```
Enemy (CharacterBody2D, enemy.gd)                    # actual M4 shape
├── Visual (Node2D, blob.gd)         # programmer art (Sprite2D/AnimatedSprite2D at M6)
├── CollisionShape2D                 # body, on ENEMY layer
├── HealthComponent (Node)           # hp, take_damage(), died signal
├── HurtboxComponent (Area2D)        # receives player hits, ENEMY_HURTBOX layer
├── HitboxComponent (Area2D)         # deals contact damage, ENEMY_ATTACK layer
└── FlashComponent (Node)            # white-flash-on-hit driver (drives Blob.set_flash)
# Movement/AI comes from a behavior (EnemyBehavior) created from EnemyData.behavior
# ("chaser", "erratic_chaser", "burst_charger", "flyby"). Knockback lives on Enemy.
```

- **The player** mirrors this and adds `WeaponManager`, `LevelSystem`, and a `Camera2D` (no Lantern light until the M6 lighting pass; `PlayerStats` is a plain resource on the script, not a child node):

```
Player (CharacterBody2D, player.gd)
├── Visual (Node2D, blob.gd)
├── CollisionShape2D                 # PLAYER layer
├── HealthComponent
├── HurtboxComponent (Area2D)        # PLAYER_HURTBOX layer (receives enemy hits)
├── FlashComponent (Node)
├── PickupMagnet (Area2D)            # PICKUP_MAGNET layer (sized by pickup radius)
├── WeaponManager (Node)             # holds active Weapon nodes, fires them (cap 4)
├── LevelSystem (Node)               # XP, level, triggers draft
└── Camera2D                         # limits = map bounds
# stats: PlayerStats (Resource) built from CharacterData.make_stats() + meta perks
```

---

## 4. Application / scene flow

```
app.tscn (persistent root: app.gd)
   ├── ScreenHolder (swapped, one child at a time):
   │     MainMenu  ──►  CharacterSelect  ──►  game.tscn (a run)
   │        ▲   └────►  LostAndFound ───┘            │
   │        │                            (death/win) ▼
   │        └──────────────  ResultsScreen ──► (Run Again / Lost & Found / Menu)
   └── Fade (CanvasLayer)              # quick black fade between screens
```
- `app.gd` owns screen transitions (free old, instance new, fade) driven **entirely by EventBus signals** (`goto_menu`, `goto_character_select`, `goto_lost_and_found`, `start_run(character_id)`, `run_again`, and the existing `run_ended` → Results). Screens never reference each other or the App. Autoloads persist across all screens.
- `game.tscn` instances `world.tscn`, spawns the chosen character, starts `EnemyDirector`, shows `hud.tscn`. On player death (M4) — or the 25:00 win (M5) — it tells `GameState` to `end_run()`, which emits `run_ended` and the App brings up `ResultsScreen` (which credits the Lost Tickets payout).
- **`current_scene` caveat:** the run is nested under `app.tscn/ScreenHolder`, so it is **not** the SceneTree's `current_scene` (Godot rejects setting `current_scene` to a non-root-child). Systems that need the run's spawn layers read them from `GameState.{actor,enemy,projectile,pickup}_layer`, which `game.gd` registers on start — never `get_tree().current_scene.get_node("%...")`.

---

## 5. Autoload singletons

Registered in **Project Settings → Autoload** in this order (dependencies load first): `CollisionLayers, EventBus, GameState, SaveManager, MapBounds, ContentDB, ObjectPool, AudioManager, EnemyDirector, GemDirector`.

| Autoload | Responsibility | Key members |
|----------|----------------|-------------|
| **CollisionLayers** | Named physics-layer constants (see §6). | `WORLD`, `PLAYER`, `ENEMY`, … |
| **EventBus** | Global signal hub for cross-system events. | signals (see §7) |
| **GameState** | Current run state + the active run's spawn-layer refs. | `player`, `character`, `difficulty`, `run_time`, `is_running`, `is_paused`, `enemies_killed`, `bosses_killed`, `tickets`, `gold`, `{actor,enemy,projectile,pickup}_layer`; `start_run()`, `end_run()`, `set_paused()` |
| **SaveManager** | Persist meta: Lost Tickets, unlocks, perks, pedia, settings. | `meta`, `load_game()`/`save_game()`, `buy_perk()`, `apply_meta_perks()`, `is_unlocked()`/`unlock()`, `discover()`, `get_setting()`/`set_setting()` |
| **MapBounds** | The run's world rectangle (camera limits, spawn clamping). | `min_pos`, `max_pos`, `center()`, `set_bounds()` |
| **ContentDB** | Loads every `.tres` under `resources/` once; typed lookups. | `all_characters/weapons/upgrades/waves()`, `get_character/difficulty/weapon(id)` |
| **ObjectPool** | Acquire/release pooled scene instances (enemies, projectiles, gems, vfx). | `acquire(scene, parent)`, `release(node)`, `prewarm()` |
| **AudioManager** | Music (intro→loop) + SFX one-shots (dynamic intensity = M6). | `play_sfx()`, `play_music()`, `set_intensity()` |
| **EnemyDirector** | Spawn band, wave tables, time/difficulty scaling, elites, swarms, separation service, boss tracking. | `start()`, `spawn_add()`, `get_nearest_enemy()`, `separation_for()` |
| **GemDirector** | XP-gem spawning with the 400-gem ground cap + Red Gem Bank (03 §6). | `drop(value, at, parent)`, `reset()` |

**Why autoloads:** these are genuinely global, single-instance systems. Resist adding more — gameplay objects talk through `EventBus`, not new singletons.

---

## 6. Collision layers (the law)

Define once, reference by name everywhere. Never type a raw layer number in a script or you *will* create bugs.

| Bit | Layer name | Who is on it | Who scans it |
|----:|------------|--------------|--------------|
| 1 | `WORLD` | walls, fences, stall collision, hazards-static | player & enemy bodies |
| 2 | `PLAYER` | player body | world |
| 3 | `PLAYER_HURTBOX` | player's damage receiver | enemy hitboxes, enemy projectiles |
| 4 | `ENEMY` | enemy bodies | world (and separation queries) |
| 5 | `ENEMY_HURTBOX` | enemy damage receivers | **player attacks** |
| 6 | `PLAYER_ATTACK` | player weapons/projectiles (hitboxes) | enemy hurtboxes |
| 7 | `ENEMY_ATTACK` | enemy projectiles / contact hitboxes | player hurtbox |
| 8 | `PICKUP` | tickets, gold, health, chests | player magnet |
| 9 | `PICKUP_MAGNET` | player's pickup-radius area | pickups |

```gdscript
# scripts/autoload/collision_layers.gd   (Autoload name: CollisionLayers)
extends Node
## Named collision layer bits. Set masks/layers via these, never raw numbers.

const WORLD          := 1 << 0   # bit 1
const PLAYER         := 1 << 1   # bit 2
const PLAYER_HURTBOX := 1 << 2   # bit 3
const ENEMY          := 1 << 3   # bit 4
const ENEMY_HURTBOX  := 1 << 4   # bit 5
const PLAYER_ATTACK  := 1 << 5   # bit 6
const ENEMY_ATTACK   := 1 << 6   # bit 7
const PICKUP         := 1 << 7   # bit 8
const PICKUP_MAGNET  := 1 << 8   # bit 9
```

**Combat wiring summary:**
- A **player projectile**: `collision_layer = PLAYER_ATTACK`, `collision_mask = ENEMY_HURTBOX`.
- An **enemy hurtbox**: `collision_layer = ENEMY_HURTBOX`, `collision_mask = 0` (it's detected *by* attacks; attacks scan it).
- An **enemy contact hitbox / enemy projectile**: `collision_layer = ENEMY_ATTACK`, `collision_mask = PLAYER_HURTBOX`.
- The **player hurtbox**: `collision_layer = PLAYER_HURTBOX`, `collision_mask = ENEMY_ATTACK`.
- The **pickup magnet**: `collision_layer = PICKUP_MAGNET`, `collision_mask = PICKUP`.

(Set whichever side does the `area_entered` scanning to have the mask; keep it consistent — see HitboxComponent in doc 08.)

---

## 7. EventBus — global signals

Decouple systems: emitters don't know listeners. Declare every cross-system event here.

```gdscript
# scripts/autoload/event_bus.gd   (Autoload name: EventBus)
extends Node

# --- combat ---
signal enemy_died(enemy, position)         # → director (count/cap), pedia, score
signal enemy_spawned(enemy)
signal boss_warning(display_name)          # → HUD warning banner before a boss wakes
signal boss_spawned(boss, boss_data)
signal boss_defeated(boss, boss_data)
signal player_damaged(amount, current_hp)
signal player_died

# --- progression ---
signal ticket_collected(value)             # XP gained
signal player_leveled_up(new_level)        # → opens draft
signal upgrade_chosen(upgrade_data)
signal weapon_evolved(evolution_data)

# --- economy / pickups ---
signal gold_collected(value)
signal chest_opened(rewards)

# --- run lifecycle ---
signal run_started(character_data, difficulty_data)
signal run_ended(did_win, stats)           # stats carries the Lost Tickets payout
signal act_changed(act_index)
signal carnival_event_started(event_data)
signal carnival_event_ended(event_data)

# --- ui / flow ---
signal request_pause(paused)
signal time_tick(run_seconds)              # emitted ~each second for HUD/director

# --- screen navigation (M4; the App root listens and swaps screens) ---
signal goto_menu
signal goto_character_select
signal goto_lost_and_found
signal start_run(character_id)
signal run_again
```

Usage: `EventBus.enemy_died.emit(self, global_position)` / `EventBus.player_leveled_up.connect(_on_level_up)`.

---

## 8. Data-driven content model

Every content type is a `class_name X extends Resource` schema in `scripts/data/`, instanced as `.tres` in `resources/`. The list:

| Schema | Defines | Used by |
|--------|---------|---------|
| `EnemyData` | stats, sprite frames, behavior key, vfx/sfx, separation, elite-able | `enemy.gd`, director |
| `BossData` | phases, base HP, attack pools, arena type, rewards | `boss.gd`, director |
| `WeaponData` | fire pattern, base stats, per-level deltas, aim mode, evolution link | `weapon.gd`, draft |
| `PassiveData` | stat axis + per-level magnitude | stats, draft |
| `UpgradeData` | a draftable option (wraps weapon level-up / new weapon / passive) | draft generator |
| `EvolutionData` | base weapon + required passive → evolved `WeaponData` | evolution system |
| `CharacterData` | base stats, starting weapon, passive quirk, unlock | character select |
| `WaveData` | time window, enemy weights, rate mod, flags | director |
| `DifficultyData` | tier multipliers, caps, curse | director |
| `EventData` | carnival event params | event runner |

This is what makes the project **Cursor-friendly**: "add the Snow-Cone weapon" = generate one `.tres` + (if a new fire shape) one small script, never a rewrite.

---

## 9. Conventions (full)

- **Files/folders:** `snake_case`. **Classes (`class_name`):** `PascalCase`. **Scene node names:** `PascalCase`. **Signals:** past-tense (`died`). **Constants:** `SCREAMING_SNAKE_CASE`. **Private:** `_leading_underscore`.
- **Static typing always.** `func take_damage(amount: float, source: Node = null) -> void:`; type `@export` vars; type local vars where it aids clarity.
- **`@export` every tunable.** No balance number lives in logic — it's on a `Resource` or an `@export`. (Enforced by the `.cursorrules`.)
- **Signals over polling**, components over inheritance, `EventBus` over cross-tree `get_node` chains.
- **Groups** used sparingly for broad queries that aren't perf-critical (`"enemies"`, `"pickups"`); never iterated every frame in hot paths.
- **One responsibility per script.** A component does one thing. A behavior does one AI. A system owns one concern.
- **Comment the *why*** and reference the doc section a system implements (e.g., `# spawn ring — see 03_map_and_level_design.md §7.1`).

---

## 10. Performance architecture (bullet-heaven non-negotiables)

This game lives or dies on frame-time with hundreds of actors. Bake these in from day one (code in doc 08):

1. **Pool everything bulk:** enemies, projectiles, ticket gems, damage numbers, common VFX. **Never `queue_free()` a pooled object** — `ObjectPool.release()` it (hide, disable processing, reset, return to stack).
2. **No per-frame group scans in hot paths.** Enemies read the player position from `GameState.player.global_position` (cached), they don't search for it.
3. **Cheap steering, not pathfinding.** Enemies move via `direction_to(player)` + capped local **separation** (sample a few nearby, not all). Optional `NavigationRegion2D` only for boss-arena obstacle avoidance.
4. **Throttle expensive work.** Stagger AI/separation updates across frames (e.g., each enemy recomputes separation every Nth physics frame, offset by instance id). Use timers, not per-frame checks, for cooldowns.
5. **Minimize allocations in `_process`/`_physics_process`.** Reuse `Vector2`s/arrays; avoid creating dictionaries per frame; avoid `String` formatting except when text actually changes (damage numbers reuse pooled labels).
6. **Combat via `Area2D` overlap**, kept lean: hurtboxes have `collision_mask = 0` and are *scanned by* attacks; disable monitoring on pooled-inactive objects.
7. **Damage numbers & flashes are pooled + capped** (cap concurrent damage numbers; aggregate if exceeded).
8. **Profile early and often** with the Godot profiler + the on-screen entity counter; set entity-budget targets per platform (doc 03 §7.2).

> Cross-reference: every system named here is implemented in `08_core_systems_implementation.md`. Build order is in `09_build_roadmap.md`.
