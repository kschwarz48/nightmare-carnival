// THE GHOST TRAIN, BOSS 2 — THE STOKER (D-80). The Midnight Line's fireman, climbed out of the Cinder Works'
// coal: a hunched giant of soot and slag with an open furnace in his chest and a coal shovel as long as a man.
// P1 Banked Coals: shovelfuls of burning coal lobbed at you (they leave embers), the furnace's blast, a
//    charge that leaves a trail of fire.
// P2 Full Steam: heat rings with a gap rolling out of him, cinders raining over the yard, Coalborn shovelled up.
// P3 Blowback: the boiler bursts (get clear, then mind the spokes of flame), everything hotter.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { GhostTrainBoss } from './gtBoss';

/** Tuning the tests read. */
export const STOKER = { lobR: 66, emberSecs: 3.2, blastR: 470, blastHalf: 0.5, trailHalf: 34, burstR: 310, spokes: 8, spokeLen: 560 };

export class StokerBoss extends GhostTrainBoss {
  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.moveSpeed = 95;
    this.keepDist = 280;
    this.pose = { shovel: 0, furnace: 0.3, stoke: 0, roar: 0, heat: 0, fall: 0, step: 0 };
  }

  protected tickBoss(dt: number): void {
    const P = this.pose;
    P.shovel = Math.max(0, P.shovel - dt * 2);
    P.roar = Math.max(0, P.roar - dt * 1.4);
    P.stoke = Math.max(0, P.stoke - dt * 1.5);
    // the furnace in his chest burns brighter with each phase and while he winds up
    P.furnace = 0.35 + this.phase * 0.25 + this.windup * 0.4;
    P.heat += dt * (1 + this.phase);
    P.step += Math.hypot(this.x - this.px, this.y - this.py) * 0.04;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('gt_furnace', 1);
    for (let i = 0; i < 80; i++) {
      this.pose.stoke = Math.sin((i / 80) * Math.PI);
      yield 1 / 60;
    }
    this.pose.roar = 1;
    this.sfx('roar', 0.9, 0.7);
    this.g.fx.push('ring', this.x, this.y, 190, 0, 0, 'fire');
    yield 0.5;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'shovel', w: 1.2, fn: () => this.shovel(5) },
      { name: 'blast', w: 1, fn: () => this.blast(1) },
      { name: 'trail', w: 0.9, fn: () => this.trail(1) },
    ];
    if (phase === 1) return [
      { name: 'heat', w: 1.1, fn: () => this.heatRings(3) },
      { name: 'cinders', w: 1, fn: () => this.cinders(14) },
      { name: 'coalborn', w: 0.7, fn: () => this.coalborn() },
      { name: 'shovel', w: 0.9, fn: () => this.shovel(7) },
      { name: 'blast', w: 0.7, fn: () => this.blast(2) },
    ];
    return [
      { name: 'burst', w: 1.1, fn: () => this.burst() },
      { name: 'trail', w: 1, fn: () => this.trail(2) },
      { name: 'cinders', w: 0.9, fn: () => this.cinders(20) },
      { name: 'heat', w: 0.8, fn: () => this.heatRings(4) },
      { name: 'shovel', w: 0.7, fn: () => this.shovel(9) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.moveSpeed = 110;
      this.banner('FULL STEAM', 'The fire wants feeding.');
      this.sfx('gt_furnace', 1, 1.2);
    }
    if (phase === 2) {
      this.moveSpeed = 125;
      this.keepDist = 220;
      this.banner('BLOWBACK', 'The boiler is past its mark.');
      this.sfx('roar', 1, 0.6);
    }
    return null;
  }

  /** Shovelfuls of burning coal, lobbed where you are and where you're going; each leaves embers. */
  private *shovel(n: number): Co {
    this.anim = 'shovel';
    const p = this.target();
    const lead = { x: p.vx * 0.5, y: p.vy * 0.5 };
    yield* this.windupFor(this.tele(0.45), 'shovel');
    this.sfx('gt_shovel', 0.9);
    for (let i = 0; i < n; i++) {
      const a = this.g.rng.angle(), d = i === 0 ? 0 : this.g.rng.range(50, 260);
      const c = this.ground(p.x + lead.x * (i % 2) + Math.cos(a) * d, p.y + lead.y * (i % 2) + Math.sin(a) * d, 0);
      const h = this.hz('circle', 'gt_coal_lob', c.x, c.y, { r: STOKER.lobR, tele: this.tele(0.95 + i * 0.06), active: 0.15, dmg: 16 });
      h.onActivate = () => {
        this.hz('circle', 'gt_embers', c.x, c.y, { r: STOKER.lobR * 0.8, tele: 0.01, active: STOKER.emberSecs, dmg: 5, tick: 0.5 });
        this.g.fx.push('spark', c.x, c.y, 8, 0, 0, 'fire');
      };
      this.pose.shovel = 1;
    }
    yield this.tele(1.1);
  }

  /** The furnace door flies open: a cone of fire. */
  private *blast(n: number): Co {
    for (let i = 0; i < n; i++) {
      const a = this.angleToTarget();
      this.face = Math.cos(a) > 0 ? 1 : -1;
      this.anim = 'blast';
      const t = this.tele(0.9);
      this.hz('sector', 'gt_furnace_blast', this.x, this.y, { r: STOKER.blastR, angle: a, half: STOKER.blastHalf, tele: t, active: 0.55, dmg: 20, tick: 0.25 });
      yield* this.windupFor(t, 'stoke');
      this.pose.roar = 1;
      this.sfx('gt_furnace', 1, 1.4);
      for (let r = 1; r <= 5; r++) this.g.fx.push('spark', this.x + Math.cos(a) * r * 90, this.y + Math.sin(a) * r * 90, 6, 0, 0, 'fire');
      yield 0.55;
    }
  }

  /** He runs at you down a lit lane, and the ground he crossed burns behind him. */
  private *trail(n: number): Co {
    for (let i = 0; i < n; i++) {
      const x0 = this.x, y0 = this.y;
      this.anim = 'charge';
      yield* this.chargeLane(760, 240, 60, 0.85, 'gt_charge', 'shovel');
      this.hz('line', 'gt_fire_trail', x0, y0, { x2: this.x, y2: this.y, r2: STOKER.trailHalf, tele: 0.25, active: 3, dmg: 6, tick: 0.5 });
      this.sfx('gt_sizzle', 0.8);
      yield 0.4;
    }
  }

  /** Heat rolls off him in rings, each with one cool gap. */
  private *heatRings(n: number): Co {
    this.anim = 'roar';
    for (let i = 0; i < n; i++) {
      yield* this.windupFor(this.tele(0.45), 'stoke');
      this.pose.roar = 1;
      const gap = this.angleToTarget() + this.g.rng.range(-1.8, 1.8);
      this.hz('ring', 'gt_heat_ring', this.x, this.y, { r: 70, r2: 36, grow: 300, tele: 0.01, active: 1.9, dmg: 15, gapHalf: 0.5, angle: gap });
      this.sfx('gt_furnace', 0.7, 1.1);
      yield 0.45;
    }
    yield 0.6;
  }

  /** The chimneys rain cinders over the yard. */
  private *cinders(n: number): Co {
    this.anim = 'roar';
    this.pose.roar = 1;
    this.sfx('gt_sizzle', 0.7);
    const L = this.locals();
    for (let i = 0; i < n; i++) {
      const p = L.length ? L[i % L.length] : this.target();
      const c = this.ground(p.x + this.g.rng.range(-330, 330), p.y + this.g.rng.range(-260, 260), 0);
      this.hz('circle', 'gt_cinder', c.x, c.y, { r: 50, tele: this.tele(1.05), active: 0.15, dmg: 12 });
      yield 0.07;
    }
    yield this.tele(1);
  }

  /** He shovels the coal heaps alive. */
  private *coalborn(): Co {
    this.anim = 'shovel';
    yield* this.windupFor(0.5, 'shovel');
    this.sfx('gt_shovel', 1);
    const p = this.target();
    const n = Math.round(8 * this.addsMult());
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + this.g.rng.next() * 0.4, r = this.g.rng.range(230, 330);
      this.add('gt_coalborn', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    yield 1;
  }

  /** The boiler bursts: get clear of him, then mind the spokes of flame that follow. */
  private *burst(): Co {
    this.anim = 'burst';
    this.noRoam = true;
    const t = this.tele(1.5);
    this.hz('circle', 'gt_boiler', this.x, this.y, { r: STOKER.burstR, tele: t, active: 0.3, dmg: 30 });
    this.sfx('gt_furnace', 1, 0.7);
    yield* this.windupFor(t, 'stoke');
    this.g.fx.push('explosion', this.x, this.y, 300, 0, 0, 'fire');
    this.g.fx.push('shake', this.x, this.y, 0.8);
    this.sfx('boom', 1, 0.6);
    const a0 = this.g.rng.angle();
    for (let k = 0; k < STOKER.spokes; k++) {
      const a = a0 + (k / STOKER.spokes) * TAU;
      this.hz('line', 'gt_fire_trail', this.x, this.y, { x2: this.x + Math.cos(a) * STOKER.spokeLen, y2: this.y + Math.sin(a) * STOKER.spokeLen, r2: 26, tele: this.tele(0.8), active: 0.6, dmg: 16 });
    }
    yield this.tele(0.8) + 0.6;
    this.noRoam = false;
  }

  protected *defeatSequence(): Co {
    this.sfx('gt_sizzle', 1, 0.7);
    for (let i = 0; i < 120; i++) {
      this.pose.fall = Math.min(1, i / 90);
      this.pose.furnace = Math.max(0, 1 - i / 100);
      if (i % 20 === 0) this.g.fx.push('spark', this.x, this.y - 40, 6, 0, 0, 'fire');
      yield 1 / 60;
    }
    this.g.fx.push('dust', this.x, this.y, 2);
    yield 1;
  }
}
