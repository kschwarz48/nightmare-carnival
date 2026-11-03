// Simulation benchmark (engineering optimization pass): the headless cost of the 60 Hz sim tick, over
// whole bot nights, bucketed into early / mid / late / boss windows, with garbage collections counted
// per window. Deterministic: the same seeds give the same nights, so before/after runs compare like
// with like (the wall-clock numbers still vary a few percent run to run).
//
//   npx vite-node scripts/bench/sim.ts [out.json] [--quick] [--only=name,...] [--profile=dir]
//
// `--profile=dir` writes a CPU profile and a sampling allocation profile of each scenario's night (the
// ticks and the bot, not the start-up) for scripts/bench/profile-top.mjs and heap-top.mjs. The allocation
// profile keeps the objects collected since, so it shows the churn behind the collections, not only what
// is still alive at the end. (Timings taken while profiling run slower: compare runs without it.)
//
// Measures only `g.tick()` (the bot pilot and drafts are outside the timer). A party night also times
// the host's snapshot encoding for its guests at 20 Hz, the network's main CPU cost.
import { PerformanceObserver, performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { makeGame, smartDraft, smartPilot, autoDraft, autopilot } from '../../tests/helpers';
import type { Game } from '../../src/sim/game';
import type { MapId } from '../../src/data/maps';
import { SnapshotEncoder, type View } from '../../src/net/snapshot';
import { StringDict } from '../../src/net/codec';

interface GcEntry { at: number; ms: number; major: boolean }
const gcs: GcEntry[] = [];
const obs = new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    const kind = (e as unknown as { detail?: { kind?: number } }).detail?.kind ?? 0;
    gcs.push({ at: e.startTime, ms: e.duration, major: kind === 4 });
  }
});
obs.observe({ entryTypes: ['gc'] });
const flush = () => new Promise((r) => setImmediate(r));

const quick = process.argv.includes('--quick');
const outPath = process.argv.slice(2).find((a) => a.endsWith('.json'));

interface Scenario { name: string; map: MapId; seed: number; players: number; until: number }
const SCENARIOS: Scenario[] = [
  { name: 'carnival solo', map: 'carnival_core', seed: 777, players: 1, until: quick ? 700 : 1500 },
  { name: 'fun house solo', map: 'fun_house', seed: 777, players: 1, until: quick ? 700 : 1500 },
  { name: 'boardwalk solo', map: 'boardwalk', seed: 777, players: 1, until: quick ? 700 : 1500 },
  { name: 'carnival party of 4 (host)', map: 'carnival_core', seed: 777, players: 4, until: quick ? 700 : 1500 },
  // (the performance milestone: the fourth map, and the owner's usual party of two)
  { name: 'ghost train solo', map: 'ghost_train', seed: 777, players: 1, until: quick ? 700 : 1500 },
  { name: 'boardwalk party of 2 (host)', map: 'boardwalk', seed: 777, players: 2, until: quick ? 700 : 1500 },
  { name: 'ghost train party of 2 (host)', map: 'ghost_train', seed: 777, players: 2, until: quick ? 700 : 1500 },
];
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const profileDir = process.argv.find((a) => a.startsWith('--profile='))?.slice(10);
const inspector = profileDir ? new Session() : null;
if (inspector && profileDir) {
  mkdirSync(profileDir, { recursive: true });
  inspector.connect();
  await inspector.post('Profiler.enable');
  await inspector.post('Profiler.setSamplingInterval', { interval: 250 });
}
if (only) SCENARIOS.splice(0, SCENARIOS.length, ...SCENARIOS.filter((s) => only.split(',').some((o) => s.name.includes(o))));

const WINDOWS: [string, (t: number, boss: boolean) => boolean][] = [
  ['early 1:00-3:00', (t) => t >= 60 && t < 180],
  ['mid 9:00-11:00', (t) => t >= 540 && t < 660],
  ['late 20:00-23:00', (t) => t >= 1200 && t < 1380],
  ['boss fights', (_t, b) => b],
];

