# The Unreflected — full solution (developer-only)

> **Spoilers. Developer-facing only.** Nothing in the menus, HUD, Pedia or loading tips reveals any of
> this. Players learn it from what the house shows them (reflections, the mural, the music box, the
> beam, the clocks) and from Mira's whispers. Keep this file out of any player-facing build or store
> copy. Design rationale: D-63 in `DESIGN_DECISIONS.md`; the map itself: `FUN_HOUSE.md`.

Code:
- `src/sim/quest/unreflected.ts`: the state machine, co-op sync bytes and the boss hand-off.
- `src/data/funhouse.ts` (`UNREFLECTED`, `MIRA`, `beamTrace`, `mirroredTime`): positions, tuning,
  whispers, the beam and the clock maths.
- `src/render3d/world/funhouse/quest.ts`: everything the quest changes in the world.
- `src/app.ts` (`onUnreflected`): whispers, music-box notes, glass, clocks, the unlock.
- `src/sim/bosses/unreflected.ts`: the secret boss.

Map: the Fun House only.

Coordinates are sim units. x grows east and y grows south. The camera looks north, so only
south-facing surfaces are seen face-on, and every fixture below sits where it can be seen.

## Stages at a glance

| # | Stage | Goal | Mechanic |
|---|---|---|---|
| 0 | DORMANT | Pick up the cracked hand mirror | positional (visit) |
| 1 | FACES | Free the four faces hiding in the maze's mirrors | exploration + reflections |
| 2 | MURAL | Read the anamorphic mural from its brass footprints | observation (hold 2 s) |
| 3 | OVERTURE | Touch the four plinths in the mural's order | sequence + audio |
| 4 | PROJECTOR | Keep someone beside the prism projector for 30 s | hold the zone under pressure |
| 5 | BEAM | Turn four pivot mirrors to lead the beam to the crystal | spatial puzzle |
| 6 | VANITY | Read Mira's mirrored clock; stand at the clock that truly shows it | riddle + search |
| 7 | CARRYING | Beat the Proprietor while Mira's Reflection follows you | boss-linked condition |
| 8 | FINALE | Defeat the secret Unreflected | boss fight |
| 9 | COMPLETE | The Fun House's True Dawn, achievement, permanent unlock | — |

The Last Song (Map 1) has six steps between dormant and complete, one of them a fight. The
Unreflected has nine. Each takes more attention: reflections, an anamorphic picture, a four-part
spatial puzzle, and a riddle with a trap answer. That makes it about twice as deep.

## Step by step

### 0 → 1 · The hand mirror
A cracked hand mirror lies on the **Lost & Found counter** in the Grand Entrance, west of the red
carpet, at **(-760, 1250)**. It glints every couple of seconds. Walk within **90** units of the counter.

You hear a glint and a cold shimmer. Mira's first whisper: *"A cracked hand mirror. In it, a girl stands
just behind your shoulder. 'Find us in the glass.'"*

The mirror isn't shown after that: the whole party is cursed to see what the glass keeps.

### 1 → 2 · The four faces
Four of the maze's south-facing mirror panels each keep a performer's face. When anyone comes within
**320** of a face's spot, the face fades into that mirror's reflection, looking out. It lives on the
mirror-only render layer: it is in the glass, not in the room. A faint pale smudge also shows on the
glass itself, so low quality, which has no live reflections, still shows the clue. The first face seen
whispers *"A face in the glass that isn't yours."*

Touch the glass where a face looks out: stand within **100** of its spot. That frees it with a chime in
the performer's note and a ripple, and their head reappears on their dress form in the Puppet Gallery.

| Performer | Panel (row, col) | Glass at | Stand at |
|---|---|---|---|
| The Strongman | south side of cell (0, 1) | y = -900 | **(-2025, -847)** |
| The Ballerina | south side of cell (3, 2) | y = -675 | **(-1335, -622)** |
| The Clown | south side of cell (1, 7) | y = 450 | **(-1795, 502)** |
| The Magician | south side of cell (4, 7) | y = 450 | **(-1105, 502)** |

Cells are (column, row) of the 6×10 maze: x0 -2140, y0 -1350, 230×225 per cell. Any order works.
When all four are free: *"Four faces, home on their plinths. The painter saw them take their bows. Stand
where the painter stood."*

