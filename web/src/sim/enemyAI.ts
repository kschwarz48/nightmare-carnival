// Enemy behaviours (doc 04 + doc 08 §11). One function per reusable AI pattern; tuning in EnemyDef.params.
// Every attack has a readable wind-up (e.windup 0..1 drives the renderer's telegraph pose).

import { clamp, dist2, TAU } from '../core/math';
import { PROPS } from '../data/map';
import type { Enemy } from './entities';
import type { Game } from './game';
import { VIEW_HALF_X, VIEW_HALF_Y } from './constants';

const P = (e: Enemy, k: string, d: number): number => {
  const v = e.def.params[k];
  return typeof v === 'number' ? v : d;
};

function move(g: Game, e: Enemy, vx: number, vy: number, dt: number): void {
  e.vx = vx;
  e.vy = vy;
  e.x += vx * dt;
  e.y += vy * dt;
  if (Math.abs(vx) > 4) e.face = vx > 0 ? 1 : -1;
}

function seek(g: Game, e: Enemy, dt: number, scale = 1, jitterAngle = 0): void {
  const p = g.player;
  let dx = p.x - e.x, dy = p.y - e.y;
  const l = Math.hypot(dx, dy) || 1;
  dx /= l;
  dy /= l;
  if (jitterAngle !== 0) {
    const c = Math.cos(jitterAngle), s = Math.sin(jitterAngle);
    const nx = dx * c - dy * s;
    dy = dx * s + dy * c;
    dx = nx;
  }
  const sp = e.speed * g.slowFactor(e) * scale;
  move(g, e, dx * sp, dy * sp, dt);
}

export function updateEnemy(g: Game, e: Enemy, dt: number): void {
  if (!e.alive) return;
  const slow = g.slowFactor(e);
  e.animT += dt * (0.4 + 0.6 * slow);
  if (e.kbT > 0) {
    e.kbT -= dt;
    e.x += e.kbX * dt;
    e.y += e.kbY * dt;
    return;
  }
  if (e.frozenT > 0) return;
  switch (e.def.behavior) {
    case 'chaser': chaser(g, e, dt); break;
    case 'erratic': erratic(g, e, dt); break;
    case 'burst_charger': burstCharger(g, e, dt); break;
    case 'line_charger': lineCharger(g, e, dt); break;
    case 'bumper': bumper(g, e, dt); break;
    case 'flyby': flyby(g, e, dt); break;
    case 'shooter': shooter(g, e, dt); break;
    case 'formation': formation(g, e, dt); break;
    case 'spawner': spawner(g, e, dt); break;
    case 'ambusher': ambusher(g, e, dt); break;
    case 'pop_up': popUp(g, e, dt); break;
    case 'rail_strafer': railStrafer(g, e, dt); break;
    case 'brute': brute(g, e, dt); break;
  }
  // Magnetic affix: drag nearby trash toward the elite.
  if (e.elite && e.affixes.length && e.affixes.includes('magnetic')) {
    g.forEachEnemyInCircle(e.x, e.y, 180, (o) => {
      if (o === e) return;
      o.x += (e.x - o.x) * dt * 0.6;
      o.y += (e.y - o.y) * dt * 0.6;
    });
  }
}

// --- Living Balloon / Stuffie / Slime: straight seek + perpendicular bob (Godot ChaserBehavior).
function chaser(g: Game, e: Enemy, dt: number): void {
  e.n1 += dt * 6;
  seek(g, e, dt, 1, Math.sin(e.n1 + e.idx) * 0.25);
  if (e.def.id === 'cotton_candy_slime') {
    e.t += dt;
    if (e.t >= P(e, 'patchEvery', 5)) {
      e.t = 0;
      const z = g.spawnZone('sticky_patch', e.x, e.y, e.elite ? 70 : 42, 4, 0, 1);
      if (z) {
        z.harmful = true;
        z.slow = e.elite ? 0.5 : 0.35;
      }
    }
  }
}

