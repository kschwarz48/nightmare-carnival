# 05 · Boss Bible

The four ride-bosses are the spectacle of Nightmare Carnival — **Cuphead-grade set-pieces** where the attraction itself comes alive. Each is multi-phase, heavily telegraphed, and themed to its zone. They interrupt the run at fixed time gates (6:00 / 12:00 / 18:00 / 24:00).

Bosses are built on a shared `BossBehavior` phase state-machine (see `08_core_systems_implementation.md §boss`). Each **phase** owns an **attack pool**; the boss picks attacks (weighted, no immediate repeats), telegraphs, executes, and recovers. Crossing an **HP threshold** transitions phase (play `phase_2`/`phase_3` anim, swap attack pool, often relocate).

---

## Shared boss rules

- **HP & pacing:** base HP below is tuned so a healthy build kills the boss in **~75–110s**. HP scales with difficulty tier and is data-driven (`BossData`). The bar shows phases as segments.
- **Telegraph discipline (non-negotiable):** every attack has a clear wind-up in the danger color before damage lands (doc 02 §5). Boss telegraphs are *long and theatrical* — fairness over surprise. The challenge is volume and overlap, not invisibility.
- **Soft enrage:** if a boss lives past **~100s**, it enters **Encore** — attack cadence +35%, add-spawns +50% — so it can't be stalled forever.
- **Adds:** bosses summon normal enemies; the spawn director **pauses ambient spawns** during set-piece bosses so total population stays readable.
- **Contact damage:** touching the boss body hurts (value per boss); telegraphed attack zones hurt more.
- **Reward on defeat:** death spectacle → **guaranteed Boss Chest** (a weapon/passive/evolution, weighted toward what completes the player's build) → big Ticket burst → small heal → brief calm → next Act begins. First-ever kill unlocks a character/meta entry (doc 01 §6, §9).
- **Pause normal HUD threat:** during roaming bosses (Ferris Wheel, Ringmaster) the whole map is the arena; during set-piece bosses (Tent, Puppet King) a soft arena confines the fight.

---

## 🎪 BOSS 1 — THE CARNIVAL TENT  (gate 6:00)

> The big top inhales, and the flaps peel back into a canvas maw lined with pennant-flag teeth. The whole tent rises on four striped tent-pole legs. *The show is starting.*

- **Zone / arena:** Carnival Core, **set-piece**. Soft canvas walls ring the arena.
- **Base HP:** ~4,000 · **Contact:** 16 · **Soft enrage:** 100s.
- **Fantasy of the fight:** a lumbering structure-boss; you weave between giant stomps while it spits the midway's trash at you, then it starts *breathing*.

### Phase 1 — "Setting Up" (100% → 60%)
| Attack | Telegraph | Pattern | Dmg |
|--------|-----------|---------|-----|
| **Tent-Pole Stomp** | Shadow grows under a leg (danger-color circle) ~1s | A leg slams the marked spot; small shockwave ring expands outward. 1–3 legs in sequence. | 25 / 12 (wave) |
| **Concession Spew** | Maw flaps flutter, *cha-chunk* | Spits an arc of weak adds (Balloons/Stuffies) toward the player. | adds |
| **Pennant Flap** | Canvas pulls taut, edge glows | A flat row of pennant-flag projectiles sweeps across at a fixed height — sidestep the gap. | 14 |

### Phase 2 — "The Big Inhale" (60% → 30%)
Transition: the maw gapes; center tent-pole crashes down as a **sweeping hazard bar** that rotates slowly across the arena (constant dodge pressure for the phase).
| Attack | Telegraph | Pattern | Dmg |
|--------|-----------|---------|-----|
| **Inhale** | Wind lines + sucking SFX, pull arrows | Pulls the player (and adds) steadily toward the maw for ~3s; move *away* / use the pole as a windbreak. Adds get eaten (and refunded as the next attack). | contact-on-maw 30 |
| **Popcorn Exhale** | Maw glows hot-orange | After an Inhale, exhales a wide **spray of bouncing popcorn projectiles** in a cone. | 16 each |
| **Stake Drop** | Sky shadows | Tent stakes rain at marked spots, leaving brief standing hazards. | 20 |
| (continued) **Rotating Pole** | always-on | The fallen center pole sweeps; treat as a moving wall. | 18 |

### Phase 3 — "Brought The House Down" (30% → 0%)
Transition: the tent half-collapses, canvas tearing into flame at the edges; it gets faster and angrier.
| Attack | Telegraph | Pattern | Dmg |
|--------|-----------|---------|-----|
| **Frenzy Stomp** | Faster, shorter shadows | Rapid multi-leg stomps across the arena. | 25 |
| **Ring of Fire** | Torn canvas edges ignite | A closing ring of flame forces the player inward toward the stomp zone. | 18/s in fire |
| **Clown Call** | Maw bellows | Summons 2–3 elite Clowns. | adds |

**Defeat:** the whole tent deflates and collapses into a smoking heap of striped canvas; a Boss Chest tips out of the wreck. **Unlocks:** Ride Operator progress / Carnival-pedia entry.

> **Implemented (M3, programmer art):** the tent stands **dormant at map center from run start** (the reveal: this scenery *is* the boss) and **wakes at the 6:00 gate** (warning → comes alive). Once awake it **slowly roams toward the player** (speed below the player's, stops at ~340 px to cast) — looming pressure, never a lunge — instead of a walled arena. **Full bible moveset:** P1 Tent-Pole Stomp + Concession Spew + **Pennant Flap** · P2 Inhale + Popcorn Exhale + **Stake Drop**, with the **Rotating Pole** sweeping as an always-on P2 hazard (spawned/freed via `Boss._on_phase_entered`) · P3 Frenzy Stomp + Clown Call + **Ring of Fire**. (Frenzy Stomp telegraphs are tuned long enough to clear; no stomp in P2 since you can't dodge one while being pulled.) Defeat drops the guaranteed chest (opens a draft pick) + a ticket burst.

---

## 🎡 BOSS 2 — THE FERRIS WHEEL  (gate 12:00)

> On the skyline, the Ferris Wheel's lights flare blood-red. With a shriek of tearing steel it **wrenches free of its axle** and the whole thing begins to turn toward you.

- **Zone / arena:** **roaming**, whole map (it relocates/rolls). Mostly Carnival↔Boardwalk.
- **Base HP:** ~9,000 · **Contact:** 20 · **Soft enrage:** 100s.
- **Fantasy of the fight:** a colossal rotating wheel; you fight the hub while dodging spiraling gondola-fire, then it tears loose and becomes a giant *rolling hazard* you must outmaneuver.

### Phase 1 — "Spinning Up" (100% → 60%)
Wheel is anchored, slowly rotating; **gondolas** are its weak points/turrets — their little doors open into screaming faces that fire.
| Attack | Telegraph | Pattern | Dmg |
|--------|-----------|---------|-----|
| **Gondola Spiral** | Gondola doors open, eyes glow | Each gondola fires a bullet on rotation → a slow rotating **spiral of projectiles** filling the screen. Walk the spiral's gaps. | 12 |
| **Spoke Sweep** | One spoke flashes | A spoke extends and sweeps an arc like a clock hand. | 18 |
| **Gondola Drop** | Shadow under a gondola | A gondola detaches and crashes, leaving a brief debris hazard + spawns a Balloon cluster. | 22 |

### Phase 2 — "Off The Rails" (60% → 30%)
Transition: it **tears free** and stands on its rim. Now it **ROLLS**.
| Attack | Telegraph | Pattern | Dmg |
|--------|-----------|---------|-----|
| **The Roll** | A lane across the map flashes danger-color ~1.5s; the wheel rears | Wheel **rolls along the lane** end-to-end at high speed (a giant moving wall), rebounds off a boundary, may roll back. Dodge perpendicular / through gaps. | 35 |
| **Shed Sparks** | Rim glows | While rolling, sheds sparks/bolts to the sides. | 12 |
| **Reposition** | — | Between rolls it stands and does a quick Gondola Spiral. | (as P1) |

### Phase 3 — "Catastrophic Failure" (30% → 0%)
Transition: wheel wobbles, half its lights dead, throwing parts.
| Attack | Telegraph | Pattern | Dmg |
|--------|-----------|---------|-----|
| **Gondola Bombs** | Arc shadows on ground | Flings gondolas as **arcing bombs** that leave AoE craters. | 24 |
| **Spoke Boomerangs** | Spokes detach + glow | Detached spokes spin across the screen and return (boomerang lines). | 18 |
| **Stampede Call** | Whinny SFX | Summons a line of Carousel Horses to charge a lane. | adds |
| **Desperate Roll** | faster lane flash | A final, faster Roll. | 35 |

**Defeat:** the wheel topples, lights popping one by one, and crashes into a tangle of neon; chest spills from a gondola. **Unlocks:** The Ride Operator.

---

## 🎭 BOSS 3 — THE PUPPET KING  (gate 18:00)

> Strings descend from the dark above. A king-sized marionette is lowered into the ring — crown askew, painted sneer, joints clacking — dancing on the strings of a hand you never see.

- **Zone / arena:** Carnival Core / Big Top interior, **set-piece**. The "stage."
- **Base HP:** ~16,000 · **Contact:** 22 · **Soft enrage:** 100s.
- **Fantasy of the fight:** fight the puppet while it's still on its strings (control the dance), then **cut the strings** to stagger it, then face it *enraged and free* in a final flailing rampage.

### Phase 1 — "The Performance" (100% → 60%)
On strings; controlled, rhythmic, "dance"-like patterns.
| Attack | Telegraph | Pattern | Dmg |
|--------|-----------|---------|-----|
| **Marionette Slam** | A puppet hand rises, shadow below | Hand crashes down at a marked spot; cross-shaped shockwave. | 26 |
| **String Sweep** | A taut string glows along a line | Horizontal/vertical **string-lines** sweep the stage like lasers — duck through the gaps. | 16 |
| **Soldier Levy** | King raises a hand, drum roll | Summons a marching rank of Puppet Soldiers (doc 04). | adds |
| **Crossbar Drop** | Sky shadows | The marionette control-bar drops as a spinning hazard, then lifts. | 20 |

### Phase 2 — "Cut The Strings" (60% → 30%)
Transition: **the strings become targetable.** Four glowing strings hold him aloft.
| Mechanic | Detail |
|----------|--------|
| **Strings (sub-targets)** | Each string has its own small HP. Cutting all available strings **staggers** the King (long vulnerable window, double damage). Strings regrow after a stagger, so it's a repeatable burst phase. |
| **Tangle Lash** | Uncut strings whip in widening spirals (telegraphed glow). | 18 |
| **Puppet Rain** | Drops smaller marionettes (mini Puppet Soldiers) from the flies. | adds |
| **Dance of Slams** | A choreographed sequence of 3–4 Marionette Slams in a readable rhythm. | 26 |

### Phase 3 — "No Strings On Me" (30% → 0%)
Transition: the King **cuts his own strings** with a shriek and drops to the stage — now free, fast, and erratic (a giant clown-like menace).
| Attack | Telegraph | Pattern | Dmg |
|--------|-----------|---------|-----|
| **Free Lunge** | Crouch + flash | Erratic high-speed lunges across the stage (like a giant Evil Clown). | 28 |
| **Crown Toss** | Rears back, crown glows | Hurls his crown as a returning boomerang that arcs the stage. | 22 |
| **Flailing Limbs** | Limbs windmill | Spinning melee around himself — a no-go bubble that travels with him. | 20/s |
| **Last Levy** | Desperate roar | Mass-summons Puppet Soldiers (Encore-tier). | adds |

**Defeat:** he clatters apart into a heap of painted wood and tangled string; the unseen hand's strings recoil into the dark. Chest among the parts. **Unlocks:** The Lost Child.

---

## 🎩 BOSS 4 — THE RINGMASTER  (gate 24:00 · FINAL)

> A spotlight snaps on. He sweeps off his top hat and bows. *"Ladies and gentlemen… for the grand finale… you."* The Ringmaster is the master of the carnival — and at dawn's edge, he stops pretending to be a man.

- **Zone / arena:** the **center ring**, **roaming** the whole Carnival Core; the camera tightens for showmanship.
- **Base HP:** ~28,000 · **Contact:** 24 · **Soft enrage:** 120s.
- **Fantasy of the fight:** a true finale — the Ringmaster conducts the entire carnival against you, then transforms into a demon for a bullet-hell climax. Beating him **ends the night**: dawn breaks on his defeat.

### Phase 1 — "Step Right Up" (100% → 66%) — *the human Ringmaster*
| Attack | Telegraph | Pattern | Dmg |
|--------|-----------|---------|-----|
| **Whip Crack** | A line snaps taut, danger-color | A straight whip-line lash across the arena (fast). Often 2–3 in a fan. | 24 |
| **Top Hat Trick** | Tips hat, smoke puff | Pulls a burst of enemies (any family) from the hat at a marked spot. | adds |
| **Cane Shockwave** | Taps cane, ground rings glow | Expanding concentric **rings** with safe gaps you must weave (bullet-hell-lite). | 16 |
| **Grand Bow** | Bows + spotlight on player | Spotlight tracks the player; staying lit charges a follow-up beam. Break line of sight / keep moving. | 20 (beam) |

### Phase 2 — "The Greatest Show" (66% → 33%)
Transition: a snap of the fingers — the ring splits into **three spotlit rings**; he conducts a *parade*.
| Attack | Telegraph | Pattern | Dmg |
|--------|-----------|---------|-----|
| **Parade of Horrors** | Banner announces each act | He calls signature attacks of the *prior bosses* in sequence: a mini **Roll** (Wheel), a **String Sweep** (Puppet King), a **Stomp** zone (Tent). A greatest-hits gauntlet. | per-attack |
| **Spotlight Sweep** | Beams rotate | Rotating spotlights are damage; the **shadows between them are safe** — dance through the dark. | 18 |
| **Bullet Rings** | Hat spins | Continuous rotating rings of projectiles (true bullet-hell) with readable gaps. | 12 |

### Phase 3 — "The Devil's Own" (33% → 0%) — *the Demon Ringmaster*
Transition: he tears off his human face — taller, horned, coat aflame, whip now a line of fire. Music goes full infernal big-band. **Climax phase.**
| Attack | Telegraph | Pattern | Dmg |
|--------|-----------|---------|-----|
| **Hellfire Whip** | Wider, slower fire-lines | Fire whip-lines leave **burning ground** for a few seconds (zone denial stacks up). | 28 + 10/s burn |
| **Finale Barrage** | Arena rim glows | Screen-filling bullet-hell from all directions with a clear moving safe-pocket — the test of the whole run. | 14 each |
| **Summon the Carnival** | Roar | Waves of mixed enemies + an elite or two; survive the chaos while DPS-ing him. | adds |
| **Encore (enrage)** | past 120s | All cadence way up; he relocates constantly. | — |

**Defeat:** the demon shatters in a column of light; the carnival lights die one by one; the locked gates groan open as the **sun crests the sea**. Cut to the **Dawn / victory** screen. **Unlocks:** The Ringleader + Endless ("Lock-In") + Nightmare-tier progress.

---

## Boss summary table

| Boss | Gate | Zone / type | Base HP | Phases | Signature mechanic |
|------|------|-------------|--------:|--------|--------------------|
| Carnival Tent | 6:00 | Carnival / set-piece | 4,000 | 3 | Inhale-pull + stomps |
| Ferris Wheel | 12:00 | Map / roaming | 9,000 | 3 | Tears free and **rolls** |
| Puppet King | 18:00 | Stage / set-piece | 16,000 | 3 | **Cut the strings** stagger |
| Ringmaster | 24:00 | Ring / roaming (final) | 28,000 | 3 | Parade gauntlet → demon bullet-hell |

---

## Implementation notes

- **One `BossBehavior` base** (extends the enemy/actor stack) with a **phase state machine**: `BossPhase` objects each hold an attack pool (array of `BossAttack` resources/objects), thresholds, intro/transition anims, and add-spawn rules. See `08_core_systems_implementation.md §boss`.
- **Attacks as data/objects:** model each attack as a small object/`Resource` with `telegraph()`, `execute()`, `cooldown`, `weight`. The phase picks the next attack (weighted, avoid immediate repeat), `await`s telegraph, then executes. This keeps adding/tuning attacks data-driven and Cursor-friendly.
- **Sub-targets** (Puppet King strings, Ferris gondolas): separate `HurtboxComponent`+`HealthComponent` children that report to the boss; killing them triggers stagger/phase logic via the EventBus.
- **Roaming vs. set-piece:** set-piece bosses spawn temporary soft-wall `StaticBody2D`s (doc 03 §8); roaming bosses use a `relocate` behavior that moves them around the map between attacks.
- **Telegraphs** are pooled VFX scenes (danger-color shapes) with a fixed lead time exposed as an `@export` per attack — your master fairness lever.
- **Boss bar UI:** segmented by phase; show sub-target pips when relevant.

> Cross-references: phase state-machine & attack pattern code → `08_core_systems_implementation.md` · arena/soft-walls & boss gates → `03_map_and_level_design.md §8` · reward chests/economy → `01_game_design_document.md §8–9` · boss art/animation lists → `02_art_direction.md §5, §11`.
