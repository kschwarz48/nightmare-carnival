// The Ghost Train's passengers and staff (D-80): SDF sculpts on their own skeletons like every other crowd,
// each with its locomotion clip and the wind-up/attack clip the sim's telegraph drives (and a clip of its own
// where the sim has a state worth showing: the Gravebound clawing up out of the ground). Period dress of the
// 1890s line, faded and grave-stained; faces the grey of old photographs; small light sources (an unpunched
// ticket, a signal lantern, a firebox, ember cracks) so each reads at gameplay zoom in the dark.

import { C, SURF, box, cone, cyl, ellipsoid, sphere, torus, vnoise, type ColorFn, type V3 } from '../core/geo';
import { PAL } from './kit';
import { Sculpt } from '../sculpt/sdf';
import { CREATURE, flat } from '../sculpt/figure';
import { Rig, type BoneDef, type ClipDef, type Pose, ease, mix, pulse, sin, cos } from '../sculpt/rig';
import { ADULT, GAIT_WALK, type Gait, type Proportions, eyeDetails, gaitPose, head, humanBody, humanBones, scaleP } from '../sculpt/humanoid';
import type { SculptModel } from './characters';

type Clips = Record<string, ClipDef>;
const bi = (bones: BoneDef[]) => (n: string) => {
  const i = bones.findIndex((x) => x.name === n);
  if (i < 0) throw new Error(`no bone ${n}`);
  return i;
};
const glowEye = (sc: Sculpt, bone: number, pos: V3, r: number, col: number, emit = 1.3) => sc.detail(sphere(r, 10, 8), { col, bone, pos, emit, surf: SURF.glass });
function prop(k: number, o: Partial<Proportions>): Proportions {
  const out: Partial<Proportions> = {};
  for (const [key, v] of Object.entries(o)) (out as Record<string, unknown>)[key] = Array.isArray(v) ? v.map((x: number) => x * k) : (v as number) * k;
  return scaleP(ADULT, k, out);
}
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The grey of an old photograph (D-88: its bruising was noise). */
const ghostSkin = flat(C(0x9aa0a4).lerp(C(0x5a6066), 0.4));
/** Corpse skin from the churchyard: yellowed, soil-dark. */
const graveSkin = flat(C(0x8a8468).lerp(C(0x3a3020), 0.45));
const black = flat(0x18161a);
const coat = (hex: number) => flat(hex);
const iron = flat(0x2a2c2e);
const brass = flat(PAL.brass);
/** Coal: near-black, with glowing cracks where the fire shows through. */
const coalCol: ColorFn = (p) => {
  const n = vnoise(p.x * 0.5, p.y * 0.5, p.z * 0.5);
  return n > 0.7 ? C(0xff6a1a).multiplyScalar(1.4) : C(0x141210).lerp(C(0x2a2622), vnoise(p.x * 0.2, p.y * 0.2, p.z * 0.2));
};
/** Slag: a cooling crust over molten orange. */
const slagCol: ColorFn = (p) => {
  const n = vnoise(p.x * 0.18, p.y * 0.18, p.z * 0.18);
  return n > 0.66 ? C(0xff7a20).lerp(C(0xffd060), (n - 0.66) * 2) : C(0x2a221c).lerp(C(0x4a3a30), vnoise(p.x * 0.4, p.y * 0.4, p.z * 0.4));
};
const shamble: Gait = { ...GAIT_WALK, stride: 0.38, knee: 0.5, bob: 2.4, sway: 0.18, twist: 0.1, arm: 0.1, elbow: 0.2, lean: 0.22, headBob: 0.08 };

