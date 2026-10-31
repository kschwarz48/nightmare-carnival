// What hurts a mortal bot in a night (D-64): damage by source (contact by enemy, hazards by style,
// bullets by kind), time spent pinned (barely moving), and when and where it died.
// Usage: npx vite-node scripts/fhdeaths.ts [map=fun_house] [character=carny]

import { makeGame, smartDraft, smartPilot } from '../tests/helpers';
import type { MapId } from '../src/data/maps';

const map = (process.argv[2] ?? 'fun_house') as MapId;
const character = process.argv[3] ?? 'carny';
for (const seed of [11, 22, 33]) {
  const g = makeGame({ character, difficulty: 'midway', seed, map });
  const src = new Map<string, number>();
  let ctx = 'other';
  const orig = g.hurtPlayer.bind(g);
  g.hurtPlayer = (amt: number, x: number, y: number, o: Parameters<typeof orig>[3] = {}) => {
    const hp0 = g.player.hp;
    const r = orig(amt, x, y, o);
    if (r) {
      let key = ctx;
      if (ctx === 'contact') {
        let best = 'contact?', bd = Infinity;
        g.forEachEnemyInCircle(g.player.x, g.player.y, 120, (e) => {
          const d = Math.hypot(e.x - g.player.x, e.y - g.player.y);
          if (d < bd) {
            bd = d;
            best = `contact:${e.def.id}`;
          }
        });
        key = best;
      } else if (ctx === 'hazards') {
        const h = g.hazards.find((q) => q.alive && Math.hypot(q.x - x, q.y - y) < 1);
        key = `hazard:${h?.style ?? '?'}`;
      } else if (ctx === 'bullets') {
        const b = g.bullets.find((q) => q.alive && Math.hypot(q.x - x, q.y - y) < 40);
        key = `bullet:${b?.kind ?? '?'}`;
      }
      src.set(key, (src.get(key) ?? 0) + (hp0 - g.player.hp));
    }
    return r;
  };
  const wrap = (name: string, tag: string) => {
    const f = (g as unknown as Record<string, (...a: unknown[]) => unknown>)[name].bind(g);
    (g as unknown as Record<string, unknown>)[name] = (...a: unknown[]) => {
      ctx = tag;
      const r = f(...a);
      ctx = 'other';
      return r;
    };
  };
  wrap('updateContact', 'contact');
  wrap('updateBullets', 'bullets');
  wrap('updateHazards', 'hazards');
  let s = 0, pinned = 0, lx = g.player.x, ly = g.player.y;
  while (g.phase !== 'ended' && s < 900 * 60) {
    smartDraft(g);
    if (g.phase === 'draft') g.chooseDraft(0);
    smartPilot(g);
    g.tick();
    s++;
    if (s % 30 === 0) {
      if (Math.hypot(g.player.x - lx, g.player.y - ly) < 8) pinned += 0.5;
      lx = g.player.x;
      ly = g.player.y;
    }
  }
  const top = [...src].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => `${k}=${Math.round(v)}`).join(' ');
  console.log(`${map} seed ${seed}: ended ${Math.round(g.time)}s L${g.level} at (${Math.round(g.player.x)},${Math.round(g.player.y)}) pinned ${pinned}s | ${top}`);
}
