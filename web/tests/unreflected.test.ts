// The Unreflected (D-63): the Fun House's hidden quest, stage by stage, solo; its seeded per-run
// puzzle state; its fairness (the beam's solution works, every start is unsolved, the clock riddle has
// exactly one answer and one trap); and its co-op sync through the snapshot.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { Game } from '../src/sim/game';
import { UNREFLECTED, beamTrace, mirroredTime } from '../src/data/funhouse';
import { DYNAMIC_WALLS } from '../src/data/map';
import { DAWN_TIME } from '../src/data/waves';
import { UR, clockSpot, type UnreflectedChain } from '../src/sim/quest/unreflected';
import { SnapshotEncoder, decodeSnapshot, type View } from '../src/net/snapshot';
import { Replica } from '../src/net/replica';
import { StringDict } from '../src/net/codec';
import type { BossBase } from '../src/sim/bosses/boss';

const U = UNREFLECTED;
const fh = (o: Parameters<typeof makeGame>[0] = {}) => makeGame({ map: 'fun_house', godMode: true, seed: 31, ...o });
const chainOf = (g: Game) => g.quests.get<UnreflectedChain>('unreflected')!;

/** Stand player 0 at (x, y) for `sec` seconds (re-placed every tick; drafts auto-picked; the crowd kept away). */
function stand(g: Game, x: number, y: number, sec: number): void {
  for (let i = 0; i < Math.round(sec * 60); i++) {
    if (g.phase === 'draft') g.chooseDraft(0);
    const p = g.player;
    p.x = p.px = x;
    p.y = p.py = y;
    for (const e of g.active) if (e.alive && Math.hypot(e.x - x, e.y - y) < 300) g.despawnEnemy(e);
    g.tick();
  }
}

function hitBoss(g: Game, b: BossBase): void {
  let guard = 0;
  while (!b.dead && guard++ < 8000) {
    for (const p of b.parts.filter((q) => q.alive && !q.invuln && q.kind === 'body')) g.damageTarget(p, b.maxHp * 0.01, false, 0, 0, 0, 'test');
    if (g.phase === 'draft') g.chooseDraft(0);
    g.tick();
  }
}

describe('the clock riddle and the beam (D-63)', () => {
  it('mirrors a clock face left to right', () => {
    expect(mirroredTime(2, 50)).toEqual([9, 10]);
    expect(mirroredTime(3, 0)).toEqual([9, 0]);
    expect(mirroredTime(12, 30)).toEqual([11, 30]);
    expect(mirroredTime(6, 0)).toEqual([6, 0]);
    for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m += 5) expect(mirroredTime(...mirroredTime(h, m))).toEqual([h, m]);
  });

  it('the documented pivot solution leads the beam to the crystal; edge-on mirrors stop it', () => {
    const solved = beamTrace(U.beamSolution);
    expect(solved.hit).toBe(true);
    const end = solved.pts[solved.pts.length - 1];
    expect(end).toEqual({ x: U.crystal.x, y: U.crystal.y });
    // projector, four turns, the crystal
    expect(solved.pts.length).toBe(6);
    expect(beamTrace([0, 3, 1, 3]).hit).toBe(false);
    expect(beamTrace([3, 3, 1, 1]).hit).toBe(false);
  });

  it('every seed starts unsolved, with one true clock, its mirror image as the trap, and a fresh bow order', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const ch = chainOf(fh({ seed }));
      expect(beamTrace(ch.pivots).hit).toBe(false);
      ch.pivots.forEach((s, i) => expect(s).not.toBe(U.beamSolution[i]));
      expect([...ch.order].sort()).toEqual([0, 1, 2, 3]);
      orders.add(ch.order.join(''));
      const t = ch.times[ch.trueClock];
      const mt = mirroredTime(t[0], t[1]);
      expect(mt).not.toEqual(t);
      expect(ch.vanityTime).toEqual(mt);
      const asKeys = ch.times.map((x) => x.join(':'));
      expect(new Set(asKeys).size).toBe(4);
      expect(asKeys.filter((k) => k === mt.join(':')).length).toBe(1);
      expect(asKeys.filter((k) => k === t.join(':')).length).toBe(1);
    }
    expect(orders.size).toBeGreaterThan(8);
  });
});

