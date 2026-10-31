# Summer's End — full solution (developer-only)

> **Spoilers. Developer-facing only.** Nothing in the menus, HUD, Pedia or loading tips reveals any of
> this. Players learn it from the world: the tide, the machines, the photograph, the wreck, the bells
> and lights, and Ada's whispers through the shells. Keep this file out of any player-facing build.
> Map design: `BOARDWALK.md`. Decision record: D-68 in `DESIGN_DECISIONS.md`.

Code:
- `src/sim/quest/summersEnd.ts`: the state machine, the co-op bytes and the boss hand-offs.
- `src/data/boardwalk.ts`: `SUMMERS_END` (positions and tuning), `KEEPSAKES` / `KEEPSAKE_GAME` and `ADA`
  (her lines).
- `src/render3d/world/boardwalk/quest.ts`: everything the quest changes in the world.
- `src/app.ts`: `onSummersEnd` (whispers, bells, horns, flashes, the unlock).
- `src/sim/bosses/leviathan.ts`: `holdsLeviathan` and `bind()`.
- `src/sim/bosses/commodore.ts`: the secret boss.

Tests: `tests/summersEnd.test.ts`.

## The story

In 1904 **Commodore Ezra Penhallow**, a whaler who came home alone from a voyage nobody else survived,
built a boardwalk on the beach where the sea had spared him. The crowds came because of what he had
promised in the cold water: **Old Mother Tide** would fill his park every summer, and every twenty-nine
summers he would *send out a boat*.

On the last night of August 1933 the excursion steamer **Gala Queen** left Penhallow Pier at 11:59 for the
Summer's End moonlight cruise with 213 guests aboard, among them a stowaway: the Commodore's daughter
**Ada**, nine years old, who wanted to see the moon on the water. The Gala Queen never came back. Her
guests walked out of the surf the next night as the Drowned, and the rides have run without operators
ever since. The Commodore went into the sea a week later with the boardwalk's ledger.

