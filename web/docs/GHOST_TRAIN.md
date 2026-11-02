# The Ghost Train — Map 4 design (D-80, reworked in D-90)

The fourth and final map. A haunted 1890s steam train, **the Midnight Line**, runs between five places, and
since D-90 it goes **when the players say**: it waits at every platform until somebody pulls the whistle cord
at the front of the tender. Players board, whistle, ride, fight their way through the carriages, get off,
explore, and whistle it on again. This document is the design of record and the engineering notes; the
developer-only Easter egg solution is `docs/EASTER_EGG_GHOST_TRAIN.md`.

## 1. Lore

In 1899 the railway man **Silas Marrow** opened the Midnight Line: one railway that carried the crowds to
every carnival along it and, at the end of every night, carried home whoever was left. Business failed. Marrow
made a bargain with the thing every carnival owner in this game bargained with (the Boardwalk's ledger lists
the accounts: Penhallow, paid in guests; Grinwell, paid in reflections; the Ringmaster, paid in song). The
line would never stop running; in return its **last train of every night** would not go home. It would go
to **the End of the Line**, and its passengers would be the payment. The thing that punches their tickets
is **the Conductor**.

So every carnival's lost souls ride the Midnight Line. The Ticketless are passengers whose tickets were never
punched. Ada Penhallow (the Boardwalk), Mira (the Fun House), Theo Fairweather, the boy who played the
calliope (the Carnival Core), and Eli Marrow, Silas's own son, are among them. The hidden quest, **The Last
Train Home**, reroutes the line and runs the cancelled train at last.

## 2. Architecture: regions, copies and the train

**Problem.** A train that moves through world space would drag every projectile, hazard, pickup, summon and
enemy along with it, and the host-authoritative, snapshot-interpolated co-op model would jitter on a fast
moving floor.

**Solution: logical movement between regions.** The map is six rectangles ("regions") far apart in one world:

| Region | Index | Centre | Notes |
|---|---|---|---|
| Hollow Junction | 0 | (0, 0) | the start; the grand terminal |
| Saint Vesper's Halt | 1 | (6400, 0) | the graveyard |
| The Cinder Works | 2 | (0, 4800) | the foundry |
| Stillwater | 3 | (6400, 4800) | the village where the clocks stopped |
| The End of the Line | 4 | (0, 9600) | the terminus that should not exist |
| The train in transit | 5 | (6400, 9600) | the moving train |

- Each station has a **parked copy** of the train interior on its track (walls and furniture are static props).
  The transit region holds one more copy. The copies are identical in layout.
- The train itself is a small **host-authoritative state machine** (D-90; it was a fixed timetable): a
  `TrainRun` (`data/ghosttrain.ts`: approaching, standing at a stop, or travelling; the next stop; when it
  stopped or left; when it goes) advanced by `sim/ghosttrain.ts` and sent to guests in 12 bytes. `trainState(run,
  t)` turns it into the picture everyone draws and hears (doors, the station copies sliding, the conveyor, the
  bell and whistle). The doors are dynamic walls derived from it every tick, on the host and in a guest's mirror
  alike.
- **Departure** (dwell → travel): the host moves everything inside the station's copy (players, enemies,
  pickups, projectiles, bullets, hazards, summons) into the transit copy at the same local position.
  **Arrival** (travel → dwell): everything in the transit copy moves into the destination station's copy.
  The picture is identical before and after (same carriage, same spot). Only what is outside changes.
- While travelling, the world outside the transit copy is a **scenery conveyor** (`render3d/world/ghosttrain/
  scenery.ts`): the track bed, telegraph poles, signals, the country of each leg, the bridge over the drop, all
  streaming past at the train's speed. Pulling in and out, the **real station's platform fixtures, cloned**,
  slide past and stop exactly where the real ones stand, so the swap at the stop is invisible.
- The camera carries over any jump of the local player larger than 1500 units (a transfer or a phantom
  door), and is bounded to the local player's place (`layout.cameraFor`). The replica already snaps
  interpolation on jumps.
- Players can't leave a moving train because they are inside closed walls in a place with no exit. Enemies
  path through the carriages with the existing nav grid (the corridors are just walls). `confine` keeps
  anything that slips (flyers, shoves) on the ground of the place it is in.

