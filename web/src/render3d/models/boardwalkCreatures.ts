// The Boardwalk's monsters (D-68): SDF sculpts on their own skeletons, like the other maps' crowds, each
// with a locomotion clip and the wind-up/attack clip the sim's telegraph drives — and, where the sim has a
// state worth showing, a clip of its own: clawing up out of the sand, the lure, the lash, the ride.
// A drowned bather in a striped wool suit, a bottle-capped crab, a gaunt usher with a ticket punch, a
// twist of saltwater taffy, a penny-arcade cabinet on brass legs, a screaming rider in a coaster car, a
// diver the reef grew over, an angler fish hanging a carnival lantern, the prize-counter man and his
// sack, and Old Mother Tide's bell-ringer.

import { C, SURF, box, cone, cyl, ellipsoid, sphere, torus, vnoise, weather, type ColorFn, type V3 } from '../core/geo';
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
/** A small deterministic random stream, so every sculpt comes out the same every boot. */
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Proportions scaled by k, with overrides given in ADULT units (scaled too). */
function prop(k: number, o: Partial<Proportions>): Proportions {
  const out: Partial<Proportions> = {};
  for (const [key, v] of Object.entries(o)) (out as Record<string, unknown>)[key] = Array.isArray(v) ? v.map((x: number) => x * k) : (v as number) * k;
  return scaleP(ADULT, k, out);
}

/** Skin the sea has had for ninety years: grey-green, mottled, bruised at the joints. */
const drownedSkin: ColorFn = (p) => {
  const c = C(0x7d8c80).lerp(C(0x3e4c46), 0.25 + 0.45 * vnoise(p.x * 0.14, p.y * 0.14, p.z * 0.14));
  const bruise = vnoise(p.x * 0.45 + 7, p.y * 0.45, p.z * 0.45);
  return bruise > 0.72 ? c.lerp(C(0x4a3a4c), (bruise - 0.72) * 2.5) : c;
};
/** A 1930s wool bathing suit in navy and cream hoops, faded and stained. */
function hoops(h: number): ColorFn {
  const navy = weather(0x23304a, 0.45), cream = weather(0xb8ad92, 0.55, 0.08, 0x5e5240);
  return (p, n) => (Math.floor(p.y / h) % 2 === 0 ? navy(p, n) : cream(p, n));
}
/** Barnacle crust: chalky white-grey, pitted. */
const crust: ColorFn = (p) => {
  const n = vnoise(p.x * 0.5, p.y * 0.5, p.z * 0.5);
  return C(0xb7ae98).lerp(C(0x4a463e), n > 0.62 ? 0.7 : 0.15 + 0.3 * vnoise(p.x * 0.12, p.y * 0.12, p.z * 0.12));
};

/** A cluster of barnacles (cones with dark mouths) and the odd mussel, scattered around `c` on a bone. */
function barnacles(sc: Sculpt, bone: number, c: V3, spread: V3, n: number, size: number, seed: number): void {
  const r = stream(seed);
  for (let i = 0; i < n; i++) {
    const p: V3 = [c[0] + (r() - 0.5) * 2 * spread[0], c[1] + (r() - 0.5) * 2 * spread[1], c[2] + (r() - 0.5) * 2 * spread[2]];
    const s = size * (0.6 + r() * 0.7);
    const rot: V3 = [(r() - 0.5) * 1.2, 0, (r() - 0.5) * 1.2];
    if (r() < 0.8) {
      sc.detail(cone(s, s * 1.3, 7), { col: 0xcfc6b0, bone, pos: p, rot, surf: SURF.bone });
      sc.detail(cyl(s * 0.38, s * 0.38, s * 0.3, 6), { col: PAL.ink, bone, pos: [p[0], p[1] + s * 0.62, p[2]], rot, surf: SURF.rubber });
    } else sc.detail(ellipsoid(s * 0.7, s * 1.5, s * 0.55, 8, 6), { col: 0x1c2232, bone, pos: p, rot: [rot[0], r() * 3, rot[2] + 0.6], surf: SURF.porcelain });
  }
}
/** Strands of kelp hanging from a bone. */
function kelp(sc: Sculpt, bone: number, at: V3[], len: number, seed: number): void {
  const r = stream(seed);
  for (const p of at) sc.detail(cyl(0.65, 0.3, len * (0.7 + r() * 0.6), 4), { col: r() < 0.5 ? 0x2e3a1e : 0x3a4424, bone, pos: [p[0], p[1] - len * 0.4, p[2]], rot: [(r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.5], surf: SURF.latex });
}

// ================================================================== the Drowned
function drownedBather(): SculptModel {
  const P = prop(1, { headR: 11.5, chestW: 12, waistW: 10.5, hipW: 10.5, arm: [3.6, 3.1, 2.6], leg: [4.6, 3.7, 3], depth: 0.78 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.85, 2.4);
  const suit = hoops(2.6);
  humanBody(sc, P, b, { skin: drownedSkin, torso: suit, hips: suit, upperArm: drownedSkin, foreArm: drownedSkin, hand: drownedSkin, thigh: suit, shin: drownedSkin, shoe: drownedSkin, torsoSurf: SURF.cloth, legSurf: SURF.skin });
  // the suit's shoulder straps over bare, bloated shoulders
  for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * 6, P.chest + 4, 8], b: [s * 7, P.shoulderY + 1.5, -6], ra: 1.4, rb: 1.4 }, { col: 0x23304a, bone: b('chest'), k: 0.6, surf: SURF.cloth });
  head(sc, P, b('head'), { skin: drownedSkin, nose: 0.7, ears: true, brow: 0.9, cheeks: 0.5, chin: 0.6, jaw: 1.05 });
  eyeDetails(sc, P, b('head'), { size: 0.17, sclera: 0x9fb0a0, iris: 0xd8f0d0, glow: 0.9, y: 0.12 });
  // the jaw hangs slack; inside, nothing but dark
  sc.add({ t: 'ell', c: [0, P.headY - P.headR * 0.5, P.headR * 0.86], r: [3.2, 2.6, 3] }, { sub: true, k: 1 });
  sc.detail(ellipsoid(2.8, 2.1, 1, 10, 8), { col: PAL.ink, bone: b('head'), pos: [0, P.headY - P.headR * 0.5, P.headR * 0.72], surf: SURF.rubber });
  // a cracked rubber bathing cap and its chin strap; wet hair escaping at the back
  sc.add({ t: 'ell', c: [0, P.headY + P.headR * 0.28, -P.headR * 0.06], r: [P.headR * 1.05, P.headR * 0.8, P.headR * 1.03] }, { col: weather(0xb0aa9a, 0.5, 0.15, 0x6a665a), bone: b('head'), k: 0.5, surf: SURF.latex });
  for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * P.headR * 0.95, P.headY - 1, 0], b: [s * 2, P.headY - P.headR * 0.95, P.headR * 0.45], ra: 0.7, rb: 0.6 }, { col: 0x8a8476, bone: b('head'), k: 0.3, surf: SURF.latex });
  for (let i = 0; i < 5; i++) sc.detail(cyl(0.9, 0.3, 14, 4), { col: 0x1a1c18, bone: b('head'), pos: [(i - 2) * 2.4, P.headY - P.headR * 0.5, -P.headR * 0.85], rot: [0.3, 0, (i - 2) * 0.12], surf: SURF.latex });
  // what the sea left on it: kelp over the shoulders, barnacles up one arm
  kelp(sc, b('chest'), [[5, P.shoulderY + 1, 6], [-7, P.shoulderY, 4], [8, P.shoulderY, -5], [-3, P.shoulderY + 1, -7]], 24, 11);
  kelp(sc, b('shinR'), [[-P.stance - 1, P.knee + 2, 2]], 12, 12);
  barnacles(sc, b('armL'), [P.shoulderX + 2, P.shoulderY - 4, 0], [2.5, 6, 3], 9, 1.3, 13);
  barnacles(sc, b('chest'), [-5, P.chest - 2, -8], [5, 5, 1], 6, 1.1, 14);
  const gait: Gait = { ...GAIT_WALK, stride: 0.42, knee: 0.55, bob: 2.8, sway: 0.22, twist: 0.14, arm: 0.12, elbow: 0.15, lean: 0.3, headBob: 0.08 };
  const reach: Pose = { armL: { rx: -1.15, rz: 0.15 }, armR: { rx: -1, rz: -0.12 }, foreL: { rx: -0.3 }, foreR: { rx: -0.45 } };
  const clips: Clips = {
    // a waterlogged lurch: one leg drags, the arms reach, the head lolls
    move: { frames: 32, fn: (t) => mix(gaitPose(t, gait), reach, { thighR: { rx: 0.15 * sin(t) }, shinR: { rx: 0.25 }, chest: { rx: 0.3, rz: 0.12 * sin(t) }, neck: { rx: 0.2 }, head: { rz: 0.3 * sin(t, 1, 0.2), rx: 0.15 } }) },
    // clawing up out of the sand: both arms over its head, hauling, the chest heaving
    rise: { frames: 24, loop: false, fn: (t) => {
      const k = ease(t), claw = sin(t, 3);
      return { armL: { rx: -2.6 + 1.2 * k + 0.4 * claw, rz: 0.3 }, armR: { rx: -2.6 + 1.2 * k - 0.4 * claw, rz: -0.3 }, foreL: { rx: -0.6 }, foreR: { rx: -0.6 }, chest: { rx: 0.55 - 0.3 * k }, head: { rx: -0.4 + 0.5 * k } };
    } },
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.7));
      return mix(reach, { armL: { rx: -0.5 * k, rz: 0.3 * k }, armR: { rx: -0.5 * k, rz: -0.3 * k }, chest: { rx: 0.3 * k } });
    } },
  };
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
}

