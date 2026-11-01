// THE GHOST TRAIN, BOSS 4 — THE IRON FOREMAN (D-80). The man who built the Midnight Line's engines, riveted
// into the last of them: a boiler on legs, a steam hammer for a right fist, a chain and hook for a left, a
// works siren in his throat. He never let anybody clock off.
// P1 First Shift: the steam hammer (a slam and its shockwave), rivet volleys, the chain swept round.
// P2 Overtime: girders dropped across the yard, steam vents erupting in waves, riveters called.
// P3 Meltdown: slag poured where you stand (it stays molten a while), and the hammer twice as often.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { GhostTrainBoss } from './gtBoss';

/** Tuning the tests read. */
export const FOREMAN = { slamR: 150, waveGrow: 420, rivets: 7, rivetSpread: 0.13, chainR: 400, chainHalf: 1.1, girderHalf: 30, ventR: 72, ventStep: 210, slagR: 92, slagSecs: 6 };

export class ForemanBoss extends GhostTrainBoss {
  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.moveSpeed = 85;
    this.keepDist = 300;
    this.pose = { hammer: 0, chain: 0, steam: 0, rivet: 0, siren: 0, fall: 0, step: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.hammer = Math.max(0, P.hammer - dt * 2.2);
    P.chain = Math.max(0, P.chain - dt * 1.4);
    P.rivet = Math.max(0, P.rivet - dt * 3);
    P.siren = Math.max(0, P.siren - dt * 0.8);
    P.steam += dt * (0.6 + this.phase * 0.5);
    P.step += Math.hypot(this.x - this.px, this.y - this.py) * 0.035;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('gt_siren', 1);
    for (let i = 0; i < 90; i++) {
      this.pose.siren = Math.sin((i / 90) * Math.PI);
      yield 1 / 60;
    }
    this.pose.hammer = 1;
    this.sfx('boom', 0.9, 0.7);
    this.g.fx.push('ring', this.x, this.y, 210, 0, 0, 'shock');
    this.g.fx.push('shake', this.x, this.y, 0.5);
    yield 0.5;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'slam', w: 1.2, fn: () => this.slam(2) },
      { name: 'rivets', w: 1, fn: () => this.rivets(3) },
      { name: 'chain', w: 0.9, fn: () => this.chain() },
    ];
    if (phase === 1) return [
      { name: 'girders', w: 1.1, fn: () => this.girders(4) },
      { name: 'vents', w: 1, fn: () => this.vents() },
      { name: 'riveters', w: 0.6, fn: () => this.riveters() },
      { name: 'slam', w: 0.9, fn: () => this.slam(2) },
      { name: 'rivets', w: 0.8, fn: () => this.rivets(4) },
    ];
    return [
      { name: 'slag', w: 1.1, fn: () => this.slag() },
      { name: 'slam', w: 1.1, fn: () => this.slam(3) },
      { name: 'girders', w: 0.9, fn: () => this.girders(6) },
      { name: 'chain', w: 0.8, fn: () => this.chain() },
      { name: 'vents', w: 0.7, fn: () => this.vents() },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.moveSpeed = 95;
      this.banner('OVERTIME', 'Nobody clocks off.');
      this.sfx('gt_siren', 1, 1.1);
    }
    if (phase === 2) {
      this.moveSpeed = 108;
      this.keepDist = 240;
      this.banner('MELTDOWN', 'The works are running hot.');
      this.sfx('gt_siren', 1, 0.8);
    }
    return null;
  }

  /** The steam hammer: a slam where you stand, and a shockwave rolling out of it. */
  private *slam(n: number): Co {
    for (let i = 0; i < n; i++) {
      this.anim = 'hammer';
      const p = this.target();
      const c = this.ground(p.x, p.y, 0);
      const t = this.tele(i === 0 ? 1 : 0.8);
      const h = this.hz('circle', 'gt_hammer', c.x, c.y, { r: FOREMAN.slamR, tele: t, active: 0.2, dmg: 26 });
      h.onActivate = () => {
        this.hz('ring', 'gt_shockwave', c.x, c.y, { r: FOREMAN.slamR, r2: 26, grow: FOREMAN.waveGrow, tele: 0.01, active: 1.1, dmg: 12 });
        this.g.fx.push('shake', c.x, c.y, 0.45);
        this.g.fx.push('dust', c.x, c.y, 1.4);
      };
      yield* this.windupFor(t, 'hammer');
      this.pose.hammer = 1;
      this.sfx('boom', 0.9, 0.8);
      this.sfx('steam_hiss', 0.7);
      yield 0.35;
    }
  }

  /** The rivet gun: fans of hot rivets. */
  private *rivets(n: number): Co {
    this.anim = 'rivet';
    for (let k = 0; k < n; k++) {
      yield* this.windupFor(this.tele(0.35), 'rivet');
      const a = this.angleToTarget() + (k % 2 ? 0.065 : -0.065);
      for (let i = 0; i < FOREMAN.rivets; i++) {
        const ang = a + (i - (FOREMAN.rivets - 1) / 2) * FOREMAN.rivetSpread;
        this.bullet('musket', this.x + Math.cos(a) * 50, this.y + Math.sin(a) * 50 - 30, ang, 420, 11, { r: 8 });
      }
      this.pose.rivet = 1;
      this.sfx('gt_rivet', 0.8);
      yield 0.32;
    }
    yield 0.3;
  }

  /** The chain and hook swung round in a long arc. */
  private *chain(): Co {
    this.anim = 'chain';
    const a = this.angleToTarget();
    const t = this.tele(0.95);
    this.hz('sector', 'gt_chain', this.x, this.y, { r: FOREMAN.chainR, angle: a, half: FOREMAN.chainHalf, tele: t, active: 0.35, dmg: 20 });
    yield* this.windupFor(t, 'chain');
    this.pose.chain = 1;
    this.sfx('gt_chain', 0.9);
    yield 0.6;
  }

  /** Girders let fall across the yard, every one crossing near you. */
  private *girders(n: number): Co {
    this.anim = 'siren';
    this.pose.siren = 1;
    this.sfx('gt_siren', 0.6, 1.4);
    const p = this.target();
    for (let k = 0; k < n; k++) {
      const a = this.g.rng.angle(), off = this.g.rng.range(-90, 90), L = 520;
      const cx = p.x + Math.cos(a + Math.PI / 2) * off, cy = p.y + Math.sin(a + Math.PI / 2) * off;
      const A = this.ground(cx - Math.cos(a) * L, cy - Math.sin(a) * L, 0), B = this.ground(cx + Math.cos(a) * L, cy + Math.sin(a) * L, 0);
      const h = this.hz('line', 'gt_girder', A.x, A.y, { x2: B.x, y2: B.y, r2: FOREMAN.girderHalf, tele: this.tele(1.15 + k * 0.22), active: 0.2, dmg: 22 });
      h.onActivate = () => this.g.fx.push('dust', (A.x + B.x) / 2, (A.y + B.y) / 2, 1.2);
    }
    yield this.tele(1.15 + n * 0.22) + 0.3;
  }

  /** The yard's steam vents erupt in a checkerboard, one colour and then the other. */
  private *vents(): Co {
    this.anim = 'siren';
    const p = this.target();
    const S = FOREMAN.ventStep;
    for (let wave = 0; wave < 2; wave++) {
      for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) {
        if (((i + j) & 1) !== wave) continue;
        const c = this.ground(p.x + i * S, p.y + j * S, 0);
        this.hz('circle', 'gt_steam', c.x, c.y, { r: FOREMAN.ventR, tele: this.tele(1 + wave * 0.9), active: 0.4, dmg: 14 });
      }
    }
    this.sfx('steam_hiss', 0.9);
    yield this.tele(1.9) + 0.5;
  }

  /** "Back to work!": riveters and a slag-walker clock on. */
  private *riveters(): Co {
    this.anim = 'siren';
    yield* this.windupFor(0.6, 'siren');
    this.sfx('gt_siren', 0.8, 1.2);
    const p = this.target();
    const crew = ['gt_riveter', 'gt_riveter', 'gt_riveter', 'gt_slag'];
    const n = Math.round(crew.length * this.addsMult());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.g.rng.next() * 0.4, r = this.g.rng.range(300, 380);
      this.add(crew[i % crew.length], p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    yield 1;
  }

  /** Slag poured where each of you stands; it stays molten a while. */
  private *slag(): Co {
    this.anim = 'hammer';
    yield* this.windupFor(this.tele(0.6), 'hammer');
    const L = this.locals();
    const targets = L.length ? L : [this.target()];
    for (let k = 0; k < 5; k++) {
      const p = targets[k % targets.length];
      const c = this.ground(p.x + this.g.rng.range(-140, 140), p.y + this.g.rng.range(-110, 110), 0);
      const h = this.hz('circle', 'gt_slag_pour', c.x, c.y, { r: FOREMAN.slagR, tele: this.tele(1.05), active: 0.2, dmg: 18 });
      h.onActivate = () => this.hz('circle', 'gt_slag_pool', c.x, c.y, { r: FOREMAN.slagR, tele: 0.01, active: FOREMAN.slagSecs, dmg: 7, tick: 0.5, slow: 0.3 });
      yield 0.18;
    }
    this.sfx('gt_sizzle', 0.9);
    yield this.tele(1);
  }

  protected *defeatSequence(): Co {
    this.sfx('gt_siren', 1, 0.5);
    for (let i = 0; i < 130; i++) {
      this.pose.fall = Math.min(1, i / 100);
      if (i % 15 === 0) {
        this.g.fx.push('spark', this.x + this.g.rng.range(-60, 60), this.y - 60, 6, 0, 0, 'electric');
        this.sfx('steam_hiss', 0.5);
      }
      yield 1 / 60;
    }
    this.g.fx.push('explosion', this.x, this.y, 220, 0, 0, 'fire');
    this.sfx('boom', 1, 0.6);
    yield 1;
  }
}
