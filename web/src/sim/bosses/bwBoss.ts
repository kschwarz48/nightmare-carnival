// Shared ground for the Boardwalk's bosses (D-68). Like the Fun House's, they're creatures of the place:
// buildings don't stop them, every attack picks on whoever is nearest (co-op), and wherever they choose
// to stand is on the map. The two from the sea may stand in the shallows; the others keep to sand,
// boards and decks. Each fight has a stage ring drawn round everyone who was there when it began, so a
// fight stays a fight on an open map without anyone being dragged through a wall.

import { BW_BOUNDS, PIER_DECKS, onDeck, shoreY, waterDepth } from '../../data/boardwalk';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import { addRingPull } from '../movement';
import type { Player } from '../player';
import { BossBase, type BossOpts } from './boss';

export abstract class BoardwalkBoss extends BossBase {
  /** may it stand in water deeper than a wade (the Captain, the Leviathan)? */
  protected seaBorn = false;

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
  }

  update(dt: number): void {
    super.update(dt);
    // The stage holds its fight (D-71): anyone who walks out of the ring is reeled back in, as on the first
    // map's Puppet King stage. Without it a boss held to its stage could be left out of reach (a party
    // kiting off the stage stalled the fight), and a guest, whose prediction already applies the pull,
    // was corrected back out.
    if (this.awake && !this.dead && this.ringR > 0) for (const p of this.g.players) if (this.g.isUp(p)) addRingPull(p, this);
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

  /** A point on the map `m` units in from its edges; out of deep water unless this boss is sea-born. */
  onLand(x: number, y: number, m = 80): { x: number; y: number } {
    const B = BW_BOUNDS;
    x = Math.min(B.maxX - m, Math.max(B.minX + m, x));
    y = Math.min(B.maxY - m, Math.max(B.minY + m, y));
    const wade = this.seaBorn ? 520 : 110;
    if (waterDepth(x, y) > wade && !onDeck(x, y)) {
      // back up onto the beach, or onto the nearest deck if that's closer
      let bx = x, by = shoreY(x) + wade - 10, bd = (y - by) ** 2;
      for (const r of PIER_DECKS) {
        const cx = Math.min(r.x1 - 40, Math.max(r.x0 + 40, x)), cy = Math.min(r.y1 - 40, Math.max(r.y0 + 40, y));
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bd) {
          bd = d;
          bx = cx;
          by = cy;
        }
      }
      x = bx;
      y = by;
    }
    return { x, y };
  }

  /** Arrive `d` units from the nearest player, on the side with the most room (and dry footing). */
  arriveNear(d: number): void {
    const p = this.target(0, 0);
    let best = this.onLand(p.x, p.y - d), room = -1;
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 4;
      const c = this.onLand(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 140);
      const r = Math.hypot(c.x - p.x, c.y - p.y);
      if (r > room + 1) {
        room = r;
        best = c;
      }
    }
    this.x = this.px = best.x;
    this.y = this.py = best.y;
  }

  /** Draw the stage round everyone standing now (at least `r` across, never with anyone outside it). */
  stageRound(r: number): void {
    const up = this.g.players.filter((p) => this.g.isUp(p));
    const list = up.length ? up : [this.g.player];
    let cx = 0, cy = 0;
    for (const p of list) {
      cx += p.x / list.length;
      cy += p.y / list.length;
    }
    let far = 0;
    for (const p of list) far = Math.max(far, Math.hypot(p.x - cx, p.y - cy));
    this.ringX = cx;
    this.ringY = cy;
    this.ringR = Math.max(r, far + 160);
  }

  /** A point inside the stage (or the map, when there is none), `m` units in from the rope. */
  inStage(x: number, y: number, m = 60): { x: number; y: number } {
    if (this.ringR > 0) {
      const dx = x - this.ringX, dy = y - this.ringY, d = Math.hypot(dx, dy), lim = this.ringR - m;
      if (d > lim) {
        x = this.ringX + (dx / d) * lim;
        y = this.ringY + (dy / d) * lim;
      }
    }
    return this.onLand(x, y, 60);
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
    const c = this.inStage(this.x + this.vx * dt, this.y + this.vy * dt);
    this.x = c.x;
    this.y = c.y;
    if (Math.abs(dx) > 10) this.face = dx > 0 ? 1 : -1;
  }
}
