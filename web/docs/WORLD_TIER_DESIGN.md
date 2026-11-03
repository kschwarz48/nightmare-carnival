# World tiers: Normal → Nightmare → Hell (D-97)

The design for turning the per-night difficulty choice into three versions of the whole carnival, each unlocked by
finishing the one before, each with its own look, enemy behaviour, Lost & Found stock and unlocks. Written after an
audit of the code as it stands (D-96); where the brief assumed something the code doesn't do, the code wins and the
difference is noted.

## Status (2026-11-02, branch `world-tiers`, not deployed)

Implemented and tested (`tests/tiers.test.ts`, 48 tests; the whole suite passes; the production build builds):
the tiers and their numbers, the rules and saves v6 with its migration, character select and the co-op lobby, the
co-op sync and eligibility (PROTO 20), the dev tools, both Lost & Found shelves, the looks on all four maps
(captures: `web/artifacts/visual/tiers/`, local only), the creature variants, the bosses' tier attacks, the
ceremonies, the tier achievements, the tiers' passives (Death's Door, the Soul Jar, Brimstone, Cinder Heart), the
tiers' weapons (the Watchman's Lantern, Spirit Chains, Fire Breath) and their evolutions (the Last Light, the
Reaper's Chain, Hellmouth), the score's tier colouring and a first balance step. Decision record: D-97.

Changed from this design while building it:

- Second Wind and Final Act give might, Ember Heart armour, instead of speed: a guest's own movement is predicted
  on its machine, so the shelves' changing bonuses stay on stats only the host reads.
- Tier numbers after the first balance step: Nightmare health ×1.45, damage ×1.2; Hell ×2.2, ×1.5 (the rest as in
  §2).
- The bosses' tier attacks are one shared, telegraphed layer (Nightmare's choir, Hell's firestorm) over each boss's
  own patterns, not yet bespoke staging per boss.
- The "link" variant ability was left out (the other eleven are in).
- Spirit Chains has an evolution too (the game requires one of every weapon): the Reaper's Chain, with the Soul Jar.
  The tiers' evolutions don't count toward Full House, which stays a Normal-carnival achievement.
- The score's tier transform is a colouring of the existing music (Nightmare a semitone lower and drifting out of
  tune, Hell two semitones lower), not new arrangements.

Not done yet, in the order they'd be worth doing:

1. The two new characters of §7: the Night Watchman (Lamplight) and the Fire-Eater (Fireproof): their quirks,
   portraits and sculpted 3D models to the character art standard. Their weapons already exist and are sold on the
   Lost & Found meanwhile.
2. Balance across every map, party sizes two to six and Lost & Found levels (`scripts/tier_balance.ts` takes them
   all), then the owner's playtests.
3. Fires and apparitions as props in the worlds (burning tents, smoke columns, spectral riders) and the ambience's
   tier transform (§9).
4. Bespoke tier staging for the four final bosses (§8).
5. The real-GPU benchmark (`desktop/bench.js`) on Nightmare and Hell, and a cross-network co-op night on a tier.

## 1. What the audit found (the starting point)

- **Difficulty today** (`data/difficulty.ts`): three per-night settings, Midway / Carnival / Nightmare, chosen at
  character select or by the co-op host, scaling enemy HP (1 / 1.5 / 2.2), damage (1 / 1.25 / 1.6), crowd cap (180 /
  280 / 400), Lost Ticket greed (+0 / +0.3 / +0.6), the miniboss interval, elite affixes and elite chance. Unlocked by
  achievements (Carnival after the Ferris Wheel, Nightmare after a Carnival win). The Curse is a separate toggle
  (beat the Puppet King). The Daily Run plays on Carnival.
- **Map progression on Normal** (`SaveManager.mapAvailable`): the Carnival Core always; the Fun House after the
  Ringmaster (or the Midway hub, or a tester flag); the Boardwalk after the Proprietor; the Ghost Train after the
  Leviathan. Maps open by beating the previous map's final boss, **not** by the Easter eggs (the brief's assumption);
  only the Midway hub opens through an Easter egg (the Last Song). Normal keeps these rules exactly.
