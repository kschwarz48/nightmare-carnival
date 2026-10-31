// Map-to-map crowd health (D-64): plays god-mode bot nights on each map and measures the health of what
// actually spawns, minute by minute (weights, alive caps and splitters' children included). Rail snakes
// are left out of the crowd figures: they cross the screen on a rail and are dodged, not fought. A
// splitter's children fold into their parent (one family, one spawn, its whole health): counting each
// blob as a spawn would make a family look weaker than one slime, though it takes more hits.
// Usage: npx vite-node scripts/maphp.ts [seeds=3]

import { makeGame, smartDraft, smartPilot } from '../tests/helpers';
import type { MapId } from '../src/data/maps';

const seeds = [11, 22, 33, 44, 55].slice(0, Number(process.argv[2] ?? 3));
const MAPS: MapId[] = ['carnival_core', 'fun_house'];
const MINUTES = 25;

interface Acc { n: number; hp: number; base: number }
const table: Record<string, Acc[]> = {};
const kills: Record<string, number[]> = {};

for (const map of MAPS) {
  const acc: Acc[] = Array.from({ length: MINUTES }, () => ({ n: 0, hp: 0, base: 0 }));
  const k = Array.from({ length: MINUTES }, () => 0);
  for (const seed of seeds) {
    const g = makeGame({ map, seed, godMode: true, character: 'carny' });
    const spawn = g.spawnEnemy.bind(g);
    g.spawnEnemy = (id, x, y, o) => {
      const e = spawn(id, x, y, o);
      if (e && e.def.behavior !== 'rail_strafer') {
        const m = Math.min(MINUTES - 1, Math.floor(g.time / 60));
        if (!/^splitter_(mid|small)$/.test(e.def.id)) acc[m].n++;
        acc[m].hp += e.maxHp;
        acc[m].base += e.def.hp;
      }
      return e;
    };
    g.bus.on('enemy_killed' as never, () => k[Math.min(MINUTES - 1, Math.floor(g.time / 60))]++);
    let s = 0;
    while (g.phase !== 'ended' && s < 1600 * 60) {
      smartDraft(g);
      if (g.phase === 'draft') g.chooseDraft(0);
      smartPilot(g);
      g.tick();
      s++;
    }
  }
  table[map] = acc;
  kills[map] = k;
}

const r1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
console.log(`seeds=${seeds.length} (god-mode Carny, smart pilot); crowd = every spawn except rail snakes; splitter families count once`);
console.log('| min | Carnival HP/spawn | Fun House HP/spawn | ratio | Carnival base HP | Fun House base HP | Carnival spawns | Fun House spawns |');
console.log('|---|---|---|---|---|---|---|---|');
for (let m = 0; m < MINUTES; m++) {
  const a = table.carnival_core[m], b = table.fun_house[m];
  const ha = a.hp / Math.max(1, a.n), hb = b.hp / Math.max(1, b.n);
  console.log(`| ${m} | ${r1(ha)} | ${r1(hb)} | ${r1(hb / ha)}× | ${r1(a.base / Math.max(1, a.n))} | ${r1(b.base / Math.max(1, b.n))} | ${Math.round(a.n / seeds.length)} | ${Math.round(b.n / seeds.length)} |`);
}
const acts = [[0, 6], [6, 12], [12, 18], [18, 25]];
console.log('\n| act | Carnival HP/spawn | Fun House HP/spawn | ratio |');
console.log('|---|---|---|---|');
acts.forEach(([s, e], i) => {
  let na = 0, ha = 0, nb = 0, hb = 0;
  for (let m = s; m < e; m++) {
    na += table.carnival_core[m].n;
    ha += table.carnival_core[m].hp;
    nb += table.fun_house[m].n;
    hb += table.fun_house[m].hp;
  }
  console.log(`| ${['I', 'II', 'III', 'IV'][i]} | ${r1(ha / na)} | ${r1(hb / nb)} | ${r1(hb / nb / (ha / na))}× |`);
});
