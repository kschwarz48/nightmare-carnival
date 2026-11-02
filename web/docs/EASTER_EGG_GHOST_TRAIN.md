# The Last Train Home — full solution (developer-only)

> **Spoilers. Developer-facing only.** Nothing in the menus, HUD, Pedia or loading tips reveals any of
> this. Players learn it from the world: the booking clerk's hints, the stopped clocks and what each says it
> needs, the torn and mended timetable, the signal at danger, the four lost passengers on the End of the
> Line's platform and their tickets. Keep this file out of any player-facing build.
> Map design: `GHOST_TRAIN.md`. Decision record: D-80, reworked in D-90, in `DESIGN_DECISIONS.md`.

Code:
- `src/sim/quest/lastTrain.ts`: the state machine, the mending of each station's clock, the signal, the co-op
  bytes (including `eFrom`, which puts the End of the Line on the train's route) and the boss hand-offs.
- `src/data/lastTrain.ts`: `LAST_TRAIN` (reach, timings, tuning), `MOMENTS` and `LT_TEXT` (every line it says).
- `src/data/gtStations.ts`: where everything stands (`JUNCTION`, `VESPER`, `CINDER`, `STILLWATER`, `END`,
  `STATION_CLOCK`, D-90's `LT_KEY_SPOTS`, `LT_VESPER`, `LT_WORKS`, `LT_STILL`, and `LT_TRAIN`: the fixtures in the
  carriages, in the train's own frame).
- `src/render3d/world/ghosttrain/quest.ts`: everything the quest changes in the world.
- `src/app.ts`: `onLastTrain` (whispers, cards, bells, whistles, the unlock).
- `src/sim/bosses/conductor.ts`: the secret boss.

Tests: `tests/ghosttrain.test.ts` (the whole chain played through solo inside the night; each clock's trouble
asked for before it can be wound; the signal lamp; the signal missed and run on as usual; the co-op bytes).

## The story

In 1899 the railway man **Silas Marrow** opened the Midnight Line, the railway that ran between every
carnival in the game and carried the crowds home. It failed. He bargained with the same patron as every
other owner (the Boardwalk's ledger names the accounts): the line would never stop running, and in return
**its last train of every night would not go home** but to **the End of the Line**, its passengers the
payment. Marrow himself became **the Conductor**, punching their tickets forever.

Every clock on the line stopped the hour the bargain was struck. Every map's lost souls ride the line. Four
of them wait on the End of the Line's platform, and the quest is to get them home: **Ada Penhallow** (the
Boardwalk), **Theo Fairweather** (the boy who played the calliope, the Carnival Core), **Mira** (the Fun
House) and **Eli Marrow**, Silas's own son.

## Stages at a glance

Since D-90 the train goes at the whistle (the cord at the front of the tender), so the quest is a journey down
the line. Nothing is on a timetable; the only timed things are the taper, the vigil, the ladle, the moments,
the reel and the signal, and none of them fails anything if missed.

| # | Stage | Where | What |
|---|---|---|---|
| 0 | Ticket | Hollow Junction, booking office window | **Ask at the booking office**: a ticket for THE LAST TRAIN HOME, "not valid until the line keeps time". Every clock has stopped |
| 1 | Key | about the Junction (one of five places, seeded) | the station clocks' **brass winding key**: under a waiting bench, at the dry fountain's rim, beside the hearse, on a luggage pile, under the water tower. A glint catches the eye now and then. The stopped clock says the key is gone |
| 2 | Junction | the Junction's platform clock | **wind it while the train stands in** (the key's carrier). Aboard, in the sleeper (the second car from the back), the four **compartment doors** slide open, and the card says to gather the pages inside |
| 3 | Pages | the sleeper's four compartments (any copy of the train) | a torn timetable page drifts in each (one of two places each, seeded). With all four: THE LAST TRAIN HOME calls where each station's clock keeps time, goes at the guard's whistle, and the footnote gives tonight's three **levers** |
| 4 | Stations | Saint Vesper's, the Cinder Works, Stillwater (any order) | each station's clock has its own trouble (below). Look at the clock and it says what it needs; once mended, the key's carrier winds it. The whistle takes you on |
| 5 | Prepare | back at the Junction | take the **signal battery** from the lamp room under the signal box, fit it to the train's **lamp box** at the front of the tender (the train's signal lamp burns red), and pull the signal box's **levers in the footnote's order** (3 of 5; a wrong one springs them all back). Either order |
| 6 | Signal | aboard, on any journey | a signal stands at danger part-way along (seeded per journey, 30–70 % of the leg). The call-out comes 2.5 s ahead; **switch the lamp box to green** (green for 3 s) as the engine passes it: the points swing over and **this journey goes to the End of the Line**. Missed, the train runs on to its usual stop and the signal stands again on the next journey |
| 7 | Punch | the End of the Line, ticket box at the barrier | take the Conductor's spare punch (carried) |
| 8 | Passengers | the End of the Line's platform | **while the train stands there**, the punch's carrier punches the four passengers' tickets; they board |
| 9 | Deliveries | along the line | four errands, any order (below) |
| 10 | Last ticket | the End of the Line, ticket box | **while a train stands there**, punch your own ticket |
| 11 | Express | the End of the Line | defeat the Night Express (the final boss: 34:00, and only once every other boss of the night has fallen) |
| 12 | Finale | the End of the Line | 7 s later the Conductor steps out of the dark: defeat him |
| 13 | Homeward | | 14 s: the last train home pulls out, every window lit |
| 14 | Complete | | the true dawn, the achievement **The Last Train Home**, the Conductor's Punch unlocked |

