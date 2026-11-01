// The crowd and the walls (D-74): creatures that walk the ground go around buildings and through the
// Fun House maze instead of through them; newcomers spawned inside a wall walk out before it holds them;
// balloons, phantoms and the coaster's riders still pass over and through.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { PROPS, type Prop } from '../src/data/map';
import type { Game } from '../src/sim/game';
import type { Enemy } from '../src/sim/entities';

/** A night with no spawner and no weapons: just the creatures a test places. */
function quiet(o: Parameters<typeof makeGame>[0] = {}): Game {
  const g = makeGame({ godMode: true, seed: 1, ...o });
  g.director.update = () => {};
  g.weapons.list.length = 0;
  return g;
}
/** Does the creature's body overlap a box wall (by more than `slack` px)? */
const inBox = (e: Enemy, pr: Prop, slack = 1) => {
  const dx = Math.max(Math.abs(e.x - pr.x) - pr.hw!, 0), dy = Math.max(Math.abs(e.y - pr.y) - pr.hh!, 0);
  return dx * dx + dy * dy < (e.r - slack) ** 2;
};

describe('the crowd and the walls (D-74)', () => {
  const booth = PROPS.find((p) => p.kind === 'ticket_booth')!;

  it('walks around a building to reach a player standing behind it', () => {
    const g = quiet();
    const p = g.player;
    p.x = p.px = booth.x;
    p.y = p.py = booth.y - booth.hh! - 110;
    const e = g.spawnEnemy('possessed_stuffie', booth.x, booth.y + booth.hh! + 90, { exact: true })!;
    e.hp = e.maxHp = 1e9;
    let inside = false, reached = -1;
    for (let i = 0; i < 60 * 20 && reached < 0; i++) {
      g.tick();
      if (inBox(e, booth)) inside = true;
      if (Math.hypot(e.x - p.x, e.y - p.y) < 50) reached = g.time;
    }
    expect(e.walled).toBe(true);
    expect(inside).toBe(false);
    expect(reached).toBeGreaterThan(0);
  });

  it('lets a newcomer that spawned inside a building walk out, then holds it to the walls', () => {
    const g = quiet();
    const p = g.player;
    p.x = p.px = booth.x;
    p.y = p.py = booth.y + booth.hh! + 200;
    const e = g.spawnEnemy('possessed_stuffie', booth.x, booth.y, { exact: true })!;
    e.hp = e.maxHp = 1e9;
    expect(e.walled).toBe(false);
    for (let i = 0; i < 60 * 6 && !e.walled; i++) g.tick();
    expect(e.walled).toBe(true);
    expect(inBox(e, booth, -1)).toBe(false);
  });

  it('lets balloons float straight through', () => {
    const g = quiet();
    const p = g.player;
    p.x = p.px = booth.x;
    p.y = p.py = booth.y - booth.hh! - 110;
    const e = g.spawnEnemy('living_balloon', booth.x, booth.y + booth.hh! + 90, { exact: true })!;
    e.hp = e.maxHp = 1e9;
    let inside = false;
    for (let i = 0; i < 60 * 6 && !inside; i++) {
      g.tick();
      if (inBox(e, booth, 4)) inside = true;
    }
    expect(inside).toBe(true);
  });

  it('finds its way through the Fun House maze to a player inside it', () => {
    const g = quiet({ map: 'fun_house' });
    const p = g.player;
    // a player in a maze cell; a creature a few cells away, walls between them
    const walls = PROPS.filter((q) => q.kind === 'fh_wall' || q.kind === 'fh_mirror');
    const open = (x: number, y: number) => !walls.some((w) => Math.abs(x - w.x) < w.hw! + 30 && Math.abs(y - w.y) < w.hh! + 30);
    let px = 0, py = 0, ex = 0, ey = 0;
    // the maze spans x -2140..-760, y -1350..900 (data/funhouse.ts MAZE)
    outer: for (let y = -1200; y < 800; y += 75) for (let x = -2000; x < -900; x += 75) {
      if (!open(x, y)) continue;
      for (let y2 = y + 450; y2 < 900; y2 += 75) for (let x2 = -2000; x2 < -900; x2 += 75) {
        if (open(x2, y2) && walls.some((w) => segHitsBox(x, y, x2, y2, w))) {
          [px, py, ex, ey] = [x, y, x2, y2];
          break outer;
        }
      }
    }
    expect(px || py).toBeTruthy();
    p.x = p.px = px;
    p.y = p.py = py;
    const e = g.spawnEnemy('possessed_stuffie', ex, ey, { exact: true })!;
    e.hp = e.maxHp = 1e9;
    e.speed = 160;
    let crossed = false, reached = false;
    for (let i = 0; i < 60 * 40 && !reached; i++) {
      g.inputs[0].moveX = g.inputs[0].moveY = 0;
      g.tick();
      if (e.walled && walls.some((w) => inBox(e, w))) crossed = true;
      reached = Math.hypot(e.x - p.x, e.y - p.y) < 60;
    }
    expect(crossed).toBe(false);
    expect(reached).toBe(true);
  });
});

function segHitsBox(x0: number, y0: number, x1: number, y1: number, b: Prop): boolean {
  for (let k = 0; k <= 40; k++) {
    const x = x0 + ((x1 - x0) * k) / 40, y = y0 + ((y1 - y0) * k) / 40;
    if (Math.abs(x - b.x) < b.hw! && Math.abs(y - b.y) < b.hh!) return true;
  }
  return false;
}
