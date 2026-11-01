// The Ghost Train's world (D-80): the renderer swaps this in when a night starts on the Midnight Line. The
// ground of each place, the stations' fixtures and buildings (instanced by kind), the train in every place it
// stands, the country streaming past the moving one, the lights, and the hidden quest's fixtures.

import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { GameRenderer3D } from '../../renderer3d';
import { PROPS, type Prop } from '../../../data/map';
import { TRAIN } from '../../../data/ghosttrain';
import { JUNCTION } from '../../../data/gtStations';
import { signMesh } from '../props';
import type { LastTrainChain } from '../../../sim/quest/lastTrain';
import { trainNow } from '../../../sim/ghosttrain';
import { StaticBatch } from '../../core/batch';
import { ModelBuilder, SURF, box, weather } from '../../core/geo';
import { actorMaterial } from '../../core/materials';
import { GtFloor } from './floor';
import { GT_KIT, GT_SKIP, GT_STRETCH } from './kit';
import { TrainRender } from './train';
import { Scenery } from './scenery';
import { GtLighting } from './lighting';
import { GtQuest } from './quest';

/** Kinds that belong to the carriages (drawn by the train, in every copy) rather than the stations. */
const TRAIN_KINDS = new Set(['gt_coal', 'gt_luggage', 'gt_seat', 'gt_table', 'gt_catafalque', 'gt_candles', 'gt_partition', 'gt_armchair', 'gt_rail']);

/** The platform's kerb beyond the train's ends (the sim's `gt_edge` walls). */
function kerb(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(box(100, 10, 14), { col: weather(0x8a8478, 0.45, 0.05, 0x3a3830), pos: [0, 5, 0], surf: SURF.paint });
  m.add(box(100, 2, 4), { col: 0xc8c0a8, pos: [0, 10.5, 5], surf: SURF.paint });
  return m.build({ ao: 0.2 });
}

export class GhostTrainWorld {
  readonly root = new THREE.Group();
  readonly ground = new GtFloor();
  readonly indoor = false;
  readonly train: TrainRender;
  readonly scenery: Scenery;
  readonly lighting: GtLighting;
  readonly quest: GtQuest;
  readonly shafts: GtLighting['shafts'];
  readonly motes: GtLighting['motes'];
  private statics: StaticBatch[] = [];

  constructor() {
    this.root.add(this.ground.mesh);
    // ---- the stations' kit, one batch per kind and variant
    const groups = new Map<string, Prop[]>();
    for (const p of PROPS) {
      if (GT_SKIP.has(p.kind) || TRAIN_KINDS.has(p.kind) || !GT_KIT[p.kind]) continue;
      const key = `${p.kind}:${p.variant ?? 0}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(p);
    }
    const mat = actorMaterial({ dither: true, detail: true, emitBoost: 2.6, envIntensity: 0.6 });
    for (const [key, list] of groups) {
      const [kind, v] = key.split(':');
      const len = GT_STRETCH[kind];
      const along = (p: Prop) => ((p.hh ?? 0) > (p.hw ?? 0) ? (p.hh ?? 50) * 2 : p.w ?? (p.hw ?? len / 2) * 2);
      const runs = (p: Prop) => (len ? Math.max(1, Math.round(along(p) / len)) : 1);
      const count = list.reduce((n, p) => n + runs(p), 0);
      const big = ['gt_terminal', 'gt_parcels', 'gt_hotel', 'gt_chapel', 'gt_church', 'gt_furnace', 'gt_chimney', 'gt_watertower', 'gt_signalbox', 'gt_cokeovens', 'gt_mausoleum', 'gt_cottage'].includes(kind);
      const b = new StaticBatch(GT_KIT[kind](Number(v)), mat, count, { shadow: big || kind === 'gt_column' || kind === 'gt_lamp' || kind === 'gt_lamppost' || kind === 'gt_yew' || kind === 'gt_willow' });
      b.rim = [0, 0, 0, 0];
      for (const p of list) {
        if (len) {
          const vert = (p.hh ?? 0) > (p.hw ?? 0);
          const w = along(p), n = runs(p), seg = w / n;
          for (let i = 0; i < n; i++) {
            if (vert) b.add(p.x, p.y - w / 2 + seg * (i + 0.5), 0, Math.PI / 2, 1, seg / len, 1, 1);
            else b.add(p.x - w / 2 + seg * (i + 0.5), p.y, 0, p.yaw ?? 0, 1, seg / len, 1, 1);
          }
        } else b.add(p.x, p.y, 0, p.yaw ?? 0, 1);
      }
      b.freeze();
      this.root.add(b.mesh);
      this.statics.push(b);
    }
    // the platforms' kerbs beyond the train
    const edges = PROPS.filter((p) => p.kind === 'gt_edge');
    const kb = new StaticBatch(kerb(), mat, edges.reduce((n, p) => n + Math.max(1, Math.round(((p.hw ?? 50) * 2) / 100)), 0), { shadow: false });
    kb.rim = [0, 0, 0, 0];
    for (const p of edges) {
      const w = (p.hw ?? 50) * 2, n = Math.max(1, Math.round(w / 100)), seg = w / n;
      for (let i = 0; i < n; i++) kb.add(p.x - w / 2 + seg * (i + 0.5), p.y, 0, 0, 1, seg / 100, 1, 1);
    }
    kb.freeze();
    this.root.add(kb.mesh);
    this.statics.push(kb);
    // the booking office's board over its window, lettered (D-84)
    const sign = signMesh('TICKETS', 106, 15, { color: '#3a1418', glow: 0.25 });
    sign.position.set(JUNCTION.office.x, 136, JUNCTION.office.y + 72.6);
    this.root.add(sign);
    this.train = new TrainRender(this.root);
    this.scenery = new Scenery(this.root);
    this.lighting = new GtLighting(this.root);
    this.shafts = this.lighting.shafts;
    this.motes = this.lighting.motes;
    this.quest = new GtQuest(this.root);
  }

  update(g: Game, r: GameRenderer3D, inView: (x: number, y: number) => boolean, _dt: number): void {
    const st = trainNow(g);
    const p = g.player;
    this.train.update(st, p.x, p.y, r.time);
    const ch = g.quests?.get<LastTrainChain>('last_train');
    this.scenery.update(st, ch?.signals ?? 0, ch?.sigAt ?? [0.5, 0.5, 0.5, 0.5], !!ch && ch.stage === 4);
    this.ground.u.uScroll.value = this.scenery.scroll;
    this.ground.u.uLeg.value = this.scenery.leg;
    this.ground.u.uBridge.value = this.scenery.bridge;
    this.lighting.update(g, r, inView, this.train);
    this.quest.update(g, r, this.train, inView);
  }

  addLights(g: Game, time: number): void {
    const p = g.player;
    this.lighting.addLights(g, time, this.train, p.x, p.y);
    this.quest.addLights(g, time, this.train);
  }

  setQuality(_q: 'low' | 'medium' | 'high'): void {}
}

export const _unused = { TRAIN };
