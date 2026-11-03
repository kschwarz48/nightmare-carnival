// The Ghost Train (D-80): the fourth map. Its 35-minute night and four acts; the Midnight Line, which goes at the
// whistle (D-90: it kept a timetable); boarding, riding and alighting (everything in a copy of
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
import { C, CARS, E, FINAL_ACT, FIRST_ARRIVAL, J, LEG, MOUTHS, PASS_LEG, PHANTOM_AT, RECALL_AFTER, REGIONS, S, TERMINUS_FROM, TRAIN, TRANSIT, V, WHISTLE_LEAD, inCopy, nextStop, packRun, regionAt, runTime, trackY, trainOrigin, trainState, unpackRun } from '../src/data/ghosttrain';
import { collideBody } from '../src/sim/movement';
import { VIEW_HALF_X } from '../src/sim/constants';
import { CINDER, END, JUNCTION, LT_KEY_SPOTS, LT_STILL, LT_TRAIN, LT_VESPER, LT_WORKS, PHANTOM_DOOR, STATION_CLOCK, STILLWATER, VESPER } from '../src/data/gtStations';
import { LAST_TRAIN } from '../src/data/lastTrain';
import { FOLLOW_AFTER, bossStation, eOpenOf, homeOk, placeTrain, pullWhistle, runOf, stationAnchor, trainNow } from '../src/sim/ghosttrain';
import { LT, NET_BYTES, gaugeAt, type LastTrainChain } from '../src/sim/quest/lastTrain';
import { WHISTLE } from '../src/sim/quest/gtLine';
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
/** Jump the night to `t`, settle a tick. */
function at(g: Game, t: number): void {
  g.time = t;
  tickN(g, 1);
}
/** Stand the train at station r with its doors open (it goes at the whistle, D-90), and say when (now). */
function dwellAt(g: Game, r: number): number {
  placeTrain(g, 'dwell', r);
  return g.time;
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
  it('is the fourth map: a 35-minute night with its own acts, seven bosses (D-90), its own crowd', () => {
    expect(MAP_IDS).toEqual(['carnival_core', 'fun_house', 'boardwalk', 'ghost_train']);
    const m = MAPS.ghost_train;
    expect(m.dawn).toBe(2100);
    expect(m.actGates).toEqual([480, 1020, 1500]);
    // every five minutes to 30:00 (the Unclaimed's, D-90), then the final boss at 34:00
    expect(m.bosses.map((b) => b.gate)).toEqual([300, 600, 900, 1200, 1500, 1800, 2040]);
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
    expect(gtIds.length).toBe(22);
    expect(ids.size).toBeGreaterThanOrEqual(20);
    // every boss is new and has its secret one
    expect(new Set(GHOST_BOSSES.map((b) => b.id)).size).toBe(7);
    expect(BOSS_MAP.conductor).toBe(CONDUCTOR_DEF);
  });
});

