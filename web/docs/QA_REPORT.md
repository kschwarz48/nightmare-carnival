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

## The game's own cursors — 2026-11-02 (D-93)

- `npm test`: 29 files, 434 tests pass; `tsc` clean; `npm run build` passes.
- **Checked in the dev build** (an Electron window; the system cursor doesn't show in screenshots, so each drawing
  was laid out on a test strip at 6× and at real size, on the night's colour and on parchment):
  - the variables hold `image-set(… 1x, … 2x)` values and the page's computed cursor is the gilt arrow;
  - the title menu's buttons show the glove; in a night, the canvas and the HUD show the sight and the tray slots
    the "?" arrow; with the level-up draft open the sight goes and the cards show the glove.
- **Not checked:** how the system draws them on a high-DPI Windows display or a Mac (Chromium picks the 2x image;
  not seen on hardware), and Firefox/Safari (they fall back to a single 1x image or the browser's cursors).

## The Last Train Home's words, and the brass cogs — 2026-11-02 (D-92)

- `npm test`: 29 files, 434 tests pass; `tsc` clean; `npm run build` passes.
- **Captures** (dev server, 1600×900): the Junction's card after the clock (it names the pages and the sleeper);
  the Works' clock's line on screen; the yard at zoom 1 with two cogs in view (each a glowing gear in its own
  light); one cog close up over 1.4 s, the glints flaring in turn; a cog carried while another still lies there.
- **Not checked:** a full play-through of the egg with the new words (each line was read on screen or in the data).

## Ticket rolls, arrows and markers, party frames, name tags, rings — 2026-11-02 (D-91)

- `npm test`: 29 files, 434 tests pass. `tests/core.test.ts`'s ticket-cap test now checks the new rule: past the
  cap the far tickets roll up and every new drop stays loose, nothing is lost, the roll counts its tickets; and far
  tickets in two places make two rolls, each picked up like a ticket. `tsc` is clean and `npm run build` passes.
- **Captures** (dev server, an Electron window at 1600×900 and 1280×720; a local four- and six-player night with the
  co-op HUD switched on in the page, since co-op needs a second machine):
  - the party frames over the health bar (3 and 5 teammates), the chat box over them;
  - name tags over the Strongman's and the Ringleader's heads; the Midway's cast label over the Carny;
  - edge markers: a teammate's portrait in pink, a downed teammate's coffin in lime, the Ringmaster's face in red,
    an off-screen chest, each with its notch toward it, and kept clear of the party frames;
  - the circling arrows toward a chest and a golden ticket, and the bigger arrows over them;
  - the rings close up and in a crowd of 26 creatures, where the arcs and notch stay visible;
  - a ticket field over the cap: the 40 newest drops stay loose round the player, the far ones become two rolls.
- **Found by looking, and fixed:** the rings washed out to white (deeper colours, less glow); a crowd hid the ring
  (the arcs and notch moved to the layer over everything); the Midway's labels sat across faces too.
- **Not checked:** an actual online session (the co-op HUD was switched on locally; nothing about it is on the
  wire); a phone-sized window.

## The Ghost Train at the whistle, the Last Train Home's new first half, the Unclaimed — 2026-11-02 (D-90)

- `npm test`: 29 files, 433 tests pass. `tests/ghosttrain.test.ts` replaced its timetable tests: the train waits
  at a platform, leaves 4 s after the whistle only with somebody aboard (a pull with nobody aboard is answered
  "stay"), comes back empty for a stranded party, takes the End of the Line from 25:00 or on the quest's
  journey, terminates from 32:00, and packs into 12 bytes that a guest reads back exactly. New: the registry's
  seven bosses, the final boss held until every other has fallen, the Unclaimed reaching all three phases, the
  reworked chain played through solo inside a night, each clock refusing to be wound until its trouble is
  mended, the signal missed (the train runs on) and then shown green (to the End of the Line), the co-op bytes.
  `tsc` is clean and `npm run build` passes.
- **Bots** (headless):
  - `scripts/gt_smoke.ts 240`: the whistle bot rides J → V → C on its own pulls (four transfers in four
    minutes, 64 creatures at most, no faults);
  - a 36-minute god-mode night: every boss spawns in order; the Night Express waits while the Unclaimed lives,
    and the clock stops at 34:59 until the Express comes;
  - `scripts/gt_bossttk.ts` at b4: the Hour Thief 54 s, the Unclaimed 55 s, the Night Express 69 s.
- **Captures** (dev server, one 1600×900 Electron window, the quest set to each step): the key under its bench,
  the sleeper shut and open (doors and the four pages), the grave lamps unlit and lit, the candles at the
  porch, the bell ropes' spots against the modelled ropes, the tomb's vigil, the ladle on the yard rails and on
  its spur, the three frozen villagers and one waking, the jetty and the pendulum, the lamp box red and green
  with the battery fitted, the HUD's line (no times), the Unclaimed.
- **Found by looking, and fixed:**
  - the sleeper's doors and pages weren't drawn at all close up (the carriage culling sampled three points
    1500 apart); then the slid-open doors (taller than the partition) hid the pages behind them: doors at
    the partition's height slide away inside it, and the pages drift high enough to show over it;
  - the grave lamps were a small dark box behind the headstones: a lantern on an iron crook between them, a
    faint glint while unlit, a halo when lit;
  - the altar candles stood behind the chapel from the camera, and so did Eli's bell rope spots (an older
    slip: the ropes are modelled on the south porch): both on the porch now;
  - the vigil's ring stood on an empty path crossing: the empty grave is there now, a chest tomb with its lid
    pushed off;
  - the yard's tub rails read as white lines (drawn twice over by the ladle's overlay): the overlay is gone, the
    spur is the floor's, and the rails are dark iron on sleepers;
  - Stillwater's moments were white blobs: the Still Folk, Newsboy and Signalman sculpts held mid-step,
    frost-pale, in a batch of their own (they had picked up the enemies' red x-ray where a roof covered a foot);
  - the fitted battery was inside the lamp box: on top of it.
- **Shader health:** `__nc.inspect.shaders()` clean after visiting every new fixture (58 programs).
- **Not checked:** a human play-through of the whistle-driven night and of the new quest; co-op across machines
  (only the bytes in tests); the frozen villagers' waking as video (one mid-wake frame captured); balance of the
  new station steps beyond the bot and the tests.

## The other maps' humanoids in layers — 2026-11-02 (D-89)

- `npm test`: 29 files, 428 tests pass. One is new, in `tests/characterArt.test.ts`: each of the 26 rebuilt
  figures keeps its role's budget (15k regular, 38k miniboss), its skeleton and extra bones, its clips (the
  drowned's and the gravebound's `rise`), its height within 10%, and nothing below the floor. `tsc` is
  clean and `npm run build` passes. The playable cast's triangle counts are unchanged by the toolkit move.
