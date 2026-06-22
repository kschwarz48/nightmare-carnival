# 04 · Enemy Bible

Every enemy is a **personified carnival attraction**. This doc gives each one its fiction, role, silhouette, stats, AI behavior, and spawn window. All enemies are built from the same component stack (`HealthComponent`, `HurtboxComponent`, `HitboxComponent`, a behavior script) and defined by an **`EnemyData` resource** — adding an enemy = new data + (maybe) a new behavior script. See `08_core_systems_implementation.md`.

---

## How to read this

- **Base stats** are at *spawn baseline* (≈0:00, Midway tier). The spawn director multiplies HP/damage/speed/tickets by the time-and-difficulty curve in `03_map_and_level_design.md §7.3`. So a Living Balloon at 20:00 is far beefier than its base row.
- **Behavior script** names the reusable AI module the enemy uses (defined in doc 08). Multiple enemies share a behavior with different data.
- **Role** is its job in the encounter ecology (swarm / bruiser / ranged / charger / tank / hazard).

### Master stat table (base values)

| Enemy | Role | HP | Speed px/s | Contact Dmg | Tickets | Behavior script | First seen |
|-------|------|----|-----------:|------------:|--------:|-----------------|-----------|
| Living Balloon | Swarm | 4 | 70 | 6 | 1 | `ChaserBehavior` | 0:00 |
| Wind-Up Monkey | Burst charger | 12 | 120 (charge 320) | 8 | 2 | `BurstChargerBehavior` | 0:00 |
| Possessed Stuffie | Slow bruiser | 28 | 45 | 10 | 3 | `ChaserBehavior` | 6:00 |
| Cotton-Candy Slime | Slow/snare | 30 | 35 | 8 (+slow) | 3 | `ChaserBehavior` | 6:00 |
| Whack-a-Mole | Pop-up ambush | 8 | — (burrows) | 10 | 2 | `PopUpBehavior` | 6:00 |
| Evil Clown | Fast bruiser | 18 | 95 | 12 | 4 | `ErraticChaserBehavior` | 6:00 |
| Jack-in-the-Box | Trap/mine | 1 | 0 (then leaps) | 25 (burst) | 4 | `AmbusherBehavior` | 9:00 |
| Dunk-Tank Clown | Ranged | 22 | 40 | 8 / proj 10 | 5 | `ShooterBehavior` | 9:00 |
| Puppet Soldier | Ranged/formation | 32 | 50 | 10 / musket 8 | 5 | `ShooterBehavior` + `FormationBehavior` | 12:00 |
| Carousel Horse | Line charger | 45 | 55 (charge 230) | 18 | 6 | `LineChargerBehavior` | 12:00 |
| Walking Ticket Booth | Tank/spawner | 240 | 22 | 16 | 25 | `SpawnerBehavior` | 12:00 |
| Roller-Coaster Snake | Strafing serpent | 90 | rail-fast | 20 | 12 | `RailStraferBehavior` | 18:00 |
| Bumper Car | Roaming charger | 35 | 60 (ram 200) | 16 | 5 | `LineChargerBehavior` | 12:00 (Boardwalk) |

> Elites: any enemy can spawn as an **Elite** (×4–8 HP, ×1.5 dmg, slower, elite-outline shader, guaranteed Gold + chest chance). See §11.

---

## ACT I enemies

### 🎈 Living Balloon
- **Fiction:** A helium balloon that learned to bite. A puffy rubber body, a knotted-tie "mouth" that gnashes, two pie-eyes, stubby string-legs. Bobs as it floats toward you.
- **Role:** The bread-and-butter swarm. Trivial alone, lethal in a wall. Teaches movement and AoE value.
- **Silhouette:** round bulb on a thin string — instantly readable even at 100-count.
- **Behavior (`ChaserBehavior`):** floats directly at the player at constant speed; gentle sine-wave bob on the perpendicular axis so a crowd shimmers rather than forming a rigid blob; cheap separation so they don't fully overlap.
- **Attack:** contact only.
- **Death:** satisfying **POP** — confetti/latex shreds, a little squeak. The signature "popcorn" feel of clearing a wave.
- **Variants:** *Lead Balloon* (elite, heavy, slow, high HP), *Cluster Balloon* (on death splits into 2–3 tiny weak balloons — adds chaos late).

