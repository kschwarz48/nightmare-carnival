// Boss rigs (D-38/D-39): articulated 3D models driven by each boss's sim pose, with boss-specific
// lighting states. Objects that the sim places "up" in the 2D plane (Ferris gondolas, Calliope pipe
// tips) are drawn on vertical structures shifted south by height·cot(elevation), so what you see
// fire is exactly where the sim spawns it.

import { patch } from './models/arch';
import * as THREE from 'three';
import { clamp, lerp } from '../core/math';
import type { Game } from '../sim/game';
import type { BossBase } from '../sim/bosses/boss';
import type { Hazard } from '../sim/entities';
import type { TentBoss } from '../sim/bosses/tent';
import type { FerrisBoss } from '../sim/bosses/ferris';
import type { PuppetBoss } from '../sim/bosses/puppet';
import type { RingmasterBoss } from '../sim/bosses/ringmaster';
import type { CalliopeBoss } from '../sim/bosses/calliope';
import { FERRIS_HOME } from '../sim/bosses/ferris';
import { LAST_SONG } from '../data/quests';
import { ModelBuilder, PART, SURF, box, cone, cyl, ellipsoid, extrude, lathe, rbox, smoothShape, sphere, starShape, torus, tube, weather, stripes, type V3 } from './core/geo';
import { actorDepthMaterial, actorMaterial, pool, setObjectState } from './core/materials';
import { PAL, bulb, eyes, glove, limb, ruff, shoe, tophat } from './models/kit';
import type { GameRenderer3D } from './renderer3d';
import { COT_EL as COT } from './core/view';

abstract class Rig {
  group = new THREE.Group();
  mat = actorMaterial({ emitBoost: 3, matte: true, detail: true });
  depth = actorDepthMaterial(this.mat);
  constructor(scene: THREE.Scene) {
    this.group.visible = false;
    scene.add(this.group);
  }
  mesh(geo: THREE.BufferGeometry, parent: THREE.Object3D = this.group, shadow = true): THREE.Mesh {
    const m = new THREE.Mesh(geo, this.mat);
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.customDepthMaterial = this.depth;
    m.frustumCulled = false;
    parent.add(m);
    return m;
  }
  node(parent: THREE.Object3D = this.group, x = 0, y = 0, z = 0): THREE.Group {
    const n = new THREE.Group();
    n.position.set(x, y, z);
    parent.add(n);
    return n;
  }
  state(b: BossBase, time: number, tint: [number, number, number, number] = [1, 1, 1, 1], rim: [number, number, number, number] = [0.9, 0.5, 0.3, 0.5]): void {
    const fl = b.flash * 0.6 + (b.transitioning ? 0.35 + 0.35 * Math.sin(time * 30) : 0);
    setObjectState(this.mat, time * 2, b.windup, Math.min(1, fl), 1, tint, b.windup > 0.05 ? [1, 0.3, 0.12, 0.8 + b.windup * 1.5] : rim);
  }
}

