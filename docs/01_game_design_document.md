# 01 · Game Design Document

**Working title:** Nightmare Carnival
**Alt titles to consider:** *Midnight Midway*, *Last Call at the Carnival*, *Dawnless*, *Step Right Up*
**Genre:** Survivors-like (bullet-heaven) roguelite
**Engine:** Godot 4.7 · **View:** Top-down 2D · **Session length:** one ~25-minute run

---

## 1. High concept

You wandered onto the boardwalk just before midnight. The gates clanged shut. Now the carnival is awake — and it's *hungry*. Balloons gnash, monkeys wind themselves up and charge, the Ferris Wheel tears itself off its axle to roll you flat. Survive from midnight until **dawn (25:00)**, collect **tickets** to grow stronger, and assemble a deranged loadout of carnival weaponry powerful enough to put the whole midway back to sleep.

The core fantasy: **trapped in a carnival at midnight, turning the carnival's own attractions into an escalating power fantasy until you're the scariest thing on the boardwalk.**

---

## 2. Design pillars

1. **The carnival is the monster.** Every threat is a personified attraction — never a generic monster. The art and the design both sell "this place is alive and it hates you."
2. **Readable chaos.** Bullet-heaven density, but the player can always read the screen via strong silhouettes, color-coded threats, and disciplined telegraphs.
3. **Build-craft is the game.** Moment-to-moment is dodging and positioning; the *run* is about discovering and assembling a broken weapon + passive combo. Evolutions are the dopamine peak.
4. **Cartoon horror.** 1930s rubber-hose ("Cuphead") charm crossed with midnight menace. Funny and threatening at once. Stylized, not gory.
5. **One more night.** Death is never wasted — tickets and unlocks carry forward via the Lost & Found meta-progression. The loop begs for another run.

---

## 3. Audience, platform, comparables

- **Audience:** fans of Vampire Survivors, Brotato, Halls of Torment, 20 Minutes Till Dawn; players who like build experimentation and short, repeatable sessions; fans of stylized cartoon horror.
- **Primary platform:** PC (Steam) with keyboard/mouse **and** full gamepad support. Designed to port cleanly to Switch-class handhelds (keep the entity budget honest — see §11).
- **Comparables & what we borrow:**
  - *Vampire Survivors* — auto-firing weapons, level-up draft, evolutions, 20+ min runs.
  - *Brotato* — tight stat economy, shop between waves (we adapt this as the **Intermission Wagon**).
  - *Cuphead* — visual identity and boss-as-spectacle design.
  - *20 Minutes Till Dawn* — manual aiming option and tense single-night framing.

**Our wedge:** the personified-carnival theme done thoroughly (bosses are *the rides*), plus a manual-aim option layered on top of survivors-like auto-fire for players who want more agency.

---

## 4. Core loop

```
        ┌──────────────────────────────────────────────────────┐
        │                     META LOOP                         │
        │  Title → Lost & Found (spend Lost Tickets on perks)   │
        │  → pick Character → pick Difficulty → START RUN       │
        └───────────────┬──────────────────────────────────────┘
                        ▼
        ┌──────────────────────────────────────────────────────┐
        │                      RUN LOOP (~25 min)               │
        │                                                       │
        │   move + dodge  ──►  weapons auto-fire  ──►  kill     │
        │        ▲                                      │       │
        │        │                                      ▼       │
        │   spend levels   ◄── LEVEL UP draft  ◄──  collect     │
        │   (new weapon /        (choose 1 of 3-4)   Tickets    │
        │    upgrade)                                  (XP)      │
        │                                                       │
        │   every 6 min ──► BOSS ──► reward chest               │
        │   survive to 25:00 (dawn) ──► WIN                     │
        │   HP hits 0 ──► death ──► payout Lost Tickets         │
        └──────────────────────────────────────────────────────┘
```

The **second-to-second** verb is *move* (dodging). The **minute-to-minute** decision is the *level-up draft*. The **run-to-run** progression is the *Lost & Found*. All three loops must each feel good in isolation.

---

## 5. The night: run structure & timeline

A run is a single night on the boardwalk, **25 minutes**, played on one continuous connected map (three zones — see `03_map_and_level_design.md`). Difficulty scales with **time elapsed**, not player location, so there's nowhere truly safe to hide.

The night is paced in four **Acts**, each ending with a ride-boss. Bosses appear at fixed time gates; surviving past one ratchets the spawn tables to the next Act.

| Time | Act | Theme & headline enemies | Boss at end of act |
|------|-----|--------------------------|--------------------|
| 0:00 – 6:00 | **Act I — Warm-Up** | Living Balloons, Wind-Up Monkeys. Teaching the basics, build seeding. | **6:00 — The Carnival Tent** |
| 6:00 – 12:00 | **Act II — The Crowd** | Possessed Stuffies, Evil Clowns, Dunk-Tank Clowns. Density ramps. | **12:00 — The Ferris Wheel** |
| 12:00 – 18:00 | **Act III — The Parade** | Puppet Soldiers, Carousel Horses, Walking Ticket Booths. Ranged + chargers. | **18:00 — The Puppet King** |
| 18:00 – 25:00 | **Act IV — Last Call** | Roller-Coaster Snakes + everything prior, elite variants, swarm peaks. | **24:00 — The Ringmaster** (final) |
| 25:00 | **DAWN** | Gates open. Run won. | — |

