// Online co-op sessions (D-52, D-54). The host's browser is authoritative: it runs the only simulation,
// seats up to five guests, applies each guest's inputs through a small jitter buffer, and streams each
// its own snapshots plus the gameplay events its UI needs. A guest keeps a mirror Game fed by a Replica
// and predicts only its own character. Both classes are UI-free and transport-free (they speak NetLink),
// so the whole flow — lobby, start, drafts, prize wheel, pause, disconnect, reconnect — runs headless
// in tests over the loopback network.

import type { MapId } from '../data/maps';
import { BUILD } from '../platform/updates';
import type { Game, GameEvents, RunConfig } from '../sim/game';
import type { FxEvent } from '../sim/fx';
import { buildOf } from '../sim/draft';
import { StringDict, Writer } from './codec';
import { randomToken } from './codes';
import type { NetLink } from './link';
import {
  BIN_INPUT, BIN_SNAPSHOT, FORWARDED_EVENTS, INPUT_REDUNDANCY, MAX_PLAYERS, PROTO, REJECT_TEXT, RateLimiter, SNAPSHOT_HZ, SNAPSHOT_HZ_FAST,
  binType, cleanChat, decodeInputPacket, encodeInputPacket, meterFromWire, meterToWire, parseGuestMsg, parseHostMsg,
  type GuestMsg, type GuestProfile, type HoldWhy, type HostMsg, type LobbyState, type NetInput, type RejectReason, type StartCfg,
} from './protocol';
import { Replica } from './replica';
import { SnapshotEncoder, decodeSnapshot, snapshotEpoch, type SfxEvt } from './snapshot';
import { meterState } from '../sim/meter';

/** Chat flood guard (D-65): a burst of lines, then one per this many ms. */
const CHAT_BURST = 4;
const CHAT_REFILL = 700;

export const HELLO_TIMEOUT = 8000;
export const LINK_TIMEOUT = 10000;
/**
 * A frame this long after the last means this tab itself stood still (a map's world built as a night starts
 * takes 12-15 s the first time, D-82). That time isn't the other side's silence: it was most likely stalled
 * too, building its own, and whatever it sent meanwhile may still be waiting to be read.
 */
export const STALL = 1000;
export const PING_EVERY = 1000;
/** How often the host sends the damage meter and the live Lost Tickets through a night (ms; D-85). */
export const METER_EVERY = 1000;
/** How long the host's run waits (paused) for a dropped guest before carrying on without them. */
export const RECONNECT_WAIT = 20000;
/** Longest the host waits for the guests to finish watching a prize wheel. */
export const PRIZE_WAIT = 30000;

export interface HostProfile {
  name: string;
  meta: { axis: string; value: number }[];
  rerolls: number;
  banishes: number;
  canSkip: boolean;
  aimMode: GuestProfile['aimMode'];
  pet?: string;
}

interface Seat {
  /** player index (1..5) */
  index: number;
  link: NetLink | null;
  profile: GuestProfile;
  token: string;
  character: string | null;
  ready: boolean;
  /** browsing the Lost & Found from the lobby (D-74) */
  away: boolean;
  connected: boolean;
  lastHeard: number;
  /** something arrived since the last update (stamped there, so a stalled tab never fakes a timeout) */
  heard: boolean;
  rtt: number;
  /** round-trip variation (ms, smoothed) */
  jitter: number;
  /** ticks played by repeating a late input, still to be skipped when the late inputs arrive */
  owed: number;
  /** snapshots small enough for the fast rate */
  fast: boolean;
  view: { hx: number; hy: number };
  queue: NetInput[];
  lastQueued: number;
  lastApplied: number;
  lastInput: NetInput | null;
  ackSnap: number;
  dictAck: number;
  invalid: number;
  limiter: RateLimiter;
  binLimiter: RateLimiter;
  paused: boolean;
  goneAt: number;
  /** consecutive ticks the input buffer has sat deeper than the target cushion */
  deepTicks: number;
  /** when the last new input arrived (a silent guest stops moving instead of running on) */
  lastInputAt: number;
  /** the guest's interact count as last applied (-1: not yet heard, so the first input sets it; D-67) */
  lastIa: number;
  /** consecutive ticks covered by repeating the last input while the buffer was empty */
  repeats: number;
  /** dropped mid-run: the night waits for them until this time (0 = not waiting) */
  waitUntil: number;
  /** prize wheels this guest still has to finish watching */
  prize: number;
  /** each guest has its own delta stream: what it has been sent, its sequence, its queued cosmetics */
  enc: SnapshotEncoder;
  snapSeq: number;
  snapAcc: number;
  fx: FxEvent[];
  sfx: SfxEvt[];
  stats: { bytes: number; snaps: number; winStart: number; bps: number; rate: number; last: number; skipped: number; starved: number; dropped: number };
  /** chat flood guard (D-65): a small bucket that refills one line per CHAT_REFILL ms */
  chatTokens: number;
  chatAt: number;
}

export interface NetDiag {
  role: 'host' | 'guest';
  rtt: number;
  connected: boolean;
  unreliable: boolean;
  route: string;
  /** host: guest's input buffer depth, inputs repeated for lack of data, inputs dropped to catch up */
  inputQueue: number;
  starved: number;
  dropped: number;
  /** snapshots: last size, bytes/s sent or received, rate, lost, skipped for congestion */
  snapBytes: number;
  skipped: number;
  bytesPerSec: number;
  snapRate: number;
  snapLost: number;
  /** guest: prediction correction distance (world units) and interpolation interval (ms) */
  predErr: number;
  interval: number;
  invalid: number;
  /** host: one line per connected guest */
  peers?: { name: string; rtt: number; kbps: number; route: string; queue: number }[];
  /** round-trip variation (ms), bytes waiting in the datagram channel, prediction corrections, the
   *  guest's interpolation delay (ms): filled where the session measures them (developer overlay) */
  jitter?: number;
  buffered?: number;
  corrections?: number;
  interpDelay?: number;
}

const blankDiag = (role: 'host' | 'guest'): NetDiag => ({ role, rtt: 0, connected: false, unreliable: false, route: '', inputQueue: 0, starved: 0, dropped: 0, snapBytes: 0, skipped: 0, bytesPerSec: 0, snapRate: 0, snapLost: 0, predErr: 0, interval: 0, invalid: 0 });

/** The RunConfig both machines build from the shared start definition (host: the real run; guest: its mirror). */
export function runConfigFromStart(c: StartCfg): RunConfig {
  const p0 = c.players[0];
  return {
    character: p0.character,
    difficulty: c.difficulty as RunConfig['difficulty'],
    curse: c.curse,
    seed: c.seed,
    meta: p0.meta,
    rerolls: p0.rerolls,
    banishes: p0.banishes,
    canSkip: p0.canSkip,
    aimMode: p0.aimMode,
    unlocked: new Set(c.unlocked),
    questMemory: c.questMemory,
    pet: p0.pet,
    players: c.players.map((p) => ({ character: p.character, name: p.name, meta: p.meta, rerolls: p.rerolls, banishes: p.banishes, canSkip: p.canSkip, aimMode: p.aimMode, unlocked: p.unlocked ? new Set(p.unlocked) : undefined, pet: p.pet })),
    hub: c.hub,
    map: c.map,
  };
}

