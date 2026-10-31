// The engineering optimization pass: tiled light culling, the sculpt workers' packing, the live update
// checker and the perf rings. (The browser-only parts — workers, timer queries, the prompt — are
// measured and checked in Electron; see web/docs/ENGINEERING_OPTIMIZATION_REPORT.md.)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PoolLights, POOL_MAX } from '../src/render3d/core/pool';
import { creatureModel, CREATURE_IDS } from '../src/render3d/models/creatures';
import { packModel, unpackModel } from '../src/render3d/models/sculptPack';
import { UpdateChecker, type Manifest } from '../src/platform/updates';
import { perf, summarize } from '../src/core/perf';
import { makeGame, runFor } from './helpers';

/** The tile mask the pool built (its private grid), as the shader would read it. */
function maskAt(pool: PoolLights, x: number, z: number): number {
  const rect = (pool.uniforms.uPoolTileRect.value as { x: number; y: number; z: number; w: number });
  const tx = Math.floor((x - rect.x) * rect.z), tz = Math.floor((z - rect.y) * rect.w);
  if (tx < 0 || tz < 0 || tx >= 32 || tz >= 32) return 0xffffff;
  const d = (pool as unknown as { tileData: Uint8Array }).tileData;
  const o = (tz * 32 + tx) * 4;
  return d[o] | (d[o + 1] << 8) | (d[o + 2] << 16);
}

describe('tiled light culling', () => {
  it('marks every tile a light can reach, and only those (lights reach no further than their radius)', () => {
    const pool = new PoolLights();
    pool.begin(0, 0, 1600);
    pool.add(0, 0, 200, 1, 1, 1, 1); // strongest: slot 0
    pool.add(900, -400, 150, 0.6, 1, 0.5, 0.2);
    pool.end();
    expect(pool.uniforms.uPoolN.value).toBe(2);
    const slotOf = (x: number) => (pool.a[0].x === x ? 0 : 1);
    const a = slotOf(0), b = slotOf(900);
    // under each light, and anywhere inside its radius: its bit is set
    for (const [x, z] of [[0, 0], [150, 0], [0, -190], [-140, 140]]) expect(maskAt(pool, x, z) & (1 << a)).toBeTruthy();
    for (const [x, z] of [[900, -400], [1040, -400]]) expect(maskAt(pool, x, z) & (1 << b)).toBeTruthy();
    // far from both: nothing to evaluate
    expect(maskAt(pool, -1000, 1000)).toBe(0);
    // a tile only one of them reaches
    expect(maskAt(pool, 0, 0) & (1 << b)).toBe(0);
    // outside the grid: every light (exact fallback for far scenery and reflections)
    expect(maskAt(pool, 5000, 5000)).toBe(0xffffff);
  });

  it('handles a full pool (every bit of the 24) and the A/B switch', () => {
    const pool = new PoolLights();
    pool.begin(0, 0, 2000);
    for (let i = 0; i < 40; i++) pool.add(-1500 + i * 75, 0, 300, 1 + i * 0.01, 1, 1, 1);
    pool.end();
    expect(pool.uniforms.uPoolN.value).toBe(POOL_MAX);
    let all = 0;
    for (let x = -1950; x < 1950; x += 50) all |= maskAt(pool, x, 0);
    expect(all).toBe((1 << POOL_MAX) - 1);
    pool.cullOff = true;
    pool.end();
    expect((pool.uniforms.uPoolTileRect.value as { x: number }).x).toBeGreaterThan(1e8); // every fragment outside: all lights
  });
});

