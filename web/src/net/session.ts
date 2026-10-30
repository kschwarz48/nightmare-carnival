// Online co-op sessions (D-52). The host's browser is authoritative: it runs the only simulation,
// seats one guest, applies the guest's inputs through a small jitter buffer, and streams snapshots
// plus the gameplay events the guest's UI needs. The guest keeps a mirror Game fed by a Replica and
// predicts only its own character. Both classes are UI-free and transport-free (they speak NetLink),
// so the whole flow — lobby, start, drafts, prize wheel, pause, disconnect, reconnect — runs headless
// in tests over the loopback network.

import type { Game, GameEvents, RunConfig } from '../sim/game';
import type { FxEvent } from '../sim/fx';
import { StringDict, Writer } from './codec';
import { randomToken } from './codes';
import type { NetLink } from './link';
import {
  BIN_INPUT, BIN_SNAPSHOT, FORWARDED_EVENTS, INPUT_REDUNDANCY, PROTO, REJECT_TEXT, RateLimiter, SNAPSHOT_HZ,
  binType, decodeInputPacket, encodeInputPacket, parseGuestMsg, parseHostMsg,
  type GuestMsg, type GuestProfile, type HostMsg, type LobbyState, type NetInput, type RejectReason, type StartCfg,
} from './protocol';
import { Replica } from './replica';
import { SnapshotEncoder, decodeSnapshot, type SfxEvt } from './snapshot';

export const HELLO_TIMEOUT = 8000;
export const LINK_TIMEOUT = 10000;
export const PING_EVERY = 1000;
/** How long the host's run waits (paused) for a dropped guest before carrying on without them. */
export const RECONNECT_WAIT = 20000;
/** Longest the host waits for the guest to finish watching a prize wheel. */
export const PRIZE_WAIT = 30000;

export interface HostProfile {
  name: string;
  meta: { axis: string; value: number }[];
  rerolls: number;
  banishes: number;
  canSkip: boolean;
  aimMode: GuestProfile['aimMode'];
}

interface Seat {
  link: NetLink | null;
  profile: GuestProfile;
  token: string;
  character: string | null;
  ready: boolean;
  connected: boolean;
  lastHeard: number;
  rtt: number;
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
  /** consecutive ticks covered by repeating the last input while the buffer was empty */
  repeats: number;
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
    players: c.players.map((p) => ({ character: p.character, name: p.name, meta: p.meta, rerolls: p.rerolls, banishes: p.banishes, canSkip: p.canSkip, aimMode: p.aimMode })),
  };
}

// =================================================================================== host
export class HostSession {
  readonly lobby: LobbyState;
  seat: Seat | null = null;
  game: Game | null = null;
  startCfg: StartCfg | null = null;
  hostCharacter: string | null = null;
  hostReady = false;
  hostPaused = false;
  /** a dropped guest: the run pauses until they return, the wait expires, or the host carries on */
  waitingFor: string | null = null;
  private waitUntil = 0;
  private pending: { link: NetLink; at: number }[] = [];
  private dict = new StringDict();
  private enc = new SnapshotEncoder();
  private snapSeq = 0;
  private snapAcc = 0;
  private fx: FxEvent[] = [];
  private sfx: SfxEvt[] = [];
  private unsub: (() => void)[] = [];
  private lastPing = 0;
  private now = 0;
  private bytesWin = 0;
  private winStart = 0;
  private snapsWin = 0;
  // prize wheel: open presentations each side still has to finish
  private prizeHost = 0;
  private prizeGuest = 0;
  private prizeHostDoneAt = 0;
  /** when the night last advanced (inputs that arrive while it is frozen are spent, see update) */
  private lastTickAt = 0;
  readonly diag = blankDiag('host');

  // UI hooks
  onLobby: (l: LobbyState) => void = () => {};
  onNotice: (text: string, tone?: 'info' | 'warn') => void = () => {};
  onGuestPause: (paused: boolean, name: string) => void = () => {};
  onClosed: (reason: string) => void = () => {};

  constructor(code: string, readonly self: HostProfile) {
    this.lobby = { code, players: [this.lobbyHost(), null], difficulty: 'midway', curse: false, inRun: false };
  }

