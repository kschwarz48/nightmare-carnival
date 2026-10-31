// The Boardwalk's enemies (D-68): one behaviour per new archetype. As on the other maps, every attack has
// a readable wind-up (`e.windup` drives the renderer's telegraph pose) and `g.player` is the nearest
// standing player (the game sets it before each enemy's update). What comes up out of the sand or the surf
// rises first (`e.emerge`, counted down in enemyAI before any of these run).

import { dist2, segDist2, TAU } from '../core/math';
import type { Enemy } from './entities';
import type { Game } from './game';

const P = (e: Enemy, k: string, d: number): number => {
  const v = e.def.params[k];
  return typeof v === 'number' ? v : d;
};

/** How long a creature takes to climb up out of the sand or the water. */
export const EMERGE = 1;
/** How much faster the crowd moves on a player marked by a Ticket Taker's stub, and for how long. */
export const MARKED_HASTE = 1.22;

function moveDir(g: Game, e: Enemy, dx: number, dy: number, speed: number, dt: number): void {
  const l = Math.hypot(dx, dy) || 1;
  const sp = speed * g.slowFactor(e);
  e.vx = (dx / l) * sp;
  e.vy = (dy / l) * sp;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (Math.abs(e.vx) > 4) e.face = e.vx > 0 ? 1 : -1;
}

const sfx = (g: Game, id: string, x: number, y: number, vol: number) => g.bus.emit('sfx', { id, x, y, vol });

/** Unit vector and distance from the enemy to its player. */
function toward(g: Game, e: Enemy): { ux: number; uy: number; d: number } {
  const p = g.player;
  const dx = p.x - e.x, dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  return { ux: dx / d, uy: dy / d, d };
}

// ---------------------------------------------------------------- the Drowned
/** A waterlogged shamble: drags itself a few slow steps, then lurches, swaying off its line. */
export function drowned(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  e.t -= dt;
  if (e.t <= 0) {
    e.state = e.state === 1 ? 0 : 1;
    e.t = e.state === 1 ? g.rng.range(0.4, 0.6) : g.rng.range(0.7, 1.3);
    if (e.state === 1 && g.rng.chance(0.2) && dist2(e.x, e.y, p.x, p.y) < 450 * 450) sfx(g, 'gurgle', e.x, e.y, 0.25);
  }
  const k = e.state === 1 ? P(e, 'lurch', 1.65) : P(e, 'drag', 0.55);
  const wob = Math.sin(e.animT * 2.3 + e.idx) * 0.4;
  const dx = p.x - e.x, dy = p.y - e.y, c = Math.cos(wob), s = Math.sin(wob);
  moveDir(g, e, dx * c - dy * s, dx * s + dy * c, e.speed * k * (e.elite ? 1.1 : 1), dt);
}

// ---------------------------------------------------------------- Shore Crawler
/**
 * Scuttles across your line more than along it, flipping sides (0); raises its claws (1), darts straight
 * in (2) and sits a beat (3). `dirX/dirY` always point at its player, so the body faces you as it goes.
 */
export function crab(g: Game, e: Enemy, dt: number): void {
  const { ux, uy, d } = toward(g, e);
  if (e.state === 0) {
    e.dirX = ux;
    e.dirY = uy;
  }
  switch (e.state) {
    case 0: {
      e.t2 -= dt;
      if (e.t2 <= 0) {
        e.t2 = g.rng.range(0.35, 0.8);
        e.tx = g.rng.chance(0.5) ? 1 : -1;
      }
      const side = 0.95 * (e.tx || 1), fwd = 0.5;
      moveDir(g, e, ux * fwd - uy * side, uy * fwd + ux * side, e.speed, dt);
      e.n1 -= dt;
      if (d < P(e, 'range', 230) && e.n1 <= 0 && e.spawnT > 0.5) {
        e.state = 1;
        e.t = P(e, 'windup', 0.35);
        sfx(g, 'clatter', e.x, e.y, 0.35);
      }
      break;
    }
    case 1:
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'windup', 0.35);
      if (e.t <= 0) {
        e.state = 2;
        e.t = P(e, 'dashTime', 0.3);
      }
      break;
    case 2:
      moveDir(g, e, e.dirX, e.dirY, P(e, 'dash', 540) * (e.elite ? 1.15 : 1), dt);
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 3;
        e.t = P(e, 'recover', 0.45);
        e.windup = 0;
      }
      break;
    case 3:
      e.vx = e.vy = 0;
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 0;
        e.n1 = g.rng.range(1.2, 2.2);
      }
      break;
  }
}

