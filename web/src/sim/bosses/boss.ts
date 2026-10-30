// Boss framework (doc 05 "Implementation notes", Godot Boss/BossPhase/BossAttack):
// dormant → intro → weighted attack loop per phase (no immediate repeats) → HP-threshold phase
// transitions → soft enrage ("Encore") → defeat spectacle → chest + ticket burst + heal.

import { dist2 } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import { CURSE } from '../../data/difficulty';
import { BossPart, type Hazard, type HazardShape } from '../entities';
import type { Game } from '../game';
import { Coroutine, CoroutineSet, type Co } from '../script';

export interface Attack {
  name: string;
  w: number;
  fn: () => Co;
}

export interface BossOpts {
  encore?: boolean;
}

export abstract class BossBase {
  uid: number;
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  hp: number;
  maxHp: number;
  phase = 0;
  awake = false;
  introDone = false;
  dead = false;
  removed = false;
  solid = false;
  solidR = 0;
  invuln = true;
  casting = false;
  busy = false;
  transitioning = false;
  encore = false;
  enraged = false;
  enrageT: number;
  fightT = 0;
  deathT = 0;
  lastAttack = '';
  parts: BossPart[] = [];
  body: BossPart;
  co = new CoroutineSet();
  attackCo: Coroutine | null = null;
  // presentation state read by the renderer
  anim = 'dormant';
  animT = 0;
  face = 1;
  flash = 0;
  windup = 0;
  pose: Record<string, number> = {};
  attackName = '';
  dmgMult: number;
  moveSpeed = 100;
  keepDist = 340;
  noRoam = false;

  constructor(public g: Game, public def: BossDef, public opts: BossOpts = {}) {
    this.uid = g.nextUid++;
    this.encore = !!opts.encore;
    const curse = g.cfg.curse ? CURSE.hpMult : 1;
    this.maxHp = this.hp = def.hp * g.diff.hpMult * curse * (this.encore ? 0.4 : 1) * (g.endless ? 1 + 0.12 * Math.max(0, (g.time - g.endlessStart) / 60) : 1);
    this.dmgMult = g.diff.dmgMult * (this.encore ? 1.25 : 1);
    this.enrageT = def.enrage;
    this.body = this.addPart('body', def.radius * 0.85);
  }

  addPart(kind: string, r: number): BossPart {
    const p = new BossPart();
    p.uid = this.g.nextUid++;
    p.kind = kind;
    p.r = r;
    p.invuln = true;
    p.index = this.parts.length;
    this.parts.push(p);
    this.g.bossParts.push(p);
    return p;
  }

  removePart(p: BossPart): void {
    p.alive = false;
    this.parts = this.parts.filter((q) => q !== p);
    this.g.bossParts = this.g.bossParts.filter((q) => q !== p);
  }

  abstract attacks(phase: number): Attack[];
  /** Intro coroutine: called on wake. Must end with the boss vulnerable. */
  protected *intro(): Co {
    this.anim = 'intro';
    yield 1.5;
  }
  protected onPhase(_phase: number): Co | null {
    return null;
  }
  protected *defeatSequence(): Co {
    yield 2.5;
  }
  /** Per-tick hook for custom movement / always-on hazards. */
  protected tickBoss(_dt: number): void {}
  protected updateParts(): void {
    this.body.x = this.x;
    this.body.y = this.y;
  }

  get gate(): number {
    return this.def.gate;
  }

