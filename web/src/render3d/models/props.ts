// The midway's attractions and street furniture as procedural 3D models (D-38): weathered stalls
// with scalloped awnings, a decaying carousel, the funhouse's gaping clown mouth, a collapsed coaster,
// gas lamps, iron fences, caravans — plus the Last Song's quest props (soul lamps, Zoltana, the High
// Striker). Footprints match the collision data in data/map.ts. Models face +Z (south).

import * as THREE from 'three';
import { C, box, cone, cyl, ellipsoid, extrude, lathe, rbox, smoothShape, sphere, starShape, torus, tube, vnoise, weather, stripes, bands, sagPoints, type ColorFn, type V3 } from '../core/geo';
import { ModelBuilder, PAL, PART, SURF, body, bulb, coneHat, eyes, ruff, stitches } from './kit';
import { bunting, canvasRoof, diamonds, headerBoard, pagodaRoof, patch, stripedCanopy, turnedPost, valance } from './arch';

type M = ModelBuilder;

// ---------------------------------------------------------------- shared pieces
function plankWall(m: M, w: number, h: number, pos: V3, rotY: number, col: number, wear = 0.5): void {
  const n = Math.max(2, Math.round(w / 14));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    const hh = h * (0.97 + vnoise(i * 3.1, pos[0] * 0.01, pos[2] * 0.01) * 0.06);
    const c = Math.cos(rotY), s = Math.sin(rotY);
    m.add(box(w / n - 0.8, hh, 3), { col: weather(col, wear, 0.05 + i * 0.001, PAL.woodPale), pos: [pos[0] + x * c, pos[1] + hh / 2, pos[2] - x * s], rot: [0, rotY, 0], surf: SURF.wood });
  }
}

/** Scalloped, striped awning sloping toward +Z. */
function awning(m: M, w: number, depth: number, y: number, z: number, a: number, b: number, scallops = 0): void {
  const n = Math.max(4, Math.round(w / 18));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    m.add(box(w / n + 0.2, 1.4, depth), { col: weather(i % 2 ? a : b, 0.45, 0.07), pos: [x, y, z], rot: [0.35, 0, 0], surf: SURF.canvas });
  }
  const sc = scallops || n * 2;
  for (let i = 0; i < sc; i++) {
    const x = -w / 2 + (i + 0.5) * (w / sc);
    m.add(cyl(w / sc / 2, w / sc / 2, 1.2, 10, false), { col: weather(Math.floor(i / 2) % 2 ? a : b, 0.45), pos: [x, y - Math.sin(0.35) * depth / 2 - 3, z + Math.cos(0.35) * depth / 2], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 1], surf: SURF.canvas });
  }
}

function bulbRow(m: M, x0: number, x1: number, y: number, z: number, n: number, cols: number[] = [PAL.amber, PAL.hotRed]): void {
  for (let i = 0; i < n; i++) bulb(m, [x0 + (x1 - x0) * (i / Math.max(1, n - 1)), y, z], 1.6, cols[i % cols.length], PART.BODY, undefined, 1);
}

/** Booth header geometry shared with the sign placement in world/props.ts. */
export const BOOTH = { eaveY: 128, ridgeY: 172, headerY: 132, headerH: 40, headerZ: 10 };

/**
 * A midway game booth (D-47): a raised plank deck, turned corner posts, canvas side walls, a
 * painted counter with a diamond-patterned skirt, a peaked striped canvas roof sagging between its
 * rafters, a scalloped valance with tassels, an arched header board ringed with marquee bulbs, and
 * two lanterns hung under the eave — the booth's own warm light. Returns the counter-top height.
 */
function stall(m: M, hw: number, hh: number, wall: number, a: number, b: number): number {
  const w = hw * 2, d = hh * 2;
  const front = hh - 6, back = -hh + 4;
  for (let i = 0; i < 7; i++) m.add(box(w + 6, 5, d / 7 - 0.8), { col: weather(PAL.woodDark, 0.5, 0.08, PAL.woodPale), pos: [0, 2.5, -hh + (i + 0.5) * (d / 7)], surf: SURF.wood });
  plankWall(m, w - 6, 118, [0, 5, back], 0, wall);
  // canvas side walls, vertical stripes, bellied slightly by the wind
  for (const sx of [-1, 1]) {
    const x = sx * (hw - 3);
    for (let k = 0; k < 4; k++) {
      const z0 = back + ((front - back) * k) / 4, z1 = back + ((front - back) * (k + 1)) / 4;
      m.add(patch((u, v) => [x - sx * 1.6 * Math.sin(Math.PI * v) * Math.sin(Math.PI * (k + u) / 4), 6 + 116 * v, sx > 0 ? z0 + (z1 - z0) * u : z1 - (z1 - z0) * u], 3, 4, true), { col: weather(k % 2 ? a : b, 0.5, 0.06), surf: SURF.canvas });
    }
  }
  // counter: skirt with a painted diamond motif, worn wooden top
  m.add(rbox(w - 8, 40, 10, 1.2, 1), { col: weather(b, 0.5, 0.06, PAL.woodPale), pos: [0, 25, front], surf: SURF.paint });
  diamonds(m, -hw + 10, hw - 10, 25, front + 5.3, 9, a);
  m.add(rbox(w - 2, 3.4, 18, 1, 1), { col: weather(PAL.woodDark, 0.4, 0.1, PAL.woodPale), pos: [0, 46.5, front + 1], surf: SURF.wood });
  // turned corner posts and a front beam
  for (const sx of [-1, 1]) {
    turnedPost(m, sx * (hw - 4), front + 7, BOOTH.eaveY, 2.6, weather(PAL.cream, 0.5, 0.06, PAL.woodPale));
    turnedPost(m, sx * (hw - 4), back, BOOTH.eaveY, 2.4, weather(PAL.cream, 0.5, 0.06, PAL.woodPale));
  }
  m.add(rbox(w + 4, 6, 5, 1, 1), { col: weather(PAL.woodDark, 0.4), pos: [0, BOOTH.eaveY - 3, front + 7], surf: SURF.wood });
  // the roof, its valance, the header board
  canvasRoof(m, { w: w + 14, front: hh + 14, back: hh + 6, eaveY: BOOTH.eaveY, ridgeY: BOOTH.ridgeY, stripes: Math.round(w / 24), a, b });
  valance(m, -(w + 14) / 2, (w + 14) / 2, BOOTH.eaveY, hh + 14.5, 11, Math.round(w / 19), a, b);
  headerBoard(m, w * 0.62, BOOTH.headerH, BOOTH.headerY, hh + BOOTH.headerZ, PAL.ink, wall);
  // lanterns under the eave
  for (const sx of [-1, 1]) {
    const x = sx * w * 0.27;
    m.add(cyl(0.5, 0.5, 12, 4), { col: PAL.iron, pos: [x, BOOTH.eaveY - 10, front + 6], surf: SURF.iron });
    m.add(cyl(4.6, 5.6, 3, 8), { col: PAL.brass, pos: [x, BOOTH.eaveY - 17, front + 6], surf: SURF.brass });
    m.add(sphere(5.2, 10, 8), { col: PAL.amber, pos: [x, BOOTH.eaveY - 23, front + 6], emit: 1, surf: SURF.bulb });
  }
  return 48;
}

