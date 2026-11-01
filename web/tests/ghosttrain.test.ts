// The Ghost Train (D-80): the fourth map. Its 35-minute night and four acts; the Midnight Line's timetable
// (a pure function of time and one replicated number); boarding, riding and alighting (everything in a copy of
// the carriages moves with it at departure and arrival, at the same place in the same car); the journeys'
// creatures boarding at the two ends only; the stations' crowds by home and never in the carriages; the
// bosses at stations, following the party down the line; the phantom doors; The Last Train Home played
// through solo; its co-op sync; the save.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { Game } from '../src/sim/game';
import { MAPS, MAP_IDS, useMap } from '../src/data/maps';
import { ACT_GATES, DAWN_TIME, GHOST_ENDLESS, GHOST_VICTORY, GHOST_WAVES } from '../src/data/waves';
import { CONDUCTOR_DEF, GHOST_BOSSES, BOSS_MAP } from '../src/data/bosses';
import { ENEMIES } from '../src/data/enemies';
import { C, CARS, DWELL, E, FINAL_ACT, J, MOUTHS, PHANTOM_AT, REGIONS, S, TERMINUS_FROM, TRAIN, TRANSIT, V, inCopy, nextArrival, regionAt, trackY, trainAt, trainOrigin } from '../src/data/ghosttrain';
import { collideBody } from '../src/sim/movement';
import { CINDER, END, JUNCTION, LT_TRAIN, PHANTOM_DOOR, STATION_CLOCK, STILLWATER, VESPER } from '../src/data/gtStations';
import { LAST_TRAIN } from '../src/data/lastTrain';
import { FOLLOW_AFTER, bossStation, eFromOf, homeOk, stationAnchor, trainNow } from '../src/sim/ghosttrain';
import { LT, gaugeAt, type LastTrainChain } from '../src/sim/quest/lastTrain';
import { createBoss } from '../src/sim/bosses';
import type { BossBase } from '../src/sim/bosses/boss';
import { SnapshotEncoder, decodeSnapshot, type View } from '../src/net/snapshot';
import { Replica } from '../src/net/replica';
import { StringDict } from '../src/net/codec';
import { SaveManager, type StorageLike } from '../src/meta/save';
import { CAMERA_FOR, PLAYER_BOUNDS } from '../src/data/map';
import { computePayout } from '../src/data/meta';

const gt = (o: Parameters<typeof makeGame>[0] = {}) => makeGame({ map: 'ghost_train', godMode: true, seed: 11, ...o } as never);
const chainOf = (g: Game) => g.quests.get<LastTrainChain>('last_train')!;
/** keep the scheduled bosses out of the way */
const noBosses = (g: Game) => {
  for (const b of GHOST_BOSSES) {
    g.director['spawned'].add(b.id);
    g.director['warned'].add(b.id);
  }
};
function tickN(g: Game, n: number): void {
  for (let i = 0; i < n; i++) {
    if (g.phase === 'draft') g.chooseDraft(0);
    g.tick();
  }
}
/** One tick with player `who` held at (x, y), the crowd near them cleared, drafts auto-picked. */
function step(g: Game, x: number, y: number, press = false, who = 0): void {
  if (g.phase === 'draft') g.chooseDraft(0);
  const p = g.players[who];
  p.x = p.px = x;
  p.y = p.py = y;
  for (const e of g.active) if (e.alive && Math.hypot(e.x - x, e.y - y) < 360) g.despawnEnemy(e);
  if (press) g.inputs[who].interact = true;
  g.tick();
}
/** Stand at (x, y) a few ticks, press interact once, settle. (The night is jumped about between presses
 *  here, faster than the fixtures' own short press cooldowns run down, so those are cleared first.) */
function press(g: Game, x: number, y: number, who = 0): void {
  for (const c of g.quests.chains) (c as unknown as { cool?: Map<string, number> }).cool?.clear();
  for (let i = 0; i < 3; i++) step(g, x, y, false, who);
  step(g, x, y, true, who);
  for (let i = 0; i < 3; i++) step(g, x, y, false, who);
}
/** Jump the night to `t` (the timetable follows: it is a function of time), settle a tick. */
function at(g: Game, t: number): void {
  g.time = t;
  tickN(g, 1);
}
/** The next time from now the train stands at station r with its doors open, a few seconds in. */
function dwellAt(g: Game, r: number): number {
  const t = nextArrival(r, g.time, eFromOf(g), 2400);
  return t + 6;
}
function hitBoss(g: Game, b: BossBase): void {
  let guard = 0;
  while (!b.dead && guard++ < 8000) {
    for (const p of b.parts.filter((q) => q.alive && !q.invuln && q.kind === 'body')) g.damageTarget(p, b.maxHp * 0.02, false, 0, 0, 0, 'test');
    if (g.phase === 'draft') g.chooseDraft(0);
    g.tick();
  }
}
/** In region r's copy of the carriages, at the train's own (lx, ly). */
const inCar = (r: number, lx: number, ly: number) => ({ x: trainOrigin(r).x + lx, y: trainOrigin(r).y + ly });