// ================================================================== Shore Crawler
function shoreCrawler(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 13, 0] },
    { name: 'eyes', parent: 'body', head: [0, 20, 9] },
    { name: 'clawL', parent: 'body', head: [12, 14, 9] },
    { name: 'clawR', parent: 'body', head: [-12, 14, 9] },
    { name: 'pinchL', parent: 'clawL', head: [20, 18, 26] },
    { name: 'pinchR', parent: 'clawR', head: [-22, 18.5, 28] },
  ];
  const LEGS = 4;
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) for (let i = 0; i < LEGS; i++) bones.push({ name: `leg${n}${i}`, parent: 'body', head: [s * 13, 12, 5 - i * 5.2] });
  const b = bi(bones);
  const sc = new Sculpt(1.55, 1.6);
  const shell: ColorFn = (p) => {
    const c = C(0x6e2a20).lerp(C(0x2a1614), 0.25 + 0.5 * vnoise(p.x * 0.2, p.y * 0.2, p.z * 0.2));
    return vnoise(p.x * 1.1, p.y * 1.1, p.z * 1.1) > 0.78 ? c.lerp(C(0xb8a888), 0.6) : c;
  };
  const belly = weather(0xa89074, 0.4);
  sc.add({ t: 'ell', c: [0, 16, 0], r: [17, 7.5, 13.5] }, { col: shell, bone: b('body'), k: 0, surf: SURF.porcelain });
  sc.add({ t: 'ell', c: [0, 17, 10.5], r: [13, 4, 4] }, { col: shell, bone: b('body'), k: 3, surf: SURF.porcelain });
  sc.add({ t: 'ell', c: [0, 11.5, 0], r: [14, 4.5, 11] }, { col: belly, bone: b('body'), k: 4, surf: SURF.skin });
  // the spiked rim of the carapace
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + (i / 8) * 2.4;
    sc.detail(cone(1.3, 3.4, 5), { col: 0x4a1a14, bone: b('body'), pos: [Math.sin(a) * 17.5, 15.5, Math.cos(a) * 12.5], rot: [Math.PI / 2, 0, -a], surf: SURF.porcelain });
  }
  // eyes on stalks; the little working mouth
  for (const s of [1, -1]) {
    sc.detail(cyl(0.9, 0.8, 6, 6), { col: 0x5a2018, bone: b('eyes'), pos: [s * 3.6, 22.5, 10], rot: [0.2, 0, s * -0.15], surf: SURF.porcelain });
    glowEye(sc, b('eyes'), [s * 4, 26, 10.6], 1.6, 0xd8e04a, 1.6);
  }
  sc.add({ t: 'ell', c: [0, 13, 12.6], r: [4, 2.4, 1.6] }, { col: 0x2a1010, bone: b('body'), k: 1, surf: SURF.skin });
  // claws: the right one is the big one
  for (const [s, n, k] of [[1, 'L', 1], [-1, 'R', 1.3]] as const) {
    const cl = b(`claw${n}`), pi = b(`pinch${n}`);
    sc.add({ t: 'cap', a: [s * 12, 14, 9], b: [s * 18, 16.5, 17], ra: 3.2 * k, rb: 2.8 * k }, { col: shell, bone: cl, k: 1.5, surf: SURF.porcelain });
    sc.add({ t: 'ell', c: [s * (19 + 2 * (k - 1) * 3), 17, 23 + 3 * (k - 1)], r: [5.5 * k, 4.5 * k, 8 * k], rot: [0, -s * 0.2, 0] }, { col: shell, bone: cl, k: 2, surf: SURF.porcelain });
    const tip = 23 + 3 * (k - 1) + 7 * k;
    sc.add({ t: 'cap', a: [s * (20 + (k - 1) * 4), 15.5, tip - 2], b: [s * (19 + (k - 1) * 4), 15, tip + 5 * k], ra: 2.2 * k, rb: 0.7 }, { col: shell, bone: cl, k: 0.8, surf: SURF.porcelain });
    sc.add({ t: 'cap', a: [s * (20 + (k - 1) * 4), 19 + (k - 1) * 2, tip - 2], b: [s * (19 + (k - 1) * 4), 19.5 + (k - 1) * 2, tip + 4.5 * k], ra: 2 * k, rb: 0.6 }, { col: shell, bone: pi, k: 0.6, surf: SURF.porcelain });
  }
  // eight jointed legs, out to the sides and down to the sand
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    for (let i = 0; i < LEGS; i++) {
      const z = 5 - i * 5.2, splay = (i - 1.5) * 1.6, lb = b(`leg${n}${i}`);
      sc.add({ t: 'cap', a: [s * 13, 12, z], b: [s * 22, 17.5, z + splay], ra: 1.9, rb: 1.6 }, { col: shell, bone: lb, k: 0.8, surf: SURF.porcelain });
      sc.add({ t: 'cap', a: [s * 22, 17.5, z + splay], b: [s * 28, 0.6, z + splay * 1.8], ra: 1.5, rb: 0.5 }, { col: shell, bone: lb, k: 0.6, surf: SURF.porcelain });
    }
  }
  // what it's wearing: bottle caps pressed into the shell, and a pennant off the Sea Wheel
  const caps = [0xa82a20, 0xc8a040, 0x2a6a40, 0xd0d0c8, 0xa82a20];
  const at: [number, number][] = [[-6, 2], [5, -3], [9, 4], [-10, -5], [1, 6]];
  at.forEach(([x, z], i) => {
    const y = 16 + 7.5 * Math.sqrt(Math.max(0, 1 - (x / 17) ** 2 - (z / 13.5) ** 2)) - 0.2;
    sc.detail(cyl(2.3, 2.5, 0.9, 14), { col: caps[i], bone: b('body'), pos: [x, y, z], rot: [z * 0.05, 0, -x * 0.05], surf: SURF.brass });
  });
  sc.detail(cyl(0.35, 0.35, 15, 4), { col: PAL.woodPale, bone: b('body'), pos: [-6, 28, -5], surf: SURF.wood });
  sc.detail(cone(3, 10, 3), { col: 0xa8202a, bone: b('body'), pos: [-1.2, 32.5, -5], rot: [0, 0, -Math.PI / 2], scale: [1, 1, 0.18], surf: SURF.canvas, emit: 0.1 });
  barnacles(sc, b('body'), [3, 21, -6], [7, 1.5, 4], 7, 1.2, 21);
  const legs = (t: number, amp: number): Pose => {
    const o: Pose = {};
    for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) for (let i = 0; i < LEGS; i++) {
      const ph = i * 0.25 + (s > 0 ? 0 : 0.5);
      o[`leg${n}${i}`] = { rz: s * amp * 0.35 * sin(t, 2, ph), ry: 0.25 * amp * cos(t, 2, ph) };
    }
    return o;
  };
  const clips: Clips = {
    // the scuttle: legs rippling in waves, claws carried high and twitching
    move: { frames: 24, fn: (t) => mix(legs(t, 1), { body: { ty: 0.8 * Math.abs(sin(t, 2)), rz: 0.05 * sin(t, 2) }, clawL: { rx: -0.2 + 0.08 * sin(t, 2) }, clawR: { rx: -0.25 - 0.08 * sin(t, 2) }, pinchL: { rx: -0.25 * Math.max(0, sin(t, 4)) }, eyes: { rz: 0.15 * sin(t) } }) },
    // claws up, wide open, rearing
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.8));
      return mix(legs(t * 0.5, 0.4), { body: { rx: -0.2 * k, ty: 2 * k }, clawL: { rx: -0.9 * k, ry: 0.4 * k }, clawR: { rx: -0.9 * k, ry: -0.4 * k }, pinchL: { rx: -0.6 * k }, pinchR: { rx: -0.6 * k }, eyes: { ty: 1.5 * k } });
    } },
  };
  return { geo: sc.build({ ao: 0.45 }), rig: new Rig(bones, clips) };
}

// ================================================================== Ticket Taker
function ticketTaker(): SculptModel {
  const P = prop(1.03, { headR: 10.2, chestW: 11, waistW: 9, hipW: 9.5, arm: [3.2, 2.8, 2.3], leg: [4, 3.2, 2.7], stance: 6, depth: 0.72, neck: 65.5, headY: 76 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(1.75, 2);
  const greySkin = weather(0x9a9a8c, 0.4, 0.12, 0x6a6a60);
  const jacket = weather(0x5a1a22, 0.4, 0.08, 0x2a0e12);
  const trousers = weather(0x1c1618, 0.3);
  humanBody(sc, P, b, { skin: greySkin, torso: jacket, hips: jacket, upperArm: jacket, foreArm: jacket, hand: PAL.bone, thigh: trousers, shin: trousers, shoe: PAL.ink, torsoSurf: SURF.velvet, legSurf: SURF.cloth, gloves: true });
  // the cut of the jacket: tails behind, a high collar
  sc.add({ t: 'ell', c: [0, P.hip - 5, -5], r: [9.5, 9, 3.6] }, { col: jacket, bone: b('hips'), k: 3, surf: SURF.velvet });
  sc.add({ t: 'cap', a: [0, P.neck - 3, 0], b: [0, P.neck + 1, 0], ra: P.headR * 0.55, rb: P.headR * 0.5 }, { col: jacket, bone: b('chest'), k: 1, surf: SURF.velvet });
  // two rows of brass buttons, gold braid on the shoulders with a little fringe
  const front = P.chestW * P.depth + 0.6;
  for (const s of [1, -1]) {
    for (let i = 0; i < 4; i++) sc.detail(sphere(0.85, 8, 6), { col: PAL.gold, bone: b('chest'), pos: [s * 3.2, P.chest + 5 - i * 4.2, front - Math.abs(i - 1) * 0.4], surf: SURF.gold });
    sc.detail(ellipsoid(4, 1.4, 3.6, 10, 6), { col: PAL.gold, bone: b('chest'), pos: [s * P.shoulderX, P.shoulderY + 2, 0], surf: SURF.gold });
    for (let i = 0; i < 4; i++) sc.detail(cyl(0.3, 0.3, 3, 4), { col: PAL.gold, bone: b('chest'), pos: [s * (P.shoulderX + 3.2), P.shoulderY + 0.4, -1.5 + i], surf: SURF.gold });
  }
  // a long grey face fixed in a grin, with a pinprick of red in each eye
  head(sc, P, b('head'), { skin: greySkin, nose: 1.1, ears: true, brow: 1.1, cheeks: 0.4, chin: 1.2, jaw: 0.85 });
  eyeDetails(sc, P, b('head'), { size: 0.13, sclera: -1, iris: 0xff3b2a, glow: 1.4, y: 0.15 });
  sc.detail(ellipsoid(4.6, 1, 0.8, 12, 4), { col: PAL.ink, bone: b('head'), pos: [0, P.headY - P.headR * 0.48, P.headR * 0.88], surf: SURF.rubber });
  for (let i = 0; i < 8; i++) {
    const a = -0.75 + (i / 7) * 1.5;
    sc.detail(box(0.9, 1.4, 0.5), { col: PAL.bone, bone: b('head'), pos: [Math.sin(a) * 4.6, P.headY - P.headR * 0.46 + Math.abs(a) * 0.7, P.headR * 0.9 + Math.cos(a) * 0.2], surf: SURF.porcelain });
  }
  // the pillbox cap with its gold band, badge and chin strap
  const capY = P.headY + P.headR * 0.95;
  sc.detail(cyl(5.4, 5.8, 5.5, 16), { col: 0x5a1a22, bone: b('head'), pos: [0.4, capY, 0.6], rot: [0.12, 0, 0.06], surf: SURF.velvet });
  sc.detail(torus(5.75, 0.55, 6, 18), { col: PAL.gold, bone: b('head'), pos: [0.4, capY - 2.3, 0.6], rot: [Math.PI / 2 + 0.12, 0, 0.06], surf: SURF.gold });
  sc.detail(box(2.2, 2.2, 0.5), { col: PAL.gold, bone: b('head'), pos: [0.4, capY, 6.1], rot: [0.12, 0, 0.78], surf: SURF.gold });
  for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * P.headR * 0.92, P.headY + 1, 0.5], b: [s * 2.2, P.headY - P.headR * 0.98, P.headR * 0.45], ra: 0.5, rb: 0.45 }, { col: PAL.ink, bone: b('head'), k: 0.2, surf: SURF.rubber });
  // the punch in its right hand, a stack of stubs in its left, a roll of tickets on its belt
  const hx = P.shoulderX + P.armOut * 1.6;
  sc.detail(box(1.8, 7.5, 2.6), { col: PAL.brass, bone: b('handR'), pos: [-hx, P.wristY - 6, 3], rot: [0.3, 0, 0], surf: SURF.brass });
  sc.detail(box(1.6, 2.6, 4), { col: PAL.brass, bone: b('handR'), pos: [-hx, P.wristY - 10.5, 4.6], rot: [0.3, 0, 0], surf: SURF.brass });
  sc.detail(box(4, 0.9, 6), { col: PAL.cream, bone: b('handL'), pos: [hx, P.wristY - 5, 3], rot: [0.4, 0, 0.1], surf: SURF.paint });
  sc.detail(box(4.1, 0.25, 6.1), { col: 0xa8202a, bone: b('handL'), pos: [hx, P.wristY - 4.4, 3], rot: [0.4, 0, 0.1], surf: SURF.paint });
  sc.detail(cyl(3.2, 3.2, 2.6, 14), { col: 0xc84a3a, bone: b('hips'), pos: [8, P.hip + 1, 5.5], rot: [0, 0, Math.PI / 2], surf: SURF.paint });
  sc.detail(box(2.4, 9, 0.3), { col: 0xc84a3a, bone: b('hips'), pos: [9.3, P.hip - 4, 7.2], rot: [0.1, 0, 0], surf: SURF.paint });
  const gait: Gait = { ...GAIT_WALK, stride: 0.5, knee: 0.6, bob: 1.2, twist: 0.06, arm: 0.22, elbow: 0.2, lean: -0.04, sway: 0.03, headBob: 0.02 };
  const clips: Clips = {
    // a stiff on-duty march, head cocked, the punch held ready
    move: { frames: 30, fn: (t) => mix(gaitPose(t, gait), { head: { rz: 0.2, ry: 0.15 * sin(t) }, foreR: { rx: -0.6 } }) },
    // the punch goes up over its head — and flicks a stub at you
    attack: { frames: 16, loop: false, fn: (t) => {
      const up = ease(Math.min(1, t / 0.75)), flick = pulse(t, 0.88, 0.12);
      return { armR: { rx: -2.5 * up + 2.2 * flick, rz: -0.2 }, foreR: { rx: -0.8 * up }, chest: { ry: -0.35 * up + 0.6 * flick }, head: { rz: 0.2, rx: -0.15 * up } };
    } },
  };
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
}

