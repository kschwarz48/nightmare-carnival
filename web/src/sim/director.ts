// The Spawn Director (doc 03 §7, Godot EnemyDirector): wave timeline, VS-style spawn band,
// despawn leash, flyby swarms (now with a fair lane telegraph), elites, minibosses, formations,
// boss gates, the victory lap and Endless.

import { clamp, dist2 } from '../core/math';
import { BOSS_MAP, BOSSES } from '../data/bosses';
import { CURSE } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { MAP_HALF, PLAYER_BOUNDS } from '../data/map';
import { ENDLESS_WAVE, VICTORY_LAP_WAVE, WAVES, type WaveDef } from '../data/waves';
import { createBoss } from './bosses';
import type { Enemy } from './entities';
import type { Game } from './game';
import { VIEW_HALF_X, VIEW_HALF_Y } from './constants';

export interface Formation {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  fireT: number;
  windup: number;
  fired: boolean;
  members: number;
}

export class Director {
  formations = new Map<number, Formation>();
  private nextFormation = 1;
  private intervalAcc = 0;
  private swarmAcc = 0;
  private minibossAcc = 0;
  private currentWave = '';
  private warned = new Set<string>();
  private spawned = new Set<string>();
  private encoreAcc = 0;
  private pendingSwarms: { t: number; wave: WaveDef; ang: number }[] = [];
  bossActive = false;
  private bruteAnnounced = false;

  constructor(private g: Game) {}

  init(): void {
    // The Tent and the Ferris Wheel are scenery from the first second (doc 05: the reveal).
    for (const id of ['carnival_tent', 'ferris_wheel'] as const) {
      const b = createBoss(this.g, BOSS_MAP[id]);
      this.g.bosses.push(b);
      this.spawned.add(id);
    }
  }

  get cap(): number {
    let c = this.g.diff.cap;
    if (this.g.cfg.curse) c = Math.min(400, Math.round(c * CURSE.capMult));
    c = Math.round(c * this.g.events.capMult);
    if (this.g.endless) c = Math.min(460, c + Math.floor((this.g.time - this.g.endlessStart) / 60) * 8);
    return c;
  }

  activeWave(): WaveDef {
    if (this.g.victoryLap) return VICTORY_LAP_WAVE;
    if (this.g.endless) return ENDLESS_WAVE;
    let best = WAVES[0];
    for (const w of WAVES) if (this.g.time >= w.start) best = w;
    return best;
  }

  update(dt: number): void {
    const g = this.g;
    // Boss gates: warn 3 s early, then the boss wakes/arrives (doc 03 §8).
    if (!g.endless) {
      for (const bd of BOSSES) {
        const busy = g.bosses.some((b) => b.awake && !b.dead && b.def.id !== bd.id);
        if (!this.warned.has(bd.id) && g.time >= bd.gate - 3 && !busy) {
          this.warned.add(bd.id);
          g.bus.emit('boss_warning', { id: bd.id });
        }
        // D-24: a gate is held while another boss is still awake — bosses never stack.
        const otherAwake = g.bosses.some((b) => b.awake && !b.dead && b.def.id !== bd.id);
        if (!this.spawned.has(bd.id) && g.time >= bd.gate && !otherAwake) {
          this.spawned.add(bd.id);
          g.bosses.push(createBoss(g, bd));
        }
      }
    }
    this.bossActive = g.bosses.some((b) => b.awake && !b.dead);
    const preBoss = !g.endless && BOSSES.some((b) => g.time >= b.gate - 3 && g.time < b.gate + 0.5 && !g.bossIds.includes(b.id));

    if (g.tickCount % 10 === 0) this.cullLeash();
    this.updateFormations(dt);
    this.updatePendingSwarms(dt);

    if (this.bossActive || preBoss) return; // ambient spawns pause for the set-piece
    const wave = this.activeWave();
    const minutes = g.minutes;
    const cap = Math.min(wave.maxAlive * (g.endless ? 1.4 : 1), this.cap);

    if (wave.id !== this.currentWave) {
      this.currentWave = wave.id;
      this.swarmAcc = 0;
      for (let i = 0; i < (wave.eliteBurst ?? 0); i++) {
        if (g.active.length >= this.cap) break;
        this.spawnOne(wave, true);
      }
      if (wave.eliteBurst) g.bus.emit('banner', { text: 'ELITE GAUNTLET!', sub: 'Golden-rimmed horrors approach', style: 'danger' });
    }

    // Miniboss cadence (doc 03 §6).
    this.minibossAcc += dt;
    if (this.minibossAcc >= g.diff.minibossInterval && !g.victoryLap) {
      this.minibossAcc = 0;
      const pt = this.spawnPoint();
      g.spawnEnemy('carnival_brute', pt.x, pt.y);
      if (!this.bruteAnnounced) {
        this.bruteAnnounced = true;
        g.bus.emit('banner', { text: 'A CARNIVAL BRUTE APPROACHES', sub: 'He carries a prize chest', style: 'gold' });
      }
    }

    // 1) baseline top-up
    let guard = 0;
    const minAlive = Math.min(wave.minAlive, cap);
    while (g.active.length < minAlive && guard++ < 40) {
      if (!this.spawnOne(wave)) break;
    }
    // 2) steady pressure
    const mult = g.events.spawnRateMult * (g.cfg.curse ? 1 / CURSE.intervalMult : 1);
    this.intervalAcc += dt * mult;
    const interval = Math.max(0.05, wave.interval);
    while (this.intervalAcc >= interval) {
      this.intervalAcc -= interval;
      for (let i = 0; i < wave.batch; i++) {
        if (g.active.length >= cap) break;
        if (!this.spawnOne(wave)) break;
      }
    }
    // 3) flyby swarm overlay — telegraphed lane first
    if (wave.swarm) {
      this.swarmAcc += dt;
      if (this.swarmAcc >= wave.swarm.interval) {
        this.swarmAcc -= wave.swarm.interval;
        this.queueSwarm(wave);
      }
    }
    // Endless: Encore Ringmaster every 5 minutes (D-17).
    if (g.endless) {
      this.encoreAcc += dt;
      if (this.encoreAcc >= 300) {
        this.encoreAcc = 0;
        const b = createBoss(g, BOSS_MAP.ringmaster, { encore: true });
        g.bosses.push(b);
      }
    }
  }

