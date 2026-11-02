// The character art standard (D-86, docs/CHARACTER_ART_QUALITY_STANDARD.md): the sculpt pipeline's new
// guarantees (vertices on the true surface, occlusion as data, crisp seams, patterns, per-part ink), the
// three benchmark models' budgets and animation interface, the rest of the playable cast rebuilt on it
// (D-87), the enemy roster's pass (D-88), and the other maps' humanoids rebuilt in layers (D-89), so later work
// can't quietly regress them.

import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { SMALL_DETAIL, Sculpt, layered } from '../src/render3d/sculpt/sdf';
import { sphere } from '../src/render3d/core/geo';
import { characterModel } from '../src/render3d/models/characters';
import { CREATURE_IDS, creatureModel } from '../src/render3d/models/creatures';

const tris = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const HUMAN = ['hips', 'spine', 'chest', 'neck', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];

describe('the sculpt pipeline (D-86)', () => {
  it('puts every vertex on the true surface (surface nets left them up to a third of a cell off)', () => {
    const sc = new Sculpt(1.5);
    sc.add({ t: 'ell', c: [0, 0, 0], r: [12, 9, 7] });
    const g = sc.build();
    const p = g.attributes.position;
    let worst = 0;
    for (let i = 0; i < p.count; i++) worst = Math.max(worst, Math.abs(sc.field(p.getX(i), p.getY(i), p.getZ(i))));
    expect(worst).toBeLessThan(0.08);
  });

  it('keeps occlusion as data, paints flat colour, and joins two parts with a crisp seam when asked', () => {
    const sc = new Sculpt(0.8);
    sc.add({ t: 'sph', c: [-5, 0, 0], r: 6 }, { col: 0xff0000 });
    sc.add({ t: 'sph', c: [5, 0, 0], r: 6 }, { col: 0x0000ff, k: 2 });
    const g = sc.build({ ao: 0.3, paint: 0, seam: 0.15 });
    const col = g.attributes.color, occ = g.attributes.aOcc;
    let maxOcc = 0, mixed = 0;
    for (let i = 0; i < col.count; i++) {
      maxOcc = Math.max(maxOcc, occ.getX(i));
      // a vertex is pure red or pure blue unless it lies on the seam itself
      if (col.getX(i) > 0.05 && col.getZ(i) > 0.05) mixed++;
      expect(Math.max(col.getX(i), col.getZ(i))).toBeGreaterThan(0.45);
    }
    expect(maxOcc).toBeGreaterThan(0.05);
    expect(maxOcc).toBeLessThanOrEqual(0.3 + 1e-6);
    expect(mixed / col.count).toBeLessThan(0.04);
  });

  it('carries a part\'s pattern and ink choice to its vertices; small details can draw no ink', () => {
    const sc = new Sculpt(1);
    sc.add({ t: 'sph', c: [0, 0, 0], r: 6 }, { col: 0x55663a, pat: { kind: 'stripes', col: 0xd4c8a8, a: 14, b: 0.45 } });
    sc.add({ t: 'sph', c: [14, 0, 0], r: 4 }, { col: 0xdddddd, ink: false });
    sc.detail(sphere(1, 6, 4), { col: 0x111111, pos: [0, 0, 7], ink: false });
    const g = sc.build({ paint: 0 });
    const pat = g.attributes.aPat, ink = g.attributes.aInkOff, pos = g.attributes.position;
    let striped = 0, inkless = 0;
    for (let i = 0; i < pat.count; i++) {
      if (pat.getX(i) === 1) striped++;
      if (ink.getX(i) === 1) inkless++;
      if (pos.getX(i) > 9) expect(ink.getX(i)).toBe(1);
    }
    expect(striped).toBeGreaterThan(50);
    expect(inkless).toBeGreaterThan(20);
    // layers merge into one geometry with every attribute the actor shader reads
    const two = layered([{ sc }, { sc: new Sculpt(1).add({ t: 'sph', c: [0, 20, 0], r: 3 }) }]);
    for (const a of ['position', 'normal', 'color', 'aSkin', 'aSurf', 'aOcc', 'aPat', 'aCol2', 'aInkOff']) expect(two.getAttribute(a), a).toBeTruthy();
  });
});

describe('the benchmark models (D-86)', () => {
  it('the Carny: a hero\'s budget, the same skeleton and clips', () => {
    const m = characterModel('carny');
    expect(tris(m.geo)).toBeLessThan(70_000);
    const names = m.rig.bones.map((b) => b.name);
    for (const n of [...HUMAN, 'rag']) expect(names, n).toContain(n);
    for (const c of ['idle', 'move', 'cast', 'hurt', 'dash']) expect(m.rig.has(c), c).toBe(true);
    // the crown stays where it was (~89), so doorways, overhead bars and the camera framing still fit
    m.geo.computeBoundingBox();
    expect(m.geo.boundingBox!.max.y).toBeGreaterThan(84);
    expect(m.geo.boundingBox!.max.y).toBeLessThan(98);
  });

  it('the Evil Clown and the Carnival Brute: their budgets, skeletons and clips', () => {
    for (const [id, budget] of [['evil_clown', 15_000], ['carnival_brute', 38_000]] as const) {
      const m = creatureModel(id);
      expect(tris(m.geo), id).toBeLessThan(budget);
      const names = m.rig.bones.map((b) => b.name);
      for (const n of HUMAN) expect(names, `${id} ${n}`).toContain(n);
      for (const c of ['move', 'attack']) expect(m.rig.has(c), `${id} ${c}`).toBe(true);
    }
  });
});

