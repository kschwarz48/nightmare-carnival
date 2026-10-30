// The six playable characters (D-42): realistic-proportion, weary 1930s carnival folk modelled on the
// art reference (Luca the carny) — sculpted bodies on real skeletons with grounded gaits, idle
// fidgets that say who they are, attack flourishes synced to their signature weapon, and hurt and
// dash clips. Cartoon accents survive only in the attack snaps, as contrast.

import * as THREE from 'three';
import { C, SURF, cone, cyl, ellipsoid, extrude, lathe, rbox, sphere, torus, tube, vnoise, weather, type ColorFn, type V3 } from '../core/geo';
import { PAL } from './kit';
import { Sculpt } from '../sculpt/sdf';
import { Rig, type ClipDef, type Pose, ease, mix, pulse, sin, cos } from '../sculpt/rig';
import { type Gait, type Proportions, gaitPose, humanBones, hurtPose, idlePose, scaleP } from '../sculpt/humanoid';
import { REAL, bareHand, bodyStripes, messyHair, realBody, realFace, realHead, weatheredSkin } from '../sculpt/realism';

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
function carny(): SculptModel {
  const P = REAL;
  const bones = humanBones(P, [{ name: 'rag', parent: 'hips', head: [-6.5, P.hip + 2, 1.5] }]);
  const b = B(bones);
  const sc = new Sculpt(0.72, 3);
  const skin = weatheredSkin(0xc49a78, P, { stubble: 0.55, rings: 0.45 });
  const shirt = weather(0xd2c4a2, 0.3, 0.12);
  const trousers = weather(0x1d1a1f, 0.22, 0.12);
  realBody(sc, P, b, { skin, shirt, trousers, shoe: 0x2a1c14, sock: 0xcbbf9e, rolled: true, cuffs: true });
  // striped waistcoat with a V opening onto the shirt, lapels, buttons and points at the hem
  const vest = bodyStripes(0x7e2a24, 0xcdbd98, 1.45, 0.35);
  sc.add({ t: 'ell', c: [0, P.chest - 0.5, 0.45], r: [P.chestW + 0.55, 9.6, P.chestW * P.depth + 0.6] }, { col: vest, bone: b('chest'), k: 0.5, surf: SURF.cloth });
  sc.add({ t: 'ell', c: [0, P.waist + 0.5, 0.5], r: [P.waistW + 0.6, 7.6, P.waistW * P.depth + 0.6] }, { col: vest, bone: b('spine'), k: 1, surf: SURF.cloth });
  sc.add({ t: 'cap', a: [0, P.chest + 7.5, P.chestW * P.depth + 0.9], b: [0, P.chest - 3.5, P.chestW * P.depth + 1.2], ra: 2.6, rb: 0.35 }, { col: shirt, bone: b('chest'), k: 0.35, surf: SURF.cloth });
  for (const s of [1, -1]) {
    sc.add({ t: 'cap', a: [s * 2.8, P.chest + 7.2, P.chestW * P.depth + 1.1], b: [s * 0.4, P.chest - 3.4, P.chestW * P.depth + 1.35], ra: 0.55, rb: 0.4 }, { col: 0x5e1e1a, bone: b('chest'), k: 0.3, surf: SURF.cloth });
    sc.add({ t: 'cap', a: [s * 2.4, P.waist - 4, P.waistW * P.depth + 0.9], b: [s * 1.1, P.waist - 7.4, P.waistW * P.depth + 0.6], ra: 1.4, rb: 0.3 }, { col: vest, bone: b('spine'), k: 0.5, surf: SURF.cloth });
  }
  for (let i = 0; i < 4; i++) sc.detail(sphere(0.42, 6, 4), { col: 0xb8a070, bone: b(i < 2 ? 'spine' : 'chest'), pos: [0, P.waist - 3 + i * 3.2, P.chestW * P.depth + 1.2], surf: SURF.brass });
  // collar points and the red bowtie
  for (const s of [-1, 1]) {
    sc.detail(rbox(2.2, 0.5, 1.6, 0.2, 1), { col: 0xd8ccae, bone: b('chest'), pos: [s * 1.6, P.neck - 1.6, 3.4], rot: [0.5, 0, s * 0.5], surf: SURF.cloth });
    sc.detail(cone(1.3, 2.4, 6), { col: 0x7a221c, bone: b('chest'), pos: [s * 1.25, P.neck - 2.4, 4.1], rot: [0, 0, s * Math.PI / 2], surf: SURF.cloth });
  }
  sc.detail(sphere(0.55, 6, 4), { col: 0x5e1a16, bone: b('chest'), pos: [0, P.neck - 2.4, 4.3], surf: SURF.cloth });
  // name badge ("LUCA") pinned on the left breast
  sc.detail(rbox(3.4, 1.5, 0.3, 0.2, 1), { col: 0xe6dcc6, bone: b('chest'), pos: [3.9, P.chest + 2.5, P.chestW * P.depth + 0.9], rot: [0, 0.25, 0], surf: SURF.paint });
  for (let i = 0; i < 4; i++) sc.detail(rbox(0.45, 0.8, 0.1, 0.05, 1), { col: 0x1a1210, bone: b('chest'), pos: [3.9 - 1.05 + i * 0.7, P.chest + 2.5, P.chestW * P.depth + 1.1], rot: [0, 0.25, 0], surf: SURF.paint });
  // a rag tucked into the waistband
  const rag = weather(0xc8b892, 0.4, 0.2);
  sc.add({ t: 'cap', a: [-6.6, P.hip + 2, 1.8], b: [-7.2, P.hip - 9, 2.6], ra: 1.6, rb: 2.2 }, { col: rag, bone: b('rag'), k: 0.8, surf: SURF.cloth });
  sc.add({ t: 'cap', a: [-6.2, P.hip + 1, 2.6], b: [-6.4, P.hip - 11, 3.4], ra: 0.9, rb: 1.4 }, { col: rag, bone: b('rag'), k: 0.6, surf: SURF.cloth });
  // the patch on the left knee, stitched on with coarse thread
  sc.detail(rbox(3, 3.2, 0.35, 0.3, 1), { col: 0x6e2a1e, bone: b('shinL'), pos: [P.stance + 0.3, P.knee - 1.5, P.leg[1] + 1.1], rot: [0, 0, 0.12], surf: SURF.cloth });
  for (let i = 0; i < 6; i++) sc.detail(rbox(0.12, 0.6, 0.12, 0.04, 1), { col: 0xd8c8a0, bone: b('shinL'), pos: [P.stance + 0.3 + (i % 3 - 1) * 1.3, P.knee - 1.5 + (i < 3 ? 1.6 : -1.6), P.leg[1] + 1.3], surf: SURF.cloth });
  // the face: gaunt, unshaven, tired
  realHead(sc, P, b('head'), skin, { jaw: 0.95, nose: 1.05 });
  realFace(sc, P, b('head'), { browTilt: 0.28, frown: 0.06 });
  messyHair(sc, P, b('head'), 0x1a1310, { fringe: 4, seed: 2 });
  // straw boater with a red band, sitting low
  const hatM = new THREE.Matrix4().makeRotationX(-0.08).multiply(new THREE.Matrix4().makeRotationZ(0.05));
  const straw = (p: THREE.Vector3) => C(0xc9b083).multiplyScalar(0.82 + 0.25 * vnoise(p.x * 2.2, p.y * 2.2, p.z * 2.2));
  for (const [g, y, col] of [[cyl(10.4, 10.6, 0.9, 32), 0, null], [cyl(6.6, 7, 4.6, 28), 2.6, null], [cyl(7.1, 7.15, 1.5, 28, true), 1.4, 0x7a2a22]] as const) {
    const gg = g.clone();
    gg.applyMatrix4(hatM.clone().setPosition(0, P.headY + P.headR * 0.95 + y, -0.4));
    if (col === null) {
      // per-vertex straw weave
      const pos = gg.getAttribute('position');
      const cc = new THREE.Color();
      const avg = new THREE.Color(0, 0, 0);
      for (let i = 0; i < pos.count; i += 13) avg.add(straw(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))));
      cc.copy(avg.multiplyScalar(13 / pos.count));
      sc.detail(gg, { col: cc, bone: b('head'), surf: SURF.canvas });
    } else sc.detail(gg, { col, bone: b('head'), surf: SURF.cloth });
  }
  // a fan of dog-eared playing cards in the right hand
  const hx = -(P.shoulderX + P.armOut * 1.6);
  for (let i = 0; i < 4; i++) sc.detail(rbox(3.2, 4.6, 0.22, 0.4, 1), { col: i % 2 ? 0xe2d8c2 : 0xd6c8ac, bone: b('handR'), pos: [hx - 0.5 - i * 0.35, P.wristY - 4.2 + i * 0.15, 2.6], rot: [0.2, 0.15, -0.6 + i * 0.28], surf: SURF.paint });
  sc.detail(rbox(1.2, 1.4, 0.1, 0.1, 1), { col: 0x8a2a20, bone: b('handR'), pos: [hx - 1.4, P.wristY - 3.4, 2.82], rot: [0.2, 0.15, 0.25], surf: SURF.paint });
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
  return { geo: sc.build({ ao: 0.6, aoScale: 0.6 }), rig };
}

