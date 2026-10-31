// Enemy models (D-38). Each attraction-turned-monster gets a silhouette that reads at a glance from
// the high camera, weathered paint, and a point of emissive "wrongness" (eyes, mouths, bulbs) so it
// stays legible in the dark. Built at world scale; models face +Z.

import * as THREE from 'three';
import { C, box, cone, cyl, ellipsoid, extrude, lathe, rbox, smoothShape, sphere, starShape, torus, tube, vnoise, weather, stripes, bands, type ColorFn, type V3 } from '../core/geo';
import { ModelBuilder, PAL, PART, SURF, body, bulb, coneHat, eyes, glove, limb, ruff, shoe, stitches } from './kit';
import type { ModelDef } from './index';

const RIM_WARM: [number, number, number, number] = [0.9, 0.55, 0.35, 0.6];
const RIM_COLD: [number, number, number, number] = [0.5, 0.65, 0.9, 0.55];
const RIM_SICK: [number, number, number, number] = [0.6, 0.85, 0.35, 0.55];

// ---------------------------------------------------------------- balloons
function balloon(r: number, face: boolean): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const prof: [number, number][] = [[0, 0], [r * 0.25, r * 0.08], [r * 0.7, r * 0.45], [r * 0.98, r * 1.1], [r * 0.92, r * 1.6], [r * 0.6, r * 1.95], [0, r * 2.08]];
  const latex: ColorFn = (p) => {
    const sheen = 0.62 + 0.18 * Math.max(0, p.x / r * 0.5 + p.y / (r * 2) * 0.5);
    return C(0xffffff).multiplyScalar(sheen);
  };
  body(m, prof, latex, { surf: [0.42, 0], segs: 16 });
  m.add(cone(r * 0.2, r * 0.25, 8), { col: 0xd8d8d8, pos: [0, -r * 0.06, 0], rot: [Math.PI, 0, 0], surf: SURF.latex });
  // the string: sways
  m.add(tube([[0, -r * 0.15, 0], [r * 0.15, -r * 0.8, 0.5], [-r * 0.1, -r * 1.5, -0.5], [r * 0.12, -r * 2.2, 0]], 0.35, 4, 16), { col: PAL.dirty, part: PART.SWAY, pivot: [0, 0, 0], surf: SURF.cloth });
  if (face) {
    // hollow carved eyes that glow a sick yellow, and a stitched grin
    for (const s of [-1, 1]) m.add(ellipsoid(r * 0.17, r * 0.24, r * 0.1, 8, 6), { col: PAL.sickYellow, pos: [s * r * 0.36, r * 1.25, r * 0.88], rot: [0, s * 0.35, s * -0.25], emit: 0.9, surf: SURF.glass });
    const grin = new THREE.Shape();
    grin.moveTo(-r * 0.5, 0);
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      grin.lineTo(-r * 0.5 + t * r, -Math.sin(t * Math.PI) * r * 0.22 + (i % 2 ? r * 0.08 : 0));
    }
    grin.lineTo(r * 0.5, r * 0.05);
    grin.lineTo(-r * 0.5, r * 0.05);
    m.add(extrude(grin, r * 0.12, 0, 2), { col: PAL.ink, pos: [0, r * 0.88, r * 0.9], rot: [-0.12, 0, 0], surf: SURF.latex });
  }
  return m.build({ ao: 0.2 });
}

function livingBalloon(): THREE.BufferGeometry {
  return balloon(17, true);
}
function swarmBalloon(): THREE.BufferGeometry {
  return balloon(11, true);
}

