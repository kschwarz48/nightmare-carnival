// Humanoid sculpt + animation toolkit (D-40): a proportioned skeleton, sculpted base anatomy that
// characters dress over (seamless torso, jointed limbs, gloved four-finger hands, faces with brow,
// nose, cheeks and ears), crisp eyes, and a gait library — walk/run cycles with knee flex, arm
// counter-swing, torso twist, head stabilisation and cartoon squash on the footfalls.

import * as THREE from 'three';
import type { ColorFn, Surf, V3 } from '../core/geo';
import { SURF, ellipsoid, sphere } from '../core/geo';
import { PAL } from '../models/kit';
import { Sculpt } from './sdf';
import { type BoneDef, type Pose, cos, sin } from './rig';

export interface Proportions {
  hip: number;
  knee: number;
  ankle: number;
  stance: number;
  waist: number;
  chest: number;
  shoulderY: number;
  shoulderX: number;
  elbowY: number;
  wristY: number;
  /** extra outward offset of elbows/wrists */
  armOut: number;
  neck: number;
  headY: number;
  headR: number;
  /** thigh, knee, ankle radii */
  leg: [number, number, number];
  /** shoulder, elbow, wrist radii */
  arm: [number, number, number];
  /** hips / waist / chest half-widths */
  hipW: number;
  waistW: number;
  chestW: number;
  /** chest depth factor */
  depth: number;
}

export const ADULT: Proportions = {
  hip: 36, knee: 20, ankle: 5, stance: 7, waist: 44, chest: 54, shoulderY: 61, shoulderX: 13, elbowY: 47, wristY: 35, armOut: 2,
  neck: 64, headY: 74, headR: 12, leg: [5, 4, 3.2], arm: [4, 3.3, 2.6], hipW: 11, waistW: 10, chestW: 12.5, depth: 0.8,
};

export function scaleP(P: Proportions, k: number, o: Partial<Proportions> = {}): Proportions {
  const out = { ...P } as Proportions;
  for (const key of Object.keys(P) as (keyof Proportions)[]) {
    const v = P[key];
    if (typeof v === 'number') (out as unknown as Record<string, number>)[key] = v * k;
    else (out as unknown as Record<string, number[]>)[key] = (v as number[]).map((x) => x * k);
  }
  return { ...out, ...o };
}

/** Bone hierarchy for a proportioned humanoid; L = +X. */
export function humanBones(P: Proportions, extra: BoneDef[] = []): BoneDef[] {
  const side = (s: number, n: string): BoneDef[] => [
    { name: `arm${n}`, parent: 'chest', head: [s * P.shoulderX, P.shoulderY, 0] },
    { name: `fore${n}`, parent: `arm${n}`, head: [s * (P.shoulderX + P.armOut), P.elbowY, -0.8] },
    { name: `hand${n}`, parent: `fore${n}`, head: [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.8] },
    { name: `thigh${n}`, parent: 'hips', head: [s * P.stance, P.hip, 0] },
    { name: `shin${n}`, parent: `thigh${n}`, head: [s * (P.stance + 0.4), P.knee, 0.6] },
    { name: `foot${n}`, parent: `shin${n}`, head: [s * (P.stance + 0.4), P.ankle, 0] },
  ];
  return [
    { name: 'hips', parent: null, head: [0, P.hip, 0] },
    { name: 'spine', parent: 'hips', head: [0, P.waist, 0] },
    { name: 'chest', parent: 'spine', head: [0, P.chest, 0] },
    { name: 'neck', parent: 'chest', head: [0, P.neck, 0] },
    { name: 'head', parent: 'neck', head: [0, P.neck + P.headR * 0.35, 0] },
    ...side(1, 'L'),
    ...side(-1, 'R'),
    ...extra,
  ];
}

type Col = number | THREE.Color | ColorFn;
export interface BodyCols {
  skin: Col;
  torso: Col;
  hips?: Col;
  upperArm?: Col;
  foreArm?: Col;
  hand?: Col;
  thigh?: Col;
  shin?: Col;
  shoe?: Col;
  torsoSurf?: Surf;
  legSurf?: Surf;
  /** skip sculpting parts the costume replaces */
  noHands?: boolean;
  noLegs?: boolean;
  noTorso?: boolean;
  gloves?: boolean;
  bigShoes?: number;
}

