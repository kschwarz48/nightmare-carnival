// THE BOARDWALK, FINAL BOSS — THE LEVIATHAN (D-68). Old Mother Tide, who Commodore Penhallow bargained
// with in 1904: a summer that never ends, for a share of everyone who came to enjoy it. It holds the
// dawn. Its head comes up out of the water, or up through the sand and the boards wherever you are; its
// tentacles burst up round you and can be cut (each one cut hurts it).
// P1 Stirring: tentacles burst up and slam; it goes under and comes up beneath you; it spits seawater.
// P2 The Deep Rises: a tidal wave with gaps, a whirlpool, more tentacles.
// P3 Leviathan: roaring rings with a gap, the devouring lunge, a rain of wreckage, everything at once.
// While its head is up it can be struck by the Gala Queen's bell (Summer's End; sim/quest/summersEnd.ts).

import { TAU } from '../../core/math';
import { shoreY, waterDepth } from '../../data/boardwalk';
import type { BossDef } from '../../data/bosses';
import type { BossPart } from '../entities';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { BoardwalkBoss } from './bwBoss';

/** Tuning the tests read. */
export const LEVIATHAN = { stage: 820, tentacles: 6, tentHp: 900, tentLen: 320, cutShare: 0.025, waveGap: 210, waveSpeed: 350, poolR: 460 };

