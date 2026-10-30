// Sculpted enemies (D-40): every attraction-turned-monster is an SDF sculpt on its own skeleton with
// a characteristic locomotion clip and a wind-up/attack clip that the sim's telegraph drives —
// the toy monkey's waddle and cymbal crash, the plush bear's dragging limp, the clown's bouncing
// skip, the marionette soldier's jerky march, the carousel horse's gallop and rear, the booth's
// stilt-walk, the brute's hammer drag. Glowing eyes and mouths keep them readable in the dark.

import * as THREE from 'three';
import { C, SURF, cone, cyl, ellipsoid, extrude, lathe, rbox, sphere, starShape, torus, tube, vnoise, weather, stripes, type ColorFn, type V3 } from '../core/geo';
import { PAL } from './kit';
import { Sculpt } from '../sculpt/sdf';
import { Rig, type BoneDef, type ClipDef, type Pose, ease, mix, pulse, sin, cos, snap, TAU } from '../sculpt/rig';
import { ADULT, GAIT_WALK, type Gait, type Proportions, eyeDetails, gaitPose, head, humanBody, humanBones, scaleP } from '../sculpt/humanoid';
import type { SculptModel } from './characters';

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
  // old latex (D-50): sun-faded and grimy, darker and puckered toward the knot
  const latex: ColorFn = (p) => {
    const lit = 0.6 + 0.2 * Math.max(0, p.x / r * 0.5 + p.y / (r * 2) * 0.5);
    const grime = 0.74 + 0.34 * vnoise(p.x * 0.16 + 3, p.y * 0.16, p.z * 0.16);
    const knot = 0.55 + 0.45 * Math.min(1, Math.max(0, p.y / (r * 0.9)));
    return C(0xffffff).multiplyScalar(lit * grime * knot);
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
  return { geo: sc.build({ ao: 0.35, aoScale: r / 17 }), rig: new Rig(bones, clips) };
}