function stats(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { n: s.length, mean: +mean.toFixed(4), median: +q(0.5).toFixed(4), p95: +q(0.95).toFixed(4), p99: +q(0.99).toFixed(4), max: +s[s.length - 1].toFixed(4) };
}

async function run(sc: Scenario) {
  const players = Array.from({ length: sc.players }, (_, i) => ({ character: ['carny', 'strongman', 'fortune_teller', 'carny'][i], name: `P${i}` }));
  const t0 = performance.now();
  const g: Game = makeGame({ map: sc.map, seed: sc.seed, godMode: true, character: 'carny', ...(sc.players > 1 ? { players } : {}) } as never);
  const constructMs = performance.now() - t0;
  const N = Math.ceil(sc.until * 60) + 10;
  const tickMs = new Float64Array(N), tickAt = new Float64Array(N), gameT = new Float64Array(N);
  const alive = new Uint16Array(N), projs = new Uint16Array(N), bullets = new Uint16Array(N), boss = new Uint8Array(N);
  const encMs: number[] = [], encBytes: number[] = [];
  const guests = sc.players > 1 ? Array.from({ length: sc.players - 1 }, () => ({ enc: new SnapshotEncoder(), dict: new StringDict(), seq: 0, ack: 0 })) : [];
  gcs.length = 0;
  if (inspector) {
    await inspector.post('Profiler.start');
    await inspector.post('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  }
  let n = 0;
  while (n < N && g.phase !== 'ended' && g.time < sc.until) {
    if (sc.players > 1) {
      autoDraft(g);
      autopilot(g);
      for (let k = 1; k < g.players.length; k++) {
        const t = g.time * 0.9 + k * 2.1;
        const p0 = g.players[0], pk = g.players[k];
        const tx = p0.x + Math.cos(t) * 220 - pk.x, ty = p0.y + Math.sin(t) * 160 - pk.y;
        const l = Math.hypot(tx, ty) || 1;
        g.inputs[k].moveX = tx / l;
        g.inputs[k].moveY = ty / l;
      }
    } else {
      smartDraft(g);
      if (g.phase === 'draft') g.chooseDraft(0);
      smartPilot(g);
    }
    const a = performance.now();
    g.tick();
    const b = performance.now();
    tickAt[n] = a;
    tickMs[n] = b - a;
    gameT[n] = g.time;
    alive[n] = g.active.length;
    let pc = 0, bc = 0;
    for (const p of g.projs) if (p.alive) pc++;
    for (const x of g.bullets) if (x.alive) bc++;
    projs[n] = pc;
    bullets[n] = bc;
    boss[n] = g.bosses.length > 0 ? 1 : 0;
    // the host's snapshots for each guest, every third tick (20 Hz), acked a snapshot later
    if (guests.length && n % 3 === 0) {
      const fx = g.fx.drain();
      for (let k = 0; k < guests.length; k++) {
        const gu = guests[k];
        const p = g.players[k + 1];
        const view: View = { x: p.x, y: p.y, hx: 1000, hy: 600 };
        const e0 = performance.now();
        const buf = gu.enc.encode(g, { seq: ++gu.seq, ackInput: 0, ackSnap: gu.ack, dict: gu.dict, dictFrom: gu.dict.size, view, fx, sfx: [] });
        encMs.push(performance.now() - e0);
        encBytes.push(buf.byteLength);
        gu.ack = gu.seq - 1;
      }
    } else if (!guests.length && n % 30 === 0) g.fx.drain();
    n++;
    if (n % 600 === 0) await flush();
  }
  await flush();
  if (inspector && profileDir) {
    const file = `${profileDir}/${sc.name.replace(/[^a-z0-9]+/gi, '-')}`;
    const { profile: cpu } = await inspector.post('Profiler.stop');
    writeFileSync(`${file}.cpuprofile`, JSON.stringify(cpu));
    const { profile: heap } = await inspector.post('HeapProfiler.stopSampling');
    writeFileSync(`${file}.heapprofile`, JSON.stringify(heap));
  }
  const gcAt = gcs.map((x) => x);
  const windows = WINDOWS.map(([label, pick]) => {
    const idx: number[] = [];
    for (let i = 0; i < n; i++) if (pick(gameT[i], boss[i] === 1)) idx.push(i);
    if (!idx.length) return { window: label, ticks: 0 };
    const from = tickAt[idx[0]], to = tickAt[idx[idx.length - 1]] + tickMs[idx[idx.length - 1]];
    // collections that started inside the window's ticks (sim time only; the bot runs between ticks)
    let gcN = 0, gcMs = 0, majors = 0;
    const set = new Set(idx);
    for (const e of gcAt) {
      if (e.at < from || e.at > to) continue;
      // find the tick it fell in, if any
      let lo = 0, hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (tickAt[mid] <= e.at) lo = mid; else hi = mid - 1;
      }
      if (!set.has(lo) || e.at > tickAt[lo] + tickMs[lo]) continue;
      gcN++;
      gcMs += e.ms;
      if (e.major) majors++;
    }
    const sum = (arr: ArrayLike<number>) => idx.reduce((s, i) => s + arr[i], 0) / idx.length;
    return {
      window: label, ticks: idx.length, tickMs: stats(idx.map((i) => tickMs[i])),
      enemies: Math.round(sum(alive)), maxEnemies: Math.max(...idx.map((i) => alive[i])), projectiles: Math.round(sum(projs)), bullets: Math.round(sum(bullets)),
      gcInTicks: gcN, gcMajor: majors, gcMsInTicks: +gcMs.toFixed(2), gcPerMinute: +(gcN / (idx.length / 3600)).toFixed(1),
    };
  });
  const all = stats(Array.from(tickMs.subarray(0, n)));
  return {
    scenario: sc.name, map: sc.map, seed: sc.seed, players: sc.players, simulated: Math.round(g.time), ticks: n, constructMs: +constructMs.toFixed(1),
    allTicks: all, windows,
    snapshot: encMs.length ? { perGuestEncodeMs: stats(encMs), bytes: stats(encBytes) } : undefined,
    gcTotal: gcAt.length, gcTotalMs: +gcAt.reduce((s, e) => s + e.ms, 0).toFixed(1),
  };
}

const results = [];
for (const sc of SCENARIOS) {
  const r = await run(sc);
  results.push(r);
  console.log(`\n== ${r.scenario}: ${r.simulated}s simulated, ${r.ticks} ticks, construct ${r.constructMs} ms, all ticks mean ${r.allTicks?.mean} p99 ${r.allTicks?.p99} max ${r.allTicks?.max}`);
  console.log('| window | ticks | mean ms | median | p95 | p99 | max | enemies (max) | projs | bullets | GCs in ticks (major) | GC ms |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const w of r.windows) {
    if (!w.ticks || !('tickMs' in w) || !w.tickMs) { console.log(`| ${w.window} | 0 |`); continue; }
    const t = w.tickMs;
    console.log(`| ${w.window} | ${w.ticks} | ${t.mean.toFixed(3)} | ${t.median.toFixed(3)} | ${t.p95.toFixed(3)} | ${t.p99.toFixed(3)} | ${t.max.toFixed(2)} | ${w.enemies} (${w.maxEnemies}) | ${w.projectiles} | ${w.bullets} | ${w.gcInTicks} (${w.gcMajor}) | ${w.gcMsInTicks} |`);
  }
  if (r.snapshot) console.log(`snapshot encode per guest: mean ${r.snapshot.perGuestEncodeMs?.mean} ms p99 ${r.snapshot.perGuestEncodeMs?.p99} ms; bytes mean ${r.snapshot.bytes?.mean} p99 ${r.snapshot.bytes?.p99}`);
}
if (outPath) writeFileSync(outPath, JSON.stringify({ node: process.version, at: new Date().toISOString(), results }, null, 1));
obs.disconnect();
inspector?.disconnect();
