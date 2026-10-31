// The Fun House (D-63): a second map on the same clock and boss schedule as the first, with its own
// floor plan, roster, machinery and maze; the map registry swaps everything that differs.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { MAPS, activeMapId, useMap } from '../src/data/maps';
import { CARNIVAL_LAYOUT, PLAYER_BOUNDS, PROPS, DYNAMIC_WALLS } from '../src/data/map';
import { WAVES, DAWN_TIME, CARNIVAL_WAVES, FUNHOUSE_WAVES } from '../src/data/waves';
import { BOSSES, CARNIVAL_BOSSES, FUNHOUSE_BOSSES } from '../src/data/bosses';
import { ENEMIES } from '../src/data/enemies';
import { MAZE, MAZE_H, MAZE_V, PIVOTS, pivotState, PISTONS, CONVEYORS, floorZone, UNREFLECTED } from '../src/data/funhouse';
import { collideBody } from '../src/sim/movement';
import type { Prop } from '../src/data/map';

const fh = (o: Parameters<typeof makeGame>[0] = {}) => makeGame({ map: 'fun_house', godMode: true, seed: 21, ...o });

describe('the map registry (D-63)', () => {
  it('defaults to the Carnival Core and swaps every map-specific table, then back', () => {
    useMap('carnival_core');
    expect(PROPS).toBe(CARNIVAL_LAYOUT.props);
    expect(WAVES).toBe(CARNIVAL_WAVES);
    expect(BOSSES).toBe(CARNIVAL_BOSSES);
    useMap('fun_house');
    expect(activeMapId()).toBe('fun_house');
    expect(PROPS).toBe(MAPS.fun_house.layout.props);
    expect(WAVES).toBe(FUNHOUSE_WAVES);
    expect(BOSSES).toBe(FUNHOUSE_BOSSES);
    expect(PLAYER_BOUNDS.maxY).toBe(2140);
    useMap('carnival_core');
    expect(PROPS).toBe(CARNIVAL_LAYOUT.props);
    expect(PLAYER_BOUNDS.maxY).toBe(CARNIVAL_LAYOUT.bounds.maxY);
    expect(DYNAMIC_WALLS.length).toBe(0);
  });

  it('a game asserts its own map every tick, so games on different maps can interleave', () => {
    const a = makeGame({ seed: 3, godMode: true });
    const b = fh();
    for (let i = 0; i < 120; i++) {
      a.tick();
      expect(activeMapId()).toBe('carnival_core');
      b.tick();
      expect(activeMapId()).toBe('fun_house');
    }
    expect(a.mapId).toBe('carnival_core');
    expect(b.mapId).toBe('fun_house');
    useMap('carnival_core');
  });
});

describe('the Fun House matches the first map\'s night (D-63)', () => {
  it('has the same run length and the same number of scheduled bosses, at the same gates', () => {
    expect(MAPS.fun_house.bosses.length).toBe(MAPS.carnival_core.bosses.length);
    expect(MAPS.fun_house.bosses.map((b) => b.gate)).toEqual(MAPS.carnival_core.bosses.map((b) => b.gate));
    expect(MAPS.fun_house.finalBoss).toBe('proprietor');
    expect(MAPS.fun_house.bosses.at(-1)!.id).toBe('proprietor');
    expect(DAWN_TIME).toBe(1500);
    // the timeline covers the night like the first map's: a wave in every window, the last at 24:00
    expect(FUNHOUSE_WAVES.map((w) => w.start)).toEqual(CARNIVAL_WAVES.map((w) => w.start));
  });

  it('more than 60% of its enemy types are new to it', () => {
    const roster = new Set<string>();
    for (const w of [...FUNHOUSE_WAVES, MAPS.fun_house.endless]) for (const [id] of w.enemies) roster.add(id);
    roster.add('swarm_balloon');
    for (const id of roster) expect(ENEMIES[id], id).toBeTruthy();
    // a Splitter's halves and quarters are the same enemy; the Grand Display is the mannequin's miniboss
    const types = [...roster].filter((id) => !id.startsWith('splitter_'));
    const shared = types.filter((id) => CARNIVAL_WAVES.some((w) => w.enemies.some(([e]) => e === id)) || id === 'swarm_balloon');
    const fresh = types.filter((id) => !shared.includes(id));
    expect(fresh.length / types.length).toBeGreaterThanOrEqual(0.6);
    expect(fresh.sort()).toEqual(['crooked_clown', 'doppelganger', 'glasswalker', 'grinning_mannequin', 'marionette', 'reflection_thief', 'splitter']);
  });
});

/** The maze as cells and open edges: static glass, the pivots' current positions and the closed door. */
function mazeGraph(pivots: number[]): { open: (c: number, r: number, dc: number, dr: number) => boolean } {
  const blocked = new Set<string>();
  const key = (p: Prop) => {
    if (!p.yaw) return `h:${Math.round((p.y - MAZE.y0) / MAZE.ch) - 1}:${Math.floor((p.x - MAZE.x0) / MAZE.cw)}`;
    return `v:${Math.floor((p.y - MAZE.y0) / MAZE.ch)}:${Math.round((p.x - MAZE.x0) / MAZE.cw) - 1}`;
  };
  for (let r = 0; r < MAZE_H.length; r++) for (let c = 0; c < 6; c++) if (MAZE_H[r][c]) blocked.add(`h:${r}:${c}`);
  for (let r = 0; r < MAZE_V.length; r++) for (let c = 0; c < 5; c++) if (MAZE_V[r][c]) blocked.add(`v:${r}:${c}`);
  PIVOTS.forEach((p, i) => blocked.add(key(pivots[i] ? p.b : p.a)));
  return {
    open: (c, r, dc, dr) => {
      if (dr === 1) return !blocked.has(`h:${r}:${c}`);
      if (dr === -1) return !blocked.has(`h:${r - 1}:${c}`);
      if (dc === 1) return !blocked.has(`v:${r}:${c}`);
      return !blocked.has(`v:${r}:${c - 1}`);
    },
  };
}