  get guestName(): string {
    return this.seat?.profile.name ?? 'Partner';
  }
  get guestConnected(): boolean {
    return !!this.seat?.connected;
  }
  /** The run must not advance: someone paused, or we are waiting for a dropped guest. */
  get paused(): boolean {
    return this.hostPaused || !!(this.seat?.connected && this.seat.paused) || !!this.waitingFor;
  }
  /** Every open prize wheel has been watched on both screens. */
  get prizeReady(): boolean {
    return this.prizeHost <= 0 && this.prizeGuest <= 0;
  }
  /** The host finished its wheel but the guest is still watching theirs. */
  get prizeWaitingOnGuest(): boolean {
    return this.prizeHost <= 0 && this.prizeGuest > 0;
  }

  private lobbyHost() {
    return { name: this.self.name, character: this.hostCharacter, ready: this.hostReady, connected: true, rtt: 0 };
  }

  private broadcastLobby(): void {
    const s = this.seat;
    this.lobby.players[0] = this.lobbyHost();
    this.lobby.players[1] = s ? { name: s.profile.name, character: s.character, ready: s.ready, connected: s.connected, rtt: Math.round(s.rtt) } : null;
    this.send({ t: 'lobby', lobby: this.lobby });
    this.onLobby(this.lobby);
  }

  private send(m: HostMsg): void {
    const l = this.seat?.link;
    if (l && this.seat!.connected) l.sendMsg(m);
  }

  // ------------------------------------------------------------------ lobby
  setCharacter(id: string | null): boolean {
    if (this.lobby.inRun) return false;
    if (id && this.seat?.character === id) return false; // characters are exclusive (VS rule)
    this.hostCharacter = id;
    this.hostReady = false;
    this.broadcastLobby();
    return true;
  }
  setReady(r: boolean): void {
    if (this.lobby.inRun) return;
    this.hostReady = r && !!this.hostCharacter;
    this.broadcastLobby();
  }
  setDifficulty(id: string, curse: boolean): void {
    if (this.lobby.inRun) return;
    this.lobby.difficulty = id;
    this.lobby.curse = curse;
    this.broadcastLobby();
  }
  canStart(): boolean {
    const s = this.seat;
    return !this.lobby.inRun && this.hostReady && !!this.hostCharacter && !!s && s.connected && s.ready && !!s.character && s.character !== this.hostCharacter;
  }

  /** Lock the lobby and tell the guest to build its mirror. Returns the shared run definition. */
  start(o: { seed: number; unlocked: string[]; questMemory: Record<string, number> }): StartCfg | null {
    if (!this.canStart()) return null;
    const s = this.seat!;
    const me = this.self;
    this.startCfg = {
      seed: o.seed >>> 0,
      difficulty: this.lobby.difficulty,
      curse: this.lobby.curse,
      unlocked: o.unlocked,
      questMemory: o.questMemory,
      players: [
        { character: this.hostCharacter!, name: me.name, meta: me.meta, aimMode: me.aimMode, rerolls: me.rerolls, banishes: me.banishes, canSkip: me.canSkip },
        { character: s.character!, name: s.profile.name, meta: s.profile.meta, aimMode: s.profile.aimMode, rerolls: s.profile.rerolls, banishes: s.profile.banishes, canSkip: s.profile.canSkip },
      ],
    };
    this.lobby.inRun = true;
    this.broadcastLobby();
    this.send({ t: 'start', cfg: this.startCfg });
    return this.startCfg;
  }

