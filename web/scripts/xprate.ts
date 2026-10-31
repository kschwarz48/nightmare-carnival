// Party XP per hour against solo (D-66), measured two ways for each seed: the XP the party *earns* (every
// ticket its kills drop, banked or not, at the party's XP gain) and the XP it *collects* (what reached the
// bar). Bots kite for crowds, not loot, and leave tickets lying (and the Ticket Bank) in co-op far more
// than solo, so "earned" is the figure a party of people is expected to bank.
// Usage: npx vite-node scripts/xprate.ts [sizes=1,2] [seeds=4] [minutes=24] [xpgain=current|1,1,1.5,...] [character=carny|mix]
// Every seat plays the same character by default: characters differ a lot (a Ringleader's pets kill far
// from it and drop most of their XP out of reach), so mixing them buries the party/solo comparison in noise.
// Even one character's haul swings 5-10x between seeds (build and kill speed feed each other), so a few
// seeds only rule out extremes; they can't resolve a ratio like 1.5x.

import { makeGame, smartPilot } from '../tests/helpers';
import { COOP } from '../src/data/progression';
import type { Game } from '../src/sim/game';
import type { DraftOption } from '../src/sim/draft';

const sizes = (process.argv[2] ?? '1,2').split(',').map(Number);
const seeds = [11, 22, 33, 44, 55, 66].slice(0, Number(process.argv[3] ?? 4));
const minutes = Number(process.argv[4] ?? 24);
const gainArg = process.argv[5] ?? 'current';
if (gainArg !== 'current') COOP.xpGain = gainArg.split(',').map(Number);
const charArg = process.argv[6] ?? 'carny';
const chars = ['carny', 'strongman', 'fortune_teller', 'ride_operator', 'lost_child', 'ringleader'];

/** The party script's draft policy, for any seat: finish evolutions, build 3-4 weapons, then their passives. */
function draftFor(g: Game, i: number): void {
  const hand = g.drafts[i];
  if (!hand) return;
  const p = g.players[i];
  const score = (x: DraftOption) => {
    if (x.disabled) return -1;
    if (x.kind === 'evolution') return 100;
    if (x.kind === 'new_weapon') return p.weapons.list.length < 3 ? 60 : 20;
    if (x.kind === 'level_weapon') return 40 + x.level;
    if (x.kind === 'passive') {
      const needed = p.weapons.list.some((w) => w.def.evoPassive === x.refId);
      return needed ? 55 : ['sugar_rush', 'safety_goggles', 'funnel_cake', 'strongman_belt', 'energy_drink'].includes(x.refId) ? 35 : 15;
    }
    return 1;
  };
  let bi = 0;
  hand.forEach((x, k) => { if (score(x) > score(hand[bi])) bi = k; });
  g.chooseDraft(bi, i);
}

const banked = (g: Game) => {
  let t = g.xp;
  for (let l = 1; l < g.level; l++) t += g.xpCurve(l);
  return t;
};

console.log(`xpGain=${COOP.xpGain.join(',')} density=${COOP.density.join(',')} minutes=${minutes} character=${charArg} seeds=${seeds.length}`);
const rows: Record<number, { earned: number[]; collected: number[]; level: number[] }> = {};
for (const n of sizes) {
  rows[n] = { earned: [], collected: [], level: [] };
  for (const seed of seeds) {
    const players = Array.from({ length: n }, (_, i) => ({ character: charArg === 'mix' ? chars[(i + seed) % chars.length] : charArg }));
    const g = makeGame({ character: players[0].character, seed, godMode: true, players: n > 1 ? players : undefined });
    let earned = 0;
    const kill = g.killEnemy.bind(g);
    g.killEnemy = (e, ...rest) => {
      if (e.alive && !e.illusion) earned += e.tickets * g.partyScale.xpGain * g.player.stats.xp;
      return kill(e, ...rest);
    };
    while (g.phase !== 'ended' && g.time < minutes * 60) {
      if (g.phase === 'draft') for (let i = 0; i < g.players.length; i++) draftFor(g, i);
      for (const p of g.players) {
        g.setCtx(p);
        smartPilot(g);
      }
      g.setCtx(g.players[0]);
      g.tick();
    }
    rows[n].earned.push(earned);
    rows[n].collected.push(banked(g));
    rows[n].level.push(g.level);
    console.log(`  n=${n} seed ${seed}: earned ${Math.round(earned)}  collected ${Math.round(banked(g))}  level ${g.level}  kills ${g.kills}`);
  }
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const solo = rows[1] ? avg(rows[1].earned) : NaN;
const soloC = rows[1] ? avg(rows[1].collected) : NaN;
console.log('| party | XP earned (per hour) | vs solo | XP collected (per hour) | vs solo | level |');
console.log('|---|---|---|---|---|---|');
for (const n of sizes) {
  const r = rows[n];
  const e = avg(r.earned) * (60 / minutes), c = avg(r.collected) * (60 / minutes);
  console.log(`| ${n} | ${Math.round(e)} | ${(avg(r.earned) / solo).toFixed(2)}× | ${Math.round(c)} | ${(avg(r.collected) / soloC).toFixed(2)}× | ${avg(r.level).toFixed(1)} |`);
}
