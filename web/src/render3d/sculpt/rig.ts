// Skeletal animation for instanced crowds (D-40). A rig is a small bone hierarchy (pivot points in
// the rest pose) plus authored clips — functions of normalised time returning per-bone rotations,
// offsets and squash/stretch. Clips are baked once into a float texture (3 texels = one affine bone
// matrix per frame); the actor shader skins each vertex with two bones and can cross-fade two clip
// frames, so hundreds of instances each play their own animation at almost no CPU cost.

import * as THREE from 'three';
import type { V3 } from '../core/geo';

export interface BoneDef {
  name: string;
  parent: string | null;
  head: V3;
}

export interface BoneXf {
  rx?: number; ry?: number; rz?: number;
  tx?: number; ty?: number; tz?: number;
  sx?: number; sy?: number; sz?: number;
}

export type Pose = Record<string, BoneXf>;

export interface ClipDef {
  frames: number;
  /** t in [0, 1): one loop (or the full one-shot). */
  fn: (t: number) => Pose;
  loop?: boolean;
}

export interface ClipRows { start: number; frames: number; loop: boolean }

const _m = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export class Rig {
  readonly bones: BoneDef[];
  readonly index: Record<string, number> = {};
  readonly rows: Record<string, ClipRows> = {};
  readonly tex: THREE.DataTexture;

  constructor(bones: BoneDef[], clips: Record<string, ClipDef>) {
    // order bones so parents precede children
    const ordered: BoneDef[] = [];
    const left = bones.slice();
    while (left.length) {
      const i = left.findIndex((b) => b.parent === null || ordered.some((o) => o.name === b.parent));
      if (i < 0) throw new Error('Rig: bone hierarchy has a cycle or a missing parent');
      ordered.push(left.splice(i, 1)[0]);
    }
    this.bones = ordered;
    ordered.forEach((b, i) => (this.index[b.name] = i));
    let total = 0;
    for (const [name, c] of Object.entries(clips)) {
      this.rows[name] = { start: total, frames: c.frames, loop: c.loop ?? true };
      total += c.frames;
    }
    const W = ordered.length * 3;
    const data = new Float32Array(W * total * 4);
    const world: THREE.Matrix4[] = ordered.map(() => new THREE.Matrix4());
    for (const [name, c] of Object.entries(clips)) {
      const r = this.rows[name];
      for (let f = 0; f < c.frames; f++) {
        const pose = c.fn(c.loop === false ? f / Math.max(1, c.frames - 1) : f / c.frames);
        for (let bi = 0; bi < ordered.length; bi++) {
          const b = ordered[bi];
          const x = pose[b.name] ?? {};
          // local = T(offset) · T(head) · R · S · T(−head)
          _e.set(x.rx ?? 0, x.ry ?? 0, x.rz ?? 0, 'YXZ');
          _q.setFromEuler(_e);
          _s.set(x.sx ?? 1, x.sy ?? 1, x.sz ?? 1);
          _p.set(b.head[0] + (x.tx ?? 0), b.head[1] + (x.ty ?? 0), b.head[2] + (x.tz ?? 0));
          _m.compose(_p, _q, _s);
          _t.makeTranslation(-b.head[0], -b.head[1], -b.head[2]);
          _m.multiply(_t);
          if (b.parent) world[bi].multiplyMatrices(world[this.index[b.parent]], _m);
          else world[bi].copy(_m);
          const e = world[bi].elements;
          const o = ((r.start + f) * W + bi * 3) * 4;
          data[o] = e[0]; data[o + 1] = e[4]; data[o + 2] = e[8]; data[o + 3] = e[12];
          data[o + 4] = e[1]; data[o + 5] = e[5]; data[o + 6] = e[9]; data[o + 7] = e[13];
          data[o + 8] = e[2]; data[o + 9] = e[6]; data[o + 10] = e[10]; data[o + 11] = e[14];
        }
      }
    }
    this.tex = new THREE.DataTexture(data, W, total, THREE.RGBAFormat, THREE.FloatType);
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.needsUpdate = true;
  }

  bone(name: string): number {
    const i = this.index[name];
    if (i === undefined) throw new Error(`Rig: unknown bone ${name}`);
    return i;
  }

  has(clip: string): boolean {
    return !!this.rows[clip];
  }

  /** Texture row for a clip at normalised time t (loops wrap, one-shots clamp). */
  row(clip: string, t: number): number {
    const r = this.rows[clip] ?? this.rows.idle;
    const u = r.loop ? t - Math.floor(t) : Math.min(0.9999, Math.max(0, t));
    return r.start + Math.min(r.frames - 1, Math.floor(u * r.frames));
  }
}

// ------------------------------------------------------------------ pose helpers
export const TAU = Math.PI * 2;
export const sin = (t: number, cycles = 1, phase = 0): number => Math.sin((t * cycles + phase) * TAU);
export const cos = (t: number, cycles = 1, phase = 0): number => Math.cos((t * cycles + phase) * TAU);
/** Smooth 0→1→0 pulse centred at c with half-width w. */
export const pulse = (t: number, c: number, w: number): number => {
  const d = Math.abs(t - c) / w;
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(d * Math.PI);
};
export const ease = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** Snappy "pose-to-pose" hold: eases quickly into each key then holds (puppet-like). */
export const snap = (t: number, steps: number): number => {
  const s = t * steps;
  const i = Math.floor(s);
  return (i + ease(Math.min(1, (s - i) * 2.2))) / steps;
};

/** Merge pose layers (rotations/offsets add, scales multiply). */
export function mix(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const p of poses) {
    for (const [k, v] of Object.entries(p)) {
      const o = (out[k] ??= {});
      for (const key of ['rx', 'ry', 'rz', 'tx', 'ty', 'tz'] as const) if (v[key] !== undefined) o[key] = (o[key] ?? 0) + v[key]!;
      for (const key of ['sx', 'sy', 'sz'] as const) if (v[key] !== undefined) o[key] = (o[key] ?? 1) * v[key]!;
    }
  }
  return out;
}
