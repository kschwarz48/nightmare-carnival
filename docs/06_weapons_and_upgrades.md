# 06 · Weapons, Passives & Upgrades

This is the **build-craft layer** — the heart of the game (pillar #3). Weapons auto-fire; passives modify stats; the level-up draft is where the run is won or lost; evolutions are the payoff. All content is data-driven (`WeaponData`, `PassiveData`, `UpgradeData`, `EvolutionData` resources — see `08_core_systems_implementation.md`).

---

## 1. Core rules

- **Loadout caps:** **6 active weapons + 6 passive items** per run (classic survivors economy). Forces choices and enables evolutions (which free up… nothing — they replace the base weapon in its slot).
- **Weapon levels:** each weapon levels **1 → 8**. Level-ups add projectiles, damage, area, pierce, or cut cooldown (per-weapon table). A maxed (Lv8) weapon is **evolution-eligible**.
- **Auto-fire + optional aim:** weapons fire automatically on cooldown. Targeting per weapon (`aim_mode` in `WeaponData`): `auto_nearest`, `auto_random`, `forward` (facing/movement dir), `orbit`, `around` (self-centered AoE), `manual` (mouse/right-stick — opt-in accessibility/skill layer, doc 01 §12).
- **Damage:** `weapon.base_damage × player.might × (crit ? crit_damage : 1)`, modified by area/duration where relevant; defender applies armor. Full formula in doc 08.
- **Scaling stats** (Might, Area, Cooldown, Duration, Amount, Proj Speed, Crit, Luck) come from passives + level-ups + meta + character, and multiply weapon output. A weapon and a passive that feed the same axis = synergy.

---

## 2. Active weapons

Base values are Lv1 at 100% stats. "Scales with" lists which player stats amplify it. Each weapon's full 8-level curve lives in its `WeaponData` resource; the **Lv8 → Evolution** column shows the required passive.

### Signature (character-starter) weapons

| Weapon | Fire pattern | Base dmg | Cooldown | Aim | Scales with | Lv8 + passive → Evolution |
|--------|--------------|---------:|---------:|-----|-------------|---------------------------|
| **Throwing Cards** (Carny) | Fan of 1→ cards thrown forward, low pierce | 10 | 1.1s | auto_nearest | Might, Amount, Proj Spd, Crit | + **Lucky Ticket** → *Royal Flush* |
| **Whack-a-Mole Mallet** (Strongman) | Melee arc swing around player | 22 | 1.3s | around | Might, Area, Cooldown | + **Energy Drink** → *Whack Frenzy* |
| **Tarot Toss** (Fortune Teller) | Homing tarot cards seek targets | 12 | 1.2s | auto_random (homing) | Might, Crit, Amount | + **Spectacles** → *The Death Card* |
| **Bumper Car** (Ride Operator) | Periodic dash-ram in move dir; trail | 18 | 2.2s | forward | Might, Area, Move Spd | + **Running Shoes** → *Demolition Derby* |
| **Plush Companion** (Lost Child) | Orbiting pet auto-bites nearest | 8 | 0.8s | orbit→pounce | Might, Amount, Duration | + **Sugar Rush** → *Nightmare Menagerie* |
| **Top Hat** (Ringleader) | Summons mini-helper that fights for you | 9 | summon | summon | Might, Amount, Duration | + **Strongman Belt** → *Grand Menagerie* |

### Draftable weapons (carnival arsenal)

| Weapon | Fire pattern | Base dmg | Cooldown | Aim | Scales with | Lv8 + passive → Evolution |
|--------|--------------|---------:|---------:|-----|-------------|---------------------------|
| **Popcorn Popper** | Lobs kernels that land + **pop into AoE** burst | 8 (pop 12) | 1.4s | auto_random (lob) | Might, Area, Amount | + **Foam Finger** → *Kettle-Korn Cannon* |
| **Balloon Darts** | Fast piercing darts; **pop into shrapnel** at end of range | 11 | 1.0s | auto_nearest | Might, Pierce(Amount), Proj Spd | + **Spectacles** → *Sharpshooter's Bouquet* |
| **Fireworks** | Random arcing rockets → **big AoE explosion** | 20 | 1.8s | auto_random | Might, Area, Amount | + **Extra Token** → *Grand Finale* |
| **Cotton-Candy Gun** | Sticky cone: **slows + DoT** | 4/tick | 0.9s | forward (cone) | Might, Area, Duration | + **Spinning Top** → *Sticky Situation* |
| **Ring Toss** | Boomerang rings out-and-back, pierce | 13 | 1.5s | forward | Might, Area, Duration | + **Strongman Belt** → *Saturn's Rings* |
| **Carnival Cannon** | Big single **human-cannonball** line shot, heavy knockback | 40 | 2.6s | auto_nearest | Might, Proj Spd, Crit | + **Energy Drink** → *Cannonball Special* |
| **Snow-Cone Machine** | Frost cone: **chill → freeze** at stacks | 6 | 1.2s | forward (cone) | Might, Area, Duration | + **Caffeine** → *Blizzard Machine* |
| **Hot-Dog Grill** | Flamethrower cone, **burning DoT** | 5/tick | 0.8s | forward (cone) | Might, Area, Duration | + **Strongman Belt** → *Inferno Grill* |
| **Laser Light Show** | Rotating **sweeping beams** from player | 7/tick | beam | orbit | Might, Area, Duration | + **Spinning Top** → *Grand Illumination* |
| **Crystal Orbs** (Magic 8-Ball) | Orbiting orbs that block/hit | 10 | orbit | orbit | Might, Amount, Area, Duration | + **Foam Finger** → *Cosmic Convergence* |
| **Strongman Bell** | Overhead slam → **shockwave ring** | 16 | 1.7s | around | Might, Area | + **Lucky Ticket** → *High Striker* |
| **Funhouse Mirror** | Spawns a **clone** that re-fires your last shots | mirrors | 3.0s | special | Amount, Duration | + **Season Pass** → *Hall of Mirrors* |

> **Design intent per weapon = a distinct *shape of fire*:** forward fan, around-self, orbit, lob-AoE, pierce-line, cone-DoT, big-single, boomerang, summon, clone. Drafting variety should always feel mechanically different, not just "more damage."

### Generic per-level scaling template
Most weapons follow a rhythm like this (tune per weapon in its resource):

| Level | Typical gain |
|------:|--------------|
| 1 | base |
| 2 | +1 projectile / +target |
| 3 | +damage (~+25% of base) |
| 4 | −cooldown (~−15%) or +area |
| 5 | +1 projectile / +pierce |
| 6 | +damage or +duration |
| 7 | −cooldown / +area |
| 8 | capstone (+1 projectile **and** +damage) → **evolution-eligible** |

---

## 3. Passive items

Passives are global stat multipliers/additives. They power your weapons *and* gate evolutions. Levels 1→5 (tune curve in `PassiveData`).

| Passive | Effect (per level) | Stat axis | Notes |
|---------|--------------------|-----------|-------|
| **Strongman Belt** | +10% Might | Might | Universal damage; evolution key for several. |
| **Energy Drink** | −8% Cooldown (attack speed) | Cooldown | More fire = more everything. |
| **Spectacles** | +5% Crit chance, +0.2× Crit dmg | Crit | Crit-build cornerstone. |
| **Foam Finger** | +12% Area | Area | AoE/cone builds love it. |
| **Extra Token** | +1 Amount (projectiles/targets) every 2 lvls | Amount | Scarce; very strong. |
| **Spinning Top** | +12% Duration | Duration | Zones/orbits/DoT. |
| **Caffeine** | +15% Projectile speed | Proj Spd | Reach + hit-rate. |
| **Running Shoes** | +8% Move speed | Move | The survival stat. |
| **Sugar Rush (Cotton Candy)** | +12% Max HP | Max HP | Survivability. |
| **Funnel Cake** | +0.4 HP regen/s | Regen | Sustain. |
| **Safety Goggles** | +1 Armor | Armor | Flat mitigation; great early. |
| **Magnet Glove** | +25% Pickup radius | Pickup | QoL + tempo (faster Tickets). |
| **Lucky Ticket** | +10% Luck | Luck | Better drafts/drops/crit rerolls. |
| **Season Pass** | +10% XP gain | XP | Snowballs levels (greedy). |
| **Coin Purse** | +15% Greed (Gold & Lost Tickets) | Greed | Economy/meta. |
| **Rabbit's Foot** | +1 Revive (max ~2) | Revive | Rare; clutch insurance. |

---

## 4. The level-up draft

The signature decision moment (UI is the centerpiece, doc 02 §8).

- On level-up, time **slows/pauses** and the player is offered **3 choices** (4 with high Luck / Fortune Teller), drawn from: new weapons (if slots free), weapon level-ups, new passives (if slots free), passive level-ups. Plus utility cards that can appear: **Heal**, **Gold**, **Reroll** (if owned), **Banish** (remove an option from the pool).
- **Rarity** (ribbon color, weighted by Luck): Common → Uncommon → Rare → Evolution-Ready (gold). Higher rarity = bigger jumps / evolution offers.
- **Pity & relevance:** weight offers toward the player's existing build a little (so builds can come together) but always include at least one "branch" option (so builds can pivot). Never offer a full slot's worth of dead options.
- **Banish / Reroll / Skip** are unlockable QoL (meta) that massively improve build agency — high priority post-MVP.

**Offer-generation algorithm (summary, see doc 08):** build a weighted pool of all legal upgrades (respecting slot caps and max levels), bias by Luck + light build-relevance, sample N distinct, guarantee an evolution card when prerequisites are met, present.

---

## 5. Evolutions

The dopamine peak. When a weapon is **Lv8** and its **required passive** is owned (≥ a threshold level, default ≥1), an **Evolution card** becomes eligible in the draft (or is granted via the next Boss Chest — designer's choice; recommend: **offered in draft**, guaranteed in late Boss Chests). Evolving **consumes the base weapon's slot** and replaces it with a dramatically stronger version.

| Evolution | = Weapon (Lv8) | + Passive | What it becomes |
|-----------|----------------|-----------|-----------------|
| **Royal Flush** | Throwing Cards | Lucky Ticket | A 52-card storm — cards spiral the whole screen, high crit, pierce-all. |
| **Whack Frenzy** | Mallet | Energy Drink | Continuous whirlwind of mallet-smashes around you. |
| **The Death Card** | Tarot Toss | Spectacles | Slow homing nukes that crit for massive single-target. |
| **Demolition Derby** | Bumper Car | Running Shoes | Permanent ramming aura while moving; pinball off enemies. |
| **Nightmare Menagerie** | Plush Companion | Sugar Rush | A pack of plush pets swarms for you. |
| **Kettle-Korn Cannon** | Popcorn Popper | Foam Finger | A constantly-popping field of kettle corn blankets the area. |
| **Sharpshooter's Bouquet** | Balloon Darts | Spectacles | Crit dart volleys that burst into shrapnel flowers. |
| **Grand Finale** | Fireworks | Extra Token | A relentless screen-clearing fireworks barrage (the iconic late build). |
| **Sticky Situation** | Cotton-Candy Gun | Spinning Top | Persistent slowing candy-web fields that tick heavy DoT. |
| **Saturn's Rings** | Ring Toss | Strongman Belt | Giant slow orbiting rings shred everything around you. |
| **Cannonball Special** | Carnival Cannon | Energy Drink | Rapid-fire human cannonballs, piercing knockback lines. |
| **Blizzard Machine** | Snow-Cone | Caffeine | A wide freezing storm; frozen enemies shatter for bonus dmg. |
| **Inferno Grill** | Hot-Dog Grill | Strongman Belt | A roaring wide flame-wave; heavy burning ground. |
| **Grand Illumination** | Laser Light Show | Spinning Top | Many long rotating beams — a light-show death carousel. |
| **Cosmic Convergence** | Crystal Orbs | Foam Finger | Huge orbiting orbs + a gravity pulse that clusters enemies. |
| **High Striker** | Strongman Bell | Lucky Ticket | Giant slams with random huge-crit "ring the bell" jackpots. |
| **Hall of Mirrors** | Funhouse Mirror | Season Pass | Multiple clones mirror your entire loadout. |

---

## 6. Build archetypes (synergy guidance for tuning)

Tuning goal: several *distinct* viable build paths, each with a fantasy:

- **High Roller (Crit):** Throwing/Tarot Cards + Spectacles + Lucky Ticket → *Royal Flush* / *Death Card*. Big yellow crit numbers; spiky single-target + screen storms.
- **Pyrotechnician (AoE burst):** Fireworks + Popcorn + Foam Finger + Extra Token → *Grand Finale* + *Kettle-Korn*. The screen-filling power fantasy.
- **Confectioner (Zone/DoT control):** Cotton Candy + Hot Dog + Snow Cone + Spinning Top → *Sticky Situation* / *Inferno* / *Blizzard*. Paint the floor, walk through melting crowds.
- **Carousel (Orbit/defensive):** Ring Toss + Crystal Orbs + Laser + Spinning Top → *Saturn's Rings* / *Cosmic* / *Grand Illumination*. A spinning fortress of death.
- **Ringleader (Summoner):** Top Hat + Plush + Funhouse Mirror + Amount/Duration → *Menagerie* / *Hall of Mirrors*. An army fights for you.
- **Daredevil (Mobility):** Bumper Car + Running Shoes + Cannon → *Demolition Derby*. Dash through everything; positioning as offense.

Each archetype should be able to **clear the Ringmaster** if assembled well; none should trivialize Act I. Balance by tuning resource curves, not by nerfing fun.

---

## 7. Example `WeaponData` (data-driven authoring)

```gdscript
# res://resources/weapons/fireworks.tres  (conceptual)
[resource]
script = ExtResource("WeaponData.gd")
id = "fireworks"
display_name = "Fireworks"
description = "Launches rockets that explode in a dazzling, deadly burst."
aim_mode = "auto_random"
style = "projectile"
base_damage = 20.0
base_cooldown = 1.8
base_area = 1.0           # AoE radius multiplier
base_amount = 1           # rockets per volley
projectile_scene = ExtResource("firework_rocket.tscn")
max_level = 8
# per-level deltas (parallel arrays or a sub-resource list)
level_damage   = [0, 0, 6, 0, 0, 8, 0, 12]
level_amount   = [0, 1, 0, 0, 1, 0, 1, 1]
level_cooldown = [0, 0, 0, -0.25, 0, 0, -0.25, 0]
level_area     = [0, 0, 0, 0.15, 0, 0.15, 0, 0.2]
evolution = ExtResource("evolution_grand_finale.tres")
required_passive = "extra_token"
icon = ExtResource("ui/icons/fireworks.png")
```

> Cross-references: weapon/projectile/level-up/draft/evolution **code** → `08_core_systems_implementation.md` · stat model & economy → `01_game_design_document.md §7–8` · characters' starting weapons → `01 §6` · UI for the draft → `02_art_direction.md §8`.