// --- Evil Clown: heading jitter + occasional honk-hop.
function erratic(g: Game, e: Enemy, dt: number): void {
  e.t -= dt;
  if (e.t <= 0) {
    e.n1 = g.rng.range(-0.6, 0.6);
    e.t = g.rng.range(0.2, 0.5);
  }
  e.t2 -= dt;
  if (e.t2 <= 0) {
    if (e.n2 > 1) {
      e.n2 = 1;
      e.t2 = g.rng.range(2, 4);
    } else {
      e.n2 = 1.25;
      e.t2 = g.rng.range(0.3, 0.4);
      if (dist2(e.x, e.y, g.player.x, g.player.y) < 500 * 500 && g.rng.chance(0.3)) g.bus.emit('sfx', { id: 'honk', x: e.x, y: e.y, vol: 0.35 });
    }
  }
  if (e.n2 < 1) e.n2 = 1;
  seek(g, e, dt, e.n2 * (e.elite ? 1.15 : 1), e.n1);
}

// --- Wind-Up Monkey: approach → telegraphed wind-up → straight dash → exposed recovery.
function burstCharger(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  switch (e.state) {
    case 0:
      seek(g, e, dt, 1);
      e.windup = 0;
      if (dist2(e.x, e.y, p.x, p.y) < P(e, 'range', 280) ** 2 && e.spawnT > 0.6) {
        e.state = 1;
        e.t = P(e, 'windup', 0.5);
        g.bus.emit('sfx', { id: 'windup', x: e.x, y: e.y, vol: 0.3 });
      }
      break;
    case 1: {
      const wt = P(e, 'windup', 0.5);
      e.t -= dt;
      e.windup = 1 - e.t / wt;
      e.vx = e.vy = 0;
      const dx = p.x - e.x, dy = p.y - e.y;
      const l = Math.hypot(dx, dy) || 1;
      e.dirX = dx / l;
      e.dirY = dy / l;
      e.face = dx > 0 ? 1 : -1;
      if (e.t <= 0) {
        e.state = 2;
        e.t = P(e, 'chargeTime', 0.4) * (e.elite ? 1.5 : 1);
        e.windup = 0;
        g.bus.emit('sfx', { id: 'cymbal', x: e.x, y: e.y, vol: 0.35 });
      }
      break;
    }
    case 2: {
      const sp = P(e, 'chargeSpeed', 380) * g.slowFactor(e);
      move(g, e, e.dirX * sp, e.dirY * sp, dt);
      e.t -= dt;
      if (e.t <= 0) {
        e.state = 3;
        e.t = P(e, 'recover', 0.65);
        if (e.elite) g.spawnHazard('circle', 'shock', e.x, e.y, { r: 70, tele: 0.35, dmg: e.dmg, owner: e.uid });
      }
      break;
    }
    case 3:
      e.vx *= 0.85;
      e.vy *= 0.85;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.t -= dt;
      if (e.t <= 0) e.state = 0;
      break;
  }
}