// ================================================================== Taffy Horror
function taffyHorror(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'base', parent: null, head: [0, 8, 0] },
    { name: 'mid', parent: 'base', head: [0, 20, 0] },
    { name: 'top', parent: 'mid', head: [0, 32, 0] },
    { name: 'armL', parent: 'mid', head: [12, 24, 3] },
    { name: 'armR', parent: 'mid', head: [-12, 24, 3] },
    { name: 'jaw', parent: 'mid', head: [0, 16, 11] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1.75, 3);
  // pulled saltwater taffy: pink and cream twisting round it, a thin mint line between, gone grey with dust
  const pink = weather(0xc77a8a, 0.35, 0.1), cream = weather(0xe0d2b4, 0.35, 0.1), mint = weather(0x7ab8a0, 0.3);
  const twist: ColorFn = (p, n) => {
    const a = Math.atan2(p.z, p.x) / TAU + p.y * 0.035;
    const band = (((a * 5) % 1) + 1) % 1;
    return band < 0.44 ? pink(p, n) : band < 0.5 ? mint(p, n) : cream(p, n);
  };
  sc.add({ t: 'ell', c: [0, 9, 0], r: [18, 9.5, 16] }, { col: twist, bone: b('base'), k: 0, surf: SURF.latex });
  sc.add({ t: 'ell', c: [0, 2, 0], r: [21, 2.4, 19] }, { col: twist, bone: b('base'), k: 4, surf: SURF.latex });
  sc.add({ t: 'ell', c: [0, 21, 1], r: [14, 11, 12.5] }, { col: twist, bone: b('mid'), k: 7, surf: SURF.latex });
  sc.add({ t: 'ell', c: [1, 32, 0], r: [10, 8, 9.5] }, { col: twist, bone: b('top'), k: 6, surf: SURF.latex });
  sc.add({ t: 'ell', c: [-6, 29, 6], r: [6, 7, 6] }, { col: twist, bone: b('top'), k: 4, surf: SURF.latex });
  // strands pulled down to the boards, still stretching
  for (const [a, c] of [[[10, 22, 6], [16, 2.5, 11]], [[-9, 26, -7], [-17, 2, -10]], [[4, 18, -11], [7, 2, -18]]] as [V3, V3][]) {
    sc.add({ t: 'cap', a, b: c, ra: 2.4, rb: 1.1 }, { col: twist, bone: b('base'), k: 2, surf: SURF.latex });
  }
  // two arms like pulls of taffy; the right one does the lashing
  sc.add({ t: 'cap', a: [12, 24, 3], b: [24, 20, 12], ra: 4.5, rb: 3 }, { col: twist, bone: b('armL'), k: 3, surf: SURF.latex });
  sc.add({ t: 'ell', c: [26, 18, 14], r: [3.5, 4.5, 3.5] }, { col: twist, bone: b('armL'), k: 2, surf: SURF.latex });
  sc.add({ t: 'cap', a: [-12, 24, 3], b: [-27, 22, 12], ra: 4.6, rb: 2.8 }, { col: twist, bone: b('armR'), k: 3, surf: SURF.latex });
  sc.add({ t: 'ell', c: [-29, 21, 14], r: [3.4, 3.8, 3.4] }, { col: twist, bone: b('armR'), k: 2, surf: SURF.latex });
  // the mouth, toothed with sugar crystals
  sc.add({ t: 'ell', c: [0, 17, 12.6], r: [7, 3, 4] }, { sub: true, k: 1.5 });
  sc.detail(ellipsoid(6.2, 2.4, 1.2, 12, 6), { col: 0x2a0a12, bone: b('mid'), pos: [0, 17, 10.6], surf: SURF.rubber });
  for (let i = 0; i < 7; i++) {
    const x = -5.4 + i * 1.8;
    sc.detail(box(1.3, 2, 1.1), { col: 0xf0ece0, bone: b('mid'), pos: [x, 19.2, 12.4 - Math.abs(x) * 0.12], rot: [0, 0, (i % 2 ? 0.2 : -0.15)], surf: SURF.glass });
    if (i % 2 === 0) sc.detail(box(1.2, 1.8, 1), { col: 0xf0ece0, bone: b('jaw'), pos: [x + 0.6, 15, 12.3 - Math.abs(x) * 0.12], rot: [0, 0, 0.25], surf: SURF.glass });
  }
  // glossy gumdrop eyes, one sagging
  for (const [x, y] of [[5, 25.5], [-5.5, 24]] as [number, number][]) {
    sc.detail(sphere(2.5, 10, 8), { col: 0x1a0a10, bone: b('mid'), pos: [x, y, 11.6], surf: SURF.glass });
    glowEye(sc, b('mid'), [x * 1.04, y + 0.3, 13.6], 0.75, 0xff8ab0, 1.2);
  }
  // the wax-paper wrapper it tore its way out of, twisted shut at the top; the pulling hook still in it
  sc.detail(cone(4.6, 7, 8), { col: 0xe8e0c8, bone: b('top'), pos: [0.5, 40.5, 0], rot: [0, 0.4, 0], surf: SURF.canvas });
  sc.detail(cone(4.6, 7, 8), { col: 0xe8e0c8, bone: b('top'), pos: [0.5, 47, 0], rot: [Math.PI, 0, 0], surf: SURF.canvas });
  sc.detail(box(9, 7, 0.3), { col: 0xd8ceb0, bone: b('base'), pos: [13, 10, 8], rot: [0.3, 0.9, 0.4], surf: SURF.canvas });
  sc.detail(torus(4, 0.8, 6, 12, Math.PI * 1.2), { col: PAL.iron, bone: b('top'), pos: [6, 38, -2], rot: [0, 0.5, 2.2], surf: SURF.iron });
  sc.detail(cyl(0.8, 0.8, 9, 6), { col: PAL.iron, bone: b('top'), pos: [3.5, 35, -2], rot: [0, 0, 0.5], surf: SURF.iron });
  // wrapped candies stuck in it
  for (const [p, c] of [[[11, 13, 10], 0x3a7ab0], [[-12, 18, 7], 0xd8b040], [[-4, 31, 8], 0x9a3a8a]] as [V3, number][]) {
    sc.detail(ellipsoid(1.8, 1.4, 1.4, 8, 6), { col: c, bone: b('mid'), pos: p, surf: SURF.glass });
    for (const s of [1, -1]) sc.detail(cone(1.2, 1.8, 5), { col: c, bone: b('mid'), pos: [p[0] + s * 2.2, p[1], p[2]], rot: [0, 0, s * Math.PI / 2], surf: SURF.glass });
  }
  const clips: Clips = {
    // oozing forward: the base spreads and gathers, the top lags behind it, the arms droop and swing
    move: { frames: 30, fn: (t) => ({ base: { sx: 1 + 0.06 * sin(t), sz: 1 - 0.05 * sin(t), sy: 1 - 0.05 * sin(t, 1, 0.25) }, mid: { tx: 1.5 * sin(t, 1, 0.1), rz: 0.08 * sin(t, 1, 0.1), sy: 1 + 0.06 * sin(t, 1, 0.3) }, top: { tx: 1.2 * sin(t, 1, 0.25), rz: 0.12 * sin(t, 1, 0.3) }, armL: { rz: -0.25 + 0.2 * sin(t, 1, 0.4), rx: 0.1 * sin(t) }, armR: { rz: 0.25 - 0.2 * sin(t, 1, 0.6), rx: -0.1 * sin(t) }, jaw: { rx: 0.12 * Math.abs(sin(t, 2)) } }) },
    // draws the right arm back, stretching it thin, mouth opening
    attack: { frames: 18, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.85));
      return { mid: { rx: -0.25 * k, sy: 1 + 0.12 * k }, top: { rx: -0.2 * k }, armR: { ry: -1 * k, sx: 1 + 0.35 * k, rz: 0.2 * k }, armL: { rz: -0.4 * k }, jaw: { rx: 0.4 * k } };
    } },
    // the lash: flung out long, then sagging back
    lash: { frames: 12, loop: false, fn: (t) => {
      const k = 1 - ease(t);
      return { mid: { rx: 0.25 * k }, armR: { ry: 0.7 * k, sx: 1 + 0.8 * k }, jaw: { rx: 0.3 * k } };
    } },
  };
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
}

