// Live game updates (engineering optimization pass). The browser and the Windows app play the same
// hosted build, so a game update is just a web deploy: every running game polls the deploy's
// version.json and, once a newer build is live, offers "Restart & Update" — but only at a safe moment
// (menus, the Midway alone, a finished night), never in the middle of a match or a lobby (src/app.ts).
// A failed check (offline, the host down) changes nothing; the next check tries again.

/** This build (build-info.ts); 'dev' under the dev server, where updates are never offered. */
export const BUILD: typeof __NC_BUILD__ =
  typeof __NC_BUILD__ !== 'undefined' ? __NC_BUILD__ : { id: 'dev', version: '0.0.0', commit: 'local', time: new Date(0).toISOString(), proto: 0, sim: '' };

export interface Manifest {
  id: string;
  version: string;
  commit: string;
  time: string;
  proto: number;
  sim: string;
  assets?: string[];
  /** the Windows app's latest release, once one is published (desktop-release.json) */
  desktop?: { windows?: { version: string; url: string } | null } | null;
}

/** How often a running game looks (plus at every safe moment), and never more often than this. */
const POLL_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

export class UpdateChecker {
  /** the live build, from the last successful check */
  latest: Manifest | null = null;
  /** a newer build is live */
  available = false;
  /** ...and it can't share a night with this one (protocol or simulation changed) */
  incompatible = false;
  /** the last check failed (offline, or the server unreachable) */
  offline = false;
  onChange: () => void = () => {};
  private lastCheck = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private url: string, private build: typeof __NC_BUILD__ = BUILD) {}

  /** Poll from now on (the first look a few seconds after boot). The dev server never polls. */
  start(): void {
    if (this.build.id === 'dev' || this.timer) return;
    setTimeout(() => void this.check(true), 6000);
    this.timer = setInterval(() => void this.check(), POLL_MS);
  }

  async check(force = false): Promise<Manifest | null> {
    if (this.build.id === 'dev') return null;
    const now = Date.now();
    if (!force && now - this.lastCheck < MIN_GAP_MS) return this.latest;
    this.lastCheck = now;
    try {
      const r = await fetch(`${this.url}?t=${now}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`version.json ${r.status}`);
      const m = (await r.json()) as Manifest;
      if (!m || typeof m.id !== 'string' || typeof m.time !== 'string') throw new Error('bad version.json');
      // a new manifest is news too (the first one, or a deploy): it may carry a desktop download to show
      const was = [this.available, this.incompatible, this.offline, this.latest?.id ?? ''].join();
      this.latest = m;
      // only a newer build is an update (an older one live means this game is ahead, e.g. a local build)
      this.available = m.id !== this.build.id && Date.parse(m.time) > Date.parse(this.build.time);
      this.incompatible = this.available && (m.proto !== this.build.proto || m.sim !== this.build.sim);
      this.offline = false;
      if ([this.available, this.incompatible, this.offline, m.id].join() !== was) this.onChange();
      return m;
    } catch {
      if (!this.offline) {
        this.offline = true;
        this.onChange();
      }
      return null;
    }
  }
}

/** Remembering an update across the reload, so the new page can confirm it really is the new build. */
const KEY = 'nc-update-expect';

export function noteUpdateExpected(id: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ from: BUILD.id, to: id }));
  } catch {
    /* private mode: the check below simply doesn't run */
  }
}

/** After a Restart & Update: 'updated', 'stale' (the old build came back: a cache or CDN lag) or null. */
export function takeUpdateResult(): 'updated' | 'stale' | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const { from, to } = JSON.parse(raw) as { from: string; to: string };
    // drop the cache-busting ?v= the restart added
    const u = new URL(location.href);
    if (u.searchParams.has('v')) {
      u.searchParams.delete('v');
      history.replaceState(null, '', u.toString());
    }
    if (BUILD.id === to || (BUILD.id !== from && BUILD.id !== 'dev')) return 'updated';
    return 'stale';
  } catch {
    return null;
  }
}
