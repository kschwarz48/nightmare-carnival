// Sculpted enemies (D-40): every attraction-turned-monster is an SDF sculpt on its own skeleton with
// a characteristic locomotion clip and a wind-up/attack clip that the sim's telegraph drives —
// the toy monkey's waddle and cymbal crash, the plush bear's dragging limp, the clown's bouncing
// skip, the marionette soldier's jerky march, the carousel horse's gallop and rear, the booth's
// stilt-walk, the brute's hammer drag. Glowing eyes and mouths keep them readable in the dark.

import * as THREE from 'three';
import { C, SURF, cone, cyl, ellipsoid, extrude, lathe, rbox, sphere, starShape, torus, tube, vnoise, type ColorFn, type V3 } from '../core/geo';
import { PAL } from './kit';
import { Sculpt, layered } from '../sculpt/sdf';
import { CREATURE, FAM, LAYER, flat, styleHand, styleShoe, vertical } from '../sculpt/figure';
import type { Surf } from '../core/geo';
import { frontZ } from '../sculpt/realism';
import { Rig, type BoneDef, type ClipDef, type Pose, ease, mix, pulse, sin, cos, snap, TAU } from '../sculpt/rig';
import { ADULT, GAIT_WALK, type Gait, type Proportions, eyeDetails, gaitPose, head, humanBody, humanBones, scaleP } from '../sculpt/humanoid';
import type { SculptModel } from './characters';
import { FUNHOUSE_BUILDERS } from './funhouseCreatures';
import { BOARDWALK_BUILDERS } from './boardwalkCreatures';
import { GHOST_TRAIN_BUILDERS } from './ghostTrainCreatures';
import { PET_BUILDERS } from './pets';

type Clips = Record<string, ClipDef>;
const bi = (bones: BoneDef[]) => (n: string) => {
  const i = bones.findIndex((x) => x.name === n);
  if (i < 0) throw new Error(`no bone ${n}`);
  return i;
};
const glowEye = (sc: Sculpt, bone: number, pos: V3, r: number, col: number, emit = 1.3) => sc.detail(sphere(r, 10, 8), { col, bone, pos, emit, surf: SURF.glass });

// ================================================================== balloons
function balloon(r: number): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 0, 0] },
    { name: 's0', parent: 'body', head: [0, -r * 0.12, 0] },
    { name: 's1', parent: 's0', head: [0, -r * 0.9, 0] },
    { name: 's2', parent: 's1', head: [0, -r * 1.7, 0] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(r < 13 ? 1.8 : 1.6, 2);
  // old latex (D-50): sun-faded, darker and puckered toward the knot (D-88: its grime was noise)
  const latex: ColorFn = (p) => {
    const lit = 0.6 + 0.2 * Math.max(0, p.x / r * 0.5 + p.y / (r * 2) * 0.5);
    const knot = 0.55 + 0.45 * Math.min(1, Math.max(0, p.y / (r * 0.9)));
    return C(0xffffff).multiplyScalar(lit * 0.9 * knot);
  };
  sc.add({ t: 'ell', c: [0, r * 1.05, 0], r: [r, r * 1.08, r] }, { col: latex, bone: b('body'), k: 0, surf: [0.4, 0] });
  sc.add({ t: 'cap', a: [0, r * 0.4, 0], b: [0, 0.2, 0], ra: r * 0.62, rb: r * 0.16 }, { col: latex, bone: b('body'), k: r * 0.6, surf: [0.4, 0] });
  sc.add({ t: 'sph', c: [0, -0.4, 0], r: r * 0.17 }, { col: latex, bone: b('body'), k: r * 0.1, surf: [0.4, 0] });
  // deep-set, slanted eye holes and a wide sagging grin stitched at the corners
  for (const s2 of [1, -1]) sc.add({ t: 'ell', c: [s2 * r * 0.36, r * 1.24, r * 0.9], r: [r * 0.2, r * 0.24, r * 0.26], rot: [0, s2 * 0.35, s2 * -0.5] }, { sub: true, k: r * 0.08 });
  sc.add({ t: 'box', c: [0, r * 0.8, r * 0.95], h: [r * 0.62, r * 0.075, r * 0.26], r: r * 0.04, rot: [-0.25, 0, 0.06] }, { sub: true, k: r * 0.06 });
  for (const s2 of [1, -1]) glowEye(sc, b('body'), [s2 * r * 0.36, r * 1.22, r * 0.76], r * 0.12, PAL.sickYellow, 1.5);
  for (let i = 0; i < 7; i++) {
    const big = i % 3 === 1 ? 1.35 : 1;
    sc.detail(cone(r * 0.05 * big, r * 0.15 * big, 4), { col: C(PAL.bone).multiplyScalar(0.82), bone: b('body'), pos: [-r * 0.48 + i * r * 0.16, r * 0.85, r * 0.9], rot: [Math.PI, 0, (i - 3) * 0.06], surf: SURF.bone });
  }
  for (const s2 of [1, -1]) for (let k = 0; k < 2; k++) {
    const x = s2 * r * (0.5 + k * 0.1);
    sc.detail(tube([[x - r * 0.04, r * 0.92, r * 0.86], [x + r * 0.04, r * 0.68, r * 0.88]], r * 0.018, 3, 2), { col: PAL.ink, bone: b('body'), surf: SURF.cloth });
  }
  // a crossed patch of old tape where it was mended once
  for (const a of [0.6, -0.6]) sc.detail(rbox(r * 0.55, r * 0.13, r * 0.03, r * 0.02, 1), { col: C(PAL.dirty).multiplyScalar(0.85), bone: b('body'), pos: [-r * 0.6, r * 1.62, r * 0.55], rot: [-0.55, -0.75, a], surf: SURF.cloth });
  // the string, three swinging segments
  for (const [n, y0, y1] of [['s0', -r * 0.12, -r * 0.9], ['s1', -r * 0.9, -r * 1.7], ['s2', -r * 1.7, -r * 2.5]] as const) sc.detail(cyl(0.35, 0.35, y0 - y1, 4), { col: PAL.dirty, bone: b(n), pos: [0, (y0 + y1) / 2, 0], surf: SURF.cloth });
  const clips: Clips = {
    move: { frames: 48, fn: (t) => ({ body: { ty: 2.5 * sin(t), rz: 0.12 * sin(t, 1, 0.2), rx: 0.08 * cos(t), sy: 1 + 0.03 * sin(t, 2), sx: 1 - 0.015 * sin(t, 2) }, s0: { rz: 0.25 * sin(t, 1, -0.15), rx: 0.15 * cos(t, 1, -0.1) }, s1: { rz: 0.3 * sin(t, 1, -0.3) }, s2: { rz: 0.35 * sin(t, 1, -0.45) } }) },
    attack: { frames: 16, loop: false, fn: (t) => ({ body: { sx: 1 + 0.25 * ease(t), sy: 1 + 0.25 * ease(t), sz: 1 + 0.25 * ease(t), rz: 0.1 * Math.sin(t * 40) * t } }) },
  };
  return { geo: sc.build({ ...CREATURE, aoScale: r / 17 }), rig: new Rig(bones, clips) };
}

