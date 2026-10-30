// BOSS 1 — THE CARNIVAL TENT (doc 05). Dormant scenery at map center from the first second;
// wakes at 6:00 and lumbers after the player. Full bible moveset across three phases.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Hazard } from '../entities';
import type { Game } from '../game';
import type { Co } from '../script';
import { BossBase, type Attack, type BossOpts } from './boss';

/**
 * The stomp's shockwave ripple. It starts inside the stomp circle (so stepping out of the stomp is
 * enough to be outside it), expands slower than the slowest character can run, and carries a gap —
 * dodgeable by running or by slipping through the gap. Guarded by a test against character speeds.
 */
export const SHOCKWAVE = { r: 62, r2: 52, grow: 150, active: 1.0, dmg: 10, gapHalf: 0.45 };
/** Radius of a stomp's footprint. */
export const STOMP_R = 85;

export class TentBoss extends BossBase {
  private pole: Hazard | null = null;
  private eaten = 0;

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.x = this.px = 0;
    this.y = this.py = -40;
    this.solid = true;
    this.solidR = 120;
    this.moveSpeed = 120;
    this.keepDist = 330;
    this.pose = { maw: 0, leg: -1, legT: 0, collapse: 0, fire: 0, inhale: 0 };
  }

  get mawX() {
    return this.x;
  }
  get mawY() {
    return this.y + 30;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('inhale', 1);
    for (let i = 0; i < 120; i++) {
      this.pose.maw = i / 120;
      if (i % 30 === 0) this.g.fx.push('shake', this.x, this.y, 0.35);
      yield 1 / 60;
    }
    this.sfx('roar', 1);
    this.g.fx.push('ring', this.x, this.y, 260, 0, 0, 'shock');
    yield 0.6;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'stomp', w: 1.2, fn: () => this.stomp(this.g.rng.int(1, 3), 1.0) },
      { name: 'spew', w: 1, fn: () => this.spew() },
      { name: 'pennant', w: 1, fn: () => this.pennantFlap() },
    ];
    if (phase === 1) return [
      { name: 'inhale', w: 1, fn: () => this.inhale() },
      { name: 'exhale', w: 0.8, fn: () => this.exhale() },
      { name: 'stakes', w: 1, fn: () => this.stakeDrop() },
    ];
    return [
      { name: 'frenzy', w: 1.2, fn: () => this.stomp(6, 0.8, 0.28) },
      { name: 'fire', w: 0.9, fn: () => this.ringOfFire() },
      { name: 'clowns', w: 0.8, fn: () => this.clownCall() },
    ];
  }

  protected onPhase(phase: number): Co | null {
    const g = this.g;
    if (phase === 1) {
      // The center tent-pole crashes down and sweeps the arena for the whole phase.
      this.sfx('crash', 1);
      g.fx.push('shake', this.x, this.y, 0.8);
      this.pole = this.hz('line', 'pole', this.x, this.y, { len: 430, r2: 16, angle: this.angleToPlayer() + Math.PI / 2, spinRate: 0.55, tele: 1.2, active: 9999, dmg: 18, tick: 0.6 });
    }
    if (phase === 2) {
      if (this.pole) this.pole.alive = false;
      this.pole = null;
      this.pose.collapse = 1;
      this.pose.fire = 1;
      this.moveSpeed = 160;
      this.sfx('fire', 1);
    }
    return null;
  }

  protected tickBoss(dt: number): void {
    if (this.pole && this.pole.alive) {
      this.pole.x = this.x;
      this.pole.y = this.y;
      this.pole.x2 = this.x + Math.cos(this.pole.angle) * this.pole.len;
      this.pole.y2 = this.y + Math.sin(this.pole.angle) * this.pole.len;
    }
    if (this.pose.legT > 0) this.pose.legT = Math.max(0, this.pose.legT - dt * 3);
  }

  private *stomp(n: number, tele: number, gap = 0.45): Co {
    const g = this.g;
    this.anim = 'stomp';
    for (let i = 0; i < n; i++) {
      const p = g.player;
      const lead = i === 0 ? 0 : 0.25;
      const x = p.x + p.vx * lead + g.rng.range(-30, 30), y = p.y + p.vy * lead + g.rng.range(-30, 30);
      const leg = i % 4;
      this.pose.leg = leg;
      const t = this.tele(tele);
      this.hz('circle', 'stomp', x, y, {
        r: STOMP_R, tele: t, active: 0.12, dmg: 25,
        onActivate: () => {
          this.pose.legT = 1;
          g.fx.push('shake', x, y, 0.45);
          g.fx.push('dust', x, y, 1.5);
          this.sfx('stomp', 0.9);
          this.hz('ring', 'shockwave', x, y, { ...SHOCKWAVE, tele: 0.12, angle: g.rng.range(0, Math.PI * 2) });
        },
      });
      yield gap;
    }
    yield this.tele(tele);
  }

  private *spew(): Co {
    const g = this.g;
    this.anim = 'spew';
    this.windup = 1;
    this.sfx('chachunk', 0.9);
    for (let i = 0; i < 40; i++) {
      this.pose.maw = 0.5 + 0.5 * Math.abs(Math.sin(i * 0.5));
      yield 1 / 60;
    }
    const base = this.angleToPlayer(this.mawX, this.mawY);
    const n = Math.round(7 * this.addsMult());
    const ids = g.act >= 2 ? ['possessed_stuffie', 'living_balloon', 'evil_clown'] : ['living_balloon', 'living_balloon', 'possessed_stuffie'];
    for (let i = 0; i < n; i++) {
      const a = base + (i / (n - 1) - 0.5) * 1.3;
      const e = g.spawnEnemy(ids[i % ids.length], this.mawX + Math.cos(a) * 60, this.mawY + Math.sin(a) * 60);
      if (e) {
        e.kbT = 0.35;
        e.kbX = Math.cos(a) * 520;
        e.kbY = Math.sin(a) * 520;
      }
    }
    g.fx.push('confetti', this.mawX, this.mawY, 1);
    this.sfx('spew', 0.9);
    this.windup = 0;
    this.pose.maw = 0.3;
    yield 0.6;
  }

  /** A flat row of pennant flags sweeps toward the player — find the gap. */
  private *pennantFlap(): Co {
    const g = this.g;
    this.anim = 'flap';
    const a = this.angleToPlayer();
    const dx = Math.cos(a), dy = Math.sin(a);
    const n = 17, spacing = 48;
    const gap = g.rng.int(3, n - 5);
    const sx = this.x + dx * 110, sy = this.y + dy * 110;
    const t = this.tele(0.9);
    this.hz('line', 'pennant_row', sx - dy * spacing * (n / 2), sy + dx * spacing * (n / 2), { x2: sx + dy * spacing * (n / 2), y2: sy - dx * spacing * (n / 2), r2: 14, tele: t, active: 0.01, dmg: 0 });
    this.sfx('flap', 0.8);
    this.windup = 1;
    yield t;
    this.windup = 0;
    for (let i = 0; i < n; i++) {
      if (i >= gap && i < gap + 2) continue;
      const off = (i - (n - 1) / 2) * spacing;
      this.bullet('star', sx - dy * off, sy + dx * off, a, 230, 14, { life: 5, r: 13, spin: 0 });
    }
    yield 0.8;
  }

  private *inhale(): Co {
    const g = this.g;
    this.anim = 'inhale';
    this.eaten = 0;
    this.sfx('inhale', 1);
    const t = this.tele(0.8);
    this.hz('circle', 'inhale_warn', this.mawX, this.mawY, { r: 420, tele: t, active: 0.01, dmg: 0, safe: true });
    yield t;
    const maw = this.hz('circle', 'maw', this.mawX, this.mawY, { r: 70, tele: 0.01, active: 3.2, dmg: 30, tick: 0.5, pull: 140 });
    for (let i = 0; i < 190; i++) {
      this.pose.inhale = 1;
      this.pose.maw = 1;
      maw.x = this.mawX;
      maw.y = this.mawY;
      // pull and eat adds
      g.forEachEnemyInCircle(this.mawX, this.mawY, 420, (e) => {
        const dx = this.mawX - e.x, dy = this.mawY - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * 160 / 60;
        e.y += (dy / d) * 160 / 60;
        if (d < 60) {
          g.despawnEnemy(e);
          this.eaten++;
        }
      });
      if (i % 6 === 0) g.fx.push('spark', this.mawX + g.rng.range(-400, 400), this.mawY + g.rng.range(-300, 300), 1, 0, 0, 'wind');
      yield 1 / 60;
    }
    this.pose.inhale = 0;
    this.pose.maw = 0.4;
    // An inhale always feeds straight into the exhale (doc 05).
    yield* this.exhale();
  }

  private *exhale(): Co {
    this.anim = 'exhale';
    this.windup = 1;
    this.sfx('glow', 0.7);
    this.pose.maw = 1;
    yield this.tele(0.8);
    this.windup = 0;
    const base = this.angleToPlayer(this.mawX, this.mawY);
    const n = 22 + Math.min(20, this.eaten * 2);
    for (let i = 0; i < n; i++) {
      const a = base + this.g.rng.range(-0.62, 0.62);
      this.bullet('popcorn', this.mawX, this.mawY, a, this.g.rng.range(190, 320), 16, { life: 4, r: 9, bounce: 1, spin: 6 });
    }
    this.eaten = 0;
    this.sfx('popcornburst', 1);
    this.g.fx.push('shake', this.x, this.y, 0.3);
    yield 0.8;
    this.pose.maw = 0.3;
  }

  private *stakeDrop(): Co {
    const g = this.g;
    this.anim = 'roar';
    const n = g.rng.int(8, 12);
    const t = this.tele(1.15);
    for (let i = 0; i < n; i++) {
      const a = g.rng.angle();
      const d = i === 0 ? 0 : g.rng.range(60, 380);
      const x = g.player.x + Math.cos(a) * d, y = g.player.y + Math.sin(a) * d;
      this.hz('circle', 'stake', x, y, {
        r: 46, tele: t + i * 0.06, active: 0.12, dmg: 20,
        onActivate: () => {
          g.fx.push('dust', x, y, 0.6);
          this.hz('circle', 'stake_stand', x, y, { r: 18, tele: 0.01, active: 2.6, dmg: 10, tick: 0.6 });
        },
      });
    }
    this.sfx('whistle', 0.7);
    yield t + 0.8;
  }

  /** A closing ring of flame herds the player inward toward the stomp zone. */
  private *ringOfFire(): Co {
    this.anim = 'roar';
    const t = this.tele(1.3);
    const d0 = Math.max(560, this.distToPlayer() + 160);
    const h = this.hz('annulus', 'fire_ring', this.x, this.y, { r: d0 + 260, r2: d0, tele: t, active: 4.2, dmg: 18, tick: 0.5, grow: -(d0 - 240) / 4.2 });
    this.sfx('fire', 0.9);
    yield t;
    for (let i = 0; i < 252; i++) {
      h.x = this.x;
      h.y = this.y;
      if (h.r2 < 230) {
        h.grow = 0;
      }
      if (i % 50 === 25) yield* this.stomp(1, 0.75, 0.1);
      else yield 1 / 60;
    }
  }

  private *clownCall(): Co {
    const g = this.g;
    this.anim = 'roar';
    this.windup = 1;
    this.sfx('bellow', 1);
    yield this.tele(0.8);
    this.windup = 0;
    const n = Math.round((2 + g.rng.int(0, 1)) * this.addsMult());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      g.spawnEnemy('evil_clown', this.mawX + Math.cos(a) * 90, this.mawY + Math.sin(a) * 90, { elite: true });
    }
    g.fx.push('confetti', this.mawX, this.mawY, 1.2);
    yield 0.6;
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    for (let i = 0; i < 150; i++) {
      this.pose.collapse = Math.min(1, i / 120);
      if (i % 12 === 0) {
        g.fx.push('explosion', this.x + g.rng.range(-110, 110), this.y + g.rng.range(-90, 60), 60, 0, 0, 'boss');
        this.sfx('boom', 0.6, 0.8 + g.rng.next() * 0.4);
      }
      yield 1 / 60;
    }
    g.fx.push('boss_death', this.x, this.y, 1, 0, 0, 'tent');
    g.fx.push('confetti', this.x, this.y, 3);
    yield 0.3;
  }
}