  /** Dormant bosses (Tent, Wheel) wake only once their warning has played. */
  gateOpen(id: string): boolean {
    return this.warned.has(id) || this.g.endless;
  }

  enterEndless(): void {
    this.encoreAcc = 0;
    this.currentWave = '';
  }

  private pickEnemy(wave: WaveDef): string | null {
    const ws = wave.enemies.map((e) => e[1]);
    for (let tries = 0; tries < 5; tries++) {
      const id = wave.enemies[this.g.rng.weighted(ws)][0];
      const def = ENEMIES[id];
      if (def?.maxAlive) {
        let n = 0;
        for (const e of this.g.active) if (e.def.id === id) n++;
        const allowed = def.maxAlive + (this.g.diff.id === 'nightmare' ? 1 : 0);
        if (n >= allowed) continue;
      }
      return id;
    }
    return 'living_balloon';
  }

  eliteChance(): number {
    return clamp(0.01 + 0.004 * this.g.minutes, 0, 0.12) * this.g.diff.eliteChanceMult;
  }

  spawnOne(wave: WaveDef, forceElite = false): boolean {
    const id = this.pickEnemy(wave);
    if (!id) return false;
    const pt = this.spawnPoint();
    if (id === 'puppet_soldier' && !forceElite) {
      const n = 3 + Math.min(3, this.g.act - 2) + (this.g.diff.id === 'nightmare' ? 1 : 0);
      return this.spawnFormation(pt.x, pt.y, n) > 0;
    }
    const elite = forceElite || this.g.rng.chance(this.eliteChance());
    return this.g.spawnEnemy(id, pt.x, pt.y, { elite }) !== null;
  }

