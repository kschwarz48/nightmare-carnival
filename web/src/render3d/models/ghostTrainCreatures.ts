// The Ghost Train's passengers and staff (D-80): SDF sculpts on their own skeletons like every other crowd,
// each with its locomotion clip and the wind-up/attack clip the sim's telegraph drives (and a clip of its own
// where the sim has a state worth showing: the Gravebound clawing up out of the ground). Period dress of the
// 1890s line, faded and grave-stained; faces the grey of old photographs; small light sources (an unpunched
// ticket, a signal lantern, a firebox, ember cracks) so each reads at gameplay zoom in the dark.
// Since D-89 the thirteen figures are built in layers on the character art standard, on the same skeletons and clips.

import * as THREE from 'three';
import { C, SURF, box, cone, cyl, ellipsoid, rbox, sphere, torus, tube, vnoise, type ColorFn, type Surf, type V3 } from '../core/geo';
import { PAL } from './kit';
import { Sculpt, layered } from '../sculpt/sdf';
import { CREATURE, FAM, LAYER, SIDES, across, along, alongRot, armShell, flat, hatFrame, joints, legShell, neckShell, onSurface, ring, shadowedJaw, styleFace, styleHair, styleHand, styleHead, styleShoe, surfaceAt, torsoShell, vertical, type FaceOpts, type Part } from '../sculpt/figure';
import { frontZ } from '../sculpt/realism';
import { Rig, type BoneDef, type ClipDef, type Pose, ease, mix, pulse, sin, cos, TAU } from '../sculpt/rig';
import { ADULT, GAIT_WALK, type Gait, type Proportions, gaitPose, humanBones, scaleP } from '../sculpt/humanoid';
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
const GHOST = C(0x9aa0a4).lerp(C(0x5a6066), 0.4).getHex();
const ghostSkin = flat(GHOST);
/** Corpse skin from the churchyard: yellowed, soil-dark. */
const GRAVE = C(0x8a8468).lerp(C(0x3a3020), 0.45).getHex();
const graveSkin = flat(GRAVE);
/** Stone gone the grey of a churchyard. */
const STONE = C(0x8a8a86).lerp(C(0x4a4a48), 0.45).getHex();
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

/** The half-width and front of a torso `g` out at height y, found on the body alone (D-89: a search on the garment caught
 *  the hanging arms, and belts floated round them like hoops). */
function waistAt(P: Proportions, b: (n: string) => number, g: number, y: number, skirt?: [number, number, number]): [number, number] {
  const probe = new Sculpt(2, 4, 0.5);
  torsoShell(probe, P, b, g, { col: 0 }, { k: 0.6 });
  if (skirt) coatSkirt(probe, P, b, skirt[0], skirt[1], skirt[2], { col: 0 });
  return [surfaceAt(probe, [0, y, 0.4], [1, 0, 0], 40)[0], frontZ(probe, 0, y) - 0.4];
}
/** A ghost's face (D-89): pale glowing eyes in dark sockets, dark brows, a thin mouth. */
function ghostFace(sc: Sculpt, P: Proportions, bone: number, o: FaceOpts = {}): void {
  styleFace(sc, P, bone, { iris: 0xd8e8ff, glow: 1.2, sclera: 0x2a2e32, lid: 0x1e2226, brow: 0x34383c, size: 0.17, mouth: 0x24262a, ...o });
}
/**
 * A cap in crisp parts on the head bone, tipped back so the face shows from the game's camera (D-89): a cloth cap
 * (`puff` for a newsboy's) or a peaked uniform cap with a band and a badge. Returns its frame for more parts.
 */
function capOn(sc: Sculpt, P: Proportions, bone: number, col: number, o: { peaked?: boolean; band?: number; badge?: number; tip?: number; puff?: number; tilt?: number } = {}) {
  const r = P.headR, y = P.headY;
  const f = hatFrame([0, y + r * (o.peaked ? 0.85 : 0.9), -r * 0.06], -(o.tip ?? 0.18), o.tilt ?? 0);
  if (o.peaked) {
    sc.detail(f(cyl(r * 0.99, r * 0.97, r * 0.36, 24)), { col, bone, surf: FAM.cloth });
    sc.detail(f(ellipsoid(r * 0.99, r * 0.22, r * 0.99, 20, 8), [0, r * 0.16, 0]), { col, bone, surf: FAM.cloth });
    sc.detail(f(cyl(r * 1.1, r * 1.04, r * 0.1, 24), [0, r * 0.26, -r * 0.03]), { col, bone, surf: FAM.cloth });
    sc.detail(f(ellipsoid(r * 0.8, r * 0.07, r * 0.52, 16, 6), [0, -r * 0.15, r * 0.9], 0.2), { col: 0x0c0c0e, bone, surf: FAM.latex });
    if (o.band !== undefined) sc.detail(f(torus(r * 0.995, r * 0.06, 5, 24), [0, -r * 0.08, 0], Math.PI / 2), { col: o.band, bone, surf: FAM.gold, ink: false });
    if (o.badge !== undefined) sc.detail(f(rbox(r * 0.3, r * 0.22, 0.5, 0.12, 1), [0, r * 0.03, r * 0.99]), { col: o.badge, bone, surf: FAM.brass, ink: false });
  } else {
    const pf = o.puff ?? 0;
    sc.detail(f(ellipsoid(r * (1.04 + pf * 0.3), r * (0.3 + pf), r * (1.1 + pf * 0.3), 20, 10), [0, r * 0.02, r * 0.06]), { col, bone, surf: FAM.wool });
    sc.detail(f(ellipsoid(r * 0.74, r * 0.07, r * 0.42, 16, 6), [0, -r * 0.12, r * 1.0], 0.15), { col, bone, surf: FAM.wool });
    if (pf) sc.detail(f(sphere(r * 0.1, 8, 6), [0, r * (0.3 + pf * 2), r * 0.06]), { col, bone, surf: FAM.wool });
  }
  return f;
}
/** A coat's (or dress's) skirt from the hips, flaring to a straight hem at `hemY` (D-89; it was a round-ended cone). */
function coatSkirt(sc: Sculpt, P: Proportions, b: (n: string) => number, g: number, hemY: number, flare: number, part: Part): void {
  const rb = P.hipW * flare + g;
  sc.add({ t: 'cap', a: [0, P.hip + 4, 0.3], b: [0, hemY - rb * 0.6, 0.5], ra: P.hipW + g, rb, sz: P.depth + 0.12 }, { surf: FAM.cloth, ...part, bone: b('hips'), k: 1.2 });
  sc.add({ t: 'box', c: [0, hemY - 50, 0], h: [80, 50, 80], r: 0.1 }, { sub: true, k: 0.2 });
}

