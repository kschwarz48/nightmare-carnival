// The character art standard's toolkit (D-86, docs/CHARACTER_ART_QUALITY_STANDARD.md): building blocks
// for figures that read from the game's camera — 50° above, about 80–110 px tall at 1080p.
//
// * A figure is built in layers (`layered` in sdf.ts): skin, then each garment as its own shell, hair, a
//   hat. Smooth blends stay inside a layer; materials meet at modelled edges.
// * Forms are large and few. Nothing sculpted is thinner than ~1.5 mesh cells (it would melt); smaller
//   features — eyes, brows, mouths, buttons — are crisp detail meshes that draw no ink.
// * Colour is flat and deliberate per part: no noise. Where a costume has a pattern it is drawn per pixel
//   (`pat`), so stripes stay crisp at any zoom.
// * Occlusion is soft (about a quarter) and there is no curvature "wear" paint: both turned forms to mud.

import * as THREE from 'three';
import { C, SURF, ellipsoid, rbox, sphere, tube, type ColorFn, type Surf, type V3 } from '../core/geo';
import { Sculpt, type BuildOpts } from './sdf';
import type { Proportions } from './humanoid';
import { REAL, frontZ } from './realism';

/**
 * The playable cast's frame (D-86): REAL's landmarks with a head a quarter larger, broader shoulders and
 * chest, and a little more weight in the limbs — a 1930s cartoon's proportions on a real skeleton, the
 * crown still at ~89. At seven heads a figure was a stick from the game's camera.
 */
export const HERO: Proportions = {
  ...REAL, hip: 43.5, knee: 24, stance: 4.8, waist: 52.8, chest: 62.4, shoulderY: 70.9, shoulderX: 9.6, elbowY: 55.6, wristY: 43.4, armOut: 1.4,
  neck: 73.8, headY: 80.4, headR: 7.6, leg: [3.8, 2.75, 2.0], arm: [2.55, 2.05, 1.7], hipW: 7.6, waistW: 6.9, chestW: 9.3, depth: 0.66,
};

type Col = number | THREE.Color | ColorFn;

/** Build options for each kind of layer: soft occlusion, no curvature paint, crisp seams. */
export const LAYER: Record<'skin' | 'cloth' | 'hair' | 'hard', BuildOpts> = {
  skin: { ao: 0.2, aoScale: 0.5, paint: 0, seam: 0.12 },
  cloth: { ao: 0.24, aoScale: 0.6, paint: 0, seam: 0.15 },
  hair: { ao: 0.22, aoScale: 0.5, paint: 0, seam: 0.15 },
  hard: { ao: 0.12, aoScale: 0.5, paint: 0, seam: 0.1 },
};

/** Material families (roughness, metalness): each reads differently under the same light. */
export const FAM = {
  skin: SURF.skin, // soft sheen
  greasepaint: [0.48, 0] as Surf, // a clown's painted face: a touch of shine
  cloth: SURF.cloth, // dry
  wool: [0.9, 0] as Surf,
  hair: [0.52, 0] as Surf, // a soft gloss along the clumps
  leather: [0.44, 0] as Surf,
  rubber: SURF.rubber,
  latex: SURF.latex, // glossy (a clown's nose)
  brass: SURF.brass,
  gold: SURF.gold,
  iron: SURF.iron,
  wood: SURF.wood,
  straw: [0.82, 0] as Surf,
  canvas: SURF.canvas,
  eye: SURF.glass,
  bone: SURF.bone,
} as const;

/**
 * A smooth, deliberate gradient from `bot` to `top` between heights y0 and y1 — hand-painted light from
 * above, darker toward the floor — instead of noise.
 */
export function vertical(bot: number, top: number, y0: number, y1: number): ColorFn {
  const a = C(bot), b = C(top);
  return (p) => a.clone().lerp(b, Math.max(0, Math.min(1, (p.y - y0) / (y1 - y0))));
}

