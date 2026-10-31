// Wire protocol for online co-op (D-52). Two channels:
//  • reliable + ordered — small JSON control messages (lobby, drafts, prize wheel, events, pings);
//  • unreliable + unordered — binary world snapshots (host → guest) and input packets (guest → host).
// Everything that arrives is untrusted: messages are size-capped, rate-limited and validated field by
// field before anything acts on them; malformed input is dropped, persistent abuse disconnects.

import { CHARACTER_MAP } from '../data/characters';
import { DIFFICULTY_MAP } from '../data/difficulty';
import { PERKS } from '../data/meta';
import { Reader, Writer } from './codec';
import { isMapId, type MapId } from '../data/maps';

/** Bump when the wire format changes; mismatched builds are refused with a clear message. */
export const PROTO = 7;
/** Party size cap: the host plus five guests (D-54). */
export const MAX_PLAYERS = 6;
export const MAX_RELIABLE_BYTES = 16384;
export const MAX_INPUT_BYTES = 256;
/** Snapshot rate (Hz) and the inputs repeated in every input packet (loss cover). */
export const SNAPSHOT_HZ = 20;
export const INPUT_REDUNDANCY = 6;
export const BIN_SNAPSHOT = 1; // must equal snapshot.ts SNAP
export const BIN_INPUT = 2;

export type Diff = 'midway' | 'nightmare' | 'hell' | string;
export type AimMode = 'auto' | 'hybrid' | 'manual';

export interface LobbyPlayer {
  name: string;
  character: string | null;
  ready: boolean;
  connected: boolean;
  rtt: number;
}
export interface LobbyState {
  code: string;
  players: (LobbyPlayer | null)[];
  /** which night the host has chosen (D-63) */
  map: MapId;
  difficulty: string;
  curse: boolean;
  /** true while a run is in progress (late joiners are refused unless reconnecting) */
  inRun: boolean;
}

/** What a guest tells the host about itself: validated and clamped on arrival. */
export interface GuestProfile {
  name: string;
  meta: { axis: string; value: number }[];
  rerolls: number;
  banishes: number;
  canSkip: boolean;
  aimMode: AimMode;
  /** characters the guest's save has unlocked (the lobby only lets them pick these) */
  chars: string[];
  /** the character they last played (what they walk the Midway hub as, D-60) */
  pref?: string;
}

/** The shared run definition the host sends at start; the guest builds its mirror Game from it. */
export interface StartCfg {
  seed: number;
  difficulty: string;
  curse: boolean;
  unlocked: string[];
  questMemory: Record<string, number>;
  players: { character: string; name: string; meta: { axis: string; value: number }[]; aimMode: AimMode; rerolls: number; banishes: number; canSkip: boolean }[];
  /** set when this is the Midway hub rather than a night (D-60): the cast to show and where players stand */
  hub?: { npcs: string[]; at?: { x: number; y: number }[] };
  /** the night's map (D-63); the Carnival Core when absent */
  map?: MapId;
}

// ------------------------------------------------------------------ messages
export type GuestMsg =
  | { t: 'hello'; v: number; profile: GuestProfile; token?: string }
  | { t: 'pick'; character: string | null }
  | { t: 'ready'; ready: boolean }
  | { t: 'view'; hx: number; hy: number }
  | { t: 'draft'; op: 'choose' | 'skip' | 'reroll' | 'banish'; index?: number }
  | { t: 'prize_done' }
  | { t: 'pause'; on: boolean }
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number }
  | { t: 'leave' };

export type HostMsg =
  | { t: 'welcome'; v: number; slot: number; token: string; lobby: LobbyState }
  | { t: 'reject'; reason: RejectReason; detail?: string }
  | { t: 'lobby'; lobby: LobbyState; you?: number }
  | { t: 'start'; cfg: StartCfg; resume?: boolean; slot?: number }
  | { t: 'hold'; why: HoldWhy; who: number[] }
  | { t: 'ev'; type: string; e: unknown }
  | { t: 'pause'; by: string | null }
  | { t: 'prize_wait'; waiting: boolean }
  | { t: 'partner'; connected: boolean; name: string }
  | { t: 'to_lobby' }
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number }
  | { t: 'bye'; reason: string };

export type RejectReason = 'full' | 'version' | 'in_run' | 'bad_hello' | 'kicked' | 'closed';
/** Why the night is held (and for whom, by player index): shown as a waiting note on every screen. */
export type HoldWhy = '' | 'draft' | 'prize' | 'reconnect' | 'pause';
const HOLD_WHY: readonly HoldWhy[] = ['', 'draft', 'prize', 'reconnect', 'pause'];

