// THE BOARDWALK, BOSS 1 — THE BOARDWALK BARKER (D-68). The talker who brought the crowds in off the
// trolley for forty summers, on his rolling soapbox, megaphone in one hand and a cane in the other.
// P1 The Pitch: megaphone shouts (cones), ring-toss rain, a shooting-gallery line of tin ducks marching
//    across the stage.
// P2 The Hard Sell: the prize wheel (spokes turning round him), performers called up out of the crowd.
// P3 Last Call: feedback rings with a gap, the soapbox charge, everything faster.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { BoardwalkBoss } from './bwBoss';

/** Tuning the tests read. */
export const BARKER = { stage: 720, shoutR: 430, shoutHalf: 0.42, ducks: 7, duckGap: 72, spokes: 6, spokeLen: 400 };

export class BarkerBoss extends BoardwalkBoss {
  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.arriveNear(420);
    this.moveSpeed = 105;
    this.keepDist = 300;
    this.pose = { shout: 0, cane: 0, tip: 0, toss: 0, wheel: 0, spin: 0, roll: 0, fall: 0, hat: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.shout = Math.max(0, P.shout - dt * 1.6);
    P.cane = Math.max(0, P.cane - dt * 2);
    P.toss = Math.max(0, P.toss - dt * 3);
    P.tip = Math.max(0, P.tip - dt * 0.8);
    P.spin += dt * (P.wheel > 0 ? 2.4 : 0.25);
    // the soapbox's wheels turn as he rolls
    P.roll += Math.hypot(this.x - this.px, this.y - this.py) * 0.06;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.stageRound(BARKER.stage);
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('whistle', 1);
    for (let i = 0; i < 70; i++) {
      this.pose.tip = Math.sin((i / 70) * Math.PI);
      yield 1 / 60;
    }
    this.pose.shout = 1;
    this.sfx('horn', 1, 0.8);
    this.g.fx.push('ring', this.x, this.y, 160, 0, 0, 'shock');
    yield 0.6;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'shout', w: 1.2, fn: () => this.shout(2) },
      { name: 'rings', w: 1, fn: () => this.ringToss(8) },
      { name: 'ducks', w: 0.9, fn: () => this.ducks(2) },
    ];
    if (phase === 1) return [
      { name: 'wheel', w: 1.1, fn: () => this.wheel(BARKER.spokes, 1.05, 4) },
      { name: 'performers', w: 0.7, fn: () => this.performers() },
      { name: 'shout', w: 0.9, fn: () => this.shout(2) },
      { name: 'rings', w: 0.8, fn: () => this.ringToss(10) },
      { name: 'ducks', w: 0.7, fn: () => this.ducks(3) },
    ];
    return [
      { name: 'feedback', w: 1.1, fn: () => this.feedback() },
      { name: 'charge', w: 1, fn: () => this.charge(2) },
      { name: 'wheel', w: 0.9, fn: () => this.wheel(BARKER.spokes + 2, 1.5, 4) },
      { name: 'shout', w: 0.8, fn: () => this.shout(3) },
      { name: 'rings', w: 0.7, fn: () => this.ringToss(12) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.moveSpeed = 120;
      this.banner('THE HARD SELL', 'Every game is rigged. Play anyway.');
      this.sfx('fanfare', 0.8);
    }
    if (phase === 2) {
      this.moveSpeed = 135;
      this.keepDist = 240;
      this.banner('LAST CALL', 'The park is closing. Nobody leaves.');
      this.sfx('horn', 1, 0.6);
    }
    return null;
  }

  /** A wind-up the renderer can see (the megaphone coming up). */
  private *windupFor(t: number, key: 'shout' | 'cane' | 'toss'): Co {
    const n = Math.max(1, Math.round(t * 60));
    for (let i = 0; i < n; i++) {
      this.windup = (i + 1) / n;
      this.pose[key] = this.windup;
      yield 1 / 60;
    }
    this.windup = 0;
  }

  /** The megaphone: a cone of noise that flattens whoever stands in it. */
  private *shout(n: number): Co {
    for (let i = 0; i < n; i++) {
      const a = this.angleToTarget();
      this.face = Math.cos(a) > 0 ? 1 : -1;
      this.anim = 'shout';
      const t = this.tele(0.75);
      this.hz('sector', 'shout', this.x, this.y, { r: BARKER.shoutR, angle: a, half: BARKER.shoutHalf, tele: t, active: 0.3, dmg: 18 });
      yield* this.windupFor(t, 'shout');
      this.pose.shout = 1;
      this.sfx('horn', 1, 0.7);
      for (let r = 1; r <= 4; r++) this.g.fx.push('ring', this.x + Math.cos(a) * r * 95, this.y + Math.sin(a) * r * 95, 30 + r * 22, 0, 0, 'shock');
      yield 0.45;
    }
  }

  /** "Three rings for a dime!": hoops come down all round you. */
  private *ringToss(n: number): Co {
    this.anim = 'toss';
    const p = this.target();
    for (let i = 0; i < n; i++) {
      const a = this.g.rng.angle(), d = i === 0 ? 0 : this.g.rng.range(40, 260);
      const c = this.inStage(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      this.hz('circle', 'ring_toss', c.x, c.y, { r: 62, tele: this.tele(0.95), active: 0.15, dmg: 14 });
      this.pose.toss = 1;
      if (i % 3 === 0) this.sfx('ringtoss', 0.6);
      yield 0.11;
    }
    yield this.tele(0.9);
  }

  /** The shooting gallery comes to you: lanes light up, and rows of tin ducks march along them. */
  private *ducks(rows: number): Co {
    const g = this.g;
    this.anim = 'call';
    this.pose.tip = 1;
    this.sfx('whistle', 0.8);
    const p = this.target();
    const lanes: { y: number; dir: number }[] = [];
    for (let r = 0; r < rows; r++) {
      const dir = r % 2 === 0 ? (g.rng.chance(0.5) ? 1 : -1) : -lanes[r - 1].dir;
      const y = p.y + (r - (rows - 1) / 2) * 150 + g.rng.range(-25, 25);
      lanes.push({ y, dir });
      this.hz('line', 'duck_lane', p.x - dir * 560, y, { x2: p.x + dir * 560, y2: y, r2: 28, tele: this.tele(1.1), active: 0.01, dmg: 0 });
    }
    yield this.tele(1.1);
    this.sfx('slot_blip', 0.8);
    for (const L of lanes) {
      for (let k = 0; k < BARKER.ducks; k++) {
        const e = g.spawnEnemy('tin_duck', p.x - L.dir * (560 + k * BARKER.duckGap), L.y, { exact: true });
        if (!e) break;
        e.dirX = L.dir;
        e.dirY = 0;
        e.leashExempt = true;
      }
    }
    yield 1.6;
  }

  /** The prize wheel: spokes of light turning round him while he stands and spins it. */
  private *wheel(spokes: number, spin: number, secs: number): Co {
    this.anim = 'wheel';
    this.pose.wheel = 1;
    const a0 = this.g.rng.angle(), t = this.tele(1.1), L = BARKER.spokeLen;
    const dir = this.g.rng.chance(0.5) ? 1 : -1;
    const list = [];
    for (let i = 0; i < spokes; i++) {
      const a = a0 + (i / spokes) * TAU;
      list.push(this.hz('line', 'spoke', this.x, this.y, { x2: this.x + Math.cos(a) * L, y2: this.y + Math.sin(a) * L, r2: 16, len: L, angle: a, tele: t, active: secs, dmg: 16, tick: 0.5 }));
    }
    this.sfx('wheel_crank', 0.9);
    yield t;
    for (const h of list) h.spinRate = spin * dir;
    for (let s = 0; s < secs; s += 0.5) {
      this.sfx('wheel_tick', 0.5);
      yield 0.5;
    }
    this.pose.wheel = 0;
    this.sfx('slot_win', 0.6);
  }

  /** "Hurry, hurry!": he calls performers up out of the crowd. */
  private *performers(): Co {
    const g = this.g;
    this.anim = 'call';
    this.pose.tip = 1;
    this.sfx('whistle', 1);
    yield 0.5;
    const p = this.target();
    const crew = ['evil_clown', 'evil_clown', 'ticket_taker', 'living_balloon', 'living_balloon', 'living_balloon'];
    const n = Math.round(crew.length * this.addsMult());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + g.rng.next(), r = g.rng.range(240, 330);
      const c = this.inStage(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      g.spawnEnemy(crew[i % crew.length], c.x, c.y, { exact: true });
      g.fx.push('dust', c.x, c.y, 0.8);
    }
    yield 1.2;
  }

  /** Feedback: the megaphone screams, rings of noise roll out — each with one quiet gap. */
  private *feedback(): Co {
    this.anim = 'shout';
    for (let i = 0; i < 3; i++) {
      yield* this.windupFor(this.tele(0.35), 'shout');
      this.pose.shout = 1;
      const gap = this.angleToTarget() + this.g.rng.range(-1.6, 1.6);
      this.hz('ring', 'feedback', this.x, this.y, { r: 60, r2: 34, grow: 330, tele: 0.01, active: 1.7, dmg: 16, gapHalf: 0.5, angle: gap });
      this.sfx('shriek', 0.8);
      yield 0.5;
    }
    yield 0.8;
  }

  /** The soapbox charge: a lane lights up, and he rolls down it like a runaway cart. */
  private *charge(n: number): Co {
    for (let i = 0; i < n; i++) {
      const p = this.target();
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      const L = Math.min(720, Math.hypot(p.x - this.x, p.y - this.y) + 260);
      const end = this.inStage(this.x + Math.cos(a) * L, this.y + Math.sin(a) * L);
      const t = this.tele(0.8);
      this.anim = 'charge';
      this.hz('line', 'charge', this.x, this.y, { x2: end.x, y2: end.y, r2: 62, tele: t, active: 0.01, dmg: 0 });
      yield* this.windupFor(t, 'cane');
      this.sfx('whoosh', 1);
      yield* this.moveTo(end.x, end.y, 840);
      this.g.fx.push('dust', this.x, this.y, 1.1);
      this.g.fx.push('shake', this.x, this.y, 0.3);
      yield 0.35;
    }
  }

  protected *defeatSequence(): Co {
    this.sfx('shriek', 1);
    for (let i = 0; i < 90; i++) {
      this.pose.fall = Math.min(1, i / 60);
      this.pose.hat = i / 90;
      this.pose.shout = i < 40 ? 1 : 0;
      yield 1 / 60;
    }
    this.sfx('slide', 0.9);
    this.g.fx.push('confetti', this.x, this.y, 2);
    yield 1;
  }
}
