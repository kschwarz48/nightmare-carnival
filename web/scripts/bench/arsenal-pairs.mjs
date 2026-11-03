// Mixed-build rows for docs/WEAPON_BALANCE_AUDIT.md (D-103): node scripts/bench/arsenal-pairs.mjs <before> <after> [override]
// For each pair (A + B): B's share of the pair's useful damage in the swarm and on the night, and what adding B to A did
// to the night's kills and hits taken. `override` (a label) replaces matching pairs from a later run.
import { readFileSync, readdirSync } from 'node:fs';
const [b, a, o] = process.argv.slice(2);
const dir = new URL('../../../artifacts/balance/', import.meta.url);
const load = (l) => (l ? readdirSync(dir).filter((f) => f.startsWith(`pairs-${l}_`) && f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')).rows) : []);
const B = load(b), A = load(a), O = load(o);
const key = (r) => `${r.a}+${r.b} ${r.lv}`;
const after = new Map([...A, ...O].map((r) => [key(r), r]));
const pc = (x) => `${Math.round((x ?? 0) * 100)}%`;
const f = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n));
console.log('| A + B | level | B\'s share, swarm | B\'s share, night | night kills/min: A alone → A+B | night hits/min: A alone → A+B |');
console.log('|---|---|---:|---:|---:|---:|');
for (const r0 of B) {
  const r1 = after.get(key(r0));
  if (!r1) continue;
  const s0 = r0.fights.swarm, s1 = r1.fights.swarm, n0 = r0.fights.night, n1 = r1.fights.night;
  console.log(`| ${r0.a} + **${r0.b}** | ${r0.lv} | ${pc(s0.shareB)} → ${pc(s1.shareB)} | ${pc(n0.shareB)} → **${pc(n1.shareB)}** | ${f(n0.a.kills)}→${f(n0.ab.kills)} ⇒ ${f(n1.a.kills)}→${f(n1.ab.kills)} | ${n0.a.hits.toFixed(0)}→${n0.ab.hits.toFixed(0)} ⇒ ${n1.a.hits.toFixed(0)}→${n1.ab.hits.toFixed(0)} |`);
}
