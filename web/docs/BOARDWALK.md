# The Boardwalk — Map 3 design (D-68)

Penhallow's Boardwalk: a fictional 1930s seaside amusement park, long drowned in something older than the
sea. Inspired by the Santa Cruz Beach Boardwalk (a long promenade backed by a domed casino, an arched
arcade colonnade and a tangle of rides rising to the east around a white wooden coaster; a very wide
beach; long diagonal breakers; a wharf to the west), interpreted, not copied. Where the Fun House is
claustrophobic, the Boardwalk is about **scale, isolation and the vastness of the ocean**.

The solution to the hidden quest is in `EASTER_EGG_BOARDWALK.md` (developer-only).

## 1. What the existing maps established (source of truth: the code)

- **Registry.** `data/maps.ts` `MAPS` / `useMap` swap live bindings (layout, waves, bosses, events). A map
  is a `MapDef`; the renderer builds its world by `world` id; quest chains register per map id.
- **Night.** `DAWN_TIME` 1500 s (25:00). Four scheduled bosses at gates 360 / 720 / 1080 / 1440; the last
  holds the dawn. A miniboss on the director's interval. Four acts. The Fun House ramps its crowd on the
  first map's curve about 15% sturdier (D-64), measured per role with `scripts/maphp.ts`.
- **Enemies** walk through solids (survivors-like model); behaviours live per map
  (`sim/funhouseAI.ts`); models are SDF sculpts on skeletons with a move clip and a wind-up clip
  (`render3d/models/funhouseCreatures.ts`). The Fun House shipped 7 new of 11 types (64%).
- **Bosses** are coroutine attack loops (`sim/bosses/boss.ts`), telegraphed hazards and bullets,
  articulated rigs driven by a replicated pose (`render3d/funhouseBosses.ts`), canvas portraits.
- **Quests** are deterministic state machines (`sim/quest/quest.ts`) that only speak through cues; the
  Fun House's Unreflected has 10 stages / 9 progression steps with ~9 distinct mechanics, every
  hands-on step one interact press (D-67).
- **Co-op** replicates enemies, bullets, hazards and bosses generically; quest state rides in
  `netState()` (≤ 64 bytes); map machinery is a pure function of sim time so guests predict it.

## 2. Geography (sim units; x east, y south; the camera looks north)

The world is **8000 wide** (x −4000..4000) and runs from the hills (y −2300) out past the pier's end
(y 2950). Bands, north to south:

| Band | y | What |
|---|---|---|
| Ride Grounds | −2250 .. −1000 | the skyline: the Undertow coaster (east), the Sea Wheel, the Plunge drop tower, the Kraken, the Grand Pavilion's dome; walkable ground between rides |
| Façade row | −1000 .. −820 | attractions facing the promenade; the Arcade and the Gift Shop open inside |
| Promenade | −820 .. −130 | 700-deep plank boardwalk, end to end, palms and lamp posts, the bandstand |
| Seawall | −130 .. −60 | rail with wide stair gaps down to the sand (5 gaps ≥ 280) |
| Beach | −60 .. shore (≈1150) | dark sand, wet sand, lifeguard towers, the wreck, washed-up things |
| Surf | shore .. shore+150 | shallow water, walkable (a little slower) |
| Ocean | beyond | deep, cold, blocked to players; sea creatures swim |
| Pier | x ≈ −3060..−2740 → | the wharf from the west end of the promenade, 3000 long into the fog |

