import { makeGame, runFor } from '../tests/helpers';
for (const seed of [11, 22, 33, 44]) {
  const g = makeGame({ character: 'carny', difficulty: 'midway', seed });
  const src = new Map<string, number>();
  const orig = g.hurtPlayer.bind(g);
  let ctx = 'other';
  g.hurtPlayer = (amt: number, x: number, y: number, o: any = {}) => {
    const hp0 = g.player.hp;
    const r = orig(amt, x, y, o);
    if (r) src.set(ctx, (src.get(ctx) ?? 0) + (hp0 - g.player.hp));
    return r;
  };
  // tag contact vs bullets vs hazards by wrapping update phases
  const uc = (g as any).updateContact.bind(g); (g as any).updateContact = () => { ctx = 'contact'; uc(); ctx = 'other'; };
  const ub = (g as any).updateBullets.bind(g); (g as any).updateBullets = (dt: number) => { ctx = 'bullets'; ub(dt); ctx = 'other'; };
  const uh = (g as any).updateHazards.bind(g); (g as any).updateHazards = (dt: number) => { ctx = 'hazards'; uh(dt); ctx = 'other'; };
  const near = new Map<string, number>();
  let s = 0;
  while (g.phase !== 'ended' && s < 900) {
    runFor(g, 1); s++;
    g.forEachEnemyInCircle(g.player.x, g.player.y, 60, (e) => near.set(e.def.id, (near.get(e.def.id) ?? 0) + 1));
  }
  console.log(`seed ${seed} died ${Math.round(g.time)}s L${g.level} kills ${g.kills} alive ${g.active.length}`, Object.fromEntries(src), 'adjacent:', JSON.stringify(Object.fromEntries([...near].sort((a, b) => b[1] - a[1]).slice(0, 4))), 'w', g.weapons.list.map((w) => w.def.id + w.level).join(','));
}
