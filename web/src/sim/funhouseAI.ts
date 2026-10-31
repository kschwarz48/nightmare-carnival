// The Fun House's enemies (D-63): one behaviour per new archetype. Like the Carnival Core's, every
// attack has a readable wind-up (`e.windup` drives the renderer's telegraph pose); `g.player` is the
// nearest standing player (the game sets it before each enemy's update).

import { dist2 } from '../core/math';
import { PANEL } from '../data/funhouse';
import { PROPS } from '../data/map';
import type { Enemy } from './entities';
import type { Game } from './game';

const P = (e: Enemy, k: string, d: number): number => {
  const v = e.def.params[k];
  return typeof v === 'number' ? v : d;
};

function moveDir(g: Game, e: Enemy, dx: number, dy: number, speed: number, dt: number): void {
  const l = Math.hypot(dx, dy) || 1;
  const sp = speed * g.slowFactor(e);
  e.vx = (dx / l) * sp;
  e.vy = (dy / l) * sp;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (Math.abs(e.vx) > 4) e.face = e.vx > 0 ? 1 : -1;
}

// ---------------------------------------------------------------- Grinning Mannequin
/** Frozen while any standing player within `watch` faces it (cosine >= `cone`); otherwise it sprints. */
export function mannequin(g: Game, e: Enemy, dt: number): void {
  const watch = P(e, 'watch', 520), cone = P(e, 'cone', 0.62);
  let seen = e.spawnT < 0.6; // it holds its pose a moment when it appears
  for (const p of g.players) {
    if (!g.isUp(p)) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d > watch || d < 1) continue;
    if ((dx * p.faceX + dy * p.faceY) / d >= cone) {
      seen = true;
      break;
    }
  }
  if (seen) {
    e.vx = e.vy = 0;
    e.state = 1;
    e.windup = 0;
    return;
  }
  if (e.state === 1 && e.t2 <= 0) {
    // the creak of porcelain joints as it starts to move
    g.bus.emit('sfx', { id: 'creak', x: e.x, y: e.y, vol: 0.35 });
    e.t2 = 1.5;
  }
  e.t2 -= dt;
  e.state = 0;
  const p = g.player;
  moveDir(g, e, p.x - e.x, p.y - e.y, e.speed, dt);
}

// ---------------------------------------------------------------- Doppelganger
/** Walks its player's own footsteps `delay` seconds behind; gleams, then lunges when close. */
export function doppel(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  const delay = P(e, 'delay', 1.2);
  const n = Math.round(delay / 0.1);
  // breadcrumbs: the player's position every 0.1 s, in a ring buffer
  if (!e.trail || e.trail.length !== n * 2) {
    e.trail = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      e.trail[i * 2] = e.x;
      e.trail[i * 2 + 1] = e.y;
    }
    e.trailHead = 0;
  }
  e.n2 += dt;
  if (e.n2 >= 0.1) {
    e.n2 = 0;
    e.trail[e.trailHead * 2] = p.x;
    e.trail[e.trailHead * 2 + 1] = p.y;
    e.trailHead = (e.trailHead + 1) % n;
  }
  const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
  switch (e.state) {
    case 0: {
      // the oldest crumb is where the player stood `delay` seconds ago
      const tx = e.trail[e.trailHead * 2], ty = e.trail[e.trailHead * 2 + 1];
      const far = dist2(e.x, e.y, tx, ty) < 20 * 20 ? 0.35 : 1;
      moveDir(g, e, tx - e.x, ty - e.y, e.speed * far, dt);
      e.n1 -= dt;
      if (d < P(e, 'lungeRange', 150) && e.n1 <= 0) {
        e.state = 1;
        e.t = P(e, 'windup', 0.4);
        e.dirX = (p.x - e.x) / (d || 1);
        e.dirY = (p.y - e.y) / (d || 1);
        g.bus.emit('sfx', { id: 'glint', x: e.x, y: e.y, vol: 0.4 });
      }
      break;
    }
    case 1:
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'windup', 0.4);
      if (e.t <= 0) {
        e.state = 2;
        e.t = 0.28;
      }
      break;
    case 2:
      moveDir(g, e, e.dirX, e.dirY, P(e, 'lunge', 520), dt);
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 0;
        e.windup = 0;
        e.n1 = 2.2;
      }
      break;
  }
}

// ---------------------------------------------------------------- Glasswalker
/** Where a Glasswalker steps out: the face of a mirror panel near the player, or a floor reflection. */
function emergeSpot(g: Game, x: number, y: number): { x: number; y: number } {
  let best: { x: number; y: number } | null = null, bd = Infinity;
  for (const pr of PROPS) {
    if (pr.kind !== 'fh_mirror' || pr.yaw) continue; // south-facing glass only
    const fx = pr.x + g.rng.range(-50, 50), fy = pr.y + PANEL + 30;
    const d = dist2(fx, fy, x, y);
    if (d < 170 * 170 || d > 560 * 560) continue;
    if (d < bd) {
      bd = d;
      best = { x: fx, y: fy };
    }
  }
  if (best) return best;
  const a = g.rng.angle(), r = g.rng.range(170, 250);
  return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
}