// --- Carousel Horse: trot in → rear up with a lane telegraph → committed charge far past → wheel around.
function lineCharger(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  switch (e.state) {
    case 0:
      seek(g, e, dt, 1);
      e.windup = 0;
      if (dist2(e.x, e.y, p.x, p.y) < P(e, 'range', 440) ** 2 && e.spawnT > 0.8) {
        e.state = 1;
        e.t = P(e, 'windup', 0.8);
        const dx = p.x - e.x, dy = p.y - e.y;
        const l = Math.hypot(dx, dy) || 1;
        e.dirX = dx / l;
        e.dirY = dy / l;
        e.n1 = l + P(e, 'overshoot', 260);
        g.spawnHazard('line', 'lane', e.x, e.y, {
          x2: e.x + e.dirX * e.n1, y2: e.y + e.dirY * e.n1, r2: e.r, tele: e.t, active: 0.01, dmg: 0, owner: e.uid,
        });
        g.bus.emit('sfx', { id: 'whinny', x: e.x, y: e.y, vol: 0.4 });
      }
      break;
    case 1:
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'windup', 0.8);
      e.face = e.dirX > 0 ? 1 : -1;
      if (e.t <= 0) {
        e.state = 2;
        e.n2 = 0;
        e.windup = 0;
      }
      break;
    case 2: {
      const sp = P(e, 'chargeSpeed', 380) * Math.max(0.4, g.slowFactor(e));
      move(g, e, e.dirX * sp, e.dirY * sp, dt);
      e.n2 += sp * dt;
      if (e.elite) {
        e.t2 -= dt;
        if (e.t2 <= 0) {
          e.t2 = 0.07;
          g.spawnHazard('circle', 'fire_trail', e.x, e.y, { r: 20, tele: 0.01, active: 1.1, dmg: e.dmg * 0.4, tick: 0.5 });
        }
      }
      if (e.n2 >= e.n1) {
        e.state = 3;
        e.t = P(e, 'recover', 0.9);
      }
      break;
    }
    case 3:
      e.t -= dt;
      e.vx *= 0.9;
      e.vy *= 0.9;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.t <= 0) e.state = 0;
      break;
  }
}

// --- Bumper Car: spark wind-up → ram that ricochets off props and other cars.
function bumper(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  switch (e.state) {
    case 0:
      seek(g, e, dt, 1);
      e.windup = 0;
      if (dist2(e.x, e.y, p.x, p.y) < P(e, 'range', 380) ** 2 && e.spawnT > 0.6) {
        e.state = 1;
        e.t = P(e, 'windup', 0.6);
        g.bus.emit('sfx', { id: 'zap', x: e.x, y: e.y, vol: 0.3 });
      }
      break;
    case 1: {
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'windup', 0.6);
      const dx = p.x - e.x, dy = p.y - e.y;
      const l = Math.hypot(dx, dy) || 1;
      e.dirX = dx / l;
      e.dirY = dy / l;
      e.face = dx > 0 ? 1 : -1;
      if (e.t <= 0) {
        e.state = 2;
        e.t = P(e, 'ramTime', 1.4);
        e.n1 = P(e, 'bounces', 2) + (e.elite ? 2 : 0);
        e.windup = 0;
      }
      break;
    }
    case 2: {
      const sp = P(e, 'ramSpeed', 330) * Math.max(0.4, g.slowFactor(e));
      let nx = e.x + e.dirX * sp * dt, ny = e.y + e.dirY * sp * dt;
      // ricochet off solid props
      for (const pr of PROPS) {
        if (pr.r && pr.r > 25) {
          const rr = pr.r + e.r;
          const dx = nx - pr.x, dy = ny - pr.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < rr * rr) {
            const d = Math.sqrt(d2) || 1;
            const nX = dx / d, nY = dy / d;
            const dot = e.dirX * nX + e.dirY * nY;
            e.dirX -= 2 * dot * nX;
            e.dirY -= 2 * dot * nY;
            nx = pr.x + nX * rr;
            ny = pr.y + nY * rr;
            e.n1--;
            g.fx.push('spark', nx, ny, 3, 0, 0, 'electric');
            g.bus.emit('sfx', { id: 'bonk', x: nx, y: ny, vol: 0.3 });
          }
        } else if (pr.hw && pr.hh && pr.hh > 25) {
          if (Math.abs(nx - pr.x) < pr.hw + e.r && Math.abs(ny - pr.y) < pr.hh + e.r) {
            const ox = pr.hw + e.r - Math.abs(nx - pr.x), oy = pr.hh + e.r - Math.abs(ny - pr.y);
            if (ox < oy) e.dirX = -e.dirX;
            else e.dirY = -e.dirY;
            nx = e.x;
            ny = e.y;
            e.n1--;
            g.fx.push('spark', nx, ny, 3, 0, 0, 'electric');
          }
        }
      }
      // ricochet off the screen box around the player so it stays in play
      if (Math.abs(nx - p.x) > VIEW_HALF_X * 0.95) {
        e.dirX = -e.dirX;
        e.n1--;
      }
      if (Math.abs(ny - p.y) > VIEW_HALF_Y * 0.95) {
        e.dirY = -e.dirY;
        e.n1--;
      }
      move(g, e, (nx - e.x) / dt, (ny - e.y) / dt, dt);
      e.t -= dt;
      if (e.t <= 0 || e.n1 < 0) {
        e.state = 3;
        e.t = P(e, 'recover', 0.7);
      }
      break;
    }
    case 3:
      e.t -= dt;
      e.vx *= 0.88;
      e.vy *= 0.88;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.t <= 0) e.state = 0;
      break;
  }
}

