// Summer's End (D-68): the Boardwalk's hidden quest played through stage by stage, solo; its seeded
// per-run puzzles (one keepsake per game, portholes that start unsolved, a call sign that isn't all one
// kind); its fairness (misses can be retried, the Leviathan can't die before the bell binds it); and its
// co-op sync through the snapshot.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { Game } from '../src/sim/game';
import { KEEPSAKE_GAME, SUMMERS_END, isLowTide, trainU, wheelFromBottom } from '../src/data/boardwalk';
import { BOARDWALK_BOSSES } from '../src/data/bosses';
import { DAWN_TIME } from '../src/data/waves';
import { SE, type SummersEndChain } from '../src/sim/quest/summersEnd';
import { createBoss } from '../src/sim/bosses';
import type { BossBase } from '../src/sim/bosses/boss';
import type { LeviathanBoss } from '../src/sim/bosses/leviathan';
import { SnapshotEncoder, decodeSnapshot, type View } from '../src/net/snapshot';
import { Replica } from '../src/net/replica';
import { StringDict } from '../src/net/codec';

const S = SUMMERS_END;
const bw = (o: Parameters<typeof makeGame>[0] = {}) => {
  const g = makeGame({ map: 'boardwalk', godMode: true, seed: 31, ...o });
  // keep the scheduled bosses out of the way while the quest is walked through
  for (const b of BOARDWALK_BOSSES) g.director['spawned'].add(b.id), g.director['warned'].add(b.id);
  return g;
};
const chainOf = (g: Game) => g.quests.get<SummersEndChain>('summers_end')!;

/** One tick with player `who` held at (x, y), the crowd near them cleared, drafts auto-picked. */
function step(g: Game, x: number, y: number, who = 0, press = false): void {
  if (g.phase === 'draft') g.chooseDraft(0);
  const p = g.players[who];
  p.x = p.px = x;
  p.y = p.py = y;
  for (const e of g.active) if (e.alive && e.def.id !== 'tin_duck' && Math.hypot(e.x - x, e.y - y) < 320) g.despawnEnemy(e);
  if (press) g.inputs[who].interact = true;
  g.tick();
}

function stand(g: Game, x: number, y: number, sec: number, who = 0): void {
  for (let i = 0; i < Math.round(sec * 60); i++) step(g, x, y, who);
}

/** Stand at (x, y) until `when` holds (at most `max` seconds), then press interact once. */
function pressWhen(g: Game, x: number, y: number, when: () => boolean = () => true, who = 0, max = 200): void {
  for (let i = 0; i < 20; i++) step(g, x, y, who);
  for (let i = 0; i < max * 60 && !when(); i++) step(g, x, y, who);
  step(g, x, y, who, true);
  for (let i = 0; i < 10; i++) step(g, x, y, who);
}

function hitBoss(g: Game, b: BossBase): void {
  let guard = 0;
  while (!b.dead && guard++ < 8000) {
    for (const p of b.parts.filter((q) => q.alive && !q.invuln && q.kind === 'body')) g.damageTarget(p, b.maxHp * 0.01, false, 0, 0, 0, 'test');
    if (g.phase === 'draft') g.chooseDraft(0);
    g.tick();
  }
}

describe("Summer's End: the night's puzzles (D-68)", () => {
  it('every seed picks one keepsake per game, unsolved portholes and a mixed call sign', () => {
    const conches = new Set<number>(), signs = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const ch = chainOf(bw({ seed }));
      const games = [0, 1, 2, 3].map((gm) => KEEPSAKE_GAME.filter((owner, i) => owner === gm && ch.keepsakes & (1 << i)).length);
      expect(games).toEqual([1, 1, 1, 1]);
      ch.holes.forEach((h, k) => expect(h).not.toBe(ch.engraved[k]));
      expect([...ch.engraved].sort()).toEqual([0, 1, 2, 3]);
      expect(ch.callSign).toBeGreaterThan(0);
      expect(ch.callSign).toBeLessThan(15);
      conches.add(ch.conch);
      signs.add(ch.callSign);
    }
    expect(conches.size).toBeGreaterThan(1);
    expect(signs.size).toBeGreaterThan(3);
  });
});

