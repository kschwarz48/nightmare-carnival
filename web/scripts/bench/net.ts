// Network stress benchmark (engineering optimization pass): a two-player co-op night over the real host
// and guest sessions, on the loopback network with latency, jitter, loss, loss bursts and reordering,
// in a dense crowd (topped up to 250 monsters). For each condition it reports what a guest would feel:
//   - prediction: the gap between the guest's drawn self and the host's truth, and corrections
//   - view lag: how far behind the host's present the guest sees the world (enemies, partners)
//   - own projectiles: how far from the guest's drawn self its projectiles first appear
//   - snapshots: loss, size and bandwidth; the host's input queue (latency it adds), starved/dropped inputs
//   - convergence: the replica's enemy positions against the host's at the same sim time
//   - liveness: drafts and prize wheels resolved, the night kept moving
//
//   - CPU (D-96): the host session's work per frame (inputs in, snapshots encoded and sent) and the guest's (its
//     snapshot decoding and applying, prediction and the replica's frame), mean / p99 ms
//
//   npx vite-node scripts/bench/net.ts [out.json] [--quick] [--crowd=N] [--map=ghost_train] [--only=RTT 100]
import { writeFileSync } from 'node:fs';
import { Game } from '../../src/sim/game';
import { LoopbackNet, type LoopbackOpts } from '../../src/net/link';
import { GuestSession, HostSession, runConfigFromStart, type HostProfile } from '../../src/net/session';
import type { GuestProfile } from '../../src/net/protocol';
import { summarize } from '../../src/core/perf';
import type { MapId } from '../../src/data/maps';

const hostProfile: HostProfile = { name: 'Kevin', meta: [], rerolls: 1, banishes: 1, canSkip: true, aimMode: 'auto' };
const guestProfile: GuestProfile = { name: 'Brother', meta: [], rerolls: 1, banishes: 0, canSkip: false, aimMode: 'auto', chars: ['carny', 'strongman', 'fortune_teller'] };
const UNLOCKED = ['w_orbs', 'w_cannon', 'w_laser', 'w_bell', 'w_mirror', 'p_season_pass', 'p_coin_purse', 'p_rabbits_foot'];
const quick = process.argv.includes('--quick');
const outPath = process.argv.slice(2).find((a) => a.endsWith('.json'));
const SECONDS = quick ? 20 : 45;
/** monsters kept alive on the host (--crowd=80 for a lighter night with small snapshots) */
const CROWD = Number(process.argv.find((a) => a.startsWith('--crowd='))?.split('=')[1] ?? 250);
/** the map the party plays (D-96: the Ghost Train, the owner's usual party night) */
const MAP = (process.argv.find((a) => a.startsWith('--map='))?.split('=')[1] ?? 'carnival_core') as MapId;
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const FRAME = 1000 / 60;

interface Cond { name: string; opts: LoopbackOpts }
const CONDS: Cond[] = [
  { name: 'RTT 0', opts: {} },
  { name: 'RTT 50, ±5 jitter', opts: { latency: 25, jitter: 5 } },
  { name: 'RTT 100, ±10 jitter', opts: { latency: 50, jitter: 10 } },
  { name: 'RTT 150, ±15 jitter', opts: { latency: 75, jitter: 15 } },
  { name: 'RTT 200, ±20 jitter', opts: { latency: 100, jitter: 20 } },
  { name: 'RTT 100, 1% loss', opts: { latency: 50, jitter: 10, loss: 0.01 } },
  { name: 'RTT 100, 3% loss', opts: { latency: 50, jitter: 10, loss: 0.03 } },
  { name: 'RTT 100, loss bursts', opts: { latency: 50, jitter: 10, burst: { p: 0.006, len: 8 } } },
  { name: 'RTT 100, ±35 jitter (reordering)', opts: { latency: 50, jitter: 35, dupe: 0.01 } },
];