- **Captures** (dev server, the inspector, one 1600×900 Electron window; baselines from the committed code):
  every figure from the game's angle (front, 3/4, back), at eye level in studio light, mid-walk and
  mid-attack, before and after, and again after each round of fixes (four rounds).
  Sheets (`web/artifacts/visual/d89/`, git-ignored): `cmp-d89-<map>-<n>.png`, each figure before and after at
  the game's angle and at eye level.
- **Found by looking, and fixed:**
  - belts floating round the waist like hoops (the search caught the arms): found on the body alone;
  - the ticket taker's tails cut off with his coat's hem: on a layer of their own;
  - the drowned's ribbed cap read as a target from above, and kelp down his chest as a beard;
  - narrow V's ragged at these cells (navvy, signalman, doppelganger): cut wider;
  - the slag golem washed gold by its own core's bloom: a smaller, warmer core, dimmer cracks;
  - three faces scowling or worried the wrong way round (`browTilt` read backwards);
  - the Watcher's chest a ball on a stick: a frock coat's body;
  - the mannequin's waist seam and the thief's belt caught on the arms; a marionette's sleeve band floating;
  - the signalman's lamp glass hidden inside its can.
- **Seen and left:** the slag golem keeps a bronze cast in game light from its warm rim (its readability
  setting, as before); V-neck edges are still a little uneven on the coarsest garments; the glasswalker must
  be stepped out of the glass to be seen in a frozen lineup (its own behaviour).
- **Shader health:** `__nc.inspect.shaders()` was clean in every capture run.
- **Measured** (ms a frame, two 240-frame runs, original and new code alternately):

  | Scene | After | Before |
  |---|---|---|
  | Fun House crowd, 80 | 5.7–6.7 (8.2–9.0 M triangles) | 5.2–6.1 (6.8–7.4 M) |
  | Boardwalk crowd, 66–90 | 5.5–6.1 (5.0–5.8 M) | 4.7–4.9 (3.7–4.2 M) |
  | Ghost Train crowd, 59 | 3.9–4.5 (3.8 M) | 3.8–3.9 (3.5 M) |
  | Late combat, first map (control) | 3.4–4.7 | 3.6–4.6 |
- **Scorecard** (the other maps' enemies, 0–3): **Enemies 2 → 2.5:** designed faces and costumes with
  modelled edges on every humanoid, a silhouette from above for each; **Materials 2 → 2.5:** porcelain, chrome,
  glass, velvet, crape, brass, iron and slag read as themselves.
- **Not checked:** motion as video (poses held in the inspector; clips unchanged); a slower GPU; the
  figures in real waves on their maps beyond the benched crowds.

## The enemy roster on the character art standard — 2026-11-02 (D-88)

- `npm test`: 29 files, 427 tests pass. Three are new, in `tests/characterArt.test.ts`:
  - small details draw no ink unless asked, and larger ones keep it;
  - the three rebuilt first-map regulars keep a regular enemy's budget (under 15k), their skeletons (the
    monkey's `key`) and their `move` and `attack` clips;
  - every creature builds under 38k and keeps both clips.

  `tsc` is clean and `npm run build` passes.
- **Captures** (dev server, the inspector, one 1600×900 Electron window; baselines from the committed code):
  - the whole roster in ten lineups, before, after the shared pass, and after the tighter blends: the game's
    angle, 3/4, eye level in studio light, play scale 1:1;
  - every creature alone at the game's angle and at eye level; the rebuilt ones also from the back,
    mid-walk and mid-attack;
  - all 22 bosses in their fights (13 from their own test states, 9 woken on their maps).
  - Sheets (`web/artifacts/visual/d88/`, git-ignored): `cmp-d88-<creature>.png` for the dunk-tank clown, the
    puppet soldier, the wind-up monkey, the whack-a-mole, the prize collector and the drowned bather;
    `cmp-d88-lineup-<group>.png` for four lineups.
- **Found by looking, and fixed:**
  - the whack-a-mole's hard hat and the monkey's cymbals were solid black (inverted lathe profiles);
  - the prize collector's check suit read as camouflage blotches (a 3D checker in vertex colour);
  - the dunk-tank clown's first rebuild had hair strands and paint runs crossing his face, which read as
    dirt.
- **Seen and left:**
  - the glasswalker doesn't show in a frozen lineup: it stays behind the glass between visits (its own
    behaviour, the same before);
  - the taffy horror keeps its vertex-colour twist (a spiral that no per-pixel pattern can draw yet);
  - the coal and slag creatures keep their glowing noise.
- **Shader health:** `__nc.inspect.shaders()` was clean in every capture run.
- **Measured:**
  - **A mixed crowd of 62:** 3.4–4.3 ms a frame against 2.8–3.4 ms, 3.4 M triangles against 3.0 M (original and
    new run alternately).
  - **Late combat:** 3.4–4.4 against 3.2–4.6 ms, no measurable change.
  - **The rebuilds:** 12.3k, 10.2k and 9.0k triangles (were 6.1k, 6.5k and 5.8k).
