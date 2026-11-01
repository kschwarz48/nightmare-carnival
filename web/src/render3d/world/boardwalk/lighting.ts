// The Boardwalk's lighting (D-68). As on the other maps, every pool comes from a fixture you can see, and
// every fixture wears a halo: the promenade's double-globe lamps, the pier's ship lanterns, warm spill from
// shop windows, the Arcade's cold machine-light and the Gift Shop's lamps; chasing marquee bulbs on the
// signs, the coaster's chase lights, the Sea Wheel's spokes, the Plunge's crown; and the lighthouse, whose
// beam sweeps the sea and the pier. Shafts fall under the lamps and lanterns; motes drift in their light.
// D-79: the entered buildings' doorways and the station's portals pour their lamps' light out (spill.ts), the
// station's windows show the train's shadow, and the train carries a headlamp with a beam ahead of it.

import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { GameRenderer3D } from '../../renderer3d';
import { ARCADE_FIX, BUILDING, DOORS, PIER_FIX, STAIRS, PROMENADE, TOWERS, WHEEL } from '../../../data/boardwalk';
import { PROPS } from '../../../data/map';
import { pool } from '../../core/materials';
import { LightShafts, Motes, type Shaft } from '../atmosphere';
import { dyingNeon, lampFlicker } from '../props';
import type { Frame } from '../../../render/atlas';
import { BW_LAMP_H, PIER_LAMP_H } from './props';
import { PHOTO_BULB, SHELF_LAMP, shelfLampXs } from './furnishings';
import { HEADLAMP, Rides } from './rides';
import { STATION_PANES, STATION_PORTALS, type Bulb } from './structures';
import { Spill, StationWindows, insideColour, type InsideLamp, type Opening } from './spill';

type RGB = [number, number, number];
const WARM: RGB = [1, 0.64, 0.34];
/** the Undertow station's work lamps, behind its frosted windows and out of its portals (D-79) */
const STATION_LAMP: RGB = [1, 0.76, 0.46];
/** the train's headlamp */
const HEADLIGHT: RGB = [1, 0.92, 0.74];

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

const _x = new THREE.Vector3(1, 0, 0), _dir = new THREE.Vector3();