  /** After a run: everyone back to the lobby, connection kept. */
  backToLobby(): void {
    this.detachGame();
    this.lobby.inRun = false;
    this.hostReady = false;
    this.waitingFor = null;
    if (this.seat) {
      this.seat.ready = false;
      this.seat.paused = false;
      if (!this.seat.connected) this.seat = null;
    }
    this.send({ t: 'to_lobby' });
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

  private refuse(link: NetLink, reason: RejectReason): void {
    this.pending = this.pending.filter((x) => x.link !== link);
    link.onMsg = null;
    link.onBin = null;
    link.onClose = null;
    // the reject travels ahead of the close on the ordered channel (the transport flushes first)
    link.sendMsg({ t: 'reject', reason } satisfies HostMsg);
    link.close(reason);
  }

  private hello(link: NetLink, m: Extract<GuestMsg, { t: 'hello' }>): void {
    if (m.v !== PROTO) return this.refuse(link, 'version');
    const s = this.seat;
    const reconnect = !!s && !!m.token && m.token === s.token;
    if (s && s.connected && !reconnect) return this.refuse(link, 'full');
    if (this.lobby.inRun && !reconnect) return this.refuse(link, 'in_run');
    if (s && reconnect) {
      // the same guest, back after a drop: new link, same seat
      if (s.link && s.link !== link) {
        s.link.onClose = null;
        s.link.close('replaced');
      }
      this.bind(s, link);
      s.profile = { ...m.profile, name: s.profile.name };
      s.queue.length = 0;
      s.lastQueued = s.lastApplied = 0;
      s.lastInput = null;
      s.dictAck = 0;
      s.paused = false;
      link.sendMsg({ t: 'welcome', v: PROTO, slot: 1, token: s.token, lobby: this.lobby } satisfies HostMsg);
      if (this.lobby.inRun && this.startCfg) {
        // the guest rebuilds its mirror from scratch: fresh dictionary, full first snapshot
        this.dict = new StringDict();
        this.enc = new SnapshotEncoder();
        s.ackSnap = 0;
        link.sendMsg({ t: 'start', cfg: this.startCfg, resume: true } satisfies HostMsg);
        this.resendDraft();
        if (this.hostPaused) link.sendMsg({ t: 'pause', by: this.self.name } satisfies HostMsg);
        this.prizeGuest = 0;
      }
      if (this.waitingFor) this.waitingFor = null;
      this.onNotice(`${s.profile.name} reconnected`, 'info');
      this.broadcastLobby();
      return;
    }
    // a new guest takes the seat (any previous, disconnected guest's seat is released)
    const seat: Seat = {
      link: null, profile: m.profile, token: randomToken(), character: null, ready: false, connected: false, lastHeard: this.now, rtt: 0,
      view: { hx: 900, hy: 700 }, queue: [], lastQueued: 0, lastApplied: 0, lastInput: null, ackSnap: 0, dictAck: 0, invalid: 0,
      limiter: new RateLimiter(40, 80, this.now), binLimiter: new RateLimiter(180, 240, this.now), paused: false, goneAt: 0, deepTicks: 0, lastInputAt: 0, repeats: 0,
    };
    if (m.profile.name === this.self.name) seat.profile.name = `${m.profile.name} 2`.slice(0, 16);
    this.seat = seat;
    this.bind(seat, link);
    link.sendMsg({ t: 'welcome', v: PROTO, slot: 1, token: seat.token, lobby: this.lobby } satisfies HostMsg);
    this.onNotice(`${seat.profile.name} joined`, 'info');
    this.broadcastLobby();
  }

  private bind(s: Seat, link: NetLink): void {
    s.link = link;
    s.connected = true;
    s.lastHeard = this.now;
    s.goneAt = 0;
    link.onMsg = (raw) => this.onMsg(s, link, raw);
    link.onBin = (buf) => this.onBin(s, link, buf);
    link.onClose = (reason) => {
      if (s.link === link) this.lost(s, reason === 'left' ? 'left' : 'connection lost');
    };
  }

  /** The guest's link went away (closed, timed out, or they left). */
  private lost(s: Seat, why: string): void {
    if (!s.connected) return;
    s.connected = false;
    s.link?.close('bye');
    s.link = null;
    s.goneAt = this.now;
    s.queue.length = 0;
    this.prizeGuest = 0;
    if (this.lobby.inRun) {
      if (why === 'left') this.onNotice(`${s.profile.name} left the run`, 'warn');
      else {
        this.waitingFor = s.profile.name;
        this.waitUntil = this.now + RECONNECT_WAIT;
        this.onNotice(`${s.profile.name} lost connection — waiting for them to rejoin`, 'warn');
      }
    } else {
      this.seat = null;
      this.onNotice(`${s.profile.name} ${why === 'left' ? 'left' : 'disconnected'}`, 'warn');
    }
    this.broadcastLobby();
  }

  /** Stop waiting for a dropped guest and carry on alone (their character stands idle). */
  continueWithout(): void {
    this.waitingFor = null;
  }

  kick(): void {
    const s = this.seat;
    if (!s) return;
    if (s.link) this.refuse(s.link, 'kicked');
    this.seat = null;
    this.broadcastLobby();
  }

  close(reason = 'The host closed the lobby.'): void {
    this.detachGame();
    for (const p of this.pending) p.link.close('closed');
    this.pending = [];
    const s = this.seat;
    if (s?.link) {
      s.link.onClose = null;
      s.link.sendMsg({ t: 'bye', reason } satisfies HostMsg);
      s.link.close('closed');
    }
    this.seat = null;
    this.onClosed(reason);
  }

  // ------------------------------------------------------------------ guest traffic
  private onMsg(s: Seat, link: NetLink, raw: unknown): void {
    if (s.link !== link) return;
    if (!s.limiter.take(this.now)) return this.strike(s, 2);
    const m = parseGuestMsg(raw);
    if (!m) return this.strike(s, 1);
    s.lastHeard = this.now;
    switch (m.t) {
      case 'hello':
        return;
      case 'pick':
        if (this.lobby.inRun) return;
        if (m.character && m.character === this.hostCharacter) return this.broadcastLobby(); // taken: echo the truth back
        s.character = m.character;
        s.ready = false;
        return this.broadcastLobby();
      case 'ready':
        if (this.lobby.inRun) return;
        s.ready = m.ready && !!s.character;
        return this.broadcastLobby();
      case 'view':
        s.view = { hx: m.hx, hy: m.hy };
        return;
      case 'draft':
        return this.guestDraft(m);
      case 'prize_done':
        this.prizeGuest = Math.max(0, this.prizeGuest - 1);
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
        if (rtt >= 0 && rtt < 30000) s.rtt = s.rtt ? s.rtt + (rtt - s.rtt) * 0.3 : rtt;
        return;
      }
      case 'leave':
        return this.lost(s, 'left');
    }
  }

