// The Ghost Train's ground (D-80): one shader, a mesh per place. Every station has the same bones: the track
// bed along its north (ballast, sleepers and two rails, a second line beyond it, then the cutting's dark
// grass), the platform's worn flags with their white edge, and the station's own ground: the Junction's
// tiled concourse and cobbled forecourt; Saint Vesper's churchyard grass, gravel paths and leaf litter; the
// Cinder Works' black cinders, puddles and tub-wagon rails; Stillwater's cobbled lanes, verges and the still
// pond; the End of the Line's cracked marble ending in a brink, and nothing below. The moving train's place
// is a conveyor: the track and the country outside stream past at the train's speed (`uScroll`), the country
// changing with each leg, the ground giving way to the drop on the bridge.

import * as THREE from 'three';
import { END_EDGE, PLATFORM_DEPTH, STILLWATER } from '../../../data/gtStations';
import { REGIONS, REGION_HH, REGION_HW, TRANSIT, trackY, trainOrigin } from '../../../data/ghosttrain';
import { POOL_GLSL } from '../../core/pool';
import { MIST_GLSL, pool, shared } from '../../core/materials';

const NOISE = /* glsl */ `
float gtHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gtNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gtHash(i), gtHash(i + vec2(1.0, 0.0)), u.x), mix(gtHash(i + vec2(0.0, 1.0)), gtHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float gtFbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * gtNoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
// the track bed: ballast, sleepers across it every 42 units, two rails 72 either side of the centre line
vec3 trackBed(vec2 w, float cy, float scroll, inout float rough, inout float wet) {
  float d = w.y - cy;
  vec2 q = vec2(w.x + scroll, w.y);
  vec3 col = mix(vec3(0.07, 0.068, 0.065), vec3(0.15, 0.145, 0.14), gtFbm(q * 0.11)) * (0.75 + 0.5 * gtHash(floor(q / 5.0)));
  float sl = step(abs(d), 104.0) * step(fract(q.x / 42.0), 0.36);
  col = mix(col, vec3(0.05, 0.035, 0.025) * (0.8 + 0.4 * gtNoise(q * 0.3)), sl);
  for (int k = 0; k < 2; k++) {
    float rd = abs(abs(d) - 72.0);
    float rail = smoothstep(4.5, 3.0, rd);
    col = mix(col, vec3(0.32, 0.31, 0.3) * (0.7 + 0.3 * gtNoise(q * 0.02)), rail);
    rough = mix(rough, 0.25, rail);
    if (k == 0) col = mix(col, vec3(0.04, 0.03, 0.025), smoothstep(10.0, 4.0, rd) * (1.0 - rail) * 0.6);
  }
  return col;
}`;

