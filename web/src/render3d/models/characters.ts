// The six playable characters (D-40): sculpted (SDF → surface nets) bodies on real skeletons, each
// with an authored gait, an idle fidget that says who they are, an attack flourish timed to their
// signature weapon, and a hurt reaction — plus Hades-style cartoon accents (squash on footfalls,
// snappy anticipation, overshoot) against the darker world.

import * as THREE from 'three';
import { C, SURF, cone, cyl, ellipsoid, extrude, lathe, rbox, smoothShape, sphere, torus, tube, weather, stripes, type ColorFn, type V3 } from '../core/geo';
import { PAL } from './kit';
import { Sculpt } from '../sculpt/sdf';
import { Rig, type ClipDef, type Pose, ease, mix, pulse, sin, cos, snap } from '../sculpt/rig';
import { ADULT, GAIT_WALK, type Gait, type Proportions, eyeDetails, gaitPose, head, humanBody, humanBones, hurtPose, idlePose, scaleP } from '../sculpt/humanoid';

export interface SculptModel {
  geo: THREE.BufferGeometry;
  rig: Rig;
}

type Builder = () => SculptModel;

const stdClips = (gait: Gait, idleExtra: (t: number) => Pose, cast: (t: number) => Pose, castFrames = 24, moveOverlay?: (t: number) => Pose): Record<string, ClipDef> => ({
  idle: { frames: 96, fn: (t) => mix(idlePose(t), idleExtra(t)) },
  move: { frames: 36, fn: (t) => (moveOverlay ? mix(gaitPose(t, gait), moveOverlay(t)) : gaitPose(t, gait)) },
  cast: { frames: castFrames, loop: false, fn: cast },
  hurt: { frames: 18, loop: false, fn: hurtPose },
  dash: { frames: 16, fn: (t) => mix(gaitPose(t, { ...gait, stride: gait.stride * 1.2, lean: gait.lean + 0.35, bob: gait.bob * 0.6 }), { armL: { rx: 0.9 }, armR: { rx: 0.9 } }) },
});

