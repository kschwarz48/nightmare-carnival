// Practical-light pool (D-36). The carnival has dozens of bulbs, lamps and signs; rather than dozens
// of THREE point lights, the nearest/strongest POOL_MAX are packed into shared uniforms that every
// world shader (actors, props, ground, mist, billboards) evaluates with the same falloff — so fog,
// ground and models all agree about where the light is. Flicker and colour are per light.

import * as THREE from 'three';

export const POOL_MAX = 24;

export const POOL_GLSL = /* glsl */ `
uniform vec4 uPoolA[${POOL_MAX}];  // x, height, z, radius
uniform vec4 uPoolB[${POOL_MAX}];  // rgb × intensity, unused
uniform int uPoolN;
uniform vec3 uViewDir;             // world-space direction towards the (orthographic) camera
vec3 poolLight(vec3 wp, vec3 wn, float shin, inout vec3 spec) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${POOL_MAX}; i++) {
    if (i >= uPoolN) break;
    vec4 A = uPoolA[i];
    vec3 L = A.xyz - wp;
    float d2 = dot(L, L);
    float k = 1.0 - d2 / (A.w * A.w);
    if (k <= 0.0) continue;
    k *= k;
    vec3 Ld = L * inversesqrt(max(d2, 1.0));
    float lam = pow(max(dot(wn, Ld) * 0.6 + 0.4, 0.0), 1.4); // soft wrap: light spills round forms
    vec3 c = uPoolB[i].rgb * k;
    acc += c * lam;
    vec3 H = normalize(Ld + uViewDir);
    spec += c * pow(max(dot(wn, H), 0.0), shin);
  }
  return acc;
}
vec3 poolLightFlat(vec3 wp) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${POOL_MAX}; i++) {
    if (i >= uPoolN) break;
    vec4 A = uPoolA[i];
    vec3 L = A.xyz - wp;
    float k = 1.0 - dot(L, L) / (A.w * A.w);
    if (k <= 0.0) continue;
    acc += uPoolB[i].rgb * (k * k);
  }
  return acc;
}`;

interface Cand { x: number; y: number; h: number; r: number; i: number; cr: number; cg: number; cb: number; score: number }

export class PoolLights {
  readonly a: THREE.Vector4[] = [];
  readonly b: THREE.Vector4[] = [];
  readonly uniforms: { uPoolA: THREE.IUniform; uPoolB: THREE.IUniform; uPoolN: THREE.IUniform; uViewDir: THREE.IUniform };
  private cands: Cand[] = [];
  private nc = 0;
  private cx = 0;
  private cy = 0;
  private reach = 2000;
  /** Global multiplier (Lights Out, dawn). */
  scale = 1;

  constructor() {
    for (let i = 0; i < POOL_MAX; i++) {
      this.a.push(new THREE.Vector4());
      this.b.push(new THREE.Vector4());
    }
    for (let i = 0; i < 160; i++) this.cands.push({ x: 0, y: 0, h: 0, r: 0, i: 0, cr: 0, cg: 0, cb: 0, score: 0 });
    this.uniforms = {
      uPoolA: { value: this.a },
      uPoolB: { value: this.b },
      uPoolN: { value: 0 },
      uViewDir: { value: new THREE.Vector3(0, 0.77, 0.64) },
    };
  }

  /** Start a frame; lights farther than `reach` (plus their radius) from (cx, cy) are ignored. */
  begin(cx: number, cy: number, reach: number): void {
    this.nc = 0;
    this.cx = cx;
    this.cy = cy;
    this.reach = reach;
  }

  /** Same signature as the old 2D light rig (sim x/y, radius, intensity, colour) plus a height. */
  add(x: number, y: number, r: number, intensity: number, cr: number, cg: number, cb: number, h = 110, priority = 1): void {
    if (intensity <= 0.002 || this.nc >= this.cands.length) return;
    const d = Math.hypot(x - this.cx, y - this.cy) - r;
    if (d > this.reach) return;
    const c = this.cands[this.nc++];
    c.x = x; c.y = y; c.h = h; c.r = r; c.i = intensity; c.cr = cr; c.cg = cg; c.cb = cb;
    c.score = (intensity * r * priority) / (200 + Math.max(0, d));
  }

  end(): void {
    const list = this.cands.slice(0, this.nc).sort((p, q) => q.score - p.score);
    const n = Math.min(POOL_MAX, list.length);
    for (let k = 0; k < n; k++) {
      const c = list[k];
      // fade the weakest selected lights so swapping in/out of the pool never pops
      const fade = n === POOL_MAX && k >= POOL_MAX - 4 ? (POOL_MAX - k) / 5 : 1;
      const i = c.i * this.scale * fade;
      this.a[k].set(c.x, c.h, c.y, c.r);
      this.b[k].set(c.cr * i, c.cg * i, c.cb * i, 0);
    }
    this.uniforms.uPoolN.value = n;
  }
}