export class BoardwalkLighting {
  readonly shafts: LightShafts;
  readonly motes: Motes;
  private lamps: { x: number; y: number; v: number }[] = [];
  private lanterns: { x: number; y: number }[] = [];
  /** the Gift Shop's lamps: the souvenir stands' banker's lamps and the photograph's picture lamp */
  private shopLamps: { x: number; y: number; h: number }[] = [];
  private stands: { x: number; y: number }[] = [];
  private photoLamp: { x: number; y: number; h: number } | null = null;
  /** the beach's own few lights: a lantern on each lifeguard tower, the fire pit's embers, the stair landings */
  private beach: { x: number; y: number; h: number; col: RGB; r: number; k: number; fire?: boolean }[] = [];
  private bulbs: Bulb[];
  private windows: { x: number; y: number; h: number; col: RGB }[];
  private glowF: Frame | null = null;
  private beam: THREE.Mesh;
  private beamMat: THREE.ShaderMaterial;
  /** the two entered buildings' own lamps (their pools, and the colours their doorways pour out) */
  private inside: (InsideLamp & { r: number; h: number; pr: number })[] = [];
  private spill: Spill;
  private stationWin: StationWindows;
  /** the train's headlamp beam, and where the lamp is this frame */
  private head: THREE.Mesh;
  private headMat: THREE.ShaderMaterial;
  private lamp = { x: 0, y: 0, h: 0, dx: 1, dy: 0 };
  /** how far the local player's view has cut into a building (set by the world from its interiors) */
  cut: (building: string) => number = () => 0;
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
      if (p.kind === 'bw_shelf') {
        this.stands.push({ x: p.x, y: p.y });
        for (const lx of shelfLampXs(p.variant ?? 200)) this.shopLamps.push({ x: p.x + lx, y: p.y + SHELF_LAMP.z, h: SHELF_LAMP.h });
      }
      if (p.kind === 'bw_photo') this.shopLamps.push((this.photoLamp = { x: p.x, y: p.y + PHOTO_BULB[2], h: PHOTO_BULB[1] }));
    }
    // inside the Arcade: cold light off the machines, Marina's teal glass, the Crane's pink; inside the Gift
    // Shop: each stand under its own lamps, the photograph under its picture lamp
    for (const [x, y] of [[-1600, -1180], [-1000, -1180], [-1300, -1400]] as [number, number][]) this.inside.push({ b: 'arcade', x, y, r: 300, k: 0.85, col: [0.55, 0.9, 1], h: 200, pr: 1 });
    this.inside.push({ b: 'arcade', x: ARCADE_FIX.marina.x, y: ARCADE_FIX.marina.y + 60, r: 200, k: 0.9, col: [0.4, 1, 0.9], h: 120, pr: 1.3 });
    this.inside.push({ b: 'arcade', x: ARCADE_FIX.crane.x, y: ARCADE_FIX.crane.y + 60, r: 180, k: 0.8, col: [1, 0.6, 0.6], h: 120, pr: 1 });
    for (const s of this.stands) this.inside.push({ b: 'giftshop', x: s.x, y: s.y + 30, r: 240, k: 0.9, col: [1, 0.74, 0.46], h: SHELF_LAMP.h, pr: 1 });
    const ph = this.photoLamp;
    if (ph) this.inside.push({ b: 'giftshop', x: ph.x, y: ph.y + 10, r: 170, k: 0.95, col: [1, 0.8, 0.52], h: ph.h, pr: 1.4 });
    // D-79: every doorway pours out the light of the lamps nearest each of its sides; the station's portals
    // pour out its work lamps
    const openings: Opening[] = DOORS.map((d, i) => {
      const b = BUILDING[d.b];
      const [x, y, nx, ny] = d.wall === 's' ? [d.c, b.y1, 0, 1] : d.wall === 'e' ? [b.x1, d.c, 1, 0] : [b.x0, d.c, -1, 0];
      // sample the light inside, 110 in from the doorway, a third of its width to either side
      const sx = -ny * d.w / 3, sy = nx * d.w / 3;
      return {
        x, y, nx, ny, w: d.w, building: d.b, ph: i * 1.7, reach: 230, glowH: 170,
        a: insideColour(this.inside, d.b, x - nx * 110 - sx, y - ny * 110 - sy),
        b: insideColour(this.inside, d.b, x - nx * 110 + sx, y - ny * 110 + sy),
      };
    });
    for (const P of STATION_PORTALS) openings.push({ x: P.x, y: P.y, nx: P.nx, ny: 0, w: P.w, a: STATION_LAMP, b: STATION_LAMP, reach: 170, glowH: 0, building: 'station', ph: P.x * 0.01 });
    this.spill = new Spill(root, openings);
    this.stationWin = new StationWindows(root, STATION_PANES, STATION_LAMP);
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
      // dust turning in the light at each doorway (D-79)
      ...openings.filter((o) => o.glowH > 0).map((o) => ({ x: o.x + o.nx * 60, y: o.y + o.ny * 60, col: [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2, (o.a[2] + o.b[2]) / 2] as RGB })),
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
    // the train's headlamp beam (D-79): narrow at the lamp, spreading ahead
    const hg = new THREE.CylinderGeometry(0.12, 1, 1, 16, 1, true);
    hg.rotateZ(Math.PI / 2);
    hg.translate(0.5, 0, 0);
    this.headMat = new THREE.ShaderMaterial({
      uniforms: { uViewDir: pool.uniforms.uViewDir, uK: { value: 0.2 } },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.head = new THREE.Mesh(hg, this.headMat);
    this.head.frustumCulled = false;
    this.head.renderOrder = 6;
    root.add(this.head);
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
    // the Gift Shop's lamps
    for (const l of this.shopLamps) if (inView(l.x, l.y)) G.draw(glow, l.x, l.y, l.h, 0.32, 0.32, 0, 1, 0.78, 0.5, 0.55 * on);
    // D-79: the doorways and portals pouring out their light; the station's portals glowing in the walls
    this.spill.update(t, on, this.cut);
    for (const P of STATION_PORTALS) if (inView(P.x, P.y)) G.draw(glow, P.x + P.nx * 6, P.y, P.h + 34, 1.3, 1.3, 0, STATION_LAMP[0], STATION_LAMP[1], STATION_LAMP[2], 0.5 * on);
    // the train: its shadow across the station's windows, its headlamp and the beam ahead of it
    const tr = Rides.train(g.time), st = BUILDING.station;
    this.stationWin.update(t, on, tr.cars.map(([x, y, h], k): [number, number, number, boolean] => {
      const inside = y > st.y0 && y < st.y1 ? Math.min(1, Math.max(0, (x - st.x0 - 12) / 50)) * Math.min(1, Math.max(0, (st.x1 - 12 - x) / 50)) : 0;
      return [x, STATION_PANES[0].h0 + 4 + Math.max(0, h - 40) * 0.5, inside, k === 0];
    }));
    const [cx, cy, ch] = tr.cars[0], [dx, dy, dh] = tr.dir, flat = Math.hypot(dx, dy) || 1;
    const hl = this.lamp;
    hl.x = cx + dx * HEADLAMP.fwd;
    hl.y = cy + dy * HEADLAMP.fwd;
    hl.h = ch + 6 + dh * HEADLAMP.fwd + HEADLAMP.up;
    hl.dx = dx / flat;
    hl.dy = dy / flat;
    const lampOn = on > 0.05 && inView(hl.x, hl.y);
    this.head.visible = lampOn;
    if (lampOn) {
      G.draw(glow, hl.x, hl.y, hl.h, 1.4, 1.4, 0, HEADLIGHT[0], HEADLIGHT[1], HEADLIGHT[2], 0.85 * on);
      G.draw(glow, hl.x, hl.y, hl.h, 0.45, 0.45, 0, 1, 0.98, 0.9, on);
      this.head.position.set(hl.x, hl.h, hl.y);
      _dir.set(dx, dh - 0.12, dy).normalize();
      this.head.quaternion.setFromUnitVectors(_x, _dir);
      this.head.scale.set(460, 70, 70);
      this.headMat.uniforms.uK.value = 0.34 * on;
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
    // D-79: each doorway's and portal's light out across the floor, and the train's headlamp on the track ahead
    for (const o of this.spill.openings) {
      const k = o.building === 'station' ? 0.85 : 0.8;
      pool.add(o.x + o.nx * 70, o.y + o.ny * 70, 250, k * on, (o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2, (o.a[2] + o.b[2]) / 2, o.building === 'station' ? 90 : 120, 1.2);
    }
    const hl = this.lamp;
    pool.add(hl.x + hl.dx * 170, hl.y + hl.dy * 170, 260, 1.5 * on, HEADLIGHT[0], HEADLIGHT[1], HEADLIGHT[2], hl.h + 10, 1.8);
    for (const b of this.beach) {
      const fl = b.fire ? 0.8 + 0.2 * Math.sin(time * 13 + b.x) * Math.sin(time * 7.3) : lampFlicker(b, time * 0.8);
      pool.add(b.x, b.y, b.r, b.k * fl * on, b.col[0], b.col[1], b.col[2], b.h);
    }
    // inside the Arcade and the Gift Shop (their lamps are listed in the constructor)
    for (const l of this.inside) pool.add(l.x, l.y, l.r, l.k * on, l.col[0], l.col[1], l.col[2], l.h, l.pr);
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