  // ---------------------------------------------------------------- loop
  update(dt: number): void {
    const g = this.g;
    this.px = this.x;
    this.py = this.y;
    this.animT += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
    for (const p of this.parts) if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 6);
    if (this.dead) {
      this.deathT += dt;
      this.co.step(dt);
      if (this.co.list.length === 0) this.finishRemoval();
      return;
    }
    if (!this.awake) {
      const held = g.bosses.some((b) => b !== this && b.awake && !b.dead);
      if (this.encore || (g.time >= this.gate && !held && g.director.gateOpen(this.def.id))) this.wake();
      else {
        this.updateParts();
        return;
      }
    }
    this.fightT += dt;
    if (this.introDone && !this.enraged && this.fightT > this.enrageT) {
      this.enraged = true;
      g.bus.emit('banner', { text: 'ENCORE!', sub: `${this.def.name} picks up the tempo`, style: 'danger' });
    }
    this.co.step(dt);
    if (this.introDone && !this.casting && !this.transitioning && !this.noRoam) this.roam(dt);
    this.tickBoss(dt);
    this.updateParts();
    if (this.introDone && !this.busy && !this.transitioning) this.nextAttack();
  }

  protected roam(dt: number): void {
    const p = this.g.player;
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
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.abs(dx) > 10) this.face = dx > 0 ? 1 : -1;
  }

  private wake(): void {
    const g = this.g;
    this.awake = true;
    this.solid = false;
    this.g.player.bossDamageTaken = 0;
    g.bus.emit('boss_spawn', { id: this.def.id });
    g.bus.emit('discover', { id: this.def.id });
    g.bus.emit('music', { cue: this.encore ? 'boss_ringmaster' : `boss_${this.def.id}` });
    this.co.start(this.introWrap());
  }

  private *introWrap(): Co {
    this.invuln = true;
    this.casting = true;
    yield* this.intro();
    this.invuln = false;
    for (const p of this.parts) if (p.kind === 'body') p.invuln = false;
    this.casting = false;
    this.introDone = true;
    this.anim = 'idle';
    if (this.encore) {
      this.phase = 2;
      const c = this.onPhase(2);
      if (c) this.co.start(c);
    }
  }

  private nextAttack(): void {
    const pool = this.attacks(this.phase).filter((a) => a.name !== this.lastAttack || this.attacks(this.phase).length === 1);
    if (!pool.length) return;
    const a = pool[this.g.rng.weighted(pool.map((x) => x.w))];
    this.lastAttack = a.name;
    this.busy = true;
    this.attackCo = this.co.start(this.runAttack(a));
  }

  private *runAttack(a: Attack): Co {
    this.attackName = a.name;
    this.casting = true;
    yield* a.fn();
    this.casting = false;
    this.windup = 0;
    this.anim = 'idle';
    this.attackName = '';
    yield (this.enraged ? 0.55 : 1.0) * (this.encore ? 0.7 : 1);
    this.busy = false;
  }

  /** Telegraph-time scaler: Encore shortens wind-ups a little (never below 70%). */
  tele(t: number): number {
    return t * (this.enraged ? 0.8 : 1);
  }

  // ---------------------------------------------------------------- damage
  takeDamage(part: BossPart, amount: number, crit: boolean): number {
    if (this.dead || !this.awake || this.invuln || this.transitioning || part.invuln) return 0;
    if (part.hp > 0 || part.maxHp > 0) return this.damageSubPart(part, amount);
    const dmg = amount * this.damageTakenMult();
    this.hp -= dmg;
    this.flash = 1;
    part.flash = 1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return dmg;
    }
    const ph = this.def.phases;
    const ratio = this.hp / this.maxHp;
    if (!this.encore && this.phase + 1 < ph.length && ratio <= ph[this.phase + 1].at) this.transition(this.phase + 1);
    return dmg;
  }

  protected damageTakenMult(): number {
    return 1;
  }

  protected damageSubPart(part: BossPart, amount: number): number {
    part.hp -= amount;
    part.flash = 1;
    if (part.hp <= 0) this.onSubPartDestroyed(part);
    return amount;
  }
  protected onSubPartDestroyed(part: BossPart): void {
    this.removePart(part);
  }

  private transition(next: number): void {
    const g = this.g;
    this.phase = next;
    this.transitioning = true;
    if (this.attackCo) this.attackCo.cancel();
    this.co.list = this.co.list.filter((c) => !c.done);
    g.clearHazardsOf(this.uid);
    this.busy = true;
    this.casting = true;
    this.windup = 0;
    g.hitstop = 0.25;
    g.fx.push('flash', this.x, this.y, 0.5);
    g.fx.push('shake', this.x, this.y, 0.7);
    g.bus.emit('boss_phase', { id: this.def.id, phase: next, name: this.def.phases[next].name });
    g.bus.emit('sfx', { id: 'roar', vol: 1 });
    this.anim = 'phase';
    this.co.start(this.transitionCo(next));
  }

  private *transitionCo(next: number): Co {
    yield 1.4;
    const extra = this.onPhase(next);
    if (extra) this.co.start(extra);
    this.transitioning = false;
    this.casting = false;
    this.busy = false;
    this.anim = 'idle';
  }

  private die(): void {
    const g = this.g;
    this.dead = true;
    this.invuln = true;
    this.co.cancelAll();
    g.clearHazardsOf(this.uid);
    for (const b of g.bullets) b.alive = false;
    for (const p of this.parts.slice()) if (p.kind !== 'body') this.removePart(p);
    this.body.invuln = true;
    this.anim = 'defeat';
    this.animT = 0;
    g.hitstop = 0.45;
    g.fx.push('flash', this.x, this.y, 0.8);
    g.fx.push('shake', this.x, this.y, 1);
    g.bus.emit('sfx', { id: 'bossdie', vol: 1 });
    this.co.start(this.deathWrap());
  }

  private *deathWrap(): Co {
    yield* this.defeatSequence();
    const g = this.g;
    // Reward (doc 05 shared rules): guaranteed chest, ticket burst, small heal.
    g.spawnPickup('chest', this.x, this.y + 20, 0).rolls = this.encore ? 3 : g.rng.int(4, 6);
    for (let i = 0; i < 16; i++) {
      const a = g.rng.angle();
      const pk = g.spawnPickup('ticket', this.x, this.y, Math.round(6 + g.minutes));
      pk.vx = Math.cos(a) * g.rng.range(150, 420);
      pk.vy = Math.sin(a) * g.rng.range(150, 420);
    }
    g.healPlayer(g.player.stats.maxHp() * 0.2);
    g.registerBossDefeat(this.encore ? 'encore_ringmaster' : this.def.id, g.player.bossDamageTaken === 0);
    g.bus.emit('music', { cue: g.endless ? 'endless' : `act${Math.min(4, g.act + (this.def.id === 'ringmaster' ? 0 : 0))}` });
    if (!this.encore) g.bossRemains.push({ id: this.def.id, x: this.x, y: this.y });
    yield 0.5;
  }

  private finishRemoval(): void {
    if (this.removed) return;
    this.removed = true;
    for (const p of this.parts.slice()) this.removePart(p);
  }

  contactCheck(): void {
    if (!this.awake || this.dead || !this.introDone) return;
    const p = this.g.player;
    for (const part of this.parts) {
      if (part.kind !== 'body' && part.kind !== 'contact') continue;
      const rr = part.r * 0.8 + p.r;
      if (dist2(part.x, part.y, p.x, p.y) < rr * rr) {
        this.g.hurtPlayer(this.def.contact * this.dmgMult, part.x, part.y);
        return;
      }
    }
  }

  // ---------------------------------------------------------------- helpers for attacks
  hz(shape: HazardShape, style: string, x: number, y: number, o: Partial<Hazard> = {}): Hazard {
    const h = this.g.spawnHazard(shape, style, x, y, { ...o, owner: this.uid });
    if (o.dmg !== undefined) h.dmg = o.dmg * this.dmgMult;
    return h;
  }
  bullet(kind: Parameters<Game['spawnBullet']>[0], x: number, y: number, a: number, speed: number, dmg: number, o: Parameters<Game['spawnBullet']>[6] = {}) {
    return this.g.spawnBullet(kind, x, y, Math.cos(a) * speed, Math.sin(a) * speed, dmg * this.dmgMult, o);
  }
  angleToPlayer(fromX = this.x, fromY = this.y): number {
    return Math.atan2(this.g.player.y - fromY, this.g.player.x - fromX);
  }
  distToPlayer(): number {
    return Math.hypot(this.g.player.x - this.x, this.g.player.y - this.y);
  }
  sfx(id: string, vol = 0.8, pitch = 1): void {
    this.g.bus.emit('sfx', { id, vol, pitch, x: this.x, y: this.y });
  }
  banner(text: string, sub?: string): void {
    this.g.bus.emit('banner', { text, sub, style: 'boss' });
  }
  addsMult(): number {
    return this.enraged ? 1.5 : 1;
  }
  /** Move toward a point over `time` seconds (coroutine helper). */
  *moveTo(x: number, y: number, speed: number): Co {
    for (let i = 0; i < 600; i++) {
      const dx = x - this.x, dy = y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < speed / 60 + 1) {
        this.x = x;
        this.y = y;
        return;
      }
      this.vx = (dx / d) * speed;
      this.vy = (dy / d) * speed;
      this.x += this.vx / 60;
      this.y += this.vy / 60;
      if (Math.abs(dx) > 5) this.face = dx > 0 ? 1 : -1;
      yield 1 / 60;
    }
  }
}
