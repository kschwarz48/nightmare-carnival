# 03 · Map & Level Design

Covers the boardwalk map, its three zones and chokepoints, environmental hazards & events, and the **spawn director** that paces the whole night. Implementation of the director is in `08_core_systems_implementation.md`; this doc defines *what* it does and the tunable design values.

---

## 1. Map philosophy

- **One seamless, bounded map** — not procedural, not infinite-scroll. The carnival is a *place* with identity; bosses are *its rides*. A hand-authored map sells that.
- **Mostly open, with meaningful chokepoints.** Players can roam freely (essential for kiting a survivors-like crowd), but three pinch-points between zones create real tactical tension: funnel the swarm to mow it down, or get cornered and die.
- **Bounded by fiction:** a locked wrought-iron carnival fence on the inland sides, and the **sea** on the seaward side. The player cannot leave — that's the premise. Soft "you can't go further" feedback at edges (the fence rattles, the tide pushes back), no invisible-wall jank.
- **Size:** world ≈ **4200 × 2600 px** (tune to ~4–5 screen-widths). Big enough to run laps and lose the crowd, small enough that the three zones each get used in a run.

---

## 2. Layout

Three zones stacked seaward-to-inland, connected by chokepoints. (Top-down; "up" = inland.)

```
  ╔══════════════ LOCKED CARNIVAL FENCE (inland boundary) ══════════════╗
  ║                                                                      ║
  ║                    ZONE C — THE CARNIVAL CORE                        ║
  ║      (largest, most open · tents, stalls, dead carousel,             ║
  ║       the Ferris Wheel looming · warm-rot palette)                   ║
  ║   ▣ Big Top (Carnival Tent boss set-piece) ▣ Carousel ▣ Stalls       ║
  ║                                                                      ║
  ║        ╲                  ╱                  ╲                  ╱     ║
  ║   ┌─────█ GATE 1 █────────█ GATE 2 █──────────█ GATE 3 █─────────┐   ║  ← CHOKEPOINTS
  ║   │   (midway turnstiles & ticket arches: 3 narrow passages)     │   ║    (Carnival ↔ Boardwalk)
  ║                                                                      ║
  ║                    ZONE B — THE BOARDWALK                            ║
  ║   (long horizontal plank strip · game stalls, food carts,            ║
  ║    string-lights · weathered wood palette · runs the full width)     ║
  ║                                                                      ║
  ║   ░░░ PIER GAP ░░░          ░░░ RAMP DOWN ░░░          ░░░ STEPS ░░░  ║  ← CHOKEPOINTS
  ║                                                                      ║    (Boardwalk ↔ Beach)
  ║                    ZONE A — THE BEACH                                ║
  ║   (open sand, pier pylons, the tide-line · cold moonlit palette)     ║
  ║                                                                      ║
  ╚════════════════════════ THE SEA (seaward boundary) ═════════════════╝
```

### Zone A — The Beach (seaward)
Open moonlit sand. Most open ground in the map — good for kiting, but the **tide** is a recurring hazard (see §4) and the only retreat is *up* through the boardwalk chokepoints. Pier pylons act as the only cover/obstacles. Cold palette; the sea hisses.

### Zone B — The Boardwalk (middle strip)
A long, relatively *narrow* horizontal plank corridor spanning the map width, packed with game stalls and food carts (cover + breakables). It's the connective tissue: every trip between beach and carnival crosses it. Its narrowness makes it the natural place to get pinched — and the natural place to set up a chokepoint massacre. Weathered-wood palette, swaying string-lights.

### Zone C — The Carnival Core (inland)
The largest, most open zone and the dramatic heart. Big striped tents, the dead carousel, rows of stalls, and the Ferris Wheel dominating the skyline. Most bosses fight here. Warm-but-rotten palette, the most light sources (and thus the most light/dark contrast).

---

## 3. Chokepoints (the tactical spine)

Five designed pinch-points, three between Carnival↔Boardwalk, two-plus between Boardwalk↔Beach:

