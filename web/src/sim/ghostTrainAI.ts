// The Ghost Train's creatures (D-80): one behaviour each, none borrowed from another map. As everywhere, every
// attack has a readable wind-up (`e.windup` drives the renderer's telegraph pose, hazards draw the spot) and
// `g.player` is the nearest standing player (the game sets it before each creature's update). The train's two
// boarding ends are handled by the journey spawner (sim/ghosttrain.ts); these only decide how each moves.

import { dist2 } from '../core/math';
import { REGIONS, TRANSIT, TRAIN, regionAt, trainOrigin, walkRect } from '../data/ghosttrain';
import type { Enemy } from './entities';
import type { Game } from './game';

const P = (e: Enemy, k: string, d: number): number => {
  const v = e.def.params[k];
  return typeof v === 'number' ? v : d;
};
const sfx = (g: Game, id: string, x: number, y: number, vol = 0.4) => g.bus.emit('sfx', { id, x, y, vol });

function moveDir(g: Game, e: Enemy, dx: number, dy: number, speed: number, dt: number): void {
  const l = Math.hypot(dx, dy);
  if (l < 1e-4) {
    e.vx = e.vy = 0;
    return;
  }
  const sp = speed * g.slowFactor(e);
  e.vx = (dx / l) * sp;
  e.vy = (dy / l) * sp;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (Math.abs(e.vx) > 4) e.face = e.vx > 0 ? 1 : -1;
}
function toward(g: Game, e: Enemy): { ux: number; uy: number; d: number } {
  const p = g.player;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
  return { ux: dx / d, uy: dy / d, d };
}
/** Hold a distance `keep` from the player with a sideways drift that flips now and then. */
function keepAway(g: Game, e: Enemy, dt: number, keep: number, side = 0.6, speedK = 1): void {
  const { ux, uy, d } = toward(g, e);
  e.t2 -= dt;
  if (e.t2 <= 0) {
    e.t2 = g.rng.range(0.8, 1.6);
    e.tx = g.rng.chance(0.5) ? 1 : -1;
  }
  const away = d < keep * 0.8 ? -1 : d > keep * 1.2 ? 1 : 0;
  const s = side * (e.tx || 1);
  moveDir(g, e, ux * away - uy * s, uy * away + ux * s, e.speed * (away ? 1 : 0.55) * speedK, dt);
}
/** A point on a station's ground (or inside the moving train) near (x, y). */
function onGround(x: number, y: number, rFrom: number): { x: number; y: number } {
  const r = rFrom >= 0 ? rFrom : Math.max(0, regionAt(x, y));
  const w = walkRect(r);
  if (r === TRANSIT) {
    const o = trainOrigin(TRANSIT);
    return { x: Math.max(w.minX + 20, Math.min(w.maxX - 20, x)), y: o.y + Math.max(-TRAIN.gangHalf + 8, Math.min(TRAIN.gangHalf - 8, y - o.y)) };
  }
  const minY = REGIONS[r].cy - 1000 + TRAIN.halfW + 40;
  return { x: Math.max(w.minX + 30, Math.min(w.maxX - 30, x)), y: Math.max(minY, Math.min(w.maxY - 30, y)) };
}

// ---------------------------------------------------------------- The Ticketless
/** Shuffles after you, each one weaving a little on its own beat. */
export function ticketless(g: Game, e: Enemy, dt: number): void {
  const { ux, uy } = toward(g, e);
  const wob = Math.sin(e.animT * 1.3 + e.idx * 1.7) * P(e, 'drift', 0.35);
  const c = Math.cos(wob), s = Math.sin(wob);
  moveDir(g, e, ux * c - uy * s, uy * c + ux * s, e.speed, dt);
}

// ---------------------------------------------------------------- The Navvy (D-84)
/** The crowd's meat: no wind-up, no trick, straight at you, and a little faster from further off. */
export function navvy(g: Game, e: Enemy, dt: number): void {
  const { ux, uy, d } = toward(g, e);
  moveDir(g, e, ux, uy, e.speed * (d > 700 ? 1.35 : 1), dt);
}

// ---------------------------------------------------------------- Coalborn
/** Rests a moment (0), then darts (1) at you, a little off line each time. */
export function coalborn(g: Game, e: Enemy, dt: number): void {
  e.t -= dt;
  if (e.state === 0) {
    e.vx *= 0.8;
    e.vy *= 0.8;
    e.windup = Math.max(0, 1 - e.t / P(e, 'rest', 0.35));
    if (e.t <= 0) {
      const { ux, uy } = toward(g, e);
      const a = Math.atan2(uy, ux) + g.rng.range(-0.55, 0.55);
      e.dirX = Math.cos(a);
      e.dirY = Math.sin(a);
      e.state = 1;
      e.t = P(e, 'dart', 0.45) * g.rng.range(0.8, 1.2);
      e.windup = 0;
    }
    return;
  }
  moveDir(g, e, e.dirX, e.dirY, e.speed * 1.3 * (e.elite ? 1.15 : 1), dt);
  if (e.t <= 0) {
    e.state = 0;
    e.t = P(e, 'rest', 0.35) * g.rng.range(0.7, 1.3);
  }
}

