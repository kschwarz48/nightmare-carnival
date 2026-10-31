// The Boardwalk's furnishings (D-68, D-69): what stands inside the Arcade and the Gift Shop, built to read
// as the real thing from the game's high camera. Neptune's Palace: mutoscopes on fluted iron pedestals,
// pinball tables with their playfields lit under glass, a love tester and a punching-bag strength tester,
// skee-ball alleys, the Crane, Madame Marina's fortune booth, the Laughing Sailor, the change booth and the
// shooting gallery. The Gift Shop: stepped souvenir stands built to their real length (never stretched)
// with lamps on their crests, the counter and its brass register, a jewellery case, the postcard spinner,
// the photograph on its easel and the founder's tall cabinet. Glass is glass: every pane goes into one
// translucent mesh, so the figures and the prizes behind it show.

import * as THREE from 'three';
import type { Prop } from '../../../data/map';
import { C, SURF, box, cone, cyl, ellipsoid, extrude, lathe, rbox, sphere, torus, tube, weather, type V3 } from '../../core/geo';
import { ModelBuilder, PAL } from '../../models/kit';

const B = (fn: (m: ModelBuilder) => void, ao = 0.35) => {
  const m = new ModelBuilder();
  fn(m);
  return m.build({ ao });
};
const iron = weather(0x2a2c2e, 0.45, 0.05, 0x5a3a24);
const chrome = weather(0x8a8c90, 0.25, 0.04);
const brass = weather(PAL.brass, 0.35, 0.04, 0x3a4a30);
const gilt = PAL.gold;
const cream = weather(0xd6ccb4, 0.4, 0.04, 0x8a7a66);
const ink = PAL.ink;
const hash = (k: number) => {
  const s = Math.sin(k * 12.9898 + 4.1) * 43758.5453;
  return s - Math.floor(s);
};

/** The photograph on its easel: the picture's size, how far it leans back, and its centre (from the prop). */
/** The easel's footprint runs from 80 behind its ledge to 25 in front; its prop is centred on that. */
const EZ = 27;
export const PHOTO = { w: 210, h: 140, lean: 0.38, cy: 42 + 75 * Math.cos(0.38), cz: 16 - 75 * Math.sin(0.38) + EZ };
/** A point on the photograph's plane: `u` across, `v` up the picture, `n` out of it (in the prop's frame). */
const photoAt = (u: number, v: number, n: number): V3 => [
  u, PHOTO.cy + v * Math.cos(PHOTO.lean) + n * Math.sin(PHOTO.lean), PHOTO.cz - v * Math.sin(PHOTO.lean) + n * Math.cos(PHOTO.lean),
];
const PHOTO_TOP = photoAt(0, PHOTO.h / 2 + 12, 2);
/** The picture lamp's bulb, in the prop's frame (its pool and halo hang there). */
export const PHOTO_BULB: V3 = [0, PHOTO_TOP[1] + 6, PHOTO_TOP[2] + 27];
/** Where a souvenir stand of width `w` carries its lamps (offsets along its length). */
export const shelfLampXs = (w: number): number[] => (w > 150 ? [-w / 4, w / 4] : [0]);
/** The stand's lamps: their bulbs' height and how far forward of the stand's centre line they hang. */
export const SHELF_LAMP = { h: 128.5, z: 2 };

