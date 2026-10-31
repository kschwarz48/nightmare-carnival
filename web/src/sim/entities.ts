// Pooled simulation entities. Plain classes with numeric fields — no per-tick allocation.

import type { EnemyDef, EliteAffix } from '../data/enemies';

/** Small ring buffer of (uid, time) pairs so a damage source doesn't re-hit the same target too soon. */
export class HitTracker {
  uids = new Int32Array(32);
  times = new Float32Array(32);
  n = 0;
  head = 0;
  reset(): void {
    this.n = 0;
    this.head = 0;
  }
  /** True if `uid` was hit within `cooldown` seconds before `now` (cooldown < 0 → ever). */
  recent(uid: number, now: number, cooldown: number): boolean {
    for (let i = 0; i < this.n; i++) {
      if (this.uids[i] === uid) {
        if (cooldown < 0) return true;
        return now - this.times[i] < cooldown;
      }
    }
    return false;
  }
  mark(uid: number, now: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.uids[i] === uid) {
        this.times[i] = now;
        return;
      }
    }
    if (this.n < 32) {
      this.uids[this.n] = uid;
      this.times[this.n] = now;
      this.n++;
    } else {
      this.uids[this.head] = uid;
      this.times[this.head] = now;
      this.head = (this.head + 1) % 32;
    }
  }
}

/** Anything a player weapon can damage: enemies and boss parts. */
export interface Target {
  uid: number;
  x: number;
  y: number;
  r: number;
  alive: boolean;
  isBoss: boolean;
}

export class Enemy implements Target {
  idx = 0;
  uid = 0;
  alive = false;
  inActive = false; // still referenced by Game.active (can't be recycled until cleaned up)
  isBoss = false;
  def!: EnemyDef;
  x = 0;
  y = 0;
  px = 0; // previous position (render interpolation)
  py = 0;
  vx = 0;
  vy = 0;
  r = 10;
  hp = 1;
  maxHp = 1;
  dmg = 1;
  speed = 1;
  tickets = 1;
  elite = false;
  affixes: EliteAffix[] = [];
  shield = 0;
  // behaviour state
  state = 0;
  t = 0;
  t2 = 0;
  dirX = 1;
  dirY = 0;
  tx = 0;
  ty = 0;
  n1 = 0;
  n2 = 0;
  group = -1; // formation id
  hidden = false; // burrowed etc. — untargetable, no contact
  invuln = false;
  noContact = false;
  /** a Reflection Thief's decoy (D-63): harmless, dies to any hit, drops nothing */
  illusion = false;
  /** the thief that made this decoy (its uid) */
  illusionOf = -1;
  /** the Boardwalk (D-68): seconds left of climbing up out of the sand or the surf (no contact while rising) */
  emerge = 0;
  /** raw damage its shell will still soak before it cracks; whether it has */
  shellLeft = 0;
  cracked = false;
  /** tickets a Prize Collector has swallowed off the ground (paid back when it falls) */
  loot = 0;
  noSep = false;
  leashExempt = false;
  // knockback
  kbT = 0;
  kbX = 0;
  kbY = 0;
  // statuses
  slowT = 0;
  slowF = 1;
  chill = 0;
  chillT = 0;
  frozenT = 0;
  burnT = 0;
  burnDps = 0;
  burnAcc = 0;
  stickyT = 0;
  stickyDps = 0;
  // presentation
  flash = 0;
  face = 1; // -1 left, 1 right
  animT = 0;
  spawnT = 0; // seconds since spawn
  windup = 0; // 0..1 telegraph intensity for renderer
  scale = 1;
  // segments for the roller-coaster snake (trail of previous head positions)
  trail: Float32Array | null = null;
  trailHead = 0;
}

export type ProjKind =
  | 'card' | 'gold_card' | 'tarot' | 'death_card' | 'dart' | 'shrapnel' | 'ring' | 'rocket' | 'shell' | 'kernel'
  | 'cannonball' | 'derby_car' | 'bumper_ghost' | 'mirror_shot' | 'note';

export class PlayerProjectile {
  alive = false;
  /** spawn generation: bumps each time the slot is reused (lets replication tell a new spawn from motion) */
  gen = 0;
  /** Index of the player whose weapon fired it. */
  owner = 0;
  kind: ProjKind = 'card';
  weapon = '';
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  r = 8;
  dmg = 1;
  crit = 0; // bonus crit chance
  critMult = 2;
  pierce = 0;
  life = 1;
  maxLife = 1;
  kb = 1;
  hits = new HitTracker();
  rehit = -1; // seconds before same target can be hit again (-1: never)
  // kind-specific
  homing = 0; // turn rate (rad/s)
  target = -1; // enemy uid
  ox = 0; // origin / return point
  oy = 0;
  tx = 0; // lob target
  ty = 0;
  arc = 0; // lob height
  area = 1;
  spin = 0;
  rot = 0;
  returning = false;
  bounces = 0;
  mult = 1; // mirror damage multiplier
  flag = 0;
}

export type BulletKind = 'pie' | 'musket' | 'ticket' | 'popcorn' | 'spiral' | 'spark' | 'bolt' | 'ring' | 'hellfire' | 'star' | 'crown' | 'spoke' | 'gondola' | 'kernel_big' | 'note' | 'pin' | 'shard' | 'stub' | 'coin' | 'car' | 'page';

