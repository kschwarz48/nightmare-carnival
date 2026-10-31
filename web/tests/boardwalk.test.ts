// The Boardwalk (D-68): a third map on the same clock and boss schedule as the others, with a promenade,
// a beach and a pier on a sea that can't be walked into; a tide and a coaster crossing; sea creatures that
// come up out of the water; its own roster and their mechanics; pickups the tide carries in; its events;
// and a whole bot night to dawn.

import { describe, expect, it } from 'vitest';
import { makeGame, runFor } from './helpers';
import { MAPS, MAP_IDS, activeMapId, useMap } from '../src/data/maps';
import { CAMERA_BOUNDS, PLAYER_BOUNDS, PROPS, WALK_CLAMP } from '../src/data/map';
import { BOARDWALK_WAVES, CARNIVAL_WAVES, DAWN_TIME, WAVES, type WaveDef } from '../src/data/waves';
import { BOARDWALK_BOSSES, BOSSES } from '../src/data/bosses';
import { ENEMIES } from '../src/data/enemies';
import { BOARDWALK_EVENTS, EVENT_POOL } from '../src/data/events';
import { BENTS, BUILDINGS, CROSSING, PIER, RETREAT, SEA, SUMMERS_END, TIDE, WADE, insideBuilding, onDeck, shoreBase, shoreMix, shoreY, tideRise, trackAt, trainU, waterDepth, walkClamp, BW_BOUNDS } from '../src/data/boardwalk';
import { trainCars } from '../src/sim/boardwalk';
import { MARKED_HASTE } from '../src/sim/boardwalkAI';
import { SaveManager, type StorageLike } from '../src/meta/save';
import type { Game } from '../src/sim/game';

const bw = (o: Parameters<typeof makeGame>[0] = {}) => makeGame({ map: 'boardwalk', godMode: true, seed: 21, ...o });

function tickN(g: Game, n: number): void {
  for (let i = 0; i < n; i++) {
    if (g.phase === 'draft') g.chooseDraft(0);
    g.tick();
  }
}

describe('the map registry with three maps (D-68)', () => {
  it('lists the Boardwalk third and swaps every table to it and back', () => {
    expect(MAP_IDS).toEqual(['carnival_core', 'fun_house', 'boardwalk']);
    useMap('boardwalk');
    expect(activeMapId()).toBe('boardwalk');
    expect(PROPS).toBe(MAPS.boardwalk.layout.props);
    expect(WAVES).toBe(BOARDWALK_WAVES);
    expect(BOSSES).toBe(BOARDWALK_BOSSES);
    expect(EVENT_POOL).toBe(BOARDWALK_EVENTS);
    expect(CAMERA_BOUNDS).not.toBeNull();
    expect(WALK_CLAMP).not.toBeNull();
    useMap('fun_house');
    expect(CAMERA_BOUNDS).toBeNull();
    expect(WALK_CLAMP).toBeNull();
    useMap('carnival_core');
    expect(WALK_CLAMP).toBeNull();
  });

  it('has the same run length and the same scheduled bosses at the same gates; the Leviathan holds the dawn', () => {
    expect(MAPS.boardwalk.bosses.map((b) => b.gate)).toEqual(MAPS.carnival_core.bosses.map((b) => b.gate));
    expect(MAPS.boardwalk.finalBoss).toBe('leviathan');
    expect(MAPS.boardwalk.bosses.at(-1)!.id).toBe('leviathan');
    expect(DAWN_TIME).toBe(1500);
    expect(BOARDWALK_WAVES.map((w) => w.start)).toEqual(CARNIVAL_WAVES.map((w) => w.start));
  });

  it('ramps its crowd like the first map, a little sturdier, in Acts I and II', () => {
    const mean = (w: WaveDef) => w.enemies.reduce((s, [id, wt]) => s + ENEMIES[id].hp * wt, 0) / w.enemies.reduce((s, [, wt]) => s + wt, 0);
    for (let i = 0; i < 9; i++) {
      const r = mean(BOARDWALK_WAVES[i]) / mean(CARNIVAL_WAVES[i]);
      expect(r, BOARDWALK_WAVES[i].id).toBeGreaterThanOrEqual(1.0);
      expect(r, BOARDWALK_WAVES[i].id).toBeLessThanOrEqual(1.4);
    }
  });

  it('at least 60% of its enemy types are new to it', () => {
    const roster = new Set<string>();
    for (const w of [...BOARDWALK_WAVES, MAPS.boardwalk.endless]) for (const [id] of w.enemies) roster.add(id);
    roster.add('swarm_balloon');
    for (const id of roster) expect(ENEMIES[id], id).toBeTruthy();
    const types = [...roster];
    const shared = types.filter((id) => CARNIVAL_WAVES.some((w) => w.enemies.some(([e]) => e === id)) || id === 'swarm_balloon');
    const fresh = types.filter((id) => !shared.includes(id));
    expect(fresh.length / types.length).toBeGreaterThanOrEqual(0.6);
    expect(fresh.sort()).toEqual(['arcade_automaton', 'barnacle_brute', 'coaster_wraith', 'drowned', 'lantern_angler', 'prize_collector', 'shore_crawler', 'taffy_horror', 'ticket_taker', 'tidecaller']);
  });

  it('opens once the Fun House is survived, or for a tester; an old save without the field still loads', () => {
    const mem = (): StorageLike => {
      const m = new Map<string, string>();
      return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
    };
    const s = new SaveManager(mem());
    expect(s.mapAvailable('boardwalk')).toBe(false);
    s.data.achievements.push('beat_proprietor');
    expect(s.mapAvailable('boardwalk')).toBe(true);
    const t = new SaveManager(mem());
    t.data.boardwalkTester = true;
    expect(t.mapAvailable('boardwalk')).toBe(true);
    // a save written before the Boardwalk existed (no tester flag, no quest record) still loads and works
    const old = mem();
    new SaveManager(old).save();
    const b = new SaveManager(old);
    expect(b.mapAvailable('boardwalk')).toBe(false);
    expect(b.data.quests.summers_end).toBeUndefined();
  });
});

