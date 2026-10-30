// The Carnival Core ground: a low-res painted layout (paths, plaza, promenade, worn grass, decals)
// multiplied by high-frequency procedural detail in the shader (grain, cobbles, planks), plus the
// animated moonlit sea to the south and dark woods beyond the fence. Lit by the shared light rig.

import * as THREE from 'three';
import { MAP_HALF, PATHS, PLAZA, PROMENADE, SEA_Y, TILT_A_WHIRL, GREASE_SLICKS } from '../data/map';
import { artRng } from './art/kit';
import { LIGHT_GLSL, type LightRig } from './lights';

const EXTENT = 3200; // half-size of the ground plane (world units)
const PAINT = 2048;

function worldToPaint(v: number): number {
  return ((v + EXTENT) / (EXTENT * 2)) * PAINT;
}

/** R,G,B = albedo; A = surface type (1 grass/dirt, ~0.67 cobble, ~0.33 planks). Never 0: canvas is premultiplied. */
function paintGround(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = PAINT;
  const ctx = c.getContext('2d')!;
  const s = PAINT / (EXTENT * 2);
  const r = artRng(1931);
  // base: trampled night grass / packed dirt
  ctx.fillStyle = '#4a4a3a';
  ctx.fillRect(0, 0, PAINT, PAINT);
  // blotchy variation
  for (let i = 0; i < 1400; i++) {
    const x = r() * PAINT, y = r() * PAINT, rad = 10 + r() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const k = r();
    const col = k < 0.4 ? '74,70,50' : k < 0.7 ? '50,58,40' : k < 0.9 ? '86,74,56' : '40,44,34';
    g.addColorStop(0, `rgba(${col},0.35)`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // outside the fence: dark woods floor
  ctx.fillStyle = 'rgba(14,16,20,0.78)';
  const m0 = worldToPaint(-MAP_HALF), m1 = worldToPaint(MAP_HALF);
  ctx.fillRect(0, 0, PAINT, m0);
  ctx.fillRect(0, 0, m0, PAINT);
  ctx.fillRect(m1, 0, PAINT - m1, PAINT);
  // dirt paths
  const strokePath = (pts: [number, number][], w: number, col: string) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(worldToPaint(x), worldToPaint(y)) : ctx.moveTo(worldToPaint(x), worldToPaint(y))));
    ctx.lineWidth = w * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = col;
    ctx.stroke();
  };
  for (const p of PATHS) {
    strokePath(p.pts, p.w + 40, 'rgba(70,58,44,0.55)');
    strokePath(p.pts, p.w, '#7a6248');
    strokePath(p.pts, p.w * 0.55, 'rgba(140,112,82,0.35)');
  }
  // plaza ring (cobbles: alpha ~0.5)
  ctx.save();
  ctx.beginPath();
  ctx.arc(worldToPaint(PLAZA.x), worldToPaint(PLAZA.y), PLAZA.r * s, 0, Math.PI * 2);
  ctx.fillStyle = '#857a6c';
  ctx.fill();
  ctx.restore();
  // tilt-a-whirl pad, grease slicks
  ctx.beginPath();
  ctx.ellipse(worldToPaint(TILT_A_WHIRL.x), worldToPaint(TILT_A_WHIRL.y), 300 * s, 210 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30,24,40,0.6)';
  ctx.fill();
  for (const gs of GREASE_SLICKS) {
    const x = worldToPaint(gs.x), y = worldToPaint(gs.y), rad = gs.r * s;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(200,170,60,0.75)');
    g.addColorStop(0.8, 'rgba(140,120,40,0.45)');
    g.addColorStop(1, 'rgba(140,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // decals: spilled popcorn, lost tickets, puddles, cracks, tufts
  for (let i = 0; i < 2600; i++) {
    const x = r() * PAINT, y = r() * PAINT;
    const k = r();
    if (k < 0.35) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '255,240,200' : '240,200,120'},${0.25 + r() * 0.3})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    } else if (k < 0.5) {
      ctx.fillStyle = `rgba(${['200,60,60', '80,140,220', '230,200,90'][Math.floor(r() * 3)]},0.35)`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r() * 3);
      ctx.fillRect(-2, -1, 4, 2);
      ctx.restore();
    } else if (k < 0.56) {
      ctx.fillStyle = 'rgba(30,40,60,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + r() * 8, 2 + r() * 4, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (k < 0.62) {
      ctx.strokeStyle = 'rgba(20,16,12,0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14);
      ctx.lineTo(x + (r() - 0.5) * 20, y + (r() - 0.5) * 20);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '70,84,52' : '56,66,44'},0.5)`;
      ctx.fillRect(x, y, 1, 2 + r() * 2);
    }
  }
  // surface-type channel → alpha: write via a second pass using composite ops
  const img = ctx.getImageData(0, 0, PAINT, PAINT);
  const d = img.data;
  const plazaR = (PLAZA.r * s) ** 2;
  const px0 = worldToPaint(PLAZA.x), py0 = worldToPaint(PLAZA.y);
  const promY0 = worldToPaint(PROMENADE.y0), seaY = worldToPaint(SEA_Y);
  for (let y = 0; y < PAINT; y++) {
    for (let x = 0; x < PAINT; x++) {
      const i = (y * PAINT + x) * 4;
      let a = 255; // grass/dirt
      const dx = x - px0, dy = y - py0;
      if (dx * dx + dy * dy < plazaR) a = 170; // cobbles
      if (y >= promY0 && y < seaY && x > m0 && x < m1) a = 85; // planks
      d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const GROUND_VERT = /* glsl */ `
