// The guest's view of the world (D-52): a mirror Game that is never ticked. Snapshot deltas from the
// host are written into its pools slot for slot, so the existing renderer, HUD and audio run
// unchanged on the guest. Entities interpolate between the last two snapshots (render ~one snapshot
// behind); hazards extrapolate their own motion; cosmetic events replay locally. The guest's own
// character is predicted from local input and reconciled against the host's position for the last
// input it applied, with corrections eased out instead of snapped.

import { ENEMIES } from '../data/enemies';
import { BOSS_MAP } from '../data/bosses';
import { WEAPONS } from '../data/weapons';
import { createBoss } from '../sim/bosses';
import type { BossBase } from '../sim/bosses/boss';
import { BossPart, Enemy, EnemyBullet, Hazard, Pickup, PlayerProjectile, Summon, Zone, type BulletKind, type HazardShape, type PickupKind, type ProjKind, type SummonKind, type ZoneKind } from '../sim/entities';
import type { Game } from '../sim/game';
import { moveBody, steer } from '../sim/movement';
import { PlayerStats } from '../sim/stats';
import { WeaponInst } from '../sim/weapons';
import { TICK } from '../sim/constants';
import { StringDict } from './codec';
import { EF, ET, GF, PF, isPresent, type PoolSnap, type Snapshot } from './snapshot';

export interface PredInput { seq: number; mx: number; my: number }

type Movable = { alive: boolean; x: number; y: number; px: number; py: number };
type Slot = { alive: boolean; gen?: number };
/** Collapse interpolation for things that did not move this snapshot (pools without px/py skip it). */
const still = (o: Slot) => {
  if ('px' in o) {
    const m = o as unknown as Movable;
    m.px = m.x;
    m.py = m.y;
  }
};

export class Replica {
  readonly dict = new StringDict();
  last: Snapshot | null = null;
  /** ms timestamp of the latest snapshot and the smoothed interval between snapshots */
  lastAt = 0;
  interval = 50;
  received = 0;
  dropped = 0;
  /** the host's night is held although its phase says 'play' (pause, prize wheel, dropped partner) */
  frozen = false;
  private bosses = new Map<number, BossBase>();
  private bossState: Record<string, unknown>[] = [];
  /** boss state after each applied snapshot: the baselines the host's boss deltas refer to */
  private bossHist = new Map<number, Record<string, unknown>[]>();
  private baseStats: PlayerStats[];
  private passiveKey: string[] = [];
  private weaponKey: string[] = [];
  // prediction
  private hist: PredInput[] = [];
  private corrX = 0;
  private corrY = 0;
  /** the local character's position before the latest predicted step (for drawing between steps) */
  private prevX = 0;
  private prevY = 0;
  predErr = 0;
  private slowF = 1;

  constructor(readonly g: Game, readonly local: number) {
    g.setCtx(g.players[local]);
    this.prevX = g.players[local].x;
    this.prevY = g.players[local].y;
    // stats before any passive: base + meta perks (passives are re-applied from snapshots)
    this.baseStats = g.players.map((p) => Object.assign(new PlayerStats(), p.stats));
    // the mirror never simulates: clear anything its constructor spawned
    g.active.length = 0;
    for (const pool of [g.enemies, g.projs, g.bullets, g.pickups, g.hazards, g.zones, g.summons] as { alive: boolean }[][]) for (const o of pool) o.alive = false;
  }

  /** Interpolation factor for the renderer (0 = previous snapshot, 1 = latest). */
  alpha(now: number): number {
    // a late snapshot extrapolates a little rather than freezing the world
    return Math.min(1.15, Math.max(0, (now - this.lastAt) / Math.max(16, this.interval)));
  }

