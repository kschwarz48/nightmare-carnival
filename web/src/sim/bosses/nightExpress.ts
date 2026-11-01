// THE GHOST TRAIN, FINAL BOSS — THE NIGHT EXPRESS (D-80). Engine No. 13, Marrow's bargain in iron: a black
// locomotive that runs without a track, its headlamp an eye and its smokebox door a jaw. It holds the dawn
// at the End of the Line: the night cannot end until it falls.
// P1 Departure: it runs down lit lanes across the concourse and turns at the end, the whistle's shockwave,
//    cinders from its stack.
// P2 Full Steam Ahead: phantom carriages sweep across the station in lanes, the firebox's breath, passengers
//    put off (the Collected, and the Ticketless with them).
// P3 Runaway: it runs and runs, lane after lane with hardly a pause; whistle and cinders faster.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { GhostTrainBoss } from './gtBoss';

/** Tuning the tests read. */
export const NIGHT_EXPRESS = { laneHalf: 84, runSpeed: 1250, carHalf: 70, carGap: 230, breathR: 540, breathHalf: 0.42, cinderR: 66 };

export class NightExpressBoss extends GhostTrainBoss {
  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.moveSpeed = 120;
    this.keepDist = 420;
    this.pose = { steam: 0, whistle: 0, wheels: 0, lamp: 1, charge: 0, jaw: 0, fall: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.whistle = Math.max(0, P.whistle - dt * 1.6);
    P.jaw = Math.max(0, P.jaw - dt * 1.2);
    P.charge = Math.max(0, P.charge - dt * 0.8);
    P.steam += dt * (1 + this.phase * 0.7 + P.charge * 3);
    // the driving wheels turn with its speed
    P.wheels += Math.hypot(this.x - this.px, this.y - this.py) * 0.03 + dt * 0.4;
    P.lamp = 0.8 + 0.2 * Math.sin(this.animT * 3) + this.windup * 0.4;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('gt_whistle', 1, 0.7);
    for (let i = 0; i < 100; i++) {
      this.pose.charge = Math.sin((i / 100) * Math.PI);
      if (i % 12 === 0) this.sfx('gt_chuff', 0.8, 0.8 + i / 250);
      yield 1 / 60;
    }
    this.pose.jaw = 1;
    this.sfx('roar', 1, 0.5);
    this.g.fx.push('ring', this.x, this.y, 240, 0, 0, 'fire');
    this.g.fx.push('shake', this.x, this.y, 0.6);
    yield 0.5;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'run', w: 1.3, fn: () => this.run(2, 1.2) },
      { name: 'whistle', w: 1, fn: () => this.whistle(2) },
      { name: 'cinders', w: 1, fn: () => this.cinders(16) },
    ];
    if (phase === 1) return [
      { name: 'cars', w: 1.1, fn: () => this.phantomCars(4) },
      { name: 'breath', w: 1, fn: () => this.breath() },
      { name: 'passengers', w: 0.7, fn: () => this.passengers() },
      { name: 'run', w: 1, fn: () => this.run(2, 1.05) },
      { name: 'cinders', w: 0.7, fn: () => this.cinders(18) },
    ];
    return [
      { name: 'runaway', w: 1.3, fn: () => this.run(4, 0.75) },
      { name: 'cars', w: 1, fn: () => this.phantomCars(6) },
      { name: 'whistle', w: 0.9, fn: () => this.whistle(3) },
      { name: 'breath', w: 0.8, fn: () => this.breath() },
      { name: 'cinders', w: 0.7, fn: () => this.cinders(24) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.moveSpeed = 135;
      this.banner('FULL STEAM AHEAD', 'Every carriage it ever pulled is coming with it.');
      this.sfx('gt_whistle', 1, 0.8);
    }
    if (phase === 2) {
      this.moveSpeed = 150;
      this.keepDist = 360;
      this.banner('RUNAWAY', 'No brakes. No driver. No stopping.');
      this.sfx('gt_whistle', 1, 0.6);
    }
    return null;
  }

  /** It runs down a lit lane through where you stand, far past you, and turns at the end. */
  private *run(n: number, tele: number): Co {
    for (let i = 0; i < n; i++) {
      this.anim = 'charge';
      this.sfx('gt_chuff', 0.9, 1.1);
      yield* this.chargeLane(NIGHT_EXPRESS.runSpeed, 700, NIGHT_EXPRESS.laneHalf, tele, 'gt_express_lane', 'charge');
      this.sfx('gt_brake', 0.9, 0.8);
      this.g.fx.push('spark', this.x, this.y, 10, 0, 0, 'electric');
      yield 0.35;
    }
  }

  /** The whistle: a shockwave rolling out of it, with a gap to stand in. */
  private *whistle(n: number): Co {
    this.anim = 'whistle';
    for (let i = 0; i < n; i++) {
      yield* this.windupFor(this.tele(0.45), 'whistle');
      this.pose.whistle = 1;
      const gap = this.angleToTarget() + this.g.rng.range(-1.5, 1.5);
      this.hz('ring', 'gt_whistle_ring', this.x, this.y, { r: 80, r2: 40, grow: 360, tele: 0.01, active: 1.8, dmg: 18, gapHalf: 0.46, angle: gap });
      this.sfx('gt_whistle', 1, 0.9);
      yield 0.55;
    }
    yield 0.5;
  }

  /** Cinders from the stack, raining round everyone at the End of the Line. */
  private *cinders(n: number): Co {
    this.anim = 'steam';
    this.pose.jaw = 1;
    const L = this.locals();
    for (let i = 0; i < n; i++) {
      const p = L.length ? L[i % L.length] : this.target();
      const c = this.ground(p.x + this.g.rng.range(-340, 340), p.y + this.g.rng.range(-260, 260), 0);
      this.hz('circle', 'gt_cinder', c.x, c.y, { r: NIGHT_EXPRESS.cinderR, tele: this.tele(1.05), active: 0.15, dmg: 13 });
      if (i % 4 === 0) this.sfx('gt_chuff', 0.5);
      yield 0.06;
    }
    yield this.tele(1);
  }

  /** Phantom carriages: lanes across the station, and the cars run down them one after another. */
  private *phantomCars(n: number): Co {
    this.anim = 'whistle';
    this.pose.whistle = 1;
    this.sfx('gt_whistle', 0.8, 1.2);
    const p = this.target();
    const dir = this.g.rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const o = dir * (k - (n - 1) / 2) * NIGHT_EXPRESS.carGap;
      const a = this.ground(p.x - 1500, p.y + o, 0), b = this.ground(p.x + 1500, p.y + o, 0);
      this.hz('line', 'gt_phantom_car', a.x, a.y, { x2: b.x, y2: b.y, r2: NIGHT_EXPRESS.carHalf, tele: this.tele(1.2 + k * 0.3), active: 0.35, dmg: 20 });
    }
    yield this.tele(1.2 + n * 0.3) + 0.4;
    this.sfx('gt_rush', 1);
  }

  /** The firebox's breath: a long cone of fire ahead of it. */
  private *breath(): Co {
    this.anim = 'breath';
    this.noRoam = true;
    const a = this.angleToTarget();
    this.face = Math.cos(a) > 0 ? 1 : -1;
    const t = this.tele(0.95);
    this.hz('sector', 'gt_furnace_blast', this.x, this.y, { r: NIGHT_EXPRESS.breathR, angle: a, half: NIGHT_EXPRESS.breathHalf, tele: t, active: 1.2, dmg: 10, tick: 0.3 });
    yield* this.windupFor(t, 'charge');
    this.pose.jaw = 1;
    this.sfx('gt_furnace', 1, 0.8);
    yield 1.2;
    this.noRoam = false;
  }

  /** It puts its passengers off: the Collected step down, and the Ticketless with them. */
  private *passengers(): Co {
    this.anim = 'whistle';
    yield* this.windupFor(0.6, 'whistle');
    this.sfx('gt_doors', 1);
    const p = this.target();
    const crew = ['gt_collected', 'gt_ticketless', 'gt_ticketless', 'gt_ticketless', 'gt_ticketless', 'gt_collected', 'gt_ticketless', 'gt_ticketless', 'gt_ticketless', 'gt_ticketless'];
    const n = Math.round(crew.length * this.addsMult());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.g.rng.next() * 0.3, r = this.g.rng.range(280, 380);
      this.add(crew[i % crew.length], p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    yield 1.1;
  }

  protected *defeatSequence(): Co {
    this.sfx('gt_whistle', 1, 0.5);
    for (let i = 0; i < 150; i++) {
      this.pose.fall = Math.min(1, i / 120);
      this.pose.lamp = Math.max(0, 1 - i / 130);
      if (i % 18 === 0) this.g.fx.push('spark', this.x + this.g.rng.range(-80, 80), this.y - 50, 8, 0, 0, 'fire');
      yield 1 / 60;
    }
    this.g.fx.push('explosion', this.x, this.y, 320, 0, 0, 'fire');
    this.g.fx.push('shake', this.x, this.y, 1);
    this.sfx('boom', 1, 0.5);
    yield 1;
  }
}
