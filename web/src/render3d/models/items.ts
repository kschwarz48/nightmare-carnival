// Pickups, player projectiles, enemy bullets and summons (D-38). Projectiles point along +Z (their
// direction of travel). Enemy bullets are emissive so the danger always reads against the dark;
// pickups glow softly and bob.

import * as THREE from 'three';
import { C, cone, cyl, ellipsoid, extrude, lathe, rbox, smoothShape, sphere, starShape, torus, tube, weather, stripes, type V3 } from '../core/geo';
import { ModelBuilder, PAL, PART, SURF, body, bulb, eyes, glove, limb, ruff, shoe, stitches } from './kit';
import type { ModelDef } from './index';

const NO_RIM: [number, number, number, number] = [0, 0, 0, 0];

function ticketShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  const n = h * 0.18;
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, -n);
  s.absarc(w / 2, 0, n, -Math.PI / 2, Math.PI / 2, true);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.lineTo(-w / 2, n);
  s.absarc(-w / 2, 0, n, Math.PI / 2, -Math.PI / 2, true);
  s.lineTo(-w / 2, -h / 2);
  return s;
}

// ---------------------------------------------------------------- pickups
/**
 * A ticket as a little neon sign (D-41): a dark enamel ticket outlined in a glowing neon tube with a
 * neon star inside — colour-coded by value (blue → green → magenta, D-27) so pickups never
 * read as danger (enemy fire is orange/white).
 */
function ticket(neon: number, size: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const w = 16 * size, h = 9 * size;
  m.add(extrude(ticketShape(w, h), 0.9, 0.25, 6, 1), { col: 0x1a1418, surf: SURF.paint });
  const outline = ticketShape(w * 0.9, h * 0.82).getPoints(10).map((p) => [p.x, p.y, 0.9] as V3);
  m.add(tube(outline, 0.62 * size, 5, outline.length * 2, true), { col: neon, emit: 1, surf: SURF.bulb });
  const star = starShape(5, 2.6 * size, 1.1 * size).getPoints(1).map((p) => [p.x, p.y, 0.9] as V3);
  m.add(tube(star, 0.42 * size, 4, star.length * 2, true), { col: neon, emit: 1, surf: SURF.bulb });
  return m.build({ ao: 0 });
}

function bank(): THREE.BufferGeometry {
  // a fat roll of tickets bound with brass
  const m = new ModelBuilder();
  m.add(cyl(9, 9, 12, 18), { col: weather(PAL.cream, 0.25), rot: [0, 0, Math.PI / 2], emit: 0.4, surf: SURF.paint });
  m.add(cyl(4, 4, 12.4, 12), { col: PAL.woodDark, rot: [0, 0, Math.PI / 2], surf: SURF.wood });
  for (const x of [-4.5, 4.5]) m.add(torus(9.2, 0.9, 6, 18), { col: PAL.brass, pos: [x, 0, 0], rot: [0, Math.PI / 2, 0], surf: SURF.brass });
  m.add(extrude(ticketShape(12, 7), 0.5, 0, 4), { col: PAL.blood, pos: [0, -7, 10], rot: [0.3, 0, 0], emit: 0.4, surf: SURF.paint });
  return m.build({ ao: 0 });
}

function food(): THREE.BufferGeometry {
  // candy apple: glossy blood-red shell on a stick, drips of caramel
  const m = new ModelBuilder();
  m.add(sphere(8, 16, 12), { col: PAL.blood, pos: [0, 8, 0], scale: [1, 0.92, 1], surf: SURF.porcelain, emit: 0.25 });
  m.add(lathe([[8.2, 2.4], [8.6, 4], [7.6, 6], [0, 6]], 14), { col: PAL.ochre, pos: [0, 0, 0], surf: SURF.porcelain });
  m.add(cyl(0.8, 0.8, 14, 6), { col: PAL.woodPale, pos: [0, 19, 0], surf: SURF.wood });
  return m.build({ ao: 0.1 });
}