**Spawning.** Station regions use the map's waves (each enemy has a home: `params.home`). The director's
anchor is the standing player whose station has the fewest creatures per player, so a party split between
stations each gets a fair crowd; nothing spawns inside the parked carriages. The moving train has its own
journey spawner (`journeySpawns`): most come aboard just out of sight to the **left or right of a rider**,
anywhere along the carriages (D-84), so the crowd closes in from both sides at once. About 30 % still board
over the **front** (out of the tender's coal; the Coalborn always) and the **rear** (over the observation
platform's railing). Nothing boards in view, and nothing boards while nobody rides. From Act II the boarders
are mostly meat: Navvies above all, Porters, Ticketless, few casters. The pace is unchanged for the first
eleven minutes, then climbs harder (rate up to 2.6 a second, up to 110 aboard; it was 1.6 and 64).

**A creature keeps to its place** (D-95): where nobody stands, it holds still and does nothing, as a boss does, and
it only goes after players in its own place. It went after the nearest player wherever they were, so creatures the
hidden quest stirs up (exempt from the despawn leash: Riveters at the ladle, a Watcher at the jetty) aimed their
lanes and gaze from a station across the world into the moving train.

**Bosses** fight at stations (`sim/bosses/gtBoss.ts`). A boss due while every player is riding waits for the
next platform anyone stands on. A boss holds still while nobody is in its place, and **follows the party down
the line**: once its station has stood empty for 4 s and somebody stands at another, it is waiting there
("THE STOKER IS WAITING · on the platform at Stillwater"). The Night Express and the Conductor are the End of
the Line's and never leave it. A boss quiets only its own station (D-84). The players fighting it get no new
spawns, but players at other stations keep their crowd: the cap and the floor scale with the share of the
party away from the boss. The riders' journeys go on too. Only the elite bursts and minibosses wait.

**Edges.** Every station's side and south limits stand as something physical (D-84; they were invisible walls
before): railings on stone piers with lamps in the line at the Junction, St. Vesper's and the End's brink, a
yard wall at the Cinder Works, dry-stone walls at Stillwater. A locked gate stands in each south fence: green
iron at the Junction, a churchyard gate at St. Vesper's, a yard gate at the Cinder Works, a five-bar gate at
Stillwater. They stand just outside the walk clamp (`walkRect`), so nobody brushes them
(`STATION_GATES`, `data/gtStations.ts`).

**No lost XP.** Tickets never expire; a station's tickets wait for the party to come back round, the ones in
the carriages ride along, and a golden ticket vacuums every ticket on the map to its finder.

## 3. The train

Front (east) to rear (west), walkable carriages, interior width 220:

| Car | Length | Character |
|---|---|---|
| Tender | 300 | iron plates, coal heaps, the firebox and whistle cord; **front boarding mouth** |
| Baggage car | 460 | trunks and crates in staggered stacks (narrow lanes), Luggage Mimics |
| Coach | 480 | velvet seat pairs along both walls, a red runner down the aisle |
| Dining car | 480 | tables in two rows with pink-shaded lamps, a lattice carpet |
| Car 13 (funeral car) | 460 | a catafalque and sealed casket (two lanes round it), candle stands, violet light |
| Sleeper | 480 | panelled compartments to the north, a corridor along the south wall |
| Observation car | 540 | parquet, armchairs, a rug; the open rear platform: **rear boarding mouth** |

Gangways (100 wide) join the cars. The locomotive (not walkable) is east of the tender. Doors: two per car on
the south (platform) side, one on the tender and Car 13. The roof over the copy you are in is cut away.

## 4. The whistle (D-90)

Station order: Hollow Junction (J) → Saint Vesper's (V) → Cinder Works (C) → Stillwater (S) → End of the
Line (E) → J. The night starts with the train **approaching J through the fog**, in at **0:30**. After that
**the players drive it**. The timetable is gone: no departure times, no countdown, no board of times.

- **The guard waits for the timetable** (D-95): until the hidden quest's four pages are gathered, the cord won't
  take the train out of a station, so every night begins at the Junction with its stopped clock, the brass key and
  the sleeper's pages. The HUD line and the cord say what's still wanted.
- **The whistle cord** hangs at the front of the tender (`LT_TRAIN.whistle`), in every copy of the train.
  Pulling it at a station (`pullWhistle`, `sim/ghosttrain.ts`) sounds the guard's whistle and the bell, "All
  aboard!", and **4 s later** (`WHISTLE_LEAD`) the doors close and the train leaves for the next stop. A second
  pull while it is going does nothing more.
