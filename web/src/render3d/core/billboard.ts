// Camera-facing billboards and ground decals for the 2.5D view. They keep the 2D batches' drawing
// APIs (so the FX system, telegraphs and damage numbers port unchanged) but place quads in 3D:
// billboards stand at (x, height, y) facing the camera; decals lie on the ground plane.

import * as THREE from 'three';
import type { Frame } from '../../render/atlas';
import { ShapeBatch } from '../../render/shapes';
import { POOL_GLSL } from './pool';
import { pool } from './materials';

export type BatchMode = 'cutout' | 'alpha' | 'add';

/** Camera basis shared by every billboard material (set once per frame). */
export const camBasis = {
  uCamRight: { value: new THREE.Vector3(1, 0, 0) },
  uCamUp: { value: new THREE.Vector3(0, 0.64, -0.77) },
  uAmbient: { value: new THREE.Vector3(0.3, 0.3, 0.4) },
};

const VERT = /* glsl */ `
attribute vec4 iPos;   // x, y (sim ground), height, rotation
attribute vec4 iSize;  // w, h, anchor x, anchor y
attribute vec4 iUV;    // u0, v0(top), u1, v1(bottom)
attribute vec4 iTint;  // rgb multiplier, alpha
attribute vec4 iFx;    // flash rgb, flash amount
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uAmbient;
uniform float uLit;
uniform float uMinLight;
varying vec2 vUv;
varying vec4 vTint;
varying vec4 vFx;
varying vec3 vLight;
${POOL_GLSL}
void main() {
  float lx = (position.x + 0.5 - iSize.z) * iSize.x;
  float ly = ((0.5 - position.y) - iSize.w) * iSize.y;
  float c = cos(iPos.w), s = sin(iPos.w);
  vec2 q = vec2(lx * c - ly * s, lx * s + ly * c);
  vec3 wp = vec3(iPos.x, iPos.z, iPos.y) + uCamRight * q.x - uCamUp * q.y;
  vUv = vec2(mix(iUV.x, iUV.z, position.x + 0.5), mix(iUV.w, iUV.y, position.y + 0.5));
  vTint = iTint;
  vFx = iFx;
  vec3 L = uAmbient + poolLightFlat(wp) * 0.9;
  vLight = mix(vec3(1.0), max(L, vec3(uMinLight)), uLit);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uCutout;
varying vec2 vUv;
varying vec4 vTint;
varying vec4 vFx;
varying vec3 vLight;
void main() {
  vec4 t = texture2D(map, vUv);
  if (uCutout > 0.5) { if (t.a < 0.42) discard; }
  else if (t.a < 0.004) discard;
  vec3 col = t.rgb * vTint.rgb * vLight;
  col = mix(col, vFx.rgb, vFx.a);
  gl_FragColor = vec4(col, (uCutout > 0.5 ? 1.0 : t.a) * vTint.a);
}`;

export interface BillboardOpts { lit?: boolean; minLight?: number; depthTest?: boolean; order?: number }

export class BillboardBatch {
  mesh: THREE.InstancedMesh;
  private aPos: Float32Array;
  private aSize: Float32Array;
  private aUV: Float32Array;
  private aTint: Float32Array;
  private aFx: Float32Array;
  private attrs: THREE.InstancedBufferAttribute[];
  count = 0;
  readonly cap: number;
  material: THREE.ShaderMaterial;

