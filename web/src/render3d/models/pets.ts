// The companions (D-84), sculpted after the real ones on their own little skeletons, a trot and an idle each:
//   Milo      a black-and-white Cavapoo: curly white coat with a charcoal saddle over his shoulders, a charcoal
//             bed-head and long floppy ears, a pale muzzle and brows, dark round eyes, the tip of his tongue showing.
//   Augustus  a Russian Blue: short silver-tipped blue-grey coat, a short wedge of a head with broad whisker pads,
//             tall wide-set ears, almond green-gold eyes, a slate nose, a long tail held up.
// Registered among the creatures (`pet_milo`, `pet_augustus`) so the boot's workers sculpt them with the crowd.

import * as THREE from 'three';
import { C, SURF, cone, ellipsoid, sphere, vnoise, type ColorFn, type V3 } from '../core/geo';
import { Sculpt } from '../sculpt/sdf';
import { Rig, type BoneDef, type ClipDef, type Pose, pulse, sin } from '../sculpt/rig';
import type { SculptModel } from './characters';

type Clips = Record<string, ClipDef>;
const bi = (bones: BoneDef[]) => (n: string) => {
  const i = bones.findIndex((x) => x.name === n);
  if (i < 0) throw new Error(`no bone ${n}`);
  return i;
};
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const LEGS = [[1, 'L'], [-1, 'R']] as const;

/** A trot: diagonal pairs together (front left with back right), the paws tucking as they lift. */
function trot(t: number, k: number): Pose {
  const p: Pose = {};
  for (const [s, n] of LEGS) {
    const ph = s > 0 ? 0 : 0.5;
    p[`legF${n}`] = { rx: 0.55 * k * sin(t, 1, ph) };
    p[`pawF${n}`] = { rx: -0.55 * k * Math.max(0, sin(t, 1, ph + 0.25)) };
    p[`legB${n}`] = { rx: 0.5 * k * sin(t, 1, ph + 0.5) };
    p[`pawB${n}`] = { rx: 0.5 * k * Math.max(0, sin(t, 1, ph + 0.75)) };
  }
  return p;
}