// =================================================================================== host
/** Why the night is held and for whom (player indices); every screen shows it as a waiting note. */
export interface HoldStatus {
  why: HoldWhy;
  who: number[];
}

export class HostSession {
  readonly lobby: LobbyState;
  /** guest seats by player index (index 0 is the host and stays empty); compact while in the lobby */
  readonly seats: (Seat | null)[] = Array.from({ length: MAX_PLAYERS }, () => null);
  game: Game | null = null;
  startCfg: StartCfg | null = null;
  hostCharacter: string | null = null;
  hostReady = false;
  /** which game is running (D-76): bumped at every start; inputs from another game are dropped */
  private epoch = 0;
  /** the host is browsing the Lost & Found from the lobby (D-74) */
  hostAway = false;
  hostPaused = false;
  /** the party is walking the Midway hub (D-60): joining stays open, drops just leave */
  inHub = false;
  /** what the night is waiting on right now (recomputed every update, sent to the guests on change) */
  hold: HoldStatus = { why: '', who: [] };
  private holdKey = '';
  private pending: { link: NetLink; at: number }[] = [];
  private dict = new StringDict();
  private unsub: (() => void)[] = [];
  private lastPing = 0;
  private lastMeter = 0;
  private now = 0;
  // prize wheel: open presentations the host still has to finish (each seat counts its own)
  private prizeHost = 0;
  private prizeHostDoneAt = 0;
  /** when the night last advanced (inputs that arrive while it is frozen are spent, see update) */
  private lastTickAt = 0;
  readonly diag = blankDiag('host');

  // UI hooks
  onLobby: (l: LobbyState) => void = () => {};
  onNotice: (text: string, tone?: 'info' | 'warn') => void = () => {};
  /** a chat line from anyone in the party, the host's own included (D-65) */
  onChat: (from: number, name: string, text: string) => void = () => {};
  onGuestPause: (paused: boolean, name: string) => void = () => {};
  onClosed: (reason: string) => void = () => {};

  constructor(code: string, public self: HostProfile) {
    this.lobby = { code, players: [this.lobbyHost(), ...Array.from({ length: MAX_PLAYERS - 1 }, () => null)], map: 'carnival_core', difficulty: 'midway', curse: false, inRun: false };
  }

  /** Every seated guest, connected or not, in player order. */
  get guests(): Seat[] {
    return this.seats.filter((s): s is Seat => !!s);
  }
  private get live(): Seat[] {
    return this.seats.filter((s): s is Seat => !!s?.connected);
  }
  /** Is player `i` here? (The host always is.) */
  connected(i: number): boolean {
    return i === 0 || !!this.seats[i]?.connected;
  }
  /** The run must not advance: someone paused, or we are waiting for a dropped guest. */
  get paused(): boolean {
    return this.hostPaused || this.live.some((s) => s.paused) || this.guests.some((s) => s.waitUntil > 0);
  }
  /** Every open prize wheel has been watched on every screen. */
  get prizeReady(): boolean {
    return this.prizeHost <= 0 && this.live.every((s) => s.prize <= 0);
  }

  private lobbyHost() {
    return { name: this.self.name, character: this.hostCharacter, ready: this.hostReady, connected: true, rtt: 0, away: this.hostAway };
  }

  private broadcastLobby(): void {
    this.lobby.players[0] = this.lobbyHost();
    for (let i = 1; i < MAX_PLAYERS; i++) {
      const s = this.seats[i];
      this.lobby.players[i] = s ? { name: s.profile.name, character: s.character, ready: s.ready, connected: s.connected, rtt: Math.round(s.rtt), away: s.away } : null;
    }
    // each guest also learns its own seat (seats close up when someone leaves the lobby)
    for (const s of this.live) this.sendTo(s, { t: 'lobby', lobby: this.lobby, you: s.index });
    this.onLobby(this.lobby);
  }

  private sendTo(s: Seat, m: HostMsg): void {
    if (s.connected && s.link) s.link.sendMsg(m);
  }
  private broadcast(m: HostMsg): void {
    for (const s of this.live) this.sendTo(s, m);
  }

  // ------------------------------------------------------------------ lobby
  setCharacter(id: string | null): boolean {
    if (this.lobby.inRun) return false;
    this.hostCharacter = id; // characters may repeat: a party of six outnumbers most saves' unlocks
    this.hostReady = false;
    this.broadcastLobby();
    return true;
  }
  setReady(r: boolean): void {
    if (this.lobby.inRun) return;
    this.hostReady = r && !!this.hostCharacter;
    this.broadcastLobby();
  }
  /** The host steps into the Lost & Found from the lobby, or back out of it (D-74): not ready meanwhile. */
  setAway(on: boolean): void {
    if (this.lobby.inRun) return;
    this.hostAway = on;
    this.hostReady = false;
    this.broadcastLobby();
  }
  /** The host's own perks changed (a Lost & Found visit): the next night uses the new ones. */
  setSelf(p: HostProfile): void {
    this.self = { ...p, name: this.self.name };
  }
  setDifficulty(id: string, curse: boolean): void {
    if (this.lobby.inRun) return;
    this.lobby.difficulty = id;
    this.lobby.curse = curse;
    this.broadcastLobby();
  }
  /** The host picks the night's map (D-63); everyone builds the same one. */
  setMap(id: MapId): void {
    if (this.lobby.inRun) return;
    this.lobby.map = id;
    this.broadcastLobby();
  }
  canStart(): boolean {
    const g = this.live;
    return !this.lobby.inRun && this.hostReady && !!this.hostCharacter && g.length > 0 && g.length === this.guests.length && g.every((s) => s.ready && !!s.character);
  }

  /** Lock the lobby and tell every guest to build its mirror. Returns the shared run definition. */
  start(o: { seed: number; unlocked: string[]; questMemory: Record<string, number> }): StartCfg | null {
    if (!this.canStart()) return null;
    const me = this.self;
    // every player drafts from their own save's unlocks (D-74): the host's, and each guest's
    const entry = (character: string, name: string, p: HostProfile | GuestProfile, unlocked: string[]) => ({ character, name, meta: p.meta, aimMode: p.aimMode, rerolls: p.rerolls, banishes: p.banishes, canSkip: p.canSkip, unlocked, pet: p.pet });
    this.startCfg = {
      seed: o.seed >>> 0,
      map: this.lobby.map,
      difficulty: this.lobby.difficulty,
      curse: this.lobby.curse,
      unlocked: o.unlocked,
      questMemory: o.questMemory,
      // seats are compact in the lobby, so seat index = player index
      players: [entry(this.hostCharacter!, me.name, me, o.unlocked), ...this.guests.map((s) => entry(s.character!, s.profile.name, s.profile, s.profile.unlocks ?? []))],
    };
    this.lobby.inRun = true;
    this.broadcastLobby();
    this.epoch = (this.epoch + 1) & 255;
    for (const s of this.live) this.sendTo(s, { t: 'start', cfg: this.startCfg, slot: s.index, epoch: this.epoch });
    return this.startCfg;
  }

