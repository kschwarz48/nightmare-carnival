// The seven playable characters (D-42, D-78): weary 1930s carnival folk modelled on the art reference (Luca
// the carny), on real skeletons with grounded gaits, idle fidgets that say who they are, attack flourishes
// synced to their signature weapon, and hurt and dash clips. Since D-86 (the Carny) and D-87 (the rest) they
// are built on the character art standard (docs/CHARACTER_ART_QUALITY_STANDARD.md): a frame with a larger
// head that reads from the game's camera, flat deliberate colour, and each garment its own shell.

import * as THREE from 'three';
import { C, SURF, cone, cyl, ellipsoid, lathe, rbox, sphere, torus, tube, type Surf, type V3 } from '../core/geo';
import { PAL } from './kit';
import { Sculpt, layered, type Shape } from '../sculpt/sdf';
import { FAM, HERO, LAYER, hatFrame, shadowedJaw, styleFace, styleHair, styleHand, styleHead, styleShoe, surfaceAt, vertical } from '../sculpt/figure';
import { Rig, type ClipDef, type Pose, ease, mix, pulse, sin, cos } from '../sculpt/rig';
import { type Gait, type Proportions, gaitPose, humanBones, hurtPose, idlePose, scaleP } from '../sculpt/humanoid';
import { bareHand, frontZ, torsoShapes } from '../sculpt/realism';

export interface SculptModel {
  geo: THREE.BufferGeometry;
  rig: Rig;
}

/** A grounded walk: real weight, little bounce. */
const REAL_WALK: Gait = { stride: 0.5, knee: 0.8, arm: 0.36, elbow: 0.3, bob: 1.3, twist: 0.1, lean: 0.05, sway: 0.04, squash: 0.015, headBob: 0.02 };

const clips = (gait: Gait, idleExtra: (t: number) => Pose, cast: (t: number) => Pose, moveOverlay?: (t: number) => Pose, castFrames = 24): Record<string, ClipDef> => ({
  idle: { frames: 96, fn: (t) => mix(idlePose(t, 0.8), { chest: { rx: 0.05 }, head: { rx: 0.06 } }, idleExtra(t)) },
  move: { frames: 36, fn: (t) => (moveOverlay ? mix(gaitPose(t, gait), moveOverlay(t)) : gaitPose(t, gait)) },
  cast: { frames: castFrames, loop: false, fn: cast },
  hurt: { frames: 18, loop: false, fn: hurtPose },
  dash: { frames: 16, fn: (t) => mix(gaitPose(t, { ...gait, stride: gait.stride * 1.25, lean: gait.lean + 0.3, bob: gait.bob * 0.8 }), { armL: { rx: 0.7 }, armR: { rx: 0.7 } }) },
});

const B = (bones: ReturnType<typeof humanBones>) => (n: string) => bones.findIndex((x) => x.name === n);

// ---------------------------------------------------------------- The Carny (Luca)
/**
 * The first benchmark of the character art standard (D-86): Luca rebuilt in layers on the HERO frame — a
 * head a quarter larger, broader shoulders, bigger hands and shoes — so he reads from the game's camera
 * as a person, not a stick under a hat. His boater is tipped back so the face shows from 50° above; the
 * waistcoat's stripes are drawn per pixel (they were smeared vertex paint); colour is flat and deliberate,
 * the small details draw no ink, and garments are shells with real edges (rolled sleeves, a V opening
 * onto the shirt, cuffs, soles).
 */
function carny(): SculptModel {
  const P = HERO;
  const bones = humanBones(P, [{ name: 'rag', parent: 'hips', head: [-(P.hipW - 0.4), P.hip + 2, 1.5] }]);
  const b = B(bones);
  // mesh resolution by what each layer has to carry at play size (a world unit is under a pixel there): the
  // face finest, broad garments coarser — their stripes are drawn per pixel, their edges are modelled
  const skin = new Sculpt(0.48, 3, 0.45), hair = new Sculpt(0.6, 3, 0.45), shirt = new Sculpt(0.7, 3, 0.45);
  const vest = new Sculpt(0.62, 3, 0.45), legs = new Sculpt(0.74, 3, 0.45), shoes = new Sculpt(0.6, 3, 0.45), rag = new Sculpt(0.7, 3, 0.45);
  const SKIN = 0xc99c78, SHIRT = 0xdcd2bb, VEST = 0x7c2421, VEST2 = 0xd8c7a0, LAPEL = 0x4c1512, TROU = 0x26222c, SHOE = 0x3c2518;
  const elbow = (s: number): V3 => [s * (P.shoulderX + P.armOut), P.elbowY, -0.6];
  const wrist = (s: number): V3 => [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.6];

  // ---- skin: the head and neck, forearms bare to the rolled sleeves, four-fingered hands
  styleHead(skin, P, b('head'), shadowedJaw(SKIN, P, 0.34), { jaw: 1.02, nose: 0.92 });
  skin.add({ t: 'cap', a: [0, P.neck - 3.6, -0.5], b: [0, P.neck + 3, 0.3], ra: P.headR * 0.4, rb: P.headR * 0.36 }, { col: SKIN, bone: b('neck'), k: 1.2, surf: FAM.skin, ink: false });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const el = elbow(s), wr = wrist(s);
    skin.add({ t: 'cap', a: el, b: wr, ra: P.arm[1] * 0.98, rb: P.arm[2] * 0.92 }, { col: SKIN, bone: b(`fore${n}`), k: 0.8, surf: FAM.skin });
    skin.add({ t: 'ell', c: [el[0] + (wr[0] - el[0]) * 0.3, el[1] + (wr[1] - el[1]) * 0.3, 0.1], r: [P.arm[1] * 0.98, 3.3, P.arm[1] * 1.02] }, { col: SKIN, bone: b(`fore${n}`), k: 1, surf: FAM.skin });
    styleHand(skin, wr, s, P.arm[2], SKIN, b(`hand${n}`));
  }
  // a wry, tired look: brows a little worried, one corner of the mouth up
  styleFace(skin, P, b('head'), { iris: 0x3c2616, browTilt: 0.14, smirk: 0.55, smile: 0.08, size: 0.2 });

  // ---- hair: dark, mostly under the hat — sideburns, the back, a forelock falling out over the brow
  const r = P.headR, hy = P.headY;
  styleHair(hair, P, b('head'), 0x2c1d14, {
    fringe: [
      [[r * 0.12, hy + r * 0.8, r * 0.56], [-r * 0.32, hy + r * 0.44, r * 0.93]],
      [[r * 0.4, hy + r * 0.74, r * 0.5], [r * 0.14, hy + r * 0.42, r * 0.96]],
    ],
  });
  // the straw boater, tipped back off the face so the camera sees under the brim
  const hatM = new THREE.Matrix4().makeRotationX(-0.36).multiply(new THREE.Matrix4().makeRotationZ(0.08));
  const hatAt = (g: THREE.BufferGeometry, y: number) => {
    const gg = g.clone();
    gg.applyMatrix4(hatM.clone().multiply(new THREE.Matrix4().makeTranslation(0, y, 0)).premultiply(new THREE.Matrix4().makeTranslation(0, hy + r * 0.86, -r * 0.12)));
    return gg;
  };
  hair.detail(hatAt(cyl(r * 1.4, r * 1.43, 0.9, 40), 0), { col: 0xd6bf8e, bone: b('head'), surf: FAM.straw });
  hair.detail(hatAt(cyl(r * 0.88, r * 0.93, r * 0.58, 32), r * 0.33), { col: 0xccb382, bone: b('head'), surf: FAM.straw });
  hair.detail(hatAt(cyl(r * 0.945, r * 0.95, r * 0.2, 32, true), r * 0.15), { col: 0x8c2a22, bone: b('head'), surf: FAM.cloth });
  hair.detail(hatAt(rbox(0.5, 1.1, 1.7, 0.2, 1).translate(-r * 0.97, 0, 0.6), r * 0.15), { col: 0x5e1c16, bone: b('head'), surf: FAM.cloth, ink: false });

  // ---- shirt: torso, sleeves rolled above the elbow (two folds), the collar band
  // (the shirt's body is under the waistcoat: no ink of its own, or it would show through)
  for (const t of torsoShapes(P)) shirt.add(t.s, { col: SHIRT, bone: b(t.bone), k: t.k, surf: FAM.cloth, ink: false });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const dr = P.arm[0], el = elbow(s);
    shirt.add({ t: 'ell', c: [s * (P.shoulderX + 0.2), P.shoulderY - dr * 1.4, 0.1], r: [dr * 1.1 + 0.25, dr * 1.85, dr * 1.1 + 0.4], rot: [0, 0, s * 0.1] }, { col: SHIRT, bone: b(`arm${n}`), k: 1.6, surf: FAM.cloth });
    shirt.add({ t: 'cap', a: [s * (P.shoulderX + 0.1), P.shoulderY - dr * 0.7, 0], b: [el[0], el[1] + 1, el[2]], ra: dr * 0.98, rb: P.arm[1] + 0.3 }, { col: SHIRT, bone: b(`arm${n}`), k: 1.1, surf: FAM.cloth });
    shirt.add({ t: 'tor', c: [el[0], el[1] + 0.4, el[2]], R: P.arm[1] + 0.6, r: 0.95 }, { col: SHIRT, bone: b(`arm${n}`), k: 0.25, surf: FAM.cloth });
    shirt.add({ t: 'tor', c: [el[0], el[1] + 1.9, el[2]], R: P.arm[1] + 0.55, r: 0.85 }, { col: SHIRT, bone: b(`arm${n}`), k: 0.25, surf: FAM.cloth });
  }
  shirt.add({ t: 'tor', c: [0, P.neck - 2.5, 0.2], R: P.headR * 0.42, r: 0.85 }, { col: SHIRT, bone: b('chest'), k: 0.3, surf: FAM.cloth });

  // ---- waistcoat: a shell over the shirt, striped, cut open in a V with dark lapels, points at the hem
  const stripes = { kind: 'stripes', col: VEST2, a: 11, b: 0.4, c: 0.25 } as const;
  for (const t of torsoShapes(P, 0.6)) vest.add(t.s, { col: VEST, bone: b(t.bone), k: 0.5, surf: FAM.wool, pat: stripes });
  const vz = (x: number, y: number) => frontZ(vest, x, y);
  const vTop = P.chest + 7.6, vBot = P.chest - 4.2;
  const zTop = vz(0, vTop), zBot = vz(0, vBot);
  for (const s of [1, -1]) {
    const hx = s * 2.5, hy2 = P.waist - 4, hx2 = s * 1.1, hy3 = P.waist - 7.6;
    vest.add({ t: 'cap', a: [hx, hy2, vz(hx, hy2) - 1.2], b: [hx2, hy3, vz(hx2, hy3) - 0.1], ra: 1.5, rb: 0.35 }, { col: VEST, bone: b('spine'), k: 0.5, surf: FAM.wool, pat: stripes });
    const lx = s * 3.1, lx2 = s * 0.45;
    vest.add({ t: 'cap', a: [lx, vTop - 0.3, vz(lx, vTop - 0.3) - 0.35], b: [lx2, vBot + 0.3, vz(lx2, vBot + 0.3) - 0.25], ra: 0.62, rb: 0.46 }, { col: LAPEL, bone: b('chest'), k: 0.25, surf: FAM.wool });
  }
  // the V opening, cut deeper than the waistcoat is thick so the shirt shows through it
  vest.add({ t: 'cap', a: [0, vTop + 0.6, zTop - 0.2], b: [0, vBot, zBot - 0.6], ra: 3.0, rb: 0.95 }, { sub: true, k: 0.2 });
  for (let i = 0; i < 4; i++) {
    const by = vBot - 1.4 - i * 2.5;
    vest.detail(sphere(0.5, 8, 6), { col: 0xc4a464, bone: b(i < 2 ? 'chest' : 'spine'), pos: [0, by, vz(0, by) + 0.12], surf: FAM.brass, ink: false });
  }
  for (const s of [1, -1]) vest.detail(rbox(3.2, 0.34, 0.5, 0.1, 1), { col: 0x2e0e0c, bone: b('spine'), pos: [s * 4.1, P.waist - 1.1, vz(s * 4.1, P.waist - 1.1) + 0.04], rot: [0, s * 0.35, 0], surf: FAM.cloth, ink: false });
  const chain = ([[0.6, P.waist + 1.2], [2.3, P.waist - 0.8], [4.0, P.waist - 1.3]] as const).map(([x, y]): V3 => [x, y, vz(x, y) + 0.22]);
  vest.detail(tube(chain, 0.17, 4, 10), { col: 0xc4a058, bone: b('spine'), surf: FAM.brass, ink: false });
  // the name badge pinned over the heart
  const bdy = P.chest + 2.6, bdz = vz(4.0, bdy);
  vest.detail(rbox(3.4, 1.5, 0.3, 0.2, 1), { col: 0xe8dec8, bone: b('chest'), pos: [4.0, bdy, bdz + 0.12], rot: [0, 0.12, 0], surf: SURF.paint, ink: false });
  for (let i = 0; i < 4; i++) vest.detail(rbox(0.45, 0.8, 0.1, 0.05, 1), { col: 0x1a1210, bone: b('chest'), pos: [4.0 - 1.05 + i * 0.7, bdy, bdz + 0.3], rot: [0, 0.12, 0], surf: SURF.paint, ink: false });
  // the collar points and a red bow tie, in the V
  const tieY = P.neck - 2.5, tieZ = frontZ(shirt, 0, tieY);
  for (const s of [-1, 1]) {
    shirt.detail(rbox(2.2, 0.5, 1.6, 0.2, 1), { col: 0xe4dac4, bone: b('chest'), pos: [s * 1.6, P.neck - 1.7, frontZ(shirt, s * 1.6, P.neck - 1.7) + 0.1], rot: [0.5, 0, s * 0.5], surf: FAM.cloth, ink: false });
    shirt.detail(cone(1.4, 2.6, 8), { col: 0x9a241e, bone: b('chest'), pos: [s * 1.35, tieY, tieZ + 0.55], rot: [0, 0, s * Math.PI / 2], surf: FAM.cloth, ink: false });
  }
  shirt.detail(sphere(0.62, 8, 6), { col: 0x6e1a16, bone: b('chest'), pos: [0, tieY, tieZ + 0.7], surf: FAM.cloth, ink: false });

  // ---- trousers: dark, cuffed, the left knee patched with coarse thread
  legs.add({ t: 'ell', c: [0, P.hip + 1.5, 0], r: [P.hipW + 0.2, 6.2, (P.hipW + 0.2) * P.depth * 1.1] }, { col: TROU, bone: b('hips'), k: 1.5, surf: FAM.cloth });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    const hp: V3 = [s * P.stance, P.hip - 1, 0], kn: V3 = [s * (P.stance + 0.3), P.knee, 0.5], an: V3 = [s * (P.stance + 0.3), P.ankle + 1.5, 0];
    legs.add({ t: 'cap', a: hp, b: kn, ra: P.leg[0] + 0.7, rb: P.leg[1] + 0.6 }, { col: TROU, bone: b(`thigh${n}`), k: 2, surf: FAM.cloth });
    legs.add({ t: 'cap', a: kn, b: an, ra: P.leg[1] + 0.6, rb: P.leg[2] + 0.85 }, { col: TROU, bone: b(`shin${n}`), k: 1, surf: FAM.cloth });
    legs.add({ t: 'tor', c: [an[0], an[1] + 1.1, an[2]], R: P.leg[2] + 1.0, r: 0.95 }, { col: TROU, bone: b(`shin${n}`), k: 0.3, surf: FAM.cloth });
    // a cream sock, then the shoe
    shoes.add({ t: 'cap', a: [an[0], an[1] + 0.6, an[2]], b: [an[0], P.ankle - 1, an[2] + 0.2], ra: P.leg[2] + 0.25, rb: P.leg[2] + 0.35 }, { col: 0xd2c6a6, bone: b(`foot${n}`), k: 0.4, surf: FAM.cloth });
    styleShoe(shoes, [an[0], P.ankle, 0], 8, SHOE, b(`foot${n}`));
  }
  const kx = P.stance + 0.3, ky = P.knee - 1.4, kz = frontZ(legs, kx, ky);
  legs.detail(rbox(3.2, 3.3, 0.4, 0.4, 1), { col: 0x74301f, bone: b('shinL'), pos: [kx, ky, kz + 0.05], rot: [0, 0, 0.12], surf: FAM.cloth, ink: false });
  for (let i = 0; i < 6; i++) legs.detail(rbox(0.14, 0.62, 0.14, 0.05, 1), { col: 0xd8c8a0, bone: b('shinL'), pos: [kx + ((i % 3) - 1) * 1.3, ky + (i < 3 ? 1.65 : -1.65), kz + 0.28], surf: FAM.cloth, ink: false });

  // ---- a rag tucked into the waistband
  const RAG = 0xcdbf9b;
  // (a flat cloth folded over the waistband and hanging to mid-thigh, not a tube)
  rag.add({ t: 'box', c: [-(P.hipW + 0.1), P.hip - 2.4, 2.2], h: [0.5, 4.6, 2.1], r: 0.45, rot: [0.08, -0.5, 0.06] }, { col: RAG, bone: b('rag'), k: 0.5, surf: FAM.cloth });
  rag.add({ t: 'box', c: [-(P.hipW - 0.1), P.hip + 1.4, 2.0], h: [0.7, 1.0, 2.2], r: 0.5, rot: [0, -0.5, 0] }, { col: C(RAG).multiplyScalar(0.9), bone: b('rag'), k: 0.4, surf: FAM.cloth });

  // ---- a fan of dog-eared playing cards in the right hand
  const hx = -(P.shoulderX + P.armOut * 1.6);
  for (let i = 0; i < 4; i++) skin.detail(rbox(3.2, 4.6, 0.22, 0.4, 1), { col: i % 2 ? 0xe8dec8 : 0xdacdb2, bone: b('handR'), pos: [hx - 0.6 - i * 0.35, P.wristY - 4.4 + i * 0.15, 2.8], rot: [0.2, 0.15, -0.6 + i * 0.28], surf: SURF.paint, ink: false });
  skin.detail(rbox(1.2, 1.4, 0.1, 0.1, 1), { col: 0x9a2a20, bone: b('handR'), pos: [hx - 1.5, P.wristY - 3.6, 3.02], rot: [0.2, 0.15, 0.25], surf: SURF.paint, ink: false });

  const rig = new Rig(bones, clips(
    REAL_WALK,
    // idle: weight on one hip, absently shuffling the cards, a glance over the shoulder
    (t) => ({ armR: { rx: -0.45, rz: 0.1 }, foreR: { rx: -0.9, ry: 0.4 * sin(t, 4) * pulse(t, 0.3, 0.2) }, handR: { rz: 0.3 * sin(t, 6) * pulse(t, 0.3, 0.2) }, head: { ry: 0.45 * pulse(t, 0.72, 0.12), rx: 0.05 }, hips: { rz: 0.04, tx: 0.6 }, rag: { rz: 0.05 * sin(t, 2) } }),
    // cast: a quick sidearm flick
    (t) => {
      const wind = ease(t / 0.35) * (1 - ease((t - 0.35) / 0.15));
      const snap = ease((t - 0.35) / 0.12) * (1 - ease((t - 0.6) / 0.4));
      return { chest: { ry: 0.45 * wind - 0.35 * snap }, armR: { rx: 0.4 * wind - 1.2 * snap, rz: 0.8 * wind + 0.15 * snap }, foreR: { rx: -1.1 * wind - 0.2 * snap }, head: { ry: -0.15 * snap } };
    },
    (t) => ({ rag: { rx: 0.12 * sin(t, 2), rz: 0.08 * sin(t) }, armR: { rx: -0.1 }, foreR: { rx: -0.3 } }),
  ));
  const geo = layered([
    { sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: shirt, o: LAYER.cloth }, { sc: vest, o: LAYER.cloth },
    { sc: legs, o: LAYER.cloth }, { sc: shoes, o: LAYER.hard }, { sc: rag, o: LAYER.cloth },
  ]);
  return { geo, rig };
}

