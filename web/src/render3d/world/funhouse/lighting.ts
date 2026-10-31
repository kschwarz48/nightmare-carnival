// The Fun House's lighting rig (D-67). As on the Carnival Core, every pool of light comes from a fixture
// you can see, and every fixture wears a soft halo: brass sconces along the walls the camera faces,
// frosted pendants hung over the Hall of Mirrors, lamps on the Rotunda's capitals, picture lights over the
// gallery's plinths, and lighting booms beside the Chamber's stage throwing theatre spots that drift.
// Moonlight comes in through tall windows on the west and north walls as cold panes on the floor.

import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { GameRenderer3D } from '../../renderer3d';
import { PROPS, type Prop } from '../../../data/map';
import { DOOR_PANELS, FH_HALF, MAZE, STAGE, UNREFLECTED } from '../../../data/funhouse';
import { StaticBatch } from '../../core/batch';
import { actorMaterial, pool } from '../../core/materials';
import { C, SURF, box, cyl, ellipsoid, lathe, rbox, sphere, torus } from '../../core/geo';
import { ModelBuilder, PAL } from '../../models/kit';
import { LightShafts, Motes, type Shaft } from '../atmosphere';
import { lampFlicker } from '../props';
import { WALL_H } from './models';
import type { Frame } from '../../../render/atlas';

