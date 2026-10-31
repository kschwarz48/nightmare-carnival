// The Boardwalk's prop kit (D-68): everything placed on the promenade, inside the Arcade and the Gift Shop,
// along the beach and out on the pier. Each builder faces south (+Z, toward the camera) with its origin at
// its foot; the world batches them by kind. Small things carry the place's history: penny machines and
// mutoscopes, a weighing machine that tells fortunes, coin telescopes aimed at the fog, withered palms,
// lifeguard towers, the Gala Queen's hull, the trawler, the foghorn house and the lighthouse.

import * as THREE from 'three';
import { C, SURF, box, cone, cyl, ellipsoid, extrude, lathe, rbox, sphere, torus, tube, vnoise, weather, type ColorFn } from '../../core/geo';
import { ModelBuilder, PAL, bulb } from '../../models/kit';
import * as P from '../../models/props';
import { FURNISHINGS } from './furnishings';

const B = (fn: (m: ModelBuilder) => void, ao = 0.35) => {
  const m = new ModelBuilder();
  fn(m);
  return m.build({ ao });
};
const iron = weather(0x2a2c2e, 0.45, 0.05, 0x5a3a24);
const brass = weather(PAL.brass, 0.35, 0.04, 0x3a4a30);
const wood = weather(0x4a3a2c, 0.45, 0.05, 0x7a6a58);
const greyWood = weather(0x5a5650, 0.5, 0.04, 0x8a8478);
const cream = weather(0xd6ccb4, 0.45, 0.04, 0x8a7a66);
const rust: ColorFn = (p) => C(0x4a2e22).multiplyScalar(0.7 + 0.4 * vnoise(p.x * 0.08, p.y * 0.08, p.z * 0.08));
const glass = (hex: number) => C(hex);

/** Height of the boardwalk lamps' globes (for their halos and pools). */
export const BW_LAMP_H = 158;
export const PIER_LAMP_H = 120;

