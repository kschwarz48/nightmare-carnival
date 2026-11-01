// The Midnight Line's train (D-80), drawn in every place it stands: a copy at each station and one in the
// moving train's place, all the same carriages. Each car has its own floor and furnishing (the tender's iron
// and coal, the baggage car's planks and trunks, the coach's carpet runner and velvet seats, the dining car's
// tables and pink-shaded lamps, Car 13's black pall and candles, the sleeper's panelled compartments, the
// observation car's parquet, armchairs and brass rail), wall sconces, a lacquered exterior with gilt lining
// and lit windows, gangway bellows, the locomotive at the front. Roofs (a clerestory over each car) cover the
// copies you aren't in; the one you're in is cut away so you see inside. A station's copy is drawn only while
// the train is there or pulling in or out (sliding along the track with the timetable's distance); doors
// slide open with the timetable. One merged model for the whole train, instanced per copy.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CARS, REGIONS, TRAIN, TRANSIT, TRAIN_FURNITURE, regionAt, trainOrigin, type TrainState } from '../../../data/ghosttrain';
import { ActorBatch } from '../../core/batch';
import { C, ModelBuilder, SURF, box, cone, cyl, lathe, rbox, sphere, torus, vnoise, weather, type ColorFn } from '../../core/geo';
import { actorMaterial } from '../../core/materials';
import { PAL } from '../../models/kit';
import { GT, GT_KIT } from './kit';

/** The carriages' wall height, and the window band in it. */
export const WALL_H = 76, WIN_LO = 40, WIN_HI = 66;
const T = TRAIN;

/** Clone `geo`, place it (yaw about Y, then translate), for merging. */
function placed(geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  const g = geo.clone();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(sx, sy, sz));
  g.applyMatrix4(m);
  return g;
}
const B = (fn: (m: ModelBuilder) => void, ao = 0.3) => {
  const m = new ModelBuilder();
  fn(m);
  return m.build({ ao });
};

