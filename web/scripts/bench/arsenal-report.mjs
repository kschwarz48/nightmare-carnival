// Per-weapon before/after rows for docs/WEAPON_BALANCE_AUDIT.md (D-103): node scripts/bench/arsenal-report.mjs <before> <after>
import { readFileSync, readdirSync } from 'node:fs';
const [b, a] = process.argv.slice(2);
const dir = new URL('../../../artifacts/balance/', import.meta.url);
const load = (l) => readdirSync(dir).filter((f) => f.startsWith(`${l}_`) && f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')).rows);
const B = load(b), A = load(a);
const get = (rows, id, lv) => rows.find((r) => r.id === id && r.lv === lv)?.fights ?? {};
const f = (n) => (n == null ? '–' : n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0));
const pair = (x, y) => `${f(x)}→${f(y)}`;
console.log('| weapon | L1 swarm | L8 boss | L8 swarm | L8 night kills/min | L8 uptime | E8 boss | E8 swarm | E8 night kills/min | E8 hits/min |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const id of [...new Set(A.map((r) => r.id))]) {
  if (id === 'mirror') continue;
  const b1 = get(B, id, 'L1'), a1 = get(A, id, 'L1'), b8 = get(B, id, 'L8'), a8 = get(A, id, 'L8'), be = get(B, id, 'E8'), ae = get(A, id, 'E8');
  console.log(`| ${id} | ${pair(b1.swarm?.dps, a1.swarm?.dps)} | ${pair(b8.boss?.dps, a8.boss?.dps)} | ${pair(b8.swarm?.dps, a8.swarm?.dps)} | ${pair(b8.night?.kills, a8.night?.kills)} | ${Math.round((b8.swarm?.up ?? 0) * 100)}→${Math.round((a8.swarm?.up ?? 0) * 100)}% | ${pair(be.boss?.dps, ae.boss?.dps)} | ${pair(be.swarm?.dps, ae.swarm?.dps)} | ${pair(be.night?.kills, ae.night?.kills)} | ${pair(be.night?.hits, ae.night?.hits)} |`);
}
const m = (rows, lv) => rows.find((r) => r.id === 'mirror' && r.lv === lv)?.fights ?? {};
console.log(`\nFunhouse Mirror (damage it adds beside Throwing Cards / Royal Flush): L8 swarm +${f(m(B, 'L8').swarm?.dps)} → +${f(m(A, 'L8').swarm?.dps)}; E8 swarm +${f(m(B, 'E8').swarm?.dps)} → +${f(m(A, 'E8').swarm?.dps)}, boss +${f(m(B, 'E8').boss?.dps)} → +${f(m(A, 'E8').boss?.dps)}.`);
