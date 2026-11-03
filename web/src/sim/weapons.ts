// The carnival arsenal (doc 06). Every weapon is a distinct *shape of fire*: fans, homing cards,
// boomerangs, orbits, summons, melee arcs, cones, beams, lobbed explosions, dashes and clones.
// Weapon numbers come from src/data/weapons.ts; behaviour lives here, dispatched by `kind`.

import { clamp, dist2, inSector, TAU } from '../core/math';
import { WEAPONS, weaponLevelSum, type WeaponDef } from '../data/weapons';
import { HitTracker, ignite, stick, type Enemy, type PlayerProjectile, type Summon, type Target } from './entities';
import type { Game } from './game';
import { lineOf } from './meter';
import { KB_SCALE, VIEW_HALF_X, VIEW_HALF_Y } from './constants';
import { bracing } from './enemyAI';
import { lamplight } from './variants';

/** Solo slot counts (VS: six of each); co-op shrinks them per player (`Game.slots`, D-51). */
export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;
/** Mirror clones stop firing projectiles once the pool is this full, leaving the rest for yours (D-74). */
const CLONE_POOL_SHARE = 0.55;
/** At most this many mirror clones however much Amount you have (they share one power: more is only clutter). */
const MAX_CLONES = 4;
/** The orb barrier's first shove (px/s for 0.14 s: about 60 px), and how fast its fatigue wears off. */
const ORB_SHOVE = 430;
/** How far a Nightmare Menagerie bite tears around its target (px, at the evolution's own area). */
const MAUL_R = 48;
/** The Death Card's extra crit multiplier (D-74: 1.5 before). */
const DEATH_CRIT = 0.8;
/** Bosses can't burn or be chilled, so the grills and the frost machines hit them this much harder (D-74). */
const UNBURNT = 1.6;
const UNCHILLED = 2;
/** ...and the Blizzard's storm, which never stops, three times as hard */
const STORM_BITE = 3;
/**
 * Mira's Glass Halo (D-78): an aura round each of her mirror clones (px, times her Area) that cuts every
 * enemy inside it once a second, for `dmg` + `perLevel` per mirror level past the first (times Might;
 * the Hall of Mirrors' clones `evo` times that). It is her only damage until she drafts a weapon.
 */
export const MIRA_HALO = { r: 85, dmg: 12, perLevel: 2, evo: 1.25, every: 1 };
export const miraHaloRadius = (p: { stats: { area: number } }): number => MIRA_HALO.r * p.stats.area;

export class WeaponInst {
  def: WeaponDef;
  level = 1;
  cd = 0.4;
  t = 0;
  n = 0; // volley counter
  angle = 0;
  active = false;
  activeT = 0;
  orbHits: HitTracker[] = [];
  dashHits = new HitTracker();
  tickAcc = 0;
  constructor(def: WeaponDef) {
    this.def = def;
  }
}

type CastFn = (ox: number, oy: number, mult: number) => void;

export class Weapons {
  list: WeaponInst[] = [];
  /** delayed parts of attacks, each with the source it was dealt as (see `src`) */
  private queue: { t: number; fn: () => void; src: string }[] = [];
  /**
   * Whose damage the attack being dealt is (D-85): '' for its weapon's own; while a mirror clone replays it,
   * the mirror's. It follows the attack into what it schedules and the projectiles it fires (`src` on them),
   * and their blasts, shrapnel and burns, so all the clones do is the mirror's damage and none of it the
   * replayed weapon's.
   */
  private src = '';
  /** how many of the mirror clones' shots have lately been dropped for room in the pool (smoothed, 0..1) */
  private cloneDrop = 0;
  /** Mirror clones currently alive (positions) — attacks are replayed from them. */
  clones: Summon[] = [];

  constructor(private g: Game) {}

  // ---------------------------------------------------------------- inventory
  has(id: string): boolean {
    return this.list.some((w) => w.def.id === id);
  }
  get(id: string): WeaponInst | undefined {
    return this.list.find((w) => w.def.id === id);
  }
  hasRoom(): boolean {
    return this.list.length < this.g.slots.weapons;
  }
  add(id: string): WeaponInst | null {
    const def = WEAPONS[id];
    if (!def || this.has(id) || !this.hasRoom()) return null;
    const w = new WeaponInst(def);
    this.list.push(w);
    // when it joined the build: its damage meter row counts its damage per second from here (D-85)
    const since = this.g.player.dmgSince;
    if (!since.has(lineOf(id))) since.set(lineOf(id), this.g.time);
    return w;
  }
  levelUp(id: string): void {
    const w = this.get(id);
    if (w && w.level < w.def.maxLevel) w.level++;
  }
  evolve(baseId: string): string | null {
    const w = this.get(baseId);
    if (!w || !w.def.evolvesTo) return null;
    const evo = WEAPONS[w.def.evolvesTo];
    this.clearOwned(w.def.id);
    w.def = evo;
    w.level = 1;
    w.cd = 0.2;
    w.t = 0;
    w.n = 0;
    w.active = false;
    w.orbHits = [];
    this.g.evolutions.push(evo.id);
    this.g.fx.push('evolve', this.g.player.x, this.g.player.y, 0, 0, 0, evo.id);
    this.g.hitstop = 0.35;
    this.g.bus.emit('evolved', { from: baseId, to: evo.id });
    this.g.bus.emit('discover', { id: evo.id });
    return evo.id;
  }
  private clearOwned(weaponId: string): void {
    for (const s of this.g.summons) if (s.alive && s.weapon === weaponId) s.alive = false;
    for (const p of this.g.projs) if (p.alive && p.weapon === weaponId) p.alive = false;
  }

  // ---------------------------------------------------------------- computed stats
  private charMult(w: WeaponInst): number {
    const q = this.g.player.char.quirk;
    if (q === 'ringleader') return w.def.isSummon ? 1.4 : 0.85;
    if (q === 'balloon_shield' && w.def.kind === 'plush') return 1.2;
    return 1;
  }
  damage(w: WeaponInst): number {
    return (w.def.damage + weaponLevelSum(w.def.lv.dmg, w.level)) * this.g.player.stats.might * this.charMult(w);
  }
  cooldown(w: WeaponInst): number {
    return Math.max(0.08, (w.def.cooldown + weaponLevelSum(w.def.lv.cd, w.level)) * this.g.player.stats.cooldown);
  }
  area(w: WeaponInst): number {
    return (w.def.area + weaponLevelSum(w.def.lv.area, w.level)) * this.g.player.stats.area;
  }
  amount(w: WeaponInst): number {
    return w.def.amount + weaponLevelSum(w.def.lv.amount, w.level) + this.g.player.stats.amount;
  }
  speed(w: WeaponInst): number {
    return (w.def.speed + weaponLevelSum(w.def.lv.spd, w.level)) * this.g.player.stats.projSpeed;
  }
  duration(w: WeaponInst): number {
    return (w.def.duration + weaponLevelSum(w.def.lv.dur, w.level)) * this.g.player.stats.duration;
  }
  pierce(w: WeaponInst): number {
    return w.def.pierce + weaponLevelSum(w.def.lv.pierce, w.level);
  }

  /** Roll crit and return final damage for one hit. */
  roll(w: WeaponInst, base: number): { dmg: number; crit: boolean } {
    const st = this.g.player.stats;
    const crit = st.critRoll(this.g.rng.next(), w.def.critBonus ?? 0);
    const cm = st.critDamage + (w.def.id === 'death_card' ? DEATH_CRIT : 0);
    return { dmg: crit ? base * cm : base, crit };
  }

  hit(w: WeaponInst, t: Target, base: number, ox: number, oy: number, kbMult = 1): void {
    const r = this.roll(w, base);
    this.g.damageTarget(t, r.dmg, r.crit, w.def.knockback * kbMult, ox, oy, this.src || w.def.id);
    if (r.crit) this.g.fx.own('crit', t.x, t.y);
  }

  schedule(delay: number, fn: () => void): void {
    this.queue.push({ t: delay, fn, src: this.src });
  }

  /** Execute a discrete attack at the player and replay it from every mirror clone. */
  private cast(w: WeaponInst, fn: CastFn): void {
    const p = this.g.player;
    fn(p.x, p.y, 1);
    if (this.clones.length) {
      const mw = this.list.find((x) => x.def.kind === 'mirror');
      if (!mw) return;
      // the mirror's "damage" is the clones' total share of yours, split between them (D-61), so more
      // clones (Amount) spread the reflection around without multiplying it
      const live = this.clones.filter((c) => c.alive);
      const mult = this.damage(mw) / this.g.player.stats.might / Math.max(1, live.length);
      // what they deal is the mirror's damage, not the replayed weapon's (D-85)
      const src = this.src;
      this.src = mw.def.id;
      for (const c of live) fn(c.x, c.y, mult);
      this.src = src;
    }
  }

