// The Boardwalk's world (D-68): the renderer swaps this in when a night starts on Penhallow's Boardwalk.
// The floor (promenade, beach, ride grounds, interiors) and the sea share one waterline; the pier stands
// on its pilings; the façade row, the two entered buildings, the rides, the props, the lights and the
// hidden quest's fixtures are built by their own modules and assembled here.

import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { GameRenderer3D } from '../../renderer3d';
import { SEA } from '../../../data/boardwalk';
import { PROPS, type Prop } from '../../../data/map';
import { StaticBatch } from '../../core/batch';
import { actorMaterial } from '../../core/materials';
import { BoardwalkFloor } from './floor';
import { Ocean, shoreOffset } from './ocean';
import { pierGeometry } from './pier';
import { buildStructures } from './structures';
import { Interiors } from './interiors';
import { BW_PROPS, BW_SKIP } from './props';
import { Rides } from './rides';
import { BoardwalkLighting } from './lighting';
import { BoardwalkQuest } from './quest';

/** Props stretched along their length (`w`) rather than placed at a fixed size. */
const STRETCH: Record<string, number> = { bw_rail: 100, bw_shelf: 100 };

export class BoardwalkWorld {
  readonly root = new THREE.Group();
  readonly ground = new BoardwalkFloor();
  readonly ocean: Ocean;
  readonly indoor = false;
  readonly rides: Rides;
  readonly interiors: Interiors;
  readonly lighting: BoardwalkLighting;
  readonly quest: BoardwalkQuest;
  readonly shafts: BoardwalkLighting['shafts'];
  readonly motes: BoardwalkLighting['motes'];
  private statics: StaticBatch[] = [];

  constructor() {
    this.root.add(this.ground.mesh);
    this.ocean = new Ocean(this.root);
    const solid = (geo: THREE.BufferGeometry, shadow = true) => {
      const b = new StaticBatch(geo, actorMaterial({ dither: true, detail: true, emitBoost: 2.4 }), 1, { shadow });
      b.rim = [0, 0, 0, 0];
      b.add(0, 0, 0, 0, 1);
      b.freeze();
      this.root.add(b.mesh);
      this.statics.push(b);
    };
    solid(pierGeometry());
    const st = buildStructures(this.root);
    solid(st.geo);
    this.interiors = new Interiors(this.root);
    this.interiors.attachSigns(this.root);
    this.rides = new Rides(this.root);
    // ---- the prop kit, one batch per kind and variant
    const groups = new Map<string, Prop[]>();
    for (const p of PROPS) {
      if (BW_SKIP.has(p.kind) || !BW_PROPS[p.kind]) continue;
      const key = `${p.kind}:${p.variant ?? 0}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(p);
    }
    for (const [key, list] of groups) {
      const [kind, v] = key.split(':');
      const len = STRETCH[kind];
      // stretched kinds repeat their run along the length (so posts stay posts), each run nudged to fit
      const runs = (p: Prop) => (len ? Math.max(1, Math.round((p.w ?? (p.hw ?? len / 2) * 2) / len)) : 1);
      const count = list.reduce((n, p) => n + runs(p), 0);
      const b = new StaticBatch(BW_PROPS[kind](Number(v)), actorMaterial({ dither: true, detail: true, emitBoost: 2.6, envIntensity: 0.6 }), count, { shadow: kind !== 'bw_rail' });
      b.rim = [0, 0, 0, 0];
      for (const p of list) {
        if (len) {
          const w = p.w ?? (p.hw ?? len / 2) * 2, n = runs(p), seg = w / n;
          for (let i = 0; i < n; i++) b.add(p.x - w / 2 + seg * (i + 0.5), p.y, 0, p.yaw ?? 0, 1, seg / len, 1, 1);
        } else b.add(p.x, p.y, 0, p.yaw ?? 0, 1);
      }
      b.freeze();
      this.root.add(b.mesh);
      this.statics.push(b);
    }
    this.lighting = new BoardwalkLighting(this.root, [...st.bulbs, ...this.interiors.bulbs, ...this.rides.bulbs], st.windows);
    this.shafts = this.lighting.shafts;
    this.motes = this.lighting.motes;
    this.quest = new BoardwalkQuest(this.root);
  }

  update(g: Game, r: GameRenderer3D, inView: (x: number, y: number) => boolean, dt: number): void {
    const off = shoreOffset(g.time, SEA.retreat);
    this.ground.u.uShoreOff.value = off;
    this.ground.u.uSeaTime.value = g.time;
    this.ocean.update(g.time, r.camX, r.camY, off);
    this.rides.update(g.time, inView);
    this.interiors.update(g.player.x, g.player.y, dt);
    this.lighting.update(g, r, inView);
    this.quest.update(g, r, dt);
    this.lighting.lensK = this.quest.lensK(r.time);
  }

  addLights(g: Game, time: number): void {
    this.lighting.addLights(g, time);
    this.quest.addLights(g);
  }

  setQuality(q: 'low' | 'medium' | 'high'): void {
    this.ocean.setQuality(q);
  }
}
