// Headless co-op progression measurement (D-57, D-61). Bot parties play god-mode nights (progression
// isolated from survival) with the smart pilot and draft policy, and report how much of each player's
// build is finished by given minutes and when the whole party is maxed out. The tables in COOP can be
// overridden to compare variants on the same seeds.
// Usage: npx vite-node scripts/party.ts [sizes=1,2,3,4,6] [seeds=2] [minutes=26] [xp=1,1,7,13,20,25,30|current] [passives=weapons|current] [density=1,1,1.25,...|current] [xpgain=1,1,1.5,...|current]

import { makeGame, smartPilot } from '../tests/helpers';
import { COOP } from '../src/data/progression';
import { PASSIVES } from '../src/data/weapons';
import type { Game } from '../src/sim/game';
import type { Player } from '../src/sim/player';
import type { DraftOption } from '../src/sim/draft';

const sizes = (process.argv[2] ?? '1,2,3,4,6').split(',').map(Number);
const seeds = [11, 22, 33, 44, 55].slice(0, Number(process.argv[3] ?? 2));
const minutes = Number(process.argv[4] ?? 26);
const xpArg = process.argv[5] ?? 'current';
const passArg = process.argv[6] ?? 'current';
if (xpArg !== 'current') COOP.xp = xpArg.split(',').map(Number);
if (passArg === 'weapons') COOP.passiveSlots = [...COOP.slots];
const densArg = process.argv[7] ?? 'current';
if (densArg !== 'current') COOP.density = densArg.split(',').map(Number);
const gainArg = process.argv[8] ?? 'current';
if (gainArg !== 'current') COOP.xpGain = gainArg.split(',').map(Number);
const chars = ['carny', 'strongman', 'fortune_teller', 'ride_operator', 'lost_child', 'ringleader'];
const marks = [12, 16, 20, 24];

/** Share of a player's possible item levels they hold: weapons to 8 (an evolution counts as full), passives to their max. */
function buildDone(g: Game, p: Player): number {
  const slots = g.slots;
  let have = 0;
  for (const w of p.weapons.list) have += w.def.isEvolution ? 8 : Math.min(8, w.level);
  let passMax = 0;
  const held = [...p.passives];
  for (const [id, lvl] of held) {
    have += lvl;
    passMax += PASSIVES[id].maxLevel;
  }
  // empty passive slots count at the typical max (5)
  passMax += Math.max(0, slots.passives - held.length) * 5;
  return have / (slots.weapons * 8 + passMax);
}

function maxed(g: Game, p: Player): boolean {
  const s = g.slots;
  if (p.weapons.list.length < s.weapons || p.passives.size < s.passives) return false;
  for (const w of p.weapons.list) if (w.level < w.def.maxLevel) return false;
  for (const [id, lvl] of p.passives) if (lvl < PASSIVES[id].maxLevel) return false;
  return true;
}

/** The helpers' draft policy, for any seat: finish evolutions, build 3-4 weapons, then their passives. */
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

const mmss = (s: number) => (s < 0 ? '—' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
console.log(`xp=${COOP.xp.join(',')} passives=${COOP.passiveSlots.join(',')} weapons=${COOP.slots.join(',')} density=${COOP.density.join(',')} xpGain=${COOP.xpGain.join(',')} seeds=${seeds.length}`);
console.log(`| party | ${marks.map((m) => `build @${m}m`).join(' | ')} | level @24m | XP collected @24m | peak alive | all maxed |`);
console.log(`|---|${marks.map(() => '---').join('|')}|---|---|---|---|`);
/** raw XP collected so far (what the levels cost on this party's curve, plus the bar) */
const banked = (g: Game) => {
  let t = g.xp;
  for (let l = 1; l < g.level; l++) t += g.xpCurve(l);
  return t;
};
for (const n of sizes) {
  const done: number[][] = marks.map(() => []);
  const lvl24: number[] = [];
  const xp24: number[] = [];
  const peak: number[] = [];
  const maxT: number[] = [];
  for (const seed of seeds) {
    const players = Array.from({ length: n }, (_, i) => ({ character: chars[(i + seed) % chars.length] }));
    const g = makeGame({ character: players[0].character, seed, godMode: true, players: n > 1 ? players : undefined });
    let mi = 0;
    let allMax = -1;
    let most = 0;
    while (g.phase !== 'ended' && g.time < minutes * 60) {
      if (g.phase === 'draft') for (let i = 0; i < g.players.length; i++) draftFor(g, i);
      for (const p of g.players) {
        g.setCtx(p);
        smartPilot(g);
      }
      g.setCtx(g.players[0]);
      g.tick();
      if (g.active.length > most) most = g.active.length;
      if (mi < marks.length && g.time >= marks[mi] * 60) {
        done[mi].push(g.players.reduce((a, p) => a + buildDone(g, p), 0) / g.players.length);
        if (marks[mi] === 24) {
          lvl24.push(g.level);
          xp24.push(banked(g));
        }
        mi++;
      }
      if (allMax < 0 && g.tickCount % 60 === 0 && g.players.every((p) => maxed(g, p))) allMax = g.time;
    }
    maxT.push(allMax);
    peak.push(most);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const pct = (xs: number[]) => (xs.length ? `${Math.round(avg(xs) * 100)}%` : '—');
  console.log(`| ${n} | ${done.map(pct).join(' | ')} | ${lvl24.length ? avg(lvl24).toFixed(1) : '—'} | ${xp24.length ? Math.round(avg(xp24)) : '—'} | ${Math.round(avg(peak))} | ${maxT.map(mmss).join(', ')} |`);
}