  /** Malformed or flooding traffic: tolerated a little (bugs happen), then the guest is dropped. */
  private strike(s: Seat, n: number): void {
    s.invalid += n;
    this.diag.invalid = s.invalid;
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
    s.lastHeard = this.now;
    if (pk.dictSize <= this.dict.size) s.dictAck = Math.max(s.dictAck, pk.dictSize);
    s.ackSnap = Math.max(s.ackSnap, Math.min(pk.ackSnap, this.snapSeq));
    for (const i of pk.inputs) {
      if (i.seq <= s.lastQueued) continue; // redundant copy or reordered duplicate
      if (s.lastQueued && i.seq > s.lastQueued + 120) continue; // implausible jump
      s.queue.push(i);
      s.lastQueued = i.seq;
      s.lastInputAt = this.now;
    }
  }

  private guestDraft(m: Extract<GuestMsg, { t: 'draft' }>): void {
    const g = this.game;
    if (!g || !g.draftPending(1)) return;
    const hand = g.drafts[1]!;
    switch (m.op) {
      case 'choose':
        if (m.index! < hand.length && !hand[m.index!].disabled) g.chooseDraft(m.index!, 1);
        break;
      case 'skip':
        g.skipDraft(1);
        break;
      case 'reroll':
        g.rerollDraft(1);
        break;
      case 'banish':
        g.banishDraft(m.index!, 1);
        break;
    }
    // a refused choice (stale, disabled, out of tokens): show the guest their real hand again
    if ((m.op === 'choose' || m.op === 'skip') && g.draftPending(1)) this.resendDraft();
  }

  private resendDraft(): void {
    const g = this.game;
    if (g?.draftPending(1)) this.forward('draft', { options: g.drafts[1]!, player: 1 });
  }

