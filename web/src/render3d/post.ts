// Post-processing (D-37): HDR render → bloom (bulbs, signage, projectiles) → ACES tone map →
// vintage grade: partial desaturation with split toning (cold shadows, amber highlights), contrast,
// film grain, gate weave flicker, vignette, plus the gameplay overlays (low-HP pulse, hurt tint,
// Lights Out bubble, screen flash, dawn wash). Low quality skips bloom and grain.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const GRADE = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAspect: { value: 1.7 },
    uSat: { value: 0.86 },
    uGrain: { value: 0.06 },
    uVig: { value: 0.5 },
    uLowHp: { value: 0 },
    uHurt: { value: 0 },
    uDark: { value: 0 },
    uFlash: { value: 0 },
    uFlashCol: { value: new THREE.Vector3(1, 1, 1) },
    uDawn: { value: 0 },
    uHighContrast: { value: 0 },
    uFocusUv: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uAspect, uSat, uGrain, uVig, uLowHp, uHurt, uDark, uFlash, uDawn, uHighContrast;
    uniform vec3 uFlashCol;
    uniform vec2 uFocusUv;
    varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      // selective saturation: dull the world, keep strong emissives (already bright) punchy
      float keep = smoothstep(0.55, 1.0, lum);
      c = mix(vec3(lum), c, mix(uSat, 1.0, keep * 0.6 + uHighContrast * 0.4));
      // split tone: cold shadows, sodium/amber highlights
      c += vec3(-0.008, 0.004, 0.03) * (1.0 - smoothstep(0.0, 0.35, lum));
      c += vec3(0.045, 0.018, -0.025) * smoothstep(0.35, 1.0, lum);
      c = max(c, vec3(0.006, 0.009, 0.022)); // night lows stay inky blue
      // gentle S-curve
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.25 + uHighContrast * 0.2);
      vec2 p = vUv - 0.5;
      p.x *= uAspect;
      float r = length(p);
      // projector flicker + grain
      float flick = 1.0 + (h(vec2(floor(uTime * 24.0), 3.7)) - 0.5) * 0.025 * uGrain * 10.0;
      c *= flick;
      float g = h(vUv * vec2(1920.0, 1080.0) + fract(uTime * 7.31) * 100.0) - 0.5;
      c += g * uGrain * (0.6 + 0.4 * (1.0 - lum));
      // vignette
      c *= 1.0 - smoothstep(0.42, 1.05, r) * uVig;
      // Lights Out: everything beyond the lantern bubble sinks into black
      if (uDark > 0.001) {
        vec2 q = vUv - uFocusUv;
        q.x *= uAspect;
        float b = smoothstep(0.16, 0.42, length(q));
        c *= 1.0 - b * uDark * 0.95;
      }
      if (uLowHp > 0.0) {
        float pulse = 0.55 + 0.45 * sin(uTime * 6.0);
        float a = smoothstep(0.35, 0.95, r) * uLowHp * pulse * 0.7;
        c = mix(c, vec3(0.55, 0.0, 0.03), a);
      }
      if (uHurt > 0.0) c = mix(c, vec3(0.9, 0.08, 0.06), (0.1 + smoothstep(0.2, 0.9, r) * 0.38) * uHurt);
      if (uDawn > 0.0) {
        float sky = smoothstep(-0.2, 0.9, vUv.x * 0.4 + vUv.y * 0.8);
        vec3 warm = mix(vec3(1.0, 0.5, 0.28), vec3(1.0, 0.82, 0.55), sky);
        c = mix(c, c * warm * 1.6 + warm * 0.08, uDawn * (0.35 + 0.25 * sky));
      }
      c = mix(c, uFlashCol, min(0.85, uFlash));
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export interface PostParams {
  time: number;
  lowHp: number;
  hurt: number;
  darkness: number;
  flash: number;
  flashCol: [number, number, number];
  dawn: number;
  vignette: number;
  focusU: number;
  focusV: number;
  highContrast: boolean;
}

export class Post3D {
  composer: EffectComposer;
  private render: RenderPass;
  bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private output: OutputPass;
  quality: 'low' | 'medium' | 'high' = 'high';
  /** Scales bloom (eased down while a large, bulb-studded overlay like the prize wheel fills the screen). */
  bloomScale = 1;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(renderer, rt);
    this.render = new RenderPass(scene, camera);
    // radius≈1 weights the widest mips most: soft, diffuse halos instead of glows shaped like their source
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.98, 0.74);
    this.output = new OutputPass();
    this.grade = new ShaderPass(GRADE);
    this.composer.addPass(this.render);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);
    this.composer.addPass(this.grade);
  }

  setQuality(q: 'low' | 'medium' | 'high'): void {
    this.quality = q;
    this.bloom.enabled = q !== 'low';
    this.grade.uniforms.uGrain.value = q === 'low' ? 0 : 0.055;
  }

  setSize(w: number, h: number, pr: number): void {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    // bloom at reduced resolution is plenty for soft bulb glow
    const bs = this.quality === 'high' ? 0.5 : 0.35;
    this.bloom.setSize(Math.max(64, Math.round(w * pr * bs)), Math.max(64, Math.round(h * pr * bs)));
    this.grade.uniforms.uAspect.value = w / h;
  }

  update(p: PostParams): void {
    const u = this.grade.uniforms;
    u.uTime.value = p.time;
    this.bloom.strength = 0.85 * this.bloomScale;
    u.uLowHp.value = p.lowHp;
    u.uHurt.value = p.hurt;
    u.uDark.value = p.darkness;
    u.uFlash.value = p.flash;
    (u.uFlashCol.value as THREE.Vector3).set(p.flashCol[0], p.flashCol[1], p.flashCol[2]);
    u.uDawn.value = p.dawn;
    u.uVig.value = p.vignette;
    u.uHighContrast.value = p.highContrast ? 1 : 0;
    (u.uFocusUv.value as THREE.Vector2).set(p.focusU, p.focusV);
  }

  renderFrame(): void {
    this.composer.render();
  }
}