// ---------------------------------------------------------------- The Carny
function carny(): SculptModel {
  const P = ADULT;
  const bones = humanBones(P);
  const sc = new Sculpt(1.05, 4.5);
  const b = (n: string) => bones.findIndex((x) => x.name === n);
  const shirt = stripes(16, PAL.cream, PAL.red, 0, 0.25);
  const trousers = weather(PAL.charcoal, 0.3, 0.12);
  humanBody(sc, P, b, { skin: PAL.skin, torso: shirt, hips: trousers, thigh: trousers, shin: trousers, upperArm: shirt, foreArm: shirt, hand: PAL.bone, gloves: true, shoe: PAL.leather });
  // mustard waistcoat over the shirt, a striped placket showing down the front
  sc.add({ t: 'ell', c: [0, P.chest - 1, 0.4], r: [P.chestW + 0.8, 10.5, P.chestW * P.depth + 0.9] }, { col: weather(PAL.mustard, 0.35, 0.1, PAL.ochre), bone: b('chest'), k: 0.8, surf: SURF.cloth });
  sc.add({ t: 'ell', c: [0, P.waist + 1, 0.6], r: [P.waistW + 0.8, 7, P.waistW * P.depth + 0.8] }, { col: weather(PAL.mustard, 0.35, 0.1, PAL.ochre), bone: b('spine'), k: 1.5, surf: SURF.cloth });
  sc.add({ t: 'box', c: [0, P.chest - 2, P.chestW * P.depth + 0.9], h: [2.4, 9, 0.6], r: 0.6 }, { col: shirt, bone: b('chest'), k: 0.4, surf: SURF.cloth });
  // sleeve garters, belt
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'tor', c: [s * (P.shoulderX + 1), P.elbowY + 6, -0.4], R: P.arm[1] + 0.8, r: 0.9, rot: [0, 0, s * 0.12] }, { col: PAL.blood, bone: b(`arm${n}`), k: 0.5 });
  sc.add({ t: 'tor', c: [0, P.hip + 4, 0.3], R: P.hipW - 0.4, r: 1.3 }, { col: PAL.leather, bone: b('hips'), k: 0.6, surf: SURF.rubber });
  // spats over the shoes
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'cap', a: [s * (P.stance + 0.4), P.ankle + 4, 0.5], b: [s * (P.stance + 0.4), P.ankle + 0.5, 1], ra: 3.6, rb: 3.9 }, { col: PAL.cream, bone: b(`foot${n}`), k: 0.8 });
  head(sc, P, b('head'), { skin: PAL.skin, brow: 1.1, cheeks: 1.05, chin: 1 });
  // slicked hair under the hat
  sc.add({ t: 'ell', c: [0, P.headY + 4, -2.2], r: [P.headR * 1.02, P.headR * 0.7, P.headR * 0.95] }, { col: PAL.ink, bone: b('head'), k: 1.2, surf: SURF.latex });
  eyeDetails(sc, P, b('head'), { size: 0.19, lids: PAL.skin });
  sc.detail(tube([[-4.6, P.headY - 3.4, 11.6], [-2, P.headY - 4.3, 12.4], [0, P.headY - 4, 12.6], [2, P.headY - 4.3, 12.4], [4.6, P.headY - 3.4, 11.6]], 0.65, 5, 14), { col: PAL.ink, bone: b('head') });
  sc.detail(ellipsoid(3.4, 0.8, 1, 10, 6), { col: PAL.redDeep, bone: b('head'), pos: [0, P.headY - 6.6, 11.2] });
  // the straw boater, cocked
  const hatM = new THREE.Matrix4().makeRotationX(-0.14).multiply(new THREE.Matrix4().makeRotationZ(0.07));
  for (const [g, col, y, surf] of [[cyl(17, 17, 1.2, 28), C(PAL.straw).multiplyScalar(0.92), 0, SURF.canvas], [cyl(11, 11.6, 7, 24), C(PAL.straw).multiplyScalar(0.88), 4, SURF.canvas], [cyl(11.8, 12.2, 2.2, 24, true), C(PAL.blood), 2, SURF.cloth]] as const) {
    const gg = g.clone();
    gg.applyMatrix4(hatM.clone().setPosition(0, P.headY + P.headR * 0.92 + y, -0.6));
    sc.detail(gg, { col, bone: b('head'), surf });
  }
  // bowtie + waistcoat buttons
  for (const s of [-1, 1]) sc.detail(cone(2.6, 4.4, 6), { col: PAL.blood, bone: b('chest'), pos: [s * 2.2, P.neck - 1, 8.4], rot: [0, 0, s * Math.PI / 2] });
  for (let i = 0; i < 3; i++) sc.detail(sphere(0.85, 6, 4), { col: PAL.brass, bone: b('chest'), pos: [3.2, P.chest - 5 + i * 4.4, P.chestW * P.depth + 1.4], surf: SURF.brass });
  // a fan of playing cards in the right hand
  for (let i = 0; i < 5; i++) sc.detail(rbox(5.6, 8.2, 0.45, 0.8, 1), { col: i % 2 ? PAL.cream : PAL.bone, bone: b('handR'), pos: [-(P.shoulderX + P.armOut * 1.6) - 1 - i * 0.5, P.wristY - 6 + i * 0.3, 4.2], rot: [0.25, 0.2, -0.7 + i * 0.3], surf: SURF.paint });
  const gait: Gait = { ...GAIT_WALK, stride: 0.62, bob: 2.4, sway: 0.08, squash: 0.06, arm: 0.52, twist: 0.16, headBob: 0.05, lift: 0.12 };
  const rig = new Rig(bones, stdClips(
    gait,
    // idle: a card flourish, then a tip of the boater
    (t) => ({
      armR: { rx: -0.9 * pulse(t, 0.25, 0.14), rz: 0.4 * pulse(t, 0.25, 0.14) },
      foreR: { rx: -0.8 * pulse(t, 0.25, 0.14), ry: 2.4 * pulse(t, 0.25, 0.08) },
      armL: { rx: -1.9 * pulse(t, 0.68, 0.12), rz: -0.4 * pulse(t, 0.68, 0.12) },
      foreL: { rx: -1.6 * pulse(t, 0.68, 0.12) },
      head: { rx: 0.12 * pulse(t, 0.7, 0.1), rz: -0.08 * pulse(t, 0.25, 0.14) },
    }),
    // cast: a sidearm flick, anticipation then snap
    (t) => {
      const wind = ease(t / 0.35) * (1 - ease((t - 0.35) / 0.15));
      const snapK = ease((t - 0.35) / 0.12) * (1 - ease((t - 0.6) / 0.4));
      return { chest: { ry: 0.5 * wind - 0.4 * snapK }, armR: { rx: 0.5 * wind - 1.3 * snapK, rz: 0.9 * wind + 0.2 * snapK }, foreR: { rx: -1.2 * wind - 0.2 * snapK }, head: { ry: -0.2 * snapK } };
    },
  ));
  return { geo: sc.build({ ao: 0.62 }), rig };
}