  // ------------------------------------------------------------------ the run
  attachGame(g: Game): void {
    this.detachGame();
    this.game = g;
    this.dict = new StringDict();
    this.enc = new SnapshotEncoder();
    this.snapSeq = 0;
    this.lastTickAt = this.now;
    this.prizeHost = this.prizeGuest = 0;
    if (this.seat) {
      this.seat.dictAck = 0;
      this.seat.ackSnap = 0;
      this.seat.queue.length = 0;
      this.seat.lastQueued = this.seat.lastApplied = 0;
      this.seat.lastInput = null;
    }
    for (const type of FORWARDED_EVENTS) {
      this.unsub.push(g.bus.on(type as keyof GameEvents, (e) => this.forward(type, e)));
    }
    this.unsub.push(g.bus.on('chest', () => {
      this.prizeHost++;
      if (this.seat?.connected) this.prizeGuest++;
    }));
    this.unsub.push(g.bus.on('sfx', (e) => {
      if (this.sfx.length < 120) this.sfx.push(e);
    }));
  }

  detachGame(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
    this.game = null;
    this.fx.length = 0;
    this.sfx.length = 0;
  }

  /** Forward one host-side game event to the guest (per-player events only to their owner). */
  private forward(type: string, e: unknown): void {
    const g = this.game;
    if (!g || !this.seat?.connected) return;
    const ev = e as { player?: number; options?: unknown };
    const pl = ev?.player ?? 0;
    switch (type) {
      case 'draft': {
        if (pl !== 1) return;
        const p1 = g.players[1];
        this.send({ t: 'ev', type, e: { options: ev.options, player: 1, rerolls: p1.rerolls, banishes: p1.banishes, canSkip: p1.canSkip, level: g.level } });
        return;
      }
      case 'draft_done':
      case 'player_hurt':
      case 'shield_pop':
      case 'meta_currency':
      case 'pickup':
        if (pl !== 1) return;
        break;
      case 'run_end':
        this.send({ t: 'ev', type, e: { stats: g.endStatsAll[1] ?? (e as { stats: unknown }).stats } });
        return;
    }
    this.send({ t: 'ev', type, e });
  }

  /** Feed the guest's next buffered input into their slot; call right before every `g.tick()`. */
  beforeTick(g: Game): void {
    const s = this.seat;
    const inp = g.inputs[1];
    this.lastTickAt = this.now;
    if (!s || !inp) return;
    if (!s.connected) {
      inp.moveX = inp.moveY = 0;
      inp.aimActive = false;
      return;
    }
    // Every guest input should be applied exactly once, in order. Frames on either machine arrive
    // unevenly (a 144 Hz display ticks on some frames and not others; a busy frame runs several
    // ticks), so the buffer breathes; only a backlog that persists — latency the guest would feel —
    // is shaved, one input at a time, and only a huge one (a stall) is cut at once.
    if (s.queue.length > 30) this.dropInputs(s, s.queue.length - 4);
    if (s.queue.length > 4) {
      if (++s.deepTicks > 30) {
        this.dropInputs(s, 1);
        s.deepTicks = 20;
      }
    } else s.deepTicks = 0;
    let next = s.queue.shift();
    if (next) {
      s.lastApplied = next.seq;
      s.lastInput = next;
      s.repeats = 0;
    } else if (s.lastInput && s.repeats < 2 && this.now - s.lastInputAt < 250) {
      // a packet a tick or two late: keep doing what they were doing (prediction absorbs it)
      s.repeats++;
      this.diag.starved++;
      next = s.lastInput;
    } else {
      // nothing to apply: stand still until their next input arrives
      inp.moveX = inp.moveY = 0;
      inp.aimActive = false;
      return;
    }
    if (next) {
      inp.moveX = next.mx;
      inp.moveY = next.my;
      inp.aimX = next.ax;
      inp.aimY = next.ay;
      inp.aimActive = next.aim;
    }
  }

  private dropInputs(s: Seat, n: number): void {
    const gone = s.queue.splice(0, n);
    this.diag.dropped += gone.length;
    if (gone.length) s.lastApplied = gone[gone.length - 1].seq;
  }

  /** Keep the frame's cosmetic events for the next snapshot (call before the renderer drains them). */
  captureFx(events: FxEvent[]): void {
    if (!this.seat?.connected) return;
    for (const e of events) if (this.fx.length < 400) this.fx.push(e);
  }