- **It only goes with somebody aboard.** If nobody standing is inside its carriages when the doors would close,
  the guard waits ("Nobody aboard: the train waits"); pull again once someone has got on.
- **Legs:** 35 s station to station; Stillwater to the Junction is 60 s, passing through E without stopping.
- **E on the route:** S → E → J instead of S → J from the final act (**25:00**) for everyone, or earlier on
  the journey where the hidden quest's signal is shown green (`eOpenOf`; see the egg doc).
- **Nobody stranded:** a train standing at a station nobody is at (and nobody aboard) goes **empty**, after 8 s
  (`RECALL_AFTER`), straight to the station where most of the party stands, and waits there for the whistle.
  So a party split between stations, or one that wandered off, always gets the train back.
- **The last train:** the first arrival at E at or after **32:00** (`TERMINUS_FROM`) terminates: it stands at E,
  doors open, for the rest of the night, and its cord only says the train terminates here. From **33:00** a
  **phantom door** stands open on every other platform, one step to E's platform.
- Doors open 2 s after a stop and close at the departure. Pulling in, the engine gives two long blasts (loud
  aboard and at that station, faint everywhere else), and whoever waits there gets "The train is in"; the first
  arrival of a night adds a whisper: *Pull the whistle cord at the front of the tender to go on to the next
  station.*
- Nobody is left inside a train's walls (D-84). Aboard, a player is kept in a car or a gangway (the couplings'
  pockets between cars are walled). At a station whose train is away, a player inside the carriages'
  footprint (shut in by the doors, or knocked in) is put back on the platform. At departure only those in a
  car, a gangway or a doorway are carried, not someone pressed against the outside of the train.
- Readable: the HUD line under the clock (`ui/lineBoard.ts`): "HOLLOW JCT. → ST. VESPER'S · pull the whistle
  cord in the tender to depart", ALL ABOARD after a pull, "doors opening", "this train terminates here";
  aboard, "next stop …" and "arriving · …"; away from the train, where it is ("the train is at Stillwater",
  "the train is on its way to …"). "Look at the station clock" at every station clock and the Junction's board
  say where the train is and where it goes next. The bell, the whistle, the doors and the brakes as before.
