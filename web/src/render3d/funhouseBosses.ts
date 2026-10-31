// The Fun House's boss rigs (D-63): the Crooked Twins and their rope, the Looking Glass and its
// reflections, the Stringmistress on her strings, Professor Grinwell, and the Unreflected. Same rules
// as render3d/bosses.ts: articulated ModelBuilder models driven by each boss's replicated pose, and
// anything the sim places up in the air is drawn shifted south by height·cot(elevation), so it shows
// where the sim has it.

import * as THREE from 'three';
import { clamp, lerp } from '../core/math';
import type { Game } from '../sim/game';
import type { TwinsBoss } from '../sim/bosses/twins';
import type { LookingGlassBoss } from '../sim/bosses/lookingGlass';
import type { StringmistressBoss } from '../sim/bosses/stringmistress';
import type { ProprietorBoss } from '../sim/bosses/proprietor';
import type { UnreflectedBoss } from '../sim/bosses/unreflected';
import { ModelBuilder, PART, SURF, box, cone, cyl, ellipsoid, extrude, lathe, sphere, starShape, torus, tube, weather, stripes, type V3 } from './core/geo';
import { actorMaterial, pool, setObjectState } from './core/materials';
import { PAL, eyes, glove, ruff, shoe, tophat } from './models/kit';
import type { GameRenderer3D } from './renderer3d';
import { Rig } from './rig';
import { COT_EL as COT } from './core/view';

const UP = new THREE.Vector3(0, 1, 0);
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);

/** A run of thin cylinders strung through points (ropes, strings, lines): drawn fresh each frame. */
export class Strand {
  segs: THREE.Mesh[] = [];
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  constructor(parent: THREE.Object3D, mat: THREE.Material, n: number, private r: number) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(UNIT_CYL, mat);
      m.frustumCulled = false;
      m.visible = false;
      parent.add(m);
      this.segs.push(m);
    }
  }
  /** Lay the strand through `pts` (world space); unused segments hide. */
  set(pts: V3[]): void {
    this.segs.forEach((m, i) => {
      if (i >= pts.length - 1) {
        m.visible = false;
        return;
      }
      this.a.set(pts[i][0], pts[i][1], pts[i][2]);
      this.b.set(pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]);
      const len = this.a.distanceTo(this.b);
      m.visible = len > 0.5;
      m.position.copy(this.a).add(this.b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, this.b.sub(this.a).normalize());
      m.scale.set(this.r, len, this.r);
    });
  }
  hide(): void {
    for (const m of this.segs) m.visible = false;
  }
}

// ======================================================================= the Crooked Twins
export class TwinsRig extends Rig {
  stilts = this.node();
  barrel = this.node();
  tip: THREE.Group;
  spin: THREE.Group;
  bHead: THREE.Group;
  legL!: THREE.Group;
  legR!: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
  rope: Strand;
  private yawB = 0;
  private ropeMat = actorMaterial({ matte: true });

