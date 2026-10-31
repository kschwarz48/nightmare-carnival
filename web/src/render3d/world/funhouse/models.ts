// The Fun House's procedural architecture and furniture (D-63). Everything faces south (+Z): the camera
// looks north, so the south faces carry the detail. Wall sections are SEG long and tile along each wall;
// mirror panels are framed boxes whose glass the mirror system draws.

import * as THREE from 'three';
import { C, SURF, box, cone, cyl, ellipsoid, extrude, lathe, rbox, smoothShape, sphere, starShape, torus, vnoise, weather, type ColorFn } from '../../core/geo';
import { ModelBuilder, PAL, bulb, eyes } from '../../models/kit';

export const SEG = 200;
export const WALL_H: Record<string, number> = { outer: 250, deco: 205, gallery: 205, curtain: 215, crooked: 185, mirror: 150, door: 150 };
export const WALL_T: Record<string, number> = { outer: 60, deco: 40, gallery: 40, curtain: 40, crooked: 60 };

const plaster: ColorFn = (p) => C(0x3a2236).multiplyScalar(0.7 + 0.35 * vnoise(p.x * 0.02, p.y * 0.03, p.z * 0.02) - 0.2 * Math.max(0, vnoise(p.x * 0.09, p.y * 0.09, 3) - 0.7) * 3);
const damask: ColorFn = (p) => {
  const k = Math.sin(p.x * 0.18) * Math.sin(p.y * 0.18) > 0.25 ? 1 : 0;
  return C(k ? 0x5a6a3a : 0x34402a).multiplyScalar(0.7 + 0.3 * vnoise(p.x * 0.03, p.y * 0.03, 1));
};
const velvetRed = weather(0x6a0f1c, 0.35, 0.02);
const woodDark = weather(PAL.woodDark, 0.35, 0.05);

// ---------------------------------------------------------------- walls (one SEG section)
export function wallSection(style: string): THREE.BufferGeometry {
  const H = WALL_H[style] ?? 200, t = WALL_T[style] ?? 40;
  const m = new ModelBuilder();
  const front = t / 2;
  switch (style) {
    case 'gallery':
      m.add(box(SEG, 72, t), { col: woodDark, pos: [0, 36, 0], surf: SURF.wood });
      for (const x of [-50, 50]) m.add(rbox(80, 44, 3, 2, 1), { col: weather(PAL.wood, 0.3), pos: [x, 36, front + 1], surf: SURF.wood });
      m.add(box(SEG, H - 92, t - 4), { col: damask, pos: [0, 72 + (H - 92) / 2, 0], surf: SURF.cloth });
      m.add(box(SEG, 6, t + 6), { col: PAL.gold, pos: [0, 74, 0], surf: SURF.gold });
      m.add(box(SEG, 20, t + 10), { col: woodDark, pos: [0, H - 10, 0], surf: SURF.wood });
      break;
    case 'curtain':
      m.add(box(SEG, H, t * 0.6), { col: C(0x2a0810), pos: [0, H / 2, -t * 0.2], surf: SURF.velvet });
      for (let i = 0; i < 9; i++) m.add(cyl(13, 15, H - 14, 8), { col: velvetRed, pos: [-SEG / 2 + 11 + i * 22.2, (H - 14) / 2, front - 6], surf: SURF.velvet });
      m.add(box(SEG, 16, t + 10), { col: PAL.gold, pos: [0, H - 6, 0], surf: SURF.gold });
      for (const x of [-60, 60]) m.add(sphere(5, 8, 6), { col: PAL.gold, pos: [x, H - 26, front + 6], surf: SURF.gold });
      break;
    case 'crooked': {
      // boards leaning every which way, painted in carnival stripes, peeling
      for (let i = 0; i < 6; i++) {
        const lean = Math.sin(i * 2.7) * 0.07;
        m.add(box(SEG / 6 - 3, H - 10, t), { col: weather(i % 2 ? 0xc8a878 : 0x8a1f24, 0.45, 0.04, PAL.woodPale), pos: [-SEG / 2 + (i + 0.5) * (SEG / 6), (H - 10) / 2, 0], rot: [0, 0, lean], surf: SURF.wood });
      }
      m.add(box(SEG + 10, 14, t + 8), { col: woodDark, pos: [0, H - 6, 0], rot: [0, 0, 0.03], surf: SURF.wood });
      break;
    }
    default: {
      // art deco: dark wood plinth, plum plaster, gilt bands, a fluted pilaster at the section's start, a cornice
      const dark = style === 'outer' ? C(0x1a1016) : null;
      m.add(box(SEG, 16, t + 6), { col: woodDark, pos: [0, 8, 0], surf: SURF.wood });
      m.add(box(SEG, H - 36, t), { col: dark ?? plaster, pos: [0, 16 + (H - 36) / 2, 0], surf: SURF.paint });
      for (const y of [66, H - 52]) m.add(box(SEG, 3, 2), { col: PAL.gold, pos: [0, y, front + 1], surf: SURF.gold });
      // a sunburst fan between the bands: the house's deco signature
      for (let k = -3; k <= 3; k++) m.add(box(2, 40, 1.5), { col: PAL.gold, pos: [Math.sin(k * 0.3) * 20, 92 + Math.cos(k * 0.3) * 20, front + 0.8], rot: [0, 0, -k * 0.3], surf: SURF.gold });
      m.add(box(18, H - 20, t + 8), { col: woodDark, pos: [-SEG / 2 + 9, (H - 20) / 2, 0], surf: SURF.wood });
      for (let f = 0; f < 3; f++) m.add(box(2, H - 40, 1.5), { col: C(0x24160e), pos: [-SEG / 2 + 4 + f * 5, (H - 20) / 2, front + 4.6], surf: SURF.wood });
      m.add(box(SEG, 20, t + 12), { col: woodDark, pos: [0, H - 10, 0], surf: SURF.wood });
      m.add(box(SEG, 3, t + 14), { col: PAL.gold, pos: [0, H, 0], surf: SURF.gold });
      break;
    }
  }
  return m.build({ ao: 0.35 });
}