export const REJECT_TEXT: Record<RejectReason, string> = {
  full: 'That lobby is already full (six players).',
  version: 'Your game version does not match the host’s. Both players should reload the page.',
  in_run: 'That lobby has already started a run.',
  bad_hello: 'The host could not understand this client.',
  kicked: 'You were disconnected by the host.',
  closed: 'The host closed the lobby.',
};

// ------------------------------------------------------------------ validation helpers
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max = 64): v is string => typeof v === 'string' && v.length <= max;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown, lo: number, hi: number): v is number => isNum(v) && Number.isInteger(v) && v >= lo && v <= hi;
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** Player-visible names: printable, trimmed, 1–16 characters. */
export function cleanName(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  // strip control characters and markup-ish brackets; collapse whitespace
  const s = v.replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s || fallback;
}

/** The largest value each meta axis can legitimately reach (every perk bought to its cap). */
const META_MAX: Record<string, number> = Object.fromEntries(PERKS.map((p) => [p.axis, p.mag * p.cap]));
const PERK_CAP = (axis: string) => PERKS.find((p) => p.axis === axis)?.cap ?? 0;

export function cleanProfile(v: unknown): GuestProfile | null {
  if (!isObj(v)) return null;
  const meta: GuestProfile['meta'] = [];
  if (Array.isArray(v.meta)) {
    for (const m of v.meta.slice(0, 16)) {
      if (!isObj(m) || !isStr(m.axis, 24) || !isNum(m.value)) continue;
      const max = META_MAX[m.axis];
      if (max === undefined || m.axis === 'reroll' || m.axis === 'banish') continue;
      if (meta.some((x) => x.axis === m.axis)) continue;
      meta.push({ axis: m.axis, value: Math.max(0, Math.min(max, m.value)) });
    }
  }
  const chars = Array.isArray(v.chars) ? v.chars.filter((c): c is string => isStr(c, 32) && !!CHARACTER_MAP[c as keyof typeof CHARACTER_MAP]).slice(0, 32) : [];
  return {
    name: cleanName(v.name, 'Guest'),
    meta,
    rerolls: isInt(v.rerolls, 0, 99) ? Math.min(v.rerolls, PERK_CAP('reroll')) : 0,
    banishes: isInt(v.banishes, 0, 99) ? Math.min(v.banishes, PERK_CAP('banish')) : 0,
    canSkip: v.canSkip === true,
    aimMode: v.aimMode === 'manual' || v.aimMode === 'hybrid' ? v.aimMode : 'auto',
    chars,
    pref: isStr(v.pref, 32) && CHARACTER_MAP[v.pref as keyof typeof CHARACTER_MAP] ? v.pref : undefined,
  };
}

/** Parse + validate one reliable message from a guest. Returns null for anything malformed. */
export function parseGuestMsg(raw: unknown): GuestMsg | null {
  if (typeof raw !== 'string' || raw.length > MAX_RELIABLE_BYTES) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(m) || !isStr(m.t, 16)) return null;
  switch (m.t) {
    case 'hello': {
      const profile = cleanProfile(m.profile);
      if (!isInt(m.v, 0, 1e6) || !profile) return null;
      return { t: 'hello', v: m.v, profile, token: isStr(m.token, 64) ? m.token : undefined };
    }
    case 'pick':
      if (m.character === null) return { t: 'pick', character: null };
      return isStr(m.character, 32) && CHARACTER_MAP[m.character as keyof typeof CHARACTER_MAP] ? { t: 'pick', character: m.character } : null;
    case 'ready':
      return isBool(m.ready) ? { t: 'ready', ready: m.ready } : null;
    case 'view':
      return isNum(m.hx) && isNum(m.hy) ? { t: 'view', hx: Math.max(300, Math.min(2400, m.hx)), hy: Math.max(200, Math.min(2000, m.hy)) } : null;
    case 'draft':
      if (m.op !== 'choose' && m.op !== 'skip' && m.op !== 'reroll' && m.op !== 'banish') return null;
      if ((m.op === 'choose' || m.op === 'banish') && !isInt(m.index, 0, 15)) return null;
      return { t: 'draft', op: m.op, index: isInt(m.index, 0, 15) ? m.index : undefined };
    case 'prize_done':
      return { t: 'prize_done' };
    case 'pause':
      return isBool(m.on) ? { t: 'pause', on: m.on } : null;
    case 'ping':
    case 'pong':
      return isNum(m.at) ? { t: m.t, at: m.at } : null;
    case 'leave':
      return { t: 'leave' };
  }
  return null;
}

