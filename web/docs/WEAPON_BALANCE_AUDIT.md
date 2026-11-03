# Weapon balance audit (D-103)

Every weapon and evolution measured the same way before and after D-103. The method, the results, the outliers and
why they were outliers, and what changed.

**Tools.**

- `scripts/bench/arsenal.ts`: the measurements.
- `arsenal-table.mjs`: the index.
- `arsenal-report.mjs`: the per-weapon rows.
- `arsenal-pairs.mjs`: mixed builds.

**Raw data.** `artifacts/balance/base_*.json` (before) and `fin_*.json` (after), two seeds each. The runs are
deterministic per seed. "Before" is the code before D-103 (commit 2377348), run in a worktree with the same bench.

## 1. Method

One weapon at a time, held by the Carny (no damage quirk), in god mode, with no level-ups or chests, so the loadout
stays as set. The pilot aims at the nearest target, as a mouse or right-stick player does.

### Investment points

| Point | Loadout |
|---|---|
| L1 | the base weapon at Lv 1, no charms |
| L4 | the base weapon at Lv 4, no charms |
| L8 | the base weapon at Lv 8 (its maximum), no charms |
| E1 | the evolution at Evo Lv 1 with its own charm at Lv 1 (the moment it evolves) |
| E8 | Evo Lv 8 with a late kit: Strongman Belt, Energy Drink, Foam Finger, Extra Token and Spinning Top at Lv 5, plus its own charm at Lv 5 |

### Fights (25 s measured after 5 s of warm-up, unless noted)

| Fight | Setup | What it measures |
|---|---|---|
| boss | an 80 px body with endless health, immune to burn, chill, slow and shoves; the player strafes it at 150 or 260 px, whichever suits the weapon | sustained single-target DPS against bosses |
| elite | one Carnival Brute with endless health, chasing the player | a single durable target that statuses do affect |
| group | 12 Puppet Soldiers (300 HP) kept alive 150–350 px out | a small durable group |
| swarm | 120 Possessed Stuffies at 4× health kept alive 200–500 px out | crowd throughput |
| runners | 40 Evil Clowns at 3× health (fast chasers) kept alive 300–550 px out | hitting what moves |
| mixed | 50 Stuffies, 20 Evil Clowns and 6 Puppet Soldiers | weak, fast and durable together |
| night | the Carnival Core's real crowd from 15:00 to 17:30 (its director, waves, map and walls), a pilot who holds ground until the crowd is about 150 px away | realistic kills/min and hits taken/min |

### Metrics

- **Useful damage per second.** Damage that took health. Overkill isn't counted.
- **Overkill.** The share of a weapon's damage past what its targets had left.
- **Uptime.** The share of quarter seconds in which it did useful damage.
- **Night kills/min.** Capped by how fast the director feeds the crowd in, so it ranks reach and safety more than raw
  power.
- **Night hits/min.** Hits the pilot would have taken.
- **Mixed builds (§4).** Each weapon's share of a pair's useful damage, and counterfactuals: A alone, B alone, A+B.

### The index

For each investment point: the geometric mean over the six controlled fights of the weapon's useful DPS over the
median weapon's. 1.00 is the median; 1.25 is a quarter above it.

- **It favours crowd weapons.** Four of its six fights are crowds. Single-target specialists (Throwing Cards, Tarot,
  Darts) read low in it but strong on bosses and on the night. They are judged on those.
- **It isn't all of balance.** No theoretical DPS is reported as achieved DPS: every number here is measured useful
  damage in a defined fight.

### Bench fixes found during the audit (they matter for reading old numbers)

- **Aim.** D-74's bench pilot didn't aim. In auto aim, "where you face" weapons point where you walk: the Lantern and
  Fire Breath read near zero.
- **Drafts.** Its controlled fights let kills give XP. The draft's first card was then auto-picked, adding other
  weapons mid-fight. Numbers drifted with any change to weapon data.

Both are fixed in `arsenal.ts`. The baseline below was rerun with the fixes.

## 2. The index, before → after

The value in brackets is before D-103.