// ---------------------------------------------------------------- the rest of the cast (D-87)
// The six other playable characters on the standard: mostly costume work over the Carny's pieces — a
// HERO-style frame, styleHead/styleFace/styleHand, flat colour, patterns per pixel, each garment its own
// shell with modelled edges, no ink on small details or on anything a garment covers.

const SIDES = [[1, 'L'], [-1, 'R']] as const;
const elbowAt = (P: Proportions, s: number): V3 => [s * (P.shoulderX + P.armOut), P.elbowY, -0.6];
const wristAt = (P: Proportions, s: number): V3 => [s * (P.shoulderX + P.armOut * 1.6), P.wristY, 0.6];
/** A point `u` of the way from the elbow to the wrist (past 1: beyond the wrist, for sleeves too long). */
const foreAt = (P: Proportions, s: number, u: number, dz = 0): V3 => {
  const el = elbowAt(P, s), wr = wristAt(P, s);
  return [el[0] + (wr[0] - el[0]) * u, el[1] + (wr[1] - el[1]) * u, el[2] + (wr[2] - el[2]) * u + dz];
};
/** The leg's joints, where realBody and the Carny put them. */
const legAt = (P: Proportions, s: number) => ({ hp: [s * P.stance, P.hip - 1, 0] as V3, kn: [s * (P.stance + 0.3), P.knee, 0.5] as V3, an: [s * (P.stance + 0.3), P.ankle + 1.5, 0] as V3 });

/**
 * The arm's three forms — the deltoid (it belongs to the arm, so it lifts and swings with it), the upper arm
 * beneath it, the forearm — `g` proud of the bare arm when they're a sleeve.
 */
function armForms(P: Proportions, s: number, g = 0): { delt: Shape; upper: Shape; fore: Shape } {
  const dr = P.arm[0];
  return {
    delt: { t: 'ell', c: [s * (P.shoulderX + 0.2), P.shoulderY - dr * 1.4, 0.1], r: [dr * 1.1 + g, dr * 1.85 + g * 0.5, dr * 1.1 + g + 0.2], rot: [0, 0, s * 0.1] },
    upper: { t: 'cap', a: [s * (P.shoulderX + 0.1), P.shoulderY - dr * 0.7, 0], b: elbowAt(P, s), ra: dr * 0.97 + g, rb: P.arm[1] + g },
    fore: { t: 'cap', a: elbowAt(P, s), b: wristAt(P, s), ra: P.arm[1] + g, rb: P.arm[2] + g },
  };
}

// ---------------------------------------------------------------- The Strongman
/**
 * D-87: a heavier HERO frame with the yoke, deltoids, biceps and forearms as their own forms in a warm skin;
 * a bald head with a heavy jaw under a waxed handlebar; a one-shoulder leotard whose leopard spots are drawn
 * per pixel, its neckline scooped clear of the bare left pectoral; a wide belt with a brass plate, wrapped
 * wrists, dark tights, laced boots. The mallet is big enough to read.
 */
