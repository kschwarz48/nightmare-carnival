// What streams past the moving train (D-80): the line's telegraph poles and their sagging wires, signal
// posts, and the country of each leg (hedgerow trees out of the Junction, Saint Vesper's yews and stones,
// the Works' chimneys and slag, Stillwater's willows and fog, then the bridge over the drop on the way to
// the End of the Line). Everything is an instanced kit model placed along the track relative to the train,
// moving at the timetable's speed; the quest's signal at danger stands at its own distance along its leg
// (red until shown the lantern). Pulling into a station, its platform (the real one's fixtures, cloned) slides
// in alongside and stops exactly where it stands; pulling out, the platform left behind slides away.

import * as THREE from 'three';
import { ACCEL, BRAKE, E, J, LEG, PASS_LEG, REGIONS, S, TRANSIT, TRAIN, legDistance, trackY, trainOrigin, type TrainState } from '../../../data/ghosttrain';
import { PLATFORM_DEPTH, STATION_PROPS } from '../../../data/gtStations';
import { LAST_TRAIN } from '../../../data/lastTrain';
import type { Prop } from '../../../data/map';
import { ActorBatch } from '../../core/batch';
import { C, ModelBuilder, SURF, box, cone, cyl, ellipsoid, sphere, weather } from '../../core/geo';
import { actorMaterial } from '../../core/materials';
import { PAL } from '../../models/kit';
import { GT_KIT } from './kit';

const B = (fn: (m: ModelBuilder) => void, ao = 0.3) => {
  const m = new ModelBuilder();
  fn(m);
  return m.build({ ao });
};
const iron = weather(0x22261f, 0.45, 0.05, 0x5a3a24);

/** A telegraph pole with its crossarms and insulators. */
const POLE = () => B((m) => {
  m.add(cyl(4, 5.5, 260, 8), { col: weather(0x2a2018, 0.5), pos: [0, 130, 0], surf: SURF.wood });
  for (const y of [236, 216]) {
    m.add(box(6, 6, 90), { col: weather(0x2a2018, 0.5), pos: [0, y, 0], surf: SURF.wood });
    for (const z of [-38, -14, 14, 38]) m.add(cyl(2, 2.4, 7, 6), { col: 0x7a8a90, pos: [0, y + 6, z], surf: SURF.glass });
  }
});
/** A semaphore signal post: lattice post, arm, lamp (lit red or green by tint). */
const SIGNAL = (lit: number) => B((m) => {
  m.add(box(10, 300, 10), { col: iron, pos: [0, 150, 0], surf: SURF.iron });
  for (let i = 0; i < 10; i++) m.add(box(12, 2, 12), { col: 0x14100e, pos: [0, 20 + i * 28, 0], surf: SURF.iron });
  m.add(box(90, 14, 4), { col: lit === 0 ? 0x8a1410 : 0xd8ccb0, pos: [-45, 280, 8], rot: [0, 0, lit === 0 ? 0 : 0.7], surf: SURF.paint });
  m.add(box(10, 14, 4.4), { col: 0xe8e0d0, pos: [-76, 280, 8], surf: SURF.paint });
  m.add(sphere(9, 10, 8), { col: lit === 0 ? 0xff2a1a : 0x40ff90, pos: [0, 262, 12], surf: SURF.bulb, emit: 2.6 });
  m.add(cone(3, 12, 6), { col: iron, pos: [0, 306, 0], surf: SURF.iron });
});
const TREE = () => B((m) => {
  m.add(cyl(9, 14, 120, 8), { col: weather(0x2a2018, 0.5), pos: [0, 60, 0], surf: SURF.wood });
  for (let i = 0; i < 5; i++) m.add(ellipsoid(60 - i * 6, 46, 60 - i * 6, 10, 8), { col: weather(0x1a2416, 0.45, 0.1), pos: [Math.cos(i * 1.3) * 22, 150 + i * 22, Math.sin(i * 1.3) * 22], surf: SURF.cloth });
}, 0.45);
const HEDGE = () => B((m) => {
  for (let i = 0; i < 6; i++) m.add(ellipsoid(44, 34, 30, 10, 6), { col: weather(0x18241a, 0.45, 0.1), pos: [-110 + i * 44, 28, 0], surf: SURF.cloth });
}, 0.5);
const FOGBANK = () => B((m) => {
  for (let i = 0; i < 4; i++) m.add(ellipsoid(140, 30, 70, 10, 6), { col: C(0x5a6878), pos: [-200 + i * 130, 30, (i % 2) * 40], surf: SURF.cloth, emit: 0.15 });
}, 0);
/** One bay of the bridge's truss (a unit 120 long along X), a side at a time. */
const TRUSS = () => B((m) => {
  m.add(box(120, 10, 10), { col: iron, pos: [0, 8, 0], surf: SURF.iron });
  m.add(box(120, 10, 10), { col: iron, pos: [0, 150, 0], surf: SURF.iron });
  m.add(box(8, 150, 8), { col: iron, pos: [-56, 80, 0], surf: SURF.iron });
  m.add(box(10, 196, 6), { col: iron, pos: [0, 80, 0], rot: [0, 0, 0.67], surf: SURF.iron });
  for (let k = 0; k < 8; k++) m.add(sphere(1.6, 4, 3), { col: PAL.brass, pos: [-56 + k * 16, 150, 6], surf: SURF.iron });
}, 0.1);

