// Top self-time functions of a .cpuprofile (Chromium/Node format).
//   node scripts/bench/profile-top.mjs file.cpuprofile [count] [--dist=dist-bench] [--inclusive=render,tick,...]
// --inclusive also prints, for each function whose label contains one of the names, the time spent in it and
// everything it called (each sample counted once per function, however deep the recursion).
// With --dist (a build made with --sourcemap), functions in the built bundle are named by their original source file,
// line and name through the bundle's source map (source-map-js comes with Vite).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const [file, countArg] = args.filter((a) => !a.startsWith('--'));
const dist = args.find((a) => a.startsWith('--dist='))?.slice(7);
const inclusive = args.find((a) => a.startsWith('--inclusive='))?.slice(12).split(',');
const p = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const consumers = new Map();
const consumerFor = (url) => {
  if (!dist || !url) return null;
  const name = url.replace(/^.*\/assets\//, 'assets/').replace(/\?.*$/, '');
  if (consumers.has(name)) return consumers.get(name);
  const mapFile = join(dist, `${name}.map`);
  let c = null;
  if (existsSync(mapFile)) {
    const { SourceMapConsumer } = createRequire(import.meta.url)('source-map-js');
    c = new SourceMapConsumer(JSON.parse(readFileSync(mapFile, 'utf8')));
  }
  consumers.set(name, c);
  return c;
};
const label = (f) => {
  const c = consumerFor(f.url);
  if (c) {
    const o = c.originalPositionFor({ line: f.lineNumber + 1, column: f.columnNumber });
    if (o.source) return `${o.name || f.functionName || '(anon)'}  ${o.source.replace(/^.*?(src|node_modules)\//, '$1/')}:${o.line}`;
  }
  return `${f.functionName || '(anon)'}  ${(f.url || '').replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`;
};
const self = new Map();
const dts = p.timeDeltas;
for (let i = 0; i < p.samples.length; i++) {
  const n = byId.get(p.samples[i]);
  const key = label(n.callFrame);
  self.set(key, (self.get(key) ?? 0) + (dts[i] ?? 0) / 1000);
}
const total = [...self.values()].reduce((a, b) => a + b, 0);
if (inclusive) {
  const parent = new Map();
  for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const labels = new Map(p.nodes.map((n) => [n.id, label(n.callFrame)]));
  const inc = new Map();
  for (let i = 0; i < p.samples.length; i++) {
    const seen = new Set();
    for (let id = p.samples[i]; id !== undefined; id = parent.get(id)) {
      const l = labels.get(id);
      if (seen.has(l) || !inclusive.some((x) => l.includes(x))) continue;
      seen.add(l);
      inc.set(l, (inc.get(l) ?? 0) + (dts[i] ?? 0) / 1000);
    }
  }
  console.log('inclusive:');
  for (const [k, ms] of [...inc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`${ms.toFixed(1).padStart(8)} ms  ${(100 * ms / total).toFixed(1).padStart(5)}%  ${k}`);
}
const idle = self.get('(idle)  :1') ?? [...self.entries()].find(([k]) => k.startsWith('(idle)'))?.[1] ?? 0;
console.log(`total sampled ${total.toFixed(0)} ms (busy ${(total - idle).toFixed(0)} ms)`);
for (const [k, ms] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(countArg ?? 30))) console.log(`${ms.toFixed(1).padStart(8)} ms  ${(100 * ms / total).toFixed(1).padStart(5)}%  ${k}`);
