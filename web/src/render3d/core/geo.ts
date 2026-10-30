// Procedural modeling toolkit for the 2.5D renderer (D-35). Primitive generators (lathe, variable-radius
// tube, rounded box, extrusion, ellipsoid…) plus a ModelBuilder that merges parts into one geometry
// carrying per-vertex colour, surface (roughness/metalness), emissive amount, and an animation part
// id + pivot that the actor shader uses for walk cycles, head nods, spinning and swaying parts.
// Conventions: Y up, models stand on y = 0 and face +Z (towards the camera / south).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type V3 = [number, number, number];
export type ColorFn = (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color | number;

/** Animation part ids (see materials.ts). */
export const PART = { BODY: 0, HEAD: 1, ARM_L: 2, ARM_R: 3, LEG_L: 4, LEG_R: 5, SPIN: 6, SWAY: 7 } as const;

/** Surface presets: [roughness, metalness]. */
export const SURF = {
  cloth: [0.95, 0], canvas: [0.88, 0], wood: [0.78, 0], paint: [0.58, 0], skin: [0.62, 0], rubber: [0.42, 0],
  brass: [0.34, 0.8], iron: [0.5, 0.65], glass: [0.1, 0.1], bulb: [0.3, 0], velvet: [1, 0], porcelain: [0.22, 0],
  plush: [1, 0], gold: [0.28, 0.95], latex: [0.3, 0], bone: [0.7, 0],
} as const satisfies Record<string, readonly [number, number]>;
export type Surf = readonly [number, number];

// ------------------------------------------------------------------ colour helpers
const _tmp = new THREE.Color();
export const C = (hex: number): THREE.Color => new THREE.Color(hex);

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
/** Smooth 3D value noise in [0,1]. */
export function vnoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), ux), l(c(0, 1, 0), c(1, 1, 0), ux), uy),
    l(l(c(0, 0, 1), c(1, 0, 1), ux), l(c(0, 1, 1), c(1, 1, 1), ux), uy),
    uz,
  );
}

/** Weathered paint: blotchy darkening, desaturation and the odd flake of bare primer. */
export function weather(base: number | THREE.Color, amount = 0.35, scale = 0.06, bare: number | null = null): ColorFn {
  const b = typeof base === 'number' ? C(base) : base;
  const bareC = bare === null ? null : C(bare);
  return (p) => {
    const n = vnoise(p.x * scale, p.y * scale, p.z * scale) * 0.65 + vnoise(p.x * scale * 3.1, p.y * scale * 3.1, p.z * scale * 3.1) * 0.35;
    const out = b.clone();
    if (bareC && n > 0.78) return out.lerp(bareC, Math.min(1, (n - 0.78) * 6));
    const k = 1 - amount * Math.max(0, n - 0.35) * 1.6;
    out.multiplyScalar(k);
    const grey = (out.r + out.g + out.b) / 3;
    return out.lerp(_tmp.setRGB(grey, grey, grey), amount * 0.35 * n);
  };
}

/** Vertical stripes around the Y axis (tents, canopies, balloons). */
export function stripes(count: number, a: number, b: number, phase = 0, wear = 0.25): ColorFn {
  const wa = weather(a, wear), wb = weather(b, wear);
  return (p, n) => {
    const ang = Math.atan2(p.z, p.x) / (Math.PI * 2) + 0.5 + phase;
    return Math.floor(ang * count) % 2 === 0 ? wa(p, n) : wb(p, n);
  };
}

/** Horizontal bands by height. `stops` = [[yAbove, colour], …] ascending. */
export function bands(stops: [number, number][], wear = 0.2): ColorFn {
  const fns = stops.map(([y, c]) => [y, weather(c, wear)] as const);
  return (p, n) => {
    let f = fns[0][1];
    for (const [y, fn] of fns) if (p.y >= y) f = fn;
    return f(p, n);
  };
}

export function mix(a: number, b: number, t: number): THREE.Color {
  return C(a).lerp(C(b), t);
}

// ------------------------------------------------------------------ primitives
export function spline2(pts: [number, number][], n = 24): [number, number][] {
  const curve = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return curve.getPoints(n).map((v) => [v.x, v.y] as [number, number]);
}

/** Surface of revolution around Y from [radius, y] pairs (smoothed when `smooth` > 0). */
export function lathe(profile: [number, number][], segs = 14, smooth = 0, phi0 = 0, phiLen = Math.PI * 2): THREE.BufferGeometry {
  const pts = smooth > 0 ? spline2(profile, smooth) : profile;
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segs, phi0, phiLen);
}

export function ellipsoid(rx: number, ry: number, rz: number, ws = 14, hs = 10): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

export function sphere(r: number, ws = 12, hs = 8): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, ws, hs);
}

