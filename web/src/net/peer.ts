// WebRTC transport via PeerJS (D-52). PeerJS does the signaling (PeerJS Cloud by default) and opens a
// reliable, ordered DataConnection that carries the JSON control messages. Next to it each side opens
// a pre-negotiated, unordered, zero-retransmit RTCDataChannel on the same peer connection for
// snapshots and inputs — a late snapshot is worthless, so it is never resent or allowed to block. If
// that channel cannot open, binary traffic falls back to the reliable connection.
//
// The PeerJS library is loaded on demand (only when someone opens the multiplayer menu).

import type { DataConnection, Peer as PeerT, PeerOptions } from 'peerjs';
import { codeToPeerId, generateCode } from './codes';
import type { NetConfig } from './config';
import type { LinkStats, NetLink } from './link';

const UNRELIABLE_ID = 917;
const CONNECT_TIMEOUT = 20000;

export class NetError extends Error {
  constructor(readonly kind: 'no_lobby' | 'signal' | 'ice' | 'timeout' | 'browser' | 'taken' | 'other', message: string) {
    super(message);
  }
}

const TEXT = {
  no_lobby: 'No lobby with that code. Check the code, and make sure the host still has the lobby open.',
  signal: 'Could not reach the matchmaking server. Check your internet connection and try again.',
  ice: 'Could not open a direct connection to the other player (a firewall or strict NAT is in the way). A TURN relay is needed — see docs/MULTIPLAYER.md.',
  timeout: 'The other player did not respond in time. Try again, or check that both of you are online.',
  browser: 'This browser does not support WebRTC data channels. Try a current Chrome, Edge, Firefox or Safari.',
  taken: 'Could not reserve a lobby code. Try again.',
};

function mapError(e: unknown): NetError {
  if (e instanceof NetError) return e;
  const type = (e as { type?: string })?.type ?? '';
  switch (type) {
    case 'peer-unavailable':
      return new NetError('no_lobby', TEXT.no_lobby);
    case 'unavailable-id':
      return new NetError('taken', TEXT.taken);
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
    case 'disconnected':
      return new NetError('signal', TEXT.signal);
    case 'browser-incompatible':
      return new NetError('browser', TEXT.browser);
    case 'webrtc':
    case 'negotiation-failed':
      return new NetError('ice', TEXT.ice);
  }
  return new NetError('other', (e as Error)?.message || 'Network error.');
}

async function loadPeer(): Promise<typeof PeerT> {
  if (typeof RTCPeerConnection === 'undefined') throw new NetError('browser', TEXT.browser);
  const m = await import('peerjs');
  return m.Peer;
}

function options(cfg: NetConfig): PeerOptions {
  const o: PeerOptions = { debug: cfg.debug as 0 | 1 | 2 | 3, ...cfg.peer };
  if (cfg.iceServers) o.config = { iceServers: cfg.iceServers, sdpSemantics: 'unified-plan' } as RTCConfiguration;
  return o;
}

/** Open a Peer on the signaling server (resolves once registered). */
function openPeer(Peer: typeof PeerT, id: string | undefined, cfg: NetConfig): Promise<PeerT> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, options(cfg)) : new Peer(options(cfg));
    const timer = setTimeout(() => {
      peer.destroy();
      reject(new NetError('signal', TEXT.signal));
    }, CONNECT_TIMEOUT);
    peer.once('open', () => {
      clearTimeout(timer);
      resolve(peer);
    });
    peer.once('error', (e) => {
      clearTimeout(timer);
      peer.destroy();
      reject(mapError(e));
    });
  });
}

// ------------------------------------------------------------------ link
export class PeerLink implements NetLink {
  readonly peerId: string;
  open = true;
  onMsg: ((raw: unknown) => void) | null = null;
  onBin: ((buf: ArrayBuffer) => void) | null = null;
  onClose: ((reason: string) => void) | null = null;
  private dc: RTCDataChannel | null = null;
  private st: LinkStats = { bytesIn: 0, bytesOut: 0, msgsIn: 0, msgsOut: 0, unreliable: false, maxMessage: 0, route: '' };
  private routeTimer = 0;

  /** `owned`: a Peer created just for this link (the guest's), destroyed with it. */
  constructor(private conn: DataConnection, private owned: PeerT | null = null) {
    this.peerId = conn.peer;
    conn.on('data', (data) => this.onData(data));
    conn.on('close', () => this.closed('closed'));
    conn.on('error', () => this.closed('error'));
    const pc = conn.peerConnection;
    if (pc) {
      this.openUnreliable(pc);
      pc.addEventListener('iceconnectionstatechange', () => {
        if (pc.iceConnectionState === 'failed') this.closed('ice-failed');
      });
      this.st.maxMessage = (pc as RTCPeerConnection & { sctp?: { maxMessageSize?: number } }).sctp?.maxMessageSize ?? 0;
      void this.probeRoute(pc);
      this.routeTimer = window.setInterval(() => void this.probeRoute(pc), 10000);
    }
  }

  private openUnreliable(pc: RTCPeerConnection): void {
    try {
      const dc = pc.createDataChannel('nc-datagram', { negotiated: true, id: UNRELIABLE_ID, ordered: false, maxRetransmits: 0 });
      dc.binaryType = 'arraybuffer';
      dc.onopen = () => {
        this.dc = dc;
        this.st.unreliable = true;
      };
      dc.onclose = () => {
        if (this.dc === dc) this.dc = null;
        this.st.unreliable = false;
      };
      dc.onmessage = (e) => {
        if (!(e.data instanceof ArrayBuffer)) return;
        this.st.bytesIn += e.data.byteLength;
        this.st.msgsIn++;
        this.onBin?.(e.data);
      };
    } catch {
      /* binary falls back to the reliable connection */
    }
  }