/** Skin with a smooth, crisp-edged five o'clock shadow on the jaw (no speckle). */
export function shadowedJaw(base: number, P: Proportions, amount = 0.3): ColorFn {
  const skin = C(base), shade = C(base).multiplyScalar(0.72).lerp(C(0x3a3440), 0.22);
  return (p) => {
    const dy = p.y - P.headY;
    if (p.z < P.headR * 0.1 || dy > -P.headR * 0.22 || dy < -P.headR * 1.2) return skin.clone();
    const k = Math.min(1, (-P.headR * 0.22 - dy) / (P.headR * 0.18));
    return skin.clone().lerp(shade, k * amount);
  };
}

/**
 * A stylized head from a few large forms — cranium, a squared jaw, cheekbones, a brow shelf, a clear nose
 * and ears — every one wider than ~1.5 cells at the figure's mesh resolution, so none melts.
 */
export function styleHead(sc: Sculpt, P: Proportions, bone: number, skin: Col, o: { jaw?: number; nose?: number; chin?: number; ears?: number; brow?: number } = {}): void {
  const r = P.headR, y = P.headY, jw = o.jaw ?? 1, nz = o.nose ?? 1;
  const sk = { col: skin, bone, surf: FAM.skin };
  sc.add({ t: 'ell', c: [0, y + r * 0.12, -r * 0.06], r: [r * 0.9, r * 1.0, r * 0.98] }, { ...sk, k: 1.2 });
  // the jaw: a tapered block, so the face has a jawline and a chin rather than an egg's curve
  sc.add({ t: 'box', c: [0, y - r * 0.5, r * 0.2], h: [r * 0.56 * jw, r * 0.36, r * 0.52], r: r * 0.3, tx: 0.16 }, { ...sk, k: 1.4 });
  sc.add({ t: 'ell', c: [0, y - r * 0.8, r * 0.5], r: [r * 0.26 * (o.chin ?? 1), r * 0.16, r * 0.2] }, { ...sk, k: 1 });
  for (const s of [1, -1]) {
    sc.add({ t: 'ell', c: [s * r * 0.5, y - r * 0.06, r * 0.56], r: [r * 0.27, r * 0.17, r * 0.2], rot: [0, s * 0.45, 0] }, { ...sk, k: 1.1 });
    sc.add({ t: 'ell', c: [s * r * 0.9, y - r * 0.02, -r * 0.06], r: [r * 0.13, r * 0.29 * (o.ears ?? 1), r * 0.2], rot: [0, s * 0.3, 0] }, { ...sk, k: 0.6 });
    // shallow sockets under the brow: shadow for the eyes to sit in
    sc.add({ t: 'ell', c: [s * r * 0.33, y + r * 0.09, r * 0.93], r: [r * 0.21, r * 0.13, r * 0.12] }, { sub: true, k: 0.5 });
  }
  sc.add({ t: 'ell', c: [0, y + r * 0.31, r * 0.7], r: [r * 0.64, r * 0.12 * (o.brow ?? 1), r * 0.22] }, { ...sk, k: 1.1 });
  sc.add({ t: 'cap', a: [0, y + r * 0.14, r * 0.86], b: [0, y - r * 0.2, r * (1.0 + 0.05 * nz)], ra: r * 0.1, rb: r * 0.14 * nz }, { ...sk, k: 0.8 });
  sc.add({ t: 'sph', c: [0, y - r * 0.24, r * (0.98 + 0.05 * nz)], r: r * 0.14 * nz }, { ...sk, k: 0.6 });
}

export interface FaceOpts {
  /** iris colour; glow > 0 makes it shine (horror) */
  iris?: number;
  glow?: number;
  sclera?: number;
  /** eye size (× head radius), spread and height */
  size?: number;
  spread?: number;
  y?: number;
  brow?: number;
  /** inner ends of the brows: up (+, worried) or down (−, scowling) */
  browTilt?: number;
  browW?: number;
  lid?: number;
  mouth?: number;
  /** the mouth's corners: + smile, − frown; `smirk` lifts one corner */
  smile?: number;
  smirk?: number;
  mouthW?: number;
}

