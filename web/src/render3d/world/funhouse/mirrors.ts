// The Hall of Mirrors' glass (D-63). Real planar reflections where they read best, kept cheap:
// - the camera looks north, so only south-facing glass is seen face-on; the maze is built on rows, so
//   that glass lies on a handful of planes, each with one low-resolution reflection target;
// - a plane renders from the main camera reflected across it (the Reflector technique), with the view
//   tightened to that row's glass and an oblique near plane cutting off whatever stands behind it
//   (no shader variants, so no compile stalls); only rows on screen update, two a frame, round-robin;
// - the glass shader projects the texture back, silvers and ages it, wobbles the warped panels, shows
//   the lagging panels a copy taken half a second ago, and makes the quest's door ripple;
// - the reflection cameras also see layer 2, the MIRROR-ONLY layer: things that exist only in mirrors.

import * as THREE from 'three';
import type { Prop } from '../../../data/map';
import { PANEL } from '../../../data/funhouse';
import { WALL_H } from './models';

export const MIRROR_ONLY_LAYER = 2;
/**
 * The glass leans back a little in its reflection (not in the world): an upright mirror seen by a camera
 * looking 50 degrees down shows only the floor and people's shins; leaned 12 degrees it reflects at 26
 * degrees below the horizon, so whoever stands within a cell or so shows from head to toe.
 */
const LEAN = (12 * Math.PI) / 180;

const VERT = /* glsl */ `
uniform mat4 uTexMat;
attribute float aVar;
attribute vec2 aLocal;
varying vec4 vProj;
varying vec2 vLocal;
varying float vVar;
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vProj = uTexMat * w;
  vLocal = aLocal;
  vVar = aVar;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform sampler2D tReflect, tLag;
uniform float uTime, uLive, uDoor;
varying vec4 vProj;
varying vec2 vLocal;
varying float vVar;
varying vec3 vW;
float mh(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float mn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(mh(i), mh(i + vec2(1, 0)), u.x), mix(mh(i + vec2(0, 1)), mh(i + vec2(1, 1)), u.x), u.y); }
void main() {
  vec2 uv = vProj.xy / vProj.w;
  float warped = step(0.5, vVar) * step(vVar, 1.5);
  float lagging = step(1.5, vVar) * step(vVar, 2.5);
  float door = step(2.5, vVar);
  // a funhouse panel: the reflection swims and stretches
  uv += warped * vec2(sin(vLocal.y * 9.0 + uTime * 1.3) * 0.035, sin(vLocal.x * 7.0 + uTime) * 0.05);
  // the quest's door: once open, the glass breathes like water
  uv += door * uDoor * vec2(sin(vLocal.y * 22.0 - uTime * 3.0), cos(vLocal.x * 18.0 + uTime * 2.4)) * 0.012;
  vec3 live = texture2D(tReflect, uv).rgb;
  vec3 late = texture2D(tLag, uv).rgb;
  vec3 col = mix(live, late, lagging);
  // old silvering: a cool tint, foxing spots that grow toward the edges, a vignette at the frame
  float edge = min(min(vLocal.x, 1.0 - vLocal.x), min(vLocal.y, 1.0 - vLocal.y));
  float fox = smoothstep(0.62, 0.8, mn(vLocal * vec2(9.0, 6.0) + vW.xz * 0.004)) * (1.0 - smoothstep(0.0, 0.25, edge)) ;
  col = col * vec3(0.94, 0.97, 1.0) + vec3(0.02, 0.026, 0.032);
  col = mix(col, vec3(0.05, 0.045, 0.04), fox * 0.7);
  col *= 0.7 + 0.3 * smoothstep(0.0, 0.08, edge);
  // without a live reflection (low quality, never rendered yet): a dim silver sheen
  col = mix(vec3(0.05, 0.06, 0.07) + vec3(0.12) * vLocal.y, col, uLive);
  // a sheen that slides with the viewer
  col += vec3(0.05, 0.06, 0.07) * smoothstep(0.8, 1.0, sin(vLocal.x * 3.0 - vLocal.y * 2.0 + vW.x * 0.004));
  col += door * vec3(0.25, 0.9, 0.8) * uDoor * (0.25 + 0.2 * sin(uTime * 2.0 + vLocal.y * 10.0));
  gl_FragColor = vec4(col, 1.0);
}`;

