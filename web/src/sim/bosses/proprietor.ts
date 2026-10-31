// THE FUN HOUSE, FINAL BOSS — THE PROPRIETOR (D-63). Professor Ignatius Grinwell, who built the house
// in 1931 and never left it.
// P1 The Illusionist: vanishes and reappears (telegraphed), fans of ADMIT ONE tickets, the sawing trick
//    (crossed blades through where you stand), a cabinet of reflection thieves.
// P2 The House Itself: pistons punch up in a spiral round you, laughter rolls out in gapped rings,
//    mirror walls box you in with one way out.
// P3 The Grin: his smile splits his face; he bites in telegraphed arcs and sweeps a grin-beam round.
// Defeating him while someone carries Mira's Reflection (the Unreflected) shatters the house instead of
// ending the night: see sim/quest/unreflected.ts.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { FunhouseBoss } from './fhBoss';

/** Tuning the tests read. */
export const PROPRIETOR = { saw: 1100, pistons: 10, laughGap: 0.5, boxHalf: 260, chompR: 340 };

export class ProprietorBoss extends FunhouseBoss {
  /** 0..1 how far he has vanished (drawing; he can't be hit while gone) */
  gone = 0;

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.arriveNear(440);
    this.moveSpeed = 115;
    this.keepDist = 340;
    this.pose = { bow: 0, cane: 0, hat: 0, grin: 0, chomp: 0, laugh: 0, crack: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.cane = Math.max(0, P.cane - dt * 2);
    P.chomp = Math.max(0, P.chomp - dt * 3);
    P.laugh = Math.max(0, P.laugh - dt);
    P.bow = Math.max(0, P.bow - dt);
  }

