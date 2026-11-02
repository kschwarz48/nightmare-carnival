// The Fun House's monsters (D-63): SDF sculpts on their own skeletons, like the first map's crowd
// (creatures.ts), each with a locomotion clip and the wind-up/attack clip the sim's telegraph drives.
// Porcelain that moves in snaps, a chrome copy of a person, a figure of broken glass, a marionette on
// strings, a lobed blob of too many faces, a clown stretched by a mirror, a hooded thief with a hand mirror.
// Since D-89 the six figures are built in layers on the character art standard
// (docs/CHARACTER_ART_QUALITY_STANDARD.md), on the same skeletons, at the same sizes, with the same clips.

import * as THREE from 'three';
import { C, SURF, cone, cyl, ellipsoid, rbox, sphere, torus, tube, type ColorFn, type V3 } from '../core/geo';
import { PAL } from './kit';
import { Sculpt, layered, type Shape } from '../sculpt/sdf';
import { CREATURE, FAM, LAYER, SIDES, across, along, armShell, flat, joints, legShell, neckShell, ring, styleFace, styleHair, styleHand, styleHead, styleShoe, surfaceAt, torsoShell, vertical } from '../sculpt/figure';
import { frontZ } from '../sculpt/realism';
import { Rig, type BoneDef, type ClipDef, ease, mix, pulse, sin, cos, snap, TAU } from '../sculpt/rig';
import { ADULT, GAIT_WALK, type Gait, gaitPose, humanBones, scaleP } from '../sculpt/humanoid';
import type { SculptModel } from './characters';

type Clips = Record<string, ClipDef>;
const bi = (bones: BoneDef[]) => (n: string) => {
  const i = bones.findIndex((x) => x.name === n);
  if (i < 0) throw new Error(`no bone ${n}`);
  return i;
};
const glowEye = (sc: Sculpt, bone: number, pos: V3, r: number, col: number, emit = 1.3) => sc.detail(sphere(r, 10, 8), { col, bone, pos, emit, surf: SURF.glass });

/** chrome: a cold silver with the room's lights streaked across it (a tint per garment) */
const chrome = (base: number): ColorFn => (p) => C(base).multiplyScalar(0.55 + 0.55 * Math.abs(Math.sin(p.y * 0.35 + p.x * 0.12)));
const METAL: [number, number] = [0.3, 0.85];

/** A box from a to b, `w` × `d` across, turned `twist` about its own axis and tapered by `tx` toward b. */
function prism(a: V3, b: V3, w: number, d: number, o: { twist?: number; tx?: number; r?: number } = {}): Shape {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.twist ?? Math.PI / 4));
  const e = new THREE.Euler().setFromQuaternion(q);
  const c = A.add(B).multiplyScalar(0.5);
  return { t: 'box', c: [c.x, c.y, c.z], h: [w, len / 2, d], r: o.r ?? 0.3, rot: [e.x, e.y, e.z], tx: o.tx };
}

