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
};

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
float ncBayer(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[i] + 0.5) / 16.0;
}
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
  Object.assign(shader.uniforms, d, pool.uniforms, { uFocus: shared.uFocus, uShadowFill: shared.uShadowFill });
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
      vSurf = aSurf.xy;`,
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
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vTint.rgb;')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vSurf.x;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vSurf.y;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vEmit * uEmitBoost * vTint.w;')
    .replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      {
        vec3 ncSpec = vec3(0.0);
        vec3 ncDiff = poolLight(vWPos, normalize(vWNor), mix(6.0, 48.0, 1.0 - roughnessFactor), ncSpec);
        reflectedLight.directDiffuse += ncDiff * material.diffuseColor;
        reflectedLight.directSpecular += ncSpec * material.specularColor * (1.15 - roughnessFactor);
        float ncLit = dot(reflectedLight.directDiffuse, vec3(0.333));
        reflectedLight.indirectDiffuse += material.diffuseColor * uShadowFill * (1.0 - smoothstep(0.0, 0.22, ncLit)) * (0.6 + 0.4 * normal.y);
      }`,
    )
    .replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
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
    envMapIntensity: o.envIntensity ?? 0.55,
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