// ======================================================================= the Carnival Tent
class TentRig extends Rig {
  body = this.node();
  legs: THREE.Group[] = [];
  jawTop: THREE.Group;
  jawBot: THREE.Group;
  eyesM: THREE.Mesh;
  mawGlow: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    super(scene);
    const m = new ModelBuilder();
    // canvas walls and roof, one panel per stripe (crisp seams), sagging between the poles
    const N = 20, prof: [number, number][] = [[162, 109], [110, 170], [40, 238], [8, 262], [0, 264]];
    const at = (v: number): [number, number] => {
      const f = v * (prof.length - 1), i = Math.min(prof.length - 2, Math.floor(f)), t = f - i;
      return [prof[i][0] + (prof[i + 1][0] - prof[i][0]) * t, prof[i][1] + (prof[i + 1][1] - prof[i][1]) * t];
    };
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
      const col = weather(k % 2 ? PAL.red : PAL.cream, 0.55, 0.05);
      m.add(patch((u, v) => {
        const a = a1 - (a1 - a0) * u;
        const r = 156 - 6 * v - 2.6 * Math.sin(Math.PI * u);
        return [Math.cos(a) * r, 110 * v, Math.sin(a) * r];
      }, 4, 4), { col, surf: SURF.canvas });
      m.add(patch((u, v) => {
        const a = a1 - (a1 - a0) * u;
        const [r0, y0] = at(v);
        const sag = 5 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.3));
        return [Math.cos(a) * (r0 - sag * 0.4), y0 - sag, Math.sin(a) * (r0 - sag * 0.4)];
      }, 4, 8), { col, surf: SURF.canvas });
      // a rope seam over each pole line
      const pts: V3[] = [];
      for (let i = 0; i <= 8; i++) { const [r0, y0] = at(i / 8); pts.push([Math.cos(a0) * (r0 + 0.8), y0 + 0.8, Math.sin(a0) * (r0 + 0.8)]); }
      m.add(tube(pts, 0.8, 4, 16), { col: weather(PAL.straw, 0.5), surf: SURF.cloth });
    }
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      m.add(sphere(12, 6, 4), { col: weather(i % 2 ? PAL.red : PAL.cream, 0.4), pos: [Math.cos(a) * 162, 104, Math.sin(a) * 162], scale: [1.1, 1.3, 0.35], rot: [0, -a + Math.PI / 2, 0], surf: SURF.canvas });
    }
    // patches and rents in the canvas
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.4;
      m.add(rbox(26, 20, 2, 2, 1), { col: weather([PAL.mustard, PAL.canvasDark, PAL.denim][i % 3], 0.5), pos: [Math.cos(a) * 154, 40 + (i % 3) * 22, Math.sin(a) * 154], rot: [0, -a + Math.PI / 2, (i % 2 ? 0.2 : -0.15)], surf: SURF.canvas });
    }
    m.add(cyl(3, 3, 60, 6), { col: PAL.woodDark, pos: [0, 290, 0], surf: SURF.wood });
    m.add(sphere(6, 8, 6), { col: PAL.gold, pos: [0, 322, 0], surf: SURF.gold });
    m.add(extrude([[0, 0], [50, -9], [0, -20]], 1, 0, 1), { col: weather(PAL.blood, 0.4), pos: [2, 316, 0], part: PART.SWAY, pivot: [0, 316, 0], surf: SURF.canvas });
    // valance bulbs
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      bulb(m, [Math.cos(a) * 166, 116, Math.sin(a) * 166], 2.4, i % 2 ? PAL.amber : PAL.hotRed);
    }
    this.mesh(m.build({ ao: 0.3 }), this.body);
    // entrance maw: dark throat, toothed flaps
    const throat = new ModelBuilder().add(ellipsoid(62, 58, 10, 18, 12), { col: PAL.ink, pos: [0, 0, 0], surf: SURF.cloth }).build({ ao: 0 });
    const th = this.mesh(throat, this.body, false);
    th.position.set(0, 56, 152);
    const glow = new ModelBuilder().add(ellipsoid(44, 40, 4, 16, 10), { col: PAL.ember, emit: 1, surf: SURF.bulb }).build({ ao: 0 });
    this.mawGlow = this.mesh(glow, this.body, false);
    this.mawGlow.position.set(0, 52, 150);
    const teeth = (down: boolean) => {
      const t = new ModelBuilder();
      t.add(rbox(130, 14, 10, 4, 1), { col: weather(PAL.red, 0.5), surf: SURF.canvas });
      for (let i = 0; i < 9; i++) t.add(cone(5.5, 22, 5), { col: PAL.bone, pos: [-56 + i * 14, down ? 14 : -14, 6], rot: [down ? 0 : Math.PI, 0, 0], surf: SURF.bone });
      return t.build({ ao: 0 });
    };
    this.jawTop = this.node(this.body, 0, 98, 154);
    this.mesh(teeth(false), this.jawTop);
    this.jawBot = this.node(this.body, 0, 16, 154);
    this.mesh(teeth(true), this.jawBot);
    const em = new ModelBuilder();
    for (const s of [-1, 1]) {
      em.add(torus(17, 4, 6, 16), { col: PAL.brass, pos: [s * 58, 150, 0], surf: SURF.brass });
      em.add(cyl(15, 15, 3, 16), { col: PAL.sickYellow, pos: [s * 58, 150, 0], rot: [Math.PI / 2, 0, 0], emit: 1, surf: SURF.glass });
      em.add(ellipsoid(4, 10, 2, 8, 6), { col: PAL.ink, pos: [s * 58, 150, 2.4], surf: SURF.glass });
    }
    this.eyesM = this.mesh(em.build({ ao: 0 }), this.body, false);
    this.eyesM.position.set(0, 0, 118);
    this.eyesM.rotation.x = -0.45;
    // four tent-pole legs (hidden while it sleeps)
    const legGeo = new ModelBuilder();
    legGeo.add(cyl(6, 7, 150, 8), { col: weather(PAL.woodPale, 0.4), pos: [0, -75, 0], surf: SURF.wood });
    legGeo.add(sphere(10, 8, 6), { col: PAL.iron, surf: SURF.iron });
    legGeo.add(cone(9, 22, 6), { col: PAL.iron, pos: [0, -160, 0], rot: [Math.PI, 0, 0], surf: SURF.iron });
    legGeo.add(tube([[0, -10, 0], [20, 40, 0], [10, 90, 0]], 1.2, 4, 8), { col: PAL.straw, surf: SURF.cloth });
    const lg = legGeo.build({ ao: 0 });
    for (const [x, z] of [[-110, -80], [110, -80], [-110, 80], [110, 80]]) {
      const n = this.node(this.body, x, 30, z);
      this.mesh(lg, n);
      n.rotation.z = x < 0 ? -0.35 : 0.35;
      n.rotation.x = z < 0 ? 0.25 : -0.25;
      this.legs.push(n);
    }
  }

  update(b: TentBoss, g: Game, r: GameRenderer3D, x: number, y: number, dt: number): void {
    const t = r.time;
    const P = b.pose;
    this.group.visible = !b.removed;
    if (b.removed) return;
    const awake = b.awake;
    const collapse = P.collapse ?? 0;
    const lift = awake && !b.dead ? 70 + Math.sin(t * 3) * 5 : b.dead ? 70 * (1 - Math.min(1, b.deathT / 2.4)) : 0;
    const breathe = 1 + Math.sin(t * (awake ? 2.4 : 0.8)) * (awake ? 0.025 : 0.01);
    this.group.position.set(x, 0, y);
    this.body.position.y = lift;
    this.body.scale.set(breathe * (1 + collapse * 0.15), breathe * (1 - collapse * 0.55), breathe * (1 + collapse * 0.15));
    this.body.rotation.z = Math.sin(t * 1.7) * 0.015 * (awake ? 1 : 0);
    for (let i = 0; i < 4; i++) {
      const L = this.legs[i];
      L.visible = lift > 4;
      const raise = P.leg === i ? (P.legT ?? 0) * 0.6 : 0;
      L.scale.y = clamp((lift + 40) / 110, 0.2, 1.3);
      L.rotation.x = (i < 2 ? 0.25 : -0.25) + Math.sin(t * 4 + i * 1.6) * 0.08 - raise * (i < 2 ? -1 : 1);
    }
    const maw = b.dead ? 0 : P.maw ?? 0;
    this.jawTop.rotation.x = -maw * 0.6;
    this.jawBot.rotation.x = maw * 0.5;
    this.jawTop.position.y = 98 + maw * 16;
    const hot = b.windup > 0 && b.attackName === 'exhale' ? b.windup : (P.fire ?? 0) > 0 ? 0.8 : 0;
    this.mawGlow.visible = awake && (maw > 0.1 || hot > 0);
    this.mawGlow.scale.setScalar(0.4 + maw * 0.6 + hot * 0.3);
    const angry = b.phase >= 1 || b.windup > 0;
    this.eyesM.visible = true;
    const fire = (P.fire ?? 0) > 0 && !b.dead;
    this.state(b, t, fire ? [1.25, 0.8, 0.65, 1] : [1, 1, 1, awake ? (angry ? 1.4 : 1) : 0.18], awake ? [1, 0.45, 0.25, 0.5] : [0, 0, 0, 0]);
    // lighting state: a furnace glow from the maw; the canopy bulbs only burn once it wakes
    if (awake && !b.dead) {
      pool.add(x, y + 160, 380, 0.6 + maw * 1.2 + hot * 1.5, 1, 0.45, 0.18, 70, 3);
      if (fire && Math.random() < 0.6) r.fx.handle([{ type: 'spark', x: x + (Math.random() - 0.5) * 260, y: y + (Math.random() - 0.5) * 200, a: 1, b: 0, c: 0, style: 'fire' }]);
    }
    void g;
    void dt;
  }
}

// ======================================================================= the Ferris Wheel
class FerrisRig extends Rig {
  stand = this.node();
  wheel = this.node();
  spinNode: THREE.Group;
  gondolas: THREE.Group[] = [];
  rimBulbs: THREE.Mesh;

