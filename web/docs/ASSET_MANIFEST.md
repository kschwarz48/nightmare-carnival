# Asset Manifest

**Production method.** No image- or audio-generation tools were available in the build environment,
so every visual asset is **original vector artwork authored in code**: rubber-hose drawing routines
(Canvas2D paths with thick ink outlines, pie-cut eyes, noodle limbs, white gloves, radial cel shading)
that are painted into texture atlases when the game boots (`src/render/assets.ts`). Nothing is a
placeholder shape: each entity has a bespoke illustration and, where applicable, a parametric pose
system that generates its animation frames. Sound effects are synthesized offline at boot
(`src/audio/synth.ts`); the boss score is sequenced live from oscillators (`src/audio/audio.ts`).

Because the art is code, it is reproducible, resolution-independent (atlases are painted at 1–2.5 px
per world unit) and tiny on disk (~0 bytes of image files). The trade-off versus hand-drawn
frame-by-frame animation is noted in the QA report.

Status legend: ✅ complete & integrated · ◐ complete, simplified relative to the art-direction ideal.

## Characters (`src/render/art/characters.ts` → `drawCharacter`)

| Asset | Frames / animation | Usage | Status |
|---|---|---|---|
| The Carny — striped vest, boater, handlebar mustache, fanned cards | idle ×2, walk ×4, hurt | player sprite, portraits, select screen | ✅ |
| The Strongman — leopard singlet, flexing arm, curled mustache | idle ×2, walk ×4, hurt | " | ✅ |
| The Fortune Teller — star robe, coin headscarf, glowing crystal ball | idle ×2, walk ×4, hurt | " | ✅ |
| The Ride Operator — overalls, goggled cap, sparking lever | idle ×2, walk ×4, hurt | " | ✅ |
| The Lost Child — pinafore, bow, teddy | idle ×2, walk ×4, hurt | " | ✅ |
| The Ringleader — red tailcoat, top hat, baton | idle ×2, walk ×4, hurt | " | ✅ |
| Balloon Shield (`drawShieldBalloon`) | 1 + sway | Lost Child quirk indicator | ✅ |
| Portraits & full-body select art (`Assets.portrait`, `charFull`) | sunburst cards | menus, HUD, results | ✅ |

Runtime animation layered on top: squash & stretch breathing, hurt red/white strobe, i-frame blink,
bumper-car surge afterimages, facing flip.

## Enemies (`src/render/art/enemies.ts` → `drawEnemy`)

Every enemy: walk ×4 + telegraph/wind-up pose; runtime squash-stretch bob, hit flash, status tints
(frozen blue, sticky pink, burning flicker), spawn pop-in, elite gold rim + crown + 1.3× scale,
shielded ring.