// ---------------------------------------------------------------- The Porter
/** Advances behind his trunk (the trunk soaks hits from the front: `porterShield`); bashes when close. */
export function porter(g: Game, e: Enemy, dt: number): void {
  const { ux, uy, d } = toward(g, e);
  e.n1 -= dt;
  if (e.state === 0) {
    e.dirX = ux;
    e.dirY = uy;
    moveDir(g, e, ux, uy, e.speed, dt);
    if (d < P(e, 'reach', 80) + e.r && e.n1 <= 0) {
      e.state = 1;
      e.t = P(e, 'windup', 0.6);
      g.spawnHazard('sector', 'porter_bash', e.x, e.y, { r: P(e, 'reach', 80) + 30, angle: Math.atan2(uy, ux), half: 0.65, tele: e.t, active: 0.15, dmg: P(e, 'bashDmg', 10) * g.diff.dmgMult, pull: -P(e, 'shove', 520), owner: e.uid });
      sfx(g, 'grunt', e.x, e.y, 0.4);
    }
    return;
  }
  e.vx = e.vy = 0;
  e.t -= dt;
  if (e.state === 1) {
    e.windup = 1 - e.t / P(e, 'windup', 0.6);
    if (e.t <= 0) {
      e.state = 2;
      e.t = 0.5;
      e.windup = 0;
      sfx(g, 'trunkslam', e.x, e.y, 0.5);
    }
  } else if (e.t <= 0) {
    e.state = 0;
    e.n1 = P(e, 'cool', 2.2);
  }
}
/** How much of a hit lands on a Porter: his trunk, held in front, soaks most of what comes from that side. */
export function porterShield(e: Enemy, srcX: number, srcY: number): number {
  const dx = srcX - e.x, dy = srcY - e.y, l = Math.hypot(dx, dy);
  if (l < 1) return 1;
  const dot = (dx * e.dirX + dy * e.dirY) / l;
  return dot > Math.cos(P(e, 'arc', 1.05)) ? P(e, 'shield', 0.4) : 1;
}

// ---------------------------------------------------------------- Railcrawler
/**
 * Goes along the walls (inside a carriage it keeps to the nearer wall; outside it skitters in a zig-zag) until
 * it's in range (0); freezes while a line marks its pounce (1); pounces along it (2); gathers itself (3).
 */
export function railcrawler(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  const { ux, uy, d } = toward(g, e);
  e.n1 -= dt;
  switch (e.state) {
    case 0: {
      if (regionAt(e.x, e.y) === TRANSIT) {
        const o = trainOrigin(TRANSIT), side = e.y >= o.y ? 1 : -1;
        const wy = o.y + side * (TRAIN.halfW - P(e, 'hug', 60) * 0.4);
        moveDir(g, e, p.x - e.x, (wy - e.y) * 3, e.speed, dt);
      } else {
        e.t2 -= dt;
        if (e.t2 <= 0) {
          e.t2 = g.rng.range(0.35, 0.7);
          e.tx = g.rng.chance(0.5) ? 1 : -1;
        }
        moveDir(g, e, ux * 0.6 - uy * 0.9 * (e.tx || 1), uy * 0.6 + ux * 0.9 * (e.tx || 1), e.speed, dt);
      }
      if (d < P(e, 'range', 300) && e.n1 <= 0 && e.spawnT > 0.8) {
        e.state = 1;
        e.t = P(e, 'tele', 0.55);
        e.dirX = ux;
        e.dirY = uy;
        const L = Math.min(d + 90, P(e, 'lunge', 640) * P(e, 'lungeT', 0.32));
        e.n2 = L;
        g.spawnHazard('line', 'rail_pounce', e.x, e.y, { x2: e.x + ux * L, y2: e.y + uy * L, r2: e.r + 4, tele: e.t, active: 0.01, dmg: 0, owner: e.uid });
        sfx(g, 'clatter', e.x, e.y, 0.4);
      }
      break;
    }
    case 1:
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'tele', 0.55);
      if (e.t <= 0) {
        e.state = 2;
        e.t = e.n2 / P(e, 'lunge', 640);
        e.noSep = true;
        e.windup = 0;
        sfx(g, 'whoosh', e.x, e.y, 0.4);
      }
      break;
    case 2:
      moveDir(g, e, e.dirX, e.dirY, P(e, 'lunge', 640) * (e.elite ? 1.1 : 1), dt);
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 3;
        e.t = 0.45;
        e.noSep = false;
      }
      break;
    case 3:
      e.vx = e.vy = 0;
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 0;
        e.n1 = P(e, 'cool', 2.4);
      }
      break;
  }
}

