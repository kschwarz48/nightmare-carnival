// Atmosphere (D-41): the painterly night. Soft volumetric shafts pour from every lamp, light motes
// drift in the glow, layered fog rolls slowly across the midway (lit from within by the practicals
// so lamps bloom into halos), and faint moonbeams slant through the haze. Everything is additive or
// alpha over the opaque world; the player's lantern keeps a clearer bubble for readability.

import * as THREE from 'three';
import { LIGHTS, MAP_HALF, PROPS, SEA_Y } from '../../data/map';
import { EXTENT } from './paint';
import { POOL_GLSL } from '../core/pool';
import { pool } from '../core/materials';
import type { BillboardLayer } from '../core/billboard';
import type { Frame } from '../../render/atlas';
import { lampFlicker } from './props';
import { LAMP_LIGHT_H } from '../models/props';

const NOISE = /* glsl */ `
float aHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float aNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(aHash(i), aHash(i + vec2(1, 0)), u.x), mix(aHash(i + vec2(0, 1)), aHash(i + vec2(1, 1)), u.x), u.y);
}
float aFbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * aNoise(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; } return v; }
`;

// ------------------------------------------------------------------ volumetric lamp shafts
interface Shaft { x: number; y: number; h: number; r: number; col: [number, number, number]; flicker: number; k: number; kind: 'lamp' | 'ghost' | 'light' }
const PLAYED_COL: [number, number, number] = [1, 0.2, 0.14];

export class LightShafts {
  mesh: THREE.InstancedMesh;
  private aCol: THREE.InstancedBufferAttribute;
  private col: Float32Array;
  private shafts: Shaft[] = [];
  private uTime = { value: 0 };