  /** The host finished watching a prize wheel. */
  prizeHostDone(): void {
    this.prizeHost = Math.max(0, this.prizeHost - 1);
    if (this.prizeHost === 0) this.prizeHostDoneAt = this.now;
    if (this.prizeGuest > 0) this.send({ t: 'prize_wait', waiting: true });
  }

  setPaused(on: boolean): void {
    if (this.hostPaused === on) return;
    this.hostPaused = on;
    this.send({ t: 'pause', by: on ? this.self.name : null });
  }

  /** Per frame: timeouts, pings, snapshots. `now` in ms. */
  update(now: number, dtMs: number): void {
    this.now = now;
    for (const p of [...this.pending]) if (now - p.at > HELLO_TIMEOUT) this.refuse(p.link, 'bad_hello');
    const s = this.seat;
    if (s?.connected) {
      if (now - s.lastHeard > LINK_TIMEOUT) this.lost(s, 'timeout');
      else if (now - this.lastPing > PING_EVERY) {
        this.lastPing = now;
        this.send({ t: 'ping', at: now });
        if (!this.lobby.inRun) this.broadcastLobby(); // refresh the latency readout
      }
    }
    if (this.waitingFor && now > this.waitUntil) {
      this.onNotice(`Carrying on without ${this.waitingFor}`, 'warn');
      this.waitingFor = null;
    }
    const g = this.game;
    if (g && s && !s.connected && !this.waitingFor && g.draftPending(1)) {
      // an absent partner's level-up must not hold the night: take their first card for them
      g.chooseDraft(Math.max(0, g.drafts[1]!.findIndex((o) => !o.disabled)), 1);
    }
    if (g && s && s.queue.length && now - this.lastTickAt > 150) {
      // the night is frozen (draft, prize wheel, pause): inputs that arrive now were predicted by a
      // guest who had not heard yet — count them as spent so its prediction snaps to the truth
      this.dropInputs(s, s.queue.length);
    }
    if (this.prizeGuest > 0 && this.prizeHost === 0 && now - this.prizeHostDoneAt > PRIZE_WAIT) this.prizeGuest = 0;
    this.diag.connected = !!s?.connected;
    this.diag.rtt = s?.rtt ?? 0;
    this.diag.inputQueue = s?.queue.length ?? 0;
    if (s?.link) {
      const st = s.link.stats();
      this.diag.unreliable = st.unreliable;
      this.diag.route = st.route;
    }
    this.snapshots(now, dtMs);
  }

