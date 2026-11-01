// THE GHOST TRAIN, BOSS 5 — THE HOUR THIEF (D-80). What Marrow sent to Stillwater to collect the hours the
// village sold him: a tall, thin thing of brass and black lacquer, a clock face for a head, the hour and
// minute hands for arms, a pendulum swinging in its open chest. Where it walks, time skips.
// P1 Tick: the hands sweep round it, the chimes fall on the hours of a dial round you, the pendulum's swing.
// P2 Tock: stopped time (slowing pools), the rewind (it lunges, then is back where it was, and that spot bursts).
// P3 The Stopped Hour: thirteen strikes, and the hands faster.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { GhostTrainBoss } from './gtBoss';

/** Tuning the tests read. */
export const HOUR_THIEF = { hourLen: 380, minuteLen: 560, dialR: 320, chimeR: 78, swingR: 620, swingHalf: 0.32, stopR: 150, strikes: 13 };

export class HourThiefBoss extends GhostTrainBoss {
  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.moveSpeed = 95;
    this.keepDist = 330;
    this.pose = { hands: 0, minute: 0, tick: 0, chime: 0, rewind: 0, pendulum: 0, fall: 0, step: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    // the hands keep their own time between attacks (the renderer turns them)
    P.hands += dt * (0.25 + this.phase * 0.15);
    P.minute += dt * (1.2 + this.phase * 0.6);
    P.tick = (P.tick + dt) % 1;
    P.chime = Math.max(0, P.chime - dt * 1.5);
    P.rewind = Math.max(0, P.rewind - dt * 1.2);
    P.pendulum = Math.sin(this.animT * 2.2) * (0.6 + this.windup * 0.4);
    P.step += Math.hypot(this.x - this.px, this.y - this.py) * 0.045;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    for (let k = 0; k < 13; k++) {
      this.sfx('gt_chime', 0.7, 1 - k * 0.025);
      this.pose.chime = 1;
      yield 0.14;
    }
    this.g.fx.push('ring', this.x, this.y, 220, 0, 0, 'frost');
    yield 0.4;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'hands', w: 1.1, fn: () => this.hands(0.75, 4) },
      { name: 'chimes', w: 1, fn: () => this.chimes(12) },
      { name: 'pendulum', w: 0.9, fn: () => this.pendulum(3) },
    ];
    if (phase === 1) return [
      { name: 'stopped', w: 1, fn: () => this.stopped() },
      { name: 'rewind', w: 1, fn: () => this.rewind() },
      { name: 'hands', w: 0.9, fn: () => this.hands(0.95, 4.5) },
      { name: 'chimes', w: 0.8, fn: () => this.chimes(12) },
      { name: 'pendulum', w: 0.7, fn: () => this.pendulum(4) },
    ];
    return [
      { name: 'thirteen', w: 1.2, fn: () => this.thirteen() },
      { name: 'hands', w: 1, fn: () => this.hands(1.25, 5) },
      { name: 'rewind', w: 0.9, fn: () => this.rewind() },
      { name: 'stopped', w: 0.7, fn: () => this.stopped() },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.moveSpeed = 108;
      this.banner('TOCK', 'Stillwater sold its hours. It wants yours.');
      this.sfx('gt_chime', 1, 0.8);
    }
    if (phase === 2) {
      this.moveSpeed = 122;
      this.keepDist = 260;
      this.banner('THE STOPPED HOUR', 'It is always thirteen o\'clock here.');
      this.sfx('gt_chime', 1, 0.6);
    }
    return null;
  }

  /** The hands sweep round it: the long minute hand and the short hour hand, at their own speeds. */
  private *hands(spin: number, secs: number): Co {
    this.anim = 'hands';
    this.noRoam = true;
    const a0 = this.angleToTarget() + Math.PI * 0.6, t = this.tele(1);
    const dir = this.g.rng.chance(0.5) ? 1 : -1;
    const minute = this.hz('line', 'gt_clockhand', this.x, this.y, { x2: this.x + Math.cos(a0) * HOUR_THIEF.minuteLen, y2: this.y + Math.sin(a0) * HOUR_THIEF.minuteLen, r2: 16, len: HOUR_THIEF.minuteLen, angle: a0, tele: t, active: secs, dmg: 14, tick: 0.5 });
    const ah = a0 + Math.PI;
    const hour = this.hz('line', 'gt_clockhand', this.x, this.y, { x2: this.x + Math.cos(ah) * HOUR_THIEF.hourLen, y2: this.y + Math.sin(ah) * HOUR_THIEF.hourLen, r2: 22, len: HOUR_THIEF.hourLen, angle: ah, tele: t, active: secs, dmg: 16, tick: 0.5 });
    this.sfx('gt_tick', 0.9);
    yield* this.windupFor(t, 'tick');
    minute.spinRate = spin * dir;
    hour.spinRate = spin * dir * 0.45;
    for (let s = 0; s < secs; s += 0.5) {
      this.sfx('gt_tick', 0.45, s % 1 ? 1.2 : 1);
      yield 0.5;
    }
    this.noRoam = false;
  }

  /** The chimes fall on the hours of a dial drawn round you, one after another round the face. */
  private *chimes(n: number): Co {
    this.anim = 'chime';
    const p = this.target();
    const start = this.g.rng.int(0, 11);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + ((start + k) % 12) * (TAU / 12);
      const c = this.ground(p.x + Math.cos(a) * HOUR_THIEF.dialR, p.y + Math.sin(a) * HOUR_THIEF.dialR, 0);
      const h = this.hz('circle', 'gt_chime', c.x, c.y, { r: HOUR_THIEF.chimeR, tele: this.tele(0.85 + k * 0.13), active: 0.15, dmg: 15 });
      h.tag = (start + k) % 12;
    }
    this.hz('circle', 'gt_chime', p.x, p.y, { r: 100, tele: this.tele(0.85 + n * 0.13), active: 0.2, dmg: 18 });
    yield this.tele(0.85 + n * 0.13) + 0.3;
  }

  /** The pendulum swings across in front of it: left, middle, right (or the other way). */
  private *pendulum(n: number): Co {
    this.anim = 'pendulum';
    const a = this.angleToTarget();
    const dir = this.g.rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const off = dir * ((k % 3) - 1) * 0.62;
      const t = this.tele(k === 0 ? 0.85 : 0.55);
      this.hz('sector', 'gt_pendulum', this.x, this.y, { r: HOUR_THIEF.swingR, angle: a + off, half: HOUR_THIEF.swingHalf, tele: t, active: 0.25, dmg: 18 });
      yield* this.windupFor(t, 'chime');
      this.sfx('whoosh', 0.7, 0.7);
      yield 0.12;
    }
    yield 0.4;
  }

  /** Stopped time: pools where the moment won't pass (slow, and it aches to stand in them). */
  private *stopped(): Co {
    this.anim = 'chime';
    this.pose.chime = 1;
    this.sfx('gt_chime', 0.8, 0.5);
    const L = this.locals();
    const targets = L.length ? L : [this.target()];
    for (let k = 0; k < 4; k++) {
      const p = targets[k % targets.length];
      const c = this.ground(p.x + this.g.rng.range(-200, 200), p.y + this.g.rng.range(-160, 160), 0);
      this.hz('circle', 'gt_stopped', c.x, c.y, { r: HOUR_THIEF.stopR, tele: this.tele(0.9), active: 5, dmg: 5, tick: 0.5, slow: 0.55 });
    }
    yield this.tele(0.9) + 0.6;
  }

  /** The rewind: it lunges at you, and a moment later it was never there: it is back where it began, and that spot bursts. */
  private *rewind(): Co {
    const x0 = this.x, y0 = this.y;
    this.anim = 'rewind';
    this.hz('circle', 'gt_rewind_mark', x0, y0, { r: 170, tele: this.tele(2.1), active: 0.25, dmg: 24 });
    yield* this.chargeLane(900, 260, 58, 0.75, 'gt_charge', 'rewind');
    yield 0.35;
    this.pose.rewind = 1;
    this.sfx('gt_rewind', 1);
    this.g.fx.push('ring', this.x, this.y, 140, 0, 0, 'frost');
    this.x = this.px = x0;
    this.y = this.py = y0;
    this.g.fx.push('ring', x0, y0, 140, 0, 0, 'frost');
    yield 0.6;
  }

  /** Thirteen strikes, one after another, wherever you are. */
  private *thirteen(): Co {
    this.anim = 'chime';
    const L = this.locals();
    const targets = L.length ? L : [this.target()];
    for (let k = 0; k < HOUR_THIEF.strikes; k++) {
      const p = targets[k % targets.length];
      const c = this.ground(p.x + p.vx * 0.35, p.y + p.vy * 0.35, 0);
      this.hz('circle', 'gt_chime', c.x, c.y, { r: 76, tele: this.tele(0.9), active: 0.15, dmg: 14 });
      this.sfx('gt_chime', 0.5, 1.1 - k * 0.03);
      this.pose.chime = 1;
      yield 0.2;
    }
    yield this.tele(0.9);
  }

  protected *defeatSequence(): Co {
    for (let i = 0; i < 130; i++) {
      this.pose.fall = Math.min(1, i / 100);
      this.pose.hands -= (i / 130) * 0.4;
      this.pose.minute -= (i / 130) * 1.2;
      if (i % 22 === 0) this.sfx('gt_tick', 0.7, 1.6 - i / 130);
      yield 1 / 60;
    }
    this.g.fx.push('explosion', this.x, this.y, 200, 0, 0, 'frost');
    this.sfx('gt_chime', 1, 1.2);
    yield 1;
  }
}