function funnel(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(11, 10, 1.4, 16), { col: PAL.cream, surf: SURF.paint });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    m.add(torus(4.4, 1.6, 5, 12), { col: weather(PAL.ochre, 0.3), pos: [Math.cos(a) * 4.4, 2.4, Math.sin(a) * 4.4], rot: [Math.PI / 2, 0, a], surf: SURF.cloth });
  }
  for (let i = 0; i < 14; i++) m.add(sphere(0.9, 4, 3), { col: PAL.bone, pos: [Math.cos(i * 2.4) * (i % 7), 4.4, Math.sin(i * 2.4) * (i % 7)], emit: 0.4, surf: SURF.cloth });
  return m.build({ ao: 0.1 });
}

function golden(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(extrude(ticketShape(24, 13), 1.2, 0.4, 8, 2), { col: PAL.gold, emit: 0.6, surf: SURF.gold });
  m.add(extrude(starShape(5, 4.4, 1.9), 1.6, 0, 1), { col: 0xfff0b0, emit: 1, surf: SURF.gold });
  return m.build({ ao: 0 });
}

function chest(): THREE.BufferGeometry {
  // brass-bound prize trunk with a painted star and a heavy padlock
  const m = new ModelBuilder();
  const wood = weather(PAL.redDeep, 0.45, 0.08, PAL.woodPale);
  m.add(rbox(34, 18, 22, 1.6, 2), { col: wood, pos: [0, 9, 0], surf: SURF.wood });
  m.add(lathe([[0, 0], [11, 0], [11.4, 3], [10, 7], [6, 9.6], [0, 10.4]], 12), { col: wood, pos: [0, 18, 0], rot: [0, 0, Math.PI / 2], scale: [1, 1.55, 1], surf: SURF.wood });
  for (const x of [-12, 0, 12]) {
    m.add(rbox(2.6, 19, 22.6, 0.4, 1), { col: PAL.brass, pos: [x, 9, 0], surf: SURF.brass });
    m.add(torus(11.2, 1.2, 4, 14, Math.PI), { col: PAL.brass, pos: [x, 18, 0], rot: [0, Math.PI / 2, 0], surf: SURF.brass });
  }
  m.add(extrude(starShape(5, 4.6, 2), 0.8, 0, 1), { col: PAL.mustard, pos: [-6, 9, 11.4], surf: SURF.paint });
  m.add(rbox(6, 7, 3, 1, 1), { col: PAL.gold, pos: [0, 15, 12], surf: SURF.gold });
  m.add(torus(2.4, 0.8, 5, 10, Math.PI), { col: PAL.iron, pos: [0, 18.4, 12], surf: SURF.iron });
  // a sliver of light escapes the lid seam
  m.add(rbox(33, 0.8, 21, 0.3, 1), { col: PAL.amber, pos: [0, 18.2, 0], emit: 1.2, surf: SURF.bulb });
  return m.build({ ao: 0.3 });
}

/**
 * A fallen co-op player (D-51): a lacquered six-sided coffin with a brass cross and handles. Lying
 * along the screen's vertical so it reads at a glance from the 2.5D camera.
 */
function coffin(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const outline: [number, number][] = [[-7, 26], [7, 26], [12, 13], [6, -26], [-6, -26], [-12, 13]];
  const lid = outline.map(([x, y]) => [x * 0.86, y * 0.9] as [number, number]);
  // the shape lies in XY; rotating -90 degrees about X lays it on the ground with depth along +Y
  m.add(extrude(outline, 8, 0.8, 1, 1), { col: weather(PAL.woodDark, 0.4, 0.06, PAL.wood), pos: [0, 4.6, 0], rot: [-Math.PI / 2, 0, 0], surf: SURF.wood });
  m.add(extrude(lid, 2.4, 0.6, 1, 1), { col: 0x2a1a14, pos: [0, 9.6, 0], rot: [-Math.PI / 2, 0, 0], surf: SURF.wood });
  m.add(rbox(3, 1.2, 26, 0.4, 1), { col: PAL.brass, pos: [0, 11.2, -1], surf: SURF.brass });
  m.add(rbox(14, 1.2, 3, 0.4, 1), { col: PAL.brass, pos: [0, 11.2, -9], surf: SURF.brass });
  // brass handle bars just proud of the tapering side walls
  for (const z of [-12, 4]) for (const x of [-1, 1]) m.add(rbox(1.4, 1.4, 6, 0.5, 1), { col: PAL.brass, pos: [x * (6.9 + ((26 - z) * 6) / 39), 5, z], surf: SURF.brass });
  return m.build({ ao: 0.35 });
}

