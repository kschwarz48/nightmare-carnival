// Tables from arsenal bench runs (D-103): node scripts/bench/arsenal-table.mjs <label> [compare-label] [--md]
// Reads ../artifacts/balance/<label>_*.json. For each investment point it prints each weapon's useful damage per
// second in every fight, and an index: the geometric mean over the crowd and boss fights of the weapon's damage over
// the median weapon's (1.00 = the median; 1.25 = a quarter above it). With a second label it prints the change.
import { readFileSync, readdirSync } from 'node:fs';

const [label, cmp] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const md = process.argv.includes('--md');
const dir = new URL('../../../artifacts/balance/', import.meta.url);
function load(l) {
  const rows = [];
  for (const f of readdirSync(dir)) if (f.startsWith(`${l}_`) && f.endsWith('.json')) rows.push(...JSON.parse(readFileSync(new URL(f, dir), 'utf8')).rows);
  return rows;
}
const FIGHTS = ['boss', 'elite', 'group', 'swarm', 'runners', 'mixed'];
const LV = ['L1', 'L4', 'L8', 'E1', 'E8'];
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
function index(rows) {
  const out = {};
  for (const lv of LV) {
    const at = rows.filter((r) => r.lv === lv && r.id !== 'mirror');
    const med = Object.fromEntries(FIGHTS.map((f) => [f, median(at.map((r) => r.fights[f]?.dps ?? 0))]));
    for (const r of at) {
      let s = 0, n = 0;
      for (const f of FIGHTS) if (med[f] > 0 && r.fights[f]) { s += Math.log(Math.max(0.01, r.fights[f].dps / med[f])); n++; }
      (out[r.id] ??= {})[lv] = n ? Math.exp(s / n) : 0;
    }
  }
  return out;
}
const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0));
const rows = load(label), idx = index(rows);
const old = cmp ? load(cmp) : null, oidx = old ? index(old) : null;
const ids = [...new Set(rows.map((r) => r.id))];
for (const lv of LV) {
  const at = rows.filter((r) => r.lv === lv);
  if (!at.length) continue;
  console.log(`\n${lv}  ${'weapon'.padEnd(16)} ${FIGHTS.map((f) => f.padStart(7)).join('')}  ovk% up%  kpm  hpm  index${oidx ? '  was' : ''}`);
  const sorted = ids.filter((id) => at.find((r) => r.id === id)).sort((a, b) => (idx[b]?.[lv] ?? 0) - (idx[a]?.[lv] ?? 0));
  for (const id of sorted) {
    const r = at.find((x) => x.id === id);
    if (id === 'mirror') {
      console.log(`    ${'mirror (adds)'.padEnd(16)} ${FIGHTS.map((f) => `+${fmt(r.fights[f]?.dps ?? 0)}`.padStart(7)).join('')}`);
      continue;
    }
    const n = r.fights.night, sw = r.fights.swarm;
    const was = oidx?.[id]?.[lv];
    console.log(`    ${id.padEnd(16)} ${FIGHTS.map((f) => fmt(r.fights[f]?.dps ?? 0).padStart(7)).join('')}  ${String(Math.round((sw?.over ?? 0) * 100)).padStart(3)} ${String(Math.round((sw?.up ?? 0) * 100)).padStart(3)}  ${n ? fmt(n.kills).padStart(3) : '  -'}  ${n ? (n.hits ?? 0).toFixed(0).padStart(3) : '  -'}  ${(idx[id]?.[lv] ?? 0).toFixed(2)}${was ? `  ${was.toFixed(2)}` : ''}`);
  }
}
if (md) {
  console.log('\n| weapon | ' + LV.join(' | ') + ' |\n|---|' + LV.map(() => '---').join('|') + '|');
  for (const id of ids) if (id !== 'mirror') console.log(`| ${id} | ${LV.map((lv) => (idx[id]?.[lv] ?? 0).toFixed(2) + (oidx ? ` (${(oidx[id]?.[lv] ?? 0).toFixed(2)})` : '')).join(' | ')} |`);
}