const REGION_GLSL = (r: number) => {
  const g = REGIONS[r];
  const ty = trackY(r).toFixed(1);
  const plat = (trackY(r) + 122).toFixed(1), platS = (trackY(r) + PLATFORM_DEPTH).toFixed(1);
  const common = /* glsl */ `
    float ty = ${ty};
    if (w.y < ${plat}) {
      // the track bed, the second line beyond, and the cutting's grass
      col = trackBed(w, ty, 0.0, fRough, wet);
      if (w.y < ty - 150.0) {
        col = trackBed(w, ty - 330.0, 0.0, fRough, wet);
        float bank = smoothstep(ty - 520.0, ty - 620.0, w.y);
        vec3 grass = mix(vec3(0.03, 0.04, 0.025), vec3(0.06, 0.07, 0.04), gtFbm(w * 0.01)) * (0.8 + 0.3 * gtNoise(w * 0.07));
        col = mix(col, grass, bank);
      }
    } else if (w.y < ${platS}) {
      // the platform: worn flags with a white edge along the track
      vec2 f = w / vec2(64.0, 48.0);
      vec2 fi = floor(f), ff = fract(f);
      float joint = step(ff.x, 0.03) + step(ff.y, 0.04);
      vec3 flag = mix(vec3(0.16, 0.155, 0.15), vec3(0.24, 0.23, 0.215), gtHash(fi)) * (0.82 + 0.3 * gtFbm(w * 0.04));
      col = mix(flag, vec3(0.05), min(1.0, joint) * 0.7);
      float edge = smoothstep(${plat} + 18.0, ${plat} + 14.0, w.y) * step(${plat} + 2.0, w.y);
      col = mix(col, vec3(0.62, 0.6, 0.52) * (0.6 + 0.4 * gtNoise(w * 0.1)), edge);
      float kerb = smoothstep(${plat} + 6.0, ${plat}, w.y);
      col = mix(col, vec3(0.08), kerb);
      // rain-dark where the canopy ends
      wet = smoothstep(${platS} - 40.0, ${platS}, w.y) * 0.5;
    } else {`;
  let ground = '';
  switch (r) {
    case 0: // Hollow Junction: the concourse's red and cream tiles, then the forecourt's cobbles
      ground = /* glsl */ `
      if (w.y < ${(g.cy + 300).toFixed(1)}) {
        vec2 t = w / 40.0;
        vec2 ti = floor(t), tf = fract(t);
        float chk = mod(ti.x + ti.y, 2.0);
        vec3 tile = mix(vec3(0.2, 0.07, 0.05), vec3(0.42, 0.38, 0.3), chk) * (0.75 + 0.35 * gtHash(ti));
        float grout = step(tf.x, 0.05) + step(tf.y, 0.05);
        col = mix(tile, vec3(0.06, 0.055, 0.05), min(1.0, grout));
        // missing tiles, and the dirt in them
        if (gtHash(ti + 7.0) > 0.965) col = vec3(0.05, 0.04, 0.035);
        col *= 0.75 + 0.35 * gtFbm(w * 0.004);
        fRough = 0.55;
      } else {
        vec2 c = w / vec2(26.0, 20.0);
        c.x += floor(c.y) * 0.5;
        vec2 ci = floor(c), cf = fract(c) - 0.5;
        float stone = smoothstep(0.5, 0.36, max(abs(cf.x), abs(cf.y) * 1.2));
        col = mix(vec3(0.03, 0.03, 0.028), mix(vec3(0.12, 0.115, 0.11), vec3(0.2, 0.19, 0.18), gtHash(ci)), stone);
        fRough = mix(0.9, 0.5, stone);
        wet = smoothstep(0.55, 0.75, gtFbm(w * 0.003)) * 0.8;
      }`;
      break;
    case 1: // Saint Vesper's: churchyard grass, gravel paths, leaf litter
      ground = /* glsl */ `
      vec3 grass = mix(vec3(0.035, 0.045, 0.03), vec3(0.075, 0.08, 0.05), gtFbm(w * 0.012)) * (0.75 + 0.4 * gtNoise(w * 0.09));
      float leaf = step(0.82, gtHash(floor(w / 7.0))) * gtNoise(w * 0.02);
      grass = mix(grass, vec3(0.16, 0.08, 0.04), leaf * 0.6);
      float pathX = step(abs(w.x - ${g.cx.toFixed(1)}), 150.0);
      float pathY = step(abs(w.y - ${(g.cy + 180).toFixed(1)}), 90.0);
      float pathC = step(abs(w.x - ${(g.cx + 1200).toFixed(1)}), 90.0) * step(${(g.cy + 180).toFixed(1)}, w.y);
      float path = max(max(pathX, pathY), pathC);
      vec3 gravel = mix(vec3(0.13, 0.125, 0.115), vec3(0.22, 0.21, 0.19), gtHash(floor(w / 4.0))) * (0.8 + 0.3 * gtFbm(w * 0.05));
      col = mix(grass, gravel, path);
      fRough = 0.95;
      wet = smoothstep(0.6, 0.8, gtFbm(w * 0.004 + 3.0)) * 0.5;`;
      break;
    case 2: // the Cinder Works: black cinders, coal dust, puddles, tub-wagon rails
      ground = /* glsl */ `
      col = mix(vec3(0.035, 0.032, 0.03), vec3(0.09, 0.08, 0.07), gtFbm(w * 0.02)) * (0.7 + 0.5 * gtHash(floor(w / 3.0)));
      float slagGlow = smoothstep(0.72, 0.84, gtFbm(w * 0.006 + 11.0));
      float seam = smoothstep(0.035, 0.0, abs(gtNoise(w * 0.008 + 3.0) - 0.5)) * smoothstep(0.55, 0.7, gtFbm(w * 0.002));
      col = mix(col, vec3(0.42, 0.13, 0.03), slagGlow * 0.55);
      col += vec3(0.5, 0.16, 0.03) * seam * 0.6;
      float rails = 0.0;
      float ry = mod(w.y - ${(g.cy - 360).toFixed(1)}, 520.0);
      rails = smoothstep(3.0, 1.5, abs(ry - 24.0)) + smoothstep(3.0, 1.5, abs(ry - 68.0));
      float rx = mod(w.x - ${(g.cx - 2000).toFixed(1)}, 900.0);
      rails = max(rails, (smoothstep(3.0, 1.5, abs(rx - 30.0)) + smoothstep(3.0, 1.5, abs(rx - 74.0))) * step(${(g.cy + 100).toFixed(1)}, w.y));
      col = mix(col, vec3(0.3, 0.28, 0.26), min(1.0, rails));
      wet = smoothstep(0.62, 0.72, gtFbm(w * 0.005 + 5.0));
      col = mix(col, vec3(0.02), wet * 0.5);
      fRough = mix(0.95, 0.15, wet);`;
      break;
    case 3: // Stillwater: cobbled lanes, grass verges, the pond
      ground = /* glsl */ `
      vec3 grass = mix(vec3(0.04, 0.05, 0.035), vec3(0.08, 0.09, 0.06), gtFbm(w * 0.012)) * (0.8 + 0.35 * gtNoise(w * 0.08));
      float laneN = step(abs(w.x - ${g.cx.toFixed(1)}), 130.0);
      float laneE = step(abs(w.y - ${(g.cy + 140).toFixed(1)}), 90.0);
      float sq = step(length(w - vec2(${(g.cx + 100).toFixed(1)}, ${(g.cy + 360).toFixed(1)})), 320.0);
      float lane = max(max(laneN, laneE), sq);
      vec2 c = w / vec2(24.0, 18.0);
      c.x += floor(c.y) * 0.5;
      vec2 ci = floor(c), cf = fract(c) - 0.5;
      float stone = smoothstep(0.5, 0.34, max(abs(cf.x), abs(cf.y) * 1.2));
      vec3 cob = mix(vec3(0.03), mix(vec3(0.14, 0.135, 0.125), vec3(0.22, 0.21, 0.2), gtHash(ci)), stone);
      col = mix(grass, cob, lane);
      fRough = mix(0.95, 0.6, lane);
      // the still pond: black water like a mirror (the sky and the lamps show in it)
      float pd = length(w - vec2(${STILLWATER.pond.x.toFixed(1)}, ${STILLWATER.pond.y.toFixed(1)}));
      float water = smoothstep(${(STILLWATER.pond.r - 4).toFixed(1)}, ${(STILLWATER.pond.r - 14).toFixed(1)}, pd);
      col = mix(col, vec3(0.01, 0.014, 0.02), water);
      wet = max(wet, water * 1.6);
      fRough = mix(fRough, 0.04, water);`;
      break;
    case 4: // the End of the Line: cracked marble slabs with gilt inlay, ending at the brink
      ground = /* glsl */ `
      vec2 s = w / 120.0;
      vec2 si = floor(s), sf = fract(s);
      vec3 slab = mix(vec3(0.22, 0.21, 0.2), vec3(0.34, 0.32, 0.3), gtHash(si)) * (0.8 + 0.3 * gtFbm(w * 0.01));
      float vein = smoothstep(0.03, 0.0, abs(gtNoise(w * 0.012 + si) - 0.5)) * 0.4;
      slab = mix(slab, vec3(0.08, 0.075, 0.07), vein);
      float seam = step(sf.x, 0.025) + step(sf.y, 0.025);
      col = mix(slab, vec3(0.45, 0.36, 0.12), min(1.0, seam) * 0.55);
      float crack = smoothstep(0.012, 0.0, abs(gtNoise(w * 0.004) - 0.5));
      col = mix(col, vec3(0.02), crack * 0.8);
      fRough = 0.35;
      // the brink, and nothing past it but a long way down
      float brink = ${(g.cy + END_EDGE).toFixed(1)} + 22.0 * sin(w.x * 0.013) + 14.0 * sin(w.x * 0.051);
      float gone = smoothstep(brink - 8.0, brink + 8.0, w.y);
      vec3 drop = mix(vec3(0.012, 0.016, 0.03), vec3(0.0), smoothstep(brink, brink + 900.0, w.y));
      drop += vec3(0.6, 0.7, 1.0) * step(0.9985, gtHash(floor(w / 6.0))) * 0.5 * smoothstep(brink + 80.0, brink + 300.0, w.y);
      col = mix(col, drop, gone);
      voidK = gone;`;
      break;
  }
  return common + ground + '\n    }';
};

