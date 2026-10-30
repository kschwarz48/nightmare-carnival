// Actor/prop material (D-35): MeshStandardMaterial (so models get real shadows, the moon, spotlights,
// fog and an environment for brass) extended via onBeforeCompile with:
//  • a procedural animation rig driven by per-vertex part ids + pivots and per-instance phase/wind-up
//    (walk cycles, arm swings, head nods, spinners, swaying canopies — no skeletons needed);
//  • per-instance tint, emissive gain, rim light (fresnel) and hit flash, for readability in the dark;
//  • per-vertex roughness/metalness and emissive amount (bulbs, signage, eyes);
//  • the shared practical-light pool (pool.ts), with a cheap specular term;
//  • optional occluder dithering: geometry between the camera and the player dissolves.
// Non-instanced meshes take the same per-object values from uniforms (bosses, the prize wheel).

import * as THREE from 'three';
import { POOL_GLSL, PoolLights } from './pool';

export const pool = new PoolLights();

/** Per-frame shared uniforms. uFocus = (x, y) framebuffer px, view depth, radius px. */
export const shared = {
  uFocus: { value: new THREE.Vector4(-1e5, -1e5, 0, 1) },
  uTime: { value: 0 },
  /** Colour poured into unlit areas: night shadows read deep blue-violet, never dead grey (D-41). */
  uShadowFill: { value: new THREE.Vector3(0.045, 0.06, 0.13) },
  // world-anchored ground mist (D-41): hugs the floor, drifts with the wind, lit by the practicals
  uMistCol: { value: new THREE.Vector3(0.05, 0.07, 0.115) },
  uMistDensity: { value: 0.36 },
  uMistHeight: { value: 20 },
  uMistWind: { value: new THREE.Vector2(1, 0.3) },
  uMistTime: { value: 0 },
  uMistEdge: { value: new THREE.Vector2(2200, 1960) },
};

/**
 * Ground mist shared by every world shader so floor, props and figures sit in the same fog (D-46):
 * rolling banks that swell and ebb as they drift on the wind, nearly clear between banks over the
 * play area, thicker toward the woods and the sea. Fog scatters moonlight and lamplight (it adds a
 * luminous veil) rather than smearing dark smudges over the ground.
 */
export const MIST_GLSL = /* glsl */ `
uniform vec3 uMistCol;
uniform float uMistDensity, uMistHeight, uMistTime;
uniform vec2 uMistWind, uMistEdge;
float mHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mHash(i), mHash(i + vec2(1, 0)), u.x), mix(mHash(i + vec2(0, 1)), mHash(i + vec2(1, 1)), u.x), u.y);
}
float ncMist(vec3 wp) {
  vec2 p = wp.xz * 0.0021 + uMistWind * uMistTime * 0.01;
  float n = mNoise(p) * 0.55 + mNoise(p * 2.3 + 7.1) * 0.3 + mNoise(p * 5.3 - uMistWind.yx * uMistTime * 0.012) * 0.15;
  float roll = 0.5 + 0.5 * sin(uMistTime * 0.05 + wp.x * 0.0011 - wp.z * 0.0008);
  float bank = smoothstep(0.47 - roll * 0.07, 0.8, n);
  float h = exp(-max(wp.y, 0.0) / uMistHeight);
  float edge = smoothstep(uMistEdge.x * 0.45, uMistEdge.x * 1.05, max(abs(wp.x), abs(wp.z)));
  float sea = smoothstep(uMistEdge.y - 420.0, uMistEdge.y + 200.0, wp.z);
  float d = uMistDensity * (0.05 + 1.15 * bank) * (1.0 + edge * 1.2 + sea * 1.3);
  return clamp(d * h, 0.0, 0.8);
}
// in-scattering veil: the fog absorbs a little and glows with the moon and the practicals
vec3 ncFog(vec3 col, float d, vec3 lit) { return col * (1.0 - d * 0.5) + (uMistCol + lit) * d; }`;

