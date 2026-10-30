import { makeGame, runFor } from '../tests/helpers';
const g = makeGame({ godMode: true, seed: 777 });
for (let s = 0; s < 600; s++) {
  const t0 = performance.now();
  runFor(g, 5);
  g.fx.drain();
  const ms = performance.now() - t0;
  if (s % 6 === 0 || ms > 2000) console.log('t', g.time.toFixed(0), 'ms/5s', ms.toFixed(0), 'alive', g.active.length, 'projs', g.projs.filter(p=>p.alive).length, 'bullets', g.bullets.filter(b=>b.alive).length, 'pickups', g.pickups.length, g.pickups.filter(p=>p.alive).length, 'gems', g.gemsOnGround, 'hz', g.hazards.length, 'lvl', g.level, 'phase', g.phase, 'q', (g.weapons as any).queue.length, 'w', g.weapons.list.map(w=>w.def.id+w.level).join(','));
}
