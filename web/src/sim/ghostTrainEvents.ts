// The Ghost Train's events (D-80), run by the carnival events runner (sim/carnivalEvents.ts). Each happens
// where the party is: at a station, on its platform and grounds; aboard the moving train, only in ways that
// keep the train's one rule (nothing comes aboard except at its two ends): a trunk in the baggage car, plates
// laid in the dining car, the fog and the rush for everyone.

import { dist2 } from '../core/math';
import { EVENTS, type EventId } from '../data/events';
import { PROPS } from '../data/map';
import { REGIONS, TRANSIT, regionAt, trackY, trainOrigin, TRAIN } from '../data/ghosttrain';
import type { Game } from './game';
import type { Player } from './player';
import { stationSpawnPoint } from './ghosttrain';

export interface GtRunning {
  id: EventId;
  t: number;
  dur: number;
  x: number;
  y: number;
  members: Set<number>;
  acc: number;
  done: boolean;
  /** the station it is at (-1: aboard the moving train) */
  place?: number;
}

/** Where an event happens: the host's own player if standing at a station, else any player who is, else aboard. */
function eventAnchor(g: Game): { p: Player; r: number } {
  const pick = (p: Player) => ({ p, r: regionAt(p.x, p.y) });
  const me = pick(g.player);
  if (g.isUp(g.player) && me.r >= 0 && me.r < TRANSIT) return me;
  for (const p of g.players) {
    if (!g.isUp(p)) continue;
    const it = pick(p);
    if (it.r >= 0 && it.r < TRANSIT) return it;
  }
  return { p: g.player, r: TRANSIT };
}

/** An open spot at station r between `min` and `max` from (x, y), off the platform's crowded strip. */
function stationSpot(g: Game, r: number, x: number, y: number, min: number, max: number): { x: number; y: number } {
  const G = REGIONS[r];
  const top = trackY(r) + TRAIN.halfW + 200;
  for (let i = 0; i < 16; i++) {
    const a = g.rng.angle(), d = g.rng.range(min, max);
    const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
    if (sx < G.cx - 2150 || sx > G.cx + 2150 || sy < top || sy > G.cy + 1150) continue;
    let ok = true;
    for (const pr of PROPS) {
      if (Math.abs(pr.x - sx) > 400 || Math.abs(pr.y - sy) > 400) continue;
      if (pr.r && dist2(pr.x, pr.y, sx, sy) < (pr.r + 40) ** 2) ok = false;
      else if (pr.hw && pr.hh && Math.abs(sx - pr.x) < pr.hw + 40 && Math.abs(sy - pr.y) < pr.hh + 40) ok = false;
    }
    if (ok) return { x: sx, y: sy };
  }
  return { x: Math.max(G.cx - 2000, Math.min(G.cx + 2000, x)), y: Math.max(top, Math.min(G.cy + 1000, y + 200)) };
}

