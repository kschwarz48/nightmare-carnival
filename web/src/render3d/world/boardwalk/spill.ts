// Light pouring out of openings (D-79). Players didn't see that the Arcade and the Gift Shop could be
// entered, and couldn't time the Undertow's brake with the train out of sight in its station; so:
// - every doorway of the two entered buildings glows with the light of the lamps inside it, and pours it out
//   across the boards in a fan that fades as it spreads (the doorway is the fixture you can see);
// - the station's two portals, where the track runs in and out, do the same with its work lamps;
// - the station's frosted windows on the promenade show the train's shadow crossing them as it comes home.
// Colours come from the interior lamps nearest each side of an opening, so a door between a cold machine
// and a warm one pours both. Nothing flickers: a slow breath at most.

import * as THREE from 'three';

type RGB = [number, number, number];

/** A doorway or portal: its centre on the wall line, the way out (unit normal), its width and its colours. */
export interface Opening {
  x: number;
  y: number;
  nx: number;
  ny: number;
  w: number;
  /** colours at the opening's two sides (left and right looking out) */
  a: RGB;
  b: RGB;
  /** how far the light reaches out across the floor */
  reach: number;
  /** height of the glow standing in the opening (0: none, e.g. a portal seen edge-on) */
  glowH: number;
  /** the building it belongs to (its doorway glow fades while the local player stands inside it) */
  building: string;
  /** a phase for its breath */
  ph: number;
}

/** A lamp inside a building (its pool), as the openings sample them for their colours. */
export interface InsideLamp { x: number; y: number; k: number; col: RGB; b: string }

/**
 * The colour of the light at a spot inside, from the lamps of that building near it (weighted by strength and,
 * steeply, by nearness, so the nearest lamp leads and a door between two pours each from its own side), at full
 * brightness and a touch richer than the mix (added light washes toward white): what an opening there pours out.
 */
export function insideColour(lamps: InsideLamp[], building: string, x: number, y: number): RGB {
  let r = 0, g = 0, b = 0;
  for (const L of lamps) {
    if (L.b !== building) continue;
    const w = L.k / (1 + (Math.hypot(L.x - x, L.y - y) / 160) ** 3);
    r += L.col[0] * w;
    g += L.col[1] * w;
    b += L.col[2] * w;
  }
  const m = Math.max(r, g, b) || 1;
  return [(r / m) ** 1.35, (g / m) ** 1.35, (b / m) ** 1.35];
}

const SPILL_VERT = /* glsl */ `
  attribute vec3 aColA;
  attribute vec3 aColB;
  attribute float aK;
  varying vec2 vUv;
  varying vec3 vColA;
  varying vec3 vColB;
  varying float vK;
  void main() {
    vUv = uv;
    vColA = aColA;
    vColB = aColB;
    vK = aK;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }`;
// the floor fan: brightest at the threshold, spreading and fading outward, softer at its sides, with faint
// streaks where the doorframe's edges cut the light
const FLOOR_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColA;
  varying vec3 vColB;
  varying float vK;
  void main() {
    float u = vUv.x, v = vUv.y;
    float side = 1.0 - smoothstep(0.62, 1.0, abs(u - 0.5) * 2.0);
    float fall = pow(clamp(1.0 - v, 0.0, 1.0), 1.7) * smoothstep(0.0, 0.08, v);
    float streak = 0.9 + 0.1 * cos((u - 0.5) * 28.0);
    float a = side * fall * streak * vK;
    gl_FragColor = vec4(mix(vColA, vColB, u) * a, a);
  }`;
// the opening itself, glowing: brightest low and in the middle (the lit floor beyond), fading up and out
const GLOW_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColA;
  varying vec3 vColB;
  varying float vK;
  void main() {
    float u = vUv.x, v = vUv.y;
    float side = 1.0 - smoothstep(0.55, 1.0, abs(u - 0.5) * 2.0);
    float a = side * (0.35 + 0.65 * pow(1.0 - v, 1.4)) * vK;
    gl_FragColor = vec4(mix(vColA, vColB, u) * a, a);
  }`;

