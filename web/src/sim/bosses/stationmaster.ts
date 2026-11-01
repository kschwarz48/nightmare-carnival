// THE GHOST TRAIN, BOSS 1 — THE STATIONMASTER (D-80). Hollow Junction's keeper of the timetable: a tall man
// in a frock coat gone to mould, a lantern in one hand, a whistle on a chain, and a pocket watch the size of
// a cartwheel on his back like a shield.
// P1 Platform One: Mind the Gap (lanes across the station where phantom trains pass), the whistle's cone,
//    the lantern swung round on its chain.
// P2 Delays Expected: the timetable (a clock face of marks round you, going off in order), porters called.
// P3 Final Call: the express charge, the last-call rings with one gap, everything faster.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { GhostTrainBoss } from './gtBoss';

/** Tuning the tests read. */
export const STATIONMASTER = { laneHalf: 46, laneGap: 190, whistleR: 430, whistleHalf: 0.44, beamLen: 380, marks: 12, markR: 66, markRing: 230 };

export class StationmasterBoss extends GhostTrainBoss {
  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.moveSpeed = 100;
    this.keepDist = 300;
    this.pose = { whistle: 0, lantern: 0, watch: 0, wave: 0, swing: 0, charge: 0, fall: 0, step: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.whistle = Math.max(0, P.whistle - dt * 1.8);
    P.wave = Math.max(0, P.wave - dt * 1.2);
    P.watch = Math.max(0, P.watch - dt * 0.6);
    P.charge = Math.max(0, P.charge - dt * 2);
    P.step += Math.hypot(this.x - this.px, this.y - this.py) * 0.05;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('gt_whistle', 1);
    for (let i = 0; i < 80; i++) {
      this.pose.watch = Math.sin((i / 80) * Math.PI);
      yield 1 / 60;
    }
    this.pose.whistle = 1;
    this.sfx('gt_bell', 0.9);
    this.g.fx.push('ring', this.x, this.y, 170, 0, 0, 'shock');
    yield 0.5;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'gap', w: 1.2, fn: () => this.mindTheGap(2) },
      { name: 'whistle', w: 1, fn: () => this.whistle(2) },
      { name: 'lantern', w: 0.9, fn: () => this.lantern(2, 0.9, 3) },
    ];
    if (phase === 1) return [
      { name: 'timetable', w: 1.1, fn: () => this.timetable(STATIONMASTER.marks) },
      { name: 'porters', w: 0.7, fn: () => this.porters() },
      { name: 'gap', w: 1, fn: () => this.mindTheGap(3) },
      { name: 'whistle', w: 0.8, fn: () => this.whistle(2) },
      { name: 'lantern', w: 0.7, fn: () => this.lantern(3, 1.1, 3.5) },
    ];
    return [
      { name: 'express', w: 1.1, fn: () => this.express(2) },
      { name: 'lastcall', w: 1, fn: () => this.lastCall() },
      { name: 'timetable', w: 0.9, fn: () => this.timetable(STATIONMASTER.marks + 4) },
      { name: 'gap', w: 0.8, fn: () => this.mindTheGap(4) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.moveSpeed = 115;
      this.banner('DELAYS EXPECTED', 'The Midnight Line regrets any inconvenience.');
      this.sfx('gt_bell', 0.9);
    }
    if (phase === 2) {
      this.moveSpeed = 130;
      this.keepDist = 240;
      this.banner('FINAL CALL', 'All aboard that are going aboard.');
      this.sfx('gt_whistle', 1, 0.8);
    }
    return null;
  }

  /** Mind the Gap: lanes light up across the station, and the phantom trains run down them. */
  private *mindTheGap(n: number): Co {
    this.anim = 'wave';
    this.pose.wave = 1;
    this.sfx('gt_bell', 0.7);
    const p = this.target();
    const horiz = this.g.rng.chance(0.6);
    const off = this.g.rng.range(-60, 60);
    const t = this.tele(1.15);
    for (let k = 0; k < n; k++) {
      const o = (k - (n - 1) / 2) * STATIONMASTER.laneGap + off;
      if (horiz) {
        const a = this.ground(p.x - 1400, p.y + o, 0), b = this.ground(p.x + 1400, p.y + o, 0);
        this.hz('line', 'gt_rail_lane', a.x, a.y, { x2: b.x, y2: b.y, r2: STATIONMASTER.laneHalf, tele: t + k * 0.18, active: 0.3, dmg: 16 });
      } else {
        const a = this.ground(p.x + o, p.y - 900, 0), b = this.ground(p.x + o, p.y + 900, 0);
        this.hz('line', 'gt_rail_lane', a.x, a.y, { x2: b.x, y2: b.y, r2: STATIONMASTER.laneHalf, tele: t + k * 0.18, active: 0.3, dmg: 16 });
      }
    }
    yield t + n * 0.18;
    this.sfx('gt_rush', 0.9);
    yield 0.5;
  }

  /** The whistle: a cone of sound that flattens whoever stands in it. */
  private *whistle(n: number): Co {
    for (let i = 0; i < n; i++) {
      const a = this.angleToTarget();
      this.face = Math.cos(a) > 0 ? 1 : -1;
      this.anim = 'whistle';
      const t = this.tele(0.75);
      this.hz('sector', 'gt_whistle', this.x, this.y, { r: STATIONMASTER.whistleR, angle: a, half: STATIONMASTER.whistleHalf, tele: t, active: 0.3, dmg: 18 });
      yield* this.windupFor(t, 'whistle');
      this.pose.whistle = 1;
      this.sfx('gt_whistle', 1, 1.15);
      for (let r = 1; r <= 4; r++) this.g.fx.push('ring', this.x + Math.cos(a) * r * 95, this.y + Math.sin(a) * r * 95, 30 + r * 22, 0, 0, 'shock');
      yield 0.4;
    }
  }

  /** The lantern swung round on its chain: beams of light that turn about him. */
  private *lantern(beams: number, spin: number, secs: number): Co {
    this.anim = 'swing';
    const a0 = this.g.rng.angle(), t = this.tele(1), L = STATIONMASTER.beamLen;
    const dir = this.g.rng.chance(0.5) ? 1 : -1;
    const list = [];
    for (let i = 0; i < beams; i++) {
      const a = a0 + (i / beams) * TAU;
      list.push(this.hz('line', 'gt_lantern_beam', this.x, this.y, { x2: this.x + Math.cos(a) * L, y2: this.y + Math.sin(a) * L, r2: 18, len: L, angle: a, tele: t, active: secs, dmg: 14, tick: 0.5 }));
    }
    this.noRoam = true;
    yield* this.windupFor(t, 'lantern');
    for (const h of list) h.spinRate = spin * dir;
    for (let s = 0; s < secs; s += 0.25) {
      this.pose.swing += 0.25 * spin * dir;
      yield 0.25;
    }
    this.noRoam = false;
    this.pose.lantern = 0;
  }

  /** The timetable: a clock face of marks round you, going off in order round the dial. */
  private *timetable(n: number): Co {
    this.anim = 'watch';
    this.pose.watch = 1;
    this.sfx('gt_tick', 0.9);
    const p = this.target();
    const a0 = this.g.rng.angle(), dir = this.g.rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const a = a0 + dir * (k / n) * TAU;
      const c = this.ground(p.x + Math.cos(a) * STATIONMASTER.markRing, p.y + Math.sin(a) * STATIONMASTER.markRing, 0);
      this.hz('circle', 'gt_clock_mark', c.x, c.y, { r: STATIONMASTER.markR, tele: this.tele(0.8 + k * 0.12), active: 0.15, dmg: 14 });
    }
    // and the hour itself, where you stood
    this.hz('circle', 'gt_clock_mark', p.x, p.y, { r: 90, tele: this.tele(0.8 + n * 0.12), active: 0.2, dmg: 18 });
    yield this.tele(0.8 + n * 0.12) + 0.3;
  }

  /** "Porter!": station hands come at a run. */
  private *porters(): Co {
    this.anim = 'wave';
    this.pose.wave = 1;
    this.sfx('gt_whistle', 0.8, 1.3);
    yield 0.5;
    const p = this.target();
    const crew = ['gt_porter', 'gt_ticketless', 'gt_ticketless', 'gt_ticketless', 'gt_porter', 'gt_ticketless', 'gt_ticketless'];
    const n = Math.round(crew.length * this.addsMult());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.g.rng.next(), r = this.g.rng.range(260, 340);
      this.add(crew[i % crew.length], p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    yield 1.1;
  }

  /** The express: he comes down a lit lane like a train that won't stop. */
  private *express(n: number): Co {
    for (let i = 0; i < n; i++) {
      this.anim = 'charge';
      yield* this.chargeLane(980, 320, 64, 0.8, 'gt_charge', 'charge');
      this.sfx('gt_brake', 0.8);
      yield 0.3;
    }
  }

  /** Last call: rings of whistle-noise roll out, each with one quiet gap. */
  private *lastCall(): Co {
    this.anim = 'whistle';
    for (let i = 0; i < 3; i++) {
      yield* this.windupFor(this.tele(0.35), 'whistle');
      this.pose.whistle = 1;
      const gap = this.angleToTarget() + this.g.rng.range(-1.6, 1.6);
      this.hz('ring', 'gt_whistle_ring', this.x, this.y, { r: 60, r2: 34, grow: 330, tele: 0.01, active: 1.7, dmg: 16, gapHalf: 0.5, angle: gap });
      this.sfx('gt_whistle', 0.8, 1.3);
      yield 0.5;
    }
    yield 0.7;
  }

  protected *defeatSequence(): Co {
    this.sfx('gt_tick', 1, 0.6);
    for (let i = 0; i < 110; i++) {
      this.pose.fall = Math.min(1, i / 80);
      this.pose.watch = 1 - i / 110;
      yield 1 / 60;
    }
    this.sfx('gt_bell', 0.8, 0.6);
    yield 1;
  }
}
