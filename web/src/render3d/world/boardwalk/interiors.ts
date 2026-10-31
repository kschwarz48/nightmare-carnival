// The Boardwalk's two entered buildings (D-68): the Arcade (Neptune's Palace of Amusements) and the Gift
// Shop (Seashell Souvenirs & Curiosities). Their walls are real (they collide; the doors are gaps); inside,
// the walls wear interior faces (green wainscot and attraction posters in the Arcade, faded floral paper in
// the shop). When the local player steps in, that building's roof fades away and its street front sinks
// to a stub on that screen only, so partners can be in different buildings at once.

import * as THREE from 'three';
import { BUILDING, insideBuilding, type Building } from '../../../data/boardwalk';
import { PROPS } from '../../../data/map';
import { C, SURF, box, cyl, extrude, sphere, torus, vnoise, weather, type ColorFn } from '../../core/geo';
import { actorMaterial } from '../../core/materials';
import { ModelBuilder, PAL } from '../../models/kit';
import { signMesh } from '../props';
import type { Bulb } from './structures';

const WALL_H = 220;
const trimWhite = weather(0xd6d0c4, 0.45, 0.04, 0x8a8478);
const stucco = weather(0xd0c4aa, 0.5, 0.02, 0x7a6c5c);
const tin: ColorFn = (p) => C(0x4a5450).multiplyScalar(0.7 + 0.3 * Math.abs(Math.sin(p.x * 0.35)) + 0.2 * vnoise(p.x * 0.01, 0, p.z * 0.01)).lerp(C(0x5a3420), Math.max(0, vnoise(p.x * 0.03, 1, p.z * 0.03) - 0.6) * 1.8);
const shingle: ColorFn = (p) => C(0x2e2c34).multiplyScalar(0.75 + 0.4 * vnoise(Math.floor(p.x / 9), Math.floor(p.y / 6), Math.floor(p.z / 9)));

interface Cut { b: Building; roof: THREE.Mesh; front: THREE.Mesh; k: number; mat: THREE.MeshStandardMaterial }

export class Interiors {
  private cuts: Cut[] = [];
  readonly bulbs: Bulb[] = [];
  readonly signs: THREE.Mesh[] = [];

  constructor(root: THREE.Object3D) {
    const walls = new ModelBuilder();
    for (const id of ['arcade', 'giftshop']) {
      const b = BUILDING[id];
      const front = new ModelBuilder();
      const roof = new ModelBuilder();
      const inner = id === 'arcade' ? weather(0x1e3a30, 0.4, 0.03) : weather(0x5a4a52, 0.45, 0.03);
      const outer = id === 'arcade' ? stucco : weather(0x8a9aa0, 0.5, 0.04, 0x5a5a58);
      for (const p of PROPS) {
        if (p.kind !== 'bw_wall' || p.style !== id) continue;
        const hw = p.hw ?? 10, hh = p.hh ?? 10;
        const southFace = !p.yaw && p.y > b.y1 - 40;
        const into = southFace ? front : walls;
        into.add(box(hw * 2, WALL_H, hh * 2), { col: outer, pos: [p.x, WALL_H / 2, p.y], surf: SURF.paint });
        // the inside faces: a wainscot rail and the room's colour
        const inX = p.yaw ? (p.x < (b.x0 + b.x1) / 2 ? 1 : -1) : 0, inZ = p.yaw ? 0 : p.y < (b.y0 + b.y1) / 2 ? 1 : -1;
        const fx = p.x + inX * (hw + 1), fz = p.y + inZ * (hh + 1);
        const lw = p.yaw ? 2 : hw * 2, ld = p.yaw ? hh * 2 : 2;
        into.add(box(lw, WALL_H - 10, ld), { col: inner, pos: [fx, (WALL_H - 10) / 2, fz], surf: SURF.paint });
        into.add(box(lw + (p.yaw ? 2 : 0), 6, ld + (p.yaw ? 0 : 2)), { col: PAL.gold, pos: [fx + inX, 80, fz + inZ], surf: SURF.gold });
        into.add(box(lw, 70, ld), { col: id === 'arcade' ? weather(0x2a1a12, 0.4) : weather(0x3a2418, 0.4), pos: [fx + inX * 0.5, 38, fz + inZ * 0.5], surf: SURF.wood });
      }
      this.decorate(id, b, front, roof);
      const mat = actorMaterial({ dither: true, detail: true, emitBoost: 2.2, transparent: true, opacity: 1 });
      const roofMesh = new THREE.Mesh(roof.build({ ao: 0.3 }), mat);
      const frontMesh = new THREE.Mesh(front.build({ ao: 0.3 }), actorMaterial({ dither: true, detail: true, emitBoost: 2.4 }));
      for (const mm of [roofMesh, frontMesh]) {
        mm.castShadow = true;
        mm.receiveShadow = true;
        root.add(mm);
      }
      frontMesh.position.set(0, 0, 0);
      this.cuts.push({ b, roof: roofMesh, front: frontMesh, k: 0, mat });
    }
    const wallMesh = new THREE.Mesh(walls.build({ ao: 0.3 }), actorMaterial({ dither: true, detail: true, emitBoost: 2.2 }));
    wallMesh.castShadow = wallMesh.receiveShadow = true;
    root.add(wallMesh);
  }