// ---------------------------------------------------------------- The Strongman
function strongman(): SculptModel {
  const P = scaleP(ADULT, 1.05, { chestW: 17.5, waistW: 12, hipW: 12.5, shoulderX: 18, arm: [7, 6, 4.4], leg: [6.4, 5.2, 4], stance: 9, headR: 11.2, depth: 0.78, armOut: 4 });
  const bones = humanBones(P);
  const sc = new Sculpt(1.15, 5);
  const b = (n: string) => bones.findIndex((x) => x.name === n);
  const leopard: ColorFn = (p) => {
    const s = Math.sin(p.x * 0.85) * Math.sin(p.y * 0.7 + p.z * 0.5) + Math.sin(p.z * 1.1 + p.y * 0.3) * 0.6;
    return s > 0.95 ? C(PAL.charcoal) : C(PAL.mustard).multiplyScalar(0.82 + 0.15 * Math.sin(p.y * 0.4));
  };
  const skin = weather(PAL.skin, 0.12, 0.08);
  humanBody(sc, P, b, { skin, torso: skin, hips: leopard, thigh: weather(PAL.charcoal, 0.3), shin: weather(PAL.charcoal, 0.3), upperArm: skin, foreArm: skin, hand: skin, shoe: PAL.leather, torsoSurf: SURF.skin });
  // pectorals, belly, biceps, deltoids: the strongman's silhouette
  for (const s of [1, -1]) {
    sc.add({ t: 'ell', c: [s * 7, P.chest + 2, P.chestW * P.depth - 1.5], r: [7.5, 5.6, 4] }, { col: skin, bone: b('chest'), k: 3, surf: SURF.skin });
    sc.add({ t: 'ell', c: [s * (P.shoulderX + 1), P.shoulderY - 9, 0.6], r: [5.8, 7.2, 5.6] }, { col: skin, bone: b(s > 0 ? 'armL' : 'armR'), k: 3, surf: SURF.skin });
    sc.add({ t: 'sph', c: [s * (P.shoulderX - 1), P.shoulderY + 1, 0], r: 6.6 }, { col: skin, bone: b('chest'), k: 4, surf: SURF.skin });
  }
  sc.add({ t: 'ell', c: [0, P.waist - 1, 3], r: [10, 8.5, 8] }, { col: skin, bone: b('spine'), k: 4, surf: SURF.skin });
  // leopard leotard: over the belly and one shoulder strap
  sc.add({ t: 'ell', c: [0, P.waist - 2, 1.5], r: [P.waistW + 1.2, 9.5, P.waistW * P.depth + 2] }, { col: leopard, bone: b('spine'), k: 0.8, surf: SURF.cloth });
  sc.add({ t: 'cap', a: [-6, P.waist + 6, 7], b: [-P.shoulderX + 3, P.shoulderY + 2, 0], ra: 2.6, rb: 2.4 }, { col: leopard, bone: b('chest'), k: 0.8, surf: SURF.cloth });
  sc.add({ t: 'tor', c: [0, P.hip + 2, 0.5], R: P.hipW + 0.4, r: 2.2 }, { col: PAL.leather, bone: b('hips'), k: 0.6, surf: SURF.rubber });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'tor', c: [s * (P.shoulderX + P.armOut * 1.4), P.wristY + 5, 0.4], R: P.arm[2] + 1, r: 1.6 }, { col: PAL.leather, bone: b(`fore${n}`), k: 0.6, surf: SURF.rubber });
  head(sc, P, b('head'), { skin, brow: 1.5, jaw: 1.2, chin: 1.3, nose: 1.15, cheeks: 0.9 });
  eyeDetails(sc, P, b('head'), { size: 0.16, y: 0.1, lids: skin });
  sc.detail(tube([[-9.5, P.headY - 1.8, 9.6], [-6, P.headY - 4.8, 11.4], [0, P.headY - 4.6, 12], [6, P.headY - 4.8, 11.4], [9.5, P.headY - 1.8, 9.6]], (t) => 1.4 + Math.sin(t * Math.PI) * 1.1, 6, 16), { col: PAL.ink, bone: b('head') });
  for (const s of [-1, 1]) sc.detail(torus(1.6, 0.65, 5, 10), { col: PAL.ink, bone: b('head'), pos: [s * 10.2, P.headY - 0.4, 8.8], rot: [0, s * 0.8, 0] });
  sc.detail(rbox(5, 4, 1.5, 0.6, 1), { col: PAL.brass, bone: b('hips'), pos: [0, P.hip + 2, P.hipW * 0.8 + 2], surf: SURF.brass });
  // the carnival mallet
  const hx = -(P.shoulderX + P.armOut * 1.6);
  sc.detail(cyl(1.2, 1.2, 36, 6), { col: PAL.woodPale, bone: b('handR'), pos: [hx, P.wristY - 4, 9], rot: [Math.PI / 2 - 0.3, 0, 0], surf: SURF.wood });
  sc.detail(cyl(5.4, 5.4, 14, 14), { col: C(PAL.red).multiplyScalar(0.85), bone: b('handR'), pos: [hx, P.wristY + 1, 26], rot: [0, 0, Math.PI / 2], surf: SURF.wood });
  const gait: Gait = { ...GAIT_WALK, stride: 0.42, knee: 0.7, bob: 1.8, sway: 0.13, twist: 0.07, squash: 0.09, arm: 0.28, elbow: 0.5, armOut: 0.38, headBob: 0.03 };
  const rig = new Rig(bones, stdClips(
    gait,
    // idle: a double-biceps flex every loop
    (t) => {
      const f = pulse(t, 0.55, 0.2);
      return { armL: { rz: -1.25 * f, rx: -0.2 * f }, armR: { rz: 1.25 * f, rx: -0.2 * f }, foreL: { rx: -1.9 * f, rz: -0.5 * f }, foreR: { rx: -1.9 * f, rz: 0.5 * f }, chest: { sx: 1 + 0.05 * f, sy: 1 + 0.03 * f }, head: { rx: 0.1 * f } };
    },
    // cast: wind the mallet up overhead, slam down with a crouch
    (t) => {
      const up = ease(t / 0.4) * (1 - ease((t - 0.42) / 0.1));
      const hit = ease((t - 0.42) / 0.1) * (1 - ease((t - 0.7) / 0.3));
      return { armR: { rx: -2.6 * up - 0.6 * hit }, foreR: { rx: -0.6 * up }, armL: { rx: -2.2 * up - 0.4 * hit }, chest: { rx: -0.3 * up + 0.45 * hit }, hips: { ty: -4 * hit, sy: 1 - 0.07 * hit } };
    },
  ));
  return { geo: sc.build({ ao: 0.6 }), rig };
}

