// THE FUN HOUSE, BOSS 2 — THE LOOKING GLASS (D-63). Grinwell's first mirror, walking on gilded claws.
// P1 Reflection: shard fans, a telegraphed dash that leaves broken glass, a blinding glint.
// P2 Refraction: two reflections step out of it and stand round whoever is nearest, a third of the way
//    round each side. Only the gilt one is real (the reflections are silvered and shiver); striking a
//    reflection shatters it into shards. All three fire crossing beams; the real one swaps places.
// P3 Shatter: the reflections break, then the glass itself: a ring of orbiting shards it flings, and
//    turning kaleidoscope beams.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { BossPart, EnemyBullet } from '../entities';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { FunhouseBoss } from './fhBoss';

/** Tuning the tests read. */
export const GLASS = { hover: 380, decoyHp: 0.035, beamHalf: 22, dash: 1400, orbitR: 130 };

export class LookingGlassBoss extends FunhouseBoss {
  decoys: BossPart[] = [];
  /** the real glass's angle round its target (P2: the reflections stand at ±120 degrees) */
  slot = 0;
  /** the glass itself has broken (P3) */
  broken = false;
  /** orbiting shard ring: radius and angle (drawing reads them too) */
  orbitR = 0;
  orbitA = 0;
  private orbit: EnemyBullet[] = [];

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.arriveNear(480);
    this.moveSpeed = 105;
    this.keepDist = GLASS.hover;
    this.pose = { emerge: 1, glint: 0, crack: 0, ripple: 0, swap: 0 };
  }

  protected updateParts(): void {
    super.updateParts();
    if (!this.decoys.length) return;
    const p = this.target();
    const r = Math.max(200, Math.hypot(this.x - p.x, this.y - p.y));
    const a0 = Math.atan2(this.y - p.y, this.x - p.x);
    this.decoys.forEach((d, i) => {
      const a = a0 + (i === 0 ? 1 : -1) * (TAU / 3);
      const c = this.inside(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 80);
      d.x = c.x;
      d.y = c.y;
    });
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.glint = Math.max(0, P.glint - dt * 2);
    P.swap = Math.max(0, P.swap - dt * 3);
    P.ripple += dt;
    // the orbiting shards ride their ring
    if (this.orbit.length) {
      this.orbitA += dt * 2.4;
      this.orbit = this.orbit.filter((b) => b.alive);
      this.orbit.forEach((b, i) => {
        const a = this.orbitA + (i / Math.max(1, this.orbit.length)) * TAU;
        b.px = b.x;
        b.py = b.y;
        b.x = this.x + Math.cos(a) * this.orbitR;
        b.y = this.y + Math.sin(a) * this.orbitR - 30;
        b.vx = -Math.sin(a) * 2.4 * this.orbitR;
        b.vy = Math.cos(a) * 2.4 * this.orbitR;
      });
    }
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('mirror', 1);
    for (let i = 0; i < 100; i++) {
      this.pose.emerge = 1 - i / 100;
      if (i % 25 === 0) this.g.fx.push('spark', this.x, this.y - 60, 1, 0, 0, 'frost');
      yield 1 / 60;
    }
    this.pose.emerge = 0;
    this.sfx('glint', 1);
    yield 0.5;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'fan', w: 1.2, fn: () => this.shardFan(3, 9) },
      { name: 'dash', w: 1, fn: () => this.mirrorDash(1) },
      { name: 'glint', w: 0.9, fn: () => this.glint() },
    ];
    if (phase === 1) return [
      { name: 'prism', w: 1.2, fn: () => this.prism() },
      { name: 'swap', w: 0.8, fn: () => this.swap() },
      { name: 'fan', w: 1, fn: () => this.shardFan(2, 7) },
    ];
    return [
      { name: 'orbit', w: 1.2, fn: () => this.shardOrbit() },
      { name: 'kaleido', w: 1, fn: () => this.kaleido() },
      { name: 'dash', w: 0.9, fn: () => this.mirrorDash(3) },
      { name: 'glint', w: 0.6, fn: () => this.glint() },
    ];
  }

  protected onPhase(phase: number): Co | null {
    const g = this.g;
    if (phase === 1) {
      // two reflections climb out of it
      for (let i = 0; i < 2; i++) {
        const d = this.addPart('decoy', this.def.radius * 0.8);
        d.maxHp = d.hp = this.maxHp * GLASS.decoyHp;
        d.invuln = false;
        this.decoys.push(d);
      }
      this.updateParts();
      for (const d of this.decoys) g.fx.push('spark', d.x, d.y - 60, 1.4, 0, 0, 'frost');
      this.sfx('mirror', 1);
      this.banner('REFRACTION', 'Only one of them is gilded');
    }
    if (phase === 2) {
      for (const d of this.decoys.slice()) this.shatterDecoy(d, false);
      this.broken = true;
      this.pose.crack = 1;
      this.moveSpeed = 150;
      this.keepDist = 300;
      g.fx.push('spark', this.x, this.y - 60, 2, 0, 0, 'frost');
      this.sfx('shatter', 1);
      this.banner('SHATTER', 'Nothing left to hide behind');
    }
    return null;
  }

  protected onSubPartDestroyed(part: BossPart): void {
    if (part.kind === 'decoy') this.shatterDecoy(part, true);
    else super.onSubPartDestroyed(part);
  }

  /** A reflection breaks: a spray of shards (when struck) and it's gone. */
  private shatterDecoy(d: BossPart, spray: boolean): void {
    const g = this.g;
    g.fx.push('spark', d.x, d.y - 50, 1.6, 0, 0, 'frost');
    this.sfx('shatter', 0.8);
    if (spray) for (let i = 0; i < 8; i++) this.bullet('shard', d.x, d.y - 40, (i / 8) * TAU + 0.2, 200, 10, { r: 8, life: 2.5, spin: 6 });
    this.decoys = this.decoys.filter((q) => q !== d);
    this.removePart(d);
  }

  /** Where the glass and its reflections stand (the shooters for crossfire attacks). */
  private emitters(): { x: number; y: number; real: boolean }[] {
    return [{ x: this.x, y: this.y - 40, real: true }, ...this.decoys.map((d) => ({ x: d.x, y: d.y - 40, real: false }))];
  }

  private *shardFan(volleys: number, n: number): Co {
    this.anim = 'fan';
    for (let v = 0; v < volleys; v++) {
      this.windup = 1;
      this.pose.glint = 1;
      this.sfx('glint', 0.6);
      yield this.tele(0.5);
      this.windup = 0;
      for (const e of this.emitters()) {
        const base = this.angleToTarget(e.x, e.y);
        for (let i = 0; i < n; i++) {
          const a = base + (i / (n - 1) - 0.5) * 0.9 + (v % 2 ? 0.05 : -0.05);
          this.bullet('shard', e.x, e.y, a, 300, e.real ? 14 : 7, { r: 8, life: 3.5, spin: 5 });
        }
      }
      yield 0.45;
    }
  }

  /** A telegraphed dash through whoever is nearest; broken glass glitters behind it for a while. */
  private *mirrorDash(n: number): Co {
    const g = this.g;
    this.anim = 'dash';
    for (let k = 0; k < n; k++) {
      const a = this.angleToTarget();
      const len = this.laneLength(this.x, this.y, a, 1000);
      const x0 = this.x, y0 = this.y, ex = x0 + Math.cos(a) * len, ey = y0 + Math.sin(a) * len;
      const t = this.tele(k === 0 ? 0.85 : 0.6);
      this.hz('line', 'lane', x0, y0, { x2: ex, y2: ey, r2: 70, tele: t, active: 0.01, dmg: 0 });
      this.windup = 1;
      this.sfx('glint', 0.8);
      yield t;
      this.windup = 0;
      const h = this.hz('circle', 'roll', x0, y0, { r: 75, tele: 0.01, active: len / GLASS.dash + 0.1, dmg: 24 });
      this.sfx('whoosh', 1);
      const steps = Math.max(1, Math.round((len / GLASS.dash) * 60));
      let dropAt = 0;
      for (let i = 1; i <= steps; i++) {
        const d = (i / steps) * len;
        this.x = x0 + Math.cos(a) * d;
        this.y = y0 + Math.sin(a) * d;
        h.x = this.x;
        h.y = this.y;
        if (d >= dropAt) {
          dropAt += 110;
          this.hz('circle', 'glass', this.x + g.rng.range(-20, 20), this.y + g.rng.range(-20, 20), { r: 30, tele: 0.25, active: 3.5, dmg: 6, tick: 0.5 });
        }
        yield 1 / 60;
      }
      h.alive = false;
      yield 0.35;
    }
  }

  /** The glass catches the light: a telegraphed cone, then shards along it. */
  private *glint(): Co {
    this.anim = 'glint';
    const a = this.angleToTarget();
    const t = this.tele(1.0);
    this.pose.glint = 1;
    this.hz('sector', 'glint', this.x, this.y, { r: 620, r2: 60, angle: a, half: 0.32, tele: t, active: 0.25, dmg: 22 });
    this.sfx('glint', 1);
    yield t;
    for (let i = 0; i < 10; i++) this.bullet('shard', this.x, this.y - 40, a + (i / 9 - 0.5) * 0.6, 340, 10, { r: 8, life: 2.5, spin: 6 });
    this.sfx('shatter', 0.5);
    yield 0.6;
  }

  /** Every glass in the room fires a beam through where the target stands: step off the crossing. */
  private *prism(): Co {
    this.anim = 'prism';
    const p = this.target();
    const px = p.x, py = p.y;
    const t = this.tele(1.1);
    for (const e of this.emitters()) {
      const a = Math.atan2(py - e.y, px - e.x);
      this.hz('line', 'beam', e.x, e.y, { x2: e.x + Math.cos(a) * 1500, y2: e.y + Math.sin(a) * 1500, r2: GLASS.beamHalf, tele: t, active: 0.5, dmg: e.real ? 22 : 14 });
    }
    this.windup = 1;
    this.sfx('laser', 0.8);
    yield t + 0.5;
    this.windup = 0;
  }

  /** Flash: the real glass and a reflection trade places. */
  private *swap(): Co {
    const g = this.g;
    if (!this.decoys.length) return;
    this.anim = 'swap';
    this.windup = 1;
    yield this.tele(0.4);
    this.windup = 0;
    const d = this.decoys[g.rng.int(0, this.decoys.length - 1)];
    const ox = this.x, oy = this.y;
    this.x = this.px = d.x;
    this.y = this.py = d.y;
    g.fx.push('spark', ox, oy - 50, 1, 0, 0, 'frost');
    g.fx.push('spark', this.x, this.y - 50, 1, 0, 0, 'frost');
    this.pose.swap = 1;
    this.sfx('poof', 0.8);
    this.updateParts();
    yield 0.3;
    yield* this.shardFan(1, 7);
  }

  /** Twelve shards circle the broken frame, widen, then fly outward. */
  private *shardOrbit(): Co {
    this.anim = 'orbit';
    this.orbitR = 60;
    this.orbit = [];
    for (let i = 0; i < 12; i++) {
      const b = this.bullet('shard', this.x, this.y, 0, 0, 13, { r: 10, life: 9, spin: 8 });
      if (b) this.orbit.push(b);
    }
    this.sfx('glint', 0.9);
    for (let i = 0; i < 100; i++) {
      this.orbitR = 60 + (GLASS.orbitR - 60) * Math.min(1, i / 40);
      yield 1 / 60;
    }
    this.windup = 1;
    yield this.tele(0.5);
    this.windup = 0;
    for (const b of this.orbit) {
      const a = Math.atan2(b.y - this.y + 30, b.x - this.x);
      b.vx = Math.cos(a) * 280;
      b.vy = Math.sin(a) * 280;
      b.life = 4;
    }
    this.orbit = [];
    this.sfx('whoosh', 1);
    yield 0.6;
  }

  /** Six turning beams from the frame, telegraphed, twice in alternating directions. */
  private *kaleido(): Co {
    this.anim = 'kaleido';
    for (let k = 0; k < 2; k++) {
      const off = this.g.rng.angle();
      const t = this.tele(1.1);
      for (let i = 0; i < 6; i++) {
        this.hz('line', 'kaleido_beam', this.x, this.y, { len: 900, r2: 16, angle: off + (i * TAU) / 6, spinRate: k % 2 ? 0.5 : -0.5, tele: t, active: 2.0, dmg: 16, tick: 0.5 });
      }
      this.sfx('laser', 0.7);
      yield t + 2.2;
    }
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    for (let i = 0; i < 110; i++) {
      this.pose.crack = 1 + i / 110;
      if (i % 14 === 0) {
        g.fx.push('spark', this.x + g.rng.range(-70, 70), this.y - 60 + g.rng.range(-50, 50), 1.2, 0, 0, 'frost');
        this.sfx('glint', 0.5, 0.8 + g.rng.next() * 0.5);
      }
      yield 1 / 60;
    }
    this.sfx('shatter', 1);
    g.fx.push('boss_death', this.x, this.y, 1, 0, 0, 'glass');
    yield 0.3;
  }
}