// ---------------------------------------------------------------- Ticket Taker
/** Keeps a stiff distance and side-steps; raises its punch and flicks a stub that marks whoever it hits. */
export function usher(g: Game, e: Enemy, dt: number): void {
  const { ux, uy, d } = toward(g, e);
  const keep = P(e, 'keep', 300);
  e.dirX = ux;
  e.dirY = uy;
  e.n2 -= dt;
  if (e.n2 <= 0) {
    e.n2 = g.rng.range(0.8, 1.6);
    e.tx = g.rng.chance(0.5) ? 1 : -1;
  }
  if (e.state === 1) {
    e.vx = e.vy = 0;
    e.face = ux > 0 ? 1 : -1;
  } else {
    const away = d < keep * 0.8 ? -1 : d > keep * 1.2 ? 1 : 0;
    const side = 0.6 * (e.tx || 1);
    moveDir(g, e, ux * away - uy * side, uy * away + ux * side, e.speed * (away ? 1 : 0.55), dt);
  }
  if (e.state === 0) {
    if (e.n1 === 0) {
      e.t = P(e, 'fire', 3.2) * g.rng.next();
      e.n1 = 1;
    }
    e.t -= dt;
    if (e.t <= 0 && d < keep * 1.8) {
      e.state = 1;
      e.t2 = P(e, 'windup', 0.55);
      sfx(g, 'punch', e.x, e.y, 0.35);
    }
    return;
  }
  e.t2 -= dt;
  e.windup = 1 - e.t2 / P(e, 'windup', 0.55);
  if (e.t2 > 0) return;
  const sp = P(e, 'projSpeed', 300), dmg = P(e, 'projDmg', 7) * g.diff.dmgMult;
  const a0 = Math.atan2(uy, ux);
  for (const off of e.elite ? [-0.22, 0, 0.22] : [0]) {
    g.spawnBullet('stub', e.x, e.y, Math.cos(a0 + off) * sp, Math.sin(a0 + off) * sp, dmg, { r: 8, life: P(e, 'projLife', 3.2), spin: 10 });
  }
  sfx(g, 'whoosh', e.x, e.y, 0.3);
  e.state = 0;
  e.windup = 0;
  e.t = P(e, 'fire', 3.2);
}

// ---------------------------------------------------------------- Taffy Horror
/**
 * Oozes after you (0); draws back a strand while a sticky line marks the lash (1); lashes — whoever is on
 * the line is slowed hard and reeled in for a moment (2). `n2` is the caught player's index (-1: nobody).
 */
