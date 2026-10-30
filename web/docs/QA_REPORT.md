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
- **Boss music** is a synthesized big-band sequencer, not a recorded score; only the two original
  Bradley Schwarz tracks are recordings.
- **No online leaderboard** for the Daily Run — scores are local to the browser (no backend exists).
- **Gamepad** support is implemented (standard mapping, rumble) but was not tested with a physical
  controller in this environment; **touch controls** are not implemented.
- **Colourblind support** is limited to the high-contrast telegraph option (no alternate palettes).
- **Real-time fps** on target hardware not measured (see §3 caveat); measured frame cost suggests a
  large margin.
- Balance tuned with bots; needs human playtests (see §5).
- No localisation framework (English only).

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