// ---------------------------------------------------------------- Mourning Passenger
/** Drifts after you and flickers forward (leaving an afterimage); now and then stops to wail a slowing cone. */
export function mourner(g: Game, e: Enemy, dt: number): void {
  const { ux, uy, d } = toward(g, e);
  e.n1 -= dt;
  e.n2 -= dt;
  if (e.state === 1) {
    e.vx = e.vy = 0;
    e.t -= dt;
    e.windup = 1 - e.t / P(e, 'wailTele', 0.8);
    if (e.t <= 0) {
      e.state = 0;
      e.windup = 0;
      e.n2 = P(e, 'cool', 4.5);
      sfx(g, 'wail', e.x, e.y, 0.45);
    }
    return;
  }
  moveDir(g, e, ux, uy, e.speed, dt);
  if (e.n1 <= 0 && d > 170 && e.spawnT > 1) {
    const step = Math.min(P(e, 'blink', 150), d - 110);
    g.fx.push('spark', e.x, e.y, 6, 0, 0, 'veil');
    const to = onGround(e.x + ux * step, e.y + uy * step, regionAt(e.x, e.y));
    e.x = e.px = to.x;
    e.y = e.py = to.y;
    e.n1 = P(e, 'blinkCd', 3.4) * g.rng.range(0.8, 1.2);
    sfx(g, 'ghostgasp', e.x, e.y, 0.3);
  }
  if (e.n2 <= 0 && d < P(e, 'wailR', 230) * 0.85 && e.spawnT > 1.5) {
    e.state = 1;
    e.t = P(e, 'wailTele', 0.8);
    g.spawnHazard('sector', 'mourn_wail', e.x, e.y, { r: P(e, 'wailR', 230), angle: Math.atan2(uy, ux), half: P(e, 'wailHalf', 0.5), tele: e.t, active: 0.25, dmg: P(e, 'wailDmg', 6) * g.diff.dmgMult, slow: P(e, 'slow', 0.45), owner: e.uid });
  }
}

// ---------------------------------------------------------------- The Signalman
/** Keeps his distance; raises the lantern: a lane lights from him to you (1), then a flare comes down it. */
export function signalman(g: Game, e: Enemy, dt: number): void {
  if (e.state === 0) {
    keepAway(g, e, dt, P(e, 'keep', 330));
    if (e.n1 === 0) {
      e.t = P(e, 'fire', 3.6) * g.rng.next();
      e.n1 = 1;
    }
    e.t -= dt;
    const { ux, uy, d } = toward(g, e);
    if (e.t <= 0 && d < P(e, 'keep', 330) * 1.9) {
      e.state = 1;
      e.n2 = P(e, 'tele', 0.85);
      e.dirX = ux;
      e.dirY = uy;
      const L = d + 360;
      g.spawnHazard('line', 'signal_lane', e.x, e.y, { x2: e.x + ux * L, y2: e.y + uy * L, r2: P(e, 'laneW', 18), tele: e.n2, active: 0.01, dmg: 0, owner: e.uid });
      sfx(g, 'lampraise', e.x, e.y, 0.35);
    }
    return;
  }
  e.vx = e.vy = 0;
  e.n2 -= dt;
  e.windup = 1 - e.n2 / P(e, 'tele', 0.85);
  if (e.n2 > 0) return;
  const sp = P(e, 'flareSpeed', 720);
  g.spawnBullet('hellfire', e.x + e.dirX * 14, e.y + e.dirY * 14, e.dirX * sp, e.dirY * sp, P(e, 'flareDmg', 11) * g.diff.dmgMult, { r: 9, life: 1.6 });
  sfx(g, 'flare', e.x, e.y, 0.45);
  e.state = 0;
  e.windup = 0;
  e.t = P(e, 'fire', 3.6);
}

// ---------------------------------------------------------------- Clockwork Commuter
/** Every commuter strides on the same beat of the night's clock and stands still between strides. */
export function commuter(g: Game, e: Enemy, dt: number): void {
  const beat = P(e, 'beat', 0.7), stride = P(e, 'stride', 0.38);
  const ph = (((g.time % beat) + beat) % beat) / beat;
  e.windup = ph > 0.86 ? (ph - 0.86) / 0.14 : 0; // the tick before the step (the wind-up pose)
  if (ph < stride / beat) {
    const { ux, uy } = toward(g, e);
    moveDir(g, e, ux, uy, e.speed * (e.elite ? 1.1 : 1), dt);
  } else e.vx = e.vy = 0;
}

// ---------------------------------------------------------------- Newsboy Specter
/** Runs rings round you and lobs a bundle of papers at where you'll be (the landing is marked). */
export function newsboy(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  const { ux, uy, d } = toward(g, e);
  const orbit = P(e, 'orbit', 280);
  const rad = d < orbit * 0.85 ? -0.7 : d > orbit * 1.15 ? 0.8 : 0;
  const side = e.idx % 2 ? 1 : -1;
  moveDir(g, e, ux * rad - uy * side, uy * rad + ux * side, e.speed, dt);
  e.t -= dt;
  if (e.n1 === 0) {
    e.n1 = 1;
    e.t = P(e, 'throwCd', 2.6) * g.rng.range(0.4, 1);
  }
  e.windup = e.t < 0.35 ? 1 - Math.max(0, e.t) / 0.35 : 0;
  if (e.t <= 0 && d < orbit * 1.8) {
    e.t = P(e, 'throwCd', 2.6) * g.rng.range(0.85, 1.15);
    const fl = P(e, 'flight', 0.9);
    const at = onGround(p.x + p.vx * fl * 0.5, p.y + p.vy * fl * 0.5, regionAt(e.x, e.y));
    g.spawnHazard('circle', 'paper_drop', at.x, at.y, { r: P(e, 'blast', 60), tele: fl, active: 0.15, dmg: P(e, 'blastDmg', 9) * g.diff.dmgMult, owner: e.uid });
    g.fx.push('spark', e.x, e.y, 4, 0, 0, 'paper');
    sfx(g, 'throw', e.x, e.y, 0.35);
  }
}