export class EnemyBullet {
  alive = false;
  /** spawn generation: bumps each time the slot is reused (lets replication tell a new spawn from motion) */
  gen = 0;
  kind: BulletKind = 'pie';
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  ax = 0; // acceleration
  ay = 0;
  r = 7;
  dmg = 8;
  life = 4;
  maxLife = 4;
  rot = 0;
  spin = 0;
  bounce = 0; // remaining bounces off arena bounds
  z = 0; // lob height (visual) — damage only when z small
  vz = 0;
  grav = 0;
  turn = 0; // curving bullets (rad/s)
  homing = 0;
  returnAt = -1; // boomerang: reverse after this many seconds
  ox = 0;
  oy = 0;
  onLand: 0 | 1 = 0; // 1 → spawn crater hazard on landing
}

export type HazardShape = 'circle' | 'ring' | 'line' | 'rect' | 'sector' | 'annulus';

/**
 * A telegraphed enemy attack zone (boss attacks, traps, events). Telegraph first (danger-colour,
 * no damage), then active for `active` seconds dealing `dmg` on contact (once or per tick).
 */
export class Hazard {
  alive = false;
  /** spawn generation: bumps each time the slot is reused (lets replication tell a new spawn from motion) */
  gen = 0;
  shape: HazardShape = 'circle';
  style = 'stomp';
  x = 0;
  y = 0;
  x2 = 0;
  y2 = 0;
  r = 50;
  r2 = 0; // inner radius (ring/annulus) or line half-width
  angle = 0;
  half = 0; // sector half angle
  tele = 1;
  teleMax = 1;
  active = 0.15;
  activeMax = 0.15;
  dmg = 10;
  tick = 0; // 0 = hit once; >0 = repeat interval
  tickAcc = 0;
  hitPlayer = false;
  /** Players already struck by a one-shot hazard (bit per player index). */
  hitMask = 0;
  // motion
  vx = 0;
  vy = 0;
  grow = 0; // radius growth / s (rings)
  spinRate = 0; // rotation / s (lines about x,y)
  len = 0; // line length (rotating lines)
  pull = 0; // pull strength toward (x,y) on player
  pullR = 0; // pull reach (0 = four times the radius)
  slow = 0;
  burn = 0;
  owner = 0; // boss uid (cleared when boss dies)
  t = 0; // age
  onActivate: (() => void) | null = null;
  followPlayer = 0; // spotlight tracking speed
  safe = false; // visual-only marker (e.g. safe pocket)
  gapHalf = 0; // ring hazards: half-angle of the safe gap centred on `angle`
  /** Optional safe hole (e.g. the Calliope's Lamp Crescendo): no damage inside it. */
  holeX = 0;
  holeY = 0;
  holeR = 0;
  /** Free-form tag for renderers (lamp symbol index, etc.). */
  tag = -1;
}

export type PickupKind = 'ticket' | 'bank' | 'food' | 'golden' | 'chest' | 'funnel';

export class Pickup {
  alive = false;
  /** spawn generation: bumps each time the slot is reused (lets replication tell a new spawn from motion) */
  gen = 0;
  kind: PickupKind = 'ticket';
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  value = 1;
  magnet = false;
  speed = 0;
  life = 0;
  t = 0;
  rolls = 0;
  /** Where a chest came from (boss / brute / elite / event) — drives the prize-wheel presentation. */
  src = '';
  vx = 0;
  vy = 0;
}

export type ZoneKind = 'web' | 'burn' | 'spark' | 'sticky_patch' | 'grease' | 'ice';

/** Persistent player-side damage areas (webs, burning ground, spark trail). */
export class Zone {
  alive = false;
  /** spawn generation: bumps each time the slot is reused (lets replication tell a new spawn from motion) */
  gen = 0;
  kind: ZoneKind = 'web';
  x = 0;
  y = 0;
  r = 50;
  life = 1;
  maxLife = 1;
  dmg = 1;
  tick = 0.5;
  tickAcc = 0;
  slow = 0;
  harmful = false; // true → hurts the player (enemy sticky patches)
}

export type SummonKind = 'plush' | 'rabbit' | 'dove' | 'lion' | 'elephant' | 'acrobat' | 'clone' | 'derby_ghost';

export class Summon {
  alive = false;
  /** spawn generation: bumps each time the slot is reused (lets replication tell a new spawn from motion) */
  gen = 0;
  /** Index of the player whose weapon summoned it. */
  owner = 0;
  kind: SummonKind = 'plush';
  weapon = '';
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  state = 0;
  t = 0;
  cd = 0;
  life = 0;
  slot = 0;
  target = -1;
  tx = 0;
  ty = 0;
  face = 1;
  animT = 0;
  hits = new HitTracker();
  variant = 0;
}

export class BossPart implements Target {
  uid = 0;
  x = 0;
  y = 0;
  r = 40;
  alive = true;
  isBoss = true;
  hp = 0; // >0 → sub-target with its own HP (puppet strings)
  maxHp = 0;
  invuln = false;
  kind = 'body';
  flash = 0;
  index = 0;
}
