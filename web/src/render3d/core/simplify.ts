// Mesh simplification for the crowd's distance models (performance milestone, D-96). A sculpted creature is 5,000 to
// 35,000 triangles; seen at play size (60 to 120 pixels tall) that is two or more triangles to a pixel, and the
// crowd draws each one three times (the picture, the moon's shadow, the silhouette behind scenery). The real-GPU
// benchmark put the crowd at 7 to 17 ms of a 13 to 24 ms frame in a late night at 3440x1440.
//
// Quadric error simplification (Garland and Heckbert) by half-edge collapse: a vertex is folded into a neighbour
// that stays where it is, so every surviving vertex keeps its own normal, colours, bones and pattern exactly and no
// attribute is ever interpolated. Kept as they are: the edges of an open part (a seam between sculpts, a detail's
// rim), small separate parts whole (eyes, noses, buttons, teeth), any fold across a change of pattern, surface, ink
// or main bone, or across a clear change of colour, and any fold that would flip or crush a triangle. Exact
// duplicates (details arrive as triangle soup) are welded first, so a detail is one connected part.

import * as THREE from 'three';

export interface SimplifyOptions {
  /** the fraction of triangles to keep (it may keep more where nothing more can fold cheaply) */
  ratio: number;
  /** the largest error a fold may make, in model units (a quadric distance) */
  maxError: number;
  /** attributes that must match for two vertices to fold (categorical: pattern, surface, ink) */
  hard?: string[];
  /** a colour difference (0..1 per channel, summed squares) above which no fold is made */
  colorStep?: number;
  /** separate parts smaller than this (half their bounding box's diagonal, model units) are left whole: eyes,
   *  noses, buttons and teeth carry a face at play size, and cost few triangles */
  keepSmall?: number;
}

const DEFAULT_HARD = ['aPat', 'aSurf', 'aInkOff'];

/** Weld exact duplicates (same position and every attribute): returns the welded geometry's vertex map. */
function weld(geo: THREE.BufferGeometry): { remap: Int32Array; firsts: Int32Array } {
  const n = geo.getAttribute('position').count;
  const names = Object.keys(geo.attributes);
  const arrs = names.map((k) => geo.getAttribute(k) as THREE.BufferAttribute);
  const remap = new Int32Array(n);
  const seen = new Map<string, number>();
  const firsts: number[] = [];
  for (let i = 0; i < n; i++) {
    let key = '';
    for (const a of arrs) for (let c = 0; c < a.itemSize; c++) key += (a.array as ArrayLike<number>)[i * a.itemSize + c] + ',';
    const j = seen.get(key);
    if (j === undefined) {
      seen.set(key, firsts.length);
      remap[i] = firsts.length;
      firsts.push(i);
    } else remap[i] = j;
  }
  return { remap, firsts: Int32Array.from(firsts) };
}

/** A binary min-heap of candidate folds. */
class Heap {
  cost: number[] = [];
  from: number[] = [];
  to: number[] = [];
  stamp: number[] = [];
  get size(): number {
    return this.cost.length;
  }
  push(c: number, a: number, b: number, s: number): void {
    const h = this;
    let i = h.cost.length;
    h.cost.push(c);
    h.from.push(a);
    h.to.push(b);
    h.stamp.push(s);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h.cost[p] <= c) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): void {
    const h = this, last = h.cost.length - 1;
    this.swap(0, last);
    h.cost.pop();
    h.from.pop();
    h.to.pop();
    h.stamp.pop();
    let i = 0;
    const n = h.cost.length;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < n && h.cost[l] < h.cost[m]) m = l;
      if (r < n && h.cost[r] < h.cost[m]) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
  }
  private swap(i: number, j: number): void {
    const h = this;
    [h.cost[i], h.cost[j]] = [h.cost[j], h.cost[i]];
    [h.from[i], h.from[j]] = [h.from[j], h.from[i]];
    [h.to[i], h.to[j]] = [h.to[j], h.to[i]];
    [h.stamp[i], h.stamp[j]] = [h.stamp[j], h.stamp[i]];
  }
}