  /** A marching rank of Puppet Soldiers sharing one formation controller. */
  spawnFormation(x: number, y: number, count: number): number {
    const g = this.g;
    const id = this.nextFormation++;
    const dx0 = g.player.x - x, dy0 = g.player.y - y;
    const l = Math.hypot(dx0, dy0) || 1;
    const f: Formation = { id, x, y, dx: dx0 / l, dy: dy0 / l, fireT: 2.6 + g.rng.next(), windup: 0, fired: false, members: count };
    this.formations.set(id, f);
    let made = 0;
    const rows = count > 5 ? 2 : 1;
    const perRow = Math.ceil(count / rows);
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / perRow);
      const col = (i % perRow) - (perRow - 1) / 2;
      const px = -f.dy, py = f.dx;
      const ex = x + px * col * 46 - f.dx * row * 46;
      const ey = y + py * col * 46 - f.dy * row * 46;
      const e = g.spawnEnemy('puppet_soldier', ex, ey, { elite: i === 0 && g.rng.chance(this.eliteChance() * 3) });
      if (!e) break;
      e.group = id;
      e.tx = col;
      e.ty = row;
      made++;
    }
    if (made === 0) this.formations.delete(id);
    return made;
  }

  private updateFormations(dt: number): void {
    if (this.formations.size === 0) return;
    const g = this.g;
    for (const f of this.formations.values()) f.members = 0;
    for (const e of g.active) {
      if (e.alive && e.group >= 0) {
        const f = this.formations.get(e.group);
        if (f) f.members++;
      }
    }
    for (const [id, f] of this.formations) {
      if (f.members === 0) {
        this.formations.delete(id);
        continue;
      }
      const dx = g.player.x - f.x, dy = g.player.y - f.y;
      const d = Math.hypot(dx, dy) || 1;
      // turn slowly toward the player (a marching block wheels, it doesn't snap)
      const tdx = dx / d, tdy = dy / d;
      f.dx += (tdx - f.dx) * Math.min(1, dt * 0.8);
      f.dy += (tdy - f.dy) * Math.min(1, dt * 0.8);
      const fl = Math.hypot(f.dx, f.dy) || 1;
      f.dx /= fl;
      f.dy /= fl;
      const keep = 380;
      const sp = d > keep ? 50 : d < keep * 0.7 ? -30 : 0;
      f.x += f.dx * sp * dt;
      f.y += f.dy * sp * dt;
      f.fired = false;
      f.fireT -= dt;
      const wind = 0.7;
      f.windup = f.fireT < wind ? 1 - Math.max(0, f.fireT) / wind : 0;
      if (f.fireT <= 0) {
        if (d < 760) f.fired = true;
        f.fireT = 2.6;
        f.windup = 0;
      }
    }
  }

  private queueSwarm(wave: WaveDef): void {
    const g = this.g;
    const ang = g.rng.angle();
    const p = g.player;
    const dir = { x: -Math.cos(ang), y: -Math.sin(ang) };
    const ring = Math.hypot(VIEW_HALF_X, VIEW_HALF_Y) + 90;
    const sx = p.x + Math.cos(ang) * ring, sy = p.y + Math.sin(ang) * ring;
    const spread = clamp((wave.swarm?.size ?? 30) * 2.6, 50, 190);
    // Lane telegraph: a translucent band across the screen along the swarm's path (fairness).
    g.spawnHazard('line', 'swarm_lane', sx, sy, { x2: sx + dir.x * ring * 2, y2: sy + dir.y * ring * 2, r2: spread, tele: 0.9, active: 0.01, dmg: 0, safe: true });
    g.bus.emit('sfx', { id: 'swarmwarn', vol: 0.5 });
    this.pendingSwarms.push({ t: 0.9, wave, ang });
  }

  private updatePendingSwarms(dt: number): void {
    const g = this.g;
    for (let i = this.pendingSwarms.length - 1; i >= 0; i--) {
      const s = this.pendingSwarms[i];
      s.t -= dt;
      if (s.t > 0) continue;
      this.pendingSwarms.splice(i, 1);
      const sw = s.wave.swarm!;
      const p = g.player;
      const ring = Math.hypot(VIEW_HALF_X, VIEW_HALF_Y) + 90;
      const cx = p.x + Math.cos(s.ang) * ring, cy = p.y + Math.sin(s.ang) * ring;
      const dx = -Math.cos(s.ang), dy = -Math.sin(s.ang);
      const spread = clamp(sw.size * 2.6, 50, 190);
      for (let k = 0; k < sw.size; k++) {
        if (g.active.length >= this.cap + 40) break;
        const a = g.rng.angle();
        const r = Math.sqrt(g.rng.next()) * spread;
        const e = g.spawnEnemy(sw.enemy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        if (!e) break;
        e.dirX = dx;
        e.dirY = dy;
        e.leashExempt = true;
      }
    }
  }

  /** Rectangular band outside the screen out to 1.5× (VS spawn area), clamped, never stacked. */
  spawnPoint(): { x: number; y: number } {
    const g = this.g;
    const p = g.player;
    const hx = VIEW_HALF_X, hy = VIEW_HALF_Y;
    const ox = hx * 1.5, oy = hy * 1.5;
    for (let attempt = 0; attempt < 10; attempt++) {
      let x = p.x + g.rng.range(-ox, ox);
      let y = p.y + g.rng.range(-oy, oy);
      if (Math.abs(x - p.x) < hx && Math.abs(y - p.y) < hy) continue;
      x = clamp(x, -MAP_HALF + 20, MAP_HALF - 20);
      y = clamp(y, -MAP_HALF + 20, PLAYER_BOUNDS.maxY + 20);
      if (Math.abs(x - p.x) < hx * 0.85 && Math.abs(y - p.y) < hy * 0.85) continue; // clamped onto the screen
      if (this.blocked(x, y)) continue;
      return { x, y };
    }
    // Fallback: just off whichever horizontal edge has room.
    const side = p.x > 0 ? -1 : 1;
    return { x: clamp(p.x + side * (hx + 80), -MAP_HALF + 20, MAP_HALF - 20), y: clamp(p.y + g.rng.range(-hy, hy), -MAP_HALF + 20, PLAYER_BOUNDS.maxY) };
  }

  private blocked(x: number, y: number): boolean {
    let hit = false;
    this.g.grid.query(x, y, 28, (id) => {
      const e = this.g.enemies[id];
      if (e.alive && dist2(e.x, e.y, x, y) < 28 * 28) {
        hit = true;
        return true;
      }
    });
    return hit;
  }

  /** Despawn normal enemies the player has left far behind (VS leash, doc 03 §7.1). */
  private cullLeash(): void {
    const g = this.g;
    const lx = VIEW_HALF_X * 1.7, ly = VIEW_HALF_Y * 1.7;
    for (const e of g.active) {
      if (!e.alive || e.leashExempt) continue;
      if (Math.abs(e.x - g.player.x) > lx || Math.abs(e.y - g.player.y) > ly) g.despawnEnemy(e);
    }
  }

  onKill(_e: Enemy): void {}
}
