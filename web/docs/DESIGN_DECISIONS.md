# Design Decisions Log

Each entry: the gap or contradiction, the decision, and why. IDs are referenced from code comments (`D-xx`).

---

### D-01 · Ringmaster vs. Dawn timing
**Gap:** Ringmaster spawns at 24:00, a healthy fight is 75–120 s, but dawn is 25:00 and the GDD also says beating him is required.
**Decision:** Dawn **requires** the Ringmaster's defeat. While he lives, the clock **stalls at 24:59** — the HUD clock face cracks and the banner reads *"The Ringmaster holds back the dawn!"* His 120 s soft-enrage (Encore) still applies, so the stall cannot be abused.
- Defeated **before** 25:00 → *Victory Lap*: ambient spawns switch to a weak balloon flood with ×3 Tickets until 25:00, then the dawn sequence.
- Defeated **at/after** 25:00 → dawn sequence plays immediately (3 s grace).
**Why:** Keeps "beat the final boss to win" (pillar: the boss is the spectacle) and the 25-minute frame, and is never unfair — the player always gets the whole fight.

### D-02 · Difficulty tiers
| Tier | Enemy HP | Enemy dmg | Pop. cap | Greed bonus | Miniboss | Unlock |
|---|---|---|---|---|---|---|
| Midway | ×1.0 | ×1.0 | 180 | +0% | 75 s | default |
| Carnival | ×1.5 | ×1.25 | 280 | +30% | 65 s | defeat the Ferris Wheel (any tier) |
| Nightmare | ×2.2 | ×1.6 | 400 | +60% | 55 s, elites gain affixes | win on Carnival |
HP/damage from the Godot resources (newest tuning); caps from doc 03 §7.2 (newest text).
**Curse** (unlock: defeat the Puppet King): spawn interval ×0.8, cap +15% (≤400), enemy speed ×1.12, enemy HP ×1.2; rewards: XP ×1.1, Lost Tickets ×1.35.

### D-03 · Enemy numbers
Godot `.tres` values win over the bible where they differ (they were retuned against the 220 px/s player). Bible values fill fields the resources lack (e.g. Puppet Soldier formation).

### D-04 · No Gold / no Intermission Wagon
Per doc 03 pre-M5 update. The **Greed** stat (Coin Purse, meta perk, tier bonus) multiplies the Lost Ticket payout. Breakables drop food/tickets instead of gold.

### D-05 · Single Carnival Core map (4400 × 4400)
Godot's spatial reference kept: Big Top at center (the Tent sleeps there), Carousel west, Ticket Booth east, Prize Stand south-west, stalls south-east, the north fence with three gates, Ferris Wheel north-east. Additions: a south **plank promenade** along the sea wall (the old Boardwalk zone, folded in), concession row, ring-toss/milk-bottle stalls, Tilt-a-Whirl (hazard), Fun-House façade, broken coaster track, string lights between landmarks, wrought-iron perimeter fence, and the sea along the south edge.

### D-06 · Reward chests
VS-style N rolls to equipped items (boss 4–6, miniboss 1–7 → we clamp miniboss to 1–3 for readability of the reveal). **If an evolution is ready it is always the first roll.** Chests are opened with a short reveal animation (slot-machine style) that lists each upgrade.

### D-07 · Grand Menagerie (missing evolution)
**Top Hat Lv8 + Strongman Belt → Grand Menagerie.** The hat becomes a full three-ring troupe: a **lion** (pounces, high single-target), an **elephant** (slow, stomps AoE + knockback), and **acrobat clowns** (fast, multi-hit). Distinct from Nightmare Menagerie (a swarm of identical plush pets). Strongman Belt fits the "Ringleader's strongman act" fantasy and the Ringleader's Might-inheritance quirk.

### D-08 · Extra Token
5 levels; +1 Amount at levels 1, 3 and 5. Weighted rarer (base weight 0.6).

### D-09 · Evolution prerequisites
Evolution eligible when the weapon is Lv8 and its passive is owned at ≥ Lv1. A passive may gate several evolutions. Full table lives in `src/data/weapons.ts`; a unit test asserts every evolution's chain is reachable (weapon draftable/unlockable, passive draftable/unlockable, slot rules allow both).

### D-10 · Fortune Teller "sees next draft rarity"
Always gets **4 draft cards** and the XP bar shows the rarity ribbon of the best card in the *next* draft (pre-rolled).

### D-11 · Lost Child "balloon economy"
Base HP 60. Holds a **Balloon Shield** that absorbs one hit entirely and regrows after 20 s (cooldown scales with the Cooldown stat). Starts the run with +1 revive ("the revive balloon"). Glass-cannon summoner-adjacent kit: Plush Companion damage +20%.

### D-12 · Performance target
Measured against Nightmare cap (400) + boss + ~600 projectiles at 60 fps. Old 600-enemy benchmark dropped.

