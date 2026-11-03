// The packed wall sets (D-96): the same push-out and the same wall checks as the old pass over every prop.
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { DYNAMIC_WALLS, type Prop } from '../src/data/map';
import { pushOut } from '../src/sim/movement';
import { REACH, WallSet, dynamicWalls } from '../src/sim/walls';
import { refreshTrainDoors, placeTrain } from '../src/sim/ghosttrain';
import { refreshFunhouseWalls } from '../src/sim/funhouse';
import { J } from '../src/data/ghosttrain';
import { makeGame } from './helpers';

/** a field of walls: circles and boxes of many sizes, overlapping in places, some not solid at all */
function field(seed: number, n: number): Prop[] {
  const rng = new Rng(seed);
  const out: Prop[] = [];
  for (let i = 0; i < n; i++) {
    const x = (rng.next() - 0.5) * 4000, y = (rng.next() - 0.5) * 3000;
    const k = rng.next();
    if (k < 0.4) out.push({ kind: 'tree', x, y, r: 6 + rng.next() * 90 } as unknown as Prop);
    else if (k < 0.95) out.push({ kind: 'booth', x, y, hw: 4 + rng.next() * 160, hh: 4 + rng.next() * 120 } as unknown as Prop);
    else out.push({ kind: 'lamp', x, y } as unknown as Prop);
  }
  return out;
}

describe('packed wall sets (D-96)', () => {
  it('push a body out exactly as the old pass over every wall in order did', () => {
    const walls = field(3, 400);
    const set = new WallSet(walls);
    const rng = new Rng(5);
    let compared = 0, touched = 0;
    for (let k = 0; k < 20000; k++) {
      const x = (rng.next() - 0.5) * 4200, y = (rng.next() - 0.5) * 3200, r = 8 + rng.next() * 31;
      const a = { x, y, r }, b = { x, y, r };
      for (const w of walls) pushOut(a, w);
      // (a body shoved further than the filing reach within one pass can meet walls filed elsewhere, as the crowd's
      // bucketed push-out always could; contact in play moves a body a few units a tick)
      if (Math.hypot(a.x - x, a.y - y) > REACH - r) continue;
      set.pushOut(b);
      expect([b.x, b.y]).toEqual([a.x, a.y]);
      compared++;
      if (a.x !== x || a.y !== y) touched++;
    }
    // (about a third of these random points fall deep inside the field's big boxes and are skipped)
    expect(compared).toBeGreaterThan(12000);
    expect(touched).toBeGreaterThan(3500);
  });

  it('answer the crowd\'s wall checks as the old ones did', () => {
    const walls = field(9, 400);
    const set = new WallSet(walls);
    const rng = new Rng(13);
    const solid = walls.filter((pr) => pr.r || (pr.hw && pr.hh));
    for (let k = 0; k < 20000; k++) {
      const x = (rng.next() - 0.5) * 4200, y = (rng.next() - 0.5) * 3200, r = rng.next() < 0.5 ? 0 : rng.next() * 39;
      const old = solid.some((pr) => (pr.r ? (x - pr.x) ** 2 + (y - pr.y) ** 2 < (pr.r + r) ** 2 : Math.abs(x - pr.x) < pr.hw! + r && Math.abs(y - pr.y) < pr.hh! + r));
      expect(set.hits(x, y, r)).toBe(old);
    }
  });

  it('are built once per arrangement of the walls that come and go', () => {
    const g = makeGame({ map: 'ghost_train', seed: 3 } as never);
    placeTrain(g, 'dwell', J, undefined, 5);
    refreshTrainDoors(g);
    const first = DYNAMIC_WALLS, set = dynamicWalls();
    refreshTrainDoors(g);
    expect(DYNAMIC_WALLS).toBe(first);
    expect(dynamicWalls()).toBe(set);
    // the train leaves: the Junction's doors shut, a new arrangement
    placeTrain(g, 'travel', J, undefined, 5);
    refreshTrainDoors(g);
    expect(DYNAMIC_WALLS).not.toBe(first);
    expect(DYNAMIC_WALLS.length).toBeGreaterThan(first.length);
    // and the Fun House's panels: the same array until a pivot turns
    const f = makeGame({ map: 'fun_house', seed: 3 } as never);
    refreshFunhouseWalls(f);
    const a = DYNAMIC_WALLS;
    f.time += 0.5;
    refreshFunhouseWalls(f);
    expect(DYNAMIC_WALLS).toBe(a);
  });
});
