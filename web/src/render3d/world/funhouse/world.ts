// The Fun House's world (D-63): the renderer swaps this in for the Carnival Core's when a night starts in
// the house. Walls tiled from SEG sections in five styles, framed mirror panels with real reflections
// (mirrors.ts), the pivoting panels swinging on their hinges with a warning flash, the corridor's
// pistons and their telegraphs, the kaleidoscope's crown, the music box's ballerina, the clocks, and
// the hidden quest's fixtures (their states drawn from the replicated quest, see quest.ts).

import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { GameRenderer3D } from '../../renderer3d';
import { PROPS, type Prop } from '../../../data/map';
import { DOOR_PANELS, MAZE, PANEL, PIVOTS, PIVOT_WARN, PISTONS, PISTON_TELE, ROTUNDA, pivotNextIn, pivotState } from '../../../data/funhouse';
import { pistonPhase } from '../../../sim/funhouse';
import { ActorBatch, StaticBatch } from '../../core/batch';
import { SURF, box } from '../../core/geo';
import { ModelBuilder } from '../../models/kit';
import { actorMaterial, pool } from '../../core/materials';
import { FunhouseFloor } from './floor';
import { MirrorSystem } from './mirrors';
import { FUNHOUSE_PROPS, SEG, WALL_T, mirrorPanel, wallSection } from './models';
import { lampFlicker } from '../props';
import { QuestVisuals } from './quest';

/** Props with moving parts of their own (drawn per frame), and kinds the walls handle. */
const DYNAMIC = new Set(['fh_wall', 'fh_mirror']);

export class FunhouseWorld {
  readonly root = new THREE.Group();
  readonly ground = new FunhouseFloor();
  readonly indoor = true;
  readonly mirrors: MirrorSystem;
  private statics: StaticBatch[] = [];
  private pivots: ActorBatch;
  private pivotGlass: ActorBatch;
  private crown: ActorBatch;
  private pistonHeads: ActorBatch;
  private ballerina: ActorBatch;
  private lamps: Prop[];
  private musicBox: Prop | undefined;
  /** extra per-frame batches other modules (the quest's visuals) can fill */
  readonly dyn = new Map<string, ActorBatch>();
  /** the gallery's great curtain over the projector (the quest parts it) */
  greatCurtain: StaticBatch | null = null;
  private quest = new QuestVisuals(this);
  readonly shafts = { update: () => {} };

