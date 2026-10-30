// World snapshots (D-52): the host's authoritative state, packed for the unreliable channel at
// ~20 Hz and delta-compressed against the newest snapshot the guest has acknowledged.
//
// Every pooled entity is split into parts — static (identity, kind, size), motion (position,
// velocity) and, for enemies, state (flash, wind-up, status) — and a part is sent only while the
// guest may not have its current bytes (changed after the guest's last ack). A presence bitmap says
// which slots exist this snapshot, so a ticket lying still costs one bit, a walking stuffie its
// position, and a lost snapshot never loses anything (unacknowledged parts are simply sent again).
//
// Interest management: enemies within a wide ring of the guest's view (so anything walking in already
// has a history to interpolate from), projectiles, bullets, pickups, zones and cosmetic events near
// it; players, hazards, summons, bosses and the quest always. Positions are quarter-unit i16,
// fractions bytes, strings dictionary ids (codec.ts).

import type { Game } from '../sim/game';
import type { FxEvent, FxType } from '../sim/fx';
import type { BossBase } from '../sim/bosses/boss';
import type { Enemy, EnemyBullet, Hazard, Pickup, PlayerProjectile, Summon, Zone } from '../sim/entities';
import { Reader, StringDict, Writer } from './codec';

/** First byte of every snapshot (the binary message type; the format itself is versioned by PROTO). */
export const SNAP = 1;
export const PHASES = ['play', 'draft', 'dawn', 'ended'] as const;

export interface View { x: number; y: number; hx: number; hy: number }
export interface SfxEvt { id: string; x?: number; y?: number; vol?: number; pitch?: number }

export interface PlayerSnap {
  x: number; y: number; vx: number; vy: number; hp: number; maxHp: number;
  faceX: number; faceY: number; facing: number; flags: number;
  iframes: number; hurtFlash: number; reviveT: number; reviveFx: number; animT: number; slowF: number; dashT: number;
  weapons: { id: string; level: number; active: boolean; angle: number; cd: number }[];
  passives: { id: string; level: number }[];
}

export interface EnemyS { uid: number; def: string; scale: number; r: number; flags: number }
export interface EnemyM { x: number; y: number; vx: number; vy: number }
export interface EnemyT { flags: number; flash: number; windup: number; spawnT: number; state: number; t: number; dirX: number; dirY: number }
export interface ProjS { gen: number; kind: string; owner: number; r: number; area: number; arc: number; tx: number; ty: number }
export interface ProjM { x: number; y: number; vx: number; vy: number; rot: number; life: number }
export interface BulletS { gen: number; kind: string; r: number; vx: number; vy: number }
export interface BulletM { x: number; y: number; z: number; rot: number }
export interface PickupS { gen: number; kind: string; value: number; magnet: boolean }
export interface PickupM { x: number; y: number }
export interface HazardS {
  gen: number; shape: string; style: string; r2: number; half: number; teleMax: number; activeMax: number; flags: number; gapHalf: number; tag: number;
  vx: number; vy: number; grow: number; spinRate: number; len: number; holeX: number; holeY: number; holeR: number;
}
export interface HazardM { x: number; y: number; x2: number; y2: number; r: number; angle: number; tele: number; active: number }
export interface ZoneS { gen: number; kind: string; r: number; harmful: boolean }
export interface ZoneM { x: number; y: number; life: number }
export interface SummonS { gen: number; kind: string; owner: number; variant: number }
export interface SummonM { x: number; y: number; face: number; state: number }

/** One pool's delta: which slots exist, and the parts the guest may be missing. */
export interface PoolSnap<S, M, T = never> {
  present: Uint8Array;
  recs: { slot: number; S?: S; M?: M; T?: T }[];
}
export const isPresent = (p: { present: Uint8Array }, slot: number) => slot >> 3 < p.present.length && (p.present[slot >> 3] & (1 << (slot & 7))) !== 0;
export const presentCount = (p: { present: Uint8Array }) => {
  let n = 0;
  for (const b of p.present) for (let v = b; v; v &= v - 1) n++;
  return n;
};

export interface BossDelta { base: number; uids: number[]; d: Record<string, Record<string, unknown>> }

export interface QuestSnap { stage: number; lit: boolean[]; souls: number[]; order: number[]; progress: number; rings: number; carrying: boolean }