/** Each car's floor: its pattern as a vertex-coloured run of planks, plates or carpet strips. */
function floors(): THREE.BufferGeometry {
  return B((m) => {
    for (const c of CARS) {
      const L = c.x1 - c.x0, cx = (c.x0 + c.x1) / 2;
      const W = T.halfW * 2;
      switch (c.id) {
        case 'tender':
          // riveted iron plates under coal dust
          for (let i = 0; i < 6; i++) m.add(box(L / 6 - 2, 2, W), { col: weather(0x4a4642, 0.5, 0.06, 0x24201c), pos: [c.x0 + (i + 0.5) * (L / 6), 1, 0], surf: SURF.iron });
          break;
        case 'baggage':
          for (let i = 0; i < 11; i++) m.add(box(L, 2, W / 11 - 1.4), { col: weather(i % 2 ? 0x7a6448 : 0x6a563c, 0.45, 0.05), pos: [cx, 1, -W / 2 + (i + 0.5) * (W / 11)], surf: SURF.wood });
          break;
        case 'coach':
          for (let i = 0; i < 9; i++) m.add(box(L, 2, W / 9 - 1.2), { col: weather(i % 2 ? 0x6a4a30 : 0x5a3e28, 0.4, 0.05), pos: [cx, 1, -W / 2 + (i + 0.5) * (W / 9)], surf: SURF.wood });
          m.add(box(L - 10, 2.6, 70), { col: weather(0x8a2028, 0.25, 0.08, 0x4a1014), pos: [cx, 1.4, 0], surf: SURF.velvet });
          for (const s of [-1, 1]) m.add(box(L - 10, 2.8, 4), { col: GT.gilt, pos: [cx, 1.6, s * 33], surf: SURF.gold });
          break;
        case 'dining': {
          // a patterned carpet: a diamond lattice in plum and gold
          const carpet: ColorFn = (p) => {
            const u = (p.x + p.z) / 26, v = (p.x - p.z) / 26;
            const lat = Math.abs((u - Math.floor(u)) - 0.5) < 0.08 || Math.abs((v - Math.floor(v)) - 0.5) < 0.08;
            return lat ? C(0xa8803a) : C(0x6a2440).lerp(C(0x4a1830), vnoise(p.x * 0.05, 0, p.z * 0.05));
          };
          for (let i = 0; i < 24; i++) m.add(box(L / 24, 2, W), { col: carpet, pos: [c.x0 + (i + 0.5) * (L / 24), 1, 0], surf: SURF.velvet });
          break;
        }
        case 'funeral':
          for (let i = 0; i < 12; i++) m.add(box(L / 12 - 1, 2, W), { col: i % 2 ? 0x2a2030 : 0x3a2a48, pos: [c.x0 + (i + 0.5) * (L / 12), 1, 0], surf: SURF.velvet });
          for (const s of [-1, 1]) m.add(box(L, 2.4, 6), { col: 0x6a4a8a, pos: [cx, 1.3, s * 80], surf: SURF.velvet });
          break;
        case 'sleeper':
          for (let i = 0; i < 9; i++) m.add(box(L, 2, W / 9 - 1.2), { col: weather(i % 2 ? 0x5e4430 : 0x4e3826, 0.4, 0.05), pos: [cx, 1, -W / 2 + (i + 0.5) * (W / 9)], surf: SURF.wood });
          m.add(box(L - 10, 2.6, 60), { col: weather(0x2a4a6a, 0.25, 0.08), pos: [cx, 1.4, 60], surf: SURF.velvet });
          break;
        case 'observation': {
          // parquet in a herringbone, a round rug, and the open platform's checker plate
          for (let i = 0; i < 18; i++) for (let j = 0; j < 6; j++) {
            if (c.x0 + i * (L / 18) < -1570) continue;
            m.add(box(L / 18 - 1, 2, W / 6 - 1), { col: weather((i + j) % 2 ? 0x8a5a30 : 0x6a4424, 0.35, 0.05), pos: [c.x0 + (i + 0.5) * (L / 18), 1, -W / 2 + (j + 0.5) * (W / 6)], surf: SURF.wood });
          }
          m.add(cyl(70, 70, 2.6, 28), { col: weather(0x2a3a5a, 0.3, 0.08), pos: [-1360, 1.4, 0], surf: SURF.velvet });
          m.add(box(1690 - 1570, 2, W), { col: weather(0x3a3a3c, 0.4, 0.05), pos: [(-1690 - 1570) / 2, 1, 0], surf: SURF.iron });
          break;
        }
      }
    }
    // the gangways: rubber-floored, between the cars
    for (let i = 0; i < CARS.length - 1; i++) {
      const a = CARS[i].x0, b = CARS[i + 1].x1;
      m.add(box(a - b, 2, T.gangHalf * 2), { col: 0x141414, pos: [(a + b) / 2, 1, 0], surf: SURF.rubber });
    }
  }, 0);
}

/**
 * The shells: every wall piece from the sim's walls, WALL_H high, lacquered green with gilt lining outside and
 * panelled teak inside, the window band glazed (glowing with the cars' lamps); bellows at the gangways; sconces.
 */