describe('the Ghost Train on the map registry (D-80)', () => {
  it('is the fourth map: a 35-minute night with its own acts, six bosses, its own crowd', () => {
    expect(MAP_IDS).toEqual(['carnival_core', 'fun_house', 'boardwalk', 'ghost_train']);
    const m = MAPS.ghost_train;
    expect(m.dawn).toBe(2100);
    expect(m.actGates).toEqual([480, 1020, 1500]);
    expect(m.bosses.map((b) => b.gate)).toEqual([300, 600, 900, 1200, 1500, 1800]);
    expect(m.finalBoss).toBe('night_express');
    expect(m.bosses.at(-1)!.id).toBe('night_express');
    useMap('ghost_train');
    expect(DAWN_TIME).toBe(2100);
    expect(ACT_GATES).toEqual([480, 1020, 1500]);
    useMap('carnival_core');
    expect(DAWN_TIME).toBe(1500);
    expect(ACT_GATES).toEqual([360, 720, 1080]);
  });

  it('has a roster all its own, bigger than any other map, every creature with a home', () => {
    const ids = new Set<string>();
    for (const w of [...GHOST_WAVES, GHOST_VICTORY, GHOST_ENDLESS]) for (const [id] of w.enemies) ids.add(id);
    for (const w of GHOST_WAVES) if (w.swarm) ids.add(w.swarm.enemy);
    ids.add(MAPS.ghost_train.miniboss);
    for (const id of ids) {
      expect(id.startsWith('gt_'), id).toBe(true);
      expect(ENEMIES[id], id).toBeTruthy();
      expect(typeof ENEMIES[id].params.home, id).toBe('string');
    }
    const gtIds = Object.keys(ENEMIES).filter((k) => k.startsWith('gt_'));
    expect(gtIds.length).toBe(21);
    expect(ids.size).toBeGreaterThanOrEqual(20);
    // every boss is new and has its secret one
    expect(new Set(GHOST_BOSSES.map((b) => b.id)).size).toBe(6);
    expect(BOSS_MAP.conductor).toBe(CONDUCTOR_DEF);
  });
});

describe('the Midnight Line timetable (D-80)', () => {
  it('pulls in out of the fog at 0:30, and loops J → V → C → S → J every 5:30', () => {
    expect(trainAt(0).phase).toBe('approach');
    expect(trainAt(31).phase).toBe('dwell');
    expect(trainAt(31).at).toBe(J);
    expect(trainAt(76).phase).toBe('travel');
    expect(trainAt(76).to).toBe(V);
    expect(nextArrival(V, 0)).toBeCloseTo(110, 3);
    expect(nextArrival(J, 40)).toBeCloseTo(360, 3);
    // Stillwater to the Junction runs through the End of the Line without stopping before the final act
    const s = trainAt(305);
    expect(s.phase).toBe('travel');
    expect(s.passing).toBe(true);
  });

  it('opens the doors 2 s after a stop and shuts them as its departure count reaches 0 (D-84: it was 3 s early)', () => {
    expect(trainAt(31).doors).toBe(false);
    expect(trainAt(33).doors).toBe(true);
    expect(trainAt(72.5).doors).toBe(true);
    expect(trainAt(74.95).doors).toBe(true);
    expect(trainAt(74.95).departIn).toBeLessThan(0.1);
    expect(trainAt(75.05).phase).toBe('travel');
    expect(trainAt(75.05).doors).toBe(false);
  });

  it('calls at the End of the Line from the final act, and the last train terminates there', () => {
    const tE = nextArrival(E, 0, FINAL_ACT, 2400);
    expect(tE).toBeGreaterThanOrEqual(TERMINUS_FROM);
    const st = trainAt(tE + 10);
    expect(st.phase).toBe('dwell');
    expect(st.at).toBe(E);
    expect(st.departIn).toBe(Infinity);
    expect(trainAt(2050).at).toBe(E);
  });

  it('with the points set early (the quest), the End of the Line is a stop from the next train out of Stillwater', () => {
    const tE = nextArrival(E, 700, 720, 2400);
    expect(tE).toBeCloseTo(995, 0);
    const st = trainAt(tE + 5, 720);
    expect(st.at).toBe(E);
    expect(st.to).toBe(J);
    // and an eFrom set during a run never rewrites the timetable already run
    for (let t = 0; t < 720; t += 7) expect(trainAt(t, 720)).toEqual(trainAt(t, FINAL_ACT));
  });
});