// ================================================================== Arcade Automaton
function arcadeAutomaton(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'hips', parent: null, head: [0, 30, 0] },
    { name: 'cab', parent: 'hips', head: [0, 34, 0] },
    { name: 'head', parent: 'cab', head: [0, 64, 7] },
    { name: 'crank', parent: 'cab', head: [-16.5, 52, 0] },
  ];
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    bones.push({ name: `thigh${n}`, parent: 'hips', head: [s * 7, 30, 0] }, { name: `shin${n}`, parent: `thigh${n}`, head: [s * 7.5, 16, 1] }, { name: `foot${n}`, parent: `shin${n}`, head: [s * 7.5, 2.5, 0] });
  }
  const b = bi(bones);
  const sc = new Sculpt(1.75, 1.2);
  const wood = weather(0x4a2618, 0.4, 0.07, 0x2a140c);
  const brass = weather(0x9a7a3c, 0.45, 0.1, 0x4a6a50);
  // the cabinet: mahogany on a plinth, a crest on top, the window cut into its face
  sc.add({ t: 'box', c: [0, 58, 0], h: [15, 24, 11], r: 2.2, tx: 0.04 }, { col: wood, bone: b('cab'), k: 0, surf: SURF.wood });
  sc.add({ t: 'box', c: [0, 35.5, 0], h: [16.5, 2.8, 12.5], r: 1.2 }, { col: weather(0x2e160e, 0.3), bone: b('cab'), k: 1, surf: SURF.wood });
  sc.add({ t: 'box', c: [0, 83.5, 0], h: [16, 2, 12], r: 1 }, { col: wood, bone: b('cab'), k: 1, surf: SURF.wood });
  sc.add({ t: 'ell', c: [0, 86.5, 0], r: [12, 6, 3.6] }, { col: wood, bone: b('cab'), k: 1, surf: SURF.wood });
  sc.add({ t: 'box', c: [0, 66, 11], h: [10.5, 9.5, 5], r: 1.4 }, { sub: true, k: 0.8 });
  sc.add({ t: 'box', c: [0, 41, 11], h: [5, 2, 3], r: 0.8 }, { sub: true, k: 0.6 });
  // the figure in the window: a laughing sailor, porcelain face, collar and cap
  const face = weather(0xe0cbb0, 0.3, 0.2);
  sc.add({ t: 'ell', c: [0, 68, 7.5], r: [5, 5.8, 4.6] }, { col: face, bone: b('head'), k: 0, surf: SURF.porcelain });
  sc.add({ t: 'ell', c: [0, 64.5, 8.6], r: [3.6, 2.6, 3.2] }, { col: face, bone: b('head'), k: 1.5, surf: SURF.porcelain });
  sc.detail(ellipsoid(8, 3.4, 3.2, 12, 8), { col: 0x1f2a4a, bone: b('cab'), pos: [0, 60.5, 7.5], surf: SURF.cloth });
  sc.detail(box(16, 0.6, 0.4), { col: PAL.bone, bone: b('cab'), pos: [0, 62.4, 10.4], surf: SURF.cloth });
  sc.detail(cyl(4.2, 4.6, 2.4, 14), { col: PAL.bone, bone: b('head'), pos: [0, 73.6, 7.2], rot: [-0.15, 0, 0.12], surf: SURF.cloth });
  for (const s of [1, -1]) {
    sc.detail(sphere(0.9, 8, 6), { col: PAL.ink, bone: b('head'), pos: [s * 1.9, 69.4, 11.7], surf: SURF.glass });
    sc.detail(sphere(1.2, 8, 6), { col: 0xc0605a, bone: b('head'), pos: [s * 3, 66.6, 11.2], surf: SURF.paint });
  }
  sc.detail(ellipsoid(3, 1.6, 0.8, 10, 6), { col: 0x3a0a0a, bone: b('head'), pos: [0, 64.6, 11.6], surf: SURF.rubber });
  for (let i = 0; i < 5; i++) sc.detail(box(0.8, 0.8, 0.4), { col: PAL.bone, bone: b('head'), pos: [-1.6 + i * 0.8, 65.6, 11.8], surf: SURF.porcelain });
  sc.detail(box(21, 19, 1), { col: 0x2a1020, bone: b('cab'), pos: [0, 66, 6.3], surf: SURF.velvet });
  // the brass frame round the window, two glints across the glass, a crack
  for (const [p, s] of [[[0, 76, 11.4], [23, 1.4, 1]], [[0, 56, 11.4], [23, 1.4, 1]], [[11.2, 66, 11.4], [1.4, 21, 1]], [[-11.2, 66, 11.4], [1.4, 21, 1]]] as [V3, V3][]) {
    sc.detail(box(s[0], s[1], s[2]), { col: PAL.brass, bone: b('cab'), pos: p, surf: SURF.brass });
  }
  sc.detail(box(0.45, 17, 0.2), { col: 0xcfefff, bone: b('cab'), pos: [4, 66, 11.6], rot: [0, 0, 0.45], emit: 1.1, surf: SURF.glass });
  sc.detail(box(0.3, 9, 0.2), { col: 0xcfefff, bone: b('cab'), pos: [7.5, 67, 11.6], rot: [0, 0, 0.45], emit: 0.8, surf: SURF.glass });
  sc.detail(box(0.25, 10, 0.2), { col: 0x9ab0b8, bone: b('cab'), pos: [-5, 70, 11.6], rot: [0, 0, -0.9], emit: 0.4, surf: SURF.glass });
  // the sign band, the coin plate and slot, the token chute's brass lip, marquee bulbs on the crest
  sc.detail(box(26, 5, 0.5), { col: 0x7a2418, bone: b('cab'), pos: [0, 79.5, 11.3], surf: SURF.paint });
  sc.detail(box(27, 0.6, 0.6), { col: PAL.gold, bone: b('cab'), pos: [0, 82.2, 11.4], surf: SURF.gold });
  sc.detail(box(27, 0.6, 0.6), { col: PAL.gold, bone: b('cab'), pos: [0, 76.9, 11.4], surf: SURF.gold });
  sc.detail(box(5, 7, 0.8), { col: PAL.brass, bone: b('cab'), pos: [0, 48, 11.4], surf: SURF.brass });
  sc.detail(box(0.6, 3, 0.4), { col: PAL.ink, bone: b('cab'), pos: [0, 49, 11.9], surf: SURF.rubber });
  sc.detail(box(11, 1.2, 2), { col: PAL.brass, bone: b('cab'), pos: [0, 38.6, 12], surf: SURF.brass });
  for (let i = 0; i < 7; i++) {
    const a = -1.2 + (i / 6) * 2.4;
    sc.detail(sphere(1.05, 8, 6), { col: i % 2 ? 0xffd27a : 0xff8a4a, bone: b('cab'), pos: [Math.sin(a) * 11.5, 86.5 + Math.cos(a) * 5.6, 3.6], emit: 1.8, surf: SURF.bulb });
  }
  // the crank on its side
  sc.detail(cyl(1.1, 1.1, 4, 8), { col: PAL.brass, bone: b('crank'), pos: [-17.5, 52, 0], rot: [0, 0, Math.PI / 2], surf: SURF.brass });
  sc.detail(box(1.2, 8, 1.4), { col: PAL.brass, bone: b('crank'), pos: [-19.6, 48.5, 0], surf: SURF.brass });
  sc.detail(cyl(1.1, 1.1, 4.5, 8), { col: PAL.woodDark, bone: b('crank'), pos: [-21.8, 45, 0], rot: [0, 0, Math.PI / 2], surf: SURF.wood });
  // brass legs with iron knees and flat iron feet
  sc.add({ t: 'box', c: [0, 31, 0], h: [10, 3, 7], r: 1.2 }, { col: PAL.iron, bone: b('hips'), k: 0.8, surf: SURF.iron });
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    sc.add({ t: 'cap', a: [s * 7, 30, 0], b: [s * 7.5, 16, 1], ra: 2.6, rb: 2.2 }, { col: brass, bone: b(`thigh${n}`), k: 0.8, surf: SURF.brass });
    sc.add({ t: 'sph', c: [s * 7.5, 16, 1], r: 3 }, { col: PAL.iron, bone: b(`shin${n}`), k: 0.4, surf: SURF.iron });
    sc.add({ t: 'cap', a: [s * 7.5, 16, 1], b: [s * 7.5, 3, 0], ra: 2.1, rb: 1.8 }, { col: brass, bone: b(`shin${n}`), k: 0.6, surf: SURF.brass });
    sc.add({ t: 'box', c: [s * 7.5, 1.6, 3], h: [3.6, 1.6, 5.5], r: 0.8 }, { col: PAL.iron, bone: b(`foot${n}`), k: 0.6, surf: SURF.iron });
  }
  const step = (t: number): Pose => {
    const s = snap(t, 4);
    return { thighL: { rx: 0.45 * sin(s) }, thighR: { rx: -0.45 * sin(s) }, shinL: { rx: 0.4 * Math.max(0, -sin(s)) }, shinR: { rx: 0.4 * Math.max(0, sin(s)) }, hips: { ty: 1.2 * Math.abs(sin(s, 2)) } };
  };
  const clips: Clips = {
    // clockwork: a step, a halt, a step; the cabinet rocks and the sailor turns his head in jerks
    move: { frames: 32, fn: (t) => mix(step(t), { cab: { rz: 0.1 * sin(snap(t, 4)), rx: 0.04 }, head: { ry: 0.35 * sin(snap(t, 2)), rz: 0.15 * sin(snap(t, 4)) }, crank: { rx: snap(t, 8) * TAU } }) },
    // the crank spins up, the sailor throws back his head laughing, and the cabinet bucks as it fires
    attack: { frames: 18, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.85)), fire = pulse(t, 0.93, 0.07);
      return { crank: { rx: t * TAU * 3 }, cab: { rx: -0.12 * k + 0.25 * fire, sy: 1 - 0.03 * k }, head: { rx: -0.35 * k * (0.7 + 0.3 * Math.sin(t * 40)) } };
    } },
  };
  return { geo: sc.build({ ao: 0.45 }), rig: new Rig(bones, clips) };
}