// ---------------------------------------------------------------- The Fortune Teller
function fortuneTeller(): SculptModel {
  const P = scaleP(ADULT, 0.98, { chestW: 11.5, waistW: 9, hipW: 11, headR: 11.4, arm: [3.4, 2.9, 2.3] });
  const bones = humanBones(P, [
    { name: 'skirt', parent: 'hips', head: [0, P.hip, 0] },
    { name: 'ball', parent: 'chest', head: [0, P.chest - 8, 13] },
  ]);
  const sc = new Sculpt(1.05, 4.5);
  const b = (n: string) => bones.findIndex((x) => x.name === n);
  const velvet = weather(PAL.velvet, 0.32, 0.09);
  humanBody(sc, P, b, { skin: PAL.skinPale, torso: weather(PAL.plum, 0.3), upperArm: weather(PAL.plum, 0.3), foreArm: PAL.skinPale, hand: PAL.skinPale, noLegs: true });
  // the long tiered skirt sways on its own bone (legs walk hidden beneath)
  sc.add({ t: 'cap', a: [0, P.hip + 2, 0], b: [0, 6, 0], ra: P.hipW + 1, rb: 19 }, { col: velvet, bone: b('skirt'), k: 3, surf: SURF.velvet });
  sc.add({ t: 'tor', c: [0, 5, 0], R: 18, r: 3 }, { col: velvet, bone: b('skirt'), k: 2, surf: SURF.velvet });
  sc.add({ t: 'tor', c: [0, 18, 0], R: 15.4, r: 1.4 }, { col: PAL.gold, bone: b('skirt'), k: 0.5, surf: SURF.gold });
  sc.add({ t: 'tor', c: [0, 3.4, 0], R: 19.4, r: 1.6 }, { col: PAL.gold, bone: b('skirt'), k: 0.5, surf: SURF.gold });
  // shawl round the shoulders
  sc.add({ t: 'ell', c: [0, P.chest + 4, 0.6], r: [P.chestW + 3.6, 6, P.chestW * P.depth + 3] }, { col: weather(PAL.redDeep, 0.3, 0.1), bone: b('chest'), k: 1.2, surf: SURF.cloth });
  head(sc, P, b('head'), { skin: PAL.skinPale, brow: 0.8, nose: 0.9, cheeks: 1.1, chin: 0.8 });
  // headscarf with a knot and trailing tail
  sc.add({ t: 'ell', c: [0, P.headY + 4, -1], r: [P.headR * 1.08, P.headR * 0.78, P.headR * 1.08] }, { col: weather(PAL.red, 0.3, 0.12), bone: b('head'), k: 1.2, surf: SURF.cloth });
  sc.add({ t: 'cap', a: [0, P.headY + 2, -P.headR], b: [1.5, P.headY - 12, -P.headR - 3], ra: 2.6, rb: 1.2 }, { col: weather(PAL.red, 0.3, 0.12), bone: b('head'), k: 1.5, surf: SURF.cloth });
  eyeDetails(sc, P, b('head'), { size: 0.2, lids: PAL.velvet, iris: 0x2a1840 });
  for (let i = 0; i < 9; i++) {
    const a = -1.05 + i * 0.26;
    sc.detail(cyl(1.15, 1.15, 0.4, 8), { col: PAL.gold, bone: b('head'), pos: [Math.sin(a) * P.headR * 1.04, P.headY + 1.8, Math.cos(a) * P.headR * 1.04], rot: [Math.PI / 2, 0, -a], surf: SURF.gold });
  }
  for (const s of [-1, 1]) sc.detail(torus(2.1, 0.42, 5, 12), { col: PAL.gold, bone: b('head'), pos: [s * P.headR * 1.0, P.headY - 5, 0.6], rot: [0, Math.PI / 2, 0], surf: SURF.gold });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    sc.detail(cone(0.8, 4.2, 4), { col: PAL.gold, bone: b('chest'), pos: [Math.cos(a) * (P.chestW + 3.4), P.chest - 2.4, Math.sin(a) * (P.chestW * P.depth + 2.6)], rot: [Math.PI, 0, 0], surf: SURF.gold });
  }
  sc.detail(ellipsoid(2.6, 0.7, 0.9, 8, 4), { col: PAL.blood, bone: b('head'), pos: [0, P.headY - 6.4, 10.4] });
  // the crystal ball floats between her hands, the only saturated thing about her
  sc.detail(sphere(6.4, 18, 14), { col: PAL.violet, bone: b('ball'), pos: [0, P.chest - 8, 13], emit: 0.55, surf: SURF.glass });
  sc.detail(sphere(2.8, 10, 8), { col: 0xe9dcff, bone: b('ball'), pos: [0, P.chest - 7.5, 13.5], emit: 1.1, surf: SURF.glass });
  const hold: Pose = { armL: { rx: -0.95, rz: 0.25 }, armR: { rx: -0.95, rz: -0.25 }, foreL: { rx: -0.9, rz: 0.3 }, foreR: { rx: -0.9, rz: -0.3 } };
  const gait: Gait = { ...GAIT_WALK, stride: 0.28, knee: 0.45, bob: 0.9, sway: 0.03, twist: 0.04, squash: 0.02, arm: 0, elbow: 0, headBob: 0.02 };
  const rig = new Rig(bones, stdClips(
    gait,
    // idle: the ball bobs, her hands circle it, her head tilts as if listening
    (t) => mix(hold, { ball: { ty: 1.4 * sin(t, 2), ry: t * Math.PI * 4 }, foreL: { rz: 0.2 * sin(t, 2) }, foreR: { rz: -0.2 * sin(t, 2, 0.5) }, head: { rz: 0.12 * sin(t), rx: 0.08 }, skirt: { rz: 0.02 * sin(t) } }),
    // cast: lift the ball high; it flares
    (t) => {
      const k = Math.sin(Math.min(1, t * 1.2) * Math.PI);
      return mix(hold, { armL: { rx: -1.3 * k }, armR: { rx: -1.3 * k }, ball: { ty: 14 * k, tz: 2 * k, sx: 1 + 0.2 * k, sy: 1 + 0.2 * k, sz: 1 + 0.2 * k }, chest: { rx: -0.15 * k }, head: { rx: -0.3 * k } });
    },
    24,
    (t) => mix(hold, { skirt: { rz: 0.06 * sin(t), rx: -0.04 * cos(t, 2) }, ball: { ty: 0.8 * sin(t, 2) } }),
  ));
  return { geo: sc.build({ ao: 0.6 }), rig };
}