// ================================================================== wind-up monkey
function windUpMonkey(): SculptModel {
  const P: Proportions = { ...scaleP(ADULT, 0.5), hip: 13, knee: 7, ankle: 2, waist: 19, chest: 25, shoulderY: 29, shoulderX: 10, elbowY: 21, wristY: 14, neck: 32, headY: 41, headR: 10, stance: 4.6, leg: [3.4, 3, 2.6], arm: [2.6, 2.3, 2], hipW: 8, waistW: 9.5, chestW: 10.5, depth: 0.9, armOut: 2 };
  const bones = humanBones(P, [{ name: 'key', parent: 'spine', head: [0, 21, -10] }]);
  const b = bi(bones);
  const sc = new Sculpt(1.6, 2.6);
  const fur = weather(0x5a4030, 0.35, 0.18);
  const tin = weather(PAL.red, 0.45, 0.1, PAL.iron);
  humanBody(sc, P, b, { skin: fur, torso: tin, hips: tin, upperArm: fur, foreArm: fur, hand: weather(0xc9a07e, 0.3), thigh: fur, shin: fur, shoe: PAL.ink, torsoSurf: SURF.paint });
  sc.add({ t: 'tor', c: [0, 22, 0], R: 9.6, r: 1.2 }, { col: PAL.brass, bone: b('spine'), k: 0.4, surf: SURF.brass });
  head(sc, P, b('head'), { skin: fur, nose: 0.6, ears: false, brow: 1.4, cheeks: 0.8 });
  sc.add({ t: 'ell', c: [0, 38, 7], r: [6.6, 5, 4.8] }, { col: weather(0xc9a07e, 0.3), bone: b('head'), k: 2, surf: SURF.skin });
  for (const s of [1, -1]) sc.add({ t: 'ell', c: [s * 10, 42, 0], r: [3.6, 4.6, 2.2] }, { col: weather(0xc9a07e, 0.3), bone: b('head'), k: 1.2, surf: SURF.skin });
  sc.add({ t: 'box', c: [0, 35.6, 10.2], h: [4.6, 1, 1.4], r: 0.6 }, { sub: true, k: 1 });
  sc.detail(rbox(8, 1.6, 1.2, 0.5, 1), { col: PAL.bone, bone: b('head'), pos: [0, 35.4, 10.4], surf: SURF.porcelain });
  eyeDetails(sc, P, b('head'), { size: 0.24, y: 0.15, iris: PAL.hotRed, glow: 1, sclera: PAL.bone });
  sc.detail(cyl(4.2, 5.2, 6, 14), { col: PAL.blood, bone: b('head'), pos: [0, 51, -0.6], rot: [-0.2, 0, 0.15], surf: SURF.velvet });
  sc.detail(tube([[0, 54, -1], [3, 53, -3], [4.6, 48, -3.4]], 0.5, 4, 8), { col: PAL.gold, bone: b('head'), surf: SURF.gold });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.detail(lathe([[0, 0.8], [6.2, 0], [6.6, -0.4], [0, -0.6]], 16), { col: PAL.brass, bone: b(`hand${n}`), pos: [s * 12.5, 10.5, 3], rot: [0, 0, s * Math.PI / 2], surf: SURF.brass });
  sc.detail(cyl(1, 1, 7, 6), { col: PAL.brass, bone: b('key'), pos: [0, 21, -12], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  for (const s of [-1, 1]) sc.detail(torus(3, 1, 6, 10), { col: PAL.brass, bone: b('key'), pos: [s * 3.6, 21, -15], rot: [0, Math.PI / 2, 0], surf: SURF.brass });
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
  return { geo: sc.build({ ao: 0.6 }), rig: new Rig(bones, clips) };
}

// ================================================================== possessed stuffie
function stuffie(k = 1): SculptModel {
  const P: Proportions = { ...scaleP(ADULT, 0.5 * k), hip: 10 * k, knee: 6 * k, ankle: 2 * k, waist: 16 * k, chest: 23 * k, shoulderY: 26 * k, shoulderX: 11 * k, elbowY: 19 * k, wristY: 13 * k, neck: 29 * k, headY: 39 * k, headR: 11 * k, stance: 6 * k, leg: [4.6 * k, 4.4 * k, 4.4 * k], arm: [4 * k, 3.8 * k, 3.8 * k], hipW: 11 * k, waistW: 13 * k, chestW: 12 * k, depth: 0.85, armOut: 2 * k };
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(k < 0.8 ? 1.5 : 1.6, 3 * k);
  const plush = weather(0x7a6250, 0.45, 0.22, 0x9a8a70);
  humanBody(sc, P, b, { skin: plush, torso: plush, upperArm: plush, foreArm: plush, hand: plush, thigh: plush, shin: plush, shoe: plush, torsoSurf: SURF.plush, legSurf: SURF.plush, noHands: true });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'sph', c: [s * (P.shoulderX + P.armOut * 1.6), P.wristY - 2 * k, 1], r: 4.4 * k }, { col: plush, bone: b(`hand${n}`), k: 2 * k, surf: SURF.plush });
  sc.add({ t: 'ell', c: [0, 17 * k, 8 * k], r: [7.5 * k, 8.5 * k, 3 * k] }, { col: weather(0xa89478, 0.3), bone: b('spine'), k: 1 * k, surf: SURF.plush });
  // stuffing bursting from a torn seam
  for (let i = 0; i < 5; i++) sc.add({ t: 'sph', c: [(-9 + i * 1.7) * k, (20 + (i % 2) * 2.5) * k, (8 - i * 0.6) * k], r: (2 + (i % 3) * 0.8) * k }, { col: PAL.cream, bone: b('spine'), k: 1 * k, surf: SURF.plush });
  head(sc, P, b('head'), { skin: plush, nose: 0.01, ears: false, brow: 0, cheeks: 0.8, chin: 0 });
  for (const s of [1, -1]) {
    sc.add({ t: 'sph', c: [s * 8.6 * k, 48 * k, -1 * k], r: 4.4 * k }, { col: plush, bone: b('head'), k: 1.6 * k, surf: SURF.plush });
    sc.add({ t: 'sph', c: [s * 8.6 * k, 48 * k, 1.8 * k], r: 2.4 * k }, { sub: true, k: 1 * k });
  }
  sc.add({ t: 'ell', c: [0, 36 * k, 8.6 * k], r: [5.4 * k, 4.2 * k, 4 * k] }, { col: weather(0xa89478, 0.3), bone: b('head'), k: 1.5 * k, surf: SURF.plush });
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
  return { geo: sc.build({ ao: 0.6, aoScale: k }), rig: new Rig(bones, clips) };
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
  const pink = weather(0xb5788f, 0.32, 0.2, 0xd5a0b3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rr = 9 + vnoise(i, 1, 2) * 4;
    sc.add({ t: 'ell', c: [Math.cos(a) * 9, 7 + vnoise(i, 3, 1) * 3, Math.sin(a) * 9], r: [rr, rr * 0.75, rr] }, { col: pink, bone: b('base'), k: 6, surf: SURF.plush });
  }
  sc.add({ t: 'ell', c: [0, 19, 0], r: [14.5, 13, 14] }, { col: weather(0xc08aa0, 0.3, 0.14, 0xe0b5c5), bone: b('mid'), k: 7, surf: SURF.plush });
  sc.add({ t: 'ell', c: [1.6, 31, -1.6], r: [10, 10, 9.6] }, { col: weather(0xc08aa0, 0.3, 0.2), bone: b('top'), k: 6, surf: SURF.plush });
  for (const s of [1, -1]) sc.add({ t: 'ell', c: [s * 5, 23, 12.8], r: [3, 3.8, 3] }, { sub: true, k: 1.4 });
  sc.add({ t: 'ell', c: [0, 15, 13.4], r: [5, 3, 3] }, { sub: true, k: 1.6 });
  for (const s of [1, -1]) glowEye(sc, b('mid'), [s * 5, 23.4, 10.8], 1.1, PAL.sickYellow, 1.6);
  sc.detail(tube([[2, 13.4, 12.8], [2.6, 8, 14.6], [2.2, 3, 15.2]], (t) => 1.2 - t * 0.6, 5, 8), { col: weather(0xd8a5b8, 0.2)(new THREE.Vector3(), new THREE.Vector3()) as THREE.Color, bone: b('mid'), surf: SURF.latex });
  sc.detail(cone(5, 26, 12), { col: PAL.cream, bone: b('top'), pos: [-4, 40, -6], rot: [0.3, 0, 0.35], surf: SURF.canvas });
  const clips: Clips = {
    // squash-crawl: the base smears forward, the top sloshes behind
    move: { frames: 36, fn: (t) => ({ base: { sx: 1 + 0.08 * sin(t), sz: 1 + 0.14 * sin(t), sy: 1 - 0.1 * sin(t) }, mid: { tz: 2 * sin(t, 1, -0.15), sy: 1 + 0.08 * sin(t, 1, -0.2) }, top: { tz: 2.5 * sin(t, 1, -0.3), rx: 0.15 * sin(t, 1, -0.3), rz: 0.1 * cos(t) } }) },
    attack: { frames: 18, loop: false, fn: (t) => {
      const swell = ease(t / 0.8), spit = ease((t - 0.82) / 0.1);
      return { mid: { sx: 1 + 0.2 * swell - 0.15 * spit, sy: 1 + 0.25 * swell - 0.2 * spit, sz: 1 + 0.2 * swell }, top: { rx: -0.3 * swell + 0.5 * spit }, base: { sy: 1 - 0.1 * swell } };
    } },
  };
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
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
  const fur = weather(0x4a3a30, 0.4, 0.22);
  sc.add({ t: 'cap', a: [0, 0, 0], b: [0, 18, 0.6], ra: 11.5, rb: 9.5 }, { col: fur, bone: b('body'), k: 2, surf: SURF.plush });
  sc.add({ t: 'ell', c: [0, 25, 1.4], r: [9, 8.5, 8.6] }, { col: fur, bone: b('head'), k: 4, surf: SURF.plush });
  sc.add({ t: 'cap', a: [0, 23, 5], b: [0, 21.6, 12.2], ra: 4.6, rb: 2.6 }, { col: weather(0xb08a7a, 0.3), bone: b('head'), k: 2.4, surf: SURF.skin });
  sc.add({ t: 'sph', c: [0, 22.2, 13.4], r: 2.4 }, { col: 0x9a5060, bone: b('head'), k: 0.8, surf: SURF.skin });
  sc.detail(rbox(4.2, 4.6, 1.4, 0.4, 1), { col: PAL.bone, bone: b('head'), pos: [0, 18.4, 11.4], surf: SURF.porcelain });
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * 3.8, 27, 8.6], 1.5, PAL.hotRed, 1.3);
  sc.detail(lathe([[0, 9], [8, 8.4], [10.4, 3], [12.4, 0.6], [12.4, 0], [0, 0]], 16), { col: weather(PAL.mustard, 0.5, 0.15, PAL.iron)(new THREE.Vector3(), new THREE.Vector3()) as THREE.Color, bone: b('head'), pos: [0, 29, 0], rot: [-0.15, 0, 0.2], surf: SURF.paint });
  for (const [s, n] of [[1, 'clawL'], [-1, 'clawR']] as const) {
    sc.add({ t: 'ell', c: [s * 9.4, 13.6, 8], r: [4.2, 2.6, 5] }, { col: weather(0xb08a7a, 0.3), bone: b(n), k: 1.5, surf: SURF.skin });
    for (let i = 0; i < 3; i++) sc.detail(cone(0.8, 3.6, 5), { col: PAL.bone, bone: b(n), pos: [s * (7.8 + i * 1.4), 13, 12.4], rot: [Math.PI / 2, 0, 0], surf: SURF.bone });
  }
  const clips: Clips = {
    move: { frames: 48, fn: (t) => ({ body: { sy: 1 + 0.03 * sin(t, 2) }, head: { ry: 0.5 * sin(t) * Math.abs(sin(t)), rx: 0.1 * sin(t, 4) * pulse(t, 0.5, 0.2) }, clawL: { rx: -0.2 * sin(t, 2) }, clawR: { rx: -0.2 * sin(t, 2, 0.5) } }) },
    attack: { frames: 16, loop: false, fn: (t) => {
      const up = ease(t / 0.75), slam = ease((t - 0.8) / 0.12);
      return { body: { rx: -0.3 * up + 0.5 * slam }, clawL: { rx: -1.8 * up + 2 * slam }, clawR: { rx: -1.8 * up + 2 * slam }, head: { rx: -0.25 * up + 0.2 * slam } };
    } },
  };
  return { geo: sc.build({ ao: 0.55 }), rig: new Rig(bones, clips) };
}