### D-13 · Characters
| Character | HP | Speed | Identity | Quirk | Unlock |
|---|---|---|---|---|---|
| Carny | 100 | 220 | Balanced | +10% XP | default |
| Strongman | 150 | 187 | Tank/melee | Shoves nearby enemies when hit; +1 armor | default |
| Fortune Teller | 75 | 220 | Glass cannon | +25% Might, +10% crit, 4 draft cards | reach 12:00 once, then 150 LT |
| Ride Operator | 100 | 264 | Mobility/area | +10% area; while moving leaves a damaging spark trail | defeat Ferris Wheel, then 250 LT |
| Lost Child | 60 | 230 | Fragile | Balloon Shield + revive balloon; plush +20% | defeat Puppet King, then 350 LT |
| Ringleader | 90 | 215 | Summoner | Summons inherit +40% Might; non-summon weapons −15% | defeat Ringmaster, then 500 LT |

### D-14 · Invulnerability frames
After any hit the player is invulnerable for 0.45 s (strobe red/white). Contact damage per enemy is otherwise continuous. Bosses' telegraphed zones respect i-frames too. Keeps crowd damage legible ("I got hit, I have a beat to escape").

### D-15 · Draft QoL
Rerolls / Banishes come from Lost & Found perks (0 at start; up to 3 each per run). **Skip** is a one-time Lost & Found unlock (unlimited use) and heals 10 HP. Banish removes that option for the rest of the run.
Rarity ribbons: Common (weight band ≥1.0), Uncommon (new passive/weapon with weight <1.0), Rare (Lv7→8 / capstone), Evolution (gold). Luck increases the chance of a 4th card: `p = clamp((luck-1)·0.5, 0, 0.5)`.

### D-16 · Events schedule
One carnival event every 70–100 s, never during a boss fight or the 30 s before a gate. Weighted by Act (see `src/data/events.ts`). Banner + sting announce each. Authored timeline events (e.g. Clown Pack @ 8:00, Formation @ 15:00, Calliope Crescendo @ 21:00) fire at their times.

### D-17 · Endless / Lock-In
Offered on the dawn screen. Lost Tickets for the win are banked immediately. In Lock-In, the clock runs on past 25:00; every minute beyond adds +12% HP / +6% dmg; the Act IV wave mix loops with denser caps; every 5 minutes an **Encore Ringmaster** (40% HP, Phase 3 moveset) appears. Death pays a bonus `floor(extra_seconds / 4)` LT.

### D-18 · Daily Run
Seed = UTC date (YYYYMMDD). Character, tier (Carnival) and one modifier are derived from the seed; all characters are playable in the Daily regardless of unlocks. Score = kills + 10·level + 500·bosses + seconds survived + 2000·win. Best score per date stored locally. No online leaderboard (none exists).

### D-19 · Status effects
- **Slow**: multiplicative speed factor, strongest wins.
- **Chill/Freeze** (Snow-Cone): each hit adds a chill stack (−8% speed each); at 5 stacks → frozen 1.2 s (bosses: chilled only, no freeze); frozen enemies take +25% damage; Blizzard: frozen enemies shatter for AoE on death.
- **Burn** (Hot-Dog Grill, Hellfire): DoT 1/s ticks for 3 s, refreshes.
- **Sticky** (Cotton-Candy): slow 40% + DoT.

### D-20 · Manual / hybrid aim
Settings → Aim: **Auto** (default), **Hybrid** (directional weapons — cards, darts, cannon, cones — fire toward the mouse/right-stick when it is held/moved, else auto), **Manual** (directional weapons always aim at the cursor/stick). Orbit/around/summon weapons are unaffected.

### D-21 · Achievements
16 local achievements (e.g. *First Night*, *Ringmaster's Bane*, *Evolutionist*, *Pacifist Minute*, *Full House* — all evolutions) each paying Lost Tickets once.

### D-22 · Meta perks (Lost & Found)
Max HP (+6%/lvl, 5), Might (+5%, 5), Move Speed (+4%, 4), Pickup (+10%, 4), Luck (+5%, 4), Greed (+8%, 5), Armor (+1, 2), Revive (+1, 1), Reroll (+1, 3), Banish (+1, 3), Skip (unlock). Costs escalate ×1.5–2.0. Total combat power ≈ 2–3 good draft picks (doc 01 §9 guardrail).
Unlockable draft content (one-time purchases): Crystal Orbs, Laser Light Show, Funhouse Mirror, Carnival Cannon, Strongman Bell, Rabbit's Foot, Season Pass, Coin Purse.

### D-23 · Tutorial / onboarding
First run shows contextual one-line coach marks (move, auto-fire, collect tickets, level-up draft, boss warning), each shown once and dismissable; can be reset in Settings.

### D-24 · Bosses never stack
If a boss is still alive when the next gate arrives, the next boss (and its 3 s warning) is held until the current one falls. The clock keeps running, so a slow kill shortens the next Act's build-up — pressure without an unreadable double-boss.

### D-25 · Cones aim at the nearest enemy
Doc 06 lists Cotton-Candy / Snow-Cone / Hot-Dog as `forward` (movement direction). Pure forward cones felt bad in testing because kiting means facing away from the crowd. They now aim at the nearest enemy in range (falling back to facing), and respect Manual/Hybrid aim (D-20).

### D-26 · Chest economy
Miniboss (Carnival Brute) chests roll **1** upgrade (Godot: 1–7) and elites drop a 1-roll chest 8% of the time (doc: ~25%). Accelerated runs showed evolutions arriving by 5:30 with the generous values, collapsing the build arc; with these values the first evolution lands around 9–12 minutes for a focused build.