// ---------------------------------------------------------------- landmarks
export function carouselBase(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  // round stage with steps, brass trim
  m.add(cyl(188, 192, 10, 40), { col: weather(PAL.woodDark, 0.4), pos: [0, 5, 0], surf: SURF.wood });
  m.add(cyl(180, 182, 8, 40), { col: weather(PAL.red, 0.5, 0.03, PAL.woodPale), pos: [0, 14, 0], surf: SURF.paint });
  m.add(torus(181, 1.6, 6, 48), { col: PAL.brass, pos: [0, 18, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  return m.build({ ao: 0.2 });
}

/** The rotating part: deck, centre column, poles, canopy (the plaques are separate, quest-driven). */
export function carouselTop(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(176, 176, 4, 40), { col: weather(PAL.woodPale, 0.45, 0.02), pos: [0, 20, 0], surf: SURF.wood });
  // mirrored centre column
  m.add(cyl(34, 38, 150, 12), { col: weather(PAL.velvet, 0.35, 0.05), pos: [0, 95, 0], surf: SURF.paint, flat: true });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    m.add(box(10, 60, 1), { col: 0x9aa0a8, pos: [Math.cos(a) * 35.6, 96, Math.sin(a) * 35.6], rot: [0, -a + Math.PI / 2, 0], surf: SURF.glass });
  }
  // brass poles (the horses are separate instances)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    m.add(cyl(1.8, 1.8, 150, 8), { col: stripes(8, PAL.brass, 0x6a5428, 0, 0.1), pos: [Math.cos(a) * 128, 95, Math.sin(a) * 128], surf: SURF.brass });
  }
  // canopy: striped cone roof with a valance ring
  stripedCanopy(m, { prof: [[200, 171], [120, 210], [30, 236], [0, 240]], n: 24, a: PAL.red, b: PAL.cream, sag: 4.5 });
  m.add(cyl(198, 198, 26, 24, true), { col: weather(PAL.mustard, 0.5, 0.04), pos: [0, 157, 0], surf: SURF.paint });
  m.add(lathe([[198, 0], [201, 0], [201, 2], [198, 2]], 24), { col: PAL.brass, pos: [0, 143, 0], surf: SURF.brass });
  // scalloped valance fringe
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    m.add(sphere(6.8, 6, 4), { col: weather(i % 2 ? PAL.red : PAL.cream, 0.4), pos: [Math.cos(a) * 199, 142, Math.sin(a) * 199], scale: [1, 1.2, 0.4], rot: [0, -a + Math.PI / 2, 0], surf: SURF.canvas });
  }
  // rim bulbs
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    m.add(sphere(2.2, 6, 4), { col: i % 3 ? PAL.amber : PAL.hotRed, pos: [Math.cos(a) * 201, 166, Math.sin(a) * 201], emit: 1, surf: SURF.bulb });
  }
  // finial: a tarnished brass pennant
  m.add(cyl(1.6, 2, 40, 6), { col: PAL.brass, pos: [0, 258, 0], surf: SURF.brass });
  m.add(sphere(5, 10, 8), { col: PAL.gold, pos: [0, 278, 0], surf: SURF.gold });
  m.add(extrude([[0, 0], [24, -5], [0, -11]], 0.8, 0, 1), { col: weather(PAL.redDeep, 0.4), pos: [1, 274, 0], part: PART.SWAY, pivot: [0, 274, 0], surf: SURF.canvas });
  return m.build({ ao: 0.25 });
}

/** A carousel canopy plaque: brass disc with an emblem. kind: 0 skull, 1 moon, 2 key, 3 eye, 4 crown, 5 star. */
export function plaque(kind: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(11, 11, 2, 20), { col: PAL.brass, rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  m.add(torus(11, 1.4, 6, 20), { col: PAL.gold, surf: SURF.gold });
  const ink = kind === 0 ? PAL.bone : PAL.ghost;
  const em = kind === 5 ? 0.3 : 0.9;
  const z = 1.4;
  switch (kind) {
    case 0: // brass skull
      m.add(ellipsoid(6, 6.4, 2, 12, 8), { col: ink, pos: [0, 1.5, z], surf: SURF.bone, emit: 0.35 });
      m.add(rbox(6, 3.6, 2, 0.6, 1), { col: ink, pos: [0, -4, z], surf: SURF.bone, emit: 0.35 });
      for (const s of [-1, 1]) m.add(sphere(1.7, 6, 4), { col: PAL.ink, pos: [s * 2.4, 1.6, z + 1.6], surf: SURF.porcelain });
      break;
    case 1: { // crescent moon
      const s = new THREE.Shape();
      s.absarc(0, 0, 7, 0.6, Math.PI * 2 - 0.6, false);
      s.absarc(3.4, 0, 5.4, Math.PI * 2 - 0.9, 0.9, true);
      m.add(extrude(s, 1.6, 0, 16), { col: ink, pos: [0, 0, z], emit: em, surf: SURF.glass });
      break;
    }
    case 2: // key
      m.add(torus(3, 1.1, 6, 12), { col: ink, pos: [0, 4, z], emit: em, surf: SURF.glass });
      m.add(rbox(1.8, 9, 1.6, 0.4, 1), { col: ink, pos: [0, -2.4, z], emit: em, surf: SURF.glass });
      m.add(rbox(3.4, 1.6, 1.6, 0.4, 1), { col: ink, pos: [1.6, -6, z], emit: em, surf: SURF.glass });
      break;
    case 3: // eye
      m.add(ellipsoid(8, 4.4, 1, 14, 8), { col: ink, pos: [0, 0, z], emit: em, surf: SURF.glass });
      m.add(sphere(2.6, 8, 6), { col: PAL.ink, pos: [0, 0, z + 0.8], surf: SURF.glass });
      break;
    case 4: { // crown
      m.add(extrude([[-7, -4], [7, -4], [7, 3], [3.5, -0.5], [0, 5], [-3.5, -0.5], [-7, 3]], 1.6, 0, 1), { col: ink, pos: [0, 0, z], emit: em, surf: SURF.glass });
      break;
    }
    default:
      m.add(extrude(starShape(5, 6, 2.6), 1.4, 0, 1), { col: PAL.mustard, pos: [0, 0, z], emit: em, surf: SURF.paint });
  }
  return m.build({ ao: 0 });
}

export function ticketBooth(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const wood = PAL.red;
  plankWall(m, 190, 150, [0, 0, -76], 0, wood);
  plankWall(m, 150, 150, [-94, 0, 0], Math.PI / 2, wood);
  plankWall(m, 150, 150, [94, 0, 0], Math.PI / 2, wood);
  plankWall(m, 70, 150, [-60, 0, 76], 0, wood);
  plankWall(m, 70, 150, [60, 0, 76], 0, wood);
  // window with iron bars and a dusty counter
  m.add(rbox(52, 30, 8, 2, 1), { col: weather(PAL.woodDark, 0.4), pos: [0, 30, 78], surf: SURF.wood });
  m.add(box(50, 60, 1), { col: 0xe0a050, pos: [0, 82, 74], surf: SURF.glass, emit: 0.8 });
  for (let i = 0; i < 6; i++) m.add(cyl(0.9, 0.9, 60, 5), { col: PAL.iron, pos: [-21 + i * 8.4, 82, 77], surf: SURF.iron });
  m.add(torus(26, 2.4, 6, 16, Math.PI), { col: weather(PAL.woodDark, 0.4), pos: [0, 112, 77], surf: SURF.wood });
  // shingled pagoda roof with upturned corners and gilded hip caps
  pagodaRoof(m, { hw: 118, dz: 0.82, y: 150, h: 66, courses: 8, col: 0x5b6b66, trim: PAL.mustard, lift: 12 });
  // marquee board
  m.add(rbox(150, 30, 4, 2, 1), { col: weather(PAL.ink, 0.3), pos: [0, 190, 66], rot: [-0.2, 0, 0], surf: SURF.wood });
  bulbRow(m, -70, 70, 207, 63, 13);
  bulbRow(m, -70, 70, 173, 70, 13);
  // turnstile
  m.add(cyl(4, 5, 30, 8), { col: PAL.iron, pos: [70, 15, 96], surf: SURF.iron });
  for (let i = 0; i < 3; i++) m.add(cyl(1.2, 1.2, 26, 5), { col: PAL.brass, pos: [70 + Math.cos(i * 2.1) * 10, 28, 96 + Math.sin(i * 2.1) * 10], rot: [0, -i * 2.1, Math.PI / 2], surf: SURF.brass });
  return m.build({ ao: 0.4 });
}

export function prizeStand(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  stall(m, 125, 70, PAL.teal, PAL.mustard, PAL.redDeep);
  // shelves of slumped plush prizes
  for (let row = 0; row < 3; row++) {
    m.add(box(220, 3, 18), { col: weather(PAL.woodPale, 0.4), pos: [0, 50 + row * 22, -58], surf: SURF.wood });
    for (let i = 0; i < 9; i++) {
      const x = -100 + i * 25;
      const c = [PAL.pinkDusty, PAL.woodPale, PAL.lilac, PAL.cream, PAL.teal][(i + row) % 5];
      m.add(sphere(7, 8, 6), { col: weather(c, 0.4, 0.3), pos: [x, 59 + row * 22, -58], surf: SURF.plush });
      m.add(sphere(5, 8, 6), { col: weather(c, 0.4, 0.3), pos: [x, 69 + row * 22, -56], surf: SURF.plush });
      m.add(sphere(1.2, 4, 3), { col: PAL.ink, pos: [x - 1.8, 70 + row * 22, -51.4], surf: SURF.porcelain });
    }
  }
  // a giant hanging teddy, one arm torn
  m.add(ellipsoid(16, 20, 13, 12, 10), { col: weather(PAL.woodPale, 0.45, 0.2), pos: [86, 92, -40], surf: SURF.plush });
  m.add(sphere(13, 12, 10), { col: weather(PAL.woodPale, 0.45, 0.2), pos: [86, 120, -40], surf: SURF.plush });
  m.add(cyl(0.4, 0.4, 30, 4), { col: PAL.bone, pos: [86, 145, -40], surf: SURF.cloth });
  return m.build({ ao: 0.4 });
}

export function stallKind(kind: string, variant = 0): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const palettes: Record<string, [number, number, number]> = {
    stall_ringtoss: variant ? [PAL.navy, PAL.cream, PAL.blood] : [PAL.moss, PAL.cream, PAL.red],
    stall_bottles: [PAL.plum, PAL.mustard, PAL.navy],
    stall_darts: [PAL.redDeep, PAL.cream, PAL.teal],
    stall_shooting: [PAL.slate, PAL.mustard, PAL.redDeep],
  };
  const [wall, a, b] = palettes[kind] ?? palettes.stall_darts;
  const hw = kind === 'stall_shooting' ? 110 : 95, hh = kind === 'stall_shooting' ? 65 : 60;
  const top = stall(m, hw, hh, wall, a, b);
  if (kind === 'stall_ringtoss') {
    for (let i = 0; i < 12; i++) {
      const x = -60 + (i % 6) * 24, z = -30 + Math.floor(i / 6) * 22;
      m.add(cyl(3, 3.4, 16, 8), { col: weather(PAL.sick, 0.5), pos: [x, top + 8 - 30, z], surf: SURF.glass });
      m.add(cyl(1.4, 1.6, 6, 6), { col: weather(PAL.sick, 0.5), pos: [x, top + 19 - 30, z], surf: SURF.glass });
    }
    m.add(rbox(150, 12, 60, 2, 1), { col: weather(PAL.woodDark, 0.4), pos: [0, 8, -20], surf: SURF.wood });
    for (let i = 0; i < 5; i++) m.add(torus(6, 1.2, 5, 14), { col: i % 2 ? PAL.red : PAL.cream, pos: [-40 + i * 18, top + 2, 50], rot: [Math.PI / 2, 0, 0], surf: SURF.paint });
  } else if (kind === 'stall_bottles') {
    m.add(rbox(60, 50, 30, 2, 1), { col: weather(PAL.woodDark, 0.4), pos: [0, 25, -30], surf: SURF.wood });
    let k = 0;
    for (let row = 0; row < 4; row++) for (let i = 0; i <= 3 - row; i++) {
      m.add(lathe([[0, 0], [5, 0], [5.4, 10], [2.2, 15], [2, 20], [0, 20]], 10), { col: weather(k++ % 2 ? PAL.bone : PAL.dirty, 0.3), pos: [(i - (3 - row) / 2) * 12, 50 + row * 20, -30], surf: SURF.porcelain });
    }
    for (let i = 0; i < 3; i++) m.add(sphere(4, 8, 6), { col: weather(PAL.bone, 0.3), pos: [-30 + i * 10, top + 4, 50], surf: SURF.cloth });
  } else if (kind === 'stall_darts') {
    m.add(rbox(160, 80, 4, 2, 1), { col: weather(PAL.canvasDark, 0.5), pos: [0, 80, -52], surf: SURF.wood });
    for (let i = 0; i < 18; i++) {
      const x = -66 + (i % 6) * 26, y = 54 + Math.floor(i / 6) * 26;
      const popped = vnoise(i, 2, 3) > 0.6;
      if (popped) m.add(sphere(3, 6, 4), { col: PAL.ink, pos: [x, y, -49], scale: [1, 1, 0.3], surf: SURF.latex });
      else m.add(sphere(8, 10, 8), { col: [PAL.red, PAL.mustard, PAL.teal, PAL.plum][i % 4], pos: [x, y, -46], surf: SURF.latex });
    }
  } else {
    // shooting gallery: a row of tin ducks on a rail, swinging targets, chained rifles on the counter
    m.add(rbox(200, 8, 10, 1, 1), { col: PAL.iron, pos: [0, 70, -40], surf: SURF.iron });
    for (let i = 0; i < 8; i++) {
      m.add(ellipsoid(7, 6, 4, 10, 8), { col: weather(PAL.mustard, 0.5, 0.15, PAL.iron), pos: [-84 + i * 24, 82, -40], surf: SURF.iron });
      m.add(sphere(4.4, 8, 6), { col: weather(PAL.mustard, 0.5, 0.15, PAL.iron), pos: [-79 + i * 24, 90, -40], surf: SURF.iron });
      m.add(cone(1.6, 5, 5), { col: PAL.ember, pos: [-74 + i * 24, 89, -40], rot: [0, 0, -Math.PI / 2], surf: SURF.paint });
    }
    for (let i = 0; i < 5; i++) {
      m.add(cyl(18, 18, 2, 18), { col: bands([[-99, PAL.cream], [-0.0001, PAL.cream]], 0.4), pos: [-80 + i * 40, 106, -58], rot: [Math.PI / 2, 0, 0], surf: SURF.paint });
      m.add(torus(11, 2.4, 6, 16), { col: PAL.red, pos: [-80 + i * 40, 106, -56.6], surf: SURF.paint });
      m.add(cyl(4, 4, 3, 10), { col: PAL.red, pos: [-80 + i * 40, 106, -56.6], rot: [Math.PI / 2, 0, 0], surf: SURF.paint });
    }
    for (const x of [-50, 50]) m.add(cyl(1.6, 2.4, 40, 6), { col: PAL.woodDark, pos: [x, top + 2, 54], rot: [Math.PI / 2 - 0.15, 0.2, 0], surf: SURF.wood });
  }
  return m.build({ ao: 0.4 });
}