// ---------------------------------------------------------------- Luggage Mimic
/** Sits still among the luggage, harmless (0) until someone comes close; snaps open (1); hops and bites (2), gathers (3). */
export function mimic(g: Game, e: Enemy, dt: number): void {
  const { ux, uy, d } = toward(g, e);
  switch (e.state) {
    case 0:
      e.vx = e.vy = 0;
      e.noContact = true;
      if (d < P(e, 'wake', 170)) {
        e.state = 1;
        e.t = P(e, 'snap', 0.45);
        sfx(g, 'trunkslam', e.x, e.y, 0.5);
      }
      break;
    case 1:
      e.noContact = false;
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'snap', 0.45);
      if (e.t <= 0) {
        e.state = 2;
        e.t = P(e, 'hopT', 0.28);
        e.dirX = ux;
        e.dirY = uy;
        e.windup = 0;
      }
      break;
    case 2:
      moveDir(g, e, e.dirX, e.dirY, P(e, 'hop', 380), dt);
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 3;
        e.t = P(e, 'rest', 0.42);
        sfx(g, 'chomp', e.x, e.y, 0.35);
      }
      break;
    case 3:
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = Math.min(1, 1 - e.t / P(e, 'rest', 0.42)) * 0.6;
      if (e.t <= 0) {
        e.state = 2;
        e.t = P(e, 'hopT', 0.28);
        e.dirX = ux;
        e.dirY = uy;
      }
      break;
  }
}

// ---------------------------------------------------------------- Gravebound
/** Shambles after you once it's up; hunches (1) and lunges to grab (2), then shambles again. */
export function gravebound(g: Game, e: Enemy, dt: number): void {
  const { ux, uy, d } = toward(g, e);
  e.n1 -= dt;
  switch (e.state) {
    case 0:
      moveDir(g, e, ux, uy, e.speed * (0.85 + 0.25 * Math.max(0, Math.sin(e.animT * 2.2 + e.idx))), dt);
      if (d < P(e, 'grab', 120) && e.n1 <= 0) {
        e.state = 1;
        e.t = P(e, 'tele', 0.5);
        e.dirX = ux;
        e.dirY = uy;
      }
      break;
    case 1:
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'tele', 0.5);
      if (e.t <= 0) {
        e.state = 2;
        e.t = P(e, 'lungeT', 0.25);
        e.windup = 0;
        sfx(g, 'bonehit', e.x, e.y, 0.35);
      }
      break;
    case 2:
      moveDir(g, e, e.dirX, e.dirY, P(e, 'lunge', 420), dt);
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 0;
        e.n1 = P(e, 'cool', 2.8);
      }
      break;
  }
}

// ---------------------------------------------------------------- Shroud Moth
/** Flutters across the station on its drift (set when the cloud is released) and folds away past the far side. */
export function moth(g: Game, e: Enemy, dt: number): void {
  e.noSep = true;
  if (e.t === 0) e.n1 = g.rng.angle();
  e.t += dt;
  const fl = P(e, 'flutter', 70);
  const wob = Math.sin(e.t * 3.1 + e.n1) * fl + Math.sin(e.t * 7.3 + e.n1 * 2) * fl * 0.35;
  const vx = e.dirX * e.speed - e.dirY * wob, vy = e.dirY * e.speed + e.dirX * wob;
  e.vx = vx * g.slowFactor(e);
  e.vy = vy * g.slowFactor(e);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (Math.abs(e.vx) > 4) e.face = e.vx > 0 ? 1 : -1;
  const r = regionAt(e.x, e.y);
  if (e.t > 16 || r < 0) g.despawnEnemy(e);
}

// ---------------------------------------------------------------- The Pallbearers
/** Plod on with the coffin; set it down hard every few seconds (a circle marks the slam). */
export function pallbearer(g: Game, e: Enemy, dt: number): void {
  e.leashExempt = true;
  e.t -= dt;
  if (e.n1 === 0) {
    e.n1 = 1;
    e.t = P(e, 'slamEvery', 4.4) * g.rng.range(0.5, 1);
  }
  if (e.state === 0) {
    const { ux, uy, d } = toward(g, e);
    moveDir(g, e, ux, uy, e.speed, dt);
    if (e.t <= 0 && d < 380) {
      e.state = 1;
      e.t2 = P(e, 'slamTele', 1);
      g.spawnHazard('circle', 'coffin_slam', e.x + ux * 30, e.y + uy * 30, { r: P(e, 'slamR', 130), tele: e.t2, active: 0.15, dmg: P(e, 'slamDmg', 16) * g.diff.dmgMult, owner: e.uid });
      sfx(g, 'grunt', e.x, e.y, 0.5);
    } else if (e.t <= 0) e.t = 1;
    return;
  }
  e.vx = e.vy = 0;
  e.t2 -= dt;
  e.windup = 1 - e.t2 / P(e, 'slamTele', 1);
  if (e.t2 <= 0) {
    g.fx.push('ring', e.x, e.y, P(e, 'slamR', 130), 0, 0, 'shock');
    g.fx.push('shake', e.x, e.y, 0.35);
    sfx(g, 'coffinbreak', e.x, e.y, 0.6);
    e.state = 0;
    e.windup = 0;
    e.t = P(e, 'slamEvery', 4.4);
  }
}