interface Row {
  z: number;
  x0: number;
  x1: number;
  rt: THREE.WebGLRenderTarget;
  lag: THREE.WebGLRenderTarget | null;
  lagT: number;
  mat: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  cam: THREE.OrthographicCamera;
  live: boolean;
  last: number;
}

/** The south faces of the maze's glass, grouped by plane, and the machinery to reflect them. */
export class MirrorSystem {
  readonly group = new THREE.Group();
  private rows: Row[] = [];
  private turn = 0;
  private copyScene = new THREE.Scene();
  private copyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private copyQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private tmp = { v: new THREE.Vector3(), t: new THREE.Vector3(), up: new THREE.Vector3(), n: new THREE.Vector3(), rot: new THREE.Matrix4(), corners: [0, 1, 2, 3].map(() => new THREE.Vector3()) };
  doorOpen = 0;

  /** `glass`: the south-facing panels (static glass and the quest's door). */
  constructor(glass: Prop[]) {
    const H = WALL_H.mirror;
    const byZ = new Map<number, Prop[]>();
    for (const p of glass) {
      const z = Math.round(p.y + PANEL);
      (byZ.get(z) ?? byZ.set(z, []).get(z)!).push(p);
    }
    for (const [z, list] of byZ) {
      const pos: number[] = [], vari: number[] = [], loc: number[] = [], idx: number[] = [];
      let x0 = Infinity, x1 = -Infinity;
      for (const p of list) {
        const a = p.x - (p.hw ?? 120) + 14, b = p.x + (p.hw ?? 120) - 14;
        x0 = Math.min(x0, a);
        x1 = Math.max(x1, b);
        const base = pos.length / 3;
        const zz = z + 0.8;
        pos.push(a, 14, zz, b, 14, zz, b, H - 14, zz, a, H - 14, zz);
        loc.push(0, 0, 1, 0, 1, 1, 0, 1);
        const v = p.style === 'door' ? 3 : p.variant ?? 0;
        vari.push(v, v, v, v);
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('aVar', new THREE.Float32BufferAttribute(vari, 1));
      geo.setAttribute('aLocal', new THREE.Float32BufferAttribute(loc, 2));
      geo.setIndex(idx);
      const lagged = list.some((p) => p.variant === 2);
      const rt = new THREE.WebGLRenderTarget(512, 160, { type: THREE.HalfFloatType });
      const lag = lagged ? new THREE.WebGLRenderTarget(512, 160, { type: THREE.HalfFloatType }) : null;
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { tReflect: { value: rt.texture }, tLag: { value: (lag ?? rt).texture }, uTexMat: { value: new THREE.Matrix4() }, uTime: { value: 0 }, uLive: { value: 0 }, uDoor: { value: 0 } },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.rows.push({ z, x0, x1, rt, lag, lagT: 0, mat, mesh, cam: new THREE.OrthographicCamera(), live: false, last: -1 });
    }
    this.copyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
    this.copyScene.add(this.copyQuad);
  }

  /**
   * Refresh the reflections for this frame (call after every batch is filled, before the frame is
   * composited). `budget` planes at most; low quality passes 0 and the glass shows a plain sheen.
   */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, main: THREE.OrthographicCamera, time: number, viewX0: number, viewX1: number, viewY0: number, viewY1: number, budget: number, hide: THREE.Object3D[]): void {
    for (const r of this.rows) {
      r.mat.uniforms.uTime.value = time;
      r.mat.uniforms.uDoor.value = this.doorOpen;
    }
    if (budget <= 0) return;
    const visible = this.rows.filter((r) => r.z > viewY0 && r.z < viewY1 + 200 && r.x1 > viewX0 && r.x0 < viewX1);
    if (!visible.length) return;
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    for (const r of this.rows) r.mesh.visible = false;
    const hidden = hide.filter((o) => o.visible);
    for (const o of hidden) o.visible = false;
    for (let k = 0; k < Math.min(budget, visible.length); k++) {
      const r = visible[(this.turn + k) % visible.length];
      this.renderRow(renderer, scene, main, r, Math.max(r.x0, viewX0 - 100), Math.min(r.x1, viewX1 + 100));
      r.last = time;
      if (r.lag && time - r.lagT > 0.5) {
        // the lagging glass shows what this one showed half a second ago
        this.copyQuad.material.map = r.rt.texture;
        this.copyQuad.material.needsUpdate = true;
        renderer.setRenderTarget(r.lag);
        renderer.render(this.copyScene, this.copyCam);
        r.lagT = time;
      }
    }
    this.turn = (this.turn + budget) % Math.max(1, visible.length);
    for (const o of hidden) o.visible = true;
    for (const r of this.rows) r.mesh.visible = true;
    renderer.shadowMap.autoUpdate = prevAuto;
    renderer.setRenderTarget(prevTarget);
  }