- **Winning a night**: dawn arrives, or the final boss falls (`ringmasterSlain`); every Easter-egg ending sets the same
  flag and jumps to dawn, so `RunStats.won` covers standard and secret endings alike. Endless continues a won night.
- **Saves** (`meta/save.ts`): localStorage JSON, version 5, a migration chain (v1→v5), a backup slot (the previous
  save is kept on every write) and recovery from it. Lost & Found perks, unlocks (`unlocks[]`), achievements,
  quest memory, stats, history, per-player companion choice.
- **Co-op** (`net/`): host-authoritative; the host simulates everyone; the lobby (`LobbyState`) and start config
  (`StartCfg`) carry the map, difficulty and Curse; each player's results come from the host's night
  (`Game.statsFor`), paid at their own greed, and every player is granted the night's achievements on their own
  save — which today lets a guest pick up `beat_*` achievements (and so map unlocks) out of order.
- **Enemies**: 60 definitions, ~57 in the four maps' rosters, behaviours by id (`sim/enemyAI.ts` and each map's AI),
  an elite affix system (explosive, splitter, hasted, shielded, magnetic). Enemy status reaches guests in one byte
  of flags (4 used, 4 free).
- **Bosses**: ~20, coroutine attack scripts with weighted attack tables per phase (`sim/bosses/*`).
- **Rendering**: each world sets a small ambient palette (sky/ground hemisphere, fill, mist), the moon, fog and the
  practical-light pool; a vintage grade post pass; billboard layers for glows, particles and decals; instanced
  batches for every model.
- **Audio**: synthesized SFX recipes; a parametric procedural night score per map and act; Bradley's songs on
  menus, bosses and the Ghost Train.

## 2. The tiers

| | Normal — The Cursed Carnival | Nightmare — The Haunted Carnival | Hell — The Infernal Carnival |
|---|---|---|---|
| unlocked by | (always) | finishing the Normal campaign (a Ghost Train win on Normal) | finishing the Nightmare campaign (a Ghost Train win on Nightmare) |
| enemy HP × | 1 | 1.6 | 2.4 |
| enemy damage × | 1 | 1.3 | 1.6 |
| crowd cap | 180 | 230 | 280 |
| spawn interval × | 1 | 0.92 | 0.85 |
| elite chance × / affixes | 1 / 0 | 1.3 / 1 | 1.6 / 2 |
| miniboss interval | 140 s | 125 s | 110 s |
| XP (ticket value) × | 1 | 1.12 | 1.25 |
| Lost Tickets (greed) | +0 | +0.5 | +1.0 |
| creatures | as they are | spectral variants (one new mechanic each, or a new look) | infernal variants (stronger mechanics) |
| bosses | as they are | spectral look; the four final bosses gain a new attack | infernal look; the final bosses' attack escalates |
| look and sound | as it is | the realm of the dead: cold spectral light, ghost flames, pale mist, wisps and apparitions | burning: ember light, fire on the attractions, ash, red-black smoke, glowing cracks |

Numbers are the starting point for the balance pass (§10). Run lengths don't change (25 minutes; the Ghost Train
35). The old difficulties go: their selection rows are removed, Normal plays Midway's numbers, and the Daily Run keeps
its own fixed scaling (the old Carnival's), so dailies play as before. The Curse stays, a toggle on any tier.

## 3. Progression rules

- **Tier unlock**: a tier opens when the previous tier's campaign is complete: a won Ghost Train night on that tier
  that counts for the player (§5). Permanent; earlier tiers stay open.
- **Map availability**:
  - Normal: the existing rules, unchanged.
  - Nightmare and Hell: the Carnival Core once the tier is open; each next map once the previous one has been won
    on that tier (Carnival Core → Fun House → Boardwalk → Ghost Train). No Easter egg is needed.
- **Completion**: a night counts as a completion of (tier, map) when it is won (`RunStats.won`, standard or secret
  ending, Endless included from dawn), it isn't a Daily Run, and it counts for this player (§5). Completions are
  stored per tier and map (counts), so each tier keeps its own state.
- **Easter eggs** stay exactly as they are on every tier: optional, same solutions, same rewards (their permanent
  rewards are only granted once, as now). A secret ending is a win like any other.
- **Choosing**: the tier is chosen first, then a map that tier has open, then the character, companion and Curse.
  Solo at character select; in co-op by the host in the lobby. The choice is remembered (`last.tier`).

## 4. Saves (v6)

New fields:

```ts
tiers: {
  unlocked: TierId[];                                   // ['normal'] on a fresh save
  wins: Record<TierId, Partial<Record<MapId, number>>>; // completions per tier and map
  seen: TierId[];                                       // unlock ceremonies already shown
};
last.tier?: TierId;
```

Migration v5 → v6 (deterministic, idempotent, versioned):

- `tiers.unlocked` = Normal, plus Nightmare if the save holds `beat_night_express` (the Ghost Train's standard
  victory: the Normal campaign finished). Never Hell: nothing in an old save is a Nightmare-tier completion.
- Normal completions from the maps' final-boss achievements (Ringmaster, Proprietor, Leviathan, Night Express → 1
  win each); the old saves recorded no per-map wins.