  /**
   * The Midway hub (D-60): everyone seated walks the grounds together. Unlike a night, it stays open
   * to newcomers; the app rebuilds it (keeping where everyone stood) whenever the party changes.
   */
  startHub(o: { seed: number; unlocked: string[]; questMemory: Record<string, number>; npcs: string[]; at?: { x: number; y: number }[] }): StartCfg {
    const me = this.self;
    const entry = (character: string, name: string, p: HostProfile | GuestProfile, unlocked: string[]) => ({ character, name, meta: p.meta, aimMode: p.aimMode, rerolls: p.rerolls, banishes: p.banishes, canSkip: p.canSkip, unlocked, pet: p.pet });
    this.startCfg = {
      seed: o.seed >>> 0,
      difficulty: this.lobby.difficulty,
      curse: false,
      unlocked: o.unlocked,
      questMemory: o.questMemory,
      hub: { npcs: o.npcs, at: o.at },
      players: [entry(this.hostCharacter ?? 'carny', me.name, me, o.unlocked), ...this.guests.map((s) => entry(s.character ?? s.profile.pref ?? s.profile.chars[0] ?? 'carny', s.profile.name, s.profile, s.profile.unlocks ?? []))],
    };
    this.inHub = true;
    this.lobby.inRun = false;
    this.epoch = (this.epoch + 1) & 255;
    for (const s of this.live) this.sendTo(s, { t: 'start', cfg: this.startCfg, slot: s.index, epoch: this.epoch });
    return this.startCfg;
  }

  /** From the hub to the night's character select: everyone goes to the lobby screen (D-60). */
  toLobby(): void {
    this.detachGame();
    this.inHub = false;
    this.startCfg = null;
    for (const s of this.guests) s.ready = s.away = false;
    this.broadcast({ t: 'to_lobby' });
    this.broadcastLobby();
  }

  /** After a run: everyone back to the lobby, connections kept, empty seats closed up. */
  backToLobby(): void {
    this.detachGame();
    this.inHub = false;
    this.lobby.inRun = false;
    this.hostReady = false;
    this.hostPaused = false;
    for (const s of this.guests) {
      s.ready = false;
      s.paused = false;
      s.waitUntil = 0;
      s.prize = 0;
      if (!s.connected) this.removeSeat(s);
    }
    this.broadcast({ t: 'to_lobby' });
    this.broadcastLobby();
  }

  // ------------------------------------------------------------------ connections
  /** A new transport connection: it must say hello (with the right version) before anything else. */
  accept(link: NetLink): void {
    const p = { link, at: this.now };
    this.pending.push(p);
    link.onMsg = (raw) => {
      const m = parseGuestMsg(raw);
      if (!m || m.t !== 'hello') return this.refuse(link, 'bad_hello');
      this.pending = this.pending.filter((x) => x !== p);
      this.hello(link, m);
    };
    link.onBin = null;
    link.onClose = () => {
      this.pending = this.pending.filter((x) => x !== p);
    };
  }

  private refuse(link: NetLink, reason: RejectReason, detail?: string): void {
    this.pending = this.pending.filter((x) => x.link !== link);
    link.onMsg = null;
    link.onBin = null;
    link.onClose = null;
    // the reject travels ahead of the close on the ordered channel (the transport flushes first)
    link.sendMsg({ t: 'reject', reason, detail } satisfies HostMsg);
    link.close(reason);
  }

  private hello(link: NetLink, m: Extract<GuestMsg, { t: 'hello' }>): void {
    // mixed versions never share a night (engineering optimization pass): the wire protocol and the
    // simulation code must match; the refusal says which side is newer, so the right player updates
    if (m.v !== PROTO || (m.sim !== undefined && m.sim !== BUILD.sim)) {
      const hostNewer = Date.parse(BUILD.time) > Date.parse(m.time ?? '1970-01-01');
      return this.refuse(link, 'version', hostNewer ? 'host-newer' : 'host-older');
    }
    const back = m.token ? this.guests.find((s) => s.token === m.token) : undefined;
    if (back) return this.rejoin(back, link, m);
    if (this.lobby.inRun) return this.refuse(link, 'in_run');
    const index = this.seats.findIndex((s, i) => i > 0 && !s);
    if (index < 0) return this.refuse(link, 'full');
    const seat: Seat = {
      index, link: null, profile: { ...m.profile, name: this.uniqueName(m.profile.name) }, token: randomToken(), character: null, ready: false, away: false, connected: false, lastHeard: this.now, heard: false, rtt: 0, jitter: 0, owed: 0, fast: false,
      view: { hx: 900, hy: 700 }, queue: [], lastQueued: 0, lastApplied: 0, lastInput: null, lastIa: -1, ackSnap: 0, dictAck: 0, invalid: 0,
      limiter: new RateLimiter(40, 80, this.now), binLimiter: new RateLimiter(180, 240, this.now), paused: false, goneAt: 0, deepTicks: 0, lastInputAt: 0, repeats: 0,
      waitUntil: 0, prize: 0, enc: new SnapshotEncoder(), snapSeq: 0, snapAcc: 0, fx: [], sfx: [],
      stats: { bytes: 0, snaps: 0, winStart: this.now, bps: 0, rate: 0, last: 0, skipped: 0, starved: 0, dropped: 0 },
      chatTokens: CHAT_BURST,
      chatAt: this.now,
    };
    this.seats[index] = seat;
    this.bind(seat, link);
    link.sendMsg({ t: 'welcome', v: PROTO, slot: index, token: seat.token, lobby: this.lobby } satisfies HostMsg);
    this.onNotice(`${seat.profile.name} joined`, 'info');
    this.broadcastLobby();
  }

  /** The same guest, back after a drop (or a refresh): new link, same seat and player. */
  private rejoin(s: Seat, link: NetLink, m: Extract<GuestMsg, { t: 'hello' }>): void {
    if (s.link && s.link !== link) {
      s.link.onClose = null;
      s.link.close('replaced');
    }
    this.bind(s, link);
    s.profile = { ...m.profile, name: s.profile.name };
    s.queue.length = 0;
    s.lastQueued = s.lastApplied = 0;
    s.lastInput = null;
    s.lastIa = -1;
    s.paused = false;
    s.waitUntil = 0;
    this.resetStream(s);
    link.sendMsg({ t: 'welcome', v: PROTO, slot: s.index, token: s.token, lobby: this.lobby } satisfies HostMsg);
    if ((this.lobby.inRun || this.inHub) && this.startCfg) {
      // the guest rebuilds its mirror from scratch: its stream restarts with a full snapshot and the
      // whole dictionary (the other guests' streams are untouched)
      link.sendMsg({ t: 'start', cfg: this.startCfg, resume: true, slot: s.index, epoch: this.epoch } satisfies HostMsg);
      this.resendDraft(s);
      if (this.hostPaused) link.sendMsg({ t: 'pause', by: this.self.name } satisfies HostMsg);
      s.prize = 0;
      this.holdKey = ''; // and hears what the night is waiting on
    }
    this.onNotice(`${s.profile.name} reconnected`, 'info');
    this.broadcastLobby();
  }

