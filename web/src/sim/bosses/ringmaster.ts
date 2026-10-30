// BOSS 4 — THE RINGMASTER (doc 05, final). P1 the theatrical human conductor; P2 "The Greatest
// Show" — a parade of the prior bosses' signature attacks, rotating spotlights, bullet rings;
// P3 the Demon Ringmaster's bullet-hell finale. Defeat = dawn (D-01). Encore variant for Endless.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import { BossBase, type Attack, type BossOpts } from './boss';

export class RingmasterBoss extends BossBase {
  demon = 0; // 0..1 transformation (render)
  hatSpin = 0;

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    const p = g.player;
    this.x = this.px = p.x + 360;
    this.y = this.py = p.y - 200;
    this.moveSpeed = 150;
    this.keepDist = 360;
    this.pose = { bow: 0, whip: 0, cane: 0, hat: 0, spotlight: 0, snap: 0 };
    if (this.encore) this.demon = 1;
  }

  protected tickBoss(dt: number): void {
    this.hatSpin += dt * (this.pose.hat > 0 ? 12 : 1);
    for (const k of ['whip', 'cane', 'snap'] as const) this.pose[k] = Math.max(0, this.pose[k] - dt * 2.5);
  }

  protected *intro(): Co {
    const g = this.g;
    this.anim = 'intro';
    if (this.encore) {
      this.banner('ENCORE!', 'The Ringmaster returns');
      this.sfx('laugh', 1);
      yield 1.5;
      return;
    }
    this.pose.spotlight = 1;
    this.sfx('spotlight', 1);
    yield 0.8;
    this.banner('"LADIES AND GENTLEMEN…"', '…for the grand finale… YOU.');
    for (let i = 0; i < 90; i++) {
      this.pose.bow = Math.sin((i / 90) * Math.PI);
      yield 1 / 60;
    }
    this.sfx('laugh', 1);
    g.fx.push('confetti', this.x, this.y - 60, 2);
    yield 0.8;
    this.pose.spotlight = 0;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'whip', w: 1.3, fn: () => this.whip(false) },
      { name: 'hat', w: 0.8, fn: () => this.topHatTrick() },
      { name: 'cane', w: 1, fn: () => this.caneShockwave() },
      { name: 'bow', w: 0.8, fn: () => this.grandBow() },
    ];
    if (phase === 1) return [
      { name: 'parade', w: 1.2, fn: () => this.parade() },
      { name: 'spotlights', w: 1, fn: () => this.spotlightSweep() },
      { name: 'rings', w: 1.1, fn: () => this.bulletRings(4) },
      { name: 'whip', w: 0.6, fn: () => this.whip(false) },
    ];
    return [
      { name: 'hellwhip', w: 1.2, fn: () => this.whip(true) },
      { name: 'barrage', w: 1, fn: () => this.finaleBarrage() },
      { name: 'summon', w: 0.7, fn: () => this.summonCarnival() },
      { name: 'rings', w: 0.8, fn: () => this.bulletRings(3.5) },
    ];
  }

  protected roam(dt: number): void {
    super.roam(dt);
    // Encore / Demon relocates constantly with a smoke puff (doc 05 Encore).
    if ((this.enraged || this.phase === 2) && this.g.rng.chance(dt * (this.enraged ? 0.5 : 0.15))) this.relocate();
  }

  private relocate(): void {
    const g = this.g;
    g.fx.push('spark', this.x, this.y, 14, 0, 0, 'smoke');
    const a = g.rng.angle();
    this.x = g.player.x + Math.cos(a) * 380;
    this.y = g.player.y + Math.sin(a) * 300;
    g.fx.push('spark', this.x, this.y, 14, 0, 0, 'smoke');
    this.sfx('poof', 0.6);
  }

  protected onPhase(phase: number): Co | null {
    const g = this.g;
    if (phase === 1) {
      this.pose.snap = 1;
      this.banner('THE GREATEST SHOW!', 'Three rings — one finale');
      this.sfx('snap', 1);
      g.bus.emit('music', { cue: 'boss_ringmaster_2' });
    }
    if (phase === 2) return this.transform();
    return null;
  }

  private *transform(): Co {
    const g = this.g;
    this.banner("THE DEVIL'S OWN", 'He stops pretending to be a man');
    g.bus.emit('music', { cue: 'boss_ringmaster_3' });
    this.sfx('demon', 1);
    for (let i = 0; i < 60; i++) {
      this.demon = i / 60;
      if (i % 10 === 0) g.fx.push('shake', this.x, this.y, 0.5);
      yield 1 / 60;
    }
    this.demon = 1;
    g.fx.push('flash', this.x, this.y, 0.9, 0, 0, 'fire');
    this.moveSpeed = 175;
  }

  /** Whip Crack (fan of fast lines) / Hellfire Whip (wider, slower, leaves burning ground). */
  private *whip(hell: boolean): Co {
    const g = this.g;
    this.anim = 'whip';
    const a0 = this.angleToPlayer();
    const n = hell ? 3 : g.rng.int(2, 3);
    const len = hell ? 720 : 620;
    const w = hell ? 24 : 14;
    const t = this.tele(hell ? 1.0 : 0.75);
    const angs: number[] = [];
    for (let i = 0; i < n; i++) angs.push(a0 + (i - (n - 1) / 2) * (hell ? 0.42 : 0.32));
    for (const a of angs) {
      this.hz('line', hell ? 'hellwhip' : 'whip', this.x, this.y, {
        x2: this.x + Math.cos(a) * len, y2: this.y + Math.sin(a) * len, r2: w, tele: t, active: 0.16, dmg: hell ? 28 : 24,
        onActivate: hell ? () => {
          for (let d = 60; d < len; d += 64) {
            this.hz('circle', 'hellfire', this.x + Math.cos(a) * d, this.y + Math.sin(a) * d, { r: 28, tele: 0.01, active: 3.4, dmg: 10, tick: 0.5 });
          }
        } : null,
      });
    }
    this.sfx('whipwind', 0.8);
    yield t;
    this.pose.whip = 1;
    this.sfx('whipcrack', 1);
    g.fx.push('shake', this.x, this.y, 0.25);
    yield hell ? 0.9 : 0.6;
  }

  private *topHatTrick(): Co {
    const g = this.g;
    this.anim = 'hat';
    this.pose.hat = 1;
    const p = g.player;
    const a = g.rng.angle();
    const x = p.x + Math.cos(a) * 260, y = p.y + Math.sin(a) * 200;
    const t = this.tele(1.0);
    this.hz('circle', 'hat_spot', x, y, { r: 90, tele: t, active: 0.01, dmg: 0 });
    this.sfx('hatpop', 0.9);
    yield t;
    g.fx.push('spark', x, y, 16, 0, 0, 'smoke');
    const fam = ['evil_clown', 'wind_up_monkey', 'possessed_stuffie', 'carousel_horse', 'bumper_car', 'living_balloon'];
    const n = Math.round(7 * this.addsMult());
    for (let i = 0; i < n; i++) g.spawnEnemy(fam[i % fam.length], x + g.rng.range(-50, 50), y + g.rng.range(-50, 50));
    this.pose.hat = 0;
    yield 0.6;
  }

  /** Concentric expanding rings, each with a safe gap to weave through. */
  private *caneShockwave(): Co {
    this.anim = 'cane';
    const n = 4;
    const t = this.tele(0.8);
    this.hz('circle', 'cane_warn', this.x, this.y, { r: 120, tele: t, active: 0.01, dmg: 0 });
    yield t;
    let gapA = this.angleToPlayer() + this.g.rng.range(-1, 1);
    for (let i = 0; i < n; i++) {
      this.pose.cane = 1;
      this.sfx('canetap', 0.9);
      this.hz('ring', 'cane_ring', this.x, this.y, { r: 30, r2: 12, grow: 230, tele: 0.01, active: 3.6, dmg: 16, angle: gapA, gapHalf: 0.42 });
      gapA += this.g.rng.range(0.7, 1.4) * this.g.rng.sign();
      yield 0.65;
    }
    yield 1.4;
  }

  /** Grand Bow: a spotlight tracks you; stay lit and the follow-up beam strikes. Keep moving. */
  private *grandBow(): Co {
    this.anim = 'bow';
    this.pose.bow = 1;
    const p = this.g.player;
    const t = this.tele(2.4);
    const spot = this.hz('circle', 'spotlight', p.x, p.y, { r: 80, tele: t, active: 0.3, dmg: 20, followPlayer: 2.4 });
    this.sfx('spotlight', 0.9);
    yield t;
    this.pose.bow = 0;
    this.g.fx.push('explosion', spot.x, spot.y, 80, 0, 0, 'beam');
    this.sfx('zap', 1);
    yield 0.7;
  }

  /** Parade of Horrors: the greatest hits of the prior bosses, announced act by act. */
  private *parade(): Co {
    const g = this.g;
    this.anim = 'conduct';
    // Act 1: the Wheel's roll
    g.bus.emit('banner', { text: 'ACT ONE: THE WHEEL!', style: 'boss' });
    {
      const a = this.angleToPlayer() + g.rng.range(-0.3, 0.3);
      const L = 1600;
      const sx = g.player.x - Math.cos(a) * L / 2, sy = g.player.y - Math.sin(a) * L / 2;
      const t = this.tele(1.3);
      this.hz('line', 'roll_lane', sx, sy, { x2: sx + Math.cos(a) * L, y2: sy + Math.sin(a) * L, r2: 90, tele: t, active: 0.01, dmg: 0 });
      yield t;
      this.hz('circle', 'phantom_wheel', sx, sy, { r: 88, tele: 0.01, active: L / 1000, dmg: 30, vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000 });
      this.sfx('rev', 1);
      yield 1.0;
    }
    // Act 2: the King's strings
    g.bus.emit('banner', { text: 'ACT TWO: THE STRINGS!', style: 'boss' });
    {
      const p = g.player;
      const horizontal = g.rng.chance(0.5);
      const t = this.tele(1.0);
      const hs = [];
      for (let k = -1; k <= 1; k += 2) {
        const off = k * 140;
        const x1 = horizontal ? p.x - 900 : p.x + off - k * 300;
        const x2 = horizontal ? p.x + 900 : p.x + off - k * 300;
        const y1 = horizontal ? p.y + off - k * 300 : p.y - 700;
        const y2 = horizontal ? p.y + off - k * 300 : p.y + 700;
        const h = this.hz('line', 'string_sweep', x1, y1, { x2, y2, r2: 9, tele: t, active: 2.2, dmg: 16, tick: 0.5 });
        hs.push([h, k] as const);
      }
      this.sfx('twang', 0.9);
      yield t;
      for (const [h, k] of hs) {
        if (horizontal) h.vy = k * 260;
        else h.vx = k * 260;
      }
      yield 1.6;
    }
    // Act 3: the Tent's stomps
    g.bus.emit('banner', { text: 'ACT THREE: THE STOMP!', style: 'boss' });
    for (let i = 0; i < 3; i++) {
      const p = g.player;
      const x = p.x + g.rng.range(-60, 60), y = p.y + g.rng.range(-60, 60);
      this.hz('circle', 'stomp', x, y, {
        r: 85, tele: this.tele(0.95), active: 0.12, dmg: 25,
        onActivate: () => {
          g.fx.push('shake', x, y, 0.4);
          this.sfx('stomp', 0.8);
          this.hz('ring', 'shockwave', x, y, { r: 95, r2: 80, grow: 260, tele: 0.01, active: 0.8, dmg: 12 });
        },
      });
      yield 0.5;
    }
    yield 1.2;
  }

  /** Rotating spotlight beams are damage; the dark between them is safe. */
  private *spotlightSweep(): Co {
    this.anim = 'conduct';
    const n = 4;
    const t = this.tele(1.3);
    const base = this.g.rng.angle();
    const dir = this.g.rng.sign();
    const hs = [];
    for (let i = 0; i < n; i++) {
      hs.push(this.hz('line', 'spot_beam', this.x, this.y, { len: 900, r2: 46, angle: base + (i * TAU) / n, spinRate: 0, tele: t, active: 4.6, dmg: 18, tick: 0.5 }));
    }
    for (const h of hs) {
      h.x2 = h.x + Math.cos(h.angle) * h.len;
      h.y2 = h.y + Math.sin(h.angle) * h.len;
    }
    this.sfx('spotlight', 0.9);
    yield t;
    for (const h of hs) h.spinRate = dir * 0.5;
    for (let i = 0; i < 276; i++) {
      for (const h of hs) {
        h.x = this.x;
        h.y = this.y;
      }
      yield 1 / 60;
    }
  }

  /** Continuous rotating rings of projectiles with readable gaps. */
  private *bulletRings(dur: number): Co {
    this.anim = 'hat';
    this.pose.hat = 1;
    this.sfx('hatspin', 0.9);
    yield this.tele(0.7);
    const steps = Math.round(dur / 0.36);
    let off = this.g.rng.angle();
    const n = this.demon > 0.5 ? 22 : 18;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < n; i++) {
        if (i % 6 === 0 || i % 6 === 1) continue; // three wide gaps per ring
        const a = off + (i * TAU) / n;
        this.bullet(this.demon > 0.5 ? 'hellfire' : 'ring', this.x, this.y - 40, a, 150, 12, { life: 6, r: 8 });
      }
      off += 0.16;
      if (s % 3 === 0) this.sfx('pew', 0.3, 0.9);
      yield 0.36;
    }
    this.pose.hat = 0;
  }

  /** Screen-filling convergent bullet-hell with a clearly marked, slowly moving safe pocket. */
  private *finaleBarrage(): Co {
    const g = this.g;
    this.anim = 'barrage';
    const t = this.tele(1.5);
    let safe = Math.atan2(g.player.y - this.y, g.player.x - this.x) + Math.PI; // pocket on the far side of him
    const cx = g.player.x, cy = g.player.y;
    this.hz('annulus', 'rim_glow', cx, cy, { r: 760, r2: 700, tele: t, active: 0.01, dmg: 0 });
    const marker = this.hz('circle', 'safe_pocket', cx + Math.cos(safe) * 300, cy + Math.sin(safe) * 300, { r: 75, tele: 0.01, active: t + 6.5, dmg: 0, safe: true });
    this.sfx('rumble', 1);
    yield t;
    for (let wave = 0; wave < 7; wave++) {
      const n = 30;
      for (let i = 0; i < n; i++) {
        const a = (i * TAU) / n + wave * 0.07;
        let d = a - safe;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        if (Math.abs(d) < 0.46) continue;
        const sx = cx + Math.cos(a) * 760, sy = cy + Math.sin(a) * 760;
        this.g.spawnBullet('hellfire', sx, sy, -Math.cos(a) * 250, -Math.sin(a) * 250, 14 * this.dmgMult, { life: 6, r: 9 });
      }
      this.sfx('pew', 0.4, 0.7);
      safe += 0.22 * (wave % 2 === 0 ? 1 : 1);
      marker.x = cx + Math.cos(safe) * 300;
      marker.y = cy + Math.sin(safe) * 300;
      yield 0.8;
    }
    yield 1.2;
  }

  private *summonCarnival(): Co {
    const g = this.g;
    this.anim = 'roar';
    this.sfx('demon', 1);
    g.fx.push('shake', this.x, this.y, 0.6);
    yield this.tele(0.8);
    const fam = ['evil_clown', 'carousel_horse', 'puppet_soldier', 'bumper_car', 'possessed_stuffie', 'wind_up_monkey'];
    const n = Math.round(12 * this.addsMult());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      g.spawnEnemy(fam[i % fam.length], g.player.x + Math.cos(a) * 420, g.player.y + Math.sin(a) * 330, { elite: i < 2 });
    }
    yield 1;
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    for (let i = 0; i < 180; i++) {
      if (i % 8 === 0) {
        g.fx.push('explosion', this.x + g.rng.range(-60, 60), this.y + g.rng.range(-120, 20), 55, 0, 0, 'fire');
        this.sfx('boom', 0.5, 0.7 + g.rng.next() * 0.5);
      }
      if (i % 30 === 0) g.fx.push('shake', this.x, this.y, 0.6);
      yield 1 / 60;
    }
    g.fx.push('boss_death', this.x, this.y, 1, 0, 0, 'ringmaster');
    g.fx.push('flash', this.x, this.y, 1, 0, 0, 'light');
    yield 0.3;
  }
}
