# Lost & Found and the Lost Ticket economy (D-103)

The audit of every permanent upgrade, the model of permanent power against each world tier's creatures, what nights
pay, and what changed.

**Sources.** The model is `scripts/progression_model.ts`; run it with `--before` for the old shelves. The bot nights are
`scripts/tier_balance.ts`, with the new `own` build: every perk up to the night's own tier. Shelf totals are checked in
`tests/meta.test.ts`.

## 1. The shelves

### Normal (unchanged, 22,097 LT to max)

| Perk | Effect per rank | Ranks | Prices | Total | Verdict |
|---|---|---:|---|---:|---|
| Hearty Stew | +6% Max HP | 5 | 120 / 192 / 307 / 492 / 786 | 1,897 | core; good value |
| Brass Knuckles | +5% Might | 5 | 160 / 272 / 462 / 786 / 1,336 | 3,016 | core; the most important Normal buy |
| Worn Sneakers | +4% Move speed | 4 | 140 / 238 / 405 / 688 | 1,471 | safety; fine |
| Ticket Magnet | +10% Pickup radius | 4 | 100 / 160 / 256 / 410 | 926 | comfort; cheap, fine |
| Four-Leaf Clover | +5% Luck | 4 | 180 / 306 / 520 / 884 | 1,890 | better upgrade qualities (D-99); fine |
| Piggy Bank | +8% Greed | 5 | 160 / 264 / 436 / 719 / 1,186 | 2,765 | economy; pays for itself in about 10 nights |
| Padded Vest | +1 Armor | 2 | 400 / 880 | 1,280 | strong against the crowd's chip damage |
| Funnel Cake | +0.2 HP/s | 5 | 200 / 340 / 578 / 983 / 1,670 | 3,771 | strong sustain; slightly dear |
| Spare Balloon | +1 Revive | 1 | 1,500 | 1,500 | the closest to mandatory; fine at one rank |
| Re-Spin Token | +1 Reroll | 3 | 250 / 475 / 903 | 1,628 | build agency |
| Banish Stamp | +1 Banish | 3 | 300 / 570 / 1,083 | 1,953 | build agency |

Normal's shelf works: cheap first ranks, a sensible order, and no runaway stacking. Might is additive with the in-run
passives, so +25% permanent Might is +14% once a Strongman Belt is maxed. The stacking dampens itself.

### Nightmare (41,195 → 74,146 LT)

| Perk | Effect | Ranks | Total | Change |
|---|---|---:|---:|---|
| Second Chance | once a night, survive a downing blow on 30% HP | 1 | 5,000 | — |
| Soul Collector | elite or miniboss kills give souls: +4/6/8% Might each, up to 3, for 30 s | 3 | 13,975 | — |
| Prize Hunter | elites 50/100% likelier to carry a chest | 2 | 8,400 | — |
| Opening Act | every night opens with a draft | 1 | 3,500 | — |
| Second Wind | food heals 20/40/60% more, +20% Might for 4 s | 3 | 10,320 | — |
| **Phantom Knuckles** | **+4% Might** | **5** | **14,933** (1,500 × 1.35ⁿ) | **new** |
| **Stopped Watch** | **−3% weapon cooldowns** | **4** | **12,786** (1,800 × 1.4ⁿ) | **new** |
| **Grave Broth** | **+5% Max HP** | **3** | **5,232** (1,200 × 1.4ⁿ) | **new** |

### Hell (91,905 → 144,673 LT)

| Perk | Effect | Ranks | Total | Change |
|---|---|---:|---:|---|
| Devil's Bargain | −25% Max HP, +30% Might (switchable) | 1 | 8,000 | — |
| Final Act | +12/24% Might in the last five minutes | 2 | 16,800 | — |
| Unfinished Business | per boss beaten: +3/4/5% Might, +2/3/4% Max HP | 3 | 27,950 → **24,763** | price growth 1.7 → 1.55 |
| Infernal Resilience | 10/17/25% less from telegraphed strikes | 3 | 25,155 → **22,286** | price growth 1.7 → 1.55 |
| Ember Heart | below 35%: +1/2 HP/s, +2/4 Armor | 2 | 14,000 | — |
| **Infernal Knuckles** | **+4% Might** | **5** | **29,866** (3,000 × 1.35ⁿ) | **new** |
| **Bellows** | **+5% Area** | **4** | **17,760** (2,500 × 1.4ⁿ) | **new** |
| **Hellhide** | **+1 Armor** | **2** | **11,200** (4,000 × 1.8ⁿ) | **new** |

**Why the new ranks.** Both tier shelves were conditional mechanics only: souls, chests, last-five-minute and
per-boss bonuses. Not one sold plain strength.

- **Nightmare.** A player who maxed Normal (+25% Might) met creatures with 45% more health and 20% more damage.
- **Hell.** Creatures had 2.2× health and 1.5× damage, against at most +41% average Might from everything bought.