  private renderRow(renderer: THREE.WebGLRenderer, scene: THREE.Scene, main: THREE.OrthographicCamera, r: Row, x0: number, x1: number): void {
    const { v, t, up, rot, corners } = this.tmp;
    const H = WALL_H.mirror;
    // the leaned plane pivots on the glass's top edge, so all of it stands in front of the panel's frame
    const n = this.tmp.n.set(0, Math.sin(LEAN), Math.cos(LEAN));
    const mirrorPt = new THREE.Vector3((x0 + x1) / 2, H, r.z);
    const camPos = main.getWorldPosition(v.set(0, 0, 0));
    // reflect the camera across the plane (Reflector): position, look target and up
    const view = mirrorPt.clone().sub(camPos);
    if (view.dot(n) > 0) return;
    view.reflect(n).negate().add(mirrorPt);
    rot.extractRotation(main.matrixWorld);
    const look = t.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    const target = mirrorPt.clone().sub(look).reflect(n).negate().add(mirrorPt);
    const cam = r.cam;
    cam.position.copy(view);
    up.set(0, 1, 0).applyMatrix4(rot).reflect(n);
    cam.up.copy(up);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    // tighten the view to this row's glass
    corners[0].set(x0, 0, r.z);
    corners[1].set(x1, 0, r.z);
    corners[2].set(x0, H, r.z);
    corners[3].set(x1, H, r.z);
    let l = Infinity, rr = -Infinity, b = Infinity, tt = -Infinity;
    for (const c of corners) {
      const q = c.clone().applyMatrix4(cam.matrixWorldInverse);
      l = Math.min(l, q.x);
      rr = Math.max(rr, q.x);
      b = Math.min(b, q.y);
      tt = Math.max(tt, q.y);
    }
    cam.left = l - 4;
    cam.right = rr + 4;
    cam.bottom = b - 4;
    cam.top = tt + 4;
    cam.near = main.near;
    cam.far = main.far;
    cam.layers.enable(MIRROR_ONLY_LAYER);
    cam.updateProjectionMatrix();
    // the texture matrix maps the glass to this view (before the near plane moves: xy are unchanged)
    const tm = r.mat.uniforms.uTexMat.value as THREE.Matrix4;
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    // an oblique near plane on the glass: nothing behind the mirror can stand in front of its image
    const plane = new THREE.Plane(n.clone(), -n.dot(mirrorPt)).applyMatrix4(cam.matrixWorldInverse);
    const C4 = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const P = cam.projectionMatrix, e = P.elements;
    const Pinv = P.clone().invert();
    const Cc = C4.clone().applyMatrix4(Pinv.clone().transpose());
    const Q = new THREE.Vector4(Math.sign(Cc.x), Math.sign(Cc.y), 1, 1).applyMatrix4(Pinv);
    const M4 = new THREE.Vector4(e[3], e[7], e[11], e[15]);
    const cq = C4.dot(Q);
    if (Math.abs(cq) > 1e-6) {
      const a = (2 * M4.dot(Q)) / cq;
      e[2] = a * C4.x - e[3];
      e[6] = a * C4.y - e[7];
      e[10] = a * C4.z - e[11];
      e[14] = a * C4.w - e[15];
      cam.projectionMatrixInverse.copy(P).invert();
    }
    // keep the texels square-ish: the target's aspect follows the view
    const w = Math.max(64, Math.min(1024, Math.round((rr - l) * 0.8)));
    const h = Math.max(48, Math.min(256, Math.round((tt - b) * 0.8)));
    if (r.rt.width !== w || r.rt.height !== h) {
      r.rt.setSize(w, h);
      r.lag?.setSize(w, h);
    }
    renderer.setRenderTarget(r.rt);
    renderer.clear();
    renderer.render(scene, cam);
    r.live = true;
    r.mat.uniforms.uLive.value = 1;
  }

  dispose(): void {
    for (const r of this.rows) {
      r.rt.dispose();
      r.lag?.dispose();
      r.mat.dispose();
      r.mesh.geometry.dispose();
    }
  }
}
