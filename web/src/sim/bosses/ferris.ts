// BOSS 2 — THE FERRIS WHEEL (doc 05). A landmark on the skyline all night; at 12:00 it tears free
// of its axle and rolls after the player. P1 gondola fire, P2 rolls across lanes, P3 throws everything.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import { BossBase, type Attack, type BossOpts } from './boss';

export const FERRIS_HOME = { x: 1250, y: -1890 };

export class FerrisBoss extends BossBase {
  spin = 0; // wheel rotation (render + gondola positions)
  spinRate = 0.25;
  rolling = false;
  gondolas = 10;
  lostGondolas = 0;

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.x = this.px = FERRIS_HOME.x;
    this.y = this.py = FERRIS_HOME.y;
    this.moveSpeed = 70;
    this.keepDist = 420;
    this.pose = { free: 0, lights: 0, wobble: 0, rimGlow: 0, spoke: -1 };
  }

  gondolaPos(i: number): { x: number; y: number } {
    const a = this.spin + (i * TAU) / this.gondolas;
    const R = 132;
    return { x: this.x + Math.cos(a) * R, y: this.y + Math.sin(a) * R };
  }

  protected tickBoss(dt: number): void {
    this.spin += this.spinRate * dt * (this.rolling ? 6 * Math.sign(this.vx || 1) : 1);
  }
  protected roam(dt: number): void {
    if (this.phase === 0) super.roam(dt);
    else {
      // between rolls it stands and drifts
      this.vx *= 0.9;
      this.vy *= 0.9;
      super.roam(dt * 0.6);
    }
  }

  protected *intro(): Co {
    const g = this.g;
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('shriek', 1);
    for (let i = 0; i < 90; i++) {
      this.pose.lights = i / 90;
      this.pose.wobble = Math.sin(i * 0.8) * (i / 90);
      if (i % 15 === 0) g.fx.push('shake', this.x, this.y, 0.4);
      yield 1 / 60;
    }
    this.pose.free = 1;
    this.sfx('crash', 1);
    g.fx.push('spark', this.x, this.y + 150, 20, 0, 0, 'electric');
    // roll in toward the player
    this.rolling = true;
    const p = g.player;
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    const d = Math.max(0, Math.hypot(p.x - this.x, p.y - this.y) - 460);
    yield* this.moveTo(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d, 700);
    this.rolling = false;
    this.pose.wobble = 0;
    yield 0.4;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'spiral', w: 1.2, fn: () => this.gondolaSpiral(4.2) },
      { name: 'sweep', w: 1, fn: () => this.spokeSweep() },
      { name: 'drop', w: 0.9, fn: () => this.gondolaDrop() },
    ];
    if (phase === 1) return [
      { name: 'roll', w: 1.6, fn: () => this.roll(900, 1.5, true) },
      { name: 'spiral', w: 0.8, fn: () => this.gondolaSpiral(2.4) },
    ];
    return [
      { name: 'bombs', w: 1, fn: () => this.gondolaBombs() },
      { name: 'boomerangs', w: 1, fn: () => this.spokeBoomerangs() },
      { name: 'stampede', w: 0.7, fn: () => this.stampede() },
      { name: 'droll', w: 1.1, fn: () => this.roll(1150, 1.1, false) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.banner('OFF THE RAILS!');
      this.sfx('crash', 1);
      this.g.fx.push('shake', this.x, this.y, 0.8);
    }
    if (phase === 2) {
      this.pose.lights = 0.5;
      this.pose.wobble = 0.6;
      this.gondolas = 7;
      this.sfx('crash', 1);
    }
    return null;
  }

  private *gondolaSpiral(dur: number): Co {
    this.anim = 'spiral';
    this.windup = 1;
    this.sfx('creak', 0.8);
    yield this.tele(0.8);
    this.windup = 0;
    this.spinRate = 0.9;
    const steps = Math.round(dur / 0.14);
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < this.gondolas; i += 2) {
        const gp = this.gondolaPos(i + (s % 2));
        const a = Math.atan2(gp.y - this.y, gp.x - this.x);
        this.bullet('spiral', gp.x, gp.y, a, 165, 12, { life: 5, r: 8 });
      }
      if (s % 4 === 0) this.sfx('pew', 0.25, 1.3);
      yield 0.14;
    }
    this.spinRate = 0.25;
  }

  private *spokeSweep(): Co {
    this.anim = 'sweep';
    const a0 = this.angleToPlayer() - 1.05;
    const t = this.tele(0.9);
    const h = this.hz('line', 'spoke', this.x, this.y, { len: 560, r2: 18, angle: a0, tele: t, active: 1.3, dmg: 18, spinRate: 0, tick: 0.5 });
    h.x2 = this.x + Math.cos(a0) * 560;
    h.y2 = this.y + Math.sin(a0) * 560;
    this.pose.spoke = 1;
    this.sfx('creak', 0.9, 0.7);
    yield t;
    h.spinRate = 2.1 / 1.3;
    this.sfx('whoosh', 0.9);
    yield 1.3;
    this.pose.spoke = -1;
  }

  private *gondolaDrop(): Co {
    const g = this.g;
    this.anim = 'drop';
    for (let i = 0; i < 3; i++) {
      const p = g.player;
      const x = p.x + g.rng.range(-120, 120), y = p.y + g.rng.range(-120, 120);
      const t = this.tele(1.2);
      this.hz('circle', 'gondola', x, y, {
        r: 72, tele: t, active: 0.15, dmg: 22,
        onActivate: () => {
          g.fx.push('explosion', x, y, 72, 0, 0, 'boss');
          g.fx.push('shake', x, y, 0.4);
          this.sfx('crash', 0.7);
          this.hz('circle', 'debris', x, y, { r: 40, tele: 0.01, active: 1.6, dmg: 8, tick: 0.5 });
          for (let k = 0; k < 4; k++) g.spawnEnemy('living_balloon', x + g.rng.range(-40, 40), y + g.rng.range(-40, 40));
        },
      });
      yield 0.5;
    }
    yield 1.0;
  }

  /** The Roll: a lane flashes, the wheel rears, then thunders along the lane and may come back. */
  private *roll(speed: number, tele: number, mayReturn: boolean): Co {
    const g = this.g;
    this.anim = 'roll';
    let a = this.angleToPlayer();
    for (let pass = 0; pass < 2; pass++) {
      const L = 1500;
      const t = this.tele(pass === 0 ? tele : 0.9);
      const ex = this.x + Math.cos(a) * L, ey = this.y + Math.sin(a) * L;
      this.hz('line', 'roll_lane', this.x, this.y, { x2: ex, y2: ey, r2: 125, tele: t, active: 0.01, dmg: 0 });
      this.windup = 1;
      this.pose.rimGlow = 1;
      this.sfx('rev', 1);
      yield t;
      this.windup = 0;
      this.rolling = true;
      const contact = this.hz('circle', 'roll', this.x, this.y, { r: 128, tele: 0.01, active: L / speed + 0.2, dmg: 35 });
      const steps = Math.ceil((L / speed) * 60);
      for (let i = 0; i < steps; i++) {
        this.vx = Math.cos(a) * speed;
        this.vy = Math.sin(a) * speed;
        this.x += this.vx / 60;
        this.y += this.vy / 60;
        contact.x = this.x;
        contact.y = this.y;
        if (i % 5 === 0) {
          // shed sparks to the sides
          const side = a + Math.PI / 2;
          this.bullet('spark', this.x, this.y, side, 210, 12, { life: 1.6, r: 6 });
          this.bullet('spark', this.x, this.y, side + Math.PI, 210, 12, { life: 1.6, r: 6 });
          g.fx.push('dust', this.x, this.y + 110, 0.5);
        }
        if (i % 20 === 0) g.fx.push('shake', this.x, this.y, 0.25);
        yield 1 / 60;
      }
      contact.alive = false;
      this.rolling = false;
      this.pose.rimGlow = 0;
      this.vx = this.vy = 0;
      g.fx.push('shake', this.x, this.y, 0.5);
      this.sfx('crash', 0.8);
      if (!mayReturn || !g.rng.chance(0.55)) break;
      a = this.angleToPlayer();
      yield 0.3;
    }
    yield 0.6;
    // reposition: a short spiral between rolls (doc 05)
    if (this.phase === 1) yield* this.gondolaSpiral(1.4);
  }

  private *gondolaBombs(): Co {
    const g = this.g;
    this.anim = 'throw';
    const n = 5;
    for (let i = 0; i < n; i++) {
      const p = g.player;
      const x = p.x + p.vx * 0.8 + g.rng.range(-160, 160), y = p.y + p.vy * 0.8 + g.rng.range(-160, 160);
      const t = this.tele(1.25);
      this.hz('circle', 'gondola_bomb', x, y, {
        r: 78, tele: t, active: 0.15, dmg: 24,
        onActivate: () => {
          g.fx.push('explosion', x, y, 90, 0, 0, 'boss');
          g.fx.push('shake', x, y, 0.4);
          this.sfx('boom', 0.6);
          this.hz('circle', 'crater', x, y, { r: 50, tele: 0.01, active: 2, dmg: 9, tick: 0.5 });
        },
      });
      this.lostGondolas++;
      yield 0.35;
    }
    yield 1.2;
  }

  private *spokeBoomerangs(): Co {
    this.anim = 'spokes';
    this.pose.spoke = 1;
    this.windup = 1;
    this.sfx('creak', 0.9, 1.3);
    yield this.tele(0.8);
    this.windup = 0;
    const base = this.angleToPlayer();
    for (let i = 0; i < 4; i++) {
      const a = base + (i - 1.5) * 0.45;
      this.bullet('spoke', this.x, this.y, a, 480, 18, { life: 2.8, r: 20, spin: 12, returnAt: 1.3 });
    }
    this.sfx('whoosh', 1);
    yield 2.4;
    this.pose.spoke = -1;
  }

  private *stampede(): Co {
    const g = this.g;
    this.anim = 'roar';
    this.sfx('whinny', 1);
    const a = g.rng.chance(0.5) ? 0 : Math.PI / 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    const L = 1250;
    const sx = g.player.x - dx * L, sy = g.player.y - dy * L;
    const t = this.tele(1.6);
    this.hz('line', 'stampede', sx, sy, { x2: sx + dx * L * 2, y2: sy + dy * L * 2, r2: 100, tele: t, active: 0.01, dmg: 0 });
    yield t;
    const n = Math.round(6 * this.addsMult());
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 32;
      const e = g.spawnEnemy('carousel_horse', sx - dy * off, sy + dx * off);
      if (!e) continue;
      e.state = 2;
      e.dirX = dx;
      e.dirY = dy;
      e.n1 = L * 2 + 200;
      e.n2 = 0;
      e.leashExempt = true;
    }
    this.sfx('stampede', 1);
    yield 1;
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    this.rolling = false;
    for (let i = 0; i < 160; i++) {
      this.pose.lights = Math.max(0, 1 - i / 140);
      this.pose.wobble = Math.min(1, i / 100);
      this.spin += 0.02;
      if (i % 10 === 0) {
        const gp = this.gondolaPos(g.rng.int(0, this.gondolas - 1));
        g.fx.push('explosion', gp.x, gp.y, 50, 0, 0, 'boss');
        g.fx.push('spark', gp.x, gp.y, 6, 0, 0, 'electric');
        this.sfx('pop', 0.5, 0.6 + g.rng.next() * 0.6);
      }
      yield 1 / 60;
    }
    g.fx.push('boss_death', this.x, this.y, 1, 0, 0, 'ferris');
    g.fx.push('shake', this.x, this.y, 1);
    this.sfx('crash', 1);
    yield 0.3;
  }
}