  constructor(scene: THREE.Scene, n: number) {
    super(scene);
    const R = 132;
    // the A-frame stand (stays home all night)
    const st = new ModelBuilder();
    for (const zs of [-1, 1]) for (const xs of [-1, 1]) {
      st.add(tube([[xs * 110, 0, zs * 26], [xs * 30, 120, zs * 22], [0, 182, zs * 20]], 4.5, 6, 8), { col: weather(PAL.iron, 0.45), surf: SURF.iron });
    }
    for (const zs of [-1, 1]) st.add(box(230, 6, 6), { col: weather(PAL.iron, 0.45), pos: [0, 50, zs * 25], surf: SURF.iron });
    st.add(cyl(6, 6, 54, 10), { col: PAL.iron, pos: [0, 182, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    this.mesh(st.build({ ao: 0.3 }), this.stand);
    // wheel: double rim, spokes, hub, bulbs (emissive driven by pose.lights)
    this.spinNode = this.node(this.wheel);
    const w = new ModelBuilder();
    for (const z of [-14, 14]) {
      w.add(torus(R + 6, 3.4, 6, 48), { col: weather(PAL.redDeep, 0.45, 0.04, PAL.iron), pos: [0, 0, z], surf: SURF.iron });
      w.add(torus(R - 30, 2.2, 6, 40), { col: weather(PAL.redDeep, 0.45, 0.04, PAL.iron), pos: [0, 0, z], surf: SURF.iron });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        w.add(cyl(1.6, 1.6, R + 4, 4), { col: PAL.iron, pos: [Math.cos(a) * (R + 4) / 2, Math.sin(a) * (R + 4) / 2, z], rot: [0, 0, a - Math.PI / 2], surf: SURF.iron });
      }
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      w.add(cyl(1.6, 1.6, 28, 4), { col: PAL.iron, pos: [Math.cos(a) * (R + 6), Math.sin(a) * (R + 6), 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
    }
    w.add(cyl(22, 22, 40, 16), { col: weather(PAL.mustard, 0.45), rot: [Math.PI / 2, 0, 0], surf: SURF.paint });
    w.add(extrude(starShape(8, 20, 9), 4, 0.6, 1), { col: PAL.gold, pos: [0, 0, 22], surf: SURF.gold });
    eyes(w, { x: 8, y: 2, z: 24, r: 4, color: PAL.hotRed, glow: 1, part: PART.BODY });
    this.mesh(w.build({ ao: 0 }), this.spinNode);
    const bl = new ModelBuilder();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      bl.add(sphere(3, 6, 4), { col: i % 2 ? PAL.hotRed : PAL.amber, pos: [Math.cos(a) * (R + 10), Math.sin(a) * (R + 10), 16], emit: 1, surf: SURF.bulb });
    }
    this.rimBulbs = this.mesh(bl.build({ ao: 0 }), this.spinNode, false);
    // gondolas: swinging cabins with dead passengers' silhouettes
    const gm = new ModelBuilder();
    gm.add(cyl(1.4, 1.4, 22, 5), { col: PAL.iron, pos: [0, -11, 0], surf: SURF.iron });
    gm.add(lathe([[0, 0], [16, 1], [20, 12], [18, 26], [0, 26]], 12), { col: weather(PAL.teal, 0.5, 0.06, PAL.iron), pos: [0, -52, 0], surf: SURF.paint });
    gm.add(lathe([[0, 0], [22, 0], [24, 3], [0, 6]], 12), { col: weather(PAL.mustard, 0.45), pos: [0, -24, 0], surf: SURF.paint });
    gm.add(sphere(6, 8, 6), { col: PAL.ink, pos: [0, -24, 0], surf: SURF.cloth });
    gm.add(sphere(2.6, 6, 4), { col: PAL.sickYellow, pos: [3, -22, 5], emit: 1, surf: SURF.glass });
    const gGeo = gm.build({ ao: 0.2 });
    for (let i = 0; i < n; i++) {
      const gn = this.node(this.wheel);
      this.mesh(gGeo, gn);
      this.gondolas.push(gn);
    }
  }

  update(b: FerrisBoss, g: Game, r: GameRenderer3D, x: number, y: number, dt: number): void {
    const t = r.time;
    const P = b.pose;
    this.group.visible = true;
    const home = !b.awake || (P.free ?? 0) < 0.5;
    const H = home ? 182 : 140;
    const shift = H * COT;
    // the stand never moves; it sits under the wheel's home spot (shifted like the wheel)
    this.stand.position.set(FERRIS_HOME.x, 0, FERRIS_HOME.y + 182 * COT);
    this.stand.visible = true;
    if (b.removed) {
      this.wheel.visible = false;
      return;
    }
    this.wheel.visible = true;
    const cx = home ? FERRIS_HOME.x : x, cy = home ? FERRIS_HOME.y : y;
    const wob = (P.wobble ?? 0) * Math.sin(t * 9) * 0.06;
    this.wheel.position.set(cx, H, cy + shift);
    this.wheel.rotation.z = wob;
    this.spinNode.rotation.z = -b.spin;
    for (let i = 0; i < this.gondolas.length; i++) {
      const gp = b.gondolaPos(i);
      const gx = home ? gp.x - x + cx : gp.x, gy = home ? gp.y - y + cy : gp.y;
      // sim ground offset (dx, dy) → wheel-plane offset (dx, −dy) on the vertical wheel
      const gn = this.gondolas[i];
      gn.position.set(gx - cx, -(gy - cy), 0);
      gn.rotation.z = Math.sin(t * 2 + i) * 0.12 - wob;
      const open = b.awake && (b.attackName === 'spiral' || b.windup > 0);
      gn.scale.y = open ? 1.08 : 1;
    }
    const lights = b.awake && (P.lights ?? 0) > 0.5;
    const glow = (P.rimGlow ?? 0) * (0.5 + 0.5 * Math.sin(t * 20));
    this.state(b, t, [1, 1, 1, lights ? 1 + glow : 0.12], b.awake ? [1, 0.3, 0.3, 0.5] : [0, 0, 0, 0]);
    if (b.awake && !b.dead) pool.add(cx, cy, 520, (lights ? 1.1 : 0.4) + glow, 1, 0.3, 0.25, 160, 3);
    void g;
    void dt;
  }
}

// ======================================================================= the Puppet King
class PuppetRig extends Rig {
  body = this.node();
  head: THREE.Group;
  crown: THREE.Mesh;
  arms: THREE.Group[] = [];
  forearms: THREE.Group[] = [];
  legs: THREE.Group[] = [];
  strings: THREE.Mesh[] = [];
  cuttable: THREE.Mesh[] = [];
  crossbar: THREE.Group;
  private stringMat = new THREE.MeshBasicMaterial({ color: 0xd8d0c0 });
  private cordMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.4).multiplyScalar(2.5) });

  constructor(scene: THREE.Scene) {
    super(scene);
    const wood = weather(PAL.woodPale, 0.4, 0.06);
    const robe = new ModelBuilder();
    robe.add(lathe([[0, 0], [52, 0], [46, 40], [34, 90], [30, 120], [0, 124]], 18, 12), { col: weather(PAL.velvet, 0.45, 0.06), surf: SURF.velvet });
    robe.add(cyl(53, 53, 6, 18, true), { col: PAL.gold, pos: [0, 3, 0], surf: SURF.gold });
    for (let i = 0; i < 5; i++) robe.add(sphere(3.4, 6, 4), { col: PAL.gold, pos: [0, 30 + i * 18, 40 - i * 2.5], surf: SURF.gold });
    robe.add(lathe([[0, 100], [44, 104], [48, 116], [20, 128], [0, 128]], 18), { col: weather(PAL.bone, 0.3, 0.2), surf: SURF.plush });
    for (let i = 0; i < 9; i++) robe.add(sphere(3, 5, 4), { col: PAL.ink, pos: [Math.cos(i * 0.7) * 42, 112, Math.sin(i * 0.7) * 42], surf: SURF.plush });
    this.mesh(robe.build({ ao: 0.3 }), this.body);
    // head: carved wood, painted cheeks, cracked smile, the crown
    this.head = this.node(this.body, 0, 128, 0);
    const hm = new ModelBuilder();
    hm.add(sphere(30, 16, 12), { col: wood, pos: [0, 30, 0], surf: SURF.wood });
    hm.add(ellipsoid(22, 10, 14, 12, 8), { col: wood, pos: [0, 10, 12], surf: SURF.wood });
    for (const s of [-1, 1]) hm.add(cyl(6, 6, 1, 12), { col: 0x9a4a40, pos: [s * 16, 24, 25], rot: [Math.PI / 2, 0, s * 0.6], surf: SURF.paint });
    eyes(hm, { x: 11, y: 36, z: 24, r: 5, sclera: PAL.bone, color: PAL.violet, glow: 1, part: PART.BODY });
    hm.add(tube([[-14, 10, 22], [-6, 6, 25], [6, 6, 25], [14, 10, 22]], 1.6, 5, 10), { col: PAL.ink, surf: SURF.paint });
    hm.add(ellipsoid(4, 16, 2, 6, 6), { col: PAL.ink, pos: [9, 18, 27], rot: [0, 0, 0.3], surf: SURF.paint });
    this.mesh(hm.build({ ao: 0.2 }), this.head);
    const cr = new ModelBuilder();
    cr.add(cyl(22, 20, 16, 14, true), { col: PAL.gold, pos: [0, 66, 0], surf: SURF.gold });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      cr.add(cone(5, 16, 5), { col: PAL.gold, pos: [Math.cos(a) * 21, 80, Math.sin(a) * 21], surf: SURF.gold });
      cr.add(sphere(2.6, 6, 4), { col: [PAL.hotRed, PAL.ghost, PAL.violet][i % 3], pos: [Math.cos(a) * 21.5, 66, Math.sin(a) * 21.5], emit: 1, surf: SURF.glass });
    }
    this.crown = this.mesh(cr.build({ ao: 0 }), this.head);
    // jointed arms: shoulder → elbow → gloved hand
    const upper = new ModelBuilder().add(sphere(10, 8, 6), { col: wood, surf: SURF.wood }).add(cyl(7, 6, 48, 8), { col: weather(PAL.velvet, 0.4), pos: [0, -26, 0], surf: SURF.velvet }).build({ ao: 0 });
    const lower = new ModelBuilder().add(sphere(7, 8, 6), { col: wood, surf: SURF.wood }).add(cyl(5.4, 5, 44, 8), { col: wood, pos: [0, -24, 0], surf: SURF.wood }).build({ ao: 0 });
    const hand = new ModelBuilder();
    glove(hand, [0, -50, 0], 9, PART.BODY, [0, 0, 0], PAL.bone);
    const handGeo = hand.build({ ao: 0 });
    for (const s of [-1, 1]) {
      const sh = this.node(this.body, s * 50, 112, 0);
      this.mesh(upper, sh);
      const el = this.node(sh, 0, -52, 0);
      this.mesh(lower, el);
      this.mesh(handGeo, el);
      this.arms.push(sh);
      this.forearms.push(el);
      const leg = this.node(this.body, s * 22, 4, 0);
      const lm = new ModelBuilder();
      lm.add(cyl(7, 6, 60, 8), { col: wood, pos: [0, -30, 0], surf: SURF.wood });
      lm.add(sphere(8, 8, 6), { col: wood, pos: [0, -62, 0], surf: SURF.wood });
      shoe(lm, [0, -96, -6], 26, PAL.ink, PART.BODY, [0, 0, 0], 0.4);
      this.mesh(lm.build({ ao: 0 }), leg);
      this.legs.push(leg);
    }
    // the strings, vanishing into the flies
    const sg = new THREE.CylinderGeometry(0.6, 0.6, 1, 4);
    sg.translate(0, 0.5, 0);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(sg, this.stringMat);
      s.frustumCulled = false;
      this.group.add(s);
      this.strings.push(s);
    }
    const cg = new THREE.CylinderGeometry(2.6, 2.6, 1, 6);
    cg.translate(0, 0.5, 0);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(cg, this.cordMat);
      s.frustumCulled = false;
      this.group.add(s);
      this.cuttable.push(s);
    }
    this.crossbar = this.node(this.group);
    const cb = new ModelBuilder();
    cb.add(box(220, 10, 10), { col: weather(PAL.woodDark, 0.4), surf: SURF.wood });
    cb.add(box(10, 10, 120), { col: weather(PAL.woodDark, 0.4), surf: SURF.wood });
    this.mesh(cb.build({ ao: 0 }), this.crossbar, false);
  }

  private aim(s: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
    s.position.copy(a);
    const d = b.clone().sub(a);
    s.scale.set(1, d.length(), 1);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }

  update(b: PuppetBoss, g: Game, r: GameRenderer3D, x: number, y: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed && b.descend < 0.98;
    if (!this.group.visible) return;
    const up = b.descend * 700;
    const hover = b.free ? 0 : 50 + Math.sin(t * 2) * 10;
    const stag = b.staggerT > 0;
    const dance = b.pose.dance ?? 0;
    this.group.position.set(0, 0, 0);
    this.body.position.set(x, hover + up - (stag ? 40 : 0), y);
    const toP = Math.atan2(g.player.x - x, g.player.y - y);
    this.body.rotation.set(stag ? 0.3 : Math.sin(dance) * 0.06, toP * 0.4, Math.sin(dance * 0.5) * 0.08);
    const flail = (b.pose.flail ?? 0) > 0;
    for (let k = 0; k < 2; k++) {
      const s = k === 0 ? -1 : 1;
      const raise = b.hands[k] ?? 0;
      this.arms[k].rotation.set(flail ? t * 14 * s : -raise * 2.2 + Math.sin(dance * 3 + k) * 0.4, 0, s * (0.35 + raise * 0.6));
      this.forearms[k].rotation.x = -0.4 - raise * 0.8;
      this.legs[k].rotation.x = b.free ? Math.sin(t * 12 + k * Math.PI) * 0.6 : Math.sin(dance * 2 + k * Math.PI) * 0.35;
    }
    this.head.rotation.set(stag ? 0.5 : Math.sin(dance * 1.5) * 0.12, 0, Math.sin(dance * 2) * 0.1);
    this.crown.visible = !((b.pose.crownGone ?? 0) > 0);
    // strings from the joints up to a crossbar hanging in the dark
    const barY = 760 + up;
    this.crossbar.position.set(x + Math.sin(t * 2) * 20, barY, y);
    this.crossbar.rotation.y = Math.sin(t * 2) * 0.15;
    const joints: THREE.Vector3[] = [];
    this.body.updateMatrixWorld(true);
    joints.push(new THREE.Vector3(0, 190, 0).applyMatrix4(this.body.matrixWorld));
    for (const a of this.forearms) joints.push(new THREE.Vector3(0, -50, 0).applyMatrix4(a.matrixWorld));
    for (const l of this.legs) joints.push(new THREE.Vector3(0, -62, 0).applyMatrix4(l.matrixWorld));
    for (let i = 0; i < this.strings.length; i++) {
      const s = this.strings[i];
      s.visible = !b.free;
      if (!s.visible) continue;
      const j = joints[i];
      this.aim(s, j, new THREE.Vector3(x + (j.x - x) * 1.4, barY, y + (j.z - y) * 1.2));
    }
    // phase-2 cuttable strings: glowing cords from their ground anchors
    for (let i = 0; i < this.cuttable.length; i++) {
      const s = b.strings[i];
      const m = this.cuttable[i];
      m.visible = !!s && !b.free && s.hp > 0;
      if (!m.visible) continue;
      const pulse = 0.75 + 0.25 * Math.sin(t * 10 + i);
      this.cordMat.color.setRGB(2.5 * pulse, 2.0 * pulse, 1.0 * pulse);
      this.aim(m, new THREE.Vector3(s.x, 30, s.y), new THREE.Vector3(x + (s.x - x) * 1.4, barY, y + (s.y - y) * 1.2));
      const hpT = s.maxHp > 0 ? s.hp / s.maxHp : 1;
      r.teleLine.ring(s.x, s.y, 18, 22, 1, 0.85, 0.3, 0.9, 0.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpT);
    }
    this.state(b, t, [1, 1, 1, 1], [0.75, 0.5, 1, 0.55]);
    // lighting state: a cold stage spotlight from the flies
    r.spot.color.setRGB(0.75, 0.65, 1);
    r.spot.intensity = b.awake && !b.dead ? 1.2e6 : 0;
    r.spot.position.set(x, 1100, y + 300);
    r.spot.target.position.set(x, 0, y);
    r.spot.target.updateMatrixWorld();
    void dt;
  }
}

