// The Boardwalk's sea (D-68): the map's graphical centrepiece. A displaced grid that follows the camera
// (snapped to its cells so the surface never swims), carrying a sum of directional Gerstner waves that all
// come in at an angle and calm down as they reach the beach; two scales of a tiling normal map baked at boot
// for chop; Schlick fresnel against a procedural night sky; a moon glitter path; the park's practical lights
// reflected as long broken streaks; blue-black deep water that lightens and clears over the sand; breakers
// that turn to foam where it shallows; a swash that runs up the beach and drains back (the floor reads the
// same swash for its wet sheen); the pier's shadow on the water; and, now and then, something vast passing
// underneath. One draw call, no extra scene pass.

import * as THREE from 'three';
import { PIER_DECKS, RETREAT, TIDE, tideRise } from '../../../data/boardwalk';
import { POOL_GLSL, POOL_MAX } from '../../core/pool';
import { MIST_GLSL, pool, shared } from '../../core/materials';

/** The waterline and the swash, shared by the sea and the beach so they always agree (D-68). */
export const SHORE_GLSL = /* glsl */ `
uniform float uShoreOff;
uniform float uSeaTime;
float shoreAt(float x) { return 1150.0 + 70.0 * sin(x * 0.00105 + 0.6) + 35.0 * sin(x * 0.0029 + 2.1) + uShoreOff; }
// breakers come in at an angle every few seconds; each one runs up the sand and drains back
const vec2 SURF_DIR = vec2(0.33, -0.944);
// the phase grows toward the shore and falls with time, so each breaker travels in to the beach; the crests
// bend and wander (a slow warp along their length), so no two are ruled straight
float surfPhase(vec2 xz) {
  float bend = sin(xz.x * 0.0021 + 1.3) * 0.32 + sin(xz.x * 0.0057 - xz.y * 0.0011 + uSeaTime * 0.05) * 0.14;
  return dot(SURF_DIR, xz) / 300.0 - uSeaTime / 7.0 + bend;
}
float swashAt(vec2 xz) {
  float f = fract(-surfPhase(xz) + 0.5);
  // a quick run up the beach, a slow drain back
  return f < 0.3 ? smoothstep(0.0, 0.3, f) : 1.0 - smoothstep(0.3, 1.0, f);
}`;

