// The Boardwalk's ground (D-68): one shader for the whole floor plan. The ride grounds' packed earth and
// asphalt walks; the Arcade's checker tiles (some missing) and the Gift Shop's boards and rug; the
// promenade's long salt-bleached planks with staggered joints and a radial deck round the bandstand; the
// seawall's edge beam and steps; then the beach: dry wind-rippled sand, damp, then wet and glossy where the
// swash has just drained (reading the same waterline as the sea), and the rippled sea floor beneath the
// water, which slopes away offshore. Lit by the practical-light pool like every other surface.

import * as THREE from 'three';
import { ARCADE, BUILDINGS, FACADE_Y, GIFTSHOP, PIER_DECKS, PROMENADE, STAIRS, TIDE } from '../../../data/boardwalk';
import { POOL_GLSL } from '../../core/pool';
import { MIST_GLSL, pool, shared } from '../../core/materials';
import { SHORE_GLSL } from './ocean';

const NOISE = /* glsl */ `
float bwHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bwNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(bwHash(i), bwHash(i + vec2(1.0, 0.0)), u.x), mix(bwHash(i + vec2(0.0, 1.0)), bwHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float bwFbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * bwNoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }`;

export class BoardwalkFloor {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  readonly u: Record<string, THREE.IUniform>;