// ================================================================== Augustus
function augustus(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 12.5, -2] },
    { name: 'chest', parent: 'body', head: [0, 13, 6] },
    { name: 'neck', parent: 'chest', head: [0, 15.5, 10] },
    { name: 'head', parent: 'neck', head: [0, 19, 12.5] },
    { name: 'earL', parent: 'head', head: [2.9, 23, 12] },
    { name: 'earR', parent: 'head', head: [-2.9, 23, 12] },
    { name: 'tail1', parent: 'body', head: [0, 13.5, -10] },
    { name: 'tail2', parent: 'tail1', head: [0, 17.5, -15] },
    { name: 'tail3', parent: 'tail2', head: [0, 23, -17] },
  ];
  for (const [s, n] of LEGS) {
    bones.push({ name: `legF${n}`, parent: 'chest', head: [s * 2.8, 11, 7.5] }, { name: `pawF${n}`, parent: `legF${n}`, head: [s * 2.8, 4.5, 8] });
    bones.push({ name: `legB${n}`, parent: 'body', head: [s * 3, 11.5, -7.5] }, { name: `pawB${n}`, parent: `legB${n}`, head: [s * 3, 4.8, -6.5] });
  }
  const b = bi(bones);
  const sc = new Sculpt(0.8, 3);
  // silver-tipped blue: the grey-blue coat with its paler tips catching the light in a fine grain
  const coat: ColorFn = (p) => C(0x67717d).lerp(C(0xa0aab6), 0.2 + 0.5 * vnoise(p.x * 0.7, p.y * 0.7, p.z * 0.7));
  const fur = { col: coat, surf: SURF.cloth };
  sc.add({ t: 'cap', a: [0, 12.5, -9], b: [0, 13, 5], ra: 4.6, rb: 5 }, { ...fur, bone: b('body'), k: 2 });
  sc.add({ t: 'ell', c: [0, 12.8, 6.5], r: [4.4, 4.8, 4.2] }, { ...fur, bone: b('chest'), k: 2 });
  sc.add({ t: 'cap', a: [0, 14, 8.5], b: [0, 17, 11.5], ra: 3.2, rb: 2.8 }, { ...fur, bone: b('neck'), k: 2 });
  // the head: a short wedge, broad at the whisker pads, the brow flat
  sc.add({ t: 'ell', c: [0, 19.5, 13], r: [4.2, 3.9, 4] }, { ...fur, bone: b('head'), k: 1.5 });
  for (const s of [1, -1]) sc.add({ t: 'ell', c: [s * 2.2, 18.6, 14.4], r: [2.2, 2, 2] }, { ...fur, bone: b('head'), k: 1.2 });
  sc.add({ t: 'ell', c: [0, 18.4, 16.4], r: [2.1, 1.6, 1.8] }, { ...fur, bone: b('head'), k: 1 });
  for (const s of [1, -1]) sc.add({ t: 'sph', c: [s * 1.15, 18.1, 17.6], r: 1.25 }, { col: 0x8a94a0, surf: SURF.cloth, bone: b('head'), k: 0.8 });
  // tall, wide-set ears, pinkish grey inside
  for (const [s, n] of LEGS) {
    sc.detail(cone(2.4, 5.4, 8), { col: 0x6a7480, bone: b(`ear${n}`), pos: [s * 2.9, 25.2, 12], rot: [-0.15, 0, -s * 0.32], surf: SURF.cloth });
    sc.detail(cone(1.5, 3.8, 8), { col: 0xb6a0a8, bone: b(`ear${n}`), pos: [s * 2.85, 25, 12.55], rot: [-0.15, 0, -s * 0.32], surf: SURF.skin });
  }
  // almond eyes, green-gold, the pupils narrowed; the slate nose
  for (const s of [1, -1]) {
    sc.detail(ellipsoid(1.7, 1.15, 0.7, 12, 8), { col: 0xc4d65c, bone: b('head'), pos: [s * 1.75, 20.2, 16.3], rot: [0, s * 0.35, -s * 0.12], emit: 0.8, surf: SURF.glass });
    sc.detail(ellipsoid(0.38, 1, 0.3, 8, 6), { col: 0x101410, bone: b('head'), pos: [s * 1.78, 20.2, 16.95], rot: [0, s * 0.35, 0], surf: SURF.glass });
    sc.detail(sphere(0.26, 6, 4), { col: 0xffffff, bone: b('head'), pos: [s * 1.45, 20.6, 17.05], emit: 1.4, surf: SURF.glass });
  }
  sc.detail(ellipsoid(0.75, 0.55, 0.5, 10, 6), { col: 0x4a525c, bone: b('head'), pos: [0, 19, 18], surf: SURF.rubber });
  // long legs, neat paws; the back legs' haunches
  for (const [s, n] of LEGS) {
    sc.add({ t: 'cap', a: [s * 2.8, 11, 7.5], b: [s * 2.8, 4.5, 8], ra: 1.6, rb: 1.35 }, { ...fur, bone: b(`legF${n}`), k: 1 });
    sc.add({ t: 'cap', a: [s * 2.8, 4.5, 8], b: [s * 2.8, 0.9, 8.8], ra: 1.35, rb: 1.45 }, { ...fur, bone: b(`pawF${n}`), k: 0.8 });
    sc.add({ t: 'cap', a: [s * 3, 11.8, -7.5], b: [s * 3, 6.5, -5.8], ra: 2.5, rb: 1.5 }, { ...fur, bone: b(`legB${n}`), k: 1.4 });
    sc.add({ t: 'cap', a: [s * 3, 6.5, -5.8], b: [s * 3, 0.9, -6.6], ra: 1.4, rb: 1.45 }, { ...fur, bone: b(`pawB${n}`), k: 0.8 });
  }
  // the long tail, carried up
  sc.add({ t: 'cap', a: [0, 13.5, -10], b: [0, 17.5, -15], ra: 1.35, rb: 1.25 }, { ...fur, bone: b('tail1'), k: 1 });
  sc.add({ t: 'cap', a: [0, 17.5, -15], b: [0, 23, -17], ra: 1.25, rb: 1.1 }, { ...fur, bone: b('tail2'), k: 0.8 });
  sc.add({ t: 'cap', a: [0, 23, -17], b: [0, 26.5, -16.2], ra: 1.1, rb: 0.85 }, { ...fur, bone: b('tail3'), k: 0.8 });
  const clips: Clips = {
    move: { frames: 20, fn: (t) => ({
      ...trot(t, 1),
      body: { ty: 0.5 * Math.abs(sin(t, 2)) - 0.25 }, head: { rx: 0.05 * sin(t, 2) },
      tail1: { rx: -0.2, ry: 0.16 * sin(t) }, tail2: { rx: 0.2, ry: 0.2 * sin(t, 1, 0.2) }, tail3: { ry: 0.24 * sin(t, 1, 0.4) },
    }) },
    // standing: the tail's slow swish, a look round, an ear flicked now and then, breathing
    idle: { frames: 150, fn: (t) => ({
      body: { ty: 0.12 * sin(t, 4) },
      head: { ry: 0.3 * sin(t), rx: -0.06 * sin(t, 2) },
      earL: { rz: -0.45 * pulse(t, 0.3, 0.04) }, earR: { rz: 0.45 * pulse(t, 0.72, 0.04) },
      tail1: { rx: -0.1, ry: 0.32 * sin(t, 2) }, tail2: { rx: 0.3, ry: 0.3 * sin(t, 2, 0.15) }, tail3: { ry: 0.36 * sin(t, 2, 0.3) },
    }) },
  };
  return { geo: sc.build({ ao: 0.45 }), rig: new Rig(bones, clips) };
}

