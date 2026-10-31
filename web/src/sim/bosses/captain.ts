// THE BOARDWALK, BOSS 2 — THE DROWNED CAPTAIN (D-68). Captain Josiah Harrow of the Gala Queen, the
// excursion steamer that left the pier at 11:59 one night in 1933 and never came back. He comes up out
// of the surf (or up through the boards, if you're nowhere near it), and his ship stands offshore.
// P1 Making Landfall: the anchor on its chain (thrown out, hauled back), cutlass slashes, the crew rising.
// P2 The Ghost Fleet: the Gala Queen's broadsides from the sea; he dives and comes up under you.
// P3 Davy Jones: the sea rears up and rolls across the stage with two gaps in it; a whirlpool.

import { TAU } from '../../core/math';
import { shoreY, waterDepth } from '../../data/boardwalk';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { BoardwalkBoss } from './bwBoss';

/** Tuning the tests read. */
export const CAPTAIN = { stage: 760, anchorLen: 560, shells: 7, shellGap: 120, waveGap: 200, waveSpeed: 330, poolR: 430, offshore: 820 };

export class DrownedCaptainBoss extends BoardwalkBoss {
  /** the Gala Queen, standing offshore, and how lit she is (0 dark .. 1 every porthole burning) */
  shipX = 0;
  shipY = 0;
  ship = 0;
  /** a broadside's muzzle flash (decays) */
  shipFire = 0;
  /** 0 standing .. 1 gone under (can't be hit past halfway) */
  dive = 1;
  /** the anchor: out (0..1 along its throw) and where it is */
  anchor = 0;
  anchorX = 0;
  anchorY = 0;

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.seaBorn = true;
    const p = this.target(0, 0);
    if (waterDepth(p.x, p.y) > -520) {
      // near the sea: he comes up out of the surf, between you and the ship
      const x = p.x + g.rng.range(-180, 180);
      this.x = this.px = x;
      this.y = this.py = Math.max(p.y + 260, shoreY(x) + 40);
    } else this.arriveNear(420);
    this.shipX = p.x;
    this.shipY = shoreY(p.x) + CAPTAIN.offshore;
    this.moveSpeed = 110;
    this.keepDist = 300;
    this.pose = { slash: 0, throw: 0, whistle: 0, salute: 0, lean: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.slash = Math.max(0, P.slash - dt * 3);
    P.throw = Math.max(0, P.throw - dt * 2);
    P.whistle = Math.max(0, P.whistle - dt * 1.2);
    this.shipFire = Math.max(0, this.shipFire - dt * 2.5);
    // the ship keeps station off whichever stretch of shore he's fighting on
    const want = this.ringR > 0 ? this.ringX : this.x;
    this.shipX += (want - this.shipX) * Math.min(1, dt * 0.15);
    this.shipY = shoreY(this.shipX) + CAPTAIN.offshore;
    if (this.anchor <= 0) {
      this.anchorX = this.x;
      this.anchorY = this.y;
    }
  }