### 🐒 Wind-Up Monkey
- **Fiction:** A tin cymbal-monkey, key in its back, eyes that snap wide when it "winds up." Clashes cymbals as it charges.
- **Role:** First *timing* enemy. Keeps pace and bursts forward — teaches reading wind-ups. Unlike the swarm, it stays a constant individual threat.
- **Silhouette:** squat body, two raised cymbal-discs, winding key — distinct from the round balloon.
- **Behavior (`BurstChargerBehavior`):** pursues at **120** (just *above* the player's base move speed, so you can't simply outrun it — you must kill it or juke its dash). On a cooldown it performs a *quick* telegraphed **wind-up** (~0.4s: key spins, `attack_windup` anim, eyes flash) then **dashes** at the player's locked-in position at **320** for ~0.45s, then a short recovery. Readable but genuinely threatening if ignored. (Tuning lives in `EnemyData.params`: `windup_time`, `charge_speed`, `charge_time`, `recover_time`, `charge_range`.)
- **Attack:** contact during the dash (cymbal clash) does +damage.
- **Death:** springs and gears burst out; key spins away.
- **Variants:** *Drummer Monkey* (elite, longer dash, leaves a small shock AoE on stop).

---

## ACT II enemies

### 🧸 Possessed Stuffie
- **Fiction:** A prize plushie gone wrong — bear/bunny/clown-doll with button eyes (one hanging by a thread), stitched grin, leaking stuffing.
- **Role:** Slow bruiser; a moving wall of HP that pressures space. The "tank of the trash mob."
- **Silhouette:** chunky, lumpy, ears/limbs — reads as bulky vs. the balloon's roundness.
- **Behavior (`ChaserBehavior`, slow):** plods straight at the player; high HP, strong separation (they bunch into a shambling wall). Use them to *deny space* and force the player to keep moving.
- **Attack:** contact (a clumsy swipe/headbutt).
- **Death:** bursts in a puff of stuffing + buttons; floppy ragdoll flop.
- **Variants:** *Stitch-King Stuffie* (elite, on death spawns 2 small stuffies), *Ragdoll* (drops a lingering stuffing slick that slows the player — only on elite).

### 🍭 Cotton-Candy Slime
- **Fiction:** A glob of sentient spun sugar that oozes off its paper cone, pink and sticky.
- **Role:** Control/snare. Low threat damage, but slows you — dangerous when it lets the swarm catch up.
- **Behavior (`ChaserBehavior`, very slow):** creeps in; on contact applies a brief **slow** debuff (sticky) in addition to chip damage; may leave a short-lived sticky patch.
- **Death:** dissolves into sugar crystals.
- **Variants:** *Floss Tangle* (elite, larger slow radius).

### 🔨 Whack-a-Mole
- **Fiction:** A mole (or gopher-clown) that lives under the midway, popping up from its hole grinning.
- **Role:** Pop-up ambush; punishes standing still / camping a chokepoint.
- **Behavior (`PopUpBehavior`):** burrows invisibly toward a point near the player (a telegraph mound travels under the ground), then **pops up** with a brief invulnerable emerge, swipes, and after a window re-burrows to reposition. Only vulnerable while surfaced.
- **Death:** comedic *bonk* — stars, flattened, sinks.
- **Variants:** *Mole Brigade* (event: a row pops up in sequence).

### 🤡 Evil Clown
- **Fiction:** Classic nightmare clown — too-wide grin, rolling eyes, honking nose, jerky run.
- **Role:** Fast bruiser; the first enemy that can *outpace* a slow build. Erratic, unsettling.
- **Silhouette:** lanky, big shoes, frizz hair, swinging arms — clearly "fast threat."
- **Behavior (`ErraticChaserBehavior`):** chases fast (95) but with a randomized "jitter" to its heading (lurches/zig-zags) so it's hard to perfectly kite; occasional little **honk-hop** that briefly speeds it up.
- **Attack:** contact (cartwheel/headbutt). Some carry a **pie** (see Dunk-Tank for the ranged version).
- **Death:** deflates with a sad slide-whistle, nose honks one last time.
- **Variants:** *Clown-Car Clown* (event elite pack), *Stilt Clown* (elite, taller, faster, longer reach).

