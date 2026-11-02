# Weapon audit (D-74)

The owner's report after a four-player night: only one or two builds were viable (Royal Flush and the
Death Card); the bumper car, both summoners (Plush Companion, Top Hat), the lasers, the crystal orbs, the
grill and the blizzard lagged. The ask: every build viable and damage spikes at evolution roughly
consistent, without making every weapon feel the same; the orbs to become a barrier with knockback that
tires on a tough enemy.

## Method

`npx vite-node scripts/bench/weapons.ts [out.json] [--only=id,id] [--seeds=2]` measures every weapon the
same way: one weapon at a time, held by the Carny (no damage quirk), useful damage only (overkill isn't
counted). Three fights:

- **Horde.** An open floor kept at 120 Possessed Stuffies at 4× their 18:00 health. Each one killed is
  replaced at once 200–500 px out, and the player kites a circle. This measures how much crowd the weapon
  can process.
- **Boss.** A boss's body (80 px, endless health, never burnt, chilled, slowed or shoved) on an empty
  floor. The player circle-strafes it at 150, 220 or 300 px, whichever suits the weapon.
- **Night.** The Carnival Core's real crowd from 15:00 to 17:30, with the real director, waves and walls,
  in god mode. The pilot holds its ground until the crowd is about 150 px away, so close-range weapons
  get their chance. There are no level-ups or chests, so the loadout stays as set. The night reports
  kills per minute and the hits the pilot would have taken per minute.

Three loadouts per weapon:

- the base weapon at Lv 8 with no charms;
- the evolution at Evo Lv 1 with its own charm at Lv 1 (the moment it evolves);
- the evolution at Evo Lv 8 with a full late kit: Strongman Belt, Energy Drink, Foam Finger, Extra Token
  and Spinning Top at Lv 5, plus its own charm at Lv 5.

The Funhouse Mirror only replays your other weapons, so it's measured beside Throwing Cards (Lv 8) and
Royal Flush (Evo Lv 8 with the kit), as the share of damage it adds. (Since D-85 the game books the clones'
replays to the mirror itself, so the damage meter and the results show this share as the mirror's; the
audit's totals don't change, as they count all useful damage.)