The ledger is the revelation: the Commodore was not the only tenant. Its accounts list **Grinwell, I. —
the Palace of Illusions — paid in reflections** and **the Ringmaster — the Carnival — paid in song**.
Old Mother Tide is the patron behind the whole Nightmare Carnival. (The Drowned Captain boss is the Gala
Queen's master, Josiah Harrow; the Leviathan is Old Mother Tide.)

Ada speaks through **seashells** (Mira spoke through glass, Zoltana through cards).

## Stages at a glance

| # | Stage | Where | What the player does |
|---|---|---|---|
| 0 | CONCH | the beach, at low tide | pick up the conch at the waterline |
| 1 | MARINA | the Arcade | hold it to the drowned fortune machine |
| 2 | PHOTOGRAPH | the Gift Shop | look at the 1933 photograph, then take the four souvenirs that are hers |
| 3 | GAMES | Arcade, Sea Wheel, the Undertow | win each keepsake back from its game (any order) |
| 4 | WRECK | the beach, at low tide | set each keepsake in the porthole engraved with it |
| 5 | KEY | the pier | take the bait shop's rod; fish the foghorn key out of the bubbling water |
| 6 | FOGHORN | the pier's end | answer the Gala Queen's call sign on the SHORT / LONG chains |
| 7 | GALA QUEEN | pier → across the map | carry St. Elmo's fire from her bow to the four tide lamps |
| 8 | LOW WATER | the whole shore | (automatic) the sea goes out and stays out |
| 9 | BELL | the seabed by the pier | stay with the founder's bell while the hoist winches it up |
| 10 | LEDGER | the Gift Shop | open the back cabinet and read the ledger |
| 11 | ACCOUNT | wherever the Leviathan surfaces | ring the bell at it three times while its head is up |
| 12 | FINALE | near the party | the Commodore rises: the secret boss |
| 13 | COMPLETE | — | the Boardwalk's True Dawn, an achievement, Ada's Conch unlocked |

Thirteen progression steps (the Unreflected has nine) and about seventeen distinct mechanics (it has
about nine): roughly one and a half times its depth, without repeating a step for length. They are:
a tide-gated find, a fortune card, a spot-the-difference among look-alikes, a timed shooting gallery, a
timing drop, a timed catch on a moving car, a train brake, a turn-each-porthole puzzle that only works at
low tide, carrying a tool, a bite-and-pull, an audio/visual call-and-response, a timed carry to four
places, a world-state change (the sea), a hold under pressure, a reading, a boss-fight interaction, and a
secret boss.

Everything a player does is a press of **interact** (E, or A on a pad) within reach, with the on-screen
prompt naming the action. The one exception is the bell, where the party stays close instead.

## Stage by stage

Reaches are in sim units (`SE_REACH` in the chain): the prompt appears when a player stands within reach.

### Before step 0 · Madame Marina's hint (D-69)
- **Where:** Madame Marina, the fortune booth in the Arcade's north-west corner, named on her marquee.
- **Solve:** before the conch is found, pressing at her ("Ask Madame Marina") prints a fortune card that
  tells how the night begins, plainer each time she's asked, then repeating the plainest:
  1. *"When the tide runs out, the sea leaves a voice on the sand. Find it at the water's edge, and bring
     it to me."*
  2. *"A shell that holds the sea. It shows at the waterline only while the tide is out."*
  3. *"The tide turns every minute or so. When the water draws back, walk the shore and look for the
     conch."*
- **State:** nothing changes; the quest is still at step 0. Her crystal glows faintly while the
  question is unasked. A press answers every 2.5 s at most.

### 0 · CONCH — the beach, at low tide
- **Where:** the conch washes up at one of four places along the waterline each night
  (`conchXs` = −1500, −300, 900, 2700; y = the mean waterline + 30), chosen by the quest's own seeded
  stream.
- **Clue:** the conch glints at the waterline, and only shows when the tide is out. The tide is a 75 s
  cycle; low tide is the part of it where `tideRise < −0.45`.
- **Solve:** walk to it at low tide and press. The prompt only appears at low tide, and a press at high
  tide does nothing.
- **Response:** Ada's first whisper ("Is someone there? I can hear the sea in you…" / *hold me to
  something that tells fortunes*), a ripple and the surf.

### 1 · MARINA — the Arcade's fortune machine (−1820, −1370)
- **Clue:** Ada's hint ("something that tells fortunes"); the machine glows teal while the stage is
  open.
- **Solve:** press at the machine.
- **Response:** Madame Marina prints a card: *"Four small things went down to the water with her. The
  photograph remembers."* It shows as a fortune card and is kept in the chat log.

### 2 · PHOTOGRAPH — the Gift Shop (the photograph's easel at 1925, −1372; press from 1925, −1272; stands at y −1270 and −1110)
- **Per run:** Ada's four keepsakes, one for each of the park's four games, each picked from that game's
  pair (`KEEPSAKES` / `KEEPSAKE_GAME`):

  | Game | Its pair |
  |---|---|
  | shooting gallery | sailor doll · seahorse charm |
  | the Crane | tin pail · paper boat |
  | the Sea Wheel | pinwheel · kite |
  | the Undertow | silk ribbon · jacks |

  The stands always hold all eight as souvenirs, on their front tiers.
- **The photograph** (D-69) is painted from the night's own keepsake mask, so every screen in a party
  shows the same picture. It stands on an easel at the back of the shop, under a picture lamp, and
  shows Ada at nine with the Gala Queen behind her. Her four things lie on the boards in front of her,
  drawn large enough to match against the stands from the shop floor. A caption plate on the easel
  reads "THE GALA QUEEN · LABOR DAY 1933".