  /** Start a guest's delta stream over: its next snapshot is complete and carries every dictionary entry. */
  private resetStream(s: Seat): void {
    s.enc = new SnapshotEncoder();
    s.snapSeq = 0;
    s.ackSnap = 0;
    s.dictAck = 0;
    s.snapAcc = 0;
    s.fx.length = 0;
    s.sfx.length = 0;
  }

  private uniqueName(name: string): string {
    const taken = new Set([this.self.name, ...this.guests.map((s) => s.profile.name)]);
    if (!taken.has(name)) return name;
    for (let k = 2; ; k++) {
      const n = `${name.slice(0, 13)} ${k}`;
      if (!taken.has(n)) return n;
    }
  }

  /** Lobby only: free a seat and close the gap, so seat index = player index when the night starts. */
  private removeSeat(s: Seat): void {
    const rest = this.guests.filter((x) => x !== s);
    this.seats.fill(null);
    rest.forEach((x, k) => {
      x.index = k + 1;
      this.seats[k + 1] = x;
    });
  }

  private bind(s: Seat, link: NetLink): void {
    s.link = link;
    s.connected = true;
    s.lastHeard = this.now;
    s.heard = true;
    s.goneAt = 0;
    link.onMsg = (raw) => this.onMsg(s, link, raw);
    link.onBin = (buf) => this.onBin(s, link, buf);
    link.onClose = (reason) => {
      if (s.link === link) this.lost(s, reason === 'left' ? 'left' : 'connection lost');
    };
  }

  /** A guest's link went away (closed, timed out, or they left). */
  private lost(s: Seat, why: string): void {
    if (!s.connected) return;
    s.connected = false;
    s.link?.close('bye');
    s.link = null;
    s.goneAt = this.now;
    s.queue.length = 0;
    s.prize = 0;
    s.paused = false;
    if (this.lobby.inRun) {
      if (why === 'left') this.onNotice(`${s.profile.name} left the run`, 'warn');
      else {
        s.waitUntil = this.now + RECONNECT_WAIT;
        this.onNotice(`${s.profile.name} lost connection — waiting for them to rejoin`, 'warn');
      }
    } else {
      this.removeSeat(s);
      this.onNotice(`${s.profile.name} ${why === 'left' ? 'left' : 'disconnected'}`, 'warn');
    }
    this.broadcastLobby();
  }

  /** Stop waiting for dropped guests and carry on without them (their characters stand idle). */
  continueWithout(): void {
    for (const s of this.guests) s.waitUntil = 0;
  }

  kick(i: number): void {
    const s = this.seats[i];
    if (!s || i === 0) return;
    if (s.link) this.refuse(s.link, 'kicked');
    s.link = null;
    s.connected = false;
    if (!this.lobby.inRun) this.removeSeat(s);
    this.broadcastLobby();
  }

  close(reason = 'The host closed the lobby.'): void {
    this.detachGame();
    for (const p of this.pending) p.link.close('closed');
    this.pending = [];
    for (const s of this.guests) {
      if (!s.link) continue;
      s.link.onClose = null;
      s.link.sendMsg({ t: 'bye', reason } satisfies HostMsg);
      s.link.close('closed');
    }
    this.seats.fill(null);
    this.onClosed(reason);
  }

  // ------------------------------------------------------------------ guest traffic
  private onMsg(s: Seat, link: NetLink, raw: unknown): void {
    if (s.link !== link) return;
    if (!s.limiter.take(this.now)) return this.strike(s, 2);
    const m = parseGuestMsg(raw);
    if (!m) return this.strike(s, 1);
    s.heard = true;
    switch (m.t) {
      case 'hello':
        return;
      case 'pick':
        if (this.lobby.inRun) return;
        s.character = m.character;
        s.ready = false;
        return this.broadcastLobby();
      case 'ready':
        if (this.lobby.inRun) return;
        s.ready = m.ready && !!s.character;
        if (m.away !== undefined) s.away = m.away;
        return this.broadcastLobby();
      case 'profile':
        // perks and unlocks for the next night; the seat keeps its name (and the lobby hears of it: a companion
        // chosen on the Midway follows at once, D-84)
        s.profile = { ...m.profile, name: s.profile.name };
        return this.broadcastLobby();
      case 'view':
        s.view = { hx: m.hx, hy: m.hy };
        return;
      case 'draft':
        return this.guestDraft(s, m);
      case 'prize_done':
        s.prize = Math.max(0, s.prize - 1);
        return;
      case 'pause':
        if (!this.lobby.inRun || s.paused === m.on) return;
        s.paused = m.on;
        this.onGuestPause(m.on, s.profile.name);
        return;
      case 'ping':
        link.sendMsg({ t: 'pong', at: m.at } satisfies HostMsg);
        return;
      case 'pong': {
        const rtt = this.now - m.at;
        if (rtt >= 0 && rtt < 30000) {
          if (s.rtt) s.jitter += (Math.abs(rtt - s.rtt) - s.jitter) * 0.2;
          s.rtt = s.rtt ? s.rtt + (rtt - s.rtt) * 0.3 : rtt;
        }
        return;
      }
      case 'chat':
        return this.guestChat(s, m.text);
      case 'leave':
        return this.lost(s, 'left');
    }
  }

  // ------------------------------------------------------------------ chat (D-65)
  /** A guest's line: a few in a burst, then about one every CHAT_REFILL ms; anything faster is dropped. */
  private guestChat(s: Seat, text: string): void {
    s.chatTokens = Math.min(CHAT_BURST, s.chatTokens + (this.now - s.chatAt) / CHAT_REFILL);
    s.chatAt = this.now;
    if (s.chatTokens < 1) return;
    s.chatTokens -= 1;
    this.relayChat(s.index, s.profile.name, text);
  }

  /** The host says something to the whole party. */
  say(text: string): void {
    const t = cleanChat(text);
    if (t) this.relayChat(0, this.self.name, t);
  }

  private relayChat(from: number, name: string, text: string): void {
    this.broadcast({ t: 'chat', from, name, text });
    this.onChat(from, name, text);
  }

  /** Malformed or flooding traffic: tolerated a little (bugs happen), then the guest is dropped. */
  private strike(s: Seat, n: number): void {
    s.invalid += n;
    if (s.invalid > 60 && s.link) {
      this.onNotice(`${s.profile.name} was disconnected (invalid network traffic)`, 'warn');
      const l = s.link;
      this.lost(s, 'left');
      this.refuse(l, 'kicked');
    }
  }