export function gtEventStart(g: Game, r: GtRunning): void {
  const at = eventAnchor(g);
  r.place = at.r === TRANSIT ? -1 : at.r;
  r.x = at.p.x;
  r.y = at.p.y;
  const o = trainOrigin(TRANSIT);
  switch (r.id) {
    case 'gt_fog':
      g.bus.emit('sfx', { id: 'gt_fog', vol: 0.8 });
      break;
    case 'gt_rush_hour':
      g.bus.emit('sfx', { id: 'gt_whistle', vol: 0.7 });
      break;
    case 'gt_lost_luggage': {
      if (r.place! < 0) {
        // aboard: an unclaimed trunk in the baggage car, its lock already broken
        const s = { x: o.x + 1060, y: o.y + 6 };
        r.x = s.x;
        r.y = s.y;
        g.spawnPickup('chest', s.x, s.y, 0).rolls = 2;
        g.spawnHazard('circle', 'chest_marker', s.x, s.y, { r: 60, tele: 0.01, active: EVENTS[r.id].duration, dmg: 0, safe: true });
        break;
      }
      const s = stationSpot(g, r.place!, at.p.x, at.p.y, 480, 760);
      r.x = s.x;
      r.y = s.y;
      g.spawnPickup('chest', s.x, s.y, 0).rolls = 2;
      g.spawnHazard('circle', 'chest_marker', s.x, s.y, { r: 60, tele: 0.01, active: EVENTS[r.id].duration, dmg: 0, safe: true });
      const guard = g.act >= 3 ? 'gt_pallbearer' : g.act >= 2 ? 'gt_porter' : 'gt_ticketless';
      const n = guard === 'gt_pallbearer' ? 3 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const e = g.spawnEnemy(guard, s.x + Math.cos(a) * 130, s.y + Math.sin(a) * 130, { elite: i === 0, exact: true });
        if (e) e.leashExempt = true;
      }
      g.bus.emit('sfx', { id: 'trunkslam', vol: 0.8 });
      break;
    }
    case 'gt_procession': {
      if (r.place! < 0) break; // a procession crosses a platform; aboard, the train just passes it
      // a lane across the station near the player: mourners and pallbearers walk it, slow and in step
      const G = REGIONS[r.place!];
      const y = Math.max(trackY(r.place!) + TRAIN.halfW + 260, Math.min(G.cy + 1000, at.p.y + g.rng.range(-160, 160)));
      const dir = at.p.x > G.cx ? -1 : 1;
      const x0 = G.cx - dir * 2150, x1 = G.cx + dir * 2150;
      r.x = x0;
      r.y = y;
      g.spawnHazard('line', 'gt_procession_lane', x0, y, { x2: x1, y2: y, r2: 70, tele: 2, active: 0.01, dmg: 0, safe: true });
      g.bus.emit('sfx', { id: 'gt_toll', vol: 0.8 });
      g.weapons.schedule(2, () => {
        const col = ['gt_pallbearer', 'gt_mourner', 'gt_mourner', 'gt_pallbearer', 'gt_mourner', 'gt_mourner'];
        const n = g.act >= 3 ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const e = g.spawnEnemy(col[i], x0 - dir * i * 90, y + (i % 2 ? 36 : -36), { exact: true, elite: i === 0 && g.act >= 3 });
          if (!e) continue;
          e.leashExempt = true;
          e.dirX = dir;
          e.dirY = 0;
        }
      });
      break;
    }
    case 'gt_late_supper': {
      if (r.place! < 0) {
        // aboard: plates laid down the dining car's aisle
        r.x = o.x + 120;
        r.y = o.y;
        for (let i = 0; i < 9; i++) {
          const pk = g.spawnPickup('funnel', o.x - 90 + i * 50, o.y + (i % 2 ? 14 : -14), 0);
          pk.life = 14;
        }
        g.spawnHazard('circle', 'treat_marker', r.x, r.y, { r: 150, tele: 0.01, active: EVENTS[r.id].duration, dmg: 0, safe: true });
        break;
      }
      const s = stationSpot(g, r.place!, at.p.x, at.p.y, 300, 480);
      r.x = s.x;
      r.y = s.y;
      g.spawnHazard('circle', 'treat_marker', s.x, s.y, { r: 150, tele: 0.01, active: EVENTS[r.id].duration, dmg: 0, safe: true });
      for (let i = 0; i < 8; i++) {
        const p = stationSpawnPoint(g, at.p);
        g.spawnEnemy('gt_ticketless', p.x, p.y, { exact: true });
      }
      break;
    }
  }
}

export function gtEventTick(g: Game, r: GtRunning, dt: number): void {
  if (r.done) return;
  if (r.id === 'gt_fog') {
    // the Stillfolk come out of the fog at a station (never aboard)
    r.acc += dt;
    if (r.acc >= 2.4 && r.t < r.dur - 2) {
      r.acc = 0;
      const at = eventAnchor(g);
      if (at.r === TRANSIT) return;
      for (let i = 0; i < 2 + Math.min(2, g.act - 1); i++) {
        const p = stationSpawnPoint(g, at.p);
        g.spawnEnemy('gt_stillfolk', p.x, p.y, { exact: true });
      }
    }
    return;
  }
  if (r.id === 'gt_late_supper' && (r.place ?? -1) >= 0) {
    r.acc += dt;
    if (r.acc >= 1.1) {
      r.acc = 0;
      for (let i = 0; i < 2; i++) {
        const a = g.rng.angle(), d = g.rng.range(0, 130);
        const pk = g.spawnPickup('funnel', r.x + Math.cos(a) * d, r.y + Math.sin(a) * d, 0);
        pk.life = 9;
      }
    }
  }
}

export function gtEventFinish(g: Game, r: GtRunning): void {
  if (r.id === 'gt_fog' && !g.player.dead) {
    g.bus.emit('banner', { text: 'YOU SURVIVED THE FOG', sub: 'Bonus Tickets!', style: 'gold' });
    const pk = g.spawnPickup('bank', g.player.x + 40, g.player.y, 12 * g.act);
    pk.magnet = true;
  }
}