export function popcornCart(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(rbox(70, 46, 46, 3, 2), { col: weather(PAL.red, 0.5, 0.06, PAL.woodPale), pos: [0, 40, 0], surf: SURF.paint });
  m.add(box(60, 40, 38), { col: 0x262a2c, pos: [0, 84, 0], surf: SURF.glass, emit: 0.05 });
  for (let i = 0; i < 40; i++) m.add(sphere(4, 5, 4), { col: weather(PAL.cream, 0.4), pos: [-24 + (i % 8) * 7, 66 + Math.floor(i / 8) * 3.6, -14 + ((i * 7) % 5) * 7], emit: 0.15, surf: SURF.cloth });
  for (const [x, z] of [[-30, -19], [30, -19], [-30, 19], [30, 19]]) m.add(cyl(1.4, 1.4, 42, 5), { col: PAL.brass, pos: [x, 84, z], surf: SURF.brass });
  m.add(lathe([[0, 22], [10, 20], [44, 2], [46, 0], [0, 0]], 4), { col: stripes(4, PAL.red, PAL.cream, 0.125, 0.5), pos: [0, 104, 0], rot: [0, Math.PI / 4, 0], surf: SURF.canvas });
  for (const s of [-1, 1]) {
    m.add(torus(14, 2.4, 6, 18), { col: PAL.woodDark, pos: [s * 37, 16, 0], rot: [0, Math.PI / 2, 0], surf: SURF.wood });
    for (let k = 0; k < 6; k++) m.add(cyl(0.9, 0.9, 26, 4), { col: PAL.woodPale, pos: [s * 37, 16, 0], rot: [(k * Math.PI) / 6, 0, 0], surf: SURF.wood });
  }
  bulb(m, [0, 128, 0], 3, PAL.amber);
  return m.build({ ao: 0.4 });
}