// ---------------------------------------------------------------- player projectiles
function card(face: number, back: number, size = 1): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(rbox(10 * size, 0.6, 14 * size, 1, 1), { col: back, surf: SURF.paint, emit: 0.3 });
  m.add(rbox(7 * size, 0.7, 11 * size, 0.6, 1), { col: face, surf: SURF.paint, emit: 0.4 });
  return m.build({ ao: 0 });
}

function dart(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cone(1.2, 6, 6), { col: PAL.iron, pos: [0, 0, 9], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
  m.add(cyl(0.9, 0.9, 10, 6), { col: PAL.red, pos: [0, 0, 2], rot: [Math.PI / 2, 0, 0], surf: SURF.paint });
  for (let i = 0; i < 3; i++) m.add(rbox(0.4, 5, 6, 0.1, 1), { col: PAL.cream, pos: [0, 0, -5], rot: [0, 0, (i * Math.PI * 2) / 3], surf: SURF.cloth, emit: 0.3 });
  return m.build({ ao: 0 });
}

function ring(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(torus(10, 2.2, 8, 22), { col: stripes(8, PAL.cream, PAL.red, 0, 0.1), rot: [Math.PI / 2, 0, 0], emit: 0.35, surf: SURF.paint });
  return m.build({ ao: 0 });
}

function cannonball(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(sphere(10, 14, 10), { col: PAL.charcoal, surf: SURF.iron });
  m.add(tube([[0, 9, 0], [2, 13, -1], [1, 15, 1]], 0.6, 4, 6), { col: PAL.woodPale, surf: SURF.cloth });
  m.add(sphere(1.6, 6, 4), { col: PAL.amber, pos: [1, 15.5, 1], emit: 2, surf: SURF.bulb });
  return m.build({ ao: 0 });
}

function rocket(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(2.6, 2.6, 14, 10), { col: stripes(6, PAL.cream, PAL.blood, 0, 0.1), rot: [Math.PI / 2, 0, 0], surf: SURF.paint, emit: 0.2 });
  m.add(cone(2.8, 6, 10), { col: PAL.gold, pos: [0, 0, 10], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
  for (let i = 0; i < 3; i++) m.add(rbox(0.6, 5, 4, 0.2, 1), { col: PAL.blood, pos: [0, 0, -6], rot: [0, 0, (i * Math.PI * 2) / 3], surf: SURF.paint });
  m.add(cone(2, 7, 8), { col: PAL.amber, pos: [0, 0, -10], rot: [-Math.PI / 2, 0, 0], emit: 2.5, surf: SURF.bulb });
  return m.build({ ao: 0 });
}

function kernel(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    m.add(sphere(3.4, 7, 5), { col: PAL.cream, pos: [Math.cos(a) * 2.6, Math.sin(i * 1.7), Math.sin(a) * 2.6], surf: SURF.cloth, emit: 0.3 });
  }
  m.add(sphere(2.4, 6, 4), { col: PAL.mustard, surf: SURF.cloth, emit: 0.3 });
  return m.build({ ao: 0 });
}

function shrapnel(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(extrude([[-3, -2], [4, -1], [2, 3], [-2, 2]], 1.4, 0, 1), { col: PAL.amber, emit: 1.2, surf: SURF.iron });
  return m.build({ ao: 0 });
}

function ghostCar(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(torus(13, 3.2, 6, 18), { col: PAL.ghost, pos: [0, 5, 0], rot: [Math.PI / 2, 0, 0], emit: 0.9, surf: SURF.glass });
  m.add(lathe([[0, 0], [12, 1], [13, 7], [10, 12], [0, 13]], 14), { col: 0x5f9f8a, pos: [0, 2, 0], emit: 0.5, surf: SURF.glass });
  eyes(m, { x: 4.4, y: 11, z: 10.6, r: 2, color: PAL.bone, glow: 1.2, part: PART.BODY });
  return m.build({ ao: 0 });
}

function note(): THREE.BufferGeometry {
  // a quaver: brass-black head, stem and flag — pointing forward as it flies
  const m = new ModelBuilder();
  m.add(ellipsoid(4.4, 3.2, 3.2, 10, 8), { col: PAL.ghost, emit: 1.2, surf: SURF.glass, rot: [0, 0, 0.4] });
  m.add(cyl(0.7, 0.7, 13, 5), { col: PAL.ghost, pos: [3.6, 6.4, 0], emit: 1.0, surf: SURF.glass });
  m.add(tube([[3.6, 13, 0], [7, 10, 0], [7.6, 6, 0]], 0.9, 4, 8), { col: PAL.ghost, emit: 1.0, surf: SURF.glass });
  return m.build({ ao: 0 });
}

function mirrorShot(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(extrude([[0, 7], [4, 0], [0, -7], [-4, 0]], 1, 0.3, 1), { col: PAL.cold, emit: 1.1, surf: SURF.glass, rot: [Math.PI / 2, 0, 0] });
  return m.build({ ao: 0 });
}

// ---------------------------------------------------------------- enemy bullets (bright, readable)
function pie(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(8, 6.4, 3, 14), { col: PAL.woodPale, surf: SURF.wood, emit: 0.3 });
  m.add(ellipsoid(7.8, 3.4, 7.8, 12, 6), { col: 0xfff2d8, pos: [0, 2.4, 0], emit: 0.7, surf: SURF.porcelain });
  m.add(sphere(1.8, 6, 4), { col: PAL.hotRed, pos: [0, 5.2, 0], emit: 1.2, surf: SURF.porcelain });
  return m.build({ ao: 0 });
}

