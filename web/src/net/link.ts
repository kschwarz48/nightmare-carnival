// A connection to one peer, independent of how it is carried (D-52). Sessions talk to a NetLink; the
// PeerJS/WebRTC transport (peer.ts) and the in-memory loopback below both implement it, so lobby,
// replication and disconnect handling are tested headless and the transport can be swapped later
// (own signaling server, TURN, a relay) without touching game code.

export interface LinkStats {
  /** bytes and messages since the link opened */
  bytesIn: number;
  bytesOut: number;
  msgsIn: number;
  msgsOut: number;
  /** true when binary traffic rides an unreliable/unordered channel */
  unreliable: boolean;
  /** largest single message the transport accepts (0 = unknown) */
  maxMessage: number;
  /** ICE path in use, when known: 'host' | 'srflx' | 'relay' | 'loopback' | '' */
  route: string;
}

export interface NetLink {
  readonly peerId: string;
  readonly open: boolean;
  /** JSON control message on the reliable, ordered channel. */
  sendMsg(msg: object): void;
  /** Binary datagram: unreliable channel when available, otherwise the reliable one. */
  sendBin(buf: ArrayBuffer): void;
  onMsg: ((raw: unknown) => void) | null;
  onBin: ((buf: ArrayBuffer) => void) | null;
  onClose: ((reason: string) => void) | null;
  close(reason?: string): void;
  stats(): LinkStats;
  /** bytes queued on the binary path, when the transport can tell (back-pressure) */
  pressure?(): number;
}

const emptyStats = (route: string): LinkStats => ({ bytesIn: 0, bytesOut: 0, msgsIn: 0, msgsOut: 0, unreliable: true, maxMessage: 0, route });

// ------------------------------------------------------------------ loopback
export interface LoopbackOpts {
  /** one-way latency in ms */
  latency?: number;
  /** ± uniform jitter in ms (unreliable packets may reorder; reliable stay ordered) */
  jitter?: number;
  /** probability an unreliable packet is dropped */
  loss?: number;
  /** probability an unreliable packet is delivered twice */
  dupe?: number;
  /** deterministic randomness for tests */
  seed?: number;
}

interface Pkt { at: number; order: number; to: LoopbackLink; kind: 'msg' | 'bin' | 'close'; data: unknown }

/**
 * An in-memory network with configurable latency, jitter, loss and duplication. Time only moves when
 * `pump(now)` is called, so tests are deterministic and the in-page two-client harness can drive it
 * from its frame loop.
 */
export class LoopbackNet {
  now = 0;
  private q: Pkt[] = [];
  private order = 0;
  private rngState: number;
  constructor(public opts: LoopbackOpts = {}) {
    this.rngState = (opts.seed ?? 1) >>> 0 || 1;
  }
  rand(): number {
    // xorshift32
    let x = this.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return this.rngState / 4294967296;
  }
  /** A connected pair of links (a ↔ b). */
  pair(aId = 'host', bId = 'guest'): [LoopbackLink, LoopbackLink] {
    const a = new LoopbackLink(this, bId);
    const b = new LoopbackLink(this, aId);
    a.other = b;
    b.other = a;
    return [a, b];
  }
  /** @internal */
  post(to: LoopbackLink, kind: Pkt['kind'], data: unknown, reliable: boolean): void {
    const o = this.opts;
    const lat = o.latency ?? 0;
    const jit = o.jitter ?? 0;
    if (!reliable && (o.loss ?? 0) > 0 && this.rand() < (o.loss ?? 0)) return;
    let at = this.now + lat + (jit ? (this.rand() * 2 - 1) * jit : 0);
    if (reliable) {
      // ordered: never overtake an earlier reliable packet on this direction
      at = Math.max(at, to.lastReliableAt);
      to.lastReliableAt = at;
    }
    this.q.push({ at, order: this.order++, to, kind, data });
    if (!reliable && (o.dupe ?? 0) > 0 && this.rand() < (o.dupe ?? 0)) this.q.push({ at: at + 1, order: this.order++, to, kind, data });
  }
  /** Advance time and deliver everything due. */
  pump(now: number): void {
    this.now = Math.max(this.now, now);
    for (;;) {
      let best = -1;
      for (let i = 0; i < this.q.length; i++) {
        const p = this.q[i];
        if (p.at > this.now) continue;
        if (best < 0 || p.at < this.q[best].at || (p.at === this.q[best].at && p.order < this.q[best].order)) best = i;
      }
      if (best < 0) return;
      const p = this.q.splice(best, 1)[0];
      p.to.deliver(p);
    }
  }
  /** Drop everything in flight (e.g. a cable pulled mid-packet). */
  clear(): void {
    this.q.length = 0;
  }
  get inFlight(): number {
    return this.q.length;
  }
}

export class LoopbackLink implements NetLink {
  other!: LoopbackLink;
  open = true;
  lastReliableAt = 0;
  onMsg: ((raw: unknown) => void) | null = null;
  onBin: ((buf: ArrayBuffer) => void) | null = null;
  onClose: ((reason: string) => void) | null = null;
  private st = emptyStats('loopback');
  /** test hook: stop delivering anything in either direction without a close (a dead network) */
  severed = false;
  constructor(private net: LoopbackNet, readonly peerId: string) {}
  sendMsg(msg: object): void {
    if (!this.open || this.severed) return;
    const s = JSON.stringify(msg);
    this.st.bytesOut += s.length;
    this.st.msgsOut++;
    this.net.post(this.other, 'msg', s, true);
  }
  sendBin(buf: ArrayBuffer): void {
    if (!this.open || this.severed) return;
    this.st.bytesOut += buf.byteLength;
    this.st.msgsOut++;
    this.net.post(this.other, 'bin', buf.slice(0), false);
  }
  /** Inject a raw reliable payload exactly as given (tests: malformed or hostile messages). */
  sendRaw(raw: unknown): void {
    this.net.post(this.other, 'msg', raw, true);
  }
  close(reason = 'closed'): void {
    if (!this.open) return;
    this.open = false;
    this.net.post(this.other, 'close', reason, true);
    this.onClose?.(reason);
  }
  /** @internal */
  deliver(p: Pkt): void {
    if (!this.open || this.severed) return;
    if (p.kind === 'close') {
      this.open = false;
      this.onClose?.(String(p.data));
      return;
    }
    this.st.msgsIn++;
    if (p.kind === 'msg') {
      this.st.bytesIn += typeof p.data === 'string' ? p.data.length : 0;
      this.onMsg?.(p.data);
    } else {
      this.st.bytesIn += (p.data as ArrayBuffer).byteLength;
      this.onBin?.(p.data as ArrayBuffer);
    }
  }
  stats(): LinkStats {
    return { ...this.st };
  }
}
