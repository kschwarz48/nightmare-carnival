// Shared light rig (doc 02 §3): a night ambient tint plus point lights (attractions, the player's
// lantern, boss glows, explosion flashes). Ground and sprite shaders evaluate the same function.

import * as THREE from 'three';

export const MAX_LIGHTS = 40;

export const LIGHT_GLSL = /* glsl */ `
uniform vec4 uLights[${MAX_LIGHTS}];   // x, y (sim), radius, intensity
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform int uLightCount;
uniform vec3 uAmbient;
vec3 lightAt(vec2 p) {
  vec3 acc = uAmbient;
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightCount) break;
    vec4 L = uLights[i];
    vec2 d = p - L.xy;
    float k = clamp(1.0 - dot(d, d) / (L.z * L.z), 0.0, 1.0);
    acc += uLightCol[i] * (k * k) * L.w;
  }
  return acc;
}`;

export class LightRig {
  lights: THREE.Vector4[] = [];
  cols: THREE.Vector3[] = [];
  count = 0;
  uniforms: Record<string, THREE.IUniform>;

  constructor() {
    for (let i = 0; i < MAX_LIGHTS; i++) {
      this.lights.push(new THREE.Vector4());
      this.cols.push(new THREE.Vector3());
    }
    this.uniforms = {
      uLights: { value: this.lights },
      uLightCol: { value: this.cols },
      uLightCount: { value: 0 },
      uAmbient: { value: new THREE.Vector3(0.3, 0.28, 0.45) },
    };
  }

  begin(): void {
    this.count = 0;
  }
  add(x: number, y: number, r: number, intensity: number, cr: number, cg: number, cb: number): void {
    if (this.count >= MAX_LIGHTS || intensity <= 0.001) return;
    this.lights[this.count].set(x, y, r, intensity);
    this.cols[this.count].set(cr, cg, cb);
    this.count++;
  }
  end(): void {
    this.uniforms.uLightCount.value = this.count;
  }
  setAmbient(r: number, g: number, b: number): void {
    (this.uniforms.uAmbient.value as THREE.Vector3).set(r, g, b);
  }
}
