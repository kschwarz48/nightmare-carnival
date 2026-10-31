// Top self-time functions of a .cpuprofile (Chromium/Node format).
//   node scripts/bench/profile-top.mjs file.cpuprofile [count] [--from=ms --to=ms]
import { readFileSync } from 'node:fs';
const [file, countArg] = process.argv.slice(2);
const p = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const self = new Map();
const dts = p.timeDeltas;
for (let i = 0; i < p.samples.length; i++) {
  const n = byId.get(p.samples[i]);
  const f = n.callFrame;
  const key = `${f.functionName || '(anon)'}  ${(f.url || '').replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`;
  self.set(key, (self.get(key) ?? 0) + (dts[i] ?? 0) / 1000);
}
const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log(`total sampled ${total.toFixed(0)} ms`);
for (const [k, ms] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(countArg ?? 30))) console.log(`${ms.toFixed(1).padStart(8)} ms  ${(100 * ms / total).toFixed(1).padStart(5)}%  ${k}`);