// ================================================================== the Ticketless
function ticketless(): SculptModel {
  // D-89, in layers: a passenger who never had a ticket — a long tweed overcoat (its weave per pixel) with a turned-up
  // collar, to the knees; dark trousers and boots; a sad grey face, pale eyes glowing in dark sockets; a flat cap with
  // the unpunched ticket tucked in its band, the only warm thing about him; the cardboard suitcase with its strap and
  // corners swinging from the right hand. The same skeleton, size and reaching shamble.
  const P = prop(1, { headR: 11.5, chestW: 11, waistW: 9.5, hipW: 10, depth: 0.74, arm: [3.4, 3, 2.5], leg: [4.4, 3.6, 3] });
  const bones = humanBones(P, [{ name: 'case', parent: 'handR', head: [-P.shoulderX - 3, P.wristY - 8, 2] }]);
  const b = bi(bones);
  const skin = new Sculpt(1.7, 3, 0.5), hair = new Sculpt(1.9, 3, 0.5), coat = new Sculpt(2.7, 4, 0.5), legs = new Sculpt(2.7, 4, 0.5);
  const r = P.headR;
  const sk = { col: ghostSkin, surf: FAM.skin };
  styleHead(skin, P, b('head'), GHOST, { jaw: 0.95, nose: 0.95, brow: 1.1 });
  neckShell(skin, P, b, sk, 0.32);
  for (const [s, n] of SIDES) styleHand(skin, joints(P, s).wr, s, P.arm[2], GHOST, b(`hand${n}`));
  ghostFace(skin, P, b('head'), { browTilt: -0.3, smile: -0.7 });
  // ---- hair under a flat cap, the ticket in its band
  styleHair(hair, P, b('head'), 0x2a2a2c, { ink: false });
  const cp = capOn(hair, P, b('head'), 0x3a342c, { tip: 0.2 });
  hair.detail(cp(rbox(r * 0.42, r * 0.3, 0.4, 0.1, 1).rotateY(0.67), [r * 0.64, r * 0.12, r * 0.8]), { col: 0xfff0b0, bone: b('head'), emit: 1.4, surf: SURF.bulb, ink: false });
  // ---- the overcoat: tweed, to the knees, a turned-up collar, four buttons
  const tweed = { col: 0x4a4438, surf: FAM.wool, pat: { kind: 'diamonds', col: 0x565042, a: 22, b: 2.4 } as const };
  torsoShell(coat, P, b, 1.1, tweed, { k: 0.6 });
  coatSkirt(coat, P, b, 1.2, P.knee + 2, 1.3, tweed);
  coat.add({ t: 'tor', c: [0, P.neck - 2.4, 0.3], R: r * 0.5, r: 1.4 }, { ...tweed, bone: b('chest'), k: 0.4 });
  for (const [s, n] of SIDES) {
    const { el, wr } = joints(P, s);
    armShell(coat, P, b, s, 0.9, tweed, { to: 1.9 });
    ring(coat, along(el, wr, 0.9), P.arm[2] + 1.6, 0.8, tweed, b(`fore${n}`), alongRot(el, wr));
  }
  for (let i = 0; i < 4; i++) {
    const by = P.waist - 4 + i * 4.6;
    coat.detail(sphere(0.85, 8, 6), { col: 0x2a241c, bone: b(i < 2 ? 'spine' : 'chest'), pos: [1.2, by, frontZ(coat, 1.2, by) + 0.2], surf: FAM.leather });
  }
  // ---- trousers and boots
  const tr = { col: 0x2e2a26, surf: FAM.cloth };
  for (const [s, n] of SIDES) {
    legShell(legs, P, b, s, 0.5, tr, { from: 0.4 });
    styleShoe(legs, [joints(P, s).an[0], P.ankle, 0], 10, 0x141210, b(`foot${n}`));
  }
  // ---- the cardboard suitcase: a strap round it, a handle, corners, a label
  const cx = -P.shoulderX - 3, cy = P.wristY - 12;
  legs.detail(rbox(16, 12, 5, 0.8, 2), { col: 0x6a5232, bone: b('case'), pos: [cx, cy, 2], surf: FAM.canvas });
  legs.detail(rbox(16.6, 1.2, 5.6, 0.3, 1), { col: 0x2a1e14, bone: b('case'), pos: [cx, cy + 3, 2], surf: FAM.leather });
  legs.detail(torus(1.6, 0.4, 4, 10, Math.PI), { col: 0x2a1e14, bone: b('case'), pos: [cx, cy + 6, 2], surf: FAM.leather });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) legs.detail(rbox(1.6, 1.6, 5.6, 0.3, 1), { col: PAL.brass, bone: b('case'), pos: [cx + sx * 7.4, cy + sy * 5.4, 2], surf: FAM.brass });
  legs.detail(rbox(4, 2.6, 0.3, 0.1, 1), { col: 0xd8c8a0, bone: b('case'), pos: [cx + 3, cy - 2, 4.6], rot: [0, 0, 0.12], surf: SURF.paint });
  const reach: Pose = { armL: { rx: -1.2, rz: 0.1 }, foreL: { rx: -0.3 } };
  const clips: Clips = {
    move: { frames: 30, fn: (t) => mix(gaitPose(t, shamble), reach, { case: { rx: 0.25 * sin(t) }, head: { rz: 0.15 * sin(t, 1, 0.3), rx: 0.15 } }) },
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7));
      return mix(reach, { armL: { rx: -1.6 * k, rz: 0.4 * k }, chest: { rx: 0.35 * k }, head: { rx: 0.2 * k } });
    } },
  };
  const geo = layered([{ sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: coat, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }]);
  return { geo, rig: new Rig(bones, clips) };
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
  // D-89, in layers: a porter built like a wardrobe — a red tunic with a high collar, brass buttons and a belt; dark
  // trousers, boots; a heavy grey face with a walrus moustache under a peaked cap with a gold band and badge; the
  // steamer trunk he never puts down held out in front like a wall, banded in brass, iron at the corners, a label on
  // it. The same skeleton, size and plod.
  const P = prop(1.3, { headR: 12, chestW: 15, waistW: 14, hipW: 13, depth: 0.85, arm: [5, 4.4, 3.6], leg: [5.6, 4.6, 3.6] });
  const bones = humanBones(P, [{ name: 'trunk', parent: 'chest', head: [0, P.chest, 14] }]);
  const b = bi(bones);
  // (garments cut on a body less deep than the skeleton's barrel)
  const D: Proportions = { ...P, depth: 0.82 };
  const skin = new Sculpt(1.9, 3.5, 0.5), hair = new Sculpt(2.2, 3.5, 0.5), tunic = new Sculpt(3, 4.5, 0.5), legs = new Sculpt(3.1, 4.5, 0.5), trunk = new Sculpt(3, 2, 0.5);
  const RED = 0x6a1c1a, r = P.headR, y = P.headY;
  const sk = { col: ghostSkin, surf: FAM.skin };
  styleHead(skin, P, b('head'), GHOST, { jaw: 1.2, chin: 1.0, nose: 1.2, brow: 1.3 });
  neckShell(skin, P, b, sk, 0.42);
  for (const [s, n] of SIDES) styleHand(skin, joints(P, s).wr, s, P.arm[2], GHOST, b(`hand${n}`));
  ghostFace(skin, P, b('head'), { browTilt: 0.15, browW: 1.15, size: 0.15, mouthW: 0 });
  // ---- hair, a walrus moustache, the peaked cap
  styleHair(hair, P, b('head'), 0x3a3a3c, { ink: false, sideburns: true });
  const my = y - r * 0.4, mz = frontZ(skin, 0, my);
  for (const s of [1, -1]) hair.add({ t: 'cap', a: [s * r * 0.06, my + r * 0.05, mz + 0.3], b: [s * r * 0.5, my - r * 0.16, mz - r * 0.26], ra: r * 0.16, rb: r * 0.11 }, { col: 0x4a4a4c, bone: b('head'), k: 0.5, surf: FAM.hair });
  capOn(hair, P, b('head'), 0x2a0e0c, { peaked: true, band: 0xc8a050, badge: 0xc8a050 });
  // ---- the tunic: red, a high collar, brass buttons, a belt with a brass buckle
  const tv = { col: RED, surf: FAM.cloth };
  torsoShell(tunic, D, b, 1.0, tv, { k: 0.6 });
  tunic.add({ t: 'cap', a: [0, P.neck - 4, 0], b: [0, P.neck + 0.6, 0.2], ra: r * 0.5, rb: r * 0.46 }, { ...tv, bone: b('chest'), k: 0.5 });
  tunic.add({ t: 'box', c: [0, P.hip - 14, 0], h: [40, 10, 40], r: 0.1 }, { sub: true, k: 0.2 });
  for (const [s, n] of SIDES) {
    const { el, wr } = joints(P, s);
    armShell(tunic, D, b, s, 0.9, tv, { to: 1.9 });
    ring(tunic, along(el, wr, 0.88), P.arm[2] + 1.7, 0.9, { col: 0x3a0e0c }, b(`fore${n}`), alongRot(el, wr));
  }
  for (let i = 0; i < 4; i++) {
    const by = P.chest + 6 - i * 5.5;
    tunic.detail(sphere(1.15, 8, 6), { col: PAL.brass, bone: b('chest'), pos: [0, by, frontZ(tunic, 0, by) + 0.3], surf: FAM.brass });
  }
  const [bw, bd] = waistAt(D, b, 1.0, P.waist - 4);
  tunic.detail(torus(bw + 0.4, 1.1, 6, 30), { col: 0x1a1210, bone: b('spine'), pos: [0, P.waist - 4, 0.4], rot: [Math.PI / 2, 0, 0], scale: [1, bd / bw, 1], surf: FAM.leather });
  tunic.detail(rbox(4.6, 3.6, 1, 0.4, 1), { col: PAL.brass, bone: b('spine'), pos: [0, P.waist - 4, bd + 1.4], surf: FAM.brass });
  // ---- trousers (their seat under the tunic) and boots
  const tr = { col: 0x24201c, surf: FAM.cloth };
  torsoShell(legs, D, b, 0.7, { ...tr, ink: false }, { chest: false });
  for (const [s, n] of SIDES) {
    legShell(legs, D, b, s, 0.7, tr);
    styleShoe(legs, [joints(P, s).an[0], P.ankle, 0], 13, 0x141210, b(`foot${n}`), { width: 1.1 });
  }
  // ---- the steamer trunk: dark wood banded in brass, iron corners, a lock and a label
  const tc: V3 = [0, P.chest - 6, 20];
  trunk.add({ t: 'box', c: tc, h: [20, 15, 10], r: 1.8 }, { col: 0x4a3018, bone: b('trunk'), k: 0, surf: FAM.wood });
  for (const dy of [-10, 0, 10]) trunk.detail(rbox(41, 2.2, 21, 0.4, 1), { col: PAL.brass, bone: b('trunk'), pos: [tc[0], tc[1] + dy, tc[2]], surf: FAM.brass });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) trunk.detail(rbox(4.4, 4.4, 4.4, 0.6, 1), { col: 0x2a2a2c, bone: b('trunk'), pos: [tc[0] + sx * 18.6, tc[1] + sy * 13.6, tc[2] + sz * 8.6], surf: FAM.iron });
  trunk.detail(rbox(3.4, 4, 1.2, 0.4, 1), { col: PAL.brass, bone: b('trunk'), pos: [tc[0], tc[1] + 4.6, tc[2] + 10.4], surf: FAM.brass });
  trunk.detail(rbox(8, 6, 0.4, 0.2, 1), { col: 0xc8b080, bone: b('trunk'), pos: [tc[0] + 9, tc[1] - 4, tc[2] + 10.3], rot: [0, 0, -0.1], surf: SURF.paint });
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
  const geo = layered([{ sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: tunic, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }, { sc: trunk, o: LAYER.hard }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== The Navvy (D-84)
/** A navvy the line never paid off: a wall of a man in moleskins and a waistcoat, a red neckerchief, a sledgehammer on
 *  his shoulder. No wind-up and no trick: he walks you down. */
function navvy(): SculptModel {
  // D-89, in layers, on the Carnival Brute's lines: a broad stubbled grey face under a flat cap, a red neckerchief
  // knotted at the throat; a collarless shirt with the sleeves rolled to the elbow over bare, heavy forearms; a black
  // waistcoat, buttoned, a watch chain across it; moleskin trousers tied below the knee with leather yorks; hobnailed
  // boots; the sledgehammer on his shoulder, its haft wrapped at the grip, its iron head square across it.
  const P = prop(1.6, { headR: 11, chestW: 19, waistW: 17, hipW: 15, depth: 0.95, arm: [6.6, 5.8, 4.8], leg: [6.6, 5.6, 4.4] });
  const bones = humanBones(P, [{ name: 'hammer', parent: 'chest', head: [P.shoulderX, P.shoulderY, -4] }]);
  const b = bi(bones);
  const D: Proportions = { ...P, depth: 0.8 };
  const skin = new Sculpt(1.9, 4, 0.5), hair = new Sculpt(2.3, 4, 0.5), shirt = new Sculpt(2.9, 5, 0.5), vest = new Sculpt(2.9, 5, 0.5);
  const legs = new Sculpt(3.1, 5, 0.5), boots = new Sculpt(2.7, 4, 0.5);
  const r = P.headR, y = P.headY;
  const face = shadowedJaw(GHOST, P, 0.35);
  const sk = { col: ghostSkin, surf: FAM.skin };
  // ---- skin: a broad head with a heavy jaw, a bull neck; bare forearms with their muscle, big hands
  styleHead(skin, P, b('head'), face, { jaw: 1.45, chin: 1.2, nose: 1.35, brow: 1.4, ears: 1.1 });
  neckShell(skin, P, b, sk, 0.52);
  for (const [s, n] of SIDES) {
    const { el, wr } = joints(P, s);
    armShell(skin, P, b, s, 0.2, sk, { from: 1.1 });
    skin.add({ t: 'ell', c: along(el, wr, 0.3), r: [P.arm[1] + 0.8, 7, P.arm[1] + 0.6], rot: alongRot(el, wr) }, { ...sk, bone: b(`fore${n}`), k: 1.4 });
    styleHand(skin, wr, s, P.arm[2], GHOST, b(`hand${n}`));
  }
  ghostFace(skin, P, b('head'), { browTilt: 0.3, browW: 1.2, size: 0.14, mouth: 0x1a1c1e, smile: -0.4, mouthW: 1.1 });
  // ---- hair under a flat cap
  styleHair(hair, P, b('head'), 0x2a2826, { ink: false });
  capOn(hair, P, b('head'), 0x2a2420, { tip: 0.16 });
  // ---- the shirt: rolled to the elbow (its body hidden under the waistcoat), and the red neckerchief
  const sh = { col: 0xb0a898, surf: FAM.cloth };
  torsoShell(shirt, D, b, 0.6, { ...sh, ink: false }, { hips: false, shoulders: false });
  for (const s of [1, -1]) shirt.add({ t: 'sph', c: [s * (P.shoulderX - 1), P.shoulderY - 0.5, 0], r: P.arm[0] + 1.8 }, { ...sh, bone: b('chest'), k: 1.5 });
  for (const [s, n] of SIDES) {
    const { sh: s0, el } = joints(P, s);
    armShell(shirt, D, b, s, 1.0, sh, { to: 1.08 });
    ring(shirt, along(s0, el, 0.97), P.arm[1] + 2.2, 1.6, sh, b(`arm${n}`), alongRot(s0, el));
  }
  shirt.add({ t: 'tor', c: [0, P.neck - 3, 0.6], R: r * 0.56, r: 2.2 }, { col: 0x8a2018, bone: b('chest'), k: 0.4, surf: FAM.cloth });
  const kz = frontZ(skin, 0, P.neck - 4.5);
  shirt.add({ t: 'ell', c: [0, P.neck - 5, kz + 2.4], r: [2.8, 2.4, 2.2] }, { col: 0x8a2018, bone: b('chest'), k: 0.4, surf: FAM.cloth });
  for (const s of [1, -1]) shirt.add({ t: 'cap', a: [s * 0.8, P.neck - 6, kz + 2.6], b: [s * 2.6, P.neck - 12, kz + 1.6], ra: 1.6, rb: 1.1 }, { col: 0x8a2018, bone: b('chest'), k: 0.3, surf: FAM.cloth });
  // ---- the waistcoat: black, buttoned, a V at the neck, a watch chain across it
  const vv = { col: 0x1e1c1a, surf: FAM.cloth };
  torsoShell(vest, D, b, 1.3, vv, { hips: false, shoulders: false, k: 0.6 });
  const vz = (yy: number) => frontZ(vest, 0, yy);
  vest.add({ t: 'cap', a: [0, P.shoulderY + 3, vz(P.shoulderY - 2) + 1], b: [0, P.chest - 1, vz(P.chest - 1) - 1.5], ra: 7, rb: 3.8 }, { sub: true, k: 0.6 });
  vest.add({ t: 'box', c: [0, P.waist - 19, 0], h: [50, 10, 50], r: 0.1 }, { sub: true, k: 0.2 });
  for (let i = 0; i < 5; i++) {
    const by = P.waist - 5 + i * 4.6;
    vest.detail(sphere(1.1, 8, 6), { col: PAL.brass, bone: b(i < 2 ? 'spine' : 'chest'), pos: [0, by, vz(by) + 0.3], surf: FAM.brass });
  }
  const ch = [[0, P.waist + 4], [5, P.waist + 1], [9.6, P.waist + 3]].map(([x, yy]): V3 => [x, yy, frontZ(vest, x, yy) + 0.6]);
  vest.detail(tube(ch, 0.45, 4, 10), { col: PAL.gold, bone: b('spine'), surf: FAM.gold, ink: false });
  // ---- moleskins tied below the knee with yorks; hobnailed boots
  const mo = { col: 0x4a3a28, surf: FAM.cloth };
  torsoShell(legs, D, b, 0.9, mo, { chest: false });
  for (const [s, n] of SIDES) {
    const { kn, an } = joints(P, s);
    legShell(legs, D, b, s, 0.9, mo, { to: 1.86 });
    legs.add({ t: 'tor', c: along(kn, an, 0.18), R: P.leg[1] + 1.1, r: 1.3, rot: alongRot(kn, an) }, { col: 0x2a1c12, surf: FAM.leather, bone: b(`shin${n}`), k: 0.3 });
    legs.add({ t: 'ell', c: along(kn, an, 0.05), r: [P.leg[1] + 1.8, 3.4, P.leg[1] + 1.6], rot: alongRot(kn, an) }, { ...mo, bone: b(`shin${n}`), k: 1.2 });
    styleShoe(boots, [an[0], P.ankle, 0], 17, 0x1a1612, b(`foot${n}`), { width: 1.15, toeUp: 0.05 });
    boots.add({ t: 'cap', a: [an[0], P.ankle + 2, an[2]], b: along(kn, an, 0.75), ra: P.leg[2] + 1.8, rb: P.leg[2] + 1.6 }, { col: 0x1a1612, surf: FAM.leather, bone: b(`shin${n}`), k: 0.6 });
  }
  // ---- the sledgehammer: a turned haft wrapped at the grip, the iron head square across it
  const hr: V3 = [-0.6, 0, -0.2];
  const dir = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...hr));
  const hc: V3 = [P.shoulderX + 2, P.shoulderY + 10, -4], top: V3 = [hc[0] + dir.x * 30, hc[1] + dir.y * 30, hc[2] + dir.z * 30];
  boots.detail(cyl(1.5, 1.8, 60, 8), { col: 0x6a4a2c, bone: b('hammer'), pos: hc, rot: hr, surf: FAM.wood });
  boots.detail(cyl(2.1, 2.1, 9, 8), { col: 0x2a1c14, bone: b('hammer'), pos: [hc[0] - dir.x * 22, hc[1] - dir.y * 22, hc[2] - dir.z * 22], rot: hr, surf: FAM.leather });
  boots.detail(rbox(21, 9, 9, 1.4, 2), { col: 0x2e3032, bone: b('hammer'), pos: top, rot: hr, surf: FAM.iron });
  for (const sx of [-1, 1]) {
    const ax = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(...hr));
    boots.detail(cyl(4.6, 4.6, 1.2, 12), { col: 0x5a5e62, bone: b('hammer'), pos: [top[0] + ax.x * 10.8 * sx, top[1] + ax.y * 10.8 * sx, top[2] + ax.z * 10.8 * sx], rot: [hr[0], hr[1], hr[2] + Math.PI / 2], surf: FAM.iron });
  }
  const carry: Pose = { armR: { rx: -0.35, rz: -0.3 }, foreR: { rx: -1.9 } };
  const g: Gait = { ...GAIT_WALK, stride: 0.42, knee: 0.55, bob: 3.6, sway: 0.22, twist: 0.08, arm: 0.35, elbow: 0.25, lean: 0.14, headBob: 0.1 };
  const clips: Clips = {
    move: { frames: 36, fn: (t) => mix(gaitPose(t, g), carry) },
    attack: { frames: 14, loop: false, fn: (t) => mix(gaitPose(0, g), carry, { chest: { rx: 0.35 * pulse(t, 0.6, 0.3) } }) },
  };
  const geo = layered([{ sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: shirt, o: LAYER.cloth }, { sc: vest, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }, { sc: boots, o: LAYER.hard }]);
  return { geo, rig: new Rig(bones, clips) };
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
  // D-89, in layers: a widow in full mourning — a black crape dress fitted to the waist with leg-of-mutton sleeves, the
  // skirt to the ground in folds over a bustle; a high collar, jet buttons; black
  // gloves clasped on a black-bordered handkerchief; a small hat, and a veil of black net falling past her shoulders
  // with two pale points of light behind it. The same skeleton, size and glide; the veil on its own bone as before.
  const P = prop(1.05, { headR: 11, chestW: 10.5, waistW: 8, hipW: 11, depth: 0.74, arm: [3.2, 2.7, 2.2], leg: [4, 3.2, 2.6] });
  const bones = humanBones(P, [{ name: 'veil', parent: 'head', head: [0, P.headY + P.headR, 0] }]);
  const b = bi(bones);
  const dress = new Sculpt(2.3, 4, 0.5), veil = new Sculpt(2, 3, 0.5), gloves = new Sculpt(1.6, 3, 0.5);
  const r = P.headR, y = P.headY;
  const dv = { col: vertical(0x121016, 0x2a2632, 0, P.shoulderY), surf: [0.55, 0] as Surf };
  // ---- the dress: a fitted bodice, puffed sleeves, the skirt to the ground in folds over a bustle; a high collar
  torsoShell(dress, P, b, 0.6, dv, { hips: false, k: 0.6 });
  dress.add({ t: 'cap', a: [0, P.waist - 2, 0.3], b: [0, -6, 0.6], ra: P.waistW + 1, rb: P.hipW * 1.75, sz: 0.95 }, { ...dv, bone: b('hips'), k: 1.6 });
  dress.add({ t: 'ell', c: [0, P.hip, -P.hipW * 0.95], r: [P.hipW * 0.85, 8, 6.4] }, { ...dv, bone: b('hips'), k: 2 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.45;
    dress.add({ t: 'cap', a: [Math.cos(a) * (P.hipW * 0.9), P.hip - 2, 0.4 + Math.sin(a) * P.hipW * 0.85], b: [Math.cos(a) * P.hipW * 1.78, 0, 0.6 + Math.sin(a) * P.hipW * 1.66], ra: 1.4, rb: 2.4 }, { ...dv, bone: b('hips'), k: 1.2 });
  }
  dress.add({ t: 'box', c: [0, -40, 0], h: [60, 40, 60], r: 0.1 }, { sub: true, k: 0.2 });
  dress.add({ t: 'cap', a: [0, P.neck - 4, 0], b: [0, P.neck + 1.5, 0.3], ra: r * 0.42, rb: r * 0.38 }, { ...dv, bone: b('chest'), k: 0.5 });
  for (const [s, n] of SIDES) {
    const { sh, el } = joints(P, s);
    armShell(dress, P, b, s, 0.5, dv, { to: 1.92 });
    dress.add({ t: 'ell', c: along(sh, el, 0.28), r: [P.arm[0] + 2.4, 5.6, P.arm[0] + 2.4], rot: alongRot(sh, el) }, { ...dv, bone: b(`arm${n}`), k: 1 });
    styleHand(gloves, joints(P, s).wr, s, P.arm[2], 0x141214, b(`hand${n}`), FAM.leather, true);
  }
  for (let i = 0; i < 5; i++) {
    const by = P.chest + 4 - i * 3.6;
    dress.detail(sphere(0.6, 6, 4), { col: 0x050406, bone: b('chest'), pos: [0, by, frontZ(dress, 0, by) + 0.15], surf: [0.2, 0] });
  }
  // a black-bordered handkerchief in the clasped hands
  gloves.detail(rbox(7, 0.6, 7, 0.2, 1), { col: 0xd8d0c8, bone: b('handL'), pos: [P.shoulderX * 0.5, P.wristY - 2, 8], rot: [0.6, 0.4, 0.2], surf: FAM.cloth });
  gloves.detail(rbox(7.6, 0.5, 7.6, 0.2, 1), { col: 0x0a080c, bone: b('handL'), pos: [P.shoulderX * 0.5, P.wristY - 2.2, 8], rot: [0.6, 0.4, 0.2], surf: FAM.cloth });
  // ---- the veil of black net (a fine weave per pixel) from the hat past the shoulders; the two lights behind it; the hat
  veil.add({ t: 'cap', a: [0, y + r * 0.6, 0], b: [0, y - r * 1.6, 1], ra: r * 1.15, rb: r * 1.45, sz: 0.95 }, { col: 0x2c2a32, surf: FAM.cloth, pat: { kind: 'dots', col: 0x3c3a44, a: 1.5, b: 0.42 }, bone: b('veil'), k: 1 });
  veil.add({ t: 'box', c: [0, P.chest - 18, 0], h: [40, 20, 40], r: 0.1 }, { sub: true, k: 0.2 });
  for (const s of [1, -1]) glowEye(veil, b('head'), [s * r * 0.35, y + r * 0.1, frontZ(veil, s * r * 0.35, y + r * 0.1) + 0.2], 1.3, 0xd8e0ff, 1.6);
  const hf = hatFrame([0, y + r * 0.86, -r * 0.08], -0.15);
  veil.detail(hf(cyl(r * 1.25, r * 1.25, r * 0.07, 28)), { col: 0x0e0c10, bone: b('head'), surf: [0.5, 0] });
  veil.detail(hf(cyl(r * 0.66, r * 0.74, r * 0.46, 24), [0, r * 0.24, 0]), { col: 0x0e0c10, bone: b('head'), surf: [0.5, 0] });
  for (const s of [1, -1]) veil.detail(hf(ellipsoid(r * 0.36, r * 0.2, r * 0.14, 10, 6), [s * r * 0.28, r * 0.24, -r * 0.7]), { col: 0x1a1820, bone: b('head'), surf: [0.4, 0] });
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
  const geo = layered([{ sc: dress, o: LAYER.cloth }, { sc: veil, o: LAYER.cloth }, { sc: gloves, o: LAYER.cloth }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== the Signalman
function signalman(): SculptModel {
  // D-89, in layers: the man in the signal box — shirtsleeves held up by red garters, a dark green waistcoat with brass
  // buttons and a watch chain, dark trousers, boots; a grey face with a walrus moustache under a peaked railway cap with
  // its badge; the red-glassed hand lamp swinging from his right hand. The same skeleton, size and walk.
  const P = prop(1.05, { headR: 11.5, chestW: 12, waistW: 11, hipW: 11, depth: 0.8 });
  const bones = humanBones(P, [{ name: 'lantern', parent: 'handR', head: [-P.shoulderX - 4, P.wristY - 4, 3] }]);
  const b = bi(bones);
  const skin = new Sculpt(1.6, 3, 0.5), hair = new Sculpt(1.8, 3, 0.5), shirt = new Sculpt(2.2, 4, 0.5), vest = new Sculpt(2, 4, 0.5), legs = new Sculpt(2.4, 4, 0.5);
  const r = P.headR, y = P.headY;
  const sk = { col: ghostSkin, surf: FAM.skin };
  styleHead(skin, P, b('head'), GHOST, { jaw: 1.05, nose: 1.1, brow: 1.2 });
  neckShell(skin, P, b, sk, 0.36);
  for (const [s, n] of SIDES) styleHand(skin, joints(P, s).wr, s, P.arm[2], GHOST, b(`hand${n}`));
  ghostFace(skin, P, b('head'), { browTilt: 0.05, mouthW: 0 });
  // ---- hair, a walrus moustache, the peaked cap
  styleHair(hair, P, b('head'), 0x4a4a4c, { ink: false });
  const my = y - r * 0.4, mz = frontZ(skin, 0, my);
  for (const s of [1, -1]) hair.add({ t: 'cap', a: [s * r * 0.06, my + r * 0.05, mz + 0.3], b: [s * r * 0.48, my - r * 0.2, mz - r * 0.24], ra: r * 0.15, rb: r * 0.1 }, { col: 0x6a6a6c, bone: b('head'), k: 0.5, surf: FAM.hair });
  capOn(hair, P, b('head'), 0x1e2418, { peaked: true, badge: 0xb8a060 });
  // ---- shirtsleeves with red garters (the shirt's body under the waistcoat)
  const sh = { col: 0x8a8478, surf: FAM.cloth };
  torsoShell(shirt, P, b, 0.4, { ...sh, ink: false }, { hips: false, shoulders: false });
  for (const [s, n] of SIDES) {
    const { sh: s0, el, wr } = joints(P, s);
    shirt.add({ t: 'sph', c: [s * (P.shoulderX - 1), P.shoulderY - 0.5, 0], r: P.arm[0] + 1.5 }, { ...sh, bone: b('chest'), k: 1.5 });
    armShell(shirt, P, b, s, 0.8, sh, { to: 1.9, flare: 0.4 });
    ring(shirt, along(el, wr, 0.92), P.arm[2] + 1.4, 0.8, sh, b(`fore${n}`), alongRot(el, wr));
    shirt.detail(torus(P.arm[0] + 0.5, 0.55, 5, 16), { col: 0x9a2a22, bone: b(`arm${n}`), pos: along(s0, el, 0.55), rot: across(s0, el), surf: FAM.cloth, ink: false });
  }
  // ---- the waistcoat: dark green, a V, brass buttons, a watch chain
  const vv = { col: 0x2a3424, surf: FAM.cloth };
  torsoShell(vest, P, b, 1.0, vv, { hips: false, shoulders: false, k: 0.6 });
  const vz = (yy: number) => frontZ(vest, 0, yy);
  vest.add({ t: 'cap', a: [0, P.shoulderY + 2.4, vz(P.shoulderY - 1) + 0.6], b: [0, P.chest - 0.5, vz(P.chest - 0.5) - 1], ra: 5.2, rb: 2.8 }, { sub: true, k: 0.4 });
  vest.add({ t: 'box', c: [0, P.waist - 16, 0], h: [40, 10, 40], r: 0.1 }, { sub: true, k: 0.2 });
  for (let i = 0; i < 4; i++) {
    const by = P.waist - 3 + i * 3.8;
    vest.detail(sphere(0.8, 8, 6), { col: PAL.brass, bone: b(i < 2 ? 'spine' : 'chest'), pos: [0, by, vz(by) + 0.25], surf: FAM.brass });
  }
  const ch = [[0, P.waist + 1], [3.4, P.waist - 2], [7, P.waist]].map(([x, yy]): V3 => [x, yy, frontZ(vest, x, yy) + 0.5]);
  vest.detail(tube(ch, 0.35, 4, 10), { col: PAL.gold, bone: b('spine'), surf: FAM.gold, ink: false });
  // ---- trousers and boots
  const tr = { col: 0x2a2620, surf: FAM.cloth };
  torsoShell(legs, P, b, 0.7, tr, { chest: false });
  for (const [s, n] of SIDES) {
    legShell(legs, P, b, s, 0.7, tr);
    styleShoe(legs, [joints(P, s).an[0], P.ankle, 0], 10.5, 0x141210, b(`foot${n}`));
  }
  // ---- the red-glassed hand lamp, swinging
  const lx = -P.shoulderX - 4;
  legs.detail(cyl(4.2, 4.2, 1.6, 12), { col: 0x2a2c2e, bone: b('lantern'), pos: [lx, P.wristY - 14, 3], surf: FAM.iron });
  legs.detail(cyl(3.3, 3.3, 6, 12), { col: 0xff2a20, bone: b('lantern'), pos: [lx, P.wristY - 10, 3], emit: 2.4, surf: SURF.glass });
  for (let i = 0; i < 3; i++) legs.detail(cyl(0.4, 0.4, 6.4, 4), { col: 0x2a2c2e, bone: b('lantern'), pos: [lx + Math.cos(i * 2.1) * 3.6, P.wristY - 10, 3 + Math.sin(i * 2.1) * 3.6], surf: FAM.iron });
  legs.detail(cone(3.4, 2.4, 10), { col: 0x2a2c2e, bone: b('lantern'), pos: [lx, P.wristY - 4.4, 3], surf: FAM.iron });
  legs.detail(torus(3, 0.5, 4, 10, Math.PI), { col: 0x2a2c2e, bone: b('lantern'), pos: [lx, P.wristY - 3, 3], surf: FAM.iron });
  const g: Gait = { ...GAIT_WALK, stride: 0.45, bob: 2.2, lean: 0.08 };
  const clips: Clips = {
    move: { frames: 30, fn: (t) => mix(gaitPose(t, g), { armR: { rx: -0.6 + 0.3 * sin(t), rz: 0.2 }, lantern: { rx: 0.4 * sin(t, 1, 0.2) } }) },
    // the lantern raised high and swung: stop the train
    attack: { frames: 16, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7));
      return { armR: { rx: -2.6 * k, rz: 0.4 * k + 0.25 * sin(t, 2) * k }, foreR: { rx: -0.2 }, lantern: { rx: 0.5 * sin(t, 2) * k }, chest: { rx: -0.2 * k }, head: { rx: -0.25 * k } };
    } },
  };
  const geo = layered([{ sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: shirt, o: LAYER.cloth }, { sc: vest, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== Clockwork Commuter
function commuter(): SculptModel {
  // D-89, in layers: a clockwork commuter — a brass head wearing a porcelain face for a mask, a painted moustache and
  // rosy cheeks, a crack across it, the eyes glowing in brass rings; a black bowler; a charcoal pinstripe suit (per
  // pixel) open on a white shirt and black tie; white gloves, black shoes; the wind-up key turning in his back; the
  // furled umbrella with its crook. The same skeleton, size and wind-up march.
  const P = prop(1, { headR: 11, chestW: 11.5, waistW: 10.5, hipW: 10.5, depth: 0.78 });
  const bones = humanBones(P, [{ name: 'key', parent: 'chest', head: [0, P.chest, -10] }, { name: 'brolly', parent: 'handL', head: [P.shoulderX + 3, P.wristY - 4, 2] }]);
  const b = bi(bones);
  const brassH = new Sculpt(1.6, 2, 0.5), face = new Sculpt(1.5, 2, 0.5), shirt = new Sculpt(2.2, 4, 0.5), suit = new Sculpt(2.3, 4, 0.5);
  const legs = new Sculpt(2.3, 4, 0.5), gloves = new Sculpt(1.6, 3, 0.5);
  const r = P.headR, y = P.headY, POR = 0xd8cab0;
  // ---- the brass head and neck; the porcelain face over its front, cut off at the ears
  brassH.add({ t: 'ell', c: [0, y + r * 0.1, -r * 0.08], r: [r * 0.9, r * 1.0, r * 0.94] }, { col: 0x8a6e3a, surf: FAM.brass, bone: b('head'), k: 1 });
  neckShell(brassH, P, b, { col: 0x6a5430, surf: FAM.brass }, 0.3);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 1.2 + (i / 5) * Math.PI * 0.6;
    brassH.detail(sphere(0.55, 6, 4), { col: 0x5a4420, bone: b('head'), pos: onSurface(brassH, [0, y + r * 0.1, -r * 0.08], [Math.cos(a) * r * 2, y + r * 0.55, Math.sin(a) * r * 2], 0), surf: FAM.brass });
  }
  styleHead(face, P, b('head'), POR, { jaw: 0.9, nose: 0.85, brow: 0.6, ears: 0.4 });
  face.add({ t: 'box', c: [0, y, -r * 0.62], h: [r * 1.4, r * 1.6, r * 0.7], r: 0.5 }, { sub: true, k: 0.4 });
  const fz = (x: number, yy: number) => frontZ(face, x, yy);
  for (const s of [1, -1]) {
    const ex = s * r * 0.36, ey = y + r * 0.1, ez = fz(ex, ey);
    face.detail(torus(r * 0.17, 0.55, 5, 14), { col: PAL.brass, bone: b('head'), pos: [ex, ey, ez + 0.1], rot: [0, s * 0.3, 0], surf: FAM.brass, ink: false });
    glowEye(face, b('head'), [ex, ey, ez - 0.2], 1.3, 0xfff0c0, 1.2);
    const cx = s * r * 0.5, cy = y - r * 0.2;
    face.detail(cyl(r * 0.14, r * 0.14, 0.2, 12), { col: 0xd88a80, bone: b('head'), pos: [cx, cy, fz(cx, cy) + 0.05], rot: [Math.PI / 2, 0, -s * 0.55], surf: SURF.porcelain, ink: false });
  }
  const my = y - r * 0.38, mz = fz(0, my);
  face.detail(tube([[-r * 0.42, my - r * 0.06, mz - r * 0.12], [-r * 0.16, my + r * 0.02, mz], [0, my, mz + 0.2], [r * 0.16, my + r * 0.02, mz], [r * 0.42, my - r * 0.06, mz - r * 0.12]], (t) => r * (0.03 + 0.05 * Math.sin(t * Math.PI)), 5, 14), { col: 0x2a2018, bone: b('head'), surf: SURF.paint, ink: false });
  face.detail(rbox(r * 0.3, r * 0.05, 0.3, 0.1, 1), { col: 0x6a2a24, bone: b('head'), pos: [0, y - r * 0.56, fz(0, y - r * 0.56) + 0.05], surf: SURF.paint, ink: false });
  const crack = ([[-0.1, 0.62], [0.06, 0.45], [-0.02, 0.32], [0.16, 0.18]] as const).map(([u, v]): V3 => [u * r, y + v * r, fz(u * r, y + v * r) + 0.04]);
  face.detail(tube(crack, 0.22, 4, 10), { col: 0x2a2018, bone: b('head'), surf: SURF.paint, ink: false });
  // the bowler: a dome, a curled brim, a ribbon
  const bf = hatFrame([0, y + r * 0.62, -r * 0.08], -0.12);
  brassH.detail(bf(ellipsoid(r * 0.86, r * 0.66, r * 0.88, 20, 12), [0, r * 0.22, 0]), { col: 0x101012, bone: b('head'), surf: [0.42, 0] });
  brassH.detail(bf(cyl(r * 1.24, r * 1.2, r * 0.08, 28)), { col: 0x101012, bone: b('head'), surf: [0.42, 0] });
  brassH.detail(bf(torus(r * 1.22, r * 0.07, 5, 28), [0, r * 0.04, 0], Math.PI / 2), { col: 0x101012, bone: b('head'), surf: [0.42, 0], ink: false });
  brassH.detail(bf(cyl(r * 0.87, r * 0.87, r * 0.16, 24, true), [0, r * 0.14, 0]), { col: 0x2a2a30, bone: b('head'), surf: FAM.cloth, ink: false });
  // ---- the shirt and tie in the jacket's V (the shirt's body under the jacket)
  torsoShell(shirt, P, b, 0.3, { col: 0xe4e0d8, ink: false }, { hips: false, shoulders: false });
  ring(shirt, [0, P.neck - 2.6, 0.2], r * 0.42, 0.9, { col: 0xe4e0d8 }, b('chest'));
  const tz = (yy: number) => frontZ(shirt, 0, yy);
  shirt.detail(tube([P.neck - 3.6, P.chest + 4, P.chest - 2].map((yy): V3 => [0, yy, tz(yy) + 0.5]), (t) => 0.8 + 0.6 * t, 5, 8), { col: 0x101012, bone: b('chest'), surf: FAM.cloth, ink: false });
  // ---- the suit: charcoal pinstripe (per pixel), the jacket open in a V and cut straight below the hips
  const ps = { col: 0x2a2a30, surf: FAM.wool, pat: { kind: 'stripes', col: 0x4e4e58, a: 44, b: 0.12 } as const };
  torsoShell(suit, P, b, 1.0, ps, { k: 0.6 });
  for (const [s, n] of SIDES) {
    const { el, wr } = joints(P, s);
    armShell(suit, P, b, s, 0.8, ps, { to: 1.88 });
    ring(suit, along(el, wr, 0.86), P.arm[2] + 1.5, 0.7, ps, b(`fore${n}`), alongRot(el, wr));
  }
  const vz = (yy: number) => frontZ(suit, 0, yy);
  suit.add({ t: 'cap', a: [0, P.shoulderY + 2, vz(P.shoulderY - 1) - 0.6], b: [0, P.chest - 2, vz(P.chest - 2) - 1.2], ra: 4.4, rb: 2.2 }, { sub: true, k: 0.3 });
  suit.add({ t: 'box', c: [0, P.hip - 16, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.2 });
  // ---- trousers to match (the seat under the jacket), black shoes, white gloves
  torsoShell(legs, P, b, 0.6, { ...ps, ink: false }, { chest: false });
  for (const [s, n] of SIDES) {
    legShell(legs, P, b, s, 0.6, ps);
    styleShoe(legs, [joints(P, s).an[0], P.ankle, 0], 10.5, 0x101010, b(`foot${n}`), { surf: [0.3, 0] });
    styleHand(gloves, joints(P, s).wr, s, P.arm[2], 0xd8d0c0, b(`hand${n}`), FAM.cloth, true);
  }
  // the wind-up key in its back, and a furled umbrella with its crook
  gloves.detail(cyl(1, 1, 8, 6), { col: PAL.brass, bone: b('key'), pos: [0, P.chest, -12], rot: [Math.PI / 2, 0, 0], surf: FAM.brass });
  for (const s of [1, -1]) gloves.detail(torus(3, 1, 5, 10), { col: PAL.brass, bone: b('key'), pos: [s * 3.5, P.chest, -16], rot: [0, Math.PI / 2, 0], surf: FAM.brass });
  const ux = P.shoulderX + 3;
  gloves.detail(cyl(1.5, 0.5, 30, 8), { col: 0x101012, bone: b('brolly'), pos: [ux, P.wristY - 19, 2], surf: FAM.cloth });
  gloves.detail(cyl(0.35, 0.35, 2.4, 4), { col: 0x101012, bone: b('brolly'), pos: [ux, P.wristY - 34.6, 2], surf: FAM.iron });
  gloves.detail(torus(1.8, 0.5, 5, 10, Math.PI), { col: 0x3a2418, bone: b('brolly'), pos: [ux + 1.8, P.wristY - 2.4, 2], surf: FAM.wood });
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
  const geo = layered([{ sc: brassH, o: LAYER.hard }, { sc: face, o: LAYER.hard }, { sc: shirt, o: LAYER.cloth }, { sc: suit, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }, { sc: gloves, o: LAYER.cloth }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== Newsboy Specter
function newsboy(): SculptModel {
  // D-89, in layers: a newsboy still crying the last edition — a child's big head, big glowing eyes under a puffed cap;
  // a tweed jacket too big for him, its sleeves past his wrists; dark shorts, bare knees, slouched grey socks, scuffed
  // boots; the canvas bag of papers across his body on its strap; one paper held up. The same skeleton, size and hurry.
  const P = prop(0.78, { headR: 12.5, chestW: 10, waistW: 9, hipW: 9.5, depth: 0.78 });
  const bones = humanBones(P, [{ name: 'paper', parent: 'handR', head: [-P.shoulderX - 2, P.wristY - 3, 3] }]);
  const b = bi(bones);
  const skin = new Sculpt(1.4, 2.5, 0.5), hair = new Sculpt(1.6, 2.5, 0.5), jacket = new Sculpt(1.9, 3.5, 0.5), legs = new Sculpt(1.9, 3, 0.5);
  const r = P.headR;
  const sk = { col: ghostSkin, surf: FAM.skin };
  styleHead(skin, P, b('head'), GHOST, { jaw: 0.85, chin: 0.85, nose: 0.75, brow: 0.8 });
  neckShell(skin, P, b, sk, 0.3);
  for (const [s, n] of SIDES) {
    styleHand(skin, joints(P, s).wr, s, P.arm[2], GHOST, b(`hand${n}`));
    legShell(skin, P, b, s, 0, sk, { from: 0.7, to: 1.3 });
  }
  ghostFace(skin, P, b('head'), { size: 0.22, browTilt: -0.15, smile: 0.2, mouthW: 0.8 });
  styleHair(hair, P, b('head'), 0x3a3634, { ink: false });
  capOn(hair, P, b('head'), 0x4a4438, { puff: 0.12, tip: 0.22, tilt: 0.12 });
  // ---- the jacket, a size too big: tweed, the sleeves past the wrists; the shirt's collar at the neck
  const tweed = { col: 0x3a3428, surf: FAM.wool, pat: { kind: 'diamonds', col: 0x443e30, a: 18, b: 2 } as const };
  torsoShell(jacket, P, b, 1.1, tweed, { k: 0.6 });
  jacket.add({ t: 'box', c: [0, P.hip - 13, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.2 });
  jacket.add({ t: 'tor', c: [0, P.neck - 2, 0.2], R: r * 0.4, r: 0.9 }, { col: 0xb0aa9c, surf: FAM.cloth, bone: b('chest'), k: 0.3 });
  for (const [s] of SIDES) armShell(jacket, P, b, s, 0.9, tweed, { to: 1.97, flare: 0.5 });
  // ---- shorts, slouched socks, boots
  const sh = { col: 0x2a2620, surf: FAM.cloth };
  torsoShell(legs, P, b, 0.7, sh, { chest: false });
  for (const [s, n] of SIDES) {
    const { kn, an } = joints(P, s);
    legShell(legs, P, b, s, 0.8, sh, { to: 0.72, flare: 0.3 });
    legShell(legs, P, b, s, 0.45, { col: 0x5a5650, surf: FAM.wool }, { from: 1.25 });
    legs.add({ t: 'tor', c: along(kn, an, 0.3), R: P.leg[1] + 0.6, r: 0.9, rot: alongRot(kn, an) }, { col: 0x5a5650, surf: FAM.wool, bone: b(`shin${n}`), k: 0.4 });
    styleShoe(legs, [an[0], P.ankle, 0], 8.4, 0x2a2420, b(`foot${n}`), { width: 1.05, toeUp: 0.08 });
  }
  // ---- the canvas bag of papers across his body on its strap, and the paper held up
  const bag = onSurface(jacket, [0, P.waist - 2, 0], [30, P.waist - 2, 10], 2.2);
  legs.detail(rbox(5, 7, 6.4, 1, 2), { col: 0x8a7a58, bone: b('spine'), pos: bag, rot: [0, 0.3, 0], surf: FAM.canvas });
  for (let i = 0; i < 3; i++) legs.detail(rbox(6, 0.4, 7.6, 0.1, 1), { col: 0xd0c8b0, bone: b('spine'), pos: [bag[0] - 0.6, bag[1] + 3.6 + i * 0.6, bag[2]], rot: [0, 0.3, 0.1 * i], surf: FAM.cloth });
  const strap = [[-P.shoulderX + 3, P.shoulderY + 1.5], [-2, P.chest], [4, P.waist + 2]].map(([x, yy]): V3 => onSurface(jacket, [x * 0.5, yy, 0], [x, yy, 30], 0.5));
  legs.detail(tube([...strap, bag], 0.7, 4, 12), { col: 0x6a5a3e, bone: b('chest'), surf: FAM.canvas, ink: false });
  legs.detail(rbox(12, 9, 0.4, 0.1, 1), { col: 0xe0d8c0, bone: b('paper'), pos: [-P.shoulderX - 2, P.wristY + 3, 4], rot: [0.2, 0.3, 0], emit: 0.35, surf: FAM.cloth });
  const g: Gait = { ...GAIT_WALK, stride: 0.6, bob: 2.6, arm: 0.5, lift: 0.3 };
  const clips: Clips = {
    move: { frames: 22, fn: (t) => mix(gaitPose(t, g), { armR: { rx: -1.9, rz: 0.3 }, foreR: { rx: -0.2 }, head: { rx: -0.1 } }) },
    // "EXTRA!": the paper flung overarm
    attack: { frames: 12, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7)), fling = pulse(t, 0.9, 0.1);
      return { armR: { rx: -2.8 * k + 2 * fling, rz: 0.2 }, foreR: { rx: -0.6 * k }, chest: { ry: 0.4 * k - 0.6 * fling, rx: -0.1 * k } };
    } },
  };
  const geo = layered([{ sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: jacket, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }]);
  return { geo, rig: new Rig(bones, clips) };
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
  // D-89, in layers: the dead the line was laid through the churchyard for — a skull-gaunt face, yellowed and soil-dark,
  // hollow cheeks, a green light deep in each socket, the mouth a slit; lank strands of hair; a burial suit gone the
  // colour of the grave, its hem and cuffs in tatters, torn open over the ribs; trousers rotted off at the shin over
  // bone-thin legs and bare feet; soil still clinging; a wilted funeral lily in the lapel. The same skeleton, size,
  // shamble and clawing rise.
  const P = prop(1, { headR: 11, chestW: 10.5, waistW: 8.5, hipW: 9.5, depth: 0.72, arm: [3, 2.5, 2.1], leg: [3.8, 3, 2.5] });
  const bones = humanBones(P);
  const b = bi(bones);
  const skin = new Sculpt(1.6, 3, 0.5), suit = new Sculpt(2.2, 4, 0.5), legs = new Sculpt(2.2, 4, 0.5);
  const r = P.headR, y = P.headY;
  const sk = { col: graveSkin, surf: FAM.skin };
  // ---- skin: the head, a thin neck, the chest under the tear, bony forearms and hands, bone-thin shins, bare feet
  styleHead(skin, P, b('head'), GRAVE, { jaw: 0.9, chin: 0.9, nose: 0.5, brow: 1.4, ears: 0.8 });
  neckShell(skin, P, b, sk, 0.27);
  skin.add({ t: 'ell', c: [0, P.chest + 1, 0.6], r: [P.chestW, 9, P.chestW * P.depth] }, { ...sk, bone: b('chest'), k: 2, ink: false });
  for (const [s, n] of SIDES) {
    const { wr, an } = joints(P, s);
    armShell(skin, P, b, s, -0.3, sk, { from: 1.4 });
    legShell(skin, P, b, s, -0.4, sk, { from: 1.3 });
    styleHand(skin, wr, s, P.arm[2] * 1.1, GRAVE, b(`hand${n}`));
    styleShoe(skin, [an[0], P.ankle, 0], 9.6, GRAVE, b(`foot${n}`), { surf: FAM.skin, sole: C(GRAVE).multiplyScalar(0.8).getHex(), toeUp: 0.02, width: 0.85 });
  }
  const fz = (x: number, yy: number) => frontZ(skin, x, yy);
  const eyes = [1, -1].map((s): V3 => [s * r * 0.36, y + r * 0.1, fz(s * r * 0.36, y + r * 0.1)]);
  const my = y - r * 0.56, mz = fz(0, my);
  const ribs = [0, 1, 2, 3].map((i) => [-6.2, -3.6, -0.8].map((x, j): V3 => {
    const yy = P.chest + 3.4 - i * 2.6 + (j === 1 ? 0.6 : 0) - (j === 0 ? 0.8 : 0);
    return [x, yy, fz(x, yy) + 0.2];
  }));
  for (const s of [1, -1]) skin.add({ t: 'ell', c: [s * r * 0.5, y - r * 0.34, r * 0.66], r: [r * 0.22, r * 0.2, r * 0.16] }, { sub: true, k: 0.6 });
  for (const [ex, ey, ez] of eyes) {
    skin.add({ t: 'sph', c: [ex, ey, ez - 0.2], r: r * 0.21 }, { sub: true, k: 0.8 });
    glowEye(skin, b('head'), [ex, ey, ez - r * 0.24], 1.4, 0xb8ff90, 1.6);
  }
  skin.add({ t: 'box', c: [0, my, mz], h: [r * 0.36, r * 0.06, 1.6], r: 0.4 }, { sub: true, k: 0.6 });
  skin.detail(rbox(r * 0.64, r * 0.08, 0.4, 0.1, 1), { col: 0x140e08, bone: b('head'), pos: [0, my, mz - 1.1], surf: FAM.rubber, ink: false });
  for (const rib of ribs) skin.detail(tube(rib, 0.5, 4, 8), { col: 0xd0c8a8, bone: b('chest'), surf: FAM.bone, ink: false });
  // lank strands of hair hanging from the crown
  for (const a of [-2.4, -1.9, -1.3, 1.3, 1.9, 2.5]) skin.add({ t: 'cap', a: [Math.sin(a) * r * 0.55, y + r * 0.98, Math.cos(a) * r * 0.42], b: [Math.sin(a) * r * 1.0, y - r * 0.5, Math.cos(a) * r * 0.72], ra: 1.3, rb: 0.8 }, { col: 0x5a5448, surf: FAM.hair, bone: b('head'), k: 0.5 });
  // ---- the burial suit gone to the grave's colours: torn over the ribs, the hem and cuffs in tatters
  const gs = { col: vertical(0x181612, 0x34302a, 20, 70), surf: FAM.cloth };
  torsoShell(suit, P, b, 0.8, gs, { k: 0.6 });
  suit.add({ t: 'box', c: [0, P.hip - 14, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.2 });
  for (const [s] of SIDES) armShell(suit, P, b, s, 0.7, gs, { to: 1.5 });
  const tz = frontZ(suit, -3, P.chest + 1);
  suit.add({ t: 'ell', c: [-3.2, P.chest + 0.5, tz + 1], r: [4.4, 6, 3.4], rot: [0, 0, 0.3] }, { sub: true, k: 0.6 });
  const rs = stream(61);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rs() * 0.6;
    suit.add({ t: 'box', c: [Math.cos(a) * (P.hipW + 1), P.hip - 4.2, 0.3 + Math.sin(a) * (P.hipW + 1) * P.depth], h: [1.4, 2.4 + rs() * 1.4, 3], r: 0.4, rot: [0, -a, 0.3] }, { sub: true, k: 0.5 });
  }
  for (const [s] of SIDES) {
    const { el, wr } = joints(P, s);
    const c = along(el, wr, 0.5);
    for (const da of [0, 2.1, 4.2]) suit.add({ t: 'box', c: [c[0] + Math.cos(da) * 3, c[1] - 1.6, c[2] + Math.sin(da) * 3], h: [1.2, 2.2, 2.2], r: 0.4, rot: [0, -da, 0] }, { sub: true, k: 0.5 });
  }
  // the lily: a wilted white bell and its leaf, in the lapel
  const lp = onSurface(suit, [5, P.chest + 4, 0], [5, P.chest + 4, 30], 0.4);
  suit.detail(cone(1.7, 4.2, 8), { col: 0xd8d0b0, bone: b('chest'), pos: lp, rot: [0.9, 0, -0.5], surf: FAM.cloth });
  suit.detail(ellipsoid(0.8, 3, 0.3, 8, 6), { col: 0x4a5a2e, bone: b('chest'), pos: [lp[0] + 1.2, lp[1] - 2, lp[2]], rot: [0.3, 0, 0.6], surf: FAM.cloth });
  // ---- trousers rotted off at the shin, ragged; soil clinging to the feet
  torsoShell(legs, P, b, 0.6, { ...gs, ink: false }, { chest: false });
  for (const [s, n] of SIDES) {
    const { kn, an } = joints(P, s);
    legShell(legs, P, b, s, 0.6, gs, { to: 1.42 });
    const c = along(kn, an, 0.4);
    for (const da of [0.4, 2.5, 4.6]) legs.add({ t: 'box', c: [c[0] + Math.cos(da) * 3.4, c[1] - 1.4, c[2] + Math.sin(da) * 3.4], h: [1.3, 2.4, 2.4], r: 0.4, rot: [0, -da, 0] }, { sub: true, k: 0.5 });
    for (let i = 0; i < 3; i++) legs.detail(ellipsoid(2.4, 1.6, 2, 8, 6), { col: 0x2a2216, bone: b(`foot${n}`), pos: [an[0] + (i - 1) * 2, 1.4, 2 + i * 2.6], surf: FAM.cloth });
  }
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
  const geo = layered([{ sc: skin, o: LAYER.skin }, { sc: suit, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }]);
  return { geo, rig: new Rig(bones, clips) };
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
  // D-89, in layers: a golem of slag from the firebox — a hunched mound of shoulders, the head sunk into it, great
  // dripping fists; its body cooled to a dark crust split into plates, the molten iron glowing through every crack
  // between them (it was noise in the colour), white-hot at the core in its chest and in its eyes; drips hanging from
  // the fists. The same skeleton, size, plod and slam.
  const P = prop(1.6, { headR: 9, chestW: 17, waistW: 14, hipW: 13, depth: 0.9, arm: [6.5, 6, 6.5], leg: [6.5, 5.5, 5], neck: 60, headY: 66 });
  const bones = humanBones(P);
  const b = bi(bones);
  const D: Proportions = { ...P, depth: 0.82 };
  const melt = new Sculpt(3, 4, 0.5), crust = new Sculpt(2.6, 4, 0.5);
  const hot = { col: vertical(0xc0380a, 0xf07a1a, 0, P.shoulderY), surf: FAM.rubber, emit: 0.55 };
  const cr = { col: vertical(0x1e1814, 0x3e322a, 0, P.shoulderY + 20), surf: [0.9, 0] as Surf };
  const hx = P.shoulderX + P.armOut * 1.6;
  // the body twice: the molten core, and the crust 1.9 out over it
  const body = (sc: Sculpt, g: number, part: Part) => {
    torsoShell(sc, D, b, g, part, { k: 0.8 });
    sc.add({ t: 'ell', c: [0, P.shoulderY + 2, -4], r: [P.chestW * 1.2 + g, 12 + g, 14 + g] }, { ...part, bone: b('chest'), k: 3 });
    sc.add({ t: 'sph', c: [0, P.headY - 4, 6], r: P.headR * 1.1 + g }, { ...part, bone: b('head'), k: 2 });
    for (const [s, n] of SIDES) {
      armShell(sc, D, b, s, g, part);
      legShell(sc, D, b, s, g, part);
      sc.add({ t: 'sph', c: [s * hx, P.wristY - 8, 2], r: 9 + g }, { ...part, bone: b(`hand${n}`), k: 1.5 });
      sc.add({ t: 'ell', c: [s * (P.stance + 0.4), 5 + g * 0.3, 6], r: [7 + g, 5 + g, 11 + g] }, { ...part, bone: b(`foot${n}`), k: 1.5 });
    }
  };
  body(melt, -0.5, hot);
  body(crust, 1.4, cr);
  // every query of the crust first (the cuts change it): the eyes, the core, the cracks' paths
  const on = (o: V3, p: V3, lift = -0.6) => onSurface(crust, o, p, lift);
  const eyes = [1, -1].map((s) => on([s * 3.5, P.headY - 3, 6], [s * 3.5, P.headY - 3, 40], 0.2));
  const core = on([0, P.chest, 0], [0, P.chest, 40], 0);
  const zig = (zs: number, xs: number[], ys: number[]) => xs.map((x, i) => on([0, ys[i], zs > 0 ? 0 : -4], [x, ys[i], zs * 40]));
  const paths = [
    zig(1, [6, -3, 5, -4, 3], [P.shoulderY + 4, P.chest + 6, P.chest - 6, P.waist, P.hip + 3]),
    zig(1, [-14, -9, -16], [P.chest + 4, P.waist + 2, P.hip + 4]),
    zig(-1, [-5, 4, -4, 5], [P.shoulderY + 8, P.chest + 2, P.waist + 4, P.hip + 2]),
    zig(-1, [14, 9, 15], [P.chest + 6, P.waist, P.hip + 6]),
    [-26, -12, 0, 12, 26].map((x, i) => on([0, P.shoulderY + 2, -4], [x, P.shoulderY + 40, -4 + (i % 2 ? 6 : -8)])),
    [-9, -3, 4, 10].map((x) => on([0, P.headY - 4, 6], [x, P.headY + 30, 6 + x * 0.3])),
  ];
  for (const pts of paths) for (let i = 1; i < pts.length; i++) crust.add({ t: 'cap', a: pts[i - 1], b: pts[i], ra: 2, rb: 2 }, { sub: true, k: 0.6 });
  // grooves round every limb, so each is plated in sections
  for (const [s] of SIDES) {
    const { sh, el, wr, hp, kn, an } = joints(P, s);
    for (const [a0, a1, u, rad] of [[sh, el, 0.5, (P.arm[0] + P.arm[1]) / 2], [el, wr, 0.35, P.arm[1]], [el, wr, 0.75, P.arm[2]], [hp, kn, 0.5, (P.leg[0] + P.leg[1]) / 2], [kn, an, 0.5, (P.leg[1] + P.leg[2]) / 2]] as const) {
      crust.add({ t: 'tor', c: along(a0, a1, u), R: rad + 1.4 - 0.4, r: 1.9, rot: alongRot(a0, a1) }, { sub: true, k: 0.5 });
    }
  }
  // (the core and eyes are the bloom's sources at play: a wide, bright core washed the whole golem gold)
  crust.add({ t: 'sph', c: core, r: 4.4 }, { sub: true, k: 1 });
  melt.detail(sphere(4.2, 14, 10), { col: 0xffb868, bone: b('chest'), pos: [core[0], core[1], core[2] - 2.4], emit: 1.5, surf: SURF.bulb });
  for (const e of eyes) glowEye(crust, b('head'), e, 1.7, 0xffd070, 1.6);
  // drips of molten iron from the fists
  for (const [s, n] of SIDES) for (const [dx, dz, L] of [[-2, 3, 5], [3, -1, 4], [0, 6, 3.5]] as const) {
    melt.detail(cone(1.3, L, 6), { col: 0xff9a3a, bone: b(`hand${n}`), pos: [s * hx + dx, P.wristY - 17.5 - L * 0.4, 2 + dz], rot: [Math.PI, 0, 0], emit: 1.2, surf: SURF.bulb });
  }
  const g: Gait = { ...GAIT_WALK, stride: 0.3, knee: 0.45, bob: 4, sway: 0.18, twist: 0.08, arm: 0.2, elbow: 0.2, lean: 0.25 };
  const clips: Clips = {
    move: { frames: 40, fn: (t) => mix(gaitPose(t, g), { armL: { rx: 0.3 * sin(t), rz: -0.25 }, armR: { rx: -0.3 * sin(t), rz: 0.25 } }) },
    // both fists up, then down: the slam
    attack: { frames: 18, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.75)), slam = pulse(t, 0.92, 0.08);
      return { armL: { rx: -2.8 * k + 2.4 * slam, rz: -0.1 }, armR: { rx: -2.8 * k + 2.4 * slam, rz: 0.1 }, chest: { rx: -0.3 * k + 0.7 * slam }, hips: { ty: 4 * k - 6 * slam } };
    } },
  };
  const geo = layered([{ sc: melt, o: { ao: 0, paint: 0, seam: 0.2 } }, { sc: crust, o: LAYER.cloth }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== Riveter
function riveter(): SculptModel {
  // D-89, in layers: a riveter that was never a man — a boiler for a chest, banded in brass and studded with rivets, a
  // pressure gauge on it; domed brass pauldrons; iron limbs in plated sections on brass ball joints, iron mitts and
  // boots; a round iron head with one great lens burning orange in a brass porthole; the rivet gun for a right forearm,
  // glowing at the muzzle, and its hose to the tank on his back. The same skeleton, size and braced shot.
  const P = prop(1.05, { headR: 10, chestW: 13, waistW: 11, hipW: 11, depth: 0.95, arm: [4, 3.6, 3.2], leg: [4.6, 4, 3.6] });
  const bones = humanBones(P, [{ name: 'gun', parent: 'foreR', head: [-P.shoulderX - P.armOut, P.elbowY, 0] }]);
  const b = bi(bones);
  // (tight joint bands: plates don't bend; the balls between them do)
  const iron = new Sculpt(1.9, 1.4, 0.5), brassL = new Sculpt(1.7, 1.4, 0.5);
  const r = P.headR, y = P.headY;
  const ir = { col: vertical(0x26262a, 0x4e4e56, 0, y + r), surf: FAM.iron };
  const br = { col: 0x9a7a3a, surf: FAM.brass };
  // ---- the iron: the boiler, a waist and a pelvis block, plated limbs, mitts and boots, a round head on a short neck
  iron.add({ t: 'cap', a: [0, P.waist - 3, 0], b: [0, P.shoulderY - 1.5, 0], ra: P.chestW * 0.9, rb: P.chestW * 0.96, sz: 0.9 }, { ...ir, bone: b('chest'), k: 0.5 });
  iron.add({ t: 'cap', a: [0, P.hip + 3, 0], b: [0, P.waist - 2, 0], ra: P.waistW * 0.62, rb: P.waistW * 0.7 }, { ...ir, bone: b('spine'), k: 0.5 });
  iron.add({ t: 'box', c: [0, P.hip + 0.5, 0], h: [P.hipW - 0.5, 4.6, P.hipW * 0.72], r: 2.4 }, { ...ir, bone: b('hips'), k: 0.5 });
  iron.add({ t: 'sph', c: [0, y, 0], r }, { ...ir, bone: b('head'), k: 0.5 });
  iron.add({ t: 'cap', a: [0, P.neck - 4, 0], b: [0, P.neck + 1, 0], ra: r * 0.42, rb: r * 0.4 }, { ...ir, bone: b('neck'), k: 0.5 });
  for (const [s, n] of SIDES) {
    const { sh, el, wr, kn, an } = joints(P, s);
    armShell(iron, P, b, s, 0.4, ir, { from: 0.14, to: 0.86 });
    armShell(iron, P, b, s, 0.4, ir, { from: 1.14, to: 1.9 });
    legShell(iron, P, b, s, 0.4, ir, { from: 0.06, to: 0.87 });
    legShell(iron, P, b, s, 0.4, ir, { from: 1.13, to: 2 });
    styleHand(iron, wr, s, P.arm[2], 0x34343a, b(`hand${n}`), FAM.iron, true);
    styleShoe(iron, [an[0], P.ankle, 0], 11, 0x2a2a2e, b(`foot${n}`), { surf: FAM.iron, width: 1.15, sole: 0x18181a });
    brassL.add({ t: 'sph', c: el, r: P.arm[1] + 0.5 }, { ...br, bone: b(`fore${n}`), k: 0.3 });
    brassL.add({ t: 'sph', c: kn, r: P.leg[1] + 0.6 }, { ...br, bone: b(`shin${n}`), k: 0.3 });
    // domed pauldrons over the shoulders
    brassL.add({ t: 'ell', c: [sh[0] + s * 0.4, sh[1] + 1.6, 0], r: [P.arm[0] + 2.4, 3.6, P.arm[0] + 2.6], rot: [0, 0, -s * 0.3] }, { ...br, bone: b(`arm${n}`), k: 0.4 });
  }
  // ---- brass: bands round the boiler with rivets on their fronts, the gauge, the porthole and its lens
  const ya = P.waist - 3, yb = P.shoulderY - 1.5;
  for (const by of [P.waist - 1, P.chest, P.shoulderY - 4]) {
    const bx = P.chestW * (0.9 + 0.06 * (by - ya) / (yb - ya)), bd = bx * 0.9;
    brassL.detail(torus(bx + 0.2, 0.8, 5, 26), { col: 0x9a7a3a, bone: b('chest'), pos: [0, by, 0], rot: [Math.PI / 2, 0, 0], scale: [1, bd / bx, 1], surf: FAM.brass });
    for (let i = 0; i < 6; i++) {
      const a = -1.1 + (i / 5) * 2.2;
      brassL.detail(sphere(0.55, 6, 4), { col: 0xb8964a, bone: b('chest'), pos: [Math.sin(a) * (bx + 0.6), by + 1.2, Math.cos(a) * (bd + 0.6)], surf: FAM.brass });
    }
  }
  const gy = P.chest + 4.4, gz = frontZ(iron, 3.4, gy);
  brassL.detail(torus(2.4, 0.5, 5, 16), { col: 0x9a7a3a, bone: b('chest'), pos: [3.4, gy, gz + 0.2], surf: FAM.brass, ink: false });
  brassL.detail(cyl(2.1, 2.1, 0.4, 16), { col: 0xe8e0c8, bone: b('chest'), pos: [3.4, gy, gz + 0.1], rot: [Math.PI / 2, 0, 0], surf: SURF.porcelain, ink: false });
  brassL.detail(rbox(0.3, 1.8, 0.2, 0.1, 1), { col: 0x2a1a10, bone: b('chest'), pos: [3.6, gy + 0.6, gz + 0.35], rot: [0, 0, -0.6], surf: SURF.paint, ink: false });
  const hz = frontZ(iron, 0, y);
  brassL.detail(cyl(4, 4.5, 3, 14), { col: 0x9a7a3a, bone: b('head'), pos: [0, y, hz - 0.5], rot: [Math.PI / 2, 0, 0], surf: FAM.brass });
  glowEye(brassL, b('head'), [0, y, hz + 1.2], 3, 0xff9a40, 2);
  // ---- the rivet gun for a right forearm, the hose, the tank on its back
  brassL.detail(cyl(3.8, 3.2, 20, 10), { col: 0x2a2a2e, bone: b('gun'), pos: [-P.shoulderX - P.armOut, P.elbowY - 10, 6], rot: [Math.PI / 2 + 0.3, 0, 0], surf: FAM.iron });
  brassL.detail(torus(3.5, 0.6, 5, 14), { col: 0x9a7a3a, bone: b('gun'), pos: [-P.shoulderX - P.armOut, P.elbowY - 11.5, 10.5], rot: [0.3, 0, 0], surf: FAM.brass });
  brassL.detail(cyl(1.4, 1.4, 6, 8), { col: 0xff6a20, bone: b('gun'), pos: [-P.shoulderX - P.armOut, P.elbowY - 13, 17], rot: [Math.PI / 2 + 0.3, 0, 0], emit: 1.6, surf: SURF.bulb });
  const tankZ = surfaceAt(iron, [0, P.chest + 2, 0], [0, 0, -1], 30)[2] - 4.6;
  brassL.detail(cyl(5, 5, 14, 12), { col: 0x34343a, bone: b('chest'), pos: [0, P.chest + 2, tankZ], surf: FAM.iron });
  for (const dy of [-4.6, 4.6]) brassL.detail(torus(5.1, 0.5, 4, 16), { col: 0x9a7a3a, bone: b('chest'), pos: [0, P.chest + 2 + dy, tankZ], rot: [Math.PI / 2, 0, 0], surf: FAM.brass });
  brassL.detail(tube([[-3, P.chest + 8, tankZ + 1], [-9, P.shoulderY + 3, -3], [-P.shoulderX - 1, P.shoulderY, 1]], 1.1, 5, 10), { col: 0x1e1e20, bone: b('chest'), surf: FAM.rubber });
  const g: Gait = { ...GAIT_WALK, stride: 0.4, knee: 0.5, bob: 1.8, arm: 0.2, twist: 0.05 };
  const clips: Clips = {
    move: { frames: 30, fn: (t) => mix(gaitPose(t, g), { armR: { rx: -0.9, rz: 0.1 }, foreR: { rx: -0.6 } }) },
    // the gun levelled and braced
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7)), kick = pulse(t, 0.9, 0.1);
      return { armR: { rx: -1.5 * k, rz: 0.1 }, foreR: { rx: -0.05 * k }, gun: { rx: -0.3 * kick }, chest: { rx: -0.15 * kick }, armL: { rx: -0.6 * k, rz: -0.4 * k } };
    } },
  };
  const geo = layered([{ sc: iron, o: LAYER.hard }, { sc: brassL, o: LAYER.hard }]);
  return { geo, rig: new Rig(bones, clips) };
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
  // D-89, in layers: villagers gone to stone where they stood — a grey stone face and hands with cracks across them, a
  // pocket-watch face for each eye, still faintly lit; a bonnet tied under the chin, its brim framing the face; a knitted
  // shawl crossed over the shoulders; a long dress and an apron, all gone the greys of a churchyard; stone ankles and
  // dark shoes below the hem. The same skeleton, size and stop-motion sprint.
  const P = prop(1, { headR: 11, chestW: 11, waistW: 9.5, hipW: 10.5, depth: 0.76 });
  const bones = humanBones(P);
  const b = bi(bones);
  const rock = new Sculpt(1.6, 3, 0.5), bonnet = new Sculpt(1.7, 3, 0.5), dress = new Sculpt(2.3, 4, 0.5), shawl = new Sculpt(2.1, 3.5, 0.5);
  const r = P.headR, y = P.headY;
  const st = { col: STONE, surf: [0.88, 0] as Surf };
  // ---- stone: the head and neck, forearms and hands, ankles; cracks; watch faces for eyes
  styleHead(rock, P, b('head'), STONE, { jaw: 0.95, nose: 0.9, brow: 0.9 });
  neckShell(rock, P, b, st, 0.32);
  for (const [s, n] of SIDES) {
    armShell(rock, P, b, s, 0, st, { from: 1.5 });
    styleHand(rock, joints(P, s).wr, s, P.arm[2], STONE, b(`hand${n}`), [0.88, 0]);
    legShell(rock, P, b, s, 0, st, { from: 1.55 });
    styleShoe(rock, [joints(P, s).an[0], P.ankle, 0], 9.6, 0x2a2826, b(`foot${n}`));
  }
  const fz = (x: number, yy: number) => frontZ(rock, x, yy);
  for (const s of [1, -1]) {
    const ex = s * r * 0.36, ey = y + r * 0.1, ez = fz(ex, ey);
    rock.detail(cyl(r * 0.2, r * 0.2, 0.5, 16), { col: 0xe8e0c8, bone: b('head'), pos: [ex, ey, ez + 0.1], rot: [Math.PI / 2, s * 0.3, 0], emit: 0.9, surf: SURF.porcelain, ink: false });
    rock.detail(torus(r * 0.2, 0.45, 4, 16), { col: 0x9a8a5a, bone: b('head'), pos: [ex, ey, ez + 0.2], rot: [0, s * 0.3, 0], surf: FAM.brass, ink: false });
    rock.detail(rbox(0.35, r * 0.15, 0.2, 0.1, 1), { col: 0x141414, bone: b('head'), pos: [ex, ey + r * 0.06, ez + 0.45], rot: [0, s * 0.3, 0], surf: SURF.paint, ink: false });
    rock.detail(rbox(0.3, r * 0.1, 0.2, 0.1, 1), { col: 0x141414, bone: b('head'), pos: [ex + r * 0.04, ey - r * 0.02, ez + 0.45], rot: [0, s * 0.3, -1.9], surf: SURF.paint, ink: false });
  }
  const cracks = [[[0.12, 0.66], [0.22, 0.42], [0.14, 0.26], [0.3, 0.02]], [[-0.4, -0.2], [-0.26, -0.42], [-0.34, -0.62]]] as const;
  for (const c of cracks) rock.detail(tube(c.map(([u, v]): V3 => [u * r, y + v * r, fz(u * r, y + v * r) + 0.05]), 0.24, 4, 10), { col: 0x2a2a28, bone: b('head'), surf: SURF.paint, ink: false });
  rock.detail(rbox(r * 0.34, r * 0.05, 0.3, 0.1, 1), { col: 0x3a3a38, bone: b('head'), pos: [0, y - r * 0.52, fz(0, y - r * 0.52) + 0.05], surf: SURF.paint, ink: false });
  // ---- the bonnet: a deep brim framing the face, a crown over the back of the head, ribbons tied under the chin
  const bn = { col: 0x4a3a3c, surf: FAM.cloth, bone: b('head') };
  bonnet.add({ t: 'ell', c: [0, y + r * 0.26, -r * 0.2], r: [r * 1.08, r * 1.04, r * 1.06] }, { ...bn, k: 1 });
  bonnet.add({ t: 'ell', c: [0, y - r * 0.08, r * 0.98], r: [r * 0.8, r * 1.0, r * 0.72] }, { sub: true, k: 0.6 });
  bonnet.add({ t: 'ell', c: [0, y - r * 0.9, -r * 0.1], r: [r * 1.2, r * 0.5, r * 1.2] }, { sub: true, k: 0.6 });
  bonnet.detail(torus(1, 0.085, 5, 28, Math.PI * 1.25), { col: 0x5a4648, bone: b('head'), pos: [0, y - r * 0.08, r * 0.6], rot: [-0.3, 0, -Math.PI * 0.125], scale: [r * 0.84, r * 1.0, r * 0.84], surf: FAM.cloth });
  const so: V3 = [0, y - r * 0.2, 0];
  const ribbon = ([[0.86, -0.25, 0.3], [0.62, -0.75, 0.48], [0.18, -0.98, 0.62], [-0.18, -0.98, 0.62], [-0.62, -0.75, 0.48], [-0.86, -0.25, 0.3]] as const).map(([u, v, w]) => onSurface(rock, so, [u * r, y + v * r, w * r], 0.3));
  bonnet.detail(tube(ribbon, 0.5, 4, 20), { col: 0x3a3634, bone: b('head'), surf: FAM.cloth, ink: false });
  for (const s of [1, -1]) bonnet.detail(ellipsoid(1.8, 1.1, 0.6, 8, 6), { col: 0x3a3634, bone: b('head'), pos: [s * 1.4, y - r * 1.02, ribbon[2][2] + 0.4], rot: [0, 0, s * 0.4], surf: FAM.cloth });
  // ---- the dress to the ankles and its apron
  const dr = { col: vertical(0x3e3a34, 0x5e5850, 6, P.shoulderY), surf: FAM.cloth };
  torsoShell(dress, P, b, 0.6, dr, { k: 0.6 });
  coatSkirt(dress, P, b, 0.8, 8, 1.5, dr);
  for (const [s] of SIDES) armShell(dress, P, b, s, 0.6, dr, { to: 1.55 });
  const az = frontZ(dress, 0, P.hip - 6);
  dress.add({ t: 'ell', c: [0, P.hip - 8, az - 2.2], r: [P.hipW * 0.85, 16, 3], rot: [-0.08, 0, 0] }, { col: 0x8a8880, surf: FAM.cloth, bone: b('hips'), k: 0.6 });
  // ---- the knitted shawl: round the shoulders and crossed over the breast
  const sw = { col: 0x3a3c48, surf: FAM.wool, bone: b('chest') };
  shawl.add({ t: 'ell', c: [0, P.shoulderY - 0.5, 0], r: [P.chestW + 2.8, 5, (P.chestW + 2.8) * 0.82] }, { ...sw, k: 1 });
  shawl.add({ t: 'ell', c: [0, P.shoulderY - 6, -P.chestW * 0.62], r: [P.chestW * 0.8, 8, 3] }, { ...sw, k: 1.2 });
  for (const s of [1, -1]) {
    const a = onSurface(dress, [s * 6, P.shoulderY - 1, 0], [s * 6, P.shoulderY - 1, 30], 1), c = onSurface(dress, [-s * 4, P.waist + 1, 0], [-s * 4, P.waist + 1, 30], 1);
    shawl.add({ t: 'cap', a, b: c, ra: 2.6, rb: 2 }, { ...sw, k: 0.8 });
  }
  const g: Gait = { ...GAIT_WALK, stride: 0.7, knee: 0.9, bob: 1.5, arm: 0.7, twist: 0.2, lean: 0.25 };
  const clips: Clips = {
    // the jerky, stop-motion sprint of something that forgot how to move and remembered all at once
    move: { frames: 16, fn: (t) => gaitPose(Math.floor(t * 8) / 8, g) },
    attack: { frames: 12, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7));
      return { armL: { rx: -1.6 * k, rz: 0.2 }, armR: { rx: -1.6 * k, rz: -0.2 }, chest: { rx: 0.4 * k }, head: { rx: -0.3 * k, rz: 0.3 * k } };
    } },
  };
  const geo = layered([{ sc: rock, o: LAYER.skin }, { sc: bonnet, o: LAYER.cloth }, { sc: dress, o: LAYER.cloth }, { sc: shawl, o: LAYER.cloth }]);
  return { geo, rig: new Rig(bones, clips) };
}

