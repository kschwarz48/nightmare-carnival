# Map 2 — The Fun House (D-63)

*Professor Grinwell's Palace of Illusions.* The Carnival Core introduces the cursed carnival; the Fun
House is the building inside it that lies to you. This document is the design and the developer
reference. The hidden quest's solution lives separately in
[`EASTER_EGG_FUN_HOUSE.md`](EASTER_EGG_FUN_HOUSE.md), which is developer-only.

## 1. What the first map established (the baseline)

| | Carnival Core | The Fun House |
|---|---|---|
| Run length | 25:00 (dawn at `DAWN_TIME` 1500 s) | same |
| Scheduled bosses | 4: Tent 6:00, Ferris Wheel 12:00, Puppet King 18:00, Ringmaster 24:00 (holds the dawn) | 4 at the same gates; the Proprietor holds the dawn |
| Secret boss | the Calliope (Last Song), outside the schedule | the Unreflected (hidden quest), outside the schedule |
| Map | 4400 × 4400, outdoor; solids block players only | 4400 × 4400, indoor; walls block players only |
| Enemies | 16 types | 11 types: 7 new, 4 shared (64% new) |
| Hidden quest | 7 stages, about 5 substantive mechanics | 10 stages, 9 substantive mechanics |

Enemies walk through scenery on both maps (the Vampire Survivors model). In the Fun House that's part of
the fiction: the house lets *them* through its walls.

## 2. Architecture: how a second map plugs in

- **Map registry** (`src/data/maps.ts`). A `MapDef` bundles everything that differs per map: layout
  (bounds, props, lights, floor paint, spawn), waves, the boss schedule, the final boss that holds the
  dawn, carnival events, the quest chains, the music and ambience, and the renderer's world builder id.
- **Live bindings.** The existing modules keep importing `PROPS`, `PLAYER_BOUNDS`, `WAVES`, `BOSSES` and
  so on. Those are now `export let` bindings that `useMap(id)` swaps. `Game` selects its map when it's
  built and re-asserts it at the top of every tick, so tests and the attract-mode demo can interleave
  games on different maps. Nothing that runs per frame caches map data, and anything built once per map
  (the spatial grid, the renderer's world) is rebuilt for the new map.
- **Renderer worlds.** `GameRenderer3D` owns one world at a time: ground, props, clutter, light pools
  and shafts. When `g.mapId` changes it disposes that world and builds the other. The Fun House world
  lives under `render3d/world/funhouse/`.
- **Selection.** Solo players pick the map on the character select screen, next to difficulty. A co-op
  host picks it in the lobby (`LobbyState.map`), it travels in the start config (`StartCfg.map`), and
  every guest builds the same map. On the Midway, the Fun House gate opens: walking in starts a Fun House
  night (for a co-op host, the lobby with the Fun House chosen).
- **Unlock.** The Fun House opens after surviving the first night once: defeating the Ringmaster at
  dawn on any difficulty, or the Midway being open. `?unlock=funhouse` opens it for alpha testing.
- **Saves.** Records, achievements and quest memory key on ids that are already distinct; the new
  quest's completions sit under `quests.unreflected`.

## 3. Layout

Coordinates are sim units: x to the right, y down (south is +y), origin at the centre. Walls are AABB
solids 40-60 thick. Every doorway is at least 240 wide, and every room has two or more ways out.

```
 y=-2200 ┌──────────────────────┬──────────────────────────────┐
         │   PUPPET GALLERY     │     CHAMBER OF ILLUSIONS     │
         │  plinths, marionette │   stage, curtains, viewer's  │
         │  racks, music box    │   mark, trapdoors            │
 y=-1350 ├───────┬──────  ──────┴──────  ──────────────┬───────┤
         │ HALL  │                                     │CROOKED│
         │  OF   │            THE ROTUNDA              │CORRI- │
         │MIRRORS│   kaleidoscope column, open arena   │ DOR   │
         │ (maze)│                                     │conveyor│
         │       │                                     │pistons│
 y= 900  ├───────┴─────────────  ─────  ───────────────┴───────┤
         │               GRAND ENTRANCE                         │
         │  ticket booths, lost & found counter, posters        │
 y=2200  └────────────[ the giant grinning face ]───────────────┘
```

| Area | Extent | Role |
|---|---|---|
| **Grand Entrance** | y 900..2140 | Spawn. A wide hall under the giant grinning face: ticket booths, posters, mechanical barkers, the lost & found counter (quest start). |
| **The Rotunda** | centre, r ~900 | The main fighting floor and boss stage: open, with a slowly turning mirrored kaleidoscope column at the centre that throws light beams during events. |
| **Hall of Mirrors** | x -2140..-760, y -1350..900 | The signature area: a real mirror maze on a 220-unit grid with corridors 220-260 wide, four nodes, and the Heart chamber. Pivoting mirror panels turn on a schedule and reshape it. |
| **Crooked Corridor** | x 760..2140, y -1350..900 | A zig-zag hall of offset slanted walls, uneven boards, conveyor strips that push and telegraphed piston stomps. |
| **Puppet Gallery** | x -2140..-200, y -2140..-1350 | Mannequins and marionettes on display. Some are scenery and some are Grinning Mannequins. Four performer plinths and the great music-box automaton. |
| **Chamber of Illusions** | x -200..2140, y -2140..-1350 | A theatre: the stage, curtains, stage machinery, the viewer's mark and the anamorphic mural. |

## 4. The mirror maze

**Rendering (convincing, affordable).**
- Mirror glass faces south, toward the camera. The maze is built on grid rows, so the visible mirrors
  sit on a handful of planes.
- Each plane on screen gets a low-resolution reflection target, rendered from the main camera reflected
  across the plane. The view is tightened to the mirror's screen rectangle and clipped to what stands in
  front of the glass by an oblique near plane. Planes update round-robin: two per frame on high quality,
  one on medium. Low quality shows a plain silver sheen instead.
- **The reflection leans back 12°.** This happens only in the reflection, not in the world. An upright
  mirror seen by a camera looking 50° down shows nothing but floor and shins. Leaned, it reflects 26°
  below the horizon, so anyone within about a cell of the glass shows from head to toe. That is what
  sells the effect.
- Measured on high quality in the dev build, on this machine: about 5.4 ms a frame in the maze with
  reflections live, 3.4 ms in the Grand Entrance.
- The glass shader projects that texture back onto the mirror, then adds a silver tint, age spots,
  cracks and, on the warped panels, a funhouse wobble.
- East- and west-facing panels are seen edge-on, so they show only their gilt frames.
- A **mirror-only layer** holds things that exist only in reflections (ghost faces, symbols, an open
  doorway). The reflection cameras render that layer and the main camera never does.

**Mechanics.**
- **Pivoting panels.** Panels turn 90° on a schedule that is a pure function of sim time, so a guest's
  prediction sees the same walls. Their edges flash and grind for 1.5 s first, and anyone caught is
  pushed clear.
- **Delayed reflections.** Some panels refresh their reflection late, so your reflection lags.
- **Rippling glass.** A Glasswalker can only step out of glass, and the glass ripples first.
- **Things only mirrors show.** The hidden quest's four performers' faces live on the mirror-only
  layer: they're in the glass, not the room. (Mira's vanity shows its clue as a mirrored clock drawn on
  the vanity's glass, and the Heart's doorway as glass turned to water; both are in the world.)
