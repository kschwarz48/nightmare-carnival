// THE FUN HOUSE, BOSS 3 — THE STRINGMISTRESS (D-63). A long-fingered puppeteer hanging from the dark
// above the house on her own strings (so walls never stop her), lowering marionettes like bait.
// P1 The Cradle: a cat's cradle of strings drawn across the floor (find the gap), marionettes dropped
//    on telegraphed landings, needles.
// P2 The Web: turning spokes of string round her; she hooks whoever is nearest with a telegraphed line
//    and reels them in toward a bite (run against it).
// P3 Cut Loose: she cuts herself down and skitters, trailing strings, stabbing with her legs, and her
//    snapped strings whip outward.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { FunhouseBoss } from './fhBoss';

/** Tuning the tests read. */
export const STRINGS = { cradleR: 460, spokes: 8, spokeLen: 640, reel: 150, stabR: 52 };

export class StringmistressBoss extends FunhouseBoss {
  /** 1 = up in the flies, 0 = on the floor (drawing height) */
  hang = 1;
  /** the reel's line: from her to whoever she hooked (drawing), 0 when none */
  reelX = 0;
  reelY = 0;
  reeling = 0;

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.arriveNear(430);
    this.moveSpeed = 110;
    this.keepDist = 360;
    this.pose = { descend: 1, weave: 0, legs: 0, stab: 0, fall: 0, hum: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.weave = Math.max(0, P.weave - dt * 1.5);
    P.stab = Math.max(0, P.stab - dt * 4);
    P.legs += dt * (this.hang < 0.5 ? 9 : 2);
    P.hum += dt;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('hum', 0.9);
    for (let i = 0; i < 140; i++) {
      this.pose.descend = 1 - i / 140;
      yield 1 / 60;
    }
    this.pose.descend = 0;
    this.sfx('twang', 1);
    this.g.fx.push('shake', this.x, this.y, 0.3);
    yield 0.4;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'cradle', w: 1.2, fn: () => this.cradle(5) },
      { name: 'drop', w: 0.9, fn: () => this.puppetDrop(4) },
      { name: 'needles', w: 1, fn: () => this.needles(3) },
    ];
    if (phase === 1) return [
      { name: 'web', w: 1.1, fn: () => this.web() },
      { name: 'reel', w: 1, fn: () => this.reel() },
      { name: 'cradle', w: 0.9, fn: () => this.cradle(7) },
      { name: 'drop', w: 0.5, fn: () => this.puppetDrop(5) },
    ];
    return [
      { name: 'skitter', w: 1.1, fn: () => this.skitter() },
      { name: 'stab', w: 1, fn: () => this.legStab() },
      { name: 'snap', w: 0.9, fn: () => this.snapStrings() },
      { name: 'needles', w: 0.6, fn: () => this.needles(5) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    this.reeling = 0;
    if (phase === 1) this.banner('THE WEB', 'Stay clear of her line');
    if (phase === 2) return this.cutLoose();
    return null;
  }

  private *cutLoose(): Co {
    const g = this.g;
    this.banner('CUT LOOSE', 'She drops to the floor');
    this.sfx('snap', 1);
    for (let i = 0; i < 40; i++) {
      this.hang = 1 - i / 40;
      yield 1 / 60;
    }
    this.hang = 0;
    g.fx.push('shake', this.x, this.y, 0.6);
    g.fx.push('dust', this.x, this.y, 1.6);
    this.sfx('slam', 1);
    this.moveSpeed = 190;
    this.keepDist = 220;
  }

  /** Strings drawn as chords across a circle round the target: find the gap before they tighten. */
  private *cradle(n: number): Co {
    const g = this.g;
    this.anim = 'weave';
    this.pose.weave = 1;
    const p = this.target();
    const cx = p.x, cy = p.y, R = STRINGS.cradleR;
    const t = this.tele(1.2);
    const off = g.rng.angle();
    for (let i = 0; i < n; i++) {
      // chords that pass near (never exactly through) the centre, so there is always a pocket
      const a0 = off + (i / n) * Math.PI + g.rng.range(-0.15, 0.15);
      const a1 = a0 + Math.PI * g.rng.range(0.55, 0.8);
      this.hz('line', 'string_sweep', cx + Math.cos(a0) * R, cy + Math.sin(a0) * R, { x2: cx + Math.cos(a1) * R, y2: cy + Math.sin(a1) * R, r2: 9, tele: t, active: 1.2, dmg: 18 });
    }
    this.sfx('twang', 0.8);
    yield t + 1.3;
  }

  /** Marionettes lowered on strings: each lands on a telegraphed circle. */
  private *puppetDrop(n: number): Co {
    const g = this.g;
    this.anim = 'drop';
    const p = this.target();
    const t = this.tele(0.9);
    const k = Math.round(n * this.addsMult());
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU + g.rng.range(-0.3, 0.3);
      const c = this.inside(p.x + Math.cos(a) * g.rng.range(150, 260), p.y + Math.sin(a) * g.rng.range(150, 260));
      this.hz('circle', 'stomp', c.x, c.y, {
        r: 46, tele: t, active: 0.12, dmg: 12,
        onActivate: () => {
          g.spawnEnemy('marionette', c.x, c.y);
          g.fx.push('dust', c.x, c.y, 0.8);
        },
      });
    }
    this.sfx('clack', 0.8);
    yield t + 0.4;
  }

  /** Needles, aimed ahead of whoever is nearest. */
  private *needles(n: number): Co {
    this.anim = 'needle';
    for (let i = 0; i < n; i++) {
      const p = this.target();
      this.windup = 1;
      yield this.tele(0.32);
      this.windup = 0;
      const lead = 0.35;
      const a = Math.atan2(p.y + p.vy * lead - this.y, p.x + p.vx * lead - this.x);
      for (const s of [-0.08, 0, 0.08]) this.bullet('pin', this.x, this.y - 30, a + s, 380, 13, { r: 8, life: 3, spin: 0 });
      this.sfx('dart', 0.6);
      yield 0.18;
    }
  }

  /** Spokes of string turning round her: walk with the gaps. */
  private *web(): Co {
    this.anim = 'web';
    this.pose.weave = 1;
    const off = this.g.rng.angle();
    const dir = this.g.rng.next() < 0.5 ? 1 : -1;
    const t = this.tele(1.1);
    for (let i = 0; i < STRINGS.spokes; i++) {
      this.hz('line', 'string_sweep', this.x, this.y, { len: STRINGS.spokeLen, r2: 9, angle: off + (i * TAU) / STRINGS.spokes, spinRate: 0.45 * dir, tele: t, active: 3.4, dmg: 16, tick: 0.5 });
    }
    this.sfx('twang', 0.9);
    this.noRoam = true;
    yield t + 3.4;
    this.noRoam = false;
  }

  /** A telegraphed line hooks whoever is nearest; then a pull toward her while a bite winds up. */
  private *reel(): Co {
    const g = this.g;
    this.anim = 'reel';
    const p = this.target();
    const t = this.tele(0.9);
    this.hz('line', 'lane', this.x, this.y, { x2: p.x, y2: p.y, r2: 12, tele: t, active: 0.01, dmg: 0 });
    this.sfx('twang', 1);
    yield t;
    // the hook lands if they are still near the line's end; the reel always pulls, so the bite stays readable
    this.reeling = 1;
    this.reelX = p.x;
    this.reelY = p.y;
    const reach = Math.hypot(p.x - this.x, p.y - this.y) + 120;
    const pull = this.hz('circle', 'reel', this.x, this.y, { r: 10, tele: 0.01, active: 1.6, dmg: 0, pull: STRINGS.reel, pullR: reach });
    const bite = this.tele(1.3);
    this.hz('circle', 'stomp', this.x, this.y, { r: 130, tele: bite, active: 0.2, dmg: 26, onActivate: () => this.sfx('bite', 1) });
    for (let i = Math.round(bite * 60); i > 0; i--) {
      const q = this.target();
      this.reelX = q.x;
      this.reelY = q.y;
      pull.x = this.x;
      pull.y = this.y;
      yield 1 / 60;
    }
    this.reeling = 0;
    pull.alive = false;
    void g;
    yield 0.5;
  }

  /** Down on the floor: three dashes, each leaving a string strung between where she was and is. */
  private *skitter(): Co {
    const g = this.g;
    this.anim = 'skitter';
    for (let k = 0; k < 3; k++) {
      const p = this.target();
      const a = Math.atan2(p.y - this.y, p.x - this.x) + g.rng.range(-0.6, 0.6);
      const c = this.inside(p.x + Math.cos(a + Math.PI / 2) * 220, p.y + Math.sin(a + Math.PI / 2) * 220);
      const t = this.tele(0.55);
      this.hz('line', 'lane', this.x, this.y, { x2: c.x, y2: c.y, r2: 40, tele: t, active: 0.01, dmg: 0 });
      yield t;
      const x0 = this.x, y0 = this.y;
      yield* this.moveTo(c.x, c.y, 900);
      this.hz('line', 'string_sweep', x0, y0, { x2: c.x, y2: c.y, r2: 8, tele: 0.3, active: 2.4, dmg: 12, tick: 0.5 });
      this.sfx('twang', 0.6);
      yield 0.2;
    }
    yield 0.4;
  }

  /** Eight leg stabs round her, one after another. */
  private *legStab(): Co {
    const g = this.g;
    this.anim = 'stab';
    const off = g.rng.angle();
    const t = this.tele(0.8);
    for (let i = 0; i < 8; i++) {
      const a = off + (i / 8) * TAU;
      const x = this.x + Math.cos(a) * 150, y = this.y + Math.sin(a) * 150;
      this.hz('circle', 'stomp', x, y, { r: STRINGS.stabR, tele: t + i * 0.09, active: 0.12, dmg: 20, onActivate: () => {
        this.pose.stab = 1;
        g.fx.push('dust', x, y, 0.5);
        this.sfx('stomp', 0.5, 1.4);
      } });
    }
    // and one under whoever is nearest
    const p = this.target();
    this.hz('circle', 'stomp', p.x, p.y, { r: 70, tele: t + 0.4, active: 0.12, dmg: 22 });
    yield t + 1.2;
  }

  /** Her snapped strings whip outward: six telegraphed lashes in turn. */
  private *snapStrings(): Co {
    const off = this.g.rng.angle();
    this.anim = 'snap';
    for (let i = 0; i < 6; i++) {
      const a = off + i * 2.2;
      const t = this.tele(0.7);
      this.hz('sector', 'lash', this.x, this.y, { r: 520, r2: 30, angle: a, half: 0.2, tele: t, active: 0.22, dmg: 20 });
      this.sfx('whipcrack', 0.7);
      yield 0.28;
    }
    yield this.tele(0.7);
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    for (let i = 0; i < 130; i++) {
      this.pose.fall = Math.min(1, i / 100);
      this.hang = Math.max(0, this.hang - 1 / 60);
      if (i % 16 === 0) {
        this.sfx('snap', 0.6, 0.8 + g.rng.next() * 0.5);
        g.fx.push('spark', this.x + g.rng.range(-90, 90), this.y - 80, 0.8, 0, 0, 'shock');
      }
      yield 1 / 60;
    }
    g.fx.push('boss_death', this.x, this.y, 1, 0, 0, 'strings');
    this.sfx('crash', 0.9);
    yield 0.3;
  }
}
