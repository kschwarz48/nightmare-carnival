# Design Decisions Log

Each entry: the gap or contradiction, the decision, and why. IDs are referenced from code comments (`D-xx`).

---

### D-01 · Ringmaster vs. Dawn timing
**Gap:** Ringmaster spawns at 24:00, a healthy fight is 75–120 s, but dawn is 25:00 and the GDD also says beating him is required.
**Decision:** Dawn **requires** the Ringmaster's defeat. While he lives, the clock **stalls at 24:59** — the HUD clock face cracks and the banner reads *"The Ringmaster holds back the dawn!"* His 120 s soft-enrage (Encore) still applies, so the stall cannot be abused.
- Defeated **before** 25:00 → *Victory Lap*: ambient spawns switch to a weak balloon flood with ×3 Tickets until 25:00, then the dawn sequence.
- Defeated **at/after** 25:00 → dawn sequence plays immediately (3 s grace).
**Why:** Keeps "beat the final boss to win" (pillar: the boss is the spectacle) and the 25-minute frame, and is never unfair — the player always gets the whole fight.

### D-02 · Difficulty tiers
| Tier | Enemy HP | Enemy dmg | Pop. cap | Greed bonus | Miniboss | Unlock |
|---|---|---|---|---|---|---|
| Midway | ×1.0 | ×1.0 | 180 | +0% | 75 s | default |
| Carnival | ×1.5 | ×1.25 | 280 | +30% | 65 s | defeat the Ferris Wheel (any tier) |
| Nightmare | ×2.2 | ×1.6 | 400 | +60% | 55 s, elites gain affixes | win on Carnival |
HP/damage from the Godot resources (newest tuning); caps from doc 03 §7.2 (newest text).
**Curse** (unlock: defeat the Puppet King): spawn interval ×0.8, cap +15% (≤400), enemy speed ×1.12, enemy HP ×1.2; rewards: XP ×1.1, Lost Tickets ×1.35.

### D-03 · Enemy numbers
Godot `.tres` values win over the bible where they differ (they were retuned against the 220 px/s player). Bible values fill fields the resources lack (e.g. Puppet Soldier formation).

### D-04 · No Gold / no Intermission Wagon
Per doc 03 pre-M5 update. The **Greed** stat (Coin Purse, meta perk, tier bonus) multiplies the Lost Ticket payout. Breakables drop food/tickets instead of gold.

### D-05 · Single Carnival Core map (4400 × 4400)
Godot's spatial reference kept: Big Top at center (the Tent sleeps there), Carousel west, Ticket Booth east, Prize Stand south-west, stalls south-east, the north fence with three gates, Ferris Wheel north-east. Additions: a south **plank promenade** along the sea wall (the old Boardwalk zone, folded in), concession row, ring-toss/milk-bottle stalls, Tilt-a-Whirl (hazard), Fun-House façade, broken coaster track, string lights between landmarks, wrought-iron perimeter fence, and the sea along the south edge.

### D-06 · Reward chests
VS-style N rolls to equipped items (boss 4–6, miniboss 1–7 → we clamp miniboss to 1–3 for readability of the reveal). **If an evolution is ready it is always the first roll.** Chests are opened with a short reveal animation (slot-machine style) that lists each upgrade.

### D-07 · Grand Menagerie (missing evolution)
**Top Hat Lv8 + Strongman Belt → Grand Menagerie.** The hat becomes a full three-ring troupe: a **lion** (pounces, high single-target), an **elephant** (slow, stomps AoE + knockback), and **acrobat clowns** (fast, multi-hit). Distinct from Nightmare Menagerie (a swarm of identical plush pets). Strongman Belt fits the "Ringleader's strongman act" fantasy and the Ringleader's Might-inheritance quirk.

### D-08 · Extra Token
5 levels; +1 Amount at levels 1, 3 and 5. Weighted rarer (base weight 0.6).

### D-09 · Evolution prerequisites
Evolution eligible when the weapon is Lv8 and its passive is owned at ≥ Lv1. A passive may gate several evolutions. Full table lives in `src/data/weapons.ts`; a unit test asserts every evolution's chain is reachable (weapon draftable/unlockable, passive draftable/unlockable, slot rules allow both).

