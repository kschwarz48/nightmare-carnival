# 02 · Art Direction

**One-line target:** *Cuphead at midnight* — 1930s rubber-hose cartoon charm, soured into carnival horror, rendered so a hundred enemies on screen still read instantly.

---

## 1. The look in a sentence

Hand-drawn, ink-outlined, rubber-limbed attractions with googly, grinning menace, lit by sickly neon and a bone-white midnight moon, against warm sepia-and-rot boardwalk backdrops. Everything **squashes, stretches, and breathes** — nothing is rigid, because nothing is dead.

---

## 2. Honest production-path decision (read this first)

True Cuphead-style art is **frame-by-frame, hand-inked animation** — gorgeous and *enormously* expensive (Cuphead took a small studio years). For a survivors-like with hundreds of on-screen entities, going full frame-by-frame for every enemy is almost certainly out of scope for a small team. Pick a lane consciously:

| Path | What it is | Pros | Cons | Recommended for |
|------|-----------|------|------|-----------------|
| **A. Skeletal / cut-out** *(recommended)* | Draw each character once in parts (head, body, rubber-hose limbs), animate via `Skeleton2D` + `AnimationPlayer` or an imported rig (e.g., Spine/DragonBones). | Rubber-hose motion at a fraction of the frame count; easy to retint/variant; tiny memory. | Less "boil"/charm than true hand-drawn; rig setup cost. | Most enemies & the player. |
| **B. Limited frame-by-frame** | 4–8 key hand-drawn frames per action, held + smeared. | Real cartoon charm; classic look. | Heavy art time; large atlases. | **Bosses** and the player's signature poses. |
| **C. Hi-bit pixel art** | Detailed pixel art with a rubber-hose sensibility. | Far cheaper; great enemy density; easy team. | Not literally "Cuphead." | Fallback if the team is pixel-first. |

**Default recommendation:** **Hybrid — A for the swarm, B for the four bosses.** Bosses are the spectacle (pillar: "the carnival is the monster"); spend the hand-drawn budget there. Common enemies use skeletal rigs with a hand-inked *style* so they still feel of-a-world.

> If you choose **C (pixel)**, enable Godot 4.7's **nearest-neighbor viewport scaling** for crisp low-res output. If you choose **A/B (HD vector/hand-drawn)**, keep textures high-res with mipmaps off for 2D and rely on the camera zoom.

This doc describes the **visual language**; it applies to whichever production path you choose.

---

## 3. Color & lighting

### Mood palette (midnight carnival)
- **Backdrop:** desaturated sepias, faded boardwalk wood, rotting candy pastels, deep navy night sky. The *world* is muted so threats pop.
- **Neon accents:** electric magenta, toxic cyan, acid green, hot-coal orange — the lights are the only "alive" color in the dark. Lean on Godot 4.7 **HDR output** to let neon and firework VFX truly glow.
- **Moon & sky:** a single huge bone-white moon; cool rim light from above on everything.

### Lighting setup (Godot)
- Global night tint via a `CanvasModulate` (deep blue-violet, ~`#1a1530`).
- `PointLight2D` pools of warm/colored light at attractions (booths, the carousel, broken bulbs) so the player moves between islands of light and dark.
- A soft `PointLight2D` follows the player (a lantern/phone glow) — gameplay-relevant: it defines a small "seen" bubble and makes the dark feel oppressive without hurting readability of nearby threats.
- Enemies get a subtle **rim/edge light** (additive outline) so silhouettes separate from the dark backdrop even in a crowd.

### Readability palette law (non-negotiable — pillar #2)
- **Player & player VFX:** brightest, warmest, highest-contrast on screen. The player is never lost.
- **Enemies:** unified "threat" hue family per Act so the eye groups them; cool/eerie.
- **Enemy danger (hitboxes/projectiles that hurt you):** always the same **hot warning color** (e.g., searing red-orange), regardless of source. Players learn "that color = it touches me, I die."
- **Telegraphs:** the same warning color, flashing/growing before an attack lands (see §5).
- **Pickups:** Tickets = bright gold-yellow; Gold = distinct; healing = green; chests = rainbow shimmer. Never reuse the danger color for a pickup.

Provide a **colorblind-safe alternate set** for all of the above (see accessibility in doc 01).

---

## 4. Character & enemy design language

