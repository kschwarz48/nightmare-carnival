// The Boardwalk's lighting (D-68). As on the other maps, every pool comes from a fixture you can see, and
// every fixture wears a halo: the promenade's double-globe lamps, the pier's ship lanterns, warm spill from
// shop windows, the Arcade's cold machine-light and the Gift Shop's lamps; chasing marquee bulbs on the
// signs, the coaster's chase lights, the Sea Wheel's spokes, the Plunge's crown; and the lighthouse, whose
// beam sweeps the sea and the pier. Shafts fall under the lamps and lanterns; motes drift in their light.

import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { GameRenderer3D } from '../../renderer3d';
import { ARCADE_FIX, GIFTSHOP, PIER_FIX, STAIRS, PROMENADE, TOWERS, WHEEL } from '../../../data/boardwalk';
import { PROPS } from '../../../data/map';
import { pool } from '../../core/materials';
import { LightShafts, Motes, type Shaft } from '../atmosphere';
import { dyingNeon, lampFlicker } from '../props';
import type { Frame } from '../../../render/atlas';
import { BW_LAMP_H, PIER_LAMP_H } from './props';
import { Rides } from './rides';
import type { Bulb } from './structures';

type RGB = [number, number, number];
const WARM: RGB = [1, 0.64, 0.34];

const BEAM_VERT = /* glsl */ `
  varying float vV;
  varying vec3 vN;
  void main() {
    vV = position.x;   // 0 at the lens, 1 at the far end
    vN = normalize(mat3(modelMatrix) * vec3(0.0, position.y, position.z));
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uViewDir;
  uniform float uK;
  varying float vV;
  varying vec3 vN;
  void main() {
    float edge = pow(clamp(abs(dot(normalize(vN), uViewDir)), 0.0, 1.0), 1.2);
    float a = edge * (1.0 - vV) * smoothstep(0.0, 0.04, vV) * uK;
    gl_FragColor = vec4(vec3(1.0, 0.94, 0.8) * a, a);
  }`;

export class BoardwalkLighting {
  readonly shafts: LightShafts;
  readonly motes: Motes;
  private lamps: { x: number; y: number; v: number }[] = [];
  private lanterns: { x: number; y: number }[] = [];
  /** the beach's own few lights: a lantern on each lifeguard tower, the fire pit's embers, the stair landings */
  private beach: { x: number; y: number; h: number; col: RGB; r: number; k: number; fire?: boolean }[] = [];
  private bulbs: Bulb[];
  private windows: { x: number; y: number; h: number; col: RGB }[];
  private glowF: Frame | null = null;
  private beam: THREE.Mesh;
  private beamMat: THREE.ShaderMaterial;
  /** the lighthouse's sweep (radians) and the spot it throws */
  beamA = 0;
  beamSpot = { x: 0, y: 0 };
  /** the lens's brightness (Summer's End flashes the call sign on it) */
  lensK = 1;