function shells(): THREE.BufferGeometry {
  return B((m) => {
    const lacquer = weather(0x13261c, 0.3, 0.05, 0x24302a);
    const teakIn = weather(0x5a3a22, 0.35, 0.05, 0x7a5a3a);
    const W = T.halfW, Tw = T.wallT;
    for (let i = 0; i < CARS.length; i++) {
      const c = CARS[i];
      const open = c.id === 'observation';
      if (open) {
        // the observation car's open rear platform: a brass railing round three sides instead of walls
        const px0 = c.x0, px1 = -1570;
        for (const s of [-1, 1]) {
          m.add(box(px1 - px0, 3, 3), { col: PAL.brass, pos: [(px0 + px1) / 2, 46, s * (W + 2)], surf: SURF.brass });
          for (let x = px0 + 8; x < px1; x += 16) m.add(cyl(1.2, 1.2, 44, 5), { col: PAL.brass, pos: [x, 23, s * (W + 2)], surf: SURF.brass });
        }
        m.add(box(3, 3, W * 2), { col: PAL.brass, pos: [px0 + 2, 46, 0], surf: SURF.brass });
        for (let z = -W + 8; z < W; z += 16) m.add(cyl(1.2, 1.2, 44, 5), { col: PAL.brass, pos: [px0 + 2, 23, z], surf: SURF.brass });
        m.add(box(12, WALL_H, W * 2 + Tw * 2), { col: lacquer, pos: [px1, WALL_H / 2, 0], surf: SURF.paint });
      }
      for (const s of [-1, 1]) {
        const y = s * (W + Tw / 2);
        // the south wall has its door gaps (the doors are drawn on their own); the north wall is whole
        const cuts = s > 0 ? c.doors.map((d) => [d - T.doorW / 2, d + T.doorW / 2]).sort((a, b) => a[0] - b[0]) : [];
        let a = open ? -1570 : c.x0 - Tw / 2;
        for (const [d0, d1] of [...cuts, [c.x1 + Tw / 2, c.x1 + Tw / 2]]) {
          const len = d0 - a;
          if (len > 2) {
            const cx = (a + d0) / 2;
            // lower panel, window band (glass between pillars), upper panel; two faces: lacquer out, teak in
            m.add(box(len, WIN_LO, Tw * 0.5), { col: lacquer, pos: [cx, WIN_LO / 2, y + s * Tw * 0.25], surf: SURF.paint });
            m.add(box(len, WIN_LO, Tw * 0.5), { col: teakIn, pos: [cx, WIN_LO / 2, y - s * Tw * 0.25], surf: SURF.wood });
            m.add(box(len, WALL_H - WIN_HI, Tw), { col: lacquer, pos: [cx, (WIN_HI + WALL_H) / 2, y], surf: SURF.paint });
            const panes = Math.max(1, Math.round(len / 56));
            for (let k = 0; k < panes; k++) {
              const px = a + ((k + 0.5) / panes) * len;
              m.add(box(len / panes - 8, WIN_HI - WIN_LO, 2), { col: 0xf0c080, pos: [px, (WIN_LO + WIN_HI) / 2, y], surf: SURF.bulb, emit: 0.42 });
              m.add(box(6, WIN_HI - WIN_LO, Tw), { col: lacquer, pos: [a + (k / panes) * len + 3, (WIN_LO + WIN_HI) / 2, y], surf: SURF.paint });
            }
            // the gilt lining stripe and the brass handrail inside
            m.add(box(len, 2.4, 0.8), { col: GT.gilt, pos: [cx, WIN_LO - 4, y + s * (Tw / 2 + 0.4)], surf: SURF.gold });
            m.add(box(len, 1.6, 0.8), { col: GT.gilt, pos: [cx, WIN_HI + 3, y + s * (Tw / 2 + 0.4)], surf: SURF.gold });
            m.add(box(len, 2.4, 2.4), { col: PAL.brass, pos: [cx, 34, y - s * (Tw / 2 + 1.5)], surf: SURF.brass });
          }
          a = d1;
        }
      }
      // end walls (or the gangway's sides), with bellows between the cars
      for (const [x, open] of [[c.x0, i < CARS.length - 1], [c.x1, i > 0]] as [number, boolean][]) {
        if (!open) {
          if (!(c.id === 'observation' && x === c.x0)) m.add(box(Tw, WALL_H, W * 2 + Tw * 2), { col: lacquer, pos: [x, WALL_H / 2, 0], surf: SURF.paint });
          continue;
        }
        for (const s of [-1, 1]) m.add(box(Tw, WALL_H, W - T.gangHalf + Tw), { col: lacquer, pos: [x, WALL_H / 2, s * (T.gangHalf + (W - T.gangHalf) / 2 + Tw / 2)], surf: SURF.paint });
        m.add(box(Tw, WALL_H - 64, T.gangHalf * 2), { col: lacquer, pos: [x, 64 + (WALL_H - 64) / 2, 0], surf: SURF.paint });
      }
      if (i < CARS.length - 1) {
        const n = CARS[i + 1];
        const gl = c.x0 - n.x1, gx = (c.x0 + n.x1) / 2;
        for (const s of [-1, 1]) for (let k = 0; k < 5; k++) m.add(box(gl / 5 - 1.4, 66, 6), { col: 0x0e0e10, pos: [n.x1 + (k + 0.5) * (gl / 5), 33, s * (T.gangHalf + 3)], surf: SURF.rubber });
        m.add(box(gl, 4, T.gangHalf * 2 + 12), { col: 0x0e0e10, pos: [gx, 66, 0], surf: SURF.rubber });
      }
      // sconces along both walls inside: brass arms and frosted tulip shades
      if (c.id !== 'tender') for (let x = c.x0 + 60; x < c.x1 - 30; x += 120) for (const s of [-1, 1]) {
        const z = s * (W - 4);
        m.add(box(2, 2, 8), { col: PAL.brass, pos: [x, 58, z - s * 3], surf: SURF.brass });
        m.add(cone(4.4, 7, 8), { col: c.id === 'funeral' ? 0xb8a8ff : 0xffe0b0, pos: [x, 62, z - s * 7], rot: [Math.PI, 0, 0], surf: SURF.bulb, emit: 1.1 });
      }
    }
    // the tender's sides are open-topped iron, its front the locomotive's cab; the observation platform's rail
    m.add(box(4, 40, T.halfW * 2), { col: weather(0x2a2826, 0.45), pos: [T.front - 8, 20, 0], surf: SURF.iron });
  }, 0.2);
}

