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

### D-57 · Slower to max out: XP curve, party XP, fewer chests, no chest evolutions
- **Solo curve.** A playtest maxed every item around minute 17; the target is ~24. XP income accelerates
  through the night (bots earn 1.8–2.2× as much XP by minute 24 as by minute 17), so the late bands
  roughly double: per-level steps go 16 → 30 for levels 21–40, 36 → 100 for 41–60, and 60 → 150
  beyond. Levels 1–20 are unchanged, so the opening is as brisk as before. (Bots are weaker than people;
  they finish 54–80% of a build by minute 24 on the new curve.)
- **Party XP.** XP is shared and a party earns it several times faster, while each player has fewer
  slots to fill: on the old curve, bot duos maxed by 10:08, trios by 7:22 and six players by 6:23. A
  party now needs ×7 / ×13 / ×20 / ×25 / ×30 the XP per level for 2–6 players (`COOP.xp`), ramping in
  over the first six levels so a co-op night still opens with quick level-ups. Calibrated so bot
  parties finish roughly as much of their builds by minute 24 as solo bots (single bot nights are
  noisy: tune from play).
- **Fewer prize wheels.** Chests from random sources come 20% less often: brutes 80% of the time, elites
  1.6% (was 2%), the Clown Car 80%. Boss chests and the Last Ticket event's chest stay guaranteed.
  Elite chest odds are also divided by the party's crowd density, since a denser crowd brings more
  elites.
- **No evolutions from chests.** A ready evolution is offered only as a level-up card; a chest's rolls
  always level items (or fall back to a new weapon, a voucher or a heal).

### D-58 · Readability: silhouettes, attack opacity, lamp wisps, stacked whispers
- **Silhouettes through buildings.** Monsters, their shots and the players' shots get a rim-lit
  silhouette (red / hot orange / pale blue) wherever scenery hides them. It's an x-ray twin of each
  instanced batch, using a "behind" depth test, drawn after the static world and before every other
  actor; the ground moved to the end of the queue so feet touching it don't count as hidden. Off at low
  quality.
- **"Your attacks: opacity"** (Settings, 15–100%) fades the players' own projectiles, orbitals,
  summons, beams and friendly zones, so enemy shots stay readable in a crowd. Enemy shots are never
  faded.
- **Lamp wisps.** A lamp whose note is played sends up a glowing wisp of its emblem (the plaque painted
  on the carousel), so players learn which emblem belongs to which lamp as they go.
- **Whispers stack.** Quest whispers that arrive together stack in a column instead of printing over each
  other; a repeat of one still showing is dropped, and at most three show at once.
- **Prize wheel title.** A plain spin no longer prints "PRIZE WHEEL" over the booth's own sign; only
  bonus spins announce themselves.

### D-59 · Connection diagnostics and the relay question
- A player on Opera GX could never connect, hosting or joining. Signalling worked, but the WebRTC link
  never opened. Opera's WebRTC setting "Disable non-proxied UDP" (and its VPN) are known to break
  peer-to-peer links, and the setting can switch itself back after a restart.
- PeerJS's built-in TURN relays answered neither UDP nor TCP in testing, so the game had no working
  relay. Defaults are now free public STUN only (Google, Cloudflare); a deploy that needs a relay adds
  TURN in `net-config.json`.
- The multiplayer menu runs a **connection check** (gathers ICE candidates for a moment): ready / ready
  with relay / address hidden / WebRTC blocked, with the Opera fix in the warnings. A join that finds
  the lobby but never connects explains why, using that check. The host gets a notice when someone's
  join attempt stalls.

### D-60 · The Midway: the first map becomes the hub
- **Unlock.** Fully completing the first night (its secret quest, the Last Song, carried to True Dawn)
  opens the Midway for good (`SaveManager.hubUnlocked()`). The results screen announces it. For alpha
  testing, `?unlock=midway` on the URL opens it on that browser's save (`midwayTester`).
