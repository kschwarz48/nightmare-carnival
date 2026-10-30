// Ground cover and set dressing (D-48): instanced grass tufts combed by a shader-driven wind,
// stones along the avenue edges, litter blown against the booths, straw by the stalls — and a few
// pieces of dressing that tell small stories: a roped-off queue before the ticket booth, a growling
// generator with cables snaking to the lamps, a signpost at the plaza mouth. Placement is seeded and
// follows the same layout as the ground shader; instances are grouped into spatial chunks so three
// culls whatever is off screen. None of it is solid — it never touches the simulation.

import * as THREE from 'three';
import { MAP_HALF, PATHS, PLAZA, PROMENADE, PROPS, SEA_Y, type Prop } from '../../data/map';
import { StaticBatch } from '../core/batch';
import { C, ModelBuilder, PART, SURF, box, cyl, lathe, rbox, sphere, tube, vnoise, weather, type V3 } from '../core/geo';
import { actorMaterial } from '../core/materials';
import { PAL } from '../models/kit';
import { patch } from '../models/arch';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- layout queries (mirror ground.ts)
const SEGS = PATHS.flatMap((p) => p.pts.slice(0, -1).map((a, i) => ({ a, b: p.pts[i + 1], hw: p.w / 2 })));
function pathDist(x: number, y: number): number {
  let d = 1e9;
  for (const s of SEGS) {
    const abx = s.b[0] - s.a[0], aby = s.b[1] - s.a[1];
    const L2 = abx * abx + aby * aby;
    const t = Math.max(0, Math.min(1, ((x - s.a[0]) * abx + (y - s.a[1]) * aby) / L2));
    d = Math.min(d, Math.hypot(x - s.a[0] - abx * t, y - s.a[1] - aby * t) - s.hw);
  }
  return d;
}
const SOLIDS = PROPS.filter((p) => p.r || (p.hw && p.hh && p.kind !== 'fence_h' && p.kind !== 'fence_v' && p.kind !== 'rail'));
/** Distance from a prop's footprint (negative inside). */
function footDist(p: Prop, x: number, y: number): number {
  if (p.r) return Math.hypot(x - p.x, y - p.y) - p.r;
  const dx = Math.abs(x - p.x) - (p.hw ?? 0), dy = Math.abs(y - p.y) - (p.hh ?? 0);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
}
function nearestSolid(x: number, y: number): number {
  let d = 1e9;
  for (const p of SOLIDS) d = Math.min(d, footDist(p, x, y));
  return d;
}
const onLand = (x: number, y: number) => Math.abs(x) < MAP_HALF - 40 && y > -MAP_HALF + 40 && y < PROMENADE.y0 - 20 && y < SEA_Y;
const plazaDist = (x: number, y: number) => Math.hypot(x - PLAZA.x, y - PLAZA.y) - PLAZA.r;

// ---------------------------------------------------------------- models
function tuftGeo(dry: boolean, seed: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const r = rng(seed);
  const base = dry ? C(0x463c25) : C(0x1f2716), tip = dry ? C(0x94804c) : C(0x56602f);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.9;
    const lean = 0.25 + r() * 0.5, h = 6 + r() * 8, w = 1.2 + r() * 0.6;
    const bx = Math.cos(a) * 0.9, bz = Math.sin(a) * 0.9;
    const tx = bx + Math.cos(a) * h * lean, tz = bz + Math.sin(a) * h * lean;
    m.add(patch((u, v) => {
      const k = v * v;
      return [bx + (tx - bx) * k - Math.sin(a) * (u - 0.5) * w * (1 - v), h * v, bz + (tz - bz) * k + Math.cos(a) * (u - 0.5) * w * (1 - v)];
    }, 1, 3, true), { col: (p) => base.clone().lerp(tip, Math.min(1, p.y / h)), part: PART.SWAY, pivot: [0, 0, 0], surf: SURF.cloth });
  }
  return m.build({ ao: 0 });
}

function stoneGeo(seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 0.8 + 0.4 * vnoise(x * 2 + seed, y * 2, z * 2);
    pos.setXYZ(i, x * k * 1.3, Math.max(-0.2, y) * k * 0.7, z * k);
  }
  g.computeVertexNormals();
  const m = new ModelBuilder();
  m.add(g, { col: weather(seed % 2 ? 0x5a5650 : 0x4a443c, 0.5, 0.4), scale: 3.2, surf: [0.88, 0] as const, flat: true });
  return m.build({ ao: 0.3 });
}

