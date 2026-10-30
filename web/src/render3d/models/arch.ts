// Architecture kit for the midway's buildings (D-47). The 50° camera mostly sees roofs and fronts,
// so that is where the authored detail goes: parametric canvas that sags between rafters, peaked
// striped roofs with scalloped valances and tassels, shingled pagoda roofs with upturned corners,
// turned posts, arched header boards trimmed with marquee bulbs, sagging bunting. All of it feeds
// the same ModelBuilder/instancing path as the rest of the props.

import * as THREE from 'three';
import { SURF, box, cone, cyl, extrude, lathe, rbox, sphere, tube, weather, type ColorFn, type V3 } from '../core/geo';
import { ModelBuilder, PAL, PART, bulb } from './kit';

type M = ModelBuilder;
type Col = number | THREE.Color | ColorFn;

/**
 * A surface patch from a parametric function over (u, v) ∈ [0,1]², smooth-shaded. The front face is
 * the side the u × v cross product points to; `twoSided` adds a back face for thin cloth.
 */
export function patch(fn: (u: number, v: number) => V3, nu: number, nv: number, twoSided = false): THREE.BufferGeometry {
  const grid: number[] = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) grid.push(...fn(i / nu, j / nv));
  const pos = twoSided ? grid.concat(grid) : grid;
  const half = (nu + 1) * (nv + 1);
  const idx: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
      if (twoSided) idx.push(a + half, c + half, b + half, b + half, c + half, d + half);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Peaked canvas roof with its ridge along X over z = 0: eaves at `eaveY` (z = +front, z = −back),
 * ridge at `ridgeY`. Every stripe is its own patch (crisp colour edges) sagging between the rafters;
 * gable ends are closed, a ridge pole carries finials and pennants that sway.
 */
export function canvasRoof(m: M, o: { w: number; front: number; back: number; eaveY: number; ridgeY: number; stripes: number; a: number; b: number; sag?: number; wear?: number; pennant?: number }): void {
  const n = o.stripes, sag = o.sag ?? 2.4, wear = o.wear ?? 0.45;
  for (const side of [1, -1]) {
    const ze = side > 0 ? o.front : -o.back;
    for (let i = 0; i < n; i++) {
      const x0 = -o.w / 2 + (i / n) * o.w, x1 = -o.w / 2 + ((i + 1) / n) * o.w;
      m.add(patch((u, v) => {
        const uu = side > 0 ? u : 1 - u; // keep the outward winding on the back slope
        const x = x0 + (x1 - x0) * uu;
        const y = o.eaveY + (o.ridgeY - o.eaveY) * v - sag * Math.sin(Math.PI * uu) * Math.sin(Math.PI * Math.min(1, v * 1.15));
        return [x, y, ze * (1 - v)];
      }, 4, 6), { col: weather(i % 2 ? o.a : o.b, wear, 0.05), surf: SURF.canvas });
    }
  }
  // gable ends: triangles of canvas under the roof line
  for (const s of [-1, 1]) {
    const x = (s * o.w) / 2 - s * 0.5;
    m.add(patch((u, v) => {
      const z = s > 0 ? o.front - (o.front + o.back) * u : -o.back + (o.front + o.back) * u;
      const roofY = o.eaveY + (o.ridgeY - o.eaveY) * (1 - Math.abs(z) / (z > 0 ? o.front : o.back));
      return [x, o.eaveY - 2 + (roofY - o.eaveY + 1) * v, z];
    }, 6, 2, true), { col: weather(o.b, wear, 0.05), surf: SURF.canvas });
  }
  // ridge pole, finials and swaying pennants
  m.add(cyl(1.6, 1.6, o.w + 10, 6), { col: weather(PAL.woodDark, 0.4), pos: [0, o.ridgeY + 0.8, 0], rot: [0, 0, Math.PI / 2], surf: SURF.wood });
  for (const s of [-1, 1]) {
    const x = s * (o.w / 2 + 5);
    m.add(cyl(1.2, 1.4, 22, 6), { col: PAL.woodDark, pos: [x, o.ridgeY + 11, 0], surf: SURF.wood });
    m.add(sphere(2.6, 8, 6), { col: PAL.brass, pos: [x, o.ridgeY + 23, 0], surf: SURF.brass });
    m.add(extrude([[0, 0], [22, -4.5], [0, -9]], 0.6, 0, 1), { col: weather(o.pennant ?? PAL.blood, 0.4), pos: [x + 1, o.ridgeY + 21, 0], part: PART.SWAY, pivot: [x, o.ridgeY + 21, 0], surf: SURF.canvas });
  }
}