const V_HEAD = /* glsl */ `
attribute vec3 aSurf;   // roughness, metalness, emissive amount
#ifndef NC_SKIN
attribute float aPart;
attribute vec3 aPivot;
#endif
#ifdef USE_INSTANCING
attribute vec4 iAnim;
attribute vec4 iTint;
attribute vec4 iRim;
#endif
uniform vec4 uAnimA;   // bob, squash, leg swing, arm swing
uniform vec4 uAnimB;   // head nod, spin rate, wind-up lean, wind-up arm raise
uniform vec4 uObjAnim; // non-instanced: phase, wind-up, flash, move
uniform vec4 uObjTint;
uniform vec4 uObjRim;
#ifdef NC_WIND
uniform float uTime;
#endif
#ifndef NC_SKIN
mat3 ncRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 ncRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 ncRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 ncPartRot(float part, vec4 an) {
  float ph = an.x, wu = an.y, mv = an.w;
  if (part < 0.5) return mat3(1.0);
  if (part < 1.5) return ncRotX(sin(ph * 2.0) * uAnimB.x * (0.35 + mv) - wu * 0.3 * uAnimB.z) * ncRotZ(sin(ph) * uAnimB.x * 0.6);
  if (part < 2.5) return ncRotX(sin(ph) * uAnimA.w * mv - wu * uAnimB.w);
  if (part < 3.5) return ncRotX(-sin(ph) * uAnimA.w * mv - wu * uAnimB.w);
  if (part < 4.5) return ncRotX(-sin(ph) * uAnimA.z * mv);
  if (part < 5.5) return ncRotX(sin(ph) * uAnimA.z * mv);
  if (part < 6.5) return ncRotY(ph * uAnimB.y);
  #ifdef NC_WIND
  // ground cover: the night wind combs through it, gusting in waves across the midway
  #ifdef USE_INSTANCING
  float gust = 0.6 + 0.4 * sin(uTime * 0.7 + instanceMatrix[3].x * 0.004 + instanceMatrix[3].z * 0.003);
  #else
  float gust = 0.8;
  #endif
  ph = uTime * 1.6 + an.y;
  return ncRotZ(sin(ph * 0.9 + aPivot.x * 0.4) * 0.16 * gust) * ncRotX(cos(ph * 0.7 + aPivot.z * 0.4) * 0.12 * gust);
  #endif
  return ncRotZ(sin(ph * 0.7 + aPivot.y * 0.05 + aPivot.x * 0.03) * 0.13) * ncRotX(cos(ph * 0.55 + aPivot.x * 0.05) * 0.09);
}
mat3 ncBodyRot(vec4 an) {
  // waddle while walking; lean back during a wind-up (the readable telegraph)
  return ncRotX(-an.y * uAnimB.z) * ncRotZ(sin(an.x) * 0.07 * an.w * step(0.001, uAnimA.x));
}
#endif
#ifdef NC_SKIN
attribute vec4 aSkin;   // bone 0, bone 1, weight 0, weight 1
uniform sampler2D uBoneTex;
void ncFetch(float b, float row, out vec4 r0, out vec4 r1, out vec4 r2) {
  ivec2 c = ivec2(int(b + 0.5) * 3, int(row + 0.5));
  r0 = texelFetch(uBoneTex, c, 0);
  r1 = texelFetch(uBoneTex, c + ivec2(1, 0), 0);
  r2 = texelFetch(uBoneTex, c + ivec2(2, 0), 0);
}
vec3 ncXf(vec4 r0, vec4 r1, vec4 r2, vec3 p) { vec4 P = vec4(p, 1.0); return vec3(dot(r0, P), dot(r1, P), dot(r2, P)); }
vec3 ncXn(vec4 r0, vec4 r1, vec4 r2, vec3 n) { return vec3(dot(r0.xyz, n), dot(r1.xyz, n), dot(r2.xyz, n)); }
#endif
#ifndef NC_SKIN
vec3 ncAnimate(vec3 p, mat3 R, mat3 B, vec4 an) {
  p = aPivot + R * (p - aPivot);
  float sq = 1.0 + sin(an.x * 2.0) * uAnimA.y * an.w - an.y * 0.1 * uAnimB.z;
  p.y *= sq;
  p.xz *= inversesqrt(max(sq, 0.2));
  p = B * p;
  p.y += abs(sin(an.x)) * uAnimA.x * an.w;
  return p;
}
#endif
`;

