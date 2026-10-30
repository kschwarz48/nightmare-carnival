// Realistic-proportion figures for the playable cast (D-42), modelled on the art reference: weary
// 1930s carnival workers about seven heads tall — slim limbs, bare hands, gaunt faces with stubble
// and tired eyes, messy hair, rolled sleeves, cuffed and patched trousers, worn shoes with socks.

import * as THREE from 'three';
import { C, SURF, cyl, ellipsoid, rbox, sphere, vnoise, type ColorFn, type V3 } from '../core/geo';
import { PAL } from '../models/kit';
import { Sculpt } from './sdf';
import type { Proportions } from './humanoid';

type Col = number | THREE.Color | ColorFn;

/** ~7 heads tall, slim. Height to the crown ≈ 89. */
export const REAL: Proportions = {
  hip: 45, knee: 25, ankle: 4, stance: 4.4, waist: 54, chest: 64, shoulderY: 72.5, shoulderX: 8.4, elbowY: 58.5, wristY: 46, armOut: 1.2,
  neck: 75.5, headY: 81.5, headR: 6.4, leg: [3.6, 2.6, 1.9], arm: [2.3, 1.85, 1.5], hipW: 7.2, waistW: 6.5, chestW: 8.4, depth: 0.64,
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
    if (o.rings && p.z > P.headR * 0.65 && Math.abs(Math.abs(p.x) - P.headR * 0.36) < P.headR * 0.22 && dy > -P.headR * 0.08 && dy < P.headR * 0.08) out.lerp(ring, o.rings);
    return out;
  };
}

/** Gaunt head: narrow jaw, cheekbones, a real nose, ears; eyes/brows/mouth come as details. */
export function realHead(sc: Sculpt, P: Proportions, bone: number, skin: Col, o: { jaw?: number; nose?: number; chin?: number } = {}): void {
  const r = P.headR, y = P.headY;
  sc.add({ t: 'ell', c: [0, y + r * 0.12, -r * 0.08], r: [r * 0.92, r * 1.08, r * 1.0] }, { col: skin, bone, k: 1.2, surf: SURF.skin });
  sc.add({ t: 'ell', c: [0, y - r * 0.5, r * 0.2], r: [r * 0.66 * (o.jaw ?? 1), r * 0.55, r * 0.68] }, { col: skin, bone, k: 2, surf: SURF.skin });
  sc.add({ t: 'sph', c: [0, y - r * 0.92, r * 0.52], r: r * 0.22 * (o.chin ?? 1) }, { col: skin, bone, k: 1.6, surf: SURF.skin });
  for (const s of [1, -1]) {
    sc.add({ t: 'ell', c: [s * r * 0.5, y - r * 0.08, r * 0.6], r: [r * 0.26, r * 0.18, r * 0.2] }, { col: skin, bone, k: 1.4, surf: SURF.skin });
    sc.add({ t: 'ell', c: [s * r * 0.92, y - r * 0.05, -r * 0.08], r: [r * 0.14, r * 0.28, r * 0.2], rot: [0, s * 0.3, 0] }, { col: skin, bone, k: 0.8, surf: SURF.skin });
    // eye sockets: shallow hollows give the tired look
    sc.add({ t: 'ell', c: [s * r * 0.36, y + r * 0.12, r * 0.98], r: [r * 0.22, r * 0.15, r * 0.14] }, { sub: true, k: 0.9 });
  }
  sc.add({ t: 'ell', c: [0, y + r * 0.36, r * 0.78], r: [r * 0.6, r * 0.12, r * 0.22] }, { col: skin, bone, k: 1.4, surf: SURF.skin });
  sc.add({ t: 'cap', a: [0, y + r * 0.22, r * 0.92], b: [0, y - r * 0.2, r * 1.12], ra: r * 0.08, rb: r * 0.15 * (o.nose ?? 1) }, { col: skin, bone, k: 1, surf: SURF.skin });
}