  constructor(scene: THREE.Scene) {
    super(scene);
    // --- Stilts: a beanpole clown, striped trousers down over the stilts
    const hip = 150;
    for (const s of [-1, 1]) {
      const leg = this.node(this.stilts, s * 9, hip, 0);
      const lm = new ModelBuilder();
      lm.add(cyl(6, 4.5, hip - 18, 8), { col: stripes(10, 0xd8c8a8, PAL.blood, 0, 0.2), pos: [0, -(hip - 18) / 2, 0], surf: SURF.cloth });
      lm.add(cyl(2.4, 2.8, 22, 6), { col: weather(PAL.woodPale, 0.4), pos: [0, -hip + 11, 0], surf: SURF.wood });
      lm.add(cyl(5, 5, 3, 8), { col: PAL.woodDark, pos: [0, -hip + 1.5, 0], surf: SURF.wood });
      this.mesh(lm.build({ ao: 0.2 }), leg);
      if (s < 0) this.legL = leg;
      else this.legR = leg;
    }
    const tm = new ModelBuilder();
    tm.add(lathe([[0, hip - 4], [14, hip - 2], [13, hip + 20], [11, hip + 48], [15, hip + 62], [8, hip + 70], [0, hip + 71]], 12, 8), { col: weather(PAL.mustard, 0.4, 0.06), scale: [1, 1, 0.75], surf: SURF.cloth });
    for (let i = 0; i < 4; i++) tm.add(sphere(1.8, 6, 4), { col: PAL.blood, pos: [0, hip + 14 + i * 12, 10.4], surf: SURF.paint });
    ruff(tm, hip + 70, 13, PAL.cream, PART.BODY, undefined, 12);
    this.mesh(tm.build({ ao: 0.25 }), this.stilts);
    this.head = this.node(this.stilts, 0, hip + 74, 0);
    const hm = new ModelBuilder();
    hm.add(ellipsoid(10, 13, 10, 12, 10), { col: weather(PAL.clown, 0.2), pos: [0, 11, 0], surf: SURF.porcelain });
    eyes(hm, { x: 3.8, y: 13, z: 8.6, r: 2, sclera: PAL.bone, color: PAL.ink, part: PART.BODY });
    hm.add(tube([[-6, 5, 8.5], [0, 2.4, 10], [6, 5, 8.5]], 1.2, 5, 10), { col: PAL.blood, surf: SURF.latex });
    hm.add(sphere(2.6, 8, 6), { col: PAL.hotRed, pos: [0, 9, 10.6], surf: SURF.latex });
    hm.add(cone(9, 46, 10), { col: stripes(6, PAL.cream, PAL.navy, 0, 0.2), pos: [2, 44, -2], rot: [0, 0, -0.25], surf: SURF.cloth });
    hm.add(sphere(4, 8, 6), { col: PAL.hotRed, pos: [8, 66, -2], surf: SURF.plush });
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    const arm = (s: number) => {
      const a = new ModelBuilder();
      a.add(cyl(3.6, 3, 58, 8), { col: weather(PAL.mustard, 0.4), pos: [0, -29, 0], surf: SURF.cloth });
      glove(a, [0, -62, 2], 5, PART.BODY, [0, 0, 0], PAL.bone);
      return a.build({ ao: 0 });
    };
    this.armL = this.node(this.stilts, -15, hip + 62, 0);
    this.mesh(arm(-1), this.armL);
    this.armR = this.node(this.stilts, 15, hip + 62, 0);
    this.mesh(arm(1), this.armR);
    // --- Barrel: a round clown in a staved barrel with iron hoops
    this.tip = this.node(this.barrel);
    this.spin = this.node(this.tip);
    const bm = new ModelBuilder();
    bm.add(lathe([[0, -40], [27, -40], [32, -22], [34, 0], [32, 22], [27, 40], [0, 40]], 16, 8), { col: weather(PAL.wood, 0.45, 0.08), surf: SURF.wood });
    for (const y of [-28, 0, 28]) bm.add(torus(y === 0 ? 34.4 : 31.4, 1.8, 5, 18), { col: PAL.iron, pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    for (const s of [-1, 1]) {
      bm.add(cyl(3.6, 3.2, 20, 8), { col: stripes(4, PAL.cream, PAL.blood, 0, 0.2), pos: [s * 37, 18, 0], rot: [0, 0, s * 1.1], surf: SURF.cloth });
      glove(bm, [s * 46, 12, 3], 5.4, PART.BODY, [0, 0, 0], PAL.bone);
    }
    this.mesh(bm.build({ ao: 0.25 }), this.spin);
    this.bHead = this.node(this.spin, 0, 40, 0);
    const bh = new ModelBuilder();
    bh.add(ellipsoid(16, 14, 14, 12, 10), { col: weather(PAL.clown, 0.2), pos: [0, 12, 0], surf: SURF.porcelain });
    eyes(bh, { x: 5, y: 15, z: 12, r: 2.2, sclera: PAL.bone, color: PAL.ink, part: PART.BODY });
    bh.add(sphere(3.6, 8, 6), { col: PAL.hotRed, pos: [0, 10, 14.6], surf: SURF.latex });
    bh.add(tube([[-8, 5, 12], [0, 2, 14], [8, 5, 12]], 1.4, 5, 10), { col: PAL.blood, surf: SURF.latex });
    bh.add(cyl(18, 18, 1.6, 14), { col: PAL.ink, pos: [0, 24, 0], surf: SURF.cloth });
    bh.add(ellipsoid(11, 9, 11, 12, 8), { col: PAL.ink, pos: [0, 28, 0], surf: SURF.cloth });
    this.mesh(bh.build({ ao: 0.2 }), this.bHead);
    this.rope = new Strand(this.group, this.ropeMat, 10, 2.2);
  }

  update(b: TwinsBoss, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (b.removed) return;
    const P = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    const bx = lerp(b.pbx, b.bx, alpha), by = lerp(b.pby, b.by, alpha);
    const em = clamp(P.emerge ?? 0, 0, 1);
    // Stilts
    this.stilts.position.set(x, (P.air ?? 0) * 120, y);
    const toP = Math.atan2(g.player.x - x, g.player.y - y);
    this.stilts.rotation.y = lerp(this.stilts.rotation.y, toP, 1 - Math.exp(-dt * 6));
    const topple = clamp(P.topple ?? 0, 0, 1);
    this.stilts.rotation.z = topple * topple * 1.45;
    this.stilts.scale.setScalar(1.3 * (1 - em * 0.6));
    const st = P.stride ?? 0;
    this.legL.rotation.x = Math.sin(st) * 0.32 - (P.stomp ?? 0) * 0.2;
    this.legR.rotation.x = -Math.sin(st) * 0.32 + (P.stomp ?? 0) * 0.2;
    const wail = P.wail ?? 0;
    this.head.rotation.x = -wail * 0.6 + Math.sin(t * 1.3) * 0.05;
    this.head.rotation.z = Math.sin(t * 0.9) * 0.12 + (b.alone ? 0.25 : 0);
    this.armL.rotation.z = -0.15 - wail * 2.2 - (P.toss ?? 0) * 1.2 + Math.sin(st) * 0.2;
    this.armR.rotation.z = 0.15 + wail * 2.2 + (P.taut ?? 0) * 1.0 - Math.sin(st) * 0.2;
    // Barrel: upright and waddling; tipped over and spinning down a lane; or still, on its side
    const rolling = b.anim === 'roll' && b.steer;
    const mvx = b.bx - b.pbx, mvy = b.by - b.pby;
    if (Math.hypot(mvx, mvy) > 0.5) this.yawB = Math.atan2(mvx, mvy);
    const tipT = b.alone ? 1 : rolling ? 1 : 0;
    this.tip.rotation.z = lerp(this.tip.rotation.z, tipT * Math.PI / 2, 1 - Math.exp(-dt * 10));
    const k = this.tip.rotation.z / (Math.PI / 2);
    this.tip.position.y = lerp(40, 34, k) * (1 - (P.squash ?? 0) * 0.15);
    this.barrel.position.set(bx, 0, by);
    this.barrel.rotation.y = rolling || b.alone ? this.yawB + Math.PI / 2 : lerp(this.barrel.rotation.y, toP, 1 - Math.exp(-dt * 5));
    this.spin.rotation.y = rolling ? -b.roll : Math.sin(t * 6) * 0.06;
    this.bHead.scale.setScalar(rolling ? Math.max(0.001, 1 - k) : 1);
    this.bHead.rotation.z = b.alone ? 0.6 : Math.sin(t * 3) * 0.1;
    this.barrel.scale.setScalar(1.3 * (1 - em * 0.6));
    this.state(b, t, [1, 1, 1, 1], [1, 0.75, 0.45, 0.45]);
    setObjectState(this.ropeMat, t, 0, 0, 1, [0.85, 0.72, 0.5, 1]);
    // the rope: waist to waist, sagging when slack; drawn shifted south by its height so it lies over the
    // sim's line (the clothesline's hazard is exactly that line)
    if (b.alone || b.dead) this.rope.hide();
    else {
      const ax = x, ay = 195 * (1 - em * 0.6) + (P.air ?? 0) * 120, az = y;
      const cx = bx, cy = 60, cz = by;
      const taut = clamp(P.taut ?? 0, 0, 1);
      const pts: V3[] = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const h = lerp(ay, cy, u) - Math.sin(u * Math.PI) * (1 - taut) * 55;
        const hh = Math.max(6, h);
        pts.push([lerp(ax, cx, u), hh, lerp(az, cz, u) + hh * COT]);
      }
      this.rope.set(pts);
    }
    if (b.awake && !b.dead) pool.add(x, y, 360, 0.5, 1, 0.75, 0.45, 120, 2);
  }
}

// ======================================================================= the Looking Glass
function glassModel(): { body: THREE.BufferGeometry; glass: THREE.BufferGeometry; face: THREE.BufferGeometry; cracks: THREE.BufferGeometry; shards: THREE.BufferGeometry } {
  const cy = 132;
  const body = new ModelBuilder();
  // the gilt frame: an upright oval, a crest, scrolls; four clawed legs
  body.add(torus(60, 7, 8, 40), { col: PAL.gold, pos: [0, cy, 0], scale: [1, 1.55, 1], surf: SURF.gold });
  body.add(torus(52, 2.4, 6, 40), { col: PAL.brass, pos: [0, cy, 2], scale: [1, 1.6, 1], surf: SURF.gold });
  body.add(extrude(starShape(7, 22, 10), 4, 1, 2), { col: PAL.gold, pos: [0, cy + 100, -2], surf: SURF.gold });
  body.add(sphere(7, 10, 8), { col: PAL.gold, pos: [0, cy + 124, 0], surf: SURF.gold });
  for (const s of [-1, 1]) {
    body.add(tube([[s * 58, cy + 70, 0], [s * 78, cy + 84, 0], [s * 80, cy + 60, 0], [s * 70, cy + 56, 0]], 3.2, 6, 14), { col: PAL.gold, surf: SURF.gold });
    body.add(tube([[s * 58, cy - 70, 0], [s * 76, cy - 84, 0], [s * 74, cy - 104, 0]], 3, 6, 12), { col: PAL.gold, surf: SURF.gold });
  }
  for (let k = 0; k < 4; k++) {
    const s = k < 2 ? -1 : 1, f = k % 2 ? 1 : -1;
    const top: V3 = [s * 30, cy - 86, f * 4];
    const knee: V3 = [s * 56, 38, f * 26];
    const foot: V3 = [s * 64, 4, f * 34];
    body.add(tube([top, knee, foot], (t) => 5 - t * 2.4, 7, 12), { col: PAL.gold, surf: SURF.gold });
    for (let c = 0; c < 3; c++) body.add(cone(2.4, 12, 5), { col: PAL.bone, pos: [foot[0] + (c - 1) * 4, 2, foot[2] + f * 6], rot: [f * Math.PI / 2, 0, 0], surf: SURF.bone });
  }
  body.add(ellipsoid(56, 86, 3, 20, 14), { col: PAL.woodDark, pos: [0, cy, -4], surf: SURF.wood });
  const glass = new ModelBuilder().add(ellipsoid(55, 85, 2.4, 22, 16), { col: weather(0x7d909c, 0.35, 0.05), pos: [0, cy, 1], surf: SURF.glass, emit: 0.1 }).build({ ao: 0 });
  // the face in the glass: hollow eyes and a thin cold grin
  const face = new ModelBuilder();
  // hollow, uneven eyes with pin-prick lights, and a grin of too many teeth that runs off the glass
  face.add(ellipsoid(11, 16, 1.5, 10, 8), { col: 0x05090c, pos: [-19, cy + 26, 4], rot: [0, 0, 0.2], surf: SURF.glass });
  face.add(ellipsoid(9, 12, 1.5, 10, 8), { col: 0x05090c, pos: [18, cy + 22, 4], rot: [0, 0, -0.3], surf: SURF.glass });
  face.add(sphere(1.8, 6, 4), { col: 0xffffff, pos: [-17, cy + 22, 5.4], surf: SURF.bulb, emit: 1 });
  face.add(sphere(1.5, 6, 4), { col: 0xffffff, pos: [19, cy + 19, 5.4], surf: SURF.bulb, emit: 1 });
  face.add(tube([[-44, cy - 8, 4], [-28, cy - 30, 4.4], [0, cy - 40, 4.8], [28, cy - 30, 4.4], [44, cy - 8, 4]], 4.2, 6, 20), { col: 0x05090c, surf: SURF.glass });
  for (let i = 0; i < 13; i++) {
    const u = i / 12 - 0.5, tx = u * 76, ty = cy - 38 + Math.abs(u) * Math.abs(u) * 100;
    face.add(cone(2.6, 8, 4), { col: 0xe8f4ff, pos: [tx, ty + 3, 5.6], rot: [0, 0, Math.PI], surf: SURF.bone, emit: 0.4 });
  }
  const cracks = new ModelBuilder();
  const crackPts: [number, number, number, number][] = [[0, 30, 34, 70], [0, 30, -40, 44], [0, 30, -10, -60], [0, 30, 46, -30], [34, 70, 20, 100], [-40, 44, -50, 10]];
  for (const [ax, ay, bx2, by2] of crackPts) {
    const len = Math.hypot(bx2 - ax, by2 - ay);
    cracks.add(box(1.6, len, 1), { col: 0xffffff, pos: [(ax + bx2) / 2, cy + (ay + by2) / 2 - 30, 3.6], rot: [0, 0, Math.atan2(-(bx2 - ax), by2 - ay)], surf: SURF.bulb, emit: 1 });
  }
  const shards = new ModelBuilder();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    shards.add(extrude([[0, 0], [10 + (i % 3) * 5, 3], [3, 22 + (i % 2) * 10]], 1.2, 0, 1), { col: 0xc8e0ec, pos: [Math.cos(a) * 34, cy + Math.sin(a) * 58, 2], rot: [0, 0, a + 1.4], surf: SURF.glass, emit: 0.4 });
  }
  return { body: body.build({ ao: 0.2 }), glass, face: face.build({ ao: 0 }), cracks: cracks.build({ ao: 0 }), shards: shards.build({ ao: 0 }) };
}