- `seen` = []: a tester who already finished the campaign sees the Nightmare ceremony once, as the reveal.
- `last.tier` = Normal. Everything else is kept: Lost Tickets, perks, unlocks, achievements (the old difficulties'
  `win_carnival` / `win_nightmare` stay on the save, shown as retired), quest memory, stats, history, settings.
- Before a migration writes anything, the old save's text is copied once to a versioned key
  (`nightmare_carnival_save_v5`), on top of the existing backup slot.

## 5. Co-op: who can play what, and who earns what

- **Joining**: anyone can join any lobby, whatever their own progress (as now).
- **Choosing**: the host picks among the tiers and maps the host has open. The lobby shows guests the tier; a guest
  who hasn't opened it is told the night won't count toward their own campaign.
- **Every player, always**: their Lost Tickets (at their own greed), vouchers, stats, Normal-tier achievements as now
  (boss kills, kill counts, companions), quest memory.
- **Only when it counts for them** (their own save has the night's tier open and the night's map available on that
  tier): the completion (§3), and through it the next map and the next tier; and the tier achievements (entering a
  tier, completing a map on a tier, the campaigns, tier challenges). Their tier unlocks follow their own progress, so
  no tier can be skipped by joining a friend's night.
- **Disconnects**: a guest who drops and rejoins before the night ends gets the end as now; one who never comes back
  gets nothing from that night (as now). The host's tier is in the start config, so a rejoining guest rebuilds the
  same tier's night.
- **Protocol**: `LobbyState.tier`, `StartCfg.tier` (validated on arrival); variant states in the enemy flags'
  free bits; PROTO 20.

## 6. The Lost & Found

Lost Tickets stay the only currency. Normal's stock is unchanged. Each tier adds a shelf, shown with its tier's
look; locked shelves show what opens them.

**Nightmare shelf** (opens with Nightmare):

| item | levels | price | effect |
|---|---|---|---|
| Second Chance | 1 | 5,000 | once a night, a blow that would down you leaves you on 30% health instead, untouchable for 2.5 s, and blows nearby creatures back |
| Soul Collector | 3 | 2,500 ×1.7 | each elite or miniboss you kill gives a soul for 30 s: +4/6/8% might each, up to 3 |
| Prize Hunter | 2 | 3,000 ×1.8 | elites are 50/100% more likely to carry a prize chest |
| Opening Act | 1 | 3,500 | every night starts with one level's draft already waiting |
| Second Wind | 3 | 2,000 ×1.6 | food heals 20/40/60% more and gives 3 s of +15% speed |

**Hell shelf** (opens with Hell):

| item | levels | price | effect |
|---|---|---|---|
| Devil's Bargain | 1 (switchable) | 8,000 | −25% max health, +30% might; switch it off and on in the Lost & Found |
| Final Act | 2 | 6,000 ×1.8 | in the night's last act: +10/20% might, +5/10% speed |
| Unfinished Business | 3 | 5,000 ×1.7 | each boss you beat tonight: +3/4/5% might and +2/3/4% max health for the rest of the night |
| Infernal Resilience | 3 | 4,500 ×1.7 | 10/17/25% less damage from telegraphed strikes (explosions, fire, boss attacks) |
| Ember Heart | 2 | 5,000 ×1.8 | below 35% health: +1/2 health a second and +10% speed |