/** Small realistic eyes, worried brows, a thin mouth. */
export function realFace(sc: Sculpt, P: Proportions, bone: number, o: { iris?: number; brow?: number; browTilt?: number; mouth?: number; frown?: number; glow?: number } = {}): void {
  const r = P.headR, y = P.headY;
  for (const s of [1, -1]) {
    const x = s * r * 0.36;
    const z = r * 0.86;
    sc.detail(ellipsoid(r * 0.15, r * 0.1, r * 0.06, 10, 8), { col: 0xd8cfc0, bone, pos: [x, y + r * 0.1, z], rot: [0, s * 0.3, 0], surf: SURF.skin });
    sc.detail(sphere(r * 0.075, 8, 6), { col: o.iris ?? 0x2a1c14, bone, pos: [x + s * r * 0.01, y + r * 0.09, z + r * 0.05], surf: SURF.glass, emit: o.glow ?? 0 });
    // heavy upper lid
    sc.detail(ellipsoid(r * 0.17, r * 0.045, r * 0.08, 8, 4), { col: C(PAL.skin).multiplyScalar(0.7), bone, pos: [x, y + r * 0.19, z + r * 0.01], rot: [0.2, s * 0.3, -s * 0.12], surf: SURF.skin });
    sc.detail(rbox(r * 0.36, r * 0.07, r * 0.08, r * 0.02, 1), { col: o.brow ?? 0x1e1612, bone, pos: [x, y + r * 0.34, z + r * 0.02], rot: [0, s * 0.3, s * (o.browTilt ?? 0.22)], surf: SURF.cloth });
  }
  const fr = o.frown ?? 0.04;
  sc.detail(rbox(r * 0.42, r * 0.045, r * 0.05, r * 0.02, 1), { col: o.mouth ?? 0x5a2e2a, bone, pos: [0, y - r * 0.5, r * 0.88], rot: [0, 0, 0], surf: SURF.skin });
  for (const s of [1, -1]) sc.detail(rbox(r * 0.1, r * 0.04, r * 0.05, r * 0.02, 1), { col: o.mouth ?? 0x5a2e2a, bone, pos: [s * r * 0.22, y - r * 0.5 - fr * r, r * 0.85], rot: [0, s * 0.3, s * 0.5], surf: SURF.skin });
}

/** A messy mop of hair: clumps over the crown and back, a few locks falling across the brow. */
export function messyHair(sc: Sculpt, P: Proportions, bone: number, col: number, o: { volume?: number; fringe?: number; seed?: number } = {}): void {
  const r = P.headR * (o.volume ?? 1), y = P.headY;
  const hair = C(col);
  const tone: ColorFn = (p) => hair.clone().multiplyScalar(0.8 + 0.4 * vnoise(p.x * 1.4, p.y * 1.4, p.z * 1.4));
  sc.add({ t: 'ell', c: [0, y + r * 0.5, -r * 0.18], r: [r * 1.0, r * 0.66, r * 1.0] }, { col: tone, bone, k: 1, surf: SURF.cloth });
  const seed = o.seed ?? 3;
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + seed;
    const front = Math.cos(a - Math.PI / 2) > 0.55;
    if (front && i % 2) continue;
    const tipR = r * (1.08 + 0.12 * vnoise(i, seed, 1));
    sc.add({ t: 'cap', a: [Math.cos(a) * r * 0.5, y + r * 0.62, Math.sin(a) * r * 0.5 - r * 0.15], b: [Math.cos(a) * tipR, y + r * (0.15 + 0.3 * vnoise(i, 2, seed)), Math.sin(a) * tipR - r * 0.1], ra: r * 0.32, rb: r * 0.1 }, { col: tone, bone, k: 0.9, surf: SURF.cloth });
  }
  for (let i = 0; i < (o.fringe ?? 3); i++) {
    const x = (i - 1) * r * 0.32 + 0.4;
    sc.add({ t: 'cap', a: [x, y + r * 0.85, r * 0.55], b: [x + r * 0.12 * (i - 1), y + r * 0.32, r * 0.95], ra: r * 0.17, rb: r * 0.05 }, { col: tone, bone, k: 0.6, surf: SURF.cloth });
  }
}