export interface Snapshot {
  seq: number; tick: number; ackInput: number;
  time: number; realTime: number; phase: (typeof PHASES)[number]; level: number; xp: number; xpToNext: number; kills: number;
  darkness: number; wind: number; act: number; flags: number; tilt: number; dawnT: number; rarity: string;
  players: PlayerSnap[];
  enemies: PoolSnap<EnemyS, EnemyM, EnemyT>;
  projs: PoolSnap<ProjS, ProjM>;
  bullets: PoolSnap<BulletS, BulletM>;
  pickups: PoolSnap<PickupS, PickupM>;
  hazards: PoolSnap<HazardS, HazardM>;
  zones: PoolSnap<ZoneS, ZoneM>;
  summons: PoolSnap<SummonS, SummonM>;
  /** full boss state; null when only a delta was sent (see `bossDelta`) */
  bosses: Record<string, unknown>[] | null;
  /** keys that changed since the guest's acknowledged snapshot `base`, per boss uid (in order `uids`) */
  bossDelta: BossDelta | null;
  remains: { id: string; x: number; y: number }[];
  quest: QuestSnap | null; fx: FxEvent[]; sfx: SfxEvt[];
}

/** Game-wide flags packed in one byte. */
export const GF = { stalled: 1, victoryLap: 2, endless: 4, finaleActive: 8, trueEnding: 16, ringmasterDefeated: 32, frozen: 64 };
/** Player flags. */
export const PF = { moving: 1, dead: 2, downed: 4, shieldReady: 8, reviveAssist: 16 };
/** Enemy flags: identity (static part) and status (state part). */
export const EF = { elite: 1, hidden: 2, invuln: 4 };
export const ET = { frozen: 1, sticky: 2, burn: 4, shield: 8 };

const inside = (v: View, x: number, y: number, k: number) => Math.abs(x - v.x) < v.hx * k && Math.abs(y - v.y) < v.hy * k;

// ------------------------------------------------------------------------------------- bosses
/** Fields of a boss object that never go over the wire (machinery, back-references). */
const BOSS_SKIP = new Set(['g', 'def', 'co', 'attackCo', 'body', 'parts', 'strings', 'script', 'scripts', 'queue']);

/** Bosses are few and irregular: a reflective JSON of their primitive state, pose, parts and small arrays. */
export function bossToJson(b: BossBase): Record<string, unknown> {
  const out: Record<string, unknown> = { defId: b.def.id };
  for (const k of Object.keys(b)) {
    if (BOSS_SKIP.has(k)) continue;
    const v = (b as unknown as Record<string, unknown>)[k];
    const t = typeof v;
    if (t === 'number') out[k] = Math.round((v as number) * 1000) / 1000;
    else if (t === 'boolean' || t === 'string') out[k] = v;
    else if (Array.isArray(v) && v.length <= 32 && v.every((x) => typeof x === 'number')) out[k] = v;
    else if (k === 'pose' && v && t === 'object') out[k] = v;
  }
  const part = (p: { x: number; y: number; r: number; hp: number; maxHp: number; invuln: boolean; kind: string; flash: number; index: number; alive: boolean; uid: number }) =>
    ({ x: p.x, y: p.y, r: p.r, hp: p.hp, maxHp: p.maxHp, invuln: p.invuln, kind: p.kind, flash: p.flash, index: p.index, alive: p.alive, uid: p.uid });
  out.parts = b.parts.map(part);
  const strings = (b as unknown as { strings?: unknown[] }).strings;
  if (Array.isArray(strings)) out.strings = strings.map((s) => part(s as Parameters<typeof part>[0]));
  return out;
}

// ------------------------------------------------------------------------------------- pools
type PartWriter<E> = (w: Writer, e: E, d: StringDict) => void;
interface Pool<E> {
  list: (g: Game) => E[];
  present: (e: E, v: View) => boolean;
  parts: PartWriter<E>[];
}