  // ---------------------------------------------------------------- aiming
  private aimDir(w: WeaponInst, ox: number, oy: number, mode: 'nearest' | 'random' | 'forward', range = 900): { x: number; y: number; t: Target | null } {
    const inp = this.g.input;
    const aimMode = this.g.player.aimMode;
    if (w.def.aimable && (aimMode === 'manual' || (aimMode === 'hybrid' && inp.aimActive))) {
      const l = Math.hypot(inp.aimX, inp.aimY) || 1;
      return { x: inp.aimX / l, y: inp.aimY / l, t: null };
    }
    let t: Target | null = null;
    if (mode === 'nearest') t = this.g.nearestTarget(ox, oy, range);
    else if (mode === 'random') t = this.g.randomTarget(ox, oy, range);
    if (t) {
      const dx = t.x - ox, dy = t.y - oy;
      const l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l, t };
    }
    const p = this.g.player;
    if (mode === 'forward' || !t) return { x: p.faceX || 1, y: p.faceY, t: null };
    return { x: 1, y: 0, t: null };
  }

  // ---------------------------------------------------------------- update
  update(dt: number): void {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.t -= dt;
      if (q.t <= 0) {
        this.queue.splice(i, 1);
        this.src = q.src;
        q.fn();
        this.src = '';
      }
    }
    this.clones = this.g.summons.filter((s) => s.alive && s.kind === 'clone');
    for (const w of this.list) {
      switch (w.def.kind) {
        case 'cards': this.cards(w, dt); break;
        case 'mallet': this.mallet(w, dt); break;
        case 'tarot': this.tarot(w, dt); break;
        case 'bumper': this.bumper(w, dt); break;
        case 'plush': this.plush(w, dt); break;
        case 'tophat': this.tophat(w, dt); break;
        case 'popcorn': this.popcorn(w, dt); break;
        case 'darts': this.darts(w, dt); break;
        case 'fireworks': this.fireworks(w, dt); break;
        case 'cotton': this.cotton(w, dt); break;
        case 'rings': this.rings(w, dt); break;
        case 'cannon': this.cannon(w, dt); break;
        case 'snowcone': this.snowcone(w, dt); break;
        case 'grill': this.grill(w, dt); break;
        case 'laser': this.laser(w, dt); break;
        case 'orbs': this.orbs(w, dt); break;
        case 'bell': this.bell(w, dt); break;
        case 'mirror': this.mirror(w, dt); break;
        case 'calliope': this.calliope(w, dt); break;
        case 'lantern': this.lantern(w, dt); break;
        case 'chains': this.chains(w, dt); break;
        case 'breath': this.breath(w, dt); break;
      }
    }
  }

  private ready(w: WeaponInst, dt: number): boolean {
    w.cd -= dt;
    if (w.cd > 0) return false;
    w.cd += this.cooldown(w);
    if (w.cd < 0) w.cd = this.cooldown(w) * 0.5;
    return true;
  }

  private sfx(id: string, vol = 0.5, pitch = 1): void {
    this.g.bus.emit('sfx', { id, vol, pitch });
  }

  // ---- Throwing Cards / Royal Flush: forward fan (+ spiral storm when evolved)
  private cards(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    const evo = w.def.id === 'royal_flush';
    const n = this.amount(w);
    this.cast(w, (ox, oy, mult) => {
      const aim = this.aimDir(w, ox, oy, 'nearest');
      const base = Math.atan2(aim.y, aim.x);
      const step = Math.min(0.21, 1.05 / Math.max(1, n - 1));
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? (i - (n - 1) / 2) * step : 0);
        this.proj(w, evo ? 'gold_card' : 'card', ox, oy, a, this.speed(w), { r: 9 * this.area(w), mult });
      }
      if (evo) {
        w.n++;
        const spiral = 8;
        for (let i = 0; i < spiral; i++) {
          const a = w.n * 0.45 + (i * TAU) / spiral;
          const p = this.proj(w, 'gold_card', ox, oy, a, this.speed(w) * 0.8, { r: 9 * this.area(w), mult, life: this.duration(w) * 1.2 });
          if (p) p.spin = 1.6;
        }
      }
    });
    this.sfx('card', 0.35, evo ? 1.2 : 1);
  }

  private proj(w: WeaponInst, kind: PlayerProjectile['kind'], x: number, y: number, a: number, speed: number, o: { r?: number; mult?: number; life?: number; pierce?: number } = {}): PlayerProjectile | null {
    // a mirror clone's shot (a fraction of yours) never takes a slot your own would need (D-74): with
    // many clones and a big volley the pool filled up and your full-strength shots failed to fire
    if ((o.mult ?? 1) < 1 && this.cloneShotDropped()) return null;
    const p = this.g.spawnProj();
    if (!p) return null;
    p.kind = kind;
    p.weapon = w.def.id;
    p.src = this.src;
    p.x = p.px = p.ox = x;
    p.y = p.py = p.oy = y;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.rot = a;
    p.r = o.r ?? 8;
    p.mult = o.mult ?? 1;
    p.dmg = this.damage(w) * p.mult * (p.mult < 1 ? this.cloneBoost() : 1);
    p.pierce = o.pierce ?? this.pierce(w);
    p.life = p.maxLife = o.life ?? this.duration(w);
    p.kb = w.def.knockback;
    p.area = this.area(w);
    return p;
  }

  /** Drop this clone shot? (the pool is full enough that your own shots need the room, D-74) */
  private cloneShotDropped(): boolean {
    const drop = this.g.projLoad > CLONE_POOL_SHARE;
    this.cloneDrop += ((drop ? 1 : 0) - this.cloneDrop) * 0.02;
    return drop;
  }
  /** The clone shots that do fire carry the share of the ones dropped (up to three times their own). */
  private cloneBoost(): number {
    return 1 / Math.max(1 / 3, 1 - this.cloneDrop);
  }

  // ---- Whack-a-Mole Mallet / Whack Frenzy: melee arcs around the player
  private mallet(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    const R = 68 * this.area(w);
    if (w.def.id === 'whack_frenzy') {
      w.n++;
      const pound = w.n % 4 === 0;
      this.cast(w, (ox, oy, mult) => {
        this.g.forEachTargetInCircle(ox, oy, R, (t) => this.hit(w, t, this.damage(w) * mult, ox, oy));
        this.g.fx.own('slash', ox, oy, w.n * 1.7, Math.PI, R, 'frenzy');
        if (pound) {
          this.g.forEachTargetInCircle(ox, oy, R * 1.5, (t) => this.hit(w, t, this.damage(w) * 1.5 * mult, ox, oy, 1.5));
          this.g.fx.own('ring', ox, oy, R * 1.5, 0, 0, 'pound');
          this.g.fx.push('shake', ox, oy, 0.3);
        }
      });
      this.sfx(pound ? 'stomp' : 'whack', pound ? 0.6 : 0.3, 1.1);
      return;
    }
    const n = this.amount(w);
    this.cast(w, (ox, oy, mult) => {
      const aim = this.aimDir(w, ox, oy, 'nearest', 260);
      const a = Math.atan2(aim.y, aim.x);
      const swing = (ang: number) => {
        this.g.forEachTargetInCircle(ox, oy, R, (t) => {
          if (inSector(t.x, t.y, ox, oy, ang, 1.15, R, t.r)) this.hit(w, t, this.damage(w) * mult, ox, oy);
        });
        this.g.fx.own('slash', ox, oy, ang, 1.15, R, 'mallet');
      };
      swing(a);
      if (n >= 2) this.schedule(0.14, () => swing(a + Math.PI));
      if (n >= 3) this.schedule(0.3, () => {
        const p = this.g.player;
        const cx = mult === 1 ? p.x : ox, cy = mult === 1 ? p.y : oy;
        this.g.forEachTargetInCircle(cx, cy, R * 0.9, (t) => this.hit(w, t, this.damage(w) * 0.8 * mult, cx, cy, 1.4));
        this.g.fx.own('ring', cx, cy, R * 0.9, 0, 0, 'pound');
      });
    });
    this.sfx('whack', 0.45);
  }

  // ---- Tarot Toss / The Death Card: homing cards
  private tarot(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    const evo = w.def.id === 'death_card';
    const n = this.amount(w);
    this.cast(w, (ox, oy, mult) => {
      for (let i = 0; i < n; i++) {
        const t = this.g.randomTarget(ox, oy, 650) ?? this.g.nearestTarget(ox, oy, 900);
        const a = t ? Math.atan2(t.y - oy, t.x - ox) + this.g.rng.range(-0.6, 0.6) : this.g.rng.angle();
        const p = this.proj(w, evo ? 'death_card' : 'tarot', ox, oy, a, this.speed(w), { r: (evo ? 14 : 9) * this.area(w), mult });
        if (p) {
          p.homing = evo ? 3.2 : 5.5;
          p.target = t ? t.uid : -1;
        }
      }
    });
    this.sfx(evo ? 'deathcard' : 'tarot', 0.35);
  }

  // ---- Bumper Car / Demolition Derby: surge-ram (mobility) and phantom pinball cars
  private bumper(w: WeaponInst, dt: number): void {
    const p = this.g.player;
    if (w.def.id === 'demolition_derby') {
      // Ramming aura while moving.
      w.tickAcc -= dt;
      if (p.moving && w.tickAcc <= 0) {
        w.tickAcc = 0.2;
        this.g.forEachTargetInCircle(p.x, p.y, 85 * this.area(w), (t) => this.hit(w, t, this.damage(w) * 0.75, p.x, p.y));
      }
      // Keep `amount` phantom cars pinballing through the crowd.
      let alive = 0;
      for (const pr of this.g.projs) if (pr.alive && pr.weapon === w.def.id) alive++;
      w.cd -= dt;
      if (alive < this.amount(w) && w.cd <= 0) {
        w.cd = this.cooldown(w);
        // launched at somebody in the crowd (D-74: a random heading mostly found nobody)
        const t = this.g.randomTarget(p.x, p.y, 520);
        const a = t ? Math.atan2(t.y - p.y, t.x - p.x) : this.g.rng.angle();
        const pr = this.proj(w, 'derby_car', p.x, p.y, a, this.speed(w), { r: 28 * this.area(w), life: 5, pierce: 999 });
        if (pr) pr.rehit = 0.4;
        this.sfx('engine', 0.3);
      }
      return;
    }
    if (p.dashT > 0) {
      // during the surge: ram everything along the way
      const R = 40 * this.area(w);
      this.g.forEachTargetInCircle(p.x, p.y, R, (t) => {
        if (w.dashHits.recent(t.uid, this.g.realTime, -1)) return;
        w.dashHits.mark(t.uid, this.g.realTime);
        this.hit(w, t, this.damage(w), p.x - p.dashX * 30, p.y - p.dashY * 30);
      });
      return;
    }
    w.cd -= dt;
    if (w.cd > 0 || !p.moving) return;
    w.cd = this.cooldown(w);
    w.dashHits.reset();
    // D-74: every surge peels out with a spin that bumps everything around you — the crowd chasing you
    // while you kite is behind you, where the surge itself never reaches
    const bumpR = 105 * this.area(w);
    this.cast(w, (ox, oy, mult) => {
      this.g.forEachTargetInCircle(ox, oy, bumpR, (t) => this.hit(w, t, this.damage(w) * 1.6 * mult, ox, oy, 0.8));
      this.g.fx.own('ring', ox, oy, bumpR, 0, 0, 'pound');
    });
    p.dashT = this.duration(w);
    p.dashX = p.faceX;
    p.dashY = p.faceY;
    p.dashSpeed = this.speed(w);
    this.g.fx.own('dust', p.x, p.y, 1);
    this.sfx('coaster', 0.5);
    const escorts = this.amount(w) - 1;
    for (let i = 0; i < escorts; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const off = 52 * (1 + Math.floor(i / 2));
      // escorts peel off toward the crowd (D-74), not alongside you into empty road
      const t = this.g.randomTarget(p.x, p.y, 460);
      const ex = p.x - p.faceY * off * side, ey = p.y + p.faceX * off * side;
      const a = t ? Math.atan2(t.y - ey, t.x - ex) : Math.atan2(p.faceY, p.faceX);
      const pr = this.proj(w, 'bumper_ghost', ex, ey, a, p.dashSpeed, { r: 24 * this.area(w), life: 0.7, pierce: 999 });
      if (pr) pr.kb = 3;
    }
  }

  // ---- Plush Companion / Nightmare Menagerie: pets that pounce
  private plush(w: WeaponInst, dt: number): void {
    const evo = w.def.id === 'nightmare_menagerie';
    const want = this.amount(w);
    this.syncSummons(w, want, () => 'plush');
  }

  private syncSummons(w: WeaponInst, want: number, kindFn: (i: number) => Summon['kind']): void {
    let have = 0;
    for (const s of this.g.summons) if (s.alive && s.weapon === w.def.id) have++;
    const p = this.g.player;
    let slot = 0;
    while (have < want) {
      const s = this.g.spawnSummon();
      if (!s) break;
      s.kind = kindFn(have);
      s.weapon = w.def.id;
      s.x = s.px = p.x;
      s.y = s.py = p.y;
      s.slot = have;
      s.variant = have % 4;
      s.life = 1e9;
      have++;
      slot++;
    }
    if (have > want) {
      for (const s of this.g.summons) {
        if (have <= want) break;
        if (s.alive && s.weapon === w.def.id) {
          s.alive = false;
          have--;
        }
      }
    }
  }

  // ---- Top Hat / Grand Menagerie: helpers pulled from the hat
  private tophat(w: WeaponInst, dt: number): void {
    const p = this.g.player;
    if (w.def.id === 'grand_menagerie') {
      const n = Math.max(3, this.amount(w));
      this.syncSummons(w, n, (i) => (i === 0 ? 'lion' : i === 1 ? 'elephant' : 'acrobat'));
      return;
    }
    if (!this.ready(w, dt)) return;
    const n = this.amount(w);
    const maxAlive = n * 2;
    const mine = this.g.summons.filter((s) => s.alive && s.weapon === w.def.id);
    mine.sort((a, b) => a.life - b.life);
    for (let i = 0; i < n; i++) {
      if (mine.length >= maxAlive) {
        const old = mine.shift();
        if (old) old.alive = false;
      }
      const s = this.g.spawnSummon();
      if (!s) break;
      s.kind = (w.n + i) % 2 === 0 ? 'rabbit' : 'dove';
      s.weapon = w.def.id;
      const a = this.g.rng.angle();
      s.x = s.px = p.x + Math.cos(a) * 10;
      s.y = s.py = p.y + Math.sin(a) * 10;
      s.vx = Math.cos(a) * 200;
      s.vy = Math.sin(a) * 200 - 120;
      s.life = this.duration(w);
      s.cd = 0.3;
      mine.push(s);
    }
    w.n += n;
    this.g.fx.own('spark', p.x, p.y - 30, 6, 0, 0, 'magic');
    this.sfx('hatpop', 0.45);
  }

  // ---- Popcorn Popper / Kettle-Korn Cannon: lobbed kernels that pop
  private popcorn(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    const evo = w.def.id === 'kettle_korn';
    const n = evo ? 1 + Math.floor(this.g.player.stats.amount / 2) : this.amount(w);
    this.cast(w, (ox, oy, mult) => {
      for (let i = 0; i < n; i++) {
        let tx: number, ty: number;
        const t = evo ? (this.g.rng.chance(0.6) ? this.g.randomTarget(ox, oy, 420) : null) : this.g.randomTarget(ox, oy, 460);
        if (t) {
          tx = t.x + this.g.rng.range(-24, 24);
          ty = t.y + this.g.rng.range(-24, 24);
        } else {
          const a = this.g.rng.angle();
          const d = this.g.rng.range(60, evo ? 400 : 260);
          tx = ox + Math.cos(a) * d;
          ty = oy + Math.sin(a) * d;
        }
        this.lob(w, 'kernel', ox, oy, tx, ty, evo ? 0.38 : this.duration(w), mult);
      }
    });
    if (!evo || w.n++ % 3 === 0) this.sfx('popcornlaunch', 0.25);
  }

  private lob(w: WeaponInst, kind: PlayerProjectile['kind'], ox: number, oy: number, tx: number, ty: number, flight: number, mult: number): PlayerProjectile | null {
    if (mult < 1 && this.cloneShotDropped()) return null;
    const p = this.g.spawnProj();
    if (!p) return null;
    p.kind = kind;
    p.weapon = w.def.id;
    p.src = this.src;
    p.x = p.px = p.ox = ox;
    p.y = p.py = p.oy = oy;
    p.tx = tx;
    p.ty = ty;
    p.life = p.maxLife = Math.max(0.15, flight);
    p.vx = (tx - ox) / p.maxLife;
    p.vy = (ty - oy) / p.maxLife;
    p.mult = mult;
    p.dmg = this.damage(w) * mult * (mult < 1 ? this.cloneBoost() : 1);
    p.area = this.area(w);
    p.kb = w.def.knockback;
    p.arc = kind === 'shell' ? 160 : kind === 'rocket' ? 90 : 60;
    p.pierce = 0;
    p.r = 0; // no in-flight collision
    return p;
  }

  // ---- Balloon Darts / Sharpshooter's Bouquet
  private darts(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    const n = this.amount(w);
    this.cast(w, (ox, oy, mult) => {
      const aim = this.aimDir(w, ox, oy, 'nearest');
      const base = Math.atan2(aim.y, aim.x);
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? (i - (n - 1) / 2) * 0.14 : 0);
        this.proj(w, 'dart', ox, oy, a, this.speed(w), { r: 7 * this.area(w), mult });
      }
    });
    this.sfx('dart', 0.3);
  }

  // ---- Fireworks / Grand Finale: consecutive lobbed rockets → scattered explosions
  private fireworks(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    const evo = w.def.id === 'grand_finale';
    const n = this.amount(w);
    const interval = evo ? 0.08 : 0.12;
    w.n++;
    const finale = evo && w.n % 4 === 0;
    for (let i = 0; i < n; i++) {
      this.schedule(i * interval, () => {
        this.cast(w, (ox, oy, mult) => {
          const t = this.g.randomTarget(ox, oy, 620);
          let tx: number, ty: number;
          if (t) {
            tx = t.x + this.g.rng.range(-40, 40);
            ty = t.y + this.g.rng.range(-40, 40);
          } else {
            const a = this.g.rng.angle();
            const d = this.g.rng.range(120, 360);
            tx = ox + Math.cos(a) * d;
            ty = oy + Math.sin(a) * d;
          }
          const dist = Math.hypot(tx - ox, ty - oy);
          this.lob(w, 'rocket', ox, oy, tx, ty, clamp(dist / this.speed(w), 0.35, 1.1) * this.g.rng.range(0.85, 1.15), mult);
        });
        this.sfx('rocket', 0.25, 0.9 + this.g.rng.next() * 0.3);
      });
    }
    if (finale) {
      this.schedule(n * interval + 0.1, () => {
        const p = this.g.player;
        const t = this.g.nearestTarget(p.x, p.y, 700);
        const tx = t ? t.x : p.x + p.faceX * 220, ty = t ? t.y : p.y + p.faceY * 220;
        this.lob(w, 'shell', p.x, p.y, tx, ty, 0.9, 1);
        this.sfx('rocket', 0.5, 0.6);
      });
    }
  }

  // ---- Cotton-Candy Gun / Sticky Situation
  private cotton(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    if (w.def.id === 'sticky_situation') {
      const n = this.amount(w);
      const p = this.g.player;
      for (let i = 0; i < n; i++) {
        const t = this.g.randomTarget(p.x, p.y, 420);
        const x = t ? t.x : p.x + this.g.rng.range(-200, 200), y = t ? t.y : p.y + this.g.rng.range(-200, 200);
        const z = this.g.spawnZone('web', x, y, 78 * this.area(w), this.duration(w), this.damage(w), 0.5);
        if (z) z.slow = 0.55;
      }
      this.sfx('squish', 0.35);
      return;
    }
    const R = 150 * this.area(w);
    const n = this.amount(w);
    this.cast(w, (ox, oy, mult) => {
      const aim = this.aimDir(w, ox, oy, 'nearest', R * 1.4);
      const a0 = Math.atan2(aim.y, aim.x);
      for (let k = 0; k < Math.min(n, 2); k++) {
        const a = a0 + k * Math.PI;
        for (let tick = 0; tick < 3; tick++) {
          this.schedule(tick * 0.16, () => {
            const p = this.g.player;
            const cx = mult === 1 ? p.x : ox, cy = mult === 1 ? p.y : oy;
            this.g.forEachTargetInCircle(cx, cy, R, (t) => {
              if (!inSector(t.x, t.y, cx, cy, a, 0.45, R, t.r)) return;
              this.hit(w, t, this.damage(w) * mult, cx, cy);
              if (!t.isBoss) stick(t as Enemy, this.duration(w), this.damage(w) * 0.5, this.src || w.def.id, this.g.player.index);
            });
          });
        }
        this.g.fx.own('slash', ox, oy, a, 0.45, R, 'cotton');
      }
    });
    this.sfx('spray', 0.3);
  }

  // ---- Ring Toss / Saturn's Rings
  private rings(w: WeaponInst, dt: number): void {
    if (w.def.id === 'saturn_rings') {
      const n = this.amount(w);
      while (w.orbHits.length < n) w.orbHits.push(new HitTracker());
      w.angle += this.speed(w) * dt;
      const p = this.g.player;
      const size = 20 * this.area(w);
      w.tickAcc -= dt;
      for (let i = 0; i < n; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const R = 130 + i * 60;
        const a = w.angle * dir * (1 - i * 0.12) + (i * TAU) / n;
        const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
        const ht = w.orbHits[i];
        this.g.forEachTargetInCircle(x, y, size, (t) => {
          if (ht.recent(t.uid, this.g.realTime, 0.3)) return;
          ht.mark(t.uid, this.g.realTime);
          this.hit(w, t, this.damage(w), x, y);
        });
      }
      return;
    }
    if (!this.ready(w, dt)) return;
    const n = this.amount(w);
    this.cast(w, (ox, oy, mult) => {
      const aim = this.aimDir(w, ox, oy, 'nearest');
      const base = Math.atan2(aim.y, aim.x);
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? (i - (n - 1) / 2) * (0.52 / Math.max(1, n - 1)) * 2 : 0);
        const p = this.proj(w, 'ring', ox, oy, a, this.speed(w), { r: 14 * this.area(w), mult, pierce: 999 });
        if (p) p.rehit = 0.65;
      }
    });
    this.sfx('ringtoss', 0.35);
  }

  // ---- Carnival Cannon / Cannonball Special
  private cannon(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    const n = this.amount(w);
    const evo = w.def.id === 'cannonball_special';
    this.cast(w, (ox, oy, mult) => {
      const aim = this.aimDir(w, ox, oy, 'nearest');
      const base = Math.atan2(aim.y, aim.x);
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? (i - (n - 1) / 2) * 0.16 : 0);
        const p = this.proj(w, 'cannonball', ox, oy, a, this.speed(w), { r: 20 * this.area(w), mult, pierce: 999 });
        if (p) {
          p.rehit = -1;
          p.flag = evo ? 1 : 0;
          p.crit = w.def.critBonus ?? 0;
        }
      }
      this.g.fx.own('spark', ox + aim.x * 20, oy + aim.y * 20, 6, base, 0, 'smoke');
    });
    this.g.fx.push('shake', this.g.player.x, this.g.player.y, 0.15);
    this.sfx('cannon', 0.55);
  }

  // ---- Snow-Cone Machine / Blizzard Machine
  private snowcone(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    if (w.def.id === 'blizzard') {
      const p = this.g.player;
      const R = 170 * this.area(w);
      this.g.forEachTargetInCircle(p.x, p.y, R, (t) => {
        this.hit(w, t, this.damage(w) * (t.isBoss ? STORM_BITE : 1), p.x, p.y);
        if (!t.isBoss) this.g.applyChill(t as Enemy, 2, this.duration(w));
      });
      this.g.fx.own('ring', p.x, p.y, R, 0, 0, 'blizzard');
      this.sfx('frost', 0.3);
      return;
    }
    const R = 160 * this.area(w);
    const n = this.amount(w);
    this.cast(w, (ox, oy, mult) => {
      const aim = this.aimDir(w, ox, oy, 'nearest', R * 1.4);
      const a0 = Math.atan2(aim.y, aim.x);
      const cones = n >= 3 ? [0, -0.75, 0.75] : [0];
      for (const off of cones) {
        const a = a0 + off;
        this.g.forEachTargetInCircle(ox, oy, R, (t) => {
          if (!inSector(t.x, t.y, ox, oy, a, 0.5, R, t.r)) return;
          this.hit(w, t, this.damage(w) * mult * (t.isBoss ? UNCHILLED : 1), ox, oy);
          if (!t.isBoss) this.g.applyChill(t as Enemy, 1, this.duration(w));
        });
        this.g.fx.own('slash', ox, oy, a, 0.5, R, 'frost');
      }
    });
    this.sfx('frost', 0.3);
  }

  // ---- Hot-Dog Grill / Inferno Grill
  private grill(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    const p0 = this.g.player;
    if (w.def.id === 'inferno_grill') {
      const maxR = 190 * this.area(w);
      for (let k = 1; k <= 4; k++) {
        this.schedule(k * 0.07, () => {
          const p = this.g.player;
          const r1 = (maxR * k) / 4, r0 = (maxR * (k - 1)) / 4;
          this.g.forEachTargetInCircle(p.x, p.y, r1, (t) => {
            const d = Math.sqrt(dist2(t.x, t.y, p.x, p.y));
            if (d + t.r < r0) return;
            this.hit(w, t, this.damage(w) * (t.isBoss ? UNBURNT : 1), p.x, p.y);
            if (!t.isBoss) ignite(t as Enemy, this.duration(w), this.damage(w) * 0.6, this.src || w.def.id, this.g.player.index);
          });
        });
      }
      this.g.fx.own('ring', p0.x, p0.y, maxR, 0, 0, 'inferno');
      for (let i = 0; i < 5; i++) {
        const a = this.g.rng.angle();
        const d = this.g.rng.range(40, maxR);
        // (D-74: a burning patch's tick no longer stacks with its neighbours', so each one burns hotter)
        this.g.spawnZone('burn', p0.x + Math.cos(a) * d, p0.y + Math.sin(a) * d, 46 * this.area(w), this.duration(w), this.damage(w) * 0.75, 0.5);
      }
      this.sfx('flame', 0.45);
      return;
    }
    const R = 140 * this.area(w);
    const n = this.amount(w);
    this.cast(w, (ox, oy, mult) => {
      const aim = this.aimDir(w, ox, oy, 'nearest', R * 1.4);
      const a0 = Math.atan2(aim.y, aim.x);
      for (let k = 0; k < Math.min(2, n); k++) {
        const a = a0 + k * Math.PI;
        for (let tick = 0; tick < 3; tick++) {
          this.schedule(tick * 0.15, () => {
            const p = this.g.player;
            const cx = mult === 1 ? p.x : ox, cy = mult === 1 ? p.y : oy;
            this.g.forEachTargetInCircle(cx, cy, R, (t) => {
              if (!inSector(t.x, t.y, cx, cy, a, 0.38, R, t.r)) return;
              this.hit(w, t, this.damage(w) * mult * (t.isBoss ? UNBURNT : 1), cx, cy);
              if (!t.isBoss) ignite(t as Enemy, this.duration(w), this.damage(w) * 0.6 * mult, this.src || w.def.id, this.g.player.index);
            });
          });
        }
        this.g.fx.own('slash', ox, oy, a, 0.38, R, 'fire');
      }
    });
    this.sfx('flame', 0.3);
  }

  // ---- Laser Light Show / Grand Illumination: rotating beams (state read by the renderer)
  private laser(w: WeaponInst, dt: number): void {
    const evo = w.def.id === 'grand_illumination';
    if (!evo) {
      if (!w.active) {
        w.cd -= dt;
        if (w.cd <= 0) {
          w.active = true;
          w.activeT = this.duration(w);
          this.sfx('laser', 0.35);
        }
      } else {
        w.activeT -= dt;
        if (w.activeT <= 0) {
          w.active = false;
          w.cd = this.cooldown(w);
        }
      }
    } else w.active = true;
    if (!w.active) return;
    w.angle += this.speed(w) * dt;
    // the arc swept since the last strike (D-74: a strike every 0.2 s only cut what lay under a 9 px
    // beam at that instant, so most of the crowd a beam passed over was never touched)
    w.t += this.speed(w) * dt;
    w.tickAcc -= dt;
    if (w.tickAcc > 0) return;
    w.tickAcc = 0.1;
    const sweep = Math.min(w.t, Math.PI);
    w.t = 0;
    const p = this.g.player;
    const n = this.amount(w);
    const L = 260 * this.area(w);
    while (w.orbHits.length < n) w.orbHits.push(new HitTracker());
    for (let i = 0; i < n; i++) {
      const a = this.beamAngle(w, i, n);
      const dir = w.def.id === 'grand_illumination' && i % 2 === 1 ? -1 : 1;
      const mid = a - (dir * sweep) / 2;
      const ht = w.orbHits[i];
      this.g.forEachTargetInCircle(p.x, p.y, L, (t) => {
        if (!inSector(t.x, t.y, p.x, p.y, mid, sweep / 2 + 0.02, L, t.r)) return;
        if (ht.recent(t.uid, this.g.realTime, 0.3)) return;
        ht.mark(t.uid, this.g.realTime);
        this.hit(w, t, this.damage(w), p.x, p.y, 0.3);
      });
    }
  }

  // ---------------------------------------------------------------- the world tiers' weapons (D-97)
  /** The lantern's beams: `w.angle` is the sweep's own (replicated); the Last Light adds beams turning about you. */
  lanternAngle(w: WeaponInst, i: number, n: number): number {
    if (w.def.id === 'last_light') return i === 0 ? w.angle : w.angle + (i * TAU) / n + w.t * 0.35;
    return w.angle + (i - (n - 1) / 2) * 0.38;
  }
  lanternLength(w: WeaponInst): number {
    return 240 * this.area(w);
  }

  /** Watchman's Lantern: a beam sweeping back and forth before you, burning what stays in it. */
  private lantern(w: WeaponInst, dt: number): void {
    w.active = true;
    w.t += dt;
    const p = this.g.player;
    const d = this.aimDir(w, p.x, p.y, 'forward');
    w.angle = Math.atan2(d.y, d.x) + Math.sin(w.t * this.speed(w)) * 0.75;
    w.tickAcc -= dt;
    if (w.tickAcc > 0) return;
    w.tickAcc = 0.1;
    const n = this.amount(w), L = this.lanternLength(w);
    while (w.orbHits.length < n) w.orbHits.push(new HitTracker());
    for (let i = 0; i < n; i++) {
      const a = this.lanternAngle(w, i, n);
      const ht = w.orbHits[i];
      this.g.forEachTargetInCircle(p.x, p.y, L, (t) => {
        if (!inSector(t.x, t.y, p.x, p.y, a, 0.2, L, t.r)) return;
        // the Night Watchman's Lamplight (D-97): what his lantern shows takes more damage and can't phase
        if (p.char.quirk === 'lamplight' && !t.isBoss) lamplight(t as Enemy);
        if (ht.recent(t.uid, this.g.realTime, 0.3)) return;
        ht.mark(t.uid, this.g.realTime);
        this.hit(w, t, this.damage(w), p.x, p.y, 0.3);
      });
    }
  }

  /** Spirit Chains: links leap from creature to creature, each weaker, and bind the last. */
  private chains(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    const p = this.g.player;
    let t = this.g.nearestTarget(p.x, p.y, 320);
    if (!t) {
      w.cd = 0.3;
      return;
    }
    this.sfx('zap', 0.4);
    const links = 3 + this.amount(w), reach = 170 * this.area(w);
    const hit = new Set<number>();
    let dmg = this.damage(w), fx = p.x, fy = p.y;
    for (let k = 0; k < links && t; k++) {
      hit.add(t.uid);
      for (let s = 1; s <= 3; s++) this.g.fx.push('spark', fx + ((t.x - fx) * s) / 4, fy + ((t.y - fy) * s) / 4, 0.7, 0, 0, 'shield');
      this.hit(w, t, dmg, fx, fy, 0.5);
      fx = t.x;
      fy = t.y;
      const reaper = w.def.id === 'reapers_chain';
      if (!reaper) dmg *= 0.85;
      // the Reaper's Chain binds every link it passes
      if (reaper && !t.isBoss) {
        const e = t as Enemy;
        e.slowF = Math.min(e.slowF, 0.5);
        e.slowT = Math.max(e.slowT, this.duration(w));
      }
      let next: Target | null = null, best = reach * reach;
      this.g.forEachTargetInCircle(fx, fy, reach, (o) => {
        if (hit.has(o.uid)) return;
        const d2 = (o.x - fx) ** 2 + (o.y - fy) ** 2;
        if (d2 < best) {
          best = d2;
          next = o;
        }
      });
      // the last one in the chain (nothing left to leap to, or its last link) is bound fast
      if ((!next || k === links - 1) && !t.isBoss) {
        const e = t as Enemy;
        e.slowF = Math.min(e.slowF, 0.5);
        e.slowT = Math.max(e.slowT, this.duration(w));
      }
      t = next;
    }
  }

  /** The breath's cone: half its angle, and its reach. */
  breathCone(w: WeaponInst): { half: number; L: number } {
    return w.def.id === 'hellmouth' ? { half: 0.6, L: 220 * this.area(w) } : { half: 0.45, L: 170 * this.area(w) };
  }

  /** Fire Breath: a cone of flame where you face, setting what it touches alight (Hellmouth: front and back, always). */
  private breath(w: WeaponInst, dt: number): void {
    const evo = w.def.id === 'hellmouth';
    if (!evo) {
      if (!w.active) {
        if (!this.ready(w, dt)) return;
        w.active = true;
        w.activeT = this.duration(w);
        this.sfx('whoosh', 0.45);
      } else if ((w.activeT -= dt) <= 0) {
        w.active = false;
        w.cd = this.cooldown(w);
        return;
      }
    } else w.active = true;
    const p = this.g.player;
    const d = this.aimDir(w, p.x, p.y, 'forward');
    w.angle = Math.atan2(d.y, d.x);
    w.tickAcc -= dt;
    if (w.tickAcc > 0) return;
    w.tickAcc = 0.15;
    const { half, L } = this.breathCone(w);
    const st = this.g.player.stats;
    for (let k = 0; k < (evo ? 2 : 1); k++) {
      const a = w.angle + k * Math.PI;
      this.g.forEachTargetInCircle(p.x, p.y, L, (t) => {
        if (!inSector(t.x, t.y, p.x, p.y, a, half, L, t.r)) return;
        this.hit(w, t, this.damage(w), p.x, p.y, 0.2);
        if (!t.isBoss) ignite(t as Enemy, 3, 6 * st.might, w.def.id, p.index);
      });
    }
  }

  beamAngle(w: WeaponInst, i: number, n: number): number {
    if (w.def.id === 'grand_illumination') {
      const dir = i % 2 === 0 ? 1 : -1;
      return w.angle * dir + (Math.floor(i / 2) * TAU) / Math.ceil(n / 2) + (dir < 0 ? Math.PI / n : 0);
    }
    return w.angle + (i * TAU) / n;
  }

  // ---- Crystal Orbs / Cosmic Convergence (Godot orbit_weapon model)
  private orbs(w: WeaponInst, dt: number): void {
    const evo = w.def.id === 'cosmic_convergence';
    if (!evo) {
      if (!w.active) {
        w.cd -= dt;
        if (w.cd <= 0) {
          w.active = true;
          w.activeT = this.duration(w);
          this.sfx('orbs', 0.3);
        }
        return;
      }
      w.activeT -= dt;
      if (w.activeT <= 0) {
        w.active = false;
        // D-74: off for the cooldown only (the Godot model also added the base duration, so the orbs
        // were out barely 40% of the time)
        w.cd = this.cooldown(w);
        return;
      }
    } else {
      w.active = true;
      w.cd -= dt;
      if (w.cd <= 0) {
        w.cd = this.cooldown(w);
        const p = this.g.player;
        const ringR = this.orbRadius(w);
        this.g.forEachEnemyInCircle(p.x, p.y, ringR + 260, (e) => {
          // (D-79: nothing immune to knockback, and nothing mid-charge, is pulled in either)
          if (e.def.knockbackTaken <= 0 || e.def.behavior === 'rail_strafer' || bracing(e)) return;
          const dx = p.x - e.x, dy = p.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > ringR * 0.8) {
            e.kbT = 0.18;
            e.kbX = (dx / d) * 520;
            e.kbY = (dy / d) * 520;
          }
        });
        this.g.fx.own('ring', p.x, p.y, ringR + 260, 1, 0, 'gravity');
        this.sfx('gravity', 0.4);
      }
    }
    const n = this.amount(w);
    while (w.orbHits.length < n) w.orbHits.push(new HitTracker());
    w.angle += this.speed(w) * dt;
    const p = this.g.player;
    const R = this.orbRadius(w);
    const size = (evo ? 26 : 18) * this.area(w) / (evo ? 1.7 : 1);
    for (let i = 0; i < n; i++) {
      const a = w.angle + (i * TAU) / n;
      const x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
      const ht = w.orbHits[i];
      this.g.forEachTargetInCircle(x, y, size, (t) => {
        if (ht.recent(t.uid, this.g.realTime, evo ? 0.38 : 0.8)) return;
        ht.mark(t.uid, this.g.realTime);
        this.hit(w, t, this.damage(w), x, y, 0);
        if (!t.isBoss) this.barrier(t as Enemy, p.x, p.y, w.def.knockback);
      });
    }
  }

  /**
   * The Crystal Orbs' barrier (D-74): an orb shoves what it hits straight out from you. Each shove on the
   * same creature soon after the last is weaker (it wears off over about a second), so the crowd bounces
   * off the ring while something tough leans through it unless you kill it quickly. D-79: the wear is the
   * one every knockback shares (Game.kbWear), the shove a fifth softer, and never on a creature mid-charge.
   */
  private barrier(e: Enemy, px: number, py: number, power: number): void {
    if (!e.alive || e.def.knockbackTaken <= 0 || e.def.behavior === 'rail_strafer' || bracing(e)) return;
    const f = this.g.kbWear(e, 1.25) * e.def.knockbackTaken * power * KB_SCALE;
    const dx = e.x - px, dy = e.y - py;
    const l = Math.hypot(dx, dy) || 1;
    e.kbT = 0.14;
    e.kbX = (dx / l) * ORB_SHOVE * f;
    e.kbY = (dy / l) * ORB_SHOVE * f;
  }

  orbRadius(w: WeaponInst): number {
    return w.def.id === 'cosmic_convergence' ? Math.min(260, 105 * this.area(w)) : Math.min(220, 100 * this.area(w));
  }

  // ---- Strongman Bell / High Striker: slam → shockwave ring
  private bell(w: WeaponInst, dt: number): void {
    if (!this.ready(w, dt)) return;
    if (w.def.id === 'high_striker') {
      const p = this.g.player;
      const n = this.amount(w);
      const R = 75 * this.area(w);
      for (let i = 0; i < n; i++) {
        this.schedule(i * 0.12, () => {
          const t = this.g.randomTarget(p.x, p.y, 700);
          const x = t ? t.x : p.x + this.g.rng.range(-300, 300), y = t ? t.y : p.y + this.g.rng.range(-200, 200);
          const jackpot = this.g.rng.chance(0.15 * (0.6 + 0.4 * this.g.player.stats.luck));
          this.g.forEachTargetInCircle(x, y, R, (tt) => {
            if (jackpot) {
              const d = this.damage(w) * this.g.player.stats.critDamage * 2.5;
              this.g.damageTarget(tt, d, true, w.def.knockback * 1.5, x, y, this.src || w.def.id);
            } else this.hit(w, tt, this.damage(w), x, y);
          });
          this.g.fx.own('ring', x, y, R, jackpot ? 1 : 0, 0, jackpot ? 'jackpot' : 'bell');
          this.g.fx.own('spark', x, y, 8, 0, 0, jackpot ? 'gold' : 'dust');
          if (jackpot) {
            this.g.fx.own('text', x, y - 40, 0, 0, 0, 'gold', 'DING!');
            this.sfx('ding', 0.7);
          }
          this.sfx('stomp', 0.35, 1.2);
        });
      }
      return;
    }
    const n = this.amount(w);
    const R = 140 * this.area(w);
    this.cast(w, (ox, oy, mult) => {
      const slam = (rr: number) => {
        this.g.forEachTargetInCircle(ox, oy, rr, (t) => this.hit(w, t, this.damage(w) * mult, ox, oy));
        this.g.fx.own('ring', ox, oy, rr, 0, 0, 'bell');
      };
      slam(R);
      if (n >= 2) this.schedule(0.28, () => slam(R * 1.25));
    });
    this.g.fx.push('shake', this.g.player.x, this.g.player.y, 0.12);
    this.sfx('ding', 0.35, 0.8);
  }

  // ---- Funhouse Mirror / Hall of Mirrors: clones that replay discrete attacks (see cast())
  // ---- Steam Calliope / Grand Requiem (Easter-egg reward): spiralling notes
  private calliope(w: WeaponInst, dt: number): void {
    const evo = w.def.id === 'grand_requiem';
    if (evo) {
      // a thunderous chord every 3 s on top of the endless spiral
      w.tickAcc -= dt;
      if (w.tickAcc <= 0) {
        w.tickAcc = 2;
        const p = this.g.player;
        const R = 240 * this.area(w) / w.def.area;
        this.g.forEachTargetInCircle(p.x, p.y, R, (t) => this.hit(w, t, this.damage(w) * 2, p.x, p.y, 1.5));
        this.g.fx.own('ring', p.x, p.y, R, 0, 0, 'gravity');
        this.sfx('calliope', 0.35, 1.2);
      }
    }
    if (!this.ready(w, dt)) return;
    const n = this.amount(w);
    w.n++;
    this.cast(w, (ox, oy, mult) => {
      for (let i = 0; i < n; i++) {
        const a = w.n * 0.42 + (i * Math.PI * 2) / n;
        const p = this.proj(w, 'note', ox, oy, a, this.speed(w), { r: 9 * this.area(w) / w.def.area, mult });
        if (!p) continue;
        p.spin = evo ? 0.6 : 1.15;
        p.rehit = -1;
        if (evo) {
          const t = this.g.randomTarget(ox, oy, 520);
          p.homing = 1.6;
          p.target = t ? t.uid : -1;
        }
      }
    });
    if (!evo || w.n % 3 === 0) this.sfx('bellnote', 0.18, 0.75 + (w.n % 4) * 0.12);
  }

  private mirror(w: WeaponInst, dt: number): void {
    const p = this.g.player;
    if (w.def.id === 'hall_of_mirrors') {
      this.syncSummons(w, Math.min(MAX_CLONES, this.amount(w)), () => 'clone');
      return;
    }
    if (!this.ready(w, dt)) return;
    const n = Math.min(MAX_CLONES, this.amount(w));
    for (const s of this.g.summons) if (s.alive && s.weapon === w.def.id) s.alive = false;
    for (let i = 0; i < n; i++) {
      const s = this.g.spawnSummon();
      if (!s) break;
      s.kind = 'clone';
      s.weapon = w.def.id;
      s.slot = i;
      s.life = this.duration(w);
      const a = Math.atan2(-p.faceY, -p.faceX) + (i - (n - 1) / 2) * 1.1;
      s.x = s.px = p.x + Math.cos(a) * 130;
      s.y = s.py = p.y + Math.sin(a) * 130;
      s.tx = Math.cos(a) * 130;
      s.ty = Math.sin(a) * 130;
      this.g.fx.own('spark', s.x, s.y, 8, 0, 0, 'mirror');
    }
    this.sfx('mirror', 0.45);
  }

  // ================================================================= projectiles
  updateProjectiles(dt: number): void {
    const g = this.g;
    for (const p of g.projs) {
      if (p.owner !== this.g.player.index) continue;
      if (!p.alive) continue;
      p.px = p.x;
      p.py = p.y;
      p.life -= dt;
      const w = this.get(p.weapon);
      // a clone's shot is the mirror's to the end: its blast, its shrapnel, its burst (D-85)
      this.src = p.src;
      switch (p.kind) {
        case 'rocket':
        case 'shell':
        case 'kernel':
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot = Math.atan2(p.vy, p.vx);
          if (p.life <= 0) {
            p.alive = false;
            this.detonate(p, w);
          }
          continue;
        case 'ring': {
          const half = p.maxLife * 0.5;
          const age = p.maxLife - p.life;
          const sp0 = Math.hypot(p.vx, p.vy) || 1;
          if (!p.returning) {
            const k = Math.max(0.05, 1 - age / half);
            p.x += (p.vx / sp0) * sp0 * k * dt;
            p.y += (p.vy / sp0) * sp0 * k * dt;
            if (age >= half) p.returning = true;
          } else {
            const pl = g.player;
            const dx = pl.x - p.x, dy = pl.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            const sp = sp0 * Math.min(1.4, (age - half) / half + 0.3);
            p.x += (dx / d) * sp * dt;
            p.y += (dy / d) * sp * dt;
            if (d < 26) p.alive = false;
          }
          p.rot += dt * 14;
          break;
        }
        case 'tarot':
        case 'death_card': {
          let t = g.findTargetByUid(p.target);
          if (!t && g.tickCount % 6 === 0) {
            t = g.randomTarget(p.x, p.y, 500);
            p.target = t ? t.uid : -1;
          }
          if (t) {
            const want = Math.atan2(t.y - p.y, t.x - p.x);
            let cur = Math.atan2(p.vy, p.vx);
            let d = want - cur;
            while (d > Math.PI) d -= TAU;
            while (d < -Math.PI) d += TAU;
            cur += clamp(d, -p.homing * dt, p.homing * dt);
            const sp = Math.hypot(p.vx, p.vy);
            p.vx = Math.cos(cur) * sp;
            p.vy = Math.sin(cur) * sp;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot = Math.atan2(p.vy, p.vx);
          break;
        }
        case 'derby_car': {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const pl = g.player;
          if (Math.abs(p.x - pl.x) > VIEW_HALF_X * 0.92) p.vx = -Math.abs(p.vx) * Math.sign(p.x - pl.x);
          if (Math.abs(p.y - pl.y) > VIEW_HALF_Y * 0.92) p.vy = -Math.abs(p.vy) * Math.sign(p.y - pl.y);
          p.rot = Math.atan2(p.vy, p.vx);
          break;
        }
        case 'note': {
          if (p.homing > 0) {
            const t = g.findTargetByUid(p.target);
            if (t) {
              const want = Math.atan2(t.y - p.y, t.x - p.x);
              let cur = Math.atan2(p.vy, p.vx);
              let d = want - cur;
              while (d > Math.PI) d -= TAU;
              while (d < -Math.PI) d += TAU;
              cur += clamp(d, -p.homing * dt, p.homing * dt);
              const sp = Math.hypot(p.vx, p.vy);
              p.vx = Math.cos(cur) * sp;
              p.vy = Math.sin(cur) * sp;
            }
          } else if (p.spin !== 0) {
            const c = Math.cos(p.spin * dt), s = Math.sin(p.spin * dt);
            const nvx = p.vx * c - p.vy * s;
            p.vy = p.vx * s + p.vy * c;
            p.vx = nvx;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += dt * 4;
          break;
        }
        case 'bumper_ghost': {
          const pl = g.player;
          p.vx = pl.dashX * pl.dashSpeed;
          p.vy = pl.dashY * pl.dashSpeed;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        }
        default: {
          if (p.spin !== 0) {
            const c = Math.cos(p.spin * dt), s = Math.sin(p.spin * dt);
            const nvx = p.vx * c - p.vy * s;
            p.vy = p.vx * s + p.vy * c;
            p.vx = nvx;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot = p.kind === 'card' || p.kind === 'gold_card' ? p.rot + dt * 18 : Math.atan2(p.vy, p.vx);
        }
      }
      if (p.life <= 0) {
        p.alive = false;
        this.expire(p, w);
        continue;
      }
      if (p.r > 0) this.collideProj(p, w);
    }
    this.src = '';
  }

  private collideProj(p: PlayerProjectile, w: WeaponInst | undefined): void {
    const g = this.g;
    const now = g.realTime;
    let flowers = 0;
    g.forEachTargetInCircle(p.x, p.y, p.r, (t) => {
      if (!p.alive) return;
      if (p.hits.recent(t.uid, now, p.rehit)) return;
      p.hits.mark(t.uid, now);
      if (w) {
        const st = g.player.stats;
        const crit = st.critRoll(g.rng.next(), (w.def.critBonus ?? 0) + p.crit);
        const cm = st.critDamage + (w.def.id === 'death_card' ? DEATH_CRIT : 0);
        const dmg = p.dmg * (crit ? cm : 1);
        g.damageTarget(t, dmg, crit, p.kb, p.x - p.vx * 0.05, p.y - p.vy * 0.05, p.src || w.def.id);
        if (crit) g.fx.own('crit', t.x, t.y);
      }
      g.fx.own('hit', t.x, t.y, 0, 0, 0, p.kind);
      if (p.kind === 'death_card') {
        this.burst(p, w, 60 * p.area, 0.3, 'deathcard');
        p.alive = false;
        return;
      }
      if (p.kind === 'derby_car') {
        // pinball: reflect off the struck target
        const dx = p.x - t.x, dy = p.y - t.y;
        const l = Math.hypot(dx, dy) || 1;
        const nx = dx / l, ny = dy / l;
        const dot = p.vx * nx + p.vy * ny;
        if (dot < 0) {
          p.vx -= 2 * dot * nx;
          p.vy -= 2 * dot * ny;
        }
        g.bus.emit('sfx', { id: 'bonk', vol: 0.2 });
      }
      if (p.kind === 'dart' && w?.def.id === 'sharpshooter' && flowers < 1 && p.flag < 3) {
        flowers++;
        p.flag++;
        this.shrapnel(p, w, 6, 0.45);
      }
      if (p.pierce < 900) {
        p.pierce--;
        if (p.pierce < 0) {
          p.alive = false;
          this.expire(p, w);
        }
      }
    });
  }

  private expire(p: PlayerProjectile, w: WeaponInst | undefined): void {
    if (p.kind === 'dart') this.shrapnel(p, w, w?.def.id === 'sharpshooter' ? 6 : 4, 0.4);
    if (p.kind === 'cannonball' && p.flag === 1) this.burst(p, w, 80 * p.area, 0.6, 'cannon');
  }

  private shrapnel(p: PlayerProjectile, w: WeaponInst | undefined, n: number, frac: number): void {
    if (!w) return;
    const off = this.g.rng.angle();
    for (let i = 0; i < n; i++) {
      const s = this.g.spawnProj();
      if (!s) return;
      const a = off + (i * TAU) / n;
      s.kind = 'shrapnel';
      s.weapon = w.def.id;
      s.src = this.src;
      s.x = s.px = p.x;
      s.y = s.py = p.y;
      s.vx = Math.cos(a) * 380;
      s.vy = Math.sin(a) * 380;
      s.r = 6 * p.area;
      s.dmg = p.dmg * frac;
      s.pierce = 0;
      s.life = s.maxLife = 0.32;
      s.kb = 0.3;
      s.area = p.area;
      s.hits.mark(-999, 0);
    }
    this.g.fx.own('spark', p.x, p.y, 4, 0, 0, 'shrapnel');
  }

  private burst(p: PlayerProjectile, w: WeaponInst | undefined, r: number, frac: number, style: string): void {
    if (!w) return;
    this.g.forEachTargetInCircle(p.x, p.y, r, (t) => this.hit(w, t, p.dmg * frac, p.x, p.y));
    this.g.fx.own('explosion', p.x, p.y, r, 0, 0, style);
  }

  private detonate(p: PlayerProjectile, w: WeaponInst | undefined): void {
    if (!w) return;
    const g = this.g;
    let r: number, style: string;
    if (p.kind === 'kernel') {
      r = 46 * p.area;
      style = 'popcorn';
      g.bus.emit('sfx', { id: 'popcorn', vol: 0.18, pitch: 0.8 + g.rng.next() * 0.5 });
    } else if (p.kind === 'shell') {
      r = 110 * p.area;
      style = 'finale';
      g.fx.push('shake', p.x, p.y, 0.4);
      g.bus.emit('sfx', { id: 'boom', vol: 0.7 });
    } else {
      r = 62 * p.area;
      style = w.def.id === 'grand_finale' ? 'finale_small' : 'firework';
      g.bus.emit('sfx', { id: 'crackle', vol: 0.3, pitch: 0.8 + g.rng.next() * 0.4 });
    }
    const dmg = p.kind === 'shell' ? p.dmg * 2 : p.dmg;
    g.forEachTargetInCircle(p.tx, p.ty, r, (t) => this.hit(w, t, dmg, p.tx, p.ty));
    g.fx.own('explosion', p.tx, p.ty, r, g.rng.next(), 0, style);
    if (w.def.id === 'kettle_korn' && g.rng.chance(0.2)) {
      const a = g.rng.angle();
      const pk = this.lob(w, 'kernel', p.tx, p.ty, p.tx + Math.cos(a) * 70, p.ty + Math.sin(a) * 70, 0.25, p.mult);
      if (pk) pk.dmg = p.dmg * 0.6;
    }
  }

  // ================================================================= summons
  updateSummons(dt: number): void {
    const g = this.g;
    const pl = g.player;
    let plushIdx = 0, plushN = 0;
    for (const s of g.summons) if (s.alive && s.kind === 'plush') plushN++;
    for (const s of g.summons) {
      if (s.owner !== this.g.player.index) continue;
      if (!s.alive) continue;
      s.px = s.x;
      s.py = s.y;
      s.animT += dt;
      const w = this.get(s.weapon);
      if (!w) {
        s.alive = false;
        continue;
      }
      s.life -= dt;
      if (s.life <= 0) {
        s.alive = false;
        g.fx.own('spark', s.x, s.y, 5, 0, 0, 'magic');
        continue;
      }
      s.cd -= dt;
      switch (s.kind) {
        case 'plush': {
          const evo = w.def.id === 'nightmare_menagerie';
          const idx = plushIdx++;
          if (!evo) {
            const orbitA = g.realTime * 1.8 + (idx * TAU) / Math.max(1, plushN);
            const ox = pl.x + Math.cos(orbitA) * 70, oy = pl.y + Math.sin(orbitA) * 70;
            this.petAI(s, w, ox, oy, 230, this.speed(w), dt);
          } else {
            const t = g.findTargetByUid(s.target);
            const ox = pl.x + Math.cos(idx * 1.3 + g.realTime) * 120, oy = pl.y + Math.sin(idx * 1.3 + g.realTime) * 120;
            if (!t && s.cd <= 0) {
              const nt = g.randomTarget(pl.x, pl.y, 520);
              s.target = nt ? nt.uid : -1;
            }
            this.petAI(s, w, ox, oy, 520, this.speed(w), dt, true);
          }
          break;
        }
        case 'rabbit':
        case 'dove':
        case 'acrobat':
        case 'lion':
        case 'elephant':
          this.helperAI(s, w, dt);
          break;
        case 'clone': {
          if (w.def.id === 'hall_of_mirrors') {
            const a = g.realTime * 0.8 + (s.slot * TAU) / Math.max(1, Math.min(MAX_CLONES, this.amount(w)));
            s.x = pl.x + Math.cos(a) * 140;
            s.y = pl.y + Math.sin(a) * 140;
          } else {
            s.x = pl.x + s.tx;
            s.y = pl.y + s.ty;
          }
          s.face = pl.facing;
          if (pl.char.quirk === 'mirror_aura' && s.cd <= 0) {
            s.cd = MIRA_HALO.every;
            const R = miraHaloRadius(pl);
            const dmg = (MIRA_HALO.dmg + MIRA_HALO.perLevel * (w.level - 1)) * pl.stats.might * (w.def.isEvolution ? MIRA_HALO.evo : 1);
            g.forEachTargetInCircle(s.x, s.y, R, (t) => this.hit(w, t, dmg, s.x, s.y, 0));
            g.fx.own('ring', s.x, s.y, R, 0, 0, 'glass');
          }
          break;
        }
      }
    }
  }

  /** Plush pets: orbit/roam, then pounce on a target, bite, and return. */
  private petAI(s: Summon, w: WeaponInst, ox: number, oy: number, range: number, speed: number, dt: number, roam = false): void {
    const g = this.g;
    if (s.state === 0) {
      // drift to orbit position
      s.x += (ox - s.x) * Math.min(1, dt * 8);
      s.y += (oy - s.y) * Math.min(1, dt * 8);
      if (s.cd <= 0) {
        const t = roam ? g.findTargetByUid(s.target) ?? g.nearestTarget(s.x, s.y, range) : g.nearestTarget(s.x, s.y, range);
        if (t) {
          s.target = t.uid;
          s.state = 1;
        } else s.cd = 0.2;
      }
    } else {
      const t = g.findTargetByUid(s.target);
      if (!t) {
        s.state = 0;
        s.cd = 0.1;
        return;
      }
      const dx = t.x - s.x, dy = t.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      s.face = dx > 0 ? 1 : -1;
      if (d < t.r + 12) {
        this.hit(w, t, this.damage(w), s.x, s.y);
        // the Menagerie's pets maul (D-74): the bite tears into whatever crowds its target too
        if (roam) g.forEachTargetInCircle(t.x, t.y, MAUL_R * this.area(w) / w.def.area, (o) => o !== t && this.hit(w, o, this.damage(w) * 0.6, s.x, s.y, 0.4));
        g.fx.own('hit', t.x, t.y, 0, 0, 0, 'bite');
        s.state = 0;
        s.cd = this.cooldown(w);
        if (!roam) s.target = -1;
        g.bus.emit('sfx', { id: 'bite', vol: 0.18 });
      } else {
        s.x += (dx / d) * speed * dt;
        s.y += (dy / d) * speed * dt;
        if (Math.hypot(s.x - g.player.x, s.y - g.player.y) > range * 1.6) s.state = 0;
      }
    }
  }

  /** Top Hat helpers and the Grand Menagerie troupe. */
  private helperAI(s: Summon, w: WeaponInst, dt: number): void {
    const g = this.g;
    const pl = g.player;
    // initial pop-out arc
    if (s.vx !== 0 || s.vy !== 0) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.9;
      s.vy *= 0.9;
      if (Math.abs(s.vx) + Math.abs(s.vy) < 10) s.vx = s.vy = 0;
    }
    // `cleave`: the troupe's lion and acrobats hit around their mark too (D-74)
    const spec = {
      rabbit: { range: 420, speed: 300, cd: 0.6, dmg: 1, r: 0, kb: 1, cleave: 0 },
      dove: { range: 520, speed: 420, cd: 0.7, dmg: 0.8, r: 0, kb: 0.4, cleave: 0 },
      acrobat: { range: 480, speed: 360, cd: 0.4, dmg: 0.6, r: 0, kb: 0.6, cleave: 36 },
      lion: { range: 460, speed: 380, cd: 1.1, dmg: 1.7, r: 0, kb: 2, cleave: 64 },
      elephant: { range: 400, speed: 150, cd: 2.0, dmg: 1.3, r: 110, kb: 3, cleave: 0 },
    }[s.kind as 'rabbit']!;
    let t = g.findTargetByUid(s.target);
    if (!t || Math.hypot(t.x - pl.x, t.y - pl.y) > spec.range * 1.3) {
      if (g.tickCount % 4 === s.slot % 4) {
        t = s.kind === 'elephant' ? g.randomTarget(pl.x, pl.y, spec.range) : g.nearestTarget(s.x, s.y, spec.range);
        s.target = t ? t.uid : -1;
      }
    }
    if (!t) {
      // return near the player
      const hx = pl.x + Math.cos(s.slot * 2.1) * 80, hy = pl.y + Math.sin(s.slot * 2.1) * 80;
      s.x += (hx - s.x) * Math.min(1, dt * 3);
      s.y += (hy - s.y) * Math.min(1, dt * 3);
      return;
    }
    const dx = t.x - s.x, dy = t.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    s.face = dx > 0 ? 1 : -1;
    const reach = t.r + (s.kind === 'elephant' ? 40 : 14);
    if (d > reach) {
      const sp = spec.speed * (s.kind === 'rabbit' ? 0.6 + 0.6 * Math.abs(Math.sin(s.animT * 8)) : 1);
      s.x += (dx / d) * sp * dt;
      s.y += (dy / d) * sp * dt;
    } else if (s.cd <= 0) {
      s.cd = spec.cd;
      if (spec.r > 0) {
        g.forEachTargetInCircle(s.x, s.y, spec.r * this.area(w) / w.def.area, (tt) => this.hit(w, tt, this.damage(w) * spec.dmg, s.x, s.y, spec.kb));
        g.fx.own('ring', s.x, s.y, spec.r, 0, 0, 'pound');
        g.fx.push('shake', s.x, s.y, 0.12);
        g.bus.emit('sfx', { id: 'stomp', vol: 0.3, pitch: 0.7 });
      } else {
        this.hit(w, t, this.damage(w) * spec.dmg, s.x, s.y, spec.kb);
        if (spec.cleave) g.forEachTargetInCircle(t.x, t.y, spec.cleave, (o) => o !== t && this.hit(w, o, this.damage(w) * spec.dmg * 0.6, s.x, s.y, spec.kb * 0.5));
        g.fx.own('hit', t.x, t.y, 0, 0, 0, s.kind);
        if (s.kind === 'lion') g.bus.emit('sfx', { id: 'roar', vol: 0.3 });
        if (s.kind === 'dove') {
          // fly past after a peck
          const a = g.rng.angle();
          s.vx = Math.cos(a) * 260;
          s.vy = Math.sin(a) * 260;
        }
      }
    }
  }
}