| Chokepoint | Connects | Width | Design intent |
|------------|----------|-------|---------------|
| **Gate 1/2/3** (turnstiles & ticket arches) | Carnival ↔ Boardwalk | ~2–3 player-widths each | Funnel the swarm into a line; great for piercing/line weapons. Standing *in* a gate = damage gauntlet from both sides. |
| **Pier Gap** | Boardwalk ↔ Beach | ~2 widths, with a *hole* hazard beside it | Cross carefully — the gap in the planks is a hazard tile. |
| **Ramp Down** | Boardwalk ↔ Beach | ~3 widths | The "safe" crossing; enemies bottleneck here. |
| **Steps** | Boardwalk ↔ Beach | ~1.5 widths (tightest) | Highest-risk/highest-reward funnel; AoE goldmine, but easy to get trapped above/below. |

**Why chokepoints matter mechanically:** enemies path toward the player (cheap steering, doc 08). When the player stands just past a chokepoint, the crowd compresses into the gap — turning a 270° swarm into a 90° firing line. This is the map's core skill expression: *use geometry to convert an unwinnable crowd into a manageable one.* Counter-pressure: ranged enemies (Puppet Soldiers, Dunk-Tank Clowns) punish camping a chokepoint, and the tide/events can flush you out.

**Implementation note (VS-style, repeatable):** chokepoints/attractions are `StaticBody2D` on the **World** layer that block the **player** (cover + kiting geography). Enemies use **direct vector seek + separation only — no pathfinding** and, like Vampire Survivors, **walk straight through world obstacles** (enemy bodies mask only other enemies, not World) so hundreds of them never snag or need A*/navmesh. Bosses likewise ignore terrain (no body collision). So gates/walls shape *where you run and funnel the horde for AoE*, not enemy routing. (If a future stage wants enemies physically blocked by specific walls, add those walls to the enemy mask + a `NavigationRegion2D`; not needed for M3.)

---

## 4. Environmental hazards (per zone)

Hazards add positional decisions without needing more enemy types. All are toggleable/data-driven and scale in/out by Act.

- **Beach — The Tide:** every ~45–60s the sea surges up the sand to a telegraphed line for a few seconds. Standing in surf = slow + chip damage (and it can sweep small enemies). Teaches "don't get cornered against the sea."
- **Boardwalk — Plank Gaps / Holes:** fixed hazard tiles near the Pier Gap; touching = damage + brief stagger (you stumble). Also **runaway Bumper Cars** occasionally barrel down the boardwalk lane (telegraphed lane flash) — moving line hazard.
- **Carnival — Spinners & Grease:** the **Tilt-a-Whirl** platform sweeps a rotating arm (telegraphed); **popcorn-grease slicks** near carts reduce friction (you slide); loose **tent stakes/ropes** form soft obstacles.
- **Global — The Dark:** away from light sources, threat rim-lighting still reads, but pickups are dimmer. The "Lights Go Out" event (below) weaponizes darkness.

Hazards never *one-shot*; they punish bad positioning with chip + control loss, reinforcing the readability pillar.

---

## 5. Carnival Events (timed run spice)

Randomly triggered timed events (à la Vampire Survivors), one rolling roughly every 60–90s, telegraphed by a banner + audio sting. Data-driven (`EventData` resources, see doc 08). Examples:

| Event | Effect | Risk / Reward |
|-------|--------|---------------|
| **"The Lights Go Out"** | Map darkens to the player's lantern bubble for ~15s; off-screen spawns increase. | Survive blind; bonus Tickets if you do. |
| **"Free Funnel Cake!"** | Healing pickups rain over a marked stall. | Heal, but it's a crowd magnet. |
| **"Stampede!"** | A lane flashes; a wall of Carousel Horses charges across it. | Clear the lane or get trampled; great XP if you AoE the lane. |
| **"Clown Car"** | A car screeches in and disgorges an elite Clown pack. | Burst threat; drops Gold + a chest on clear. |
| **"Last Ticket"** | A guarded **treasure chest** appears (escort/defend or just punch through). | Chest = weapon/evolution/Gold jackpot. |
| **"Carousel Spins Up"** | The dead carousel reanimates, flinging Carousel Horses outward in rings for ~20s. | Zone-denial; big Tickets near it. |
| **"Calliope Crescendo"** | Music maxes, **all** spawn rates +50% for 20s. | Pure greed window. |

