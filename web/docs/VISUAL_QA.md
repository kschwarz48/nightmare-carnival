# Visual QA workflow

How graphics changes are checked against the real game (threejs-qa-release /
threejs-aaa-graphics-builder workflow, adapted to this project). Dev builds only.

## Tooling

* **Test hooks** (`src/dev.ts`) — the skill's determinism contract on
  `window.__THREE_GAME_TEST_HOOKS__`: `seed(n)`, `setState(name)` (returns `{state}`, throws on
  unknown), `setPausedForScreenshot(on)`, `hideDebugUi()`, `states`. Named states:
  `active-play-desktop` (a minute into a night, plaza), `late-combat` (Act IV density, evolved
  arsenal), `boss-ringmaster` (boss lighting, telegraphs, summons); the Fun House room by room
  (`fh-entrance`, `fh-maze`, `fh-maze-dark`, `fh-rotunda`, `fh-corridor`, `fh-gallery`,
  `fh-chamber`); the prize wheel mid-spin and landed (`prize-wheel`, `prize-wheel-landed`, framed as
  the game frames it: bloom eased down, the booth graded as a lit show). Runs are seeded
  (`startRun({ seed })`).
* **Diagnostics** — `window.__THREE_GAME_DIAGNOSTICS__` (getter): frame, state, time, player,
  enemies, per-frame renderer totals (calls, triangles, geometries, textures).
* **Pixel metrics** — `__nc.metrics()` renders a frame and computes the canvas inspector's metrics
  in-page from the live framebuffer (same 160×90 luminance grid, 4-bit colour buckets, edge
  threshold): `colorEntropyBits`, `edgeDensity`, `luminance {mean,p5,p95,contrast}`,
  `dominantColorShare`, plus renderer totals.
* **Captures** — `await __nc.capture(run, name)` saves the frame to
  `artifacts/visual/<run>/<name>.png` with a `.json` of metrics + diagnostics, through a
  dev-server-only endpoint (`vite.config.ts`, `apply: 'serve'`). `artifacts/` is git-ignored.
* **Framing** — `__nc.shot({ x, y, zoom, dx, dy, restart, char })`; `__nc.bench(frames)` for frame
  time (CPU+GPU with `gl.finish`), draw calls and triangles.

The packaged Playwright inspector (`inspect-threejs-canvas.mjs`) needs `@playwright/test`, `pngjs`
and a downloaded Chromium, which this project does not ship; the in-app browser plus the in-page
port above covered the same checks. The hook contract is implemented, so the inspector can be run
later if those dev dependencies are added.

## Loop

1. `npm run dev`, open the game, wait for the boot screen to finish ("Sculpting the crowd…").
2. For each state: `hooks.seed(42); await hooks.setState(s); await __nc.capture(run, s)`.
3. Inspect the PNGs; note weaknesses against the scorecard; change code; re-capture under a new run
   id; compare side by side. Motion: step the sim and capture a short frame sequence (the death
   scenes were checked this way, `artifacts/visual/motion/`).

## Graphics pass, 2026-10-30 — evidence

Runs captured (all inspected): `before`, `iter1`…`iter8`, `after`, `motion`, `probe`.

### Measured (1600×900, High)

| Capture | entropy (bits) | edge density | contrast | calls | triangles |
|---|---|---|---|---|---|
| before / midway | 4.75 | 0.160 | 83.2 | 233 | 1.23 M |
| after / midway | 4.53 | 0.225 | 68.5 | 263 | 1.70 M |
| before / funhouse | 4.43 | 0.126 | 66.4 | 231 | 1.13 M |
| after / funhouse | 4.15 | 0.170 | 65.2 | 249 | 1.53 M |
| before / east concessions | 4.30 | 0.138 | 61.4 | 231 | 1.18 M |
| after / east concessions | 4.61 | 0.179 | 67.6 | 255 | 1.64 M |
| before / late combat | 5.32 | 0.322 | 105.6 | 245 | 2.23 M |
| after (iter7) / late combat | 5.37 | 0.420 | 113.3 | 278 | 2.59 M |

Edge density (authored detail) rose in every view (+27–40%). Entropy and contrast moved little or
fell slightly in the midway and funhouse views: those frames are now darker between pools by design
(tight pools, deep night). Metrics are advisory; the images are the evidence.

