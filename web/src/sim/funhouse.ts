// The Fun House's machinery (D-63): the maze's pivoting panels and the quest's doors (walls that come and
// go, rebuilt every tick on the host and in a guest's mirror alike), the Crooked Corridor's conveyors
// (a push that guests predict with the same formula) and its piston stomps (telegraphed, host-side
// damage). Everything here is a pure function of sim time and replicated state.

import { CONVEYORS, DOOR_PANELS, PISTONS, PISTON_TELE, PIVOTS, pivotState } from '../data/funhouse';
import { setDynamicWalls, type Prop } from '../data/map';
import type { Game } from './game';
import type { Player } from './player';

/** Rebuild the walls that move: each pivot in its current position, and the dressing-room door unless it's open. */
export function refreshFunhouseWalls(g: Game): void {
  const walls: Prop[] = [];
  const shuffle = g.pivotShuffleT > 0;
  for (let i = 0; i < PIVOTS.length; i++) walls.push(pivotState(i, g.time, shuffle) ? PIVOTS[i].b : PIVOTS[i].a);
  if (!g.funhouseDoorOpen) walls.push(...DOOR_PANELS);
  setDynamicWalls(walls);
}

/** A conveyor strip's push on a player standing on it (u/s, consumed by the next moveBody). */
export function addConveyorPush(p: Player): void {
  for (const c of CONVEYORS) {
    if (Math.abs(p.x - c.x) < c.hw && Math.abs(p.y - c.y) < c.hh) {
      p.pullX += c.vx;
      p.pullY += c.vy;
    }
  }
}

/** 0..1 through a piston's warning (0 = idle), and whether it struck between `t0` and `t1`. */
export function pistonPhase(i: number, t: number): number {
  const p = PISTONS[i];
  const c = (t + p.phase) % p.period;
  return c >= p.period - PISTON_TELE ? (c - (p.period - PISTON_TELE)) / PISTON_TELE : 0;
}
function pistonStruck(i: number, t0: number, t1: number): boolean {
  const p = PISTONS[i];
  return Math.floor((t1 + p.phase) / p.period) > Math.floor((t0 + p.phase) / p.period);
}

/** The corridor's machinery, once per tick on the host. */
export function updateFunhouseHazards(g: Game, dt: number): void {
  for (const p of g.players) if (g.isUp(p)) addConveyorPush(p);
  const t1 = g.time, t0 = t1 - dt;
  for (let i = 0; i < PISTONS.length; i++) {
    if (!pistonStruck(i, t0, t1)) continue;
    const pc = PISTONS[i];
    g.fx.push('shake', pc.x, pc.y, 0.35);
    g.fx.push('dust', pc.x, pc.y, 1.4);
    g.bus.emit('sfx', { id: 'slam', x: pc.x, y: pc.y, vol: 0.55 });
    const ctx = g.player;
    for (const p of g.players) {
      if (!g.isUp(p)) continue;
      const dx = p.x - pc.x, dy = p.y - pc.y;
      if (dx * dx + dy * dy < (pc.r + p.r) ** 2) {
        g.setCtx(p);
        g.hurtPlayer(16 * g.diff.dmgMult, pc.x, pc.y);
      }
    }
    g.setCtx(ctx);
  }
}