Events should mostly create *positional* decisions (go toward the reward and the danger, or play safe), reinforcing the open-map-with-pressure design.

---

## 6. Pickups, breakables & the shop

- **Tickets (XP):** drop from kills as ticket-stubs; auto-collected within pickup radius (fly to player). Bigger stubs from tougher enemies; Act IV stubs are worth more.
- **Gold:** rarer kill drops + from breakables. Spent at the Intermission Wagon.
- **Breakables:** popcorn carts, prize stands, crates, pumpkin bins — destroying drops Gold/health/occasional Ticket. Scatter densely along the Boardwalk (Scene Paint Mode). Consistent "breakable" shine so players learn to smash them.
- **Health pickups:** occasional hot-dog/funnel-cake heals; the only in-run heal besides regen items. *Implemented:* spawned on a **guaranteed randomized interval** (`game.gd` `food_interval_min`/`max`, default 70–110 s, first one ~30–50 s in) — a bright-green pulsing `FoodPickup` (`+20 HP`) at a random spot **relative to the player** (on-screen, a short walk away) that despawns after a window if ignored. (A flat per-roll chance was too swingy — players could go a whole run seeing none.) A clutch lifeline that reliably appears without being a steady drip.
- **Chests:** from bosses, elite packs, and the "Last Ticket" event — grant weapon/passive/evolution or a Gold jackpot. Boss chests guarantee an upgrade.
- **The Intermission Wagon (shop):** a roaming wagon that parks somewhere on the map ~once per Act (banner + map ping). Walk to it to open a lightweight shop: **reroll a future draft**, **buy a heal**, **buy 1 random item**. (MVP: heal + reroll + 1 item; expand later.)

---

## 7. The Spawn Director — design spec

The director is the heartbeat of the run. It owns *what spawns, where, when, and how much*, scaling with time and difficulty. (Code: `EnemyDirector` autoload, doc 08.)

