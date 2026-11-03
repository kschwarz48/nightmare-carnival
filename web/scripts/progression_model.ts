// The permanent-progression model (D-103, docs/LOST_AND_FOUND_ECONOMY.md): what each Lost & Found state adds against each
// world tier's creatures, what it costs, and what nights pay. Arithmetic, not a simulation (scripts/tier_balance.ts plays
// the nights); it answers "how much stronger" with explicit assumptions:
//   • offence = (1 + in-run Might 0.6 + permanent Might + conditional Might at its expected uptime) / cooldown multiplier
//               x (1 + half the Area bonus) / the tier's creature health;
//   • defence = Max HP multiplier x (1 + 8% per point of Armor) x (1 + 15% per HP/s of regeneration) / the tier's damage;
//   • both relative to a fresh player on Normal (1.00), and power = their geometric mean.
//   npx vite-node scripts/progression_model.ts [--before]   (--before: the shelves and payouts before D-103)
import { PERKS, ACHIEVEMENTS, computePayout } from '../src/data/meta';
import { TIERS, type TierId } from '../src/data/tiers';

const BEFORE = process.argv.includes('--before');
const NEW_PERKS = new Set(['nm_might', 'nm_cooldown', 'nm_hp', 'hell_might', 'hell_area', 'hell_armor']);
const perks = PERKS.filter((p) => !BEFORE || !NEW_PERKS.has(p.id));
const tierGreed = (t: TierId) => (BEFORE ? { normal: 0, nightmare: 0.5, hell: 1 }[t] : TIERS[t].greed);
const growth = (id: string, g: number) => (BEFORE && (id === 'unfinished_business' || id === 'infernal_resilience') ? 1.7 : g);

type Ranks = Record<string, number>;
const cap = (pred: (p: (typeof PERKS)[number]) => boolean): Ranks => Object.fromEntries(perks.filter(pred).map((p) => [p.id, p.cap]));
const normalFull = cap((p) => !p.tier);
const nmFull = { ...normalFull, ...cap((p) => p.tier === 'nightmare') };
const all = { ...nmFull, ...cap((p) => p.tier === 'hell') };
const has = (r: Ranks, id: string) => (perks.some((p) => p.id === id) ? r : { ...r, [id]: 0 });

const STATES: { tier: TierId; name: string; ranks: Ranks; bargain?: boolean }[] = [
  { tier: 'normal', name: 'fresh', ranks: {} },
  { tier: 'normal', name: 'partly upgraded', ranks: { max_hp: 2, might: 2, speed: 1, regen: 1, pickup: 1, greed: 1, armor: 0 } },
  { tier: 'normal', name: 'well upgraded', ranks: { max_hp: 4, might: 4, speed: 3, regen: 3, pickup: 3, greed: 3, armor: 1, luck: 2 } },
  { tier: 'normal', name: 'Normal maxed', ranks: normalFull },
  { tier: 'nightmare', name: 'fresh (a new guest)', ranks: {} },
  { tier: 'nightmare', name: 'just finished Normal', ranks: { max_hp: 4, might: 4, speed: 3, regen: 3, pickup: 3, greed: 3, armor: 1, luck: 2, revive: 1 } },
  { tier: 'nightmare', name: 'mid-Nightmare', ranks: has(has(has({ ...normalFull, second_chance: 1, soul_collector: 1, nm_might: 3, nm_cooldown: 2, nm_hp: 1 }, 'nm_might'), 'nm_cooldown'), 'nm_hp') },
  { tier: 'nightmare', name: 'Nightmare maxed', ranks: nmFull },
  { tier: 'hell', name: 'fresh (a new guest)', ranks: {} },
  { tier: 'hell', name: 'just finished Nightmare', ranks: nmFull },
  { tier: 'hell', name: 'mid-Hell', ranks: { ...nmFull, ...(BEFORE ? {} : { hell_might: 3, hell_area: 2 }), unfinished_business: 1, infernal_resilience: 1 } },
  { tier: 'hell', name: 'Hell maxed (Bargain off)', ranks: all },
  { tier: 'hell', name: 'Hell maxed (Bargain on)', ranks: all, bargain: true },
];