export class GlassRig extends Rig {
  private copies: { g: THREE.Group; glass: THREE.Mesh; face: THREE.Mesh; cracks: THREE.Mesh; shards: THREE.Mesh }[] = [];
  /** the reflections: silvered and translucent */
  private mat2 = actorMaterial({ emitBoost: 3, matte: true, transparent: true, opacity: 0.7 });

  constructor(scene: THREE.Scene) {
    super(scene);
    const m = glassModel();
    for (let i = 0; i < 3; i++) {
      const grp = this.node();
      const mk = (geo: THREE.BufferGeometry) => {
        const mesh = this.mesh(geo, grp, i === 0);
        if (i > 0) mesh.material = this.mat2;
        return mesh;
      };
      mk(m.body);
      const glass = mk(m.glass), face = mk(m.face), cracks = mk(m.cracks), shards = mk(m.shards);
      this.copies.push({ g: grp, glass, face, cracks, shards });
    }
  }

  update(b: LookingGlassBoss, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (b.removed) return;
    const P = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    const decoys = b.parts.filter((p) => p.kind === 'decoy');
    const spots = [{ x, y }, ...decoys.map((d) => ({ x: d.x, y: d.y }))];
    const em = clamp(P.emerge ?? 0, 0, 1);
    const crack = clamp(P.crack ?? 0, 0, 2);
    this.copies.forEach((c, i) => {
      const s = spots[i];
      c.g.visible = !!s;
      if (!s) return;
      c.g.position.set(s.x, 0, s.y);
      const toP = Math.atan2(g.player.x - s.x, g.player.y - s.y);
      c.g.rotation.y = lerp(c.g.rotation.y, toP, 1 - Math.exp(-dt * 5));
      // it lumbers on its claws; the reflections shiver
      const shiver = i > 0 ? Math.sin(t * 23 + i) * 0.03 : 0;
      c.g.rotation.z = Math.sin(t * 2.2 + i) * 0.05 + shiver;
      c.g.scale.set(1.3 * (1 + shiver), 1.3 * (1 - em * 0.5) * (1 + Math.sin(t * 2.2) * 0.015), 1.3);
      c.g.position.y = em * -60;
      c.glass.visible = c.face.visible = !b.broken;
      c.shards.visible = b.broken;
      c.cracks.visible = crack > 0.02 && !b.broken ? true : crack > 1;
      c.face.scale.set(1, 1 + (P.glint ?? 0) * 0.15, 1);
    });
    this.state(b, t, [1, 1, 1, 1], b.windup > 0.05 ? [0.6, 0.9, 1, 0.9 + b.windup] : [0.6, 0.85, 1, 0.6]);
    setObjectState(this.mat2, t * 2, b.windup, 0, 1, [0.75, 0.85, 1, 0.8], [0.6, 0.85, 1, 0.9]);
    this.mat2.opacity = 0.55 + Math.sin(t * 6) * 0.1;
    if (b.awake && !b.dead) pool.add(x, y, 420, 0.6, 0.6, 0.85, 1, 160, 2);
  }
}

