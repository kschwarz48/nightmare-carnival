// The Puppet King's stage (D-61): a visible ring of lights that reels back anyone who strays. It comes
// down around the party, pulls every standing player (not just the one he is chasing), glides them
// back rather than jumping them across the map, holds anyone trying to walk off, and lets go when he
// falls. His string sweeps move as one rank. Chest prizes carry what the prize card prints.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { BOSS_MAP } from '../src/data/bosses';
import { createBoss } from '../src/sim/bosses';
import type { PuppetBoss } from '../src/sim/bosses/puppet';
import { RING_PULL_MAX, collideBody } from '../src/sim/movement';
import { TICK } from '../src/sim/constants';
import type { Game } from '../src/sim/game';

function withKing(spots: { x: number; y: number }[], seed = 5): { g: Game; b: PuppetBoss } {
  const g = makeGame({ godMode: true, seed, players: spots.length > 1 ? spots.map((_, i) => ({ character: 'carny', name: `P${i}` })) : undefined });
  g.addXp(-1e9); // no level-ups mid-test
  for (const b of g.bosses) {
    b.dead = true;
    b.removed = true;
  }
  g.bosses = [];
  spots.forEach((s, i) => {
    const p = g.players[i];
    p.x = p.px = s.x;
    p.y = p.py = s.y;
  });
  g.setCtx(g.players[0]);
  const b = createBoss(g, BOSS_MAP.puppet_king, { immediate: true }) as PuppetBoss;
  g.bosses.push(b);
  g.tick(); // he wakes, and the stage's lights go up as he is lowered
  return { g, b };
}

/** Open ground all the way from (ax, ay) to (bx, by): a probe body is never pushed by a prop. */
function clearLine(g: Game, ax: number, ay: number, bx: number, by: number): boolean {
  const probe = g.players[0];
  const sx = probe.x, sy = probe.y;
  let ok = true;
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 12);
  for (let i = 0; i <= n && ok; i++) {
    probe.x = ax + ((bx - ax) * i) / n;
    probe.y = ay + ((by - ay) * i) / n;
    const x = probe.x, y = probe.y;
    collideBody(probe, []);
    if (Math.hypot(probe.x - x, probe.y - y) > 0.01) ok = false;
  }
  probe.x = sx;
  probe.y = sy;
  return ok;
}

/** A spot `out` units beyond the ring's edge with open ground back to well inside it. */
function strayFrom(g: Game, b: PuppetBoss, out: number): { x: number; y: number; a: number } {
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    const x = b.ringX + Math.cos(a) * (b.ringR + out), y = b.ringY + Math.sin(a) * (b.ringR + out);
    if (clearLine(g, x, y, b.ringX + Math.cos(a) * (b.ringR - 120), b.ringY + Math.sin(a) * (b.ringR - 120))) return { x, y, a };
  }
  throw new Error('no open ground around the stage');
}

const outside = (b: PuppetBoss, p: { x: number; y: number }) => Math.hypot(p.x - b.ringX, p.y - b.ringY) - b.ringR;

