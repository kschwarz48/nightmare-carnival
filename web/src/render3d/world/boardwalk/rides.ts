// The Boardwalk's rides (D-68): the skyline. The Undertow, a wooden coaster in pale weathered timber (after
// the photograph's white lattice), its rails and ties following the track, lattice bents from the ground to
// the rails, chase lights along it, and its ghost train running the timetable the sim keeps; the Sea Wheel
// turning, its gondolas hanging plumb; the Plunge's ring of seats creeping up its tower and dropping; the
// Kraken's arms sweeping round and up. All of it a pure function of sim time, as the sim sees it.

import * as THREE from 'three';
import { BENTS, KRAKEN, PLUNGE, RIDE, WHEEL, trackAt, trainU, wheelAngle } from '../../../data/boardwalk';
import { ActorBatch, StaticBatch } from '../../core/batch';
import { C, SURF, box, cone, cyl, ellipsoid, lathe, rbox, sphere, torus, tube, weather, type V3 } from '../../core/geo';
import { actorMaterial } from '../../core/materials';
import { ModelBuilder, PAL, eyes } from '../../models/kit';
import type { Bulb } from './structures';

const paleTimber = weather(0x9a968c, 0.45, 0.03, 0x5a564e);
const iron = weather(0x2a2c2e, 0.45, 0.05, 0x5a3a24);

/** The coaster's static structure: rails, ties, lattice bents and the chase lights' sockets. */
function coasterGeometry(bulbs: Bulb[]): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const N = 900;
  const pts: V3[] = [];
  for (let i = 0; i <= N; i++) {
    const p = trackAt(i / N);
    pts.push([p[0], p[2], p[1]]);
  }
  // the two running rails and the guard timbers beneath them, offset to either side of the centreline
  const lateral = (i: number) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
    const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l] as [number, number];
  };
  for (const off of [-18, 18]) {
    const rail: V3[] = pts.map((p, i) => {
      const [lx, lz] = lateral(i);
      return [p[0] + lx * off, p[1] + 6, p[2] + lz * off];
    });
    m.add(tube(rail, 2.6, 5, N), { col: iron, surf: SURF.iron });
    const guard: V3[] = rail.map((p) => [p[0], p[1] - 9, p[2]]);
    m.add(tube(guard, 4.2, 4, N), { col: paleTimber, surf: SURF.wood });
  }
  // ties across the rails every ~22 units, pitched with the track
  let acc = 0;
  for (let i = 1; i < N; i++) {
    const a = pts[i - 1], b = pts[i];
    acc += Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (acc < 22) continue;
    acc = 0;
    const [lx, lz] = lateral(i);
    const yaw = Math.atan2(-lz, lx);
    m.add(box(50, 4, 8), { col: paleTimber, pos: [b[0], b[1] - 2, b[2]], rot: [0, yaw, 0], surf: SURF.wood });
    // a chase light on every third tie, on the outer edge
    if (i % 3 === 0) {
      const x = b[0] + lx * 28, z = b[2] + lz * 28;
      m.add(sphere(2.6, 6, 4), { col: C(0xfff0c8), pos: [x, b[1] + 4, z], surf: SURF.bulb, emit: 1.2 });
      bulbs.push({ x, y: z, h: b[1] + 4, col: [1, 0.55, 0.3] });
    }
  }
  // the bents: two posts from the ground to the rails, ledgers and X-bracing up their height, a cap beam;
  // longitudinal bracing ties each bent to the last (the lattice that makes a wooden coaster)
  let prev: { x: number; y: number; h: number; a: number } | null = null;
  for (const bt of BENTS) {
    const nx = -Math.sin(bt.a), nz = Math.cos(bt.a);
    const yaw = Math.atan2(-nz, nx);
    const H = bt.h - 8;
    for (const s of [-1, 1]) m.add(box(9, H, 9), { col: paleTimber, pos: [bt.x + nx * 46 * s, H / 2, bt.y + nz * 46 * s], surf: SURF.wood });
    m.add(box(110, 8, 12), { col: paleTimber, pos: [bt.x, H, bt.y], rot: [0, yaw, 0], surf: SURF.wood });
    const step = 64;
    for (let y = step; y < H - 20; y += step) {
      m.add(box(96, 5, 6), { col: paleTimber, pos: [bt.x, y, bt.y], rot: [0, yaw, 0], surf: SURF.wood });
      const len = Math.hypot(92, step);
      for (const s of [-1, 1]) m.add(box(len, 4, 4), { col: paleTimber, pos: [bt.x, y - step / 2, bt.y], rot: [0, yaw, s * Math.atan2(step, 92)], surf: SURF.wood });
    }
    if (prev && Math.hypot(bt.x - prev.x, bt.y - prev.y) < 200) {
      const mx = (bt.x + prev.x) / 2, mz = (bt.y + prev.y) / 2;
      const span = Math.hypot(bt.x - prev.x, bt.y - prev.y);
      const along = Math.atan2(-(bt.y - prev.y), bt.x - prev.x);
      const hh = Math.min(H, prev.h - 8);
      for (let y = 64; y < hh - 30; y += 128) {
        for (const s of [-1, 1]) {
          const ox = nx * 46 * s, oz = nz * 46 * s;
          m.add(box(Math.hypot(span, 64), 4, 4), { col: paleTimber, pos: [mx + ox, y, mz + oz], rot: [0, along, Math.atan2(64, span) * (y % 256 < 128 ? 1 : -1)], surf: SURF.wood });
        }
      }
    }
    prev = bt;
  }
  return m.build({ ao: 0.2 });
}

