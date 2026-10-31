// The Boardwalk's boss rigs (D-68): the Barker on his soapbox with his prize wheel, the Drowned Captain
// with his anchor and chain and the Gala Queen standing offshore, the Last Ride's train with its riders,
// the Leviathan's head, coils and tentacles, and the Commodore with his ledger. Same rules as the other
// maps' rigs: articulated ModelBuilder models driven by each boss's replicated state and pose, and
// anything the sim places up in the air drawn shifted south by height·cot(elevation), so it shows where
// the sim has it.

import * as THREE from 'three';
import { clamp, lerp } from '../core/math';
import type { Game } from '../sim/game';
import type { BossBase } from '../sim/bosses/boss';
import type { BarkerBoss } from '../sim/bosses/barker';
import type { DrownedCaptainBoss } from '../sim/bosses/captain';
import type { LastRideBoss } from '../sim/bosses/lastRide';
import type { LeviathanBoss } from '../sim/bosses/leviathan';
import type { CommodoreBoss } from '../sim/bosses/commodore';
import { seaSurfaceHeight, waterDepth } from '../data/boardwalk';
import { ModelBuilder, PART, SURF, box, cone, cyl, ellipsoid, extrude, lathe, rbox, sphere, stripes, torus, tube, weather, type ColorFn, type V3 } from './core/geo';
import { pool } from './core/materials';
import { PAL, glove, shoe } from './models/kit';
import type { GameRenderer3D } from './renderer3d';
import { Rig } from './rig';
import { Strand } from './funhouseBosses';
import { COT_EL as COT } from './core/view';

/** Turn a rig's root to face a point, smoothly. */
function faceToward(o: THREE.Object3D, x: number, y: number, tx: number, ty: number, dt: number, rate = 6): void {
  const want = Math.atan2(tx - x, ty - y);
  let d = want - o.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  o.rotation.y += d * (1 - Math.exp(-dt * rate));
}

/** Sleeve + glove hanging from a shoulder pivot (arm points down -y). */
function arm(m: ModelBuilder, col: number | ColorFn, len: number, r: number, gloveCol: number): void {
  m.add(cyl(r, r * 0.88, len, 8), { col, pos: [0, -len / 2, 0], surf: SURF.cloth });
  glove(m, [0, -len - 3, 2], r * 1.3, PART.BODY, [0, 0, 0], gloveCol);
}