// ---------------------------------------------------------------- Slag Golem
/** Drips burning slag where it walks (pools that burn), and slams with both fists. */
export function slag(g: Game, e: Enemy, dt: number): void {
  e.leashExempt = true;
  e.n2 -= dt;
  if (e.n2 <= 0) {
    e.n2 = P(e, 'pool', 1.5) * (e.elite ? 0.7 : 1);
    g.spawnHazard('circle', 'slag_pool', e.x, e.y, { r: P(e, 'poolR', 46), tele: 0.25, active: P(e, 'poolLife', 4), dmg: P(e, 'poolDmg', 6) * g.diff.dmgMult, tick: 0.5, owner: 0 });
  }
  e.t -= dt;
  if (e.n1 === 0) {
    e.n1 = 1;
    e.t = P(e, 'slamEvery', 5) * g.rng.range(0.5, 1);
  }
  if (e.state === 0) {
    const { ux, uy, d } = toward(g, e);
    moveDir(g, e, ux, uy, e.speed, dt);
    if (e.t <= 0 && d < 300) {
      e.state = 1;
      e.t2 = P(e, 'slamTele', 0.9);
      g.spawnHazard('circle', 'slag_slam', e.x, e.y, { r: P(e, 'slamR', 120), tele: e.t2, active: 0.15, dmg: P(e, 'slamDmg', 18) * g.diff.dmgMult, owner: e.uid });
      sfx(g, 'grunt', e.x, e.y, 0.5);
    } else if (e.t <= 0) e.t = 1;
    return;
  }
  e.vx = e.vy = 0;
  e.t2 -= dt;
  e.windup = 1 - e.t2 / P(e, 'slamTele', 0.9);
  if (e.t2 <= 0) {
    g.fx.push('ring', e.x, e.y, P(e, 'slamR', 120), 0, 0, 'fire');
    sfx(g, 'stomp', e.x, e.y, 0.7);
    e.state = 0;
    e.windup = 0;
    e.t = P(e, 'slamEvery', 5);
  }
}

// ---------------------------------------------------------------- Riveter
/** Keeps its distance; plants its feet while a line ticks out at you (1), then fires a burst of rivets down it (2). */
export function riveter(g: Game, e: Enemy, dt: number): void {
  if (e.state === 0) {
    keepAway(g, e, dt, P(e, 'keep', 300), 0.4, 0.8);
    if (e.n1 === 0) {
      e.t = P(e, 'fire', 3.4) * g.rng.next();
      e.n1 = 1;
    }
    e.t -= dt;
    const { ux, uy, d } = toward(g, e);
    if (e.t <= 0 && d < P(e, 'keep', 300) * 1.9) {
      e.state = 1;
      e.n2 = P(e, 'tele', 0.7);
      e.dirX = ux;
      e.dirY = uy;
      g.spawnHazard('line', 'rivet_lane', e.x, e.y, { x2: e.x + ux * (d + 300), y2: e.y + uy * (d + 300), r2: 12, tele: e.n2, active: 0.01, dmg: 0, owner: e.uid });
      sfx(g, 'crank', e.x, e.y, 0.35);
    }
    return;
  }
  e.vx = e.vy = 0;
  e.n2 -= dt;
  if (e.state === 1) {
    e.windup = 1 - e.n2 / P(e, 'tele', 0.7);
    if (e.n2 <= 0) {
      e.state = 2;
      e.t2 = Math.round(P(e, 'shots', 3)) + (e.elite ? 2 : 0);
      e.n2 = 0;
      e.windup = 0;
    }
    return;
  }
  if (e.n2 <= 0) {
    const sp = P(e, 'speed', 560);
    g.spawnBullet('musket', e.x + e.dirX * 12, e.y + e.dirY * 12, e.dirX * sp, e.dirY * sp, P(e, 'dmg', 7) * g.diff.dmgMult, { r: 6, life: 1.4 });
    sfx(g, 'rivet', e.x, e.y, 0.3);
    e.t2--;
    e.n2 = P(e, 'gap', 0.12);
    if (e.t2 <= 0) {
      e.state = 0;
      e.t = P(e, 'fire', 3.4);
    }
  }
}