function strongman(): SculptModel {
  const P: Proportions = { ...scaleP(HERO, 1.06), shoulderX: 13.0, chestW: 12.8, waistW: 10.0, hipW: 9.4, arm: [4.0, 3.4, 2.6], leg: [4.8, 3.7, 2.8], stance: 5.8, depth: 0.68, headR: 7.4, armOut: 2.4 };
  const bones = humanBones(P);
  const b = B(bones);
  // the head meshed finest; the big body coarser (its forms are large), garments coarser still
  const head = new Sculpt(0.5, 3, 0.45), skin = new Sculpt(0.64, 3, 0.45), suit = new Sculpt(0.8, 3, 0.45), gear = new Sculpt(0.72, 3, 0.45);
  const tights = new Sculpt(0.8, 3, 0.45), boots = new Sculpt(0.8, 3, 0.45);
  const SKIN = 0xc08a62, LEO = 0xb88c3e, SPOT = 0x2a1c14, TIGHTS = 0x2a2630, BOOT = 0x2e1e14, WRAP = 0xd8caa6, WAX = 0x1c130e;
  const r = P.headR;

  // ---- skin: a bald head with a heavy jaw and a bull neck; the yoke and chest, the arms
  styleHead(head, P, b('head'), shadowedJaw(SKIN, P, 0.4), { jaw: 1.2, chin: 1.22, nose: 1.1, brow: 1.3 });
  head.add({ t: 'cap', a: [0, P.neck - 4, -0.6], b: [0, P.neck + 3, 0.2], ra: r * 0.6, rb: r * 0.5 }, { col: SKIN, bone: b('neck'), k: 1.4, surf: FAM.skin });
  // the ribcage is mostly under the leotard (no ink of its own; the belly isn't sculpted at all); of the
  // pectorals and trapezius only the left are bare
  for (const t of torsoShapes(P).filter((t) => t.bone === 'chest')) skin.add(t.s, { col: SKIN, bone: b(t.bone), k: t.k, surf: FAM.skin, ink: false });
  const py = P.chest + 2.2, pz = frontZ(skin, 5.2, py) - 2;
  for (const s of [1, -1]) {
    skin.add({ t: 'ell', c: [s * 5.2, py, pz], r: [5.4, 4.0, 2.8], rot: [0, s * 0.2, 0] }, { col: SKIN, bone: b('chest'), k: 1.6, surf: FAM.skin, ink: s > 0 });
    skin.add({ t: 'cap', a: [s * 2.2, P.neck - 1.5, -1.4], b: [s * (P.shoulderX - 2.8), P.shoulderY - 0.4, -0.8], ra: 3.0, rb: 2.7 }, { col: SKIN, bone: b('chest'), k: 2, surf: FAM.skin, ink: s > 0 });
  }
  for (const [s, n] of SIDES) {
    const f = armForms(P, s);
    skin.add(f.delt, { col: SKIN, bone: b(`arm${n}`), k: 1.6, surf: FAM.skin });
    skin.add(f.upper, { col: SKIN, bone: b(`arm${n}`), k: 1.2, surf: FAM.skin });
    skin.add({ t: 'ell', c: [s * (P.shoulderX + P.armOut * 0.55), P.shoulderY - 9.6, 1.3], r: [3.5, 4.8, 3.7] }, { col: SKIN, bone: b(`arm${n}`), k: 1.4, surf: FAM.skin });
    skin.add(f.fore, { col: SKIN, bone: b(`fore${n}`), k: 0.8, surf: FAM.skin });
    skin.add({ t: 'ell', c: foreAt(P, s, 0.28, 0.3), r: [P.arm[1] * 1.02, 4, P.arm[1] * 1.06] }, { col: SKIN, bone: b(`fore${n}`), k: 1.2, surf: FAM.skin });
    styleHand(skin, wristAt(P, s), s, P.arm[2], SKIN, b(`hand${n}`));
  }
  // a level, proud look under heavy brows; the waxed handlebar under the nose, curled at both ends
  styleFace(head, P, b('head'), { iris: 0x2a1a10, size: 0.17, browTilt: -0.1, browW: 1.15, smile: 0.2 });
  const my = P.headY - r * 0.42, mz = frontZ(head, 0, my) + 0.25;
  const bar: V3[] = [[-r * 0.8, my + r * 0.24, mz - r * 0.4], [-r * 0.44, my - r * 0.03, mz - r * 0.1], [0, my, mz], [r * 0.44, my - r * 0.03, mz - r * 0.1], [r * 0.8, my + r * 0.24, mz - r * 0.4]];
  head.detail(tube(bar, (t) => r * (0.06 + 0.08 * Math.sin(t * Math.PI)), 6, 18), { col: WAX, bone: b('head'), surf: FAM.hair, ink: false });
  for (const s of [-1, 1]) head.detail(torus(r * 0.11, r * 0.045, 6, 12), { col: WAX, bone: b('head'), pos: [s * r * 0.88, my + r * 0.34, mz - r * 0.46], rot: [0, s * 0.8, 0], surf: FAM.hair, ink: false });

  // ---- the leotard: spots per pixel, over the right shoulder, its neckline scooped clear of the left pectoral
  const leo = { col: LEO, surf: FAM.cloth, pat: { kind: 'dots', col: SPOT, a: 4.4, b: 0.46 } } as const;
  for (const t of torsoShapes(P, 0.6)) suit.add(t.s, { ...leo, bone: b(t.bone), k: 0.5 });
  for (const s of [1, -1]) suit.add({ t: 'ell', c: [s * 5.2, py, pz], r: [5.9, 4.5, 3.4], rot: [0, s * 0.2, 0] }, { ...leo, bone: b('chest'), k: 1.2 });
  suit.add({ t: 'ell', c: [0, P.waist - 1, 1.2], r: [P.waistW + 1.3, 9.4, P.waistW * P.depth + 2.2] }, { ...leo, bone: b('spine'), k: 1.6 });
  suit.add({ t: 'ell', c: [0, P.hip + 1.2, 0.3], r: [P.hipW + 1.0, 6.6, P.hipW * P.depth * 1.05 + 1.0] }, { ...leo, bone: b('hips'), k: 1.4 });
  suit.add({ t: 'ell', c: [P.shoulderX - 1, P.shoulderY + 5, 0], r: [17, 17, 40] }, { sub: true, k: 0.3 });

  // ---- a wide belt with a brass plate (the belly grown by a unit, cut to a band), wrapped wrists
  const by = P.waist - 4.2;
  gear.add({ t: 'ell', c: [0, P.waist - 1, 1.2], r: [P.waistW + 2.3, 10.4, P.waistW * P.depth + 3.2] }, { col: 0x3a2416, bone: b('spine'), k: 0.5, surf: FAM.leather });
  for (const s of [1, -1]) gear.add({ t: 'box', c: [0, by + s * 12.1, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.2 });
  const bz = frontZ(gear, 0, by);
  gear.detail(rbox(5.6, 3.8, 0.8, 0.5, 1), { col: 0xc4a258, bone: b('spine'), pos: [0, by, bz + 0.15], surf: FAM.brass, ink: false });
  gear.detail(rbox(3.4, 1.8, 0.5, 0.3, 1), { col: 0x7a5a2a, bone: b('spine'), pos: [0, by, bz + 0.5], surf: FAM.brass, ink: false });
  for (const [s, n] of SIDES) gear.add({ t: 'cap', a: foreAt(P, s, 0.6, 0.1), b: foreAt(P, s, 1.02, 0.1), ra: P.arm[2] + 0.95, rb: P.arm[2] + 0.75 }, { col: WRAP, bone: b(`fore${n}`), k: 0.4, surf: FAM.cloth, pat: { kind: 'bands', col: 0xb2a480, a: 1.3, b: 0.2 } });

  // ---- dark tights (their seat is under the leotard), laced boots to mid-shin
  for (const [s, n] of SIDES) {
    const { hp, kn, an } = legAt(P, s);
    tights.add({ t: 'cap', a: hp, b: kn, ra: P.leg[0] + 0.3, rb: P.leg[1] + 0.25 }, { col: TIGHTS, bone: b(`thigh${n}`), k: 2, surf: FAM.cloth });
    tights.add({ t: 'ell', c: [s * (P.stance + 0.6), P.knee + 9.5, 1.3], r: [P.leg[0] * 0.92, 7.4, P.leg[0] * 0.86] }, { col: TIGHTS, bone: b(`thigh${n}`), k: 1.6, surf: FAM.cloth });
    tights.add({ t: 'cap', a: kn, b: an, ra: P.leg[1] + 0.25, rb: P.leg[2] + 0.2 }, { col: TIGHTS, bone: b(`shin${n}`), k: 1, surf: FAM.cloth });
    boots.add({ t: 'cap', a: [kn[0], P.knee - 1.5, 0.4], b: [an[0], P.ankle + 0.6, 0.1], ra: P.leg[1] + 1.15, rb: P.leg[2] + 1.15 }, { col: BOOT, bone: b(`shin${n}`), k: 0.8, surf: FAM.leather });
    boots.add({ t: 'tor', c: [kn[0], P.knee - 1.7, 0.4], R: P.leg[1] + 1.2, r: 0.8 }, { col: 0x463020, bone: b(`shin${n}`), k: 0.2, surf: FAM.leather });
    styleShoe(boots, [an[0], P.ankle, 0], 9.6, BOOT, b(`foot${n}`), { width: 1.05 });
  }

  // ---- the carnival mallet, in the right hand: a turned haft, a red head banded in cream, iron rings
  const hx = -(P.shoulderX + P.armOut * 1.6), mh: V3 = [hx, P.wristY + 1.6, 19.2];
  gear.detail(cyl(0.85, 0.85, 28, 8), { col: 0x8a6c4a, bone: b('handR'), pos: [hx, P.wristY - 3, 6.4], rot: [Math.PI / 2 - 0.35, 0, 0], surf: FAM.wood });
  gear.detail(cyl(4.0, 4.0, 10.5, 18), { col: 0x8c2a24, bone: b('handR'), pos: mh, rot: [0, 0, Math.PI / 2], surf: SURF.paint });
  gear.detail(cyl(4.08, 4.08, 2.4, 18, true), { col: 0xd8caa6, bone: b('handR'), pos: mh, rot: [0, 0, Math.PI / 2], surf: SURF.paint });
  for (const s of [-1, 1]) gear.detail(torus(4.0, 0.42, 6, 18), { col: 0x5a5a60, bone: b('handR'), pos: [mh[0] + s * 4.6, mh[1], mh[2]], rot: [0, Math.PI / 2, 0], surf: FAM.iron });

  const gait: Gait = { ...REAL_WALK, stride: 0.42, knee: 0.7, bob: 1.5, sway: 0.08, twist: 0.06, squash: 0.03, arm: 0.24, elbow: 0.45, armOut: 0.32, headBob: 0.02 };
  const rig = new Rig(bones, clips(
    gait,
    // idle: rolls his shoulders, then a slow double-biceps flex
    (t) => {
      const f = pulse(t, 0.55, 0.2);
      return { armL: { rz: -1.2 * f, rx: -0.15 * f }, armR: { rz: 1.2 * f, rx: -0.15 * f }, foreL: { rx: -1.8 * f, rz: -0.4 * f }, foreR: { rx: -1.8 * f, rz: 0.4 * f }, chest: { sx: 1 + 0.04 * f, ry: 0.06 * sin(t, 2) * (1 - f) } };
    },
    // cast: mallet up overhead, slam down with his whole weight
    (t) => {
      const up = ease(t / 0.4) * (1 - ease((t - 0.42) / 0.1));
      const hit = ease((t - 0.42) / 0.1) * (1 - ease((t - 0.7) / 0.3));
      return { armR: { rx: -2.5 * up - 0.5 * hit }, foreR: { rx: -0.5 * up }, armL: { rx: -2.1 * up - 0.35 * hit }, chest: { rx: -0.28 * up + 0.42 * hit }, hips: { ty: -2.6 * hit, sy: 1 - 0.05 * hit } };
    },
  ));
  const geo = layered([
    { sc: head, o: LAYER.skin }, { sc: skin, o: LAYER.skin }, { sc: suit, o: LAYER.cloth }, { sc: gear, o: LAYER.cloth },
    { sc: tights, o: LAYER.cloth }, { sc: boots, o: LAYER.hard },
  ]);
  return { geo, rig };
}

// ---------------------------------------------------------------- The Fortune Teller
/**
 * D-87: a slim figure in a long violet velvet skirt with fluted folds and a gold hem; a black bodice laced
 * in gold over a cream blouse with puffed sleeves; a wine shawl with a fringe of coins; a fitted red
 * headscarf with a rolled hem, knotted at the nape over a dark braid, coins across the brow, hoops;
 * kohl-dark eyes and a knowing half-smile. The crystal ball glows violet between her hands.
 */
function fortuneTeller(): SculptModel {
  const P: Proportions = { ...scaleP(HERO, 0.97), shoulderX: 8.6, chestW: 7.9, waistW: 5.9, hipW: 8.0, headR: 7.3, arm: [2.15, 1.8, 1.42], depth: 0.68, neck: 72.4, headY: 79 };
  const ballAt: V3 = [0, P.chest - 6, 9.4];
  const bones = humanBones(P, [
    { name: 'skirt', parent: 'hips', head: [0, P.hip, 0] },
    { name: 'ball', parent: 'chest', head: ballAt },
  ]);
  const b = B(bones);
  const skin = new Sculpt(0.48, 3, 0.45), hair = new Sculpt(0.55, 3, 0.45), scarf = new Sculpt(0.55, 3, 0.45), blouse = new Sculpt(0.72, 3, 0.45);
  const bodice = new Sculpt(0.62, 3, 0.45), wrap = new Sculpt(0.62, 3, 0.45), skirt = new Sculpt(0.88, 3, 0.45);
  const SKIN = 0xcfa482, HAIR = 0x1c1418, SCARF = 0x8e2a24, BLOUSE = 0xd8ccb0, SHAWL = 0x5c1e2c, GOLD = 0xb48e4a;
  const r = P.headR, hy = P.headY;

  // ---- skin: the head, a slender neck, forearms bare from the puffed sleeves, gold bangles
  styleHead(skin, P, b('head'), SKIN, { jaw: 0.86, chin: 0.82, nose: 0.95, brow: 0.9 });
  skin.add({ t: 'cap', a: [0, P.neck - 3.6, -0.5], b: [0, P.neck + 3, 0.3], ra: r * 0.36, rb: r * 0.33 }, { col: SKIN, bone: b('neck'), k: 1.2, surf: FAM.skin });
  for (const [s, n] of SIDES) {
    skin.add(armForms(P, s).fore, { col: SKIN, bone: b(`fore${n}`), k: 0.8, surf: FAM.skin });
    styleHand(skin, wristAt(P, s), s, P.arm[2], SKIN, b(`hand${n}`));
    for (let i = 0; i < 3; i++) skin.detail(torus(P.arm[2] + 0.45, 0.24, 5, 14), { col: GOLD, bone: b(`fore${n}`), pos: foreAt(P, s, 0.8 + i * 0.07), rot: [Math.PI / 2, 0, 0], surf: FAM.gold, ink: false });
  }
  // heavy-lidded, kohl-dark eyes and a knowing half-smile
  styleFace(skin, P, b('head'), { iris: 0x3a2050, lid: 0x140a10, browTilt: -0.08, browW: 0.92, mouth: 0x7a2026, smirk: 0.5, smile: 0.1, size: 0.2 });

  // ---- the blouse: only its front shows, in the shawl's V (no ink); sleeves puffed and gathered at the elbow
  for (const t of torsoShapes(P).filter((t) => t.s.t === 'box')) blouse.add(t.s, { col: BLOUSE, bone: b(t.bone), k: t.k, surf: FAM.cloth, ink: false });
  for (const [s, n] of SIDES) {
    const el = elbowAt(P, s);
    blouse.add({ t: 'ell', c: [s * (P.shoulderX + 0.6), P.shoulderY - 4.2, 0.2], r: [3.1, 4.6, 3.1], rot: [0, 0, s * 0.12] }, { col: BLOUSE, bone: b(`arm${n}`), k: 1.4, surf: FAM.cloth });
    blouse.add(armForms(P, s, 0.4).upper, { col: BLOUSE, bone: b(`arm${n}`), k: 1.4, surf: FAM.cloth });
    blouse.add({ t: 'tor', c: [el[0], el[1] + 0.5, el[2]], R: P.arm[1] + 0.5, r: 0.7 }, { col: BLOUSE, bone: b(`arm${n}`), k: 0.3, surf: FAM.cloth });
  }

  // ---- the bodice, black velvet laced in gold, cut straight under the bust
  bodice.add({ t: 'cap', a: [0, P.waist - 3.5, 0.25], b: [0, P.chest - 1.5, 0.25], ra: P.waistW + 0.7, rb: P.chestW * 0.9 + 0.5, sz: P.depth + 0.04 }, { col: 0x1e1420, bone: b('spine'), k: 0.5, surf: SURF.velvet });
  bodice.add({ t: 'box', c: [0, P.chest + 9.5, 0], h: [20, 10, 20], r: 0.1 }, { sub: true, k: 0.2 });
  for (let i = 0; i < 4; i++) {
    const ly = P.waist - 2 + i * 2.4, lz = frontZ(bodice, 0, ly) + 0.08;
    for (const s of [-1, 1]) bodice.detail(rbox(2.6, 0.32, 0.3, 0.12, 1), { col: GOLD, bone: b('spine'), pos: [0, ly, lz], rot: [0, 0, s * 0.5], surf: FAM.gold, ink: false });
  }

  // ---- the shawl over the shoulders (on the arms where it drapes them), open in a V, a fringe of coins
  for (const t of torsoShapes(P, 1.1).filter((t) => t.bone === 'chest')) wrap.add(t.s, { col: SHAWL, bone: b('chest'), k: 0.6, surf: FAM.wool });
  for (const [s, n] of SIDES) wrap.add(armForms(P, s, 1.0).delt, { col: SHAWL, bone: b(`arm${n}`), k: 0.8, surf: FAM.wool });
  const edgeY = P.chest + 1;
  wrap.add({ t: 'box', c: [0, edgeY - 10, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.25 });
  const vz = frontZ(wrap, 0, P.chest + 4);
  wrap.add({ t: 'cap', a: [0, P.chest + 12, vz + 1], b: [0, edgeY + 0.5, vz - 0.6], ra: 3.4, rb: 0.8 }, { sub: true, k: 0.3 });
  for (let i = 0; i < 22; i++) {
    const a = -Math.PI + (i + 0.5) * (Math.PI * 2 / 22);
    if (Math.abs(a) < 0.42 || (Math.abs(a) > 1.2 && Math.abs(a) < 1.95)) continue;
    const p = surfaceAt(wrap, [0, edgeY + 0.6, 0.2], [Math.sin(a), 0, Math.cos(a)]);
    wrap.detail(cyl(0.62, 0.62, 0.18, 10), { col: GOLD, bone: b('chest'), pos: [p[0] + Math.sin(a) * 0.3, edgeY - 0.3, p[2] + Math.cos(a) * 0.3], rot: [Math.PI / 2, 0, -a], surf: FAM.gold, ink: false });
  }

  // ---- the skirt, swaying on its own bone: a velvet bell, lit from above, with fluted folds, a rolled hem, gold
  const velvet = vertical(0x1e1226, 0x3a2448, 6, P.hip);
  skirt.add({ t: 'cap', a: [0, P.hip + 3, 0], b: [0, 5, 0], ra: P.hipW + 0.6, rb: 13.4 }, { col: velvet, bone: b('skirt'), k: 2, surf: SURF.velvet });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.35;
    skirt.add({ t: 'cap', a: [Math.sin(a) * (P.hipW - 0.4), P.hip - 1, Math.cos(a) * (P.hipW - 0.4) * 0.9], b: [Math.sin(a) * 12.6, 4.5, Math.cos(a) * 12.6], ra: 1.4, rb: 2.6 }, { col: velvet, bone: b('skirt'), k: 2, surf: SURF.velvet });
  }
  skirt.add({ t: 'tor', c: [0, 3.6, 0], R: 12.6, r: 2.3 }, { col: velvet, bone: b('skirt'), k: 1.2, surf: SURF.velvet });
  skirt.add({ t: 'tor', c: [0, 1.6, 0], R: 13.8, r: 1.0 }, { col: GOLD, bone: b('skirt'), k: 0.3, surf: FAM.gold });
  skirt.add({ t: 'box', c: [0, -9, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.2 });

  // ---- hair: dark, framing the face (under the scarf it draws no ink); a braid down her back
  styleHair(hair, P, b('head'), HAIR, { volume: 0.96, sideburns: false, back: 1.1, ink: false });
  for (const s of [1, -1]) hair.add({ t: 'cap', a: [s * r * 0.8, hy + r * 0.35, r * 0.25], b: [s * r * 0.86, hy - r * 0.45, r * 0.12], ra: r * 0.2, rb: r * 0.13 }, { col: HAIR, bone: b('head'), k: 0.5, surf: FAM.hair, ink: false });
  const braid0: V3 = [0, hy - r * 0.58, -r * 0.86], braid1: V3 = [0.4, P.chest + 2, -6.3];
  for (let i = 0; i < 6; i++) {
    const u = i / 5, s = i % 2 ? 1 : -1;
    const c: V3 = [braid0[0] + (braid1[0] - braid0[0]) * u + s * 0.45, braid0[1] + (braid1[1] - braid0[1]) * u, braid0[2] + (braid1[2] - braid0[2]) * u];
    hair.add({ t: 'ell', c, r: [1.25, 1.6, 1.0], rot: [0, 0, s * 0.5] }, { col: HAIR, bone: b(i < 2 ? 'neck' : 'chest'), k: 0.3, surf: FAM.hair });
  }
  hair.detail(torus(0.9, 0.3, 5, 12), { col: GOLD, bone: b('chest'), pos: [braid1[0], braid1[1] - 1.6, braid1[2]], rot: [Math.PI / 2, 0, 0], surf: FAM.gold, ink: false });
  // ---- the red headscarf: fitted over the hair, its edge cut on a slant from the hairline to the nape and
  // rolled, knotted at the nape; coins along the hem across the brow
  const tilt = -0.4, edge: V3 = [0, hy + r * 0.08, -r * 0.05], up: V3 = [0, Math.cos(tilt), Math.sin(tilt)];
  scarf.add({ t: 'ell', c: [0, hy + r * 0.2, -r * 0.12], r: [r * 1.05, r * 1.02, r * 1.1] }, { col: SCARF, bone: b('head'), k: 0.3, surf: FAM.cloth });
  scarf.add({ t: 'box', c: [edge[0] - up[0] * r * 1.5, edge[1] - up[1] * r * 1.5, edge[2] - up[2] * r * 1.5], h: [r * 2, r * 1.5, r * 2], r: 0.1, rot: [tilt, 0, 0] }, { sub: true, k: 0.2 });
  scarf.add({ t: 'tor', c: edge, R: r * 1.05, r: r * 0.12, rot: [tilt, 0, 0] }, { col: 0x701e1a, bone: b('head'), k: 0.3, surf: FAM.cloth });
  const nape: V3 = [0, hy - r * 0.34, -r * 1.06];
  for (const s of [1, -1]) {
    scarf.add({ t: 'ell', c: [s * r * 0.3, nape[1], nape[2]], r: [r * 0.34, r * 0.22, r * 0.2], rot: [0, 0, s * 0.4] }, { col: SCARF, bone: b('head'), k: 0.3, surf: FAM.cloth });
    scarf.add({ t: 'cap', a: [s * r * 0.18, nape[1] - 0.8, nape[2] - 0.2], b: [s * r * 0.5, P.neck - 1.5, nape[2] - 0.6], ra: r * 0.13, rb: r * 0.09 }, { col: SCARF, bone: b('head'), k: 0.3, surf: FAM.cloth });
  }
  scarf.add({ t: 'sph', c: [0, nape[1], nape[2] - 0.2], r: r * 0.16 }, { col: SCARF, bone: b('head'), k: 0.3, surf: FAM.cloth });
  for (let i = 0; i < 9; i++) {
    const a = -1.0 + i * 0.25, R = r * 1.15 + 0.1;
    const pos: V3 = [edge[0] + Math.sin(a) * R, edge[1] - Math.cos(a) * R * Math.sin(tilt) - 0.35, edge[2] + Math.cos(a) * R * Math.cos(tilt)];
    scarf.detail(cyl(0.8, 0.8, 0.22, 10), { col: GOLD, bone: b('head'), pos, rot: [Math.PI / 2, 0, -a], surf: FAM.gold, ink: false });
  }
  for (const s of [-1, 1]) hair.detail(torus(1.4, 0.22, 6, 14), { col: GOLD, bone: b('head'), pos: [s * r * 0.95, hy - r * 0.48, -r * 0.02], rot: [0, Math.PI / 2, 0], surf: FAM.gold, ink: false });

  // ---- the crystal ball
  skirt.detail(sphere(3.9, 20, 16), { col: PAL.violet, bone: b('ball'), pos: ballAt, emit: 0.5, surf: SURF.glass });
  skirt.detail(sphere(1.6, 12, 10), { col: 0xe9dcff, bone: b('ball'), pos: [ballAt[0], ballAt[1] + 0.4, ballAt[2] + 0.3], emit: 1, surf: SURF.glass, ink: false });

  const hold: Pose = { armL: { rx: -0.9, rz: 0.2 }, armR: { rx: -0.9, rz: -0.2 }, foreL: { rx: -1.0, rz: 0.35 }, foreR: { rx: -1.0, rz: -0.35 } };
  const gait: Gait = { ...REAL_WALK, stride: 0.3, knee: 0.45, bob: 0.7, sway: 0.03, twist: 0.04, squash: 0.01, arm: 0, elbow: 0, headBob: 0.01 };
  const rig = new Rig(bones, clips(
    gait,
    (t) => mix(hold, { ball: { ty: 0.9 * sin(t, 2), ry: t * Math.PI * 4 }, foreL: { rz: 0.15 * sin(t, 2) }, foreR: { rz: -0.15 * sin(t, 2, 0.5) }, head: { rz: 0.1 * sin(t), rx: 0.1 }, skirt: { rz: 0.015 * sin(t) } }),
    (t) => {
      const k = Math.sin(Math.min(1, t * 1.2) * Math.PI);
      return mix(hold, { armL: { rx: -1.2 * k }, armR: { rx: -1.2 * k }, ball: { ty: 9 * k, tz: 1.5 * k, sx: 1 + 0.15 * k, sy: 1 + 0.15 * k, sz: 1 + 0.15 * k }, chest: { rx: -0.12 * k }, head: { rx: -0.25 * k } });
    },
    (t) => mix(hold, { skirt: { rz: 0.05 * sin(t), rx: -0.03 * cos(t, 2) }, ball: { ty: 0.5 * sin(t, 2) } }),
  ));
  const geo = layered([
    { sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: scarf, o: LAYER.cloth }, { sc: blouse, o: LAYER.cloth },
    { sc: bodice, o: LAYER.cloth }, { sc: wrap, o: LAYER.cloth }, { sc: skirt, o: LAYER.cloth },
  ]);
  return { geo, rig };
}

// ---------------------------------------------------------------- The Commodore (D-78: the Ride Operator's place)
/**
 * D-87: a portly old captain in a white double-breasted coat to mid-thigh — navy shoulder boards, gold
 * buttons, gold rings on the cuffs, a medal on a blue ribbon — with the sea's green rising from every hem
 * (he's the man it gave back); a navy tie; white whiskers, mutton chops into a walrus moustache, under a
 * white-topped cap with a glossy peak, tipped back so his face shows. The silver-topped cane reaches the
 * boards.
 */
function commodore(): SculptModel {
  const P: Proportions = { ...HERO, shoulderX: 10.2, chestW: 10.0, waistW: 9.8, hipW: 8.8, arm: [2.75, 2.2, 1.75], leg: [3.9, 2.85, 2.1], stance: 5.0 };
  const bones = humanBones(P);
  const b = B(bones);
  const skin = new Sculpt(0.48, 3, 0.45), hair = new Sculpt(0.55, 3, 0.45), shirt = new Sculpt(0.8, 3, 0.45), coat = new Sculpt(0.74, 3, 0.45);
  const legs = new Sculpt(0.76, 3, 0.45), shoes = new Sculpt(0.6, 3, 0.45);
  const SKIN = 0xd2bea6, WHITE = 0xece8de, SHIRT = 0xeeeae0, NAVY = 0x1a2440, GOLD = 0xc4a050;
  // white linen, the sea's green rising from each hem: the coat's, the cuffs', the trousers'
  const coatC = vertical(0xa2ae94, 0xe8e2ce, P.hip - 9, P.waist + 2), sleeveC = vertical(0xb4bea4, 0xe8e2ce, P.wristY, P.elbowY + 2), trouC = vertical(0x96a48a, 0xe2dcc8, P.ankle, P.knee + 4);
  const r = P.headR, hy = P.headY;

  // ---- skin: a heavy old face, the neck, the hands
  styleHead(skin, P, b('head'), SKIN, { jaw: 1.1, chin: 1.08, nose: 1.22, brow: 1.1 });
  skin.add({ t: 'cap', a: [0, P.neck - 3.6, -0.5], b: [0, P.neck + 3, 0.3], ra: r * 0.46, rb: r * 0.42 }, { col: SKIN, bone: b('neck'), k: 1.2, surf: FAM.skin });
  for (const [s, n] of SIDES) styleHand(skin, wristAt(P, s), s, P.arm[2], SKIN, b(`hand${n}`));
  // sea-green eyes under thick white brows, a steady look
  styleFace(skin, P, b('head'), { iris: 0x2a6a5a, brow: 0xe6e2d8, browW: 1.15, browTilt: -0.04, size: 0.18, smile: 0.05 });

  // ---- hair: white at the temples and the back, mutton chops into a walrus moustache
  styleHair(hair, P, b('head'), WHITE, { volume: 0.98, sideburns: false });
  for (const s of [1, -1]) hair.add({ t: 'ell', c: [s * r * 0.76, hy - r * 0.36, r * 0.34], r: [r * 0.17, r * 0.44, r * 0.36], rot: [0, s * 0.3, s * 0.12] }, { col: WHITE, bone: b('head'), k: 0.6, surf: FAM.hair });
  const my = hy - r * 0.42, mz = frontZ(skin, 0, my);
  for (const s of [1, -1]) hair.add({ t: 'cap', a: [s * r * 0.05, my + r * 0.04, mz + 0.2], b: [s * r * 0.5, my - r * 0.12, mz - r * 0.24], ra: r * 0.15, rb: r * 0.12 }, { col: WHITE, bone: b('head'), k: 0.5, surf: FAM.hair });
  // the commodore's cap, tipped back off the brow: a black band, a broad white crown, a glossy peak, a badge
  const cap = hatFrame([0, hy + r * 0.84, -r * 0.08], -0.22);
  hair.detail(cap(cyl(r * 0.98, r * 1.0, r * 0.34, 32), [0, -r * 0.12, 0]), { col: 0x15181c, bone: b('head'), surf: FAM.cloth });
  hair.detail(cap(ellipsoid(r * 1.24, r * 0.36, r * 1.26, 28, 10), [0, r * 0.2, -r * 0.02]), { col: 0xf2efe6, bone: b('head'), surf: FAM.cloth });
  hair.detail(cap(ellipsoid(r * 0.82, r * 0.075, r * 0.46, 18, 6), [0, -r * 0.24, r * 1.0], 0.24), { col: 0x0a0c0e, bone: b('head'), surf: FAM.latex });
  hair.detail(cap(rbox(r * 0.3, r * 0.22, 0.4, 0.15, 1), [0, -r * 0.08, r * 1.0]), { col: GOLD, bone: b('head'), emit: 0.3, surf: FAM.gold, ink: false });

  // ---- the shirt (no ink: the coat covers it), its collar, and the navy tie down the V
  for (const t of torsoShapes(P).filter((t) => t.bone === 'chest')) shirt.add(t.s, { col: SHIRT, bone: b(t.bone), k: t.k, surf: FAM.cloth, ink: false });
  shirt.add({ t: 'tor', c: [0, P.neck - 2.4, 0.2], R: r * 0.46, r: 0.85 }, { col: SHIRT, bone: b('chest'), k: 0.3, surf: FAM.cloth });
  const tz = frontZ(shirt, 0, P.neck - 3);
  shirt.add({ t: 'cap', a: [0, P.neck - 3.2, tz + 0.2], b: [0, P.chest - 0.6, frontZ(shirt, 0, P.chest - 0.6) + 0.25], ra: 0.8, rb: 1.15 }, { col: NAVY, bone: b('chest'), k: 0.2, surf: FAM.cloth, ink: false });
  shirt.add({ t: 'ell', c: [0, P.neck - 2.9, tz + 0.5], r: [0.95, 0.8, 0.65] }, { col: NAVY, bone: b('chest'), k: 0.2, surf: FAM.cloth, ink: false });
  for (const s of [-1, 1]) shirt.detail(rbox(2.2, 0.5, 1.6, 0.2, 1), { col: 0xf4f0e6, bone: b('chest'), pos: [s * 1.7, P.neck - 1.9, frontZ(shirt, s * 1.7, P.neck - 1.9) + 0.1], rot: [0.5, 0, s * 0.5], surf: FAM.cloth, ink: false });

  // ---- the coat: double-breasted over a round middle, to mid-thigh, open in a V, split at the front of the skirt
  for (const t of torsoShapes(P, 0.8)) coat.add(t.s, { col: coatC, bone: b(t.bone), k: 0.6, surf: FAM.cloth });
  coat.add({ t: 'ell', c: [0, P.waist + 1, 1.0], r: [P.waistW + 1.0, 8.6, P.waistW * P.depth + 1.8] }, { col: coatC, bone: b('spine'), k: 1.6, surf: FAM.cloth });
  coat.add({ t: 'cap', a: [0, P.hip + 5, 0.4], b: [0, P.hip - 9, 0.2], ra: P.hipW + 1.6, rb: P.hipW + 2.8, sz: P.depth + 0.2 }, { col: coatC, bone: b('hips'), k: 1.4, surf: FAM.cloth });
  for (const [s, n] of SIDES) {
    const f = armForms(P, s, 0.55);
    coat.add(f.delt, { col: coatC, bone: b(`arm${n}`), k: 1.6, surf: FAM.cloth });
    coat.add(f.upper, { col: coatC, bone: b(`arm${n}`), k: 1.1, surf: FAM.cloth });
    coat.add(f.fore, { col: sleeveC, bone: b(`fore${n}`), k: 0.8, surf: FAM.cloth });
    coat.add({ t: 'tor', c: foreAt(P, s, 0.94), R: P.arm[2] + 0.8, r: 0.7 }, { col: sleeveC, bone: b(`fore${n}`), k: 0.3, surf: FAM.cloth });
    // a commodore's two gold rings on each cuff
    for (const u of [0.78, 0.85]) coat.detail(torus(P.arm[1] + 0.55 + (P.arm[2] - P.arm[1]) * u + 0.05, 0.2, 5, 16), { col: GOLD, bone: b(`fore${n}`), pos: foreAt(P, s, u), rot: [Math.PI / 2, 0, 0], surf: FAM.gold, ink: false });
  }
  const vTop = P.shoulderY + 1.2, vBot = P.chest - 1;
  const zT = frontZ(coat, 0, vTop - 2), zB = frontZ(coat, 0, vBot);
  for (const s of [1, -1]) {
    const lx = s * 3.7, lx2 = s * 0.6;
    coat.add({ t: 'cap', a: [lx, vTop - 0.6, frontZ(coat, lx, vTop - 0.6) - 0.3], b: [lx2, vBot + 0.3, frontZ(coat, lx2, vBot + 0.3) - 0.2], ra: 0.8, rb: 0.5 }, { col: coatC, bone: b('chest'), k: 0.25, surf: FAM.cloth });
  }
  coat.add({ t: 'cap', a: [0, vTop + 0.6, zT - 0.5], b: [0, vBot, zB - 1.3], ra: 3.4, rb: 1.3 }, { sub: true, k: 0.2 });
  coat.add({ t: 'box', c: [0, P.hip - 19, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.2 });
  const fz = frontZ(coat, 0, P.hip - 5);
  coat.add({ t: 'box', c: [0, P.hip - 6, fz - 1], h: [1.4, 5.5, 6], r: 0.3, tx: -0.8 }, { sub: true, k: 0.3 });
  for (let i = 0; i < 3; i++) for (const s of [1, -1]) {
    const bx = s * 2.9, by = P.waist + 5.5 - i * 4.4;
    coat.detail(sphere(0.62, 8, 6), { col: GOLD, bone: b('spine'), pos: [bx, by, frontZ(coat, bx, by) + 0.1], surf: FAM.gold, ink: false });
  }
  // navy shoulder boards striped in gold, and a medal on a blue ribbon over the heart
  for (const s of [1, -1]) {
    const sx = s * (P.shoulderX - 3.1), top = surfaceAt(coat, [sx, P.shoulderY, -0.6], [0, 1, 0]);
    coat.detail(rbox(6.4, 0.6, 3.0, 0.25, 1), { col: NAVY, bone: b('chest'), pos: [sx, top[1] + 0.12, -0.6], rot: [0, 0, -s * 0.14], surf: FAM.cloth, ink: false });
    coat.detail(rbox(5.4, 0.2, 0.55, 0.08, 1), { col: GOLD, bone: b('chest'), pos: [sx, top[1] + 0.46, -0.6], rot: [0, 0, -s * 0.14], surf: FAM.gold, ink: false });
  }
  const mx = 5.2, mY = P.chest + 2.4;
  coat.detail(rbox(1.8, 2.6, 0.4, 0.2, 1), { col: 0x2a4a8a, bone: b('chest'), pos: [mx, mY, frontZ(coat, mx, mY) + 0.12], surf: FAM.cloth, ink: false });
  coat.detail(cyl(1.25, 1.25, 0.4, 14), { col: GOLD, bone: b('chest'), pos: [mx, mY - 2.6, frontZ(coat, mx, mY - 2.6) + 0.3], rot: [Math.PI / 2, 0, 0], emit: 0.25, surf: FAM.gold, ink: false });

  // ---- trousers, cuffed (no ink under the coat; their seat isn't sculpted), and black shoes
  for (const [s, n] of SIDES) {
    const { hp, kn, an } = legAt(P, s);
    const mid: V3 = [(hp[0] + kn[0]) / 2, P.hip - 8.5, 0.25];
    legs.add({ t: 'cap', a: hp, b: mid, ra: P.leg[0] + 0.7, rb: P.leg[0] + 0.55 }, { col: trouC, bone: b(`thigh${n}`), k: 1.6, surf: FAM.cloth, ink: false });
    legs.add({ t: 'cap', a: mid, b: kn, ra: P.leg[0] + 0.55, rb: P.leg[1] + 0.6 }, { col: trouC, bone: b(`thigh${n}`), k: 1.6, surf: FAM.cloth });
    legs.add({ t: 'cap', a: kn, b: an, ra: P.leg[1] + 0.6, rb: P.leg[2] + 0.85 }, { col: trouC, bone: b(`shin${n}`), k: 1, surf: FAM.cloth });
    legs.add({ t: 'tor', c: [an[0], an[1] + 1.1, an[2]], R: P.leg[2] + 1.0, r: 0.95 }, { col: trouC, bone: b(`shin${n}`), k: 0.3, surf: FAM.cloth });
    styleShoe(shoes, [an[0], P.ankle, 0], 8.6, 0x1a1612, b(`foot${n}`));
  }

  // ---- the silver-topped cane, in the right hand, to the boards
  const hx = -(P.shoulderX + P.armOut * 1.6) - 0.5;
  coat.detail(cyl(0.55, 0.5, P.wristY - 1, 8), { col: 0x3a2418, bone: b('handR'), pos: [hx, (P.wristY - 1) / 2 - 1.5, 3], surf: FAM.wood });
  coat.detail(sphere(1.55, 12, 10), { col: 0xc8d0d8, bone: b('handR'), pos: [hx, P.wristY - 1.2, 3], surf: [0.3, 0.85] });

  const gait: Gait = { ...REAL_WALK, stride: 0.55, knee: 0.8, bob: 1.2, lean: 0.02, sway: 0.03, twist: 0.08, arm: 0.4, elbow: 0.3 };
  const rig = new Rig(bones, clips(
    gait,
    // weight on the cane, a slow look over his boards, now and then a touch to the cap's peak
    (t) => mix({ head: { ry: 0.18 * sin(t, 0.5), rx: -0.05 }, chest: { rx: -0.04 } }, { armL: { rx: -2.4 * pulse(t, 0.9, 0.12), rz: 0.2 * pulse(t, 0.9, 0.12) }, foreL: { rx: -1.4 * pulse(t, 0.9, 0.12) } }),
    (t) => {
      // the cast: he points his cane down the track
      const k = Math.sin(Math.min(1, t * 1.4) * Math.PI);
      return { armR: { rx: -1.5 * k, rz: 0.15 * k }, foreR: { rx: -0.2 * k }, chest: { ry: -0.25 * k }, head: { rx: -0.1 * k } };
    },
  ));
  const geo = layered([
    { sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: shirt, o: LAYER.cloth }, { sc: coat, o: LAYER.cloth },
    { sc: legs, o: LAYER.cloth }, { sc: shoes, o: LAYER.hard },
  ]);
  return { geo, rig };
}

// ---------------------------------------------------------------- Mira (D-78)
/**
 * D-87: a girl of twelve or so with a dancer's build and a child's larger head — dark hair drawn into a bun
 * with a lilac bow, wide grey-blue eyes; a pale blue dress with a round white collar, puffed sleeves, a
 * lilac sash bowed at the back, and a skirt that flares to a crisp hem above the knee edged in glowing
 * glass (it hung below her knees as a bulb); white tights, pink slippers. Her cracked hand mirror is in
 * her left hand.
 */
function mira(): SculptModel {
  const P: Proportions = {
    hip: 34.5, knee: 19.2, ankle: 3.1, stance: 3.5, waist: 41.4, chest: 49.2, shoulderY: 55.6, shoulderX: 7.0, elbowY: 44.2, wristY: 34.8, armOut: 1.1,
    neck: 58.0, headY: 64.4, headR: 6.8, leg: [2.8, 2.1, 1.55], arm: [1.8, 1.5, 1.2], hipW: 5.9, waistW: 4.9, chestW: 6.5, depth: 0.74,
  };
  const bones = humanBones(P, [{ name: 'skirt', parent: 'hips', head: [0, P.hip + 2, 0] }]);
  const b = B(bones);
  const skin = new Sculpt(0.45, 3, 0.45), hair = new Sculpt(0.5, 3, 0.45), dress = new Sculpt(0.6, 3, 0.45), sash = new Sculpt(0.5, 3, 0.45), legs = new Sculpt(0.62, 3, 0.45);
  const SKIN = 0xecd6c6, HAIR = 0x2a1a20, DRESS = 0x86c0d0, LILAC = 0xcbbcf8, TIGHTS = 0xece6e0;
  const r = P.headR, hy = P.headY;

  // ---- skin: the head, the neck, forearms bare below the sleeves, hands
  styleHead(skin, P, b('head'), SKIN, { jaw: 0.8, chin: 0.75, nose: 0.72, brow: 0.8, ears: 0.9 });
  skin.add({ t: 'cap', a: [0, P.neck - 3, -0.4], b: [0, P.neck + 2.6, 0.2], ra: r * 0.33, rb: r * 0.3 }, { col: SKIN, bone: b('neck'), k: 1, surf: FAM.skin });
  for (const [s, n] of SIDES) {
    skin.add(armForms(P, s).fore, { col: SKIN, bone: b(`fore${n}`), k: 0.8, surf: FAM.skin });
    styleHand(skin, wristAt(P, s), s, P.arm[2], SKIN, b(`hand${n}`));
  }
  // wide grey-blue eyes, the brows a little wistful
  styleFace(skin, P, b('head'), { iris: 0x3a6a7a, size: 0.23, spread: 0.35, browTilt: 0.2, browW: 0.85, brow: HAIR, mouth: 0x9a4a4e, smile: 0.02 });

  // ---- hair: drawn back into a dancer's bun, a short fringe, a lilac bow on the bun
  styleHair(hair, P, b('head'), HAIR, {
    volume: 1.02, sideburns: false, back: 0.9,
    fringe: [
      [[-r * 0.1, hy + r * 0.86, r * 0.5], [-r * 0.42, hy + r * 0.5, r * 0.9]],
      [[r * 0.2, hy + r * 0.86, r * 0.5], [r * 0.05, hy + r * 0.5, r * 0.94]],
      [[r * 0.5, hy + r * 0.78, r * 0.44], [r * 0.48, hy + r * 0.46, r * 0.86]],
    ],
  });
  const bun: V3 = [0, hy + r * 0.6, -r * 0.95];
  hair.add({ t: 'sph', c: bun, r: r * 0.46 }, { col: HAIR, bone: b('head'), k: 0.6, surf: FAM.hair });
  for (const s of [1, -1]) hair.add({ t: 'ell', c: [s * r * 0.3, bun[1] + r * 0.36, bun[2] + r * 0.12], r: [r * 0.26, r * 0.15, r * 0.1], rot: [0, 0, s * 0.45] }, { col: LILAC, bone: b('head'), k: 0.25, surf: FAM.cloth });
  hair.add({ t: 'sph', c: [0, bun[1] + r * 0.36, bun[2] + r * 0.14], r: r * 0.1 }, { col: LILAC, bone: b('head'), k: 0.2, surf: FAM.cloth });

  // ---- the dress: a fitted bodice with a round white collar, sleeves puffed at the shoulder and gathered above the elbow
  for (const t of torsoShapes(P, 0.25)) dress.add(t.s, { col: DRESS, bone: b(t.bone), k: t.k, surf: FAM.cloth });
  for (const s of [1, -1]) dress.add({ t: 'ell', c: [s * 1.7, P.neck - 2.2, frontZ(dress, s * 1.7, P.neck - 2.2) - 0.3], r: [1.9, 1.1, 0.7], rot: [0.5, 0, s * 0.35] }, { col: 0xeef2f2, bone: b('chest'), k: 0.2, surf: FAM.cloth });
  for (const [s, n] of SIDES) {
    const el = elbowAt(P, s);
    dress.add({ t: 'ell', c: [s * (P.shoulderX + 0.5), P.shoulderY - 2.4, 0.1], r: [2.6, 2.9, 2.6] }, { col: DRESS, bone: b(`arm${n}`), k: 0.8, surf: FAM.cloth });
    dress.add(armForms(P, s, 0.3).upper, { col: DRESS, bone: b(`arm${n}`), k: 1, surf: FAM.cloth });
    dress.add({ t: 'tor', c: [el[0], el[1] + 1.2, el[2]], R: P.arm[1] + 0.45, r: 0.6 }, { col: DRESS, bone: b(`arm${n}`), k: 0.25, surf: FAM.cloth });
  }
  // the skirt, on its own bone: flared to a crisp, rolled hem just above the knee
  const hemY = P.knee + 4.6;
  dress.add({ t: 'cap', a: [0, P.waist + 1, 0.2], b: [0, hemY + 1, 0.2], ra: P.waistW + 0.5, rb: 10.6 }, { col: DRESS, bone: b('skirt'), k: 1.2, surf: FAM.cloth });
  dress.add({ t: 'tor', c: [0, hemY + 0.8, 0.2], R: 10.2, r: 1.1 }, { col: DRESS, bone: b('skirt'), k: 0.8, surf: FAM.cloth });
  dress.add({ t: 'box', c: [0, hemY - 10, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.2 });

  // ---- the lilac sash (the waist grown, cut to a band), bowed at the back, its tails on the skirt
  sash.add(torsoShapes(P, 0.85)[0].s, { col: LILAC, bone: b('spine'), k: 0.3, surf: FAM.cloth });
  for (const s of [1, -1]) sash.add({ t: 'box', c: [0, P.waist + 0.6 + s * 11.2, 0], h: [20, 10, 20], r: 0.1 }, { sub: true, k: 0.2 });
  const back = surfaceAt(sash, [0, P.waist + 0.6, 0.25], [0, 0, -1]);
  for (const s of [1, -1]) {
    sash.add({ t: 'ell', c: [s * 1.6, back[1] + 0.2, back[2] - 0.5], r: [1.8, 1.15, 0.7], rot: [0, s * 0.3, s * 0.35] }, { col: LILAC, bone: b('spine'), k: 0.25, surf: FAM.cloth });
    sash.add({ t: 'cap', a: [s * 0.5, back[1] - 0.6, back[2] - 0.6], b: [s * 1.6, P.waist - 7, -8.2], ra: 0.75, rb: 0.6 }, { col: LILAC, bone: b('skirt'), k: 0.25, surf: FAM.cloth });
  }
  sash.add({ t: 'sph', c: [0, back[1], back[2] - 0.6], r: 0.8 }, { col: LILAC, bone: b('spine'), k: 0.2, surf: FAM.cloth });

  // ---- white tights (no ink under the skirt), pink slippers; the hem's glass edge
  legs.add({ t: 'ell', c: [0, P.hip + 1.2, 0], r: [P.hipW, 5, P.hipW * P.depth * 1.05] }, { col: TIGHTS, bone: b('hips'), k: 1.2, surf: FAM.cloth, ink: false });
  for (const [s, n] of SIDES) {
    const { hp, kn, an } = legAt(P, s);
    const mid: V3 = [(hp[0] + kn[0]) / 2, hemY + 3.5, 0.25];
    legs.add({ t: 'cap', a: hp, b: mid, ra: P.leg[0], rb: P.leg[0] * 0.9 }, { col: TIGHTS, bone: b(`thigh${n}`), k: 1.6, surf: FAM.cloth, ink: false });
    legs.add({ t: 'cap', a: mid, b: kn, ra: P.leg[0] * 0.9, rb: P.leg[1] }, { col: TIGHTS, bone: b(`thigh${n}`), k: 1.6, surf: FAM.cloth });
    legs.add({ t: 'cap', a: kn, b: an, ra: P.leg[1], rb: P.leg[2] }, { col: TIGHTS, bone: b(`shin${n}`), k: 1, surf: FAM.cloth });
    styleShoe(legs, [an[0], P.ankle, 0], 6.4, 0xe0a8b4, b(`foot${n}`), { surf: [0.5, 0], toeUp: 0.02, width: 0.92 });
  }
  legs.add({ t: 'tor', c: [0, hemY + 0.1, 0.2], R: 10.9, r: 0.6 }, { col: 0xdff2f6, bone: b('skirt'), k: 0.2, emit: 0.18, surf: SURF.glass });

  // ---- her cracked hand mirror, in the left hand: handle in the fist, the glass toward her face when she lifts it
  const mx = P.shoulderX + P.armOut * 1.6, mhy = P.wristY - 2.6;
  dress.detail(cyl(0.5, 0.6, 5.8, 8), { col: PAL.gold, bone: b('handL'), pos: [mx, mhy, 3.9], rot: [Math.PI / 2, 0, 0], surf: FAM.gold });
  dress.detail(torus(3.4, 0.6, 6, 20), { col: PAL.gold, bone: b('handL'), pos: [mx, mhy, 10.0], rot: [Math.PI / 2, 0, 0], surf: FAM.gold });
  dress.detail(ellipsoid(3.1, 0.28, 3.1, 16, 6), { col: 0xcfeef6, bone: b('handL'), pos: [mx, mhy, 10.0], emit: 0.55, surf: SURF.glass });
  dress.detail(tube([[mx - 2.2, mhy + 0.3, 8.6], [mx - 0.4, mhy + 0.32, 9.6], [mx + 0.6, mhy + 0.31, 10.6], [mx + 2.0, mhy + 0.3, 11.6]], 0.09, 4, 8), { col: 0x2a3a44, bone: b('handL'), surf: SURF.glass, ink: false });

  const hold: Pose = { armL: { rx: -0.45, rz: 0.15 }, foreL: { rx: -1.35, rz: 0.25 } };
  const gait: Gait = { ...REAL_WALK, stride: 0.55, knee: 0.85, bob: 1.2, sway: 0.06, twist: 0.06, lean: 0.04, squash: 0.02, arm: 0.35, elbow: 0.3, headBob: 0.02 };
  const rig = new Rig(bones, clips(
    gait,
    // a dancer's sway; a glance into the glass; now and then up onto her toes
    (t) => mix(hold, { head: { ry: 0.28 + 0.12 * sin(t, 0.5), rx: 0.08 }, chest: { rz: 0.03 * sin(t) }, skirt: { rz: 0.025 * sin(t), rx: 0.01 * cos(t, 2) }, hips: { ty: 0.7 * pulse(t, 0.6, 0.15) } }),
    (t) => {
      // the cast: the mirror lifted high and turned, a half pirouette
      const k = Math.sin(Math.min(1, t * 1.3) * Math.PI);
      return mix(hold, { armL: { rx: -2.3 * k, rz: 0.3 * k }, foreL: { rx: 1.0 * k }, chest: { ry: 0.5 * k }, skirt: { ry: 0.3 * k }, head: { rx: -0.2 * k } });
    },
    () => hold,
  ));
  const geo = layered([{ sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: dress, o: LAYER.cloth }, { sc: sash, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }]);
  return { geo, rig };
}

// ---------------------------------------------------------------- The Lost Child
/**
 * D-87: a small child with a big round head under a ribbed teal beanie (a cream band, a pompom), brown
 * tufts poking out, wide worried eyes; a mustard hand-me-down coat to the knees with sleeves past the
 * wrists, wooden buttons and a patched elbow, split below the last button so the knees pass; a red scarf
 * with a tail; navy trousers, socks, oxblood shoes. The plush bear, clutched tight, has button eyes and a
 * patched tummy.
 */
function lostChild(): SculptModel {
  const P: Proportions = {
    hip: 26.5, knee: 14.6, ankle: 2.6, stance: 3.3, waist: 31.4, chest: 37.2, shoulderY: 41.6, shoulderX: 6.2, elbowY: 34.2, wristY: 27.4, armOut: 1.0,
    neck: 43.4, headY: 49.6, headR: 7.2, leg: [2.7, 2.1, 1.65], arm: [1.75, 1.5, 1.25], hipW: 5.6, waistW: 5.4, chestW: 6.4, depth: 0.78,
  };
  const bones = humanBones(P, [{ name: 'plush', parent: 'chest', head: [-3.8, P.chest - 4, 7.2] }]);
  const b = B(bones);
  const skin = new Sculpt(0.45, 3, 0.45), hair = new Sculpt(0.5, 3, 0.45), hat = new Sculpt(0.5, 3, 0.45), coat = new Sculpt(0.6, 3, 0.45);
  const scarf = new Sculpt(0.55, 3, 0.45), legs = new Sculpt(0.62, 3, 0.45), bear = new Sculpt(0.48, 3, 0.45);
  const SKIN = 0xe2c6a6, HAIR = 0x5a3420, COAT = 0x94702e, SCARF = 0x8e2c28, TROU = 0x22304a, PLUSH = 0x8c7052, CREAM = 0xd4c8a8;
  const r = P.headR, hy = P.headY;

  // ---- skin: a big round head, a short neck, small hands half lost in the sleeves
  styleHead(skin, P, b('head'), SKIN, { jaw: 0.82, chin: 0.7, nose: 0.7, brow: 0.75, ears: 1.1 });
  skin.add({ t: 'cap', a: [0, P.neck - 2.6, -0.3], b: [0, P.neck + 2.4, 0.2], ra: r * 0.34, rb: r * 0.3 }, { col: SKIN, bone: b('neck'), k: 1, surf: FAM.skin });
  for (const [s, n] of SIDES) styleHand(skin, wristAt(P, s), s, P.arm[2], SKIN, b(`hand${n}`));
  // wide, worried eyes, a small frown
  styleFace(skin, P, b('head'), { iris: 0x2a2018, size: 0.24, spread: 0.36, browTilt: 0.34, browW: 0.85, brow: 0x4a2a18, mouth: 0x8a4a40, smile: -0.3, mouthW: 0.8 });

  // ---- hair: brown tufts poking out under the beanie (no ink: the knit sits close over it)
  styleHair(hair, P, b('head'), HAIR, {
    volume: 1.02, sideburns: false, ink: false,
    fringe: [
      [[-r * 0.5, hy + r * 0.5, r * 0.72], [-r * 0.62, hy + r * 0.2, r * 0.86]],
      [[r * 0.38, hy + r * 0.5, r * 0.78], [r * 0.5, hy + r * 0.22, r * 0.9]],
      [[r * 0.82, hy + r * 0.3, r * 0.2], [r * 0.9, hy, r * 0.38]],
      [[-r * 0.82, hy + r * 0.3, r * 0.2], [-r * 0.9, hy - r * 0.02, r * 0.36]],
    ],
  });
  // ---- the beanie: ribbed teal knit (per pixel), a turned-up cream band, a pompom
  const rib = (col: number, a: number) => ({ kind: 'stripes', col, a, b: 0.42, c: -r * 0.06 }) as const;
  // (pushed up and back, so the camera sees her eyes under the band)
  hat.add({ t: 'ell', c: [0, hy + r * 0.66, -r * 0.12], r: [r * 1.07, r * 0.78, r * 1.08], rot: [-0.2, 0, 0] }, { col: 0x3f6b6a, bone: b('head'), k: 0.5, surf: SURF.plush, pat: rib(0x355b5a, 34) });
  hat.add({ t: 'tor', c: [0, hy + r * 0.56, -r * 0.1], R: r * 0.96, r: r * 0.17, rot: [-0.2, 0, 0] }, { col: CREAM, bone: b('head'), k: 0.3, surf: SURF.plush, pat: rib(0xbcb092, 40) });
  hat.add({ t: 'sph', c: [0, hy + r * 1.42 + 1.55, -r * 0.28 - 0.32], r: 2.4 }, { col: CREAM, bone: b('head'), k: 0.5, surf: SURF.plush });

  // ---- the coat: a hand-me-down to the knees, split below the last button; sleeves past the wrists
  for (const t of torsoShapes(P, 0.7)) coat.add(t.s, { col: COAT, bone: b(t.bone), k: 0.6, surf: FAM.wool });
  coat.add({ t: 'cap', a: [0, P.waist + 1, 0.3], b: [0, P.knee + 1, 0.3], ra: P.waistW + 1.0, rb: P.hipW + 2.9, sz: P.depth + 0.12 }, { col: COAT, bone: b('hips'), k: 1.2, surf: FAM.wool });
  for (const [s, n] of SIDES) {
    const f = armForms(P, s, 0.6);
    coat.add(f.delt, { col: COAT, bone: b(`arm${n}`), k: 1.4, surf: FAM.wool });
    coat.add(f.upper, { col: COAT, bone: b(`arm${n}`), k: 1, surf: FAM.wool });
    coat.add({ t: 'cap', a: elbowAt(P, s), b: foreAt(P, s, 1.14), ra: P.arm[1] + 0.6, rb: P.arm[2] + 0.75 }, { col: COAT, bone: b(`fore${n}`), k: 0.8, surf: FAM.wool });
    coat.add({ t: 'tor', c: foreAt(P, s, 1.08), R: P.arm[2] + 0.9, r: 0.75 }, { col: COAT, bone: b(`fore${n}`), k: 0.3, surf: FAM.wool });
  }
  coat.add({ t: 'box', c: [0, P.knee - 9, 0], h: [30, 10, 30], r: 0.1 }, { sub: true, k: 0.2 });
  const fz = frontZ(coat, 0, P.hip - 4);
  coat.add({ t: 'box', c: [0, P.hip - 5, fz - 1], h: [1.6, 6.5, 6], r: 0.3, tx: -0.85 }, { sub: true, k: 0.3 });
  for (let i = 0; i < 3; i++) {
    const y = P.waist + 4 - i * 4;
    coat.detail(cyl(0.85, 0.85, 0.45, 10), { col: 0x4a3020, bone: b(i < 2 ? 'spine' : 'hips'), pos: [0.4, y, frontZ(coat, 0.4, y) + 0.12], rot: [Math.PI / 2, 0, 0], surf: FAM.wood, ink: false });
  }
  // a patch sewn over the left elbow
  const pe = elbowAt(P, 1);
  coat.detail(rbox(0.35, 2.8, 2.4, 0.15, 1), { col: 0x6a5a3c, bone: b('armL'), pos: [pe[0] + P.arm[1] + 0.55, pe[1] + 1.8, pe[2]], rot: [0, 0, 0.12], surf: FAM.cloth, ink: false });

  // ---- the red scarf, its tail hanging over the coat
  scarf.add({ t: 'tor', c: [0, P.neck - 0.8, 0.4], R: r * 0.48, r: 1.5 }, { col: SCARF, bone: b('chest'), k: 0.5, surf: FAM.wool });
  const tail = P.chest - 5.5;
  scarf.add({ t: 'cap', a: [2.4, P.neck - 1.6, 3.6], b: [3.4, tail, frontZ(coat, 3.4, tail) + 1.0], ra: 1.35, rb: 1.15 }, { col: SCARF, bone: b('chest'), k: 0.5, surf: FAM.wool });

  // ---- navy trousers (no ink under the coat), socks, oxblood shoes
  legs.add({ t: 'ell', c: [0, P.hip + 1.2, 0], r: [P.hipW + 0.2, 5, (P.hipW + 0.2) * P.depth * 1.05] }, { col: TROU, bone: b('hips'), k: 1.2, surf: FAM.cloth, ink: false });
  for (const [s, n] of SIDES) {
    const { hp, kn, an } = legAt(P, s);
    legs.add({ t: 'cap', a: hp, b: kn, ra: P.leg[0] + 0.5, rb: P.leg[1] + 0.5 }, { col: TROU, bone: b(`thigh${n}`), k: 1.6, surf: FAM.cloth, ink: false });
    legs.add({ t: 'cap', a: kn, b: [an[0], an[1] + 1.2, an[2]], ra: P.leg[1] + 0.5, rb: P.leg[2] + 0.7 }, { col: TROU, bone: b(`shin${n}`), k: 1, surf: FAM.cloth });
    legs.add({ t: 'cap', a: [an[0], an[1] + 1.4, an[2]], b: [an[0], P.ankle - 0.6, an[2] + 0.2], ra: P.leg[2] + 0.2, rb: P.leg[2] + 0.3 }, { col: 0xb0a68e, bone: b(`foot${n}`), k: 0.4, surf: FAM.cloth });
    styleShoe(legs, [an[0], P.ankle, 0], 6.4, 0x5a201a, b(`foot${n}`), { toeUp: 0.12, width: 1.12 });
  }

  // ---- the plush bear, clutched tight: a lighter muzzle, button eyes, a patched tummy
  const bx = -3.8, bz = 7.4, by = P.chest - 5.2;
  const fur = { col: PLUSH, bone: b('plush'), surf: SURF.plush };
  bear.add({ t: 'ell', c: [bx, by, bz], r: [3.2, 3.7, 2.8] }, { ...fur, k: 0.8 });
  bear.add({ t: 'sph', c: [bx, by + 5.0, bz + 0.3], r: 2.8 }, { ...fur, k: 1 });
  for (const s of [-1, 1]) {
    bear.add({ t: 'sph', c: [bx + s * 2.1, by + 7.2, bz], r: 1.05 }, { ...fur, k: 0.5 });
    bear.add({ t: 'cap', a: [bx + s * 2.4, by + 1.6, bz + 0.6], b: [bx + s * 3.2, by - 1.2, bz + 1.6], ra: 1.1, rb: 1.0 }, { ...fur, k: 0.6 });
    bear.add({ t: 'cap', a: [bx + s * 1.6, by - 2.6, bz + 0.6], b: [bx + s * 2.0, by - 4.0, bz + 2.2], ra: 1.2, rb: 1.15 }, { ...fur, k: 0.6 });
  }
  bear.add({ t: 'ell', c: [bx, by + 4.4, bz + 2.6], r: [1.3, 1.0, 0.9] }, { col: 0xc8ae88, bone: b('plush'), k: 0.4, surf: SURF.plush });
  for (const s of [-1, 1]) bear.detail(sphere(0.42, 8, 6), { col: 0x14100e, bone: b('plush'), pos: [bx + s * 1.05, by + 5.6, frontZ(bear, bx + s * 1.05, by + 5.6) + 0.05], surf: SURF.porcelain, ink: false });
  bear.detail(sphere(0.45, 8, 6), { col: 0x2a1a14, bone: b('plush'), pos: [bx, by + 4.7, frontZ(bear, bx, by + 4.7) + 0.05], surf: SURF.porcelain, ink: false });
  bear.detail(rbox(1.8, 1.8, 0.3, 0.3, 1), { col: 0xa8885e, bone: b('plush'), pos: [bx + 0.6, by - 0.6, frontZ(bear, bx + 0.6, by - 0.6) + 0.04], rot: [0, 0, 0.3], surf: FAM.cloth, ink: false });

  const clutch: Pose = { armR: { rx: -0.85, rz: -0.55 }, foreR: { rx: -1.5, rz: -0.45 } };
  const gait: Gait = { ...REAL_WALK, stride: 0.65, knee: 1.0, bob: 1.4, sway: 0.08, twist: 0.06, lean: 0.08, squash: 0.03, arm: 0.5, elbow: 0.4, lift: 0.15, headBob: 0.04 };
  const rig = new Rig(bones, clips(
    gait,
    (t) => mix(clutch, { head: { ry: 0.5 * sin(t) * Math.abs(sin(t)), rx: 0.02 }, plush: { sx: 1 - 0.06 * pulse(t, 0.5, 0.15), sy: 1 - 0.06 * pulse(t, 0.5, 0.15) }, chest: { rx: 0.06 } }),
    (t) => {
      const k = ease(t / 0.25) * (1 - ease((t - 0.6) / 0.4));
      return mix(clutch, { armL: { rx: -1.4 * k, rz: 0.2 * k }, foreL: { rx: -0.1 * k }, head: { rx: -0.12 * k } });
    },
    () => clutch,
    20,
  ));
  const geo = layered([
    { sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: hat, o: LAYER.cloth }, { sc: coat, o: LAYER.cloth },
    { sc: scarf, o: LAYER.cloth }, { sc: legs, o: LAYER.cloth }, { sc: bear, o: LAYER.cloth },
  ]);
  return { geo, rig };
}

// ---------------------------------------------------------------- The Ringleader
/**
 * D-87: tall and lean in a red tailcoat cut straight across at the waist — black lapels, gold frogging, gold
 * epaulettes with a fringe, gold cuffs — over a white shirt front and a black bow tie; cream breeches into
 * tall glossy riding boots; slick black hair, a waxed pencil moustache, a sharp jaw; a silk top hat with a
 * red band, tipped back so his face shows. The swallow tails swing on their own bone, and he conducts with
 * a baton.
 */
function ringleader(): SculptModel {
  const P: Proportions = { ...scaleP(HERO, 1.04), chestW: 9.6, waistW: 6.9, hipW: 7.5, headR: 7.4 };
  const bones = humanBones(P, [{ name: 'tails', parent: 'hips', head: [0, P.hip + 4, -5] }]);
  const b = B(bones);
  const skin = new Sculpt(0.48, 3, 0.45), hair = new Sculpt(0.55, 3, 0.45), shirt = new Sculpt(0.8, 3, 0.45), coat = new Sculpt(0.7, 3, 0.45);
  const legs = new Sculpt(0.78, 3, 0.45), boots = new Sculpt(0.7, 3, 0.45);
  const SKIN = 0xd6b898, BLACK = 0x141012, RED = 0x7c1c1a, GOLD = 0xc49a4c, CREAM = 0xdcd8cc, SHIRT = 0xe8e0ce;
  const SILK: Surf = [0.5, 0];
  const r = P.headR, hy = P.headY;

  // ---- skin: a sharp jaw, the neck, the hands
  styleHead(skin, P, b('head'), shadowedJaw(SKIN, P, 0.22), { jaw: 1.02, chin: 1.18, nose: 1.08, brow: 1.05 });
  skin.add({ t: 'cap', a: [0, P.neck - 3.6, -0.5], b: [0, P.neck + 3, 0.3], ra: r * 0.42, rb: r * 0.38 }, { col: SKIN, bone: b('neck'), k: 1.2, surf: FAM.skin });
  for (const [s, n] of SIDES) styleHand(skin, wristAt(P, s), s, P.arm[2], SKIN, b(`hand${n}`));
  // a showman's confident smirk
  styleFace(skin, P, b('head'), { iris: 0x2a1a12, size: 0.19, browTilt: -0.12, browW: 1.0, smirk: 0.6, smile: 0.12 });

  // ---- hair: slicked back with a side part; the waxed pencil moustache
  styleHair(hair, P, b('head'), BLACK, { volume: 0.97, back: 0.95, fringe: [[[r * 0.35, hy + r * 0.95, r * 0.3], [-r * 0.45, hy + r * 0.8, r * 0.62]]] });
  const my = hy - r * 0.41, mz = frontZ(skin, 0, my) + 0.15;
  const pencil: V3[] = [[-r * 0.46, my + r * 0.1, mz - r * 0.18], [-r * 0.22, my - r * 0.03, mz - r * 0.04], [0, my, mz], [r * 0.22, my - r * 0.03, mz - r * 0.04], [r * 0.46, my + r * 0.1, mz - r * 0.18]];
  hair.detail(tube(pencil, (t) => r * (0.03 + 0.03 * Math.sin(t * Math.PI)), 5, 14), { col: BLACK, bone: b('head'), surf: FAM.hair, ink: false });
  // the silk top hat with a red band, tipped back so the brim clears his eyes
  const hat = hatFrame([0, hy + r * 0.84, -r * 0.1], -0.2, -0.06);
  hair.detail(hat(cyl(r * 1.26, r * 1.26, 0.7, 32)), { col: BLACK, bone: b('head'), surf: SILK });
  hair.detail(hat(lathe([[0, 0], [r * 0.76, 0], [r * 0.79, r * 0.7], [r * 0.85, r * 1.45], [0, r * 1.45]], 28), [0, 0.3, 0]), { col: BLACK, bone: b('head'), surf: SILK });
  hair.detail(hat(cyl(r * 0.785, r * 0.765, r * 0.26, 28, true), [0, 0.3 + r * 0.15, 0]), { col: RED, bone: b('head'), surf: FAM.cloth });

  // ---- the shirt front (no ink: the coat covers the rest), collar points, studs and a black bow tie
  for (const t of torsoShapes(P).filter((t) => t.bone === 'chest')) shirt.add(t.s, { col: SHIRT, bone: b(t.bone), k: t.k, surf: FAM.cloth, ink: false });
  shirt.add({ t: 'tor', c: [0, P.neck - 2.5, 0.2], R: r * 0.42, r: 0.85 }, { col: SHIRT, bone: b('chest'), k: 0.3, surf: FAM.cloth });
  const tieY = P.neck - 2.6, tieZ = frontZ(shirt, 0, tieY);
  for (const s of [-1, 1]) {
    shirt.detail(rbox(2.2, 0.5, 1.6, 0.2, 1), { col: 0xf0e8d8, bone: b('chest'), pos: [s * 1.6, P.neck - 1.8, frontZ(shirt, s * 1.6, P.neck - 1.8) + 0.1], rot: [0.5, 0, s * 0.5], surf: FAM.cloth, ink: false });
    shirt.detail(cone(1.4, 2.6, 8), { col: BLACK, bone: b('chest'), pos: [s * 1.35, tieY, tieZ + 0.55], rot: [0, 0, s * Math.PI / 2], surf: FAM.cloth, ink: false });
  }
  shirt.detail(sphere(0.62, 8, 6), { col: BLACK, bone: b('chest'), pos: [0, tieY, tieZ + 0.7], surf: FAM.cloth, ink: false });
  for (let i = 0; i < 3; i++) {
    const y = P.chest + 4 - i * 2.6;
    shirt.detail(sphere(0.35, 6, 4), { col: 0xe8d8a8, bone: b('chest'), pos: [0, y, frontZ(shirt, 0, y) + 0.08], surf: FAM.gold, ink: false });
  }

  // ---- the tailcoat: open in a V with black lapels, cut straight across at the waist in front
  for (const t of torsoShapes(P, 0.7)) coat.add(t.s, { col: RED, bone: b(t.bone), k: 0.5, surf: FAM.wool });
  for (const [s, n] of SIDES) {
    const f = armForms(P, s, 0.5);
    coat.add(f.delt, { col: RED, bone: b(`arm${n}`), k: 1.5, surf: FAM.wool });
    coat.add(f.upper, { col: RED, bone: b(`arm${n}`), k: 1.1, surf: FAM.wool });
    coat.add(f.fore, { col: RED, bone: b(`fore${n}`), k: 0.8, surf: FAM.wool });
    coat.add({ t: 'tor', c: foreAt(P, s, 0.9), R: P.arm[2] + 0.75, r: 0.75 }, { col: GOLD, bone: b(`fore${n}`), k: 0.25, surf: FAM.gold });
  }
  const vTop = P.shoulderY + 1.2, vBot = P.chest - 1;
  const zT = frontZ(coat, 0, vTop - 2), zB = frontZ(coat, 0, vBot);
  for (const s of [1, -1]) {
    const lx = s * 3.6, lx2 = s * 0.6;
    coat.add({ t: 'cap', a: [lx, vTop - 0.8, frontZ(coat, lx, vTop - 0.8) - 0.3], b: [lx2, vBot + 0.3, frontZ(coat, lx2, vBot + 0.3) - 0.2], ra: 0.95, rb: 0.5 }, { col: 0x1a1014, bone: b('chest'), k: 0.25, surf: SURF.velvet });
  }
  coat.add({ t: 'cap', a: [0, vTop + 0.6, zT - 0.2], b: [0, vBot, zB - 0.6], ra: 3.4, rb: 0.95 }, { sub: true, k: 0.2 });
  coat.add({ t: 'box', c: [0, P.waist - 11.5, 9], h: [8.6, 10, 10], r: 0.4 }, { sub: true, k: 0.3 });
  // the swallow tails, on their own bone
  for (const s of [1, -1]) coat.add({ t: 'box', c: [s * 2.7, (P.hip + 2 + P.knee + 1) / 2, -P.hipW * P.depth - 1.6], h: [2.5, (P.hip + 1 - P.knee) / 2, 0.55], r: 0.5, tx: 0.2, rot: [0.12, 0, s * 0.07] }, { col: RED, bone: b('tails'), k: 0.6, surf: FAM.wool });
  // gold frogging across the chest, and epaulettes with a fringe
  for (let i = 0; i < 4; i++) {
    const fy = P.waist - 0.6 + i * 2.6;
    const cord = [-3.8, -1.9, 0, 1.9, 3.8].map((x): V3 => [x, fy, frontZ(coat, x, fy) + 0.12]);
    coat.detail(tube(cord, 0.32, 5, 12), { col: GOLD, bone: b('spine'), surf: FAM.gold, ink: false });
    for (const s of [-1, 1]) coat.detail(sphere(0.5, 8, 6), { col: GOLD, bone: b('spine'), pos: [s * 3.9, fy, frontZ(coat, s * 3.9, fy) + 0.2], surf: FAM.gold, ink: false });
  }
  for (const [s, n] of SIDES) {
    const ep: V3 = [s * (P.shoulderX + 0.4), P.shoulderY + 1.6, 0];
    coat.add({ t: 'ell', c: ep, r: [3.4, 1.0, 3.0] }, { col: GOLD, bone: b(`arm${n}`), k: 0.3, surf: FAM.gold });
    for (let i = 0; i < 7; i++) {
      const a = -1.2 + i * 0.4;
      coat.detail(cyl(0.26, 0.2, 2.2, 5), { col: GOLD, bone: b(`arm${n}`), pos: [ep[0] + s * Math.cos(a) * 3.3, ep[1] - 1.4, Math.sin(a) * 2.9], surf: FAM.gold, ink: false });
    }
  }

  // ---- cream breeches, high-waisted to meet the coat's front (no ink: the coat covers their back), flared at
  // the thigh, into tall glossy riding boots
  legs.add({ t: 'ell', c: [0, P.hip + 1.5, -0.2], r: [P.hipW, 6.2, P.hipW * P.depth] }, { col: CREAM, bone: b('hips'), k: 1.5, surf: FAM.cloth, ink: false });
  legs.add({ t: 'cap', a: [0, P.hip + 2, 0.2], b: [0, P.waist - 0.5, 0.25], ra: P.hipW + 0.3, rb: P.waistW + 0.4, sz: P.depth + 0.04 }, { col: CREAM, bone: b('spine'), k: 1.2, surf: FAM.cloth, ink: false });
  for (const [s, n] of SIDES) {
    const { hp, kn, an } = legAt(P, s);
    legs.add({ t: 'cap', a: hp, b: kn, ra: P.leg[0] + 0.6, rb: P.leg[1] + 0.5 }, { col: CREAM, bone: b(`thigh${n}`), k: 2, surf: FAM.cloth });
    legs.add({ t: 'ell', c: [s * (P.stance + 1.0), P.knee + 10, 0.2], r: [P.leg[0] * 0.82, 6.5, P.leg[0] * 0.8] }, { col: CREAM, bone: b(`thigh${n}`), k: 1.8, surf: FAM.cloth });
    legs.add({ t: 'cap', a: kn, b: an, ra: P.leg[1] + 0.4, rb: P.leg[2] + 0.4 }, { col: CREAM, bone: b(`shin${n}`), k: 1, surf: FAM.cloth });
    boots.add({ t: 'cap', a: [kn[0], P.knee + 2.2, 0.3], b: [an[0], P.ankle + 0.6, 0.1], ra: P.leg[1] + 1.3, rb: P.leg[2] + 1.15 }, { col: BLACK, bone: b(`shin${n}`), k: 0.8, surf: FAM.leather });
    boots.add({ t: 'tor', c: [kn[0], P.knee + 2.1, 0.3], R: P.leg[1] + 1.35, r: 0.7 }, { col: 0x221a1c, bone: b(`shin${n}`), k: 0.2, surf: FAM.leather });
    styleShoe(boots, [an[0], P.ankle, 0], 9.2, BLACK, b(`foot${n}`), { toeUp: 0.04 });
  }

  // ---- the conductor's baton
  const hx = -(P.shoulderX + P.armOut * 1.6);
  coat.detail(cyl(0.32, 0.48, 14, 8), { col: BLACK, bone: b('handR'), pos: [hx, P.wristY - 4, 7], rot: [Math.PI / 2 - 0.2, 0, 0], surf: SURF.paint });
  coat.detail(sphere(0.75, 8, 6), { col: 0xe8e0ce, bone: b('handR'), pos: [hx, P.wristY - 2.6, 13.6], surf: SURF.porcelain });

  const gait: Gait = { ...REAL_WALK, stride: 0.55, knee: 0.55, lift: 0.3, bob: 1.2, lean: -0.04, sway: 0.03, twist: 0.07, squash: 0.01, arm: 0.2, elbow: 0.45, headBob: 0.01 };
  const rig = new Rig(bones, clips(
    gait,
    (t) => {
      const tap = Math.max(0, sin(t, 3));
      return { armR: { rx: -0.55, rz: -0.3 }, foreR: { rx: -1.15 - 0.22 * tap }, armL: { rx: -0.45, rz: 0.35 }, foreL: { rx: -1.25 }, head: { rx: -0.08, ry: 0.08 * sin(t, 0.5) }, tails: { rx: 0.04 * sin(t) } };
    },
    (t) => {
      const k = Math.sin(Math.min(1, t) * Math.PI);
      return { armR: { rx: -1.5 * k - 0.5 * sin(t, 1.5) * k, rz: -0.5 * k * cos(t, 1.5) }, foreR: { rx: -0.45 * k }, chest: { ry: -0.22 * k }, head: { rx: -0.16 * k } };
    },
    (t) => ({ tails: { rx: 0.22 + 0.12 * sin(t, 2) }, armR: { rx: -0.22 }, foreR: { rx: -0.55 + 0.25 * sin(t) } }),
  ));
  const geo = layered([
    { sc: skin, o: LAYER.skin }, { sc: hair, o: LAYER.hair }, { sc: shirt, o: LAYER.cloth }, { sc: coat, o: LAYER.cloth },
    { sc: legs, o: LAYER.cloth }, { sc: boots, o: LAYER.hard },
  ]);
  return { geo, rig };
}

const cache = new Map<string, SculptModel>();
const BUILDERS: Record<string, () => SculptModel> = { carny, strongman, fortune_teller: fortuneTeller, ride_operator: commodore, lost_child: lostChild, ringleader, mira };

export function characterModel(id: string): SculptModel {
  let m = cache.get(id);
  if (!m) {
    m = (BUILDERS[id] ?? carny)();
    cache.set(id, m);
  }
  return m;
}

export const CHARACTER_IDS = Object.keys(BUILDERS);

/** A character sculpted elsewhere (a worker); ignored if this page already built its own. */
export function installCharacterModel(id: string, m: SculptModel): void {
  if (!cache.has(id)) cache.set(id, m);
}

export function hasCharacterModel(id: string): boolean {
  return cache.has(id);
}

export const _unused = { bareHand, V3: null as unknown as V3 };