- **Arrival.** With the Midway open, pressing start lands you on the carnival grounds instead of the
  main menu; backing out of any menu returns there. It's the same map in a peaceful mode
  (`RunConfig.hub`): nothing spawns, no weapons fire, the clock stands still, and the dormant Big Top
  and Ferris Wheel stay scenery. Bradley's theme plays.
- **What's there.**
  - **Ticket booth:** opens the Lost & Found.
  - **The Big Top:** begins the First Night (character select). Afterwards the results lead back to
    the Midway.
  - **The cast:** each unlocked starting character stands at their game and turns to face you. The
    Carny is at the Ring Toss, the Strongman at the High Striker, the Fortune Teller at Zoltana's
    cabinet, the Ride Operator at the carousel, the Lost Child at the Prize Stand, and the Ringleader
    at the Big Top. Each has three lines of lore, and three of them hint at the next attractions.
  - **Coming soon signs:** chained gates at the Fun House door, the Boardwalk (on the promenade) and
    the Ghost Train (the east fence).
  - **Esc menu:** invite or join friends, Daily Run, Carnival-pedia, Settings, Title Screen.
- **Co-op.** A host whose save has the Midway invites from its menu; friends who join walk onto the
  host's Midway, whatever their own saves have unlocked. Joining stays open there, unlike a night. The
  host rebuilds the hub when the party changes, keeping everyone where they stood, and sends it as a
  start config with `hub` set (`HostSession.startHub`). Guests walk as the fool they last played. At the
  Big Top the host takes everyone to character select (`toLobby`); "Back to the Midway" returns from
  there, and after a night everyone comes back to the hub. The background clock keeps the host's
  Midway ticking while their tab is hidden, as it does for a night.
  `PROTO` is 6: the start config carries `hub` and guests send `pref`, so an older tab gets refused
  with "reload the page" instead of mirroring a hub as a night.

### D-61 · Co-op tuning, the Puppet King's stage, a casino prize wheel, Brad's new mix
A co-op playtest found the night slightly too hard, the Puppet King's fight full of invisible walls
and teleports, and the prize wheel dull and see-through.
- **Passive slots shrink half as fast.** Weapons keep Vampire Survivors' 6 / 4 / 3 / 2 (two for five
  and six players). Passives lose half as many slots: 6 - (6 - weapons) / 2, so 6 / 5 / 5 / 4 / 4 / 4
  for one to six players (`COOP.passiveSlots`). Three players' 4.5 rounds up, since the playtest found
  co-op too hard.
- **Party XP about 15% gentler.** `COOP.xp` goes from 7 / 13 / 20 / 25 / 30 to 6 / 11 / 17 / 21 / 25 for
  two to six players, which means 17-20% more level-ups from the same XP. It's deliberately not a big
  cut. Bot parties (`scripts/party.ts`, god mode, 3 seeds) finish much less of their builds by minute 24
  than a solo bot (duos 39-48%, trios 52%, solo 77%), so this can't tip parties into maxing out early.
  Three seeds can't measure a 15% change, though: tune from play.
- **The Puppet King's stage.** It always had an invisible ring that pulled back only the player he was
  chasing, at 6 units/s for every unit outside, with no cap. Far-off players were yanked across the
  map, and guests, whose games didn't predict it, rubber-banded off an invisible wall. Now:
  - the stage comes down around the party, centred on the biggest group within 600 units (solo:
    unchanged);
  - its ring of string lights is drawn on every screen, over scenery, and brightens ahead of anyone
    nearing it. A banner after he lands reads "STAY IN THE LIGHTS";
  - it reels back every standing player outside it, capped at 560 units/s (`RING_PULL_MAX`). That's
    faster than any build walks, so nobody escapes, but it's a glide rather than a jump, and it sets
    them down just inside the edge;
  - while it pulls, a taut glowing string runs from the edge to that player, and their own game plays
    a twang as it starts;
  - the ring is plain boss state (`ringX`, `ringY`, `ringR`), so it reaches guests, and their
    prediction applies the same `addRingPull`. It's released when he falls.
  - His three string sweeps now move as one rank: all up, all down, all left or all right.
