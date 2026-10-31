// The Fun House's monsters (D-63): SDF sculpts on their own skeletons, like the first map's crowd
// (creatures.ts), each with a locomotion clip and the wind-up/attack clip the sim's telegraph drives.
// Porcelain that moves in snaps, a chrome copy of a person, a figure of broken glass, a marionette on
// strings, a lobed blob of too many faces, a clown stretched by a mirror, a hooded thief with a hand mirror.

import { C, SURF, cone, cyl, ellipsoid, sphere, torus, vnoise, weather, type ColorFn, type V3 } from '../core/geo';
import { PAL } from './kit';
import { Sculpt } from '../sculpt/sdf';
import { Rig, type BoneDef, type ClipDef, ease, mix, pulse, sin, cos, snap, TAU } from '../sculpt/rig';
import { ADULT, GAIT_WALK, type Gait, eyeDetails, gaitPose, head, humanBody, humanBones, scaleP } from '../sculpt/humanoid';
import type { SculptModel } from './characters';

type Clips = Record<string, ClipDef>;
const bi = (bones: BoneDef[]) => (n: string) => {
  const i = bones.findIndex((x) => x.name === n);
  if (i < 0) throw new Error(`no bone ${n}`);
  return i;
};
const glowEye = (sc: Sculpt, bone: number, pos: V3, r: number, col: number, emit = 1.3) => sc.detail(sphere(r, 10, 8), { col, bone, pos, emit, surf: SURF.glass });

const PORCELAIN = 0xe6dccb;
/** porcelain with fine crazing and the grime of ninety years in a shop window */
const porcelain: ColorFn = (p) => C(PORCELAIN).multiplyScalar(0.84 + 0.2 * vnoise(p.x * 0.4, p.y * 0.4, p.z * 0.4) - 0.1 * Math.max(0, vnoise(p.x * 2.2, p.y * 2.2, p.z * 2.2) - 0.72) * 6);
/** chrome: a cold silver with the room's lights streaked across it */
const chrome: ColorFn = (p) => C(0xc8d6e2).multiplyScalar(0.55 + 0.55 * Math.abs(Math.sin(p.y * 0.35 + p.x * 0.12)));
/** old mirror glass: silver going grey-green at the edges */
const glass: ColorFn = (p) => C(0xd8f0ff).lerp(C(0x6a8a90), 0.25 + 0.35 * vnoise(p.x * 0.3, p.y * 0.3, p.z * 0.3));