describe('the Hall of Mirrors (D-63)', () => {
  it('stays one connected maze in every combination of pivot positions; only the dressing room is sealed', () => {
    for (let mask = 0; mask < 1 << PIVOTS.length; mask++) {
      const states = PIVOTS.map((_, i) => (mask >> i) & 1);
      const g = mazeGraph(states);
      const seen = new Set<string>(['1,9']);
      const q: [number, number][] = [[1, 9]];
      while (q.length) {
        const [c, r] = q.shift()!;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nc >= 6 || nr < 0 || nr >= 10 || seen.has(`${nc},${nr}`) || !g.open(c, r, dc, dr)) continue;
          seen.add(`${nc},${nr}`);
          q.push([nc, nr]);
        }
      }
      const sealed = ['1,3', '2,3'];
      for (let c = 0; c < 6; c++) for (let r = 0; r < 10; r++) {
        const k = `${c},${r}`;
        expect(seen.has(k), `cell ${k} with pivots ${states}`).toBe(!sealed.includes(k));
      }
    }
  });

  it('the pivots turn on a schedule anyone can compute from the clock, and collide when they block', () => {
    const g = fh();
    const flips = PIVOTS.map((_, i) => {
      let n = 0;
      for (let t = 0; t < 60; t += 0.25) if (pivotState(i, t) !== pivotState(i, t + 0.25)) n++;
      return n;
    });
    for (const n of flips) expect(n).toBeGreaterThanOrEqual(4);
    g.tick();
    expect(DYNAMIC_WALLS.length).toBe(PIVOTS.length + 2); // three pivots and the two door panels
    const wall = DYNAMIC_WALLS[0];
    const probe = g.player;
    probe.x = wall.x;
    probe.y = wall.y;
    collideBody(probe, []);
    expect(Math.hypot(probe.x - wall.x, probe.y - wall.y)).toBeGreaterThan(5); // pushed clear of the panel
    useMap('carnival_core');
  });
});

describe('a Fun House night (D-63)', () => {
  it('opens in the Grand Entrance and runs five minutes of its own crowd without errors', () => {
    const g = fh();
    expect(floorZone(g.player.x, g.player.y)).toBe('entrance');
    expect(g.bosses.length).toBe(0); // no scenery bosses in the house
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 300; i++) {
      if (g.phase === 'draft') g.chooseDraft(0);
      g.inputs[0].moveX = Math.sin(i / 200);
      g.inputs[0].moveY = Math.cos(i / 260) * 0.6;
      g.tick();
      for (const e of g.active) seen.add(e.def.id);
      if (i % 600 === 0) for (const e of g.active) expect(Number.isFinite(e.x) && Number.isFinite(e.y), e.def.id).toBe(true);
    }
    expect(g.phase).toBe('play');
    for (const id of ['grinning_mannequin', 'marionette', 'evil_clown']) expect(seen.has(id), id).toBe(true);
    useMap('carnival_core');
  });

  it('the corridor\'s conveyors push and its pistons strike on schedule', () => {
    const g = fh();
    const c = CONVEYORS[0];
    const p = g.player;
    p.x = p.px = c.x;
    p.y = p.py = c.y;
    g.inputs[0].moveX = g.inputs[0].moveY = 0;
    for (let i = 0; i < 10; i++) g.tick();
    expect(p.x - c.x).toBeGreaterThan(10); // carried along the belt
    const ps = PISTONS[0];
    p.x = p.px = ps.x;
    p.y = p.py = ps.y;
    p.iframes = 0;
    const hp = p.hp;
    g.cfg.godMode = false;
    for (let i = 0; i < 60 * ps.period + 5; i++) {
      p.x = ps.x;
      p.y = ps.y;
      g.tick();
    }
    expect(p.hp).toBeLessThan(hp);
    useMap('carnival_core');
  });

  it('the quest\'s fixtures sit inside the rooms they belong to', () => {
    expect(floorZone(UNREFLECTED.counter.x, UNREFLECTED.counter.y)).toBe('entrance');
    for (const f of UNREFLECTED.faces) expect(floorZone(f.x, f.y), f.who).toBe('maze');
    for (const p of UNREFLECTED.plinths) expect(floorZone(p.x, p.y), p.who).toBe('gallery');
    expect(floorZone(UNREFLECTED.mark.x, UNREFLECTED.mark.y)).toBe('chamber');
    expect(floorZone(UNREFLECTED.vanity.x, UNREFLECTED.vanity.y)).toBe('dressing');
    expect(floorZone(UNREFLECTED.crystal.x, UNREFLECTED.crystal.y)).toBe('maze');
  });
});
