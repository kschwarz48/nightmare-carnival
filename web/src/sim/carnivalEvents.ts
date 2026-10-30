// Carnival Events runner (doc 03 §5, D-16). One random event every 70–100 s outside boss fights,
// plus authored beats. Each event creates a positional risk/reward decision.

import { dist2 } from '../core/math';
import { BOSSES } from '../data/bosses';
import { EVENTS, SCHEDULED_EVENTS, type EventId } from '../data/events';
import { PROPS } from '../data/map';
import type { Enemy } from './entities';
import type { Game } from './game';
import { VIEW_HALF_X, VIEW_HALF_Y } from './constants';

interface Running {
  id: EventId;
  t: number;
  dur: number;
  x: number;
  y: number;
  members: Set<number>;
  acc: number;
  done: boolean;
}

export class CarnivalEvents {
  private timer = 95;
  private scheduled = new Set<number>();
  running: Running[] = [];
  spawnRateMult = 1;
  capMult = 1;
  carouselBonus = false;

  constructor(private g: Game) {}

  update(dt: number): void {
    const g = this.g;
    this.spawnRateMult = 1;
    this.capMult = 1;
    let darknessTarget = 0;
    let ticketBoost = 1;
    this.carouselBonus = false;

    for (const r of this.running) {
      r.t += dt;
      this.tickEvent(r, dt);
      if (r.id === 'lights_out') {
        darknessTarget = r.t < r.dur - 1 ? 1 : 0;
        this.spawnRateMult *= 1.3;
      }
      if (r.id === 'calliope') {
        this.spawnRateMult *= 1.5;
        this.capMult *= 1.25;
        ticketBoost = 1.5;
      }
      if (r.id === 'carousel_spins') this.carouselBonus = true;
      if (r.t >= r.dur && !r.done) {
        r.done = true;
        this.finish(r);
      }
    }
    this.running = this.running.filter((r) => !r.done || (r.id === 'clown_car' && r.members.size > 0));
    g.darkness += (darknessTarget - g.darkness) * Math.min(1, dt * 1.5);
    if (!g.victoryLap) g.ticketMult = (g.endless ? 1.5 : 1) * ticketBoost;

    if (g.director.bossActive || g.phase !== 'play') return;
    for (const s of SCHEDULED_EVENTS) {
      if (!this.scheduled.has(s.time) && g.time >= s.time && g.time < s.time + 5) {
        this.scheduled.add(s.time);
        this.start(s.id);
        this.timer = Math.max(this.timer, 45);
      }
    }
    // Random events — never within 30 s of a boss gate.
    const nearGate = !g.endless && BOSSES.some((b) => g.time > b.gate - 30 && g.time < b.gate + 20);
    this.timer -= dt;
    if (this.timer <= 0 && !nearGate && !g.victoryLap) {
      this.timer = g.rng.range(70, 100);
      const ids = (Object.keys(EVENTS) as EventId[]).filter((id) => EVENTS[id].minAct <= g.act && !this.running.some((r) => r.id === id));
      const weights = ids.map((id) => EVENTS[id].weights[Math.min(3, g.act - 1)] * (id === 'carousel_spins' && this.distToCarousel() > 1500 ? 0 : 1));
      if (ids.length && weights.some((w) => w > 0)) this.start(ids[g.rng.weighted(weights)]);
    }
  }

  private distToCarousel(): number {
    const c = PROPS.find((p) => p.kind === 'carousel')!;
    return Math.sqrt(dist2(c.x, c.y, this.g.player.x, this.g.player.y));
  }

