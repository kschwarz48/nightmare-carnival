// Realistic-proportion figures for the playable cast (D-42), modelled on the art reference: weary
// 1930s carnival workers about seven heads tall — slim limbs, bare hands, gaunt faces with stubble
// and tired eyes, messy hair, rolled sleeves, cuffed and patched trousers, worn shoes with socks.
// The anatomy follows real landmarks rather than stacked blobs: a squared ribcage tapering to the
// waist, trapezius slopes from the neck to the shoulders, deltoids that belong to the arms, a neck
// you can see, and a head built from cranium, face plane, jaw, cheekbones and a small straight nose.

import * as THREE from 'three';
import { C, SURF, ellipsoid, rbox, vnoise, type ColorFn, type V3 } from '../core/geo';
import { PAL } from '../models/kit';
import { Sculpt, type Shape } from './sdf';
import type { Proportions } from './humanoid';

type Col = number | THREE.Color | ColorFn;

/** ~7 heads tall, slim. Height to the crown ≈ 89; joints at real landmark heights. */
export const REAL: Proportions = {
  hip: 45, knee: 25, ankle: 4, stance: 4.4, waist: 54, chest: 64, shoulderY: 72.5, shoulderX: 8.8, elbowY: 56.8, wristY: 44.4, armOut: 1.2,
  neck: 75.5, headY: 81.9, headR: 6.1, leg: [3.6, 2.6, 1.9], arm: [2.3, 1.85, 1.5], hipW: 7.2, waistW: 6.5, chestW: 8.4, depth: 0.64,
};

/** Skin with a stubble shadow on the jaw and dark rings under the eyes. */
export function weatheredSkin(base: number, P: Proportions, o: { stubble?: number; rings?: number } = {}): ColorFn {
  const skin = C(base);
  const stubble = C(base).multiplyScalar(0.62).lerp(C(0x3a3a46), 0.25);
  const ring = C(base).multiplyScalar(0.72).lerp(C(0x5a3a52), 0.35);
  return (p) => {
    const out = skin.clone().multiplyScalar(0.92 + 0.08 * vnoise(p.x * 0.6, p.y * 0.6, p.z * 0.6));
    const dy = p.y - P.headY;
    if (o.stubble && p.z > P.headR * 0.15 && dy < -P.headR * 0.18 && dy > -P.headR * 1.05) {
      const k = Math.min(1, (-P.headR * 0.18 - dy) / (P.headR * 0.25)) * o.stubble * (0.75 + 0.25 * vnoise(p.x * 3, p.y * 3, p.z * 3));
      out.lerp(stubble, k);
    }
    if (o.rings && p.z > P.headR * 0.62 && Math.abs(Math.abs(p.x) - P.headR * 0.34) < P.headR * 0.2 && dy > -P.headR * 0.06 && dy < P.headR * 0.06) out.lerp(ring, o.rings);
    return out;
  };
}

/**
 * Depth of the sculpted surface seen from the front (+Z) at (x, y), from everything added so far —
 * where crisp details (eyes, buttons, badges, moustaches) should sit.
 */
