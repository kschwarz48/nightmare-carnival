// Real-time benchmark scenarios for the engineering optimization pass (dev builds, or a production
// build made with VITE_DEVTOOLS=1). Each scenario sets a night up, lets the real frame loop run it for a
// while with the autopilot playing, and summarizes what `core/perf` recorded: frame pacing from
// requestAnimationFrame, the frame's CPU split, the sim's systems, GPU time where timer queries exist,
// draw calls, triangles, crowd counts, heap and long tasks. requestAnimationFrame must be running (a
// visible window): the Electron runner (desktop/bench.js) drives these and saves the results.

import type { App } from './app';
import type { MapId } from './data/maps';
import { perf, SEC_NAMES, SYS_NAMES, summarize } from './core/perf';

export interface BenchScenario {
  name: string;
  /** stay on the title screen (the attract demo) instead of starting a night */
  menu?: boolean;
  map?: MapId;
  char?: string;
  seed?: number;
  /** night time to fast-forward to before measuring (seconds) */
  t?: number;
  /** keep at least this many monsters alive (the director's own spawns, topped up) */
  crowd?: number;
  /** a boss to wake next to the player */
  boss?: string;
  quality?: 'low' | 'medium' | 'high';
  /** replace the player's build after the fast-forward ("id:level"), so every run measures the same effects */
  weapons?: string[];
  passives?: string[];
  /** seconds of warm-up (not measured) and of measurement */
  warm?: number;
  seconds?: number;
}

