// Screen-space overlay pass (doc 02 §6): vignette, low-HP red pulse, hurt tint, "Lights Out"
// darkness bubble, screen flashes, drifting fog and the dawn sunrise glow. All reducible in options.

import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
uniform float uTime, uLowHp, uHurt, uDark, uFlash, uDawn, uVig, uFog, uAspect;
uniform vec3 uFlashCol;
uniform vec2 uCam;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
void main() {
  vec2 p = vUv - 0.5;
  p.x *= uAspect;
  float r = length(p);
  vec4 col = vec4(0.0);
  // vignette
  float v = smoothstep(0.45, 1.05, r) * uVig;
  col = vec4(0.02, 0.0, 0.05, v);
  // drifting ground fog (world-anchored so it slides as the camera moves)
  if (uFog > 0.0) {
    vec2 w = (vUv - 0.5) * vec2(uAspect, 1.0) * 1000.0 + vec2(uCam.x, -uCam.y);
    float f = noise(w * 0.0025 + vec2(uTime * 0.03, uTime * 0.01)) * 0.6 + noise(w * 0.006 - vec2(uTime * 0.05, 0.0)) * 0.4;
    float fogA = smoothstep(0.45, 0.85, f) * 0.13 * uFog * (1.0 - uDawn);
    col.rgb = mix(col.rgb, vec3(0.55, 0.55, 0.7), fogA / max(col.a + fogA, 0.001));
    col.a = col.a + fogA * (1.0 - col.a);
  }
  // Lights Out: everything beyond the lantern bubble goes black
  if (uDark > 0.001) {
    float bubble = smoothstep(0.18, 0.42, r);
    float a = bubble * uDark * 0.94;
    col.rgb = mix(col.rgb, vec3(0.0), a / max(col.a + a, 0.001));
    col.a = col.a + a * (1.0 - col.a);
  }
  // low HP: pulsing red edges
  if (uLowHp > 0.0) {
    float pulse = 0.55 + 0.45 * sin(uTime * 6.0);
    float a = smoothstep(0.35, 0.95, r) * uLowHp * pulse * 0.75;
    col.rgb = mix(col.rgb, vec3(0.8, 0.0, 0.05), a / max(col.a + a, 0.001));
    col.a = col.a + a * (1.0 - col.a);
  }
  if (uHurt > 0.0) {
    float a = (0.12 + smoothstep(0.2, 0.9, r) * 0.4) * uHurt;
    col.rgb = mix(col.rgb, vec3(1.0, 0.1, 0.1), a / max(col.a + a, 0.001));
    col.a = col.a + a * (1.0 - col.a);
  }
  // dawn: warm wash from the south-east and soft god-rays
  if (uDawn > 0.0) {
    float sky = smoothstep(-0.2, 0.9, vUv.x * 0.4 + (1.0 - vUv.y) * 0.8);
    float rays = 0.5 + 0.5 * sin(atan(p.y + 0.8, p.x - 0.6) * 18.0 + uTime * 0.3);
    vec3 warm = mix(vec3(1.0, 0.55, 0.3), vec3(1.0, 0.85, 0.55), sky);
    float a = uDawn * (0.18 + 0.22 * sky + 0.08 * rays);
    col.rgb = mix(col.rgb, warm, a / max(col.a + a, 0.001));
    col.a = col.a + a * (1.0 - col.a);
  }
  if (uFlash > 0.0) {
    col.rgb = mix(col.rgb, uFlashCol, uFlash / max(col.a + uFlash, 0.001));
    col.a = col.a + uFlash * 0.85 * (1.0 - col.a);
  }
  gl_FragColor = col;
}`;

export interface PostParams {
  time: number;
  lowHp: number;
  hurt: number;
  darkness: number;
  flash: number;
  flashCol: [number, number, number];
  dawn: number;
  vignette: number;
  fog: number;
  camX: number;
  camY: number;
}

export class PostFx {
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 }, uLowHp: { value: 0 }, uHurt: { value: 0 }, uDark: { value: 0 }, uFlash: { value: 0 },
        uDawn: { value: 0 }, uVig: { value: 0.4 }, uFog: { value: 1 }, uAspect: { value: 1.6 },
        uFlashCol: { value: new THREE.Vector3(1, 1, 1) }, uCam: { value: new THREE.Vector2() },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  resize(w: number, h: number): void {
    this.material.uniforms.uAspect.value = w / h;
  }

  update(p: PostParams): void {
    const u = this.material.uniforms;
    u.uTime.value = p.time;
    u.uLowHp.value = p.lowHp;
    u.uHurt.value = p.hurt;
    u.uDark.value = p.darkness;
    u.uFlash.value = Math.min(0.85, p.flash);
    (u.uFlashCol.value as THREE.Vector3).set(p.flashCol[0], p.flashCol[1], p.flashCol[2]);
    u.uDawn.value = p.dawn;
    u.uVig.value = p.vignette;
    u.uFog.value = p.fog;
    (u.uCam.value as THREE.Vector2).set(p.camX, p.camY);
  }
}