### The stations' clocks (stage 4)

- **Saint Vesper's** (graveyard): *"Light the three grave lamps with a taper from the altar candles by the chapel
  porch, before the taper burns down."* The candles stand on an iron stand beside the chapel's porch (south face). A taper burns
  **26 s** and goes out if its carrier falls; light another. The three grave lamps hang from iron crooks between
  headstones: in the west graves toward the west mausoleum, in the north-east graves by the east mausoleum, and
  in the south graves toward the chapel. Each
  lit lamp stays lit. Then *"keep watch at the empty grave"*: the open chest tomb where the paths cross. Stand
  within its ring (r 170) for **30 s** in all (it slips back slowly while nobody keeps it) while the dead rise
  round it (Gravebound, Mourners). The chapel bell tolls once by itself; wind the clock.
- **The Cinder Works** (foundry): *"Its great brass wheel is cracked through. Bring the brass cogs lying about the
  yard to the crucible by the west furnace: three of them will cast a new wheel."* Three brass cogs lie at three
  of five places about the yard (seeded), each glinting in a warm pool of light (D-91: bigger, tipped up to face
  the camera, and still shown while another is being carried). Carry them one at a time to the crucible. With three, a **ladle of molten brass** waits on the tub
  rails by the crucible: it rolls along them (north from the crucible, east along the cross rails, then up the
  spur to the platform under the clock) **only while somebody walks beside it** (within 150), 46 units a second,
  about 38 s in all, with Coalborn, Riveters and Furnace Hounds coming at it. It pours a new wheel under the
  clock; wind it.
- **Stillwater** (the village where time stopped): *"Three moments the village is frozen in: stand in each until
  it moves again."* Three villagers stand frozen mid-step, frost-pale, a ring round each: **the woman at the
  well**, **the boy with the kite** (by the market cross), **the signalman at his gate** (the west cottages). Stand
  in a ring for **8 s** to wake its moment (it slips back slowly while nobody does); Still Folk and Newsboys come
  out of the lanes. The woken villager takes the step it was stopped in and is gone. With all three, *"something
  glints at the bottom of the still pond"*: stand on the **jetty** at the pond's north-east edge for **12 s** to
  reel up the clock's **pendulum** (Still Folk and a Watcher), carry it to the platform clock and hang it, then
  wind it.

The Junction's clock (stage 2) is the fourth; with all four running, "The line keeps time" and stage 5 begins.

### The errands (stage 9)

- **Ada:** her letter lies on her table in the dining car (any copy). Take it; post it in the **Junction's
  post box** on the south edge of the platform.
- **Theo:** while the train stands at the **Cinder Works**, take a shovel of coal from the chute on the
  platform beside the tender, carry it into the tender and shovel it into the firebox. Three times. Then on
  **any** journey, stoke the firebox three times **while the boiler gauge's needle is at the top** (the gauge
  is drawn on the tender floor; period 2.4 s, the green band is the top 16 %). A stoke outside the green
  resets the count.