| weapon | L1 | L4 | L8 | E1 | E8 |
|---|---|---|---|---|---|
| throwing_cards | 0.25 (0.28) | 0.42 (0.43) | 0.58 (0.58) | 1.00 (1.10) | 1.02 (1.14) |
| mallet | 1.24 (1.07) | 1.51 (1.18) | 1.28 (1.52) | 1.23 (1.34) | 1.36 (1.39) |
| tarot | 0.20 (0.23) | 0.30 (0.31) | 0.64 (0.64) | 0.69 (0.83) | 1.52 (1.84) |
| bumper | 0.79 (0.74) | 0.69 (0.64) | 0.70 (0.67) | 0.95 (0.96) | 0.83 (0.84) |
| plush | 0.25 (0.24) | 0.66 (0.61) | 0.71 (0.68) | 1.05 (1.06) | 0.80 (0.87) |
| tophat | 0.55 (0.63) | 0.86 (0.89) | 1.04 (1.05) | 1.42 (1.42) | 0.80 (0.83) |
| popcorn | 1.30 (1.49) | 1.39 (1.44) | 1.04 (1.05) | 0.83 (0.90) | 1.20 (1.34) |
| darts | 0.53 (0.51) | 0.74 (0.68) | 0.64 (0.58) | 0.85 (1.03) | 1.18 (1.42) |
| fireworks | 0.62 (0.80) | 1.08 (1.29) | 1.42 (1.61) | 1.09 (1.19) | 1.11 (1.24) |
| cotton | 1.05 (1.21) | 1.14 (1.18) | 0.85 (0.86) | 1.70 (1.86) | 1.14 (1.28) |
| rings | 1.02 (1.39) | 0.77 (1.00) | 1.35 (2.08) | 1.04 (1.14) | 0.95 (1.07) |
| cannon | 1.70 (2.15) | 1.17 (1.42) | 1.17 (1.28) | 1.06 (1.16) | 1.27 (1.43) |
| snowcone | 1.37 (0.87) | 1.03 (0.73) | 1.11 (0.82) | 1.00 (1.11) | 1.29 (0.93) |
| grill | 0.92 (2.97) | 0.78 (2.35) | 0.86 (1.57) | 1.41 (1.37) | 1.03 (1.11) |
| laser | 0.27 (0.25) | 0.47 (0.42) | 0.68 (0.56) | 1.03 (1.02) | 0.80 (0.85) |
| lantern | 1.83 (2.10) | 1.52 (1.57) | 1.36 (1.38) | 0.97 (0.56) | 0.87 (0.47) |
| chains | 1.14 (0.40) | 1.03 (0.32) | 0.84 (0.20) | 0.71 (0.16) | 0.86 (0.22) |
| breath | 1.64 (1.67) | 1.44 (1.27) | 0.88 (0.76) | 1.07 (0.60) | 0.66 (0.34) |
| orbs | 0.19 (0.15) | 0.53 (0.41) | 0.91 (0.61) | 1.08 (1.05) | 0.77 (0.81) |
| bell | 1.52 (1.04) | 0.99 (0.95) | 0.83 (1.32) | 0.79 (1.07) | 0.81 (1.63) |
| steam_whistle | 2.41 (2.50) | 1.93 (1.71) | 1.15 (0.96) | 0.91 (0.65) | 0.62 (0.43) |
| steam_calliope | 0.50 (0.21) | 0.47 (0.21) | 0.60 (0.24) | 0.74 (0.90) | 1.13 (1.44) |

**Before, at the extremes:**

- Spirit Chains at 0.16–0.40 everywhere.
- The Steam Calliope at 0.21–0.24 until evolved.
- The Hot-Dog Grill at 2.97 at Lv 1.
- Ring Toss at 2.08 at Lv 8.
- The Death Card at 1.84 and the High Striker at 1.63 at Evo Lv 8.
- The Lantern's and Fire Breath's evolutions at 0.34–0.60.
- The Whistle's evolution at 0.43: no boss damage.

**After, at Lv 8:** everything sits in 0.58–1.42 (15 of 22 within 0.75–1.45). The weapons below 0.75 are intentional exceptions (below).

**After, at Evo Lv 1:** 0.69–1.70 (18 of 22 within 0.75–1.45). The top is Sticky Situation, kept as it was (below).

**After, at Evo Lv 8:** 0.62–1.52 (19 of 22 within 0.75–1.45).

### Intentional exceptions

- **Throwing Cards, Tarot, Darts (L8 0.58–0.64).** Single-target specialists. Their boss DPS and night kills are top
  tier: the Death Card does about 4.1k boss DPS at Evo Lv 8, the most of any weapon. They are the reference "feels
  great" weapons and weren't nerfed below their identity. The Death Card lost about 16% of its boss DPS: it was a clear
  outlier from overtuned numbers (80 base damage, +0.8 crit damage, 45% crit).
