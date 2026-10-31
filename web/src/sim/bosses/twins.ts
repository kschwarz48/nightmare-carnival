// THE FUN HOUSE, BOSS 1 — THE CROOKED TWINS (D-63). Stilts (tall; the boss's own position) and Barrel
// (round; a second hittable body on the same health bar), roped together at the waist.
// P1 The Act: Barrel bowls down telegraphed lanes, Stilts stomps in threes, pins are juggled.
// P2 The Quarrel: they pull the rope taut and clothesline across the room; Barrel ricochets.
// P3 Alone: the rope snaps and Barrel lies still; Stilts, grieving, leaps and wails.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { BossPart } from '../entities';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { FunhouseBoss } from './fhBoss';

/** Tuning the tests read: rope length, stomp footprint, roll and clothesline speeds, the rope's half span. */
export const TWINS = { rope: 230, stompR: 72, roll: 620, clothes: 300, ropeHalf: 330 };

export class TwinsBoss extends FunhouseBoss {
  /** Barrel's position, and last tick's (for drawing between ticks). */
  bx = 0;
  by = 0;
  pbx = 0;
  pby = 0;
  barrel: BossPart;
  /** an attack is steering Barrel (otherwise it trails Stilts on the rope) */
  steer = false;
  alone = false;
  /** Barrel's roll angle (drawing) */
  roll = 0;

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.arriveNear(470);
    this.bx = this.pbx = this.x + 150;
    this.by = this.pby = this.y + 30;
    this.barrel = this.addPart('body', 54);
    this.moveSpeed = 125;
    this.keepDist = 320;
    this.pose = { stride: 0, stomp: 0, toss: 0, taut: 0, squash: 0, topple: 0, wail: 0, emerge: 1, air: 0 };
  }

  protected updateParts(): void {
    super.updateParts();
    this.barrel.x = this.bx;
    this.barrel.y = this.by - 10;
  }

  protected tickBoss(dt: number): void {
    this.pbx = this.bx;
    this.pby = this.by;
    const P = this.pose;
    P.stride += Math.hypot(this.vx, this.vy) * dt * 0.02;
    P.stomp = Math.max(0, P.stomp - dt * 3);
    P.toss = Math.max(0, P.toss - dt * 2);
    P.squash = Math.max(0, P.squash - dt * 3);
    if (this.alone || this.steer) return;
    // Barrel trails Stilts on the slack rope, waddling round to the side away from the target
    const p = this.target();
    const a = Math.atan2(this.y - p.y, this.x - p.x) + 0.9;
    const tx = this.x + Math.cos(a) * TWINS.rope * 0.75, ty = this.y + Math.sin(a) * TWINS.rope * 0.75;
    const k = Math.min(1, dt * 2.2);
    const c = this.inside(this.bx + (tx - this.bx) * k, this.by + (ty - this.by) * k, 60);
    this.roll += Math.hypot(c.x - this.bx, c.y - this.by) / 50;
    this.bx = c.x;
    this.by = c.y;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('mirror', 1);
    for (let i = 0; i < 90; i++) {
      this.pose.emerge = 1 - i / 90;
      yield 1 / 60;
    }
    this.pose.emerge = 0;
    this.sfx('laugh', 0.9);
    this.g.fx.push('ring', this.x, this.y, 220, 0, 0, 'shock');
    yield 0.5;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'roll', w: 1.2, fn: () => this.barrelRoll(1) },
      { name: 'stomp', w: 1, fn: () => this.stiltStomp(3, 0.95) },
      { name: 'juggle', w: 0.9, fn: () => this.juggle(7, 1) },
    ];
    if (phase === 1) return [
      { name: 'clothesline', w: 1.2, fn: () => this.clothesline() },
      { name: 'ricochet', w: 1, fn: () => this.barrelRoll(3) },
      { name: 'juggle', w: 0.8, fn: () => this.juggle(9, 2) },
      { name: 'stomp', w: 0.7, fn: () => this.stiltStomp(4, 0.85) },
    ];
    return [
      { name: 'leap', w: 1.2, fn: () => this.griefLeap() },
      { name: 'wail', w: 1, fn: () => this.wail() },
      { name: 'pinstorm', w: 0.9, fn: () => this.pinStorm() },
      { name: 'stomp', w: 0.7, fn: () => this.stiltStomp(5, 0.75) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    this.steer = false;
    this.pose.taut = 0;
    if (phase === 1) {
      this.moveSpeed = 140;
      this.banner('THE QUARREL', 'They want room to swing that rope');
    }
    if (phase === 2) {
      const g = this.g;
      this.alone = true;
      this.removePart(this.barrel);
      g.fx.push('shake', this.bx, this.by, 0.6);
      g.fx.push('spark', (this.x + this.bx) / 2, (this.y + this.by) / 2, 1.5);
      this.sfx('snap', 1);
      this.banner('ALONE', 'The rope snaps. Barrel lies still.');
      this.moveSpeed = 175;
      this.keepDist = 240;
    }
    return null;
  }

  /** Barrel curls up and bowls down a lane at whoever is nearest; in the Quarrel it ricochets. */
  private *barrelRoll(bounces: number): Co {
    const g = this.g;
    this.steer = true;
    this.anim = 'roll';
    let x = this.bx, y = this.by;
    let p = this.target(x, y);
    let a = Math.atan2(p.y - y, p.x - x);
    for (let k = 0; k < bounces; k++) {
      // the lane runs to the house's walls (or 900 units), whichever comes first
      const len = this.laneLength(x, y, a, 900);
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      const t = this.tele(k === 0 ? 0.95 : 0.6);
      this.hz('line', 'lane', x, y, { x2: ex, y2: ey, r2: 56, tele: t, active: 0.01, dmg: 0 });
      this.pose.squash = 1;
      this.sfx('creak', 0.7);
      yield t;
      const h = this.hz('circle', 'roll', x, y, { r: 58, tele: 0.01, active: len / TWINS.roll + 0.1, dmg: 22 });
      this.sfx('rumble', 0.9);
      const n = Math.max(1, Math.round((len / TWINS.roll) * 60));
      for (let i = 1; i <= n; i++) {
        this.bx = x + (ex - x) * (i / n);
        this.by = y + (ey - y) * (i / n);
        this.roll += TWINS.roll / 60 / 50;
        h.x = this.bx;
        h.y = this.by;
        yield 1 / 60;
      }
      h.alive = false;
      g.fx.push('shake', this.bx, this.by, 0.4);
      g.fx.push('dust', this.bx, this.by, 1);
      this.sfx('thud', 0.8);
      x = this.bx;
      y = this.by;
      p = this.target(x, y);
      a = Math.atan2(p.y - y, p.x - x) + g.rng.range(-0.25, 0.25);
    }
    yield 0.4;
    this.steer = false;
  }

  /** Stilts strides after whoever is nearest, each step a telegraphed footprint. */
  private *stiltStomp(n: number, tele: number): Co {
    const g = this.g;
    this.anim = 'stomp';
    for (let i = 0; i < n; i++) {
      const p = this.target();
      const lead = i === 0 ? 0 : 0.3;
      const x = p.x + p.vx * lead, y = p.y + p.vy * lead;
      const t = this.tele(tele);
      this.hz('circle', 'stomp', x, y, {
        r: TWINS.stompR, tele: t, active: 0.12, dmg: 22,
        onActivate: () => {
          this.pose.stomp = 1;
          g.fx.push('shake', x, y, 0.35);
          g.fx.push('dust', x, y, 1.2);
          this.sfx('stomp', 0.8);
        },
      });
      const c = this.inside(this.x + (x - this.x) * 0.35, this.y + (y - this.y) * 0.35);
      yield* this.moveTo(c.x, c.y, 520);
      yield 0.32;
    }
    yield this.tele(tele) * 0.6;
  }

  /** Barrel juggles bent pins and lets them fly in a curling fan. */
  private *juggle(n: number, waves: number): Co {
    this.anim = 'juggle';
    for (let w = 0; w < waves; w++) {
      this.windup = 1;
      this.pose.toss = 1;
      this.sfx('whoosh', 0.6);
      yield this.tele(0.55);
      this.windup = 0;
      const sx = this.alone ? this.x : this.bx, sy = this.alone ? this.y : this.by;
      const base = this.angleToTarget(sx, sy);
      for (let i = 0; i < n; i++) {
        const a = base + (i / (n - 1) - 0.5) * 1.1;
        this.bullet('pin', sx, sy - 20, a, 250, 13, { r: 9, life: 4, spin: 9, turn: (i % 2 ? 1 : -1) * 0.35 });
      }
      yield 0.5;
    }
  }

  /** They split to either end of the rope, pull it taut and charge across the room together. */
  private *clothesline(): Co {
    this.steer = true;
    this.anim = 'quarrel';
    const p = this.target();
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    const nx = -Math.sin(a), ny = Math.cos(a);
    const back = 320;
    const cx = p.x - Math.cos(a) * back, cy = p.y - Math.sin(a) * back;
    const s = this.inside(cx + nx * TWINS.ropeHalf, cy + ny * TWINS.ropeHalf);
    const b = this.inside(cx - nx * TWINS.ropeHalf, cy - ny * TWINS.ropeHalf);
    const sx0 = this.x, sy0 = this.y, bx0 = this.bx, by0 = this.by;
    for (let i = 1; i <= 40; i++) {
      const t = i / 40;
      this.x = sx0 + (s.x - sx0) * t;
      this.y = sy0 + (s.y - sy0) * t;
      this.bx = bx0 + (b.x - bx0) * t;
      this.by = by0 + (b.y - by0) * t;
      this.pose.taut = t;
      yield 1 / 60;
    }
    const ex = Math.cos(a), ey = Math.sin(a);
    const run = back * 2 + 200;
    // the band the rope will sweep, telegraphed as a lane as wide as the rope is long
    const tele = this.tele(1.0);
    const mx = (s.x + b.x) / 2, my = (s.y + b.y) / 2;
    this.hz('line', 'lane', mx, my, { x2: mx + ex * run, y2: my + ey * run, r2: Math.hypot(s.x - b.x, s.y - b.y) / 2, tele, active: 0.01, dmg: 0 });
    this.sfx('creak', 1);
    this.windup = 1;
    yield tele;
    this.windup = 0;
    const speed = TWINS.clothes;
    const dur = run / speed;
    const rope = this.hz('line', 'string_sweep', s.x, s.y, { x2: b.x, y2: b.y, r2: 10, tele: 0.01, active: dur, dmg: 24, vx: ex * speed, vy: ey * speed });
    this.sfx('whoosh', 1);
    for (let i = Math.round(dur * 60); i > 0; i--) {
      this.x += (ex * speed) / 60;
      this.y += (ey * speed) / 60;
      this.bx += (ex * speed) / 60;
      this.by += (ey * speed) / 60;
      this.roll += speed / 60 / 50;
      yield 1 / 60;
    }
    rope.alive = false;
    const c1 = this.inside(this.x, this.y), c2 = this.inside(this.bx, this.by);
    this.x = c1.x;
    this.y = c1.y;
    this.bx = c2.x;
    this.by = c2.y;
    this.pose.taut = 0;
    yield 0.5;
    this.steer = false;
  }

  /** Alone, Stilts throws itself at whoever is nearest: a telegraphed landing and a gapped shockwave. */
  private *griefLeap(): Co {
    const g = this.g;
    this.anim = 'leap';
    for (let k = 0; k < 2; k++) {
      const p = this.target();
      const c = this.inside(p.x + p.vx * 0.4, p.y + p.vy * 0.4);
      const t = this.tele(1.05);
      this.hz('circle', 'stomp', c.x, c.y, {
        r: 120, tele: t, active: 0.15, dmg: 30,
        onActivate: () => {
          g.fx.push('shake', c.x, c.y, 0.7);
          g.fx.push('dust', c.x, c.y, 2);
          this.sfx('stomp', 1);
          this.hz('ring', 'shockwave', c.x, c.y, { r: 120, r2: 106, grow: 170, active: 1.6, dmg: 12, gapHalf: 0.5, angle: g.rng.angle(), tele: 0.05 });
        },
      });
      const x0 = this.x, y0 = this.y;
      const n = Math.max(1, Math.round(t * 60));
      for (let i = 1; i <= n; i++) {
        const u = i / n;
        this.x = x0 + (c.x - x0) * u;
        this.y = y0 + (c.y - y0) * u;
        this.pose.air = Math.sin(u * Math.PI);
        yield 1 / 60;
      }
      this.pose.air = 0;
      yield 0.5;
    }
  }

  /** A grieving howl: a telegraphed cone, twice. */
  private *wail(): Co {
    this.anim = 'wail';
    for (let k = 0; k < 2; k++) {
      this.pose.wail = 1;
      const t = this.tele(0.85);
      this.hz('sector', 'wail', this.x, this.y, { r: 560, r2: 40, angle: this.angleToTarget(), half: 0.42, tele: t, active: 0.35, dmg: 24 });
      this.sfx('wail', 1);
      yield t + 0.45;
    }
    this.pose.wail = 0;
  }

  /** Rings of pins with a gap to slip through. */
  private *pinStorm(): Co {
    const g = this.g;
    this.anim = 'juggle';
    for (let w = 0; w < 3; w++) {
      this.windup = 1;
      yield this.tele(0.45);
      this.windup = 0;
      const n = 18, gap = g.rng.int(0, n - 1), off = g.rng.angle();
      for (let i = 0; i < n; i++) {
        const d = Math.abs(i - gap);
        if (d <= 1 || d >= n - 1) continue;
        this.bullet('pin', this.x, this.y - 30, off + (i / n) * TAU, 210, 12, { r: 9, life: 5, spin: 9, turn: 0.18 });
      }
      this.sfx('whoosh', 0.7);
      yield 0.55;
    }
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    for (let i = 0; i < 120; i++) {
      this.pose.topple = Math.min(1, i / 90);
      if (i % 20 === 0) {
        g.fx.push('dust', this.x + g.rng.range(-60, 60), this.y, 1);
        this.sfx('creak', 0.6, 0.7 + g.rng.next() * 0.3);
      }
      yield 1 / 60;
    }
    g.fx.push('boss_death', this.x, this.y, 1, 0, 0, 'twins');
    this.sfx('thud', 1);
    yield 0.3;
  }
}