/** A maze panel's frame and backing (the glass on its south face is the mirror system's). */
export function mirrorPanel(len: number, door = false): THREE.BufferGeometry {
  const H = WALL_H.mirror, t = 24;
  const m = new ModelBuilder();
  const frame = door ? C(0xd8a088) : C(0xb8933e);
  m.add(box(len, H, t * 0.6), { col: C(0x1a1a20), pos: [0, H / 2, -t * 0.2], surf: SURF.iron });
  m.add(box(len, 12, t), { col: frame, pos: [0, 6, 0], surf: SURF.gold });
  m.add(box(len, 12, t), { col: frame, pos: [0, H - 6, 0], surf: SURF.gold });
  for (const s of [-1, 1]) m.add(box(12, H, t), { col: frame, pos: [s * (len / 2 - 6), H / 2, 0], surf: SURF.gold });
  // finials on top
  for (const s of [-1, 1]) m.add(sphere(5, 8, 6), { col: frame, pos: [s * (len / 2 - 6), H + 4, 0], surf: SURF.gold });
  if (door) {
    m.add(torus(18, 2.4, 6, 18), { col: frame, pos: [0, H - 2, t / 2], surf: SURF.gold });
    m.add(extrude(starShape(5, 10, 4), 2, 0.5, 1), { col: C(0xffd8c8), pos: [0, H - 2, t / 2 + 1], surf: SURF.gold, emit: 0.6 });
  }
  return m.build({ ao: 0.2 });
}

// ---------------------------------------------------------------- props
const B = (fn: (m: ModelBuilder) => void, ao = 0.35) => {
  const m = new ModelBuilder();
  fn(m);
  return m.build({ ao });
};