export function taffy(g: Game, e: Enemy, dt: number): void {
  const { ux, uy, d } = toward(g, e);
  switch (e.state) {
    case 0:
      moveDir(g, e, ux, uy, e.speed, dt);
      e.n1 -= dt;
      if (d < P(e, 'range', 270) && e.n1 <= 0 && e.spawnT > 1) {
        e.state = 1;
        e.t = P(e, 'windup', 0.8);
        e.dirX = ux;
        e.dirY = uy;
        const L = P(e, 'lash', 300);
        g.spawnHazard('line', 'taffy_lash', e.x, e.y, { x2: e.x + ux * L, y2: e.y + uy * L, r2: P(e, 'lashW', 24), tele: e.t, active: 0.01, dmg: 0, owner: e.uid });
        sfx(g, 'stretch', e.x, e.y, 0.4);
      }
      break;
    case 1:
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'windup', 0.8);
      if (e.t <= 0) {
        const L = P(e, 'lash', 300), w = P(e, 'lashW', 24);
        const x2 = e.x + e.dirX * L, y2 = e.y + e.dirY * L;
        const ctx = g.player;
        e.n2 = -1;
        for (const pl of g.players) {
          if (!g.isUp(pl) || segDist2(pl.x, pl.y, e.x, e.y, x2, y2) > (w + pl.r * 0.75) ** 2) continue;
          g.setCtx(pl);
          if (g.hurtPlayer(P(e, 'lashDmg', 11) * g.diff.dmgMult, e.x, e.y, { slow: P(e, 'slow', 0.6), slowT: P(e, 'slowT', 1.4) }) && e.n2 < 0) e.n2 = pl.index;
        }
        g.setCtx(ctx);
        e.state = 2;
        e.t = 0.4;
        e.t2 = 0.3;
        sfx(g, 'whoosh', e.x, e.y, 0.4);
      }
      break;
    case 2: {
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = 0;
      // reeling in whoever it caught
      const pl = e.n2 >= 0 ? g.players[e.n2] : undefined;
      if (pl && e.t2 > 0 && g.isUp(pl)) {
        e.t2 -= dt;
        const dx = e.x - pl.x, dy = e.y - pl.y, dd = Math.hypot(dx, dy) || 1;
        if (dd > e.r + pl.r + 12) {
          pl.pullX += (dx / dd) * P(e, 'yank', 420);
          pl.pullY += (dy / dd) * P(e, 'yank', 420);
        }
      }
      if (e.t <= 0) {
        e.state = 0;
        e.n1 = g.rng.range(2.6, 3.6);
        e.n2 = -1;
      }
      break;
    }
  }
}

// ---------------------------------------------------------------- Arcade Automaton
/** Clockwork steps and halts at a distance; its crank ratchets round, then it spits a fan of tokens. */
export function automaton(g: Game, e: Enemy, dt: number): void {
  const { ux, uy, d } = toward(g, e);
  const keep = P(e, 'keep', 320);
  e.dirX = ux;
  e.dirY = uy;
  if (e.state === 0) {
    e.n2 += dt;
    if (e.n2 % 0.9 < 0.6) {
      const away = d < keep * 0.75 ? -1 : d > keep * 1.2 ? 1 : 0;
      const side = away ? 0 : 0.5;
      moveDir(g, e, ux * away - uy * side, uy * away + ux * side, e.speed, dt);
    } else e.vx = e.vy = 0;
    if (e.n1 === 0) {
      e.t = P(e, 'fire', 4) * (0.3 + 0.7 * g.rng.next());
      e.n1 = 1;
    }
    e.t -= dt;
    if (e.t <= 0 && d < keep * 1.8) {
      e.state = 1;
      e.t2 = P(e, 'windup', 0.9);
      sfx(g, 'crank', e.x, e.y, 0.35);
    }
    return;
  }
  e.vx = e.vy = 0;
  e.face = ux > 0 ? 1 : -1;
  e.t2 -= dt;
  e.windup = 1 - e.t2 / P(e, 'windup', 0.9);
  if (e.t2 > 0) return;
  const n = Math.round(P(e, 'coins', 5)) + (e.elite ? 2 : 0), spread = P(e, 'spread', 0.9);
  const sp = P(e, 'projSpeed', 240), dmg = P(e, 'projDmg', 7) * g.diff.dmgMult;
  const a0 = Math.atan2(uy, ux);
  for (let i = 0; i < n; i++) {
    const a = a0 + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
    g.spawnBullet('coin', e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, dmg, { r: 7, life: P(e, 'projLife', 3), spin: 14 });
  }
  sfx(g, 'coins', e.x, e.y, 0.35);
  e.state = 0;
  e.windup = 0;
  e.t = P(e, 'fire', 4);
}

