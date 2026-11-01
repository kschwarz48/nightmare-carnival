// The Ghost Train's boss rigs (D-80): the Stationmaster with his lantern and his cartwheel watch, the Stoker
// with the furnace in his chest, the Widow in mourning black with her soul lantern, the Iron Foreman's boiler
// body and steam hammer, the Hour Thief's clock face and hands, the Night Express (a locomotive with a face),
// and the Conductor with his punch. Same rules as the other maps' rigs: articulated ModelBuilder models
// driven by each boss's replicated state and pose.

import * as THREE from 'three';
import { clamp, lerp } from '../core/math';
import type { Game } from '../sim/game';
import type { BossBase } from '../sim/bosses/boss';
import { ModelBuilder, SURF, box, cone, cyl, ellipsoid, lathe, rbox, sphere, torus, tube, vnoise, weather, C, type ColorFn } from './core/geo';
import { pool } from './core/materials';
import { PAL, glove, shoe } from './models/kit';
import type { GameRenderer3D } from './renderer3d';
import { Rig } from './rig';

/** Turn a rig's root to face a point, smoothly. */
function faceToward(o: THREE.Object3D, x: number, y: number, tx: number, ty: number, dt: number, rate = 6): void {
  const want = Math.atan2(tx - x, ty - y);
  let d = want - o.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  o.rotation.y += d * (1 - Math.exp(-dt * rate));
}
const ghostSkin = weather(0x9aa0a4, 0.35, 0.12, 0x5a6066);
const iron = weather(0x26282a, 0.45, 0.05, 0x5a3a24);
const brass = weather(PAL.brass, 0.35, 0.04, 0x3a4a30);
const black = weather(0x18161a, 0.3, 0.06, 0x2e2a30);
const P = (x: number) => x;
/** A sleeve and glove hanging from a shoulder pivot (the arm points down -y). */
function arm(m: ModelBuilder, col: number | ColorFn, len: number, r: number, gloveCol: number): void {
  m.add(cyl(r, r * 0.86, len, 8), { col, pos: [0, -len / 2, 0], surf: SURF.cloth });
  glove(m, [0, -len - 3, 2], r * 1.25, 0, [0, 0, 0], gloveCol);
}
/** A clock face (a dial with twelve marks) facing +Z at the origin. */
function dial(m: ModelBuilder, R: number, face: number, rim: number | ColorFn, glow = 0.6): void {
  m.add(cyl(R, R, 3, 32), { col: face, rot: [Math.PI / 2, 0, 0], surf: SURF.porcelain, emit: glow });
  m.add(torus(R, R * 0.07, 6, 32), { col: rim, surf: SURF.brass });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    m.add(box(R * 0.05, R * (k % 3 ? 0.1 : 0.18), 1), { col: 0x1a1612, pos: [Math.sin(a) * R * 0.82, Math.cos(a) * R * 0.82, 1.8], rot: [0, 0, -a], surf: SURF.paint });
  }
}
/** A clock hand node (points up +y from its pivot). */
function hand(r: Rig, parent: THREE.Object3D, len: number, w: number, z: number, col = 0x1a1612): THREE.Group {
  const n = r.node(parent, 0, 0, z);
  const m = new ModelBuilder();
  m.add(box(w, len, 1.2), { col, pos: [0, len / 2 - len * 0.12, 0], surf: SURF.iron });
  m.add(cone(w * 1.1, w * 2.2, 4), { col, pos: [0, len * 0.88 + w, 0], surf: SURF.iron });
  r.mesh(m.build({ ao: 0 }), n, false);
  return n;
}