// ================================================================== Coaster Wraith
function coasterWraith(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'car', parent: null, head: [0, 10, 0] },
    { name: 'rider', parent: 'car', head: [0, 24, -4] },
    { name: 'head', parent: 'rider', head: [0, 46, -4] },
    { name: 'hair', parent: 'head', head: [0, 54, -9] },
    { name: 'armL', parent: 'rider', head: [8, 41, -4] },
    { name: 'armR', parent: 'rider', head: [-8, 41, -4] },
    { name: 'foreL', parent: 'armL', head: [14, 54, -3] },
    { name: 'foreR', parent: 'armR', head: [-14, 54, -3] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1.65, 2);
  const paint = weather(0x5a1414, 0.45, 0.08, 0x2a1a14);
  // the front car of the Undertow: a rounded tub, a grinning face painted on its nose, gold trim
  sc.add({ t: 'box', c: [0, 13, 0], h: [14, 7.5, 20], r: 4 }, { col: paint, bone: b('car'), k: 0, surf: SURF.paint });
  sc.add({ t: 'ell', c: [0, 15, 17], r: [13, 9, 7] }, { col: paint, bone: b('car'), k: 3, surf: SURF.paint });
  sc.add({ t: 'box', c: [0, 19.5, -3], h: [10.5, 6, 12.5], r: 2.5 }, { sub: true, k: 1 });
  sc.add({ t: 'box', c: [0, 6, 0], h: [11, 2.4, 16], r: 1 }, { col: PAL.iron, bone: b('car'), k: 1, surf: SURF.iron });
  for (const s of [1, -1]) {
    sc.detail(box(0.6, 0.8, 38), { col: PAL.gold, bone: b('car'), pos: [s * 14.2, 18.6, 0], surf: SURF.gold });
    for (const z of [12, -12]) sc.detail(cyl(3.2, 3.2, 2.5, 12), { col: PAL.iron, bone: b('car'), pos: [s * 13.5, 5, z], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
    // the painted eyes, cream with black pupils, staring
    sc.detail(ellipsoid(3.2, 2.6, 0.6, 12, 8), { col: PAL.cream, bone: b('car'), pos: [s * 5.5, 18, 23.6], rot: [-0.25, s * 0.25, 0], surf: SURF.paint });
    sc.detail(sphere(1.3, 8, 6), { col: PAL.ink, bone: b('car'), pos: [s * 5.2, 17.6, 24.2], surf: SURF.paint });
  }
  sc.detail(ellipsoid(9, 2.4, 0.6, 14, 6), { col: 0x1a0606, bone: b('car'), pos: [0, 11.5, 23.8], rot: [-0.2, 0, 0], surf: SURF.paint });
  for (let i = 0; i < 9; i++) sc.detail(box(1.3, 1.6, 0.4), { col: PAL.cream, bone: b('car'), pos: [-7.2 + i * 1.8, 12.6 - Math.abs(i - 4) * 0.25, 24.2], surf: SURF.paint });
  sc.detail(torus(8, 1, 6, 16, Math.PI), { col: PAL.gold, bone: b('car'), pos: [0, 19, 4], surf: SURF.gold });
  // the rider: a pale shape the light goes into, arms flung up, head back, screaming
  const ghost: ColorFn = (p) => C(0xd0e8f0).lerp(C(0x6a90a0), 0.25 + 0.45 * vnoise(p.x * 0.18, p.y * 0.18, p.z * 0.18));
  const G = { col: ghost, surf: SURF.glass, emit: 0.55 };
  sc.add({ t: 'cap', a: [0, 21, -4], b: [0, 39, -4], ra: 6, rb: 7, sz: 0.7 }, { ...G, bone: b('rider'), k: 1 });
  sc.add({ t: 'ell', c: [0, 40, -4], r: [9, 3.5, 4.5] }, { ...G, bone: b('rider'), k: 3 });
  sc.add({ t: 'cap', a: [0, 41, -4], b: [0, 45, -4.5], ra: 2.6, rb: 2.4 }, { ...G, bone: b('head'), k: 1.5 });
  sc.add({ t: 'ell', c: [0, 49, -4], r: [6, 7, 6] }, { ...G, bone: b('head'), k: 2 });
  sc.add({ t: 'ell', c: [0, 43.6, -1.6], r: [4, 3.6, 4] }, { ...G, bone: b('head'), k: 2 });
  sc.add({ t: 'ell', c: [0, 44.6, 1.6], r: [2.5, 3.6, 2.6] }, { sub: true, k: 0.8 });
  for (const s of [1, -1]) sc.add({ t: 'sph', c: [s * 2.2, 50.4, 1.2], r: 1.6 }, { sub: true, k: 0.6 });
  sc.detail(ellipsoid(2, 3, 1, 10, 8), { col: 0x0a1418, bone: b('head'), pos: [0, 44.6, 0.4], surf: SURF.rubber });
  for (const s of [1, -1]) glowEye(sc, b('head'), [s * 2.2, 50.2, 0.3], 0.75, 0x9ff8ff, 2.4);
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    sc.add({ t: 'cap', a: [s * 8, 41, -4], b: [s * 14, 54, -3], ra: 2.2, rb: 1.8 }, { ...G, bone: b(`arm${n}`), k: 1.2 });
    sc.add({ t: 'cap', a: [s * 14, 54, -3], b: [s * 17, 66, -2], ra: 1.8, rb: 1.3 }, { ...G, bone: b(`fore${n}`), k: 1 });
    for (let f = 0; f < 3; f++) sc.add({ t: 'cap', a: [s * 17, 66, -2], b: [s * (17 + (f - 1) * 1.6 + s * 0.8), 72.5, -2 + (f - 1) * 0.8], ra: 0.7, rb: 0.35 }, { ...G, bone: b(`fore${n}`), k: 0.5 });
    // rags of a sleeve, streaming
    sc.detail(cone(1.4, 7, 4), { col: 0x9ab8c4, bone: b(`fore${n}`), pos: [s * 15, 57, -6], rot: [-1.2, 0, 0], emit: 0.4, surf: SURF.cloth });
  }
  // hair streaming back off its skull
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 1.8;
    sc.add({ t: 'cap', a: [x, 53, -7], b: [x * 1.5, 49 + (i % 2) * 3, -24 - (i % 3) * 3], ra: 1.5, rb: 0.35 }, { col: 0xb8d0d8, surf: SURF.cloth, emit: 0.35, bone: b('hair'), k: 0.8 });
  }
  const clips: Clips = {
    // rocking in its car as it drifts after you, arms waving overhead, hair lifting
    move: { frames: 30, fn: (t) => ({ car: { ty: 1.6 * sin(t, 2), rx: 0.05 * sin(t, 1, 0.2), rz: 0.04 * sin(t) }, rider: { rz: 0.06 * sin(t, 1, 0.3), rx: -0.1 }, armL: { rz: 0.25 * sin(t, 2), rx: 0.1 * sin(t) }, armR: { rz: -0.25 * sin(t, 2, 0.3), rx: -0.1 * sin(t) }, head: { rx: -0.35 + 0.1 * sin(t, 2), rz: 0.15 * sin(t) }, hair: { rx: 0.15 * sin(t, 3), ry: 0.15 * sin(t, 2) } }) },
    // the rail lays itself down: it grips the bar and leans in, glaring down the track
    attack: { frames: 16, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.6));
      return { rider: { rx: 0.5 * k }, armL: { rx: 2.4 * k, rz: -0.3 * k }, armR: { rx: 2.4 * k, rz: 0.3 * k }, foreL: { rx: 0.6 * k }, foreR: { rx: 0.6 * k }, head: { rx: 0.35 * k }, car: { sy: 1 - 0.06 * k } };
    } },
    // riding it: arms flung wide, head back, hair streaming straight out
    charge: { frames: 16, fn: (t) => ({ car: { rx: -0.08, ty: 0.8 * sin(t, 4) }, rider: { rx: -0.25 }, armL: { rz: -0.35 + 0.08 * sin(t, 4) }, armR: { rz: 0.35 - 0.08 * sin(t, 4) }, head: { rx: -0.6 }, hair: { rx: 0.2 + 0.12 * sin(t, 6) } }) },
  };
  return { geo: sc.build({ ao: 0.4 }), rig: new Rig(bones, clips) };
}

