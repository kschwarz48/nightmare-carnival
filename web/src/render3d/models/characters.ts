// The seven playable characters (D-42, D-78): realistic-proportion, weary 1930s carnival folk modelled on the
// art reference (Luca the carny) — sculpted bodies on real skeletons with grounded gaits, idle
// fidgets that say who they are, attack flourishes synced to their signature weapon, and hurt and
// dash clips. Cartoon accents survive only in the attack snaps, as contrast.

import * as THREE from 'three';
import { C, SURF, cone, cyl, ellipsoid, extrude, lathe, rbox, sphere, torus, tube, vnoise, weather, type ColorFn, type V3 } from '../core/geo';
import { PAL } from './kit';
import { Sculpt, layered } from '../sculpt/sdf';
import { FAM, HERO, LAYER, shadowedJaw, styleFace, styleHair, styleHand, styleHead, styleShoe } from '../sculpt/figure';
import { Rig, type ClipDef, type Pose, ease, mix, pulse, sin, cos } from '../sculpt/rig';
import { type Gait, type Proportions, gaitPose, humanBones, hurtPose, idlePose, scaleP } from '../sculpt/humanoid';
import { REAL, bareHand, bodyStripes, frontZ, messyHair, realBody, realFace, realHead, torsoShapes, weatheredSkin } from '../sculpt/realism';

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

