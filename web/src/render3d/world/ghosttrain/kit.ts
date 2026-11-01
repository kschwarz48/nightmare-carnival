// The Ghost Train's prop kit (D-80): everything that stands in the carriages and at the five stations. Each
// builder faces south (+Z, toward the camera) with its origin at its foot; the world batches them by kind.
// The line's materials: cast iron painted bottle green and gone to rust, soot-dark brick, cream enamel signs,
// brass and gilt, grave-stone and moss, and the wood of the 1890s carriages (teak, mahogany, worn velvet).

import * as THREE from 'three';
import { C, SURF, box, cone, cyl, ellipsoid, extrude, lathe, rbox, sphere, torus, tube, vnoise, weather, type ColorFn } from '../../core/geo';
import { ModelBuilder, PAL } from '../../models/kit';

const B = (fn: (m: ModelBuilder) => void, ao = 0.35) => {
  const m = new ModelBuilder();
  fn(m);
  return m.build({ ao });
};
// ---------------------------------------------------------------- the line's palette
export const GT = {
  green: 0x1c2e24, maroon: 0x3a1418, cream: 0xd8ccb0, brick: 0x3a2622, soot: 0x161412, stone: 0x5a5852, moss: 0x2e3a22,
  teak: 0x5a3a22, mahogany: 0x3a1a12, velvet: 0x5a1a22, plum: 0x3a1a2a, gilt: 0xb8902e, glass: 0xfff0c8,
};
const iron = weather(0x22261f, 0.45, 0.05, 0x5a3a24);
const greenIron = weather(GT.green, 0.4, 0.05, 0x4a3420);
const brass = weather(PAL.brass, 0.35, 0.04, 0x3a4a30);
const brick = weather(GT.brick, 0.45, 0.04, 0x1a1210);
const sootBrick = weather(0x24181a, 0.5, 0.05, 0x0e0a0a);
const stone = weather(GT.stone, 0.45, 0.05, 0x2e3a24);
const paleStone = weather(0x8a8678, 0.45, 0.05, 0x3a4430);
const marble = weather(0xb8b0a0, 0.35, 0.06, 0x6a6458);
const slate = weather(0x2a2e34, 0.35, 0.05, 0x3a3e30);
const teak = weather(GT.teak, 0.4, 0.05, 0x7a5a3a);
const darkWood = weather(0x2a1a12, 0.4, 0.05, 0x4a3020);
const whitewash = weather(0xc8c0b0, 0.45, 0.05, 0x6a6458);
const rust: ColorFn = (p) => C(0x4a2a1c).multiplyScalar(0.7 + 0.45 * vnoise(p.x * 0.08, p.y * 0.08, p.z * 0.08));
const coalCol: ColorFn = (p) => (vnoise(p.x * 0.3, p.y * 0.3, p.z * 0.3) > 0.78 ? C(0x3a3430) : C(0x121010).lerp(C(0x1e1c1a), vnoise(p.x * 0.1, p.y * 0.1, p.z * 0.1)));
const velvet = (hex: number) => weather(hex, 0.25, 0.08, 0x1a0a0e);
/** Where the church tower's clock face is, relative to the church (Mira's hour is shown on it). */
export const CHURCH_FACE = { h: 380, z: -36 };
/** Lamp heights the lighting module reads (globe centre). */
export const GT_LAMP_H = 150, GT_LAMPPOST_H = 162, GT_WALL_LAMP_H = 70;

/** A gable roof (ridge along X) over a w x d footprint at height h, with overhang. */
function gable(m: ModelBuilder, w: number, d: number, h: number, rise: number, col: number | ColorFn, o = 12): void {
  const W = w / 2 + o, D = d / 2 + o;
  const shape: [number, number][] = [[-D, 0], [D, 0], [0, rise]];
  const g = extrude(shape, W * 2, 0);
  g.rotateY(Math.PI / 2);
  g.translate(-W, h, 0);
  m.add(g, { col, surf: SURF.paint, flat: true });
}
/** A row of windows on a façade facing +Z at depth z (lit panes glow). */
function windows(m: ModelBuilder, x0: number, x1: number, y: number, z: number, n: number, w: number, h: number, lit: number[], frame: number | ColorFn = 0x1a1612): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) / n) * (x1 - x0);
    m.add(box(w + 4, h + 4, 2), { col: frame, pos: [x, y, z], surf: SURF.wood });
    const on = lit.includes(i);
    m.add(box(w, h, 1), { col: on ? 0xffc878 : 0x101418, pos: [x, y, z + 1.4], surf: on ? SURF.bulb : SURF.glass, emit: on ? 1.1 : 0 });
    m.add(box(1.4, h, 1), { col: frame, pos: [x, y, z + 2], surf: SURF.wood });
  }
}