// ======================================================================= the Boardwalk Barker
export class BarkerRig extends Rig {
  box = this.node();
  man = this.node(this.box, 0, 26, 0);
  head: THREE.Group;
  hat: THREE.Group;
  armR: THREE.Group;
  armL: THREE.Group;
  wheelSpin: THREE.Group;
  wheel: THREE.Group;
  wheels: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    super(scene);
    // the soapbox: a painted crate on cart wheels
    const bm = new ModelBuilder();
    bm.add(rbox(48, 24, 36, 3), { col: weather(0x8a2a22, 0.45, 0.08, 0x4a2a1a), pos: [0, 13, 0], surf: SURF.wood });
    bm.add(box(50, 3, 38), { col: weather(PAL.cream, 0.4), pos: [0, 25, 0], surf: SURF.wood });
    for (const z of [-18.6, 18.6]) for (let i = 0; i < 5; i++) bm.add(box(4, 18, 0.6), { col: i % 2 ? PAL.cream : 0xb8262a, pos: [-16 + i * 8, 13, z], surf: SURF.paint });
    this.mesh(bm.build({ ao: 0.3 }), this.box);
    for (const [x, z] of [[-20, -15], [20, -15], [-20, 15], [20, 15]] as [number, number][]) {
      const w = this.node(this.box, x, 7, z);
      const wm = new ModelBuilder();
      wm.add(cyl(7, 7, 4, 12), { col: PAL.woodDark, rot: [0, 0, Math.PI / 2], surf: SURF.wood });
      for (let k = 0; k < 4; k++) wm.add(box(4.4, 12, 1.2), { col: PAL.iron, rot: [(k * Math.PI) / 4, 0, 0], surf: SURF.iron });
      this.mesh(wm.build({ ao: 0 }), w);
      this.wheels.push(w);
    }
    // the man: candy-striped blazer, checked trousers, spats
    const m = new ModelBuilder();
    for (const s of [-1, 1]) {
      m.add(cyl(4.8, 4.2, 44, 8), { col: weather(0x8a7a5a, 0.35), pos: [s * 7.5, 22, 0], surf: SURF.cloth });
      shoe(m, [s * 7.5, 0, -2], 15, PAL.ink, PART.BODY, [0, 0, 0], 0.1);
    }
    m.add(lathe([[0, 42], [13, 43], [15, 58], [16, 78], [14, 88], [7, 92], [0, 93]], 16, 10), { col: stripes(16, 0xb8262a, 0xe8dcc0, 0, 0.25), scale: [1, 1, 0.8], surf: SURF.cloth });
    m.add(cyl(5.5, 6.5, 6, 10), { col: PAL.cream, pos: [0, 92, 0], surf: SURF.cloth });
    for (const s of [-1, 1]) m.add(cone(3.4, 6, 6), { col: 0x1a3a6a, pos: [s * 3.2, 90, 9.6], rot: [0, 0, s * Math.PI / 2], surf: SURF.cloth });
    m.add(sphere(1.4, 6, 4), { col: 0x1a3a6a, pos: [0, 90, 10], surf: SURF.cloth });
    for (let i = 0; i < 3; i++) m.add(sphere(1.3, 6, 4), { col: PAL.gold, pos: [0, 70 + i * 7, 12.4], surf: SURF.gold });
    this.mesh(m.build({ ao: 0.25 }), this.man);
    this.head = this.node(this.man, 0, 95, 0);
    const hm = new ModelBuilder();
    const skin = weather(0xd8b898, 0.25, 0.1);
    hm.add(ellipsoid(10.5, 12.5, 10.5, 14, 10), { col: skin, pos: [0, 11, 0], surf: SURF.skin });
    hm.add(sphere(2.6, 8, 6), { col: 0xc8786a, pos: [0, 11, 10.6], surf: SURF.skin });
    // the grin: too many teeth, one of them gold; a waxed handlebar moustache
    hm.add(tube([[-8, 5, 7.5], [-4, 3.4, 10], [4, 3.4, 10], [8, 5, 7.5]], 1, 5, 12), { col: 0x8a1a1a, surf: SURF.latex });
    for (let i = 0; i < 8; i++) hm.add(box(1.7, 2.2, 1), { col: i === 5 ? PAL.gold : PAL.bone, pos: [-6.2 + i * 1.8, 4.6, 10 - Math.abs(i - 3.5) * 0.3], surf: i === 5 ? SURF.gold : SURF.bone });
    for (const s of [-1, 1]) hm.add(tube([[0, 8.6, 10.6], [s * 4, 8.8, 10.4], [s * 8, 9.8, 8.6], [s * 10.5, 12.5, 6.4]], (u) => 1.5 - u * 1.1, 5, 8), { col: PAL.ink, surf: SURF.paint });
    for (const s of [-1, 1]) {
      hm.add(ellipsoid(2.4, 2.8, 1, 8, 6), { col: PAL.ink, pos: [s * 4.2, 14.5, 9.4], surf: SURF.paint });
      hm.add(sphere(0.8, 6, 4), { col: 0xffd27a, pos: [s * 4.2, 14.6, 10.3], surf: SURF.bulb, emit: 1 });
    }
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    this.hat = this.node(this.man, 0, 118, 0);
    const hat = new ModelBuilder();
    hat.add(cyl(11.5, 12, 7, 18), { col: weather(0xd8c088, 0.35, 0.2), pos: [0, 3.5, 0], surf: SURF.canvas });
    hat.add(cyl(20, 20, 1.2, 22), { col: weather(0xd8c088, 0.35, 0.2), pos: [0, 0.4, 0], surf: SURF.canvas });
    hat.add(cyl(12.1, 12.1, 2.4, 18, true), { col: 0x8a1a1a, pos: [0, 2.2, 0], surf: SURF.cloth });
    this.mesh(hat.build({ ao: 0 }), this.hat);
    // right arm: the megaphone; left arm: the cane
    this.armR = this.node(this.man, -15, 86, 0);
    const ar = new ModelBuilder();
    arm(ar, stripes(10, 0xb8262a, 0xe8dcc0, 0, 0.25), 40, 4, PAL.bone);
    ar.add(lathe([[2.4, 0], [3, 6], [6, 20], [12, 30], [13, 31]], 16, 6), { col: weather(0xb8262a, 0.4), pos: [0, -46, 6], rot: [Math.PI / 2, 0, 0], surf: SURF.paint });
    ar.add(torus(12.5, 1, 6, 22), { col: PAL.brass, pos: [0, -46, 37], surf: SURF.brass });
    this.mesh(ar.build({ ao: 0.1 }), this.armR);
    this.armL = this.node(this.man, 15, 86, 0);
    const al = new ModelBuilder();
    arm(al, stripes(10, 0xb8262a, 0xe8dcc0, 0, 0.25), 40, 4, PAL.bone);
    al.add(cyl(1.3, 1.3, 70, 6), { col: PAL.ink, pos: [0, -62, 7], rot: [0.12, 0, 0], surf: SURF.paint });
    al.add(sphere(3, 8, 6), { col: PAL.gold, pos: [0, -27, 3], surf: SURF.gold });
    this.mesh(al.build({ ao: 0 }), this.armL);
    // the prize wheel behind him, coloured wedges and a ring of bulbs
    this.wheel = this.node(this.box, 0, 130, -34);
    this.wheelSpin = this.node(this.wheel);
    const wm = new ModelBuilder();
    const cols = [0xb8262a, 0xe8dcc0, 0x1a5a8a, 0xd8a830, 0x2a7a4a, 0x6a2a7a];
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      wm.add(extrude([[0, 0], [Math.cos(a0) * 60, Math.sin(a0) * 60], [Math.cos((a0 + a1) / 2) * 62, Math.sin((a0 + a1) / 2) * 62], [Math.cos(a1) * 60, Math.sin(a1) * 60]], 3, 0, 1), { col: cols[i % cols.length], surf: SURF.paint });
      wm.add(sphere(2.2, 6, 4), { col: 0xffd27a, pos: [Math.cos(a0) * 64, Math.sin(a0) * 64, 3], surf: SURF.bulb, emit: 1.6 });
    }
    wm.add(torus(64, 2.4, 6, 40), { col: PAL.gold, pos: [0, 0, 1.5], surf: SURF.gold });
    wm.add(cyl(7, 7, 6, 12), { col: PAL.gold, rot: [Math.PI / 2, 0, 0], pos: [0, 0, 3], surf: SURF.gold });
    this.mesh(wm.build({ ao: 0 }), this.wheelSpin, false);
    const pm = new ModelBuilder();
    pm.add(cyl(2.4, 2.4, 130, 6), { col: PAL.woodDark, pos: [0, -65, -4], surf: SURF.wood });
    pm.add(cone(5, 12, 4), { col: PAL.gold, pos: [0, 70, 4], rot: [Math.PI, 0, 0], surf: SURF.gold });
    this.mesh(pm.build({ ao: 0 }), this.wheel);
  }

  update(b: BarkerBoss, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (!this.group.visible) return;
    const P = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    this.group.position.set(x, 0, y);
    this.group.scale.setScalar(1.6);
    const p = g.nearestLiving(x, y);
    if (!b.dead) faceToward(this.group, x, y, p.x, p.y, dt);
    for (const w of this.wheels) w.rotation.x = -(P.roll ?? 0);
    const shout = clamp(P.shout ?? 0, 0, 1), fall = clamp(P.fall ?? 0, 0, 1);
    this.armR.rotation.x = -0.4 - shout * 1.15;
    this.armR.rotation.z = -shout * 0.2;
    this.armL.rotation.x = -(P.toss ?? 0) * 2.2 + Math.sin(t * 2) * 0.05;
    this.head.rotation.x = -shout * 0.2;
    this.head.rotation.z = Math.sin(t * 1.7) * 0.06;
    this.man.rotation.z = fall * 1.35;
    this.man.position.y = 26 - fall * 18;
    const tip = clamp(P.tip ?? 0, 0, 1), hat = clamp(P.hat ?? 0, 0, 1);
    this.hat.position.set(hat * 70, 118 + tip * 10 - hat * 110, 0);
    this.hat.rotation.set(0, 0, -tip * 0.4 + hat * 6);
    this.wheel.visible = (P.wheel ?? 0) > 0.05;
    this.wheelSpin.rotation.z = P.spin ?? 0;
    this.state(b, t, [1, 1, 1, 1], [1, 0.8, 0.5, 0.5]);
    if (b.awake && !b.dead) {
      pool.add(x, y, 420, 0.6, 1, 0.75, 0.5, 170, 3);
      if (shout > 0.2) r.glow.draw(r.assets.atlas.get('fx_glow_0'), x, y, 150, 1.2 * shout, 1.2 * shout, 0, 1, 0.6, 0.3, 0.5 * shout);
    }
  }
}