/** The roofs: a clerestory over each car (shown over the copies nobody local is in). */
function roofs(): THREE.BufferGeometry {
  return B((m) => {
    const roof = weather(0x1a1c1e, 0.35, 0.05, 0x2e2e2c);
    for (const c of CARS) {
      if (c.id === 'tender') continue;
      const L = c.x1 - c.x0 + 6, cx = (c.x0 + c.x1) / 2;
      const x0 = c.id === 'observation' ? -1570 : c.x0;
      const l = c.x1 - x0 + 6, lx = (x0 + c.x1) / 2;
      m.add(box(l, 6, T.halfW * 2 + 30), { col: roof, pos: [lx, WALL_H + 3, 0], surf: SURF.paint });
      m.add(box(l - 30, 14, 100), { col: roof, pos: [lx, WALL_H + 13, 0], surf: SURF.paint });
      for (let x = x0 + 30; x < c.x1 - 20; x += 46) for (const s of [-1, 1]) m.add(box(30, 9, 1), { col: 0xffcf8a, pos: [x, WALL_H + 13, s * 50.5], surf: SURF.bulb, emit: 0.7 });
      m.add(box(l - 34, 4, 104), { col: weather(0x141618, 0.35), pos: [lx, WALL_H + 22, 0], surf: SURF.paint });
      // the lamp tops and ventilators along the ridge
      for (let x = x0 + 50; x < c.x1 - 30; x += 110) m.add(cyl(6, 7, 8, 8), { col: 0x101010, pos: [x, WALL_H + 28, 0], surf: SURF.iron });
      void L;
      void cx;
    }
  }, 0.15);
}

