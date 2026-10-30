// The six playable characters as procedural 3D models (D-38). Each shares a jointed 1930s figure —
// big head, hose limbs, gloved hands, heavy shoes — dressed with its own silhouette-defining
// costume and prop, so they read instantly from the high camera.

import * as THREE from 'three';
import { C, cone, cyl, ellipsoid, extrude, lathe, rbox, sphere, torus, tube, weather, stripes, smoothShape, type ColorFn, type V3 } from '../core/geo';
import { ModelBuilder, PAL, PART, SURF, body, eyes, glove, limb, shoe, tophat } from './kit';

interface FigureSpec {
  hip: number; // hip height
  shoulderY: number;
  shoulderX: number;
  headY: number;
  headR: number;
  legR: number;
  armR: number;
  legCol: number | ColorFn;
  armCol: number | ColorFn;
  shoeCol: number;
  shoeLen: number;
  gloveCol: number;
  skin: number;
  handY?: number;
  stance?: number; // half distance between feet
  noGloves?: boolean;
}

/** Legs, arms, hands, shoes and a bare head; costume pieces are layered on by each character. */
function figure(m: ModelBuilder, f: FigureSpec): { headPivot: V3; armPivotL: V3; legPivotL: V3; handL: V3 } {
  const st = f.stance ?? 7;
  const legPivot: V3 = [st, f.hip, 0];
  limb(m, [st, f.hip, 0], [st + 0.5, 7, 1], f.legR, f.legCol, PART.LEG_L, legPivot, [0.8, 0, 1.5]);
  limb(m, [-st, f.hip, 0], [-st - 0.5, 7, 1], f.legR, f.legCol, PART.LEG_R, [-st, f.hip, 0], [-0.8, 0, 1.5]);
  shoe(m, [st + 0.5, 0, -2], f.shoeLen, f.shoeCol, PART.LEG_L, legPivot);
  shoe(m, [-st - 0.5, 0, -2], f.shoeLen, f.shoeCol, PART.LEG_R, [-st, f.hip, 0]);
  const armPivot: V3 = [f.shoulderX, f.shoulderY, 0];
  const handY = f.handY ?? f.hip + 2;
  const hand: V3 = [f.shoulderX + 4, handY, 3];
  limb(m, armPivot, [hand[0], hand[1] + 3, hand[2]], f.armR, f.armCol, PART.ARM_L, armPivot, [2.5, 0, -1]);
  limb(m, [-f.shoulderX, f.shoulderY, 0], [-hand[0], hand[1] + 3, hand[2]], f.armR, f.armCol, PART.ARM_R, [-f.shoulderX, f.shoulderY, 0], [-2.5, 0, -1]);
  if (!f.noGloves) {
    glove(m, hand, f.armR * 1.5, PART.ARM_L, armPivot, f.gloveCol);
    glove(m, [-hand[0], hand[1], hand[2]], f.armR * 1.5, PART.ARM_R, [-f.shoulderX, f.shoulderY, 0], f.gloveCol);
  } else {
    m.add(sphere(f.armR * 1.35, 8, 6), { col: f.skin, pos: hand, part: PART.ARM_L, pivot: armPivot, surf: SURF.skin });
    m.add(sphere(f.armR * 1.35, 8, 6), { col: f.skin, pos: [-hand[0], hand[1], hand[2]], part: PART.ARM_R, pivot: [-f.shoulderX, f.shoulderY, 0], surf: SURF.skin });
  }
  const headPivot: V3 = [0, f.headY - f.headR * 0.9, 0];
  m.add(ellipsoid(f.headR, f.headR * 1.06, f.headR * 0.98, 16, 12), { col: f.skin, pos: [0, f.headY, 0], part: PART.HEAD, pivot: headPivot, surf: SURF.skin });
  // neck
  m.add(cyl(f.headR * 0.38, f.headR * 0.42, f.headR * 0.6, 8), { col: f.skin, pos: [0, f.headY - f.headR * 0.95, 0], part: PART.HEAD, pivot: headPivot, surf: SURF.skin });
  return { headPivot, armPivotL: armPivot, legPivotL: legPivot, handL: hand };
}

