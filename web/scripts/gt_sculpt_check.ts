import { GHOST_TRAIN_BUILDERS } from '../src/render3d/models/ghostTrainCreatures';
let total = 0;
for (const [id, fn] of Object.entries(GHOST_TRAIN_BUILDERS)) {
  const t0 = performance.now();
  const m = fn();
  const ms = performance.now() - t0;
  total += ms;
  m.geo.computeBoundingBox();
  const bb = m.geo.boundingBox!;
  console.log(id.padEnd(16), `${ms.toFixed(0).padStart(5)} ms`, `verts=${m.geo.attributes.position.count}`, `h=${(bb.max.y - bb.min.y).toFixed(0)} w=${(bb.max.x - bb.min.x).toFixed(0)} d=${(bb.max.z - bb.min.z).toFixed(0)}`, `clips=${m.rig ? 'ok' : '-'}`);
}
console.log('total', total.toFixed(0), 'ms');
