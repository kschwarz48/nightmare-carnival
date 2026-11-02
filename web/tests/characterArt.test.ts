// The character art standard (D-86, docs/CHARACTER_ART_QUALITY_STANDARD.md): the sculpt pipeline's new
// guarantees (vertices on the true surface, occlusion as data, crisp seams, patterns, per-part ink) and
// the three benchmark models' budgets and animation interface, so later work can't quietly regress them.

import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { Sculpt, layered } from '../src/render3d/sculpt/sdf';
import { sphere } from '../src/render3d/core/geo';
import { characterModel } from '../src/render3d/models/characters';
import { creatureModel } from '../src/render3d/models/creatures';

const tris = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

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
  const HUMAN = ['hips', 'spine', 'chest', 'neck', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];

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