const r2 = (x: number | undefined) => (x === undefined || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Read every committed frame from `from` (a perf.total value) up to `to`, from the history rings. */
function collect(from: number, to: number, out: Record<string, number[]>): void {
  for (let k = from; k < to; k++) {
    const i = perf.slot(k);
    (out.interval ??= []).push(perf.interval[i]);
    (out.cpu ??= []).push(perf.cpu[i]);
    (out.ticks ??= []).push(perf.tickHist[i]);
    (out.gpu ??= []).push(perf.gpu[i]);
    SEC_NAMES.forEach((n, s) => (out[`sec_${n}`] ??= []).push(perf.secHist[s][i]));
    SYS_NAMES.forEach((n, s) => (out[`sys_${n}`] ??= []).push(perf.sysHist[s][i]));
  }
}

export async function runBenchScenario(app: App, advance: (sec: number) => unknown, spawnBoss: (id: string) => unknown, sc: BenchScenario) {
  const quality = sc.quality ?? 'high';
  app.save.data.settings.quality = quality;
  app.applySettings();
  let startRunMs = 0;
  if (sc.menu) {
    if (app.game) app.toMenu();
  } else {
    // a fresh benchmark profile hasn't unlocked the later maps
    app.save.data.funhouseTester = true;
    app.save.data.boardwalkTester = true;
    app.save.data.ghosttrainTester = true;
    const s0 = performance.now();
    app.startRun({ character: sc.char ?? 'carny', difficulty: 'midway', curse: false, map: sc.map ?? 'carnival_core', seed: sc.seed ?? 777 });
    startRunMs = performance.now() - s0;
    const g0 = app.game!;
    g0.cfg.godMode = true;
    if (sc.t) advance(sc.t);
    if (sc.weapons) {
      g0.weapons.list.length = 0;
      for (const spec of sc.weapons) {
        const [id, lv] = spec.split(':');
        g0.weapons.add(id);
        for (let i = 1; i < Number(lv ?? 1); i++) g0.weapons.levelUp(id);
      }
    }
    if (sc.passives) {
      g0.player.passives.clear();
      for (const id of sc.passives) g0.player.addPassive(id);
    }
    app.draft.hide();
    app.overlayPause = false;
    app.hud.root.style.display = '';
    if (sc.boss) spawnBoss(sc.boss);
  }
  app.autopilot = !sc.menu;
  const g = () => app.game;
  // keep the night moving: finish prize wheels and drafts, top the crowd up
  const keep = () => {
    const gg = g();
    if (!gg || sc.menu) return;
    if (app.prize.active) {
      app.prize.finishNow();
      app.overlayPause = false;
    }
    if (gg.phase === 'draft') app.pickDraft(0);
    if (sc.crowd) {
      const wave = gg.director.activeWave();
      for (let i = 0; i < 40 && gg.active.length < sc.crowd; i++) gg.director.spawnOne(wave);
    }
  };
  const keeper = setInterval(keep, 200);
  try {
    // the fast-forward blocked the page; let two frames pass so its wait isn't counted as a frame
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    // the warm-up's worst frame: first draws of new models, shaders and textures land here
    perf.reset();
    await sleep((sc.warm ?? 3) * 1000);
    const warm: Record<string, number[]> = {};
    collect(Math.max(0, perf.total - Math.min(perf.total, 250)), perf.total, warm);
    const warmWorstMs = Math.max(0, ...(warm.interval ?? []).filter((x) => x > 0));
    const warmCpuWorstMs = Math.max(0, ...(warm.cpu ?? []));
    perf.reset();
    perf.on = true;
    let longTasks = 0, longMs = 0;
    let obs: PerformanceObserver | null = null;
    try {
      obs = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          longTasks++;
          longMs += e.duration;
        }
      });
      obs.observe({ type: 'longtask', buffered: false });
    } catch {
      obs = null;
    }
    const mem = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? NaN;
    const heap: number[] = [mem()];
    const counts: Record<string, number[]> = {};
    const frames: Record<string, number[]> = {};
    let read = 0;
    const t0 = performance.now();
    const dur = (sc.seconds ?? 15) * 1000;
    while (performance.now() - t0 < dur) {
      await sleep(250);
      heap.push(mem());
      const c = perf.counts;
      (counts.drawCalls ??= []).push(c.drawCalls);
      (counts.triangles ??= []).push(c.triangles);
      (counts.enemies ??= []).push(g()?.active.length ?? 0);
      (counts.projectiles ??= []).push(c.projectiles);
      (counts.bullets ??= []).push(c.bullets);
      (counts.particles ??= []).push(c.particles);
      // GPU times land a few frames late: read up to 10 frames behind the newest
      const upTo = perf.total - 10;
      if (upTo > read) {
        collect(read, upTo, frames);
        read = upTo;
      }
    }
    const elapsed = performance.now() - t0;
    perf.on = false;
    await sleep(120);
    collect(read, perf.total, frames);
    obs?.disconnect();
    const iv = frames.interval?.filter((x) => x > 0) ?? [];
    const sorted = [...iv].sort((a, b) => b - a);
    const worst1 = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 100)));
    const ivs = summarize(iv);
    const canvas = app.renderer.renderer.domElement;
    const out = {
      name: sc.name, quality, map: sc.menu ? 'menu' : sc.map ?? 'carnival_core', seconds: r2(elapsed / 1000),
      startRunMs: r2(startRunMs), warmWorstFrameMs: r2(warmWorstMs), warmWorstCpuMs: r2(warmCpuWorstMs),
      canvas: [canvas.width, canvas.height], dpr: r2(app.renderer.renderer.getPixelRatio()),
      frames: iv.length, fps: r2(iv.length / (elapsed / 1000)),
      frameMs: ivs && { mean: r2(ivs.mean), median: r2(ivs.median), p95: r2(ivs.p95), p99: r2(ivs.p99), max: r2(ivs.max) },
      low1Fps: r2(1000 / (worst1.reduce((a, b) => a + b, 0) / worst1.length)),
      spikesOver25: iv.filter((x) => x > 25).length, spikesOver33: iv.filter((x) => x > 33.4).length, spikesOver50: iv.filter((x) => x > 50).length,
      cpuMs: (() => { const s = summarize(frames.cpu ?? []); return s && { mean: r2(s.mean), p95: r2(s.p95), p99: r2(s.p99), max: r2(s.max) }; })(),
      sectionsMs: Object.fromEntries(SEC_NAMES.map((n) => [n, r2(summarize(frames[`sec_${n}`] ?? [])?.mean)])),
      ticksPerFrame: r2(summarize(frames.ticks ?? [])?.mean),
      simSystemsMs: Object.fromEntries(SYS_NAMES.map((n) => [n, r2(summarize(frames[`sys_${n}`] ?? [])?.mean ?? 0) ?? 0])),
      gpuMs: perf.gpuTimer === 'yes' ? (() => { const s = summarize(frames.gpu ?? []); return s && { mean: r2(s.mean), p95: r2(s.p95), p99: r2(s.p99), max: r2(s.max), n: s.n }; })() : 'unavailable',
      drawCalls: { mean: r2(summarize(counts.drawCalls ?? [])?.mean), max: summarize(counts.drawCalls ?? [])?.max ?? null },
      trianglesM: { mean: r2((summarize(counts.triangles ?? [])?.mean ?? 0) / 1e6), max: r2((summarize(counts.triangles ?? [])?.max ?? 0) / 1e6) },
      enemies: { mean: r2(summarize(counts.enemies ?? [])?.mean), max: summarize(counts.enemies ?? [])?.max ?? null },
      projectiles: { mean: r2(summarize(counts.projectiles ?? [])?.mean), max: summarize(counts.projectiles ?? [])?.max ?? null },
      bullets: { mean: r2(summarize(counts.bullets ?? [])?.mean), max: summarize(counts.bullets ?? [])?.max ?? null },
      particles: { mean: r2(summarize(counts.particles ?? [])?.mean), max: summarize(counts.particles ?? [])?.max ?? null },
      heapMB: { start: r2(heap[0] / 1048576), end: r2(heap[heap.length - 1] / 1048576), min: r2(Math.min(...heap) / 1048576), max: r2(Math.max(...heap) / 1048576), drops: heap.reduce((n, v, i) => n + (i && v < heap[i - 1] - 1048576 ? 1 : 0), 0) },
      longTasks, longTaskMs: r2(longMs),
    };
    return out;
  } finally {
    clearInterval(keeper);
    perf.on = false;
  }
}