  private onBin(s: Seat, link: NetLink, buf: ArrayBuffer): void {
    if (s.link !== link) return;
    if (!s.binLimiter.take(this.now)) return this.strike(s, 1);
    if (binType(buf) !== BIN_INPUT) return this.strike(s, 1);
    const pk = decodeInputPacket(buf);
    if (!pk) return this.strike(s, 1);
    s.heard = true;
    // another game's inputs, still on the wire across a restart (D-76): fresh ones restart their numbering,
    // so letting an old one through made every new input look stale (the guest stood behind an invisible wall)
    if (pk.epoch !== this.epoch) return;
    if (pk.dictSize <= this.dict.size) s.dictAck = Math.max(s.dictAck, pk.dictSize);
    s.ackSnap = Math.max(s.ackSnap, Math.min(pk.ackSnap, s.snapSeq));
    for (const i of pk.inputs) {
      if (i.seq <= s.lastQueued) continue; // redundant copy or reordered duplicate
      if (s.lastQueued && i.seq > s.lastQueued + 120) continue; // implausible jump
      s.queue.push(i);
      s.lastQueued = i.seq;
      s.lastInputAt = this.now;
    }
  }

  private guestDraft(s: Seat, m: Extract<GuestMsg, { t: 'draft' }>): void {
    const g = this.game;
    const pi = s.index;
    if (!g || !g.draftPending(pi)) return;
    const hand = g.drafts[pi]!;
    switch (m.op) {
      case 'choose':
        if (m.index! < hand.length && !hand[m.index!].disabled) g.chooseDraft(m.index!, pi);
        break;
      case 'skip':
        g.skipDraft(pi);
        break;
      case 'reroll':
        g.rerollDraft(pi);
        break;
      case 'banish':
        g.banishDraft(m.index!, pi);
        break;
    }
    // a refused choice (stale, disabled, out of tokens): show the guest their real hand again
    if ((m.op === 'choose' || m.op === 'skip') && g.draftPending(pi)) this.resendDraft(s);
  }

  private resendDraft(s: Seat): void {
    const g = this.game;
    if (g?.draftPending(s.index)) this.sendTo(s, this.draftMsg(g, s.index, g.drafts[s.index]!));
  }

  private draftMsg(g: Game, i: number, options: unknown): HostMsg {
    const p = g.players[i];
    // the build the hand was dealt from rides with it (D-79): the next hand can arrive before the snapshot
    // carrying the pick just made, and the recipe bands must count that pick
    return { t: 'ev', type: 'draft', e: { options, player: i, rerolls: p.rerolls, banishes: p.banishes, canSkip: p.canSkip, level: g.level, build: buildOf(p) } };
  }

  // ------------------------------------------------------------------ the run
  attachGame(g: Game): void {
    this.detachGame();
    this.game = g;
    this.dict = new StringDict();
    this.lastTickAt = this.now;
    this.prizeHost = 0;
    this.holdKey = '';
    for (const s of this.guests) {
      this.resetStream(s);
      s.queue.length = 0;
      s.lastQueued = s.lastApplied = 0;
      s.lastInput = null;
      s.lastIa = -1;
      s.prize = 0;
    }
    for (const type of FORWARDED_EVENTS) {
      this.unsub.push(g.bus.on(type as keyof GameEvents, (e) => this.forward(type, e)));
    }
    this.unsub.push(g.bus.on('chest', () => {
      this.prizeHost++;
      for (const s of this.live) s.prize++;
    }));
    this.unsub.push(g.bus.on('sfx', (e) => {
      for (const s of this.live) if (s.sfx.length < 120) s.sfx.push(e);
    }));
  }

  detachGame(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
    this.game = null;
    for (const s of this.guests) {
      s.fx.length = 0;
      s.sfx.length = 0;
    }
  }

  /** Forward one host-side game event (per-player events only to the player they are about). */
  private forward(type: string, e: unknown): void {
    const g = this.game;
    if (!g) return;
    const ev = e as { player?: number; options?: unknown; stats?: unknown };
    const pl = ev?.player ?? 0;
    switch (type) {
      case 'draft': {
        const s = this.seats[pl];
        if (s) this.sendTo(s, this.draftMsg(g, pl, ev.options));
        return;
      }
      case 'draft_done':
      case 'player_hurt':
      case 'shield_pop':
      case 'meta_currency':
      case 'pickup': {
        const s = this.seats[pl];
        if (s) this.sendTo(s, { t: 'ev', type, e });
        return;
      }
      case 'run_end':
        for (const s of this.live) this.sendTo(s, { t: 'ev', type, e: { stats: g.endStatsAll[s.index] ?? ev.stats } });
        return;
    }
    this.broadcast({ t: 'ev', type, e });
  }

  /** Feed each guest's next buffered input into their player; call right before every `g.tick()`. */
  beforeTick(g: Game): void {
    this.lastTickAt = this.now;
    for (let i = 1; i < g.players.length; i++) {
      const inp = g.inputs[i];
      const s = this.seats[i];
      if (!inp) continue;
      if (!s?.connected) {
        inp.moveX = inp.moveY = 0;
        inp.aimActive = false;
        continue;
      }
      // Every guest input should be applied exactly once, in order. Frames on either machine arrive
      // unevenly (a 144 Hz display ticks on some frames and not others; a busy frame runs several
      // ticks), so the buffer breathes; only a backlog that persists — latency the guest would feel —
      // is shaved, one input at a time, and only a huge one (a stall) is cut at once.
      if (s.queue.length > 30) this.dropInputs(s, s.queue.length - 4);
      // (engineering optimization pass) a backlog deeper than 3 that persists is latency the guest
      // feels on every action (each queued input is 17 ms): shave it from 4, not 5
      if (s.queue.length > 3) {
        if (++s.deepTicks > 30) {
          this.dropInputs(s, 1);
          s.deepTicks = 20;
        }
      } else s.deepTicks = 0;
      // ticks covered by repeating a late input are owed back: once the late inputs arrive, the one each
      // repeat stood in for is skipped, so a lost or late packet doesn't leave the queue a tick deeper
      // (and the guest a tick laggier) for the rest of the night. Two inputs stay as a cushion against
      // jitter: emptier than that, ordinary arrival jitter starves the queue and costs corrections.
      while (s.owed > 0 && s.queue.length > 2) {
        this.dropInputs(s, 1);
        s.stats.dropped--; // not a trim: the repeat already played that tick
        s.owed--;
      }
      let next = s.queue.shift();
      if (next) {
        s.lastApplied = next.seq;
        s.lastInput = next;
        s.repeats = 0;
      } else if (s.lastInput && s.repeats < 2 && this.now - s.lastInputAt < 250) {
        // a packet a tick or two late: keep doing what they were doing (prediction absorbs it)
        s.repeats++;
        s.owed++;
        s.stats.starved++;
        next = s.lastInput;
      } else {
        // nothing to apply: stand still until their next input arrives
        inp.moveX = inp.moveY = 0;
        inp.aimActive = false;
        continue;
      }
      inp.moveX = next.mx;
      inp.moveY = next.my;
      inp.aimX = next.ax;
      inp.aimY = next.ay;
      inp.aimActive = next.aim;
      // a changed interact count is a press (or several, folded into one) for this tick
      const ia = next.ia ?? 0;
      if (s.lastIa >= 0 && ia !== s.lastIa) inp.interact = true;
      s.lastIa = ia;
    }
  }

