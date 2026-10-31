// GPU frame time from the driver's timer queries (EXT_disjoint_timer_query_webgl2), for the developer
// overlay and the benchmarks. Results arrive a few frames late and are read without stalling: a query
// is only asked for its result once the driver says it's available. A "disjoint" frame (the GPU
// clock was interrupted) is thrown away. Browsers that don't expose the extension report nothing;
// CPU timers are never passed off as GPU time.

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export class GpuTimer {
  readonly available: boolean;
  private ext: TimerExt | null;
  private free: WebGLQuery[] = [];
  private pending: { q: WebGLQuery; frame: number }[] = [];
  private active: { q: WebGLQuery; frame: number } | null = null;

  constructor(private gl: WebGL2RenderingContext) {
    this.ext = (gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null) ?? null;
    this.available = !!this.ext;
  }

  /** Start timing frame `frame` (skipped while too many results are still outstanding). */
  begin(frame: number): void {
    if (!this.ext || this.active || this.pending.length >= 6) return;
    const q = this.free.pop() ?? this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = { q, frame };
  }

  end(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** Hand over every finished result, oldest first, as (frame, milliseconds). */
  poll(out: (frame: number, ms: number) => void): void {
    if (!this.ext || !this.pending.length) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length) {
      const p = this.pending[0];
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT) as number;
      this.pending.shift();
      this.free.push(p.q);
      if (!disjoint) out(p.frame, ns / 1e6);
    }
  }
}