function additive(frag: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SPILL_VERT,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** The floor fans and doorway glows of a list of openings, one mesh each (their strength set per frame). */
export class Spill {
  readonly openings: Opening[];
  private floor: THREE.Mesh;
  private glow: THREE.Mesh;
  private kFloor: THREE.BufferAttribute;
  private kGlow: THREE.BufferAttribute;

  constructor(root: THREE.Object3D, openings: Opening[]) {
    this.openings = openings;
    const quad = (pts: number[][], o: Opening) => ({ pts, o });
    const fans = openings.map((o) => {
      // across the opening: s = -1 is its left side looking out (colour a), s = 1 its right (colour b)
      const ax = -o.ny, ay = o.nx;
      const near = o.w / 2 - 6, far = o.w * 0.85, back = 26;
      const p = (s: number, d: number, half: number): number[] => [o.x + ax * half * s + o.nx * d, 1.2, o.y + ay * half * s + o.ny * d];
      return quad([p(-1, -back, near), p(1, -back, near), p(1, o.reach, far), p(-1, o.reach, far)], o);
    });
    const glows = openings.filter((o) => o.glowH > 0).map((o) => {
      const ax = -o.ny, ay = o.nx, half = o.w / 2 - 4;
      const p = (s: number, h: number): number[] => [o.x + ax * half * s - o.nx * 6, h, o.y + ay * half * s - o.ny * 6];
      return quad([p(-1, 0), p(1, 0), p(1, o.glowH), p(-1, o.glowH)], o);
    });
    const build = (qs: { pts: number[][]; o: Opening }[]) => {
      const pos: number[] = [], uv: number[] = [], ca: number[] = [], cb: number[] = [], k: number[] = [], idx: number[] = [];
      qs.forEach((q, i) => {
        for (const v of q.pts) pos.push(...v);
        uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        for (let j = 0; j < 4; j++) {
          ca.push(...q.o.a);
          cb.push(...q.o.b);
          k.push(0);
        }
        idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('aColA', new THREE.Float32BufferAttribute(ca, 3));
      geo.setAttribute('aColB', new THREE.Float32BufferAttribute(cb, 3));
      const kAttr = new THREE.Float32BufferAttribute(k, 1).setUsage(THREE.DynamicDrawUsage) as THREE.BufferAttribute;
      geo.setAttribute('aK', kAttr);
      geo.setIndex(idx);
      return { geo, kAttr };
    };
    const f = build(fans), g = build(glows);
    this.floor = new THREE.Mesh(f.geo, additive(FLOOR_FRAG));
    this.glow = new THREE.Mesh(g.geo, additive(GLOW_FRAG));
    this.kFloor = f.kAttr;
    this.kGlow = g.kAttr;
    for (const m of [this.floor, this.glow]) {
      m.frustumCulled = false;
      m.renderOrder = 4;
      root.add(m);
    }
  }

  /**
   * This frame's strength: `on` (lights out, dawn) and, per building, how far the local player's view has cut
   * into it (its doorway glows fade from the inside, where the camera looks down through the missing front).
   */
  update(t: number, on: number, cut: (building: string) => number): void {
    let fi = 0, gi = 0;
    for (const o of this.openings) {
      const breath = 0.94 + 0.06 * Math.sin(t * 1.1 + o.ph);
      const kf = 0.95 * on * breath;
      for (let j = 0; j < 4; j++) this.kFloor.setX(fi * 4 + j, kf);
      fi++;
      if (o.glowH > 0) {
        const kg = 0.65 * on * breath * (1 - cut(o.building));
        for (let j = 0; j < 4; j++) this.kGlow.setX(gi * 4 + j, kg);
        gi++;
      }
    }
    this.kFloor.needsUpdate = true;
    this.kGlow.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- the station's windows and the train's shadow
const WIN_VERT = /* glsl */ `
  varying vec3 vW;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const WIN_FRAG = /* glsl */ `
  uniform vec4 uCars[5];
  uniform vec3 uCol;
  uniform float uK;
  uniform float uTime;
  varying vec3 vW;
  varying vec2 vUv;
  float rbox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    // frosted glass lit from behind: brighter up under the lamps, breathing a little (never a flicker)
    float lamp = 0.74 + 0.26 * vUv.y;
    float breath = 0.95 + 0.05 * sin(uTime * 1.3 + vW.x * 0.013);
    // the train's shadow on the glass (x: along the façade, car.x its centre; car.y its base; z: how much of it
    // is inside; w: the lead car). The cars run empty; their shadows carry a rider in every seat.
    float shade = 0.0;
    for (int i = 0; i < 5; i++) {
      vec4 c = uCars[i];
      if (c.z <= 0.001) continue;
      vec2 p = vec2(vW.x - c.x, vW.y - c.y) / 1.55;
      float d = rbox(p - vec2(0.0, 11.0), vec2(31.0, 11.0), 5.0);
      if (c.w > 0.5) {
        d = min(d, length((p - vec2(-36.0, 24.0)) / vec2(13.0, 17.0)) * 13.0 - 13.0);
      } else {
        d = min(d, length(p - vec2(-9.0, 33.0)) - 6.5);
        d = min(d, length(p - vec2(13.0, 33.0)) - 6.5);
        d = min(d, rbox(p - vec2(-15.0, 40.0), vec2(2.2, 10.0), 1.5));
        d = min(d, rbox(p - vec2(19.0, 41.0), vec2(2.2, 10.0), 1.5));
      }
      shade = max(shade, c.z * (1.0 - smoothstep(-2.5, 2.5, d)));
    }
    gl_FragColor = vec4(uCol * 0.85 * lamp * breath * (1.0 - 0.93 * shade) * uK, 1.0);
  }`;

/** A window on the station's front: its centre along the façade, its width, sill and head heights, its plane. */
export interface Pane { x: number; w: number; h0: number; h1: number; z: number }

export class StationWindows {
  private mat: THREE.ShaderMaterial;
  private cars: THREE.Vector4[];

  constructor(root: THREE.Object3D, panes: Pane[], col: RGB) {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    panes.forEach((p, i) => {
      pos.push(p.x - p.w / 2, p.h0, p.z, p.x + p.w / 2, p.h0, p.z, p.x + p.w / 2, p.h1, p.z, p.x - p.w / 2, p.h1, p.z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.cars = Array.from({ length: 5 }, () => new THREE.Vector4());
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uCars: { value: this.cars }, uCol: { value: new THREE.Vector3(...col) }, uK: { value: 1 }, uTime: { value: 0 } },
      vertexShader: WIN_VERT,
      fragmentShader: WIN_FRAG,
    });
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.frustumCulled = false;
    root.add(mesh);
  }

  /** This frame: the cars (x, shadow base height, how much inside 0..1, lead) and the lamps' strength. */
  update(t: number, on: number, cars: [number, number, number, boolean][]): void {
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uK.value = 0.2 + 0.8 * on;
    for (let i = 0; i < this.cars.length; i++) {
      const c = cars[i];
      if (c) this.cars[i].set(c[0], c[1], c[2], c[3] ? 1 : 0);
      else this.cars[i].set(0, 0, 0, 0);
    }
  }
}