### 📦 Jack-in-the-Box
- **Fiction:** A music-box that sits innocently, plays a tinkling tune… then SPRINGS.
- **Role:** Map-control trap/mine. Punishes blind movement and reinforces "watch the floor."
- **Behavior (`AmbusherBehavior`):** spawns *placed* near the player's pathing (or carried out by the director near chokepoints), plays a winding telegraph (audio + lid jitter) for ~1.5s, then **leaps** at the player and bursts. If the player kills the box before it pops, no boom.
- **Attack:** burst AoE on pop (25, telegraphed ring).
- **Death:** either defused (killed early, fizzles) or pops (deals AoE, then gone).

### 🎯 Dunk-Tank Clown
- **Fiction:** A clown perched on a dunk-tank seat that rolls itself around, hurling baseballs/pies.
- **Role:** First true **ranged** pressure — punishes camping and chokepoint-hugging.
- **Behavior (`ShooterBehavior`):** keeps **preferred distance** (kites *away* if you close), and on a cooldown lobs a telegraphed projectile (arcing pie/fastball) at your predicted position. Squishy if you reach it.
- **Attack:** projectile (10), telegraphed by a wind-up throw.
- **Death:** tank tips, clown takes a comedic dunk splash.

---

## ACT III enemies

### 🎖️ Puppet Soldier
- **Fiction:** A wooden marionette soldier in a tin-toy uniform, jerking on unseen strings, shouldering a little musket.
- **Role:** Ranged + **formation** enemy — they march in ranks and volley, creating no-go zones.
- **Behavior (`ShooterBehavior` + `FormationBehavior`):** spawns in **columns/lines** that advance in step; maintains mid-range and fires musket volleys (telegraphed by raising muskets in unison). The formation behavior keeps spacing so they read as a marching block. Breaking the formation (killing the front rank) staggers the advance.
- **Attack:** musket shot (8), volley-telegraphed; weak contact bayonet.
- **Death:** clatters into loose wooden parts; strings snap.
- **Variants:** *Drummer* (buffs nearby soldiers' fire rate — priority kill), *Officer* (elite, summons a fresh rank).

### 🎠 Carousel Horse
- **Fiction:** A painted carousel horse torn free of its pole, frozen mid-gallop, brass pole still through its back, eyes wild.
- **Role:** Line charger — fast, committed charges that demand sidestep dodging.
- **Silhouette:** unmistakable galloping-horse profile with the pole.
- **Behavior (`LineChargerBehavior`):** trots in (55), then **locks onto the player, telegraphs** (rears up, hoof-stomp dust, `attack_windup`), and **charges in a straight line** at 230 past the player, overshooting; then wheels around for another pass. Dodge perpendicular. Can trample lesser enemies in its lane.
- **Attack:** high contact damage (18) during charge.
- **Death:** shatters like painted ceramic; pole clangs down.
- **Variants:** *Nightmare Stallion* (elite, charges leave a brief fire/spark trail), used in the **Stampede** event as a charging wall.

### 🎟️ Walking Ticket Booth
- **Fiction:** A red-striped ticket booth that grew stubby legs; its ticket-slot is a mouth, its window a single eye; it dispenses *enemies* like tickets.
- **Role:** Tanky **spawner** / mini-elite. A slow priority target that floods the area if ignored.
- **Silhouette:** big boxy booth on little legs — towers over trash mobs.
- **Behavior (`SpawnerBehavior`):** lumbers slowly toward the player; periodically **prints** a burst of weak enemies (Balloons/Stuffies) from its slot (telegraphed cha-chunk + paper spew); occasionally **fires a stream of razor tickets** in an arc.
- **Attack:** contact (16) + ticket-spray projectiles; the real threat is the adds.
- **Death:** big structural collapse — boards, a cash drawer of Tickets bursts out (bonus XP), confetti.
- **Notes:** always carries elevated Tickets (25 base) and a high Gold/chest chance — a rewarding, decision-forcing target.

### 🎢 Bumper Car
- **Fiction:** A grinning bumper car driving itself, rubber bumper bared like teeth, pole-spark crackling.
- **Role:** Roaming charger / Boardwalk hazard-enemy.
- **Behavior (`LineChargerBehavior`):** patrols the Boardwalk lane; locks on and **rams** in a straight line (200), bouncing off obstacles and ricocheting. Also appears as a pure lane-hazard during the "runaway bumper car" Boardwalk hazard.
- **Death:** crumples, pole sparks die, horn deflates.

---

## ACT IV enemy

### 🐍 Roller-Coaster Snake
- **Fiction:** A length of roller-coaster track that's become a serpent — segmented cars for a body, a front-car head with headlight eyes and a track-rail grin. It rides invisible rails *across the whole screen*.
- **Role:** The Act IV signature threat — a fast, **screen-crossing strafer** you must watch the edges for.
- **Silhouette:** long segmented train/snake — totally unlike anything else; reads from the screen edge.
- **Behavior (`RailStraferBehavior`):** does **not** chase normally. It enters from one screen edge, **telegraphs its rail** (a glowing track line flashes across the screen for ~1s), then **rockets along that line** at high speed from edge to edge, its body following the head segment-by-segment. The whole line is a damage zone while it passes. Repeats from new angles. Forces the player to read incoming rails and not stand in lanes.
- **Attack:** high contact (20) along its body during the pass; the track-flash is the telegraph (safe), the train is the hit.
- **Bodyplan:** a head + N trailing segments. Damage can be modeled head-only (kill head = whole thing dies) **or** segmented (each segment has HP; recommended head-only for perf and clarity at MVP).
- **Death:** derails spectacularly — cars fly off, sparks, a long screech.
- **Variants:** *Loop-the-Loop* (elite, curves its rail instead of straight — harder to predict).

---

## 11. Elites & modifiers

Any base enemy can spawn as an **Elite** via a modifier applied at spawn (data flag), not a separate scene:
- **Stat bump:** ×4–8 HP, ×1.5 contact damage, ×0.85 speed (slower, beefier).
- **Visual:** elite-outline shader (pulsing colored rim), slightly larger scale, a crown/glow.
- **Reward:** guaranteed Gold, elevated Tickets, ~25% chest chance.
- **Optional affixes** (data-driven, stack 1–2 on Nightmare tier): *Explosive* (death AoE), *Splitter* (spawns minions on death), *Hasted* (no speed penalty), *Shielded* (absorbs first N hits), *Magnetic* (pulls in trash mobs).

Elite cadence: ~1 per 90s in Act I, ramping to several at once by Act IV; events spawn elite packs.

---

## 12. Encounter ecology — how they combine

The roster is designed so each Act introduces a *new pressure axis*, and later Acts layer them:
- **Act I:** raw movement (swarm + one timing charger).
- **Act II:** + space-denial (slow bruisers/snares) and **ranged** (Dunk-Tank) and **floor traps** (Jack/Mole) → you can no longer stand still or hug walls.
- **Act III:** + **formations & ranged volleys** (Puppets) and **committed chargers** (Carousel/Bumper) and a **tanky spawner** (Booth) → you must prioritize targets and read multiple telegraphs at once.
- **Act IV:** + **screen-crossing strafers** (Snakes) and stacked elites → full sensory load; only a strong build + clean movement survives.

This escalation is the difficulty curve as much as the stat multipliers are. When tuning, ask "what *new thing* is this Act asking the player to do?"

---

## 13. Example `EnemyData` (data-driven authoring)

How a designer/Cursor encodes the Living Balloon. (Resource class defined in doc 08.)

```gdscript
# res://resources/enemies/living_balloon.tres  (conceptual)
[resource]
script = ExtResource("EnemyData.gd")
id = "living_balloon"
display_name = "Living Balloon"
max_health = 4.0
move_speed = 70.0
contact_damage = 6.0
ticket_value = 1
behavior = "chaser"          # maps to ChaserBehavior
sprite_frames = ExtResource("living_balloon_frames.tres")
death_vfx = ExtResource("vfx_balloon_pop.tscn")
hit_sfx = "balloon_squeak"
death_sfx = "balloon_pop"
separation_radius = 14.0
can_be_elite = true
```

> Cross-references: behavior scripts (`ChaserBehavior`, `BurstChargerBehavior`, `ShooterBehavior`, `LineChargerBehavior`, `RailStraferBehavior`, `SpawnerBehavior`, `AmbusherBehavior`, `PopUpBehavior`) and `EnemyData` → `08_core_systems_implementation.md` · spawn weights/timing → `03_map_and_level_design.md §7` · bosses → `05_boss_bible.md` · enemy art rules → `02_art_direction.md §4`.