Late-combat frame time (CPU+GPU): 3.46 ms before → ≈4.65 ms steady after (ground ≈1.26 ms after
the GPU field bake; clutter ≈0.7 ms).

### Scorecard (genre equivalents: Hero = the playable carny; Obstacles = enemies + telegraphs;
Rewards = tickets/chests; World = the midway)

| Category | Before | After | Evidence |
|---|---|---|---|
| Art direction | 1.5 | 2 | theme now drives forms (booths, canopies, shingles, queue, generator), not just colour |
| Hero | 2 | 2 | sculpted, inked, rigged carny with realistic anatomy (previous pass) |
| Obstacles/enemies | 1.5 | 2 | death scenes, grimier balloons, telegraphs as painted hazard striping |
| Rewards | 2 | 2 | neon tickets unchanged |
| World | 1 | 2 | relief ground with ruts/puddles/curbs, booth kit, clutter, dressing |
| Materials | 1 | 2 | procedural grain, canvas weathering, chipped paint, rust; relief normals on the ground |
| Lighting/render | 1.5 | 2 | tight pools with sources, long moon shadows, lamp reflections, searchlights, luminous mist |
| VFX/motion | 1.5 | 2 | death scenes, wind-swept grass, crawling telegraphs |
| UI/HUD | 2 | 2 | not in scope |
| Performance evidence | 2 | 2 | per-frame totals, bench before/after, cost attribution |

Average ≈ 2.0 (before ≈ 1.6). Premium threshold (all ≥ 2, average ≥ 2.3) **not yet met**: World,
Materials and Lighting are at 2, not above. Next passes that would raise them: authored dressing
for the remaining attractions (caravans, carts, gate arches, coaster ruin), more distinct enemy
silhouettes for the toy roster, searchlight beams through the mist, and a human playtest of
readability during heavy combat.

## Fun House and prize wheel pass, 2026-10-31 (D-67) — evidence

Runs captured (all inspected): `d67-before`, `d67-iter1`…`d67-iter3b` (house), `d67-iter1`/`d67-iter2`
(wheel), `d67-after`. The wheel's "before" was re-shot with the same framing as the "after" (an earlier
mid-spin capture was washed white because the dev state skipped the app's bloom easing; the game never
showed that).

### Measured (1600×900, High)

| Capture | entropy (bits) | edge density | contrast | mean | calls | triangles |
|---|---|---|---|---|---|---|
| Carnival Core plaza (reference, unchanged) | 5.02 → 5.08 | 0.394 → 0.400 | 92 → 92.6 | 49.6 → 51.9 | 269 → 269 | 2.09 M → 2.09 M |
| fh-entrance | 5.94 → 5.38 | 0.247 → 0.271 | 102.9 → 93.5 | 56.7 → 47.0 | 241 → 257 | 1.50 M → 1.73 M |
| fh-maze | 4.42 → 5.31 | 0.246 → 0.325 | 83.9 → 136.5 | 35.2 → 61.8 | 310 → 331 | 2.31 M → 2.54 M |
| fh-maze-dark (the weakest view) | 3.86 → 4.79 | 0.207 → 0.302 | 64.8 → 100.9 | 25.5 → 43.3 | 315 → 336 | 2.28 M → 2.52 M |
| fh-rotunda | 5.65 → 5.56 | 0.348 → 0.370 | 115.0 → 110.2 | 48.6 → 52.4 | 305 → 326 | 2.33 M → 2.51 M |
| fh-corridor | 4.58 → 5.00 | 0.253 → 0.329 | 75.6 → 109.8 | 33.7 → 46.9 | 180 → 191 | 0.84 M → 1.06 M |
| fh-gallery | 4.64 → 5.27 | 0.185 → 0.276 | 66.4 → 101.1 | 29.4 → 46.5 | 237 → 188 | 1.42 M → 1.13 M |
| fh-chamber | 4.87 → 5.12 | 0.188 → 0.256 | 74.6 → 74.2 | 34.4 → 41.9 | 180 → 191 | 0.79 M → 1.05 M |
| prize-wheel (mid-spin) | 4.89 → 5.29 | 0.234 → 0.250 | 207.5 → 156.7 | 61.8 → 35.1 | 281 → 291 | 2.33 M → 2.35 M |
| prize-wheel-landed | 5.00 → 5.36 | 0.260 → 0.276 | 204.0 → 148.9 | 59.2 → 36.0 | 284 → 294 | 2.33 M → 2.35 M |

