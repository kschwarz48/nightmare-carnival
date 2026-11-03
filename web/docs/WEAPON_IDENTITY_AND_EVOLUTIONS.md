# Weapon identity and evolutions (D-103)

Every weapon's attack pattern: what it does at Lv 1, what its evolution does, the role it plays, and what D-103
changed. The numbers behind each are in `WEAPON_BALANCE_AUDIT.md`.

## The overlap problem

Before D-103, five of the 23 base weapons attacked the same way. Each was a short sector swung from the player toward
the nearest creature:

- the Whack-a-Mole Mallet (an arc);
- the Snow-Cone Machine (a frost cone);
- the Hot-Dog Grill (a flame cone);
- the Cotton-Candy Gun (a sugar cone);
- Fire Breath (a flame cone).

Their evolutions mostly became circles centred on the player:

| Evolution | Pattern |
|---|---|
| Blizzard | a pulsing ring |
| Whack Frenzy | a spinning circle |
| Inferno Grill | an expanding ring |
| Kettle-Korn | a popping field |

The Strongman Bell's ring slam overlapped the Night Express Whistle's expanding steam ring. The High Striker's random
slams across the screen were circles too.

Choosing one of those weapons felt like choosing the same weapon in a different colour. Investing in its evolution
bought another circle around you.

## What changed

D-103 gave five lines new shapes, built from pieces the game already had. Lobbed projectiles, ground zones, scheduled
strikes and effect events all already replicate to co-op guests, so no protocol change was needed:

- **Mallet:** targeted whacks.
- **Snow-Cone Machine:** lobbed slush.
- **Hot-Dog Grill:** a grease trail.
- **Strongman Bell:** fissures.
- **Crystal Orbs:** keep their orbit, but it now swells and grinds.