/**
 * Frame pacing and the frame's CPU split over the next `seconds` of real frames, in whatever the page is showing
 * (performance milestone, D-96: the co-op benchmark measures a host's window and a guest's at once with it; see
 * desktop/coop-bench.js). Also the crowd and, in co-op, the link's diagnostics at the end.
 */
export async function measureFrames(seconds: number, app: App) {
  perf.reset();
  perf.on = true;
  const t0 = performance.now();
  const frames: Record<string, number[]> = {};
  let read = 0;
  while (performance.now() - t0 < seconds * 1000) {
    await sleep(250);
    const upTo = perf.total - 10;
    if (upTo > read) {
      collect(read, upTo, frames);
      read = upTo;
    }
  }
  const elapsed = performance.now() - t0;
  perf.on = false;
  await sleep(120);
  collect(read, perf.total, frames);
  const iv = frames.interval?.filter((x) => x > 0) ?? [];
  const s = summarize(iv);
  const sec = (n: string) => r2(summarize(frames[`sec_${n}`] ?? [])?.mean);
  const cpu = summarize(frames.cpu ?? []);
  const gpu = perf.gpuTimer === 'yes' ? summarize(frames.gpu ?? []) : null;
  const net = (app as unknown as { net?: { role: string; host: { diag: unknown }; guest: { diag: unknown } } }).net;
  return {
    seconds: r2(elapsed / 1000), frames: iv.length, fps: r2(iv.length / (elapsed / 1000)),
    frameMs: s && { mean: r2(s.mean), p95: r2(s.p95), p99: r2(s.p99), max: r2(s.max) },
    spikesOver25: iv.filter((x) => x > 25).length, spikesOver50: iv.filter((x) => x > 50).length,
    cpuMs: cpu && { mean: r2(cpu.mean), p99: r2(cpu.p99) },
    sectionsMs: Object.fromEntries(SEC_NAMES.map((n) => [n, sec(n)])),
    gpuMs: gpu && { mean: r2(gpu.mean), p99: r2(gpu.p99) },
    enemies: app.game?.active.length ?? 0,
    net: net ? (net.role === 'host' ? net.host.diag : net.guest.diag) : null,
  };
}

/** Mean GPU and CPU milliseconds over the next `frames` frames (timer queries; for A/B experiments). */
export async function gpuProbe(frames = 90): Promise<{ gpu: number | null; cpu: number | null; render: number | null; fps: number | null; drawCalls: number; trianglesM: number }> {
  perf.reset();
  perf.on = true;
  const t0 = performance.now();
  while (perf.total < frames + 10) await sleep(50);
  const dt = performance.now() - t0;
  const out: Record<string, number[]> = {};
  collect(5, perf.total - 4, out);
  perf.on = false;
  return {
    gpu: r2(summarize(out.gpu ?? [])?.mean), cpu: r2(summarize(out.cpu ?? [])?.mean), render: r2(summarize(out.sec_render ?? [])?.mean),
    fps: r2((perf.total * 1000) / dt), drawCalls: perf.counts.drawCalls, trianglesM: r2(perf.counts.triangles / 1e6) ?? 0,
  };
}

