// Solid walls packed for collision (performance milestone, D-96). The map's props are object literals of many
// shapes, so a push-out that reads `pr.x`, `pr.r`, `pr.hw` across all of them makes every one of those reads a
// megamorphic lookup; on the Ghost Train (1,100 solid props, 79 doors and partitions that come and go) the crowd's
// push-out was half the simulation's time. Here a set of walls is copied once into flat arrays (x, y, r, hw, hh)
// and filed by bucket, so a body only visits the walls near it and every read is a typed-array load.
//
// The rules are the old ones exactly: the same push-out per wall (a circle `r`, or a box `hw` x `hh`), the walls in
// their original order, and a wall is filed into every bucket within REACH of its edges, so every wall that can
// touch a body (radius up to REACH) at the start of its push-out is visited. Players, creatures (sim/nav.ts) and a
// co-op guest's prediction all use these sets, so host and guest collide alike.

import { DYNAMIC_WALLS, PROPS, type Prop } from '../data/map';

/** bucket size (px) */
const BUCKET = 160;
/** how far past its edges a wall is filed: at least the widest body that collides (an elite creature is 39) */
export const REACH = 48;

export const isSolid = (pr: Prop): boolean => !!pr.r || !!(pr.hw && pr.hh);

export interface Body { x: number; y: number; r: number }

export class WallSet {
  readonly n: number;
  private readonly wx: Float64Array;
  private readonly wy: Float64Array;
  /** a circle's radius, or 0 for a box */
  private readonly wr: Float64Array;
  private readonly whw: Float64Array;
  private readonly whh: Float64Array;
  private readonly x0: number;
  private readonly y0: number;
  private readonly cols: number;
  private readonly rows: number;
  /** the walls of bucket b are idx[start[b]] .. idx[start[b + 1] - 1], in their original order */
  private readonly start: Int32Array;
  private readonly idx: Int32Array;