- **The dark rooms.** The maze's dark corner went from the one view under the inspector's contrast floor
  (64.8, mean 25.5) to 100.9 (mean 43.3). Every house view now has more edge density (authored detail)
  than before. The entrance and the Rotunda were already the brightest rooms; they moved little. The
  chamber's contrast is flat (74.6 → 74.2): its stage stays dark between the drifting spots.
- **The wheel** is meant to be darker: mean brightness roughly halved and contrast fell from a
  front-lit 205 to a still-strong 149–157, as the board went from lit purple velvet to black lacquer
  under a raking key light and neon.
- **Draw calls vary with the crowd.** Re-capturing `fh-gallery` gave 221 calls (stable over three
  captures with seed 42), against 188 in the after run and 237 before: the crowd differs with the seed
  and the order states run in. Differences under ~30 calls are noise, not savings.

### Budget and tradeoffs

- **Mirror views are over the 300-call desktop budget** (maze 331–336, Rotunda 326; before D-67 they
  were already 305–315). Every mesh in view is drawn again for each row of live mirror glass, so each
  new layer costs one call per mirror pass. The soft layers (moonlit windows, contact shade, stage beams,
  light shafts) are left out of the reflections; the fixtures stay in them (lamps in the glass are the
  point of a hall of mirrors). Medium quality draws one mirror pass and Low none.
- **Triangles** were over the 750k guideline before this pass in every view but the corridor and
  chamber (the sculpted crowd, the props and the mirror passes); the pass adds 0.02–0.27 M.
- **Frame time** (`__nc.bench(90)`, CPU+GPU with `gl.finish`, after only): maze 6.96 ms, Rotunda
  10.7 ms, corridor 5.95 ms, against 10.19 ms on the Carnival Core plaza. The pane may have been
  backgrounded during the bench, so treat these as indicative.
- **Shadow lights** stay at the world's two (moon, lantern); the prize booth adds one shadowed spot in
  its own overlay pass, only while a wheel is up.

### Scorecard: the Fun House (genre equivalents as above; Rewards/interactables = tickets, chests, the
prize wheel and the quest's fixtures)

| Category | Before | After | Evidence |
|---|---|---|---|
| Art direction | 2 | 2 | the house's forms (mirrors, deco walls, crooked boards) were there; lighting now carries them |
| Hero | 2 | 2 | unchanged |
| Obstacles/enemies | 2 | 2 | piston crowns now read as crushers (hazard stripes), otherwise unchanged |
| Rewards/interactables | 1.5 | 2.5 | the wheel has depth, real shadows and neon; quest fixtures prompt their action and answer a press |
| World | 2 | 2.5 | sconces, pendants, capital lamps, picture lights, stage booms, stained-glass tower, moonlit windows |
| Materials | 1.5 | 2 | marble caps with glowing gilt edges; gilt paint instead of camo-blotched gold; booth glass no longer blown out |
| Lighting/render | 1.5 | 2.5 | every pool from a visible fixture with a halo (and a shaft under hanging/standing lamps), contact shade, indoor ambience, theatre spots |
| VFX/motion | 2 | 2 | drifting stage beams and buzzing neon; no new combat effects |
| UI/HUD | 2 | 2 | the interact prompt matches the Midway's |
| Performance evidence | 2 | 2.5 | per-room before/after metrics, a bench, the mirror-pass bottleneck and its tradeoff named |

Average ≈ 2.2 (before ≈ 1.85). Every category is at 2 or above, but the premium bar (average ≥ 2.3)
is **not met**. Passes that would raise it: house-specific combat effects (glass shatters, mirror
ripples on hits), plaster and wallpaper detail on the lit wall faces, and a human read of the new
lighting during a crowded night. No automatic failure stands: the dark rooms are now lit from
authored fixtures rather than left to darkness and fog.