  private dropInputs(s: Seat, n: number): void {
    const gone = s.queue.splice(0, n);
    s.stats.dropped += gone.length;
    if (gone.length) s.lastApplied = gone[gone.length - 1].seq;
  }

  /** Keep the frame's cosmetic events for each guest's next snapshot (call before the renderer drains them). */
  captureFx(events: FxEvent[]): void {
    for (const s of this.live) for (const e of events) if (s.fx.length < 400) s.fx.push(e);
  }

  /** The host finished watching a prize wheel. */
  prizeHostDone(): void {
    this.prizeHost = Math.max(0, this.prizeHost - 1);
    if (this.prizeHost === 0) this.prizeHostDoneAt = this.now;
    for (const s of this.live) if (s.prize > 0) this.sendTo(s, { t: 'prize_wait', waiting: true });
  }

  setPaused(on: boolean): void {
    if (this.hostPaused === on) return;
    this.hostPaused = on;
    this.broadcast({ t: 'pause', by: on ? this.self.name : null });
  }

  /** Per frame: timeouts, pings, waits, snapshots. `now` in ms. */
  update(now: number, dtMs: number): void {
    const gap = now - this.now;
    this.now = now;
    for (const p of [...this.pending]) if (now - p.at > HELLO_TIMEOUT) this.refuse(p.link, 'bad_hello');
    const ping = now - this.lastPing > PING_EVERY;
    if (ping) this.lastPing = now;
    for (const s of this.live) {
      // messages are stamped here, not on arrival: if this tab stalled, traffic that came in meanwhile
      // still counts as fresh rather than as ten silent seconds
      if (s.heard) {
        s.lastHeard = now;
        s.heard = false;
      } else if (gap > STALL) s.lastHeard += gap;
      if (now - s.lastHeard > LINK_TIMEOUT) this.lost(s, 'timeout');
      else if (ping) this.sendTo(s, { t: 'ping', at: now });
    }
    if (ping && !this.lobby.inRun && this.live.length) this.broadcastLobby(); // refresh the latency readouts
    for (const s of this.guests) {
      if (s.waitUntil && now > s.waitUntil) {
        this.onNotice(`Carrying on without ${s.profile.name}`, 'warn');
        s.waitUntil = 0;
      }
    }
    const g = this.game;
    if (g) {
      for (const s of this.guests) {
        // an absent player's level-up must not hold the night: take their first card for them
        if (!s.connected && !s.waitUntil && g.draftPending(s.index)) g.chooseDraft(Math.max(0, g.drafts[s.index]!.findIndex((o) => !o.disabled)), s.index);
        // the night is frozen (draft, prize wheel, pause): inputs that arrive now were predicted by a
        // guest who had not heard yet — count them as spent so its prediction snaps to the truth
        if (s.queue.length && now - this.lastTickAt > 150) this.dropInputs(s, s.queue.length);
      }
      // a guest who never finishes watching a prize wheel cannot hold the night forever
      if (this.prizeHost === 0 && now - this.prizeHostDoneAt > PRIZE_WAIT) for (const s of this.live) s.prize = 0;
    }
    this.updateHold();
    this.updateDiag();
    // the damage meter and everyone's Lost Tickets so far (D-85): the guests' mirrors never tick
    if (g && !g.hub && this.live.length && now - this.lastMeter >= METER_EVERY) {
      this.lastMeter = now;
      this.broadcast({ t: 'meter', m: meterToWire(meterState(g)) });
    }
    for (const s of this.live) this.snapshot(s, now, dtMs);
  }

  /** Work out what the night is waiting on; tell the guests when that changes. */
  private updateHold(): void {
    const g = this.game;
    let why: HoldWhy = '';
    let who: number[] = [];
    if (g) {
      const gone = this.guests.filter((s) => s.waitUntil > 0).map((s) => s.index);
      const paused = [...(this.hostPaused ? [0] : []), ...this.live.filter((s) => s.paused).map((s) => s.index)];
      if (gone.length) [why, who] = ['reconnect', gone];
      else if (paused.length) [why, who] = ['pause', paused];
      else if (g.phase === 'draft') [why, who] = ['draft', g.players.filter((p) => g.draftPending(p.index)).map((p) => p.index)];
      else if (!this.prizeReady) [why, who] = ['prize', [...(this.prizeHost > 0 ? [0] : []), ...this.live.filter((s) => s.prize > 0).map((s) => s.index)]];
    }
    this.hold = { why, who };
    const key = `${why}:${who.join(',')}`;
    if (key !== this.holdKey) {
      this.holdKey = key;
      this.broadcast({ t: 'hold', why, who });
    }
  }

  /** The F3 panel: totals across guests, the slowest link's latency, and a line per guest. */
  private updateDiag(): void {
    const d = this.diag, live = this.live;
    const sum = (f: (s: Seat) => number) => live.reduce((t, s) => t + f(s), 0);
    const max = (f: (s: Seat) => number) => live.reduce((t, s) => Math.max(t, f(s)), 0);
    d.connected = live.length > 0;
    d.rtt = max((s) => s.rtt);
    d.jitter = max((s) => s.jitter);
    d.buffered = max((s) => s.link?.pressure?.() ?? 0);
    d.inputQueue = max((s) => s.queue.length);
    d.bytesPerSec = sum((s) => s.stats.bps);
    d.snapRate = live.length ? sum((s) => s.stats.rate) / live.length : 0;
    d.snapBytes = max((s) => s.stats.last);
    d.skipped = sum((s) => s.stats.skipped);
    d.starved = sum((s) => s.stats.starved);
    d.dropped = sum((s) => s.stats.dropped);
    d.invalid = this.guests.reduce((t, s) => t + s.invalid, 0);
    const links = live.map((s) => s.link!.stats());
    d.unreliable = links.length > 0 && links.every((l) => l.unreliable);
    d.route = [...new Set(links.map((l) => l.route || '?'))].join('/');
    d.peers = live.map((s, k) => ({ name: s.profile.name, rtt: s.rtt, kbps: s.stats.bps / 1024, route: links[k].route, queue: s.queue.length }));
  }