describe('boarding, riding and alighting (D-80)', () => {
  it('carries the player, a creature and a dropped ticket from the Junction to Saint Vesper\'s at the same place in the car', () => {
    const g = gt();
    noBosses(g);
    at(g, 60);
    const here = inCar(J, 620, 10);
    step(g, here.x, here.y);
    const p = g.player;
    // stand still through the departure (75 s); just before it, a creature and a ticket in the car with us
    g.input.moveX = g.input.moveY = 0;
    while (g.time < 74.5) tickN(g, 1);
    for (const q of g.active) g.despawnEnemy(q);
    const e = g.spawnEnemy('gt_porter', here.x + 120, here.y - 20, { exact: true })!;
    e.invuln = true;
    const pk = g.spawnPickup('ticket', here.x - 90, here.y + 30, 3);
    while (g.time < 74.99) tickN(g, 1);
    const before = { x: p.x - trainOrigin(J).x, y: p.y - trainOrigin(J).y };
    tickN(g, 1);
    expect(regionAt(p.x, p.y)).toBe(TRANSIT);
    const ot = trainOrigin(TRANSIT);
    // the same spot in the same car, to the unit
    expect(Math.abs(p.x - ot.x - before.x)).toBeLessThan(6);
    expect(Math.abs(p.y - ot.y - before.y)).toBeLessThan(6);
    while (g.time < 76) tickN(g, 1);
    expect(regionAt(e.x, e.y)).toBe(TRANSIT);
    expect(regionAt(pk.x, pk.y)).toBe(TRANSIT);
    // and on into Saint Vesper's (110 s)
    for (const q of g.active) if (q !== e) g.despawnEnemy(q);
    while (g.time < 111) tickN(g, 1);
    expect(regionAt(p.x, p.y)).toBe(V);
    expect(Math.abs(p.y - trainOrigin(V).y)).toBeLessThanOrEqual(TRAIN.halfW);
  });

  it('keeps a moving train sealed: nobody gets off between stations', () => {
    const g = gt();
    noBosses(g);
    at(g, 90);
    const o = trainOrigin(TRANSIT);
    const p = g.player;
    p.x = p.px = o.x + 470;
    p.y = p.py = o.y;
    g.input.moveY = 1;
    tickN(g, 120);
    expect(regionAt(p.x, p.y)).toBe(TRANSIT);
    expect(Math.abs(p.y - o.y)).toBeLessThanOrEqual(TRAIN.halfW);
  });
});

describe('who comes aboard, and where (D-80)', () => {
  it('boards a moving train only at its two ends (the tender and the rear platform), never in the cars between', () => {
    const g = gt();
    noBosses(g);
    at(g, 80);
    const o = trainOrigin(TRANSIT);
    const p = g.player;
    const seen = new Set<number>();
    for (const e of g.active) seen.add(e.uid);
    let fresh = 0;
    for (let i = 0; i < 60 * 25; i++) {
      p.x = p.px = o.x + 120;
      p.y = p.py = o.y;
      tickN(g, 1);
      for (const e of g.active) {
        if (!e.alive || seen.has(e.uid)) continue;
        seen.add(e.uid);
        if (regionAt(e.x, e.y) !== TRANSIT) continue;
        fresh++;
        const lx = e.x - o.x;
        const nearEnd = Math.abs(lx - MOUTHS.front.x) < 40 || Math.abs(lx - MOUTHS.rear.x) < 40;
        expect(nearEnd, `${e.def.id} at local x ${lx.toFixed(0)}`).toBe(true);
      }
    }
    expect(fresh).toBeGreaterThan(4);
  });

  it('sends nothing aboard while nobody rides', () => {
    const g = gt();
    noBosses(g);
    at(g, 80);
    for (const e of g.active) g.despawnEnemy(e);
    for (let i = 0; i < 60 * 10; i++) step(g, 0, trackY(J) + 400);
    for (const e of g.active) expect(regionAt(e.x, e.y)).not.toBe(TRANSIT);
  });

  it('fills a station only with the creatures that belong there, outside the parked carriages', () => {
    const g = gt();
    noBosses(g);
    at(g, 112);
    const V0 = REGIONS[V];
    for (let i = 0; i < 60 * 20; i++) {
      g.player.x = g.player.px = V0.cx;
      g.player.y = g.player.py = trackY(V) + 520;
      tickN(g, 1);
    }
    let n = 0;
    for (const e of g.active) {
      if (!e.alive || regionAt(e.x, e.y) !== V || e.def.id === 'gt_moth') continue;
      n++;
      expect(homeOk(e.def.id, V), e.def.id).toBe(true);
    }
    expect(n).toBeGreaterThan(5);
    expect(stationAnchor(g)).toBe(g.player);
  });
});