describe('the Unreflected, solved solo from the counter to the True Dawn (D-63)', () => {
  it('walks every stage in order', () => {
    const g = fh();
    const ch = chainOf(g);
    const cues: string[] = [];
    g.bus.on('quest', (q) => q.chain === 'unreflected' && cues.push(q.event));
    expect(ch.stage).toBe(UR.Dormant);
    stand(g, 0, 1400, 0.5);
    expect(ch.stage).toBe(UR.Dormant);
    // 1: the hand mirror
    stand(g, U.counter.x, U.counter.y + 70, 0.3);
    expect(ch.stage).toBe(UR.Faces);
    // 2: the four faces (any order)
    for (const i of [2, 0, 3, 1]) stand(g, U.faces[i].x, U.faces[i].y, 0.3);
    expect(ch.freed).toBe(15);
    expect(ch.stage).toBe(UR.Mural);
    // 3: the mural, from the footprints (stepping off resets the hold)
    stand(g, U.mark.x, U.mark.y, 1.2);
    stand(g, U.mark.x + 300, U.mark.y, 0.3);
    stand(g, U.mark.x, U.mark.y, 1.2);
    expect(ch.stage).toBe(UR.Mural);
    stand(g, U.mark.x, U.mark.y, 1.0);
    expect(ch.stage).toBe(UR.Overture);
    expect(ch.muralSeen).toBe(true);
    // 4: the overture: a wrong plinth stops the music box, then the true order
    const away = (j: number) => stand(g, U.plinths[j].x, U.plinths[j].y + 260, 0.2);
    const wrong = [0, 1, 2, 3].find((j) => j !== ch.order[0])!;
    stand(g, U.plinths[ch.order[0]].x, U.plinths[ch.order[0]].y + 70, 0.2);
    away(ch.order[0]);
    stand(g, U.plinths[wrong === ch.order[1] ? ch.order[2] : wrong].x, U.plinths[0].y + 70, 0.2);
    expect(cues).toContain('u_sour');
    expect(ch.progress).toBe(0);
    for (const j of ch.order) {
      away(j);
      stand(g, U.plinths[j].x, U.plinths[j].y + 70, 0.2);
    }
    expect(ch.stage).toBe(UR.Projector);
    // 5: the projector warms only while someone stays (and cools when left)
    stand(g, U.projector.x, U.projector.y + 90, 12);
    const warm = ch.charge;
    expect(warm).toBeGreaterThan(11);
    stand(g, U.projector.x + 700, U.projector.y + 200, 4);
    expect(ch.charge).toBeLessThan(warm);
    stand(g, U.projector.x, U.projector.y + 90, U.charge - ch.charge + 0.5);
    expect(ch.stage).toBe(UR.Beam);
    // 6: the beam: turn each pivot to its solution by standing on its plate
    expect(DYNAMIC_WALLS.some((w) => w.style === 'door')).toBe(true);
    U.beamPivots.forEach((pv, i) => {
      for (let guard = 0; guard < 6 && ch.pivots[i] !== U.beamSolution[i]; guard++) stand(g, pv.x, pv.y + 50, U.pivotStep + 0.05);
      stand(g, pv.x + 200, pv.y, 0.1);
    });
    expect(beamTrace(ch.pivots).hit).toBe(true);
    expect(ch.stage).toBe(UR.Vanity);
    expect(g.funhouseDoorOpen).toBe(true);
    stand(g, 0, 1400, 0.1);
    expect(DYNAMIC_WALLS.some((w) => w.style === 'door')).toBe(false);
    // 7: the vanity, a wrong clock (the house laughs), then the true one
    stand(g, U.vanity.x, U.vanity.y + 60, 0.3);
    expect(ch.vanitySeen).toBe(true);
    const wrongClock = [0, 1, 2, 3].find((k) => k !== ch.trueClock)!;
    const ws = clockSpot(wrongClock);
    stand(g, ws.x, ws.y, U.clockHold + 0.2);
    expect(cues).toContain('u_wrong_clock');
    expect(ch.stage).toBe(UR.Vanity);
    const ts = clockSpot(ch.trueClock);
    stand(g, ts.x, ts.y, U.clockHold + 0.2);
    expect(ch.stage).toBe(UR.Carrying);
    expect(ch.carrier).toBe(0);
    // 8: the Proprietor falls while Mira follows: the house shatters instead of the dawn
    g.registerBossDefeat('proprietor', false);
    expect(ch.stage).toBe(UR.Finale);
    expect(g.finaleActive).toBe(true);
    expect(g.ringmasterDefeated).toBe(false);
    stand(g, 0, 0, U.finaleDelay + 0.5);
    const boss = g.bosses.find((b) => b.def.id === 'unreflected');
    expect(boss).toBeTruthy();
    // 9: the Unreflected falls → the True Dawn
    stand(g, 0, 300, 3);
    hitBoss(g, boss!);
    stand(g, 0, 300, 5); // its death scene, then the defeat lands
    expect(ch.stage).toBe(UR.Complete);
    expect(g.trueEnding).toBe(true);
    expect(g.achievementsHit.has('unreflected')).toBe(true);
    expect(g.time).toBeGreaterThanOrEqual(DAWN_TIME);
    expect(cues).toEqual(expect.arrayContaining(['u_awaken', 'u_face', 'u_faces_done', 'u_mural', 'u_note', 'u_overture', 'u_beam', 'u_pivot', 'u_door', 'u_vanity', 'u_mira', 'u_finale', 'u_rises', 'u_complete']));
  });

  it('without Mira, the Proprietor\'s fall is an ordinary dawn', () => {
    const g = fh();
    g.registerBossDefeat('proprietor', false);
    expect(chainOf(g).stage).toBe(UR.Dormant);
    expect(g.ringmasterDefeated).toBe(true);
    expect(g.finaleActive).toBe(false);
  });

  it('the Carnival Core has no Unreflected chain, and the Fun House no Last Song', () => {
    expect(makeGame({ seed: 4 }).quests.get('unreflected')).toBeUndefined();
    expect(fh().quests.get('last_song')).toBeUndefined();
  });
});

