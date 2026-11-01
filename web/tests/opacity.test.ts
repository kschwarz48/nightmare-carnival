// The attacks' opacity setting reaches 0 (D-83): every effect of a player's attack (swings, rings, bursts,
// sparks, its floating text, its flash of light) is tagged where the sim makes it, the tag reaches a co-op
// guest, and the effects renderer draws those at the setting's strength, not at all at 0. Enemy deaths,
// damage numbers and the screen shake are no attack's and stay as they are.

import { describe, expect, it } from 'vitest';
import { autopilot, makeGame } from './helpers';
import { Game } from '../src/sim/game';
import type { FxEvent } from '../src/sim/fx';
import { FxSystem, type SpriteSink } from '../src/render/fx';
import type { Assets } from '../src/render/assets';
import type { Frame } from '../src/render/atlas';
import type { ShapeBatch } from '../src/render/shapes';
import { SnapshotEncoder, decodeSnapshot } from '../src/net/snapshot';
import { StringDict } from '../src/net/codec';
import { Replica } from '../src/net/replica';

describe("the attacks' opacity reaches 0 (D-83)", () => {
  it("tags a player's attacks in the sim, and nothing else", () => {
    const g = makeGame({ godMode: true, seed: 31 });
    for (const id of ['mallet', 'bell', 'cannon', 'fireworks']) g.weapons.add(id);
    g.time = 150;
    const seen: FxEvent[] = [];
    for (let i = 0; i < 40 * 60; i++) {
      if (g.phase === 'draft') g.chooseDraft(0);
      autopilot(g);
      g.tick();
      seen.push(...g.fx.drain());
    }
    const own = new Set(seen.filter((e) => e.own).map((e) => e.type));
    for (const t of ['slash', 'ring', 'explosion'] as const) expect(own.has(t), t).toBe(true);
    expect(seen.filter((e) => e.type === 'slash').every((e) => e.own)).toBe(true);
    for (const t of ['death', 'dmgnum', 'shake'] as const) {
      expect(seen.some((e) => e.type === t), t).toBe(true);
      expect(seen.some((e) => e.type === t && e.own), t).toBe(false);
    }
  });

  it('reaches a co-op guest with the tag', () => {
    const host = makeGame({ godMode: true, players: [{ character: 'carny', name: 'Host' }, { character: 'strongman', name: 'Guest' }] });
    const mirror = new Game({ ...host.cfg, godMode: false });
    const rep = new Replica(mirror, 1);
    const p = host.players[1];
    const fx: FxEvent[] = [
      { type: 'slash', x: p.x, y: p.y, a: 1, b: 0.5, c: 90, style: 'mallet', own: true },
      { type: 'death', x: p.x, y: p.y, a: 1, b: 0, c: 0, style: 'pop' },
    ];
    const buf = new SnapshotEncoder().encode(host, { seq: 1, ackInput: 0, ackSnap: 0, dict: new StringDict(), dictFrom: 0, view: { x: p.x, y: p.y, hx: 1000, hy: 700 }, fx, sfx: [] });
    const s = decodeSnapshot(buf, rep.dict);
    expect(s.fx.map((e) => [e.type, !!e.own])).toEqual([['slash', true], ['death', false]]);
    rep.apply(s, 0);
    expect(mirror.fx.events.map((e) => [e.type, !!e.own])).toEqual([['slash', true], ['death', false]]);
  });

  it("draws a player's attacks at the setting's strength and not at all at 0; the rest is untouched", () => {
    const frame = {} as Frame;
    const assets = { atlas: { frames: new Map(['fx_glow_0', 'fx_spark_0', 'fx_star_0', 'fx_smoke_0'].map((k) => [k, frame])), get: () => frame } } as unknown as Assets;
    const fx = new FxSystem(assets);
    // a player's at x 0, anyone's at x 2000
    fx.handle([
      { type: 'ring', x: 0, y: 0, a: 120, b: 1, c: 0, style: 'jackpot', own: true },
      { type: 'spark', x: 0, y: 0, a: 3, b: 0, c: 0, style: 'mirror', own: true },
      { type: 'text', x: 0, y: 0, a: 0, b: 0, c: 0, style: 'gold', text: 'DING!', own: true },
      { type: 'ring', x: 2000, y: 0, a: 120, b: 0, c: 0, style: 'revive' },
      { type: 'pickup', x: 2000, y: 0, a: 2, b: 0, c: 0, style: '' },
      { type: 'dmgnum', x: 2000, y: 0, a: 12, b: 0, c: 0, style: '' },
    ]);
    const draw = (op: number) => {
      fx.abilityOpacity = op;
      const out = { mine: 0, mineA: 0, rest: 0, restA: 0, light: 0, restLight: 0 };
      const note = (x: number, a: number) => {
        if (x < 1000) {
          out.mine++;
          out.mineA += a;
        } else {
          out.rest++;
          out.restA += a;
        }
      };
      const sink: SpriteSink = { draw: (_f, x, _y, _z, _sx, _sy, _r, _cr, _cg, _cb, a = 1) => (note(x, a), true) };
      const shapes = { ring: (x: number, _y: number, _r0: number, _r1: number, _cr: number, _cg: number, _cb: number, a: number) => note(x, a), circle: (x: number, _y: number, _r: number, _cr: number, _cg: number, _cb: number, a: number) => note(x, a), line: (x: number, _y: number, _x2: number, _y2: number, _w: number, _cr: number, _cg: number, _cb: number, a: number) => note(x, a) } as unknown as ShapeBatch;
      fx.draw(sink, sink, shapes, sink);
      fx.addLights({ add: (x, _y, _r, i) => (x < 1000 ? (out.light += i) : (out.restLight += i)) });
      return out;
    };
    const full = draw(1), half = draw(0.5), none = draw(0);
    expect(full.mine).toBeGreaterThan(3);
    expect(full.light).toBeGreaterThan(0);
    expect(half.mineA).toBeCloseTo(full.mineA / 2, 5);
    expect(half.light).toBeCloseTo(full.light / 2, 5);
    expect([none.mine, none.light]).toEqual([0, 0]);
    // the revive's ring and light, the pickup's sparks and the damage number never change
    for (const o of [half, none]) expect([o.rest, o.restA, o.restLight]).toEqual([full.rest, full.restA, full.restLight]);
    expect(full.rest).toBeGreaterThan(3);
  });
});