describe('the bosses at the stations (D-80)', () => {
  it('meet the party at its station and follow it down the line when it leaves', () => {
    const g = gt();
    at(g, 296);
    const p = g.player;
    for (let i = 0; i < 60 * 6; i++) step(g, 0, trackY(J) + 500);
    const b = g.bosses.find((q) => q.def.id === 'stationmaster');
    expect(b).toBeTruthy();
    expect(regionAt(b!.x, b!.y)).toBe(J);
    // the party is at the Cinder Works now: the Stationmaster is waiting there
    for (let i = 0; i < 60 * (FOLLOW_AFTER + 2); i++) step(g, 0, 4800 + 300);
    expect(regionAt(b!.x, b!.y)).toBe(C);
    void p;
  });

  it('the Night Express is the End of the Line\'s, whoever stands where', () => {
    const g = gt();
    expect(bossStation(g, true)).toBe(E);
  });
});

describe('nobody stuck in the train (D-84)', () => {
  it('fills the pocket between two cars: a shove from the platform cannot wedge anyone there', () => {
    const g = gt();
    noBosses(g);
    at(g, dwellAt(g, J));
    const p = g.player, o = trainOrigin(J);
    // the gap between the coach (from x 390) and the dining car (to x 360), outside the gangway, on the platform side
    for (const ly of [70, 90, 115]) {
      p.x = p.px = o.x + 375;
      p.y = p.py = o.y + ly;
      collideBody(p, g.bosses);
      const lx = p.x - o.x, y = p.y - o.y;
      expect(lx > 360 - 6 && lx < 390 + 6 && y > TRAIN.gangHalf + TRAIN.wallT && y < TRAIN.halfW + TRAIN.wallT, `${lx},${y}`).toBe(false);
    }
  });

  it("steps anyone out of a train's walls once it has gone, rather than leaving them a whole loop inside it", () => {
    const g = gt();
    noBosses(g);
    at(g, nextArrival(J, 0, eFromOf(g), 2400) + DWELL[J] + 5);
    expect(trainNow(g).phase).toBe('travel');
    const q = inCar(J, 600, 20);
    step(g, q.x, q.y);
    expect(regionAt(g.player.x, g.player.y)).toBe(J);
    expect(g.player.y - trainOrigin(J).y).toBeGreaterThan(TRAIN.halfW + TRAIN.wallT);
    // while the train stands there, inside is aboard: nobody is moved
    at(g, dwellAt(g, J));
    step(g, q.x, q.y);
    expect(g.player.y - trainOrigin(J).y).toBeLessThan(TRAIN.halfW);
  });

  it('carries off whoever is in a car or a doorway as it leaves, not someone pressed against its side', () => {
    const g = gt({ players: [{ character: 'carny', name: 'A' }, { character: 'strongman', name: 'B' }] } as never);
    noBosses(g);
    at(g, nextArrival(J, 0, eFromOf(g), 2400) + DWELL[J] - 1);
    const [a, b] = g.players;
    const door = inCar(J, CARS[2].doors[0], TRAIN.halfW + TRAIN.wallT / 2);
    const side = inCar(J, 600, TRAIN.halfW + TRAIN.wallT + b.r);
    for (let i = 0; i < 90; i++) {
      if (i < 50) {
        a.x = a.px = door.x;
        a.y = a.py = door.y;
        b.x = b.px = side.x;
        b.y = b.py = side.y;
      }
      g.tick();
    }
    expect(trainNow(g).phase).toBe('travel');
    expect(regionAt(a.x, a.y)).toBe(TRANSIT);
    expect(Math.abs(a.y - trainOrigin(TRANSIT).y)).toBeLessThan(TRAIN.halfW);
    expect(regionAt(b.x, b.y)).toBe(J);
  });

  it('a boss quiets only its own station: a partner at another station still meets the crowd', () => {
    const g = gt({ players: [{ character: 'carny', name: 'A' }, { character: 'strongman', name: 'B' }] } as never);
    at(g, 296);
    const [a, b] = g.players;
    const hold = () => {
      a.x = a.px = REGIONS[J].cx;
      a.y = a.py = trackY(J) + 500;
      b.x = b.px = REGIONS[V].cx;
      b.y = b.py = trackY(V) + 500;
    };
    let guard = 0;
    while (!g.bosses.some((q) => q.awake && !q.dead) && guard++ < 60 * 20) {
      hold();
      g.tick();
    }
    const boss = g.bosses.find((q) => q.awake && !q.dead)!;
    expect(regionAt(boss.x, boss.y)).toBe(J);
    for (const e of g.active) if (e.alive && regionAt(e.x, e.y) === V) g.despawnEnemy(e);
    for (let i = 0; i < 60 * 15; i++) {
      hold();
      if (g.phase === 'draft') g.chooseDraft(0);
      g.tick();
    }
    expect(boss.dead).toBe(false);
    expect(g.active.filter((e) => e.alive && regionAt(e.x, e.y) === V).length).toBeGreaterThan(8);
  });
});