// ================================================================== Barnacle Brute (and the Great Barnacle)
function barnacleBrute(k: number): SculptModel {
  const K = 1.22 * k;
  const Q = (v: number) => v * K;
  const P = prop(K, { hip: 34, knee: 18, stance: 9, waist: 43, chest: 53, shoulderY: 60, shoulderX: 15.5, elbowY: 44, wristY: 31, armOut: 3.5, neck: 62, headY: 70, headR: 9.5, leg: [6.5, 5.5, 4.8], arm: [6, 5.6, 5.2], hipW: 13, waistW: 13.5, chestW: 16.5, depth: 0.95 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(2.1 * Math.max(1, k * 1.3), 2.5 * K);
  const flesh: ColorFn = (p) => {
    const c = C(0x4a5a5a).lerp(C(0x22302e), 0.3 + 0.4 * vnoise(p.x * 0.12 / K, p.y * 0.12 / K, p.z * 0.12 / K));
    return vnoise(p.x * 0.35 / K, p.y * 0.35 / K, p.z * 0.35 / K) > 0.66 ? c.lerp(C(0xb0a890), 0.7) : c;
  };
  // what's left of a canvas diving suit, rotted through to the barnacled flesh
  const canvas = weather(0x6a5a40, 0.5, 0.08 / K, 0x3a3020);
  const rotten: ColorFn = (p, n) => (vnoise(p.x * 0.16 / K, p.y * 0.16 / K, p.z * 0.16 / K) > 0.55 ? flesh(p, n) : canvas(p, n));
  humanBody(sc, P, b, { skin: flesh, torso: rotten, hips: canvas, upperArm: rotten, foreArm: flesh, hand: flesh, thigh: canvas, shin: canvas, shoe: 0x2a2a2e, torsoSurf: SURF.canvas, legSurf: SURF.canvas, bigShoes: 1.35 });
  // the crust grown over its back and shoulders, ridged down the spine
  sc.add({ t: 'ell', c: [0, Q(55), -Q(6)], r: [Q(17), Q(13), Q(10)] }, { col: crust, bone: b('chest'), k: Q(3), surf: SURF.bone });
  for (let i = 0; i < 3; i++) sc.add({ t: 'ell', c: [0, Q(64 - i * 7), -Q(14.5 - i * 0.5)], r: [Q(5), Q(4), Q(3)] }, { col: crust, bone: b('chest'), k: Q(2), surf: SURF.bone });
  // the brass breastplate and collar; the helmet with its front port, side ports, bolts
  const brass = weather(0x8a6a34, 0.5, 0.12 / K, 0x3f6a5a);
  sc.add({ t: 'ell', c: [0, P.shoulderY - Q(1), Q(1)], r: [Q(14), Q(5), Q(10)] }, { col: brass, bone: b('chest'), k: Q(2), surf: SURF.brass });
  sc.add({ t: 'sph', c: [0, P.headY + Q(1), 0], r: Q(11.5) }, { col: brass, bone: b('head'), k: Q(1), surf: SURF.brass });
  const hy = P.headY + Q(1);
  sc.detail(torus(Q(4.4), Q(0.9), 6, 18), { col: 0x6a5a30, bone: b('head'), pos: [0, hy, Q(10.8)], surf: SURF.brass });
  sc.detail(cyl(Q(3.6), Q(3.6), Q(0.6), 16), { col: 0x2a5a44, bone: b('head'), pos: [0, hy, Q(10.9)], rot: [Math.PI / 2, 0, 0], emit: 0.7, surf: SURF.glass });
  for (const s of [1, -1]) {
    glowEye(sc, b('head'), [s * Q(1.3), hy + Q(0.4), Q(11.2)], Q(0.7), 0x9fffc0, 2);
    sc.detail(torus(Q(2.6), Q(0.7), 6, 14), { col: 0x6a5a30, bone: b('head'), pos: [s * Q(10.8), hy, 0], rot: [0, Math.PI / 2, 0], surf: SURF.brass });
    sc.detail(cyl(Q(2), Q(2), Q(0.5), 12), { col: 0x1a3028, bone: b('head'), pos: [s * Q(11), hy, 0], rot: [0, 0, Math.PI / 2], emit: 0.3, surf: SURF.glass });
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    sc.detail(sphere(Q(0.7), 6, 4), { col: 0x6a5a30, bone: b('chest'), pos: [Math.cos(a) * Q(9.5), P.neck + Q(1.4), Math.sin(a) * Q(8.5)], surf: SURF.brass });
  }
  // the broken air hose trailing from the back of the helmet
  sc.add({ t: 'cap', a: [0, hy - Q(2), -Q(10)], b: [Q(4), P.chest + Q(2), -Q(17)], ra: Q(1.6), rb: Q(1.6) }, { col: 0x2a2624, bone: b('chest'), k: Q(1), surf: SURF.rubber });
  sc.add({ t: 'cap', a: [Q(4), P.chest + Q(2), -Q(17)], b: [Q(7), P.waist - Q(4), -Q(15)], ra: Q(1.6), rb: Q(1.4) }, { col: 0x2a2624, bone: b('chest'), k: Q(0.8), surf: SURF.rubber });
  // the right fist has become a club of barnacle rock
  const hx = P.shoulderX + P.armOut * 1.6;
  sc.add({ t: 'ell', c: [-hx, P.wristY - Q(5), Q(1)], r: [Q(8), Q(9), Q(8)] }, { col: crust, bone: b('handR'), k: Q(2), surf: SURF.bone });
  // the reef: barnacles and mussels everywhere, a starfish on the shoulder, kelp hanging
  barnacles(sc, b('chest'), [0, Q(58), -Q(10)], [Q(14), Q(10), Q(5)], 26, Q(1.6), 31);
  barnacles(sc, b('armL'), [P.shoulderX + Q(2), P.shoulderY - Q(6), 0], [Q(3), Q(7), Q(4)], 9, Q(1.4), 32);
  barnacles(sc, b('handR'), [-hx, P.wristY - Q(5), Q(1)], [Q(7), Q(8), Q(7)], 14, Q(1.5), 33);
  barnacles(sc, b('head'), [0, hy + Q(7), -Q(3)], [Q(7), Q(3), Q(6)], 8, Q(1.2), 34);
  barnacles(sc, b('thighL'), [P.stance, P.hip - Q(8), Q(3)], [Q(3), Q(5), Q(2)], 5, Q(1.2), 35);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    sc.detail(cone(Q(1.5), Q(5), 5), { col: 0xb85a2a, bone: b('chest'), pos: [-Q(10) + Math.cos(a) * Q(2.4), P.shoulderY + Q(3) + Math.sin(a) * Q(2.4), Q(4)], rot: [0, 0, a - Math.PI / 2], surf: SURF.skin });
  }
  kelp(sc, b('foreL'), [[P.shoulderX + Q(4), P.elbowY - Q(2), Q(2)]], Q(16), 36);
  kelp(sc, b('head'), [[Q(6), hy - Q(6), Q(6)], [-Q(7), hy - Q(5), -Q(4)]], Q(18), 37);
  const gait: Gait = { ...GAIT_WALK, stride: 0.38, knee: 0.5, bob: 3.2 * k, sway: 0.22, twist: 0.16, arm: 0.28, elbow: 0.25, lean: 0.25, squash: 0.06 };
  const clips: Clips = {
    // a heavy plod in lead boots, hunched under the crust, the club dragging
    move: { frames: 34, fn: (t) => mix(gaitPose(t, gait), { chest: { rx: 0.28 }, neck: { rx: -0.15 }, armR: { rx: 0.15, rz: -0.12 }, armL: { rz: 0.15 } }) },
    // both arms up over the helmet — and down
    attack: { frames: 18, loop: false, fn: (t) => {
      const up = ease(Math.min(1, t / 0.8)), slam = pulse(t, 0.92, 0.08);
      return { armL: { rx: -2.7 * up + 3.2 * slam, rz: 0.35 }, armR: { rx: -2.7 * up + 3.2 * slam, rz: -0.35 }, foreL: { rx: -0.5 * up }, foreR: { rx: -0.5 * up }, chest: { rx: -0.35 * up + 0.7 * slam }, hips: { ty: -2 * slam } };
    } },
  };
  return { geo: sc.build({ ao: 0.55 }), rig: new Rig(bones, clips) };
}

// ================================================================== Lantern Angler
function lanternAngler(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 20, 0] },
    { name: 'jaw', parent: 'body', head: [0, 16, 13] },
    { name: 'tail', parent: 'body', head: [0, 21, -16] },
    { name: 'tailFin', parent: 'tail', head: [0, 22, -30] },
    { name: 'stalk', parent: 'body', head: [0, 34, 10] },
    { name: 'lure', parent: 'stalk', head: [0, 46, 16] },
    { name: 'finL', parent: 'body', head: [13, 13, 5] },
    { name: 'finR', parent: 'body', head: [-13, 13, 5] },
    { name: 'hindL', parent: 'body', head: [9, 11, -9] },
    { name: 'hindR', parent: 'body', head: [-9, 11, -9] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1.65, 2.4);
  const hide: ColorFn = (p) => {
    const c = C(0x262a30).lerp(C(0x0e1014), 0.3 + 0.5 * vnoise(p.x * 0.15, p.y * 0.15, p.z * 0.15));
    return vnoise(p.x * 0.9 + 3, p.y * 0.9, p.z * 0.9) > 0.8 ? c.lerp(C(0x7a8478), 0.5) : c;
  };
  // the head is most of it: a swollen dark bulb on a huge underslung jaw
  sc.add({ t: 'ell', c: [0, 23, 1], r: [17, 15, 19] }, { col: hide, bone: b('body'), k: 0, surf: SURF.latex });
  sc.add({ t: 'ell', c: [0, 13, 11], r: [16, 6, 14] }, { col: hide, bone: b('jaw'), k: 3, surf: SURF.latex });
  sc.add({ t: 'ell', c: [0, 16.5, 19], r: [13, 5.2, 7] }, { sub: true, k: 1 });
  sc.detail(ellipsoid(12, 4.2, 4, 14, 8), { col: 0x2a0a10, bone: b('jaw'), pos: [0, 15.5, 15.5], surf: SURF.skin });
  // needle teeth, long and glassy, up from the jaw and down from the lip
  for (let i = 0; i < 11; i++) {
    const a = -1.1 + (i / 10) * 2.2, x = Math.sin(a) * 12.5, z = 13 + Math.cos(a) * 11;
    const L = 4 + ((i * 7) % 3) * 1.6;
    sc.detail(cone(0.7, L, 5), { col: 0xe8ecd8, bone: b('jaw'), pos: [x, 17 + L * 0.45, z], rot: [0.25, 0, -x * 0.02], surf: SURF.glass });
    if (i % 2) sc.detail(cone(0.6, L * 0.8, 5), { col: 0xe8ecd8, bone: b('body'), pos: [x * 0.95, 19.5 - L * 0.35, z - 0.6], rot: [Math.PI - 0.25, 0, 0], surf: SURF.glass });
  }
  // small, filmed eyes, and the ragged skin tags hanging from its chin
  for (const s of [1, -1]) {
    sc.detail(sphere(1.6, 10, 8), { col: 0x8aa8b0, bone: b('body'), pos: [s * 9.5, 28, 14.5], emit: 0.5, surf: SURF.glass });
    sc.detail(sphere(0.6, 6, 4), { col: PAL.ink, bone: b('body'), pos: [s * 9.9, 28.2, 16], surf: SURF.glass });
  }
  for (let i = 0; i < 6; i++) sc.detail(cone(0.9, 4 + (i % 3), 4), { col: 0x30343a, bone: b('jaw'), pos: [(i - 2.5) * 3.6, 8.5, 18 - Math.abs(i - 2.5) * 1.2], rot: [Math.PI, 0, (i - 2.5) * 0.1], surf: SURF.latex });
  // spines down the back; the tail and its ragged fin
  for (let i = 0; i < 5; i++) sc.detail(cone(1.2, 5 - i * 0.5, 5), { col: 0x1a1c20, bone: b('body'), pos: [0, 37 - i * 2.2, -3 - i * 4], rot: [-0.5 - i * 0.12, 0, 0], surf: SURF.latex });
  sc.add({ t: 'cap', a: [0, 21, -13], b: [0, 22, -29], ra: 9, rb: 3 }, { col: hide, bone: b('tail'), k: 4, surf: SURF.latex });
  sc.add({ t: 'ell', c: [0, 23, -34], r: [1.2, 8, 6] }, { col: hide, bone: b('tailFin'), k: 1, surf: SURF.latex });
  for (let i = 0; i < 5; i++) sc.detail(cyl(0.3, 0.2, 9, 3), { col: 0x3a4048, bone: b('tailFin'), pos: [0, 23 + (i - 2) * 3, -35], rot: [(i - 2) * 0.35 - 1.57, 0, 0], surf: SURF.bone });
  // it crawls on its fins: pectorals in front, pelvics behind, webbed at the tips
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) {
    sc.add({ t: 'cap', a: [s * 13, 13, 5], b: [s * 20, 3, 12], ra: 3.2, rb: 2 }, { col: hide, bone: b(`fin${n}`), k: 1.5, surf: SURF.latex });
    sc.add({ t: 'ell', c: [s * 21, 1.6, 13], r: [5, 1.4, 4] }, { col: hide, bone: b(`fin${n}`), k: 1, surf: SURF.latex });
    sc.add({ t: 'cap', a: [s * 9, 11, -9], b: [s * 14, 2, -14], ra: 2.6, rb: 1.6 }, { col: hide, bone: b(`hind${n}`), k: 1.2, surf: SURF.latex });
    sc.add({ t: 'ell', c: [s * 15, 1.4, -15], r: [4, 1.2, 3.2] }, { col: hide, bone: b(`hind${n}`), k: 0.8, surf: SURF.latex });
  }
  // the stalk and its lantern: a carnival lamp, brass caged, burning green-white
  sc.add({ t: 'cap', a: [0, 34, 10], b: [0, 46, 16], ra: 1.4, rb: 1.1 }, { col: hide, bone: b('stalk'), k: 1.5, surf: SURF.latex });
  sc.add({ t: 'cap', a: [0, 46, 16], b: [0, 49.5, 26], ra: 1.1, rb: 0.8 }, { col: hide, bone: b('lure'), k: 0.6, surf: SURF.latex });
  sc.detail(sphere(2.3, 12, 10), { col: 0xd8ffc0, bone: b('lure'), pos: [0, 45.5, 27.5], emit: 2.6, surf: SURF.bulb });
  sc.detail(cone(2.8, 1.8, 8), { col: PAL.brass, bone: b('lure'), pos: [0, 48.6, 27.5], surf: SURF.brass });
  sc.detail(torus(0.9, 0.3, 4, 10), { col: PAL.brass, bone: b('lure'), pos: [0, 50, 27.5], rot: [0, Math.PI / 2, 0], surf: SURF.brass });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    sc.detail(cyl(0.22, 0.22, 4.4, 3), { col: PAL.brass, bone: b('lure'), pos: [Math.cos(a) * 2.5, 45.6, 27.5 + Math.sin(a) * 2.5], surf: SURF.brass });
  }
  sc.detail(cyl(2.6, 2.6, 0.6, 10), { col: PAL.brass, bone: b('lure'), pos: [0, 43.2, 27.5], surf: SURF.brass });
  const clips: Clips = {
    // the crawl: fins planting and hauling, the bulk rolling over them, the lantern swinging
    move: { frames: 30, fn: (t) => ({ body: { ty: 1.5 * Math.abs(sin(t, 2)), rx: 0.06 * sin(t, 2), rz: 0.05 * sin(t) }, finL: { rx: 0.6 * sin(t), rz: 0.15 * cos(t) }, finR: { rx: -0.6 * sin(t), rz: -0.15 * cos(t) }, hindL: { rx: -0.5 * sin(t) }, hindR: { rx: 0.5 * sin(t) }, tail: { ry: 0.3 * sin(t, 1, 0.25) }, tailFin: { ry: 0.4 * sin(t, 1, 0.4) }, jaw: { rx: 0.08 * Math.abs(sin(t, 2)) }, stalk: { rx: 0.1 * sin(t, 1, 0.3) }, lure: { rx: 0.2 * sin(t, 1, 0.5), rz: 0.15 * sin(t, 2) } }) },
    // the lure: everything goes still but the lantern, swaying in slow arcs
    lure: { frames: 30, fn: (t) => ({ body: { rx: -0.08 }, jaw: { rx: 0.06 }, stalk: { rx: -0.2 + 0.1 * sin(t) }, lure: { rz: 0.35 * sin(t), rx: 0.15 * cos(t) }, tail: { ry: 0.12 * sin(t) } }) },
    // the bite: the jaw drops wide, the body rears — and snaps shut
    attack: { frames: 14, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.75)), shut = pulse(t, 0.95, 0.06);
      return { body: { rx: -0.25 * k + 0.3 * shut }, jaw: { rx: 0.9 * k - 1 * shut }, finL: { rx: -0.5 * k }, finR: { rx: -0.5 * k }, stalk: { rx: -0.4 * k } };
    } },
  };
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
}