/** Host → guest event types the guest replays on its mirror's event bus. */
export const FORWARDED_EVENTS = new Set([
  'levelup', 'draft', 'draft_done', 'player_hurt', 'shield_pop', 'player_revive', 'player_downed', 'boss_warning', 'boss_spawn',
  'boss_phase', 'boss_defeated', 'music', 'act', 'carnival_event', 'banner', 'chest', 'meta_currency', 'quest', 'balloon_drift',
  'evolved', 'discover', 'stall', 'dawn', 'run_end', 'pickup',
]);

/** Parse + validate one reliable message from the host (the host is authoritative, but a broken or
 *  hostile peer must still not be able to crash or script the guest). */
export function parseHostMsg(raw: unknown): HostMsg | null {
  if (typeof raw !== 'string' || raw.length > 262144) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(m) || !isStr(m.t, 16)) return null;
  switch (m.t) {
    case 'welcome':
      return isInt(m.v, 0, 1e6) && isInt(m.slot, 1, MAX_PLAYERS - 1) && isStr(m.token, 64) && cleanLobby(m.lobby) ? { t: 'welcome', v: m.v, slot: m.slot, token: m.token, lobby: cleanLobby(m.lobby)! } : null;
    case 'reject':
      return isStr(m.reason, 16) && m.reason in REJECT_TEXT ? { t: 'reject', reason: m.reason as RejectReason, detail: isStr(m.detail, 200) ? m.detail : undefined } : null;
    case 'lobby': {
      const lobby = cleanLobby(m.lobby);
      return lobby ? { t: 'lobby', lobby, you: isInt(m.you, 1, MAX_PLAYERS - 1) ? m.you : undefined } : null;
    }
    case 'start': {
      const cfg = cleanStart(m.cfg);
      return cfg ? { t: 'start', cfg, resume: m.resume === true, slot: isInt(m.slot, 1, cfg.players.length - 1) ? m.slot : undefined } : null;
    }
    case 'hold':
      return HOLD_WHY.includes(m.why as HoldWhy) && Array.isArray(m.who) && m.who.length <= MAX_PLAYERS && m.who.every((i) => isInt(i, 0, MAX_PLAYERS - 1))
        ? { t: 'hold', why: m.why as HoldWhy, who: m.who as number[] }
        : null;
    case 'ev':
      return isStr(m.type, 24) && FORWARDED_EVENTS.has(m.type) ? { t: 'ev', type: m.type, e: m.e } : null;
    case 'pause':
      return m.by === null || isStr(m.by, 32) ? { t: 'pause', by: m.by === null ? null : cleanName(m.by, 'Host') } : null;
    case 'prize_wait':
      return isBool(m.waiting) ? { t: 'prize_wait', waiting: m.waiting } : null;
    case 'partner':
      return isBool(m.connected) ? { t: 'partner', connected: m.connected, name: cleanName(m.name, 'Partner') } : null;
    case 'to_lobby':
      return { t: 'to_lobby' };
    case 'ping':
    case 'pong':
      return isNum(m.at) ? { t: m.t, at: m.at } : null;
    case 'bye':
      return { t: 'bye', reason: isStr(m.reason, 200) ? m.reason : '' };
  }
  return null;
}

function cleanLobby(v: unknown): LobbyState | null {
  if (!isObj(v) || !Array.isArray(v.players) || v.players.length > MAX_PLAYERS) return null;
  const players = v.players.map((p) =>
    isObj(p)
      ? {
          name: cleanName(p.name, 'Player'),
          character: isStr(p.character, 32) && CHARACTER_MAP[p.character as keyof typeof CHARACTER_MAP] ? p.character : null,
          ready: p.ready === true,
          connected: p.connected !== false,
          rtt: isNum(p.rtt) ? Math.max(0, Math.min(9999, p.rtt)) : 0,
        }
      : null,
  );
  return {
    code: isStr(v.code, 16) ? v.code : '',
    players,
    map: isMapId(v.map) ? v.map : 'carnival_core',
    difficulty: isStr(v.difficulty, 24) && DIFFICULTY_MAP[v.difficulty as keyof typeof DIFFICULTY_MAP] ? v.difficulty : 'midway',
    curse: v.curse === true,
    inRun: v.inRun === true,
  };
}