  constructor(props: readonly Prop[]) {
    const solid = props.filter(isSolid);
    const n = (this.n = solid.length);
    this.wx = new Float64Array(n);
    this.wy = new Float64Array(n);
    this.wr = new Float64Array(n);
    this.whw = new Float64Array(n);
    this.whh = new Float64Array(n);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const pr = solid[i];
      this.wx[i] = pr.x;
      this.wy[i] = pr.y;
      this.wr[i] = pr.r ?? 0;
      this.whw[i] = pr.r ? 0 : pr.hw!;
      this.whh[i] = pr.r ? 0 : pr.hh!;
      const ex = (pr.r || pr.hw!) + REACH, ey = (pr.r || pr.hh!) + REACH;
      minX = Math.min(minX, pr.x - ex);
      maxX = Math.max(maxX, pr.x + ex);
      minY = Math.min(minY, pr.y - ey);
      maxY = Math.max(maxY, pr.y + ey);
    }
    if (!n) minX = minY = maxX = maxY = 0;
    this.x0 = minX;
    this.y0 = minY;
    this.cols = Math.max(1, Math.ceil((maxX - minX) / BUCKET));
    this.rows = Math.max(1, Math.ceil((maxY - minY) / BUCKET));
    // two passes: count each bucket's walls, then file them (compressed rows, no per-bucket arrays)
    const count = new Int32Array(this.cols * this.rows + 1);
    const each = (i: number, f: (b: number) => void) => {
      const ex = (this.wr[i] || this.whw[i]) + REACH, ey = (this.wr[i] || this.whh[i]) + REACH;
      const c0 = this.col(this.wx[i] - ex), c1 = this.col(this.wx[i] + ex);
      const r0 = this.row(this.wy[i] - ey), r1 = this.row(this.wy[i] + ey);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) f(r * this.cols + c);
    };
    for (let i = 0; i < n; i++) each(i, (b) => count[b + 1]++);
    for (let b = 0; b < this.cols * this.rows; b++) count[b + 1] += count[b];
    this.start = count;
    this.idx = new Int32Array(count[this.cols * this.rows]);
    const fill = count.slice(0, this.cols * this.rows);
    for (let i = 0; i < n; i++) each(i, (b) => (this.idx[fill[b]++] = i));
  }

  private col(x: number): number {
    return Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.x0) / BUCKET)));
  }
  private row(y: number): number {
    return Math.max(0, Math.min(this.rows - 1, Math.floor((y - this.y0) / BUCKET)));
  }
  /** The bucket at a point, or -1 where no wall is within REACH. */
  private bucket(x: number, y: number): number {
    const c = Math.floor((x - this.x0) / BUCKET), r = Math.floor((y - this.y0) / BUCKET);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  /** Push a body out of every wall near where it stands, in order (the old `pushOut` over each wall). */
  pushOut(p: Body): void {
    const b = this.n ? this.bucket(p.x, p.y) : -1;
    if (b < 0) return;
    const { wx, wy, wr, whw, whh, idx } = this;
    for (let k = this.start[b], end = this.start[b + 1]; k < end; k++) {
      const i = idx[k];
      const r = wr[i];
      if (r > 0) {
        const rr = r + p.r;
        const dx = p.x - wx[i], dy = p.y - wy[i];
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 0.001;
          p.x = wx[i] + (dx / d) * rr;
          p.y = wy[i] + (dy / d) * rr;
        }
      } else {
        const x = wx[i], y = wy[i], hw = whw[i], hh = whh[i];
        const cx = p.x < x - hw ? x - hw : p.x > x + hw ? x + hw : p.x;
        const cy = p.y < y - hh ? y - hh : p.y > y + hh ? y + hh : p.y;
        const dx = p.x - cx, dy = p.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < p.r * p.r) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            p.x = cx + (dx / d) * p.r;
            p.y = cy + (dy / d) * p.r;
          } else {
            // inside the box: push out the shortest axis
            const ox = hw + p.r - Math.abs(p.x - x);
            const oy = hh + p.r - Math.abs(p.y - y);
            if (ox < oy) p.x += p.x < x ? -ox : ox;
            else p.y += p.y < y ? -oy : oy;
          }
        }
      }
    }
  }

  /**
   * Is (x, y) inside a wall, or (with `r`) within r of a circle's edge or r of a box's sides (a box grown square,
   * as the crowd's checks always were)? Looks in the bucket at (bx, by), by default the point's own.
   */
  hits(x: number, y: number, r = 0, bx = x, by = y): boolean {
    const b = this.n ? this.bucket(bx, by) : -1;
    if (b < 0) return false;
    const { wx, wy, wr, whw, whh, idx } = this;
    for (let k = this.start[b], end = this.start[b + 1]; k < end; k++) {
      const i = idx[k];
      if (wr[i] > 0 ? (x - wx[i]) ** 2 + (y - wy[i]) ** 2 < (wr[i] + r) ** 2 : Math.abs(x - wx[i]) < whw[i] + r && Math.abs(y - wy[i]) < whh[i] + r) return true;
    }
    return false;
  }
}

/** The active map's props as a wall set (rebuilt when the map changes). */
let staticFor: readonly Prop[] | null = null;
let staticSet: WallSet | null = null;
export function staticWalls(): WallSet {
  if (staticFor !== PROPS || !staticSet) {
    staticFor = PROPS;
    staticSet = new WallSet(PROPS);
  }
  return staticSet;
}

/**
 * The walls that come and go, as a wall set. The maps hand over the same array while their walls stay the same
 * (sim/funhouse.ts, sim/ghosttrain.ts), so this is built once per arrangement, not once per tick.
 */
const dynamicSets = new WeakMap<readonly Prop[], WallSet>();
let dynamicFor: readonly Prop[] | null = null;
let dynamicSet: WallSet | null = null;
export function dynamicWalls(): WallSet {
  if (dynamicFor !== DYNAMIC_WALLS || !dynamicSet) {
    dynamicFor = DYNAMIC_WALLS;
    let s = dynamicSets.get(DYNAMIC_WALLS);
    if (!s) dynamicSets.set(DYNAMIC_WALLS, (s = new WallSet(DYNAMIC_WALLS)));
    dynamicSet = s;
  }
  return dynamicSet;
}