describe('the Unreflected in co-op (D-63)', () => {
  it('any player can act, Mira passes on if her carrier falls, and guests mirror the whole chain', () => {
    const host = fh({ seed: 8, players: [{ character: 'carny', name: 'Host' }, { character: 'strongman', name: 'Guest' }] });
    const ch = chainOf(host);
    // the guest (player 1) picks up the mirror alone
    const p1 = host.players[1];
    for (let i = 0; i < 20; i++) {
      p1.x = p1.px = U.counter.x;
      p1.y = p1.py = U.counter.y + 70;
      host.player.x = host.player.px = 1500;
      host.player.y = host.player.py = 1500;
      host.tick();
    }
    expect(ch.stage).toBe(UR.Faces);
    // jump the chain to Carrying with player 1 as carrier, then down player 1
    ch.stage = UR.Carrying;
    ch.carrier = 1;
    p1.downed = true;
    host.tick();
    expect(ch.carrier).toBe(0);
    p1.downed = false;
    ch.pivots = [1, 2, 3, 0];
    ch.freed = 5;
    ch.charge = 17.5;
    // the snapshot carries it all to a guest's mirror
    const mirror = new Game({ ...host.cfg, godMode: false });
    const rep = new Replica(mirror, 1);
    const enc = new SnapshotEncoder();
    const dict = new StringDict();
    const view: View = { x: 0, y: 0, hx: 5000, hy: 5000 };
    const buf = enc.encode(host, { seq: 1, ackInput: 0, ackSnap: 0, dict, dictFrom: 0, view, fx: [], sfx: [] });
    rep.apply(decodeSnapshot(buf, rep.dict), 0);
    const m = chainOf(mirror);
    expect(m.stage).toBe(UR.Carrying);
    expect(m.carrier).toBe(0);
    expect(m.pivots).toEqual([1, 2, 3, 0]);
    expect(m.freed).toBe(5);
    expect(m.order).toEqual(ch.order);
    expect(m.times).toEqual(ch.times);
    expect(m.trueClock).toBe(ch.trueClock);
    expect(m.charge).toBeCloseTo(17.5, 0);
  });
});