// ======================================================================= the Stringmistress
const HANG = 210;

export class StringmistressRig extends Rig {
  body = this.node();
  legs: THREE.Group[] = [];
  armL: THREE.Group;
  armR: THREE.Group;
  bar: THREE.Group;
  head: THREE.Group;
  private hangers: Strand;
  private reel: Strand;
  private strandMat = actorMaterial({ emitBoost: 3, matte: true });

  constructor(scene: THREE.Scene) {
    super(scene);
    const bm = new ModelBuilder();
    // a porcelain doll's bodice and a velvet skirt that ends in a ring of legs
    bm.add(lathe([[0, 40], [30, 42], [26, 58], [16, 74], [12, 96], [15, 112], [8, 120], [0, 121]], 14, 8), { col: weather(0x2a1630, 0.35, 0.06), scale: [1, 1, 0.8], surf: SURF.velvet });
    bm.add(torus(30, 3, 6, 20), { col: PAL.gold, pos: [0, 42, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
    for (let i = 0; i < 6; i++) bm.add(sphere(1.6, 6, 4), { col: PAL.bone, pos: [0, 80 + i * 6, 10.5], surf: SURF.porcelain });
    ruff(bm, 118, 11, PAL.bone, PART.BODY, undefined, 14);
    this.mesh(bm.build({ ao: 0.25 }), this.body);
    this.head = this.node(this.body, 0, 122, 0);
    const hm = new ModelBuilder();
    hm.add(ellipsoid(11, 13, 11, 14, 10), { col: weather(0xe8dccc, 0.15), pos: [0, 12, 0], surf: SURF.porcelain });
    eyes(hm, { x: 4.2, y: 14, z: 9.4, r: 2.6, color: PAL.ink, glow: 0, part: PART.BODY });
    hm.add(ellipsoid(3.2, 1.6, 1.4, 8, 6), { col: PAL.blood, pos: [0, 6, 10.4], surf: SURF.latex });
    for (const s of [-1, 1]) hm.add(box(0.8, 9, 0.6), { col: 0x5a4a44, pos: [s * 5, 4, 10.2], surf: SURF.paint });
    hm.add(ellipsoid(12, 10, 12, 12, 8), { col: PAL.ink, pos: [0, 18, -3], surf: SURF.cloth });
    hm.add(sphere(7, 10, 8), { col: PAL.ink, pos: [0, 28, -6], surf: SURF.cloth });
    hm.add(cyl(0.8, 0.8, 20, 4), { col: PAL.gold, pos: [0, 30, -6], rot: [0, 0, 1.2], surf: SURF.gold });
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    // eight long jointed legs from under the skirt
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const leg = this.node(this.body, Math.cos(a) * 24, 44, Math.sin(a) * 24);
      leg.rotation.y = -a;
      const lm = new ModelBuilder();
      lm.add(tube([[0, 0, 0], [40, 26, 0], [74, -10, 0], [86, -44, 0]], (u) => 3.4 - u * 2.4, 6, 16), { col: weather(0x1c1420, 0.3), surf: SURF.latex });
      lm.add(cone(1.4, 10, 5), { col: PAL.bone, pos: [87, -49, 0], rot: [Math.PI, 0, 0], surf: SURF.bone });
      this.mesh(lm.build({ ao: 0 }), leg);
      this.legs.push(leg);
    }
    // long arms up to the crossbar she works
    const arm = () => {
      const a = new ModelBuilder();
      a.add(cyl(2.6, 2.2, 64, 6), { col: weather(0x2a1630, 0.35), pos: [0, 32, 0], surf: SURF.velvet });
      for (let f = 0; f < 4; f++) a.add(cyl(0.7, 0.5, 16, 4), { col: weather(0xe8dccc, 0.15), pos: [(f - 1.5) * 1.6, 72, 0], rot: [0, 0, (f - 1.5) * 0.12], surf: SURF.porcelain });
      return a.build({ ao: 0 });
    };
    this.armL = this.node(this.body, -14, 112, 0);
    this.mesh(arm(), this.armL);
    this.armR = this.node(this.body, 14, 112, 0);
    this.mesh(arm(), this.armR);
    this.bar = this.node(this.body, 0, 196, 6);
    const cm = new ModelBuilder();
    cm.add(box(70, 4, 4), { col: weather(PAL.woodPale, 0.35), surf: SURF.wood });
    cm.add(box(4, 4, 46), { col: weather(PAL.woodPale, 0.35), surf: SURF.wood });
    this.mesh(cm.build({ ao: 0 }), this.bar);
    this.hangers = new Strand(this.group, this.strandMat, 9, 0.9);
    this.reel = new Strand(this.group, this.strandMat, 1, 1.2);
  }

  update(b: StringmistressBoss, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (b.removed) return;
    const P = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    const hang = clamp(b.hang, 0, 1), desc = clamp(P.descend ?? 0, 0, 1), fall = clamp(P.fall ?? 0, 0, 1);
    const h = hang * HANG * (1 - fall) + desc * 700;
    // shifted south by her height, so she hangs over the spot her needles come from
    this.body.position.set(x, h, y + h * COT);
    const toP = Math.atan2(g.player.x - x, g.player.y - y);
    this.body.rotation.y = lerp(this.body.rotation.y, toP, 1 - Math.exp(-dt * 4));
    this.body.rotation.x = fall * 1.1;
    this.body.scale.setScalar(1.35);
    const lp = P.legs ?? 0;
    this.legs.forEach((leg, i) => {
      // hanging: legs drawn up and twitching; down: they skitter
      const up = hang * (1 - fall);
      leg.rotation.z = up * 0.9 + Math.sin(lp + i * 1.7) * (up > 0.5 ? 0.08 : 0.22) - (P.stab ?? 0) * (i % 2) * 0.5;
    });
    const weave = P.weave ?? 0;
    this.armL.rotation.z = 0.25 + Math.sin(t * 3) * 0.1 * (1 + weave * 3);
    this.armR.rotation.z = -0.25 - Math.sin(t * 3 + 1) * 0.1 * (1 + weave * 3);
    this.bar.rotation.z = Math.sin(t * 2) * 0.2 * (1 + weave * 2);
    this.bar.rotation.y = Math.sin(t * 1.3) * 0.3;
    this.head.rotation.z = Math.sin((P.hum ?? 0) * 1.1) * 0.15;
    this.state(b, t, [1, 1, 1, 1], [0.8, 0.6, 1, 0.55]);
    setObjectState(this.strandMat, t, 0, 0, 1, [1.4, 1.35, 1.25, 1]);
    // her own strings run up into the dark from the crossbar (taut while she hangs)
    const top = 1300;
    const s = 1.35, bx = x, by = h + 196 * s, bz = y + h * COT + 8;
    const pts: V3[] = [];
    if (hang > 0.05 && fall < 0.9) for (let k = 0; k < 4; k++) {
      const ox = (k - 1.5) * 22;
      pts.push([bx + ox, by, bz], [bx + ox * 1.6, top, bz - (top - by) * COT * 0.15]);
    }
    if (pts.length) {
      // a strand of pairs: lay each pair as its own two-point line
      this.hangers.segs.forEach((m, i) => {
        const a = pts[i * 2], c = pts[i * 2 + 1];
        if (!a || !c) {
          m.visible = false;
          return;
        }
        m.visible = true;
        const va = new THREE.Vector3(...a), vc = new THREE.Vector3(...c);
        m.position.copy(va).add(vc).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(UP, vc.clone().sub(va).normalize());
        m.scale.set(0.9, va.distanceTo(vc), 0.9);
      });
    } else this.hangers.hide();
    // the reel's line, from her hands down to whoever she hooked
    if (b.reeling > 0) this.reel.set([[x, h + 150 * s, y + (h + 150 * s) * COT], [b.reelX, 30, b.reelY + 30 * COT]]);
    else this.reel.hide();
    if (b.awake && !b.dead) pool.add(x, y, 380, 0.55, 0.8, 0.6, 1, 150, 2);
  }
}

// ======================================================================= the Proprietor
export class ProprietorRig extends Rig {
  man = this.node();
  hat: THREE.Group;
  armR: THREE.Group;
  armL: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  eyesGlow: THREE.Mesh;
  cracks: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    super(scene);
    const m = new ModelBuilder();
    for (const s of [-1, 1]) {
      m.add(cyl(4.6, 4, 58, 8), { col: stripes(12, 0x3b2140, PAL.ink, 0, 0.15), pos: [s * 8, 31, 0], surf: SURF.cloth });
      shoe(m, [s * 8, 0, -3], 17, PAL.ink, PART.BODY, [0, 0, 0], 0.1);
    }
    m.add(lathe([[0, 58], [14, 59], [15, 74], [16, 94], [14, 102], [7, 108], [0, 109]], 14, 10), { col: weather(0x4a2458, 0.3, 0.06), scale: [1, 1, 0.76], surf: SURF.velvet });
    for (const s of [-1, 1]) m.add(extrude([[-2, 0], [7, -2], [9, -40], [3, -50], [-3, -42], [-4, -8]], 2, 0.4, 6, 1), { col: weather(0x2a1234, 0.3), pos: [s * 5, 70, -9], rot: [0.15, 0, s * 0.08], part: PART.SWAY, pivot: [s * 5, 70, -9], surf: SURF.velvet });
    m.add(box(9, 30, 1), { col: PAL.cream, pos: [0, 90, 11.6], surf: SURF.cloth });
    for (let i = 0; i < 4; i++) m.add(sphere(1.4, 6, 4), { col: PAL.gold, pos: [5, 78 + i * 7, 11.8], surf: SURF.gold });
    m.add(extrude(starShape(3, 6, 2), 1.5, 0.2, 2), { col: PAL.blood, pos: [0, 104, 11.6], surf: SURF.velvet });
    this.mesh(m.build({ ao: 0.25 }), this.man);
    this.head = this.node(this.man, 0, 110, 0);
    const hm = new ModelBuilder();
    hm.add(ellipsoid(11, 14, 11, 14, 10), { col: weather(0xeee4d4, 0.12), pos: [0, 12, 0], surf: SURF.porcelain });
    for (const s of [-1, 1]) hm.add(tube([[s * 2, 14, 10.6], [s * 7, 15.5, 10], [s * 10, 18, 7]], 0.9, 4, 8), { col: PAL.ink, surf: SURF.paint });
    // the grin's upper lip and teeth (the jaw below opens)
    hm.add(tube([[-10, 7, 8], [-5, 5, 10.4], [5, 5, 10.4], [10, 7, 8]], 1.1, 5, 12), { col: PAL.blood, surf: SURF.latex });
    for (let i = 0; i < 8; i++) hm.add(box(1.8, 2.6, 1), { col: PAL.bone, pos: [-7 + i * 2, 3.8, 10.3 - Math.abs(i - 3.5) * 0.35], surf: SURF.bone });
    hm.add(tube([[-2, 22, 10], [0, 23, 10.6], [2, 22, 10]], 0.6, 4, 6), { col: PAL.ink, surf: SURF.paint });
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    this.jaw = this.node(this.head, 0, 4, 2);
    const jm = new ModelBuilder();
    jm.add(ellipsoid(10, 5, 8, 12, 6), { col: weather(0xeee4d4, 0.12), pos: [0, -3, 2], surf: SURF.porcelain });
    jm.add(ellipsoid(8, 3, 4, 10, 6), { col: 0x200808, pos: [0, -1, 6], surf: SURF.latex });
    for (let i = 0; i < 8; i++) jm.add(box(1.8, 2.4, 1), { col: PAL.bone, pos: [-7 + i * 2, 0.4, 8 - Math.abs(i - 3.5) * 0.35], surf: SURF.bone });
    this.mesh(jm.build({ ao: 0 }), this.jaw);
    const em = new ModelBuilder();
    for (const s of [-1, 1]) em.add(sphere(2.2, 8, 6), { col: PAL.hotRed, pos: [s * 4.4, 15, 10.2], surf: SURF.bulb, emit: 1 });
    this.eyesGlow = this.mesh(em.build({ ao: 0 }), this.head, false);
    const cr = new ModelBuilder();
    for (const [a, l] of [[0.4, 14], [-0.7, 12], [1.9, 10], [2.8, 12]] as [number, number][]) cr.add(box(0.8, l, 0.6), { col: PAL.ember, pos: [Math.sin(a) * 5, 14 + Math.cos(a) * 5, 10.8], rot: [0, 0, a], surf: SURF.bulb, emit: 1 });
    this.cracks = this.mesh(cr.build({ ao: 0 }), this.head, false);
    this.hat = this.node(this.man, 0, 134, 0);
    const hat = new ModelBuilder();
    tophat(hat, 0, 10, 26, PAL.ink, 0x9ec8ff, PART.BODY, undefined, 0);
    this.mesh(hat.build({ ao: 0 }), this.hat);
    const arm = (cane: boolean) => {
      const a = new ModelBuilder();
      a.add(cyl(3.6, 3.2, 46, 8), { col: weather(0x4a2458, 0.3), pos: [0, -23, 0], surf: SURF.velvet });
      glove(a, [0, -50, 2], 5, PART.BODY, [0, 0, 0], PAL.bone);
      if (cane) {
        a.add(cyl(1.4, 1.4, 74, 6), { col: PAL.ink, pos: [0, -74, 8], rot: [0.2, 0, 0], surf: SURF.paint });
        a.add(sphere(4.4, 10, 8), { col: 0xbcd2dc, pos: [0, -38, 2], surf: SURF.glass, emit: 0.4 });
      }
      return a.build({ ao: 0 });
    };
    this.armR = this.node(this.man, -15, 100, 0);
    this.mesh(arm(true), this.armR);
    this.armL = this.node(this.man, 15, 100, 0);
    this.mesh(arm(false), this.armL);
  }

  update(b: ProprietorBoss, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed && b.gone < 0.97;
    if (!this.group.visible) return;
    const P = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    this.group.position.set(x, 0, y);
    const toP = Math.atan2(g.player.x - x, g.player.y - y);
    this.group.rotation.y = lerp(this.group.rotation.y, toP, 1 - Math.exp(-dt * 6));
    const grin = clamp(P.grin ?? 0, 0, 1);
    const s = 1.6 + grin * 0.3;
    // he sinks into his own smoke as he vanishes
    this.man.scale.set(s * (1 - b.gone * 0.3), s * (1 - b.gone * 0.85), s * (1 - b.gone * 0.3));
    this.man.rotation.x = (P.bow ?? 0) * 0.6;
    this.hat.position.y = 134 + (P.hat ?? 0) * 24;
    this.hat.rotation.z = (P.hat ?? 0) * 0.5;
    this.armR.rotation.x = -(P.cane ?? 0) * 1.4;
    this.armL.rotation.x = -(P.cane ?? 0) * 0.6 - (P.laugh ?? 0) * 0.8;
    this.armL.rotation.z = (P.laugh ?? 0) * 0.9;
    this.head.rotation.z = (P.laugh ?? 0) * Math.sin(t * 24) * 0.15;
    this.head.scale.set(1 + grin * 0.35, 1 + grin * 0.2, 1 + grin * 0.2);
    this.jaw.rotation.x = grin * 0.25 + (P.chomp ?? 0) * 0.9 + (P.laugh ?? 0) * Math.abs(Math.sin(t * 18)) * 0.5;
    this.eyesGlow.visible = grin > 0.5 || b.windup > 0.3;
    this.cracks.visible = (P.crack ?? 0) > 0.1;
    this.state(b, t, [1, 1, 1, 1], grin > 0.5 ? [1, 0.3, 0.2, 0.8] : [1, 0.8, 0.6, 0.5]);
    if (b.awake && !b.dead) pool.add(x, y, 460, 0.65, 1, lerp(0.8, 0.35, grin), lerp(0.6, 0.25, grin), 160, 3);
  }
}

// ======================================================================= the Unreflected
function unreflectedModel(): { body: THREE.BufferGeometry; masks: THREE.BufferGeometry } {
  const m = new ModelBuilder();
  // a tall figure of faceted glass with a blank mirror for a face
  const glass = 0xcfe8f0;
  for (const s of [-1, 1]) {
    m.add(tube([[s * 9, 64, 0], [s * 12, 30, 4], [s * 10, 2, 2]], (u) => 6 - u * 2, 5, 6), { col: glass, surf: SURF.glass, emit: 0.1, flat: true });
  }
  m.add(lathe([[0, 60], [18, 62], [22, 86], [24, 112], [16, 126], [0, 128]], 7, 0), { col: glass, scale: [1, 1, 0.75], surf: SURF.glass, emit: 0.1, flat: true });
  m.add(ellipsoid(14, 18, 13, 8, 6), { col: 0xe8f4f8, pos: [0, 146, 0], surf: SURF.glass, emit: 0.2, flat: true });
  for (const s of [-1, 1]) m.add(tube([[s * 22, 120, 0], [s * 34, 92, 8], [s * 40, 62, 14]], (u) => 5 - u * 2.6, 5, 8), { col: glass, surf: SURF.glass, emit: 0.1, flat: true });
  for (let i = 0; i < 6; i++) m.add(cone(3, 18 + (i % 3) * 8, 4), { col: 0xffffff, pos: [(i - 2.5) * 6, 162 + (i % 2) * 4, -4], rot: [-0.3, 0, (i - 2.5) * 0.2], surf: SURF.glass, emit: 0.3, flat: true });
  // the cloak of faces: a ring of masks, every one a different stolen expression
  const k = new ModelBuilder();
  const cols = [0xd8c8b0, 0xe2b8a8, 0xc8d0e0, 0xe8dcc0, 0xb8a090, 0xf0e4d8];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const px = Math.cos(a) * 46, pz = Math.sin(a) * 46, py = 70 + (i % 3) * 22;
    const rotY = -a + Math.PI / 2;
    k.add(ellipsoid(9, 11, 3.5, 10, 8), { col: cols[i % cols.length], pos: [px, py, pz], rot: [0, rotY, 0], surf: SURF.porcelain });
    for (const s of [-1, 1]) {
      const ex = px + Math.cos(a) * 3 - Math.sin(a) * s * 3.4, ez = pz + Math.sin(a) * 3 + Math.cos(a) * s * 3.4;
      k.add(sphere(1.6, 6, 4), { col: 0x081014, pos: [ex, py + 2, ez], surf: SURF.paint });
    }
    k.add(sphere(1.4, 6, 4), { col: i % 2 ? PAL.blood : 0x081014, pos: [px + Math.cos(a) * 3.2, py - 5, pz + Math.sin(a) * 3.2], scale: [i % 3 ? 2.4 : 1, 1, 1], surf: SURF.paint });
  }
  return { body: m.build({ ao: 0.15 }), masks: k.build({ ao: 0 }) };
}

