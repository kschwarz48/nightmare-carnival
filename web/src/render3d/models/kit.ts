// Shared modeling vocabulary for the carnival (D-38 art direction): a desaturated 1930s palette with
// selective saturated accents, and reusable parts — eyes (pie-cut or glowing), gloved hands, big
// shoes, bent "hose" limbs, hats, ruffs, bulbs, rivets — so every model shares one visual language.

import * as THREE from 'three';
import { ModelBuilder, PART, SURF, cone, cyl, ellipsoid, lathe, sphere, torus, tube, type ColorFn, type Surf, type V3 } from '../core/geo';

export { ModelBuilder, PART, SURF };

/** Weathered 1930s carnival palette (sRGB). Emissive accents are the only saturated colours. */
export const PAL = {
  red: 0x7a2e2a, redDeep: 0x4f1a17, blood: 0x8f1d18, rust: 0x7b4a2a,
  mustard: 0xa8853a, ochre: 0x8c6a2c, cream: 0xcfc2a2, bone: 0xd6caae, dirty: 0xa9a08a,
  brass: 0x9a7a3c, gold: 0xb8933e, velvet: 0x3b2140, plum: 0x553057,
  ink: 0x14100e, charcoal: 0x2a2624, slate: 0x3c4048, iron: 0x4a4a4e,
  sick: 0x9fbf5a, moss: 0x4f5a34, teal: 0x3f6b6a, navy: 0x1f2a3d, denim: 0x34465e,
  woodDark: 0x3e2a1e, wood: 0x6b4a32, woodPale: 0x8a7258, canvas: 0xb2a382, canvasDark: 0x7d7058,
  skin: 0xc9a07e, skinPale: 0xd8c2a4, skinDark: 0x8a5e44, clown: 0xe2d8c6,
  pinkDusty: 0xb07a86, lilac: 0x7d6a8f, leaf: 0x55663a, straw: 0xb59a5c, leather: 0x4a3020,
  // emissive accents
  amber: 0xffb347, ember: 0xff6a2a, hotRed: 0xff3b2a, sickYellow: 0xd8e04a, ghost: 0x7dffb0, cold: 0x9ec8ff, violet: 0xb48cff,
};

/** Eyes. `glow` > 0 makes the pupils emissive (horror); otherwise 1930s pie-cut eyes. */
export function eyes(m: ModelBuilder, o: { x: number; y: number; z: number; r: number; part?: number; pivot?: V3; glow?: number; color?: number; sclera?: number; squint?: number; angle?: number }): void {
  const part = o.part ?? PART.HEAD;
  const pv = o.pivot;
  for (const s of [-1, 1]) {
    const x = o.x * s;
    const tilt = (o.angle ?? 0) * s;
    if (o.sclera !== undefined) {
      m.add(ellipsoid(o.r, o.r * 1.25 * (1 - (o.squint ?? 0)), o.r * 0.55, 10, 8), { col: o.sclera, pos: [x, o.y, o.z], rot: [0, 0, tilt], part, pivot: pv, surf: SURF.porcelain });
    }
    const pr = o.sclera !== undefined ? o.r * 0.55 : o.r;
    m.add(ellipsoid(pr, pr * 1.2 * (1 - (o.squint ?? 0)), pr * 0.5, 8, 6), {
      col: o.color ?? PAL.ink, pos: [x, o.y, o.z + o.r * 0.32], rot: [0, 0, tilt], part, pivot: pv, emit: o.glow ?? 0, surf: SURF.glass,
    });
  }
}

/** Rubber-hose limb from a to b with a soft bend; r may taper. */
export function limb(m: ModelBuilder, a: V3, b: V3, r: number | ((t: number) => number), col: number | ColorFn, part: number, pivot: V3, bend: V3 = [0, 0, 0], surf: Surf = SURF.cloth): void {
  const mid: V3 = [(a[0] + b[0]) / 2 + bend[0], (a[1] + b[1]) / 2 + bend[1], (a[2] + b[2]) / 2 + bend[2]];
  m.add(tube([a, mid, b], r, 7, 8), { col, part, pivot, surf });
}

/** Four-finger cartoon glove with a rolled cuff. */
export function glove(m: ModelBuilder, p: V3, r: number, part: number, pivot: V3, col: number = PAL.bone): void {
  m.add(ellipsoid(r, r * 1.05, r * 0.8, 10, 8), { col, pos: p, part, pivot, surf: SURF.cloth });
  for (let i = 0; i < 3; i++) {
    m.add(ellipsoid(r * 0.32, r * 0.55, r * 0.32, 6, 5), { col, pos: [p[0] + (i - 1) * r * 0.5, p[1] - r * 0.9, p[2] + r * 0.25], part, pivot, surf: SURF.cloth });
  }
  m.add(ellipsoid(r * 0.3, r * 0.5, r * 0.3, 6, 5), { col, pos: [p[0] + r * 0.85, p[1] - r * 0.2, p[2] + r * 0.3], rot: [0, 0, -0.7], part, pivot, surf: SURF.cloth });
  m.add(torus(r * 0.75, r * 0.28, 6, 12), { col, pos: [p[0], p[1] + r * 0.95, p[2]], rot: [Math.PI / 2, 0, 0], part, pivot, surf: SURF.cloth });
}