/** The moving train's place: the track and the country streaming past. */
const TRANSIT_GLSL = (() => {
  const o = trainOrigin(TRANSIT);
  return /* glsl */ `
    float ty = ${o.y.toFixed(1)};
    col = trackBed(w, ty, uScroll, fRough, wet);
    float d = w.y - ty;
    if (abs(d) > 130.0) {
      vec2 q = vec2(w.x + uScroll, w.y);
      vec3 grass = mix(vec3(0.03, 0.04, 0.025), vec3(0.07, 0.08, 0.05), gtFbm(q * 0.01)) * (0.8 + 0.3 * gtNoise(q * 0.06));
      vec3 cinder = mix(vec3(0.03, 0.028, 0.026), vec3(0.08, 0.07, 0.06), gtFbm(q * 0.02));
      vec3 marsh = mix(vec3(0.02, 0.03, 0.03), vec3(0.05, 0.06, 0.05), gtFbm(q * 0.008));
      vec3 land = uLeg < 0.5 ? grass : uLeg < 1.5 ? mix(grass, vec3(0.06, 0.05, 0.04), 0.3) : uLeg < 2.5 ? cinder : marsh;
      if (uLeg > 2.5) wet = smoothstep(0.5, 0.7, gtFbm(q * 0.004)) * 1.2;
      float bank = smoothstep(130.0, 200.0, abs(d));
      col = mix(col, land, bank);
      // the second line beside ours, on the north side
      if (d < -260.0 && d > -460.0) col = trackBed(w, ty - 360.0, uScroll, fRough, wet);
    }
    // on the bridge there is no ground at all: the drop, with the bridge's deck under the train
    float deck = step(abs(d), 150.0);
    vec3 drop = mix(vec3(0.01, 0.014, 0.026), vec3(0.0), smoothstep(150.0, 1400.0, abs(d)));
    col = mix(col, mix(drop, col * 0.6, deck), uBridge);
    voidK = uBridge * (1.0 - deck);`;
})();