/** Sculpt the base anatomy onto bones (looked up by name through `b`). */
export function humanBody(sc: Sculpt, P: Proportions, b: (n: string) => number, c: BodyCols): void {
  const ts = c.torsoSurf ?? SURF.cloth, ls = c.legSurf ?? SURF.cloth;
  if (!c.noTorso) {
    sc.add({ t: 'ell', c: [0, P.hip + 1, 0], r: [P.hipW, 7, P.hipW * P.depth] }, { col: c.hips ?? c.torso, bone: b('hips'), k: 2, surf: ts });
    sc.add({ t: 'ell', c: [0, P.waist, 0.4], r: [P.waistW, 8, P.waistW * P.depth] }, { col: c.torso, bone: b('spine'), k: 6, surf: ts });
    sc.add({ t: 'ell', c: [0, P.chest + 1, 0.6], r: [P.chestW, 9, P.chestW * P.depth] }, { col: c.torso, bone: b('chest'), k: 6, surf: ts });
    for (const s of [1, -1]) sc.add({ t: 'sph', c: [s * (P.shoulderX - 1), P.shoulderY - 0.5, 0], r: P.arm[0] + 1.2 }, { col: c.upperArm ?? c.torso, bone: b('chest'), k: 4, surf: ts });
  }
  sc.add({ t: 'cap', a: [0, P.neck - 3, 0], b: [0, P.neck + 3, 0.3], ra: P.headR * 0.36, rb: P.headR * 0.32 }, { col: c.skin, bone: b('neck'), k: 3, surf: SURF.skin });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const sh: V3 = [s * P.shoulderX, P.shoulderY, 0];
    const el: V3 = [s * (P.shoulderX + P.armOut), P.elbowY, -0.8];
    const wr: V3 = [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.8];
    sc.add({ t: 'cap', a: sh, b: el, ra: P.arm[0], rb: P.arm[1] }, { col: c.upperArm ?? c.torso, bone: b(`arm${n}`), k: 2, surf: ts });
    sc.add({ t: 'cap', a: el, b: wr, ra: P.arm[1], rb: P.arm[2] }, { col: c.foreArm ?? c.upperArm ?? c.torso, bone: b(`fore${n}`), k: 1.5, surf: ts });
    if (!c.noHands) hand(sc, wr, s, P.arm[2], c.hand ?? c.skin, b(`hand${n}`), !!c.gloves);
    if (!c.noLegs) {
      const hp: V3 = [s * P.stance, P.hip - 2, 0];
      const kn: V3 = [s * (P.stance + 0.4), P.knee, 0.6];
      const an: V3 = [s * (P.stance + 0.4), P.ankle + 1, 0];
      sc.add({ t: 'cap', a: hp, b: kn, ra: P.leg[0], rb: P.leg[1] }, { col: c.thigh ?? c.hips ?? c.torso, bone: b(`thigh${n}`), k: 3, surf: ls });
      sc.add({ t: 'cap', a: kn, b: an, ra: P.leg[1], rb: P.leg[2] }, { col: c.shin ?? c.thigh ?? c.torso, bone: b(`shin${n}`), k: 1.5, surf: ls });
      const sl = c.bigShoes ?? 1;
      sc.add({ t: 'ell', c: [an[0], P.ankle * 0.55 + 0.6, 3.2 * sl], r: [3.6 * sl, 3 * Math.min(1.3, sl), 6.4 * sl], rot: [-0.08, 0, 0] }, { col: c.shoe ?? PAL.leather, bone: b(`foot${n}`), k: 1.5, surf: SURF.rubber });
    }
  }
}

/** Four-finger cartoon hand (gloved or bare) at the wrist, fingers curled toward +Z. */
export function hand(sc: Sculpt, wr: V3, s: number, r: number, col: Col, bone: number, glove: boolean): void {
  const R = r * (glove ? 1.25 : 1.05);
  const palm: V3 = [wr[0] + s * 0.4, wr[1] - R * 1.3, wr[2] + 0.6];
  sc.add({ t: 'ell', c: palm, r: [R * 1.05, R * 1.25, R * 0.75] }, { col, bone, k: 1.4, surf: glove ? SURF.cloth : SURF.skin });
  for (let i = 0; i < 3; i++) {
    const fx = palm[0] + (i - 1) * R * 0.55;
    sc.add({ t: 'cap', a: [fx, palm[1] - R * 0.7, palm[2] + R * 0.2], b: [fx, palm[1] - R * 1.7, palm[2] + R * 0.75], ra: R * 0.34, rb: R * 0.3 }, { col, bone, k: 0.8, surf: glove ? SURF.cloth : SURF.skin });
  }
  sc.add({ t: 'cap', a: [palm[0] + s * R * 0.7, palm[1], palm[2] + R * 0.3], b: [palm[0] + s * R * 1.2, palm[1] - R * 0.6, palm[2] + R * 0.9], ra: R * 0.32, rb: R * 0.28 }, { col, bone, k: 0.8, surf: glove ? SURF.cloth : SURF.skin });
  if (glove) sc.add({ t: 'tor', c: [wr[0], wr[1] - R * 0.15, wr[2]], R: R * 0.95, r: R * 0.42 }, { col, bone, k: 0.8, surf: SURF.cloth });
}