The shoreline undulates gently and **moves with the tide** (±60 units every 75 s). Breakers come in at an
angle (like the photo's long diagonal lines).

### 2.1 The Main Boardwalk — west to east (the promenade's stretches)

| Stretch | x | Identity |
|---|---|---|
| The Wharf Gate | −3900..−2500 | fish market & chandlery, clam shack, the iron arch over the pier's mouth; maritime, salt-white |
| Arcade Row | −2500..−600 | the tintype studio, **the Arcade** (Neptune's Palace of Amusements, a long arched colonnade), ring & ball toss |
| The Grand Plaza | −600..900 | **the Grand Pavilion** (domed casino & carousel hall, cupola, flagpole), the bandstand, the grand stairs to the sand, the Sea Wheel behind |
| Sweets & Souvenirs | 900..2300 | the taffy works (pulling machine in the window), **the Gift Shop** (Seashell Souvenirs & Curiosities), lemonade, ticket booth |
| Coaster Junction | 2300..3900 | **the Undertow**'s station; the coaster's trestle crosses over the promenade and dips toward the beach; the Starlight Ballroom under the track; the Plunge |

Hierarchy: **landmarks** (the coaster, the Sea Wheel, the Grand Pavilion's dome, the Plunge, the pier's
lighthouse) → **secondary attractions** (façades with signage, the Kraken, the bandstand, the wreck) →
**small details** (lamps, benches, bins, telescopes, carts, vending machines, banners, posters).

### 2.2 Explorable interiors (seamless cutaway)

Interiors are part of the same map: walls with doorways (two exits each), real interior floors, props
and lights. When the **local** player steps inside, that building's roof and front wall dissolve on
their screen only, so partners can be in different buildings at once. Enemies follow (they walk through
walls as everywhere), so interiors are never safe rooms. Positions replicate like anywhere else.

- **The Arcade** (x −1900..−700, y −1520..−820): rows of mutoscopes and pinball cabinets, the Laughing
  Sailor automaton, **Madame Marina** (a drowned fortune machine), the **Crane** claw machine, a
  mechanical **shooting gallery** along the back wall, skee-ball lanes, the change booth; checker floor
  with missing tiles; flickering machine light.
- **The Gift Shop** (x 1450..2350, y −1460..−820): shelves of souvenirs, glass cases, a postcard
  spinner, shells and ships in bottles, the brass cash register, the 1933 photograph on the north wall,
  and the Commodore's back cabinet.

### 2.3 The Beach

Wide and exposed: dry dark sand under the seawall, wet reflective sand in the swash zone, the surf.
Three lifeguard towers, abandoned umbrellas and chairs, a beached rowboat, driftwood, kelp, the **wreck
of the Gala Queen** at the waterline (only fully exposed at low tide), the ribs of something enormous,
signs (NO SWIMMING AFTER DARK), tracks leading into the water. Sea creatures walk out of the surf.

### 2.4 The Pier

From the Wharf Gate south over the sand and into the sea: the **neck** (320 wide), the **bait platform**
(1000 × 450: bait & tackle shop, cleaning tables, the loading crane, nets), the **long walk** with a
**side dock** east (the trawler *Mary Ellen*, the bubbling spot), and the **pier end** (900 × 550: the
foghorn house, the lighthouse lantern sweeping the sea, the Gala Queen's empty berth). Fog thickens with
distance from shore; the park's sound fades into wind, timber and waves.

## 3. The ocean (graphics priority)

One camera-following displaced grid (snapped so it never swims) south of the shore, plus the shore band:

- **Waves:** a sum of directional Gerstner waves (6 / 4 / 2 by quality) at several scales, all coming in
  at an angle; analytic normals from the same sum, plus **two tiling normal maps** (procedurally baked at
  boot) scrolled in crossing directions at three scales for chop: detailed, never obviously tiled.
- **Shading:** blue-black deep water, a dark teal subsurface lift on crests facing the moon, Schlick
  fresnel against a procedural night sky, a GGX moon glitter **path** (the orthographic camera sees no
  natural path, so the glitter is concentrated in a wavering column toward the moon), and the park's
  practical lights reflected as **long broken streaks** (computed from the shared light pool).
- **Shore:** depth from the analytic seabed: shallow water lightens and turns translucent over sand;
  **breakers** travel in at an angle and turn to foam where it shallows; the swash runs up and drains
  back, leaving a wet sheen on the sand (the beach floor shader reads the same swash).
- **Around things:** foam rings at every pier piling and boat hull; spray where breakers hit the pilings
  and when things surface; sea mist thickening over the water and out along the pier.
- **Beneath:** occasionally a vast shape passes under the surface far out (a darkening and a long swell).
- **Cost:** two draw calls, no extra scene pass (reflections are analytic). Low quality drops waves and
  normal octaves.

## 4. Enemy roster (15 types: 10 new = 67%; with the miniboss, 11 of 16)

As built (`data/enemies.ts`, `sim/boardwalkAI.ts`, `render3d/models/boardwalkCreatures.ts`). Stats are
base values; every attack has a readable wind-up the renderer shows.

| Enemy | Theme | HP / speed / contact | Behaviour |
|---|---|---|---|
| The Drowned | sea | 38 / 95 / 6 | claws up out of the sand or the surf; drags itself a few steps, then lurches |
| Shore Crawler | sea | 15 / 175 / 4 | a bottle-capped crab: scuttles sideways across your line, raises its claws, darts straight in |
| Ticket Taker | boardwalk | 40 / 120 / 6 | keeps a stiff distance; flicks a punched stub that **marks** you for 5 s (the crowd moves 22% faster toward you) |
| Taffy Horror | boardwalk | 72 / 40 / 8 | a twist of saltwater taffy: a sticky line marks its lash; caught, you're slowed hard and reeled in |
| Arcade Automaton | boardwalk | 36 / 60 / 6 | a penny-arcade cabinet on brass legs: clockwork steps, then its crank ratchets and it spits five tokens in a fan |
| Coaster Wraith | boardwalk | 180 / 70 / 18 | a rider in a coaster car: lays a bent rail of light (out to a bend beside you, then through you) and rides it at 620 |
| Barnacle Brute | sea | 190 / 50 / 14 | a diver the reef grew over: its crust takes 30% until it has soaked half its health in raw damage, then cracks (125% after, 35% faster); telegraphed slam |
| Lantern Angler | sea | 150 / 85 / 16 | holds still while its carnival lantern draws nearby players in (a gentle pull), then a wedge marks the bite and it lunges |
| Prize Collector | boardwalk | 520 / 70 / 12 (max 3) | the prize-counter man: hoovers up tickets on the ground and swells with them; pays them all back ×1.5 when it falls; telegraphed grab |
| Tidecaller | sea | 330 / 65 / 8 (max 3) | hangs back; rings its bell and the drowned claw up round you; lifts its staff and a line of seawater rolls across the boards |
| *reused:* Living Balloon, Balloon Swarm, Evil Clown, Wind-Up Monkey, Possessed Stuffie | carnival | | |
| *miniboss:* The Great Barnacle | sea | 960 / 75 / 14 | a giant barnacle brute; its slam throws a ring of seawater outward with one gap; drops a chest |
| *boss add:* Tin Duck | boardwalk | 22 | the Barker's shooting gallery (and the quest's): marches along a lit lane |

- **Sea creatures:**
  - They swim 30% faster in water deeper than 40, and are 15% slower on land.
  - When a player is by the water, they spawn out past the breakers and come up out of the surf.
  - Land creatures wade at 62% speed in water deeper than 60, and never spawn in deep water.
- **In water, the renderer:**
  - stands land creatures on the sea floor (waist-deep);
  - swims sea creatures with only their heads and backs above the swell;
  - rings each one with foam;
  - draws risers climbing up out of the sand or the surf over their first second (no contact until
    they're up).

Waves (`BOARDWALK_WAVES`) keep the other maps' crowd curve (minimum and maximum alive, interval, batch);
the roster arrives act by act. Measured with `scripts/maphp.ts` (one seed, god-mode bot), crowd health
per spawn is about 1.2× the first map's in Act I. By roster weights, Act II is about 1.25×. Later acts
depend on when bosses die, so read them from three seeds.

## 5. Bosses (same gates as every map)

As built (`sim/bosses/*`, rigs in `render3d/boardwalkBosses.ts`, portraits in
`render/art/boardwalkBosses.ts`). Every fight draws a stage ring round everyone standing when it begins,
so an open map still gives a contained fight, and nobody starts outside the ring.

| Gate | Boss (HP) | Phases | Signature |
|---|---|---|---|
| 6:00 | **The Boardwalk Barker** (7,400) — "Step Right Up!" | The Pitch / The Hard Sell / Last Call | megaphone shout cones, ring-toss rain, rows of tin ducks marching along lit lanes, the prize wheel's turning spokes, performers called up, feedback rings with a gap, the soapbox charge |
| 12:00 | **The Drowned Captain** (20,500) — "All Hands Lost" | Making Landfall / The Ghost Fleet / Davy Jones | rises from the surf; anchor thrown out and hauled back on its chain; cutlass; the crew rising; the **Gala Queen** offshore fires broadsides that land in lines; he dives and comes up under you; the sea rolls up the stage with two gaps; a whirlpool |
| 18:00 | **The Last Ride** (33,500) — "The Ride Never Ends" | Boarding / Full Speed / Derailed | the Undertow's train (five cars ride its path, all part of the train): lays glowing track and runs it; laps a ring of track round you throwing sparks; uncouples cars that come down like shells; off the rails: zig-zag dashes leaving fire, and the drop |
| 24:00 | **The Leviathan** (59,000) — "From Below"; holds the dawn | Stirring / The Deep Rises / Leviathan | its head comes up out of the water or through the boards; tentacles burst up round you and slam (each can be cut, and each cut costs it 2.5% of its health); it dives and surfaces under you; seawater spit; tidal waves with gaps; a whirlpool; roaring rings; the devouring lunge; wreckage rain |
| secret | **The Commodore** (66,000) — "The Founder's Bargain" | The Founder / The Bargain / Summer's End | Summer's End's finale (see the quest doc); not on the schedule |

## 6. Hazards and events

- **Machinery:**
  - The Undertow runs on a schedule; where its track dips low over the beach, a car hits whatever
    stands under it.
  - The tide moves the waterline ±60 every 75 s.
  - The lighthouse beam sweeps the sea and the pier.
- **Events** (`BOARDWALK_EVENTS`; the shared funnel cake, clown car, last ticket and calliope too):

  | Event | What happens |
  |---|---|
  | Rogue Wave | a wall of water runs up the beach from the waterline, broken in two places |
  | The Undertow Runs | a pack of coaster wraiths spills off the nearest stretch of track |
  | The Fog Comes In | darkness to the lantern bubble; the drowned walk in with it; bonus tickets for surviving |
  | Short Circuit | telegraphed arcs leap between the promenade's lamps near you, every couple of seconds |
  | Washed Ashore | a sea-chest on the wet sand, guarded by what came in with it |
  | The Ship's Light | a ghost ship's searchlight hunts the nearest player across the boards; stay out of the beam |

- **Scheduled beats:** funnel cake 3:00, washed ashore 8:00, the Undertow runs 15:00, calliope 21:00.
- **Reachability:**
  - Healing spots, golden tickets and event chests are never placed out in water deeper than a wade.
  - Anything that falls in deep water (tickets from a sea creature killed offshore) drifts back in to
    where it can be reached.

## 7. Audio

Three ambiences crossfading by where the listener stands: the **boardwalk** (a warped calliope from the
pavilion, arcade chimes, ride machinery, distant laughter, flapping canvas), the **beach** (surf, wind,
far gulls) and the **pier** (water slapping pilings, creaking timber, rigging, a bell buoy, the foghorn
far out). Music: a slow, detuned seaside waltz in four acts. New sounds for every creature, the coaster,
the surf, the arcade and the pier.

## 8. Integration

- `MapId` `boardwalk`, a third selectable map in the solo picker and the co-op lobby; the Midway's
  chained "Boardwalk" gate opens onto it. Available once the Fun House has been survived (the Proprietor
  beaten), or with `?unlock=boardwalk` (alpha testing); the gate and the pickers say what it takes.
- Architecture extensions (documented in `DESIGN_DECISIONS.md` D-68): non-square map extents and camera
  bounds in `MapLayout`; a terrain hook (walkable ground / water depth) used by movement, spawning and
  the renderer; per-map ambience zones.
- PROTO bump (a new map id on the wire).

## 9. Status (2026-10-31)

Built:
- **The map:**
  - the world: promenade, façades, the two interiors, rides, beach, pier, ocean, lighting;
  - the movement and wading rules;
  - the tide and the coaster crossing.
- **The crowd and fights:** the ten new enemies, the miniboss and the tin duck; the four bosses and the
  secret boss; the six events.
- **The quest:** Summer's End.
- **Sound:** three ambiences and the seaside waltz.
- **Integration:** the Midway gate, the map pickers, `?unlock=boardwalk`, PROTO 10, achievements, the
  unlock.

Measured and inspected: `QA_REPORT.md`, `VISUAL_QA.md`. Handoff notes: `HANDOFF_BOARDWALK.md`.