Not captured: mobile viewports (the game's QA has been desktop-only), and an unpaused motion sequence
of the wheel (only stills at two moments of the spin).


## The Boardwalk, 2026-10-31 (D-68) — evidence

Runs captured (all inspected), in `artifacts/visual/`:
- `bw-iter3`, `bw-iter4`: the world's first passes.
- `bw-enemies`: line-ups at 3× zoom before and after the re-mesh, rising out of the surf and the sand,
  and midway and beach combat.
- `bw-bosses`: every boss, the Leviathan's head up, the Gala Queen offshore, the Last Ride close up.
- `bw-egg`: the quest's world changes, before and after the fixes.
- `bw-qa`: every region and interior at High, the plaza, shore and combat at Medium and Low, and the
  cap stress test.

### Measured (1600×900; High unless marked)

| Capture | entropy (bits) | edge density | mean | contrast | calls | triangles |
|---|---|---|---|---|---|---|
| bw-plaza | 5.29 | 0.348 | 66.9 | 121.7 | 290 | 1.60 M |
| bw-arcade-row | 5.14 | 0.298 | 67.3 | 136.4 | 291 | 1.19 M |
| bw-coaster | 5.06 | 0.320 | 67.9 | 106.1 | 290 | 1.45 M |
| bw-wharf-gate | 4.72 | 0.297 | 58.8 | 102.4 | 297 | 1.35 M |
| bw-beach (after the beach lights) | 3.32 | 0.105 | 36.3 | 41.6 | 287 | 1.67 M |
| bw-shore | 3.37 | 0.101 | 33.6 | 38.9 | 282 | 1.31 M |
| bw-pier | 4.41 | 0.324 | 40.7 | 84.7 | 280 | 1.35 M |
| bw-pier-end | 4.93 | 0.421 | 51.7 | 110.3 | 280 | 1.33 M |
| bw-arcade (interior) | 5.51 | 0.352 | 65.6 | 140.6 | 293 | 1.20 M |
| bw-giftshop (interior) | 5.07 | 0.276 | 59.7 | 119.7 | 291 | 1.22 M |
| bw-wheel | 5.18 | 0.188 | 73.1 | 151.2 | 301 | 1.28 M |
| bw-midway-combat | 4.31 | 0.219 | 45.4 | 80.0 | 311 | 2.19 M |
| bw-beach-combat | 4.00 | 0.225 | 43.0 | 60.7 | 315 | 2.74 M |
| bw-plaza · Medium / Low | 5.31 / 5.05 | 0.351 / 0.339 | 67.7 / 50.7 | 121.7 / 105.5 | 214 / 116 | 1.31 / 0.84 M |
| bw-shore · Medium / Low | 3.36 / 3.22 | 0.098 / 0.073 | 33.3 / 32.3 | 38.5 / 35.4 | 207 / 112 | 1.02 / 0.64 M |
| bw-beach-combat · Medium / Low | 4.04 / 3.80 | 0.225 / 0.188 | 43.2 / 39.7 | 60.8 / 55.2 | 234 / 126 | 2.23 / 1.31 M |
| 280-cap stress (269 alive) · High / Medium / Low | — | — | — | — | 328 / 247 / 134 | 8.67 / 7.65 / 4.59 M |

Frame time (rAF deltas over 3–4 s, dev build, this machine's GPU, vsync at 165 Hz):
- Every view above holds 165 fps (p95 6.2 ms) on High and Low with up to ~50 alive.
- At the cap (269 alive):

  | Quality | Avg fps | p95 |
  |---|---|---|
  | High | 131 | 12.2 ms |
  | Medium | 148 | 12.1 ms |
  | Low | 163 | 6.2 ms |

- Draw calls run 280–315 on High: about the 300-call budget, as on the other maps. Medium cuts about
  25% and Low about 60%.

### Found by looking, and fixed

- **The tidecaller's staff swung near-horizontal** as its arm walked. It got its own bone, which the
  clips keep upright.
- **The Last Ride's riders, bulbs and halos were blown out to a white blob.** Emission and glow were cut
  to about a third.
- **The ocean's light streaks stopped on hard horizontal lines** (the loop's range checks). Both ends
  now fade.
- **The wreck's engravings and porthole keepsakes were too small and dark to read**, and the puzzle
  depends on reading them. They are now 2.4× on brass plates, the keepsakes sit in front of the glass,
  and the wreck catches a moonlit pool while the step is open.
- **The moored Gala Queen overlapped the pier's trawler** (moved out). **The Crane's claw was inside its
  cabinet** (raised, enlarged, with a glint).
- **The beach was a dark, empty plain** (entropy 3.07, contrast 35). It now has a lantern on each
  lifeguard tower, the fire pit's embers, lanterns at the stair landings, and high-tide wrack lines in
  the floor shader (3.32 / 41.6). It is still the weakest view.
- **The new sculpts were 9–28k triangles**, heavier than the existing crowd. They were re-meshed to
  4–11k; the line-up at 3× zoom still reads.

### Scorecard (the Boardwalk as shipped)

| Category | Score | Evidence |
|---|---|---|
| Art direction | 2.5 | a 1930s seaside park with its own forms: colonnade, domed pavilion, white lattice coaster, wheel, pier, lighthouse, wreck; dark and cold, scale over clutter |
| Hero | 2 | unchanged (the existing cast) |
| Obstacles/enemies | 2.5 | ten distinct rigged sculpts (striped bather, bottle-capped crab, usher, taffy twist, cabinet automaton, coaster wraith, barnacle diver, lantern angler, prize-counter man, tidecaller) with state clips, risers, swimmers and foam rings |
| Bosses | 2.5 | the Barker and his prize wheel, the Captain with anchor and chain and the Gala Queen offshore, the coaster train with riders, the Leviathan's head, coils and tentacles, the Commodore |
| Rewards/interactables | 2 | the quest's world changes read (photograph, keepsakes, claw, green lantern, engraved portholes, moored ship, fire, lamps, bell) |
| World | 2 | rich on the promenade, interiors and pier; the beach is sparse and dark |
| Materials | 2 | weathered paint, brass, barnacle crust, wet sand, timber; no texture authoring beyond procedural |
| Lighting/render | 2.5 | the ocean (Gerstner and normals, moon glitter path, light streaks, breakers, swash, low water), practical light pools with halos, lighthouse beam, interiors |
| VFX/motion | 2 | new death bursts, splashes, arcs, foam waves, whirlpools, rails; no screen-space water effects |
| Performance evidence | 2.5 | per-region metrics at three tiers, a cap stress test, the re-mesh and its gain measured |

Average ≈ 2.3. Every category is at 2 or above; the premium bar is met only just.

What would raise it:
- denser beach dressing (snow fences, debris, footprints, more light);
- authored textures for the façades;
- screen-space spray and mist where breakers hit the pilings;
- a human read of a crowded night on the shore.

Not captured: mobile viewports; an unpaused motion sequence of the creatures' clips (stills only, with
the clips seen in-game during the combat captures).