// ======================================================================= the Ringmaster
class RingmasterRig extends Rig {
  human = this.node();
  demon = this.node();
  hat: THREE.Group;
  armR: THREE.Group;
  armL: THREE.Group;
  dArmR: THREE.Group;

  constructor(scene: THREE.Scene) {
    super(scene);
    // --- the showman: tall, gaunt, impeccable, wrong
    const hb = new ModelBuilder();
    for (const s of [-1, 1]) {
      hb.add(cyl(4.4, 4, 56, 8), { col: PAL.ink, pos: [s * 8, 30, 0], surf: SURF.cloth });
      shoe(hb, [s * 8, 0, -3], 16, PAL.ink, PART.BODY, [0, 0, 0], 0.05);
    }
    hb.add(lathe([[0, 56], [13, 57], [14, 72], [15, 92], [13, 100], [6, 106], [0, 107]], 14, 10), { col: weather(PAL.blood, 0.35, 0.08), scale: [1, 1, 0.75], surf: SURF.velvet });
    const tail = smoothShape([[-2, 0], [6, -2], [8, -34], [3, -44], [-3, -36], [-4, -8]], 24);
    for (const s of [-1, 1]) hb.add(extrude(tail, 2, 0.4, 6, 1), { col: weather(PAL.redDeep, 0.35), pos: [s * 5, 66, -9], rot: [0.15, 0, s * 0.08], part: PART.SWAY, pivot: [s * 5, 66, -9], surf: SURF.velvet });
    for (let i = 0; i < 5; i++) hb.add(rbox(12, 1.4, 1, 0.4, 1), { col: PAL.gold, pos: [0, 72 + i * 6, 10.4], surf: SURF.gold });
    ruff(hb, 104, 9, PAL.bone, PART.BODY, undefined, 12);
    hb.add(ellipsoid(10, 12, 10, 14, 10), { col: weather(PAL.skinPale, 0.25), pos: [0, 118, 0], surf: SURF.porcelain });
    eyes(hb, { x: 3.8, y: 120, z: 8.6, r: 1.8, sclera: PAL.bone, color: PAL.ink, part: PART.BODY });
    hb.add(tube([[-9, 114, 8], [-4, 112, 10], [0, 112.6, 10.4], [4, 112, 10], [9, 114, 8]], 1, 5, 12), { col: PAL.ink, surf: SURF.cloth });
    hb.add(tube([[-5, 108, 9.6], [0, 106.6, 10.4], [5, 108, 9.6]], 0.8, 4, 8), { col: PAL.blood, surf: SURF.latex });
    this.mesh(hb.build({ ao: 0.25 }), this.human);
    this.hat = this.node(this.human, 0, 126, 0);
    const hm = new ModelBuilder();
    tophat(hm, 0, 9, 22, PAL.ink, PAL.blood, PART.BODY, undefined, 0);
    this.mesh(hm.build({ ao: 0 }), this.hat);
    const arm = (s: number, cane: boolean) => {
      const a = new ModelBuilder();
      a.add(cyl(3.6, 3.2, 44, 8), { col: weather(PAL.blood, 0.35), pos: [0, -22, 0], surf: SURF.velvet });
      glove(a, [0, -48, 2], 5, PART.BODY, [0, 0, 0], PAL.bone);
      if (cane) {
        a.add(cyl(1.4, 1.4, 70, 6), { col: PAL.ink, pos: [0, -70, 8], rot: [0.2, 0, 0], surf: SURF.paint });
        a.add(sphere(4, 8, 6), { col: PAL.gold, pos: [0, -36, 2], surf: SURF.gold });
      } else {
        a.add(tube([[0, -50, 2], [10, -70, 20], [30, -76, 40], [50, -70, 60]], (t) => 1.6 - t, 4, 16), { col: PAL.leather, surf: SURF.rubber });
      }
      return a.build({ ao: 0 });
    };
    this.armR = this.node(this.human, -15, 98, 0);
    this.mesh(arm(-1, true), this.armR);
    this.armL = this.node(this.human, 15, 98, 0);
    this.mesh(arm(1, false), this.armL);
    // --- the demon beneath: horns, a coat of fire, burning eyes, claws
    const db = new ModelBuilder();
    for (const s of [-1, 1]) {
      db.add(tube([[s * 10, 64, 0], [s * 14, 32, 6], [s * 12, 4, 2]], (t) => 7 - t * 3, 7, 10), { col: weather(0x3a1410, 0.3), surf: SURF.skin });
      for (let k = 0; k < 3; k++) db.add(cone(1.6, 9, 5), { col: PAL.bone, pos: [s * 12 + (k - 1) * 3, 1, 9], rot: [Math.PI / 2, 0, 0], surf: SURF.bone });
    }
    db.add(lathe([[0, 56], [20, 58], [24, 80], [26, 104], [20, 114], [0, 116]], 16, 10), { col: weather(0x2a0e0c, 0.3), scale: [1, 1, 0.8], surf: SURF.skin });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      db.add(cone(6, 28 + (i % 3) * 8, 5), { col: PAL.ember, pos: [Math.cos(a) * 22, 70, Math.sin(a) * 18], rot: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5 + Math.PI], emit: 1, surf: SURF.bulb });
    }
    db.add(ellipsoid(13, 14, 12, 14, 10), { col: weather(0x3a1410, 0.3), pos: [0, 130, 2], surf: SURF.skin });
    eyes(db, { x: 5, y: 133, z: 11, r: 3, color: PAL.hotRed, glow: 1.4, part: PART.BODY, angle: 0.4 });
    db.add(ellipsoid(8, 3, 3, 10, 6), { col: PAL.ember, pos: [0, 123, 11], emit: 1, surf: SURF.bulb });
    for (const s of [-1, 1]) db.add(tube([[s * 9, 140, 0], [s * 22, 156, -4], [s * 26, 176, -12], [s * 20, 190, -16]], (t) => 4.6 - t * 4, 6, 12), { col: PAL.bone, surf: SURF.bone });
    this.mesh(db.build({ ao: 0.2 }), this.demon);
    this.dArmR = this.node(this.demon, -24, 106, 0);
    const da = new ModelBuilder();
    da.add(tube([[0, 0, 0], [-6, -30, 6], [-4, -56, 14]], (t) => 6 - t * 2, 7, 10), { col: weather(0x3a1410, 0.3), surf: SURF.skin });
    for (let k = 0; k < 4; k++) da.add(cone(1.6, 12, 5), { col: PAL.bone, pos: [-4 + (k - 1.5) * 3, -64, 18], rot: [0.6, 0, 0], surf: SURF.bone });
    da.add(tube([[-4, -56, 14], [10, -80, 40], [40, -90, 70], [70, -80, 96]], (t) => 2.4 - t * 1.6, 4, 16), { col: PAL.ember, emit: 1, surf: SURF.bulb });
    this.mesh(da.build({ ao: 0 }), this.dArmR);
    const dl = new ModelBuilder();
    dl.add(tube([[0, 0, 0], [6, -30, 6], [4, -56, 14]], (t) => 6 - t * 2, 7, 10), { col: weather(0x3a1410, 0.3), surf: SURF.skin });
    const dArmL = this.node(this.demon, 24, 106, 0);
    this.mesh(dl.build({ ao: 0 }), dArmL);
  }

  update(b: RingmasterBoss, g: Game, r: GameRenderer3D, x: number, y: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (b.removed) return;
    const P = b.pose;
    const d = clamp(b.demon, 0, 1);
    const k = d * d * (3 - 2 * d);
    this.group.position.set(x, 0, y);
    const toP = Math.atan2(g.player.x - x, g.player.y - y);
    this.group.rotation.y = lerp(this.group.rotation.y, toP, 1 - Math.exp(-dt * 6));
    this.human.visible = k < 0.98;
    this.demon.visible = k > 0.02;
    // he looms: the showman stands half again as tall as anyone; the demon taller still
    this.human.scale.setScalar(Math.max(0.001, 1 - k) * 1.5);
    this.demon.scale.setScalar(Math.max(0.001, k * 1.85));
    // showman poses: the bow, the hat flourish, the cane, the whip
    this.human.rotation.x = (P.bow ?? 0) * 0.7;
    this.hat.position.y = 126 + (P.hat ?? 0) * 26;
    this.hat.rotation.z = (P.hat ?? 0) * 0.5;
    this.armR.rotation.x = -(P.cane ?? 0) * 1.4 - (P.snap ?? 0) * 0.8;
    this.armL.rotation.x = -(P.whip ?? 0) * 1.8;
    this.armL.rotation.z = (P.whip ?? 0) * 0.8;
    this.dArmR.rotation.x = -(P.whip ?? 0) * 1.6 + Math.sin(t * 3) * 0.1;
    this.demon.position.y = Math.sin(t * 2) * 4;
    this.state(b, t, [1, 1, 1, 1], k > 0.5 ? [1, 0.35, 0.15, 0.9] : [1, 0.75, 0.5, 0.5]);
    // lighting state: the showman always has his spotlight; the demon turns the night red
    const spotOn = (P.spotlight ?? 0) > 0 || (b.awake && k < 0.5);
    r.spot.color.setRGB(1, 0.93, 0.8);
    r.spot.intensity = b.awake && !b.dead && spotOn ? 2.2e6 : 0;
    r.spot.position.set(x - 200, 1200, y + 400);
    r.spot.target.position.set(x, 0, y);
    r.spot.target.updateMatrixWorld();
    if (b.awake && !b.dead) {
      pool.add(x, y, 520, 0.7 + k * 1.2, lerp(1, 1, k), lerp(0.75, 0.3, k), lerp(0.5, 0.12, k), 160, 3);
      r.moonTint = k;
    }
  }
}