  protected damageTakenMult(): number {
    return this.dive > 0.5 ? 0 : 1;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.stageRound(CAPTAIN.stage);
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('toll', 1);
    for (let i = 0; i < 60; i++) {
      this.ship = i / 60;
      yield 1 / 60;
    }
    this.ship = 1;
    this.sfx('splash', 1);
    for (let i = 0; i < 80; i++) {
      this.dive = 1 - i / 80;
      if (i % 10 === 0) this.g.fx.push('spark', this.x, this.y, 5, 0, 0, 'splash');
      yield 1 / 60;
    }
    this.dive = 0;
    this.pose.salute = 1;
    yield 0.6;
    this.pose.salute = 0;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'anchor', w: 1.2, fn: () => this.anchorThrow() },
      { name: 'cutlass', w: 1, fn: () => this.cutlass(3) },
      { name: 'crew', w: 0.7, fn: () => this.crew(4) },
    ];
    if (phase === 1) return [
      { name: 'broadside', w: 1.2, fn: () => this.broadside(3) },
      { name: 'dive', w: 1, fn: () => this.diveUnder() },
      { name: 'anchor', w: 0.8, fn: () => this.anchorThrow() },
      { name: 'crew', w: 0.6, fn: () => this.crew(5) },
    ];
    return [
      { name: 'tidal', w: 1.1, fn: () => this.tidal() },
      { name: 'whirlpool', w: 1, fn: () => this.whirlpool() },
      { name: 'broadside', w: 0.9, fn: () => this.broadside(4) },
      { name: 'dive', w: 0.7, fn: () => this.diveUnder() },
      { name: 'cutlass', w: 0.6, fn: () => this.cutlass(4) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    this.dive = 0;
    if (phase === 1) {
      this.banner('THE GHOST FLEET', 'Her guns still work');
      this.sfx('toll', 1);
    }
    if (phase === 2) {
      this.moveSpeed = 130;
      this.banner('DAVY JONES', 'The sea comes up the beach for him');
      this.sfx('surge', 1);
    }
    return null;
  }

  private *windupFor(t: number, key: string): Co {
    const n = Math.max(1, Math.round(t * 60));
    for (let i = 0; i < n; i++) {
      this.windup = (i + 1) / n;
      this.pose[key] = this.windup;
      yield 1 / 60;
    }
    this.windup = 0;
  }

  /** The anchor: hurled out on its chain, and hauled back in across the ground. */
  private *anchorThrow(): Co {
    const a = this.angleToTarget(), L = Math.min(CAPTAIN.anchorLen, this.distToTarget() + 220);
    const ex = this.x + Math.cos(a) * L, ey = this.y + Math.sin(a) * L;
    const t = this.tele(0.8);
    this.anim = 'anchor';
    this.face = Math.cos(a) > 0 ? 1 : -1;
    this.hz('line', 'anchor', this.x, this.y, { x2: ex, y2: ey, r2: 34, tele: t, active: 0.18, dmg: 22 });
    yield* this.windupFor(t, 'throw');
    this.sfx('whoosh', 1);
    const x0 = this.x, y0 = this.y;
    for (let i = 1; i <= 11; i++) {
      this.anchor = i / 11;
      this.anchorX = x0 + (ex - x0) * this.anchor;
      this.anchorY = y0 + (ey - y0) * this.anchor;
      yield 1 / 60;
    }
    this.sfx('crash', 0.9);
    this.g.fx.push('dust', ex, ey, 1);
    this.g.fx.push('shake', ex, ey, 0.25);
    yield 0.35;
    const back = this.tele(0.35);
    this.hz('line', 'anchor', ex, ey, { x2: this.x, y2: this.y, r2: 26, tele: back, active: 0.5, dmg: 14 });
    yield back;
    this.sfx('grind', 0.7);
    for (let i = 1; i <= 30; i++) {
      const k = i / 30;
      this.anchorX = ex + (this.x - ex) * k;
      this.anchorY = ey + (this.y - ey) * k;
      yield 1 / 60;
    }
    this.anchor = 0;
  }

  /** The cutlass: a run of slashes, stepping in. */
  private *cutlass(n: number): Co {
    this.anim = 'slash';
    for (let i = 0; i < n; i++) {
      const a = this.angleToTarget();
      this.face = Math.cos(a) > 0 ? 1 : -1;
      const t = this.tele(i === 0 ? 0.55 : 0.4);
      this.hz('sector', 'cutlass', this.x, this.y, { r: 200, angle: a, half: 0.9, tele: t, active: 0.12, dmg: 18 });
      yield* this.windupFor(t, 'slash');
      this.pose.slash = 1;
      this.sfx('whipcrack', 0.7);
      const c = this.inStage(this.x + Math.cos(a) * 70, this.y + Math.sin(a) * 70);
      this.x = c.x;
      this.y = c.y;
      yield 0.2;
    }
  }

  /** "All hands!": the Gala Queen's drowned crew claw up round you. */
  private *crew(n: number): Co {
    const g = this.g;
    this.anim = 'whistle';
    this.pose.whistle = 1;
    this.sfx('whistle', 1);
    yield 0.5;
    const p = this.target();
    const k = Math.round(n * this.addsMult());
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU + g.rng.next(), r = g.rng.range(220, 300);
      const c = this.inStage(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      g.spawnEnemy(i % 3 === 2 ? 'shore_crawler' : 'drowned', c.x, c.y, { exact: true });
    }
    yield 1;
  }

  /** The Gala Queen's guns: shells come down in lines across your stretch of the boardwalk. */
  private *broadside(volleys: number): Co {
    this.anim = 'whistle';
    this.pose.whistle = 1;
    this.sfx('whistle', 1);
    yield 0.4;
    for (let v = 0; v < volleys; v++) {
      const p = this.target();
      const t = this.tele(1.05);
      // a line of impacts, slanted a little toward the ship
      const slant = this.g.rng.range(-0.35, 0.35), row = this.g.rng.range(-110, 110);
      for (let i = 0; i < CAPTAIN.shells; i++) {
        const o = (i - (CAPTAIN.shells - 1) / 2) * CAPTAIN.shellGap;
        const c = this.inStage(p.x + o, p.y + row + o * slant + this.g.rng.range(-25, 25), 30);
        const h = this.hz('circle', 'shell', c.x, c.y, { r: 72, tele: t + i * 0.08, active: 0.15, dmg: 20 });
        h.onActivate = () => {
          this.g.fx.push('explosion', h.x, h.y, 70, 0, 0, 'cannon');
          if (waterDepth(h.x, h.y) > 0) this.g.fx.push('spark', h.x, h.y, 8, 0, 0, 'splash');
        };
      }
      this.shipFire = 1;
      this.sfx('cannon', 1);
      yield 0.85;
    }
    yield this.tele(1.0);
  }

  /** He goes under; a swirl of foam follows the nearest player; he comes up through it. */
  private *diveUnder(): Co {
    const g = this.g;
    this.anim = 'dive';
    this.sfx('splash', 0.9);
    for (let i = 1; i <= 30; i++) {
      this.dive = i / 30;
      yield 1 / 60;
    }
    const p = this.target();
    const t = this.tele(1.5);
    const h = this.hz('circle', 'surface', p.x, p.y, { r: 150, tele: t, active: 0.2, dmg: 26, followPlayer: 1.6 });
    while (h.alive && h.tele > 0) {
      this.x = this.px = h.x;
      this.y = this.py = h.y;
      yield 1 / 60;
    }
    const c = this.inStage(h.x, h.y);
    this.x = this.px = c.x;
    this.y = this.py = c.y;
    g.fx.push('spark', this.x, this.y, 14, 0, 0, 'splash');
    g.fx.push('shake', this.x, this.y, 0.4);
    this.sfx('crash', 1);
    for (let i = 1; i <= 15; i++) {
      this.dive = 1 - i / 15;
      yield 1 / 60;
    }
    this.dive = 0;
    yield 0.5;
  }

  /** The sea rears up south of you and rolls up the stage; it breaks in two places. Stand in a gap. */
  private *tidal(): Co {
    const g = this.g;
    this.anim = 'whistle';
    this.pose.whistle = 1;
    this.sfx('surge', 1);
    const p = this.target();
    const W = 1600, start = p.y + 560, sp = CAPTAIN.waveSpeed, life = (560 + 760) / sp;
    const G = CAPTAIN.waveGap / 2;
    const gaps = [p.x + g.rng.range(-340, -110), p.x + g.rng.range(110, 340)];
    const t = this.tele(1.4);
    const edges = [p.x - W / 2, gaps[0] - G, gaps[0] + G, gaps[1] - G, gaps[1] + G, p.x + W / 2];
    for (let i = 0; i < edges.length; i += 2) {
      const h = this.hz('line', 'tidal', edges[i], start, { x2: edges[i + 1], y2: start, r2: 38, tele: t, active: life, dmg: 24, slow: 0.4 });
      h.onActivate = () => {
        h.vy = -sp;
      };
    }
    for (const gx of gaps) {
      const s = this.hz('circle', 'safe_pocket', gx, start, { r: G * 0.85, tele: t, active: life, safe: true });
      s.onActivate = () => {
        s.vy = -sp;
      };
    }
    yield t + 0.4;
    yield* this.cutlass(2);
    yield 1.2;
  }

  /** A whirlpool opens under the nearest player and drags at everyone near it. */
  private *whirlpool(): Co {
    const p = this.target();
    const t = this.tele(1.0), secs = 3.4;
    this.anim = 'whistle';
    this.pose.whistle = 1;
    this.hz('circle', 'whirlpool', p.x, p.y, { r: 72, tele: t, active: secs, dmg: 12, tick: 0.45, pull: 190, pullR: CAPTAIN.poolR });
    this.sfx('surge', 0.8);
    yield t;
    yield* this.anchorThrow();
    yield Math.max(0.3, secs - 1.6);
  }

  protected *defeatSequence(): Co {
    this.sfx('toll', 1);
    this.pose.salute = 1;
    yield 0.8;
    for (let i = 0; i < 120; i++) {
      this.dive = i / 120;
      this.ship = 1 - i / 120;
      if (i % 12 === 0) this.g.fx.push('spark', this.x, this.y, 6, 0, 0, 'splash');
      yield 1 / 60;
    }
    this.ship = 0;
    yield 0.6;
  }
}