describe('the shore (D-68)', () => {
  it('the tide moves the waterline in and out; low water draws it far out', () => {
    expect(Math.abs(tideRise(0))).toBeLessThan(1e-9);
    const hi = shoreY(0, TIDE.period / 4), lo = shoreY(0, (TIDE.period * 3) / 4);
    expect(lo - hi).toBeCloseTo(TIDE.amp * 2, 3);
    expect(shoreY(0, 0, 1) - shoreY(0, 0, 0)).toBeCloseTo(RETREAT, 3);
  });

  it('a player can wade the shallows but never walk out into deep water; the pier carries them', () => {
    useMap('boardwalk');
    const x = 500;
    const p = { x, y: shoreY(x) + 600 };
    walkClamp(p);
    expect(waterDepth(p.x, p.y)).toBeLessThanOrEqual(WADE + 1);
    const deck = { x: (PIER.end.x0 + PIER.end.x1) / 2, y: (PIER.end.y0 + PIER.end.y1) / 2 };
    const before = { ...deck };
    walkClamp(deck);
    expect(deck).toEqual(before);
    expect(onDeck(deck.x, deck.y)).toBe(true);
    // stepping off the end of the pier puts you back on its boards
    const off = { x: deck.x, y: PIER.end.y1 + 140 };
    walkClamp(off);
    expect(onDeck(off.x, off.y, 2)).toBe(true);
    useMap('carnival_core');
  });

  it('the ambience follows the listener: the promenade, the beach, the pier', () => {
    const [p0] = shoreMix(0, -470);
    expect(p0).toBeGreaterThan(0.95);
    const [, b1] = shoreMix(600, 700);
    expect(b1).toBeGreaterThan(0.95);
    const [, , pr] = shoreMix(-2900, 2600);
    expect(pr).toBeGreaterThan(0.95);
    for (const [x, y] of [[0, 0], [-2200, 1300], [3000, -1500]]) {
      const w = shoreMix(x, y);
      expect(w[0] + w[1] + w[2]).toBeCloseTo(1, 5);
    }
  });

  it('the coaster dips low over the beach at its crossing, train head first, and hits what stands there', () => {
    let low = -1;
    for (let t = 0; t < 400; t += 0.05) {
      const cars = trainCars(t);
      if (cars[0][2] < 70 && Math.hypot(cars[0][0] - CROSSING.x, cars[0][1] - CROSSING.y) < CROSSING.r) {
        low = t;
        break;
      }
    }
    expect(low).toBeGreaterThan(0);
    const g = bw({ godMode: false });
    g.weapons.list.length = 0;
    g.time = low - 1 / 60;
    g.player.x = g.player.px = trainCars(low)[0][0];
    g.player.y = g.player.py = trainCars(low)[0][1];
    g.player.iframes = 0;
    const hp = g.player.hp;
    g.tick();
    expect(g.player.hp).toBeLessThan(hp);
    expect(trainU(1).dwelling).toBe(true);
  });

  it('sea things come up out of the surf near a player by the water; land things never start in deep water', () => {
    const g = bw();
    g.player.x = g.player.px = 400;
    g.player.y = g.player.py = shoreY(400) - 100;
    for (let i = 0; i < 40; i++) {
      const e = g.spawnEnemy('drowned', 400 + (i - 20) * 30, shoreY(400) - 300)!;
      expect(waterDepth(e.x, e.y)).toBeGreaterThan(100);
      expect(e.emerge).toBeGreaterThan(0);
      const c = g.spawnEnemy('evil_clown', 400 + (i - 20) * 30, shoreY(400) + 900)!;
      expect(waterDepth(c.x, c.y)).toBeLessThanOrEqual(200);
      g.despawnEnemy(e);
      g.despawnEnemy(c);
    }
  });

  it('whatever falls in deep water drifts in to where it can be reached; helpful spots are never out at sea', () => {
    const g = bw();
    const pk = g.spawnPickup('ticket', 300, shoreY(300) + 600, 5);
    g.player.x = g.player.px = 0;
    g.player.y = g.player.py = -470;
    tickN(g, 60 * 12);
    expect(waterDepth(pk.x, pk.y)).toBeLessThanOrEqual(WADE);
    g.player.x = g.player.px = 300;
    g.player.y = g.player.py = shoreY(300) - 40;
    for (let i = 0; i < 200; i++) {
      const s = g.nearbyOpenSpot(300, 700);
      expect(waterDepth(s.x, s.y)).toBeLessThan(WADE);
    }
  });
});