  constructor(scene: THREE.Object3D) {
    for (const p of PROPS) {
      if (p.kind === 'lamp') this.shafts.push({ x: p.x, y: p.y, h: LAMP_LIGHT_H - 16, r: 112, col: [1, 0.58, 0.28], flicker: 0, k: p.x, kind: 'lamp' });
      if (p.kind === 'ghost_lamp') this.shafts.push({ x: p.x, y: p.y, h: LAMP_LIGHT_H - 16, r: 116, col: [0.45, 1, 0.72], flicker: 0, k: p.x, kind: 'ghost' });
    }
    for (const l of LIGHTS) if (l.r >= 300 && l.r <= 460) this.shafts.push({ x: l.x, y: l.y, h: 260, r: l.r * 0.42, col: l.color, flicker: l.flicker, k: l.x * 0.7, kind: 'light' });
    const geo = new THREE.CylinderGeometry(0.12, 1, 1, 24, 6, true);
    geo.translate(0, -0.5, 0); // apex at the lamp, base on the ground
    this.col = new Float32Array(this.shafts.length * 4);
    this.aCol = new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage) as THREE.InstancedBufferAttribute;
    geo.setAttribute('iCol', this.aCol);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.uTime, uViewDir: pool.uniforms.uViewDir },
      vertexShader: /* glsl */ `
        attribute vec4 iCol;
        varying vec4 vCol;
        varying float vV;
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vCol = iCol;
          vV = -position.y;           // 0 at the lamp, 1 at the ground
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix * instanceMatrix) * vec3(position.x, 0.25, position.z));
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uViewDir;
        varying vec4 vCol;
        varying float vV;
        varying vec3 vN;
        varying vec3 vW;
        ${NOISE}
        void main() {
          // soft edges (fade where the cone wall is seen edge-on), bright near the bulb
          float edge = pow(clamp(abs(dot(normalize(vN), uViewDir)), 0.0, 1.0), 1.6);
          float fall = pow(1.0 - vV, 1.35) * smoothstep(0.0, 0.08, vV);
          float dust = 0.75 + 0.5 * aFbm(vW.xz * 0.02 + vec2(0.0, vV * 3.0 - uTime * 0.15));
          float a = edge * fall * dust * vCol.a;
          gl_FragColor = vec4(vCol.rgb * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.shafts.length);
    const m = new THREE.Matrix4();
    this.shafts.forEach((s, i) => {
      m.makeScale(s.r, s.h, s.r).setPosition(s.x, s.h, s.y);
      this.mesh.setMatrixAt(i, m);
    });
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
  }

  update(time: number, darkness: number, dawn: number, ghostLit: (x: number, y: number) => number, ghostPlayed?: (x: number, y: number) => boolean): void {
    this.uTime.value = time;
    const on = (1 - darkness * 0.92) * (1 - dawn);
    this.shafts.forEach((s, i) => {
      let k = s.kind === 'light' ? 0.08 : 0.12;
      if (s.kind === 'lamp') k *= lampFlicker({ x: s.x, y: s.y }, time);
      if (s.kind === 'light' && s.flicker > 0) {
        const t = time * 7 + s.k;
        k *= 1 - s.flicker * (Math.sin(t) * 0.5 + 0.5) * (Math.sin(t * 2.7) > 0.6 ? 1 : 0.15);
      }
      if (s.kind === 'ghost') k *= ghostLit(s.x, s.y);
      // a soul lamp whose melody note has been played shines red
      const col = s.kind === 'ghost' && ghostPlayed?.(s.x, s.y) ? PLAYED_COL : s.col;
      const o = i * 4;
      this.col[o] = col[0];
      this.col[o + 1] = col[1];
      this.col[o + 2] = col[2];
      this.col[o + 3] = k * (s.kind === 'ghost' ? 1 : on);
    });
    this.aCol.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ drifting light motes
interface Mote { ax: number; ay: number; h: number; r: number; sp: number; ph: number; col: [number, number, number] }

export class Motes {
  private motes: Mote[] = [];
  constructor() {
    let seed = 1931;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const p of PROPS) {
      if (p.kind !== 'lamp' && p.kind !== 'ghost_lamp') continue;
      const ghost = p.kind === 'ghost_lamp';
      for (let k = 0; k < 7; k++) {
        this.motes.push({ ax: p.x + (rnd() - 0.5) * 60, ay: p.y + (rnd() - 0.5) * 60, h: 40 + rnd() * 90, r: 14 + rnd() * 46, sp: 0.2 + rnd() * 0.5, ph: rnd() * 100, col: ghost ? [0.45, 1, 0.72] : [1, 0.66, 0.34] });
      }
    }
  }
  draw(layer: BillboardLayer, glow: Frame, time: number, inView: (x: number, y: number) => boolean, strength: number): void {
    if (strength <= 0.01) return;
    for (const m of this.motes) {
      if (!inView(m.ax, m.ay)) continue;
      const t = time * m.sp + m.ph;
      const x = m.ax + Math.cos(t) * m.r + Math.sin(t * 2.3) * 8;
      const y = m.ay + Math.sin(t * 0.8) * m.r * 0.6;
      const h = m.h + Math.sin(t * 1.7) * 14;
      const tw = 0.5 + 0.5 * Math.sin(time * 3 + m.ph * 7);
      layer.draw(glow, x, y, h, 0.07 + 0.05 * tw, 0.07 + 0.05 * tw, 0, m.col[0], m.col[1], m.col[2], strength * (0.35 + 0.65 * tw));
    }
  }
}

// ------------------------------------------------------------------ slow rolling fog
const FOG_VERT = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FOG_FRAG = /* glsl */ `
varying vec3 vW;
uniform float uTime, uDensity, uDawn, uScale, uSpeed, uLayer, uMapHalf, uSeaY;
uniform vec2 uPlayer;
uniform vec2 uWind;
uniform vec3 uFogCol;
${NOISE}
${POOL_GLSL}
void main() {
  vec2 p = vW.xz * uScale;
  float t = uTime * uSpeed;
  // domain-warped fbm advected by the wind: banks that billow and roll rather than slide
  vec2 q = vec2(aFbm(p + uWind * t), aFbm(p + vec2(5.2, 1.3) - uWind.yx * t * 0.7));
  float f = aFbm(p + q * 1.8 + uWind * t * 0.6 + uLayer * 3.7);
  float dens = smoothstep(0.5 - uLayer * 0.03, 0.95, f) * uDensity;
  // thicker toward the edges of the midway and over the sea; the lantern keeps a clearer bubble
  float edge = smoothstep(uMapHalf * 0.55, uMapHalf * 1.05, max(abs(vW.x), abs(vW.z)));
  float sea = smoothstep(uSeaY - 300.0, uSeaY + 200.0, vW.z);
  dens *= 1.0 + edge * 0.8 + sea * 0.9;
  float dp = length(vW.xz - uPlayer);
  dens *= mix(0.22, 1.0, smoothstep(150.0, 430.0, dp));
  // lit from within: practicals bloom into halos, the moon silvers the tops of the banks
  vec3 glow = poolLightFlat(vW + vec3(0.0, 40.0, 0.0));
  vec3 lit = uFogCol * (0.75 + 0.5 * f) + glow * (0.5 + 0.12 * uLayer);
  dens *= 0.75 + 0.6 * clamp(dot(glow, vec3(0.333)), 0.0, 1.0); // fog thickens visibly where light catches it
  gl_FragColor = vec4(lit, clamp(dens, 0.0, 0.85) * (1.0 - uDawn * 0.75));
}`;

export class FogLayers {
  meshes: THREE.Mesh[] = [];
  private mats: THREE.ShaderMaterial[] = [];
  private shared = {
    uTime: { value: 0 },
    uDawn: { value: 0 },
    uPlayer: { value: new THREE.Vector2() },
    uWind: { value: new THREE.Vector2(1, 0.3) },
    uFogCol: { value: new THREE.Vector3(0.028, 0.036, 0.062) },
    uMapHalf: { value: MAP_HALF },
    uSeaY: { value: SEA_Y },
  };
  private base = [0.2, 0.13, 0.08];

  constructor(scene: THREE.Object3D) {
    const layers: [number, number, number][] = [[7, 0.0019, 0.016], [28, 0.0013, 0.011], [60, 0.0009, 0.008]];
    layers.forEach(([h, scale, speed], i) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: FOG_VERT,
        fragmentShader: FOG_FRAG,
        uniforms: { ...this.shared, ...pool.uniforms, uDensity: { value: this.base[i] }, uScale: { value: scale }, uSpeed: { value: speed * 60 }, uLayer: { value: i } },
        transparent: true,
        depthWrite: false,
      });
      const geo = new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2, 1, 1);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = h;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2 + i;
      scene.add(mesh);
      this.meshes.push(mesh);
      this.mats.push(mat);
    });
  }

  update(time: number, px: number, py: number, wind: number, dawn: number, darkness: number, quality: 'low' | 'medium' | 'high'): void {
    this.shared.uTime.value = time;
    this.shared.uPlayer.value.set(px, py);
    this.shared.uWind.value.set(Math.cos(wind), Math.sin(wind));
    this.shared.uDawn.value = dawn;
    const n = quality === 'low' ? 1 : quality === 'medium' ? 2 : 3;
    this.mats.forEach((m, i) => {
      this.meshes[i].visible = i < n;
      m.uniforms.uDensity.value = this.base[i] * (1 + darkness * 0.6) * (n === 1 ? 1.4 : 1);
    });
  }
}

// ------------------------------------------------------------------ moonbeams through the haze
export class MoonBeams {
  mesh: THREE.InstancedMesh;
  private uTime = { value: 0 };
  private uK = { value: 1 };
  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.uTime, uK: this.uK },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying float vI;
        void main() { vUv = uv; vI = float(gl_InstanceID); gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uK; varying vec2 vUv; varying float vI;
        void main() {
          float across = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
          float along = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.4, vUv.y);
          float breathe = 0.65 + 0.35 * sin(uTime * 0.21 + vI * 2.1);
          float a = across * along * breathe * 0.05 * uK;
          gl_FragColor = vec4(vec3(0.55, 0.68, 1.0) * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, 4);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }
  update(time: number, cx: number, cy: number, dawn: number, darkness: number): void {
    this.uTime.value = time;
    this.uK.value = (1 - dawn) * (1 - darkness * 0.7);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < 4; i++) {
      // beams slant from the west-north-west like the moon, drifting slowly with the clouds
      const drift = ((time * 6 + i * 520) % 2400) - 1200;
      q.setFromEuler(new THREE.Euler(0, -0.5, -0.62));
      s.set(140 + i * 50, 1200, 1);
      m.compose(new THREE.Vector3(cx + drift - 300, 0, cy - 300 + i * 180), q, s);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