export const GT_KIT: Record<string, (variant: number) => THREE.BufferGeometry> = {
  // ================================================================ the carriages' furnishings
  gt_coal: () => B((m) => {
    // a heap of coal: lumps piled into a mound (the tender's load)
    m.add(ellipsoid(40, 26, 40, 14, 8), { col: coalCol, pos: [0, 4, 0], surf: SURF.rubber });
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, r = 14 + (i % 4) * 7;
      m.add(rbox(10 + (i % 3) * 3, 8, 9, 2, 1), { col: coalCol, pos: [Math.cos(a) * r, 16 + (i % 5) * 3 - r * 0.25, Math.sin(a) * r], rot: [i * 0.7, i * 1.3, i * 0.4], surf: SURF.rubber });
    }
  }, 0.5),
  gt_luggage: (v) => B((m) => {
    // stacked trunks, hat boxes and crates (the baggage car)
    const hide = [weather(0x5a3a1e, 0.45), weather(0x2a3a4a, 0.4), weather(0x4a2a2a, 0.45), weather(0x6a5a3a, 0.4)][v % 4];
    m.add(rbox(60, 34, 56, 3), { col: hide, pos: [0, 17, 0], surf: SURF.wood });
    for (const x of [-26, 26]) m.add(box(3, 35, 57), { col: brass, pos: [x, 17, 0], surf: SURF.brass });
    m.add(rbox(44, 26, 40, 3), { col: v % 2 ? weather(0x3a2a1a, 0.4) : hide, pos: [4, 47, -2], rot: [0, 0.2, 0], surf: SURF.wood });
    m.add(cyl(13, 13, 16, 14), { col: v % 2 ? 0x6a2a3a : 0x2a4a3a, pos: [-12, 68, 4], surf: SURF.canvas });
    m.add(box(10, 6, 0.6), { col: 0xd8c8a0, pos: [12, 22, 28.4], surf: SURF.paint });
  }, 0.45),
  gt_seat: (v) => B((m) => {
    // a pair of buttoned velvet seats on a mahogany frame, the back to the wall (north row v0 faces south)
    const back = v ? 1 : -1;
    m.add(rbox(40, 12, 44, 3), { col: darkWood, pos: [0, 10, 0], surf: SURF.wood });
    m.add(rbox(38, 8, 40, 4), { col: velvet(GT.velvet), pos: [0, 20, 2 * -back], surf: SURF.velvet });
    m.add(rbox(38, 34, 10, 4), { col: velvet(GT.velvet), pos: [0, 38, 18 * back], surf: SURF.velvet });
    for (const x of [-10, 10]) m.add(sphere(1.2, 6, 4), { col: GT.gilt, pos: [x, 42, 18 * back - 5.4 * back], surf: SURF.gold });
    m.add(box(40, 3, 3), { col: brass, pos: [0, 56, 20 * back], surf: SURF.brass });
  }),
  gt_table: (v) => B((m) => {
    // a dining table laid for two: white cloth, a little brass lamp with a pink shade, silver
    m.add(cyl(3, 4, 30, 8), { col: darkWood, pos: [0, 15, 0], surf: SURF.wood });
    m.add(rbox(50, 4, 42, 1.5), { col: 0xe8e0d0, pos: [0, 31, 0], surf: SURF.cloth });
    m.add(box(52, 10, 44), { col: 0xd8d0c0, pos: [0, 26, 0], surf: SURF.cloth });
    m.add(cyl(1.4, 2.4, 14, 8), { col: PAL.brass, pos: [0, 40, 0], surf: SURF.brass });
    m.add(cone(7, 7, 10), { col: 0xff9a8a, pos: [0, 50, 0], surf: SURF.bulb, emit: 1.2 });
    for (const s of [-1, 1]) {
      m.add(cyl(6, 6, 0.8, 12), { col: 0xf0ece0, pos: [s * 14, 33.6, s * 6 * (v ? -1 : 1)], surf: SURF.porcelain });
      m.add(cyl(1.6, 1.2, 6, 8), { col: 0xc8d8e0, pos: [s * 18, 36, -10], surf: SURF.glass });
    }
  }),
  gt_catafalque: () => B((m) => {
    // Car 13: a draped bier and the sealed casket on it, wreaths, a pall of black velvet
    m.add(rbox(184, 30, 72, 3), { col: velvet(0x141016), pos: [0, 15, 0], surf: SURF.velvet });
    for (let i = 0; i < 9; i++) m.add(box(20, 30, 1), { col: GT.gilt, pos: [-80 + i * 20, 15, 36.6], surf: SURF.gold });
    m.add(rbox(150, 26, 48, 4), { col: weather(0x1a0e0a, 0.3, 0.05), pos: [0, 43, 0], surf: SURF.wood });
    m.add(rbox(140, 8, 40, 4), { col: weather(0x2a1610, 0.3, 0.05), pos: [0, 59, 0], surf: SURF.wood });
    for (const x of [-56, -18, 18, 56]) for (const s of [-1, 1]) m.add(box(8, 3, 2), { col: PAL.brass, pos: [x, 44, s * 25], surf: SURF.brass });
    m.add(torus(14, 4, 6, 16), { col: 0x2a3a1e, pos: [40, 66, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.cloth });
    for (let k = 0; k < 6; k++) m.add(sphere(2.4, 6, 4), { col: 0xe8e0d0, pos: [40 + Math.cos(k) * 14, 68, Math.sin(k) * 14], surf: SURF.cloth });
    m.add(rbox(18, 2, 12, 1), { col: 0x8a7a5a, pos: [-30, 64, 0], surf: SURF.brass });
  }, 0.4),
  gt_candles: () => B((m) => {
    // a tall iron candle stand with three candles (their flames are lit by the lighting module)
    m.add(cyl(9, 11, 4, 10), { col: iron, pos: [0, 2, 0], surf: SURF.iron });
    m.add(cyl(1.6, 2, 90, 8), { col: iron, pos: [0, 47, 0], surf: SURF.iron });
    m.add(box(26, 2, 3), { col: iron, pos: [0, 92, 0], surf: SURF.iron });
    for (const x of [-11, 0, 11]) {
      m.add(cyl(2, 2, 12 + (x === 0 ? 4 : 0), 8), { col: 0xe8e0c8, pos: [x, 99 + (x === 0 ? 2 : 0), 0], surf: SURF.porcelain });
      m.add(cone(1.4, 4, 6), { col: 0xffd080, pos: [x, 107 + (x === 0 ? 4 : 0), 0], surf: SURF.bulb, emit: 2.4 });
    }
  }),
  gt_partition: (v) => B((m) => {
    // the sleeper's panelled partition (v0: along the car, a box hw x 4), or a bulkhead (v1)
    if (v === 0) {
      m.add(box(100, 66, 8), { col: teak, pos: [0, 33, 0], surf: SURF.wood });
      for (let i = 0; i < 4; i++) m.add(box(18, 40, 1), { col: weather(0x6a4a2a, 0.35), pos: [-36 + i * 24, 34, 4.6], surf: SURF.wood });
      m.add(box(102, 4, 10), { col: brass, pos: [0, 66, 0], surf: SURF.brass });
    } else {
      m.add(box(8, 66, 98), { col: teak, pos: [0, 33, 0], surf: SURF.wood });
      m.add(rbox(6, 30, 40, 4), { col: velvet(GT.plum), pos: [5, 22, 0], surf: SURF.velvet });
    }
  }),
  gt_armchair: () => B((m) => {
    // a wing armchair in worn plum velvet (the observation car)
    m.add(rbox(34, 14, 32, 4), { col: velvet(GT.plum), pos: [0, 12, 0], surf: SURF.velvet });
    m.add(rbox(34, 34, 8, 4), { col: velvet(GT.plum), pos: [0, 34, -13], surf: SURF.velvet });
    for (const s of [-1, 1]) m.add(rbox(7, 18, 30, 3), { col: velvet(GT.plum), pos: [s * 15, 22, 0], surf: SURF.velvet });
    for (const [x, z] of [[-13, -12], [13, -12], [-13, 12], [13, 12]]) m.add(cyl(2, 1.6, 6, 6), { col: darkWood, pos: [x, 3, z], surf: SURF.wood });
  }),
  gt_rail: () => B((m) => {
    // the observation platform's brass railing post
    m.add(cyl(2.4, 2.4, 50, 8), { col: brass, pos: [0, 25, 0], surf: SURF.brass });
    m.add(box(4, 3, 64), { col: brass, pos: [0, 50, 0], surf: SURF.brass });
    for (const z of [-22, 0, 22]) m.add(cyl(1, 1, 48, 6), { col: brass, pos: [0, 24, z], surf: SURF.brass });
  }),

  // ================================================================ every platform
  gt_column: (v) => B((m) => {
    // a cast-iron canopy column: fluted shaft, a foliate capital, the spandrel bracket and valance above
    const col = v === 1 || v === 3 ? iron : greenIron;
    m.add(cyl(13, 15, 12, 12), { col, pos: [0, 6, 0], surf: SURF.iron });
    m.add(cyl(7, 8, 170, 12), { col, pos: [0, 96, 0], surf: SURF.iron });
    for (let k = 0; k < 8; k++) m.add(box(1.4, 150, 1.4), { col: 0x101410, pos: [Math.cos((k * Math.PI) / 4) * 7.6, 98, Math.sin((k * Math.PI) / 4) * 7.6], surf: SURF.iron });
    m.add(lathe([[7, 0], [12, 6], [14, 12], [10, 16]], 12, 4), { col, pos: [0, 180, 0], surf: SURF.iron });
    for (const s of [-1, 1]) m.add(torus(24, 2, 5, 14, Math.PI / 2), { col, pos: [s * 2, 172, 0], rot: [0, 0, s > 0 ? 0 : Math.PI / 2], surf: SURF.iron });
    // the canopy's valance boards, saw-toothed, painted cream and gone grey
    for (let i = -9; i <= 9; i++) m.add(box(20, 14, 1.4), { col: weather(GT.cream, 0.5, 0.05, 0x4a4438), pos: [i * 21, 194, 6], surf: SURF.wood });
    for (let i = -9; i <= 9; i++) m.add(cone(10, 10, 4), { col: weather(GT.cream, 0.5, 0.05, 0x4a4438), pos: [i * 21, 184, 6], rot: [Math.PI, Math.PI / 4, 0], scale: [1, 1, 0.12], surf: SURF.wood });
    m.add(box(400, 4, 4), { col, pos: [0, 202, 4], surf: SURF.iron });
  }),
  gt_column_broken: () => B((m) => {
    // the End of the Line's: a marble column snapped off, its top lying beside it
    m.add(cyl(13, 15, 10, 12), { col: marble, pos: [0, 5, 0], surf: SURF.porcelain });
    m.add(cyl(9, 10, 70, 12), { col: marble, pos: [0, 45, 0], surf: SURF.porcelain });
    m.add(cone(10, 16, 7), { col: marble, pos: [2, 86, 1], rot: [0.3, 0, 0.4], surf: SURF.porcelain });
    m.add(cyl(9, 9, 60, 12), { col: marble, pos: [26, 9, 18], rot: [0, 0.7, Math.PI / 2], surf: SURF.porcelain });
  }),
  gt_lamp: (v) => B((m) => {
    // a platform gas lamp: a fluted iron post, a ladder bar, and a glazed lantern on top
    const col = v ? iron : greenIron;
    m.add(cyl(9, 11, 12, 10), { col, pos: [0, 6, 0], surf: SURF.iron });
    m.add(cyl(3.6, 4.6, 120, 10), { col, pos: [0, 70, 0], surf: SURF.iron });
    m.add(box(26, 2.4, 2.4), { col, pos: [0, 126, 0], surf: SURF.iron });
    m.add(lathe([[4, 0], [11, 8], [12, 26], [9, 30], [3, 36], [0, 40]], 6, 0), { col: 0x1a1a18, pos: [0, GT_LAMP_H - 18, 0], surf: SURF.iron });
    m.add(cyl(9.5, 7, 22, 6, true), { col: v ? 0x9ad8ff : GT.glass, pos: [0, GT_LAMP_H, 0], surf: SURF.bulb, emit: v ? 0.9 : 1.3 });
  }),
  gt_bench: () => B((m) => {
    // a platform bench: slatted teak on cast-iron ends with the railway's initials
    for (const s of [-1, 1]) {
      m.add(box(4, 30, 24), { col: greenIron, pos: [s * 40, 15, 0], surf: SURF.iron });
      m.add(torus(7, 1.6, 5, 10), { col: greenIron, pos: [s * 40, 22, 2], rot: [0, Math.PI / 2, 0], surf: SURF.iron });
    }
    for (let i = 0; i < 4; i++) m.add(box(86, 2.6, 5), { col: teak, pos: [0, 26, -8 + i * 6], surf: SURF.wood });
    for (let i = 0; i < 3; i++) m.add(box(86, 5, 2.6), { col: teak, pos: [0, 34 + i * 7, -12], rot: [-0.2, 0, 0], surf: SURF.wood });
  }),
  gt_clock: (v) => B((m) => {
    // the station clock on its post: a double-faced drum in a cast frame (its hands are drawn live)
    const col = v === 4 ? iron : greenIron;
    m.add(cyl(10, 13, 12, 10), { col, pos: [0, 6, 0], surf: SURF.iron });
    m.add(cyl(4.6, 5.4, 150, 10), { col, pos: [0, 80, 0], surf: SURF.iron });
    m.add(cyl(22, 22, 12, 24), { col, pos: [0, 168, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    for (const z of [-6.4, 6.4]) m.add(cyl(19, 19, 1, 24), { col: 0xf0e8d0, pos: [0, 168, z], rot: [Math.PI / 2, 0, 0], surf: SURF.porcelain, emit: v === 4 ? 0.2 : 0.55 });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      for (const z of [-7.1, 7.1]) m.add(box(1.2, k % 3 ? 2.6 : 4.6, 0.4), { col: 0x1a1612, pos: [Math.sin(a) * 15.5, 168 + Math.cos(a) * 15.5, z], rot: [0, 0, -a], surf: SURF.paint });
    }
    m.add(lathe([[3, 0], [8, 5], [4, 12], [0, 16]], 10, 3), { col: brass, pos: [0, 190, 0], surf: SURF.brass });
  }),
  gt_nameboard: (v) => B((m) => {
    // the station's enamel nameboard on two posts (the name itself is painted by the lighting module's labels)
    const face = [0xd8ccb0, 0x9aa49a, 0x8a5a3a, 0xc8d0c8, 0x2a2228][v] ?? 0xd8ccb0;
    for (const s of [-1, 1]) m.add(cyl(2.4, 2.8, 120, 8), { col: greenIron, pos: [s * 70, 60, 0], surf: SURF.iron });
    m.add(rbox(160, 30, 4, 2), { col: v === 4 ? 0x14100e : GT.green, pos: [0, 112, 0], surf: SURF.paint });
    m.add(box(150, 22, 1), { col: face, pos: [0, 112, 2.6], surf: SURF.porcelain, emit: 0.15 });
  }),
  gt_phantom: () => B((m) => {
    // a door frame standing on its own on the platform, its door ajar on nothing (lit when it opens)
    for (const s of [-1, 1]) m.add(box(8, 150, 10), { col: darkWood, pos: [s * 34, 75, 0], surf: SURF.wood });
    m.add(box(78, 10, 12), { col: darkWood, pos: [0, 152, 0], surf: SURF.wood });
    m.add(box(60, 140, 4), { col: weather(0x2a1e16, 0.35), pos: [-16, 72, 22], rot: [0, -1.1, 0], surf: SURF.wood });
    m.add(sphere(2, 6, 4), { col: PAL.brass, pos: [2, 70, 46], surf: SURF.brass });
    m.add(box(4, 2, 30), { col: 0x14100e, pos: [0, 1, 0], surf: SURF.wood });
  }),

  // ================================================================ Hollow Junction
  gt_board: () => B((m) => {
    // the departures board: a black-and-gilt frame of hinged name slats on two cast pillars
    for (const s of [-1, 1]) m.add(cyl(6, 7, 230, 10), { col: greenIron, pos: [s * 124, 115, 0], surf: SURF.iron });
    m.add(rbox(250, 120, 12, 3), { col: 0x14100e, pos: [0, 176, 0], surf: SURF.paint });
    m.add(box(256, 6, 16), { col: GT.gilt, pos: [0, 239, 0], surf: SURF.gold });
    for (let i = 0; i < 6; i++) m.add(box(230, 13, 1), { col: i === 5 ? 0x5a1a14 : 0x2a2622, pos: [0, 216 - i * 17, 6.6], surf: SURF.paint, emit: 0.1 });
    m.add(rbox(60, 20, 4, 3), { col: GT.gilt, pos: [0, 252, 0], surf: SURF.gold });
  }),
  gt_booking: () => B((m) => {
    // the booking office: a panelled kiosk with a frosted window, a brass grille and a lamp in it
    m.add(rbox(300, 150, 140, 4), { col: weather(GT.maroon, 0.4, 0.05), pos: [0, 75, 0], surf: SURF.wood });
    m.add(box(310, 10, 150), { col: darkWood, pos: [0, 154, 0], surf: SURF.wood });
    gable(m, 300, 140, 158, 40, slate, 10);
    m.add(box(90, 50, 2), { col: 0xffd08a, pos: [0, 95, 71], surf: SURF.bulb, emit: 1.1 });
    for (let i = 0; i < 7; i++) m.add(box(1.6, 50, 2), { col: PAL.brass, pos: [-40 + i * 13, 95, 72.4], surf: SURF.brass });
    m.add(box(110, 6, 14), { col: darkWood, pos: [0, 66, 76], surf: SURF.wood });
    m.add(rbox(120, 18, 2, 2), { col: GT.cream, pos: [0, 136, 71], surf: SURF.porcelain, emit: 0.15 });
  }, 0.4),
  gt_postbox: () => B((m) => {
    // a red pillar box
    m.add(cyl(13, 14, 70, 16), { col: weather(0x8a1410, 0.35, 0.05, 0x3a1410), pos: [0, 35, 0], surf: SURF.paint });
    m.add(sphere(13.5, 16, 8), { col: weather(0x8a1410, 0.35), pos: [0, 70, 0], scale: [1, 0.45, 1], surf: SURF.paint });
    m.add(box(14, 2.4, 2), { col: 0x0a0806, pos: [0, 56, 13.4], surf: SURF.paint });
    m.add(box(10, 7, 1), { col: GT.cream, pos: [0, 44, 13.6], surf: SURF.porcelain });
  }),
  gt_pillar: () => B((m) => {
    // the concourse's great iron pillars, ringed and capped, holding up nothing you can see
    m.add(cyl(24, 28, 16, 14), { col: greenIron, pos: [0, 8, 0], surf: SURF.iron });
    m.add(cyl(14, 16, 260, 14), { col: greenIron, pos: [0, 140, 0], surf: SURF.iron });
    for (const y of [60, 140, 220]) m.add(torus(15.5, 2.4, 6, 16), { col: GT.gilt, pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
    m.add(lathe([[14, 0], [26, 14], [30, 22], [20, 26]], 14, 4), { col: greenIron, pos: [0, 268, 0], surf: SURF.iron });
  }),
  gt_waitbench: () => B((m) => {
    // the waiting room's long benches, back to back
    for (const x of [-70, 0, 70]) m.add(box(4, 26, 28), { col: greenIron, pos: [x, 13, 0], surf: SURF.iron });
    for (let i = 0; i < 5; i++) m.add(box(160, 2.6, 5), { col: teak, pos: [0, 24, -12 + i * 6], surf: SURF.wood });
    m.add(box(160, 30, 4), { col: teak, pos: [0, 44, 0], surf: SURF.wood });
  }),
  gt_cart: (v) => B((m) => {
    // a porter's luggage barrow with its load
    m.add(box(100, 6, 48), { col: teak, pos: [0, 22, 0], surf: SURF.wood });
    for (const s of [-1, 1]) {
      m.add(cyl(12, 12, 4, 12), { col: iron, pos: [s * 36, 12, 26], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
      m.add(cyl(12, 12, 4, 12), { col: iron, pos: [s * 36, 12, -26], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    }
    m.add(cyl(1.6, 1.6, 40, 6), { col: iron, pos: [58, 40, 0], rot: [0, 0, 0.9], surf: SURF.iron });
    m.add(rbox(44, 24, 32, 3), { col: weather(v ? 0x2a3a4a : 0x5a3a1e, 0.4), pos: [-18, 37, 0], surf: SURF.wood });
    m.add(rbox(30, 18, 24, 3), { col: weather(0x4a2a2a, 0.4), pos: [22, 34, 4], surf: SURF.wood });
  }),
  gt_signalbox: () => B((m) => {
    // the signal box: brick base, a glazed cabin above with its lever frame lit inside, the lamp room door below
    m.add(box(240, 90, 200), { col: brick, pos: [0, 45, 0], surf: SURF.paint });
    m.add(box(250, 6, 210), { col: darkWood, pos: [0, 92, 0], surf: SURF.wood });
    m.add(box(240, 90, 200), { col: weather(GT.cream, 0.45, 0.05, 0x4a4438), pos: [0, 140, 0], surf: SURF.wood });
    windows(m, -110, 110, 146, 101, 6, 30, 52, [1, 2, 4], darkWood);
    gable(m, 240, 200, 186, 56, slate, 14);
    m.add(box(40, 70, 2), { col: 0x1a1210, pos: [0, 35, 101], surf: SURF.wood });
    m.add(box(48, 4, 2), { col: PAL.brass, pos: [0, 72, 102], surf: SURF.brass });
    // the lever frame's ends showing at the cabin window (east face)
    for (let i = 0; i < 5; i++) m.add(box(3, 30, 3), { col: i % 2 ? 0x8a1410 : 0x1a2a6a, pos: [121, 120, -76 + i * 38], surf: SURF.paint });
    // the stairs up its side
    for (let i = 0; i < 8; i++) m.add(box(30, 4, 14), { col: darkWood, pos: [-136, 10 + i * 12, -70 + i * 14], surf: SURF.wood });
  }, 0.4),
  gt_watertower: () => B((m) => {
    // the water tower: four iron legs, a riveted tank, the swing spout
    for (const [x, z] of [[-50, -50], [50, -50], [-50, 50], [50, 50]]) m.add(cyl(6, 8, 160, 8), { col: iron, pos: [x, 80, z], surf: SURF.iron });
    m.add(cyl(78, 78, 90, 22), { col: rust, pos: [0, 205, 0], surf: SURF.iron });
    for (const y of [168, 205, 242]) m.add(torus(78.5, 1.6, 4, 24), { col: 0x14100e, pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    m.add(cone(82, 30, 22), { col: slate, pos: [0, 265, 0], surf: SURF.paint });
    m.add(cyl(7, 7, 90, 8), { col: iron, pos: [0, 180, 80], rot: [0.9, 0, 0], surf: SURF.iron });
  }, 0.4),
  gt_fountain: () => B((m) => {
    // the forecourt's dry fountain: a stone basin, a cracked bowl, a winged figure holding a lamp
    m.add(cyl(110, 116, 26, 28), { col: paleStone, pos: [0, 13, 0], surf: SURF.paint });
    m.add(cyl(100, 100, 6, 28), { col: weather(0x1e2018, 0.4), pos: [0, 24, 0], surf: SURF.paint });
    m.add(cyl(12, 18, 60, 12), { col: paleStone, pos: [0, 54, 0], surf: SURF.paint });
    m.add(cyl(46, 24, 18, 20), { col: paleStone, pos: [0, 92, 0], surf: SURF.paint });
    m.add(cyl(8, 10, 50, 10), { col: paleStone, pos: [0, 126, 0], surf: SURF.paint });
    m.add(sphere(9, 12, 10), { col: paleStone, pos: [0, 158, 0], surf: SURF.paint });
    m.add(sphere(7, 10, 8), { col: GT.glass, pos: [0, 176, 6], surf: SURF.bulb, emit: 1.1 });
  }),
  gt_hearse: () => B((m) => {
    // a glass-sided hearse at the cab stand, black plumes, no horses
    m.add(rbox(220, 70, 80, 4), { col: weather(0x0e0c0e, 0.3), pos: [0, 70, 0], surf: SURF.paint });
    m.add(box(190, 50, 82), { col: 0x101418, pos: [0, 74, 0], surf: SURF.glass });
    m.add(rbox(140, 26, 50, 4), { col: weather(0x2a1610, 0.3), pos: [0, 62, 0], surf: SURF.wood });
    for (const [x, z] of [[-80, 40], [80, 40], [-80, -40], [80, -40]]) {
      m.add(torus(24, 3, 6, 18), { col: 0x14100e, pos: [x, 26, z], surf: SURF.wood });
      for (let k = 0; k < 6; k++) m.add(box(2, 46, 2), { col: 0x14100e, pos: [x, 26, z], rot: [0, 0, (k * Math.PI) / 6], surf: SURF.wood });
    }
    for (const x of [-100, -34, 34, 100]) m.add(cone(8, 34, 8), { col: 0x0a0a0c, pos: [x, 122, 0], surf: SURF.velvet });
    m.add(box(40, 4, 60), { col: 0x0e0c0e, pos: [140, 36, 0], surf: SURF.wood });
  }),
  gt_terminal: () => B((m) => {
    // Hollow Junction's terminal: soot-black brick between pale stone pilasters, a cornice, arched windows lit
    // within, the great doorway with its fanlight, and the clock tower over it
    m.add(box(1800, 190, 400), { col: sootBrick, pos: [0, 95, 0], surf: SURF.paint });
    for (let i = 0; i <= 12; i++) {
      const x = -900 + i * 150;
      m.add(box(26, 200, 14), { col: paleStone, pos: [x, 100, 203], surf: SURF.paint });
      m.add(box(34, 14, 18), { col: paleStone, pos: [x, 7, 203], surf: SURF.paint });
    }
    m.add(box(1830, 16, 22), { col: paleStone, pos: [0, 206, 204], surf: SURF.paint });
    m.add(box(1830, 8, 14), { col: paleStone, pos: [0, 64, 204], surf: SURF.paint });
    gable(m, 1800, 400, 214, 90, slate, 18);
    for (let i = 0; i < 12; i++) {
      if (i === 5 || i === 6) continue;
      const x = -825 + i * 150, lit = [1, 3, 8, 10].includes(i);
      m.add(box(64, 100, 3), { col: 0x14100e, pos: [x, 128, 202], surf: SURF.wood });
      m.add(cyl(32, 32, 3, 16, false), { col: 0x14100e, pos: [x, 178, 202], rot: [Math.PI / 2, 0, 0], surf: SURF.wood });
      m.add(box(54, 92, 1), { col: lit ? 0xffc070 : 0x101418, pos: [x, 128, 204], surf: lit ? SURF.bulb : SURF.glass, emit: lit ? 0.75 : 0 });
      m.add(box(3, 92, 2), { col: 0x14100e, pos: [x, 128, 205], surf: SURF.wood });
    }
    // the great doorway: an arch of stone, the doors ajar on warm light, the fanlight above
    m.add(box(250, 190, 26), { col: paleStone, pos: [0, 95, 210], surf: SURF.paint });
    m.add(box(190, 160, 4), { col: 0xffb860, pos: [0, 80, 224], surf: SURF.bulb, emit: 0.9 });
    m.add(cyl(95, 95, 4, 20, false), { col: 0xffd090, pos: [0, 160, 224], rot: [Math.PI / 2, 0, 0], surf: SURF.bulb, emit: 0.8 });
    for (let i = 0; i < 7; i++) m.add(box(3, 90, 4), { col: 0x1a1210, pos: [0, 200, 226], rot: [0, 0, (i - 3) * 0.42], surf: SURF.wood });
    for (const s of [-1, 1]) m.add(box(70, 150, 6), { col: weather(0x3a1a12, 0.35), pos: [s * 70, 76, 228], rot: [0, s * 0.5, 0], surf: SURF.wood });
    // the clock tower above the arch, its face lit
    m.add(box(160, 260, 160), { col: sootBrick, pos: [0, 340, -60], surf: SURF.paint });
    m.add(cyl(56, 56, 6, 28), { col: 0xf0e8c8, pos: [0, 400, 22], rot: [Math.PI / 2, 0, 0], surf: SURF.porcelain, emit: 0.9 });
    m.add(torus(57, 4, 6, 28), { col: GT.gilt, pos: [0, 400, 23], surf: SURF.gold });
    m.add(cone(120, 120, 4), { col: slate, pos: [0, 530, -60], rot: [0, Math.PI / 4, 0], surf: SURF.paint });
    m.add(box(900, 4, 30), { col: GT.gilt, pos: [0, 196, 205], surf: SURF.gold });
  }, 0.4),
  gt_parcels: () => B((m) => {
    // the parcels office and the dark goods shed
    m.add(box(600, 180, 480), { col: brick, pos: [0, 90, 0], surf: SURF.paint });
    gable(m, 600, 480, 180, 100, slate, 14);
    windows(m, -260, 260, 100, 241, 5, 48, 80, [2], 0x1a1210);
    m.add(box(140, 130, 3), { col: 0x14100e, pos: [180, 65, 241], surf: SURF.wood });
  }, 0.4),
  gt_hotel: () => B((m) => {
    // the railway hotel: three storeys, a few lit rooms where nobody is staying
    m.add(box(600, 300, 480), { col: weather(0x3a2c26, 0.45, 0.05), pos: [0, 150, 0], surf: SURF.paint });
    for (const y of [70, 160, 250]) windows(m, -270, 270, y, 241, 6, 40, 60, y === 160 ? [1, 4] : y === 250 ? [3] : [0], 0x1a1210);
    gable(m, 600, 480, 300, 80, slate, 14);
    m.add(box(260, 26, 4), { col: GT.cream, pos: [0, 284, 243], surf: SURF.porcelain, emit: 0.2 });
  }, 0.4),
  gt_lamppost: (v) => B((m) => {
    // a street lamp: v0 the Junction's (double lanterns), v1 the churchyard's, v2 the village's, v3 the End's (cold)
    const col = v === 1 ? iron : v === 3 ? weather(0x2a2a30, 0.4) : greenIron;
    m.add(cyl(9, 12, 14, 10), { col, pos: [0, 7, 0], surf: SURF.iron });
    m.add(cyl(3.4, 4.4, 136, 10), { col, pos: [0, 80, 0], surf: SURF.iron });
    const heads = v === 0 ? [-18, 18] : [0];
    if (v === 0) m.add(box(46, 3, 3), { col, pos: [0, 148, 0], surf: SURF.iron });
    for (const x of heads) {
      m.add(lathe([[4, 0], [10, 6], [11, 22], [8, 26], [2, 32], [0, 36]], 6, 0), { col: 0x14140f, pos: [x, GT_LAMPPOST_H - 14, 0], surf: SURF.iron });
      m.add(cyl(8.5, 6.4, 18, 6, true), { col: v === 3 ? 0xa8d8ff : v === 1 ? 0xd0ffd0 : GT.glass, pos: [x, GT_LAMPPOST_H, 0], surf: SURF.bulb, emit: v === 3 ? 0.9 : 1.25 });
    }
  }),
  gt_luggage_pile: (v) => B((m) => {
    // luggage nobody claimed
    m.add(rbox(60, 30, 44, 3), { col: weather(v ? 0x2a3a4a : 0x5a3a1e, 0.45), pos: [0, 15, 0], surf: SURF.wood });
    m.add(rbox(40, 22, 30, 3), { col: weather(0x4a2a2a, 0.45), pos: [-6, 41, 4], rot: [0, 0.4, 0], surf: SURF.wood });
    m.add(cyl(10, 10, 14, 12), { col: v ? 0x2a4a3a : 0x6a2a3a, pos: [16, 59, -4], surf: SURF.canvas });
    m.add(box(9, 6, 0.6), { col: 0xd8c8a0, pos: [10, 18, 22.4], surf: SURF.paint });
  }),

  // ================================================================ Saint Vesper's Halt
  gt_shelter: () => B((m) => {
    // the halt's timber shelter: a lean-to roof on posts, a bench, a notice board, an oil lamp
    for (const x of [-140, -46, 46, 140]) m.add(box(8, 140, 8), { col: darkWood, pos: [x, 70, 26], surf: SURF.wood });
    m.add(box(300, 120, 8), { col: weather(0x3a3428, 0.45), pos: [0, 60, -30], surf: SURF.wood });
    const roof = extrude([[-40, 0], [40, 0], [40, 6], [-40, 26]], 320, 0);
    roof.rotateY(Math.PI / 2);
    roof.translate(-160, 140, 0);
    m.add(roof, { col: slate, surf: SURF.paint, flat: true });
    for (let i = 0; i < 4; i++) m.add(box(250, 2.4, 5), { col: teak, pos: [0, 26, -14 + i * 6], surf: SURF.wood });
    m.add(box(60, 40, 2), { col: 0xc8c0a8, pos: [80, 80, -25], surf: SURF.paint });
    m.add(sphere(6, 8, 6), { col: GT.glass, pos: [0, 128, 20], surf: SURF.bulb, emit: 1.2 });
  }),
  gt_railing: () => B((m) => {
    // the churchyard's iron railing: spear-topped bars every few units along a 100-long run
    m.add(box(100, 3, 3), { col: iron, pos: [0, 10, 0], surf: SURF.iron });
    m.add(box(100, 3, 3), { col: iron, pos: [0, 62, 0], surf: SURF.iron });
    for (let i = 0; i < 10; i++) {
      m.add(cyl(1.2, 1.2, 70, 5), { col: iron, pos: [-45 + i * 10, 36, 0], surf: SURF.iron });
      m.add(cone(2.2, 6, 4), { col: iron, pos: [-45 + i * 10, 74, 0], surf: SURF.iron });
    }
  }, 0.1),
  gt_headstone: (v) => B((m) => {
    // headstones: rounded, cross-topped, an obelisk, a broken one, an angel-winged one
    const col = v % 2 ? stone : paleStone;
    if (v === 0) {
      m.add(rbox(34, 48, 10, 4), { col, pos: [0, 24, 0], surf: SURF.paint });
      m.add(cyl(17, 17, 10, 16, false), { col, pos: [0, 48, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.paint });
    } else if (v === 1) {
      m.add(box(10, 70, 9), { col, pos: [0, 35, 0], surf: SURF.paint });
      m.add(box(40, 10, 9), { col, pos: [0, 50, 0], surf: SURF.paint });
      m.add(box(26, 10, 20), { col, pos: [0, 5, 0], surf: SURF.paint });
    } else if (v === 2) {
      m.add(box(22, 12, 22), { col, pos: [0, 6, 0], surf: SURF.paint });
      m.add(cyl(5, 9, 70, 4), { col, pos: [0, 47, 0], rot: [0, Math.PI / 4, 0], surf: SURF.paint });
      m.add(cone(6, 10, 4), { col, pos: [0, 87, 0], rot: [0, Math.PI / 4, 0], surf: SURF.paint });
    } else if (v === 3) {
      m.add(rbox(34, 26, 10, 3), { col, pos: [0, 13, 0], rot: [0, 0, 0.1], surf: SURF.paint });
      m.add(rbox(30, 20, 9, 3), { col, pos: [10, 4, 16], rot: [-1.3, 0.4, 0], surf: SURF.paint });
    } else {
      m.add(rbox(36, 40, 10, 4), { col, pos: [0, 20, 0], surf: SURF.paint });
      for (const s of [-1, 1]) m.add(ellipsoid(14, 8, 3, 8, 6), { col, pos: [s * 12, 44, 0], rot: [0, 0, s * 0.5], surf: SURF.paint });
    }
    m.add(ellipsoid(16, 2, 12, 8, 4), { col: weather(GT.moss, 0.5), pos: [0, 1, 8], surf: SURF.cloth });
  }, 0.4),
  gt_mausoleum: (v) => B((m) => {
    // a family tomb: steps, a portico of two columns, an iron gate, a pediment, moss
    m.add(box(184, 12, 148), { col: stone, pos: [0, 6, 0], surf: SURF.paint });
    m.add(box(150, 120, 120), { col: v ? stone : paleStone, pos: [0, 72, -8], surf: SURF.paint });
    for (const s of [-1, 1]) m.add(cyl(9, 10, 120, 12), { col: paleStone, pos: [s * 58, 72, 60], surf: SURF.paint });
    m.add(box(170, 14, 140), { col: paleStone, pos: [0, 138, 0], surf: SURF.paint });
    const ped = extrude([[-85, 0], [85, 0], [0, 40]], 150, 0);
    ped.translate(0, 145, -75);
    m.add(ped, { col: v ? stone : paleStone, surf: SURF.paint, flat: true });
    for (let i = 0; i < 6; i++) m.add(cyl(1.4, 1.4, 90, 5), { col: iron, pos: [-30 + i * 12, 57, 52], surf: SURF.iron });
    m.add(sphere(5, 8, 6), { col: 0x9ad8a0, pos: [0, 70, 30], surf: SURF.bulb, emit: 0.9 });
  }, 0.4),
  gt_angel: () => B((m) => {
    // a weeping angel on a plinth, its face in its hands
    m.add(box(52, 40, 52), { col: stone, pos: [0, 20, 0], surf: SURF.paint });
    m.add(lathe([[0, 0], [16, 0], [14, 30], [11, 60], [8, 72], [0, 74]], 14, 6), { col: paleStone, pos: [0, 40, 0], surf: SURF.paint });
    m.add(sphere(8, 12, 10), { col: paleStone, pos: [0, 122, 4], surf: SURF.paint });
    for (const s of [-1, 1]) {
      m.add(ellipsoid(8, 34, 22, 10, 8), { col: paleStone, pos: [s * 14, 112, -14], rot: [0.3, s * 0.4, s * 0.3], surf: SURF.paint });
      m.add(cyl(3, 3, 26, 6), { col: paleStone, pos: [s * 5, 108, 10], rot: [-0.9, 0, s * 0.3], surf: SURF.paint });
    }
  }),
  gt_yew: () => B((m) => {
    // a churchyard yew: a black-green mass on a twisted trunk
    m.add(cyl(10, 16, 70, 8), { col: weather(0x2a1e16, 0.5), pos: [0, 35, 0], surf: SURF.wood });
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      m.add(ellipsoid(44 - i * 3, 50, 44 - i * 3, 10, 8), { col: weather(0x14201a, 0.4, 0.1, 0x0a1410), pos: [Math.cos(a) * 18, 100 + i * 20, Math.sin(a) * 16], surf: SURF.cloth });
    }
  }, 0.5),
  gt_chapel: () => B((m) => {
    // Saint Vesper's chapel: grey stone, a slate roof, a lancet window glowing, the belfry over the porch
    m.add(box(460, 220, 420), { col: stone, pos: [0, 110, 0], surf: SURF.paint });
    gable(m, 460, 420, 220, 150, slate, 14);
    m.add(box(140, 160, 40), { col: paleStone, pos: [0, 80, 226], surf: SURF.paint });
    m.add(box(60, 110, 2), { col: 0x14100e, pos: [0, 55, 247], surf: SURF.wood });
    for (const x of [-170, 170]) {
      m.add(box(40, 120, 2), { col: 0xc8a8ff, pos: [x, 120, 211], surf: SURF.bulb, emit: 0.7 });
      m.add(box(4, 120, 3), { col: 0x14100e, pos: [x, 120, 212], surf: SURF.wood });
    }
    // the belfry and its three bells
    m.add(box(150, 140, 120), { col: stone, pos: [0, 300, 140], surf: SURF.paint });
    for (const x of [-40, 0, 40]) m.add(cone(14, 22, 12), { col: PAL.brass, pos: [x, 312, 200], surf: SURF.brass });
    m.add(cone(100, 120, 4), { col: slate, pos: [0, 420, 140], rot: [0, Math.PI / 4, 0], surf: SURF.paint });
    // the three bell ropes hanging down to the porch
    for (const x of [-120, 0, 120]) m.add(cyl(1.6, 1.6, 230, 5), { col: 0x8a7a58, pos: [x, 125, 244], surf: SURF.cloth });
  }, 0.4),
  gt_gate: (v) => B((m) => {
    // a station's south gate (D-84), shut and chained, in its own make: the Junction's green-painted iron between
    // lamp-topped stone piers, Vesper's arched churchyard gate, the Works' riveted sheet-iron yard gate,
    // Stillwater's five-bar field gate between stone posts
    const low = v === 3;
    for (const s of [-1, 1]) {
      m.add(box(30, low ? 104 : 150, 30), { col: v === 0 ? paleStone : low ? stone : brick, pos: [s * 98, low ? 52 : 75, 0], surf: SURF.paint });
      m.add(box(38, 10, 38), { col: v === 2 ? slate : paleStone, pos: [s * 98, low ? 109 : 155, 0], surf: SURF.paint });
      if (v === 0) {
        m.add(cyl(2, 2, 16, 6), { col: greenIron, pos: [s * 98, 168, 0], surf: SURF.iron });
        m.add(sphere(9, 10, 8), { col: GT.glass, pos: [s * 98, 182, 0], surf: SURF.bulb, emit: 1.1 });
      }
      if (v === 1) {
        m.add(box(6, 32, 6), { col: paleStone, pos: [s * 98, 176, 0], surf: SURF.paint });
        m.add(box(20, 6, 6), { col: paleStone, pos: [s * 98, 182, 0], surf: SURF.paint });
      }
    }
    if (v === 2) {
      for (const s of [-1, 1]) {
        m.add(box(80, 120, 4), { col: rust, pos: [s * 41, 66, 0], surf: SURF.iron });
        for (const y of [20, 112]) m.add(box(80, 6, 6), { col: iron, pos: [s * 41, y, 2], surf: SURF.iron });
        m.add(box(6, 118, 5), { col: iron, pos: [s * 41, 66, 2.5], rot: [0, 0, s * 0.6], surf: SURF.iron });
        for (let i = 0; i < 6; i++) m.add(sphere(1.6, 4, 3), { col: iron, pos: [s * (10 + i * 12), 112, 5], surf: SURF.iron });
      }
      // an enamel plate: a red bar on cream (KEEP OUT)
      m.add(box(44, 24, 2), { col: GT.cream, pos: [-41, 82, 3], surf: SURF.porcelain });
      m.add(box(36, 5, 2.4), { col: 0x8a1410, pos: [-41, 82, 3.2], surf: SURF.paint });
    } else if (low) {
      for (const x of [-80, 80]) m.add(box(8, 92, 7), { col: darkWood, pos: [x, 50, 0], surf: SURF.wood });
      for (let i = 0; i < 5; i++) m.add(box(166, 6, 5), { col: weather(0x5a4a36, 0.45, 0.06), pos: [0, 18 + i * 17, 0], surf: SURF.wood });
      m.add(box(178, 6, 5), { col: weather(0x5a4a36, 0.45, 0.06), pos: [0, 52, 3], rot: [0, 0, 0.4], surf: SURF.wood });
    } else {
      const col = v === 0 ? greenIron : iron;
      for (const s of [-1, 1]) {
        for (const y of [16, 104]) m.add(box(80, 5, 5), { col, pos: [s * 41, y, 0], surf: SURF.iron });
        for (let i = 0; i < 8; i++) {
          const x = s * (6 + i * 10);
          // Vesper's gate rises to an arch where its leaves meet
          const top = v === 1 ? 118 + Math.cos(((i + 0.5) / 8) * (Math.PI / 2)) * 22 : 124;
          m.add(cyl(1.4, 1.4, top - 10, 5), { col, pos: [x, 10 + (top - 10) / 2, 0], surf: SURF.iron });
          m.add(cone(2.6, 7, 4), { col, pos: [x, top + 3, 0], surf: SURF.iron });
        }
        if (v === 0) m.add(torus(15, 1.6, 5, 16), { col: GT.gilt, pos: [s * 41, 60, 2], surf: SURF.gold });
      }
      if (v === 1) {
        m.add(box(4, 28, 3), { col, pos: [0, 150, 1], surf: SURF.iron });
        m.add(box(16, 4, 3), { col, pos: [0, 154, 1], surf: SURF.iron });
      }
    }
    // the chain and padlock where the leaves meet
    for (let k = 0; k < 5; k++) m.add(torus(3.6, 1, 4, 8), { col: iron, pos: [0, 74 - k * 6, 6], rot: [0, k % 2 ? Math.PI / 2 : 0, 0], surf: SURF.iron });
    m.add(rbox(10, 12, 5, 1.5), { col: brass, pos: [0, 40, 6], surf: SURF.brass });
  }, 0.25),
  gt_lychgate: () => B((m) => {
    // the lych gate: a little roofed gateway over the path through the railing
    for (const s of [-1, 1]) m.add(box(12, 120, 12), { col: darkWood, pos: [s * 90, 60, 0], surf: SURF.wood });
    gable(m, 200, 70, 120, 50, slate, 10);
    m.add(box(190, 10, 14), { col: darkWood, pos: [0, 118, 0], surf: SURF.wood });
  }),

  // ================================================================ the Cinder Works
  gt_chute: () => B((m) => {
    // the coal chute: a riveted hopper on legs, its spout over the platform edge, a shovel leaning on it
    for (const [x, z] of [[-36, -26], [36, -26], [-36, 26], [36, 26]]) m.add(cyl(4, 5, 80, 8), { col: iron, pos: [x, 40, z], surf: SURF.iron });
    m.add(cyl(56, 30, 60, 4), { col: rust, pos: [0, 110, 0], rot: [0, Math.PI / 4, 0], surf: SURF.iron });
    m.add(ellipsoid(40, 12, 40, 10, 6), { col: coalCol, pos: [0, 136, 0], surf: SURF.rubber });
    m.add(box(26, 8, 70), { col: rust, pos: [0, 70, -40], rot: [0.5, 0, 0], surf: SURF.iron });
    m.add(cyl(1.4, 1.4, 70, 6), { col: weather(0x4a3a28, 0.4), pos: [44, 36, 24], rot: [0, 0, 0.4], surf: SURF.wood });
    m.add(rbox(14, 2, 18, 1), { col: PAL.iron, pos: [58, 4, 24], surf: SURF.iron });
  }),
  gt_furnace: (v) => B((m) => {
    // a blast furnace: a brick-lined iron stack, banded, its tap hole glowing, a charging ramp
    m.add(cyl(150, 160, 60, 24), { col: sootBrick, pos: [0, 30, 0], surf: SURF.paint });
    m.add(cyl(110, 140, 260, 22), { col: rust, pos: [0, 190, 0], surf: SURF.iron });
    for (const y of [100, 160, 220, 280]) m.add(torus(126 - (y - 100) * 0.1, 3, 6, 24), { col: 0x14100e, pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    m.add(cyl(70, 100, 40, 20), { col: iron, pos: [0, 340, 0], surf: SURF.iron });
    m.add(box(60, 40, 6), { col: 0xff6a18, pos: [0, 40, 156], surf: SURF.bulb, emit: 2.2 });
    m.add(box(80, 60, 20), { col: sootBrick, pos: [0, 40, 148], surf: SURF.paint });
    m.add(box(40, 30, 2), { col: 0xff8a30, pos: [0, 40, 160], surf: SURF.bulb, emit: 2.6 });
    m.add(box(60, 10, 300), { col: iron, pos: [v ? 150 : -150, 160, 0], rot: [0.5, 0, 0], surf: SURF.iron });
  }, 0.45),
  gt_chimney: () => B((m) => {
    // a works chimney: tall, tapering brick with a band near the top, smoke from it
    m.add(box(110, 40, 110), { col: sootBrick, pos: [0, 20, 0], surf: SURF.paint });
    m.add(cyl(30, 50, 520, 14), { col: brick, pos: [0, 300, 0], surf: SURF.paint });
    m.add(cyl(36, 36, 20, 14), { col: sootBrick, pos: [0, 540, 0], surf: SURF.paint });
    m.add(cyl(26, 26, 4, 14), { col: 0xff6a18, pos: [0, 552, 0], surf: SURF.bulb, emit: 1.4 });
  }, 0.45),
  gt_slagheap: () => B((m) => {
    // a slag heap, still warm inside: cracks of orange in the black
    const slag: ColorFn = (p) => (vnoise(p.x * 0.05, p.y * 0.05, p.z * 0.05) > 0.72 ? C(0xff6a18).multiplyScalar(1.3) : C(0x1a1612).lerp(C(0x3a2e26), vnoise(p.x * 0.02, p.y * 0.02, p.z * 0.02)));
    m.add(ellipsoid(110, 70, 110, 16, 10), { col: slag, pos: [0, 0, 0], surf: SURF.rubber, emit: 0.6 });
    m.add(ellipsoid(60, 50, 60, 12, 8), { col: slag, pos: [20, 50, -10], surf: SURF.rubber, emit: 0.6 });
  }, 0.5),
  gt_cokeovens: (v) => B((m) => {
    // a battery of coke ovens: a long brick block with arched doors glowing, pipes along the top
    m.add(box(600, 100, 124), { col: sootBrick, pos: [0, 50, 0], surf: SURF.paint });
    for (let i = 0; i < 8; i++) {
      const x = -262 + i * 75;
      m.add(box(44, 56, 2), { col: i % (v ? 3 : 2) ? 0xff5a10 : 0x1a1210, pos: [x, 36, 63], surf: SURF.bulb, emit: i % (v ? 3 : 2) ? 1.6 : 0 });
      m.add(box(52, 6, 4), { col: iron, pos: [x, 68, 63], surf: SURF.iron });
    }
    m.add(cyl(10, 10, 600, 10), { col: rust, pos: [0, 112, -30], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
  }, 0.4),
  gt_minecart: (v) => B((m) => {
    // a tub wagon on a short length of rail, full of coal or slag
    for (const s of [-1, 1]) m.add(box(100, 4, 4), { col: 0x5a5856, pos: [0, 2, s * 14], surf: SURF.iron });
    for (let i = 0; i < 4; i++) m.add(box(6, 3, 40), { col: darkWood, pos: [-36 + i * 24, 1, 0], surf: SURF.wood });
    m.add(cyl(30, 24, 32, 4), { col: rust, pos: [0, 28, 0], rot: [0, Math.PI / 4, 0], scale: [1.1, 1, 0.75], surf: SURF.iron });
    m.add(ellipsoid(28, 8, 20, 10, 6), { col: v ? C(0x3a2e26) : coalCol, pos: [0, 44, 0], surf: SURF.rubber });
    for (const x of [-18, 18]) for (const s of [-1, 1]) m.add(cyl(8, 8, 4, 10), { col: iron, pos: [x, 10, s * 15], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
  }),
  gt_gantryleg: () => B((m) => {
    m.add(box(26, 300, 26), { col: rust, pos: [0, 150, 0], surf: SURF.iron });
    for (let i = 0; i < 6; i++) m.add(box(28, 3, 28), { col: 0x14100e, pos: [0, 30 + i * 50, 0], surf: SURF.iron });
  }),
  gt_gantry: () => B((m) => {
    // the gantry crane's bridge across its four legs, the hook hanging down (decorative)
    for (const z of [-210, 210]) m.add(box(560, 26, 20), { col: rust, pos: [0, 300, z], surf: SURF.iron });
    for (const x of [-250, 250]) m.add(box(20, 26, 440), { col: rust, pos: [x, 300, 0], surf: SURF.iron });
    m.add(box(80, 40, 440), { col: iron, pos: [40, 330, 0], surf: SURF.iron });
    m.add(cyl(1.4, 1.4, 180, 5), { col: 0x5a5856, pos: [40, 220, 0], surf: SURF.iron });
    m.add(torus(14, 3.6, 6, 12, Math.PI * 1.4), { col: iron, pos: [40, 124, 0], rot: [0, 0, Math.PI * 0.7], surf: SURF.iron });
  }, 0.2),
  gt_headframe: () => B((m) => {
    // a pit-head winding frame: an A-frame of riveted girders, the great sheave wheel at its top, the engine house
    m.add(box(180, 90, 140), { col: sootBrick, pos: [0, 45, 0], surf: SURF.paint });
    gable(m, 180, 140, 90, 40, slate, 8);
    for (const s of [-1, 1]) {
      m.add(box(12, 280, 12), { col: rust, pos: [s * 60, 140, -40], rot: [0, 0, s * 0.2], surf: SURF.iron });
      m.add(box(12, 300, 12), { col: rust, pos: [s * 40, 150, 50], rot: [-0.32, 0, s * 0.12], surf: SURF.iron });
    }
    for (let k = 0; k < 4; k++) m.add(box(130 - k * 18, 8, 8), { col: rust, pos: [0, 60 + k * 60, -40], surf: SURF.iron });
    m.add(torus(44, 4, 6, 24), { col: iron, pos: [0, 286, -30], surf: SURF.iron });
    for (let k = 0; k < 6; k++) m.add(box(4, 84, 4), { col: iron, pos: [0, 286, -30], rot: [0, 0, (k * Math.PI) / 6], surf: SURF.iron });
    m.add(box(60, 34, 2), { col: 0xff9a40, pos: [0, 50, 71], surf: SURF.bulb, emit: 1.1 });
  }, 0.35),
  gt_pipe: () => B((m) => {
    // a run of steam pipe on trestles (a unit 100 long along X; the world stretches it)
    m.add(cyl(13, 13, 100, 12), { col: rust, pos: [0, 40, 0], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
    m.add(torus(13.5, 2, 4, 12), { col: 0x14100e, pos: [0, 40, 0], rot: [0, Math.PI / 2, 0], surf: SURF.iron });
    for (const x of [-40, 40]) m.add(box(6, 28, 30), { col: iron, pos: [x, 14, 0], surf: SURF.iron });
  }, 0.2),
  gt_brazier: () => B((m) => {
    // a works brazier on three legs, coals glowing
    for (let k = 0; k < 3; k++) m.add(cyl(1.6, 1.6, 40, 5), { col: iron, pos: [Math.cos(k * 2.1) * 10, 20, Math.sin(k * 2.1) * 10], rot: [Math.sin(k * 2.1) * 0.3, 0, -Math.cos(k * 2.1) * 0.3], surf: SURF.iron });
    m.add(cyl(18, 12, 18, 10, true), { col: rust, pos: [0, 44, 0], surf: SURF.iron });
    m.add(ellipsoid(15, 6, 15, 10, 6), { col: 0xff6a18, pos: [0, 50, 0], surf: SURF.bulb, emit: 2.2 });
  }),

  // ================================================================ Stillwater
  gt_stationhouse: () => B((m) => {
    // the village halt's station house: whitewashed, a slate roof, a porch lamp, a stopped clock over the door
    m.add(box(340, 130, 140), { col: whitewash, pos: [0, 65, 0], surf: SURF.paint });
    gable(m, 340, 140, 130, 70, slate, 14);
    windows(m, -150, -30, 76, 71, 2, 36, 56, [0], darkWood);
    windows(m, 30, 150, 76, 71, 2, 36, 56, [1], darkWood);
    m.add(box(50, 96, 2), { col: darkWood, pos: [0, 48, 71], surf: SURF.wood });
    m.add(cyl(14, 14, 2, 18), { col: 0xf0e8c8, pos: [0, 116, 72], rot: [Math.PI / 2, 0, 0], surf: SURF.porcelain, emit: 0.4 });
    m.add(sphere(6, 8, 6), { col: GT.glass, pos: [40, 104, 78], surf: SURF.bulb, emit: 1.2 });
  }, 0.4),
  gt_church: () => B((m) => {
    // Stillwater's church: a squat nave and a tall square tower whose clock face is on its north face
    m.add(box(500, 200, 500), { col: paleStone, pos: [0, 100, 0], surf: SURF.paint });
    gable(m, 500, 500, 200, 140, slate, 14);
    m.add(box(200, 420, 200), { col: paleStone, pos: [0, 210, -140], surf: SURF.paint });
    for (const [x, z] of [[-100, -240], [100, -240], [-100, -40], [100, -40]]) m.add(cone(14, 50, 6), { col: paleStone, pos: [x, 445, z], surf: SURF.paint });
    // the clock face high on the tower, above the nave's ridge (its hands are drawn live: Mira's hour)
    m.add(cyl(62, 62, 6, 28), { col: 0xf0e8c8, pos: [0, CHURCH_FACE.h, CHURCH_FACE.z], rot: [Math.PI / 2, 0, 0], surf: SURF.porcelain, emit: 0.7 });
    m.add(torus(63, 4, 6, 28), { col: GT.gilt, pos: [0, CHURCH_FACE.h, CHURCH_FACE.z + 1], surf: SURF.gold });
    for (const x of [-180, 180]) m.add(box(40, 110, 2), { col: 0xffc878, pos: [x, 110, 251], surf: SURF.bulb, emit: 0.6 });
    m.add(box(70, 110, 2), { col: 0x14100e, pos: [0, 55, 251], surf: SURF.wood });
  }, 0.4),
  gt_pond: () => B((m) => {
    // the still pond: a mirror of black water with reeds round its edge (the water itself is in the floor)
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, r = 240 + (i % 3) * 8;
      m.add(cyl(1.2, 0.6, 40 + (i % 4) * 8, 4), { col: weather(0x3a4024, 0.4), pos: [Math.cos(a) * r, 18, Math.sin(a) * r], rot: [(i % 3) * 0.1, 0, (i % 5) * 0.06], surf: SURF.cloth });
    }
    m.add(cyl(250, 252, 4, 40, true), { col: stone, pos: [0, 1, 0], surf: SURF.paint });
  }, 0.1),
  gt_well: () => B((m) => {
    m.add(cyl(26, 28, 40, 16), { col: paleStone, pos: [0, 20, 0], surf: SURF.paint });
    m.add(cyl(20, 20, 4, 16), { col: 0x0a0c10, pos: [0, 38, 0], surf: SURF.glass });
    for (const s of [-1, 1]) m.add(box(5, 70, 5), { col: darkWood, pos: [s * 24, 70, 0], surf: SURF.wood });
    gable(m, 50, 60, 104, 26, slate, 6);
    m.add(cyl(5, 5, 44, 8), { col: darkWood, pos: [0, 92, 0], rot: [0, 0, Math.PI / 2], surf: SURF.wood });
  }),
  gt_marketcross: () => B((m) => {
    for (let i = 0; i < 3; i++) m.add(box(70 - i * 18, 10, 70 - i * 18), { col: paleStone, pos: [0, 5 + i * 10, 0], surf: SURF.paint });
    m.add(cyl(6, 8, 110, 8), { col: paleStone, pos: [0, 85, 0], surf: SURF.paint });
    m.add(box(34, 8, 8), { col: paleStone, pos: [0, 128, 0], surf: SURF.paint });
    m.add(box(8, 30, 8), { col: paleStone, pos: [0, 136, 0], surf: SURF.paint });
  }),
  gt_cottage: (v) => B((m) => {
    // a village cottage: whitewash or stone, slate or thatch, a lamp in one window, a chimney
    const wall = v === 1 ? paleStone : whitewash;
    m.add(box(240, 110, 184), { col: wall, pos: [0, 55, 0], surf: SURF.paint });
    gable(m, 240, 184, 110, 80, v === 2 ? weather(0x5a4a30, 0.5, 0.1) : slate, 16);
    windows(m, -100, 100, 64, 93, 3, 30, 40, v === 0 ? [0] : v === 1 ? [2] : [], darkWood);
    m.add(box(36, 80, 2), { col: darkWood, pos: [70, 40, 93], surf: SURF.wood });
    m.add(box(30, 70, 30), { col: v === 1 ? stone : brick, pos: [-80, 170, -20], surf: SURF.paint });
  }, 0.4),
  gt_picket: () => B((m) => {
    // a white picket fence (a run 100 long; the world stretches it)
    m.add(box(100, 4, 3), { col: whitewash, pos: [0, 20, 0], surf: SURF.paint });
    m.add(box(100, 4, 3), { col: whitewash, pos: [0, 38, 0], surf: SURF.paint });
    for (let i = 0; i < 9; i++) {
      m.add(box(7, 50, 2.4), { col: whitewash, pos: [-44 + i * 11, 25, 0], surf: SURF.paint });
      m.add(cone(5, 6, 4), { col: whitewash, pos: [-44 + i * 11, 53, 0], rot: [0, Math.PI / 4, 0], surf: SURF.paint });
    }
  }, 0.1),
  gt_drystone: () => B((m) => {
    // Stillwater's bounds (D-84): a low dry-stone wall of field stone, mossed along its top (a run 100 long)
    m.add(rbox(100, 36, 26, 4), { col: stone, pos: [0, 18, 0], surf: SURF.paint });
    for (let i = 0; i < 7; i++) m.add(rbox(12, 12 + (i % 3) * 2, 22, 2), { col: i % 2 ? paleStone : stone, pos: [-42 + i * 14, 41 + (i % 3), 0], rot: [0, 0, i % 2 ? 0.12 : -0.1], surf: SURF.paint });
    m.add(box(100, 3, 27), { col: weather(GT.moss, 0.45, 0.1), pos: [0, 35, 0], surf: SURF.cloth });
  }, 0.3),
  gt_yardwall: () => B((m) => {
    // the Works' yard wall (D-84): soot-black brick under a coping of blue engineering brick, spikes along the top
    m.add(box(100, 90, 16), { col: sootBrick, pos: [0, 45, 0], surf: SURF.paint });
    m.add(box(100, 6, 20), { col: slate, pos: [0, 93, 0], surf: SURF.paint });
    m.add(box(16, 104, 22), { col: brick, pos: [-50, 52, 0], surf: SURF.paint });
    for (let i = 0; i < 8; i++) m.add(cone(1.6, 10, 4), { col: iron, pos: [-42 + i * 12, 101, 0], surf: SURF.iron });
  }, 0.3),
  gt_willow: () => B((m) => {
    // a weeping willow over the lane, its strands hanging to the ground
    m.add(cyl(12, 18, 110, 8), { col: weather(0x2a2218, 0.5), pos: [0, 55, 0], surf: SURF.wood });
    m.add(ellipsoid(80, 60, 80, 12, 8), { col: weather(0x26301e, 0.4, 0.1), pos: [0, 150, 0], surf: SURF.cloth });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      m.add(cyl(6, 3, 120, 5), { col: weather(0x2a3420, 0.4), pos: [Math.cos(a) * 70, 90, Math.sin(a) * 70], rot: [Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15], surf: SURF.cloth });
    }
  }, 0.5),

  // ================================================================ the End of the Line
  gt_barrier: () => B((m) => {
    // the ticket barrier: brass-railed turnstile panels (a run 100 long; the world stretches it)
    m.add(box(100, 50, 6), { col: weather(0x2a1a12, 0.35), pos: [0, 25, 0], surf: SURF.wood });
    m.add(box(100, 4, 10), { col: brass, pos: [0, 52, 0], surf: SURF.brass });
    for (const x of [-40, 0, 40]) m.add(cyl(2, 2, 60, 6), { col: brass, pos: [x, 30, 0], surf: SURF.brass });
  }, 0.2),
  gt_ticketbox: () => B((m) => {
    // the ticket box at the barrier's gap: a brass-bound pillar box with a slot, a lamp over it
    m.add(rbox(56, 80, 26, 3), { col: weather(0x2a1a12, 0.35), pos: [0, 40, 0], surf: SURF.wood });
    m.add(box(58, 6, 28), { col: brass, pos: [0, 82, 0], surf: SURF.brass });
    m.add(box(30, 3, 2), { col: 0x0a0806, pos: [0, 64, 14], surf: SURF.paint });
    m.add(cyl(1.6, 1.6, 50, 6), { col: brass, pos: [24, 110, 0], surf: SURF.brass });
    m.add(sphere(7, 10, 8), { col: 0xffe0a0, pos: [24, 138, 0], surf: SURF.bulb, emit: 1.4 });
  }),
  gt_buffers: () => B((m) => {
    // the buffer stop at the end of the track: a timber beam on an iron frame, two sprung buffers, a red lamp
    for (const s of [-1, 1]) {
      m.add(box(14, 60, 120), { col: iron, pos: [0, 30, s * 70], rot: [0.4 * s, 0, 0], surf: SURF.iron });
      m.add(cyl(14, 14, 30, 12), { col: iron, pos: [-30, 50, s * 60], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
    }
    m.add(box(20, 30, 220), { col: weather(0x5a1a14, 0.4), pos: [-14, 56, 0], surf: SURF.wood });
    m.add(sphere(8, 10, 8), { col: 0xff3020, pos: [-14, 84, 0], surf: SURF.bulb, emit: 2.2 });
  }),
  gt_pillar_broken: () => B((m) => {
    m.add(cyl(26, 30, 14, 14), { col: marble, pos: [0, 7, 0], surf: SURF.porcelain });
    m.add(cyl(18, 20, 110, 14), { col: marble, pos: [0, 70, 0], surf: SURF.porcelain });
    for (const y of [40, 100]) m.add(torus(19.5, 2.4, 6, 16), { col: GT.gilt, pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
    m.add(cone(19, 26, 7), { col: marble, pos: [3, 136, -2], rot: [0.25, 0, -0.3], surf: SURF.porcelain });
  }),
  gt_fallenclock: () => B((m) => {
    // a great clock face fallen flat and cracked across, no hands on it
    m.add(cyl(120, 124, 14, 36), { col: weather(0x1a1814, 0.35), pos: [0, 7, 0], surf: SURF.iron });
    m.add(cyl(110, 110, 2, 36), { col: weather(0xd8d0b8, 0.35, 0.06, 0x6a6458), pos: [0, 14.5, 0], surf: SURF.porcelain, emit: 0.2 });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      m.add(box(k % 3 ? 4 : 7, 1, k % 3 ? 14 : 24), { col: 0x14100e, pos: [Math.sin(a) * 92, 16, Math.cos(a) * 92], rot: [0, a, 0], surf: SURF.paint });
    }
    m.add(box(220, 2, 4), { col: 0x0a0806, pos: [0, 16, 10], rot: [0, 0.4, 0], surf: SURF.paint });
  }),
  gt_edge_world: () => B((m) => {
    // where the ground stops: broken flagstones along the brink (the drop is the floor's)
    for (let i = 0; i < 40; i++) {
      const x = -2300 + i * 118;
      m.add(rbox(100 + (i % 3) * 14, 16, 60, 3), { col: marble, pos: [x, -6 - (i % 4) * 3, 10 + (i % 5) * 8], rot: [0.1 * ((i % 3) - 1), 0.08 * (i % 4), 0.06 * ((i % 5) - 2)], surf: SURF.porcelain });
    }
  }, 0.2),
};

// ---------------------------------------------------------------- dressing (decorative, scattered by the data)
Object.assign(GT_KIT, {
  gt_crate: (v: number) => B((m) => {
    m.add(rbox(34, 30, 34, 2), { col: weather(v === 1 ? 0x5a4630 : 0x4a3a28, 0.45, 0.06), pos: [0, 15, 0], surf: SURF.wood });
    for (const s of [-1, 1]) m.add(box(36, 3, 3), { col: darkWood, pos: [0, 15 + s * 10, 17.5], surf: SURF.wood });
    if (v === 2) m.add(rbox(26, 22, 26, 2), { col: weather(0x4a3a28, 0.45), pos: [4, 41, -2], rot: [0, 0.5, 0], surf: SURF.wood });
  }),
  gt_barrel: (v: number) => B((m) => {
    m.add(cyl(14, 13, 40, 14), { col: weather(v === 2 ? 0x3a2a1c : 0x4a3424, 0.45, 0.06), pos: [0, 20, 0], surf: SURF.wood });
    for (const y of [6, 20, 34]) m.add(torus(14.2, 1.2, 4, 14), { col: 0x2a2826, pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    if (v === 1) m.add(cyl(13, 13, 2, 14), { col: 0x101010, pos: [0, 40, 0], surf: SURF.rubber });
  }),
  gt_sack: (v: number) => B((m) => {
    for (let i = 0; i <= (v % 2); i++) m.add(ellipsoid(16, 12, 12, 10, 6), { col: weather(0x6a5a3a, 0.5, 0.08), pos: [i * 18 - 9 * (v % 2), 10, i * 6], rot: [0, i * 0.8, 0], surf: SURF.canvas });
  }, 0.4),
  gt_paper: () => B((m) => {
    for (let i = 0; i < 4; i++) m.add(box(14, 0.6, 10), { col: 0xd0c8b0, pos: [Math.cos(i * 2.1) * 16, 0.5 + i * 0.3, Math.sin(i * 2.1) * 12], rot: [0, i * 1.3, 0], surf: SURF.cloth });
  }, 0),
  gt_lily: () => B((m) => {
    m.add(cyl(1, 1, 22, 4), { col: 0x2a3a1e, pos: [0, 11, 0], surf: SURF.cloth });
    for (let k = 0; k < 3; k++) m.add(cone(4, 8, 6), { col: 0xe8e4d8, pos: [Math.cos(k * 2.1) * 4, 24, Math.sin(k * 2.1) * 4], rot: [Math.PI + 0.5, k * 2.1, 0], surf: SURF.cloth, emit: 0.15 });
  }, 0),
  gt_grave_flowers: () => B((m) => {
    m.add(cyl(6, 5, 10, 8), { col: 0x5a5a54, pos: [0, 5, 0], surf: SURF.paint });
    for (let k = 0; k < 6; k++) m.add(sphere(3, 6, 4), { col: k % 2 ? 0x6a2030 : 0xd8d0c0, pos: [Math.cos(k) * 4, 14 + (k % 3) * 2, Math.sin(k) * 4], surf: SURF.cloth });
  }, 0),
  gt_leaves: () => B((m) => {
    for (let k = 0; k < 9; k++) m.add(ellipsoid(4, 0.6, 2.4, 6, 3), { col: k % 3 ? 0x5a3418 : 0x3a2a14, pos: [Math.cos(k * 1.7) * (8 + k * 3), 0.6, Math.sin(k * 1.7) * (6 + k * 2)], rot: [0, k, 0], surf: SURF.cloth });
  }, 0),
  gt_rubble: (v: number) => B((m) => {
    for (let k = 0; k < 5 + v; k++) m.add(rbox(10 + (k % 3) * 5, 6 + (k % 2) * 4, 8 + (k % 4) * 3, 2, 1), { col: weather(v === 1 ? 0x3a3430 : 0x6a665e, 0.45, 0.06), pos: [Math.cos(k * 2.3) * (6 + k * 4), 3, Math.sin(k * 2.3) * (5 + k * 3)], rot: [k * 0.3, k, k * 0.2], surf: SURF.paint });
  }, 0.3),
  gt_coalpile: () => B((m) => {
    m.add(ellipsoid(34, 16, 28, 12, 6), { col: coalCol, pos: [0, 0, 0], surf: SURF.rubber });
    for (let k = 0; k < 6; k++) m.add(rbox(8, 6, 7, 2, 1), { col: coalCol, pos: [Math.cos(k) * 18, 8 + (k % 2) * 3, Math.sin(k) * 14], rot: [k, k * 2, 0], surf: SURF.rubber });
  }, 0.4),
  gt_flowerbox: () => B((m) => {
    m.add(box(44, 14, 16), { col: weather(0x4a3a28, 0.45), pos: [0, 7, 0], surf: SURF.wood });
    for (let k = 0; k < 7; k++) m.add(sphere(3.4, 6, 4), { col: [0x8a2a3a, 0xd8c070, 0x6a4a8a][k % 3], pos: [-18 + k * 6, 17 + (k % 2) * 2, (k % 2) * 3 - 1.5], surf: SURF.cloth });
  }, 0.2),
  gt_ticketpile: () => B((m) => {
    for (let k = 0; k < 14; k++) m.add(box(6, 0.5, 3.4), { col: k % 4 ? 0xe8dcb8 : 0xc8a050, pos: [Math.cos(k * 2.4) * (k * 2), 0.4 + k * 0.15, Math.sin(k * 2.4) * (k * 1.6)], rot: [0, k * 1.1, 0], surf: SURF.cloth, emit: 0.2 });
  }, 0),
});

/** Kinds the world stretches along their length (`w`) rather than placing at a fixed size. */
export const GT_STRETCH: Record<string, number> = { gt_railing: 100, gt_picket: 100, gt_barrier: 100, gt_pipe: 100, gt_drystone: 100, gt_yardwall: 100 };
/** Kinds drawn by other modules (the train's walls, doors and locomotive; the platform edge). */
export const GT_SKIP = new Set(['gt_wall', 'gt_door', 'gt_loco', 'gt_edge']);