function stats(r: Ranks, tier: TierId, bargain = false) {
  let might = 0, cd = 1, hp = 1, armor = 0, regen = 0, area = 0, cond = 0;
  for (const p of perks) {
    const n = Math.min(p.cap, r[p.id] ?? 0);
    if (!n) continue;
    switch (p.axis) {
      case 'might': might += p.mag * n; break;
      case 'cooldown': cd -= p.mag * n; break;
      case 'maxHp': hp += p.mag * n; break;
      case 'armor': armor += p.mag * n; break;
      case 'regen': regen += p.mag * n; break;
      case 'area': area += p.mag * n; break;
    }
  }
  // the conditional perks at their expected uptime in a won night
  const souls = tier === 'hell' ? 2 : 1.5;
  const sc = r.soul_collector ?? 0;
  if (sc) cond += [0, 0.04, 0.06, 0.08][sc] * souls;
  if (r.final_act) cond += [0, 0.12, 0.24][r.final_act] * (5 / 25);
  if (r.unfinished_business) {
    cond += [0, 0.03, 0.04, 0.05][r.unfinished_business] * 2.5;
    hp += [0, 0.02, 0.03, 0.04][r.unfinished_business] * 2.5;
  }
  if (bargain) {
    might += 0.3;
    hp -= 0.25;
  }
  return { might, cd, hp, armor, regen, area, cond };
}

function cost(r: Ranks): number {
  let t = 0;
  for (const p of perks) for (let i = 0; i < Math.min(p.cap, r[p.id] ?? 0); i++) t += Math.round(p.base * Math.pow(growth(p.id, p.growth), i));
  return t;
}

const ref = (() => { const s = stats({}, 'normal'); return { off: (1.6 + s.might) / s.cd, def: s.hp }; })();
console.log(`\n### Power against each tier's creatures (fresh on Normal = 1.00)${BEFORE ? ' — before D-103' : ''}\n`);
console.log('| tier | state | Lost & Found spent | Might | cooldowns | Max HP | Armor | regen | offence | defence | power |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const st of STATES) {
  const t = TIERS[st.tier], s = stats(st.ranks, st.tier, st.bargain);
  const off = (((1.6 + s.might + s.cond) / s.cd) * (1 + s.area / 2)) / t.hpMult / ref.off;
  const def = (s.hp * (1 + 0.08 * s.armor) * (1 + 0.15 * s.regen)) / t.dmgMult / ref.def;
  console.log(`| ${t.name} | ${st.name} | ${cost(st.ranks).toLocaleString('en-US')} | +${Math.round((s.might + s.cond) * 100)}% | ${Math.round((s.cd - 1) * 100)}% | ${s.hp >= 1 ? '+' : ''}${Math.round((s.hp - 1) * 100)}% | ${s.armor} | ${s.regen.toFixed(1)} | ${off.toFixed(2)} | ${def.toFixed(2)} | ${Math.sqrt(off * def).toFixed(2)} |`);
}

// what nights pay: a won 25:00 night (five bosses), and a night lost at 15:00 (two bosses), at a few Greed levels
console.log(`\n### What a night pays (Lost Tickets)${BEFORE ? ' — before D-103' : ''}\n`);
console.log('| tier | Piggy Bank | won night (25:00, 5 bosses) | lost at 15:00 (2 bosses) | Ghost Train won (35:00, 7 bosses) |');
console.log('|---|---|---:|---:|---:|');
const kills = { normal: 3000, nightmare: 3500, hell: 4200 } as const;
for (const tier of ['normal', 'nightmare', 'hell'] as TierId[]) {
  for (const pig of [0, 5]) {
    const greed = 1 + 0.08 * pig + tierGreed(tier);
    const won = computePayout({ seconds: 1500, bosses: 5, kills: kills[tier], won: true, greed });
    const lost = computePayout({ seconds: 900, bosses: 2, kills: kills[tier] * 0.45, won: false, greed });
    const gt = computePayout({ seconds: 2100, bosses: 7, kills: kills[tier] * 1.4, won: true, greed, dawn: 2100 });
    console.log(`| ${TIERS[tier].name} | ${pig ? 'maxed (+40%)' : 'none'} | ${won.toLocaleString('en-US')} | ${lost.toLocaleString('en-US')} | ${gt.toLocaleString('en-US')} |`);
  }
}
const ach = (pre: string) => ACHIEVEMENTS.filter((a) => a.id.startsWith(pre) && !a.retired).reduce((t, a) => t + a.reward, 0);
console.log(`\nOne-time achievement Lost Tickets: Nightmare ${ach('nm_').toLocaleString('en-US')}, Hell ${ach('hell_').toLocaleString('en-US')}, everything else ${ACHIEVEMENTS.filter((a) => !a.retired && !a.id.startsWith('nm_') && !a.id.startsWith('hell_')).reduce((t, a) => t + a.reward, 0).toLocaleString('en-US')}.`);
const shelf = (pred: (p: (typeof PERKS)[number]) => boolean) => cost(Object.fromEntries(perks.filter(pred).map((p) => [p.id, p.cap])));
console.log(`Shelves to max: Normal ${shelf((p) => !p.tier).toLocaleString('en-US')}, Nightmare ${shelf((p) => p.tier === 'nightmare').toLocaleString('en-US')}, Hell ${shelf((p) => p.tier === 'hell').toLocaleString('en-US')}.`);
