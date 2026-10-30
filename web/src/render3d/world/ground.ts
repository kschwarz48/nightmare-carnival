// The midway floor in 3D: the painted layout (paths, plaza, promenade, decals) under procedural
// detail (packed dirt, cobbles, warped boardwalk planks, rain puddles that mirror the lamps), the
// cold sea with a moon path, and ground mist that the practical lights glow through (D-36).
// Built on MeshStandardMaterial so it receives real shadows from the moon and the lantern.

import * as THREE from 'three';
import { MAP_HALF, SEA_Y } from '../../data/map';
import { EXTENT, paintGround } from './paint';
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
`;

export class Ground3D {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  readonly u = {
    uTime: { value: 0 },
    uSeaY: { value: SEA_Y },
    uMapHalf: { value: MAP_HALF },
    uDawn: { value: 0 },
    uWet: { value: 1 },
  };

  constructor(maxAniso: number) {
    const tex = new THREE.CanvasTexture(paintGround());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, maxAniso);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    this.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, envMapIntensity: 0.6 });
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
          uniform float uTime, uSeaY, uMapHalf, uDawn, uWet;
          uniform vec3 uShadowFill;
          ${NOISE}
          ${POOL_GLSL}
          ${MIST_GLSL}`,
        )
        .replace(
          '#include <map_fragment>',
          `vec2 w = vGW.xz;
          vec4 paint = texture2D(map, vMapUv);
          vec3 col = paint.rgb;
          float surf = paint.a;
          float grain = gFbm(w * 0.045) * 0.5 + gFbm(w * 0.21) * 0.5;
          col *= 0.7 + grain * 0.55;
          float gRough = 0.94;
          if (surf > 0.5 && surf < 0.85) {
            vec2 cp = w / 15.0;
            vec2 ci = floor(cp);
            float f1 = 9.0, f2 = 9.0;
            vec2 cell = ci;
            for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
              vec2 g = ci + vec2(float(x), float(y));
              vec2 o = g + 0.5 + 0.8 * (vec2(gHash(g), gHash(g + 7.0)) - 0.5);
              float d = length(cp - o);
              if (d < f1) { f2 = f1; f1 = d; cell = g; } else if (d < f2) f2 = d;
            }
            float stone = smoothstep(0.03, 0.16, f2 - f1);
            float tone = 0.55 + 0.45 * gHash(cell) - 0.25 * gNoise(w * 0.02);
            col = mix(col * 0.28, col * tone * 0.75, stone);
            gRough = mix(0.98, 0.62, stone);
          } else if (surf < 0.5) {
            float row = floor(w.y / 30.0);
            float off = gHash(vec2(row, 3.0)) * 200.0;
            float seamY = smoothstep(0.0, 2.5, abs(fract(w.y / 30.0) * 30.0 - 15.0) - 12.5);
            float seamX = smoothstep(0.0, 2.0, abs(fract((w.x + off) / 160.0) * 160.0 - 80.0) - 78.0);
            vec3 wood = mix(vec3(0.16, 0.1, 0.06), vec3(0.24, 0.16, 0.09), gHash(vec2(row, floor((w.x + off) / 160.0))));
            wood *= 0.75 + 0.35 * gNoise(vec2(w.x * 0.06, w.y * 0.6));
            col = wood * (1.0 - 0.75 * max(seamY, seamX));
            gRough = 0.8;
          }
          // rain puddles: dark, glossy, catching the lamps
          float pud = smoothstep(0.62, 0.7, gFbm(w * 0.004 + 3.1)) * uWet * step(w.y, uSeaY - 40.0);
          col = mix(col, col * 0.35, pud);
          gRough = mix(gRough, 0.06, pud);
          float gSea = 0.0;
          if (w.y > uSeaY) {
            gSea = 1.0;
            float depth = clamp((w.y - uSeaY) / 600.0, 0.0, 1.0);
            float wave = gNoise(vec2(w.x * 0.01 + uTime * 0.12, w.y * 0.03 - uTime * 0.2)) * 0.6 + gNoise(vec2(w.x * 0.04 - uTime * 0.3, w.y * 0.08)) * 0.4;
            col = mix(vec3(0.012, 0.03, 0.05), vec3(0.004, 0.008, 0.02), depth) + wave * 0.01;
            gRough = 0.12 + wave * 0.2;
          }
          // the dark woods beyond the fence fall away to black
          float out_ = max(max(abs(w.x) - uMapHalf, -w.y - uMapHalf), 0.0);
          col *= 1.0 - clamp(out_ / 380.0, 0.0, 0.85);
          diffuseColor.rgb *= col;`,
        )
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
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
            vec3 gDiff = poolLight(vGW + vec3(0.0, 1.0, 0.0), vec3(0.0, 1.0, 0.0), mix(4.0, 90.0, 1.0 - roughnessFactor), gSpec);
            reflectedLight.directDiffuse += gDiff * material.diffuseColor;
            reflectedLight.directSpecular += gSpec * (1.0 - roughnessFactor) * 0.6;
            float gLit = dot(reflectedLight.directDiffuse, vec3(0.333));
            reflectedLight.indirectDiffuse += material.diffuseColor * uShadowFill * 1.3 * (1.0 - smoothstep(0.0, 0.2, gLit));
          }`,
        )
        .replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
          {
            float gm = ncMist(vGW);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uMistCol + poolLightFlat(vGW + vec3(0.0, 18.0, 0.0)) * 0.32, gm);
          }`,
        );
    };
    const geo = new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  update(time: number, dawn: number): void {
    this.u.uTime.value = time;
    this.u.uDawn.value = dawn;
  }
}