export function cottonStand(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  plankWall(m, 160, 100, [0, 0, -52], 0, PAL.pinkDusty);
  plankWall(m, 104, 100, [-78, 0, 0], Math.PI / 2, PAL.pinkDusty);
  plankWall(m, 104, 100, [78, 0, 0], Math.PI / 2, PAL.pinkDusty);
  m.add(rbox(150, 40, 14, 1.5, 1), { col: weather(PAL.cream, 0.5), pos: [0, 20, 46], surf: SURF.paint });
  m.add(lathe([[0, 0], [22, 0], [26, 14], [24, 16], [0, 16]], 18), { col: PAL.iron, pos: [-30, 42, 20], surf: SURF.iron });
  for (let i = 0; i < 4; i++) {
    m.add(cone(3, 18, 8), { col: PAL.cream, pos: [20 + i * 12, 50, 44], rot: [Math.PI, 0, 0], surf: SURF.canvas });
    m.add(sphere(9, 10, 8), { col: weather(0xc08aa0, 0.3, 0.2), pos: [20 + i * 12, 64, 44], surf: SURF.plush });
  }
  awning(m, 170, 30, 104, 58, PAL.pinkDusty, PAL.cream);
  m.add(sphere(22, 14, 10), { col: weather(0xb5788f, 0.35, 0.2), pos: [0, 140, -40], surf: SURF.plush });
  m.add(cone(8, 40, 10), { col: PAL.cream, pos: [0, 112, -40], rot: [Math.PI, 0, 0], surf: SURF.canvas });
  return m.build({ ao: 0.4 });
}

export function hotdogStand(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(rbox(170, 60, 100, 4, 2), { col: weather(PAL.mustard, 0.5, 0.05, PAL.iron), pos: [0, 40, 0], surf: SURF.paint });
  m.add(rbox(160, 4, 90, 1, 1), { col: PAL.iron, pos: [0, 72, 0], surf: SURF.iron });
  for (const [x, z] of [[-80, -45], [80, -45], [-80, 45], [80, 45]]) m.add(cyl(2, 2, 60, 6), { col: PAL.iron, pos: [x, 100, z], surf: SURF.iron });
  m.add(rbox(180, 6, 110, 2, 1), { col: stripes(10, PAL.red, PAL.cream, 0, 0.4), pos: [0, 132, 0], surf: SURF.canvas });
  // the giant hot dog on the roof
  m.add(ellipsoid(60, 13, 16, 16, 10), { col: weather(PAL.ochre, 0.4), pos: [0, 152, 0], surf: SURF.cloth });
  m.add(ellipsoid(70, 8, 8, 16, 8), { col: weather(PAL.rust, 0.4), pos: [0, 160, 0], surf: SURF.skin });
  m.add(tube([[-50, 168, 0], [-25, 172, 0], [0, 167, 0], [25, 172, 0], [50, 168, 0]], 1.6, 5, 20), { col: PAL.mustard, surf: SURF.paint });
  for (let i = 0; i < 5; i++) m.add(cyl(5, 5, 6, 10), { col: weather(PAL.rust, 0.3), pos: [-50 + i * 25, 76, 20], rot: [0, 0, Math.PI / 2], surf: SURF.skin });
  for (const s of [-1, 1]) m.add(torus(20, 3, 6, 18), { col: PAL.ink, pos: [s * 60, 20, 52], rot: [0, 0, 0], surf: SURF.rubber });
  return m.build({ ao: 0.4 });
}

export function fenceSection(len: number): THREE.BufferGeometry {
  // wrought iron: spear-tipped bars between square posts
  const m = new ModelBuilder();
  const n = Math.max(2, Math.round(len / 14));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * (len / n);
    const h = 70 + (vnoise(i * 0.7, 3, 1) - 0.5) * 6;
    m.add(cyl(1.1, 1.1, h, 5), { col: PAL.iron, pos: [x, h / 2, 0], rot: [0, 0, (vnoise(i, 1, 1) - 0.5) * 0.05], surf: SURF.iron });
    m.add(cone(2.2, 7, 4), { col: PAL.iron, pos: [x, h + 3, 0], surf: SURF.iron });
  }
  for (const y of [12, 60]) m.add(box(len, 3, 2.4), { col: PAL.iron, pos: [0, y, 0], surf: SURF.iron });
  for (const s of [-1, 1]) {
    m.add(box(8, 86, 8), { col: weather(PAL.slate, 0.4), pos: [s * len / 2, 43, 0], surf: SURF.iron });
    m.add(sphere(5, 8, 6), { col: PAL.iron, pos: [s * len / 2, 91, 0], surf: SURF.iron });
  }
  return m.build({ ao: 0.3 });
}

export function railSection(len: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const n = Math.max(2, Math.round(len / 60));
  for (let i = 0; i <= n; i++) m.add(cyl(3, 3.4, 44, 6), { col: weather(PAL.woodDark, 0.5), pos: [-len / 2 + (i * len) / n, 22, 0], surf: SURF.wood });
  m.add(box(len, 5, 5), { col: weather(PAL.woodDark, 0.5), pos: [0, 44, 0], surf: SURF.wood });
  m.add(box(len, 4, 4), { col: weather(PAL.woodDark, 0.5), pos: [0, 22, 0], surf: SURF.wood });
  return m.build({ ao: 0.3 });
}

export function gateArch(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  for (const s of [-1, 1]) {
    m.add(rbox(30, 210, 30, 3, 2), { col: weather(PAL.red, 0.55, 0.04, PAL.woodPale), pos: [s * 125, 105, 0], surf: SURF.paint });
    m.add(cone(22, 40, 4), { col: weather(PAL.mustard, 0.5), pos: [s * 125, 230, 0], rot: [0, Math.PI / 4, 0], surf: SURF.paint });
    m.add(sphere(6, 8, 6), { col: PAL.gold, pos: [s * 125, 254, 0], surf: SURF.gold });
    for (let k = 0; k < 7; k++) bulb(m, [s * 125, 30 + k * 26, 16.5], 2, k % 2 ? PAL.amber : PAL.hotRed);
  }
  // arched sign band (the lettering is a separate sign mesh)
  const arch = new THREE.Shape();
  arch.moveTo(-140, 0);
  arch.quadraticCurveTo(0, 70, 140, 0);
  arch.lineTo(140, 34);
  arch.quadraticCurveTo(0, 104, -140, 34);
  arch.lineTo(-140, 0);
  m.add(extrude(arch, 8, 1, 16), { col: weather(PAL.ink, 0.3), pos: [0, 184, 0], surf: SURF.wood });
  for (let i = 0; i < 17; i++) {
    const t = i / 16;
    const x = -136 + t * 272;
    const y = 184 + 34 + 2 * (1 - t) * t * 70 + 4;
    bulb(m, [x, y + 6, 5], 2, i % 2 ? PAL.amber : PAL.cream);
  }
  return m.build({ ao: 0.3 });
}

export function ferrisDeck(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(rbox(300, 18, 92, 3, 2), { col: weather(PAL.woodDark, 0.45, 0.03), pos: [0, 9, 0], surf: SURF.wood });
  for (let i = 0; i < 4; i++) m.add(box(70, 6, 30), { col: weather(PAL.woodPale, 0.4), pos: [-105 + i * 70, 3, 55], surf: SURF.wood });
  for (let i = 0; i <= 10; i++) m.add(cyl(1.6, 1.6, 34, 5), { col: PAL.iron, pos: [-150 + i * 30, 34, -44], surf: SURF.iron });
  m.add(box(300, 3, 3), { col: PAL.iron, pos: [0, 50, -44], surf: SURF.iron });
  m.add(rbox(26, 50, 20, 2, 1), { col: weather(PAL.red, 0.5), pos: [120, 43, 30], surf: SURF.paint });
  return m.build({ ao: 0.3 });
}