const V_VARY = /* glsl */ `
#ifdef NC_DETAIL
varying vec3 vLocal;
#endif
varying vec4 vTint;
varying vec4 vRimC;
varying float vFlash;
varying float vEmit;
varying vec2 vSurf;
varying vec3 vWPos;
varying vec3 vWNor;
varying float vViewZ;
`;

const V_AN = /* glsl */ `
#ifdef USE_INSTANCING
vec4 ncAn = iAnim;
#else
vec4 ncAn = uObjAnim;
#endif
#ifdef NC_SKIN
// iAnim = (row A, row B, flash, blend A→B)
vec4 ncA0 = vec4(0.0), ncA1 = vec4(0.0), ncA2 = vec4(0.0), ncB0 = vec4(0.0), ncB1 = vec4(0.0), ncB2 = vec4(0.0);
vec4 ncC0 = vec4(0.0), ncC1 = vec4(0.0), ncC2 = vec4(0.0), ncD0 = vec4(0.0), ncD1 = vec4(0.0), ncD2 = vec4(0.0);
ncFetch(aSkin.x, ncAn.x, ncA0, ncA1, ncA2);
ncFetch(aSkin.y, ncAn.x, ncB0, ncB1, ncB2);
float ncBl = ncAn.w;
if (ncBl > 0.001) {
  ncFetch(aSkin.x, ncAn.y, ncC0, ncC1, ncC2);
  ncFetch(aSkin.y, ncAn.y, ncD0, ncD1, ncD2);
}
#else
mat3 ncR = ncPartRot(aPart, ncAn);
mat3 ncB = ncBodyRot(ncAn);
#endif
`;

const V_SKIN_N = /* glsl */ `
#ifdef NC_SKIN
{
  vec3 nA = ncXn(ncA0, ncA1, ncA2, objectNormal) * aSkin.z + ncXn(ncB0, ncB1, ncB2, objectNormal) * aSkin.w;
  if (ncBl > 0.001) nA = mix(nA, ncXn(ncC0, ncC1, ncC2, objectNormal) * aSkin.z + ncXn(ncD0, ncD1, ncD2, objectNormal) * aSkin.w, ncBl);
  objectNormal = normalize(nA);
}
#else
objectNormal = ncB * (ncR * objectNormal);
#endif
`;

const V_SKIN_P = /* glsl */ `
#ifdef NC_SKIN
{
  vec3 pA = ncXf(ncA0, ncA1, ncA2, transformed) * aSkin.z + ncXf(ncB0, ncB1, ncB2, transformed) * aSkin.w;
  if (ncBl > 0.001) pA = mix(pA, ncXf(ncC0, ncC1, ncC2, transformed) * aSkin.z + ncXf(ncD0, ncD1, ncD2, transformed) * aSkin.w, ncBl);
  transformed = pA;
}
#else
transformed = ncAnimate(transformed, ncR, ncB, ncAn);
#endif
`;

const F_HEAD = /* glsl */ `
#ifdef NC_DETAIL
varying vec3 vLocal;
float dHash3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float dNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dHash3(i), dHash3(i + vec3(1.0, 0.0, 0.0)), u.x), mix(dHash3(i + vec3(0.0, 1.0, 0.0)), dHash3(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
             mix(mix(dHash3(i + vec3(0.0, 0.0, 1.0)), dHash3(i + vec3(1.0, 0.0, 1.0)), u.x), mix(dHash3(i + vec3(0.0, 1.0, 1.0)), dHash3(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}
#endif
varying vec4 vTint;
varying vec4 vRimC;
varying float vFlash;
varying float vEmit;
varying vec2 vSurf;
varying vec3 vWPos;
varying vec3 vWNor;
varying float vViewZ;
uniform float uEmitBoost;
uniform vec4 uFocus;
uniform vec3 uShadowFill;
${POOL_GLSL}
${MIST_GLSL}
float ncBayer(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[i] + 0.5) / 16.0;
}
`;