- **The Night Express Whistle at Evo Lv 8 (0.62).** A space-control weapon: its rings shove the crowd away, which caps
  its own useful damage. Beside a damage weapon it adds safety: night hits/min fell from 15 to 7 alone at Evo Lv 8.
  D-103 gave it boss damage (72 → 266 DPS) rather than raw crowd damage.
- **Fire Breath at Evo Lv 8 (0.66).** A close-range cone that burns. Hellmouth's damage was raised (6 → 18), doubling
  its crowd and boss output. It stays a short-range specialist. Watch it in playtests.
- **The Steam Calliope at L1–L8 (0.45–0.60).** Weak early, strong evolved (1.13). Up from about 0.21; more could follow
  from playtests.
- **The Undertow at L8 (0.70).** A mobility tool: it launches you through the crowd with brief invulnerability.
- **Sticky Situation at Evo Lv 1 (1.70).** Kept as it was. Trimming its damage collapsed its real-night kills (357 → 60
  per minute): webs that bind without killing hold the crowd at the population cap, so nothing new arrives. Its Evo Lv 8
  sits at 1.14.

## 3. Every weapon, before → after

Useful DPS in the named fights, night kills/min and hits/min. Uptime is in the swarm fight at L8.

| weapon | L1 swarm | L8 boss | L8 swarm | L8 night kills/min | L8 uptime | E8 boss | E8 swarm | E8 night kills/min | E8 hits/min |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| throwing_cards | 19→19 | 152→152 | 287→287 | 78→78 | 34→34% | 1.7k→1.7k | 13k→13k | 506→506 | 3→3 |
| mallet | 262→492 | 93→39 | 2.9k→2.8k | 69→72 | 53→49% | 600→598 | 24k→23k | 200→258 | 10→8 |
| tarot | 12→12 | 133→133 | 252→252 | 73→73 | 26→26% | 4.9k→4.1k | 9.7k→9.6k | 563→556 | 2→3 |
| bumper | 151→185 | 74→81 | 1.0k→1.1k | 17→21 | 21→21% | 648→747 | 13k→14k | 91→76 | 8→10 |
| plush | 12→15 | 247→264 | 228→241 | 65→72 | 89→89% | 2.0k→2.1k | 6.7k→6.3k | 217→305 | 12→21 |
| tophat | 31→31 | 346→346 | 324→324 | 85→85 | 95→95% | 1.3k→1.5k | 7.1k→7.3k | 265→296 | 14→18 |
| popcorn | 531→531 | 82→82 | 2.1k→2.1k | 80→80 | 20→20% | 1.4k→1.4k | 16k→16k | 242→242 | 6→6 |
| darts | 45→53 | 85→95 | 444→469 | 57→65 | 35→37% | 3.5k→3.1k | 10k→9.8k | 653→578 | 1→3 |
| fireworks | 350→311 | 110→90 | 3.1k→2.7k | 55→70 | 34→39% | 1.1k→1.1k | 16k→16k | 258→258 | 4→4 |
| cotton | 453→453 | 50→50 | 1.8k→1.8k | 76→76 | 100→100% | 549→549 | 20k→20k | 357→357 | 9→9 |
| rings | 713→583 | 246→147 | 3.9k→2.9k | 81→77 | 90→88% | 719→719 | 19k→19k | 84→84 | 7→7 |
| cannon | 976→906 | 97→89 | 2.2k→2.2k | 56→61 | 30→30% | 2.2k→2.2k | 13k→13k | 767→767 | 3→3 |
| snowcone | 304→441 | 137→105 | 1.8k→1.7k | 60→73 | 26→100% | 582→2.4k | 25k→27k | 136→336 | 5→7 |
| grill | 850→187 | 143→36 | 2.7k→1.3k | 79→76 | 100→100% | 401→574 | 26k→24k | 107→90 | 14→7 |
| laser | 337→412 | 37→47 | 2.0k→2.4k | 71→62 | 62→62% | 442→488 | 18k→18k | 174→175 | 17→7 |
| lantern | 1.3k→1.3k | 90→90 | 3.8k→3.8k | 62→62 | 100→100% | 205→490 | 13k→22k | 86→147 | 13→9 |
| chains | 30→107 | 24→87 | 110→527 | 64→66 | 18→55% | 103→487 | 1.7k→10k | 92→91 | 19→14 |
| breath | 739→825 | 31→41 | 1.9k→2.1k | 67→68 | 100→100% | 94→254 | 8.5k→17k | 80→68 | 12→13 |
| orbs | 19→45 | 57→69 | 951→2.0k | 42→66 | 67→68% | 756→1.6k | 16k→17k | 72→409 | 9→5 |
| bell | 293→872 | 50→93 | 3.6k→1.5k | 81→71 | 35→25% | 1.3k→1.8k | 23k→13k | 499→362 | 10→10 |
| steam_whistle | 3.6k→3.4k | 19→51 | 5.6k→5.6k | 69→82 | 98→99% | 72→266 | 16k→27k | 102→97 | 15→7 |
| steam_calliope | 14→44 | 51→121 | 154→352 | 62→77 | 34→52% | 2.0k→1.7k | 12k→11k | 440→523 | 4→5 |