describe('the Midnight Line goes at the whistle (D-90)', () => {
  /** a tick with the player in station r's tender at the whistle cord, pressing interact (the timetable mended first:
   *  the guard waits for it since D-95) */
  const pull = (g: Game, r: number) => {
    const ch = chainOf(g);
    if (ch.stage < LT.Stations) ch.stage = LT.Stations;
    const w = inCar(r, LT_TRAIN.whistle.x - 10, LT_TRAIN.whistle.y + 20);
    press(g, w.x, w.y);
  };

  it('pulls in out of the fog at 0:30, then waits at the Junction, doors open, for as long as nobody pulls the cord', () => {
    const g = gt();
    noBosses(g);
    expect(trainNow(g).phase).toBe('approach');
    at(g, FIRST_ARRIVAL + 1);
    expect(trainNow(g).phase).toBe('dwell');
    expect(trainNow(g).at).toBe(J);
    expect(trainNow(g).doors).toBe(false);
    for (let i = 0; i < 60 * 5; i++) step(g, 0, trackY(J) + 400);
    const st = trainNow(g);
    expect([st.phase, st.at, st.to, st.doors, st.departIn]).toEqual(['dwell', J, V, true, Infinity]);
  });

  it('the cord shuts the doors a few seconds later and takes the train to the next stop, where it waits again', () => {
    const g = gt();
    noBosses(g);
    at(g, 60);
    pull(g, J);
    const st = trainNow(g);
    expect(st.departIn).toBeGreaterThan(WHISTLE_LEAD - 0.3);
    expect(st.departIn).toBeLessThanOrEqual(WHISTLE_LEAD);
    expect(st.doors).toBe(true);
    // stay aboard (in the coach) through the departure and the leg
    const coach = inCar(J, 620, 0);
    for (let i = 0; i < 60 * (WHISTLE_LEAD + 1) && trainNow(g).phase === 'dwell'; i++) step(g, coach.x, coach.y);
    tickN(g, 1);
    const away = trainNow(g);
    expect([away.phase, away.at, away.to]).toEqual(['travel', J, V]);
    expect(regionAt(g.player.x, g.player.y)).toBe(TRANSIT);
    for (let i = 0; i < 60 * (LEG + 3); i++) tickN(g, 1);
    const there = trainNow(g);
    expect([there.phase, there.at, there.to, there.doors]).toEqual(['dwell', V, C, true]);
    expect(regionAt(g.player.x, g.player.y)).toBe(V);
    // and it waits there until the cord is pulled again
    for (let i = 0; i < 60 * 20; i++) tickN(g, 1);
    expect(trainNow(g).at).toBe(V);
    expect(trainNow(g).phase).toBe('dwell');
  });

  it('goes nowhere with nobody aboard: the guard waits for passengers', () => {
    const g = gt();
    noBosses(g);
    at(g, 60);
    expect(pullWhistle(g, J)).toBe('go');
    expect(pullWhistle(g, J)).toBe('going');
    for (let i = 0; i < 60 * (WHISTLE_LEAD + 2); i++) step(g, 0, trackY(J) + 400);
    const st = trainNow(g);
    expect([st.phase, st.at, st.departIn]).toEqual(['dwell', J, Infinity]);
  });

  it('goes for a party left at another station, so a train left behind strands nobody', () => {
    const g = gt();
    noBosses(g);
    at(g, 60);
    const at0 = g.time;
    while (trainNow(g).phase === 'dwell' && g.time < at0 + RECALL_AFTER + 2) step(g, REGIONS[C].cx, trackY(C) + 500);
    expect(g.time - at0).toBeGreaterThanOrEqual(RECALL_AFTER - 0.1);
    const st = trainNow(g);
    expect([st.phase, st.at, st.to]).toEqual(['travel', J, C]);
    for (let i = 0; i < 60 * (LEG + 3); i++) step(g, REGIONS[C].cx, trackY(C) + 500);
    expect(trainNow(g).at).toBe(C);
    expect(trainNow(g).phase).toBe('dwell');
  });

  it('runs on round the line, Stillwater to the Junction straight through the End of the Line until the final act', () => {
    expect([nextStop(J, false), nextStop(V, false), nextStop(C, false), nextStop(S, false), nextStop(E, false)]).toEqual([V, C, S, J, J]);
    expect(nextStop(S, true)).toBe(E);
    const g = gt();
    noBosses(g);
    at(g, 400);
    placeTrain(g, 'dwell', S);
    tickN(g, 1);
    pull(g, S);
    const aboard = inCar(S, 600, 0);
    for (let i = 0; i < 60 * (WHISTLE_LEAD + 1) && trainNow(g).phase === 'dwell'; i++) step(g, aboard.x, aboard.y);
    tickN(g, 1);
    const st = trainNow(g);
    expect([st.phase, st.to, st.passing, st.len]).toEqual(['travel', J, true, PASS_LEG]);
  });

  it('calls at the End of the Line from the final act, and the last train terminates there', () => {
    const g = gt();
    noBosses(g);
    at(g, FINAL_ACT + 10);
    expect(eOpenOf(g)).toBe(true);
    placeTrain(g, 'dwell', S);
    tickN(g, 1);
    expect(trainNow(g).to).toBe(E);
    // an early call at the End of the Line: it stops, and goes on to the Junction at the whistle
    pull(g, S);
    const aboard = inCar(S, 600, 0);
    for (let i = 0; i < 60 * (WHISTLE_LEAD + 1) && trainNow(g).phase === 'dwell'; i++) step(g, aboard.x, aboard.y);
    tickN(g, 60 * (LEG + 3));
    expect([trainNow(g).at, trainNow(g).terminated, trainNow(g).to]).toEqual([E, false, J]);
    // a call from TERMINUS_FROM is the last train's: it stands there for the rest of the night
    at(g, TERMINUS_FROM + 5);
    placeTrain(g, 'travel', S, E, LEG - 1);
    for (let i = 0; i < 60 * 3; i++) step(g, aboard.x, aboard.y);
    const st = trainNow(g);
    expect([st.phase, st.at, st.terminated, st.departIn]).toEqual(['dwell', E, true, Infinity]);
    expect(pullWhistle(g, E)).toBe('terminus');
  });

  it('reaches a guest byte for byte: the same doors and train from the same run', () => {
    const run = { phase: 'dwell' as const, at: S, to: E, since: runTime(1234.57), departAt: runTime(1238.6), len: 35, passing: false, terminated: false, empty: false, trip: 17 };
    const back = unpackRun(packRun(run));
    expect(back).toEqual(run);
    for (const t of [1235, 1237.9, 1238.65]) expect(trainState(back, t)).toEqual(trainState(run, t));
    const travel = { ...run, phase: 'travel' as const, departAt: Infinity, passing: true, len: PASS_LEG };
    expect(unpackRun(packRun(travel))).toEqual(travel);
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
    // the cord pulled: stand still through the departure; just before it, a creature and a ticket in the car with us
    expect(pullWhistle(g, J)).toBe('go');
    const go = runOf(g).departAt;
    g.input.moveX = g.input.moveY = 0;
    while (g.time < go - 0.5) step(g, here.x, here.y);
    for (const q of g.active) g.despawnEnemy(q);
    const e = g.spawnEnemy('gt_porter', here.x + 120, here.y - 20, { exact: true })!;
    e.invuln = true;
    const pk = g.spawnPickup('ticket', here.x - 90, here.y + 30, 3);
    while (g.time < go - 0.02) tickN(g, 1);
    const before = { x: p.x - trainOrigin(J).x, y: p.y - trainOrigin(J).y };
    tickN(g, 2);
    expect(regionAt(p.x, p.y)).toBe(TRANSIT);
    const ot = trainOrigin(TRANSIT);
    // the same spot in the same car, to the unit
    expect(Math.abs(p.x - ot.x - before.x)).toBeLessThan(6);
    expect(Math.abs(p.y - ot.y - before.y)).toBeLessThan(6);
    tickN(g, 30);
    expect(regionAt(e.x, e.y)).toBe(TRANSIT);
    expect(regionAt(pk.x, pk.y)).toBe(TRANSIT);
    // and on into Saint Vesper's
    for (const q of g.active) if (q !== e) g.despawnEnemy(q);
    while (g.time < go + LEG + 1) tickN(g, 1);
    expect(regionAt(p.x, p.y)).toBe(V);
    expect(Math.abs(p.y - trainOrigin(V).y)).toBeLessThanOrEqual(TRAIN.halfW);
  });

  it('keeps a moving train sealed: nobody gets off between stations', () => {
    const g = gt();
    noBosses(g);
    at(g, 90);
    placeTrain(g, 'travel', J, V, 10);
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
  it('boards a moving train out of its riders\' sight: over the two ends, or along the carriages just off screen (D-84)', () => {
    const g = gt();
    noBosses(g);
    at(g, 80);
    placeTrain(g, 'travel', J, V, 4);
    const o = trainOrigin(TRANSIT);
    const p = g.player;
    const seen = new Set<number>();
    for (const e of g.active) seen.add(e.uid);
    let fresh = 0, along = 0;
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
        if (!nearEnd) along++;
        expect(nearEnd || Math.abs(lx - 120) > VIEW_HALF_X, `${e.def.id} at local x ${lx.toFixed(0)}`).toBe(true);
      }
    }
    expect(fresh).toBeGreaterThan(4);
    expect(along).toBeGreaterThan(0);
  });

  it('sends nothing aboard while nobody rides', () => {
    const g = gt();
    noBosses(g);
    at(g, 80);
    placeTrain(g, 'travel', J, V, 4);
    for (const e of g.active) g.despawnEnemy(e);
    for (let i = 0; i < 60 * 10; i++) step(g, 0, trackY(J) + 400);
    for (const e of g.active) expect(regionAt(e.x, e.y)).not.toBe(TRANSIT);
  });

  it('fills a station only with the creatures that belong there, outside the parked carriages', () => {
    const g = gt();
    noBosses(g);
    at(g, 112);
    placeTrain(g, 'dwell', V);
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

  it('the final boss comes at 34:00 only once every other boss has fallen, however early the party reaches the End of the Line (D-90)', () => {
    const g = gt();
    const others = GHOST_BOSSES.filter((b) => b.id !== 'night_express');
    // everyone at the End of the Line, every boss but the Unclaimed already beaten
    for (const b of others) {
      g.director['spawned'].add(b.id);
      g.director['warned'].add(b.id);
      if (b.id !== 'unclaimed') g.bossIds.push(b.id);
    }
    at(g, 2040 + 5);
    for (let i = 0; i < 60 * 3; i++) step(g, REGIONS[E].cx, trackY(E) + 500);
    expect(g.bosses.some((b) => b.def.id === 'night_express')).toBe(false);
    // the Unclaimed falls: the Night Express comes
    g.bossIds.push('unclaimed');
    for (let i = 0; i < 60 * 2; i++) step(g, REGIONS[E].cx, trackY(E) + 500);
    const ex = g.bosses.find((b) => b.def.id === 'night_express');
    expect(ex).toBeTruthy();
    expect(regionAt(ex!.x, ex!.y)).toBe(E);
  });

  it("the Unclaimed (D-90) fights at the party's station and goes through its three phases", () => {
    const g = gt();
    noBosses(g);
    at(g, 1700);
    g.player.x = g.player.px = REGIONS[J].cx;
    g.player.y = g.player.py = trackY(J) + 520;
    const b = createBoss(g, BOSS_MAP.unclaimed, { immediate: true });
    g.bosses.push(b);
    tickN(g, 60 * 4);
    expect(regionAt(b.x, b.y)).toBe(J);
    const seen = new Set<number>();
    let guard = 0;
    while (!b.dead && guard++ < 6000) {
      seen.add(b.phase);
      for (const q of b.parts.filter((pt) => pt.alive && !pt.invuln && pt.kind === 'body')) g.damageTarget(q, b.maxHp * 0.004, false, 0, 0, 0, 'test');
      g.player.x = g.player.px = REGIONS[J].cx;
      g.player.y = g.player.py = trackY(J) + 520;
      if (g.phase === 'draft') g.chooseDraft(0);
      g.tick();
    }
    expect(b.dead).toBe(true);
    expect([...seen].sort()).toEqual([0, 1, 2]);
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
    at(g, 120);
    placeTrain(g, 'travel', J, V, 5);
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
    at(g, 120);
    placeTrain(g, 'dwell', J);
    runOf(g).departAt = runTime(g.time + 1);
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
  it('stand open from 33:00 and take whoever steps through to the End of the Line', () => {
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

describe('The Last Train Home, solo (D-80, reworked in D-90)', () => {
  it('can be played through stage by stage within the night, to the Conductor and the true dawn', () => {
    const g = gt({ seed: 29 });
    noBosses(g);
    const ch = chainOf(g);
    at(g, 40);
    // 0 the ticket; the Junction's clock won't wind without its key
    press(g, JUNCTION.booking.x, JUNCTION.booking.y - 20);
    expect(ch.stage).toBe(LT.Key);
    press(g, STATION_CLOCK[J].x, STATION_CLOCK[J].y + 40);
    expect(ch.stage).toBe(LT.Key);
    // 1 the brass key, wherever it lies tonight
    const k0 = LT_KEY_SPOTS[ch.keyAt];
    press(g, k0.x, k0.y + 20);
    expect([ch.stage, ch.keyBy]).toEqual([LT.Junction, 0]);
    // 2 the Junction's clock, wound while the train is in: the sleeper's compartments open (their doors were walls)
    expect(ch.compartmentsOpen).toBe(false);
    dwellAt(g, J);
    press(g, STATION_CLOCK[J].x, STATION_CLOCK[J].y + 40);
    expect(ch.stage).toBe(LT.Pages);
    expect(ch.compartmentsOpen).toBe(true);
    // 3 the four pages, one in each compartment of the Junction's copy of the sleeper
    for (let k = 0; k < 4; k++) {
      const s = ch.pageSpot(k), w = inCar(J, s.x, s.y);
      press(g, w.x, w.y);
    }
    expect(ch.stage).toBe(LT.Stations);
    // 4 Saint Vesper's: a taper from the altar candles to the three grave lamps, the vigil at the empty grave, the key
    dwellAt(g, V);
    press(g, LT_VESPER.candles.x, LT_VESPER.candles.y + 30);
    expect(ch.tapers).toBe(1);
    for (const l of LT_VESPER.lamps) press(g, l.x, l.y + 20);
    expect(ch.step[V]).toBe(1);
    const vg = LT_VESPER.vigil;
    for (let i = 0; i < 60 * (LAST_TRAIN.vigil + 2) && ch.step[V] === 1; i++) step(g, vg.x, vg.y);
    expect(ch.step[V]).toBe(2);
    press(g, STATION_CLOCK[V].x, STATION_CLOCK[V].y + 40);
    expect(ch.running(V)).toBe(true);
    // the Cinder Works: three pieces of brass into the crucible, then the ladle walked along its rails to the clock
    dwellAt(g, C);
    LT_WORKS.scrapSpots.forEach((sp, k) => {
      if (!(ch.scrapAt & (1 << k))) return;
      press(g, sp.x, sp.y + 20);
      press(g, LT_WORKS.crucible.x, LT_WORKS.crucible.y + 60);
    });
    expect(ch.step[C]).toBe(1);
    for (let i = 0; i < 60 * 60 && ch.step[C] === 1; i++) {
      const l = ch.ladleAt();
      step(g, l.x + 40, l.y + 30);
    }
    expect(ch.step[C]).toBe(2);
    press(g, STATION_CLOCK[C].x, STATION_CLOCK[C].y + 40);
    expect(ch.running(C)).toBe(true);
    // Stillwater: the three frozen moments, the pendulum reeled out of the still pond, carried and hung, the key
    dwellAt(g, S);
    LT_STILL.moments.forEach((m, k) => {
      for (let i = 0; i < 60 * (LAST_TRAIN.moment + 2) && ch.moments[k] < 1; i++) step(g, m.x, m.y);
    });
    expect(ch.step[S]).toBe(1);
    const bk = LT_STILL.bank;
    for (let i = 0; i < 60 * (LAST_TRAIN.reel + 2) && ch.step[S] === 1; i++) step(g, bk.x, bk.y);
    expect(ch.step[S]).toBe(2);
    press(g, bk.x, bk.y);
    expect(ch.pendulumBy).toBe(0);
    press(g, STATION_CLOCK[S].x, STATION_CLOCK[S].y + 40);
    expect(ch.step[S]).toBe(3);
    press(g, STATION_CLOCK[S].x, STATION_CLOCK[S].y + 40);
    expect(ch.running(S)).toBe(true);
    expect(ch.stage).toBe(LT.Prepare);
    // 5 back at the Junction: the battery fitted to the train's lamp box, the levers in the footnote's order
    dwellAt(g, J);
    press(g, JUNCTION.lamproom.x, JUNCTION.lamproom.y + 20);
    expect(ch.batteryBy).toBe(0);
    const box = (r: number) => inCar(r, LT_TRAIN.lampbox.x - 20, LT_TRAIN.lampbox.y - 10);
    press(g, box(J).x, box(J).y);
    expect([ch.batteryIn, ch.lamp(), ch.stage]).toEqual([1, 1, LT.Prepare]);
    for (const lv of ch.levers) press(g, JUNCTION.levers.x + 30, JUNCTION.levers.y + (lv - 2) * 38);
    expect(ch.stage).toBe(LT.Signal);
    // 6 the whistle, and on the way the signal at danger shown green just before the engine passes it
    const cord = inCar(J, LT_TRAIN.whistle.x - 10, LT_TRAIN.whistle.y + 20);
    press(g, cord.x, cord.y);
    for (let i = 0; i < 60 * 8 && trainNow(g).phase === 'dwell'; i++) step(g, box(J).x, box(J).y);
    tickN(g, 1);
    expect(regionAt(g.player.x, g.player.y)).toBe(TRANSIT);
    const tb = box(TRANSIT);
    let wait = 0;
    while (!(ch.signalAhead().inS < 1.5) && wait++ < 60 * 40) step(g, tb.x, tb.y);
    press(g, tb.x, tb.y);
    expect(ch.lamp()).toBe(2);
    for (let i = 0; i < 300 && ch.stage === LT.Signal; i++) step(g, tb.x, tb.y);
    expect(ch.stage).toBe(LT.Punch);
    expect(trainNow(g).to).toBe(E);
    expect(eOpenOf(g)).toBe(true);
    for (let i = 0; i < 60 * 40 && trainNow(g).phase === 'travel'; i++) step(g, tb.x, tb.y);
    expect([trainNow(g).phase, trainNow(g).at]).toEqual(['dwell', E]);
    // 7 the punch, 8 the passengers, at the End of the Line while the train is in
    dwellAt(g, E);
    press(g, END.barrier.x, END.barrier.y - 40);
    expect(ch.stage).toBe(LT.Passengers);
    for (let k = 0; k < 4; k++) press(g, END.passengers[k].x, END.passengers[k].y + 30);
    expect(ch.stage).toBe(LT.Deliveries);
    // 9 the errands. Ada's letter from her table, to the Junction's post box
    dwellAt(g, J);
    const lt = inCar(J, LT_TRAIN.letter.x, LT_TRAIN.letter.y + 50);
    press(g, lt.x, lt.y);
    expect(ch.letterBy).toBe(0);
    press(g, JUNCTION.postbox.x, JUNCTION.postbox.y + 40);
    expect(ch.tasks & 1).toBe(1);
    // Theo's coal: three shovelfuls from the Works' chute into the tender, then three good stokes on the move
    dwellAt(g, C);
    for (let k = 0; k < 3; k++) {
      press(g, CINDER.chute.x, CINDER.chute.y + 50);
      const fb = inCar(C, LT_TRAIN.firebox.x - 20, LT_TRAIN.firebox.y);
      press(g, fb.x, fb.y);
    }
    expect(ch.coal).toBe(3);
    placeTrain(g, 'travel', C, S, 3);
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
    dwellAt(g, S);
    for (let k = 0; k < 12 && ch.hour !== ch.targetHour; k++) press(g, STILLWATER.church.x, STILLWATER.church.y - 30);
    expect(ch.tasks & 4).toBe(4);
    // Eli's bells: Saint Vesper's three, in tonight's order, while the train is in
    dwellAt(g, V);
    for (const k of ch.bellOrder) press(g, VESPER.ropes[k].x, VESPER.ropes[k].y + 12);
    expect(ch.tasks).toBe(15);
    expect(ch.stage).toBe(LT.LastTicket);
    // 10 the last ticket, at the End of the Line's barrier while a train stands there
    dwellAt(g, E);
    press(g, END.barrier.x, END.barrier.y - 40);
    expect(ch.stage).toBe(LT.Express);
    expect(g.time).toBeLessThan(DAWN_TIME);
    // 11 the Night Express falls… 12 the Conductor comes… 13 the last train home… 14 the true dawn
    g.time = Math.max(g.time, 2040);
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
  }, 180000);

  it("asks for each clock's trouble to be mended first, and lets every lapse be made good", () => {
    const g = gt({ seed: 3 });
    noBosses(g);
    const ch = chainOf(g);
    ch.stage = LT.Stations;
    ch.keyBy = 0;
    ch.clocks = 1;
    // a stopped clock with its trouble unmended won't be wound, key or no key
    dwellAt(g, V);
    press(g, STATION_CLOCK[V].x, STATION_CLOCK[V].y + 40);
    expect(ch.running(V)).toBe(false);
    // a taper burns down: the lamps lit before it went out stay lit, and the next taper goes on from there
    press(g, LT_VESPER.candles.x, LT_VESPER.candles.y + 30);
    const l0 = LT_VESPER.lamps[0];
    press(g, l0.x, l0.y + 20);
    for (let i = 0; i < 60 * (LAST_TRAIN.taper + 1); i++) step(g, l0.x, l0.y + 20);
    expect([ch.tapers, ch.lamps]).toEqual([0, 1]);
    // the vigil slips back while nobody keeps it
    ch.step[V] = 1;
    const vg = LT_VESPER.vigil;
    for (let i = 0; i < 60 * 10; i++) step(g, vg.x, vg.y);
    const kept = ch.vigil;
    expect(kept).toBeGreaterThan(0.25);
    for (let i = 0; i < 60 * 5; i++) step(g, vg.x + 700, vg.y);
    expect(ch.vigil).toBeLessThan(kept);
    // the ladle stops cold when nobody walks with it
    ch.step[C] = 1;
    ch.ladle = 0;
    dwellAt(g, C);
    for (let i = 0; i < 60 * 3; i++) step(g, LT_WORKS.crucible.x + 1200, LT_WORKS.crucible.y);
    expect(ch.ladle).toBe(0);
    for (let i = 0; i < 60 * 3; i++) {
      const l = ch.ladleAt();
      step(g, l.x + 40, l.y + 30);
    }
    expect(ch.ladle).toBeGreaterThan(LAST_TRAIN.ladleSpeed * 2.5);
    // the Junction's clock won't start with the train away
    const h = gt({ seed: 4 });
    noBosses(h);
    const hc = chainOf(h);
    hc.stage = LT.Junction;
    hc.keyBy = 0;
    at(h, 60);
    placeTrain(h, 'travel', J, V, 5);
    press(h, STATION_CLOCK[J].x, STATION_CLOCK[J].y + 40);
    expect(hc.stage).toBe(LT.Junction);
    // a wrong lever puts the frame back; the right order then works (and with the battery still to fit, it waits)
    ch.stage = LT.Prepare;
    ch.leverStep = 0;
    dwellAt(g, J);
    const wrong = [0, 1, 2, 3, 4].find((k) => k !== ch.levers[0])!;
    press(g, JUNCTION.levers.x + 30, JUNCTION.levers.y + (wrong - 2) * 38);
    expect(ch.leverStep).toBe(0);
    for (const k of ch.levers) press(g, JUNCTION.levers.x + 30, JUNCTION.levers.y + (k - 2) * 38);
    expect([ch.leverStep, ch.stage]).toEqual([3, LT.Prepare]);
  }, 120000);
});

describe("the train's signal lamp and the signal at danger (D-84, D-90)", () => {
  it('dark until the battery is fitted, red after; missed, the train runs on as usual; shown green, it goes to the End of the Line', () => {
    const g = gt();
    noBosses(g);
    const ch = chainOf(g);
    ch.stage = LT.Signal;
    expect(ch.lamp()).toBe(0);
    ch.batteryIn = 1;
    expect(ch.lamp()).toBe(1);
    at(g, 200);
    const tb = inCar(TRANSIT, LT_TRAIN.lampbox.x - 20, LT_TRAIN.lampbox.y - 10);
    // out of the Junction, the signal passed at red: the train runs on to Saint Vesper's
    placeTrain(g, 'travel', J, V, 0.5);
    for (let i = 0; i < 60 * 40 && trainNow(g).phase === 'travel'; i++) step(g, tb.x, tb.y);
    expect([trainNow(g).at, ch.stage]).toEqual([V, LT.Signal]);
    // out of Saint Vesper's, green just before it: the points swing over
    placeTrain(g, 'travel', V, C, 0.5);
    let wait = 0;
    while (!(ch.signalAhead().inS < 1.5) && wait++ < 60 * 40) step(g, tb.x, tb.y);
    press(g, tb.x, tb.y);
    expect(ch.lamp()).toBe(2);
    for (let i = 0; i < 300 && ch.stage === LT.Signal; i++) step(g, tb.x, tb.y);
    expect(ch.stage).toBe(LT.Punch);
    expect(trainNow(g).to).toBe(E);
    for (let i = 0; i < 60 * 40 && trainNow(g).phase === 'travel'; i++) step(g, tb.x, tb.y);
    expect(trainNow(g).at).toBe(E);
    // and the End of the Line stays on the line from then on: a train out of Stillwater calls there
    expect(eOpenOf(g)).toBe(true);
    placeTrain(g, 'dwell', S);
    tickN(g, 1);
    expect(trainNow(g).to).toBe(E);
  });
});

describe('the timetable first, shared things, and the crowd kept to its place (D-95)', () => {
  const duo = () => gt({ seed: 21, players: [{ character: 'carny', name: 'A' }, { character: 'strongman', name: 'B' }] } as never);
  const cord = (r: number) => inCar(r, LT_TRAIN.whistle.x - 10, LT_TRAIN.whistle.y + 20);

  it('starts with the stopped clock as well as the booking office', () => {
    const g = gt();
    noBosses(g);
    const ch = chainOf(g);
    at(g, 20);
    expect(ch.stage).toBe(LT.Ticket);
    press(g, STATION_CLOCK[J].x, STATION_CLOCK[J].y + 40);
    expect(ch.stage).toBe(LT.Key);
  });

  it('goes at the whistle whatever the hidden quest has reached (D-98: it gates nothing; D-95 had it wait for the pages)', () => {
    for (const stage of [LT.Ticket, LT.Key, LT.Junction, LT.Pages, LT.Stations]) {
      const g = gt();
      noBosses(g);
      chainOf(g).stage = stage;
      at(g, 60);
      const cues: number[] = [];
      g.bus.on('quest', (q) => q.event === 'gt_whistle' && cues.push(q.a ?? -1));
      press(g, cord(J).x, cord(J).y);
      expect(trainNow(g).departIn).toBeLessThanOrEqual(WHISTLE_LEAD);
      expect(cues).toEqual([WHISTLE.go]);
    }
  });

  it('shares the key, the pendulum and the battery with the whole party', () => {
    const g = duo();
    noBosses(g);
    const ch = chainOf(g);
    at(g, 40);
    ch.stage = LT.Key;
    // A finds the key, B winds the Junction's clock with it
    const k = LT_KEY_SPOTS[ch.keyAt];
    press(g, k.x, k.y + 20, 0);
    expect(ch.keyBy).toBe(0);
    dwellAt(g, J);
    press(g, STATION_CLOCK[J].x, STATION_CLOCK[J].y + 40, 1);
    expect(ch.stage).toBe(LT.Pages);
    // B hangs the pendulum A brought up
    ch.stage = LT.Stations;
    ch.step[S] = 2;
    ch.pendulumBy = 0;
    dwellAt(g, S);
    press(g, STATION_CLOCK[S].x, STATION_CLOCK[S].y + 40, 1);
    expect(ch.step[S]).toBe(3);
    // B fits the battery A carried from the lamp room
    ch.stage = LT.Prepare;
    ch.batteryBy = 0;
    dwellAt(g, J);
    const box = inCar(J, LT_TRAIN.lampbox.x - 20, LT_TRAIN.lampbox.y - 10);
    press(g, box.x, box.y, 1);
    expect(ch.batteryIn).toBe(1);
  });

  it('lets everyone carry a cog of their own, and puts a fallen carrier\'s cog back where it lay', () => {
    const g = duo();
    noBosses(g);
    const ch = chainOf(g);
    at(g, 200);
    ch.stage = LT.Stations;
    ch.clocks = 1;
    dwellAt(g, C);
    const spots = LT_WORKS.scrapSpots.map((sp, k) => ({ sp, k })).filter(({ k }) => ch.scrapAt & (1 << k));
    // park B well away while A picks up, then the other way round
    const park = (who: number) => step(g, LT_WORKS.crucible.x + 900, LT_WORKS.crucible.y - 300, false, who);
    park(1);
    press(g, spots[0].sp.x, spots[0].sp.y + 20, 0);
    park(0);
    press(g, spots[1].sp.x, spots[1].sp.y + 20, 1);
    expect(ch.scrapCarry).toBe(3);
    // both into the crucible
    press(g, LT_WORKS.crucible.x, LT_WORKS.crucible.y + 40, 0);
    press(g, LT_WORKS.crucible.x, LT_WORKS.crucible.y + 40, 1);
    expect([ch.scrapCarry, ch.crucible]).toEqual([0, 2]);
    // the third: A picks it up and falls with it; it lies where it was again
    press(g, spots[2].sp.x, spots[2].sp.y + 20, 0);
    expect(ch.scrapCarry).toBe(1);
    g.players[0].downed = true;
    tickN(g, 2);
    expect(ch.scrapCarry).toBe(0);
    expect(ch.scrapsTaken & (1 << spots[2].k)).toBe(0);
  });

  it("shoves only whoever a Porter's bash lands on", () => {
    const g = gt();
    noBosses(g);
    at(g, 60);
    for (const e of g.active) g.despawnEnemy(e);
    const p = g.player;
    const x0 = 0, y0 = trackY(J) + 700;
    // a bash facing east: the player beside it (out of its cone, well inside four times its size) isn't moved
    p.x = p.px = x0;
    p.y = p.py = y0 + 160;
    g.spawnHazard('sector', 'porter_bash', x0, y0, { r: 110, angle: 0, half: 0.65, tele: 0.01, active: 0.15, dmg: 0, pull: -420 });
    const bx = p.x, by = p.y;
    tickN(g, 12);
    expect(Math.hypot(p.x - bx, p.y - by)).toBeLessThan(2);
    // in front of it, it is shoved off
    p.x = p.px = x0 + 60;
    p.y = p.py = y0;
    g.spawnHazard('sector', 'porter_bash', x0, y0, { r: 110, angle: 0, half: 0.65, tele: 0.01, active: 0.15, dmg: 0, pull: -420 });
    tickN(g, 12);
    expect(p.x - (x0 + 60)).toBeGreaterThan(25);
  });

  it('keeps every creature to its own place: nobody there, it holds still and casts nothing across the world', () => {
    const g = gt({ seed: 5 });
    noBosses(g);
    at(g, 300);
    for (const e of g.active) g.despawnEnemy(e);
    const sx = REGIONS[S].cx + 300, sy = REGIONS[S].cy + 300;
    // (stirred up by the hidden quest at the jetty, as in play: such creatures stay when the party leaves)
    const w = g.spawnEnemy('gt_watcher', sx, sy, { exact: true })!;
    w.spawnT = 9;
    w.leashExempt = true;
    // the only player aboard the moving train
    placeTrain(g, 'travel', C, S, 5);
    const o = trainOrigin(TRANSIT);
    for (let i = 0; i < 60 * 6; i++) {
      g.player.x = g.player.px = o.x + 600;
      g.player.y = g.player.py = o.y;
      tickN(g, 1);
    }
    expect(g.hazards.some((h) => h.alive && h.owner === w.uid)).toBe(false);
    expect([Math.round(w.x), Math.round(w.y)]).toEqual([Math.round(sx), Math.round(sy)]);
    // somebody walks into its station: it stares
    g.player.x = g.player.px = sx + 420;
    g.player.y = g.player.py = sy;
    let gazed = false;
    for (let i = 0; i < 60 * 6 && !gazed; i++) {
      tickN(g, 1);
      gazed = g.hazards.some((h) => h.alive && h.owner === w.uid && h.style === 'gaze');
    }
    expect(gazed).toBe(true);
  });
});

describe('The Last Train Home in co-op (D-80)', () => {
  it('reaches a guest whole, with the train itself, so its doors and train are the host\'s', () => {
    const host = gt({ seed: 8, players: [{ character: 'carny', name: 'Host' }, { character: 'strongman', name: 'Guest' }] } as never);
    noBosses(host);
    const ch = chainOf(host);
    ch.stage = LT.Deliveries;
    ch.eFrom = 731;
    ch.keyBy = 1;
    ch.step = [0, 3, 2, 4];
    ch.lamps = 5;
    ch.ladle = 1234;
    ch.moments = [1, 0.5, 0];
    ch.reel = 0.25;
    ch.pages = 15;
    ch.clocks = 15;
    ch.boarded = 15;
    ch.tasks = 5;
    ch.coal = 2;
    ch.hour = 7;
    ch.batteryBy = 1;
    ch.batteryIn = 1;
    ch.greenT = 2;
    ch.clearedTrip = 9;
    expect(ch.netState().length).toBe(NET_BYTES);
    at(host, 600);
    placeTrain(host, 'travel', S, E, 12);
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
    expect(m.keyBy).toBe(1);
    expect(m.step).toEqual([0, 3, 2, 4]);
    expect(m.lamps).toBe(5);
    expect(m.ladle).toBe(1234);
    expect(m.moments[0]).toBe(1);
    expect(m.moments[1]).toBeCloseTo(0.5, 2);
    expect(m.reel).toBeCloseTo(0.25, 2);
    expect(m.levers).toEqual(ch.levers);
    expect(m.bellOrder).toEqual(ch.bellOrder);
    expect(m.targetHour).toBe(ch.targetHour);
    expect(m.scrapAt).toBe(ch.scrapAt);
    expect(m.keyAt).toBe(ch.keyAt);
    expect(m.tasks).toBe(5);
    expect(m.coal).toBe(2);
    expect(m.hour).toBe(7);
    expect(m.batteryBy).toBe(1);
    expect(m.batteryIn).toBe(1);
    expect(m.greenT).toBeCloseTo(2, 1);
    expect(m.clearedTrip).toBe(9);
    for (let k = 0; k < 5; k++) expect(m.sigAt[k]).toBeCloseTo(ch.sigAt[k], 2);
    // the train: the guest reads the same doors and the same train at every moment from the host's run
    for (const t of [600, 605.5, 610, 630]) {
      host.time = mirror.time = t;
      expect(trainNow(mirror)).toEqual(trainNow(host));
    }
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