// ======================================================================= the Calliope
class CalliopeRig extends Rig {
  organ = this.node();
  bellows: THREE.Group;
  mouth: THREE.Group;
  pipeH: number[] = [];

  constructor(scene: THREE.Scene, pipes: number) {
    super(scene);
    const m = new ModelBuilder();
    const wood = weather(PAL.velvet, 0.45, 0.05, PAL.woodPale);
    // wagon chassis and spoked wheels
    m.add(rbox(300, 30, 120, 4, 2), { col: weather(PAL.woodDark, 0.4), pos: [0, 40, 0], surf: SURF.wood });
    for (const [wx, wz] of [[-110, 64], [110, 64], [-110, -64], [110, -64]]) {
      m.add(torus(34, 4, 6, 20), { col: weather(PAL.gold, 0.35), pos: [wx, 34, wz], surf: SURF.gold });
      for (let k = 0; k < 8; k++) m.add(cyl(1.6, 1.6, 64, 4), { col: weather(PAL.gold, 0.35), pos: [wx, 34, wz], rot: [0, 0, (k * Math.PI) / 8], surf: SURF.gold });
    }
    // carved organ case with brass filigree
    m.add(rbox(280, 120, 90, 6, 2), { col: wood, pos: [0, 115, -6], surf: SURF.wood });
    for (let i = 0; i < 7; i++) m.add(extrude(starShape(6, 9, 4), 1.4, 0.3, 1), { col: PAL.gold, pos: [-120 + i * 40, 160, 39.5], surf: SURF.gold });
    m.add(rbox(290, 10, 98, 3, 1), { col: PAL.gold, pos: [0, 178, -6], surf: SURF.gold });
    // the pipes: brass, tallest at the centre (tips line up with the sim's pipe tips)
    for (let i = 0; i < pipes; i++) {
      const tt = i / (pipes - 1) - 0.5;
      const h = 110 - Math.abs(tt) * 120;
      this.pipeH.push(h);
      m.add(cyl(9, 10, h, 12, false), { col: weather(PAL.brass, 0.3, 0.1), pos: [tt * 230, 183 + h / 2, -20], surf: SURF.brass });
      m.add(cone(10.5, 14, 12), { col: PAL.gold, pos: [tt * 230, 186 + h, -20], rot: [Math.PI, 0, 0], surf: SURF.gold });
      m.add(rbox(10, 6, 2, 1, 1), { col: PAL.ink, pos: [tt * 230, 196, -10.6], surf: SURF.iron });
    }
    // four soul-lamps on posts at the corners (the crescendo calls them)
    for (const [lx, lz, c] of [[-140, 46, PAL.ghost], [140, 46, PAL.ghost], [-140, -56, PAL.ghost], [140, -56, PAL.ghost]] as [number, number, number][]) {
      m.add(cyl(2.4, 2.4, 70, 6), { col: PAL.iron, pos: [lx, 210, lz], surf: SURF.iron });
      m.add(sphere(9, 10, 8), { col: c, pos: [lx, 250, lz], emit: 1, surf: SURF.glass });
    }
    this.mesh(m.build({ ao: 0.3 }), this.organ);
    // bellows (pump) and the porcelain theatre mask with a mouth
    this.bellows = this.node(this.organ, 0, 64, 46);
    const bl = new ModelBuilder();
    for (let i = 0; i < 6; i++) bl.add(rbox(120 - i * 4, 6, 14, 2, 1), { col: i % 2 ? weather(PAL.redDeep, 0.4) : PAL.leather, pos: [0, i * 7, 0], surf: SURF.canvas });
    this.mesh(bl.build({ ao: 0 }), this.bellows);
    const mask = new ModelBuilder();
    mask.add(ellipsoid(34, 40, 12, 16, 12), { col: weather(PAL.bone, 0.3, 0.1), surf: SURF.porcelain });
    for (const s of [-1, 1]) mask.add(ellipsoid(8, 5, 4, 10, 6), { col: PAL.ink, pos: [s * 13, 10, 9], rot: [0, 0, -s * 0.3], surf: SURF.porcelain });
    eyes(mask, { x: 13, y: 10, z: 11, r: 2.4, color: PAL.ghost, glow: 1.4, part: PART.BODY });
    for (const s of [-1, 1]) mask.add(tube([[s * 13, 4, 10], [s * 14, -8, 11], [s * 12, -20, 10]], 1, 4, 6), { col: PAL.ink, surf: SURF.porcelain });
    this.mesh(mask.build({ ao: 0 }), this.node(this.organ, 0, 128, 44));
    this.mouth = this.node(this.organ, 0, 104, 52);
    const mo = new ModelBuilder().add(ellipsoid(12, 6, 4, 12, 6), { col: PAL.ink, surf: SURF.porcelain }).add(ellipsoid(8, 3, 2, 10, 4), { col: PAL.ghost, emit: 1, pos: [0, 0, 1], surf: SURF.bulb }).build({ ao: 0 });
    this.mesh(mo, this.mouth);
  }