/**
 * Lives behind the glass: hidden (state 0), the glass ripples where it will step out (1), it closes in
 * (2), winds up a slash (3), and shatters back into the glass (4).
 */
export function glasswalker(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  switch (e.state) {
    case 0:
      e.hidden = true;
      e.noContact = true;
      e.vx = e.vy = 0;
      e.t -= dt;
      if (e.t <= 0) {
        const at = emergeSpot(g, p.x, p.y);
        e.x = e.px = at.x;
        e.y = e.py = at.y;
        e.state = 1;
        e.t = P(e, 'emerge', 0.9);
        g.bus.emit('sfx', { id: 'ripple', x: at.x, y: at.y, vol: 0.5 });
      }
      break;
    case 1:
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'emerge', 0.9);
      if (e.t <= 0) {
        e.hidden = false;
        e.noContact = false;
        e.state = 2;
        e.t2 = 0;
        e.windup = 0;
        g.fx.push('spark', e.x, e.y, 10, 0, 0, 'mirror');
      }
      break;
    case 2: {
      moveDir(g, e, p.x - e.x, p.y - e.y, e.speed, dt);
      e.t2 += dt;
      e.n1 -= dt;
      const R = P(e, 'slashR', 95);
      if (dist2(e.x, e.y, p.x, p.y) < (R * 0.9) ** 2 && e.n1 <= 0) {
        e.state = 3;
        e.t = 0.5;
        g.spawnHazard('circle', 'glass_slash', e.x, e.y, { r: R, tele: 0.5, active: 0.12, dmg: P(e, 'slash', 34) * g.diff.dmgMult, owner: e.uid });
      } else if (e.t2 > P(e, 'hop', 3.2)) {
        e.state = 4;
        e.t = 0.45;
      }
      break;
    }
    case 3:
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = Math.min(1, 1 - e.t / 0.5);
      if (e.t <= 0) {
        e.state = 2;
        e.windup = 0;
        e.n1 = 1.6;
      }
      break;
    case 4:
      e.vx = e.vy = 0;
      e.t -= dt;
      if (e.t <= 0) {
        g.fx.push('spark', e.x, e.y, 8, 0, 0, 'mirror');
        e.state = 0;
        e.t = g.rng.range(0.8, 1.6);
      }
      break;
  }
}

// ---------------------------------------------------------------- Marionette
/**
 * Yanked toward the player in jerky leaps (state 1, airborne) with a thump where it lands. The spot the
 * strings will drop it is marked on the floor for the whole leap (D-64): the thump is telegraphed.
 */
export function marionette(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  if (e.state === 0) {
    e.vx = e.vy = 0;
    e.noContact = false;
    e.t -= dt;
    if (e.t <= 0) {
      const a = Math.atan2(p.y - e.y, p.x - e.x) + g.rng.range(-0.9, 0.9);
      const L = g.rng.range(130, 210) * (e.elite ? 1.2 : 1);
      e.tx = e.x + Math.cos(a) * L;
      e.ty = e.y + Math.sin(a) * L;
      e.state = 1;
      e.t = P(e, 'leap', 0.55);
      e.n1 = L / e.t;
      e.dirX = Math.cos(a);
      e.dirY = Math.sin(a);
      if (!e.illusion) g.spawnHazard('circle', 'marionette_land', e.tx, e.ty, { r: P(e, 'land', 50), tele: e.t, active: 0.12, dmg: P(e, 'landDmg', 5) * g.diff.dmgMult, owner: e.uid });
    }
    return;
  }
  e.noContact = true;
  moveDir(g, e, e.dirX, e.dirY, e.n1, dt);
  e.t -= dt;
  if (e.t <= 0) {
    e.state = 0;
    e.t = P(e, 'rest', 0.5) + g.rng.range(0, 0.3);
    e.noContact = false;
    g.fx.push('dust', e.x, e.y, 0.5);
  }
}

// ---------------------------------------------------------------- Splitter
/** A wobbling, bulging chase; it splits on death (see Game.killEnemy). */
export function splitter(g: Game, e: Enemy, dt: number): void {
  e.n1 += dt * 3;
  const p = g.player;
  const wob = Math.sin(e.n1 * 0.7 + e.idx) * 0.35;
  const dx = p.x - e.x, dy = p.y - e.y;
  const c = Math.cos(wob), s = Math.sin(wob);
  moveDir(g, e, dx * c - dy * s, dx * s + dy * c, e.speed * (0.85 + 0.25 * Math.sin(e.n1 + e.idx)), dt);
}