// ================================================================== Prize Collector
function prizeCollector(): SculptModel {
  const K = 1.3;
  const Q = (v: number) => v * K;
  const P = prop(K, { headR: 10, chestW: 14, waistW: 15.5, hipW: 15, depth: 1, leg: [6, 5, 4.4], arm: [5, 4.5, 4], stance: 8 });
  const bones = humanBones(P);
  const b = bi(bones);
  const sc = new Sculpt(2.25, 3);
  const skin = weather(0xb8a890, 0.4, 0.12, 0x8a7a60);
  // a loud check suit gone the colour of old mustard, a vest straining over the belly
  const checkA = weather(0x6a4a2a, 0.35), checkB = weather(0x8a7a3a, 0.35);
  const checks: ColorFn = (p, n) => ((Math.floor(p.x / Q(2.4)) + Math.floor(p.y / Q(2.4)) + Math.floor(p.z / Q(2.4))) % 2 === 0 ? checkA(p, n) : checkB(p, n));
  const trousers = weather(0x3a2a1e, 0.35);
  humanBody(sc, P, b, { skin, torso: checks, hips: trousers, upperArm: checks, foreArm: checks, hand: skin, thigh: trousers, shin: trousers, shoe: PAL.leather, torsoSurf: SURF.cloth, legSurf: SURF.cloth, bigShoes: 1.2 });
  sc.add({ t: 'ell', c: [0, P.waist - Q(1), Q(5)], r: [Q(15), Q(13), Q(11)] }, { col: weather(0x8a6a2a, 0.4), bone: b('spine'), k: Q(4), surf: SURF.velvet });
  for (let i = 0; i < 4; i++) sc.detail(sphere(Q(0.8), 8, 6), { col: PAL.brass, bone: b('spine'), pos: [0, P.waist + Q(7) - i * Q(4.4), Q(15.6) - Math.abs(i - 1.5) * Q(0.8)], surf: SURF.brass });
  // the sack over its left shoulder, lumpy, tied at the neck, tickets spilling out
  const burlap = weather(0x8a7450, 0.45, 0.1, 0x5a4a30);
  sc.add({ t: 'ell', c: [Q(6), P.chest + Q(2), -Q(14)], r: [Q(12), Q(15), Q(10)] }, { col: burlap, bone: b('chest'), k: Q(2), surf: SURF.canvas });
  sc.add({ t: 'ell', c: [Q(11), P.chest - Q(6), -Q(16)], r: [Q(7), Q(7), Q(6)] }, { col: burlap, bone: b('chest'), k: Q(3), surf: SURF.canvas });
  sc.add({ t: 'ell', c: [Q(1), P.chest + Q(10), -Q(17)], r: [Q(6), Q(6), Q(5)] }, { col: burlap, bone: b('chest'), k: Q(3), surf: SURF.canvas });
  sc.detail(torus(Q(3.4), Q(0.8), 6, 14), { col: 0x6a5a3a, bone: b('chest'), pos: [Q(8), P.chest + Q(17), -Q(10)], rot: [1.2, 0, 0.3], surf: SURF.canvas });
  const r = stream(41);
  for (let i = 0; i < 9; i++) sc.detail(box(Q(2.2), Q(0.3), Q(4)), { col: [0xc84a3a, 0xd8a040, 0x3a8ac8][i % 3], bone: b('chest'), pos: [Q(8) + (r() - 0.5) * Q(6), P.chest + Q(18) + r() * Q(3), -Q(10) + (r() - 0.5) * Q(5)], rot: [r() * 2, r() * 3, r() * 2], emit: 0.2, surf: SURF.paint });
  // a string of tickets and a ring of keys off its belt
  for (let i = 0; i < 7; i++) sc.detail(box(Q(2.4), Q(3.6), Q(0.25)), { col: i % 2 ? 0xd8a040 : 0xc84a3a, bone: b('hips'), pos: [-Q(12), P.hip - Q(2) - i * Q(3.4), Q(6) - i * Q(0.3)], rot: [0.1, 0.4, Math.sin(i * 1.3) * 0.2], emit: 0.15, surf: SURF.paint });
  sc.detail(torus(Q(2.4), Q(0.35), 4, 12), { col: PAL.brass, bone: b('hips'), pos: [Q(11), P.hip - Q(1), Q(9)], rot: [0.4, 0.6, 0], surf: SURF.brass });
  // jowls, a gold-toothed grin, little eyes under a green celluloid eyeshade
  head(sc, P, b('head'), { skin, nose: 1.3, ears: true, brow: 0.8, cheeks: 1.4, chin: 1, jaw: 1.25 });
  for (const s of [1, -1]) sc.add({ t: 'ell', c: [s * P.headR * 0.62, P.headY - P.headR * 0.6, P.headR * 0.42], r: [P.headR * 0.32, P.headR * 0.38, P.headR * 0.3] }, { col: skin, bone: b('head'), k: Q(2), surf: SURF.skin });
  eyeDetails(sc, P, b('head'), { size: 0.12, sclera: 0xd8d0b0, iris: 0x2a1a10, y: 0.12, spread: 0.32 });
  sc.detail(ellipsoid(Q(5.4), Q(1.6), Q(1), 12, 6), { col: 0x2a0a08, bone: b('head'), pos: [0, P.headY - P.headR * 0.5, P.headR * 0.9], surf: SURF.rubber });
  for (let i = 0; i < 7; i++) sc.detail(box(Q(1), Q(1.2), Q(0.5)), { col: i % 3 === 1 ? PAL.gold : PAL.bone, bone: b('head'), pos: [-Q(3.6) + i * Q(1.2), P.headY - P.headR * 0.42, P.headR * 0.96], surf: i % 3 === 1 ? SURF.gold : SURF.porcelain });
  sc.detail(cyl(P.headR * 1.02, P.headR * 1.02, Q(1.6), 16, true), { col: 0x2a4a2a, bone: b('head'), pos: [0, P.headY + P.headR * 0.5, 0], surf: SURF.cloth });
  sc.detail(cyl(P.headR * 1.1, P.headR * 0.95, Q(0.4), 16), { col: 0x5adf8a, bone: b('head'), pos: [0, P.headY + P.headR * 0.4, P.headR * 0.55], rot: [0.35, 0, 0], scale: [1, 1, 0.75], emit: 0.5, surf: SURF.glass });
  const gait: Gait = { ...GAIT_WALK, stride: 0.42, knee: 0.55, bob: 2.6, sway: 0.2, twist: 0.12, arm: 0.25, lean: 0.12, squash: 0.06 };
  const sack: Pose = { armL: { rx: -2.7, rz: 0.15 }, foreL: { rx: -1.6 } };
  const clips: Clips = {
    // a waddling shuffle under the sack, head swinging to sniff out tickets
    move: { frames: 32, fn: (t) => mix(gaitPose(t, gait), sack, { chest: { rx: 0.1, rz: 0.06 * sin(t) }, head: { ry: 0.3 * sin(t), rx: 0.12 } }) },
    // the grab: the free hand reaches back and sweeps forward
    attack: { frames: 16, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.8)), grab = pulse(t, 0.92, 0.08);
      return mix(sack, { armR: { rx: -1.9 * k + 1.2 * grab, rz: -0.5 * k }, foreR: { rx: -0.4 * k }, chest: { ry: -0.4 * k + 0.6 * grab, rx: 0.2 * k }, head: { rx: 0.15 * k } });
    } },
  };
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
}