- **Net:** the host runs the train; its 12 bytes (`packRun`: phase, stop, next stop, flags, the times at 1/20 s,
  the leg's length, the trip count) ride the `gt_line` quest chain's net state, so a guest's doors, transfers,
  HUD line and sounds match the host's. A guest's pull is an interaction like any other (PROTO 18).

## 5. Pacing (35:00)

| Act | Time | Arc |
|---|---|---|
| I — The Midnight Line | 0:00–8:00 | learn the train; first stations; light journeys (Ticketless, Coalborn, Porters) |
| II — Passengers | 8:00–17:00 | denser journeys; Navvies, Railcrawlers, Mourners and Signalmen board; station rosters fill in |
| III — Wrong Side of the Tracks | 17:00–25:00 | heavy journeys, Navvies the biggest share; the stations' specialists (Pallbearers, Slag Golems, Hounds, Watchers); elites |
| IV — The End of the Line | 25:00–35:00 | E opens for everyone; the Collected and the Ticket Punchers; the last train; the phantom doors; the Night Express; after it, the victory lap |

If the Night Express falls before dawn, the victory lap until dawn is the heavy end of the line (D-84): Navvies
20, Ticketless 28, Porters, Gravebound, the Collected, Railcrawlers, Coalborn, Still Folk, at hp ×1.25. The last
minute before dawn (34:00, now the final boss's minute) is the same heavy crowd at the stations the boss isn't
quieting. Both were mostly Ticketless (9 hp), and the night died with its boss. In a god-mode bot night (seed
7), the crowd standing after the boss carried about 125–218k hp (it was 13–19k), about what stood in the minutes
before the boss.

Seven scheduled bosses (D-90; the other maps have four) at 5:00, 10:00, 15:00, 20:00, 25:00, **30:00** (the
Unclaimed, new in D-90, so the second half isn't ten minutes without one) and **34:00** (the Night Express, the
final boss, which holds the dawn at 35:00; it was at 30:00). **The final boss waits for every other boss:** it
comes only once each of the six has been fought and beaten, wherever the party left one, and until then the
clock stops at 34:59. Getting to the End of the Line early (the egg) changes nothing about that: the bosses keep
their times, and the Night Express and the Conductor come only after them. Secret boss: the Conductor (Easter
egg), after the Night Express. Events: `gt_fog` (darkness,
Still Folk at stations), `gt_rush_hour` (spawns and tickets +50 %), `gt_lost_luggage` (a guarded trunk on the
platform, or an unguarded one in the baggage car if you're riding), `gt_procession` (mourners and
pallbearers cross a station down a marked lane), `gt_late_supper` (healing plates near you, or in the dining
car). None of them puts a creature anywhere but a station, so the train's rule holds.

## 6. Enemies (21 new types + a miniboss; no reuse)

`data/enemies.ts` (`gt_*`), behaviours in `sim/ghostTrainAI.ts`, sculpts in `render3d/models/ghostTrainCreatures.ts`,
Pedia art in `render/art/ghostTrainArt.ts`. Homes: **train** = boards the moving train; **any** = every
station; or a station's own.

| Creature | Role | Home |
|---|---|---|
| The Ticketless | the shambling crowd | any, train |
| Coalborn | fast fodder; embers on death | cinder, train |
| The Porter | trunk-shield bruiser (soaks frontal damage) | junction, train |
| The Navvy (D-84) | juggernaut: a wall of a man with a sledgehammer on his shoulder; no tricks, 340 hp, barely shoved, hurries when far off | any, train |
| Railcrawler | wall-crawling pouncer | train, cinder |
| Mourning Passenger | wailing ring caster | vesper, train |
| The Signalman | lantern lane-caster | junction, train |
| Clockwork Commuter | marching lancers | junction |
| Newsboy Specter | paper-bundle thrower | junction, stillwater |
| Luggage Mimic | ambush hopper | train, junction |
| Gravebound | rises from the ground | vesper, end |
| Shroud Moth | swarm (replaces the balloon drift) | any |
| The Pallbearers | slow coffin-slam tank; releases mourners | vesper |
| Slag Golem | molten pools | cinder |
| Riveter | rivet volleys | cinder |
| Furnace Hound | charging lane, fire trail | cinder |
| Still Folk | stop-motion sprinters | stillwater |
| The Watcher | stationary gaze caster | stillwater, end |
| Bell Wraith | phasing tolls | vesper, stillwater |
| The Collected | fused mass; splits | end, train |
| The Ticket Puncher | punch-mark lunger | end, train |
| The Ticket Inspector | miniboss (chest) | any station |

## 7. Bosses

| Gate | Boss | Signature attacks |
|---|---|---|
| 5:00 | The Stationmaster | Mind the Gap (phantom trains down lanes), whistle cone, lantern beams, the timetable dial, porters, the express charge |
| 10:00 | The Stoker | lobbed coal (embers), furnace blast, fire-trail charge, heat rings, cinder rain, Coalborn, boiler burst |
| 15:00 | The Widow of Saint Vesper's | wail rings, soul lights, veil sweeps, the dead rise, a cross of lilies, the procession |
| 20:00 | The Iron Foreman | steam hammer + shockwave, rivet fans, chain sweep, girders, steam vents, riveters, slag pools |
| 25:00 | The Hour Thief | clock hands, chimes on a dial, pendulum, stopped time, the rewind, thirteen strikes |
| 30:00 | The Unclaimed (D-90) | a heap of lost luggage on umbrella legs: thrown cases, an umbrella fan, the trunk-lid slam, avalanche lanes, mimics and Ticketless out of its pile, the claim leap, rings of luggage tags with a gap; phases Left Luggage → Excess Baggage → Lost and Found |
| 34:00 | The Night Express | runs down lanes, whistle shockwave, cinders, phantom carriages, firebox breath, passengers put off; **only after every other boss has fallen** |
| secret | The Conductor | punches under each of you, ticket spirals, lantern beams, "All aboard" pull, terminus (only near him is safe) |

## 8. Rendering (`render3d/world/ghosttrain/`)

- `floor.ts`: one shader, a mesh per place: track beds, platforms, the Junction's tiles and cobbles, the
  churchyard, the cinder yard and its tub rails (D-90: dark iron on sleepers, and the ladle's spur up to the
  platform), the village lanes and the still pond, the End's cracked
  marble and the brink; the moving train's conveyor (scrolling track, each leg's country, the drop on the
  bridge).
- `kit.ts`: every station fixture and building, and the carriages' furniture.
- `train.ts`: the train in every place (one merged model instanced per copy), roofs cut away over the copy
  you're in, sliding doors, station copies sliding in and out as the train comes and goes.
- `scenery.ts`: the conveyor's scenery, the quest signal, the bridge truss, the platforms sliding in and out.
- `lighting.ts`: every pool from a visible fixture; the carriages' sconces; the headlamp.
- `quest.ts`: the quest's fixtures (clock hands, the brass key, the sleeper's compartment doors and pages, the
  grave lamps, candles and the tomb's vigil, the crucible and the ladle, Stillwater's frozen villagers, the
  jetty and the pendulum, the battery, passengers, the gauge, the phantom doors…). The frozen villagers are
  the Still Folk, Newsboy and Signalman sculpts held in one frame of a clip (`GameRenderer3D.figure`, D-90).
