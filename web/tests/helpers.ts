import { Game, type RunConfig } from '../src/sim/game';

export function makeGame(o: Partial<RunConfig> = {}): Game {
  return new Game({
    character: 'carny', difficulty: 'midway', curse: false, seed: 12345,
    unlocked: new Set(['w_orbs', 'w_cannon', 'w_laser', 'w_bell', 'w_mirror', 'p_season_pass', 'p_coin_purse', 'p_rabbits_foot']),
    ...o,
  });
}

/** Simple autopilot: orbit-kite away from the crowd's center of mass, drift toward pickups. */
export function autopilot(g: Game): void {
  const p = g.player;
  let cx = 0, cy = 0, n = 0;
  g.forEachEnemyInCircle(p.x, p.y, 380, (e) => {
    cx += e.x;
    cy += e.y;
    n++;
  });
  let mx = 0, my = 0;
  if (n > 0) {
    cx /= n;
    cy /= n;
    const dx = p.x - cx, dy = p.y - cy;
    const l = Math.hypot(dx, dy) || 1;
    // flee + tangential component so we circle rather than hit walls
    mx = dx / l + (-dy / l) * 0.8;
    my = dy / l + (dx / l) * 0.8;
  } else {
    const a = g.realTime * 0.3;
    mx = Math.cos(a);
    my = Math.sin(a);
  }
  // collect nearby tickets when it's reasonably safe
  if (n < 6) {
    let best = null as null | { x: number; y: number }, bd = 420 * 420;
    for (const pk of g.pickups) {
      if (!pk.alive || pk.kind === 'bank') continue;
      const d = (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2;
      if (d < bd) {
        bd = d;
        best = pk;
      }
    }
    if (best) {
      const dx = best.x - p.x, dy = best.y - p.y;
      const l = Math.hypot(dx, dy) || 1;
      mx += (dx / l) * 1.5;
      my += (dy / l) * 1.5;
    }
  }
  // pull back toward the map centre so we don't pin ourselves on the fence
  mx += -p.x / 1800;
  my += -p.y / 1800;
  for (const h of g.hazards) {
    if (!h.alive || h.safe) continue;
    if (g.hazardTouches(h, p.x, p.y, 40)) {
      const dx = p.x - h.x, dy = p.y - h.y;
      const l = Math.hypot(dx, dy) || 1;
      mx += (dx / l) * 2;
      my += (dy / l) * 2;
    }
  }
  const l = Math.hypot(mx, my) || 1;
  g.input.moveX = mx / l;
  g.input.moveY = my / l;
}

/** Resolve drafts automatically (prefer evolutions, then weapons in slot-order, then passives). */
export function autoDraft(g: Game): void {
  if (g.phase !== 'draft') return;
  const opts = g.draftOptions;
  let idx = opts.findIndex((o) => o.kind === 'evolution');
  if (idx < 0) idx = opts.findIndex((o) => o.kind === 'level_weapon');
  if (idx < 0) idx = opts.findIndex((o) => o.kind === 'passive' && !o.isNew === false && ['spectacles', 'lucky_ticket', 'energy_drink', 'strongman_belt', 'extra_token', 'foam_finger'].includes(o.refId));
  if (idx < 0) idx = opts.findIndex((o) => o.kind === 'new_weapon');
  if (idx < 0) idx = 0;
  g.chooseDraft(idx);
}

export function runFor(g: Game, seconds: number, opts: { auto?: boolean } = { auto: true }): void {
  const ticks = Math.round(seconds * 60);
  for (let i = 0; i < ticks; i++) {
    if (g.phase === 'ended') return;
    if (opts.auto !== false) {
      autoDraft(g);
      autopilot(g);
    }
    g.tick();
  }
}