// --- Balloon Swarm: straight across the screen, never tracks, despawns past the far edge.
function flyby(g: Game, e: Enemy, dt: number): void {
  e.noSep = true;
  e.t += dt;
  move(g, e, e.dirX * e.speed, e.dirY * e.speed, dt);
  const p = g.player;
  const pastX = e.dirX > 0.1 ? e.x > p.x + VIEW_HALF_X + 140 : e.dirX < -0.1 ? e.x < p.x - VIEW_HALF_X - 140 : false;
  const pastY = e.dirY > 0.1 ? e.y > p.y + VIEW_HALF_Y + 140 : e.dirY < -0.1 ? e.y < p.y - VIEW_HALF_Y - 140 : false;
  if (e.t > 9 || ((pastX || pastY) && e.t > 1)) g.despawnEnemy(e);
}

function fireAt(g: Game, e: Enemy, spread = 0): void {
  const p = g.player;
  const lead = P(e, 'lead', 0);
  const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead;
  const a = Math.atan2(ty - e.y, tx - e.x) + spread;
  const sp = P(e, 'projSpeed', 230);
  const kind = (e.def.params.proj as any) ?? 'pie';
  g.spawnBullet(kind, e.x, e.y - 8, Math.cos(a) * sp, Math.sin(a) * sp, P(e, 'projDmg', 8) * g.diff.dmgMult * (1 + 0.04 * g.minutes), {
    life: P(e, 'projLife', 4), r: kind === 'pie' ? 9 : 6, spin: kind === 'pie' ? 7 : 0,
  });
  g.bus.emit('sfx', { id: kind === 'pie' ? 'throw' : 'musket', x: e.x, y: e.y, vol: 0.3 });
}

// --- Dunk-Tank Clown: keep preferred distance; wind up, then lob a pie at your predicted position.
function shooter(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  const keep = P(e, 'keep', 340);
  const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
  let dx = (p.x - e.x) / (d || 1), dy = (p.y - e.y) / (d || 1);
  let s = 1;
  if (d < keep * 0.8) s = -1;
  else if (d < keep) s = 0;
  if (e.state === 1) s = 0;
  const sp = e.speed * g.slowFactor(e) * s;
  move(g, e, dx * sp, dy * sp, dt);
  if (s === 0) e.face = dx > 0 ? 1 : -1;
  if (e.state === 0) {
    e.t -= dt;
    if (e.n1 === 0) {
      e.t = P(e, 'fire', 1.7) * g.rng.next();
      e.n1 = 1;
    }
    if (e.t <= 0 && d < keep * 1.6) {
      e.state = 1;
      e.t2 = P(e, 'windup', 0.45);
    }
  } else {
    e.t2 -= dt;
    e.windup = 1 - e.t2 / P(e, 'windup', 0.45);
    if (e.t2 <= 0) {
      fireAt(g, e);
      if (e.elite) {
        fireAt(g, e, 0.25);
        fireAt(g, e, -0.25);
      }
      e.state = 0;
      e.windup = 0;
      e.t = P(e, 'fire', 1.7);
    }
  }
}

