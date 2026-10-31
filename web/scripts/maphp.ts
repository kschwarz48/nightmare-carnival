// Map-to-map crowd health (D-64, D-68): plays god-mode bot nights on each map and measures the health of
// what actually spawns, minute by minute (weights, alive caps and splitters' children included). Rail
// snakes are left out of the crowd figures: they cross the screen on a rail and are dodged, not fought. A
// splitter's children fold into their parent (one family, one spawn, its whole health): counting each
// blob as a spawn would make a family look weaker than one slime, though it takes more hits. A
// Tidecaller's raised drowned count as spawns of their own, as they are fought.
// Usage: npx vite-node scripts/maphp.ts [seeds=3] [maps=carnival_core,fun_house,boardwalk]

import { makeGame, smartDraft, smartPilot } from '../tests/helpers';
import type { MapId } from '../src/data/maps';

const seeds = [11, 22, 33, 44, 55].slice(0, Number(process.argv[2] ?? 3));
const MAPS = (process.argv[3] ?? 'carnival_core,fun_house,boardwalk').split(',') as MapId[];
const MINUTES = 25;
const NAMES: Record<string, string> = { carnival_core: 'Carnival', fun_house: 'Fun House', boardwalk: 'Boardwalk' };

interface Acc { n: number; hp: number; base: number }
const table: Record<string, Acc[]> = {};

for (const map of MAPS) {
  const acc: Acc[] = Array.from({ length: MINUTES }, () => ({ n: 0, hp: 0, base: 0 }));
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
}

const r1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const ref = MAPS[0];
console.log(`seeds=${seeds.length} (god-mode Carny, smart pilot); crowd = every spawn except rail snakes; splitter families count once`);
console.log(`| min | ${MAPS.map((m) => `${NAMES[m] ?? m} HP/spawn`).join(' | ')} | ${MAPS.slice(1).map((m) => `${NAMES[m] ?? m} ratio`).join(' | ')} | ${MAPS.map((m) => `${NAMES[m] ?? m} spawns`).join(' | ')} |`);
console.log(`|${'---|'.repeat(1 + MAPS.length * 2 + MAPS.length - 1)}`);
for (let m = 0; m < MINUTES; m++) {
  const hp = MAPS.map((k) => table[k][m].hp / Math.max(1, table[k][m].n));
  console.log(`| ${m} | ${hp.map(r1).join(' | ')} | ${hp.slice(1).map((h) => `${r1(h / hp[0])}×`).join(' | ')} | ${MAPS.map((k) => Math.round(table[k][m].n / seeds.length)).join(' | ')} |`);
}
const acts = [[0, 6], [6, 12], [12, 18], [18, 25]];
console.log(`\n| act | ${MAPS.map((m) => `${NAMES[m] ?? m} HP/spawn`).join(' | ')} | ${MAPS.slice(1).map((m) => `${NAMES[m] ?? m} vs ${NAMES[ref] ?? ref}`).join(' | ')} |`);
console.log(`|${'---|'.repeat(1 + MAPS.length + MAPS.length - 1)}`);
acts.forEach(([s, e], i) => {
  const hp = MAPS.map((k) => {
    let n = 0, h = 0;
    for (let m = s; m < e; m++) {
      n += table[k][m].n;
      h += table[k][m].hp;
    }
    return h / Math.max(1, n);
  });
  console.log(`| ${['I', 'II', 'III', 'IV'][i]} | ${hp.map(r1).join(' | ')} | ${hp.slice(1).map((h) => `${r1(h / hp[0])}×`).join(' | ')} |`);
});