// ======================================================================= the Stationmaster
export class StationmasterRig extends Rig {
  man = this.node();
  head: THREE.Group;
  armR: THREE.Group;
  armL: THREE.Group;
  watch: THREE.Group;
  hHour: THREE.Group;
  hMin: THREE.Group;
  constructor(scene: THREE.Scene) {
    super(scene);
    const coat = weather(0x1e2a24, 0.45, 0.08, 0x4a5a4a);
    const m = new ModelBuilder();
    for (const s of [-1, 1]) {
      m.add(cyl(4.6, 4, 42, 8), { col: weather(0x222226, 0.4), pos: [s * 7, 21, 0], surf: SURF.cloth });
      shoe(m, [s * 7, 0, -1], 14, PAL.ink, 0, [0, 0, 0], 0.1);
    }
    // the frock coat to the knee, brass buttons, a waistcoat with a watch chain
    m.add(lathe([[0, 22], [16, 24], [15, 44], [14, 62], [16, 82], [13, 92], [6, 96], [0, 97]], 18, 10), { col: coat, scale: [1, 1, 0.82], surf: SURF.cloth });
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) m.add(sphere(1.3, 6, 4), { col: PAL.brass, pos: [s * 5, 58 + i * 7, 12.6], surf: SURF.brass });
    m.add(tube([[-6, 66, 13], [0, 62, 13.5], [6, 66, 13]], 0.5, 4, 10), { col: PAL.brass, surf: SURF.brass });
    m.add(cyl(5, 6, 6, 10), { col: 0xd8d0c0, pos: [0, 97, 0], surf: SURF.cloth });
    this.mesh(m.build({ ao: 0.3 }), this.man);
    this.head = this.node(this.man, 0, 99, 0);
    const hm = new ModelBuilder();
    hm.add(ellipsoid(10, 12.5, 10, 14, 10), { col: ghostSkin, pos: [0, 11, 0], surf: SURF.skin });
    hm.add(ellipsoid(6.5, 2.2, 3, 10, 6), { col: 0xd8d4cc, pos: [0, 6.5, 9], surf: SURF.cloth }); // mutton-chop whiskers' moustache
    for (const s of [-1, 1]) {
      hm.add(ellipsoid(3, 6, 3, 8, 6), { col: 0xd8d4cc, pos: [s * 8.5, 7, 4], surf: SURF.cloth });
      hm.add(sphere(1.1, 6, 4), { col: 0xffe8b0, pos: [s * 3.8, 13.5, 9.4], surf: SURF.bulb, emit: 1.4 });
    }
    // the peaked stationmaster's cap with gold braid
    hm.add(cyl(11, 11.5, 7, 18), { col: 0x14181c, pos: [0, 23, 0], surf: SURF.cloth });
    hm.add(cyl(11.6, 11.6, 1.6, 18, true), { col: PAL.gold, pos: [0, 21, 0], surf: SURF.gold });
    hm.add(ellipsoid(9, 1, 7, 12, 4), { col: 0x0a0c0e, pos: [0, 19.6, 8], rot: [-0.2, 0, 0], surf: SURF.rubber });
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    this.armR = this.node(this.man, -15, 90, 0);
    const ar = new ModelBuilder();
    arm(ar, coat, 40, 4, 0xd8d4c8);
    // the signal lantern on its chain, red glass on one side, green on the other
    ar.add(cyl(0.5, 0.5, 14, 4), { col: PAL.iron, pos: [0, -50, 4], surf: SURF.iron });
    ar.add(cyl(6, 7, 13, 10), { col: PAL.iron, pos: [0, -63, 4], surf: SURF.iron });
    ar.add(cyl(5.2, 5.2, 8, 10, true), { col: 0xff3020, pos: [0, -63, 4], surf: SURF.glass, emit: 2 });
    this.mesh(ar.build({ ao: 0.1 }), this.armR);
    this.armL = this.node(this.man, 15, 90, 0);
    const al = new ModelBuilder();
    arm(al, coat, 40, 4, 0xd8d4c8);
    al.add(cyl(1.2, 1.2, 9, 6), { col: PAL.brass, pos: [0, -46, 7], rot: [Math.PI / 2, 0, 0], surf: SURF.brass }); // the whistle
    this.mesh(al.build({ ao: 0.1 }), this.armL);
    // the cartwheel watch slung on his back like a shield
    this.watch = this.node(this.man, 0, 70, -22);
    const wm = new ModelBuilder();
    dial(wm, 34, 0xe8e0c8, brass);
    wm.add(cyl(4, 4, 10, 10), { col: PAL.brass, pos: [0, 38, 0], surf: SURF.brass });
    wm.add(torus(5, 1.4, 6, 12), { col: PAL.brass, pos: [0, 44, 0], surf: SURF.brass });
    this.mesh(wm.build({ ao: 0 }), this.watch);
    this.hHour = hand(this, this.watch, 20, 2.6, 2.4);
    this.hMin = hand(this, this.watch, 28, 1.8, 3);
  }
  update(b: BossBase, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (!this.group.visible) return;
    const Q = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    this.group.position.set(x, 0, y);
    this.group.scale.setScalar(1.55);
    const p = g.nearestLiving(x, y);
    if (!b.dead) faceToward(this.group, x, y, p.x, p.y, dt);
    const wh = clamp(Q.whistle ?? 0, 0, 1), wave = clamp(Q.wave ?? 0, 0, 1), fall = clamp(Q.fall ?? 0, 0, 1);
    const swing = Q.swing ?? 0, lan = clamp(Q.lantern ?? 0, 0, 1);
    this.armL.rotation.x = -wh * 1.9 - wave * 0.6;
    this.armR.rotation.x = -0.3 - lan * 1.4 - wave * 1.2 + Math.sin(t * 2.4) * 0.06;
    this.armR.rotation.z = lan > 0 ? Math.sin(swing) * 0.6 : 0;
    this.head.rotation.x = -wh * 0.2;
    this.man.position.y = Math.abs(Math.sin((Q.step ?? 0) * 0.5)) * 2.5;
    // the watch keeps the night's own time; it stops when he falls
    const secs = b.dead ? 0 : g.time;
    this.hMin.rotation.z = -(secs / 60) * Math.PI * 2 / 60 * 12;
    this.hHour.rotation.z = -(secs / 3600) * Math.PI * 2;
    this.watch.rotation.z = (Q.watch ?? 0) * 0.3;
    this.man.rotation.x = fall * 0.9;
    this.state(b, t, [1, 1, 1, 1], [0.9, 0.85, 0.6, 0.5]);
    if (b.awake && !b.dead) {
      pool.add(x, y, 420, 0.55, 1, 0.8, 0.55, 170, 3);
      pool.add(x - 20, y + 20, 160, 0.8 + lan * 0.6, 1, 0.25, 0.15, 60, 2);
    }
  }
}