  constructor(texture: THREE.Texture, cap: number, mode: BatchMode, opts: BillboardOpts = {}) {
    this.cap = cap;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aPos = new Float32Array(cap * 4);
    this.aSize = new Float32Array(cap * 4);
    this.aUV = new Float32Array(cap * 4);
    this.aTint = new Float32Array(cap * 4);
    this.aFx = new Float32Array(cap * 4);
    const mk = (arr: Float32Array, name: string) => {
      const a = new THREE.InstancedBufferAttribute(arr, 4);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      return a;
    };
    this.attrs = [mk(this.aPos, 'iPos'), mk(this.aSize, 'iSize'), mk(this.aUV, 'iUV'), mk(this.aTint, 'iTint'), mk(this.aFx, 'iFx')];
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        map: { value: texture },
        uCutout: { value: mode === 'cutout' ? 1 : 0 },
        uLit: { value: opts.lit === false ? 0 : 1 },
        uMinLight: { value: opts.minLight ?? 0.0 },
        ...camBasis,
        ...pool.uniforms,
      },
      transparent: mode !== 'cutout',
      depthWrite: mode === 'cutout',
      depthTest: opts.depthTest ?? true,
      blending: mode === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, cap);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.order ?? 0;
    this.mesh.count = 0;
  }

  begin(): void {
    this.count = 0;
  }

  /** Draw a frame standing at sim (x, y), `h` above the ground. Same argument order as the 2D batch. */
  draw(f: Frame, x: number, y: number, h: number, sx = 1, sy = 1, rot = 0, r = 1, g = 1, b = 1, a = 1, fr = 1, fg = 1, fb = 1, fa = 0): boolean {
    if (this.count >= this.cap) return false;
    const i = this.count * 4;
    const P = this.aPos, S = this.aSize, U = this.aUV, T = this.aTint, F = this.aFx;
    P[i] = x; P[i + 1] = y; P[i + 2] = h; P[i + 3] = rot;
    S[i] = f.w * sx; S[i + 1] = f.h * sy; S[i + 2] = f.ax; S[i + 3] = f.ay;
    U[i] = f.u0; U[i + 1] = f.v0; U[i + 2] = f.u1; U[i + 3] = f.v1;
    T[i] = r; T[i + 1] = g; T[i + 2] = b; T[i + 3] = a;
    F[i] = fr; F[i + 1] = fg; F[i + 2] = fb; F[i + 3] = fa;
    this.count++;
    return true;
  }

  end(): void {
    this.mesh.count = this.count;
    if (this.count === 0) return;
    for (const a of this.attrs) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.count * 4);
      a.needsUpdate = true;
    }
  }
}

/** Routes frames to the batch for their atlas page (same API as the 2D SpriteLayer). */
export class BillboardLayer {
  batches: BillboardBatch[] = [];
  constructor(textures: THREE.Texture[], cap: number, mode: BatchMode, opts: BillboardOpts = {}) {
    for (const t of textures) this.batches.push(new BillboardBatch(t, cap, mode, opts));
  }
  addTo(scene: THREE.Object3D): void {
    for (const b of this.batches) scene.add(b.mesh);
  }
  begin(): void {
    for (const b of this.batches) b.begin();
  }
  end(): void {
    for (const b of this.batches) b.end();
  }
  draw(f: Frame, x: number, y: number, h: number, sx = 1, sy = 1, rot = 0, r = 1, g = 1, b = 1, a = 1, fr = 1, fg = 1, fb = 1, fa = 0): boolean {
    return this.batches[f.atlas].draw(f, x, y, h, sx, sy, rot, r, g, b, a, fr, fg, fb, fa);
  }
  get count(): number {
    let n = 0;
    for (const b of this.batches) n += b.count;
    return n;
  }
}

const DECAL_VERT = /* glsl */ `
attribute vec4 color;
uniform float uLift;
varying vec4 vCol;
varying vec2 vWp;
void main() {
  vCol = color;
  vWp = position.xy;
  gl_Position = projectionMatrix * viewMatrix * vec4(position.x, uLift + position.z, position.y, 1.0);
}`;
const DECAL_FRAG = /* glsl */ `
varying vec4 vCol;
varying vec2 vWp;
#ifdef NC_HATCH
uniform float uTime, uHatch;
float dh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
#endif
void main() {
  vec4 c = vCol;
  #ifdef NC_HATCH
  // telegraph fills (D-49): caution stripes painted across the ground, crawling slowly, with a
  // scorched grain — an authored warning on the midway floor rather than a flat UI tint
  float st = fract((vWp.x + vWp.y) / uHatch - uTime * 0.35);
  float band = smoothstep(0.0, 0.08, st) * (1.0 - smoothstep(0.5, 0.58, st));
  float grain = 0.82 + 0.18 * dh(floor(vWp * 0.5));
  c.a *= mix(0.42, 1.0, band) * grain;
  c.rgb *= mix(0.75, 1.0, band);
  #endif
  gl_FragColor = c;
}`;

/** Ground-plane vector shapes (telegraphs, zones, rings, beams). `z` on the batch raises the layer. */
export class DecalBatch extends ShapeBatch {
  constructor(capVerts: number, additive: boolean, order: number, o: { lift?: number; depthTest?: boolean; hatch?: number; time?: THREE.IUniform } = {}) {
    super(capVerts, additive, order);
    const old = this.mesh.material as THREE.Material;
    old.dispose();
    this.mesh.material = new THREE.ShaderMaterial({
      vertexShader: DECAL_VERT,
      fragmentShader: DECAL_FRAG,
      uniforms: { uLift: { value: o.lift ?? 1.5 }, uHatch: { value: o.hatch ?? 24 }, uTime: o.time ?? { value: 0 } },
      defines: o.hatch ? { NC_HATCH: '' } : {},
      transparent: true,
      depthWrite: false,
      depthTest: o.depthTest ?? true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  }
}
