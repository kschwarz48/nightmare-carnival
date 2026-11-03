// Practical-light pool (D-36). The carnival has dozens of bulbs, lamps and signs; rather than dozens
// of THREE point lights, the nearest/strongest POOL_MAX are packed into shared uniforms that every
// world shader (actors, props, ground, mist, billboards) evaluates with the same falloff — so fog,
// ground and models all agree about where the light is. Flicker and colour are per light.
//
// Falloff (D-46): a windowed inverse-square — bright and concentrated under the source, quickly
// darker, with a soft tail to zero at the radius — so every pool reads as coming from its lamp and
// the spaces between lamps stay dark. A light may instead be a theatre spot (`hard` > 0): a crisp
// disc of light cast from high above, used for the searchlights and boss stage lights.
//
// Tiled culling (engineering optimization pass): a light only reaches as far as its radius, so each
// frame the CPU marks, on a 32×32 grid over the lit area round the camera, which lights can touch each
// tile (24 bits a tile, packed in a tiny texture). A fragment looks its tile up and evaluates only
// those lights: the picture is the same, but a crowd lit by a full pool no longer pays for all 24
// lights at every pixel. Anything outside the grid (far scenery, reflections) evaluates them all.

import * as THREE from 'three';
import { LEGACY } from '../../core/flags';

export const POOL_MAX = 24;
/** tiles per side of the culling grid */
const TILES = 32;

export const POOL_GLSL = /* glsl */ `
uniform vec4 uPoolA[${POOL_MAX}];  // x, height, z, radius
uniform vec4 uPoolB[${POOL_MAX}];  // rgb × intensity, spot hardness (0 = point falloff)
uniform int uPoolN;
uniform vec3 uViewDir;             // world-space direction towards the (orthographic) camera
uniform sampler2D uPoolTiles;      // per tile: which lights can reach it (24 bits in RGB)
uniform vec4 uPoolTileRect;        // grid origin x, z and tiles per unit along x, z
const float POOL_CONC = 6.0;
uint poolMask(vec3 wp) {
  vec2 t = (wp.xz - uPoolTileRect.xy) * uPoolTileRect.zw;
  if (t.x < 0.0 || t.y < 0.0 || t.x >= ${TILES}.0 || t.y >= ${TILES}.0) return 0xFFFFFFu;
  uvec3 b = uvec3(texelFetch(uPoolTiles, ivec2(t), 0).rgb * 255.0 + 0.5);
  return b.r | (b.g << 8u) | (b.b << 16u);
}
float poolFall(vec4 A, float hard, vec3 wp, float d2) {
  if (hard > 0.0) return 1.0 - smoothstep(1.0 - hard, 1.0, length(A.xz - wp.xz) / A.w);
  float x = d2 / (A.w * A.w);
  if (x >= 1.0) return 0.0;
  float k = 1.0 - x;
  // normalised so the ground right under the source keeps its brightness; the pool tightens around it
  float x0 = min(A.y * A.y / (A.w * A.w), 1.0);
  return k * k * 1.25 * (1.0 + POOL_CONC * x0) / (1.0 + POOL_CONC * x);
}
vec3 poolLight(vec3 wp, vec3 wn, float shin, inout vec3 spec) {
  vec3 acc = vec3(0.0);
  uint m = poolMask(wp);
  for (int i = 0; i < ${POOL_MAX}; i++) {
    if (i >= uPoolN) break;
    if ((m & (1u << uint(i))) == 0u) continue;
    vec4 A = uPoolA[i];
    vec3 L = A.xyz - wp;
    float d2 = dot(L, L);
    float k = poolFall(A, uPoolB[i].w, wp, d2);
    if (k <= 0.0) continue;
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
  uint m = poolMask(wp);
  for (int i = 0; i < ${POOL_MAX}; i++) {
    if (i >= uPoolN) break;
    if ((m & (1u << uint(i))) == 0u) continue;
    vec4 A = uPoolA[i];
    vec3 L = A.xyz - wp;
    acc += uPoolB[i].rgb * poolFall(A, uPoolB[i].w, wp, dot(L, L));
  }
  return acc;
}`;

interface Cand { x: number; y: number; h: number; r: number; i: number; cr: number; cg: number; cb: number; hard: number; score: number }

export class PoolLights {
  readonly a: THREE.Vector4[] = [];
  readonly b: THREE.Vector4[] = [];
  readonly uniforms: { uPoolA: THREE.IUniform; uPoolB: THREE.IUniform; uPoolN: THREE.IUniform; uViewDir: THREE.IUniform; uPoolTiles: THREE.IUniform; uPoolTileRect: THREE.IUniform };
  /** the culling grid: per tile, the bits of the lights that reach it */
  private tileData = new Uint8Array(TILES * TILES * 4);
  private tiles = new THREE.DataTexture(this.tileData, TILES, TILES, THREE.RGBAFormat, THREE.UnsignedByteType);
  private cands: Cand[] = [];
  private order: Cand[] = [];
  private nc = 0;
  private cx = 0;
  private cy = 0;
  private reach = 2000;
  /** Global multiplier (Lights Out, dawn). */
  scale = 1;
  /** the world tier's colour family for every practical light (D-97, render3d/tierLook.ts): each light's colour goes
   *  toward its luminance times (r, g, b) by k, brightened by boost, flickering like fire or breathing by flicker */
  tint = { r: 1, g: 1, b: 1, k: 0, boost: 1, flicker: 0, time: 0 };
  /** A/B switch for the benchmarks: evaluate every light everywhere, as before the tiled culling. */
  cullOff = LEGACY.tiles;

