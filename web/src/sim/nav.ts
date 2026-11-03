// The crowd and the map's walls (D-74): solid props, the Fun House's moving walls and a standing boss's
// body block enemies the way they block players. A coarse grid marks the cells too close to a wall; a
// flow field (a breadth-first search out from every standing player, rebuilt a few times a second)
// leads anything that can't see its target around buildings and through the maze; a push-out keeps
// bodies out of the walls. Newcomers walk through walls until they first stand clear on open ground the
// players can reach (they spawn off-screen, sometimes inside a building or beyond the fences, and a
// door shutting on one lets it walk out again). Flyers and phantoms (`EnemyDef.phases`) ignore all of
// it, as do bosses and anything burrowed. Host-only: guests mirror the crowd's positions.

import { DYNAMIC_WALLS, PLAYER_BOUNDS, PROPS } from '../data/map';
import type { Enemy } from './entities';
import type { Game } from './game';
import { WallSet, dynamicWalls, isSolid } from './walls';

/** grid cell size (px) */
const CELL = 32;
/** how far a cell's centre must stay from a wall to count as open (about a small creature's radius) */
const MARGIN = 10;
/** seconds between flow-field rebuilds */
const REBUILD = 0.25;
const FAR = 0xffff;
/** line-of-sight cache slots per cell: one per possible target player */
const SLOTS = 6;
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class Nav {
  readonly minX: number;
  readonly minY: number;
  readonly cols: number;
  readonly rows: number;
  private readonly fixed: Uint8Array;
  private readonly blocked: Uint8Array;
  private readonly dist: Uint16Array;
  private readonly queue: Int32Array;
  /** -1 unknown, 0 a wall in the way, 1 clear: from each cell's centre to each player (as of the rebuild) */
  private readonly los: Int8Array;
  private readonly px: number[] = [];
  private readonly py: number[] = [];
  /** the walls that never move, packed and filed by area for the push-out (sim/walls.ts) */
  private readonly walls: WallSet;
  private t = REBUILD;
  /** the direction `flow` found */
  fx = 0;
  fy = 0;

  constructor() {
    const b = PLAYER_BOUNDS;
    this.minX = b.minX;
    this.minY = b.minY;
    this.cols = Math.max(1, Math.ceil((b.maxX - b.minX) / CELL));
    this.rows = Math.max(1, Math.ceil((b.maxY - b.minY) / CELL));
    const n = this.cols * this.rows;
    this.fixed = new Uint8Array(n);
    this.blocked = new Uint8Array(n);
    this.dist = new Uint16Array(n).fill(FAR);
    this.queue = new Int32Array(n);
    this.los = new Int8Array(n * SLOTS).fill(-1);
    for (const pr of PROPS) if (isSolid(pr)) this.stamp(this.fixed, pr.x, pr.y, pr.r ?? 0, pr.hw ?? 0, pr.hh ?? 0);
    this.walls = new WallSet(PROPS);
  }

  /** The grid cell at a point, or -1 outside the playable bounds. */
  cellAt(x: number, y: number): number {
    const cx = Math.floor((x - this.minX) / CELL), cy = Math.floor((y - this.minY) / CELL);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return -1;
    return cy * this.cols + cx;
  }

  /** Mark the cells whose centres a wall (a circle `r`, or a box `hw` x `hh`), grown by the margin, covers. */
  private stamp(mask: Uint8Array, x: number, y: number, r: number, hw: number, hh: number): void {
    const ex = (r || hw) + MARGIN, ey = (r || hh) + MARGIN;
    const c0 = Math.max(0, Math.floor((x - ex - this.minX) / CELL)), c1 = Math.min(this.cols - 1, Math.floor((x + ex - this.minX) / CELL));
    const r0 = Math.max(0, Math.floor((y - ey - this.minY) / CELL)), r1 = Math.min(this.rows - 1, Math.floor((y + ey - this.minY) / CELL));
    const rr = (r + MARGIN) ** 2;
    for (let cy = r0; cy <= r1; cy++) {
      const dy = this.minY + (cy + 0.5) * CELL - y;
      for (let cx = c0; cx <= c1; cx++) {
        const dx = this.minX + (cx + 0.5) * CELL - x;
        if (r ? dx * dx + dy * dy < rr : Math.abs(dx) < ex && Math.abs(dy) < ey) mask[cy * this.cols + cx] = 1;
      }
    }
  }

  /** Once per tick, before the crowd moves: rebuild the walls that move and the flow field now and then. */
  update(g: Game, dt: number): void {
    this.t += dt;
    if (this.t < REBUILD || !g.active.length) return;
    this.t = 0;
    const blocked = this.blocked;
    blocked.set(this.fixed);
    for (const pr of DYNAMIC_WALLS) this.stamp(blocked, pr.x, pr.y, pr.r ?? 0, pr.hw ?? 0, pr.hh ?? 0);
    for (const b of g.bosses) if (b.solid) this.stamp(blocked, b.x, b.y, b.solidR, 0, 0);
    // breadth-first out from every standing player: dist = steps to the nearest one by a walkable path
    const dist = this.dist, q = this.queue, cols = this.cols, rows = this.rows;
    dist.fill(FAR);
    this.los.fill(-1);
    this.px.length = this.py.length = 0;
    let head = 0, tail = 0;
    for (const p of g.players) {
      this.px.push(p.x);
      this.py.push(p.y);
      if (!g.isUp(p)) continue;
      const c = this.cellAt(p.x, p.y);
      if (c < 0 || dist[c] === 0) continue;
      dist[c] = 0;
      q[tail++] = c;
    }
    while (head < tail) {
      const c = q[head++];
      const d = dist[c] + 1;
      const cx = c % cols;
      if (cx > 0 && !blocked[c - 1] && dist[c - 1] === FAR) (dist[c - 1] = d), (q[tail++] = c - 1);
      if (cx < cols - 1 && !blocked[c + 1] && dist[c + 1] === FAR) (dist[c + 1] = d), (q[tail++] = c + 1);
      if (c >= cols && !blocked[c - cols] && dist[c - cols] === FAR) (dist[c - cols] = d), (q[tail++] = c - cols);
      if (c < cols * (rows - 1) && !blocked[c + cols] && dist[c + cols] === FAR) (dist[c + cols] = d), (q[tail++] = c + cols);
    }
  }

  /** Is the straight line from cell `c`'s centre to player `pi` free of walls (cached until the rebuild)? */
  private clear(c: number, pi: number): boolean {
    if (pi >= SLOTS || pi >= this.px.length) return true;
    const k = c * SLOTS + pi;
    let v = this.los[k];
    if (v < 0) {
      v = 1;
      const x0 = this.minX + ((c % this.cols) + 0.5) * CELL, y0 = this.minY + (Math.floor(c / this.cols) + 0.5) * CELL;
      const dx = this.px[pi] - x0, dy = this.py[pi] - y0;
      const steps = Math.ceil(Math.hypot(dx, dy) / (CELL * 0.5));
      for (let i = 1; i < steps; i++) {
        const n = this.cellAt(x0 + (dx * i) / steps, y0 + (dy * i) / steps);
        if (n >= 0 && n !== c && this.blocked[n]) {
          v = 0;
          break;
        }
      }
      this.los[k] = v;
    }
    return v === 1;
  }

  /**
   * The way to the nearest reachable player from (x, y), in `fx`/`fy`: false if there is none. From a
   * cell beside a wall (marked blocked: its centre is within the margin), only a step that doesn't cross
   * the wall itself counts: the cell just past a thin rail is near in steps but on the wrong side.
   */
  flow(x: number, y: number): boolean {
    const c = this.cellAt(x, y);
    if (c < 0) return false;
    const cols = this.cols, cx = c % cols, cy = (c - cx) / cols;
    const beside = this.blocked[c] === 1;
    let best = -1, bd = this.dist[c];
    for (const [ox, oy] of DIRS) {
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= this.rows) continue;
      const n = ny * cols + nx;
      if (this.blocked[n] || this.dist[n] >= bd) continue;
      // no cutting a wall's corner
      if (ox && oy && (this.blocked[cy * cols + nx] || this.blocked[ny * cols + cx])) continue;
      if (beside && !this.walkable(x, y, this.minX + (nx + 0.5) * CELL, this.minY + (ny + 0.5) * CELL)) continue;
      bd = this.dist[n];
      best = n;
    }
    if (best < 0) return false;
    const dx = this.minX + ((best % cols) + 0.5) * CELL - x, dy = this.minY + (Math.floor(best / cols) + 0.5) * CELL - y;
    const l = Math.hypot(dx, dy) || 1;
    this.fx = dx / l;
    this.fy = dy / l;
    return true;
  }

  /** Does the short straight walk from (x0, y0) to (x1, y1) stay out of every wall? */
  private walkable(x0: number, y0: number, x1: number, y1: number): boolean {
    // (the walls filed at the walk's midpoint: it is shorter than a wall's filing reach)
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dyn = dynamicWalls();
    const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
    for (let i = 1; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps;
      if (this.walls.hits(x, y, 0, mx, my) || dyn.hits(x, y, 0, mx, my)) return false;
    }
    return true;
  }

  /** Does a body of radius `r` at (x, y) overlap a wall? */
  private overlaps(g: Game, x: number, y: number, r: number): boolean {
    if (this.walls.hits(x, y, r) || dynamicWalls().hits(x, y, r)) return true;
    for (const b of g.bosses) if (b.solid && (x - b.x) ** 2 + (y - b.y) ** 2 < (b.solidR + r) ** 2) return true;
    return false;
  }

  /**
   * Right after a creature's own AI has moved it (before the crowd separates): a newcomer checks whether
   * it has reached open ground, and one walking toward a target it can't see is turned along the flow
   * (only motion toward its target: backing off, strafing and charges away are left alone).
   */
  steer(g: Game, e: Enemy, dt: number): void {
    if (e.def.phases || e.isBoss || e.hidden) return;
    const c = this.cellAt(e.x, e.y);
    if (!e.walled) {
      const b = PLAYER_BOUNDS;
      if (c < 0 || this.blocked[c] || this.dist[c] === FAR) return;
      if (e.x < b.minX + e.r || e.x > b.maxX - e.r || e.y < b.minY + e.r || e.y > b.maxY - e.r) return;
      if (this.overlaps(g, e.x, e.y, e.r)) return;
      e.walled = true;
    }
    // cut off from every player (a door shut on it): walk out through the walls again
    if (c < 0 || (!this.blocked[c] && this.dist[c] === FAR)) {
      e.walled = false;
      return;
    }
    if (e.kbT > 0) return;
    const mx = e.x - e.px, my = e.y - e.py;
    if (mx * mx + my * my < 1e-6) return;
    const p = g.player;
    if (mx * (p.x - e.x) + my * (p.y - e.y) <= 0) return;
    if (!this.blocked[c] && this.clear(c, p.index)) return;
    if (!this.flow(e.x, e.y)) return;
    const m = Math.hypot(mx, my);
    e.x = e.px + this.fx * m;
    e.y = e.py + this.fy * m;
    e.vx = (this.fx * m) / dt;
    e.vy = (this.fy * m) / dt;
    if (Math.abs(e.vx) > 4) e.face = e.vx > 0 ? 1 : -1;
  }

  /** After the crowd separates: push every walled-in creature back out of the walls and inside the bounds. */
  collide(g: Game): void {
    const b = PLAYER_BOUNDS;
    const walls = this.walls, dyn = dynamicWalls();
    for (const e of g.active) {
      if (!e.alive || !e.walled || e.def.phases || e.isBoss || e.hidden) continue;
      walls.pushOut(e);
      dyn.pushOut(e);
      for (const bo of g.bosses) {
        if (!bo.solid) continue;
        const rr = bo.solidR + e.r, dx = e.x - bo.x, dy = e.y - bo.y, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          e.x = bo.x + (dx / d) * rr;
          e.y = bo.y + (dy / d) * rr;
        }
      }
      e.x = Math.min(b.maxX - e.r, Math.max(b.minX + e.r, e.x));
      e.y = Math.min(b.maxY - e.r, Math.max(b.minY + e.r, e.y));
    }
  }
}