/** What each leg's country is made of: [kit/model key, spacing, side offsets (y from the track), jitter]. */
type Lane = { key: string; every: number; ys: number[]; jit: number; phase: number };
const LEGS: Lane[][] = [
  // the Junction to Saint Vesper's: hedgerows and field trees
  [{ key: 'tree', every: 520, ys: [520, -760], jit: 160, phase: 0 }, { key: 'hedge', every: 380, ys: [330], jit: 60, phase: 0.3 }, { key: 'gt_headstone', every: 2600, ys: [700], jit: 80, phase: 0.1 }],
  // Saint Vesper's to the Works: yews, graves, an angel or two
  [{ key: 'gt_yew', every: 420, ys: [480, -700], jit: 120, phase: 0 }, { key: 'gt_headstone', every: 110, ys: [300, 360], jit: 30, phase: 0.2 }, { key: 'gt_angel', every: 1700, ys: [560], jit: 100, phase: 0.6 }],
  // the Works to Stillwater: chimneys, slag, coke ovens
  [{ key: 'gt_chimney', every: 1300, ys: [900, -1000], jit: 200, phase: 0 }, { key: 'gt_slagheap', every: 700, ys: [460], jit: 120, phase: 0.4 }, { key: 'gt_brazier', every: 600, ys: [300], jit: 60, phase: 0.1 }],
  // Stillwater onward: willows, cottages in the fog
  [{ key: 'gt_willow', every: 600, ys: [500, -760], jit: 150, phase: 0 }, { key: 'gt_cottage', every: 1900, ys: [820], jit: 160, phase: 0.5 }, { key: 'fog', every: 700, ys: [360, -520], jit: 200, phase: 0.2 }],
];
const SPAN = 9000; // how far along the track (centred on the train) scenery is drawn

/** Kinds of platform fixture cloned into the moving train's place as a station slides in or out. */
const STRIP_KINDS = new Set(['gt_column', 'gt_column_broken', 'gt_lamp', 'gt_bench', 'gt_clock', 'gt_nameboard', 'gt_shelter', 'gt_chute', 'gt_phantom', 'gt_barrier', 'gt_ticketbox', 'gt_railing', 'gt_lychgate', 'gt_postbox']);

export class Scenery {
  private batches = new Map<string, ActorBatch>();
  private strip: { kind: string; v: number; dx: number; dy: number; w: number }[][] = [];
  private stripBatches = new Map<string, ActorBatch>();
  private mat = actorMaterial({ dither: false, detail: true, emitBoost: 2.4 });
  /** the train's distance along the night (for the scenery's scroll), and whether it's on the bridge */
  scroll = 0;
  bridge = 0;
  leg = 0;

