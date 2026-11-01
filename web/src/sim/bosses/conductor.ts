// THE GHOST TRAIN, SECRET BOSS — THE CONDUCTOR (D-80). Silas Marrow, who sold the Midnight Line's passengers
// to keep it running and was made to punch their tickets ever after: a gaunt man in a conductor's coat and
// cap, a ticket punch in one hand and a signal lantern in the other, his ticket satchel bursting with the
// tickets of everyone the line ever carried. Only reachable through The Last Train Home.
// P1 Tickets, Please: punches under each of you (and again where you stepped to), storms of tickets in
//    spirals, the lantern's beams.
// P2 Final Destination: "All aboard" (he pulls everyone in, then the blast), the timetable, the Collected.
// P3 Terminus: the line closes in round him (only near him is safe), and the punches faster.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { GhostTrainBoss } from './gtBoss';

/** Tuning the tests read. */
export const CONDUCTOR = { punchR: 88, tickets: 14, beamLen: 460, aboardR: 230, aboardPull: 520, safeR: 420, closeR: 1500, marks: 12 };

export class ConductorBoss extends GhostTrainBoss {
  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.moveSpeed = 110;
    this.keepDist = 320;
    this.pose = { punch: 0, lantern: 0, whistle: 0, tickets: 0, coat: 0, fall: 0, step: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.punch = Math.max(0, P.punch - dt * 2.4);
    P.whistle = Math.max(0, P.whistle - dt * 1.6);
    P.tickets = Math.max(0, P.tickets - dt * 1.2);
    P.coat += dt * (1 + this.phase * 0.5);
    P.step += Math.hypot(this.x - this.px, this.y - this.py) * 0.05;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    for (let k = 0; k < 4; k++) {
      this.sfx('gt_punch', 0.9, 1 - k * 0.08);
      this.pose.punch = 1;
      yield 0.35;
    }
    this.pose.whistle = 1;
    this.sfx('gt_whistle', 1, 1.2);
    this.g.fx.push('ring', this.x, this.y, 230, 0, 0, 'gold');
    yield 0.5;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'punch', w: 1.2, fn: () => this.punch(2) },
      { name: 'tickets', w: 1, fn: () => this.tickets(3) },
      { name: 'lantern', w: 0.9, fn: () => this.lantern(3, 1, 3.5) },
    ];
    if (phase === 1) return [
      { name: 'aboard', w: 1.1, fn: () => this.allAboard() },
      { name: 'timetable', w: 1, fn: () => this.timetable() },
      { name: 'collected', w: 0.6, fn: () => this.collected() },
      { name: 'punch', w: 0.9, fn: () => this.punch(3) },
      { name: 'tickets', w: 0.8, fn: () => this.tickets(4) },
    ];
    return [
      { name: 'terminus', w: 1.1, fn: () => this.terminus() },
      { name: 'punch', w: 1.1, fn: () => this.punch(4) },
      { name: 'lantern', w: 0.9, fn: () => this.lantern(4, 1.3, 4) },
      { name: 'aboard', w: 0.8, fn: () => this.allAboard() },
      { name: 'tickets', w: 0.7, fn: () => this.tickets(5) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.moveSpeed = 120;
      this.banner('FINAL DESTINATION', '"Every passenger reaches it. Every one."');
      this.sfx('gt_whistle', 1, 0.9);
    }
    if (phase === 2) {
      this.moveSpeed = 135;
      this.keepDist = 260;
      this.banner('TERMINUS', '"This train terminates here."');
      this.sfx('gt_whistle', 1, 0.7);
    }
    return null;
  }

  /** Punches under each of you, and again where you stepped to. */
  private *punch(n: number): Co {
    this.anim = 'punch';
    for (let k = 0; k < n; k++) {
      const L = this.locals();
      const targets = L.length ? L : [this.target()];
      const t = this.tele(k === 0 ? 1.1 : 0.85);
      for (const p of targets) {
        const c = this.ground(p.x + p.vx * 0.25, p.y + p.vy * 0.25, 0);
        this.hz('circle', 'gt_punch_mark', c.x, c.y, { r: CONDUCTOR.punchR, tele: t, active: 0.15, dmg: 22 });
      }
      yield* this.windupFor(t, 'punch');
      this.pose.punch = 1;
      this.sfx('gt_punch', 1);
      yield 0.15;
    }
    yield 0.4;
  }

  /** Storms of tickets thrown out in turning spirals. */
  private *tickets(n: number): Co {
    this.anim = 'tickets';
    let a0 = this.g.rng.angle();
    const dir = this.g.rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < n; k++) {
      this.pose.tickets = 1;
      for (let i = 0; i < CONDUCTOR.tickets; i++) {
        const a = a0 + (i / CONDUCTOR.tickets) * TAU;
        const b = this.bullet('page', this.x, this.y - 30, a, 240, 11, { r: 9, life: 4 });
        if (b) b.turn = 0.35 * dir;
      }
      this.sfx('papercrinkle', 0.7);
      a0 += (TAU / CONDUCTOR.tickets / 2) * dir;
      yield 0.45;
    }
    yield 0.4;
  }

  /** The signal lantern: beams that turn about him. */
  private *lantern(beams: number, spin: number, secs: number): Co {
    this.anim = 'lantern';
    this.noRoam = true;
    const a0 = this.g.rng.angle(), t = this.tele(1), L = CONDUCTOR.beamLen;
    const dir = this.g.rng.chance(0.5) ? 1 : -1;
    const list = [];
    for (let i = 0; i < beams; i++) {
      const a = a0 + (i / beams) * TAU;
      list.push(this.hz('line', 'gt_lantern_beam', this.x, this.y, { x2: this.x + Math.cos(a) * L, y2: this.y + Math.sin(a) * L, r2: 18, len: L, angle: a, tele: t, active: secs, dmg: 14, tick: 0.5 }));
    }
    yield* this.windupFor(t, 'lantern');
    for (const h of list) h.spinRate = spin * dir;
    yield secs;
    this.noRoam = false;
    this.pose.lantern = 0;
  }

  /** "All aboard!": everyone is drawn in toward him; then the doors slam on whoever is closest. */
  private *allAboard(): Co {
    this.anim = 'whistle';
    this.noRoam = true;
    const t = this.tele(1.6);
    this.hz('circle', 'gt_all_aboard', this.x, this.y, { r: CONDUCTOR.aboardR, tele: t, active: 0.3, dmg: 28, pull: CONDUCTOR.aboardPull, pullR: 900 });
    this.sfx('gt_whistle', 1, 1.1);
    yield* this.windupFor(t, 'whistle');
    this.pose.whistle = 1;
    this.sfx('gt_doors', 1);
    this.g.fx.push('ring', this.x, this.y, CONDUCTOR.aboardR, 0, 0, 'gold');
    yield 0.6;
    this.noRoam = false;
  }

  /** The timetable: a dial of punches round you, in order. */
  private *timetable(): Co {
    this.anim = 'punch';
    const p = this.target();
    const a0 = this.g.rng.angle(), dir = this.g.rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < CONDUCTOR.marks; k++) {
      const a = a0 + dir * (k / CONDUCTOR.marks) * TAU;
      const c = this.ground(p.x + Math.cos(a) * 250, p.y + Math.sin(a) * 250, 0);
      this.hz('circle', 'gt_punch_mark', c.x, c.y, { r: 70, tele: this.tele(0.8 + k * 0.11), active: 0.15, dmg: 15 });
    }
    this.hz('circle', 'gt_punch_mark', p.x, p.y, { r: 96, tele: this.tele(0.8 + CONDUCTOR.marks * 0.11), active: 0.2, dmg: 18 });
    yield this.tele(0.8 + CONDUCTOR.marks * 0.11) + 0.3;
  }

  /** The Collected come when he calls, with the ticket-punchers. */
  private *collected(): Co {
    this.anim = 'whistle';
    yield* this.windupFor(0.6, 'whistle');
    this.sfx('gt_whistle', 0.8, 1.3);
    const p = this.target();
    const crew = ['gt_collected', 'gt_puncher', 'gt_collected', 'gt_puncher'];
    const n = Math.round(crew.length * this.addsMult());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.g.rng.next() * 0.4, r = this.g.rng.range(320, 400);
      this.add(crew[i % crew.length], p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    yield 1;
  }

  /** Terminus: the line closes in round him. Only near him is safe; then the punches find you there. */
  private *terminus(): Co {
    this.anim = 'lantern';
    this.noRoam = true;
    const t = this.tele(1.8);
    this.hz('annulus', 'gt_terminus', this.x, this.y, { r: CONDUCTOR.closeR, r2: CONDUCTOR.safeR, tele: t, active: 2.4, dmg: 12, tick: 0.5 });
    this.sfx('gt_toll', 1, 0.6);
    yield* this.windupFor(t, 'lantern');
    yield 1.2;
    this.noRoam = false;
    yield* this.punch(2);
  }

  protected *defeatSequence(): Co {
    this.sfx('gt_punch', 1, 0.6);
    for (let i = 0; i < 150; i++) {
      this.pose.fall = Math.min(1, i / 120);
      if (i % 10 === 0) this.g.fx.push('spark', this.x + this.g.rng.range(-70, 70), this.y - 40, 5, 0, 0, 'gold');
      yield 1 / 60;
    }
    this.g.fx.push('ring', this.x, this.y, 320, 0, 0, 'gold');
    this.sfx('gt_whistle', 1, 1.4);
    yield 1.2;
  }
}
