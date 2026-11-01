// Shared ground for the Ghost Train's bosses (D-80). Each fights at a station: it comes to the one with the
// most of the party standing on it, keeps to that station's ground south of the platform (never into the
// carriages), picks on whoever is nearest in the same place, and holds still while nobody is there. If the
// party boards and leaves, it follows them down the line: when they next stand at a station it is waiting
// on that platform (sim/ghosttrain.ts `bossesFollow`). The End of the Line's two never leave it.

import type { BossDef } from '../../data/bosses';
import { E, REGIONS, TRAIN, regionAt, trackY, walkRect } from '../../data/ghosttrain';
import type { Game } from '../game';
import { bossStation } from '../ghosttrain';
import type { Player } from '../player';
import type { Co } from '../script';
import { BossBase, type BossOpts } from './boss';

export abstract class GhostTrainBoss extends BossBase {
  /** the station it fights at */
  home = 0;
  /** the End of the Line's own (the Night Express, the Conductor): never leaves it */
  readonly final: boolean;

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.final = def.id === 'night_express' || def.id === 'conductor';
    this.home = this.final ? E : bossStation(g, false) ?? 0;
    this.placeNear(420);
  }

  /** The standing players in its place. */
  locals(): Player[] {
    const r = this.home;
    return this.g.players.filter((p) => this.g.isUp(p) && regionAt(p.x, p.y) === r);
  }

  /** The nearest standing player in its place (anyone standing, if nobody is: it is about to hold still). */
  target(fromX = this.x, fromY = this.y): Player {
    let best: Player | null = null, bd = Infinity;
    for (const p of this.locals()) {
      const d = (p.x - fromX) ** 2 + (p.y - fromY) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best ?? this.g.nearestLiving(fromX, fromY);
  }

  angleToTarget(fromX = this.x, fromY = this.y): number {
    const p = this.target(fromX, fromY);
    return Math.atan2(p.y - fromY, p.x - fromX);
  }

  distToTarget(): number {
    const p = this.target();
    return Math.hypot(p.x - this.x, p.y - this.y);
  }

  /** The station's open ground (south of the platform's back half, inside its bounds), `m` in from the edges. */
  ground(x: number, y: number, m = 60): { x: number; y: number } {
    const w = walkRect(this.home);
    const top = trackY(this.home) + TRAIN.halfW + 80;
    return { x: Math.min(w.maxX - m, Math.max(w.minX + m, x)), y: Math.min(w.maxY - m, Math.max(top + Math.min(m, 60), y)) };
  }

  /** The middle of its station's fighting ground. */
  arena(): { x: number; y: number } {
    const g = REGIONS[this.home];
    return { x: g.cx, y: trackY(this.home) + 820 };
  }

  /** Arrive `d` from the nearest local player, on the side with the most open ground. */
  placeNear(d: number): void {
    const p = this.locals()[0] ?? null;
    const a = this.arena();
    if (!p) {
      this.x = this.px = a.x;
      this.y = this.py = a.y;
      return;
    }
    let best = this.ground(p.x, p.y + d), room = -1;
    for (let k = 0; k < 8; k++) {
      const ang = Math.PI / 2 + (k * Math.PI) / 4;
      const c = this.ground(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d, 140);
      const r = Math.hypot(c.x - p.x, c.y - p.y) - Math.hypot(c.x - a.x, c.y - a.y) * 0.05;
      if (r > room + 1) {
        room = r;
        best = c;
      }
    }
    this.x = this.px = best.x;
    this.y = this.py = best.y;
  }

  /** It follows the party to station `r` (it was left on another platform). */
  relocate(r: number): void {
    if (this.final) return;
    this.g.clearHazardsOf(this.uid);
    this.home = r;
    this.vx = this.vy = 0;
    this.placeNear(440);
    this.g.fx.push('dust', this.x, this.y, 1.6);
    this.g.fx.push('ring', this.x, this.y, 200, 0, 0, 'shock');
    this.sfx('steam_hiss', 0.9);
  }

  /** A creature of its station called into the fight, on open ground. */
  add(id: string, x: number, y: number, elite = false) {
    const c = this.ground(x, y, 80);
    const e = this.g.spawnEnemy(id, c.x, c.y, { exact: true, elite });
    if (e) e.leashExempt = true;
    this.g.fx.push('dust', c.x, c.y, 0.8);
    return e;
  }

  protected roam(dt: number): void {
    const p = this.target();
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = this.moveSpeed * (this.enraged ? 1.25 : 1);
    if (d > this.keepDist) {
      this.vx = (dx / d) * sp;
      this.vy = (dy / d) * sp;
    } else {
      this.vx *= 0.9;
      this.vy *= 0.9;
    }
    const c = this.ground(this.x + this.vx * dt, this.y + this.vy * dt);
    this.x = c.x;
    this.y = c.y;
    if (Math.abs(dx) > 10) this.face = dx > 0 ? 1 : -1;
  }

  /** A wind-up the renderer can see on pose `key`. */
  protected *windupFor(t: number, key: string): Co {
    const n = Math.max(1, Math.round(t * 60));
    for (let i = 0; i < n; i++) {
      this.windup = (i + 1) / n;
      this.pose[key] = this.windup;
      yield 1 / 60;
    }
    this.windup = 0;
  }

  /** A charge down a lit lane toward the target (`over` past them), landing on open ground. */
  protected *chargeLane(speed: number, over: number, width: number, tele: number, style: string, key: string): Co {
    const p = this.target();
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    const L = Math.min(1500, Math.hypot(p.x - this.x, p.y - this.y) + over);
    const end = this.ground(this.x + Math.cos(a) * L, this.y + Math.sin(a) * L);
    this.face = Math.cos(a) > 0 ? 1 : -1;
    this.hz('line', style, this.x, this.y, { x2: end.x, y2: end.y, r2: width, tele: this.tele(tele), active: 0.01, dmg: 0 });
    yield* this.windupFor(this.tele(tele), key);
    // the body does the damage on the way through (contact), and a shove at the end
    this.pose[key] = 1;
    yield* this.moveTo(end.x, end.y, speed);
    this.g.fx.push('dust', this.x, this.y, 1.2);
    this.g.fx.push('shake', this.x, this.y, 0.35);
  }
}
