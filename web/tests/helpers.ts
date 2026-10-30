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

/** Potential-field pilot: repelled by each nearby threat (1/d²), hazards and bullets; drawn to safe tickets & food. */
export function smartPilot(g: Game): void {
  const p = g.player;
  let fx = 0, fy = 0;
  g.forEachEnemyInCircle(p.x, p.y, 320, (e) => {
    const dx = p.x - e.x, dy = p.y - e.y;
    const d2 = Math.max(400, dx * dx + dy * dy);
    const w = (e.windup > 0 || e.state === 2 ? 3 : 1) * (e.r / 12);
    fx += (dx / Math.sqrt(d2)) * (9000 / d2) * w;
    fy += (dy / Math.sqrt(d2)) * (9000 / d2) * w;
  });
  for (const b of g.bullets) {
    if (!b.alive) continue;
    const dx = p.x - b.x, dy = p.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 200 * 200) continue;
    fx += (dx / Math.sqrt(d2 + 1)) * (6000 / Math.max(300, d2));
    fy += (dy / Math.sqrt(d2 + 1)) * (6000 / Math.max(300, d2));
  }
  for (const h of g.hazards) {
    if (!h.alive || h.safe || h.dmg <= 0) continue;
    if (g.hazardTouches(h, p.x, p.y, 50)) {
      let dx = p.x - h.x, dy = p.y - h.y;
      if (h.shape === 'line') {
        const lx = h.x2 - h.x, ly = h.y2 - h.y, l = Math.hypot(lx, ly) || 1;
        dx = -ly / l; dy = lx / l;
        if ((p.x - h.x) * dx + (p.y - h.y) * dy < 0) { dx = -dx; dy = -dy; }
      }
      const l = Math.hypot(dx, dy) || 1;
      fx += (dx / l) * 4;
      fy += (dy / l) * 4;
    }
  }
  const threat = Math.hypot(fx, fy);
  if (threat < 0.6) {
    let best: { x: number; y: number } | null = null, bd = 500 * 500;
    for (const pk of g.pickups) {
      if (!pk.alive) continue;
      const d = (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2;
      const w = pk.kind === 'food' && p.hp < p.stats.maxHp() * 0.7 ? 0.2 : pk.kind === 'chest' ? 0.3 : 1;
      if (d * w < bd) { bd = d * w; best = pk; }
    }
    if (best) {
      const dx = best.x - p.x, dy = best.y - p.y, l = Math.hypot(dx, dy) || 1;
      fx += (dx / l) * 0.8;
      fy += (dy / l) * 0.8;
    }
  }
  // gentle orbit + stay off the fence
  fx += -p.y / 6000 - p.x / 2500;
  fy += p.x / 6000 - (p.y - 300) / 2500;
  const l = Math.hypot(fx, fy) || 1;
  g.input.moveX = fx / l;
  g.input.moveY = fy / l;
}

/** Draft policy closer to a human: finish evolutions, build 3-4 weapons, then their passives. */
export function smartDraft(g: Game): void {
  if (g.phase !== 'draft') return;
  const o = g.draftOptions;
  const score = (x: typeof o[number]) => {
    if (x.kind === 'evolution') return 100;
    if (x.kind === 'new_weapon') return g.weapons.list.length < 3 ? 60 : 20;
    if (x.kind === 'level_weapon') return 40 + x.level;
    if (x.kind === 'passive') {
      const needed = g.weapons.list.some((w) => w.def.evoPassive === x.refId);
      return needed ? 55 : ['sugar_rush', 'safety_goggles', 'funnel_cake', 'strongman_belt', 'energy_drink'].includes(x.refId) ? 35 : 15;
    }
    return 1;
  };
  let bi = 0;
  o.forEach((x, i) => { if (score(x) > score(o[bi])) bi = i; });
  g.chooseDraft(bi);
}