/**
 * Designed features, seated on the sculpted surface: almond eyes (white, iris, a catch-light), a dark upper
 * lid, thick brows that read from above, and a mouth line. None draws ink: at play size an outline round an
 * eye turns it into a black blot.
 */
export function styleFace(sc: Sculpt, P: Proportions, bone: number, o: FaceOpts = {}): void {
  const r = P.headR, y = P.headY;
  const sz = (o.size ?? 0.19) * r, ey = y + (o.y ?? 0.09) * r;
  for (const s of [1, -1]) {
    const x = s * (o.spread ?? 0.34) * r;
    const z = frontZ(sc, x, ey) - r * 0.03;
    const yaw = s * 0.32;
    sc.detail(ellipsoid(sz, sz * 0.62, sz * 0.36, 12, 8), { col: o.sclera ?? 0xe6dccb, bone, pos: [x, ey, z], rot: [0, yaw, 0], surf: FAM.eye, ink: false });
    sc.detail(ellipsoid(sz * 0.5, sz * 0.56, sz * 0.24, 10, 8), { col: o.iris ?? 0x2a1a12, bone, pos: [x + s * sz * 0.05, ey - sz * 0.02, z + sz * 0.17], rot: [0, yaw, 0], surf: FAM.eye, emit: o.glow ?? 0, ink: false });
    if (!o.glow) sc.detail(sphere(sz * 0.12, 6, 4), { col: 0xffffff, bone, pos: [x + s * sz * 0.05 - sz * 0.16, ey + sz * 0.16, z + sz * 0.36], surf: FAM.eye, emit: 0.35, ink: false });
    sc.detail(ellipsoid(sz * 1.12, sz * 0.2, sz * 0.4, 10, 4), { col: o.lid ?? 0x24170f, bone, pos: [x, ey + sz * 0.5, z + sz * 0.06], rot: [0.1, yaw, -s * 0.06], surf: FAM.skin, ink: false });
    const bx = s * ((o.spread ?? 0.34) + 0.02) * r, by = y + 0.33 * r;
    const bw = (o.browW ?? 1) * r;
    sc.detail(rbox(bw * 0.4, r * 0.085, r * 0.1, r * 0.035, 1), { col: o.brow ?? 0x1c130e, bone, pos: [bx, by, frontZ(sc, bx, by) + r * 0.01], rot: [0, s * 0.3, s * (o.browTilt ?? 0.18)], surf: FAM.hair, ink: false });
  }
  const my = y - 0.5 * r, mw = (o.mouthW ?? 1) * r;
  const sm = o.smile ?? 0, sk = o.smirk ?? 0;
  const pts: V3[] = [-1, -0.45, 0, 0.45, 1].map((u) => {
    const x = u * mw * 0.26;
    const yy = my + (Math.abs(u) ** 2) * sm * r * 0.08 + (u > 0 ? u * sk * r * 0.08 : 0);
    return [x, yy, frontZ(sc, x, yy) + r * 0.005];
  });
  sc.detail(tube(pts, r * 0.035, 4, 12), { col: o.mouth ?? 0x4e221c, bone, surf: FAM.skin, ink: false });
}

/**
 * A cartoon four-fingered hand (1930s), as one sculpted mass: palm, fingers merged with a small blend, a
 * thumb. `s` is the side (+1 left). Fingers point down the arm, curling forward.
 */