The model below shows the gap. The new ranks close most of it, and the conditional perks keep their place as the
interesting buys.

**Fixed along the way.** A guest's perks went over the wire one entry per perk. The guest-profile cleaner kept only
the first entry for each stat, so a guest's Nightmare Might would have been dropped. Its per-stat ceiling also kept only
the last perk on each stat. Now the save merges its bonuses per stat, and the ceiling is the sum of every perk on that
stat at its cap. Both are tested in `tests/arsenal.test.ts` and `tests/net.test.ts`.

## 2. Permanent power against each tier

**Offence** is this sum, divided by the cooldown multiplier, times (1 + half the Area bonus), over the tier's creature
health:

- 1
- 0.6 in-run Might (a typical late build)
- the permanent Might
- the conditional Might at its expected uptime

**Defence** is the Max HP multiplier × (1 + 8% per Armor) × (1 + 15% per HP/s of regeneration), over the tier's damage.

Both are relative to a fresh player on Normal (1.00). Power is their geometric mean.

| Tier | State | LT spent | Power before | Power after | Offence after | Defence after |
|---|---|---:|---:|---:|---:|---:|
| Normal | fresh | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| Normal | partly upgraded | 1,344 | 1.11 | 1.11 | 1.06 | 1.15 |
| Normal | well upgraded | 6,954 | 1.28 | 1.28 | 1.13 | 1.46 |
| Normal | Normal maxed | 22,097 | 1.42 | 1.42 | 1.16 | 1.73 |
| Nightmare | **fresh (a new guest)** | 0 | **0.76** | **0.76** | 0.69 | 0.83 |
| Nightmare | just finished Normal | 8,454 | 0.97 | 0.97 | 0.78 | 1.22 |
| Nightmare | mid-Nightmare | 29.6k → 41.4k | 1.09 | **1.18** | 0.93 | 1.50 |
| Nightmare | Nightmare maxed | 63.3k → 96.2k | 1.11 | **1.31** | 1.06 | 1.61 |
| Hell | **fresh (a new guest)** | 0 | **0.55** | **0.55** | 0.45 | 0.67 |
| Hell | just finished Nightmare | 63.3k → 96.2k | 0.81 | **0.96** | 0.71 | 1.29 |
| Hell | mid-Hell | 72.8k → 124.3k | 0.84 | **1.04** | 0.82 | 1.33 |
| Hell | Hell maxed (Bargain off) | 155.2k → 240.9k | 0.88 | **1.20** | 0.92 | 1.57 |
| Hell | Hell maxed (Bargain on) | 155.2k → 240.9k | 0.85 | **1.16** | 1.02 | 1.32 |

The mid-tier rows differ in spend because the "after" states include some of the new ranks.

### Bot nights

`scripts/tier_balance.ts`, Carnival Core, solo, seeds 11 and 22, after D-103:

| Tier | Fresh | Half of Normal's shelf | Fully upgraded for the tier (`own`) |
|---|---|---|---|
| Normal | won, won | won, won | won, won |
| Nightmare | fell at 4:37 (L19), 8:55 (L25) | fell at 7:06 (L26), 12:25 (L28) | **won, won** (L76, L58; 4 bosses) |
| Hell | fell at 2:13 (L10), 4:17 (L16) | fell at 5:12 (L19), 5:57 (L21) | **won, won** (L81, L78) |

Bots play far worse than people, and much worse in harder content. The bots establish the shape: a fresh or
half-upgraded character can't hold a higher tier on its own, and one bought up to that tier can. Whether the human
difficulty curve sits right is in the playtest guide. There is no "before" for these runs: the `own` build is new, and
the old shelves had no core ranks to buy.

## 3. The questions, answered

1. **How much stronger is a fully upgraded Normal character than a fresh one?** About 1.42× in power: +16% offence,
   +73% survivability. On Normal that is comfortable without trivialising the night.
2. **How strong is a freshly unlocked Nightmare character, having just finished Normal?** About 0.97: as strong
   against Nightmare as a fresh player is against Normal. Nightmare is a real step up. Survivability carries, offence
   lags at 0.78.
3. **How much more can the Nightmare shelf give?** It was +14% power (0.97 → 1.11). It is now +35% (0.97 → 1.31), with
   offence 0.78 → 1.06.
4. **How does that compare with Nightmare's creatures?** A Nightmare-maxed player's offence now slightly exceeds a fresh
   Normal player's against Normal (1.06). Before, it never got there (0.85).
5. **A well-progressed Nightmare player against a fresh guest?** 1.31 against 0.76: about 1.7×. A fresh guest is
   meaningfully underpowered, with offence at 0.69 of baseline and defence at 0.83. They can still contribute: they
   level from shared XP, and teammates absorb pressure. That comes from the scaling, not from any penalty on fresh
   players.