describe('the park keeps its shape (D-69)', () => {
  it('the coaster and its bents pass through no building but their own station', () => {
    useMap('boardwalk');
    const near = (x: number, y: number, m: number) => BUILDINGS.find((b) => b.id !== 'station' && x > b.x0 - m && x < b.x1 + m && y > b.y0 - m && y < b.y1 + m);
    for (let i = 0; i < 4000; i++) {
      const [x, y] = trackAt(i / 4000);
      expect(near(x, y, 50)?.id ?? null).toBeNull();
    }
    for (const b of BENTS) expect(near(b.x, b.y, 50)?.id ?? null).toBeNull();
    // and nothing the promenade puts up stands inside a bent
    for (const p of PROPS) if (p.kind === 'bw_lamp' || p.kind === 'bw_palm') for (const b of BENTS) expect(Math.hypot(p.x - b.x, p.y - b.y)).toBeGreaterThan(100);
    useMap('carnival_core');
  });

  it("the Gift Shop's quest spots stand on its open floor, and its photograph inside its walls", () => {
    useMap('boardwalk');
    for (const [x, y] of [...SUMMERS_END.shelf, [SUMMERS_END.photo.x, SUMMERS_END.photo.y]] as [number, number][]) {
      expect(insideBuilding(x, y)?.id).toBe('giftshop');
      const blocked = PROPS.some((p) => p.hw !== undefined && p.hh !== undefined && Math.abs(p.x - x) < p.hw && Math.abs(p.y - y) < p.hh);
      expect(blocked).toBe(false);
    }
    useMap('carnival_core');
  });
});