- **The prize wheel sits on top.** It moved into an overlay scene that's drawn after the world with
  a fresh depth buffer, before bloom and the grade (`Post3D.addOverlay`). No telegraph or x-ray
  silhouette shows through it any more, and the world's materials no longer recompile when it
  appears.
- **The prize wheel is lit and loud.**
  - **Lighting:** a warm wash, a bright studio reflection for the gold, saturated wedges. The night's
    darkness, vignette and hurt tint ease off while it's up.
  - **Lights:** bulbs ride the wheel's rim, the marquee chase runs at the wheel's own speed, and
    everything strobes on a win.
  - **Slot-machine sounds:** a reel whir, a blip per peg that climbs as the wheel slows, a jackpot
    bell and a shower of coins.
- **Prize cards say what you won.** The card that leaps out shows:
  - the kind (NEW!, LEVEL UP, CHARM…);
  - the icon;
  - the item's name;
  - its new level (or MAX LEVEL, or what a voucher or heal gave);
  - in co-op, "WON BY" and the winner's name in their colour.

  It's held for 1.5 s. Chest entries now carry `name`, `level`, `max` and `note`.
- **Music.** Bradley's new mix is a single file, `freaky_funky_circus.mp3`, replacing the intro and loop
  files. It's mastered about 2.2 dB louder, so it plays at 0.78 to match. Menus play it from the top,
  then loop from the groove at 11.98 s, and boss fights start at the groove. The title menus keep it.
  The Midway gets its own hushed, slower carousel waltz instead: 58 bpm, quieter than any night, an
  out-of-tune music box, a faint calliope, no heartbeat.
- `PROTO` stays at 6, which hasn't shipped yet. The ring rides in the reflective boss state and the
  card fields in the forwarded chest event.

### D-62 · Playtest tuning: firing squads, party crowds, readable draft actions, levelling evolutions
- **Firing squads.** The Puppet Soldier ranks that march in from 12:00 proved too much. Half of every
  rank now comes as Evil Clowns, so a rank of 4 is 2 muskets and 2 clowns, and a rank of 5 is 2 and 3.
  The crowd stays as dense. The Puppet King's own levies are unchanged.
- **Party crowds pay a solo night's XP.** The party XP cost per level (D-57, D-61) stays as it is.
  `COOP.density` rises to 2.0 / 2.3 / 2.5 / 2.6 / 2.6 for two to six players (from 1.25 / 1.45 / 1.6 /
  1.72 / 1.82). That scales the alive cap, the minimum alive and the spawn rate. Bot duos at 2.0 collect
  19.2k XP by minute 24, against 7.3k before and 19.5k for a solo bot, and finish 64% of their build
  (40% before). Bot trios and quads flee dense crowds and leave tickets on the ground, so their runs
  don't show the gain; tune from play. The Midway alive cap stays under the 520-enemy pool.
- **Reroll / Banish / Skip** are large buttons, each with an icon, a line saying what it does, a count
  of how many are left and the key. Banish mode outlines every card in red and shows "⊘ BANISH" on the
  one under the cursor.
- **Evolutions level.** An evolved weapon starts at Evo Lv 1 and levels to 8 from level-up cards and
  prize wheels. Each evolution has a seven-step plan, mostly damage (+10% four times, +16% at Evo Lv 8)
  with its own strengths in between: area for slams and fields, speed for projectiles and orbits,
  cooldown, one more card, pet or note, pierce, or duration. Projectile speed gained a level table
  (`lv.spd`) for this. The tray shows ✦3, then ✦MAX.
- **The Funhouse Mirror is capped.** Its `damage` is now the clones' total share of your damage, split
  between however many clones there are, so the Amount stat spreads clones out without multiplying
  them. It's 12% at Lv 1 and 30% at Lv 8. The Hall of Mirrors gives 36% at Evo Lv 1 and 50% at Evo Lv 8.
  Before, each clone replayed every attack at up to 60% (75% for the evolution), and Amount added
  clones, so 3-4 clones could add 200% or more.
