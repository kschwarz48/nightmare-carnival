// The damage meter (D-85): every hit is booked to the player it is credited to, by source — a weapon's line
// (an evolution's is its base weapon's), everything the mirror clones deal is the mirror's and none of it the
// replayed weapon's, a burn's ticks are whoever lit it. The live Lost Tickets count is what the night would pay
// (each player at their own Greed) plus their vouchers. A guest reads it all from the host's 'meter' message.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { WEAPONS } from '../src/data/weapons';
import { ignite, stick, type Enemy } from '../src/sim/entities';
import { NOBODY } from '../src/sim/constants';
import { dps, lineOf, meterState } from '../src/sim/meter';
import { meterFromWire, meterToWire, parseHostMsg } from '../src/net/protocol';
import type { Game } from '../src/sim/game';

/** A ring of enemies around the player that keeps coming back. */
function surround(g: Game, n = 40): void {
  const p = g.player;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const e = g.spawnEnemy('possessed_stuffie', p.x + Math.cos(a) * 160, p.y + Math.sin(a) * 160, { exact: true });
    if (e) e.hp = e.maxHp = 400;
  }
}

/**
 * `id` alone, or with the Funhouse Mirror at Lv 8: the damage by source after ten seconds. Nothing else
 * joins the build (no level-ups, no chests), so the two fights differ only by the mirror.
 */
function fight(id: string, mirror: boolean, seed = 9): Map<string, number> {
  const g = makeGame({ godMode: true, seed });
  g.xpToNext = 1e12;
  g.weapons.list.length = 0;
  g.player.dmgSince.clear();
  g.weapons.add(id);
  for (let i = 0; i < 7; i++) g.weapons.levelUp(id);
  if (mirror) {
    g.weapons.add('mirror');
    for (let i = 0; i < 7; i++) g.weapons.levelUp('mirror');
  }
  for (let i = 0; i < 600; i++) {
    if (i % 120 === 0) surround(g, 24);
    for (const pk of g.pickups) if (pk.alive && pk.kind === 'chest') pk.alive = false;
    g.tick();
  }
  expect(g.weapons.list.map((w) => w.def.id)).toEqual(mirror ? [id, 'mirror'] : [id]);
  return g.player.dmgBy;
}

const spawnAt = (g: Game, x: number, y: number, hp = 1e6): Enemy => {
  const e = g.spawnEnemy('possessed_stuffie', x, y, { exact: true })!;
  e.hp = e.maxHp = hp;
  return e;
};