  update(b: CalliopeBoss, g: Game, r: GameRenderer3D, x: number, y: number, dt: number): void {
    const t = r.time;
    this.group.visible = !b.removed;
    if (b.removed) return;
    const P = b.pose;
    // pipe tips sit at height ~290: shift south so the tips land on the sim's pipe-tip points
    const tipH = 183 + 110;
    const shift = tipH * COT;
    const rise = b.dead ? 1 - Math.min(1, b.deathT / 3) : b.rise;
    const sink = (1 - rise) * -320;
    this.group.position.set(x + (rise < 1 ? Math.sin(t * 40) * 3 : 0), sink, y - 30 + shift);
    this.bellows.scale.y = 0.75 + 0.25 * Math.sin(b.pump);
    this.mouth.scale.y = 1 + (P.mouth ?? 0) * 2.4;
    this.state(b, t, [1, 1, 1, 0.7 + (P.glow ?? 0) * 0.8], [0.45, 1, 0.7, 0.6]);
    const glowF = r.assets.atlas.get('fx_glow_0');
    for (let i = 0; i < b.pipes; i++) {
      const tip = b.pipeTip(i);
      const lit = b.pipeLit === i;
      if (lit) {
        r.glow.draw(glowF, tip.x, tip.y, 10, 1.6, 1.6, 0, 0.5, 1, 0.75, 0.9);
        pool.add(tip.x, tip.y, 260, 1.4, 0.45, 1, 0.7, 120, 3);
      }
      if ((P.steam ?? 0) > 0 && Math.random() < 0.25) r.fx.handle([{ type: 'spark', x: tip.x, y: tip.y, a: 1, b: 0, c: 0, style: 'frost' }]);
    }
    if (b.awake && !b.dead) pool.add(x, y, 600, 0.8 + (P.glow ?? 0), 0.4, 1, 0.65, 200, 3);
    void g;
    void dt;
  }
}