// ---------------------------------------------------------------- The Strongman
function strongman(): SculptModel {
  const P: Proportions = { ...scaleP(REAL, 1.06), shoulderX: 12.4, chestW: 12.6, waistW: 9.8, hipW: 9.2, arm: [3.9, 3.3, 2.5], leg: [4.6, 3.6, 2.7], stance: 5.6, depth: 0.66, headR: 6.4, armOut: 2.2 };
  const bones = humanBones(P);
  const b = B(bones);
  const sc = new Sculpt(0.6, 3.5, 0.45);
  const skin = weatheredSkin(0xb78a68, P, { stubble: 0.3, rings: 0.25 });
  const leopard: ColorFn = (p) => {
    const s = Math.sin(p.x * 1.2) * Math.sin(p.y * 1.05 + p.z * 0.7) + Math.sin(p.z * 1.5 + p.y * 0.45) * 0.6;
    return s > 0.95 ? C(0x2a2220) : C(0x9a7838).multiplyScalar(0.8 + 0.15 * Math.sin(p.y * 0.4));
  };
  const tights = weather(0x2a2426, 0.25, 0.1);
  realBody(sc, P, b, { skin, shirt: skin, trousers: tights, shoe: 0x2a1c14 });
  // heavy pectorals, a bull neck of trapezius, biceps (the deltoids come with the arms)
  for (const s of [1, -1]) {
    const py = P.chest + 1.8;
    sc.add({ t: 'ell', c: [s * 4.6, py, frontZ(sc, s * 4.6, py) - 1.7], r: [5, 3.8, 2.5], rot: [0, s * 0.18, 0] }, { col: skin, bone: b('chest'), k: 2, surf: SURF.skin });
    sc.add({ t: 'cap', a: [s * 2, P.neck - 1, -1.2], b: [s * (P.shoulderX - 2.5), P.shoulderY - 0.6, -0.6], ra: 2.6, rb: 2.4 }, { col: skin, bone: b('chest'), k: 2.5, surf: SURF.skin });
    sc.add({ t: 'ell', c: [s * (P.shoulderX + 0.9), P.shoulderY - 6.5, 0.4], r: [3.6, 4.6, 3.5] }, { col: skin, bone: b(s > 0 ? 'armL' : 'armR'), k: 2, surf: SURF.skin });
  }
  // one-shoulder leopard leotard over a thick middle
  sc.add({ t: 'ell', c: [0, P.waist - 1.5, 0.8], r: [P.waistW + 0.9, 8.6, P.waistW * P.depth + 1.6] }, { col: leopard, bone: b('spine'), k: 0.6, surf: SURF.cloth });
  sc.add({ t: 'ell', c: [0, P.hip + 1.5, 0.3], r: [P.hipW + 0.6, 6.2, P.hipW * P.depth * 1.05 + 0.5] }, { col: leopard, bone: b('hips'), k: 0.6, surf: SURF.cloth });
  sc.add({ t: 'cap', a: [-4, P.waist + 5, P.waistW * P.depth + 1.4], b: [-P.shoulderX + 2.5, P.shoulderY + 1.6, 0], ra: 1.9, rb: 1.7 }, { col: leopard, bone: b('chest'), k: 0.5, surf: SURF.cloth });
  sc.add({ t: 'tor', c: [0, P.hip + 4.5, 0.4], R: P.hipW + 0.7, r: 1.3 }, { col: 0x3a2618, bone: b('hips'), k: 0.4, surf: SURF.rubber });
  sc.detail(rbox(3, 2.4, 0.8, 0.4, 1), { col: 0xa08850, bone: b('hips'), pos: [0, P.hip + 4.5, P.hipW * P.depth + 1.6], surf: SURF.brass });
  // wrist wraps and tall boots
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    sc.add({ t: 'cap', a: [s * (P.shoulderX + P.armOut * 1.3), P.wristY + 4, 0.4], b: [s * (P.shoulderX + P.armOut * 1.55), P.wristY + 0.6, 0.6], ra: P.arm[2] + 0.7, rb: P.arm[2] + 0.6 }, { col: weather(0xc8b892, 0.4), bone: b(`fore${n}`), k: 0.4, surf: SURF.cloth });
    sc.add({ t: 'cap', a: [s * (P.stance + 0.3), P.knee - 2, 0.5], b: [s * (P.stance + 0.3), P.ankle + 1, 0.2], ra: P.leg[1] + 0.9, rb: P.leg[2] + 1 }, { col: 0x2a1c14, bone: b(`shin${n}`), k: 0.5, surf: SURF.rubber });
  }
  realHead(sc, P, b('head'), skin, { jaw: 1.2, chin: 1.25, nose: 1.15 });
  realFace(sc, P, b('head'), { browTilt: 0.1, frown: 0.02 });
  // a great waxed handlebar moustache
  const hy = P.headY - P.headR * 0.32, mz = frontZ(sc, 0, hy) + 0.3;
  sc.detail(tube([[-5, hy + 1.5, mz - 1.9], [-3, hy - 0.4, mz - 0.4], [0, hy - 0.2, mz], [3, hy - 0.4, mz - 0.4], [5, hy + 1.5, mz - 1.9]], (t) => 0.7 + Math.sin(t * Math.PI) * 0.55, 6, 16), { col: 0x1a1210, bone: b('head'), surf: SURF.cloth });
  for (const s of [-1, 1]) sc.detail(torus(0.8, 0.32, 5, 10), { col: 0x1a1210, bone: b('head'), pos: [s * 5.4, hy + 2.2, mz - 2.3], rot: [0, s * 0.8, 0], surf: SURF.cloth });
  // the carnival mallet
  const hx = -(P.shoulderX + P.armOut * 1.6);
  sc.detail(cyl(0.75, 0.75, 26, 6), { col: 0x8a7258, bone: b('handR'), pos: [hx, P.wristY - 3, 6], rot: [Math.PI / 2 - 0.35, 0, 0], surf: SURF.wood });
  sc.detail(cyl(3.6, 3.6, 9, 14), { col: C(0x7a2e2a).multiplyScalar(0.85), bone: b('handR'), pos: [hx, P.wristY + 1.2, 17.6], rot: [0, 0, Math.PI / 2], surf: SURF.wood });
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
  return { geo: sc.build({ ao: 0.62, aoScale: 0.65, paint: 1.1 }), rig };
}