/** Bake a tiling texture: rg = surface normal (xz), b = foam cells, a = height. */
function bakeWaterTexture(size = 256): THREE.DataTexture {
  const H = new Float32Array(size * size);
  // periodic value noise, summed over octaves whose periods divide the texture, so it tiles
  const hash = (x: number, y: number, s: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const vnoise = (u: number, v: number, period: number, seed: number) => {
    const x = u * period, y = v * period;
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const w = (a: number) => ((a % period) + period) % period;
    const a = hash(w(ix), w(iy), seed), b = hash(w(ix + 1), w(iy), seed), c = hash(w(ix), w(iy + 1), seed), d = hash(w(ix + 1), w(iy + 1), seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let h = 0, amp = 1, tot = 0;
      for (const [p, s] of [[4, 1], [8, 2], [16, 3], [32, 4], [64, 5]] as [number, number][]) {
        // ridged a little: wind chop has sharper crests than troughs
        const n = vnoise(u, v, p, s);
        h += amp * (1 - Math.abs(n * 2 - 1));
        tot += amp;
        amp *= 0.55;
      }
      H[y * size + x] = h / tot;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 6;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 6;
      // foam cells: the distance to the nearest of a few jittered points per cell (periodic Worley)
      const P = 12;
      const fu = (x / size) * P, fv = (y / size) * P;
      const cx = Math.floor(fu), cy = Math.floor(fv);
      let md = 9;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i, gy = cy + j;
          const wx = ((gx % P) + P) % P, wy = ((gy % P) + P) % P;
          const px = gx + hash(wx, wy, 9), py = gy + hash(wx, wy, 11);
          md = Math.min(md, Math.hypot(px - fu, py - fv));
        }
      }
      const o = (y * size + x) * 4;
      data[o] = Math.max(0, Math.min(255, Math.round((dx * 0.5 + 0.5) * 255)));
      data[o + 1] = Math.max(0, Math.min(255, Math.round((dy * 0.5 + 0.5) * 255)));
      data[o + 2] = Math.round(Math.min(1, md) * 255);
      data[o + 3] = Math.round(at(x, y) * 255);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

let sharedTex: THREE.DataTexture | null = null;
/** The baked water texture (also used by the shore's foam and the piling rings). */
export function waterTexture(): THREE.DataTexture {
  return (sharedTex ??= bakeWaterTexture());
}

const VERT = /* glsl */ `
uniform vec2 uOrigin;
uniform vec4 uWaveA[6];
uniform float uWaveN;
uniform float uSteep;
varying vec3 vW;
varying vec3 vGN;
varying float vDepth;
varying float vCrest;
${SHORE_GLSL}
#include <fog_pars_vertex>
void main() {
  vec3 p = position + vec3(uOrigin.x, 0.0, uOrigin.y);
  float d = p.z - shoreAt(p.x);
  // waves shoal and calm as they reach the beach (the breakers take over there)
  float att = smoothstep(-60.0, 360.0, d);
  vec3 disp = vec3(0.0);
  vec3 N = vec3(0.0, 1.0, 0.0);
  float sumA = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uWaveN) break;
    vec4 w = uWaveA[i];
    vec2 D = normalize(w.xy);
    float k = 6.2831853 / w.w;
    float c = sqrt(327.0 / k) * 0.55;
    float A = w.z * att;
    float f = k * (dot(D, p.xz) - c * uSeaTime);
    float Q = uSteep / (k * max(w.z, 0.001) * uWaveN);
    float cf = cos(f), sf = sin(f);
    disp.x += Q * A * D.x * cf;
    disp.z += Q * A * D.y * cf;
    disp.y += A * sf;
    float WA = k * A;
    N.x -= D.x * WA * cf;
    N.z -= D.y * WA * cf;
    N.y -= Q * WA * sf;
    sumA += w.z;
  }
  // the surface sits a little lower offshore, so the pier stands above it on its pilings
  float base = -clamp((d - 300.0) * 0.12, 0.0, 40.0);
  vec3 wp = p + disp;
  wp.y += base;
  vW = wp;
  vGN = N;
  vDepth = d;
  vCrest = disp.y / max(sumA, 0.001);
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec3 uMoonDir;
uniform vec3 uMoonCol;
uniform float uMoonPathX;
uniform float uCamZ;
uniform vec3 uDeep, uMid, uShallow, uFoam;
uniform float uQuality;
uniform vec4 uBeast;
uniform vec4 uDeck[5];
uniform vec2 uShadowOff;
varying vec3 vW;
varying vec3 vGN;
varying float vDepth;
varying float vCrest;
${SHORE_GLSL}
${POOL_GLSL}
${MIST_GLSL}
#include <fog_pars_fragment>

vec3 nightSky(vec3 R) {
  float h = clamp(R.y, 0.0, 1.0);
  vec3 c = mix(vec3(0.05, 0.055, 0.08), vec3(0.008, 0.013, 0.028), smoothstep(0.0, 0.75, h));
  // the park's glow low in the sky behind the boardwalk
  c += vec3(0.32, 0.17, 0.07) * exp(-h * 7.0) * 0.28;
  float m = max(dot(R, uMoonDir), 0.0);
  c += uMoonCol * (pow(m, 1200.0) * 5.0 + pow(m, 60.0) * 0.16 + pow(m, 8.0) * 0.03);
  return c;
}

void main() {
  vec2 xz = vW.xz;
  float swash = swashAt(xz);
  // the water's edge runs up the sand with each breaker and drains back
  float edge = vDepth + swash * 70.0 - 20.0;
  if (edge < -30.0) discard;
  // the pier's decks are solid: a crest never washes up through the planks (below them it shows in the gaps)
  for (int i = 0; i < 5; i++) {
    vec4 r = uDeck[i];
    if (min(min(xz.x - r.x, r.z - xz.x), min(xz.y - r.y, r.w - xz.y)) > 1.0 && vW.y > -6.0) discard;
  }
  // ---- normals: the Gerstner sum, then three scales of baked chop in crossing directions
  vec3 tA = texture2D(uTex, xz * 0.0019 + uSeaTime * vec2(0.0035, -0.0085)).xyz;
  vec3 tB = texture2D(uTex, mat2(0.8, -0.6, 0.6, 0.8) * xz * 0.0051 + uSeaTime * vec2(-0.0105, -0.0062)).xyz;
  vec3 tC = texture2D(uTex, mat2(0.6, 0.8, -0.8, 0.6) * xz * 0.0142 + uSeaTime * vec2(0.018, -0.023)).xyz;
  vec2 dn = (tA.xy * 2.0 - 1.0) * 0.6 + (tB.xy * 2.0 - 1.0) * 0.42;
  if (uQuality > 1.5) dn += (tC.xy * 2.0 - 1.0) * 0.3;
  float calm = 0.35 + 0.65 * smoothstep(0.0, 320.0, vDepth);
  vec3 n = normalize(vec3(vGN.x + dn.x * 1.15 * calm, vGN.y, vGN.z + dn.y * 1.15 * calm));
  vec3 V = normalize(uViewDir);
  vec3 Lm0 = normalize(vec3(0.0, 0.574, -0.819));
  float NdV = max(dot(n, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
  vec3 R = reflect(-V, n);
  // ---- the body of the water: blue-black offshore, clearer and greener over the sand
  float dk = smoothstep(0.0, 560.0, vDepth);
  vec3 body = mix(uShallow, uDeep, dk);
  body = mix(body, uMid, 0.4 * (1.0 - abs(dk - 0.45) * 1.8));
  float crest = clamp(vCrest * 0.5 + 0.5, 0.0, 1.0);
  float moonUp = max(dot(n, uMoonDir), 0.0);
  // light through the crests facing the moon (a cold subsurface lift)
  body += vec3(0.015, 0.045, 0.05) * pow(crest, 3.0) * (0.4 + 0.6 * moonUp);
  vec3 col = body * (0.45 + 0.55 * moonUp);
  col = mix(col, nightSky(R), fres);
  // ---- the moon's glitter: a broken column on the water toward the moon. The camera looks down steeply,
  // so the glints come from facets tilted well away from flat water (a low virtual moon), and only a few
  float sheen = pow(max(dot(n, normalize(Lm0 + V)), 0.0), 90.0) * 0.05;
  vec3 Lm = normalize(vec3(0.0, 0.24, -0.97));
  vec3 Hm = normalize(Lm + V);
  float nh = max(dot(n, Hm), 0.0);
  float wide = 230.0 + 0.16 * max(0.0, xz.y - uCamZ + 700.0);
  float band = exp(-pow((xz.x - uMoonPathX) / wide, 2.0));
  float spark = pow(nh, 1400.0) * 5.0 + pow(nh, 220.0) * 0.12;
  col += uMoonCol * (spark * (0.06 + 0.94 * band) + sheen) * (0.6 + 0.4 * dk);
  // ---- the park's lights, reflected as long broken streaks toward the viewer
  vec3 streak = vec3(0.0);
  for (int i = 0; i < ${POOL_MAX}; i++) {
    if (i >= uPoolN) break;
    vec4 A = uPoolA[i];
    float dz = xz.y - A.z;
    // lamps and lanterns standing up off the deck (not a glow at someone's feet)
    if (A.y < 90.0 || dz < -60.0 || dz > 1100.0) continue;
    float dx = xz.x - A.x + n.x * 70.0;
    float w = 9.0 + max(dz, 0.0) * 0.045;
    // faded in at its near end and out at its far end, so a streak never stops on a hard line
    float s = exp(-dx * dx / (w * w)) * exp(-max(dz, 0.0) / (220.0 + A.y * 2.2)) * smoothstep(-60.0, 10.0, dz) * (1.0 - smoothstep(650.0, 1100.0, dz));
    vec3 Ld = normalize(vec3(A.x, A.y + 120.0, A.z) - vW);
    float g = pow(max(dot(n, normalize(Ld + V)), 0.0), 70.0);
    streak += uPoolB[i].rgb * (s * (0.18 + 2.2 * g) + g * 0.06);
  }
  col += streak * (0.5 + 0.5 * smoothstep(0.0, 200.0, vDepth));
  // ---- foam: each breaker a thin broken crest where it's shallow enough to break, trailing a lace that
  // dissolves as the wave runs on; the wash at the edge; a few whitecaps far out
  float cellA = texture2D(uTex, xz * 0.0125 + vec2(uSeaTime * 0.01, uSeaTime * 0.004)).z;
  float cellB = texture2D(uTex, xz * 0.037 - vec2(uSeaTime * 0.017, 0.0)).z;
  float smoothN = texture2D(uTex, xz * 0.0031 + vec2(0.0, uSeaTime * 0.003)).w;
  float cell = cellA * 0.6 + cellB * 0.4;
  float ph = fract(surfPhase(xz));
  float zone = smoothstep(290.0, 120.0, vDepth) * smoothstep(-15.0, 35.0, vDepth);
  float segN = texture2D(uTex, xz * 0.0072 + vec2(uSeaTime * 0.004, 0.0)).w;
  float crestLine = smoothstep(0.935, 0.985, ph) * (1.0 - smoothstep(0.985, 1.0, ph));
  // a breaker comes over in pieces along its length
  crestLine *= smoothstep(0.38, 0.62, smoothN * 0.6 + segN * 0.6);
  float age = clamp((0.975 - ph) / 0.4, 0.0, 1.0);
  float lace = smoothstep(mix(0.42, 0.12, age), mix(0.3, 0.06, age), cellA * cellB * 1.6) * (1.0 - age) * step(ph, 0.975) * step(0.55, ph);
  float breaking = zone * (crestLine * 0.9 + lace * 0.42);
  float wash = smoothstep(55.0, 0.0, edge) * smoothstep(-30.0, -5.0, edge) * smoothstep(0.45, 0.2, cell) * (0.5 + 0.5 * swash);
  float caps = smoothstep(0.9, 0.99, crest) * smoothstep(320.0, 900.0, vDepth) * smoothstep(0.22, 0.12, cell) * 0.3 * (uQuality > 0.5 ? 1.0 : 0.0);
  float foam = clamp(breaking + wash + caps, 0.0, 1.0);
  vec3 foamCol = uFoam * (0.22 + 0.5 * moonUp) + streak * 0.2;
  col = mix(col, foamCol, foam * 0.85);
  // ---- the pier's shadow on the water (it stands above the surface on its pilings)
  vec2 sp = xz - uShadowOff;
  float sh = 0.0;
  for (int i = 0; i < 5; i++) {
    vec4 r = uDeck[i];
    sh = max(sh, smoothstep(14.0, -14.0, max(max(r.x - sp.x, sp.x - r.z), max(r.y - sp.y, sp.y - r.w))));
  }
  col *= 1.0 - 0.45 * sh * dk;
  // ---- something vast, passing underneath
  if (uBeast.w > 0.001) {
    vec2 bq = (xz - uBeast.xy) / vec2(720.0, 260.0);
    float b = exp(-dot(bq, bq) * 2.2) * uBeast.w;
    col *= 1.0 - 0.55 * b;
  }
  // ---- clear and thin at the edge, opaque offshore
  float alpha = smoothstep(-30.0, 90.0, edge) * mix(0.45, 0.97, smoothstep(0.0, 320.0, vDepth));
  alpha = max(alpha, foam * smoothstep(-30.0, 0.0, edge));
  // ---- sea mist, then the scene's fog
  float fm = ncMist(vW + vec3(0.0, 4.0, 0.0));
  col = ncFog(col, fm, poolLightFlat(vW + vec3(0.0, 18.0, 0.0)) * 0.3);
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}`;

/** Wave sets per quality (direction x, z; amplitude; wavelength). All come in from the south-south-west. */
const WAVES: [number, number, number, number][] = [
  [0.3, -1, 7, 760], [0.55, -1, 4.6, 430], [0.06, -1, 3.6, 290], [0.8, -1, 2.4, 190], [-0.28, -1, 1.8, 130], [1, -0.62, 1.2, 86],
];

export class Ocean {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private cell = 20;
  private cols = 220;
  private rows = 170;
  private quality: 'low' | 'medium' | 'high' = 'high';
  /** the vast shape under the water: where it is and how strongly it shows (0..1) */
  beast = { x: 0, z: 0, k: 0 };

  constructor(parent: THREE.Object3D) {
    const deck = PIER_DECKS.map((r) => new THREE.Vector4(r.x0, r.y0, r.x1, r.y1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsLib.fog,
        ...pool.uniforms,
        ...shared,
        uTex: { value: waterTexture() },
        uOrigin: { value: new THREE.Vector2() },
        uWaveA: { value: WAVES.map((w) => new THREE.Vector4(...w)) },
        uWaveN: { value: 6 },
        uSteep: { value: 0.62 },
        uShoreOff: { value: 0 },
        uSeaTime: { value: 0 },
        uMoonDir: { value: new THREE.Vector3(-0.5, 0.56, -0.66).normalize() },
        uMoonCol: { value: new THREE.Vector3(0.62, 0.72, 0.9) },
        uMoonPathX: { value: 0 },
        uCamZ: { value: 0 },
        uDeep: { value: new THREE.Color(0x02060b) },
        uMid: { value: new THREE.Color(0x07161f) },
        uShallow: { value: new THREE.Color(0x163238) },
        uFoam: { value: new THREE.Color(0xc4d2d8) },
        uQuality: { value: 2 },
        uBeast: { value: new THREE.Vector4(0, 0, 0, 0) },
        uDeck: { value: deck },
        uShadowOff: { value: new THREE.Vector2(26, 20) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.mesh = new THREE.Mesh(this.grid(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5; // over the sea floor and the wading crowd, under the effects
    parent.add(this.mesh);
  }

  private grid(): THREE.BufferGeometry {
    const g = new THREE.PlaneGeometry(this.cols * this.cell, this.rows * this.cell, this.cols, this.rows);
    g.rotateX(-Math.PI / 2);
    return g;
  }

  setQuality(q: 'low' | 'medium' | 'high'): void {
    if (q === this.quality) return;
    this.quality = q;
    const [cols, rows, cell] = q === 'high' ? [220, 170, 20] : q === 'medium' ? [150, 116, 29] : [96, 74, 46];
    this.cols = cols;
    this.rows = rows;
    this.cell = cell;
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.grid();
    this.mat.uniforms.uWaveN.value = q === 'high' ? 6 : q === 'medium' ? 4 : 2;
    this.mat.uniforms.uQuality.value = q === 'high' ? 2 : q === 'medium' ? 1 : 0;
  }

  /** Follow the camera (snapped to the grid's cells), and advance the sea. */
  update(time: number, camX: number, camZ: number, shoreOff: number): void {
    const u = this.mat.uniforms;
    const cx = Math.round(camX / this.cell) * this.cell;
    // the view reaches further south than north (it looks north, down at the sea in front of you)
    const cz = Math.round((camZ + 300) / this.cell) * this.cell;
    u.uOrigin.value.set(cx, cz);
    u.uSeaTime.value = time;
    u.uShoreOff.value = shoreOff;
    u.uCamZ.value = camZ;
    // the moon hangs north-west: its glitter path runs up the screen a little left of centre
    u.uMoonPathX.value = camX - 380;
    u.uBeast.value.set(this.beast.x, this.beast.z, 0, this.beast.k);
  }
}

/** The shore offset (tide + low water) the shaders add to the mean waterline, from the sim's sea state. */
export function shoreOffset(t: number, retreat: number): number {
  return -TIDE.amp * tideRise(t) + RETREAT * retreat;
}