  apply(s: Snapshot, now: number): void {
    const g = this.g;
    if (this.last && s.seq <= this.last.seq) return; // stale / reordered
    if (this.last) {
      this.dropped += Math.max(0, s.seq - this.last.seq - 1);
      this.interval += (now - this.lastAt - this.interval) * 0.15;
    }
    // globals
    g.time = s.time;
    g.realTime = s.realTime;
    g.phase = s.phase;
    g.level = s.level;
    g.xp = s.xp;
    g.xpToNext = s.xpToNext;
    g.kills = s.kills;
    g.darkness = s.darkness;
    g.director.wind = s.wind;
    g.act = s.act;
    g.stalled = !!(s.flags & GF.stalled);
    g.victoryLap = !!(s.flags & GF.victoryLap);
    g.endless = !!(s.flags & GF.endless);
    g.finaleActive = !!(s.flags & GF.finaleActive);
    g.trueEnding = !!(s.flags & GF.trueEnding);
    g.ringmasterDefeated = !!(s.flags & GF.ringmasterDefeated);
    this.frozen = !!(s.flags & GF.frozen);
    g.tiltAngle = s.tilt;
    g.dawnT = s.dawnT;
    g.tickCount = s.tick;
    if (s.rarity) g.nextDraftRarity = s.rarity as typeof g.nextDraftRarity;
    this.applyPlayers(s);
    this.applyEnemies(s);
    applyPool(g.projs, s.projs, () => new PlayerProjectile(), (p, S, M, fresh) => {
      if (S) {
        p.gen = S.gen;
        p.kind = S.kind as ProjKind;
        p.owner = S.owner;
        p.r = S.r;
        p.area = S.area;
        p.arc = S.arc;
        p.tx = S.tx;
        p.ty = S.ty;
      }
      if (M) {
        setPos(p, M.x, M.y, fresh);
        p.vx = M.vx;
        p.vy = M.vy;
        p.rot = M.rot;
        p.maxLife = 1;
        p.life = M.life;
      }
    });
    applyPool(g.bullets, s.bullets, () => new EnemyBullet(), (b, S, M, fresh) => {
      if (S) {
        b.gen = S.gen;
        b.kind = S.kind as BulletKind;
        b.r = S.r;
        b.vx = S.vx;
        b.vy = S.vy;
      }
      if (M) {
        setPos(b, M.x, M.y, fresh);
        b.z = M.z;
        b.rot = M.rot;
      }
    });
    applyPool(g.pickups, s.pickups, () => new Pickup(), (p, S, M, fresh) => {
      if (S) {
        p.gen = S.gen;
        p.kind = S.kind as PickupKind;
        p.value = S.value;
        p.magnet = S.magnet;
      }
      if (M) setPos(p, M.x, M.y, fresh);
    });
    applyPool(g.hazards, s.hazards, () => new Hazard(), (h, S, M) => {
      if (S) {
        h.gen = S.gen;
        h.shape = S.shape as HazardShape;
        h.style = S.style;
        h.r2 = S.r2;
        h.half = S.half;
        h.teleMax = S.teleMax;
        h.activeMax = S.activeMax;
        h.dmg = S.flags & 1 ? 1 : 0;
        h.safe = !!(S.flags & 2);
        h.hitPlayer = !!(S.flags & 4);
        h.gapHalf = S.gapHalf;
        h.tag = S.tag;
        h.vx = S.vx;
        h.vy = S.vy;
        h.grow = S.grow;
        h.spinRate = S.spinRate;
        h.len = S.len;
        h.holeX = S.holeX;
        h.holeY = S.holeY;
        h.holeR = S.holeR;
        h.onActivate = null;
      }
      if (M) {
        h.x = M.x;
        h.y = M.y;
        h.x2 = M.x2;
        h.y2 = M.y2;
        h.r = M.r;
        h.angle = M.angle;
        h.tele = M.tele;
        h.active = M.active;
      }
    });
    applyPool(g.zones, s.zones, () => new Zone(), (z, S, M) => {
      if (S) {
        z.gen = S.gen;
        z.kind = S.kind as ZoneKind;
        z.r = S.r;
        z.harmful = S.harmful;
      }
      if (M) {
        z.x = M.x;
        z.y = M.y;
        z.maxLife = 1;
        z.life = M.life;
      }
    });
    applyPool(g.summons, s.summons, () => new Summon(), (m, S, M, fresh) => {
      if (S) {
        m.gen = S.gen;
        m.kind = S.kind as SummonKind;
        m.owner = S.owner;
        m.variant = S.variant;
      }
      if (M) {
        setPos(m, M.x, M.y, fresh);
        m.face = M.face;
        m.state = M.state;
      }
    });
    this.applyBosses(s);
    g.bossRemains = s.remains.map((r) => ({ ...r }));
    if (s.quest) {
      const ls = g.quests.get<{ stage: number; lit: boolean[]; souls: number[]; order: number[]; progress: number; rings: number; carrying: boolean } & import('../sim/quest').QuestChain>('last_song');
      if (ls) {
        ls.stage = s.quest.stage;
        ls.lit = s.quest.lit.slice();
        ls.souls = s.quest.souls.slice();
        ls.order = s.quest.order.slice();
        ls.progress = s.quest.progress;
        ls.rings = s.quest.rings;
        ls.carrying = s.quest.carrying;
      }
    }
    for (const e of s.fx) g.fx.push(e.type, e.x, e.y, e.a, e.b, e.c, e.style, e.text);
    for (const e of s.sfx) g.bus.emit('sfx', { id: e.id, x: e.x, y: e.y, vol: e.vol, pitch: e.pitch });
    // only a fully applied snapshot counts (it is what the guest acknowledges as its baseline)
    this.received++;
    this.last = s;
    this.lastAt = now;
  }