export function funhouse(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const wall = weather(PAL.plum, 0.55, 0.03, PAL.woodPale);
  // crooked facade and towers
  m.add(rbox(460, 200, 200, 4, 2), { col: wall, pos: [0, 100, -10], rot: [0, 0, 0.02], surf: SURF.paint });
  for (const [x, h, tilt] of [[-200, 300, -0.06], [200, 270, 0.05], [-90, 240, 0.03]] as [number, number, number][]) {
    m.add(rbox(70, h, 70, 3, 2), { col: weather(PAL.teal, 0.55, 0.03, PAL.woodPale), pos: [x, h / 2, -40], rot: [0, 0.2, tilt], surf: SURF.paint });
    m.add(cone(56, 80, 4), { col: weather(PAL.redDeep, 0.5), pos: [x + Math.sin(tilt) * -h, h + 38, -40], rot: [0, Math.PI / 4 + 0.2, tilt * 1.5], surf: SURF.paint });
  }
  // a steep, sagging slate roof over the crooked block (the towers punch up through it)
  pagodaRoof(m, { hw: 240, dz: 0.46, y: 198, h: 96, courses: 8, col: 0x3c4a52, trim: PAL.mustard, lift: 16 });
  // the giant clown face entrance: you walk in through its mouth
  m.add(ellipsoid(110, 100, 30, 20, 16), { col: weather(PAL.clown, 0.5, 0.05, PAL.dirty), pos: [0, 140, 96], surf: SURF.paint });
  m.add(ellipsoid(72, 52, 10, 18, 12), { col: PAL.ink, pos: [0, 92, 118], surf: SURF.paint });
  for (let i = 0; i < 9; i++) m.add(cone(7, 22, 4), { col: PAL.bone, pos: [-56 + i * 14, 138, 120], rot: [Math.PI, 0, 0], surf: SURF.bone });
  m.add(tube([[-90, 120, 116], [-50, 70, 124], [0, 52, 126], [50, 70, 124], [90, 120, 116]], 8, 8, 24), { col: PAL.blood, surf: SURF.latex });
  for (const s of [-1, 1]) {
    m.add(ellipsoid(24, 30, 8, 14, 10), { col: PAL.ink, pos: [s * 46, 190, 118], surf: SURF.paint });
    m.add(sphere(10, 10, 8), { col: PAL.sickYellow, pos: [s * 46, 186, 124], emit: 1, surf: SURF.glass });
  }
  m.add(sphere(22, 14, 10), { col: PAL.blood, pos: [0, 152, 126], surf: SURF.latex });
  // stairs up to the mouth, warped boards
  for (let i = 0; i < 5; i++) m.add(box(130, 8, 18), { col: weather(PAL.woodDark, 0.4), pos: [0, 4 + i * 8, 170 - i * 14], rot: [0, (vnoise(i, 1, 1) - 0.5) * 0.08, 0], surf: SURF.wood });
  bulbRow(m, -200, 200, 212, 92, 21, [PAL.amber, PAL.sickYellow]);
  return m.build({ ao: 0.4 });
}

export function coasterRuin(len: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const n = Math.round(len / 60);
  const trackY = (x: number) => 150 + Math.sin(x * 0.007) * 50 + Math.sin(x * 0.019) * 18;
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i * len) / n;
    const broken = x > 120 && x < 260;
    const y = broken ? 60 + vnoise(i, 2, 2) * 40 : trackY(x);
    // trestle legs + cross bracing
    for (const z of [-26, 26]) m.add(box(6, y, 6), { col: weather(PAL.woodPale, 0.5), pos: [x, y / 2, z], rot: [0, 0, broken ? (vnoise(i, 3, z) - 0.5) * 0.6 : 0], surf: SURF.wood });
    if (!broken) {
      for (let k = 1; k < 4; k++) m.add(box(4, 3, 58), { col: weather(PAL.woodPale, 0.5), pos: [x, (y * k) / 4, 0], surf: SURF.wood });
      m.add(box(4, Math.hypot(y / 2, 52), 3), { col: weather(PAL.woodPale, 0.5), pos: [x, y / 2, 0], rot: [Math.atan2(52, y / 2), 0, 0], surf: SURF.wood });
    }
  }
  // the track: twin rails on ties, missing through the collapse
  const pts: V3[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = -len / 2 + (i * len) / 40;
    if (x > 110 && x < 270) continue;
    pts.push([x, trackY(x) + 4, 0]);
  }
  const left = pts.filter((p) => p[0] <= 110), right = pts.filter((p) => p[0] >= 270);
  for (const seg of [left, right]) {
    if (seg.length < 2) continue;
    for (const z of [-20, 20]) m.add(tube(seg.map((p) => [p[0], p[1], z] as V3), 2.6, 5, seg.length * 3), { col: weather(PAL.iron, 0.4), surf: SURF.iron });
    for (let i = 0; i < seg.length; i++) m.add(box(5, 3, 50), { col: weather(PAL.woodDark, 0.4), pos: [seg[i][0], seg[i][1] - 2, 0], surf: SURF.wood });
  }
  // a derailed car hanging off the broken end
  m.add(rbox(40, 22, 30, 4, 2), { col: weather(PAL.red, 0.55, 0.08, PAL.iron), pos: [118, trackY(110) - 30, 0], rot: [0.2, 0.4, -1.1], surf: SURF.paint });
  return m.build({ ao: 0.4 });
}

export function tiltBase(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  // the undulating platform: a wavy lathe disc
  const prof: [number, number][] = [];
  for (let i = 0; i <= 16; i++) prof.push([(i / 16) * 290, 6 + Math.sin((i / 16) * Math.PI * 3) * 3]);
  prof.push([292, 0]);
  m.add(lathe(prof, 40), { col: weather(PAL.woodDark, 0.45, 0.02), surf: SURF.wood });
  m.add(torus(290, 3, 6, 48), { col: PAL.brass, pos: [0, 8, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  m.add(cyl(30, 40, 40, 16), { col: weather(PAL.velvet, 0.4), pos: [0, 20, 0], surf: SURF.paint });
  return m.build({ ao: 0.25 });
}

/** One rotating arm of the Tilt-a-Whirl (along +X, length 260) with a shell car at the tip. */
export function tiltArm(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(box(260, 10, 14), { col: weather(PAL.iron, 0.4), pos: [130, 36, 0], surf: SURF.iron });
  for (let i = 0; i < 6; i++) bulb(m, [30 + i * 40, 44, 0], 2, i % 2 ? PAL.amber : PAL.hotRed);
  m.add(lathe([[0, 0], [30, 2], [38, 20], [34, 40], [0, 34]], 16, 0, -Math.PI * 0.2, Math.PI * 1.4), { col: weather(PAL.red, 0.5, 0.06, PAL.iron), pos: [262, 14, 0], rot: [0, -Math.PI / 2, 0], surf: SURF.paint });
  m.add(rbox(40, 10, 30, 3, 1), { col: weather(PAL.velvet, 0.3), pos: [262, 24, 0], surf: SURF.velvet });
  return m.build({ ao: 0.2 });
}

const LANTERN_Y = 137;
const LAMP_SCALE = 1.25;
/** Lantern glass centre height on the street lamps (lights, halos and shafts hang from here). */
export const LAMP_LIGHT_H = LANTERN_Y * LAMP_SCALE;

/**
 * A Victorian street lamp (after the art reference): stepped plinth, fluted iron post with knobbed
 * collars, scroll brackets, and a four-paned lantern whose warm glass and bulb are the visible light
 * source, under a flared roof and finial. Soul lamps carry ghost-green glass (red once their note is played) and a skull keystone.
 */
export function lampPost(ghost: boolean, red = false): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const H = LANTERN_Y;
  const iron = C(0x221e20), ironS = SURF.iron;
  // plinth, base collar
  m.add(cyl(8.6, 9.6, 4.5, 8), { col: iron, pos: [0, 2.25, 0], surf: ironS, flat: true });
  m.add(cyl(7.2, 8.2, 5, 8), { col: iron, pos: [0, 7, 0], surf: ironS, flat: true });
  m.add(lathe([[6.4, 0], [6.6, 1.6], [4.4, 5.6], [3.3, 12], [3.6, 13.6], [0, 13.6]], 12), { col: iron, pos: [0, 9.5, 0], surf: ironS });
  // fluted post
  m.add(cyl(2.3, 2.9, 96, 8), { col: iron, pos: [0, 71, 0], surf: ironS, flat: true });
  // collars with knobs
  for (const y of [50, 108]) {
    m.add(torus(3.5, 1.05, 6, 14), { col: iron, pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], surf: ironS });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      m.add(sphere(1.25, 8, 6), { col: iron, pos: [Math.cos(a) * 3.9, y, Math.sin(a) * 3.9], surf: ironS });
    }
  }
  m.add(lathe([[2.4, 0], [3.4, 3], [2.6, 6], [3.8, 9], [0, 9]], 12), { col: iron, pos: [0, 110, 0], surf: ironS });
  // four scroll brackets curling up to the lantern
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const c = Math.cos(a), sn = Math.sin(a);
    m.add(tube([[c * 2.6, 114, sn * 2.6], [c * 5.5, 116, sn * 5.5], [c * 6.6, 120, sn * 6.6], [c * 5.6, 121.8, sn * 5.6]], 0.6, 5, 10), { col: iron, surf: ironS });
  }
  m.add(cyl(2.3, 2.7, 4, 8), { col: iron, pos: [0, 120.5, 0], surf: ironS });
  // lantern: cup, frames, four frosted panes glowing hottest around the mantle, corner mullions
  m.add(lathe([[0, 0], [5.2, 0], [8, 2.6], [7.6, 3.8], [0, 3.8]], 4), { col: iron, pos: [0, H - 15.2, 0], rot: [0, Math.PI / 4, 0], surf: ironS });
  const edge = C(ghost ? (red ? 0xa8101a : 0x2fb877) : 0xd96f26), hot = C(ghost ? (red ? 0xff3b2a : 0xd8ffe8) : 0xffdca6), tmp = new THREE.Color();
  const frosted: ColorFn = (p) => {
    const r = Math.hypot(p.x, p.z) - 5.2, dy = (p.y - (H - 1)) / 8.5;
    return tmp.copy(edge).lerp(hot, Math.exp(-dy * dy - (r * r) / 5));
  };
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    m.add(new THREE.BoxGeometry(9.8, 21, 0.5, 4, 8, 1), { col: frosted, pos: [Math.sin(a) * 5.2, H, Math.cos(a) * 5.2], rot: [0, a, 0], emit: 1, surf: SURF.glass });
    const ca = a + Math.PI / 4;
    m.add(box(1, 22.6, 1), { col: iron, pos: [Math.sin(ca) * 7.3, H, Math.cos(ca) * 7.3], rot: [0, ca, 0], surf: ironS });
  }
  for (const y of [H - 11.4, H + 11.4]) m.add(rbox(14.8, 1.4, 14.8, 0.45, 1), { col: iron, pos: [0, y, 0], surf: ironS });
  // ornamental band and a flared pagoda roof with a finial
  m.add(rbox(13.2, 1.8, 13.2, 0.5, 1), { col: iron, pos: [0, H + 13, 0], surf: ironS });
  m.add(lathe([[0, 0], [13.4, 0], [12, 1.8], [7.4, 5.4], [2.2, 10.6], [0, 11]], 4), { col: iron, pos: [0, H + 13.6, 0], rot: [0, Math.PI / 4, 0], surf: ironS, flat: true });
  m.add(sphere(1.9, 8, 6), { col: iron, pos: [0, H + 26, 0], surf: ironS });
  m.add(cone(1, 5, 6), { col: iron, pos: [0, H + 30, 0], surf: ironS });
  if (ghost) m.add(ellipsoid(3, 3.3, 1.4, 10, 8), { col: PAL.bone, pos: [0, 104, 3.6], surf: SURF.bone });
  const geo = m.build({ ao: 0.15 });
  geo.scale(LAMP_SCALE, LAMP_SCALE, LAMP_SCALE);
  return geo;
}