/**
 * Procedural surface detail for props (D-47), keyed off each vertex's surface preset (roughness /
 * metalness), in model space so it sticks to the prop: grain running along the boards, canvas with
 * rain streaks, stains and mildew, paint chipped through to dark wood, rust blooming on iron and
 * verdigris tarnish on brass. Emissive parts are left alone.
 */
const F_DETAIL = /* glsl */ `
float ncRA = 0.0, ncMA = 0.0;
#ifdef NC_DETAIL
if (vEmit < 0.05) {
  vec3 lp = vLocal;
  float rgh = vSurf.x, mtl = vSurf.y;
  float n1 = dNoise(lp * 0.05), n2 = dNoise(lp * 0.21 + 7.0);
  if (mtl > 0.5) {
    float rust = smoothstep(0.5, 0.78, n1 * 0.7 + n2 * 0.3);
    vec3 rc = rgh > 0.45 ? vec3(0.3, 0.12, 0.045) : vec3(0.15, 0.19, 0.13);
    diffuseColor.rgb = mix(diffuseColor.rgb, rc * (0.7 + 0.6 * n2), rust * 0.75);
    ncRA = rust * 0.35;
    ncMA = rust * 0.7;
  } else if (rgh > 0.74 && rgh < 0.82) {
    vec3 gp = abs(vWNor.y) > 0.6 ? vec3(lp.x * 0.09, lp.y * 0.9, lp.z * 0.9) : vec3(lp.x * 0.9, lp.y * 0.09, lp.z * 0.9);
    float grain = dNoise(gp) * 0.6 + dNoise(gp * 2.7) * 0.4;
    diffuseColor.rgb *= 0.76 + 0.4 * grain;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + 0.012, smoothstep(0.6, 0.72, n2) * 0.4);
  } else if (rgh > 0.84 && rgh < 0.92) {
    float streak = dNoise(vec3(lp.x * 0.22, lp.y * 0.02, lp.z * 0.22));
    float stain = smoothstep(0.55, 0.85, n1);
    diffuseColor.rgb *= (0.8 + 0.32 * streak) * (1.0 - 0.32 * stain);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.88, 0.68), smoothstep(0.7, 0.9, n2) * 0.5);
  } else if (rgh > 0.54 && rgh < 0.62) {
    float chip = smoothstep(0.66, 0.7, dNoise(lp * 0.32 + 3.0) * 0.65 + n2 * 0.35);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.058, 0.04), chip * 0.85);
    diffuseColor.rgb *= 0.86 + 0.24 * n1;
    ncRA = chip * 0.3;
  } else {
    diffuseColor.rgb *= 0.9 + 0.2 * n1;
  }
}
#endif
`;

export interface ActorMatOpts {
  animA?: readonly [number, number, number, number];
  animB?: readonly [number, number, number, number];
  /** Dissolve where this geometry hides the player. */
  dither?: boolean;
  emitBoost?: number;
  envIntensity?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  /** Skeletal rig: the material skins with this bone texture (two bones per vertex). */
  boneTex?: THREE.Texture;
  /** Matte, painterly surface: no specular glints from the practicals, faint reflections. */
  matte?: boolean;
  /** Procedural surface detail for props (D-47): wood grain, weathered canvas, chipped paint, rust. */
  detail?: boolean;
  /** Wind-swept ground cover: SWAY parts move with shared time (instances need no per-frame updates). */
  wind?: boolean;
}

interface NcData {
  uAnimA: THREE.IUniform<THREE.Vector4>;
  uAnimB: THREE.IUniform<THREE.Vector4>;
  uObjAnim: THREE.IUniform<THREE.Vector4>;
  uObjTint: THREE.IUniform<THREE.Vector4>;
  uObjRim: THREE.IUniform<THREE.Vector4>;
  uEmitBoost: THREE.IUniform<number>;
  uBoneTex?: THREE.IUniform<THREE.Texture>;
}