Prices are set against earnings: a won Normal night pays ~800–1,500 Lost Tickets; with Nightmare's +0.5 greed a won
Nightmare night ~1,500–2,500, a lost one ~500–1,200; Hell's +1.0 ~2,500–4,000 won. The Nightmare shelf (~41k) is a
couple of dozen nights; its first purchases come after one or two. Section 10 checks these with the payout model.

## 7. New characters, weapons, passives

| content | identity | unlock |
|---|---|---|
| **The Night Watchman** (character) | the carnival's last night guard; lantern and keys. Starts with the Watchman's Lantern. Quirk *Lamplight*: creatures in his lantern's light take 15% more damage from everything, and phasing spectres are forced solid there | complete the Carnival Core on Nightmare, then 6,000 |
| **Watchman's Lantern** (weapon) | a beam of lantern light that sweeps back and forth in front of him, burning everything it touches for as long as it stays in it | the Watchman's own; in everyone's drafts after the Fun House on Nightmare (3,000) |
| **Spirit Chains** (weapon) | spectral chains that leap from creature to creature, each link weaker, and bind the last one (slowed) | complete the Fun House on Nightmare, then 3,500 |
| **Death's Door** (passive) | more might the less health you have (up to +40% at a sliver) | complete the Boardwalk on Nightmare, then 2,500 |
| **Soul Jar** (passive) | every 40 kills, the jar breaks in a spectral blast around you | complete the Boardwalk on Nightmare, then 2,500 |
| **The Fire-Eater** (character) | a sideshow fire-breather. Starts with Fire Breath. Quirk *Fireproof*: immune to burning ground; creatures he sets alight take 20% more damage | complete the Carnival Core on Hell, then 10,000 |
| **Fire Breath** (weapon) | a cone of flame in the direction you face, setting creatures alight (burning, damage over time) | the Fire-Eater's own; in everyone's drafts after the Fun House on Hell (5,000) |
| **Brimstone** (passive) | hits have a chance to set creatures alight; burning creatures burst when they die | complete the Boardwalk on Hell, then 4,000 |
| **Cinder Heart** (passive) | burning creatures near you heal you a little | complete the Boardwalk on Hell, then 4,000 |
| Evolutions | Watchman's Lantern + Death's Door → *the Last Light*; Fire Breath + Brimstone → *Hellmouth* | as usual |

New characters follow `docs/CHARACTER_ART_QUALITY_STANDARD.md` (layered sculpts, figure materials, the inspector's
checks) and get 2D portraits in the same style as the cast.

## 8. Creature variants

One system extends every definition (`data/variants.ts`, `sim/variants.ts`): a variant per (creature, tier) gives a
look (spectral or infernal), a name, and zero to two **abilities** from a shared set, implemented once:

| ability | tier | what it does | tell |
|---|---|---|---|
| phase | Nightmare | every 6–9 s goes intangible for 2 s: can't be hurt, can't hurt you | 0.8 s shimmer, then see-through |
| decoy | Nightmare | sheds two one-hit illusions when first hurt, again every 12 s | a puff of ectoplasm |
| blink | Nightmare | reappears near you after a telegraph | a ring where it will arrive, 0.7 s |
| wail | Nightmare | a pulse that slows you for 1.5 s if it reaches you | an expanding pale ring |
| haunt | Nightmare | dying, leaves a wisp that drifts at you for 2 s and bursts | the wisp and its small circle |
| link | Nightmare | a group within reach dashes at you together every 9 s | lines from each to their mark |
| blast | Hell | dying, explodes | a fiery circle, 0.8 s |
| trail | Hell | leaves burning ground behind it (3 s) | embers, then the flames |
| ember | Hell | lobs a fireball at where you stand every 5–7 s | the landing circle |
| enrage | Hell | below 40% health, 40% faster and harder hitting | it flares |
| quake | Hell | a shockwave ring every 7 s | the ring's growing outline |
| harden | Hell | infernal plating: the first hits do half damage until it cracks | glowing plates, then a crack |