  private applyPlayers(s: Snapshot): void {
    const g = this.g;
    s.players.forEach((d, i) => {
      const p = g.players[i];
      if (!p) return;
      const isLocal = i === this.local;
      // arsenal and passives: rebuild only when they change
      const pk = d.passives.map((v) => `${v.id}:${v.level}`).join(',');
      if (pk !== this.passiveKey[i]) {
        this.passiveKey[i] = pk;
        p.stats = Object.assign(new PlayerStats(), this.baseStats[i]);
        p.passives.clear();
        for (const v of d.passives) for (let k = 0; k < v.level; k++) p.addPassive(v.id);
      }
      const wk = d.weapons.map((v) => `${v.id}:${v.level}`).join(',');
      if (wk !== this.weaponKey[i]) {
        this.weaponKey[i] = wk;
        p.weapons.list = d.weapons.filter((v) => WEAPONS[v.id]).map((v) => {
          const w = new WeaponInst(WEAPONS[v.id]);
          w.level = v.level;
          return w;
        });
      }
      d.weapons.forEach((v, k) => {
        const w = p.weapons.list[k];
        if (!w) return;
        w.active = v.active;
        w.angle = v.angle;
        w.cd = v.cd;
      });
      p.hp = d.hp;
      p.facing = d.facing;
      p.dead = !!(d.flags & PF.dead);
      p.downed = !!(d.flags & PF.downed);
      p.shieldReady = !!(d.flags & PF.shieldReady);
      p.reviveAssist = !!(d.flags & PF.reviveAssist);
      p.iframes = d.iframes;
      p.hurtFlash = d.hurtFlash;
      p.reviveT = d.reviveT;
      p.reviveFx = d.reviveFx;
      p.dashT = d.dashT;
      if (isLocal) {
        this.slowF = d.slowF;
        this.reconcile(d.x, d.y, d.vx, d.vy, s.ackInput, d.dashT > 0 || p.downed || p.dead);
        return;
      }
      p.px = p.x;
      p.py = p.y;
      p.x = d.x;
      p.y = d.y;
      p.vx = d.vx;
      p.vy = d.vy;
      p.faceX = d.faceX;
      p.faceY = d.faceY;
      p.moving = !!(d.flags & PF.moving);
      p.animT = d.animT;
    });
  }