// ======================================================================= the Stoker
export class StokerRig extends Rig {
  man = this.node();
  head: THREE.Group;
  armR: THREE.Group;
  armL: THREE.Group;
  furnace: THREE.Mesh;
  constructor(scene: THREE.Scene) {
    super(scene);
    const soot = weather(0x1e1a18, 0.5, 0.06, 0x3a2e26);
    const m = new ModelBuilder();
    for (const s of [-1, 1]) {
      m.add(cyl(8, 7, 40, 10), { col: soot, pos: [s * 11, 20, 0], surf: SURF.rubber });
      m.add(rbox(16, 8, 22, 3), { col: 0x14100e, pos: [s * 11, 4, 3], surf: SURF.rubber });
    }
    // a hunched barrel of a body, a leather apron, the furnace door in its chest
    m.add(lathe([[0, 36], [22, 38], [28, 56], [30, 76], [26, 94], [14, 104], [0, 106]], 18, 10), { col: soot, scale: [1, 1, 0.85], pos: [0, 0, -4], surf: SURF.rubber });
    m.add(rbox(36, 46, 6, 3), { col: weather(0x3a2416, 0.45), pos: [0, 58, 22], surf: SURF.cloth });
    m.add(rbox(22, 20, 4, 2), { col: PAL.iron, pos: [0, 76, 24], surf: SURF.iron });
    for (let i = 0; i < 4; i++) m.add(box(20, 1.4, 1.5), { col: 0x2a2624, pos: [0, 70 + i * 4, 26.4], surf: SURF.iron });
    this.mesh(m.build({ ao: 0.35 }), this.man);
    // the fire behind the grate: its own mesh so it can burn brighter
    const fm = new ModelBuilder();
    fm.add(box(18, 16, 1), { col: 0xff7020, pos: [0, 76, 25.6], surf: SURF.bulb, emit: 2.5 });
    this.furnace = this.mesh(fm.build({ ao: 0 }), this.man, false);
    this.head = this.node(this.man, 0, 100, 4);
    const hm = new ModelBuilder();
    hm.add(ellipsoid(12, 11, 11, 14, 10), { col: soot, pos: [0, 6, 4], surf: SURF.rubber });
    for (const s of [-1, 1]) hm.add(sphere(2, 8, 6), { col: 0xffb040, pos: [s * 4.5, 8, 14.4], surf: SURF.bulb, emit: 2.4 });
    hm.add(box(10, 2.4, 2), { col: 0xff6a10, pos: [0, 1, 14.6], surf: SURF.bulb, emit: 1.8 });
    hm.add(cyl(13, 12, 5, 16), { col: 0x14100e, pos: [0, 14, 2], surf: SURF.cloth });
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    this.armR = this.node(this.man, -28, 86, 0);
    const ar = new ModelBuilder();
    ar.add(cyl(7, 6, 46, 10), { col: soot, pos: [0, -23, 0], surf: SURF.rubber });
    ar.add(sphere(8, 10, 8), { col: soot, pos: [0, -50, 4], surf: SURF.rubber });
    // the coal shovel, as long as a man
    ar.add(cyl(1.6, 1.6, 90, 6), { col: weather(0x4a3a28, 0.4), pos: [0, -50, 30], rot: [Math.PI / 2, 0, 0], surf: SURF.wood });
    ar.add(rbox(20, 2, 24, 1), { col: PAL.iron, pos: [0, -52, 78], rot: [0.2, 0, 0], surf: SURF.iron });
    this.mesh(ar.build({ ao: 0.1 }), this.armR);
    this.armL = this.node(this.man, 28, 86, 0);
    const al = new ModelBuilder();
    al.add(cyl(7, 6, 46, 10), { col: soot, pos: [0, -23, 0], surf: SURF.rubber });
    al.add(sphere(8.5, 10, 8), { col: soot, pos: [0, -50, 4], surf: SURF.rubber });
    this.mesh(al.build({ ao: 0.1 }), this.armL);
  }
  update(b: BossBase, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (!this.group.visible) return;
    const Q = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    this.group.position.set(x, 0, y);
    this.group.scale.setScalar(1.45);
    const p = g.nearestLiving(x, y);
    if (!b.dead) faceToward(this.group, x, y, p.x, p.y, dt);
    const sh = clamp(Q.shovel ?? 0, 0, 1), st = clamp(Q.stoke ?? 0, 0, 1), roar = clamp(Q.roar ?? 0, 0, 1), fall = clamp(Q.fall ?? 0, 0, 1);
    this.armR.rotation.x = -0.5 - sh * 1.6 + st * 0.6;
    this.armL.rotation.x = -0.2 - st * 1.2 - roar * 0.8;
    this.armL.rotation.z = roar * 0.6;
    this.head.rotation.x = -roar * 0.35;
    this.man.position.y = Math.abs(Math.sin((Q.step ?? 0) * 0.5)) * 3;
    this.man.rotation.x = fall * 1.2;
    const heat = clamp(Q.furnace ?? 0.4, 0, 1.6);
    const tint = 0.6 + heat * 0.8 + 0.15 * Math.sin(t * 9);
    this.furnace.scale.setScalar(1);
    this.state(b, t, [1, 1, 1, tint], [1, 0.55, 0.25, 0.6]);
    if (b.awake && !b.dead) pool.add(x, y + 30, 520, 0.7 + heat * 0.5, 1, 0.5, 0.2, 170, 3);
  }
}