// --- Puppet Soldier: marching ranks that volley in unison (doc 04 FormationBehavior).
function formation(g: Game, e: Enemy, dt: number): void {
  const f = e.group >= 0 ? g.director.formations.get(e.group) : undefined;
  if (!f) {
    shooter(g, e, dt);
    return;
  }
  // slot target = formation center + perpendicular offset × slot
  const px = -f.dy, py = f.dx;
  const tx = f.x + px * e.tx * 46 - f.dx * e.ty * 46;
  const ty = f.y + py * e.tx * 46 - f.dy * e.ty * 46;
  const dx = tx - e.x, dy = ty - e.y;
  const l = Math.hypot(dx, dy);
  const sp = Math.min(e.speed * 1.6, l / dt) * g.slowFactor(e);
  if (l > 1) move(g, e, (dx / l) * sp, (dy / l) * sp, dt);
  else e.vx = e.vy = 0;
  e.face = f.dx >= 0 ? 1 : -1;
  e.windup = f.windup;
  if (f.fired && !e.n1) {
    e.n1 = 1;
    fireAt(g, e, g.rng.range(-0.06, 0.06));
  }
  if (!f.fired) e.n1 = 0;
  // Officer elite: calls in a fresh rank once.
  if (e.elite && e.n2 === 0 && e.spawnT > 6) {
    e.n2 = 1;
    g.director.spawnFormation(e.x - f.dx * 200, e.y - f.dy * 200, 4);
  }
}

// --- Walking Ticket Booth: plods; cha-chunk prints adds; sprays razor tickets in an arc.
function spawner(g: Game, e: Enemy, dt: number): void {
  seek(g, e, dt, e.state === 1 ? 0 : 1);
  e.t -= dt;
  e.t2 -= dt;
  if (e.n1 === 0) {
    e.n1 = 1;
    e.t = P(e, 'spawnEvery', 4.5) * g.rng.next();
    e.t2 = P(e, 'sprayEvery', 6.5) * (0.5 + g.rng.next());
  }
  if (e.state === 0 && e.t <= 0) {
    e.state = 1;
    e.n2 = 0.5;
    g.bus.emit('sfx', { id: 'chachunk', x: e.x, y: e.y, vol: 0.45 });
  }
  if (e.state === 1) {
    e.n2 -= dt;
    e.windup = 1 - e.n2 / 0.5;
    if (e.n2 <= 0) {
      const id = String(e.def.params.spawnEnemy ?? 'living_balloon');
      for (let i = 0; i < P(e, 'spawnCount', 2); i++) {
        const a = g.rng.angle();
        g.spawnEnemy(id, e.x + Math.cos(a) * 44, e.y + Math.sin(a) * 44);
      }
      g.fx.push('confetti', e.x, e.y - 20, 0.6);
      e.state = 0;
      e.windup = 0;
      e.t = P(e, 'spawnEvery', 4.5);
    }
  }
  if (e.t2 <= 0) {
    e.t2 = P(e, 'sprayEvery', 6.5);
    const base = Math.atan2(g.player.y - e.y, g.player.x - e.x);
    const n = P(e, 'sprayCount', 7);
    for (let i = 0; i < n; i++) {
      const a = base + (i / (n - 1) - 0.5) * 1.2;
      g.spawnBullet('ticket', e.x, e.y - 20, Math.cos(a) * 240, Math.sin(a) * 240, P(e, 'sprayDmg', 8) * g.diff.dmgMult * (1 + 0.04 * g.minutes), { life: 3, r: 6, spin: 10 });
    }
    g.bus.emit('sfx', { id: 'ticketspray', x: e.x, y: e.y, vol: 0.4 });
  }
}