// ================================================================== Grinning Mannequin
function mannequin(): SculptModel {
  // D-89, in layers: a shop-window dummy in glossy porcelain — an egg of a head under moulded, painted marcel
  // waves, painted almond eyes and rosy cheeks, a painted grin far too wide, a crack across the brow; a
  // dress-form torso screwed together at the waist; every limb a separate piece on a dark lacquered ball
  // joint; the shop tag still on its wrist. The same skeleton, size and snapping re-poses.
  const P = scaleP(ADULT, 1.02, { headR: 11, chestW: 11.5, waistW: 8.5, hipW: 10, arm: [3.4, 2.9, 2.4], leg: [4.4, 3.4, 2.8], stance: 6, depth: 0.72 });
  const bones = humanBones(P);
  const b = bi(bones);
  // (tight joint bands: porcelain pieces stay rigid; the balls between them bend)
  const head = new Sculpt(1.4, 1.2, 0.5), hair = new Sculpt(1.5, 1.2, 0.5), shell = new Sculpt(1.8, 1.2, 0.5), balls = new Sculpt(1.6, 1.2, 0.5);
  const POR = 0xe6decf, BALL = 0x4a3428;
  const r = P.headR, y = P.headY;
  const po = { col: POR, surf: SURF.porcelain };
  // ---- the head: an egg with a small chin and a nose to speak of, no ears
  head.add({ t: 'ell', c: [0, y + r * 0.1, -r * 0.04], r: [r * 0.82, r * 1.04, r * 0.9] }, { ...po, bone: b('head'), k: 1 });
  head.add({ t: 'ell', c: [0, y - r * 0.5, r * 0.14], r: [r * 0.5, r * 0.46, r * 0.6] }, { ...po, bone: b('head'), k: 2 });
  head.add({ t: 'cap', a: [0, y + r * 0.06, r * 0.8], b: [0, y - r * 0.16, r * 0.92], ra: r * 0.07, rb: r * 0.1 }, { ...po, bone: b('head'), k: 0.6 });
  neckShell(head, P, b, po, 0.3);
  const fz = (x: number, yy: number) => frontZ(head, x, yy);
  // painted: almond eyes and thin arched brows, rosy cheeks, and a red grin from cheek to cheek over painted teeth
  styleFace(head, P, b('head'), { iris: 0x2a1a14, sclera: 0xf4eee2, size: 0.17, spread: 0.32, y: 0.12, brow: 0x3a2418, browW: 0.8, browTilt: 0.3, lid: 0x1a1210, mouthW: 0 });
  for (const s of [1, -1]) {
    const cx = s * r * 0.5, cy = y - r * 0.16;
    head.detail(cyl(r * 0.15, r * 0.15, 0.2, 14), { col: 0xd88a80, bone: b('head'), pos: [cx, cy, fz(cx, cy) + 0.05], rot: [Math.PI / 2, 0, -s * 0.55], surf: SURF.porcelain, ink: false });
  }
  const gw = r * 0.6, gy = y - r * 0.4;
  const lip = (lift: number, dy: number) => [-1, -0.66, -0.33, 0, 0.33, 0.66, 1].map((u): V3 => {
    const x = u * gw, yy = gy + u * u * lift + dy;
    return [x, yy, fz(x, yy) + 0.12];
  });
  head.detail(tube(lip(r * 0.24, 0), r * 0.06, 5, 20), { col: 0xa8262a, bone: b('head'), surf: FAM.latex, ink: false });
  head.detail(tube(lip(r * 0.16, -r * 0.2), r * 0.06, 5, 20), { col: 0xa8262a, bone: b('head'), surf: FAM.latex, ink: false });
  for (let i = 0; i < 9; i++) {
    const u = -0.8 + i * 0.2, x = u * gw, yy = gy + u * u * r * 0.2 - r * 0.1;
    head.detail(rbox(r * 0.1, r * 0.13, 0.3, 0.05, 1), { col: 0xf2ecdc, bone: b('head'), pos: [x, yy, fz(x, yy) + 0.06], rot: [0, Math.asin(Math.max(-0.9, Math.min(0.9, x / (r * 0.8)))), 0], surf: SURF.porcelain, ink: false });
  }
  const crack = ([[0.08, 1.0], [0.24, 0.78], [0.16, 0.62], [0.36, 0.48], [0.3, 0.38]] as const).map(([u, v]): V3 => [u * r, y + v * r, fz(u * r, y + v * r) + 0.04]);
  head.detail(tube(crack, 0.2, 4, 12), { col: 0x3a2a24, bone: b('head'), surf: SURF.paint, ink: false });
  // ---- moulded hair, painted a glossy dark brown: finger waves at the sides and a parting
  const hc = { col: vertical(0x24140c, 0x5a3420, y, y + r * 1.25), bone: b('head'), surf: [0.32, 0] as [number, number] };
  hair.add({ t: 'ell', c: [0, y + r * 0.5, -r * 0.24], r: [r * 0.9, r * 0.72, r * 0.94] }, { ...hc, k: 1 });
  for (const s of [1, -1]) for (const [dy, dz] of [[0.66, 0.12], [0.34, -0.16]] as const) {
    hair.add({ t: 'ell', c: [s * r * 0.62, y + r * dy, r * dz], r: [r * 0.3, r * 0.15, r * 0.48], rot: [0.3, s * 0.4, s * 0.55] }, { ...hc, k: 0.6 });
  }
  hair.add({ t: 'cap', a: [r * 0.32, y + r * 1.1, r * 0.2], b: [r * 0.4, y + r * 1.08, -r * 0.7], ra: 0.75, rb: 0.6 }, { sub: true, k: 0.4 });
  // ---- the body: a dress-form torso, every limb a separate piece
  torsoShell(shell, P, b, 0, po, { shoulders: false, k: 0.6 });
  for (const s of [1, -1]) shell.add({ t: 'sph', c: [s * (P.shoulderX - 3.7), P.shoulderY - 0.8, 0], r: 3.4 }, { ...po, bone: b('chest'), k: 1.5 });
  for (const [s, n] of SIDES) {
    const { sh, el, wr, kn, an } = joints(P, s);
    armShell(shell, P, b, s, 0, po, { from: 0.18, to: 0.86 });
    armShell(shell, P, b, s, 0, po, { from: 1.14, to: 1.94 });
    legShell(shell, P, b, s, 0, po, { from: 0.06, to: 0.87 });
    legShell(shell, P, b, s, 0, po, { from: 1.13, to: 2 });
    styleHand(shell, wr, s, P.arm[2], POR, b(`hand${n}`), SURF.porcelain);
    styleShoe(shell, [an[0], P.ankle, 0], 10, POR, b(`foot${n}`), { surf: SURF.porcelain, sole: C(POR).multiplyScalar(0.86).getHex(), toeUp: 0.02 });
    // dark lacquered ball joints at the shoulder, elbow and knee
    const bl = { col: BALL, surf: FAM.leather, k: 0.3 };
    balls.add({ t: 'sph', c: sh, r: P.arm[0] + 0.1 }, { ...bl, bone: b(`arm${n}`) });
    balls.add({ t: 'sph', c: el, r: P.arm[1] + 0.25 }, { ...bl, bone: b(`fore${n}`) });
    balls.add({ t: 'sph', c: kn, r: P.leg[1] + 0.45 }, { ...bl, bone: b(`shin${n}`) });
  }
  // the waist, where the two halves screw together
  const sy = P.waist - 2.6, sx = surfaceAt(shell, [0, sy, 0.4], [1, 0, 0], 13)[0], sz = surfaceAt(shell, [0, sy, 0.4], [0, 0, 1], 13)[2] - 0.4;
  balls.detail(torus(sx + 0.1, 0.6, 6, 28), { col: BALL, bone: b('spine'), pos: [0, sy, 0.4], rot: [Math.PI / 2, 0, 0], scale: [1, sz / sx, 1], surf: FAM.leather, ink: false });
  // the shop tag on its string
  const { wr } = joints(P, 1);
  balls.detail(cyl(0.12, 0.12, 4, 3), { col: 0xd8d0c0, bone: b('handL'), pos: [wr[0] + 1.6, wr[1] - 2.4, wr[2] + 1], rot: [0, 0, 0.35], surf: SURF.cloth });
  balls.detail(rbox(2.4, 3.4, 0.3, 0.3, 1), { col: 0xeadfc2, bone: b('handL'), pos: [wr[0] + 2.4, wr[1] - 5.6, wr[2] + 1.3], rot: [0.2, 0.5, 0.25], surf: SURF.paint, ink: true });
  const gait: Gait = { ...GAIT_WALK, stride: 0.65, knee: 0.3, bob: 0.5, sway: 0, twist: 0.05, squash: 0, arm: 0.65, elbow: 0.05, headBob: 0 };
  const clips: Clips = {
    // it doesn't walk, it re-poses: snaps between stiff shop-window attitudes, faster than a body should
    move: { frames: 32, fn: (t) => mix(gaitPose(snap(t, 4), gait), { head: { rz: 0.35 * sin(snap(t, 2)), ry: 0.25 * cos(snap(t, 4)) }, chest: { rx: 0.15 } }) },
    attack: { frames: 16, loop: false, fn: (t) => {
      const k = ease(snap(t, 3));
      return { armL: { rx: -1.6 * k, rz: 0.2 }, armR: { rx: -1.6 * k, rz: -0.2 }, foreL: { rx: -0.2 }, foreR: { rx: -0.2 }, head: { rx: -0.3 * k, rz: 0.4 * k }, chest: { rx: 0.3 * k } };
    } },
  };
  const geo = layered([{ sc: head, o: LAYER.hard }, { sc: hair, o: LAYER.hard }, { sc: shell, o: LAYER.hard }, { sc: balls, o: LAYER.hard }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== Doppelganger
function doppelganger(): SculptModel {
  // D-89, in layers: a chrome copy of a person — the hair, the ears, a jacket and trousers, a collar and tie, the
  // shoes, all poured in silver with the room's lights streaked across them; a face like a dark window with blank
  // glowing eyes, and a crack running from the crown to the jaw. The same skeleton, size and lunge.
  const P = scaleP(ADULT, 0.98, { headR: 11.5, chestW: 11.5, waistW: 9.5, hipW: 10, stance: 6.5 });
  const bones = humanBones(P);
  const b = bi(bones);
  const skin = new Sculpt(1.5, 3, 0.5), hair = new Sculpt(1.7, 3, 0.5), shirt = new Sculpt(2, 3.5, 0.5), jacket = new Sculpt(1.9, 4, 0.5);
  const legs = new Sculpt(2.1, 4, 0.5), shoes = new Sculpt(1.9, 3, 0.5);
  const r = P.headR, y = P.headY;
  const sk = { col: chrome(0xd2dee8), surf: METAL };
  // ---- skin: a face, the neck, the hands
  styleHead(skin, P, b('head'), sk.col, { jaw: 0.95, nose: 0.9, brow: 0.9 });
  neckShell(skin, P, b, sk);
  for (const [s, n] of SIDES) styleHand(skin, joints(P, s).wr, s, P.arm[2], sk.col, b(`hand${n}`), METAL);
  styleFace(skin, P, b('head'), { iris: 0xe8faff, sclera: 0xbfe8ff, glow: 1.6, size: 0.18, lid: 0x4a5866, brow: 0x5a6878, mouth: 0x1e2630, mouthW: 0.8 });
  const fz = (x: number, yy: number) => frontZ(skin, x, yy);
  const crack = ([[0.1, 1.02], [0.22, 0.7], [0.12, 0.45], [0.2, 0.2], [0.12, -0.05], [0.3, -0.35], [0.22, -0.7]] as const).map(([u, v]): V3 => [u * r, y + v * r, fz(u * r, y + v * r) + 0.05]);
  skin.detail(tube(crack, 0.24, 4, 16), { col: 0x0c1016, bone: b('head'), surf: SURF.glass, ink: false });
  // ---- hair, combed back
  styleHair(hair, P, b('head'), 0x6a7686, { volume: 1.02 });
  // ---- the shirt's collar and tie in the jacket's V (its body hidden under the jacket)
  torsoShell(shirt, P, b, 0.3, { col: chrome(0xdce6ee), surf: METAL, ink: false }, { hips: false, shoulders: false });
  ring(shirt, [0, P.neck - 2.6, 0.2], r * 0.4, 0.9, { col: chrome(0xdce6ee), surf: METAL }, b('chest'));
  const tz = (yy: number) => frontZ(shirt, 0, yy);
  const tie = [P.neck - 3.6, P.chest + 4, P.chest - 2].map((yy): V3 => [0, yy, tz(yy) + 0.5]);
  shirt.detail(tube(tie, (t) => 0.8 + 0.6 * t, 5, 8), { col: 0x3a4656, bone: b('chest'), surf: METAL, ink: false });
  shirt.detail(sphere(1.2, 8, 6), { col: 0x3a4656, bone: b('chest'), pos: [0, P.neck - 3.4, tz(P.neck - 3.4) + 0.6], surf: METAL, ink: false });
  // ---- the jacket: open in a V, buttoned once, cut straight across below the hips
  const jk = { col: chrome(0x8e9aa8), surf: METAL };
  torsoShell(jacket, P, b, 1.1, jk, { k: 0.6 });
  for (const [s, n] of SIDES) {
    armShell(jacket, P, b, s, 0.9, jk, { to: 1.9 });
    ring(jacket, along(joints(P, s).el, joints(P, s).wr, 0.86), P.arm[2] + 1.6, 0.7, jk, b(`fore${n}`));
  }
  const vz = (yy: number) => frontZ(jacket, 0, yy);
  jacket.add({ t: 'cap', a: [0, P.shoulderY + 2, vz(P.shoulderY - 1) - 0.6], b: [0, P.chest - 2, vz(P.chest - 2) - 1.2], ra: 4.4, rb: 2.2 }, { sub: true, k: 0.3 });
  jacket.add({ t: 'box', c: [0, P.hip - 16, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.2 });
  jacket.detail(sphere(0.9, 8, 6), { col: 0x3a4450, bone: b('spine'), pos: [0, P.waist + 1, vz(P.waist + 1) + 0.3], surf: METAL });
  // ---- trousers (their seat under the jacket) and shoes
  const tr = { col: chrome(0x6e7a88), surf: METAL };
  torsoShell(legs, P, b, 0.7, { ...tr, ink: false }, { chest: false });
  for (const [s, n] of SIDES) {
    legShell(legs, P, b, s, 0.7, tr, { flare: 0.4 });
    styleShoe(shoes, [joints(P, s).an[0], P.ankle, 0], 10.5, 0x3a4450, b(`foot${n}`), { surf: METAL, sole: 0x1a2028 });
  }
  const gait: Gait = { ...GAIT_WALK, stride: 0.6, bob: 1.6, arm: 0.5 };
  const clips: Clips = {
    move: { frames: 30, fn: (t) => gaitPose(t, gait) },
    // it gleams, coils, and lunges — the same lunge you would make
    attack: { frames: 16, loop: false, fn: (t) => {
      const coil = ease(Math.min(1, t / 0.6)), go = pulse(t, 0.85, 0.15);
      return { chest: { rx: 0.5 * coil - 0.4 * go }, armL: { rx: -1.2 * coil, rz: 0.6 }, armR: { rx: -1.2 * coil, rz: -0.6 }, thighL: { rx: -0.6 * coil }, thighR: { rx: 0.5 * coil }, head: { rx: -0.2 * coil } };
    } },
  };
  const geo = layered([{ sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: shirt, o: LAYER.cloth }, { sc: jacket, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }, { sc: shoes, o: LAYER.hard }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== Glasswalker
function glasswalker(): SculptModel {
  // D-89, in layers: a figure of broken mirror — every limb a long faceted pane, the chest and hips cut panes
  // that don't quite meet, a head that is one tall shard with the room's glow behind it for eyes; splinters
  // standing out of its back, fingers like broken panes, and round its shoulders the broken gilt frame it walked
  // out of. The same skeleton, size and spidery high-step.
  const P = scaleP(ADULT, 1.12, { headR: 8.5, chestW: 9.5, waistW: 6.5, hipW: 7.5, arm: [2.6, 2.2, 1.9], leg: [3, 2.5, 2], stance: 7, depth: 0.55, armOut: 4 });
  const bones = humanBones(P);
  const b = bi(bones);
  // (tight joint bands: panes don't bend)
  const panes = new Sculpt(1.3, 1.2, 0.5);
  const silver = { col: flat(C(0xd8f0ff).lerp(C(0x6a8a90), 0.35)), surf: SURF.glass, emit: 0.12 };
  const deep = { col: flat(C(0xb8d8e0).lerp(C(0x2e4a54), 0.5)), surf: SURF.glass, emit: 0.06 };
  const r = P.headR, y = P.headY;
  // ---- the panes: chest, waist and hips cut and offset; a thin neck
  panes.add({ t: 'box', c: [0, P.chest + 2, 0.4], h: [P.chestW * 0.95, 8, P.chestW * P.depth], r: 0.4, tx: 0.3 }, { ...deep, bone: b('chest'), k: 0.2 });
  panes.add({ t: 'box', c: [0.6, P.waist, 0.2], h: [P.waistW, 5.6, P.waistW * P.depth], r: 0.4, tx: 0.25, rot: [0, 0.15, 0.08] }, { ...silver, bone: b('spine'), k: 0.2 });
  panes.add({ t: 'box', c: [0, P.hip + 0.5, 0], h: [P.hipW, 4.4, P.hipW * P.depth], r: 0.4, tx: -0.3, rot: [0, -0.1, 0] }, { ...deep, bone: b('hips'), k: 0.2 });
  panes.add(prism([0, P.shoulderY + 2, 0], [0, P.neck + 3, 0.4], 1.7, 1.7), { ...silver, bone: b('neck'), k: 0.2 });
  // ---- limbs: long faceted panes, a gap at every joint
  for (const [s, n] of SIDES) {
    const { sh, el, wr, hp, kn, an } = joints(P, s);
    panes.add({ t: 'box', c: [s * (P.shoulderX - 2.6), P.shoulderY + 0.4, 0], h: [3.6, 2.2, 2.6], r: 0.4, rot: [0, 0, -s * 0.35] }, { ...silver, bone: b('chest'), k: 0.2 });
    panes.add(prism(along(sh, el, 0.08), along(sh, el, 0.94), P.arm[0], P.arm[0] * 0.7, { tx: -0.25 }), { ...silver, bone: b(`arm${n}`), k: 0.2 });
    panes.add(prism(along(el, wr, 0.06), along(el, wr, 0.98), P.arm[1], P.arm[1] * 0.7, { tx: -0.25, twist: 0.5 }), { ...deep, bone: b(`fore${n}`), k: 0.2 });
    panes.add(prism(along(hp, kn, 0.02), along(hp, kn, 0.95), P.leg[0], P.leg[0] * 0.75, { tx: -0.3 }), { ...silver, bone: b(`thigh${n}`), k: 0.2 });
    panes.add(prism(along(kn, an, 0.05), [an[0], 2.2, an[2] + 0.6], P.leg[1], P.leg[1] * 0.75, { tx: -0.4, twist: 0.5 }), { ...deep, bone: b(`shin${n}`), k: 0.2 });
    // a pointed foot of glass, and the hand: a pane with long shard fingers
    panes.add(prism([an[0], 2.4, -1.2], [an[0], 1.2, 6.5], 2.4, 1.6, { tx: -0.6, twist: 0 }), { ...silver, bone: b(`foot${n}`), k: 0.2 });
    panes.add(prism(wr, [wr[0] + s * 0.3, wr[1] - 4.2, wr[2] + 0.6], 2.2, 1.2, { tx: -0.2, twist: 0.3 }), { ...silver, bone: b(`hand${n}`), k: 0.2 });
    for (let k = 0; k < 3; k++) panes.detail(cone(0.9, 10, 4), { col: 0xd8f0ff, bone: b(`hand${n}`), pos: [wr[0] + s * 0.3 + (k - 1) * 1.5, wr[1] - 9, wr[2] + 1.2], rot: [Math.PI, 0, (k - 1) * 0.22], surf: SURF.glass, ink: true });
  }
  // ---- the head: one tall shard, the room's glow behind it for eyes
  const shardC = { col: vertical(0x9ab8c0, 0xeaf8ff, y - 4, y + 14), surf: SURF.glass, emit: 0.15, bone: b('head') };
  panes.add({ t: 'box', c: [0, y + 6, 0], h: [r * 0.6, r * 1.1, r * 0.34], r: 0.3, tx: -0.88, rot: [0.08, 0.35, 0.1] }, { ...shardC, k: 0.2 });
  panes.add({ t: 'box', c: [0.3, y - 2.2, 0.3], h: [r * 0.5, r * 0.5, r * 0.32], r: 0.3, tx: 0.6, rot: [0.08, 0.35, 0.1] }, { ...shardC, k: 0.4 });
  for (const s of [1, -1]) glowEye(panes, b('head'), [s * 2.2, y + 1.6, frontZ(panes, s * 2.2, y + 1.6) - 0.2], 1.15, 0x7dffd8, 2.2);
  // splinters standing out of its back and shoulders, every one a sliver of some room it has been in
  const shards: [string, V3, V3, number][] = [['chest', [4, P.chest + 6, -5.5], [0.6, 0, 0.4], 12], ['chest', [-5, P.chest + 4, -5], [0.5, 0, -0.5], 11], ['chest', [0, P.shoulderY + 3, -6], [0.9, 0, 0], 14], ['chest', [-2, P.chest - 2, -5], [0.7, 0, -0.2], 9], ['armL', [P.shoulderX + 1.5, P.shoulderY + 4, 0], [0, 0, -0.7], 10], ['armR', [-P.shoulderX - 1.5, P.shoulderY + 4, 0], [0, 0, 0.7], 10], ['hips', [0, P.hip + 2, -4.5], [1, 0, 0], 9]];
  for (const [bn, p, rt, h] of shards) panes.detail(cone(2.2, h, 4), { col: 0xe8f8ff, bone: b(bn), pos: p, rot: rt, surf: SURF.glass, emit: 0.25 });
  // ---- the gilt frame it walked out of, broken, hanging round its shoulders
  panes.detail(torus(P.chestW + 1.6, 1.1, 6, 18, Math.PI * 0.85), { col: 0xb08a3a, bone: b('chest'), pos: [0, P.shoulderY + 1.2, -0.6], rot: [Math.PI / 2, 0, Math.PI * 1.08], scale: [1, 0.7, 1], surf: FAM.gold });
  panes.detail(torus(P.chestW + 1.6, 0.45, 4, 18, Math.PI * 0.85), { col: 0xd8b860, bone: b('chest'), pos: [0, P.shoulderY + 2.2, -0.6], rot: [Math.PI / 2, 0, Math.PI * 1.08], scale: [1, 0.7, 1], surf: FAM.gold, ink: false });
  const gait: Gait = { ...GAIT_WALK, stride: 0.7, knee: 1, bob: 1, twist: 0.2, arm: 0.2, elbow: 0.6, armOut: 0.4, lift: 0.4 };
  const clips: Clips = {
    // a spidery high-stepping walk with its elbows up
    move: { frames: 36, fn: (t) => mix(gaitPose(t, gait), { head: { rz: 0.15 * sin(t, 2) }, chest: { rx: 0.25 } }) },
    // it rears back, both arms raised, and slashes down
    attack: { frames: 18, loop: false, fn: (t) => {
      const up = ease(Math.min(1, t / 0.7)), down = pulse(t, 0.85, 0.15);
      return { armL: { rx: -2.4 * up + 2 * down, rz: 0.5 }, armR: { rx: -2.4 * up + 2 * down, rz: -0.5 }, foreL: { rx: -0.6 * up }, foreR: { rx: -0.6 * up }, chest: { rx: -0.3 * up + 0.5 * down }, head: { rx: -0.2 * up } };
    } },
  };
  return { geo: panes.build(LAYER.hard), rig: new Rig(bones, clips) };
}

// ================================================================== Marionette
function marionette(): SculptModel {
  // D-89, in layers: a carved puppet — a round wooden head with painted hair and a forelock, a long nose, painted
  // eyes and red cheeks, the jaw on its hinge with the lines carved down to the chin, a brass eye on the crown for
  // the string; a wine velvet doublet with puffed sleeves, gold trim and a peplum; dark puffed breeches; bare
  // turned shins on ball knees; pointed black shoes; a tattered lace ruff. Its strings as before; the same
  // skeleton, size and dangling.
  const P = scaleP(ADULT, 0.88, { headR: 11, chestW: 9.5, waistW: 7.5, hipW: 8.5, arm: [2.6, 2.4, 2.2], leg: [3, 2.7, 2.4], stance: 5.5, depth: 0.7 });
  const bones = humanBones(P);
  const b = bi(bones);
  const wood = new Sculpt(1.45, 1.4, 0.5), paint = new Sculpt(1.6, 1.4, 0.5), doublet = new Sculpt(2, 2.5, 0.5), breeches = new Sculpt(2.1, 2.5, 0.5);
  const ruff = new Sculpt(1.5, 2, 0.5), shoes = new Sculpt(1.7, 2, 0.5);
  const WOOD = 0xc49a6c, VELVET = 0x8a2434, GOLD = 0xc49a48, DARK = 0x2a2440;
  const r = P.headR, y = P.headY;
  const wd = { col: WOOD, surf: FAM.wood };
  // ---- wood: the head, jaw and nose, the neck, mitten hands, turned shins and a ball at elbow and knee
  wood.add({ t: 'ell', c: [0, y + r * 0.08, 0], r: [r * 0.9, r * 0.96, r * 0.9] }, { ...wd, bone: b('head'), k: 1 });
  wood.add({ t: 'box', c: [0, y - r * 0.5, r * 0.16], h: [r * 0.56, r * 0.34, r * 0.56], r: r * 0.22 }, { ...wd, bone: b('head'), k: 0.8 });
  wood.add({ t: 'cap', a: [0, y - r * 0.02, r * 0.8], b: [0, y - r * 0.16, r * 1.3], ra: r * 0.14, rb: r * 0.12 }, { ...wd, bone: b('head'), k: 0.6 });
  for (const s of [1, -1]) wood.add({ t: 'ell', c: [s * r * 0.86, y - r * 0.02, -r * 0.04], r: [r * 0.12, r * 0.24, r * 0.18] }, { ...wd, bone: b('head'), k: 0.5 });
  neckShell(wood, P, b, wd, 0.28);
  for (const [s, n] of SIDES) {
    const { el, wr, kn, an } = joints(P, s);
    armShell(wood, P, b, s, 0, wd, { from: 1.12, to: 1.95 });
    legShell(wood, P, b, s, 0, wd, { from: 1.1, to: 2 });
    wood.add({ t: 'sph', c: el, r: P.arm[1] + 0.6 }, { ...wd, bone: b(`fore${n}`), k: 0.3 });
    wood.add({ t: 'sph', c: kn, r: P.leg[1] + 0.8 }, { ...wd, bone: b(`shin${n}`), k: 0.3 });
    wood.add({ t: 'ell', c: [wr[0] + s * 0.3, wr[1] - 3, wr[2] + 0.4], r: [2.2, 3.2, 2.1] }, { ...wd, bone: b(`hand${n}`), k: 0.4 });
    wood.add({ t: 'cap', a: [wr[0] - s * 0.6, wr[1] - 1.6, wr[2] + 1.6], b: [wr[0] - s * 1.2, wr[1] - 3.6, wr[2] + 2.6], ra: 0.9, rb: 0.8 }, { ...wd, bone: b(`hand${n}`), k: 0.3 });
    styleShoe(shoes, [an[0], P.ankle, 0], 9, 0x18141a, b(`foot${n}`), { toeUp: 0.22, width: 0.85, surf: [0.3, 0] });
  }
  const fz = (x: number, yy: number) => frontZ(wood, x, yy);
  // painted: round eyes with a glint, arched brows, red cheeks; the mouth's slot and the jaw's hinge lines
  styleFace(wood, P, b('head'), { iris: 0x14100c, sclera: 0xf0e8d8, size: 0.2, spread: 0.36, y: 0.16, brow: 0x2a1a10, browW: 0.75, browTilt: 0.3, lid: 0x2a1a10, mouthW: 0 });
  for (const s of [1, -1]) {
    const cx = s * r * 0.54, cy = y - r * 0.2;
    wood.detail(cyl(r * 0.17, r * 0.17, 0.25, 14), { col: 0xc04a44, bone: b('head'), pos: [cx, cy, fz(cx, cy) + 0.05], rot: [Math.PI / 2, 0, -s * 0.6], surf: SURF.paint, ink: false });
    const jx = s * r * 0.3, line = ([[jx, y - r * 0.4], [jx * 1.02, y - r * 0.6], [jx * 0.94, y - r * 0.8]] as const).map(([x, yy]): V3 => [x, yy, fz(x, yy) + 0.05]);
    wood.detail(tube(line, 0.3, 4, 8), { col: 0x3a2214, bone: b('head'), surf: SURF.paint, ink: false });
  }
  const my = y - r * 0.42;
  wood.detail(rbox(r * 0.62, r * 0.09, 0.4, 0.15, 1), { col: 0x1a0c08, bone: b('head'), pos: [0, my, fz(0, my) + 0.05], surf: SURF.paint, ink: false });
  wood.detail(torus(0.9, 0.3, 4, 10), { col: PAL.brass, bone: b('head'), pos: [0, y + r * 1.08, 0], rot: [0, Math.PI / 2, 0], surf: FAM.brass });
  // ---- painted hair, carved: a cap of dark brown with a forelock curling onto the brow
  const hc = { col: vertical(0x2a1810, 0x5a3420, y, y + r * 1.1), bone: b('head'), surf: [0.36, 0] as [number, number] };
  paint.add({ t: 'ell', c: [0, y + r * 0.46, -r * 0.2], r: [r * 0.97, r * 0.66, r * 0.92] }, { ...hc, k: 1 });
  paint.add({ t: 'ell', c: [r * 0.42, y + r * 0.66, r * 0.46], r: [r * 0.42, r * 0.2, r * 0.32], rot: [0.25, 0.3, -0.35] }, { ...hc, k: 0.6 });
  // ---- the doublet: velvet, a peplum flaring over the hips, puffed sleeves banded in gold, gold buttons
  const dv = { col: VELVET, surf: SURF.velvet };
  torsoShell(doublet, P, b, 0.9, dv, { hips: false, k: 0.6 });
  doublet.add({ t: 'cap', a: [0, P.waist - 3, 0.3], b: [0, P.hip - 3, 0.3], ra: P.waistW + 1.4, rb: P.hipW + 3, sz: P.depth + 0.1 }, { ...dv, bone: b('hips'), k: 1 });
  doublet.add({ t: 'box', c: [0, P.hip - 13, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.2 });
  doublet.detail(torus(P.hipW + 2.7, 0.6, 5, 28), { col: GOLD, bone: b('hips'), pos: [0, P.hip - 2.4, 0.3], rot: [Math.PI / 2, 0, 0], scale: [1, P.depth + 0.1, 1], surf: FAM.gold, ink: false });
  for (const [s, n] of SIDES) {
    const { sh, el } = joints(P, s);
    doublet.add({ t: 'ell', c: along(sh, el, 0.38), r: [P.arm[0] + 2, 5.6, P.arm[0] + 2] }, { ...dv, bone: b(`arm${n}`), k: 0.8 });
    doublet.detail(torus(P.arm[0] + 0.55, 0.5, 5, 16), { col: GOLD, bone: b(`arm${n}`), pos: along(sh, el, 0.74), rot: across(sh, el), surf: FAM.gold, ink: false });
    armShell(doublet, P, b, s, 0.4, dv, { from: 0.6, to: 1.05 });
  }
  for (let i = 0; i < 4; i++) {
    const by = P.waist - 3 + i * 3.6;
    doublet.detail(sphere(0.8, 8, 6), { col: GOLD, bone: b(i < 2 ? 'spine' : 'chest'), pos: [0, by, frontZ(doublet, 0, by) + 0.3], surf: FAM.gold });
  }
  // ---- puffed breeches to above the knee (their seat under the peplum)
  const bv = { col: DARK, surf: SURF.velvet };
  torsoShell(breeches, P, b, 0.5, { ...bv, ink: false }, { chest: false });
  for (const [s] of SIDES) legShell(breeches, P, b, s, 1.1, bv, { to: 0.82, flare: 0.6 });
  // ---- the ruff: tattered lace round the neck, a gap where two pleats have torn away
  for (let i = 0; i < 14; i++) {
    if (i === 10 || i === 11) continue;
    const a = (i / 14) * TAU, droop = i % 3 === 0 ? 0.75 : 0.3;
    ruff.add({ t: 'ell', c: [Math.cos(a) * 11, P.shoulderY + 2.6 - droop * 1.5, 0.6 + Math.sin(a) * 10.2], r: [3.5, 2.1, 2.7], rot: [0, -a, droop] }, { col: 0xd8d0bc, bone: b('chest'), k: 0.8, surf: FAM.cloth });
  }
  // its strings, rising into the dark from the head and both wrists and knees
  for (const [bn, p] of [['head', [0, P.headY + 12, 0]], ['handL', [P.shoulderX + 3, P.wristY, 1]], ['handR', [-P.shoulderX - 3, P.wristY, 1]], ['shinL', [P.stance, P.knee, 1]], ['shinR', [-P.stance, P.knee, 1]]] as [string, V3][]) {
    shoes.detail(cyl(0.16, 0.16, 90, 3), { col: PAL.bone, bone: b(bn), pos: [p[0], p[1] + 45, p[2]], emit: 0.25, surf: SURF.cloth });
  }
  const clips: Clips = {
    // dangling: knees knocking, feet barely touching, the head lolling on its pin
    move: { frames: 32, fn: (t) => ({ hips: { ty: 3 * Math.abs(sin(t, 2)) }, thighL: { rx: 0.5 * sin(t) }, thighR: { rx: -0.5 * sin(t) }, shinL: { rx: 0.4 + 0.3 * sin(t, 2) }, shinR: { rx: 0.4 - 0.3 * sin(t, 2) }, armL: { rx: -0.3 + 0.6 * cos(t), rz: 0.3 }, armR: { rx: -0.3 - 0.6 * cos(t), rz: -0.3 }, head: { rz: 0.35 * sin(t), rx: 0.2 } }) },
    // yanked up: every limb jerks toward its string at once
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(snap(t, 2));
      return { armL: { rx: -2.6 * k, rz: 0.4 }, armR: { rx: -2.6 * k, rz: -0.4 }, thighL: { rx: -1 * k }, thighR: { rx: -1 * k }, shinL: { rx: 1.4 * k }, shinR: { rx: 1.4 * k }, head: { rx: -0.4 * k } };
    } },
  };
  const geo = layered([{ sc: wood, o: LAYER.hard }, { sc: paint, o: LAYER.hard }, { sc: doublet, o: LAYER.cloth }, { sc: breeches, o: LAYER.cloth }, { sc: ruff, o: LAYER.cloth }, { sc: shoes, o: LAYER.hard }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== Splitter
function splitter(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 12, 0] },
    { name: 'lobeL', parent: 'body', head: [10, 18, 2] },
    { name: 'lobeR', parent: 'body', head: [-10, 18, 2] },
    { name: 'top', parent: 'body', head: [0, 28, 0] },
    { name: 'jaw', parent: 'body', head: [0, 12, 12] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1.7, 4);
  // flesh like a funhouse reflection of a person: pinched, swollen, pink going bruise-purple
  // raw pink, bruise-dark toward the floor
  const flesh = vertical(C(0xd98a92).lerp(C(0x5a1e34), 0.6).getHex(), C(0xd98a92).lerp(C(0x5a1e34), 0.15).getHex(), 2, 32);
  sc.add({ t: 'ell', c: [0, 13, 0], r: [17, 13, 15] }, { col: flesh, bone: b('body'), k: 0, surf: SURF.skin });
  sc.add({ t: 'ell', c: [11, 20, 2], r: [9, 10, 9] }, { col: flesh, bone: b('lobeL'), k: 6, surf: SURF.skin });
  sc.add({ t: 'ell', c: [-11, 19, 1], r: [9.5, 11, 9] }, { col: flesh, bone: b('lobeR'), k: 6, surf: SURF.skin });
  sc.add({ t: 'ell', c: [1, 29, -1], r: [8, 7, 8] }, { col: flesh, bone: b('top'), k: 6, surf: SURF.skin });
  // a seam down the middle where it will come apart
  sc.add({ t: 'box', c: [0, 18, 13], h: [0.6, 10, 1.4], r: 0.4 }, { sub: true, k: 1.2 });
  // eyes everywhere, at the wrong sizes
  for (const [bn, p, r] of [['lobeL', [12, 23, 9], 2.6], ['lobeL', [16, 17, 6], 1.6], ['lobeR', [-12, 22, 9], 3], ['top', [3, 31, 6], 1.8], ['body', [-4, 15, 14], 1.4], ['body', [7, 10, 13], 1.2]] as [string, V3, number][]) {
    sc.detail(sphere(r, 10, 8), { col: PAL.bone, bone: b(bn), pos: p, surf: SURF.porcelain });
    sc.detail(sphere(r * 0.5, 8, 6), { col: PAL.ink, bone: b(bn), pos: [p[0], p[1], p[2] + r * 0.62], surf: SURF.glass });
  }
  // a mouth that wanders across the front
  sc.add({ t: 'ell', c: [0, 9, 13.5], r: [8, 2.6, 3] }, { sub: true, k: 1 });
  for (let i = 0; i < 7; i++) sc.detail(cone(0.9, 2.6, 4), { col: PAL.bone, bone: b('jaw'), pos: [-6 + i * 2, 10.2, 13.6], rot: [Math.PI, 0, 0], surf: SURF.porcelain });
  const clips: Clips = {
    // it wobbles forward, lobes bulging out of step
    move: { frames: 28, fn: (t) => ({ body: { sy: 1 - 0.08 * sin(t, 2), sx: 1 + 0.06 * sin(t, 2) }, lobeL: { sx: 1 + 0.12 * sin(t), sy: 1 + 0.1 * sin(t) }, lobeR: { sx: 1 - 0.12 * sin(t), sy: 1 - 0.1 * sin(t) }, top: { ty: 1.4 * sin(t, 2, 0.25) }, jaw: { rx: 0.15 * Math.abs(sin(t, 2)) } }) },
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = pulse(t, 0.5, 0.5);
      return { body: { sx: 1 + 0.18 * k, sy: 1 - 0.12 * k }, lobeL: { tx: 2 * k }, lobeR: { tx: -2 * k }, jaw: { rx: 0.5 * k } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Crooked Clown
function crookedClown(): SculptModel {
  // D-89, in layers: a performer a mirror stretched — legs and neck far too long, a small long face in white
  // greasepaint with violet diamonds through the eyes, a red nose and a crooked red smile, two tufts of orange
  // hair under a tiny cocked top hat; a tight cream suit hooped in violet (per pixel) with ruffled cuffs, a ruff
  // at the base of the long neck, teal tights over knobbly knees, white gloves, long red shoes curling up; a
  // juggling pin in each hand. The same skeleton, size and lurch.
  const P = scaleP(ADULT, 1.05, { hip: 48, knee: 26, waist: 56, chest: 66, shoulderY: 73, elbowY: 57, wristY: 43, neck: 80, headY: 89, headR: 8.5, chestW: 9.5, waistW: 8, hipW: 9, arm: [2.8, 2.4, 2.1], leg: [3.4, 2.8, 2.4], stance: 5.5, depth: 0.7 });
  const bones = humanBones(P);
  const b = bi(bones);
  const face = new Sculpt(1.15, 3, 0.5), hair = new Sculpt(1.4, 3, 0.5), suit = new Sculpt(2, 4, 0.5), tights = new Sculpt(1.8, 3.5, 0.5);
  const ruff = new Sculpt(1.5, 3, 0.5), gloves = new Sculpt(1.5, 3, 0.5), shoes = new Sculpt(1.8, 3, 0.5);
  const PAINT = 0xe8e2d4, VIOLET = 0x5a2a8a, RED = 0xb01e22;
  const r = P.headR, y = P.headY;
  const fs = { col: PAINT, surf: FAM.greasepaint };
  // ---- the face: long, a pointed chin, high cheekbones; the long neck
  face.add({ t: 'ell', c: [0, y + r * 0.12, -r * 0.04], r: [r * 0.88, r * 1.1, r * 0.92] }, { ...fs, bone: b('head'), k: 1.2 });
  face.add({ t: 'ell', c: [0, y - r * 0.62, r * 0.2], r: [r * 0.46, r * 0.5, r * 0.56] }, { ...fs, bone: b('head'), k: 2 });
  for (const s of [1, -1]) {
    face.add({ t: 'ell', c: [s * r * 0.5, y - r * 0.12, r * 0.55], r: [r * 0.28, r * 0.22, r * 0.24] }, { ...fs, bone: b('head'), k: 1.2 });
    face.add({ t: 'ell', c: [s * r * 0.9, y - r * 0.02, -r * 0.04], r: [r * 0.13, r * 0.26, r * 0.18] }, { ...fs, bone: b('head'), k: 0.6 });
  }
  face.add({ t: 'cap', a: [0, P.shoulderY + 1, 0], b: [0, P.neck + 3.4, 0.4], ra: r * 0.34, rb: r * 0.3 }, { ...fs, bone: b('neck'), k: 1.2 });
  const fz = (x: number, yy: number) => frontZ(face, x, yy);
  styleFace(face, P, b('head'), { iris: 0x2a1a30, sclera: 0xf2ece0, size: 0.2, spread: 0.36, y: 0.12, brow: 0x1a1020, browW: 0.8, browTilt: 0.35, lid: 0x2a1a30, mouthW: 0 });
  for (const s of [1, -1]) {
    const ex = s * r * 0.36, ey = y + r * 0.12;
    face.detail(rbox(r * 0.24, r * 0.72, 0.3, 0.1, 1), { col: VIOLET, bone: b('head'), pos: [ex, ey, fz(ex, ey) - 0.15], rot: [0, s * 0.32, Math.PI / 4], surf: FAM.greasepaint, ink: false });
  }
  face.detail(sphere(r * 0.2, 12, 8), { col: RED, bone: b('head'), pos: [0, y - r * 0.12, fz(0, y - r * 0.12) + r * 0.08], surf: FAM.latex, ink: false });
  const smile = [-1, -0.5, 0, 0.5, 1].map((u): V3 => {
    const x = u * r * 0.46, yy = y - r * 0.5 + u * u * r * 0.12 + u * r * 0.14;
    return [x, yy, fz(x, yy) + 0.1];
  });
  face.detail(tube(smile, r * 0.07, 5, 14), { col: RED, bone: b('head'), surf: FAM.latex, ink: false });
  // ---- two tufts of orange hair, and a tiny top hat cocked over one eye
  for (const s of [1, -1]) for (const [dy, dz, rr] of [[0.15, -0.1, 0.34], [-0.15, -0.2, 0.3], [0.38, -0.3, 0.28]] as const) {
    hair.add({ t: 'sph', c: [s * r * 0.92, y + r * dy, r * dz], r: r * rr }, { col: vertical(0xa8361a, 0xe0682a, y - r * 0.4, y + r * 0.6), bone: b('head'), k: 0.8, surf: FAM.hair });
  }
  hair.detail(cyl(r * 0.42, r * 0.48, r * 0.8, 16), { col: 0x14121a, bone: b('head'), pos: [r * 0.22, y + r * 1.42, -r * 0.05], rot: [-0.12, 0, -0.38], surf: [0.4, 0] });
  hair.detail(cyl(r * 0.5, r * 0.5, r * 0.14, 16), { col: VIOLET, bone: b('head'), pos: [r * 0.16, y + r * 1.15, -r * 0.03], rot: [-0.12, 0, -0.38], surf: FAM.cloth });
  hair.detail(cyl(r * 0.8, r * 0.8, r * 0.08, 18), { col: 0x14121a, bone: b('head'), pos: [r * 0.12, y + r * 1.05, -r * 0.02], rot: [-0.12, 0, -0.38], surf: [0.4, 0] });
  // ---- the suit: tight, long, cream hooped in violet, ruffled violet cuffs
  const hoops = { col: 0xe8dcc0, surf: FAM.cloth, pat: { kind: 'bands', col: VIOLET, a: 12, b: 0.5, c: 0.0833 } as const };
  torsoShell(suit, P, b, 0.7, hoops, { k: 0.6 });
  for (const [s, n] of SIDES) {
    armShell(suit, P, b, s, 0.6, hoops, { to: 1.88 });
    const { el, wr } = joints(P, s);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, c = along(el, wr, 0.9);
      suit.add({ t: 'ell', c: [c[0] + Math.cos(a) * (P.arm[2] + 1.8), c[1], c[2] + Math.sin(a) * (P.arm[2] + 1.8)], r: [1.8, 1.2, 1.8] }, { col: VIOLET, surf: FAM.cloth, bone: b(`fore${n}`), k: 0.6 });
    }
  }
  // ---- teal tights over knobbly knees (the seat under the suit)
  const tl = { col: 0x2a8a7a, surf: FAM.cloth };
  for (const [s, n] of SIDES) {
    legShell(tights, P, b, s, 0.25, tl);
    tights.add({ t: 'sph', c: joints(P, s).kn, r: P.leg[1] + 0.9 }, { ...tl, bone: b(`shin${n}`), k: 1 });
    styleHand(gloves, joints(P, s).wr, s, P.arm[2], 0xece4d6, b(`hand${n}`), FAM.cloth, true);
    styleShoe(shoes, [joints(P, s).an[0], P.ankle, 0], 15, 0x9a1a1e, b(`foot${n}`), { width: 0.95, toeUp: 0.32, surf: FAM.rubber, sole: 0x4a1210 });
  }
  // ---- the ruff at the base of the long neck
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ruff.add({ t: 'ell', c: [Math.cos(a) * 7.4, P.shoulderY + 1.6, 0.6 + Math.sin(a) * 6.6], r: [3, 1.9, 2.3], rot: [0, -a, 0.25] }, { col: 0xeee8dc, bone: b('chest'), k: 0.8, surf: FAM.cloth });
  }
  // juggling pins, one in each hand
  for (const [s, n] of SIDES) {
    const { wr } = joints(P, s);
    gloves.detail(ellipsoid(1.7, 5.2, 1.7, 10, 8), { col: 0xf0ece0, bone: b(`hand${n}`), pos: [wr[0], wr[1] - 3.4, wr[2] + 3], surf: SURF.paint });
    gloves.detail(cyl(0.95, 0.95, 1.4, 10), { col: RED, bone: b(`hand${n}`), pos: [wr[0], wr[1] - 1.2, wr[2] + 3], surf: SURF.paint });
    gloves.detail(cyl(0.7, 0.9, 3.6, 8), { col: 0xf0ece0, bone: b(`hand${n}`), pos: [wr[0], wr[1] - 9.6, wr[2] + 3], surf: SURF.paint });
  }
  const gait: Gait = { ...GAIT_WALK, stride: 0.5, knee: 0.9, bob: 2.6, sway: 0.18, twist: 0.2, arm: 0.3, lean: 0.2, lift: 0.5 };
  const clips: Clips = {
    // a lurching sideways skitter, leaning into it
    move: { frames: 30, fn: (t) => mix(gaitPose(t, gait), { chest: { rz: 0.25 + 0.1 * sin(t) }, neck: { rz: -0.3 }, head: { rz: 0.2 * sin(t, 2) } }) },
    // winds a pin back behind his head, and flings it
    attack: { frames: 18, loop: false, fn: (t) => {
      const back = ease(Math.min(1, t / 0.75)), fling = pulse(t, 0.86, 0.14);
      return { armR: { rx: -2.8 * back + 3 * fling, rz: -0.3 }, foreR: { rx: -1.2 * back }, chest: { ry: -0.5 * back + 0.8 * fling, rz: 0.2 }, head: { ry: 0.3 * back } };
    } },
  };
  const geo = layered([{ sc: face, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: suit, o: LAYER.cloth }, { sc: tights, o: LAYER.cloth }, { sc: ruff, o: LAYER.cloth }, { sc: gloves, o: LAYER.cloth }, { sc: shoes, o: LAYER.hard }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== Reflection Thief
function reflectionThief(): SculptModel {
  // D-89, in layers: a thief of reflections in a violet velvet robe to the floor, folds hanging from a capelet,
  // bell sleeves; a deep hood with a pointed tail, nothing inside but dark and two pale
  // lights; long ashen hands; a rope belt hung with the mirror shards it has stolen, still glowing; the gilt
  // hand mirror. The same skeleton, size and glide.
  const P = scaleP(ADULT, 1, { headR: 10.5, chestW: 11, waistW: 10, hipW: 12, stance: 5.5 });
  const bones = humanBones(P);
  const b = bi(bones);
  const robe = new Sculpt(2.2, 4, 0.5), hood = new Sculpt(1.8, 3, 0.5), inner = new Sculpt(1.8, 3, 0.5), hands = new Sculpt(1.5, 3, 0.5);
  // (the belt, its shards and the mirror are crisp details, carried by the hands' layer)
  const belt = hands;
  const r = P.headR, y = P.headY;
  const rv = { col: vertical(0x241a36, 0x4a3868, 4, P.shoulderY), surf: SURF.velvet };
  // ---- the robe: a capelet over the shoulders, bell sleeves, a skirt to the floor hanging in folds
  torsoShell(robe, P, b, 1.4, rv, { k: 0.6 });
  robe.add({ t: 'ell', c: [0, P.shoulderY - 1.5, 0], r: [P.chestW + 4.6, 5.6, (P.chestW + 4.6) * 0.78] }, { ...rv, bone: b('chest'), k: 1 });
  robe.add({ t: 'cap', a: [0, P.hip + 3, 0.2], b: [0, 0, 0.6], ra: P.hipW + 1.6, rb: 16, sz: 0.88 }, { ...rv, bone: b('hips'), k: 1.6 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    robe.add({ t: 'cap', a: [Math.cos(a) * (P.hipW + 1.2), P.hip, 0.4 + Math.sin(a) * (P.hipW + 1.2) * 0.86], b: [Math.cos(a) * 16.2, 0, 0.6 + Math.sin(a) * 14.2], ra: 1.6, rb: 2.6 }, { ...rv, bone: b('hips'), k: 1.2 });
  }
  robe.add({ t: 'box', c: [0, -10, 0], h: [40, 10, 40], r: 0.1 }, { sub: true, k: 0.2 });
  for (const [s] of SIDES) armShell(robe, P, b, s, 1.2, rv, { to: 1.82, flare: 3.4 });
  // ---- the hood: deep, a pointed tail falling down the back
  const hv = { col: vertical(0x2a2040, 0x54407a, y - r, y + r * 1.3), surf: SURF.velvet, bone: b('head') };
  hood.add({ t: 'ell', c: [0, y + 1, -1.2], r: [r * 1.2, r * 1.3, r * 1.26] }, { ...hv, k: 1 });
  hood.add({ t: 'cap', a: [0, y + r * 0.7, -r * 0.7], b: [0, y - r * 0.4, -r * 1.85], ra: r * 0.55, rb: r * 0.16 }, { ...hv, k: 1.2 });
  hood.add({ t: 'ell', c: [0, y - 1, r * 0.95], r: [r * 0.74, r * 0.92, r * 0.62] }, { sub: true, k: 0.8 });
  // nothing inside but the dark and two pale lights
  inner.add({ t: 'ell', c: [0, y - 0.6, r * 0.25], r: [r * 0.78, r * 0.92, r * 0.62] }, { col: 0x06040a, surf: SURF.velvet, bone: b('head'), k: 1, ink: false });
  for (const s of [1, -1]) glowEye(inner, b('head'), [s * 3.4, y, frontZ(inner, s * 3.4, y) - 0.3], 1.3, 0xe8f6ff, 1.8);
  // ---- long ashen hands
  for (const [s, n] of SIDES) styleHand(hands, joints(P, s).wr, s, P.arm[2] * 0.95, 0x9a94a8, b(`hand${n}`), FAM.skin);
  // ---- the rope belt, hung with stolen mirror shards still holding their light (found on the robe's body alone:
  // the hanging sleeves caught a search on the robe)
  const probe = new Sculpt(2.2, 4, 0.5);
  torsoShell(probe, P, b, 1.4, rv, { k: 0.6 });
  probe.add({ t: 'cap', a: [0, P.hip + 3, 0.2], b: [0, 0, 0.6], ra: P.hipW + 1.6, rb: 16, sz: 0.88 }, { ...rv, bone: b('hips'), k: 1.6 });
  const bz = (yy: number) => surfaceAt(probe, [0, yy, 0.4], [0, 0, 1])[2], bx = (yy: number) => surfaceAt(probe, [0, yy, 0.4], [1, 0, 0])[0];
  const by = P.waist - 3, bw = bx(by), bd = bz(by) - 0.4;
  belt.detail(torus(bw + 0.3, 0.75, 6, 30), { col: 0x9a8058, bone: b('spine'), pos: [0, by, 0.4], rot: [Math.PI / 2, 0, 0], scale: [1, bd / bw, 1], surf: FAM.canvas });
  const shardAt: [number, number][] = [[0.5, 0], [1.1, -2], [-0.7, -1], [-1.3, -3]];
  for (const [a, dy] of shardAt) {
    const x = Math.sin(a) * (bw + 0.6), z = 0.4 + Math.cos(a) * (bd + 0.6);
    belt.detail(cyl(0.1, 0.1, 3 - dy * 0.5, 3), { col: 0x9a8058, bone: b('hips'), pos: [x, by - 1.5 + dy * 0.25, z], surf: FAM.canvas });
    belt.detail(cone(1.3, 4.4, 4), { col: 0xc8f0ff, bone: b('hips'), pos: [x, by - 5 + dy * 0.5, z], rot: [Math.PI, a, 0.15], emit: 1.1, surf: SURF.glass, ink: true });
  }
  belt.detail(rbox(3.6, 4, 2, 0.9, 2), { col: 0x5a3a2a, bone: b('hips'), pos: [-bw * 0.7, by - 3, 0.4 + bd * 0.62], rot: [0, -0.7, 0], surf: FAM.leather });
  // the hand mirror: gilt frame, a pane that shows something else
  const hx = P.shoulderX + P.armOut * 1.6;
  belt.detail(cyl(0.9, 0.9, 9, 6), { col: PAL.gold, bone: b('handL'), pos: [hx, P.wristY + 3, 3], surf: SURF.gold });
  belt.detail(torus(5.6, 0.9, 6, 18), { col: PAL.gold, bone: b('handL'), pos: [hx, P.wristY + 12, 3], surf: SURF.gold });
  belt.detail(cyl(5, 5, 0.6, 18), { col: 0xc8f0ff, bone: b('handL'), pos: [hx, P.wristY + 12, 3], rot: [Math.PI / 2, 0, 0], emit: 1.1, surf: SURF.glass });
  const clips: Clips = {
    // it glides, robe swaying, the mirror bobbing like a lantern
    move: { frames: 32, fn: (t) => ({ hips: { ty: 1.5 * sin(t), rz: 0.05 * sin(t) }, chest: { rz: -0.05 * sin(t) }, armL: { rx: -1.3 + 0.1 * sin(t, 2), rz: 0.25 }, foreL: { rx: -0.6 }, armR: { rx: 0.2 * cos(t), rz: -0.15 }, head: { ry: 0.2 * sin(t, 0.5) } }) },
    // raises the mirror high: the decoys step out of it
    attack: { frames: 20, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7));
      return { armL: { rx: -2.6 * k, rz: 0.2 }, foreL: { rx: -0.3 * k }, armR: { rx: -0.8 * k, rz: -0.8 * k }, chest: { rx: -0.25 * k }, head: { rx: -0.3 * k }, hips: { ty: 3 * k } };
    } },
  };
  const geo = layered([{ sc: robe, o: LAYER.cloth }, { sc: hood, o: LAYER.cloth }, { sc: inner, o: { ...LAYER.cloth, ao: 0.4 } }, { sc: hands, o: LAYER.skin }]);
  return { geo, rig: new Rig(bones, clips) };
}

/** Builders for the Fun House's creatures, keyed by enemy id (the Splitter's sizes share one sculpt). */
export const FUNHOUSE_BUILDERS: Record<string, () => SculptModel> = {
  grinning_mannequin: mannequin,
  grand_mannequin: mannequin,
  doppelganger,
  glasswalker,
  marionette,
  splitter,
  splitter_mid: splitter,
  splitter_small: splitter,
  crooked_clown: crookedClown,
  reflection_thief: reflectionThief,
};