// ======================================================================= the Drowned Captain and the Gala Queen
export class CaptainRig extends Rig {
  man = this.node();
  head: THREE.Group;
  armR: THREE.Group;
  armL: THREE.Group;
  anchor: THREE.Group;
  ship: THREE.Group;
  chain: Strand;

  constructor(scene: THREE.Scene) {
    super(scene);
    const coat = weather(0x1e2e36, 0.45, 0.08, 0x4a5a4a);
    const m = new ModelBuilder();
    for (const s of [-1, 1]) {
      m.add(cyl(5, 4.6, 40, 8), { col: 0x14181c, pos: [s * 7.5, 20, 0], surf: SURF.rubber });
      shoe(m, [s * 7.5, 0, -2], 15, 0x14181c, PART.BODY, [0, 0, 0], 0.1);
    }
    // the greatcoat to the knee, barnacled at the hem, gold buttons, epaulettes
    m.add(lathe([[0, 30], [17, 31], [16, 46], [15, 62], [16, 84], [14, 94], [7, 98], [0, 99]], 16, 10), { col: coat, scale: [1, 1, 0.82], surf: SURF.velvet });
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) m.add(sphere(1.3, 6, 4), { col: PAL.gold, pos: [s * 4, 66 + i * 6, 13.2], surf: SURF.gold });
    for (const s of [-1, 1]) {
      m.add(ellipsoid(6, 2, 5, 10, 6), { col: PAL.gold, pos: [s * 15, 95, 0], surf: SURF.gold });
      for (let i = 0; i < 5; i++) m.add(cyl(0.4, 0.4, 4, 4), { col: PAL.gold, pos: [s * 20, 93, -3 + i * 1.5], surf: SURF.gold });
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      m.add(cone(1.3, 2.4, 6), { col: 0xcfc6b0, pos: [Math.cos(a) * 16.5, 33 + (i % 3) * 3, Math.sin(a) * 13.5], surf: SURF.bone });
    }
    this.mesh(m.build({ ao: 0.25 }), this.man);
    this.head = this.node(this.man, 0, 99, 0);
    const hm = new ModelBuilder();
    const skin = weather(0x7a8a80, 0.4, 0.12);
    hm.add(ellipsoid(9.5, 12, 10, 14, 10), { col: skin, pos: [0, 11, 0], surf: SURF.skin });
    for (const s of [-1, 1]) {
      hm.add(sphere(2.6, 8, 6), { col: 0x0a1014, pos: [s * 3.8, 13, 8.4], surf: SURF.rubber });
      hm.add(sphere(1.1, 6, 4), { col: 0x9ff8ff, pos: [s * 3.8, 13, 9.8], surf: SURF.bulb, emit: 1.6 });
    }
    // a beard of kelp, long and dripping
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * 1.8;
      hm.add(tube([[x, 5, 8.6], [x * 1.1, 0, 9.4], [x * 1.2, -8 - (i % 3) * 3, 7]], (u) => 1.2 - u * 0.8, 4, 6), { col: i % 2 ? 0x2e3a1e : 0x3a4424, surf: SURF.latex });
    }
    // the peaked cap: white crown gone grey, black visor, gold braid and badge
    hm.add(cyl(10.5, 9.5, 6, 18), { col: weather(0xb8b8a8, 0.45), pos: [0, 22.5, -0.5], rot: [-0.08, 0, 0], surf: SURF.cloth });
    hm.add(cyl(9.8, 9.8, 2, 18, true), { col: 0x14181c, pos: [0, 20, -0.5], surf: SURF.cloth });
    hm.add(cyl(6, 6, 0.8, 14), { col: 0x0a0c0e, pos: [0, 19.5, 8], rot: [-0.25, 0, 0], scale: [1, 1, 0.7], surf: SURF.latex });
    hm.add(sphere(1.8, 8, 6), { col: PAL.gold, pos: [0, 22, 9.4], surf: SURF.gold, emit: 0.3 });
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    // right arm: the cutlass; left arm: the chain hand
    this.armR = this.node(this.man, -16, 92, 0);
    const ar = new ModelBuilder();
    arm(ar, coat, 42, 4.6, 0x7a8a80);
    ar.add(extrude([[0, 0], [2.4, 2], [3, 30], [0.4, 44], [-1.4, 30], [-1, 2]], 1, 0.2, 2), { col: 0xb8c0c4, pos: [0, -48, 6], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    ar.add(torus(4, 0.8, 4, 10, Math.PI), { col: PAL.gold, pos: [0, -48, 5], rot: [0, Math.PI / 2, 0], surf: SURF.gold });
    this.mesh(ar.build({ ao: 0.1 }), this.armR);
    this.armL = this.node(this.man, 16, 92, 0);
    const al = new ModelBuilder();
    arm(al, coat, 42, 4.6, 0x7a8a80);
    this.mesh(al.build({ ao: 0 }), this.armL);
    // the anchor (lives in the scene, where the sim throws it)
    this.anchor = new THREE.Group();
    scene.add(this.anchor);
    const am = new ModelBuilder();
    const rust = weather(0x4a3a30, 0.5, 0.15, 0x7a4a2a);
    am.add(cyl(3, 3, 60, 8), { col: rust, pos: [0, 30, 0], surf: SURF.iron });
    am.add(cyl(2, 2, 36, 6), { col: rust, pos: [0, 56, 0], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
    am.add(torus(4, 1.4, 6, 12), { col: rust, pos: [0, 63, 0], surf: SURF.iron });
    am.add(torus(22, 3, 6, 18, Math.PI), { col: rust, pos: [0, 22, 0], rot: [0, 0, Math.PI], surf: SURF.iron });
    for (const s of [-1, 1]) am.add(cone(6, 12, 4), { col: rust, pos: [s * 22, 26, 0], rot: [0, 0, s * 0.5], scale: [1, 1, 0.4], surf: SURF.iron });
    for (let i = 0; i < 6; i++) am.add(cone(1.4, 2.6, 6), { col: 0xcfc6b0, pos: [(i - 2.5) * 3, 14 + (i % 2) * 6, 2.6], surf: SURF.bone });
    this.mesh(am.build({ ao: 0.2 }), this.anchor);
    this.chain = new Strand(scene, this.mat, 14, 1.6);
    // the Gala Queen: a 1930s excursion steamer, every porthole burning green-white
    this.ship = new THREE.Group();
    scene.add(this.ship);
    this.mesh(galaQueenGeometry(), this.ship, false);
    this.ship.visible = false;
  }

  update(b: DrownedCaptainBoss, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    const glowF = r.assets.atlas.get('fx_glow_0');
    // the ship: rises out of the sea as she shows her lights, settles back as they go out
    this.ship.visible = !b.removed && b.ship > 0.01;
    if (this.ship.visible) {
      const sea = seaSurfaceHeight(waterDepth(b.shipX, b.shipY));
      this.ship.position.set(b.shipX, sea - 14 - (1 - b.ship) * 190 + Math.sin(t * 0.6) * 4, b.shipY);
      this.ship.rotation.set(Math.sin(t * 0.5) * 0.02, 0, Math.sin(t * 0.37) * 0.03);
      this.ship.scale.setScalar(1.1);
      if (b.ship > 0.4) {
        pool.add(b.shipX, b.shipY - 40, 700, 0.85 * b.ship, 0.55, 1, 0.8, 90, 1.5);
        if (b.shipFire > 0.05) for (let i = 0; i < 6; i++) r.glow.draw(glowF, b.shipX - 160 + i * 64, b.shipY - 45, 40, 1.6 * b.shipFire, 1.6 * b.shipFire, 0, 1, 0.75, 0.4, 0.9 * b.shipFire);
      }
    }
    this.group.visible = !b.removed && b.dive < 0.98;
    this.anchor.visible = this.group.visible && b.anchor > 0;
    if (!this.group.visible) {
      this.chain.hide();
      return;
    }
    const P = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    const sink = seaSurfaceHeight(Math.max(0, waterDepth(x, y)));
    this.group.position.set(x, sink - b.dive * 200, y);
    this.group.scale.setScalar(1.7);
    const p = g.nearestLiving(x, y);
    if (!b.dead) faceToward(this.group, x, y, p.x, p.y, dt);
    this.armR.rotation.x = -0.3 - (P.slash ?? 0) * 1.8;
    this.armR.rotation.z = -(P.slash ?? 0) * 0.5;
    this.armL.rotation.x = -0.3 - (P.throw ?? 0) * 1.6 - (P.whistle ?? 0) * 1.2;
    this.armL.rotation.z = (P.whistle ?? 0) * 0.4;
    const sal = clamp(P.salute ?? 0, 0, 1);
    this.armR.rotation.x -= sal * 2.2;
    this.armR.rotation.z += sal * 0.6;
    this.man.rotation.z = Math.sin(t * 1.3) * 0.04;
    this.head.rotation.x = -(P.whistle ?? 0) * 0.25;
    if (this.anchor.visible) {
      this.anchor.position.set(b.anchorX, 6, b.anchorY);
      this.anchor.rotation.set(Math.PI / 2 - 0.3, Math.atan2(b.anchorX - x, b.anchorY - y), 0);
      this.anchor.scale.setScalar(1.5);
      // the chain, from his hand to the anchor's ring, sagging
      const hand = new THREE.Vector3(16, 50, 8).multiplyScalar(1.7).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.group.rotation.y).add(this.group.position);
      const a: V3 = [b.anchorX, 10, b.anchorY];
      const pts: V3[] = [];
      for (let i = 0; i <= 14; i++) {
        const k = i / 14;
        pts.push([lerp(hand.x, a[0], k), lerp(hand.y, a[1], k) - Math.sin(k * Math.PI) * 22, lerp(hand.z, a[2], k)]);
      }
      this.chain.set(pts);
    } else this.chain.hide();
    this.state(b, t, [1, 1, 1, 1], [0.55, 0.9, 1, 0.55]);
    if (b.awake && !b.dead) pool.add(x, y, 380, 0.55, 0.55, 0.9, 1, 160, 3);
  }

  hideAll(): void {
    this.group.visible = false;
    this.ship.visible = false;
    this.anchor.visible = false;
    this.chain.hide();
  }
}

/** The Gala Queen (D-68): a 1930s excursion steamer, every porthole burning green-white (the Captain's
 *  ship offshore, and the one Summer's End brings in to the pier). */
export function galaQueenGeometry(): THREE.BufferGeometry {
  const sm = new ModelBuilder();
  const hull = weather(0x1a2024, 0.4, 0.05, 0x3a4a44);
  sm.add(rbox(470, 48, 74, 12), { col: hull, pos: [0, 24, 0], surf: SURF.paint });
  sm.add(cone(37, 70, 6), { col: hull, pos: [-262, 24, 0], rot: [0, 0, Math.PI / 2], scale: [1, 1, 1], surf: SURF.paint });
  sm.add(rbox(320, 34, 58, 6), { col: weather(0x8a9088, 0.45, 0.05, 0x4a5048), pos: [20, 64, 0], surf: SURF.paint });
  sm.add(rbox(210, 24, 46, 5), { col: weather(0x9aa098, 0.45, 0.05), pos: [30, 93, 0], surf: SURF.paint });
  sm.add(rbox(50, 22, 40, 4), { col: weather(0x9aa098, 0.45, 0.05), pos: [-90, 114, 0], surf: SURF.paint });
  for (const fx of [10, 90]) {
    sm.add(cyl(13, 14, 74, 14), { col: weather(0xb8a888, 0.4), pos: [fx, 142, 0], rot: [0, 0, -0.1], surf: SURF.paint });
    sm.add(cyl(13.2, 13.2, 12, 14, true), { col: PAL.ink, pos: [fx + 4, 174, 0], rot: [0, 0, -0.1], surf: SURF.paint });
  }
  sm.add(cyl(1.6, 1.6, 150, 6), { col: PAL.woodDark, pos: [-170, 120, 0], surf: SURF.wood });
  sm.add(cyl(1.6, 1.6, 130, 6), { col: PAL.woodDark, pos: [180, 110, 0], surf: SURF.wood });
  const ghost = 0xb8ffe0;
  for (const [y, z, n, x0, dx] of [[32, 37.2, 18, -200, 23], [64, 29.2, 13, -120, 23], [93, 23.2, 8, -60, 23]] as [number, number, number, number, number][]) {
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) sm.add(sphere(3, 8, 6), { col: ghost, pos: [x0 + i * dx, y, s * z], surf: SURF.bulb, emit: 1.8 });
  }
  for (const s of [-1, 1]) sm.add(box(300, 1.4, 1), { col: ghost, pos: [20, 82, s * 29.5], surf: SURF.bulb, emit: 1.2 });
  return sm.build({ ao: 0.2 });
}