  constructor(root: THREE.Object3D) {
    const make = (key: string, geo: THREE.BufferGeometry, cap: number) => {
      const b = new ActorBatch(geo, this.mat, cap, { shadow: false });
      b.rim = [0, 0, 0, 0];
      root.add(b.mesh);
      this.batches.set(key, b);
    };
    make('pole', POLE(), 40);
    make('signal_red', SIGNAL(0), 4);
    make('signal_green', SIGNAL(1), 8);
    make('tree', TREE(), 60);
    make('hedge', HEDGE(), 40);
    make('fog', FOGBANK(), 40);
    make('truss', TRUSS(), 200);
    for (const k of ['gt_headstone', 'gt_yew', 'gt_angel', 'gt_chimney', 'gt_slagheap', 'gt_brazier', 'gt_willow', 'gt_cottage']) make(k, GT_KIT[k](k === 'gt_headstone' ? 0 : 0), k === 'gt_headstone' ? 200 : 40);
    // each station's platform strip, in its train's frame
    for (let r = 0; r < 5; r++) {
      const o = trainOrigin(r), ty = trackY(r);
      const list: Scenery['strip'][number] = [];
      for (const p of STATION_PROPS) {
        if (!STRIP_KINDS.has(p.kind) || Math.abs(p.x - REGIONS[r].cx) > 2400 || p.y < ty || p.y > ty + PLATFORM_DEPTH + 80 || Math.abs(p.y - REGIONS[r].cy) > 1400) continue;
        list.push({ kind: p.kind, v: p.variant ?? 0, dx: p.x - o.x, dy: p.y - o.y, w: p.w ?? (p.hw ?? 50) * 2 });
      }
      this.strip.push(list);
      for (const it of list) {
        const key = `${it.kind}:${it.v}`;
        if (this.stripBatches.has(key)) continue;
        const b = new ActorBatch(GT_KIT[it.kind](it.v), this.mat, it.kind === 'gt_railing' || it.kind === 'gt_barrier' ? 160 : 60, { shadow: false });
        b.rim = [0, 0, 0, 0];
        root.add(b.mesh);
        this.stripBatches.set(key, b);
      }
    }
  }