// ---------------------------------------------------------------- Furnace Hound
/** Trots in; crouches while a lane lights ahead (1); runs it, leaving fire (2); stands panting (3). */
export function hound(g: Game, e: Enemy, dt: number): void {
  switch (e.state) {
    case 0: {
      const { ux, uy, d } = toward(g, e);
      moveDir(g, e, ux, uy, e.speed, dt);
      e.windup = 0;
      if (d < P(e, 'range', 460) && e.spawnT > 0.8) {
        e.state = 1;
        e.t = P(e, 'tele', 0.75);
        e.dirX = ux;
        e.dirY = uy;
        e.n1 = d + P(e, 'over', 240);
        g.spawnHazard('line', 'hound_lane', e.x, e.y, { x2: e.x + ux * e.n1, y2: e.y + uy * e.n1, r2: e.r, tele: e.t, active: 0.01, dmg: 0, owner: e.uid });
        sfx(g, 'growl', e.x, e.y, 0.4);
      }
      break;
    }
    case 1:
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'tele', 0.75);
      e.face = e.dirX > 0 ? 1 : -1;
      if (e.t <= 0) {
        e.state = 2;
        e.n2 = 0;
        e.windup = 0;
        e.noSep = true;
      }
      break;
    case 2: {
      const sp = P(e, 'charge', 560) * Math.max(0.4, g.slowFactor(e));
      e.vx = e.dirX * sp;
      e.vy = e.dirY * sp;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.n2 += sp * dt;
      e.t2 -= dt;
      if (e.t2 <= 0) {
        e.t2 = P(e, 'trail', 0.08) * (e.elite ? 0.7 : 1);
        g.spawnHazard('circle', 'fire_trail', e.x, e.y, { r: 20, tele: 0.01, active: 1.1, dmg: P(e, 'trailDmg', 5) * g.diff.dmgMult, tick: 0.5 });
      }
      if (e.n2 >= e.n1) {
        e.state = 3;
        e.t = P(e, 'recover', 0.8);
        e.noSep = false;
      }
      break;
    }
    case 3:
      e.t -= dt;
      e.vx *= 0.88;
      e.vy *= 0.88;
      if (e.t <= 0) e.state = 0;
      break;
  }
}

// ---------------------------------------------------------------- Still Folk
/** Frozen mid-step until Stillwater's bell tolls (every `toll` seconds of the night): then they all lurch. */
export function stillfolk(g: Game, e: Enemy, dt: number): void {
  const toll = P(e, 'toll', 2.4), lurch = P(e, 'lurch', 0.55);
  const c = ((g.time % toll) + toll) % toll;
  if (c < lurch) {
    const { ux, uy } = toward(g, e);
    moveDir(g, e, ux, uy, e.speed * (e.elite ? 1.1 : 1), dt);
    e.windup = 0;
  } else {
    e.vx = e.vy = 0;
    e.windup = c > toll - 0.4 ? (c - (toll - 0.4)) / 0.4 : 0;
  }
}

// ---------------------------------------------------------------- The Watcher
/**
 * Stands at a distance and stares (0): its gaze is a beam from it toward a point that follows you slowly, and it
 * burns while you stand in it; rests (1). Come within `near` of it and it is suddenly somewhere else.
 */
export function watcher(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  e.vx = e.vy = 0;
  e.face = p.x > e.x ? 1 : -1;
  const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
  e.n1 -= dt;
  // too close: elsewhere, at its distance
  if (d < P(e, 'near', 190) && e.n1 <= 0) {
    g.clearHazardsOf(e.uid);
    g.fx.push('spark', e.x, e.y, 8, 0, 0, 'veil');
    const a = g.rng.angle(), k = P(e, 'keep', 380);
    const to = onGround(p.x + Math.cos(a) * k, p.y + Math.sin(a) * k, regionAt(e.x, e.y));
    e.x = e.px = to.x;
    e.y = e.py = to.y;
    e.n1 = 1.2;
    e.state = 1;
    e.t = 0.8;
    sfx(g, 'ghostgasp', e.x, e.y, 0.4);
    return;
  }
  e.t -= dt;
  if (e.state === 1) {
    e.windup = 0;
    if (e.t <= 0) {
      e.state = 0;
      e.t = P(e, 'gazeT', 3.2);
      e.tx = p.x;
      e.ty = p.y;
      const h = g.spawnHazard('line', 'gaze', e.x, e.y, { x2: e.tx, y2: e.ty, r2: P(e, 'width', 16), tele: 0.45, active: P(e, 'gazeT', 3.2), dmg: P(e, 'dps', 14) * 0.25 * g.diff.dmgMult, tick: 0.25, owner: e.uid });
      e.n2 = g.hazards.indexOf(h);
      sfx(g, 'gaze', e.x, e.y, 0.35);
    }
    return;
  }
  // the gaze follows you, slowly
  const k = Math.min(1, P(e, 'track', 0.9) * dt);
  e.tx += (p.x - e.tx) * k;
  e.ty += (p.y - e.ty) * k;
  const h = g.hazards[e.n2];
  if (h && h.alive && h.owner === e.uid && h.style === 'gaze') {
    // reach past where it looks, out to the end of its sight
    const dx = e.tx - e.x, dy = e.ty - e.y, l = Math.hypot(dx, dy) || 1;
    h.x = e.x;
    h.y = e.y;
    h.x2 = e.x + (dx / l) * Math.max(l + 120, 420);
    h.y2 = e.y + (dy / l) * Math.max(l + 120, 420);
  }
  e.windup = 1;
  if (e.t <= 0) {
    e.state = 1;
    e.t = P(e, 'rest', 2);
    g.clearHazardsOf(e.uid);
  }
}