// ---------------------------------------------------------------- The Fortune Teller
function fortuneTeller(): SculptModel {
  const P: Proportions = { ...scaleP(REAL, 0.97), shoulderX: 8.0, chestW: 7.4, waistW: 5.8, hipW: 7.8, headR: 5.9, arm: [2.0, 1.65, 1.3] };
  const bones = humanBones(P, [
    { name: 'skirt', parent: 'hips', head: [0, P.hip, 0] },
    { name: 'ball', parent: 'chest', head: [0, P.chest - 6, 8.6] },
  ]);
  const b = B(bones);
  const sc = new Sculpt(0.52, 3, 0.45);
  const skin = weatheredSkin(0xd2b494, P, { rings: 0.55 });
  const blouse = weather(0xcabd9e, 0.3, 0.12);
  realBody(sc, P, b, { skin, shirt: blouse, trousers: weather(0x241626, 0.3), shoe: 0x1a1214, skipLegs: true });
  // a long dark velvet skirt that sways on its own bone, gold at the hem
  const velvet = weather(0x2a1830, 0.3, 0.1);
  sc.add({ t: 'cap', a: [0, P.hip + 2, 0], b: [0, 4.5, 0], ra: P.hipW + 0.6, rb: 13 }, { col: velvet, bone: b('skirt'), k: 2, surf: SURF.velvet });
  sc.add({ t: 'tor', c: [0, 3.8, 0], R: 12.4, r: 2.4 }, { col: velvet, bone: b('skirt'), k: 1.5, surf: SURF.velvet });
  sc.add({ t: 'tor', c: [0, 2.6, 0], R: 13.2, r: 1.1 }, { col: 0xa48a48, bone: b('skirt'), k: 0.3, surf: SURF.gold });
  // wine-dark shawl draped over the shoulders, a fringe of tarnished coins along its lower edge
  const shawlC: V3 = [0, P.chest + 5, 0.2], shawlR: V3 = [P.chestW + 3.2, 5.6, P.chestW * P.depth + 2.4];
  sc.add({ t: 'ell', c: shawlC, r: shawlR }, { col: weather(0x5a1e28, 0.3, 0.12), bone: b('chest'), k: 0.8, surf: SURF.cloth });
  const hem = Math.sqrt(1 - 0.6 * 0.6);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    sc.detail(cyl(0.5, 0.5, 0.16, 8), { col: 0xa48a48, bone: b('chest'), pos: [Math.cos(a) * (shawlR[0] * hem + 0.2), shawlC[1] - shawlR[1] * 0.6, shawlC[2] + Math.sin(a) * (shawlR[2] * hem + 0.2)], rot: [Math.PI / 2, 0, a - Math.PI / 2], surf: SURF.gold });
  }
  realHead(sc, P, b('head'), skin, { jaw: 0.88, nose: 0.9, chin: 0.85 });
  realFace(sc, P, b('head'), { browTilt: 0.12, frown: 0.03, mouth: 0x6a1e22, iris: 0x2a1840 });
  // dark hair under a red headscarf, one braid down her back; coins across the brow; hoops
  messyHair(sc, P, b('head'), 0x1a1214, { volume: 1.02, fringe: 2, seed: 5 });
  sc.add({ t: 'ell', c: [0, P.headY + P.headR * 0.42, -0.5], r: [P.headR * 1.08, P.headR * 0.78, P.headR * 1.1] }, { col: weather(0x6e2420, 0.3, 0.15), bone: b('head'), k: 0.7, surf: SURF.cloth });
  sc.add({ t: 'cap', a: [0, P.headY - 1, -P.headR * 0.9], b: [0.6, P.chest - 2, -P.chestW * P.depth - 1.2], ra: 1.1, rb: 0.7 }, { col: 0x1a1214, bone: b('chest'), k: 0.6, surf: SURF.cloth });
  for (let i = 0; i < 9; i++) {
    const a = -1.05 + i * 0.26;
    sc.detail(cyl(0.6, 0.6, 0.2, 8), { col: 0xa48a48, bone: b('head'), pos: [Math.sin(a) * P.headR * 1.06, P.headY + P.headR * 0.18, Math.cos(a) * P.headR * 1.06], rot: [Math.PI / 2, 0, -a], surf: SURF.gold });
  }
  for (const s of [-1, 1]) sc.detail(torus(1.1, 0.2, 5, 12), { col: 0xa48a48, bone: b('head'), pos: [s * P.headR * 0.94, P.headY - P.headR * 0.55, 0], rot: [0, Math.PI / 2, 0], surf: SURF.gold });
  // the crystal ball
  sc.detail(sphere(3.6, 18, 14), { col: PAL.violet, bone: b('ball'), pos: [0, P.chest - 6, 8.6], emit: 0.5, surf: SURF.glass });
  sc.detail(sphere(1.5, 10, 8), { col: 0xe9dcff, bone: b('ball'), pos: [0, P.chest - 5.6, 8.9], emit: 1, surf: SURF.glass });
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
  return { geo: sc.build({ ao: 0.62, aoScale: 0.55, paint: 1.1 }), rig };
}