| Weapon | Before | Now |
|---|---|---|
| **Whack-a-Mole Mallet** | a sweep in an arc toward the nearest creature (2nd swing behind, 3rd overhead) | **targeted whacks**: the mallet comes down on the nearest creatures *one after another* (1 → 4 whacks), each crushing what is under it (64 px splash) and **dazing** it (it stands still for 0.45 s; a 1.1 s rest after a daze so a stream of whacks never pins a creature; elites half as long; what can't be shoved isn't dazed) |
| **Whack Frenzy** | a continuous spinning circle around you, every 4th spin a bigger pound | a **frenzy of whacks** (2 → 3 per round every 0.45 s, on whatever is near) with every 4th round a **ground-pound** that dazes the crowd about you |
| **Snow-Cone Machine** | a frost cone; 5 chills freeze | **lobbed snow cones** (1 → 3) that land where their targets will be and **splat into slush**: a 64 px puddle that bites (30% of the splash each 0.4 s), chills and slows what wades through it for 2.4 s; five chills freeze, and frozen creatures take +25% from everything |
| **Blizzard Machine** | a 255 px ring pulsing around you | **roaming snowstorms** (2 → 4): each storm is a 100 px zone that hunts a creature near you (nearer ones first, so a long-range weapon beside it doesn't leave it chasing corpses), moves at 175 px/s, never strays more than 520 px from you, rains ice on all it covers (chill ×2 per tick) and blows out a second after the weapon is gone; frozen creatures still shatter into icy shrapnel |
| **Hot-Dog Grill** | a flame cone, 3 ticks, sets alight | **a burning grease trail**: the grill cart drips a patch of burning grease every 1.1 radii you walk (and one where you stand while you stand); each patch burns and sets alight what crosses it for 3 s. It rewards kiting: what follows you walks through fire |
| **Inferno Grill** | expanding flame rings around you and random burning patches | a **wider, hotter trail** (52 px patches) plus a **rolling wave of flame** every 1.2 s (four bands out to 230 px) |
| **Strongman Bell** | a slam → a 140 px shockwave ring around you (a second ring later) | **fissures**: the slam splits the ground and a fissure races out toward the nearest creature (330 px long, 30 px each side), opening in four bursts and bursting up under all it crosses. More fissures spread about you (1 → 3) |
| **High Striker** | giant slams on random creatures up to 700 px away; some a jackpot crit | **a star of fissures** (6 → 7, plus Amount) all about you, the star turning a little each slam; at each tip the **bell rings** (a 62 px burst), and now and then a **jackpot** crit with its "DING!" |
| **Crystal Orbs** | orbs orbit at a fixed ~100 px; they reached only what came to you | the orbit **swells out to 1.8× once a turn and back**, sweeping the ground beyond the ring; and the orbs **grind**: each hit on a creature soon after the last bites 25% harder, up to double |
| **Cosmic Convergence** | 7 orbs, a gravity pulse to ring + 260 px | the same swell and grind, and the gravity pulse reaches **ring + 420 px**, dragging the crowd in from afar |

The Night Express Whistle keeps its pattern: the rings are its identity, and the player likes them. Its rings now scald
a boss 2.5× (a boss can't be shoved, so the steam stays on it longer). Before, the whistle all but passed bosses by:
72 boss damage/s at Evo Lv 8, against 1–5k for the others.

## Every weapon's pattern

The role column describes how each weapon plays, not a category in the code.

| Weapon | Lv 1 pattern | Evolution | Evolved pattern | Role |
|---|---|---|---|---|
| Throwing Cards | a fan of razor cards at the nearest creature, piercing one | Royal Flush | golden cards spiralling the whole screen, piercing everything | long-range crit, reaches first |
| Tarot Toss | homing cards on random creatures, frequent crits | The Death Card | slow homing reaper cards, massive crits, burst on impact | homing burst; the boss killer |
| Balloon Darts | fast piercing darts, shrapnel at flight's end | Sharpshooter's Bouquet | crit volleys blossoming into shrapnel | precise multi-pierce |
| Carnival Cannon | a piercing line cannonball with huge knockback | Cannonball Special | rapid cannonballs exploding at range | line pierce, crowd shove |
| Ring Toss | boomerang rings out and back, pierce all | Saturn's Rings | giant rings orbiting forever | lanes out and back |
| Popcorn Popper | kernels lobbed at random creatures pop into bursts | Kettle-Korn Cannon | a constantly popping field | scattered bursts |
| Fireworks | rockets lobbed one by one, scattered bursts | Grand Finale | barrage, every 4th a chrysanthemum shell | big delayed area |
| **Snow-Cone Machine** | **lobbed cones → slush puddles (chill, slow, freeze)** | **Blizzard Machine** | **roaming storms hunting the crowd** | area denial and control; frozen means +25% for all |
| **Hot-Dog Grill** | **burning grease trail behind you** | **Inferno Grill** | **hotter trail and rolling flame waves** | kiting; rear coverage; damage over time |
| **Whack-a-Mole Mallet** | **targeted whacks in turn, each dazing** | **Whack Frenzy** | **relentless whacks and a ground-pound** | heavy targeted burst and control |
| **Strongman Bell** | **a fissure to the nearest creature** | **High Striker** | **a turning star of fissures, bells at the tips** | lines through the crowd; jackpots |
| Cotton-Candy Gun | a sugar cone that slows and dissolves | Sticky Situation | candy-web fields under the crowd, melting faster the longer stuck | slow and damage over time |
| Fire Breath | a cone of flame where you face, burning | Hellmouth | endless flame front and back; burning things burst | close-range burn |
| Laser Light Show | rotating neon beams around you | Grand Illumination | six beams counter-rotating forever | sweeping coverage |
| Watchman's Lantern | a beam sweeping back and forth before you, burning | The Last Light | three long beams turning and sweeping | aimed sustained beam |
| **Crystal Orbs** | **orbs orbit and swell; they grind, then shove** | **Cosmic Convergence** | **7 giant swelling orbs and a long-reach gravity pulse** | a barrier that grinds the tough ones down |
| Night Express Whistle | a ring of steam rolls out, shoving and scalding | Last Call | three rings in turn | space control and crowd shove |
| Spirit Chains | a chain leaping creature to creature, binding the last | The Reaper's Chain | twice as far through twice as many, losing nothing, binding all | chain through groups |
| Steam Calliope | spiralling notes drift outward | Grand Requiem | an endless spiral of homing notes with thunderous chords | swirling coverage |
| Plush Companion | plush pets orbit and pounce | Nightmare Menagerie | a ravenous pack mauling crowds | summons |
| Top Hat | rabbits and doves from the hat | Grand Menagerie | lion, elephant and acrobats, permanently | summons |
| Funhouse Mirror | a clone replays your attacks at a share of your damage | Hall of Mirrors | three permanent clones mirroring everything | multiplier |
| The Undertow | launch forward on a rail of light, ramming | The Last Lap | a ramming aura while you move, runaway cars | mobility, ramming |

## Expected synergies

- **Snow-Cone or Blizzard with anything.** Frozen creatures take +25% from every weapon. Slush and storms slow the crowd
  in reach of short-range weapons: Mallet, Fire Breath, Grill.
- **Grill with Orbs or Whistle.** The Orbs and the Whistle shove creatures back out through the burning trail.
- **Mallet with Cards or Tarot.** The cards kill the weak at range, and the whacks crush and daze what gets close.
- **Orbs with a long-range weapon.** The orbs grind down the tough ones that lean through the ring (elites, brutes),
  which the cards didn't finish. The swell reaches what hangs back.
- **Bell with Cotton or Snow-Cone.** Slowed and frozen crowds line up for fissures.

## Remaining overlaps (documented, not changed in D-103)

- **Laser Light Show and Watchman's Lantern** are both beams. The Laser rotates around you; the Lantern is aimed and
  sweeps before you. Their evolutions, Grand Illumination (six counter-rotating beams) and The Last Light (three
  turning, sweeping beams), are the closest pair left. Candidate for a later pass: make the Last Light a single searchlight
  that locks onto the toughest creature.
- **Cotton-Candy Gun and Fire Breath** are both cones. Cotton slows and dissolves; Breath burns (the Fire-Eater's
  signature). Their evolutions differ: web fields against an endless flame front and back.
- **Popcorn Popper and Fireworks** both lob bursts. Popcorn scatters small fast pops; Fireworks are slow, heavy and
  delayed. Kettle-Korn's field against Grand Finale's barrage keeps them apart.
- **Night Express Whistle and Cosmic Convergence's pulse** are both rings from you. One pushes and the other pulls,
  and the Whistle is a damage source while the pulse is a utility.

## Performance

- **New entities.** Slush and storms are ordinary pooled ground zones (220 in the pool). A Blizzard keeps at most 6
  storms; the Grill's trail is about 16 patches while walking. The Bell's fissures are scheduled hit checks with one
  `crack` effect event per burst. Whacks are scheduled hit checks with a ring and a dust burst each.
- **Co-op.** Nothing new goes on the wire beyond zones and effect events, which were already replicated. Zone kinds,
  effect types and projectile kinds travel by name, so there is no protocol change (PROTO stays 22).
- **Rendering.** Storms and slush draw with the shape batches the ground zones already use, plus a few snow particles
  a frame per storm.
- **Measured** (`scripts/bench/arsenal-perf.ts`, 250 creatures kept alive, every weapon at Lv 8 with a late kit):
  - every reworked evolution together: **0.36 ms per sim tick**, at most 47 live ground zones;
  - six unchanged evolutions: **0.36 ms per tick**, at most 255 projectiles.

  The reworked weapons cost no more than the ones they sit beside. The rendering cost wasn't measured on the GPU bench
  this time; the new zones draw through the existing ground-zone batches.