## Playtest round on the Boardwalk, 2026-10-31 (D-69) — evidence

Captures in `artifacts/visual/pt1`…`pt7` (dev build, 1600×900, High unless noted). All were inspected.

| What | Before | After |
|---|---|---|
| Pier neck over the sand | `pt1/neck_zoom.png`: sand flecks and banding through the planks | `pt1/neck_zoom_fixed.png`, `neck_fixed.png`, `neck_shore_fixed.png`: solid boards to the sea |
| Gift Shop | `pt1/giftshop.png`: coaster inside, specks on dark shelves, no photograph | `pt2/shop.png`, `pt5/photo_seen.png`: stands with souvenirs and lamps, the eight look-alikes, the easel photograph |
| Arcade | `pt1/bw-arcade.png`: paired boxes, opaque glass | `pt2/arcade.png`, `arcade_west_zoom.png`, `arcade_east_zoom.png`: real machines, figures behind glass, marquees |
| Coaster and Ballroom | (track through the shop and the Ballroom) | `pt1/coaster_after.png`, `shop_after.png` |
| Late-game flashing | `pt3/royal_before.png`: a Big Top blown out white | `pt3/royal_after.png` |
| Telegraphs | (hatch stripes, chevrons, pulsing edges) | `pt4/*`, `pt5/lane_front.png`: spot, edge, timer, "now" |
| Other maps after the global changes | | `pt7/late-combat.png`, `pt7/fh-rotunda.png` |
| Quality tiers | | `pt6/bw-arcade_{low,medium,high}.png`, `pt6/bw-giftshop_{…}.png` |

- **Renderer budget,** Arcade / Gift Shop: Low 119–121 calls and 0.50–0.52M triangles; Medium 220–224
  and 0.85–0.88M; High 299–303 and 1.20–1.23M. The new furnishings add about 20 draw calls: the signs,
  the glass mesh and the photograph.
- **Metrics,** High: Arcade mean luminance 62, colour entropy 5.36 bits; Gift Shop 64 and 5.28.
- **Scorecard notes:**
  - The Arcade and the Gift Shop move from the weakest interior views to among the most detailed. Every
    machine has its own silhouette, readable from the gameplay camera.
  - Still weakest on the map: the beach (unchanged this round).