function orb(col: number, r = 6, core = 0xffffff): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(sphere(r, 12, 8), { col, emit: 1.6, surf: SURF.bulb });
  m.add(sphere(r * 0.55, 8, 6), { col: core, emit: 2.4, surf: SURF.bulb });
  return m.build({ ao: 0 });
}

function bulletTicket(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(extrude(ticketShape(14, 8), 1, 0.2, 4, 1), { col: 0xffd0a0, emit: 1.4, surf: SURF.paint, rot: [Math.PI / 2, 0, 0] });
  return m.build({ ao: 0 });
}

function popcorn(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  for (let i = 0; i < 6; i++) m.add(sphere(3.4, 7, 5), { col: 0xfff4c8, pos: [Math.cos(i) * 2.6, Math.sin(i * 2.1) * 2.4, Math.sin(i) * 2.6], emit: 1.3, surf: SURF.cloth });
  return m.build({ ao: 0 });
}

function starBullet(col: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(extrude(starShape(5, 7, 3), 2, 0.4, 1), { col, emit: 1.8, surf: SURF.bulb, rot: [Math.PI / 2, 0, 0] });
  return m.build({ ao: 0 });
}

function crown(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(6, 6, 4, 12, true), { col: PAL.gold, emit: 1.2, surf: SURF.gold });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    m.add(cone(1.6, 5, 4), { col: PAL.gold, pos: [Math.cos(a) * 6, 4.4, Math.sin(a) * 6], emit: 1.2, surf: SURF.gold });
    m.add(sphere(1, 5, 4), { col: PAL.hotRed, pos: [Math.cos(a) * 6, 1, Math.sin(a) * 6], emit: 2, surf: SURF.glass });
  }
  return m.build({ ao: 0 });
}

function spoke(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(1.6, 1.6, 22, 6), { col: 0xffc080, rot: [Math.PI / 2, 0, 0], emit: 1.5, surf: SURF.iron });
  for (const z of [-11, 11]) m.add(sphere(2.6, 6, 4), { col: PAL.hotRed, pos: [0, 0, z], emit: 2, surf: SURF.bulb });
  return m.build({ ao: 0 });
}

function gondola(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(lathe([[0, 0], [8, 0], [9, 6], [7, 10], [0, 10]], 10), { col: 0xff8a60, emit: 1.2, surf: SURF.paint });
  m.add(cone(7, 6, 10), { col: 0xffc080, pos: [0, 14, 0], emit: 1.4, surf: SURF.paint });
  return m.build({ ao: 0 });
}