After the Ringmaster falls at 24:00, the final minute is a **victory lap** (huge XP, the screen floods with weak enemies to mow down) leading into the **Dawn** win screen at 25:00. Players who want more can toggle **Endless / "Lock-In"** mode (see §10).

**Boss cadence rationale:** ~6 minutes between bosses gives players two-to-three level-ups of build growth between spectacles, so each boss feels like a check on the build's current power.

---

## 6. Playable characters

Characters are unlocked via the Lost & Found. Each has a **signature starting weapon**, a **stat identity**, and a **passive quirk**. Numbers are baselines; tune in `06_weapons_and_upgrades.md` data tables.

| Character | Unlock | Starting weapon | Identity | Passive quirk |
|-----------|--------|-----------------|----------|---------------|
| **The Carny** (starter) | Default | Throwing Cards | Balanced all-rounder | +10% XP gain — "knows the games" |
| **The Strongman** | Default | Whack-a-Mole Mallet | Tanky melee; +50% max HP, −15% move speed | Knockback on hit |
| **The Fortune Teller** | Reach 12:00 once | Tarot Toss (homing cards) | Glass-cannon caster; +25% damage, −25% HP | +crit chance, sees next draft rarity |
| **The Ride Operator** | Beat the Ferris Wheel | Bumper Car (dash-ram) | Speed & area; +20% move, +area | Dash leaves a damaging spark trail |
| **The Lost Child** | Beat the Puppet King | Plush Companion (auto-pet) | High risk: 1 HP-ish "balloon shield" economy | Starts with a revive balloon; fragile |
| **The Ringleader** | Beat the Ringmaster | Top Hat (summons mini-helpers) | Summoner; weaker base weapons, strong minions | Minions inherit % of your might |

**Design note:** keep starting weapons mechanically distinct (projectile, melee, dash, orbit, summon) so the *opening minute* feels different per character even before the build diverges.

---

## 7. Player stats model

All player stats derive from a base profile modified by level-up upgrades, passives, and meta perks. Implemented as a `PlayerStats` resource (see `08_core_systems_implementation.md`).