/** A little spill of rubbish: a tipped popcorn box with kernels, a crushed cup, crumpled paper, a ticket stub. */
function litterGeo(seed: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const r = rng(seed);
  const box = new ModelBuilder();
  for (let i = 0; i < 4; i++) box.add(rbox(4.2, 9, 0.5, 0.2, 1), { col: i % 2 ? PAL.redDeep : PAL.dirty, pos: [Math.sin((i * Math.PI) / 2) * 2.2, 4.5, Math.cos((i * Math.PI) / 2) * 2.2], rot: [0, (i * Math.PI) / 2, 0], surf: SURF.paint });
  m.add(box.build({ ao: 0 }), { pos: [0, 2.2, 0], rot: [Math.PI / 2 - 0.2, 0.4, 0], surf: SURF.paint });
  for (let i = 0; i < 9; i++) m.add(sphere(0.9, 5, 4), { col: 0xa89c7c, pos: [5 + r() * 9, 0.6, -3 + r() * 7], surf: SURF.cloth });
  m.add(lathe([[0, 0], [2.4, 0], [3.2, 8], [0, 8]], 8), { col: weather(PAL.dirty, 0.4), pos: [-7, 2.6, 4], rot: [0, r() * 3, Math.PI / 2], surf: SURF.paint });
  m.add(new THREE.IcosahedronGeometry(2.2, 0), { col: 0x8e866e, pos: [-3, 1.6, -6], surf: SURF.cloth, flat: true });
  m.add(rbox(4, 0.3, 2, 0.1, 1), { col: r() < 0.5 ? 0x8a2a20 : 0x2a4a7a, pos: [2, 0.3, 7], rot: [0, r() * 3, 0], surf: SURF.paint });
  return m.build({ ao: 0.2 });
}

function strawGeo(seed: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const r = rng(seed);
  for (let i = 0; i < 16; i++) {
    const x = (r() - 0.5) * 26, z = (r() - 0.5) * 18, a = r() * Math.PI, l = 6 + r() * 8;
    m.add(tube([[x - Math.cos(a) * l / 2, 0.5, z - Math.sin(a) * l / 2], [x + Math.cos(a) * l / 2, 0.6 + r() * 0.8, z + Math.sin(a) * l / 2]], 0.35, 3, 2), { col: weather(PAL.straw, 0.5, 0.3), surf: SURF.cloth });
  }
  return m.build({ ao: 0 });
}

// ---------------------------------------------------------------- one-off dressing in the Big Top slice
/** A roped-off queue: brass stanchions and sagging velvet rope zig-zagging before the ticket window. */
function queueLine(x0: number, y0: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const posts: V3[] = [];
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) posts.push([x0 - 75 + (row % 2 ? 3 - i : i) * 50, 0, y0 + row * 42]);
  for (const p of posts) {
    m.add(cyl(5, 6, 2.4, 10), { col: PAL.brass, pos: [p[0], 1.2, p[2]], surf: SURF.brass });
    m.add(cyl(1.3, 1.3, 32, 6), { col: PAL.brass, pos: [p[0], 17, p[2]], surf: SURF.brass });
    m.add(sphere(2.4, 8, 6), { col: PAL.gold, pos: [p[0], 34, p[2]], surf: SURF.gold });
  }
  for (let i = 0; i + 1 < posts.length; i++) {
    const a = posts[i], b = posts[i + 1];
    const pts: V3[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      pts.push([a[0] + (b[0] - a[0]) * t, 31 - Math.sin(t * Math.PI) * 9, a[2] + (b[2] - a[2]) * t]);
    }
    m.add(tube(pts, 1.1, 5, 12), { col: weather(0x6a1418, 0.35, 0.2), surf: SURF.velvet });
  }
  return m.build({ ao: 0.2 });
}