function hellfire(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(ellipsoid(6, 6, 9, 10, 8), { col: PAL.ember, emit: 2.2, surf: SURF.bulb });
  m.add(cone(5, 12, 8), { col: PAL.hotRed, pos: [0, 0, -8], rot: [-Math.PI / 2, 0, 0], emit: 2, surf: SURF.bulb });
  return m.build({ ao: 0 });
}

function bolt(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(extrude([[-1, 8], [3, 1], [0, 1], [2, -8], [-3, -1], [0, -1]], 1.6, 0, 1), { col: PAL.cold, emit: 2, surf: SURF.bulb, rot: [Math.PI / 2, 0, 0] });
  return m.build({ ao: 0 });
}

// ---------------------------------------------------------------- summons
function plush(): THREE.BufferGeometry {
  // a fierce little teddy: tinted per summon variant
  const m = new ModelBuilder();
  const fur = weather(0xd8cab0, 0.35, 0.2);
  body(m, [[0, 2], [8, 3], [10, 10], [9, 17], [6, 21], [0, 22]], fur, { surf: SURF.plush });
  for (const s of [-1, 1]) {
    m.add(ellipsoid(3.6, 4.2, 3.6, 8, 6), { col: fur, pos: [s * 5, 2.6, 1], part: s > 0 ? PART.LEG_L : PART.LEG_R, pivot: [s * 5, 6, 0], surf: SURF.plush });
    m.add(ellipsoid(3, 5.4, 3, 8, 6), { col: fur, pos: [s * 10, 14, 2], rot: [0, 0, s * 0.6], part: s > 0 ? PART.ARM_L : PART.ARM_R, pivot: [s * 8, 18, 0], surf: SURF.plush });
  }
  const hp: V3 = [0, 21, 0];
  m.add(sphere(8.4, 12, 10), { col: fur, pos: [0, 28, 0], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  for (const s of [-1, 1]) m.add(sphere(3.2, 8, 6), { col: fur, pos: [s * 7, 35, -1], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  m.add(ellipsoid(4, 3.2, 3, 8, 6), { col: 0xe8dcc4, pos: [0, 26, 6.8], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  eyes(m, { x: 3, y: 30, z: 7, r: 1.4, color: PAL.ink, pivot: hp });
  m.add(sphere(1.2, 6, 4), { col: PAL.ink, pos: [0, 27, 9.4], part: PART.HEAD, pivot: hp, surf: SURF.porcelain });
  stitches(m, [-3, 24, 8.6], [3, 24, 8.6], 3, PAL.ink, PART.HEAD, hp, 0.9);
  m.add(torus(4, 1, 5, 10), { col: PAL.blood, pos: [0, 21, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.cloth });
  return m.build();
}

function rabbit(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const fur = weather(PAL.bone, 0.3, 0.2);
  m.add(ellipsoid(8, 8, 10, 12, 8), { col: fur, pos: [0, 8, -2], surf: SURF.plush });
  const hp: V3 = [0, 12, 5];
  m.add(sphere(6, 12, 8), { col: fur, pos: [0, 16, 6], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  for (const s of [-1, 1]) m.add(ellipsoid(1.8, 8, 1.4, 8, 6), { col: fur, pos: [s * 2.6, 26, 4], rot: [-0.3, 0, s * 0.25], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  eyes(m, { x: 2.4, y: 17.5, z: 10.6, r: 1.3, color: PAL.hotRed, glow: 1, pivot: hp });
  for (const s of [-1, 1]) m.add(ellipsoid(2.4, 2, 6, 6, 4), { col: fur, pos: [s * 5, 2, 2], part: s > 0 ? PART.LEG_L : PART.LEG_R, pivot: [s * 5, 5, 0], surf: SURF.plush });
  m.add(sphere(2.6, 6, 4), { col: fur, pos: [0, 9, -12], surf: SURF.plush });
  return m.build();
}

function dove(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const feather = weather(PAL.bone, 0.25, 0.2);
  m.add(ellipsoid(4.6, 4.6, 10, 10, 8), { col: feather, surf: SURF.cloth });
  m.add(sphere(3.6, 8, 6), { col: feather, pos: [0, 3, 9], part: PART.HEAD, pivot: [0, 1, 7], surf: SURF.cloth });
  m.add(cone(1.2, 3, 5), { col: PAL.ochre, pos: [0, 2.6, 13.4], rot: [Math.PI / 2, 0, 0], part: PART.HEAD, pivot: [0, 1, 7], surf: SURF.paint });
  const wing = smoothShape([[0, 0], [14, 3], [18, -2], [10, -5], [0, -3]], 20);
  m.add(extrude(wing, 0.8, 0, 6), { col: feather, pos: [3, 2, 0], rot: [Math.PI / 2, 0, 0], part: PART.ARM_L, pivot: [3, 2, 0], surf: SURF.cloth });
  m.add(extrude(wing, 0.8, 0, 6), { col: feather, pos: [-3, 2, 0], rot: [Math.PI / 2, 0, Math.PI], scale: [1, 1, 1], part: PART.ARM_R, pivot: [-3, 2, 0], surf: SURF.cloth });
  m.add(extrude([[0, 0], [5, -6], [-5, -6]], 0.8, 0, 1), { col: feather, pos: [0, 0, -9], rot: [Math.PI / 2, 0, 0], surf: SURF.cloth });
  return m.build({ ao: 0 });
}

function lion(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const coat = weather(PAL.ochre, 0.35, 0.15);
  m.add(ellipsoid(10, 10, 20, 14, 10), { col: coat, pos: [0, 20, -2], surf: SURF.plush });
  for (const [x, z, part] of [[6, 10, PART.LEG_L], [-6, 10, PART.LEG_R], [6, -14, PART.LEG_R], [-6, -14, PART.LEG_L]] as [number, number, number][]) {
    m.add(cyl(3.2, 2.8, 16, 8), { col: coat, pos: [x, 8, z], part, pivot: [x, 16, z], surf: SURF.plush });
  }
  const hp: V3 = [0, 24, 14];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    m.add(cone(4, 12, 6), { col: weather(PAL.rust, 0.3), pos: [Math.cos(a) * 9, 30 + Math.sin(a) * 9, 15], rot: [0, 0, a - Math.PI / 2], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  }
  m.add(sphere(8.6, 12, 10), { col: coat, pos: [0, 30, 18], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  m.add(ellipsoid(4.6, 3.6, 4, 8, 6), { col: weather(PAL.cream, 0.3), pos: [0, 27, 25], part: PART.HEAD, pivot: hp, surf: SURF.plush });
  eyes(m, { x: 3.6, y: 32, z: 25, r: 1.5, color: PAL.amber, glow: 0.9, pivot: hp });
  m.add(tube([[0, 22, -20], [0, 26, -30], [2, 30, -34]], 1.2, 5, 8), { col: coat, part: PART.SWAY, pivot: [0, 22, -20], surf: SURF.plush });
  m.add(torus(7, 1.4, 6, 14), { col: PAL.blood, pos: [0, 26, 12], rot: [0.4, 0, 0], surf: SURF.velvet });
  return m.build();
}

function elephant(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const hide = weather(0x6f6e6c, 0.3, 0.12);
  m.add(ellipsoid(16, 15, 22, 14, 10), { col: hide, pos: [0, 30, -2], surf: SURF.skin });
  for (const [x, z, part] of [[9, 10, PART.LEG_L], [-9, 10, PART.LEG_R], [9, -14, PART.LEG_R], [-9, -14, PART.LEG_L]] as [number, number, number][]) {
    m.add(cyl(5.6, 5.8, 22, 10), { col: hide, pos: [x, 11, z], part, pivot: [x, 22, z], surf: SURF.skin });
  }
  const hp: V3 = [0, 34, 16];
  m.add(sphere(12, 12, 10), { col: hide, pos: [0, 40, 20], part: PART.HEAD, pivot: hp, surf: SURF.skin });
  for (const s of [-1, 1]) m.add(ellipsoid(11, 13, 2, 10, 8), { col: weather(0x7a6a6a, 0.3), pos: [s * 13, 40, 14], rot: [0, s * 0.5, 0], part: PART.HEAD, pivot: hp, surf: SURF.skin });
  m.add(tube([[0, 36, 30], [0, 26, 36], [0, 14, 38], [0, 8, 34]], (t) => 4.4 - t * 2, 7, 12), { col: hide, part: PART.HEAD, pivot: hp, surf: SURF.skin });
  for (const s of [-1, 1]) m.add(cone(1.6, 11, 6), { col: PAL.bone, pos: [s * 5, 30, 32], rot: [1.3, 0, 0], part: PART.HEAD, pivot: hp, surf: SURF.bone });
  eyes(m, { x: 6, y: 44, z: 29, r: 1.5, color: PAL.ink, pivot: hp });
  // circus headdress and saddle blanket
  m.add(rbox(26, 3, 24, 1, 1), { col: weather(PAL.velvet, 0.35), pos: [0, 45, -4], surf: SURF.velvet });
  m.add(rbox(27, 1, 25, 0.4, 1), { col: PAL.gold, pos: [0, 43.8, -4], surf: SURF.gold });
  m.add(cone(3, 9, 8), { col: PAL.gold, pos: [0, 56, 18], surf: SURF.gold });
  return m.build();
}

function acrobat(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const suit = stripes(10, PAL.teal, PAL.cream, 0, 0.3);
  body(m, [[0, 22], [6, 23], [7, 30], [7.6, 40], [5, 44], [0, 45]], suit, { scale: [1, 1, 0.8] });
  for (const s of [-1, 1]) {
    limb(m, [s * 4, 23, 0], [s * 7, 4, 3], 2.2, suit, s > 0 ? PART.LEG_L : PART.LEG_R, [s * 4, 23, 0]);
    limb(m, [s * 7, 42, 0], [s * 14, 56, 0], 1.8, PAL.skinPale, s > 0 ? PART.ARM_L : PART.ARM_R, [s * 7, 42, 0], [0, 0, 0], SURF.skin);
  }
  m.add(sphere(5.6, 12, 10), { col: PAL.skinPale, pos: [0, 51, 0], part: PART.HEAD, pivot: [0, 46, 0], surf: SURF.skin });
  m.add(ellipsoid(5.8, 3, 5.8, 10, 6), { col: PAL.ink, pos: [0, 54, -0.6], part: PART.HEAD, pivot: [0, 46, 0], surf: SURF.cloth });
  eyes(m, { x: 2, y: 51.6, z: 5, r: 0.9, color: PAL.ink, pivot: [0, 46, 0] });
  return m.build();
}

/** A juggling pin bent out of true, its stripe glowing so it reads in a crowd. */
function bentPin(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(lathe([[0, 0], [2.2, 0.6], [4.2, 4], [3.6, 8], [1.4, 11], [1.6, 14], [0, 15]], 12), { col: PAL.bone, pos: [0, 0, -7], rot: [Math.PI / 2, 0, 0.25], surf: SURF.paint, emit: 0.35 });
  m.add(torus(1.9, 0.6, 5, 12), { col: 0xff3b2a, pos: [0, 0, 3.4], surf: SURF.paint, emit: 1.2 });
  return m.build({ ao: 0 });
}
/** A flat sliver of silvered glass. */
function mirrorShard(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cone(3.4, 13, 5), { col: 0xd8f4ff, rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.3], surf: SURF.glass, emit: 0.9 });
  m.add(cone(1.8, 7, 4), { col: 0xffffff, pos: [1.6, 0.4, -2], rot: [Math.PI / 2, 0, 0.5], scale: [1, 1, 0.3], surf: SURF.glass, emit: 1.2 });
  return m.build({ ao: 0 });
}

export const ITEM_MODELS: Record<string, ModelDef> = {
  // pickups
  ticket0: { build: () => ticket(0x1f8fff, 0.95), rim: NO_RIM, emitBoost: 2.6 },
  ticket1: { build: () => ticket(0x22e866, 1.08), rim: NO_RIM, emitBoost: 2.6 },
  ticket2: { build: () => ticket(0xff3ad2, 1.3), rim: NO_RIM, emitBoost: 3 },
  bank: { build: bank, rim: NO_RIM },
  food: { build: food, rim: NO_RIM, shadow: true },
  funnel: { build: funnel, rim: NO_RIM, shadow: true },
  golden: { build: golden, rim: NO_RIM },
  chest: { build: chest, rim: [0.9, 0.7, 0.3, 0.4], shadow: true },
  coffin: { build: coffin, rim: [0.7, 0.8, 1, 0.35], shadow: true },
  // player projectiles
  card: { build: () => card(PAL.cream, PAL.blood), rim: NO_RIM },
  gold_card: { build: () => card(0xfff0b0, PAL.gold, 1.2), rim: NO_RIM },
  tarot: { build: () => card(PAL.lilac, PAL.velvet, 1.1), rim: NO_RIM },
  death_card: { build: () => card(PAL.bone, PAL.ink, 1.5), rim: NO_RIM },
  dart: { build: dart, rim: NO_RIM },
  shrapnel: { build: shrapnel, rim: NO_RIM },
  ring: { build: ring, rim: NO_RIM },
  rocket: { build: rocket, rim: NO_RIM },
  shell: { build: rocket, rim: NO_RIM },
  kernel: { build: kernel, rim: NO_RIM },
  cannonball: { build: cannonball, rim: NO_RIM },
  derby_car: { build: ghostCar, rim: NO_RIM },
  bumper_ghost: { build: ghostCar, rim: NO_RIM },
  mirror_shot: { build: mirrorShot, rim: NO_RIM },
  note: { build: note, rim: NO_RIM },
  // enemy bullets
  b_pie: { build: pie, rim: NO_RIM },
  b_musket: { build: () => orb(0xffb070, 4.2, 0xfff0d0), rim: NO_RIM },
  b_ticket: { build: bulletTicket, rim: NO_RIM },
  b_popcorn: { build: popcorn, rim: NO_RIM },
  b_spiral: { build: () => orb(0xff6a8a, 6), rim: NO_RIM },
  b_spark: { build: () => orb(0x9ec8ff, 4.6), rim: NO_RIM },
  b_bolt: { build: bolt, rim: NO_RIM },
  b_ring: { build: () => orb(0xffd060, 5.4), rim: NO_RIM },
  b_hellfire: { build: hellfire, rim: NO_RIM },
  b_star: { build: () => starBullet(0xffe070), rim: NO_RIM },
  b_crown: { build: crown, rim: NO_RIM },
  b_spoke: { build: spoke, rim: NO_RIM },
  b_gondola: { build: gondola, rim: NO_RIM },
  b_kernel_big: { build: () => orb(0xfff0c0, 8, 0xffffff), rim: NO_RIM },
  b_note: { build: () => orb(0x7dffb0, 5.6, 0xe0fff0), rim: NO_RIM },
  // the Fun House (D-63): a Crooked Clown's bent juggling pin, a shard of mirror
  b_pin: { build: bentPin, rim: NO_RIM, emitBoost: 1.8 },
  b_shard: { build: mirrorShard, rim: NO_RIM, emitBoost: 2.2 },
  // summons
  s_plush: { build: plush, anim: { a: [2.4, 0.06, 0.6, 0.6], b: [0.15, 0, 0.2, 0.8] }, rim: [0.9, 0.75, 0.55, 0.5], shadow: true },
  s_rabbit: { build: rabbit, anim: { a: [5, 0.12, 0.8, 0], b: [0.2, 0, 0, 0] }, rim: [0.9, 0.85, 0.75, 0.5], shadow: true },
  s_dove: { build: dove, anim: { a: [1.5, 0, 0, 1.1], b: [0.1, 0, 0, 0] }, rim: [0.9, 0.9, 0.9, 0.5], hover: 46 },
  s_lion: { build: lion, anim: { a: [2.4, 0.03, 0.6, 0], b: [0.12, 0, 0.2, 0] }, rim: [0.95, 0.7, 0.35, 0.5], shadow: true },
  s_elephant: { build: elephant, anim: { a: [2, 0.02, 0.4, 0], b: [0.1, 0, 0.15, 0] }, rim: [0.8, 0.75, 0.7, 0.5], shadow: true },
  s_acrobat: { build: acrobat, anim: { a: [3, 0.05, 0.9, 0.6], b: [0.1, 0, 0, 0] }, rim: [0.6, 0.9, 0.85, 0.5], hover: 16, shadow: true },
  s_derby_ghost: { build: ghostCar, anim: { a: [0.8, 0.03, 0, 0], b: [0, 0, 0, 0] }, rim: [0.5, 1, 0.75, 0.7] },
};

export const _unused = { C, glove, limb, ruff, shoe, bulb, tube };