// ================================================================== wind-up monkey
function windUpMonkey(): SculptModel {
  // D-88, on the standard: a tin cymbal monkey in layers — brown felt, a heart-shaped tan face with hot red eyes
  // and a wide porcelain grin, big round ears, a glossy red tin jacket with gold trim drawn per pixel, a fez
  // with a gold tassel, brass cymbals, the key in its back. The same skeleton, size and clips.
  const P: Proportions = { ...scaleP(ADULT, 0.5), hip: 13, knee: 7, ankle: 2, waist: 19, chest: 25, shoulderY: 29, shoulderX: 10, elbowY: 21, wristY: 14, neck: 32, headY: 41, headR: 10, stance: 4.6, leg: [3.4, 3, 2.6], arm: [2.6, 2.3, 2], hipW: 8, waistW: 9.5, chestW: 10.5, depth: 0.9, armOut: 2 };
  const bones = humanBones(P, [{ name: 'key', parent: 'spine', head: [0, 21, -10] }]);
  const b = bi(bones);
  const fur = new Sculpt(1.4, 2.6, 0.5), face = new Sculpt(1.3, 2.6, 0.5), tin = new Sculpt(1.6, 2.6, 0.5);
  const FUR = 0x5a3e2c, TAN = 0xc9a07e, RED = 0x9a2a22, GOLD = 0xb8933e;
  const r = P.headR, y = P.headY;
  const fs = { col: FUR, surf: SURF.plush };
  // ---- felt: a round head with big round ears, long arms, short legs
  fur.add({ t: 'ell', c: [0, y + r * 0.05, -r * 0.05], r: [r, r * 0.95, r * 0.92] }, { ...fs, bone: b('head'), k: 1 });
  for (const s of [1, -1]) fur.add({ t: 'ell', c: [s * r * 1.02, y + r * 0.12, -r * 0.1], r: [r * 0.22, r * 0.44, r * 0.4], rot: [0, s * 0.2, 0] }, { ...fs, bone: b('head'), k: 0.8 });
  fur.add({ t: 'cap', a: [0, P.neck - 3, 0], b: [0, P.neck + 2, 0], ra: r * 0.42, rb: r * 0.4 }, { ...fs, bone: b('neck'), k: 1, ink: false });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const sh: V3 = [s * P.shoulderX, P.shoulderY, 0], el: V3 = [s * (P.shoulderX + P.armOut), P.elbowY, -0.8], wr: V3 = [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.8];
    fur.add({ t: 'cap', a: sh, b: el, ra: P.arm[0], rb: P.arm[1] }, { ...fs, bone: b(`arm${n}`), k: 1.2 });
    fur.add({ t: 'cap', a: el, b: wr, ra: P.arm[1], rb: P.arm[2] }, { ...fs, bone: b(`fore${n}`), k: 1 });
    const hp: V3 = [s * P.stance, P.hip - 1, 0], kn: V3 = [s * (P.stance + 0.4), P.knee, 0.6], an: V3 = [s * (P.stance + 0.4), P.ankle + 1, 0];
    fur.add({ t: 'cap', a: hp, b: kn, ra: P.leg[0], rb: P.leg[1] }, { ...fs, bone: b(`thigh${n}`), k: 1.5 });
    fur.add({ t: 'cap', a: kn, b: an, ra: P.leg[1], rb: P.leg[2] }, { ...fs, bone: b(`shin${n}`), k: 1 });
    // tan paws and feet
    face.add({ t: 'ell', c: [wr[0] + s * 0.3, wr[1] - 2.4, wr[2] + 0.6], r: [2.4, 2.8, 2.2] }, { col: TAN, bone: b(`hand${n}`), k: 0.6, surf: FAM.skin });
    face.add({ t: 'ell', c: [an[0], 1.8, 2.4], r: [2.6, 1.8, 4.2] }, { col: TAN, bone: b(`foot${n}`), k: 0.6, surf: FAM.skin });
  }
  // ---- the face: a heart-shaped tan mask (two lobes round the eyes, the muzzle), the ears' insides
  const tan = { col: TAN, bone: b('head'), surf: FAM.skin };
  for (const s of [1, -1]) {
    face.add({ t: 'ell', c: [s * r * 0.3, y + r * 0.12, r * 0.62], r: [r * 0.36, r * 0.34, r * 0.34] }, { ...tan, k: 0.8 });
    face.add({ t: 'ell', c: [s * r * 1.05, y + r * 0.12, r * 0.02], r: [r * 0.12, r * 0.3, r * 0.26], rot: [0, s * 0.2, 0] }, { ...tan, k: 0.5 });
  }
  face.add({ t: 'ell', c: [0, y - r * 0.32, r * 0.62], r: [r * 0.62, r * 0.42, r * 0.44] }, { ...tan, k: 1 });
  // the grin, carved wide, full of porcelain teeth
  face.add({ t: 'box', c: [0, y - r * 0.5, r * 1.02], h: [r * 0.42, r * 0.1, r * 0.16], r: 0.5 }, { sub: true, k: 0.6 });
  face.detail(rbox(r * 0.8, r * 0.16, 1.0, 0.4, 1), { col: 0xe8e0cc, bone: b('head'), pos: [0, y - r * 0.5, frontZ(face, 0, y - r * 0.5) - 0.3], surf: SURF.porcelain, ink: false });
  for (const s of [1, -1]) {
    const ex = s * r * 0.3, ey = y + r * 0.14, ez = frontZ(face, ex, ey);
    face.detail(ellipsoid(r * 0.2, r * 0.24, r * 0.1, 12, 8), { col: 0xe8e0cc, bone: b('head'), pos: [ex, ey, ez - r * 0.03], rot: [0, s * 0.3, 0], surf: SURF.porcelain, ink: false });
    face.detail(sphere(r * 0.1, 10, 8), { col: PAL.hotRed, bone: b('head'), pos: [ex + s * r * 0.02, ey - r * 0.02, ez + r * 0.04], emit: 1.2, surf: FAM.eye });
  }
  face.detail(ellipsoid(r * 0.14, r * 0.09, r * 0.08, 10, 6), { col: 0x2a1a14, bone: b('head'), pos: [0, y - r * 0.18, frontZ(face, 0, y - r * 0.18) + 0.05], surf: FAM.latex });
  // ---- the tin jacket: glossy red, gold trim drawn per pixel, brass buttons
  const tj = { col: RED, surf: [0.4, 0.2] as Surf, pat: { kind: 'bands', col: GOLD, a: 6, b: 0.14, c: 0.2 } as const };
  tin.add({ t: 'ell', c: [0, P.hip + 1, 0], r: [P.hipW + 0.6, 6, (P.hipW + 0.6) * P.depth] }, { ...tj, bone: b('hips'), k: 1.5 });
  tin.add({ t: 'ell', c: [0, P.waist, 0.4], r: [P.waistW + 0.6, 6, (P.waistW + 0.6) * P.depth] }, { ...tj, bone: b('spine'), k: 3 });
  tin.add({ t: 'ell', c: [0, P.chest + 1, 0.5], r: [P.chestW + 0.6, 6.5, (P.chestW + 0.6) * P.depth] }, { ...tj, bone: b('chest'), k: 3 });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) tin.add({ t: 'sph', c: [s * (P.shoulderX - 1), P.shoulderY - 0.5, 0], r: P.arm[0] + 1.2 }, { ...tj, bone: b(`arm${n}`), k: 2 });
  for (let i = 0; i < 3; i++) {
    const by = P.waist - 3 + i * 4;
    tin.detail(sphere(0.8, 8, 6), { col: PAL.brass, bone: b(i < 2 ? 'spine' : 'chest'), pos: [0, by, frontZ(tin, 0, by) + 0.3], surf: FAM.brass });
  }
  // the fez and its tassel; the cymbals; the key in its back
  tin.detail(cyl(r * 0.42, r * 0.52, r * 0.6, 16), { col: 0x8f1d18, bone: b('head'), pos: [0, y + r * 1.0, -0.6], rot: [-0.2, 0, 0.15], surf: SURF.velvet });
  tin.detail(tube([[0, y + r * 1.3, -1], [3, y + r * 1.2, -3], [4.6, y + r * 0.7, -3.4]], 0.5, 4, 8), { col: GOLD, bone: b('head'), surf: FAM.gold, ink: false });
  // (lathe profiles run bottom to top, or the faces point inward and the outline covers the part in black)
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) tin.detail(lathe([[0, -0.6], [6.6, -0.4], [6.2, 0], [0, 0.8]], 16), { col: 0xd0aa58, bone: b(`hand${n}`), pos: [s * 12.5, 10.5, 3], rot: [0, 0, s * Math.PI / 2], surf: [0.36, 0.35] });
  tin.detail(cyl(1, 1, 7, 6), { col: PAL.brass, bone: b('key'), pos: [0, 21, -12], rot: [Math.PI / 2, 0, 0], surf: FAM.brass });
  for (const s of [-1, 1]) tin.detail(torus(3, 1, 6, 10), { col: PAL.brass, bone: b('key'), pos: [s * 3.6, 21, -15], rot: [0, Math.PI / 2, 0], surf: FAM.brass });
  const gait: Gait = { ...GAIT_WALK, stride: 0.38, knee: 0.15, bob: 1.6, sway: 0.2, twist: 0.05, squash: 0.08, arm: 0.2, elbow: 0.6, armOut: 0.5, headBob: 0.08 };
  const clips: Clips = {
    // a clockwork waddle; the cymbals tap in time and the key never stops turning
    move: { frames: 32, fn: (t) => mix(gaitPose(t, gait), { key: { rz: t * TAU * 2 }, foreL: { rz: 0.5 * Math.max(0, sin(t, 2)) }, foreR: { rz: -0.5 * Math.max(0, sin(t, 2)) }, head: { rz: 0.1 * sin(t) } }) },
    // spread the cymbals wide… CRASH
    attack: { frames: 20, loop: false, fn: (t) => {
      const open = ease(t / 0.75), crash = ease((t - 0.8) / 0.12);
      return { armL: { rz: -1.5 * open + 1.6 * crash, rx: -0.4 }, armR: { rz: 1.5 * open - 1.6 * crash, rx: -0.4 }, foreL: { rx: -0.6 }, foreR: { rx: -0.6 }, head: { rx: -0.3 * open + 0.3 * crash }, hips: { sy: 1 - 0.1 * crash }, key: { rz: t * TAU * 4 } };
    } },
  };
  const geo = layered([{ sc: fur, o: LAYER.cloth }, { sc: face, o: LAYER.skin }, { sc: tin, o: LAYER.hard }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== possessed stuffie
function stuffie(k = 1): SculptModel {
  const P: Proportions = { ...scaleP(ADULT, 0.5 * k), hip: 10 * k, knee: 6 * k, ankle: 2 * k, waist: 16 * k, chest: 23 * k, shoulderY: 26 * k, shoulderX: 11 * k, elbowY: 19 * k, wristY: 13 * k, neck: 29 * k, headY: 39 * k, headR: 11 * k, stance: 6 * k, leg: [4.6 * k, 4.4 * k, 4.4 * k], arm: [4 * k, 3.8 * k, 3.8 * k], hipW: 11 * k, waistW: 13 * k, chestW: 12 * k, depth: 0.85, armOut: 2 * k };
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(k < 0.8 ? 1.5 : 1.6, 3 * k);
  const plush = flat(0x7a6250);
  humanBody(sc, P, b, { skin: plush, torso: plush, upperArm: plush, foreArm: plush, hand: plush, thigh: plush, shin: plush, shoe: plush, torsoSurf: SURF.plush, legSurf: SURF.plush, noHands: true });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'sph', c: [s * (P.shoulderX + P.armOut * 1.6), P.wristY - 2 * k, 1], r: 4.4 * k }, { col: plush, bone: b(`hand${n}`), k: 2 * k, surf: SURF.plush });
  sc.add({ t: 'ell', c: [0, 17 * k, 8 * k], r: [7.5 * k, 8.5 * k, 3 * k] }, { col: flat(0xa89478), bone: b('spine'), k: 1 * k, surf: SURF.plush });
  // stuffing bursting from a torn seam
  for (let i = 0; i < 5; i++) sc.add({ t: 'sph', c: [(-9 + i * 1.7) * k, (20 + (i % 2) * 2.5) * k, (8 - i * 0.6) * k], r: (2 + (i % 3) * 0.8) * k }, { col: PAL.cream, bone: b('spine'), k: 1 * k, surf: SURF.plush });
  head(sc, P, b('head'), { skin: plush, nose: 0.01, ears: false, brow: 0, cheeks: 0.8, chin: 0 });
  for (const s of [1, -1]) {
    sc.add({ t: 'sph', c: [s * 8.6 * k, 48 * k, -1 * k], r: 4.4 * k }, { col: plush, bone: b('head'), k: 1.6 * k, surf: SURF.plush });
    sc.add({ t: 'sph', c: [s * 8.6 * k, 48 * k, 1.8 * k], r: 2.4 * k }, { sub: true, k: 1 * k });
  }
  sc.add({ t: 'ell', c: [0, 36 * k, 8.6 * k], r: [5.4 * k, 4.2 * k, 4 * k] }, { col: flat(0xa89478), bone: b('head'), k: 1.5 * k, surf: SURF.plush });
  sc.detail(ellipsoid(1.8 * k, 1.3 * k, 1.2 * k, 8, 6), { col: PAL.ink, bone: b('head'), pos: [0, 38 * k, 12.3 * k], surf: SURF.porcelain });
  // one button eye; the other socket glows, its button dangling by a thread
  sc.detail(cyl(2.3 * k, 2.3 * k, 1 * k, 12), { col: PAL.ink, bone: b('head'), pos: [4 * k, 42 * k, 9.4 * k], rot: [Math.PI / 2 - 0.3, 0, 0], surf: SURF.porcelain });
  sc.add({ t: 'sph', c: [-4 * k, 42 * k, 9.6 * k], r: 2 * k }, { sub: true, k: 0.6 * k });
  glowEye(sc, b('head'), [-4 * k, 42 * k, 8.4 * k], 1.4 * k, PAL.hotRed, 1.5);
  sc.detail(tube([[-4 * k, 41 * k, 9.8 * k], [-5 * k, 38 * k, 11 * k], [-5.4 * k, 35 * k, 11.4 * k]], 0.3 * k, 3, 6), { col: PAL.ink, bone: b('head') });
  sc.detail(cyl(2.2 * k, 2.2 * k, 1 * k, 10), { col: PAL.ink, bone: b('head'), pos: [-5.4 * k, 34 * k, 11.6 * k], rot: [Math.PI / 2, 0, 0.4], surf: SURF.porcelain });
  for (let i = 0; i < 6; i++) sc.detail(cyl(0.35 * k, 0.35 * k, 2.6 * k, 4), { col: PAL.ink, bone: b('spine'), pos: [0.4 * k, (24 - i * 2.4) * k, 11.2 * k], rot: [0, 0, Math.PI / 2] });
  for (let i = 0; i < 5; i++) sc.detail(cyl(0.3 * k, 0.3 * k, 2.2 * k, 4), { col: PAL.ink, bone: b('head'), pos: [(-3.4 + i * 1.7) * k, 33.6 * k, 10.9 * k], rot: [0, 0, 0] });
  const clips: Clips = {
    // a lurching limp: the right leg drags, the body lists, the head lolls, arms swing dead
    move: { frames: 40, fn: (t) => {
      const s = sin(t), c = cos(t), step = Math.max(0, c);
      return {
        hips: { ty: -1.4 * k * (0.5 - 0.5 * cos(t, 2)), rz: 0.16 + 0.1 * s, ry: -0.1 * s, sy: 1 - 0.06 * step },
        spine: { rx: 0.18, rz: -0.08 * s },
        chest: { rz: -0.05 * s },
        head: { rz: -0.3 - 0.18 * sin(t, 1, 0.15), rx: 0.15 * sin(t, 2) },
        thighL: { rx: -0.55 * s }, shinL: { rx: 0.8 * step },
        thighR: { rx: 0.15 * s + 0.1, rz: 0.12 }, shinR: { rx: 0.1 },
        armL: { rx: 0.4 * sin(t, 1, -0.2), rz: -0.15 }, armR: { rx: -0.3 * sin(t, 1, -0.25), rz: 0.35 },
        foreL: { rx: -0.2 }, foreR: { rx: -0.1 },
      };
    } },
    // crouch… LUNGE
    attack: { frames: 18, loop: false, fn: (t) => {
      const crouch = ease(t / 0.7) * (1 - ease((t - 0.75) / 0.1)), leap = ease((t - 0.75) / 0.15);
      return { hips: { ty: -3 * k * crouch + 2 * k * leap, sy: 1 - 0.12 * crouch + 0.1 * leap }, spine: { rx: 0.35 * crouch + 0.5 * leap }, armL: { rx: -1.6 * leap - 0.3 * crouch }, armR: { rx: -1.6 * leap - 0.3 * crouch }, head: { rx: -0.3 * leap, rz: -0.2 }, thighL: { rx: -0.5 * crouch }, thighR: { rx: -0.5 * crouch }, shinL: { rx: 0.9 * crouch }, shinR: { rx: 0.9 * crouch } };
    } },
  };
  return { geo: sc.build({ ...CREATURE, aoScale: k }), rig: new Rig(bones, clips) };
}

