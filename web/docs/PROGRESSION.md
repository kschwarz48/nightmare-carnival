# Progression & Economy

How Nightmare Carnival paces a night: XP and levels, Ticket value, chests, healing, Lost Tickets,
the upgrade-pool fallback, and spawn pacing. Every number below lives in **`src/data/progression.ts`**
(plus wave tables in `src/data/waves.ts` and difficulty tiers in `src/data/difficulty.ts`), so tuning
never requires touching simulation code. Design rationale: D-31, D-33, D-43 in `DESIGN_DECISIONS.md`.

## There is no mana system

The overhaul brief asked for a "mana/resource economy". The game has **no mana, energy or cooldown
resource** — weapons fire on their own timers, as in other survivors-likes — and none was added.
What it does have, and what was tuned instead:

| Resource | What it is | Where it's tuned |
|---|---|---|
| **Tickets** | Run XP, dropped by enemies, collected by walking near them | `TICKETS`, `XP_CURVE` |
| **Levels / drafts** | Each level opens a 3–4 card draft (weapons, passives, evolutions) | `XP_CURVE` |
| **Chests** | Multi-roll upgrades from bosses, Carnival Brutes, rare elites, events | `CHESTS`, `minibossInterval` |
| **Healing** | Food pickups, Funnel Cake passive, the 5% fallback | `HEALING` |
| **Lost Tickets (LT)** | Persistent meta currency: end-of-night payout, achievements, vouchers | `computePayout`, `VOUCHER` |
| **Rerolls / Banishes / Skip** | Per-run draft tools bought in the Lost & Found | `data/meta.ts` |

No published Vampire Survivors formula was copied or invented; the curve below follows the same
*principles* (cheap early levels, rising requirements, deliberate plateaus, value that keeps pace
with the run) and was then measured.

## XP curve

XP to go from level *L* to *L+1*:

| Band | Step per level | Examples |
|---|---|---|
| L1 → L2 | 5 (base) | L1: 5 |
| up to L10 | +5 | L5: 25, L10: 50 |
| up to L20 | +9 | L15: 95, L19: 131 |
| up to L40 | +16 | L30: 300, L39: 444 |
| up to L60 | +36 | L50: 820 |
| beyond L60 | +60 | |
| **Plateaus** | one level costs ×2 at **L20, L40, L60** | L20: 280, L40: 920 |

The plateaus sit where the first and third boss spikes land, giving each power jump room to breathe
before the next draft. (This supersedes the Godot `5 + 3L + L^1.6` curve that D-30 had restored.)

## Ticket value

An enemy drops `def.tickets × (1 + 0.012 × minutes)`, ×5 for elites. Tickets on the ground merge into
a Ticket Bank when there are too many. Multipliers: victory lap ×3, Endless ×1.5, post-boss recovery
×1.25, Calliope Crescendo event ×1.5 (`TICKETS`).

## Pacing (spawns)

* **Wave blending** — each wave's min/max population, spawn interval and batch size ramp toward the
  next wave over the back 55% of its window (`PACING.waveBlendStart = 0.45`), so density never steps.
* **Recovery periods** — when a boss falls, 24 s of breathing room: minimum population ×0.35 rising
  back to ×1, spawn interval ×2 easing to ×1, kills pay ×1.25, no balloon drifts for the first 16 s.
* **Spikes** — bosses (6:00, 12:00, 18:00, 24:00), Carnival Brutes (every 140/120/105 s by tier),
  elite bursts in later waves, carnival events.
* **Balloon drifts** (D-33) — minimum gap 20/18/16/14 s by Act plus an exponential extra
  (mean 16/14/12/10 s); group size skewed small; seeded.
* **Opening** — the first wave keeps ~22 balloons alive so every starting weapon finds early kills.

## Chests

| Source | Rolls | Cadence |
|---|---|---|
| Boss | 4–6 | 4 per night |
| Carnival Brute | 1–2 | every 140 s (Midway), 120 s (Carnival), 105 s (Nightmare) |
| Elite | 1 | 2% of elite kills |
| Events | 2 | when an event awards one |

Each chest is a prize-wheel show (D-34), so the target was ~10–15 per night (measured ~14).

## Healing

Food every 70–110 s in Act I down to 55–90 s in Act IV, healing 20% (min 20 HP); Funnel Cake passive
12%; the maxed-pool fallback 5% (`HEALING`).

## Upgrade-pool fallback and vouchers (D-31)

Only when nothing is left to draft: *Funnel Cake Crumbs* (5% max HP, capped) or a *Lost & Found
Voucher* worth `(6 + 0.25·min) × 0.9^taken × greed` LT (min 1), banked immediately, **120 LT cap per
run**, after which the card is shown disabled. A winning night pays roughly 900–1,200 LT, so vouchers
can add at most ~10–13%. Maxed-out chest rolls pay a voucher (or the 5% heal once capped).

## Measured (headless)

`npx vite-node scripts/progression.ts god 2` — every character, two seeds, god mode (isolates
progression from survival), smart pilot + draft policy from `tests/helpers.ts`:

| Character | 1st level | L@5m | L@10m | L@15m | L@20m | L@24m | Chests |
|---|---|---|---|---|---|---|---|
| Carny | 9.6 s | 16.0 | 35.0 | 40.5 | 44.5 | 51.5 | 22.5 |
| Strongman | 69.9 s* | 10.0 | 20.5 | 27.5 | 33.5 | 36.5 | 8.0 |
| Fortune Teller | 31.7 s | 13.0 | 26.5 | 41.5 | 46.5 | 67.5 | 16.0 |
| Ride Operator | 8.7 s | 13.0 | 23.0 | 29.0 | 38.0 | 59.0 | 16.0 |
| Lost Child | 24.7 s | 13.0 | 24.5 | 34.0 | 40.5 | 42.5 | 12.5 |
| Ringleader | 16.6 s | 15.5 | 28.5 | 36.5 | 42.0 | 52.0 | 9.0 |

\* The bot kites away from enemies, which starves the Strongman's melee mallet early; a human closes
in. Averages: ~L41 at 20:00 and ~L52 at 24:00 (the last minutes include the victory lap's ×3 tickets).
Balloon drifts averaged ~23 per night (one every ~45 s once they begin at 2:00).

Mortal sweep (`npx vite-node scripts/survival.ts midway`, three seeds per character, before the final
late-curve change): most bot runs ended between 6 and 9 minutes (around the first boss), the best
reached 16–25 minutes. One Ride Operator run reached level 106 by 24:50 under the previous curve, which
prompted the steeper post-40 bands and the L60 plateau.

## Honest uncertainty

* These numbers come from bots, not people. The pilot dodges by potential fields and cannot read
  telegraphs the way players do; the draft policy is simple. **Human playtesting is still the real
  test**, especially for early difficulty (deaths around 6:00 in mortal bot runs) and for melee
  starters.
* Strong area builds (the Ride Operator's spark trail) still out-level the rest late in a night;
  that is partly intended (build expression) but worth watching.
* Two seeds per character is a small sample; run `progression.ts god 5` for tighter averages.