// ================================================================== Milo
function milo(): SculptModel {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, head: [0, 14, -2] },
    { name: 'chest', parent: 'body', head: [0, 14.8, 6.5] },
    { name: 'neck', parent: 'chest', head: [0, 17.5, 10] },
    { name: 'head', parent: 'neck', head: [0, 21.5, 12.5] },
    { name: 'earL', parent: 'head', head: [4.8, 23.5, 12.6] },
    { name: 'earR', parent: 'head', head: [-4.8, 23.5, 12.6] },
    { name: 'tail1', parent: 'body', head: [0, 16, -10.5] },
    { name: 'tail2', parent: 'tail1', head: [0, 20, -13.5] },
  ];
  for (const [s, n] of LEGS) {
    bones.push({ name: `legF${n}`, parent: 'chest', head: [s * 3.2, 11.5, 7.5] }, { name: `pawF${n}`, parent: `legF${n}`, head: [s * 3.2, 4.6, 7.8] });
    bones.push({ name: `legB${n}`, parent: 'body', head: [s * 3.4, 12, -7.5] }, { name: `pawB${n}`, parent: `legB${n}`, head: [s * 3.4, 4.8, -7] });
  }
  const b = bi(bones);
  const sc = new Sculpt(0.8, 3);
  const r = stream(0x6d696c6f);
  const wC = (p: THREE.Vector3) => C(0xece6dc).lerp(C(0xcac2b6), 0.55 * vnoise(p.x * 0.5, p.y * 0.5, p.z * 0.5));
  const kC = (p: THREE.Vector3) => C(0x2a282a).lerp(C(0x5c585a), 0.6 * vnoise(p.x * 0.45 + 3, p.y * 0.45, p.z * 0.45));
  const white: ColorFn = (p) => wC(p);
  const charcoal: ColorFn = (p) => kC(p);
  const pale: ColorFn = (p) => C(0xdcd6cc).lerp(C(0x9a948c), 0.5 * vnoise(p.x * 0.6 + 7, p.y * 0.6, p.z * 0.6));
  // white with a charcoal saddle over his shoulders and back, the head charcoal: blended, never a hard edge
  const coat: ColorFn = (p) => wC(p).lerp(kC(p), smooth(17.4, 19.2, p.y) * smooth(-7, -3, p.z) * (1 - smooth(5, 8, p.z)) * 0.9);
  const neckCol: ColorFn = (p) => wC(p).lerp(kC(p), smooth(17.5, 20, p.y));
  /** curls over a body part: small blobs on a cylinder (a long axis along z) or a sphere */
  const curls = (bone: string, n: number, at: () => V3, rr: [number, number], col: ColorFn) => {
    for (let i = 0; i < n; i++) sc.add({ t: 'sph', c: at(), r: rr[0] + r() * (rr[1] - rr[0]) }, { col, surf: SURF.cloth, bone: b(bone), k: 0.9 });
  };
  sc.add({ t: 'cap', a: [0, 14, -9], b: [0, 14.6, 6], ra: 6, rb: 6.4 }, { col: coat, surf: SURF.cloth, bone: b('body'), k: 2 });
  sc.add({ t: 'ell', c: [0, 13.5, 7.5], r: [5.4, 5.8, 4.6] }, { col: white, surf: SURF.cloth, bone: b('chest'), k: 2 });
  curls('body', 64, () => {
    const a = r() * Math.PI * 2, z = -9 + r() * 15;
    return [Math.cos(a) * 5.9, 14.2 + Math.sin(a) * 5.9, z];
  }, [1.4, 2], coat);
  curls('chest', 18, () => {
    const a = r() * Math.PI * 2, q = r() * Math.PI;
    return [Math.cos(a) * Math.sin(q) * 5, 13.5 + Math.cos(q) * 5.4, 7.5 + Math.sin(a) * Math.sin(q) * 4.4];
  }, [1.3, 1.8], white);
  sc.add({ t: 'cap', a: [0, 16, 8.5], b: [0, 19.5, 11.5], ra: 4.3, rb: 4.1 }, { col: neckCol, surf: SURF.cloth, bone: b('neck'), k: 2 });
  // the head: a charcoal dome of curls with a bed-head on top
  sc.add({ t: 'ell', c: [0, 22, 13], r: [5.4, 5.2, 5.2] }, { col: charcoal, surf: SURF.cloth, bone: b('head'), k: 1.5 });
  curls('head', 30, () => {
    const a = r() * Math.PI * 2, q = r() * Math.PI * 0.6;
    return [Math.cos(a) * Math.sin(q) * 5.1, 22 + Math.cos(q) * 5, 12.4 + Math.sin(a) * Math.sin(q) * 5];
  }, [1.3, 1.8], charcoal);
  for (let i = 0; i < 6; i++) {
    const x = -2.6 + i * 1.05 + (r() - 0.5) * 0.6;
    sc.add({ t: 'ell', c: [x, 27 + r() * 0.8, 11.6 + (r() - 0.5) * 2], r: [1.1, 2.5, 1.1], rot: [(r() - 0.5) * 0.6, 0, x * 0.18] }, { col: charcoal, surf: SURF.cloth, bone: b('head'), k: 0.8 });
  }
  // the pale muzzle and brows, fluffy
  sc.add({ t: 'ell', c: [0, 20.6, 17], r: [3.2, 2.6, 2.8] }, { col: pale, surf: SURF.cloth, bone: b('head'), k: 1.2 });
  curls('head', 10, () => {
    const a = r() * Math.PI * 2;
    return [Math.cos(a) * 2.9, 20.2 + Math.sin(a) * 1.8, 17.6 + r() * 1.4];
  }, [0.9, 1.3], pale);
  for (const s of [1, -1]) sc.add({ t: 'ell', c: [s * 2.3, 24, 17.1], r: [1.6, 0.9, 1] }, { col: 0xb6b0a8, surf: SURF.cloth, bone: b('head'), k: 0.8 });
  // dark round eyes peering out (a glint in each), the black button nose, the tip of his tongue
  for (const s of [1, -1]) {
    sc.detail(sphere(1.15, 12, 10), { col: 0x0e0a0c, bone: b('head'), pos: [s * 2.3, 22.9, 17.6], surf: SURF.glass });
    sc.detail(sphere(0.34, 6, 5), { col: 0xffffff, bone: b('head'), pos: [s * 2.05, 23.25, 18.55], emit: 1.3, surf: SURF.glass });
  }
  sc.detail(ellipsoid(1.35, 1, 0.95, 12, 8), { col: 0x121012, bone: b('head'), pos: [0, 21.4, 19.85], surf: SURF.rubber });
  sc.detail(ellipsoid(0.75, 0.32, 0.6, 10, 6), { col: 0xef7f96, bone: b('head'), pos: [0.25, 19.1, 19.3], surf: SURF.skin });
  // the long floppy ears, curly at the edges
  for (const [s, n] of LEGS) {
    sc.add({ t: 'ell', c: [s * 5.6, 20.4, 12.6], r: [1.9, 5.2, 3] }, { col: charcoal, surf: SURF.cloth, bone: b(`ear${n}`), k: 1.2 });
    curls(`ear${n}`, 8, () => [s * (5.9 + r() * 0.6), 16 + r() * 8, 12.6 + (r() - 0.5) * 4.6], [1, 1.4], charcoal);
  }
  // fluffy white legs and paws
  for (const [s, n] of LEGS) {
    sc.add({ t: 'cap', a: [s * 3.2, 11.5, 7.5], b: [s * 3.2, 4.6, 7.8], ra: 2.2, rb: 2 }, { col: white, surf: SURF.cloth, bone: b(`legF${n}`), k: 1 });
    sc.add({ t: 'cap', a: [s * 3.2, 4.6, 7.8], b: [s * 3.2, 1.1, 8.6], ra: 2, rb: 2.2 }, { col: white, surf: SURF.cloth, bone: b(`pawF${n}`), k: 0.9 });
    sc.add({ t: 'cap', a: [s * 3.4, 12.2, -7.5], b: [s * 3.4, 6.5, -6.4], ra: 3, rb: 2.1 }, { col: coat, surf: SURF.cloth, bone: b(`legB${n}`), k: 1.4 });
    sc.add({ t: 'cap', a: [s * 3.4, 6.5, -6.4], b: [s * 3.4, 1.1, -7], ra: 2, rb: 2.2 }, { col: white, surf: SURF.cloth, bone: b(`pawB${n}`), k: 0.9 });
    curls(`pawF${n}`, 4, () => [s * 3.2 + (r() - 0.5) * 3, 1.6 + r() * 2, 8.4 + (r() - 0.5) * 3], [1, 1.3], white);
    curls(`pawB${n}`, 4, () => [s * 3.4 + (r() - 0.5) * 3, 1.6 + r() * 2, -7 + (r() - 0.5) * 3], [1, 1.3], white);
  }
  // the plume of a tail, up and curling
  sc.add({ t: 'cap', a: [0, 16, -10.5], b: [0, 20, -13.5], ra: 1.9, rb: 2.2 }, { col: white, surf: SURF.cloth, bone: b('tail1'), k: 1 });
  sc.add({ t: 'cap', a: [0, 20, -13.5], b: [0, 24, -13], ra: 2.2, rb: 1.5 }, { col: white, surf: SURF.cloth, bone: b('tail2'), k: 1 });
  curls('tail2', 8, () => [(r() - 0.5) * 3.2, 20 + r() * 4.6, -13.4 + (r() - 0.5) * 3], [1.1, 1.5], white);
  const clips: Clips = {
    move: { frames: 18, fn: (t) => ({
      ...trot(t, 1.1),
      body: { ty: 0.9 * Math.abs(sin(t, 2)) - 0.4 }, head: { rx: 0.08 * sin(t, 2) },
      earL: { rz: 0.25 * sin(t, 2) }, earR: { rz: -0.25 * sin(t, 2) },
      tail1: { rx: -0.25, ry: 0.55 * sin(t, 2) }, tail2: { ry: 0.45 * sin(t, 2, 0.2) },
    }) },
    // standing: the tail going, a tilt of the head now and then, a little pant
    idle: { frames: 120, fn: (t) => ({
      body: { ty: 0.18 * sin(t, 8) },
      head: { rz: 0.28 * pulse(t, 0.4, 0.12), rx: 0.04 * sin(t, 8) },
      earL: { rz: 0.12 * pulse(t, 0.4, 0.12) }, earR: { rz: 0.12 * pulse(t, 0.4, 0.12) },
      tail1: { rx: -0.3, ry: 0.5 * sin(t, 6) }, tail2: { ry: 0.4 * sin(t, 6, 0.2) },
    }) },
  };
  return { geo: sc.build({ ao: 0.45 }), rig: new Rig(bones, clips) };
}

/** Builders for the companions, keyed as creatures. */
export const PET_BUILDERS: Record<string, () => SculptModel> = {
  pet_milo: milo,
  pet_augustus: augustus,
};