### 2 → 3 · The anamorphic mural
In the Chamber of Illusions, between the stage and the benches, four performer emblems are painted on
the floor around **(950, -1700)**. All night they are a vertical smear. Once the faces are free, the
brass footprints at **(950, -1580)** glow. The closer anyone gets to them, the more the smear pulls
together.

Stand within **60** of the footprints for **2 s** (stepping off resets the hold). The picture snaps
into a crisp row of four emblems and stays crisp for the rest of the night. The music box plays the four
notes in that order. Whisper: *"From the brass footprints, the smear becomes a picture: the performers,
in the order they bowed."*

The order is **per run** (seeded) and reads **west to east**. Emblems:

| Emblem | Performer | Colour |
|---|---|---|
| dumbbell | Strongman | orange |
| a head over a tutu | Ballerina | pink |
| a face with a red nose over a ruff | Clown | white |
| top hat | Magician | violet |

### 3 → 4 · The overture
The four plinths in the Puppet Gallery stand west to east:

- Strongman **(-1850, -2000)**
- Ballerina **(-1550, -2000)**
- Clown **(-1250, -2000)**
- Magician **(-950, -2000)**

Touch them in the mural's order. A touch is walking within **95** of a plinth; it's edge-triggered,
so step away before touching it again.

- **Right plinth:** its note plays, its ring glows, and you hear *"The music box answers: one of four…"*.
- **Wrong plinth:** the music box grinds to a stop with a sour note, and the overture restarts from the
  first performer.

Four right: *"The overture plays. Behind the gallery's great curtain, something with a lens wakes up."*

| Performer | Note |
|---|---|
| Strongman | C5 523 Hz |
| Ballerina | E5 659 Hz |
| Clown | G5 784 Hz |
| Magician | B5 988 Hz |

### 4 → 5 · The projector
The gallery's great curtain parts on a brass prism projector at **(-1335, -1580)**, aimed south through
the gallery's maze door. While anyone stands within **150** of it, its charge rises 1 per second. It
falls 0.5 per second when nobody is there. A ring of ten warm-up bulbs around it lights one bulb per
3 s, and the lamp brightens.

At **30** the projector fires.

This is the quest's pressure stage: half a minute in one place while the night keeps coming. A
partner can hold the zone, but nobody has to stand there with you.

### 5 → 6 · The beam
The beam runs south down maze **column 3** and stops at the first thing that doesn't turn it.

Four **pivot mirrors** stand on round plates in the north part of four cells. Their cells have glass on
the south side, which hides the south part from the camera. Standing within **70** of a plate turns its
mirror one notch every **1.25 s**, for as long as you stay. The states cycle:

| State | Mirror | Beam |
|---|---|---|
| 0 | `\|` (edge-on) | stops |
| 1 | `/` | turns |
| 2 | `—` (edge-on) | stops |
| 3 | `\` | turns |

| Pivot | Cell | Plate at | Solution |
|---|---|---|---|
| A | (3, 2) | **(-1335, -847)** | `\` (3): south → east |
| B | (5, 2) | **(-875, -847)** | `\` (3): east → south |
| C | (5, 7) | **(-875, 277)** | `/` (1): south → west |
| D | (2, 7) | **(-1565, 277)** | `\` (3): west → north |

From D the beam runs north up **column 2** to the Heart's crystal at **(-1565, -260)**. The beam is
always drawn, so the puzzle is followed one mirror at a time.

Starting states are **per run** (seeded), and every pivot starts wrong (tested for many seeds).

When the beam reaches the crystal:
- the crystal blazes;
- the Heart's north glass (the two panels at y = -450, x -1910 to -1450) turns to rippling water, and
  you can walk through it;
- Mira whispers *"You found my room."*

### 6 → 7 · The vanity and the clocks
Mira's dressing room is cells (1–2, 3). Inside, her vanity at **(-1680, -629)** shows a small clock with
backwards ticks, drawn mirrored. Stand within **95** of **(-1680, -589)**. Whisper: *"The hour he took
me. Read it the way the glass does. One clock in the house still shows it."*

The house has four stopped clocks. Their times are **per run**:

| Clock | On | Stand at (hold 2 s, within 90) |
|---|---|---|
| Entrance | the Grand Entrance's north wall | **(900, 1005)** |
| Rotunda | the Rotunda's north wall | **(-115, -1252)** |
| Corridor | the south face of the Crooked Corridor's middle baffle | **(2000, -135)** |
| Chamber | the Chamber of Illusions' north wall | **(1700, -2042)** |

The vanity shows the **true hour as a mirror shows it**, so it reads as the mirror image of the true
hour. The true hour is the vanity's reading flipped left to right: 2:50 reads 9:10, and 5:50 reads 6:10.
`mirroredTime` maps h:m to (12·60 − (h·60 + m)) mod 720.

- **The true clock** shows the true hour. It is the answer.
- **The trap** shows the vanity's face-value reading. Exactly one clock does.
- **The other two** show unrelated times.

The true hour is never one a mirror leaves unchanged (6:00, 12:00).

- **Wrong clock:** *"Not that hour."* and the house laughs. Step more than 90 away and try another.
- **Right clock:** three tolls, and Mira's Reflection appears.

### 7 → 8 · Carrying Mira
Mira's Reflection, a small glass girl, drifts at the shoulder of whoever struck the clock: *"Mira's
Reflection follows you. 'Take me to him.'"*

If her carrier is downed, she goes to the nearest player still standing.

Defeat **the scheduled Proprietor** (24:00) while she follows. Instead of the dawn:
- the house shatters (a banner, glass, shake and flash);
- the dawn is held with *"THE GLASS HOLDS THE DAWN…"* (`g.finaleActive`);
- **4 s** later the Unreflected rises at the Rotunda's heart, **(0, -5)**.

### 8 → 9 · The Unreflected
The secret boss: 64,000 HP, three phases.
- **The Other Side.** Every attack also comes from its reflection across the target: shard fans,
  palms under you and under your mirror image, and stepping through to its own reflection.
- **Every Face.** Homing masks, mirror walls sliding together from both sides (one gap in each), and
  kaleidoscope beams from it and its reflection.
- **No Reflection.** It fades to a shimmer, with an outline at every opacity, and bursts in gapped
  rings.

Defeating it:
- **True Dawn** (`g.trueEnding`; the results title reads *THE UNREFLECTED*);
- achievement **Through the Looking Glass** (`unreflected`, 400 tickets);
- the permanent unlock **Mira's Hand Mirror** (`p_hand_mirror`), a passive giving +6% Might and +6%
  Area per level, max 5, added to the draft pool;
- `quests.unreflected.completions` goes up in the save.

## Rules, co-op and recovery
- **One shared chain.** The host runs it. Any standing player can act at every step. Nothing ever needs
  two players at once: every hold and touch counts any single player.
- **Guests** receive the whole chain every snapshot as 17 bytes (`netState` / `applyNet`): stage, freed
  faces, order, overture progress, charge, pivot states, mural/vanity seen, true clock, carrier, and the
  four clock times. Their worlds draw the same house.
- **Nothing breaks permanently within a night.**
  - A wrong plinth restarts the overture.
  - A wrong clock just laughs.
  - The projector only cools.
  - The pivots cycle.
- **One way to miss the finale.** If the Proprietor falls before Mira is following someone, the night
  ends at the ordinary dawn and the chain stops at its stage. Progress is not carried between nights;
  the save remembers only the best stage reached.
- **Endless and dailies.** Endless encores don't count (the finale needs the scheduled Proprietor), and
  Daily Runs are always on the Carnival Core.
- **Timing.** Solo, knowing the solution, the chain takes roughly 8–10 minutes of a 25-minute night.
  The projector hold and the walking are most of it.

## Testing and debugging
- `tests/unreflected.test.ts` covers:
  - the clock maths;
  - the beam solution, and edge-on mirrors stopping it;
  - per-seed fairness (40 seeds): unsolved starts, one true clock, one trap, varied orders;
  - a solo walk through every stage to the True Dawn, including a wrong plinth, a wrong clock, the
    projector cooling, and the door opening in the walls;
  - the Proprietor without Mira (an ordinary dawn);
  - co-op: a guest acting alone, Mira passing on, and the full chain arriving through a real snapshot.
- In the dev build:
  - `?unlock=funhouse` opens the map.
  - `__nc.shot({ restart: true, map: 'fun_house' })` starts a night.
  - `__nc.app.game.quests.get('unreflected')` is the live chain. Its fields (`stage`, `freed`,
    `pivots`, `charge`, …) can be set to jump to any stage for visual checks.
