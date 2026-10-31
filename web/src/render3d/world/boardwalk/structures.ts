// The Boardwalk's façade row (D-68): the buildings standing shoulder to shoulder along the promenade's
// landward edge, every one with a face of its own (the camera looks north, so the detail is on the south
// faces and the roofs). The Grand Pavilion's arcade and copper dome anchor the middle, after the photograph's
// casino; clapboard shops with false fronts and striped awnings; the fish market's wharf shed; the
// Undertow's timber station; the Starlight Ballroom's deco front; and dark hills behind the rides.
// Signs are painted canvases; marquee bulbs are reported to the lighting module for their halos.

import * as THREE from 'three';
import { BUILDING, type Building } from '../../../data/boardwalk';
import { C, SURF, box, cone, cyl, extrude, lathe, sphere, torus, vnoise, weather, type ColorFn } from '../../core/geo';
import { ModelBuilder, PAL } from '../../models/kit';
import { signMesh } from '../props';

/** A bulb on a sign or a marquee: where it is (sim x/y, height) and its colour. */
export interface Bulb { x: number; y: number; h: number; col: [number, number, number] }

const stucco = weather(0xcfc0a2, 0.5, 0.02, 0x7a6c5c);
const stuccoShade = weather(0x9a8c74, 0.45, 0.03);
const teal = weather(0x2c625c, 0.45, 0.03, 0x1a2a28);
const terracotta: ColorFn = (p) => C(0x7a3424).multiplyScalar(0.7 + 0.35 * vnoise(p.x * 0.05, p.y * 0.3, p.z * 0.05)).lerp(C(0x3a3a30), Math.max(0, vnoise(p.x * 0.02, 0, p.z * 0.02) - 0.62) * 1.6);
const copper: ColorFn = (p) => C(0x3f7a66).multiplyScalar(0.7 + 0.3 * vnoise(p.x * 0.04, p.y * 0.04, p.z * 0.04)).lerp(C(0x1e2e28), Math.max(0, vnoise(p.x * 0.1, p.y * 0.1, p.z * 0.1) - 0.6) * 1.4);
const shingle: ColorFn = (p) => C(0x2c2a2e).multiplyScalar(0.75 + 0.4 * vnoise(Math.floor(p.x / 9), Math.floor(p.y / 6), Math.floor(p.z / 9)));
const trimWhite = weather(0xd6d0c4, 0.45, 0.04, 0x8a8478);
const dkWood = weather(PAL.woodDark, 0.4, 0.05);
const glassWarm = 0xffc878;

function clap(base: number): ColorFn {
  // clapboard: horizontal boards with a shadow line under each, paint peeling to grey wood
  const peel = weather(base, 0.5, 0.04, 0x6a6258);
  return (p, n) => {
    const c = peel(p, n);
    const col = typeof c === 'number' ? C(c) : c;
    const line = ((p.y % 12) + 12) % 12 < 1.6 ? 0.55 : 1;
    return col.multiplyScalar(line);
  };
}

/** A gabled roof over a rectangle, ridge running east-west, eaves overhanging. */
function gable(m: ModelBuilder, x0: number, x1: number, z0: number, z1: number, h: number, rise: number, col: ColorFn | number): void {
  const w = x1 - x0 + 24, d = (z1 - z0) / 2 + 14, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const slope = Math.atan2(rise, d);
  const len = Math.hypot(d, rise);
  m.add(box(w, 5, len), { col, pos: [cx, h + rise / 2, cz + d / 2], rot: [slope, 0, 0], surf: SURF.wood });
  m.add(box(w, 5, len), { col, pos: [cx, h + rise / 2, cz - d / 2], rot: [-slope, 0, 0], surf: SURF.wood });
  m.add(box(w + 4, 7, 9), { col: dkWood, pos: [cx, h + rise + 1, cz], surf: SURF.wood });
}

