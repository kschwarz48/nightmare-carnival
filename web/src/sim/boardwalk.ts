// The Boardwalk's machinery (D-68): the sea (the tide and the quest's low water), the Undertow's crossing
// where the coaster dips low over the beach, and where creatures stand: land things wade in the shallows
// and are slowed, sea things swim fast and come up out of the water. Everything is a pure function of sim
// time and replicated state, refreshed every tick on the host and in a guest's mirror alike.

import { BW_BOUNDS, CROSSING, PIER_DECKS, RIDE, SEA, onDeck, shoreY, trackAt, trainU, waterDepth } from '../data/boardwalk';
import type { EnemyDef } from '../data/enemies';
import type { Enemy } from './entities';
import type { Game } from './game';

/** Set the sea from the game: its clock and how far the quest's low water has drawn the shore out. */
export function refreshSea(g: Game): void {
  SEA.t = g.time;
  SEA.retreat = g.quests?.get<{ retreat?: number } & import('./quest').QuestChain>('summers_end')?.retreat ?? 0;
}

/** Where each car of the train is (x, y, height), head first. */
export function trainCars(t: number): [number, number, number][] {
  const { u } = trainU(t);
  const out: [number, number, number][] = [];
  for (let k = 0; k < RIDE.cars; k++) out.push(trackAt(u - k * RIDE.carGap));
  return out;
}

/** How much a creature's speed is scaled by the water it stands in. */
export function wadeFactor(e: Enemy): number {
  const d = waterDepth(e.x, e.y);
  if (e.def.aquatic) return d > 40 ? 1.3 : 0.85;
  return d > 60 ? 0.62 : 1;
}

/**
 * Where a new creature appears: sea things come up out of the water when anyone is near it, land things
 * never start out in deep water (they're moved onto the nearest sand or deck).
 */
export function placeSpawn(g: Game, def: EnemyDef, x: number, y: number): { x: number; y: number } {
  const depth = waterDepth(x, y);
  if (def.aquatic) {
    // the nearest player's distance from the water decides whether the sea is "here"
    const p = g.nearestLiving(x, y);
    const near = onDeck(p.x, p.y) || waterDepth(p.x, p.y) > -700;
    if (near && depth < 120) {
      const sy = shoreY(x);
      return { x, y: Math.min(BW_BOUNDS.maxY + 300, Math.max(y, sy + 160 + g.rng.range(0, 260))) };
    }
    return { x, y };
  }
  if (depth <= 200) return { x, y };
  // a deck is nearer than the beach when the spawn is out by the pier
  let bx = x, by = shoreY(x) - 40, bd = (y - by) ** 2;
  for (const r of PIER_DECKS) {
    const cx = Math.min(r.x1 - 20, Math.max(r.x0 + 20, x)), cy = Math.min(r.y1 - 20, Math.max(r.y0 + 20, y));
    const d = (cx - x) ** 2 + (cy - y) ** 2;
    if (d < bd) {
      bd = d;
      bx = cx;
      by = cy;
    }
  }
  return { x: bx, y: by };
}

/** The map's machinery, once per tick on the host. */
export function updateBoardwalk(g: Game, dt: number): void {
  refreshSea(g);
  // the Undertow's crossing: a car running low over the beach hits whatever stands under it
  const cars = trainCars(g.time);
  const ctx = g.player;
  for (const c of cars) {
    if (c[2] > 70) continue;
    if ((c[0] - CROSSING.x) ** 2 + (c[1] - CROSSING.y) ** 2 > (CROSSING.r + 80) ** 2) continue;
    for (const p of g.players) {
      if (!g.isUp(p)) continue;
      const dx = p.x - c[0], dy = p.y - c[1];
      if (dx * dx + dy * dy > (70 + p.r) ** 2) continue;
      g.setCtx(p);
      if (g.hurtPlayer(18 * g.diff.dmgMult, c[0], c[1])) {
        const d = Math.hypot(dx, dy) || 1;
        p.pullX += (dx / d) * 900;
        p.pullY += (dy / d) * 900;
      }
    }
    // and the crowd standing on the track
    g.forEachEnemyInCircle(c[0], c[1], 70, (e) => {
      if (!e.isBoss) g.damageEnemy(e, 40 * dt * 6, false, 0, 0, 0, 'coaster');
    });
  }
  g.setCtx(ctx);
}