// ======================================================================= wrecks left behind
function wreck(id: string): THREE.BufferGeometry | null {
  const m = new ModelBuilder();
  if (id === 'carnival_tent') {
    m.add(lathe([[0, 30], [80, 26], [170, 6], [180, 0], [0, 0]], 24), { col: stripes(20, PAL.red, PAL.cream, 0, 0.6), surf: SURF.canvas, scale: [1, 1, 0.9] });
    for (let i = 0; i < 4; i++) m.add(cyl(5, 6, 150, 8), { col: weather(PAL.woodPale, 0.5), pos: [-60 + i * 40, 12, (i % 2 ? 1 : -1) * 40], rot: [Math.PI / 2 - 0.1, i * 0.7, 0], surf: SURF.wood });
  } else if (id === 'ferris_wheel') {
    m.add(torus(140, 4, 6, 40), { col: weather(PAL.redDeep, 0.5, 0.04, PAL.iron), rot: [Math.PI / 2 - 0.08, 0, 0], pos: [0, 10, 0], surf: SURF.iron });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      m.add(cyl(1.8, 1.8, 140, 4), { col: PAL.iron, pos: [Math.cos(a) * 70, 10, Math.sin(a) * 70], rot: [Math.PI / 2, 0, -a + Math.PI / 2], surf: SURF.iron });
    }
  } else if (id === 'puppet_king') {
    m.add(lathe([[0, 0], [52, 0], [46, 30], [0, 34]], 18), { col: weather(PAL.velvet, 0.5), surf: SURF.velvet });
    m.add(sphere(30, 14, 10), { col: weather(PAL.woodPale, 0.4), pos: [60, 26, 20], surf: SURF.wood });
    m.add(cyl(22, 20, 16, 14, true), { col: PAL.gold, pos: [-60, 8, 30], rot: [0.6, 0, 0.4], surf: SURF.gold });
  } else return null;
  return m.build({ ao: 0.3 });
}