/** One coaster car (the lead car wears a grin: the Last Ride's face, before it wakes). */
function carGeometry(lead: boolean): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(rbox(60, 22, 40, 6, 2), { col: weather(lead ? 0x7a1e22 : 0x5a1a1e, 0.45, 0.05, 0x8a7a6a), pos: [0, 16, 0], surf: SURF.wood });
  m.add(rbox(56, 8, 36, 4, 2), { col: weather(0x2a1a14, 0.4), pos: [0, 28, 0], surf: SURF.velvet });
  m.add(box(4, 14, 34), { col: PAL.gold, pos: [10, 36, 0], surf: SURF.gold });
  m.add(box(62, 4, 42), { col: PAL.gold, pos: [0, 6, 0], surf: SURF.gold });
  for (const s of [-1, 1]) for (const x of [-20, 20]) m.add(cyl(6, 6, 6, 10), { col: iron, pos: [x, 4, s * 20], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
  if (lead) {
    m.add(ellipsoid(16, 20, 18, 12, 8), { col: weather(0xd8c8b0, 0.4), pos: [32, 26, 0], surf: SURF.porcelain });
    eyes(m, { x: 8, y: 32, z: 0, r: 4.5, color: PAL.hotRed, glow: 1.4, part: 0 });
    m.add(box(4, 6, 20), { col: C(0x2a0408), pos: [46, 20, 0], surf: SURF.paint });
  }
  return m.build({ ao: 0.2 });
}

function wheelGeometry(): THREE.BufferGeometry {
  // in the wheel's own frame: x across, y up, z toward the camera; origin at the hub
  const m = new ModelBuilder();
  const R = WHEEL.r;
  for (const z of [-26, 26]) {
    m.add(torus(R, 5, 6, 64), { col: iron, pos: [0, 0, z], surf: SURF.iron });
    m.add(torus(R * 0.55, 3, 5, 48), { col: iron, pos: [0, 0, z], surf: SURF.iron });
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    for (const z of [-26, 26]) m.add(box(R, 4, 4), { col: iron, pos: [Math.cos(a) * R / 2, Math.sin(a) * R / 2, z], rot: [0, 0, a], surf: SURF.iron });
    if (k % 2 === 0) m.add(box(4, 4, 56), { col: iron, pos: [Math.cos(a) * R, Math.sin(a) * R, 0], surf: SURF.iron });
    // a bulb at each spoke's end, and halfway along
    for (const f of [1, 0.55]) {
      m.add(sphere(3.2, 6, 4), { col: C(0xfff0c8), pos: [Math.cos(a) * R * f, Math.sin(a) * R * f, 30], surf: SURF.bulb, emit: 1.2 });
    }
  }
  m.add(cyl(30, 30, 70, 16), { col: weather(0x3a3a3c, 0.4), rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
  m.add(cyl(18, 18, 74, 12), { col: PAL.gold, rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
  return m.build({ ao: 0.15 });
}

function wheelFrameGeometry(): THREE.BufferGeometry {
  // the A-frames either side of the wheel (static, in world space around the wheel's foot)
  const m = new ModelBuilder();
  const H = WHEEL.hubH;
  for (const z of [-60, 60]) {
    for (const s of [-1, 1]) {
      const fx = s * 190, len = Math.hypot(190, H);
      m.add(box(14, len, 14), { col: iron, pos: [fx / 2, H / 2, z], rot: [0, 0, -Math.atan2(fx, H)], surf: SURF.iron });
    }
    for (let y = 80; y < H; y += 90) {
      const w = 380 * (1 - y / H);
      m.add(box(w, 6, 6), { col: iron, pos: [0, y, z], surf: SURF.iron });
    }
  }
  m.add(cyl(10, 10, 130, 8), { col: iron, pos: [0, H, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
  return m.build({ ao: 0.2 });
}

function gondolaGeometry(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(1.4, 1.4, 30, 4), { col: iron, pos: [0, -15, 0], surf: SURF.iron });
  m.add(rbox(44, 34, 34, 6, 2), { col: weather(0x2a4a5a, 0.5, 0.05, 0x6a5a4a), pos: [0, -46, 0], surf: SURF.paint });
  m.add(lathe([[0, 0], [30, 0], [26, 8], [10, 14], [0, 15]], 10), { col: weather(0x7a2a24, 0.5), pos: [0, -30, 0], surf: SURF.paint });
  m.add(box(36, 12, 2), { col: C(0x101418), pos: [0, -40, 18], surf: SURF.glass });
  return m.build({ ao: 0.2 });
}

function plungeGeometry(bulbs: Bulb[]): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const H = PLUNGE.h, x = PLUNGE.x, z = PLUNGE.y;
  for (const [ox, oz] of [[-26, -26], [26, -26], [-26, 26], [26, 26]] as [number, number][]) m.add(box(8, H, 8), { col: weather(0x8a9aa8, 0.4, 0.03), pos: [x + ox, H / 2, z + oz], surf: SURF.iron });
  for (let y = 40; y < H; y += 50) {
    for (const s of [-1, 1]) {
      m.add(box(60, 4, 4), { col: weather(0x8a9aa8, 0.4), pos: [x, y, z + s * 26], surf: SURF.iron });
      m.add(box(4, 4, 60), { col: weather(0x8a9aa8, 0.4), pos: [x + s * 26, y, z], surf: SURF.iron });
      m.add(box(Math.hypot(52, 50), 3, 3), { col: weather(0x8a9aa8, 0.4), pos: [x, y + 25, z + s * 26], rot: [0, 0, s * Math.atan2(50, 52)], surf: SURF.iron });
    }
  }
  // the crown: a ring of bulbs and a spire with a red beacon
  m.add(cyl(60, 50, 26, 16), { col: weather(0x2a3a5a, 0.4), pos: [x, H + 13, z], surf: SURF.paint });
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    m.add(sphere(3.6, 6, 4), { col: C(0xfff0c8), pos: [x + Math.cos(a) * 60, H + 26, z + Math.sin(a) * 60], surf: SURF.bulb, emit: 1.3 });
    bulbs.push({ x: x + Math.cos(a) * 60, y: z + Math.sin(a) * 60, h: H + 26, col: [0.5, 0.8, 1] });
  }
  m.add(cone(14, 90, 8), { col: iron, pos: [x, H + 70, z], surf: SURF.iron });
  m.add(sphere(7, 8, 6), { col: C(0xff3020), pos: [x, H + 120, z], surf: SURF.bulb, emit: 1.6 });
  bulbs.push({ x, y: z, h: H + 120, col: [1, 0.15, 0.1] });
  return m.build({ ao: 0.15 });
}

function plungeRingGeometry(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(torus(50, 10, 6, 20), { col: weather(0x7a1e22, 0.45), rot: [Math.PI / 2, 0, 0], surf: SURF.paint });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    m.add(rbox(16, 26, 14, 3, 1), { col: weather(0x2a2a2a, 0.4), pos: [Math.cos(a) * 62, -14, Math.sin(a) * 62], rot: [0, -a, 0], surf: SURF.paint });
  }
  return m.build({ ao: 0.2 });
}

function krakenArmGeometry(): THREE.BufferGeometry {
  // one arm of the Kraken (a tentacle-shaped boom with a tub of two seats at its end), pointing +x
  const m = new ModelBuilder();
  m.add(tube([[20, 60, 0], [90, 70, 0], [160, 52, 0], [KRAKEN.armLen, 30, 0]], (t) => 12 - t * 6, 6, 16), { col: weather(0x3a1e3a, 0.45, 0.05, 0x5a3a2a), surf: SURF.paint });
  for (let k = 0; k < 5; k++) m.add(sphere(4 - k * 0.4, 6, 4), { col: weather(0xc8a0b0, 0.4), pos: [40 + k * 38, 74 - k * 6, 10], surf: SURF.porcelain });
  m.add(cyl(30, 26, 26, 14), { col: weather(0x1e4a5a, 0.45), pos: [KRAKEN.armLen, 16, 0], surf: SURF.paint });
  m.add(sphere(4, 6, 4), { col: C(0xfff0c8), pos: [KRAKEN.armLen, 34, 26], surf: SURF.bulb, emit: 1.2 });
  return m.build({ ao: 0.2 });
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _d = new THREE.Vector3(), _x = new THREE.Vector3(1, 0, 0);

export class Rides {
  readonly bulbs: Bulb[] = [];
  private cars: ActorBatch;
  private lead: ActorBatch;
  private gondolas: ActorBatch;
  private wheel: THREE.Mesh;
  private ring: THREE.Mesh;
  private kraken: THREE.Group;

  constructor(root: THREE.Object3D) {
    const statics = (geo: THREE.BufferGeometry, shadow = true) => {
      const b = new StaticBatch(geo, actorMaterial({ dither: true, detail: true, emitBoost: 2.4 }), 1, { shadow });
      b.rim = [0, 0, 0, 0];
      b.add(0, 0, 0, 0, 1);
      b.freeze();
      root.add(b.mesh);
      return b;
    };
    statics(coasterGeometry(this.bulbs));
    statics(plungeGeometry(this.bulbs));
    // the Sea Wheel: frame fixed, wheel turning about its hub
    const frame = new StaticBatch(wheelFrameGeometry(), actorMaterial({ dither: true, detail: true, emitBoost: 2.4 }), 1, { shadow: true });
    frame.rim = [0, 0, 0, 0];
    frame.add(WHEEL.x, WHEEL.y, 0, 0, 1);
    frame.freeze();
    root.add(frame.mesh);
    this.wheel = new THREE.Mesh(wheelGeometry(), actorMaterial({ dither: true, emitBoost: 2.6 }));
    this.wheel.position.set(WHEEL.x, WHEEL.hubH, WHEEL.y);
    this.wheel.castShadow = true;
    root.add(this.wheel);
    this.gondolas = new ActorBatch(gondolaGeometry(), actorMaterial({ dither: true, emitBoost: 2.4 }), WHEEL.cars, { shadow: true });
    this.gondolas.rim = [0, 0, 0, 0];
    root.add(this.gondolas.mesh);
    // the train
    this.cars = new ActorBatch(carGeometry(false), actorMaterial({ emitBoost: 2.4 }), RIDE.cars, { shadow: true });
    this.lead = new ActorBatch(carGeometry(true), actorMaterial({ emitBoost: 2.4 }), 1, { shadow: true });
    for (const b of [this.cars, this.lead]) {
      b.rim = [0, 0, 0, 0];
      root.add(b.mesh);
    }
    // the Plunge's ring of seats
    this.ring = new THREE.Mesh(plungeRingGeometry(), actorMaterial({ emitBoost: 2.4 }));
    this.ring.position.set(PLUNGE.x, 60, PLUNGE.y);
    this.ring.castShadow = true;
    root.add(this.ring);
    // the Kraken
    this.kraken = new THREE.Group();
    this.kraken.position.set(KRAKEN.x, 0, KRAKEN.y);
    const armGeo = krakenArmGeometry(), armMat = actorMaterial({ dither: true, emitBoost: 2.4 });
    for (let k = 0; k < KRAKEN.arms; k++) {
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.rotation.y = (k / KRAKEN.arms) * Math.PI * 2;
      arm.castShadow = true;
      this.kraken.add(arm);
    }
    const hub = new THREE.Mesh(new ModelBuilder().add(cyl(40, 50, 90, 14), { col: weather(0x3a1e3a, 0.45), pos: [0, 45, 0], surf: SURF.paint }).add(sphere(44, 14, 10), { col: weather(0x5a2a4a, 0.45), pos: [0, 96, 0], scale: [1, 0.7, 1], surf: SURF.paint }).build({ ao: 0.2 }), armMat);
    this.kraken.add(hub);
    root.add(this.kraken);
  }

  /** Where the Sea Wheel's gondola k hangs (sim x/y, height of its floor). */
  static gondolaAt(k: number, t: number): [number, number, number] {
    const a = wheelAngle(k, t);
    return [WHEEL.x + Math.cos(a) * WHEEL.r, WHEEL.y + 30, WHEEL.hubH + Math.sin(a) * WHEEL.r];
  }

  update(t: number, inView: (x: number, y: number) => boolean): void {
    // the train: each car on the track, pitched along it
    for (const b of [this.cars, this.lead]) b.begin();
    const { u } = trainU(t);
    for (let k = 0; k < RIDE.cars; k++) {
      const uu = u - k * RIDE.carGap;
      const a = trackAt(uu), b2 = trackAt(uu + 0.002);
      _p.set(a[0], a[2] + 6, a[1]);
      _d.set(b2[0] - a[0], b2[2] - a[2], b2[1] - a[1]).normalize();
      _q.setFromUnitVectors(_x, _d);
      _m.compose(_p, _q, _s);
      (k === 0 ? this.lead : this.cars).addMatrix(_m);
    }
    for (const b of [this.cars, this.lead]) b.end();
    // the wheel and its plumb gondolas
    this.wheel.rotation.z = -(t / WHEEL.period) * Math.PI * 2;
    this.gondolas.begin();
    if (inView(WHEEL.x, WHEEL.y - 200)) {
      for (let k = 0; k < WHEEL.cars; k++) {
        const g = Rides.gondolaAt(k, t);
        this.gondolas.add(g[0], g[1], g[2], 0, 1);
      }
    }
    this.gondolas.end();
    // the Plunge: a slow creep to the top, a pause, the drop, a bounce
    const c = (t % PLUNGE.period) / PLUNGE.period;
    const top = PLUNGE.h - 60;
    const y = c < 0.7 ? 60 + (top - 60) * (c / 0.7) : c < 0.78 ? top : c < 0.84 ? top - (top - 60) * ((c - 0.78) / 0.06) ** 2 : 60 + 30 * Math.abs(Math.sin((c - 0.84) * 40)) * (1 - (c - 0.84) / 0.16);
    this.ring.position.y = y;
    // the Kraken: round, and each arm rising and falling in turn
    this.kraken.rotation.y = (t / KRAKEN.period) * Math.PI * 2;
    this.kraken.children.forEach((arm, k) => {
      if (k < KRAKEN.arms) arm.rotation.z = 0.18 * Math.sin(t * 1.3 + k * 1.1);
    });
  }

  /** Where the Sea Wheel's spoke-end bulb k (of 24) is at time t (sim x/y, height). */
  static wheelBulb(k: number, t: number, f = 1): [number, number, number] {
    const a = (k / 24) * Math.PI * 2 - (t / WHEEL.period) * Math.PI * 2;
    return [WHEEL.x + Math.cos(a) * WHEEL.r * f, WHEEL.y + 30, WHEEL.hubH + Math.sin(a) * WHEEL.r * f];
  }

  /** The Plunge's seats' height (for its light and its scream). */
  get plungeY(): number {
    return this.ring.position.y;
  }
}