- **Scorecard** (the enemy roster, 0–3):
  - **Enemies 1 → 2:** clean colour, crisp patterns, no ink blots and defined forms across the roster; the
    first map's humanoids rebuilt with designed faces and silhouettes from above;
  - **Materials/textures 1 → 2:** no noise mottling, per-pixel costume patterns.
- **Not checked:**
  - motion as video (poses held in the inspector; clips unchanged);
  - the bosses changed (analysed and left);
  - a slower GPU.

## The playable cast on the character art standard — 2026-11-02 (D-87)

- `npm test`: 29 files, 424 tests pass. The new one, in `tests/characterArt.test.ts`, checks each of the six:
  - its budget (under 70k triangles);
  - its skeleton with its own extra bones (`skirt`, `ball`, `plush`, `tails`);
  - its clips (`idle`, `move`, `cast`, `hurt`, `dash`);
  - its height (the top of the hat or hair, near where it stood);
  - that it carries per-part ink choices.

  `tsc` is clean and `npm run build` passes.
- **Captures** (dev server, the inspector, one 1600×900 Electron window; baselines from the committed models):
  - the six in two lineups at the game's 50° angle in game light (front, 3/4), at eye level in studio light
    without the grade, and at play scale 1:1;
  - each alone, close: front, 3/4, back, eye level, mid-walk, mid-attack.
  - Before and after sheets (`web/artifacts/visual/d87/`, git-ignored):
    - `cmp-d87-1a-gameplay-angle.png`, `cmp-d87-1b-gameplay-angle.png`;
    - `cmp-d87-2a-eye-level.png`, `cmp-d87-2b-eye-level.png`;
    - `cmp-d87-3-play.png`.
- **Found by looking, and fixed:**
  - **The Commodore's tie ran out through his back.** Its end sat on the shirt's rounded lower edge, where
    the surface search found nothing.
  - **Mira's crown showed skin through her hair.** Below volume 1.0 the toolkit's hair cap sits under the
    skull's top.
  - **The Lost Child's beanie hid her eyes from the game camera.** It's pushed up and back now, and her idle
    looks down less.
  - **The Commodore's mutton chops** stuck out like ears. His V was too shallow, so the tie read as a smudge.
  - **The Ringleader's cream breeches** read as bare legs beside his skin. They're a cooler white now, with a
    flatter seat.
  - **The Fortune Teller's headscarf** read as a red bathing cap. It's fitted now: cut on a slant from the
    hairline to the nape, with a rolled hem and a knot. Two dark slashes on it were hair poking through at
    the upper sides, and the outlines of the hair and side locks under it.
  - Four models were over budget on the first build.
- **Shader health:** `__nc.inspect.shaders()` was clean in every capture run.
- **Scorecard** (the cast only, 0–3):
  - **Hero/player 1 → 2:** layered, readable figures, faces from the game camera, each costume read from above
    (the leotard, the scarf, the cap, the beanie, the top hat, the bun);
  - **Materials/textures 1 → 2:** distinct families, per-pixel spots and ribbing, no noise.
- **Not checked:**
  - motion as video (poses were held in the inspector; the clips are unchanged apart from the Lost Child's
    idle head);
  - co-op on two machines (no wire change);
  - a slower GPU (+4% triangles, at most six figures).

## The character art standard: three benchmarks, figure materials, layered sculpts — 2026-11-02 (D-86)

- `npm test`: 29 files, 423 tests pass. 5 are new, in `tests/characterArt.test.ts`:
  - sculpted vertices lie on the true surface (worst |field| < 0.08 on a test ellipsoid);
  - occlusion is kept as data with flat colour and a crisp seam (under 4% of vertices mixed);
  - a part's pattern and ink choice reach its vertices, and layered geometry carries every attribute;
  - each benchmark's budget (Carny < 70k, Clown < 15k, Brute < 38k triangles), its skeleton's bone names
    and its clips (Carny `idle`, `move`, `cast`, `hurt`, `dash`; creatures `move`, `attack`). The Carny's
    crown stays at 84–98.
  - `tsc` is clean and `npm run build` passes.
- **Captures** (dev server, the inspector, one 1600×900 Electron window, full-resolution CDP screenshots;
  baselines taken with the original models and shading restored from git):
  - the three benchmarks at the game's 50° angle in game light (front, 3/4, side, back), in studio light
    without the grade, at eye level, without ink, and at play scale 1:1;
  - active combat: a real night with 9 Evil Clowns and a Brute around the Carny, unfrozen for 1.6 s, then
    held.
  - Before and after sheets (`web/artifacts/visual/d86/`, git-ignored):
    - `cmp-1-close-gameplay-angle.png`;
    - `cmp-2-gameplay-scale.png`;
    - `cmp-3-eye-level-studio.png`;
    - `cmp-4-combat.png`.
- **Found by looking, and fixed:**
  - The Carny's V showed a dark groove: the cut was shallower than the waistcoat.
  - The Clown's ruff was hidden under his head, and his pompom floated off the hat.
  - The Brute's hood weave read as stripes, his crown tie as a horn, and the hood the same tan as his arms
    (no value separation).
  - Hidden layers leaked ink through the garments over them; they are now ink-off.
  - **Every static prop stopped drawing** (lamp posts, signposts, grass) in the first after captures. The
    shared shader declared the new figure attributes for every variant, and instanced props went over the
    GPU's vertex-attribute limit ("Too many attributes", found by bisecting the files, then reading the
    program logs).
    - The figure data is now opt-in per geometry (`NC_OCC` / `NC_PAT`).
    - `__nc.inspect.shaders()` reports failed programs, and is clean now.
  - The Carny's rag read as a third leg; his nose was long.