// ---------------------------------------------------------------- Coaster Wraith
/**
 * Drifts toward you (0); a bent rail of light lays itself down — out to a bend beside you, then straight
 * through where you stood and on past (1); it rides the first leg to the bend (2) and the second (3), then
 * sags a moment (4). The bend is (tx, ty); the second leg's heading is dirX/dirY and its length n2.
 */
export function wraith(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  const { ux, uy, d } = toward(g, e);
  const charge = P(e, 'charge', 620) * (e.elite ? 1.15 : 1);
  switch (e.state) {
    case 0:
      e.noSep = false;
      moveDir(g, e, ux, uy, e.speed, dt);
      e.n1 -= dt;
      if (d < P(e, 'range', 520) && d > 140 && e.n1 <= 0 && e.spawnT > 1) {
        const side = g.rng.chance(0.5) ? 1 : -1, kink = P(e, 'kink', 170), over = P(e, 'over', 260);
        e.tx = e.x + ux * d * 0.55 - uy * kink * side;
        e.ty = e.y + uy * d * 0.55 + ux * kink * side;
        const vx = p.x - e.tx, vy = p.y - e.ty, vl = Math.hypot(vx, vy) || 1;
        e.dirX = vx / vl;
        e.dirY = vy / vl;
        e.n2 = vl + over;
        const tele = P(e, 'tele', 1);
        g.spawnHazard('line', 'coaster_rail', e.x, e.y, { x2: e.tx, y2: e.ty, r2: 22, tele, active: 0.01, dmg: 0, owner: e.uid });
        g.spawnHazard('line', 'coaster_rail', e.tx, e.ty, { x2: e.tx + e.dirX * e.n2, y2: e.ty + e.dirY * e.n2, r2: 22, tele, active: 0.01, dmg: 0, owner: e.uid });
        e.state = 1;
        e.t = tele;
        sfx(g, 'railwarn', e.x, e.y, 0.4);
      }
      break;
    case 1:
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'tele', 1);
      if (e.t <= 0) {
        e.state = 2;
        e.noSep = true;
        e.windup = 0;
        sfx(g, 'scream', e.x, e.y, 0.5);
      }
      break;
    case 2: {
      const dx = e.tx - e.x, dy = e.ty - e.y, l = Math.hypot(dx, dy);
      if (l <= charge * dt) {
        e.x = e.tx;
        e.y = e.ty;
        e.state = 3;
        e.t = e.n2 / charge;
      } else moveDir(g, e, dx, dy, charge, dt);
      break;
    }
    case 3:
      moveDir(g, e, e.dirX, e.dirY, charge, dt);
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 4;
        e.t = P(e, 'recover', 0.8);
        e.noSep = false;
      }
      break;
    case 4:
      e.vx = e.vy = 0;
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 0;
        e.n1 = g.rng.range(2.5, 4);
      }
      break;
  }
}

// ---------------------------------------------------------------- Barnacle Brute / the Great Barnacle
/**
 * Plods after you, faster once its crust has cracked (Game.damageEnemy cracks it); raises both arms while
 * a ring marks the slam. The Great Barnacle's slam also throws a ring of seawater outward, with a gap.
 */