function face(m: ModelBuilder, y: number, r: number, pivot: V3, o: { sclera?: boolean; nose?: number; mouth?: number; brow?: number; eyeR?: number } = {}): void {
  eyes(m, { x: r * 0.36, y: y + r * 0.12, z: r * 0.84, r: o.eyeR ?? r * 0.17, sclera: o.sclera === false ? undefined : PAL.bone, pivot });
  m.add(sphere(r * 0.16, 8, 6), { col: o.nose ?? PAL.skinDark, pos: [0, y - r * 0.08, r * 1.0], part: PART.HEAD, pivot, surf: SURF.skin });
  m.add(ellipsoid(r * 0.28, r * 0.06, r * 0.1, 8, 4), { col: o.mouth ?? PAL.redDeep, pos: [0, y - r * 0.42, r * 0.88], part: PART.HEAD, pivot, surf: SURF.skin });
  if (o.brow !== undefined) {
    for (const s of [-1, 1]) m.add(ellipsoid(r * 0.2, r * 0.05, r * 0.06, 6, 4), { col: o.brow, pos: [s * r * 0.36, y + r * 0.42, r * 0.86], rot: [0, 0, s * 0.18], part: PART.HEAD, pivot, surf: SURF.cloth });
  }
}

// ---------------------------------------------------------------- The Carny
function carny(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const f = figure(m, {
    hip: 34, shoulderY: 60, shoulderX: 13, headY: 76, headR: 12.5, legR: 3.6, armR: 3.0,
    legCol: weather(PAL.charcoal, 0.3), armCol: stripes(10, PAL.cream, PAL.red, 0, 0.3), shoeCol: PAL.leather, shoeLen: 13, gloveCol: PAL.bone, skin: PAL.skin,
  });
  // striped shirt torso + mustard waistcoat
  body(m, [[0, 30], [10, 31], [11.5, 40], [12, 52], [13, 59], [8, 64], [0, 65]], stripes(14, PAL.cream, PAL.red, 0, 0.3), { scale: [1, 1, 0.78] });
  body(m, [[0, 31], [11, 31.5], [12.4, 40], [12.6, 50], [11, 57], [0, 58]], weather(PAL.mustard, 0.4, 0.08, PAL.ochre), { scale: [1.04, 1, 0.82], pos: [0, 0, 0.6] });
  // buttons
  for (let i = 0; i < 3; i++) m.add(sphere(0.9, 6, 4), { col: PAL.brass, pos: [0, 37 + i * 6, 10.6], surf: SURF.brass });
  // sleeve garters
  for (const s of [-1, 1]) m.add(torus(3.4, 0.8, 5, 10), { col: PAL.blood, pos: [s * 14.5, 52, 0], rot: [Math.PI / 2, 0, s * 0.3], part: s > 0 ? PART.ARM_L : PART.ARM_R, pivot: [s * 13, 60, 0], surf: SURF.cloth });
  // bowtie
  for (const s of [-1, 1]) m.add(cone(2.6, 4.5, 6), { col: PAL.blood, pos: [s * 2.3, 63, 7.5], rot: [0, 0, s * Math.PI / 2], surf: SURF.cloth });
  face(m, 76, 12.5, f.headPivot, { brow: PAL.ink });
  // pencil moustache
  m.add(ellipsoid(4.5, 0.9, 1.2, 8, 4), { col: PAL.ink, pos: [0, 72.4, 11.6], part: PART.HEAD, pivot: f.headPivot, surf: SURF.cloth });
  // straw boater
  m.add(cyl(17, 17, 1.4, 20), { col: weather(PAL.straw, 0.35), pos: [0, 86, 0], rot: [-0.12, 0, 0.06], part: PART.HEAD, pivot: f.headPivot, surf: SURF.canvas });
  m.add(cyl(11, 11.5, 7, 18), { col: weather(PAL.straw, 0.35), pos: [0, 90, -0.4], rot: [-0.12, 0, 0.06], part: PART.HEAD, pivot: f.headPivot, surf: SURF.canvas });
  m.add(cyl(11.7, 12.2, 2.4, 18, true), { col: PAL.blood, pos: [0, 87.8, -0.2], rot: [-0.12, 0, 0.06], part: PART.HEAD, pivot: f.headPivot, surf: SURF.cloth });
  // fan of playing cards in the right hand
  for (let i = 0; i < 4; i++) {
    m.add(rbox(6, 8.5, 0.5, 0.8, 1), { col: i % 2 ? PAL.cream : PAL.bone, pos: [-17 - i * 0.6, 40 + i * 0.4, 7], rot: [0.2, 0, -0.6 + i * 0.32], part: PART.ARM_R, pivot: [-13, 60, 0], surf: SURF.paint });
  }
  return m.build();
}