  private applyEnemies(s: Snapshot): void {
    const g = this.g;
    applyPool(g.enemies, s.enemies, () => new Enemy(), (e, S, M, fresh, T) => {
      if (S) {
        const def = ENEMIES[S.def as keyof typeof ENEMIES];
        if (S.uid !== e.uid || !e.def) {
          fresh = true;
          e.animT = Math.random() * 3;
        }
        e.uid = S.uid;
        if (def) e.def = def;
        e.speed = def?.speed ?? 80;
        e.scale = S.scale;
        e.r = S.r;
        e.elite = !!(S.flags & EF.elite);
        e.hidden = !!(S.flags & EF.hidden);
        e.invuln = !!(S.flags & EF.invuln);
      }
      if (M) {
        setPos(e, M.x, M.y, fresh);
        e.vx = M.vx;
        e.vy = M.vy;
      }
      if (T) {
        e.frozenT = T.flags & ET.frozen ? 1 : 0;
        e.stickyT = T.flags & ET.sticky ? 1 : 0;
        e.burnT = T.flags & ET.burn ? 1 : 0;
        e.shield = T.flags & ET.shield ? 1 : 0;
        e.flash = T.flash;
        e.windup = T.windup;
        e.spawnT = T.spawnT;
        e.state = T.state;
        e.t = T.t;
        e.dirX = T.dirX;
        e.dirY = T.dirY;
      }
    });
    g.active.length = 0;
    for (const e of g.enemies) if (e.alive && e.def) g.active.push(e);
  }

  private applyBosses(s: Snapshot): void {
    const g = this.g;
    let changed = false;
    if (s.bosses) {
      this.bossState = s.bosses;
      changed = true;
    } else if (s.bossDelta) {
      const base = this.bossHist.get(s.bossDelta.base);
      if (base) {
        const byUid = new Map(base.map((b) => [b.uid as number, b]));
        this.bossState = s.bossDelta.uids.map((uid) => ({ ...(byUid.get(uid) ?? {}), ...(s.bossDelta!.d[uid] ?? {}) }));
        changed = true;
      }
      // (a missing baseline cannot happen for an acknowledged snapshot; if it ever does, keep the last state)
    }
    this.bossHist.set(s.seq, this.bossState);
    for (const k of this.bossHist.keys()) if (k < s.seq - 96) this.bossHist.delete(k);
    const seen = new Set<number>();
    for (const d of this.bossState) {
      const uid = d.uid as number;
      let b = this.bosses.get(uid);
      if (!b) {
        const def = BOSS_MAP[d.defId as keyof typeof BOSS_MAP];
        if (!def) continue;
        b = createBoss(g, def, { immediate: true, noChest: true });
        this.bosses.set(uid, b);
      }
      seen.add(uid);
      const prevX = b.x, prevY = b.y;
      if (changed) {
        for (const [k, v] of Object.entries(d)) {
          if (k === 'defId' || k === 'parts' || k === 'strings' || k === 'pose') continue;
          (b as unknown as Record<string, unknown>)[k] = v;
        }
        if (d.pose) b.pose = { ...(d.pose as Record<string, number>) };
        syncParts(b.parts, d.parts as Record<string, unknown>[]);
        const strings = (b as unknown as { strings?: BossPart[] }).strings;
        if (strings && Array.isArray(d.strings)) syncParts(strings, d.strings as Record<string, unknown>[]);
      }
      b.px = changed ? prevX : b.x;
      b.py = changed ? prevY : b.y;
    }
    for (const [uid] of this.bosses) if (!seen.has(uid)) this.bosses.delete(uid);
    g.bosses = [...this.bosses.values()];
  }

  // ------------------------------------------------------------------ per frame
  /** Advance local-only motion between snapshots (hazard drift, animation clocks, correction ease). */
  frame(dt: number): void {
    const g = this.g;
    for (const h of g.hazards) {
      if (!h.alive) continue;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.x2 += h.vx * dt;
      h.y2 += h.vy * dt;
      if (h.spinRate !== 0) {
        h.angle += h.spinRate * dt;
        if (h.shape === 'line' && h.len > 0) {
          h.x2 = h.x + Math.cos(h.angle) * h.len;
          h.y2 = h.y + Math.sin(h.angle) * h.len;
        }
      }
      if (h.tele > 0) h.tele = Math.max(0, h.tele - dt);
      else {
        if (h.grow !== 0) {
          h.r += h.grow * dt;
          if (h.shape === 'ring' || h.shape === 'annulus') h.r2 += h.grow * dt;
        }
        h.active = Math.max(0, h.active - dt);
      }
    }
    for (const e of g.active) e.animT += dt * (Math.hypot(e.vx, e.vy) > 6 ? 1 : 0.25);
    for (const m of g.summons) if (m.alive) m.animT += dt;
    // ease prediction corrections out over ~120 ms
    const k = Math.exp(-dt / 0.12);
    this.corrX *= k;
    this.corrY *= k;
  }