### 7.1 Spawn area & leash (VS-style)
Enemies spawn in a **rectangular band around the player** — outside the on-screen rect (½ viewport) out to ~**1.5×** — so they "walk in" from just off-screen, never popping on top of the player. (Modeled on Vampire Survivors' spawn rectangle: from the screen edge to roughly 50% beyond.)
- **Spawn blocking:** reject a candidate point if an enemy is already within ~28 px (cheap spatial-hash check); try a few points before skipping that spawn. Enemies never stack-spawn.
- **Despawn leash:** normal enemies that fall **outside ~1.7× the viewport half-rect** (the player left them behind) are despawned/recycled — *not* teleported — so a fleeing player sheds the trailing crowd and fresh enemies appear ahead, keeping the fight centered and the cap meaningful. **Bosses are exempt.**
- Clamp candidate points into the map bounds. *(No Curse system yet; when added it would raise spawn rate/amount/max and enemy speed.)*

### 7.2 Population cap & cadence (wave-driven)
Spawning is **defined by the wave timeline (§7.4), not a global rate formula** — this is the core mechanic and is authored with intent. At any moment exactly one wave is active (the latest-started one whose window contains *now*), and the director spawns by that wave's rules:

1. **Minimum top-up.** Each tick, if the live enemy count is below the wave's `min_alive`, immediately spawn up to that minimum. This guarantees a baseline crowd and instantly refills it when the player clears a pack — clearing always *matters* but never empties the screen for long.
2. **Steady pressure.** On top of the minimum, add `spawn_batch` enemies every `spawn_interval` seconds, up to `max_alive`.

Scaling across the night is the **timeline itself**: later waves raise `min_alive`/`max_alive`, shorten `spawn_interval`, grow `spawn_batch`, and shift the mix toward tougher enemies — sparse and readable early, relentless late.

- **Max alive cap** keeps perf bounded and readability sane, and — kept deliberately lowish — makes each kill feel impactful. The per-wave `max_alive` is clamped by a global difficulty ceiling: Midway 180 · Carnival 280 · Nightmare 400 · (handheld port: 150). At the cap the director simply stops adding until enemies die.
- **Enemy density / collision.** Enemies steer with cheap separation (spatial hash) *and* a small amount of body collision, so a crowd packs against the player instead of pixel-stacking — that physical density is the swarm pressure. Flyby swarm enemies are the exception (they pass through). Mob speeds are tuned against the player's high move speed (doc 01 §7): fast enough that standing still gets you surrounded, slow enough to kite while moving.

### 7.3 Difficulty / time scaling (applied to spawned enemies)
Each spawned enemy's stats are multiplied by a time-and-tier factor:
```
hp_mult     = (1 + 0.06 × minutes) × tier_hp_mult
dmg_mult    = (1 + 0.04 × minutes) × tier_dmg_mult
speed_mult  = (1 + 0.01 × minutes), capped at 1.6
ticket_mult = (1 + 0.03 × minutes)        # rewards keep pace
```
Tier multipliers (Midway 1.0 / Carnival 1.35 / Nightmare 1.8) and the optional **Curse** stack on top. All values live in a `DifficultyData` resource — never hardcode them.

### 7.4 Wave tables (data-driven)
The director reads a **timeline of wave entries** (`WaveData` resources). Each entry has: `start_time`/`end_time`, weighted `enemies`, `min_alive`, `max_alive`, `spawn_interval`, `spawn_batch`; overlay mechanics `swarm_enemy`/`swarm_interval`/`swarm_size` (periodic flyby swarms) and `elite_burst` (elites spawned once on entering the wave); plus forward hooks (`boss`, `event`). A short-windowed entry with a later `start_time` temporarily **overrides** the base timeline, then control falls back to the still-active base wave. Full-game conceptual timeline (enemies/bosses arrive across M2–M5):

| Window | Enemy weights | Notes |
|--------|---------------|-------|
| 0:00–6:00 | Balloon 70, Monkey 30 | Gentle ramp; teach movement. |
| 3:00 | — | **Burst:** Balloon swarm rush from one side. |
| 6:00 | **BOSS: Carnival Tent** | Pause normal spawns; spawn boss (see §8). |
| 6:00–12:00 | Balloon 30, Monkey 25, Stuffie 25, Clown 20 | Add ranged Dunk-Tank Clowns ~9:00. |
| 9:00 | — | **Elite pack:** Clown Car event. |
| 12:00 | **BOSS: Ferris Wheel** | |
| 12:00–18:00 | Stuffie 25, Clown 20, Puppet Soldier 25, Carousel Horse 20, Ticket Booth 10 | Ranged + chargers; formations begin. |
| 15:00 | — | **Formation:** Puppet Soldier marching column. |
| 18:00 | **BOSS: Puppet King** | |
| 18:00–24:00 | everything + Roller-Coaster Snake; elite variants weighted up | Peak density; snakes strafe across screen. |
| 21:00 | — | **Calliope Crescendo** likely. |
| 24:00 | **BOSS: Ringmaster** (final) | |
| 24:00–25:00 | weak swarm flood | **Victory lap** — mow-down + Tickets → Dawn. |

> The weights/times above are the *starting* tuning. Because they're resources, you (or Cursor) can iterate balance without touching code. See `WaveData`/`EnemyDirector` in doc 08.

See **§7.6** for the authored Stage 1 timeline that's actually implemented.

### 7.6 Stage 1 — authored wave design (`resources/waves/`)

The implemented Stage 1 (Carnival Core, first 5 minutes). Built from the enemies we have, plus a flyby swarm and an elite gauntlet. Base spawns follow the §7.2 min/interval rules; overlay mechanics layer on top. Tuned against the player's 220 px/s.

| Start | Base spawn (weights) | min→max | interval / batch | Overlay mechanic |
|------:|----------------------|--------:|------------------|------------------|
| 0:00 | Balloon 100 | 8→28 | 1.10s / 2 | — |
| 1:00 | Balloon 70 · Monkey 30 | 12→42 | 1.00s / 2 | — |
| 2:00 | Balloon 65 · Monkey 35 | 14→52 | 0.95s / 2 | **Balloon swarm** every ~7s (10 flyby) |
| 3:00 | Stuffie 65 · Monkey 35 *(balloons gone)* | 18→62 | 0.90s / 3 | swarm every ~7s |
| 4:00 | Stuffie 50 · Monkey 25 · Clown 25 | 22→78 | 0.85s / 3 | swarm every ~6s |
| 5:00 | Stuffie 45 · Clown 35 · Monkey 20 | 26→100 | 0.80s / 3 | **Elite gauntlet:** 4 elites on entry + swarm every ~4s |

- **Balloon swarm** (`swarm_enemy`/`swarm_interval`/`swarm_size`): a group spawned just off a random edge that sweeps straight across the player's band and despawns off the far side — a non-persistent "dodge this," doesn't track the player.
- **Elite gauntlet** (`elite_burst`): on entering the 5:00 wave the director immediately spawns 4 elites (×6 HP, outlined) from the wave's pool, and the swarm cadence ramps up. This is the Stage 1 climax; a proper mini-boss (phases, HP bar) arrives with the M3 boss framework.

### 7.5 Elites
Periodically (and via events), spawn **elite variants**: a normal enemy scaled up (×4–8 HP, +dmg), tinted with an elite shader outline, guaranteed Gold + chance at a chest. Elite cadence rises each Act. Elites are mini-skill-checks between bosses.

---

## 8. Boss spawning & arenas

Bosses interrupt the normal flow at their time gates:
1. Director **pauses new normal spawns** and plays a warning (music shift, banner, screen darken-and-spotlight).
2. The boss enters with an **intro animation** from the appropriate part of the map.
3. **Arena handling differs by boss** (full designs in `05_boss_bible.md`):
   - **Carnival Tent & Puppet King** are *set-piece* fights: a soft arena forms (tent canvas walls / string-light ring) loosely confining the player to the Carnival Core for the duration. Add-spawns are part of the fight. *(Implemented for the Tent without hard walls: the tent sits **dormant at map center from run start** — a surprise that the prop is the boss — and at its gate it wakes and **slowly roams toward the player** (stopping at range to cast) so it pressures without confining. The director pauses ambient waves for the duration. Hard soft-walls were dropped because steered enemies snag on them.)*
   - **Ferris Wheel & Ringmaster** are *roaming* fights across the open map — they chase/relocate; the whole map is the arena.
4. On defeat: boss death spectacle, **guaranteed chest** (weapon/evolution), big Ticket burst, brief calm, then the next Act's spawn table engages.

---

## 9. Godot implementation notes (map specifically)

- **Ground:** build zones with `TileMapLayer` (Godot 4.7) for sand/planks/midway tiles; separate layers per zone for palette/lighting control.
- **Collision/obstacles:** fences, stall walls, railings as `StaticBody2D` (or tile collision) on the **World** physics layer. Shape the chokepoints here. *(Implemented: the **Carnival Core** is authored in `world.gd` as a data-driven element list — CAROUSEL, STALLS, TICKET BOOTH, PRIZE STAND, and a fence with three labeled GATE gaps — each a programmer-art rect with a text `Label`. Solids block the player only; enemies walk through them, per the VS pathing model above.)*
- **Decoration:** use **Scene Paint Mode (B)** to scatter props, lights, breakables, and ground clutter quickly across the open zones.
- **Lighting:** `CanvasModulate` for night tint; `PointLight2D` clusters at attractions; player lantern light; per-zone ambient tint (see doc 02 §3).
- **Depth:** one Y-sorted gameplay container holds player + enemies + props so overlaps sort by ground-position.
- **Hazards & events:** `Area2D` zones (tide, grease, spinner arcs) toggled by the director; events as `EventData` resources fired on a timer.
- **Camera:** `Camera2D` follows the player with light smoothing and **limits set to the map bounds** so it never shows beyond the fence/sea. Used to compute the spawn ring.
- **Boss arenas:** spawn temporary `StaticBody2D` "soft walls" (canvas/lights) for set-piece bosses; remove on defeat.

> Cross-references: spawn director / wave & difficulty resources / steering → `08_core_systems_implementation.md` · enemy roster the tables draw from → `04_enemy_bible.md` · boss arenas → `05_boss_bible.md` · run pacing/economy → `01_game_design_document.md`.