/** Emblem plate hung beneath a soul lamp. */
export function lampSymbol(kind: number): THREE.BufferGeometry {
  return plaque(kind);
}

export function barrel(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(lathe([[0, 0], [15, 0], [18, 14], [18, 22], [15, 36], [0, 36]], 14, 0), { col: weather(PAL.wood, 0.5, 0.1), surf: SURF.wood });
  for (const y of [5, 31]) m.add(torus(16, 1.2, 4, 16), { col: PAL.iron, pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
  return m.build({ ao: 0.3 });
}

export function crate(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(rbox(34, 32, 34, 1.5, 1), { col: weather(PAL.woodPale, 0.5, 0.08), pos: [0, 16, 0], surf: SURF.wood });
  for (const s of [-1, 1]) m.add(box(36, 4, 4), { col: weather(PAL.woodDark, 0.4), pos: [0, 16, s * 17], rot: [0, 0, s * 0.7], surf: SURF.wood });
  m.add(box(20, 0.6, 12), { col: PAL.cream, pos: [0, 32.2, 4], surf: SURF.paint });
  return m.build({ ao: 0.3 });
}

export function hay(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(rbox(44, 24, 30, 5, 2), { col: weather(PAL.straw, 0.5, 0.2), pos: [0, 12, 0], surf: SURF.canvas });
  for (const x of [-12, 12]) m.add(torus(13, 0.6, 3, 12), { col: PAL.rust, pos: [x, 12, 0], rot: [0, Math.PI / 2, 0], scale: [1, 1, 1.2], surf: SURF.cloth });
  return m.build({ ao: 0.3 });
}

export function deadTree(variant: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const bark = weather(0x2a2420, 0.4, 0.1);
  m.add(tube([[0, 0, 0], [4, 60, 2], [-6, 120, -4], [2, 170, 0]], (t) => 11 - t * 9, 8, 16), { col: bark, surf: SURF.wood });
  const n = 5 + variant;
  for (let i = 0; i < n; i++) {
    const a = i * 2.3 + variant;
    const y = 70 + i * 18;
    const L = 50 - i * 5;
    m.add(tube([[0, y, 0], [Math.cos(a) * L * 0.5, y + 20, Math.sin(a) * L * 0.5], [Math.cos(a + 0.3) * L, y + 30 + vnoise(i, 1, variant) * 20, Math.sin(a + 0.3) * L]], (t) => 4 - t * 3.4, 5, 8), { col: bark, surf: SURF.wood });
  }
  return m.build({ ao: 0.3 });
}

export function trash(variant: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  for (let i = 0; i < 5; i++) {
    const a = i * 1.7 + variant;
    m.add(box(8 + (i % 3) * 3, 0.8, 6), { col: [PAL.cream, PAL.red, PAL.dirty][(i + variant) % 3], pos: [Math.cos(a) * 12, 0.5, Math.sin(a) * 10], rot: [0, a, 0], surf: SURF.paint });
  }
  m.add(cone(3, 9, 8), { col: stripes(4, PAL.cream, PAL.red, 0, 0.4), pos: [4, 2, 2], rot: [0, 0, Math.PI / 2], surf: SURF.canvas });
  return m.build({ ao: 0.1 });
}

export function balloonPost(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(1.6, 2.2, 70, 6), { col: weather(PAL.woodPale, 0.4), pos: [0, 35, 0], surf: SURF.wood });
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26;
    const top: V3 = [Math.cos(a) * 16, 104 + (i % 2) * 12, Math.sin(a) * 16];
    m.add(cyl(0.3, 0.3, 40, 3), { col: PAL.dirty, pos: [top[0] / 2, 86, top[2] / 2], rot: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3], part: PART.SWAY, pivot: [0, 70, 0], surf: SURF.cloth });
    m.add(ellipsoid(9, 11, 9, 10, 8), { col: [PAL.red, PAL.mustard, PAL.teal, PAL.plum, PAL.cream][i], pos: top, part: PART.SWAY, pivot: [0, 70, 0], surf: SURF.latex });
  }
  return m.build({ ao: 0.2 });
}

export function bench(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  for (const s of [-1, 1]) m.add(rbox(4, 30, 22, 1, 1), { col: PAL.iron, pos: [s * 36, 15, 0], surf: SURF.iron });
  for (let i = 0; i < 3; i++) m.add(box(84, 3, 6), { col: weather(PAL.woodPale, 0.5), pos: [0, 24, -8 + i * 7], surf: SURF.wood });
  for (let i = 0; i < 2; i++) m.add(box(84, 6, 3), { col: weather(PAL.woodPale, 0.5), pos: [0, 34 + i * 9, -12], rot: [-0.2, 0, 0], surf: SURF.wood });
  return m.build({ ao: 0.3 });
}

export function pennantPole(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(2.4, 3, 160, 8), { col: weather(PAL.cream, 0.4), pos: [0, 80, 0], surf: SURF.paint });
  m.add(sphere(4, 8, 6), { col: PAL.gold, pos: [0, 162, 0], surf: SURF.gold });
  m.add(extrude([[0, 0], [44, -8], [0, -18]], 0.8, 0, 1), { col: weather(PAL.redDeep, 0.4), pos: [2, 156, 0], part: PART.SWAY, pivot: [0, 156, 0], surf: SURF.canvas });
  return m.build({ ao: 0.2 });
}

export function signMidway(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  for (const s of [-1, 1]) m.add(cyl(3, 3.4, 120, 6), { col: weather(PAL.woodDark, 0.4), pos: [s * 70, 60, 0], surf: SURF.wood });
  m.add(rbox(170, 44, 5, 3, 1), { col: weather(PAL.ink, 0.3), pos: [0, 110, 0], rot: [0, 0, 0.03], surf: SURF.wood });
  bulbRow(m, -78, 78, 136, 3, 12);
  return m.build({ ao: 0.2 });
}