// One shared function object per material kind so three's program cache can share compiled programs.
function ncCompile(this: THREE.Material, shader: THREE.WebGLProgramParametersWithUniforms): void {
  const d = this.userData.nc as NcData;
  Object.assign(shader.uniforms, d, pool.uniforms, shared);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${V_HEAD}\n${V_VARY}`)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${V_AN}\n${V_SKIN_N}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${V_SKIN_P}`)
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 ncW = vec4(transformed, 1.0);
      vec3 ncN = objectNormal;
      #ifdef USE_INSTANCING
      ncW = instanceMatrix * ncW;
      ncN = mat3(instanceMatrix) * ncN;
      vTint = iTint; vRimC = iRim; vFlash = iAnim.z;
      #else
      vTint = uObjTint; vRimC = uObjRim; vFlash = uObjAnim.z;
      #endif
      ncW = modelMatrix * ncW;
      vWPos = ncW.xyz;
      vWNor = normalize(mat3(modelMatrix) * ncN);
      vViewZ = -mvPosition.z;
      vEmit = aSurf.z;
      vSurf = aSurf.xy;
      #ifdef NC_DETAIL
      vLocal = transformed;
      #endif`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${F_HEAD}`)
    .replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      #ifdef NC_DITHER
      {
        vec2 ncD = (gl_FragCoord.xy - uFocus.xy) / uFocus.w;
        float ncR2 = length(ncD);
        if (ncR2 < 1.0 && vViewZ < uFocus.z - 40.0) {
          float ncK = (1.0 - smoothstep(0.5, 1.0, ncR2)) * 0.78;
          if (ncBayer(gl_FragCoord.xy) < ncK) discard;
        }
      }
      #endif`,
    )
    .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb *= vTint.rgb;\n${F_DETAIL}`)
    .replace('#include <roughnessmap_fragment>', '#ifdef NC_MATTE\nfloat roughnessFactor = max(roughness * vSurf.x, 0.82);\n#else\nfloat roughnessFactor = min(1.0, roughness * vSurf.x + ncRA);\n#endif')
    .replace('#include <metalnessmap_fragment>', '#ifdef NC_MATTE\nfloat metalnessFactor = metalness * vSurf.y * 0.2;\n#else\nfloat metalnessFactor = metalness * vSurf.y * (1.0 - ncMA);\n#endif')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vEmit * uEmitBoost * vTint.w;')
    .replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      {
        vec3 ncSpec = vec3(0.0);
        vec3 ncDiff = poolLight(vWPos, normalize(vWNor), mix(6.0, 48.0, 1.0 - roughnessFactor), ncSpec);
        reflectedLight.directDiffuse += ncDiff * material.diffuseColor;
        #ifndef NC_MATTE
        reflectedLight.directSpecular += ncSpec * material.specularColor * (1.15 - roughnessFactor);
        #endif
        float ncLit = dot(reflectedLight.directDiffuse, vec3(0.333));
        reflectedLight.indirectDiffuse += material.diffuseColor * uShadowFill * (1.0 - smoothstep(0.0, 0.22, ncLit)) * (0.6 + 0.4 * normal.y);
      }`,
    )
    .replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      {
        // ground mist (emissive parts — bulbs, neon tickets, eyes — shine through it)
        float ncM = ncMist(vWPos) * (1.0 - clamp(vEmit * 2.0, 0.0, 1.0));
        #ifdef NC_MATTE
        ncM *= 0.3; // figures stand in the mist without being washed out by it
        #endif
        if (ncM > 0.002) gl_FragColor.rgb = ncFog(gl_FragColor.rgb, ncM, poolLightFlat(vWPos + vec3(0.0, 18.0, 0.0)) * 0.3);
      }
      {
        float ncRim = pow(1.0 - clamp(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.4);
        gl_FragColor.rgb += vRimC.rgb * ncRim * vRimC.a;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.93, 0.86) * 1.6, clamp(vFlash, 0.0, 1.0));
      }`,
    );
}

function ncDepthCompile(this: THREE.Material, shader: THREE.WebGLProgramParametersWithUniforms): void {
  const d = this.userData.nc as NcData;
  Object.assign(shader.uniforms, d);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${V_HEAD}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${V_AN}\n${V_SKIN_P}`);
}

