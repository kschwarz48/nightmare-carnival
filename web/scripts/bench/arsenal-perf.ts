// Sim cost of the reworked weapons in a dense fight (D-103): ms per tick with 250 creatures kept alive, for a build of
// every reworked evolution against a build of unchanged ones. npx vite-node scripts/bench/arsenal-perf.ts
import { makeGame } from '../../tests/helpers';
import { CARNIVAL_LAYOUT, applyLayout } from '../../src/data/map';
import { Nav } from '../../src/sim/nav';

function cost(weapons: string[]): { ms: number; zones: number; projs: number } {
  const g = makeGame({ character: 'carny', seed: 5, godMode: true });
  applyLayout({ ...CARNIVAL_LAYOUT, props: [], greaseSlicks: [], tiltAWhirl: null });
  g.nav = new Nav();
  g.director.update = () => {};
  g.events.update = () => {};
  g.addXp = () => {};
  g.openChest = () => ({ items: [], entries: [] });
  g.weapons.list.length = 0;
  for (const id of weapons) g.weapons.add(id)!.level = 8;
  for (const k of ['strongman_belt', 'foam_finger', 'extra_token', 'spinning_top']) for (let i = 0; i < 5; i++) g.player.addPassive(k);
  const p = g.player;
  let t = 0, zones = 0, projs = 0;
  for (let i = 0; i < 1800; i++) {
    let alive = 0;
    for (const e of g.active) if (e.alive) alive++;
    for (let k = alive; k < 250; k++) {
      const a = g.rng.angle(), d = g.rng.range(150, 550);
      g.spawnEnemy('possessed_stuffie', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { exact: true, hpMult: 6 });
    }
    const ang = i * 0.01;
    g.inputs[0].moveX = Math.cos(ang);
    g.inputs[0].moveY = Math.sin(ang);
    const t0 = performance.now();
    g.tick();
    if (i >= 300) t += performance.now() - t0;
    zones = Math.max(zones, g.zones.filter((z) => z.alive).length);
    projs = Math.max(projs, g.projs.filter((q) => q.alive).length);
  }
  applyLayout(CARNIVAL_LAYOUT);
  return { ms: t / 1500, zones, projs };
}

const reworked = cost(['blizzard', 'inferno_grill', 'whack_frenzy', 'high_striker', 'cosmic_convergence', 'snowcone']);
const unchanged = cost(['royal_flush', 'death_card', 'sharpshooter', 'grand_finale', 'kettle_korn', 'saturn_rings']);
console.log(`reworked evolutions: ${reworked.ms.toFixed(2)} ms/tick (most live zones ${reworked.zones}, projectiles ${reworked.projs})`);
console.log(`unchanged evolutions: ${unchanged.ms.toFixed(2)} ms/tick (most live zones ${unchanged.zones}, projectiles ${unchanged.projs})`);