- **Personification first.** Each design starts from a real carnival object and asks "what's its face, what are its limbs, how does it move when it's evil?" A balloon gets a gnashing knot-mouth; a ticket booth grows stubby legs and a slot-mouth that spits tickets.
- **Rubber-hose limbs.** No elbows/knees — bendy noodle arms and legs, white-gloved hands, pie-eyes (or X-eyes when dead).
- **Silhouette test.** Every enemy must be identifiable as a **pure black silhouette** at gameplay zoom in a crowd of 50. If two enemies share a silhouette, redesign one.
- **One readable "tell" per enemy.** A single distinctive shape/motion that signals its threat (the Carousel Horse's lowered head before a charge; the Clown's wind-up honk).
- **Squash & stretch is mandatory.** Idle = gentle breathing bob. Move = lean + bounce. Hit = squash. Death = exaggerated pop/deflate/un-stuff.
- **Cartoon horror, not gore.** Damage = comedic destruction: balloons pop, stuffies burst stuffing, puppets clatter into parts, clowns deflate. No blood; "candy-guts," confetti, springs, sawdust, and steam instead.

See `04_enemy_bible.md` and `05_boss_bible.md` for per-creature visual notes; this doc governs the shared style.

---

## 5. Animation principles

Borrowing classic principles, tuned for a bullet-heaven:

- **Boil / breathing:** even idle sprites subtly wobble (line boil or a 2-frame breathe) so the world never feels static.
- **Anticipation + telegraph = the same beat.** Every attack has a wind-up the player can read: the enemy pulls back, a warning shape grows in the danger color, *then* the attack fires. The wind-up duration is a balance lever (longer = fairer). Bosses get long, theatrical telegraphs (Cuphead-style "here it comes").
- **Smears & multiples** on fast motion (charges, projectiles) for that hand-drawn snap.
- **Exaggerated death** so kills feel good at scale — the screen should feel like popping bubble wrap when a wave dies.
- **Frame economy:** target animation lists per common enemy = `idle`, `move`, `attack` (if any), `hit`, `die`. Bosses get far more (per-attack anims, phase transitions, intro, defeat).

### Standard animation names (use these exact strings in `AnimationPlayer` / `SpriteFrames`)
`idle`, `move`, `attack`, `attack_windup`, `hit`, `die`, `spawn`, `special`. Bosses additionally: `intro`, `phase_2`, `phase_3`, `defeat`, and `atk_<name>` per attack. Keeping names consistent lets the code drive animation generically (see doc 08 `AnimationComponent`).

---

## 6. VFX & "juice"

Juice is a core feature, not polish-phase garnish — it's how mowing down a crowd *feels*. Budget for:

- **Hit feedback:** white flash on hit (shader `modulate`/`flash` param), brief squash, small impact spark, damage number popup (pooled).
- **Death FX:** themed burst per family (confetti, stuffing, springs, balloon shreds, sawdust puff).
- **Pickup FX:** Tickets streak toward the player with a trail and a soft chime; level-up = brief golden bloom + the draft UI fanfare.
- **Screen feel:** light, *frequent* micro screen-shake on big hits; bloom on neon & fireworks (HDR); chromatic aberration spike on player damage; a vignette that pulses red at low HP. All reducible via options.
- **Weapon VFX** are the player's main spectacle — fireworks should genuinely fill the screen at high levels. Lean into it; that's the power-fantasy payoff.

Implement common VFX as **pooled, self-freeing one-shot scenes** (e.g., `vfx_pop.tscn` with a `GPUParticles2D` + `AnimationPlayer` that returns itself to the pool on finish). See doc 08.

---

## 7. Environment & set dressing

- **Three zones, three flavors** (full layout in `03_map_and_level_design.md`): warm-rotten **Carnival** core, weather-worn **Boardwalk** planks, cold moonlit **Beach** sand. Each gets its own ambient palette and prop set.
- **Props:** ticket booths, striped tents, prize stands, popcorn carts, game stalls (ring toss, milk bottles, dunk tank), broken bulbs, tangled string-lights, the dead carousel, the looming Ferris Wheel on the skyline.
- **Breakables** (drop Gold/health): popcorn carts, prize stands, crates, pumpkins, jack-o'-lantern bins. Telegraph "breakable" with a consistent subtle outline/shine.
- **Godot 4.7 tip:** use **Scene Paint Mode (B)** to scatter ground clutter, lights, and breakables quickly across the open map without grid-snapping — ideal for organic boardwalk decoration.
- **Parallax & depth:** a far skyline layer (moon, Ferris Wheel, tent peaks), a mid backdrop, the play layer, and an overhead light/fog layer. Light fog/mist drifts across for atmosphere and depth.

---

## 8. UI & typography

- **Vibe:** vintage carnival posters & marquee signage — circus slab-serifs and bouncy show-card scripts, drop shadows, banner ribbons, ticket-stub motifs, marquee bulbs around panels.
- **HUD (minimal, bottom/edges, never center):**
  - XP/Ticket bar across the top (marquee-bulb fill).
  - Level number on a ticket-stub badge.
  - Run timer styled as a clock ticking toward dawn (with a moon→sun indicator).
  - HP as a string of light-bulbs or a banner bar, bottom-left.
  - Weapon/passive icons in a small bottom tray. *(Implemented now as a functional **text** loadout readout — weapon names + levels, passive names + stacks — so builds are legible while playing; the styled icon tray is part of the M6 HUD pass.)*
