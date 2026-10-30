// Dev utility: time sculpt builds and report mesh sizes.
import { characterModel, CHARACTER_IDS } from '../src/render3d/models/characters';
import { creatureModel, CREATURE_IDS } from '../src/render3d/models/creatures';
let total = 0;
for (const [ids, fn] of [[CHARACTER_IDS, characterModel], [CREATURE_IDS, creatureModel]] as const) {
  for (const id of ids) {
    const t0 = performance.now();
    const m = fn(id);
    const dt = performance.now() - t0;
    total += dt;
    const g = m.geo;
    console.log(id.padEnd(22), `${dt.toFixed(0).padStart(4)} ms`, 'verts', String(g.getAttribute('position').count).padStart(6), 'tris', String((g.index ? g.index.count : 0) / 3).padStart(6), 'bones', m.rig.bones.length);
  }
}
console.log('total', total.toFixed(0), 'ms');