  // ------------------------------------------------------------------ prediction
  /** Advance the local character one fixed step from local input (and remember it for replay). */
  predict(seq: number, ix: number, iy: number): void {
    const p = this.g.players[this.local];
    if (!p) return;
    this.prevX = p.x;
    this.prevY = p.y;
    if (p.dead || p.downed || p.dashT > 0) return;
    this.hist.push({ seq, mx: ix, my: iy });
    if (this.hist.length > 240) this.hist.shift();
    this.step(ix, iy);
  }

  private step(ix: number, iy: number): void {
    const p = this.g.players[this.local];
    const [mx, my] = steer(p, ix, iy);
    moveBody(p, mx, my, p.stats.moveSpeed() * this.slowF, TICK, this.g.bosses, false);
    if (p.moving) p.animT += TICK * ((p.stats.moveSpeed() * this.slowF) / 220);
    else p.animT += TICK * 0.4;
  }

  private reconcile(x: number, y: number, vx: number, vy: number, ack: number, authoritative: boolean): void {
    const p = this.g.players[this.local];
    const oldX = p.x, oldY = p.y;
    while (this.hist.length && this.hist[0].seq <= ack) this.hist.shift();
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    if (!authoritative) for (const h of this.hist) this.step(h.mx, h.my);
    else this.hist.length = 0;
    // keep the picture continuous: shift the in-between point with the body and fold the jump into
    // a correction offset that eases out in frame()
    const dx = p.x - oldX, dy = p.y - oldY;
    this.prevX += dx;
    this.prevY += dy;
    this.corrX -= dx;
    this.corrY -= dy;
    this.predErr = Math.hypot(dx, dy);
    if (Math.hypot(this.corrX, this.corrY) > 160) this.corrX = this.corrY = 0; // teleports and big misses: snap
  }

  /** Where to draw the local character: between predicted steps (t = 0..1), plus the eased correction. */
  localDrawPos(t = 1): { x: number; y: number } {
    const p = this.g.players[this.local];
    return { x: this.prevX + (p.x - this.prevX) * t + this.corrX, y: this.prevY + (p.y - this.prevY) * t + this.corrY };
  }
}

function setPos(o: Movable, x: number, y: number, fresh: boolean): void {
  // a new spawn or a teleport must not streak across the screen
  if (fresh || Math.abs(x - o.x) > 260 || Math.abs(y - o.y) > 260) {
    o.px = x;
    o.py = y;
  } else {
    o.px = o.x;
    o.py = o.y;
  }
  o.x = x;
  o.y = y;
}

/**
 * Apply one pool's delta: write the parts that arrived, then mark presence from the bitmap. A slot
 * that is present without new motion stood still (its interpolation collapses to its position); a
 * slot whose spawn generation changed is a new spawn even if the guest never saw it die.
 */
function applyPool<O extends Slot, S extends object, M, T>(
  pool: O[],
  ps: PoolSnap<S, M, T>,
  make: () => O,
  set: (o: O, S: S | undefined, M: M | undefined, fresh: boolean, T: T | undefined) => void,
): void {
  const need = ps.present.length * 8;
  while (pool.length < need && pool.length < 4096) pool.push(make());
  const touched = new Uint8Array(pool.length);
  for (const r of ps.recs) {
    const o = pool[r.slot];
    if (!o) continue;
    const gen = (r.S as { gen?: number } | undefined)?.gen;
    const fresh = !o.alive || (gen !== undefined && gen !== o.gen);
    set(o, r.S, r.M, fresh, r.T);
    if (!r.M) still(o);
    o.alive = true;
    touched[r.slot] = 1;
  }
  for (let i = 0; i < pool.length; i++) {
    const o = pool[i];
    if (!isPresent(ps, i)) {
      o.alive = false;
      continue;
    }
    if (touched[i]) continue;
    o.alive = true;
    still(o);
  }
}

function syncParts(parts: BossPart[], rows: Record<string, unknown>[] | undefined): void {
  if (!rows) return;
  while (parts.length < rows.length) parts.push(new BossPart());
  rows.forEach((r, i) => Object.assign(parts[i], r));
  parts.length = rows.length;
}
