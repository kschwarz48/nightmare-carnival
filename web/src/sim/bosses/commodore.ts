// THE BOARDWALK, SECRET BOSS — THE COMMODORE (D-68). Commodore Ezra Penhallow, who built the boardwalk in
// 1904 and bargained with the sea to keep it full. Only Summer's End brings him out (sim/quest/
// summersEnd.ts): once the Leviathan is bound by the Gala Queen's bell, he comes down the boards with
// his ledger to collect, and the night doesn't end until his account is closed.
// P1 The Founder: his cane, ledger pages flung in fans, the park's rides answering him (the Sea Wheel's
//    spokes, the Undertow's wraiths).
// P2 The Bargain: the debt in red ink (crossing lines ruled across the stage), the tide on his side,
//    the drowned guests he paid with.
// P3 Summer's End: the last fireworks of 1933 coming down, the ledger's lines and the tide together.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { BoardwalkBoss } from './bwBoss';

/** Tuning the tests read. */
export const COMMODORE = { stage: 820, pages: 9, spokes: 6, spokeLen: 420, waveGap: 220, waveSpeed: 330 };

export class CommodoreBoss extends BoardwalkBoss {
  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.arriveNear(420);
    this.moveSpeed = 110;
    this.keepDist = 320;
    this.pose = { cane: 0, ledger: 0, point: 0, tip: 0, burn: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.cane = Math.max(0, P.cane - dt * 2.5);
    P.ledger = Math.max(0, P.ledger - dt * 1.5);
    P.point = Math.max(0, P.point - dt * 1.2);
    P.tip = Math.max(0, P.tip - dt * 0.8);
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.stageRound(COMMODORE.stage);
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('toll', 1, 0.8);
    for (let i = 0; i < 80; i++) {
      this.pose.tip = Math.sin((i / 80) * Math.PI);
      yield 1 / 60;
    }
    this.pose.ledger = 1;
    this.sfx('fortune', 1);
    yield 0.8;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'cane', w: 1, fn: () => this.cane(3) },
      { name: 'pages', w: 1.1, fn: () => this.pages(3) },
      { name: 'wheel', w: 0.9, fn: () => this.wheel(COMMODORE.spokes, 1.1, 4) },
      { name: 'riders', w: 0.6, fn: () => this.call('coaster_wraith', 2) },
    ];
    if (phase === 1) return [
      { name: 'debt', w: 1.2, fn: () => this.debt(2) },
      { name: 'tidal', w: 1, fn: () => this.tidal() },
      { name: 'guests', w: 0.8, fn: () => this.call('drowned', 6) },
      { name: 'pages', w: 0.8, fn: () => this.pages(4) },
      { name: 'cane', w: 0.7, fn: () => this.cane(3) },
    ];
    return [
      { name: 'fireworks', w: 1.1, fn: () => this.fireworks(16) },
      { name: 'debt', w: 1, fn: () => this.debt(3) },
      { name: 'wheel', w: 0.9, fn: () => this.wheel(COMMODORE.spokes + 2, 1.6, 4) },
      { name: 'tidal', w: 0.8, fn: () => this.tidal() },
      { name: 'pages', w: 0.8, fn: () => this.pages(5) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.moveSpeed = 125;
      this.banner('THE BARGAIN', 'Every guest was a payment');
      this.sfx('toll', 1);
    }
    if (phase === 2) {
      this.moveSpeed = 140;
      this.keepDist = 260;
      this.banner("SUMMER'S END", 'The account comes due');
      this.sfx('fanfare', 0.9, 0.7);
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

  /** The cane: sweeping cuts, stepping in. */
  private *cane(n: number): Co {
    this.anim = 'cane';
    for (let i = 0; i < n; i++) {
      const a = this.angleToTarget();
      this.face = Math.cos(a) > 0 ? 1 : -1;
      const t = this.tele(i === 0 ? 0.55 : 0.42);
      this.hz('sector', 'cane', this.x, this.y, { r: 210, angle: a, half: 1, tele: t, active: 0.12, dmg: 20 });
      yield* this.windupFor(t, 'cane');
      this.pose.cane = 1;
      this.sfx('canetap', 0.8);
      const c = this.inStage(this.x + Math.cos(a) * 80, this.y + Math.sin(a) * 80);
      this.x = c.x;
      this.y = c.y;
      yield 0.2;
    }
  }

  /** Pages torn from the ledger, flung in fans: every one a name. */
  private *pages(n: number): Co {
    this.anim = 'ledger';
    for (let i = 0; i < n; i++) {
      yield* this.windupFor(this.tele(0.4), 'ledger');
      const a = this.angleToTarget() + (i % 2 ? 0.12 : -0.12);
      for (let k = 0; k < COMMODORE.pages; k++) this.bullet('page', this.x, this.y - 20, a + (k / (COMMODORE.pages - 1) - 0.5) * 1.1, 290, 12, { r: 9, life: 3, spin: 8 });
      this.sfx('card', 0.8);
      yield 0.35;
    }
  }

  /** The Sea Wheel answers him: spokes of light turn round where he stands. */
  private *wheel(spokes: number, spin: number, secs: number): Co {
    this.anim = 'point';
    this.pose.point = 1;
    const a0 = this.g.rng.angle(), t = this.tele(1.1), L = COMMODORE.spokeLen;
    const dir = this.g.rng.chance(0.5) ? 1 : -1;
    const list = [];
    for (let i = 0; i < spokes; i++) {
      const a = a0 + (i / spokes) * TAU;
      list.push(this.hz('line', 'spoke', this.x, this.y, { x2: this.x + Math.cos(a) * L, y2: this.y + Math.sin(a) * L, r2: 16, len: L, angle: a, tele: t, active: secs, dmg: 16, tick: 0.5 }));
    }
    this.sfx('wheel_crank', 0.9);
    yield t;
    for (const h of list) h.spinRate = spin * dir;
    yield secs;
  }

  /** He calls the park's own up round you. */
  private *call(id: string, n: number): Co {
    const g = this.g;
    this.anim = 'point';
    this.pose.point = 1;
    this.sfx('toll', 0.7);
    yield 0.5;
    const p = this.target();
    const k = Math.round(n * this.addsMult());
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU + g.rng.next(), r = g.rng.range(240, 330);
      const c = this.inStage(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      g.spawnEnemy(id, c.x, c.y, { exact: true });
    }
    yield 1;
  }

  /** The debt in red ink: lines ruled across the stage, then crossed through. */
  private *debt(rounds: number): Co {
    const g = this.g;
    this.anim = 'ledger';
    for (let r = 0; r < rounds; r++) {
      const p = this.target();
      const a = g.rng.angle(), t = this.tele(1.0);
      yield* this.windupFor(0.3, 'ledger');
      for (let k = -2; k <= 2; k++) {
        const ox = Math.cos(a + Math.PI / 2) * k * 150, oy = Math.sin(a + Math.PI / 2) * k * 150;
        const cx = p.x + ox, cy = p.y + oy;
        this.hz('line', 'debt', cx - Math.cos(a) * 700, cy - Math.sin(a) * 700, { x2: cx + Math.cos(a) * 700, y2: cy + Math.sin(a) * 700, r2: 24, tele: t + (k + 2) * 0.06, active: 0.25, dmg: 18 });
      }
      this.sfx('crackle', 0.8);
      yield t + 0.5;
    }
  }

  /** The tide is on his side: the sea rolls across the stage, broken in two places. */
  private *tidal(): Co {
    const g = this.g;
    this.anim = 'point';
    this.pose.point = 1;
    const p = this.target();
    const W = 1700, start = p.y + 580, sp = COMMODORE.waveSpeed, life = (580 + 780) / sp, G = COMMODORE.waveGap / 2;
    const gaps = [p.x + g.rng.range(-360, -100), p.x + g.rng.range(100, 360)];
    const t = this.tele(1.4);
    const edges = [p.x - W / 2, gaps[0] - G, gaps[0] + G, gaps[1] - G, gaps[1] + G, p.x + W / 2];
    for (let i = 0; i < edges.length; i += 2) {
      const h = this.hz('line', 'tidal', edges[i], start, { x2: edges[i + 1], y2: start, r2: 40, tele: t, active: life, dmg: 24, slow: 0.4 });
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
    this.sfx('surge', 1);
    yield t + 1.6;
  }

  /** The last fireworks of the summer of 1933 come down on the boards. */
  private *fireworks(n: number): Co {
    const g = this.g;
    this.anim = 'point';
    this.pose.point = 1;
    this.sfx('rocket', 0.9);
    for (let i = 0; i < n; i++) {
      const q = g.players[i % g.players.length];
      const p = g.isUp(q) ? q : this.target();
      const a = g.rng.angle(), d = i < 2 ? 0 : g.rng.range(50, 300);
      const c = this.inStage(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 30);
      const h = this.hz('circle', 'firework', c.x, c.y, { r: 66, tele: this.tele(1.0), active: 0.15, dmg: 16 });
      h.onActivate = () => this.g.fx.push('explosion', h.x, h.y, 70, g.rng.next(), 0, 'firework');
      yield 0.09;
    }
    yield this.tele(1.0);
  }

  protected *defeatSequence(): Co {
    this.sfx('toll', 1, 0.7);
    for (let i = 0; i < 120; i++) {
      this.pose.burn = i / 120;
      this.pose.ledger = 1;
      if (i % 20 === 0) this.g.fx.push('spark', this.x, this.y - 40, 6, 0, 0, 'fire');
      yield 1 / 60;
    }
    this.g.fx.push('explosion', this.x, this.y, 160, 0, 0, 'finale');
    yield 0.8;
  }
}