- **Mira:** while the train stands at **Stillwater**, turn the church clock's hands (each press moves the hour
  hand on one) to **tonight's hour**, given on the passengers' card (seeded, 1–11; the hand starts at 12).
- **Eli:** while the train stands at **Saint Vesper's**, ring the chapel's three bells (west, middle, east
  ropes in front of the porch, on the chapel's south face) in **tonight's order**, given on the card (seeded,
  never west-middle-east). A wrong bell resets. (D-90 moved the ropes' spots onto the porch, where the ropes
  hang; they had been on the north side, behind the chapel.)

## The route (expert, solo)

The train goes when you whistle, so the route is yours. Legs are 35 s (Stillwater to the Junction 60 s, passing
the End of the Line). A practised solo route, with rough times:

| Leg | About | Do |
|---|---|---|
| The Junction | 0:00–1:40 | Ticket; the key (check the five places); the train is in at 0:30: wind the clock; through the sleeper for the four pages; whistle |
| Saint Vesper's | 2:15–4:45 | Taper, three lamps (a fresh taper for the far west lamp), the vigil at the tomb, wind; whistle |
| The Cinder Works | 5:20–7:50 | Three brass to the crucible, walk the ladle to the clock, wind; whistle |
| Stillwater | 8:25–10:10 | Three moments, the jetty, the pendulum, wind; whistle (60 s to the Junction) |
| The Junction | 11:10–12:00 | The battery into the tender's lamp box, the levers from the footnote; whistle |
| The signal | 12:00–12:35 | Green at the call-out on the way to Saint Vesper's: the train goes to the End of the Line instead |
| The End of the Line | 12:35–13:30 | The punch, the four passengers (the train stands in); take Ada's letter from the dining car on the way back |
| Errands | 13:30–19:00 | J (post the letter) → V (Eli's bells) → C (Theo's coal, stokes on the way to S) → S (Mira's hour) → E (the last ticket) |
| The night | 19:00–35:00 | Every boss at its time (20:00, 25:00, 30:00 the Unclaimed), then the Night Express at 34:00 at the End of the Line, the Conductor, the last train home |

The bosses at 5:00, 10:00 and 15:00 come in the middle of this: each comes to the station you're at (or waits
for you at the next platform if you're riding), and is fought there before you go on.

Misses never fail the quest: a taper can be lit again, a vigil, a moment or the reel slips back slowly and goes
on, the ladle waits where it stopped, the signal stands again on the next journey. What ends it is the night:
if the Night Express falls before the last ticket is punched, the night ends as it always does. Without the
quest the End of the Line joins the route at 25:00 for everyone, and the last train terminates there on the
first arrival from 32:00.

**Reaching the End of the Line early changes nothing about the bosses.** Every boss keeps its time and comes to
the station the party is at; the Night Express (and with it the Conductor) comes only once all six others have
fallen, at 34:00 at the earliest, and the night's clock waits at 34:59 until then.

## Co-op

One shared chain, the host runs it; guests receive it as 51 bytes (`NET_BYTES`), including `eFrom` (two bytes,
a whole second). The train's own state rides the `gt_line` chain (12 bytes), so a guest's doors, HUD line and
route are the host's exactly. Any standing player can act; nothing needs two players at once, but the stations
reward a party: one keeps the vigil, the moments or the ladle company while the others hold the crowd off.
Carried things (the key, a taper, brass, the pendulum, the battery, the punch, Ada's letter, a shovel of coal)
pass to the nearest standing player if the carrier falls; a taper goes out instead.

D-90 replaced the old first half (pages anywhere aboard, the stations' clocks wound while the train stood in,
the battery and the train's lamp shown green at every signal of a loop, then the points and a whistle on the
bridge) with the key, the compartments and each station's own trouble, and one signal shown green to take the
train to the End of the Line. The signal lamp (D-84) is kept: a lamp that is dark, then red, then green on a
press, and a call-out to press it.

## Hints

The booking clerk answers at every stage before the finale (stand at the booking office window, interact):
one line per stage, plainer than the world's clues. `LT_TEXT.hint` has them.