| Enemy | Distinct tell drawn | Extra frames | Status |
|---|---|---|---|
| Living Balloon (gnashing knot-mouth) | angry lids, open teeth | — | ✅ |
| Balloon Swarm (magenta) | flight tilt | — | ✅ |
| Wind-Up Monkey (fez, cymbals, spinning key) | cymbals clap, eyes glow | — | ✅ |
| Possessed Stuffie / Stuffie Scrap | dangling button eye turns red | mini scaled | ✅ |
| Cotton-Candy Slime (paper cone, drips) | eyes widen | — | ✅ |
| Whack-a-Mole (hard hat, hole) | emerging | travelling dirt mound | ✅ |
| Evil Clown (frizz, polka dots, giant shoes) | lurch, glowing eyes | — | ✅ |
| Jack-in-the-Box (striped box, crank) | lid jitter | sprung jester head | ✅ |
| Dunk-Tank Clown (rolling tank, pie) | arm wound back | — | ✅ |
| Puppet Soldier (shako, musket, strings) | musket raised with danger glint | — | ✅ |
| Carousel Horse (brass pole, gold hooves) | rears with dust | — | ✅ |
| Bumper Car (#7, toothy bumper) | pole sparks, headlights | — | ✅ |
| Walking Ticket Booth (one window-eye, slot mouth) | spits tickets, red pupil | — | ✅ |
| Roller-Coaster Snake (headlight eyes, rail grin) | lit headlights | body segment | ✅ |
| Carnival Brute miniboss (striped singlet, prize chest) | fists raised | — | ✅ |
| Pedia images (`Assets.enemyImage`) | — | — | ✅ |

## Bosses (`src/render/art/bosses.ts`) — cut-out parts animated by `GameRenderer.draw*`

| Boss | Parts | Animated behaviour | Status |
|---|---|---|---|
| The Carnival Tent | dormant & awake canvas bodies, maw (4 openness + "hot"), window-eyes (closed/open/furious), striped tent-pole legs with boots, flame overlays ×2, collapsed wreck | sleeps as scenery, rises on legs, breathing, stomping legs lift, maw flutters/inhales/glows, P3 burning, deflating collapse | ✅ |
| The Ferris Wheel | rim (dim/blood-red lights), 5 gondola colours + screaming open gondola, hub face (calm/angry), A-frame stand, wreck | landmark on the skyline, tears free, spins, rolls with rim glow, wobble, lights die on defeat | ✅ |
| The Puppet King | robed torso, head (normal/mad/crownless), arm & leg (pivoting), crossbar, wreck | lowered from the flies on strings, dancing limbs, hands rise for slams, P2 glowing cuttable strings with HP rings, stagger slump, P3 free & flailing, crown toss | ✅ |
| The Ringmaster | human poses (idle×2, whip, bow, hat, cane), demon poses (idle×2, whip) with animated flames | spotlight intro bow, whip/cane/hat poses, white-flash transformation into the demon, relocation smoke | ✅ |
| Boss portraits (`Assets.bossImage`) | — | warning splash, pedia | ✅ |

## Weapons, summons & projectiles (`src/render/art/items.ts`, `renderer.ts`)

| Asset | Usage | Status |
|---|---|---|
| Playing card, golden card (Royal Flush) | Throwing Cards / Royal Flush | ✅ |
| Tarot card, Death card (skull) | Tarot Toss / The Death Card | ✅ |
| Balloon dart, shrapnel | Balloon Darts / Sharpshooter's Bouquet | ✅ |
| Gold ring, violet giant ring | Ring Toss / Saturn's Rings | ✅ |
| Striped rocket, chrysanthemum shell | Fireworks / Grand Finale | ✅ |
| Popcorn kernel | Popcorn Popper / Kettle-Korn Cannon | ✅ |
| Human cannonball (helmeted daredevil) | Carnival Cannon / Cannonball Special | ✅ |
| Bumper car & phantom car | Bumper Car surge mount, escorts, Demolition Derby | ✅ |
| Plush pets ×4 (tan bear, pink bunny, blue octopus, green bear) ×2 frames | Plush Companion / Nightmare Menagerie | ✅ |
| Rabbit, dove (×2 frames) | Top Hat helpers | ✅ |
| Lion, elephant, acrobat (×2 frames) | Grand Menagerie troupe | ✅ |
| Funhouse mirror frame + tinted player clone | Funhouse Mirror / Hall of Mirrors | ✅ |
| Crystal orbs (procedural hue-shifting glow) | Crystal Orbs / Cosmic Convergence | ◐ drawn as layered glows, not a painted sprite |
| Neon beams (shape batch) | Laser Light Show / Grand Illumination | ✅ |
| Cones: cotton candy, frost, flame (shape + particles) | Cotton-Candy Gun, Snow-Cone, Hot-Dog Grill | ✅ |
| Mallet slashes, bell shockwaves, pound rings | Mallet, Whack Frenzy, Strongman Bell, High Striker | ✅ |
| Webs, burning ground, spark trail (shape batch) | Sticky Situation, Inferno Grill, Ride Operator | ✅ |

## Enemy projectiles (always the danger palette)

Pie, musket ball, razor ticket, popcorn, spiral orb, spark, ring bullet, hellfire, pennant flag,
crown boomerang, spoke boomerang — each with a red-orange glow halo. ✅

## Telegraphs & hazards (`renderer.drawHazards`, shape batch)

Circle telegraphs with a filling "time-to-impact" disc and pulsing rim; lane bands with travelling
chevrons (charges, rails, rolls, stampedes, yellow caution lanes for flyby swarms); expanding
shockwave rings with readable safe gaps; closing fire annulus; rotating poles/spokes/crossbars;
spotlights; burning ground; safe-pocket and reward markers; high-contrast variant. ✅

## Pickups

Ticket stubs (blue / green / magenta by value), Ticket Bank (pulsing), hot dog (heal), funnel cake,
Golden Ticket, reward chest (closed / open glow). ✅

## Environment (`src/render/art/props.ts`, `src/render/ground.ts`)

| Asset | Status |
|---|---|
| Painted ground layout (paths, plaza, promenade, tire-worn dirt, decals: popcorn, tickets, puddles, cracks, tufts) + shader detail (grain, cellular cobblestones, boardwalk planks), animated moonlit sea with foam and moon path, dark woods beyond the fence | ✅ |
| Landmarks: dead carousel, Ticket Booth, Prize Stand, Ferris Wheel stand + ticket hut, Fun House (giant clown mouth entrance), broken roller-coaster with derailed car, Tilt-a-Whirl platform + rotating teacup arms, High Striker tower | ✅ |
| Midway stalls: Ring Toss ×2 colourways, Milk Bottles, Balloon Pop, Shooting Gallery, Dunk Tank | ✅ |
| Concessions: popcorn carts, Cotton Candy stand (mascot), Hot Dog stand (mascot) | ✅ |
| Gate arches ×3 (GATE 1 / MIDWAY / GATE 3) with marquee bulbs, wrought-iron fencing, sea-wall railing | ✅ |
| Set dressing: lamp posts, string lights (animated twinkle), barrels, crates, hay bales, dead trees ×3, litter ×3, balloon posts, benches, pennant poles, signpost, bleachers, side tents ×2 ("FREAKS"/"WONDERS"), Madame Zelda caravan, abandoned prize teddy, stone clown statue | ✅ |
| Lighting: 20 attraction light pools with individual flicker, lamp lights, player lantern, boss glows, explosion flashes, Lights Out darkness, dawn | ✅ |
| Post overlay: vignette, drifting fog, low-HP pulse, hurt tint, flashes, dawn wash & rays | ✅ |

## VFX particles (`items.particle`, `src/render/fx.ts`)

Confetti ×6, balloon latex ×2, stuffing, buttons, springs, gears, stars, sugar crystals ×3, wooden
splinters ×3, ceramic shards ×3, booth boards ×2, smoke, glow, spark, ring, droplets, flames,
snowflakes, music notes; themed death bursts per enemy family; damage-number glyphs (normal + crit).
✅

## UI (`src/ui/*`, `src/render/art/icons.ts`)

| Asset | Status |
|---|---|
| Logo marquee (painted) and title screen over a live attract-mode carnival | ✅ |
| 18 weapon icons (+ golden sunburst evolution variants), 16 passive icons, perk icons | ✅ |
| Poster-style buttons, ribbons, marquee-bulb panel borders, ticket counters | ✅ |
| HUD: marquee XP bar, ticket-stub level badge, moon→sun clock, HP banner bar with damage ghost, weapon/passive trays with level badges and evolution-ready glow, segmented boss bar, banners, warning splash, toasts, off-screen indicators, coach marks | ✅ |
| Draft cards (prize/tarot cards with rarity ribbons, NEW! tags, evolution hints), chest slot-machine reveal, pause, results (damage table, payout counter, achievements), Lost & Found, Carnival-pedia, settings, daily run, dawn title | ✅ |
| Fonts: Rye (display), Oswald (body) — OFL via Fontsource | ✅ (third-party, open licence) |

## Audio

| Asset | Source | Usage | Status |
|---|---|---|---|
| "Freaky Funk Circus with Intro" — Bradley Schwarz | repo `.m4a` → `public/audio/freaky_funk_circus_intro.mp3` | menu, results, dawn | ✅ original track, preserved |
| "Freaky Funky Circus Loop" — Bradley Schwarz | repo `.m4a` → `public/audio/freaky_funky_circus_loop.mp3` | the night; gapless (silence trimmed); playback rate & low-pass darken per Act | ✅ original track, preserved |
| Dread drone (detuned saw pad + theremin wail) | live oscillators | grows each Act | ✅ |
| Boss themes ×6 (Tent, Wheel, Puppet King, Ringmaster ×3 phases) | live step-sequencer: tuba oompah, chord stabs, drums, detuned calliope melody | boss fights | ◐ synthesized big band (not live-recorded) |
| Ambience loop (wind, creaks, distant music box) | synthesized at boot | always | ✅ |
| ~100 SFX (deaths per family, tells, every weapon, UI, level-up, evolution, chest, boss attacks, warning siren, victory/defeat stingers) | `src/audio/synth.ts` | everywhere | ✅ |

---

## Current state (3D renderer, 2026-10-30)

The tables above describe the earlier 2D sprite pass. Since the 2.5D overhaul (D-35 onward):

- **World, characters, enemies, bosses, props, pickups and projectiles are procedural 3D** built at boot in
  `src/render3d/` — SDF sculpts on skeletons for the cast and creatures, geometry helpers and the
  architecture kit (`models/arch.ts`) for buildings, and shaders for the ground, mist, light and water.
  **No external models, textures or generated assets** are used; there are no image files for the world.
- The 2D canvas atlas (`src/render/art`, `assets.ts`) remains only for particles, damage digits and the
  DOM UI (icons, portraits, Pedia) — the portraits are still in the older cartoon style (see the handoff).
- Audio: the two original Bradley Schwarz music tracks are preserved unchanged in `public/audio/`; all
  sound effects are synthesised (`src/audio/synth.ts`).
- Fonts: Rye and Oswald via `@fontsource` (OFL).