describe("Summer's End: Madame Marina before the first step (D-69)", () => {
  it('tells how the night begins, plainer each time she is asked, without starting the quest', () => {
    const g = bw();
    const ch = chainOf(g);
    const hints: number[] = [];
    g.bus.on('quest', (q) => q.chain === 'summers_end' && q.event === 'se_hint' && hints.push(q.a ?? -1));
    expect(ch.interaction(S.marina.x, S.marina.y)?.label).toBe('Ask Madame Marina');
    for (let k = 0; k < 4; k++) {
      pressWhen(g, S.marina.x, S.marina.y);
      stand(g, S.marina.x, S.marina.y, 3);
    }
    expect(hints).toEqual([0, 1, 2, 2]);
    expect(ch.stage).toBe(SE.Conch);
    // once the conch is found she reads the photograph's fortune as before
    pressWhen(g, ch.conchSpot().x, ch.conchSpot().y, () => isLowTide(g.time));
    expect(ch.stage).toBe(SE.Marina);
    pressWhen(g, S.marina.x, S.marina.y);
    expect(ch.stage).toBe(SE.Photograph);
  });
});

describe("Summer's End, solo (D-68)", () => {
  it('runs from the conch to the True Dawn', () => {
    const g = bw();
    g.weapons.list.length = 0;
    const ch = chainOf(g);
    const cues: string[] = [];
    g.bus.on('quest', (q) => q.chain === 'summers_end' && cues.push(q.event));
    // 0: the conch only shows at low tide
    const c = ch.conchSpot();
    for (let i = 0; i < 400 && isLowTide(g.time); i++) step(g, c.x, c.y - 20);
    step(g, c.x, c.y - 20, 0, true);
    expect(ch.stage).toBe(SE.Conch);
    pressWhen(g, c.x, c.y - 20, () => isLowTide(g.time));
    expect(ch.stage).toBe(SE.Marina);
    // 1: Madame Marina
    pressWhen(g, S.marina.x, S.marina.y);
    expect(ch.stage).toBe(SE.Photograph);
    // 2: the photograph, then the four souvenirs that are hers (a look-alike is refused)
    pressWhen(g, S.photo.x, S.photo.y);
    expect(ch.photoSeen).toBe(true);
    const wrong = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !(ch.keepsakes & (1 << i)))!;
    pressWhen(g, S.shelf[wrong][0], S.shelf[wrong][1]);
    expect(ch.taken).toBe(0);
    for (let i = 0; i < 8; i++) if (ch.keepsakes & (1 << i)) pressWhen(g, S.shelf[i][0], S.shelf[i][1]);
    expect(ch.stage).toBe(SE.Games);
    // 3a: the shooting gallery: knock down all six ducks in time
    pressWhen(g, S.gallery.x, S.gallery.y);
    expect(ch.galleryT).toBeGreaterThan(0);
    const ducks = g.active.filter((e) => e.alive && e.def.id === 'tin_duck');
    expect(ducks.length).toBe(S.galleryDucks);
    for (const d of ducks) g.damageEnemy(d, 1e6, false, 0, d.x, d.y, 'test');
    expect(ch.won & 1).toBe(1);
    // 3b: the Crane: a drop at the wrong moment misses, the right one wins
    const aligned = () => {
      const off = (((g.time / S.crane.period) % 0.5) + 0.5) % 0.5;
      return off < S.crane.window * 0.5 || off > 0.5 - S.crane.window * 0.5;
    };
    pressWhen(g, S.crane.x, S.crane.y, () => !aligned() && Math.abs((((g.time / S.crane.period) % 0.5) + 0.5) % 0.5 - 0.25) < 0.05);
    expect(ch.won & 2).toBe(0);
    stand(g, S.crane.x, S.crane.y, 1.8);
    pressWhen(g, S.crane.x, S.crane.y, aligned);
    expect(ch.won & 2).toBe(2);
    // 3c: the Sea Wheel's green-lantern car, as it comes down to the platform
    pressWhen(g, S.wheel.x, S.wheel.y, () => wheelFromBottom(ch.greenCar, g.time) < S.wheel.window * 0.5, 0, 100);
    expect(ch.won & 4).toBe(4);
    // 3d: the Undertow, braked as it comes home
    pressWhen(g, S.brake.x, S.brake.y, () => {
      const t = trainU(g.time);
      return !t.dwelling && t.u > S.brake.u0 + 0.01 && t.u < 0.995;
    }, 0, 100);
    expect(ch.won).toBe(15);
    expect(ch.stage).toBe(SE.Wreck);
    // 4: the wreck at low tide: turn each porthole until it shows its engraving
    for (let k = 0; k < 4; k++) {
      while (ch.holes[k] !== ch.engraved[k]) {
        const before = ch.holes[k];
        pressWhen(g, S.portholes[k].x, S.portholes[k].y, () => isLowTide(g.time) && Math.sin((g.time / 75) * Math.PI * 2) < -0.6);
        expect(ch.holes[k]).toBe((before + 1) % 4);
      }
    }
    expect(ch.stage).toBe(SE.Key);
    // 5: the rod, a cast, a pull too early (it gets away), a cast, the bite, the pull
    pressWhen(g, S.rod.x, S.rod.y);
    expect(ch.rodBy).toBe(0);
    pressWhen(g, S.fishing.x, S.fishing.y);
    expect(ch.cast).toBe(1);
    pressWhen(g, S.fishing.x, S.fishing.y);
    expect(ch.cast).toBe(0);
    pressWhen(g, S.fishing.x, S.fishing.y);
    pressWhen(g, S.fishing.x, S.fishing.y, () => ch.cast === 2, 0, 8);
    expect(ch.stage).toBe(SE.Foghorn);
    // 6: the foghorn: a wrong answer resets; the call sign answered right moors the ship
    pressWhen(g, S.foghorn.x, S.foghorn.y);
    const wrongChain = (ch.callSign & 1) ? S.short : S.long;
    pressWhen(g, wrongChain.x, wrongChain.y);
    expect(ch.heard).toBe(0);
    for (let k = 0; k < ch.callLen; k++) {
      const at = (ch.callSign >> k) & 1 ? S.long : S.short;
      pressWhen(g, at.x, at.y);
    }
    expect(ch.stage).toBe(SE.GalaQueen);
    // 7: St. Elmo's fire to the four tide lamps
    pressWhen(g, S.berth.x, S.berth.y);
    expect(ch.fireBy).toBe(0);
    for (const L of S.lamps) pressWhen(g, L.x, L.y);
    expect(ch.stage).toBe(SE.LowWater);
    // 8: the sea goes out
    stand(g, 0, -470, S.retreatTime + 0.5);
    expect(ch.retreat).toBe(1);
    expect(ch.stage).toBe(SE.Bell);
    // 9: stay with the bell while it is winched up
    stand(g, S.bell.x, S.bell.y, S.bell.hold + 1);
    expect(ch.stage).toBe(SE.Ledger);
    // 10: the ledger
    pressWhen(g, S.cabinet.x, S.cabinet.y);
    expect(ch.stage).toBe(SE.Account);
    expect(ch.bellBy).toBe(0);
    // 11: the Leviathan rises; while the account is open it will not die
    const lev = createBoss(g, BOARDWALK_BOSSES[3], { immediate: true }) as LeviathanBoss;
    g.bosses.push(lev);
    stand(g, lev.x, lev.y - 400, 4);
    for (let i = 0; i < 200 && !lev.dead; i++) {
      for (const p of lev.parts.filter((q) => q.alive && !q.invuln && q.kind === 'body')) g.damageTarget(p, lev.maxHp * 0.05, false, 0, 0, 0, 'test');
      step(g, lev.x, lev.y - 400);
    }
    expect(lev.dead).toBe(false);
    expect(lev.hp).toBeGreaterThan(0);
    // three strokes of the bell while its head is up
    for (let k = 0; k < 3; k++) {
      pressWhen(g, lev.x, lev.y - 400, () => lev.headUp, 0, 30);
      stand(g, lev.x, lev.y - 400, S.strikeCool + 0.1);
    }
    expect(ch.strikes).toBe(3);
    stand(g, lev.x, lev.y - 400, 4);
    expect(lev.dead).toBe(true);
    expect(ch.stage).toBe(SE.Finale);
    expect(g.finaleActive).toBe(true);
    // 12: the Commodore comes up the boards
    stand(g, 0, -470, S.finaleDelay + 0.5);
    const cm = g.bosses.find((b) => b.def.id === 'commodore');
    expect(cm).toBeTruthy();
    stand(g, 0, -470, 3);
    hitBoss(g, cm!);
    stand(g, 0, -470, 5);
    // 13: the True Dawn
    expect(ch.stage).toBe(SE.Complete);
    expect(g.trueEnding).toBe(true);
    expect(g.achievementsHit.has('summers_end')).toBe(true);
    expect(g.time).toBeGreaterThanOrEqual(DAWN_TIME);
    expect(cues).toEqual(expect.arrayContaining(['se_conch', 'se_marina', 'se_photo', 'se_shelf_false', 'se_shelf', 'se_games', 'se_gallery', 'se_duck', 'se_won', 'se_miss', 'se_wreck',
      'se_porthole', 'se_wreck_done', 'se_rod', 'se_cast', 'se_missed', 'se_bite', 'se_key', 'se_call', 'se_wrong_call', 'se_chain', 'se_moored', 'se_fire', 'se_lamp', 'se_low_water',
      'se_bell_seen', 'se_bell_up', 'se_ledger', 'se_strike', 'se_bound', 'se_finale', 'se_rises', 'se_complete']));
  });

  it('the shooting gallery can be lost and played again', () => {
    const g = bw({ seed: 9 });
    const ch = chainOf(g);
    ch.stage = SE.Games;
    pressWhen(g, S.gallery.x, S.gallery.y);
    stand(g, S.gallery.x, S.gallery.y, S.galleryTime + 1);
    expect(ch.galleryT).toBe(-1);
    expect(ch.won & 1).toBe(0);
    expect(g.active.filter((e) => e.alive && e.def.id === 'tin_duck').length).toBe(0);
    pressWhen(g, S.gallery.x, S.gallery.y);
    expect(ch.galleryT).toBeGreaterThan(0);
  });

  it('the fire can burn out without losing a lamp, and is there to take again', () => {
    const g = bw({ seed: 9 });
    const ch = chainOf(g);
    ch.stage = SE.GalaQueen;
    pressWhen(g, S.berth.x, S.berth.y);
    pressWhen(g, S.lamps[0].x, S.lamps[0].y);
    expect(ch.lit).toBe(1);
    stand(g, 0, -470, S.fireTime + 1);
    expect(ch.fireBy).toBe(255);
    expect(ch.lit).toBe(1);
    pressWhen(g, S.berth.x, S.berth.y);
    expect(ch.fireBy).toBe(0);
  });

  it('without the bell, the Leviathan\'s fall is an ordinary dawn', () => {
    const g = bw();
    g.registerBossDefeat('leviathan', false);
    expect(chainOf(g).stage).toBe(SE.Conch);
    expect(g.ringmasterDefeated).toBe(true);
    expect(g.finaleActive).toBe(false);
  });

  it('the other maps have no Summer\'s End', () => {
    expect(makeGame({ seed: 4 }).quests.get('summers_end')).toBeUndefined();
    expect(makeGame({ seed: 4, map: 'fun_house' }).quests.get('summers_end')).toBeUndefined();
  });
});