export class GtFloor {
  readonly mesh: THREE.Group;
  readonly u = { uScroll: { value: 0 }, uLeg: { value: 0 }, uBridge: { value: 0 } };
  private mats: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.mesh = new THREE.Group();
    for (let r = 0; r < REGIONS.length; r++) {
      const g = REGIONS[r];
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
      const body = r === TRANSIT ? TRANSIT_GLSL : REGION_GLSL(r);
      const u = this.u;
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, u, pool.uniforms, shared);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
            varying vec3 vGW;
            uniform float uScroll, uLeg, uBridge;
            uniform vec3 uShadowFill;
            ${NOISE}
            ${POOL_GLSL}
            ${MIST_GLSL}`,
          )
          .replace(
            '#include <map_fragment>',
            `vec2 w = vGW.xz;
            vec3 col = vec3(0.1);
            float fRough = 0.85;
            float wet = 0.0;
            float voidK = 0.0;
            ${body}
            diffuseColor.rgb *= col;`,
          )
          .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = fRough;')
          .replace(
            '#include <lights_fragment_end>',
            `#include <lights_fragment_end>
            {
              vec3 fSpec = vec3(0.0);
              vec3 fN = vec3(0.0, 1.0, 0.0);
              float fShin = mix(4.0, 1600.0, pow(1.0 - roughnessFactor, 4.0));
              vec3 fDiff = poolLight(vGW + vec3(0.0, 1.0, 0.0), fN, fShin, fSpec);
              reflectedLight.directDiffuse += fDiff * material.diffuseColor * (1.0 - voidK);
              reflectedLight.directSpecular += fSpec * (1.0 - roughnessFactor) * (0.6 + fShin * 0.003) * (1.0 + wet * 1.5) * (1.0 - voidK);
              float fLit = dot(reflectedLight.directDiffuse, vec3(0.333));
              reflectedLight.indirectDiffuse += material.diffuseColor * uShadowFill * 1.15 * (1.0 - smoothstep(0.0, 0.2, fLit)) * (1.0 - voidK);
              reflectedLight.directDiffuse *= 1.0 - voidK * 0.95;
              reflectedLight.directSpecular *= 1.0 - voidK;
              reflectedLight.indirectDiffuse *= 1.0 - voidK * 0.9;
            }`,
          )
          .replace(
            '#include <opaque_fragment>',
            `#include <opaque_fragment>
            {
              float fm = ncMist(vGW);
              gl_FragColor.rgb = ncFog(gl_FragColor.rgb, fm, poolLightFlat(vGW + vec3(0.0, 18.0, 0.0)) * 0.3);
            }`,
          );
      };
      mat.customProgramCacheKey = () => `nc-ghosttrain-floor-r${r}-v1`;
      this.mats.push(mat);
      // each place's ground: the station's rectangle (and the cutting north of it), or the moving train's band
      const w = (REGION_HW + 600) * 2, h = (REGION_HH + 500) * 2;
      const geo = new THREE.PlaneGeometry(w, h, 1, 1);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(g.cx, 0, g.cy);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      this.mesh.add(mesh);
    }
  }

  update(_time: number, _dawn: number): void {}
}