  private snapshots(now: number, dtMs: number): void {
    const g = this.game, s = this.seat;
    if (!g || !s?.connected || !s.link) return;
    this.snapAcc += dtMs;
    // very busy nights send a little less often (interpolation covers it); prediction keeps the
    // guest's own movement immediate either way
    const hz = this.diag.snapBytes > 12000 ? 12 : this.diag.snapBytes > 6000 ? 15 : SNAPSHOT_HZ;
    const every = 1000 / hz;
    if (this.snapAcc < every) return;
    this.snapAcc = Math.min(this.snapAcc - every, every);
    if ((s.link.pressure?.() ?? 0) > 128 * 1024) {
      // the network is not keeping up: skip this one rather than queue stale state
      this.diag.skipped++;
      return;
    }
    const p = g.players[1];
    const view = { x: p.x, y: p.y, hx: s.view.hx, hy: s.view.hy };
    const buf = this.enc.encode(g, { seq: ++this.snapSeq, ackInput: s.lastApplied, ackSnap: s.ackSnap, dict: this.dict, dictFrom: s.dictAck, view, fx: this.fx, sfx: this.sfx, frozen: this.paused || !this.prizeReady });
    this.fx.length = 0;
    this.sfx.length = 0;
    s.link.sendBin(buf);
    this.diag.snapBytes = buf.byteLength;
    this.bytesWin += buf.byteLength;
    this.snapsWin++;
    if (now - this.winStart >= 1000) {
      const k = 1000 / Math.max(1, now - this.winStart);
      this.diag.bytesPerSec = this.bytesWin * k;
      this.diag.snapRate = this.snapsWin * k;
      this.bytesWin = this.snapsWin = 0;
      this.winStart = now;
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
  partnerConnected = true;
  closeReason = '';
  private seq = 0;
  private recent: NetInput[] = [];
  private writer = new Writer(128);
  private lastPing = 0;
  private lastHeard = 0;
  private lastSend = 0;
  private now = 0;
  private bytesWin = 0;
  private snapsWin = 0;
  private winStart = 0;
  readonly diag = blankDiag('guest');

  // UI hooks
  onWelcome: (lobby: LobbyState) => void = () => {};
  onLobby: (lobby: LobbyState) => void = () => {};
  /** build the mirror Game from the shared config (the session creates the replica around it) */
  onStart: (cfg: StartCfg, resume: boolean) => Game | null = () => null;
  onEvent: (type: string, e: unknown) => void = () => {};
  onPause: (by: string | null) => void = () => {};
  onToLobby: () => void = () => {};
  onClosed: (reason: string) => void = () => {};

  constructor(readonly link: NetLink, readonly profile: GuestProfile, token?: string | null, now = 0) {
    this.token = token ?? null;
    this.now = this.lastHeard = now;
    link.onMsg = (raw) => this.onMsg(raw);
    link.onBin = (buf) => this.onBin(buf);
    // a host that leaves on purpose says why first ('bye' / 'reject'); a bare close is a dropped link
    link.onClose = () => this.closed('Lost connection to the host.');
    link.sendMsg({ t: 'hello', v: PROTO, profile, token: this.token ?? undefined } satisfies GuestMsg);
  }

  private send(m: GuestMsg): void {
    if (this.state !== 'closed') this.link.sendMsg(m);
  }

  pick(character: string | null): void {
    this.send({ t: 'pick', character });
  }
  setReady(ready: boolean): void {
    this.send({ t: 'ready', ready });
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
    this.lastHeard = this.now;
    switch (m.t) {
      case 'welcome':
        this.slot = m.slot;
        this.token = m.token;
        this.lobby = m.lobby;
        this.state = m.lobby.inRun ? this.state : 'lobby';
        this.onWelcome(m.lobby);
        return;
      case 'reject':
        this.closed(REJECT_TEXT[m.reason] ?? 'The host refused the connection.');
        this.link.onClose = null;
        this.link.close('rejected');
        return;
      case 'lobby':
        this.lobby = m.lobby;
        this.onLobby(m.lobby);
        return;
      case 'start': {
        this.startCfg = m.cfg;
        this.pausedBy = null;
        this.prizeWait = false;
        this.seq = 0;
        this.recent.length = 0;
        const g = this.onStart(m.cfg, !!m.resume);
        if (!g) return;
        this.game = g;
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
      case 'partner':
        this.partnerConnected = m.connected;
        return;
      case 'to_lobby':
        this.state = 'lobby';
        this.game = null;
        this.replica = null;
        this.onToLobby();
        return;
      case 'ping':
        this.link.sendMsg({ t: 'pong', at: m.at } satisfies GuestMsg);
        return;
      case 'pong': {
        const rtt = this.now - m.at;
        if (rtt >= 0 && rtt < 30000) this.diag.rtt = this.diag.rtt ? this.diag.rtt + (rtt - this.diag.rtt) * 0.3 : rtt;
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
    this.lastHeard = this.now;
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
    const inp: NetInput = { seq: ++this.seq, mx, my, ax, ay, aim };
    this.recent.push(inp);
    if (this.recent.length > INPUT_REDUNDANCY) this.recent.shift();
    this.replica.predict(inp.seq, mx, my);
    this.sendInputs();
  }

  private sendInputs(): void {
    const r = this.replica;
    if (!r) return;
    this.lastSend = this.now;
    this.link.sendBin(encodeInputPacket({ ackSnap: r.last?.seq ?? 0, dictSize: r.dict.size, inputs: this.recent }, this.writer));
  }

  /** Per frame: keepalive acks while not stepping, pings, link timeout, diagnostics. */
  update(now: number): void {
    this.now = now;
    if (this.state === 'closed') return;
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