/** A scalloped valance hanging from a horizontal edge along X (facing +Z), tassels at the points. */
export function valance(m: M, x0: number, x1: number, y: number, z: number, depth: number, n: number, a: number, b: number, tassel: number = PAL.mustard): void {
  for (let i = 0; i < n; i++) {
    const xa = x0 + (x1 - x0) * (i / n), xb = x0 + (x1 - x0) * ((i + 1) / n);
    m.add(patch((u, v) => {
      const drop = depth * (0.5 + 0.5 * Math.sin(Math.PI * u));
      return [xa + (xb - xa) * u, y - drop * v, z + 0.9 * Math.sin(Math.PI * u) * v];
    }, 6, 2, true), { col: weather(i % 2 ? a : b, 0.45, 0.07), surf: SURF.canvas });
    if (i < n - 1) m.add(cone(1.3, 5, 5), { col: tassel, pos: [xb, y - depth * 0.5 - 2.5, z + 0.4], rot: [Math.PI, 0, 0], surf: SURF.cloth });
  }
  m.add(cyl(0.9, 0.9, Math.abs(x1 - x0), 5), { col: weather(PAL.mustard, 0.4), pos: [(x0 + x1) / 2, y + 0.6, z + 0.4], rot: [0, 0, Math.PI / 2], surf: SURF.cloth });
}

/** A turned wooden post: plinth, a ringed shaft and a flared capital. */
export function turnedPost(m: M, x: number, z: number, h: number, r: number, col: Col, y0 = 0): void {
  m.add(lathe([[r * 1.7, 0], [r * 1.7, 5], [r * 1.15, 7], [r, 11], [r * 0.92, h * 0.46], [r * 1.3, h * 0.48], [r * 1.3, h * 0.5], [r * 0.92, h * 0.52], [r * 0.88, h - 12], [r * 1.25, h - 9], [r * 1.25, h - 5], [r * 1.55, h - 2], [r * 1.55, h], [0, h]], 8), { col, pos: [x, y0, z], surf: SURF.wood });
}

/**
 * Arched header board standing at (0, y, z) facing +Z: a painted panel in a darker frame, with
 * marquee bulbs following the arch. The lettering is a separate sign mesh (props.ts).
 */
export function headerBoard(m: M, w: number, h: number, y: number, z: number, panel: number, frame: number, bulbs = 13): void {
  const arch = (W: number, H: number) => {
    const s = new THREE.Shape();
    s.moveTo(-W / 2, 0);
    s.lineTo(W / 2, 0);
    s.lineTo(W / 2, H * 0.62);
    s.quadraticCurveTo(W / 2, H, 0, H);
    s.quadraticCurveTo(-W / 2, H, -W / 2, H * 0.62);
    s.lineTo(-W / 2, 0);
    return s;
  };
  m.add(extrude(arch(w + 8, h + 7), 3, 0, 14), { col: weather(frame, 0.45, 0.08), pos: [0, y - 3.5, z], surf: SURF.wood });
  m.add(extrude(arch(w, h), 2, 0, 14), { col: weather(panel, 0.4, 0.06), pos: [0, y, z + 2], surf: SURF.paint });
  const path = arch(w + 2, h + 2).getSpacedPoints(bulbs * 3);
  const step = Math.floor(path.length / bulbs);
  for (let i = 0; i < bulbs; i++) {
    const p = path[Math.min(path.length - 1, i * step + Math.floor(step / 2))];
    if (p.y < 4) continue;
    bulb(m, [p.x, y - 1 + p.y, z + 3.4], 1.7, i % 2 ? PAL.amber : PAL.hotRed);
  }
  // two struts tie it back to the roof
  for (const s of [-1, 1]) m.add(cyl(0.8, 0.8, 30, 4), { col: PAL.woodDark, pos: [s * w * 0.32, y + h * 0.35, z - 12], rot: [0.95, 0, 0], surf: SURF.wood });
}