/**
 * A simplified copy of an indexed (or soup) geometry: the same attributes, fewer triangles. Returns null if it
 * couldn't save at least a fifth of the triangles (a model that is already plain is drawn as it is).
 */
export function simplifyGeometry(src: THREE.BufferGeometry, o: SimplifyOptions): THREE.BufferGeometry | null {
  const { remap, firsts } = weld(src);
  const nV = firsts.length;
  const sp = src.getAttribute('position') as THREE.BufferAttribute;
  const P = new Float64Array(nV * 3);
  for (let v = 0; v < nV; v++) {
    P[v * 3] = sp.getX(firsts[v]);
    P[v * 3 + 1] = sp.getY(firsts[v]);
    P[v * 3 + 2] = sp.getZ(firsts[v]);
  }
  const srcIdx = src.index ? (src.index.array as ArrayLike<number>) : null;
  const nF0 = srcIdx ? srcIdx.length / 3 : sp.count / 3;
  const F = new Int32Array(nF0 * 3);
  for (let i = 0; i < nF0 * 3; i++) F[i] = remap[srcIdx ? srcIdx[i] : i];
  const alive = new Uint8Array(nF0).fill(1);
  let liveF = 0;
  for (let f = 0; f < nF0; f++) {
    const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
    if (a === b || b === c || a === c) alive[f] = 0;
    else liveF++;
  }
  // faces around each vertex
  const vf: number[][] = Array.from({ length: nV }, () => []);
  for (let f = 0; f < nF0; f++) if (alive[f]) for (let k = 0; k < 3; k++) vf[F[f * 3 + k]].push(f);

  // which vertices may fold into which: the categorical attributes must match, colours be close, the main bone agree
  const hard = (o.hard ?? DEFAULT_HARD).filter((k) => src.getAttribute(k)).map((k) => src.getAttribute(k) as THREE.BufferAttribute);
  const col = src.getAttribute('color') as THREE.BufferAttribute | undefined;
  const skin = src.getAttribute('aSkin') as THREE.BufferAttribute | undefined;
  const colorStep = o.colorStep ?? 0.02;
  const compatible = (a: number, b: number): boolean => {
    const ia = firsts[a], ib = firsts[b];
    for (const h of hard) for (let c = 0; c < h.itemSize; c++) if ((h.array as ArrayLike<number>)[ia * h.itemSize + c] !== (h.array as ArrayLike<number>)[ib * h.itemSize + c]) return false;
    if (col) {
      const dr = col.getX(ia) - col.getX(ib), dg = col.getY(ia) - col.getY(ib), db = col.getZ(ia) - col.getZ(ib);
      if (dr * dr + dg * dg + db * db > colorStep) return false;
    }
    // (aSkin's first component is the main bone)
    if (skin && skin.getX(ia) !== skin.getX(ib)) return false;
    return true;
  };

  // quadrics: each face's plane, weighted by its area, summed into its corners
  const Q = new Float64Array(nV * 10);
  const addPlane = (v: number, nx: number, ny: number, nz: number, d: number, w: number) => {
    const q = v * 10;
    Q[q] += w * nx * nx; Q[q + 1] += w * nx * ny; Q[q + 2] += w * nx * nz; Q[q + 3] += w * nx * d;
    Q[q + 4] += w * ny * ny; Q[q + 5] += w * ny * nz; Q[q + 6] += w * ny * d;
    Q[q + 7] += w * nz * nz; Q[q + 8] += w * nz * d;
    Q[q + 9] += w * d * d;
  };
  for (let f = 0; f < nF0; f++) {
    if (!alive[f]) continue;
    const a = F[f * 3] * 3, b = F[f * 3 + 1] * 3, c = F[f * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;
    nx /= len;
    ny /= len;
    nz /= len;
    const d = -(nx * P[a] + ny * P[a + 1] + nz * P[a + 2]);
    for (let k = 0; k < 3; k++) addPlane(F[f * 3 + k], nx, ny, nz, d, len / 2);
  }
  // the edges of open parts (one face) and of tangles (three or more) stay put
  const locked = new Uint8Array(nV);
  const edgeCount = new Map<number, number>();
  const ekey = (a: number, b: number) => (a < b ? a * nV + b : b * nV + a);
  for (let f = 0; f < nF0; f++) {
    if (!alive[f]) continue;
    for (let k = 0; k < 3; k++) {
      const key = ekey(F[f * 3 + k], F[f * 3 + ((k + 1) % 3)]);
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }
  for (const [key, n] of edgeCount) {
    if (n === 2) continue;
    locked[Math.floor(key / nV)] = 1;
    locked[key % nV] = 1;
  }
  // small separate parts stay whole: connected parts by union-find, measured by their bounding boxes
  const root = new Int32Array(nV);
  for (let v = 0; v < nV; v++) root[v] = v;
  const find = (v: number): number => {
    while (root[v] !== v) v = root[v] = root[root[v]];
    return v;
  };
  for (let f = 0; f < nF0; f++) {
    if (!alive[f]) continue;
    const a = find(F[f * 3]);
    for (let k = 1; k < 3; k++) {
      const b = find(F[f * 3 + k]);
      if (a !== b) root[b] = a;
    }
  }
  const box = new Map<number, number[]>();
  for (let v = 0; v < nV; v++) {
    const r = find(v), x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const b = box.get(r);
    if (!b) box.set(r, [x, y, z, x, y, z]);
    else {
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.min(b[2], z);
      b[3] = Math.max(b[3], x); b[4] = Math.max(b[4], y); b[5] = Math.max(b[5], z);
    }
  }
  const keepSmall = o.keepSmall ?? 6;
  for (let v = 0; v < nV; v++) {
    const b = box.get(find(v))!;
    if (Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) / 2 < keepSmall) locked[v] = 1;
  }

  const removed = new Uint8Array(nV);
  const version = new Int32Array(nV);
  const cost = (a: number, b: number): number => {
    // the summed quadric at b's position
    const qa = a * 10, qb = b * 10;
    const x = P[b * 3], y = P[b * 3 + 1], z = P[b * 3 + 2];
    const q0 = Q[qa] + Q[qb], q1 = Q[qa + 1] + Q[qb + 1], q2 = Q[qa + 2] + Q[qb + 2], q3 = Q[qa + 3] + Q[qb + 3];
    const q4 = Q[qa + 4] + Q[qb + 4], q5 = Q[qa + 5] + Q[qb + 5], q6 = Q[qa + 6] + Q[qb + 6];
    const q7 = Q[qa + 7] + Q[qb + 7], q8 = Q[qa + 8] + Q[qb + 8], q9 = Q[qa + 9] + Q[qb + 9];
    return Math.max(0, q0 * x * x + 2 * q1 * x * y + 2 * q2 * x * z + 2 * q3 * x + q4 * y * y + 2 * q5 * y * z + 2 * q6 * y + q7 * z * z + 2 * q8 * z + q9);
  };
  const heap = new Heap();
  const offer = (a: number, b: number) => {
    // a folds into b
    if (locked[a] || removed[a] || removed[b] || !compatible(a, b)) return;
    heap.push(cost(a, b), a, b, version[a] * 1e6 + version[b]);
  };
  const neighbours = (v: number, out: Set<number>) => {
    out.clear();
    for (const f of vf[v]) if (alive[f]) for (let k = 0; k < 3; k++) if (F[f * 3 + k] !== v) out.add(F[f * 3 + k]);
    return out;
  };
  const nb = new Set<number>(), nb2 = new Set<number>();
  for (let v = 0; v < nV; v++) for (const u of neighbours(v, nb)) offer(v, u);

  const target = Math.max(4, Math.floor(liveF * o.ratio));
  const maxCost = o.maxError * o.maxError;
  const faceNormal = (f: number, sub: number, by: number, out: number[]) => {
    const i0 = F[f * 3] === sub ? by : F[f * 3], i1 = F[f * 3 + 1] === sub ? by : F[f * 3 + 1], i2 = F[f * 3 + 2] === sub ? by : F[f * 3 + 2];
    const a = i0 * 3, b = i1 * 3, c = i2 * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    out[0] = uy * vz - uz * vy;
    out[1] = uz * vx - ux * vz;
    out[2] = ux * vy - uy * vx;
    return Math.hypot(out[0], out[1], out[2]);
  };
  const n0 = [0, 0, 0], n1 = [0, 0, 0];
  while (liveF > target && heap.size) {
    const c = heap.cost[0], a = heap.from[0], b = heap.to[0], st = heap.stamp[0];
    heap.pop();
    if (c > maxCost) break;
    if (removed[a] || removed[b] || st !== version[a] * 1e6 + version[b]) continue;
    // the link condition: a and b may share only the corners of the faces along their edge (no pinching)
    neighbours(a, nb);
    neighbours(b, nb2);
    let shared = 0, edgeFaces = 0;
    for (const u of nb) if (nb2.has(u)) shared++;
    for (const f of vf[a]) if (alive[f] && (F[f * 3] === b || F[f * 3 + 1] === b || F[f * 3 + 2] === b)) edgeFaces++;
    if (edgeFaces !== 2 || shared !== 2) continue;
    // no face may flip or collapse to a sliver
    let ok = true;
    for (const f of vf[a]) {
      if (!alive[f] || F[f * 3] === b || F[f * 3 + 1] === b || F[f * 3 + 2] === b) continue;
      const l0 = faceNormal(f, -1, -1, n0), l1 = faceNormal(f, a, b, n1);
      if (l1 < 1e-9 || (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) / (l0 * l1) < 0.3) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    // fold a into b
    for (const f of vf[a]) {
      if (!alive[f]) continue;
      if (F[f * 3] === b || F[f * 3 + 1] === b || F[f * 3 + 2] === b) {
        alive[f] = 0;
        liveF--;
        continue;
      }
      for (let k = 0; k < 3; k++) if (F[f * 3 + k] === a) F[f * 3 + k] = b;
      vf[b].push(f);
    }
    removed[a] = 1;
    vf[a].length = 0;
    for (let k = 0; k < 10; k++) Q[b * 10 + k] += Q[a * 10 + k];
    // only folds into or out of b cost something new (its quadric grew): the rest stand, checked again when popped
    version[b]++;
    for (const u of neighbours(b, nb)) {
      offer(b, u);
      offer(u, b);
    }
  }
  const nF1 = alive.reduce((s, x) => s + x, 0);
  if (nF1 > nF0 * 0.8) return null;
  // compact: the surviving faces, the vertices they use, every attribute copied over
  const used = new Int32Array(nV).fill(-1);
  const order: number[] = [];
  const idx = new Uint32Array(nF1 * 3);
  let w = 0;
  for (let f = 0; f < nF0; f++) {
    if (!alive[f]) continue;
    for (let k = 0; k < 3; k++) {
      const v = F[f * 3 + k];
      if (used[v] < 0) {
        used[v] = order.length;
        order.push(firsts[v]);
      }
      idx[w++] = used[v];
    }
  }
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(src.attributes)) {
    const ba = a as THREE.BufferAttribute;
    const Arr = (ba.array as Float32Array).constructor as { new (n: number): Float32Array };
    const arr = new Arr(order.length * ba.itemSize);
    for (let i = 0; i < order.length; i++) for (let c = 0; c < ba.itemSize; c++) arr[i * ba.itemSize + c] = (ba.array as ArrayLike<number>)[order[i] * ba.itemSize + c];
    out.setAttribute(name, new THREE.BufferAttribute(arr, ba.itemSize, ba.normalized));
  }
  out.setIndex(new THREE.BufferAttribute(order.length > 65535 ? idx : Uint16Array.from(idx), 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}