  private sign(text: string, w: number, h: number, x: number, y: number, z: number, o: { color?: string; glow?: number } = {}): THREE.Mesh {
    const s = signMesh(text, w, h, o);
    s.position.set(x, y, z);
    this.signs.push(s);
    return s;
  }

  private decorate(id: string, b: Building, front: ModelBuilder, roof: ModelBuilder): void {
    const x0 = b.x0, x1 = b.x1, z0 = b.y0, z1 = b.y1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    const bulb = (m: ModelBuilder, x: number, y: number, z: number, col: [number, number, number]) => {
      m.add(sphere(3.4, 8, 6), { col: C(0xfff0c8), pos: [x, y, z], surf: SURF.bulb, emit: 1.3 });
      this.bulbs.push({ x, y: z, h: y, col });
    };
    if (id === 'arcade') {
      // ---- the street front: a colonnade of white arches (after the photograph's arcade), a pediment sign
      const bays = 12, bw = w / bays;
      for (let i = 0; i <= bays; i++) front.add(box(18, 190, 22), { col: trimWhite, pos: [x0 + i * bw, 95, z1 + 4], surf: SURF.paint });
      for (let i = 0; i < bays; i++) {
        const ax = x0 + (i + 0.5) * bw;
        front.add(torus(bw / 2 - 10, 6, 6, 14, Math.PI), { col: trimWhite, pos: [ax, 132, z1 + 4], surf: SURF.paint });
        // arched windows full of the machines' cold light (the doors are the gaps in the wall)
        const door = Math.abs(ax + 1600) < 120 || Math.abs(ax + 1000) < 120;
        if (!door) {
          front.add(box(bw - 30, 96, 3), { col: C(0x5ab0a8), pos: [ax, 80, z1 + 2], surf: SURF.glass, emit: 0.22 });
          front.add(box(2.5, 96, 4), { col: trimWhite, pos: [ax, 80, z1 + 3], surf: SURF.paint });
        }
      }
      front.add(box(w + 14, 16, 30), { col: trimWhite, pos: [cx, 200, z1 + 6], surf: SURF.paint });
      front.add(box(w + 4, 50, 14), { col: stucco, pos: [cx, 234, z1 + 2], surf: SURF.paint });
      // the pediment: a stepped crest with the sign, a trident above it, seahorses either side
      front.add(box(520, 70, 14), { col: stucco, pos: [cx, 290, z1 + 2], surf: SURF.paint });
      front.add(box(420, 46, 6), { col: C(0x12302c), pos: [cx, 288, z1 + 10], surf: SURF.paint });
      const tri = new THREE.Shape([new THREE.Vector2(-260, 0), new THREE.Vector2(260, 0), new THREE.Vector2(0, 70)]);
      front.add(extrude(tri, 12, 0, 1), { col: stucco, pos: [cx, 325, z1 + 2], surf: SURF.paint });
      front.add(cyl(3, 3, 80, 6), { col: PAL.gold, pos: [cx, 380, z1 + 10], surf: SURF.gold });
      for (const s of [-1, 0, 1]) front.add(box(4, 24, 4), { col: PAL.gold, pos: [cx + s * 12, 420 - Math.abs(s) * 6, z1 + 10], surf: SURF.gold });
      for (const s of [-1, 1]) {
        front.add(torus(16, 5, 6, 12, Math.PI * 1.5), { col: weather(0x2a6a64, 0.4), pos: [cx + s * 240, 300, z1 + 12], rot: [0, 0, s > 0 ? 0 : Math.PI], surf: SURF.paint });
        front.add(sphere(9, 8, 6), { col: weather(0x2a6a64, 0.4), pos: [cx + s * 240, 322, z1 + 12], surf: SURF.paint });
      }
      for (let x = cx - 200; x <= cx + 200; x += 20) bulb(front, x, 316, z1 + 12, [0.4, 1, 0.85]);
      for (let x = cx - 200; x <= cx + 200; x += 20) bulb(front, x, 260, z1 + 12, [0.4, 1, 0.85]);
      this.sign("NEPTUNE'S PALACE", 380, 34, cx, 292, z1 + 14, { glow: 0.9, color: '#9af0e0' });
      this.sign('OF AMUSEMENTS  ·  PENNY ARCADE  ·  OPEN ALL NIGHT', 560, 18, cx, 234, z1 + 10, { glow: 0.4, color: '#c8e8e0' });
      // ---- the roof: weathered tin hips with a clerestory of skylights along the ridge
      const H = WALL_H, rise = 110, half = d / 2 + 20, len = Math.hypot(half, rise), sl = Math.atan2(rise, half);
      roof.add(box(w + 30, 6, len), { col: tin, pos: [cx, H + rise / 2, cz + half / 2], rot: [sl, 0, 0], surf: SURF.iron });
      roof.add(box(w + 30, 6, len), { col: tin, pos: [cx, H + rise / 2, cz - half / 2], rot: [-sl, 0, 0], surf: SURF.iron });
      roof.add(box(w - 160, 40, 60), { col: C(0x1e2a28), pos: [cx, H + rise + 18, cz], surf: SURF.iron });
      for (let x = x0 + 120; x < x1 - 100; x += 70) roof.add(box(52, 30, 3), { col: C(0x6ad0c0), pos: [x, H + rise + 18, cz + 31], surf: SURF.glass, emit: 0.3 });
    } else {
      // ---- the Gift Shop's street front: bay windows heaped with souvenirs, a scallop-shell crest
      const H = 180;
      for (const s of [-1, 1]) {
        const bx = cx + s * 250;
        front.add(box(220, 110, 40), { col: weather(0x8a9aa0, 0.5, 0.04), pos: [bx, 75, z1 + 20], surf: SURF.paint });
        front.add(box(200, 80, 3), { col: C(0xffd090), pos: [bx, 80, z1 + 41], surf: SURF.glass, emit: 0.36 });
        for (const t of [-0.33, 0, 0.33]) front.add(box(3, 80, 4), { col: trimWhite, pos: [bx + t * 200, 80, z1 + 42], surf: SURF.paint });
        front.add(box(230, 8, 50), { col: trimWhite, pos: [bx, 134, z1 + 22], surf: SURF.paint });
        // the window's heap: little silhouettes of ships, globes and dolls
        for (let k = 0; k < 6; k++) front.add(sphere(7 + (k % 3) * 2, 8, 6), { col: C([0xc8a070, 0x8ab0c8, 0xe0c0c0][k % 3]), pos: [bx - 80 + k * 32, 50 + (k % 2) * 14, z1 + 34], surf: SURF.porcelain, emit: 0.15 });
      }
      front.add(box(w + 8, 30, 14), { col: trimWhite, pos: [cx, H + 10, z1 + 4], surf: SURF.paint });
      front.add(box(360, 54, 10), { col: C(0x1e2c38), pos: [cx, H + 52, z1 + 6], surf: SURF.paint });
      // the scallop: ribs fanned in a half-disc above the sign
      for (let k = 0; k < 11; k++) {
        const a = (k / 10) * Math.PI;
        front.add(box(12, 80, 6), { col: weather(0xe0c8b0, 0.4), pos: [cx + Math.cos(a) * 40, H + 100 + Math.sin(a) * 40, z1 + 8], rot: [0, 0, a - Math.PI / 2], surf: SURF.porcelain });
      }
      // a teal-and-cream awning over the door
      for (let i = 0; i < 8; i++) front.add(box(22, 3, 60), { col: weather(i % 2 ? 0x2a6a64 : 0xd8d0b8, 0.45, 0.05), pos: [cx - 77 + i * 22, 132, z1 + 30], rot: [0.5, 0, 0], surf: SURF.canvas });
      for (let x = cx - 170; x <= cx + 170; x += 20) bulb(front, x, H + 82, z1 + 12, [1, 0.8, 0.55]);
      this.sign('SEASHELL SOUVENIRS', 330, 26, cx, H + 58, z1 + 12, { glow: 0.85, color: '#f0dcb8' });
      this.sign('& CURIOSITIES', 200, 16, cx, H + 36, z1 + 12, { glow: 0.5, color: '#d8c8a8' });
      // ---- the roof: shingled gable, a dormer, a weathervane gull
      const rise = 120, half = d / 2 + 18, len = Math.hypot(half, rise), sl = Math.atan2(rise, half);
      roof.add(box(w + 26, 6, len), { col: shingle, pos: [cx, WALL_H + rise / 2, cz + half / 2], rot: [sl, 0, 0], surf: SURF.wood });
      roof.add(box(w + 26, 6, len), { col: shingle, pos: [cx, WALL_H + rise / 2, cz - half / 2], rot: [-sl, 0, 0], surf: SURF.wood });
      roof.add(box(w + 30, 8, 10), { col: weather(0x1a1414, 0.4), pos: [cx, WALL_H + rise + 2, cz], surf: SURF.wood });
      roof.add(box(90, 60, 50), { col: weather(0x8a9aa0, 0.5), pos: [cx - 200, WALL_H + 60, cz + half / 2], surf: SURF.paint });
      roof.add(box(60, 34, 3), { col: C(0xffd090), pos: [cx - 200, WALL_H + 60, cz + half / 2 + 26], surf: SURF.glass, emit: 0.3 });
      roof.add(cyl(1.5, 1.5, 50, 5), { col: PAL.iron, pos: [cx + 150, WALL_H + rise + 26, cz], surf: SURF.iron });
      roof.add(box(30, 6, 3), { col: PAL.iron, pos: [cx + 150, WALL_H + rise + 50, cz], rot: [0, 0, 0.2], surf: SURF.iron });
    }
  }

  /** The signs, added to the root once (they belong to the fronts and fade with them). */
  attachSigns(root: THREE.Object3D): void {
    for (const s of this.signs) root.add(s);
  }

  /** Fade the roof and sink the front of whichever building the local player stands in. */
  update(px: number, py: number, dt: number): void {
    const inside = insideBuilding(px, py);
    for (const c of this.cuts) {
      const target = inside === c.b ? 1 : 0;
      c.k += (target - c.k) * Math.min(1, dt * 7);
      if (Math.abs(c.k - target) < 0.002) c.k = target;
      c.mat.opacity = 1 - c.k;
      c.roof.visible = c.k < 0.995;
      c.mat.depthWrite = c.k < 0.05;
      c.front.scale.y = 1 - 0.8 * c.k;
      for (const s of this.signs) {
        if (Math.abs(s.position.z - c.b.y1) < 30 && s.position.x > c.b.x0 && s.position.x < c.b.x1) s.visible = c.k < 0.5;
      }
    }
  }
}