export interface FaceOpts {
  skin: Col;
  nose?: number;
  noseCol?: Col;
  ears?: boolean;
  brow?: number;
  cheeks?: number;
  chin?: number;
  jaw?: number;
}

/** Sculpted head: cranium, jaw, cheeks, nose, brow ridge and ears. */
export function head(sc: Sculpt, P: Proportions, bone: number, o: FaceOpts): void {
  const r = P.headR, y = P.headY;
  sc.add({ t: 'ell', c: [0, y + r * 0.08, -r * 0.05], r: [r, r * 1.05, r * 0.98] }, { col: o.skin, bone, k: 2, surf: SURF.skin });
  sc.add({ t: 'ell', c: [0, y - r * 0.45, r * 0.18], r: [r * 0.72 * (o.jaw ?? 1), r * 0.5, r * 0.7] }, { col: o.skin, bone, k: 4, surf: SURF.skin });
  if (o.chin) sc.add({ t: 'sph', c: [0, y - r * 0.82, r * 0.5], r: r * 0.22 * o.chin }, { col: o.skin, bone, k: 3, surf: SURF.skin });
  for (const s of [1, -1]) {
    sc.add({ t: 'ell', c: [s * r * 0.5, y - r * 0.18, r * 0.62], r: [r * 0.3, r * 0.24, r * 0.22].map((v) => v * (o.cheeks ?? 1)) as V3 }, { col: o.skin, bone, k: 3, surf: SURF.skin });
    if (o.ears !== false) sc.add({ t: 'ell', c: [s * r * 0.98, y - r * 0.02, -r * 0.05], r: [r * 0.16, r * 0.3, r * 0.22], rot: [0, s * 0.3, 0] }, { col: o.skin, bone, k: 1.6, surf: SURF.skin });
  }
  if (o.brow !== 0) sc.add({ t: 'ell', c: [0, y + r * 0.34, r * 0.74], r: [r * 0.66, r * 0.14 * (o.brow ?? 1), r * 0.24] }, { col: o.skin, bone, k: 3, surf: SURF.skin });
  sc.add({ t: 'ell', c: [0, y - r * 0.02, r * 0.98], r: [r * 0.2, r * 0.26, r * 0.24].map((v) => v * (o.nose ?? 1)) as V3 }, { col: o.noseCol ?? o.skin, bone, k: 2, surf: SURF.skin });
}

/** Crisp eyes (sclera + iris/pupil, optional glow) set into the face. */
export function eyeDetails(sc: Sculpt, P: Proportions, bone: number, o: { spread?: number; size?: number; y?: number; iris?: number; glow?: number; sclera?: number; tilt?: number; lids?: Col } = {}): void {
  const r = P.headR;
  const sz = (o.size ?? 0.2) * r;
  const y = P.headY + (o.y ?? 0.14) * r;
  for (const s of [1, -1]) {
    const x = s * (o.spread ?? 0.36) * r;
    const z = Math.sqrt(Math.max(0, r * r * 0.98 - x * x)) * 0.97;
    if (o.sclera !== -1) sc.detail(ellipsoid(sz, sz * 1.25, sz * 0.5, 12, 10), { col: o.sclera ?? PAL.bone, bone, pos: [x, y, z - sz * 0.15], rot: [0, s * 0.35, s * (o.tilt ?? 0)], surf: SURF.porcelain });
    sc.detail(ellipsoid(sz * 0.55, sz * 0.66, sz * 0.32, 10, 8), { col: o.iris ?? PAL.ink, bone, pos: [x + s * sz * 0.08, y - sz * 0.05, z + sz * 0.22], rot: [0, s * 0.35, 0], surf: SURF.glass, emit: o.glow ?? 0 });
    if (o.lids !== undefined) sc.add({ t: 'ell', c: [x, y + sz * 0.95, z - sz * 0.2], r: [sz * 1.25, sz * 0.5, sz * 0.7], rot: [0.3, s * 0.35, s * (o.tilt ?? 0)] }, { col: o.lids, bone, k: 0.8, surf: SURF.skin });
  }
}