- **The beam puzzle.** Light from the prism projector bounces off four pivot mirrors (§7).

**Co-op.** Panels, beams and reflections are shared world state. Nothing needs two people at once.

## 5. Enemies (11 types: 7 new, 64%)

| Enemy | New? | Role | Behaviour |
|---|---|---|---|
| **Grinning Mannequin** | new | durable ambusher | Frozen while any player faces it within 520 units; sprints when nobody is looking. Spawns posed like the gallery's dummies. |
| **Doppelganger** | new | fast stalker | A chrome mime that walks the player's own path 1.2 s behind; gleams, then lunges when close. (Its model is its own, not a copy of your character.) |
| **Glasswalker** | new | environmental mover | Steps out of mirror glass near a player (ripple warning), slashes and shatters back in. Away from mirrors it rises from floor-puddle reflections. |
| **Marionette** | new | erratic leaper | Yanked on invisible strings in jerky leaps that land with a small shockwave; changes direction mid-air. |
| **Splitter** | new | durable, multiplies | A funhouse-mirror blob that splits into two smaller ones on death, twice. |
| **Crooked Clown** | new | ranged | Stretched like a bad reflection; throws bent juggling pins that curve. Sidesteps erratically. |
| **Reflection Thief** | new | special / elite support | Holds a hand mirror and conjures harmless shimmering decoys of nearby enemies; blinks away when approached; killing it dispels its decoys. |
| Evil Clown | shared | fast bruiser | The Funhouse employs clowns too. |
| Jack-in-the-Box | shared | ambusher | Toy-box surprises fit the house. |
| Living Balloon / Swarm Balloon | shared | fodder, drifts | The balloon drifts float in through the doors. |