// --- Jack-in-the-Box: creeps in, plays its tune, locks a target ring, leaps and pops.
function ambusher(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  switch (e.state) {
    case 0:
      seek(g, e, dt, 1);
      if (dist2(e.x, e.y, p.x, p.y) < P(e, 'armRange', 230) ** 2 && e.spawnT > 0.5) {
        e.state = 1;
        e.t = P(e, 'armTime', 1.4);
        g.bus.emit('sfx', { id: 'musicbox', x: e.x, y: e.y, vol: 0.5 });
      }
      break;
    case 1:
      e.vx = e.vy = 0;
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'armTime', 1.4);
      if (e.t <= 0.6 && e.n1 === 0) {
        e.n1 = 1;
        e.tx = p.x;
        e.ty = p.y;
        const blastR = P(e, 'blastR', 70);
        g.spawnHazard('circle', 'jack', e.tx, e.ty, {
          r: blastR, tele: 0.6 + P(e, 'leapTime', 0.45), active: 0.15, dmg: P(e, 'blast', 25) * g.diff.dmgMult, owner: e.uid,
        });
      }
      if (e.t <= 0) {
        e.state = 2;
        e.t = P(e, 'leapTime', 0.45);
        e.noContact = true;
        e.n2 = Math.hypot(e.tx - e.x, e.ty - e.y) / e.t;
        e.dirX = (e.tx - e.x) / (Math.hypot(e.tx - e.x, e.ty - e.y) || 1);
        e.dirY = (e.ty - e.y) / (Math.hypot(e.tx - e.x, e.ty - e.y) || 1);
        g.bus.emit('sfx', { id: 'boing', x: e.x, y: e.y, vol: 0.5 });
      }
      break;
    case 2:
      move(g, e, e.dirX * e.n2, e.dirY * e.n2, dt);
      e.t -= dt;
      e.windup = 1;
      if (e.t <= 0) {
        g.fx.push('explosion', e.x, e.y, P(e, 'blastR', 70), 0, 0, 'jack');
        g.fx.push('death', e.x, e.y, 1, 0, 0, 'springs');
        g.bus.emit('sfx', { id: 'pop', x: e.x, y: e.y, vol: 0.7 });
        g.despawnEnemy(e); // popped: gone, no tickets (dodge = no boom)
      }
      break;
  }
}

// --- Whack-a-Mole: travels underground (untargetable), pops up to swipe, re-burrows.
function popUp(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  e.t -= dt;
  switch (e.state) {
    case 0: // burrowing
      e.hidden = true;
      e.noSep = true;
      {
        const dx = p.x - e.x, dy = p.y - e.y;
        const l = Math.hypot(dx, dy) || 1;
        const sp = P(e, 'burrowSpeed', 190) * g.slowFactor(e);
        if (l > 40) move(g, e, (dx / l) * sp, (dy / l) * sp, dt);
      }
      if (e.n1 === 0) {
        e.n1 = 1;
        e.t = P(e, 'burrow', 1.6);
      }
      if (e.t <= 0) {
        e.state = 1;
        e.t = 0.3;
        g.fx.push('dust', e.x, e.y, 1);
        g.bus.emit('sfx', { id: 'dig', x: e.x, y: e.y, vol: 0.4 });
      }
      break;
    case 1: // emerging (still invulnerable)
      e.hidden = false;
      e.invuln = true;
      e.noContact = true;
      e.windup = 1 - e.t / 0.3;
      if (e.t <= 0) {
        e.state = 2;
        e.invuln = false;
        e.noContact = false;
        e.noSep = false;
        e.t = P(e, 'surface', 1.3);
        e.windup = 0;
      }
      break;
    case 2: // surfaced
      e.vx = e.vy = 0;
      if (e.t <= 0) {
        e.state = 0;
        e.n1 = 0;
        g.fx.push('dust', e.x, e.y, 0.7);
      }
      break;
  }
}

