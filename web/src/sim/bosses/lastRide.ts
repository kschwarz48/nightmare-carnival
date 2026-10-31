// THE BOARDWALK, BOSS 3 — THE LAST RIDE (D-68). The Undertow's train, its riders still in their seats,
// off the track and hunting. The lead car is the body; every car behind it follows its path and hurts to
// touch (and to hit: they're all the same train). It lays its own track, glowing, and then runs it.
// P1 Boarding: lays a straight run through you and takes it; loops a ring of track round you and laps it.
// P2 Full Speed: faster and longer runs; the rear cars uncouple and come down on you like shells.
// P3 Derailed: off any track at all: zig-zag dashes leaving burning wreckage, and the drop — it leaps
//    and slams down where you stand.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import type { BossPart } from '../entities';
import type { Game } from '../game';
import type { Co } from '../script';
import type { Attack, BossOpts } from './boss';
import { BoardwalkBoss } from './bwBoss';

/** Tuning the tests read. */
export const LAST_RIDE = { stage: 780, cars: 5, gap: 52, cruise: 230, run: 760, loopR: 280, loopSpeed: 620 };
const STEP = 4;

export class LastRideBoss extends BoardwalkBoss {
  /** where each car behind the lead sits (x, y pairs; replicated), and how many are coupled */
  cars: number[] = [];
  coupled = LAST_RIDE.cars;
  /** the lead car's heading (radians) and how high it is off the ground (the drop) */
  heading = 0;
  air = 0;
  /** 0..1: the track lights / the screaming riders */
  lights = 0;
  scream = 0;
  private hist: number[] = [];
  private travelled = 0;
  private carParts: BossPart[] = [];

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.arriveNear(520);
    this.moveSpeed = LAST_RIDE.cruise;
    this.keepDist = 380;
    this.heading = this.angleToTarget();
    for (let i = 0; i < LAST_RIDE.cars; i++) {
      const p = this.addPart('contact', 34);
      this.carParts.push(p);
    }
    this.resetTrain();
    this.pose = { mouth: 0, rock: 0 };
  }

  /** Lay the cars out straight behind the lead car (arrival, after the drop). */
  private resetTrain(): void {
    this.hist.length = 0;
    const n = (LAST_RIDE.cars + 1) * (LAST_RIDE.gap / STEP) + 4;
    for (let i = n; i >= 0; i--) this.hist.push(this.x - Math.cos(this.heading) * i * STEP, this.y - Math.sin(this.heading) * i * STEP);
    this.travelled = 0;
    this.placeCars();
  }

  private placeCars(): void {
    const per = LAST_RIDE.gap / STEP;
    this.cars.length = 0;
    const H = this.hist.length / 2;
    for (let k = 1; k <= LAST_RIDE.cars; k++) {
      const i = Math.max(0, H - 1 - Math.round(k * per));
      this.cars.push(this.hist[i * 2], this.hist[i * 2 + 1]);
    }
  }

  protected updateParts(): void {
    super.updateParts();
    for (let k = 0; k < this.carParts.length; k++) {
      const p = this.carParts[k];
      const on = k < this.coupled && this.air < 0.3;
      p.x = on ? this.cars[k * 2] ?? this.x : -1e5;
      p.y = on ? this.cars[k * 2 + 1] ?? this.y : -1e5;
      p.invuln = !this.introDone || this.dead || !on;
    }
  }

  protected tickBoss(dt: number): void {
    // the lead car's trail: a point every few units of travel; the cars ride it
    const lx = this.hist[this.hist.length - 2], ly = this.hist[this.hist.length - 1];
    const d = Math.hypot(this.x - lx, this.y - ly);
    if (d > 0.01) {
      this.heading = Math.atan2(this.y - ly, this.x - lx);
      this.travelled += d;
      while (this.travelled >= STEP) {
        this.travelled -= STEP;
        const k = 1 - this.travelled / Math.max(d, 1e-3);
        this.hist.push(lx + (this.x - lx) * k, ly + (this.y - ly) * k);
      }
      const cap = (LAST_RIDE.cars + 2) * (LAST_RIDE.gap / STEP) * 2;
      if (this.hist.length > cap) this.hist.splice(0, this.hist.length - cap);
      this.placeCars();
    }
    this.pose.mouth = Math.max(0, this.pose.mouth - dt * 2);
    this.pose.rock += dt * (1 + Math.hypot(this.vx, this.vy) * 0.01);
    this.scream = Math.max(0, this.scream - dt * 0.8);
    this.lights += ((this.casting ? 1 : 0.4) - this.lights) * Math.min(1, dt * 4);
  }

  /** Between attacks it cruises in wide curves round its riders-to-be, never straight at them. */
  protected roam(dt: number): void {
    const p = this.target();
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
    // aim along the tangent of a circle round the player, leaning in or out to hold the distance
    const side = Math.sin(this.fightT * 0.3) > 0 ? 1 : -1;
    const tx = -dy / d * side, ty = dx / d * side;
    const pull = Math.max(-1, Math.min(1, (d - this.keepDist) / 200));
    const want = Math.atan2(ty + (dy / d) * pull, tx + (dx / d) * pull);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    const a = this.heading + Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    const sp = this.moveSpeed * (this.enraged ? 1.25 : 1);
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp;
    const c = this.inStage(this.x + this.vx * dt, this.y + this.vy * dt);
    this.x = c.x;
    this.y = c.y;
    this.face = this.vx > 0 ? 1 : -1;
  }

  protected *intro(): Co {
    this.anim = 'intro';
    this.stageRound(LAST_RIDE.stage);
    this.banner(this.def.name.toUpperCase(), this.def.title);
    this.sfx('railwarn', 1);
    for (let i = 0; i < 70; i++) {
      this.lights = i / 70;
      yield 1 / 60;
    }
    this.sfx('train', 1);
    this.scream = 1;
    this.pose.mouth = 1;
    yield 0.6;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'run', w: 1.2, fn: () => this.runs(2, 760) },
      { name: 'loop', w: 1, fn: () => this.loop(1.5) },
    ];
    if (phase === 1) return [
      { name: 'run', w: 1, fn: () => this.runs(3, 860) },
      { name: 'missiles', w: 1.1, fn: () => this.missiles(3) },
      { name: 'loop', w: 0.9, fn: () => this.loop(2) },
    ];
    return [
      { name: 'derail', w: 1.1, fn: () => this.derail(3) },
      { name: 'drop', w: 1, fn: () => this.drop() },
      { name: 'missiles', w: 0.8, fn: () => this.missiles(4) },
      { name: 'run', w: 0.7, fn: () => this.runs(3, 940) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    if (phase === 1) {
      this.moveSpeed = LAST_RIDE.cruise * 1.25;
      this.banner('FULL SPEED', 'Keep your hands inside the car');
      this.sfx('train', 1);
    }
    if (phase === 2) {
      this.moveSpeed = LAST_RIDE.cruise * 1.45;
      this.banner('DERAILED', 'No track. No brakes.');
      this.sfx('crash', 1);
      this.coupled = LAST_RIDE.cars;
    }
    return null;
  }

  private *windupFor(t: number): Co {
    const n = Math.max(1, Math.round(t * 60));
    for (let i = 0; i < n; i++) {
      this.windup = (i + 1) / n;
      yield 1 / 60;
    }
    this.windup = 0;
  }

  /** Drive the lead car to (x, y) along a straight line at `speed` (sparks where the wheels bite). */
  private *ride(x: number, y: number, speed: number): Co {
    for (let i = 0; i < 900; i++) {
      const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
      if (d < speed / 60 + 1) {
        this.x = x;
        this.y = y;
        return;
      }
      this.vx = (dx / d) * speed;
      this.vy = (dy / d) * speed;
      this.x += this.vx / 60;
      this.y += this.vy / 60;
      this.face = this.vx > 0 ? 1 : -1;
      if (i % 6 === 0) this.g.fx.push('spark', this.x, this.y, 2, 0, 0, 'fire');
      yield 1 / 60;
    }
  }

  /** It lays a straight run of glowing track through you — and takes it. */
  private *runs(n: number, speed: number): Co {
    for (let i = 0; i < n; i++) {
      const p = this.target();
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      const L = Math.min(1000, Math.hypot(p.x - this.x, p.y - this.y) + 340);
      const end = this.inStage(this.x + Math.cos(a) * L, this.y + Math.sin(a) * L);
      const t = this.tele(i === 0 ? 1 : 0.8);
      this.anim = 'run';
      this.hz('line', 'track', this.x, this.y, { x2: end.x, y2: end.y, r2: 46, tele: t, active: 0.01, dmg: 0 });
      this.sfx('railwarn', 0.8);
      yield* this.windupFor(t);
      this.scream = 1;
      this.pose.mouth = 1;
      this.sfx('train', 0.9);
      yield* this.ride(end.x, end.y, speed * (this.enraged ? 1.1 : 1));
      yield 0.3;
    }
  }

  /** A ring of track round you; it rides it, lapping, and keeps you inside. */
  private *loop(laps: number): Co {
    const p = this.target();
    const c = this.inStage(p.x, p.y, LAST_RIDE.loopR + 40);
    const R = LAST_RIDE.loopR, t = this.tele(1.1);
    this.anim = 'loop';
    this.hz('annulus', 'track_loop', c.x, c.y, { r: R + 34, r2: R - 34, tele: t, active: 0.01, dmg: 0 });
    // get onto the ring while the track lights up
    const a0 = Math.atan2(this.y - c.y, this.x - c.x);
    yield* this.ride(c.x + Math.cos(a0) * R, c.y + Math.sin(a0) * R, 900);
    yield* this.windupFor(Math.max(0.2, t - 0.5));
    this.scream = 1;
    this.sfx('train', 0.9);
    const dir = this.g.rng.chance(0.5) ? 1 : -1, w = (LAST_RIDE.loopSpeed / R) * dir;
    const total = laps * TAU;
    let s = 0, shot = 0;
    while (s < total) {
      s += Math.abs(w) / 60;
      const a = a0 + s * Math.sign(w);
      this.vx = -Math.sin(a) * LAST_RIDE.loopSpeed * dir;
      this.vy = Math.cos(a) * LAST_RIDE.loopSpeed * dir;
      this.x = c.x + Math.cos(a) * R;
      this.y = c.y + Math.sin(a) * R;
      // the riders throw sparks inward as they pass
      shot += 1 / 60;
      if (shot > 0.3) {
        shot = 0;
        this.bullet('spark', this.x, this.y, a + Math.PI + this.g.rng.range(-0.25, 0.25), 220, 10, { r: 8, life: 2.2 });
      }
      yield 1 / 60;
    }
    yield 0.3;
  }

  /** The rear cars uncouple and come down on you like shells, one after another; new ones are coupled on. */
  private *missiles(n: number): Co {
    this.anim = 'missiles';
    this.pose.mouth = 1;
    this.sfx('clunk', 1);
    yield* this.windupFor(this.tele(0.5));
    const k = Math.min(n, this.coupled);
    for (let i = 0; i < k; i++) {
      const p = this.target();
      const tx = p.x + this.g.rng.range(-90, 90), ty = p.y + this.g.rng.range(-90, 90);
      const c = this.inStage(tx, ty, 40);
      const from = this.coupled - 1;
      const fx = this.cars[from * 2] ?? this.x, fy = this.cars[from * 2 + 1] ?? this.y;
      this.coupled--;
      const flight = this.tele(1.1);
      const h = this.hz('circle', 'car_drop', c.x, c.y, { r: 95, tele: flight, active: 0.2, dmg: 24 });
      h.onActivate = () => {
        this.g.fx.push('explosion', h.x, h.y, 95, 0, 0, 'fire');
        this.g.fx.push('death', h.x, h.y, 1.4, 0, 0, 'derail');
      };
      // the car itself, arcing over (drawn only: it vanishes just above the ground, the impact does the harm)
      const G = 588;
      const b = this.g.spawnBullet('car', fx, fy, (c.x - fx) / flight, (c.y - fy) / flight, 0, { r: 20, life: flight * 0.92, vz: G * flight * 0.5, grav: G, spin: 4 });
      if (b) b.z = 30;
      this.sfx('whoosh', 0.7);
      yield 0.35;
    }
    yield this.tele(1.0);
    this.g.fx.push('dust', this.x, this.y, 1);
    yield 1.2;
    // fresh cars roll out of the dark and couple on
    this.coupled = LAST_RIDE.cars;
    this.sfx('clunk', 0.8);
  }

  /** Off the track: short, savage dashes in a zig-zag, leaving wreckage burning behind. */
  private *derail(n: number): Co {
    for (let i = 0; i < n; i++) {
      const p = this.target();
      const a = Math.atan2(p.y - this.y, p.x - this.x) + (i % 2 ? 0.5 : -0.5);
      const L = Math.min(620, Math.hypot(p.x - this.x, p.y - this.y) + 200);
      const end = this.inStage(this.x + Math.cos(a) * L, this.y + Math.sin(a) * L);
      const t = this.tele(0.6);
      this.hz('line', 'track', this.x, this.y, { x2: end.x, y2: end.y, r2: 44, tele: t, active: 0.01, dmg: 0 });
      yield* this.windupFor(t);
      this.scream = 1;
      const sx = this.x, sy = this.y;
      yield* this.ride(end.x, end.y, 980);
      // burning wreckage along the way
      for (let k = 1; k <= 4; k++) {
        const f = k / 5;
        this.hz('circle', 'fire_trail', sx + (end.x - sx) * f, sy + (end.y - sy) * f, { r: 46, tele: 0.01, active: 2.4, dmg: 8, tick: 0.5 });
      }
      this.sfx('crash', 0.7);
      yield 0.25;
    }
  }

  /** The drop: it leaps off the world and comes down where you stand. */
  private *drop(): Co {
    const g = this.g;
    this.anim = 'drop';
    this.sfx('railwarn', 1);
    for (let i = 1; i <= 30; i++) {
      this.air = i / 30;
      yield 1 / 60;
    }
    const p = this.target();
    const t = this.tele(1.2);
    const h = this.hz('circle', 'car_drop', p.x, p.y, { r: 210, tele: t, active: 0.25, dmg: 30, followPlayer: 0.8 });
    this.scream = 1;
    while (h.alive && h.tele > 0.15) yield 1 / 60;
    const c = this.inStage(h.x, h.y);
    this.x = this.px = c.x;
    this.y = this.py = c.y;
    for (let i = 1; i <= 9; i++) {
      this.air = 1 - i / 9;
      yield 1 / 60;
    }
    this.air = 0;
    this.resetTrain();
    g.fx.push('explosion', this.x, this.y, 210, 0, 0, 'boss');
    g.fx.push('shake', this.x, this.y, 0.9);
    this.sfx('boom', 1);
    yield 0.9;
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    this.scream = 1;
    this.sfx('railwarn', 1);
    // one last plunge: the cars come apart one by one, front to back
    for (let k = 0; k < LAST_RIDE.cars; k++) {
      const x = this.cars[k * 2] ?? this.x, y = this.cars[k * 2 + 1] ?? this.y;
      g.fx.push('explosion', x, y, 90, 0, 0, 'fire');
      g.fx.push('spark', x, y, 10, 0, 0, 'fire');
      this.coupled = LAST_RIDE.cars - 1 - k;
      this.sfx('crash', 0.8);
      yield 0.28;
    }
    for (let i = 0; i < 40; i++) {
      this.air = Math.sin((i / 40) * Math.PI) * 0.5;
      yield 1 / 60;
    }
    this.air = 0;
    g.fx.push('explosion', this.x, this.y, 180, 0, 0, 'boss');
    this.sfx('boom', 1);
    yield 1;
  }
}