// ================================================================== Tidecaller
function tidecaller(): SculptModel {
  const K = 1.12;
  const Q = (v: number) => v * K;
  const P = prop(K, { headR: 9.5, chestW: 10, waistW: 8, hipW: 9, arm: [2.8, 2.4, 2.1], depth: 0.7, neck: 66, headY: 76 });
  const hx = P.shoulderX + P.armOut * 1.6;
  // the staff has a bone of its own, so the clips can keep it upright whatever the arm is doing
  const bones = humanBones(P, [{ name: 'staff', parent: 'handR', head: [-hx, P.wristY, Q(2.5)] }]);
  const b = bi(bones);
  const sc = new Sculpt(1.95, 2.2);
  const skin = weather(0x8a9aa0, 0.45, 0.12, 0x4a5a66);
  // a robe of kelp: dark weed with paler fronds running down it
  const dark = weather(0x1e2a22, 0.3), frond = weather(0x3e4a2a, 0.35);
  const robe: ColorFn = (p, n) => (Math.sin(p.x * 0.9 + p.z * 0.7 + vnoise(p.x * 0.1, p.y * 0.05, p.z * 0.1) * 6) > 0.55 ? frond(p, n) : dark(p, n));
  humanBody(sc, P, b, { skin, torso: robe, hips: robe, upperArm: robe, foreArm: robe, hand: skin, thigh: robe, shin: robe, shoe: robe, torsoSurf: SURF.cloth, legSurf: SURF.cloth, noLegs: true });
  sc.add({ t: 'cap', a: [0, P.hip + Q(2), 0], b: [0, Q(3), 0], ra: Q(9), rb: Q(15), sz: 0.85 }, { col: robe, bone: b('hips'), k: Q(3), surf: SURF.cloth });
  // wide dripping sleeves
  for (const [s, n] of [[1, 'L'], [-1, 'R']] as const) sc.add({ t: 'ell', c: [s * (P.shoulderX + P.armOut), P.elbowY - Q(6), -Q(1)], r: [Q(4.5), Q(8), Q(4.5)] }, { col: robe, bone: b(`fore${n}`), k: Q(2), surf: SURF.cloth });
  // the hem in tatters: fronds of weed trailing on the boards
  const r = stream(51);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    sc.detail(cone(Q(1.8), Q(6 + r() * 4), 4), { col: r() < 0.5 ? 0x2a3420 : 0x1a2218, bone: b('hips'), pos: [Math.cos(a) * Q(14), Q(1.5), Math.sin(a) * Q(12.5)], rot: [Math.PI + (r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4], surf: SURF.latex });
  }
  barnacles(sc, b('hips'), [0, Q(8), Q(10)], [Q(10), Q(4), Q(2)], 8, Q(1.2), 52);
  // a drowned face, long wet hair, a crown of shells
  head(sc, P, b('head'), { skin, nose: 0.9, ears: false, brow: 1.2, cheeks: 0.35, chin: 0.8, jaw: 0.8 });
  eyeDetails(sc, P, b('head'), { size: 0.15, sclera: -1, iris: 0x7dffd8, glow: 2, y: 0.13 });
  sc.detail(ellipsoid(Q(3), Q(0.5), Q(0.5), 10, 4), { col: PAL.ink, bone: b('head'), pos: [0, P.headY - P.headR * 0.5, P.headR * 0.9], surf: SURF.rubber });
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7;
    sc.detail(cyl(Q(0.8), Q(0.3), Q(24), 4), { col: 0x14161a, bone: b('head'), pos: [Math.cos(a) * P.headR * 0.95, P.headY - Q(8), -Math.sin(a) * P.headR * 0.8], rot: [0.15, 0, (Math.cos(a)) * 0.15], surf: SURF.latex });
  }
  const shells = [0xd8c8a8, 0xc8a080, 0xe0d8c8, 0xb89070];
  for (let i = 0; i < 7; i++) {
    const a = -1.3 + (i / 6) * 2.6;
    const p: V3 = [Math.sin(a) * P.headR * 0.85, P.headY + P.headR * 0.85, Math.cos(a) * P.headR * 0.7];
    if (i % 2) sc.detail(cone(Q(1.6), Q(6 + (i % 3) * 2), 7), { col: shells[i % 4], bone: b('head'), pos: [p[0], p[1] + Q(2.5), p[2]], rot: [Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.3], surf: SURF.porcelain });
    else sc.detail(ellipsoid(Q(3.4), Q(3), Q(0.7), 10, 6), { col: shells[i % 4], bone: b('head'), pos: [p[0], p[1] + Q(1.5), p[2]], rot: [0, a, 0], surf: SURF.porcelain });
  }
  // its staff of pier driftwood, a ship's bell hanging from the crook, kelp wound round it
  const sx = -hx, sz = Q(2.5);
  sc.detail(cyl(Q(1.3), Q(1.6), Q(118), 7), { col: 0x8a8070, bone: b('staff'), pos: [sx, P.wristY + Q(26), sz], surf: SURF.wood });
  sc.detail(torus(Q(4), Q(1.2), 6, 12, Math.PI), { col: 0x8a8070, bone: b('staff'), pos: [sx - Q(4), P.wristY + Q(85), sz], surf: SURF.wood });
  sc.detail(cone(Q(4.6), Q(7), 14), { col: 0x8a6a3a, bone: b('staff'), pos: [sx - Q(8), P.wristY + Q(78), sz], surf: SURF.brass });
  sc.detail(sphere(Q(1.2), 8, 6), { col: 0x5a4a2a, bone: b('staff'), pos: [sx - Q(8), P.wristY + Q(74), sz], surf: SURF.brass });
  kelp(sc, b('staff'), [[sx + Q(1), P.wristY + Q(60), sz], [sx - Q(1), P.wristY + Q(40), sz + Q(1)]], Q(20), 53);
  // a conch in its left hand
  sc.detail(cone(Q(2.6), Q(8), 9), { col: 0xe8c0a0, bone: b('handL'), pos: [hx + Q(1), P.wristY - Q(6), Q(3)], rot: [0.4, 0, -1.2], surf: SURF.porcelain });
  const clips: Clips = {
    // it glides rather than walks; the robe sways, the head stays bowed, the staff keeps time
    move: { frames: 34, fn: (t) => ({ hips: { ty: 1.5 * sin(t, 2), rz: 0.05 * sin(t) }, chest: { rz: 0.05 * sin(t, 1, 0.2), rx: 0.05 }, armR: { rx: -0.4 + 0.08 * sin(t), rz: -0.1 }, foreR: { rx: -0.9 }, staff: { rx: 1.3 - 0.08 * sin(t), rz: 0.1 }, armL: { rx: 0.2 * sin(t, 1, 0.5), rz: 0.15 }, foreL: { rx: -0.6 }, head: { rx: 0.18, rz: 0.08 * sin(t) } }) },
    // the call: staff high, the free hand lifted, face to the sky — then the staff comes down
    attack: { frames: 18, loop: false, fn: (t) => {
      const k = ease(Math.min(1, t / 0.8)), down = pulse(t, 0.93, 0.07);
      return { armR: { rx: -2.2 * k + 1.2 * down, rz: -0.15 }, foreR: { rx: -0.3 }, staff: { rx: 0.3 + 2.2 * k - 1.5 * down, rz: 0.15 }, armL: { rx: -1.6 * k, rz: 0.6 * k }, foreL: { rx: -0.4 * k }, head: { rx: -0.35 * k }, chest: { rx: -0.2 * k }, hips: { ty: 3 * k } };
    } },
  };
  return { geo: sc.build({ ao: 0.5 }), rig: new Rig(bones, clips) };
}

// ================================================================== Tin Duck (the Barker's shooting gallery)
function tinDuck(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'base', parent: null, head: [0, 4, 0] },
    { name: 'duck', parent: 'base', head: [0, 13, 0] },
  ];
  const b = bi(bones);
  const sc = new Sculpt(1, 1.2);
  // a tin cut-out in profile (thin across x, so it shows its painted side as it marches past), rusting
  const tin = weather(0xd8a830, 0.5, 0.12, 0x7a4a2a);
  sc.add({ t: 'ell', c: [0, 22, 0], r: [1.7, 9, 14] }, { col: tin, bone: b('duck'), k: 0, surf: SURF.paint });
  sc.add({ t: 'ell', c: [0, 33, 9], r: [1.7, 6, 6] }, { col: tin, bone: b('duck'), k: 2, surf: SURF.paint });
  sc.add({ t: 'ell', c: [0, 27, -13], r: [1.4, 5, 3.5], rot: [0.6, 0, 0] }, { col: tin, bone: b('duck'), k: 1.5, surf: SURF.paint });
  sc.add({ t: 'box', c: [0, 32, 16.5], h: [1.2, 1.6, 3.2], r: 0.6 }, { col: 0xd8602a, bone: b('duck'), k: 0.5, surf: SURF.paint });
  for (const s of [1, -1]) {
    sc.detail(cyl(1.2, 1.2, 0.4, 10), { col: PAL.ink, bone: b('duck'), pos: [s * 1.8, 34.5, 10.5], rot: [0, 0, Math.PI / 2], surf: SURF.paint });
    // the bullseye painted on its side
    for (const [r, c, o] of [[5.2, 0xa8202a, 0], [3.6, 0xe8e0c8, 0.1], [1.9, 0xa8202a, 0.2]] as [number, number, number][]) {
      sc.detail(cyl(r, r, 0.3, 16), { col: c, bone: b('duck'), pos: [s * (1.75 + o), 21, -1], rot: [0, 0, Math.PI / 2], surf: SURF.paint });
    }
  }
  // the post it rides on and the runner that carries it along the gallery's track
  sc.add({ t: 'cap', a: [0, 5, 0], b: [0, 14, 0], ra: 1.2, rb: 1.1 }, { col: PAL.iron, bone: b('base'), k: 0.5, surf: SURF.iron });
  sc.add({ t: 'box', c: [0, 3, 0], h: [3, 1.8, 9], r: 0.6 }, { col: PAL.iron, bone: b('base'), k: 0.5, surf: SURF.iron });
  for (const z of [-6, 6]) sc.detail(cyl(2, 2, 7.5, 10), { col: 0x3a3a3e, bone: b('base'), pos: [0, 2, z], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
  const clips: Clips = {
    // rattling along the track, rocking on its post
    move: { frames: 20, fn: (t) => ({ base: { ty: 0.5 * Math.abs(sin(t, 2)) }, duck: { rx: 0.12 * sin(t, 2), rz: 0.04 * sin(t) } }) },
    // knocked back on its hinge
    attack: { frames: 10, loop: false, fn: (t) => ({ duck: { rx: -1.1 * ease(t) } }) },
  };
  return { geo: sc.build({ ao: 0.4 }), rig: new Rig(bones, clips) };
}

/** Builders for the Boardwalk's creatures, keyed by enemy id (the Great Barnacle is a bigger brute). */
export const BOARDWALK_BUILDERS: Record<string, () => SculptModel> = {
  drowned: drownedBather,
  shore_crawler: shoreCrawler,
  ticket_taker: ticketTaker,
  taffy_horror: taffyHorror,
  arcade_automaton: arcadeAutomaton,
  coaster_wraith: coasterWraith,
  barnacle_brute: () => barnacleBrute(1),
  great_barnacle: () => barnacleBrute(1.5),
  lantern_angler: lanternAngler,
  prize_collector: prizeCollector,
  tidecaller,
  tin_duck: tinDuck,
};