// ---------------------------------------------------------------- Bell Wraith
/** Hangs back and rings its hand-bell: everything near it hurries a while, and the ground gives up more dead. */
export function bellwraith(g: Game, e: Enemy, dt: number): void {
  if (e.state === 0) {
    keepAway(g, e, dt, P(e, 'keep', 360), 0.7);
    if (e.n1 === 0) {
      e.n1 = 1;
      e.t = P(e, 'ring', 6) * g.rng.range(0.3, 0.8);
    }
    e.t -= dt;
    if (e.t <= 0) {
      e.state = 1;
      e.n2 = P(e, 'tele', 0.9);
      sfx(g, 'bellding', e.x, e.y, 0.4);
    }
    return;
  }
  e.vx = e.vy = 0;
  e.n2 -= dt;
  e.windup = 1 - e.n2 / P(e, 'tele', 0.9);
  if (e.n2 > 0) return;
  const reach = P(e, 'reach', 360), haste = P(e, 'haste', 1.35), hT = P(e, 'hasteT', 3.5);
  g.forEachEnemyInCircle(e.x, e.y, reach, (o) => {
    if (o === e || o.slowF < 1) return;
    o.slowF = Math.max(o.slowF, haste);
    o.slowT = Math.max(o.slowT, hT);
  });
  g.fx.push('ring', e.x, e.y, reach, 0, 0, 'bell');
  sfx(g, 'toll', e.x, e.y, 0.5);
  // the dead the bell calls: whatever this place buries
  const r = regionAt(e.x, e.y), p = g.player, id = r === 1 ? 'gt_gravebound' : 'gt_stillfolk';
  for (let k = 0; k < Math.round(P(e, 'call', 2)) + (e.elite ? 1 : 0); k++) {
    const a = g.rng.angle(), at = onGround(p.x + Math.cos(a) * 240, p.y + Math.sin(a) * 200, r);
    g.spawnEnemy(id, at.x, at.y, { exact: true });
  }
  e.state = 0;
  e.windup = 0;
  e.t = P(e, 'ring', 6);
}

// ---------------------------------------------------------------- The Collected
/** Lumbers after you; sheds a passenger each time it's hurt badly enough; draws back its arms for a wide sweep. */
export function collected(g: Game, e: Enemy, dt: number): void {
  e.leashExempt = true;
  if (e.n1 === 0) e.n1 = 1 - P(e, 'shed', 0.25);
  while (e.hp / e.maxHp < e.n1 && e.n1 > 0.05) {
    e.n1 -= P(e, 'shed', 0.25);
    const a = g.rng.angle();
    const at = onGround(e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, regionAt(e.x, e.y));
    g.spawnEnemy('gt_ticketless', at.x, at.y, { exact: true });
    g.fx.push('spark', e.x, e.y, 8, 0, 0, 'veil');
  }
  e.t -= dt;
  if (e.n2 === 0) {
    e.n2 = 1;
    e.t = P(e, 'sweepEvery', 3.8) * g.rng.range(0.5, 1);
  }
  if (e.state === 0) {
    const { ux, uy, d } = toward(g, e);
    moveDir(g, e, ux, uy, e.speed, dt);
    if (e.t <= 0 && d < P(e, 'sweepR', 150) * 0.95) {
      e.state = 1;
      e.t2 = P(e, 'sweepTele', 0.8);
      g.spawnHazard('sector', 'collected_sweep', e.x, e.y, { r: P(e, 'sweepR', 150), angle: Math.atan2(uy, ux), half: P(e, 'sweepHalf', 1.1), tele: e.t2, active: 0.15, dmg: P(e, 'sweepDmg', 15) * g.diff.dmgMult, owner: e.uid });
      sfx(g, 'wail', e.x, e.y, 0.4);
    } else if (e.t <= 0) e.t = 0.8;
    return;
  }
  e.vx = e.vy = 0;
  e.t2 -= dt;
  e.windup = 1 - e.t2 / P(e, 'sweepTele', 0.8);
  if (e.t2 <= 0) {
    e.state = 0;
    e.windup = 0;
    e.t = P(e, 'sweepEvery', 3.8);
  }
}