// ---------------------------------------------------------------- the Arcade's machines
/** A mutoscope: a flip-book reel case on a fluted cast-iron pedestal, a hood to lean into, a crank. */
function mutoscope(m: ModelBuilder, x: number, body: number, card: number): void {
  m.add(lathe([[0, 0], [15, 0], [15, 2.5], [10, 6], [7.5, 11], [6.5, 40], [8.5, 43], [8.5, 46], [0, 46]], 12), { col: iron, pos: [x, 0, 0], surf: SURF.iron });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    m.add(box(1.4, 27, 1.4), { col: iron, pos: [x + Math.cos(a) * 6.6, 26, Math.sin(a) * 6.6], surf: SURF.iron });
  }
  const bc = weather(body, 0.4, 0.04, 0x8a6a40);
  m.add(rbox(28, 46, 30, 7, 3), { col: bc, pos: [x, 69, 0], surf: SURF.iron });
  m.add(ellipsoid(14, 9, 15, 14, 7), { col: bc, pos: [x, 92, 0], surf: SURF.iron });
  m.add(torus(14.2, 1, 4, 20), { col: gilt, pos: [x, 92, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
  // the title card in its gilt frame, the coin plate under it
  m.add(box(19, 15, 1), { col: cream, pos: [x, 72, 15.2], surf: SURF.paint, emit: 0.3 });
  m.add(box(15, 10, 0.8), { col: C(card), pos: [x, 73, 15.8], surf: SURF.paint, emit: 0.45 });
  for (const [w, h, dx, dy] of [[21, 1.2, 0, 80.2], [21, 1.2, 0, 63.8], [1.2, 17, -10, 72], [1.2, 17, 10, 72]] as [number, number, number, number][]) {
    m.add(box(w, h, 1.4), { col: gilt, pos: [x + dx, dy, 15.4], surf: SURF.gold });
  }
  m.add(box(8, 4, 1), { col: brass, pos: [x, 56, 15.2], surf: SURF.brass });
  // the viewing hood, flaring up toward whoever leans in, with its rubber eye-cushion
  m.add(cyl(9, 5, 15, 4), { col: ink, pos: [x, 101, 8], rot: [0.6, Math.PI / 4, 0], surf: SURF.iron });
  m.add(rbox(15, 3, 9, 1.4), { col: C(0x0e0c0a), pos: [x, 107.8, 12.6], rot: [0.6, 0, 0], surf: SURF.rubber });
  // the crank on its hub
  m.add(cyl(4, 4, 4, 10), { col: brass, pos: [x + 15.5, 72, 2], rot: [0, 0, Math.PI / 2], surf: SURF.brass });
  m.add(box(2, 15, 2), { col: iron, pos: [x + 18, 66, 2], rot: [0, 0, 0.15], surf: SURF.iron });
  m.add(cyl(1.8, 1.8, 7, 8), { col: weather(0x3a2416, 0.3), pos: [x + 21, 59, 2], rot: [0, 0, Math.PI / 2], surf: SURF.wood });
}

/** A pinball table: chrome legs, a sloping cabinet, a lit playfield under glass, the backbox's painted glass. */
function pinball(m: ModelBuilder, x: number, body: number, art: number): void {
  const T = 0.1, cT = Math.cos(T), sT = Math.sin(T);
  // a point `up` above the playfield at (dx, dz) along the table's slope (its top is 48 high at the middle)
  const on = (dx: number, up: number, dz: number): V3 => [x + dx, 48 + up * cT - dz * sT, up * sT + dz * cT];
  for (const [lx, lz] of [[-12, 22], [12, 22], [-12, -22], [12, -22]] as [number, number][]) {
    m.add(cyl(1.3, 2.1, 38, 6), { col: chrome, pos: [x + lx, 20, lz], surf: SURF.iron });
    m.add(cyl(2.6, 2.6, 2, 8), { col: chrome, pos: [x + lx, 1, lz], surf: SURF.iron });
  }
  const bc = weather(body, 0.4, 0.04);
  m.add(box(30, 12, 56), { col: bc, pos: [x, 42, 0], rot: [T, 0, 0], surf: SURF.wood });
  for (const s of [-1, 1]) m.add(box(0.8, 3, 52), { col: gilt, pos: [x + s * 15.2, 42, 0], rot: [T, 0, 0], surf: SURF.gold });
  // the playfield: painted art, three pop bumpers with lit caps, slingshots, flippers, the top arch and lanes
  m.add(box(26, 0.6, 50), { col: C(art).multiplyScalar(0.35), pos: on(0, 0.3, 0), rot: [T, 0, 0], surf: SURF.paint, emit: 0.3 });
  m.add(cyl(8, 8, 0.4, 18), { col: C(art).multiplyScalar(0.7), pos: on(0, 0.7, -2), rot: [T, 0, 0], scale: [1, 1, 1.5], surf: SURF.paint, emit: 0.35 });
  for (const [bx, bz, c] of [[-6, -13, 0xff4a3a], [6, -13, 0xffd84a], [0, -6, 0xffffff]] as [number, number, number][]) {
    m.add(cyl(3.4, 3.6, 3, 12), { col: cream, pos: on(bx, 1.8, bz), rot: [T, 0, 0], surf: SURF.porcelain });
    m.add(cyl(2.6, 2.6, 1, 12), { col: C(c), pos: on(bx, 3.6, bz), rot: [T, 0, 0], surf: SURF.bulb, emit: 1 });
  }
  for (const s of [-1, 1]) {
    m.add(box(1.4, 2.2, 9), { col: cream, pos: on(s * 7.5, 1.2, 12), rot: [T, s * 0.45, 0], surf: SURF.porcelain });
    m.add(box(7.5, 1.6, 2.2), { col: cream, pos: on(s * 4.6, 1, 20), rot: [T, -s * 0.38, 0], surf: SURF.porcelain });
  }
  m.add(torus(12, 0.6, 4, 14, Math.PI), { col: chrome, pos: on(0, 0.8, -15), rot: [T - Math.PI / 2, 0, 0], surf: SURF.iron });
  m.add(box(0.8, 2, 30), { col: chrome, pos: on(10.5, 1, 8), rot: [T, 0, 0], surf: SURF.iron });
  for (const dx of [-4, 0, 4]) m.add(cyl(0.5, 0.5, 2.4, 6), { col: chrome, pos: on(dx, 1.2, -21), rot: [T, 0, 0], surf: SURF.iron });
  m.add(box(26, 2.4, 5), { col: ink, pos: on(0, 1.2, 23.5), rot: [T, 0, 0], surf: SURF.paint });
  m.add(box(30, 1.8, 2.6), { col: chrome, pos: on(0, 1.6, 27), rot: [T, 0, 0], surf: SURF.iron });
  // the backbox: its painted glass glowing, the score window under it
  m.add(box(30, 32, 8), { col: bc, pos: [x, 68, -27], surf: SURF.wood });
  m.add(box(26, 20, 0.8), { col: C(art), pos: [x, 71, -22.8], surf: SURF.glass, emit: 0.85 });
  m.add(box(18, 3.4, 0.8), { col: C(0xffe0a0), pos: [x, 57.5, -22.8], surf: SURF.glass, emit: 0.6 });
  m.add(box(32, 2.2, 9.5), { col: gilt, pos: [x, 85, -27], surf: SURF.gold });
  // the coin door and the plunger
  m.add(box(10, 9, 0.8), { col: brass, pos: [x, 40, 28.6], surf: SURF.brass });
  for (const s of [-1, 1]) m.add(box(1.6, 3, 0.6), { col: C(0xff4a3a), pos: [x + s * 2.5, 41.5, 29.1], surf: SURF.bulb, emit: 0.8 });
  m.add(cyl(1.4, 1.4, 6, 8), { col: chrome, pos: [x + 11, 43, 30], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
}

/** A love tester: a carved cabinet on ball feet, a tube of red light climbing past ranks of lamps, a grip. */
function loveTester(m: ModelBuilder): void {
  const wood = weather(0x5a1418, 0.4, 0.04, 0x8a6a40);
  for (const sx of [-22, 22]) for (const sz of [-12, 12]) m.add(sphere(3.2, 8, 6), { col: brass, pos: [sx, 3, sz], surf: SURF.brass });
  m.add(rbox(52, 54, 32, 4, 2), { col: wood, pos: [0, 33, 0], surf: SURF.wood });
  for (const y of [7, 61]) m.add(box(54, 3.5, 34), { col: gilt, pos: [0, y, 0], surf: SURF.gold });
  for (const s of [-1, 1]) m.add(rbox(18, 34, 1.5, 1), { col: weather(0x3a0c10, 0.4), pos: [s * 12, 33, 16.4], surf: SURF.wood });
  m.add(rbox(46, 76, 20, 3, 2), { col: wood, pos: [0, 101, -5], surf: SURF.wood });
  m.add(box(34, 70, 1), { col: C(0x1a0a0c), pos: [0, 101, 5.4], surf: SURF.paint });
  m.add(cyl(3.2, 3.2, 56, 12), { col: C(0xff5a4a), pos: [0, 104, 8], surf: SURF.glass, emit: 0.9 });
  m.add(sphere(6.5, 14, 10), { col: C(0xff3a2a), pos: [0, 71, 8], surf: SURF.glass, emit: 1 });
  [0x4a7aff, 0x4ad0ff, 0x5aff8a, 0xffe04a, 0xff9a3a, 0xff3a6a].forEach((c, i) => {
    for (const s of [-1, 1]) m.add(sphere(2.6, 8, 6), { col: C(c), pos: [s * 11, 80 + i * 9.5, 7.2], surf: SURF.bulb, emit: 0.9 });
  });
  // the brass grip: squeeze it and the mercury climbs
  for (const s of [-1, 1]) m.add(cyl(1.6, 1.6, 8, 8), { col: brass, pos: [s * 9, 49, 20], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  m.add(cyl(2.4, 2.4, 22, 12), { col: brass, pos: [0, 49, 24], rot: [0, 0, Math.PI / 2], surf: SURF.brass });
  // the crest: a gilt-edged arch with a red heart on it
  const arch = new THREE.Shape();
  arch.moveTo(-23, 0);
  arch.lineTo(23, 0);
  arch.absarc(0, 0, 23, 0, Math.PI, false);
  m.add(extrude(arch, 8, 0, 20), { col: wood, pos: [0, 139, -5], surf: SURF.wood });
  m.add(torus(23, 1.2, 4, 20, Math.PI), { col: gilt, pos: [0, 139, -0.6], surf: SURF.gold });
  const heart = new THREE.Shape();
  heart.moveTo(0, -7);
  heart.bezierCurveTo(-2, -4, -9, 0, -9, 4);
  heart.bezierCurveTo(-9, 8, -4, 9.5, 0, 6);
  heart.bezierCurveTo(4, 9.5, 9, 8, 9, 4);
  heart.bezierCurveTo(9, 0, 2, -4, 0, -7);
  m.add(extrude(heart, 3, 0.8, 10), { col: C(0xd8203a), pos: [0, 150, 0.5], surf: SURF.paint, emit: 0.55 });
}

/** A punching-bag strength tester: a tall column, the big dial on top, the leather bag on its swivel. */
function puncher(m: ModelBuilder): void {
  const paint = weather(0x1e3a5a, 0.4, 0.04, 0x8a7a5a);
  m.add(box(46, 4, 46), { col: iron, pos: [0, 2, 3], surf: SURF.iron });
  m.add(rbox(18, 118, 16, 3, 2), { col: paint, pos: [0, 63, -14], surf: SURF.paint });
  m.add(box(19, 3, 17), { col: gilt, pos: [0, 30, -14], surf: SURF.gold });
  // the dial: a white face in a brass bezel, red at the top of the scale, the needle
  m.add(cyl(24, 24, 7, 28), { col: paint, pos: [0, 148, -13], rot: [Math.PI / 2, 0, 0], surf: SURF.paint });
  m.add(cyl(20, 20, 1, 28), { col: cream, pos: [0, 148, -9.2], rot: [Math.PI / 2, 0, 0], surf: SURF.porcelain, emit: 0.45 });
  m.add(torus(21, 1.8, 6, 32), { col: brass, pos: [0, 148, -9], surf: SURF.brass });
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI * (1.2 - k * 0.14);
    m.add(box(1.1, 4.2, 0.6), { col: C(k >= 8 ? 0xc8202a : 0x1a1410), pos: [Math.cos(a) * 16, 148 + Math.sin(a) * 16, -8.4], rot: [0, 0, a - Math.PI / 2], surf: SURF.paint });
  }
  m.add(box(1.4, 15, 0.6), { col: C(0xc8202a), pos: [2.6, 154, -8.1], rot: [0, 0, -0.35], surf: SURF.paint });
  m.add(sphere(2, 8, 6), { col: brass, pos: [0, 148, -8], surf: SURF.brass });
  // the arm out over the plate, its rebound board, the leather bag on a swivel
  m.add(box(10, 6, 34), { col: iron, pos: [0, 120, 1], surf: SURF.iron });
  m.add(cyl(11, 12, 4, 16), { col: weather(0x3a2416, 0.35), pos: [0, 116, 13], surf: SURF.wood });
  m.add(cyl(0.9, 0.9, 7, 6), { col: chrome, pos: [0, 110.5, 13], surf: SURF.iron });
  m.add(ellipsoid(8, 12, 8, 14, 10), { col: weather(0x7a3e1c, 0.3, 0.06), pos: [0, 96, 13], surf: SURF.rubber });
  m.add(torus(3.5, 1, 4, 10), { col: C(0x4a2410), pos: [0, 106.5, 13], rot: [Math.PI / 2, 0, 0], surf: SURF.rubber });
  // the coin box: a brass slot and a lit card
  m.add(rbox(16, 22, 8, 2), { col: weather(0x8a1a1a, 0.4), pos: [0, 72, -4], surf: SURF.paint });
  m.add(box(6, 2, 0.8), { col: brass, pos: [0, 78, 0.3], surf: SURF.brass });
  m.add(box(12, 7, 0.8), { col: cream, pos: [0, 68, 0.3], surf: SURF.paint, emit: 0.5 });
}

/** A plush prize: a bear, a duck or a ball. */
function prize(m: ModelBuilder, kind: number, p: V3, col: number): void {
  const [x, y, z] = p;
  if (kind === 0) {
    m.add(ellipsoid(6, 7, 5.4, 10, 8), { col: C(col), pos: [x, y + 6, z], surf: SURF.plush });
    m.add(sphere(4.8, 10, 8), { col: C(col), pos: [x, y + 15, z + 1], surf: SURF.plush });
    for (const s of [-1, 1]) m.add(sphere(1.8, 6, 5), { col: C(col), pos: [x + s * 3.6, y + 19, z], surf: SURF.plush });
    m.add(sphere(1.8, 6, 5), { col: C(0xe8d8c0), pos: [x, y + 14, z + 5.2], surf: SURF.plush });
  } else if (kind === 1) {
    m.add(ellipsoid(6, 4.5, 4.5, 10, 8), { col: C(0xe8c83a), pos: [x, y + 4.5, z], surf: SURF.plush });
    m.add(sphere(3.4, 10, 8), { col: C(0xe8c83a), pos: [x + 4, y + 10, z], surf: SURF.plush });
    m.add(cone(1.4, 3.4, 6), { col: C(0xe0782a), pos: [x + 8, y + 10, z], rot: [0, 0, -Math.PI / 2], surf: SURF.plush });
  } else m.add(sphere(5, 10, 8), { col: C(col), pos: [x, y + 5, z], surf: SURF.rubber });
}

// ---------------------------------------------------------------- the Gift Shop's souvenirs
/** One small souvenir standing at (x, y, z): a snow globe, a ship in a bottle, shells, a lighthouse... */
function souvenir(m: ModelBuilder, kind: number, x: number, y: number, z: number, r: number): void {
  switch (kind) {
    case 0: // a snow globe on a turned base
      m.add(cyl(5, 6, 4, 12), { col: weather(0x3a2416, 0.3), pos: [x, y + 2, z], surf: SURF.wood });
      m.add(sphere(6, 12, 10), { col: C(0xb8d8e8), pos: [x, y + 9.5, z], surf: SURF.glass, emit: 0.18 });
      break;
    case 1: // a ship in a bottle on its cradle
      m.add(box(14, 2, 6), { col: weather(0x5a3a24, 0.3), pos: [x, y + 1, z], surf: SURF.wood });
      m.add(cyl(4.5, 4.5, 16, 10), { col: C(0x4a7a5a), pos: [x - 1, y + 6.5, z], rot: [0, 0, Math.PI / 2], surf: SURF.glass, emit: 0.1 });
      m.add(cyl(2, 2.4, 5, 8), { col: C(0x4a7a5a), pos: [x + 9.5, y + 6.5, z], rot: [0, 0, Math.PI / 2], surf: SURF.glass });
      m.add(cyl(1.6, 1.8, 2.5, 6), { col: weather(0xa87a4a, 0.3), pos: [x + 13, y + 6.5, z], rot: [0, 0, Math.PI / 2], surf: SURF.wood });
      m.add(box(3, 5, 0.6), { col: C(0xf0e8d8), pos: [x - 1, y + 9.5, z + 4.4], surf: SURF.paint });
      break;
    case 2: // a conch and a scallop
      m.add(cone(4, 12, 10), { col: weather(0xe8c8b0, 0.25), pos: [x - 2, y + 4, z], rot: [0, r * 3, -1.35], surf: SURF.porcelain });
      m.add(ellipsoid(4.5, 3.5, 4, 10, 8), { col: weather(0xf0d8c8, 0.25), pos: [x - 7, y + 3.5, z], surf: SURF.porcelain });
      m.add(lathe([[0, 0], [7, 0.5], [6.5, 2], [0, 3]], 9, 0, -0.2, Math.PI + 0.4), { col: weather(0xe8b8a0, 0.25), pos: [x + 6, y + 1, z + 1], rot: [-1.2, 0, 0], surf: SURF.porcelain });
      break;
    case 3: // a little lighthouse with a lit lantern
      m.add(cyl(3, 4.5, 16, 10), { col: (p) => (Math.floor((p.y + 400) / 4) % 2 ? C(0xc8302a) : C(0xf0e8d8)), pos: [x, y + 8, z], surf: SURF.porcelain });
      m.add(cyl(3.4, 3.4, 3, 10), { col: C(0xfff0b0), pos: [x, y + 17.5, z], surf: SURF.glass, emit: 0.5 });
      m.add(cone(3.8, 4, 10), { col: C(0x2a2a2a), pos: [x, y + 21, z], surf: SURF.iron });
      break;
    case 4: // a bathing-beauty figurine in a sun hat
      m.add(cyl(4, 4.5, 2, 10), { col: cream, pos: [x, y + 1, z], surf: SURF.porcelain });
      m.add(ellipsoid(3.2, 7, 2.6, 10, 8), { col: C(r > 0.5 ? 0xd88a8a : 0x8ab0d8), pos: [x, y + 9, z], surf: SURF.porcelain });
      m.add(sphere(2.4, 10, 8), { col: weather(0xf0d8c0, 0.2), pos: [x, y + 18, z], surf: SURF.porcelain });
      m.add(cyl(3.6, 3.6, 0.6, 12), { col: C(0xe8d8a0), pos: [x, y + 19.5, z], surf: SURF.canvas });
      break;
    case 5: // a toy sailboat
      m.add(extrude([[-8, 0], [8, 0], [6, 3.5], [-6, 3.5]], 4, 0, 1), { col: C(0x2a4a7a), pos: [x, y + 0.5, z], surf: SURF.paint });
      m.add(cyl(0.5, 0.5, 16, 5), { col: weather(0x8a6a4a, 0.2), pos: [x, y + 11, z], surf: SURF.wood });
      m.add(extrude([[0, 0], [7, 0], [0, 13]], 0.4, 0, 1), { col: C(0xf0e8d8), pos: [x + 0.6, y + 5, z], surf: SURF.canvas });
      break;
    default: // postcards and a souvenir mug
      m.add(box(9, 3, 6), { col: C(0xe0d0b0), pos: [x - 5, y + 1.5, z], rot: [0, 0.2, 0], surf: SURF.paint });
      m.add(cyl(3.5, 3.5, 7, 10), { col: C(0xf0e8e0), pos: [x + 5, y + 3.5, z], surf: SURF.porcelain });
      m.add(torus(2, 0.7, 4, 8), { col: C(0xf0e8e0), pos: [x + 8.6, y + 3.5, z], rot: [0, Math.PI / 2, 0], surf: SURF.porcelain });
  }
}

/**
 * A stepped souvenir stand `w` long: three tiers rising to a back board, turned finials, plates on the
 * back board, brass lamps on the crest. The front tier is kept clear for the shop's best pieces (Ada's
 * keepsakes and their look-alikes stand there).
 */
function souvenirStand(w: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const dk = weather(0x3a2418, 0.4, 0.04), board = weather(0x6a4a2c, 0.35, 0.05);
  m.add(box(w, 8, 46), { col: dk, pos: [0, 4, 0], surf: SURF.wood });
  const tiers: [number, number, number][] = [[34, 13, 18], [58, -3, 14], [82, -15, 12]];
  for (const [h, z, d] of tiers) {
    m.add(box(w - 6, h - 8, d), { col: dk, pos: [0, 8 + (h - 8) / 2, z], surf: SURF.wood });
    m.add(box(w, 2.5, d + 2), { col: board, pos: [0, h + 1.25, z + 1], surf: SURF.wood });
    m.add(box(w, 1.6, 1.2), { col: gilt, pos: [0, h + 1.4, z + d / 2 + 2.2], surf: SURF.gold });
  }
  m.add(box(w - 6, 104, 4), { col: dk, pos: [0, 60, -21], surf: SURF.wood });
  m.add(box(w + 4, 7, 8), { col: board, pos: [0, 115, -20], surf: SURF.wood });
  for (const s of [-1, 1]) {
    m.add(box(6, 114, 46), { col: dk, pos: [s * (w / 2 - 3), 57, 0], surf: SURF.wood });
    m.add(sphere(3.6, 10, 8), { col: gilt, pos: [s * (w / 2 - 3), 117, -19], surf: SURF.gold });
  }
  let k = 0;
  for (const [h, z] of [tiers[1], tiers[2]]) {
    for (let x = -w / 2 + 16; x < w / 2 - 12; x += 21 + hash(k + w) * 8, k++) souvenir(m, Math.floor(hash(k * 3.1 + w) * 7), x, h + 2.5, z + 1, hash(k * 7.3));
  }
  for (let x = -w / 2 + 40; x < w / 2 - 30; x += 70) {
    m.add(cyl(10, 10, 1.4, 16), { col: weather(0xe8e0d0, 0.2), pos: [x, 99, -17], rot: [Math.PI / 2 - 0.25, 0, 0], surf: SURF.porcelain });
    m.add(torus(8, 0.9, 4, 16), { col: C(0x2a5a8a), pos: [x, 99, -16.2], rot: [-0.25, 0, 0], surf: SURF.porcelain });
  }
  // brass lamps on the crest: goosenecks with green banker's shades, their bulbs lit
  for (const lx of shelfLampXs(w)) {
    m.add(cyl(3, 3.6, 2, 10), { col: brass, pos: [lx, 119.5, -20], surf: SURF.brass });
    m.add(tube([[lx, 120, -20], [lx, 132, -17], [lx, 136, -8], [lx, 134, SHELF_LAMP.z]], 0.9, 5, 10), { col: brass, surf: SURF.brass });
    m.add(lathe([[1.5, 5], [3, 4.5], [7.5, 0]], 12), { col: C(0x1e4a2e), pos: [lx, SHELF_LAMP.h - 0.5, SHELF_LAMP.z], surf: SURF.paint });
    m.add(sphere(2.6, 8, 6), { col: C(0xfff0c8), pos: [lx, SHELF_LAMP.h, SHELF_LAMP.z], surf: SURF.bulb, emit: 1.2 });
  }
  return m.build({ ao: 0.35 });
}

// ---------------------------------------------------------------- the builders
export const FURNISHINGS: Record<string, (variant: number) => THREE.BufferGeometry> = {
  // ---- Neptune's Palace of Amusements
  bw_fortune: () => B((m) => {
    // Madame Marina: a drowned fortune teller in a gilt booth, her hands over a crystal, cards before her
    const wood = weather(0x1e3a3a, 0.4, 0.04, 0x5a6a60);
    m.add(rbox(80, 76, 58, 5, 2), { col: wood, pos: [0, 38, 0], surf: SURF.wood });
    for (const y of [4, 76]) m.add(box(82, 3.5, 60), { col: gilt, pos: [0, y, 0], surf: SURF.gold });
    for (const s of [-1, 1]) m.add(rbox(24, 46, 1.5, 1.5), { col: weather(0x14282a, 0.4), pos: [s * 22, 38, 29.4], surf: SURF.wood });
    m.add(box(22, 3, 1.2), { col: brass, pos: [0, 52, 29.6], surf: SURF.brass });
    m.add(box(8, 4, 1.2), { col: brass, pos: [0, 30, 29.6], surf: SURF.brass });
    for (const [x, z] of [[-38, 27], [38, 27], [-38, -27], [38, -27]] as [number, number][]) m.add(cyl(2.6, 2.6, 112, 8), { col: gilt, pos: [x, 134, z], surf: SURF.gold });
    m.add(box(76, 110, 2), { col: weather(0x0e2a30, 0.3), pos: [0, 134, -27], surf: SURF.paint, emit: 0.12 });
    for (let k = 0; k < 14; k++) m.add(sphere(0.9, 4, 3), { col: C(0xc8fff0), pos: [-32 + hash(k) * 64, 90 + hash(k + 9) * 90, -25.8], surf: SURF.bulb, emit: 1 });
    m.add(box(76, 4, 56), { col: weather(0x3a1a3a, 0.3), pos: [0, 80, 0], surf: SURF.velvet });
    m.add(ellipsoid(19, 28, 13, 14, 10), { col: weather(0x2a4a4a, 0.4), pos: [0, 108, -8], surf: SURF.cloth });
    m.add(ellipsoid(22, 7, 13, 12, 6), { col: weather(0x2a4a4a, 0.4), pos: [0, 128, -8], surf: SURF.cloth });
    m.add(sphere(11.5, 14, 12), { col: weather(0x9ab0a8, 0.3), pos: [0, 146, -6], surf: SURF.porcelain });
    m.add(ellipsoid(15, 10, 14, 12, 8), { col: weather(0x1e4a32, 0.4), pos: [0, 156, -7], surf: SURF.cloth });
    m.add(sphere(2.6, 8, 6), { col: C(0x9af0e0), pos: [0, 157, 6], surf: SURF.glass, emit: 0.9 });
    for (const s of [-1, 1]) m.add(sphere(1.6, 6, 5), { col: C(0x0a1a1a), pos: [s * 4, 147, 4.6], surf: SURF.glass, emit: 0.5 });
    for (const s of [-1, 1]) {
      m.add(tube([[s * 20, 126, -8], [s * 18, 108, 2], [s * 7, 99, 12]], 3, 6, 10), { col: weather(0x2a4a4a, 0.4), surf: SURF.cloth });
      m.add(sphere(3.4, 8, 6), { col: weather(0x9ab0a8, 0.3), pos: [s * 6, 98, 14], surf: SURF.porcelain });
    }
    m.add(sphere(7.5, 14, 12), { col: C(0x9af0e0), pos: [0, 90, 14], surf: SURF.glass, emit: 0.85 });
    m.add(cyl(4, 5, 3, 10), { col: gilt, pos: [0, 83.5, 14], surf: SURF.gold });
    for (let k = 0; k < 5; k++) m.add(box(5, 0.5, 8), { col: cream, pos: [-20 + k * 3, 82.5, 16], rot: [0, 0.4 - k * 0.2, 0], surf: SURF.paint });
    // the crown, and the marquee that names her (its lettering is painted by the interiors)
    m.add(rbox(90, 18, 68, 5, 2), { col: wood, pos: [0, 199, 0], surf: SURF.wood });
    m.add(box(92, 3, 70), { col: gilt, pos: [0, 190, 0], surf: SURF.gold });
    m.add(rbox(98, 30, 6, 3, 2), { col: weather(0x0e2a30, 0.35), pos: [0, 226, 20], rot: [-0.35, 0, 0], surf: SURF.wood });
    m.add(box(100, 2, 7), { col: gilt, pos: [0, 241, 15], rot: [-0.35, 0, 0], surf: SURF.gold });
    for (let k = 0; k < 9; k++) {
      const a = (k / 8) * Math.PI;
      m.add(box(6, 26, 3), { col: weather(0xd8c0a0, 0.4), pos: [Math.cos(a) * 13, 244 + Math.sin(a) * 13, 4], rot: [0, 0, a - Math.PI / 2], surf: SURF.porcelain });
    }
  }),
  bw_crane: () => B((m) => {
    // the Crane: a claw machine, its case heaped with plush prizes, a gantry overhead (the claw is the quest's)
    const paint = weather(0x6a1a2a, 0.45, 0.04, 0x8a6a40);
    m.add(rbox(100, 70, 76, 5, 2), { col: paint, pos: [0, 35, 0], surf: SURF.paint });
    for (const y of [4, 70]) m.add(box(102, 3, 78), { col: gilt, pos: [0, y, 0], surf: SURF.gold });
    // the control deck: a brass wheel and a red drop button, the coin slot, the prize chute's door
    m.add(box(70, 14, 20), { col: paint, pos: [-6, 66, 44], rot: [0.5, 0, 0], surf: SURF.paint });
    m.add(torus(6, 1.2, 6, 16), { col: brass, pos: [-18, 72.5, 46.5], rot: [-1.07, 0, 0], surf: SURF.brass });
    m.add(cyl(3.6, 3.6, 3, 12), { col: C(0xe0302a), pos: [8, 72.5, 46.5], rot: [0.5, 0, 0], surf: SURF.bulb, emit: 0.7 });
    m.add(box(8, 4, 1), { col: brass, pos: [28, 50, 38.6], surf: SURF.brass });
    m.add(box(24, 22, 1.5), { col: ink, pos: [28, 28, 38.6], surf: SURF.paint });
    for (const [x, z] of [[-48, 36], [48, 36], [-48, -36], [48, -36]] as [number, number][]) m.add(cyl(2.4, 2.4, 120, 8), { col: brass, pos: [x, 132, z], surf: SURF.brass });
    m.add(box(96, 118, 2), { col: weather(0x2a3036, 0.3), pos: [0, 132, -36], surf: SURF.glass, emit: 0.08 });
    m.add(box(96, 3, 72), { col: ink, pos: [0, 73, 0], surf: SURF.wood });
    const cols = [0xc87a7a, 0x7a9ac8, 0xd8c878, 0x9ac87a, 0xc8a0d8, 0xe8b890];
    for (let k = 0; k < 16; k++) {
      const x = -38 + (k % 6) * 14 + (hash(k) - 0.5) * 4, z = -28 + Math.floor(k / 6) * 18 + (hash(k + 3) - 0.5) * 6;
      if (x > 14 && z > 8) continue;
      prize(m, k % 3, [x, 74.5 + (k % 2) * 6, z], cols[k % cols.length]);
    }
    m.add(box(22, 22, 22), { col: ink, pos: [30, 86, 24], surf: SURF.wood });
    for (const z of [-30, 30]) m.add(box(94, 3, 3), { col: chrome, pos: [0, 188, z], surf: SURF.iron });
    m.add(box(5, 4, 64), { col: chrome, pos: [-36, 186, 0], surf: SURF.iron });
    m.add(rbox(106, 22, 82, 5, 2), { col: paint, pos: [0, 203, 0], surf: SURF.paint });
    m.add(rbox(104, 26, 6, 3, 2), { col: weather(0x2a0a10, 0.35), pos: [0, 226, 30], rot: [-0.35, 0, 0], surf: SURF.wood });
    m.add(box(106, 2, 7), { col: gilt, pos: [0, 239, 25.5], rot: [-0.35, 0, 0], surf: SURF.gold });
  }),
  bw_gallery: () => B((m) => {
    // the shooting gallery: a panelled counter with chained rifles, painted waves behind (the ducks ride the
    // track along the back wall, drawn by the quest and the Barker), a valance for its sign
    const wood = weather(0x3a1a14, 0.45, 0.04);
    m.add(box(440, 60, 40), { col: wood, pos: [0, 30, 0], surf: SURF.wood });
    m.add(box(450, 6, 50), { col: weather(0x8a6a3a, 0.4), pos: [0, 62, 0], surf: SURF.wood });
    m.add(box(450, 1.6, 1.4), { col: gilt, pos: [0, 63.5, 25.4], surf: SURF.gold });
    for (let k = 0; k < 8; k++) m.add(rbox(46, 36, 1.4, 1.5), { col: weather(0x5a1a14, 0.4), pos: [-189 + k * 54, 30, 20.6], surf: SURF.wood });
    for (let i = 0; i < 4; i++) {
      const x = -150 + i * 100;
      m.add(tube([[x - 26, 68, 10], [x - 6, 69, 4], [x + 30, 70, -14]], (t) => (t < 0.35 ? 3.2 : 1.3), 6, 12), { col: (p) => (p.x < x - 4 ? C(0x5a3a1e) : C(0x2a2a2e)), surf: SURF.wood });
      m.add(tube([[x - 26, 67, 10], [x - 34, 64, 18], [x - 30, 62, 24]], 0.5, 4, 8), { col: chrome, surf: SURF.iron });
    }
    for (let r = 0; r < 3; r++) m.add(box(430, 26, 4), { col: weather(r % 2 ? 0x1e3a5a : 0x2a5a7a, 0.4), pos: [0, 110 + r * 40, -70], surf: SURF.paint });
    for (let k = 0; k < 12; k++) m.add(ellipsoid(16, 7, 2, 10, 6), { col: weather(0xd8e0e8, 0.3), pos: [-200 + k * 36 + (k % 2) * 12, 122 + (k % 3) * 40, -67.5], surf: SURF.paint });
    m.add(sphere(16, 14, 10), { col: C(0xf0e8c0), pos: [170, 200, -70], scale: [1, 1, 0.2], surf: SURF.paint, emit: 0.3 });
    m.add(box(430, 4, 6), { col: brass, pos: [0, 150, -66], surf: SURF.brass });
    m.add(box(450, 30, 6), { col: weather(0x2a0a0c, 0.4), pos: [0, 212, -66], surf: SURF.wood });
    for (let k = 0; k < 15; k++) m.add(cyl(15, 15, 4, 12, false), { col: weather(0x7a1a1a, 0.4), pos: [-210 + k * 30, 197, -64], rot: [Math.PI / 2, 0, 0], scale: [1, 0.55, 1], surf: SURF.canvas });
  }),
  bw_sailor: () => B((m) => {
    // the Laughing Sailor in his booth: a grinning automaton in a striped jersey, arms up mid-laugh
    const wood = weather(0x2a3a5a, 0.4, 0.04, 0x8a7a5a);
    m.add(rbox(76, 40, 76, 5, 2), { col: wood, pos: [0, 20, 0], surf: SURF.wood });
    for (const y of [3, 40]) m.add(box(78, 3, 78), { col: gilt, pos: [0, y, 0], surf: SURF.gold });
    for (const [x, z] of [[-36, 36], [36, 36], [-36, -36], [36, -36]] as [number, number][]) m.add(cyl(2.4, 2.4, 150, 8), { col: gilt, pos: [x, 116, z], surf: SURF.gold });
    m.add(box(72, 148, 2), { col: (p) => (Math.floor((p.x + 400) / 9) % 2 ? C(0x7a1e1a) : C(0xc8b89a)), pos: [0, 116, -36], surf: SURF.paint });
    m.add(cyl(14, 17, 52, 14), { col: (p) => (Math.floor((p.y + 400) / 6) % 2 ? C(0x1a2a4a) : C(0xd8d0c0)), pos: [0, 70, 0], surf: SURF.cloth });
    m.add(ellipsoid(16, 6, 13, 12, 6), { col: C(0x1a2a4a), pos: [0, 96, 0], surf: SURF.cloth });
    m.add(sphere(14, 16, 12), { col: weather(0xe0b8a0, 0.3), pos: [0, 116, 2], surf: SURF.porcelain });
    m.add(ellipsoid(10, 5, 5, 12, 6), { col: C(0x3a0606), pos: [0, 110, 13], surf: SURF.latex });
    m.add(box(13, 2, 2), { col: C(0xf0ece0), pos: [0, 113, 15.5], surf: SURF.porcelain });
    for (const s of [-1, 1]) {
      m.add(sphere(2.8, 8, 6), { col: C(0xffffff), pos: [s * 5.5, 120, 13.5], surf: SURF.porcelain });
      m.add(sphere(1.3, 6, 5), { col: ink, pos: [s * 5.5, 120.5, 16], surf: SURF.glass });
      m.add(sphere(3, 8, 6), { col: C(0xd87a6a), pos: [s * 9, 112, 11], surf: SURF.porcelain });
      m.add(tube([[s * 15, 92, 0], [s * 26, 104, 6], [s * 24, 122, 10]], 3.4, 6, 10), { col: (p) => (Math.floor((p.y + 400) / 6) % 2 ? C(0x1a2a4a) : C(0xd8d0c0)), surf: SURF.cloth });
      m.add(sphere(4, 8, 6), { col: C(0xf0f0e8), pos: [s * 23, 126, 10], surf: SURF.cloth });
    }
    m.add(cyl(14, 14.5, 5, 16), { col: C(0xe8e8e0), pos: [0, 129, 2], surf: SURF.cloth });
    m.add(cyl(9, 12, 6, 16), { col: C(0xe8e8e0), pos: [0, 134, 2], surf: SURF.cloth });
    m.add(cyl(14.6, 14.6, 1.6, 16), { col: C(0x1a2a4a), pos: [0, 131, 2], surf: SURF.cloth });
    m.add(rbox(80, 16, 80, 5, 2), { col: wood, pos: [0, 199, 0], surf: SURF.wood });
    m.add(rbox(84, 24, 6, 3, 2), { col: weather(0x14203a, 0.35), pos: [0, 220, 30], rot: [-0.35, 0, 0], surf: SURF.wood });
    m.add(box(86, 2, 7), { col: gilt, pos: [0, 232, 25.6], rot: [-0.35, 0, 0], surf: SURF.gold });
  }),
  bw_changebooth: () => B((m) => {
    // the change booth: a panelled counter, a cage of brass bars round the teller's arch, a little hip roof
    const wood = weather(0x2a2a20, 0.45, 0.04);
    m.add(rbox(100, 62, 80, 4, 2), { col: wood, pos: [0, 31, 0], surf: SURF.wood });
    m.add(box(104, 4, 84), { col: weather(0x6a4a2a, 0.35), pos: [0, 64, 0], surf: SURF.wood });
    for (const s of [-1, 1]) m.add(rbox(36, 40, 1.5, 1.5), { col: weather(0x1a1a14, 0.4), pos: [s * 24, 31, 40.4], surf: SURF.wood });
    for (const [x, z] of [[-48, 38], [48, 38], [-48, -38], [48, -38]] as [number, number][]) m.add(box(5, 70, 5), { col: wood, pos: [x, 101, z], surf: SURF.wood });
    m.add(box(100, 66, 3), { col: wood, pos: [0, 101, -39], surf: SURF.wood });
    for (let k = 0; k < 14; k++) {
      const x = -42 + k * 6.5;
      if (Math.abs(x) < 13) continue;
      m.add(cyl(0.7, 0.7, 58, 5), { col: brass, pos: [x, 97, 39], surf: SURF.brass });
    }
    m.add(torus(12.5, 1, 4, 14, Math.PI), { col: brass, pos: [0, 92, 39], surf: SURF.brass });
    m.add(box(96, 14, 3), { col: weather(0x14140e, 0.4), pos: [0, 130, 39.5], surf: SURF.wood });
    m.add(box(40, 2, 12), { col: brass, pos: [0, 67, 44], surf: SURF.brass });
    for (let k = 0; k < 5; k++) m.add(cyl(2.2, 2.2, 0.8, 10), { col: brass, pos: [-6 + k * 3, 68.4 + k * 0.8, 44], surf: SURF.brass });
    m.add(lathe([[0, 0], [72, 0], [68, 6], [34, 26], [4, 34], [0, 36]], 4, 0, Math.PI / 4), { col: weather(0x5a2a1a, 0.4), pos: [0, 137, 0], surf: SURF.wood });
    m.add(sphere(4, 8, 6), { col: gilt, pos: [0, 175, 0], surf: SURF.gold });
  }),
  bw_cabinet: (v) => B((m) => {
    // the penny machines: a pair of mutoscopes, a pair of pinball tables, a love tester, a punching bag
    if (v % 4 === 0) {
      mutoscope(m, -20, 0x2a3a2a, 0xc87a4a);
      mutoscope(m, 20, 0x4a2a1e, 0x6a9ac8);
    } else if (v % 4 === 1) {
      pinball(m, -20, 0x1a2a5a, 0xff7a9a);
      pinball(m, 20, 0x5a1a2a, 0x7affd0);
    } else if (v % 4 === 2) loveTester(m);
    else puncher(m);
  }),
  bw_skeeball: () => B((m) => {
    // a skee-ball alley (its lane runs along -Z): maple lane, the hump, the ring board, the hood and its score
    const cab = weather(0x3a2416, 0.45, 0.04), red = weather(0x6a1a14, 0.4, 0.04);
    m.add(box(46, 24, 90), { col: cab, pos: [0, 12, 0], surf: SURF.wood });
    m.add(box(36, 2, 60), { col: weather(0xb08a52, 0.3, 0.05), pos: [0, 25.5, 12], rot: [0.05, 0, 0], surf: SURF.wood });
    for (const s of [-1, 1]) {
      m.add(box(5, 9, 90), { col: red, pos: [s * 20.5, 28.5, 0], surf: SURF.wood });
      m.add(box(6, 1.6, 90), { col: gilt, pos: [s * 20.5, 33.6, 0], surf: SURF.gold });
    }
    m.add(cyl(5, 5, 36, 12), { col: weather(0xb08a52, 0.3), pos: [0, 24, -20], rot: [0, 0, Math.PI / 2], surf: SURF.wood });
    const T = 0.75, bc: V3 = [0, 44, -32];
    const at = (u: number, v: number, lift: number): V3 => [bc[0] + u, bc[1] + v * Math.sin(T) + lift * Math.cos(T), bc[2] - v * Math.cos(T) + lift * Math.sin(T)];
    m.add(box(40, 2.5, 30), { col: cab, pos: bc, rot: [T, 0, 0], surf: SURF.wood });
    for (const [r, c] of [[12.5, 0xffb04a], [8, 0xffd27a], [3.8, 0xfff0c0]] as [number, number][]) m.add(torus(r, 1.3, 6, 24), { col: C(c), pos: at(0, 3, 1.6), rot: [T - Math.PI / 2, 0, 0], surf: SURF.bulb, emit: 0.85 });
    m.add(cyl(2.4, 2.4, 1, 12), { col: ink, pos: at(0, 3, 1.4), rot: [T, 0, 0], surf: SURF.paint });
    for (const s of [-1, 1]) m.add(cyl(2, 2, 1, 10), { col: ink, pos: at(s * 15, 11, 1.4), rot: [T, 0, 0], surf: SURF.paint });
    m.add(box(46, 44, 8), { col: cab, pos: [0, 46, -42], surf: SURF.wood });
    m.add(box(48, 12, 24), { col: red, pos: [0, 74, -34], surf: SURF.wood });
    m.add(box(30, 6, 0.8), { col: C(0xff6a3a), pos: [0, 74, -21.7], surf: SURF.glass, emit: 0.85 });
    m.add(box(50, 1.8, 26), { col: gilt, pos: [0, 80.6, -34], surf: SURF.gold });
    for (const s of [-1, 1]) {
      for (const z of [-26, -10, 6]) m.add(cyl(0.8, 0.8, 34, 5), { col: chrome, pos: [s * 21, 50, z], surf: SURF.iron });
      m.add(box(1, 1, 36), { col: chrome, pos: [s * 21, 67, -10], surf: SURF.iron });
    }
    m.add(box(30, 5, 10), { col: ink, pos: [0, 27, 40], surf: SURF.wood });
    for (let k = 0; k < 4; k++) m.add(sphere(3.2, 10, 8), { col: weather(0xa87a44, 0.25), pos: [-9 + k * 6, 30.5, 40], surf: SURF.wood });
  }),

  // ---- Seashell Souvenirs & Curiosities
  bw_shelf: (w) => souvenirStand(w || 200),
  bw_counter: () => B((m) => {
    // the counter: panelled front, a gilt edge, the brass register, a jar of taffy, the bell and the day book
    const dk = weather(0x3a2418, 0.45, 0.04);
    m.add(box(220, 64, 56), { col: dk, pos: [0, 34, -2], surf: SURF.wood });
    m.add(box(222, 6, 58), { col: weather(0x1e120c, 0.4), pos: [0, 3, -2], surf: SURF.wood });
    m.add(box(226, 5, 62), { col: weather(0x6a4a2a, 0.3, 0.05), pos: [0, 68.5, 0], surf: SURF.wood });
    m.add(box(226, 1.6, 1.4), { col: gilt, pos: [0, 70, 31.2], surf: SURF.gold });
    for (let k = 0; k < 5; k++) m.add(rbox(36, 42, 1.4, 1.5), { col: weather(0x2a1810, 0.4), pos: [-88 + k * 44, 34, 26.4], surf: SURF.wood });
    const rx = 40, rz = -4;
    m.add(rbox(44, 22, 34, 3, 2), { col: brass, pos: [rx, 82, rz], surf: SURF.brass });
    m.add(box(40, 10, 16), { col: brass, pos: [rx, 92, rz + 8], rot: [0.5, 0, 0], surf: SURF.brass });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) m.add(cyl(1.6, 1.6, 2.4, 8), { col: cream, pos: [rx - 15 + c * 6, 96 + r * 2.2, rz + 5 - r * 4], rot: [0.5, 0, 0], surf: SURF.porcelain });
    m.add(rbox(30, 16, 10, 3, 2), { col: brass, pos: [rx, 104, rz - 10], surf: SURF.brass });
    m.add(box(20, 6, 0.6), { col: C(0xfff0c0), pos: [rx, 105, rz - 4.6], surf: SURF.glass, emit: 0.6 });
    m.add(cyl(2.4, 2.4, 4, 8), { col: brass, pos: [rx + 24, 84, rz], rot: [0, 0, Math.PI / 2], surf: SURF.brass });
    m.add(box(2, 12, 2), { col: brass, pos: [rx + 26, 80, rz + 2], surf: SURF.brass });
    m.add(cyl(8.5, 8.5, 15, 14), { col: (p) => C([0xe8a0b8, 0xf0e0a0, 0xa0d0e8][Math.floor((p.y + p.x * 0.3 + 400) / 3) % 3]), pos: [-60, 79, 2], surf: SURF.porcelain, emit: 0.08 });
    m.add(cyl(6, 9, 3, 14), { col: cream, pos: [-60, 88, 2], surf: SURF.porcelain });
    m.add(sphere(2, 8, 6), { col: cream, pos: [-60, 90.5, 2], surf: SURF.porcelain });
    m.add(sphere(4.5, 10, 8), { col: brass, pos: [-30, 73.5, 14], scale: [1, 0.7, 1], surf: SURF.brass });
    m.add(sphere(1.2, 6, 5), { col: brass, pos: [-30, 77.5, 14], surf: SURF.brass });
    m.add(box(24, 3, 17), { col: weather(0x5a1a14, 0.35), pos: [-6, 72.5, 4], rot: [0, 0.2, 0], surf: SURF.cloth });
    m.add(box(22, 1, 15), { col: C(0xe8e0c8), pos: [-6, 74.4, 4], rot: [0, 0.2, 0], surf: SURF.paint });
  }),
  bw_case: () => B((m) => {
    // a jewellery case: a dark base, gilt frame round its glass, shell brooches, rings and a watch on velvet
    const dk = weather(0x2a1a12, 0.45, 0.04);
    m.add(box(120, 46, 46), { col: dk, pos: [0, 23, 0], surf: SURF.wood });
    m.add(box(122, 3, 48), { col: gilt, pos: [0, 47, 0], surf: SURF.gold });
    for (const [x, z] of [[-59, 22], [59, 22], [-59, -22], [59, -22]] as [number, number][]) m.add(box(2.4, 34, 2.4), { col: gilt, pos: [x, 65, z], surf: SURF.gold });
    for (const z of [-23, 23]) m.add(box(122, 2.4, 2.4), { col: gilt, pos: [0, 83, z], surf: SURF.gold });
    for (const x of [-60, 60]) m.add(box(2.4, 2.4, 48), { col: gilt, pos: [x, 83, 0], surf: SURF.gold });
    m.add(box(116, 1.5, 42), { col: weather(0x3a1a3a, 0.3), pos: [0, 49.5, 0], surf: SURF.velvet });
    for (let k = 0; k < 5; k++) m.add(torus(4.5, 1.2, 4, 12), { col: weather(0xe8d8b8, 0.3), pos: [-44 + k * 22, 51.5, 6], rot: [Math.PI / 2, 0, 0], surf: SURF.porcelain });
    for (let k = 0; k < 4; k++) m.add(torus(2.4, 0.7, 4, 10), { col: gilt, pos: [-33 + k * 22, 51, -8], rot: [Math.PI / 2 - 0.3, 0, 0], surf: SURF.gold });
    m.add(cyl(6, 6, 2, 16), { col: gilt, pos: [40, 51.5, -8], surf: SURF.gold });
    m.add(cyl(5, 5, 0.4, 16), { col: cream, pos: [40, 52.6, -8], surf: SURF.porcelain, emit: 0.15 });
    m.add(ellipsoid(5, 1.4, 6.5, 12, 6), { col: C(0xd8a890), pos: [-48, 51.5, -10], surf: SURF.porcelain });
  }),
  bw_photo: () => B((m) => {
    // the photograph on a tall easel near the north wall (the picture itself is painted by the quest), leaning
    // back so it faces whoever looks up at it; a museum lamp arching over it; a caption on the easel's ledge
    const wood = weather(0x3a2414, 0.4, 0.04);
    // two front legs behind the picture meeting a back leg at the apex; the ledge on brackets in front
    for (const s of [-1, 1]) m.add(tube([[s * 56, 0, 12 + EZ], [s * 43, 97, -18 + EZ], [s * 30, 194, -48 + EZ]], 2.4, 6, 8), { col: wood, surf: SURF.wood });
    m.add(tube([[0, 0, -80 + EZ], [0, 97, -64 + EZ], [0, 194, -48 + EZ]], 2.2, 6, 8), { col: wood, surf: SURF.wood });
    m.add(box(90, 3, 3), { col: wood, pos: [0, 97, -18 + EZ], surf: SURF.wood });
    m.add(box(160, 4, 14), { col: wood, pos: [0, 40, 18 + EZ], surf: SURF.wood });
    m.add(box(160, 8, 2), { col: wood, pos: [0, 44, 24.5 + EZ], surf: SURF.wood });
    for (const s of [-1, 1]) m.add(box(8, 5, 22), { col: wood, pos: [s * 47, 40, 4 + EZ], surf: SURF.wood });
    const { w, h, lean } = PHOTO, at = photoAt;
    m.add(box(w + 6, h + 6, 3), { col: weather(0x1a120c, 0.3), pos: at(0, 0, -2.5), rot: [-lean, 0, 0], surf: SURF.wood });
    for (const [bw, bh, u, v] of [[w + 28, 14, 0, h / 2 + 7], [w + 28, 14, 0, -h / 2 - 7], [14, h, -w / 2 - 7, 0], [14, h, w / 2 + 7, 0]] as [number, number, number, number][]) {
      m.add(box(bw, bh, 6), { col: gilt, pos: at(u, v, 0), rot: [-lean, 0, 0], surf: SURF.gold });
    }
    // the lamp: a brass arm from the frame's top, a hooded bulb aimed down at the picture
    const top = PHOTO_TOP;
    m.add(tube([top, [0, top[1] + 14, top[2] + 6], [0, top[1] + 12, top[2] + 24]], 1.2, 5, 10), { col: brass, surf: SURF.brass });
    m.add(cyl(3, 6, 8, 12, true), { col: brass, pos: [0, top[1] + 8, top[2] + 25], rot: [0.9, 0, 0], surf: SURF.brass });
    m.add(sphere(2.6, 8, 6), { col: C(0xfff0c8), pos: PHOTO_BULB, surf: SURF.bulb, emit: 1.2 });
  }),
  bw_cabinet_tall: () => B((m) => {
    // the founder's cabinet: a carved crest, glass doors, a ship model, a sextant and books on its shelves
    const dk = weather(0x2a1810, 0.45, 0.04);
    m.add(box(80, 186, 3), { col: dk, pos: [0, 93, -20], surf: SURF.wood });
    for (const s of [-1, 1]) m.add(box(5, 186, 42), { col: dk, pos: [s * 37.5, 93, 0], surf: SURF.wood });
    m.add(box(80, 30, 42), { col: dk, pos: [0, 15, 0], surf: SURF.wood });
    m.add(box(26, 3, 1), { col: brass, pos: [0, 18, 21.5], surf: SURF.brass });
    m.add(box(88, 10, 48), { col: dk, pos: [0, 191, 0], surf: SURF.wood });
    const crest = new THREE.Shape();
    crest.moveTo(-40, 0);
    crest.lineTo(40, 0);
    crest.quadraticCurveTo(20, 6, 0, 22);
    crest.quadraticCurveTo(-20, 6, -40, 0);
    m.add(extrude(crest, 5, 0, 12), { col: dk, pos: [0, 196, 18], surf: SURF.wood });
    for (const y of [70, 112, 152]) m.add(box(70, 2.5, 36), { col: weather(0x4a3020, 0.35), pos: [0, y, -1], surf: SURF.wood });
    m.add(extrude([[-22, 0], [22, 0], [18, 7], [-18, 7]], 10, 0, 1), { col: weather(0x2a1a10, 0.3), pos: [0, 72, -2], surf: SURF.wood });
    for (const [x, h] of [[-8, 34], [4, 38], [14, 26]] as [number, number][]) m.add(cyl(0.7, 0.7, h, 5), { col: weather(0x5a3a24, 0.3), pos: [x, 79 + h / 2, -2], surf: SURF.wood });
    for (const [x, h] of [[-8, 18], [4, 22], [14, 14]] as [number, number][]) m.add(box(14, h, 0.5), { col: C(0xe8e0c8), pos: [x, 86 + h / 2, -1], surf: SURF.canvas });
    m.add(torus(11, 1.2, 4, 14, Math.PI / 3), { col: brass, pos: [-14, 116, -4], rot: [0, 0, Math.PI * 0.85], surf: SURF.brass });
    m.add(box(2, 16, 2), { col: brass, pos: [-14, 122, -4], rot: [0, 0, 0.2], surf: SURF.brass });
    for (let k = 0; k < 6; k++) m.add(box(5, 22 + (k % 3) * 3, 18), { col: C([0x5a1a14, 0x1e3a2a, 0x2a2a4a][k % 3]), pos: [6 + k * 5.4, 165 + (k % 3) * 1.5, -6], surf: SURF.cloth });
    m.add(box(18, 4, 24), { col: weather(0x4a1a10, 0.3), pos: [-18, 156, -4], surf: SURF.cloth });
    for (const [bw, bh, x, y] of [[74, 3, 0, 182], [74, 3, 0, 31], [3, 152, -36, 106], [3, 152, 36, 106], [2.4, 152, 0, 106]] as [number, number, number, number][]) {
      m.add(box(bw, bh, 2.5), { col: gilt, pos: [x, y, 21.5], surf: SURF.gold });
    }
    m.add(box(3, 5, 1), { col: brass, pos: [4, 104, 22.6], surf: SURF.brass });
  }),
};

// ---------------------------------------------------------------- glass
/** A pane: its size, its centre (in the prop's frame), and how far it tips about X. */
type Pane = [w: number, h: number, d: number, x: number, y: number, z: number, rx?: number];
const PANES: Record<string, Pane[]> = {
  bw_fortune: [[74, 108, 0.8, 0, 134, 27.5], [0.8, 108, 52, -38, 134, 0], [0.8, 108, 52, 38, 134, 0]],
  bw_crane: [[94, 116, 0.8, 0, 132, 36], [0.8, 116, 70, -48, 132, 0], [0.8, 116, 70, 48, 132, 0]],
  bw_sailor: [[70, 146, 0.8, 0, 116, 36], [0.8, 146, 70, -36, 116, 0], [0.8, 146, 70, 36, 116, 0]],
  bw_changebooth: [[0.8, 66, 74, -48, 101, 0], [0.8, 66, 74, 48, 101, 0]],
  'bw_cabinet:1': [[27, 0.4, 51, -20, 52, 0.4, 0.1], [27, 0.4, 51, 20, 52, 0.4, 0.1]],
  bw_case: [[116, 0.6, 44, 0, 83, 0], [116, 34, 0.6, 0, 65, 22.5], [0.6, 34, 44, -59.5, 65, 0], [0.6, 34, 44, 59.5, 65, 0]],
  bw_cabinet_tall: [[70, 150, 0.8, 0, 106, 21]],
};

/** Every pane of glass among the props, in world space, as one geometry (for one translucent mesh). */
export function glassGeometry(props: Prop[]): THREE.BufferGeometry | null {
  const m = new ModelBuilder();
  let n = 0;
  for (const p of props) {
    const panes = PANES[`${p.kind}:${(p.variant ?? 0) % 4}`] ?? PANES[p.kind];
    if (!panes) continue;
    const c = Math.cos(p.yaw ?? 0), s = Math.sin(p.yaw ?? 0);
    for (const [w, h, d, x, y, z, rx] of panes) {
      m.add(box(w, h, d), { col: C(0xb8dce4), pos: [p.x + x * c + z * s, y, p.y - x * s + z * c], rot: [rx ?? 0, p.yaw ?? 0, 0], surf: SURF.glass });
      n++;
    }
  }
  return n ? m.build({ ao: 0 }) : null;
}