describe('the phantom doors (D-80)', () => {
  it('stand open from 29:00 and take whoever steps through to the End of the Line', () => {
    const g = gt();
    noBosses(g);
    at(g, PHANTOM_AT - 5);
    const d = PHANTOM_DOOR[0];
    press(g, d.x, d.y + 40);
    expect(regionAt(g.player.x, g.player.y)).toBe(J);
    at(g, PHANTOM_AT + 1);
    g.player.x = g.player.px = d.x;
    g.player.y = g.player.py = d.y + 40;
    for (let i = 0; i < 3; i++) tickN(g, 1);
    g.player.x = g.player.px = d.x;
    g.player.y = g.player.py = d.y + 40;
    g.inputs[0].interact = true;
    tickN(g, 1);
    expect(regionAt(g.player.x, g.player.y)).toBe(E);
  });
});

describe('The Last Train Home, solo (D-80)', () => {
  it('can be played through stage by stage within the night, to the Conductor and the true dawn', () => {
    const g = gt({ seed: 29 });
    noBosses(g);
    const ch = chainOf(g);
    // 0 the ticket
    at(g, 40);
    press(g, JUNCTION.booking.x, JUNCTION.booking.y - 20);
    expect(ch.stage).toBe(LT.Pages);
    // 1 the four pages, in the parked carriages at the Junction
    for (let k = 0; k < 4; k++) {
      const s = ch.pageSpot(k), w = inCar(J, s.x, s.y);
      press(g, w.x, w.y);
    }
    expect(ch.stage).toBe(LT.Clocks);
    // 2 the clocks: Saint Vesper's, the Works, Stillwater while their train is in, then the Junction's
    for (const r of [V, C, S, J]) {
      at(g, dwellAt(g, r));
      const c = STATION_CLOCK[r];
      press(g, c.x, c.y + 40);
    }
    expect(ch.stage).toBe(LT.Battery);
    // 3 the signal battery (the train still at the Junction)
    press(g, JUNCTION.lamproom.x, JUNCTION.lamproom.y + 20);
    expect(ch.stage).toBe(LT.Signals);
    expect(ch.batteryBy).toBe(0);
    expect(ch.lamp()).toBe(0);
    // 4 fit it to the lamp box at the front of the tender (here the Junction's copy of the train): the lamp burns red
    const box = (r: number) => inCar(r, LT_TRAIN.lampbox.x - 20, LT_TRAIN.lampbox.y - 10);
    press(g, box(J).x, box(J).y);
    expect([ch.batteryIn, ch.batteryBy, ch.lamp()]).toEqual([1, 255, 1]);
    // then each of the four, switched to green a moment before the engine passes it
    let wait = 0;
    for (let leg = 0; leg < 4; leg++) {
      wait = 0;
      while (!(ch.signalAhead().leg === leg && ch.signalAhead().inS < 2) && wait++ < 200000) g.time += 0.1;
      tickN(g, 1);
      const w = box(TRANSIT);
      press(g, w.x, w.y);
      expect(ch.lamp()).toBe(2);
      for (let i = 0; i < 200 && !(ch.signals & (1 << leg)); i++) step(g, w.x, w.y);
      expect(ch.signals & (1 << leg)).toBeTruthy();
    }
    expect(ch.signals).toBe(15);
    expect(ch.stage).toBe(LT.Points);
    // 5 the points: the levers in the footnote's order (at the Junction)
    at(g, dwellAt(g, J));
    for (const k of ch.levers) press(g, JUNCTION.levers.x + 30, JUNCTION.levers.y + (k - 2) * 38);
    expect(ch.stage).toBe(LT.Bridge);
    expect(Number.isFinite(ch.eFrom)).toBe(true);
    expect(eFromOf(g)).toBe(ch.eFrom);
    // 6 the whistle on the bridge, on the way to the End of the Line
    let guard = 0;
    while (!ch.onBridge() && guard++ < 200000) g.time += 0.1;
    tickN(g, 1);
    const wh = inCar(TRANSIT, LT_TRAIN.whistle.x - 10, LT_TRAIN.whistle.y + 10);
    press(g, wh.x, wh.y);
    expect(ch.stage).toBe(LT.Punch);
    // 7 the punch, 8 the passengers, at the End of the Line while the train is in
    at(g, dwellAt(g, E));
    press(g, END.barrier.x, END.barrier.y - 40);
    expect(ch.stage).toBe(LT.Passengers);
    for (let k = 0; k < 4; k++) press(g, END.passengers[k].x, END.passengers[k].y + 30);
    expect(ch.stage).toBe(LT.Deliveries);
    // 9 the errands. Ada's letter from her table, to the Junction's post box
    at(g, dwellAt(g, J));
    const lt = inCar(J, LT_TRAIN.letter.x, LT_TRAIN.letter.y + 50);
    press(g, lt.x, lt.y);
    expect(ch.letterBy).toBe(0);
    press(g, JUNCTION.postbox.x, JUNCTION.postbox.y + 40);
    expect(ch.tasks & 1).toBe(1);
    // Theo's coal: three shovelfuls from the Works' chute into the tender, then three good stokes on the move
    at(g, dwellAt(g, C));
    for (let k = 0; k < 3; k++) {
      press(g, CINDER.chute.x, CINDER.chute.y + 50);
      const fb = inCar(C, LT_TRAIN.firebox.x - 20, LT_TRAIN.firebox.y);
      press(g, fb.x, fb.y);
    }
    expect(ch.coal).toBe(3);
    while (trainNow(g).phase !== 'travel') g.time += 0.5;
    tickN(g, 1);
    for (let k = 0; k < 3; k++) {
      while (gaugeAt(g.time) < 1 - LAST_TRAIN.gaugeWindow * 0.6) g.time += 1 / 60;
      for (const c of g.quests.chains) (c as unknown as { cool?: Map<string, number> }).cool?.clear();
      const fb = inCar(TRANSIT, LT_TRAIN.firebox.x - 20, LT_TRAIN.firebox.y);
      step(g, fb.x, fb.y, true);
      g.time += 0.6;
    }
    expect(ch.tasks & 2).toBe(2);
    // Mira's hour: Stillwater's church clock, while the train is in
    at(g, dwellAt(g, S));
    for (let k = 0; k < 12 && ch.hour !== ch.targetHour; k++) press(g, STILLWATER.church.x, STILLWATER.church.y - 30);
    expect(ch.tasks & 4).toBe(4);
    // Eli's bells: Saint Vesper's three, in tonight's order, while the train is in
    at(g, dwellAt(g, V));
    for (const k of ch.bellOrder) press(g, VESPER.ropes[k].x, VESPER.ropes[k].y - 20);
    expect(ch.tasks).toBe(15);
    expect(ch.stage).toBe(LT.LastTicket);
    // 10 the last ticket, at the End of the Line's barrier while a train stands there
    at(g, dwellAt(g, E));
    press(g, END.barrier.x, END.barrier.y - 40);
    expect(ch.stage).toBe(LT.Express);
    expect(g.time).toBeLessThan(DAWN_TIME);
    // 11 the Night Express falls… 12 the Conductor comes… 13 the last train home… 14 the true dawn
    g.time = Math.max(g.time, 1800);
    g.player.x = g.player.px = REGIONS[E].cx;
    g.player.y = g.player.py = trackY(E) + 600;
    const ex = createBoss(g, BOSS_MAP.night_express, { immediate: true });
    g.bosses.push(ex);
    tickN(g, 2);
    hitBoss(g, ex);
    tickN(g, 400);
    expect(ch.stage).toBe(LT.Finale);
    expect(g.finaleActive).toBe(true);
    tickN(g, Math.ceil(LAST_TRAIN.finaleDelay * 60) + 5);
    const cd = g.bosses.find((q) => q.def.id === 'conductor');
    expect(cd).toBeTruthy();
    hitBoss(g, cd!);
    tickN(g, 400);
    expect(ch.stage).toBe(LT.Homeward);
    tickN(g, Math.ceil(LAST_TRAIN.homeward * 60) + 5);
    expect(ch.stage).toBe(LT.Complete);
    expect(g.trueEnding).toBe(true);
    expect(g.achievementsHit.has('last_train')).toBe(true);
  }, 120000);

  it('refuses the timing-bound steps outside their moment, and lets every miss be retried', () => {
    const g = gt({ seed: 3 });
    noBosses(g);
    const ch = chainOf(g);
    ch.stage = LT.Clocks;
    // the Junction's clock won't start first, nor any clock with its train away
    at(g, dwellAt(g, J));
    press(g, STATION_CLOCK[J].x, STATION_CLOCK[J].y + 40);
    expect(ch.clocks).toBe(0);
    at(g, dwellAt(g, V) - 30);
    press(g, STATION_CLOCK[V].x, STATION_CLOCK[V].y + 40);
    expect(ch.clocks).toBe(0);
    at(g, dwellAt(g, V));
    press(g, STATION_CLOCK[V].x, STATION_CLOCK[V].y + 40);
    expect(ch.clocks).toBe(1 << V);
    // a wrong lever puts the frame back; the right order then works
    ch.stage = LT.Points;
    ch.leverStep = 0;
    at(g, dwellAt(g, J));
    const wrong = [0, 1, 2, 3, 4].find((k) => k !== ch.levers[0])!;
    press(g, JUNCTION.levers.x + 30, JUNCTION.levers.y + (wrong - 2) * 38);
    expect(ch.leverStep).toBe(0);
    for (const k of ch.levers) press(g, JUNCTION.levers.x + 30, JUNCTION.levers.y + (k - 2) * 38);
    expect(ch.stage).toBe(LT.Bridge);
  });
});