  protected damageTakenMult(): number {
    return this.gone > 0.5 ? 0 : 1;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('drumroll', 1);
    this.gone = 1;
    for (let i = 0; i < 60; i++) {
      this.gone = 1 - i / 60;
      yield 1 / 60;
    }
    this.gone = 0;
    this.g.fx.push('dust', this.x, this.y, 1.4);
    for (let i = 0; i < 60; i++) {
      this.pose.bow = Math.sin((i / 60) * Math.PI);
      this.pose.hat = this.pose.bow;
      yield 1 / 60;
    }
    this.sfx('laugh', 1);
    yield 0.4;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'vanish', w: 1, fn: () => this.vanish() },
      { name: 'cards', w: 1.2, fn: () => this.cardFan(3) },
      { name: 'saw', w: 1, fn: () => this.sawTrick(2) },
      { name: 'cabinet', w: 0.7, fn: () => this.cabinet() },
    ];
    if (phase === 1) return [
      { name: 'pistons', w: 1.1, fn: () => this.pistons() },
      { name: 'laughter', w: 1, fn: () => this.laughter() },
      { name: 'box', w: 0.9, fn: () => this.mirrorBox() },
      { name: 'vanish', w: 0.7, fn: () => this.vanish() },
      { name: 'cards', w: 0.6, fn: () => this.cardFan(2) },
    ];
    return [
      { name: 'chomp', w: 1.2, fn: () => this.chomp(3) },
      { name: 'beam', w: 1, fn: () => this.grinBeam() },
      { name: 'laughter', w: 0.8, fn: () => this.laughter() },
      { name: 'saw', w: 0.7, fn: () => this.sawTrick(3) },
      { name: 'vanish', w: 0.6, fn: () => this.vanish() },
    ];
  }

  protected onPhase(phase: number): Co | null {
    this.gone = 0;
    if (phase === 1) {
      this.banner('THE HOUSE ITSELF', 'The floor, the walls, the laughter: all his');
      this.sfx('rumble', 1);
      this.g.fx.push('shake', this.x, this.y, 0.8);
    }
    if (phase === 2) {
      this.pose.grin = 1;
      this.moveSpeed = 150;
      this.keepDist = 260;
      this.banner('THE GRIN', 'It goes from ear to ear');
      this.sfx('laugh', 1, 0.7);
    }
    return null;
  }

  /** Smoke: he's gone; a telegraphed ring marks where he'll step out (and what that does to whoever is there). */
  private *vanish(): Co {
    const g = this.g;
    this.anim = 'vanish';
    this.sfx('poof', 1);
    g.fx.push('dust', this.x, this.y, 1.5);
    for (let i = 0; i < 20; i++) {
      this.gone = (i + 1) / 20;
      yield 1 / 60;
    }
    const p = this.target();
    const a = g.rng.angle();
    const c = this.inside(p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 200);
    const t = this.tele(0.85);
    this.hz('circle', 'stomp', c.x, c.y, { r: 110, tele: t, active: 0.15, dmg: 22 });
    yield t;
    this.x = this.px = c.x;
    this.y = this.py = c.y;
    g.fx.push('dust', c.x, c.y, 1.5);
    this.sfx('poof', 1, 0.8);
    this.hz('ring', 'shockwave', c.x, c.y, { r: 110, r2: 96, grow: 220, active: 1.2, dmg: 12, gapHalf: 0.55, angle: g.rng.angle(), tele: 0.05 });
    for (let i = 0; i < 15; i++) {
      this.gone = 1 - (i + 1) / 15;
      yield 1 / 60;
    }
    this.gone = 0;
    this.pose.bow = 1;
    yield 0.35;
  }

  /** Fans of ADMIT ONE tickets flicked from his fingers. */
  private *cardFan(volleys: number): Co {
    this.anim = 'cards';
    for (let v = 0; v < volleys; v++) {
      this.windup = 1;
      this.pose.cane = 1;
      yield this.tele(0.45);
      this.windup = 0;
      const base = this.angleToTarget(this.x, this.y - 40);
      const n = 9;
      for (let i = 0; i < n; i++) this.bullet('ticket', this.x, this.y - 40, base + (i / (n - 1) - 0.5) * 1.0, 280 + (i % 2) * 40, 13, { r: 9, life: 4, spin: 7 });
      this.sfx('card', 0.7);
      yield 0.4;
    }
  }

  /** The sawing trick: crossed blades through where the target stands (then turned 45 degrees). */
  private *sawTrick(n: number): Co {
    this.anim = 'saw';
    for (let k = 0; k < n; k++) {
      const p = this.target();
      const off = (k * Math.PI) / 4 + this.g.rng.range(-0.15, 0.15);
      const t = this.tele(1.0);
      for (const a of [off, off + Math.PI / 2]) {
        const dx = Math.cos(a) * PROPRIETOR.saw / 2, dy = Math.sin(a) * PROPRIETOR.saw / 2;
        this.hz('line', 'saw', p.x - dx, p.y - dy, { x2: p.x + dx, y2: p.y + dy, r2: 18, tele: t, active: 0.4, dmg: 22 });
      }
      this.pose.cane = 1;
      this.sfx('chachunk', 0.8);
      yield t + 0.35;
    }
  }

  /** A cabinet wheeled out beside him: one reflection thief and its mannequins. */
  private *cabinet(): Co {
    const g = this.g;
    this.anim = 'cabinet';
    this.windup = 1;
    this.sfx('drumroll', 0.8);
    yield this.tele(0.8);
    this.windup = 0;
    const n = Math.round(3 * this.addsMult());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const c = this.inside(this.x + Math.cos(a) * 120, this.y + Math.sin(a) * 120);
      g.spawnEnemy(i === 0 ? 'reflection_thief' : 'grinning_mannequin', c.x, c.y);
      g.fx.push('dust', c.x, c.y, 0.8);
    }
    this.sfx('poof', 0.9);
    yield 0.5;
  }

  /** Pistons punch up out of the floor in a spiral that closes on the target. */
  private *pistons(): Co {
    const g = this.g;
    this.anim = 'conduct';
    const p = this.target();
    const off = g.rng.angle();
    const t0 = this.tele(1.0);
    for (let i = 0; i < PROPRIETOR.pistons; i++) {
      const a = off + i * 0.9;
      const r = 380 - i * 34;
      const c = this.inside(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      this.hz('circle', 'stomp', c.x, c.y, { r: 62, tele: t0 + i * 0.12, active: 0.15, dmg: 20, onActivate: () => {
        g.fx.push('dust', c.x, c.y, 0.7);
        this.sfx('slam', 0.5, 1.2);
      } });
    }
    this.pose.cane = 1;
    yield t0 + PROPRIETOR.pistons * 0.12 + 0.4;
  }

  /** The house laughs: three rings roll out of him, each with a gap that turns. */
  private *laughter(): Co {
    const g = this.g;
    this.anim = 'laugh';
    this.pose.laugh = 1;
    this.sfx('laugh', 1, 0.8);
    this.windup = 1;
    yield this.tele(0.6);
    this.windup = 0;
    const a0 = this.angleToTarget();
    for (let k = 0; k < 3; k++) {
      this.hz('ring', 'shockwave', this.x, this.y, { r: 60, r2: 44, grow: 230, active: 3.4, dmg: 16, gapHalf: PROPRIETOR.laughGap, angle: a0 + Math.PI + (k - 1) * 0.9, tele: 0.05 });
      this.sfx('laugh', 0.6, 1 + k * 0.15);
      yield 0.55;
    }
    yield 0.4;
  }

  /** Mirror walls box the target in, one side open (telegraphed); then he fires tickets into the box. */
  private *mirrorBox(): Co {
    const g = this.g;
    this.anim = 'box';
    const p = this.target();
    const H = PROPRIETOR.boxHalf;
    const open = g.rng.int(0, 3);
    const t = this.tele(1.2);
    const sides: [number, number, number, number][] = [[-H, -H, H, -H], [H, -H, H, H], [H, H, -H, H], [-H, H, -H, -H]];
    sides.forEach((s, i) => {
      if (i === open) return;
      this.hz('line', 'mirror_wall', p.x + s[0], p.y + s[1], { x2: p.x + s[2], y2: p.y + s[3], r2: 14, tele: t, active: 2.4, dmg: 18, tick: 0.5 });
    });
    this.sfx('mirror', 1);
    yield t;
    for (let v = 0; v < 2; v++) {
      const base = Math.atan2(p.y - this.y, p.x - this.x);
      for (let i = 0; i < 7; i++) this.bullet('ticket', this.x, this.y - 40, base + (i / 6 - 0.5) * 0.7, 300, 12, { r: 9, life: 4, spin: 7 });
      this.sfx('card', 0.6);
      yield 0.5;
    }
    yield 1.0;
  }

  /** The grin bites: a telegraphed arc toward the target, again and again. */
  private *chomp(n: number): Co {
    this.anim = 'chomp';
    for (let k = 0; k < n; k++) {
      const a = this.angleToTarget();
      const t = this.tele(k === 0 ? 0.9 : 0.7);
      this.hz('sector', 'bite', this.x, this.y, { r: PROPRIETOR.chompR, r2: 30, angle: a, half: 0.6, tele: t, active: 0.2, dmg: 30 });
      this.windup = 1;
      yield t;
      this.windup = 0;
      this.pose.chomp = 1;
      this.sfx('bite', 1);
      this.g.fx.push('shake', this.x, this.y, 0.35);
      // he lunges a little after each bite
      const c = this.inside(this.x + Math.cos(a) * 110, this.y + Math.sin(a) * 110);
      yield* this.moveTo(c.x, c.y, 600);
      yield 0.2;
    }
  }

  /** A beam from the grin sweeps round, starting from a telegraphed line. */
  private *grinBeam(): Co {
    this.anim = 'beam';
    const a = this.angleToTarget() - 1.2;
    const dir = this.g.rng.next() < 0.5 ? 1 : -1;
    const t = this.tele(1.1);
    this.hz('line', 'beam', this.x, this.y - 40, { len: 950, r2: 26, angle: dir > 0 ? a : a + 2.4, spinRate: 1.0 * dir, tele: t, active: 2.4, dmg: 18, tick: 0.4 });
    this.windup = 1;
    this.sfx('laser', 1);
    this.noRoam = true;
    yield t + 2.4;
    this.noRoam = false;
    this.windup = 0;
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    this.gone = 0;
    for (let i = 0; i < 160; i++) {
      this.pose.crack = Math.min(1, i / 120);
      if (i % 18 === 0) {
        g.fx.push('spark', this.x + g.rng.range(-40, 40), this.y - 90, 1, 0, 0, 'shock');
        this.sfx('laugh', 0.5, 0.6 + (i / 160) * 0.3);
      }
      yield 1 / 60;
    }
    this.sfx('shatter', 1);
    g.fx.push('boss_death', this.x, this.y, 1, 0, 0, 'proprietor');
    yield 0.3;
  }
}
