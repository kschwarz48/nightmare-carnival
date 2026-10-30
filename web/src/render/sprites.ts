// Instanced sprite batches. One InstancedMesh per (layer, atlas texture) with per-instance
// position/rotation/size/anchor/UV/tint/flash attributes, refilled every frame without allocation.
// World coordinates are y-down (sim space); the shader flips to Three.js y-up.

import * as THREE from 'three';
import type { Frame } from './atlas';
import { LIGHT_GLSL, type LightRig } from './lights';

export type BatchMode = 'cutout' | 'alpha' | 'add';

const VERT = /* glsl */ `
attribute vec4 iPos;   // x, y (sim y-down), z depth, rotation
attribute vec4 iSize;  // w, h, anchor x, anchor y
attribute vec4 iUV;    // u0, v0(top), u1, v1(bottom)
attribute vec4 iTint;  // rgb multiplier, alpha
attribute vec4 iFx;    // flash rgb, flash amount
uniform float uLit;
uniform float uMinLight;
varying vec2 vUv;
varying vec4 vTint;
varying vec4 vFx;
varying vec3 vLight;
${LIGHT_GLSL}
void main() {
  float lx = (position.x + 0.5 - iSize.z) * iSize.x;
  float ly = ((0.5 - position.y) - iSize.w) * iSize.y;
  float c = cos(iPos.w), s = sin(iPos.w);
  vec2 wp = vec2(iPos.x + lx * c - ly * s, iPos.y + lx * s + ly * c);
  vUv = vec2(mix(iUV.x, iUV.z, position.x + 0.5), mix(iUV.w, iUV.y, position.y + 0.5));
  vTint = iTint;
  vFx = iFx;
  vec3 L = lightAt(wp);
  vLight = mix(vec3(1.0), max(L, vec3(uMinLight)), uLit);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp.x, -wp.y, iPos.z, 1.0);
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

export class SpriteBatch {
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

  constructor(texture: THREE.Texture, cap: number, mode: BatchMode, lights: LightRig, opts: { lit?: boolean; minLight?: number; depthTest?: boolean; order?: number } = {}) {
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
        ...lights.uniforms,
      },
      transparent: mode !== 'cutout',
      depthWrite: mode === 'cutout',
      depthTest: opts.depthTest ?? mode === 'cutout',
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

  /**
   * Draw a frame at world (x, y). `sx/sy` scale the frame's world size (negative sx flips).
   * Returns false if the batch is full.
   */
  draw(f: Frame, x: number, y: number, z: number, sx = 1, sy = 1, rot = 0, r = 1, g = 1, b = 1, a = 1, fr = 1, fg = 1, fb = 1, fa = 0): boolean {
    if (this.count >= this.cap) return false;
    const i = this.count * 4;
    const P = this.aPos, S = this.aSize, U = this.aUV, T = this.aTint, F = this.aFx;
    P[i] = x; P[i + 1] = y; P[i + 2] = z; P[i + 3] = rot;
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

/**
 * A layer that routes frames to the batch matching the frame's atlas page.
 */
export class SpriteLayer {
  batches: SpriteBatch[] = [];
  constructor(textures: THREE.Texture[], cap: number, mode: BatchMode, lights: LightRig, opts: { lit?: boolean; minLight?: number; depthTest?: boolean; order?: number } = {}) {
    for (const t of textures) this.batches.push(new SpriteBatch(t, cap, mode, lights, opts));
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
  draw(f: Frame, x: number, y: number, z: number, sx = 1, sy = 1, rot = 0, r = 1, g = 1, b = 1, a = 1, fr = 1, fg = 1, fb = 1, fa = 0): boolean {
    return this.batches[f.atlas].draw(f, x, y, z, sx, sy, rot, r, g, b, a, fr, fg, fb, fa);
  }
  get count(): number {
    let n = 0;
    for (const b of this.batches) n += b.count;
    return n;
  }
  setMinLight(v: number): void {
    for (const b of this.batches) b.material.uniforms.uMinLight.value = v;
  }
}
