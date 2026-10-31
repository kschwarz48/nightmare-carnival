// Shared ground for the Fun House's bosses (D-63). They are creatures of the house, so walls don't stop
// them (the Twins step out of mirrors, the Glass climbs out of its frame, the Stringmistress hangs above
// the rafters, the Proprietor owns the place); every attack picks on whoever is nearest (co-op), and
// every position they choose stays inside the house.

import { PLAYER_BOUNDS } from '../../data/map';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Player } from '../player';
import { BossBase, type BossOpts } from './boss';

export abstract class FunhouseBoss extends BossBase {
  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
  }

  /** The nearest standing player. */
  target(fromX = this.x, fromY = this.y): Player {
    return this.g.nearestLiving(fromX, fromY);
  }

  angleToTarget(fromX = this.x, fromY = this.y): number {
    const p = this.target(fromX, fromY);
    return Math.atan2(p.y - fromY, p.x - fromX);
  }

  distToTarget(): number {
    const p = this.target();
    return Math.hypot(p.x - this.x, p.y - this.y);
  }

  /** A point clamped inside the house (`m` units from the outer walls). */
  inside(x: number, y: number, m = 90): { x: number; y: number } {
    const B = PLAYER_BOUNDS;
    return { x: Math.min(B.maxX - m, Math.max(B.minX + m, x)), y: Math.min(B.maxY - m, Math.max(B.minY + m, y)) };
  }

  /** Arrive `d` units from the nearest player, on the side with the most room. */
  arriveNear(d: number): void {
    const p = this.target(0, 0);
    let best = { x: p.x, y: p.y - d }, room = -1;
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 4;
      const c = this.inside(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 140);
      const r = Math.hypot(c.x - p.x, c.y - p.y);
      if (r > room + 1) {
        room = r;
        best = c;
      }
    }
    this.x = this.px = best.x;
    this.y = this.py = best.y;
  }

  /** How far a lane from (x, y) along `a` can run before the house's walls (at most `max`). */
  laneLength(x: number, y: number, a: number, max: number): number {
    const B = PLAYER_BOUNDS, m = 70;
    const dx = Math.cos(a), dy = Math.sin(a);
    let t = max;
    if (dx > 1e-3) t = Math.min(t, (B.maxX - m - x) / dx);
    if (dx < -1e-3) t = Math.min(t, (B.minX + m - x) / dx);
    if (dy > 1e-3) t = Math.min(t, (B.maxY - m - y) / dy);
    if (dy < -1e-3) t = Math.min(t, (B.minY + m - y) / dy);
    return Math.max(120, t);
  }

  protected roam(dt: number): void {
    const p = this.target();
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = this.moveSpeed * (this.enraged ? 1.25 : 1);
    if (d > this.keepDist) {
      this.vx = (dx / d) * sp;
      this.vy = (dy / d) * sp;
    } else {
      this.vx *= 0.9;
      this.vy *= 0.9;
    }
    const c = this.inside(this.x + this.vx * dt, this.y + this.vy * dt, 60);
    this.x = c.x;
    this.y = c.y;
    if (Math.abs(dx) > 10) this.face = dx > 0 ? 1 : -1;
  }
}