const POOLS = {
  enemies: {
    list: (g) => g.enemies,
    present: (e, v) => e.alive && inside(v, e.x, e.y, 1.9),
    parts: [
      (w, e, d) => {
        w.u16(e.uid & 0xffff);
        w.u16(d.id(e.def.id));
        w.u8(Math.min(255, e.scale * 64));
        w.u8(Math.min(255, e.r));
        w.u8((e.elite ? EF.elite : 0) | (e.hidden ? EF.hidden : 0) | (e.invuln ? EF.invuln : 0));
      },
      (w, e) => {
        w.pos(e.x);
        w.pos(e.y);
        w.i8(e.vx / 4);
        w.i8(e.vy / 4);
      },
      (w, e) => {
        w.u8((e.frozenT > 0 ? ET.frozen : 0) | (e.stickyT > 0 ? ET.sticky : 0) | (e.burnT > 0 ? ET.burn : 0) | (e.shield > 0 ? ET.shield : 0));
        w.frac(e.flash);
        w.frac(e.windup);
        w.u8(Math.min(255, e.spawnT * 100));
        w.u8(e.state);
        w.u8(Math.min(255, Math.max(0, e.t) * 100));
        w.i8(e.dirX * 127);
        w.i8(e.dirY * 127);
      },
    ],
  } as Pool<Enemy>,
  projs: {
    list: (g) => g.projs,
    present: (p, v) => p.alive && inside(v, p.x, p.y, 1.3),
    parts: [
      (w, p, d) => {
        w.u8(p.gen);
        w.u16(d.id(p.kind));
        w.u8(p.owner);
        w.u8(Math.min(255, p.r));
        w.u8(Math.min(255, p.area * 32));
        w.u8(Math.min(255, p.arc));
        w.pos(p.tx);
        w.pos(p.ty);
      },
      (w, p) => {
        w.pos(p.x);
        w.pos(p.y);
        w.i8(p.vx / 8);
        w.i8(p.vy / 8);
        w.i16(p.rot * 1000);
        w.frac(p.maxLife > 0 ? p.life / p.maxLife : 0);
      },
    ],
  } as Pool<PlayerProjectile>,
  bullets: {
    list: (g) => g.bullets,
    present: (b, v) => b.alive && inside(v, b.x, b.y, 1.3),
    parts: [
      (w, b, d) => {
        w.u8(b.gen);
        w.u16(d.id(b.kind));
        w.u8(Math.min(255, b.r));
        w.i8(b.vx / 8);
        w.i8(b.vy / 8);
      },
      (w, b) => {
        w.pos(b.x);
        w.pos(b.y);
        w.u8(Math.min(255, Math.max(0, b.z)));
        w.i16(b.rot * 1000);
      },
    ],
  } as Pool<EnemyBullet>,
  pickups: {
    list: (g) => g.pickups,
    present: (p, v) => p.alive && inside(v, p.x, p.y, 1.25),
    parts: [
      (w, p, d) => {
        w.u8(p.gen);
        w.u16(d.id(p.kind));
        w.u16(p.value);
        w.u8(p.magnet ? 1 : 0);
      },
      (w, p) => {
        w.pos(p.x);
        w.pos(p.y);
      },
    ],
  } as Pool<Pickup>,
  hazards: {
    list: (g) => g.hazards,
    present: (h) => h.alive,
    parts: [
      (w, h, d) => {
        w.u8(h.gen);
        w.u16(d.id(h.shape));
        w.u16(d.id(h.style));
        w.i16(h.r2 * 4);
        w.u16(h.half * 1000);
        w.u16(h.teleMax * 1000);
        w.u16(Math.min(65, h.activeMax) * 1000);
        w.u8((h.dmg > 0 ? 1 : 0) | (h.safe ? 2 : 0) | (h.hitPlayer ? 4 : 0));
        w.u16(h.gapHalf * 1000);
        w.i8(h.tag);
        w.i16(h.vx);
        w.i16(h.vy);
        w.i16(h.grow);
        w.i16(h.spinRate * 1000);
        w.u16(h.len * 4);
        w.pos(h.holeX);
        w.pos(h.holeY);
        w.u16(h.holeR * 4);
      },
      (w, h) => {
        w.pos(h.x);
        w.pos(h.y);
        w.pos(h.x2);
        w.pos(h.y2);
        w.u16(Math.max(0, h.r) * 4);
        w.i16(h.angle * 1000);
        w.u16(Math.max(0, h.tele) * 1000);
        w.u16(Math.max(0, h.active) * 1000);
      },
    ],
  } as Pool<Hazard>,
  zones: {
    list: (g) => g.zones,
    present: (z, v) => z.alive && inside(v, z.x, z.y, 1.4),
    parts: [
      (w, z, d) => {
        w.u8(z.gen);
        w.u16(d.id(z.kind));
        w.u16(z.r * 4);
        w.u8(z.harmful ? 1 : 0);
      },
      (w, z) => {
        w.pos(z.x);
        w.pos(z.y);
        w.frac(z.maxLife > 0 ? z.life / z.maxLife : 0);
      },
    ],
  } as Pool<Zone>,
  summons: {
    list: (g) => g.summons,
    present: (s) => s.alive,
    parts: [
      (w, s, d) => {
        w.u8(s.gen);
        w.u16(d.id(s.kind));
        w.u8(s.owner);
        w.u8(s.variant);
      },
      (w, s) => {
        w.pos(s.x);
        w.pos(s.y);
        w.i8(s.face);
        w.u8(s.state);
      },
    ],
  } as Pool<Summon>,
};
type PoolName = keyof typeof POOLS;
const POOL_ORDER: PoolName[] = ['enemies', 'projs', 'bullets', 'pickups', 'hazards', 'zones', 'summons'];