/** A generator thumping by the grandstand, cables snaking across the ground to the lamps. */
function generator(at: [number, number], cables: [number, number][]): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const [gx, gy] = at;
  m.add(rbox(46, 30, 30, 3, 1), { col: weather(0x3c4a3a, 0.6, 0.12, PAL.rust), pos: [gx, 19, gy], surf: SURF.iron });
  m.add(cyl(11, 11, 40, 12), { col: weather(PAL.redDeep, 0.6, 0.12, PAL.rust), pos: [gx, 44, gy - 4], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
  for (let i = 0; i < 4; i++) m.add(box(34, 2, 1.2), { col: PAL.charcoal, pos: [gx, 12 + i * 5, gy + 15.4], surf: SURF.iron });
  m.add(cyl(2.4, 2.8, 26, 8), { col: PAL.charcoal, pos: [gx + 16, 50, gy + 6], surf: SURF.iron });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(torus4(), { col: PAL.ink, pos: [gx + sx * 19, 5, gy + sz * 15.5], rot: [0, Math.PI / 2, 0], surf: SURF.rubber });
  const rr = rng(gx * 7 + gy);
  for (const [cx, cy] of cables) {
    const pts: V3[] = [];
    const n = Math.max(6, Math.round(Math.hypot(cx - gx, cy - gy) / 40));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const nx = -(cy - gy), ny = cx - gx, L = Math.hypot(nx, ny) || 1;
      const wob = Math.sin(t * Math.PI * 3 + rr() * 2) * 14 * Math.sin(t * Math.PI);
      pts.push([gx + (cx - gx) * t + (nx / L) * wob, k === 0 ? 10 : 0.9, gy + (cy - gy) * t + (ny / L) * wob]);
    }
    m.add(tube(pts, 1.2, 4, n * 4), { col: 0x111012, surf: SURF.rubber });
  }
  return m.build({ ao: 0.3 });
}
function torus4(): THREE.BufferGeometry {
  return new THREE.TorusGeometry(5, 2.2, 6, 12);
}

/** A crooked signpost of painted arrow boards. */
function signpost(x: number, y: number, arrows: { yaw: number; col: number }[]): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(cyl(2.4, 3, 120, 6), { col: weather(PAL.woodDark, 0.5, 0.1), pos: [x, 60, y], rot: [0.04, 0, -0.05], surf: SURF.wood });
  arrows.forEach((a, i) => {
    const s = new THREE.Shape();
    s.moveTo(0, -5); s.lineTo(40, -5); s.lineTo(40, -9); s.lineTo(52, 0); s.lineTo(40, 9); s.lineTo(40, 5); s.lineTo(0, 5); s.lineTo(0, -5);
    const g = new THREE.ExtrudeGeometry(s, { depth: 2, bevelEnabled: false });
    m.add(g, { col: weather(a.col, 0.55, 0.1, PAL.woodPale), pos: [x, 104 - i * 15, y], rot: [0, a.yaw, (i % 2 ? 0.05 : -0.04)], surf: SURF.paint });
  });
  return m.build({ ao: 0.2 });
}

// ---------------------------------------------------------------- scatter
const CHUNK = 1100;
const chunkOf = (x: number, y: number) => `${Math.floor((x + MAP_HALF) / CHUNK)},${Math.floor((y + MAP_HALF) / CHUNK)}`;

interface Inst { x: number; y: number; yaw: number; s: number; ph: number; tint?: [number, number, number] }

export class Clutter {
  readonly batches: StaticBatch[] = [];
  private grass: StaticBatch[] = [];

  /** Low quality drops the wind-swept grass (the heaviest layer); everything else stays. */
  setQuality(q: 'low' | 'medium' | 'high'): void {
    for (const b of this.grass) b.mesh.visible = q !== 'low';
  }