- Bosses: `render3d/ghostTrainBosses.ts`.

## 9. Audio

Music (`gt_act1–4`, `gt_endless`): Bradley's second song, "CircularCus" (`public/audio/circular_cus.mp3`,
D-81), from its first note, again from the top after a 1 s rest at its end; boss fights keep "Freaky Funk
Circus" played through, and the night's song comes back from the top after it. The procedural railway waltz
(the clack of the rail joints, a whistle far down the line) stands in only if the song can't load. Two
ambience beds crossfading as you board and
alight (the stations' night: wind, wires, a clock, a far bell; the carriages: the wheels' clack quickening
with the train, the body's creak). The train's sounds are read off the train's state each frame (bell, whistle,
doors, chuffs, brakes, the bridge), so a guest hears exactly what the host does.

## 10. Testing and tools

- `tests/ghosttrain.test.ts`: the registry (seven bosses), the whistle (the train waits, goes 4 s after a pull
  only with someone aboard, the recall, E on the route, the terminus, its net bytes), transfers, the sealed
  train, nobody stuck in the train, journey spawns (out of sight or over the ends), station homes, a boss
  quieting only its own station, bosses following, the final boss held until every other has fallen, the
  Unclaimed's phases, the phantom doors, the signal lamp, the quest played through, co-op bytes, the save.
- `scripts/gt_smoke.ts [secs] [stay]` runs a headless night with a bot that fights at each station for `stay`
  seconds, walks into the tender, pulls the cord and rides on. `scripts/gt_bossttk.ts [seeds]` times every boss
  against builds. (`scripts/gt_timetable.ts` went with the timetable.)
- Dev states (`?devtools` / dev server): `gt-junction`, `gt-vesper`, `gt-cinder`, `gt-stillwater`, `gt-end`,
  `gt-tender`, `gt-baggage`, `gt-coach`, `gt-dining`, `gt-funeral`, `gt-sleeper`, `gt-observation`,
  `gt-arriving`, `gt-boss-*` (now with `gt-boss-unclaimed`). They put the train where they need it
  (`placeTrain`). `?unlock=ghosttrain` opens the map on a save.

## 11. Known limitations (honest list)

- The station nameboards and the departures board carry no lettering yet (the HUD line and "Look at the
  station clock" carry the information). The booking office (TICKETS), the signal box and the Junction's
  fingerpost are lettered (D-84).
- D-90's whistle-driven train, the seven-boss night and the reworked egg are checked by unit tests, a whistle
  bot and captures of every new fixture, not by a human play-through or a co-op session across machines yet.
  A party that never whistles stays where it is: the night still runs on its clock and the bosses come to the
  station they stand at.
- The D-84 balance (journeys, Navvies, the late crowd, the victory lap) is checked by unit tests and the
  bot runs, not yet by a human play-through; expect a nudge or two.
- Creature sculpts are new but simpler than the Boardwalk's hero creatures; several share the humanoid base.
- The approaching train at a station slides in along its track; its wheels are not animated (hidden below
  the car floor at this camera angle), and the locomotive's smoke is spark particles, not a volumetric plume.
- Bot balance runs cover the bosses' time-to-kill and a ridden night; long human play-testing of the
  35-minute arc (especially co-op splits across stations) is still needed.
- The first Ghost Train night of a session freezes the game 12–15 s while the map's world is built (0.4 s
  after that). Co-op rides it out since D-82, unless a guest's build takes 10 s longer than the host's (then
  Rejoin).