/** The locomotive (local x loco0..locoFront, facing east): boiler, smokebox, chimney, domes, cab, wheels, headlamp. */
function locomotive(): THREE.BufferGeometry {
  return B((m) => {
    const x0 = T.loco0, x1 = T.locoFront, L = x1 - x0;
    const black = weather(0x101012, 0.3, 0.05, 0x24262a);
    // the frames and running plate, the driving wheels showing below the boiler, red buffer beam
    m.add(box(L, 14, 200), { col: 0x0e0e0e, pos: [x0 + L / 2, 20, 0], surf: SURF.iron });
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const wx = x0 + 160 + k * 110;
        m.add(cyl(46, 46, 10, 24), { col: 0x5a1410, pos: [wx, 46, s * 92], rot: [Math.PI / 2, 0, 0], surf: SURF.paint });
        m.add(torus(46, 3, 6, 24), { col: PAL.iron, pos: [wx, 46, s * 97], surf: SURF.iron });
        m.add(cyl(10, 10, 14, 12), { col: PAL.brass, pos: [wx, 46, s * 96], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
      }
      m.add(box(330, 8, 6), { col: 0x8a8a8c, pos: [x0 + 325, 46, s * 102], surf: SURF.iron });
    }
    // the boiler, banded in brass, the smokebox with its door, the chimney and the domes
    m.add(cyl(78, 78, L - 240, 28), { col: black, pos: [x0 + 120 + (L - 240) / 2 + 60, 120, 0], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
    for (let k = 0; k < 5; k++) m.add(torus(79, 3, 6, 28), { col: PAL.brass, pos: [x0 + 220 + k * 70, 120, 0], rot: [0, Math.PI / 2, 0], surf: SURF.brass });
    m.add(cyl(84, 84, 70, 28), { col: 0x0c0c0e, pos: [x1 - 50, 120, 0], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
    m.add(cyl(72, 72, 6, 28), { col: 0x14141a, pos: [x1 - 13, 120, 0], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
    m.add(cyl(24, 32, 80, 16), { col: 0x0c0c0e, pos: [x1 - 60, 230, 0], surf: SURF.iron });
    m.add(torus(28, 5, 6, 18), { col: PAL.brass, pos: [x1 - 60, 270, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
    m.add(sphere(30, 16, 12), { col: weather(PAL.brass, 0.3), pos: [x0 + 330, 196, 0], surf: SURF.brass });
    m.add(sphere(24, 14, 10), { col: black, pos: [x0 + 230, 192, 0], surf: SURF.iron });
    m.add(cyl(4, 4, 30, 8), { col: PAL.brass, pos: [x0 + 290, 216, 0], surf: SURF.brass });
    // the cab at the back of the boiler (over the footplate, open toward the tender)
    m.add(rbox(150, 170, 220, 4), { col: weather(0x13261c, 0.3), pos: [x0 + 80, 120, 0], surf: SURF.paint });
    m.add(rbox(170, 10, 236, 3), { col: 0x0c0c0e, pos: [x0 + 80, 210, 0], surf: SURF.paint });
    for (const s of [-1, 1]) m.add(box(50, 50, 2), { col: 0xffb060, pos: [x0 + 80, 150, s * 111], surf: SURF.bulb, emit: 1.3 });
    m.add(box(60, 40, 2), { col: 0xff8a30, pos: [x0 + 6, 70, 0], rot: [0, Math.PI / 2, 0], surf: SURF.bulb, emit: 1.8 });
    // the buffer beam, the cowcatcher, the headlamp and the number 13
    m.add(box(16, 30, 210), { col: 0x6a1410, pos: [x1 - 8, 34, 0], surf: SURF.paint });
    for (const s of [-1, 1]) m.add(cyl(12, 12, 26, 12), { col: PAL.iron, pos: [x1 + 6, 36, s * 70], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
    for (let i = 0; i < 9; i++) m.add(box(40, 3, 3), { col: PAL.iron, pos: [x1 + 18, 14, -80 + i * 20], rot: [0, 0, -0.7], surf: SURF.iron });
    m.add(cyl(20, 24, 22, 16), { col: 0x14141a, pos: [x1 - 4, 200, 0], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
    m.add(cyl(17, 17, 2, 16), { col: 0xfff0c0, pos: [x1 + 8, 200, 0], rot: [0, 0, Math.PI / 2], surf: SURF.bulb, emit: 3 });
    m.add(rbox(4, 26, 46, 1), { col: PAL.brass, pos: [x1 - 10, 120, 0], surf: SURF.brass });
  }, 0.3);
}

/** A sliding door panel (local: centred on its gap, along X), with its window. */
function doorPanel(): THREE.BufferGeometry {
  return B((m) => {
    const lacquer = weather(0x13261c, 0.3, 0.05, 0x24302a);
    m.add(box(T.doorW, WALL_H - 2, 6), { col: lacquer, pos: [0, WALL_H / 2, 0], surf: SURF.paint });
    m.add(box(T.doorW - 30, 22, 7), { col: 0xffcf8a, pos: [0, (WIN_LO + WIN_HI) / 2, 0], surf: SURF.bulb, emit: 0.9 });
    m.add(box(T.doorW, 2, 7), { col: GT.gilt, pos: [0, WIN_LO - 4, 0], surf: SURF.gold });
    m.add(cyl(1.4, 1.4, 22, 6), { col: PAL.brass, pos: [T.doorW / 2 - 8, 36, 4], surf: SURF.brass });
  }, 0.1);
}

/** The whole train's model in its own frame (one draw per copy). */
function trainModel(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [floors(), shells(), locomotive()];
  for (const p of TRAIN_FURNITURE) {
    const fn = GT_KIT[p.kind];
    if (!fn) continue;
    // the stretched pieces (partitions) scale along their long side
    let sx = 1, sz = 1, yaw = p.yaw ?? 0;
    if (p.kind === 'gt_partition' && (p.variant ?? 0) === 0) sx = (p.hw ?? 50) / 50;
    if (p.kind === 'gt_luggage') {
      sx = (p.hw ?? 30) / 30;
      sz = (p.hh ?? 28) / 28;
    }
    if (p.kind === 'gt_coal') sx = sz = (p.r ?? 38) / 38;
    if (p.kind === 'gt_rail') yaw = 0;
    // the north row of seats and tables faces south; v1 is the south row (faces north)
    parts.push(placed(fn(p.variant ?? 0), p.x, 0, p.y, yaw, sx, 1, sz));
  }
  const g = mergeGeometries(parts, false)!;
  g.computeBoundingSphere();
  return g;
}

export class TrainRender {
  readonly body: ActorBatch;
  readonly roof: ActorBatch;
  readonly doors: ActorBatch;
  /** where each copy is drawn this frame (x offset along the track; hidden when null) */
  private shown: (number | null)[] = REGIONS.map(() => 0);

  constructor(root: THREE.Object3D) {
    const mat = actorMaterial({ dither: true, detail: true, emitBoost: 2.6, envIntensity: 0.6 });
    this.body = new ActorBatch(trainModel(), mat, REGIONS.length, { shadow: true });
    this.roof = new ActorBatch(roofs(), actorMaterial({ dither: true, detail: true, emitBoost: 2.2 }), REGIONS.length, { shadow: true });
    this.doors = new ActorBatch(doorPanel(), mat, REGIONS.length * 11, { shadow: false });
    for (const b of [this.body, this.roof, this.doors]) {
      b.rim = [0, 0, 0, 0];
      root.add(b.mesh);
    }
  }

  /** Where station r's copy stands along its track now (0 at rest, west while pulling in, east pulling out), or null. */
  static offset(r: number, st: TrainState): number | null {
    if (r === TRANSIT) return 0;
    if (st.phase === 'dwell') return st.at === r ? 0 : null;
    if (st.phase === 'approach') {
      const rem = st.legDist - st.dist;
      return st.to === r && rem < 5200 ? -rem : null;
    }
    if (st.to === r && !(st.passing && r === 4)) {
      const rem = st.legDist - st.dist;
      if (rem < 5200) return -rem;
    }
    if (st.at === r && st.dist < 5200) return st.dist;
    return null;
  }

  update(st: TrainState, localX: number, localY: number, time: number): void {
    const here = regionAt(localX, localY);
    this.body.begin();
    this.roof.begin();
    this.doors.begin();
    for (let r = 0; r < REGIONS.length; r++) {
      const off = TrainRender.offset(r, st);
      this.shown[r] = off;
      if (off === null) continue;
      const o = trainOrigin(r);
      const x = o.x + off, y = o.y;
      const i = this.body.add(x, y, 0, 0, 1);
      // the lamps inside flicker a little, together
      const fl = 0.92 + 0.08 * Math.sin(time * 3.1 + r) * Math.sin(time * 7.7 + r * 2);
      this.body.tint(i, 1, 1, 1, fl);
      // the roof over the copy you're in is cut away (and over the moving one only while you're aboard)
      const inside = here === r && Math.abs(localY - o.y) < T.halfW + 40 && localX > o.x + T.rear - 40 && localX < o.x + T.locoFront;
      if (!inside) this.roof.add(x, y, 0, 0, 1);
      // doors: open (slid east into the wall) while the train stands here with them open
      const open = r !== TRANSIT && st.phase === 'dwell' && st.at === r && st.doors ? 1 : 0;
      const k = open ? Math.min(1, (st.t - 2) / 0.8) * Math.min(1, (st.departIn - 3) / 0.8) : 0;
      for (const c of CARS) for (const d of c.doors) {
        const di = this.doors.add(x + d + Math.max(0, k) * (T.doorW - 6), y + T.halfW + T.wallT / 2 + (k > 0 ? 7 : 0), 0, 0, 1);
        this.doors.tint(di, 1, 1, 1, fl);
      }
    }
    this.body.end();
    this.roof.end();
    this.doors.end();
  }

  /** Station r's copy's x offset this frame (null: not drawn). */
  shownAt(r: number): number | null {
    return this.shown[r];
  }
}

export const _unused = { lathe, rbox };