describe("Summer's End in co-op (D-68)", () => {
  it('any player can act, carried things pass on when a carrier falls, and guests mirror the chain', () => {
    const host = bw({ seed: 8, players: [{ character: 'carny', name: 'Host' }, { character: 'strongman', name: 'Guest' }] });
    const ch = chainOf(host);
    // the guest (player 1) takes the ledger alone; the bell follows them
    ch.stage = SE.Ledger;
    host.player.x = host.player.px = 0;
    host.player.y = host.player.py = -470;
    pressWhen(host, S.cabinet.x, S.cabinet.y, () => true, 1);
    expect(ch.stage).toBe(SE.Account);
    expect(ch.bellBy).toBe(1);
    host.players[1].downed = true;
    host.tick();
    expect(ch.bellBy).toBe(0);
    host.players[1].downed = false;
    ch.retreat = 0.6;
    ch.won = 5;
    ch.lit = 3;
    // the snapshot carries it all to a guest's mirror
    const mirror = new Game({ ...host.cfg, godMode: false });
    const rep = new Replica(mirror, 1);
    const enc = new SnapshotEncoder();
    const dict = new StringDict();
    const view: View = { x: 0, y: 0, hx: 5000, hy: 5000 };
    const buf = enc.encode(host, { seq: 1, ackInput: 0, ackSnap: 0, dict, dictFrom: 0, view, fx: [], sfx: [] });
    rep.apply(decodeSnapshot(buf, rep.dict), 0);
    const m = chainOf(mirror);
    expect(m.stage).toBe(SE.Account);
    expect(m.bellBy).toBe(0);
    expect(m.keepsakes).toBe(ch.keepsakes);
    expect(m.engraved).toEqual(ch.engraved);
    expect(m.holes).toEqual(ch.holes);
    expect(m.callSign).toBe(ch.callSign);
    expect(m.greenCar).toBe(ch.greenCar);
    expect(m.won).toBe(5);
    expect(m.lit).toBe(3);
    expect(m.retreat).toBeCloseTo(0.6, 2);
  });
});
