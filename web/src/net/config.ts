// Network configuration (D-52). Defaults: the free PeerJS Cloud signaling server and the PeerJS
// client's built-in STUN/TURN list — enough for an alpha, no account needed. A deploy can point at its
// own signaling server and TURN relay two ways, without touching code:
//  • build time: VITE_PEER_HOST / VITE_PEER_PORT / VITE_PEER_PATH / VITE_PEER_SECURE / VITE_PEER_KEY and
//    VITE_ICE_SERVERS (JSON array of RTCIceServer) in the environment or a .env file;
//  • run time: a `net-config.json` next to index.html (see docs/MULTIPLAYER.md), read once when the
//    multiplayer menu opens — handy for rotating TURN credentials on a static host.

export interface NetConfig {
  peer: { host?: string; port?: number; path?: string; secure?: boolean; key?: string };
  /** replaces PeerJS's default ICE list when set */
  iceServers?: RTCIceServer[];
  /** PeerJS log level 0–3 */
  debug: number;
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 512;

function cleanIce(v: unknown): RTCIceServer[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: RTCIceServer[] = [];
  for (const s of v.slice(0, 12)) {
    if (typeof s !== 'object' || s === null) continue;
    const o = s as Record<string, unknown>;
    const urls = Array.isArray(o.urls) ? o.urls.filter(isStr) : isStr(o.urls) ? [o.urls] : [];
    const ok = urls.filter((u) => /^(stun|stuns|turn|turns):/i.test(u));
    if (!ok.length) continue;
    const srv: RTCIceServer = { urls: ok };
    if (isStr(o.username)) srv.username = o.username;
    if (isStr(o.credential)) srv.credential = o.credential;
    out.push(srv);
  }
  return out.length ? out : undefined;
}

function cleanPeer(v: unknown): NetConfig['peer'] {
  if (typeof v !== 'object' || v === null) return {};
  const o = v as Record<string, unknown>;
  const p: NetConfig['peer'] = {};
  if (isStr(o.host)) p.host = o.host;
  if (typeof o.port === 'number' && o.port > 0 && o.port < 65536) p.port = o.port;
  if (isStr(o.path)) p.path = o.path;
  if (typeof o.secure === 'boolean') p.secure = o.secure;
  if (isStr(o.key)) p.key = o.key;
  return p;
}

let cached: Promise<NetConfig> | null = null;

export function loadNetConfig(): Promise<NetConfig> {
  cached ??= (async () => {
    const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};
    const cfg: NetConfig = { peer: {}, debug: 0 };
    if (env.VITE_PEER_HOST) {
      cfg.peer = cleanPeer({
        host: env.VITE_PEER_HOST,
        port: env.VITE_PEER_PORT ? Number(env.VITE_PEER_PORT) : undefined,
        path: env.VITE_PEER_PATH,
        secure: env.VITE_PEER_SECURE ? env.VITE_PEER_SECURE !== 'false' : undefined,
        key: env.VITE_PEER_KEY,
      });
    }
    if (env.VITE_ICE_SERVERS) {
      try {
        cfg.iceServers = cleanIce(JSON.parse(env.VITE_ICE_SERVERS));
      } catch {
        /* ignore a malformed value */
      }
    }
    try {
      const r = await fetch(new URL('net-config.json', document.baseURI).toString(), { cache: 'no-store' });
      if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) {
        const j = (await r.json()) as Record<string, unknown>;
        if (j.peer) cfg.peer = { ...cfg.peer, ...cleanPeer(j.peer) };
        const ice = cleanIce(j.iceServers);
        if (ice) cfg.iceServers = ice;
        if (typeof j.debug === 'number') cfg.debug = Math.max(0, Math.min(3, Math.floor(j.debug)));
      }
    } catch {
      /* no runtime override */
    }
    return cfg;
  })();
  return cached;
}

/** Describe the active setup for the diagnostics overlay (never prints credentials). */
export function describeNetConfig(c: NetConfig): string {
  const sig = c.peer.host ? `${c.peer.host}${c.peer.port ? ':' + c.peer.port : ''}` : 'PeerJS Cloud';
  const ice = c.iceServers ? `${c.iceServers.length} custom ICE server(s)` : 'PeerJS default STUN/TURN';
  return `${sig} · ${ice}`;
}
