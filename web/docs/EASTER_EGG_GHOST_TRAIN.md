# The Last Train Home — full solution (developer-only)

> **Spoilers. Developer-facing only.** Nothing in the menus, HUD, Pedia or loading tips reveals any of
> this. Players learn it from the world: the booking clerk's hints, the torn and mended timetable, the
> stopped clocks, the signals at danger outside the windows, the four lost passengers on the End of the
> Line's platform and their tickets. Keep this file out of any player-facing build.
> Map design: `GHOST_TRAIN.md`. Decision record: D-80 in `DESIGN_DECISIONS.md`.

Code:
- `src/sim/quest/lastTrain.ts`: the state machine, the co-op bytes (including `eFrom`, which the timetable
  reads) and the boss hand-offs.
- `src/data/lastTrain.ts`: `LAST_TRAIN` (reach, windows, tuning) and `LT_TEXT` (every line it says).
- `src/data/gtStations.ts`: where everything stands (`JUNCTION`, `VESPER`, `CINDER`, `STILLWATER`, `END`,
  `STATION_CLOCK`, and `LT_TRAIN`: the fixtures in the carriages, in the train's own frame).
- `src/render3d/world/ghosttrain/quest.ts`: everything the quest changes in the world.
- `src/app.ts`: `onLastTrain` (whispers, cards, bells, whistles, the unlock).
- `src/sim/bosses/conductor.ts`: the secret boss.

Tests: `tests/ghosttrain.test.ts` (the whole chain played through solo inside the night; timing-bound steps
refused outside their moment and retried; the co-op bytes).

## The story

In 1899 the railway man **Silas Marrow** opened the Midnight Line, the railway that ran between every
carnival in the game and carried the crowds home. It failed. He bargained with the same patron as every
other owner (the Boardwalk's ledger names the accounts): the line would never stop running, and in return
**its last train of every night would not go home** but to **the End of the Line**, its passengers the
payment. Marrow himself became **the Conductor**, punching their tickets forever.

Every map's lost souls ride it. Four of them wait on the End of the Line's platform, and the quest is to get
them home: **Ada Penhallow** (the Boardwalk), **Theo Fairweather** (the boy who played the calliope, the
Carnival Core), **Mira** (the Fun House) and **Eli Marrow**, Silas's own son.

## Stages at a glance

| # | Stage | Where | When | What |
|---|---|---|---|---|
| 0 | Ticket | Hollow Junction, booking office window | any time | **Ask at the booking office**: an unpunched ticket |
| 1 | Pages | aboard (any copy of the carriages) | any time | four torn timetable pages: the baggage car, the dining car, Car 13, the sleeper (one of two spots each, seeded) |
| 2 | Clocks | each station's platform clock | **while its train is standing in** | Saint Vesper's, the Cinder Works, Stillwater (any order), then the Junction's |
| 3 | Lantern | the Junction, lamp room under the signal box | any time | take the guard's lantern (carried) |
| 4 | Signals | aboard, in the **tender** | **while a signal at danger is in sight** (≈4.5 s a journey) | the carrier shows the lantern; one signal per leg: J→V, V→C, C→S, Stillwater onward |
| 5 | Points | the Junction's signal box lever frame | any time | pull 3 of the 5 levers in the timetable footnote's order (a wrong lever resets) |
| 6 | Bridge | aboard, in the **tender** | **13–23 s into the leg Stillwater → End of the Line** | pull the whistle cord |
| 7 | Punch | the End of the Line, ticket box at the barrier | at the End of the Line | take the Conductor's spare punch (carried) |
| 8 | Passengers | the End of the Line's platform | **while the train stands there** | the punch carrier punches the four passengers' tickets; they board |
| 9 | Deliveries | along the line | see below | four errands, any order |
| 10 | Last ticket | the End of the Line, ticket box | **while a train stands there** | punch your own ticket |
| 11 | Express | the End of the Line | 30:00 | defeat the Night Express (the final boss) |
| 12 | Finale | the End of the Line | 7 s later | the Conductor: defeat him |
| 13 | Homeward | | 14 s | the last train home pulls out |
| 14 | Complete | | | the true dawn, the achievement **The Last Train Home** |

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
  ropes under the porch) in **tonight's order**, given on the card (seeded, never west-middle-east). A wrong
  bell resets.

## The route (expert, solo)

The timetable (`npx vite-node scripts/gt_timetable.ts [eFrom]`): the train reaches the Junction at 0:30 and
loops J (45 s) → 35 s → V (40 s) → 35 s → C (40 s) → 35 s → S (40 s) → 60 s through the End of the Line → J.
A loop is 5:30. Once the points are set, every departure from Stillwater runs to the End of the Line (50 s
stop) and back to the Junction (a 6:30 loop).

| Loop | Times | Do |
|---|---|---|
| 0 | 0:00–6:00 | Ticket at the Junction before the train comes in (0:30); pages aboard during the Junction stop and the J→V leg; clocks at V (1:50–2:30), C (3:05–3:45), S (4:20–5:00) |
| 1 | 6:00–11:30 | The Junction's clock and the lantern during the J stop (6:00–6:45); signals from the tender on J→V (6:45–7:20), V→C (8:00–8:35), C→S (9:15–9:50), S→J (10:30–11:30) |
| 2 | 11:30–17:25 | The points during the J stop (11:30–12:15); the bridge whistle on S→E (16:00–16:35); the punch and the four passengers at E (16:35–17:25) |
| 3 | 18:00–23:55 | Ada's letter (picked up on E→J, posted at J 18:00–18:45); Eli's bells at V (19:20–20:00); Theo's coal at C (20:35–21:15) and stokes on C→S (21:15–21:50); Mira's hour at S (21:50–22:30); the last ticket at E (23:05–23:55) |
| 4 | 24:30–29:35 | Slack: a whole loop to recover any miss (J 24:30, V 25:50, C 27:05, S 28:20); the last train terminates at E at 29:35 |
| End | 30:00– | The Night Express (30:00); the Conductor (about 32:30); the last train home (about 35:00) |

Misses never fail the quest: every timed step comes round again next loop. What ends it is the night.
Without the quest, the End of the Line is a stop only from the final act (25:00), and the last train
terminates there at 27:35; with the points set it terminates at 29:35.

## Co-op

One shared chain, the host runs it; guests receive it as 27 bytes, including `eFrom` (two bytes, a whole
second, so a guest's timetable and doors are the host's exactly). Any standing player can act; nothing
needs two players at once. Carried things (the lantern, the punch, Ada's letter, a shovel of coal) pass to
the nearest standing player if the carrier falls. Natural splits: one player rides in the tender for the
signals while another waits at a station; one fetches coal while another stokes.

## Hints

The booking clerk answers at every stage before the finale (stand at the booking office window, interact):
one line per stage, plainer than the world's clues. `LT_TEXT.hint` has them.