type RGB = [number, number, number];
const _d = new THREE.Vector3(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _down = new THREE.Vector3(0, -1, 0);
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const WARM: RGB = [1, 0.62, 0.32];
const COLD: RGB = [0.62, 0.78, 1];

/** A fixture: where its light is (sim x/y, height) and how it flickers. */
interface Fixture { x: number; y: number; h: number; seed: number }

const sconceGeo = (): THREE.BufferGeometry => {
  // origin at the bulb; the backplate sits against the wall 22 behind it
  const m = new ModelBuilder();
  m.add(rbox(18, 40, 3, 3, 1), { col: PAL.brass, pos: [0, -10, -21], surf: SURF.brass });
  m.add(torus(6, 1.2, 5, 12), { col: PAL.gold, pos: [0, -4, -19.5], surf: SURF.gold });
  m.add(cyl(1.5, 1.5, 20, 6), { col: PAL.brass, pos: [0, -22, -11], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  m.add(cyl(1.5, 1.5, 14, 6), { col: PAL.brass, pos: [0, -15, -1], surf: SURF.brass });
  m.add(cyl(6, 3.6, 5, 10), { col: PAL.gold, pos: [0, -7, 0], surf: SURF.gold });
  // a frosted tulip shade, lit from within
  m.add(lathe([[3, 0], [7, 4], [10, 12], [10.5, 17], [9, 18]], 12), { col: C(0xffd8a0), pos: [0, -5, 0], surf: SURF.glass, emit: 0.9 });
  m.add(sphere(3.4, 8, 6), { col: C(0xfff0c8), pos: [0, 3, 0], surf: SURF.bulb, emit: 1.6 });
  return m.build({ ao: 0 });
};

const pendantGeo = (): THREE.BufferGeometry => {
  // origin at the globe's centre; the rod climbs into the dark above the maze
  const m = new ModelBuilder();
  m.add(cyl(0.9, 0.9, 190, 4), { col: PAL.iron, pos: [0, 110, 0], surf: SURF.iron });
  m.add(cyl(5, 8, 7, 12), { col: PAL.brass, pos: [0, 15, 0], surf: SURF.brass });
  m.add(torus(8, 1.2, 5, 14), { col: PAL.gold, pos: [0, 11, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
  m.add(sphere(13, 14, 10), { col: C(0xdfeaff), surf: SURF.glass, emit: 1.1 });
  m.add(sphere(2.6, 6, 4), { col: PAL.brass, pos: [0, -14, 0], surf: SURF.brass });
  return m.build({ ao: 0 });
};

const capitalLampGeo = (): THREE.BufferGeometry => {
  // origin on top of a column's capital: a brass bowl holding a flame-shaped globe
  const m = new ModelBuilder();
  m.add(lathe([[0, 0], [12, 0], [19, 7], [21, 11], [17, 12]], 14), { col: PAL.brass, surf: SURF.brass });
  m.add(torus(18, 1.4, 5, 16), { col: PAL.gold, pos: [0, 11, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.gold });
  m.add(ellipsoid(9, 15, 9, 12, 8), { col: C(0xffc878), pos: [0, 24, 0], surf: SURF.glass, emit: 1.2 });
  return m.build({ ao: 0 });
};

const pictureLightGeo = (): THREE.BufferGeometry => {
  // origin at the hood's lit underside; the arm reaches 26 out from the wall
  const m = new ModelBuilder();
  m.add(rbox(14, 22, 3, 3, 1), { col: PAL.brass, pos: [0, 10, -26], surf: SURF.brass });
  m.add(cyl(1.4, 1.4, 26, 6), { col: PAL.brass, pos: [0, 8, -13], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  m.add(rbox(66, 7, 12, 3, 1), { col: PAL.brass, pos: [0, 4, 0], surf: SURF.brass });
  m.add(box(58, 1.5, 7), { col: C(0xfff0d0), pos: [0, 0, 0], surf: SURF.bulb, emit: 1.4 });
  return m.build({ ao: 0 });
};

const boomGeo = (): THREE.BufferGeometry => {
  // a lighting boom beside the stage: a pipe on a weighted base, three cans aimed at the boards
  const m = new ModelBuilder();
  m.add(cyl(20, 22, 6, 12), { col: PAL.iron, pos: [0, 3, 0], surf: SURF.iron });
  m.add(cyl(2.2, 2.2, 290, 6), { col: PAL.iron, pos: [0, 148, 0], surf: SURF.iron });
  for (const h of [150, 210, 270]) {
    m.add(cyl(1.6, 1.6, 22, 5), { col: PAL.iron, pos: [0, h, 0], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
    m.add(cyl(9, 11, 24, 10), { col: C(0x1c1a1e), pos: [12, h - 4, 4], rot: [0.9, 0, 0], surf: SURF.iron });
    m.add(cyl(8.5, 8.5, 1.5, 10), { col: C(0xfff2d8), pos: [12, h - 12, 12], rot: [0.9, 0, 0], surf: SURF.bulb, emit: 1.5 });
  }
  return m.build({ ao: 0.2 });
};

/** The moonlit window panes on the floor: arched, mullioned, soft at the edges, dusty. */
const WINDOW_VERT = /* glsl */ `
  attribute vec4 iWin; // intensity, lean along x and along z (world units), unused
  varying vec2 vUv;
  varying float vI;
  varying vec2 vW;
  void main() {
    vUv = uv;
    vI = iWin.x;
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    // the panes lean toward the south-east, away from the moon
    w.x += (uv.y - 0.5) * iWin.y;
    w.z += (uv.y - 0.5) * iWin.z;
    vW = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const WINDOW_FRAG = /* glsl */ `
  uniform float uK;
  uniform vec3 uCol;
  varying vec2 vUv;
  varying float vI;
  varying vec2 vW;
  float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1, 0)), u.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    // an arched top: the far end (v = 1) is rounded
    float body = smoothstep(1.0, 0.86, abs(q.x)) * smoothstep(-1.0, -0.88, q.y);
    float arch = q.y > 0.35 ? smoothstep(1.0, 0.9, length(vec2(q.x, (q.y - 0.35) / 0.65))) : 1.0;
    // two lights wide, three high: dark mullions between the panes
    vec2 g = vec2(vUv.x * 2.0, vUv.y * 3.0);
    vec2 f = abs(fract(g) - 0.5);
    float mull = smoothstep(0.47, 0.43, max(f.x * 1.0, f.y * 1.0));
    float dust = 0.75 + 0.35 * wNoise(vW * 0.03) - 0.15 * wNoise(vW * 0.11);
    float a = body * arch * mull * dust * vI * uK;
    gl_FragColor = vec4(uCol * a, a);
  }`;

/** Contact shade along the foot of a wall: darkest against it, gone a hand's width out. */
const CONTACT_VERT = /* glsl */ `
  attribute float iK;
  varying float vA;
  void main() {
    vA = iK * uv.y * uv.y; // uv.y = 1 at the wall
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const CONTACT_FRAG = /* glsl */ `
  varying float vA;
  void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, vA); }`;

/** A theatre beam from a boom's can down to its spot on the stage, seen in the haze. */
const BEAM_VERT = /* glsl */ `
  attribute vec4 iCol;
  varying vec4 vCol;
  varying float vV;
  varying vec3 vN;
  void main() {
    vCol = iCol;
    vV = -position.y; // 0 at the can, 1 at the boards
    vN = normalize(mat3(modelMatrix * instanceMatrix) * vec3(position.x, 0.0, position.z));
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uViewDir;
  varying vec4 vCol;
  varying float vV;
  varying vec3 vN;
  void main() {
    float edge = pow(clamp(abs(dot(normalize(vN), uViewDir)), 0.0, 1.0), 1.4);
    float a = edge * (0.35 + 0.65 * vV) * smoothstep(0.0, 0.06, vV) * vCol.a;
    gl_FragColor = vec4(vCol.rgb * a, a);
  }`;

/** The stage's three spots: phase, colour, and which boom can throws it (west/east, can height). */
const SPOTS: { ph: number; col: RGB; boom: number; can: number }[] = [
  { ph: 0, col: [1, 0.9, 0.75], boom: 0, can: 270 },
  { ph: 2.1, col: [1, 0.35, 0.6], boom: 1, can: 270 },
  { ph: 4.2, col: [0.35, 0.75, 1], boom: 1, can: 210 },
];

export class FunhouseLighting {
  readonly shafts: LightShafts;
  readonly motes: Motes;
  private sconces: Fixture[] = [];
  private pendants: Fixture[] = [];
  private capitals: Fixture[] = [];
  private pictures: (Fixture & { tx: number; ty: number })[] = [];
  private booms: { x: number; y: number; flip: number }[] = [];
  private finials: { x: number; y: number }[] = [];
  private lamps: Prop[];
  private glowF: Frame | null = null;
  private windows: THREE.InstancedMesh;
  private winK = { value: 1 };
  private beams: THREE.InstancedMesh;
  private beamCol: THREE.InstancedBufferAttribute;
  /** the soft additive and shading layers the mirrors leave out of their reflections (each one is a draw call
   *  per mirror pass, and none of them would be missed in the glass) */
  readonly unreflected: THREE.Object3D[] = [];

  constructor(root: THREE.Object3D) {
    this.lamps = PROPS.filter((p) => p.kind === 'fh_lamp' || p.kind === 'fh_chandelier');
    this.placeSconces();
    // frosted pendants over the Hall of Mirrors (they hang above the glass, so the panels never hide them)
    for (const [x, y] of [[-1910, -1125], [-1680, -225], [-1450, 450], [-990, 680], [-1910, 680], [-1000, -900], [-1220, -560]] as [number, number][]) {
      this.pendants.push({ x, y, h: 232, seed: x * 0.37 + y });
    }
    // a lamp on every column capital round the Rotunda
    for (const p of PROPS) if (p.kind === 'fh_column') this.capitals.push({ x: p.x, y: p.y, h: 236, seed: p.x + p.y * 0.3 });
    // picture lights on the gallery's back wall, one over each performer's plinth
    for (const p of UNREFLECTED.plinths) this.pictures.push({ x: p.x, y: -FH_HALF + 60 + 34, h: 236, seed: p.x, tx: p.x, ty: p.y });
    // lighting booms either side of the stage
    this.booms.push({ x: STAGE.x - STAGE.hw - 70, y: STAGE.y + 40, flip: 1 }, { x: STAGE.x + STAGE.hw + 70, y: STAGE.y + 40, flip: -1 });
    // bulbs on the maze's frame posts (static panels and the dressing room's door)
    const seen = new Set<string>();
    for (const p of [...PROPS.filter((q) => q.kind === 'fh_mirror'), ...DOOR_PANELS]) {
      const half = (p.w ?? MAZE.cw) / 2 - 6;
      for (const s of [-1, 1]) {
        const x = p.yaw ? p.x : p.x + s * half, y = p.yaw ? p.y + s * half : p.y;
        const k = `${Math.round(x / 10)},${Math.round(y / 10)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        this.finials.push({ x, y });
      }
    }

    // ---- the fixtures' models
    const mk = (geo: THREE.BufferGeometry, list: { x: number; y: number; h: number }[]) => {
      const b = new StaticBatch(geo, actorMaterial({ emitBoost: 2.4, envIntensity: 0.8 }), Math.max(1, list.length), { shadow: false });
      b.rim = [0, 0, 0, 0];
      for (const f of list) b.add(f.x, f.y, f.h, 0, 1.25);
      b.freeze();
      root.add(b.mesh);
      return b;
    };
    mk(sconceGeo(), this.sconces);
    mk(pendantGeo(), this.pendants);
    mk(capitalLampGeo(), this.capitals);
    mk(pictureLightGeo(), this.pictures);
    {
      const b = new StaticBatch(boomGeo(), actorMaterial({ emitBoost: 2.4, envIntensity: 0.6 }), 2, { shadow: true });
      b.rim = [0, 0, 0, 0];
      // the cans face the stage: the east boom is the west one turned round
      for (const bm of this.booms) b.add(bm.x, bm.y, 0, bm.flip > 0 ? -0.5 : Math.PI + 0.5, 1);
      b.freeze();
      root.add(b.mesh);
    }

    // ---- volumetric shafts under the hanging and standing lights
    const shafts: Shaft[] = [];
    for (const p of this.lamps) {
      if (p.kind === 'fh_chandelier') shafts.push({ x: p.x, y: p.y, h: 296, r: 150, col: [1, 0.64, 0.32], flicker: 0, k: p.x, kind: 'lamp', a: 0.9 });
      else shafts.push({ x: p.x, y: p.y, h: 118, r: 66, col: [1, 0.58, 0.3], flicker: 0, k: p.x, kind: 'lamp', a: 1 });
    }
    for (const f of this.pendants) shafts.push({ x: f.x, y: f.y, h: f.h - 12, r: 96, col: COLD, flicker: 0.05, k: f.seed, kind: 'light', a: 1.4 });
    this.shafts = new LightShafts(root, shafts);

    // ---- motes drifting in the warm and cold light
    this.motes = new Motes([
      ...this.lamps.map((p) => ({ x: p.x, y: p.y, col: [1, 0.66, 0.34] as RGB })),
      ...this.pendants.map((f) => ({ x: f.x, y: f.y, col: [0.7, 0.84, 1] as RGB })),
      ...this.capitals.filter((_, i) => i % 2 === 0).map((f) => ({ x: f.x, y: f.y, col: [1, 0.7, 0.4] as RGB })),
    ]);

    // ---- moonlight through the tall windows: panes on the maze's floor (west wall) and the gallery's (north)
    type Win = [number, number, number, number, number, number, number]; // x, y, size along x, along y, lean x, lean z, intensity
    const wins: Win[] = [
      ...[-1165, -715, -265, 185, 640].map((y): Win => [-2010, y, 220, 120, 0, 46, 1]),
      ...[-1690, -1140, -560].map((x): Win => [x, -1770, 120, 250, 70, 0, 0.7]),
    ];
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const iWin = new Float32Array(wins.length * 4);
    wins.forEach(([, , , , lx, lz, k], i) => { iWin[i * 4] = k; iWin[i * 4 + 1] = lx; iWin[i * 4 + 2] = lz; });
    geo.setAttribute('iWin', new THREE.InstancedBufferAttribute(iWin, 4));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uK: this.winK, uCol: { value: new THREE.Vector3(0.5, 0.64, 1.0) } },
      vertexShader: WINDOW_VERT,
      fragmentShader: WINDOW_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.windows = new THREE.InstancedMesh(geo, mat, wins.length);
    const m4 = new THREE.Matrix4();
    wins.forEach(([x, y, w, l], i) => {
      // the panes' far (arched) end points away from the wall the light comes through
      const west = w > l;
      m4.makeRotationY(west ? -Math.PI / 2 : Math.PI).scale(new THREE.Vector3(west ? l : w, 1, west ? w : l)).setPosition(x, 1.4, y);
      this.windows.setMatrixAt(i, m4);
    });
    this.windows.frustumCulled = false;
    this.windows.renderOrder = 4;
    root.add(this.windows);

    // ---- contact shade where every wall and panel meets the floor (the sides the camera can see)
    const strips: [number, number, number, number, number, number][] = []; // x, y, length, width, yaw, strength
    const shade = (p: Prop, w: number, k: number) => {
      const hw = p.hw ?? 0, hh = p.hh ?? 0;
      if (p.yaw) {
        for (const s of [-1, 1]) {
          const x = p.x + s * (hw + w / 2);
          if (Math.abs(x) < FH_HALF) strips.push([x, p.y, hh * 2, w, s > 0 ? Math.PI / 2 : -Math.PI / 2, k]); // not outside the house
        }
      } else if (p.y + hh + w / 2 < FH_HALF) strips.push([p.x, p.y + hh + w / 2, hw * 2, w, 0, k]);
    };
    for (const p of PROPS) {
      if (p.kind === 'fh_wall') shade(p, 60, 0.55);
      else if (p.kind === 'fh_mirror') shade(p, 38, 0.42);
    }
    for (const p of DOOR_PANELS) shade(p, 38, 0.42);
    const cgeo = new THREE.PlaneGeometry(1, 1);
    cgeo.rotateX(-Math.PI / 2);
    cgeo.setAttribute('iK', new THREE.InstancedBufferAttribute(new Float32Array(strips.map((s) => s[5])), 1));
    const contact = new THREE.InstancedMesh(cgeo, new THREE.ShaderMaterial({ vertexShader: CONTACT_VERT, fragmentShader: CONTACT_FRAG, transparent: true, depthWrite: false }), strips.length);
    strips.forEach(([x, y, len, w, yaw], i) => {
      m4.makeRotationY(yaw).scale(new THREE.Vector3(len, 1, w)).setPosition(x, 0.9, y);
      contact.setMatrixAt(i, m4);
    });
    contact.frustumCulled = false;
    contact.renderOrder = 4;
    root.add(contact);

    // ---- the theatre beams (aimed every frame at the drifting spots)
    const bgeo = new THREE.CylinderGeometry(0.06, 1, 1, 18, 1, true);
    bgeo.translate(0, -0.5, 0);
    this.beamCol = new THREE.InstancedBufferAttribute(new Float32Array(SPOTS.length * 4), 4).setUsage(THREE.DynamicDrawUsage) as THREE.InstancedBufferAttribute;
    bgeo.setAttribute('iCol', this.beamCol);
    this.beams = new THREE.InstancedMesh(bgeo, new THREE.ShaderMaterial({
      uniforms: { uViewDir: pool.uniforms.uViewDir },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }), SPOTS.length);
    this.beams.frustumCulled = false;
    this.beams.renderOrder = 4;
    root.add(this.beams);
    this.unreflected.push(this.windows, contact, this.beams, this.shafts.mesh);
  }

  /** Where spot i is on the stage at sim time `t`. */
  private spotAt(i: number, t: number): { x: number; y: number } {
    const ph = SPOTS[i].ph;
    return { x: STAGE.x + Math.sin(t * 0.23 + ph) * (STAGE.hw - 160), y: STAGE.y + Math.sin(t * 0.31 + ph * 1.7) * 50 };
  }

  /** Sconces along every wall face the camera sees, clear of doorways and of what hangs on the wall. */
  private placeSconces(): void {
    const hung = PROPS.filter((p) => p.kind === 'fh_poster' || p.kind === 'fh_clock' || p.kind === 'fh_face');
    const keepOut: [number, number, number, number?][] = []; // x, y, half-width along the wall, reach across it
    for (const p of hung) keepOut.push([p.x, p.y, p.kind === 'fh_face' ? 360 : p.kind === 'fh_clock' ? 70 : 72]);
    for (const p of UNREFLECTED.plinths) keepOut.push([p.x, -FH_HALF + 60, 110]);
    // where a wall running north-south meets the face
    for (const p of PROPS) if (p.kind === 'fh_wall' && p.yaw) keepOut.push([p.x, p.y, (p.hw ?? 20) + 40, (p.hh ?? 0) + 70]);
    keepOut.push([STAGE.x, -FH_HALF + 60, STAGE.hw + 90]); // the stage's backdrop covers the chamber's back wall
    for (const p of PROPS) {
      if (p.kind !== 'fh_wall' || p.yaw) continue;
      const style = p.style ?? 'deco';
      const face = p.y + (p.hh ?? 20);
      if (face > FH_HALF - 80) continue; // the outer south wall faces out of the house
      const H = WALL_H[style] ?? 200;
      const h = Math.round(H * 0.7);
      const x0 = p.x - (p.hw ?? 0) + 50, x1 = p.x + (p.hw ?? 0) - 50;
      if (x1 - x0 < 120) continue;
      const n = Math.max(1, Math.floor((x1 - x0) / 420) + 1);
      const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
      const placed: number[] = [];
      for (let i = 0; i < n; i++) {
        let x = n > 1 ? x0 + step * i : (x0 + x1) / 2;
        for (const [kx, ky, kw, kr = 60] of keepOut) {
          if (Math.abs(ky - face) > kr || Math.abs(x - kx) >= kw + 26) continue;
          x = x >= kx ? kx + kw + 30 : kx - kw - 30; // step aside, so the sconces flank it
        }
        if (x < x0 - 30 || x > x1 + 30) continue;
        if (keepOut.some(([kx, ky, kw, kr = 60]) => Math.abs(ky - face) <= kr && Math.abs(x - kx) < kw + 20)) continue;
        if (placed.some((q) => Math.abs(q - x) < 170)) continue;
        placed.push(x);
        this.sconces.push({ x, y: face + 22 * 1.25, h, seed: x * 1.7 + face });
      }
    }
  }

  /** Halos on every fixture in view (the light visibly comes from somewhere), and the theatre's booms. */
  update(g: Game, r: GameRenderer3D, inView: (x: number, y: number) => boolean): void {
    const t = r.time;
    const on = 1 - g.darkness * 0.92;
    const glow = (this.glowF ??= r.assets.atlas.get('fx_glow_0'));
    const G = r.glow;
    for (const f of this.sconces) {
      if (!inView(f.x, f.y)) continue;
      const fl = lampFlicker(f, t) * on;
      if (fl > 0.1) G.draw(glow, f.x, f.y + 16, f.h + 2, 0.62, 0.62, 0, 1, 0.62, 0.32, 0.5 * fl);
    }
    for (const f of this.pendants) {
      if (!inView(f.x, f.y)) continue;
      const fl = (0.96 + 0.04 * Math.sin(t * 1.3 + f.seed)) * on;
      G.draw(glow, f.x, f.y, f.h, 0.95, 0.95, 0, 0.62, 0.78, 1, 0.5 * fl);
    }
    for (const f of this.capitals) {
      if (!inView(f.x, f.y)) continue;
      const fl = lampFlicker(f, t) * on;
      if (fl > 0.1) G.draw(glow, f.x, f.y, f.h + 32, 0.7, 0.7, 0, 1, 0.64, 0.32, 0.5 * fl);
    }
    for (const f of this.pictures) if (inView(f.x, f.y)) G.draw(glow, f.x, f.y + 10, f.h, 0.6, 0.36, 0, 1, 0.86, 0.66, 0.4 * on);
    for (const bm of this.booms) {
      if (!inView(bm.x, bm.y)) continue;
      for (const h of [150, 210, 270]) G.draw(glow, bm.x + 15 * bm.flip, bm.y + 14, (h - 12) * 1, 0.4, 0.4, 0, 1, 0.9, 0.75, 0.45 * on);
    }
    for (const p of this.lamps) {
      if (!inView(p.x, p.y)) continue;
      const fl = lampFlicker(p, t) * on;
      if (fl <= 0.1) continue;
      if (p.kind === 'fh_chandelier') G.draw(glow, p.x, p.y, 312, 1.5, 1.5, 0, 1, 0.6, 0.3, 0.36 * fl);
      else G.draw(glow, p.x, p.y, 136, 0.8, 0.8, 0, 1, 0.6, 0.3, 0.45 * fl);
    }
    for (const f of this.finials) if (inView(f.x, f.y)) G.draw(glow, f.x, f.y, WALL_H.mirror + 8, 0.3, 0.3, 0, 1, 0.8, 0.55, 0.3 * on);
    // the beams: from each can, through the haze, to its spot
    const stage = inView(STAGE.x, STAGE.y) ? 1 : 0;
    SPOTS.forEach((s, i) => {
      const bm = this.booms[s.boom];
      const ax = bm.x + 15 * bm.flip, ay = bm.y + 14, ah = s.can - 12;
      const sp = this.spotAt(i, g.time);
      _d.set(sp.x - ax, -ah, sp.y - ay);
      const len = _d.length();
      _q.setFromUnitVectors(_down, _d.normalize());
      _m.compose(_p.set(ax, ah, ay), _q, _s.set(104, len, 104));
      this.beams.setMatrixAt(i, _m);
      this.beamCol.setXYZW(i, s.col[0], s.col[1], s.col[2], 0.17 * on * stage);
    });
    this.beams.instanceMatrix.needsUpdate = true;
    this.beamCol.needsUpdate = true;
    // moonlight isn't the house's to lose: it dims a little in the dark, never goes out
    this.winK.value = 0.24 * (1 - g.darkness * 0.5);
  }

  addLights(g: Game, time: number): void {
    const on = 1 - g.darkness * 0.92;
    for (const f of this.sconces) pool.add(f.x, f.y + 20, 250, 1.0 * lampFlicker(f, time) * on, WARM[0], WARM[1], WARM[2], f.h, 1);
    for (const f of this.pendants) pool.add(f.x, f.y, 270, 0.95 * on, COLD[0], COLD[1], COLD[2], f.h, 1.3);
    for (const f of this.capitals) pool.add(f.x, f.y, 300, 0.95 * lampFlicker(f, time) * on, 1, 0.64, 0.34, f.h + 24, 1);
    // museum spots on the plinths and theatre spots that drift across the stage: crisp discs from above
    for (const f of this.pictures) pool.add(f.tx, f.ty, 84, 1.25 * on, 1, 0.88, 0.7, 420, 2, 0.4);
    SPOTS.forEach((s, i) => {
      const p = this.spotAt(i, g.time);
      pool.add(p.x, p.y, 125, 1.5 * on, s.col[0], s.col[1], s.col[2], 500, 2, 0.12);
    });
  }
}
