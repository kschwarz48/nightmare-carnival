// Frame and system timings for the developer performance overlay (F2) and the benchmark runner.
//
// Cheap when nobody is looking: a frame's own sections (net, sim, render, HUD) cost a handful of
// `performance.now()` calls and are always kept, so the overlay opens with history; the sim's
// per-system timers only run while `perf.on` (one flag check per system per tick otherwise).
// Nothing here touches the DOM, so the sim can use it headless (tests, scripts/bench).

/** A frame's CPU sections, in the order the overlay lists them. */
export const SEC = { net: 0, sim: 1, render: 2, hud: 3 } as const;
export const SEC_NAMES = ['net', 'sim', 'render', 'hud'] as const;
/** The sim's systems within a tick (summed over the frame's ticks). */
export const SYS = { players: 0, director: 1, enemies: 2, collide: 3, bosses: 4, weapons: 5, world: 6, contact: 7, map: 8 } as const;
export const SYS_NAMES = ['players', 'director', 'enemies', 'collide', 'bosses', 'weapons', 'world', 'contact', 'map'] as const;

/** Frames of history kept (about 4 s at 60 Hz, 2 s at 120 Hz). */
const HIST = 256;

const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();

export interface PerfCounts {
  drawCalls: number;
  triangles: number;
  enemies: number;
  projectiles: number;
  bullets: number;
  particles: number;
}

export class Perf {
  /** per-system sim timers (and GPU timer queries) run only while this is set */
  on = false;
  /** this frame so far */
  private sec = new Float64Array(SEC_NAMES.length);
  private sys = new Float64Array(SYS_NAMES.length);
  private frameStart = 0;
  private ticks = 0;
  private lastStamp = -1;
  /** history rings */
  readonly interval = new Float32Array(HIST);
  readonly cpu = new Float32Array(HIST);
  readonly secHist = SEC_NAMES.map(() => new Float32Array(HIST));
  readonly sysHist = SYS_NAMES.map(() => new Float32Array(HIST));
  readonly tickHist = new Uint8Array(HIST);
  /** GPU milliseconds per frame where the driver offers timer queries (NaN otherwise); filled late */
  readonly gpu = new Float32Array(HIST).fill(NaN);
  head = 0;
  count = 0;
  /** frames committed since the last reset (a benchmark reads the rings by this) */
  total = 0;
  /** the latest renderer and crowd counts (set by the renderer each frame) */
  counts: PerfCounts = { drawCalls: 0, triangles: 0, enemies: 0, projectiles: 0, bullets: 0, particles: 0 };
  /** long tasks (> 50 ms) seen since the overlay or a benchmark started watching */
  longTasks = 0;
  longTaskMs = 0;
  /** whether timer queries are available, once the renderer has asked */
  gpuTimer: 'unknown' | 'yes' | 'no' = 'unknown';

  /** Start a frame; `stamp` is the requestAnimationFrame timestamp. */
  beginFrame(stamp: number): void {
    if (this.lastStamp >= 0) this.interval[this.head] = stamp - this.lastStamp;
    else this.interval[this.head] = 0;
    this.lastStamp = stamp;
    this.frameStart = now();
    this.sec.fill(0);
    this.sys.fill(0);
    this.ticks = 0;
  }

  /** Add the time since `t0` to a frame section; returns the time now (chain the next section from it). */
  mark(section: number, t0: number): number {
    const t = now();
    this.sec[section] += t - t0;
    return t;
  }

  /** Add the time since `t0` to a sim system (only while `on`); returns the time now. */
  sysMark(system: number, t0: number): number {
    const t = now();
    this.sys[system] += t - t0;
    return t;
  }

  tick(): void {
    this.ticks++;
  }

  now(): number {
    return now();
  }

  /** Close the frame: its CPU total and sections go into the history. */
  endFrame(): void {
    const i = this.head;
    this.cpu[i] = now() - this.frameStart;
    for (let k = 0; k < this.sec.length; k++) this.secHist[k][i] = this.sec[k];
    for (let k = 0; k < this.sys.length; k++) this.sysHist[k][i] = this.sys[k];
    this.tickHist[i] = Math.min(255, this.ticks);
    this.gpu[i] = NaN;
    this.head = (i + 1) % HIST;
    if (this.count < HIST) this.count++;
    this.total++;
  }

  /** The ring slot of committed frame number `k` (valid for the last HIST frames). */
  slot(k: number): number {
    return ((this.head - (this.total - k)) % HIST + HIST) % HIST;
  }

  /** A GPU time for a frame `framesAgo` frames back (timer queries resolve a few frames late). */
  setGpu(framesAgo: number, ms: number): void {
    if (framesAgo < 1 || framesAgo > this.count) return;
    this.gpu[(this.head - framesAgo + HIST) % HIST] = ms;
  }

  /** The last `n` values of a ring, oldest first. */
  recent(ring: Float32Array | Uint8Array, n = this.count): number[] {
    const m = Math.min(n, this.count);
    const out: number[] = new Array(m);
    for (let k = 0; k < m; k++) out[k] = ring[(this.head - m + k + HIST) % HIST];
    return out;
  }

  /** Forget the history (a benchmark starting a scenario). */
  reset(): void {
    this.head = 0;
    this.count = 0;
    this.total = 0;
    this.lastStamp = -1;
    this.longTasks = 0;
    this.longTaskMs = 0;
    this.gpu.fill(NaN);
  }
}

export const perf = new Perf();

/** Mean, percentiles and max of a sample (NaNs dropped); null when empty. */
export function summarize(xs: number[]): { n: number; mean: number; median: number; p95: number; p99: number; max: number } | null {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, mean: s.reduce((a, b) => a + b, 0) / s.length, median: q(0.5), p95: q(0.95), p99: q(0.99), max: s[s.length - 1] };
}
