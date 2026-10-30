// Player locomotion shared by the authoritative simulation and the co-op guest's client-side
// prediction (D-52): steering from input, grease-slick momentum, integration and collision with
// the map's solid props, solid boss bodies and the play bounds. Pure: no events, no randomness.

import { clamp, dist2 } from '../core/math';
import { GREASE_SLICKS, PLAYER_BOUNDS, PROPS, type Prop } from '../data/map';
import type { Player } from './player';

export interface SolidBody { x: number; y: number; solid: boolean; solidR: number }

/** Steer toward the input at `speed` (plus any pull), integrate, collide. Dash overrides steering. */
export function moveBody(p: Player, mx: number, my: number, speed: number, dt: number, bodies: readonly SolidBody[], dashing = p.dashT > 0): void {
  let tvx = mx * speed + p.pullX;
  let tvy = my * speed + p.pullY;
  p.pullX = 0;
  p.pullY = 0;
  if (dashing) {
    tvx = p.dashX * p.dashSpeed;
    tvy = p.dashY * p.dashSpeed;
  }
  // Grease slicks: momentum instead of instant response (doc 03 §4).
  let onGrease = false;
  for (const gs of GREASE_SLICKS) if (dist2(gs.x, gs.y, p.x, p.y) < gs.r * gs.r) onGrease = true;
  if (onGrease && !dashing) {
    p.vx += (tvx - p.vx) * Math.min(1, dt * 2.5);
    p.vy += (tvy - p.vy) * Math.min(1, dt * 2.5);
  } else {
    p.vx = tvx;
    p.vy = tvy;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  collideBody(p, bodies);
}

/**
 * An inhale's pull on a player (units/s toward the hazard, consumed by the next moveBody): it reaches
 * `pullR` (default four radii) and is twice as strong at the centre as at the rim.
 */
export function addHazardPull(p: Player, h: { x: number; y: number; r: number; pull: number; pullR: number }): void {
  const R = h.pullR || h.r * 4;
  const dx = h.x - p.x, dy = h.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d >= R) return;
  const k = h.pull * (1 - 0.5 * (d / R));
  p.pullX += (dx / d) * k;
  p.pullY += (dy / d) * k;
}

/** The fastest a stage ring reels anyone back (units/s): more than any build can walk, so nobody escapes,
 *  but a visible glide rather than a jump across the map. */
export const RING_PULL_MAX = 560;

/**
 * A boss's stage ring (D-61): a player outside it is drawn back in, six units/s for every unit outside
 * (aiming a few units inside the edge, so whoever is reeled back ends up on the stage rather than
 * hovering at its rim), up to `RING_PULL_MAX`; inside, nothing. The host and a guest's prediction use
 * this same formula on the replicated ring, so a guest is never corrected for walking into it.
 * Returns whether it pulled.
 */
export function addRingPull(p: Player, b: { ringX: number; ringY: number; ringR: number }): boolean {
  if (b.ringR <= 0) return false;
  const dx = p.x - b.ringX, dy = p.y - b.ringY;
  const d = Math.hypot(dx, dy);
  if (d <= b.ringR || d < 1e-6) return false;
  const k = Math.min(RING_PULL_MAX, (d - b.ringR + 8) * 6);
  p.pullX -= (dx / d) * k;
  p.pullY -= (dy / d) * k;
  return true;
}

/** Normalised steering from raw input; updates facing. Returns [mx, my]. */
export function steer(p: Player, ix: number, iy: number): [number, number] {
  let mx = ix, my = iy;
  const ml = Math.hypot(mx, my);
  if (ml > 1) {
    mx /= ml;
    my /= ml;
  }
  p.moving = ml > 0.15;
  if (p.moving) {
    const l = Math.hypot(mx, my) || 1;
    p.faceX = mx / l;
    p.faceY = my / l;
    if (Math.abs(mx) > 0.2) p.facing = mx > 0 ? 1 : -1;
  }
  return [mx, my];
}

export function collideBody(p: Player, bodies: readonly SolidBody[]): void {
  for (const pr of PROPS) pushOut(p, pr);
  // A dormant/standing boss body is solid scenery (the Tent at the center, the Wheel at its base).
  for (const b of bodies) {
    if (!b.solid) continue;
    const rr = b.solidR + p.r;
    const dx = p.x - b.x, dy = p.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x = b.x + (dx / d) * rr;
      p.y = b.y + (dy / d) * rr;
    }
  }
  p.x = clamp(p.x, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
  p.y = clamp(p.y, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
}

function pushOut(p: Player, pr: Prop): void {
  if (pr.r) {
    const rr = pr.r + p.r;
    const dx = p.x - pr.x, dy = p.y - pr.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 0.001;
      p.x = pr.x + (dx / d) * rr;
      p.y = pr.y + (dy / d) * rr;
    }
  } else if (pr.hw && pr.hh) {
    const cx = clamp(p.x, pr.x - pr.hw, pr.x + pr.hw);
    const cy = clamp(p.y, pr.y - pr.hh, pr.y + pr.hh);
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < p.r * p.r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * p.r;
        p.y = cy + (dy / d) * p.r;
      } else {
        // inside the box: push out the shortest axis
        const ox = pr.hw + p.r - Math.abs(p.x - pr.x);
        const oy = pr.hh + p.r - Math.abs(p.y - pr.y);
        if (ox < oy) p.x += p.x < pr.x ? -ox : ox;
        else p.y += p.y < pr.y ? -oy : oy;
      }
    }
  }
}