  constructor(scene: THREE.Scene) {
    const r = rng(1931);
    const kinds: Record<string, { geos: THREE.BufferGeometry[]; wind: boolean; list: Map<string, Inst[]>[] }> = {
      tuft: { geos: [tuftGeo(false, 3)], wind: true, list: [new Map()] },
      stone: { geos: [stoneGeo(1)], wind: false, list: [new Map()] },
      litter: { geos: [litterGeo(5)], wind: false, list: [new Map()] },
      straw: { geos: [strawGeo(7)], wind: false, list: [new Map()] },
    };
    const put = (kind: string, _v: number, i: Inst) => {
      const map = kinds[kind].list[0];
      const key = chunkOf(i.x, i.y);
      let l = map.get(key);
      if (!l) map.set(key, (l = []));
      l.push(i);
    };
    // grass: dense along avenue edges and against structures, clumped in the open fields
    const STEP = 30;
    for (let y = -MAP_HALF; y < MAP_HALF; y += STEP) {
      for (let x = -MAP_HALF; x < MAP_HALF; x += STEP) {
        const px = x + r() * STEP, py = y + r() * STEP;
        if (!onLand(px, py) || plazaDist(px, py) < 14) continue;
        const dp = pathDist(px, py), ds = nearestSolid(px, py);
        if (dp < -4 || ds < 6) continue;
        let dens = vnoise(px * 0.006, py * 0.006, 2) > 0.52 ? 0.42 : 0.1;
        if (dp < 46) dens = Math.max(dens, 0.8 - dp * 0.008);
        if (ds < 70) dens = Math.max(dens, 0.55);
        if (r() > dens) continue;
        const dry = vnoise(px * 0.01, py * 0.01, 7) > 0.58 || dp < 20;
        put('tuft', 0, { x: px, y: py, yaw: r() * 6.283, s: 0.8 + r() * 0.7, ph: r() * 6.283, tint: dry ? [2.1, 1.35, 0.9] : [0.85 + r() * 0.3, 0.9 + r() * 0.25, 0.8 + r() * 0.2] });
      }
    }
    // stones and litter along the avenue edges; litter thickest around the booths and concessions
    for (const sg of SEGS) {
      const L = Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]);
      const dx = (sg.b[0] - sg.a[0]) / L, dy = (sg.b[1] - sg.a[1]) / L;
      for (let t = 0; t < L; t += 26) {
        for (const side of [-1, 1]) {
          const off = sg.hw + (r() - 0.35) * 26;
          const px = sg.a[0] + dx * t - dy * off * side, py = sg.a[1] + dy * t + dx * off * side;
          if (!onLand(px, py) || plazaDist(px, py) < 0 || nearestSolid(px, py) < 4) continue;
          if (r() < 0.32) { const k = 0.75 + r() * 0.5; put('stone', 0, { x: px, y: py, yaw: r() * 6.283, s: 0.5 + r() * 0.9, ph: 0, tint: [k, k * 0.96, k * 0.9] }); }
          if (r() < 0.07) put('litter', r() < 0.5 ? 0 : 1, { x: px, y: py, yaw: r() * 6.283, s: 0.8 + r() * 0.3, ph: 0 });
        }
      }
    }
    const busy = PROPS.filter((p) => /stall|stand|cart|booth|bleachers|caravan|tent_small/.test(p.kind));
    for (const p of busy) {
      for (let k = 0; k < 7; k++) {
        const a = r() * 6.283, d = (p.r ?? Math.max(p.hw ?? 60, p.hh ?? 60)) + 20 + r() * 90;
        const px = p.x + Math.cos(a) * d, py = p.y + Math.sin(a) * d * 0.8;
        if (!onLand(px, py) || nearestSolid(px, py) < 2) continue;
        put('litter', k % 2, { x: px, y: py, yaw: r() * 6.283, s: 0.8 + r() * 0.35, ph: 0 });
      }
      if (/stall|stand|bleachers/.test(p.kind)) {
        for (let k = 0; k < 3; k++) {
          const px = p.x + (r() - 0.5) * ((p.hw ?? 80) * 2 + 60), py = p.y + (p.hh ?? 50) + 20 + r() * 50;
          if (onLand(px, py)) put('straw', 0, { x: px, y: py, yaw: r() * 6.283, s: 0.9 + r() * 0.5, ph: 0 });
        }
      }
    }
    // one batch per (kind, variant, chunk): culled by its bounds
    for (const kind of Object.values(kinds)) {
      kind.geos.forEach((geo, v) => {
        const mat = actorMaterial({ wind: kind.wind, envIntensity: 0.25 });
        for (const list of kind.list[v].values()) {
          const b = new StaticBatch(geo, mat, list.length, { shadow: false });
          for (const i of list) {
            const idx = b.add(i.x, i.y, 0, i.yaw, i.s);
            b.anim(idx, 0, i.ph, 0, 0);
            if (i.tint) b.tint(idx, i.tint[0], i.tint[1], i.tint[2], 1);
          }
          b.freeze();
          b.mesh.computeBoundingSphere();
          b.mesh.frustumCulled = true;
          scene.add(b.mesh);
          this.batches.push(b);
          if (kind.wind) this.grass.push(b);
        }
      });
    }
    // the slice's story pieces
    const booth = PROPS.find((p) => p.kind === 'ticket_booth');
    const lampA = PROPS.find((p) => p.kind === 'lamp' && p.x === 430 && p.y === 0);
    const stories: THREE.BufferGeometry[] = [];
    if (booth) stories.push(queueLine(booth.x, booth.y + (booth.hh ?? 80) + 70));
    stories.push(generator([835, 470], [[lampA?.x ?? 430, lampA?.y ?? 0], [booth?.x ?? 1090, (booth?.y ?? 340) + 60]]));
    stories.push(signpost(330, 455, [{ yaw: -0.5, col: PAL.blood }, { yaw: 2.6, col: PAL.mustard }, { yaw: 0.9, col: PAL.teal }]));
    for (const geo of stories) {
      const b = new StaticBatch(geo, actorMaterial({ detail: true, envIntensity: 0.5 }), 1, { shadow: true });
      b.add(0, 0, 0, 0, 1);
      b.freeze();
      scene.add(b.mesh);
      this.batches.push(b);
    }
  }
}