// ------------------------------------------------------------------ gaits
export interface Gait {
  stride: number;
  knee: number;
  arm: number;
  elbow: number;
  bob: number;
  twist: number;
  lean: number;
  sway: number;
  squash: number;
  headBob: number;
  /** arms held out from the body (radians) */
  armOut?: number;
  /** knee lift on the swing (cartoon high-step) */
  lift?: number;
}

export const GAIT_WALK: Gait = { stride: 0.55, knee: 0.85, arm: 0.45, elbow: 0.35, bob: 2.2, twist: 0.12, lean: 0.05, sway: 0.05, squash: 0.05, headBob: 0.04 };

/** One full stride (two footfalls) for the standard humanoid bone names. */
export function gaitPose(t: number, g: Gait): Pose {
  const s = sin(t), c = cos(t), c2 = cos(t, 2);
  const low = 0.5 - 0.5 * c2; // 1 at the footfalls
  const sq = 1 - g.squash * low;
  const lift = g.lift ?? 0;
  return {
    hips: { ty: -g.bob * low, rz: g.sway * s, ry: -g.twist * s * 0.5, sy: sq, sx: 1 + (1 - sq) * 0.5, sz: 1 + (1 - sq) * 0.5 },
    spine: { rx: g.lean, ry: g.twist * s * 0.3 },
    chest: { ry: g.twist * s * 0.8, rx: g.lean * 0.4, sy: 1 + g.squash * 0.4 * (1 - low) },
    neck: { rx: -g.lean * 0.6 },
    head: { rx: -g.lean * 0.6 + g.headBob * (low - 0.5), ry: -g.twist * s * 0.7, rz: -g.sway * s * 0.6 },
    thighL: { rx: -g.stride * s - lift * Math.max(0, c) },
    shinL: { rx: g.knee * Math.max(0, c) * (1 + lift) + 0.08 },
    footL: { rx: -0.25 * Math.max(0, c) + 0.2 * Math.max(0, -s) },
    thighR: { rx: g.stride * s - lift * Math.max(0, -c) },
    shinR: { rx: g.knee * Math.max(0, -c) * (1 + lift) + 0.08 },
    footR: { rx: -0.25 * Math.max(0, -c) + 0.2 * Math.max(0, s) },
    armL: { rx: g.arm * s, rz: -(g.armOut ?? 0.12) },
    foreL: { rx: -g.elbow - g.elbow * 0.6 * Math.max(0, -s) },
    armR: { rx: -g.arm * s, rz: g.armOut ?? 0.12 },
    foreR: { rx: -g.elbow - g.elbow * 0.6 * Math.max(0, s) },
  };
}

/** Breathing idle with a little weight shift; `t` over a ~2.5 s loop. */
export function idlePose(t: number, amt = 1): Pose {
  const b = sin(t), w = sin(t, 1, 0.25);
  return {
    hips: { tx: w * 0.6 * amt, rz: w * 0.025 * amt, ty: -0.3 * (0.5 + 0.5 * b) * amt },
    spine: { rz: -w * 0.02 * amt },
    chest: { sy: 1 + 0.018 * b * amt, sx: 1 + 0.01 * b * amt, rx: -0.02 * b * amt },
    head: { rx: 0.03 * sin(t, 1, 0.1) * amt, ry: 0.06 * sin(t, 0.5) * amt },
    armL: { rz: -0.1 - 0.03 * b * amt, rx: 0.04 * w },
    armR: { rz: 0.1 + 0.03 * b * amt, rx: -0.04 * w },
    foreL: { rx: -0.25 },
    foreR: { rx: -0.25 },
    thighL: { rx: 0.03 * w },
    thighR: { rx: -0.03 * w },
  };
}

/** One-shot recoil (t 0→1): snap back, then settle. */
export function hurtPose(t: number): Pose {
  const k = Math.sin(Math.min(1, t * 1.4) * Math.PI) * (1 - t * 0.4);
  return {
    hips: { tz: -3 * k, sy: 1 - 0.08 * k, sx: 1 + 0.05 * k },
    spine: { rx: -0.35 * k },
    chest: { rx: -0.2 * k },
    head: { rx: -0.35 * k, rz: 0.15 * k },
    armL: { rz: -0.9 * k, rx: -0.5 * k },
    armR: { rz: 0.9 * k, rx: -0.5 * k },
    foreL: { rx: -0.6 * k },
    foreR: { rx: -0.6 * k },
  };
}

export const _unused = { sphere };