export function actorMaterial(o: ActorMatOpts = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 1,
    envMapIntensity: o.matte ? 0.08 : o.envIntensity ?? 0.45,
    side: o.side ?? THREE.FrontSide,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
  });
  const a = o.animA ?? [0, 0, 0, 0];
  const b = o.animB ?? [0, 0, 0, 0];
  const nc: NcData = {
    uAnimA: { value: new THREE.Vector4(a[0], a[1], a[2], a[3]) },
    uAnimB: { value: new THREE.Vector4(b[0], b[1], b[2], b[3]) },
    uObjAnim: { value: new THREE.Vector4(0, 0, 0, 0) },
    uObjTint: { value: new THREE.Vector4(1, 1, 1, 1) },
    uObjRim: { value: new THREE.Vector4(0, 0, 0, 0) },
    uEmitBoost: { value: o.emitBoost ?? 3 },
  };
  if (o.boneTex) nc.uBoneTex = { value: o.boneTex };
  m.userData.nc = nc;
  m.defines = {};
  if (o.dither) m.defines.NC_DITHER = '';
  if (o.boneTex) m.defines.NC_SKIN = '';
  if (o.matte) m.defines.NC_MATTE = '';
  if (o.detail) m.defines.NC_DETAIL = '';
  if (o.wind) m.defines.NC_WIND = '';
  m.onBeforeCompile = ncCompile;
  return m;
}

/** Shadow-pass twin that applies the same animation (so shadows walk with their owners). */
export function actorDepthMaterial(src: THREE.MeshStandardMaterial): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.userData.nc = src.userData.nc;
  if (src.defines?.NC_SKIN !== undefined) m.defines = { NC_SKIN: '' };
  m.onBeforeCompile = ncDepthCompile;
  return m;
}

/** Ink thickness in world units (≈1.3 px on screen; the renderer updates it on resize/zoom). */
export const ink = { uInkThick: { value: 1.2 }, uInkCol: { value: new THREE.Color(0x0b0809) } };

/**
 * Hand-inked silhouettes (D-44): an inverted hull drawn with the same skinning/animation as the
 * source material — back faces pushed out along the animated normal, filled with ink.
 */
export function outlineMaterial(src: THREE.MeshStandardMaterial): THREE.ShaderMaterial {
  const d = src.userData.nc as NcData;
  const skin = src.defines?.NC_SKIN !== undefined;
  return new THREE.ShaderMaterial({
    defines: skin ? { NC_SKIN: '' } : {},
    uniforms: { ...d, ...ink },
    vertexShader: /* glsl */ `
      ${V_HEAD}
      uniform float uInkThick;
      void main() {
        vec3 objectNormal = normal;
        ${V_AN}
        ${V_SKIN_N}
        vec3 transformed = position;
        ${V_SKIN_P}
        #ifdef USE_INSTANCING
        mat4 ncM = modelMatrix * instanceMatrix;
        #else
        mat4 ncM = modelMatrix;
        #endif
        // push out in world space so the line keeps a constant on-screen width under instance scale
        vec4 w = ncM * vec4(transformed, 1.0);
        vec3 wn = normalize(mat3(ncM) * objectNormal);
        w.xyz += wn * uInkThick;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uInkCol;
      void main() { gl_FragColor = vec4(uInkCol, 1.0); }`,
    side: THREE.BackSide,
  });
}

export function ncData(m: THREE.Material): NcData {
  return m.userData.nc as NcData;
}

/** Per-object values for non-instanced meshes (bosses, wheel). */
export function setObjectState(m: THREE.Material, phase: number, windup: number, flash: number, move: number, tint?: [number, number, number, number], rim?: [number, number, number, number]): void {
  const d = m.userData.nc as NcData;
  d.uObjAnim.value.set(phase, windup, flash, move);
  if (tint) d.uObjTint.value.set(tint[0], tint[1], tint[2], tint[3]);
  if (rim) d.uObjRim.value.set(rim[0], rim[1], rim[2], rim[3]);
}