// ======================================================================= the Last Ride
function carModel(lead: boolean): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const paint = weather(0x6a1414, 0.42, 0.06, 0x2a1a14);
  const L = lead ? 64 : 48, W = lead ? 46 : 40;
  m.add(rbox(W, 20, L, 6), { col: paint, pos: [0, 14, 0], surf: SURF.paint });
  m.add(rbox(W - 10, 8, L - 16, 3), { col: 0x140808, pos: [0, 21, -3], surf: SURF.paint });
  m.add(rbox(W + 1, 1.6, L + 1, 0.8), { col: PAL.gold, pos: [0, 24.4, 0], surf: SURF.gold, emit: 0.3 });
  m.add(rbox(W - 6, 5, L - 6, 1.2), { col: PAL.iron, pos: [0, 4, 0], surf: SURF.iron });
  for (const x of [-W / 2, W / 2]) for (const z of [-L / 2 + 10, L / 2 - 10]) m.add(cyl(5, 5, 3, 12), { col: PAL.iron, pos: [x, 5, z], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
  // chase bulbs down both sides
  for (const s of [-1, 1]) for (let i = 0; i < (lead ? 7 : 5); i++) m.add(sphere(1.5, 6, 4), { col: 0xffd27a, pos: [s * (W / 2 + 0.6), 18, -L / 2 + 8 + i * ((L - 16) / ((lead ? 7 : 5) - 1))], surf: SURF.bulb, emit: 1.1 });
  // a rider: a pale shape, arms flung up
  const ghost = 0x9ab8c4;
  m.add(cyl(6, 7, 18, 8), { col: ghost, pos: [0, 30, -6], surf: SURF.glass, emit: 0.22 });
  m.add(sphere(5.5, 10, 8), { col: ghost, pos: [0, 44, -6], surf: SURF.glass, emit: 0.22 });
  m.add(ellipsoid(2.2, 3.2, 1, 8, 6), { col: 0x0a1418, pos: [0, 42.5, -0.8], surf: SURF.rubber });
  for (const s of [-1, 1]) m.add(tube([[s * 6, 36, -6], [s * 12, 48, -4], [s * 14, 62, -3]], (u) => 2 - u * 0.8, 4, 6), { col: ghost, surf: SURF.glass, emit: 0.22 });
  if (lead) {
    // the figurehead: a sea serpent's head reared up off the nose
    m.add(tube([[0, 18, L / 2 - 4], [0, 34, L / 2 + 8], [0, 44, L / 2 + 14]], (u) => 8 - u * 2, 8, 10), { col: paint, surf: SURF.paint });
    m.add(ellipsoid(9, 8, 13, 12, 8), { col: paint, pos: [0, 47, L / 2 + 20], surf: SURF.paint });
    for (const s of [-1, 1]) {
      m.add(sphere(2.6, 8, 6), { col: 0xffe8a0, pos: [s * 5.5, 51, L / 2 + 27], surf: SURF.bulb, emit: 2.2 });
      m.add(cone(2, 10, 5), { col: PAL.gold, pos: [s * 6, 57, L / 2 + 14], rot: [-0.8, 0, s * 0.4], surf: SURF.gold });
    }
    for (let i = 0; i < 7; i++) m.add(cone(0.9, 4, 4), { col: PAL.bone, pos: [-4.5 + i * 1.5, 41.5, L / 2 + 30], rot: [Math.PI, 0, 0], surf: SURF.bone });
  }
  return m.build({ ao: 0.25 });
}

export class LastRideRig extends Rig {
  lead: THREE.Group;
  jaw: THREE.Group;
  cars: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    super(scene);
    this.lead = this.node();
    this.mesh(carModel(true), this.lead);
    this.jaw = this.node(this.lead, 0, 42, 52);
    const jm = new ModelBuilder();
    jm.add(ellipsoid(7.5, 3.4, 11, 10, 6), { col: weather(0x5a1010, 0.4), pos: [0, -2, 4], surf: SURF.paint });
    for (let i = 0; i < 6; i++) jm.add(cone(0.9, 4, 4), { col: PAL.bone, pos: [-3.8 + i * 1.5, 1.4, 12], surf: SURF.bone });
    this.mesh(jm.build({ ao: 0 }), this.jaw);
    const geo = carModel(false);
    for (let k = 0; k < 5; k++) {
      const c = this.node();
      this.mesh(geo, c);
      this.cars.push(c);
    }
  }

  update(b: LastRideBoss, g: Game, r: GameRenderer3D, alpha: number, _dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (!this.group.visible) return;
    const glowF = r.assets.atlas.get('fx_glow_0');
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    const lift = b.air * 240;
    const S = 1.55;
    this.lead.position.set(x, lift, y + lift * COT);
    this.lead.rotation.set(-b.air * 0.6, Math.PI / 2 - b.heading, Math.sin(b.pose.rock ?? 0) * 0.05);
    this.lead.scale.setScalar(S);
    this.jaw.rotation.x = (b.pose.mouth ?? 0) * 0.7 + (b.scream > 0.1 ? Math.abs(Math.sin(t * 20)) * 0.25 : 0);
    let px = x, py = y;
    for (let k = 0; k < this.cars.length; k++) {
      const c = this.cars[k];
      const cx = b.cars[k * 2], cy = b.cars[k * 2 + 1];
      c.visible = k < b.coupled && cx !== undefined;
      if (!c.visible) continue;
      const cl = lift * Math.max(0, 1 - (k + 1) * 0.25);
      c.position.set(cx, cl, cy + cl * COT);
      c.rotation.set(0, Math.atan2(px - cx, py - cy), Math.sin((b.pose.rock ?? 0) + k) * 0.05);
      c.scale.setScalar(S * 0.95);
      px = cx;
      py = cy;
    }
    this.state(b, t, [1, 1, 1, 1], [1, 0.45, 0.3, 0.55]);
    if (b.awake && !b.dead) {
      const hx = x + Math.cos(b.heading) * 70, hy = y + Math.sin(b.heading) * 70;
      pool.add(hx, hy, 380, 0.7 * (0.6 + 0.4 * b.lights), 1, 0.85, 0.55, 60, 3);
      r.glow.draw(glowF, x + Math.cos(b.heading) * 55, y + Math.sin(b.heading) * 55, lift + 78, 0.8, 0.8, 0, 1, 0.9, 0.6, 0.45);
      // the chase lights race down the train
      for (let k = 0; k < b.coupled; k++) {
        const on = Math.sin(t * 9 - k * 1.3) > 0;
        if (on) r.glow.draw(glowF, b.cars[k * 2], b.cars[k * 2 + 1], 30, 0.5, 0.5, 0, 1, 0.75, 0.35, 0.3 * b.lights);
      }
    }
  }
}