// ---------------------------------------------------------------- The Ride Operator
function rideOperator(): SculptModel {
  const P = scaleP(ADULT, 1.0, { chestW: 13, waistW: 11, arm: [4.2, 3.6, 2.8], leg: [5.4, 4.4, 3.5] });
  const bones = humanBones(P);
  const sc = new Sculpt(1.05, 4.5);
  const b = (n: string) => bones.findIndex((x) => x.name === n);
  const denim = weather(PAL.denim, 0.4, 0.1, PAL.slate);
  const shirt = weather(PAL.cream, 0.28, 0.12);
  humanBody(sc, P, b, { skin: PAL.skin, torso: shirt, hips: denim, thigh: denim, shin: denim, upperArm: shirt, foreArm: PAL.skin, hand: PAL.leather, gloves: true, shoe: PAL.leather, bigShoes: 1.12 });
  // bib overalls with straps and a front pocket; rolled sleeves
  sc.add({ t: 'ell', c: [0, P.waist + 1, 0.8], r: [P.waistW + 1, 9, P.waistW * P.depth + 1.2] }, { col: denim, bone: b('spine'), k: 0.8, surf: SURF.cloth });
  sc.add({ t: 'box', c: [0, P.chest - 2, P.chestW * P.depth - 0.6], h: [7.4, 6, 1.6], r: 1 }, { col: denim, bone: b('chest'), k: 0.6, surf: SURF.cloth });
  for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * 5.6, P.chest + 2, P.chestW * P.depth], b: [s * 8.6, P.shoulderY + 1.5, -2], ra: 1.4, rb: 1.3 }, { col: denim, bone: b('chest'), k: 0.4, surf: SURF.cloth });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'tor', c: [s * (P.shoulderX + P.armOut), P.elbowY + 2, -0.6], R: P.arm[1] + 0.5, r: 1.4 }, { col: shirt, bone: b(`arm${n}`), k: 0.5 });
  sc.add({ t: 'tor', c: [0, P.hip + 3, 0.4], R: P.hipW + 0.6, r: 1.6 }, { col: PAL.leather, bone: b('hips'), k: 0.6, surf: SURF.rubber });
  sc.add({ t: 'box', c: [9, P.hip, 6], h: [3, 3.6, 2], r: 0.8, rot: [0, 0.6, 0] }, { col: PAL.leather, bone: b('hips'), k: 0.6, surf: SURF.rubber });
  head(sc, P, b('head'), { skin: PAL.skin, brow: 1.2, jaw: 1.1, chin: 1.1 });
  // stubble shadow + flat cap with goggles
  sc.add({ t: 'ell', c: [0, P.headY - 5.4, 5.6], r: [8.6, 4.6, 6] }, { col: C(PAL.skin).multiplyScalar(0.72), bone: b('head'), k: 0.5, surf: SURF.skin });
  sc.add({ t: 'ell', c: [0, P.headY + 7.6, -0.4], r: [P.headR * 1.08, P.headR * 0.5, P.headR * 1.1] }, { col: weather(PAL.slate, 0.35, 0.12), bone: b('head'), k: 1, surf: SURF.cloth });
  sc.detail(ellipsoid(10, 1.3, 7, 14, 6), { col: C(PAL.slate), bone: b('head'), pos: [0, P.headY + 6, 10], rot: [0.18, 0, 0], surf: SURF.cloth });
  for (const s of [-1, 1]) {
    sc.detail(torus(2.8, 1.05, 6, 12), { col: PAL.brass, bone: b('head'), pos: [s * 4.2, P.headY + 10.6, 7.6], rot: [-0.6, 0, 0], surf: SURF.brass });
    sc.detail(cyl(2.3, 2.3, 0.6, 12), { col: PAL.cold, bone: b('head'), pos: [s * 4.2, P.headY + 10.6, 7.6], rot: [Math.PI / 2 - 0.6, 0, 0], emit: 0.3, surf: SURF.glass });
  }
  eyeDetails(sc, P, b('head'), { size: 0.18, lids: PAL.skin });
  for (const s of [-1, 1]) sc.detail(sphere(1.05, 6, 4), { col: PAL.brass, bone: b('chest'), pos: [s * 5.6, P.chest + 1.5, P.chestW * P.depth + 0.6], surf: SURF.brass });
  // the big monkey wrench
  const wrench = new THREE.Shape();
  wrench.moveTo(-1.6, -14); wrench.lineTo(1.6, -14); wrench.lineTo(1.6, 6); wrench.lineTo(4.5, 6); wrench.lineTo(4.5, 12); wrench.lineTo(1.8, 12);
  wrench.lineTo(1.8, 9); wrench.lineTo(-1.8, 9); wrench.lineTo(-1.8, 12); wrench.lineTo(-4.5, 12); wrench.lineTo(-4.5, 6); wrench.lineTo(-1.6, 6); wrench.lineTo(-1.6, -14);
  sc.detail(extrude(wrench, 2.2, 0.4, 4, 1), { col: PAL.iron, bone: b('handR'), pos: [-(P.shoulderX + P.armOut * 1.6) - 1, P.wristY - 8, 6], rot: [Math.PI / 2 - 0.4, 0, 0.2], surf: SURF.iron });
  const gait: Gait = { ...GAIT_WALK, stride: 0.68, knee: 0.95, bob: 2.7, lean: 0.12, sway: 0.06, twist: 0.14, squash: 0.06, arm: 0.62, elbow: 0.7, headBob: 0.05 };
  const rig = new Rig(bones, stdClips(
    gait,
    // idle: spins the wrench in his fingers, taps a boot
    (t) => ({ handR: { rz: t * Math.PI * 4 }, foreR: { rx: -0.9 }, armR: { rx: -0.3 }, footL: { rx: -0.35 * Math.max(0, sin(t, 4)) }, head: { ry: 0.15 * sin(t, 0.5) } }),
    // cast: a big two-handed wrench swing
    (t) => {
      const wind = ease(t / 0.3) * (1 - ease((t - 0.3) / 0.12));
      const sw = ease((t - 0.3) / 0.15) * (1 - ease((t - 0.65) / 0.35));
      return { chest: { ry: 0.7 * wind - 0.8 * sw }, armR: { rx: -1.2 * wind - 0.6 * sw, rz: 0.6 * wind - 0.5 * sw }, armL: { rx: -0.9 * wind - 0.5 * sw }, foreR: { rx: -1 * wind } };
    },
  ));
  return { geo: sc.build({ ao: 0.6 }), rig };
}