  private snapshot(s: Seat, now: number, dtMs: number): void {
    const g = this.game;
    const p = g?.players[s.index];
    if (!g || !p || !s.link) return;
    const st = s.stats;
    s.snapAcc += dtMs;
    // very busy nights send a little less often (interpolation covers it), and so does a big party
    // sharing the host's upload; prediction keeps each guest's own movement immediate either way
    // (engineering optimization pass) small snapshots go out at 30 Hz for up to two guests: the guest
    // then draws the world ~17 ms closer to the host's present, for no more bandwidth than a busy night
    // at 20 Hz already takes (2 KB × 30); hysteresis keeps the rate from flapping
    s.fast = s.fast ? st.last <= 2300 : st.last <= 1800;
    const hz = st.last > 12000 ? 12 : st.last > 6000 || (this.live.length >= 3 && st.last > 3000) ? 15 : s.fast && this.live.length <= 2 ? SNAPSHOT_HZ_FAST : SNAPSHOT_HZ;
    const every = 1000 / hz;
    if (s.snapAcc < every) return;
    s.snapAcc = Math.min(s.snapAcc - every, every);
    if ((s.link.pressure?.() ?? 0) > 128 * 1024) {
      // the network is not keeping up: skip this one rather than queue stale state
      st.skipped++;
      return;
    }
    const view = { x: p.x, y: p.y, hx: s.view.hx, hy: s.view.hy };
    const buf = s.enc.encode(g, { seq: ++s.snapSeq, epoch: this.epoch, ackInput: s.lastApplied, ackSnap: s.ackSnap, dict: this.dict, dictFrom: s.dictAck, view, fx: s.fx, sfx: s.sfx, frozen: this.paused || !this.prizeReady });
    s.fx.length = 0;
    s.sfx.length = 0;
    s.link.sendBin(buf);
    st.last = buf.byteLength;
    st.bytes += buf.byteLength;
    st.snaps++;
    if (now - st.winStart >= 1000) {
      const k = 1000 / Math.max(1, now - st.winStart);
      st.bps = st.bytes * k;
      st.rate = st.snaps * k;
      st.bytes = st.snaps = 0;
      st.winStart = now;
    }
  }
}

// =================================================================================== guest
export type GuestState = 'connecting' | 'lobby' | 'run' | 'closed';

export class GuestSession {
  state: GuestState = 'connecting';
  lobby: LobbyState | null = null;
  slot = 1;
  token: string | null;
  startCfg: StartCfg | null = null;
  game: Game | null = null;
  replica: Replica | null = null;
  pausedBy: string | null = null;
  /** the host finished its prize wheel and is waiting for ours */
  prizeWait = false;
  /** what the host's night is waiting on (player indices), for the waiting note */
  hold: { why: HoldWhy; who: number[] } = { why: '', who: [] };
  partnerConnected = true;
  closeReason = '';
  private seq = 0;
  /** the game the host says is running (D-76): inputs carry it, and snapshots of another game are dropped */
  private epoch = 0;
  private recent: NetInput[] = [];
  /** interact presses so far, sent with every input (D-67) */
  private ia = 0;
  private writer = new Writer(128);
  private lastPing = 0;
  private lastHeard = 0;
  /** something arrived since the last update (stamped there, so a stalled tab never fakes a timeout) */
  private heard = false;
  private lastSend = 0;
  private now = 0;
  private bytesWin = 0;
  private snapsWin = 0;
  private winStart = 0;
  readonly diag = blankDiag('guest');
  /** the host refused this build: true if the host is newer, false if older, null if unknown */
  onVersionRefused: ((hostNewer: boolean | null) => void) | null = null;

  // UI hooks
  onWelcome: (lobby: LobbyState) => void = () => {};
  onLobby: (lobby: LobbyState) => void = () => {};
  /** build the mirror Game from the shared config (the session creates the replica around it) */
  onStart: (cfg: StartCfg, resume: boolean) => Game | null = () => null;
  onEvent: (type: string, e: unknown) => void = () => {};
  onPause: (by: string | null) => void = () => {};
  onToLobby: () => void = () => {};
  onClosed: (reason: string) => void = () => {};
  /** a chat line from anyone in the party, this guest's own included once the host relays it (D-65) */
  onChat: (from: number, name: string, text: string) => void = () => {};

  constructor(readonly link: NetLink, public profile: GuestProfile, token?: string | null, now = 0) {
    this.token = token ?? null;
    this.now = this.lastHeard = now;
    link.onMsg = (raw) => this.onMsg(raw);
    link.onBin = (buf) => this.onBin(buf);
    // a host that leaves on purpose says why first ('bye' / 'reject'); a bare close is a dropped link
    link.onClose = () => this.closed('Lost connection to the host.');
    link.sendMsg({ t: 'hello', v: PROTO, profile, token: this.token ?? undefined, sim: BUILD.sim, time: BUILD.time } satisfies GuestMsg);
  }

  private send(m: GuestMsg): void {
    if (this.state !== 'closed') this.link.sendMsg(m);
  }

  pick(character: string | null): void {
    this.send({ t: 'pick', character });
  }
  setReady(ready: boolean, away?: boolean): void {
    this.send({ t: 'ready', ready, away });
  }
  /** This save changed (a Lost & Found visit, D-74): the host uses the new perks and unlocks next night. */
  sendProfile(p: GuestProfile): void {
    this.profile = p;
    this.send({ t: 'profile', profile: p });
  }
  sendView(hx: number, hy: number): void {
    this.send({ t: 'view', hx, hy });
  }
  draft(op: 'choose' | 'skip' | 'reroll' | 'banish', index?: number): void {
    this.send({ t: 'draft', op, index });
  }
  prizeDone(): void {
    this.prizeWait = false;
    this.send({ t: 'prize_done' });
  }
  pause(on: boolean): void {
    this.send({ t: 'pause', on });
  }
  /** Say something to the party (the host relays it to everyone, this guest included). */
  say(text: string): void {
    const t = cleanChat(text);
    if (t) this.send({ t: 'chat', text: t });
  }
  leave(): void {
    if (this.state === 'closed') return;
    this.send({ t: 'leave' });
    this.state = 'closed';
    this.link.onClose = null;
    this.link.close('left');
  }

  private closed(reason: string): void {
    if (this.state === 'closed') return;
    this.state = 'closed';
    this.closeReason = reason;
    this.onClosed(reason);
  }

