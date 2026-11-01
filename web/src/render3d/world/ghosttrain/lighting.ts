// The Ghost Train's lighting (D-80). As on every map, each pool of light comes from a fixture you can see: the
// platforms' gas lamps and the stations' lamp posts (warm at the Junction and Stillwater, sickly green over
// Saint Vesper's graves, cold blue at the End of the Line), the Cinder Works' braziers, tap holes and coke
// ovens, lit windows in the terminal, the signal box, the chapel and the cottages, the station clocks' faces,
// and the train: warm sconce light in every carriage (pink under the dining car's shades, violet over Car 13's
// candles), its windows spilling onto the platform, and the locomotive's headlamp. Halos on the fixtures,
// shafts under the lamps, motes in the light.

import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { GameRenderer3D } from '../../renderer3d';
import { CARS, REGIONS, TRAIN, trainOrigin } from '../../../data/ghosttrain';
import { PROPS } from '../../../data/map';
import { pool } from '../../core/materials';
import { LightShafts, Motes, type Shaft } from '../atmosphere';
import type { Frame } from '../../../render/atlas';
import { GT_LAMPPOST_H, GT_LAMP_H } from './kit';
import type { TrainRender } from './train';

type RGB = [number, number, number];
interface Fix { x: number; y: number; h: number; r: number; k: number; col: RGB; halo: number; flick: number; fire?: boolean }

const WARM: RGB = [1, 0.68, 0.38];
const GRAVE: RGB = [0.7, 1, 0.66];
const COLD: RGB = [0.6, 0.8, 1];
/** each car's lamp colour */
const CAR_LIGHT: Record<string, RGB> = { tender: [1, 0.5, 0.2], baggage: [1, 0.7, 0.42], coach: [1, 0.72, 0.45], dining: [1, 0.6, 0.55], funeral: [0.72, 0.55, 1], sleeper: [0.9, 0.72, 0.5], observation: [1, 0.74, 0.48] };

export class GtLighting {
  readonly shafts: LightShafts;
  readonly motes: Motes;
  private fix: Fix[] = [];
  private glowF: Frame | null = null;

  constructor(root: THREE.Object3D) {
    const add = (f: Fix) => this.fix.push(f);
    for (const p of PROPS) {
      const v = p.variant ?? 0;
      switch (p.kind) {
        case 'gt_lamp': add({ x: p.x, y: p.y, h: GT_LAMP_H, r: 300, k: 1.15, col: v ? COLD : WARM, halo: 0.6, flick: 0.1 }); break;
        case 'gt_lamppost': {
          const col = v === 1 ? GRAVE : v === 3 ? COLD : WARM;
          for (const dx of v === 0 ? [-18, 18] : [0]) add({ x: p.x + dx, y: p.y, h: GT_LAMPPOST_H, r: v === 0 ? 220 : 280, k: v === 0 ? 0.8 : 1.05, col, halo: 0.55, flick: 0.12 });
          break;
        }
        case 'gt_brazier': add({ x: p.x, y: p.y, h: 52, r: 300, k: 1.15, col: [1, 0.48, 0.18], halo: 0.8, flick: 0.4, fire: true }); break;
        case 'gt_furnace': add({ x: p.x, y: p.y + 170, h: 40, r: 420, k: 1.4, col: [1, 0.45, 0.15], halo: 1.2, flick: 0.3, fire: true }); break;
        case 'gt_cokeovens': for (let i = 0; i < 8; i += 2) add({ x: p.x - 262 + i * 75, y: p.y + 90, h: 36, r: 200, k: 0.8, col: [1, 0.42, 0.12], halo: 0.5, flick: 0.3, fire: true }); break;
        case 'gt_slagheap': add({ x: p.x, y: p.y, h: 30, r: (p.r ?? 100) + 120, k: 0.55, col: [1, 0.42, 0.14], halo: 0, flick: 0.2 }); break;
        case 'gt_chimney': add({ x: p.x, y: p.y, h: 552, r: 200, k: 0.4, col: [1, 0.45, 0.15], halo: 0.7, flick: 0.3 }); break;
        case 'gt_clock': add({ x: p.x, y: p.y, h: 168, r: 160, k: v === 4 ? 0.3 : 0.55, col: [1, 0.92, 0.75], halo: 0.35, flick: 0 }); break;
        case 'gt_booking': add({ x: p.x, y: p.y + 110, h: 95, r: 260, k: 0.9, col: [1, 0.78, 0.5], halo: 0.4, flick: 0.05 }); break;
        case 'gt_signalbox': add({ x: p.x, y: p.y + 140, h: 146, r: 280, k: 0.8, col: [1, 0.76, 0.46], halo: 0.4, flick: 0.05 }); break;
        case 'gt_terminal':
          add({ x: p.x, y: p.y + 260, h: 90, r: 420, k: 1, col: [1, 0.72, 0.42], halo: 0.9, flick: 0.04 });
          add({ x: p.x, y: p.y + 120, h: 400, r: 260, k: 0.5, col: [1, 0.95, 0.8], halo: 1.1, flick: 0 });
          break;
        case 'gt_fountain': add({ x: p.x, y: p.y, h: 176, r: 260, k: 0.8, col: [1, 0.85, 0.6], halo: 0.5, flick: 0.05 }); break;
        case 'gt_chapel':
          for (const dx of [-170, 170]) add({ x: p.x + dx, y: p.y + 260, h: 120, r: 240, k: 0.75, col: [0.8, 0.7, 1], halo: 0.5, flick: 0.1 });
          break;
        case 'gt_church':
          for (const dx of [-180, 180]) add({ x: p.x + dx, y: p.y + 300, h: 110, r: 220, k: 0.7, col: [1, 0.78, 0.48], halo: 0.4, flick: 0.1 });
          add({ x: p.x, y: p.y - 40, h: 380, r: 160, k: 0.3, col: [1, 0.95, 0.78], halo: 0.45, flick: 0 });
          break;
        case 'gt_cottage': if (v !== 2) add({ x: p.x + (v === 0 ? -66 : 66), y: p.y + 140, h: 64, r: 180, k: 0.6, col: [1, 0.72, 0.42], halo: 0.3, flick: 0.15 }); break;
        case 'gt_stationhouse': add({ x: p.x + 40, y: p.y + 100, h: 104, r: 240, k: 0.85, col: WARM, halo: 0.45, flick: 0.1 }); break;
        case 'gt_shelter': add({ x: p.x, y: p.y + 30, h: 128, r: 240, k: 0.85, col: WARM, halo: 0.45, flick: 0.12 }); break;
        case 'gt_mausoleum': add({ x: p.x, y: p.y + 70, h: 70, r: 160, k: 0.6, col: GRAVE, halo: 0.4, flick: 0.2 }); break;
        case 'gt_ticketbox': add({ x: p.x + 24, y: p.y, h: 138, r: 240, k: 0.9, col: [1, 0.88, 0.6], halo: 0.5, flick: 0.05 }); break;
        case 'gt_buffers': add({ x: p.x - 14, y: p.y, h: 84, r: 180, k: 0.8, col: [1, 0.25, 0.15], halo: 0.6, flick: 0 }); break;
        case 'gt_hotel': add({ x: p.x, y: p.y + 260, h: 160, r: 300, k: 0.55, col: WARM, halo: 0, flick: 0.1 }); break;
      }
    }
    const shafts: Shaft[] = [];
    for (const f of this.fix) if (f.h > 120 && f.h < 200 && f.halo > 0.5) shafts.push({ x: f.x, y: f.y, h: f.h - 12, r: 70, col: f.col, flicker: 0, k: f.x * 0.37, kind: 'lamp', a: 0.75 });
    this.shafts = new LightShafts(root, shafts);
    this.motes = new Motes(this.fix.filter((f, i) => f.halo > 0.4 && i % 2 === 0).slice(0, 80).map((f) => ({ x: f.x, y: f.y, col: f.col })));
  }