// ======================================================================= the Leviathan
export class LeviathanRig extends Rig {
  head: THREE.Group;
  jaw: THREE.Group;
  coils: THREE.Group[] = [];
  tents: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    super(scene);
    const hide = (k = 0.12) => weather(0x1a2428, 0.5, k, 0x3a4a44);
    this.head = this.node();
    const hm = new ModelBuilder();
    // a skull like an eel's crossed with something deeper: a long head, a brow of barnacles
    hm.add(ellipsoid(44, 34, 64, 18, 12), { col: hide(), pos: [0, 40, 0], surf: SURF.latex });
    hm.add(ellipsoid(36, 18, 30, 14, 8), { col: hide(), pos: [0, 30, 44], surf: SURF.latex });
    for (const s of [-1, 1]) {
      hm.add(ellipsoid(14, 8, 26, 10, 6), { col: hide(0.2), pos: [s * 24, 62, 20], rot: [0.2, s * 0.3, 0], surf: SURF.latex });
      // eyes: lamps sunk under the brow
      hm.add(sphere(7, 12, 10), { col: 0xc8ffe0, pos: [s * 26, 54, 38], surf: SURF.bulb, emit: 2.4 });
      hm.add(sphere(3, 8, 6), { col: 0x0a1410, pos: [s * 27.5, 54, 44], surf: SURF.glass });
      // gill frills
      for (let i = 0; i < 4; i++) hm.add(cone(9, 26, 4), { col: 0x2a3a3a, pos: [s * (40 + i * 2), 40 - i * 6, -10 - i * 10], rot: [0, 0, s * (Math.PI / 2 + 0.2 * i)], scale: [1, 1, 0.25], surf: SURF.latex });
    }
    // the upper teeth, long and glassy
    for (let i = 0; i < 16; i++) {
      const a = -1.2 + (i / 15) * 2.4;
      hm.add(cone(2.2, 14 + (i % 3) * 4, 5), { col: 0xe8ecd8, pos: [Math.sin(a) * 33, 18, 44 + Math.cos(a) * 26], rot: [Math.PI, 0, 0], surf: SURF.glass });
    }
    // the crown: barnacles, and three lures like the anglers', burning
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      hm.add(cone(3 + (i % 3), 5 + (i % 4) * 2, 6), { col: 0xcfc6b0, pos: [Math.cos(a) * 22, 70 + (i % 2) * 3, Math.sin(a) * 30 - 6], surf: SURF.bone });
    }
    for (const [x, z] of [[-14, 10], [14, 10], [0, -16]] as [number, number][]) {
      hm.add(tube([[x, 70, z], [x * 1.3, 96, z + 6], [x * 1.4, 104, z + 18]], (u) => 2.4 - u, 5, 8), { col: hide(), surf: SURF.latex });
      hm.add(sphere(4, 10, 8), { col: 0xd8ffc0, pos: [x * 1.4, 100, z + 22], surf: SURF.bulb, emit: 2.6 });
    }
    this.mesh(hm.build({ ao: 0.25 }), this.head);
    this.jaw = this.node(this.head, 0, 22, 10);
    const jm = new ModelBuilder();
    jm.add(ellipsoid(34, 12, 44, 14, 8), { col: hide(), pos: [0, -8, 28], surf: SURF.latex });
    jm.add(ellipsoid(26, 6, 34, 12, 6), { col: 0x2a0a10, pos: [0, -2, 30], surf: SURF.skin });
    for (let i = 0; i < 14; i++) {
      const a = -1.15 + (i / 13) * 2.3;
      jm.add(cone(2, 12 + (i % 2) * 5, 5), { col: 0xe8ecd8, pos: [Math.sin(a) * 30, 2, 30 + Math.cos(a) * 30], surf: SURF.glass });
    }
    this.mesh(jm.build({ ao: 0 }), this.jaw);
    // the neck going down under the boards, and two coils of its body arching out of the ground
    const nm = new ModelBuilder();
    nm.add(tube([[0, 30, -40], [0, 10, -90], [0, -60, -130]], (u) => 34 - u * 4, 12, 10), { col: hide(), surf: SURF.latex });
    for (let i = 0; i < 6; i++) nm.add(cone(4, 16, 4), { col: 0x101418, pos: [0, 52 - i * 10, -40 - i * 16], rot: [-0.7, 0, 0], surf: SURF.latex });
    this.mesh(nm.build({ ao: 0.2 }), this.head);
    const coilGeo = (() => {
      const c = new ModelBuilder();
      c.add(torus(70, 24, 10, 22, Math.PI), { col: hide(), surf: SURF.latex });
      for (let i = 0; i < 9; i++) {
        const a = 0.2 + (i / 8) * (Math.PI - 0.4);
        c.add(cone(4, 18, 4), { col: 0x101418, pos: [Math.cos(a) * 70, Math.sin(a) * 70 + 22, 0], rot: [0, 0, a - Math.PI / 2], surf: SURF.latex });
      }
      return c.build({ ao: 0.2 });
    })();
    for (let i = 0; i < 2; i++) {
      const c = this.node();
      this.mesh(coilGeo, c);
      this.coils.push(c);
    }
    // the tentacles: tapering, curled at the tip, pale suckers down the inside
    const tm = new ModelBuilder();
    const pts: V3[] = [[0, 0, 0], [0, 50, 4], [4, 100, 10], [10, 140, 4], [6, 166, -14], [-6, 172, -22]];
    tm.add(tube(pts, (u) => 15 * (1 - u * 0.85), 10, 22), { col: hide(), surf: SURF.latex });
    for (let i = 0; i < 9; i++) {
      const k = i / 9, a = pts[Math.min(4, Math.floor(k * 5))];
      tm.add(sphere(3.4 * (1 - k * 0.7), 6, 4), { col: 0xc8a8a0, pos: [a[0], 12 + k * 150, a[2] + 12 * (1 - k)], surf: SURF.skin });
    }
    const tgeo = tm.build({ ao: 0.2 });
    for (let i = 0; i < 6; i++) {
      const n = this.node();
      this.mesh(tgeo, n);
      n.visible = false;
      this.tents.push(n);
    }
  }

  update(b: LeviathanBoss, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (!this.group.visible) return;
    const P = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    const sea = seaSurfaceHeight(Math.max(0, waterDepth(x, y)));
    const S = 2.6;
    this.head.visible = b.up > 0.02;
    this.head.position.set(x, sea + 12 - (1 - b.up) * 380 + Math.sin(t * 0.8) * 4, y);
    this.head.scale.setScalar(S);
    const p = g.nearestLiving(x, y);
    if (!b.dead) faceToward(this.head, x, y, p.x, p.y, dt, 3);
    this.head.rotation.x = -(P.roar ?? 0) * 0.25 + Math.sin(t * 0.7) * 0.03;
    this.jaw.rotation.x = 0.1 + (P.jaw ?? 0) * 0.65 + (P.roar ?? 0) * 0.35;
    // the coils arch behind the head, rising and sinking with it
    const yaw = this.head.rotation.y;
    for (let i = 0; i < this.coils.length; i++) {
      const c = this.coils[i];
      const back = 260 + i * 210, side = (i % 2 ? 1 : -1) * 90;
      const cx = x - Math.sin(yaw) * back + Math.cos(yaw) * side, cy = y - Math.cos(yaw) * back - Math.sin(yaw) * side;
      const cs = seaSurfaceHeight(Math.max(0, waterDepth(cx, cy)));
      c.visible = b.up > 0.1;
      c.position.set(cx, cs - 60 - (1 - b.up) * 200 + Math.sin(t * 0.9 + i) * 10, cy);
      c.rotation.set(0, yaw + Math.PI / 2 + i * 0.4, 0);
      c.scale.setScalar(1.5 - i * 0.15);
    }
    for (let i = 0; i < this.tents.length; i++) {
      const n = this.tents[i];
      const up = b.tents[i * 4 + 2] ?? 0;
      n.visible = up > 0.02 && !b.removed;
      if (!n.visible) continue;
      const tx = b.tents[i * 4], ty = b.tents[i * 4 + 1], a = b.tents[i * 4 + 3];
      const ts = seaSurfaceHeight(Math.max(0, waterDepth(tx, ty)));
      n.position.set(tx, ts - 10, ty);
      n.scale.set(1.3, 1.3 * up, 1.3);
      n.rotation.set(Math.sin(t * 1.7 + i) * 0.12 + 0.35, Math.PI / 2 - a, Math.cos(t * 1.3 + i * 2) * 0.12);
    }
    this.state(b, t, [1, 1, 1, 1], [0.35, 1, 0.75, 0.6]);
    if (b.awake && !b.dead && b.up > 0.3) {
      pool.add(x, y, 560, 0.75 * b.up, 0.55, 1, 0.75, 180, 3);
      const glowF = r.assets.atlas.get('fx_glow_0');
      for (const s of [-1, 1]) {
        const ex = x + Math.sin(yaw) * 38 * S + Math.cos(yaw) * s * 26 * S, ey = y + Math.cos(yaw) * 38 * S - Math.sin(yaw) * s * 26 * S;
        r.glow.draw(glowF, ex, ey, this.head.position.y + 54 * S, 1, 1, 0, 0.7, 1, 0.8, 0.7 * b.up);
      }
    }
  }

  hideAll(): void {
    this.group.visible = false;
  }
}