varying vec2 vW;
void main() {
  vW = vec2(position.x, -position.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const GROUND_FRAG = /* glsl */ `
uniform sampler2D uPaint;
uniform float uExtent;
uniform float uTime;
uniform float uSeaY;
uniform float uMapHalf;
uniform vec3 uMoonTint;
uniform float uDawn;
varying vec2 vW;
${LIGHT_GLSL}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec2 w = vW;
  vec2 uv = (w + uExtent) / (2.0 * uExtent);
  uv.y = 1.0 - uv.y;
  vec4 paint = texture2D(uPaint, uv);
  vec3 col = paint.rgb;
  float grain = fbm(w * 0.045) * 0.5 + fbm(w * 0.22) * 0.5;
  col *= 0.78 + grain * 0.45;
  float surf = paint.a;
  if (surf > 0.5 && surf < 0.85) {
    // cobblestones (cellular)
    vec2 cp = w / 26.0;
    vec2 ci = floor(cp);
    float best = 9.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = ci + vec2(float(x), float(y));
      vec2 o = g + 0.5 + 0.4 * (vec2(hash(g), hash(g + 7.0)) - 0.5);
      best = min(best, length(cp - o));
    }
    float stone = smoothstep(0.52, 0.36, best);
    col = mix(col * 0.45, col * (0.9 + 0.25 * hash(ci)), stone);
  } else if (surf < 0.5) {
    // boardwalk planks running east-west
    float row = floor(w.y / 30.0);
    float off = hash(vec2(row, 3.0)) * 200.0;
    float seamY = smoothstep(0.0, 2.5, abs(fract(w.y / 30.0) * 30.0 - 15.0) - 12.5);
    float seamX = smoothstep(0.0, 2.0, abs(fract((w.x + off) / 160.0) * 160.0 - 80.0) - 78.0);
    vec3 wood = mix(vec3(0.42, 0.3, 0.2), vec3(0.55, 0.4, 0.27), hash(vec2(row, floor((w.x + off) / 160.0))));
    wood *= 0.8 + 0.3 * noise(vec2(w.x * 0.06, w.y * 0.6));
    col = wood * (1.0 - 0.7 * max(seamY, seamX));
  }
  // the sea
  if (w.y > uSeaY) {
    float depth = clamp((w.y - uSeaY) / 600.0, 0.0, 1.0);
    float wave = noise(vec2(w.x * 0.01 + uTime * 0.12, w.y * 0.03 - uTime * 0.2)) * 0.6 + noise(vec2(w.x * 0.04 - uTime * 0.3, w.y * 0.08)) * 0.4;
    col = mix(vec3(0.05, 0.12, 0.2), vec3(0.02, 0.04, 0.1), depth) + wave * 0.06;
    float foam = smoothstep(0.08, 0.0, abs(w.y - uSeaY - 18.0 - sin(w.x * 0.02 + uTime) * 8.0) / 30.0);
    col += foam * vec3(0.5, 0.55, 0.6);
    // moon path on the water
    float path = exp(-pow((w.x - 300.0) / 260.0, 2.0)) * smoothstep(0.55, 0.85, wave) * (0.4 + depth);
    col += path * uMoonTint * 0.9;
  }
  // dark woods beyond the fence
  float out_ = max(max(abs(w.x) - uMapHalf, -w.y - uMapHalf), 0.0);
  col *= 1.0 - clamp(out_ / 400.0, 0.0, 0.75);
  vec3 L = lightAt(w);
  if (w.y > uSeaY) L = max(L, vec3(0.5, 0.55, 0.75));
  vec3 lit = col * L;
  gl_FragColor = vec4(lit, 1.0);
}`;

export class Ground {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  constructor(lights: LightRig) {
    const tex = new THREE.CanvasTexture(paintGround());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    this.material = new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      uniforms: {
        uPaint: { value: tex },
        uExtent: { value: EXTENT },
        uTime: { value: 0 },
        uSeaY: { value: SEA_Y },
        uMapHalf: { value: MAP_HALF },
        uMoonTint: { value: new THREE.Vector3(0.75, 0.8, 1.0) },
        uDawn: { value: 0 },
        ...lights.uniforms,
      },
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2), this.material);
    this.mesh.position.z = -1;
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }
  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }
}