function cleanStart(v: unknown): StartCfg | null {
  if (!isObj(v) || !isInt(v.seed, 0, 2 ** 32) || !Array.isArray(v.players) || v.players.length < 1 || v.players.length > MAX_PLAYERS) return null;
  const players: StartCfg['players'] = [];
  for (const p of v.players) {
    if (!isObj(p) || !isStr(p.character, 32) || !CHARACTER_MAP[p.character as keyof typeof CHARACTER_MAP]) return null;
    const prof = cleanProfile({ ...p, chars: [] });
    if (!prof) return null;
    players.push({ character: p.character, name: cleanName(p.name, 'Player'), meta: prof.meta, aimMode: prof.aimMode, rerolls: isInt(p.rerolls, 0, 99) ? p.rerolls : 0, banishes: isInt(p.banishes, 0, 99) ? p.banishes : 0, canSkip: p.canSkip === true });
  }
  const unlocked = Array.isArray(v.unlocked) ? v.unlocked.filter((s): s is string => isStr(s, 40)).slice(0, 256) : [];
  const questMemory: Record<string, number> = {};
  if (isObj(v.questMemory)) for (const [k, n] of Object.entries(v.questMemory).slice(0, 16)) if (isStr(k, 32) && isInt(n, 0, 1e6)) questMemory[k] = n;
  let hub: StartCfg['hub'];
  if (isObj(v.hub)) {
    const npcs = Array.isArray(v.hub.npcs) ? v.hub.npcs.filter((c): c is string => isStr(c, 32) && !!CHARACTER_MAP[c as keyof typeof CHARACTER_MAP]).slice(0, 12) : [];
    const at = Array.isArray(v.hub.at) ? v.hub.at.slice(0, MAX_PLAYERS).map((q) => (isObj(q) && isNum(q.x) && isNum(q.y) ? { x: Math.max(-3000, Math.min(3000, q.x)), y: Math.max(-3000, Math.min(3000, q.y)) } : { x: 0, y: 330 })) : undefined;
    hub = { npcs, at };
  }
  return {
    hub,
    map: isMapId(v.map) ? v.map : undefined,
    seed: v.seed,
    difficulty: isStr(v.difficulty, 24) && DIFFICULTY_MAP[v.difficulty as keyof typeof DIFFICULTY_MAP] ? v.difficulty : 'midway',
    curse: v.curse === true,
    unlocked,
    questMemory,
    players,
  };
}

// ------------------------------------------------------------------ rate limiting
/** Token bucket: `rate` messages per second, bursting to `burst`. */
export class RateLimiter {
  private tokens: number;
  private last: number;
  constructor(private rate: number, private burst: number, now = 0) {
    this.tokens = burst;
    this.last = now;
  }
  take(now: number, n = 1): boolean {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

// ------------------------------------------------------------------ input packets
export interface NetInput {
  seq: number;
  mx: number;
  my: number;
  ax: number;
  ay: number;
  aim: boolean;
}

export interface InputPacket {
  /** highest snapshot sequence the guest has received (for diagnostics) */
  ackSnap: number;
  /** guest's string-dictionary size: the host resends entries from here until acknowledged */
  dictSize: number;
  /** oldest → newest, consecutive sequence numbers */
  inputs: NetInput[];
}

const q8 = (v: number) => Math.max(-127, Math.min(127, Math.round(v * 127)));

export function encodeInputPacket(p: InputPacket, w = new Writer(128)): ArrayBuffer {
  w.reset();
  w.u8(BIN_INPUT);
  const last = p.inputs[p.inputs.length - 1];
  w.u32(last ? last.seq : 0);
  w.u32(p.ackSnap);
  w.u16(p.dictSize);
  w.u8(p.inputs.length);
  for (const i of p.inputs) {
    w.i8(q8(i.mx));
    w.i8(q8(i.my));
    w.i8(q8(i.ax));
    w.i8(q8(i.ay));
    w.u8(i.aim ? 1 : 0);
  }
  return w.done();
}

/** Decode a guest input packet; null if malformed. Movement is clamped to the unit disc. */
export function decodeInputPacket(buf: ArrayBuffer): InputPacket | null {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength > MAX_INPUT_BYTES || buf.byteLength < 12) return null;
  try {
    const r = new Reader(buf);
    if (r.u8() !== BIN_INPUT) return null;
    const seq = r.u32(), ackSnap = r.u32(), dictSize = r.u16();
    const n = r.u8();
    if (n > 16) return null;
    const inputs: NetInput[] = [];
    for (let k = 0; k < n; k++) {
      let mx = r.i8() / 127, my = r.i8() / 127;
      const l = Math.hypot(mx, my);
      if (l > 1) {
        mx /= l;
        my /= l;
      }
      inputs.push({ seq: seq - (n - 1 - k), mx, my, ax: r.i8() / 127, ay: r.i8() / 127, aim: (r.u8() & 1) === 1 });
    }
    return { ackSnap, dictSize, inputs };
  } catch {
    return null;
  }
}

/** Peek the binary message type (first byte). */
export function binType(buf: ArrayBuffer): number {
  return buf.byteLength ? new Uint8Array(buf, 0, 1)[0] : 0;
}