// ---------------------------------------------------------------- The Strongman
function strongman(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const leopard: ColorFn = (p) => {
    const s = Math.sin(p.x * 0.9) * Math.sin(p.y * 0.75 + p.z * 0.5) + Math.sin(p.z * 1.1 + p.y * 0.3) * 0.6;
    return s > 0.95 ? C(PAL.charcoal) : C(PAL.mustard).multiplyScalar(0.85 + 0.15 * Math.sin(p.y));
  };
  const f = figure(m, {
    hip: 33, shoulderY: 62, shoulderX: 19, headY: 79, headR: 11.5, legR: 5.2, armR: 5.2, stance: 9,
    legCol: weather(PAL.charcoal, 0.3), armCol: PAL.skin, shoeCol: PAL.leather, shoeLen: 15, gloveCol: PAL.skin, skin: PAL.skin, noGloves: true, handY: 36,
  });
  // barrel chest, narrow waist; leopard leotard over one shoulder
  body(m, [[0, 29], [12, 30], [12.5, 38], [15, 48], [20, 58], [18, 64], [8, 68], [0, 69]], PAL.skin, { scale: [1, 1, 0.72], surf: SURF.skin });
  body(m, [[0, 29], [12.6, 30], [13, 38], [15.4, 48], [17, 54], [0, 55]], leopard, { scale: [1.02, 1, 0.76] });
  m.add(tube([[-12, 54, 6], [-15, 61, 4], [-17, 64, 0], [-15, 61, -4], [-12, 54, -6]], 2.6, 6, 12), { col: leopard, surf: SURF.cloth });
  // belt
  m.add(cyl(13.4, 13.4, 3.4, 18, true), { col: PAL.leather, pos: [0, 34, 0], scale: [1, 1, 0.8], surf: SURF.rubber });
  m.add(rbox(5, 4, 1.5, 0.6), { col: PAL.brass, pos: [0, 34, 10.8], surf: SURF.brass });
  // wrist cuffs, biceps
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.ARM_L : PART.ARM_R;
    const pv: V3 = [s * 19, 62, 0];
    m.add(ellipsoid(6.2, 7.5, 6, 10, 8), { col: PAL.skin, pos: [s * 21, 54, 0], part, pivot: pv, surf: SURF.skin });
    m.add(cyl(5.2, 5.2, 4, 10, true), { col: PAL.leather, pos: [s * 23, 41, 3], part, pivot: pv, surf: SURF.rubber });
  }
  // bald head, handlebar moustache, heavy brow
  face(m, 79, 11.5, f.headPivot, { brow: PAL.charcoal });
  m.add(tube([[-9, 77, 9], [-6, 74.5, 11.6], [0, 74.6, 12], [6, 74.5, 11.6], [9, 77, 9]], (t) => 1.6 + Math.sin(t * Math.PI) * 1.2, 6, 14), { col: PAL.ink, part: PART.HEAD, pivot: f.headPivot, surf: SURF.cloth });
  for (const s of [-1, 1]) m.add(torus(1.6, 0.7, 5, 8), { col: PAL.ink, pos: [s * 9.6, 78.2, 8.6], rot: [0, s * 0.8, 0], part: PART.HEAD, pivot: f.headPivot, surf: SURF.cloth });
  // carnival mallet in the right hand
  m.add(cyl(1.2, 1.2, 34, 6), { col: PAL.woodPale, pos: [-24, 46, 8], rot: [0.5, 0, 0.15], part: PART.ARM_R, pivot: [-19, 62, 0], surf: SURF.wood });
  m.add(cyl(5, 5, 13, 12), { col: weather(PAL.red, 0.5, 0.12, PAL.woodPale), pos: [-26, 60, 17], rot: [0.5, 0, Math.PI / 2 + 0.15], part: PART.ARM_R, pivot: [-19, 62, 0], surf: SURF.wood });
  return m.build();
}