// ---------------------------------------------------------------- Crooked Clown
/** Keeps its distance with a sideways skitter; winds back and throws two bent pins that curve inward. */
export function crooked(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  const keep = P(e, 'keep', 360);
  const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y)) || 1;
  const dx = (p.x - e.x) / d, dy = (p.y - e.y) / d;
  // sidestep: flip direction every so often
  e.n2 -= dt;
  if (e.n2 <= 0) {
    e.n2 = g.rng.range(0.6, 1.4) / P(e, 'side', 1.2);
    e.dirX = g.rng.chance(0.5) ? 1 : -1;
  }
  const away = d < keep * 0.8 ? -1 : d > keep * 1.15 ? 1 : 0;
  const side = e.state === 1 ? 0 : 0.8 * e.dirX;
  moveDir(g, e, dx * away + -dy * side, dy * away + dx * side, e.speed * (away || side ? 1 : 0), dt);
  if (away === 0 && side === 0) {
    e.vx = e.vy = 0;
    e.face = dx > 0 ? 1 : -1;
  }
  if (e.state === 0) {
    e.t -= dt;
    if (e.n1 === 0) {
      e.t = P(e, 'fire', 2.1) * g.rng.next();
      e.n1 = 1;
    }
    if (e.t <= 0 && d < keep * 1.7) {
      e.state = 1;
      e.t2 = P(e, 'windup', 0.5);
    }
    return;
  }
  e.t2 -= dt;
  e.windup = 1 - e.t2 / P(e, 'windup', 0.5);
  if (e.t2 > 0) return;
  const sp = P(e, 'projSpeed', 250), curve = P(e, 'curve', 1.6);
  const dmg = P(e, 'projDmg', 10) * g.diff.dmgMult;
  const a0 = Math.atan2(dy, dx);
  for (const side of e.elite ? [-1, 1, -0.5, 0.5] : [-1, 1]) {
    // thrown wide, bending back toward where you stand
    const a = a0 - side * 0.55;
    g.spawnBullet('pin', e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, dmg, { r: 8, life: P(e, 'projLife', 3.6), turn: side * curve, spin: 9 });
  }
  g.bus.emit('sfx', { id: 'whoosh', x: e.x, y: e.y, vol: 0.35 });
  e.state = 0;
  e.windup = 0;
  e.t = P(e, 'fire', 2.1);
}

// ---------------------------------------------------------------- Reflection Thief
const DECOYS = ['evil_clown', 'grinning_mannequin', 'doppelganger', 'splitter_mid'];
/** Keeps away, blinks when cornered, and conjures harmless shimmering decoys of the crowd. */
export function thief(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y)) || 1;
  const dx = (p.x - e.x) / d, dy = (p.y - e.y) / d;
  const s = d < 300 ? -1 : d > 460 ? 1 : 0;
  if (e.state === 0) moveDir(g, e, dx * s, dy * s, e.speed * Math.abs(s), dt);
  else e.vx = e.vy = 0;
  // cornered: it steps into its hand mirror and out somewhere else
  e.n2 -= dt;
  if (d < 170 && e.n2 <= 0) {
    const a = Math.atan2(-dy, -dx) + g.rng.range(-1, 1);
    g.fx.push('spark', e.x, e.y, 12, 0, 0, 'mirror');
    e.x = e.px = e.x + Math.cos(a) * P(e, 'blink', 260);
    e.y = e.py = e.y + Math.sin(a) * P(e, 'blink', 260);
    g.fx.push('spark', e.x, e.y, 12, 0, 0, 'mirror');
    g.bus.emit('sfx', { id: 'glint', x: e.x, y: e.y, vol: 0.5 });
    e.n2 = P(e, 'blinkCd', 3);
  }
  if (e.state === 0) {
    e.t -= dt;
    if (e.n1 === 0) {
      e.t = 1 + g.rng.next() * 2;
      e.n1 = 1;
    }
    if (e.t <= 0) {
      e.state = 1;
      e.t2 = 0.7;
    }
    return;
  }
  e.t2 -= dt;
  e.windup = 1 - e.t2 / 0.7;
  if (e.t2 > 0) return;
  const n = Math.round(P(e, 'decoys', 4)) + (e.elite ? 2 : 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + g.rng.next();
    const c = g.spawnEnemy(DECOYS[g.rng.int(0, DECOYS.length - 1)], e.x + Math.cos(a) * 120, e.y + Math.sin(a) * 120);
    if (!c) break;
    c.illusion = true;
    c.illusionOf = e.uid;
    c.noContact = true;
    c.hp = c.maxHp = 1;
    c.tickets = 0;
  }
  g.bus.emit('sfx', { id: 'mirror', x: e.x, y: e.y, vol: 0.5 });
  e.state = 0;
  e.windup = 0;
  e.t = P(e, 'cast', 5);
}

/** A Reflection Thief's death dispels every decoy it made. */
export function dispelDecoys(g: Game, owner: number): void {
  for (const o of g.active) if (o.alive && o.illusion && o.illusionOf === owner) g.despawnEnemy(o);
}