export class UnreflectedRig extends Rig {
  real = this.node();
  echo = this.node();
  private ringR: THREE.Group;
  private ringE: THREE.Group;
  private fadeMat = actorMaterial({ emitBoost: 3, matte: true, transparent: true, opacity: 1 });
  private echoMat = actorMaterial({ emitBoost: 3, matte: true, transparent: true, opacity: 0.3 });

  constructor(scene: THREE.Scene) {
    super(scene);
    const m = unreflectedModel();
    const body = this.mesh(m.body, this.real);
    body.material = this.fadeMat;
    this.ringR = this.node(this.real);
    this.mesh(m.masks, this.ringR).material = this.fadeMat;
    const eb = this.mesh(m.body, this.echo, false);
    eb.material = this.echoMat;
    this.ringE = this.node(this.echo);
    this.mesh(m.masks, this.ringE, false).material = this.echoMat;
  }

  update(b: UnreflectedBoss, g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (b.removed) return;
    const P = b.pose;
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    const rise = clamp(P.rise ?? 0, 0, 1);
    this.real.position.set(x, -rise * 200 + Math.sin(t * 1.6) * 5, y);
    const toP = Math.atan2(g.player.x - x, g.player.y - y);
    this.real.rotation.y = lerp(this.real.rotation.y, toP, 1 - Math.exp(-dt * 5));
    this.real.scale.setScalar(1.7);
    this.ringR.rotation.y = (P.faces ?? 0) * 0.6;
    this.ringR.position.y = Math.sin(t * 2) * 4;
    // its reflection stands on the far side of the target, mirrored, faint
    this.echo.visible = b.awake && !b.dead && b.introDone;
    this.echo.position.set(b.mx, Math.sin(t * 1.6 + 1) * 5, b.my);
    this.echo.rotation.y = Math.atan2(g.player.x - b.mx, g.player.y - b.my);
    this.echo.scale.set(-1.7, 1.7, 1.7);
    this.ringE.rotation.y = -(P.faces ?? 0) * 0.6;
    const fade = clamp(b.fade, 0, 1);
    this.fadeMat.opacity = 1 - fade;
    // fading never hides it: the rim keeps an outline at any opacity
    setObjectState(this.fadeMat, t * 2, b.windup, Math.min(1, b.flash * 0.6 + (b.transitioning ? 0.5 : 0)), 1, [1, 1, 1, 1], [0.6, 1, 0.95, 0.7 + fade * 1.6 + b.windup]);
    setObjectState(this.echoMat, t * 2, 0, 0, 1, [0.7, 1, 0.95, 1], [0.6, 1, 0.95, 1]);
    this.echoMat.opacity = 0.22 + Math.sin(t * 5) * 0.06;
    if (b.awake && !b.dead) pool.add(x, y, 480, 0.7, 0.6, 1, 0.95, 170, 3);
  }
}

/** Glow tints the shared boss light uses for these five. */
export function funhouseGlow(id: string): [number, number, number] | null {
  switch (id) {
    case 'crooked_twins': return [1, 0.75, 0.45];
    case 'looking_glass': return [0.6, 0.85, 1];
    case 'stringmistress': return [0.8, 0.6, 1];
    case 'proprietor': return [1, 0.4, 0.3];
    case 'unreflected': return [0.6, 1, 0.95];
  }
  return null;
}