function sameBytes(a: Uint8Array | undefined, b: Uint8Array): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ------------------------------------------------------------------------------------- encode
export interface EncodeCtx {
  seq: number;
  ackInput: number;
  /** newest snapshot the guest has acknowledged (0 = none: send everything) */
  ackSnap: number;
  dict: StringDict;
  /** First dictionary entry the receiver may lack. */
  dictFrom: number;
  view: View;
  fx: FxEvent[];
  sfx: SfxEvt[];
  /** the host's night is held (a pause, a prize wheel still showing, a dropped partner) */
  frozen?: boolean;
}

/**
 * Encodes snapshots for one receiver. It remembers the bytes of every part it has sent and when they
 * last changed, so each snapshot carries only what the receiver may not have. One encoder per guest
 * per run (a reconnecting guest gets a fresh encoder and therefore a full first snapshot).
 */
export class SnapshotEncoder {
  private sent = new Map<PoolName, (Uint8Array | undefined)[][]>();
  private changed = new Map<PoolName, number[][]>();
  private scratch = new Writer(256);
  private w = new Writer(32768);
  /** per snapshot seq: per boss uid, each top-level key's JSON (the baselines for boss deltas) */
  private bossHist = new Map<number, Map<number, Record<string, string>>>();
  /** bytes per section of the last snapshot (diagnostics) */
  readonly sizes: Record<string, number> = {};

  encode(g: Game, c: EncodeCtx): ArrayBuffer {
    const w = this.w;
    const d = c.dict;
    const v = c.view;
    w.reset();
    w.u8(SNAP);
    w.u32(c.seq);
    w.u32(g.tickCount);
    w.u32(c.ackInput);
    // globals
    w.f32(g.time);
    w.f32(g.realTime);
    w.u8(Math.max(0, PHASES.indexOf(g.phase as never)));
    w.u16(g.level);
    w.f32(g.xp);
    w.f32(g.xpToNext);
    w.u32(g.kills);
    w.frac(g.darkness);
    w.f32(g.director.wind);
    w.u8(g.act);
    w.u8((g.stalled ? GF.stalled : 0) | (g.victoryLap ? GF.victoryLap : 0) | (g.endless ? GF.endless : 0) | (g.finaleActive ? GF.finaleActive : 0) | (g.trueEnding ? GF.trueEnding : 0) | (g.ringmasterDefeated ? GF.ringmasterDefeated : 0) | (c.frozen ? GF.frozen : 0));
    w.f32(g.tiltAngle);
    w.f32(g.dawnT);
    w.u16(d.id(g.nextDraftRarity));
    let mark = w.o;
    this.players(g, w, d);
    this.sizes.players = w.o - mark;
    for (const name of POOL_ORDER) {
      mark = w.o;
      this.pool(name, g, w, d, v, c.seq, c.ackSnap);
      this.sizes[name] = w.o - mark;
    }
    // bosses: reflective JSON, as the keys that changed since the guest's acknowledged snapshot
    // (idle bosses still breathe, so a dormant Tent costs a few numbers instead of 700 bytes)
    mark = w.o;
    this.bosses(g, w, c.seq, c.ackSnap);
    this.sizes.bosses = w.o - mark;
    w.u8(Math.min(16, g.bossRemains.length));
    for (const rm of g.bossRemains.slice(0, 16)) {
      w.u16(d.id(rm.id));
      w.pos(rm.x);
      w.pos(rm.y);
    }
    // the Last Song's shared state
    const ls = g.quests.get<{ stage: number; lit: boolean[]; souls: number[]; order: number[]; progress: number; rings: number; carrying: boolean } & import('../sim/quest').QuestChain>('last_song');
    w.u8(ls ? 1 : 0);
    if (ls) {
      w.u8(ls.stage);
      w.u8(ls.lit.reduce((m, b, i) => m | (b ? 1 << i : 0), 0));
      for (let i = 0; i < 4; i++) w.u8(ls.souls[i] ?? 0);
      w.u8(ls.order.reduce((m, o, i) => m | ((o & 3) << (i * 2)), 0));
      w.u8(ls.progress);
      w.u8(ls.rings);
      w.u8(ls.carrying ? 1 : 0);
    }
    // cosmetic events near the view (capped; a lost snapshot just loses a few sparks)
    mark = w.o;
    const fx = c.fx.filter((e) => e.type === 'shake' || e.type === 'flash' || inside(v, e.x, e.y, 1.3)).slice(-160);
    w.u16(fx.length);
    for (const e of fx) {
      w.u16(d.id(e.type));
      w.pos(e.x);
      w.pos(e.y);
      const m = (e.a ? 1 : 0) | (e.b ? 2 : 0) | (e.c ? 4 : 0) | (e.style ? 8 : 0) | (e.text ? 16 : 0);
      w.u8(m);
      if (m & 1) w.f32(e.a);
      if (m & 2) w.f32(e.b);
      if (m & 4) w.f32(e.c);
      if (m & 8) w.u16(d.id(e.style));
      if (m & 16) w.u16(d.id(e.text));
    }
    const sfx = c.sfx.filter((e) => e.x === undefined || inside(v, e.x, e.y ?? v.y, 1.5)).slice(-28);
    w.u8(sfx.length);
    for (const e of sfx) {
      w.u16(d.id(e.id));
      w.u8(e.x === undefined ? 0 : 1);
      if (e.x !== undefined) {
        w.pos(e.x);
        w.pos(e.y ?? 0);
      }
      w.u8(Math.min(255, (e.vol ?? 1) * 100));
      w.u8(Math.min(255, (e.pitch ?? 1) * 100));
    }
    this.sizes.fx = w.o - mark;
    // dictionary entries the receiver has not acknowledged (written last: ids above may be new)
    d.writeFrom(w, c.dictFrom);
    return w.done();
  }