describe('the playable cast (D-87)', () => {
  it('each on the standard: a hero\'s budget, its skeleton and extra bones, the clips, its height', () => {
    // [id, its own extra bones, the top of the hat or hair: about where it stood, so framing still fits]
    const cast: [string, string[], number, number][] = [
      ['strongman', [], 88, 98], ['fortune_teller', ['skirt', 'ball'], 82, 94], ['ride_operator', [], 85, 97],
      ['mira', ['skirt'], 66, 78], ['lost_child', ['plush'], 56, 70], ['ringleader', ['tails'], 95, 108],
    ];
    for (const [id, extra, lo, hi] of cast) {
      const m = characterModel(id);
      expect(tris(m.geo), id).toBeLessThan(70_000);
      const names = m.rig.bones.map((b) => b.name);
      for (const n of [...HUMAN, ...extra]) expect(names, `${id} ${n}`).toContain(n);
      for (const c of ['idle', 'move', 'cast', 'hurt', 'dash']) expect(m.rig.has(c), `${id} ${c}`).toBe(true);
      m.geo.computeBoundingBox();
      expect(m.geo.boundingBox!.max.y, id).toBeGreaterThan(lo);
      expect(m.geo.boundingBox!.max.y, id).toBeLessThan(hi);
      // built in layers: covered parts and small details carry their no-ink choice
      expect(m.geo.getAttribute('aInkOff'), id).toBeTruthy();
    }
  });
});

describe('the enemy roster (D-88)', () => {
  it('small details draw no ink unless asked; larger ones keep it', () => {
    const sc = new Sculpt(1).add({ t: 'sph', c: [0, 0, 0], r: 6 });
    sc.detail(sphere(1, 6, 4), { pos: [0, 0, 7] });
    sc.detail(sphere(SMALL_DETAIL + 1, 8, 6), { pos: [20, 0, 0] });
    sc.detail(sphere(1, 6, 4), { pos: [0, 9, 0], ink: true });
    const g = sc.build({ paint: 0 });
    const ink = g.attributes.aInkOff, pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (z > 6.5) expect(ink.getX(i), 'small').toBe(1);
      if (x > 15) expect(ink.getX(i), 'large').toBe(0);
      if (y > 8) expect(ink.getX(i), 'asked').toBe(0);
    }
  });

  it("the first map's three rebuilt regulars: a regular enemy's budget, their skeletons and clips", () => {
    for (const [id, extra] of [['wind_up_monkey', ['key']], ['dunk_tank_clown', []], ['puppet_soldier', []]] as const) {
      const m = creatureModel(id);
      expect(tris(m.geo), id).toBeLessThan(15_000);
      const names = m.rig.bones.map((b) => b.name);
      for (const n of [...HUMAN, ...extra]) expect(names, `${id} ${n}`).toContain(n);
      for (const c of ['move', 'attack']) expect(m.rig.has(c), `${id} ${c}`).toBe(true);
    }
  });

  it('every creature builds within a miniboss budget and keeps its clips', () => {
    for (const id of CREATURE_IDS.filter((id) => !id.startsWith('pet_'))) {
      const m = creatureModel(id);
      expect(tris(m.geo), id).toBeLessThan(38_000);
      for (const c of ['move', 'attack']) expect(m.rig.has(c), `${id} ${c}`).toBe(true);
    }
  });
});

describe("the other maps' humanoids (D-89)", () => {
  it("each within its role's budget, on its skeleton with its clips, at its old size, standing on the floor", () => {
    // [id, budget, its own extra bones, its own extra clips, the top of its head, hat or prop before the rebuild]
    const R = 15_000, M = 38_000;
    const rebuilt: [string, number, string[], string[], number][] = [
      ['grinning_mannequin', R, [], [], 88], ['doppelganger', R, [], [], 85.5], ['glasswalker', R, [], [], 98.6], ['marionette', R, [], [], 165],
      ['crooked_clown', R, [], [], 104], ['reflection_thief', R, [], [], 88.6],
      ['drowned', R, [], ['rise'], 87], ['ticket_taker', R, [], [], 91.7], ['barnacle_brute', R, [], [], 100.6], ['great_barnacle', M, [], [], 151],
      ['prize_collector', M, [], [], 110.9], ['tidecaller', R, ['staff'], [], 140.2],
      ['gt_ticketless', R, ['case'], [], 87], ['gt_porter', R, ['trunk'], [], 113.8], ['gt_navvy', M, ['hammer'], [], 144], ['gt_mourner', R, ['veil'], [], 98.5],
      ['gt_signalman', R, ['lantern'], [], 91.3], ['gt_commuter', R, ['key', 'brolly'], [], 89.6], ['gt_newsboy', R, ['paper'], [], 68.7],
      ['gt_gravebound', R, [], ['rise'], 86.4], ['gt_slag', M, [], [], 117.4], ['gt_riveter', R, ['gun'], [], 88.1], ['gt_stillfolk', R, [], [], 87.2],
      ['gt_watcher', R, [], [], 163.4], ['gt_puncher', R, ['punch'], [], 85.9], ['gt_inspector', M, ['punch'], [], 151.2],
    ];
    for (const [id, budget, extra, extraClips, top] of rebuilt) {
      const m = creatureModel(id);
      expect(tris(m.geo), id).toBeLessThan(budget);
      const names = m.rig.bones.map((b) => b.name);
      for (const n of [...HUMAN, ...extra]) expect(names, `${id} ${n}`).toContain(n);
      for (const c of ['move', 'attack', ...extraClips]) expect(m.rig.has(c), `${id} ${c}`).toBe(true);
      m.geo.computeBoundingBox();
      const bb = m.geo.boundingBox!;
      expect(bb.max.y, id).toBeGreaterThan(top * 0.9);
      expect(bb.max.y, id).toBeLessThan(top * 1.1);
      // robes and skirts are cut at the floor (they hung through it, down to -18)
      expect(bb.min.y, id).toBeGreaterThan(-2.5);
    }
  });
});