  /** Which ICE route the connection settled on: direct (host), via STUN (srflx/prflx) or relayed (relay). */
  private async probeRoute(pc: RTCPeerConnection): Promise<void> {
    try {
      const stats = await pc.getStats();
      let pairId = '';
      stats.forEach((r) => {
        if (r.type === 'transport' && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId;
      });
      let local = '';
      stats.forEach((r) => {
        if (r.type === 'candidate-pair' && (r.id === pairId || (!pairId && r.nominated && r.state === 'succeeded'))) local = r.localCandidateId;
      });
      stats.forEach((r) => {
        if (r.type === 'local-candidate' && r.id === local) this.st.route = r.candidateType ?? '';
      });
    } catch {
      /* stats are best-effort */
    }
  }

  private onData(data: unknown): void {
    this.st.msgsIn++;
    if (typeof data === 'string') {
      this.st.bytesIn += data.length;
      this.onMsg?.(data);
    } else if (data instanceof ArrayBuffer) {
      this.st.bytesIn += data.byteLength;
      this.onBin?.(data);
    }
  }

  sendMsg(msg: object): void {
    if (!this.open) return;
    const s = JSON.stringify(msg);
    this.st.bytesOut += s.length;
    this.st.msgsOut++;
    try {
      this.conn.send(s);
    } catch {
      this.closed('error');
    }
  }

  sendBin(buf: ArrayBuffer): void {
    if (!this.open) return;
    this.st.bytesOut += buf.byteLength;
    this.st.msgsOut++;
    try {
      const dc = this.dc;
      if (dc && dc.readyState === 'open') {
        // a congested link: drop this datagram rather than queue stale state behind it
        if (dc.bufferedAmount > 256 * 1024) return;
        dc.send(buf);
      } else this.conn.send(buf);
    } catch {
      /* a datagram that cannot be sent is simply lost */
    }
  }

  /** Bytes waiting to leave on the binary path (back-pressure for the snapshot rate). */
  pressure(): number {
    return this.dc?.bufferedAmount ?? this.conn.dataChannel?.bufferedAmount ?? 0;
  }

  close(reason = 'closed'): void {
    if (!this.open) return;
    this.open = false;
    clearInterval(this.routeTimer);
    try {
      this.dc?.close();
    } catch {
      /* already closed */
    }
    try {
      this.conn.close({ flush: true });
    } catch {
      /* already closed */
    }
    // the guest's own Peer goes once the last message has had a moment to leave
    if (this.owned) {
      const p = this.owned;
      setTimeout(() => p.destroy(), 1500);
    }
    this.onClose?.(reason);
  }

  private closed(reason: string): void {
    if (!this.open) return;
    this.open = false;
    clearInterval(this.routeTimer);
    try {
      this.dc?.close();
    } catch {
      /* ignore */
    }
    if (this.owned) this.owned.destroy();
    this.onClose?.(reason);
  }

  stats(): LinkStats {
    return { ...this.st };
  }
}

// ------------------------------------------------------------------ host / join
export interface HostHandle {
  code: string;
  /** stop accepting connections and leave the signaling server */
  close(): void;
}

/**
 * Register a lobby on the signaling server under a fresh code (retrying if a code is taken) and
 * hand every incoming connection, once open, to `onLink`. The session decides who may stay.
 */
export async function hostLobby(cfg: NetConfig, onLink: (link: NetLink) => void, onTrouble: (text: string) => void): Promise<HostHandle> {
  const Peer = await loadPeer();
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateCode();
    let peer: PeerT;
    try {
      peer = await openPeer(Peer, codeToPeerId(code), cfg);
    } catch (e) {
      lastErr = e;
      if ((e as NetError).kind === 'taken') continue;
      throw mapError(e);
    }
    let closed = false;
    peer.on('connection', (conn) => {
      if (conn.serialization !== 'raw') {
        conn.close();
        return;
      }
      conn.on('open', () => onLink(new PeerLink(conn)));
    });
    // losing the signaling server does not drop connected players, but nobody new could join
    peer.on('disconnected', () => {
      if (closed) return;
      onTrouble('Lost contact with the matchmaking server — reconnecting…');
      setTimeout(() => !closed && !peer.destroyed && peer.reconnect(), 2000);
    });
    peer.on('error', (e) => {
      if (closed) return;
      const err = mapError(e);
      if (err.kind !== 'no_lobby') onTrouble(err.message);
    });
    return {
      code,
      close: () => {
        closed = true;
        peer.destroy();
      },
    };
  }
  throw mapError(lastErr ?? new NetError('taken', TEXT.taken));
}

/** Connect to a host's lobby by code. Resolves with an open link (the session then says hello). */
export async function joinLobby(code: string, cfg: NetConfig): Promise<NetLink> {
  const Peer = await loadPeer();
  const peer = await openPeer(Peer, undefined, cfg);
  return new Promise<NetLink>((resolve, reject) => {
    let done = false;
    const fail = (e: unknown) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      peer.destroy();
      reject(mapError(e));
    };
    const timer = setTimeout(() => fail(new NetError('timeout', TEXT.timeout)), CONNECT_TIMEOUT);
    peer.on('error', fail);
    const conn = peer.connect(codeToPeerId(code), { reliable: true, serialization: 'raw' });
    conn.on('error', fail);
    conn.on('open', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(new PeerLink(conn, peer));
    });
    // ICE that never connects shows up as a connection that never opens; name the likely cause
    const pc = conn.peerConnection;
    pc?.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'failed') fail(new NetError('ice', TEXT.ice));
    });
  });
}