// ---------------------------------------------------------------- The Lost Child
function lostChild(): SculptModel {
  const P = scaleP(ADULT, 0.66, { headR: 11.5, headY: 49.5, neck: 41, stance: 4.8 });
  const bones = humanBones(P, [{ name: 'plush', parent: 'chest', head: [-7, P.chest - 6, 7] }]);
  const sc = new Sculpt(0.9, 3.5);
  const b = (n: string) => bones.findIndex((x) => x.name === n);
  const coat = weather(PAL.ochre, 0.42, 0.11, PAL.mustard);
  humanBody(sc, P, b, { skin: PAL.skinPale, torso: coat, upperArm: coat, foreArm: coat, hand: PAL.cream, gloves: true, thigh: weather(PAL.navy, 0.3), shin: weather(PAL.navy, 0.3), shoe: PAL.redDeep, bigShoes: 0.95 });
  // the hand-me-down coat: hangs to the knees, sleeves too long
  sc.add({ t: 'cap', a: [0, P.chest + 3, 0.4], b: [0, P.knee + 3, 0.4], ra: P.chestW + 0.8, rb: P.hipW + 3.4 }, { col: coat, bone: b('spine'), k: 2, surf: SURF.cloth });
  sc.add({ t: 'box', c: [-5, P.waist - 2, P.waistW * P.depth + 2.2], h: [2.6, 2.6, 0.5], r: 0.5, rot: [0, -0.5, 0.2] }, { col: weather(PAL.denim, 0.35), bone: b('spine'), k: 0.3 });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'tor', c: [s * (P.shoulderX + P.armOut * 1.5), P.wristY + 1, 0.6], R: P.arm[2] + 1.1, r: 1.2 }, { col: coat, bone: b(`fore${n}`), k: 0.6 });
  // scarf
  sc.add({ t: 'tor', c: [0, P.neck - 0.6, 0.4], R: 5.6, r: 2.1 }, { col: weather(PAL.red, 0.3), bone: b('chest'), k: 0.8, surf: SURF.cloth });
  sc.add({ t: 'cap', a: [3.5, P.neck - 1.5, 4.8], b: [5.5, P.chest - 9, 7.4], ra: 1.9, rb: 1.6 }, { col: weather(PAL.red, 0.3), bone: b('chest'), k: 0.8, surf: SURF.cloth });
  head(sc, P, b('head'), { skin: PAL.skinPale, brow: 0.7, nose: 0.8, cheeks: 1.25, chin: 0.6, jaw: 0.9 });
  // knit beanie with a pom-pom
  sc.add({ t: 'ell', c: [0, P.headY + 5.4, -0.4], r: [P.headR * 1.07, P.headR * 0.72, P.headR * 1.07] }, { col: weather(PAL.teal, 0.3, 0.2), bone: b('head'), k: 1, surf: SURF.plush });
  sc.add({ t: 'tor', c: [0, P.headY + 2.6, -0.3], R: P.headR * 0.98, r: 1.8 }, { col: weather(PAL.cream, 0.3), bone: b('head'), k: 0.6, surf: SURF.plush });
  sc.add({ t: 'sph', c: [0, P.headY + 14.5, -1], r: 3.5 }, { col: PAL.cream, bone: b('head'), k: 1.5, surf: SURF.plush });
  // big worried eyes
  eyeDetails(sc, P, b('head'), { size: 0.26, spread: 0.37, y: 0.1, iris: 0x2a2018, lids: PAL.skinPale, tilt: -0.12 });
  for (let i = 0; i < 3; i++) sc.detail(cyl(1.5, 1.5, 0.8, 10), { col: PAL.woodDark, bone: b('spine'), pos: [0.5, P.waist + 6 - i * 6.5, P.waistW * P.depth + 2.6], rot: [Math.PI / 2, 0, 0], surf: SURF.wood });
  // the plush friend clutched in the left arm
  const plush = weather(PAL.woodPale, 0.4, 0.2);
  sc.add({ t: 'ell', c: [-7, P.chest - 9, 8.6], r: [4.4, 5.2, 3.8] }, { col: plush, bone: b('plush'), k: 1.2, surf: SURF.plush });
  sc.add({ t: 'sph', c: [-7, P.chest - 2.6, 9], r: 3.6 }, { col: plush, bone: b('plush'), k: 1.6, surf: SURF.plush });
  for (const s of [-1, 1]) sc.add({ t: 'sph', c: [-7 + s * 2.8, P.chest + 0.6, 8.6], r: 1.4 }, { col: plush, bone: b('plush'), k: 0.8, surf: SURF.plush });
  sc.detail(sphere(0.7, 6, 4), { col: PAL.ink, bone: b('plush'), pos: [-5.8, P.chest - 2.2, 12.4], surf: SURF.porcelain });
  const clutch: Pose = { armR: { rx: -0.85, rz: -0.55 }, foreR: { rx: -1.5, rz: -0.5 } };
  const gait: Gait = { ...GAIT_WALK, stride: 0.72, knee: 1.05, bob: 1.9, sway: 0.1, twist: 0.08, lean: 0.1, squash: 0.08, arm: 0.6, elbow: 0.45, lift: 0.22, headBob: 0.06 };
  const rig = new Rig(bones, stdClips(
    gait,
    // idle: nervously looks left… right… hugs the plush tighter
    (t) => mix(clutch, { head: { ry: 0.55 * sin(t) * Math.abs(sin(t)), rx: 0.08 }, plush: { sx: 1 - 0.06 * pulse(t, 0.5, 0.15), sy: 1 - 0.06 * pulse(t, 0.5, 0.15) }, chest: { rx: 0.06 } }),
    // cast: points ahead — "go get 'em!"
    (t) => {
      const k = ease(t / 0.25) * (1 - ease((t - 0.6) / 0.4));
      return mix(clutch, { armL: { rx: -1.5 * k, rz: 0.2 * k }, foreL: { rx: -0.1 * k }, head: { rx: -0.15 * k }, hips: { ty: 1.5 * k } });
    },
    20,
    () => clutch,
  ));
  return { geo: sc.build({ ao: 0.6 }), rig };
}