// ---------------------------------------------------------------- The Commodore (D-78: the Ride Operator's place)
function commodore(): SculptModel {
  const P: Proportions = { ...REAL, shoulderX: 9.4, chestW: 9.2, waistW: 8.9, hipW: 8.1, arm: [2.5, 2.0, 1.6], leg: [3.7, 2.7, 2.0], stance: 4.6 };
  const bones = humanBones(P);
  const b = B(bones);
  const sc = new Sculpt(0.55, 3, 0.45);
  const skin = weatheredSkin(0xd2c4b0, P, { rings: 0.5 });
  // white linen gone green in the folds, like the man the sea gave back
  const suit = weather(0xe6dec6, 0.5, 0.08, 0x8a9a6a);
  realBody(sc, P, b, { skin, shirt: suit, trousers: suit, shoe: 0x2a2018, cuffs: true });
  // a double-breasted coat to mid-thigh
  sc.add({ t: 'cap', a: [0, P.chest + 1, 0.4], b: [0, P.hip - 7, 0.4], ra: P.chestW + 0.9, rb: P.hipW + 2.1, sz: P.depth + 0.15 }, { col: suit, bone: b('spine'), k: 1.6, surf: SURF.cloth });
  const fz = P.chestW * P.depth + 1;
  for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * 1.1, P.chest - 4, fz + 0.2], b: [s * 4.8, P.shoulderY - 1.2, fz - 1.4], ra: 0.8, rb: 1.3 }, { col: weather(0xf2ecdc, 0.3), bone: b('chest'), k: 0.3, surf: SURF.cloth });
  sc.add({ t: 'cap', a: [0, P.neck - 3, fz - 1], b: [0, P.chest - 2.5, fz + 0.1], ra: 0.7, rb: 1 }, { col: 0x1a2a4a, bone: b('chest'), k: 0.2, surf: SURF.cloth });
  for (let i = 0; i < 3; i++) for (const s of [1, -1]) sc.detail(sphere(0.65, 8, 6), { col: PAL.gold, bone: b('spine'), pos: [s * 2.7, P.waist + 6 - i * 4.4, P.waistW * P.depth + 2.4], surf: SURF.gold });
  // a medal on a blue ribbon
  sc.detail(rbox(1.7, 2.4, 0.4, 0.2, 1), { col: 0x2a4a8a, bone: b('chest'), pos: [-5, P.chest + 2.4, fz + 0.1], surf: SURF.cloth });
  sc.detail(cyl(1.2, 1.2, 0.4, 12), { col: PAL.gold, bone: b('chest'), pos: [-5, P.chest - 0.2, fz + 0.3], rot: [Math.PI / 2, 0, 0], emit: 0.25, surf: SURF.gold });
  realHead(sc, P, b('head'), skin, { jaw: 1.02, chin: 1.05, nose: 1.15 });
  realFace(sc, P, b('head'), { browTilt: -0.04, frown: -0.02, brow: 0xe8e4d8, iris: 0x2a6a5a });
  // white at the temples, mutton chops down to the jaw, a full moustache
  const white = weather(0xeeeae0, 0.2, 0.2);
  const r = P.headR, y = P.headY;
  sc.add({ t: 'ell', c: [0, y + r * 0.3, -r * 0.32], r: [r * 0.98, r * 0.6, r * 0.92] }, { col: white, bone: b('head'), k: 0.8, surf: SURF.cloth });
  for (const s of [1, -1]) sc.add({ t: 'ell', c: [s * r * 0.84, y - r * 0.24, r * 0.2], r: [r * 0.26, r * 0.56, r * 0.44] }, { col: white, bone: b('head'), k: 0.45, surf: SURF.cloth });
  const my = y - r * 0.36, mz = frontZ(sc, 0, my);
  sc.add({ t: 'cap', a: [-r * 0.44, my - r * 0.06, mz - r * 0.12], b: [r * 0.44, my - r * 0.06, mz - r * 0.12], ra: r * 0.14, rb: r * 0.14 }, { col: white, bone: b('head'), k: 0.25, surf: SURF.cloth });
  // the commodore's cap: a black band, a broad white crown, a glossy peak and a gold badge
  sc.add({ t: 'tor', c: [0, y + r * 0.66, -0.3], R: r * 1.02, r: 0.8 }, { col: 0x14181c, bone: b('head'), k: 0.2, surf: SURF.cloth });
  sc.add({ t: 'ell', c: [0, y + r * 1.02, -0.5], r: [r * 1.2, r * 0.36, r * 1.22] }, { col: weather(0xf4f2ea, 0.25, 0.2, 0x9aa88a), bone: b('head'), k: 0.4, surf: SURF.cloth });
  sc.detail(ellipsoid(r * 0.88, 0.5, r * 0.58, 14, 6), { col: C(0x0a0c0e), bone: b('head'), pos: [0, y + r * 0.56, r * 0.98], rot: [0.24, 0, 0], surf: SURF.latex });
  sc.detail(sphere(0.9, 8, 6), { col: PAL.gold, bone: b('head'), pos: [0, y + r * 0.86, r * 1.05], emit: 0.3, surf: SURF.gold });
  // the silver-topped cane, in the right hand, to the boards
  const hx = -(P.shoulderX + P.armOut * 1.6) - 0.5;
  sc.detail(cyl(0.5, 0.45, P.wristY - 1, 8), { col: C(0x3a2418), bone: b('handR'), pos: [hx, (P.wristY - 1) / 2 - 1.5, 3], surf: SURF.wood });
  sc.detail(sphere(1.4, 10, 8), { col: 0xc8d0d8, bone: b('handR'), pos: [hx, P.wristY - 1.2, 3], surf: SURF.iron });
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
  return { geo: sc.build({ ao: 0.62, aoScale: 0.55, paint: 1.1 }), rig };
}