- **Level-up draft:** the centerpiece UI moment — cards styled as **carnival game prizes / tarot cards**, with rarity = ribbon color. Big, juicy, satisfying to pick.
- **Readability rule:** UI must never occupy the central combat zone; keep the middle 70% clear.

---

## 9. Audio direction (specs the art of sound)

Audio sells "cartoon horror" as much as the visuals.

- **Music:** circus/calliope and carousel-organ themes **bent into minor keys and detuned** as the night deepens. Each Act darkens the same motifs; each boss has a bombastic show-tune. A faint, warped "happy" carousel loop underneath everything is the signature unease.
- **Instrument palette:** calliope/band organ, honky-tonk piano, tuba/oompah brass, glockenspiel, music-box, theremin/saw for dread, big-band drums for bosses.
- **SFX language:** cartoon foley — boings, honks, slide-whistles, kazoo, balloon squeaks, wind-up clockwork, pop/deflate, springs, ticket-machine cha-chunk. Player weapons get punchy, satisfying, *layered* sounds (the firework "whoomph-crackle" is the reward sound).
- **Dynamic audio:** layer in instruments and raise tempo/intensity with on-screen enemy count and Act; drop to an eerie sparse bed during the Intermission Wagon and pre-boss lull, then slam the boss theme.
- **Diegetic dread:** distant calliope, a carousel that won't stop, far-off carnival-barker muttering ("step right up… step right up…"), the Ferris Wheel creaking on the skyline.
- **Accessibility:** separate volume sliders (music/SFX/UI/ambient); a "reduce shrillness" option; visual alternatives for key audio cues (boss-incoming, low-HP).

---

## 10. Asset specs & Godot import conventions

> Concrete defaults — adjust to your chosen production path, but keep them consistent across the project.

**Reference resolution:** design the game at **1920×1080**, base game world camera at a fixed zoom showing ~30×17 "tiles." Set Project → Display → Window → Stretch mode `canvas_items`, aspect `expand` (supports ultrawide/letterbox cleanly).

**If HD hand-drawn / vector (paths A & B):**
- Source art at 2× intended on-screen size for crisp zoom; export PNG with premultiplied-free straight alpha.
- Texture import: **Filter on**, Mipmaps **off** (2D), repeat off.
- Common enemy on-screen footprint ≈ 96–160 px tall; bosses 400–900 px.
- Pack per-actor frames into atlases; one `SpriteFrames`/atlas per enemy family. Keep individual textures ≤ 2048² where possible.

**If pixel art (path C):**
- Pick a base like 320×180 internal → integer-scale to 1080p; enable **nearest-neighbor** filtering and Godot 4.7 viewport nearest scaling. Texture import: Filter **off**, Mipmaps off.
- Common enemy ≈ 24–48 px; bosses 96–200 px.

**Naming & organization (mirror `assets/` in doc 07):**
```
assets/
  art/
    player/        bumper_car/  carny/ ...
    enemies/       living_balloon/ wind_up_monkey/ ...
    bosses/        carnival_tent/ ferris_wheel/ ...
    weapons/       throwing_cards/ fireworks/ ...
    vfx/           pop/ confetti/ firework_burst/ ...
    env/           carnival/ boardwalk/ beach/ props/
    ui/            cards/ hud/ fonts/
  audio/
    music/ sfx/ ambient/
```
- Sprite sheets: `<entity>_<action>_sheet.png` (e.g., `living_balloon_die_sheet.png`).
- One `.tres` `SpriteFrames` per animated entity, animations named per §5.
- **Pivot convention:** sprite origin at the entity's "feet"/ground-contact point for consistent depth-sorting (`y_sort_enabled` on the world container).

**Depth sorting:** enable Y-sort on the gameplay layer so enemies/props/player overlap correctly in the top-down 3/4 view. Keep all gameplay actors' pivots at their ground point.

---

## 11. Per-entity art delivery checklist

For each new enemy, an artist delivers:
- [ ] Silhouette-test pass (reads as black shape at zoom, in a crowd).
- [ ] Animations: `idle`, `move`, `hit`, `die` (+ `attack`/`attack_windup` if it attacks).
- [ ] Themed death-burst VFX.
- [ ] One unambiguous danger color on any harmful part/projectile.
- [ ] Colorblind-safe variant verified.
- [ ] Atlas + `SpriteFrames.tres` + import settings matching project defaults.

For each boss, additionally: `intro`, per-attack anims, phase-transition anims, `defeat`, a unique music cue, and an arena dressing pass.

> Cross-references: enemy visuals → `04_enemy_bible.md` · boss spectacle → `05_boss_bible.md` · zones/props → `03_map_and_level_design.md` · how art hooks into code (AnimationComponent, flash shader, VFX pool) → `08_core_systems_implementation.md`.