Each map's roster gets a deliberate mix: about half the kinds gain a mechanic on each tier, the rest a new look (and
the tier's numbers). The full table is in `data/variants.ts`. All mechanics run in the host's simulation with its
seeded randomness; states guests must draw (phased, enraged, hardened) ride the enemy flags; hazards and bullets are
the existing replicated kinds.

**Bosses**: every boss takes its tier's look (materials, light, particles). The four final bosses gain a tier attack
(Nightmare) that escalates on Hell: the Ringmaster's phantom troupe / ring of fire, the Proprietor's echoes /
burning reflections, the Leviathan's drowned choir / boiling sea, the Night Express's phantom carriage / firebox
sparks. Each uses the boss's own staging, so no universal cone or circle is bolted on.

## 9. The look and sound of each tier

A data-driven `TierLook` (`render3d/tierLook.ts`) over each world's own settings: moon colour and strength, the
hemisphere and fill, the mist's colour and density, the practical lights' colours (one choke point: the light pool),
the emissive tint of signs and bulbs, the grade (saturation, split toning, contrast), and the tier's particles,
apparitions and fires (`render3d/world/tierFx.ts`, drawn into the existing billboard layers), with per-map
overrides:

| | Nightmare | Hell |
|---|---|---|
| Carnival Core | cold moonlight, ghost-flame lamps, pale searchlights, spectral riders on the rides, wisps over the midway | burning tents, red searchlights, smoke columns, ember storm, glowing cracks along the paths |
| Fun House | spectral mirrors, ghost-flame sconces, apparitions in the halls | fire in the reflections, smouldering walls, cracks in the floor |
| Boardwalk | a black-violet sea with pale fresnel, spectral sea mist, ghost lights on the water | a dark sea throwing back the fires, burning attractions, ash on the wind |
| Ghost Train | phantom lamps, spectral carriages, ghost passengers on the platforms | glowing fireboxes, burning stations, sparks off the rails |

Collision, navigation and gameplay readability stay as they are: telegraphs keep their colours on every tier. The
night score is transformed per tier (Nightmare: lower, more out of tune, a spectral choir; Hell: lower still, a
heavier pulse, low brass and anvil hits), and the ambience follows.

**Ceremonies**: unlocking a tier plays a ceremony over the live carnival (the hub or the menu's scene) once: the
lights flicker, the scene crosses into the new tier's look, apparitions or flames rise, an original synthesized
sting, then NIGHTMARE UNLOCKED / HELL UNLOCKED and what is new. Skippable; shown once per save (`tiers.seen`);
co-op guests see their own when their own save unlocks the tier.

## 10. Balance

- Tools: the bot nights (`scripts/bench/sim.ts`, `tests/helpers` pilots), the payout model, and a tier balance script
  (`scripts/tier_balance.ts`) running bot nights per map, tier, party size and Lost & Found level, reporting how long
  the bot survives, damage taken, level reached and Lost Tickets.
- Targets: a player who has just finished Normal (about half of Normal's shop) can win Nightmare's first maps with
  some deaths; a player with the Nightmare shelf part-bought can finish the Nightmare campaign; Hell asks for a
  strong build and most of both shelves, not all of them. Parties shouldn't trivialise the tiers (party HP scaling
  stacks with the tier's) nor solo be punished.
- Bots aren't players: the numbers rule out the extremes; human playtests settle the rest (§12 lists what to watch).

## 11. Testing

Unit and integration tests for the tier rules (unlocks, maps per tier, completions, eligibility), the save
migration (fixtures of real old saves: fresh, partial, Normal finished, rich), co-op (tier sync, eligibility,
locked-tier guests), the variants (each ability's behaviour and its replication), the Lost & Found shelves, the
new content, and the existing suite. Then bot nights on every map and tier, captures of every map on every tier,
and the real-GPU benchmark on Normal / Nightmare / Hell.

## 12. Order of work

1. This design.
2. The foundation: tier data, rules, saves v6, lobby and character select, co-op sync, dev tools.
3. The Lost & Found shelves and the new content.
4. The looks.
5. The variants and the bosses' tier attacks.
6. Balance.
7. The ceremonies, the tier UI's polish, achievements, the final reward.
8. Verification and the handoff.
