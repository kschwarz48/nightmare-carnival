// BOSS 3 — THE PUPPET KING (doc 05). Lowered into a string-lit stage around the player (co-op: around
// the party). The stage's ring of lights reels back anyone who strays (D-61).
// P1 dances on its strings; P2 the four strings become cuttable sub-targets (cut all → stagger,
// double damage, strings regrow); P3 he cuts himself free and rampages.

import { TAU, dist2 } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { BossPart } from '../entities';
import type { Game } from '../game';
import type { Co } from '../script';
import { addRingPull } from '../movement';
import { BossBase, type Attack, type BossOpts } from './boss';

/** The stage's radius: its ring of lights (`ringR`) goes up as he lands. */
const STAGE_R = 820;
const STRING_OFFS: [number, number][] = [[-95, -70], [95, -70], [-55, 40], [55, 40]];

export class PuppetBoss extends BossBase {
  strings: BossPart[] = [];
  staggerT = 0;
  descend = 1; // 1 = still up in the flies (render offset)
  free = false;
  hands: [number, number, number, number] = [0, 0, 0, 0]; // hand raise per limb (render)

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    const c = this.stageCentre();
    this.ringX = c.x;
    this.ringY = c.y - 120;
    this.x = this.px = c.x;
    this.y = this.py = c.y - 380;
    this.moveSpeed = 70;
    this.keepDist = 300;
    this.pose = { dance: 0, crouch: 0, crownGone: 0, flail: 0 };
  }

  /**
   * Where the stage comes down: around the player with the most teammates within 600 units, centred on
   * that group (solo: on the player), so as much of the party as possible starts on it.
   */
  private stageCentre(): { x: number; y: number } {
    const g = this.g;
    const up = g.players.filter((p) => g.isUp(p));
    if (up.length <= 1) return up[0] ?? g.player;
    const near = (p: { x: number; y: number }) => up.filter((o) => dist2(o.x, o.y, p.x, p.y) < 600 * 600);
    let group = near(up[0]);
    for (const p of up) {
      const n = near(p);
      if (n.length > group.length) group = n;
    }
    return { x: group.reduce((a, p) => a + p.x, 0) / group.length, y: group.reduce((a, p) => a + p.y, 0) / group.length };
  }

  protected tickBoss(dt: number): void {
    // The stage's ring of lights reels back anyone outside it: every standing player, drawn on every
    // screen (a taut string while it pulls), and predicted by guests with the same formula.
    for (const p of this.g.players) if (this.g.isUp(p)) addRingPull(p, this);
    // keep the king on the stage
    const bx = this.x - this.ringX, by = this.y - this.ringY;
    const bd = Math.hypot(bx, by);
    if (bd > STAGE_R - 120) {
      this.x = this.ringX + (bx / bd) * (STAGE_R - 120);
      this.y = this.ringY + (by / bd) * (STAGE_R - 120);
    }
    if (this.staggerT > 0) {
      this.staggerT -= dt;
      if (this.staggerT <= 0 && this.phase === 1 && !this.dead) {
        this.raiseStrings();
        this.busy = false;
        this.casting = false;
        this.anim = 'idle';
      }
    }
    this.pose.dance += dt * (this.free ? 4 : 2);
    for (let i = 0; i < 4; i++) this.hands[i] = Math.max(0, this.hands[i] - dt * 2);
  }

  protected updateParts(): void {
    super.updateParts();
    for (const s of this.strings) {
      const o = STRING_OFFS[s.index % 4];
      s.x = this.x + o[0];
      s.y = this.y + o[1] - 40;
    }
  }

  protected roam(dt: number): void {
    if (this.staggerT > 0) return;
    super.roam(dt);
  }

  protected *intro(): Co {
    const g = this.g;
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('drumroll', 1);
    // the stage's lights go up as he is lowered
    this.ringR = STAGE_R;
    for (let i = 0; i < 150; i++) {
      this.descend = 1 - i / 150;
      yield 1 / 60;
    }
    this.descend = 0;
    g.fx.push('shake', this.x, this.y, 0.5);
    g.fx.push('dust', this.x, this.y + 60, 2);
    this.sfx('clack', 1);
    this.banner('STAY IN THE LIGHTS', 'His strings reel back anyone who strays off the stage');
    yield 0.6;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'slam', w: 1.2, fn: () => this.slam(1) },
      { name: 'sweep', w: 1, fn: () => this.stringSweep() },
      { name: 'levy', w: 0.7, fn: () => this.levy(1) },
      { name: 'crossbar', w: 0.8, fn: () => this.crossbar() },
    ];
    if (phase === 1) return [
      { name: 'lash', w: 1, fn: () => this.tangleLash() },
      { name: 'rain', w: 0.8, fn: () => this.puppetRain() },
      { name: 'dance', w: 1.1, fn: () => this.slam(4, 0.55) },
    ];
    return [
      { name: 'lunge', w: 1.3, fn: () => this.lunge() },
      { name: 'crown', w: 1, fn: () => this.crownToss() },
      { name: 'flail', w: 1, fn: () => this.flail() },
      { name: 'lastlevy', w: 0.6, fn: () => this.levy(2) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.banner('CUT THE STRINGS!', 'Destroy all four strings to topple him');
      this.raiseStrings();
    }
    if (phase === 2) {
      this.staggerT = 0;
      this.clearStrings();
      this.free = true;
      this.moveSpeed = 190;
      this.keepDist = 140;
      this.banner('NO STRINGS ON ME!');
      this.sfx('shriek', 1);
      this.g.fx.push('shake', this.x, this.y, 0.8);
    }
    return null;
  }

  private raiseStrings(): void {
    this.clearStrings();
    this.body.invuln = true;
    for (let i = 0; i < 4; i++) {
      const s = this.addPart('string', 22);
      s.index = i;
      s.maxHp = s.hp = this.maxHp * 0.03;
      s.invuln = false;
      this.strings.push(s);
    }
    this.updateParts();
  }

  private clearStrings(): void {
    for (const s of this.strings) this.removePart(s);
    this.strings = [];
    if (!this.dead) this.body.invuln = false;
  }

  protected onSubPartDestroyed(part: BossPart): void {
    this.removePart(part);
    this.strings = this.strings.filter((s) => s !== part);
    this.g.fx.push('spark', part.x, part.y, 8, 0, 0, 'string');
    this.sfx('snap', 1);
    if (this.strings.length === 0 && this.phase === 1) {
      // Stagger: he collapses, exposed for a long double-damage window.
      this.staggerT = 4.5;
      this.body.invuln = false;
      if (this.attackCo) this.attackCo.cancel();
      this.g.clearHazardsOf(this.uid);
      this.busy = true;
      this.casting = true;
      this.anim = 'stagger';
      this.banner('STAGGERED!', 'Double damage!');
      this.g.fx.push('shake', this.x, this.y, 0.6);
    }
  }

  protected damageTakenMult(): number {
    return this.staggerT > 0 ? 2 : 1;
  }

  private *slam(n: number, gap = 0.3): Co {
    const g = this.g;
    this.anim = 'slam';
    for (let i = 0; i < n; i++) {
      const p = g.player;
      const x = p.x + p.vx * 0.2, y = p.y + p.vy * 0.2;
      const hand = i % 2;
      this.hands[hand] = 1;
      const t = this.tele(n > 1 ? 0.9 : 1.0);
      this.hz('circle', 'hand_slam', x, y, {
        r: 85, tele: t, active: 0.12, dmg: 26,
        onActivate: () => {
          g.fx.push('shake', x, y, 0.45);
          g.fx.push('dust', x, y, 1.2);
          this.sfx('slam', 0.9);
          for (let k = 0; k < 4; k++) {
            const a = (k * TAU) / 4;
            this.hz('line', 'cross_wave', x, y, { x2: x + Math.cos(a) * 380, y2: y + Math.sin(a) * 380, r2: 16, tele: 0.01, active: 0.22, dmg: 14 });
          }
        },
      });
      yield gap + (n > 1 ? 0.25 : 0);
    }
    yield 1.0;
  }

  private *stringSweep(): Co {
    const g = this.g;
    this.anim = 'sweep';
    const horizontal = g.rng.chance(0.5);
    const A = { x: this.ringX, y: this.ringY, r: STAGE_R };
    const t = this.tele(1.0);
    const spacing = 270;
    const lines = [];
    // the three strings sweep as one rank: all up, all down, all left or all right
    const dir = g.rng.chance(0.5) ? 1 : -1;
    for (let k = -1; k <= 1; k++) {
      const off = k * spacing;
      let x1: number, y1: number, x2: number, y2: number;
      if (horizontal) {
        x1 = A.x - A.r; x2 = A.x + A.r; y1 = y2 = A.y + off - dir * 250;
      } else {
        y1 = A.y - A.r; y2 = A.y + A.r; x1 = x2 = A.x + off - dir * 250;
      }
      lines.push(this.hz('line', 'string_sweep', x1, y1, { x2, y2, r2: 9, tele: t, active: 2.4, dmg: 16, tick: 0.5, vx: horizontal ? 0 : dir * 0, vy: 0 }));
      const h = lines[lines.length - 1];
      (h as any)._dir = dir;
    }
    this.sfx('twang', 0.9);
    yield t;
    for (const h of lines) {
      const dir = (h as any)._dir as number;
      if (horizontal) h.vy = dir * 210;
      else h.vx = dir * 210;
    }
    yield 2.4;
  }

  private *levy(ranks: number): Co {
    const g = this.g;
    this.anim = 'levy';
    this.hands[0] = this.hands[1] = 1;
    this.sfx('drumroll', 0.9);
    yield this.tele(0.8);
    for (let r = 0; r < ranks; r++) {
      const a = g.rng.angle();
      g.director.spawnFormation(this.ringX + Math.cos(a) * (STAGE_R - 80), this.ringY + Math.sin(a) * (STAGE_R - 80), Math.round(5 * this.addsMult()));
    }
    yield 0.8;
  }

  private *crossbar(): Co {
    const g = this.g;
    this.anim = 'crossbar';
    const p = g.player;
    const x = p.x, y = p.y;
    const t = this.tele(1.2);
    this.hz('circle', 'crossbar_shadow', x, y, { r: 120, tele: t, active: 0.01, dmg: 0 });
    yield t;
    g.fx.push('shake', x, y, 0.4);
    this.sfx('clack', 1);
    const a = g.rng.angle();
    for (let k = 0; k < 2; k++) this.hz('line', 'crossbar', x, y, { len: 125, r2: 14, angle: a + k * Math.PI, spinRate: 2.6, tele: 0.01, active: 2.6, dmg: 20, tick: 0.6 });
    yield 2.8;
  }

  private *tangleLash(): Co {
    this.anim = 'lash';
    const t = this.tele(0.85);
    for (const s of this.strings) {
      const a = this.g.rng.angle();
      this.hz('line', 'tangle', s.x, s.y, { len: 320, r2: 10, angle: a, spinRate: (s.index % 2 ? 1 : -1) * 1.7, tele: t, active: 2.2, dmg: 18, tick: 0.5 });
    }
    this.sfx('twang', 1, 0.7);
    yield t + 2.2;
  }

  private *puppetRain(): Co {
    const g = this.g;
    this.anim = 'rain';
    const n = Math.round(6 * this.addsMult());
    for (let i = 0; i < n; i++) {
      const a = g.rng.angle();
      const d = g.rng.range(140, 420);
      const x = g.player.x + Math.cos(a) * d, y = g.player.y + Math.sin(a) * d;
      this.hz('circle', 'puppet_drop', x, y, {
        r: 34, tele: this.tele(1.0), active: 0.1, dmg: 12,
        onActivate: () => {
          const e = g.spawnEnemy('puppet_soldier', x, y, { hpMult: 0.35 });
          if (e) e.group = -1;
          g.fx.push('dust', x, y, 0.6);
        },
      });
      yield 0.18;
    }
    yield 1.2;
  }

  private *lunge(): Co {
    const g = this.g;
    this.anim = 'lunge';
    for (let k = 0; k < 3; k++) {
      this.pose.crouch = 1;
      const a = this.angleToPlayer();
      const L = Math.min(700, this.distToPlayer() + 220);
      const t = this.tele(0.6);
      this.hz('line', 'lunge_lane', this.x, this.y, { x2: this.x + Math.cos(a) * L, y2: this.y + Math.sin(a) * L, r2: 70, tele: t, active: 0.01, dmg: 0 });
      this.windup = 1;
      yield t;
      this.windup = 0;
      this.pose.crouch = 0;
      const contact = this.hz('circle', 'lunge', this.x, this.y, { r: 85, tele: 0.01, active: L / 950 + 0.05, dmg: 28 });
      this.sfx('whoosh', 1);
      const steps = Math.ceil((L / 950) * 60);
      for (let i = 0; i < steps; i++) {
        this.x += (Math.cos(a) * 950) / 60;
        this.y += (Math.sin(a) * 950) / 60;
        contact.x = this.x;
        contact.y = this.y;
        this.face = Math.cos(a) > 0 ? 1 : -1;
        yield 1 / 60;
      }
      yield 0.25;
    }
    yield 0.6;
  }

  private *crownToss(): Co {
    this.anim = 'crown';
    this.windup = 1;
    this.sfx('glint', 0.9);
    yield this.tele(0.7);
    this.windup = 0;
    this.pose.crownGone = 1;
    const a = this.angleToPlayer();
    this.bullet('crown', this.x, this.y - 60, a, 560, 22, { life: 2.5, r: 26, spin: 12, returnAt: 1.15, turn: 0.6 });
    yield 2.5;
    this.pose.crownGone = 0;
  }

  private *flail(): Co {
    this.anim = 'flail';
    const t = this.tele(0.8);
    const h = this.hz('circle', 'flail', this.x, this.y, { r: 130, tele: t, active: 3.2, dmg: 20, tick: 0.4 });
    this.sfx('windmill', 0.9);
    yield t;
    this.pose.flail = 1;
    for (let i = 0; i < 192; i++) {
      const dx = this.g.player.x - this.x, dy = this.g.player.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * 175 / 60;
      this.y += (dy / d) * 175 / 60;
      h.x = this.x;
      h.y = this.y;
      yield 1 / 60;
    }
    this.pose.flail = 0;
    yield 0.6;
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    for (let i = 0; i < 150; i++) {
      if (i % 9 === 0) {
        g.fx.push('death', this.x + g.rng.range(-80, 80), this.y + g.rng.range(-90, 40), 1.4, 0, 0, 'wood');
        this.sfx('clack', 0.6, 0.7 + g.rng.next() * 0.6);
      }
      yield 1 / 60;
    }
    g.fx.push('boss_death', this.x, this.y, 1, 0, 0, 'puppet');
    yield 0.3;
  }
}