- **Prize wheel bulbs** cycle eight saturated colours, saturated enough that the hue survives the glow.
- **The Steam Calliope's icon** was missing (no drawing for the `calliope` kind). It's now a little
  steam organ, and the Grand Requiem's version adds notes.

### D-63 · The Fun House: a second map
- **A map registry, not a fork.** `data/maps.ts` defines each map: layout, waves, Acts, bosses, events,
  scenery, final boss, miniboss, world builder, intro card and hidden quest. `useMap(id)` swaps the live
  bindings every other module already reads (`PROPS`, `WAVES`, `BOSSES`, `EVENT_POOL`, …). A `Game` asserts
  its own map every tick, so games on different maps interleave safely; the tests and the co-op guest
  mirror both rely on that. The renderer keeps one world per map and swaps it in (`setWorld`). The
  Carnival Core is untouched except for reading its tables through the registry.
- **Same night, different house.** The Fun House keeps the first map's gates (6:00, 12:00, 18:00 and
  24:00), its run length, its crowd curve and its payout. It differs in floor plan, roster (7 of 11 enemy
  types new), machinery, bosses, events, score and quest. That makes the maps comparable, and every
  balance tool still applies.
- **Mirrors you can believe, at a price we can pay.** Planar reflections per row of south-facing glass
  (the camera looks north, so only those are seen face-on), with:
  - a low-resolution target and a tightened frustum;
  - an oblique near plane, using the general form for orthographic cameras;
  - a round-robin budget by quality;
  - a lagging copy for the "slow" glass;
  - a mirror-only layer for the quest's faces.

  The reflection plane leans back 12° because an honest top-down reflection only shows shins. A
  low-quality fallback (a sheen, plus a smudge on the glass for the quest's faces) keeps the map
  completable everywhere.
- **Bosses that ignore walls.** In a building full of walls, pathfinding bosses would be stuck or
  absurd. These are the house's own creatures, and walls are scenery to them:
  - the Twins step out of mirrors;
  - the Glass climbs out of its frame;
  - the Stringmistress hangs above the rafters;
  - the Proprietor owns the place.

  They arrive near the party and stay inside the house. Every attack picks on the nearest standing
  player, so co-op shares the pressure.
- **A quest twice as deep, still fair.** The Unreflected has nine steps from dormant to complete,
  against the Last Song's six. It leans on attention:
  - reflections (with a low-quality smudge);
  - an anamorphic mural that pulls together as you near its footprints;
  - a four-mirror beam puzzle drawn live as you solve it;
  - a mirrored-clock riddle with exactly one answer and exactly one trap (tested over 40 seeds).

  Other guarantees:
  - Everything is diegetic. Mira's whispers use the existing whisper line, as the Last Song's
    fortunes do.
  - Nothing breaks permanently, and nothing needs two players at once.
  - Co-op guests get the whole chain as 17 bytes a snapshot through a new generic quest block (every
    chain except the Last Song, which keeps its own).
  - Its fixtures were moved after visual checks so the camera can see them: the footprints, three
    pivot plates and the corridor clock had been in wall-hidden strips or facing sideways.
  - The reward is a new passive, Mira's Hand Mirror. The secret unlocks are now granted per quest
    (`QUEST_UNLOCKS`).
- **Map choice is the host's.** The solo character screen has a "Tonight" row. The co-op lobby carries
  `map`, set by the host (`setMap`, refused mid-run). `StartCfg.map` tells every guest which house to
  build, and unknown ids fall back to the Carnival Core on the wire. PROTO 7. The Fun House opens after
  the Ringmaster's first defeat or the Midway unlock; `?unlock=funhouse` opens it for testing.

### D-64 · The Fun House follows the first night's curve, about 15% harder
- **The report.** Starting the house as a fresh level-1 character, the opening mobs took far too many
  hits. The house had opened with 120-HP Mannequins and 60-HP Marionettes where the first world has
  4-HP balloons. Measured on actual spawns, Acts I and II averaged 3× the first world's health per spawn
  (11.9× in the first minute), while Acts III and IV were about even. The challenge came backwards.
- **One rule.** Every Fun House enemy takes a first-world enemy's slot at about 1.15× its health and
  contact damage, keeps the same tickets, and arrives when that enemy does:
  - Marionette for the Wind-Up Monkey;
  - Mannequin for the Possessed Stuffie;
  - Crooked Clown for the Dunk Tank Clown;
  - a splitter family for the Cotton-Candy Slime;
  - Glasswalker for the Carousel Horse;
  - Doppelganger for the Puppet Soldier;
  - Grand Display for the Carnival Brute.

  The Reflection Thief takes the Ticket Booth's capped slot at 300 HP, because a 600-HP blinker would be
  a chore. The waves now open on balloons and marionettes, as the first world's open on balloons and
  monkeys. Acts III and IV lean on Glasswalkers and Doppelgangers, because splitters don't carry an
  act's weight.
- **The result.** Measured per act (`scripts/maphp.ts`), the house is now 1.2×, 1.1×, 1.1× and 1.2× the
  first world. A test holds Acts I and II to 1.0–1.3×, wave by wave.
- **Readability.**
  - Marionette landings are telegraphed: the spot is marked for the whole leap, and the radius is 50.
  - The unwatched Mannequin sprint drops to 140, the evil clown's tier.
  - The Proprietor's cabinet brings one thief.
- **Not tuned to bots.** The mortal bots die sooner in a house of walls than on open ground. Kevin
  judged that natural, so his playtests decide the next step.

### D-65 · A chat box that keeps the quest's words, health bars overhead, hit numbers, chest arrows
- **One box for talk and clues.**
  - **Where.** Bottom-left, above the health bar and the party cards (it moves up as cards appear).
    It shows in a night, on the Midway and in a co-op lobby.
  - **What it holds.** Co-op players talk in it: T opens a line, Enter sends, Esc closes. Every
    whisper and fortune of a hidden quest is written into it as well, the Last Song's and the
    Unreflected's both. A clue that faded off the screen can be read back.
  - **Solo.** A solo night shows the box only once a quest has written in it.
  - **Fading.** New lines linger for 14 s, then fade; the last seven stay readable. Opening the line
    shows the scrollback (80 lines).
  - **Look.** Velvet-and-gold, in the HUD's fonts, with player names in their colours, quest whispers
    in the whispers' ghost green and Zoltana in gold.
- **Typing never plays the game.** The chat key is a rebindable action (default T). It is never typed
  into the line, and it never sticks. The line swallows every key until closed, and opening it drops
  held keys so nobody keeps walking. In co-op the night keeps going while you type.
- **Chat over the wire (PROTO 8).**
  - **Path.** Guest lines go through the host, which relays them to everyone, the speaker included,
    so every screen agrees on the order.
  - **Validation.** Every line is cleaned and capped at 140 characters on both ends, and drawn as
    text, never markup.
  - **Flood guard.** A per-guest bucket (4 lines, then one per 0.7 s) drops floods quietly rather
    than kicking anyone.
- **Health bars over bosses and minibosses.**
  - **Bosses.** Every awake boss gets a bar over its head, coloured like its boss bar and marked at
    its phase thresholds. Each floats at a per-boss height (the Ringmaster's rises with the demon).
  - **Minibosses.** The Carnival Brute and the Grand Display get a smaller bar with their name.
  - **Guests.** Guests didn't receive enemy health, so minibosses now send theirs in a few bytes
    (pool index, 0–255).
- **Hit numbers.** The damage you take pops off your character in red. Hits within 0.16 s add up into
  one number, and a hit of 15% of your health or more pops bigger. They follow the damage-numbers
  setting.
- **Chest arrows.** Up to three small gold arrows circle your character, pointing at the nearest
  chests, and disappear once you're nearly on top of one. The screen-edge markers for off-screen
  chests stay.
