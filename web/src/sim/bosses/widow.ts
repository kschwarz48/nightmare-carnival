// THE GHOST TRAIN, BOSS 3 — THE WIDOW OF SAINT VESPER'S (D-80). She came to meet her husband off the last
// train in 1899 and has met every train since: a tall figure in mourning black that never fades, a veil
// that moves without wind, a lantern of pale souls. She floats; the dead rise for her.
// P1 The Vigil: her wail (rings with a gap), the soul lantern's slow lights, the veil swept across the ground.
// P2 The Wake: the graveyard's dead rise round you, a cross of white lilies.
// P3 The Procession: coffin lanes marching across the station in step, a storm of wails.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { GhostTrainBoss } from './gtBoss';

/** Tuning the tests read. */
export const WIDOW = { veilR: 440, veilHalf: 0.9, souls: 7, lilyR: 74, lilyStep: 150, laneHalf: 58, laneGap: 175 };

export class WidowBoss extends GhostTrainBoss {
  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.moveSpeed = 90;
    this.keepDist = 360;
    this.pose = { veil: 0, wail: 0, raise: 0, lantern: 0, float: 0, fall: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.wail = Math.max(0, P.wail - dt * 1.4);
    P.raise = Math.max(0, P.raise - dt * 0.9);
    P.veil = Math.max(0, P.veil - dt * 1.6);
    P.lantern = Math.max(0, P.lantern - dt * 1.2);
    P.float += dt;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('gt_toll', 1, 0.8);
    for (let i = 0; i < 90; i++) {
      this.pose.raise = Math.sin((i / 90) * Math.PI);
      yield 1 / 60;
    }
    this.pose.wail = 1;
    this.sfx('ghostgasp', 1, 0.7);
    this.g.fx.push('ring', this.x, this.y, 200, 0, 0, 'gravity');
    yield 0.5;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'wail', w: 1.1, fn: () => this.wail(2) },
      { name: 'souls', w: 1, fn: () => this.souls(2) },
      { name: 'veil', w: 1, fn: () => this.veil() },
    ];
    if (phase === 1) return [
      { name: 'rise', w: 0.8, fn: () => this.rise() },
      { name: 'lilies', w: 1.1, fn: () => this.lilies() },
      { name: 'wail', w: 0.9, fn: () => this.wail(3) },
      { name: 'souls', w: 0.8, fn: () => this.souls(3) },
      { name: 'veil', w: 0.8, fn: () => this.veil() },
    ];
    return [
      { name: 'procession', w: 1.2, fn: () => this.procession() },
      { name: 'storm', w: 1, fn: () => this.wail(4, 0.3) },
      { name: 'lilies', w: 0.9, fn: () => this.lilies() },
      { name: 'rise', w: 0.6, fn: () => this.rise() },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.moveSpeed = 100;
      this.banner('THE WAKE', 'The graveyard has come to pay its respects.');
      this.sfx('gt_toll', 1, 0.7);
    }
    if (phase === 2) {
      this.moveSpeed = 115;
      this.keepDist = 300;
      this.banner('THE PROCESSION', 'Walk slowly. The dead do.');
      this.sfx('gt_toll', 1, 0.55);
    }
    return null;
  }

  /** Her wail: rings rolling out of her, each with a gap. */
  private *wail(n: number, gapBetween = 0.5): Co {
    this.anim = 'wail';
    for (let i = 0; i < n; i++) {
      yield* this.windupFor(this.tele(0.4), 'wail');
      this.pose.wail = 1;
      const gap = this.angleToTarget() + this.g.rng.range(-1.7, 1.7);
      this.hz('ring', 'gt_wail', this.x, this.y, { r: 60, r2: 36, grow: 290, tele: 0.01, active: 2, dmg: 16, gapHalf: 0.48, angle: gap });
      this.sfx('mourn', 0.8, 0.9 + i * 0.06);
      yield gapBetween;
    }
    yield 0.6;
  }

  /** The soul lantern: pale lights drift out toward you, slowly turning in. */
  private *souls(n: number): Co {
    this.anim = 'lantern';
    for (let k = 0; k < n; k++) {
      yield* this.windupFor(this.tele(0.5), 'lantern');
      const a = this.angleToTarget();
      for (let i = 0; i < WIDOW.souls; i++) {
        const ang = a + (i - (WIDOW.souls - 1) / 2) * 0.22;
        const b = this.bullet('spark', this.x, this.y - 30, ang, 190, 12, { r: 11, life: 4.5 });
        if (b) b.homing = 0.9;
      }
      this.sfx('ghostgasp', 0.6, 1.3);
      yield 0.55;
    }
  }

  /** The veil swept over the ground: left, then right. */
  private *veil(): Co {
    this.anim = 'veil';
    const a = this.angleToTarget();
    for (const side of [-1, 1]) {
      const t = this.tele(0.8);
      this.hz('sector', 'gt_veil', this.x, this.y, { r: WIDOW.veilR, angle: a + side * 0.55, half: WIDOW.veilHalf * 0.6, tele: t, active: 0.35, dmg: 17 });
      yield* this.windupFor(t, 'veil');
      this.pose.veil = 1;
      this.sfx('whoosh', 0.8, 0.8);
      yield 0.25;
    }
    yield 0.4;
  }

  /** The dead rise for her, round whoever stands nearest. */
  private *rise(): Co {
    this.anim = 'raise';
    yield* this.windupFor(0.7, 'raise');
    this.sfx('gt_toll', 0.8, 0.9);
    const p = this.target();
    const n = Math.round(6 * this.addsMult());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.g.rng.next() * 0.5, r = this.g.rng.range(170, 260);
      this.add('gt_gravebound', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    if (this.phase >= 1) this.add('gt_mourner', p.x + this.g.rng.range(-300, 300), p.y + 320);
    yield 1.1;
  }

  /** A cross of white lilies laid round you; each bursts in turn, outward from the middle. */
  private *lilies(): Co {
    this.anim = 'raise';
    this.pose.raise = 1;
    const p = this.target();
    const diag = this.g.rng.chance(0.5) ? Math.PI / 4 : 0;
    this.hz('circle', 'gt_lily', p.x, p.y, { r: WIDOW.lilyR, tele: this.tele(0.85), active: 0.15, dmg: 15 });
    for (let k = 1; k <= 4; k++) {
      for (let arm = 0; arm < 4; arm++) {
        const a = diag + (arm * Math.PI) / 2;
        const c = this.ground(p.x + Math.cos(a) * k * WIDOW.lilyStep, p.y + Math.sin(a) * k * WIDOW.lilyStep, 0);
        this.hz('circle', 'gt_lily', c.x, c.y, { r: WIDOW.lilyR, tele: this.tele(0.85 + k * 0.2), active: 0.15, dmg: 15 });
      }
    }
    this.sfx('glint', 0.6, 0.8);
    yield this.tele(0.85 + 4 * 0.2) + 0.3;
  }

  /** The procession: lanes of pallbearers cross the station in step, one after another. */
  private *procession(): Co {
    this.anim = 'raise';
    this.pose.raise = 1;
    this.sfx('gt_toll', 1, 0.6);
    const p = this.target();
    const horiz = this.g.rng.chance(0.5);
    const dir = this.g.rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < 5; k++) {
      const o = dir * (k - 2) * WIDOW.laneGap;
      const [ax, ay, bx, by] = horiz ? [p.x - 1300, p.y + o, p.x + 1300, p.y + o] : [p.x + o, p.y - 900, p.x + o, p.y + 900];
      const a = this.ground(ax, ay, 0), b = this.ground(bx, by, 0);
      this.hz('line', 'gt_coffin_lane', a.x, a.y, { x2: b.x, y2: b.y, r2: WIDOW.laneHalf, tele: this.tele(1.1 + k * 0.45), active: 0.3, dmg: 18 });
    }
    yield this.tele(1.1 + 4 * 0.45) + 0.4;
  }

  protected *defeatSequence(): Co {
    this.sfx('ghostgasp', 1, 0.6);
    for (let i = 0; i < 130; i++) {
      this.pose.fall = Math.min(1, i / 110);
      this.pose.veil = Math.min(1, i / 60);
      yield 1 / 60;
    }
    this.g.fx.push('ring', this.x, this.y, 260, 0, 0, 'gravity');
    yield 1;
  }
}