function runCond(c: Cond) {
  const net = new LoopbackNet({ ...c.opts, seed: 7 });
  let now = 1000;
  const host = new HostSession('ABC234', hostProfile);
  const [hl, gl] = net.pair();
  host.accept(hl);
  const gs = new GuestSession(gl, guestProfile, null, now);
  gs.onStart = (cfg) => new Game(runConfigFromStart(cfg));
  let drafts = 0, prizes = 0;
  gs.onEvent = (type, e) => {
    gs.game?.bus.emit(type as never, e as never);
    if (type === 'draft') {
      drafts++;
      gs.draft('choose', 0);
    }
    if (type === 'chest') {
      prizes++;
      gs.prizeDone();
    }
  };
  let g: Game | null = null;
  const hostMs: number[] = [], guestMs: number[] = [];
  let measuring = false, guestStep = 0;
  const step = (frame?: () => void) => {
    now += FRAME;
    // the guest's snapshots are decoded and applied as they arrive (in the pump), as in the browser
    const p0 = performance.now();
    net.pump(now);
    const p1 = performance.now();
    frame?.();
    const h0 = performance.now();
    host.update(now, FRAME);
    const h1 = performance.now();
    gs.update(now);
    const g1 = performance.now();
    if (measuring) {
      hostMs.push(h1 - h0);
      guestMs.push(p1 - p0 + (g1 - h1) + guestStep);
    }
    guestStep = 0;
  };
  const wait = (ms: number) => {
    const end = now + ms;
    while (now < end) step();
  };
  wait(300);
  // the guest throws cards (projectiles), so its own shots can be measured; the host swings the mallet
  host.setCharacter('strongman');
  gs.pick('carny');
  wait(300);
  host.setMap(MAP);
  host.setReady(true);
  gs.setReady(true);
  wait(300);
  const cfg = host.start({ seed: 2024, unlocked: UNLOCKED, questMemory: {} });
  if (!cfg) throw new Error(`${c.name}: the run did not start`);
  g = new Game({ ...runConfigFromStart(cfg), godMode: true });
  host.attachGame(g);
  g.bus.on('chest', () => host.prizeHostDone());
  wait(400);
  const gaps: number[] = [], lags: number[] = [], origin: number[] = [], conv: number[] = [], queue: number[] = [];
  const snapErr: number[] = [], snapBytes: number[] = [];
  const bytesAtStart = gl.stats().bytesIn;
  let corrections = 0, lastRecv = 0, lastDash = -1e9, prevSnapT = 0, prevSnapAt = 0;
  // host positions by sim time (to compare the replica against the same moment)
  const hist = new Map<number, Map<number, [number, number]>>();
  const seenProj = new Set<number>();
  const t0 = g.time;
  const end = now + SECONDS * 1000;
  measuring = true;
  while (now < end) {
    step(() => {
      const hg = g!;
      const rep = gs.replica;
      const mg = gs.game;
      if (gs.state === 'run' && mg && mg.phase === 'play' && !gs.pausedBy && rep && !rep.frozen) {
        const t = now / 1000;
        const s0 = performance.now();
        gs.step(Math.cos(t * 0.8), Math.sin(t * 1.1), 0, 0, false);
        rep.frame(1 / 60);
        guestStep = performance.now() - s0;
      }
      if (!host.paused && host.prizeReady && hg.phase === 'play') {
        hg.inputs[0].moveX = Math.cos(hg.realTime * 0.5) * 0.7 - hg.players[0].x / 1500;
        hg.inputs[0].moveY = Math.sin(hg.realTime * 0.5) * 0.7 - hg.players[0].y / 1500;
        host.beforeTick(hg);
        hg.tick();
        host.captureFx(hg.fx.events);
        hg.fx.drain();
        // a dense crowd: top it up to 250
        if (hg.tickCount % 30 === 0) {
          const w = hg.director.activeWave();
          for (let i = 0; i < 30 && hg.active.length < CROWD; i++) hg.director.spawnOne(w);
        }
        const snap = new Map<number, [number, number]>();
        for (const e of hg.active) snap.set(e.uid, [e.x, e.y]);
        hist.set(Math.round(hg.time * 600), snap);
        if (hist.size > 400) hist.delete(hist.keys().next().value!);
      }
      if (hg.phase === 'draft' && hg.draftPending(0)) hg.chooseDraft(0, 0);
      const s = host.seats?.[1] as unknown as { queue?: unknown[] } | undefined;
      if (s?.queue) queue.push(s.queue.length);
      if (!rep || !mg || gs.state !== 'run') return;
      // prediction gap while walking (the host-only dash override is excluded, as in tests/net.test.ts)
      if (hg.players[1].dashT > 0) lastDash = now;
      if (mg.phase === 'play' && !rep.frozen && hg.phase === 'play' && now - lastDash > 600) {
        const d = rep.localDrawPos();
        gaps.push(Math.hypot(d.x - hg.players[1].x, d.y - hg.players[1].y));
      }
      // a new snapshot: its correction, its age, and the replica against the host at that sim time
      if (rep.received !== lastRecv) {
        lastRecv = rep.received;
        snapErr.push(rep.predErr);
        snapBytes.push(gs.diag.snapBytes);
        if (rep.predErr > 6) corrections++;
        prevSnapT = mg.time;
        prevSnapAt = now;
        const ref = hist.get(Math.round(mg.time * 600));
        if (ref) {
          let sum = 0, n = 0;
          for (const e of mg.active) {
            const p = ref.get(e.uid);
            if (!p) continue;
            sum += Math.hypot(e.x - p[0], e.y - p[1]);
            n++;
          }
          if (n) conv.push(sum / n);
        }
        // the guest's own projectiles, the first time it sees each: how far from its drawn self
        const me = rep.localDrawPos();
        for (let k = 0; k < mg.projs.length; k++) {
          const pr = mg.projs[k];
          const key = k * 256 + pr.gen;
          if (!pr.alive || pr.owner !== 1 || seenProj.has(key)) continue;
          seenProj.add(key);
          origin.push(Math.hypot(pr.x - me.x, pr.y - me.y));
        }
        if (seenProj.size > 5000) seenProj.clear();
      }
      // what the guest is drawing for everyone else: the last snapshot's moment, interpolated
      if (prevSnapAt) {
        const shownT = prevSnapT - Math.max(0, rep.interval - (now - prevSnapAt)) / 1000;
        lags.push((hg.time - shownT) * 1000);
      }
    });
  }
  const rep = gs.replica!;
  const hs = host.seats[1] as unknown as { stats: { bytes: number; snaps: number; starved: number; dropped: number } };
  const r2 = (x: number | undefined) => (x === undefined ? null : Math.round(x * 100) / 100);
  const sm = (xs: number[]) => {
    const s = summarize(xs);
    return s && { mean: r2(s.mean), p95: r2(s.p95), max: r2(s.max) };
  };
  return {
    condition: c.name, simulated: r2(g.time - t0), enemies: g.active.length,
    prediction: { gap: sm(gaps), corrections, perSnapshot: sm(snapErr) },
    viewLagMs: sm(lags),
    ownProjectileOrigin: { n: origin.length, ...sm(origin) },
    snapshots: { received: rep.received, lostPct: r2((100 * rep.dropped) / Math.max(1, rep.received + rep.dropped)), interval: r2(rep.interval), avgBytes: r2(summarize(snapBytes)?.mean), kbps: r2((gl.stats().bytesIn - bytesAtStart) / 1024 / SECONDS) },
    hostInputQueue: { ...sm(queue), starved: hs.stats.starved, dropped: hs.stats.dropped },
    convergence: sm(conv),
    liveness: { drafts, prizes, guestState: gs.state, nightMoved: r2(g.time - t0) },
    cpuMs: { host: sm99(hostMs), guest: sm99(guestMs) },
  };
}

