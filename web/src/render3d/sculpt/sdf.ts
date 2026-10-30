// Procedural sculpting (D-40): characters and enemies are modelled as signed distance fields —
// round cones, ellipsoids, rounded boxes and tori melted together with smooth unions (and carved
// with smooth subtractions) — then meshed with surface nets. Normals come from the field gradient
// (no faceting), crevices get baked ambient occlusion from the field, colours blend softly where
// materials meet, and every vertex receives two-bone skin weights for the skeletal rig.
// Crisp small details (eyes, buttons, props) are added as regular meshes bound rigidly to a bone.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C, type ColorFn, type Surf, type V3 } from '../core/geo';

export type Shape =
  | { t: 'sph'; c: V3; r: number }
  | { t: 'ell'; c: V3; r: V3; rot?: V3 }
  | { t: 'cap'; a: V3; b: V3; ra: number; rb: number }
  | { t: 'box'; c: V3; h: V3; r: number; rot?: V3 }
  | { t: 'tor'; c: V3; R: number; r: number; rot?: V3 };

export interface PrimOpts {
  /** Smooth-union radius with what came before (0 = hard union). */
  k?: number;
  col?: number | THREE.Color | ColorFn;
  surf?: Surf;
  emit?: number;
  bone?: number;
  /** Carve this shape away (smooth subtraction with radius k). */
  sub?: boolean;
}