/** Big round-toed shoe; heel at p, toe pointing +Z. */
export function shoe(m: ModelBuilder, p: V3, len: number, col: number, part: number, pivot: V3, toeUp = 0.15): void {
  m.add(ellipsoid(len * 0.38, len * 0.26, len * 0.6, 10, 8), { col, pos: [p[0], p[1] + len * 0.2, p[2] + len * 0.32], rot: [-toeUp, 0, 0], part, pivot, surf: SURF.rubber });
  m.add(cyl(len * 0.34, len * 0.36, len * 0.12, 10), { col: PAL.ink, pos: [p[0], p[1] + len * 0.05, p[2] + len * 0.3], part, pivot, surf: SURF.rubber });
}

/** Lathe-turned body with smooth profile. */
export function body(m: ModelBuilder, profile: [number, number][], col: number | ColorFn, o: { part?: number; pivot?: V3; pos?: V3; scale?: number | V3; segs?: number; surf?: Surf; rot?: V3; smooth?: number } = {}): void {
  m.add(lathe(profile, o.segs ?? 16, o.smooth ?? 20), { col, part: o.part ?? PART.BODY, pivot: o.pivot, pos: o.pos, scale: o.scale, surf: o.surf ?? SURF.cloth, rot: o.rot });
}

/** Neck ruff: a ring of pleated lobes. */
export function ruff(m: ModelBuilder, y: number, R: number, col: number, part: number = PART.BODY, pivot?: V3, n = 14): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    m.add(ellipsoid(R * 0.32, R * 0.18, R * 0.24, 6, 4), { col, pos: [Math.cos(a) * R * 0.78, y, Math.sin(a) * R * 0.78], rot: [0, -a, 0.35], part, pivot, surf: SURF.cloth });
  }
}

/** Light bulb (emissive) with a brass socket. */
export function bulb(m: ModelBuilder, p: V3, r: number, col: number = PAL.amber, part: number = PART.BODY, pivot?: V3, emit = 1): void {
  m.add(sphere(r, 8, 6), { col, pos: p, emit, part, pivot, surf: SURF.bulb });
  m.add(cyl(r * 0.55, r * 0.6, r * 0.7, 6), { col: PAL.brass, pos: [p[0], p[1] - r * 1.05, p[2]], part, pivot, surf: SURF.brass });
}

/** Rivet / stud row along a circle at height y. */
export function rivets(m: ModelBuilder, y: number, R: number, n: number, r: number, col: number = PAL.brass, part: number = PART.BODY, pivot?: V3): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    m.add(sphere(r, 5, 4), { col, pos: [Math.cos(a) * R, y, Math.sin(a) * R], part, pivot, surf: SURF.brass });
  }
}

export function tophat(m: ModelBuilder, y: number, r: number, h: number, col: number, band: number, part: number = PART.HEAD, pivot?: V3, tilt = 0): void {
  m.add(cyl(r * 1.7, r * 1.7, r * 0.12, 16), { col, pos: [0, y, 0], rot: [tilt, 0, 0], part, pivot, surf: SURF.velvet });
  m.add(lathe([[0, 0], [r * 0.95, 0], [r, h * 0.5], [r * 1.08, h], [0, h]], 16), { col, pos: [0, y, 0], rot: [tilt, 0, 0], part, pivot, surf: SURF.velvet });
  m.add(cyl(r * 1.0, r * 0.97, h * 0.18, 16, true), { col: band, pos: [0, y + h * 0.14, 0], rot: [tilt, 0, 0], part, pivot, surf: SURF.cloth, scale: [1.02, 1, 1.02] });
}

export function coneHat(m: ModelBuilder, y: number, r: number, h: number, col: number | ColorFn, pom: number, part: number = PART.HEAD, pivot?: V3, tilt: V3 = [0, 0, 0]): void {
  m.add(cone(r, h, 12), { col, pos: [0, y + h / 2, 0], rot: tilt, part, pivot, surf: SURF.cloth });
  const tipY = y + h * Math.cos(tilt[0]) * Math.cos(tilt[2]);
  const tipX = -Math.sin(tilt[2]) * h, tipZ = Math.sin(tilt[0]) * h;
  m.add(sphere(r * 0.32, 8, 6), { col: pom, pos: [tipX, tipY, tipZ], part, pivot, surf: SURF.plush });
}

/** Stitch marks (little dark dashes) across a surface — for plush and canvas repairs. */
export function stitches(m: ModelBuilder, a: V3, b: V3, n: number, col: number = PAL.ink, part: number = PART.BODY, pivot?: V3, size = 1.2): void {
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    m.add(cyl(size * 0.35, size * 0.35, size * 3, 4), { col, pos: p, rot: [Math.PI / 2, 0, Math.atan2(b[1] - a[1], b[0] - a[0])], part, pivot, surf: SURF.cloth });
  }
}

export const V = (x: number, y: number, z: number): V3 => [x, y, z];
export const deg = (d: number): number => (d * Math.PI) / 180;
export { THREE };