export class LeviathanBoss extends BoardwalkBoss {
  /** 0 under .. 1 its head fully up (it can't be hit below halfway) */
  up = 0;
  /** per tentacle: x, y, up (0..1), slam angle (replicated: 4 numbers each) */
  tents: number[] = [];
  /** bound by the Gala Queen's bell (Summer's End): it goes down at once */
  bound = false;
  private tentParts: BossPart[] = [];

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.seaBorn = true;
    const p = this.target(0, 0);
    if (waterDepth(p.x, p.y) > -560) {
      const x = p.x + g.rng.range(-160, 160);
      this.x = this.px = x;
      this.y = this.py = Math.max(p.y + 300, shoreY(x) + 120);
    } else this.arriveNear(440);
    this.moveSpeed = 70;
    this.keepDist = 360;
    for (let i = 0; i < LEVIATHAN.tentacles; i++) {
      const t = this.addPart('tentacle', 40);
      t.x = t.y = -1e5;
      this.tentParts.push(t);
      this.tents.push(-1e5, -1e5, 0, 0);
    }
    this.pose = { jaw: 0, roar: 0, lean: 0 };
  }

  /** Is the head up out of the water (the Summer's End bell can only bind it then)? */
  get headUp(): boolean {
    return this.up > 0.8 && !this.dead;
  }

  protected damageTakenMult(): number {
    if (this.bound) return 1;
    if (this.up < 0.5) return 0;
    // while Summer's End holds its account open, it cannot die: only the bell can finish it
    const q = this.g.quests?.get<{ holdsLeviathan?: boolean } & import('../quest').QuestChain>('summers_end');
    if (q?.holdsLeviathan && this.hp <= this.maxHp * 0.02) return 0;
    return 1;
  }

  /** The bell's third stroke: the account is called and Old Mother Tide goes back into the deep. */
  bind(): void {
    if (this.dead) return;
    this.bound = true;
    this.up = 1;
    this.takeDamage(this.body, this.hp + 1, false);
  }

  protected updateParts(): void {
    super.updateParts();
    for (let i = 0; i < this.tentParts.length; i++) {
      const p = this.tentParts[i];
      p.x = this.tents[i * 4];
      p.y = this.tents[i * 4 + 1];
      p.invuln = this.tents[i * 4 + 2] < 0.7 || this.dead || !this.introDone;
    }
  }

  /** A cut tentacle withdraws, and the head feels it. */
  protected onSubPartDestroyed(part: BossPart): void {
    const i = this.tentParts.indexOf(part);
    if (i < 0) return;
    this.tents[i * 4 + 2] = 0;
    part.hp = part.maxHp = 0;
    this.g.fx.push('death', part.x, part.y, 2, 0, 0, 'ink');
    this.sfx('roar', 0.7, 1.3);
    const share = this.maxHp * LEVIATHAN.cutShare;
    if (this.hp > share + 1) this.hp -= share;
    this.flash = 1;
    this.pose.roar = 1;
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.jaw = Math.max(0, P.jaw - dt * 1.5);
    P.roar = Math.max(0, P.roar - dt * 0.8);
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.stageRound(LEVIATHAN.stage);
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('rumble', 1);
    this.g.fx.push('shake', this.x, this.y, 1);
    yield 0.8;
    this.sfx('surge', 1);
    for (let i = 0; i < 100; i++) {
      this.up = i / 100;
      if (i % 8 === 0) this.g.fx.push('spark', this.x + this.g.rng.range(-80, 80), this.y + this.g.rng.range(-40, 40), 8, 0, 0, 'splash');
      yield 1 / 60;
    }
    this.up = 1;
    this.pose.roar = 1;
    this.pose.jaw = 1;
    this.sfx('roar', 1, 0.6);
    this.g.fx.push('ring', this.x, this.y, 260, 0, 0, 'shock');
    yield 0.8;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'tentacles', w: 1.2, fn: () => this.tentacles(3) },
      { name: 'surface', w: 1, fn: () => this.surface() },
      { name: 'spit', w: 0.9, fn: () => this.spit(2) },
    ];
    if (phase === 1) return [
      { name: 'tidal', w: 1.1, fn: () => this.tidal(1) },
      { name: 'whirlpool', w: 1, fn: () => this.whirlpool() },
      { name: 'tentacles', w: 1, fn: () => this.tentacles(4) },
      { name: 'surface', w: 0.8, fn: () => this.surface() },
    ];
    return [
      { name: 'roar', w: 1, fn: () => this.roar() },
      { name: 'devour', w: 1, fn: () => this.devour() },
      { name: 'tentacles', w: 1, fn: () => this.tentacles(5) },
      { name: 'wreckage', w: 0.8, fn: () => this.wreckage(12) },
      { name: 'tidal', w: 0.8, fn: () => this.tidal(2) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    this.up = 1;
    if (phase === 1) {
      this.banner('THE DEEP RISES', 'The sea comes over the boards');
      this.sfx('surge', 1);
    }
    if (phase === 2) {
      this.moveSpeed = 95;
      this.banner('LEVIATHAN', 'Everything it was promised, all at once');
      this.sfx('roar', 1, 0.5);
      this.g.fx.push('shake', this.x, this.y, 1);
    }
    return null;
  }

  private *windupFor(t: number, key?: string): Co {
    const n = Math.max(1, Math.round(t * 60));
    for (let i = 0; i < n; i++) {
      this.windup = (i + 1) / n;
      if (key) this.pose[key] = this.windup;
      yield 1 / 60;
    }
    this.windup = 0;
  }

  /** Tentacles burst up round you — through sand, surf or planks — and slam toward whoever is nearest. */
  private *tentacles(n: number): Co {
    const g = this.g;
    this.anim = 'tentacles';
    this.pose.roar = 1;
    this.sfx('rumble', 0.8);
    const p = this.target();
    const free: number[] = [];
    for (let i = 0; i < LEVIATHAN.tentacles; i++) if (this.tents[i * 4 + 2] <= 0) free.push(i);
    const k = Math.min(n, free.length);
    const a0 = g.rng.angle();
    for (let j = 0; j < k; j++) {
      const a = a0 + (j / k) * TAU + g.rng.range(-0.3, 0.3), r = g.rng.range(170, 260);
      const c = this.inStage(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 40);
      this.co.start(this.tentacle(free[j], c.x, c.y));
      yield 0.12;
    }
    yield 2.2;
  }

  private *tentacle(i: number, x: number, y: number): Co {
    const g = this.g, T = this.tents, part = this.tentParts[i];
    T[i * 4] = x;
    T[i * 4 + 1] = y;
    T[i * 4 + 3] = 0;
    const t = this.tele(0.9);
    this.hz('circle', 'tentacle_burst', x, y, { r: 72, tele: t, active: 0.15, dmg: 18 });
    yield t;
    g.fx.push('dust', x, y, 1.2);
    if (waterDepth(x, y) > 0) g.fx.push('spark', x, y, 8, 0, 0, 'splash');
    part.hp = part.maxHp = LEVIATHAN.tentHp * g.diff.hpMult * g.partyScale.hp;
    for (let f = 1; f <= 12; f++) {
      T[i * 4 + 2] = f / 12;
      yield 1 / 60;
    }
    // two slams toward whoever is nearest, then it sinks back
    for (let s = 0; s < 2 && T[i * 4 + 2] > 0; s++) {
      yield 0.5;
      if (T[i * 4 + 2] <= 0 || this.dead) return;
      const q = this.target(x, y);
      const a = Math.atan2(q.y - y, q.x - x);
      T[i * 4 + 3] = a;
      const st = this.tele(0.7);
      this.hz('line', 'tentacle_slam', x, y, { x2: x + Math.cos(a) * LEVIATHAN.tentLen, y2: y + Math.sin(a) * LEVIATHAN.tentLen, r2: 32, tele: st, active: 0.15, dmg: 18 });
      yield st;
      if (T[i * 4 + 2] <= 0 || this.dead) return;
      g.fx.push('shake', x, y, 0.25);
      this.sfx('slam', 0.6);
    }
    yield 0.6;
    for (let f = 1; f <= 15 && T[i * 4 + 2] > 0; f++) {
      T[i * 4 + 2] = Math.max(0, 1 - f / 15);
      yield 1 / 60;
    }
    T[i * 4 + 2] = 0;
    part.hp = part.maxHp = 0;
  }

  /** Under, and up beneath you: a swell follows the nearest player, then the jaws come up through it. */
  private *surface(): Co {
    const g = this.g;
    this.anim = 'surface';
    this.sfx('surge', 0.9);
    for (let i = 1; i <= 36; i++) {
      this.up = 1 - i / 36;
      yield 1 / 60;
    }
    const p = this.target();
    const t = this.tele(1.3);
    const h = this.hz('circle', 'surface', p.x, p.y, { r: 190, tele: t, active: 0.25, dmg: 30, followPlayer: 1.2 });
    while (h.alive && h.tele > 0) {
      this.x = this.px = h.x;
      this.y = this.py = h.y;
      yield 1 / 60;
    }
    const c = this.inStage(h.x, h.y);
    this.x = this.px = c.x;
    this.y = this.py = c.y;
    g.fx.push('shake', this.x, this.y, 0.8);
    g.fx.push('spark', this.x, this.y, 16, 0, 0, 'splash');
    this.sfx('crash', 1);
    this.pose.jaw = 1;
    for (let i = 1; i <= 18; i++) {
      this.up = i / 18;
      yield 1 / 60;
    }
    this.up = 1;
    // and it bites at whoever is still close
    const a = this.angleToTarget();
    const bt = this.tele(0.5);
    this.hz('sector', 'bite', this.x, this.y, { r: 230, angle: a, half: 0.7, tele: bt, active: 0.12, dmg: 24 });
    yield* this.windupFor(bt, 'jaw');
    this.sfx('bite', 1);
    yield 0.5;
  }

  /** It spits seawater in fans. */
  private *spit(n: number): Co {
    this.anim = 'spit';
    for (let i = 0; i < n; i++) {
      yield* this.windupFor(this.tele(0.5), 'jaw');
      const a = this.angleToTarget();
      for (let k = 0; k < 9; k++) this.bullet('bolt', this.x, this.y, a + (k / 8 - 0.5) * 1.2, 300, 12, { r: 9, life: 2.6 });
      this.sfx('spray', 0.9);
      yield 0.5;
    }
  }

  /** The sea rears up behind you and rolls across the stage; it breaks in two places. */
  private *tidal(waves: number): Co {
    const g = this.g;
    this.anim = 'tidal';
    this.pose.roar = 1;
    for (let w = 0; w < waves; w++) {
      const p = this.target();
      const W = 1700, start = p.y + 580, sp = LEVIATHAN.waveSpeed, life = (580 + 780) / sp;
      const G = LEVIATHAN.waveGap / 2;
      const gaps = [p.x + g.rng.range(-360, -100), p.x + g.rng.range(100, 360)];
      const t = this.tele(1.4);
      const edges = [p.x - W / 2, gaps[0] - G, gaps[0] + G, gaps[1] - G, gaps[1] + G, p.x + W / 2];
      for (let i = 0; i < edges.length; i += 2) {
        const h = this.hz('line', 'tidal', edges[i], start, { x2: edges[i + 1], y2: start, r2: 40, tele: t, active: life, dmg: 26, slow: 0.4 });
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
      yield t + 1.4;
    }
    yield 0.8;
  }

  /** A whirlpool opens under the nearest player; tentacles come up round its rim. */
  private *whirlpool(): Co {
    const p = this.target();
    const t = this.tele(1.0), secs = 3.8;
    this.anim = 'whirlpool';
    this.hz('circle', 'whirlpool', p.x, p.y, { r: 76, tele: t, active: secs, dmg: 13, tick: 0.45, pull: 200, pullR: LEVIATHAN.poolR });
    this.sfx('surge', 0.8);
    yield t;
    yield* this.tentacles(2);
    yield Math.max(0.3, secs - 2.4);
  }

  /** It roars: rings of churned water roll out from it, each with one gap. */
  private *roar(): Co {
    this.anim = 'roar';
    for (let i = 0; i < 3; i++) {
      yield* this.windupFor(this.tele(0.45), 'roar');
      const gap = this.angleToTarget() + this.g.rng.range(-1.5, 1.5);
      this.hz('ring', 'roar_ring', this.x, this.y, { r: 110, r2: 80, grow: 320, tele: 0.01, active: 2, dmg: 20, gapHalf: 0.45, angle: gap });
      this.sfx('roar', 0.9, 0.7 + i * 0.1);
      this.g.fx.push('shake', this.x, this.y, 0.4);
      yield 0.45;
    }
    yield 0.8;
  }

  /** The devouring lunge: a long lane, and the head comes down it, jaws wide. */
  private *devour(): Co {
    const p = this.target();
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    const L = Math.min(980, Math.hypot(p.x - this.x, p.y - this.y) + 300);
    const end = this.inStage(this.x + Math.cos(a) * L, this.y + Math.sin(a) * L);
    const t = this.tele(1.0);
    this.anim = 'devour';
    this.hz('line', 'devour', this.x, this.y, { x2: end.x, y2: end.y, r2: 90, tele: t, active: 0.01, dmg: 0 });
    yield* this.windupFor(t, 'jaw');
    this.pose.jaw = 1;
    this.sfx('roar', 1, 0.8);
    yield* this.moveTo(end.x, end.y, 950);
    this.g.fx.push('shake', this.x, this.y, 0.6);
    this.sfx('bite', 1);
    yield 0.6;
  }

  /** Wreckage of the old pier comes down all round: planks, pilings, barnacled iron. */
  private *wreckage(n: number): Co {
    this.anim = 'roar';
    this.pose.roar = 1;
    this.sfx('rumble', 1);
    for (let i = 0; i < n; i++) {
      const p = this.g.players[i % this.g.players.length];
      const q = this.g.isUp(p) ? p : this.target();
      const a = this.g.rng.angle(), d = i < 2 ? 0 : this.g.rng.range(60, 300);
      const c = this.inStage(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, 30);
      const h = this.hz('circle', 'wreckage', c.x, c.y, { r: 70, tele: this.tele(1.0), active: 0.15, dmg: 18 });
      h.onActivate = () => this.g.fx.push('death', h.x, h.y, 1.2, 0, 0, 'wood');
      yield 0.1;
    }
    yield this.tele(1.0);
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    for (let i = 0; i < LEVIATHAN.tentacles; i++) this.tents[i * 4 + 2] = 0;
    this.pose.roar = 1;
    this.sfx('roar', 1, 0.45);
    g.fx.push('shake', this.x, this.y, 1);
    for (let i = 0; i < 150; i++) {
      this.up = 1 - i / 150;
      if (i % 15 === 0) g.fx.push('spark', this.x + g.rng.range(-90, 90), this.y + g.rng.range(-50, 50), 10, 0, 0, 'splash');
      yield 1 / 60;
    }
    this.up = 0;
    this.sfx('surge', 0.7);
    yield 0.8;
  }
}