interface Prim {
  s: Shape;
  k: number;
  col: THREE.Color | ColorFn;
  surf: Surf;
  emit: number;
  bone: number;
  sub: boolean;
  inv: THREE.Matrix3 | null;
  lo: THREE.Vector3;
  hi: THREE.Vector3;
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function rotInv(rot?: V3): THREE.Matrix3 | null {
  if (!rot || (rot[0] === 0 && rot[1] === 0 && rot[2] === 0)) return null;
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  return new THREE.Matrix3().setFromMatrix4(m).transpose();
}

function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function smaxSub(d: number, s: number, k: number): number {
  // smooth subtraction: max(d, -s)
  const a = d, b = -s;
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

function dist(p: Prim, x: number, y: number, z: number): number {
  const s = p.s;
  switch (s.t) {
    case 'sph':
      return Math.hypot(x - s.c[0], y - s.c[1], z - s.c[2]) - s.r;
    case 'ell': {
      _v.set(x - s.c[0], y - s.c[1], z - s.c[2]);
      if (p.inv) _v.applyMatrix3(p.inv);
      const k0 = Math.hypot(_v.x / s.r[0], _v.y / s.r[1], _v.z / s.r[2]);
      const k1 = Math.hypot(_v.x / (s.r[0] * s.r[0]), _v.y / (s.r[1] * s.r[1]), _v.z / (s.r[2] * s.r[2]));
      return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(s.r[0], s.r[1], s.r[2]);
    }
    case 'cap': {
      // round cone between a (radius ra) and b (radius rb) — iq
      const bax = s.b[0] - s.a[0], bay = s.b[1] - s.a[1], baz = s.b[2] - s.a[2];
      const l2 = bax * bax + bay * bay + baz * baz;
      if (l2 < 1e-6) return Math.hypot(x - s.a[0], y - s.a[1], z - s.a[2]) - Math.max(s.ra, s.rb);
      const rr = s.ra - s.rb;
      const a2 = l2 - rr * rr;
      const il2 = 1 / l2;
      const pax = x - s.a[0], pay = y - s.a[1], paz = z - s.a[2];
      const yy = pax * bax + pay * bay + paz * baz;
      const zz = yy - l2;
      const xvx = pax * l2 - bax * yy, xvy = pay * l2 - bay * yy, xvz = paz * l2 - baz * yy;
      const x2 = xvx * xvx + xvy * xvy + xvz * xvz;
      const y2 = yy * yy * l2;
      const z2 = zz * zz * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - s.rb;
      if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - s.ra;
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - s.ra;
    }
    case 'box': {
      _v.set(x - s.c[0], y - s.c[1], z - s.c[2]);
      if (p.inv) _v.applyMatrix3(p.inv);
      const qx = Math.abs(_v.x) - s.h[0] + s.r, qy = Math.abs(_v.y) - s.h[1] + s.r, qz = Math.abs(_v.z) - s.h[2] + s.r;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - s.r;
    }
    case 'tor': {
      _v.set(x - s.c[0], y - s.c[1], z - s.c[2]);
      if (p.inv) _v.applyMatrix3(p.inv);
      const q = Math.hypot(_v.x, _v.z) - s.R;
      return Math.hypot(q, _v.y) - s.r;
    }
  }
}

function bounds(s: Shape): [THREE.Vector3, THREE.Vector3] {
  switch (s.t) {
    case 'sph': return [new THREE.Vector3(s.c[0] - s.r, s.c[1] - s.r, s.c[2] - s.r), new THREE.Vector3(s.c[0] + s.r, s.c[1] + s.r, s.c[2] + s.r)];
    case 'ell': { const m = Math.max(...s.r); return [new THREE.Vector3(s.c[0] - m, s.c[1] - m, s.c[2] - m), new THREE.Vector3(s.c[0] + m, s.c[1] + m, s.c[2] + m)]; }
    case 'cap': {
      const r = Math.max(s.ra, s.rb);
      return [
        new THREE.Vector3(Math.min(s.a[0], s.b[0]) - r, Math.min(s.a[1], s.b[1]) - r, Math.min(s.a[2], s.b[2]) - r),
        new THREE.Vector3(Math.max(s.a[0], s.b[0]) + r, Math.max(s.a[1], s.b[1]) + r, Math.max(s.a[2], s.b[2]) + r),
      ];
    }
    case 'box': { const m = Math.hypot(...s.h); return [new THREE.Vector3(s.c[0] - m, s.c[1] - m, s.c[2] - m), new THREE.Vector3(s.c[0] + m, s.c[1] + m, s.c[2] + m)]; }
    case 'tor': { const m = s.R + s.r; return [new THREE.Vector3(s.c[0] - m, s.c[1] - m, s.c[2] - m), new THREE.Vector3(s.c[0] + m, s.c[1] + m, s.c[2] + m)]; }
  }
}

export interface DetailOpts {
  col?: number | THREE.Color;
  bone?: number;
  pos?: V3;
  rot?: V3;
  scale?: number | V3;
  surf?: Surf;
  emit?: number;
}

/**
 * A sculpt: add primitives (in order — smooth unions accumulate), add crisp details, then build.
 * `cell` is the meshing resolution in world units (smaller = finer).
 */
export class Sculpt {
  private prims: Prim[] = [];
  private details: THREE.BufferGeometry[] = [];

  /** `kScale` scales every smooth-blend radius: < 1 gives crisper seams between parts (D-44). */
  constructor(private cell = 1.5, private jointBand = 5, private kScale = 1) {}

  add(s: Shape, o: PrimOpts = {}): this {
    const [lo, hi] = bounds(s);
    const k = (o.k ?? 3) * this.kScale;
    const col = typeof o.col === 'function' ? o.col : o.col instanceof THREE.Color ? o.col : C(o.col ?? 0xffffff);
    this.prims.push({ s, k, col, surf: o.surf ?? [0.6, 0], emit: o.emit ?? 0, bone: o.bone ?? 0, sub: !!o.sub, inv: rotInv((s as { rot?: V3 }).rot), lo, hi });
    return this;
  }

  /** Crisp extra geometry (eyes, buttons, brims, props), bound rigidly to one bone. */
  detail(geo: THREE.BufferGeometry, o: DetailOpts = {}): this {
    const src = geo.index ? geo.toNonIndexed() : geo.clone();
    const m = new THREE.Matrix4();
    const sc = typeof o.scale === 'number' ? new THREE.Vector3(o.scale, o.scale, o.scale) : new THREE.Vector3(...(o.scale ?? [1, 1, 1]));
    m.compose(new THREE.Vector3(...(o.pos ?? [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot ?? [0, 0, 0]))), sc);
    src.applyMatrix4(m);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', src.getAttribute('position'));
    if (!src.getAttribute('normal')) src.computeVertexNormals();
    g.setAttribute('normal', src.getAttribute('normal'));
    const n = g.attributes.position.count;
    const c = o.col instanceof THREE.Color ? o.col : C(o.col ?? 0xffffff);
    const col = new Float32Array(n * 3), sk = new Float32Array(n * 4), su = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      sk[i * 4] = o.bone ?? 0; sk[i * 4 + 1] = o.bone ?? 0; sk[i * 4 + 2] = 1; sk[i * 4 + 3] = 0;
      su[i * 3] = (o.surf ?? [0.5, 0])[0]; su[i * 3 + 1] = (o.surf ?? [0.5, 0])[1]; su[i * 3 + 2] = o.emit ?? 0;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSkin', new THREE.BufferAttribute(sk, 4));
    g.setAttribute('aSurf', new THREE.BufferAttribute(su, 3));
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(idx);
    this.details.push(g);
    return this;
  }

  /** Full field (all primitives) at a point. */
  field(x: number, y: number, z: number): number {
    let d = 1e9;
    for (const p of this.prims) {
      if (p.sub) continue;
      if (x < p.lo.x - p.k - 4 || x > p.hi.x + p.k + 4 || y < p.lo.y - p.k - 4 || y > p.hi.y + p.k + 4 || z < p.lo.z - p.k - 4 || z > p.hi.z + p.k + 4) {
        continue;
      }
      d = smin(d, dist(p, x, y, z), p.k);
    }
    for (const p of this.prims) {
      if (!p.sub) continue;
      if (x < p.lo.x - p.k || x > p.hi.x + p.k || y < p.lo.y - p.k || y > p.hi.y + p.k || z < p.lo.z - p.k || z > p.hi.z + p.k) continue;
      d = smaxSub(d, dist(p, x, y, z), p.k);
    }
    return d;
  }

  build(o: { ao?: number; aoScale?: number; paint?: number } = {}): THREE.BufferGeometry {
    const paint = o.paint ?? 1;
    const h = this.cell;
    const lo = new THREE.Vector3(1e9, 1e9, 1e9), hi = new THREE.Vector3(-1e9, -1e9, -1e9);
    for (const p of this.prims) {
      if (p.sub) continue;
      lo.min(p.lo);
      hi.max(p.hi);
    }
    lo.subScalar(h * 3);
    hi.addScalar(h * 3);
    const nx = Math.ceil((hi.x - lo.x) / h) + 1, ny = Math.ceil((hi.y - lo.y) / h) + 1, nz = Math.ceil((hi.z - lo.z) / h) + 1;
    const N = nx * ny * nz;
    const grid = new Float32Array(N).fill(1e9);
    const idx = (x: number, y: number, z: number) => x + nx * (y + ny * z);
    // sample: union primitives within their (padded) bounds, then subtractions
    for (const pass of [false, true]) {
      for (const p of this.prims) {
        if (p.sub !== pass) continue;
        const pad = p.k + h * 2;
        const x0 = Math.max(0, Math.floor((p.lo.x - pad - lo.x) / h)), x1 = Math.min(nx - 1, Math.ceil((p.hi.x + pad - lo.x) / h));
        const y0 = Math.max(0, Math.floor((p.lo.y - pad - lo.y) / h)), y1 = Math.min(ny - 1, Math.ceil((p.hi.y + pad - lo.y) / h));
        const z0 = Math.max(0, Math.floor((p.lo.z - pad - lo.z) / h)), z1 = Math.min(nz - 1, Math.ceil((p.hi.z + pad - lo.z) / h));
        for (let z = z0; z <= z1; z++) {
          const pz = lo.z + z * h;
          for (let y = y0; y <= y1; y++) {
            const py = lo.y + y * h;
            let i = idx(x0, y, z);
            for (let x = x0; x <= x1; x++, i++) {
              const d = dist(p, lo.x + x * h, py, pz);
              grid[i] = pass ? smaxSub(grid[i], d, p.k) : smin(grid[i], d, p.k);
            }
          }
        }
      }
    }
    // surface nets: one vertex per sign-changing cell at the mean of its edge crossings
    const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
    const cidx = (x: number, y: number, z: number) => x + (nx - 1) * (y + (ny - 1) * z);
    const pos: number[] = [];
    const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const vals = new Float64Array(8);
    for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
      let mask = 0;
      for (let c = 0; c < 8; c++) {
        const v = grid[idx(x + corner[c][0], y + corner[c][1], z + corner[c][2])];
        vals[c] = v;
        if (v < 0) mask |= 1 << c;
      }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, cnt = 0;
      for (const [a, b] of edges) {
        const va = vals[a], vb = vals[b];
        if ((va < 0) === (vb < 0)) continue;
        const t = va / (va - vb);
        sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
        sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
        sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
        cnt++;
      }
      cellVert[cidx(x, y, z)] = pos.length / 3;
      pos.push(lo.x + (x + sx / cnt) * h, lo.y + (y + sy / cnt) * h, lo.z + (z + sz / cnt) * h);
    }
    // faces: a quad for every grid edge that crosses the surface
    const index: number[] = [];
    const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      if (flip) index.push(a, c, b, a, d, c);
      else index.push(a, b, c, a, c, d);
    };
    for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
      const v0 = grid[idx(x, y, z)] < 0;
      // x-edge (x,y,z)→(x+1,y,z): cells around share y-1..y, z-1..z
      if (x < nx - 1 && v0 !== (grid[idx(x + 1, y, z)] < 0)) quad(cellVert[cidx(x, y - 1, z - 1)], cellVert[cidx(x, y, z - 1)], cellVert[cidx(x, y, z)], cellVert[cidx(x, y - 1, z)], !v0);
      if (y < ny - 1 && v0 !== (grid[idx(x, y + 1, z)] < 0)) quad(cellVert[cidx(x - 1, y, z - 1)], cellVert[cidx(x - 1, y, z)], cellVert[cidx(x, y, z)], cellVert[cidx(x, y, z - 1)], !v0);
      if (z < nz - 1 && v0 !== (grid[idx(x, y, z + 1)] < 0)) quad(cellVert[cidx(x - 1, y - 1, z)], cellVert[cidx(x, y - 1, z)], cellVert[cidx(x, y, z)], cellVert[cidx(x - 1, y, z)], !v0);
    }
    const nv = pos.length / 3;
    const nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), sk = new Float32Array(nv * 4), su = new Float32Array(nv * 3);
    const e = h * 0.5;
    const aoK = o.ao ?? 0.6, aoS = o.aoScale ?? 1;
    const tmpC = new THREE.Color(), c1 = new THREE.Color(), c2 = new THREE.Color();
    const pv = new THREE.Vector3(), nvv = new THREE.Vector3();
    for (let i = 0; i < nv; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      // gradient normal (and, from the same six samples, the field's Laplacian ≈ curvature)
      const fx1 = this.field(x + e, y, z), fx0 = this.field(x - e, y, z);
      const fy1 = this.field(x, y + e, z), fy0 = this.field(x, y - e, z);
      const fz1 = this.field(x, y, z + e), fz0 = this.field(x, y, z - e);
      const gx = fx1 - fx0, gy = fy1 - fy0, gz = fz1 - fz0;
      const lap = (fx1 + fx0 + fy1 + fy0 + fz1 + fz0 - 6 * this.field(x, y, z)) / (e * e);
      const gl = Math.hypot(gx, gy, gz) || 1;
      const nx_ = gx / gl, ny_ = gy / gl, nz_ = gz / gl;
      nor[i * 3] = nx_; nor[i * 3 + 1] = ny_; nor[i * 3 + 2] = nz_;
      // nearest two materials (soft colour seams) and nearest two bones (skin weights)
      let d1 = 1e9, d2 = 1e9, p1: Prim | null = null, p2: Prim | null = null;
      let b1 = 0, bd1 = 1e9, b2 = 0, bd2 = 1e9;
      for (const p of this.prims) {
        if (p.sub) continue;
        const d = dist(p, x, y, z);
        if (d < d1) { d2 = d1; p2 = p1; d1 = d; p1 = p; } else if (d < d2) { d2 = d; p2 = p; }
        if (p.bone === b1 && d < bd1) bd1 = d;
        else if (d < bd1) {
          if (p.bone !== b1) { b2 = b1; bd2 = bd1; }
          b1 = p.bone; bd1 = d;
        } else if (p.bone !== b1 && d < bd2) { b2 = p.bone; bd2 = d; }
      }
      pv.set(x, y, z);
      nvv.set(nx_, ny_, nz_);
      const colorOf = (p: Prim, out: THREE.Color) => {
        if (typeof p.col === 'function') {
          const r = p.col(pv, nvv);
          return typeof r === 'number' ? out.set(r) : out.copy(r);
        }
        return out.copy(p.col);
      };
      colorOf(p1!, c1);
      if (p2 && d2 - d1 < 0.8) {
        colorOf(p2, c2);
        const t = 0.5 + 0.5 * Math.min(1, (d2 - d1) / 0.8);
        tmpC.copy(c2).lerp(c1, t);
      } else tmpC.copy(c1);
      // baked occlusion from the field: probe outward along the normal
      if (aoK > 0) {
        let occ = 0;
        for (const [s, wgt] of [[2.5, 0.45], [6, 0.3], [12, 0.18], [20, 0.07]] as const) {
          const sd = s * aoS;
          const f = this.field(x + nx_ * sd, y + ny_ * sd, z + nz_ * sd);
          occ += wgt * Math.max(0, (sd - f) / sd);
        }
        tmpC.multiplyScalar(1 - aoK * Math.min(1, occ * 1.4));
      }
      // hand-painted wear: convex edges catch a lighter stroke, creases sink darker (D-44)
      if (paint > 0) {
        const edge = Math.max(-1, Math.min(1, lap * 1.6 * aoS));
        const hi = edge > 0.2 ? (edge - 0.2) / 0.8 : 0, lo = edge < -0.15 ? (-edge - 0.15) / 0.85 : 0;
        tmpC.multiplyScalar(1 + 0.42 * paint * hi * hi - 0.32 * paint * lo);
      }
      col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b;
      su[i * 3] = p1!.surf[0]; su[i * 3 + 1] = p1!.surf[1]; su[i * 3 + 2] = p1!.emit;
      if (bd2 >= 1e8 || b2 === b1) {
        sk[i * 4] = b1; sk[i * 4 + 1] = b1; sk[i * 4 + 2] = 1; sk[i * 4 + 3] = 0;
      } else {
        const w = 0.5 + 0.5 * Math.min(1, (bd2 - bd1) / this.jointBand);
        sk[i * 4] = b1; sk[i * 4 + 1] = b2; sk[i * 4 + 2] = w; sk[i * 4 + 3] = 1 - w;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSkin', new THREE.BufferAttribute(sk, 4));
    g.setAttribute('aSurf', new THREE.BufferAttribute(su, 3));
    g.setIndex(index);
    const out = this.details.length ? mergeGeometries([g, ...this.details], false)! : g;
    out.computeBoundingSphere();
    out.computeBoundingBox();
    void _w;
    return out;
  }
}