// ---------------------------------------------------------------- The Strongman
function strongman(): SculptModel {
  const P: Proportions = { ...scaleP(REAL, 1.06), shoulderX: 12.4, chestW: 12.6, waistW: 9.8, hipW: 9.2, arm: [3.9, 3.3, 2.5], leg: [4.6, 3.6, 2.7], stance: 5.6, depth: 0.66, headR: 6.6, armOut: 2.2 };
  const bones = humanBones(P);
  const b = B(bones);
  const sc = new Sculpt(0.85, 3.5);
  const skin = weatheredSkin(0xb78a68, P, { stubble: 0.3, rings: 0.25 });
  const leopard: ColorFn = (p) => {
    const s = Math.sin(p.x * 1.2) * Math.sin(p.y * 1.05 + p.z * 0.7) + Math.sin(p.z * 1.5 + p.y * 0.45) * 0.6;
    return s > 0.95 ? C(0x2a2220) : C(0x9a7838).multiplyScalar(0.8 + 0.15 * Math.sin(p.y * 0.4));
  };
  const tights = weather(0x2a2426, 0.25, 0.1);
  realBody(sc, P, b, { skin, shirt: skin, trousers: tights, shoe: 0x2a1c14 });
  // heavy chest, belly, deltoids and biceps
  for (const s of [1, -1]) {
    sc.add({ t: 'ell', c: [s * 4.6, P.chest + 1.8, P.chestW * P.depth - 1], r: [5, 3.8, 2.8] }, { col: skin, bone: b('chest'), k: 2, surf: SURF.skin });
    sc.add({ t: 'sph', c: [s * (P.shoulderX - 0.6), P.shoulderY + 0.6, 0], r: 4.3 }, { col: skin, bone: b('chest'), k: 2.5, surf: SURF.skin });
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
  const hy = P.headY - P.headR * 0.32;
  sc.detail(tube([[-5.4, hy + 1.5, 4.4], [-3.2, hy - 0.4, 5.9], [0, hy - 0.2, 6.3], [3.2, hy - 0.4, 5.9], [5.4, hy + 1.5, 4.4]], (t) => 0.7 + Math.sin(t * Math.PI) * 0.55, 6, 16), { col: 0x1a1210, bone: b('head'), surf: SURF.cloth });
  for (const s of [-1, 1]) sc.detail(torus(0.8, 0.32, 5, 10), { col: 0x1a1210, bone: b('head'), pos: [s * 5.8, hy + 2.2, 4], rot: [0, s * 0.8, 0], surf: SURF.cloth });
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
  return { geo: sc.build({ ao: 0.6, aoScale: 0.7 }), rig };
}

// ---------------------------------------------------------------- The Fortune Teller
function fortuneTeller(): SculptModel {
  const P: Proportions = { ...scaleP(REAL, 0.97), shoulderX: 7.6, chestW: 7.8, waistW: 5.8, hipW: 7.8, headR: 6.2, arm: [2.0, 1.65, 1.3] };
  const bones = humanBones(P, [
    { name: 'skirt', parent: 'hips', head: [0, P.hip, 0] },
    { name: 'ball', parent: 'chest', head: [0, P.chest - 6, 8.6] },
  ]);
  const b = B(bones);
  const sc = new Sculpt(0.72, 3);
  const skin = weatheredSkin(0xd2b494, P, { rings: 0.55 });
  const blouse = weather(0xcabd9e, 0.3, 0.12);
  realBody(sc, P, b, { skin, shirt: blouse, trousers: weather(0x241626, 0.3), shoe: 0x1a1214, skipLegs: true });
  // a long dark velvet skirt that sways on its own bone, gold at the hem
  const velvet = weather(0x2a1830, 0.3, 0.1);
  sc.add({ t: 'cap', a: [0, P.hip + 2, 0], b: [0, 4.5, 0], ra: P.hipW + 0.6, rb: 13 }, { col: velvet, bone: b('skirt'), k: 2, surf: SURF.velvet });
  sc.add({ t: 'tor', c: [0, 3.8, 0], R: 12.4, r: 2.4 }, { col: velvet, bone: b('skirt'), k: 1.5, surf: SURF.velvet });
  sc.add({ t: 'tor', c: [0, 2.6, 0], R: 13.2, r: 1.1 }, { col: 0xa48a48, bone: b('skirt'), k: 0.3, surf: SURF.gold });
  // wine-dark shawl with a fringe of tarnished coins
  sc.add({ t: 'ell', c: [0, P.chest + 3.6, 0.4], r: [P.chestW + 2.6, 4.6, P.chestW * P.depth + 2.2] }, { col: weather(0x5a1e28, 0.3, 0.12), bone: b('chest'), k: 0.8, surf: SURF.cloth });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    sc.detail(cyl(0.5, 0.5, 0.16, 8), { col: 0xa48a48, bone: b('chest'), pos: [Math.cos(a) * (P.chestW + 2.4), P.chest + 0.4, Math.sin(a) * (P.chestW * P.depth + 2)], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
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
  return { geo: sc.build({ ao: 0.6, aoScale: 0.6 }), rig };
}

// ---------------------------------------------------------------- The Ride Operator
function rideOperator(): SculptModel {
  const P: Proportions = { ...REAL, chestW: 9.6, waistW: 8.6, hipW: 8.2, arm: [2.7, 2.2, 1.8], leg: [4.0, 3.0, 2.2], stance: 4.8 };
  const bones = humanBones(P);
  const b = B(bones);
  const sc = new Sculpt(0.75, 3);
  const skin = weatheredSkin(0xb98e6c, P, { stubble: 0.7, rings: 0.35 });
  const shirt = weather(0xc8bb9a, 0.32, 0.12);
  // denim with grease stains
  const denim: ColorFn = (p) => {
    const base = C(0x34465e).multiplyScalar(0.8 + 0.25 * vnoise(p.x * 0.4, p.y * 0.4, p.z * 0.4));
    return vnoise(p.x * 0.25 + 9, p.y * 0.25, p.z * 0.25) > 0.72 ? base.multiplyScalar(0.45) : base;
  };
  realBody(sc, P, b, { skin, shirt, trousers: denim, shoe: 0x2e1e14, rolled: true });
  // bib overalls: front bib with a pocket, straps over the shoulders
  sc.add({ t: 'ell', c: [0, P.waist, 0.6], r: [P.waistW + 0.7, 8.6, P.waistW * P.depth + 0.9] }, { col: denim, bone: b('spine'), k: 0.5, surf: SURF.cloth });
  sc.add({ t: 'box', c: [0, P.chest - 2, P.chestW * P.depth - 0.2], h: [5, 4.4, 1.1], r: 0.6 }, { col: denim, bone: b('chest'), k: 0.4, surf: SURF.cloth });
  for (const s of [1, -1]) {
    sc.add({ t: 'cap', a: [s * 3.8, P.chest + 1.6, P.chestW * P.depth + 0.4], b: [s * 5.6, P.shoulderY + 1, -1.4], ra: 0.85, rb: 0.8 }, { col: denim, bone: b('chest'), k: 0.3, surf: SURF.cloth });
    sc.detail(sphere(0.55, 6, 4), { col: 0xa48a48, bone: b('chest'), pos: [s * 3.8, P.chest + 1.8, P.chestW * P.depth + 1], surf: SURF.brass });
  }
  sc.add({ t: 'tor', c: [0, P.hip + 3.5, 0.4], R: P.hipW + 0.6, r: 1.1 }, { col: 0x3a2618, bone: b('hips'), k: 0.4, surf: SURF.rubber });
  sc.add({ t: 'box', c: [6.4, P.hip + 1, 4], h: [2.2, 2.6, 1.4], r: 0.5, rot: [0, 0.6, 0] }, { col: 0x3a2618, bone: b('hips'), k: 0.4, surf: SURF.rubber });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'cap', a: [s * (P.stance + 0.3), P.ankle + 6, 0.4], b: [s * (P.stance + 0.3), P.ankle + 1.4, 0.4], ra: P.leg[2] + 1.2, rb: P.leg[2] + 1.3 }, { col: 0x2e1e14, bone: b(`shin${n}`), k: 0.5, surf: SURF.rubber });
  realHead(sc, P, b('head'), skin, { jaw: 1.1, chin: 1.1, nose: 1.1 });
  realFace(sc, P, b('head'), { browTilt: 0.05, frown: 0.03 });
  messyHair(sc, P, b('head'), 0x3a2a1e, { volume: 0.92, fringe: 1, seed: 7 });
  // flat cap with goggles strapped on
  sc.add({ t: 'ell', c: [0, P.headY + P.headR * 0.75, -0.3], r: [P.headR * 1.1, P.headR * 0.48, P.headR * 1.12] }, { col: weather(0x3c4048, 0.35, 0.12), bone: b('head'), k: 0.6, surf: SURF.cloth });
  sc.detail(ellipsoid(5.6, 0.7, 4, 14, 6), { col: C(0x3c4048), bone: b('head'), pos: [0, P.headY + P.headR * 0.62, P.headR * 0.85], rot: [0.16, 0, 0], surf: SURF.cloth });
  for (const s of [-1, 1]) {
    sc.detail(torus(1.6, 0.55, 6, 12), { col: 0x9a7a3c, bone: b('head'), pos: [s * 2.4, P.headY + P.headR * 1.05, P.headR * 0.62], rot: [-0.6, 0, 0], surf: SURF.brass });
    sc.detail(cyl(1.3, 1.3, 0.3, 12), { col: PAL.cold, bone: b('head'), pos: [s * 2.4, P.headY + P.headR * 1.05, P.headR * 0.62], rot: [Math.PI / 2 - 0.6, 0, 0], emit: 0.25, surf: SURF.glass });
  }
  // the big monkey wrench
  const wrench = new THREE.Shape();
  wrench.moveTo(-0.9, -8); wrench.lineTo(0.9, -8); wrench.lineTo(0.9, 3.4); wrench.lineTo(2.6, 3.4); wrench.lineTo(2.6, 7); wrench.lineTo(1, 7);
  wrench.lineTo(1, 5.2); wrench.lineTo(-1, 5.2); wrench.lineTo(-1, 7); wrench.lineTo(-2.6, 7); wrench.lineTo(-2.6, 3.4); wrench.lineTo(-0.9, 3.4); wrench.lineTo(-0.9, -8);
  sc.detail(extrude(wrench, 1.3, 0.25, 4, 1), { col: PAL.iron, bone: b('handR'), pos: [-(P.shoulderX + P.armOut * 1.6) - 0.6, P.wristY - 5.5, 3.4], rot: [Math.PI / 2 - 0.4, 0, 0.2], surf: SURF.iron });
  const gait: Gait = { ...REAL_WALK, stride: 0.6, knee: 0.9, bob: 1.8, lean: 0.1, sway: 0.05, twist: 0.12, squash: 0.02, arm: 0.5, elbow: 0.6, headBob: 0.03 };
  const rig = new Rig(bones, clips(
    gait,
    (t) => ({ handR: { rz: t * Math.PI * 4 }, foreR: { rx: -0.9 }, armR: { rx: -0.25 }, footL: { rx: -0.3 * Math.max(0, sin(t, 4)) }, head: { ry: 0.12 * sin(t, 0.5) } }),
    (t) => {
      const wind = ease(t / 0.3) * (1 - ease((t - 0.3) / 0.12));
      const sw = ease((t - 0.3) / 0.15) * (1 - ease((t - 0.65) / 0.35));
      return { chest: { ry: 0.6 * wind - 0.7 * sw }, armR: { rx: -1.1 * wind - 0.5 * sw, rz: 0.5 * wind - 0.45 * sw }, armL: { rx: -0.8 * wind - 0.4 * sw }, foreR: { rx: -0.9 * wind } };
    },
  ));
  return { geo: sc.build({ ao: 0.6, aoScale: 0.6 }), rig };
}

// ---------------------------------------------------------------- The Lost Child
function lostChild(): SculptModel {
  const P: Proportions = {
    hip: 27, knee: 15, ankle: 2.6, stance: 3.2, waist: 32, chest: 38, shoulderY: 42.5, shoulderX: 6, elbowY: 35, wristY: 28, armOut: 1,
    neck: 44.6, headY: 50.6, headR: 6.1, leg: [2.6, 2.0, 1.6], arm: [1.7, 1.45, 1.2], hipW: 5.4, waistW: 5.2, chestW: 6.2, depth: 0.78,
  };
  const bones = humanBones(P, [{ name: 'plush', parent: 'chest', head: [-4, P.chest - 4, 5] }]);
  const b = B(bones);
  const sc = new Sculpt(0.6, 2.2);
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
  return { geo: sc.build({ ao: 0.6, aoScale: 0.45 }), rig };
}

// ---------------------------------------------------------------- The Ringleader
function ringleader(): SculptModel {
  const P: Proportions = { ...scaleP(REAL, 1.04), chestW: 8.6, waistW: 6.4, hipW: 7.2, headR: 6.4 };
  const bones = humanBones(P, [{ name: 'tails', parent: 'hips', head: [0, P.hip + 4, -5] }]);
  const b = B(bones);
  const sc = new Sculpt(0.72, 3);
  const skin = weatheredSkin(0xd2b89a, P, { stubble: 0.15, rings: 0.3 });
  const coat = weather(0x6a1a18, 0.32, 0.1);
  const trousers = weather(0xcabd9c, 0.22, 0.12);
  realBody(sc, P, b, { skin, shirt: coat, trousers, shoe: 0x141012 });
  // white shirt front, gold frogging, epaulettes, swallow tails, tall boots
  sc.add({ t: 'cap', a: [0, P.chest + 7.6, P.chestW * P.depth + 0.6], b: [0, P.chest - 2, P.chestW * P.depth + 0.8], ra: 2.2, rb: 0.6 }, { col: 0xe0d8c6, bone: b('chest'), k: 0.3, surf: SURF.cloth });
  for (let i = 0; i < 4; i++) sc.add({ t: 'box', c: [0, P.waist - 2 + i * 3, P.waistW * P.depth + 0.4 + i * 0.25], h: [3.6, 0.35, 0.35], r: 0.15 }, { col: 0xa48a48, bone: b(i < 2 ? 'spine' : 'chest'), k: 0.2, surf: SURF.gold });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    sc.add({ t: 'ell', c: [s * (P.shoulderX + 0.3), P.shoulderY + 1.2, 0], r: [3.2, 1, 2.8] }, { col: 0xa48a48, bone: b(`arm${n}`), k: 0.3, surf: SURF.gold });
    sc.add({ t: 'cap', a: [s * (P.stance + 0.3), P.knee + 2, 0.5], b: [s * (P.stance + 0.3), P.ankle + 0.8, 0.3], ra: P.leg[1] + 1.1, rb: P.leg[2] + 1 }, { col: 0x141012, bone: b(`shin${n}`), k: 0.4, surf: SURF.rubber });
  }
  for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * 2.6, P.hip + 3, -P.hipW * 0.62], b: [s * 3.6, P.knee + 1, -P.hipW * 0.9 - 2.6], ra: 2.2, rb: 1.3 }, { col: weather(0x4f1210, 0.32), bone: b('tails'), k: 0.6, surf: SURF.cloth });
  for (const s of [-1, 1]) sc.detail(cone(1.2, 2.2, 6), { col: 0x14100e, bone: b('chest'), pos: [s * 1.15, P.neck - 2.3, 4.2], rot: [0, 0, s * Math.PI / 2], surf: SURF.cloth });
  realHead(sc, P, b('head'), skin, { jaw: 1.0, chin: 1.15, nose: 1.1 });
  realFace(sc, P, b('head'), { browTilt: -0.05, frown: -0.02 });
  // slick black hair, a waxed pencil moustache
  sc.add({ t: 'ell', c: [0, P.headY + P.headR * 0.42, -0.6], r: [P.headR * 0.98, P.headR * 0.7, P.headR * 1.02] }, { col: 0x141012, bone: b('head'), k: 0.6, surf: SURF.latex });
  const my = P.headY - P.headR * 0.32;
  sc.detail(tube([[-3.4, my + 0.6, 5.2], [-1.6, my - 0.3, 6], [0, my - 0.1, 6.2], [1.6, my - 0.3, 6], [3.4, my + 0.6, 5.2]], 0.42, 5, 12), { col: 0x141012, bone: b('head'), surf: SURF.cloth });
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
  return { geo: sc.build({ ao: 0.6, aoScale: 0.6 }), rig };
}

const cache = new Map<string, SculptModel>();
const BUILDERS: Record<string, () => SculptModel> = { carny, strongman, fortune_teller: fortuneTeller, ride_operator: rideOperator, lost_child: lostChild, ringleader };

export function characterModel(id: string): SculptModel {
  let m = cache.get(id);
  if (!m) {
    m = (BUILDERS[id] ?? carny)();
    cache.set(id, m);
  }
  return m;
}

export const CHARACTER_IDS = Object.keys(BUILDERS);

export const _unused = { bareHand, V3: null as unknown as V3 };