describe("the train's signal lamp (D-84)", () => {
  it('dark until the battery is fitted, red after; a signal passed at red stays at danger, one passed at green clears', () => {
    const g = gt();
    noBosses(g);
    const ch = chainOf(g);
    ch.stage = LT.Signals;
    expect(ch.lamp()).toBe(0);
    ch.batteryIn = 1;
    expect(ch.lamp()).toBe(1);
    const box = inCar(TRANSIT, LT_TRAIN.lampbox.x - 20, LT_TRAIN.lampbox.y - 10);
    // the first leg's signal, passed at red
    let wait = 0;
    while (!(ch.signalAhead().leg === 0 && ch.signalAhead().inS < 1.5) && wait++ < 200000) g.time += 0.1;
    for (let i = 0; i < 150 && ch.signalAhead().inS < 99; i++) step(g, box.x, box.y);
    expect(ch.signals).toBe(0);
    // the next leg's, switched to green just before: the press holds green 3 s, then the lamp goes back to red
    wait = 0;
    while (!(ch.signalAhead().leg === 1 && ch.signalAhead().inS < 2) && wait++ < 200000) g.time += 0.1;
    tickN(g, 1);
    press(g, box.x, box.y);
    expect(ch.lamp()).toBe(2);
    for (let i = 0; i < 200 && !(ch.signals & 2); i++) step(g, box.x, box.y);
    expect(ch.signals).toBe(2);
    for (let i = 0; i < 60 * 3; i++) step(g, box.x, box.y);
    expect(ch.lamp()).toBe(1);
  });
});