**The crowd follows the first night's curve, about 15% sturdier (D-64).** Each new enemy takes a
first-world enemy's slot, at about 1.15× its health and contact damage, with the same tickets:

| Fun House enemy | First-world slot | Health | Arrives |
|---|---|---|---|
| Marionette | Wind-Up Monkey (12) | 14 | 0:00 (a trickle), 1:00 properly |
| Grinning Mannequin | Possessed Stuffie (32) | 37 | 3:00 |
| Crooked Clown | Dunk Tank Clown (30) | 34 | 6:00 |
| Splitter family | Cotton-Candy Slime (60) | 30 + 2×12 + 4×5 = 74 | 6:00 |
| Glasswalker | Carousel Horse (150) | 172 | 12:00 |
| Doppelganger | Puppet Soldier (180) | 207 | 12:00 |
| Reflection Thief | Walking Ticket Booth (600, a spawner) | 300 (an evasive caster; capped at 3 alive) | 12:00 |
| The Grand Display (miniboss) | Carnival Brute (900) | 1,035 | every 140 s, like the Brute |

You start the house as a fresh level-1 character. The first minutes are balloons and marionettes, as
the first world's are balloons and monkeys. A Marionette's landing is marked on the floor for the whole
leap.

Every new enemy has its own silhouette, model and animation clips (move and attack), a readable
wind-up, and its own death effect and sounds.

## 6. Bosses (same gates as Map 1)

The house's bosses are creatures of the house: walls don't stop them. They arrive near the party
(`FunhouseBoss.arriveNear`), every attack picks on the nearest standing player, and every position they
choose stays inside the house. The code is in `src/sim/bosses/` (`twins`, `lookingGlass`,
`stringmistress`, `proprietor`, `unreflected`, and the shared `fhBoss`). The rigs are in
`src/render3d/funhouseBosses.ts` and the portraits in `src/render/art/funhouseBosses.ts`.

| Gate | Boss | Phases |
|---|---|---|
| 6:00 | **The Crooked Twins**: Stilts and Barrel, roped at the waist, one health bar and two bodies | **The Act:** Barrel bowls down telegraphed lanes; Stilts stomps in threes; juggled pins curl. **The Quarrel** (60%): they stretch the rope taut and clothesline across the room together behind a lane telegraph as wide as the rope; Barrel ricochets three times. **Alone** (25%): the rope snaps and Barrel lies still; Stilts leaps at you (a telegraphed landing and a gapped shockwave), wails in telegraphed cones and throws gapped rings of pins. |
| 12:00 | **The Looking Glass**: a walking gilt mirror with a face in it | **Reflection:** shard fans; a telegraphed dash that leaves glittering broken glass; a blinding glint cone. **Refraction** (66%): two silvered reflections stand a third of the way round you each side. Only the gilt one is real; striking a reflection shatters it into a spray of shards. All three fire crossing beams through where you stand, and the real one swaps places with a reflection. **Shatter** (33%): the glass breaks into a ring of orbiting shards that widens and flies outward, and six turning kaleidoscope beams. |
| 18:00 | **The Stringmistress**: a porcelain puppeteer hanging from the dark on her own strings | **The Cradle:** a cat's cradle of strings across the floor (chords that always leave a pocket); marionettes lowered onto telegraphed landings; needles aimed ahead of you. **The Web** (66%): eight spokes of string turn round her; she hooks the nearest player with a telegraphed line and reels them toward a winding-up bite. **Cut Loose** (33%): she drops to the floor and skitters, trailing strings; eight leg stabs ring her; snapped strings whip out in telegraphed lashes. |
| 24:00 | **The Proprietor**: Professor Grinwell, who holds back the dawn | **The Illusionist:** vanishes into smoke and steps out on a telegraphed ring; fans of ADMIT ONE tickets; the sawing trick (crossed blades through where you stand); a cabinet of thieves and mannequins. **The House Itself** (66%): pistons punch up in a closing spiral; the house laughs in gapped rings; mirror walls box you in with one side open. **The Grin** (33%): his smile splits his face; telegraphed bites with lunges; a grin-beam that sweeps round from a telegraphed line. |
| secret | **The Unreflected** (§7) | Outside the schedule; it never changes the boss count or run length. **The Other Side:** every attack also comes from its reflection across you. **Every Face:** homing masks, mirror walls closing from both sides (one gap each), kaleidoscope beams. **No Reflection:** it fades to an outlined shimmer and bursts in gapped rings. |

Each boss has:
- three phases with telegraphed attacks;
- the shared solo and co-op HP scaling;
- a defeat sequence;
- its own glow colour, rig and portrait;
- Bradley's boss track.