export function cyl(rTop: number, rBot: number, h: number, segs = 10, open = false): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBot, h, segs, 1, open);
}

export function cone(r: number, h: number, segs = 10): THREE.BufferGeometry {
  return new THREE.ConeGeometry(r, h, segs);
}

export function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

export function rbox(w: number, h: number, d: number, r: number, seg = 2): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
}

/** Torus in the XY plane (axis +Z). */
export function torus(R: number, r: number, radial = 8, tubular = 20, arc = Math.PI * 2): THREE.BufferGeometry {
  return new THREE.TorusGeometry(R, r, radial, tubular, arc);
}

/**
 * Tube along a Catmull-Rom path with a constant or varying radius (limbs, rails, tentacles, wires),
 * capped at both ends. Winding/normal conventions match THREE.TubeGeometry.
 */
export function tube(points: V3[], radius: number | ((t: number) => number), radial = 7, steps = 0, closed = false): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), closed, 'catmullrom', 0.5);
  const n = steps || Math.max(4, (points.length - 1) * 5);
  const frames = curve.computeFrenetFrames(n, closed);
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  const radAt = (t: number) => (typeof radius === 'number' ? radius : radius(t));
  for (let j = 0; j <= n; j++) {
    const t = j / n;
    curve.getPointAt(t, P);
    const r = radAt(t);
    const Nn = frames.normals[j], B = frames.binormals[j];
    for (let i = 0; i <= radial; i++) {
      const v = (i / radial) * Math.PI * 2;
      const sin = Math.sin(v), cos = -Math.cos(v);
      N.set(cos * Nn.x + sin * B.x, cos * Nn.y + sin * B.y, cos * Nn.z + sin * B.z).normalize();
      pos.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z);
      nor.push(N.x, N.y, N.z);
    }
  }
  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= radial; i++) {
      const a = (radial + 1) * (j - 1) + (i - 1);
      const b = (radial + 1) * j + (i - 1);
      const c = (radial + 1) * j + i;
      const d = (radial + 1) * (j - 1) + i;
      idx.push(a, b, d, b, c, d);
    }
  }
  if (!closed) {
    // end caps (fans)
    for (const end of [0, 1]) {
      const r = radAt(end);
      if (r <= 0.01) continue;
      curve.getPointAt(end, P);
      const T = frames.tangents[end ? n : 0].clone().multiplyScalar(end ? 1 : -1);
      const center = pos.length / 3;
      pos.push(P.x, P.y, P.z);
      nor.push(T.x, T.y, T.z);
      const ring0 = (end ? n : 0) * (radial + 1);
      const capStart = pos.length / 3;
      for (let i = 0; i <= radial; i++) {
        const k = (ring0 + i) * 3;
        pos.push(pos[k], pos[k + 1], pos[k + 2]);
        nor.push(T.x, T.y, T.z);
      }
      for (let i = 0; i < radial; i++) {
        if (end) idx.push(center, capStart + i, capStart + i + 1);
        else idx.push(center, capStart + i + 1, capStart + i);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Extruded 2D outline (in XY), centred on its depth along Z. */
export function extrude(shape: THREE.Shape | [number, number][], depth: number, bevel = 0, curveSegs = 6, bevelSegs = 2): THREE.BufferGeometry {
  const s = Array.isArray(shape) ? new THREE.Shape(shape.map(([x, y]) => new THREE.Vector2(x, y))) : shape;
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: bevelSegs, curveSegments: curveSegs,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** A closed smooth outline through control points (Catmull-Rom), as a Shape. */
export function smoothShape(pts: [number, number][], n = 48): THREE.Shape {
  const c = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)).concat([new THREE.Vector2(pts[0][0], pts[0][1])]));
  return new THREE.Shape(c.getPoints(n));
}

export function starShape(points: number, rOut: number, rIn: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? rIn : rOut;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

/** Catenary-ish sagging wire points between two anchors. */
export function sagPoints(a: V3, b: V3, sag: number, n = 8): V3[] {
  const out: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}

// ------------------------------------------------------------------ model builder
export interface PartOpts {
  col?: number | THREE.Color | ColorFn;
  part?: number;
  pivot?: V3;
  pos?: V3;
  rot?: V3;
  scale?: number | V3;
  surf?: Surf;
  emit?: number;
  /** Recompute face normals (hard-surface look). */
  flat?: boolean;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();

export class ModelBuilder {
  private parts: THREE.BufferGeometry[] = [];

  add(geo: THREE.BufferGeometry, o: PartOpts = {}): this {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', src.getAttribute('position').clone());
    if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal').clone());
    else g.computeVertexNormals();
    _e.set(o.rot?.[0] ?? 0, o.rot?.[1] ?? 0, o.rot?.[2] ?? 0);
    _q.setFromEuler(_e);
    if (typeof o.scale === 'number') _s.set(o.scale, o.scale, o.scale);
    else _s.set(o.scale?.[0] ?? 1, o.scale?.[1] ?? 1, o.scale?.[2] ?? 1);
    _v.set(o.pos?.[0] ?? 0, o.pos?.[1] ?? 0, o.pos?.[2] ?? 0);
    _m.compose(_v, _q, _s);
    g.applyMatrix4(_m);
    if (o.flat) {
      g.deleteAttribute('normal');
      g.computeVertexNormals();
    }
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3), part = new Float32Array(n), piv = new Float32Array(n * 3), surf = new Float32Array(n * 3);
    const P = g.attributes.position as THREE.BufferAttribute, N = g.attributes.normal as THREE.BufferAttribute;
    const fixed = typeof o.col === 'function' ? null : o.col instanceof THREE.Color ? o.col : C(o.col ?? 0xffffff);
    const fn = typeof o.col === 'function' ? o.col : null;
    const pv = o.pivot ?? [0, 0, 0];
    const sf = o.surf ?? SURF.paint;
    const pid = o.part ?? 0;
    const em = o.emit ?? 0;
    for (let i = 0; i < n; i++) {
      let c = fixed!;
      if (fn) {
        _p.fromBufferAttribute(P, i);
        _n.fromBufferAttribute(N, i);
        const r = fn(_p, _n);
        c = typeof r === 'number' ? _tmp.set(r) : r;
      }
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      part[i] = pid;
      piv[i * 3] = pv[0];
      piv[i * 3 + 1] = pv[1];
      piv[i * 3 + 2] = pv[2];
      surf[i * 3] = sf[0];
      surf[i * 3 + 1] = sf[1];
      surf[i * 3 + 2] = em;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
    g.setAttribute('aPivot', new THREE.BufferAttribute(piv, 3));
    g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 3));
    this.parts.push(g);
    return this;
  }

  /** Add a part and its mirror image across X (left/right pairs). Part ids swap L↔R automatically. */
  pair(geo: THREE.BufferGeometry, o: PartOpts = {}): this {
    this.add(geo, o);
    const mirrorPart = o.part === PART.ARM_L ? PART.ARM_R : o.part === PART.LEG_L ? PART.LEG_R : o.part;
    const pos = o.pos ?? [0, 0, 0];
    const rot = o.rot ?? [0, 0, 0];
    const piv = o.pivot;
    const m = geo.clone();
    m.scale(-1, 1, 1);
    // flip winding so the mirrored copy is not inside-out
    const flipped = m.index ? m.toNonIndexed() : m;
    const p = flipped.attributes.position as THREE.BufferAttribute;
    const nn = flipped.attributes.normal as THREE.BufferAttribute | undefined;
    for (let i = 0; i < p.count; i += 3) {
      for (const a of nn ? [p, nn] : [p]) {
        const x = a.getX(i + 1), y = a.getY(i + 1), z = a.getZ(i + 1);
        a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2));
        a.setXYZ(i + 2, x, y, z);
      }
    }
    return this.add(flipped, { ...o, part: mirrorPart, pos: [-pos[0], pos[1], pos[2]], rot: [rot[0], -rot[1], -rot[2]], pivot: piv ? [-piv[0], piv[1], piv[2]] : undefined });
  }

  /** Merge all parts. `ao` darkens low and down-facing vertices (cheap baked occlusion). */
  build(o: { ao?: number; aoHeight?: number } = {}): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false);
    if (!g) throw new Error('ModelBuilder: empty model');
    const ao = o.ao ?? 0.45;
    if (ao > 0) {
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      const h = o.aoHeight ?? Math.max(1, (bb.max.y - bb.min.y) * 0.4);
      const P = g.attributes.position as THREE.BufferAttribute, N = g.attributes.normal as THREE.BufferAttribute, Cc = g.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < P.count; i++) {
        const y = P.getY(i) - bb.min.y;
        const low = 1 - Math.min(1, y / h);
        const down = Math.max(0, -N.getY(i));
        const k = 1 - ao * (low * low * 0.7 + down * 0.35);
        Cc.setXYZ(i, Cc.getX(i) * k, Cc.getY(i) * k, Cc.getZ(i) * k);
      }
    }
    g.computeBoundingSphere();
    g.computeBoundingBox();
    for (const p of this.parts) p.dispose();
    this.parts = [];
    return g;
  }
}

/** Shallow geometry view sharing the source's vertex buffers (so each InstancedMesh can own its instance attributes). */
export function shareGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const k of Object.keys(src.attributes)) g.setAttribute(k, src.attributes[k]);
  if (src.index) g.setIndex(src.index);
  g.boundingBox = src.boundingBox;
  g.boundingSphere = src.boundingSphere;
  return g;
}
