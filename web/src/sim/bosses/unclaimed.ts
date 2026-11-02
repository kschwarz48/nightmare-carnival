// THE GHOST TRAIN, BOSS 6 — THE UNCLAIMED (D-90). A century of the Midnight Line's left luggage, risen out of the
// Junction's lost property office: a heap of steamer trunks, carpetbags, hatboxes and a birdcage on a dozen
// umbrella legs, a trunk's lid for a jaw. Added for pacing when the final boss moved to 34:00: it fights at 30:00,
// at whichever station the party stands on, and follows them down the line like the others.
// P1 Left Luggage: suitcases hurled onto marked spots, a fan of umbrellas, the heap slamming down.
// P2 Excess Baggage: an avalanche of trunks down lanes across the station, mimics shaken out of the heap.
// P3 Lost and Found: it claims one of you and lands on the spot; rings of tags with one gap; everything faster.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { GhostTrainBoss } from './gtBoss';

/** Tuning the tests read. */
export const UNCLAIMED = { caseR: 70, cases: 6, fanLen: 520, fanCount: 7, slamR: 300, laneHalf: 58, laneGap: 210, claimR: 150, ringR: 70 };

export class UnclaimedBoss extends GhostTrainBoss {
  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.moveSpeed = 92;
    this.keepDist = 300;
    this.pose = { throw: 0, slam: 0, jaw: 0, leap: 0, shake: 0, fall: 0, step: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.throw = Math.max(0, P.throw - dt * 2);
    P.slam = Math.max(0, P.slam - dt * 1.6);
    P.jaw = Math.max(0, P.jaw - dt * 1.4);
    P.shake = Math.max(0, P.shake - dt * 1.2);
    P.leap = Math.max(0, P.leap - dt * 1.5);
    P.step += Math.hypot(this.x - this.px, this.y - this.py) * 0.05;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('gt_chain', 0.9, 0.7);
    for (let i = 0; i < 70; i++) {
      this.pose.shake = Math.sin((i / 70) * Math.PI);
      this.pose.jaw = Math.max(0, Math.sin((i / 70) * Math.PI * 3)) * 0.8;
      yield 1 / 60;
    }
    this.sfx('gt_doors', 1, 0.6);
    this.g.fx.push('dust', this.x, this.y, 2);
    this.g.fx.push('ring', this.x, this.y, 200, 0, 0, 'shock');
    yield 0.5;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'cases', w: 1.2, fn: () => this.cases(UNCLAIMED.cases) },
      { name: 'umbrellas', w: 1, fn: () => this.umbrellas(UNCLAIMED.fanCount) },
      { name: 'slam', w: 0.8, fn: () => this.slam() },
    ];
    if (phase === 1) return [
      { name: 'avalanche', w: 1.1, fn: () => this.avalanche(3) },
      { name: 'mimics', w: 0.7, fn: () => this.mimics() },
      { name: 'cases', w: 1, fn: () => this.cases(UNCLAIMED.cases + 2) },
      { name: 'umbrellas', w: 0.8, fn: () => this.umbrellas(UNCLAIMED.fanCount + 2) },
      { name: 'slam', w: 0.7, fn: () => this.slam() },
    ];
    return [
      { name: 'claim', w: 1.2, fn: () => this.claim(2) },
      { name: 'tags', w: 1, fn: () => this.tags() },
      { name: 'avalanche', w: 0.9, fn: () => this.avalanche(4) },
      { name: 'cases', w: 0.8, fn: () => this.cases(UNCLAIMED.cases + 4) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.moveSpeed = 104;
      this.banner('EXCESS BAGGAGE', 'Every trunk nobody came back for.');
      this.sfx('gt_chain', 1, 0.6);
    }
    if (phase === 2) {
      this.moveSpeed = 118;
      this.keepDist = 240;
      this.banner('LOST AND FOUND', 'It is looking for its owners.');
      this.sfx('gt_toll', 0.9, 0.9);
    }
    return null;
  }

  /** Suitcases hurled up and over onto marked spots round you, one after another. */
  private *cases(n: number): Co {
    this.anim = 'throw';
    const p = this.target();
    for (let k = 0; k < n; k++) {
      const a = this.g.rng.angle(), d = k === 0 ? 0 : this.g.rng.range(90, 300);
      const c = this.ground(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0);
      this.hz('circle', 'gt_clock_mark', c.x, c.y, { r: UNCLAIMED.caseR, tele: this.tele(0.95 + k * 0.16), active: 0.2, dmg: 16 });
    }
    for (let k = 0; k < n; k++) {
      this.pose.throw = 1;
      this.sfx('gt_chain', 0.5, 1.4);
      yield 0.16;
    }
    yield this.tele(0.95) - 0.1;
    this.sfx('gt_doors', 0.7, 0.8);
    yield 0.35;
  }

  /** A fan of umbrellas flung out like spears. */
  private *umbrellas(n: number): Co {
    this.anim = 'throw';
    const a0 = this.angleToTarget(), spread = 1.25, L = UNCLAIMED.fanLen;
    const t = this.tele(0.85);
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / (n - 1) - 0.5) * spread;
      this.hz('line', 'gt_lantern_beam', this.x, this.y, { x2: this.x + Math.cos(a) * L, y2: this.y + Math.sin(a) * L, r2: 18, len: L, angle: a, tele: t, active: 0.25, dmg: 15 });
    }
    yield* this.windupFor(t, 'throw');
    this.pose.throw = 1;
    this.sfx('gt_whistle', 0.5, 1.6);
    yield 0.45;
  }

  /** The whole heap rears up and comes down: a shockwave round it. */
  private *slam(): Co {
    this.anim = 'slam';
    const t = this.tele(1);
    this.hz('circle', 'gt_clock_mark', this.x, this.y, { r: UNCLAIMED.slamR, tele: t, active: 0.2, dmg: 20 });
    this.noRoam = true;
    yield* this.windupFor(t, 'slam');
    this.pose.slam = 1;
    this.sfx('gt_doors', 1, 0.5);
    this.g.fx.push('dust', this.x, this.y, 2.2);
    this.g.fx.push('shake', this.x, this.y, 0.5);
    this.g.fx.push('ring', this.x, this.y, UNCLAIMED.slamR, 0, 0, 'shock');
    this.noRoam = false;
    yield 0.6;
  }

  /** An avalanche: trunks tumble down lanes across the station, staggered. */
  private *avalanche(n: number): Co {
    this.anim = 'shake';
    this.pose.shake = 1;
    this.sfx('gt_chain', 0.9, 0.8);
    const p = this.target();
    const horiz = this.g.rng.chance(0.5), off = this.g.rng.range(-80, 80);
    const t = this.tele(1.1);
    for (let k = 0; k < n; k++) {
      const o = (k - (n - 1) / 2) * UNCLAIMED.laneGap + off;
      const [a, b] = horiz
        ? [this.ground(p.x - 1400, p.y + o, 0), this.ground(p.x + 1400, p.y + o, 0)]
        : [this.ground(p.x + o, p.y - 900, 0), this.ground(p.x + o, p.y + 900, 0)];
      this.hz('line', 'gt_rail_lane', a.x, a.y, { x2: b.x, y2: b.y, r2: UNCLAIMED.laneHalf, tele: t + k * 0.3, active: 0.35, dmg: 17 });
    }
    yield t + n * 0.3;
    this.sfx('gt_rush', 0.8, 0.7);
    yield 0.4;
  }

  /** Mimics shaken out of the heap. */
  private *mimics(): Co {
    this.anim = 'shake';
    this.pose.shake = 1;
    this.pose.jaw = 1;
    this.sfx('gt_chain', 1, 1.1);
    yield 0.5;
    const n = Math.max(2, Math.round(4 * this.addsMult()));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.g.rng.next();
      this.add(i % 2 ? 'gt_mimic' : 'gt_ticketless', this.x + Math.cos(a) * 180, this.y + Math.sin(a) * 180);
    }
    yield 1;
  }

  /** "Claimed": a mark on one of you, and the heap comes down on it. */
  private *claim(n: number): Co {
    for (let i = 0; i < n; i++) {
      this.anim = 'leap';
      const p = this.target();
      const c = this.ground(p.x, p.y);
      const t = this.tele(1.2);
      this.hz('circle', 'gt_clock_mark', c.x, c.y, { r: UNCLAIMED.claimR, tele: t, active: 0.25, dmg: 24 });
      this.sfx('gt_punch', 0.8, 0.8);
      yield* this.windupFor(t - 0.35, 'leap');
      this.pose.leap = 1;
      yield* this.moveTo(c.x, c.y, Math.max(700, Math.hypot(c.x - this.x, c.y - this.y) / 0.35));
      this.pose.slam = 1;
      this.sfx('gt_doors', 1, 0.45);
      this.g.fx.push('dust', this.x, this.y, 2);
      this.g.fx.push('shake', this.x, this.y, 0.45);
      yield 0.55;
    }
  }

  /** Lost and found: rings of luggage tags roll out, each with one gap. */
  private *tags(): Co {
    this.anim = 'shake';
    for (let i = 0; i < 3; i++) {
      yield* this.windupFor(this.tele(0.4), 'jaw');
      this.pose.jaw = 1;
      const gap = this.angleToTarget() + this.g.rng.range(-1.6, 1.6);
      this.hz('ring', 'gt_whistle_ring', this.x, this.y, { r: UNCLAIMED.ringR, r2: 34, grow: 320, tele: 0.01, active: 1.7, dmg: 15, gapHalf: 0.5, angle: gap });
      this.sfx('gt_chain', 0.7, 1.3);
      yield 0.55;
    }
    yield 0.6;
  }

  protected *defeatSequence(): Co {
    this.sfx('gt_chain', 1, 0.5);
    for (let i = 0; i < 110; i++) {
      this.pose.fall = Math.min(1, i / 80);
      this.pose.shake = 1 - i / 110;
      yield 1 / 60;
    }
    this.sfx('gt_doors', 0.9, 0.4);
    this.g.fx.push('dust', this.x, this.y, 2.4);
    yield 1;
  }
}
