// The developer performance overlay (F2): frame pacing, the frame's CPU split, the sim's systems, GPU
// time where the driver offers timer queries, renderer and crowd counts, memory, long tasks and, in
// co-op, the link. Dev builds always; a shipped build only with ?devhud (remembered in this browser).
// It repaints its text four times a second, and the per-system sim timers run only while it's open.

import { perf, SEC, SEC_NAMES, SYS_NAMES, summarize } from '../core/perf';
import type { Game } from '../sim/game';
import type { NetDiag } from '../net/session';
import { h } from './dom';

const KEY = 'nc-devhud';

/** Whether this build lets the overlay open (dev builds, or a browser that asked for it with ?devhud). */
export function perfHudAllowed(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    if (new URLSearchParams(location.search).has('devhud')) localStorage.setItem(KEY, '1');
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '–');
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '–');

export class PerfHud {
  readonly root = h('div', { class: 'perf-hud hidden' });
  private text = h('pre', { class: 'ph-text' });
  private lastPaint = 0;
  private observer: PerformanceObserver | null = null;
  visible = false;

  constructor() {
    this.root.append(this.text);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.classList.toggle('hidden', !this.visible);
    perf.on = this.visible;
    if (this.visible) {
      perf.longTasks = 0;
      perf.longTaskMs = 0;
      this.watchLongTasks();
    } else {
      this.observer?.disconnect();
      this.observer = null;
    }
  }

  private watchLongTasks(): void {
    if (this.observer || typeof PerformanceObserver === 'undefined') return;
    try {
      this.observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          perf.longTasks++;
          perf.longTaskMs += e.duration;
        }
      });
      this.observer.observe({ type: 'longtask', buffered: false });
    } catch {
      this.observer = null;
    }
  }

  update(g: Game | null | undefined, net: NetDiag | null): void {
    if (!this.visible) return;
    const t = performance.now();
    if (t - this.lastPaint < 250) return;
    this.lastPaint = t;
    const n = Math.min(perf.count, 240);
    const iv = summarize(perf.recent(perf.interval, n).filter((x) => x > 0));
    const lastIv = perf.recent(perf.interval, 8).filter((x) => x > 0);
    const fpsNow = lastIv.length ? 1000 / (lastIv.reduce((a, b) => a + b, 0) / lastIv.length) : 0;
    const spikes = perf.recent(perf.interval, n).filter((x) => x > 25).length;
    const cpu = summarize(perf.recent(perf.cpu, n));
    const sec = SEC_NAMES.map((_, k) => summarize(perf.recent(perf.secHist[k], n))?.mean ?? 0);
    const ticks = perf.recent(perf.tickHist, n);
    const tpf = ticks.length ? ticks.reduce((a, b) => a + b, 0) / ticks.length : 0;
    const sys = SYS_NAMES.map((name, k) => [name, summarize(perf.recent(perf.sysHist[k], n))?.mean ?? 0] as const).sort((a, b) => b[1] - a[1]);
    const gpu = summarize(perf.recent(perf.gpu, n));
    const c = perf.counts;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    const lines = [
      `FPS ${fpsNow.toFixed(0)} (avg ${iv ? f1(1000 / iv.mean) : '–'})   frame ${iv ? f2(iv.mean) : '–'} ms  p95 ${iv ? f1(iv.p95) : '–'}  p99 ${iv ? f1(iv.p99) : '–'}  max ${iv ? f1(iv.max) : '–'}`,
      `spikes >25 ms: ${spikes} of the last ${n} frames`,
      `CPU ${cpu ? f2(cpu.mean) : '–'} ms/frame (p99 ${cpu ? f1(cpu.p99) : '–'}):  sim ${f2(sec[SEC.sim])} (${tpf.toFixed(2)} ticks)  render ${f2(sec[SEC.render])}  hud ${f2(sec[SEC.hud])}  net ${f2(sec[SEC.net])}  other ${cpu ? f2(Math.max(0, cpu.mean - sec.reduce((a, b) => a + b, 0))) : '–'}`,
      `sim/frame: ${sys.map(([k, v]) => `${k} ${f2(v)}`).join('  ')}`,
      `GPU ${perf.gpuTimer === 'yes' ? (gpu ? `${f2(gpu.mean)} ms (p99 ${f1(gpu.p99)})` : 'measuring…') : perf.gpuTimer === 'no' ? 'n/a (no timer query on this driver)' : '…'}`,
      `draw calls ${c.drawCalls}  triangles ${(c.triangles / 1e6).toFixed(2)} M  particles ${c.particles}`,
      `enemies ${g?.active.length ?? 0}  projectiles ${c.projectiles}  enemy bullets ${c.bullets}`,
      `heap ${mem ? `${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : 'n/a'}  long tasks ${perf.longTasks} (${perf.longTaskMs.toFixed(0)} ms)`,
    ];
    if (net) {
      lines.push(
        `NET ${net.role.toUpperCase()}  rtt ${net.rtt.toFixed(0)} ms${net.jitter !== undefined ? `  jitter ${net.jitter.toFixed(1)} ms` : ''}  ${net.unreliable ? 'datagram channel' : 'reliable only'}  route ${net.route || '?'}`,
        `  snapshots ${net.snapRate.toFixed(1)} Hz  last ${net.snapBytes} B  ${net.role === 'host' ? 'sent' : 'received'} ${(net.bytesPerSec / 1024).toFixed(1)} KB/s  lost ${net.snapLost}  skipped ${net.skipped}${net.buffered !== undefined ? `  buffered ${net.buffered} B` : ''}`,
        net.role === 'host'
          ? `  inputs: queue ${net.inputQueue}  starved ${net.starved}  dropped ${net.dropped}  invalid ${net.invalid}`
          : `  prediction: error ${net.predErr.toFixed(1)}${net.corrections !== undefined ? `  corrections ${net.corrections}` : ''}  interp ${net.interval.toFixed(0)} ms${net.interpDelay !== undefined ? `  delay ${net.interpDelay.toFixed(0)} ms` : ''}  invalid ${net.invalid}`,
        ...(net.peers && net.peers.length ? net.peers.map((q) => `  ${q.name}: ${q.rtt.toFixed(0)} ms  ${q.kbps.toFixed(1)} KB/s  ${q.route || '?'}  queue ${q.queue}`) : []),
      );
    }
    this.text.textContent = lines.join('\n');
  }
}