  private bosses(g: Game, w: Writer, seq: number, ack: number): void {
    if (!g.bosses.length) {
      w.u8(0);
      this.bossHist.set(seq, new Map());
      this.trimBossHist(seq);
      return;
    }
    const objs = g.bosses.map(bossToJson);
    const cur = new Map<number, Record<string, string>>();
    for (const o of objs) {
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(o)) flat[k] = JSON.stringify(v);
      cur.set(o.uid as number, flat);
    }
    const base = ack > 0 ? this.bossHist.get(ack) : undefined;
    if (!base) {
      w.u8(2);
      w.text(JSON.stringify(objs));
    } else {
      const d: Record<string, Record<string, unknown>> = {};
      for (const [uid, flat] of cur) {
        const b = base.get(uid);
        const diff: Record<string, unknown> = {};
        let n = 0;
        for (const [k, js] of Object.entries(flat)) {
          if (b && b[k] === js) continue;
          diff[k] = JSON.parse(js);
          n++;
        }
        if (n) d[uid] = diff;
      }
      w.u8(3);
      w.u32(ack);
      w.text(JSON.stringify({ u: [...cur.keys()], d }));
    }
    this.bossHist.set(seq, cur);
    this.trimBossHist(seq);
  }

  private trimBossHist(seq: number): void {
    for (const k of this.bossHist.keys()) if (k < seq - 96) this.bossHist.delete(k);
  }

  private players(g: Game, w: Writer, d: StringDict): void {
    w.u8(g.players.length);
    for (const p of g.players) {
      w.f32(p.x);
      w.f32(p.y);
      w.i16(p.vx);
      w.i16(p.vy);
      w.u16(Math.max(0, p.hp) * 10);
      w.u16(p.stats.maxHp() * 10);
      w.i8(p.faceX * 127);
      w.i8(p.faceY * 127);
      w.i8(p.facing);
      w.u8((p.moving ? PF.moving : 0) | (p.dead ? PF.dead : 0) | (p.downed ? PF.downed : 0) | (p.shieldReady ? PF.shieldReady : 0) | (p.reviveAssist ? PF.reviveAssist : 0));
      w.u8(Math.min(255, p.iframes * 50));
      w.u8(Math.min(255, p.hurtFlash * 255));
      w.frac(p.reviveT);
      w.u8(Math.min(255, p.reviveFx * 100));
      w.f32(p.animT);
      w.frac(p.slowT > 0 ? p.slowF : 1);
      w.u8(Math.min(255, p.dashT * 100));
      w.u8(p.weapons.list.length);
      for (const wi of p.weapons.list) {
        w.u16(d.id(wi.def.id));
        w.u8(wi.level);
        w.u8(wi.active ? 1 : 0);
        w.f32(wi.angle);
        w.u8(Math.min(255, Math.max(0, wi.cd) * 50));
      }
      w.u8(p.passives.size);
      for (const [id, lvl] of p.passives) {
        w.u16(d.id(id));
        w.u8(lvl);
      }
    }
  }

  private pool<E>(name: PoolName, g: Game, w: Writer, d: StringDict, v: View, seq: number, ack: number): void {
    const P = POOLS[name] as unknown as Pool<E>;
    const list = P.list(g);
    const nParts = P.parts.length;
    let sent = this.sent.get(name);
    let changed = this.changed.get(name);
    if (!sent || !changed) {
      sent = P.parts.map(() => []);
      changed = P.parts.map(() => []);
      this.sent.set(name, sent);
      this.changed.set(name, changed);
    }
    // presence bitmap up to the highest present slot
    let top = -1;
    for (let i = list.length - 1; i >= 0; i--) {
      if (P.present(list[i], v)) {
        top = i;
        break;
      }
    }
    const nb = (top + 8) >> 3;
    w.u16(nb);
    const bmAt = w.o;
    for (let k = 0; k < nb; k++) w.u8(0);
    const countAt = w.o;
    w.u16(0);
    let n = 0;
    let prev = -1;
    const s = this.scratch;
    for (let i = 0; i <= top; i++) {
      const e = list[i];
      if (!P.present(e, v)) continue;
      w.setU8(bmAt + (i >> 3), w.getU8(bmAt + (i >> 3)) | (1 << (i & 7)));
      let mask = 0;
      for (let k = 0; k < nParts; k++) {
        s.reset();
        P.parts[k](s, e, d);
        const cur = s.view();
        if (!sameBytes(sent[k][i], cur)) {
          sent[k][i] = cur.slice();
          changed[k][i] = seq;
        }
        if ((changed[k][i] ?? 0) > ack) mask |= 1 << k;
      }
      if (!mask) continue;
      n++;
      w.varint(i - prev - 1);
      prev = i;
      w.u8(mask);
      for (let k = 0; k < nParts; k++) if (mask & (1 << k)) w.bytes(sent[k][i]!);
    }
    const o = w.o;
    w.o = countAt;
    w.u16(n);
    w.o = o;
  }
}

