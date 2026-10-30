// Headless progression measurement (D-30). Runs every character through full nights with the smart
// pilot + draft policy and records the level curve, ticket income, chests, vouchers, balloon drifts
// and crowd density. `god` mode isolates progression from survival; without it, deaths are counted.
// Usage: npx vite-node scripts/progression.ts [god|mortal] [seeds=3]

import { makeGame, smartDraft, smartPilot } from '../tests/helpers';
import { xpToNext } from '../src/data/progression';

const mode = process.argv[2] ?? 'god';
const seeds = [11, 22, 33, 44, 55].slice(0, Number(process.argv[3] ?? 3));
const chars = ['carny', 'strongman', 'fortune_teller', 'ride_operator', 'lost_child', 'ringleader'];
const marks = [1, 2, 3, 5, 6, 8, 10, 12, 15, 18, 20, 24];

interface Row { char: string; levels: number[]; first: number; time: number; won: boolean; chests: number; vouchers: number; drifts: number; alive: number[]; xpMin: number[]; deaths: number }

const rows: Row[] = [];
for (const char of chars) {
  for (const seed of seeds) {
    const g = makeGame({ character: char, seed, godMode: mode === 'god' });
    const r: Row = { char, levels: [], first: -1, time: 0, won: false, chests: 0, vouchers: 0, drifts: 0, alive: [], xpMin: [], deaths: 0 };
    g.bus.on('chest', () => r.chests++);
    g.bus.on('meta_currency', () => r.vouchers++);
    g.bus.on('balloon_drift', () => r.drifts++);
    let mi = 0;
    let xpPrev = 0;
    let lastMinute = 0;
    let s = 0;
    while (g.phase !== 'ended' && s < 1600 * 60) {
      smartDraft(g);
      if (g.phase === 'draft') g.chooseDraft(0);
      smartPilot(g);
      g.tick();
      s++;
      if (r.first < 0 && g.level > 1) r.first = g.time;
      if (mi < marks.length && g.time >= marks[mi] * 60) {
        r.levels.push(g.level);
        r.alive.push(g.active.length);
        mi++;
      }
      const m = Math.floor(g.time / 60);
      if (m > lastMinute) {
        // total XP banked so far (levels + bar)
        let total = g.xp;
        for (let l = 1; l < g.level; l++) total += xpToNext(l);
        r.xpMin.push(Math.round(total - xpPrev));
        xpPrev = total;
        lastMinute = m;
      }
    }
    while (r.levels.length < marks.length) r.levels.push(NaN);
    r.time = g.time;
    r.won = !!g.endStats?.won;
    rows.push(r);
  }
}

const avg = (xs: number[]) => xs.filter((x) => !Number.isNaN(x)).reduce((a, b) => a + b, 0) / Math.max(1, xs.filter((x) => !Number.isNaN(x)).length);
console.log(`mode=${mode} seeds=${seeds.length}`);
console.log(`| character | 1st lvl | ${marks.map((m) => `L@${m}m`).join(' | ')} | end | chests | vouchers | drifts |`);
console.log(`|---|---|${marks.map(() => '---').join('|')}|---|---|---|---|`);
for (const char of chars) {
  const rs = rows.filter((r) => r.char === char);
  const lv = marks.map((_, i) => avg(rs.map((r) => r.levels[i])).toFixed(1));
  console.log(`| ${char} | ${avg(rs.map((r) => r.first)).toFixed(1)}s | ${lv.join(' | ')} | ${rs.map((r) => `${Math.round(r.time)}s${r.won ? 'W' : ''}`).join(' ')} | ${avg(rs.map((r) => r.chests)).toFixed(1)} | ${avg(rs.map((r) => r.vouchers)).toFixed(1)} | ${avg(rs.map((r) => r.drifts)).toFixed(1)} |`);
}
const all = rows;
console.log('\nalive enemies at marks:', marks.map((m, i) => `${m}m:${avg(all.map((r) => r.alive[i] ?? NaN)).toFixed(0)}`).join(' '));
const xpByMin: number[] = [];
for (let m = 0; m < 24; m++) xpByMin.push(avg(all.map((r) => r.xpMin[m] ?? NaN)));
console.log('XP earned per minute:', xpByMin.map((x, m) => `${m + 1}:${x.toFixed(0)}`).join(' '));
console.log('XP to next level:', [1, 2, 5, 10, 15, 19, 20, 21, 30, 39, 40, 41, 50].map((l) => `L${l}:${xpToNext(l)}`).join(' '));