/** A clapboard shop with a false front, a painted sign, a striped awning and lit windows. */
function shopfront(m: ModelBuilder, b: Building, o: { h: number; siding: number; stripe: [number, number]; parapet?: number; bays?: number }): { sign: [number, number, number, number] } {
  const x0 = b.x0, x1 = b.x1, z0 = b.y0, z1 = b.y1, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const H = o.h, ph = o.parapet ?? 60;
  m.add(box(w, H, d), { col: clap(o.siding), pos: [cx, H / 2, cz], surf: SURF.paint });
  gable(m, x0, x1, z0, z1 - 10, H, 70, shingle);
  // the false front: a tall parapet with a cornice, over the whole width
  m.add(box(w + 8, ph, 10), { col: clap(o.siding), pos: [cx, H + ph / 2 - 4, z1 + 4], surf: SURF.paint });
  m.add(box(w + 18, 8, 16), { col: trimWhite, pos: [cx, H + ph, z1 + 6], surf: SURF.paint });
  m.add(box(w + 12, 6, 14), { col: trimWhite, pos: [cx, H - 6, z1 + 6], surf: SURF.paint });
  // corner boards and the plinth
  for (const x of [x0 + 4, x1 - 4]) m.add(box(9, H + ph - 6, 12), { col: trimWhite, pos: [x, (H + ph) / 2 - 4, z1 + 3], surf: SURF.paint });
  m.add(box(w + 4, 12, 14), { col: dkWood, pos: [cx, 6, z1 + 2], surf: SURF.wood });
  // the shop windows either side of the door, lit from inside, with mullions
  const bays = o.bays ?? 2;
  const door = 56;
  const span = (w - door - 40) / bays;
  for (let i = 0; i < bays; i++) {
    const side = i < bays / 2 ? -1 : 1;
    const k = i < bays / 2 ? i : i - bays / 2;
    const wx = cx + side * (door / 2 + 14 + span * (k + 0.5));
    m.add(box(span - 16, 72, 3), { col: C(glassWarm), pos: [wx, 62, z1 + 2], surf: SURF.glass, emit: 0.32 });
    m.add(box(span - 8, 6, 8), { col: trimWhite, pos: [wx, 101, z1 + 4], surf: SURF.paint });
    m.add(box(span - 8, 6, 10), { col: trimWhite, pos: [wx, 24, z1 + 5], surf: SURF.paint });
    for (const t of [-0.17, 0.17]) m.add(box(2.5, 72, 4), { col: trimWhite, pos: [wx + t * span, 62, z1 + 3], surf: SURF.paint });
  }
  m.add(box(door, 96, 4), { col: C(0x1a120e), pos: [cx, 48, z1 + 2], surf: SURF.wood });
  m.add(box(door * 0.6, 34, 3), { col: C(glassWarm), pos: [cx, 70, z1 + 3], surf: SURF.glass, emit: 0.25 });
  // the striped awning, sagging a little, scalloped at the hem
  const n = Math.max(6, Math.round((w - 20) / 26));
  for (let i = 0; i < n; i++) {
    const sx = x0 + 10 + ((w - 20) * (i + 0.5)) / n;
    m.add(box((w - 20) / n + 0.5, 3, 62), { col: weather(i % 2 ? o.stripe[0] : o.stripe[1], 0.45, 0.05), pos: [sx, 118, z1 + 32], rot: [0.5, 0, 0], surf: SURF.canvas });
    m.add(sphere((w - 20) / n / 2, 8, 4), { col: weather(i % 2 ? o.stripe[0] : o.stripe[1], 0.45, 0.05), pos: [sx, 104, z1 + 58], scale: [1, 0.5, 0.25], surf: SURF.canvas });
  }
  return { sign: [cx, H + ph / 2 - 2, z1 + 10, w * 0.78] };
}