function sm99(xs: number[]) {
  const s = summarize(xs);
  return s && { mean: Math.round(s.mean * 1000) / 1000, p99: Math.round(s.p99 * 1000) / 1000, max: Math.round(s.max * 100) / 100 };
}

const results = CONDS.filter((c) => !ONLY || ONLY.split(',').some((o) => c.name.includes(o))).map((c) => {
  const r = runCond(c);
  console.log(JSON.stringify(r));
  return r;
});
console.log(`\nmap ${MAP}, crowd ${CROWD}, ${SECONDS} s per condition`);
console.log('\n| condition | pred. gap mean / p95 / max | corrections | view lag mean / p95 ms | own projectiles start mean / p95 away | snapshot loss % | bytes / KB/s | host input queue mean / max | convergence mean | drafts / prizes | host / guest net CPU ms mean (p99) |');
console.log('|---|---|---:|---|---|---:|---|---|---:|---|---|');
for (const r of results) {
  const g = r.prediction.gap, l = r.viewLagMs, o = r.ownProjectileOrigin, q = r.hostInputQueue;
  const cpu = r.cpuMs;
  console.log(`| ${r.condition} | ${g?.mean} / ${g?.p95} / ${g?.max} | ${r.prediction.corrections} | ${l?.mean} / ${l?.p95} | ${o.mean ?? '–'} / ${o.p95 ?? '–'} (${o.n}) | ${r.snapshots.lostPct} | ${r.snapshots.avgBytes} / ${r.snapshots.kbps} | ${q.mean} / ${q.max} | ${r.convergence?.mean ?? '–'} | ${r.liveness.drafts} / ${r.liveness.prizes} | ${cpu.host?.mean} (${cpu.host?.p99}) / ${cpu.guest?.mean} (${cpu.guest?.p99}) |`);
}
if (outPath) writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), map: MAP, crowd: CROWD, seconds: SECONDS, results }, null, 1));
