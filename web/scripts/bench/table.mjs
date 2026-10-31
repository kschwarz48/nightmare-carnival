// Print benchmark JSON (desktop/bench.js output) as markdown tables; with two files, before → after.
//   node scripts/bench/table.mjs artifacts/bench/render-baseline.json [artifacts/bench/render-after.json]
import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')));
const by = (j) => Object.fromEntries(j.results.map((r) => [r.name, r]));
const A = by(a), B = b ? by(b) : null;
const v = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? '–' : typeof x === 'number' ? x.toFixed(d) : String(x));
const pair = (x, y, d = 1) => (B ? `${v(x, d)} → ${v(y, d)}` : v(x, d));
console.log(`display ${a.display?.size?.width}×${a.display?.size?.height} @ ${a.display?.hz} Hz, scale ${a.display?.scale}; Electron ${a.versions?.electron} (Chrome ${a.versions?.chrome}); ${a.uncapped ? 'uncapped' : 'vsync'}${b ? ` vs ${b.uncapped ? 'uncapped' : 'vsync'}` : ''}`);
console.log(`boot: ready at ${v(a.boot?.ready, 0)} ms${b ? ` → ${v(b.boot?.ready, 0)} ms` : ''}\n`);
console.log('| scenario | fps | frame mean / p95 / p99 / max ms | 1% low fps | spikes >25 / >50 ms | CPU mean / p99 ms | render CPU | sim CPU | HUD CPU | GPU mean / p99 ms | draw calls | tris (M) | enemies | heap MB (min–max) | long tasks |');
console.log('|---|---:|---|---:|---|---|---:|---:|---:|---|---:|---:|---:|---|---:|');
for (const [name, r] of Object.entries(A)) {
  const s = B?.[name];
  if (r.error) { console.log(`| ${name} | error: ${r.error} |`); continue; }
  const fm = (x) => (x?.frameMs ? `${v(x.frameMs.mean, 2)} / ${v(x.frameMs.p95)} / ${v(x.frameMs.p99)} / ${v(x.frameMs.max, 0)}` : '–');
  const gpu = (x) => (x?.gpuMs && typeof x.gpuMs === 'object' ? `${v(x.gpuMs.mean, 2)} / ${v(x.gpuMs.p99)}` : 'n/a');
  const cpu = (x) => (x?.cpuMs ? `${v(x.cpuMs.mean, 2)} / ${v(x.cpuMs.p99)}` : '–');
  const heap = (x) => (x?.heapMB ? `${v(x.heapMB.min, 0)}–${v(x.heapMB.max, 0)}` : '–');
  const both = (f) => (s ? `${f(r)} → ${f(s)}` : f(r));
  console.log(`| ${name} | ${pair(r.fps, s?.fps, 0)} | ${both(fm)} | ${pair(r.low1Fps, s?.low1Fps, 0)} | ${both((x) => `${x.spikesOver25} / ${x.spikesOver50}`)} | ${both(cpu)} | ${pair(r.sectionsMs?.render, s?.sectionsMs?.render, 2)} | ${pair(r.sectionsMs?.sim, s?.sectionsMs?.sim, 2)} | ${pair(r.sectionsMs?.hud, s?.sectionsMs?.hud, 2)} | ${both(gpu)} | ${pair(r.drawCalls?.mean, s?.drawCalls?.mean, 0)} | ${pair(r.trianglesM?.mean, s?.trianglesM?.mean, 2)} | ${pair(r.enemies?.mean, s?.enemies?.mean, 0)} | ${both(heap)} | ${pair(r.longTasks, s?.longTasks, 0)} |`);
}
console.log('\nrun start (startRun ms) and worst warm-up frame (ms):');
for (const [name, r] of Object.entries(A)) {
  const s = B?.[name];
  if (r.error || r.map === 'menu') continue;
  console.log(`- ${name}: start ${pair(r.startRunMs, s?.startRunMs, 0)} ms, worst warm-up frame ${pair(r.warmWorstFrameMs, s?.warmWorstFrameMs, 0)} ms (CPU ${pair(r.warmWorstCpuMs, s?.warmWorstCpuMs, 0)})`);
}
