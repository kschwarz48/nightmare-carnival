# The Last Song — full solution (developer-only)

> **Spoilers. Developer-facing only.** Nothing in the menus, HUD, Pedia or loading tips reveals any
> of this; the player learns it from Zoltana's fortunes, sounds and the world itself. Keep this file
> out of any player-facing build or store copy. Design rationale: D-32 in `DESIGN_DECISIONS.md`.

Code: `src/sim/quest/lastSong.ts` (state machine), `src/data/quests.ts` (positions, tuning,
fortune texts), presentation through `quest` bus cues handled in `src/app.ts` (`onQuest`) and the
world reactions in `src/render3d/world/props.ts` / `src/render3d/bosses.ts`. Map: Carnival Core only.

## Stages at a glance

| # | Stage | Goal | Mechanic |
|---|---|---|---|
| 0 | DORMANT | Wake Zoltana | positional (visit) |
| 1 | SOULS | Light the four ghost lamps | positional combat (kills near lamps) |
| 2 | MELODY | Touch the lit lamps in the song's order | observation + audio |
| 3 | CALLING | Return to Zoltana | positional (visit) |
| 4 | STRIKER | Ring the High Striker three times | timing window |
| 5 | CARRYING | Beat the Ringmaster while the Ghost Ticket follows you | boss-linked condition |
| 6 | FINALE | Defeat the secret Calliope | boss fight |
| 7 | COMPLETE | True dawn, achievement, permanent unlock | — |

## Step by step

### 0 → 1 · Wake Zoltana
Zoltana is the fortune-telling automaton beside Madame Zelda's caravan in the south-west, at
**(-1440, 1050)** (sim coordinates; y grows south). Walk within **120** units of her. She lights up,
an awaken cue plays and she prints: *"Four lamps went dark the night the music died. Feed them the
restless, and they will remember the song."* The four **ghost lamps** (lamp posts with green-tinted
glass and a small skull keystone) wake.

### 1 → 2 · Feed the four ghost lamps
Each kill within **240** units of an unlit ghost lamp feeds the *nearest* such lamp one soul (a soul cue
plays and the lamp's dark glass fills with ghost-light). **14 souls** light a lamp; it then burns
steady green and sings its note.

| Lamp | Emblem | Position | Note |
|---|---|---|---|
| North-west | moon | (-1650, -1000) | G4 392.00 Hz |
| North-east | key | (1650, -1000) | B♭4 466.16 Hz |
| South-east | eye | (1300, 850) | C5 523.25 Hz |
| West | crown | (-1500, 650) | E♭5 622.25 Hz |

When all four are lit the dead **carousel** (west, (-990, -150)) lurches into motion.

### 2 → 3 · Play the melody
The song order is **shuffled per run** from the run seed on a separate RNG stream
(`seed ^ 0x5eed1931`), so it differs every night but never changes gameplay randomness. Two ways
to learn it:

* **Listen:** within **950** units of the carousel its music box plays the four lamp notes in order
  every **7.5 s**.
* **Look:** the carousel canopy carries plaques. Starting from the **brass skull**, the next four
  plaques show the lamp emblems in the night's order (moon/key/eye/crown); stars fill the rest.

Walk into each lit lamp (within **85** units) in that order. Each touch sings the lamp's note. A
right note turns the lamp **red** (and it sends up a glowing wisp of its emblem, the same one painted
on the carousel), and it can't be triggered again; a whisper says *"The note rings
true — one of four"* (two, three). A wrong (still green) lamp plays a sour chord, whispers *"The melody
falters — begin again"* and resets the song: every lamp goes back to green. After the fourth correct
lamp the stage advances and Zoltana calls; the lamps stay red and silent for the rest of the night.

### 3 → 4 · Return to Zoltana
Visit her again: *"The song is sung, but the bell is mute. Strike when the light kisses the crown —
thrice, as it was in thirty-one."*

### 4 → 5 · Ring the High Striker
The High Striker tower is north of the midway at (520, -1560); its pad is at **(520, -1488)**,
radius **52**. The puck light rides up and down the rail continuously (a **2.4 s** triangle wave).
Step onto the pad while the light is in the top **17%** of its travel (near the bell) — the bell
rings. Step off at least **95** units to re-arm, then step on again. **Three rings** complete the
stage. A miss just clunks (no penalty). Outside this stage the striker is a toy (it rings, nothing
answers).

### 5 → 6 · Carry the Ghost Ticket into the last show
A **Ghost Ticket** now floats after the player for the rest of the night. Keep playing until the
**Ringmaster** (24:00) and defeat him while carrying it. Instead of the victory lap, the dawn is
refused: after **4 s** the secret **Calliope** rises where the Big Top stood, at (0, -40).

### 6 → 7 · Defeat the Calliope
A full boss fight (phases, pipe volleys). Defeating it: true dawn (`trueEnding`), the achievement
`last_song`, and the permanent unlock of the secret evolution weapon **Steam Calliope**
(`w_calliope`, `SECRET_UNLOCKS` in `data/meta.ts`). The results screen shows "THE LAST SONG".

## Failure and edge cases

* **Dying or quitting** resets the chain (run state only). There is no failure state inside a night
  besides the sour reset in the melody stage.
* **Ringmaster defeated before the ticket**: the chain cannot reach the finale that night.
* **Endless mode**: completing the Calliope does not force the clock to dawn (`g.endless`).
* Touches and visits are **edge-triggered** with hysteresis, so standing still never spams cues.

## Persistence

`save.quests.last_song = { completions, bestStage }` (save v4, migration 3→4). The unlock and the
achievement are permanent; quest progress itself resets every night by design. Completing the chain
increments `completions` (passed to new runs as `questMemory`).

## Tests and debugging

`tests/overhaul.test.ts › the Last Song (D-32)` solves the full chain deterministically (wake,
souls, melody in the seeded order, striker timing, ringmaster with ticket, Calliope). Use it as the
reference when changing tuning in `data/quests.ts`. During development, `window.__nc` (dev builds
only) can jump time and spawn bosses; the quest state is `app.game.quests.get('last_song')`.

## Extending

Chains are registered per map id (`registerQuestChains` in `src/sim/quest/`). A new map's chain
subclasses `QuestChain`, receives `update / onKill / onBossDefeated`, and talks to presentation
only through `cue(name, payload)`. Keep solutions out of player-facing text.