export function buildStructures(root: THREE.Object3D): { geo: THREE.BufferGeometry; signs: THREE.Mesh[]; bulbs: Bulb[]; windows: { x: number; y: number; h: number; col: [number, number, number] }[] } {
  const m = new ModelBuilder();
  const signs: THREE.Mesh[] = [];
  const bulbs: Bulb[] = [];
  const windows: { x: number; y: number; h: number; col: [number, number, number] }[] = [];
  const sign = (text: string, w: number, h: number, x: number, y: number, z: number, o: { color?: string; glow?: number; bg?: string } = {}) => {
    const s = signMesh(text, w, h, o);
    s.position.set(x, y, z);
    root.add(s);
    signs.push(s);
  };
  const marquee = (x0: number, x1: number, y: number, z: number, step: number, col: [number, number, number]) => {
    for (let x = x0; x <= x1 + 0.1; x += step) {
      m.add(sphere(3.4, 8, 6), { col: C(0xfff0c8), pos: [x, y, z], surf: SURF.bulb, emit: 1.3 });
      bulbs.push({ x, y: z, h: y, col });
    }
  };

  // ---------------------------------------------------------------- the clapboard shops
  for (const [id, o, text, sub] of [
    ['clamshack', { h: 150, siding: 0x8a8a7a, stripe: [0x6a1e22, 0xd8d0b8] as [number, number] }, 'CLAM SHACK', 'CHOWDER · FRIED CLAMS'],
    ['tintype', { h: 160, siding: 0x4a4a56, stripe: [0x26283a, 0xb8b0a0] as [number, number] }, 'TINTYPE PORTRAITS', 'YOUR LIKENESS IN 10 MINUTES'],
    ['taffy', { h: 160, siding: 0xb88aa0, stripe: [0x9a2a5a, 0xe8d8d0] as [number, number] }, 'SALT & SUGAR', 'SALTWATER TAFFY WORKS'],
  ] as [string, { h: number; siding: number; stripe: [number, number] }, string, string][]) {
    const b = BUILDING[id];
    const { sign: s } = shopfront(m, b, o);
    sign(text, s[3], 34, s[0], s[1] + 8, s[2], { glow: 0.5, color: '#e8dcc0' });
    sign(sub, s[3] * 0.85, 16, s[0], s[1] - 18, s[2], { glow: 0.3, color: '#c8b898' });
    windows.push({ x: s[0], y: b.y1 + 30, h: 70, col: [1, 0.72, 0.42] });
  }
  // the taffy works: the pulling machine turning in its window (two brass arms and a rope of pink taffy)
  {
    const b = BUILDING.taffy, cx = (b.x0 + b.x1) / 2 - 90, z = b.y1 + 8;
    m.add(cyl(14, 14, 6, 16), { col: PAL.brass, pos: [cx, 66, z], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
    for (const s of [-1, 1]) m.add(box(4, 40, 4), { col: PAL.brass, pos: [cx + s * 12, 66, z + 2], rot: [0, 0, s * 0.7], surf: SURF.brass });
    m.add(torus(18, 5, 8, 18), { col: C(0xe890b0), pos: [cx, 66, z + 3], surf: SURF.latex });
  }

  // ---------------------------------------------------------------- Penhallow Fish & Tackle: the wharf shed
  {
    const b = BUILDING.fishmarket, x0 = b.x0, x1 = b.x1, z0 = b.y0, z1 = b.y1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    m.add(box(w, 170, d), { col: clap(0x5a6a6a), pos: [cx, 85, cz], surf: SURF.paint });
    // a big gable end facing the promenade: the roof ridge runs north-south
    const rise = 150, half = w / 2 + 16, len = Math.hypot(half, rise), sl = Math.atan2(rise, half);
    m.add(box(len, 6, d + 30), { col: shingle, pos: [cx - half / 2, 170 + rise / 2, cz], rot: [0, 0, sl], surf: SURF.wood });
    m.add(box(len, 6, d + 30), { col: shingle, pos: [cx + half / 2, 170 + rise / 2, cz], rot: [0, 0, -sl], surf: SURF.wood });
    // the gable's triangle: stacked boards narrowing to the peak
    for (let i = 0; i < 9; i++) {
      const y = 175 + i * (rise / 9), ww = w * (1 - (i + 0.5) / 9);
      m.add(box(ww, rise / 9 - 1, 8), { col: clap(0x5a6a6a), pos: [cx, y + rise / 18, z1 + 2], surf: SURF.paint });
    }
    // sliding doors, a loft door with its hoist beam, a hanging swordfish
    for (const s of [-1, 1]) m.add(box(150, 130, 6), { col: weather(0x3a2a22, 0.5, 0.04), pos: [cx + s * 90, 65, z1 + 4], surf: SURF.wood });
    m.add(box(8, 140, 10), { col: dkWood, pos: [cx, 70, z1 + 6], surf: SURF.wood });
    m.add(box(70, 70, 6), { col: C(glassWarm), pos: [cx, 230, z1 + 5], surf: SURF.glass, emit: 0.22 });
    m.add(box(10, 10, 60), { col: dkWood, pos: [cx, 285, z1 + 30], surf: SURF.wood });
    m.add(cone(14, 120, 8), { col: weather(0x4a5a6a, 0.4), pos: [cx + 120, 208, z1 + 24], rot: [0, 0, Math.PI / 2], surf: SURF.paint });
    m.add(cone(4, 60, 6), { col: weather(0x4a5a6a, 0.4), pos: [cx + 40, 208, z1 + 24], rot: [0, 0, Math.PI / 2], surf: SURF.paint });
    sign('PENHALLOW FISH & TACKLE CO.', w * 0.8, 30, cx, 150, z1 + 8, { glow: 0.35, color: '#d8d4c4' });
    windows.push({ x: cx, y: z1 + 20, h: 230, col: [1, 0.75, 0.45] });
  }

  // ---------------------------------------------------------------- the Grand Pavilion (after the photograph's casino)
  {
    const b = BUILDING.pavilion, x0 = b.x0, x1 = b.x1, z0 = b.y0, z1 = b.y1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    const H = 190;
    m.add(box(w, H, d - 60), { col: stucco, pos: [cx, H / 2, cz - 30], surf: SURF.paint });
    // the ground-floor arcade: eleven arches with a teal band beneath and dark red awnings in the bays
    const bays = 11, bw = w / bays;
    m.add(box(w + 10, 26, 64), { col: teal, pos: [cx, 13, z1 - 30], surf: SURF.paint });
    m.add(box(w, 14, 70), { col: stucco, pos: [cx, 138, z1 - 30], surf: SURF.paint });
    for (let i = 0; i <= bays; i++) m.add(box(16, 112, 18), { col: stucco, pos: [x0 + i * bw, 82, z1 - 4], surf: SURF.paint });
    for (let i = 0; i < bays; i++) {
      const ax = x0 + (i + 0.5) * bw;
      m.add(torus(bw / 2 - 8, 6, 6, 14, Math.PI), { col: trimWhite, pos: [ax, 108, z1 - 4], surf: SURF.paint });
      // the recessed wall behind each arch: a door or a window, lit warm; a scrap of red awning
      m.add(box(bw - 26, 70, 3), { col: C(i % 3 === 1 ? 0xffb860 : 0x6a2a24), pos: [ax, 62, z1 - 60], surf: SURF.glass, emit: i % 3 === 1 ? 0.35 : 0.06 });
      if (i % 2 === 0) m.add(box(bw - 18, 3, 40), { col: weather(0x6a1a1a, 0.5, 0.05), pos: [ax, 104, z1 - 16], rot: [0.45, 0, 0], surf: SURF.canvas });
      if (i % 3 === 1) windows.push({ x: ax, y: z1 - 40, h: 60, col: [1, 0.7, 0.4] });
    }
    // the upper storey: round windows, a balustrade, the cornice
    for (let i = 0; i < bays; i++) {
      const ax = x0 + (i + 0.5) * bw;
      m.add(torus(13, 3.4, 6, 16), { col: trimWhite, pos: [ax, 166, z1 - 59], surf: SURF.paint });
      m.add(cyl(11, 11, 2, 14), { col: C(0x8ab0c0), pos: [ax, 166, z1 - 59], rot: [Math.PI / 2, 0, 0], surf: SURF.glass, emit: 0.12 });
    }
    for (let x = x0 + 10; x < x1; x += 22) m.add(cyl(3, 3.6, 18, 6), { col: trimWhite, pos: [x, 154, z1 - 4], surf: SURF.paint });
    m.add(box(w + 6, 5, 22), { col: trimWhite, pos: [cx, 164, z1 - 4], surf: SURF.paint });
    m.add(box(w + 20, 10, d - 40), { col: stuccoShade, pos: [cx, H + 5, cz - 30], surf: SURF.paint });
    // red tile hip roofs on both wings
    for (const [rx0, rx1] of [[x0, cx - 170], [cx + 170, x1]]) {
      const rw = rx1 - rx0, rcx = (rx0 + rx1) / 2;
      const rise = 70, half = (d - 70) / 2, len = Math.hypot(half, rise), sl = Math.atan2(rise, half);
      m.add(box(rw, 6, len), { col: terracotta, pos: [rcx, H + 10 + rise / 2, cz - 30 + half / 2], rot: [sl, 0, 0], surf: SURF.paint });
      m.add(box(rw, 6, len), { col: terracotta, pos: [rcx, H + 10 + rise / 2, cz - 30 - half / 2], rot: [-sl, 0, 0], surf: SURF.paint });
      m.add(box(rw, 7, 10), { col: C(0x5a2a1e), pos: [rcx, H + 10 + rise, cz - 30], surf: SURF.paint });
    }
    // the rotunda: a drum of columns, the copper dome with its ribs, the lantern cupola and the flagpole
    const rx = cx, rz = cz - 20, R = 150;
    m.add(cyl(R + 14, R + 14, 16, 32), { col: stuccoShade, pos: [rx, H + 18, rz], surf: SURF.paint });
    m.add(cyl(R - 10, R - 10, 110, 28), { col: stucco, pos: [rx, H + 81, rz], surf: SURF.paint });
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      m.add(cyl(6, 7, 108, 8), { col: trimWhite, pos: [rx + Math.cos(a) * R, H + 80, rz + Math.sin(a) * R], surf: SURF.paint });
      if (k % 2 === 0) m.add(box(30, 50, 3), { col: C(glassWarm), pos: [rx + Math.cos(a) * (R - 12), H + 88, rz + Math.sin(a) * (R - 12)], rot: [0, -a + Math.PI / 2, 0], surf: SURF.glass, emit: 0.28 });
    }
    m.add(cyl(R + 10, R + 10, 12, 32), { col: trimWhite, pos: [rx, H + 140, rz], surf: SURF.paint });
    m.add(lathe([[0, 0], [R + 4, 0], [R, 40], [R * 0.86, 88], [R * 0.6, 128], [R * 0.3, 150], [0, 156]], 28), { col: copper, pos: [rx, H + 146, rz], surf: SURF.brass });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      m.add(lathe([[R + 6, 0], [R + 2, 40], [R * 0.88, 88], [R * 0.62, 128], [R * 0.32, 150]], 3, 0, a, 0.03), { col: C(0x2a5a4a), pos: [rx, H + 146, rz], surf: SURF.brass });
    }
    m.add(cyl(22, 24, 40, 12), { col: trimWhite, pos: [rx, H + 318, rz], surf: SURF.paint });
    m.add(lathe([[0, 0], [28, 0], [22, 14], [10, 26], [0, 30]], 12), { col: copper, pos: [rx, H + 338, rz], surf: SURF.brass });
    m.add(cyl(2.6, 2.6, 190, 6), { col: PAL.iron, pos: [rx, H + 460, rz], surf: SURF.iron });
    m.add(box(70, 36, 2), { col: weather(0x5a1a1a, 0.6, 0.08, 0x2a2a2a), pos: [rx + 38, H + 530, rz], rot: [0, 0.2, 0.05], surf: SURF.cloth });
    m.add(sphere(5, 8, 6), { col: PAL.gold, pos: [rx, H + 556, rz], surf: SURF.gold });
    // the grand entrance in the middle bays: a marquee canopy, the sign, a ring of bulbs
    m.add(box(260, 10, 80), { col: dkWood, pos: [cx, 150, z1 + 30], surf: SURF.wood });
    m.add(box(270, 26, 6), { col: C(0x2a1a14), pos: [cx, 170, z1 + 70], surf: SURF.wood });
    marquee(cx - 125, cx + 125, 184, z1 + 72, 18, [1, 0.72, 0.4]);
    marquee(cx - 125, cx + 125, 156, z1 + 72, 18, [1, 0.72, 0.4]);
    sign('THE GRAND PAVILION', 250, 22, cx, 170, z1 + 74, { glow: 0.8, color: '#ffe0a8' });
    sign('BALLROOM  ·  CAROUSEL  ·  DANCING NIGHTLY', 360, 18, cx, 208, z1 - 2, { glow: 0.35, color: '#d8c8a8' });
    windows.push({ x: cx, y: z1 + 40, h: 120, col: [1, 0.72, 0.42] });
  }

  // ---------------------------------------------------------------- the Undertow's station: an open timber shed
  {
    const b = BUILDING.station, x0 = b.x0, x1 = b.x1, z0 = b.y0, z1 = b.y1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    m.add(box(w, 150, 40), { col: clap(0x6a5a4a), pos: [cx, 75, z0 + 20], surf: SURF.paint });
    for (let x = x0 + 10; x <= x1 - 9; x += (w - 20) / 6) {
      for (const z of [z1 - 10, z0 + 60]) m.add(box(14, 150, 14), { col: dkWood, pos: [x, 75, z], surf: SURF.wood });
      m.add(box(6, 70, 6), { col: dkWood, pos: [x + 20, 120, z1 - 10], rot: [0, 0, 0.7], surf: SURF.wood });
    }
    const rise = 90, half = d / 2 + 30, len = Math.hypot(half, rise), sl = Math.atan2(rise, half);
    const corr: ColorFn = (p) => C(0x4a4440).multiplyScalar(0.7 + 0.3 * Math.abs(Math.sin(p.x * 0.4)) + 0.2 * vnoise(p.x * 0.02, 0, p.z * 0.02));
    m.add(box(w + 30, 5, len), { col: corr, pos: [cx, 150 + rise / 2, cz + half / 2 - 10], rot: [sl, 0, 0], surf: SURF.iron });
    m.add(box(w + 30, 5, len), { col: corr, pos: [cx, 150 + rise / 2, cz - half / 2 - 10], rot: [-sl, 0, 0], surf: SURF.iron });
    // the queue rails zig-zagging on the platform
    for (let i = 0; i < 4; i++) m.add(box(w - 120, 4, 4), { col: PAL.iron, pos: [cx, 40, z1 - 40 - i * 34], surf: SURF.iron });
    // the sign: a cresting wave of a board with chasing bulbs round it
    m.add(box(360, 70, 8), { col: weather(0x1a2a3a, 0.4), pos: [cx, 205, z1 + 2], surf: SURF.paint });
    marquee(cx - 170, cx + 170, 244, z1 + 8, 17, [0.4, 0.8, 1]);
    marquee(cx - 170, cx + 170, 168, z1 + 8, 17, [0.4, 0.8, 1]);
    sign('THE UNDERTOW', 320, 40, cx, 210, z1 + 8, { glow: 0.9, color: '#a8e0ff' });
    sign('RIDE IF YOU DARE', 220, 16, cx, 182, z1 + 8, { glow: 0.4, color: '#d8e8f0' });
    windows.push({ x: cx, y: z1 - 60, h: 100, col: [0.6, 0.8, 1] });
  }

  // ---------------------------------------------------------------- the Starlight Ballroom: stepped deco, a great arched window
  {
    const b = BUILDING.ballroom, x0 = b.x0, x1 = b.x1, z0 = b.y0, z1 = b.y1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    const deco = weather(0x3a3a4e, 0.45, 0.03);
    m.add(box(w, 180, d), { col: deco, pos: [cx, 90, cz], surf: SURF.paint });
    // stepped parapet towers and vertical fins
    // (the inner pair only where the front is wide enough to keep them clear of the great window)
    const towers: [number, number][] = [[-w / 2 + 38, 280], [w / 2 - 38, 280]];
    if (w > 620) towers.push([-w / 2 + 120, 240], [w / 2 - 120, 240]);
    for (const [ox, hh] of towers) {
      m.add(box(70, hh, 40), { col: deco, pos: [cx + ox, hh / 2, z1 - 10], surf: SURF.paint });
      for (const f of [-22, 0, 22]) m.add(box(6, hh - 30, 6), { col: trimWhite, pos: [cx + ox + f, (hh - 30) / 2 + 20, z1 + 12], surf: SURF.paint });
    }
    // the great arched window, glowing dim violet, with a sunburst of mullions
    const arch = new THREE.Shape();
    arch.moveTo(-120, 0);
    arch.lineTo(120, 0);
    arch.lineTo(120, 120);
    arch.absarc(0, 120, 120, 0, Math.PI, false);
    arch.lineTo(-120, 0);
    m.add(extrude(arch, 4, 0, 24), { col: C(0x5a4a9a), pos: [cx, 30, z1 + 3], surf: SURF.glass, emit: 0.35 });
    for (let k = 0; k < 9; k++) {
      const a = (k / 8) * Math.PI;
      m.add(box(3, 120, 4), { col: trimWhite, pos: [cx + Math.cos(a) * 60, 150 + Math.sin(a) * 60, z1 + 6], rot: [0, 0, a - Math.PI / 2], surf: SURF.paint });
    }
    for (let k = 0; k < 7; k++) {
      const a = 0.4 + (k / 6) * (Math.PI - 0.8);
      bulbs.push({ x: cx + Math.cos(a) * 150, y: z1 + 10, h: 150 + Math.sin(a) * 150, col: [0.8, 0.7, 1] });
      m.add(sphere(3.4, 8, 6), { col: C(0xfff0c8), pos: [cx + Math.cos(a) * 150, 150 + Math.sin(a) * 150, z1 + 10], surf: SURF.bulb, emit: 1.3 });
    }
    sign('STARLIGHT BALLROOM', 300, 30, cx, 310, z1 + 4, { glow: 0.7, color: '#d8c8ff' });
    windows.push({ x: cx, y: z1 + 20, h: 120, col: [0.7, 0.6, 1] });
  }

  // ---------------------------------------------------------------- the hills behind the rides
  {
    const ridge = (x: number) => 120 + 160 * (0.5 + 0.5 * Math.sin(x * 0.0011 + 1.2)) + 90 * Math.sin(x * 0.0031 + 0.3);
    for (let x = -5200; x < 5200; x += 160) {
      const h = ridge(x);
      m.add(box(170, h, 700), { col: weather(0x14161a, 0.3, 0.004), pos: [x + 80, h / 2 - 20, -2700], surf: SURF.canvas });
      // dead pines along the crest
      if (Math.sin(x * 12.9898) > 0.2) {
        const th = 120 + 80 * (0.5 + 0.5 * Math.sin(x * 0.07));
        m.add(cone(26, th, 6), { col: C(0x0e100e), pos: [x + 60, h + th / 2 - 30, -2420], surf: SURF.canvas });
      }
    }
    // a chain-link fence along the ride grounds' north edge
    for (let x = -3900; x < 3900; x += 200) m.add(box(4, 90, 4), { col: PAL.iron, pos: [x, 45, -2240], surf: SURF.iron });
    m.add(box(7800, 70, 1.5), { col: C(0x3a3a3c), pos: [0, 50, -2240], surf: SURF.iron });
  }
  return { geo: m.build({ ao: 0.35 }), signs, bulbs, windows };
}
