// The crowd's distance models (D-96): what the simplifier keeps and what it may change.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { simplifyGeometry } from '../src/render3d/core/simplify';
import { LOD_OPTIONS } from '../src/render3d/models/lodOptions';
import { ENEMY_MODELS } from '../src/render3d/models';

/** a sphere carrying the attributes a sculpt carries, one colour, one bone, one pattern */
function part(r: number, segs: number, at: [number, number, number], bone: number, rgb: [number, number, number]): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, segs, Math.round(segs * 0.75));
  g.translate(...at);
  g.deleteAttribute('uv');
  const n = g.getAttribute('position').count;
  const fill = (k: number, f: (i: number) => number[]) => {
    const a = new Float32Array(n * k);
    for (let i = 0; i < n; i++) a.set(f(i), i * k);
    return new THREE.BufferAttribute(a, k);
  };
  g.setAttribute('color', fill(3, () => rgb));
  g.setAttribute('aSkin', fill(4, () => [bone, bone, 1, 0]));
  g.setAttribute('aSurf', fill(3, () => [0.6, 0, 0]));
  g.setAttribute('aPat', fill(4, () => [0, 0, 0, 0]));
  g.setAttribute('aInkOff', fill(1, () => [0]));
  return g;
}

/** every vertex of `b` is one of `a`'s (same position and attributes): nothing was moved or blended */
function verticesFrom(a: THREE.BufferGeometry, b: THREE.BufferGeometry): boolean {
  const key = (g: THREE.BufferGeometry, i: number) => Object.keys(g.attributes).sort().map((k) => {
    const at = g.getAttribute(k) as THREE.BufferAttribute;
    return Array.from({ length: at.itemSize }, (_, c) => (at.array as ArrayLike<number>)[i * at.itemSize + c]).join(',');
  }).join('|');
  const have = new Set(Array.from({ length: a.getAttribute('position').count }, (_, i) => key(a, i)));
  for (let i = 0; i < b.getAttribute('position').count; i++) if (!have.has(key(b, i))) return false;
  return true;
}

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('distance models (D-96)', () => {
  it('fold a smooth body to about the asked share, keeping every attribute and only original vertices', () => {
    const body = part(40, 64, [0, 40, 0], 0, [0.8, 0.2, 0.2]);
    const s = simplifyGeometry(body, { ratio: 0.3, maxError: 1.2 })!;
    expect(s).not.toBeNull();
    expect(tris(s)).toBeLessThan(tris(body) * 0.45);
    expect(Object.keys(s.attributes).sort()).toEqual(Object.keys(body.attributes).sort());
    expect(verticesFrom(body, s)).toBe(true);
    // still the same body: its bounds within the allowed error
    body.computeBoundingBox();
    s.computeBoundingBox();
    expect(s.boundingBox!.max.y).toBeGreaterThan(body.boundingBox!.max.y - 1.5);
    expect(s.boundingBox!.min.y).toBeLessThan(body.boundingBox!.min.y + 1.5);
  });

  it('leave small separate parts (eyes, buttons) whole', () => {
    const head = part(30, 48, [0, 60, 0], 1, [0.9, 0.8, 0.7]);
    const eye = part(2, 16, [8, 66, 28], 1, [0.05, 0.05, 0.05]);
    const merged = mergeGeometries([head, eye])!;
    const s = simplifyGeometry(merged, LOD_OPTIONS)!;
    const eyeTris = tris(eye);
    // the eye's triangles all survive: count the triangles whose corners are all dark
    const col = s.getAttribute('color'), idx = s.index!;
    let dark = 0;
    for (let f = 0; f < idx.count / 3; f++) if ([0, 1, 2].every((k) => col.getX(idx.getX(f * 3 + k)) < 0.1)) dark++;
    expect(dark).toBe(eyeTris);
  });

  it('give the same copy every time, and hand back nothing for a model already plain', () => {
    const body = part(40, 48, [0, 40, 0], 0, [0.3, 0.6, 0.3]);
    const x = simplifyGeometry(body, LOD_OPTIONS)!, y = simplifyGeometry(body, LOD_OPTIONS)!;
    expect(Array.from(x.index!.array as ArrayLike<number>)).toEqual(Array.from(y.index!.array as ArrayLike<number>));
    const plain = part(10, 6, [0, 10, 0], 0, [1, 1, 1]);
    expect(simplifyGeometry(plain, LOD_OPTIONS)).toBeNull();
  });

  it('roughly halve the real crowd models', () => {
    let before = 0, after = 0;
    for (const id of ['evil_clown', 'drowned', 'gt_porter', 'marionette']) {
      const g = ENEMY_MODELS[id].build();
      const s = simplifyGeometry(g, LOD_OPTIONS);
      before += tris(g);
      after += s ? tris(s) : tris(g);
      if (s) expect(verticesFrom(g, s)).toBe(true);
    }
    expect(after).toBeLessThan(before * 0.6);
  });
});