describe('The Last Train Home in co-op (D-80)', () => {
  it('reaches a guest with the timetable\'s own number, so its doors and train are the host\'s', () => {
    const host = gt({ seed: 8, players: [{ character: 'carny', name: 'Host' }, { character: 'strongman', name: 'Guest' }] } as never);
    noBosses(host);
    const ch = chainOf(host);
    ch.stage = LT.Deliveries;
    ch.eFrom = 731;
    ch.signals = 15;
    ch.pages = 15;
    ch.clocks = 15;
    ch.boarded = 15;
    ch.tasks = 5;
    ch.coal = 2;
    ch.hour = 7;
    ch.batteryBy = 1;
    ch.batteryIn = 1;
    ch.greenT = 2;
    const mirror = new Game({ ...host.cfg, godMode: false });
    const rep = new Replica(mirror, 1);
    const enc = new SnapshotEncoder();
    const dict = new StringDict();
    const view: View = { x: 0, y: 0, hx: 9000, hy: 9000 };
    const buf = enc.encode(host, { seq: 1, ackInput: 0, ackSnap: 0, dict, dictFrom: 0, view, fx: [], sfx: [] });
    rep.apply(decodeSnapshot(buf, rep.dict), 0);
    const m = chainOf(mirror);
    expect(m.stage).toBe(LT.Deliveries);
    expect(m.eFrom).toBe(731);
    expect(eFromOf(mirror)).toBe(eFromOf(host));
    expect(m.levers).toEqual(ch.levers);
    expect(m.bellOrder).toEqual(ch.bellOrder);
    expect(m.targetHour).toBe(ch.targetHour);
    expect(m.tasks).toBe(5);
    expect(m.coal).toBe(2);
    expect(m.hour).toBe(7);
    expect(m.batteryBy).toBe(1);
    expect(m.batteryIn).toBe(1);
    expect(m.greenT).toBeCloseTo(2, 1);
    for (let k = 0; k < 4; k++) expect(m.sigAt[k]).toBeCloseTo(ch.sigAt[k], 2);
    for (const t of [800, 995, 1000, 1300]) expect(trainAt(t, eFromOf(mirror))).toEqual(trainAt(t, eFromOf(host)));
  });
});