// ================================================================== cotton-candy slime
function cottonCandySlime(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'base', parent: null, head: [0, 0, 0] },
    { name: 'mid', parent: 'base', head: [0, 14, 0] },
    { name: 'top', parent: 'mid', head: [0, 26, 0] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1.8, 6);
  const pink = flat(0xb5788f);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rr = 9 + vnoise(i, 1, 2) * 4;
    sc.add({ t: 'ell', c: [Math.cos(a) * 9, 7 + vnoise(i, 3, 1) * 3, Math.sin(a) * 9], r: [rr, rr * 0.75, rr] }, { col: pink, bone: b('base'), k: 6, surf: SURF.plush });
  }
  sc.add({ t: 'ell', c: [0, 19, 0], r: [14.5, 13, 14] }, { col: flat(0xc08aa0), bone: b('mid'), k: 7, surf: SURF.plush });
  sc.add({ t: 'ell', c: [1.6, 31, -1.6], r: [10, 10, 9.6] }, { col: flat(0xc08aa0), bone: b('top'), k: 6, surf: SURF.plush });
  for (const s of [1, -1]) sc.add({ t: 'ell', c: [s * 5, 23, 12.8], r: [3, 3.8, 3] }, { sub: true, k: 1.4 });
  sc.add({ t: 'ell', c: [0, 15, 13.4], r: [5, 3, 3] }, { sub: true, k: 1.6 });
  for (const s of [1, -1]) glowEye(sc, b('mid'), [s * 5, 23.4, 10.8], 1.1, PAL.sickYellow, 1.6);
  sc.detail(tube([[2, 13.4, 12.8], [2.6, 8, 14.6], [2.2, 3, 15.2]], (t) => 1.2 - t * 0.6, 5, 8), { col: flat(0xd8a5b8)(new THREE.Vector3(), new THREE.Vector3()) as THREE.Color, bone: b('mid'), surf: SURF.latex });
  sc.detail(cone(5, 26, 12), { col: PAL.cream, bone: b('top'), pos: [-4, 40, -6], rot: [0.3, 0, 0.35], surf: SURF.canvas });
  const clips: Clips = {
    // squash-crawl: the base smears forward, the top sloshes behind
    move: { frames: 36, fn: (t) => ({ base: { sx: 1 + 0.08 * sin(t), sz: 1 + 0.14 * sin(t), sy: 1 - 0.1 * sin(t) }, mid: { tz: 2 * sin(t, 1, -0.15), sy: 1 + 0.08 * sin(t, 1, -0.2) }, top: { tz: 2.5 * sin(t, 1, -0.3), rx: 0.15 * sin(t, 1, -0.3), rz: 0.1 * cos(t) } }) },
    attack: { frames: 18, loop: false, fn: (t) => {
      const swell = ease(t / 0.8), spit = ease((t - 0.82) / 0.1);
      return { mid: { sx: 1 + 0.2 * swell - 0.15 * spit, sy: 1 + 0.25 * swell - 0.2 * spit, sz: 1 + 0.2 * swell }, top: { rx: -0.3 * swell + 0.5 * spit }, base: { sy: 1 - 0.1 * swell } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== whack-a-mole
function whackAMole(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 0, 0] },
    { name: 'head', parent: 'body', head: [0, 20, 2] },
    { name: 'clawL', parent: 'body', head: [8, 16, 3] },
    { name: 'clawR', parent: 'body', head: [-8, 16, 3] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1.5, 3);
  const fur = flat(0x4a3a30);
  sc.add({ t: 'cap', a: [0, 0, 0], b: [0, 18, 0.6], ra: 11.5, rb: 9.5 }, { col: fur, bone: b('body'), k: 2, surf: SURF.plush });
  sc.add({ t: 'ell', c: [0, 25, 1.4], r: [9, 8.5, 8.6] }, { col: fur, bone: b('head'), k: 4, surf: SURF.plush });
  sc.add({ t: 'cap', a: [0, 23, 5], b: [0, 21.6, 12.2], ra: 4.6, rb: 2.6 }, { col: flat(0xb08a7a), bone: b('head'), k: 2.4, surf: SURF.skin });
  sc.add({ t: 'sph', c: [0, 22.2, 13.4], r: 2.4 }, { col: 0x9a5060, bone: b('head'), k: 0.8, surf: SURF.skin });
  sc.detail(rbox(4.2, 4.6, 1.4, 0.4, 1), { col: PAL.bone, bone: b('head'), pos: [0, 18.4, 11.4], surf: SURF.porcelain });
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * 3.8, 27, 8.6], 1.5, PAL.hotRed, 1.3);
  sc.detail(lathe([[0, 0], [12.4, 0], [12.4, 0.6], [10.4, 3], [8, 8.4], [0, 9]], 16), { col: flat(PAL.mustard)(new THREE.Vector3(), new THREE.Vector3()) as THREE.Color, bone: b('head'), pos: [0, 29, 0], rot: [-0.15, 0, 0.2], surf: SURF.paint });
  for (const [s, n] of [[1, 'clawL'], [-1, 'clawR']] as const) {
    sc.add({ t: 'ell', c: [s * 9.4, 13.6, 8], r: [4.2, 2.6, 5] }, { col: flat(0xb08a7a), bone: b(n), k: 1.5, surf: SURF.skin });
    for (let i = 0; i < 3; i++) sc.detail(cone(0.8, 3.6, 5), { col: PAL.bone, bone: b(n), pos: [s * (7.8 + i * 1.4), 13, 12.4], rot: [Math.PI / 2, 0, 0], surf: SURF.bone });
  }
  const clips: Clips = {
    move: { frames: 48, fn: (t) => ({ body: { sy: 1 + 0.03 * sin(t, 2) }, head: { ry: 0.5 * sin(t) * Math.abs(sin(t)), rx: 0.1 * sin(t, 4) * pulse(t, 0.5, 0.2) }, clawL: { rx: -0.2 * sin(t, 2) }, clawR: { rx: -0.2 * sin(t, 2, 0.5) } }) },
    attack: { frames: 16, loop: false, fn: (t) => {
      const up = ease(t / 0.75), slam = ease((t - 0.8) / 0.12);
      return { body: { rx: -0.3 * up + 0.5 * slam }, clawL: { rx: -1.8 * up + 2 * slam }, clawR: { rx: -1.8 * up + 2 * slam }, head: { rx: -0.25 * up + 0.2 * slam } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== evil clown
function evilClown(): SculptModel {
  // D-86, the regular-enemy benchmark of the character art standard: built in layers — a greasepaint face,
  // a baggy striped suit (stripes drawn per pixel), a pleated ruff and frilled cuffs that give him a
  // silhouette from above, white gloves, glossy red shoes and nose. The same skeleton, size and clips.
  const P = scaleP(ADULT, 1.0, { headR: 12.6, headY: 74.5, chestW: 14, waistW: 15.5, hipW: 14.5, arm: [4.8, 4.2, 3.2], leg: [6, 5.4, 4.6], stance: 7.6 });
  const bones = humanBones(P);
  const b = bi(bones);
  // (a crowd enemy: meshed for its size on screen — the stripes are per pixel, the features crisp details)
  const face = new Sculpt(1.5, 4, 0.5), hair = new Sculpt(2.0, 4, 0.5), suit = new Sculpt(2.5, 4.5, 0.5), ruff = new Sculpt(1.75, 4, 0.5);
  const gloves = new Sculpt(1.6, 3, 0.5), shoes = new Sculpt(1.9, 3, 0.5), cuffs = new Sculpt(2.1, 3, 0.5);
  const PAINT = 0xe6ded0, SUIT = 0x55663a, SUIT2 = 0xd4c8a8, FRILL = 0xe2d8c2, RED = 0xa81d18;
  const r = P.headR, y = P.headY;
  // ---- the face: a round cranium, full cheeks, a heavy brow over deep sockets
  const fs = { col: PAINT, bone: b('head'), surf: FAM.greasepaint };
  face.add({ t: 'ell', c: [0, y + r * 0.1, -r * 0.05], r: [r, r * 1.02, r * 0.98] }, { ...fs, k: 1.5 });
  face.add({ t: 'ell', c: [0, y - r * 0.46, r * 0.18], r: [r * 0.74, r * 0.52, r * 0.72] }, { ...fs, k: 2.4 });
  for (const s of [1, -1]) {
    face.add({ t: 'ell', c: [s * r * 0.5, y - r * 0.22, r * 0.56], r: [r * 0.36, r * 0.3, r * 0.3] }, { ...fs, k: 1.8 });
    face.add({ t: 'ell', c: [s * r * 0.96, y - r * 0.02, -r * 0.05], r: [r * 0.12, r * 0.24, r * 0.18] }, { ...fs, k: 0.8 });
    face.add({ t: 'ell', c: [s * r * 0.36, y + r * 0.1, r * 0.9], r: [r * 0.22, r * 0.17, r * 0.15] }, { sub: true, k: 0.8 });
  }
  face.add({ t: 'ell', c: [0, y + r * 0.3, r * 0.74], r: [r * 0.64, r * 0.12, r * 0.2] }, { ...fs, k: 1.2 });
  face.add({ t: 'cap', a: [0, P.neck - 3, 0], b: [0, P.neck + 3, 0.3], ra: r * 0.36, rb: r * 0.32 }, { ...fs, bone: b('neck'), k: 2, ink: false });
  const fz = (x: number, yy: number) => frontZ(face, x, yy);
  // greasepaint: black diamonds through amber eyes, high arched brows; a glossy red nose; a wide red grin
  for (const s of [1, -1]) {
    const ex = s * r * 0.36, ey = y + r * 0.1;
    face.detail(extrude([[0, 5.2], [2.5, 0], [0, -5.2], [-2.5, 0]], 0.4, 0, 1), { col: 0x111013, bone: b('head'), pos: [ex, ey + 0.4, fz(ex, ey + 2.6) - 0.3], rot: [-0.25, s * 0.38, 0], surf: FAM.greasepaint, ink: false });
    glowEye(face, b('head'), [ex, ey, fz(ex, ey) - 0.2], r * 0.1, PAL.amber, 1.4);
    const brow: V3[] = [[s * r * 0.14, y + r * 0.42, 0], [s * r * 0.36, y + r * 0.62, 0], [s * r * 0.6, y + r * 0.44, 0]].map(([x, yy]) => [x, yy, fz(x, yy) + 0.05] as V3);
    face.detail(tube(brow, 0.62, 4, 10), { col: 0x111013, bone: b('head'), surf: FAM.greasepaint, ink: false });
  }
  face.detail(sphere(3.5, 12, 8), { col: RED, bone: b('head'), pos: [0, y - 0.8, fz(0, y - 0.8) + 1.6], surf: FAM.latex, ink: false });
  const grin: V3[] = [-1, -0.55, 0, 0.55, 1].map((u) => {
    const x = u * 8.2, yy = y - 7.2 - (1 - u * u) * 2.8 + Math.abs(u) ** 3 * 1.6;
    return [x, yy, fz(x, yy) + 0.35] as V3;
  });
  face.detail(ellipsoid(6.6, 2.4, 1.2, 14, 6), { col: 0x1a0c0c, bone: b('head'), pos: [0, y - 9.4, fz(0, y - 9.4) - 0.2], surf: FAM.skin, ink: false });
  face.detail(tube(grin, 1.35, 6, 18), { col: RED, bone: b('head'), surf: FAM.latex, ink: false });
  for (let i = 0; i < 6; i++) {
    const tx = -4.4 + i * 1.76, ty = y - 8.4 - (1 - (tx / 8.2) ** 2) * 1.4;
    face.detail(cone(0.72, 1.9, 4), { col: 0xe6dcc4, bone: b('head'), pos: [tx, ty, fz(tx, ty) + 0.25], rot: [Math.PI, 0, 0], surf: FAM.bone, ink: false });
  }
  // ---- hair: two big rust-red tufts of curls
  for (const s of [1, -1]) for (const [dx, dy, dz, rr] of [[0.9, 0.15, -0.15, 0.36], [1.05, -0.12, -0.05, 0.3], [0.85, 0.42, -0.3, 0.3], [0.7, -0.2, -0.45, 0.32]] as const) {
    hair.add({ t: 'sph', c: [s * r * dx, y + r * dy, r * dz], r: r * rr }, { col: vertical(0x7a2c14, 0xb8501e, y - r * 0.4, y + r * 0.6), bone: b('head'), k: 0.9, surf: FAM.hair });
  }
  // the cone hat, cocked, mustard with cream dots, and its pompom
  hair.detail(cone(7.4, 22, 20), { col: 0xa8822e, bone: b('head'), pos: [1.2, y + 24.5, -2.5], rot: [-0.24, 0, 0.32], surf: FAM.wool, pat: { kind: 'dots', col: 0xded2b4, a: 3.4, b: 0.42 } });
  hair.detail(sphere(2.9, 12, 8), { col: 0xe4dac4, bone: b('head'), pos: [-2.3, y + 34.6, -5], surf: FAM.wool });
  // ---- the suit: baggy, striped, three pompom buttons
  const st = { kind: 'stripes', col: SUIT2, a: 14, b: 0.45, c: 0.4 } as const;
  const ss = { col: SUIT, surf: FAM.cloth, pat: st };
  suit.add({ t: 'ell', c: [0, P.hip + 1, 0], r: [P.hipW + 1.5, 9, (P.hipW + 1.5) * P.depth] }, { ...ss, bone: b('hips'), k: 2 });
  suit.add({ t: 'ell', c: [0, P.waist, 0.6], r: [P.waistW + 0.8, 10, (P.waistW + 0.8) * P.depth] }, { ...ss, bone: b('spine'), k: 6 });
  suit.add({ t: 'ell', c: [0, P.chest + 1, 0.6], r: [P.chestW + 0.6, 9.5, (P.chestW + 0.6) * P.depth] }, { ...ss, bone: b('chest'), k: 6 });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const sh: V3 = [s * P.shoulderX, P.shoulderY, 0], el: V3 = [s * (P.shoulderX + P.armOut), P.elbowY, -0.8], wr: V3 = [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.8];
    suit.add({ t: 'sph', c: [s * (P.shoulderX - 1), P.shoulderY - 0.5, 0], r: P.arm[0] + 2 }, { ...ss, bone: b('chest'), k: 4 });
    suit.add({ t: 'cap', a: sh, b: el, ra: P.arm[0] + 1.2, rb: P.arm[1] + 1.4 }, { ...ss, bone: b(`arm${n}`), k: 2 });
    suit.add({ t: 'cap', a: el, b: [wr[0], wr[1] + 2.5, wr[2]], ra: P.arm[1] + 1.4, rb: P.arm[2] + 2.2 }, { ...ss, bone: b(`fore${n}`), k: 1.5 });
    const hp: V3 = [s * P.stance, P.hip - 2, 0], kn: V3 = [s * (P.stance + 0.4), P.knee, 0.6], an: V3 = [s * (P.stance + 0.4), P.ankle + 1, 0];
    suit.add({ t: 'cap', a: hp, b: kn, ra: P.leg[0] + 1.6, rb: P.leg[1] + 1.8 }, { ...ss, bone: b(`thigh${n}`), k: 3 });
    suit.add({ t: 'cap', a: kn, b: [an[0], an[1] + 4, an[2]], ra: P.leg[1] + 1.8, rb: P.leg[2] + 2.6 }, { ...ss, bone: b(`shin${n}`), k: 1.5 });
    // frilled cuffs at wrist and ankle: rings of lobes, crisp edges
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      cuffs.add({ t: 'ell', c: [wr[0] + Math.cos(a) * (P.arm[2] + 2.3), wr[1] + 2, wr[2] + Math.sin(a) * (P.arm[2] + 2.3)], r: [2.3, 1.5, 2.3] }, { col: FRILL, bone: b(`fore${n}`), k: 0.7, surf: FAM.cloth });
      cuffs.add({ t: 'ell', c: [an[0] + Math.cos(a) * (P.leg[2] + 2.9), an[1] + 4, an[2] + Math.sin(a) * (P.leg[2] + 2.9)], r: [2.7, 1.7, 2.7] }, { col: FRILL, bone: b(`shin${n}`), k: 0.7, surf: FAM.cloth });
    }
    styleHand(gloves, wr, s, P.arm[2], 0xece4d6, b(`hand${n}`), FAM.cloth, true);
    styleShoe(shoes, [an[0], P.ankle, 0], 15, 0x8e1a16, b(`foot${n}`), { width: 1.2, toeUp: 0.16, surf: FAM.rubber, sole: 0x2a0c0a });
  }
  for (let i = 0; i < 3; i++) {
    const by = P.waist - 7 + i * 7.5;
    suit.detail(sphere(2.6, 10, 6), { col: i === 1 ? 0xb48a2e : RED, bone: b(i < 2 ? 'spine' : 'chest'), pos: [0, by, frontZ(suit, 0, by) + 1.6], surf: FAM.wool, ink: false });
  }
  // ---- the ruff: a ring of pleated lobes round the neck, wider than the head — from above, a scalloped
  // disc that frames the face
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    ruff.add({ t: 'ell', c: [Math.cos(a) * 13.2, P.neck - 3.2, 1 + Math.sin(a) * 12.4], r: [4.6, 2.8, 3.4], rot: [0, -a, 0.18] }, { col: FRILL, bone: b('chest'), k: 1.1, surf: FAM.cloth });
  }
  // ---- a cream pie, held high
  const hx = -(P.shoulderX + P.armOut * 1.6);
  gloves.detail(cyl(6.4, 5.4, 2.4, 18), { col: 0xb0946a, bone: b('handR'), pos: [hx, P.wristY - 6, 6], surf: FAM.wood });
  gloves.detail(torus(5.9, 0.9, 6, 20), { col: 0x9a7a4e, bone: b('handR'), pos: [hx, P.wristY - 4.8, 6], rot: [Math.PI / 2, 0, 0], surf: FAM.wood });
  gloves.detail(ellipsoid(5.8, 2.8, 5.8, 14, 8), { col: 0xeae2d0, bone: b('handR'), pos: [hx, P.wristY - 4.2, 6], surf: SURF.porcelain });
  const gait: Gait = { ...GAIT_WALK, stride: 0.62, knee: 1.1, lift: 0.6, bob: 4, sway: 0.12, twist: 0.12, squash: 0.12, arm: 0.75, armOut: 0.4, elbow: 0.4, headBob: 0.1 };
  const clips: Clips = {
    // a bouncing, knees-high skip with the head cocked
    move: { frames: 32, fn: (t) => mix(gaitPose(t, gait), { head: { rz: 0.22 * sin(t, 0.5), rx: 0.08 }, chest: { rz: 0.06 * sin(t) } }) },
    // cock the pie arm back, lean away — and let fly
    attack: { frames: 20, loop: false, fn: (t) => {
      const wind = ease(t / 0.78), fly = ease((t - 0.8) / 0.12);
      return { armR: { rx: 1.6 * wind - 2.4 * fly, rz: 0.4 * wind }, foreR: { rx: -1.2 * wind + 0.8 * fly }, chest: { ry: 0.5 * wind - 0.6 * fly, rx: -0.2 * wind + 0.25 * fly }, head: { rz: -0.25 * wind }, armL: { rx: -0.8 * wind, rz: -0.6 * wind } };
    } },
  };
  const geo = layered([{ sc: face, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: suit, o: LAYER.cloth }, { sc: ruff, o: LAYER.cloth }, { sc: cuffs, o: LAYER.cloth }, { sc: gloves, o: LAYER.cloth }, { sc: shoes, o: LAYER.hard }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== dunk-tank clown
function dunkTankClown(): SculptModel {
  // D-88, on the standard: a clown fished out of the dunk tank, in layers — grey-blue skin, his paint running
  // from cold glowing eyes, a glossy red nose, a sad mouth; waterlogged hair plastered down; a limp, soaked
  // ruff; a striped bathing suit drawn per pixel; white gloves, big teal shoes; the dripping bucket. The same
  // skeleton, size and clips.
  const P = scaleP(ADULT, 0.9, { headR: 11.5, chestW: 12.5, waistW: 12.5, hipW: 12 });
  const bones = humanBones(P);
  const b = bi(bones);
  const skin = new Sculpt(1.5, 4, 0.5), hair = new Sculpt(1.7, 4, 0.5), suit = new Sculpt(2.2, 4.5, 0.5), ruff = new Sculpt(1.8, 4, 0.5);
  const gloves = new Sculpt(1.6, 3, 0.5), shoes = new Sculpt(1.9, 3, 0.5);
  const SKIN = 0xa9b6b4, NAVY = 0x23304a, CREAM = 0xd2c6aa, RUN = 0x2a3650;
  const r = P.headR, y = P.headY;
  const sk = { col: SKIN, surf: FAM.skin };
  // ---- skin: a round bald head gone grey-blue, full cheeks, a heavy brow over deep sockets; bare arms and legs
  skin.add({ t: 'ell', c: [0, y + r * 0.1, -r * 0.05], r: [r, r * 1.02, r * 0.98] }, { ...sk, bone: b('head'), k: 1.5 });
  skin.add({ t: 'ell', c: [0, y - r * 0.46, r * 0.18], r: [r * 0.72, r * 0.5, r * 0.7] }, { ...sk, bone: b('head'), k: 2.4 });
  for (const s of [1, -1]) {
    skin.add({ t: 'ell', c: [s * r * 0.5, y - r * 0.26, r * 0.55], r: [r * 0.34, r * 0.28, r * 0.28] }, { ...sk, bone: b('head'), k: 1.8 });
    skin.add({ t: 'ell', c: [s * r * 0.96, y - r * 0.02, -r * 0.05], r: [r * 0.12, r * 0.24, r * 0.18] }, { ...sk, bone: b('head'), k: 0.8 });
    skin.add({ t: 'ell', c: [s * r * 0.36, y + r * 0.06, r * 0.9], r: [r * 0.22, r * 0.17, r * 0.15] }, { sub: true, k: 0.8 });
  }
  skin.add({ t: 'ell', c: [0, y + r * 0.28, r * 0.74], r: [r * 0.62, r * 0.12, r * 0.2] }, { ...sk, bone: b('head'), k: 1.2 });
  skin.add({ t: 'cap', a: [0, P.neck - 3, 0], b: [0, P.neck + 3, 0.3], ra: r * 0.34, rb: r * 0.3 }, { ...sk, bone: b('neck'), k: 2, ink: false });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const sh: V3 = [s * P.shoulderX, P.shoulderY, 0], el: V3 = [s * (P.shoulderX + P.armOut), P.elbowY, -0.8], wr: V3 = [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.8];
    skin.add({ t: 'cap', a: sh, b: el, ra: P.arm[0], rb: P.arm[1] }, { ...sk, bone: b(`arm${n}`), k: 2 });
    skin.add({ t: 'cap', a: el, b: wr, ra: P.arm[1], rb: P.arm[2] }, { ...sk, bone: b(`fore${n}`), k: 1.5 });
    const hp: V3 = [s * P.stance, P.hip - 2, 0], kn: V3 = [s * (P.stance + 0.4), P.knee, 0.6], an: V3 = [s * (P.stance + 0.4), P.ankle + 1, 0];
    skin.add({ t: 'cap', a: hp, b: kn, ra: P.leg[0], rb: P.leg[1] }, { ...sk, bone: b(`thigh${n}`), k: 3 });
    skin.add({ t: 'cap', a: kn, b: an, ra: P.leg[1], rb: P.leg[2] }, { ...sk, bone: b(`shin${n}`), k: 1.5 });
    styleHand(gloves, wr, s, P.arm[2], 0xe4ded2, b(`hand${n}`), FAM.cloth, true);
    styleShoe(shoes, [an[0], P.ankle, 0], 13, 0x2e6a68, b(`foot${n}`), { width: 1.25, toeUp: 0.16, surf: FAM.rubber, sole: 0x14262a });
  }
  const fz = (x: number, yy: number) => frontZ(skin, x, yy);
  // the paint washed away but round the eyes: cold glowing eyes in smeared navy, running down the cheeks; a
  // glossy red nose; a sad mouth in faded blue
  for (const s of [1, -1]) {
    const ex = s * r * 0.36, ey = y + r * 0.06;
    skin.detail(ellipsoid(r * 0.25, r * 0.21, 0.5, 12, 6), { col: RUN, bone: b('head'), pos: [ex, ey, fz(ex, ey) - 0.15], rot: [0, s * 0.35, s * 0.25], surf: FAM.greasepaint, ink: false });
    glowEye(skin, b('head'), [ex, ey, fz(ex, ey) - 0.2], r * 0.09, PAL.cold, 1.4);
    const run = ([[ex + s * r * 0.04, ey - r * 0.14], [ex + s * r * 0.05, ey - r * 0.32], [ex + s * r * 0.06, ey - r * 0.48]] as const).map(([x, yy]): V3 => [x, yy, fz(x, yy) + 0.05]);
    skin.detail(tube(run, 0.38, 4, 8), { col: RUN, bone: b('head'), surf: FAM.greasepaint, ink: false });
  }
  skin.detail(sphere(3.1, 12, 8), { col: 0xa81d18, bone: b('head'), pos: [0, y - r * 0.08, fz(0, y - r * 0.08) + 1.2], surf: FAM.latex, ink: false });
  const mouth = [-1, -0.5, 0, 0.5, 1].map((u): V3 => {
    const x = u * r * 0.42, yy = y - r * 0.54 + (1 - u * u) * r * 0.08;
    return [x, yy, fz(x, yy) + 0.1];
  });
  skin.detail(tube(mouth, 0.75, 5, 14), { col: 0x3a4c6a, bone: b('head'), surf: FAM.greasepaint, ink: false });
  // ---- hair: what's left, waterlogged, plastered down the sides and back of the crown in strands
  for (const a of [-2.3, -1.7, -1.15, 1.15, 1.7, 2.3]) {
    hair.add({ t: 'cap', a: [Math.sin(a) * r * 0.5, y + r * 1.0, Math.cos(a) * r * 0.4], b: [Math.sin(a) * r * 0.98, y - r * 0.4, Math.cos(a) * r * 0.66], ra: 1.5, rb: 1.0 }, { col: 0x2e4440, bone: b('head'), k: 0.6, surf: FAM.latex });
  }
  // ---- the bathing suit: navy and cream stripes per pixel, to mid-thigh
  const su = { col: NAVY, surf: FAM.cloth, pat: { kind: 'stripes', col: CREAM, a: 12, b: 0.5 } as const };
  suit.add({ t: 'ell', c: [0, P.hip + 1, 0], r: [P.hipW + 1.2, 8, (P.hipW + 1.2) * P.depth] }, { ...su, bone: b('hips'), k: 2 });
  suit.add({ t: 'ell', c: [0, P.waist, 0.5], r: [P.waistW + 0.9, 9, (P.waistW + 0.9) * P.depth] }, { ...su, bone: b('spine'), k: 5 });
  suit.add({ t: 'ell', c: [0, P.chest + 1, 0.6], r: [P.chestW + 0.7, 9, (P.chestW + 0.7) * P.depth] }, { ...su, bone: b('chest'), k: 5 });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    suit.add({ t: 'sph', c: [s * (P.shoulderX - 1), P.shoulderY - 0.5, 0], r: P.arm[0] + 1.6 }, { ...su, bone: b('chest'), k: 3 });
    const hp: V3 = [s * P.stance, P.hip - 2, 0], kn: V3 = [s * (P.stance + 0.4), P.knee, 0.6];
    suit.add({ t: 'cap', a: hp, b: [(hp[0] + kn[0]) / 2, (hp[1] + kn[1]) / 2, 0.3], ra: P.leg[0] + 1.1, rb: P.leg[0] + 0.7 }, { ...su, bone: b(`thigh${n}`), k: 2 });
  }
  // ---- the ruff, limp and soaked: its pleats hang instead of standing out
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    ruff.add({ t: 'ell', c: [Math.cos(a) * 10.6, P.neck - 4.2, 1 + Math.sin(a) * 9.8], r: [3.8, 2.4, 2.8], rot: [0, -a, 0.75] }, { col: 0xc8c4b4, bone: b('chest'), k: 1, surf: FAM.cloth });
  }
  // ---- the dripping bucket in the left hand
  const hx = P.shoulderX + P.armOut * 1.6;
  gloves.detail(lathe([[0, 0], [5, 0], [6.4, 9], [0, 9]], 16), { col: C(PAL.iron), bone: b('handL'), pos: [hx + 1, P.wristY - 16, 4], surf: FAM.iron });
  gloves.detail(cyl(5.8, 5.8, 0.6, 16), { col: 0x203a48, bone: b('handL'), pos: [hx + 1, P.wristY - 7.4, 4], emit: 0.2, surf: SURF.glass });
  gloves.detail(torus(6.2, 0.4, 4, 16, Math.PI), { col: PAL.iron, bone: b('handL'), pos: [hx + 1, P.wristY - 6.6, 4], surf: FAM.iron });
  const gait: Gait = { ...GAIT_WALK, stride: 0.32, knee: 0.4, bob: 1.1, lean: 0.18, sway: 0.08, twist: 0.05, squash: 0.03, arm: 0.12, armOut: 0.2, elbow: 0.15, headBob: 0.05 };
  const clips: Clips = {
    // a soggy, slump-shouldered shuffle
    move: { frames: 40, fn: (t) => mix(gaitPose(t, gait), { head: { rx: 0.25, rz: 0.15 * sin(t, 0.5) }, chest: { rx: 0.1 }, armL: { rx: 0.1 } }) },
    // heave the bucket
    attack: { frames: 20, loop: false, fn: (t) => {
      const back = ease(t / 0.78), heave = ease((t - 0.8) / 0.14);
      return { armL: { rx: 1.2 * back - 2.4 * heave, rz: -0.3 * back }, foreL: { rx: -0.5 * back }, chest: { ry: -0.4 * back + 0.5 * heave, rx: -0.15 * back + 0.3 * heave }, hips: { sy: 1 - 0.06 * back } };
    } },
  };
  const geo = layered([{ sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: suit, o: LAYER.cloth }, { sc: ruff, o: LAYER.cloth }, { sc: gloves, o: LAYER.cloth }, { sc: shoes, o: LAYER.hard }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== puppet soldier
function puppetSoldier(): SculptModel {
  // D-88, on the standard: a toy soldier on strings, in layers — a wooden head with painted eyes, red cheeks and
  // a painted moustache under a tall black shako with a brass plate and a red plume; a red tunic with white
  // cross-belts, brass buttons and gold epaulettes; navy trousers; glossy black boots; a wooden ball showing at
  // every joint. The musket and the strings as before; the same skeleton, size and snapping march.
  const P = scaleP(ADULT, 0.95, { headR: 10, chestW: 11, waistW: 10, hipW: 10, arm: [3.4, 3.1, 2.8], leg: [3.8, 3.4, 3.2], stance: 6 });
  const bones = humanBones(P);
  const b = bi(bones);
  // (tight joint bands: wooden segments stay rigid)
  const wood = new Sculpt(1.5, 1.5, 0.5), coat = new Sculpt(1.9, 1.5, 0.5), legs = new Sculpt(1.9, 1.5, 0.5);
  const WOOD = 0xb08a62, RED = 0x9a2a22, NAVY = 0x1f2a44, WHITE = 0xe2dccc, GOLD = 0xb8933e;
  const r = P.headR, y = P.headY;
  const wd = { col: WOOD, surf: FAM.wood };
  // ---- wood: a turned head with a squared jaw and a long nose, the neck, mitten hands, a ball at every joint
  wood.add({ t: 'ell', c: [0, y + r * 0.08, 0], r: [r * 0.88, r * 1.0, r * 0.88] }, { ...wd, bone: b('head'), k: 1 });
  wood.add({ t: 'box', c: [0, y - r * 0.55, r * 0.12], h: [r * 0.62, r * 0.34, r * 0.6], r: r * 0.2 }, { ...wd, bone: b('head'), k: 0.8 });
  wood.add({ t: 'cap', a: [0, y + r * 0.02, r * 0.78], b: [0, y - r * 0.2, r * 1.08], ra: r * 0.13, rb: r * 0.16 }, { ...wd, bone: b('head'), k: 0.6 });
  wood.add({ t: 'cap', a: [0, P.neck - 3, 0], b: [0, P.neck + 2.5, 0], ra: r * 0.36, rb: r * 0.34 }, { ...wd, bone: b('neck'), k: 0.8, ink: false });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const sh: V3 = [s * P.shoulderX, P.shoulderY, 0], el: V3 = [s * (P.shoulderX + P.armOut), P.elbowY, -0.8], wr: V3 = [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.8];
    const kn: V3 = [s * (P.stance + 0.4), P.knee, 0.6];
    for (const [bn, p, rr] of [[`arm${n}`, sh, P.arm[1] + 1.1], [`fore${n}`, el, P.arm[1] + 0.9], [`shin${n}`, kn, P.leg[1] + 0.9]] as const) wood.add({ t: 'sph', c: p, r: rr }, { ...wd, bone: b(bn), k: 0.3 });
    wood.add({ t: 'ell', c: [wr[0] + s * 0.3, wr[1] - 3.4, wr[2] + 0.4], r: [2.6, 3.6, 2.4] }, { ...wd, bone: b(`hand${n}`), k: 0.5 });
  }
  const fz = (x: number, yy: number) => frontZ(wood, x, yy);
  // the face, painted: round black eyes, high brows, red cheek discs, a waxed moustache, the jaw's hinge line
  for (const s of [-1, 1]) {
    const ex = s * r * 0.34, ey = y + r * 0.16;
    wood.detail(sphere(r * 0.1, 8, 6), { col: PAL.ink, bone: b('head'), pos: [ex, ey, fz(ex, ey) - 0.1], surf: FAM.eye });
    wood.detail(rbox(r * 0.34, r * 0.07, 0.3, 0.1, 1), { col: PAL.ink, bone: b('head'), pos: [ex, y + r * 0.38, fz(ex, y + r * 0.38) + 0.05], rot: [0, s * 0.3, s * -0.12], surf: SURF.paint });
    const cx = s * r * 0.52, cy = y - r * 0.18;
    wood.detail(cyl(r * 0.2, r * 0.2, 0.3, 14), { col: 0xb8443a, bone: b('head'), pos: [cx, cy, fz(cx, cy) + 0.05], rot: [Math.PI / 2, 0, -s * 0.55], surf: SURF.paint });
  }
  const my = y - r * 0.42, mz = fz(r * 0.25, my);
  wood.detail(tube([[-r * 0.52, my + r * 0.12, mz - r * 0.2], [-r * 0.22, my - r * 0.02, mz - 0.1], [0, my + r * 0.02, mz + 0.2], [r * 0.22, my - r * 0.02, mz - 0.1], [r * 0.52, my + r * 0.12, mz - r * 0.2]], (t) => r * (0.03 + 0.05 * Math.sin(t * Math.PI)), 5, 14), { col: PAL.ink, bone: b('head'), surf: SURF.paint, ink: false });
  wood.detail(rbox(r * 0.7, r * 0.06, 0.3, 0.1, 1), { col: 0x2a1a12, bone: b('head'), pos: [0, y - r * 0.6, fz(0, y - r * 0.6) + 0.05], surf: SURF.paint, ink: false });
  // the shako: tall, black, flaring a little, a gold band, a brass plate, a glossy peak and a red plume on top
  const sy = y + r * 0.62;
  coat.detail(lathe([[0, 0], [r * 0.86, 0], [r * 0.9, r * 0.12], [r * 0.98, r * 1.5], [0, r * 1.5]], 20), { col: 0x16141a, bone: b('head'), pos: [0, sy, -0.4], rot: [-0.08, 0, 0], surf: [0.5, 0] });
  coat.detail(cyl(r * 1.0, r * 0.99, r * 0.16, 20, true), { col: GOLD, bone: b('head'), pos: [0, sy + r * 1.42, -0.5], rot: [-0.08, 0, 0], surf: FAM.gold });
  coat.detail(rbox(r * 0.5, r * 0.64, 0.6, 0.3, 1), { col: GOLD, bone: b('head'), pos: [0, sy + r * 0.72, r * 0.9], rot: [-0.12, 0, 0], surf: FAM.brass, ink: false });
  coat.detail(ellipsoid(r * 0.7, 0.4, r * 0.38, 14, 6), { col: 0x0c0a0e, bone: b('head'), pos: [0, sy + 0.2, r * 0.82], rot: [0.25, 0, 0], surf: FAM.latex });
  coat.detail(sphere(r * 0.3, 12, 8), { col: 0xb02a22, bone: b('head'), pos: [0, sy + r * 1.62, -0.6], surf: FAM.wool });
  // ---- the tunic: red, a high collar, a short skirt, sleeves in two segments with white cuffs, gold epaulettes
  const cs = { col: RED, surf: SURF.paint };
  coat.add({ t: 'ell', c: [0, P.waist, 0.4], r: [P.waistW + 0.8, 8.5, (P.waistW + 0.8) * P.depth] }, { ...cs, bone: b('spine'), k: 3 });
  coat.add({ t: 'ell', c: [0, P.chest + 1, 0.6], r: [P.chestW + 0.8, 9, (P.chestW + 0.8) * P.depth] }, { ...cs, bone: b('chest'), k: 3 });
  coat.add({ t: 'cap', a: [0, P.waist - 3, 0.3], b: [0, P.hip - 4, 0.3], ra: P.waistW + 1.0, rb: P.hipW + 2.4, sz: P.depth + 0.1 }, { ...cs, bone: b('hips'), k: 2 });
  coat.add({ t: 'tor', c: [0, P.neck - 2, 0.3], R: r * 0.4, r: 1.3 }, { ...cs, bone: b('chest'), k: 0.4 });
  const along = (a: V3, c: V3, u: number): V3 => [a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u, a[2] + (c[2] - a[2]) * u];
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const sh: V3 = [s * P.shoulderX, P.shoulderY, 0], el: V3 = [s * (P.shoulderX + P.armOut), P.elbowY, -0.8], wr: V3 = [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.8];
    coat.add({ t: 'cap', a: along(sh, el, 0.18), b: along(sh, el, 0.82), ra: P.arm[0] + 0.5, rb: P.arm[1] + 0.5 }, { ...cs, bone: b(`arm${n}`), k: 0.6 });
    coat.add({ t: 'cap', a: along(el, wr, 0.2), b: along(el, wr, 0.86), ra: P.arm[1] + 0.5, rb: P.arm[2] + 0.6 }, { ...cs, bone: b(`fore${n}`), k: 0.6 });
    coat.add({ t: 'tor', c: along(el, wr, 0.84), R: P.arm[2] + 0.8, r: 0.7 }, { col: WHITE, bone: b(`fore${n}`), k: 0.2, surf: SURF.paint });
    coat.add({ t: 'ell', c: [s * (P.shoulderX - 0.5), P.shoulderY + 1.8, 0], r: [3.4, 1.1, 3.0] }, { col: GOLD, bone: b('chest'), k: 0.3, surf: FAM.gold });
  }
  coat.add({ t: 'box', c: [0, P.hip - 14, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.2 });
  // white cross-belts (laid on the chest: as sculpted bands they were thinner than a mesh cell), brass buttons
  for (const s of [1, -1]) {
    const belt = [-1, -0.5, 0, 0.5, 1].map((u): V3 => [s * u * 6, P.chest - 2 + u * 10, frontZ(coat, s * u * 6, P.chest - 2 + u * 10) + 0.35]);
    coat.detail(tube(belt, 0.8, 4, 12), { col: WHITE, bone: b('chest'), surf: SURF.paint, ink: false });
  }
  for (let i = 0; i < 4; i++) {
    const by = P.waist - 3 + i * 4.4;
    coat.detail(sphere(0.9, 8, 6), { col: 0xc4a258, bone: b(i < 2 ? 'spine' : 'chest'), pos: [0, by, frontZ(coat, 0, by) + 0.4], surf: FAM.brass });
  }
  // ---- navy trousers to the knee's ball joint, glossy black boots below it
  const ls = { col: NAVY, surf: SURF.paint };
  legs.add({ t: 'ell', c: [0, P.hip + 1, 0], r: [P.hipW + 0.3, 7, (P.hipW + 0.3) * P.depth] }, { ...ls, bone: b('hips'), k: 2, ink: false });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const hp: V3 = [s * P.stance, P.hip - 2, 0], kn: V3 = [s * (P.stance + 0.4), P.knee, 0.6], an: V3 = [s * (P.stance + 0.4), P.ankle + 1, 0];
    legs.add({ t: 'cap', a: hp, b: [kn[0], kn[1] + 2.4, kn[2]], ra: P.leg[0] + 0.4, rb: P.leg[1] + 0.3 }, { ...ls, bone: b(`thigh${n}`), k: 1.5 });
    legs.add({ t: 'cap', a: [kn[0], kn[1] - 2, kn[2]], b: an, ra: P.leg[1] + 0.5, rb: P.leg[2] + 0.6 }, { col: 0x141216, bone: b(`shin${n}`), k: 0.8, surf: FAM.leather });
    styleShoe(legs, [an[0], P.ankle, 0], 9, 0x141216, b(`foot${n}`), { toeUp: 0.04, surf: FAM.leather });
  }
  // musket, and the strings vanishing up into the dark
  const hx = -(P.shoulderX + P.armOut * 1.6);
  coat.detail(cyl(1.1, 1.3, 46, 6), { col: PAL.woodDark, bone: b('handR'), pos: [hx - 1, P.wristY + 14, 3], surf: FAM.wood });
  coat.detail(cyl(0.7, 0.7, 20, 6), { col: PAL.iron, bone: b('handR'), pos: [hx - 1, P.wristY + 44, 3.4], surf: FAM.iron });
  for (const [bn, p] of [['head', [0, P.headY + 27, 0]], ['handL', [P.shoulderX + 4, P.wristY + 2, 2]], ['handR', [hx, P.wristY + 2, 2]]] as [string, V3][]) {
    coat.detail(cyl(0.18, 0.18, 80, 3), { col: PAL.bone, bone: b(bn), pos: [p[0], p[1] + 40, p[2]], emit: 0.25, surf: SURF.cloth });
  }
  const gait: Gait = { ...GAIT_WALK, stride: 0.5, knee: 0.05, bob: 0, sway: 0, twist: 0, squash: 0, arm: 0.5, elbow: 0.05, headBob: 0 };
  const clips: Clips = {
    // a marionette's march: pose-to-pose snaps, stiff kicks, lifted on its strings each step
    move: { frames: 40, fn: (t) => {
      const u = snap(t, 4);
      const lift = Math.abs(sin(t, 2)) ** 3;
      return mix(gaitPose(u, gait), { hips: { ty: 2.6 * lift }, head: { rz: 0.12 * sin(snap(t, 2)), ry: 0.1 * sin(snap(t, 3)) }, foreR: { rx: -1.2 }, armR: { rx: -0.2 } });
    } },
    // shoulder the musket… aim… recoil
    attack: { frames: 20, loop: false, fn: (t) => {
      const aim = ease(snap(Math.min(1, t / 0.7), 3)), kick = pulse(t, 0.9, 0.08);
      return { armR: { rx: -1.4 * aim, rz: -0.3 * aim }, foreR: { rx: -0.2 - 0.6 * aim }, armL: { rx: -1.3 * aim, rz: 0.5 * aim }, foreL: { rx: -0.9 * aim }, chest: { rx: -0.25 * kick, ry: -0.3 * aim }, head: { ry: -0.25 * aim } };
    } },
  };
  const geo = layered([{ sc: wood, o: LAYER.hard }, { sc: coat, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== carousel horse
function carouselHorse(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 40, 0] },
    { name: 'neck', parent: 'body', head: [0, 46, 14] },
    { name: 'head', parent: 'neck', head: [0, 60, 22] },
    { name: 'legFL', parent: 'body', head: [5.4, 34, 12] },
    { name: 'shinFL', parent: 'legFL', head: [5.4, 22, 16] },
    { name: 'legFR', parent: 'body', head: [-5.4, 34, 12] },
    { name: 'shinFR', parent: 'legFR', head: [-5.4, 22, 16] },
    { name: 'legBL', parent: 'body', head: [5.4, 34, -16] },
    { name: 'shinBL', parent: 'legBL', head: [5.4, 22, -20] },
    { name: 'legBR', parent: 'body', head: [-5.4, 34, -16] },
    { name: 'shinBR', parent: 'legBR', head: [-5.4, 22, -20] },
    { name: 'tail', parent: 'body', head: [0, 42, -22] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1.9, 4);
  const paint = flat(PAL.cream);
  const gilt = C(PAL.gold);
  sc.add({ t: 'ell', c: [0, 41, -4], r: [9.6, 10, 15] }, { col: paint, bone: b('body'), k: 3, surf: SURF.paint });
  sc.add({ t: 'ell', c: [0, 41, 8], r: [9, 10.6, 8.6] }, { col: paint, bone: b('body'), k: 6, surf: SURF.paint });
  sc.add({ t: 'ell', c: [0, 42, -15], r: [9.4, 9.6, 8] }, { col: paint, bone: b('body'), k: 6, surf: SURF.paint });
  sc.add({ t: 'cap', a: [0, 45, 12], b: [0, 58, 21], ra: 6.4, rb: 4.6 }, { col: paint, bone: b('neck'), k: 3, surf: SURF.paint });
  sc.add({ t: 'cap', a: [0, 63, 21], b: [0, 57, 34], ra: 5.4, rb: 3.6 }, { col: paint, bone: b('head'), k: 3, surf: SURF.paint });
  sc.add({ t: 'ell', c: [0, 56.6, 34], r: [4, 3, 3.6] }, { sub: true, k: 1.2 });
  for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * 2.6, 66, 21], b: [s * 3.4, 71, 18], ra: 1.6, rb: 0.6 }, { col: paint, bone: b('head'), k: 1, surf: SURF.paint });
  for (let i = 0; i < 6; i++) sc.add({ t: 'cap', a: [0, 50 + i * 2.6, 11 + i * 2.2], b: [0, 56 + i * 2.8, 4 + i * 2.2], ra: 3, rb: 0.8 }, { col: gilt, bone: b('neck'), k: 1.4, surf: SURF.gold });
  sc.add({ t: 'ell', c: [0, 50.5, -4], r: [10.4, 3.6, 10] }, { col: flat(PAL.velvet), bone: b('body'), k: 1.2, surf: SURF.velvet });
  sc.add({ t: 'tor', c: [0, 41, 10], R: 10.2, r: 1.2, rot: [Math.PI / 2 + 0.3, 0, 0] }, { col: gilt, bone: b('body'), k: 0.6, surf: SURF.gold });
  for (const [leg, shin, s, z0] of [['legFL', 'shinFL', 1, 12], ['legFR', 'shinFR', -1, 12], ['legBL', 'shinBL', 1, -16], ['legBR', 'shinBR', -1, -16]] as const) {
    const front = z0 > 0;
    sc.add({ t: 'cap', a: [s * 5.4, 36, z0], b: [s * 5.4, 22, z0 + (front ? 4 : -4)], ra: 3.6, rb: 2.6 }, { col: paint, bone: b(leg), k: 2.5, surf: SURF.paint });
    sc.add({ t: 'cap', a: [s * 5.4, 22, z0 + (front ? 4 : -4)], b: [s * 5.4, 9, z0 + (front ? 6 : -6)], ra: 2.4, rb: 2.1 }, { col: paint, bone: b(shin), k: 1.2, surf: SURF.paint });
    sc.add({ t: 'cap', a: [s * 5.4, 9, z0 + (front ? 6 : -6)], b: [s * 5.4, 6.5, z0 + (front ? 6.4 : -6.4)], ra: 2.8, rb: 3 }, { col: PAL.ink, bone: b(shin), k: 0.6, surf: SURF.paint });
  }
  sc.add({ t: 'cap', a: [0, 43, -22], b: [0, 32, -31], ra: 3, rb: 1.2 }, { col: gilt, bone: b('tail'), k: 1.5, surf: SURF.gold });
  // eyes like hot coals, teeth bared, the brass pole still through its back
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * 4.2, 64, 27], 1.7, PAL.hotRed, 1.4);
  for (let i = 0; i < 5; i++) sc.detail(cone(0.7, 2.4, 4), { col: PAL.bone, bone: b('head'), pos: [-2.4 + i * 1.2, 55.2, 35.4], rot: [Math.PI, 0, 0], surf: SURF.bone });
  for (let i = 0; i < 5; i++) sc.detail(sphere(1.3, 6, 4), { col: [PAL.hotRed, PAL.ghost, PAL.amber][i % 3], bone: b('body'), pos: [-6 + i * 3, 36, 17.6], emit: 0.7, surf: SURF.glass });
  sc.detail(cyl(1.6, 1.6, 120, 8), { col: C(PAL.brass), bone: b('body'), pos: [0, 60, -2], surf: SURF.brass });
  const clips: Clips = {
    // the gallop: the body rocks like it's still on its crank, legs reach in pairs
    move: { frames: 36, fn: (t) => {
      const s = sin(t), c = cos(t);
      return {
        body: { rx: 0.12 * s, ty: 3.5 * Math.abs(c) - 2 },
        neck: { rx: -0.15 * s }, head: { rx: 0.1 * s },
        legFL: { rx: -0.7 * s }, shinFL: { rx: -0.9 * Math.max(0, c) },
        legFR: { rx: -0.7 * sin(t, 1, 0.08) }, shinFR: { rx: -0.9 * Math.max(0, cos(t, 1, 0.08)) },
        legBL: { rx: 0.6 * s }, shinBL: { rx: 0.8 * Math.max(0, -c) },
        legBR: { rx: 0.6 * sin(t, 1, 0.08) }, shinBR: { rx: 0.8 * Math.max(0, -cos(t, 1, 0.08)) },
        tail: { rx: 0.3 * c, rz: 0.2 * s },
      };
    } },
    // rear up, hooves flailing
    attack: { frames: 20, loop: false, fn: (t) => {
      const r = ease(t / 0.6) * (1 - ease((t - 0.85) / 0.15)), kick = sin(t, 3);
      return { body: { rx: -0.65 * r, ty: 8 * r }, neck: { rx: 0.3 * r }, head: { rx: 0.25 * r }, legFL: { rx: -1.4 * r + 0.4 * kick * r }, shinFL: { rx: -1.1 * r }, legFR: { rx: -1.4 * r - 0.4 * kick * r }, shinFR: { rx: -1.1 * r }, legBL: { rx: 0.5 * r }, legBR: { rx: 0.5 * r }, tail: { rx: 0.6 * r } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== bumper car
function bumperCar(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 6, 0] },
    { name: 'pole', parent: 'body', head: [0, 22, -16] },
    { name: 'wheels', parent: 'body', head: [0, 4, 0] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1.9, 3);
  const shell = flat(PAL.teal);
  sc.add({ t: 'tor', c: [0, 6, 0], R: 19, r: 4.6, rot: [0, 0, 0] }, { col: PAL.charcoal, bone: b('body'), k: 0, surf: SURF.rubber });
  sc.add({ t: 'ell', c: [0, 12, 0], r: [18, 9, 21] }, { col: shell, bone: b('body'), k: 3, surf: SURF.paint });
  sc.add({ t: 'box', c: [0, 18, -8], h: [9, 6, 4], r: 2 }, { col: flat(PAL.redDeep), bone: b('body'), k: 2, surf: SURF.velvet });
  sc.add({ t: 'ell', c: [0, 19, 3], r: [11, 5, 8] }, { sub: true, k: 2.5 });
  for (const s of [1, -1]) {
    sc.add({ t: 'cap', a: [s * 9.6, 14, 17], b: [s * 9.6, 14.6, 20.4], ra: 4, rb: 3.6 }, { col: PAL.brass, bone: b('body'), k: 1.5, surf: SURF.brass });
    glowEye(sc, b('body'), [s * 9.6, 14.6, 20.6], 3, PAL.sickYellow, 1.4);
  }
  for (let i = 0; i < 7; i++) sc.detail(rbox(1.6, 7, 2.4, 0.6, 1), { col: PAL.bone, bone: b('body'), pos: [-6 + i * 2, 9.5, 21.6], surf: SURF.brass });
  sc.detail(torus(4, 0.8, 6, 14), { col: PAL.ink, bone: b('body'), pos: [0, 22, 5], rot: [-0.9, 0, 0], surf: SURF.rubber });
  sc.detail(cyl(1, 1, 40, 6), { col: PAL.iron, bone: b('pole'), pos: [0, 40, -16], surf: SURF.iron });
  sc.detail(sphere(2.2, 8, 6), { col: PAL.cold, bone: b('pole'), pos: [0, 60, -16], emit: 1.4, surf: SURF.bulb });
  for (const s of [1, -1]) sc.detail(cyl(4.2, 4.2, 0.6, 14), { col: PAL.cream, bone: b('body'), pos: [s * 18.6, 12, 0], rot: [0, 0, Math.PI / 2], surf: SURF.paint });
  const clips: Clips = {
    move: { frames: 24, fn: (t) => ({ body: { ty: 0.8 * Math.abs(sin(t, 2)), rz: 0.04 * sin(t, 3), rx: 0.03 * sin(t, 2) }, pole: { rz: 0.06 * sin(t, 2, 0.3), rx: 0.05 * cos(t, 2) } }) },
    attack: { frames: 16, loop: false, fn: (t) => ({ body: { rx: -0.18 * ease(t), rz: 0.05 * Math.sin(t * 60) * t, tz: -3 * ease(t) }, pole: { rx: 0.2 * ease(t) } }) },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== walking ticket booth
function walkingTicketBooth(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'booth', parent: null, head: [0, 52, 0] },
    { name: 'thighL', parent: 'booth', head: [12, 50, 0] },
    { name: 'shinL', parent: 'thighL', head: [15, 30, -8] },
    { name: 'footL', parent: 'shinL', head: [13, 4, 2] },
    { name: 'thighR', parent: 'booth', head: [-12, 50, 0] },
    { name: 'shinR', parent: 'thighR', head: [-15, 30, -8] },
    { name: 'footR', parent: 'shinR', head: [-13, 4, 2] },
    { name: 'tongue', parent: 'booth', head: [0, 68, 20] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(2.4, 4);
  // red planks, the grooves between them drawn per pixel (they were thinner than a mesh cell)
  const planks = { kind: 'bands', col: C(PAL.red).multiplyScalar(0.45).getHex(), a: 8.4, b: 0.11, c: 0.5 - 50 / 8.4 } as const;
  sc.add({ t: 'box', c: [0, 74, 0], h: [22, 25, 19], r: 2.5 }, { col: C(PAL.red).multiplyScalar(0.92), bone: b('booth'), k: 0, surf: SURF.wood, pat: planks });
  sc.add({ t: 'ell', c: [0, 72, 19], r: [12, 9, 6] }, { sub: true, k: 2 });
  sc.add({ t: 'box', c: [0, 103, 0], h: [27, 4, 23], r: 2, rot: [0, Math.PI / 4, 0] }, { col: flat(PAL.mustard), bone: b('booth'), k: 2.5, surf: SURF.paint });
  sc.add({ t: 'cap', a: [0, 104, 0], b: [0, 120, 0], ra: 17, rb: 2 }, { col: flat(PAL.mustard), bone: b('booth'), k: 3, surf: SURF.paint });
  for (const [th, sh, ft, s] of [['thighL', 'shinL', 'footL', 1], ['thighR', 'shinR', 'footR', -1]] as const) {
    sc.add({ t: 'cap', a: [s * 12, 50, 0], b: [s * 15, 30, -8], ra: 3.8, rb: 2.8 }, { col: flat(0x8a7050), bone: b(th), k: 2, surf: SURF.skin });
    sc.add({ t: 'cap', a: [s * 15, 30, -8], b: [s * 13, 5, 2], ra: 2.6, rb: 2 }, { col: flat(0x8a7050), bone: b(sh), k: 1.4, surf: SURF.skin });
    for (let k = 0; k < 3; k++) sc.add({ t: 'cap', a: [s * 13, 3, 2], b: [s * 13 + (k - 1) * 5, 1, 12], ra: 1.6, rb: 0.6 }, { col: PAL.bone, bone: b(ft), k: 1, surf: SURF.bone });
  }
  for (let i = 0; i < 8; i++) sc.detail(cone(1.6, 5, 4), { col: PAL.bone, bone: b('booth'), pos: [-10.5 + i * 3, 80, 19.6], rot: [Math.PI, 0, 0], surf: SURF.bone });
  sc.detail(tube([[0, 66, 19], [0, 60, 25], [0, 54, 28], [1, 48, 28]], 3, 4, 12), { col: C(PAL.cream).multiplyScalar(0.9), bone: b('tongue'), scale: [1.6, 1, 0.3], surf: SURF.paint });
  for (const s of [1, -1]) glowEye(sc, b('booth'), [s * 11, 92, 19.4], 3.6, PAL.amber, 1.3);
  for (let i = 0; i < 7; i++) sc.detail(sphere(1.4, 6, 4), { col: i % 2 ? PAL.amber : PAL.hotRed, bone: b('booth'), pos: [-15 + i * 5, 110, 14], emit: 1, surf: SURF.bulb });
  const clips: Clips = {
    // stilt-walk: huge strides, the whole booth lurching from foot to foot
    move: { frames: 40, fn: (t) => {
      const s = sin(t), c = cos(t);
      return {
        booth: { ty: -3 * (0.5 - 0.5 * cos(t, 2)), rz: 0.08 * s, rx: 0.04 * cos(t, 2) },
        thighL: { rx: -0.55 * s }, shinL: { rx: 0.9 * Math.max(0, c) }, footL: { rx: -0.3 * Math.max(0, c) },
        thighR: { rx: 0.55 * s }, shinR: { rx: 0.9 * Math.max(0, -c) }, footR: { rx: -0.3 * Math.max(0, -c) },
        tongue: { rx: 0.2 * sin(t, 2), rz: 0.15 * s },
      };
    } },
    attack: { frames: 20, loop: false, fn: (t) => {
      const k = ease(t / 0.8), lash = pulse(t, 0.92, 0.08);
      return { booth: { rx: -0.25 * k + 0.2 * lash, sy: 1 + 0.06 * k }, tongue: { rx: -0.6 * k - 0.6 * lash, sy: 1 + 0.6 * lash }, thighL: { rx: 0.2 * k }, thighR: { rx: 0.2 * k } };
    } },
  };
  return { geo: sc.build({ ...CREATURE, aoScale: 1.4 }), rig: new Rig(bones, clips) };
}

// ================================================================== carnival brute
function carnivalBrute(): SculptModel {
  // D-86, the complex benchmark of the character art standard: the sideshow strongman turned executioner,
  // rebuilt in layers. Shoulders are a trapezius yoke, not balls; arms have a biceps and a ham of a forearm
  // wrapped at the wrist; a banded strongman's singlet over a real belly; a championship belt with a gold
  // plate; a stitched burlap hood tied at the throat, eyes burning in carved holes; and a forged sledge —
  // a turned haft with a leather grip and a bevelled iron head. The same skeleton, size and clips.
  const P = scaleP(ADULT, 1.32, { chestW: 24, waistW: 19, hipW: 18, shoulderX: 25, arm: [10, 8.6, 7], leg: [9, 7.6, 6], stance: 12, headR: 14, depth: 0.78, armOut: 5 });
  const bones = humanBones(P);
  const b = bi(bones);
  const skin = new Sculpt(1.6, 6, 0.5), singlet = new Sculpt(1.8, 6, 0.5), hood = new Sculpt(1.5, 5, 0.5);
  const belt = new Sculpt(1.4, 5, 0.5), trousers = new Sculpt(2.0, 6, 0.5), boots = new Sculpt(1.6, 5, 0.5);
  const SKIN = vertical(0x6a4a38, 0x9a745a, P.wristY - 10, P.shoulderY + 6), RED = 0x6c1a16, BAND = 0x1e1a1c, SACK = vertical(0x423a2c, 0x675a44, P.headY - 14, P.headY + 18);
  const BRUTE_SKIN: Surf = [0.74, 0];
  // ---- skin: the yoke of the shoulders, the arms, the fists — each muscle its own form, small blends
  const sk = { col: SKIN, surf: BRUTE_SKIN };
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    skin.add({ t: 'cap', a: [s * 5, P.neck - 1, -2.5], b: [s * (P.shoulderX - 6), P.shoulderY + 2.5, -1.5], ra: 6.8, rb: 7.4 }, { ...sk, bone: b('chest'), k: 3 });
    skin.add({ t: 'ell', c: [s * (P.shoulderX - 0.5), P.shoulderY - 1, 0.5], r: [8.8, 8.6, 8.8], rot: [0, 0, s * 0.35] }, { ...sk, bone: b(`arm${n}`), k: 1.6 });
    const el: V3 = [s * (P.shoulderX + P.armOut), P.elbowY, -0.8], wr: V3 = [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.8];
    skin.add({ t: 'cap', a: [s * (P.shoulderX + 1), P.shoulderY - 5, 0], b: el, ra: P.arm[0] * 0.78, rb: P.arm[1] * 0.78 }, { ...sk, bone: b(`arm${n}`), k: 1.4 });
    skin.add({ t: 'ell', c: [s * (P.shoulderX + P.armOut * 0.6 + 0.4), P.elbowY + 8, 3.6], r: [6.2, 8, 5.8] }, { ...sk, bone: b(`arm${n}`), k: 1.2 });
    skin.add({ t: 'cap', a: el, b: wr, ra: P.arm[1] * 0.8, rb: P.arm[2] * 0.82 }, { ...sk, bone: b(`fore${n}`), k: 1.2 });
    skin.add({ t: 'ell', c: [s * (P.shoulderX + P.armOut * 1.2), P.elbowY - 5.5, 1.6], r: [7.4, 8.8, 7], rot: [0.12, 0, 0] }, { ...sk, bone: b(`fore${n}`), k: 1.6 });
    styleHand(skin, wr, s, P.arm[2], SKIN, b(`hand${n}`));
    // cloth wraps at the wrists
    belt.add({ t: 'cap', a: [wr[0], wr[1] + 5, wr[2]], b: [wr[0], wr[1] - 0.5, wr[2]], ra: P.arm[2] + 1.1, rb: P.arm[2] + 1 }, { col: 0xb8ab8c, bone: b(`fore${n}`), k: 0.4, surf: FAM.cloth, pat: { kind: 'bands', col: 0x8c8068, a: 2.2, b: 0.22 } });
  }
  // ---- the singlet: a barrel chest and a real belly, banded, one strap over each shoulder
  const sg = { col: RED, surf: FAM.wool, pat: { kind: 'bands', col: BAND, a: 9, b: 0.3, c: 0.15 } } as const;
  singlet.add({ t: 'box', c: [0, P.chest + 1, 0.5], h: [P.chestW - 2, 10, P.chestW * P.depth - 3], r: 8, tx: 0.12 }, { ...sg, bone: b('chest'), k: 4 });
  singlet.add({ t: 'ell', c: [0, P.waist - 2, 4], r: [17, 14, 14.5] }, { ...sg, bone: b('spine'), k: 6 });
  singlet.add({ t: 'ell', c: [0, P.hip + 3, 0], r: [P.hipW + 1, 9, (P.hipW + 1) * P.depth] }, { ...sg, bone: b('hips'), k: 4 });
  for (const s of [1, -1]) singlet.add({ t: 'cap', a: [s * 9, P.chest + 9, 9], b: [s * 13, P.shoulderY + 6.5, -2], ra: 3, rb: 2.8 }, { col: RED, bone: b('chest'), k: 1, surf: FAM.wool });
  // ---- the championship belt with its gold plate
  belt.add({ t: 'tor', c: [0, P.hip + 6.5, 1.5], R: 19.5, r: 3.2 }, { col: 0x3a2416, bone: b('hips'), k: 0.6, surf: FAM.leather });
  const pz = frontZ(belt, 0, P.hip + 6.5);
  belt.detail(cyl(6.6, 6.6, 1.8, 24), { col: 0xb8913c, bone: b('hips'), pos: [0, P.hip + 6.5, pz + 0.6], rot: [Math.PI / 2, 0, 0], surf: FAM.gold });
  belt.detail(extrude(starShape(5, 4.2, 1.9), 0.9, 0.3, 1, 1), { col: 0xd8b458, bone: b('hips'), pos: [0, P.hip + 6.5, pz + 1.4], surf: FAM.gold, ink: false });
  // ---- work trousers and heavy boots
  const TR = 0x5e5446;
  trousers.add({ t: 'ell', c: [0, P.hip - 1, 0], r: [P.hipW + 0.5, 8, (P.hipW + 0.5) * P.depth] }, { col: TR, bone: b('hips'), k: 2, surf: FAM.canvas });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const hp: V3 = [s * P.stance, P.hip - 2, 0], kn: V3 = [s * (P.stance + 0.4), P.knee, 0.6], an: V3 = [s * (P.stance + 0.4), P.ankle + 1, 0];
    trousers.add({ t: 'cap', a: hp, b: kn, ra: P.leg[0] + 1.2, rb: P.leg[1] + 1.3 }, { col: TR, bone: b(`thigh${n}`), k: 2.5, surf: FAM.canvas });
    trousers.add({ t: 'cap', a: kn, b: [an[0], an[1] + 8, an[2]], ra: P.leg[1] + 1.3, rb: P.leg[2] + 1.6 }, { col: TR, bone: b(`shin${n}`), k: 1.5, surf: FAM.canvas });
    boots.add({ t: 'cap', a: [an[0], an[1] + 10, an[2]], b: [an[0], P.ankle, an[2] + 0.5], ra: P.leg[2] + 2.2, rb: P.leg[2] + 2.4 }, { col: 0x2e2018, bone: b(`foot${n}`), k: 1, surf: FAM.leather });
    styleShoe(boots, [an[0], P.ankle, 0], 16, 0x2e2018, b(`foot${n}`), { width: 1.2, toeUp: 0.05 });
  }
  // ---- the hood: a burlap sack over the head, tied off at the crown and at the throat; eyes in carved holes
  const r = P.headR, y = P.headY;
  // coarse burlap: a woven grain (crisp up close, an even tone at play size), darker toward the neck
  const hs = { col: SACK, bone: b('head'), surf: FAM.canvas, pat: { kind: 'bands', col: 0x352e22, a: 1.0, b: 0.22 } } as const;
  hood.add({ t: 'ell', c: [0, y + 2, 0.6], r: [r * 1.06, r * 1.14, r * 1.03] }, { ...hs, k: 2 });
  hood.add({ t: 'ell', c: [0, y - r * 0.55, r * 0.28], r: [r * 0.82, r * 0.5, r * 0.78] }, { ...hs, k: 3 });
  // the crown gathered into a knot with a short tail flopping over, the sack bunched where the rope pulls
  // it in at the throat
  hood.add({ t: 'ell', c: [1, y + r * 1.04, -0.6], r: [4.6, 3.6, 4.4] }, { ...hs, k: 1.6 });
  hood.add({ t: 'cap', a: [2, y + r * 1.04 + 2, -1], b: [8.4, y + r * 1.04 + 0.6, -3.2], ra: 2.6, rb: 1.6 }, { ...hs, k: 0.9 });
  hood.add({ t: 'tor', c: [1, y + r * 1.04 - 1.4, -0.6], R: 4, r: 1.05, rot: [0.15, 0, -0.1] }, { col: 0x7c6440, bone: b('head'), k: 0.3, surf: FAM.canvas });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    hood.add({ t: 'ell', c: [Math.cos(a) * r * 0.78, P.neck + 3.6, 0.5 + Math.sin(a) * r * 0.74], r: [3.2, 3, 2.6], rot: [0, -a, 0] }, { ...hs, k: 1.2 });
  }
  for (const s of [1, -1]) hood.add({ t: 'ell', c: [s * 5.6, y + 3, r * 0.98], r: [3.4, 2.9, 3.6], rot: [0, 0, s * -0.25] }, { sub: true, k: 0.8 });
  for (const s of [1, -1]) glowEye(hood, b('head'), [s * 5.6, y + 3, r * 0.68], 2.2, PAL.ember, 1.6);
  hood.add({ t: 'tor', c: [0, P.neck + 1, 0.5], R: r * 0.82, r: 2 }, { col: 0x8c7448, bone: b('neck'), k: 0.5, surf: FAM.canvas });
  const hz = (x: number, yy: number) => frontZ(hood, x, yy);
  // a seam down the face and a stitched slit of a mouth
  const seam: V3[] = [[0, y + r * 1.0, 0], [0, y + r * 0.55, 0], [0, y + 6.5, 0]].map(([x, yy]) => [x, yy, hz(x, yy) + 0.15] as V3);
  hood.detail(tube(seam, 0.35, 4, 10), { col: 0x3a2e20, bone: b('head'), surf: FAM.canvas, ink: false });
  for (let i = 0; i < 7; i++) {
    const sx = -7.8 + i * 2.6, sy = y - 8.6 + Math.abs(sx) * 0.12;
    hood.detail(cyl(0.42, 0.42, 3.6, 4), { col: 0x1a1410, bone: b('head'), pos: [sx, sy, hz(sx, sy) + 0.1], rot: [0, 0, Math.PI / 2 + 0.25], surf: FAM.cloth, ink: false });
  }
  hood.detail(tube([[-8.6, y - 8.6, hz(-8.6, y - 8.6) + 0.05], [0, y - 9.2, hz(0, y - 9.2) + 0.05], [8.6, y - 8.6, hz(8.6, y - 8.6) + 0.05]], 0.55, 4, 10), { col: 0x241a14, bone: b('head'), surf: FAM.canvas, ink: false });
  // ---- the sledgehammer, dragged in the right fist: a turned haft, a leather grip, a bevelled forged head
  const hx = -(P.shoulderX + P.armOut * 1.6);
  // (the haft runs from the fist forward and down, the head resting low in front, as before: the slam clip lifts it overhead)
  const tilt = new THREE.Matrix4().makeRotationX(-1.0);
  const onHaft = (g: THREE.BufferGeometry, along: number) => g.applyMatrix4(new THREE.Matrix4().makeTranslation(hx, P.wristY - 5, 2.5).multiply(tilt).multiply(new THREE.Matrix4().makeTranslation(0, -along, 0)));
  belt.detail(onHaft(lathe([[0, -30], [2.0, -30], [2.25, -26], [1.85, -6], [1.75, 22], [2.05, 29], [0, 30]], 10), 30), { col: 0xa88a62, bone: b('handR'), surf: FAM.wood });
  belt.detail(onHaft(cyl(2.35, 2.35, 9, 10), 5), { col: 0x2e1c12, bone: b('handR'), surf: FAM.leather });
  belt.detail(onHaft(rbox(13, 13, 24, 2.4, 2), 47), { col: 0x45454c, bone: b('handR'), surf: FAM.iron });
  for (const e of [-1, 1]) belt.detail(onHaft(cyl(6.9, 6.9, 2.2, 16).rotateX(Math.PI / 2).translate(0, 0, e * 12.6), 47), { col: 0x6c6c74, bone: b('handR'), surf: FAM.iron });
  const gait: Gait = { ...GAIT_WALK, stride: 0.38, knee: 0.7, bob: 3.2, lean: 0.12, sway: 0.15, twist: 0.06, squash: 0.1, arm: 0.2, armOut: 0.45, elbow: 0.4, headBob: 0.04 };
  const clips: Clips = {
    move: { frames: 44, fn: (t) => mix(gaitPose(t, gait), { armR: { rx: 0.35, rz: 0.1 }, head: { rx: 0.1 } }) },
    // hammer overhead… SLAM, with the full weight of him behind it
    attack: { frames: 22, loop: false, fn: (t) => {
      const up = ease(t / 0.78), slam = ease((t - 0.8) / 0.12);
      return { armR: { rx: -2.9 * up + 2.6 * slam }, armL: { rx: -2.7 * up + 2.4 * slam }, foreR: { rx: -0.4 * up }, foreL: { rx: -0.4 * up }, chest: { rx: -0.35 * up + 0.6 * slam }, hips: { ty: -6 * slam, sy: 1 - 0.08 * slam }, head: { rx: -0.2 * up + 0.2 * slam } };
    } },
  };
  const geo = layered([{ sc: skin, o: LAYER.skin }, { sc: singlet, o: LAYER.cloth }, { sc: hood, o: { ...LAYER.cloth, ao: 0.4 } }, { sc: belt, o: LAYER.hard }, { sc: trousers, o: LAYER.cloth }, { sc: boots, o: LAYER.hard }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== jack-in-the-box
function jackBox(open: boolean): SculptModel {
  const bones: BoneDef[] = open
    ? [
        { name: 'box', parent: null, head: [0, 0, 0] },
        { name: 'crank', parent: 'box', head: [19, 14, 0] },
        { name: 'lid', parent: 'box', head: [0, 24, -13] },
        { name: 'sp0', parent: 'box', head: [0, 24, 0] },
        { name: 'sp1', parent: 'sp0', head: [0, 36, 0] },
        { name: 'head', parent: 'sp1', head: [0, 52, 0] },
      ]
    : [
        { name: 'box', parent: null, head: [0, 0, 0] },
        { name: 'crank', parent: 'box', head: [19, 14, 0] },
        { name: 'lid', parent: 'box', head: [0, 24, -13] },
      ];
  const b = bi(bones);
  const sc = new Sculpt(1.7, 2.5);
  const panel: ColorFn = (p, n) => flat([PAL.teal, PAL.red, PAL.mustard][Math.abs(n.x) > 0.6 ? 0 : Math.abs(n.z) > 0.6 ? 1 : 2])(p, n);
  sc.add({ t: 'box', c: [0, 12, 0], h: [13, 12, 13], r: 1.6 }, { col: panel, bone: b('box'), k: 0, surf: SURF.paint });
  for (const s of [-1, 1]) sc.detail(extrude(starShape(5, 6, 2.6), 0.6, 0, 1), { col: PAL.cream, bone: b('box'), pos: [s * 13.2, 12, 0], rot: [0, s * Math.PI / 2, 0], surf: SURF.paint });
  sc.detail(extrude(starShape(5, 6, 2.6), 0.6, 0, 1), { col: PAL.cream, bone: b('box'), pos: [0, 12, 13.2], surf: SURF.paint });
  sc.detail(cyl(1, 1, 6, 6), { col: PAL.brass, bone: b('crank'), pos: [16, 14, 0], rot: [0, 0, Math.PI / 2], surf: SURF.brass });
  sc.detail(rbox(1.6, 9, 1.6, 0.4, 1), { col: PAL.brass, bone: b('crank'), pos: [19, 11, 0], surf: SURF.brass });
  sc.detail(sphere(1.8, 6, 4), { col: PAL.redDeep, bone: b('crank'), pos: [19, 7, 2], surf: SURF.paint });
  if (!open) {
    sc.add({ t: 'box', c: [0, 25.2, 0], h: [13.6, 1.4, 13.6], r: 0.8 }, { col: flat(PAL.redDeep), bone: b('lid'), k: 0.6, surf: SURF.paint });
  } else {
    sc.add({ t: 'box', c: [0, 38, -13.6], h: [13.6, 13.6, 1.4], r: 0.8 }, { col: flat(PAL.redDeep), bone: b('lid'), k: 0, surf: SURF.paint });
    for (const [n, y0] of [['sp0', 24], ['sp1', 36]] as const) {
      sc.detail(tube(Array.from({ length: 14 }, (_, i) => [Math.cos(i * 1.4) * 5, y0 + i * 0.92, Math.sin(i * 1.4) * 5] as V3), 0.9, 4, 60), { col: PAL.iron, bone: b(n), surf: SURF.iron });
    }
    const face = flat(PAL.clown);
    sc.add({ t: 'tor', c: [0, 50, 0], R: 9.6, r: 3 }, { col: PAL.mustard, bone: b('head'), k: 1, surf: SURF.cloth });
    sc.add({ t: 'ell', c: [0, 61, 0], r: [9.6, 11.6, 9.6] }, { col: face, bone: b('head'), k: 2, surf: SURF.porcelain });
    sc.add({ t: 'ell', c: [0, 54, 4.8], r: [7.6, 4, 5.6] }, { col: face, bone: b('head'), k: 3, surf: SURF.porcelain });
    sc.add({ t: 'box', c: [0, 54, 9.4], h: [5, 1.4, 2], r: 0.8 }, { sub: true, k: 1 });
    for (const s of [1, -1]) {
      sc.add({ t: 'cap', a: [s * 4, 69, 0], b: [s * 12, 82, 0], ra: 4.6, rb: 1.2 }, { col: s > 0 ? PAL.red : PAL.teal, bone: b('head'), k: 1.5, surf: SURF.cloth });
      sc.detail(sphere(2, 6, 4), { col: PAL.gold, bone: b('head'), pos: [s * 12.6, 83, 0], surf: SURF.brass });
      sc.detail(sphere(1.6, 8, 6), { col: PAL.bone, bone: b('head'), pos: [s * 3.8, 63, 8.4], surf: SURF.porcelain });
      glowEye(sc, b('head'), [s * 3.8, 63, 9.4], 1.1, PAL.ember, 1.5);
    }
    sc.detail(sphere(2.4, 8, 6), { col: PAL.blood, bone: b('head'), pos: [0, 59, 9.8], surf: SURF.latex });
  }
  const clips: Clips = open
    ? {
        // BOING: the spring rings out, the head bobbles on top
        move: { frames: 32, fn: (t) => ({ sp0: { sy: 1 + 0.18 * sin(t, 2), rz: 0.12 * sin(t) }, sp1: { sy: 1 + 0.18 * sin(t, 2, 0.15), rz: 0.15 * sin(t, 1, 0.2) }, head: { rz: 0.25 * sin(t, 1, 0.3), rx: 0.15 * cos(t, 2) }, crank: { rx: t * TAU }, lid: { rx: 0.1 * sin(t, 2) } }) },
        attack: { frames: 16, loop: false, fn: (t) => ({ sp0: { sy: 1 - 0.3 * ease(t) }, sp1: { sy: 1 - 0.3 * ease(t) }, head: { rx: 0.3 * ease(t) } }) },
      }
    : {
        // it hops and rattles; something inside wants out
        move: { frames: 32, fn: (t) => ({ box: { ty: 3 * Math.abs(sin(t, 2)), sy: 1 - 0.1 * (1 - Math.abs(sin(t, 2))) ** 4, rz: 0.06 * sin(t) }, lid: { rx: -0.15 * Math.max(0, sin(t, 4)) }, crank: { rx: t * TAU * 2 } }) },
        attack: { frames: 16, loop: false, fn: (t) => ({ box: { rz: 0.12 * Math.sin(t * 50) * t, sx: 1 + 0.08 * t, sy: 1 + 0.12 * t }, lid: { rx: -0.5 * t * Math.abs(Math.sin(t * 30)) }, crank: { rx: t * TAU * 6 } }) },
      };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

const cache = new Map<string, SculptModel>();
const BUILDERS: Record<string, () => SculptModel> = {
  living_balloon: () => balloon(17),
  swarm_balloon: () => balloon(11),
  wind_up_monkey: windUpMonkey,
  possessed_stuffie: () => stuffie(1),
  mini_stuffie: () => stuffie(0.62),
  cotton_candy_slime: cottonCandySlime,
  whack_a_mole: whackAMole,
  evil_clown: evilClown,
  dunk_tank_clown: dunkTankClown,
  puppet_soldier: puppetSoldier,
  carousel_horse: carouselHorse,
  bumper_car: bumperCar,
  walking_ticket_booth: walkingTicketBooth,
  carnival_brute: carnivalBrute,
  jack_in_the_box: () => jackBox(false),
  jack_open: () => jackBox(true),
  ...FUNHOUSE_BUILDERS,
  ...BOARDWALK_BUILDERS,
  ...GHOST_TRAIN_BUILDERS,
  ...PET_BUILDERS,
};

export function creatureModel(id: string): SculptModel {
  let m = cache.get(id);
  if (!m) {
    m = BUILDERS[id]();
    cache.set(id, m);
  }
  return m;
}

export const CREATURE_IDS = Object.keys(BUILDERS);

/** A creature sculpted elsewhere (a worker); ignored if this page already built its own. */
export function installCreatureModel(id: string, m: SculptModel): void {
  if (!cache.has(id)) cache.set(id, m);
}

export function hasCreatureModel(id: string): boolean {
  return cache.has(id);
}

export const _unused = { rbox, Pose: null as unknown as Pose, ADULT };