// ================================================================== Grinning Mannequin
function mannequin(): SculptModel {
  const P = scaleP(ADULT, 1.02, { headR: 11, chestW: 11.5, waistW: 8.5, hipW: 10, arm: [3.4, 2.9, 2.4], leg: [4.4, 3.4, 2.8], stance: 6, depth: 0.72 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.7, 1.2); // hard seams: a dummy is made of parts
  humanBody(sc, P, b, { skin: porcelain, torso: porcelain, hips: porcelain, upperArm: porcelain, foreArm: porcelain, hand: porcelain, thigh: porcelain, shin: porcelain, shoe: C(PORCELAIN).multiplyScalar(0.75), torsoSurf: SURF.porcelain, legSurf: SURF.porcelain });
  // ball joints at shoulders, elbows and knees; the waist seam where the torso screws on
  for (const n of ['L', 'R']) {
    const s = n === 'L' ? 1 : -1;
    for (const [bn, p, r] of [[`arm${n}`, [s * P.shoulderX, P.shoulderY, 0], P.arm[0] + 0.8], [`fore${n}`, [s * (P.shoulderX + P.armOut), P.elbowY, -0.8], P.arm[1] + 0.8], [`shin${n}`, [s * (P.stance + 0.4), P.knee, 0.6], P.leg[1] + 0.9]] as [string, V3, number][]) {
      sc.add({ t: 'sph', c: p, r }, { col: C(PORCELAIN).multiplyScalar(0.8), bone: b(bn), k: 0.3, surf: SURF.porcelain });
    }
  }
  sc.add({ t: 'tor', c: [0, P.waist + 1, 0.3], R: P.waistW + 0.4, r: 0.8 }, { col: PAL.ink, bone: b('spine'), k: 0.2, surf: SURF.paint });
  // the egg head: no ears, no nose to speak of, a painted grin far too wide
  head(sc, P, b('head'), { skin: porcelain, nose: 0.45, ears: false, brow: 0.2, cheeks: 0.5, chin: 0.3 });
  eyeDetails(sc, P, b('head'), { size: 0.13, sclera: -1, iris: PAL.ink, y: 0.12, spread: 0.34 });
  for (let i = 0; i < 9; i++) {
    const a = -0.9 + (i / 8) * 1.8;
    sc.detail(sphere(0.9, 6, 4), { col: i % 2 ? PAL.blood : PAL.ink, bone: b('head'), pos: [Math.sin(a) * P.headR * 0.62, P.headY - P.headR * 0.36 - Math.cos(a) * 1.4 + 1.4, Math.cos(a) * P.headR * 0.82], surf: SURF.paint });
  }
  // a shop tag on a string at the wrist
  sc.detail(cyl(2.2, 2.2, 0.4, 8), { col: PAL.cream, bone: b('handL'), pos: [P.shoulderX + 4, P.wristY - 5, 2], rot: [Math.PI / 2, 0, 0.4], surf: SURF.paint });
  const gait: Gait = { ...GAIT_WALK, stride: 0.65, knee: 0.3, bob: 0.5, sway: 0, twist: 0.05, squash: 0, arm: 0.65, elbow: 0.05, headBob: 0 };
  const clips: Clips = {
    // it doesn't walk, it re-poses: snaps between stiff shop-window attitudes, faster than a body should
    move: { frames: 32, fn: (t) => mix(gaitPose(snap(t, 4), gait), { head: { rz: 0.35 * sin(snap(t, 2)), ry: 0.25 * cos(snap(t, 4)) }, chest: { rx: 0.15 } }) },
    attack: { frames: 16, loop: false, fn: (t) => {
      const k = ease(snap(t, 3));
      return { armL: { rx: -1.6 * k, rz: 0.2 }, armR: { rx: -1.6 * k, rz: -0.2 }, foreL: { rx: -0.2 }, foreR: { rx: -0.2 }, head: { rx: -0.3 * k, rz: 0.4 * k }, chest: { rx: 0.3 * k } };
    } },
  };
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
}

// ================================================================== Doppelganger
function doppelganger(): SculptModel {
  const P = scaleP(ADULT, 0.98, { headR: 11.5, chestW: 11.5, waistW: 9.5, hipW: 10, stance: 6.5 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.6, 2);
  humanBody(sc, P, b, { skin: chrome, torso: chrome, hips: chrome, upperArm: chrome, foreArm: chrome, hand: chrome, thigh: chrome, shin: chrome, shoe: C(0x5a6a7a), torsoSurf: SURF.brass, legSurf: SURF.brass });
  head(sc, P, b('head'), { skin: chrome, nose: 0.8, ears: true, brow: 0.6, cheeks: 0.8, chin: 0.6 });
  // a face like a dark window: blank glowing eyes, and a crack running from crown to jaw
  eyeDetails(sc, P, b('head'), { size: 0.16, sclera: 0x9fd8ff, iris: 0xe8faff, glow: 1.6, y: 0.12 });
  for (let i = 0; i < 5; i++) sc.detail(cyl(0.25, 0.25, 4.2, 3), { col: PAL.ink, bone: b('head'), pos: [3 + Math.sin(i * 1.7) * 1.6, P.headY + 8 - i * 3.6, P.headR * 0.86], rot: [0, 0, 0.5 * Math.sin(i * 2.3)], surf: SURF.glass });
  const gait: Gait = { ...GAIT_WALK, stride: 0.6, bob: 1.6, arm: 0.5 };
  const clips: Clips = {
    move: { frames: 30, fn: (t) => gaitPose(t, gait) },
    // it gleams, coils, and lunges — the same lunge you would make
    attack: { frames: 16, loop: false, fn: (t) => {
      const coil = ease(Math.min(1, t / 0.6)), go = pulse(t, 0.85, 0.15);
      return { chest: { rx: 0.5 * coil - 0.4 * go }, armL: { rx: -1.2 * coil, rz: 0.6 }, armR: { rx: -1.2 * coil, rz: -0.6 }, thighL: { rx: -0.6 * coil }, thighR: { rx: 0.5 * coil }, head: { rx: -0.2 * coil } };
    } },
  };
  return { geo: sc.build({ ao: 0.45 }), rig: new Rig(bones, clips) };
}

// ================================================================== Glasswalker
function glasswalker(): SculptModel {
  const P = scaleP(ADULT, 1.12, { headR: 8.5, chestW: 9.5, waistW: 6.5, hipW: 7.5, arm: [2.6, 2.2, 1.9], leg: [3, 2.5, 2], stance: 7, depth: 0.55, armOut: 4 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.2, 1.1);
  humanBody(sc, P, b, { skin: glass, torso: glass, hips: glass, upperArm: glass, foreArm: glass, hand: glass, thigh: glass, shin: glass, shoe: glass, torsoSurf: SURF.glass, legSurf: SURF.glass });
  // splinters standing out of its back and shoulders, every one a sliver of some room it has been in
  const shards: [string, V3, V3][] = [['chest', [4, P.chest + 6, -6], [0.6, 0, 0.4]], ['chest', [-5, P.chest + 4, -5], [0.5, 0, -0.5]], ['chest', [0, P.shoulderY + 4, -7], [0.9, 0, 0]], ['armL', [P.shoulderX + 2, P.shoulderY + 5, 0], [0, 0, -0.7]], ['armR', [-P.shoulderX - 2, P.shoulderY + 5, 0], [0, 0, 0.7]], ['hips', [0, P.hip + 2, -5], [1, 0, 0]]];
  for (const [bn, p, r] of shards) sc.detail(cone(2.4, 12, 4), { col: 0xe8f8ff, bone: b(bn), pos: p, rot: r, surf: SURF.glass, emit: 0.25 });
  // the head is a single tall shard; the eyes are the glow of the room behind the glass
  sc.add({ t: 'ell', c: [0, P.headY + 3, 0], r: [P.headR * 0.8, P.headR * 1.5, P.headR * 0.7] }, { col: glass, bone: b('head'), k: 0.6, surf: SURF.glass });
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * 3, P.headY + 2, P.headR * 0.62], 1.4, 0x7dffd8, 2);
  // long fingers like broken panes
  for (const n of ['L', 'R']) {
    const s = n === 'L' ? 1 : -1;
    for (let k = 0; k < 3; k++) sc.detail(cone(1, 9, 4), { col: 0xd8f0ff, bone: b(`hand${n}`), pos: [s * (P.shoulderX + P.armOut * 1.6) + (k - 1) * 1.6, P.wristY - 6, 1.5], rot: [Math.PI, 0, (k - 1) * 0.25], surf: SURF.glass });
  }
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
  return { geo: sc.build({ ao: 0.35 }), rig: new Rig(bones, clips) };
}

// ================================================================== Marionette
function marionette(): SculptModel {
  const P = scaleP(ADULT, 0.88, { headR: 11, chestW: 9.5, waistW: 7.5, hipW: 8.5, arm: [2.6, 2.4, 2.2], leg: [3, 2.7, 2.4], stance: 5.5, depth: 0.7 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.8, 1.4);
  const wood = weather(PAL.woodPale, 0.38, 0.12);
  const velvet = weather(0x8a2434, 0.4, 0.1, PAL.woodPale);
  humanBody(sc, P, b, { skin: wood, torso: velvet, hips: velvet, upperArm: velvet, foreArm: wood, hand: wood, thigh: weather(0x2a2440, 0.35), shin: wood, shoe: PAL.ink, torsoSurf: SURF.velvet, legSurf: SURF.wood });
  for (const n of ['L', 'R']) {
    const s = n === 'L' ? 1 : -1;
    for (const [bn, p] of [[`fore${n}`, [s * (P.shoulderX + P.armOut), P.elbowY, -0.8]], [`shin${n}`, [s * (P.stance + 0.4), P.knee, 0.6]]] as [string, V3][]) {
      sc.add({ t: 'sph', c: p, r: 2.6 }, { col: wood, bone: b(bn), k: 0.4, surf: SURF.wood });
    }
  }
  head(sc, P, b('head'), { skin: wood, nose: 1.2, ears: false, brow: 0.5, cheeks: 1, chin: 0.2, jaw: 0.8 });
  eyeDetails(sc, P, b('head'), { size: 0.15, sclera: PAL.bone, iris: PAL.ink, y: 0.14 });
  for (const s of [-1, 1]) sc.detail(cyl(2, 2, 0.4, 10), { col: 0xb04a48, bone: b('head'), pos: [s * 5.6, P.headY - 2.6, 8.2], rot: [Math.PI / 2, 0, s * 0.6], surf: SURF.paint });
  // the jaw hangs on two pins, a little open; a ruff of tattered lace
  sc.detail(ellipsoid(4, 1.2, 1.4, 8, 4), { col: PAL.ink, bone: b('head'), pos: [0, P.headY - 6, 8.8], surf: SURF.paint });
  sc.detail(torus(P.headR * 0.55, 1.4, 6, 14), { col: PAL.bone, bone: b('chest'), pos: [0, P.neck - 1, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.cloth });
  // its strings, rising into the dark from the head and both wrists and knees
  for (const [bn, p] of [['head', [0, P.headY + 10, 0]], ['handL', [P.shoulderX + 3, P.wristY, 1]], ['handR', [-P.shoulderX - 3, P.wristY, 1]], ['shinL', [P.stance, P.knee, 1]], ['shinR', [-P.stance, P.knee, 1]]] as [string, V3][]) {
    sc.detail(cyl(0.16, 0.16, 90, 3), { col: PAL.bone, bone: b(bn), pos: [p[0], p[1] + 45, p[2]], emit: 0.25, surf: SURF.cloth });
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
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
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
  const flesh: ColorFn = (p) => C(0xd98a92).lerp(C(0x5a1e34), 0.25 + 0.45 * vnoise(p.x * 0.12, p.y * 0.12, p.z * 0.12));
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
  return { geo: sc.build({ ao: 0.55 }), rig: new Rig(bones, clips) };
}

// ================================================================== Crooked Clown
function crookedClown(): SculptModel {
  // a performer a mirror stretched: legs and neck far too long, a tiny head, leaning hard
  const P = scaleP(ADULT, 1.05, { hip: 48, knee: 26, waist: 56, chest: 66, shoulderY: 73, elbowY: 57, wristY: 43, neck: 80, headY: 89, headR: 8.5, chestW: 9.5, waistW: 8, hipW: 9, arm: [2.8, 2.4, 2.1], leg: [3.4, 2.8, 2.4], stance: 5.5, depth: 0.7 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.7, 2);
  const suit: ColorFn = (p) => (Math.floor((p.y + 400) / 6) % 2 ? C(0x5a2a8a) : C(0xe8dcc0)).multiplyScalar(0.8 + 0.2 * vnoise(p.x * 0.3, p.y * 0.3, p.z * 0.3));
  const face = weather(PAL.clown, 0.25, 0.12);
  humanBody(sc, P, b, { skin: face, torso: suit, hips: suit, upperArm: suit, foreArm: suit, hand: PAL.bone, thigh: weather(0x2a8a7a, 0.3), shin: weather(0x2a8a7a, 0.3), shoe: 0xa8202a, torsoSurf: SURF.cloth, legSurf: SURF.cloth, bigShoes: 1.4, gloves: true });
  head(sc, P, b('head'), { skin: face, nose: 0.6, noseCol: 0xe8202a, ears: true, brow: 0.8, cheeks: 0.8, chin: 0.8, jaw: 0.9 });
  eyeDetails(sc, P, b('head'), { size: 0.2, sclera: PAL.bone, iris: 0x2a1a30, y: 0.14, tilt: 0.25 });
  sc.detail(sphere(2.6, 10, 8), { col: 0xe8202a, bone: b('head'), pos: [0, P.headY - 1, P.headR * 0.98], surf: SURF.latex });
  // a too-small hat, cocked; ruffs at neck and wrists
  sc.detail(cyl(3.4, 3.8, 6, 10), { col: PAL.ink, bone: b('head'), pos: [2, P.headY + P.headR + 2.6, 0], rot: [0, 0, -0.35], surf: SURF.velvet });
  sc.detail(torus(4.6, 1.6, 6, 14), { col: PAL.bone, bone: b('chest'), pos: [0, P.neck - 3, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.cloth });
  // juggling pins, one in each hand
  for (const n of ['L', 'R']) {
    const s = n === 'L' ? 1 : -1;
    sc.detail(ellipsoid(1.6, 5, 1.6, 8, 6), { col: PAL.bone, bone: b(`hand${n}`), pos: [s * (P.shoulderX + P.armOut * 1.6), P.wristY - 4, 3], surf: SURF.paint });
    sc.detail(cyl(0.8, 0.8, 3, 6), { col: 0xa8202a, bone: b(`hand${n}`), pos: [s * (P.shoulderX + P.armOut * 1.6), P.wristY - 9.4, 3], surf: SURF.paint });
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
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
}

// ================================================================== Reflection Thief
function reflectionThief(): SculptModel {
  const P = scaleP(ADULT, 1, { headR: 10.5, chestW: 11, waistW: 10, hipW: 12, stance: 5.5 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.6, 3);
  const robe = weather(0x3a2c54, 0.4, 0.1, 0x140c20);
  humanBody(sc, P, b, { skin: 0x1a1220, torso: robe, hips: robe, upperArm: robe, foreArm: robe, hand: 0x2a2030, thigh: robe, shin: robe, shoe: PAL.ink, torsoSurf: SURF.velvet, legSurf: SURF.velvet, noLegs: true });
  // a long robe to the floor instead of legs, frayed at the hem
  sc.add({ t: 'cap', a: [0, 6, 0], b: [0, P.waist, 0], ra: 15, rb: 10 }, { col: robe, bone: b('hips'), k: 4, surf: SURF.velvet });
  // the hood: deep enough to hold only two pale lights
  sc.add({ t: 'ell', c: [0, P.headY + 1, -1], r: [P.headR * 1.2, P.headR * 1.3, P.headR * 1.25] }, { col: robe, bone: b('head'), k: 1, surf: SURF.velvet });
  sc.add({ t: 'ell', c: [0, P.headY - 1, P.headR * 0.9], r: [P.headR * 0.75, P.headR * 0.9, P.headR * 0.6] }, { sub: true, k: 1 });
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * 3.4, P.headY, P.headR * 0.55], 1.3, 0xe8f6ff, 1.8);
  // the hand mirror: gilt frame, a pane that shows something else
  const hx = P.shoulderX + P.armOut * 1.6;
  sc.detail(cyl(0.9, 0.9, 9, 6), { col: PAL.gold, bone: b('handL'), pos: [hx, P.wristY + 3, 3], surf: SURF.gold });
  sc.detail(torus(5.6, 0.9, 6, 18), { col: PAL.gold, bone: b('handL'), pos: [hx, P.wristY + 12, 3], surf: SURF.gold });
  sc.detail(cyl(5, 5, 0.6, 18), { col: 0xc8f0ff, bone: b('handL'), pos: [hx, P.wristY + 12, 3], rot: [Math.PI / 2, 0, 0], emit: 1.1, surf: SURF.glass });
  const clips: Clips = {
    // it glides, robe swaying, the mirror bobbing like a lantern
    move: { frames: 32, fn: (t) => ({ hips: { ty: 1.5 * sin(t), rz: 0.05 * sin(t) }, chest: { rz: -0.05 * sin(t) }, armL: { rx: -1.3 + 0.1 * sin(t, 2), rz: 0.25 }, foreL: { rx: -0.6 }, armR: { rx: 0.2 * cos(t), rz: -0.15 }, head: { ry: 0.2 * sin(t, 0.5) } }) },
    // raises the mirror high: the decoys step out of it
    attack: { frames: 20, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7));
      return { armL: { rx: -2.6 * k, rz: 0.2 }, foreL: { rx: -0.3 * k }, armR: { rx: -0.8 * k, rz: -0.8 * k }, chest: { rx: -0.25 * k }, head: { rx: -0.3 * k }, hips: { ty: 3 * k } };
    } },
  };
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
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

export const _unused = { TAU };