  start(id: EventId): void {
    const g = this.g;
    const def = EVENTS[id];
    const r: Running = { id, t: 0, dur: def.duration, x: g.player.x, y: g.player.y, members: new Set(), acc: 0, done: false };
    g.bus.emit('carnival_event', { id, banner: def.banner });
    switch (id) {
      case 'funnel_cake': {
        // Pick a stall near the player (crowd magnet).
        let best = PROPS[0], bd = Infinity;
        for (const p of PROPS) {
          if (!p.kind.startsWith('stall') && p.kind !== 'cotton_stand' && p.kind !== 'hotdog_stand' && p.kind !== 'popcorn_cart' && p.kind !== 'prize_stand') continue;
          const d = dist2(p.x, p.y, g.player.x, g.player.y);
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        if (bd > 1100 * 1100) {
          const s = g.nearbyOpenSpot(350, 500);
          r.x = s.x;
          r.y = s.y;
        } else {
          r.x = best.x;
          r.y = best.y + (best.hh ?? best.r ?? 40) + 60;
        }
        g.spawnHazard('circle', 'treat_marker', r.x, r.y, { r: 150, tele: 0.01, active: def.duration, dmg: 0, safe: true });
        for (let i = 0; i < 10; i++) {
          const a = g.rng.angle();
          g.spawnEnemy('living_balloon', r.x + Math.cos(a) * 260, r.y + Math.sin(a) * 260);
        }
        break;
      }
      case 'stampede': {
        const a = g.rng.chance(0.5) ? 0 : Math.PI / 2;
        const dx = Math.cos(a), dy = Math.sin(a);
        const L = 1250;
        const sx = g.player.x - dx * L, sy = g.player.y - dy * L;
        r.x = sx;
        r.y = sy;
        g.spawnHazard('line', 'stampede', sx, sy, { x2: sx + dx * L * 2, y2: sy + dy * L * 2, r2: 120, tele: 1.8, active: 0.01, dmg: 0 });
        g.bus.emit('sfx', { id: 'whinny', vol: 0.9 });
        g.weapons.schedule(1.8, () => {
          const n = 9;
          for (let i = 0; i < n; i++) {
            const off = (i - (n - 1) / 2) * 30;
            const e = g.spawnEnemy('carousel_horse', sx - dy * off - dx * (i % 2) * 40, sy + dx * off - dy * (i % 2) * 40);
            if (!e) continue;
            e.state = 2;
            e.dirX = dx;
            e.dirY = dy;
            e.n1 = L * 2 + 200;
            e.n2 = 0;
            e.leashExempt = true;
          }
          g.bus.emit('sfx', { id: 'stampede', vol: 0.9 });
        });
        break;
      }
      case 'clown_car': {
        const s = g.nearbyOpenSpot(260, 380);
        r.x = s.x;
        r.y = s.y;
        g.fx.push('dust', s.x, s.y, 2);
        g.bus.emit('sfx', { id: 'carhorn', vol: 0.9 });
        const n = 4 + g.act;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const e = g.spawnEnemy('evil_clown', s.x + Math.cos(a) * 40, s.y + Math.sin(a) * 40, { elite: true });
          if (e) r.members.add(e.uid);
        }
        break;
      }
      case 'last_ticket': {
        const s = g.nearbyOpenSpot(520, 760);
        r.x = s.x;
        r.y = s.y;
        g.spawnPickup('chest', s.x, s.y, 0).rolls = 2;
        g.spawnHazard('circle', 'chest_marker', s.x, s.y, { r: 60, tele: 0.01, active: def.duration, dmg: 0, safe: true });
        const guard = g.act >= 3 ? 'carousel_horse' : g.act >= 2 ? 'evil_clown' : 'possessed_stuffie';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const e = g.spawnEnemy(guard, s.x + Math.cos(a) * 120, s.y + Math.sin(a) * 120, { elite: i === 0 });
          if (e) e.leashExempt = true;
        }
        break;
      }
      case 'carousel_spins': {
        const c = PROPS.find((p) => p.kind === 'carousel')!;
        r.x = c.x;
        r.y = c.y;
        g.bus.emit('sfx', { id: 'calliope', vol: 0.7 });
        break;
      }
      case 'formation': {
        const side = g.rng.chance(0.5) ? 1 : -1;
        g.director.spawnFormation(g.player.x + side * (VIEW_HALF_X + 80), g.player.y - 80, 6);
        g.director.spawnFormation(g.player.x + side * (VIEW_HALF_X + 80), g.player.y + 120, 6);
        g.bus.emit('sfx', { id: 'drumroll', vol: 0.8 });
        break;
      }
      case 'mole_brigade': {
        const a = g.rng.angle();
        const dx = Math.cos(a), dy = Math.sin(a);
        for (let i = 0; i < 7; i++) {
          const off = (i - 3) * 70;
          const e = g.spawnEnemy('whack_a_mole', g.player.x + dx * 170 - dy * off, g.player.y + dy * 170 + dx * off);
          if (e) {
            e.n1 = 1;
            e.t = 0.6 + i * 0.22;
          }
        }
        break;
      }
      case 'lights_out':
      case 'calliope':
        break;
    }
    this.running.push(r);
  }

  private tickEvent(r: Running, dt: number): void {
    const g = this.g;
    if (r.done) return;
    if (r.id === 'funnel_cake') {
      r.acc += dt;
      if (r.acc >= 1.1) {
        r.acc = 0;
        for (let i = 0; i < 2; i++) {
          const a = g.rng.angle();
          const d = g.rng.range(0, 130);
          const pk = g.spawnPickup('funnel', r.x + Math.cos(a) * d, r.y + Math.sin(a) * d, 0);
          pk.life = 9;
        }
      }
    } else if (r.id === 'carousel_spins') {
      r.acc += dt;
      if (r.acc >= 2.6) {
        r.acc = 0;
        const n = 6;
        const off = g.rng.angle();
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          const e = g.spawnEnemy('carousel_horse', r.x + Math.cos(a) * 190, r.y + Math.sin(a) * 190);
          if (!e) continue;
          e.state = 2;
          e.dirX = Math.cos(a);
          e.dirY = Math.sin(a);
          e.n1 = 900;
          e.n2 = 0;
          e.leashExempt = true;
          g.spawnHazard('line', 'lane', e.x, e.y, { x2: e.x + e.dirX * 900, y2: e.y + e.dirY * 900, r2: 18, tele: 0.01, active: 0.4, dmg: 0, safe: true });
        }
      }
    }
  }

  private finish(r: Running): void {
    const g = this.g;
    if (r.id === 'lights_out' && !g.player.dead) {
      g.bus.emit('banner', { text: 'YOU SURVIVED THE DARK', sub: 'Bonus Tickets!', style: 'gold' });
      const pk = g.spawnPickup('bank', g.player.x + 60, g.player.y, 12 * g.act);
      pk.magnet = true;
    }
  }

  onKill(e: Enemy): void {
    for (const r of this.running) {
      if (r.id === 'clown_car' && r.members.has(e.uid)) {
        r.members.delete(e.uid);
        if (r.members.size === 0) {
          this.g.spawnPickup('chest', e.x, e.y, 0).rolls = 2;
          this.g.bus.emit('banner', { text: 'CLOWN CAR CLEARED!', sub: 'A chest tumbles out', style: 'gold' });
        }
      }
    }
    if (this.carouselBonus) {
      const c = PROPS.find((p) => p.kind === 'carousel')!;
      if (dist2(c.x, c.y, e.x, e.y) < 650 * 650) this.g.dropTickets(e.x, e.y, e.tickets);
    }
  }

  isRunning(id: EventId): boolean {
    return this.running.some((r) => r.id === id && !r.done);
  }
}