export function frontZ(sc: Sculpt, x: number, y: number, from = 30): number {
  let z = from;
  while (z > -from && sc.field(x, y, z) > 0) z -= 0.5;
  let lo = z, hi = z + 0.5;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (sc.field(x, y, mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** A flat colour for crisp details cut from a (possibly procedural) skin or cloth colour. */
function solid(col: Col, at: V3): THREE.Color {
  if (typeof col === 'function') return new THREE.Color().set(col(new THREE.Vector3(...at), new THREE.Vector3(0, 0, 1)));
  return col instanceof THREE.Color ? col : C(col);
}

/** A capsule spanning a → b (finger bones, straps). */
function segment(a: V3, b: V3, r: number, radial = 6): THREE.BufferGeometry {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const g = new THREE.CapsuleGeometry(r, Math.max(0.01, d.length()), 3, radial);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

/** Head from real landmarks: cranium, a flatter face plane, cheekbones, a jaw meeting at the chin, a small straight nose, flat ears. */
export function realHead(sc: Sculpt, P: Proportions, bone: number, skin: Col, o: { jaw?: number; nose?: number; chin?: number } = {}): void {
  const r = P.headR, y = P.headY, jw = o.jaw ?? 1, nz = o.nose ?? 1, ch = o.chin ?? 1;
  const sk = { col: skin, bone, surf: SURF.skin };
  // cranium, longer front-to-back than wide; the face plane from brow to mouth
  sc.add({ t: 'ell', c: [0, y + r * 0.16, -r * 0.1], r: [r * 0.84, r * 1.0, r * 1.0] }, { ...sk, k: 1.2 });
  sc.add({ t: 'ell', c: [0, y - r * 0.14, r * 0.36], r: [r * 0.66, r * 0.64, r * 0.56] }, { ...sk, k: 1.5 });
  // jaw: two rami from below the ears down to a modest chin
  for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * r * 0.47 * jw, y - r * 0.3, -r * 0.12], b: [s * r * 0.18, y - r * 0.84, r * 0.56], ra: r * 0.16, rb: r * 0.15 }, { ...sk, k: 1.8 });
  sc.add({ t: 'ell', c: [0, y - r * 0.84, r * 0.62], r: [r * 0.24 * ch, r * 0.17, r * 0.18] }, { ...sk, k: 1.2 });
  for (const s of [1, -1]) {
    // cheekbones: a subtle shelf under the eyes, not apples
    sc.add({ t: 'ell', c: [s * r * 0.5, y - r * 0.08, r * 0.62], r: [r * 0.24, r * 0.1, r * 0.16], rot: [0, s * 0.5, 0] }, { ...sk, k: 1.4 });
    // ears: thin and flat to the head
    sc.add({ t: 'ell', c: [s * r * 0.84, y - r * 0.02, -r * 0.1], r: [r * 0.08, r * 0.25, r * 0.16], rot: [0, s * 0.25, 0] }, { ...sk, k: 0.6 });
    // eye sockets: shallow hollows under the brow
    sc.add({ t: 'ell', c: [s * r * 0.34, y + r * 0.1, r * 0.9], r: [r * 0.2, r * 0.12, r * 0.14] }, { sub: true, k: 0.9 });
  }
  sc.add({ t: 'ell', c: [0, y + r * 0.3, r * 0.72], r: [r * 0.56, r * 0.1, r * 0.2] }, { ...sk, k: 1.4 });
  // nose: a narrow straight bridge, a modest tip and nostril wings — about 2 cm of projection
  sc.add({ t: 'cap', a: [0, y + r * 0.16, r * 0.84], b: [0, y - r * 0.24, r * (0.96 + 0.04 * nz)], ra: r * 0.07, rb: r * 0.095 * nz }, { ...sk, k: 0.9 });
  for (const s of [1, -1]) sc.add({ t: 'ell', c: [s * r * 0.09, y - r * 0.28, r * 0.88], r: [r * 0.07, r * 0.055, r * 0.075] }, { ...sk, k: 0.6 });
  // lips
  sc.add({ t: 'ell', c: [0, y - r * 0.47, r * 0.82], r: [r * 0.25, r * 0.06, r * 0.09] }, { ...sk, k: 0.7 });
  sc.add({ t: 'ell', c: [0, y - r * 0.57, r * 0.8], r: [r * 0.21, r * 0.065, r * 0.09] }, { ...sk, k: 0.7 });
}

/** Almond eyes set into the sockets, worried brows, a thin mouth — all seated on the sculpted surface. */
export function realFace(sc: Sculpt, P: Proportions, bone: number, o: { iris?: number; brow?: number; browTilt?: number; mouth?: number; frown?: number; glow?: number } = {}): void {
  const r = P.headR, y = P.headY;
  const lash = C(PAL.skin).multiplyScalar(0.4);
  for (const s of [1, -1]) {
    const x = s * r * 0.34, ey = y + r * 0.1;
    const z = frontZ(sc, x, ey) - r * 0.02;
    sc.detail(ellipsoid(r * 0.14, r * 0.058, r * 0.05, 10, 6), { col: 0xcbbfac, bone, pos: [x, ey, z], rot: [0, s * 0.3, 0], surf: SURF.skin });
    sc.detail(ellipsoid(r * 0.066, r * 0.06, r * 0.03, 8, 6), { col: o.iris ?? 0x2a1c14, bone, pos: [x + s * r * 0.005, ey, z + r * 0.035], surf: SURF.glass, emit: o.glow ?? 0 });
    // dark lash line under a heavy upper lid
    sc.detail(ellipsoid(r * 0.155, r * 0.026, r * 0.06, 8, 4), { col: lash, bone, pos: [x, ey + r * 0.056, z + r * 0.012], rot: [0.15, s * 0.3, -s * 0.08], surf: SURF.skin });
    const bx = s * r * 0.36, by = y + r * 0.3;
    sc.detail(rbox(r * 0.34, r * 0.05, r * 0.07, r * 0.02, 1), { col: o.brow ?? 0x1e1612, bone, pos: [bx, by, frontZ(sc, bx, by) - r * 0.02], rot: [0, s * 0.3, s * (o.browTilt ?? 0.22)], surf: SURF.cloth });
  }
  const my = y - r * 0.52, fr = o.frown ?? 0.04;
  sc.detail(rbox(r * 0.36, r * 0.034, r * 0.05, r * 0.015, 1), { col: o.mouth ?? 0x5a2e2a, bone, pos: [0, my, frontZ(sc, 0, my) - r * 0.012], surf: SURF.skin });
  for (const s of [1, -1]) {
    const cx = s * r * 0.19, cy = my - fr * r;
    sc.detail(rbox(r * 0.08, r * 0.03, r * 0.05, r * 0.015, 1), { col: o.mouth ?? 0x5a2e2a, bone, pos: [cx, cy, frontZ(sc, cx, cy) - r * 0.012], rot: [0, s * 0.35, s * 0.5], surf: SURF.skin });
  }
}

/** A messy mop of hair: clumps over the crown and back, a few locks falling across the brow. */
export function messyHair(sc: Sculpt, P: Proportions, bone: number, col: number, o: { volume?: number; fringe?: number; seed?: number; locks?: number } = {}): void {
  const r = P.headR * (o.volume ?? 1), y = P.headY;
  const hair = C(col);
  const tone: ColorFn = (p) => hair.clone().multiplyScalar(0.8 + 0.4 * vnoise(p.x * 1.4, p.y * 1.4, p.z * 1.4));
  sc.add({ t: 'ell', c: [0, y + r * 0.5, -r * 0.18], r: [r * 1.0, r * 0.66, r * 1.0] }, { col: tone, bone, k: 1, surf: SURF.cloth });
  const seed = o.seed ?? 3;
  const locks = o.locks ?? 16;
  for (let i = 0; i < locks; i++) {
    const a = (i / locks) * Math.PI * 2 + seed;
    const front = Math.cos(a - Math.PI / 2) > 0.55;
    if (front && i % 2) continue;
    const tipR = r * (1.08 + 0.12 * vnoise(i, seed, 1));
    sc.add({ t: 'cap', a: [Math.cos(a) * r * 0.5, y + r * 0.62, Math.sin(a) * r * 0.5 - r * 0.15], b: [Math.cos(a) * tipR, y + r * (0.15 + 0.3 * vnoise(i, 2, seed)), Math.sin(a) * tipR - r * 0.1], ra: r * 0.27, rb: r * 0.04 }, { col: tone, bone, k: 0.35, surf: SURF.cloth });
  }
  for (let i = 0; i < (o.fringe ?? 3); i++) {
    const x = (i - 1) * r * 0.32 + 0.4;
    sc.add({ t: 'cap', a: [x, y + r * 0.85, r * 0.55], b: [x + r * 0.12 * (i - 1), y + r * 0.32, r * 0.95], ra: r * 0.15, rb: r * 0.025 }, { col: tone, bone, k: 0.25, surf: SURF.cloth });
  }
}

/**
 * Bare hand hanging relaxed, at real size: the palm turned to the thigh, thumb forward, four
 * jointed fingers loosely curled. Fingers are crisp capsules so they read at any mesh resolution.
 */
export function bareHand(sc: Sculpt, wr: V3, s: number, r: number, col: Col, bone: number): void {
  const palm: V3 = [wr[0] + s * 0.1, wr[1] - r * 1.75, wr[2] + 0.2];
  sc.add({ t: 'ell', c: palm, r: [r * 0.5, r * 1.6, r * 1.35] }, { col, bone, k: 0.9, surf: SURF.skin });
  const flesh = solid(col, palm);
  const fr = r * 0.26;
  const lengths = [2.5, 2.75, 2.6, 2.1];
  for (let i = 0; i < 4; i++) {
    const L = lengths[i] * r;
    const k: V3 = [palm[0] - s * r * 0.04, palm[1] - r * 1.3, palm[2] + r * (0.92 - i * 0.6)];
    const m: V3 = [k[0] - s * L * 0.12, k[1] - L * 0.55, k[2] - r * 0.04];
    const t: V3 = [m[0] - s * L * 0.26, m[1] - L * 0.36, m[2] - r * 0.06];
    sc.detail(segment(k, m, fr), { col: flesh, bone, surf: SURF.skin });
    sc.detail(segment(m, t, fr * 0.88), { col: flesh, bone, surf: SURF.skin });
  }
  const t0: V3 = [palm[0] - s * r * 0.12, palm[1] + r * 0.35, palm[2] + r * 1.05];
  const t1: V3 = [palm[0] - s * r * 0.34, palm[1] - r * 0.8, palm[2] + r * 1.5];
  const t2: V3 = [palm[0] - s * r * 0.55, palm[1] - r * 1.65, palm[2] + r * 1.42];
  sc.detail(segment(t0, t1, r * 0.31), { col: flesh, bone, surf: SURF.skin });
  sc.detail(segment(t1, t2, r * 0.26), { col: flesh, bone, surf: SURF.skin });
}

export interface RealCols {
  skin: Col;
  shirt: Col;
  trousers: Col;
  shoe: number;
  sock?: number;
  /** sleeves rolled to the elbow (forearms bare) */
  rolled?: boolean;
  /** cuffed trouser hems */
  cuffs?: boolean;
  hands?: Col;
  skipLegs?: boolean;
}

export type TorsoBone = 'spine' | 'chest';

/**
 * Torso volumes over the pelvis: an abdomen tapering up into a squared ribcage with a flat front,
 * and trapezius slopes from the neck to the shoulders. `grow` inflates them for garments worn over
 * the body (waistcoats, jackets), so a costume follows the same silhouette.
 */
export function torsoShapes(P: Proportions, grow = 0): { s: Shape; bone: TorsoBone; k: number }[] {
  const g = grow, D = P.depth;
  const top = P.shoulderY + 0.6, bot = P.chest - 2.5;
  const rib = P.chestW * 0.38, taper = 0.1;
  const hw = P.chestW - 0.5, low = hw * (1 - taper);
  // the ribcage widens toward the shoulders; the abdomen's taper meets its lower edge flush (same
  // width and depth), so the torso reads as one V from shoulders to waist, with no ledge
  const out: { s: Shape; bone: TorsoBone; k: number }[] = [
    { s: { t: 'cap', a: [0, P.waist - 4, 0.25], b: [0, bot + 0.5, 0.25], ra: P.waistW + g, rb: low + g, sz: D }, bone: 'spine', k: 3 },
    { s: { t: 'box', c: [0, (top + bot) / 2, 0.25], h: [hw + g, (top - bot) / 2 + g, low * D + g * D], r: rib + g * 0.5, tx: taper }, bone: 'chest', k: 3 },
  ];
  for (const s of [1, -1]) out.push({ s: { t: 'cap', a: [s * 1.5, P.neck - 1.4, -0.9], b: [s * (P.shoulderX - 1.3), P.shoulderY + 0.2, -0.4], ra: P.headR * 0.32 + g, rb: P.arm[0] * 0.68 + g }, bone: 'chest', k: 2.5 });
  return out;
}

/** Jointed anatomy under the costume. */
export function realBody(sc: Sculpt, P: Proportions, b: (n: string) => number, c: RealCols): void {
  const cloth = SURF.cloth;
  sc.add({ t: 'ell', c: [0, P.hip + 1.5, 0], r: [P.hipW, 6, P.hipW * P.depth * 1.05] }, { col: c.trousers, bone: b('hips'), k: 1.5, surf: cloth });
  for (const t of torsoShapes(P)) sc.add(t.s, { col: c.shirt, bone: b(t.bone), k: t.k, surf: cloth });
  // a neck you can see: as thick as a real one, leaning forward into the head
  sc.add({ t: 'cap', a: [0, P.neck - 3.5, -0.6], b: [0, P.neck + 3.4, 0.4], ra: P.headR * 0.45, rb: P.headR * 0.4 }, { col: c.skin, bone: b('neck'), k: 1.6, surf: SURF.skin });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const dr = P.arm[0];
    const el: V3 = [s * (P.shoulderX + P.armOut), P.elbowY, -0.6];
    const wr: V3 = [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.6];
    // the deltoid caps the shoulder and belongs to the arm, so it lifts and swings with it; the
    // upper arm starts beneath it rather than ending in a ball at the joint
    sc.add({ t: 'ell', c: [s * (P.shoulderX + 0.2), P.shoulderY - dr * 1.4, 0.1], r: [dr * 1.1 + 0.2, dr * 1.85, dr * 1.1 + 0.4], rot: [0, 0, s * 0.1] }, { col: c.shirt, bone: b(`arm${n}`), k: 1.8, surf: cloth });
    sc.add({ t: 'cap', a: [s * (P.shoulderX + 0.1), P.shoulderY - dr * 0.7, 0], b: el, ra: dr * 0.95, rb: P.arm[1] }, { col: c.shirt, bone: b(`arm${n}`), k: 1.2, surf: cloth });
    sc.add({ t: 'cap', a: el, b: wr, ra: P.arm[1], rb: P.arm[2] * 0.9 }, { col: c.rolled ? c.skin : c.shirt, bone: b(`fore${n}`), k: 0.8, surf: c.rolled ? SURF.skin : cloth });
    if (c.rolled) {
      // bare forearm: the muscle belly just below the elbow, then a rolled sleeve (two folds and a crease)
      sc.add({ t: 'ell', c: [el[0] + (wr[0] - el[0]) * 0.3 + s * 0.15, el[1] + (wr[1] - el[1]) * 0.3, el[2] + (wr[2] - el[2]) * 0.3 + 0.2], r: [P.arm[1] * 0.95, 3.4, P.arm[1]] }, { col: c.skin, bone: b(`fore${n}`), k: 1.2, surf: SURF.skin });
      sc.add({ t: 'tor', c: [el[0], el[1] + 0.2, el[2]], R: P.arm[1] + 0.4, r: 0.85 }, { col: c.shirt, bone: b(`arm${n}`), k: 0.15, surf: cloth });
      sc.add({ t: 'tor', c: [el[0], el[1] + 1.5, el[2]], R: P.arm[1] + 0.35, r: 0.75 }, { col: c.shirt, bone: b(`arm${n}`), k: 0.15, surf: cloth });
    }
    bareHand(sc, wr, s, P.arm[2], c.hands ?? c.skin, b(`hand${n}`));
    if (c.skipLegs) continue;
    const hp: V3 = [s * P.stance, P.hip - 1, 0];
    const kn: V3 = [s * (P.stance + 0.3), P.knee, 0.5];
    const an: V3 = [s * (P.stance + 0.3), P.ankle + 1.5, 0];
    sc.add({ t: 'cap', a: hp, b: kn, ra: P.leg[0] + 0.6, rb: P.leg[1] + 0.6 }, { col: c.trousers, bone: b(`thigh${n}`), k: 2, surf: cloth });
    sc.add({ t: 'cap', a: kn, b: an, ra: P.leg[1] + 0.6, rb: P.leg[2] + 0.8 }, { col: c.trousers, bone: b(`shin${n}`), k: 1, surf: cloth });
    if (c.cuffs) sc.add({ t: 'tor', c: [an[0], an[1] + 1, an[2]], R: P.leg[2] + 0.9, r: 0.9 }, { col: c.trousers, bone: b(`shin${n}`), k: 0.4, surf: cloth });
    if (c.sock !== undefined) sc.add({ t: 'cap', a: [an[0], an[1] + 0.2, an[2]], b: [an[0], P.ankle - 1, an[2] + 0.2], ra: P.leg[2] + 0.2, rb: P.leg[2] + 0.3 }, { col: c.sock, bone: b(`foot${n}`), k: 0.5, surf: cloth });
    // shoe at real length: a defined upper, a hard welted sole and heel, laces across the instep
    sc.add({ t: 'ell', c: [an[0], 2.1, 2.7], r: [2.5, 1.85, 5.8], rot: [-0.05, 0, 0] }, { col: c.shoe, bone: b(`foot${n}`), k: 0.5, surf: SURF.rubber });
    sc.add({ t: 'box', c: [an[0], 0.55, 2.7], h: [2.7, 0.55, 6.1], r: 0.35 }, { col: C(c.shoe).multiplyScalar(0.45), bone: b(`foot${n}`), k: 0.1, surf: SURF.rubber });
    sc.add({ t: 'box', c: [an[0], 1.0, -2.1], h: [2.3, 0.9, 1.4], r: 0.3 }, { col: C(c.shoe).multiplyScalar(0.4), bone: b(`foot${n}`), k: 0.1, surf: SURF.rubber });
    for (let k = 0; k < 3; k++) sc.detail(rbox(2.6, 0.22, 0.3, 0.08, 1), { col: 0x0e0a08, bone: b(`foot${n}`), pos: [an[0], 3.2 - k * 0.35, 3.2 + k * 0.9], rot: [-0.55, 0, k % 2 ? 0.25 : -0.25], surf: SURF.cloth });
  }
}

/** Vertical stripes that follow the body (waistcoats, singlets). */
export function bodyStripes(a: number, b: number, width: number, wear = 0.3): ColorFn {
  const ca = C(a), cb = C(b);
  return (p) => {
    const stripe = Math.floor((p.x + 100) / width) % 2 === 0 ? ca : cb;
    const n = vnoise(p.x * 0.5, p.y * 0.5, p.z * 0.5);
    return stripe.clone().multiplyScalar(1 - wear * 0.5 * n);
  };
}