  constructor() {
    const solid = BUILDINGS.filter((b) => !b.open).map((b) => new THREE.Vector4(b.x0, b.y0, b.x1, b.y1));
    this.u = {
      uShoreOff: { value: 0 },
      uSeaTime: { value: 0 },
      uArcade: { value: new THREE.Vector4(ARCADE.x0, ARCADE.y0, ARCADE.x1, ARCADE.y1) },
      uShop: { value: new THREE.Vector4(GIFTSHOP.x0, GIFTSHOP.y0, GIFTSHOP.x1, GIFTSHOP.y1) },
      uSolid: { value: solid },
      uProm: { value: new THREE.Vector4(PROMENADE.x0, PROMENADE.y0, PROMENADE.x1, PROMENADE.y1) },
      uStairs: { value: STAIRS.map(([c, w]) => new THREE.Vector2(c, w)) },
      uDeck: { value: PIER_DECKS.map((r) => new THREE.Vector4(r.x0, r.y0, r.x1, r.y1)) },
    };
    // the floor gives way to anything lying flush on it (the pier's planks above all), never the reverse
    this.material = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
    const u = this.u;
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u, pool.uniforms, shared);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vGW;\nuniform vec4 uDeck[${PIER_DECKS.length}];\n${SHORE_GLSL}`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            // the sea floor falls away offshore (the beach where anyone walks stays level)
            vec4 bw = modelMatrix * vec4(transformed, 1.0);
            float d = bw.z - shoreAt(bw.x);
            // and the sand (or the low water's mud) drops away under the pier's decks, so the planks stand
            // clear of it instead of fighting it; the slope stays under the deck's edges
            float inDeck = -1e5;
            for (int i = 0; i < ${PIER_DECKS.length}; i++) {
              vec4 r = uDeck[i];
              inDeck = max(inDeck, min(min(bw.x - r.x, r.z - bw.x), min(bw.z - r.y, r.w - bw.z)));
            }
            transformed.y -= max(clamp((d - 40.0) * 0.2, 0.0, 90.0), 46.0 * smoothstep(-10.0, 40.0, inDeck));
          }`,
        )
        .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vGW;
          uniform vec4 uArcade, uShop, uProm;
          uniform vec4 uSolid[${solid.length}];
          uniform vec2 uStairs[${STAIRS.length}];
          uniform vec3 uShadowFill;
          ${SHORE_GLSL}
          ${NOISE}
          ${POOL_GLSL}
          ${MIST_GLSL}
          float inBox(vec2 p, vec4 b) { return step(b.x, p.x) * step(p.x, b.z) * step(b.y, p.y) * step(p.y, b.w); }`,
        )
        .replace(
          '#include <map_fragment>',
          `vec2 w = vGW.xz;
          vec3 col = vec3(0.1);
          float fRough = 0.85;
          float wet = 0.0;
          float shore = shoreAt(w.x);
          float dsea = w.y - shore;
          if (w.y > uProm.w + 70.0) {
            // ---- the beach: dry dark sand, wind ripples, damp then wet toward the water, the sea floor beyond
            float rip = sin(w.x * 0.045 + w.y * 0.012 + bwNoise(w * 0.004) * 6.0) * 0.5 + 0.5;
            float grain = bwFbm(w * 0.05);
            vec3 dry = mix(vec3(0.105, 0.095, 0.08), vec3(0.165, 0.148, 0.122), grain) * (0.88 + 0.16 * rip);
            // a few pale shells and pebbles, and kelp scraps toward the tide line
            float fleck = step(0.992, bwHash(floor(w / 9.0)));
            dry = mix(dry, vec3(0.3, 0.29, 0.27), fleck * 0.45);
            float kelp = smoothstep(0.78, 0.86, bwFbm(w * 0.013 + 3.0)) * smoothstep(-260.0, -60.0, dsea) * smoothstep(40.0, -40.0, dsea);
            dry = mix(dry, vec3(0.05, 0.07, 0.04), kelp * 0.85);
            // the wrack: the high-tide lines, broken strands of weed, splinters and froth left along the beach,
            // measured from the high-water mark (the tide moves the sea, not what it left behind)
            float dhigh = w.y - (shoreAt(w.x) - uShoreOff - ${TIDE.upBeach.toFixed(1)});
            float wl = 0.0;
            for (int k = 0; k < 2; k++) {
              float at = k == 0 ? -90.0 : -230.0;
              float off = 22.0 * sin(w.x * 0.0037 + float(k) * 2.1) + 9.0 * sin(w.x * 0.017 + float(k));
              float line = smoothstep(11.0 - float(k) * 3.0, 0.0, abs(dhigh - at - off));
              wl = max(wl, line * smoothstep(0.32, 0.55, bwNoise(w * vec2(0.022, 0.05) + float(k) * 7.0)) * (k == 0 ? 1.0 : 0.6));
            }
            dry = mix(dry, vec3(0.045, 0.05, 0.035), wl * 0.9);
            dry += vec3(0.06, 0.06, 0.055) * wl * step(0.93, bwHash(floor(w / 4.0)));
            float damp = smoothstep(-420.0, -60.0, dsea);
            col = mix(dry, dry * vec3(0.6, 0.6, 0.64), damp);
            // the swash: where the last wave reached and drained back, the sand is a dark glossy mirror
            float sw = swashAt(w);
            float reach = dsea + sw * 70.0 - 20.0;
            wet = smoothstep(-150.0, -15.0, reach) * (0.55 + 0.45 * sw) + smoothstep(-15.0, 30.0, reach);
            col = mix(col, vec3(0.06, 0.065, 0.07), clamp(wet, 0.0, 1.0) * 0.8);
            // the sea floor under the water: rippled, darker with depth
            float under = smoothstep(0.0, 260.0, dsea);
            float srip = sin(w.x * 0.03 - w.y * 0.08 + bwNoise(w * 0.006) * 5.0) * 0.5 + 0.5;
            col = mix(col, vec3(0.05, 0.06, 0.055) * (0.7 + 0.4 * srip), under);
            fRough = mix(0.95, 0.12, clamp(wet, 0.0, 1.0));
            fRough = mix(fRough, 0.4, under);
          } else if (w.y > uProm.w) {
            // ---- the seawall: the boardwalk's edge beam, and plank steps down to the sand at the gaps
            float gap = 0.0;
            for (int i = 0; i < ${STAIRS.length}; i++) gap = max(gap, step(abs(w.x - uStairs[i].x), uStairs[i].y * 0.5));
            float step2 = step(0.5, fract((w.y - uProm.w) / 17.0));
            vec3 beam = vec3(0.13, 0.1, 0.08) * (0.7 + 0.4 * bwNoise(w * vec2(0.02, 0.4)));
            vec3 stairs = mix(vec3(0.22, 0.19, 0.15), vec3(0.11, 0.09, 0.07), step2);
            vec3 sand = vec3(0.17, 0.155, 0.13) * (0.85 + 0.2 * bwFbm(w * 0.04));
            col = mix(mix(beam, sand, smoothstep(30.0, 70.0, w.y - uProm.w)), stairs, gap);
            fRough = 0.85;
          } else if (w.y > uProm.y) {
            // ---- the promenade: long boards running east-west, staggered joints, nails, salt and wear
            vec2 pc = w - vec2(0.0, -470.0);
            float rad = length(pc);
            float plank, along;
            if (rad < 330.0 && w.x > -600.0 && w.x < 900.0) {
              // a radial deck round the bandstand
              float a = atan(pc.y, pc.x);
              plank = floor(rad / 28.0);
              along = a * rad / 260.0 + bwHash(vec2(plank, 4.0)) * 9.0;
            } else {
              plank = floor(w.y / 27.0);
              along = w.x / (240.0 + 160.0 * bwHash(vec2(plank, 1.0))) + bwHash(vec2(plank, 2.0)) * 7.0;
            }
            float board = floor(along);
            float tone = bwHash(vec2(plank, board));
            float seamY = rad < 330.0 && w.x > -600.0 && w.x < 900.0 ? fract(rad / 28.0) : fract(w.y / 27.0);
            float seam = smoothstep(0.0, 0.07, seamY) * smoothstep(1.0, 0.93, seamY);
            float joint = smoothstep(0.0, 0.012, fract(along)) * smoothstep(1.0, 0.988, fract(along));
            vec3 wood = mix(vec3(0.13, 0.105, 0.085), vec3(0.25, 0.215, 0.18), tone);
            // salt bleaches the boards grey toward the sea; grain streaks along each board
            wood = mix(wood, vec3(0.38, 0.37, 0.36), smoothstep(-500.0, -150.0, w.y) * 0.35 * bwNoise(w * 0.01));
            wood *= 0.8 + 0.3 * bwNoise(vec2(w.x * 0.06, plank * 3.7));
            col = wood * mix(0.22, 1.0, seam * joint);
            // sand blown up over the seaward boards, wet patches that hold the lamplight
            float drift = smoothstep(-260.0, -140.0, w.y) * smoothstep(0.45, 0.75, bwFbm(w * 0.01));
            col = mix(col, vec3(0.2, 0.18, 0.15) * (0.9 + 0.2 * bwFbm(w * 0.06)), drift * 0.7);
            float puddle = smoothstep(0.66, 0.72, bwFbm(w * 0.004 + 7.0)) * (1.0 - drift);
            wet = puddle;
            col = mix(col, col * 0.55, puddle);
            fRough = mix(0.78, 0.1, puddle);
          } else if (inBox(w, uArcade) > 0.5) {
            // ---- the Arcade: black and cream tiles, a good many missing, grime in the grout
            vec2 t = floor(w / 60.0), f = fract(w / 60.0);
            float chk = mod(t.x + t.y, 2.0);
            col = mix(vec3(0.03, 0.03, 0.035), vec3(0.42, 0.39, 0.33), chk);
            float grout = smoothstep(0.0, 0.04, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
            col *= mix(0.4, 1.0, grout);
            float gone = step(0.88, bwHash(t + 17.0));
            col = mix(col, vec3(0.07, 0.055, 0.045) * (0.8 + 0.4 * bwNoise(w * 0.2)), gone);
            fRough = mix(0.35, 0.95, gone);
          } else if (inBox(w, uShop) > 0.5) {
            // ---- the Gift Shop: narrow boards and a faded red rug in front of the counter
            float plank = floor(w.x / 18.0);
            float tone = bwHash(vec2(plank, 5.0));
            col = mix(vec3(0.17, 0.11, 0.07), vec3(0.28, 0.19, 0.12), tone) * (0.8 + 0.3 * bwNoise(vec2(plank * 3.1, w.y * 0.05)));
            col *= mix(0.45, 1.0, smoothstep(0.0, 0.08, fract(w.x / 18.0)));
            vec2 rc = w - vec2(1900.0, -1060.0);
            float rug = step(abs(rc.x), 260.0) * step(abs(rc.y), 150.0);
            float border = rug * (step(240.0, abs(rc.x)) + step(130.0, abs(rc.y)));
            col = mix(col, mix(vec3(0.28, 0.06, 0.06), vec3(0.42, 0.32, 0.14), clamp(border, 0.0, 1.0)) * (0.8 + 0.3 * bwNoise(w * 0.05)), rug);
            fRough = mix(0.7, 0.95, rug);
          } else {
            // ---- the ride grounds: packed dark earth, gravel, asphalt walks to the rides, weeds
            float g = bwFbm(w * 0.012);
            col = mix(vec3(0.07, 0.065, 0.06), vec3(0.13, 0.115, 0.1), g);
            float gravel = step(0.86, bwHash(floor(w / 5.0)));
            col = mix(col, vec3(0.25, 0.24, 0.22), gravel * 0.45);
            // the service walk behind the façades, and walks up to the wheel, the tower and the kraken
            float walk = step(abs(w.y - (${FACADE_Y.toFixed(1)} - 260.0)), 70.0);
            walk = max(walk, step(abs(w.x - 300.0), 80.0) * step(w.y, -1450.0));
            walk = max(walk, step(abs(w.x - (-1300.0)), 70.0) * step(w.y, -1520.0));
            walk = max(walk, step(abs(w.x - (-2600.0)), 70.0) * step(w.y, -1240.0));
            vec3 asphalt = vec3(0.06, 0.06, 0.065) * (0.75 + 0.4 * bwFbm(w * 0.03));
            float crack = smoothstep(0.02, 0.0, abs(bwNoise(w * 0.01) - 0.5)) * 0.6;
            asphalt *= 1.0 - crack;
            col = mix(col, asphalt, walk);
            float weed = smoothstep(0.7, 0.8, bwFbm(w * 0.02 + 5.0)) * (1.0 - walk);
            col = mix(col, vec3(0.05, 0.07, 0.035), weed * 0.6);
            fRough = mix(0.95, 0.75, walk);
            for (int i = 0; i < ${solid.length}; i++) if (inBox(w, uSolid[i]) > 0.5) col *= 0.4;
          }
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
            reflectedLight.directDiffuse += fDiff * material.diffuseColor;
            reflectedLight.directSpecular += fSpec * (1.0 - roughnessFactor) * (0.6 + fShin * 0.003) * (1.0 + wet * 1.5);
            float fLit = dot(reflectedLight.directDiffuse, vec3(0.333));
            reflectedLight.indirectDiffuse += material.diffuseColor * uShadowFill * 1.15 * (1.0 - smoothstep(0.0, 0.2, fLit));
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
    this.material.customProgramCacheKey = () => 'nc-boardwalk-floor-v3';
    // tessellated along the shore so the sea floor can slope away (finer across the beach band)
    const geo = new THREE.PlaneGeometry(10400, 7600, 208, 190);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 1100);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  update(time: number, _dawn: number, shoreOff = 0): void {
    this.u.uSeaTime.value = time;
    this.u.uShoreOff.value = shoreOff;
  }
}