describe('sculpt worker packing', () => {
  it('a packed model comes back identical: attributes, index and the baked rig', () => {
    const id = CREATURE_IDS[0];
    const m = creatureModel(id);
    const { packed, transfer } = packModel(m);
    expect(transfer.length).toBeGreaterThan(2);
    const u = unpackModel(structuredClone(packed));
    for (const [name, attr] of Object.entries(m.geo.attributes)) {
      const back = u.geo.getAttribute(name);
      expect(back.itemSize).toBe(attr.itemSize);
      expect(Array.from(back.array as Float32Array)).toEqual(Array.from(attr.array as Float32Array));
    }
    expect(Array.from(u.geo.index!.array)).toEqual(Array.from(m.geo.index!.array));
    expect(u.rig.bones).toEqual(m.rig.bones);
    expect(u.rig.rows).toEqual(m.rig.rows);
    const clip = Object.keys(m.rig.rows)[0];
    expect(u.rig.row(clip, 0.3)).toBe(m.rig.row(clip, 0.3));
    expect(u.rig.bone(m.rig.bones[0].name)).toBe(0);
    const a = (u.rig.tex.image as unknown as { data: Float32Array }).data, b = (m.rig.tex.image as unknown as { data: Float32Array }).data;
    expect(a.length).toBe(b.length);
    expect(Array.from(a.slice(0, 64))).toEqual(Array.from(b.slice(0, 64)));
  });
});

describe('live update checks', () => {
  const build = { id: 'aaa111-k1', version: '1.0.0', commit: 'aaa111', time: '2026-10-31T10:00:00.000Z', proto: 11, sim: 'simA' };
  const live = (o: Partial<Manifest>): Manifest => ({ id: 'bbb222-k2', version: '1.0.0', commit: 'bbb222', time: '2026-10-31T12:00:00.000Z', proto: 11, sim: 'simA', ...o });
  const serve = (m: Manifest | null) => vi.stubGlobal('fetch', vi.fn(async () => (m ? { ok: true, json: async () => m } : { ok: false, status: 503, json: async () => ({}) })));
  afterEach(() => vi.unstubAllGlobals());

  it('offers a newer build, flags an incompatible one, ignores an older one, and survives being offline', async () => {
    const c = new UpdateChecker('https://example.test/version.json', build);
    let changes = 0;
    c.onChange = () => changes++;
    serve(live({}));
    await c.check(true);
    expect(c.available).toBe(true);
    expect(c.incompatible).toBe(false); // same protocol and simulation: a UI-only change
    serve(live({ sim: 'simB' }));
    await c.check(true);
    expect(c.incompatible).toBe(true);
    serve(live({ time: '2026-10-30T00:00:00.000Z' }));
    await c.check(true);
    expect(c.available).toBe(false); // this game is ahead of the live build: nothing to offer
    serve(null);
    await c.check(true);
    expect(c.offline).toBe(true);
    expect(c.available).toBe(false); // a failed check changes nothing else
    expect(changes).toBeGreaterThanOrEqual(3);
  });

  it('reports the first manifest even when this game is the live build (it may carry the desktop download)', async () => {
    const c = new UpdateChecker('https://example.test/version.json', build);
    let changes = 0;
    c.onChange = () => changes++;
    serve({ ...live({}), id: build.id, time: build.time, desktop: { windows: { version: '0.1.0', url: 'https://example.test/setup.exe' } } });
    await c.check(true);
    expect(c.available).toBe(false);
    expect(changes).toBe(1);
    expect(c.latest?.desktop?.windows?.url).toBe('https://example.test/setup.exe');
    await c.check(true);
    expect(changes).toBe(1); // the same manifest again is no news
  });

  it('checks at most once a minute unless forced, and never under the dev server', async () => {
    const c = new UpdateChecker('https://example.test/version.json', build);
    serve(live({}));
    await c.check(true);
    await c.check();
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    const dev = new UpdateChecker('https://example.test/version.json', { ...build, id: 'dev' });
    expect(await dev.check(true)).toBeNull();
  });
});

describe('the perf rings', () => {
  it('times the sim systems only while watched, and summarizes frames', () => {
    const g = makeGame({ seed: 4 });
    perf.reset();
    perf.on = true;
    for (let f = 0; f < 20; f++) {
      perf.beginFrame(f * 16.7);
      runFor(g, 1 / 60);
      perf.tick();
      perf.endFrame();
    }
    perf.on = false;
    expect(perf.total).toBe(20);
    const enemies = perf.recent(perf.sysHist[2]);
    expect(enemies.length).toBe(20);
    expect(enemies.every((x) => x >= 0)).toBe(true);
    const s = summarize([1, 2, 3, 4, 100]);
    expect(s?.median).toBe(3);
    expect(s?.max).toBe(100);
    expect(summarize([NaN])).toBeNull();
  });
});