| Stat | Base | Notes |
|------|------|-------|
| Max HP | 100 | Death at 0. |
| HP Regen | 0.0 /s | Granted by items (Funnel Cake). |
| Move Speed | 110 px/s | The most-felt stat; tune carefully. |
| Might (damage %) | 100% | Global outgoing damage multiplier. |
| Attack Speed / Cooldown | 100% | Lower cooldowns = more fire. |
| Area | 100% | Scales weapon AoE & projectile size. |
| Projectile Speed | 100% | |
| Duration | 100% | How long effects/projectiles persist. |
| Amount | +0 | Extra projectiles/targets. |
| Pickup Radius (Magnet) | 60 px | How close tickets auto-collect. |
| Luck | 100% | Affects draft rarity, drop rolls, crit re-rolls. |
| Crit Chance / Crit Damage | 5% / ×2.0 | |
| Armor | 0 | Flat damage reduction per hit (min 1 dmg). |
| Revives | 0 | Auto-revive on death (Rabbit's Foot). |
| Greed (currency %) | 100% | Bonus tickets/gold. |

**Damage formula (per hit):**
`final = base_weapon_damage × might × (crit ? crit_damage : 1) × area_or_tick_modifiers`
then defender applies `max(1, final − armor)`. Full formula and crit handling in doc 08.

---

## 8. Economy & currencies

- **Tickets (XP):** dropped by enemies as glowing ticket-stubs. Auto-collected within pickup radius, fly to the player, fill the XP bar. Levels grant a **draft**. *In-run only — Tickets do not persist.*
- **Gold / Coins:** dropped occasionally and from breakables (popcorn carts, prize stands). Spent at the **Intermission Wagon** (a roaming shop that appears ~once per Act) on rerolls, heals, and items. *In-run only.*
- **Lost Tickets (meta currency):** awarded at the **end of every run** (win or lose), scaled by survival time, bosses killed, and enemies defeated. Spent in the **Lost & Found** on permanent unlocks/upgrades. *Persists forever.*

**Payout formula (end of run):**
`Lost Tickets = floor( seconds_survived / 6 ) + (50 × bosses_killed) + floor( enemies_killed / 25 ) + win_bonus(100)`
times `Greed`. Tune the divisors so a full clear yields a satisfying, but not trivializing, ~400–600.

---

## 9. Meta-progression — the "Lost & Found"

Between runs, the player visits the **Lost & Found** booth (the meta hub) and spends **Lost Tickets**. Three tracks:

1. **Permanent stat perks** (repeatable, escalating cost): +Max HP, +Might, +Move Speed, +Luck, +Greed, +Pickup Radius, +1 starting Revive, etc. Caps per perk so meta can't fully eclipse in-run choices.
2. **Unlocks** (one-time): new characters, new weapons/passives entering the draft pool, new map zones/events, higher difficulty tiers, cosmetic palettes.
3. **Collection / Carnival-pedia:** an in-fiction "midway map" that fills in as you discover enemies, bosses, weapons, and evolutions. Completing sets grants bonus Lost Tickets and lore.

**Guardrail:** meta perks should feel like a *head start*, not a *win button*. Total meta power budget ≈ the strength of two-to-three good in-run upgrades. The run's drafts must remain the dominant source of power so skill/build decisions stay meaningful.

---

## 10. Difficulty & modes

- **Difficulty tiers** (unlockable: Midway → Carnival → Nightmare → Endless Night): each raises enemy HP/damage/spawn-rate multipliers and the global time-scaling curve, and adds elite modifiers. Higher tiers grant a Greed bonus.
- **Curse (optional in-run risk dial):** a meta-style toggle that increases spawn rate, enemy speed, and quantity for greater Tickets/Lost Tickets — borrowed from VS's "Curse." Lets confident players self-escalate.
- **Endless / "Lock-In":** after winning at 25:00, choose to stay. Enemy multipliers keep climbing indefinitely; the goal becomes a high score. The Ringmaster may re-appear as escalating "encore" elites.
- **Daily Run (post-launch):** fixed seed, fixed character, leaderboard.

**Time-scaling curve (reference):** enemy HP and spawn count scale roughly as `1 + 0.06 × minutes` (linear-ish early) transitioning to steeper growth in Act IV. Exact curve and per-tier multipliers live in `03_map_and_level_design.md` (spawn director) and are data-driven.

---

## 11. Win / lose & failure feel

- **Win:** survive to 25:00 (Dawn) — i.e., outlast the Ringmaster and the victory lap. Win screen tallies kills, level, build, and Lost Tickets earned. Offers Endless continuation.
- **Lose:** HP reaches 0 with no Revives left. **Death is fast but not punishing** — immediate payout screen, immediate "Run Again" button (re-using the last character/difficulty in one click). Target: from death to next run's first enemy in under 8 seconds.
- **Failure feel:** runs should usually fail to a *legible* cause ("I got greedy near the Ferris Wheel," "my build had no AoE"), never to unreadable chaos. This is a direct consequence of pillar #2.

---

## 12. Accessibility & options (plan from day one)

- **Aim modes:** Auto-aim (classic survivors), Manual aim (mouse/right-stick) per-weapon where it makes sense, or hybrid.
- **Damage/threat readability:** colorblind-safe enemy/telegraph palettes; "high-contrast telegraph" toggle; optional screen-shake and flash reduction.
- **Difficulty assists:** adjustable HP/damage-taken multipliers separate from the score-affecting tiers; pause-anytime.
- **Input:** full remapping, gamepad-first UI navigation, one-handed presets.
- **Text:** scalable UI/font size; dyslexia-friendly font option.

---

## 13. Scope guidance — MVP vs. full vision

To avoid the classic carnival-of-scope-creep, build in this order (full detail in `09_build_roadmap.md`):

- **MVP (vertical slice):** 1 character (The Carny), 1 zone (main carnival), 3 enemies (Balloon, Monkey, Stuffie), 1 boss (Carnival Tent), 4 weapons + 4 passives + 1 evolution, full core loop (move → kill → ticket → draft → boss → payout), basic Lost & Found with 3 perks. **This proves the game is fun.**
- **Content build-out:** remaining zones, all 8 enemy families, all 4 bosses, full weapon/passive/evolution roster, all 6 characters, full meta.
- **Polish & ship:** juice, audio, options, balance passes, Steam plumbing, Endless/Daily.

**The cardinal rule:** the MVP must be *fun with programmer art* before a single piece of final art is commissioned. If the Carny-vs-Tent slice isn't fun, more content won't fix it.

---

## 14. Open questions / decisions to lock later

- Manual-aim: per-weapon opt-in, or a global character trait? (Lean: per-weapon flag in `WeaponData`.)
- Intermission Wagon shop — full Brotato-style shop, or lightweight (reroll + heal + 1 item)? (Lean: lightweight for MVP.)
- Map traversal — single seamless map vs. zone "gates" the player chooses to push through. (Lean: seamless, with chokepoints as soft pressure — see doc 03.)
- Run length — 25 min vs. 20 min vs. 30 min. (Lean: 25; revisit after playtests.)

> Cross-references: enemies → `04_enemy_bible.md` · bosses → `05_boss_bible.md` · weapons/upgrades → `06_weapons_and_upgrades.md` · map & spawn pacing → `03_map_and_level_design.md` · implementation → `07` & `08`.