export const FUNHOUSE_PROPS: Record<string, (variant: number) => THREE.BufferGeometry> = {
  fh_column: () => B((m) => {
    m.add(cyl(30, 34, 16, 16), { col: woodDark, pos: [0, 8, 0], surf: SURF.wood });
    m.add(cyl(24, 26, 200, 14), { col: weather(0x2a3a34, 0.3, 0.03), pos: [0, 116, 0], surf: SURF.porcelain });
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      m.add(box(2.4, 196, 3), { col: PAL.gold, pos: [Math.cos(a) * 24.6, 116, Math.sin(a) * 24.6], rot: [0, -a, 0], surf: SURF.gold });
    }
    m.add(lathe([[0, 0], [30, 0], [36, 10], [30, 20], [0, 22]], 14), { col: PAL.gold, pos: [0, 214, 0], surf: SURF.gold });
  }),
  fh_kaleidoscope: () => B((m) => {
    m.add(cyl(110, 120, 28, 6), { col: woodDark, pos: [0, 14, 0], surf: SURF.wood });
    m.add(cyl(118, 118, 6, 6), { col: PAL.gold, pos: [0, 30, 0], surf: SURF.gold });
    // a hexagonal tower of mirrors with gilt edges
    m.add(cyl(80, 92, 280, 6), { col: C(0xc8e0ec), pos: [0, 172, 0], surf: SURF.glass, emit: 0.2 });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      m.add(box(5, 284, 5), { col: PAL.gold, pos: [Math.cos(a) * 86, 172, Math.sin(a) * 86], surf: SURF.gold });
    }
    m.add(cyl(96, 82, 18, 6), { col: PAL.gold, pos: [0, 320, 0], surf: SURF.gold });
  }, 0.2),
  fh_kaleido_crown: () => B((m) => {
    m.add(extrude(starShape(8, 70, 34), 10, 2, 1), { col: PAL.gold, rot: [-Math.PI / 2, 0, 0], surf: SURF.gold });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      bulb(m, [Math.cos(a) * 62, 14, Math.sin(a) * 62], 6, [0xff4a4a, 0x4ad8ff, 0xffd84a, 0xb04aff][k % 4], 0, undefined, 1.4);
    }
  }, 0),
  fh_booth: () => B((m) => {
    m.add(rbox(160, 90, 120, 6, 2), { col: weather(0x6a1a24, 0.4, 0.03), pos: [0, 45, 0], surf: SURF.wood });
    m.add(box(140, 70, 4), { col: C(0x9fd0e0), pos: [0, 120, 52], surf: SURF.glass, emit: 0.35 });
    m.add(box(150, 8, 110), { col: PAL.gold, pos: [0, 88, 0], surf: SURF.gold });
    m.add(extrude(smoothShape([[-80, 0], [80, 0], [80, 20], [40, 50], [0, 62], [-40, 50], [-80, 20]], 30), 110, 2, 1), { col: weather(0x2a1a24, 0.3), pos: [0, 156, -55], surf: SURF.wood });
    m.add(box(120, 22, 3), { col: C(0xffd890), pos: [0, 176, 60], surf: SURF.paint, emit: 1.1 });
    for (let k = 0; k < 7; k++) bulb(m, [-60 + k * 20, 196, 58], 3.6, PAL.amber, 0, undefined, 1.3);
  }),
  fh_counter: () => B((m) => {
    m.add(rbox(220, 70, 70, 4, 2), { col: weather(PAL.wood, 0.4), pos: [0, 35, 0], surf: SURF.wood });
    m.add(box(230, 6, 80), { col: woodDark, pos: [0, 72, 0], surf: SURF.wood });
    m.add(box(160, 26, 3), { col: C(0xe8d8a8), pos: [0, 104, -20], surf: SURF.paint, emit: 0.4 });
    m.add(box(4, 40, 4), { col: woodDark, pos: [-70, 90, -20], surf: SURF.wood });
    m.add(box(4, 40, 4), { col: woodDark, pos: [70, 90, -20], surf: SURF.wood });
    // lost things: a hat, an umbrella, a doll, a shoe
    m.add(cyl(10, 12, 12, 10), { col: PAL.ink, pos: [-80, 82, 10], surf: SURF.velvet });
    m.add(cyl(1.4, 1.4, 60, 6), { col: woodDark, pos: [90, 90, 20], rot: [0, 0, 0.6], surf: SURF.wood });
    m.add(sphere(7, 8, 6), { col: PAL.skinPale, pos: [40, 84, 14], surf: SURF.porcelain });
  }),
  fh_face: () => B((m) => {
    // the house's grin over the Rotunda's arch: a moon-white face the width of the doorway, cracked
    const W = 340;
    m.add(ellipsoid(W, 170, 40, 28, 14), { col: weather(0xe8dcc0, 0.35, 0.01), pos: [0, 330, 0], scale: [1, 1, 0.5], surf: SURF.porcelain });
    for (const s of [-1, 1]) m.add(ellipsoid(70, 46, 20, 16, 10), { col: C(0x14080c), pos: [s * 120, 380, 16], surf: SURF.paint });
    eyes(m, { x: 120, y: 380, z: 30, r: 26, color: PAL.hotRed, glow: 1.6, part: 0 });
    for (const s of [-1, 1]) m.add(ellipsoid(40, 24, 8, 12, 8), { col: C(0xc85a5a), pos: [s * 200, 300, 14], surf: SURF.paint });
    // the grin, ear to ear, full of piano-key teeth
    m.add(ellipsoid(240, 60, 16, 24, 8), { col: C(0x2a0408), pos: [0, 240, 18], surf: SURF.paint });
    for (let i = 0; i < 15; i++) m.add(rbox(22, 34, 6, 3, 1), { col: PAL.bone, pos: [-196 + i * 28, 252 - Math.abs(i - 7) * 2.5, 26], surf: SURF.porcelain });
    m.add(ellipsoid(250, 14, 10, 24, 6), { col: C(0x8a1018), pos: [0, 200, 22], surf: SURF.latex });
    // a crown of bulbs around the brow
    for (let k = 0; k < 13; k++) {
      const a = Math.PI * (0.15 + 0.7 * (k / 12));
      bulb(m, [Math.cos(a) * W * 0.98, 330 + Math.sin(a) * 175, 24], 7, k % 2 ? PAL.amber : 0xff5a3a, 0, undefined, 1.5);
    }
  }, 0.25),
  fh_poster: (v) => B((m) => {
    const cols = [0x8a1f24, 0x1f4a6a, 0x5a2a6a, 0x2a5a3a];
    m.add(box(110, 160, 3), { col: weather(cols[v % 4], 0.5, 0.05, 0xd8c8a0), pos: [0, 150, 0], surf: SURF.paint });
    m.add(box(116, 166, 2), { col: PAL.gold, pos: [0, 150, -1.5], surf: SURF.gold });
    // a face on every poster: the house is in all of its advertising
    m.add(ellipsoid(30, 36, 2, 14, 8), { col: C(0xe8dcc0), pos: [0, 170, 2], surf: SURF.paint });
    m.add(ellipsoid(22, 6, 2, 12, 4), { col: C(0x2a0408), pos: [0, 152, 3], surf: SURF.paint });
    m.add(box(90, 18, 2), { col: C(0xf0d890), pos: [0, 98, 2], surf: SURF.paint, emit: 0.3 });
  }, 0),
  fh_barker: () => B((m) => {
    m.add(rbox(80, 120, 70, 6, 2), { col: weather(0x2a4a5a, 0.4), pos: [0, 60, 0], surf: SURF.wood });
    m.add(box(70, 90, 3), { col: C(0x9fd0e0), pos: [0, 150, 30], surf: SURF.glass, emit: 0.2 });
    m.add(ellipsoid(18, 22, 16, 12, 8), { col: weather(PAL.clown, 0.3), pos: [0, 170, 0], surf: SURF.porcelain });
    eyes(m, { x: 7, y: 174, z: 13, r: 4, color: PAL.amber, glow: 1.2, part: 0 });
    m.add(cyl(8, 10, 16, 10), { col: PAL.ink, pos: [0, 196, 0], surf: SURF.velvet });
    m.add(cone(10, 30, 10), { col: PAL.brass, pos: [24, 158, 18], rot: [0, 0, -1.2], surf: SURF.brass });
  }),
  fh_mannequin: (v) => B((m) => {
    if (v === 2) {
      // a jointed artist's dummy on a stand
      m.add(cyl(18, 22, 6, 12), { col: woodDark, pos: [0, 3, 0], surf: SURF.wood });
      m.add(cyl(2, 2, 70, 6), { col: PAL.brass, pos: [0, 40, 0], surf: SURF.brass });
      m.add(ellipsoid(12, 26, 9, 12, 8), { col: weather(PAL.woodPale, 0.3), pos: [0, 96, 0], surf: SURF.wood });
      m.add(sphere(10, 10, 8), { col: weather(PAL.woodPale, 0.3), pos: [0, 132, 0], surf: SURF.wood });
      for (const s of [-1, 1]) m.add(cyl(3, 2.6, 46, 6), { col: weather(PAL.woodPale, 0.3), pos: [s * 15, 100, 6], rot: [0.6, 0, s * 0.3], surf: SURF.wood });
      return;
    }
    // a tailor's dress form: tripod, brass pole, a torso in old fabric with a painted grin on its "head" knob
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      m.add(box(4, 3, 30), { col: woodDark, pos: [Math.cos(a) * 12, 4, Math.sin(a) * 12], rot: [0, -a, 0], surf: SURF.wood });
    }
    m.add(cyl(2.4, 2.4, 70, 6), { col: PAL.brass, pos: [0, 40, 0], surf: SURF.brass });
    m.add(lathe([[0, 0], [16, 0], [20, 14], [15, 32], [22, 52], [18, 64], [8, 70], [0, 72]], 16), { col: weather(v ? 0x6a2a3a : 0x3a4a5a, 0.4, 0.04), pos: [0, 74, 0], scale: [1, 1, 0.72], surf: SURF.cloth });
    m.add(sphere(8, 10, 8), { col: C(0xe6dccb), pos: [0, 154, 0], surf: SURF.porcelain });
    m.add(ellipsoid(5, 1.4, 1, 8, 4), { col: C(0x6a1018), pos: [0, 151, 7.4], surf: SURF.paint });
  }),
  fh_plinth: (v) => B((m) => {
    m.add(rbox(90, 44, 90, 4, 2), { col: weather(0xd8d0c0, 0.25, 0.03), pos: [0, 22, 0], surf: SURF.porcelain });
    m.add(box(96, 6, 96), { col: PAL.gold, pos: [0, 46, 0], surf: SURF.gold });
    m.add(box(50, 14, 2), { col: PAL.brass, pos: [0, 24, 46], surf: SURF.brass });
    // the performer's empty costume on a dress form; the head is lit by the quest
    const costume = [0x9a5a2a, 0xe8a0b8, 0xe8e0d0, 0x14101a][v % 4];
    m.add(cyl(2.4, 2.4, 40, 6), { col: PAL.brass, pos: [0, 68, 0], surf: SURF.brass });
    m.add(lathe([[0, 0], [16, 0], [20, 14], [15, 32], [22, 52], [18, 64], [8, 70], [0, 72]], 16), { col: weather(costume, 0.35, 0.04), pos: [0, 86, 0], scale: [1, 1, 0.72], surf: SURF.cloth });
    if (v % 4 === 1) m.add(cyl(30, 34, 4, 16), { col: C(0xf0c0d0), pos: [0, 98, 0], surf: SURF.cloth }); // the tutu
    if (v % 4 === 3) m.add(cone(30, 70, 12), { col: C(0x1a0a20), pos: [0, 120, -8], surf: SURF.velvet }); // the cape
    if (v % 4 === 2) for (let k = 0; k < 4; k++) m.add(sphere(3.4, 6, 4), { col: PAL.hotRed, pos: [Math.sin(k) * 10, 100 + k * 10, 14], surf: SURF.paint }); // polka dots
    if (v % 4 === 0) m.add(box(40, 6, 6), { col: PAL.iron, pos: [0, 150, 18], surf: SURF.iron }); // the dumbbell
  }),
  fh_plinth_head: () => B((m) => {
    m.add(sphere(9, 12, 10), { col: C(0xf2ead8), surf: SURF.porcelain, emit: 0.2 });
  }, 0),
  fh_marionette_rack: () => B((m) => {
    m.add(box(20, 220, 20), { col: woodDark, pos: [-110, 110, 0], surf: SURF.wood });
    m.add(box(20, 220, 20), { col: woodDark, pos: [110, 110, 0], surf: SURF.wood });
    m.add(box(240, 12, 16), { col: woodDark, pos: [0, 214, 0], surf: SURF.wood });
    for (let k = 0; k < 5; k++) {
      const x = -84 + k * 42;
      m.add(cyl(0.5, 0.5, 60, 3), { col: PAL.bone, pos: [x, 182, 0], surf: SURF.cloth });
      m.add(ellipsoid(8, 14, 6, 8, 6), { col: weather([0x8a2434, 0x2a4a6a, 0x5a2a6a][k % 3], 0.4), pos: [x, 140, 0], surf: SURF.velvet });
      m.add(sphere(6.4, 8, 6), { col: weather(PAL.woodPale, 0.3), pos: [x, 160, 0], surf: SURF.wood });
      for (const s of [-1, 1]) m.add(cyl(1.6, 1.4, 22, 5), { col: weather(PAL.woodPale, 0.3), pos: [x + s * 4, 118, 0], rot: [0, 0, s * 0.15], surf: SURF.wood });
    }
  }),
  fh_musicbox: () => B((m) => {
    m.add(rbox(150, 80, 110, 8, 2), { col: weather(0x4a1a2a, 0.35, 0.03), pos: [0, 40, 0], surf: SURF.wood });
    m.add(box(156, 8, 116), { col: PAL.gold, pos: [0, 82, 0], surf: SURF.gold });
    for (let k = 0; k < 6; k++) m.add(box(14, 30, 2), { col: PAL.gold, pos: [-55 + k * 22, 40, 56], surf: SURF.gold });
    m.add(cyl(30, 30, 10, 18), { col: C(0xd8c8e8), pos: [0, 92, 0], surf: SURF.porcelain });
    m.add(cyl(2, 2, 20, 6), { col: PAL.brass, pos: [80, 50, 0], rot: [0, 0, Math.PI / 2], surf: SURF.brass });
  }),
  fh_ballerina: () => B((m) => {
    m.add(cyl(14, 2, 10, 14), { col: C(0xf0c8d8), pos: [0, 16, 0], surf: SURF.cloth });
    m.add(ellipsoid(4, 9, 3, 8, 6), { col: C(0xf0c8d8), pos: [0, 26, 0], surf: SURF.cloth });
    m.add(sphere(3.6, 8, 6), { col: C(0xe8dcc8), pos: [0, 38, 0], surf: SURF.porcelain });
    m.add(cyl(0.8, 0.8, 14, 4), { col: C(0xe8dcc8), pos: [0, 4, 0], surf: SURF.porcelain });
    m.add(cyl(0.7, 0.7, 14, 4), { col: C(0xe8dcc8), pos: [0, 40, 0], rot: [0, 0, 0.2], surf: SURF.porcelain });
  }, 0),
  fh_projector: () => B((m) => {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      m.add(cyl(1.6, 1.6, 90, 5), { col: woodDark, pos: [Math.cos(a) * 16, 44, Math.sin(a) * 16], rot: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3], surf: SURF.wood });
    }
    m.add(rbox(44, 40, 56, 5, 2), { col: PAL.brass, pos: [0, 104, 0], surf: SURF.brass });
    m.add(cyl(13, 15, 26, 14), { col: PAL.brass, pos: [0, 104, 38], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
    m.add(cyl(11, 11, 2, 14), { col: C(0xfff4d8), pos: [0, 104, 52], rot: [Math.PI / 2, 0, 0], surf: SURF.glass, emit: 1.4 });
    m.add(cyl(6, 8, 30, 10), { col: PAL.iron, pos: [0, 138, -10], surf: SURF.iron });
  }),
  fh_curtain: (v) => B((m) => {
    // v1 the stage backdrop, v2 side drapes, v3 the gallery's great curtain over the projector
    const W = v === 1 ? 1420 : v === 2 ? 260 : 240, H = v === 1 ? 280 : 230;
    const n = Math.round(W / 26);
    for (let i = 0; i < n; i++) m.add(cyl(14, 16, H, 8), { col: v === 3 ? weather(0x4a1a5a, 0.3, 0.02) : velvetRed, pos: [-W / 2 + 13 + i * (W / n), H / 2, Math.sin(i * 1.3) * 3], surf: SURF.velvet });
    m.add(box(W + 20, 16, 30), { col: PAL.gold, pos: [0, H + 4, 0], surf: SURF.gold });
    if (v !== 3) for (const s of [-1, 1]) m.add(sphere(9, 8, 6), { col: PAL.gold, pos: [s * (W / 2 - 30), H * 0.55, 18], surf: SURF.gold });
  }),
  fh_stage: () => B((m) => {
    m.add(box(1300, 10, 280), { col: weather(PAL.woodDark, 0.3, 0.02), pos: [0, 5, 0], surf: SURF.wood });
    m.add(box(1310, 8, 6), { col: PAL.gold, pos: [0, 10, 141], surf: SURF.gold });
    for (let k = 0; k < 24; k++) bulb(m, [-620 + k * 54, 12, 136], 4, PAL.amber, 0, undefined, 1.2);
  }, 0.2),
  fh_clock: () => B((m) => {
    m.add(cyl(46, 46, 10, 24), { col: woodDark, pos: [0, 150, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.wood });
    m.add(cyl(40, 40, 2, 24), { col: C(0xf0e6cc), pos: [0, 150, 6], rot: [Math.PI / 2, 0, 0], surf: SURF.porcelain, emit: 0.25 });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      m.add(box(2.4, k % 3 ? 5 : 9, 1), { col: PAL.ink, pos: [Math.sin(a) * 34, 150 + Math.cos(a) * 34, 7.4], rot: [0, 0, -a], surf: SURF.paint });
    }
    m.add(torus(46, 3, 6, 24), { col: PAL.gold, pos: [0, 150, 4], surf: SURF.gold });
  }, 0.2),
  fh_clock_hand: () => B((m) => {
    m.add(box(3, 30, 1.2), { col: PAL.ink, pos: [0, 13, 0], surf: SURF.paint });
  }, 0),
  fh_vanity: () => B((m) => {
    m.add(rbox(140, 60, 44, 4, 2), { col: weather(0xd8b8c0, 0.35, 0.03), pos: [0, 30, 0], surf: SURF.wood });
    m.add(box(110, 120, 6), { col: PAL.gold, pos: [0, 126, -14], surf: SURF.gold });
    m.add(box(96, 106, 2), { col: C(0xc8e0ea), pos: [0, 126, -10], surf: SURF.glass, emit: 0.35 });
    for (let k = 0; k < 6; k++) {
      bulb(m, [-54, 78 + k * 20, -10], 4, PAL.amber, 0, undefined, 1.3);
      bulb(m, [54, 78 + k * 20, -10], 4, PAL.amber, 0, undefined, 1.3);
    }
    m.add(cyl(6, 7, 12, 10), { col: C(0xe8c8d8), pos: [-40, 66, 6], surf: SURF.porcelain });
  }),
  fh_crystal: () => B((m) => {
    m.add(cyl(26, 32, 30, 8), { col: woodDark, pos: [0, 15, 0], surf: SURF.wood });
    m.add(cyl(20, 20, 4, 8), { col: PAL.gold, pos: [0, 32, 0], surf: SURF.gold });
    m.add(ellipsoid(16, 34, 16, 6, 4), { col: C(0xb8fff0), pos: [0, 66, 0], surf: SURF.glass, emit: 0.9 });
  }, 0.2),
  fh_mark: () => B((m) => {
    for (const s of [-1, 1]) m.add(ellipsoid(9, 1.5, 18, 10, 4), { col: PAL.brass, pos: [s * 12, 1, 0], rot: [0, s * 0.1, 0], surf: SURF.brass, emit: 0.2 });
    m.add(torus(30, 1.4, 4, 24), { col: PAL.gold, pos: [0, 1, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
  }, 0),
  fh_bench: () => B((m) => {
    m.add(box(150, 8, 40), { col: weather(0x6a1a24, 0.4), pos: [0, 40, 0], surf: SURF.velvet });
    m.add(box(150, 40, 8), { col: weather(0x6a1a24, 0.4), pos: [0, 64, -18], surf: SURF.velvet });
    for (const s of [-1, 1]) m.add(box(8, 40, 36), { col: PAL.iron, pos: [s * 70, 20, 0], surf: SURF.iron });
  }),
  fh_piston: () => B((m) => {
    m.add(cyl(70, 76, 10, 16), { col: C(0x3a3a40), pos: [0, 5, 0], surf: SURF.iron });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      m.add(box(14, 2, 4), { col: k % 2 ? PAL.mustard : PAL.ink, pos: [Math.cos(a) * 66, 11, Math.sin(a) * 66], rot: [0, -a, 0], surf: SURF.paint });
    }
    m.add(cyl(12, 12, 60, 10), { col: PAL.iron, pos: [0, 300, 0], surf: SURF.iron });
  }),
  fh_piston_head: () => B((m) => {
    m.add(cyl(62, 66, 40, 16), { col: weather(PAL.iron, 0.4, 0.05), surf: SURF.iron });
    m.add(cyl(68, 68, 6, 16), { col: PAL.mustard, pos: [0, -18, 0], surf: SURF.paint });
    m.add(cyl(10, 10, 220, 8), { col: PAL.iron, pos: [0, 130, 0], surf: SURF.iron });
  }, 0.2),
  fh_pivot: () => B((m) => {
    m.add(cyl(34, 40, 14, 12), { col: woodDark, pos: [0, 7, 0], surf: SURF.wood });
    m.add(cyl(30, 30, 3, 12), { col: PAL.gold, pos: [0, 15, 0], surf: SURF.gold });
  }, 0.2),
  fh_pivot_mirror: () => B((m) => {
    m.add(box(8, 70, 66), { col: PAL.gold, pos: [0, 56, 0], surf: SURF.gold });
    m.add(box(9, 60, 56), { col: C(0xd8f0ff), pos: [0, 56, 0], surf: SURF.glass, emit: 0.6 });
    m.add(cyl(3, 3, 24, 6), { col: PAL.brass, pos: [0, 16, 0], surf: SURF.brass });
  }, 0),
  fh_lamp: () => B((m) => {
    m.add(cyl(14, 16, 6, 10), { col: PAL.iron, pos: [0, 3, 0], surf: SURF.iron });
    m.add(cyl(2.6, 2.6, 130, 6), { col: PAL.brass, pos: [0, 70, 0], surf: SURF.brass });
    m.add(lathe([[0, 0], [16, 0], [12, 18], [6, 22], [0, 22]], 12), { col: weather(0x8a2a3a, 0.3), pos: [0, 128, 0], surf: SURF.cloth });
    bulb(m, [0, 132, 0], 5, PAL.amber, 0, undefined, 1.6);
  }),
  fh_trunk: () => B((m) => {
    m.add(rbox(80, 50, 56, 4, 2), { col: weather(0x4a3020, 0.4), pos: [0, 25, 0], surf: SURF.rubber });
    for (const x of [-26, 26]) m.add(box(6, 52, 58), { col: PAL.brass, pos: [x, 25, 0], surf: SURF.brass });
    m.add(box(14, 10, 3), { col: PAL.brass, pos: [0, 40, 29], surf: SURF.brass });
  }),
  fh_chandelier: () => B((m) => {
    m.add(cyl(1.2, 1.2, 120, 4), { col: PAL.iron, pos: [0, 380, 0], surf: SURF.iron });
    m.add(torus(40, 3, 6, 18), { col: PAL.gold, pos: [0, 312, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
    m.add(lathe([[0, 0], [10, 0], [16, 16], [8, 30], [0, 34]], 12), { col: PAL.gold, pos: [0, 300, 0], surf: SURF.gold });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      bulb(m, [Math.cos(a) * 40, 318, Math.sin(a) * 40], 5, PAL.amber, 0, undefined, 1.6);
      m.add(cone(3, 12, 4), { col: C(0xe8f8ff), pos: [Math.cos(a) * 40, 300, Math.sin(a) * 40], rot: [Math.PI, 0, 0], surf: SURF.glass, emit: 0.4 });
    }
  }, 0),
  fh_mural: () => B((m) => {
    // the mural's frame on the chamber floor: a ring of brass studs around where the fragments lie
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      m.add(sphere(3, 6, 4), { col: PAL.brass, pos: [Math.cos(a) * 190, 2, Math.sin(a) * 120], surf: SURF.brass });
    }
  }, 0),
};

export const _unused = { cone };
