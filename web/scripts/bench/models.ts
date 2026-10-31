// Model build cost (engineering optimization pass): how long each procedural model takes to sculpt and
// whether boot pre-builds it. Anything slow that boot leaves to first use is a mid-game hitch: the
// frame that first draws it pays for the whole sculpt.
//
//   npx vite-node scripts/bench/models.ts
import { CHARACTERS, ENEMY_MODELS, ITEM_MODELS } from '../../src/render3d/models';
import { CREATURE_IDS, creatureModel } from '../../src/render3d/models/creatures';

// what boot builds (warmModels): the first map's creatures and the last character played
const t0 = performance.now();
for (const id of CREATURE_IDS) creatureModel(id);
const bootMs = performance.now() - t0;

const rows: { group: string; key: string; ms: number; tris: number }[] = [];
const time = (group: string, defs: Record<string, { build: () => { index: { count: number } | null; getAttribute: (n: string) => { count: number } } }>) => {
  for (const [key, def] of Object.entries(defs)) {
    const a = performance.now();
    const g = def.build();
    const ms = performance.now() - a;
    rows.push({ group, key, ms, tris: g.index ? g.index.count / 3 : g.getAttribute('position').count / 3 });
  }
};
time('character', CHARACTERS as never);
time('enemy', ENEMY_MODELS as never);
time('item', ITEM_MODELS as never);
rows.sort((a, b) => b.ms - a.ms);
console.log(`boot warm-up (first map's creatures): ${bootMs.toFixed(0)} ms for ${CREATURE_IDS.length} models`);
console.log('slowest builds after that warm-up (cached ones cost ~0):');
console.log('| group | model | ms | triangles |\n|---|---|---:|---:|');
for (const r of rows.slice(0, 40)) console.log(`| ${r.group} | ${r.key} | ${r.ms.toFixed(1)} | ${Math.round(r.tris)} |`);
const over = (t: number) => rows.filter((r) => r.ms > t).length;
console.log(`\nbuilds over 16 ms: ${over(16)}, over 50 ms: ${over(50)}, over 100 ms: ${over(100)}; total ${rows.reduce((s, r) => s + r.ms, 0).toFixed(0)} ms for ${rows.length} models`);
