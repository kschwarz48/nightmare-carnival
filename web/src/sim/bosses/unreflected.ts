// THE FUN HOUSE, SECRET BOSS — THE UNREFLECTED (D-63). Reached only through the Unreflected quest:
// defeating the Proprietor while carrying Mira's Reflection shatters the house, and on the other side
// of the glass the thing Grinwell traded his own reflection to is waiting, wearing every stolen face.
// P1 The Other Side: everything happens twice, mirrored across the target (a ghost emitter on the far
//    side copies each attack), and it steps through to its own reflection.
// P2 Every Face: thrown masks home in; mirror walls slide together from both sides (one gap each);
//    kaleidoscope beams.
// P3 No Reflection: it fades to a shimmer (always outlined, never invisible) and the glass bursts in
//    gapped rings.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { FunhouseBoss } from './fhBoss';

/** Tuning the tests read. */
export const UNREFLECTED = { wallGap: 140, wallSpeed: 150, masks: 8, fade: 0.65 };

export class UnreflectedBoss extends FunhouseBoss {
  /** 0..1 how faded it is (P3; drawing keeps an outline at any value) */
  fade = 0;
  /** where its reflection stands this moment (the far side of the target; drawing and the mirrored attacks) */
  mx = 0;
  my = 0;

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.arriveNear(420);
    this.moveSpeed = 120;
    this.keepDist = 330;
    this.pose = { rise: 1, faces: 0, reach: 0, spin: 0 };
    this.updateMirror();
  }

  private updateMirror(): void {
    const p = this.target();
    const c = this.inside(2 * p.x - this.x, 2 * p.y - this.y, 80);
    this.mx = c.x;
    this.my = c.y;
  }

  protected tickBoss(dt: number): void {
    this.updateMirror();
    this.pose.faces += dt * (1 + this.phase);
    this.pose.reach = Math.max(0, this.pose.reach - dt * 2);
    if (this.phase === 2) this.fade = Math.min(UNREFLECTED.fade, this.fade + dt * 0.5);
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('shatter', 1);
    this.g.fx.push('flash', this.x, this.y, 0.6);
    for (let i = 0; i < 150; i++) {
      this.pose.rise = 1 - i / 150;
      if (i % 30 === 0) this.g.fx.push('spark', this.x, this.y - 80, 1.2, 0, 0, 'frost');
      yield 1 / 60;
    }
    this.pose.rise = 0;
    this.sfx('demon', 0.8);
    yield 0.5;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'shards', w: 1.2, fn: () => this.mirrorShards(3) },
      { name: 'step', w: 0.9, fn: () => this.stepThrough() },
      { name: 'palms', w: 1, fn: () => this.palms(3) },
    ];
    if (phase === 1) return [
      { name: 'masks', w: 1.1, fn: () => this.masks() },
      { name: 'walls', w: 1, fn: () => this.closingMirrors() },
      { name: 'kaleido', w: 0.9, fn: () => this.kaleido(2) },
      { name: 'shards', w: 0.7, fn: () => this.mirrorShards(2) },
    ];
    return [
      { name: 'nova', w: 1.2, fn: () => this.nova() },
      { name: 'walls', w: 0.9, fn: () => this.closingMirrors() },
      { name: 'step', w: 0.8, fn: () => this.stepThrough() },
      { name: 'kaleido', w: 0.8, fn: () => this.kaleido(3) },
      { name: 'palms', w: 0.7, fn: () => this.palms(5) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) this.banner('EVERY FACE', 'All the faces the mirrors kept');
    if (phase === 2) {
      this.banner('NO REFLECTION', 'Look for the shimmer');
      this.moveSpeed = 150;
    }
    return null;
  }

  /** Shard fans from it and from its reflection on the far side of the target. */
  private *mirrorShards(volleys: number): Co {
    this.anim = 'shards';
    for (let v = 0; v < volleys; v++) {
      this.windup = 1;
      this.pose.reach = 1;
      yield this.tele(0.5);
      this.windup = 0;
      for (const [x, y] of [[this.x, this.y - 50], [this.mx, this.my - 50]]) {
        const base = this.angleToTarget(x, y);
        for (let i = 0; i < 7; i++) this.bullet('shard', x, y, base + (i / 6 - 0.5) * 0.8, 290, 13, { r: 8, life: 3.5, spin: 6 });
      }
      this.sfx('glint', 0.7);
      yield 0.5;
    }
  }

  /** It steps into its own reflection: a telegraphed arrival on the far side of the target. */
  private *stepThrough(): Co {
    const g = this.g;
    this.anim = 'step';
    const tx = this.mx, ty = this.my;
    const t = this.tele(0.8);
    this.hz('circle', 'stomp', tx, ty, { r: 100, tele: t, active: 0.15, dmg: 24 });
    this.sfx('mirror', 1);
    yield t;
    g.fx.push('spark', this.x, this.y - 60, 1.2, 0, 0, 'frost');
    this.x = this.px = tx;
    this.y = this.py = ty;
    g.fx.push('spark', tx, ty - 60, 1.4, 0, 0, 'frost');
    this.hz('ring', 'shockwave', tx, ty, { r: 100, r2: 86, grow: 200, active: 1.3, dmg: 12, gapHalf: 0.5, angle: g.rng.angle(), tele: 0.05 });
    yield 0.4;
  }

  /** Palms slam down under the target and under its mirror image across the boss. */
  private *palms(n: number): Co {
    this.anim = 'palms';
    for (let k = 0; k < n; k++) {
      const p = this.target();
      const t = this.tele(0.8);
      const q = this.inside(2 * this.x - p.x, 2 * this.y - p.y);
      for (const c of [{ x: p.x, y: p.y }, q]) this.hz('circle', 'stomp', c.x, c.y, { r: 80, tele: t, active: 0.12, dmg: 22 });
      this.pose.reach = 1;
      yield 0.45;
    }
    yield this.tele(0.8);
  }

  /** Masks thrown in a fan, which then home in (slowly enough to outrun sideways). */
  private *masks(): Co {
    this.anim = 'masks';
    this.windup = 1;
    this.pose.reach = 1;
    yield this.tele(0.6);
    this.windup = 0;
    const base = this.angleToTarget();
    for (let i = 0; i < UNREFLECTED.masks; i++) {
      const a = base + (i / (UNREFLECTED.masks - 1) - 0.5) * 2.4;
      this.bullet('shard', this.x, this.y - 50, a, 170, 14, { r: 11, life: 4.5, homing: 1.4, spin: 3 });
    }
    this.sfx('laugh', 0.7, 1.3);
    yield 1.0;
  }

  /** Two mirror walls slide together from either side of the target; each has a gap to slip through. */
  private *closingMirrors(): Co {
    const g = this.g;
    this.anim = 'walls';
    const p = this.target();
    const a = g.rng.angle();
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const D = 420, L = 700, G = UNREFLECTED.wallGap;
    const t = this.tele(1.1);
    const dur = (D - 40) / UNREFLECTED.wallSpeed;
    for (const s of [-1, 1]) {
      const cx = p.x + ux * D * s, cy = p.y + uy * D * s;
      const gap = g.rng.range(-L / 2 + G, L / 2 - G);
      const vx = -ux * s * UNREFLECTED.wallSpeed, vy = -uy * s * UNREFLECTED.wallSpeed;
      // two segments: from one end to the gap, and from the gap to the other end
      for (const [u0, u1] of [[-L / 2, gap - G / 2], [gap + G / 2, L / 2]]) {
        this.hz('line', 'mirror_wall', cx + nx * u0, cy + ny * u0, { x2: cx + nx * u1, y2: cy + ny * u1, r2: 14, tele: t, active: dur, dmg: 20, tick: 0.5, vx, vy });
      }
    }
    this.sfx('mirror', 1);
    yield t + dur;
  }

  /** Turning beams from it and its reflection. */
  private *kaleido(n: number): Co {
    this.anim = 'kaleido';
    const off = this.g.rng.angle();
    const t = this.tele(1.1);
    for (let i = 0; i < n; i++) {
      for (const [x, y] of [[this.x, this.y], [this.mx, this.my]]) {
        this.hz('line', 'kaleido_beam', x, y, { len: 800, r2: 16, angle: off + (i * TAU) / n, spinRate: 0.55, tele: t, active: 2.2, dmg: 15, tick: 0.5 });
      }
    }
    this.sfx('laser', 0.8);
    yield t + 2.3;
  }

  /** Gapped rings of glass bursting from it, three times, the gap turning each time. */
  private *nova(): Co {
    const g = this.g;
    this.anim = 'nova';
    const a0 = this.angleToTarget();
    for (let k = 0; k < 3; k++) {
      this.windup = 1;
      yield this.tele(0.5);
      this.windup = 0;
      const n = 22, gapA = a0 + Math.PI + (k - 1) * 1.1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const d = Math.abs(((a - gapA + Math.PI * 3) % TAU) - Math.PI);
        if (d < 0.42) continue;
        this.bullet('shard', this.x, this.y - 40, a, 230, 13, { r: 8, life: 4.5, spin: 6 });
      }
      this.sfx('shatter', 0.6);
      g.fx.push('spark', this.x, this.y - 60, 0.8, 0, 0, 'frost');
      yield 0.45;
    }
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    this.fade = 0;
    for (let i = 0; i < 180; i++) {
      this.pose.rise = Math.min(1, i / 150);
      if (i % 15 === 0) {
        g.fx.push('spark', this.x + g.rng.range(-90, 90), this.y - 80 + g.rng.range(-60, 60), 1.3, 0, 0, 'frost');
        this.sfx('glint', 0.5, 0.7 + (i / 180) * 0.6);
      }
      yield 1 / 60;
    }
    this.sfx('shatter', 1);
    g.fx.push('boss_death', this.x, this.y, 1, 0, 0, 'unreflected');
    yield 0.4;
  }
}