// ================================================================== evil clown
function evilClown(): SculptModel {
  const P = scaleP(ADULT, 1.0, { headR: 12.6, headY: 74.5, chestW: 14, waistW: 15.5, hipW: 14.5, arm: [4.8, 4.2, 3.2], leg: [6, 5.4, 4.6], stance: 7.6 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.9, 4.5);
  const suit = stripes(10, 0x5e6e3a, PAL.cream, 0.05, 0.4);
  const face = weather(PAL.clown, 0.22, 0.12);
  humanBody(sc, P, b, { skin: face, torso: suit, upperArm: suit, foreArm: suit, hand: PAL.bone, gloves: true, thigh: suit, shin: suit, shoe: PAL.redDeep, bigShoes: 1.75 });
  // baggy pierrot cuffs, a pleated ruff
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'tor', c: [s * (P.stance + 0.4), P.ankle + 5, 0.4], R: P.leg[2] + 1.6, r: 1.6 }, { col: PAL.cream, bone: b(`shin${n}`), k: 1 });
  sc.add({ t: 'tor', c: [0, P.neck - 1.2, 0.3], R: 10, r: 3.2 }, { col: weather(PAL.cream, 0.3), bone: b('chest'), k: 1.2, surf: SURF.cloth });
  head(sc, P, b('head'), { skin: face, nose: 0.01, brow: 0.9, cheeks: 1.2, chin: 0.9, jaw: 1.05 });
  sc.detail(sphere(3.3, 12, 10), { col: PAL.blood, bone: b('head'), pos: [0, P.headY - 0.6, 12.6], surf: SURF.latex });
  // diamond greasepaint around amber eyes, a red slash of a grin full of teeth
  for (const s of [1, -1]) sc.detail(extrude([[0, 5], [2.4, 0], [0, -5], [-2.4, 0]], 0.5, 0, 1), { col: PAL.ink, bone: b('head'), pos: [s * 4.6, P.headY + 1.4, 11.4], rot: [0, s * 0.35, 0] });
  eyeDetails(sc, P, b('head'), { size: 0.12, spread: 0.37, y: 0.12, iris: PAL.amber, glow: 1.2, sclera: -1 });
  sc.detail(tube([[-8, P.headY - 6.5, 9.6], [-4, P.headY - 9.6, 11.6], [0, P.headY - 10.2, 12.2], [4, P.headY - 9.6, 11.6], [8, P.headY - 6.5, 9.6]], 1.5, 5, 16), { col: PAL.blood, bone: b('head'), surf: SURF.latex });
  for (let i = 0; i < 6; i++) sc.detail(cone(0.7, 2.2, 4), { col: PAL.bone, bone: b('head'), pos: [-4.5 + i * 1.8, P.headY - 9, 12.2], rot: [Math.PI, 0, 0], surf: SURF.bone });
  for (const s of [1, -1]) sc.add({ t: 'ell', c: [s * 11, P.headY + 1.4, -2], r: [5, 4, 5] }, { col: weather(0xa04a2a, 0.3, 0.3), bone: b('head'), k: 1.5, surf: SURF.plush });
  sc.detail(cone(6.6, 18, 14), { col: C(PAL.mustard).multiplyScalar(0.9), bone: b('head'), pos: [1.5, P.headY + 18, -2], rot: [-0.2, 0, 0.3], surf: SURF.cloth });
  sc.detail(sphere(2.2, 8, 6), { col: PAL.cream, bone: b('head'), pos: [-3.3, P.headY + 26, -4], surf: SURF.plush });
  for (let i = 0; i < 3; i++) sc.detail(sphere(2.4, 8, 6), { col: i === 1 ? PAL.mustard : PAL.blood, bone: b(i < 2 ? 'spine' : 'chest'), pos: [0, P.waist - 6 + i * 7, P.waistW * P.depth + 2.4], surf: SURF.plush });
  // a cream pie, held high
  const hx = -(P.shoulderX + P.armOut * 1.6);
  sc.detail(cyl(6.4, 5.2, 2.6, 14), { col: PAL.woodPale, bone: b('handR'), pos: [hx, P.wristY - 6, 6], surf: SURF.wood });
  sc.detail(ellipsoid(6.2, 2.6, 6.2, 12, 6), { col: PAL.cream, bone: b('handR'), pos: [hx, P.wristY - 4, 6], surf: SURF.porcelain });
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
  return { geo: sc.build({ ao: 0.6 }), rig: new Rig(bones, clips) };
}