export function tombstonePrize(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const shape = smoothShape([[-18, 0], [18, 0], [18, 34], [10, 46], [0, 49], [-10, 46], [-18, 34]], 24);
  m.add(extrude(shape, 10, 1.5, 8), { col: weather(PAL.slate, 0.5, 0.1), surf: SURF.porcelain });
  m.add(extrude(starShape(5, 6, 2.6), 1, 0, 1), { col: PAL.gold, pos: [0, 30, 5.6], surf: SURF.gold });
  m.add(sphere(5, 8, 6), { col: weather(PAL.pinkDusty, 0.4, 0.3), pos: [10, 4, 10], surf: SURF.plush });
  return m.build({ ao: 0.3 });
}

export function clownStatue(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(rbox(60, 30, 60, 3, 2), { col: weather(PAL.slate, 0.5), pos: [0, 15, 0], surf: SURF.porcelain });
  const stone = weather(PAL.dirty, 0.55, 0.07);
  body(m, [[0, 30], [20, 31], [26, 50], [22, 80], [12, 92], [0, 93]], stone, { surf: SURF.porcelain });
  ruff(m, 92, 18, PAL.dirty, PART.BODY);
  m.add(sphere(16, 14, 10), { col: stone, pos: [0, 110, 0], surf: SURF.porcelain });
  m.add(cone(10, 30, 10), { col: stone, pos: [0, 138, -2], rot: [-0.2, 0, 0.2], surf: SURF.porcelain });
  // the paint that is left: one red nose and weeping black eyes
  m.add(sphere(4, 8, 6), { col: PAL.blood, pos: [0, 108, 15.6], surf: SURF.latex });
  for (const s of [-1, 1]) {
    m.add(ellipsoid(3, 4, 1.4, 6, 4), { col: PAL.ink, pos: [s * 6, 114, 13.6], surf: SURF.porcelain });
    m.add(tube([[s * 6, 110, 14.4], [s * 6.4, 104, 14.8], [s * 6, 98, 14]], 0.7, 4, 6), { col: PAL.ink, surf: SURF.porcelain });
  }
  for (const s of [-1, 1]) m.add(tube([[s * 20, 78, 0], [s * 34, 70, 10], [s * 40, 86, 22]], 5, 6, 10), { col: stone, surf: SURF.porcelain });
  return m.build({ ao: 0.35 });
}

/** A small grandstand (D-47): five worn seat planks on risers, a cross-braced steel frame, rails, litter. */
export function bleachers(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const steel = weather(PAL.iron, 0.55, 0.08, PAL.rust);
  for (let i = 0; i < 5; i++) {
    const y = 14 + i * 16, z = 30 - i * 16;
    // seat: three boards with gaps, paint worn through to bare wood
    for (let k = 0; k < 3; k++) m.add(box(296, 2.6, 4.4), { col: weather(i % 2 ? PAL.redDeep : PAL.cream, 0.6, 0.05, PAL.woodPale), pos: [0, y, z + 4 - k * 5], surf: SURF.wood });
    // riser board
    m.add(box(296, 13, 1.6), { col: weather(PAL.woodDark, 0.5, 0.08), pos: [0, y - 7, z + 7.5], surf: SURF.wood });
  }
  // steel frame: legs, stringers and X bracing under the seats
  for (let i = 0; i <= 6; i++) {
    const x = -148 + i * 49.3;
    m.add(box(3, 86, 3), { col: steel, pos: [x, 43, -36], surf: SURF.iron });
    m.add(box(3, 16, 3), { col: steel, pos: [x, 8, 36], surf: SURF.iron });
    m.add(tube([[x, 4, 36], [x, 84, -36]], 1.6, 4, 6), { col: steel, surf: SURF.iron });
    if (i < 6) m.add(tube([[x, 8, -34], [x + 49.3, 70, -34]], 1, 4, 6), { col: steel, surf: SURF.iron });
  }
  // back and side rails
  m.add(cyl(1.6, 1.6, 300, 6), { col: steel, pos: [0, 104, -38], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
  for (const sx of [-1, 1]) m.add(tube([[sx * 150, 20, 38], [sx * 150, 104, -38]], 1.6, 4, 6), { col: steel, surf: SURF.iron });
  for (let i = 0; i <= 6; i++) m.add(cyl(1.1, 1.1, 22, 5), { col: steel, pos: [-148 + i * 49.3, 93, -38], surf: SURF.iron });
  // what the crowd left behind
  m.add(rbox(8, 10, 6, 1, 1), { col: weather(PAL.cream, 0.4), pos: [-60, 34, 3], rot: [0, 0.3, 0.2], surf: SURF.paint });
  m.add(rbox(8, 10, 6, 1, 1), { col: weather(PAL.red, 0.4), pos: [90, 66, -30], rot: [0.4, 0.8, 0], surf: SURF.paint });
  m.add(cyl(9, 7, 4, 10), { col: weather(PAL.charcoal, 0.3), pos: [24, 49, -12], surf: SURF.cloth });
  bunting(m, [-150, 108, -38], [150, 108, -38], 10, 12, [PAL.blood, PAL.cream, PAL.mustard, PAL.navy]);
  return m.build({ ao: 0.4 });
}

export function tentSmall(variant: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const [a, b] = variant ? [PAL.navy, PAL.cream] : [PAL.redDeep, PAL.mustard];
  stripedCanopy(m, { prof: [[111, 69], [40, 140], [6, 166], [0, 168]], n: 16, a, b, sag: 3.5, wall: { rTop: 102, rBot: 106, y0: 0, y1: 70 } });
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    m.add(sphere(8, 6, 4), { col: weather(i % 2 ? a : b, 0.4), pos: [Math.cos(ang) * 110, 66, Math.sin(ang) * 110], scale: [1.1, 1.3, 0.4], rot: [0, -ang + Math.PI / 2, 0], surf: SURF.canvas });
  }
  // dark doorway flap, guy ropes and stakes
  m.add(extrude([[-26, 0], [26, 0], [12, 60], [-12, 60]], 2, 0, 1), { col: PAL.ink, pos: [0, 0, 104], surf: SURF.canvas });
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.5;
    m.add(cyl(0.6, 0.6, 90, 3), { col: PAL.straw, pos: [Math.cos(ang) * 140, 40, Math.sin(ang) * 140], rot: [Math.sin(ang) * 0.7, 0, -Math.cos(ang) * 0.7], surf: SURF.cloth });
  }
  m.add(cyl(2, 2, 40, 6), { col: PAL.woodDark, pos: [0, 186, 0], surf: SURF.wood });
  m.add(extrude([[0, 0], [30, -6], [0, -12]], 0.8, 0, 1), { col: weather(a, 0.4), pos: [2, 202, 0], part: PART.SWAY, pivot: [0, 202, 0], surf: SURF.canvas });
  return m.build({ ao: 0.35 });
}

export function caravan(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  // a gypsy vardo: barrel roof, carved trim, a lit window, spoked wheels
  m.add(rbox(240, 90, 100, 4, 2), { col: weather(PAL.teal, 0.55, 0.04, PAL.woodPale), pos: [0, 75, 0], surf: SURF.paint });
  m.add(cyl(56, 56, 250, 16, false), { col: weather(PAL.redDeep, 0.5, 0.04), pos: [0, 120, 0], rot: [0, 0, Math.PI / 2], scale: [1, 0.55, 1], surf: SURF.paint });
  for (const x of [-60, 20]) {
    m.add(rbox(36, 30, 4, 2, 1), { col: PAL.amber, pos: [x, 82, 50.5], emit: 0.7, surf: SURF.glass });
    m.add(rbox(42, 36, 3, 2, 1), { col: PAL.gold, pos: [x, 82, 49.5], surf: SURF.gold });
  }
  m.add(rbox(40, 70, 4, 2, 1), { col: weather(PAL.woodDark, 0.4), pos: [90, 65, 50.5], surf: SURF.wood });
  for (const [x, z] of [[-80, 54], [80, 54], [-80, -54], [80, -54]]) {
    m.add(torus(26, 3.4, 6, 20), { col: weather(PAL.mustard, 0.4), pos: [x, 28, z], surf: SURF.wood });
    for (let k = 0; k < 6; k++) m.add(cyl(1.2, 1.2, 50, 4), { col: weather(PAL.mustard, 0.4), pos: [x, 28, z], rot: [0, 0, (k * Math.PI) / 6], surf: SURF.wood });
  }
  for (let i = 0; i < 4; i++) m.add(box(30, 5, 26), { col: weather(PAL.woodPale, 0.4), pos: [90, 7 + i * 7, 64 + (3 - i) * 8], surf: SURF.wood });
  m.add(cyl(4, 4, 30, 6), { col: PAL.iron, pos: [-90, 168, -20], surf: SURF.iron });
  return m.build({ ao: 0.4 });
}