/** Bare hand: palm, thumb and four slim fingers in a relaxed curl. */
export function bareHand(sc: Sculpt, wr: V3, s: number, r: number, col: Col, bone: number): void {
  const palm: V3 = [wr[0] + s * 0.2, wr[1] - r * 1.5, wr[2] + 0.3];
  sc.add({ t: 'ell', c: palm, r: [r * 0.95, r * 1.25, r * 0.55] }, { col, bone, k: 0.9, surf: SURF.skin });
  for (let i = 0; i < 4; i++) {
    const fx = palm[0] + (i - 1.5) * r * 0.42;
    sc.add({ t: 'cap', a: [fx, palm[1] - r * 0.9, palm[2] + r * 0.05], b: [fx, palm[1] - r * 2.0, palm[2] + r * 0.5], ra: r * 0.21, rb: r * 0.17 }, { col, bone, k: 0.4, surf: SURF.skin });
  }
  sc.add({ t: 'cap', a: [palm[0] + s * r * 0.7, palm[1] - r * 0.1, palm[2] + r * 0.3], b: [palm[0] + s * r * 0.95, palm[1] - r * 0.9, palm[2] + r * 0.85], ra: r * 0.24, rb: r * 0.18 }, { col, bone, k: 0.4, surf: SURF.skin });
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

/** Slim, jointed anatomy under the costume. */
export function realBody(sc: Sculpt, P: Proportions, b: (n: string) => number, c: RealCols): void {
  const cloth = SURF.cloth;
  sc.add({ t: 'ell', c: [0, P.hip + 1.5, 0], r: [P.hipW, 6, P.hipW * P.depth * 1.05] }, { col: c.trousers, bone: b('hips'), k: 1.5, surf: cloth });
  sc.add({ t: 'ell', c: [0, P.waist, 0.3], r: [P.waistW, 7.5, P.waistW * P.depth] }, { col: c.shirt, bone: b('spine'), k: 3, surf: cloth });
  sc.add({ t: 'ell', c: [0, P.chest + 1, 0.4], r: [P.chestW, 8.5, P.chestW * P.depth] }, { col: c.shirt, bone: b('chest'), k: 3.5, surf: cloth });
  for (const s of [1, -1]) sc.add({ t: 'sph', c: [s * (P.shoulderX - 0.6), P.shoulderY - 0.6, 0], r: P.arm[0] + 0.8 }, { col: c.shirt, bone: b('chest'), k: 2.5, surf: cloth });
  sc.add({ t: 'cap', a: [0, P.neck - 3, 0], b: [0, P.neck + 3, 0.4], ra: P.headR * 0.4, rb: P.headR * 0.36 }, { col: c.skin, bone: b('neck'), k: 1.6, surf: SURF.skin });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const sh: V3 = [s * P.shoulderX, P.shoulderY, 0];
    const el: V3 = [s * (P.shoulderX + P.armOut), P.elbowY, -0.6];
    const wr: V3 = [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.6];
    sc.add({ t: 'cap', a: sh, b: el, ra: P.arm[0], rb: P.arm[1] }, { col: c.shirt, bone: b(`arm${n}`), k: 1.2, surf: cloth });
    sc.add({ t: 'cap', a: el, b: wr, ra: P.arm[1] * 0.95, rb: P.arm[2] }, { col: c.rolled ? c.skin : c.shirt, bone: b(`fore${n}`), k: 0.8, surf: c.rolled ? SURF.skin : cloth });
    if (c.rolled) sc.add({ t: 'tor', c: [el[0], el[1] + 0.5, el[2]], R: P.arm[1] + 0.35, r: 1.05 }, { col: c.shirt, bone: b(`arm${n}`), k: 0.5, surf: cloth });
    bareHand(sc, wr, s, P.arm[2], c.hands ?? c.skin, b(`hand${n}`));
    if (c.skipLegs) continue;
    const hp: V3 = [s * P.stance, P.hip - 1, 0];
    const kn: V3 = [s * (P.stance + 0.3), P.knee, 0.5];
    const an: V3 = [s * (P.stance + 0.3), P.ankle + 1.5, 0];
    sc.add({ t: 'cap', a: hp, b: kn, ra: P.leg[0] + 0.6, rb: P.leg[1] + 0.6 }, { col: c.trousers, bone: b(`thigh${n}`), k: 2, surf: cloth });
    sc.add({ t: 'cap', a: kn, b: an, ra: P.leg[1] + 0.6, rb: P.leg[2] + 0.8 }, { col: c.trousers, bone: b(`shin${n}`), k: 1, surf: cloth });
    if (c.cuffs) sc.add({ t: 'tor', c: [an[0], an[1] + 1, an[2]], R: P.leg[2] + 0.9, r: 0.9 }, { col: c.trousers, bone: b(`shin${n}`), k: 0.4, surf: cloth });
    if (c.sock !== undefined) sc.add({ t: 'cap', a: [an[0], an[1] + 0.2, an[2]], b: [an[0], P.ankle - 1, an[2] + 0.2], ra: P.leg[2] + 0.2, rb: P.leg[2] + 0.3 }, { col: c.sock, bone: b(`foot${n}`), k: 0.5, surf: cloth });
    sc.add({ t: 'ell', c: [an[0], 1.9, 2.4], r: [2.6, 1.9, 5.2], rot: [-0.05, 0, 0] }, { col: c.shoe, bone: b(`foot${n}`), k: 1, surf: SURF.rubber });
    sc.add({ t: 'box', c: [an[0], 0.6, 0.2], h: [2.4, 0.7, 4.8], r: 0.5 }, { col: C(c.shoe).multiplyScalar(0.6), bone: b(`foot${n}`), k: 0.6, surf: SURF.rubber });
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

export const _unused = { cyl };