- **Solve:**
  1. Press at the photograph: her four things float in front of the easel ("That was me, the summer I
     was nine…").
  2. Take each of the four from the stands.
- **Look-alikes:** pressing on one that isn't hers just says "That isn't mine" and takes nothing. There
  is no penalty, so the shelves can't be emptied by guessing wrong.
- **Advance:** the fourth correct take opens GAMES ("The games kept the real ones…").

### 3 · GAMES — win each keepsake back (any order)
Each game shows its keepsake floating at the prize spot.
- **Shooting gallery** (stand at the gallery counter, −1300, −1340):
  - A press starts a round: six tin ducks run back and forth along the gallery wall for 25 s.
  - Knock all six down (the player's weapons do it) before time is up.
  - If the time runs out, the ducks fold away and the round can be started again.
- **The Crane** (−800, −1370):
  - The claw swings over its prize on a 2.2 s cycle and is over it twice a swing.
  - Press when it is over the prize: a window of ±0.075 of a half-cycle, about ±0.165 s.
  - A miss "comes up empty", with a 1.6 s cooldown before the next try.
- **The Sea Wheel** (the boarding platform, 300, −1750):
  - Per run, one of its twenty gondolas carries a green lantern and Ada's keepsake.
  - Press as that car comes down to the platform (`wheelFromBottom < 0.035`: about 2.8 s every 80 s
    turn).
  - The platform glows green while the window is open; a press at the wrong car says "Not that car."
- **The Undertow** (the station's brake lever, 2580, −780):
  - Press as the train comes home: track `u ≥ 0.93` while it's running.
  - The lever's lamp warms as the train approaches; too soon or too late says so.
- **Advance:** each win says "*game* gives it back, *n* of four"; the fourth opens WRECK.

### 4 · WRECK — the Gala Queen's wreck on the beach (portholes at x 1100 / 1230 / 1360 / 1490, y ≈ 1247)
- **Per run:**
  - Each porthole has a brass engraving of one keepsake above it; which porthole is engraved with which
    keepsake changes every night.
  - Every porthole starts showing something other than its engraving.
- **Solve:**
  - At low tide only, each press turns a porthole to the next keepsake.
  - Stop each one on its own engraving.
- **High tide:** a press says "The sea is over her" (2 s cooldown) and changes nothing.
- **Advance:** when all four match, she "remembers us now", and Ada says where Father kept a key.

### 5 · KEY — the pier
- **Rod:** take the bait shop's rod (−2930, 1740). It follows its holder, and passes to the nearest
  standing player if they fall.
- **Fishing:** at the little dock's east end (−2140, 2340), where the water bubbles:
  1. Press to cast.
  2. A bite comes 1.5–4 s later (the float dips; a splash and a rumble).
  3. Press within 0.9 s of the bite.
- **Misses:** too early or too late, "It got away"; cast again.
- **Response:** the foghorn key.

### 6 · FOGHORN — the pier's end
- **Per run:** a call sign of four blasts, each SHORT or LONG, never all one kind.
- **Solve:**
  1. Press at the foghorn (−2900, 2750). The Gala Queen's horn sounds the call sign from out on the
     water, and the lighthouse lens flashes the same pattern, so it can be read with the sound off.
  2. Answer it on the SHORT (−2960, 2735) and LONG (−2840, 2735) chains.
- **Wrong answers:** "That isn't her call", the answer starts over, and the call sign replays.
- **Advance:** the last right answer moors the ship at the pier's end ("She came in. She came back.").

### 7 · GALA QUEEN — St. Elmo's fire to the four tide lamps
- **Take the fire:** press at the berth (−2490, 2660) to take the blue-green flame from her bow. It burns
  120 s and follows its carrier (passing on if they fall).
- **The four tide lamps** (iron posts, dark until lit):
  - the bait platform (−2650, 1900);
  - beside the second lifeguard tower (300, 610);
  - at the Pavilion stairs (250, −170);
  - at the foot of the coaster's lift hill (2290, −1700; moved with the track in D-69).
- **Light them:** press at each while carrying the fire.
- **If it burns out:** lit lamps stay lit; take fresh fire from the ship and carry on.
- **Advance:** the fourth lamp.

### 8 · LOW WATER — automatic
The sea goes out 650 units over 8 s and stays out for the rest of the night. The shaders, the sea floor,
the waterline and wading all follow (`SEA.retreat`). The seabed by the pier shows the founder's bell.

### 9 · BELL — the seabed under the pier's hoist (−2160, 1870)
- **Solve:** stay within 170 of the bell for 28 s while the hoist's chain winches it up.
- **Decay:** when nobody is near, progress settles back at half speed (it never resets at once).
- **Pressure:** while someone is holding it, the drowned climb out of the mud around the bell every 4.5 s.
- **Advance:** when it's up, the bell hangs from the hoist and Ada says where the ledger is.

### 10 · LEDGER — the Gift Shop's back cabinet (2290, −1340)
- **Solve:** press to read the ledger.
- **Response:** its terms appear as a long whisper, kept in the chat:
  - Penhallow — the Boardwalk — paid in guests;
  - Grinwell, I. — the Palace of Illusions — paid in reflections;
  - the Ringmaster — the Carnival — paid in song.
- **Then:** nine seconds later, "She comes up for her payment at the end of every night. Ring Father's
  bell at her three times." A ghost of the bell now follows its reader (the carrier).

### 11 · ACCOUNT — the Leviathan
- **When:** the Leviathan (the final boss, at 24:00).
- **Solve:** whenever its head is up (`headUp`: surfaced past 80%) and within 1000 of the bell's carrier,
  the carrier sees "Ring the bell". Three rings, at most one every 1.3 s.
- **It cannot die while the account is open:** its health won't drop below 2% until the bell binds it.
  An open account can therefore never be lost to a lucky kill.
- **Advance:** the third ring binds it. It goes down ("THE ACCOUNT IS CALLED"). Its defeat is handed to
  the quest, not to the dawn.

### 12 · FINALE — the Commodore
- **Spawn:** four seconds later the Commodore rises near the party.
- **The night is held:** `finaleActive` holds the dawn until he falls.
- **The fight** (secret boss, 66,000 HP; not on the schedule):
  - **The Founder:** cane cuts, ledger pages in fans, the Sea Wheel's spokes, the Undertow's wraiths.
  - **The Bargain:** red-ink lines ruled across the stage, the tide with two gaps, the drowned guests.
  - **Summer's End:** the last fireworks of 1933, everything faster.

### 13 · COMPLETE
- **True Dawn:** the `summers_end` achievement, the "SUMMER'S END" banner, and the results line "Ada's
  Conch now appears in the draft pool".
- **Unlock:** Ada's Conch (`p_ada_conch`: +12% pickup radius and +0.25 HP regen per level) is unlocked
  permanently.
- **Record:** `quests.summers_end` records the completion.

## State, co-op and failure

- **Determinism.**
  - Every per-night choice (conch spot, keepsakes, engravings, porthole starts, green car, call sign)
    comes from the quest's own `Rng` (seed `cfg.seed ^ 0x5e5e1933`), so it never perturbs gameplay
    randomness.
  - The tide, the wheel and the train are pure functions of sim time.
- **Co-op.**
  - One shared chain. Any standing player can act on any step, and nothing ever needs two players at
    once.
  - Carried things (the rod, the fire, the bell) follow their carrier, and pass to the nearest standing
    player if the carrier falls.
  - The host runs the chain; guests receive it as 24 bytes (`netState`), and every screen draws the
    quest from that state and sim time alone.
  - A guest's press travels as the existing interact count (PROTO 9 mechanism; PROTO 10 for the map).
- **Failure and recovery.** Nothing is lost for good:
  - Every miss can be retried at once or after a short cooldown: a wrong souvenir, a lost gallery
    round, a missed drop, catch or brake, high tide at the wreck, a fish that got away, a wrong call, a
    guttered flame, a bell left alone.
  - The one way to miss the ending is the night itself. If the Leviathan dies before the ledger has been
    read, its fall is the ordinary dawn. Once the account is open, it can't die until it is bound.
- **Expected time.** A party that knows the solution can finish the hands-on steps (0–10) in about 14–18
  minutes of a 25-minute night, then wait for the Leviathan at 24:00. A first-time party will usually
  need more than one night to learn the clues. Low tide comes every 75 s and the green car every 80 s, so
  some steps have a short wait built in.
- **Rewards.** True Dawn, the achievement (400 Lost Tickets), Ada's Conch in the draft pool.