/** Triangular pennant bunting strung between two points, sagging, flags swaying. */
export function bunting(m: M, a: V3, b: V3, sag: number, n: number, cols: number[]): void {
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t]);
  }
  m.add(tube(pts, 0.45, 3, n * 2), { col: PAL.charcoal, surf: SURF.cloth });
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[i + 1];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, mz = (p[2] + q[2]) / 2;
    const ang = Math.atan2(q[2] - p[2], q[0] - p[0]);
    const len = Math.hypot(q[0] - p[0], q[2] - p[2]) * 0.8;
    m.add(extrude([[-len / 2, 0], [len / 2, 0], [0, -len * 0.9]], 0.4, 0, 1), { col: weather(cols[i % cols.length], 0.45), pos: [mx, my, mz], rot: [0, -ang, 0], part: PART.SWAY, pivot: [mx, my, mz], surf: SURF.canvas });
  }
}

/** Shingle colour: weathered, darkening into the shadow under the next course's lip. */
function courseShade(col: number, t0: number, t1: number, lipT: number, o: { y: number; h: number }): ColorFn {
  const base = weather(col, 0.55, 0.07);
  return (p, n) => {
    const c = base(p, n) as THREE.Color;
    const t = Math.pow(Math.max(0, (p.y - o.y) / o.h), 1 / 1.25);
    const k = t0 + (t1 - t0) > 0 ? Math.min(1, Math.max(0, (t - t0) / Math.max(1e-3, lipT - t0))) : 0;
    return c.multiplyScalar(1.1 - 0.72 * k * k);
  };
}

/**
 * A hipped pagoda roof (square plan of half-width `hw`, depth scaled by `dz`) built from overlapping
 * shingle courses with scalloped lower edges, concave slopes and upturned corners; hip caps with a
 * bulb at each corner and a gilded finial.
 */
export function pagodaRoof(m: M, o: { hw: number; dz: number; y: number; h: number; courses: number; col: number; trim: number; lift?: number }): void {
  const lift = o.lift ?? 10;
  const prof = (t: number) => 1 - Math.pow(t, 0.75) * 0.94; // concave: half-width factor at height t
  const height = (t: number) => o.y + o.h * Math.pow(t, 1.25);
  // (s across the face −1…1, half-width) → x, z for each face, wound so normals face out and up
  const faces: ((s: number, hf: number) => [number, number])[] = [
    (s, hf) => [s * hf, hf * o.dz],
    (s, hf) => [hf, -s * hf * o.dz],
    (s, hf) => [-s * hf, -hf * o.dz],
    (s, hf) => [-hf, s * hf * o.dz],
  ];
  for (const face of faces) {
    for (let k = 0; k < o.courses; k++) {
      const t0 = k / o.courses, t1 = Math.min(1, (k + 1.3) / o.courses);
      const nSc = Math.max(3, Math.round((o.hw * prof(t0)) / 6));
      m.add(patch((u, v) => {
        const t = t0 + (t1 - t0) * v;
        const s = u * 2 - 1;
        const hf = o.hw * prof(t) * (1 + 0.075 * (1 - v)); // each course lips over the one below
        const scallop = v === 0 ? -3 * (1 - Math.abs(Math.sin(u * Math.PI * nSc))) : 0;
        const corner = Math.pow(Math.abs(s), 4) * lift * (1 - t) * (1 - t);
        const [x, z] = face(s, hf);
        return [x, height(t) + corner + scallop, z];
      }, nSc * 2, 3), { col: courseShade(o.col, t0, t1, (k + 1) / o.courses, o), surf: SURF.wood });
    }
  }
  for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const pts: V3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const hf = o.hw * prof(t);
      pts.push([cx * hf, height(t) + lift * (1 - t) * (1 - t) + 1.4, cz * hf * o.dz]);
    }
    m.add(tube(pts, 1.7, 5, 14), { col: weather(o.trim, 0.4), surf: SURF.paint });
    bulb(m, [cx * o.hw * 1.03, o.y + lift + 3.2, cz * o.hw * o.dz * 1.03], 2.2, PAL.amber);
  }
  m.add(lathe([[0, 0], [5, 0], [6.5, 4], [2.4, 9], [3.2, 14], [0, 26]], 10), { col: PAL.gold, pos: [0, o.y + o.h - 1, 0], surf: SURF.gold });
}

/** Painted diamond motif across a flat panel facing +Z (counter skirts, wagon sides). */
export function diamonds(m: M, x0: number, x1: number, y: number, z: number, size: number, col: number): void {
  const n = Math.max(1, Math.floor((x1 - x0) / (size * 1.8)));
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) / n) * (x1 - x0);
    m.add(box(size, size, 0.6), { col: weather(col, 0.4, 0.1), pos: [x, y, z], rot: [0, 0, Math.PI / 4], surf: SURF.paint });
  }
}

export const _archUnused = { rbox };