Funhouse Mirror (damage it adds beside Throwing Cards / Royal Flush): L8 swarm +57 → +57; E8 swarm +4.1k → +4.1k, boss +553 → +553.

### Per-weapon notes

| Weapon | Strengths | Weaknesses | Issue found | Change |
|---|---|---|---|---|
| Throwing Cards | reach, first contact, crits | one target per card | none (reference) | none |
| Tarot Toss | homing, crits, top boss DPS evolved | low crowd throughput | the Death Card's numbers overtuned (index 1.84) | Death Card 80 → 70 damage, flatter late levels (1.52 now, still the top at Evo Lv 8) |
| Whack-a-Mole Mallet | heavy targeted hits, daze | short reach | its pattern duplicated the cones | **targeted whacks with daze** (`WEAPON_IDENTITY_AND_EVOLUTIONS.md`); 24 → 18 damage, 1.4 s cooldown |
| The Undertow | mobility, invulnerable ramming | low night kills | — | 18 → 22; the Last Lap 58 → 66 |
| Plush Companion | autonomous summons | modest crowd damage | — | 11 → 13; Menagerie 30 → 33 |
| Top Hat | summons, strong single target | weak evolved crowd | — | Grand Menagerie 62 → 72 |
| Popcorn Popper | scattered bursts | low uptime | — | none |
| Balloon Darts | crits, pierce | modest crowd | Sharpshooter slightly high at Evo Lv 8 | 11 → 13 base; Sharpshooter 17 → 15 |
| Fireworks | heavy delayed bursts | slow | L8 high (1.61) | levels +6/+8/+12 → +5/+6/+9; base 18 → 16 |
| Cotton-Candy Gun | slow, damage over time | — | its evolution's real night is cap-sensitive | none (kept) |
| Ring Toss | lanes out and back | — | L8 well above the pack (2.08) | levels +5/+7/+11 → +3/+4/+6; cooldown 1.5 → 1.65 s |
| Carnival Cannon | pierce, shove | hits taken | L1 high (2.15) | 40 → 34 |
| Snow-Cone Machine | area denial, freeze (+25% from everything) | — | its pattern duplicated the cones; Blizzard a generic ring | **lobbed slush; roaming storms** |
| Hot-Dog Grill | trail damage, burning | standing still | its pattern duplicated the cones; L1 2.97 | **a burning trail; Inferno's trail and waves** |
| Laser Light Show | sweeping coverage | — | L8 low (0.56) | 9 → 11, later levels +5 |
| Watchman's Lantern | an aimed sustained beam, superb early | its evolution weak (0.47) | the Last Light underpowered | the Last Light 13 → 29 |
| Spirit Chains | chains through groups | weak everywhere | too few links, a steep falloff, slow | cooldown 1.8 → 0.9 s, 4 + Amount links, 200 px leaps, falloff 0.85 → 0.92, 16 → 22 damage; Reaper's Chain 30 → 70, 1.2 → 0.6 s |
| Fire Breath | burning cone, strong early | its evolution weak (0.34) | Hellmouth underpowered | 4 → 5 base; Hellmouth 6 → 18 |
| Crystal Orbs | barrier, grinds the tough | starved beside long-range weapons | an opportunity problem: the orbs only met what reached you | **a swelling orbit and a grind**; Cosmic's pull to ring + 360 px and a narrower swell; Cosmic 68 → 86 |
| Strongman Bell | lines through crowds, jackpots | — | its ring duplicated the Whistle's; the High Striker overtuned | **fissures; a star of fissures**; tuned |
| Night Express Whistle | space control, crowd shove | no boss damage | its rings passed bosses by | rings scald bosses 2.5×; Last Call 34 → 48; base 16 → 14 with +1 a level |
| Steam Calliope | swirling notes, strong evolved | weak early | base underpowered | 9 → 19 base, 2.2 → 1.8 s, levels +5/+6/+8; Grand Requiem 24 → 21 |
| Funhouse Mirror | multiplies everything | nothing alone | — | none (its clones now replay the Grill's drips) |

## 4. Mixed builds (counterfactuals)

**What each column means:**

- **B's share:** the second weapon's share of the pair's useful damage.
- **Night kills and hits:** the first weapon alone, then the pair, before (left of ⇒) and after (right).
- **Cosmic rows:** after Cosmic's final fix (`pairs-orbs_*.json`).

| A + B | level | B's share, swarm | B's share, night | night kills/min: A alone → A+B | night hits/min: A alone → A+B |
|---|---|---:|---:|---:|---:|
| tarot + **orbs** | L8 | 80% → 89% | 18% → **25%** | 73→90 ⇒ 73→79 | 8→9 ⇒ 8→8 |
| tarot + **orbs** | E8 | 70% → 79% | 13% → **24%** | 563→601 ⇒ 556→636 | 2→1 ⇒ 3→1 |
| throwing_cards + **orbs** | L8 | 79% → 87% | 26% → **27%** | 78→51 ⇒ 78→70 | 7→11 ⇒ 7→10 |
| throwing_cards + **orbs** | E8 | 53% → 61% | 10% → **16%** | 506→559 ⇒ 506→537 | 3→2 ⇒ 3→1 |
| tarot + **mallet** | L8 | 92% → 92% | 24% → **32%** | 73→84 ⇒ 73→79 | 8→9 ⇒ 8→7 |
| tarot + **mallet** | E8 | 85% → 86% | 23% → **31%** | 563→674 ⇒ 556→694 | 2→0 ⇒ 3→1 |
| throwing_cards + **snowcone** | L8 | 85% → 85% | 18% → **53%** | 78→69 ⇒ 78→81 | 7→7 ⇒ 7→7 |
| throwing_cards + **snowcone** | E8 | 69% → 62% | 10% → **8%** | 506→740 ⇒ 506→734 | 3→2 ⇒ 3→2 |
| throwing_cards + **grill** | L8 | 90% → 83% | 34% → **25%** | 78→67 ⇒ 78→76 | 7→6 ⇒ 7→7 |
| throwing_cards + **grill** | E8 | 63% → 61% | 29% → **33%** | 506→612 ⇒ 506→603 | 3→2 ⇒ 3→2 |
| tarot + **bell** | L8 | 93% → 84% | 28% → **27%** | 73→82 ⇒ 73→89 | 8→9 ⇒ 8→12 |
| tarot + **bell** | E8 | 79% → 73% | 47% → **64%** | 563→916 ⇒ 556→1.1k | 2→0 ⇒ 3→0 |
| steam_whistle + **tarot** | L8 | 5% → 5% | 68% → **72%** | 69→86 ⇒ 82→90 | 6→10 ⇒ 5→11 |
| steam_whistle + **tarot** | E8 | 30% → 24% | 85% → **79%** | 102→948 ⇒ 97→962 | 15→0 ⇒ 7→0 |
| throwing_cards + **cotton** | L8 | 87% → 87% | 33% → **33%** | 78→77 ⇒ 78→77 | 7→11 ⇒ 7→11 |
| throwing_cards + **cotton** | E8 | 59% → 55% | 27% → **22%** | 506→625 ⇒ 506→593 | 3→1 ⇒ 3→1 |
| tarot + **lantern** | L8 | 93% → 93% | 27% → **27%** | 73→82 ⇒ 73→82 | 8→13 ⇒ 8→13 |
| tarot + **lantern** | E8 | 70% → 85% | 28% → **35%** | 563→710 ⇒ 556→712 | 2→1 ⇒ 3→1 |
| tarot + **throwing_cards** | L8 | 52% → 52% | 34% → **34%** | 73→89 ⇒ 73→89 | 8→11 ⇒ 8→11 |
| tarot + **throwing_cards** | E8 | 76% → 77% | 51% → **53%** | 563→898 ⇒ 556→893 | 2→0 ⇒ 3→0 |
| mallet + **orbs** | L8 | 24% → 36% | 39% → **27%** | 69→81 ⇒ 72→78 | 7→8 ⇒ 7→8 |
| mallet + **orbs** | E8 | 36% → 44% | 12% → **8%** | 200→375 ⇒ 258→476 | 10→3 ⇒ 8→2 |
| grill + **snowcone** | L8 | 36% → 34% | 36% → **80%** | 79→76 ⇒ 76→78 | 4→4 ⇒ 5→7 |
| grill + **snowcone** | E8 | 41% → 45% | 36% → **19%** | 107→422 ⇒ 90→438 | 14→3 ⇒ 7→3 |
| steam_whistle + **orbs** | L8 | 14% → 20% | 24% → **35%** | 69→82 ⇒ 82→88 | 6→5 ⇒ 5→7 |
| steam_whistle + **orbs** | E8 | 48% → 48% | 22% → **23%** | 102→275 ⇒ 97→587 | 15→12 ⇒ 7→4 |
| lantern + **orbs** | L8 | 20% → 28% | 23% → **31%** | 62→70 ⇒ 62→70 | 4→14 ⇒ 4→7 |
| lantern + **orbs** | E8 | 56% → 50% | 37% → **24%** | 86→322 ⇒ 147→538 | 13→6 ⇒ 9→2 |
| tarot + **steam_calliope** | L8 | 40% → 62% | 17% → **28%** | 73→74 ⇒ 73→86 | 8→12 ⇒ 8→11 |
| tarot + **steam_calliope** | E8 | 71% → 71% | 53% → **52%** | 563→936 ⇒ 556→894 | 2→0 ⇒ 3→0 |
| throwing_cards + **chains** | L8 | 27% → 67% | 32% → **64%** | 78→60 ⇒ 78→77 | 7→10 ⇒ 7→8 |
| throwing_cards + **chains** | E8 | 8% → 29% | 16% → **39%** | 506→504 ⇒ 506→584 | 3→4 ⇒ 3→3 |

**Reading it:**

- **The Crystal Orbs problem.** As a direct damage share, Cosmic beside a long-range carry rose from 10–13% to
  16–24%. Its counterfactual value rose much more: adding it lifts the night's kills and cuts the hits taken, because
  its pull and barrier gather the crowd for the carry.
  - The Whistle with Cosmic: 102 → 275 kills/min before, 97 → 587 now.
  - The Lantern with Cosmic: 86 → 322 before, 147 → 538 now.

  Alone, Cosmic's night kills went from 72 to 409 per minute, with fewer hits taken. It is now a legitimate centrepiece,
  and a force multiplier beside cards.
- **Blizzard beside Royal Flush** deals only 8% of the damage, yet still lifts the pair's kills by 45% (506 → 734): the
  frozen take +25% from the cards, and the slowed reach them later. Alone it went from 0.93 to 1.29 at Evo Lv 8.
- **Real damage share now:**
  - Spirit Chains: 32% → 64% at L8, 16% → 39% evolved.
  - The Mallet: 24% → 32%.
  - The Snow-Cone Machine at L8: 18% → 53%.
- **Tarot and Throwing Cards** stay strong together (a 53% share at Evo Lv 8). They no longer out-damage every other
  pairing: the Bell (64%) and the Calliope (52%) now hold their own beside Tarot.

## 5. Tests and remaining concerns

### Tests

`tests/arsenal.test.ts` checks each new pattern:

- slush that chills and freezes
- storms that roam toward the crowd and blow out when dropped
- a trail laid along the path, with a drip in place
- whacks that reach the nearest, daze, and stay out of reach of the far
- fissures that strike along their line and not beside it; the High Striker's star
- the orbs' swell and grind

The full suite passes.

### Remaining concerns for human playtests

- **Bots.** Bots are not people. The night is one map, one window, one pilot.
- **Damage share.** The Crystal Orbs' and Blizzard's direct share beside a long-range carry is still under a quarter;
  their value shows in kills and safety. Players who read the damage meter as the verdict may still feel they are weak.
- **Calliope and Fire Breath** remain the lowest of their stages.
- **Laser against Lantern.** These two, and their evolutions, are the closest remaining pair of patterns.