export function styleHand(sc: Sculpt, wr: V3, s: number, r: number, col: Col, bone: number, surf: Surf = FAM.skin, glove = false): void {
  const R = r * (glove ? 1.4 : 1.15);
  const palm: V3 = [wr[0] + s * 0.15 * R, wr[1] - R * 1.25, wr[2] + 0.2 * R];
  sc.add({ t: 'ell', c: palm, r: [R * 0.62, R * 1.0, R * 0.86] }, { col, bone, k: 0.5, surf });
  for (let i = 0; i < 4; i++) {
    const fz = palm[2] + R * (0.56 - i * 0.38);
    const L = R * (1.05 + (i === 1 ? 0.12 : i === 3 ? -0.15 : 0));
    sc.add({ t: 'cap', a: [palm[0], palm[1] - R * 0.7, fz], b: [palm[0] - s * R * 0.12, palm[1] - R * 0.7 - L, fz + R * 0.22], ra: R * 0.24, rb: R * 0.21 }, { col, bone, k: 0.22, surf });
  }
  sc.add({ t: 'cap', a: [palm[0] - s * R * 0.1, palm[1] + R * 0.1, palm[2] + R * 0.7], b: [palm[0] - s * R * 0.32, palm[1] - R * 0.75, palm[2] + R * 1.05], ra: R * 0.26, rb: R * 0.22 }, { col, bone, k: 0.3, surf });
  if (glove) sc.add({ t: 'tor', c: [wr[0], wr[1] - R * 0.05, wr[2]], R: R * 0.82, r: R * 0.34 }, { col, bone, k: 0.3, surf });
}

/** A shoe with a defined upper, a darker welted sole and heel, toe pointing +Z from the ankle. */
export function styleShoe(sc: Sculpt, an: V3, len: number, col: number, bone: number, o: { toeUp?: number; width?: number; surf?: Surf; sole?: number } = {}): void {
  const w = (o.width ?? 1) * len * 0.42;
  const surf = o.surf ?? FAM.leather;
  sc.add({ t: 'ell', c: [an[0], len * 0.3, len * 0.36], r: [w, len * 0.3, len * 0.66], rot: [-(o.toeUp ?? 0.06), 0, 0] }, { col, bone, k: 0.5, surf });
  sc.add({ t: 'cap', a: [an[0], len * 0.36, len * 0.05], b: [an[0], an[1] + 0.4, -len * 0.02], ra: w * 0.86, rb: w * 0.7 }, { col, bone, k: 0.8, surf });
  const sole = o.sole ?? C(col).multiplyScalar(0.42).getHex();
  sc.add({ t: 'box', c: [an[0], len * 0.06, len * 0.34], h: [w * 1.06, len * 0.07, len * 0.7], r: len * 0.05 }, { col: sole, bone, k: 0.12, surf: FAM.rubber });
  sc.add({ t: 'box', c: [an[0], len * 0.1, -len * 0.2], h: [w * 0.9, len * 0.1, len * 0.18], r: len * 0.04 }, { col: sole, bone, k: 0.1, surf: FAM.rubber });
}

/**
 * A clean mop of hair: a cap, a back-and-sides mass and a few large clumps — no speckle, a soft top light.
 * `ink: false` when a scarf or a knit hat sits close over it: its outline would show through as dark slashes.
 */
export function styleHair(sc: Sculpt, P: Proportions, bone: number, col: number, o: { fringe?: [V3, V3][]; volume?: number; back?: number; sideburns?: boolean; ink?: boolean } = {}): void {
  const r = P.headR * (o.volume ?? 1), y = P.headY;
  const tone = vertical(C(col).multiplyScalar(0.82).getHex(), C(col).multiplyScalar(1.18).getHex(), y - r * 0.5, y + r * 1.1);
  const hair = { col: tone, bone, surf: FAM.hair, ink: o.ink };
  sc.add({ t: 'ell', c: [0, y + r * 0.45, -r * 0.12], r: [r * 0.96, r * 0.7, r * 1.0] }, { ...hair, k: 0.8 });
  sc.add({ t: 'ell', c: [0, y + r * 0.08, -r * 0.36], r: [r * 0.95, r * 0.72 * (o.back ?? 1), r * 0.76] }, { ...hair, k: 1 });
  if (o.sideburns !== false) for (const s of [1, -1]) sc.add({ t: 'cap', a: [s * r * 0.87, y + r * 0.3, r * 0.08], b: [s * r * 0.86, y - r * 0.24, r * 0.26], ra: r * 0.14, rb: r * 0.08 }, { ...hair, k: 0.4 });
  for (const [a, b] of o.fringe ?? []) sc.add({ t: 'cap', a, b, ra: r * 0.2, rb: r * 0.07 }, { ...hair, k: 0.35 });
}