  constructor() {
    for (let i = 0; i < POOL_MAX; i++) {
      this.a.push(new THREE.Vector4());
      this.b.push(new THREE.Vector4());
    }
    for (let i = 0; i < 160; i++) this.cands.push({ x: 0, y: 0, h: 0, r: 0, i: 0, cr: 0, cg: 0, cb: 0, hard: 0, score: 0 });
    this.tiles.minFilter = this.tiles.magFilter = THREE.NearestFilter;
    this.tiles.generateMipmaps = false;
    this.tiles.needsUpdate = true;
    this.uniforms = {
      uPoolA: { value: this.a },
      uPoolB: { value: this.b },
      uPoolN: { value: 0 },
      uViewDir: { value: new THREE.Vector3(0, 0.77, 0.64) },
      uPoolTiles: { value: this.tiles },
      // until the first frame the grid lies far away, so every fragment evaluates every light
      uPoolTileRect: { value: new THREE.Vector4(1e9, 1e9, 1, 1) },
    };
  }

  /** Start a frame; lights farther than `reach` (plus their radius) from (cx, cy) are ignored. */
  begin(cx: number, cy: number, reach: number): void {
    this.nc = 0;
    this.cx = cx;
    this.cy = cy;
    this.reach = reach;
  }

  /**
   * Same signature as the old 2D light rig (sim x/y, radius, intensity, colour) plus a height, a
   * selection priority and, for theatre spots, the edge hardness of the disc (0 = point light).
   */
  add(x: number, y: number, r: number, intensity: number, cr: number, cg: number, cb: number, h = 110, priority = 1, hard = 0): void {
    if (intensity <= 0.002 || this.nc >= this.cands.length) return;
    const d = Math.hypot(x - this.cx, y - this.cy) - r;
    if (d > this.reach) return;
    const c = this.cands[this.nc++];
    c.x = x; c.y = y; c.h = h; c.r = r; c.i = intensity; c.cr = cr; c.cg = cg; c.cb = cb; c.hard = hard;
    c.score = (intensity * r * priority) / (200 + Math.max(0, d));
  }

  end(): void {
    // sort the candidates in place (no per-frame allocation)
    const list = this.order;
    list.length = 0;
    for (let k = 0; k < this.nc; k++) list.push(this.cands[k]);
    list.sort((p, q) => q.score - p.score);
    const n = Math.min(POOL_MAX, list.length);
    for (let k = 0; k < n; k++) {
      const c = list[k];
      // fade the weakest selected lights so swapping in/out of the pool never pops
      const fade = n === POOL_MAX && k >= POOL_MAX - 4 ? (POOL_MAX - k) / 5 : 1;
      let i = c.i * this.scale * fade;
      let cr = c.cr, cg = c.cg, cb = c.cb;
      const t = this.tint;
      if (t.k > 0) {
        const l = cr * 0.3 + cg * 0.59 + cb * 0.11;
        cr = (cr + (l * t.r - cr) * t.k) * t.boost;
        cg = (cg + (l * t.g - cg) * t.k) * t.boost;
        cb = (cb + (l * t.b - cb) * t.k) * t.boost;
        if (t.flicker > 0 && c.hard === 0) {
          const ph = (c.x * 0.013 + c.y * 0.007) % 6.283;
          i *= 1 - t.flicker * (0.5 + 0.5 * Math.sin(t.time * 6.3 + ph) * Math.sin(t.time * 2.1 + ph * 1.7));
        }
      }
      this.a[k].set(c.x, c.h, c.y, c.r);
      this.b[k].set(cr * i, cg * i, cb * i, c.hard);
    }
    this.uniforms.uPoolN.value = n;
    this.cull(n);
  }

  /** Mark, tile by tile, which of the `n` selected lights can reach it (a light's disc on the ground). */
  private cull(n: number): void {
    if (this.cullOff) {
      (this.uniforms.uPoolTileRect.value as THREE.Vector4).set(1e9, 1e9, 1, 1);
      return;
    }
    const d = this.tileData;
    d.fill(0);
    const half = this.reach;
    const x0 = this.cx - half, z0 = this.cy - half;
    const per = TILES / (half * 2); // tiles per world unit
    for (let k = 0; k < n; k++) {
      const A = this.a[k];
      const r = A.w;
      const tx0 = Math.max(0, Math.floor((A.x - r - x0) * per)), tx1 = Math.min(TILES - 1, Math.floor((A.x + r - x0) * per));
      const tz0 = Math.max(0, Math.floor((A.z - r - z0) * per)), tz1 = Math.min(TILES - 1, Math.floor((A.z + r - z0) * per));
      if (tx0 > tx1 || tz0 > tz1) continue;
      const byte = k >> 3, bit = 1 << (k & 7);
      for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) d[(tz * TILES + tx) * 4 + byte] |= bit;
    }
    (this.uniforms.uPoolTileRect.value as THREE.Vector4).set(x0, z0, per, per);
    this.tiles.needsUpdate = true;
  }
}
