// Top allocation sites of a sampling heap profile (.heapprofile, from node --heap-prof or the DevTools
// sampling heap profiler): bytes allocated by each function (self), largest first.
//   node scripts/bench/heap-top.mjs file.heapprofile [count]
import { readFileSync } from 'node:fs';
const [file, countArg] = process.argv.slice(2);
const p = JSON.parse(readFileSync(file, 'utf8'));
const self = new Map();
const walk = (n) => {
  const f = n.callFrame;
  const key = `${f.functionName || '(anon)'}  ${(f.url || '').replace(/^.*\/src\//, 'src/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`;
  self.set(key, (self.get(key) ?? 0) + (n.selfSize ?? 0));
  for (const c of n.children ?? []) walk(c);
};
walk(p.head);
const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log(`total sampled ${(total / 1048576).toFixed(1)} MB`);
for (const [k, b] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(countArg ?? 30))) console.log(`${(b / 1048576).toFixed(2).padStart(8)} MB  ${(100 * b / total).toFixed(1).padStart(5)}%  ${k}`);