// ---------------------------------------------------------------- The Ringleader
function ringleader(): SculptModel {
  const P = scaleP(ADULT, 1.03, { chestW: 12, waistW: 9.5, hipW: 10.5, headR: 11.3, leg: [4.8, 3.9, 3.2] });
  const bones = humanBones(P, [{ name: 'tails', parent: 'hips', head: [0, P.hip + 6, -8] }]);
  const sc = new Sculpt(1.05, 4.5);
  const b = (n: string) => bones.findIndex((x) => x.name === n);
  const coat = weather(PAL.red, 0.35, 0.09);
  const trousers = weather(PAL.cream, 0.22, 0.12);
  humanBody(sc, P, b, { skin: PAL.skinPale, torso: coat, hips: trousers, thigh: trousers, shin: PAL.ink, upperArm: coat, foreArm: coat, hand: PAL.bone, gloves: true, shoe: PAL.ink });
  // tall riding boots, gold frogging, epaulettes, swallow tails
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'cap', a: [s * (P.stance + 0.4), P.knee + 2, 0.8], b: [s * (P.stance + 0.4), P.ankle + 1, 0.4], ra: P.leg[1] + 0.9, rb: P.leg[2] + 0.8 }, { col: PAL.ink, bone: b(`shin${n}`), k: 0.6, surf: SURF.rubber });
  for (let i = 0; i < 4; i++) sc.add({ t: 'box', c: [0, P.waist - 3 + i * 4.6, P.chestW * P.depth + 0.2], h: [5.2, 0.6, 0.5], r: 0.3 }, { col: PAL.gold, bone: b(i < 2 ? 'spine' : 'chest'), k: 0.3, surf: SURF.gold });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'ell', c: [s * (P.shoulderX + 0.5), P.shoulderY + 2, 0], r: [5, 1.6, 4.4] }, { col: PAL.gold, bone: b(`arm${n}`), k: 0.5, surf: SURF.gold });
  for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * 4, P.hip + 4, -P.hipW * 0.6], b: [s * 6, P.knee + 2, -P.hipW * 0.9 - 4], ra: 3.4, rb: 2 }, { col: weather(PAL.redDeep, 0.35), bone: b('tails'), k: 1, surf: SURF.cloth });
  head(sc, P, b('head'), { skin: PAL.skinPale, brow: 1, chin: 1.1, nose: 1.05 });
  eyeDetails(sc, P, b('head'), { size: 0.18, lids: PAL.skinPale });
  sc.detail(tube([[-6.5, P.headY - 2.2, 10.2], [-3, P.headY - 4.2, 11.4], [0, P.headY - 3.8, 11.7], [3, P.headY - 4.2, 11.4], [6.5, P.headY - 2.2, 10.2]], 0.9, 5, 12), { col: PAL.ink, bone: b('head') });
  // top hat (crisp) with a blood-red band
  const ht = P.headY + P.headR * 0.9;
  sc.detail(cyl(13, 13, 1.1, 24), { col: PAL.ink, bone: b('head'), pos: [0, ht, 0], rot: [-0.08, 0, 0], surf: SURF.velvet });
  sc.detail(lathe([[0, 0], [7.6, 0], [8, 7], [8.6, 15], [0, 15]], 20), { col: PAL.ink, bone: b('head'), pos: [0, ht, 0], rot: [-0.08, 0, 0], surf: SURF.velvet });
  sc.detail(cyl(8.1, 7.8, 2.6, 20, true), { col: PAL.blood, bone: b('head'), pos: [0, ht + 2.2, -0.2], rot: [-0.08, 0, 0] });
  for (const s of [-1, 1]) sc.detail(cone(2.3, 4.2, 6), { col: PAL.ink, bone: b('chest'), pos: [s * 2.1, P.neck - 1.4, 7.8], rot: [0, 0, s * Math.PI / 2] });
  // conductor's baton
  const hx = -(P.shoulderX + P.armOut * 1.6);
  sc.detail(cyl(0.55, 0.8, 22, 6), { col: PAL.ink, bone: b('handR'), pos: [hx, P.wristY - 5, 11], rot: [Math.PI / 2 - 0.2, 0, 0], surf: SURF.paint });
  sc.detail(sphere(1.2, 6, 4), { col: PAL.bone, bone: b('handR'), pos: [hx, P.wristY - 2.6, 21.5], surf: SURF.porcelain });
  const gait: Gait = { ...GAIT_WALK, stride: 0.58, knee: 0.55, lift: 0.45, bob: 1.6, lean: -0.05, sway: 0.04, twist: 0.08, squash: 0.04, arm: 0.22, elbow: 0.5, headBob: 0.02 };
  const rig = new Rig(bones, stdClips(
    gait,
    // idle: taps the baton in his palm, chin up
    (t) => {
      const tap = Math.max(0, sin(t, 3));
      return { armR: { rx: -0.6, rz: -0.3 }, foreR: { rx: -1.2 - 0.25 * tap }, armL: { rx: -0.5, rz: 0.4 }, foreL: { rx: -1.3 }, head: { rx: -0.1, ry: 0.1 * sin(t, 0.5) }, tails: { rx: 0.05 * sin(t) } };
    },
    // cast: a conductor's flourish — sweep up, circle, downbeat
    (t) => {
      const k = Math.sin(Math.min(1, t) * Math.PI);
      return { armR: { rx: -1.6 * k - 0.6 * sin(t, 1.5) * k, rz: -0.6 * k * cos(t, 1.5) }, foreR: { rx: -0.5 * k }, chest: { ry: -0.25 * k }, head: { rx: -0.2 * k } };
    },
    24,
    (t) => ({ tails: { rx: 0.25 + 0.15 * sin(t, 2) }, armR: { rx: -0.25 }, foreR: { rx: -0.6 + 0.3 * sin(t) } }),
  ));
  return { geo: sc.build({ ao: 0.6 }), rig };
}

const cache = new Map<string, SculptModel>();
const BUILDERS: Record<string, Builder> = { carny, strongman, fortune_teller: fortuneTeller, ride_operator: rideOperator, lost_child: lostChild, ringleader };

export function characterModel(id: string): SculptModel {
  let m = cache.get(id);
  if (!m) {
    m = (BUILDERS[id] ?? carny)();
    cache.set(id, m);
  }
  return m;
}

export const CHARACTER_IDS = Object.keys(BUILDERS);

export const _unused = { snap, smoothShape, cos, rbox };