export function barnacle(g: Game, e: Enemy, dt: number): void {
  const { ux, uy, d } = toward(g, e);
  const haste = e.cracked ? e.def.shell?.haste ?? 1 : 1;
  const R = P(e, 'slamR', 110);
  switch (e.state) {
    case 0:
      moveDir(g, e, ux, uy, e.speed * haste, dt);
      e.t -= dt;
      if (e.t <= 0 && d < P(e, 'range', 150) + e.r && e.spawnT > 1) {
        e.state = 1;
        e.t2 = P(e, 'slamTele', 0.9);
        g.spawnHazard('circle', 'barnacle_slam', e.x, e.y, { r: R, tele: e.t2, active: 0.15, dmg: P(e, 'slamDmg', 16) * g.diff.dmgMult, owner: e.uid });
        sfx(g, 'grunt', e.x, e.y, 0.4);
      }
      break;
    case 1:
      e.vx = e.vy = 0;
      e.t2 -= dt;
      e.windup = 1 - e.t2 / P(e, 'slamTele', 0.9);
      if (e.t2 <= 0) {
        e.state = 2;
        e.t2 = 0.5;
        e.windup = 0;
        g.fx.push('ring', e.x, e.y, R, 0, 0, 'pound');
        g.fx.push('shake', e.x, e.y, 0.3);
        sfx(g, 'slam', e.x, e.y, 0.55);
        if (P(e, 'ring', 0) > 0) {
          // a ring of seawater rolls outward from the slam: find the gap
          g.spawnHazard('ring', 'tide_ring', e.x, e.y, { r: R + 20, r2: R - 4, grow: 220, tele: 0.01, active: 1.1, dmg: 12 * g.diff.dmgMult, gapHalf: 0.55, angle: g.rng.angle(), owner: e.uid });
          sfx(g, 'splash', e.x, e.y, 0.6);
        }
      }
      break;
    case 2:
      e.vx = e.vy = 0;
      e.t2 -= dt;
      if (e.t2 <= 0) {
        e.state = 0;
        e.t = P(e, 'slamEvery', 4.2) / haste;
      }
      break;
  }
}

/** The crust gives way: the brute is soft, angry and faster from here on. */
export function crackShell(g: Game, e: Enemy): void {
  e.cracked = true;
  e.shellLeft = 0;
  g.fx.push('death', e.x, e.y, e.scale * 0.8, 0, 0, 'shell');
  g.fx.push('text', e.x, e.y - e.r * 2 - 20, 0, 0, 0, 'gold', 'CRACKED');
  sfx(g, 'crack', e.x, e.y, 0.7);
}

// ---------------------------------------------------------------- Lantern Angler
/**
 * Stalks (0); holds still while its lantern brightens and draws nearby players in (1, a pull with no
 * damage); a wedge marks the bite (2); it lunges along it (3), then stalks again after a cool-down.
 */
export function angler(g: Game, e: Enemy, dt: number): void {
  const { ux, uy, d } = toward(g, e);
  switch (e.state) {
    case 0:
      moveDir(g, e, ux, uy, e.speed, dt);
      e.n1 -= dt;
      if (d < P(e, 'pullR', 340) * 0.85 && e.n1 <= 0 && e.spawnT > 1) {
        e.state = 1;
        e.t = P(e, 'lure', 1.6);
        g.spawnHazard('circle', 'lure', e.x, e.y, { r: 30, tele: 0.01, active: e.t, dmg: 0, pull: P(e, 'pull', 130), pullR: P(e, 'pullR', 340), owner: e.uid });
        sfx(g, 'lure', e.x, e.y, 0.45);
      }
      break;
    case 1:
      e.vx = e.vy = 0;
      e.face = ux > 0 ? 1 : -1;
      e.dirX = ux;
      e.dirY = uy;
      e.t -= dt;
      // the lantern brightening reads on the model (the renderer keys off state 1), not as a red rim
      if (e.t <= 0 || d < P(e, 'biteR', 150) * 0.8) {
        e.state = 2;
        e.t = P(e, 'biteTele', 0.45);
        g.clearHazardsOf(e.uid);
        g.spawnHazard('sector', 'angler_bite', e.x, e.y, { r: P(e, 'biteR', 150), angle: Math.atan2(uy, ux), half: 0.55, tele: e.t, active: 0.12, dmg: P(e, 'biteDmg', 22) * g.diff.dmgMult, owner: e.uid });
      }
      break;
    case 2:
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'biteTele', 0.45);
      if (e.t <= 0) {
        e.state = 3;
        e.t = 0.18;
        sfx(g, 'bite', e.x, e.y, 0.55);
      }
      break;
    case 3:
      moveDir(g, e, e.dirX, e.dirY, P(e, 'lunge', 520), dt);
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 0;
        e.windup = 0;
        e.n1 = P(e, 'cool', 3);
      }
      break;
  }
}

