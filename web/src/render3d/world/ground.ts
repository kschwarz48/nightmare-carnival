// The midway floor in 3D (D-45). The layout is analytic — dirt avenues as polyline distance fields
// with ragged, grass-bitten edges and wheel ruts that follow each avenue, the cobbled plaza with a
// curb of dressed stones, the boardwalk promenade, the Tilt-a-Whirl's steel deck, grease slicks —
// so it stays crisp at any zoom. Every surface carries procedural relief (domed cobbles, ruts,
// pebbles, grass, warped planks, rivets) turned into per-pixel normals, so the moon and every
// practical light rake across it; rain water pools in ruts and hollows and mirrors the lamps.
// Contact occlusion under props comes from a small baked texture (paint.ts). Also: the cold sea
// with a moon path, and the ground mist the practicals glow through (D-36, D-41).

import * as THREE from 'three';
import { GREASE_SLICKS, MAP_HALF, PATHS, PLAZA, PROMENADE, SEA_Y, TILT_A_WHIRL } from '../../data/map';
import { EXTENT, bakeGroundData } from './paint';
import { POOL_GLSL } from '../core/pool';
import { MIST_GLSL, pool, shared } from '../core/materials';

const NOISE = /* glsl */ `
float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1, 0)), u.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), u.x), u.y);
}
float gFbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * gNoise(p); p *= 2.03; a *= 0.5; } return v; }
// cellular: (nearest, second nearest, nearest cell's hash)
vec3 gVor(vec2 p) {
  vec2 ci = floor(p);
  float f1 = 9.0, f2 = 9.0;
  vec2 cell = ci;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = ci + vec2(float(x), float(y));
    vec2 o = g + 0.5 + 0.8 * (vec2(gHash(g), gHash(g + 7.0)) - 0.5);
    float d = length(p - o);
    if (d < f1) { f2 = f1; f1 = d; cell = g; } else if (d < f2) f2 = d;
  }
  return vec3(f1, f2, gHash(cell));
}
`;

const MAX_SEGS = 24;

/** The avenues as line segments for the shader: (ax, ay, bx, by), half width, distance along the avenue at a. */
function pathSegments(): { segs: THREE.Vector4[]; halfW: number[]; off: number[] } {
  const segs: THREE.Vector4[] = [], halfW: number[] = [], off: number[] = [];
  for (const p of PATHS) {
    let acc = 0;
    for (let i = 0; i + 1 < p.pts.length; i++) {
      const [ax, ay] = p.pts[i], [bx, by] = p.pts[i + 1];
      segs.push(new THREE.Vector4(ax, ay, bx, by));
      halfW.push(p.w / 2);
      off.push(acc);
      acc += Math.hypot(bx - ax, by - ay);
    }
  }
  while (segs.length < MAX_SEGS) {
    segs.push(new THREE.Vector4(1e5, 1e5, 1e5 + 1, 1e5));
    halfW.push(0);
    off.push(0);
  }
  return { segs: segs.slice(0, MAX_SEGS), halfW: halfW.slice(0, MAX_SEGS), off: off.slice(0, MAX_SEGS) };
}

const BAKE_SIZE = 1024;

/**
 * One-time GPU bake of the ground's static fields (D-46, performance): the avenue distance field with
 * the coordinates across and along the nearest avenue (A), and the low-frequency noise that drives
 * ragged edges, field mottling and where rain pools (B). The ground shader then reads two textures
 * instead of walking every avenue segment and stacking noise octaves for every pixel.
 */