- **Seen and left:** shadow-map stair-steps on the figures at close inspection zoom with the studio light.
  They're not visible at play zoom, and the shadow resolution is unchanged.
- **Regression lineups** after the shared material and projection change: the six heroes, 13 first-map
  creatures, and 13 creatures from the other maps. No artifacts; glossy accents (eyes, brass, leather,
  rubber) now differ from cloth.
- **Measured:**
  - **Triangles:** Carny 64,340 (was 56,256), Evil Clown 13,960 (was 8,490), Carnival Brute 35,432 (was
    11,524).
  - **Sculpt time:** 0.65 s / 0.18 s / 0.28 s (was 0.97 / 0.17 / 0.12).
  - **Stress scene** (40 Clowns, 2 Brutes, the Carny, 60 enemies, 240 frames; original and new run
    alternately): 4.6–5.4 ms/frame and 3.84 M triangles, against 2.5–3.3 ms and 2.9 M.
  - **The new pipeline with the old models:** 3.1–3.2 ms. That run first showed +1.3 ms, traced to figures
    using the lamp pool's specular and to every figure carrying the pattern path; both are fixed.
  - **A boss fight** (the Ringmaster, not rebuilt) before and after: no visible change
    (`cmp-5-boss-materials.png`).
- **Scorecard** (the benchmarks only, 0–3):
  - Hero/player 1 → 2: a layered, readable figure with a face from the game camera;
  - Enemies 1 → 2: role-specific forms and a silhouette from above (the ruff, the hood, the sledge);
  - Materials/textures 1 → 2: distinct families, crisp per-pixel patterns, no noise;
  - Performance evidence 2 → 2: budgets, a before and after stress test, tradeoffs noted.
- **Not checked:**
  - the rest of the roster rebuilt (left for review);
  - motion as video (poses were held and stepped in the inspector, and the clips are unchanged);
  - a slower GPU;
  - two-machine co-op (rendering only, no wire change).

## The live Lost Tickets count, the damage meter, the party frames, the mirror's own damage — 2026-11-02 (D-85)