// ---------------------------------------------------------------- Prize Collector
/**
 * Goes after the nearest ticket on the boards that nobody is already pulling in, and swallows every one in
 * reach, swelling as it does (its scale and radius replicate); turns on a player who comes close, with a
 * telegraphed grab. When it falls it pays everything back, with interest (`payBack`).
 */
export function collector(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  const { ux, uy, d } = toward(g, e);
  e.n2 -= dt;
  if (e.n2 <= 0) {
    e.n2 = 0.4;
    e.tx = NaN;
    let best = P(e, 'sniff', 520) ** 2;
    for (const pk of g.pickups) {
      if (!pk.alive || pk.kind !== 'ticket' || pk.magnet) continue;
      const dd = dist2(pk.x, pk.y, e.x, e.y);
      if (dd < best) {
        best = dd;
        e.tx = pk.x;
        e.ty = pk.y;
      }
    }
  }
  if (e.state === 1) {
    e.vx = e.vy = 0;
    e.t2 -= dt;
    e.windup = 1 - e.t2 / P(e, 'grabTele', 0.6);
    if (e.t2 <= 0) {
      e.state = 0;
      e.windup = 0;
      e.t = 2.2;
    }
    return;
  }
  const hunting = !Number.isNaN(e.tx) && d > 170;
  moveDir(g, e, hunting ? e.tx - e.x : p.x - e.x, hunting ? e.ty - e.y : p.y - e.y, e.speed * (hunting ? 1.25 : 1), dt);
  const reach = e.r + 26;
  let ate = 0;
  for (const pk of g.pickups) {
    if (!pk.alive || pk.kind !== 'ticket' || pk.magnet || dist2(pk.x, pk.y, e.x, e.y) > reach * reach) continue;
    pk.alive = false;
    g.gemsOnGround--;
    e.loot += pk.value;
    ate++;
  }
  if (ate) {
    const grow = 1 + Math.min(0.5, e.loot / 500);
    e.scale = grow;
    e.r = e.def.radius * grow;
    if (g.rng.chance(0.35)) sfx(g, 'coins', e.x, e.y, 0.3);
  }
  e.t -= dt;
  if (d < P(e, 'grabR', 130) * e.scale && e.t <= 0 && e.spawnT > 1) {
    e.state = 1;
    e.t2 = P(e, 'grabTele', 0.6);
    g.spawnHazard('sector', 'collector_grab', e.x, e.y, { r: P(e, 'grabR', 130) * e.scale, angle: Math.atan2(uy, ux), half: 0.75, tele: e.t2, active: 0.12, dmg: P(e, 'grabDmg', 14) * g.diff.dmgMult, owner: e.uid });
  }
}

/** A fallen Prize Collector bursts: everything it swallowed comes back, `payback` times over. */
export function payBack(g: Game, e: Enemy): void {
  const total = Math.round(e.loot * P(e, 'payback', 1.5));
  if (total <= 0) return;
  const n = Math.min(12, Math.max(3, Math.round(total / 15)));
  const each = Math.max(1, Math.round(total / n));
  for (let i = 0; i < n; i++) {
    if (g.gemsOnGround >= g.maxGems) {
      if (!g.bankPickup || !g.bankPickup.alive) g.bankPickup = g.spawnPickup('bank', e.x, e.y, 0);
      g.bankPickup.value += each;
      continue;
    }
    const pk = g.spawnPickup('ticket', e.x, e.y, each);
    const a = (i / n) * TAU + g.rng.range(-0.3, 0.3), sp = g.rng.range(220, 380);
    pk.vx = Math.cos(a) * sp;
    pk.vy = Math.sin(a) * sp;
  }
  g.fx.push('chest', e.x, e.y);
  sfx(g, 'coin_shower', e.x, e.y, 0.8);
  e.loot = 0;
}