export function dunkTank(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(66, 68, 70, 20, true), { col: 0x2a3a40, pos: [0, 35, 0], surf: SURF.glass });
  m.add(cyl(64, 64, 60, 20), { col: 0x10242c, pos: [0, 32, 0], emit: 0.12, surf: SURF.glass });
  m.add(torus(67, 3, 6, 24), { col: PAL.iron, pos: [0, 70, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
  m.add(torus(67, 3, 6, 24), { col: PAL.iron, pos: [0, 2, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
  m.add(box(80, 4, 16), { col: weather(PAL.woodPale, 0.5), pos: [0, 92, -10], surf: SURF.wood });
  for (const s of [-1, 1]) m.add(cyl(3, 3, 110, 6), { col: PAL.iron, pos: [s * 50, 55, -30], surf: SURF.iron });
  m.add(cyl(14, 14, 3, 16), { col: bands([[-99, PAL.cream]], 0.4), pos: [76, 60, 20], rot: [Math.PI / 2, 0, -0.4], surf: SURF.paint });
  m.add(cyl(8, 8, 3.4, 14), { col: PAL.red, pos: [76.6, 60, 21], rot: [Math.PI / 2, 0, -0.4], surf: SURF.paint });
  return m.build({ ao: 0.3 });
}

/** The High Striker tower (puck + bell animate separately). */
export function strongmanTower(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(rbox(80, 14, 60, 3, 2), { col: weather(PAL.woodDark, 0.5), pos: [0, 7, 0], surf: SURF.wood });
  m.add(rbox(30, 290, 16, 2, 1), { col: weather(PAL.red, 0.55, 0.04, PAL.woodPale), pos: [0, 155, -6], surf: SURF.paint });
  // the scale: painted bands from WEAKLING to STRONGMAN
  const bandsCols = [PAL.navy, PAL.teal, PAL.moss, PAL.mustard, PAL.ochre, PAL.red, PAL.blood];
  for (let i = 0; i < 7; i++) m.add(box(26, 30, 1), { col: weather(bandsCols[i], 0.4), pos: [0, 40 + i * 36, 2.6], surf: SURF.paint });
  m.add(cyl(1.6, 1.6, 270, 6), { col: PAL.iron, pos: [0, 155, 6], surf: SURF.iron });
  // bell housing at the top
  m.add(rbox(44, 12, 24, 2, 1), { col: weather(PAL.mustard, 0.5), pos: [0, 302, -4], surf: SURF.paint });
  m.add(cone(8, 20, 4), { col: PAL.gold, pos: [0, 320, -4], rot: [0, Math.PI / 4, 0], surf: SURF.gold });
  for (let i = 0; i < 9; i++) bulb(m, [-16, 30 + i * 32, 4], 1.6, i % 2 ? PAL.amber : PAL.hotRed);
  for (let i = 0; i < 9; i++) bulb(m, [16, 30 + i * 32, 4], 1.6, i % 2 ? PAL.hotRed : PAL.amber);
  // a mallet left leaning on the base
  m.add(cyl(1.6, 1.6, 60, 6), { col: PAL.woodPale, pos: [36, 30, 18], rot: [0, 0, 0.35], surf: SURF.wood });
  m.add(cyl(7, 7, 18, 10), { col: weather(PAL.redDeep, 0.5), pos: [46, 58, 18], rot: [0, 0, Math.PI / 2 + 0.35], surf: SURF.wood });
  return m.build({ ao: 0.3 });
}

export function strikerPuck(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(rbox(14, 10, 10, 2, 1), { col: PAL.brass, surf: SURF.brass });
  m.add(sphere(3, 8, 6), { col: PAL.amber, pos: [0, 0, 5.6], emit: 1, surf: SURF.bulb });
  return m.build({ ao: 0 });
}

export function strikerBell(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(lathe([[0, 14], [5, 13], [8, 6], [12, 0], [13, -1], [0, -1]], 16), { col: PAL.gold, emit: 0.4, surf: SURF.gold });
  return m.build({ ao: 0 });
}

/** The striker's lever pad: an iron plate with a painted target (glows when it matters). */
export function strikerPad(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(40, 44, 6, 24), { col: weather(PAL.iron, 0.4), pos: [0, 3, 0], surf: SURF.iron });
  m.add(cyl(30, 30, 1, 24), { col: PAL.cream, pos: [0, 6.4, 0], surf: SURF.paint, emit: 0.2 });
  m.add(cyl(20, 20, 1, 24), { col: PAL.blood, pos: [0, 6.8, 0], surf: SURF.paint, emit: 0.3 });
  m.add(cyl(9, 9, 1, 16), { col: PAL.cream, pos: [0, 7.2, 0], surf: SURF.paint, emit: 0.4 });
  return m.build({ ao: 0 });
}

/** Zoltana: a fortune-telling automaton in a glass booth (eyes/ball glow per instance). */
export function fortuneMachine(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const wood = weather(PAL.velvet, 0.5, 0.06, PAL.woodPale);
  m.add(rbox(64, 70, 48, 3, 2), { col: wood, pos: [0, 35, 0], surf: SURF.wood });
  m.add(rbox(68, 6, 52, 2, 1), { col: PAL.gold, pos: [0, 72, 0], surf: SURF.gold });
  // glass cabinet
  m.add(box(58, 74, 1), { col: 0x1e2428, pos: [0, 112, 23], surf: SURF.glass });
  for (const s of [-1, 1]) m.add(box(1, 74, 44), { col: 0x1e2428, pos: [s * 29, 112, 0], surf: SURF.glass });
  for (const [x, z] of [[-30, 24], [30, 24], [-30, -22], [30, -22]]) m.add(cyl(2.2, 2.2, 76, 6), { col: PAL.gold, pos: [x, 112, z], surf: SURF.gold });
  m.add(lathe([[0, 30], [10, 28], [36, 6], [40, 0], [0, 0]], 4), { col: wood, pos: [0, 150, 0], rot: [0, Math.PI / 4, 0], scale: [1, 1, 0.75], surf: SURF.wood });
  // the automaton: turbaned bust, waxen face, hands hovering over a crystal ball
  m.add(lathe([[0, 0], [20, 0], [18, 12], [12, 22], [0, 24]], 14), { col: weather(PAL.redDeep, 0.4), pos: [0, 78, -4], surf: SURF.velvet });
  m.add(ellipsoid(11, 13, 11, 14, 10), { col: weather(PAL.skinPale, 0.3, 0.1), pos: [0, 112, -4], surf: SURF.porcelain });
  m.add(ellipsoid(14, 10, 14, 14, 8), { col: weather(PAL.plum, 0.35), pos: [0, 124, -5], surf: SURF.velvet });
  m.add(sphere(3, 8, 6), { col: PAL.hotRed, pos: [0, 128, 8], emit: 0.8, surf: SURF.glass });
  m.add(ellipsoid(2.6, 1.6, 1, 8, 4), { col: PAL.amber, pos: [4.2, 114, 6.6], emit: 1, surf: SURF.glass });
  m.add(ellipsoid(2.6, 1.6, 1, 8, 4), { col: PAL.amber, pos: [-4.2, 114, 6.6], emit: 1, surf: SURF.glass });
  m.add(ellipsoid(4, 1.6, 1, 8, 4), { col: PAL.ink, pos: [0, 104, 7.6], surf: SURF.porcelain });
  m.add(sphere(9, 14, 10), { col: PAL.violet, pos: [0, 88, 12], emit: 0.6, surf: SURF.glass });
  for (const s of [-1, 1]) m.add(ellipsoid(4, 2.2, 6, 8, 6), { col: weather(PAL.skinPale, 0.3), pos: [s * 9, 97, 12], rot: [0.3, 0, s * 0.4], surf: SURF.porcelain });
  // card slot and coin plate
  m.add(rbox(20, 6, 2, 1, 1), { col: PAL.ink, pos: [0, 50, 24.4], surf: SURF.iron });
  m.add(cyl(6, 6, 2, 12), { col: PAL.brass, pos: [0, 30, 24.4], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  bulbRow(m, -28, 28, 156, 18, 7, [PAL.amber, PAL.violet]);
  return m.build({ ao: 0.3 });
}

export const _unused = { C, eyes, coneHat, stitches, sagPoints, tube, ellipsoid, sphere };