// ======================================================================= the manager
export class BossRigs {
  private tent: TentRig;
  private ferris: FerrisRig;
  private puppet: PuppetRig;
  private ring: RingmasterRig;
  private calliope: CalliopeRig;
  private wrecks = new Map<string, THREE.Mesh>();
  private wreckMat = actorMaterial({});

  constructor(private scene: THREE.Scene) {
    this.tent = new TentRig(scene);
    this.ferris = new FerrisRig(scene, 10);
    this.puppet = new PuppetRig(scene);
    this.ring = new RingmasterRig(scene);
    this.calliope = new CalliopeRig(scene, 9);
  }

  update(g: Game, r: GameRenderer3D, alpha: number, dt: number): void {
    const seen = new Set<string>();
    r.spot.intensity = 0;
    r.moonTint = 0;
    for (const b of g.bosses) {
      const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
      seen.add(b.def.id);
      switch (b.def.id) {
        case 'carnival_tent': this.tent.update(b as TentBoss, g, r, x, y, dt); break;
        case 'ferris_wheel': this.ferris.update(b as FerrisBoss, g, r, x, y, dt); break;
        case 'puppet_king': this.puppet.update(b as PuppetBoss, g, r, x, y, dt); break;
        case 'ringmaster': this.ring.update(b as RingmasterBoss, g, r, x, y, dt); break;
        case 'calliope': this.calliope.update(b as CalliopeBoss, g, r, x, y, dt); break;
      }
    }
    if (!seen.has('carnival_tent')) this.tent.group.visible = false;
    if (!seen.has('ferris_wheel')) {
      this.ferris.group.visible = true;
      this.ferris.wheel.visible = false;
      this.ferris.stand.position.set(FERRIS_HOME.x, 0, FERRIS_HOME.y + 182 * COT);
    }
    if (!seen.has('puppet_king')) this.puppet.group.visible = false;
    if (!seen.has('ringmaster')) this.ring.group.visible = false;
    if (!seen.has('calliope')) this.calliope.group.visible = false;
    for (const rm of g.bossRemains) {
      const key = `${rm.id}@${Math.round(rm.x)},${Math.round(rm.y)}`;
      if (this.wrecks.has(key)) continue;
      const geo = wreck(rm.id);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, this.wreckMat);
      mesh.position.set(rm.x, 0, rm.y + 20);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.wrecks.set(key, mesh);
    }
    if (g.bossRemains.length === 0 && this.wrecks.size) {
      for (const m of this.wrecks.values()) this.scene.remove(m);
      this.wrecks.clear();
    }
  }

  glowColor(b: BossBase): [number, number, number] {
    switch (b.def.id) {
      case 'ringmaster': return (b as RingmasterBoss).demon > 0.5 ? [1, 0.35, 0.15] : [1, 0.75, 0.5];
      case 'ferris_wheel': return [1, 0.3, 0.3];
      case 'puppet_king': return [0.75, 0.5, 1];
      case 'calliope': return [0.45, 1, 0.7];
      default: return [1, 0.6, 0.35];
    }
  }

  /** Calliope-specific telegraphs; returns true when handled. */
  drawHazard(h: Hazard, r: GameRenderer3D): boolean {
    const t = r.time;
    const pulse = 0.6 + 0.4 * Math.sin(t * 8);
    switch (h.style) {
      case 'lamp_ring': {
        // one of the four lamps' marker rings, coloured by its emblem
        const c = LAMP_COLS[clamp(h.tag, 0, 3)];
        r.teleLine.ring(h.x, h.y, h.r - 3, h.r, c[0], c[1], c[2], 0.85 * pulse, 0.85 * pulse);
        r.addShapes.circle(h.x, h.y, h.r, c[0], c[1], c[2], 0.12, 0);
        return true;
      }
      case 'safe_lamp': {
        const c = LAMP_COLS[clamp(h.tag, 0, 3)];
        r.addShapes.circle(h.x, h.y, h.r, c[0], c[1], c[2], 0.3 * pulse, 0.05);
        r.teleLine.ring(h.x, h.y, h.r - 4, h.r, 0.4, 1, 0.6, 1, 1);
        return true;
      }
      case 'crescendo': {
        // the whole stage burns except the one lamp the song is singing about
        const tele = h.tele > 0;
        const prog = tele ? 1 - h.tele / Math.max(0.001, h.teleMax) : 1;
        r.teleFill.circle(h.x, h.y, h.r, 1, 0.25, 0.12, tele ? 0.1 + prog * 0.22 : 0.45, tele ? 0.05 : 0.3);
        if (h.holeR > 0) {
          r.zoneShapes.circle(h.holeX, h.holeY, h.holeR, 0.05, 0.12, 0.08, 0.9, 0.9);
          r.addShapes.circle(h.holeX, h.holeY, h.holeR, 0.4, 1, 0.65, 0.45 * pulse, 0.1);
          r.teleLine.ring(h.holeX, h.holeY, h.holeR - 4, h.holeR, 0.4, 1, 0.6, 1, 1);
        }
        r.teleLine.ring(h.x, h.y, h.r - 4, h.r, 1, 0.25, 0.12, 0.8 * pulse, 0.8 * pulse);
        return true;
      }
      case 'steam': {
        if (h.tele > 0) return false;
        if (Math.random() < 0.5) r.fx.handle([{ type: 'spark', x: h.x + (Math.random() - 0.5) * h.r, y: h.y + (Math.random() - 0.5) * h.r, a: 1, b: 0, c: 0, style: 'frost' }]);
        r.addShapes.circle(h.x, h.y, h.r, 0.8, 0.9, 1, 0.35, 0.05);
        r.teleLine.ring(h.x, h.y, h.r - 2.5, h.r, 1, 0.3, 0.15, 0.9, 0.9);
        return true;
      }
    }
    return false;
  }
}

/** Ghost-light tints for the four soul lamps (moon, key, eye, crown). */
const LAMP_COLS: [number, number, number][] = [[0.6, 0.75, 1], [1, 0.85, 0.4], [0.45, 1, 0.7], [1, 0.45, 0.7]];

export const _unused = { LAST_SONG, limb, bulb, box };