/** One-shot encode with a throwaway encoder (everything is sent): tests and tools. */
export function encodeSnapshot(g: Game, c: Omit<EncodeCtx, 'ackSnap'> & { ackSnap?: number }, enc = new SnapshotEncoder()): ArrayBuffer {
  return enc.encode(g, { ackSnap: 0, ...c });
}

// ------------------------------------------------------------------------------------- decode
type Defer = (o: Record<string, unknown>, k: string, id: number) => void;
type PartReader = (r: Reader, S: Defer) => Record<string, unknown>;

const READERS: Record<PoolName, PartReader[]> = {
  enemies: [
    (r, S) => {
      const o: Record<string, unknown> = { uid: r.u16(), def: '' };
      S(o, 'def', r.u16());
      o.scale = r.u8() / 64;
      o.r = r.u8();
      o.flags = r.u8();
      return o;
    },
    (r) => ({ x: r.pos(), y: r.pos(), vx: r.i8() * 4, vy: r.i8() * 4 }),
    (r) => ({ flags: r.u8(), flash: r.frac(), windup: r.frac(), spawnT: r.u8() / 100, state: r.u8(), t: r.u8() / 100, dirX: r.i8() / 127, dirY: r.i8() / 127 }),
  ],
  projs: [
    (r, S) => {
      const o: Record<string, unknown> = { gen: r.u8(), kind: '' };
      S(o, 'kind', r.u16());
      Object.assign(o, { owner: r.u8(), r: r.u8(), area: r.u8() / 32, arc: r.u8(), tx: r.pos(), ty: r.pos() });
      return o;
    },
    (r) => ({ x: r.pos(), y: r.pos(), vx: r.i8() * 8, vy: r.i8() * 8, rot: r.i16() / 1000, life: r.frac() }),
  ],
  bullets: [
    (r, S) => {
      const o: Record<string, unknown> = { gen: r.u8(), kind: '' };
      S(o, 'kind', r.u16());
      Object.assign(o, { r: r.u8(), vx: r.i8() * 8, vy: r.i8() * 8 });
      return o;
    },
    (r) => ({ x: r.pos(), y: r.pos(), z: r.u8(), rot: r.i16() / 1000 }),
  ],
  pickups: [
    (r, S) => {
      const o: Record<string, unknown> = { gen: r.u8(), kind: '' };
      S(o, 'kind', r.u16());
      Object.assign(o, { value: r.u16(), magnet: r.u8() === 1 });
      return o;
    },
    (r) => ({ x: r.pos(), y: r.pos() }),
  ],
  hazards: [
    (r, S) => {
      const o: Record<string, unknown> = { gen: r.u8(), shape: '', style: '' };
      S(o, 'shape', r.u16());
      S(o, 'style', r.u16());
      Object.assign(o, {
        r2: r.i16() / 4, half: r.u16() / 1000, teleMax: r.u16() / 1000, activeMax: r.u16() / 1000, flags: r.u8(), gapHalf: r.u16() / 1000, tag: r.i8(),
        vx: r.i16(), vy: r.i16(), grow: r.i16(), spinRate: r.i16() / 1000, len: r.u16() / 4, holeX: r.pos(), holeY: r.pos(), holeR: r.u16() / 4,
      });
      return o;
    },
    (r) => ({ x: r.pos(), y: r.pos(), x2: r.pos(), y2: r.pos(), r: r.u16() / 4, angle: r.i16() / 1000, tele: r.u16() / 1000, active: r.u16() / 1000 }),
  ],
  zones: [
    (r, S) => {
      const o: Record<string, unknown> = { gen: r.u8(), kind: '' };
      S(o, 'kind', r.u16());
      Object.assign(o, { r: r.u16() / 4, harmful: r.u8() === 1 });
      return o;
    },
    (r) => ({ x: r.pos(), y: r.pos(), life: r.frac() }),
  ],
  summons: [
    (r, S) => {
      const o: Record<string, unknown> = { gen: r.u8(), kind: '' };
      S(o, 'kind', r.u16());
      Object.assign(o, { owner: r.u8(), variant: r.u8() });
      return o;
    },
    (r) => ({ x: r.pos(), y: r.pos(), face: r.i8(), state: r.u8() }),
  ],
};
const PART_KEYS = ['S', 'M', 'T'] as const;

