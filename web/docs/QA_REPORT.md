# QA & Test Report

Date: 2026-10-30 · Build: `web-threejs-rebuild` branch · Environment: Windows 11, Node 22.13, Chromium-based embedded browser pane.

## 1. Automated tests — `npm test`

**106 tests, 7 files, all passing** (≈ 60 s wall-clock, dominated by the SFX synthesis check and the
accelerated full run).

| File | Covers |
|---|---|
| `core.test.ts` (15) | stat axes & cooldown floor; max-HP heal-on-gain; movement speed, prop collision, map bounds; six distinct character identities; armor min-1 damage; i-frames; Lost Child balloon shield absorb + regrow; revive → real death → loss; enemy damage, knockback, kill → ticket drop; shielded affix; frozen +25%; XP curve monotonic; multi-level draft queue; magnet pickup; ground-gem cap → Ticket Bank; payout formula; sim frozen during drafts; **same seed + inputs → identical run (Daily determinism)** |
| `content.test.ts` (57) | every evolution chain complete & reachable (incl. Grand Menagerie); signature weapons; waves/enemies/props/bullets all have data & art; every SFX recipe renders finite, audible audio; **each of the 34 non-clone weapons/evolutions deals damage**; Funhouse Mirror replays add damage; Lv8 cap, 4-slot cap, evolution replaces slot; draft never offers illegal options (full slots, max levels, locked content, banished); evolution card guaranteed; Fortune Teller sees 4 cards; chests evolve first; **every enemy behaviour runs 12 s without NaN**; monkey wind-up precedes dash; jack telegraphs its blast; puppet formations volley |
| `bosses.test.ts` (8) | each boss: warning → wake → attacks with telegraphs → **every phase reached** → Puppet King strings cut → stagger → defeat → chest + boss id + hazards cleaned; soft enrage; D-24 boss hold; D-01 Ringmaster stall → defeat → victory lap → dawn → win; Endless continues past dawn with an Encore Ringmaster |
| `meta.test.ts` (10) | save/load; **Godot-era v1 save migrates to v3**; corrupted save recovers from backup; perk cost/cap/refund; character unlock requirement + price; achievements pay once; meta perks apply to runs; tier HP/damage multipliers & population caps; Curse; daily seed determinism |
| `events.test.ts` (10) | all 9 carnival events start, run and end; Lights Out darkness; Calliope spawn boost |
| `smoke.test.ts` (1) | 3-minute autopiloted run |
| `fullrun.test.ts` (1) | **accelerated full night**: autopilot + god mode, all four Acts, all four bosses defeated in order, dawn, win, Lost Tickets paid, population within Midway cap + swarm overlay |

Typecheck (`npm run typecheck`) and production build (`npm run build`) succeed with zero errors.
The production bundle contains no dev tools (verified by grepping the output for the `__nc` API).

## 2. Accelerated run testing

