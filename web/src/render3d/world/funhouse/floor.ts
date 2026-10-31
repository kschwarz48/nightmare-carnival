// The Fun House's floor (D-63): one shader that paints each room from the same zone table the sim uses
// (data/funhouse.ts FLOOR_ZONES). The whole floor is gently warped, more in the Crooked Corridor. It's
// lit by the light pools like the Carnival Core's ground, so lamps pool, flicker and gleam on the polish.

import * as THREE from 'three';
import { FLOOR_ZONES, MAZE, ROTUNDA, STAGE, CONVEYORS } from '../../../data/funhouse';
import { POOL_GLSL } from '../../core/pool';
import { MIST_GLSL, pool, shared } from '../../core/materials';

const NOISE = /* glsl */ `
float fhHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fhNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fhHash(i), fhHash(i + vec2(1.0, 0.0)), u.x), mix(fhHash(i + vec2(0.0, 1.0)), fhHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`;

export class FunhouseFloor {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  readonly u: Record<string, THREE.IUniform>;

  constructor() {
    const zones = FLOOR_ZONES.map((z) => new THREE.Vector4(z.x0, z.y0, z.x1, z.y1));
    const conv = CONVEYORS.slice(0, 4).map((c) => new THREE.Vector4(c.x, c.y, c.hw, c.hh));
    const convDir = CONVEYORS.slice(0, 4).map((c) => new THREE.Vector2(Math.sign(c.vx), Math.sign(c.vy)));
    this.u = {
      uTime: { value: 0 },
      uZone: { value: zones },
      uMaze: { value: new THREE.Vector4(MAZE.x0, MAZE.y0, MAZE.cw, MAZE.ch) },
      uRot: { value: new THREE.Vector3(ROTUNDA.x, ROTUNDA.y, ROTUNDA.r) },
      uStage: { value: new THREE.Vector4(STAGE.x - STAGE.hw, STAGE.y - STAGE.hh, STAGE.x + STAGE.hw, STAGE.y + STAGE.hh) },
      uConv: { value: conv },
      uConvDir: { value: convDir },
    };
    this.material = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, envMapIntensity: 0.9 });
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
          uniform float uTime;
          uniform vec4 uZone[7];
          uniform vec4 uMaze, uStage;
          uniform vec3 uRot;
          uniform vec4 uConv[4];
          uniform vec2 uConvDir[4];
          uniform vec3 uShadowFill;
          ${NOISE}
          ${POOL_GLSL}
          ${MIST_GLSL}`,
        )
        .replace(
          '#include <map_fragment>',
          `vec2 w = vGW.xz;
          int zone = 6;
          for (int i = 0; i < 7; i++) { vec4 z = uZone[i]; if (w.x >= z.x && w.x <= z.z && w.y >= z.y && w.y <= z.w) { zone = i; break; } }
          // the house lies a little: every line on the floor bends, more in the crooked corridor
          float warpK = zone == 2 ? 24.0 : 7.0;
          vec2 ww = w + vec2(sin(w.y * 0.0042 + sin(w.x * 0.0021)), sin(w.x * 0.0037 + 1.3)) * warpK;
          float grime = 0.78 + 0.3 * fhNoise(w * 0.013) - 0.12 * fhNoise(w * 0.07);
          vec3 col = vec3(0.1);
          float fRough = 0.6;
          if (zone == 6) {
            // the Grand Entrance: a big worn checkerboard, a red runner from the doors to the arch
            vec2 t = floor(ww / 110.0), f = fract(ww / 110.0);
            float chk = mod(t.x + t.y, 2.0);
            col = mix(vec3(0.035, 0.03, 0.035), vec3(0.43, 0.4, 0.34), chk);
            float grout = smoothstep(0.0, 0.025, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
            col *= mix(0.45, 1.0, grout);
            fRough = mix(0.5, 0.28, chk);
            float run = step(abs(w.x), 240.0);
            vec3 carpet = vec3(0.3, 0.035, 0.045) * (0.75 + 0.35 * fhNoise(w * 0.06));
            float edge = step(212.0, abs(w.x)) * run;
            carpet = mix(carpet, vec3(0.42, 0.3, 0.08), edge);
            col = mix(col, carpet, run);
            fRough = mix(fRough, 0.95, run);
          } else if (zone == 3) {
            // the Rotunda: dark veined marble, an inlaid brass compass star, a ring of checker under the columns
            vec2 d = w - uRot.xy;
            float r = length(d), a = atan(d.y, d.x);
            float vein = smoothstep(0.08, 0.0, abs(sin(ww.x * 0.008 + ww.y * 0.003 + fhNoise(ww * 0.004) * 7.0)));
            col = vec3(0.03, 0.05, 0.045) + vec3(0.22, 0.26, 0.22) * vein * 0.5;
            fRough = 0.22;
            float star = 380.0 * (0.55 + 0.45 * pow(abs(cos(a * 4.0)), 6.0));
            float inlay = smoothstep(4.0, 1.0, abs(r - star)) + smoothstep(3.0, 0.5, abs(r - 160.0)) + smoothstep(3.0, 0.5, abs(r - 420.0)) * step(r, 430.0);
            inlay += smoothstep(3.0, 0.0, abs(sin(a * 8.0)) * r) * step(r, star);
            col = mix(col, vec3(0.55, 0.42, 0.16), clamp(inlay, 0.0, 1.0));
            if (r > 600.0 && r < 780.0) {
              vec2 t = floor(vec2(a * 60.0, r / 45.0));
              float chk = mod(t.x + t.y, 2.0);
              col = mix(col, mix(vec3(0.03), vec3(0.42, 0.38, 0.32), chk), 0.8);
            }
          } else if (zone == 1) {
            // the Hall of Mirrors: polished black glass tiles, a silver grid on the maze's own cells
            vec2 m = (w - uMaze.xy) / uMaze.zw;
            vec2 f = fract(m * 2.0);
            float grid = 1.0 - smoothstep(0.0, 0.025, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
            col = vec3(0.016, 0.02, 0.028) * (0.8 + 0.4 * fhNoise(w * 0.03));
            col = mix(col, vec3(0.4, 0.44, 0.48), grid * 0.6);
            fRough = mix(0.08, 0.3, grid);
          } else if (zone == 0) {
            // Mira's dressing room: a faded rose rug with a fringe
            col = vec3(0.32, 0.14, 0.17) * (0.8 + 0.3 * fhNoise(w * 0.05));
            float diamond = step(0.6, abs(sin(w.x * 0.05) * sin(w.y * 0.05)));
            col = mix(col, vec3(0.45, 0.3, 0.2), diamond * 0.4);
            fRough = 0.95;
          } else if (zone == 2) {
            // the Crooked Corridor: boards laid crooked, every plank its own tone, painted arrows on the belts
            float ang = 0.16;
            vec2 r2 = vec2(ww.x * cos(ang) - ww.y * sin(ang), ww.x * sin(ang) + ww.y * cos(ang));
            float plank = floor(r2.y / 46.0);
            float tone = fhHash(vec2(plank, 3.0));
            float seam = smoothstep(0.0, 0.06, fract(r2.y / 46.0)) * smoothstep(1.0, 0.94, fract(r2.y / 46.0));
            float endSeam = smoothstep(0.0, 0.02, fract(r2.x / 260.0 + tone));
            col = mix(vec3(0.16, 0.09, 0.05), vec3(0.32, 0.2, 0.1), tone) * (0.6 + 0.5 * fhNoise(vec2(r2.x * 0.02, plank)));
            col *= mix(0.35, 1.0, seam * endSeam);
            fRough = 0.72;
            for (int i = 0; i < 4; i++) {
              vec4 c = uConv[i];
              vec2 q = (w - c.xy) / c.zw;
              if (abs(q.x) < 1.0 && abs(q.y) < 1.0) {
                vec2 dir = uConvDir[i];
                float along = dot(w - c.xy, dir) / 40.0 - uTime * 3.75;
                float chev = step(0.5, fract(along + abs(dot(w - c.xy, vec2(-dir.y, dir.x))) / 60.0));
                col = mix(vec3(0.05, 0.05, 0.06), vec3(0.6, 0.48, 0.08), chev * 0.8);
                fRough = 0.5;
              }
            }
          } else if (zone == 4) {
            // the Puppet Gallery: worn red damask carpet with a gold border near the walls
            vec2 t = ww / 70.0;
            float dam = step(0.35, abs(sin(t.x * 3.14) * sin(t.y * 3.14)) + 0.25 * fhNoise(ww * 0.05));
            col = mix(vec3(0.16, 0.025, 0.04), vec3(0.3, 0.06, 0.07), dam) * (0.75 + 0.3 * fhNoise(w * 0.02));
            vec4 z = uZone[4];
            float edgeD = min(min(w.x - z.x, z.z - w.x), min(w.y - z.y, z.w - w.y));
            col = mix(col, vec3(0.4, 0.28, 0.08), smoothstep(70.0, 60.0, edgeD) * smoothstep(40.0, 50.0, edgeD));
            fRough = 0.96;
          } else {
            // the Chamber of Illusions: stage boards, an aisle runner, small purple-and-black tiles
            vec2 t = floor(ww / 55.0), f = fract(ww / 55.0);
            float chk = mod(t.x + t.y, 2.0);
            col = mix(vec3(0.03, 0.02, 0.04), vec3(0.2, 0.1, 0.24), chk);
            fRough = 0.4;
            if (w.x > uStage.x && w.x < uStage.z && w.y > uStage.y && w.y < uStage.w) {
              float plank = floor(w.x / 38.0);
              col = vec3(0.14, 0.08, 0.04) * (0.7 + 0.4 * fhHash(vec2(plank, 7.0)));
              col *= mix(0.4, 1.0, smoothstep(0.0, 0.05, fract(w.x / 38.0)));
              fRough = 0.65;
            } else if (abs(w.x - (uStage.x + uStage.z) * 0.5) < 130.0) {
              col = vec3(0.3, 0.04, 0.05) * (0.8 + 0.3 * fhNoise(w * 0.05));
              fRough = 0.95;
            }
          }
          col *= grime;
          // beyond the house's walls: nothing at all (no tiles, no glints, no haze)
          float fOut = clamp((max(abs(w.x), abs(w.y)) - 2200.0) / 24.0, 0.0, 1.0);
          col *= 1.0 - fOut;
          fRough = mix(fRough, 1.0, fOut);
          diffuseColor.rgb *= col;`,
        )
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = fRough;')
        .replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
          {
            vec3 fSpec = vec3(0.0);
            vec3 fN = vec3(0.0, 1.0, 0.0);
            float fShin = mix(4.0, 1400.0, pow(1.0 - roughnessFactor, 4.0));
            vec3 fDiff = poolLight(vGW + vec3(0.0, 1.0, 0.0), fN, fShin, fSpec);
            reflectedLight.directDiffuse += fDiff * material.diffuseColor;
            reflectedLight.directSpecular += fSpec * (1.0 - roughnessFactor) * (0.5 + fShin * 0.003);
            float fLit = dot(reflectedLight.directDiffuse, vec3(0.333));
            reflectedLight.indirectDiffuse += material.diffuseColor * uShadowFill * 1.1 * (1.0 - smoothstep(0.0, 0.2, fLit));
          }`,
        )
        .replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
          {
            float fm = ncMist(vGW);
            gl_FragColor.rgb = ncFog(gl_FragColor.rgb, fm, poolLightFlat(vGW + vec3(0.0, 18.0, 0.0)) * 0.3);
            gl_FragColor.rgb *= 1.0 - clamp((max(abs(vGW.x), abs(vGW.z)) - 2200.0) / 24.0, 0.0, 1.0);
          }`,
        );
    };
    this.material.customProgramCacheKey = () => 'nc-funhouse-floor-v3';
    const geo = new THREE.PlaneGeometry(4800, 4800, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3; // after the actors, like the Carnival Core's ground (D-58)
  }

  update(time: number, _dawn: number): void {
    this.u.uTime.value = time;
  }
}