// ---------------------------------------------------------------- The Fortune Teller
function fortuneTeller(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const f = figure(m, {
    hip: 32, shoulderY: 58, shoulderX: 11.5, headY: 73, headR: 11.5, legR: 3, armR: 2.6,
    legCol: PAL.velvet, armCol: weather(PAL.plum, 0.3), shoeCol: PAL.ink, shoeLen: 10, gloveCol: PAL.skinPale, skin: PAL.skinPale, noGloves: true, handY: 44,
  });
  // long tiered skirt (hides the legs) with a gold hem
  body(m, [[0, 2], [19, 2], [18, 10], [15.5, 22], [12, 34], [10.5, 42], [0, 43]], weather(PAL.velvet, 0.35, 0.09), { segs: 20 });
  m.add(cyl(19.4, 19.6, 2.2, 20, true), { col: PAL.gold, pos: [0, 3.4, 0], surf: SURF.gold });
  m.add(cyl(16, 16.4, 1.6, 20, true), { col: PAL.gold, pos: [0, 19, 0], surf: SURF.gold });
  // bodice + fringed shawl
  body(m, [[0, 40], [10.5, 41], [10, 50], [11, 57], [6, 61], [0, 62]], weather(PAL.plum, 0.3), { scale: [1, 1, 0.8] });
  body(m, [[0, 50], [13.5, 51], [14.2, 56], [10, 61], [0, 62]], weather(PAL.redDeep, 0.35), { scale: [1, 1, 0.86] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    m.add(cone(0.9, 4.5, 4), { col: PAL.gold, pos: [Math.cos(a) * 13.6, 48.5, Math.sin(a) * 11.6], rot: [Math.PI, 0, 0], surf: SURF.gold });
  }
  // headscarf with a coin band, hoop earrings
  m.add(ellipsoid(12.4, 9, 12.6, 14, 8), { col: weather(PAL.red, 0.35), pos: [0, 78, -0.6], part: PART.HEAD, pivot: f.headPivot, surf: SURF.cloth });
  m.add(tube([[0, 79, -12], [2, 74, -15], [-1, 66, -16]], (t) => 2.6 - t * 1.5, 6, 10), { col: weather(PAL.red, 0.35), part: PART.HEAD, pivot: f.headPivot, surf: SURF.cloth });
  for (let i = 0; i < 9; i++) {
    const a = -1.1 + i * 0.275;
    m.add(cyl(1.2, 1.2, 0.4, 8), { col: PAL.gold, pos: [Math.sin(a) * 12.2, 75.5, Math.cos(a) * 12.2], rot: [Math.PI / 2, 0, -a], part: PART.HEAD, pivot: f.headPivot, surf: SURF.gold });
  }
  for (const s of [-1, 1]) m.add(torus(2.2, 0.45, 5, 12), { col: PAL.gold, pos: [s * 11.8, 67.5, 1], rot: [0, Math.PI / 2, 0], part: PART.HEAD, pivot: f.headPivot, surf: SURF.gold });
  face(m, 73, 11.5, f.headPivot, { brow: PAL.ink, mouth: PAL.blood });
  // kohl-dark lids
  for (const s of [-1, 1]) m.add(ellipsoid(2.6, 1.0, 1.2, 8, 4), { col: PAL.velvet, pos: [s * 4.2, 76.6, 10.2], part: PART.HEAD, pivot: f.headPivot, surf: SURF.cloth });
  // the crystal ball, cradled in both hands — the only saturated thing about her
  m.add(sphere(6.4, 16, 12), { col: PAL.violet, pos: [0, 46, 12], emit: 0.55, surf: SURF.glass });
  m.add(sphere(2.8, 10, 8), { col: 0xe9dcff, pos: [0, 46.5, 12.5], emit: 1.0, surf: SURF.glass });
  m.add(cyl(4, 5, 2.2, 10), { col: PAL.brass, pos: [0, 39.6, 12], surf: SURF.brass });
  return m.build();
}

// ---------------------------------------------------------------- The Ride Operator
function rideOperator(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const f = figure(m, {
    hip: 34, shoulderY: 60, shoulderX: 13, headY: 76, headR: 12, legR: 3.9, armR: 3.0,
    legCol: weather(PAL.denim, 0.4, 0.1), armCol: weather(PAL.cream, 0.3), shoeCol: PAL.leather, shoeLen: 14, gloveCol: PAL.leather, skin: PAL.skin,
  });
  // shirt + bib overalls with straps
  body(m, [[0, 30], [10.5, 31], [11.5, 42], [12.5, 55], [12.6, 59], [7, 64], [0, 65]], weather(PAL.cream, 0.3), { scale: [1, 1, 0.8] });
  body(m, [[0, 30], [11.2, 31], [12, 42], [11.6, 50], [0, 51]], weather(PAL.denim, 0.45, 0.1, PAL.slate), { scale: [1.03, 1, 0.84] });
  m.add(rbox(15, 9, 2, 1), { col: weather(PAL.denim, 0.45), pos: [0, 49, 9.2], surf: SURF.cloth });
  for (const s of [-1, 1]) {
    m.add(tube([[s * 6, 52, 9.6], [s * 9, 58, 7], [s * 10, 61, 0], [s * 9, 57, -7], [s * 6, 50, -9]], 1.3, 5, 10), { col: weather(PAL.denim, 0.45), surf: SURF.cloth });
    m.add(sphere(1.1, 6, 4), { col: PAL.brass, pos: [s * 6, 52.5, 10], surf: SURF.brass });
  }
  // tool belt with pouches
  m.add(cyl(12.4, 12.6, 3, 16, true), { col: PAL.leather, pos: [0, 33, 0], scale: [1, 1, 0.86], surf: SURF.rubber });
  m.add(rbox(6, 7, 3.5, 1), { col: PAL.leather, pos: [9, 30, 6], rot: [0, 0.6, 0], surf: SURF.rubber });
  face(m, 76, 12, f.headPivot, { brow: PAL.woodDark });
  // stubble
  m.add(ellipsoid(8.5, 4.5, 4.8, 10, 6), { col: C(PAL.skin).multiplyScalar(0.72), pos: [0, 70, 8], part: PART.HEAD, pivot: f.headPivot, surf: SURF.skin });
  // flat cap with goggles strapped on
  m.add(ellipsoid(13, 6.5, 13.4, 14, 8), { col: weather(PAL.slate, 0.4), pos: [0, 85, -0.5], part: PART.HEAD, pivot: f.headPivot, surf: SURF.cloth });
  m.add(ellipsoid(10, 1.4, 7, 12, 4), { col: weather(PAL.slate, 0.4), pos: [0, 84, 10], rot: [0.15, 0, 0], part: PART.HEAD, pivot: f.headPivot, surf: SURF.cloth });
  for (const s of [-1, 1]) {
    m.add(torus(3, 1.1, 6, 12), { col: PAL.brass, pos: [s * 4.2, 88.6, 7.6], rot: [-0.6, 0, 0], part: PART.HEAD, pivot: f.headPivot, surf: SURF.brass });
    m.add(cyl(2.4, 2.4, 0.6, 10), { col: PAL.cold, pos: [s * 4.2, 88.6, 7.6], rot: [Math.PI / 2 - 0.6, 0, 0], part: PART.HEAD, pivot: f.headPivot, emit: 0.25, surf: SURF.glass });
  }
  // big monkey wrench in the right hand
  const wrench = new THREE.Shape();
  wrench.moveTo(-1.6, -14); wrench.lineTo(1.6, -14); wrench.lineTo(1.6, 6); wrench.lineTo(4.5, 6); wrench.lineTo(4.5, 12); wrench.lineTo(1.8, 12);
  wrench.lineTo(1.8, 9); wrench.lineTo(-1.8, 9); wrench.lineTo(-1.8, 12); wrench.lineTo(-4.5, 12); wrench.lineTo(-4.5, 6); wrench.lineTo(-1.6, 6); wrench.lineTo(-1.6, -14);
  m.add(extrude(wrench, 2.2, 0.4, 4, 1), { col: PAL.iron, pos: [-19, 34, 7], rot: [0.3, 0.2, 0.3], part: PART.ARM_R, pivot: [-13, 60, 0], surf: SURF.iron });
  return m.build();
}

// ---------------------------------------------------------------- The Lost Child
function lostChild(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const f = figure(m, {
    hip: 20, shoulderY: 40, shoulderX: 9.5, headY: 54, headR: 12, legR: 2.7, armR: 2.4, stance: 5,
    legCol: weather(PAL.navy, 0.3), armCol: weather(PAL.ochre, 0.35), shoeCol: PAL.redDeep, shoeLen: 9, gloveCol: PAL.cream, skin: PAL.skinPale, handY: 24,
  });
  // oversized hand-me-down coat (to the knees) with big buttons
  body(m, [[0, 9], [13, 9], [12.5, 18], [11, 30], [10.5, 38], [7, 43], [0, 44]], weather(PAL.ochre, 0.45, 0.1, PAL.mustard), { scale: [1, 1, 0.88], segs: 18 });
  for (let i = 0; i < 3; i++) m.add(cyl(1.6, 1.6, 0.8, 10), { col: PAL.woodDark, pos: [0, 16 + i * 8, 11 - i * 0.4], rot: [Math.PI / 2, 0, 0], surf: SURF.wood });
  // patch
  m.add(rbox(5, 5, 1, 0.6), { col: weather(PAL.denim, 0.4), pos: [-7, 24, 8.6], rot: [0, -0.6, 0.2], surf: SURF.cloth });
  // scarf with a trailing tail
  m.add(torus(6.6, 2.2, 6, 14), { col: weather(PAL.red, 0.35), pos: [0, 42.5, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.cloth });
  m.add(tube([[4, 41, 5], [6, 36, 7], [7, 30, 6]], 1.8, 6, 8), { col: weather(PAL.red, 0.35), surf: SURF.cloth });
  // big worried eyes
  face(m, 54, 12, f.headPivot, { eyeR: 2.8, brow: PAL.woodDark });
  // knit beanie with a pom-pom
  m.add(ellipsoid(12.6, 8.5, 12.6, 14, 8), { col: weather(PAL.teal, 0.3), pos: [0, 60, -0.4], part: PART.HEAD, pivot: f.headPivot, surf: SURF.plush });
  m.add(cyl(12.7, 12.9, 3, 16, true), { col: weather(PAL.cream, 0.3), pos: [0, 57, -0.3], part: PART.HEAD, pivot: f.headPivot, surf: SURF.plush });
  m.add(sphere(3.6, 10, 8), { col: PAL.cream, pos: [0, 69, -1], part: PART.HEAD, pivot: f.headPivot, surf: SURF.plush });
  // the plush friend under one arm (button eye, stitched smile)
  m.add(ellipsoid(4.6, 5.4, 4, 10, 8), { col: weather(PAL.woodPale, 0.4), pos: [-12, 27, 6], part: PART.ARM_R, pivot: [-9.5, 40, 0], surf: SURF.plush });
  m.add(sphere(3.6, 10, 8), { col: weather(PAL.woodPale, 0.4), pos: [-12, 34, 6.5], part: PART.ARM_R, pivot: [-9.5, 40, 0], surf: SURF.plush });
  for (const s of [-1, 1]) m.add(sphere(1.4, 6, 4), { col: weather(PAL.woodPale, 0.4), pos: [-12 + s * 2.8, 37, 6], part: PART.ARM_R, pivot: [-9.5, 40, 0], surf: SURF.plush });
  m.add(sphere(0.8, 6, 4), { col: PAL.ink, pos: [-11, 34.5, 9.8], part: PART.ARM_R, pivot: [-9.5, 40, 0], surf: SURF.porcelain });
  return m.build();
}

// ---------------------------------------------------------------- The Ringleader
function ringleader(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const f = figure(m, {
    hip: 36, shoulderY: 62, shoulderX: 12.5, headY: 77, headR: 11.5, legR: 3.4, armR: 3.0,
    legCol: weather(PAL.cream, 0.25), armCol: weather(PAL.red, 0.35), shoeCol: PAL.ink, shoeLen: 13, gloveCol: PAL.bone, skin: PAL.skinPale,
  });
  // tall riding boots
  for (const s of [-1, 1]) m.add(cyl(4.4, 4.2, 18, 10), { col: PAL.ink, pos: [s * 7.2, 14, 0.6], part: s > 0 ? PART.LEG_L : PART.LEG_R, pivot: [s * 7, 36, 0], surf: SURF.rubber });
  // red tailcoat with gold frogging and long tails
  body(m, [[0, 34], [11.5, 35], [12, 46], [12.8, 57], [12.5, 61], [6, 66], [0, 67]], weather(PAL.red, 0.4, 0.09), { scale: [1, 1, 0.8] });
  for (let i = 0; i < 4; i++) m.add(rbox(10, 1.2, 1, 0.4), { col: PAL.gold, pos: [0, 42 + i * 4.5, 9.4], surf: SURF.gold });
  const tail = smoothShape([[-1, 0], [5, -2], [7, -22], [3, -30], [-2, -24], [-3, -6]], 24);
  for (const s of [-1, 1]) m.add(extrude(tail, 1.6, 0.3, 6, 1), { col: weather(PAL.redDeep, 0.35), pos: [s * 4, 40, -8.6], rot: [0.2, s * 0.25 + Math.PI / 2 * 0, s * 0.1], scale: [s, 1, 1], part: PART.SWAY, pivot: [s * 4, 40, -8], surf: SURF.cloth });
  // gold epaulettes with fringe
  for (const s of [-1, 1]) {
    const part = s > 0 ? PART.ARM_L : PART.ARM_R;
    m.add(ellipsoid(5.2, 1.6, 4.6, 10, 6), { col: PAL.gold, pos: [s * 13, 63, 0], part, pivot: [s * 12.5, 62, 0], surf: SURF.gold });
    for (let k = 0; k < 6; k++) m.add(cyl(0.45, 0.45, 3.4, 4), { col: PAL.gold, pos: [s * (9.5 + k * 1.3), 60.6, 3.6], part, pivot: [s * 12.5, 62, 0], surf: SURF.gold });
  }
  m.add(cone(2.4, 4.4, 6), { col: PAL.ink, pos: [2.2, 65, 7.6], rot: [0, 0, Math.PI / 2] });
  m.add(cone(2.4, 4.4, 6), { col: PAL.ink, pos: [-2.2, 65, 7.6], rot: [0, 0, -Math.PI / 2] });
  face(m, 77, 11.5, f.headPivot, { brow: PAL.ink });
  // waxed curled moustache
  m.add(tube([[-6.5, 75, 10], [-3, 73, 11.4], [0, 73.4, 11.6], [3, 73, 11.4], [6.5, 75, 10]], 0.9, 5, 12), { col: PAL.ink, part: PART.HEAD, pivot: f.headPivot, surf: SURF.cloth });
  tophat(m, 86, 8, 14, PAL.ink, PAL.blood, PART.HEAD, f.headPivot, -0.08);
  // conductor's baton with an ivory tip
  m.add(cyl(0.6, 0.8, 20, 6), { col: PAL.ink, pos: [-20, 44, 11], rot: [0.9, 0, -0.3], part: PART.ARM_R, pivot: [-12.5, 62, 0], surf: SURF.paint });
  m.add(sphere(1.2, 6, 4), { col: PAL.bone, pos: [-23, 50, 18.5], part: PART.ARM_R, pivot: [-12.5, 62, 0], surf: SURF.porcelain });
  return m.build();
}

export const CHARACTER_MODELS: Record<string, () => THREE.BufferGeometry> = {
  carny, strongman, fortune_teller: fortuneTeller, ride_operator: rideOperator, lost_child: lostChild, ringleader,
};

/** Character animation amplitudes: [bob, squash, leg swing, arm swing] / [head nod, spin, lean, arm raise]. */
export const CHARACTER_ANIM: Record<string, { a: [number, number, number, number]; b: [number, number, number, number] }> = {
  carny: { a: [2.2, 0.02, 0.62, 0.5], b: [0.06, 0, 0.1, 0.4] },
  strongman: { a: [1.6, 0.02, 0.45, 0.3], b: [0.04, 0, 0.1, 0.5] },
  fortune_teller: { a: [1.2, 0.015, 0.3, 0.25], b: [0.08, 0, 0.1, 0.3] },
  ride_operator: { a: [2.4, 0.025, 0.7, 0.55], b: [0.06, 0, 0.1, 0.4] },
  lost_child: { a: [2.6, 0.03, 0.75, 0.6], b: [0.08, 0, 0.1, 0.3] },
  ringleader: { a: [1.8, 0.02, 0.55, 0.45], b: [0.05, 0, 0.1, 0.4] },
};