  private flick(f: Fix, t: number): number {
    if (f.fire) return 0.78 + 0.22 * Math.sin(t * 13 + f.x) * Math.sin(t * 7.3 + f.y);
    if (!f.flick) return 1;
    const s = Math.sin(t * 2.3 + f.x * 0.013) * Math.sin(t * 5.1 + f.y * 0.007);
    return 1 - f.flick * Math.max(0, s - 0.6) * 2.5;
  }

  update(g: Game, r: GameRenderer3D, inView: (x: number, y: number) => boolean, train: TrainRender): void {
    const t = r.time;
    const on = 1 - g.darkness * 0.92;
    const glow = (this.glowF ??= r.assets.atlas.get('fx_glow_0'));
    for (const f of this.fix) {
      if (f.halo <= 0 || !inView(f.x, f.y)) continue;
      const k = this.flick(f, t) * on;
      if (k > 0.1) r.glow.draw(glow, f.x, f.y, f.h, f.halo, f.halo, 0, f.col[0], f.col[1], f.col[2], 0.5 * k);
      if (f.fire && Math.random() < 0.08) r.fx.handle([{ type: 'spark', x: f.x + (Math.random() - 0.5) * 30, y: f.y, a: 1, b: 0, c: 0, style: 'fire' }]);
    }
    // the locomotive's headlamp halo on every copy that's drawn
    for (let i = 0; i < REGIONS.length; i++) {
      const off = train.shownAt(i);
      if (off === null) continue;
      const o = trainOrigin(i);
      const hx = o.x + off + TRAIN.locoFront + 8;
      if (inView(hx, o.y)) r.glow.draw(glow, hx, o.y, 200, 1.4, 1.4, 0, 1, 0.94, 0.75, 0.6 * on);
    }
  }

  addLights(g: Game, time: number, train: TrainRender, localX: number, localY: number): void {
    const on = 1 - g.darkness * 0.92;
    for (const f of this.fix) pool.add(f.x, f.y, f.r, f.k * this.flick(f, time) * on, f.col[0], f.col[1], f.col[2], f.h);
    // each carriage's lamps, in every copy that's drawn; the windows' light on the platform beside a parked train
    for (let i = 0; i < REGIONS.length; i++) {
      const off = train.shownAt(i);
      if (off === null) continue;
      const o = trainOrigin(i);
      const near = Math.abs(localX - o.x) < 3200 && Math.abs(localY - o.y) < 1600;
      if (!near) continue;
      // the carriages' sconces: a low warm light down each car (low enough to light the floor without a haze)
      const inside = Math.abs(localY - o.y) < TRAIN.halfW + 30;
      for (const c of CARS) {
        const cx = o.x + off + (c.x0 + c.x1) / 2;
        const col = CAR_LIGHT[c.id];
        pool.add(cx, o.y, 250, (inside ? 0.62 : 0.4) * on, col[0], col[1], col[2], 34, 1.4);
        if (i !== 5 && !inside && (c.id === 'coach' || c.id === 'dining' || c.id === 'sleeper')) pool.add(cx, o.y + TRAIN.halfW + 60, 200, 0.28 * on, 1, 0.78, 0.5, 30);
      }
      // the headlamp's pool on the track ahead (out of sight from inside the moving train)
      if (i !== 5) pool.add(o.x + off + TRAIN.locoFront + 240, o.y, 280, 1.1 * on, 1, 0.92, 0.72, 120, 1.2);
    }
  }
}