// ---------------------------------------------------------------- wind-up monkey
function windUpMonkey(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const fur = weather(0x5a4030, 0.4, 0.15);
  const tin = weather(PAL.red, 0.5, 0.1, PAL.iron);
  // tin body with a vest, stubby legs
  body(m, [[0, 10], [9, 10.5], [11, 16], [11, 24], [8, 30], [0, 31]], tin, { surf: SURF.paint, scale: [1, 1, 0.9] });
  m.add(cyl(11.2, 11.2, 2, 14, true), { col: PAL.brass, pos: [0, 18, 0], scale: [1, 1, 0.9], surf: SURF.brass });
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.LEG_L : PART.LEG_R;
    m.add(cyl(3.2, 3.6, 10, 8), { col: fur, pos: [s * 5, 6, 0], part, pivot: [s * 5, 11, 0], surf: SURF.plush });
    m.add(ellipsoid(4, 2.4, 5.4, 8, 6), { col: PAL.ink, pos: [s * 5, 1.4, 1.2], part, pivot: [s * 5, 11, 0], surf: SURF.rubber });
  }
  // head: grinning muzzle, too many teeth, glassy eyes
  const hp: V3 = [0, 31, 0];
  m.add(sphere(10, 14, 10), { col: fur, pos: [0, 39, 0], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  m.add(ellipsoid(7, 5.4, 5, 12, 8), { col: weather(0xc9a07e, 0.35), pos: [0, 36.5, 6.4], part: PART.HEAD, pivot: hp, surf: SURF.skin });
  m.add(ellipsoid(5.2, 1.6, 2, 10, 4), { col: PAL.bone, pos: [0, 34.6, 10.4], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  for (const s of [-1, 1]) {
    m.add(ellipsoid(3.8, 4.6, 2.4, 10, 8), { col: weather(0xc9a07e, 0.35), pos: [s * 10.4, 40, 0], part: PART.HEAD, pivot: hp, surf: SURF.skin });
  }
  eyes(m, { x: 3.6, y: 41, z: 7.6, r: 2.4, sclera: PAL.bone, color: PAL.hotRed, glow: 0.8, pivot: hp });
  // fez with a tassel
  m.add(cyl(4.2, 5.2, 6, 12), { col: PAL.blood, pos: [0, 50, -0.6], rot: [-0.2, 0, 0.15], part: PART.HEAD, pivot: hp, surf: SURF.velvet });
  m.add(tube([[0, 53, -1], [3, 52, -3], [4.6, 47, -3.4]], 0.5, 4, 8), { col: PAL.gold, part: PART.HEAD, pivot: hp, surf: SURF.gold });
  // arms with cymbals (they clash on the wind-up)
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.ARM_L : PART.ARM_R;
    const pv: V3 = [s * 10, 27, 0];
    limb(m, pv, [s * 13, 17, 6], 2.4, fur, part, pv, [s * 2, 0, 0], SURF.plush);
    m.add(lathe([[0, 0.8], [6.2, 0], [6.6, -0.4], [0, -0.6]], 14), { col: PAL.brass, pos: [s * 12, 16, 9], rot: [Math.PI / 2, 0, s * 0.4], part, pivot: pv, surf: SURF.brass });
  }
  // the wind-up key turns
  m.add(cyl(1, 1, 7, 6), { col: PAL.brass, pos: [0, 22, -11], rot: [Math.PI / 2, 0, 0], part: PART.SPIN, pivot: [0, 22, -13], surf: SURF.brass });
  for (const s of [-1, 1]) m.add(torus(3, 1, 6, 10), { col: PAL.brass, pos: [s * 3.6, 22, -14.5], rot: [0, Math.PI / 2, 0], part: PART.SPIN, pivot: [0, 22, -13], surf: SURF.brass });
  return m.build();
}

// ---------------------------------------------------------------- possessed stuffie
function stuffie(scale = 1): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const plush = weather(0x7a6250, 0.45, 0.2, 0x9a8a70);
  const s = scale;
  body(m, [[0, 6 * s], [11 * s, 7 * s], [14 * s, 15 * s], [13 * s, 24 * s], [9 * s, 30 * s], [0, 31 * s]], plush, { surf: SURF.plush });
  m.add(ellipsoid(8 * s, 9 * s, 3 * s, 10, 8), { col: weather(0xa89478, 0.3), pos: [0, 17 * s, 9.6 * s], surf: SURF.plush });
  stitches(m, [0, 25 * s, 10.6 * s], [0, 10 * s, 11.2 * s], 6, PAL.ink, PART.BODY, undefined, 1.1 * s);
  // stuffing bursting from a torn seam
  for (let i = 0; i < 5; i++) m.add(sphere((2 + (i % 3)) * s, 6, 5), { col: PAL.cream, pos: [(-9 + i * 1.6) * s, (19 + (i % 2) * 2.5) * s, (8.5 - i * 0.6) * s], surf: SURF.plush });
  for (const sd of [-1, 1]) {
    const leg = sd > 0 ? PART.LEG_L : PART.LEG_R;
    m.add(ellipsoid(5 * s, 6 * s, 5.4 * s, 8, 6), { col: plush, pos: [sd * 7 * s, 4 * s, 1 * s], part: leg, pivot: [sd * 7 * s, 9 * s, 0], surf: SURF.plush });
    const arm = sd > 0 ? PART.ARM_L : PART.ARM_R;
    m.add(ellipsoid(4 * s, 7.5 * s, 4 * s, 8, 6), { col: plush, pos: [sd * 14 * s, 20 * s, 2 * s], rot: [0, 0, sd * 0.5], part: arm, pivot: [sd * 11 * s, 26 * s, 0], surf: SURF.plush });
  }
  const hp: V3 = [0, 30 * s, 0];
  m.add(sphere(11 * s, 14, 10), { col: plush, pos: [0, 39 * s, 0], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  for (const sd of [-1, 1]) {
    m.add(sphere(4.4 * s, 8, 6), { col: plush, pos: [sd * 9 * s, 48 * s, -1 * s], part: PART.HEAD, pivot: hp, surf: SURF.plush });
    m.add(sphere(2.6 * s, 8, 6), { col: weather(0xa89478, 0.3), pos: [sd * 9 * s, 48 * s, 1.4 * s], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  }
  m.add(ellipsoid(5.4 * s, 4.2 * s, 4 * s, 10, 8), { col: weather(0xa89478, 0.3), pos: [0, 36 * s, 8.6 * s], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  m.add(ellipsoid(1.8 * s, 1.3 * s, 1.2 * s, 6, 4), { col: PAL.ink, pos: [0, 38 * s, 12.2 * s], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  // one button eye; the other hangs by a thread and glows from inside the socket
  m.add(cyl(2.2 * s, 2.2 * s, 1 * s, 10), { col: PAL.ink, pos: [4 * s, 42 * s, 9.2 * s], rot: [Math.PI / 2 - 0.3, 0, 0], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  m.add(sphere(1.6 * s, 6, 4), { col: PAL.hotRed, pos: [-4 * s, 42 * s, 9 * s], emit: 1, part: PART.HEAD, pivot: hp, surf: SURF.glass });
  m.add(tube([[-4 * s, 41 * s, 9.6 * s], [-5 * s, 38 * s, 11 * s], [-5.4 * s, 35 * s, 11.4 * s]], 0.3 * s, 3, 6), { col: PAL.ink, part: PART.HEAD, pivot: hp, surf: SURF.cloth });
  m.add(cyl(2.2 * s, 2.2 * s, 1 * s, 10), { col: PAL.ink, pos: [-5.4 * s, 34 * s, 11.6 * s], rot: [Math.PI / 2, 0, 0.4], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  stitches(m, [-4 * s, 33.6 * s, 10.6 * s], [4 * s, 33.6 * s, 10.6 * s], 5, PAL.ink, PART.HEAD, hp, 1 * s);
  return m.build();
}

// ---------------------------------------------------------------- cotton-candy slime
function cottonCandySlime(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const n = 9;
  // lumpy spun-sugar mass: overlapping noisy blobs
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = 10 + vnoise(i, 1, 2) * 4;
    m.add(ellipsoid(rr, rr * 0.8, rr, 10, 8), { col: weather(0xb5788f, 0.35, 0.2, 0xd5a0b3), pos: [Math.cos(a) * 9, 9 + vnoise(i, 3, 1) * 5, Math.sin(a) * 9], surf: SURF.plush });
  }
  m.add(ellipsoid(15, 15, 15, 14, 10), { col: weather(0xc08aa0, 0.3, 0.12, 0xe0b5c5), pos: [0, 19, 0], surf: SURF.plush });
  m.add(ellipsoid(10, 11, 10, 12, 8), { col: weather(0xc08aa0, 0.3), pos: [2, 31, -2], surf: SURF.plush });
  // the paper cone it was spun on, now impaled through it
  m.add(cone(5, 26, 12), { col: stripes(6, PAL.cream, PAL.red, 0, 0.4), pos: [-4, 38, -6], rot: [0.3, 0, 0.35], surf: SURF.canvas });
  // sunken black eyes and a drooling mouth
  for (const s of [-1, 1]) m.add(ellipsoid(2.8, 3.6, 2, 8, 6), { col: PAL.ink, pos: [s * 5, 24, 13.6], rot: [0, s * 0.3, 0], surf: SURF.porcelain });
  for (const s of [-1, 1]) m.add(sphere(0.9, 6, 4), { col: PAL.sickYellow, pos: [s * 5, 24.6, 15], emit: 1, surf: SURF.glass });
  m.add(ellipsoid(5, 3, 2.4, 10, 6), { col: PAL.redDeep, pos: [0, 15.5, 14.2], surf: SURF.latex });
  m.add(tube([[2, 13, 15], [2.6, 8, 16], [2.2, 3, 16.4]], (t) => 1.2 - t * 0.6, 5, 8), { col: weather(0xd8a5b8, 0.2), part: PART.SWAY, pivot: [2, 13, 15], surf: SURF.latex });
  return m.build({ ao: 0.35 });
}

// ---------------------------------------------------------------- whack-a-mole
function moleHole(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(lathe([[13, 0], [15, 1.4], [13.6, 3.2], [9.5, 3.4], [9, 0.6], [0, 0.6]], 16), { col: weather(PAL.wood, 0.5), surf: SURF.wood });
  m.add(cyl(9.2, 9.2, 0.4, 14), { col: PAL.ink, pos: [0, 0.9, 0], surf: SURF.cloth });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    m.add(sphere(2.6, 6, 4), { col: weather(0x3a2c20, 0.4), pos: [Math.cos(a) * 15, 0.8, Math.sin(a) * 15], scale: [1.4, 0.6, 1], surf: SURF.cloth });
  }
  return m.build({ ao: 0.2 });
}

function whackAMole(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const fur = weather(0x4a3a30, 0.45, 0.2);
  body(m, [[0, 0], [11, 0], [11.5, 10], [10, 22], [6, 29], [0, 30]], fur, { surf: SURF.plush });
  m.add(ellipsoid(6, 5, 4, 10, 8), { col: weather(0xb08a7a, 0.3), pos: [0, 21, 8.4], surf: SURF.skin });
  m.add(sphere(2.4, 8, 6), { col: 0x9a5060, pos: [0, 23, 12.4], surf: SURF.skin });
  m.add(rbox(4.2, 4.6, 1.4, 0.4), { col: PAL.bone, pos: [0, 17.6, 11.2], surf: SURF.porcelain });
  eyes(m, { x: 3.8, y: 25.5, z: 8.4, r: 1.6, color: PAL.hotRed, glow: 0.9 });
  // dented hard hat from a thousand mallet blows
  m.add(lathe([[0, 9], [8, 8.4], [10.4, 3], [12.4, 0.6], [12.4, 0], [0, 0]], 14), { col: weather(PAL.mustard, 0.55, 0.15, PAL.iron), pos: [0, 26, -0.5], rot: [-0.15, 0, 0.2], surf: SURF.paint });
  // digging claws
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.ARM_L : PART.ARM_R;
    m.add(ellipsoid(4.2, 2.4, 5, 8, 6), { col: weather(0xb08a7a, 0.3), pos: [s * 9, 13, 8], part, pivot: [s * 8, 16, 2], surf: SURF.skin });
    for (let k = 0; k < 3; k++) m.add(cone(0.8, 3.6, 5), { col: PAL.bone, pos: [s * (7.5 + k * 1.4), 12.4, 12.2], rot: [Math.PI / 2, 0, 0], part, pivot: [s * 8, 16, 2], surf: SURF.bone });
  }
  return m.build();
}

// ---------------------------------------------------------------- evil clown
function evilClown(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const suit = stripes(8, 0x5e6e3a, PAL.cream, 0.05, 0.45);
  const hp: V3 = [0, 62, 0];
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.LEG_L : PART.LEG_R;
    const pv: V3 = [s * 7, 32, 0];
    m.add(lathe([[0, 0], [5.4, 0], [6.8, 12], [6, 24], [0, 25]], 10), { col: suit, pos: [s * 7, 7, 0], part, pivot: pv, surf: SURF.cloth });
    shoe(m, [s * 7.4, 0, -3], 17, PAL.redDeep, part, pv, 0.2);
  }
  // baggy pierrot suit with big pom buttons
  body(m, [[0, 26], [13, 27], [16, 36], [15.5, 48], [12, 58], [6, 62], [0, 63]], suit, { segs: 18, scale: [1, 1, 0.86] });
  for (let i = 0; i < 3; i++) m.add(sphere(2.4, 8, 6), { col: i === 1 ? PAL.mustard : PAL.blood, pos: [0, 36 + i * 7, 13.4 - i * 0.7], surf: SURF.plush });
  ruff(m, 60.5, 13, PAL.cream, PART.BODY, undefined, 16);
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.ARM_L : PART.ARM_R;
    const pv: V3 = [s * 13, 56, 0];
    limb(m, pv, [s * 17, 36, 6], (t) => 4.4 - t * 1.2, suit, part, pv, [s * 3, 0, 0]);
    glove(m, [s * 17.5, 33, 6.4], 4.4, part, pv, PAL.bone);
  }
  // a cream pie in the right hand
  m.add(cyl(6.4, 5.2, 2.6, 14), { col: PAL.woodPale, pos: [-18, 30, 12], part: PART.ARM_R, pivot: [-13, 56, 0], surf: SURF.wood });
  m.add(ellipsoid(6.2, 2.6, 6.2, 12, 6), { col: PAL.cream, pos: [-18, 32, 12], part: PART.ARM_R, pivot: [-13, 56, 0], surf: SURF.porcelain });
  // greasepaint face: chalk white, a red slash of a grin, diamond eyes
  m.add(ellipsoid(12.5, 13.5, 12, 16, 12), { col: weather(PAL.clown, 0.25, 0.12), pos: [0, 72, 0], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  for (const s of [-1, 1]) m.add(ellipsoid(2.2, 4.8, 1, 6, 4), { col: PAL.ink, pos: [s * 4.6, 75, 11.2], rot: [0, s * 0.35, 0], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  eyes(m, { x: 4.6, y: 74.4, z: 11.2, r: 1.3, color: PAL.amber, glow: 1, pivot: hp });
  m.add(sphere(3.2, 10, 8), { col: PAL.blood, pos: [0, 70, 12.6], part: PART.HEAD, pivot: hp, surf: SURF.latex });
  m.add(tube([[-8, 67.5, 9.5], [-4, 64.5, 11.6], [0, 64, 12.2], [4, 64.5, 11.6], [8, 67.5, 9.5]], 1.4, 5, 14), { col: PAL.blood, part: PART.HEAD, pivot: hp, surf: SURF.latex });
  for (let i = 0; i < 6; i++) m.add(cone(0.7, 2.2, 4), { col: PAL.bone, pos: [-4.5 + i * 1.8, 65, 12.2], rot: [Math.PI, 0, 0], part: PART.HEAD, pivot: hp, surf: SURF.bone });
  // tufts of hair and a dented cone hat
  for (const s of [-1, 1]) m.add(ellipsoid(5, 4, 5, 8, 6), { col: weather(0xa04a2a, 0.3), pos: [s * 11, 75, -2], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  coneHat(m, 82, 6.4, 18, stripes(4, PAL.mustard, PAL.redDeep, 0, 0.4), PAL.cream, PART.HEAD, hp, [-0.2, 0, 0.3]);
  return m.build();
}

// ---------------------------------------------------------------- jack-in-the-box
function jackBox(open: boolean): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const panel: ColorFn = (p, n) => {
    const side = Math.abs(n.x) > 0.5 ? 0 : Math.abs(n.z) > 0.5 ? 1 : 2;
    return weather([PAL.teal, PAL.red, PAL.mustard][side], 0.45, 0.1, PAL.woodPale)(p, n);
  };
  m.add(rbox(26, 24, 26, 2, 2), { col: panel, pos: [0, 12, 0], surf: SURF.paint, flat: false });
  // painted star decals
  for (const s of [-1, 1]) m.add(extrude(starShape(5, 6, 2.6), 0.6, 0, 1), { col: PAL.cream, pos: [s * 13.2, 12, 0], rot: [0, s * Math.PI / 2, 0], surf: SURF.paint });
  m.add(extrude(starShape(5, 6, 2.6), 0.6, 0, 1), { col: PAL.cream, pos: [0, 12, 13.2], surf: SURF.paint });
  // the crank turns
  m.add(cyl(1, 1, 6, 6), { col: PAL.brass, pos: [16, 14, 0], rot: [0, 0, Math.PI / 2], surf: SURF.brass });
  m.add(box(1.6, 9, 1.6), { col: PAL.brass, pos: [19, 11, 0], part: PART.SPIN, pivot: [19, 14, 0], surf: SURF.brass, rot: [0, 0, 0] });
  m.add(sphere(1.8, 6, 4), { col: PAL.redDeep, pos: [19, 7, 2], part: PART.SPIN, pivot: [19, 14, 0], surf: SURF.paint });
  if (!open) {
    m.add(rbox(27, 3, 27, 1.2, 2), { col: weather(PAL.redDeep, 0.4), pos: [0, 25.4, 0], surf: SURF.paint });
    return m.build();
  }
  // lid flung open
  m.add(rbox(27, 3, 27, 1.2, 2), { col: weather(PAL.redDeep, 0.4), pos: [0, 37, -13.5], rot: [-1.45, 0, 0], surf: SURF.paint });
  // spring neck
  m.add(tube(Array.from({ length: 28 }, (_, i) => [Math.cos(i * 1.4) * 5, 24 + i * 1.3, Math.sin(i * 1.4) * 5] as V3), 0.9, 4, 120), { col: PAL.iron, part: PART.SWAY, pivot: [0, 24, 0], surf: SURF.iron });
  // the jack: harlequin collar, lantern jaw, mad eyes
  const hp: V3 = [0, 58, 0];
  ruff(m, 60, 12, PAL.mustard, PART.HEAD, hp, 12);
  m.add(ellipsoid(10, 12, 10, 14, 10), { col: weather(PAL.clown, 0.25), pos: [0, 70, 0], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  m.add(ellipsoid(8, 4, 6, 10, 6), { col: weather(PAL.clown, 0.25), pos: [0, 62, 5], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  eyes(m, { x: 4, y: 73, z: 8.6, r: 2.6, sclera: PAL.bone, color: PAL.ember, glow: 1, pivot: hp });
  m.add(ellipsoid(6, 2.4, 2, 10, 4), { col: PAL.ink, pos: [0, 63, 10.4], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  for (const s of [-1, 1]) m.add(cone(4.4, 14, 8), { col: s > 0 ? PAL.red : PAL.teal, pos: [s * 7, 84, 0], rot: [0, 0, -s * 0.7], part: PART.HEAD, pivot: hp, surf: SURF.cloth });
  for (const s of [-1, 1]) m.add(sphere(2, 6, 4), { col: PAL.gold, pos: [s * 13, 89, 0], part: PART.HEAD, pivot: hp, surf: SURF.brass });
  return m.build();
}

// ---------------------------------------------------------------- dunk-tank clown
function dunkTankClown(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const suit = stripes(10, PAL.navy, PAL.cream, 0, 0.35);
  const hp: V3 = [0, 50, 0];
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.LEG_L : PART.LEG_R;
    const pv: V3 = [s * 6, 24, 0];
    limb(m, pv, [s * 6.4, 5, 1], 3.6, PAL.clown, part, pv, [0, 0, 1], SURF.skin);
    shoe(m, [s * 6.6, 0, -2.4], 14, PAL.teal, part, pv);
  }
  // soggy striped bathing suit
  body(m, [[0, 20], [11, 21], [13.4, 30], [13, 42], [9, 48], [0, 49]], suit, { scale: [1, 1, 0.86] });
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.ARM_L : PART.ARM_R;
    const pv: V3 = [s * 12, 45, 0];
    limb(m, pv, [s * 15, 28, 5], 3.2, PAL.clown, part, pv, [s * 2, 0, 0], SURF.skin);
    glove(m, [s * 15.5, 25, 5.4], 3.8, part, pv, PAL.bone);
  }
  // a dripping bucket hung on the left arm
  m.add(lathe([[0, 0], [5, 0], [6.4, 9], [0, 9]], 12), { col: weather(PAL.iron, 0.5), pos: [17, 13, 6], part: PART.ARM_L, pivot: [12, 45, 0], surf: SURF.iron });
  m.add(cyl(5.8, 5.8, 0.6, 12), { col: 0x203a48, pos: [17, 21.4, 6], part: PART.ARM_L, pivot: [12, 45, 0], emit: 0.15, surf: SURF.glass });
  m.add(torus(6.2, 0.4, 4, 12, Math.PI), { col: PAL.iron, pos: [17, 22, 6], part: PART.ARM_L, pivot: [12, 45, 0], surf: SURF.iron });
  // drowned face: sagging greasepaint, blue lips, waterlogged hair
  m.add(ellipsoid(11, 12, 10.5, 14, 10), { col: weather(0xb8c2c0, 0.3), pos: [0, 59, 0], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  for (const s of [-1, 1]) m.add(ellipsoid(2, 3.6, 1, 6, 4), { col: PAL.navy, pos: [s * 4.2, 58.4, 9.8], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  eyes(m, { x: 4.2, y: 61, z: 9.6, r: 1.6, color: PAL.cold, glow: 0.9, pivot: hp });
  m.add(sphere(2.6, 8, 6), { col: PAL.blood, pos: [0, 57.4, 11], part: PART.HEAD, pivot: hp, surf: SURF.latex });
  m.add(ellipsoid(4.6, 1.6, 2, 8, 4), { col: 0x3a4c6a, pos: [0, 53, 9.6], part: PART.HEAD, pivot: hp, surf: SURF.latex });
  for (let i = 0; i < 7; i++) {
    const a = -1.4 + i * 0.47;
    m.add(tube([[Math.sin(a) * 9, 66, Math.cos(a) * 7 - 2], [Math.sin(a) * 12, 60, Math.cos(a) * 9 - 3], [Math.sin(a) * 12.4, 52, Math.cos(a) * 9 - 4]], 1.4, 4, 6), { col: weather(0x3a5048, 0.3), part: PART.HEAD, pivot: hp, surf: SURF.latex });
  }
  return m.build();
}

// ---------------------------------------------------------------- puppet soldier
function puppetSoldier(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const coat = weather(PAL.red, 0.45, 0.1, PAL.woodPale);
  const wood = weather(PAL.woodPale, 0.35, 0.1);
  const hp: V3 = [0, 60, 0];
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.LEG_L : PART.LEG_R;
    const pv: V3 = [s * 6, 33, 0];
    m.add(cyl(3.4, 3, 15, 8), { col: weather(PAL.navy, 0.4), pos: [s * 6, 24, 0], part, pivot: pv, surf: SURF.paint });
    m.add(sphere(3.4, 8, 6), { col: wood, pos: [s * 6, 16.5, 0], part, pivot: pv, surf: SURF.wood });
    m.add(cyl(3.2, 3.4, 13, 8), { col: PAL.ink, pos: [s * 6, 8, 0], part, pivot: pv, surf: SURF.paint });
    m.add(rbox(6.5, 3, 10, 1), { col: PAL.ink, pos: [s * 6, 1.5, 1.8], part, pivot: pv, surf: SURF.paint });
  }
  body(m, [[0, 31], [10, 31.5], [11, 40], [11.5, 52], [10, 57], [0, 58]], coat, { scale: [1, 1, 0.8], surf: SURF.paint, smooth: 0 });
  // white cross-belts and brass buttons
  m.add(rbox(3, 30, 1, 0.5), { col: PAL.bone, pos: [0, 45, 9.4], rot: [0, 0, 0.5], surf: SURF.paint });
  m.add(rbox(3, 30, 1, 0.5), { col: PAL.bone, pos: [0, 45, 9.6], rot: [0, 0, -0.5], surf: SURF.paint });
  for (let i = 0; i < 4; i++) m.add(sphere(0.9, 6, 4), { col: PAL.brass, pos: [0, 35 + i * 5.5, 9.8], surf: SURF.brass });
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.ARM_L : PART.ARM_R;
    const pv: V3 = [s * 12, 55, 0];
    m.add(sphere(3.6, 8, 6), { col: wood, pos: [s * 12.4, 55, 0], part, pivot: pv, surf: SURF.wood });
    m.add(cyl(3, 2.8, 20, 8), { col: coat, pos: [s * 13.2, 44, 1], part, pivot: pv, surf: SURF.paint });
    m.add(sphere(2.8, 8, 6), { col: wood, pos: [s * 13.4, 33, 2], part, pivot: pv, surf: SURF.wood });
  }
  // musket shouldered on the right
  m.add(cyl(1.1, 1.3, 46, 6), { col: PAL.woodDark, pos: [-15, 48, 4], rot: [0.05, 0, -0.08], part: PART.ARM_R, pivot: [-12, 55, 0], surf: SURF.wood });
  m.add(cyl(0.7, 0.7, 20, 6), { col: PAL.iron, pos: [-14, 76, 4.6], rot: [0.05, 0, -0.08], part: PART.ARM_R, pivot: [-12, 55, 0], surf: SURF.iron });
  // painted wooden face with rosy cheeks, round peg nose; tall busby hat
  m.add(sphere(9.6, 14, 10), { col: wood, pos: [0, 67, 0], part: PART.HEAD, pivot: hp, surf: SURF.wood });
  for (const s of [-1, 1]) m.add(cyl(2, 2, 0.4, 10), { col: 0xa04a40, pos: [s * 5.6, 64.6, 7.6], rot: [Math.PI / 2, 0, s * 0.6], part: PART.HEAD, pivot: hp, surf: SURF.paint });
  eyes(m, { x: 3.4, y: 68.6, z: 8.6, r: 1.2, color: PAL.ink, pivot: hp });
  m.add(sphere(1.4, 6, 4), { col: weather(PAL.woodPale, 0.2), pos: [0, 66.4, 9.8], part: PART.HEAD, pivot: hp, surf: SURF.wood });
  m.add(ellipsoid(3, 0.8, 1, 8, 4), { col: PAL.ink, pos: [0, 62.6, 8.8], part: PART.HEAD, pivot: hp, surf: SURF.paint });
  m.add(lathe([[0, 0], [9.6, 0], [10.4, 10], [9.4, 20], [0, 21]], 14, 10), { col: weather(PAL.ink, 0.25, 0.3), pos: [0, 72, -0.5], part: PART.HEAD, pivot: hp, surf: SURF.velvet });
  m.add(rbox(4, 6, 2, 0.6), { col: PAL.brass, pos: [0, 77, 9.6], part: PART.HEAD, pivot: hp, surf: SURF.brass });
  m.add(tube([[0, 74, 9.6], [6, 71, 6], [9.4, 66, 0]], 0.5, 4, 8), { col: PAL.gold, part: PART.HEAD, pivot: hp, surf: SURF.gold });
  // marionette strings vanishing into the dark above
  for (const p of [[0, 93, 0], [13, 35, 2], [-13, 35, 2]] as V3[]) m.add(cyl(0.18, 0.18, 70, 3), { col: PAL.bone, pos: [p[0], p[1] + 35, p[2]], surf: SURF.cloth, emit: 0.2 });
  return m.build();
}

// ---------------------------------------------------------------- carousel horse
function carouselHorse(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const paint = weather(PAL.cream, 0.5, 0.09, PAL.woodPale);
  const gilt = weather(PAL.gold, 0.25);
  // the brass pole it was torn from still runs through its back
  m.add(cyl(1.6, 1.6, 120, 8), { col: stripes(10, PAL.brass, 0x6a5428, 0, 0.1), pos: [0, 60, -2], surf: SURF.brass });
  // carved body (galloping, nose to +Z)
  m.add(ellipsoid(10, 11, 22, 14, 10), { col: paint, pos: [0, 40, -2], rot: [-0.08, 0, 0], surf: SURF.paint });
  // neck + head thrown back
  m.add(tube([[0, 44, 14], [0, 54, 20], [0, 62, 22]], (t) => 7 - t * 2.5, 9, 10), { col: paint, surf: SURF.paint });
  const hp: V3 = [0, 58, 20];
  m.add(ellipsoid(5.6, 6.4, 12, 12, 8), { col: paint, pos: [0, 63, 28], rot: [0.5, 0, 0], part: PART.HEAD, pivot: hp, surf: SURF.paint });
  m.add(ellipsoid(4.6, 3, 4, 10, 6), { col: PAL.redDeep, pos: [0, 58.6, 36.6], part: PART.HEAD, pivot: hp, surf: SURF.paint });
  for (let i = 0; i < 5; i++) m.add(cone(0.7, 2.4, 4), { col: PAL.bone, pos: [-2.4 + i * 1.2, 57.6, 38.2], rot: [Math.PI, 0, 0], part: PART.HEAD, pivot: hp, surf: SURF.bone });
  eyes(m, { x: 4.6, y: 66, z: 28, r: 1.9, sclera: PAL.bone, color: PAL.hotRed, glow: 1, pivot: hp, angle: 0.3 });
  for (const s of [-1, 1]) m.add(cone(1.8, 5, 6), { col: paint, pos: [s * 3, 71.6, 23], rot: [-0.4, 0, s * 0.2], part: PART.HEAD, pivot: hp, surf: SURF.paint });
  // carved flame mane, gilded
  for (let i = 0; i < 6; i++) m.add(cone(3.4, 10, 6), { col: gilt, pos: [0, 51 + i * 2.6, 12 + i * 2.2], rot: [-1.1 - i * 0.12, 0, 0], surf: SURF.gold });
  // saddle, bridle, jewelled breast collar
  m.add(ellipsoid(10.6, 4, 10, 12, 6), { col: weather(PAL.velvet, 0.3), pos: [0, 50, -4], surf: SURF.velvet });
  m.add(torus(10.4, 1.2, 6, 18), { col: gilt, pos: [0, 41, 10], rot: [0.3, 0, 0], surf: SURF.gold });
  for (let i = 0; i < 5; i++) m.add(sphere(1.4, 6, 4), { col: [PAL.hotRed, PAL.ghost, PAL.amber][i % 3], pos: [-6 + i * 3, 36, 18], emit: 0.6, surf: SURF.glass });
  // legs: front pair reach forward, back pair kick — they swing with the gallop
  const legs: [number, number, number, number][] = [[5, 34, 12, PART.LEG_L], [-5, 34, 12, PART.LEG_R], [5, 34, -16, PART.LEG_R], [-5, 34, -16, PART.LEG_L]];
  for (const [x, y, z, part] of legs) {
    const front = z > 0;
    const pv: V3 = [x, y, z];
    m.add(tube([[x, y, z], [x, y - 12, z + (front ? 8 : -6)], [x, y - 26, z + (front ? 4 : -10)]], (t) => 3.2 - t * 1, 6, 8), { col: paint, part, pivot: pv, surf: SURF.paint });
    m.add(cyl(2.6, 3, 3.4, 8), { col: PAL.ink, pos: [x, y - 28, z + (front ? 4 : -10)], part, pivot: pv, surf: SURF.paint });
  }
  m.add(tube([[0, 42, -22], [0, 38, -30], [0, 30, -32]], (t) => 3 - t * 1.6, 6, 8), { col: gilt, part: PART.SWAY, pivot: [0, 42, -22], surf: SURF.gold });
  return m.build({ ao: 0.3 });
}

// ---------------------------------------------------------------- bumper car
function bumperCar(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const shell = weather(PAL.teal, 0.45, 0.1, PAL.iron);
  // heavy rubber bumper ring
  m.add(torus(19, 4.6, 8, 24), { col: PAL.charcoal, pos: [0, 6, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 1.15, 1], surf: SURF.rubber });
  // rounded tub body
  m.add(lathe([[0, 0], [18, 1], [19.5, 8], [17, 16], [0, 17]], 18, 10), { col: shell, pos: [0, 3, 0], scale: [1, 1, 1.15], surf: SURF.paint });
  // chrome grille of teeth, headlamp eyes
  for (let i = 0; i < 7; i++) m.add(rbox(1.6, 7, 2.4, 0.6), { col: PAL.bone, pos: [-6 + i * 2, 9.5, 21.6], surf: SURF.brass });
  for (const s of [-1, 1]) {
    m.add(cyl(3.6, 4, 2, 12), { col: PAL.brass, pos: [s * 9.6, 14, 19.2], rot: [Math.PI / 2 - 0.3, 0, 0], surf: SURF.brass });
    m.add(sphere(3, 10, 8), { col: PAL.sickYellow, pos: [s * 9.6, 14.2, 20.2], scale: [1, 1, 0.5], emit: 1, surf: SURF.glass });
  }
  // empty seat, steering wheel, the sparking pole
  m.add(rbox(16, 12, 6, 2), { col: weather(PAL.redDeep, 0.35), pos: [0, 22, -9], surf: SURF.velvet });
  m.add(torus(4, 0.8, 5, 12), { col: PAL.ink, pos: [0, 23, 5], rot: [-0.9, 0, 0], surf: SURF.rubber });
  m.add(cyl(1, 1, 40, 6), { col: PAL.iron, pos: [0, 40, -16], rot: [-0.08, 0, 0], surf: SURF.iron });
  m.add(sphere(2.2, 8, 6), { col: PAL.cold, pos: [0, 60, -17.6], emit: 1, surf: SURF.bulb });
  // painted number on the flank
  m.add(cyl(4.2, 4.2, 0.6, 12), { col: PAL.cream, pos: [19.6, 12, 0], rot: [0, 0, Math.PI / 2], surf: SURF.paint });
  m.add(cyl(4.2, 4.2, 0.6, 12), { col: PAL.cream, pos: [-19.6, 12, 0], rot: [0, 0, Math.PI / 2], surf: SURF.paint });
  return m.build({ ao: 0.3 });
}

// ---------------------------------------------------------------- walking ticket booth
function walkingTicketBooth(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const wood = weather(PAL.red, 0.5, 0.06, PAL.woodPale);
  // long jointed bird legs
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.LEG_L : PART.LEG_R;
    const pv: V3 = [s * 12, 48, 0];
    m.add(tube([[s * 12, 48, 0], [s * 16, 30, -10], [s * 13, 10, 2], [s * 13, 2, 4]], (t) => 3.6 - t * 1.4, 6, 14), { col: weather(0x8a7050, 0.4), part, pivot: pv, surf: SURF.skin });
    for (let k = 0; k < 3; k++) m.add(cone(1.4, 11, 5), { col: PAL.bone, pos: [s * 13 + (k - 1) * 4, 1.4, 8], rot: [Math.PI / 2, (k - 1) * 0.5, 0], part, pivot: pv, surf: SURF.bone });
  }
  // the booth: planked walls, arched window mouth, pagoda roof with a marquee sign
  m.add(rbox(44, 50, 38, 2, 2), { col: wood, pos: [0, 74, 0], surf: SURF.wood });
  for (let i = 0; i < 6; i++) m.add(box(44.6, 0.6, 38.6), { col: PAL.woodDark, pos: [0, 52 + i * 8.4, 0], surf: SURF.wood });
  const mouth = smoothShape([[-13, -4], [13, -4], [13, 8], [9, 14], [0, 16], [-9, 14], [-13, 8]], 30);
  m.add(extrude(mouth, 2, 0, 6), { col: PAL.ink, pos: [0, 70, 19.2], surf: SURF.paint });
  for (let i = 0; i < 8; i++) m.add(cone(1.6, 5, 4), { col: PAL.bone, pos: [-10.5 + i * 3, 83.5, 20.4], rot: [Math.PI, 0, 0], surf: SURF.bone });
  // a lolling tongue of tickets
  m.add(tube([[0, 68, 20], [0, 64, 26], [0, 58, 30], [1, 52, 30]], 3, 4, 12), { col: weather(PAL.cream, 0.3), part: PART.SWAY, pivot: [0, 68, 20], surf: SURF.paint, scale: [1.6, 1, 0.3] });
  eyes(m, { x: 11, y: 92, z: 19.6, r: 4, sclera: PAL.bone, color: PAL.amber, glow: 1, part: PART.BODY });
  m.add(lathe([[0, 22], [6, 21], [26, 6], [30, 0], [0, 0]], 4), { col: weather(PAL.mustard, 0.5, 0.08), pos: [0, 99, 0], rot: [0, Math.PI / 4, 0], surf: SURF.paint });
  m.add(rbox(36, 10, 2, 1), { col: PAL.woodDark, pos: [0, 108, 14], rot: [-0.25, 0, 0], surf: SURF.wood });
  for (let i = 0; i < 7; i++) bulb(m, [-15 + i * 5, 114, 12], 1.2, i % 2 ? PAL.amber : PAL.hotRed);
  return m.build({ ao: 0.4 });
}

// ---------------------------------------------------------------- roller-coaster snake
function coasterCar(head: boolean): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const paint = weather(head ? PAL.blood : PAL.red, 0.45, 0.1, PAL.iron);
  m.add(rbox(26, 14, 30, 4, 2), { col: paint, pos: [0, 14, 0], surf: SURF.paint });
  m.add(rbox(22, 6, 24, 2, 2), { col: PAL.ink, pos: [0, 20, -1], surf: SURF.velvet });
  for (const s of [-1, 1]) for (const z of [-9, 9]) m.add(cyl(4, 4, 3, 10), { col: PAL.iron, pos: [s * 13, 5, z], rot: [0, 0, Math.PI / 2], part: PART.SPIN, pivot: [s * 13, 5, z], surf: SURF.iron });
  m.add(cyl(1, 1, 24, 6), { col: PAL.brass, pos: [0, 24, 6], rot: [0, 0, Math.PI / 2], surf: SURF.brass });
  if (head) {
    // serpent face: hooded headlamp eyes and a hinged jaw of rail spikes
    m.add(lathe([[0, 0], [13, 0], [12, 12], [0, 16]], 12), { col: paint, pos: [0, 14, 16], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.75], surf: SURF.paint });
    for (const s of [-1, 1]) {
      m.add(ellipsoid(4, 3, 2, 10, 6), { col: PAL.hotRed, pos: [s * 7, 22, 22], emit: 1, surf: SURF.glass });
      m.add(cone(3, 10, 6), { col: PAL.ink, pos: [s * 10, 28, 8], rot: [-0.6, 0, -s * 0.4], surf: SURF.iron });
    }
    for (let i = 0; i < 7; i++) m.add(cone(1.1, 5, 4), { col: PAL.bone, pos: [-7 + i * 2.3, 9, 27], rot: [Math.PI / 2 + 0.6, 0, 0], surf: SURF.bone });
    m.add(rbox(22, 3, 14, 1, 1), { col: paint, pos: [0, 5.5, 22], rot: [0.25, 0, 0], surf: SURF.paint });
  }
  return m.build({ ao: 0.3 });
}

// ---------------------------------------------------------------- carnival brute
function carnivalBrute(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const sack = weather(PAL.canvas, 0.5, 0.15, PAL.canvasDark);
  const skin = weather(0xa98a74, 0.3, 0.1);
  const hp: V3 = [0, 96, 0];
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.LEG_L : PART.LEG_R;
    const pv: V3 = [s * 12, 48, 0];
    m.add(lathe([[0, 0], [8.6, 0], [9.6, 18], [8, 36], [0, 37]], 10), { col: stripes(10, PAL.redDeep, PAL.charcoal, 0, 0.4), pos: [s * 12, 10, 0], part, pivot: pv, surf: SURF.cloth });
    shoe(m, [s * 12.6, 0, -4], 22, PAL.leather, part, pv, 0.08);
  }
  // hulking torso in a striped singlet, belly overhanging a championship belt
  body(m, [[0, 44], [17, 45], [22, 56], [23, 70], [28, 84], [25, 92], [10, 97], [0, 98]], skin, { segs: 18, scale: [1, 1, 0.78], surf: SURF.skin });
  body(m, [[0, 44], [17.6, 45], [22.6, 56], [23.6, 70], [24, 76], [0, 77]], stripes(16, PAL.redDeep, PAL.charcoal, 0, 0.4), { segs: 18, scale: [1.02, 1, 0.8] });
  m.add(cyl(19, 19, 6, 18, true), { col: PAL.leather, pos: [0, 50, 0], scale: [1.1, 1, 0.9], surf: SURF.rubber });
  m.add(cyl(6, 6, 2, 14), { col: PAL.gold, pos: [0, 50, 17.4], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.ARM_L : PART.ARM_R;
    const pv: V3 = [s * 25, 88, 0];
    m.add(ellipsoid(9.6, 11, 9.6, 12, 10), { col: skin, pos: [s * 29, 80, 0], part, pivot: pv, surf: SURF.skin });
    limb(m, [s * 31, 72, 2], [s * 32, 52, 10], (t) => 7.2 - t * 1.6, skin, part, pv, [s * 2, 0, 0], SURF.skin);
    m.add(sphere(7, 10, 8), { col: skin, pos: [s * 32, 49, 11], part, pivot: pv, surf: SURF.skin });
    m.add(cyl(6.6, 6.6, 5, 10, true), { col: PAL.leather, pos: [s * 32, 56, 9], part, pivot: pv, surf: SURF.rubber });
  }
  // sledgehammer dragged in the right fist
  m.add(cyl(1.8, 1.8, 56, 6), { col: PAL.woodPale, pos: [-34, 30, 26], rot: [1.15, 0, 0.1], part: PART.ARM_R, pivot: [-25, 88, 0], surf: SURF.wood });
  m.add(rbox(14, 14, 24, 2, 2), { col: weather(PAL.iron, 0.4), pos: [-36, 18, 50], rot: [1.15, 0, 0.1], part: PART.ARM_R, pivot: [-25, 88, 0], surf: SURF.iron });
  // burlap sack hood with crude eye holes, stitched shut at the neck
  m.add(ellipsoid(14, 16, 14, 14, 12), { col: sack, pos: [0, 108, 1], part: PART.HEAD, pivot: hp, surf: SURF.canvas });
  m.add(cone(5, 9, 8), { col: sack, pos: [3, 124, -1], rot: [0.1, 0, -0.4], part: PART.HEAD, pivot: hp, surf: SURF.canvas });
  eyes(m, { x: 5.6, y: 110, z: 12, r: 3.2, color: PAL.ember, glow: 1, pivot: hp });
  stitches(m, [-8, 100, 12], [8, 100, 12], 7, PAL.ink, PART.HEAD, hp, 1.4);
  m.add(torus(11, 1.4, 6, 18), { col: PAL.straw, pos: [0, 96, 0], rot: [Math.PI / 2, 0, 0], part: PART.HEAD, pivot: hp, surf: SURF.cloth });
  return m.build();
}

import { CREATURE_IDS, creatureModel } from './creatures';

/** Enemies big enough to cast real shadows; the crowd gets soft blob shadows (performance). */
const BIG = new Set(['carousel_horse', 'walking_ticket_booth', 'carnival_brute', 'bumper_car', 'jack_in_the_box', 'jack_open', 'grand_mannequin', 'splitter', 'glasswalker']);

const LEGACY_MODELS: Record<string, ModelDef> = {
  living_balloon: { build: livingBalloon, anim: { a: [0, 0.03, 0, 0], b: [0.1, 0, 0, 0] }, rim: [0.9, 0.5, 0.35, 0.3], hover: 34, shadow: true },
  swarm_balloon: { build: swarmBalloon, anim: { a: [0, 0.04, 0, 0], b: [0.1, 0, 0, 0] }, rim: [0.9, 0.5, 0.35, 0.3], hover: 44, shadow: true },
  wind_up_monkey: { build: windUpMonkey, anim: { a: [2.2, 0.03, 0.7, 0.5], b: [0.12, 3, 0.25, 1.2] }, rim: RIM_WARM, shadow: true },
  possessed_stuffie: { build: () => stuffie(1), anim: { a: [2, 0.05, 0.5, 0.4], b: [0.12, 0, 0.2, 0.6] }, rim: RIM_WARM, shadow: true },
  mini_stuffie: { build: () => stuffie(0.62), anim: { a: [2.2, 0.06, 0.6, 0.5], b: [0.14, 0, 0.2, 0.6] }, rim: RIM_WARM, shadow: true },
  cotton_candy_slime: { build: cottonCandySlime, anim: { a: [1.4, 0.1, 0, 0], b: [0, 0, 0.15, 0] }, rim: RIM_SICK, shadow: true },
  whack_a_mole: { build: whackAMole, anim: { a: [0.8, 0.04, 0, 0.4], b: [0.15, 0, 0.3, 0.9] }, rim: RIM_WARM, shadow: true },
  mole_hole: { build: moleHole, rim: [0, 0, 0, 0] },
  evil_clown: { build: evilClown, anim: { a: [2.6, 0.03, 0.6, 0.55], b: [0.14, 0, 0.3, 1.4] }, rim: RIM_SICK, shadow: true },
  jack_in_the_box: { build: () => jackBox(false), anim: { a: [1, 0.06, 0, 0], b: [0, 6, 0.15, 0] }, rim: RIM_WARM, shadow: true },
  jack_open: { build: () => jackBox(true), anim: { a: [0, 0.08, 0, 0], b: [0.2, 6, 0, 0] }, rim: RIM_WARM, shadow: true },
  dunk_tank_clown: { build: dunkTankClown, anim: { a: [2, 0.03, 0.55, 0.45], b: [0.12, 0, 0.3, 1.2] }, rim: RIM_COLD, shadow: true },
  puppet_soldier: { build: puppetSoldier, anim: { a: [1.4, 0, 0.5, 0.15], b: [0.08, 0, 0.15, 0.9] }, rim: RIM_WARM, shadow: true },
  carousel_horse: { build: carouselHorse, anim: { a: [4, 0.02, 0.5, 0], b: [0.15, 0, 0.35, 0] }, rim: RIM_WARM, shadow: true },
  bumper_car: { build: bumperCar, anim: { a: [0.6, 0.02, 0, 0], b: [0, 4, 0.15, 0] }, rim: RIM_COLD, shadow: true },
  walking_ticket_booth: { build: walkingTicketBooth, anim: { a: [3, 0.02, 0.45, 0], b: [0, 0, 0.12, 0] }, rim: RIM_WARM, shadow: true },
  roller_coaster_snake: { build: () => coasterCar(true), anim: { a: [0.5, 0, 0, 0], b: [0, 12, 0.1, 0] }, rim: RIM_WARM, shadow: true },
  snake_seg: { build: () => coasterCar(false), anim: { a: [0.5, 0, 0, 0], b: [0, 12, 0, 0] }, rim: RIM_WARM, shadow: true },
  carnival_brute: { build: carnivalBrute, anim: { a: [2.4, 0.02, 0.4, 0.3], b: [0.08, 0, 0.3, 1.1] }, rim: RIM_WARM, shadow: true },
  // the Fun House (D-63): sculpted only; these carry their rims (the builds come from creatures.ts)
  grinning_mannequin: { build: () => new THREE.BufferGeometry(), rim: [0.85, 0.8, 0.7, 0.5], shadow: true },
  grand_mannequin: { build: () => new THREE.BufferGeometry(), rim: [0.95, 0.85, 0.7, 0.6], shadow: true },
  doppelganger: { build: () => new THREE.BufferGeometry(), rim: [0.55, 0.85, 1, 0.65], shadow: true },
  glasswalker: { build: () => new THREE.BufferGeometry(), rim: [0.45, 1, 0.85, 0.65], shadow: true },
  marionette: { build: () => new THREE.BufferGeometry(), rim: RIM_WARM, shadow: true },
  splitter: { build: () => new THREE.BufferGeometry(), rim: [1, 0.5, 0.6, 0.55], shadow: true },
  splitter_mid: { build: () => new THREE.BufferGeometry(), rim: [1, 0.5, 0.6, 0.55], shadow: true },
  splitter_small: { build: () => new THREE.BufferGeometry(), rim: [1, 0.5, 0.6, 0.55], shadow: true },
  crooked_clown: { build: () => new THREE.BufferGeometry(), rim: RIM_SICK, shadow: true },
  reflection_thief: { build: () => new THREE.BufferGeometry(), rim: [0.7, 0.6, 1, 0.6], shadow: true },
};

/** Sculpted, skeletal creatures replace the primitive builds; the coaster snake and mole hole stay rigid. */
export const ENEMY_MODELS: Record<string, ModelDef> = {
  ...LEGACY_MODELS,
  ...Object.fromEntries(CREATURE_IDS.map((id) => [id, { ...LEGACY_MODELS[id], anim: undefined, shadow: BIG.has(id), build: () => creatureModel(id).geo, rig: () => creatureModel(id).rig } as ModelDef])),
};

export const _unused = { cone, box, bands, eyes, sphere };