### D-10 · Fortune Teller "sees next draft rarity"
Always gets **4 draft cards** and the XP bar shows the rarity ribbon of the best card in the *next* draft (pre-rolled).

### D-11 · Lost Child "balloon economy"
Base HP 60. Holds a **Balloon Shield** that absorbs one hit entirely and regrows after 20 s (cooldown scales with the Cooldown stat). Starts the run with +1 revive ("the revive balloon"). Glass-cannon summoner-adjacent kit: Plush Companion damage +20%.

### D-12 · Performance target
Measured against Nightmare cap (400) + boss + ~600 projectiles at 60 fps. Old 600-enemy benchmark dropped.

### D-13 · Characters
| Character | HP | Speed | Identity | Quirk | Unlock |
|---|---|---|---|---|---|
| Carny | 100 | 220 | Balanced | +10% XP | default |
| Strongman | 150 | 187 | Tank/melee | Shoves nearby enemies when hit; +1 armor | default |
| Fortune Teller | 75 | 220 | Glass cannon | +25% Might, +10% crit, 4 draft cards | reach 12:00 once, then 150 LT |
| Ride Operator | 100 | 264 | Mobility/area | +10% area; while moving leaves a damaging spark trail | defeat Ferris Wheel, then 250 LT |
| Lost Child | 60 | 230 | Fragile | Balloon Shield + revive balloon; plush +20% | defeat Puppet King, then 350 LT |
| Ringleader | 90 | 215 | Summoner | Summons inherit +40% Might; non-summon weapons −15% | defeat Ringmaster, then 500 LT |

### D-14 · Invulnerability frames
After any hit the player is invulnerable for 0.45 s (strobe red/white). Contact damage per enemy is otherwise continuous. Bosses' telegraphed zones respect i-frames too. Keeps crowd damage legible ("I got hit, I have a beat to escape").

### D-15 · Draft QoL
Rerolls / Banishes come from Lost & Found perks (0 at start; up to 3 each per run). **Skip** is a one-time Lost & Found unlock (unlimited use) and heals 10 HP. Banish removes that option for the rest of the run.
Rarity ribbons: Common (weight band ≥1.0), Uncommon (new passive/weapon with weight <1.0), Rare (Lv7→8 / capstone), Evolution (gold). Luck increases the chance of a 4th card: `p = clamp((luck-1)·0.5, 0, 0.5)`.

### D-16 · Events schedule
One carnival event every 70–100 s, never during a boss fight or the 30 s before a gate. Weighted by Act (see `src/data/events.ts`). Banner + sting announce each. Authored timeline events (e.g. Clown Pack @ 8:00, Formation @ 15:00, Calliope Crescendo @ 21:00) fire at their times.

### D-17 · Endless / Lock-In
Offered on the dawn screen. Lost Tickets for the win are banked immediately. In Lock-In, the clock runs on past 25:00; every minute beyond adds +12% HP / +6% dmg; the Act IV wave mix loops with denser caps; every 5 minutes an **Encore Ringmaster** (40% HP, Phase 3 moveset) appears. Death pays a bonus `floor(extra_seconds / 4)` LT.

### D-18 · Daily Run
Seed = UTC date (YYYYMMDD). Character, tier (Carnival) and one modifier are derived from the seed; all characters are playable in the Daily regardless of unlocks. Score = kills + 10·level + 500·bosses + seconds survived + 2000·win. Best score per date stored locally. No online leaderboard (none exists).

### D-19 · Status effects
- **Slow**: multiplicative speed factor, strongest wins.
- **Chill/Freeze** (Snow-Cone): each hit adds a chill stack (−8% speed each); at 5 stacks → frozen 1.2 s (bosses: chilled only, no freeze); frozen enemies take +25% damage; Blizzard: frozen enemies shatter for AoE on death.
- **Burn** (Hot-Dog Grill, Hellfire): DoT 1/s ticks for 3 s, refreshes.
- **Sticky** (Cotton-Candy): slow 40% + DoT.

### D-20 · Manual / hybrid aim
Settings → Aim: **Auto** (default), **Hybrid** (directional weapons — cards, darts, cannon, cones — fire toward the mouse/right-stick when it is held/moved, else auto), **Manual** (directional weapons always aim at the cursor/stick). Orbit/around/summon weapons are unaffected.