// --- Roller-Coaster Snake: telegraphs a screen-crossing rail, then the train rockets along it.
function railStrafer(g: Game, e: Enemy, dt: number): void {
  const p = g.player;
  e.leashExempt = true;
  e.noSep = true;
  const segs = P(e, 'segments', 9);
  switch (e.state) {
    case 0: { // resting off-screen
      e.hidden = true;
      e.noContact = true;
      e.t -= dt;
      if (e.n2 === 0) {
        e.n2 = 1;
        e.t = 0.6 + g.rng.next() * 1.2;
      }
      if (e.t <= 0) {
        const a = g.rng.angle();
        const dx = Math.cos(a), dy = Math.sin(a);
        const off = g.rng.range(-140, 140);
        const cx = p.x - dy * off, cy = p.y + dx * off;
        const L = 1300;
        e.tx = cx + dx * L;
        e.ty = cy + dy * L;
        e.x = e.px = cx - dx * L;
        e.y = e.py = cy - dy * L;
        e.dirX = dx;
        e.dirY = dy;
        e.n1 = 0; // distance travelled
        e.state = 1;
        e.t = P(e, 'telegraph', 1.1);
        g.spawnHazard('line', 'rail', e.x, e.y, { x2: e.tx, y2: e.ty, r2: e.r + 6, tele: e.t, active: 0.01, dmg: 0, owner: e.uid });
        g.bus.emit('sfx', { id: 'railwarn', x: cx, y: cy, vol: 0.6 });
      }
      break;
    }
    case 1: // telegraph
      e.t -= dt;
      e.windup = 1 - e.t / P(e, 'telegraph', 1.1);
      if (e.t <= 0) {
        e.state = 2;
        e.hidden = false;
        e.noContact = true; // contact via segment checks below
        e.windup = 0;
        g.bus.emit('sfx', { id: 'train', x: e.x, y: e.y, vol: 0.7 });
      }
      break;
    case 2: { // running
      const sp = P(e, 'railSpeed', 720);
      move(g, e, e.dirX * sp, e.dirY * sp, dt);
      e.n1 += sp * dt;
      // segment contact along the body
      const spacing = 30;
      const bodyLen = Math.min(e.n1, segs * spacing);
      const rr = e.r + p.r * 0.75;
      const ax = e.x, ay = e.y, bx = e.x - e.dirX * bodyLen, by = e.y - e.dirY * bodyLen;
      const abx = bx - ax, aby = by - ay;
      const len2 = abx * abx + aby * aby || 1;
      const t = clamp(((p.x - ax) * abx + (p.y - ay) * aby) / len2, 0, 1);
      const qx = ax + abx * t, qy = ay + aby * t;
      if (dist2(qx, qy, p.x, p.y) < rr * rr) g.hurtPlayer(e.dmg, qx, qy);
      if (e.n1 > 2600 + segs * spacing) {
        e.state = 0;
        e.n2 = 0;
        e.hidden = true;
      }
      break;
    }
  }
}

// --- Carnival Brute (miniboss): lumbering chase with a telegraphed double-fist ground slam.
function brute(g: Game, e: Enemy, dt: number): void {
  e.leashExempt = true;
  e.t -= dt;
  if (e.n1 === 0) {
    e.n1 = 1;
    e.t = P(e, 'slamEvery', 4.5);
  }
  if (e.state === 0) {
    seek(g, e, dt, 1);
    if (e.t <= 0 && dist2(e.x, e.y, g.player.x, g.player.y) < 420 * 420) {
      e.state = 1;
      e.t2 = P(e, 'slamTele', 0.95);
      g.spawnHazard('circle', 'brute_slam', e.x, e.y, { r: P(e, 'slamR', 120), tele: e.t2, active: 0.15, dmg: P(e, 'slamDmg', 18) * g.diff.dmgMult, owner: e.uid });
      g.bus.emit('sfx', { id: 'grunt', x: e.x, y: e.y, vol: 0.6 });
    } else if (e.t <= 0) e.t = 1;
  } else {
    e.vx = e.vy = 0;
    e.t2 -= dt;
    e.windup = 1 - e.t2 / P(e, 'slamTele', 0.95);
    if (e.t2 <= 0) {
      g.fx.push('ring', e.x, e.y, P(e, 'slamR', 120), 0, 0, 'shock');
      g.fx.push('shake', e.x, e.y, 0.4);
      g.bus.emit('sfx', { id: 'stomp', x: e.x, y: e.y, vol: 0.8 });
      e.state = 0;
      e.windup = 0;
      e.t = P(e, 'slamEvery', 4.5);
    }
  }
}

export const _internal = { TAU };