describe("the Ghost Train in a guest's mirror (D-82)", () => {
  const party = () => {
    const host = gt({ seed: 8, players: [{ character: 'carny', name: 'Host' }, { character: 'strongman', name: 'Guest' }] } as never);
    noBosses(host);
    const mirror = new Game({ ...host.cfg, godMode: false });
    return { host, mirror, rep: new Replica(mirror, 1) };
  };
  const send = (host: Game, rep: Replica) => {
    const view: View = { x: 3200, y: 4800, hx: 9000, hy: 9000 };
    rep.apply(decodeSnapshot(new SnapshotEncoder().encode(host, { seq: 1, ackInput: 0, ackSnap: 0, dict: new StringDict(), dictFrom: 0, view, fx: [], sfx: [] }), rep.dict), 0);
  };

  it('shows creatures and tickets where they are: out at the far end of a station, at the End of the Line, aboard the train', () => {
    const { host, mirror, rep } = party();
    const o = trainOrigin(TRANSIT);
    // past x 8191 at St. Vesper's and Stillwater; the End of the Line and the moving train lie past y 8191 entirely
    const spots = [
      { x: REGIONS[V].cx + 2200, y: REGIONS[V].cy + 300 },
      { x: REGIONS[S].cx + 2200, y: REGIONS[S].cy + 300 },
      { x: REGIONS[E].cx - 1500, y: REGIONS[E].cy + 400 },
      { x: o.x + 400, y: o.y + 30 },
    ];
    const es = spots.map((s) => host.spawnEnemy('gt_porter', s.x, s.y, { exact: true })!);
    const ts = spots.map((s) => host.spawnPickup('ticket', s.x + 40, s.y, 1));
    send(host, rep);
    for (const e of es) {
      const m = mirror.enemies[e.idx];
      expect(m.alive).toBe(true);
      expect(Math.abs(m.x - e.x)).toBeLessThanOrEqual(0.25);
      expect(Math.abs(m.y - e.y)).toBeLessThanOrEqual(0.25);
    }
    for (const t of ts) {
      const m = mirror.pickups[host.pickups.indexOf(t)];
      expect(Math.abs(m.x - t.x) + Math.abs(m.y - t.y)).toBeLessThanOrEqual(0.5);
    }
  });

  it('keeps its own walls, bounds and camera places when the attract demo behind the Settings takes the map', () => {
    const { host, mirror, rep } = party();
    const me = host.players[1];
    me.x = REGIONS[V].cx + 1500;
    me.y = REGIONS[V].cy + 300;
    send(host, rep);
    const x0 = mirror.players[1].x;
    expect(x0).toBeCloseTo(me.x, 1);
    // the Settings over a guest's paused night: a Carnival Core demo ticks behind them and switches the map
    const demo = makeGame({ godMode: true });
    demo.tick();
    expect(PLAYER_BOUNDS.maxX).toBeLessThan(3000);
    // back in the night, the guest walks on from where it stands (not into the Carnival's bounds by the Junction)
    for (let i = 1; i <= 10; i++) rep.predict(i, 1, 0);
    expect(Math.abs(mirror.players[1].x - x0)).toBeLessThan(80);
    // and the camera keeps to St. Vesper's
    demo.tick();
    rep.frame(1 / 60);
    expect(CAMERA_FOR?.(mirror.players[1].x, mirror.players[1].y).maxX).toBeGreaterThan(8000);
  });
});

describe('the Ghost Train on the save (D-80)', () => {
  it('opens once the Boardwalk is survived, or for a tester; the payout runs to its own dawn', () => {
    const mem = (): StorageLike => {
      const m = new Map<string, string>();
      return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
    };
    const s = new SaveManager(mem());
    expect(s.mapAvailable('ghost_train')).toBe(false);
    s.data.achievements.push('beat_leviathan');
    expect(s.mapAvailable('ghost_train')).toBe(true);
    const t = new SaveManager(mem());
    t.data.ghosttrainTester = true;
    expect(t.mapAvailable('ghost_train')).toBe(true);
    const base = { bosses: 0, kills: 0, won: false, greed: 1 };
    expect(computePayout({ ...base, seconds: 2100 })).toBe(250);
    expect(computePayout({ ...base, seconds: 2100, dawn: 2100 })).toBe(350);
  });
});

describe('the carriages and their copies (D-80)', () => {
  it('every copy\'s footprint holds all seven cars, and the copies lie in their places', () => {
    for (let r = 0; r < REGIONS.length; r++) {
      const o = trainOrigin(r);
      expect(regionAt(o.x, o.y)).toBe(r);
      for (const c of CARS) expect(inCopy(r, o.x + (c.x0 + c.x1) / 2, o.y)).toBe(true);
    }
  });
});