// ---------------------------------------------------------------- Mira (D-78)
function mira(): SculptModel {
  // a girl of twelve or so: a dancer's build, her hand mirror held up to her face
  const P: Proportions = {
    hip: 35, knee: 19.5, ankle: 3.1, stance: 3.4, waist: 42, chest: 50, shoulderY: 56.5, shoulderX: 6.8, elbowY: 44.8, wristY: 35.2, armOut: 1,
    neck: 59, headY: 65.2, headR: 5.8, leg: [2.7, 2.05, 1.5], arm: [1.7, 1.42, 1.12], hipW: 5.8, waistW: 4.8, chestW: 6.2, depth: 0.74,
  };
  const bones = humanBones(P, [{ name: 'skirt', parent: 'hips', head: [0, P.hip + 2, 0] }]);
  const b = B(bones);
  const sc = new Sculpt(0.45, 2.3, 0.45);
  const skin = weatheredSkin(0xe8d6ca, P, { rings: 0.35 });
  const dress = weather(0x86c0d0, 0.22, 0.1, 0x5f8f9e);
  realBody(sc, P, b, { skin, shirt: dress, trousers: weather(0xeae4de, 0.15), shoe: 0xd8a0aa, sock: 0xeae4de, rolled: true });
  // a dancer's dress: the skirt flared to just above the knee, on its own bone, edged in glass
  sc.add({ t: 'cap', a: [0, P.waist + 1, 0.2], b: [0, P.knee + 5.5, 0.2], ra: P.waistW + 0.5, rb: 10.5 }, { col: dress, bone: b('skirt'), k: 2, surf: SURF.cloth });
  sc.add({ t: 'tor', c: [0, P.knee + 6, 0.2], R: 9.8, r: 1.5 }, { col: dress, bone: b('skirt'), k: 1.2, surf: SURF.cloth });
  sc.add({ t: 'tor', c: [0, P.knee + 4.8, 0.2], R: 10.4, r: 0.55 }, { col: 0xdff2f6, bone: b('skirt'), k: 0.3, emit: 0.18, surf: SURF.glass });
  // a lilac sash, and puffed sleeves
  sc.add({ t: 'tor', c: [0, P.waist + 0.5, 0.2], R: P.waistW + 0.4, r: 0.9 }, { col: 0xcfc0ff, bone: b('spine'), k: 0.3, surf: SURF.cloth });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'ell', c: [s * (P.shoulderX + 0.5), P.shoulderY - 2.2, 0.1], r: [2.3, 2.6, 2.3] }, { col: dress, bone: b(`arm${n}`), k: 0.6, surf: SURF.cloth });
  realHead(sc, P, b('head'), skin, { jaw: 0.82, nose: 0.78, chin: 0.78 });
  realFace(sc, P, b('head'), { browTilt: 0.18, frown: -0.02, iris: 0x3a6a7a, mouth: 0x9a4a4e });
  // dark hair drawn back into a dancer's bun, a short fringe, a lilac bow on the bun
  const hair = 0x2a1a1e;
  messyHair(sc, P, b('head'), hair, { volume: 0.96, fringe: 3, seed: 13, locks: 10 });
  sc.add({ t: 'sph', c: [0, P.headY + P.headR * 0.55, -P.headR * 0.98], r: P.headR * 0.5 }, { col: hair, bone: b('head'), k: 0.6, surf: SURF.cloth });
  for (const s of [1, -1]) sc.add({ t: 'ell', c: [s * 1.5, P.headY + P.headR * 1.02, -P.headR * 0.86], r: [1.5, 0.8, 0.7], rot: [0, 0, s * 0.5] }, { col: 0xcfc0ff, bone: b('head'), k: 0.3, surf: SURF.cloth });
  // her cracked hand mirror, in the left hand: handle in the fist, the glass toward her face when she lifts it
  const mx = P.shoulderX + P.armOut * 1.6, mhy = P.wristY - 2.6;
  sc.detail(cyl(0.45, 0.55, 5.5, 8), { col: PAL.gold, bone: b('handL'), pos: [mx, mhy, 3.8], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
  sc.detail(torus(3.2, 0.55, 6, 18), { col: PAL.gold, bone: b('handL'), pos: [mx, mhy, 9.6], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
  sc.detail(ellipsoid(2.9, 0.25, 2.9, 14, 6), { col: 0xcfeef6, bone: b('handL'), pos: [mx, mhy, 9.6], emit: 0.55, surf: SURF.glass });
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
  return { geo: sc.build({ ao: 0.62, aoScale: 0.45, paint: 1.1 }), rig };
}

// ---------------------------------------------------------------- The Lost Child
function lostChild(): SculptModel {
  const P: Proportions = {
    hip: 27, knee: 15, ankle: 2.6, stance: 3.2, waist: 32, chest: 38, shoulderY: 42.5, shoulderX: 6, elbowY: 35, wristY: 28, armOut: 1,
    neck: 44.6, headY: 50.6, headR: 6.1, leg: [2.6, 2.0, 1.6], arm: [1.7, 1.45, 1.2], hipW: 5.4, waistW: 5.2, chestW: 6.2, depth: 0.78,
  };
  const bones = humanBones(P, [{ name: 'plush', parent: 'chest', head: [-4, P.chest - 4, 5] }]);
  const b = B(bones);
  const sc = new Sculpt(0.45, 2.2, 0.45);
  const skin = weatheredSkin(0xd8c0a2, P, { rings: 0.3 });
  const coat = weather(0x8c6a2c, 0.42, 0.14, 0xa8853a);
  realBody(sc, P, b, { skin, shirt: coat, trousers: weather(0x1f2a3d, 0.3), shoe: 0x4f1a17, sock: 0xa9a08a });
  // the hand-me-down coat: hangs to the knees, sleeves too long, a patched elbow
  sc.add({ t: 'cap', a: [0, P.chest + 2, 0.3], b: [0, P.knee + 2, 0.3], ra: P.chestW + 0.6, rb: P.hipW + 2.6 }, { col: coat, bone: b('spine'), k: 1.5, surf: SURF.cloth });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'tor', c: [s * (P.shoulderX + P.armOut * 1.5), P.wristY + 0.6, 0.6], R: P.arm[2] + 0.75, r: 0.8 }, { col: coat, bone: b(`fore${n}`), k: 0.4, surf: SURF.cloth });
  for (let i = 0; i < 3; i++) sc.detail(cyl(0.8, 0.8, 0.4, 10), { col: 0x3e2a1e, bone: b('spine'), pos: [0.4, P.waist + 4 - i * 4, P.waistW * P.depth + 1.8], rot: [Math.PI / 2, 0, 0], surf: SURF.wood });
  // a red scarf, tail fluttering
  sc.add({ t: 'tor', c: [0, P.neck - 0.4, 0.3], R: 3.4, r: 1.3 }, { col: weather(0x7a2e2a, 0.3), bone: b('chest'), k: 0.5, surf: SURF.cloth });
  sc.add({ t: 'cap', a: [2, P.neck - 1, 3], b: [3.2, P.chest - 5, 4.6], ra: 1.1, rb: 0.9 }, { col: weather(0x7a2e2a, 0.3), bone: b('chest'), k: 0.5, surf: SURF.cloth });
  realHead(sc, P, b('head'), skin, { jaw: 0.85, nose: 0.75, chin: 0.7 });
  realFace(sc, P, b('head'), { browTilt: 0.32, frown: 0.05, iris: 0x2a2018 });
  messyHair(sc, P, b('head'), 0x5a3420, { volume: 1.0, fringe: 3, seed: 9 });
  // knit beanie with a pom-pom
  sc.add({ t: 'ell', c: [0, P.headY + P.headR * 0.62, -0.3], r: [P.headR * 1.08, P.headR * 0.72, P.headR * 1.08] }, { col: weather(0x3f6b6a, 0.3, 0.25), bone: b('head'), k: 0.5, surf: SURF.plush });
  sc.add({ t: 'tor', c: [0, P.headY + P.headR * 0.25, -0.2], R: P.headR * 0.98, r: 1.2 }, { col: weather(0xcfc2a2, 0.3), bone: b('head'), k: 0.4, surf: SURF.plush });
  sc.add({ t: 'sph', c: [0, P.headY + P.headR * 1.45, -0.6], r: 2 }, { col: 0xcfc2a2, bone: b('head'), k: 0.8, surf: SURF.plush });
  // the plush bear, clutched tight
  const plush = weather(0x8a7258, 0.4, 0.25);
  sc.add({ t: 'ell', c: [-4, P.chest - 6, 5.6], r: [2.8, 3.3, 2.4] }, { col: plush, bone: b('plush'), k: 0.8, surf: SURF.plush });
  sc.add({ t: 'sph', c: [-4, P.chest - 1.8, 5.8], r: 2.3 }, { col: plush, bone: b('plush'), k: 1, surf: SURF.plush });
  for (const s of [-1, 1]) sc.add({ t: 'sph', c: [-4 + s * 1.8, P.chest + 0.3, 5.6], r: 0.9 }, { col: plush, bone: b('plush'), k: 0.5, surf: SURF.plush });
  sc.detail(sphere(0.45, 6, 4), { col: 0x14100e, bone: b('plush'), pos: [-3.3, P.chest - 1.6, 7.9], surf: SURF.porcelain });
  const clutch: Pose = { armR: { rx: -0.85, rz: -0.55 }, foreR: { rx: -1.5, rz: -0.45 } };
  const gait: Gait = { ...REAL_WALK, stride: 0.65, knee: 1.0, bob: 1.4, sway: 0.08, twist: 0.06, lean: 0.08, squash: 0.03, arm: 0.5, elbow: 0.4, lift: 0.15, headBob: 0.04 };
  const rig = new Rig(bones, clips(
    gait,
    (t) => mix(clutch, { head: { ry: 0.5 * sin(t) * Math.abs(sin(t)), rx: 0.1 }, plush: { sx: 1 - 0.06 * pulse(t, 0.5, 0.15), sy: 1 - 0.06 * pulse(t, 0.5, 0.15) }, chest: { rx: 0.06 } }),
    (t) => {
      const k = ease(t / 0.25) * (1 - ease((t - 0.6) / 0.4));
      return mix(clutch, { armL: { rx: -1.4 * k, rz: 0.2 * k }, foreL: { rx: -0.1 * k }, head: { rx: -0.12 * k } });
    },
    () => clutch,
    20,
  ));
  return { geo: sc.build({ ao: 0.62, aoScale: 0.42, paint: 1.1 }), rig };
}

// ---------------------------------------------------------------- The Ringleader
function ringleader(): SculptModel {
  const P: Proportions = { ...scaleP(REAL, 1.04), chestW: 8.6, waistW: 6.4, hipW: 7.2, headR: 6.2 };
  const bones = humanBones(P, [{ name: 'tails', parent: 'hips', head: [0, P.hip + 4, -5] }]);
  const b = B(bones);
  const sc = new Sculpt(0.52, 3, 0.45);
  const skin = weatheredSkin(0xd2b89a, P, { stubble: 0.15, rings: 0.3 });
  const coat = weather(0x6a1a18, 0.32, 0.1);
  const trousers = weather(0xcabd9c, 0.22, 0.12);
  realBody(sc, P, b, { skin, shirt: coat, trousers, shoe: 0x141012 });
  // white shirt front, gold frogging, epaulettes, swallow tails, tall boots
  const sTop = P.chest + 7.6, sBot = P.chest - 2;
  sc.add({ t: 'cap', a: [0, sTop, frontZ(sc, 0, sTop) - 1.9], b: [0, sBot, frontZ(sc, 0, sBot) - 0.4], ra: 2.2, rb: 0.6 }, { col: 0xe0d8c6, bone: b('chest'), k: 0.3, surf: SURF.cloth });
  for (let i = 0; i < 4; i++) {
    const fy = P.waist - 2 + i * 3;
    sc.add({ t: 'box', c: [0, fy, frontZ(sc, 0, fy) + 0.05], h: [3.6, 0.35, 0.35], r: 0.15 }, { col: 0xa48a48, bone: b(i < 2 ? 'spine' : 'chest'), k: 0.2, surf: SURF.gold });
  }
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    sc.add({ t: 'ell', c: [s * (P.shoulderX + 0.3), P.shoulderY + 1.9, 0], r: [3.2, 1, 2.8] }, { col: 0xa48a48, bone: b(`arm${n}`), k: 0.3, surf: SURF.gold });
    sc.add({ t: 'cap', a: [s * (P.stance + 0.3), P.knee + 2, 0.5], b: [s * (P.stance + 0.3), P.ankle + 0.8, 0.3], ra: P.leg[1] + 1.1, rb: P.leg[2] + 1 }, { col: 0x141012, bone: b(`shin${n}`), k: 0.4, surf: SURF.rubber });
  }
  for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * 2.6, P.hip + 3, -P.hipW * 0.62], b: [s * 3.6, P.knee + 1, -P.hipW * 0.9 - 2.6], ra: 2.2, rb: 1.3 }, { col: weather(0x4f1210, 0.32), bone: b('tails'), k: 0.6, surf: SURF.cloth });
  const tieZ = frontZ(sc, 0, P.neck - 2.3) + 0.45;
  for (const s of [-1, 1]) sc.detail(cone(1.2, 2.2, 6), { col: 0x14100e, bone: b('chest'), pos: [s * 1.15, P.neck - 2.3, tieZ], rot: [0, 0, s * Math.PI / 2], surf: SURF.cloth });
  realHead(sc, P, b('head'), skin, { jaw: 1.0, chin: 1.15, nose: 1.1 });
  realFace(sc, P, b('head'), { browTilt: -0.05, frown: -0.02 });
  // slick black hair, a waxed pencil moustache
  sc.add({ t: 'ell', c: [0, P.headY + P.headR * 0.42, -0.6], r: [P.headR * 0.98, P.headR * 0.7, P.headR * 1.02] }, { col: 0x141012, bone: b('head'), k: 0.6, surf: SURF.latex });
  const my = P.headY - P.headR * 0.32, mz = frontZ(sc, 0, my) + 0.2;
  sc.detail(tube([[-3.2, my + 0.6, mz - 1], [-1.6, my - 0.3, mz - 0.2], [0, my - 0.1, mz], [1.6, my - 0.3, mz - 0.2], [3.2, my + 0.6, mz - 1]], 0.42, 5, 12), { col: 0x141012, bone: b('head'), surf: SURF.cloth });
  // top hat with a blood-red band
  const ht = P.headY + P.headR * 0.95;
  sc.detail(cyl(8.6, 8.6, 0.7, 24), { col: 0x141012, bone: b('head'), pos: [0, ht, 0], rot: [-0.06, 0, 0], surf: SURF.velvet });
  sc.detail(lathe([[0, 0], [5.2, 0], [5.5, 5], [5.9, 10.4], [0, 10.4]], 22), { col: 0x141012, bone: b('head'), pos: [0, ht, 0], rot: [-0.06, 0, 0], surf: SURF.velvet });
  sc.detail(cyl(5.55, 5.35, 1.8, 22, true), { col: 0x6a1a18, bone: b('head'), pos: [0, ht + 1.5, -0.1], rot: [-0.06, 0, 0], surf: SURF.cloth });
  // conductor's baton
  const hx = -(P.shoulderX + P.armOut * 1.6);
  sc.detail(cyl(0.3, 0.45, 13, 6), { col: 0x141012, bone: b('handR'), pos: [hx, P.wristY - 4, 6.6], rot: [Math.PI / 2 - 0.2, 0, 0], surf: SURF.paint });
  sc.detail(sphere(0.7, 6, 4), { col: 0xe0d8c6, bone: b('handR'), pos: [hx, P.wristY - 2.6, 12.8], surf: SURF.porcelain });
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
  return { geo: sc.build({ ao: 0.62, aoScale: 0.55, paint: 1.1 }), rig };
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