// ================================================================== the Watcher
function watcher(): SculptModel {
  // D-89, in layers: tall and thin, too tall — a long black frock coat to the shins, its collar turned up high, a white
  // cravat at the throat; thin black trousers, long pointed shoes; long pale fingers; a long dark head with no face but
  // two pinprick eyes, under a stovepipe hat with a band. It does not walk while you look. The same skeleton, size and
  // stillness.
  const P = prop(1.7, { headR: 6.5, chestW: 7, waistW: 5.5, hipW: 6, depth: 0.6, arm: [2, 1.6, 1.3], leg: [2.6, 2, 1.6] });
  const bones = humanBones(P);
  const b = bi(bones);
  const D: Proportions = { ...P, depth: 0.72 };
  const head = new Sculpt(1.7, 3, 0.5), coat = new Sculpt(2.4, 4, 0.5), legs = new Sculpt(2.3, 4, 0.5), hands = new Sculpt(1.5, 3, 0.5);
  const r = P.headR, y = P.headY;
  // ---- the head: long, narrow, dark, no face but the two pinprick eyes
  const hd = { col: 0x1a1a1e, surf: FAM.skin, bone: b('head') };
  head.add({ t: 'ell', c: [0, y + r * 0.05, 0], r: [r * 0.8, r * 1.3, r * 0.86] }, { ...hd, k: 1 });
  head.add({ t: 'ell', c: [0, y - r * 0.6, r * 0.18], r: [r * 0.5, r * 0.6, r * 0.6] }, { ...hd, k: 1.4 });
  neckShell(head, P, b, { col: 0x1a1a1e }, 0.3);
  for (const s of [1, -1]) glowEye(head, b('head'), [s * r * 0.32, y + r * 0.1, frontZ(head, s * r * 0.32, y + r * 0.1) - 0.1], 0.9, 0xfff8e0, 2.6);
  // the stovepipe hat
  const hf = hatFrame([0, y + r * 1.1, -r * 0.05], -0.08);
  head.detail(hf(cyl(r * 0.96, r * 0.9, r * 2.3, 22), [0, r * 1.1, 0]), { col: 0x0a0a0c, bone: b('head'), surf: [0.42, 0] });
  head.detail(hf(cyl(r * 1.55, r * 1.55, r * 0.1, 26)), { col: 0x0a0a0c, bone: b('head'), surf: [0.42, 0] });
  head.detail(hf(cyl(r * 0.93, r * 0.93, r * 0.36, 22, true), [0, r * 0.26, 0]), { col: 0x3a3a40, bone: b('head'), surf: FAM.cloth, ink: false });
  // ---- the frock coat: black with a sheen, to the shins, a high collar turned up, a white cravat at the throat
  const cv = { col: vertical(0x0c0c10, 0x24242c, 10, P.shoulderY), surf: [0.6, 0] as Surf };
  torsoShell(coat, D, b, 1.0, cv, { k: 0.6, shoulders: false });
  for (const s of [1, -1]) coat.add({ t: 'cap', a: [s * 1.5, P.neck - 2, -0.6], b: [s * (P.shoulderX - 0.6), P.shoulderY - 0.6, -0.2], ra: r * 0.36 + 1, rb: P.arm[0] + 1.2 }, { ...cv, bone: b('chest'), k: 1.2 });
  // a long frock coat's body, one column from the hips to the shoulders (on his thin frame the chest's ellipsoid read as a ball)
  coat.add({ t: 'cap', a: [0, P.hip + 2, 0.3], b: [0, P.shoulderY - 3, 0.3], ra: P.hipW + 1.6, rb: P.chestW - 0.6, sz: 0.74 }, { ...cv, bone: b('chest'), k: 1.2 });
  coatSkirt(coat, D, b, 1.1, P.knee - 10, 1.5, cv);
  for (const [s, n] of SIDES) {
    const { el, wr } = joints(P, s);
    armShell(coat, D, b, s, 0.8, cv, { to: 1.9 });
    ring(coat, along(el, wr, 0.88), P.arm[2] + 1.4, 0.8, cv, b(`fore${n}`), alongRot(el, wr));
  }
  coat.add({ t: 'cap', a: [0, P.neck - 4, -0.4], b: [0, P.neck + 3.4, -0.8], ra: r * 0.62, rb: r * 0.72 }, { ...cv, bone: b('chest'), k: 0.5 });
  coat.add({ t: 'box', c: [0, P.neck, r * 0.8], h: [r * 0.36, 6, r * 0.5], r: 0.5, rot: [0.2, 0, 0] }, { sub: true, k: 0.4 });
  const cz = frontZ(coat, 0, P.neck - 4.5);
  coat.detail(ellipsoid(2.2, 2.8, 1.4, 10, 8), { col: 0xd8d4c8, bone: b('chest'), pos: [0, P.neck - 4.5, cz + 0.4], surf: FAM.cloth, ink: false });
  for (let i = 0; i < 3; i++) {
    const by = P.waist - 2 + i * 5;
    coat.detail(sphere(0.9, 8, 6), { col: 0x2a2a30, bone: b(i < 1 ? 'spine' : 'chest'), pos: [1.6, by, frontZ(coat, 1.6, by) + 0.2], surf: [0.3, 0] });
  }
  // ---- thin black trousers below the coat, long pointed shoes
  const tr = { col: 0x101014, surf: FAM.cloth };
  for (const [s, n] of SIDES) {
    legShell(legs, P, b, s, 0.6, tr, { from: 0.9 });
    styleShoe(legs, [joints(P, s).an[0], P.ankle, 0], 15, 0x08080a, b(`foot${n}`), { width: 0.75, toeUp: 0.14, surf: [0.3, 0] });
  }
  // ---- long pale fingers
  for (const [s, n] of SIDES) {
    const { wr } = joints(P, s);
    hands.add({ t: 'ell', c: [wr[0] + s * 0.2, wr[1] - 2.6, wr[2] + 0.4], r: [1.6, 2.8, 2.2] }, { col: 0xd8d4cc, surf: FAM.skin, bone: b(`hand${n}`), k: 0.4 });
    for (let i = 0; i < 4; i++) {
      const fz = wr[2] + 1.6 - i * 1.1;
      hands.detail(tube([[wr[0] + s * 0.2, wr[1] - 4.6, fz], [wr[0] + s * 0.1, wr[1] - 9, fz + 0.6], [wr[0] - s * 0.3, wr[1] - 12.4 + (i === 1 ? -1 : 0), fz + 2]], 0.45, 4, 8), { col: 0xd8d4cc, bone: b(`hand${n}`), surf: FAM.skin, ink: true });
    }
  }
  const clips: Clips = {
    // it does not walk while you look: it stands, swaying very slightly, its head tilting
    move: { frames: 60, fn: (t) => ({ hips: { rz: 0.02 * sin(t) }, head: { rz: 0.12 * sin(t, 1, 0.3), rx: 0.08 }, armL: { rz: -0.05 }, armR: { rz: 0.05 } }) },
    // the stare: the head comes forward and down
    attack: { frames: 20, loop: false, fn: (t) => {
      const k = ease(t);
      return { neck: { rx: 0.5 * k }, head: { rx: 0.35 * k, rz: 0.25 * k }, chest: { rx: 0.15 * k } };
    } },
  };
  const geo = layered([{ sc: head, o: LAYER.skin }, { sc: coat, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }, { sc: hands, o: LAYER.skin }]);
  return { geo, rig: new Rig(bones, clips) };
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
  // D-89, in layers: the line's ticket puncher — a navy frock coat to the knee, double-breasted with brass buttons, a belt
  // and buckle, gold rings at the cuffs; dark trousers, glossy boots, grey gloves; a stern grey face, heavy brows and a
  // clipped moustache, eyes glowing pale under a peaked cap with a gold band and a brass badge; the brass punch as long
  // as a forearm, a light in its jaw. The Inspector is the same man grown huge and greyer — white whiskers down to the
  // jaw, a ledger of punched names in one hand, a lamp on a chain at his belt.
  const P = prop(k, inspector
    ? { headR: 11, chestW: 15, waistW: 15, hipW: 13, depth: 0.88, arm: [4.6, 4, 3.4], leg: [5.4, 4.4, 3.6] }
    : { headR: 10.5, chestW: 11, waistW: 9.5, hipW: 10, depth: 0.76, arm: [3.4, 3, 2.6], leg: [4.2, 3.4, 2.8] });
  const bones = humanBones(P, [{ name: 'punch', parent: 'handR', head: [-P.shoulderX - P.armOut * 1.6, P.wristY - 4, 2] }]);
  const b = bi(bones);
  const D: Proportions = { ...P, depth: Math.min(P.depth, 0.84) };
  // (the Inspector's cells grow with him, a little slower than he does: a miniboss is drawn bigger)
  const c = (v: number) => v * (inspector ? k * 0.78 : 1);
  const skin = new Sculpt(c(1.6), c(3), 0.5), hair = new Sculpt(c(1.8), c(3), 0.5), coat = new Sculpt(c(2.4), c(4), 0.5), legs = new Sculpt(c(2.4), c(4), 0.5), gloves = new Sculpt(c(1.6), c(3), 0.5);
  const NAVY = inspector ? 0x1a2030 : 0x22242c, r = P.headR, y = P.headY;
  const sk = { col: ghostSkin, surf: FAM.skin };
  styleHead(skin, P, b('head'), GHOST, { jaw: inspector ? 1.2 : 0.95, chin: 1.05, nose: 1.2, brow: 1.4 });
  neckShell(skin, P, b, sk, inspector ? 0.44 : 0.34);
  ghostFace(skin, P, b('head'), { iris: inspector ? 0xffd080 : 0xd8e8ff, glow: 1.4, size: 0.15, browTilt: 0.25, browW: 1.15, mouthW: 0 });
  // ---- hair, a moustache (the Inspector's whiskers white, down to his jaw), the peaked cap
  const HAIR = inspector ? 0xc8c8c4 : 0x3a3a3c;
  styleHair(hair, P, b('head'), inspector ? 0x9a9a98 : 0x2a2a2c, { ink: false });
  const my = y - r * 0.4, mz = frontZ(skin, 0, my);
  for (const s of [1, -1]) hair.add({ t: 'cap', a: [s * r * 0.05, my + r * 0.04, mz + 0.3], b: [s * r * 0.36, my - r * 0.08, mz - r * 0.12], ra: r * 0.12, rb: r * 0.09 }, { col: HAIR, bone: b('head'), k: 0.5, surf: FAM.hair });
  if (inspector) for (const s of [1, -1]) hair.add({ t: 'ell', c: [s * r * 0.78, y - r * 0.4, r * 0.3], r: [r * 0.18, r * 0.46, r * 0.36], rot: [0, s * 0.3, s * 0.12] }, { col: HAIR, bone: b('head'), k: 0.6, surf: FAM.hair });
  capOn(hair, P, b('head'), 0x10141c, { peaked: true, band: 0xc8a050, badge: PAL.brass });
  // ---- the frock coat: navy, double-breasted, to the knee; a belt and buckle; gold rings at the cuffs
  const cv = { col: NAVY, surf: FAM.wool };
  torsoShell(coat, D, b, 1.0, cv, { k: 0.6 });
  coatSkirt(coat, D, b, 1.2, P.knee + 2 * k, 1.3, cv);
  for (const [s, n] of SIDES) {
    const { el, wr } = joints(P, s);
    armShell(coat, D, b, s, 0.9, cv, { to: 1.9 });
    for (const u of [0.74, 0.82]) coat.detail(torus(P.arm[1] + 0.95 + (P.arm[2] - P.arm[1]) * u, 0.26 * k, 5, 16), { col: 0xc8a050, bone: b(`fore${n}`), pos: along(el, wr, u), rot: across(el, wr), surf: FAM.gold, ink: false });
  }
  for (let i = 0; i < 5; i++) for (const s of [1, -1]) {
    const bx = s * 4 * k, by = P.chest + 6 * k - i * 5 * k;
    coat.detail(sphere(0.9 * k, 6, 5), { col: PAL.brass, bone: b(i < 3 ? 'chest' : 'spine'), pos: [bx, by, frontZ(coat, bx, by) + 0.3], surf: FAM.brass });
  }
  const bY = P.waist - 3 * k, [bw, bd] = waistAt(D, b, 1.0, bY, [1.2, P.knee + 2 * k, 1.3]);
  coat.detail(torus(bw + 0.3, 1 * k, 6, 30), { col: 0x14100c, bone: b('spine'), pos: [0, bY, 0.4], rot: [Math.PI / 2, 0, 0], scale: [1, bd / bw, 1], surf: FAM.leather });
  coat.detail(rbox(3.6 * k, 3 * k, 0.8 * k, 0.4, 1), { col: PAL.brass, bone: b('spine'), pos: [0, bY, bd + 1.2 * k], surf: FAM.brass });
  // ---- trousers below the coat, glossy boots, grey gloves
  const tr = { col: 0x16181e, surf: FAM.cloth };
  for (const [s, n] of SIDES) {
    legShell(legs, D, b, s, 0.6, tr, { from: 0.5 });
    styleShoe(legs, [joints(P, s).an[0], P.ankle, 0], 10 * k, 0x0e0e10, b(`foot${n}`), { surf: [0.3, 0] });
    styleHand(gloves, joints(P, s).wr, s, P.arm[2], 0xc8c4b8, b(`hand${n}`), FAM.cloth, true);
  }
  if (inspector) {
    // a ledger in the left hand, its pages full of punched names; a lamp on a chain at his belt
    gloves.detail(rbox(14, 18, 4, 0.8, 2), { col: 0x3a1a14, bone: b('handL'), pos: [P.shoulderX + P.armOut * 1.6 + 2, P.wristY - 8, 4], rot: [0.2, -0.3, 0], surf: FAM.leather });
    gloves.detail(rbox(13, 17, 3.4, 0.3, 1), { col: 0xd8ceb0, bone: b('handL'), pos: [P.shoulderX + P.armOut * 1.6 + 2.4, P.wristY - 8, 4.3], rot: [0.2, -0.3, 0], surf: FAM.cloth });
    const lamp = onSurface(coat, [0, bY - 4 * k, 0], [40, bY - 4 * k, 20], 3 * k);
    gloves.detail(sphere(3.2, 10, 8), { col: 0xffd080, bone: b('hips'), pos: [lamp[0], lamp[1] - 6 * k, lamp[2]], emit: 1.8, surf: SURF.bulb });
    gloves.detail(cyl(0.3, 0.3, 6 * k, 4), { col: PAL.brass, bone: b('hips'), pos: [lamp[0], lamp[1] - 2.6 * k, lamp[2]], surf: FAM.brass });
  }
  // the punch: a brass clamp as long as a forearm, a light in its jaw
  const L = inspector ? 1.3 : 1, px = -P.shoulderX - P.armOut * 1.6;
  gloves.detail(rbox(3.2 * L, 16 * L, 6 * L, 0.6, 1), { col: PAL.brass, bone: b('punch'), pos: [px, P.wristY - 12 * L, 4], surf: FAM.brass });
  gloves.detail(rbox(3.4 * L, 10 * L, 2 * L, 0.5, 1), { col: PAL.brass, bone: b('punch'), pos: [px, P.wristY - 15 * L, 8 * L], rot: [-0.25, 0, 0], surf: FAM.brass });
  gloves.detail(cyl(1.2 * L, 1.2 * L, 4 * L, 8), { col: 0xffe0a0, bone: b('punch'), pos: [px, P.wristY - 20 * L, 6 * L], rot: [0, 0, Math.PI / 2], emit: 1.2, surf: SURF.bulb });
  const g: Gait = inspector ? { ...GAIT_WALK, stride: 0.38, knee: 0.55, bob: 3, sway: 0.1, arm: 0.25, lean: 0.05 } : { ...GAIT_WALK, stride: 0.62, bob: 2.4, arm: 0.5, lean: 0.15 };
  const clips: Clips = {
    move: { frames: inspector ? 38 : 24, fn: (t) => mix(gaitPose(t, g), { armR: { rx: -0.6 + 0.2 * sin(t), rz: 0.15 }, foreR: { rx: -0.7 }, punch: { rx: 0.1 * sin(t, 2) } }) },
    // the punch raised, then down on your ticket (and your hand)
    attack: { frames: inspector ? 18 : 14, loop: false, fn: (t) => {
      const up = ease(Math.min(1, t / 0.72)), down = pulse(t, 0.92, 0.08);
      return { armR: { rx: -2.4 * up + 1.8 * down, rz: 0.1 }, foreR: { rx: -0.4 * up }, punch: { rx: 0.5 * down }, chest: { rx: -0.15 * up + 0.35 * down }, head: { rx: 0.15 * up } };
    } },
  };
  const geo = layered([{ sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: coat, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }, { sc: gloves, o: LAYER.cloth }]);
  return { geo, rig: new Rig(bones, clips) };
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