  constructor() {
    this.root.add(this.ground.mesh);
    // ---- walls: every style's section tiled along its walls, stretched to fit exactly
    const byStyle = new Map<string, Prop[]>();
    for (const p of PROPS) if (p.kind === 'fh_wall') (byStyle.get(p.style ?? 'deco') ?? byStyle.set(p.style ?? 'deco', []).get(p.style ?? 'deco')!).push(p);
    for (const [style, list] of byStyle) {
      let count = 0;
      for (const p of list) count += Math.max(1, Math.round((p.w ?? SEG) / SEG));
      const b = new StaticBatch(wallSection(style), actorMaterial({ dither: true, detail: true, emitBoost: 2.4 }), count, { shadow: true });
      b.rim = [0, 0, 0, 0];
      for (const p of list) {
        const len = p.w ?? SEG;
        const n = Math.max(1, Math.round(len / SEG));
        const vertical = !!p.yaw;
        const thick = vertical ? (p.hw ?? 20) * 2 : (p.hh ?? 20) * 2;
        const sz = thick / (WALL_T[style] ?? 40);
        for (let i = 0; i < n; i++) {
          const o = -len / 2 + (len / n) * (i + 0.5);
          b.add(vertical ? p.x : p.x + o, vertical ? p.y + o : p.y, 0, vertical ? Math.PI / 2 : 0, 1, len / n / SEG, 1, sz);
        }
      }
      b.freeze();
      this.root.add(b.mesh);
      this.statics.push(b);
    }
    // ---- the maze's framed panels (their glass is the mirror system's)
    const panels = PROPS.filter((p) => p.kind === 'fh_mirror');
    for (const [vertical, len] of [[false, MAZE.cw + PANEL * 2], [true, MAZE.ch + PANEL * 2]] as [boolean, number][]) {
      const list = panels.filter((p) => !!p.yaw === vertical);
      const b = new StaticBatch(mirrorPanel(len), actorMaterial({ dither: true, emitBoost: 2.4, envIntensity: 0.9 }), Math.max(1, list.length), { shadow: true });
      b.rim = [0, 0, 0, 0];
      for (const p of list) b.add(p.x, p.y, 0, vertical ? Math.PI / 2 : 0, 1);
      b.freeze();
      this.root.add(b.mesh);
      this.statics.push(b);
    }
    {
      const b = new StaticBatch(mirrorPanel(MAZE.cw + PANEL * 2, true), actorMaterial({ dither: true, emitBoost: 2.6, envIntensity: 1 }), DOOR_PANELS.length, { shadow: true });
      b.rim = [0, 0, 0, 0];
      for (const p of DOOR_PANELS) b.add(p.x, p.y, 0, 0, 1);
      b.freeze();
      this.root.add(b.mesh);
      this.statics.push(b);
    }
    // the glass: the south faces of the static panels and the door
    this.mirrors = new MirrorSystem([...panels.filter((p) => !p.yaw), ...DOOR_PANELS]);
    this.root.add(this.mirrors.group);
    // ---- furniture, grouped by kind and variant
    const groups = new Map<string, Prop[]>();
    for (const p of PROPS) {
      if (DYNAMIC.has(p.kind) || !FUNHOUSE_PROPS[p.kind]) continue;
      const v = p.kind === 'fh_plinth' ? ['strongman', 'ballerina', 'clown', 'magician'].indexOf(p.label ?? '') : p.variant ?? 0;
      const key = `${p.kind}:${v}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push({ ...p, variant: v });
    }
    for (const [key, list] of groups) {
      const [kind, v] = key.split(':');
      const geo = FUNHOUSE_PROPS[kind](Number(v));
      const b = new StaticBatch(geo, actorMaterial({ dither: true, detail: true, emitBoost: 2.6, envIntensity: 0.7 }), list.length, { shadow: kind !== 'fh_mark' && kind !== 'fh_mural' });
      b.rim = [0, 0, 0, 0];
      for (const p of list) b.add(p.x, p.y, 0, p.yaw ?? 0, 1);
      b.freeze();
      this.root.add(b.mesh);
      this.statics.push(b);
      if (key === 'fh_curtain:3') this.greatCurtain = b;
    }
    // ---- moving parts
    const dyn = (geo: THREE.BufferGeometry, cap: number, emit = 2.6, shadow = true) => {
      const b = new ActorBatch(geo, actorMaterial({ emitBoost: emit, dither: true, envIntensity: 0.9 }), cap, { shadow });
      b.rim = [0, 0, 0, 0];
      this.root.add(b.mesh);
      return b;
    };
    this.pivots = dyn(mirrorPanel(MAZE.cw + PANEL * 2), PIVOTS.length);
    this.pivotGlass = dyn(new ModelBuilder().add(box(MAZE.cw - 4, 122, 2), { col: 0x9fb0bc, pos: [0, 75, PANEL + 1], surf: SURF.glass, emit: 0.18 }).build({ ao: 0 }), PIVOTS.length, 1.2, false);
    this.crown = dyn(FUNHOUSE_PROPS.fh_kaleido_crown(0), 1, 2.8, false);
    this.pistonHeads = dyn(FUNHOUSE_PROPS.fh_piston_head(0), PISTONS.length);
    this.ballerina = dyn(FUNHOUSE_PROPS.fh_ballerina(0), 1, 1.6, false);
    this.lamps = PROPS.filter((p) => p.kind === 'fh_lamp' || p.kind === 'fh_chandelier');
    this.musicBox = PROPS.find((p) => p.kind === 'fh_musicbox');
  }

  /** A per-frame batch for other modules (created once, filled every frame). */
  batch(key: string, geo: () => THREE.BufferGeometry, cap: number, emit = 2.6): ActorBatch {
    let b = this.dyn.get(key);
    if (!b) {
      b = new ActorBatch(geo(), actorMaterial({ emitBoost: emit, dither: true, envIntensity: 0.9 }), cap, { shadow: true });
      b.rim = [0, 0, 0, 0];
      this.root.add(b.mesh);
      this.dyn.set(key, b);
    }
    return b;
  }

  update(g: Game, r: GameRenderer3D, inView: (x: number, y: number) => boolean, dt: number): void {
    const t = g.time;
    const now = r.time;
    for (const b of [this.pivots, this.pivotGlass, this.crown, this.pistonHeads, this.ballerina]) b.begin();
    for (const b of this.dyn.values()) b.begin();
    // ---- pivoting panels: swing on the hinge they share, in the last moments before each turn; flash first
    const shuffle = g.pivotShuffleT > 0;
    PIVOTS.forEach((pv, i) => {
      const s = pivotState(i, t, shuffle);
      const nextIn = pivotNextIn(i, t, shuffle);
      const from = s ? pv.b : pv.a, to = s ? pv.a : pv.b;
      const k = nextIn < 0.45 ? 1 - nextIn / 0.45 : 0;
      const e = k * k * (3 - 2 * k);
      const hinge = sharedCorner(pv.a, pv.b);
      const angOf = (p: Prop) => Math.atan2(p.y - hinge.y, p.x - hinge.x);
      let a0 = angOf(from), a1 = angOf(to);
      if (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
      if (a0 - a1 > Math.PI) a1 += Math.PI * 2;
      const a = a0 + (a1 - a0) * e;
      const half = (MAZE.cw + PANEL * 2) / 2;
      const cx = hinge.x + Math.cos(a) * half, cy = hinge.y + Math.sin(a) * half;
      if (!inView(cx, cy)) return;
      // the panel's length runs along its local x: yaw so local x points along (cos a, sin a)
      const yaw = -a;
      const pi = this.pivots.add(cx, cy, 0, yaw, 1);
      const warn = nextIn < PIVOT_WARN ? 0.5 + 0.5 * Math.sin(now * 22) : 0;
      if (warn > 0) this.pivots.tint(pi, 1, 0.35 + 0.65 * (1 - warn), 0.3 + 0.7 * (1 - warn), 1 + warn * 2.5);
      const gi = this.pivotGlass.add(cx, cy, 0, yaw, 1);
      this.pivotGlass.tint(gi, 0.75, 0.85, 0.95, 0.5 + warn);
      if (warn > 0) r.teleLine.line(hinge.x, hinge.y, hinge.x + Math.cos(a1) * half * 2, hinge.y + Math.sin(a1) * half * 2, 6, 1, 0.3, 0.2, 0.5 * warn);
    });
    // ---- the kaleidoscope's crown turns; the corridor's pistons warn, then drop
    if (inView(ROTUNDA.x, ROTUNDA.y)) this.crown.add(ROTUNDA.x, ROTUNDA.y, 334, now * 0.6, 1);
    PISTONS.forEach((p, i) => {
      if (!inView(p.x, p.y)) return;
      const ph = pistonPhase(i, t);
      const cyc = (t + p.phase) % p.period;
      // raised high while it waits, shivering during its warning, slammed down for a moment after
      const struck = cyc < 0.35;
      const h = struck ? 20 + (cyc / 0.35) * 40 : ph > 0 ? 220 + Math.sin(now * 50) * 4 * ph : 220;
      this.pistonHeads.add(p.x, p.y, h, 0, 1);
      if (ph > 0) {
        r.teleFill.circle(p.x, p.y, p.r * ph, 1, 0.25, 0.1, 0.32, 0.12);
        r.teleLine.ring(p.x, p.y, p.r - 3, p.r + 3, 1, 0.35, 0.15, 0.9);
      }
    });
    if (this.musicBox && inView(this.musicBox.x, this.musicBox.y)) this.ballerina.add(this.musicBox.x, this.musicBox.y, 96, now * 1.4, 1.4);
    for (const b of [this.pivots, this.pivotGlass, this.crown, this.pistonHeads, this.ballerina]) b.end();
    this.quest.update(g, r, inView, dt);
    this.mirrors.doorOpen += ((g.funhouseDoorOpen ? 1 : 0) - this.mirrors.doorOpen) * 0.05;
  }

  /** Called after the dyn batches are filled by others this frame. */
  endFrame(): void {
    for (const b of this.dyn.values()) b.end();
  }

  addLights(g: Game, time: number): void {
    const on = 1 - g.darkness * 0.92;
    for (const p of this.lamps) {
      const fl = lampFlicker(p, time) * on;
      pool.add(p.x, p.y, p.kind === 'fh_chandelier' ? 360 : 260, (p.kind === 'fh_chandelier' ? 1.1 : 1.3) * fl, 1, 0.62, 0.3, p.kind === 'fh_chandelier' ? 280 : 120);
    }
    // the kaleidoscope throws slow coloured spots across the Rotunda
    for (let k = 0; k < 6; k++) {
      const a = time * 0.25 + (k / 6) * Math.PI * 2;
      const c = [[1, 0.3, 0.4], [0.3, 0.8, 1], [1, 0.85, 0.3], [0.7, 0.4, 1], [0.4, 1, 0.6], [1, 0.5, 0.2]][k];
      pool.add(ROTUNDA.x + Math.cos(a) * 420, ROTUNDA.y + Math.sin(a) * 300, 150, 0.55 * on, c[0], c[1], c[2], 600, 5, 0.3);
    }
  }

  /** Reflections are rendered last, once every batch for the frame is filled. */
  beforeComposite(r: GameRenderer3D, scene: THREE.Scene, camera: THREE.OrthographicCamera, view: { x0: number; x1: number; y0: number; y1: number }, budget: number): void {
    const hide: THREE.Object3D[] = [r.teleLine.mesh, r.wire.mesh];
    for (const l of [r.numbers, r.fxAdd, r.fxNormal, r.glow]) for (const b of l.batches) hide.push(b.mesh);
    this.mirrors.render(r.renderer, scene, camera, r.time, view.x0, view.x1, view.y0, view.y1, budget, hide);
  }
}

/** The corner two pivot positions share: the hinge it swings on. */
function sharedCorner(a: Prop, b: Prop): { x: number; y: number } {
  const ends = (p: Prop): [number, number][] => (p.yaw ? [[p.x, p.y - (p.hh ?? 0) + PANEL], [p.x, p.y + (p.hh ?? 0) - PANEL]] : [[p.x - (p.hw ?? 0) + PANEL, p.y], [p.x + (p.hw ?? 0) - PANEL, p.y]]);
  let best = { x: a.x, y: a.y }, bd = Infinity;
  for (const [ax, ay] of ends(a)) for (const [bx, by] of ends(b)) {
    const d = (ax - bx) ** 2 + (ay - by) ** 2;
    if (d < bd) {
      bd = d;
      best = { x: (ax + bx) / 2, y: (ay + by) / 2 };
    }
  }
  return best;
}