describe('the Boardwalk crowd (D-68)', () => {
  it('a barnacle crust soaks hits until it cracks, then the thing inside takes more and moves faster', () => {
    const g = bw();
    const e = g.spawnEnemy('barnacle_brute', g.player.x + 300, g.player.y, { exact: true, noScale: true })!;
    const max = e.maxHp;
    g.damageEnemy(e, 10, false, 0, 0, 0, 'test');
    expect(max - e.hp).toBeCloseTo(3, 5);
    let guard = 0;
    while (!e.cracked && guard++ < 1000) g.damageEnemy(e, 10, false, 0, 0, 0, 'test');
    expect(e.cracked).toBe(true);
    const hp = e.hp;
    g.damageEnemy(e, 10, false, 0, 0, 0, 'test');
    expect(hp - e.hp).toBeCloseTo(12.5, 5);
  });

  it("a Ticket Taker's stub marks a player, and the crowd comes for them faster", () => {
    const g = bw({ godMode: false });
    g.weapons.list.length = 0;
    const e = g.spawnEnemy('living_balloon', g.player.x + 400, g.player.y, { exact: true })!;
    const base = g.slowFactor(e);
    g.spawnBullet('stub', g.player.x, g.player.y, 0, 0, 1, { r: 8, life: 1 });
    g.player.iframes = 0;
    g.tick();
    expect(g.player.markedT).toBeGreaterThan(0);
    expect(g.slowFactor(e)).toBeCloseTo(base * MARKED_HASTE, 5);
  });

  it('a Prize Collector swallows the tickets on the boards and pays them back, with interest', () => {
    const g = bw();
    g.weapons.list.length = 0;
    const c = g.spawnEnemy('prize_collector', g.player.x + 500, g.player.y, { exact: true })!;
    for (let i = 0; i < 10; i++) g.spawnPickup('ticket', c.x + (i - 5) * 6, c.y + 4, 10);
    tickN(g, 30);
    expect(c.loot).toBeGreaterThanOrEqual(80);
    expect(c.scale).toBeGreaterThan(1);
    const loot = c.loot;
    const before = g.pickups.filter((p) => p.alive && p.kind === 'ticket').reduce((s, p) => s + p.value, 0);
    g.damageEnemy(c, 1e9, false, 0, 0, 0, 'test');
    const after = g.pickups.filter((p) => p.alive && p.kind === 'ticket').reduce((s, p) => s + p.value, 0);
    expect(after - before).toBeGreaterThanOrEqual(loot * 1.4);
  });

  it('every new creature fights a bot for a minute without faults, telegraphing its attacks', () => {
    const ids = ['drowned', 'shore_crawler', 'ticket_taker', 'taffy_horror', 'arcade_automaton', 'coaster_wraith', 'barnacle_brute', 'lantern_angler', 'prize_collector', 'tidecaller', 'great_barnacle', 'tin_duck'];
    for (const id of ids) {
      const g = bw({ seed: 5 });
      g.weapons.list.length = 0;
      for (const e of g.active) g.despawnEnemy(e);
      const e = g.spawnEnemy(id, g.player.x + 260, g.player.y + 40, { exact: true })!;
      expect(e, id).toBeTruthy();
      let windup = false;
      for (let i = 0; i < 60 * 60 && e.alive; i++) {
        g.inputs[0].moveX = Math.sin(i / 90);
        g.inputs[0].moveY = Math.cos(i / 120) * 0.5;
        g.tick();
        if (e.windup > 0) windup = true;
        expect(Number.isFinite(e.x) && Number.isFinite(e.y), id).toBe(true);
      }
      if (!['drowned', 'tin_duck', 'tidecaller', 'lantern_angler'].includes(id)) expect(windup, id).toBe(true);
    }
  });

  it('a Tidecaller raises the drowned round its player', () => {
    const g = bw({ seed: 6 });
    g.weapons.list.length = 0;
    for (const e of g.active) g.despawnEnemy(e);
    g.spawnEnemy('tidecaller', g.player.x + 420, g.player.y, { exact: true });
    let raised = 0;
    const spawn = g.spawnEnemy.bind(g);
    g.spawnEnemy = (id, x, y, o) => {
      if (id === 'drowned' && o?.exact) raised++;
      return spawn(id, x, y, o);
    };
    tickN(g, 60 * 12);
    expect(raised).toBeGreaterThanOrEqual(3);
  });
});

describe('a Boardwalk night (D-68)', () => {
  it('every one of its events starts and plays out without faults', () => {
    for (const id of BOARDWALK_EVENTS) {
      const g = bw({ seed: 11 });
      g.time = 800;
      g.events.start(id);
      tickN(g, 60 * 20);
      expect(g.phase).toBe('play');
    }
  });

  it('the camera and the players keep to the map', () => {
    const g = bw();
    for (let i = 0; i < 60 * 30; i++) {
      g.inputs[0].moveX = 1;
      g.inputs[0].moveY = 1;
      if (g.phase === 'draft') g.chooseDraft(0);
      g.tick();
      expect(g.player.x).toBeLessThanOrEqual(PLAYER_BOUNDS.maxX);
      expect(g.player.y).toBeLessThanOrEqual(PLAYER_BOUNDS.maxY);
      expect(waterDepth(g.player.x, g.player.y)).toBeLessThanOrEqual(WADE + 1);
    }
    expect(PLAYER_BOUNDS.maxY).toBe(BW_BOUNDS.maxY);
    useMap('carnival_core');
  });

  it('plays all four Acts, defeats every boss, reaches dawn and pays out', () => {
    const g = bw({ seed: 778 });
    const acts = new Set<number>();
    g.bus.on('act', (e) => acts.add(e.act));
    for (let s = 0; s < 2600 && g.phase !== 'ended'; s++) runFor(g, 1);
    expect([...acts].sort()).toEqual([2, 3, 4]);
    expect(g.bossIds).toEqual(['barker', 'drowned_captain', 'last_ride', 'leviathan']);
    expect(g.phase).toBe('ended');
    expect(g.endStats?.won).toBe(true);
    expect(g.endStats!.lostTickets).toBeGreaterThan(300);
    expect(SEA.retreat).toBe(0);
    void shoreBase;
    useMap('carnival_core');
  });
});