// ---------------------------------------------------------------- Tidecaller
/**
 * Hangs back at the edge of the light (0). Rings its bell (1): the drowned claw up out of the ground
 * around the player it was ringing for. Lifts its staff (2): a line of seawater rolls out from it across
 * the boards toward that player. Cooldowns are `t` (bell) and `t2` (surge); `n2` times each wind-up.
 */
export function tidecaller(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  const { ux, uy, d } = toward(g, e);
  const keep = P(e, 'keep', 440);
  e.dirX = ux;
  e.dirY = uy;
  if (e.state === 0) {
    const s = d < keep * 0.8 ? -1 : d > keep * 1.2 ? 1 : 0;
    if (s) moveDir(g, e, ux * s, uy * s, e.speed, dt);
    else {
      e.vx = e.vy = 0;
      e.face = ux > 0 ? 1 : -1;
    }
    if (e.n1 === 0) {
      e.n1 = 1;
      e.t = P(e, 'call', 7) * (0.35 + 0.4 * g.rng.next());
      e.t2 = P(e, 'surge', 9) * (0.55 + 0.4 * g.rng.next());
    }
    e.t -= dt;
    e.t2 -= dt;
    if (e.t <= 0) {
      e.state = 1;
      e.n2 = P(e, 'callTele', 1.2);
      sfx(g, 'toll', e.x, e.y, 0.5);
    } else if (e.t2 <= 0 && d < keep * 1.6) {
      e.state = 2;
      e.n2 = P(e, 'surgeTele', 0.8);
      const L = P(e, 'surgeLen', 380), sp = P(e, 'surgeSpeed', 270);
      const nx = -uy, ny = ux, sx = e.x + ux * 30, sy = e.y + uy * 30;
      const h = g.spawnHazard('line', 'surge', sx - nx * L * 0.5, sy - ny * L * 0.5, {
        x2: sx + nx * L * 0.5, y2: sy + ny * L * 0.5, r2: 26, tele: e.n2, active: (d + 220) / sp, dmg: P(e, 'surgeDmg', 10) * g.diff.dmgMult, slow: 0.35, owner: e.uid,
      });
      h.onActivate = () => {
        h.vx = ux * sp;
        h.vy = uy * sp;
        sfx(g, 'surge', h.x, h.y, 0.55);
      };
    }
    return;
  }
  e.vx = e.vy = 0;
  e.n2 -= dt;
  const tele = e.state === 1 ? P(e, 'callTele', 1.2) : P(e, 'surgeTele', 0.8);
  e.windup = 1 - e.n2 / tele;
  if (e.n2 > 0) return;
  if (e.state === 1) {
    const n = Math.round(P(e, 'raise', 3)) + (e.elite ? 2 : 0);
    const a0 = g.rng.angle();
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU, r = g.rng.range(200, 290);
      g.spawnEnemy('drowned', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, { exact: true });
    }
    e.t = P(e, 'call', 7);
  } else e.t2 = P(e, 'surge', 9);
  e.state = 0;
  e.windup = 0;
}

// ---------------------------------------------------------------- the Barker's tin ducks
/** March straight along their lane (dirX/dirY), and fold away when their time is up. */
export function duckline(g: Game, e: Enemy, dt: number): void {
  // a gallery duck (Summer's End) runs back and forth along the gallery's wall between tx and ty
  if (e.n1 === 1) {
    if (e.x < e.tx) e.dirX = 1;
    else if (e.x > e.ty) e.dirX = -1;
  }
  const sp = e.speed * g.slowFactor(e);
  e.vx = e.dirX * sp;
  e.vy = e.dirY * sp;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.face = e.dirX >= 0 ? 1 : -1;
  e.noSep = true;
  if (e.n1 !== 1 && e.spawnT > P(e, 'life', 9)) g.despawnEnemy(e);
}