export const BW_PROPS: Record<string, (variant: number) => THREE.BufferGeometry> = {
  // ---------------------------------------------------------------- the promenade
  bw_lamp: (v) => B((m) => {
    // a cast-iron post with a fluted shaft and a pair of frosted globes on a scrolled crossarm
    m.add(cyl(12, 15, 16, 10), { col: iron, pos: [0, 8, 0], surf: SURF.iron });
    m.add(cyl(4.5, 6, 130, 10), { col: iron, pos: [0, 80, 0], surf: SURF.iron });
    m.add(torus(6, 1.6, 6, 10), { col: iron, pos: [0, 40, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    if (v === 0) {
      m.add(box(64, 4, 5), { col: iron, pos: [0, 146, 0], surf: SURF.iron });
      for (const s of [-1, 1]) {
        m.add(torus(9, 1.4, 5, 10, Math.PI), { col: iron, pos: [s * 22, 140, 0], rot: [0, 0, s > 0 ? 0 : Math.PI], surf: SURF.iron });
        m.add(sphere(10, 12, 10), { col: glass(0xfff0d0), pos: [s * 30, BW_LAMP_H, 0], surf: SURF.bulb, emit: 1.2 });
        m.add(cyl(5, 6, 6, 8), { col: iron, pos: [s * 30, 148, 0], surf: SURF.iron });
      }
    } else {
      m.add(sphere(11, 12, 10), { col: glass(0xfff0d0), pos: [0, BW_LAMP_H, 0], surf: SURF.bulb, emit: 1.2 });
      m.add(cyl(6, 7, 7, 8), { col: iron, pos: [0, 146, 0], surf: SURF.iron });
      m.add(cone(8, 10, 8), { col: iron, pos: [0, BW_LAMP_H + 14, 0], surf: SURF.iron });
    }
  }),
  bw_palm: (v) => B((m) => {
    // a withered palm: a ringed trunk leaning off the vertical, a crown of drooping, browned fronds
    const lean = [0.12, -0.08, 0.18][v % 3], h = [260, 300, 230][v % 3];
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push([Math.sin(lean) * h * t * t, h * t, 0]);
    }
    m.add(tube(pts, (t) => 9 - t * 3, 7, 24), { col: weather(0x4a3e30, 0.5, 0.08), surf: SURF.wood });
    for (let i = 1; i < 8; i++) m.add(torus(8 - i * 0.35, 1.4, 4, 10), { col: C(0x2e261e), pos: [pts[i][0], pts[i][1], 0], rot: [Math.PI / 2, 0, 0], surf: SURF.wood });
    const top = pts[8];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + v;
      const droop: [number, number, number][] = [];
      for (let j = 0; j <= 5; j++) {
        const t = j / 5;
        droop.push([top[0] + Math.cos(a) * 90 * t, top[1] + 18 * t - 60 * t * t, Math.sin(a) * 90 * t]);
      }
      m.add(tube(droop, (t) => 6 * (1 - t) + 1.5, 4, 12), { col: weather(k % 3 ? 0x3a4028 : 0x5a4a2a, 0.5, 0.06), surf: SURF.canvas });
    }
  }, 0.2),
  bw_bench: () => P.bench(),
  bw_bin: (v) => P.trash(v % 3),
  bw_telescope: () => B((m) => {
    // a coin telescope on a pedestal, aimed out to sea
    m.add(cyl(10, 14, 10, 10), { col: iron, pos: [0, 5, 0], surf: SURF.iron });
    m.add(cyl(4, 5, 70, 8), { col: iron, pos: [0, 45, 0], surf: SURF.iron });
    m.add(rbox(28, 22, 26, 6, 2), { col: weather(0x2a4a48, 0.45), pos: [0, 92, 0], surf: SURF.paint });
    for (const s of [-1, 1]) m.add(cyl(5, 6, 22, 10), { col: brass, pos: [s * 7, 96, 18], rot: [Math.PI / 2 + 0.3, 0, 0], surf: SURF.brass });
    m.add(box(10, 6, 3), { col: brass, pos: [0, 84, -13], surf: SURF.brass });
  }),
  bw_cart: () => P.popcornCart(),
  bw_vending: () => B((m) => {
    // a Seafoam Soda machine: a rounded red cabinet, a lit panel, a bottle-opener
    m.add(rbox(46, 120, 36, 8, 2), { col: weather(0x8a1a1e, 0.45, 0.04, 0x6a6a68), pos: [0, 60, 0], surf: SURF.paint });
    m.add(box(34, 40, 2), { col: glass(0xffe0b0), pos: [0, 86, 18], surf: SURF.glass, emit: 0.45 });
    m.add(box(30, 10, 2), { col: cream, pos: [0, 54, 18.5], surf: SURF.paint });
    m.add(box(8, 6, 6), { col: brass, pos: [14, 40, 20], surf: SURF.brass });
  }),
  bw_scale: () => B((m) => {
    // a weighing machine: YOUR WEIGHT & FATE, a big round dial, a footplate
    m.add(box(40, 6, 40), { col: iron, pos: [0, 3, 6], surf: SURF.iron });
    m.add(rbox(34, 110, 26, 8, 2), { col: weather(0x2a2a3a, 0.45), pos: [0, 60, -6], surf: SURF.paint });
    m.add(cyl(15, 15, 3, 18), { col: cream, pos: [0, 98, 7], rot: [Math.PI / 2, 0, 0], surf: SURF.porcelain, emit: 0.25 });
    m.add(torus(15, 2, 6, 18), { col: brass, pos: [0, 98, 8], surf: SURF.brass });
    m.add(box(1.5, 12, 1), { col: PAL.ink, pos: [0, 102, 9], rot: [0, 0, 0.6], surf: SURF.paint });
  }),
  bw_kiosk: () => B((m) => {
    m.add(box(70, 90, 50), { col: weather(0x2a3a2a, 0.45), pos: [0, 45, 0], surf: SURF.paint });
    m.add(box(84, 8, 64), { col: wood, pos: [0, 94, 4], surf: SURF.wood });
    for (let i = 0; i < 4; i++) m.add(box(14, 18, 2), { col: cream, pos: [-24 + i * 16, 60, 26], rot: [0.2, 0, 0], surf: SURF.paint });
  }),
  bw_bandstand: () => B((m) => {
    // an octagonal bandstand: a raised deck, slender posts, a scalloped canopy, a finial
    m.add(cyl(116, 120, 22, 8), { col: weather(0x3a3028, 0.4), pos: [0, 11, 0], surf: SURF.wood });
    m.add(cyl(112, 112, 4, 8), { col: greyWood, pos: [0, 24, 0], surf: SURF.wood });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      m.add(cyl(4, 5, 150, 8), { col: cream, pos: [Math.cos(a) * 104, 100, Math.sin(a) * 104], surf: SURF.paint });
      m.add(box(80, 3, 3), { col: cream, pos: [Math.cos(a + Math.PI / 8) * 98, 52, Math.sin(a + Math.PI / 8) * 98], rot: [0, -(a + Math.PI / 8) + Math.PI / 2, 0], surf: SURF.paint });
    }
    m.add(lathe([[0, 0], [130, 0], [118, 14], [60, 56], [10, 80], [0, 84]], 8), { col: weather(0x5a2a28, 0.5, 0.04, 0x8a7a6a), pos: [0, 174, 0], surf: SURF.paint });
    m.add(cone(6, 40, 6), { col: brass, pos: [0, 278, 0], surf: SURF.brass });
    // music stands and a toppled chair, left as they were
    for (const [x, z] of [[-40, -20], [20, -40], [50, 10]] as [number, number][]) m.add(cyl(1.2, 1.2, 40, 4), { col: iron, pos: [x, 46, z], surf: SURF.iron });
  }),
  bw_ticketbooth: () => P.ticketBooth(),
  bw_tossbooth: () => P.stallKind('stall_ringtoss', 1),
  bw_wharfgate: () => B((m) => {
    // the iron arch over the pier's mouth: lattice piers, a curved sign band, lanterns
    for (const s of [-1, 1]) {
      m.add(box(24, 260, 24), { col: iron, pos: [s * 170, 130, 0], surf: SURF.iron });
      for (let y = 20; y < 250; y += 36) m.add(box(30, 3, 30), { col: iron, pos: [s * 170, y, 0], surf: SURF.iron });
      m.add(sphere(10, 10, 8), { col: glass(0xfff0d0), pos: [s * 170, 290, 0], surf: SURF.bulb, emit: 1.2 });
      m.add(cone(12, 16, 8), { col: iron, pos: [s * 170, 308, 0], surf: SURF.iron });
    }
    m.add(torus(170, 7, 6, 32, Math.PI), { col: iron, pos: [0, 220, 0], surf: SURF.iron });
    m.add(torus(150, 4, 6, 32, Math.PI), { col: iron, pos: [0, 220, 0], surf: SURF.iron });
    m.add(box(300, 40, 6), { col: weather(0x1a2a2a, 0.4), pos: [0, 330, 0], surf: SURF.paint });
  }),
  bw_rail: () => B((m) => {
    // one 100-unit run of railing (stretched along the seawall): posts, top rail, a lower rail
    for (const x of [-48, 0, 48]) m.add(box(7, 46, 7), { col: greyWood, pos: [x, 23, 0], surf: SURF.wood });
    m.add(box(100, 7, 9), { col: greyWood, pos: [0, 47, 0], surf: SURF.wood });
    m.add(box(100, 4, 4), { col: greyWood, pos: [0, 24, 0], surf: SURF.wood });
  }),

  // ---------------------------------------------------------------- the Arcade and the Gift Shop
  // (their machines, stands and cases are in furnishings.ts; the postcard spinner stays here)
  bw_spinner: () => B((m) => {
    m.add(cyl(14, 16, 6, 10), { col: iron, pos: [0, 3, 0], surf: SURF.iron });
    m.add(cyl(2, 2, 120, 6), { col: iron, pos: [0, 62, 0], surf: SURF.iron });
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + r * 0.4;
      m.add(box(12, 16, 1), { col: weather([0xd8c8a0, 0x9ab8c8, 0xc8a8a8][(r + k) % 3], 0.4), pos: [Math.cos(a) * 12, 40 + r * 20, Math.sin(a) * 12], rot: [0, -a + Math.PI / 2, 0], surf: SURF.paint });
    }
  }),
  // ---------------------------------------------------------------- the beach
  bw_lifeguard: (v) => B((m) => {
    // a lifeguard tower: four splayed legs, a cabin with a slanted roof, a ladder, a life ring
    for (const [x, z] of [[-34, -30], [34, -30], [-34, 30], [34, 30]] as [number, number][]) m.add(box(8, 150, 8), { col: greyWood, pos: [x * 0.85, 75, z * 0.85], rot: [z * 0.002, 0, -x * 0.002], surf: SURF.wood });
    m.add(box(90, 6, 80), { col: greyWood, pos: [0, 150, 0], surf: SURF.wood });
    m.add(box(70, 60, 60), { col: weather([0x8a2a24, 0x2a5a6a, 0x8a7a3a][v % 3], 0.5, 0.05, 0x6a6a68), pos: [0, 184, -6], surf: SURF.paint });
    m.add(box(56, 26, 3), { col: glass(0x3a4a50), pos: [0, 190, 25], surf: SURF.glass, emit: 0.05 });
    m.add(box(86, 5, 76), { col: weather(0x4a4440, 0.5), pos: [0, 220, -6], rot: [0.15, 0, 0], surf: SURF.wood });
    for (let y = 20; y < 150; y += 18) m.add(box(30, 3, 3), { col: greyWood, pos: [0, y, 52 - y * 0.12], surf: SURF.wood });
    m.add(torus(12, 3.4, 6, 14), { col: (p) => (Math.atan2(p.y - 175, p.x - 38) > 0 ? C(0xc84a3a) : C(0xd8d0c0)), pos: [38, 175, 26], surf: SURF.rubber });
  }),
  bw_wreck: () => B((m) => {
    // the Gala Queen's hull lying along the tide line: ribs showing through the planking, a funnel down,
    // four portholes facing the beach (the quest sets its keepsakes in them)
    const L = 620, hullC = weather(0x2a2420, 0.5, 0.05, 0x4a3e30);
    m.add(ellipsoid(L / 2, 70, 90, 20, 8), { col: hullC, pos: [0, 10, 0], scale: [1, 1, 1], surf: SURF.wood });
    for (let k = 0; k < 14; k++) {
      const x = -L / 2 + 40 + k * ((L - 80) / 13);
      m.add(torus(70, 5, 5, 12, Math.PI), { col: weather(0x3a3028, 0.5), pos: [x, 10, 0], rot: [0, Math.PI / 2, Math.PI], surf: SURF.wood });
    }
    m.add(box(L * 0.7, 6, 100), { col: weather(0x4a4038, 0.5), pos: [-20, 70, 0], rot: [0.08, 0, 0.03], surf: SURF.wood });
    m.add(cyl(26, 28, 120, 14), { col: rust, pos: [60, 60, -40], rot: [0.2, 0, 1.25], surf: SURF.iron });
    m.add(cyl(20, 22, 90, 14), { col: rust, pos: [-110, 60, -30], rot: [0.1, 0, 1.1], surf: SURF.iron });
    for (let k = 0; k < 4; k++) {
      const x = -200 + k * 130;
      m.add(torus(16, 4, 6, 16), { col: brass, pos: [x, 40, 86], surf: SURF.brass });
      m.add(cyl(13, 13, 3, 14), { col: C(0x0a1416), pos: [x, 40, 85], rot: [Math.PI / 2, 0, 0], surf: SURF.glass, emit: 0.04 });
    }
    m.add(box(150, 30, 4), { col: weather(0x8a7a5a, 0.5), pos: [-220, 60, 92], rot: [0, 0, -0.05], surf: SURF.paint });
  }, 0.25),
  bw_rowboat: () => B((m) => {
    m.add(ellipsoid(80, 24, 34, 16, 8), { col: weather(0x3a4a5a, 0.55, 0.05, 0x5a4a3a), pos: [0, 8, 0], scale: [1, 0.8, 1], surf: SURF.wood });
    m.add(ellipsoid(72, 18, 28, 16, 8), { col: weather(0x2a2018, 0.4), pos: [0, 16, 0], surf: SURF.wood });
    for (const x of [-30, 20]) m.add(box(6, 4, 54), { col: greyWood, pos: [x, 24, 0], surf: SURF.wood });
    m.add(box(110, 3, 6), { col: greyWood, pos: [10, 26, 30], rot: [0, 0.3, 0.1], surf: SURF.wood });
  }),
  bw_ribs: () => B((m) => {
    // the ribs of something enormous, arching out of the sand, and a long jaw
    for (let k = 0; k < 9; k++) {
      const x = -260 + k * 62, s = 1 - Math.abs(k - 4) * 0.09;
      m.add(torus(110 * s, 6 * s, 5, 12, Math.PI * 0.9), { col: weather(0xb8b0a0, 0.5, 0.05, 0x6a6458), pos: [x, -10, 0], rot: [0, Math.PI / 2, 0.15], surf: SURF.bone });
    }
    m.add(tube([[-320, 4, 30], [-200, 8, 40], [-60, 10, 44], [80, 8, 40], [300, 4, 20]], 9, 6, 24), { col: weather(0xa8a090, 0.5), surf: SURF.bone });
  }, 0.3),
  bw_firepit: () => B((m) => {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      m.add(sphere(9, 6, 5), { col: weather(0x3a3a3a, 0.4), pos: [Math.cos(a) * 26, 4, Math.sin(a) * 26], scale: [1, 0.6, 1], surf: SURF.paint });
    }
    for (let k = 0; k < 4; k++) m.add(cyl(3, 3, 40, 5), { col: C(0x1a1410), pos: [0, 6, 0], rot: [Math.PI / 2, (k / 4) * Math.PI, 0.2], surf: SURF.wood });
  }),
  bw_umbrella: (v) => B((m) => {
    // a beach umbrella: one standing, one tilted over, one collapsed on the sand
    const cols = [[0x7a1e22, 0xd8d0b8], [0x1e4a5a, 0xd8d0b8], [0x5a4a1e, 0xd8d0b8]][v % 3];
    const tilt = [0.08, 0.5, 1.35][v % 3];
    const top: [number, number, number] = [Math.sin(tilt) * 120, Math.cos(tilt) * 120, 0];
    m.add(cyl(1.6, 1.6, 124, 6), { col: greyWood, pos: [top[0] / 2, top[1] / 2, 0], rot: [0, 0, -tilt], surf: SURF.wood });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      m.add(cone(52, 26, 3), { col: weather(cols[k % 2], 0.5, 0.05), pos: [top[0] + Math.cos(a) * 1, top[1] - 4, Math.sin(a) * 1], rot: [0, a, -tilt], scale: [1, 1, 0.42], surf: SURF.canvas });
    }
  }),
  bw_chair: (v) => B((m) => {
    m.add(box(40, 3, 70), { col: weather(v ? 0x2a4a5a : 0x6a2a24, 0.5), pos: [0, 18, 0], rot: [0.35, 0, 0], surf: SURF.canvas });
    for (const s of [-1, 1]) {
      m.add(box(3, 3, 76), { col: greyWood, pos: [s * 20, 18, 0], rot: [0.35, 0, 0], surf: SURF.wood });
      m.add(box(3, 40, 3), { col: greyWood, pos: [s * 20, 16, 20], rot: [-0.5, 0, 0], surf: SURF.wood });
    }
  }),
  bw_driftwood: (v) => B((m) => {
    m.add(tube([[-90, 6, 0], [-30, 9, 8], [30, 7, -6], [100, 5, 4]], (t) => 10 - t * 5, 6, 16), { col: weather(0x8a8070, 0.5, 0.06, 0x5a5448), surf: SURF.wood });
    if (v) m.add(tube([[20, 7, 0], [50, 14, 22], [70, 22, 30]], 4, 5, 8), { col: weather(0x8a8070, 0.5), surf: SURF.wood });
  }),
  bw_sign: () => B((m) => {
    m.add(box(7, 130, 7), { col: greyWood, pos: [0, 65, 0], surf: SURF.wood });
    m.add(box(110, 50, 5), { col: weather(0xd8d0b8, 0.55, 0.06, 0x6a6458), pos: [0, 112, 4], rot: [0, 0, 0.06], surf: SURF.paint });
    m.add(box(96, 8, 1), { col: C(0x8a1a1a), pos: [0, 124, 7], rot: [0, 0, 0.06], surf: SURF.paint });
  }),
  bw_rocks: (v) => B((m) => {
    for (let k = 0; k < 5; k++) {
      const a = k * 2.1 + v;
      m.add(ellipsoid(34 + (k % 3) * 10, 22 + (k % 2) * 10, 30, 8, 6), { col: weather(0x2a2c2a, 0.5, 0.04, 0x1a2a1e), pos: [Math.cos(a) * 30, 8, Math.sin(a) * 22], rot: [0, a, 0.2], surf: SURF.paint });
    }
  }),

  // ---------------------------------------------------------------- the pier
  bw_baitshop: () => B((m) => {
    // the bait & tackle shack: shingled walls, a hipped roof, a lit window, rods racked on the porch
    m.add(box(400, 150, 240), { col: weather(0x5a5248, 0.55, 0.04, 0x8a8278), pos: [0, 75, 0], surf: SURF.wood });
    const rise = 80, half = 140, len = Math.hypot(half, rise), sl = Math.atan2(rise, half);
    for (const s of [-1, 1]) m.add(box(430, 6, len), { col: weather(0x2a2620, 0.4), pos: [0, 150 + rise / 2, s * half / 2], rot: [-s * sl, 0, 0], surf: SURF.wood });
    m.add(box(90, 60, 3), { col: glass(0xffc070), pos: [-80, 80, 121], surf: SURF.glass, emit: 0.35 });
    m.add(box(60, 110, 3), { col: C(0x1a1410), pos: [70, 55, 121], surf: SURF.wood });
    m.add(box(200, 34, 5), { col: weather(0x2a3a3a, 0.4), pos: [0, 170, 124], surf: SURF.paint });
    for (let k = 0; k < 5; k++) m.add(cyl(1.2, 1.2, 140, 4), { col: wood, pos: [210, 70, -60 + k * 20], rot: [0, 0, 0.1], surf: SURF.wood });
    m.add(cyl(26, 26, 40, 10), { col: weather(0x3a5a4a, 0.5), pos: [-170, 20, 140], surf: SURF.paint });
  }),
  bw_hoist: () => B((m) => {
    // the loading crane: a timber mast and boom swung out over the water, a winch drum, chain and hook
    m.add(cyl(40, 44, 20, 10), { col: iron, pos: [0, 10, 0], surf: SURF.iron });
    m.add(box(24, 300, 24), { col: wood, pos: [0, 160, 0], surf: SURF.wood });
    m.add(box(330, 18, 18), { col: wood, pos: [150, 290, 0], rot: [0, 0, 0.18], surf: SURF.wood });
    m.add(tube([[0, 300, 0], [150, 330, 0], [300, 340, 0]], 1.4, 4, 8), { col: iron, surf: SURF.iron });
    m.add(cyl(18, 18, 40, 12), { col: rust, pos: [-30, 40, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    m.add(cyl(1.4, 1.4, 200, 4), { col: iron, pos: [300, 238, 0], surf: SURF.iron });
    m.add(torus(10, 3, 6, 10, Math.PI * 1.4), { col: iron, pos: [300, 134, 0], surf: SURF.iron });
  }),
  bw_foghorn: () => B((m) => {
    // the foghorn house: a squat shed on the pier's last planks, twin trumpets aimed at the fog, two pull
    // chains by the door (SHORT and LONG)
    m.add(box(300, 140, 130), { col: weather(0x5a5a58, 0.55, 0.04, 0x8a8a84), pos: [0, 70, 0], surf: SURF.paint });
    const rise = 60, half = 75, len = Math.hypot(half, rise), sl = Math.atan2(rise, half);
    for (const s of [-1, 1]) m.add(box(320, 6, len), { col: weather(0x8a1e1e, 0.5, 0.05, 0x4a2a24), pos: [0, 140 + rise / 2, s * half / 2], rot: [-s * sl, 0, 0], surf: SURF.paint });
    for (const s of [-1, 1]) m.add(lathe([[4, 0], [8, 30], [16, 70], [34, 100], [40, 104]], 14), { col: brass, pos: [s * 70, 150, 40], rot: [Math.PI / 2 - 0.2, 0, 0], surf: SURF.brass });
    m.add(box(70, 100, 3), { col: C(0x1a1410), pos: [0, 50, -66], surf: SURF.wood });
    for (const x of [-90, 30]) {
      m.add(cyl(1.4, 1.4, 70, 4), { col: iron, pos: [x, 90, -70], surf: SURF.iron });
      m.add(cyl(5, 5, 12, 8), { col: x < 0 ? C(0xd8d0c0) : C(0x8a1a1a), pos: [x, 52, -70], surf: SURF.wood });
    }
  }),
  bw_lighthouse: () => B((m) => {
    // the pier-head light: a short iron tower, a glazed lantern room with its lens, a gallery rail
    m.add(cyl(30, 40, 200, 12), { col: (p) => (Math.floor(p.y / 40) % 2 ? C(0xd8d0c4) : C(0x7a1e1e)), pos: [0, 100, 0], surf: SURF.paint });
    m.add(cyl(46, 46, 8, 14), { col: iron, pos: [0, 204, 0], surf: SURF.iron });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      m.add(cyl(1.2, 1.2, 26, 4), { col: iron, pos: [Math.cos(a) * 44, 220, Math.sin(a) * 44], surf: SURF.iron });
    }
    m.add(cyl(26, 26, 50, 12), { col: glass(0xfff4d8), pos: [0, 236, 0], surf: SURF.glass, emit: 1.1 });
    m.add(cone(32, 34, 12), { col: iron, pos: [0, 278, 0], surf: SURF.iron });
    m.add(sphere(5, 8, 6), { col: iron, pos: [0, 298, 0], surf: SURF.iron });
  }),
  bw_trawler: () => B((m) => {
    // the Mary Ellen, moored off the side dock: a wheelhouse, a mast with booms and nets, rust weeping
    m.add(ellipsoid(150, 40, 56, 18, 8), { col: weather(0x2a3a3a, 0.5, 0.05, 0x5a3a2a), pos: [0, -12, 0], surf: SURF.paint });
    m.add(box(260, 6, 90), { col: greyWood, pos: [0, 22, 0], surf: SURF.wood });
    m.add(box(70, 60, 60), { col: weather(0xd8d0c0, 0.5, 0.05, 0x6a6458), pos: [-50, 55, 0], surf: SURF.paint });
    m.add(box(60, 18, 3), { col: glass(0xffc070), pos: [-50, 68, 31], surf: SURF.glass, emit: 0.3 });
    m.add(cyl(3, 4, 200, 6), { col: wood, pos: [40, 120, 0], surf: SURF.wood });
    for (const s of [-1, 1]) m.add(cyl(2, 2, 130, 5), { col: wood, pos: [40 + s * 50, 150, 0], rot: [0, 0, s * 1.0], surf: SURF.wood });
    m.add(box(120, 60, 2), { col: weather(0x2a3020, 0.6), pos: [90, 80, 20], rot: [0, 0.3, 0.2], surf: SURF.canvas });
  }),
  bw_crates: () => B((m) => {
    m.add(box(40, 40, 40), { col: wood, pos: [0, 20, 0], surf: SURF.wood });
    m.add(box(36, 36, 36), { col: wood, pos: [26, 18, 18], rot: [0, 0.4, 0], surf: SURF.wood });
    m.add(cyl(16, 16, 40, 10), { col: weather(0x3a4a5a, 0.5), pos: [-30, 20, 14], surf: SURF.paint });
  }),
  bw_nets: () => B((m) => {
    m.add(ellipsoid(60, 14, 40, 10, 6), { col: weather(0x3a3a28, 0.6, 0.08), pos: [0, 6, 0], surf: SURF.canvas });
    for (let k = 0; k < 5; k++) m.add(sphere(5, 6, 4), { col: weather(0xc8a040, 0.4), pos: [-40 + k * 20, 12, (k % 2) * 20 - 10], surf: SURF.porcelain });
  }),
  bw_pierlamp: () => B((m) => {
    // a timber post with a hanging ship's lantern on an iron bracket
    m.add(box(10, 130, 10), { col: weather(0x3a342e, 0.5), pos: [0, 65, 0], surf: SURF.wood });
    m.add(box(40, 4, 4), { col: iron, pos: [16, 128, 0], surf: SURF.iron });
    m.add(cyl(1, 1, 10, 4), { col: iron, pos: [32, 122, 0], surf: SURF.iron });
    m.add(cyl(7, 8, 18, 6), { col: glass(0xffd8a0), pos: [32, PIER_LAMP_H - 10, 0], surf: SURF.bulb, emit: 1.1 });
    m.add(cone(9, 8, 6), { col: iron, pos: [32, PIER_LAMP_H + 3, 0], surf: SURF.iron });
  }),
  bw_bollard: () => B((m) => {
    m.add(cyl(9, 11, 30, 10), { col: iron, pos: [0, 15, 0], surf: SURF.iron });
    m.add(cyl(13, 13, 6, 10), { col: iron, pos: [0, 31, 0], surf: SURF.iron });
  }),

  // ---------------------------------------------------------------- ride footings
  bw_wheel_deck: () => B((m) => {
    m.add(box(260, 12, 90), { col: weather(0x3a3028, 0.4), pos: [0, 6, 0], surf: SURF.wood });
    for (let i = 0; i < 4; i++) m.add(box(70, 6, 30), { col: greyWood, pos: [0, 3, 50 + i * 12], surf: SURF.wood });
    m.add(box(270, 30, 6), { col: iron, pos: [0, 30, -45], surf: SURF.iron });
  }),
  bw_plunge: () => B((m) => {
    m.add(cyl(70, 80, 30, 12), { col: weather(0x3a3a3a, 0.4), pos: [0, 15, 0], surf: SURF.paint });
    m.add(box(150, 10, 150), { col: weather(0x4a4a48, 0.4), pos: [0, 2, 0], surf: SURF.paint });
  }),
  bw_kraken: () => B((m) => {
    m.add(cyl(80, 90, 26, 16), { col: weather(0x2a3a4a, 0.4), pos: [0, 13, 0], surf: SURF.paint });
    m.add(cyl(240, 240, 3, 32), { col: weather(0x3a3830, 0.45), pos: [0, 1.5, 0], surf: SURF.wood });
  }),
};

/** Kinds the world draws itself (walls, buildings, the coaster's posts) or that have no model. */
Object.assign(BW_PROPS, FURNISHINGS);

export const BW_SKIP = new Set(['bw_wall', 'bw_building', 'bw_bent_post', 'bw_wheel']);
export const _unused = { bulb, rust };
