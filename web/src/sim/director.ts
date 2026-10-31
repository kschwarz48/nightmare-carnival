// The Spawn Director (doc 03 §7, Godot EnemyDirector): wave timeline, VS-style spawn band,
// despawn leash, organic balloon drifts, elites, minibosses, formations,
// boss gates, the victory lap and Endless.

import { clamp, dist2 } from '../core/math';
import { BOSS_MAP, BOSSES } from '../data/bosses';
import { CURSE } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { PACING } from '../data/progression';
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
  private minibossAcc = 0;
  private currentWave = '';
  private warned = new Set<string>();
  private spawned = new Set<string>();
  private encoreAcc = 0;
  private pendingBalloons: { t: number; x: number; y: number; dx: number; dy: number; speed: number; enemy: string }[] = [];
  private balloonT = 18;
  /** Wind direction (radians) — wanders slowly; balloon drifts ride it. */
  wind = 0;
  /** Seconds of post-boss breathing room remaining. */
  recoveryT = 0;
  private seenBossKills = 0;
  private scratch = { minAlive: 0, maxAlive: 0, interval: 1, batch: 1 };
  bossActive = false;
  private bruteAnnounced = false;

  constructor(private g: Game) {}

  init(): void {
    // The Tent and the Ferris Wheel are scenery from the first second (doc 05: the reveal).
    for (const id of this.g.map.scenery) {
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
    // co-op: a bigger crowd for a bigger party (the pool holds 560)
    return Math.min(520, Math.round(c * this.g.partyScale.density));
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
    this.updatePendingBalloons(dt);
    // the night wind wanders (seeded): balloon drifts follow it
    this.wind += (g.rng.next() - 0.5) * dt * 0.5;
    if (g.bossKills !== this.seenBossKills) {
      this.seenBossKills = g.bossKills;
      this.recoveryT = PACING.recoverySeconds;
      this.balloonT = Math.max(this.balloonT, 14);
    }
    if (this.recoveryT > 0) this.recoveryT -= dt;

    if (this.bossActive || preBoss) return; // ambient spawns pause for the set-piece
    const wave = this.activeWave();
    const minutes = g.minutes;
    const B = this.blended(wave);
    const cap = Math.min(B.maxAlive * (g.endless ? 1.4 : 1), this.cap);

    if (wave.id !== this.currentWave) {
      this.currentWave = wave.id;
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
      g.spawnEnemy(g.map.miniboss, pt.x, pt.y);
      if (!this.bruteAnnounced) {
        this.bruteAnnounced = true;
        g.bus.emit('banner', { text: 'A CARNIVAL BRUTE APPROACHES', sub: 'He carries a prize chest', style: 'gold' });
      }
    }

    // 1) baseline top-up
    let guard = 0;
    const minAlive = Math.min(B.minAlive, cap);
    while (g.active.length < minAlive && guard++ < 40) {
      if (!this.spawnOne(wave)) break;
    }
    // 2) steady pressure
    const mult = g.events.spawnRateMult * (g.cfg.curse ? 1 / CURSE.intervalMult : 1);
    this.intervalAcc += dt * mult;
    const interval = Math.max(0.05, B.interval);
    while (this.intervalAcc >= interval) {
      this.intervalAcc -= interval;
      for (let i = 0; i < B.batch; i++) {
        if (g.active.length >= cap) break;
        if (!this.spawnOne(wave)) break;
      }
    }
    // 3) organic balloon drifts on the night wind (D-33) — irregular, never during recovery
    if (wave.swarm && this.recoveryT <= 8) {
      this.balloonT -= dt;
      if (this.balloonT <= 0) {
        this.spawnBalloonDrift(wave);
        const a = Math.min(3, g.act - 1);
        this.balloonT = PACING.balloonMinGap[a] - Math.log(1 - g.rng.next() * 0.999) * PACING.balloonMeanExtra[a];
      }
    }
    // Endless: Encore Ringmaster every 5 minutes (D-17).
    if (g.endless) {
      this.encoreAcc += dt;
      if (this.encoreAcc >= 300) {
        this.encoreAcc = 0;
        const b = createBoss(g, BOSS_MAP[g.map.finalBoss], { encore: true });
        g.bosses.push(b);
      }
    }
  }

  /** Dormant bosses (Tent, Wheel) wake only once their warning has played. */
  gateOpen(id: string): boolean {
    return this.warned.has(id);
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
      // D-61: the firing squads proved too much, so half of each rank comes as Evil Clowns instead (the
      // crowd stays as dense): a rank of 4 is 2 muskets and 2 clowns, a rank of 5 is 2 and 3
      const muskets = Math.max(2, Math.floor(n / 2));
      const made = this.spawnFormation(pt.x, pt.y, muskets);
      for (let i = muskets; i < n; i++) this.g.spawnEnemy('evil_clown', pt.x + this.g.rng.range(-60, 60), pt.y + this.g.rng.range(-60, 60), { elite: this.g.rng.chance(this.eliteChance()) });
      return made > 0;
    }
    const elite = forceElite || this.g.rng.chance(this.eliteChance());
    return this.g.spawnEnemy(id, pt.x, pt.y, { elite }) !== null;
  }

  /** A marching rank of Puppet Soldiers sharing one formation controller. */
  spawnFormation(x: number, y: number, count: number): number {
    const g = this.g;
    const id = this.nextFormation++;
    const tgt = g.nearestLiving(x, y);
    const dx0 = tgt.x - x, dy0 = tgt.y - y;
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
      const tgt = g.nearestLiving(f.x, f.y);
      const dx = tgt.x - f.x, dy = tgt.y - f.y;
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

  // ------------------------------------------------------------------ organic balloon drifts (D-33)
  /**
   * A loose bouquet of runaway balloons drifts in on the night wind. Timing, entry edge, heading,
   * speed, group size and spacing are all drawn from the seeded RNG; the wind direction wanders
   * slowly across the run, so drifts come from varied but coherent directions.
   */
  private spawnBalloonDrift(wave: WaveDef): void {
    const g = this.g;
    const sw = wave.swarm!;
    const p = g.spawnAnchor();
    const r = g.rng;
    const size = Math.max(4, Math.round(sw.size * (0.22 + 0.78 * Math.pow(r.next(), 1.6))));
    // enter roughly from upwind, never from exactly the same place twice
    const ang = this.wind + Math.PI + r.range(-1.2, 1.2);
    const ring = Math.hypot(VIEW_HALF_X, VIEW_HALF_Y) + 120;
    const tan = r.range(-320, 320);
    const ex = p.x + Math.cos(ang) * ring - Math.sin(ang) * tan;
    const ey = p.y + Math.sin(ang) * ring + Math.cos(ang) * tan;
    // aim near (not at) the player, then let the wind bend the heading
    const tx = p.x + r.range(-340, 340), ty = p.y + r.range(-260, 260);
    let dx = tx - ex, dy = ty - ey;
    let l = Math.hypot(dx, dy) || 1;
    dx = dx / l + Math.cos(this.wind) * 0.35;
    dy = dy / l + Math.sin(this.wind) * 0.35;
    l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const speed = r.range(PACING.balloonSpeed[0], PACING.balloonSpeed[1]);
    const spread = 40 + size * 6;
    for (let k = 0; k < size; k++) {
      // a ragged stream: lateral scatter plus staggered arrival
      const lat = (r.next() + r.next() - 1) * spread;
      this.pendingBalloons.push({
        t: r.next() * (0.4 + size * 0.06),
        x: ex - dy * lat,
        y: ey + dx * lat,
        dx, dy,
        speed: speed * r.range(0.85, 1.15),
        enemy: sw.enemy,
      });
    }
    g.bus.emit('balloon_drift', { x: ex, y: ey, dirX: dx, dirY: dy, size });
  }

  private updatePendingBalloons(dt: number): void {
    const g = this.g;
    for (let i = this.pendingBalloons.length - 1; i >= 0; i--) {
      const b = this.pendingBalloons[i];
      b.t -= dt;
      if (b.t > 0) continue;
      this.pendingBalloons.splice(i, 1);
      if (g.active.length >= this.cap + 40) continue;
      const e = g.spawnEnemy(b.enemy, b.x, b.y);
      if (!e) continue;
      e.dirX = b.dx;
      e.dirY = b.dy;
      e.speed = b.speed;
      e.leashExempt = true;
    }
  }

  /** Wave density for this moment, scaled for the party size (co-op: denser waves, arriving faster). */
  private blended(wave: WaveDef): { minAlive: number; maxAlive: number; interval: number; batch: number } {
    const out = this.blendedSolo(wave);
    const dens = this.g.partyScale.density;
    if (dens !== 1) {
      out.minAlive *= dens;
      out.maxAlive *= dens;
      out.interval /= dens;
    }
    return out;
  }

  /** Density blended toward the next wave over the back half of each window (no step jumps). */
  private blendedSolo(wave: WaveDef): { minAlive: number; maxAlive: number; interval: number; batch: number } {
    const out = this.scratch;
    out.minAlive = wave.minAlive;
    out.maxAlive = wave.maxAlive;
    out.interval = wave.interval;
    out.batch = wave.batch;
    if (this.g.victoryLap || this.g.endless) return out;
    const i = WAVES.indexOf(wave);
    const next = WAVES[i + 1];
    if (next) {
      const span = next.start - wave.start;
      const t = (this.g.time - wave.start) / span;
      const k = clamp((t - PACING.waveBlendStart) / (1 - PACING.waveBlendStart), 0, 1);
      out.minAlive = wave.minAlive + (next.minAlive - wave.minAlive) * k;
      out.maxAlive = wave.maxAlive + (next.maxAlive - wave.maxAlive) * k;
      out.interval = wave.interval + (next.interval - wave.interval) * k;
      out.batch = Math.round(wave.batch + (next.batch - wave.batch) * k);
    }
    // recovery period after a boss: the crowd thins, then swells back
    if (this.recoveryT > 0) {
      const k = this.recoveryT / PACING.recoverySeconds;
      out.minAlive *= 1 + (PACING.recoveryMinAliveScale - 1) * k;
      out.interval *= 1 + (PACING.recoveryIntervalScale - 1) * k;
    }
    return out;
  }

  /** Rectangular band outside the screen out to 1.5× (VS spawn area), clamped, never stacked. */
  spawnPoint(): { x: number; y: number } {
    const g = this.g;
    const p = g.spawnAnchor();
    const hx = VIEW_HALF_X, hy = VIEW_HALF_Y;
    const ox = hx * 1.5, oy = hy * 1.5;
    for (let attempt = 0; attempt < 10; attempt++) {
      let x = p.x + g.rng.range(-ox, ox);
      let y = p.y + g.rng.range(-oy, oy);
      if (Math.abs(x - p.x) < hx && Math.abs(y - p.y) < hy) continue;
      x = clamp(x, -MAP_HALF + 20, MAP_HALF - 20);
      y = clamp(y, -MAP_HALF + 20, PLAYER_BOUNDS.maxY + 20);
      if (Math.abs(x - p.x) < hx * 0.85 && Math.abs(y - p.y) < hy * 0.85) continue; // clamped onto the screen
      if (g.players.length > 1 && g.inAnyView(x, y, 0.95)) continue; // never pop in on a teammate's screen
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
      let far = true;
      for (const p of g.players) if (g.isUp(p) && Math.abs(e.x - p.x) <= lx && Math.abs(e.y - p.y) <= ly) far = false;
      if (far) g.despawnEnemy(e);
    }
  }

  onKill(_e: Enemy): void {}
}
