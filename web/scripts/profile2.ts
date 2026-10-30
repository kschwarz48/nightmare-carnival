import { makeGame, runFor } from '../tests/helpers';
const g = makeGame({ godMode: true, seed: 777 });
runFor(g, 270); g.fx.drain();
for (let s = 0; s < 400; s++) {
  const t0 = performance.now();
  try { runFor(g, 0.25); } catch (e) { console.log('ERR', e); break; }
  g.fx.drain();
  const ms = performance.now() - t0;
  console.log('t', g.time.toFixed(2), 'ms', ms.toFixed(0), 'alive', g.active.length, 'phase', g.phase, 'draft', g.draftOptions.length, 'pend', g.pendingLevels);
}