function bakeFields(renderer: THREE.WebGLRenderer, ps: ReturnType<typeof pathSegments>): [THREE.Texture, THREE.Texture] {
  const mk = () => new THREE.WebGLRenderTarget(BAKE_SIZE, BAKE_SIZE, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false });
  const rts = [mk(), mk()];
  const uniforms = {
    uSegs: { value: ps.segs }, uSegW: { value: ps.halfW }, uSegOff: { value: ps.off },
    uSegN: { value: Math.min(MAX_SEGS, PATHS.reduce((n, p) => n + p.pts.length - 1, 0)) },
    uExtent: { value: EXTENT }, uPass: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      varying vec2 vUv;
      uniform vec4 uSegs[${MAX_SEGS}];
      uniform float uSegW[${MAX_SEGS}];
      uniform float uSegOff[${MAX_SEGS}];
      uniform int uSegN, uPass;
      uniform float uExtent;
      ${NOISE}
      void main() {
        vec2 w = vUv * 2.0 * uExtent - uExtent;
        if (uPass == 1) {
          gl_FragColor = vec4(gFbm(w * 0.031), gFbm(w * 0.011), gFbm(w * 0.05 + 3.0), gFbm(w * 0.0065 + 3.1));
          return;
        }
        float dPath = 1e4, along = 0.0, across = 0.0, halfW = 1.0;
        for (int i = 0; i < ${MAX_SEGS}; i++) {
          if (i >= uSegN) break;
          vec4 s = uSegs[i];
          vec2 ab = s.zw - s.xy;
          float L = length(ab);
          vec2 dir = ab / L;
          float t = clamp(dot(w - s.xy, dir), 0.0, L);
          vec2 q = s.xy + dir * t;
          float d = length(w - q) - uSegW[i];
          if (d < dPath) { dPath = d; halfW = uSegW[i]; along = uSegOff[i] + t; across = dot(w - q, vec2(-dir.y, dir.x)); }
        }
        gl_FragColor = vec4(min(dPath, 4000.0), across, along, halfW);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  for (let k = 0; k < 2; k++) {
    uniforms.uPass.value = k;
    renderer.setRenderTarget(rts[k]);
    renderer.render(scene, cam);
  }
  renderer.setRenderTarget(prev);
  mat.dispose();
  quad.geometry.dispose();
  return [rts[0].texture, rts[1].texture];
}

export class Ground3D {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  readonly u: Record<string, THREE.IUniform>;

  constructor(renderer: THREE.WebGLRenderer) {
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const data = new THREE.CanvasTexture(bakeGroundData());
    data.flipY = false;
    data.colorSpace = THREE.NoColorSpace;
    data.anisotropy = Math.min(4, maxAniso);
    data.minFilter = THREE.LinearMipmapLinearFilter;
    const ps = pathSegments();
    const slicks = GREASE_SLICKS.slice(0, 4).map((s) => new THREE.Vector3(s.x, s.y, s.r));
    while (slicks.length < 4) slicks.push(new THREE.Vector3(1e5, 1e5, 0));
    const fields = bakeFields(renderer, ps);
    this.u = {
      uFieldsA: { value: fields[0] },
      uFieldsB: { value: fields[1] },
      uTime: { value: 0 },
      uSeaY: { value: SEA_Y },
      uMapHalf: { value: MAP_HALF },
      uDawn: { value: 0 },
      uWet: { value: 1 },
      uExtent: { value: EXTENT },
      uGroundData: { value: data },
      uPlaza: { value: new THREE.Vector3(PLAZA.x, PLAZA.y, PLAZA.r) },
      uProm: { value: new THREE.Vector3(PROMENADE.y0, PROMENADE.y1, MAP_HALF) },
      uPad: { value: new THREE.Vector4(TILT_A_WHIRL.x, TILT_A_WHIRL.y, 300, 210) },
      uSlicks: { value: slicks },
    };
    this.material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, envMapIntensity: 0.7 });
    const u = this.u;
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u, pool.uniforms, shared);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vGW;
          uniform float uTime, uSeaY, uMapHalf, uDawn, uWet, uExtent;
          uniform sampler2D uGroundData;
          uniform sampler2D uFieldsA, uFieldsB;
          uniform vec3 uPlaza, uProm, uSlicks[4];
          uniform vec4 uPad;
          uniform vec3 uShadowFill;
          ${NOISE}
          ${POOL_GLSL}
          ${MIST_GLSL}`,
        )
        .replace(
          '#include <map_fragment>',
          `vec2 w = vGW.xz;
          // ---------------------------------------------------------------- layout (baked fields, see bakeFields)
          vec2 fuv = (w + uExtent) / (2.0 * uExtent);
          vec4 FA = texture2D(uFieldsA, fuv), FB = texture2D(uFieldsB, fuv);
          float dPath = FA.r, across = FA.g, along = FA.b, halfW = max(FA.a, 1.0);
          float rag = (FB.r - 0.5) * 30.0 + (gNoise(w * 0.17) - 0.5) * 9.0;
          float onPath = 1.0 - smoothstep(-4.0, 4.0, dPath + rag);
          float dPlaza = length(w - uPlaza.xy) - uPlaza.z;
          float onPlaza = 1.0 - smoothstep(-1.5, 1.5, dPlaza);
          float onProm = step(uProm.x, w.y) * step(w.y, uProm.y) * step(abs(w.x), uProm.z);
          float onPad = 1.0 - smoothstep(0.97, 1.0, length((w - uPad.xy) / uPad.zw));

          // ---------------------------------------------------------------- night field: trampled grass and mud
          float nA = FB.g, nB = FB.b;
          float bare = smoothstep(0.5, 0.7, nA + (nB - 0.5) * 0.35);
          float blades = gNoise(vec2(w.x * 0.85, w.y * 0.28) + nB * 4.0) * gNoise(vec2(w.x * 0.31, w.y * 1.05) - nA * 3.0);
          vec3 col = mix(vec3(0.048, 0.056, 0.032), vec3(0.082, 0.08, 0.048), nB) * (0.68 + 0.8 * blades);
          col = mix(col, vec3(0.072, 0.056, 0.04) * (0.8 + 0.45 * nB), bare);
          float gH = (nB - 0.5) * 1.6 + blades * 1.5 * (1.0 - bare) - bare * 0.5;
          float gRough = mix(0.93, 0.86, bare);
          float wet = 0.0;

          // ---------------------------------------------------------------- dirt avenues: ruts, pebbles, straw
          if (onPath > 0.001) {
            vec3 dirt = mix(vec3(0.15, 0.11, 0.074), vec3(0.22, 0.165, 0.108), clamp(nB * 1.4 - 0.2 + (gNoise(w * 0.09) - 0.5) * 0.3, 0.0, 1.0));
            float wob = (gNoise(vec2(along * 0.008, 3.1)) - 0.5) * 16.0;
            float lane = abs(across + wob) - halfW * 0.42;
            float rut = exp(-lane * lane / 30.0) * (0.45 + 0.55 * gNoise(vec2(along * 0.015, 8.3)));
            vec3 vp = gVor(w / 5.5);
            float peb = (1.0 - smoothstep(0.1, 0.32, vp.x)) * step(0.62, vp.z);
            float hP = -rut * 2.8 + peb * 0.9 + (gNoise(w * 0.4) - 0.5) * 0.6;
            dirt = mix(dirt, dirt * 0.6, rut);
            dirt = mix(dirt, vec3(0.27, 0.245, 0.2), peb * 0.6);
            float straw = step(0.986, gHash(floor(w * 0.7))) * (1.0 - rut);
            dirt = mix(dirt, vec3(0.5, 0.38, 0.18), straw * 0.7);
            float rutWater = rut * smoothstep(0.52, 0.72, gNoise(vec2(along * 0.011, 5.7)) + 0.25 * (gNoise(w * 0.05) - 0.5));
            col = mix(col, dirt, onPath);
            gH = mix(gH, hP, onPath);
            gRough = mix(gRough, 0.9, onPath);
            wet = max(wet, rutWater * onPath);
          }

          // ---------------------------------------------------------------- cobbled plaza with a curb of dressed stones
          if (dPlaza < 6.0) {
            vec3 v = gVor(w / 12.5);
            float edge = v.y - v.x;
            float stone = smoothstep(0.03, 0.2, edge);
            float dome = sqrt(clamp(edge * 2.2, 0.0, 1.0));
            vec3 sc = mix(vec3(0.15, 0.14, 0.13), vec3(0.23, 0.2, 0.17), v.z) * (0.82 + 0.32 * gNoise(w * 0.3));
            vec3 gap = vec3(0.035, 0.04, 0.026) + vec3(0.0, 0.022, 0.004) * gNoise(w * 0.2);
            vec3 cc = mix(gap, sc, stone);
            float hC = dome * 2.4 + (v.z - 0.5) * 0.7 - (1.0 - stone) * 0.7;
            float rC = mix(0.96, 0.48 + 0.25 * gNoise(w * 0.07), stone);
            float ang = atan(w.y - uPlaza.y, w.x - uPlaza.x);
            float bi = ang * uPlaza.z / 34.0;
            float blk = fract(bi);
            float seam = smoothstep(0.0, 0.06, blk) * (1.0 - smoothstep(0.94, 1.0, blk));
            float curb = smoothstep(-22.0, -19.0, dPlaza) * (1.0 - smoothstep(2.0, 5.0, dPlaza));
            vec3 curbC = vec3(0.19, 0.18, 0.16) * (0.78 + 0.4 * gHash(vec2(floor(bi), 2.0))) * (0.85 + 0.25 * gNoise(w * 0.4));
            float k = max(onPlaza, curb);
            cc = mix(cc, curbC * mix(0.3, 1.0, seam), curb);
            hC = mix(hC, 3.0 * seam * (1.0 - smoothstep(0.0, 5.0, dPlaza)), curb);
            rC = mix(rC, 0.7, curb);
            col = mix(col, cc, k);
            gH = mix(gH, hC, k);
            gRough = mix(gRough, rC, k);
          }

          // ---------------------------------------------------------------- the boardwalk promenade
          if (onProm > 0.5) {
            float row = floor(w.y / 30.0);
            float off = gHash(vec2(row, 3.0)) * 200.0;
            float fy = fract(w.y / 30.0) * 30.0, fx = fract((w.x + off) / 160.0) * 160.0;
            float seamY = smoothstep(0.0, 2.5, abs(fy - 15.0) - 12.5);
            float seamX = smoothstep(0.0, 2.0, abs(fx - 80.0) - 78.0);
            float board = gHash(vec2(row, floor((w.x + off) / 160.0)));
            vec3 wood = mix(vec3(0.15, 0.095, 0.055), vec3(0.23, 0.15, 0.085), board);
            wood *= 0.72 + 0.4 * gNoise(vec2(w.x * 0.06, w.y * 0.6));
            float nail = 1.0 - smoothstep(0.6, 1.4, length(vec2(abs(fx - 80.0) - 74.0, abs(fy - 15.0) - 8.0)));
            col = mix(wood * (1.0 - 0.8 * max(seamY, seamX)), vec3(0.05, 0.05, 0.055), nail);
            gH = -1.4 * max(seamY, seamX) + (board - 0.5) * 0.8 - pow(abs(fy - 15.0) / 15.0, 2.0) * 0.6 + nail * 0.3;
            gRough = mix(0.78, 0.4, nail);
          }

          // ---------------------------------------------------------------- the Tilt-a-Whirl's steel deck
          if (onPad > 0.001) {
            vec2 pg = w / 42.0;
            vec2 pf = abs(fract(pg) - 0.5);
            float seamP = smoothstep(0.46, 0.5, max(pf.x, pf.y));
            float rivet = 1.0 - smoothstep(0.02, 0.05, length(pf - 0.42));
            float rust = smoothstep(0.45, 0.8, gFbm(w * 0.03 + 11.0));
            vec3 steel = mix(vec3(0.075, 0.075, 0.085), vec3(0.17, 0.075, 0.035), rust) * (0.85 + 0.3 * gHash(floor(pg)));
            col = mix(col, steel * (1.0 - 0.7 * seamP), onPad);
            gH = mix(gH, -seamP * 1.2 + rivet * 0.6, onPad);
            gRough = mix(gRough, mix(0.45, 0.85, rust), onPad);
          }

          // grease slicks by the carts: glossy amber
          for (int i = 0; i < 4; i++) {
            float sl = 1.0 - smoothstep(0.6, 1.0, length(w - uSlicks[i].xy) / max(uSlicks[i].z, 1.0));
            col = mix(col, vec3(0.32, 0.22, 0.05), sl * 0.75);
            gRough = mix(gRough, 0.12, sl);
          }

          // rain water: puddles in hollows (and the ruts above), dark mirrors for the lamps
          float pud = smoothstep(0.67, 0.72, FB.a + (gNoise(w * 0.04) - 0.5) * 0.06) * uWet;
          wet = max(wet, pud * (1.0 - onPlaza * 0.75) * (1.0 - onProm) * (1.0 - onPad));
          col = mix(col, col * 0.28 + vec3(0.003, 0.005, 0.009), wet);
          gH = mix(gH, -1.2, wet);
          gRough = mix(gRough, 0.04, wet);

          // contact occlusion where structures meet the ground
          float gAO = texture2D(uGroundData, (w + uExtent) / (2.0 * uExtent)).r;
          col *= mix(0.3, 1.0, gAO);

          float gSea = 0.0;
          if (w.y > uSeaY) {
            gSea = 1.0;
            float depth = clamp((w.y - uSeaY) / 600.0, 0.0, 1.0);
            float wave = gNoise(vec2(w.x * 0.01 + uTime * 0.12, w.y * 0.03 - uTime * 0.2)) * 0.6 + gNoise(vec2(w.x * 0.04 - uTime * 0.3, w.y * 0.08)) * 0.4;
            col = mix(vec3(0.012, 0.03, 0.05), vec3(0.004, 0.008, 0.02), depth) + wave * 0.01;
            gH = wave * 1.5;
            gRough = 0.12 + wave * 0.2;
          }
          // the dark woods beyond the fence fall away to black
          float out_ = max(max(abs(w.x) - uMapHalf, -w.y - uMapHalf), 0.0);
          col *= 1.0 - clamp(out_ / 380.0, 0.0, 0.85);
          diffuseColor.rgb *= col;
          // relief → per-pixel normal (screen-space derivatives of the height field)
          vec3 gP = vec3(w.x, gH, w.y);
          vec3 gN = normalize(cross(dFdx(gP), dFdy(gP)));
          if (gN.y < 0.0) gN = -gN;
          gN = normalize(vec3(gN.x, max(gN.y, 0.35), gN.z));
          // standing water is a mirror, stirred by a slow breeze
          vec2 wob = vec2(sin(w.x * 0.11 + uTime * 0.9 + sin(w.y * 0.05)), sin(w.y * 0.09 - uTime * 0.7 + sin(w.x * 0.04))) * 0.035;
          gN = normalize(mix(gN, vec3(wob.x, 1.0, wob.y), smoothstep(0.35, 0.8, wet) * (1.0 - gSea)));`,
        )
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize((viewMatrix * vec4(gN, 0.0)).xyz);')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          // standing water mirrors the night sky: a cool sheen, brightest at the shallow rim
          totalEmissiveRadiance += wet * (1.0 - gSea) * vec3(0.010, 0.015, 0.027) * (1.0 + 1.5 * (1.0 - smoothstep(0.5, 0.95, wet)));
          if (gSea > 0.5) {
            float depth = clamp((w.y - uSeaY) / 600.0, 0.0, 1.0);
            float wave = gNoise(vec2(w.x * 0.01 + uTime * 0.12, w.y * 0.03 - uTime * 0.2));
            float foam = smoothstep(0.08, 0.0, abs(w.y - uSeaY - 18.0 - sin(w.x * 0.02 + uTime) * 8.0) / 30.0);
            totalEmissiveRadiance += foam * vec3(0.05, 0.06, 0.08);
            float path = exp(-pow((w.x + 420.0) / 300.0, 2.0)) * smoothstep(0.55, 0.85, wave) * (0.35 + depth);
            totalEmissiveRadiance += path * vec3(0.16, 0.2, 0.3) * (1.0 - uDawn * 0.6);
          }`,
        )
        .replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
          {
            vec3 gSpec = vec3(0.0);
            float gShin = mix(4.0, 1200.0, pow(1.0 - roughnessFactor, 4.0));
            vec3 gDiff = poolLight(vGW + vec3(0.0, 1.0, 0.0), gN, gShin, gSpec);
            reflectedLight.directDiffuse += gDiff * material.diffuseColor;
            reflectedLight.directSpecular += gSpec * (1.0 - roughnessFactor) * (0.4 + gShin * 0.0025);
            float gLit = dot(reflectedLight.directDiffuse, vec3(0.333));
            reflectedLight.indirectDiffuse += material.diffuseColor * uShadowFill * 1.3 * (1.0 - smoothstep(0.0, 0.2, gLit)) * mix(0.45, 1.0, gAO);
          }`,
        )
        .replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
          {
            float gm = ncMist(vGW);
            gl_FragColor.rgb = ncFog(gl_FragColor.rgb, gm, poolLightFlat(vGW + vec3(0.0, 18.0, 0.0)) * 0.32);
          }`,
        );
    };
    this.material.customProgramCacheKey = () => 'nc-ground-v3';
    const geo = new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    // drawn after the actors (D-58): occluded silhouettes test against scenery only, so a monster's feet
    // touching the ground never light up as "hidden"
    this.mesh.renderOrder = 3;
  }

  update(time: number, dawn: number): void {
    this.u.uTime.value = time;
    this.u.uDawn.value = dawn;
  }
}