Dev-only tools (`window.__nc`, dev panel on <kbd>`</kbd>) provide timeline jumps, sim speed (×1/×4/×16),
god mode, autopilot, synchronous `advance(seconds)`, `bench(frames)`, boss-HP setters, content
grants and unlock-all. They were used to drive the browser build through every boss, the dawn
sequence and the results screen (see §4). The headless equivalent is `tests/fullrun.test.ts`.

Representative accelerated full-run timeline (seed 777, Midway, Carny, god-mode autopilot):
Tent spawned 6:00 → defeated; Ferris Wheel 12:00 → defeated; Puppet King 18:00 → defeated;
Ringmaster 24:00 → defeated → victory lap → dawn at 25:00 → win, ~1,400 Lost Tickets.

## 3. Performance (measured, not assumed)

**Simulation (headless, Node 22):** ≈ 0.13 ms per 60 Hz tick with ~200 enemies; a full 25-minute
night simulates in 11–15 s.

**In-browser frame cost** via `__nc.bench()` (synchronous sim tick + full render + `gl.finish()`), canvas
800×510 @ DPR 1:

| Scene | Enemies | Enemy bullets | Sprites drawn | ms / frame (sim + render) |
|---|---:|---:|---:|---:|
| Nightmare + Curse, Act IV, evolved build | 298 | 292 | 1,079 | **2.06** (0.42 + 1.64) |
| Synthetic stress: forced extra spawns + 600 boss bullets | 433 | 947 | 2,784 | **2.69** (0.74 + 1.95) |

Both are far inside the 16.7 ms budget for 60 fps, with the Nightmare population cap (400) exceeded.
Rendering is instanced (one draw call per layer per atlas page, 11 layers + 5 shape batches);
per-frame allocations in the hot loops are avoided (typed-array batches, pooled entities,
linked-list spatial grid). Larger canvases cost more GPU fill (ground shader evaluates up to 40 lights
per pixel); the **Graphics quality** setting caps device-pixel-ratio (2 / 1.5 / 1), particle budgets
(1,700 / 1,000 / 500) and disables fog on Low.

**Caveat:** the embedded preview pane throttles `requestAnimationFrame` (~2–4 fps when not focused),
so a real-time fps counter could not be observed there; frame cost was measured synchronously instead.
Real-time fps on dedicated hardware/displays (1080p/1440p/4K) was not measured.

## 4. Browser playtest (screenshots inspected)

Inspected in the embedded Chromium pane, driving runs with the dev tools:

| Screen / moment | Result |
|---|---|
| Boot / loading painter, press-start, title over attract mode | ✅ renders; menu readable |
| Character select (locked silhouettes, stats, quirk, weapon, difficulty, Curse) | ✅ (fixed: locked silhouettes were invisible on black) |
| Early combat 0:40 (balloons, ticket booth, frost cone, orbs, damage numbers) | ✅ (fixed: scene too dark → brighter ambient + min light) |
| Dense combat & stress (400+ enemies, ~950 bullets) | ✅ playable; heavy visual noise at synthetic extremes |
| Level-up draft (evolution card, NEW tags, evolution hints) | ✅ |
| Carnival Tent: wake, P1 pennant lane, P2 stake drops + rotating pole + Brute, P3 fire | ✅ (fixed: boss hidden under HUD → camera framing + compact boss bar) |
| Ferris Wheel: roll-in, gondola spiral | ✅ |
| Puppet King P2: tangle lash, cuttable strings | ✅ |
| Demon Ringmaster: hellfire whip leaving burning ground | ✅ |
| Victory lap → DAWN title → results (damage table, payout, achievements, unlocks, Lock-In) | ✅ (fixed: HUD showing through, horizontal scrollbar) |
| Lost & Found, Carnival-pedia | ✅ |
| Browser console | no errors after fixing one circular-import initialisation bug |

## 5. Balance method & findings

Two autopilots exist in `tests/helpers.ts`: a naive kiter and a potential-field "smart" pilot with a
human-like draft policy. `scripts/survival.ts` runs 3 seeds × 6 characters without god mode.

After the D-29/D-30 retune (Midway): most smart-pilot runs reach the Carnival Tent (6–11 min, levels
17–25); one Fortune Teller run **won the whole night** (all 4 bosses, L75) and a Ringleader run reached
the Ringmaster. Before the retune the same bot died at 4–6 min at levels ~11 because the 3:00 wave
outpaced any early build. Boss kill times for optimised god-mode builds are 20–60 s; human builds are
expected near the 75–110 s target. Melee (Strongman) is under-served by the kiting bot, so its numbers
understate that character.

**Balance still needs human playtesting** — bots don't dodge like people.

## 6. Defects fixed during QA (selection)

- Spatial-grid infinite loop when an enemy was killed and re-pooled in the same tick (duplicate active-list entry → self-referencing cell list).
- Circular import read a constant before initialisation (blank screen) → constants module.
- Dormant bosses woke during Endless; bosses could stack at overlapping gates → D-24.
- Canvas premultiplied alpha wiped ground colours where alpha encoded surface type → non-zero encoding.
- Evolutions arrived by 5:30 (miniboss chests rolled up to 7 upgrades) → D-26.
- Visual: darkness, HP-bar ghost overlay, boss framing, pickup colour vs danger colour (D-27), toast spam, results overflow.

## 7. Known limitations

- **Art** is original procedural vector illustration with parametric poses (4-frame walk cycles,
  wind-up poses, cut-out boss puppets) rather than hand-drawn frame-by-frame animation; there is no
  "line boil".
- **Music:** Bradley Schwarz's song (one recording) scores the title menus and the boss fights; the
  night and the Midway use procedural waltzes (D-55, D-61).
- **No online leaderboard** for the Daily Run — scores are local to the browser (no backend exists).
- **Gamepad** support is implemented (standard mapping, rumble) but was not tested with a physical
  controller in this environment; **touch controls** are not implemented.
- **Colourblind support** is limited to the high-contrast telegraph option (no alternate palettes).
- **Real-time fps** on target hardware not measured (see §3 caveat); measured frame cost suggests a
  large margin.
- Balance tuned with bots; needs human playtests (see §5).
- No localisation framework (English only).

---

## The solo chat log, and Hall of Mirrors' invisible player — 2026-10-31 (D-72)

**Changed:**
- In single player, T opens the chat box read-only to look back over the night's whispers and fortunes,
  and the night waits while it's open.
- Character batches hold 128 figures (were 6), and the players are drawn before their summons.

Decision: D-72.

**Reproduced first** (dev build, Carny with Hall of Mirrors on the Carnival map, the sim stepped by hand):
- With 3 clones (no extra Amount), the Carny batch drew 4 figures, the player among them.
- With Extra Token at level 5 (+3 Amount), there were 6 clones. The batch was full at 6 of 6, the
  player wasn't drawn, and the capture showed six blue clones round an empty middle.

**After the fix, the same setup:**
- The batch draws 7 of 128 figures. The first is at the player's position.
- The capture shows the Carny in the middle of the six clones.

**The solo log, driven in-page** (key events dispatched; frames stepped by hand, because the pane
reported itself hidden):
- The box shows once a quest line is written, with "T log" under it.
- T opens it: read-only, focused, "Reading back, the night waits", every line shown.
- The night's clock advanced 0 s over 2 s of frames while open, and 1 s per second before and after.
- T, Esc and Enter each close it. Esc doesn't open the pause menu on its way out.

**Automated:** 300 tests pass in 20 files; typecheck clean; the production build passes. The tests run
without a DOM or WebGL, so neither change has a unit test; both were checked in the browser as above.

**Not verified:**
- A capture of the open log: the pane reported itself hidden at that point, so the screenshot showed a
  stale frame. Its state was read from the page instead.
- A person playing either change.
- Co-op on two machines. There, the chat still sends as before, and the batch fix applies to every
  screen; neither was exercised over a connection.

---

## Co-op playtest round: crowd, tide, tooltips, leaderboard, lobby — 2026-10-31 (D-71)

**Changed:** from the owner's co-op night on the Boardwalk, and an interface list:
- The Boardwalk's crowd from Act II on is mostly runners. Its specials are a party-capped, sturdier few,
  and Act III eases in after the Captain.
- The stage ring now reels players back in.
- The tide turns on a 100 s timer, with a notice before each turn.
- Whispers hold twice as long; the shooting gallery's ducks have 12× the health.
- A co-op party leaderboard on the results screen.
- The lobby no longer rebuilds on every change.
- Equipment-bar tooltips, and recipe bands on tooltips and draft cards.
- The Midway's gate labels show open, or a padlock and what opens the gate.
- Bouncing arrows over chests, food and golden tickets.
- Golden tickets two or three a night.

Decision: D-71.

**Automated:** 300 tests pass in 20 files; typecheck clean; the production build passes.
- `boardwalk.test.ts`: the tide holds, turns within 6 s, is known 3 s before a turn, and low water
  uncovers `upBeach + out` of beach.
- `boardwalkBosses.test.ts`: a player parked 700 outside the Captain's ring is drawn back toward it.
- `coop.test.ts`: in a two-player night each player has their own damage and kills, the shares add up to
  the night's total, and every player's end stats carry the whole table; a solo night has none.
- `summersEnd.test.ts`: the porthole presses wait for settled low water under the new timer.
- The full Boardwalk bot night still plays all four acts, beats every boss and reaches dawn. Before
  the ring fix, it stalled at the Captain, whose bot had walked out of his ring.

**Measured:**
- **Crowd health per spawn against the first map** (`scripts/maphp.ts`, two seeds, god-mode bot):

  | Act | Before | After |
  |---|---|---|
  | I | 1.2× | 1.1× |
  | II | 1.4× | 1.1× |
  | III | 1.5× | 0.8× |
  | IV | 1.0× | 0.9× |

- **Density stays high:** away from the boss fights, Acts III–IV spawn 430–760 a minute, about as many
  as the first map's 460–730.
- **Golden tickets** (six bot nights: two maps, three seeds):
  - before, 1–3 spawned a night (about 2.2), of which the bot reached 0–1;
  - after, 2–3 a night (2.8 on average), of which the bot reached 1–3.

**In the browser (dev build, 1600×900), checked:**
- the tray tooltip (Throwing Cards, its next level, the READY recipe);
- the draft cards' recipe bands;
- the Midway's gate labels (open, and 🔒 with what's missing) and the chainless open signpost;
- arrows over a chest, food and a golden ticket;
- the tide notice ("THE TIDE IS COMING IN");
- the party leaderboard: a normal table drawn with each column's best in gold, and a malformed table
  dropped or zeroed rather than crashing;
- the lobby's `morph` keeping nodes and focus in place.

Found on the way and fixed: the Boardwalk's ambience beds crossfaded only for co-op guests, because the
solo and host frame never fed the mix (D-68).

**Not verified:**
- A person playing the changes, in co-op or solo: the crowd, the tide, the gallery.
- The lobby and the leaderboard over a real connection (both were exercised in-page and in the sim
  only; no protocol change, PROTO is still 10).
- The whispers' new length, by eye in play.
- Mobile viewports.
- Audio (the tide notice reuses the surge sound; not listened to).

---

## Playtest round on the Boardwalk — 2026-10-31 (D-69)

**Changed:** the owner's first playtest list:
- the pier over the sand; the coaster out of the Gift Shop and the Ballroom;
- the Gift Shop's photograph and souvenirs; realistic Arcade machines with real glass;
- Marina labelled, with a hint before step 0;
- less flashing everywhere; one plain telegraph language for every attack;
- bosses 3, 4 and the secret bosses ×3 / ×2.75 / ×2.5 on all maps.

Decision: D-69.

**Automated:** 295 tests pass in 19 files (3 new); typecheck clean; the production build passes.
- `summersEnd.test.ts`: before the conch, Marina answers with hints 0, 1, 2, 2 by real presses, the
  quest stays at step 0, and after the conch she reads the photograph's fortune as before.
- `boardwalk.test.ts`:
  - the coaster's track (sampled at 4000 points) and every bent keep 50 clear of every building but the
    station;
  - no lamp or palm stands within 100 of a bent;
  - the Gift Shop's eight stand spots and the photograph's spot are inside the shop and on open floor.
- The full Boardwalk bot night still plays all four acts, beats every boss and reaches dawn.

**In the browser (dev build, 1600×900), captures inspected:**
- **The pier's neck over the sand,** before and after (zoom 2.4): the sand bled through the planks in
  bands; now the deck is solid boards from the promenade to the sea, and over the waterline.
- **The Gift Shop,** before and after:
  - before: the coaster ran inside; the souvenirs were specks; the photo frame was buried in the wall;
  - after: no track inside; stepped stands with readable souvenirs; the eight look-alikes on the front
    tiers; the easel photograph legible at default zoom (Ada, the Gala Queen, her four things, the
    caption); the floating keepsakes below the caption.
- **The Arcade** at default zoom and 2×: every machine type, the figures behind glass, the marquees.
- **The coaster's new route,** the narrower Ballroom, and the station gap.
- **Telegraphs mid-wind-up** (the sim paused with the timer at 45–60%):
  - the Barker's shout cone and falling ring toss;
  - the Ringmaster's lane;
  - the coaster wraith's bent rail;
  - the Fun House marionettes' slams;
  - the first map's slams.
- **Quality tiers** in the Arcade and Gift Shop:

  | Quality | Draw calls | Triangles |
  |---|---|---|
  | Low | 119–121 | 0.50–0.52M |
  | Medium | 220–224 | 0.85–0.88M |
  | High | 299–303 | 1.20–1.23M |

**Flashing, measured** (a late-game Royal Flush fight, the same scripted 150 frames before and after):

| Measure | Before | After |
|---|---|---|
| Blown-out pixels (>235), peak | 0.84% | 0.15% |
| Blown-out pixels, mean | 0.24% | 0.10% |
| Frame-to-frame flicker (mean abs. luminance change) | 12.3 | 10.8 |
| Pixels jumping >60 levels per frame | 3.4% | 3.2% |
| Mean luminance | 66 | 58 |

The biggest single fix was the hit flash: a Big Top under constant hits rendered as a white blob, and
now reads as its striped tent.

**Boss fight length,** with `scripts/bossttk.ts` (a bot with a strong build, two evolutions at 18:00
and four at 24:00, god mode, timed in ticks; two builds × one seed each):

| Map | 18:00 boss | 24:00 boss | Secret boss |
|---|---|---|---|
| Carnival Core | Puppet King 62 s | Ringmaster 68 s | Calliope 140 s |
| Fun House | Stringmistress 74 s | Proprietor 49 s | Unreflected 64 s |
| Boardwalk | Last Ride 53 s (was 13) | Leviathan 44 s (was 26) | Commodore 58 s (was 33) |

- Before the change the same builds killed bosses 3–4 in roughly 13–26 s on every map.
- The test suite's competent bot drafting for itself (`smartDraft` / `smartPilot`) is very noisy: on
  weak seeds it already took 5–6 minutes over the unchanged early bosses, and its late fights now run
  long. This matches the project's experience that bots lag human builds badly. Watch for slow builds
  in real play.

**Not verified:**
- A person playing the changes, including whether the new boss lengths feel right.
- Co-op on two machines (no network changes in this round; PROTO is still 10).
- Mobile viewports.
- Audio (unchanged).

---

## The Boardwalk, a third map — 2026-10-31 (D-68)

**Added:** Penhallow's Boardwalk, with:
- **The map:** promenade, Arcade and Gift Shop interiors, beach, pier and ocean; the tide and the
  coaster crossing; sea creatures that come up out of the water.
- **The fights:** ten new enemies plus a miniboss and a boss add; four bosses and a secret one; six
  events.
- **The quest:** Summer's End (thirteen steps).
- **Sound:** three ambiences and a seaside waltz.
- **Integration:** the Midway gate, map pickers and PROTO 10.

Design: `BOARDWALK.md`; quest solution: `EASTER_EGG_BOARDWALK.md`; decision: D-68.

**Automated:** 292 tests pass in 19 files (54 new), and the production build passes.
- **`boardwalk.test.ts`** (19):
  - The registry swaps everything for the third map and back; the same gates and run length; Acts I–II
    at 1.0–1.4× the first map's crowd health by weight; 10 of 15 enemy types new.
  - Availability (the Proprietor or the tester flag), and an older save with no Boardwalk fields still
    loads.
  - The shore: the tide's amplitude and low water's draw; wading stops at the wade line and the pier's
    decks carry you; the ambience mix sums to one and lands on the right bed in each region.
  - The coaster's car hits a player under it at the crossing.
  - Spawning and reachability: sea things come up in the surf near a player and land things never start
    in deep water; a ticket dropped offshore drifts in; helpful spots are never at sea.
  - Enemy mechanics: a barnacle's crust soaks then cracks (3 of 10 damage, then 12.5); a stub marks and
    the crowd speeds up by exactly the haste factor; a Prize Collector swallows tickets and pays back
    ≥1.4×; a Tidecaller raises the drowned. Every new creature fights a bot for a minute without
    non-finite positions, and the attackers are seen winding up.
  - A Boardwalk night: every event starts and plays out; the player never leaves the map or walks into
    deep water; and a whole god-mode bot night plays all four acts, beats Barker → Captain → Last Ride →
    Leviathan in order, reaches dawn and pays out.
- **`boardwalkBosses.test.ts`** (10):
  - Each scheduled boss warns, wakes inside a stage drawn round the party, telegraphs, stays on the map
    (land bosses out of deep water), reaches every phase, pays out, earns its achievement and leaves no
    hazards behind.
  - The Last Ride's cars ride its path a car-length apart, and a hit on a car hurts the train.
  - The Captain's ship stays in deep water.
  - A cut tentacle costs the Leviathan 2.5% of its health.
  - The Leviathan holds the dawn and its defeat wins the night.
  - The Commodore runs three phases.
  - Every boss fights a bot with a real loadout without faults.
- **`summersEnd.test.ts`** (7):
  - The quest is walked from the conch to the True Dawn by real interact presses, timed to the tide, the
    claw, the wheel and the train. It also takes a wrong souvenir, a missed drop, an early pull and a
    wrong call on the way.
  - The Leviathan can't be killed while the account is open, and three bell strokes bind it.
  - Per-seed puzzles are well formed: one keepsake per game, every porthole unsolved, a mixed call
    sign.
  - The gallery can be lost and replayed, and a guttered flame keeps its lit lamps.
  - Without the bell, the Leviathan's fall is an ordinary dawn.
  - In co-op, a guest acts alone; the bell passes on when its carrier falls; and the snapshot mirrors
    the chain into a guest.
- **`content.test.ts`:** every new enemy has a 3D model and 2D Pedia art; every new SFX recipe renders
  non-silent audio.

**Balance (measured):**
- `scripts/maphp.ts 1 carnival_core,boardwalk` (god-mode bot, one seed), crowd health per spawn against
  the first map: Act I 1.2×, Act II 1.4× (1.25× by roster weights), Act III 1.5×, Act IV 1.0×.
- One seed is noisy after Act I, because the crowd thins during boss fights that end at different
  times; that run also had the Fun House's bosses as placeholders. Re-measure with three seeds.
- The barnacle brutes' crusts make them tankier than their health says (about 1.18× effective). Their
  health was cut to 190 and 960 to keep them near the 1.2× target.

**In the browser (dev build, 1600×900):**
- **Captures:** every region and both interiors, active combat, the creature line-up at 3× zoom,
  rising out of the surf and the sand, every boss and the ghost ship, the quest's stages, and quality
  tiers. Inspected; metrics and findings are in `VISUAL_QA.md`.
- **Fixed after looking:**
  - the tidecaller's staff lay horizontal (it got its own bone);
  - the Last Ride's riders were blown out;
  - the ocean's light streaks ended on hard lines;
  - the wreck's engravings were unreadable;
  - the moored ship overlapped the trawler;
  - the crane's claw was hidden in its cabinet;
  - the beach had almost no light (tower lanterns, the fire pit, stair lanterns and wrack lines were
    added).
- **Frame time** (vsync-capped at 165 Hz on this machine):
  - Plaza, shore, beach combat (51 alive) and the Leviathan fight hold 165 fps (p95 6.2 ms) on High and
    on Low.
  - At the 280 cap (269 alive), after re-meshing the sculpts:

    | Quality | Avg fps | p95 | Draw calls | Triangles |
    |---|---|---|---|---|
    | High | 131 | 12.2 ms | 328 | 8.67M |
    | Medium | 148 | 12.1 ms | 247 | 7.65M |
    | Low | 163 | 6.2 ms | 134 | 4.59M |

    Before the re-mesh, High was 112 fps with 12.9M triangles.

**Not verified:**
- A person playing a night on the Boardwalk, or the quest end to end by hand (bots and scripted presses
  only).
- A co-op night on two machines with PROTO 10 (loopback tests only).
- Audio by ear: the new SFX render non-silent in tests, and the ambience crossfade and the waltz were
  built but not listened to.
- Weaker GPUs and mobile viewports: frame times are from one fast desktop GPU, capped by vsync.
- Boss balance against real players; Acts III–IV crowd balance with more seeds.

---

## Fun House lighting, readable walls, E to interact, neon prize wheel — 2026-10-31 (D-67)

**Changed:**
- The Fun House is lit from fixtures you can see (sconces, pendants, capital lamps, picture lights,
  stage booms with drifting spots and beams), every lamp wears a halo, moonlight falls through tall
  windows, and the indoor ambience no longer thickens the haze toward the map's edges.
- Walls wear pale caps with glowing gilt edges; mirror panels a silver top line and post bulbs; a
  contact shade runs where walls meet the floor.
- The Unreflected's hands-on steps are presses of interact (E / pad A) with an on-screen prompt; the
  projector stays a hold. Guests' presses travel as a running count in the input packet (PROTO 9).
- The prize wheel is a neon booth: black lacquer, gilded frame, magenta and cyan neon, a deep wheel,
  a shadow-casting key light, neon spill and a dark neon reflection environment.

**Automated:** 238 tests pass (16 files), and the production build passes.
- `unreflected.test.ts`: the solo walk now presses interact at each step, and checks that standing at
  the counter, a face, the footprints, a pivot and the true clock does nothing; that walking past every
  plinth doesn't play or sour the overture; that a press out of reach does nothing; and that a guest's
  own press acts while the host's press far away doesn't.
- `net.test.ts`: interact counts round-trip and wrap; one guest press over a link with 15% loss and 5%
  duplication reaches the host's sim on exactly one tick. Mutation-checked: with the host's
  count comparison disabled, the test fails.

**In the browser (dev build, 1600×900, High):**
- Before/after captures of all seven house views, the Carnival Core plaza (unchanged) and the wheel
  mid-spin and landed, with pixel metrics, renderer totals and a frame-time bench: `VISUAL_QA.md`. The
  maze's dark corner went from contrast 64.8 / mean 25.5 to 100.9 / 43.3.
- Interact, through the real input path: standing two seconds at the Lost & Found counter left the
  quest dormant; a dispatched E keydown set the press, and the next tick picked up the hand mirror; the
  press cleared after that tick. The prompt ("E · Pick up the hand mirror") was seen floating over the
  counter in a screenshot.
- The production build (`vite preview`) boots to the title with no console errors, and the dev hooks
  are absent.

**Not verified:**
- A person playing the new lighting through a crowded night, or the quest end to end with E.
- A co-op night on two machines with PROTO 9 (loopback tests only).
- The wheel in motion: only stills at two moments, and the first chest's icons load as before.
- Mobile viewports.

---

## Party XP 150% of solo — 2026-10-30 (D-66)

**Changed:** a party's tickets are worth 1.5×. The crowd density and the XP per level are unchanged.

**Automated:** 237 tests pass. A new tuning test checks two things:
- The same ticket banks exactly 1.5× for a party of two, three and six.
- Solo is unchanged.

**Measured:** bot nights were tried (`scripts/party.ts`, the new `scripts/xprate.ts`). They can't resolve
the ratio.
- The haul swings 5–10× between seeds, even with one character in every seat.
- Mixed-character parties also hinge on whether the bots walk over the Ticket Bank.
- Not used to tune; see `PROGRESSION.md`.

**Not verified:** a human party night at the new gain.

---

## Chat box, overhead health bars, hit numbers, chest arrows — 2026-10-30 (D-65)

**Automated:** 236 tests pass. Two are new in `tests/net.test.ts`.
- **Chat.** Lines are cleaned and capped. Malformed or out-of-range messages are refused both ways. A
  guest's line and the host's line reach both sides in the same order. A burst of ten lines is cut to
  four without a disconnect, and the bucket refills.
- **Minibosses.** A miniboss's health reaches a guest's mirror through a real snapshot.

**Live (dev server, one machine; two tabs over real PeerJS for chat):**
- **Chat.** The guest pressed T and typed a line. The open field rendered bottom-left, and the T
  wasn't typed into it. Enter sent the line, and it showed on both tabs. The host replied by keyboard
  and both tabs logged both lines, in player colours.
- **Open panel.** It showed the scrollback with a quest whisper (green ❖ line with its subtitle) and a
  Zoltana fortune (gold).
- **Esc.** It closed the line without opening the pause menu.
- **Solo night.**
  - A whisper wrote itself into the log above the health bar and portrait.
  - The Crooked Twins and the Proprietor showed segmented bars overhead.
  - The Grand Display showed a labelled bar.
  - Two hits popped "-9" and "-26" (the bigger one in the large style).
  - Gold arrows circled the player toward the chests.

**Found and fixed while checking:** Zoltana's chat line picked up the fortune card's panel styling (a
class-name clash). Chat line classes are prefixed now.

**Not verified:**
- Chat across two machines on different networks.
- How the bars sit over every boss rig (checked over the Twins, the Proprietor and the Grand Display).
- A real night by a person.

---

## Fun House crowd health, from Kevin's playtest — 2026-10-30 (D-64)

**Report.** A fresh level-1 character found the house's opening mobs took far too many hits. The ask
was a curve like the first world's, about 15% harder.

**Measured** (`scripts/maphp.ts`, 3 god-mode bot nights per map): average health per spawn by act.

| Act | First world | Fun House before | Fun House after |
|---|---|---|---|
| I (0–6 min) | 24.9 | 76.9 (3.1×; minute 0 alone 11.9×) | 31.1 (1.2×) |
| II (6–12) | 54.7 | 166.6 (3.0×) | 62.6 (1.1×) |
| III (12–18) | 259.6 | 267.6 (1.0×) | 282.3 (1.1×) |
| IV (18–25) | 285.3 | 307.3 (1.1×) | 342.8 (1.2×) |

**Changed.**
- Each Fun House enemy got its first-world counterpart's slot at about 1.15× health and contact
  damage, with matching tickets.
- The waves arrive at the first world's pace.
- Marionette landings are telegraphed (the spot is marked during the leap) and smaller (70 → 50).
- The Mannequin sprint is down from 215 to 140, the evil clown's tier.
- The Grand Display miniboss went from 2,600 HP and 26 contact to 1,035 HP and 12 contact.
- The Proprietor's cabinet brings one thief, not two.

**A crash found while measuring.** If the Looking Glass's reflections were all shattered during its
0.4 s swap wind-up, the swap read a reflection that no longer existed and the night froze at 12:00. It
is fixed. Two new tests cover it:
- the exact case, which fails with the old code;
- every Fun House boss fought by a bot with a real loadout. The old boss tests removed the player's
  weapons, which is how this slipped through.

**Automated:** 234 tests pass. The new guard keeps the house's Acts I–II at 1.0–1.3× the first world,
wave by wave.

**Mortal bots** (`scripts/survival.ts midway fun_house`, `scripts/fhdeaths.ts`): they still die sooner
in the house than in the carnival. They kite for open ground; the house is walls. Per Kevin, not tuned
to. The telegraphed landings halved the Marionette shockwave's damage and lengthened the bots' runs by
about half.

**Not verified:** a human night on the new curve.

---

## The Fun House, a second map — 2026-10-30 (D-63)

**Automated:** 231 tests in 16 files pass. Typecheck and the production build pass. New tests:
- **`tests/funhouse.test.ts` (9).**
  - The map registry swaps every table and games on different maps interleave.
  - Same gates, length and crowd curve as the first map.
  - At least 60% of the roster is new.
  - The maze stays connected in every pivot state.
  - Pivots collide.
  - Five minutes of a Fun House night run clean.
  - Conveyors push and pistons strike on their telegraphs.
  - The quest's fixtures sit in the right rooms.
- **`tests/funhouseBosses.test.ts` (8).**
  - Each of the four bosses warns, wakes inside the house, telegraphs, reaches every phase and pays
    out.
  - The Looking Glass's reflections shatter instead of hurting it.
  - The Proprietor holds the dawn.
  - The secret Unreflected runs all three phases.
  - **An accelerated god-mode night on the Fun House meets all four bosses in order and wins at dawn**:
    the Twins at 6:00 (beaten 7:01), the Glass at 12:00 (13:12), the Stringmistress at 18:00 (19:01),
    the Proprietor at 24:00 (24:53); level 65, 16,048 kills, peak 195 alive.
- **`tests/unreflected.test.ts` (7).**
  - The clock maths.
  - The beam solution, and edge-on mirrors stopping it.
  - Fairness over 40 seeds: unsolved pivot starts, one true clock and one trap, varied bow orders.
  - A solo walk through all ten stages to the True Dawn: a wrong plinth, a wrong clock, the projector
    cooling, and the door leaving the walls.
  - The Proprietor without Mira is an ordinary dawn.
  - Each map has only its own quest.
  - Co-op: a guest acting alone, Mira passing to a standing player, and the whole chain arriving at a
    guest's mirror through a real snapshot.
- **`tests/net.test.ts` (+1).** The host's map choice reaches the guest's lobby. The guest builds the
  same map with the quest chain. The map can't change mid-run, and unknown map ids are dropped on the
  wire.

**Live (dev server, one machine, in-app browser at 1600×900; captures under `web/artifacts/visual/`):**
- All six areas.
- The mirrors up close, at quality high:
  - plain, warped and lagging glass;
  - enemies reflected;
  - the reflection target dumped and inspected.
- All five bosses fighting, and their five portraits.
- Every quest state, set from the dev console.
- The map row on the character screen.
- `bench(120)` on high: ~5.4 ms a frame in the maze with reflections live, ~3.4 ms in the Grand
  Entrance (this machine; not target hardware).

Defects these checks found, now fixed:
- Reflections showed only floor and shins. The reflection plane now leans 12°.
- The mirror targets were under-resolved.
- The floor was visible beyond the outer walls.
- These sat in wall-hidden strips or edge-on: the quest's footprints, three pivot plates and the
  corridor clock.
- Some boss rigs were too bright.
- The circular import between the rig modules made the page fail to boot.
- The pivot glass was too bright.

**Not verified:**
- A Fun House night played by a person start to finish.
- A real multi-machine co-op night on the Fun House across networks. Co-op on this map is covered by
  the loopback tests above.
- Audio by ear. The new score, ambience and eight new SFX are synthesized and pass the "renders finite,
  audible audio" content check, but nobody has listened to them in the game yet.

---

## Playtest tuning — firing squads, party crowds, draft actions, evolutions (D-62)

**Automated:** 192 tests pass. New `tests/tuning.test.ts` covers:
- a firing-squad rank comes half as clowns;
- the party density table stays within the enemy pool;
- every evolution levels to 8, with Royal Flush faster, harder and one card more at Evo Lv 8;
- level-up cards and prize wheels level an evolution;
- the mirror's replays add 12% then 30% of your damage, and the Hall of Mirrors 36% then 50%,
  whatever the clone count.

**Live (dev server, one machine):**
- the new Reroll / Banish / Skip buttons and banish mode (screenshots);
- the wheel's coloured bulbs (canvas capture);
- the calliope icon in the tray.

**Bots:** see `PROGRESSION.md`, "Party crowds (D-62)".

**Not verified:** a human party at the new density, for difficulty and frame rate.

---

## Co-op tuning, the Puppet King's stage, the prize wheel, music — 2026-10-30 (D-61)

**Automated:** 187 tests pass (typecheck clean, production build OK). New:
- `tests/stage.test.ts`:
  - the stage centres on the party;
  - a straggler 650 units out is reeled back at no more than the cap per tick and set down inside;
  - two players walking off are both held within 60 units of the edge;
  - the ring is released on his defeat;
  - every string sweep's three lines share one direction;
  - chest prizes carry their names and levels.
- `tests/net.test.ts`:
  - a guest reeled in by the ring is predicted: 90% of host updates move it under 4 units, against 28
    with the guest-side pull removed (checked by deleting that line);
  - the slot table follows 6 - (6 - weapons) / 2.

**Live (dev server, one machine, canvas captures inspected):**
- **Puppet King:**
  - the ring of lights draws over the ticket booth;
  - a player put outside shows the taut string, and their twang played;
  - they were reeled back in about 2 s;
  - the three sweep lines moved together.
- **Prize wheel:** opened over that fight, the ring and sweep lines stop at the booth's edge. Lit, with
  vivid wedges, rim and marquee bulbs. The card reads "LEVEL UP / Cotton-Candy Gun / Level 2 / YOUR
  PRIZE" solo, and "WON BY Kevin" with co-op owners set by hand.
- **Music:**
  - the Midway plays its waltz (58 bpm), with no song track;
  - the Midway menu's Title Screen brings Bradley's song from the top, and starting again returns
    to the waltz;
  - a save without the Midway gets the song on the title menu;
  - the new file decodes at 102 s (loop 11.98-101.42 s), and the new sounds are built.

**Not verified:**
- anything by ear: the test browser has no speakers, so cues and buffers were checked, not heard;
- the Puppet King or a prize wheel in a real co-op night, or across networks;
- six players on the wider passive bars;
- mobile.

---

## The Midway hub — 2026-10-30 (D-60)

**Automated:** 181 tests pass (typecheck clean, production build OK). New `tests/hub.test.ts` covers:
- the unlock rule (a finale without True Dawn doesn't count);
- a peaceful hub: 60 s with no spawns, shots, damage or clock, the party walking, and the dormant
  bosses staying asleep;
- the cast: only unlocked members appear, all on open ground inside the map, and the coming
  attractions are hinted;
- positions kept across a rebuild;
- online: a guest lands on the host's hub, walks as their last fool, sees the host's cast, a newcomer
  is let in mid-hub, and the Big Top takes everyone to the lobby.

**Live (dev server, two tabs, real PeerJS):**
- **Solo:** pressing start lands on the Midway, with labels over the cast, Big Top and booth. Talking
  to the Carny pages through three lines and closes. The booth opens the Lost & Found and returns. The
  Big Top opens character select and returns. A gate reads "coming soon". Esc opens the Midway menu.
  A night started from the Big Top shows the run HUD, and abandoning returns to the Midway.
- **Co-op:**
  - **Hosting:** inviting from the Midway's menu shows the code on the HUD, and a friend joins
    straight onto the hub.
  - **Movement:** the friend's walking reaches the host.
  - **Big Top round trip:** the Big Top takes both to character select, and "Back to the Midway"
    returns both.
  - **Full night:** both played a night, and the results' "Back to the Midway" brought both back.
- **Defects found and fixed:** the cast had no weapons list (a renderer crash every frame). The host's
  hidden tab stopped ticking the Midway, discarding the friend's steps.

**Not verified:** the hub on the deployed site; a real six-player Midway; mobile layout.

---

## Max-out pacing, readability, connection diagnostics — 2026-10-30 (D-57 … D-59)

**Automated:** 176 tests pass (typecheck clean, production build OK). Chest tests now assert that
chests never evolve and the evolution card waits in the next draft. A party-XP test covers the ramp
and the per-party multipliers. The melody test checks one emblem wisp per true note, in order. The
six-player network test feeds XP on a timer, since parties now level slowly.

**Measured (bots, god mode, full nights):**
- **Before:** solo bots maxed at 24:42 (best of three; the other two never maxed). Duo 10:08, trio
  7:22, six players 6:23.
- **After (new curve + party XP):** solo bots finish 54–80% of a build by minute 24. Parties finish
  58–100% by minute 24 depending on size and seed.

**Live (dev server):**
- **Silhouettes:** clowns hidden inside and behind the Fun House show as red silhouettes, and they
  vanish with the x-ray switched off.
- **Lamp wisp:** the crown lamp's emblem wisp rises from the red lamp.
- **Whispers:** two arriving together sit in separate rows, and an exact repeat is dropped.
- **Prize wheel:** a plain spin has no duplicate title.
- **Opacity:** at 30%, the player's card shots render blended at 0.3 while monsters stay solid.
- **Connection check:** reads "ready for online play" here, and a two-tab lobby still connects on the
  new STUN defaults.
- **Relays:** PeerJS's relays gave 0 relay candidates over UDP and TCP.

**Not verified:** the Opera GX fix on the affected machine; a relay-backed connection (no TURN is
configured).

---

## Parties of six, music, quest and boss polish — 2026-10-30 (D-54 … D-56)

**Automated:** 175 tests pass (typecheck clean, production build OK). New: a melody-lamp test (red and
untriggerable until a wrong note; a whisper per true note); a stalled-tab keepalive test, confirmed to
fail on the old code; and six-player party tests over the lossy loopback:
- compact seats, a seventh player refused, repeated characters;
- a 40 s six-player night at 45 ± 15 ms with 3% loss: every mirror tracks the host, all five guests'
  inputs land, drafts wait for all; host upload ~116 KB/s for five guests, 3 inputs dropped;
- one guest's drop holds the night for everyone and its rejoin restarts only its own stream;
- the slot table; fair chest split; inhale reach and guest pull prediction.

**Live (dev server, in-app Chromium):**
- **Melody.** Lamps turn red when played, a played lamp stays silent, a wrong lamp resets them to
  green, and both whispers show.
- **Dead tent.** The Big Top becomes a flat striped tarp the player walks straight across, with no
  artifacts at close zoom.
- **First chest.** No shader programs compile when the first chest opens: 51 → 51, down from 12 new
  programs before the fix. Frame times couldn't be measured reliably in the throttled pane.
- **Three-tab party over real PeerJS** (host + two guests): six-seat lobby, duplicate characters, a
  three-player night with 3 + 3 slots, partner cards and colour name tags, guest mirrors matching the
  host, hold notes.
- **Defect found and fixed.** Both guests in background tabs dropped out with "Lost connection" (stale
  last-heard stamps). After the fix, both stayed connected through 30 s in the background and the
  night.
- **Music routing**, checked by state: Bradley's track on menus and bosses, the waltz in Acts, the
  quest dip to 28%. Nobody has listened to the new waltz yet.

**Not verified:** six real machines; anything across different networks; how the waltz sounds.

---

## Online co-op QA — 2026-10-30 (D-51 … D-53)

**Automated (headless, deterministic):** `tests/coop.test.ts` (12) for the co-op rules in the sim, and
`tests/net.test.ts` (27) for the netcode over an in-memory network with latency, jitter, loss and
duplication — codec edge cases, serialisation, delta replication through 20% snapshot loss with late acks
(mirror matches host exactly), prediction convergence, hostile-message validation, lobby/seat rules, a 90 s
synchronized night over 45 ± 15 ms with 3% loss (host ~16 KB/s at 20 Hz, 0 inputs dropped, guest's drawn
self within a median 15 units of the host's truth), uneven host ticking (144 Hz, bursty frames), prize-wheel
holds, pause, drop → wait → token rejoin, carry on alone, host leaving, per-player payouts. Full suite:
**166 passing**; typecheck clean; production build OK (PeerJS lazy-loaded, 123 KB chunk).

**Live, one machine, two browser tabs, real PeerJS Cloud + WebRTC** (in-app Chromium pane): host/join by
code, character exclusivity, ready/start, datagram channel up (route `host`), 20 Hz snapshots ~700 B /
~15 KB/s, coordinated drafts both ways, guest prediction equal to the host's result in four directions,
split 4-prize wheel tagged by owner, coffin + assisted revive (back at 50% HP), both-down ends the night
with per-player results, back to the lobby, guest refresh mid-night (host waited, guest rejoined its seat),
host leaving (guest notified), malformed / unknown code errors. Defects found and fixed: byte codec wrapped
negative timers (permanent hurt vignette on the guest); a per-frame idle check discarded most guest inputs
on hosts whose frames don't all tick; the guest kept predicting while the host's prize wheel held the night;
the guest's draft showed the previous level.

**Deployed site, one machine, two tabs** (https://nightmare-carnival.netlify.app, Netlify): host by code, join (lowercase
code), exclusive characters, ready/start, a running night with coordinated drafts. Guest's F3: datagram
channel, route `host`, 19–21 snapshots/s, 4–18 KB/s, 0 lost, 0 invalid, prediction error 0.0. Headers:
hashed `assets/` `immutable`, the rest revalidated, `nosniff`. Defect found and fixed: the free plan's
"Powered by Netlify" badge covered the title's credit line; menus and the credit now clear it.

**Not yet verified:** two machines on the same LAN; two machines on **different networks** (the alpha's
real goal, including a TURN-relayed connection); Firefox/Safari/mobile. Checklist: `docs/MULTIPLAYER.md` §5.

---

## Graphics pass QA — 2026-10-30 (D-45 … D-50)

**Verified (actually done):**
- `npx vitest run`: 126/126 pass (includes the new street-lamp flicker test and the model/prop library checks
  that build every prop, so the rebuilt booths, roofs and canopies are exercised).
- `npx tsc --noEmit`: clean. `npm run build`: succeeds; the capture endpoint is dev-server-only and the dev
  tools stay behind `import.meta.env.DEV`.
- Screenshots of the real game in the in-app browser at 1600×900 (High, DPR 1), inspected image by image:
  seeded states `active-play-desktop`, `late-combat`, `boss-ringmaster`, plus midway stalls, carousel,
  funhouse/north gate, east concessions, close-ups of booths/ticket booth/grandstand. Runs `before`,
  `iter1`–`iter8`, `after` in `artifacts/visual/` (git-ignored).
- Motion: a stepped frame sequence of a mass kill (`artifacts/visual/motion/death-*.png`) shows corpses
  toppling and sinking; grass sway is shader-driven (checked visually only as stills plus code review).
- Performance with `__nc.bench`: late combat 3.46 ms/frame before → ≈4.65 ms steady after; cost
  attribution by toggling (ground ≈1.26 ms after the GPU field bake, clutter ≈0.7 ms, outlines ≈0.4 ms,
  shadow maps ≈0.2 ms). Draw calls 256 → 291; triangles 2.51 M → 2.90 M (all passes).
- Pixel metrics (in-page port of the canvas inspector) recorded per capture; see `docs/VISUAL_QA.md`.

**Not verified:**
- No human playtest of readability or feel after the pass.
- No measurements on other GPUs, higher resolutions, DPR 2, or Low/Medium quality frame times.
- The packaged Playwright canvas inspector was not run (dependencies not installed); its metrics were
  reproduced in-page instead.
- Mobile/touch and physical gamepads remain untested (unchanged scope).