### D-21 · Achievements
16 local achievements (e.g. *First Night*, *Ringmaster's Bane*, *Evolutionist*, *Pacifist Minute*, *Full House* — all evolutions) each paying Lost Tickets once.

### D-22 · Meta perks (Lost & Found)
Max HP (+6%/lvl, 5), Might (+5%, 5), Move Speed (+4%, 4), Pickup (+10%, 4), Luck (+5%, 4), Greed (+8%, 5), Armor (+1, 2), Revive (+1, 1), Reroll (+1, 3), Banish (+1, 3), Skip (unlock). Costs escalate ×1.5–2.0. Total combat power ≈ 2–3 good draft picks (doc 01 §9 guardrail).
Unlockable draft content (one-time purchases): Crystal Orbs, Laser Light Show, Funhouse Mirror, Carnival Cannon, Strongman Bell, Rabbit's Foot, Season Pass, Coin Purse.

### D-23 · Tutorial / onboarding
First run shows contextual one-line coach marks (move, auto-fire, collect tickets, level-up draft, boss warning), each shown once and dismissable; can be reset in Settings.

### D-24 · Bosses never stack
If a boss is still alive when the next gate arrives, the next boss (and its 3 s warning) is held until the current one falls. The clock keeps running, so a slow kill shortens the next Act's build-up — pressure without an unreadable double-boss.

### D-25 · Cones aim at the nearest enemy
Doc 06 lists Cotton-Candy / Snow-Cone / Hot-Dog as `forward` (movement direction). Pure forward cones felt bad in testing because kiting means facing away from the crowd. They now aim at the nearest enemy in range (falling back to facing), and respect Manual/Hybrid aim (D-20).

### D-26 · Chest economy
Miniboss (Carnival Brute) chests roll **1** upgrade (Godot: 1–7) and elites drop a 1-roll chest 8% of the time (doc: ~25%). Accelerated runs showed evolutions arriving by 5:30 with the generous values, collapsing the build arc; with these values the first evolution lands around 9–12 minutes for a focused build.

### D-27 · Ticket colours
Doc 03 (implemented) used blue → green → **red** for small → large Ticket gems, but doc 02's readability law forbids the danger colour on any pickup. Large gems and the Ticket Bank are **magenta**; the Golden Ticket is gold. Pickups render unlit so their colour coding survives darkness and the Lights Out event.

### D-28 · Boss framing
While a boss is awake the camera biases ~30% toward it so its body and telegraphs stay on screen instead of hiding under the top HUD.

### D-29 · Early-game easing (from instrumented bot runs)
A naive kiting autopilot (no lane dodging) died at 2–7 min on Midway, almost entirely from contact damage in the 2:00–4:00 balloon/stuffie walls and flyby swarms. Changes: Throwing Cards pierce one extra enemy at Lv1 ("razor cards"); flyby balloons deal 3 contact (was 4); Act I swarms are 28–32 balloons (Godot: 48, already reduced to 36 earlier). Later Acts are unchanged. This is tuned for humans, who dodge the telegraphed swarm lanes — final balance still needs human playtesting (see QA report).

### D-30 · Act I density vs. early DPS
Measured: the 3:00 wave spawned ~2.9 stuffies/s at ~59 HP while a 3-minute build deals ~25–60 DPS, so the crowd snowballed to its cap regardless of play. Possessed Stuffie HP 50→32 and Evil Clown 45→36 (time scaling still makes Act II/III versions tougher), the 3:00–5:00 waves trimmed (min-alive 38/50/64 → 30/42/54, a few balloons kept in the 3:00 mix), base pickup radius 60→75, and Godot's original XP curve (`5 + 3L + L^1.6`) restored.

---

## Overhaul: 2.5D, art direction, progression, prize wheel, Easter egg (D-31 … D-44)

### D-31 · Upgrade-pool fallback: 5% heal or a Lost & Found voucher
When every upgrade is owned (maxed weapons, maxed or slot-locked passives, no evolution ready) the draft offers exactly two cards instead of the old 30% heal: **Funnel Cake Crumbs** (heal 5% of max HP, capped at max, never raises max HP) or a **Lost & Found Voucher** (permanent Lost Tickets, banked to the save immediately so it survives a loss or an abandoned run). Voucher value = `(6 + 0.25·minutes) · 0.9^taken · greed`, minimum 1, with a hard **120 LT per run** cap; once the cap is reached the card stays visible but disabled ("the window is shut for tonight") so the choice never silently disappears. Vouchers cannot be banished; the fallback only appears when the pool is genuinely empty (evolutions always take priority). Chests that find nothing to upgrade pay a voucher too (or the 5% heal once capped). All numbers live in `data/progression.ts`.

### D-32 · The Last Song (Easter egg) and the quest framework
`sim/quest/` is a map-agnostic quest system: chains are state machines registered per map id (`registerQuestChains`), they talk to presentation only through `quest` bus cues, and nothing about them appears in menus, the HUD or the Pedia. The Carnival Core ships one chain, *The Last Song*: wake Zoltana → feed four soul lamps with nearby kills → learn the melody (carousel plaques + music box) and play it on the lamps → time three High Striker hits → carry the Ghost Ticket into the Ringmaster fight → defeat the secret Calliope → true dawn, the `last_song` achievement and the permanent Steam Calliope unlock. Each step uses a different mechanic suited to a survivors-like (positional combat, observation + audio, a timing window, a boss-linked condition); none needs precision aiming or standing still. The melody order is shuffled per run from the seed on a **separate RNG stream**, so the quest never perturbs gameplay randomness. Persistence: run progress resets each night by design; the save keeps completions and the furthest stage (`quests`, save v4), and the unlock is permanent. Full walkthrough: `docs/EASTER_EGG_SOLUTION.md` (developer-only).

### D-33 · Organic balloon drifts
The metronomic flyby swarms (fixed interval, telegraphed lane) are replaced by bouquets of runaway balloons riding a slowly wandering night wind. Timing (minimum gap + exponential extra per Act), entry edge (upwind, randomised tangentially), heading (towards a point *near* the player, bent by the wind), speed (±15% per balloon), group size (skewed small) and spacing (a ragged, staggered stream) all come from the seeded game RNG. Balloons wobble, slide around large attractions and occasionally snag and pop on lamps and pennant poles. A faint squeak from the drift's direction replaces the lane telegraph; drifts pause during post-boss recovery. Measured: roughly one drift every 35–45 s.

### D-34 · Chests open as a prize wheel
Rewards are decided by the simulation first (`grantChest` returns `entries`); the 3D prize booth only **presents** them, landing the wheel on a wedge dressed with the real prize (the other wedges show cosmetic fillers) — there is no second roll. Multi-roll chests get bonus spins, evolutions a storm-lit slow-crawl show, vouchers a coin shower. Confirm/click fast-forwards the current beat; a double tap or Back jumps to the summary. The sim is paused for the whole show (`overlayPause`); the booth is parented to the camera so it shares the world's grade (bloom is eased down while it fills the screen). Because each chest is now a show, chest cadence was reduced (D-43).

### D-35 · A true 2.5D renderer
`render3d/` replaces the sprite renderer: a fixed orthographic camera 50° above the horizon looks down on a fully 3D carnival; gameplay stays on the 2D plane (sim x/y → world X/Z). `VIEW_HALF_Y` grew to 680 to cover the taller ground footprint of the angled view; the frustum narrows on ultra-wide screens so spawns stay off-screen. Actors are drawn ~28% larger than their collision radius and stretched 12% vertically to offset foreshortening. The simulation never imports Three.js.

### D-36 · Practical-light pool
Instead of dozens of three.js point lights, the 24 most relevant practicals (lamps, booths, string-light runs, boss glows, explosions, the player's glow) are packed into shared uniforms and evaluated by every world shader with the same soft falloff, so ground, props, figures, mist and billboards agree about where light is. Three.js lights remain for the moon (directional, shadows), the player's lantern (spot, shadows on High) and a boss stage spotlight.

### D-37 · Post-processing
HDR render → bloom weighted toward its widest mips (soft, diffuse halos rather than glows shaped like their source) → ACES → a vintage grade (gentle desaturation that spares bright emissives, cool shadows / amber highlights, inky-blue lows, film grain, projector flicker, vignette) plus the gameplay overlays (low-HP pulse, hurt tint, Lights Out bubble, flashes, dawn). Low quality disables bloom, grain and shadows.

### D-38 · Art direction
1930s carnival horror first, rubber-hose only as an accent: weathered paint, desaturated reds/mustards/creams with saturated emissive accents, a deep blue-violet night, and light as the primary storytelling tool — every pool of light has a visible source (lanterns, windows, bulbs, signs). Danger reads in hot orange/red telegraphs and emissive enemy fire; pickups read as cool neon (D-41).

### D-39 · Boss rigs
Bosses are articulated hierarchies driven by their sim poses (the Big Top walks on tent-pole legs and opens its maw, the Ferris Wheel spins and rolls, the Puppet King dances on cuttable strings, the Ringmaster morphs into his demon form, the Calliope rises and pumps). Things the sim places "up" in the plane (Ferris gondolas, Calliope pipe tips) sit on vertical structures shifted south by `height·cot(elevation)`, so what you see fire is exactly where the sim spawns it. Bosses own lighting states (maw furnace glow, rim bulbs, a violet stage spot, the Ringmaster's spotlight and red-tinted moonlight, the Calliope's ghost light). They are built from the earlier primitive kit, not yet sculpted (see the handoff).

### D-40 · Sculpted models on real skeletons
Characters and regular enemies are signed-distance-field sculpts (round cones, ellipsoids, boxes and tori, smooth-unioned and carved) meshed with surface nets: gradient normals, baked field occlusion, soft colour seams and two-bone skin weights; crisp details (eyes, buttons, props) are separate meshes bound to a bone. Each model has a bone hierarchy and authored clips (functions of normalised time) baked into a float texture; the instanced actor material skins every vertex on the GPU and can cross-fade two clip frames, so hundreds of instances animate independently. Crowd enemies are meshed coarser (2–8k triangles) and use blob shadows; big enemies cast real shadows.

### D-41 · Atmosphere: neon tickets, ground mist, string lights
Tickets are little neon signs (tube-outlined, buzzing, blue → green → magenta by value, consistent with D-27) with soft halos; emissive parts are exempt from fog so pickups always read. Fog is **ground mist computed in every world shader** — anchored to the world, drifting with the wind, hugging the floor, thicker toward the map edges and the sea, lit from within by the practicals — rather than camera-facing sheets; figures receive it only lightly so costumes stay readable. String lights use saturated carnival colours with soft halos and hold steady, except the odd bulb that stutters like a dying neon sign. Stalls and booths are lit from within (hanging lanterns, glowing windows). Street lamps are Victorian post-top lanterns (after the art reference) standing a head taller than the figures: four frosted panes glowing hottest around the mantle are the visible source of each lamp's warm pool, halo and light shaft, with nothing dark caging the glass. They burn steady; about one in six (picked by a positional hash, never in step with each other) is failing and stutters. A test guards both properties.

### D-42 · The playable cast, realistic proportions
Following the art reference (Luca the carny), the six characters are realistic-proportion figures about seven heads tall: gaunt faces with stubble and tired eyes, messy hair, bare hands, rolled sleeves, the striped waistcoat with a name badge, patched cuffed trousers, a rag at the hip, worn shoes with socks. Gaits are grounded; the cartoon accent lives in attack anticipation and snap. Enemies keep a more stylised, toy-like language as contrast. Figure materials are matte. Anatomy is built from real landmarks rather than stacked blobs (`sculpt/realism.ts`): an abdomen tapering up into a ribcage that widens toward the shoulders (one continuous V, no ledges), trapezius slopes from the neck to the shoulder, deltoids that belong to the arm bone (the upper arm starts beneath them, so there is no ball at the joint), a visible neck, real-size hands with jointed fingers, and a head built from cranium, face plane, jaw, cheekbones, eye sockets and a small straight nose (~2 cm of projection). Joints sit at real landmark heights (elbow ≈ 63%, wrist ≈ 50% of stature). Costume pieces wrap the same torso volumes (`torsoShapes(P, grow)`), and crisp details are seated on the sculpted surface by probing the field (`frontZ`), so they never float or sink.

### D-43 · Progression and pacing retune (supersedes the curve note in D-30)
The Godot XP formula is replaced by a centralised piecewise curve (`data/progression.ts`): 5 XP for level 2, +5/level to L10, +9 to L20, +16 to L40, +36 to L60, +60 beyond, with one-level ×2 plateaus at L20, L40 and L60 around the boss spikes. Ticket value grows 1.2% per minute; post-boss recovery periods last 24 s (the crowd thins to 35% minimum, spawns slow, kills pay +25%); wave density blends toward the next wave over the back half of each window instead of stepping. The opening wave is denser so weak starting weapons still find kills. Chests are rarer because each is now a show (elite chest 5% → 2%, brute interval 140/120/105 s). Measured with `scripts/progression.ts`; see `docs/PROGRESSION.md`.

### D-44 · Inked, hand-painted figures
To move the cast and enemies away from a soft clay look toward crisp, layered, illustrated forms: every sculpted figure gets an ink silhouette (an inverted hull that shares the skinning and animation, held at ~1.6 px on screen), curvature baked from the field paints lighter wear on convex edges and darker creases, costume parts meet in hard seams (a global blend scale on the sculptor) and the cast is meshed finer (≈50–70k triangles for the player, who is drawn alone).

---

## High-fidelity graphics pass (D-45 … D-50)

### D-45 · The ground is authored, not painted
The floor fills most of every frame, so it carries the most detail per pixel. The layout is analytic (avenues as distance fields with ragged grass-bitten edges, the plaza and its curb, promenade, steel deck, slicks), the static fields are baked once on the GPU at startup, and every surface outputs a relief height that becomes a per-pixel normal — so the moon and every practical rake across domed cobbles, wheel ruts that follow each avenue, pebbles and planks. Rain water pools in ruts and hollows and mirrors the lamps; props sit in baked contact occlusion. The low-resolution painted canvas it replaces is gone.

### D-46 · Light with sources, darkness between
Pools use a windowed inverse-square falloff normalised to keep the ground under each source at its brightness while tightening the pool, so light visibly comes from lamps, bulbs and windows and the spaces between stay dark. A light can be a theatre spot (a crisp disc from high above); two searchlights wander the plaza and midway. The moon sits low (≈34°) for long raking shadows. Mist became rolling banks that scatter light (a luminous veil) instead of dark smudges. Fog and darkness are mood, never a substitute for geometry.

### D-47 · An architecture kit for what the camera sees
At 50° the camera mostly sees roofs and fronts, so booths, the ticket booth, the grandstand, the funhouse and the canopies were rebuilt from a reusable kit (`models/arch.ts`): parametric canvas patches, peaked striped roofs and round canopies built one stripe per panel (crisp seams) sagging between rafters, scalloped valances, arched marquee headers, shingled pagoda roofs, turned posts, bunting. Props and boss rigs also receive procedural surface detail keyed off their surface presets (grain, weathered canvas, chipped paint, rust and verdigris).

### D-48 · Ground cover and small stories
Seeded, chunked, frustum-culled ground cover (wind-swept grass, stones, litter, straw) follows the ground layout; a few pieces of dressing tell stories (a roped queue at the ticket window, a generator with cables to the lamps, a signpost). None of it is solid: the simulation and its collision are unchanged. Grass is dropped on Low quality.

### D-49 · Telegraphs as markings on the ground
Danger fills became crawling caution-stripe hatching with scorched grain and lit edges — authored warnings painted on the midway floor rather than flat UI tints. Readability and colour roles (danger orange-red, caution amber, safe green) are unchanged.

### D-50 · Death scenes and less goofy balloons
Enemies no longer just vanish: the renderer keeps the last pose of each on-screen enemy and plays a short death beat when the sim removes it (balloons swell and burst; others topple, squash and sink under a fading flash) — no sim change. Balloons wear grimy, sun-faded latex darkening toward the knot, slanted deep sockets, a wide stitched grin and a mended tape patch, in a darker palette.

---

## Online co-op (D-51 … D-53)

### D-51 · Co-op follows Vampire Survivors
One authoritative `Game` holds the whole party. `g.player` / `g.input` / `g.weapons` are a *current player* context that the tick points at each player in turn: for their weapons, at the nearest standing player for each enemy, at a re-picked target (every 2.5 s at most) for each boss, and at the relevant player for drafts and pickups. Between ticks the context rests on player 0. Systems written for one player therefore work unchanged. The rules are VS's:
- XP is shared, and each level-up gives every living player their own hand. The night stays frozen until all hands are chosen.
- Weapon and passive slots shrink with party size: 6 solo, then 4 / 3 / 2 each, which raised the solo cap from 4 to 6 (`COOP.slots`).
- An item owned by one player leaves the other players' pools. An evolution may use a teammate's passive.
- Characters are exclusive.
- A fallen player lies in a coffin that opens in 40 s, or 6 s with a teammate standing next to it, and gets back half their health. All players down ends the night.
- A chest's rolls are dealt round-robin from the opener. The entries are tagged with their owner and shown on one split wheel that both players watch.
- Food heals the collector, and Lost Tickets, achievements and run stats are paid per player (`endStatsAll`).

### D-52 · Netcode: host-authoritative snapshots with prediction, over WebRTC
The host's browser runs the only simulation and the guest is a thin client:
- **Transport.** PeerJS does the signalling and opens a reliable, ordered DataConnection for JSON control messages. A pre-negotiated, unordered, zero-retransmit RTCDataChannel on the same peer connection carries binary snapshots (20 Hz) and inputs (60 Hz, each packet repeating the last 6). Binary falls back to the reliable connection if the datagram channel cannot open.
- **Snapshots.** These are deltas against the newest snapshot the guest has acknowledged. Each entity's static, motion and state parts are re-sent only while the guest may lack their current bytes. Presence bitmaps mark live slots, bosses send only their changed JSON keys, and interest rings scale with the guest's view.
- **The guest's world.** Snapshots are written into a mirror `Game` that is never ticked, so the solo renderer, HUD and audio run unchanged. Entities interpolate one snapshot behind and hazards extrapolate.
- **Prediction.** The guest predicts its own movement with the host's movement code (`sim/movement.ts`) and reconciles against the acknowledged input, easing corrections out.
- **Input buffer.** The host applies guest inputs once each, in order. It repeats the last one for at most 2 ticks when a packet is late, and only shaves a backlog that persists. A held night (draft, pause, prize wheel, dropped partner) counts arriving inputs as spent. The guest is told via a snapshot flag and stops predicting.
- **Validation.** Everything received is size-capped, rate-limited and validated.

Sessions speak to a `NetLink` interface, so the whole flow is tested headless over a deterministic loopback with latency, jitter, loss and duplication. The transport can be swapped (own signalling server, relay, WebSockets) without game changes. Details and measurements: `docs/MULTIPLAYER.md`.

### D-53 · Co-op scaling and session behaviour
- **Scaling (solo untouched).** A duo faces ×1.25 crowd density: cap, minimum alive and spawn rate (`COOP.density`). Enemy and boss HP is ×1.3 (`COOP.hp`). Two players bring about twice the weapons early but only ~1.3× a solo build once their 4 slots are full, so toughness rises less than linearly. This is untested by humans; tune after alpha.
- **Pause.** A pause stops the night for both, and the other player sees who paused. The co-op group is two friends, so a shared pause beats VS's "pausing doesn't stop the game" for someone answering the door.
- **Item pool.** The host's unlocks define the item pool. Each player may pick only characters their own save has unlocked. The guest's meta perks are clamped to what a real save could hold.
- **Leaving and dropping.**
  - The host leaving ends the night: there is no host migration in the alpha.
  - A guest who drops or refreshes mid-night holds their seat with a token in that tab's `sessionStorage`. The host's night pauses for up to 20 s ("Carry on alone" skips the wait), and the guest rejoins the same seat with a full first snapshot.
  - While a guest is absent past the wait, the host auto-picks their level-up cards so the night is never held.
- **Excluded modes.** Endless and the Daily Run stay solo.

### D-54 · Online parties of up to six
- **Seats.** The host plus up to five guests (`MAX_PLAYERS`). Seats close up in the lobby when someone
  leaves, so seat index = player index when the night starts; every lobby message tells each guest
  its seat. A seventh connection is refused ("full").
- **Slots.** Vampire Survivors gives 6 weapons + 6 passives solo, 4 each for two, and one fewer for
  every extra player (3, 2). VS stops at four players, and its rule would hit 0 at six, so five and six
  players hold at its floor of **2 + 2** (`COOP.slots` = 6/6/4/3/2/2/2 by party size).
- **Characters may repeat.** There are six fools and most saves unlock fewer, so a party of six could
  not start with exclusive characters. Player colours (gold, teal, rose, lime, violet, tangerine) keep
  duplicates apart: name tags, partner cards, prize owner tags, lobby seats.
- **Chests.** Each roll goes to whoever has been dealt the fewest chest prizes so far tonight, with ties
  going round from the opener. A duo still alternates, opener first. A party of six shares 1–5-roll
  chests evenly over the night (everyone within one prize).
- **Scaling.** Density ×1.72 / ×1.82 and enemy HP ×1.85 / ×2.0 for five / six players, continuing D-53's
  curve. A guess, like D-53's, to tune from play.
- **Netcode.** Each guest has its own delta stream (encoder, sequence, cosmetic queues): the encoder's
  "already sent" tracking is per receiver, because interest management means guests see different
  entities. The string dictionary stays shared (append-only, acknowledged per guest). A rejoining
  guest restarts only its own stream. The host broadcasts a **hold status** (`draft` / `prize` /
  `reconnect` / `pause` plus the players being waited on), and every screen words its waiting note from
  it ("Waiting for Ann and Bo to choose…"). With three or more players, big snapshots drop to 15 Hz to
  share the host's upload.
- **Keepalive.** A message's arrival is stamped at the next update rather than with the session's
  cached clock. A tab whose loop stalled no longer wakes up, sees a stale stamp and drops a live link.
  The background clock also runs whenever animation frames stall, not only when the tab reports
  itself hidden.

### D-55 · Music: Bradley's score for menus and bosses, a quieter waltz between
- "Freaky Funk Circus" (Bradley Schwarz) plays on the menus, results and dawn, and through **every boss
  fight**, a little faster in the Ringmaster's later phases. The procedural big-band boss themes are
  gone.
- Between bosses, a procedural **music-box waltz** in a minor key (3/4, 72–90 BPM) carries the night:
  a slightly out-of-tune music box, a hushed oom-pah-pah, then a detuned calliope, a heartbeat on the
  downbeat and more pitch wobble as the Acts deepen. Less frantic than the funk track, still creepy.
- **Quest sounds carry.** Every secret-quest cue and fortune dips the music bus to ~28% for 1–3.4 s
  (`QUEST_DUCK`), so the lamp chimes, the carousel's music box and the striker's bell are heard over
  the score. Soul pickups don't duck: they come too often.

### D-56 · Quest and boss polish from the first alpha session
- **Melody lamps.** A lamp whose note has been played in the current attempt turns **red** (glass,
  ground light, light shaft) and can't be triggered again; a wrong lamp resets the song and every lamp
  goes back to green. Each true note whispers "The note rings true — one/two/three of four", like the
  "The melody falters" whisper for a wrong one. Once the song is sung, the lamps stay red and silent.
- **Tent inhale.** The pull now reaches the whole 420-unit warning circle (it stopped at 280 before)
  and grows toward the maw: 85 units/s at the rim to 170 at the centre. That's enough to drag a
  standing player in, but under the slowest fool's 187 so anyone walking away escapes. The Calliope's
  inhale gets the same reach. Guests predict the pull with the same formula
  (`addHazardPull`), so it feels the same on every screen.
- **Dead tent.** The Big Top's remains are a flat, crumpled striped tarp lying 1.5–5.5 units above the
  ground, walkable. The old wreck touched the ground at its rim (z-fighting) and shadowed itself (acne):
  both caused the flicker. The tarp casts no shadow and is depth-offset.
- **First chest.** Showing the prize booth added two lights, and three.js rebuilt every material's
  shader for the new light count: a multi-second stall on the night's first chest. The booth's shader
  variants are compiled ahead of time (at boot and at the start of each night) against the post chain's
  real render target, including the icons' textured variant.