// ======================================================================= the Commodore
export class CommodoreRig extends Rig {
  man = this.node();
  head: THREE.Group;
  hat: THREE.Group;
  armR: THREE.Group;
  armL: THREE.Group;
  pages: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    super(scene);
    const suit = weather(0xd8d0b8, 0.55, 0.07, 0x5a6a3a);
    const m = new ModelBuilder();
    for (const s of [-1, 1]) {
      m.add(cyl(4.6, 4.2, 44, 8), { col: suit, pos: [s * 7.5, 22, 0], surf: SURF.cloth });
      shoe(m, [s * 7.5, 0, -2], 15, 0x2a2018, PART.BODY, [0, 0, 0], 0.1);
    }
    m.add(lathe([[0, 40], [14, 41], [15, 56], [15, 78], [14, 90], [7, 95], [0, 96]], 16, 10), { col: suit, scale: [1, 1, 0.8], surf: SURF.cloth });
    for (let i = 0; i < 4; i++) m.add(sphere(1.3, 6, 4), { col: PAL.gold, pos: [5, 64 + i * 6, 12], surf: SURF.gold });
    m.add(box(5, 6, 1), { col: 0x1a3a6a, pos: [-6, 82, 12], surf: SURF.cloth });
    m.add(cyl(2.4, 2.4, 0.8, 10), { col: PAL.gold, pos: [-6, 77, 12.4], rot: [Math.PI / 2, 0, 0], surf: SURF.gold, emit: 0.3 });
    this.mesh(m.build({ ao: 0.25 }), this.man);
    this.head = this.node(this.man, 0, 97, 0);
    const hm = new ModelBuilder();
    const skin = weather(0xc8c0b0, 0.35, 0.12, 0x7a8a7a);
    hm.add(ellipsoid(9.5, 12, 10, 14, 10), { col: skin, pos: [0, 11, 0], surf: SURF.skin });
    for (const s of [-1, 1]) {
      hm.add(ellipsoid(3.6, 7, 3, 8, 6), { col: 0xe8e4d8, pos: [s * 8, 7, 4], surf: SURF.cloth });
      hm.add(sphere(1.3, 6, 4), { col: 0x9ff8e0, pos: [s * 3.6, 13, 9.2], surf: SURF.bulb, emit: 1.2 });
    }
    hm.add(tube([[-4, 6, 9.6], [0, 5.2, 10.2], [4, 6, 9.6]], 0.7, 4, 6), { col: PAL.ink, surf: SURF.paint });
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    this.hat = this.node(this.man, 0, 116, 0);
    const hat = new ModelBuilder();
    hat.add(cyl(10.5, 9.5, 6, 18), { col: weather(0xe8e4d8, 0.4, 0.2, 0x7a8a6a), pos: [0, 3, -0.5], rot: [-0.08, 0, 0], surf: SURF.cloth });
    hat.add(cyl(9.8, 9.8, 2, 18, true), { col: 0x14181c, pos: [0, 0.5, -0.5], surf: SURF.cloth });
    hat.add(cyl(6, 6, 0.8, 14), { col: 0x0a0c0e, pos: [0, 0, 8], rot: [-0.25, 0, 0], scale: [1, 1, 0.7], surf: SURF.latex });
    hat.add(sphere(1.8, 8, 6), { col: PAL.gold, pos: [0, 3, 9.4], surf: SURF.gold, emit: 0.3 });
    this.mesh(hat.build({ ao: 0 }), this.hat);
    this.armR = this.node(this.man, -15, 88, 0);
    const ar = new ModelBuilder();
    arm(ar, suit, 40, 4.2, 0xe8e4d8);
    ar.add(cyl(1.4, 1.4, 72, 6), { col: PAL.woodDark, pos: [0, -64, 7], rot: [0.12, 0, 0], surf: SURF.wood });
    ar.add(sphere(3.2, 8, 6), { col: 0xc8d0d8, pos: [0, -28, 3], surf: SURF.iron });
    this.mesh(ar.build({ ao: 0 }), this.armR);
    this.armL = this.node(this.man, 15, 88, 0);
    const al = new ModelBuilder();
    arm(al, suit, 40, 4.2, 0xe8e4d8);
    al.add(rbox(18, 4, 24, 1), { col: weather(0x4a2a1a, 0.4), pos: [0, -46, 10], rot: [-0.9, 0, 0], surf: SURF.rubber });
    for (const [x, z] of [[-8, -11], [8, -11], [-8, 11], [8, 11]] as [number, number][]) al.add(box(2.4, 4.2, 2.4), { col: PAL.gold, pos: [x, -46, 10 + z * 0.6], surf: SURF.gold });
    this.mesh(al.build({ ao: 0 }), this.armL);
    const pm = new ModelBuilder();
    pm.add(box(16, 1.6, 22), { col: 0xfff0d0, pos: [0, -43.6, 12], rot: [-0.9, 0, 0], surf: SURF.paint, emit: 0.6 });
    this.pages = this.mesh(pm.build({ ao: 0 }), this.armL, false);
  }

  update(b: CommodoreBoss, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (!this.group.visible) return;
    const P = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    this.group.position.set(x, 0, y);
    this.group.scale.setScalar(1.7);
    const p = g.nearestLiving(x, y);
    if (!b.dead) faceToward(this.group, x, y, p.x, p.y, dt);
    this.armR.rotation.x = -0.25 - (P.cane ?? 0) * 1.7 - (P.point ?? 0) * 1.3;
    this.armR.rotation.z = -(P.cane ?? 0) * 0.5;
    this.armL.rotation.x = -0.5 - (P.ledger ?? 0) * 0.9;
    this.hat.position.y = 116 + (P.tip ?? 0) * 10;
    this.hat.rotation.z = -(P.tip ?? 0) * 0.4;
    this.man.rotation.z = Math.sin(t * 1.1) * 0.03;
    const burn = clamp(P.burn ?? 0, 0, 1);
    this.state(b, t, [1, 1 - burn * 0.3, 1 - burn * 0.5, 1], burn > 0.1 ? [1, 0.5, 0.2, 0.9] : [0.9, 1, 0.85, 0.5]);
    if (b.awake && !b.removed) {
      const glowF = r.assets.atlas.get('fx_glow_0');
      const lx = x + Math.sin(this.group.rotation.y) * 30 + Math.cos(this.group.rotation.y) * 24;
      const ly = y + Math.cos(this.group.rotation.y) * 30 - Math.sin(this.group.rotation.y) * 24;
      r.glow.draw(glowF, lx, ly, 90, 0.8 + burn, 0.8 + burn, 0, 1, 0.8 - burn * 0.3, 0.5 - burn * 0.3, 0.45 + burn * 0.5);
      pool.add(x, y, 440, 0.6 + burn * 0.6, 1, 0.9 - burn * 0.3, 0.7 - burn * 0.4, 170, 3);
    }
  }
}