// ---------------------------------------------------------------- The Ticket Puncher
/** Keeps a distance and marks you: the mark follows you a moment, stops, and closes (a circle you must leave). */
export function puncher(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  if (e.state === 0) {
    keepAway(g, e, dt, P(e, 'keep', 260), 0.6);
    e.t -= dt;
    if (e.n1 === 0) {
      e.n1 = 1;
      e.t = P(e, 'cool', 4.2) * g.rng.range(0.4, 1);
    }
    if (e.t <= 0 && Math.sqrt(dist2(e.x, e.y, p.x, p.y)) < 620) {
      e.state = 1;
      e.n2 = P(e, 'mark', 1.5) + P(e, 'lock', 0.7);
      const h = g.spawnHazard('circle', 'punch_mark', p.x, p.y, { r: P(e, 'punchR', 70), tele: e.n2, active: 0.15, dmg: P(e, 'punchDmg', 18) * g.diff.dmgMult, owner: e.uid });
      e.t2 = g.hazards.indexOf(h);
      sfx(g, 'punch', e.x, e.y, 0.35);
    }
    return;
  }
  e.vx = e.vy = 0;
  e.n2 -= dt;
  const lock = P(e, 'lock', 0.7);
  e.windup = 1 - e.n2 / (P(e, 'mark', 1.5) + lock);
  const h = g.hazards[e.t2];
  if (e.n2 > lock && h && h.alive && h.owner === e.uid && h.style === 'punch_mark') {
    const k = Math.min(1, 6 * dt);
    h.x += (p.x - h.x) * k;
    h.y += (p.y - h.y) * k;
  }
  if (e.n2 <= 0) {
    e.state = 0;
    e.windup = 0;
    e.t = P(e, 'cool', 4.2);
  }
}

// ---------------------------------------------------------------- The Ticket Inspector (miniboss)
/** Walks his rounds; every few seconds either sweeps his lantern in a long beam or brings his punch down. */
export function inspector(g: Game, e: Enemy, dt: number): void {
  e.leashExempt = true;
  e.t -= dt;
  if (e.n1 === 0) {
    e.n1 = 1;
    e.t = P(e, 'every', 4.6);
  }
  if (e.state === 0) {
    const { ux, uy, d } = toward(g, e);
    moveDir(g, e, ux, uy, e.speed, dt);
    if (e.t <= 0 && d < 420) {
      e.n2 = (e.n2 + 1) % 2;
      if (e.n2 === 1) {
        e.state = 1;
        e.t2 = P(e, 'sweepTele', 0.9);
        const L = P(e, 'sweepR', 240) + 120;
        g.spawnHazard('line', 'lantern_sweep', e.x, e.y, { x2: e.x + ux * L, y2: e.y + uy * L, r2: P(e, 'sweepW', 30), tele: e.t2, active: 0.15, dmg: P(e, 'sweepDmg', 14) * g.diff.dmgMult, owner: e.uid });
      } else {
        e.state = 1;
        e.t2 = P(e, 'punchTele', 0.8);
        g.spawnHazard('circle', 'inspector_punch', e.x + ux * 40, e.y + uy * 40, { r: P(e, 'punchR', 120), tele: e.t2, active: 0.15, dmg: P(e, 'punchDmg', 20) * g.diff.dmgMult, owner: e.uid });
      }
      sfx(g, 'grunt', e.x, e.y, 0.55);
    } else if (e.t <= 0) e.t = 1;
    return;
  }
  e.vx = e.vy = 0;
  e.t2 -= dt;
  e.windup = Math.min(1, 1 - e.t2 / 0.9);
  if (e.t2 <= 0) {
    g.fx.push('shake', e.x, e.y, 0.3);
    sfx(g, 'punch', e.x, e.y, 0.7);
    e.state = 0;
    e.windup = 0;
    e.t = P(e, 'every', 4.6);
  }
}

// ---------------------------------------------------------------- deaths
/** What a Ghost Train creature leaves behind when it falls. */
export function gtDeath(g: Game, e: Enemy): void {
  const r = regionAt(e.x, e.y);
  switch (e.def.behavior) {
    case 'gt_coalborn':
      // a scatter of embers: burning ground for a moment
      g.spawnHazard('circle', 'embers', e.x, e.y, { r: e.elite ? 54 : 36, tele: 0.2, active: P(e, 'ember', 2.4), dmg: 4 * g.diff.dmgMult, tick: 0.5 });
      break;
    case 'gt_pallbearer':
      // the coffin breaks: whoever was in it gets out
      for (let k = 0; k < Math.round(P(e, 'release', 3)); k++) {
        const a = g.rng.angle(), at = onGround(e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50, r);
        g.spawnEnemy('gt_ticketless', at.x, at.y, { exact: true });
      }
      {
        const at = onGround(e.x, e.y + 30, r);
        g.spawnEnemy('gt_mourner', at.x, at.y, { exact: true });
      }
      break;
    case 'gt_collected':
      for (let k = 0; k < 2; k++) {
        const a = g.rng.angle(), at = onGround(e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, r);
        g.spawnEnemy('gt_ticketless', at.x, at.y, { exact: true });
      }
      break;
  }
}

export const GT_BEHAVIORS: Record<string, (g: Game, e: Enemy, dt: number) => void> = {
  gt_ticketless: ticketless, gt_coalborn: coalborn, gt_porter: porter, gt_railcrawler: railcrawler, gt_mourner: mourner,
  gt_signalman: signalman, gt_commuter: commuter, gt_newsboy: newsboy, gt_mimic: mimic, gt_gravebound: gravebound,
  gt_moth: moth, gt_pallbearer: pallbearer, gt_slag: slag, gt_riveter: riveter, gt_hound: hound, gt_stillfolk: stillfolk,
  gt_watcher: watcher, gt_bellwraith: bellwraith, gt_collected: collected, gt_puncher: puncher, gt_inspector: inspector,
  gt_navvy: navvy,
};