// ======================================================================= the Widow of Saint Vesper's
export class WidowRig extends Rig {
  body = this.node();
  head: THREE.Group;
  veil: THREE.Group;
  armR: THREE.Group;
  armL: THREE.Group;
  constructor(scene: THREE.Scene) {
    super(scene);
    const m = new ModelBuilder();
    // the mourning gown, floor-length and bustled, the hem in rags drifting off the ground
    m.add(lathe([[0, 6], [26, 8], [22, 30], [16, 56], [12, 76], [14, 92], [10, 102], [0, 104]], 22, 10), { col: black, scale: [1, 1, 0.9], surf: SURF.velvet });
    m.add(ellipsoid(16, 12, 12, 12, 8), { col: black, pos: [0, 50, -14], surf: SURF.velvet });
    const rr = (i: number) => vnoise(i * 3.1, 1, 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      m.add(cone(5, 14 + rr(i) * 10, 5), { col: black, pos: [Math.cos(a) * 24, 4, Math.sin(a) * 21], rot: [Math.PI, 0, 0], surf: SURF.velvet });
    }
    m.add(lathe([[0, 92], [9, 94], [8, 100], [0, 101]], 12, 4), { col: weather(0x2a2830, 0.3), surf: SURF.cloth }); // a lace collar
    this.mesh(m.build({ ao: 0.3 }), this.body);
    this.head = this.node(this.body, 0, 104, 0);
    const hm = new ModelBuilder();
    hm.add(ellipsoid(9, 11, 9, 14, 10), { col: ghostSkin, pos: [0, 9, 0], surf: SURF.skin });
    hm.add(cyl(18, 18, 1.4, 22), { col: 0x0e0c10, pos: [0, 17, 0], surf: SURF.velvet });
    hm.add(cyl(9, 10, 8, 16), { col: 0x0e0c10, pos: [0, 21, 0], surf: SURF.velvet });
    hm.add(sphere(2.6, 8, 6), { col: 0xe8e0d0, pos: [7, 23, 6], surf: SURF.cloth }); // a white lily in the hatband
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    this.veil = this.node(this.head, 0, 17, 0);
    const vm = new ModelBuilder();
    vm.add(lathe([[17, 0], [16, -10], [15, -24], [16, -34]], 22, 6), { col: weather(0x16141a, 0.2), surf: SURF.cloth });
    for (const s of [-1, 1]) vm.add(sphere(1.3, 6, 4), { col: 0xd8e4ff, pos: [s * 3.6, -9, 13], surf: SURF.bulb, emit: 2 });
    this.mesh(vm.build({ ao: 0 }), this.veil);
    this.armR = this.node(this.body, -13, 92, 0);
    const ar = new ModelBuilder();
    arm(ar, black, 36, 3.4, 0x141214);
    // the soul lantern: a cage of black iron round a cold flame
    ar.add(cyl(0.5, 0.5, 10, 4), { col: PAL.iron, pos: [0, -44, 4], surf: SURF.iron });
    ar.add(cyl(5, 5.5, 12, 8, true), { col: PAL.iron, pos: [0, -55, 4], surf: SURF.iron });
    ar.add(sphere(4, 10, 8), { col: 0x9ad8ff, pos: [0, -55, 4], surf: SURF.bulb, emit: 2.6 });
    this.mesh(ar.build({ ao: 0.1 }), this.armR);
    this.armL = this.node(this.body, 13, 92, 0);
    const al = new ModelBuilder();
    arm(al, black, 36, 3.4, 0x141214);
    this.mesh(al.build({ ao: 0.1 }), this.armL);
  }
  update(b: BossBase, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (!this.group.visible) return;
    const Q = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    this.group.position.set(x, 0, y);
    this.group.scale.setScalar(1.5);
    const p = g.nearestLiving(x, y);
    if (!b.dead) faceToward(this.group, x, y, p.x, p.y, dt, 4);
    const wail = clamp(Q.wail ?? 0, 0, 1), raise = clamp(Q.raise ?? 0, 0, 1), veil = clamp(Q.veil ?? 0, 0, 1), lan = clamp(Q.lantern ?? 0, 0, 1), fall = clamp(Q.fall ?? 0, 0, 1);
    this.body.position.y = 8 + Math.sin((Q.float ?? 0) * 1.6) * 4 - fall * 10;
    this.armR.rotation.x = -0.3 - lan * 1.5 - raise * 1.6;
    this.armL.rotation.x = -0.2 - raise * 2.2 - veil * 1.2;
    this.armL.rotation.z = veil * 1.2 + wail * 0.9;
    this.armR.rotation.z = -wail * 0.9;
    this.head.rotation.x = -wail * 0.55;
    this.veil.rotation.x = -wail * 0.4 + Math.sin(t * 1.3) * 0.05;
    this.veil.position.y = 17 + fall * 40;
    this.body.scale.setScalar(1 - fall * 0.6);
    this.state(b, t, [1, 1, 1, 1], [0.6, 0.7, 1, 0.6]);
    if (b.awake && !b.dead) {
      pool.add(x, y, 420, 0.5, 0.6, 0.7, 1, 170, 3);
      pool.add(x - 30, y + 20, 200, 0.6 + lan, 0.55, 0.85, 1, 70, 2);
    }
  }
}

