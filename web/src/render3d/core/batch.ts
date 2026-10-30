// Instanced model batches: one InstancedMesh per model, refilled every frame without allocation.
// Per instance: transform (position on the ground plane + height, yaw, scale), animation state
// (phase, wind-up, flash, move), tint + emissive gain, and rim light colour/strength.

import * as THREE from 'three';
import { shareGeometry } from './geo';
import { actorDepthMaterial } from './materials';

export class ActorBatch {
  mesh: THREE.InstancedMesh;
  readonly cap: number;
  count = 0;
  private m: Float32Array;
  private an: Float32Array;
  private ti: Float32Array;
  private ri: Float32Array;
  private aAn: THREE.InstancedBufferAttribute;
  private aTi: THREE.InstancedBufferAttribute;
  private aRi: THREE.InstancedBufferAttribute;
  /** Default rim for this model (readability against the dark). */
  rim: [number, number, number, number] = [0, 0, 0, 0];

  constructor(geo: THREE.BufferGeometry, mat: THREE.MeshStandardMaterial, cap: number, o: { shadow?: boolean; receive?: boolean; order?: number } = {}) {
    this.cap = cap;
    const g = shareGeometry(geo);
    this.an = new Float32Array(cap * 4);
    this.ti = new Float32Array(cap * 4).fill(1);
    this.ri = new Float32Array(cap * 4);
    this.aAn = new THREE.InstancedBufferAttribute(this.an, 4).setUsage(THREE.DynamicDrawUsage) as THREE.InstancedBufferAttribute;
    this.aTi = new THREE.InstancedBufferAttribute(this.ti, 4).setUsage(THREE.DynamicDrawUsage) as THREE.InstancedBufferAttribute;
    this.aRi = new THREE.InstancedBufferAttribute(this.ri, 4).setUsage(THREE.DynamicDrawUsage) as THREE.InstancedBufferAttribute;
    g.setAttribute('iAnim', this.aAn);
    g.setAttribute('iTint', this.aTi);
    g.setAttribute('iRim', this.aRi);
    this.mesh = new THREE.InstancedMesh(g, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.m = this.mesh.instanceMatrix.array as Float32Array;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.castShadow = !!o.shadow;
    this.mesh.receiveShadow = o.receive ?? true;
    if (o.shadow) this.mesh.customDepthMaterial = actorDepthMaterial(mat);
    if (o.order !== undefined) this.mesh.renderOrder = o.order;
  }

  begin(): void {
    this.count = 0;
  }

  /**
   * Add an instance standing at sim (x, y), lifted `h`, yawed `yaw` (0 = facing +Z/south),
   * uniformly scaled `s` with optional per-axis stretch. Returns the index (or -1 if full).
   */
  add(x: number, y: number, h: number, yaw: number, s: number, sx = 1, sy = 1, sz = 1): number {
    if (this.count >= this.cap) return -1;
    const i = this.count++;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const ax = s * sx, ay = s * sy, az = s * sz;
    const m = this.m, o = i * 16;
    m[o] = c * ax; m[o + 1] = 0; m[o + 2] = -sn * ax; m[o + 3] = 0;
    m[o + 4] = 0; m[o + 5] = ay; m[o + 6] = 0; m[o + 7] = 0;
    m[o + 8] = sn * az; m[o + 9] = 0; m[o + 10] = c * az; m[o + 11] = 0;
    m[o + 12] = x; m[o + 13] = h; m[o + 14] = y; m[o + 15] = 1;
    const k = i * 4;
    this.an[k] = 0; this.an[k + 1] = 0; this.an[k + 2] = 0; this.an[k + 3] = 0;
    this.ti[k] = 1; this.ti[k + 1] = 1; this.ti[k + 2] = 1; this.ti[k + 3] = 1;
    this.ri[k] = this.rim[0]; this.ri[k + 1] = this.rim[1]; this.ri[k + 2] = this.rim[2]; this.ri[k + 3] = this.rim[3];
    return i;
  }

  /** Arbitrary matrix (tilted/rolled instances: projectiles, tumbling debris). */
  addMatrix(mat: THREE.Matrix4): number {
    if (this.count >= this.cap) return -1;
    const i = this.count++;
    mat.toArray(this.m, i * 16);
    const k = i * 4;
    this.an.fill(0, k, k + 4);
    this.ti.fill(1, k, k + 4);
    this.ri[k] = this.rim[0]; this.ri[k + 1] = this.rim[1]; this.ri[k + 2] = this.rim[2]; this.ri[k + 3] = this.rim[3];
    return i;
  }

  anim(i: number, phase: number, windup: number, flash: number, move: number): void {
    if (i < 0) return;
    const k = i * 4;
    this.an[k] = phase; this.an[k + 1] = windup; this.an[k + 2] = flash; this.an[k + 3] = move;
  }

  tint(i: number, r: number, g: number, b: number, emit = 1): void {
    if (i < 0) return;
    const k = i * 4;
    this.ti[k] = r; this.ti[k + 1] = g; this.ti[k + 2] = b; this.ti[k + 3] = emit;
  }

  rimLight(i: number, r: number, g: number, b: number, k: number): void {
    if (i < 0) return;
    const j = i * 4;
    this.ri[j] = r; this.ri[j + 1] = g; this.ri[j + 2] = b; this.ri[j + 3] = k;
  }

  end(): void {
    this.mesh.count = this.count;
    if (this.count === 0) return;
    const im = this.mesh.instanceMatrix;
    im.clearUpdateRanges();
    im.addUpdateRange(0, this.count * 16);
    im.needsUpdate = true;
    for (const a of [this.aAn, this.aTi, this.aRi]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.count * 4);
      a.needsUpdate = true;
    }
  }
}

/** Static instanced props: filled once, with per-instance emissive/tint updates allowed later. */
export class StaticBatch extends ActorBatch {
  private frozen = 0;
  freeze(): void {
    this.frozen = this.count;
    super.end();
  }
  /** Rewrite instance attributes only (flicker, quest glows) — transforms stay. */
  refresh(): void {
    this.count = this.frozen;
    super.end();
  }
}