/** Rig glow colours (boss bar, lights) for the Boardwalk's bosses. */
export function boardwalkGlow(id: string): [number, number, number] | null {
  switch (id) {
    case 'barker': return [1, 0.75, 0.45];
    case 'drowned_captain': return [0.5, 0.9, 1];
    case 'last_ride': return [1, 0.45, 0.3];
    case 'leviathan': return [0.4, 1, 0.75];
    case 'commodore': return [0.95, 0.95, 0.8];
  }
  return null;
}

export type BoardwalkRigs = { barker: BarkerRig; captain: CaptainRig; ride: LastRideRig; leviathan: LeviathanRig; commodore: CommodoreRig };

/** Draw this frame's Boardwalk bosses; hide the rigs of the ones not present. */
export function updateBoardwalkRigs(R: BoardwalkRigs, bosses: BossBase[], g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
  const seen = new Set<string>();
  for (const b of bosses) {
    seen.add(b.def.id);
    switch (b.def.id) {
      case 'barker': R.barker.update(b as BarkerBoss, g, r, alpha, dt); break;
      case 'drowned_captain': R.captain.update(b as DrownedCaptainBoss, g, r, alpha, dt); break;
      case 'last_ride': R.ride.update(b as LastRideBoss, g, r, alpha, dt); break;
      case 'leviathan': R.leviathan.update(b as LeviathanBoss, g, r, alpha, dt); break;
      case 'commodore': R.commodore.update(b as CommodoreBoss, g, r, alpha, dt); break;
    }
  }
  if (!seen.has('barker')) R.barker.group.visible = false;
  if (!seen.has('drowned_captain')) R.captain.hideAll();
  if (!seen.has('last_ride')) R.ride.group.visible = false;
  if (!seen.has('leviathan')) R.leviathan.hideAll();
  if (!seen.has('commodore')) R.commodore.group.visible = false;
}