// ======================================================================= the Iron Foreman
export class ForemanRig extends Rig {
  man = this.node();
  head: THREE.Group;
  hammer: THREE.Group;
  chain: THREE.Group;
  siren: THREE.Mesh;
  constructor(scene: THREE.Scene) {
    super(scene);
    const plate = weather(0x3a3836, 0.4, 0.05, 0x6a4a2a);
    const m = new ModelBuilder();
    for (const s of [-1, 1]) {
      m.add(cyl(9, 11, 44, 12), { col: plate, pos: [s * 14, 22, 0], surf: SURF.iron });
      for (const y of [12, 26, 38]) m.add(torus(10.5, 1, 4, 14), { col: PAL.brass, pos: [s * 14, y, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
      m.add(rbox(22, 8, 28, 3), { col: 0x1a1a1c, pos: [s * 14, 4, 4], surf: SURF.iron });
    }
    // the boiler body: riveted bands, a pressure gauge, the works' brass number plate, a chimney stack
    m.add(cyl(32, 34, 70, 22), { col: plate, pos: [0, 80, 0], surf: SURF.iron });
    for (const y of [50, 70, 90, 110]) m.add(torus(33, 1.6, 6, 26), { col: PAL.brass, pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
    m.add(cyl(9, 9, 2, 18), { col: 0xe8e0c8, pos: [12, 96, 32], rot: [Math.PI / 2, 0, 0], surf: SURF.porcelain, emit: 0.4 });
    m.add(rbox(18, 8, 2, 1), { col: PAL.brass, pos: [-10, 66, 33], surf: SURF.brass });
    m.add(cyl(6, 7, 26, 12), { col: 0x1a1a1c, pos: [-16, 126, -12], surf: SURF.iron });
    this.mesh(m.build({ ao: 0.35 }), this.man);
    const sm = new ModelBuilder();
    sm.add(sphere(7, 10, 8), { col: 0xff8a30, pos: [0, 116, 26], surf: SURF.bulb, emit: 2.2 });
    this.siren = this.mesh(sm.build({ ao: 0 }), this.man, false);
    this.head = this.node(this.man, 0, 116, 0);
    const hm = new ModelBuilder();
    hm.add(sphere(16, 16, 12), { col: plate, pos: [0, 10, 6], surf: SURF.iron });
    hm.add(cyl(10, 11, 4, 16), { col: PAL.brass, pos: [0, 10, 20], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
    hm.add(cyl(8, 8, 1, 16), { col: 0xffa040, pos: [0, 10, 22.5], rot: [Math.PI / 2, 0, 0], surf: SURF.bulb, emit: 2.4 });
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    // the right arm: a steam hammer
    this.hammer = this.node(this.man, -40, 104, 0);
    const am = new ModelBuilder();
    am.add(cyl(9, 8, 40, 12), { col: plate, pos: [0, -20, 0], surf: SURF.iron });
    am.add(cyl(13, 13, 34, 14), { col: 0x1e1e20, pos: [0, -52, 0], surf: SURF.iron });
    am.add(cyl(17, 17, 12, 16), { col: PAL.iron, pos: [0, -74, 0], surf: SURF.iron });
    am.add(torus(13.5, 1.4, 5, 16), { col: PAL.brass, pos: [0, -40, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
    this.mesh(am.build({ ao: 0.1 }), this.hammer);
    // the left arm: a chain and hook
    this.chain = this.node(this.man, 40, 104, 0);
    const cm = new ModelBuilder();
    cm.add(cyl(9, 8, 38, 12), { col: plate, pos: [0, -19, 0], surf: SURF.iron });
    for (let i = 0; i < 6; i++) cm.add(torus(3.4, 1.1, 5, 10), { col: PAL.iron, pos: [0, -42 - i * 6, 0], rot: [0, i % 2 ? Math.PI / 2 : 0, 0], surf: SURF.iron });
    cm.add(torus(8, 2.2, 6, 14, Math.PI * 1.3), { col: PAL.iron, pos: [0, -84, 4], rot: [0, 0, Math.PI * 0.6], surf: SURF.iron });
    this.mesh(cm.build({ ao: 0.1 }), this.chain);
  }
  update(b: BossBase, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (!this.group.visible) return;
    const Q = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    this.group.position.set(x, 0, y);
    this.group.scale.setScalar(1.35);
    const p = g.nearestLiving(x, y);
    if (!b.dead) faceToward(this.group, x, y, p.x, p.y, dt, 3.5);
    const hm = clamp(Q.hammer ?? 0, 0, 1), ch = clamp(Q.chain ?? 0, 0, 1), siren = clamp(Q.siren ?? 0, 0, 1), fall = clamp(Q.fall ?? 0, 0, 1), rv = clamp(Q.rivet ?? 0, 0, 1);
    this.hammer.rotation.x = -0.3 - hm * 1.9;
    this.chain.rotation.x = -0.2 - ch * 1.2 - rv * 0.4;
    this.chain.rotation.z = ch * 1.4;
    this.head.rotation.x = -siren * 0.3;
    this.man.position.y = Math.abs(Math.sin((Q.step ?? 0) * 0.5)) * 3.5;
    this.man.rotation.z = fall * 0.6;
    this.man.rotation.x = fall * 0.8;
    this.state(b, t, [1, 1, 1, 0.8 + siren * 0.8 + 0.2 * Math.sin(t * 6)], [1, 0.7, 0.4, 0.55]);
    if (b.awake && !b.dead) pool.add(x, y, 480, 0.6 + siren * 0.4, 1, 0.65, 0.35, 170, 3);
  }
}

// ======================================================================= the Hour Thief
export class HourThiefRig extends Rig {
  body = this.node();
  face: THREE.Group;
  hHour: THREE.Group;
  hMin: THREE.Group;
  armR!: THREE.Group;
  armL!: THREE.Group;
  pend: THREE.Group;
  constructor(scene: THREE.Scene) {
    super(scene);
    const lacquer = weather(0x141010, 0.3, 0.05, 0x3a2a1a);
    const m = new ModelBuilder();
    // long thin legs of brass rod, a case-clock body with its door open on a pendulum
    for (const s of [-1, 1]) {
      m.add(cyl(2.6, 2.2, 70, 8), { col: brass, pos: [s * 9, 35, 0], surf: SURF.brass });
      m.add(cone(5, 6, 8), { col: PAL.brass, pos: [s * 9, 2, 0], rot: [Math.PI, 0, 0], surf: SURF.brass });
    }
    m.add(rbox(34, 66, 20, 3), { col: lacquer, pos: [0, 104, 0], surf: SURF.paint });
    m.add(rbox(26, 50, 2, 1), { col: 0x0a0806, pos: [0, 100, 10.4], surf: SURF.paint });
    m.add(box(36, 4, 22), { col: PAL.brass, pos: [0, 138, 0], surf: SURF.brass });
    m.add(box(36, 4, 22), { col: PAL.brass, pos: [0, 70, 0], surf: SURF.brass });
    this.mesh(m.build({ ao: 0.3 }), this.body);
    this.pend = this.node(this.body, 0, 124, 9);
    const pm = new ModelBuilder();
    pm.add(cyl(0.8, 0.8, 34, 6), { col: PAL.brass, pos: [0, -17, 0], surf: SURF.brass });
    pm.add(cyl(6, 6, 2, 16), { col: PAL.brass, pos: [0, -36, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.brass, emit: 0.4 });
    this.mesh(pm.build({ ao: 0 }), this.pend);
    // the head: a clock face, lit from behind
    this.face = this.node(this.body, 0, 164, 4);
    const fm = new ModelBuilder();
    dial(fm, 22, 0xf0e8c8, brass, 1.1);
    fm.add(cyl(23, 24, 8, 26), { col: lacquer, pos: [0, 0, -5], rot: [Math.PI / 2, 0, 0], surf: SURF.paint });
    this.mesh(fm.build({ ao: 0 }), this.face);
    this.hHour = hand(this, this.face, 13, 2.4, 2.4);
    this.hMin = hand(this, this.face, 19, 1.6, 3);
    // the arms: an hour hand and a minute hand, long as spears
    for (const s of [-1, 1]) {
      const n = this.node(this.body, s * 20, 132, 0);
      const am = new ModelBuilder();
      am.add(cyl(2.4, 2, 34, 8), { col: brass, pos: [0, -17, 0], surf: SURF.brass });
      am.add(box(4, 46, 1.6), { col: 0x1a1612, pos: [0, -56, 2], surf: SURF.iron });
      am.add(cone(4.4, 10, 4), { col: 0x1a1612, pos: [0, -84, 2], rot: [Math.PI, 0, 0], surf: SURF.iron });
      this.mesh(am.build({ ao: 0.1 }), n);
      if (s < 0) this.armR = n;
      else this.armL = n;
    }
  }
  update(b: BossBase, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (!this.group.visible) return;
    const Q = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    this.group.position.set(x, 0, y);
    this.group.scale.setScalar(1.35);
    const p = g.nearestLiving(x, y);
    if (!b.dead) faceToward(this.group, x, y, p.x, p.y, dt, 5);
    const chime = clamp(Q.chime ?? 0, 0, 1), rew = clamp(Q.rewind ?? 0, 0, 1), fall = clamp(Q.fall ?? 0, 0, 1), tick = clamp(Q.tick ?? 0, 0, 1);
    this.hHour.rotation.z = -(Q.hands ?? 0);
    this.hMin.rotation.z = -(Q.minute ?? 0);
    this.pend.rotation.z = (Q.pendulum ?? 0) * 0.5;
    this.armR.rotation.x = -0.2 - chime * 1.6 - tick * 0.2;
    this.armL.rotation.x = -0.2 - chime * 1.4;
    this.armR.rotation.z = -rew * 1.2;
    this.armL.rotation.z = rew * 1.2;
    this.face.rotation.z = rew * Math.PI * 2 * (1 - rew);
    this.body.position.y = Math.abs(Math.sin((Q.step ?? 0) * 0.5)) * 2;
    this.body.rotation.x = fall * 1.3;
    this.state(b, t, [1, 1, 1, 1 + chime * 0.6], [0.85, 0.95, 0.7, 0.55]);
    if (b.awake && !b.dead) {
      pool.add(x, y, 440, 0.5 + chime * 0.6, 0.85, 0.95, 0.75, 170, 3);
      pool.add(x, y - 30, 180, 0.9, 1, 0.95, 0.75, 220, 2);
    }
  }
}

// ======================================================================= the Night Express
export class NightExpressRig extends Rig {
  loco = this.node();
  jaw: THREE.Group;
  wheels: THREE.Group[] = [];
  rods: THREE.Group;
  constructor(scene: THREE.Scene) {
    super(scene);
    const m = new ModelBuilder();
    // a black locomotive facing +Z: the boiler, the smokebox with its face, the chimney, domes, the cab behind
    m.add(cyl(30, 30, 140, 24), { col: iron, pos: [0, 62, -10], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    for (const z of [-60, -30, 0, 30]) m.add(torus(30.5, 1.4, 6, 26), { col: PAL.brass, pos: [0, 62, z], surf: SURF.brass });
    m.add(cyl(32, 32, 26, 24), { col: 0x101012, pos: [0, 62, 66], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    m.add(cyl(11, 14, 34, 14), { col: 0x101012, pos: [0, 104, 58], surf: SURF.iron });
    m.add(torus(13, 2.4, 6, 16), { col: PAL.brass, pos: [0, 121, 58], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
    m.add(sphere(12, 14, 10), { col: brass, pos: [0, 92, 10], surf: SURF.brass });
    m.add(sphere(10, 12, 8), { col: iron, pos: [0, 90, -26], surf: SURF.iron });
    m.add(rbox(76, 74, 50, 4), { col: weather(0x1a1414, 0.35, 0.05), pos: [0, 74, -96], surf: SURF.paint });
    m.add(rbox(84, 6, 58, 3), { col: 0x0e0c0c, pos: [0, 114, -96], surf: SURF.paint });
    for (const s of [-1, 1]) m.add(box(1, 24, 22), { col: 0xffb050, pos: [s * 38.6, 86, -96], surf: SURF.bulb, emit: 1.2 });
    m.add(rbox(70, 10, 200, 3), { col: 0x14100e, pos: [0, 24, -20], surf: SURF.iron });
    // the cowcatcher, red buffer beam and buffers
    for (let i = 0; i < 7; i++) m.add(box(3, 22, 2), { col: PAL.iron, pos: [-24 + i * 8, 14, 96], rot: [0.7, 0, 0], surf: SURF.iron });
    m.add(box(78, 10, 6), { col: 0x6a1410, pos: [0, 30, 84], surf: SURF.paint });
    for (const s of [-1, 1]) m.add(cyl(5, 5, 12, 10), { col: PAL.iron, pos: [s * 28, 30, 92], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    // the number plate: 13
    m.add(rbox(18, 10, 1.4, 1), { col: PAL.brass, pos: [0, 92, 80], surf: SURF.brass });
    this.mesh(m.build({ ao: 0.3 }), this.loco);
    // the face on the smokebox door: the headlamp eye and the jaw
    const fm = new ModelBuilder();
    fm.add(cyl(9, 11, 8, 18), { col: PAL.iron, pos: [0, 76, 80], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    fm.add(cyl(8, 8, 1, 18), { col: 0xfff0c0, pos: [0, 76, 84.6], rot: [Math.PI / 2, 0, 0], surf: SURF.bulb, emit: 3 });
    for (const s of [-1, 1]) fm.add(sphere(3, 10, 8), { col: 0xff5030, pos: [s * 16, 66, 80], surf: SURF.bulb, emit: 2.4 });
    this.mesh(fm.build({ ao: 0 }), this.loco, false);
    this.jaw = this.node(this.loco, 0, 50, 80);
    const jm = new ModelBuilder();
    jm.add(rbox(48, 10, 6, 2), { col: 0x101012, pos: [0, 0, 0], surf: SURF.iron });
    for (let i = 0; i < 7; i++) jm.add(cone(2.4, 6, 4), { col: 0xd8d0c0, pos: [-18 + i * 6, 6, 2], surf: SURF.bone });
    jm.add(box(40, 3, 3), { col: 0xff6a20, pos: [0, 4, -1], surf: SURF.bulb, emit: 1.6 });
    this.mesh(jm.build({ ao: 0 }), this.jaw);
    // driving wheels, red with brass hubs, and the coupling rods
    for (const s of [-1, 1]) for (const z of [-50, -5, 40]) {
      const w = this.node(this.loco, s * 38, 24, z);
      const wm = new ModelBuilder();
      wm.add(cyl(22, 22, 6, 22), { col: 0x5a1410, rot: [0, 0, Math.PI / 2], surf: SURF.paint });
      wm.add(torus(22, 2, 6, 22), { col: PAL.iron, rot: [0, Math.PI / 2, 0], surf: SURF.iron });
      for (let k = 0; k < 8; k++) wm.add(box(2, 40, 2), { col: 0x5a1410, rot: [(k * Math.PI) / 8, 0, 0], pos: [s * 2, 0, 0], surf: SURF.paint });
      wm.add(cyl(5, 5, 8, 12), { col: PAL.brass, rot: [0, 0, Math.PI / 2], surf: SURF.brass });
      this.mesh(wm.build({ ao: 0 }), w);
      this.wheels.push(w);
    }
    this.rods = this.node(this.loco, 0, 24, -5);
    const rm = new ModelBuilder();
    for (const s of [-1, 1]) rm.add(box(3, 4, 100), { col: 0x8a8a8c, pos: [s * 43, 0, 0], surf: SURF.iron });
    this.mesh(rm.build({ ao: 0 }), this.rods);
  }
  update(b: BossBase, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (!this.group.visible) return;
    const Q = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    this.group.position.set(x, 0, y);
    this.group.scale.setScalar(0.95);
    // it faces where it's going when it runs, at its target otherwise
    const vx = b.x - b.px, vy = b.y - b.py;
    if (Math.hypot(vx, vy) > 4) faceToward(this.group, x, y, x + vx * 100, y + vy * 100, dt, 10);
    else if (!b.dead) {
      const p = g.nearestLiving(x, y);
      faceToward(this.group, x, y, p.x, p.y, dt, 2.5);
    }
    const jaw = clamp(Q.jaw ?? 0, 0, 1), fall = clamp(Q.fall ?? 0, 0, 1), wh = clamp(Q.whistle ?? 0, 0, 1);
    const turn = Q.wheels ?? 0;
    for (const w of this.wheels) w.rotation.x = turn;
    this.rods.position.set(0, 24 + Math.sin(turn) * 10, -5 + Math.cos(turn) * 10);
    this.jaw.rotation.x = jaw * 0.6;
    this.loco.rotation.z = fall * 0.5;
    this.loco.position.y = -fall * 20;
    const lamp = clamp(Q.lamp ?? 1, 0, 1.4);
    this.state(b, t, [1, 1, 1, 0.7 + lamp * 0.6 + wh * 0.4], [1, 0.45, 0.3, 0.6]);
    if (b.awake && !b.dead) {
      pool.add(x, y, 560, 0.7, 1, 0.5, 0.3, 170, 3);
      // the headlamp throws a long pool ahead of it
      const a = this.group.rotation.y;
      pool.add(x + Math.sin(a) * 320, y + Math.cos(a) * 320, 300, 1.1 * lamp, 1, 0.92, 0.7, 40, 2);
      // smoke and sparks from the stack
      if (Math.random() < 0.35 + (Q.charge ?? 0) * 0.5) r.fx.handle([{ type: 'spark', x: x + Math.sin(a) * 55, y: y + Math.cos(a) * 55, a: 2, b: 0, c: 0, style: 'fire' }]);
    }
  }
}

// ======================================================================= the Conductor
export class ConductorRig extends Rig {
  man = this.node();
  head: THREE.Group;
  armR: THREE.Group;
  armL: THREE.Group;
  coatTail: THREE.Group;
  constructor(scene: THREE.Scene) {
    super(scene);
    const uni = weather(0x1a2030, 0.4, 0.06, 0x3a4050);
    const m = new ModelBuilder();
    for (const s of [-1, 1]) {
      m.add(cyl(4.4, 3.8, 46, 8), { col: weather(0x14161c, 0.4), pos: [s * 7, 23, 0], surf: SURF.cloth });
      shoe(m, [s * 7, 0, -1], 14, PAL.ink, 0, [0, 0, 0], 0.1);
    }
    m.add(lathe([[0, 44], [14, 46], [13, 62], [14, 80], [15, 96], [12, 104], [6, 108], [0, 109]], 18, 10), { col: uni, scale: [1, 1, 0.82], surf: SURF.cloth });
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) m.add(sphere(1.2, 6, 4), { col: PAL.brass, pos: [s * 4.5, 60 + i * 7, 12], surf: SURF.brass });
    // the ticket satchel at his hip, tickets bursting out of it
    m.add(rbox(14, 16, 6, 2), { col: weather(0x3a2416, 0.4), pos: [15, 54, 4], rot: [0, 0, 0.1], surf: SURF.wood });
    for (let i = 0; i < 6; i++) m.add(box(5, 3, 0.4), { col: 0xf0e0b0, pos: [12 + i * 1.4, 63 + (i % 3), 6], rot: [0.3, 0.2 * i, 0.3 * (i - 3)], surf: SURF.cloth, emit: 0.4 });
    m.add(cyl(5, 6, 6, 10), { col: 0xd8d0c0, pos: [0, 109, 0], surf: SURF.cloth });
    this.mesh(m.build({ ao: 0.3 }), this.man);
    this.coatTail = this.node(this.man, 0, 48, -6);
    const ct = new ModelBuilder();
    ct.add(rbox(24, 36, 4, 2), { col: uni, pos: [0, -14, -6], surf: SURF.cloth });
    this.mesh(ct.build({ ao: 0.2 }), this.coatTail);
    this.head = this.node(this.man, 0, 111, 0);
    const hm = new ModelBuilder();
    // a gaunt face, sunken cheeks, the eyes two lamp-points under the peak of the cap
    hm.add(ellipsoid(9, 13, 9.5, 14, 10), { col: ghostSkin, pos: [0, 11, 0], surf: SURF.skin });
    for (const s of [-1, 1]) {
      hm.add(sphere(2.6, 8, 6), { col: 0x14100e, pos: [s * 3.8, 13, 7.4], surf: SURF.rubber });
      hm.add(sphere(1.2, 6, 4), { col: 0xffe8a0, pos: [s * 3.8, 13, 8.8], surf: SURF.bulb, emit: 2.4 });
    }
    hm.add(cyl(10.6, 11, 7, 18), { col: 0x0e1218, pos: [0, 24, 0], surf: SURF.cloth });
    hm.add(cyl(11.2, 11.2, 1.6, 18, true), { col: PAL.gold, pos: [0, 22, 0], surf: SURF.gold });
    hm.add(ellipsoid(8.6, 1, 7, 12, 4), { col: 0x050608, pos: [0, 20.6, 8], rot: [-0.25, 0, 0], surf: SURF.rubber });
    hm.add(rbox(6, 4, 1, 0.5), { col: PAL.brass, pos: [0, 25, 10.6], surf: SURF.brass });
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    this.armR = this.node(this.man, -15, 100, 0);
    const ar = new ModelBuilder();
    arm(ar, uni, 42, 3.8, 0xd8d4c8);
    // the punch, as long as his forearm, brass jaws open
    ar.add(rbox(5, 22, 8, 1), { col: brass, pos: [0, -54, 6], surf: SURF.brass });
    ar.add(rbox(5, 14, 3, 1), { col: PAL.brass, pos: [0, -58, 12], rot: [-0.3, 0, 0], surf: SURF.brass });
    this.mesh(ar.build({ ao: 0.1 }), this.armR);
    this.armL = this.node(this.man, 15, 100, 0);
    const al = new ModelBuilder();
    arm(al, uni, 42, 3.8, 0xd8d4c8);
    al.add(cyl(0.5, 0.5, 12, 4), { col: PAL.iron, pos: [0, -52, 4], surf: SURF.iron });
    al.add(cyl(6, 7, 13, 10), { col: PAL.iron, pos: [0, -64, 4], surf: SURF.iron });
    al.add(cyl(5.2, 5.2, 8, 10, true), { col: 0xffe0a0, pos: [0, -64, 4], surf: SURF.glass, emit: 2.4 });
    this.mesh(al.build({ ao: 0.1 }), this.armL);
  }
  update(b: BossBase, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (!this.group.visible) return;
    const Q = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    this.group.position.set(x, 0, y);
    this.group.scale.setScalar(1.55);
    const p = g.nearestLiving(x, y);
    if (!b.dead) faceToward(this.group, x, y, p.x, p.y, dt);
    const pu = clamp(Q.punch ?? 0, 0, 1), wh = clamp(Q.whistle ?? 0, 0, 1), lan = clamp(Q.lantern ?? 0, 0, 1), tk = clamp(Q.tickets ?? 0, 0, 1), fall = clamp(Q.fall ?? 0, 0, 1);
    this.armR.rotation.x = -0.4 - pu * 1.9 - tk * 0.8;
    this.armL.rotation.x = -0.3 - lan * 1.6 - wh * 1.0;
    this.armL.rotation.z = wh * 0.5;
    this.head.rotation.x = -wh * 0.25;
    this.coatTail.rotation.x = 0.15 + Math.sin((Q.coat ?? 0) * 2) * 0.12;
    this.man.position.y = Math.abs(Math.sin((Q.step ?? 0) * 0.5)) * 2.5;
    this.man.rotation.x = fall * 0.9;
    this.state(b, t, [1, 1, 1, 1], [1, 0.9, 0.6, 0.55]);
    if (b.awake && !b.dead) {
      pool.add(x, y, 460, 0.55, 1, 0.9, 0.65, 170, 3);
      pool.add(x + 20, y + 20, 200, 0.7 + lan, 1, 0.85, 0.55, 70, 2);
    }
  }
}

export function ghostTrainGlow(id: string): [number, number, number] | null {
  switch (id) {
    case 'stationmaster': return [1, 0.82, 0.55];
    case 'stoker': return [1, 0.5, 0.2];
    case 'widow': return [0.6, 0.7, 1];
    case 'foreman': return [1, 0.65, 0.35];
    case 'hour_thief': return [0.85, 0.95, 0.7];
    case 'night_express': return [1, 0.4, 0.25];
    case 'conductor': return [1, 0.9, 0.65];
  }
  return null;
}

export type GhostTrainRigs = { stationmaster: StationmasterRig; stoker: StokerRig; widow: WidowRig; foreman: ForemanRig; hourThief: HourThiefRig; express: NightExpressRig; conductor: ConductorRig };
export const GT_BOSS_IDS = new Set(['stationmaster', 'stoker', 'widow', 'foreman', 'hour_thief', 'night_express', 'conductor']);

export function makeGhostTrainRigs(scene: THREE.Scene): GhostTrainRigs {
  return { stationmaster: new StationmasterRig(scene), stoker: new StokerRig(scene), widow: new WidowRig(scene), foreman: new ForemanRig(scene), hourThief: new HourThiefRig(scene), express: new NightExpressRig(scene), conductor: new ConductorRig(scene) };
}

/** Draw this frame's Ghost Train bosses; hide the rigs of the ones not present. */
export function updateGhostTrainRigs(R: GhostTrainRigs, bosses: BossBase[], g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
  const seen = new Set<string>();
  const rigOf = (id: string): Rig & { update(b: BossBase, g: Game, r: GameRenderer3D, alpha: number, dt: number): void } | null => {
    switch (id) {
      case 'stationmaster': return R.stationmaster;
      case 'stoker': return R.stoker;
      case 'widow': return R.widow;
      case 'foreman': return R.foreman;
      case 'hour_thief': return R.hourThief;
      case 'night_express': return R.express;
      case 'conductor': return R.conductor;
    }
    return null;
  };
  for (const b of bosses) {
    seen.add(b.def.id);
    rigOf(b.def.id)?.update(b, g, r, alpha, dt);
  }
  for (const id of GT_BOSS_IDS) if (!seen.has(id)) {
    const rg = rigOf(id);
    if (rg) rg.group.visible = false;
  }
}

export const _unused = { C, P };