6. **Is Hell an appropriate step up?** Yes. A player who has finished Nightmare enters at 0.96 power (0.81 before), so
   the first Hell nights feel like a new start but aren't hopeless. A fresh guest is at 0.55.
7. **Do the Hell upgrades give enough?** They now reach 1.16–1.20 (0.85–0.88 before). Before, even a fully bought save
   stayed below a fresh Normal player.
8. **Runaway power?** No. At the very top (Hell, everything bought, Devil's Bargain on), permanent Might is +128%
   against 2.2× health, so offence is 1.02 of baseline. Weapon cooldowns can't drop below a third of their own (D-99),
   and stats have floors (cooldown ≥ 0.3). Near-invulnerability isn't reachable: defence peaks at 1.73 on Normal and 1.57
   on Hell.
9. **Mandatory upgrades?** The Spare Balloon and Brass Knuckles are close: first buys for almost everyone. That's
   acceptable for cheap first ranks. On the tier shelves, the new Might ranks will be the first buys; the conditional
   perks remain choices.
10. **Can skilled players clear a tier before maxing?** The model says yes, by a wide margin. A player who has finished
    Normal enters Nightmare at 0.97, and humans play far above bots. Bots alone win on Nightmare and Hell only when bought
    up to the tier: the human question is how much short of that a good player can be.

## 4. What nights pay

`computePayout`:

- min(time, dawn)/6
- 50 per boss
- kills/25
- 100 for a win

The total is multiplied by Greed: 1, plus Piggy Bank and passives, plus the tier's Greed. D-103 raises the tiers' Greed
from +50% to **+75%** on Nightmare and from +100% to **+150%** on Hell.

| Tier | Piggy Bank | Won night (25:00, 5 bosses) | Lost at 15:00 | Ghost Train won (35:00, 7 bosses) |
|---|---|---:|---:|---:|
| Normal | none | 720 | 304 | 968 |
| Normal | maxed (+40%) | 1,008 | 426 | 1,355 |
| Nightmare | none | 1,110 → **1,295** | 470 → **548** | 1,494 → **1,743** |
| Nightmare | maxed | 1,406 → **1,591** | 595 → **673** | 1,892 → **2,141** |
| Hell | none | 1,536 → **1,920** | 650 → **813** | 2,070 → **2,588** |
| Hell | maxed | 1,843 → **2,227** | 780 → **943** | 2,484 → **3,002** |

**One-time achievements.** Nightmare 6,400 → **11,500** and Hell 12,200 → **21,700**: the new hidden-quest achievements
are below. Everything else totals 5,360.

### Nights to each milestone

Assumes half the nights won and the rest lost at 15:00. Achievements count when first earned.

| Milestone | Cost | About this many nights |
|---|---:|---:|
| A working Normal foundation (four ranks of Might and Max HP, Armor, regen) | ~7,000 | 9–10 |
| The whole Normal shelf | 22,097 | ~30 (most players move on before maxing) |
| The first important Nightmare buys (Second Chance, Phantom Knuckles ×2, Soul Collector) | ~11,000 | ~8 |
| The whole Nightmare shelf, its attractions and the Night Watchman | ~91,600 | ~70 |
| The first important Hell buys (Infernal Knuckles ×3, Devil's Bargain) | ~20,500 | ~11 |
| The whole Hell shelf, its attractions and the Fire-Eater | ~167,700 | ~90 |

The important buys arrive in about ten nights per tier. Owning everything is a long tail, by design: the new core
ranks add to it, the higher payouts and new achievements offset part of it. If players report a grind, the cheapest fix
is the conditional perks' prices (Soul Collector, Second Wind, Final Act), which are optional by nature.

## 5. Exploits and multiplayer currency (code review)

- **Who pays whom.** Each player is paid at their own Greed (D-85). The host sends each guest their own end-of-night
  stats once (`run_end`). The guest's client credits its own save once. Nothing is duplicated between players.
- **Disconnects.** A guest who drops before the night ends gets no `run_end`, so no payout, unless they rejoin before
  the end. Unchanged by D-103; a partial payout for dropped guests is a possible follow-up.
- **Repeated rewards.** Achievements pay once (`grantAchievements` credits only new ids). The new tier hidden-quest
  achievements are one-time too.
- **Farming lower tiers.** Normal pays the least per night, so there's no incentive to farm below your tier. Replaying
  Normal is still rewarded, normally.
- **Bosses.** Every night pays 50 × Greed per boss beaten, repeatably: legitimate play. Boss achievements pay once.
- **Saves.** Saves are local, so a determined player can edit theirs. That isn't defended against in a co-op game.
  Guests' perks, unlocks and characters are clamped to what a real save could hold before the host uses them.