describe("the Puppet King's stage (D-61)", () => {
  it('comes down around the party and reels a straggler back in, gliding rather than jumping', () => {
    // two players together on the plaza and one far away: the stage centres on the pair
    const { g, b } = withKing([{ x: -40, y: 330 }, { x: 40, y: 350 }, { x: 1600, y: -1600 }]);
    expect(b.ringR).toBe(820);
    expect(b.ringX).toBeCloseTo(0, 0);
    expect(b.ringY).toBeCloseTo(340 - 120, 0);
    const far = g.players[2];
    const s = strayFrom(g, b, 650);
    far.x = far.px = s.x;
    far.y = far.py = s.y;
    const pair = [g.players[0], g.players[1]].map((p) => ({ x: p.x, y: p.y }));
    let maxStep = 0;
    for (let i = 0; i < 60 * 5; i++) {
      const x = far.x, y = far.y;
      g.tick();
      maxStep = Math.max(maxStep, Math.hypot(far.x - x, far.y - y));
    }
    expect(outside(b, far)).toBeLessThanOrEqual(0); // back on the stage, not hovering at its rim
    expect(outside(b, far)).toBeGreaterThan(-12); // set down just inside the lights
    expect(maxStep).toBeLessThanOrEqual(RING_PULL_MAX * TICK + 0.01); // never faster than the cap: no teleport
    expect(maxStep).toBeGreaterThan(RING_PULL_MAX * TICK * 0.9); // and it does reach the cap from that far out
    // the pair, inside all along, were never pulled
    g.players.slice(0, 2).forEach((p, i) => expect(Math.hypot(p.x - pair[i].x, p.y - pair[i].y)).toBeLessThan(1));
  });

  it('pulls every standing player, not just the one he is chasing, and nobody can walk off', () => {
    const { g, b } = withKing([{ x: 0, y: 330 }, { x: 60, y: 340 }]);
    const s = strayFrom(g, b, -150); // 150 units inside the edge, open ground beyond
    for (const p of g.players) {
      p.x = p.px = s.x + (p.index ? 10 : -10);
      p.y = p.py = s.y;
    }
    // both walk straight off the stage for six seconds
    let worst = 0;
    for (let i = 0; i < 60 * 6; i++) {
      for (const p of g.players) {
        g.inputs[p.index].moveX = Math.cos(s.a);
        g.inputs[p.index].moveY = Math.sin(s.a);
      }
      g.tick();
      if (i > 60 * 3) for (const p of g.players) worst = Math.max(worst, outside(b, p));
    }
    // held just past the lights (where the pull matches a walk: speed / 6), never wandering off
    expect(worst).toBeGreaterThan(10);
    expect(worst).toBeLessThan(60);
  });

  it('lets everyone go when he falls', () => {
    const { g, b } = withKing([{ x: 0, y: 330 }]);
    g.weapons.list.length = 0;
    let guard = 0;
    while (!b.dead && guard++ < 9000) {
      for (const part of b.parts.filter((q) => q.alive && !q.invuln)) g.damageTarget(part, b.maxHp * 0.01, false, 0, 0, 0, 'test');
      g.tick();
    }
    expect(b.dead).toBe(true);
    expect(b.ringR).toBe(0);
    const p = g.player;
    p.x = p.px = b.ringX + 1500;
    p.y = p.py = b.ringY;
    const x = p.x;
    for (let i = 0; i < 60; i++) g.tick();
    expect(Math.abs(p.x - x)).toBeLessThan(1);
  });

  it('sweeps his three strings as one rank: all up, all down, all left or all right', () => {
    let sweeps = 0;
    for (const seed of [5, 6, 7, 8]) {
      const { g } = withKing([{ x: 0, y: 330 }], seed);
      g.weapons.list.length = 0;
      let was = false;
      for (let i = 0; i < 60 * 60 && sweeps < 4; i++) {
        g.tick();
        const moving = g.hazards.filter((h) => h.alive && h.style === 'string_sweep' && (h.vx !== 0 || h.vy !== 0));
        const now = moving.length > 0;
        if (now && !was) sweeps++; // a new sweep has started moving
        was = now;
        if (!now) continue;
        expect(moving.length).toBe(3);
        for (const h of moving) {
          expect(h.vx).toBe(moving[0].vx);
          expect(h.vy).toBe(moving[0].vy);
        }
        expect(Math.abs(moving[0].vx) + Math.abs(moving[0].vy)).toBe(210);
      }
      if (sweeps >= 4) break;
    }
    expect(sweeps).toBeGreaterThan(0);
  });
});

describe('prize cards (D-61)', () => {
  it('every chest prize carries its name and new level (or what it paid), and in co-op its winner', () => {
    const g = makeGame({ godMode: true, seed: 3, players: [{ character: 'carny', name: 'Kevin' }, { character: 'strongman', name: 'Bo' }] });
    const res = g.openChest(6);
    expect(res.entries.length).toBe(6);
    for (const e of res.entries) {
      expect(e.name, e.label).toBeTruthy();
      expect(e.player === 0 || e.player === 1).toBe(true);
      if (e.type === 'level' || e.type === 'passive' || e.type === 'new') {
        expect(e.level).toBeGreaterThan(0);
        expect(e.label).toContain(e.name!);
      } else expect(e.note).toBeTruthy();
    }
  });
});