describe('the damage meter (D-85)', () => {
  it('books each hit to its player by weapon line; an evolution keeps its base weapon\'s line and clock', () => {
    const g = makeGame({ godMode: true });
    expect(g.player.dmgSince.get('throwing_cards')).toBe(0);
    for (let i = 0; i < 300; i++) g.tick();
    g.weapons.add('fireworks');
    expect(g.player.dmgSince.get('fireworks')).toBeCloseTo(g.time, 5);
    surround(g);
    for (let i = 0; i < 600; i++) {
      if (g.phase === 'draft') g.chooseDraft(0);
      g.tick();
    }
    const by = g.player.dmgBy;
    expect(by.get('throwing_cards')).toBeGreaterThan(0);
    // every point of the player's damage is booked to some source
    expect([...by.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(g.player.runDmg, 3);
    const before = by.get('throwing_cards')!;
    const since = g.player.dmgSince.get('throwing_cards');
    g.weapons.get('throwing_cards')!.level = 8;
    g.weapons.evolve('throwing_cards');
    expect(g.weapons.has('royal_flush')).toBe(true);
    surround(g);
    for (let i = 0; i < 300; i++) g.tick();
    expect(by.has('royal_flush')).toBe(false);
    expect(by.get('throwing_cards')!).toBeGreaterThan(before);
    expect(g.player.dmgSince.get('throwing_cards')).toBe(since);
    expect(lineOf('royal_flush')).toBe('throwing_cards');
    expect(lineOf('hall_of_mirrors')).toBe('mirror');
  });

  it('everything the mirror clones deal is the mirror\'s, never the replayed weapon\'s', () => {
    // shots, swings and their scheduled follow-ups, lobbed blasts, shrapnel, burns and stings
    for (const id of ['throwing_cards', 'mallet', 'popcorn', 'darts', 'grill', 'cotton', 'bell']) {
      const alone = fight(id, false), withMirror = fight(id, true);
      const own = alone.get(id) ?? 0, ownWith = withMirror.get(id) ?? 0, clones = withMirror.get('mirror') ?? 0;
      expect(own, id).toBeGreaterThan(0);
      // the mirror adds its share as the mirror's damage...
      expect(clones, id).toBeGreaterThan(own * 0.08);
      // ...and the weapon's own tally doesn't grow with the clones (it was ~15-30% higher with them before D-85)
      expect(ownWith, id).toBeLessThan(own * 1.08);
    }
  });

  it('a clone\'s shot carries the mirror as its source; the player\'s own shots carry none', () => {
    const g = makeGame({ godMode: true, seed: 4 });
    g.weapons.add('popcorn');
    g.weapons.add('mirror');
    for (let i = 0; i < 7; i++) g.weapons.levelUp('mirror');
    surround(g);
    let seenClone = 0, seenOwn = 0;
    for (let i = 0; i < 900; i++) {
      if (g.phase === 'draft') g.chooseDraft(0);
      g.tick();
      for (const p of g.projs) {
        if (!p.alive || (p.weapon !== 'throwing_cards' && p.weapon !== 'popcorn') || p.kind === 'shrapnel') continue;
        if (p.mult < 1) {
          seenClone++;
          expect(p.src).toBe('mirror');
        } else {
          seenOwn++;
          expect(p.src).toBe('');
        }
      }
    }
    expect(seenClone).toBeGreaterThan(0);
    expect(seenOwn).toBeGreaterThan(0);
    // Mira's Glass Halo is the mirror's too
    const m = makeGame({ godMode: true, character: 'mira' });
    surround(m);
    for (let i = 0; i < 600; i++) {
      if (m.phase === 'draft') m.chooseDraft(0);
      m.tick();
    }
    expect(m.player.dmgBy.get('mirror') ?? 0).toBeGreaterThan(0);
  });

  it('a burn\'s and a sting\'s ticks are whoever lit them, with what (not whoever is acting)', () => {
    const g = makeGame({ godMode: true, players: [{ character: 'carny', name: 'A' }, { character: 'strongman', name: 'B' }] });
    const [a, b] = g.players;
    for (const p of g.players) {
      p.weapons.list.length = 0;
      p.dmgBy.clear();
    }
    const e = spawnAt(g, b.x + 400, b.y + 400);
    ignite(e, 4, 60, 'inferno_grill', b.index);
    const f = spawnAt(g, b.x - 400, b.y + 400);
    stick(f, 4, 40, 'cotton', b.index);
    for (let i = 0; i < 120; i++) g.tick();
    expect(b.dmgBy.get('grill') ?? 0).toBeGreaterThan(100);
    expect(b.dmgBy.get('cotton') ?? 0).toBeGreaterThan(60);
    expect(a.dmgBy.size).toBe(0);
    expect(g.weaponDamage.has('burn')).toBe(false);
    // a weaker burn on top keeps the stronger one's owner; once it has gone out, the next one's
    ignite(e, 4, 10, 'grill', a.index);
    expect([e.burnBy, e.burnSrc]).toEqual([b.index, 'inferno_grill']);
    e.burnT = 0;
    ignite(e, 4, 10, 'grill', a.index);
    expect([e.burnBy, e.burnSrc]).toEqual([a.index, 'grill']);
  });

  it('the Blizzard\'s shatter is its owner\'s damage, whoever froze or killed the creature', () => {
    const g = makeGame({ godMode: true, players: [{ character: 'carny', name: 'A' }, { character: 'strongman', name: 'B' }] });
    const [a, b] = g.players;
    g.setCtx(b);
    g.weapons.add('blizzard');
    g.setCtx(a);
    for (const p of g.players) p.dmgBy.clear();
    const x = a.x + 500, y = a.y + 500;
    const frozen = spawnAt(g, x, y, 10);
    const near = spawnAt(g, x + 30, y);
    g.tick(); // (into the grid the blast searches)
    for (const p of g.players) p.dmgBy.clear();
    frozen.frozenT = 2;
    g.damageEnemy(frozen, 50, false, 0, a.x, a.y, 'throwing_cards');
    expect(near.hp).toBeLessThan(1e6);
    expect(b.dmgBy.get('snowcone') ?? 0).toBeGreaterThan(0);
    expect(a.dmgBy.has('snowcone')).toBe(false);
    expect(a.dmgBy.get('throwing_cards') ?? 0).toBeGreaterThan(0);
  });

  it('the night\'s own damage (the Boardwalk\'s coaster) is nobody\'s', () => {
    const g = makeGame({ godMode: true });
    const e = spawnAt(g, g.player.x + 600, g.player.y);
    const dealt = g.damageDealt;
    g.creditTo(NOBODY, () => g.damageEnemy(e, 50, false, 0, 0, 0, 'coaster'));
    expect(g.damageDealt - dealt).toBeCloseTo(50, 5);
    expect(g.player.runDmg).toBe(0);
    expect(g.player.dmgBy.size).toBe(0);
  });

  it('the results list each player\'s own damage by weapon, as their meter showed it', () => {
    const g = makeGame({ godMode: true, players: [{ character: 'carny', name: 'A' }, { character: 'carny', name: 'B' }] });
    surround(g);
    for (let i = 0; i < 900; i++) {
      for (const p of g.players) if (g.draftPending(p.index)) g.chooseDraft(0, p.index);
      g.tick();
    }
    g.endRun(false);
    for (const p of g.players) {
      const st = g.endStatsAll[p.index];
      const cards = st.weapons.find((w) => w.id === 'throwing_cards')!;
      expect(cards.damage).toBe(Math.round(p.dmgBy.get('throwing_cards') ?? 0));
    }
    // both hold the same weapon: neither sees the other's share (the night's tally for the id is both)
    const [x, y] = g.endStatsAll.map((s) => s.weapons.find((w) => w.id === 'throwing_cards')!.damage);
    expect(x + y).toBeCloseTo(g.weaponDamage.get('throwing_cards')!, -1);
  });
});

describe('the live Lost Tickets (D-85)', () => {
  it('counts what the night would pay now, plus the vouchers, and matches the payout when it ends', () => {
    const g = makeGame({ godMode: true });
    expect(g.liveTickets(g.player)).toBe(0);
    for (let i = 0; i < 60 * 90; i++) {
      if (g.phase === 'draft') g.chooseDraft(0);
      g.tick();
    }
    const lt = g.liveTickets(g.player);
    expect(lt).toBeGreaterThan(0);
    const v = g.grantVoucher();
    expect(v).toBeGreaterThan(0);
    expect(g.liveTickets(g.player)).toBe(lt + v);
    const now = g.liveTickets(g.player);
    g.endRun(false);
    expect(g.endStats!.lostTickets + g.player.runVouchers).toBe(now);
  });

  it('pays the win once the final boss is down (a victory lap\'s count)', () => {
    const g = makeGame({ godMode: true });
    for (let i = 0; i < 600; i++) g.tick();
    const before = g.liveTickets(g.player);
    g.ringmasterSlain = true;
    expect(g.liveTickets(g.player)).toBeGreaterThanOrEqual(before + 100);
  });

  it('pays every player at their own Greed', () => {
    const g = makeGame({ godMode: true, meta: [], players: [{ character: 'carny', name: 'A' }, { character: 'strongman', name: 'B', meta: [{ axis: 'greed', value: 0.4 }] }] });
    for (let i = 0; i < 60 * 60; i++) {
      for (const p of g.players) if (g.draftPending(p.index)) g.chooseDraft(0, p.index);
      g.tick();
    }
    const [la, lb] = g.players.map((p) => g.liveTickets(p));
    expect(lb).toBeGreaterThan(la);
    g.endRun(false);
    expect(g.endStatsAll.map((s) => s.lostTickets)).toEqual([la - g.players[0].runVouchers, lb - g.players[1].runVouchers]);
  });
});

describe('the meter on the wire (D-85)', () => {
  it('reaches a guest whole, and a guest reads it in place of its idle mirror\'s numbers', () => {
    const g = makeGame({ godMode: true, players: [{ character: 'carny', name: 'A' }, { character: 'strongman', name: 'B' }] });
    surround(g);
    for (let i = 0; i < 600; i++) {
      for (const p of g.players) if (g.draftPending(p.index)) g.chooseDraft(0, p.index);
      g.tick();
    }
    const state = meterState(g);
    expect(state).toHaveLength(2);
    const raw = JSON.stringify({ t: 'meter', m: meterToWire(state) });
    expect(raw.length).toBeLessThan(2000);
    const msg = parseHostMsg(raw);
    if (msg?.t !== 'meter') throw new Error(`not a meter: ${raw.slice(0, 80)}`);
    const back = meterFromWire(msg.m);
    back.forEach((p, i) => {
      expect(p.lt).toBe(Math.round(state[i].lt));
      for (const l of state[i].lines) {
        const r = p.lines.find((x) => x.key === l.key)!;
        expect(r.dmg).toBe(Math.round(l.dmg));
        expect(r.since).toBeCloseTo(l.since, 1);
      }
    });
    // the guest's mirror: what the host said, not its own (empty) books
    const mirror = makeGame({ players: [{ character: 'carny', name: 'A' }, { character: 'strongman', name: 'B' }] });
    mirror.netMeter = back;
    expect(meterState(mirror)).toBe(back);
  });

  it('refuses a malformed meter', () => {
    const ok = [[12, [['throwing_cards', 100, 0]]]];
    expect(parseHostMsg(JSON.stringify({ t: 'meter', m: ok }))).not.toBeNull();
    const bad = [
      [[12, [['not_a_weapon', 100, 0]]]],
      [[12, [['throwing_cards', -5, 0]]]],
      [[12, [['throwing_cards', 'x', 0]]]],
      [[-1, []]],
      [[1.5, []]],
      Array.from({ length: 7 }, () => [0, []]),
      { a: 1 },
      [[12, Array.from({ length: 40 }, () => ['mallet', 1, 0])]],
    ];
    for (const m of bad) expect(parseHostMsg(JSON.stringify({ t: 'meter', m })), JSON.stringify(m).slice(0, 60)).toBeNull();
  });

  it('per second: since the weapon joined (a few seconds at least)', () => {
    expect(dps(300, 100, 40)).toBeCloseTo(5, 5);
    expect(dps(30, 10, 9)).toBeCloseTo(10, 5);
    expect(Object.keys(WEAPONS).every((id) => lineOf(lineOf(id)) === lineOf(id))).toBe(true);
  });
});