/**
 * Decode a snapshot. String ids are resolved after the dictionary tail (it sits at the end), so ids
 * defined in this very packet resolve. Throws RangeError on truncated/malformed input.
 */
export function decodeSnapshot(buf: ArrayBuffer, dict: StringDict): Snapshot {
  const r = new Reader(buf);
  if (r.u8() !== SNAP) throw new RangeError('net: not a snapshot');
  const seq = r.u32(), tick = r.u32(), ackInput = r.u32();
  const time = r.f32(), realTime = r.f32();
  const phase = PHASES[r.u8()] ?? 'play';
  const level = r.u16(), xp = r.f32(), xpToNext = r.f32(), kills = r.u32();
  const darkness = r.frac(), wind = r.f32(), act = r.u8(), flags = r.u8(), tilt = r.f32(), dawnT = r.f32();
  const ids: { o: Record<string, unknown>; k: string; id: number }[] = [];
  const S: Defer = (o, k, id) => ids.push({ o, k, id });
  const top: Record<string, unknown> = { rarity: '' };
  S(top, 'rarity', r.u16());
  const players: PlayerSnap[] = [];
  const np = r.u8();
  if (np > 8) throw new RangeError('net: too many players');
  for (let k = 0; k < np; k++) {
    const p = {
      x: r.f32(), y: r.f32(), vx: r.i16(), vy: r.i16(), hp: r.u16() / 10, maxHp: r.u16() / 10,
      faceX: r.i8() / 127, faceY: r.i8() / 127, facing: r.i8(), flags: r.u8(), iframes: r.u8() / 50, hurtFlash: r.u8() / 255,
      reviveT: r.frac(), reviveFx: r.u8() / 100, animT: r.f32(), slowF: r.frac(), dashT: r.u8() / 100,
      weapons: [] as PlayerSnap['weapons'], passives: [] as PlayerSnap['passives'],
    };
    const nw = r.u8();
    for (let i = 0; i < nw; i++) {
      const wv = { id: '', level: 0, active: false, angle: 0, cd: 0 };
      S(wv, 'id', r.u16());
      wv.level = r.u8();
      wv.active = r.u8() === 1;
      wv.angle = r.f32();
      wv.cd = r.u8() / 50;
      p.weapons.push(wv);
    }
    const npv = r.u8();
    for (let i = 0; i < npv; i++) {
      const pv = { id: '', level: 0 };
      S(pv, 'id', r.u16());
      pv.level = r.u8();
      p.passives.push(pv);
    }
    players.push(p);
  }
  const pools = {} as Record<PoolName, PoolSnap<unknown, unknown, unknown>>;
  for (const name of POOL_ORDER) {
    const nb = r.u16();
    if (nb > 1024) throw new RangeError('net: bitmap too large');
    const present = r.bytes(nb);
    const n = r.u16();
    const recs: PoolSnap<unknown, unknown, unknown>['recs'] = [];
    const parts = READERS[name];
    let slot = -1;
    for (let k = 0; k < n; k++) {
      slot += r.varint() + 1;
      if (slot >= nb * 8) throw new RangeError('net: record outside the bitmap');
      const mask = r.u8();
      const rec: Record<string, unknown> & { slot: number } = { slot };
      for (let j = 0; j < parts.length; j++) if (mask & (1 << j)) rec[PART_KEYS[j]] = parts[j](r, S);
      recs.push(rec);
    }
    pools[name] = { present, recs };
  }
  const bm = r.u8();
  let bosses: Record<string, unknown>[] | null = [];
  let bossDelta: BossDelta | null = null;
  if (bm === 2) {
    const parsed = JSON.parse(r.text()) as unknown;
    if (!Array.isArray(parsed)) throw new RangeError('net: bad boss state');
    bosses = parsed as Record<string, unknown>[];
  } else if (bm === 3) {
    const base = r.u32();
    const parsed = JSON.parse(r.text()) as { u?: unknown; d?: unknown };
    if (!Array.isArray(parsed.u) || typeof parsed.d !== 'object' || parsed.d === null) throw new RangeError('net: bad boss delta');
    bosses = null;
    bossDelta = { base, uids: parsed.u.filter((x): x is number => typeof x === 'number').slice(0, 16), d: parsed.d as BossDelta['d'] };
  }
  const remains: Snapshot['remains'] = [];
  for (let k = r.u8(); k > 0; k--) {
    const rm = { id: '', x: 0, y: 0 };
    S(rm, 'id', r.u16());
    rm.x = r.pos();
    rm.y = r.pos();
    remains.push(rm);
  }
  let quest: QuestSnap | null = null;
  if (r.u8() === 1) {
    const stage = r.u8(), litBits = r.u8();
    const souls = [r.u8(), r.u8(), r.u8(), r.u8()];
    const ob = r.u8();
    quest = {
      stage, lit: [0, 1, 2, 3].map((i) => !!(litBits & (1 << i))), souls, order: [0, 1, 2, 3].map((i) => (ob >> (i * 2)) & 3),
      progress: r.u8(), rings: r.u8(), carrying: r.u8() === 1,
    };
  }
  const fx: FxEvent[] = [];
  for (let k = r.u16(); k > 0; k--) {
    const e = { type: '' as FxType, x: 0, y: 0, a: 0, b: 0, c: 0, style: '' } as FxEvent;
    S(e as unknown as Record<string, unknown>, 'type', r.u16());
    e.x = r.pos();
    e.y = r.pos();
    const m = r.u8();
    if (m & 1) e.a = r.f32();
    if (m & 2) e.b = r.f32();
    if (m & 4) e.c = r.f32();
    if (m & 8) S(e as unknown as Record<string, unknown>, 'style', r.u16());
    if (m & 16) S(e as unknown as Record<string, unknown>, 'text', r.u16());
    fx.push(e);
  }
  const sfx: SfxEvt[] = [];
  for (let k = r.u8(); k > 0; k--) {
    const e: SfxEvt = { id: '' };
    S(e as unknown as Record<string, unknown>, 'id', r.u16());
    if (r.u8() === 1) {
      e.x = r.pos();
      e.y = r.pos();
    }
    e.vol = r.u8() / 100;
    e.pitch = r.u8() / 100;
    sfx.push(e);
  }
  dict.readInto(r);
  for (const s of ids) s.o[s.k] = dict.get(s.id);
  return {
    seq, tick, ackInput, time, realTime, phase, level, xp, xpToNext, kills, darkness, wind, act, flags, tilt, dawnT, rarity: top.rarity as string,
    players,
    enemies: pools.enemies as Snapshot['enemies'],
    projs: pools.projs as Snapshot['projs'],
    bullets: pools.bullets as Snapshot['bullets'],
    pickups: pools.pickups as Snapshot['pickups'],
    hazards: pools.hazards as Snapshot['hazards'],
    zones: pools.zones as Snapshot['zones'],
    summons: pools.summons as Snapshot['summons'],
    bosses, bossDelta, remains, quest, fx, sfx,
  };
}