  private onMsg(raw: unknown): void {
    const m = parseHostMsg(raw);
    if (!m) return;
    this.heard = true;
    switch (m.t) {
      case 'welcome':
        this.slot = m.slot;
        this.token = m.token;
        this.lobby = m.lobby;
        this.state = m.lobby.inRun ? this.state : 'lobby';
        this.onWelcome(m.lobby);
        return;
      case 'reject':
        if (m.reason === 'version') this.onVersionRefused?.(m.detail === 'host-newer' ? true : m.detail === 'host-older' ? false : null);
        this.closed(m.reason === 'version' && m.detail === 'host-newer'
          ? 'The host is playing a newer version of the game. Restart & Update, then join again.'
          : m.reason === 'version' && m.detail === 'host-older'
            ? 'The host is playing an older version of the game. Ask them to restart and update, then try again.'
            : REJECT_TEXT[m.reason] ?? 'The host refused the connection.');
        this.link.onClose = null;
        this.link.close('rejected');
        return;
      case 'lobby':
        this.lobby = m.lobby;
        if (m.you && !m.lobby.inRun) this.slot = m.you; // seats close up when someone leaves the lobby
        this.onLobby(m.lobby);
        return;
      case 'start': {
        if (m.slot) this.slot = m.slot;
        this.startCfg = m.cfg;
        this.hold = { why: '', who: [] };
        this.pausedBy = null;
        this.prizeWait = false;
        this.seq = 0;
        this.recent.length = 0;
        this.epoch = m.epoch ?? 0;
        const g = this.onStart(m.cfg, !!m.resume);
        if (!g) return;
        this.game = g;
        // its damage meter waits on the host's (D-85): zeros until the first one, not the idle mirror's numbers
        g.netMeter = [];
        this.replica = new Replica(g, this.slot);
        this.state = 'run';
        return;
      }
      case 'ev':
        if (this.state !== 'run' || !this.game) return;
        if (m.type === 'draft') {
          // the hand can arrive before the snapshot that carries the new level and tokens
          const e = m.e as { rerolls?: number; banishes?: number; canSkip?: boolean; level?: number };
          const p = this.game.players[this.slot];
          if (p && typeof e?.rerolls === 'number') {
            p.rerolls = e.rerolls;
            p.banishes = e.banishes ?? 0;
            p.canSkip = !!e.canSkip;
          }
          if (typeof e?.level === 'number' && e.level > 0 && e.level < 10000) this.game.level = e.level;
        }
        this.onEvent(m.type, m.e);
        return;
      case 'pause':
        this.pausedBy = m.by;
        this.onPause(m.by);
        return;
      case 'prize_wait':
        this.prizeWait = m.waiting;
        return;
      case 'hold':
        this.hold = { why: m.why, who: m.who };
        return;
      case 'partner':
        this.partnerConnected = m.connected;
        return;
      case 'to_lobby':
        this.state = 'lobby';
        this.game = null;
        this.replica = null;
        this.onToLobby();
        return;
      case 'chat':
        this.onChat(m.from, m.name, m.text);
        return;
      case 'meter':
        if (this.state === 'run' && this.game && !this.game.hub) this.game.netMeter = meterFromWire(m.m);
        return;
      case 'ping':
        this.link.sendMsg({ t: 'pong', at: m.at } satisfies GuestMsg);
        return;
      case 'pong': {
        const rtt = this.now - m.at;
        if (rtt >= 0 && rtt < 30000) {
          if (this.diag.rtt) this.diag.jitter = (this.diag.jitter ?? 0) + (Math.abs(rtt - this.diag.rtt) - (this.diag.jitter ?? 0)) * 0.2;
          this.diag.rtt = this.diag.rtt ? this.diag.rtt + (rtt - this.diag.rtt) * 0.3 : rtt;
        }
        return;
      }
      case 'bye':
        this.link.onClose = null;
        this.closed(m.reason || 'The host closed the lobby.');
        this.link.close('bye');
        return;
    }
  }

  private onBin(buf: ArrayBuffer): void {
    if (!(buf instanceof ArrayBuffer) || buf.byteLength > 1 << 20 || binType(buf) !== BIN_SNAPSHOT) return;
    const r = this.replica;
    if (!r) return;
    this.heard = true;
    // another game's snapshot, still on the wire across a restart (D-76): dropped before decoding, so its
    // string table never mixes into the new game's
    if (snapshotEpoch(buf) !== this.epoch) return;
    try {
      r.apply(decodeSnapshot(buf, r.dict), this.now);
    } catch {
      this.diag.invalid++;
      return;
    }
    this.diag.snapBytes = buf.byteLength;
    this.bytesWin += buf.byteLength;
    this.snapsWin++;
  }

  /**
   * One fixed-step sample of local input (call at the sim rate while the night is running): predicts
   * the local character and sends the input with the previous few for loss cover.
   */
  step(mx: number, my: number, ax: number, ay: number, aim: boolean): void {
    if (this.state !== 'run' || !this.replica) return;
    const inp: NetInput = { seq: ++this.seq, mx, my, ax, ay, aim, ia: this.ia };
    this.recent.push(inp);
    if (this.recent.length > INPUT_REDUNDANCY) this.recent.shift();
    this.replica.predict(inp.seq, mx, my);
    this.sendInputs();
  }

  /** The local player pressed interact (E, or A on a pad): it rides out with the next inputs. */
  interact(): void {
    this.ia = (this.ia + 1) & 255;
  }

  private sendInputs(): void {
    const r = this.replica;
    if (!r) return;
    this.lastSend = this.now;
    this.link.sendBin(encodeInputPacket({ epoch: this.epoch, ackSnap: r.last?.seq ?? 0, dictSize: r.dict.size, inputs: this.recent }, this.writer));
  }

  /** Per frame: keepalive acks while not stepping, pings, link timeout, diagnostics. */
  update(now: number): void {
    const gap = now - this.now;
    this.now = now;
    if (this.state === 'closed') return;
    if (this.heard) {
      this.lastHeard = now;
      this.heard = false;
    } else if (gap > STALL) this.lastHeard += gap;
    if (now - this.lastHeard > LINK_TIMEOUT && this.state !== 'connecting') {
      this.link.onClose = null;
      this.link.close('timeout');
      this.closed('Lost connection to the host.');
      return;
    }
    if (this.state === 'connecting' && now - this.lastHeard > HELLO_TIMEOUT + 4000) {
      this.link.onClose = null;
      this.link.close('timeout');
      this.closed('The host did not answer.');
      return;
    }
    if (now - this.lastPing > PING_EVERY) {
      this.lastPing = now;
      this.send({ t: 'ping', at: now });
    }
    // acks (snapshot seq + dictionary size) must keep flowing during drafts and pauses; the last few
    // inputs ride along again, so a lost final packet still reaches the host (it ignores duplicates)
    if (this.state === 'run' && now - this.lastSend > 100) this.sendInputs();
    const r = this.replica;
    if (r) {
      this.diag.predErr = r.predErr;
      this.diag.interval = r.interval;
      this.diag.snapLost = r.dropped;
      this.diag.corrections = r.corrections;
      // how far behind the host's present the guest sees the world: the trip over, plus the snapshot interval
      this.diag.interpDelay = this.diag.rtt / 2 + r.interval;
      this.diag.buffered = this.link.pressure?.() ?? 0;
    }
    if (now - this.winStart >= 1000) {
      const k = 1000 / Math.max(1, now - this.winStart);
      this.diag.bytesPerSec = this.bytesWin * k;
      this.diag.snapRate = this.snapsWin * k;
      this.bytesWin = this.snapsWin = 0;
      this.winStart = now;
    }
    const st = this.link.stats();
    this.diag.connected = this.state !== 'connecting';
    this.diag.unreliable = st.unreliable;
    this.diag.route = st.route;
  }
}