// ================================================================== dunk-tank clown
function dunkTankClown(): SculptModel {
  const P = scaleP(ADULT, 0.9, { headR: 11.5, chestW: 12.5, waistW: 12.5, hipW: 12 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.9, 4);
  const suit = stripes(12, PAL.navy, PAL.cream, 0, 0.35);
  const skin = weather(0xb8c2c0, 0.25, 0.12);
  humanBody(sc, P, b, { skin, torso: suit, hips: suit, upperArm: skin, foreArm: skin, hand: PAL.bone, gloves: true, thigh: skin, shin: skin, shoe: PAL.teal, bigShoes: 1.35, torsoSurf: SURF.latex });
  head(sc, P, b('head'), { skin, nose: 0.01, brow: 0.6, cheeks: 0.9, chin: 0.8 });
  sc.detail(sphere(2.6, 10, 8), { col: PAL.blood, bone: b('head'), pos: [0, P.headY - 0.6, 11.4], surf: SURF.latex });
  eyeDetails(sc, P, b('head'), { size: 0.17, y: 0.05, iris: PAL.cold, glow: 1, lids: PAL.navy, tilt: 0.25 });
  sc.detail(ellipsoid(4.4, 1.6, 2, 10, 6), { col: 0x3a4c6a, bone: b('head'), pos: [0, P.headY - 6.4, 10], surf: SURF.latex });
  // waterlogged hair strands hanging over the face
  for (let i = 0; i < 7; i++) {
    const a = -1.4 + i * 0.47;
    sc.add({ t: 'cap', a: [Math.sin(a) * 9, P.headY + 7, Math.cos(a) * 7 - 2], b: [Math.sin(a) * 12, P.headY - 6, Math.cos(a) * 9 - 3], ra: 1.6, rb: 1.1 }, { col: weather(0x3a5048, 0.3), bone: b('head'), k: 1, surf: SURF.latex });
  }
  // the dripping bucket in the left hand
  const hx = P.shoulderX + P.armOut * 1.6;
  sc.detail(lathe([[0, 0], [5, 0], [6.4, 9], [0, 9]], 14), { col: C(PAL.iron), bone: b('handL'), pos: [hx + 1, P.wristY - 16, 4], surf: SURF.iron });
  sc.detail(cyl(5.8, 5.8, 0.6, 14), { col: 0x203a48, bone: b('handL'), pos: [hx + 1, P.wristY - 7.4, 4], emit: 0.2, surf: SURF.glass });
  sc.detail(torus(6.2, 0.4, 4, 14, Math.PI), { col: PAL.iron, bone: b('handL'), pos: [hx + 1, P.wristY - 6.6, 4], surf: SURF.iron });
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
  return { geo: sc.build({ ao: 0.6 }), rig: new Rig(bones, clips) };
}

// ================================================================== puppet soldier
function puppetSoldier(): SculptModel {
  const P = scaleP(ADULT, 0.95, { headR: 10, chestW: 11, waistW: 10, hipW: 10, arm: [3.4, 3.1, 2.8], leg: [3.8, 3.4, 3.2], stance: 6 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.8, 1.5); // tight joint band: wooden segments stay rigid
  const coat = weather(PAL.red, 0.42, 0.1, PAL.woodPale);
  const wood = weather(PAL.woodPale, 0.32, 0.1);
  humanBody(sc, P, b, { skin: wood, torso: coat, hips: weather(PAL.navy, 0.35), upperArm: coat, foreArm: coat, hand: wood, thigh: weather(PAL.navy, 0.35), shin: PAL.ink, shoe: PAL.ink, torsoSurf: SURF.paint, legSurf: SURF.paint });
  // wooden ball joints at every hinge
  for (const n of ['L', 'R']) {
    const s = n === 'L' ? 1 : -1;
    for (const [bn, p] of [[`arm${n}`, [s * P.shoulderX, P.shoulderY, 0]], [`fore${n}`, [s * (P.shoulderX + P.armOut), P.elbowY, -0.8]], [`shin${n}`, [s * (P.stance + 0.4), P.knee, 0.6]]] as [string, V3][]) {
      sc.add({ t: 'sph', c: p, r: (bn.startsWith('shin') ? P.leg[1] : P.arm[1]) + 0.9 }, { col: wood, bone: b(bn), k: 0.5, surf: SURF.wood });
    }
  }
  // white cross-belts and a brass-buttoned front
  sc.add({ t: 'box', c: [0, P.chest - 2, P.chestW * P.depth + 0.3], h: [1.4, 13, 0.6], r: 0.4, rot: [0, 0, 0.5] }, { col: PAL.bone, bone: b('chest'), k: 0.3 });
  sc.add({ t: 'box', c: [0, P.chest - 2, P.chestW * P.depth + 0.5], h: [1.4, 13, 0.6], r: 0.4, rot: [0, 0, -0.5] }, { col: PAL.bone, bone: b('chest'), k: 0.3 });
  head(sc, P, b('head'), { skin: wood, nose: 1.1, ears: false, brow: 0.5, cheeks: 0.7, chin: 0.6 });
  for (const s of [-1, 1]) sc.detail(cyl(2, 2, 0.4, 10), { col: 0xa04a40, bone: b('head'), pos: [s * 5.6, P.headY - 2.4, 7.8], rot: [Math.PI / 2, 0, s * 0.6], surf: SURF.paint });
  eyeDetails(sc, P, b('head'), { size: 0.12, sclera: -1, iris: PAL.ink, y: 0.18 });
  sc.detail(ellipsoid(3, 0.8, 1, 8, 4), { col: PAL.ink, bone: b('head'), pos: [0, P.headY - 5.4, 8.8], surf: SURF.paint });
  sc.detail(lathe([[0, 0], [9.6, 0], [10.4, 10], [9.4, 20], [0, 21]], 16, 10), { col: C(PAL.ink).multiplyScalar(1.2), bone: b('head'), pos: [0, P.headY + 6, -0.5], surf: SURF.velvet });
  sc.detail(rbox(4, 6, 2, 0.6, 1), { col: PAL.brass, bone: b('head'), pos: [0, P.headY + 11, 9.6], surf: SURF.brass });
  for (let i = 0; i < 4; i++) sc.detail(sphere(0.9, 6, 4), { col: PAL.brass, bone: b(i < 2 ? 'spine' : 'chest'), pos: [0, P.waist - 4 + i * 5.2, P.chestW * P.depth + 0.9], surf: SURF.brass });
  // musket, and the strings vanishing up into the dark
  const hx = -(P.shoulderX + P.armOut * 1.6);
  sc.detail(cyl(1.1, 1.3, 46, 6), { col: PAL.woodDark, bone: b('handR'), pos: [hx - 1, P.wristY + 14, 3], surf: SURF.wood });
  sc.detail(cyl(0.7, 0.7, 20, 6), { col: PAL.iron, bone: b('handR'), pos: [hx - 1, P.wristY + 44, 3.4], surf: SURF.iron });
  for (const [bn, p] of [['head', [0, P.headY + 27, 0]], ['handL', [P.shoulderX + 4, P.wristY + 2, 2]], ['handR', [hx, P.wristY + 2, 2]]] as [string, V3][]) {
    sc.detail(cyl(0.18, 0.18, 80, 3), { col: PAL.bone, bone: b(bn), pos: [p[0], p[1] + 40, p[2]], emit: 0.25, surf: SURF.cloth });
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
  return { geo: sc.build({ ao: 0.6 }), rig: new Rig(bones, clips) };
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
  const paint = weather(PAL.cream, 0.48, 0.09, PAL.woodPale);
  const gilt = C(PAL.gold);
  sc.add({ t: 'ell', c: [0, 41, -4], r: [9.6, 10, 15] }, { col: paint, bone: b('body'), k: 3, surf: SURF.paint });
  sc.add({ t: 'ell', c: [0, 41, 8], r: [9, 10.6, 8.6] }, { col: paint, bone: b('body'), k: 6, surf: SURF.paint });
  sc.add({ t: 'ell', c: [0, 42, -15], r: [9.4, 9.6, 8] }, { col: paint, bone: b('body'), k: 6, surf: SURF.paint });
  sc.add({ t: 'cap', a: [0, 45, 12], b: [0, 58, 21], ra: 6.4, rb: 4.6 }, { col: paint, bone: b('neck'), k: 3, surf: SURF.paint });
  sc.add({ t: 'cap', a: [0, 63, 21], b: [0, 57, 34], ra: 5.4, rb: 3.6 }, { col: paint, bone: b('head'), k: 3, surf: SURF.paint });
  sc.add({ t: 'ell', c: [0, 56.6, 34], r: [4, 3, 3.6] }, { sub: true, k: 1.2 });
  for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * 2.6, 66, 21], b: [s * 3.4, 71, 18], ra: 1.6, rb: 0.6 }, { col: paint, bone: b('head'), k: 1, surf: SURF.paint });
  for (let i = 0; i < 6; i++) sc.add({ t: 'cap', a: [0, 50 + i * 2.6, 11 + i * 2.2], b: [0, 56 + i * 2.8, 4 + i * 2.2], ra: 3, rb: 0.8 }, { col: gilt, bone: b('neck'), k: 1.4, surf: SURF.gold });
  sc.add({ t: 'ell', c: [0, 50.5, -4], r: [10.4, 3.6, 10] }, { col: weather(PAL.velvet, 0.3), bone: b('body'), k: 1.2, surf: SURF.velvet });
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
  return { geo: sc.build({ ao: 0.55 }), rig: new Rig(bones, clips) };
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
  const shell = weather(PAL.teal, 0.42, 0.1, PAL.iron);
  sc.add({ t: 'tor', c: [0, 6, 0], R: 19, r: 4.6, rot: [0, 0, 0] }, { col: PAL.charcoal, bone: b('body'), k: 0, surf: SURF.rubber });
  sc.add({ t: 'ell', c: [0, 12, 0], r: [18, 9, 21] }, { col: shell, bone: b('body'), k: 3, surf: SURF.paint });
  sc.add({ t: 'box', c: [0, 18, -8], h: [9, 6, 4], r: 2 }, { col: weather(PAL.redDeep, 0.35), bone: b('body'), k: 2, surf: SURF.velvet });
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
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
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
  const planks: ColorFn = (p, n) => {
    const row = Math.floor((p.y - 50) / 8.4);
    return (weather(PAL.red, 0.5, 0.06, PAL.woodPale)(p, n) as THREE.Color).multiplyScalar(Math.abs(((p.y - 50) % 8.4)) < 0.9 ? 0.45 : 0.92 + 0.08 * Math.sin(row * 7.3));
  };
  sc.add({ t: 'box', c: [0, 74, 0], h: [22, 25, 19], r: 2.5 }, { col: planks, bone: b('booth'), k: 0, surf: SURF.wood });
  sc.add({ t: 'ell', c: [0, 72, 19], r: [12, 9, 6] }, { sub: true, k: 2 });
  sc.add({ t: 'box', c: [0, 103, 0], h: [27, 4, 23], r: 2, rot: [0, Math.PI / 4, 0] }, { col: weather(PAL.mustard, 0.5, 0.08), bone: b('booth'), k: 2.5, surf: SURF.paint });
  sc.add({ t: 'cap', a: [0, 104, 0], b: [0, 120, 0], ra: 17, rb: 2 }, { col: weather(PAL.mustard, 0.5, 0.08), bone: b('booth'), k: 3, surf: SURF.paint });
  for (const [th, sh, ft, s] of [['thighL', 'shinL', 'footL', 1], ['thighR', 'shinR', 'footR', -1]] as const) {
    sc.add({ t: 'cap', a: [s * 12, 50, 0], b: [s * 15, 30, -8], ra: 3.8, rb: 2.8 }, { col: weather(0x8a7050, 0.4), bone: b(th), k: 2, surf: SURF.skin });
    sc.add({ t: 'cap', a: [s * 15, 30, -8], b: [s * 13, 5, 2], ra: 2.6, rb: 2 }, { col: weather(0x8a7050, 0.4), bone: b(sh), k: 1.4, surf: SURF.skin });
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
  return { geo: sc.build({ ao: 0.55, aoScale: 1.4 }), rig: new Rig(bones, clips) };
}

// ================================================================== carnival brute
function carnivalBrute(): SculptModel {
  const P = scaleP(ADULT, 1.32, { chestW: 24, waistW: 19, hipW: 18, shoulderX: 25, arm: [10, 8.6, 7], leg: [9, 7.6, 6], stance: 12, headR: 14, depth: 0.78, armOut: 5 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(2.4, 6);
  const skin = weather(0xa98a74, 0.25, 0.08);
  const sing = stripes(16, PAL.redDeep, PAL.charcoal, 0, 0.35);
  const sack = weather(PAL.canvas, 0.5, 0.15, PAL.canvasDark);
  humanBody(sc, P, b, { skin: sack, torso: sing, hips: sing, upperArm: skin, foreArm: skin, hand: skin, thigh: sing, shin: sing, shoe: PAL.leather, bigShoes: 1.6, torsoSurf: SURF.cloth });
  // hulking deltoids, forearms like hams, a belly over the championship belt
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    sc.add({ t: 'sph', c: [s * (P.shoulderX - 2), P.shoulderY + 1, 0], r: 11 }, { col: skin, bone: b('chest'), k: 5, surf: SURF.skin });
    sc.add({ t: 'ell', c: [s * (P.shoulderX + P.armOut * 1.2), P.elbowY - 8, 2], r: [8.6, 10.5, 8.6] }, { col: skin, bone: b(`fore${n}`), k: 4, surf: SURF.skin });
  }
  sc.add({ t: 'ell', c: [0, P.waist - 3, 6], r: [16, 13, 13] }, { col: sing, bone: b('spine'), k: 5, surf: SURF.cloth });
  sc.add({ t: 'tor', c: [0, P.hip + 6, 1], R: 19, r: 3.4 }, { col: PAL.leather, bone: b('hips'), k: 1, surf: SURF.rubber });
  // burlap sack hood with crude eyeholes, stitched at the neck
  sc.add({ t: 'ell', c: [0, P.headY + 2, 0.6], r: [P.headR * 1.08, P.headR * 1.18, P.headR * 1.05] }, { col: sack, bone: b('head'), k: 2, surf: SURF.canvas });
  sc.add({ t: 'cap', a: [0, P.headY + P.headR, 0], b: [4, P.headY + P.headR + 9, -2], ra: 5, rb: 1.6 }, { col: sack, bone: b('head'), k: 3, surf: SURF.canvas });
  for (const s of [1, -1]) sc.add({ t: 'ell', c: [s * 5.6, P.headY + 3, P.headR * 0.95], r: [3.2, 2.8, 3] }, { sub: true, k: 1 });
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * 5.6, P.headY + 3, P.headR * 0.78], 2.4, PAL.ember, 1.5);
  for (let i = 0; i < 7; i++) sc.detail(cyl(0.45, 0.45, 3.4, 4), { col: PAL.ink, bone: b('head'), pos: [-8 + i * 2.6, P.headY - 9, P.headR * 0.95], rot: [0, 0, Math.PI / 2] });
  sc.detail(torus(P.headR * 0.8, 1.4, 6, 18), { col: PAL.straw, bone: b('head'), pos: [0, P.headY - P.headR * 0.95, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.cloth });
  sc.detail(cyl(6, 6, 2, 16), { col: PAL.gold, bone: b('hips'), pos: [0, P.hip + 6, 20], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
  // the sledgehammer, dragged behind in the right fist
  const hx = -(P.shoulderX + P.armOut * 1.6);
  sc.detail(cyl(1.9, 1.9, 60, 6), { col: PAL.woodPale, bone: b('handR'), pos: [hx, P.wristY - 18, 18], rot: [1.2, 0, 0], surf: SURF.wood });
  sc.detail(rbox(15, 15, 26, 2, 2), { col: C(PAL.iron), bone: b('handR'), pos: [hx, P.wristY - 30, 42], rot: [1.2, 0, 0], surf: SURF.iron });
  const gait: Gait = { ...GAIT_WALK, stride: 0.38, knee: 0.7, bob: 3.2, lean: 0.12, sway: 0.15, twist: 0.06, squash: 0.1, arm: 0.2, armOut: 0.45, elbow: 0.4, headBob: 0.04 };
  const clips: Clips = {
    move: { frames: 44, fn: (t) => mix(gaitPose(t, gait), { armR: { rx: 0.35, rz: 0.1 }, head: { rx: 0.1 } }) },
    // hammer overhead… SLAM, with the full weight of him behind it
    attack: { frames: 22, loop: false, fn: (t) => {
      const up = ease(t / 0.78), slam = ease((t - 0.8) / 0.12);
      return { armR: { rx: -2.9 * up + 2.6 * slam }, armL: { rx: -2.7 * up + 2.4 * slam }, foreR: { rx: -0.4 * up }, foreL: { rx: -0.4 * up }, chest: { rx: -0.35 * up + 0.6 * slam }, hips: { ty: -6 * slam, sy: 1 - 0.08 * slam }, head: { rx: -0.2 * up + 0.2 * slam } };
    } },
  };
  return { geo: sc.build({ ao: 0.55, aoScale: 1.3 }), rig: new Rig(bones, clips) };
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
  const panel: ColorFn = (p, n) => weather([PAL.teal, PAL.red, PAL.mustard][Math.abs(n.x) > 0.6 ? 0 : Math.abs(n.z) > 0.6 ? 1 : 2], 0.42, 0.1, PAL.woodPale)(p, n);
  sc.add({ t: 'box', c: [0, 12, 0], h: [13, 12, 13], r: 1.6 }, { col: panel, bone: b('box'), k: 0, surf: SURF.paint });
  for (const s of [-1, 1]) sc.detail(extrude(starShape(5, 6, 2.6), 0.6, 0, 1), { col: PAL.cream, bone: b('box'), pos: [s * 13.2, 12, 0], rot: [0, s * Math.PI / 2, 0], surf: SURF.paint });
  sc.detail(extrude(starShape(5, 6, 2.6), 0.6, 0, 1), { col: PAL.cream, bone: b('box'), pos: [0, 12, 13.2], surf: SURF.paint });
  sc.detail(cyl(1, 1, 6, 6), { col: PAL.brass, bone: b('crank'), pos: [16, 14, 0], rot: [0, 0, Math.PI / 2], surf: SURF.brass });
  sc.detail(rbox(1.6, 9, 1.6, 0.4, 1), { col: PAL.brass, bone: b('crank'), pos: [19, 11, 0], surf: SURF.brass });
  sc.detail(sphere(1.8, 6, 4), { col: PAL.redDeep, bone: b('crank'), pos: [19, 7, 2], surf: SURF.paint });
  if (!open) {
    sc.add({ t: 'box', c: [0, 25.2, 0], h: [13.6, 1.4, 13.6], r: 0.8 }, { col: weather(PAL.redDeep, 0.4), bone: b('lid'), k: 0.6, surf: SURF.paint });
  } else {
    sc.add({ t: 'box', c: [0, 38, -13.6], h: [13.6, 13.6, 1.4], r: 0.8 }, { col: weather(PAL.redDeep, 0.4), bone: b('lid'), k: 0, surf: SURF.paint });
    for (const [n, y0] of [['sp0', 24], ['sp1', 36]] as const) {
      sc.detail(tube(Array.from({ length: 14 }, (_, i) => [Math.cos(i * 1.4) * 5, y0 + i * 0.92, Math.sin(i * 1.4) * 5] as V3), 0.9, 4, 60), { col: PAL.iron, bone: b(n), surf: SURF.iron });
    }
    const face = weather(PAL.clown, 0.25, 0.12);
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
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
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

export const _unused = { rbox, Pose: null as unknown as Pose, ADULT };