/** A flat cap (or peaked uniform cap, `peak` > 0) on the head bone. */
function cap(sc: Sculpt, P: Proportions, bone: number, col: number | ColorFn, peak: number, band?: number): void {
  const r = P.headR, y = P.headY + r * 0.62;
  sc.add({ t: 'ell', c: [0, y, -r * 0.05], r: [r * 1.02, r * 0.38, r * 1.05] }, { col, bone, k: 0.6, surf: SURF.cloth });
  sc.detail(ellipsoid(r * 0.75, r * 0.1, r * 0.55 * (1 + peak), 12, 6), { col: typeof col === 'number' ? col : 0x1a1816, bone, pos: [0, y - r * 0.18, r * 0.72], rot: [-0.25, 0, 0], surf: SURF.rubber });
  if (band !== undefined) sc.detail(torus(r * 1.0, r * 0.08, 5, 18), { col: band, bone, pos: [0, y - r * 0.08, -r * 0.05], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
}
/** A long coat's skirt hanging from the hips (a hollow cone with a ragged hem). */
function skirt(sc: Sculpt, P: Proportions, bone: number, col: number | ColorFn, len: number, flare: number, k = 2): void {
  sc.add({ t: 'cap', a: [0, P.hip + 3, 0], b: [0, P.hip - len, 0.5], ra: P.hipW * 1.05, rb: P.hipW * flare, sz: 0.85 }, { col, bone, k, surf: SURF.cloth });
}

// ================================================================== the Ticketless
function ticketless(): SculptModel {
  const P = prop(1, { headR: 11.5, chestW: 11, waistW: 9.5, hipW: 10, depth: 0.74, arm: [3.4, 3, 2.5], leg: [4.4, 3.6, 3] });
  const bones = humanBones(P, [{ name: 'case', parent: 'handR', head: [-P.shoulderX - 3, P.wristY - 8, 2] }]);
  const b = bi(bones);
  const sc = new Sculpt(1.8, 2.4, 0.65);
  const tweed = coat(0x4a4438);
  humanBody(sc, P, b, { skin: ghostSkin, torso: tweed, hips: tweed, upperArm: tweed, foreArm: tweed, hand: ghostSkin, thigh: coat(0x2e2a26), shin: coat(0x2e2a26), shoe: 0x141210 });
  skirt(sc, P, b('hips'), tweed, 20, 1.25);
  head(sc, P, b('head'), { skin: ghostSkin, nose: 0.9, ears: true, brow: 1.1, cheeks: 0.7, chin: 0.6, jaw: 0.95 });
  eyeDetails(sc, P, b('head'), { size: 0.16, sclera: 0x2a2e32, iris: 0xd8e8ff, glow: 1.2, y: 0.12 });
  cap(sc, P, b('head'), flat(0x3a342c), 0);
  // the unpunched ticket tucked in the cap's band: the only warm thing about him
  sc.detail(box(5, 3.5, 0.4), { col: 0xfff0b0, bone: b('head'), pos: [P.headR * 0.65, P.headY + P.headR * 0.7, P.headR * 0.55], rot: [0, 0.6, 0.2], emit: 1.4, surf: SURF.bulb });
  // a cardboard suitcase with a strap, swinging in the right hand
  sc.detail(box(16, 12, 5), { col: 0x6a5232, bone: b('case'), pos: [-P.shoulderX - 3, P.wristY - 12, 2], surf: SURF.wood });
  sc.detail(box(17, 1.2, 5.4), { col: 0x2a1e14, bone: b('case'), pos: [-P.shoulderX - 3, P.wristY - 9, 2], surf: SURF.rubber });
  const reach: Pose = { armL: { rx: -1.2, rz: 0.1 }, foreL: { rx: -0.3 } };
  const clips: Clips = {
    move: { frames: 30, fn: (t) => mix(gaitPose(t, shamble), reach, { case: { rx: 0.25 * sin(t) }, head: { rz: 0.15 * sin(t, 1, 0.3), rx: 0.15 } }) },
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7));
      return mix(reach, { armL: { rx: -1.6 * k, rz: 0.4 * k }, chest: { rx: 0.35 * k }, head: { rx: 0.2 * k } });
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Coalborn
function coalborn(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 12, 0] },
    { name: 'armL', parent: 'body', head: [9, 16, 1] },
    { name: 'armR', parent: 'body', head: [-9, 16, 1] },
    { name: 'legL', parent: 'body', head: [5, 7, 0] },
    { name: 'legR', parent: 'body', head: [-5, 7, 0] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1.4, 1.6);
  const r = stream(21);
  // a heap of coal lumps shouldering into a body, cracks glowing
  sc.add({ t: 'ell', c: [0, 15, 0], r: [10, 9, 8] }, { col: coalCol, bone: b('body'), k: 0, surf: SURF.rubber });
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, h = 9 + r() * 14;
    sc.add({ t: 'box', c: [Math.cos(a) * 7, h, Math.sin(a) * 6], h: [3 + r() * 2.5, 3 + r() * 2, 3 + r() * 2], r: 0.8, rot: [r() * 2, r() * 2, r() * 2] }, { col: coalCol, bone: b('body'), k: 1.2, surf: SURF.rubber });
  }
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    sc.add({ t: 'cap', a: [s * 9, 16, 1], b: [s * 15, 8, 4], ra: 3.2, rb: 3.8 }, { col: coalCol, bone: b(`arm${n}`), k: 1.5, surf: SURF.rubber });
    sc.add({ t: 'cap', a: [s * 5, 8, 0], b: [s * 6, 1.5, 1], ra: 3.4, rb: 3 }, { col: coalCol, bone: b(`leg${n}`), k: 1.5, surf: SURF.rubber });
  }
  // the furnace mouth and two coals for eyes
  sc.add({ t: 'ell', c: [0, 15, 7.5], r: [4, 2, 2] }, { sub: true, k: 1 });
  sc.detail(ellipsoid(3.4, 1.5, 0.8, 10, 6), { col: 0xff5a10, bone: b('body'), pos: [0, 15, 6.2], emit: 2.2, surf: SURF.bulb });
  for (const s of [1, -1]) glowEye(sc, b('body'), [s * 3.2, 20, 7], 1.4, 0xffb040, 2);
  const clips: Clips = {
    // a scuttling waddle, sparks shaken loose
    move: { frames: 18, fn: (t) => ({ body: { ty: 1.2 * Math.abs(sin(t)), rz: 0.15 * sin(t) }, legL: { rx: 0.6 * sin(t) }, legR: { rx: -0.6 * sin(t) }, armL: { rx: -0.5 * sin(t) }, armR: { rx: 0.5 * sin(t) } }) },
    attack: { frames: 12, loop: false, fn: (t) => {
      const k = ease(t);
      return { body: { rx: 0.4 * k, ty: 3 * k }, armL: { rx: -2 * k, rz: -0.3 * k }, armR: { rx: -2 * k, rz: 0.3 * k } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== the Porter
function porter(): SculptModel {
  const P = prop(1.3, { headR: 12, chestW: 15, waistW: 14, hipW: 13, depth: 0.85, arm: [5, 4.4, 3.6], leg: [5.6, 4.6, 3.6] });
  const bones = humanBones(P, [{ name: 'trunk', parent: 'chest', head: [0, P.chest, 14] }]);
  const b = bi(bones);
  const sc = new Sculpt(2, 3, 0.65);
  const red = coat(0x5a1a18);
  humanBody(sc, P, b, { skin: ghostSkin, torso: red, hips: coat(0x24201c), upperArm: red, foreArm: red, hand: ghostSkin, thigh: coat(0x24201c), shin: coat(0x24201c), shoe: 0x141210 });
  head(sc, P, b('head'), { skin: ghostSkin, nose: 1.2, ears: true, brow: 1.3, cheeks: 1, chin: 0.8, jaw: 1.2 });
  eyeDetails(sc, P, b('head'), { size: 0.15, sclera: 0x2a2e32, iris: 0xd8e8ff, glow: 1.1 });
  cap(sc, P, b('head'), 0x2a0e0c, 0.5, 0xc8a050);
  // brass buttons down the tunic
  for (let i = 0; i < 4; i++) sc.detail(sphere(1.1, 8, 6), { col: PAL.brass, bone: b('chest'), pos: [0, P.chest + 6 - i * 6, P.chestW * P.depth + 0.8], surf: SURF.brass });
  // the steamer trunk he never puts down, held out in front like a wall
  sc.add({ t: 'box', c: [0, P.chest - 6, 20], h: [20, 15, 10], r: 2 }, { col: flat(0x4a3018), bone: b('trunk'), k: 0, surf: SURF.wood });
  for (const y of [-12, 0, 12]) sc.detail(box(41, 2.2, 21), { col: PAL.brass, bone: b('trunk'), pos: [0, P.chest - 6 + y, 20], surf: SURF.brass });
  for (const s of [-1, 1]) sc.detail(box(2.4, 31, 21), { col: PAL.iron, bone: b('trunk'), pos: [s * 14, P.chest - 6, 20], surf: SURF.iron });
  sc.detail(box(8, 7, 1.5), { col: 0xc8b080, bone: b('trunk'), pos: [8, P.chest, 30.5], surf: SURF.paint });
  const hold: Pose = { armL: { rx: -1.1, rz: 0.25 }, armR: { rx: -1.1, rz: -0.25 }, foreL: { rx: -0.6 }, foreR: { rx: -0.6 } };
  const g: Gait = { ...GAIT_WALK, stride: 0.4, knee: 0.6, bob: 3, sway: 0.12, arm: 0, elbow: 0, lean: 0.1 };
  const clips: Clips = {
    move: { frames: 34, fn: (t) => mix(gaitPose(t, g), hold, { trunk: { ty: 1.2 * sin(t, 2) } }) },
    // the trunk drawn back and slammed forward
    attack: { frames: 16, loop: false, fn: (t) => {
      const back = ease(Math.min(1, t / 0.7)), hit = pulse(t, 0.9, 0.1);
      return mix(hold, { chest: { rx: -0.3 * back + 0.5 * hit }, trunk: { tz: -6 * back + 14 * hit, ty: 4 * back }, armL: { rx: -1.1 - 0.5 * back }, armR: { rx: -1.1 - 0.5 * back } });
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== The Navvy (D-84)
/** A navvy the line never paid off: a wall of a man in moleskins and a waistcoat, a red neckerchief, a sledgehammer on
 *  his shoulder. No wind-up and no trick: he walks you down. */
function navvy(): SculptModel {
  const P = prop(1.6, { headR: 11, chestW: 19, waistW: 17, hipW: 15, depth: 0.95, arm: [6.6, 5.8, 4.8], leg: [6.6, 5.6, 4.4] });
  const bones = humanBones(P, [{ name: 'hammer', parent: 'chest', head: [P.shoulderX, P.shoulderY, -4] }]);
  const b = bi(bones);
  const sc = new Sculpt(2, 3, 0.65);
  const moleskin = coat(0x4a3a28), vest = coat(0x1e1c1a), shirt = flat(0xb0a898);
  humanBody(sc, P, b, { skin: ghostSkin, torso: vest, hips: moleskin, upperArm: shirt, foreArm: ghostSkin, hand: ghostSkin, thigh: moleskin, shin: moleskin, shoe: 0x141210 });
  head(sc, P, b('head'), { skin: ghostSkin, nose: 1.4, ears: true, brow: 1.5, cheeks: 1.1, chin: 1.1, jaw: 1.5 });
  eyeDetails(sc, P, b('head'), { size: 0.13, sclera: 0x2a2e32, iris: 0xd8e8ff, glow: 1.1 });
  cap(sc, P, b('head'), 0x2a2420, 0);
  sc.detail(torus(P.headR * 0.72, 1.7, 6, 14), { col: 0x8a2018, bone: b('neck'), pos: [0, P.neck - 1, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.cloth });
  for (let i = 0; i < 4; i++) sc.detail(sphere(1, 8, 6), { col: PAL.brass, bone: b('chest'), pos: [0, P.chest + 4 - i * 5, P.chestW * P.depth + 0.8], surf: SURF.brass });
  // the sledgehammer: its haft up from his right hand at the shoulder, leaning back, the iron head behind him
  sc.detail(cyl(1.6, 1.8, 60, 8), { col: 0x5a3e24, bone: b('hammer'), pos: [P.shoulderX + 2, P.shoulderY + 10, -4], rot: [-0.6, 0, -0.2], surf: SURF.wood });
  sc.detail(box(9, 20, 9), { col: 0x2a2c2e, bone: b('hammer'), pos: [P.shoulderX + 7, P.shoulderY + 35, -21], rot: [-0.6, 0, -0.2], surf: SURF.iron });
  const carry: Pose = { armR: { rx: -0.35, rz: -0.3 }, foreR: { rx: -1.9 } };
  const g: Gait = { ...GAIT_WALK, stride: 0.42, knee: 0.55, bob: 3.6, sway: 0.22, twist: 0.08, arm: 0.35, elbow: 0.25, lean: 0.14, headBob: 0.1 };
  const clips: Clips = {
    move: { frames: 36, fn: (t) => mix(gaitPose(t, g), carry) },
    attack: { frames: 14, loop: false, fn: (t) => mix(gaitPose(0, g), carry, { chest: { rx: 0.35 * pulse(t, 0.6, 0.3) } }) },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Railcrawler
function railcrawler(): SculptModel {
  const bones: BoneDef[] = [{ name: 'body', parent: null, head: [0, 14, 0] }, { name: 'lamp', parent: 'body', head: [0, 18, 12] }];
  const LEGS = 3;
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) for (let i = 0; i < LEGS; i++) {
    bones.push({ name: `up${n}${i}`, parent: 'body', head: [s * 9, 15, 7 - i * 7] });
    bones.push({ name: `lo${n}${i}`, parent: `up${n}${i}`, head: [s * 22, 24, 9 - i * 9] });
  }
  const b = bi(bones);
  const sc = new Sculpt(1.6, 2);
  // a riveted buffer-beam body, a coupling hook for a jaw, a cracked lamp for an eye
  sc.add({ t: 'box', c: [0, 15, 0], h: [10, 6, 13], r: 3 }, { col: iron, bone: b('body'), k: 0, surf: SURF.iron });
  sc.add({ t: 'ell', c: [0, 18, -4], r: [8, 5, 9] }, { col: flat(0x3a2018), bone: b('body'), k: 3, surf: SURF.iron });
  for (let i = 0; i < 6; i++) sc.detail(sphere(0.9, 6, 5), { col: PAL.brass, bone: b('body'), pos: [-8 + i * 3.2, 21.2, 2], surf: SURF.brass });
  sc.detail(torus(3, 1, 6, 12, Math.PI), { col: PAL.iron, bone: b('body'), pos: [0, 11, 14], rot: [0, 0, Math.PI], surf: SURF.iron });
  sc.detail(cyl(4.5, 4.5, 3, 12), { col: PAL.iron, bone: b('lamp'), pos: [0, 18, 13], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
  sc.detail(cyl(3.6, 3.6, 0.6, 12), { col: 0xffe0a0, bone: b('lamp'), pos: [0, 18, 14.7], rot: [Math.PI / 2, 0, 0], emit: 2, surf: SURF.bulb });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) for (let i = 0; i < LEGS; i++) {
    const z = 7 - i * 7;
    sc.add({ t: 'cap', a: [s * 9, 15, z], b: [s * 22, 24, z + 2 - i * 2], ra: 2, rb: 1.6 }, { col: iron, bone: b(`up${n}${i}`), k: 0.8, surf: SURF.iron });
    sc.add({ t: 'cap', a: [s * 22, 24, z + 2 - i * 2], b: [s * 30, 1, z + 4 - i * 4], ra: 1.6, rb: 0.8 }, { col: iron, bone: b(`lo${n}${i}`), k: 0.8, surf: SURF.iron });
    sc.detail(cone(1.2, 4, 6), { col: PAL.iron, bone: b(`lo${n}${i}`), pos: [s * 30, 1, z + 4 - i * 4], rot: [Math.PI, 0, 0], surf: SURF.iron });
  }
  const legPose = (t: number, k: number): Pose => {
    const p: Pose = {};
    for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) for (let i = 0; i < LEGS; i++) {
      const ph = (i + (s > 0 ? 0 : 0.5)) / LEGS;
      p[`up${n}${i}`] = { rz: s * (0.25 * Math.max(0, sin(t, 1, ph)) * k), ry: 0.35 * sin(t, 1, ph) * k };
      p[`lo${n}${i}`] = { rz: -s * 0.2 * Math.max(0, sin(t, 1, ph)) * k };
    }
    return p;
  };
  const clips: Clips = {
    move: { frames: 16, fn: (t) => mix(legPose(t, 1), { body: { ty: 0.8 * sin(t, 2), rz: 0.05 * sin(t) } }) },
    // crouch, then the pounce
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.75)), leap = pulse(t, 0.9, 0.1);
      return mix(legPose(0.25, 0.4), { body: { ty: -5 * k + 6 * leap, rx: -0.3 * k }, lamp: { rx: -0.2 * k } });
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Mourning Passenger
function mourner(): SculptModel {
  const P = prop(1.05, { headR: 11, chestW: 10.5, waistW: 8, hipW: 11, depth: 0.74, arm: [3.2, 2.7, 2.2], leg: [4, 3.2, 2.6] });
  const bones = humanBones(P, [{ name: 'veil', parent: 'head', head: [0, P.headY + P.headR, 0] }]);
  const b = bi(bones);
  const sc = new Sculpt(1.7, 2.4, 0.65);
  humanBody(sc, P, b, { skin: ghostSkin, torso: black, hips: black, upperArm: black, foreArm: black, hand: 0x141214, thigh: black, shin: black, noLegs: true, gloves: true });
  // the full mourning dress to the ground, a bustle at the back
  sc.add({ t: 'cap', a: [0, P.hip + 4, 0], b: [0, 2, 0], ra: P.hipW * 0.95, rb: P.hipW * 1.7, sz: 0.95 }, { col: black, bone: b('hips'), k: 3, surf: SURF.velvet });
  sc.add({ t: 'ell', c: [0, P.hip, -P.hipW * 0.9], r: [P.hipW * 0.8, 7, 6] }, { col: black, bone: b('hips'), k: 3, surf: SURF.velvet });
  head(sc, P, b('head'), { skin: ghostSkin, nose: 0.8, ears: false, brow: 0.7, cheeks: 0.6, chin: 0.5, jaw: 0.85 });
  // a hat with a veil falling past the shoulders: two pale points of light behind it
  sc.add({ t: 'ell', c: [0, P.headY + P.headR * 0.7, 0], r: [P.headR * 1.3, P.headR * 0.3, P.headR * 1.3] }, { col: black, bone: b('head'), k: 0.6, surf: SURF.velvet });
  sc.add({ t: 'cap', a: [0, P.headY + P.headR * 0.6, 0], b: [0, P.headY - P.headR * 1.6, 1], ra: P.headR * 1.2, rb: P.headR * 1.45, sz: 0.95 }, { col: flat(0x1a181c), bone: b('veil'), k: 1, surf: SURF.cloth });
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * P.headR * 0.35, P.headY + P.headR * 0.1, P.headR * 1.3], 1.3, 0xd8e0ff, 1.6);
  // a black-bordered handkerchief in the clasped hands
  sc.detail(box(7, 0.6, 7), { col: 0xd8d0c8, bone: b('handL'), pos: [P.shoulderX * 0.5, P.wristY - 2, 8], rot: [0.6, 0.4, 0.2], surf: SURF.cloth });
  const clasp: Pose = { armL: { rx: -0.7, rz: 0.5 }, armR: { rx: -0.7, rz: -0.5 }, foreL: { rx: -1.1, ry: 0.4 }, foreR: { rx: -1.1, ry: -0.4 } };
  const clips: Clips = {
    // she glides; the dress sways; her head is bowed
    move: { frames: 36, fn: (t) => mix(clasp, { hips: { ty: 1 * sin(t, 2), rz: 0.05 * sin(t) }, head: { rx: 0.25, rz: 0.06 * sin(t) }, veil: { rz: 0.06 * sin(t, 1, 0.2) } }) },
    // the wail: head thrown back, arms flung out
    attack: { frames: 16, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.75));
      return mix(clasp, { armL: { rx: -1.4 * k, rz: 1.1 * k }, armR: { rx: -1.4 * k, rz: -1.1 * k }, foreL: { rx: 0.9 * k }, foreR: { rx: 0.9 * k }, head: { rx: -0.6 * k }, chest: { rx: -0.25 * k }, veil: { rx: -0.4 * k } });
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== the Signalman
function signalman(): SculptModel {
  const P = prop(1.05, { headR: 11.5, chestW: 12, waistW: 11, hipW: 11, depth: 0.8 });
  const bones = humanBones(P, [{ name: 'lantern', parent: 'handR', head: [-P.shoulderX - 4, P.wristY - 4, 3] }]);
  const b = bi(bones);
  const sc = new Sculpt(1.8, 2.4, 0.65);
  const waist = coat(0x2a3424), shirt = flat(0x8a8478);
  humanBody(sc, P, b, { skin: ghostSkin, torso: waist, hips: coat(0x2a2620), upperArm: shirt, foreArm: shirt, hand: ghostSkin, thigh: coat(0x2a2620), shin: coat(0x2a2620), shoe: 0x141210 });
  head(sc, P, b('head'), { skin: ghostSkin, nose: 1.1, ears: true, brow: 1.2, cheeks: 0.8, chin: 0.7 });
  eyeDetails(sc, P, b('head'), { size: 0.15, sclera: 0x2a2e32, iris: 0xd8e8ff, glow: 1.1 });
  cap(sc, P, b('head'), 0x1e2418, 0.4);
  // a walrus moustache and a watch chain
  sc.add({ t: 'ell', c: [0, P.headY - P.headR * 0.35, P.headR * 0.95], r: [P.headR * 0.5, P.headR * 0.14, P.headR * 0.2] }, { col: 0x5a5650, bone: b('head'), k: 0.8, surf: SURF.cloth });
  sc.detail(torus(4, 0.4, 4, 12, Math.PI), { col: PAL.brass, bone: b('chest'), pos: [3, P.waist + 2, P.waistW * P.depth + 1], rot: [0, 0, Math.PI], surf: SURF.brass });
  // the red-glassed hand lamp, swinging
  sc.detail(cyl(3.6, 4.2, 9, 10), { col: PAL.iron, bone: b('lantern'), pos: [-P.shoulderX - 4, P.wristY - 10, 3], surf: SURF.iron });
  sc.detail(cyl(3, 3, 5, 10), { col: 0xff2a20, bone: b('lantern'), pos: [-P.shoulderX - 4, P.wristY - 10, 3.4], emit: 2.4, surf: SURF.glass });
  sc.detail(torus(3, 0.5, 4, 10, Math.PI), { col: PAL.iron, bone: b('lantern'), pos: [-P.shoulderX - 4, P.wristY - 3, 3], surf: SURF.iron });
  const g: Gait = { ...GAIT_WALK, stride: 0.45, bob: 2.2, lean: 0.08 };
  const clips: Clips = {
    move: { frames: 30, fn: (t) => mix(gaitPose(t, g), { armR: { rx: -0.6 + 0.3 * sin(t), rz: 0.2 }, lantern: { rx: 0.4 * sin(t, 1, 0.2) } }) },
    // the lantern raised high and swung: stop the train
    attack: { frames: 16, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7));
      return { armR: { rx: -2.6 * k, rz: 0.4 * k + 0.25 * sin(t, 2) * k }, foreR: { rx: -0.2 }, lantern: { rx: 0.5 * sin(t, 2) * k }, chest: { rx: -0.2 * k }, head: { rx: -0.25 * k } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Clockwork Commuter
function commuter(): SculptModel {
  const P = prop(1, { headR: 11, chestW: 11.5, waistW: 10.5, hipW: 10.5, depth: 0.78 });
  const bones = humanBones(P, [{ name: 'key', parent: 'chest', head: [0, P.chest, -10] }, { name: 'brolly', parent: 'handL', head: [P.shoulderX + 3, P.wristY - 4, 2] }]);
  const b = bi(bones);
  const sc = new Sculpt(1.7, 2.2, 0.65);
  const suit = coat(0x2a2a30), face = flat(0xc8b890);
  humanBody(sc, P, b, { skin: face, torso: suit, hips: suit, upperArm: suit, foreArm: suit, hand: 0xd8d0c0, thigh: suit, shin: suit, shoe: 0x101010, gloves: true });
  // a porcelain-and-brass face with painted features, a crack across it
  head(sc, P, b('head'), { skin: face, nose: 0.8, ears: false, brow: 0.6, cheeks: 0.8, chin: 0.6, jaw: 0.9 });
  for (const s of [1, -1]) sc.detail(torus(P.headR * 0.18, 0.5, 4, 12), { col: PAL.brass, bone: b('head'), pos: [s * P.headR * 0.38, P.headY + P.headR * 0.12, P.headR * 0.92], surf: SURF.brass });
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * P.headR * 0.38, P.headY + P.headR * 0.12, P.headR * 0.96], 1.3, 0xfff0c0, 1.2);
  sc.detail(box(P.headR * 0.9, 0.5, 0.5), { col: 0x2a2018, bone: b('head'), pos: [0.5, P.headY + P.headR * 0.3, P.headR * 0.96], rot: [0, 0, 0.5], surf: SURF.paint });
  // the bowler hat
  sc.add({ t: 'ell', c: [0, P.headY + P.headR * 0.8, 0], r: [P.headR * 0.85, P.headR * 0.62, P.headR * 0.85] }, { col: 0x101012, bone: b('head'), k: 0.6, surf: SURF.paint });
  sc.detail(cyl(P.headR * 1.25, P.headR * 1.25, 0.8, 18), { col: 0x101012, bone: b('head'), pos: [0, P.headY + P.headR * 0.45, 0], surf: SURF.paint });
  // the wind-up key in its back, and a furled umbrella
  sc.detail(cyl(1, 1, 8, 6), { col: PAL.brass, bone: b('key'), pos: [0, P.chest, -12], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  for (const s of [1, -1]) sc.detail(torus(3, 1, 5, 10), { col: PAL.brass, bone: b('key'), pos: [s * 3.5, P.chest, -16], rot: [0, Math.PI / 2, 0], surf: SURF.brass });
  sc.detail(cyl(1.4, 0.5, 34, 6), { col: 0x101012, bone: b('brolly'), pos: [P.shoulderX + 3, P.wristY - 18, 2], surf: SURF.cloth });
  const g: Gait = { ...GAIT_WALK, stride: 0.5, knee: 0.4, bob: 1.2, arm: 0.5, elbow: 0.1, twist: 0.02, lean: 0, sway: 0.02 };
  const clips: Clips = {
    // a stiff wind-up march, the key turning
    move: { frames: 22, fn: (t) => mix(gaitPose(t, g), { key: { rz: t * Math.PI * 2 }, head: { ry: 0.1 * Math.sign(sin(t)) } }) },
    // the umbrella levelled like a lance
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.75)), thrust = pulse(t, 0.92, 0.08);
      return { armL: { rx: -1.5 * k, rz: -0.1 }, foreL: { rx: -0.1 }, brolly: { rx: 1.5 * k }, chest: { rx: 0.2 * k + 0.2 * thrust }, hips: { tz: 4 * thrust } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Newsboy Specter
function newsboy(): SculptModel {
  const P = prop(0.78, { headR: 12.5, chestW: 10, waistW: 9, hipW: 9.5, depth: 0.78 });
  const bones = humanBones(P, [{ name: 'paper', parent: 'handR', head: [-P.shoulderX - 2, P.wristY - 3, 3] }]);
  const b = bi(bones);
  const sc = new Sculpt(1.4, 2, 0.65);
  const jacket = coat(0x3a3428), shorts = coat(0x2a2620);
  humanBody(sc, P, b, { skin: ghostSkin, torso: jacket, hips: shorts, upperArm: jacket, foreArm: jacket, hand: ghostSkin, thigh: shorts, shin: flat(0x5a5650), shoe: 0x141210 });
  head(sc, P, b('head'), { skin: ghostSkin, nose: 0.8, ears: true, brow: 0.8, cheeks: 1, chin: 0.5, jaw: 0.85 });
  eyeDetails(sc, P, b('head'), { size: 0.2, sclera: 0x2a2e32, iris: 0xd8e8ff, glow: 1.3 });
  cap(sc, P, b('head'), flat(0x4a4438), 0.2);
  // the canvas bag of papers across the body, and one held up
  sc.add({ t: 'box', c: [P.chestW * 0.8, P.waist - 2, 2], h: [3, 7, 6], r: 1.5 }, { col: flat(0x8a7a58), bone: b('spine'), k: 1, surf: SURF.canvas });
  for (let i = 0; i < 3; i++) sc.detail(box(7, 0.4, 9), { col: 0xd0c8b0, bone: b('spine'), pos: [P.chestW * 0.8, P.waist + 4 + i * 0.6, 2], rot: [0, 0, 0.1 * i], surf: SURF.cloth });
  sc.detail(box(12, 9, 0.4), { col: 0xe0d8c0, bone: b('paper'), pos: [-P.shoulderX - 2, P.wristY + 3, 4], rot: [0.2, 0.3, 0], emit: 0.35, surf: SURF.cloth });
  const g: Gait = { ...GAIT_WALK, stride: 0.6, bob: 2.6, arm: 0.5, lift: 0.3 };
  const clips: Clips = {
    move: { frames: 22, fn: (t) => mix(gaitPose(t, g), { armR: { rx: -1.9, rz: 0.3 }, foreR: { rx: -0.2 }, head: { rx: -0.1 } }) },
    // "EXTRA!": the paper flung overarm
    attack: { frames: 12, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7)), fling = pulse(t, 0.9, 0.1);
      return { armR: { rx: -2.8 * k + 2 * fling, rz: 0.2 }, foreR: { rx: -0.6 * k }, chest: { ry: 0.4 * k - 0.6 * fling, rx: -0.1 * k } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Luggage Mimic
function mimic(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'base', parent: null, head: [0, 8, 0] },
    { name: 'lid', parent: 'base', head: [0, 22, -12] },
    { name: 'tongue', parent: 'base', head: [0, 18, 2] },
  ];
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) for (const [i, z] of [[0, 8], [1, -8]] as const) bones.push({ name: `leg${n}${i}`, parent: 'base', head: [s * 14, 6, z] });
  const b = bi(bones);
  const sc = new Sculpt(1.6, 1.8);
  const hide = flat(0x5a3a1e);
  // the trunk's body, banded and studded, its lid lifted into a jaw
  sc.add({ t: 'box', c: [0, 14, 0], h: [17, 8, 12], r: 2 }, { col: hide, bone: b('base'), k: 0, surf: SURF.wood });
  sc.add({ t: 'box', c: [0, 26, -1], h: [17, 4, 12], r: 2.5 }, { col: hide, bone: b('lid'), k: 0.5, surf: SURF.wood });
  for (const x of [-12, 12]) {
    sc.detail(box(2, 17, 25), { col: PAL.brass, bone: b('base'), pos: [x, 14, 0], surf: SURF.brass });
    sc.detail(box(2, 9, 25), { col: PAL.brass, bone: b('lid'), pos: [x, 26, -1], surf: SURF.brass });
  }
  // teeth along both lips, a tongue, a luggage label with a name nobody claims
  for (let i = 0; i < 8; i++) {
    const x = -14 + i * 4;
    sc.detail(cone(1.4, 4, 5), { col: 0xe0d8c0, bone: b('base'), pos: [x, 23.5, 11], surf: SURF.bone });
    sc.detail(cone(1.4, 4, 5), { col: 0xe0d8c0, bone: b('lid'), pos: [x + 2, 21.5, 10], rot: [Math.PI, 0, 0], surf: SURF.bone });
  }
  sc.add({ t: 'ell', c: [0, 21, 4], r: [7, 2.2, 8] }, { col: 0x8a2a3a, bone: b('tongue'), k: 1, surf: SURF.latex });
  sc.detail(box(6, 4, 0.4), { col: 0xd8c8a0, bone: b('base'), pos: [10, 12, 12.4], rot: [0, 0, 0.3], surf: SURF.paint });
  for (const s of [1, -1]) glowEye(sc, b('lid'), [s * 7, 29, 9], 1.6, 0xffd060, 1.6);
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) for (const [i, z] of [[0, 8], [1, -8]] as const) sc.add({ t: 'cap', a: [s * 14, 7, z], b: [s * 17, 0.5, z + 2], ra: 2.2, rb: 1.8 }, { col: 0x2a1a10, bone: b(`leg${n}${i}`), k: 1, surf: SURF.rubber });
  const legs = (t: number, k: number): Pose => ({ legL0: { rx: 0.7 * sin(t) * k }, legR1: { rx: 0.7 * sin(t) * k }, legR0: { rx: -0.7 * sin(t) * k }, legL1: { rx: -0.7 * sin(t) * k } });
  const clips: Clips = {
    // scuttling, the lid chattering
    move: { frames: 16, fn: (t) => mix(legs(t, 1), { base: { ty: Math.abs(sin(t)) * 1.5 }, lid: { rx: -0.25 - 0.2 * Math.abs(sin(t, 2)) }, tongue: { rx: 0.1 * sin(t, 2) } }) },
    // the hop and the gape
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.75)), snapShut = pulse(t, 0.92, 0.08);
      return mix(legs(0.25, 0.3), { base: { ty: 8 * Math.sin(Math.min(1, t) * Math.PI) }, lid: { rx: -1.1 * k + 1 * snapShut }, tongue: { rx: -0.4 * k, tz: 3 * k } });
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Gravebound
function gravebound(): SculptModel {
  const P = prop(1, { headR: 11, chestW: 10.5, waistW: 8.5, hipW: 9.5, depth: 0.72, arm: [3, 2.5, 2.1], leg: [3.8, 3, 2.5] });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.7, 2.4, 0.65);
  const shroud = flat(0x8a8270);
  humanBody(sc, P, b, { skin: graveSkin, torso: shroud, hips: shroud, upperArm: graveSkin, foreArm: graveSkin, hand: graveSkin, thigh: shroud, shin: graveSkin, shoe: graveSkin });
  // the burial suit gone to rags, ribs showing through a tear
  for (let i = 0; i < 4; i++) sc.add({ t: 'cap', a: [-6, P.chest + 4 - i * 3.5, P.chestW * P.depth - 0.5], b: [6, P.chest + 4 - i * 3.5, P.chestW * P.depth - 0.5], ra: 0.9, rb: 0.9 }, { col: 0xc8c0a0, bone: b('chest'), k: 0.5, surf: SURF.bone });
  head(sc, P, b('head'), { skin: graveSkin, nose: 0.5, ears: false, brow: 1.4, cheeks: 0.3, chin: 0.7, jaw: 0.9 });
  for (const s of [1, -1]) sc.add({ t: 'sph', c: [s * P.headR * 0.38, P.headY + P.headR * 0.1, P.headR * 0.85], r: P.headR * 0.24 }, { sub: true, k: 1 });
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * P.headR * 0.38, P.headY + P.headR * 0.1, P.headR * 0.7], 1.6, 0xb8ff90, 1.6);
  sc.add({ t: 'box', c: [0, P.headY - P.headR * 0.55, P.headR * 0.8], h: [P.headR * 0.4, P.headR * 0.12, 2], r: 0.5 }, { sub: true, k: 0.8 });
  // soil clinging to the legs and a wilted funeral lily in the lapel
  sc.add({ t: 'ell', c: [0, 6, 0], r: [10, 5, 8] }, { col: flat(0x2a2216), bone: b('hips'), k: 2, surf: SURF.cloth });
  sc.detail(cone(1.6, 4, 6), { col: 0xd8d0b0, bone: b('chest'), pos: [6, P.chest + 4, P.chestW * P.depth + 1], rot: [0.6, 0, -0.4], surf: SURF.cloth });
  const reach: Pose = { armL: { rx: -1.3, rz: 0.15 }, armR: { rx: -1.2, rz: -0.12 }, foreL: { rx: -0.25 }, foreR: { rx: -0.4 } };
  const clips: Clips = {
    move: { frames: 32, fn: (t) => mix(gaitPose(t, shamble), reach, { chest: { rx: 0.3, rz: 0.12 * sin(t) }, head: { rz: 0.3 * sin(t, 1, 0.2), rx: 0.15 } }) },
    // clawing up out of the grave: both arms over its head, hauling
    rise: { frames: 24, loop: false, fn: (t) => {
      const k = ease(t), claw = sin(t, 3);
      return { armL: { rx: -2.6 + 1.2 * k + 0.4 * claw, rz: 0.3 }, armR: { rx: -2.6 + 1.2 * k - 0.4 * claw, rz: -0.3 }, foreL: { rx: -0.6 }, foreR: { rx: -0.6 }, chest: { rx: 0.55 - 0.3 * k }, head: { rx: -0.4 + 0.5 * k } };
    } },
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7));
      return mix(reach, { armL: { rx: -2 * k }, armR: { rx: -2 * k }, chest: { rx: 0.4 * k }, hips: { tz: 3 * k } });
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Shroud Moth
function moth(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 0, 0] },
    { name: 'wingL', parent: 'body', head: [2, 1, 0] },
    { name: 'wingR', parent: 'body', head: [-2, 1, 0] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1.1, 1.4);
  const fur = flat(0xd8d0c0);
  sc.add({ t: 'ell', c: [0, 0, 0], r: [3, 3, 9] }, { col: fur, bone: b('body'), k: 0, surf: SURF.plush });
  sc.add({ t: 'sph', c: [0, 1, 8], r: 3.4 }, { col: fur, bone: b('body'), k: 1.5, surf: SURF.plush });
  for (const s of [1, -1]) {
    glowEye(sc, b('body'), [s * 2, 2, 10.5], 1.3, 0xfff0d0, 1.8);
    sc.detail(cyl(0.3, 0.2, 9, 4), { col: 0x8a8070, bone: b('body'), pos: [s * 2.5, 5, 12], rot: [0.9, 0, s * 0.5], surf: SURF.cloth });
  }
  // broad pale wings with dark eye-spots
  const wing = (n: 'L' | 'R', s: number) => {
    sc.detail(ellipsoid(13, 0.5, 9, 12, 4), { col: 0xe0d8c8, bone: b(`wing${n}`), pos: [s * 13, 1, 3], rot: [0, s * -0.3, 0], surf: SURF.cloth, emit: 0.25 });
    sc.detail(ellipsoid(9, 0.5, 6, 10, 4), { col: 0xd0c8b8, bone: b(`wing${n}`), pos: [s * 9, 0.6, -6], rot: [0, s * 0.4, 0], surf: SURF.cloth, emit: 0.2 });
    sc.detail(cyl(2.4, 2.4, 0.7, 10), { col: 0x2a2228, bone: b(`wing${n}`), pos: [s * 15, 1.4, 3], surf: SURF.cloth });
  };
  wing('L', 1);
  wing('R', -1);
  const clips: Clips = {
    move: { frames: 8, fn: (t) => ({ wingL: { rz: 0.9 * sin(t) }, wingR: { rz: -0.9 * sin(t) }, body: { ty: 1.2 * sin(t, 1, 0.25) } }) },
    attack: { frames: 10, loop: false, fn: (t) => ({ wingL: { rz: 1.2 * sin(t, 3) }, wingR: { rz: -1.2 * sin(t, 3) }, body: { rx: 0.5 * ease(t) } }) },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== the Pallbearers
function pallbearers(): SculptModel {
  const bones: BoneDef[] = [{ name: 'coffin', parent: null, head: [0, 52, 0] }];
  const spots: [number, number][] = [[14, 22], [-14, 22], [14, -22], [-14, -22]];
  spots.forEach((_, i) => bones.push({ name: `b${i}`, parent: 'coffin', head: [spots[i][0], 30, spots[i][1]] }, { name: `l${i}`, parent: `b${i}`, head: [spots[i][0], 16, spots[i][1]] }));
  const b = bi(bones);
  const sc = new Sculpt(2, 2.6);
  // four black-gloved bearers, heads bowed under the coffin
  spots.forEach(([x, z], i) => {
    sc.add({ t: 'cap', a: [x, 26, z], b: [x, 42, z], ra: 6.5, rb: 7.5, sz: 0.8 }, { col: black, bone: b(`b${i}`), k: 2, surf: SURF.velvet });
    sc.add({ t: 'sph', c: [x, 47, z + 2], r: 5.4 }, { col: ghostSkin, bone: b(`b${i}`), k: 2, surf: SURF.skin });
    sc.add({ t: 'ell', c: [x, 51, z + 1], r: [6, 2.6, 6] }, { col: 0x101012, bone: b(`b${i}`), k: 0.8, surf: SURF.paint });
    sc.add({ t: 'cap', a: [x, 26, z], b: [x + (x > 0 ? 1 : -1), 2, z + 1], ra: 4, rb: 3 }, { col: black, bone: b(`l${i}`), k: 1.5, surf: SURF.velvet });
    sc.add({ t: 'cap', a: [x + (x > 0 ? 6 : -6), 42, z], b: [x + (x > 0 ? 7 : -7), 53, z], ra: 2.4, rb: 2.2 }, { col: 0x141214, bone: b(`b${i}`), k: 1, surf: SURF.cloth });
    glowEye(sc, b(`b${i}`), [x, 47.5, z + 7], 1, 0xd8e0ff, 1.2);
  });
  // the coffin: dark wood, brass handles, no name plate
  sc.add({ t: 'box', c: [0, 58, 0], h: [15, 4.5, 31], r: 1.5 }, { col: flat(0x2a1a12), bone: b('coffin'), k: 0, surf: SURF.wood });
  sc.add({ t: 'box', c: [0, 63.5, 0], h: [13, 1.5, 28], r: 1 }, { col: flat(0x3a2418), bone: b('coffin'), k: 0.5, surf: SURF.wood });
  for (const s of [1, -1]) for (const z of [-18, 0, 18]) sc.detail(box(1.2, 2, 6), { col: PAL.brass, bone: b('coffin'), pos: [s * 15.6, 58, z], surf: SURF.brass });
  sc.detail(box(8, 0.4, 5), { col: 0x6a5a3a, bone: b('coffin'), pos: [0, 65.6, 10], surf: SURF.brass });
  const clips: Clips = {
    // slow and in step: the coffin rocks
    move: { frames: 40, fn: (t) => {
      const p: Pose = { coffin: { ty: 1.4 * sin(t, 2), rz: 0.03 * sin(t) } };
      spots.forEach((_, i) => {
        p[`l${i}`] = { rx: 0.4 * sin(t, 1, i % 2 ? 0.5 : 0) };
        p[`b${i}`] = { ty: -1 * Math.abs(sin(t, 1, i % 2 ? 0.5 : 0)) };
      });
      return p;
    } },
    // the coffin lifted overhead and brought down
    attack: { frames: 18, loop: false, fn: (t) => {
      const up = ease(Math.min(1, t / 0.75)), down = pulse(t, 0.92, 0.08);
      return { coffin: { ty: 18 * up - 26 * down, rx: -0.2 * up } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Slag Golem
function slagGolem(): SculptModel {
  const P = prop(1.6, { headR: 9, chestW: 17, waistW: 14, hipW: 13, depth: 0.9, arm: [6.5, 6, 6.5], leg: [6.5, 5.5, 5], neck: 60, headY: 66 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(2.4, 3.2, 0.65);
  humanBody(sc, P, b, { skin: slagCol, torso: slagCol, hips: slagCol, upperArm: slagCol, foreArm: slagCol, hand: slagCol, thigh: slagCol, shin: slagCol, shoe: slagCol, torsoSurf: SURF.rubber, legSurf: SURF.rubber });
  // a hunched mound of shoulders, the head sunk into it, great dripping fists
  sc.add({ t: 'ell', c: [0, P.shoulderY + 2, -4], r: [P.chestW * 1.2, 12, 14] }, { col: slagCol, bone: b('chest'), k: 6, surf: SURF.rubber });
  sc.add({ t: 'sph', c: [0, P.headY - 4, 6], r: P.headR * 1.1 }, { col: slagCol, bone: b('head'), k: 4, surf: SURF.rubber });
  for (const s of [1, -1]) {
    sc.add({ t: 'sph', c: [s * (P.shoulderX + P.armOut * 1.6), P.wristY - 8, 2], r: 9 }, { col: slagCol, bone: b(s > 0 ? 'handL' : 'handR'), k: 3, surf: SURF.rubber });
    glowEye(sc, b('head'), [s * 3.5, P.headY - 3, 15], 2, 0xffe080, 2.2);
  }
  // drips and a glowing core
  sc.detail(sphere(6, 12, 10), { col: 0xffa040, bone: b('chest'), pos: [0, P.chest, P.chestW * P.depth - 2], emit: 2.4, surf: SURF.bulb });
  const g: Gait = { ...GAIT_WALK, stride: 0.3, knee: 0.45, bob: 4, sway: 0.18, twist: 0.08, arm: 0.2, elbow: 0.2, lean: 0.25 };
  const clips: Clips = {
    move: { frames: 40, fn: (t) => mix(gaitPose(t, g), { armL: { rx: 0.3 * sin(t), rz: -0.25 }, armR: { rx: -0.3 * sin(t), rz: 0.25 } }) },
    // both fists up, then down: the slam
    attack: { frames: 18, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.75)), slam = pulse(t, 0.92, 0.08);
      return { armL: { rx: -2.8 * k + 2.4 * slam, rz: -0.1 }, armR: { rx: -2.8 * k + 2.4 * slam, rz: 0.1 }, chest: { rx: -0.3 * k + 0.7 * slam }, hips: { ty: 4 * k - 6 * slam } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Riveter
function riveter(): SculptModel {
  const P = prop(1.05, { headR: 10, chestW: 13, waistW: 11, hipW: 11, depth: 0.95, arm: [4, 3.6, 3.2], leg: [4.6, 4, 3.6] });
  const bones = humanBones(P, [{ name: 'gun', parent: 'foreR', head: [-P.shoulderX - P.armOut, P.elbowY, 0] }]);
  const b = bi(bones);
  const sc = new Sculpt(1.7, 2.2, 0.65);
  const plate = flat(0x3a3a3c);
  humanBody(sc, P, b, { skin: plate, torso: plate, hips: plate, upperArm: plate, foreArm: plate, hand: plate, thigh: plate, shin: plate, shoe: 0x1a1a1c, torsoSurf: SURF.iron, legSurf: SURF.iron, gloves: true });
  // a boiler for a chest, riveted seams, a round head with one lens
  sc.add({ t: 'cap', a: [0, P.waist - 4, 0], b: [0, P.shoulderY, 0], ra: P.chestW * 0.95, rb: P.chestW, sz: 0.95 }, { col: plate, bone: b('chest'), k: 2, surf: SURF.iron });
  for (const y of [P.waist, P.chest, P.shoulderY - 3]) sc.detail(torus(P.chestW * 0.97, 0.7, 5, 22), { col: PAL.brass, bone: b('chest'), pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  sc.add({ t: 'sph', c: [0, P.headY, 0], r: P.headR }, { col: plate, bone: b('head'), k: 2, surf: SURF.iron });
  sc.detail(cyl(4, 4.5, 3, 12), { col: PAL.brass, bone: b('head'), pos: [0, P.headY, P.headR - 0.5], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  glowEye(sc, b('head'), [0, P.headY, P.headR + 1.2], 3, 0xff9a40, 2);
  // the rivet gun for a right forearm, a hose to the back
  sc.detail(cyl(3.8, 3.2, 20, 10), { col: PAL.iron, bone: b('gun'), pos: [-P.shoulderX - P.armOut, P.elbowY - 10, 6], rot: [Math.PI / 2 + 0.3, 0, 0], surf: SURF.iron });
  sc.detail(cyl(1.4, 1.4, 6, 8), { col: 0xff6a20, bone: b('gun'), pos: [-P.shoulderX - P.armOut, P.elbowY - 13, 17], rot: [Math.PI / 2 + 0.3, 0, 0], emit: 1.6, surf: SURF.bulb });
  sc.detail(cyl(5, 5, 14, 10), { col: 0x3a3a3c, bone: b('chest'), pos: [0, P.chest + 2, -P.chestW - 3], surf: SURF.iron });
  const g: Gait = { ...GAIT_WALK, stride: 0.4, knee: 0.5, bob: 1.8, arm: 0.2, twist: 0.05 };
  const clips: Clips = {
    move: { frames: 30, fn: (t) => mix(gaitPose(t, g), { armR: { rx: -0.9, rz: 0.1 }, foreR: { rx: -0.6 } }) },
    // the gun levelled and braced
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7)), kick = pulse(t, 0.9, 0.1);
      return { armR: { rx: -1.5 * k, rz: 0.1 }, foreR: { rx: -0.05 * k }, gun: { rx: -0.3 * kick }, chest: { rx: -0.15 * kick }, armL: { rx: -0.6 * k, rz: -0.4 * k } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Furnace Hound
function hound(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 18, 0] },
    { name: 'neck', parent: 'body', head: [0, 22, 14] },
    { name: 'head', parent: 'neck', head: [0, 25, 20] },
    { name: 'jaw', parent: 'head', head: [0, 21, 24] },
    { name: 'tail', parent: 'body', head: [0, 21, -16] },
  ];
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) for (const [z, f] of [[11, 'F'], [-11, 'B']] as const) bones.push({ name: `leg${f}${n}`, parent: 'body', head: [s * 6, 16, z] }, { name: `paw${f}${n}`, parent: `leg${f}${n}`, head: [s * 6.5, 7, z + 1] });
  const b = bi(bones);
  const sc = new Sculpt(1.6, 2);
  // an iron dog: a riveted barrel of a body with a firebox glowing through its belly grate
  sc.add({ t: 'cap', a: [0, 19, -12], b: [0, 21, 12], ra: 8, rb: 9, sz: 0.9 }, { col: iron, bone: b('body'), k: 0, surf: SURF.iron });
  sc.add({ t: 'cap', a: [0, 22, 12], b: [0, 26, 20], ra: 5, rb: 4.5 }, { col: iron, bone: b('neck'), k: 2, surf: SURF.iron });
  sc.add({ t: 'box', c: [0, 26, 25], h: [5, 4.5, 7], r: 2 }, { col: iron, bone: b('head'), k: 1.5, surf: SURF.iron });
  sc.add({ t: 'box', c: [0, 21.5, 26], h: [4, 1.6, 6], r: 1 }, { col: iron, bone: b('jaw'), k: 0.5, surf: SURF.iron });
  for (const s of [1, -1]) {
    sc.detail(cone(2, 6, 6), { col: PAL.iron, bone: b('head'), pos: [s * 3.5, 31.5, 21], rot: [-0.3, 0, s * -0.3], surf: SURF.iron });
    glowEye(sc, b('head'), [s * 2.6, 27.5, 31.6], 1.2, 0xff8a30, 2.2);
  }
  sc.detail(box(10, 1.2, 14), { col: 0xff6a18, bone: b('body'), pos: [0, 11.6, 0], emit: 2.4, surf: SURF.bulb });
  for (let i = 0; i < 5; i++) sc.detail(box(11, 1.2, 1), { col: PAL.iron, bone: b('body'), pos: [0, 11, -6 + i * 3], surf: SURF.iron });
  sc.detail(cyl(1.6, 2, 7, 8), { col: PAL.iron, bone: b('body'), pos: [0, 29, -4], surf: SURF.iron });
  sc.detail(ellipsoid(4, 1, 4, 8, 4), { col: 0xff8a30, bone: b('jaw'), pos: [0, 23, 26], emit: 1.4, surf: SURF.bulb });
  sc.add({ t: 'cap', a: [0, 21, -16], b: [0, 27, -24], ra: 1.6, rb: 1 }, { col: iron, bone: b('tail'), k: 1, surf: SURF.iron });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) for (const [z, f] of [[11, 'F'], [-11, 'B']] as const) {
    sc.add({ t: 'cap', a: [s * 6, 16, z], b: [s * 6.5, 7, z + 1], ra: 2.6, rb: 2 }, { col: iron, bone: b(`leg${f}${n}`), k: 1, surf: SURF.iron });
    sc.add({ t: 'cap', a: [s * 6.5, 7, z + 1], b: [s * 6.5, 1, z + 2], ra: 2, rb: 2.4 }, { col: iron, bone: b(`paw${f}${n}`), k: 1, surf: SURF.iron });
  }
  const gallop = (t: number): Pose => ({
    legFL: { rx: 0.8 * sin(t) }, legFR: { rx: 0.8 * sin(t, 1, 0.1) }, legBL: { rx: -0.8 * sin(t, 1, 0.5) }, legBR: { rx: -0.8 * sin(t, 1, 0.6) },
    pawFL: { rx: -0.4 * Math.max(0, sin(t)) }, pawFR: { rx: -0.4 * Math.max(0, sin(t, 1, 0.1)) },
    body: { ty: 1.6 * Math.abs(sin(t)), rx: 0.08 * sin(t) }, head: { rx: -0.08 * sin(t) }, tail: { rx: 0.4 * sin(t, 2) },
  });
  const clips: Clips = {
    move: { frames: 16, fn: (t) => gallop(t) },
    // haunches down, then the charge (jaws wide)
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.75));
      return { body: { rx: -0.25 * k, ty: -2 * k }, legBL: { rx: 0.6 * k }, legBR: { rx: 0.6 * k }, legFL: { rx: -0.4 * k }, legFR: { rx: -0.4 * k }, jaw: { rx: 0.6 * k }, head: { rx: -0.2 * k } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Still Folk
function stillfolk(): SculptModel {
  const P = prop(1, { headR: 11, chestW: 11, waistW: 9.5, hipW: 10.5, depth: 0.76 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.7, 2.3, 0.65);
  // villagers gone to stone-grey where they stood, cracked, a pocket-watch face for each eye
  const stone = flat(C(0x8a8a86).lerp(C(0x4a4a48), 0.45));
  const dress = flat(0x5a5248);
  humanBody(sc, P, b, { skin: stone, torso: dress, hips: dress, upperArm: dress, foreArm: stone, hand: stone, thigh: dress, shin: stone, shoe: 0x2a2826, noLegs: false });
  sc.add({ t: 'cap', a: [0, P.hip + 3, 0], b: [0, 4, 0], ra: P.hipW, rb: P.hipW * 1.5, sz: 0.9 }, { col: dress, bone: b('hips'), k: 2, surf: SURF.cloth });
  head(sc, P, b('head'), { skin: stone, nose: 0.9, ears: true, brow: 0.9, cheeks: 0.7, chin: 0.6 });
  for (const s of [1, -1]) {
    sc.detail(cyl(P.headR * 0.22, P.headR * 0.22, 0.6, 12), { col: 0xe8e0c8, bone: b('head'), pos: [s * P.headR * 0.38, P.headY + P.headR * 0.12, P.headR * 0.95], rot: [Math.PI / 2, 0, 0], emit: 0.9, surf: SURF.porcelain });
    sc.detail(box(0.4, P.headR * 0.18, 0.3), { col: 0x1a1a1a, bone: b('head'), pos: [s * P.headR * 0.38, P.headY + P.headR * 0.2, P.headR * 1.0], surf: SURF.paint });
  }
  // a shawl and a bonnet
  sc.add({ t: 'ell', c: [0, P.shoulderY, 0], r: [P.chestW * 1.15, 5, P.chestW * 0.9] }, { col: flat(0x3a3a44), bone: b('chest'), k: 2, surf: SURF.cloth });
  sc.add({ t: 'ell', c: [0, P.headY + P.headR * 0.3, -P.headR * 0.2], r: [P.headR * 1.1, P.headR * 0.9, P.headR * 1.0] }, { col: flat(0x4a4440), bone: b('head'), k: 0.8, surf: SURF.cloth });
  const g: Gait = { ...GAIT_WALK, stride: 0.7, knee: 0.9, bob: 1.5, arm: 0.7, twist: 0.2, lean: 0.25 };
  const clips: Clips = {
    // the jerky, stop-motion sprint of something that forgot how to move and remembered all at once
    move: { frames: 16, fn: (t) => gaitPose(Math.floor(t * 8) / 8, g) },
    attack: { frames: 12, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7));
      return { armL: { rx: -1.6 * k, rz: 0.2 }, armR: { rx: -1.6 * k, rz: -0.2 }, chest: { rx: 0.4 * k }, head: { rx: -0.3 * k, rz: 0.3 * k } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== the Watcher
function watcher(): SculptModel {
  const P = prop(1.7, { headR: 6.5, chestW: 7, waistW: 5.5, hipW: 6, depth: 0.6, arm: [2, 1.6, 1.3], leg: [2.6, 2, 1.6] });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.9, 2.6, 0.65);
  // tall and thin, too tall, in a long black coat and a stovepipe hat; two pinprick eyes
  humanBody(sc, P, b, { skin: 0x1a1a1e, torso: black, hips: black, upperArm: black, foreArm: black, hand: 0x1a1a1e, thigh: black, shin: black, shoe: 0x0a0a0c });
  skirt(sc, P, b('hips'), black, 40, 1.4);
  sc.add({ t: 'ell', c: [0, P.headY, 0], r: [P.headR, P.headR * 1.35, P.headR] }, { col: 0x1a1a1e, bone: b('head'), k: 2, surf: SURF.skin });
  sc.detail(cyl(P.headR * 0.95, P.headR * 1.0, P.headR * 2.4, 14), { col: 0x0a0a0c, bone: b('head'), pos: [0, P.headY + P.headR * 2.2, 0], surf: SURF.paint });
  sc.detail(cyl(P.headR * 1.6, P.headR * 1.6, 0.8, 16), { col: 0x0a0a0c, bone: b('head'), pos: [0, P.headY + P.headR * 1.05, 0], surf: SURF.paint });
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * P.headR * 0.35, P.headY + P.headR * 0.1, P.headR * 0.95], 0.9, 0xfff8e0, 2.6);
  const clips: Clips = {
    // it does not walk while you look: it stands, swaying very slightly, its head tilting
    move: { frames: 60, fn: (t) => ({ hips: { rz: 0.02 * sin(t) }, head: { rz: 0.12 * sin(t, 1, 0.3), rx: 0.08 }, armL: { rz: -0.05 }, armR: { rz: 0.05 } }) },
    // the stare: the head comes forward and down
    attack: { frames: 20, loop: false, fn: (t) => {
      const k = ease(t);
      return { neck: { rx: 0.5 * k }, head: { rx: 0.35 * k, rz: 0.25 * k }, chest: { rx: 0.15 * k } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== Bell Wraith
function bellwraith(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 30, 0] },
    { name: 'head', parent: 'body', head: [0, 52, 2] },
    { name: 'arm', parent: 'body', head: [-9, 46, 2] },
    { name: 'bell', parent: 'arm', head: [-16, 34, 10] },
    { name: 'hem', parent: 'body', head: [0, 10, 0] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1.7, 2.2);
  const shroud = flat(0xc8c0b0);
  // a shroud on nothing, its hem in tatters, a hand-bell in one bony hand
  sc.add({ t: 'cap', a: [0, 50, 0], b: [0, 12, 0], ra: 8, rb: 14, sz: 0.9 }, { col: shroud, bone: b('body'), k: 0, surf: SURF.cloth });
  sc.add({ t: 'ell', c: [0, 55, 1], r: [8, 9, 8] }, { col: shroud, bone: b('head'), k: 3, surf: SURF.cloth });
  sc.add({ t: 'ell', c: [0, 54, 7], r: [5, 6, 3] }, { sub: true, k: 1.5 });
  sc.detail(ellipsoid(4.4, 5.4, 1, 10, 6), { col: 0x0a0a0e, bone: b('head'), pos: [0, 54, 5.6], surf: SURF.rubber });
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * 1.8, 55, 6.2], 0.9, 0x9ad8ff, 2);
  const r = stream(33);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    sc.add({ t: 'cap', a: [Math.cos(a) * 12, 14, Math.sin(a) * 11], b: [Math.cos(a) * 14, 2 + r() * 4, Math.sin(a) * 13], ra: 2.6, rb: 0.6 }, { col: shroud, bone: b('hem'), k: 1.5, surf: SURF.cloth });
  }
  sc.add({ t: 'cap', a: [-8, 46, 2], b: [-15, 36, 9], ra: 3, rb: 2.4 }, { col: shroud, bone: b('arm'), k: 1.5, surf: SURF.cloth });
  sc.add({ t: 'cap', a: [-15, 36, 9], b: [-16, 32, 10], ra: 1.2, rb: 1 }, { col: graveSkin, bone: b('bell'), k: 0.6, surf: SURF.bone });
  sc.detail(cone(4.5, 7, 14), { col: PAL.brass, bone: b('bell'), pos: [-16, 27, 10], surf: SURF.brass });
  sc.detail(cyl(0.8, 0.8, 5, 6), { col: 0x2a1e14, bone: b('bell'), pos: [-16, 33, 10], surf: SURF.wood });
  const clips: Clips = {
    // it drifts, the hem trailing, the bell swinging slow
    move: { frames: 40, fn: (t) => ({ body: { ty: 2 * sin(t), rz: 0.04 * sin(t, 1, 0.3) }, hem: { rz: 0.08 * sin(t, 1, 0.5), rx: 0.08 }, arm: { rx: -0.2 + 0.15 * sin(t) }, bell: { rz: 0.3 * sin(t, 2) } }) },
    // the toll: the bell rung hard
    attack: { frames: 16, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7));
      return { arm: { rx: -1.6 * k, rz: 0.3 * k }, bell: { rz: 0.9 * sin(t, 4) * k }, head: { rx: -0.3 * k } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== the Collected
function collected(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 30, 0] },
    { name: 'top', parent: 'body', head: [0, 50, 0] },
    { name: 'armL', parent: 'top', head: [18, 52, 2] },
    { name: 'armR', parent: 'top', head: [-18, 52, 2] },
    { name: 'legL', parent: 'body', head: [10, 18, 0] },
    { name: 'legR', parent: 'body', head: [-10, 18, 0] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(2.2, 3);
  const flesh = flat(C(0x8a8a90).lerp(C(0x4a3a40), 0.5));
  // a mass of passengers pressed into one: hats, coats, faces, too many hands
  sc.add({ t: 'ell', c: [0, 34, 0], r: [22, 22, 18] }, { col: flesh, bone: b('body'), k: 0, surf: SURF.skin });
  sc.add({ t: 'ell', c: [0, 54, -2], r: [18, 14, 15] }, { col: flesh, bone: b('top'), k: 8, surf: SURF.skin });
  const r = stream(44);
  const faces: [number, number, number][] = [[0, 60, 13], [-11, 48, 14], [12, 44, 15], [-4, 36, 17], [14, 30, 13], [-14, 28, 13]];
  faces.forEach(([x, y, z], i) => {
    sc.add({ t: 'sph', c: [x, y, z], r: 6.2 }, { col: ghostSkin, bone: b(i === 0 ? 'top' : 'body'), k: 2.5, surf: SURF.skin });
    for (const s of [1, -1]) glowEye(sc, b(i === 0 ? 'top' : 'body'), [x + s * 2.2, y + 1, z + 5.4], 0.9, 0xd8e0ff, 1.5);
    sc.add({ t: 'ell', c: [x, y - 2.5, z + 5.5], r: [1.6, 1.2, 1] }, { sub: true, k: 0.6 });
    if (i % 2 === 0) sc.detail(cyl(5, 5.5, 4, 12), { col: 0x141214, bone: b(i === 0 ? 'top' : 'body'), pos: [x, y + 6, z - 1], rot: [-0.3, 0, 0.2 * (r() - 0.5)], surf: SURF.paint });
  });
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    sc.add({ t: 'cap', a: [Math.cos(a) * 16, 30 + r() * 20, Math.sin(a) * 12], b: [Math.cos(a) * 26, 22 + r() * 16, Math.sin(a) * 18], ra: 2.4, rb: 1.8 }, { col: ghostSkin, bone: b('body'), k: 1.5, surf: SURF.skin });
  }
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    sc.add({ t: 'cap', a: [s * 18, 52, 2], b: [s * 30, 30, 8], ra: 5.5, rb: 4.5 }, { col: flat(0x2a2830), bone: b(`arm${n}`), k: 3, surf: SURF.cloth });
    sc.add({ t: 'sph', c: [s * 31, 27, 9], r: 5 }, { col: ghostSkin, bone: b(`arm${n}`), k: 2, surf: SURF.skin });
    sc.add({ t: 'cap', a: [s * 10, 18, 0], b: [s * 11, 2, 2], ra: 6, rb: 5 }, { col: flat(0x2a2830), bone: b(`leg${n}`), k: 2, surf: SURF.cloth });
  }
  const clips: Clips = {
    move: { frames: 44, fn: (t) => ({ legL: { rx: 0.4 * sin(t) }, legR: { rx: -0.4 * sin(t) }, body: { ty: 2 * Math.abs(sin(t)), rz: 0.08 * sin(t) }, top: { rz: -0.1 * sin(t, 1, 0.2) }, armL: { rx: 0.3 * sin(t, 1, 0.5) }, armR: { rx: -0.3 * sin(t, 1, 0.5) } }) },
    // the mass rears and falls forward
    attack: { frames: 18, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.75)), fall = pulse(t, 0.9, 0.1);
      return { top: { rx: -0.5 * k + 0.8 * fall }, armL: { rx: -2.2 * k + 1.6 * fall }, armR: { rx: -2.2 * k + 1.6 * fall }, body: { ty: 4 * k } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

// ================================================================== the Ticket Puncher, and the Inspector
function puncher(k: number, inspector: boolean): SculptModel {
  const P = prop(k, inspector
    ? { headR: 11, chestW: 15, waistW: 15, hipW: 13, depth: 0.88, arm: [4.6, 4, 3.4], leg: [5.4, 4.4, 3.6] }
    : { headR: 10.5, chestW: 11, waistW: 9.5, hipW: 10, depth: 0.76, arm: [3.4, 3, 2.6], leg: [4.2, 3.4, 2.8] });
  const bones = humanBones(P, [{ name: 'punch', parent: 'handR', head: [-P.shoulderX - P.armOut * 1.6, P.wristY - 4, 2] }]);
  const b = bi(bones);
  const sc = new Sculpt(inspector ? 2.2 : 1.7, inspector ? 3 : 2.3, 0.65);
  const uniform = coat(inspector ? 0x1a2030 : 0x22242c);
  humanBody(sc, P, b, { skin: ghostSkin, torso: uniform, hips: uniform, upperArm: uniform, foreArm: uniform, hand: 0xd8d4c8, thigh: uniform, shin: uniform, shoe: 0x0e0e10, gloves: true });
  skirt(sc, P, b('hips'), uniform, inspector ? 26 * k : 18 * k, 1.3);
  head(sc, P, b('head'), { skin: ghostSkin, nose: 1.2, ears: true, brow: 1.4, cheeks: 0.6, chin: 1, jaw: inspector ? 1.15 : 0.95 });
  eyeDetails(sc, P, b('head'), { size: 0.14, sclera: 0x2a2e32, iris: inspector ? 0xffd080 : 0xd8e8ff, glow: 1.4 });
  cap(sc, P, b('head'), 0x10141c, 0.6, 0xc8a050);
  // the badge on the cap and brass buttons, a ticket rack across the chest
  sc.detail(box(4, 3, 0.6), { col: PAL.brass, bone: b('head'), pos: [0, P.headY + P.headR * 0.62, P.headR * 1.0], surf: SURF.brass });
  for (let i = 0; i < 5; i++) for (const s of [1, -1]) sc.detail(sphere(0.9 * k, 6, 5), { col: PAL.brass, bone: b('chest'), pos: [s * 4 * k, P.chest + 6 * k - i * 5 * k, P.chestW * P.depth + 0.5], surf: SURF.brass });
  if (inspector) {
    // a ledger in the left hand, its pages full of punched names; a lamp on a chain at his belt
    sc.detail(box(14, 18, 4), { col: 0x3a1a14, bone: b('handL'), pos: [P.shoulderX + P.armOut * 1.6 + 2, P.wristY - 8, 4], rot: [0.2, -0.3, 0], surf: SURF.wood });
    sc.detail(sphere(3.2, 10, 8), { col: 0xffd080, bone: b('hips'), pos: [P.hipW, P.hip - 4, 6], emit: 1.8, surf: SURF.bulb });
  }
  // the punch: a brass clamp as long as a forearm
  const L = inspector ? 1.3 : 1;
  sc.detail(box(3.2 * L, 16 * L, 6 * L), { col: PAL.brass, bone: b('punch'), pos: [-P.shoulderX - P.armOut * 1.6, P.wristY - 12 * L, 4], surf: SURF.brass });
  sc.detail(box(3.4 * L, 10 * L, 2 * L), { col: PAL.brass, bone: b('punch'), pos: [-P.shoulderX - P.armOut * 1.6, P.wristY - 15 * L, 8 * L], rot: [-0.25, 0, 0], surf: SURF.brass });
  sc.detail(cyl(1.2 * L, 1.2 * L, 4 * L, 8), { col: 0xffe0a0, bone: b('punch'), pos: [-P.shoulderX - P.armOut * 1.6, P.wristY - 20 * L, 6 * L], rot: [0, 0, Math.PI / 2], emit: 1.2, surf: SURF.bulb });
  const g: Gait = inspector ? { ...GAIT_WALK, stride: 0.38, knee: 0.55, bob: 3, sway: 0.1, arm: 0.25, lean: 0.05 } : { ...GAIT_WALK, stride: 0.62, bob: 2.4, arm: 0.5, lean: 0.15 };
  const clips: Clips = {
    move: { frames: inspector ? 38 : 24, fn: (t) => mix(gaitPose(t, g), { armR: { rx: -0.6 + 0.2 * sin(t), rz: 0.15 }, foreR: { rx: -0.7 }, punch: { rx: 0.1 * sin(t, 2) } }) },
    // the punch raised, then down on your ticket (and your hand)
    attack: { frames: inspector ? 18 : 14, loop: false, fn: (t) => {
      const up = ease(Math.min(1, t / 0.72)), down = pulse(t, 0.92, 0.08);
      return { armR: { rx: -2.4 * up + 1.8 * down, rz: 0.1 }, foreR: { rx: -0.4 * up }, punch: { rx: 0.5 * down }, chest: { rx: -0.15 * up + 0.35 * down }, head: { rx: 0.15 * up } };
    } },
  };
  return { geo: sc.build(CREATURE), rig: new Rig(bones, clips) };
}

/** Builders for the Ghost Train's creatures, keyed by enemy id. */
export const GHOST_TRAIN_BUILDERS: Record<string, () => SculptModel> = {
  gt_ticketless: ticketless,
  gt_coalborn: coalborn,
  gt_porter: porter,
  gt_navvy: navvy,
  gt_railcrawler: railcrawler,
  gt_mourner: mourner,
  gt_signalman: signalman,
  gt_commuter: commuter,
  gt_newsboy: newsboy,
  gt_mimic: mimic,
  gt_gravebound: gravebound,
  gt_moth: moth,
  gt_pallbearer: pallbearers,
  gt_slag: slagGolem,
  gt_riveter: riveter,
  gt_hound: hound,
  gt_stillfolk: stillfolk,
  gt_watcher: watcher,
  gt_bellwraith: bellwraith,
  gt_collected: collected,
  gt_puncher: () => puncher(1, false),
  gt_inspector: () => puncher(1.75, true),
};

export const _unused = { cos };