  constructor(root: THREE.Object3D, bulbs: Bulb[], windows: { x: number; y: number; h: number; col: RGB }[]) {
    this.bulbs = bulbs;
    this.windows = windows;
    for (const p of PROPS) {
      if (p.kind === 'bw_lamp') this.lamps.push({ x: p.x, y: p.y, v: p.variant ?? 0 });
      if (p.kind === 'bw_pierlamp') this.lanterns.push({ x: p.x + 32, y: p.y });
    }
    for (const t of TOWERS) this.beach.push({ x: t.x + 30, y: t.y + 20, h: 150, col: [1, 0.7, 0.4], r: 300, k: 0.9 });
    for (const p of PROPS) if (p.kind === 'bw_firepit') this.beach.push({ x: p.x, y: p.y, h: 30, col: [1, 0.45, 0.18], r: 260, k: 1.1, fire: true });
    for (const [x] of STAIRS) this.beach.push({ x: x + 70, y: PROMENADE.y1 + 150, h: 90, col: [1, 0.66, 0.36], r: 220, k: 0.7 });
    const shafts: Shaft[] = [];
    for (const l of this.lamps) {
      for (const s of l.v === 0 ? [-1, 1] : [0]) shafts.push({ x: l.x + s * 30, y: l.y, h: BW_LAMP_H - 10, r: 74, col: [1, 0.62, 0.32], flicker: 0, k: l.x + s, kind: 'lamp', a: 0.8 });
    }
    for (const l of this.lanterns) shafts.push({ x: l.x, y: l.y, h: PIER_LAMP_H - 14, r: 70, col: [1, 0.66, 0.36], flicker: 0, k: l.x * 0.3, kind: 'lamp', a: 0.9 });
    this.shafts = new LightShafts(root, shafts);
    this.motes = new Motes([
      ...this.lamps.filter((_, i) => i % 2 === 0).map((l) => ({ x: l.x, y: l.y, col: [1, 0.66, 0.34] as RGB })),
      ...this.lanterns.map((l) => ({ x: l.x, y: l.y, col: [1, 0.7, 0.4] as RGB })),
    ]);
    // the lighthouse beam: a long soft cone turning over the water
    const geo = new THREE.CylinderGeometry(1, 0.12, 1, 18, 1, true);
    geo.rotateZ(Math.PI / 2);
    geo.translate(0.5, 0, 0);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uViewDir: pool.uniforms.uViewDir, uK: { value: 0.12 } },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.beam.frustumCulled = false;
    this.beam.renderOrder = 6;
    root.add(this.beam);
  }

  update(g: Game, r: GameRenderer3D, inView: (x: number, y: number) => boolean): void {
    const t = r.time;
    const on = 1 - g.darkness * 0.92;
    const glow = (this.glowF ??= r.assets.atlas.get('fx_glow_0'));
    const G = r.glow;
    for (const l of this.lamps) {
      if (!inView(l.x, l.y)) continue;
      const fl = lampFlicker(l, t) * on;
      if (fl <= 0.1) continue;
      for (const s of l.v === 0 ? [-1, 1] : [0]) G.draw(glow, l.x + s * 30, l.y, BW_LAMP_H, 0.7, 0.7, 0, 1, 0.64, 0.34, 0.5 * fl);
    }
    for (const l of this.lanterns) {
      if (!inView(l.x, l.y)) continue;
      const fl = lampFlicker(l, t * 1.3) * on;
      if (fl > 0.1) G.draw(glow, l.x, l.y, PIER_LAMP_H - 4, 0.62, 0.62, 0, 1, 0.66, 0.36, 0.5 * fl);
    }
    // the beach's lanterns and the fire pit's embers
    for (const b of this.beach) {
      if (!inView(b.x, b.y)) continue;
      const fl = b.fire ? 0.75 + 0.25 * Math.sin(t * 13 + b.x) * Math.sin(t * 7.3) : lampFlicker(b, t * 0.8);
      G.draw(glow, b.x, b.y, b.h, b.fire ? 0.9 : 0.5, b.fire ? 0.6 : 0.5, 0, b.col[0], b.col[1], b.col[2], 0.55 * fl * on);
      if (b.fire && Math.random() < 0.15) r.fx.handle([{ type: 'spark', x: b.x + (Math.random() - 0.5) * 20, y: b.y, a: 1, b: 0, c: 0, style: 'fire' }]);
    }
    // marquee bulbs chase along their rows; the coaster's lights race the same way
    for (let i = 0; i < this.bulbs.length; i++) {
      const b = this.bulbs[i];
      if (!inView(b.x, b.y)) continue;
      const lit = Math.sin(t * 5 - i * 0.9) > -0.2 ? 1 : 0.25;
      const fail = i % 17 === 0 ? dyingNeon(t, i) : 1;
      G.draw(glow, b.x, b.y, b.h, 0.26, 0.26, 0, b.col[0], b.col[1], b.col[2], 0.55 * lit * fail * on);
    }
    // the Sea Wheel's spoke lights, turning with it
    if (inView(WHEEL.x, WHEEL.y - 250)) {
      for (let k = 0; k < 24; k++) {
        for (const f of [1, 0.55]) {
          const p = Rides.wheelBulb(k, g.time, f);
          const c: RGB = (k + (f < 1 ? 1 : 0)) % 3 === 0 ? [1, 0.3, 0.25] : (k % 3 === 1 ? [1, 0.75, 0.3] : [0.4, 0.8, 1]);
          G.draw(glow, p[0], p[1] + 30, p[2], 0.3, 0.3, 0, c[0], c[1], c[2], 0.6 * on);
        }
      }
    }
    // the lighthouse: its lens burns, its beam turns
    this.beamA = t * 0.42;
    const L = PIER_FIX.lighthouse;
    const reach = 1300;
    this.beam.position.set(L.x, 236, L.y);
    this.beam.rotation.set(0, -this.beamA, -0.16);
    this.beam.scale.set(reach, 120, 120);
    this.beamMat.uniforms.uK.value = 0.1 * (0.6 + 0.4 * on);
    this.beamSpot.x = L.x + Math.cos(this.beamA) * 760;
    this.beamSpot.y = L.y + Math.sin(this.beamA) * 760;
    if (inView(L.x, L.y)) G.draw(glow, L.x, L.y, 236, 1.6 * Math.min(2, this.lensK), 1.6 * Math.min(2, this.lensK), 0, 1, 0.94, 0.8, Math.min(1, 0.6 * this.lensK));
  }

  addLights(g: Game, time: number): void {
    const on = 1 - g.darkness * 0.92;
    for (const l of this.lamps) {
      const fl = lampFlicker(l, time) * on;
      pool.add(l.x, l.y, l.v === 0 ? 300 : 250, (l.v === 0 ? 1.25 : 1.0) * fl, WARM[0], WARM[1], WARM[2], BW_LAMP_H);
    }
    for (const l of this.lanterns) pool.add(l.x, l.y, 240, 1.05 * lampFlicker(l, time * 1.3) * on, 1, 0.66, 0.36, PIER_LAMP_H, 1.1);
    for (const w of this.windows) pool.add(w.x, w.y + 40, 220, 0.75 * on, w.col[0], w.col[1], w.col[2], w.h);
    for (const b of this.beach) {
      const fl = b.fire ? 0.8 + 0.2 * Math.sin(time * 13 + b.x) * Math.sin(time * 7.3) : lampFlicker(b, time * 0.8);
      pool.add(b.x, b.y, b.r, b.k * fl * on, b.col[0], b.col[1], b.col[2], b.h);
    }
    // inside the Arcade: cold light off the machines, a warm change booth, Marina's teal glass
    for (const [x, y] of [[-1600, -1180], [-1000, -1180], [-1300, -1400]] as [number, number][]) pool.add(x, y, 300, 0.85 * on, 0.55, 0.9, 1, 200);
    pool.add(ARCADE_FIX.marina.x, ARCADE_FIX.marina.y + 60, 200, 0.9 * on, 0.4, 1, 0.9, 120, 1.3);
    pool.add(ARCADE_FIX.crane.x, ARCADE_FIX.crane.y + 60, 180, 0.8 * on, 1, 0.6, 0.6, 120);
    // inside the Gift Shop: three warm lamps over the shelves
    for (const x of [GIFTSHOP.x0 + 220, (GIFTSHOP.x0 + GIFTSHOP.x1) / 2, GIFTSHOP.x1 - 200]) pool.add(x, -1150, 280, 0.9 * on, 1, 0.72, 0.45, 190);
    // the lighthouse's spot sweeping the water and the pier
    pool.add(this.beamSpot.x, this.beamSpot.y, 150, 1.1 * on, 1, 0.94, 0.8, 500, 2, 0.3);
    pool.add(PIER_FIX.lighthouse.x, PIER_FIX.lighthouse.y, 260, 0.9 * on, 1, 0.9, 0.7, 236, 1.5);
    // a lantern angler carries its own light, brightest while it lures
    let n = 0;
    for (const e of g.active) {
      if (!e.alive || e.def.behavior !== 'angler' || n >= 6) continue;
      n++;
      pool.add(e.x, e.y, e.state === 1 ? 260 : 170, e.state === 1 ? 1.4 : 0.7, 0.6, 1, 0.7, 70, 1.2);
    }
  }
}