"Before" is the previous weapon code measured with this same bench in the same game build (walls and the
first map's musketeer change included); both columns average two seeds. **Score** is the geometric mean
of horde, boss and night kills, each against that column's median: 1 is an average weapon.

Each scenario is a bot, not a person. The night's kill rate rewards range: a weapon that kills at the
spawn ring makes the director spawn more. Close-range weapons only kill what reaches them, however hard
they hit, so their night numbers move less than their damage does.

## What the audit found (besides numbers)

- **Hall of Mirrors made big volleys weaker.** Every clone replayed the whole volley. With Extra Token
  that's six clones, so Royal Flush filled the 900-slot projectile pool, and your own full-strength cards
  failed to fire while the clones' sixth-strength copies took their slots.
  - Measured: 1,258 failed shots in 20 s, and the tank damage fell 30%.
  - Now clone shots yield the pool once it's 55% full, and the clone shots that do fire carry the share of
    the dropped ones (up to 3×). There are at most 4 clones, since they share one power anyway.
- **Sticky Situation's webs stacked without limit.** At Evo Lv 8 with the kit about 67 webs overlapped,
  which made it the strongest horde weapon by 2–3×.
  - Now webs, and burning patches, hit a creature once per tick however many overlap.
  - Webs instead dissolve whatever stays in them: +40% per web tick in a row, up to +400%.
- **The bumper car never met the crowd.** It surges the way you're moving, and while you kite the crowd is
  behind you, so its steady-state damage in the horde was 0.
  - Now every surge peels out with a spin that bumps everything within 105 px (at 1.6× damage).
  - The escort cars and the Derby's phantom cars head for the crowd instead of an arbitrary direction.
- **The crystal orbs were out 40% of the time**, and the crowd hugged you inside the ring where no orb
  passes.
  - Now they're off only for the cooldown.
  - Every orb hit shoves its target straight out from you: about 60 px, weaker each time the same creature
    is shoved again within a second or so (`kbFatigue`). The crowd bounces off the ring, while something
    tough leans through unless you kill it quickly.
- **The lasers cut only what lay under a 9 px beam at a strike every 0.2 s.** Now each strike, every
  0.1 s, cuts everything the beam swept since the last one.
- **Several evolutions were weaker than their own Lv 8 base:** Nightmare Menagerie, Grand Menagerie on
  bosses, Saturn's Rings, Blizzard and Grand Requiem.
  - Now every evolution at Evo Lv 1 is ahead of its base in the horde (1.1× for Saturn's Rings to 19× for Royal Flush), and level with it or
    ahead on bosses: Saturn's Rings is level, within noise.
  - Night kills at that stage stay within the seed-to-seed noise for most weapons (about 40–100 a minute).
- **Weapons whose strength is a status effect were weak on bosses**, because bosses can't burn or be
  chilled. Now the grills hit bosses 1.6× as hard, the Snow-Cone 2× and the Blizzard 3×.

## Evolutions (Evo Lv 8 with the late kit)

| Evolution (Evo Lv 8 + kit) | Horde dps | Boss dps | Night kills/min | Hits taken/min | Score |
|---|---|---|---|---|---|
| royal_flush | 15k → **17k** | 1.9k → **1.8k** | 486 → **513** | 2 → 4 | 2.05 → **1.36** |
| whack_frenzy | 15k → **24k** | 341 → **595** | 81 → **155** | 13 → 13 | 0.64 → **0.71** |
| death_card | 17k → **15k** | 8.3k → **4.8k** | 649 → **604** | 1 → 2 | 3.87 → **1.93** |
| demolition_derby | 11k → **18k** | 182 → **666** | 72 → **74** | 6 → 6 | 0.46 → **0.53** |
| nightmare_menagerie | 2.9k → **11k** | 1.0k → **2.0k** | 63 → **230** | 9 → 9 | 0.48 → **0.94** |
| grand_menagerie | 6.0k → **11k** | 497 → **1.3k** | 67 → **285** | 11 → 14 | 0.50 → **0.89** |
| kettle_korn | 12k → **16k** | 994 → **1.4k** | 79 → **246** | 9 → 8 | 0.84 → **0.97** |
| sharpshooter | 15k → **17k** | 5.8k → **4.7k** | 659 → **625** | 2 → 2 | 3.32 → **2.02** |
| grand_finale | 19k → **20k** | 1.1k → **1.1k** | 356 → **356** | 10 → 10 | 1.66 → **1.09** |
| sticky_situation | 49k → **28k** | 3.5k → **546** | 489 → **339** | 3 → 7 | 3.76 → **0.95** |
| saturn_rings | 8.7k → **21k** | 210 → **714** | 79 → **199** | 7 → 9 | 0.45 → **0.80** |
| cannonball_special | 14k → **14k** | 2.1k → **2.1k** | 696 → **696** | 2 → 2 | 2.36 → **1.50** |
| blizzard | 11k → **21k** | 57 → **571** | 53 → **150** | 5 → 7 | 0.27 → **0.67** |
| inferno_grill | 19k → **29k** | 603 → **519** | 146 → **74** | 13 → 6 | 1.02 → **0.57** |
| grand_illumination | 8.3k → **23k** | 346 → **448** | 99 → **194** | 11 → 6 | 0.56 → **0.70** |
| cosmic_convergence | 9.2k → **18k** | 210 → **833** | 72 → **81** | 11 → 8 | 0.44 → **0.58** |
| high_striker | 26k → **24k** | 1.4k → **1.3k** | 530 → **474** | 4 → 6 | 2.30 → **1.36** |
| grand_requiem | 12k → **20k** | 1.5k → **2.1k** | 356 → **456** | 7 → 4 | 1.58 → **1.48** |
| hall_of_mirrors (share it adds to Royal Flush) | +9% → **+41%** | +38% → **+38%** | | | |

Score spread (best ÷ worst): **14.1× → 3.8×**.

## Base weapons at Lv 8, and the moment they evolve (Evo Lv 1)

| Weapon | Base Lv 8: horde · boss · night kills | Evo Lv 1: horde · boss · night kills |
|---|---|---|
| throwing_cards → royal_flush | 290 · 150 · 65 → **290 · 150 · 65** | 4.5k · 292 · 82 → **5.4k · 275 · 91** |
| mallet → whack_frenzy | 2.2k · 98 · 45 → **2.7k · 98 · 60** | 3.8k · 89 · 76 → **7.6k · 158 · 91** |
| tarot → death_card | 256 · 133 · 77 → **256 · 133 · 77** | 2.3k · 489 · 94 → **1.6k · 279 · 92** |
| bumper → demolition_derby | 0 · 43 · 1 → **1.2k · 79 · 30** | 22 · 65 · 11 → **4.7k · 253 · 46** |
| plush → nightmare_menagerie | 171 · 190 · 66 → **222 · 248 · 55** | 154 · 175 · 25 → **3.0k · 351 · 44** |
| tophat → grand_menagerie | 325 · 263 · 64 → **670 · 347 · 85** | 1.3k · 143 · 23 → **4.3k · 369 · 53** |
| popcorn → kettle_korn | 2.1k · 81 · 84 → **2.1k · 81 · 84** | 3.2k · 108 · 85 → **3.7k · 142 · 97** |
| darts → sharpshooter | 634 · 86 · 62 → **673 · 86 · 62** | 2.8k · 635 · 73 → **2.4k · 492 · 79** |
| fireworks → grand_finale | 3.2k · 108 · 63 → **3.3k · 108 · 63** | 4.3k · 186 · 86 → **4.4k · 186 · 86** |
| cotton → sticky_situation | 1.8k · 50 · 73 → **1.7k · 50 · 73** | 4.5k · 221 · 81 → **7.8k · 256 · 77** |
| rings → saturn_rings | 3.9k · 378 · 78 → **5.0k · 276 · 68** | 2.0k · 73 · 44 → **5.6k · 272 · 74** |
| cannon → cannonball_special | 2.5k · 99 · 56 → **2.5k · 99 · 56** | 3.1k · 229 · 98 → **3.9k · 229 · 98** |
| snowcone → blizzard | 1.4k · 50 · 58 → **3.6k · 140 · 62** | 1.5k · 15 · 53 → **8.0k · 158 · 75** |
| grill → inferno_grill | 2.3k · 62 · 65 → **2.7k · 141 · 83** | 4.5k · 133 · 88 → **8.5k · 162 · 63** |
| laser → grand_illumination | 694 · 46 · 54 → **2.2k · 38 · 70** | 1.7k · 110 · 77 → **7.1k · 134 · 74** |
| orbs → cosmic_convergence | 269 · 21 · 9 → **1.0k · 59 · 55** | 2.3k · 53 · 74 → **5.8k · 246 · 75** |
| bell → high_striker | 3.6k · 53 · 77 → **3.6k · 53 · 77** | 4.9k · 172 · 92 → **5.4k · 157 · 77** |
| mirror (share it adds to Throwing Cards) | +26% · +32% → +27% · +32% | |
| steam_calliope → grand_requiem | 371 · 48 · 65 → **371 · 48 · 65** | 1.5k · 119 · 57 → **3.3k · 188 · 90** |

## The changes

- **Trims.**
  - The Death Card: 110 → 80 damage, its extra crit multiplier 1.5 → 0.8, its burst 40% → 30%.
  - The Sharpshooter's Bouquet: 20 → 17 damage, crit bonus 0.3 → 0.2.
  - High Striker: 34 → 31. Royal Flush: 18 → 17.
- **Summoners.**
  - Plush Companion: 8 → 11 damage, more per level.
  - Nightmare Menagerie: 18 → 30 damage, bites every 0.5 → 0.4 s, and every bite mauls around its prey
    (60%, 48 px).
  - Top Hat: 9 → 12 damage, more per level.
  - Grand Menagerie: 24 → 62 damage. The lion and acrobats cleave around their mark; the elephant stomps
    wider (95 → 110).
- **Orbs.**
  - Crystal Orbs: 10 → 14 damage, more per level, bigger orbs on a wider ring, the barrier, longer
    uptime, a quicker re-hit.
  - Cosmic Convergence: 22 → 68 damage, bigger orbs, re-hit 0.6 → 0.38 s, a stronger barrier.
- **Lasers.**
  - Laser Light Show: 7 → 9 damage, more per level, the sweep.
  - Grand Illumination: 12 → 26, the sweep.
- **Fire and frost.**
  - Hot-Dog Grill: 5 → 7, more per level, the boss boost.
  - Inferno Grill: 14 → 26, burning patches at 75% of the weapon's damage (they no longer stack).
  - Snow-Cone Machine: 6 → 9, more per level, the boss boost.
  - Blizzard: 12 → 30 every 0.8 → 0.6 s, a wider storm (140 → 170), a stronger shatter (40 → 80 in
    90 px), the boss boost.
- **Melee.**
  - Bumper Car: the peel-out bump.
  - Demolition Derby: 22 → 58, a wider ramming aura (60 → 85, at 75%), phantom cars aimed at the crowd.
  - Whack-a-Mole Mallet / Whack Frenzy: a wider swing (62 → 68); Whack Frenzy 26 → 46.
- **The rest.**
  - Ring Toss: 13 → 12 damage, boomerangs re-hit every 0.5 → 0.65 s (it was the strongest base weapon on
    bosses, ahead of its own evolution).
  - Saturn's Rings: 26 → 76, faster (1.1 → 2.2), wider orbits, bigger rings, re-hit 0.35 → 0.3 s.
  - Sticky Situation: 10 → 26, plus the dissolve.
  - Kettle-Korn: 20 → 28, kernels reach further.
  - Grand Requiem: 16 → 24, a chord every 2 s instead of 3, wider.

## Still open

- Nobody has played these numbers yet; the next playtest decides the next round (in small steps).
- Close-range evolutions kill fewer enemies in a real night than ranged ones. Their damage is now
  plenty; the gap is reach, because the director refills what ranged weapons kill at the screen's edge.
- The Death Card and the Sharpshooter's Bouquet remain the boss killers (about twice the next weapon);
  the horde leaders are the Inferno Grill, Sticky Situation, Whack Frenzy and High Striker.

## Renamed since (D-78)

The Bumper Car is now **the Undertow**, the Commodore's coaster car (he took the Ride Operator's place),
and Demolition Derby is **the Last Lap**. Their numbers are the ones above; only the names, models, icon
and sound changed. The Undertow is sold in the Lost & Found after the Leviathan, and evolves with Running
Shoes, which beating the Commodore unlocks. The Funhouse Mirror now evolves with Mira's Hand Mirror.

## D-79: knockback a fifth softer, wearing off, never mid-charge

Every push now lands at 80% and wears off with repeated pushes on the same creature (fatigue^-0.75, fading
over 1.2 s; see DESIGN_DECISIONS D-79). The knockback-heavy weapons, two seeds, before → after (horde dps ·
night kills/min · night hits taken/min; boss dps is unchanged, since bosses never took knockback):

| Weapon | Base Lv 8 | Evo Lv 1 | Evo Lv 8 + kit |
|---|---|---|---|
| Mallet / Whack Frenzy | 2.7k → 3.8k · 76 → 62 · 8 → 6 | 7.9k → 8.0k · 91 → 86 · 8 → 9 | 25k → 26k · 142 → 160 · 16 → 9 |
| Undertow / Last Lap | 1.2k → 1.1k · 25 → 16 · 2 → 3 | 4.9k → 6.3k · 51 → 56 · 4 → 4 | 18k → 16k · 70 → 73 · 11 → 9 |
| Cannon / Cannonball Special | 2.9k → 3.6k · 56 → 56 · 12 → 19 | 4.0k → 4.2k · 89 → 91 · 5 → 7 | 13k → 14k · 746 → 796 · 2 → 2 |
| Crystal Orbs / Cosmic Convergence | 1.0k → 1.0k · 52 → 45 · 5 → 5 | 5.0k → 5.1k · 62 → 86 · 17 → 4 | 18k → 17k · 64 → 82 · 12 → 7 |
| Strongman Bell / High Striker | 3.6k → 3.7k · 72 → 77 · 6 → 7 | 5.6k → 4.3k · 94 → 90 · 17 → 8 | 28k → 27k · 442 → 482 · 6 → 6 |

Weapons that used to shove the crowd out of their own reach hit more of it (the Mallet +41%, the Cannon
+24% in the horde); High Striker at Lv 1 lost 23% there; the rest moved within the bench's noise. Nothing
swung far enough to retune here: the change is the owner's call on feel, and these numbers only rule out
extremes.