  /**
   * Lay out the scenery for this frame: `st` the train, `scroll` the total distance travelled (any monotonic
   * number), `sigClear` which legs' quest signals show clear, `sigAt` where each stands along its leg.
   */
  update(st: TrainState, sigClear: number, sigAt: number[], quest: boolean): void {
    for (const b of this.batches.values()) b.begin();
    for (const b of this.stripBatches.values()) b.begin();
    const o = trainOrigin(TRANSIT);
    const legIdx = st.phase === 'travel' ? Math.min(3, st.at === E ? 3 : st.at) : 0;
    this.leg = legIdx;
    // the scroll: distance along this leg (the country is laid out by leg, so each leg starts fresh)
    const along = st.phase === 'travel' ? st.dist : 0;
    this.scroll = along;
    // poles along the north side, every 400
    this.lane(o, along, 'pole', 400, [-560], 0, 0);
    for (const L of LEGS[legIdx]) this.lane(o, along, L.key, L.every, L.ys, L.jit, L.phase);
    // the line's own signals: one at each end of the leg, and (with the quest) the one at danger
    if (st.phase === 'travel') {
      const front = o.x + TRAIN.locoFront;
      for (const f of [0.08, 0.92]) {
        const d = f * st.legDist;
        const x = front + (d - along);
        if (Math.abs(x - o.x) < SPAN / 2) this.batches.get('signal_green')!.add(x, o.y - 240, 0, 0, 1);
      }
      if (quest && st.at <= S) {
        const d = sigAt[st.at] * st.legDist;
        const x = front + (d - along);
        const clear = !!(sigClear & (1 << st.at));
        if (Math.abs(x - o.x) < SPAN / 2) this.batches.get(clear ? 'signal_green' : 'signal_red')!.add(x, o.y - 240, 0, 0, 1.15);
      }
      // the bridge over the drop, on the way from Stillwater to the End of the Line (and through it)
      this.bridge = 0;
      if (st.at === S) {
        const len = st.passing ? PASS_LEG : LEG;
        const [t0, t1] = st.passing ? [LAST_TRAIN.bridge[0] * (PASS_LEG / LEG), LAST_TRAIN.bridge[1] * (PASS_LEG / LEG)] : LAST_TRAIN.bridge;
        const d0 = legDistance(t0, len), d1 = legDistance(t1, len);
        // the bridge's truss runs from d0 to d1 along the leg; draw the bays in view on both sides
        const tr = this.batches.get('truss')!;
        for (let d = d0; d < d1; d += 120) {
          const x = front - 600 + (d - along);
          if (Math.abs(x - o.x) > SPAN / 2) continue;
          for (const s of [-1, 1]) tr.add(x, o.y + s * 150, 0, 0, 1);
        }
        const mid = along + (front - 600 - o.x) * 0;
        const on = along >= d0 - 900 && along <= d1 + 1200 ? 1 : 0;
        this.bridge = on * Math.min(1, Math.min(along - (d0 - 900), d1 + 1200 - along) / 600);
        void mid;
      }
    } else this.bridge = 0;
    // a station sliding in alongside (pulling in) or away behind (pulling out)
    if (st.phase === 'travel' || st.phase === 'approach') {
      const rem = st.legDist - st.dist;
      const dest = st.phase === 'approach' ? J : st.to;
      if (rem < 5200 && !(st.passing && dest === E)) this.drawStrip(dest, o, rem);
      if (st.phase === 'travel' && st.dist < 5200) this.drawStrip(st.at, o, -st.dist);
    }
    for (const b of this.batches.values()) b.end();
    for (const b of this.stripBatches.values()) b.end();
  }

  /** Station r's platform strip, `off` units east of where it stands when the train is at rest. */
  private drawStrip(r: number, o: { x: number; y: number }, off: number): void {
    for (const it of this.strip[r] ?? []) {
      const x = o.x + it.dx + off;
      if (Math.abs(x - o.x) > SPAN / 2) continue;
      const b = this.stripBatches.get(`${it.kind}:${it.v}`);
      if (!b) continue;
      const len = it.kind === 'gt_railing' || it.kind === 'gt_barrier' ? 100 : 0;
      if (len) {
        // in runs of about 100, as the station itself lays them (a railing's piers keep their size)
        const n = Math.max(1, Math.round(it.w / len)), seg = it.w / n;
        for (let k = 0; k < n; k++) b.add(x - it.w / 2 + seg * (k + 0.5), o.y + it.dy, 0, 0, 1, seg / len, 1, 1);
      } else b.add(x, o.y + it.dy, 0, 0, 1);
    }
  }

  /** A lane of scenery `every` units apart along the track, at offsets `ys` across it, scrolling past. */
  private lane(o: { x: number; y: number }, along: number, key: string, every: number, ys: number[], jit: number, phase: number): void {
    const b = this.batches.get(key);
    if (!b) return;
    const first = Math.floor((along - SPAN / 2) / every);
    const last = Math.ceil((along + SPAN / 2) / every);
    for (let k = first; k <= last; k++) {
      const d = (k + phase) * every;
      const x = o.x + (d - along);
      for (let j = 0; j < ys.length; j++) {
        const h = Math.sin(k * 12.9898 + j * 78.233) * 43758.5453;
        const f = h - Math.floor(h);
        const y = o.y + ys[j] + (f - 0.5) * 2 * jit;
        const yaw = key === 'tree' || key === 'hedge' || key === 'fog' || key === 'gt_willow' || key === 'gt_yew' ? 0 : (f - 0.5) * 0.6;
        if (b.add(x + (f - 0.5) * every * 0.4, y, 0, yaw, 0.85 + f * 0.3) < 0) return;
      }
    }
  }
}

export const _unused = { ACCEL, BRAKE };