- `npm test`: 28 files, 418 tests pass. 13 are new, in `tests/meter.test.ts`:
  - hits are booked to their player by weapon line (all of a player's damage is booked to some source); an
    evolution keeps its base weapon's line and clock;
  - the mirror: for seven weapons (shots, swings and follow-ups, lobbed blasts, shrapnel, burns, stings, the
    bell's slams), the weapon's own total with a Lv 8 mirror stays under 108 % of its total alone, and the
    mirror books its share;
  - a clone's projectiles carry the mirror as their source and the player's carry none; Mira's Glass Halo is
    the mirror's;
  - a burn's and a sting's ticks go to whoever lit them; the Blizzard's shatter to its owner; the coaster's
    damage to nobody;
  - the results list each player's own weapon damage;
  - the live Lost Tickets equal the payout when the night ends, plus the vouchers; the win counts once the
    final boss is down; each player is paid at their own Greed;
  - the `meter` message round trip, and malformed ones refused.
  The old mirror test now checks that the clones' share is booked to the mirror, not the cards. `tsc` is clean
  and `npm run build` passes.
- **Measured (the mirror, ten seconds at Lv 8, each weapon alone and with the mirror):** each weapon's own
  total with the mirror at 84–104 % of its total alone, the mirror 20–37 % on top (cards 104 % / +25 %, mallet
  84 % / +20 %, popcorn 99 % / +27 %, darts 100 % / +29 %, grill 88 % / +23 %, cotton 88 % / +37 %, bell
  88 % / +27 %).
- **In the browser** (dev server, solo):
  - the meter with five weapons and a Lv 8 mirror, close up: weapon icons, bars coloured by weapon, "898
    (9.9)", the mirror's own bar;
  - the Lost Tickets line under the kills;
  - folding the meter from its header and M hiding it (with its note), both remembered; Settings' toggle and
    the "Damage meter: M" binding;
  - a local three-player night (no network): the party frames, a portrait's build card beside the frame, the
    party meter and a player's breakdown;
  - the edge arrows stepping aside from the meter and the frames.
- **Two windows on this PC** (Electron, real PeerJS/WebRTC, not two machines): host and guest played 25 s.
  - Both meters showed both players. The guest's numbers came from the host's `meter`, within a second of the
    host's.
  - Each window's Lost Tickets count was its own player's (10 and 10).
  - Each saw the other's party frame. The guest's breakdown of the host's bar listed the host's weapons, and
    the host's portrait showed their build.
  - At the end, the guest's results listed its own weapons' damage, matching the host's books for it.
- **Not checked:**
  - two machines on different networks;
  - a six-player party's frames and meter (sized and laid out for it, not seen);
  - a human night with the meter open.

## The Undertow's dial, guests' results, the Ghost Train's edges and lamp, the late line, companions — 2026-11-01 (D-84)

- `npm test`: 27 files, 405 tests pass. 10 are new:
  - `tests/pets.test.ts` (5): each companion's passive lands on its own player only, both achievements are
    earned (and not when they shouldn't be), the save offers only an earned companion, and a party's
    companions reach the start config and the right players.
  - `tests/ghosttrain.test.ts` (5): the walled coupling pocket, the rescue from inside a departed train's
    walls, carried in a doorway but not pressed against the outside, a boss quieting only its own station,
    the signal lamp (dark, red, a signal passed at red stays, at green clears).
  - Two updated: the doors shut at 0, and journeys board out of sight or over the ends. The play-through
    uses the battery and lamp box. `tsc` is clean and `npm run build` passes.
- **In the browser** (dev server, solo, `artifacts/visual/d84gt2/`, `d84gt3/`):
  - Milo and Augustus following on the Midway and through Ghost Train nights. The Companions panel locked
    and unlocked, with the portraits.
  - Ada's Conch's icon. The Undertow's dial sweeping. The Lost & Found's scroll kept (726 → 726) on a toggle.
  - The Ghost Train gate's prompt: "E · Board the Ghost Train · a night on the Midnight Line".
  - The Big Top: a player walking at it from five directions stops 168 from its centre (156 + their radius),
    against the canvas.
  - Swap Character: Carny → Strongman where they stood, the pick saved, the companion kept.
  - The Ghost Train's edges: each station's gate, and the side fences with piers and lamps at play zoom and
    close up (St. Vesper's, the Cinder Works, Stillwater, the End's brink).
  - TICKETS over the booking window, the signal box's nameboard and the fingerpost.
  - The train's signal lamp dark, red and green at the Junction stop. The battery by the signal box, then
    carried.
  - The Navvy beside a Porter and a Ticketless.
- **Two windows on this PC** (Electron, real PeerJS/WebRTC, not two machines): host and guest ended a night.
  The host pressed Back to the Midway, and the guest's results stayed up 4 s later, the button relabelled
  "Back to the Midway" with the Midway built behind. The guest pressed it and joined the host's Midway
  (both players there).
- **Bots:**
  - `scripts/gt_smoke.ts 2100`: a whole ridden night in god mode, 40 transfers, every station, no faults.
  - A scratch run killed the bosses at 30:30 and compared the crowd after the Night Express. The new
    victory lap: 167–272 standing, 125–218k hp. The old roster, same seed: 152–180 standing, 13–19k hp.
- **Not checked:**
  - Exit Game (the Windows app only; the desktop build wasn't run).
  - The arrival whistle by ear.
  - Swap Character, companions and the results flow across two machines.
  - A human play-through of the new balance.

## The attacks' opacity reaching 0 — 2026-11-01 (D-83)

- `npm test`: 26 files, 394 tests pass (3 new, `tests/opacity.test.ts`). A night with the mallet, bell, cannon
  and fireworks tags swings, rings and explosions as attacks, and never a death, a damage number or a shake. The
  tag reaches a co-op guest's mirror. The effects renderer draws tagged effects at half strength at 0.5 and not
  at all at 0, and leaves the rest exactly as it was. The renderer and sim tests both fail with their change
  taken out.
- In the browser (dev server): a Carnival night frozen with cards, fireworks, crystal orbs, two mirror clones,
  three plush companions and the cannon, captured at 1, 0.4 and 0 (`artifacts/visual/d83b/`). At 0 none of them
  shows, and the player and everything else stay. At 0.4 they are faint, the clones pale see-through figures
  with a faint rim. The renderer's state at 0: every attack batch at opacity 0, its ink at 0, no shadow; the
  players' batch unchanged. The Settings slider runs 0–1 and stores 0.
- Not checked over the network in co-op, or on the other maps (the setting doesn't depend on the map).

## Ghost Train co-op fixes — 2026-11-01 (D-82)

- `npm test`: 25 files, 391 tests pass (4 new). Every map's extent round-trips the wire (net). Creatures and
  tickets at St. Vesper's and Stillwater's east ends, at the End of the Line and aboard the moving train reach
  a guest's mirror exactly (ghosttrain). A mirror whose map the attract demo switched walks on from where it
  stands and keeps St. Vesper's camera (ghosttrain). A stall of both tabs at once keeps the guest, and a dead
  line after a stall is still dropped (net). Each new test fails with its fix taken out: the creature at
  St. Vesper's east end lands 408 units short, the guest snaps 5760 units back toward the Junction, the guest
  is dropped.
- Two real game windows on this PC (Electron, fresh profiles, the dev-hooks build), joined over WebRTC through
  PeerJS like any co-op game, the host on the Ghost Train:
  - creatures held at St. Vesper's east end (x 8250–8620) and aboard the moving train (y 9560–9620) showed on
    the guest exactly where the host had them (0.00 gap);
  - the guest paused, opened Settings for 3 s (its paused night behind them, the attract demo not ticking),
    went Back and resumed: still at St. Vesper's east end where the host had it, the camera with it (x 7910,
    paused and playing); the host's round trip the same;
  - from a cold start (both windows building the Ghost Train as the night started) the guest stayed
    connected, twice; before the stall fix the same cold start dropped it.
  Screenshots looked at: the guest at St. Vesper's east end with the creatures around both players, and the
  Settings over the paused night.
- Not tried on two machines or networks; the 12–15 s freeze of a first Ghost Train start remains.

## The Ghost Train's night music — 2026-11-01 (D-81)

- `tests/audio.test.ts` (8, 5 new): the song from its first note on the line's night, no waltz, no drone,
  through an Act change; a boss cuts it for the boss song played through, then it comes back from the top;
  the rest between play-throughs and a boss arriving in it; a new night starting it fresh; it coming in when
  it arrives, and the waltz standing in when it can't load. `npm test` 25 files, 387 tests pass; the build
  builds.
- In the browser (dev server, a real Ghost Train run): the song fetched (200) and decoded (98.55 s) after the
  menus' song; the night started on it at gain 1, the waltz and drone off; the Stationmaster's arrival
  switched to "Freaky Funk Circus"; with the boss dead the boss song kept playing, and once it ended the
  night's song came back from its first note; at the song's end it came back after the 1 s rest. Checked
  through the engine's state (sources, buffers, gains), not by ear.

## The Ghost Train, a fourth map — 2026-11-01 (D-80)

- **Automated:** `npm test` 25 files, 382 tests pass, among them `tests/ghosttrain.test.ts` (19): the registry and
  the 35-minute night; the timetable (first arrival, doors, the End of the Line from the final act and from the
  points, the terminus, an `eFrom` set mid-run never rewrites the timetable already run); a player, a creature
  and a ticket carried from the Junction to Saint Vesper's at the same spot to the unit; a moving train sealed;
  journey creatures boarding only within 40 units of the tender's coal and the rear platform's railing, none
  while nobody rides; station creatures only of their home, never in the carriages; the Stationmaster meeting
  the party and following it to the Cinder Works; the Night Express the End of the Line's; the phantom doors;
  The Last Train Home played through solo stage by stage, its last ticket punched before dawn, to the
  Conductor and the true dawn; timing-bound steps refused outside their moment and retried; the co-op bytes
  (stage, `eFrom`, levers, bells, hour, carriers) reaching a guest's mirror, whose timetable equals the host's;
  the save (`beat_leviathan` or `?unlock=ghosttrain` opens it) and the payout to the map's own dawn.
  `tsc --noEmit` clean; `npm run build` builds.
- **Accelerated runs:** `scripts/gt_smoke.ts 2300` (a god-mode bot that boards at every station, rides, and
  takes the phantom door after 29:00): 40 transfers, every boss spawned where the bot stood and followed it
  (the Stationmaster, the Stoker, the Widow, the Iron Foreman, the Hour Thief all fell), the last train
  terminated at the End of the Line at 27:35 and the bot stayed there; the Night Express came at 30:00 and the
  bot's own weak drafting could not finish it before 35:00 (it trimmed afterwards; see D-80). At most 138
  creatures alive; at most 136 aboard (a station's crowd that followed the bot into the parked carriages
  rides along with it).
- **Boss time-to-kill** (`scripts/gt_bossttk.ts 1`, bot in god mode with strong builds, before the trims):
  Stationmaster 58 s (two weapons), Stoker 67 s, Widow 50 s, Iron Foreman 118 s, Hour Thief 54 s, Night Express
  84 s, Conductor 78 s; the Boardwalk for scale: the Last Ride 34 s, the Leviathan 42 s, the Commodore 58 s.
- **Performance** (Electron on the RTX 2070, 3440×1440, High; `desktop/bench.js --only=ghost,boardwalk`):
  the Ghost Train late with 400 creatures 100 fps (frame p95 12.3 ms, p99 18.2 ms, GPU 9.1 ms mean,
  240 draw calls, 12.4 M triangles; sim 1.9 ms a tick, of it collisions 1.46 ms: the crowd packs tighter in
  a station than on an open map); the Night Express fight with 150 creatures 131 fps. The Boardwalk late
  with 400, the same run: 85 fps, GPU 11.2 ms. Boot: the 21 new sculpts add about 1.6 s of worker time.
- **Visual inspection** (screenshots in `artifacts/visual/gt1…gt5`, inspected): every station at its dwell,
  the coach, the dining car, Car 13, the tender, the observation car, a station sliding in alongside the
  moving train with its signal at clear, all seven bosses. Fixed from them: a haze over the moving train
  (the carriages' lights were too strong and too high; lowered, fewer), unreadable carriage floors
  (brighter, patterned), an over-bright church clock and fountain, the Cinder Works' gantry (it read as a
  dark frame from above; now a pit-head winding frame), a flat terminal façade (pilasters, cornice, arched
  windows lit within, the great doorway), sparse station grounds (dressing and more lamp posts).
- **Not done here:** a human play-test of the full 35 minutes, solo or co-op, and a cross-network co-op
  session on the new map (the co-op logic is covered by the tests above, locally). Known limitations:
  `GHOST_TRAIN.md` §11.

## Engineering optimization pass — 2026-10-31 (D-73)

**Changed:**
- Rendering and loading: tiled light culling, background shader compilation, sculpting and sound
  synthesis in workers, no shader info-log reads in shipped builds.
- Co-op: the host input queue fix, 30 Hz small snapshots, guests' own shots start at their character,
  protocol 11 with a simulation fingerprint.
- Tools and platform: the F2 developer overlay, `?legacy` switches, `version.json` and the in-game
  Restart & Update, the Windows desktop shell (`web/desktop/`), the deploy script, CI workflows.

Decision: D-73. Full method and numbers: `docs/ENGINEERING_OPTIMIZATION_REPORT.md`.

**Automated:** 306 tests pass in 21 files; typecheck clean; the production build passes. New tests:
- `optimization.test.ts`: the tile masks (every reachable tile marked and no others, a full pool, the
  A/B switch), the worker pack/unpack round trip (attributes, index, baked rig), the update checker
  (newer, incompatible, older, offline, once a minute, never under the dev server), the perf rings.
- `net.test.ts`: a hello with the same protocol but another simulation fingerprint is refused, naming the
  host as the newer side.

**Measured (Electron 44 / Chromium 152, RTX 2070, GPU timer queries):** see the report for the tables:
- the production build both ways (`?legacy`) at 1920×1080 and 3440×1440;
- the light-culling A/B on frozen scenes;
- pixel comparisons;
- the run-start profile;
- the worker checksums;
- the network stress matrix (RTT 0–200 ms, jitter, 1%/3% loss, bursts, reordering).

**Not verified:**
- a person playing any of it;
- co-op across real networks after these changes;
- a clean Windows machine;
- a physical controller in the desktop app;
- a real shell update from a published release;
- mobile.

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

## Four-player playtest round — 2026-10-31 (D-74)

**Changed:**
- Co-op items and evolutions are personal; guests draft from their own unlocks.
- Party Favors on the co-op prize wheel.
- A Lost & Found button on the ready-up screen; PROTO 12.
- Enemies walk around walls (`sim/nav.ts`).
- The first map's musketeers halved and made sturdier.
- A full weapon audit with mechanical fixes and new numbers (`docs/WEAPON_AUDIT.md`).
- The UI scales to the window (1080p → 1, 1440p → 1.33, 4K → 2).

Decision: D-74.

**Automated:** typecheck clean; the production build passes; 321 tests pass in 23 files (14 more than
before this round). New tests:
- `nav.test.ts`: around a building; out of a spawn inside one; balloons through; through the Fun House maze.
- `weapons.test.ts`: the orb barrier's outward shove and its fatigue; the orbs' uptime; mirror clones never
  starving your shots, and at most four clones; webs not stacking but ramping; lasers cutting what they
  sweep; the bumper's peel-out bump; the blizzard's plain hit on common creatures.
- `coop.test.ts`: every player can take every item; evolutions are personal; Party Favors grant +1 level
  to everyone; solo nights never see them.
- `net.test.ts`:
  - profiles and starts keep only draft-pool unlocks;
  - a guest at the Lost & Found shows as away and can't be started without;
  - its new perks and unlocks reach the host;
  - each player drafts from their own unlocks;
  - the guest's mirror gets the same sets.
- `overhaul.test.ts`: the balloon-drift direction check now samples two nights. The night's random
  stream changed, and seed 4242 alone drew 2 of 8 directions; other seeds draw 3–4.

**Measured (headless bots, Node 22):**
- **Musketeers 12:00–18:00, three seeds:** alive 29.4 → 8.8 on average (peak 127 → 40); shots 143 → 56 a
  minute.
- **Walls:**
  - Cost: 60–90 µs a tick.
  - Crowd within 300 px of the player: Carnival 3.7 → 3.5; Fun House 8.3 → 6.4; Boardwalk 4.8 → 8.8.
  - Walkers far from every player that stayed put 8 s or more in a 10-minute night: none on the Carnival
    or the Boardwalk, five on the Fun House. Those five were routing the long way to a maze entrance,
    with walls between them and the player.
  - A rail bug was found and fixed this way: a creature pressed against a thin rail was sent across it.
- **Weapons:** `scripts/bench/weapons.ts` before and after, in `docs/WEAPON_AUDIT.md`.

**Checked in the browser (dev server, the in-app browser's viewport emulation):**
- At 1920×1080 the UI layer is 1920×1080 at zoom 1.
- At 2560×1440 it lays out at 1920×1080 and scales 1.333: the logo and the press text 1.33× and centred;
  the Midway's labels over the Big Top and the Carny's stall; the HUD's tray, health and XP bars in
  proportion; the Lost & Found panel inside the window.
- The lasers and orbs in a live run at 1440p.

**Not verified:**
- A person playing any of it: the walls' feel, the new weapon numbers, the orb barrier.
- Party Favors on screen (the wheel's card and caption); covered by tests only.
- The lobby's Lost & Found button in a real co-op session; covered by session tests only.
- Ultrawide 3440×1440 itself (the zoom formula gives 1.333 there, the same as 2560×1440), 4K, Firefox and
  Safari (container units need Firefox 110 / Safari 16).
- Co-op across real networks after these changes.

## Bug round — 2026-11-01 (D-75)

**Changed:** the chat log (opens at the newest line, resets each night), recipes on passive cards, the Whole
Troupe on purchase and on opening the Lost & Found, the Midway's invite/join through the name screen, the
Fun House mural's emblems (and one before each plinth) and its whisper, the results screen's Lost & Found in
co-op. Decision: D-75.

**Automated:** typecheck clean; 322 tests pass in 23 files (`meta.test.ts` adds the Whole Troupe on the last
purchase and on an older save). The UI flows below have no automated tests (the suite runs without a DOM).

**Checked in the browser (dev server):**
- The chat: 30 lines aged out, then opened: it lands on the newest (scroll 395 of 717, the last line in
  view); a new night: 30 lines → 0.
- A level-up with three passives: Lucky Ticket shows Throwing Cards lit (Lv 1/8) + "✓ this card" = Royal
  Flush, and the Strongman Bell dim; the others list their two evolutions.
- A save owning every performer without the achievement: opening the Lost & Found announces it, adds 150
  Lost Tickets and the list reads ✓ Earned.
- Invite Friends on the Midway: the online menu with the name selected; typing a new name works (the chat
  key doesn't open the chat) and nothing hosts until Host a Game.
- The Fun House gallery's plinth emblems and the crisp mural; the mural whisper and its chat line naming the
  emblems in the night's order.
- A two-tab co-op party over PeerJS (host + guest on the same machine), lost on purpose:
  - the guest's Lost & Found kept it in the party;
  - the host's took everyone to the Midway with the lobby still open and opened the shop;
  - the guest stayed in its shop with the Midway behind it.
- Found and fixed this way:
  - Back from the Lost & Found could leave you stuck in the shop when the Midway had to be rebuilt (from a
    solo results screen); re-checked: Back lands on the Midway.
  - A guest's Back after the host moved everyone went to the lobby instead of the Midway.

**Not verified:**
- The re-run of that last guest fix: the browser pane was hidden and the game doesn't run there; covered by
  reading the message order through the code.
- The host and guest on separate machines.

## Stranded guests, the projector, the regen perk — 2026-11-01 (D-76)

**Changed:**
- Every start names its game, and input packets and snapshots carry it (PROTO 13), so a rebuilt Midway no
  longer strands a guest.
- The projector's warm-up shows live: an arc on the floor and a bar with what to do.
- HP regeneration moved from the Funnel Cake passive to a Lost & Found perk.

Decision: D-76.

**Automated:** typecheck clean; 324 tests pass in 23 files. New tests:
- `hub.test.ts`: a guest walking a loop on the Midway while the host rebuilds it, with 60 ms of latency. It
  fails on the old code (44 px walked in the second after the rebuild) and passes now.
- `net.test.ts`: input packets round-trip their game number.
- `meta.test.ts`: the perk's prices, its regeneration in a run, and Funnel Cake never offered in a draft.

**Checked** (the dev server in the desktop bench runner's Electron window, since the browser pane was
hidden):
- The projector step staged mid-charge with the player in the ring: the bar reads "Warming up · stay in
  the ring (20s)" at 37% and climbs; the gold arc fills around the ring (screenshot inspected).
- The Lost & Found lists *Funnel Cake, +0.2 HP regen per second* (5 levels, 50 LT) with its icon.

**Not verified:**
- The stranded-guest fix in a real two-machine session; covered by the session test.
- A person reading the projector's indicator.

## Lasers, crystal balls, the projector, the Glasswalker — 2026-11-01 (D-77)

**Changed:** the laser beams' colours (no white core), the orbs' model (crystal balls with an aura), the
projector beam's brightness, the Glasswalker's health (172 → 135). Decision: D-77.

**Automated:** typecheck clean; 324 tests pass in 23 files (no new tests: visuals and one number).

**Checked** (screenshots inspected; the dev server in the desktop bench runner's Electron window at
1600×900, because the browser pane was hidden):
- A night with Grand Illumination, the Laser Light Show, Cosmic Convergence and the Crystal Orbs at max:
  coloured neon beams with no white blowout where they cross at the player.
- The crystal balls. A first try put the inner glow inside the glass, where the opaque batch hides it; a
  second made them glow like lamps; the third, kept, reads as violet glass lit from within with a gloss
  and an aura.
- The projector's beam switched on and striking the crystal: a warm, visible shaft of light, no glare.

**Not verified:** how the new Glasswalker feels in a real run (one health number, from the report).

## A dearer Lost & Found, Mira, the Commodore, switches, scrollbars — 2026-11-01 (D-78)

**Changed:** the Lost & Found's prices (about seven times dearer) and a refund for every save (v5); Mira;
the Commodore and the Undertow (were the Ride Operator and the Bumper Car); Running Shoes earned from the
Commodore; the mirror evolves with Mira's Hand Mirror; switches for owned weapons and passives; the bell
circles its carrier; game scrollbars and no sideways scrolling. Decision: D-78.

**Automated:** typecheck clean; 330 tests pass in 23 files (6 new in `meta.test.ts`; migration, price and
roster tests updated).

**Checked** (the dev server in the desktop bench runner's Electron window, at 1600×900 and 1024×640;
screenshots inspected):
- An old (v4) save that owned the whole store, loaded through the game's save loader: +5,954 LT (matches
  the old prices), perks and purchases cleared, the two quest rewards kept, the Whole Troupe withdrawn. The
  refund notice on the press screen and at the top of the Lost & Found.
- The Lost & Found: new prices, the Commodore "Requires: Defeat the Leviathan", Mira buyable, the Undertow
  buyable after the Leviathan, owned items switched on and off (and earned quest rewards listed), the gold
  scrollbar and bulb outline.
- Sideways scrolling: none on Settings, the Carnival-pedia, the Lost & Found or a six-player lobby at either
  size; with the old bulb ring forced back on, the lobby scrolled 11 px sideways.
- The new 2D art (portraits, select art, the coaster icons). A first Commodore had mutton chops sticking
  out past his head like floppy ears; moved onto his cheeks.
- In a night: the Commodore mid-launch in the Undertow's lead car on its rail of light (a first try drew
  the car's gold rim as a solid lid and the rail too white; fixed); Mira and her clone with its Glass Halo,
  enemies cut inside it (360 damage from the mirror alone by 0:14); the Summer's End bell circling its
  carrier on the Boardwalk.

**Not verified:**
- How the new prices feel over many real nights (they are tuned from simulated payouts).
- Mira, the Commodore and the switches in a real co-op session (covered by unit tests and the profile
  whitelist only).
- The scrollbars in Firefox (the web build there gets the standard thin gold bar).

## Knockback, Summer's End, lit doorways, the coaster, recipes — 2026-11-01 (D-79)

Scope: knockback a fifth softer, wearing off, never mid-charge; Summer's End's wording, its call heard over
a hush on a steamship's horn, the Gala Queen alongside the pier, the hoist's ring and winch, the shelf's
start-over rule, the rod's glint; light pouring from the Arcade's and Gift Shop's doors; the coaster's
headlamp, its station's portals and its frosted windows with the train's shadow; evolution recipes that
read the right player's build. Decision: D-79.

**Automated:** typecheck clean; 337 tests pass in 24 files (new `recipes.test.ts`; knockback, Summer's End
and net tests added or updated); the production build succeeds.

**Checked** (the dev server in the desktop bench runner's Electron window at 1600×900; screenshots
inspected, before and after, `artifacts/visual/d79-before|d79-after|d79-close`):
- The Arcade's two south doors pour cold cyan light onto the boards and glow in their openings; its east
  door, and the Gift Shop's warm amber doors, the same. A first pass was too faint to read at play zoom.
- The station: six frosted windows, warm; the train's shadow (figurehead, cars, riders' heads) crossing
  them as it comes home and standing while it waits; the portals lighting the track as it leaves. A first
  pass showed only a thin band (windows too short for the steep camera) and the two promenade lamps' glow
  hid the shadow; the windows are taller and the lamps are gone.
- The headlamp on the lift hill and the return leg, its beam lighting the track ahead (a first pass was
  too faint).
- The Gala Queen alongside the end deck with the fire at her bow beside the berth, and sailing in.
- The hoist's ring and progress arc; the overhead bar's label ("Winching up · stay by the bell (19s)"),
  read from the page.
- The rod's halo and sparks at the bait shop.
- The ship's horn and the winch, rendered and measured offline (not heard): a short blast 0.5 s and a
  long 1.4 s, energy at 92–440 Hz.
- Five knockback-heavy weapons on the weapon bench before and after (`docs/WEAPON_AUDIT.md`): no extremes.

**Not verified:**
- How the horn, the hush and the winch sound (no audio was listened to).
- The recipe fix in a real co-op session (covered by unit and replication tests).
- How the softer, wearing knockback feels in real nights.