Their tests (warn, wake inside the house, telegraph, every phase, pay out) are in
`tests/funhouseBosses.test.ts`, along with an accelerated whole night that meets all four in order and
reaches dawn.

## 7. The hidden quest — "The Unreflected"

In 1931 Grinwell's mirrors began keeping what they reflected. His assistant Mira found out, and he
sealed her in the maze's heart. The house laughs because it is full of stolen faces. The chain has ten
stages. Clues are all diegetic: reflections, an anamorphic mural, a music box, reversed writing,
clocks, and whispers in Mira's voice. There is no quest UI. The full solution, state machine,
co-op rules and recovery are in [`EASTER_EGG_FUN_HOUSE.md`](EASTER_EGG_FUN_HOUSE.md).

The payoff is that the house shatters into the mirror world, the Unreflected rises, and beating it brings
the Fun House's True Dawn, an achievement and a permanent unlock.

## 8. Hazards and events

- **Hazards:**
  - pivoting mirror panels (maze);
  - conveyor strips and piston stomps (Crooked Corridor);
  - stage trapdoors (Chamber of Illusions);
  - kaleidoscope beams (Rotunda, during events).

  All are telegraphed. Deterministic ones are pure functions of sim time, so guests predict them.
- **Events**, chosen per map:
  - *House Lights Fail* (the lights-out variant);
  - *The Mirrors Shuffle* (every pivot turns at once);
  - *Laughing Gallery* (the mannequins wake);
  - *Kaleidoscope* (Rotunda beams);
  - Free Funnel Cake, Clown Car, Last Ticket and Calliope Crescendo, which carry over.

## 9. Audio

- **Night score** (`NIGHT.fh_act1..4`, `fh_endless` in `audio.ts`): the first map's procedural waltz
  played backwards, a semitone or so lower and more out of tune. It has a bass line that won't resolve,
  a detuned calliope shadow, and a wet-finger-on-glass harmonic ringing over the off-bars. It darkens
  each Act like the first map's. Boss fights keep Bradley's song.
- **Ambience** (`houseAmbience`): a 14 s indoor loop with no wind. It holds a close room tone, boards
  settling, a slow drip, two swelling glass partials, a broken music box running down, and far-off
  smeared laughter. It swaps in with the map and back for the menus and the Midway.
- **Signature sounds:** glass ripple, mirror shatter, mannequin creak, string twang, conveyor rattle,
  trapdoor clunk, the house laughing.
- **Sudden silence** before every boss.
- **Accessibility:** quest audio cues also have visual equivalents.

## 10. Status

This section tracks implementation and is updated as milestones land. See QA_REPORT.md for what was
verified, and how.

**Built (D-63), on `web-threejs-rebuild`, not yet pushed:**
- **The map:** the registry, the floor plan, walls and props, the floor shader, the mirror system, the
  pivots, conveyors, pistons and the dressing-room door.
- **Content:** the seven new enemies (sim, models, death effects) and the four events.
- **Bosses:** all four scheduled bosses and the secret one.
- **The quest:** all ten stages, co-op sync and visuals.
- **Audio:** the score and ambience.
- **Integration:** map selection in the solo character screen and the co-op lobby (PROTO 7), the
  Midway's Fun House gate, and a new passive unlock.

**Lighting, readable walls, E to interact (D-67):** every light pool now comes from a fixture you
can see (sconces, pendants, capital lamps, picture lights, stage booms, chandeliers and floor lamps,
all with halos), moonlight falls through tall windows, walls wear pale caps with glowing edges and a
contact shade, and every hands-on quest step is a press of interact with a prompt. Evidence:
`VISUAL_QA.md`; quest rules: `EASTER_EGG_FUN_HOUSE.md`.

**Verified locally:**
- The full Vitest suite passes, and the production build passes.
- Visual captures in the dev build (in-app browser, 1600×900) cover:
  - all six areas;
  - the mirrors up close, with plain, warped and lagging glass and enemies reflected;
  - all five bosses in action;
  - the quest's states: the hand mirror, a face in the glass, busts, the smeared and crisp mural, the
    parted curtain and charge ring, the beam partial and solved, the water door, the vanity's clock,
    and Mira;
  - the clocks;
  - the five portraits;
  - the map row on the character screen.

**Not verified:**
- A real two-machine co-op night on the Fun House across networks. Co-op is covered by loopback tests
  only: lobby map selection, a guest building the same map, and the quest arriving through snapshots.
- A full manual playthrough by a person.
- Balance beyond the bot night: the accelerated god-mode bot meets all four bosses and reaches dawn
  at level 65.
