// Co-op simulation (D-51): two independently controlled players in one authoritative Game, with
// Vampire Survivors rules — shared XP, a draft for each player with the night paused until both have
// chosen, party-sized slots, exclusive items, team evolutions, coffin revives, split chests.

import { describe, expect, it } from 'vitest';
import { makeGame, runFor } from './helpers';
import { COOP } from '../src/data/progression';
import { WEAPONS } from '../src/data/weapons';
import { generateDraft, readyEvolutions } from '../src/sim/draft';
import { TICK } from '../src/sim/constants';

const duo = (o: Parameters<typeof makeGame>[0] = {}) =>
  makeGame({ players: [{ character: 'carny', name: 'Kevin' }, { character: 'strongman', name: 'Brother' }], ...o });

describe('co-op party', () => {
  it('builds two players with their own arsenals, VS slot counts and a shared level', () => {
    const g = duo();
    expect(g.players.length).toBe(2);
    expect(g.players[0].weapons).not.toBe(g.players[1].weapons);
    expect(g.players[0].weapons.has('throwing_cards')).toBe(true);
    expect(g.players[1].weapons.has('mallet')).toBe(true);
    expect(g.players[1].weapons.has('throwing_cards')).toBe(false);
    expect(g.slots).toEqual({ weapons: COOP.slots[2], passives: COOP.slots[2] });
    expect(COOP.slots[2]).toBe(4);
    expect(makeGame().slots.weapons).toBe(6);
    expect(g.player).toBe(g.players[0]); // context rests on player 0 between ticks
  });

  it('shares XP: the second player collecting tickets levels the whole party', () => {
    const g = duo({ godMode: true });
    const p1 = g.players[1];
    const before = g.level;
    for (let i = 0; i < 6; i++) g.spawnPickup('ticket', p1.x + 4, p1.y, 3);
    for (let i = 0; i < 30 && g.phase === 'play'; i++) g.tick();
    expect(g.level).toBeGreaterThan(before);
  });

  it('pauses on a level-up until every player has chosen', () => {
    const g = duo({ godMode: true });
    g.addXp(g.xpToNext + 0.01);
    expect(g.phase).toBe('draft');
    expect(g.drafts[0]?.length).toBeGreaterThan(0);
    expect(g.drafts[1]?.length).toBeGreaterThan(0);
    const t0 = g.time;
    g.chooseDraft(0, 0);
    expect(g.phase).toBe('draft'); // still waiting on player 2
    g.tick();
    expect(g.time).toBe(t0); // the night stays frozen
    g.chooseDraft(0, 1);
    expect(g.phase).toBe('play');
  });

  it('keeps items exclusive: what one player owns never appears in the other’s draft', () => {
    const g = duo({ godMode: true });
    g.weapons.add('fireworks');
    g.player.addPassive('spectacles');
    g.setCtx(g.players[1]);
    for (let k = 0; k < 120; k++) {
      for (const o of generateDraft(g)) {
        expect(o.refId).not.toBe('fireworks');
        expect(o.refId).not.toBe('throwing_cards');
        if (o.kind === 'passive') expect(o.refId).not.toBe('spectacles');
      }
    }
    g.setCtx(g.players[0]);
  });

  it('lets an evolution use a teammate’s passive', () => {
    const g = duo({ godMode: true });
    const mallet = WEAPONS.mallet;
    g.setCtx(g.players[1]);
    for (let i = 0; i < 10; i++) g.weapons.levelUp('mallet');
    expect(readyEvolutions(g)).toEqual([]);
    g.players[0].addPassive(mallet.evoPassive!);
    expect(readyEvolutions(g)).toEqual(['mallet']);
    g.setCtx(g.players[0]);
  });

  it('sends each enemy after the nearest standing player', () => {
    const g = duo({ godMode: true });
    const [p0, p1] = g.players;
    p0.x = -900;
    p0.y = 0;
    p1.x = 900;
    p1.y = 0;
    const e = g.spawnEnemy('possessed_stuffie', 760, 0)!;
    const x0 = e.x;
    for (let i = 0; i < 40; i++) g.tick();
    expect(e.x).toBeGreaterThan(x0); // walked toward player 2, not back toward player 1
  });

  it('heals only the player who picks up the food', () => {
    const g = duo({ godMode: true });
    const [p0, p1] = g.players;
    p0.hp = 30;
    p1.hp = 30;
    g.spawnPickup('food', p1.x, p1.y, 0);
    for (let i = 0; i < 5; i++) g.tick();
    expect(p1.hp).toBeGreaterThan(30);
    expect(p0.hp).toBe(30);
  });

  it('a fallen player lies in a coffin; a teammate beside it revives them; both down ends the night', () => {
    const g = duo();
    const [p0, p1] = g.players;
    p1.stats.revives = 0;
    p1.iframes = 0;
    g.setCtx(p1);
    g.hurtPlayer(9999, p1.x, p1.y, { ignoreIframes: true });
    g.setCtx(p0);
    expect(p1.downed).toBe(true);
    expect(g.phase).toBe('play');
    p0.x = p1.x + 20;
    p0.y = p1.y;
    p0.iframes = 99;
    const ticks = Math.ceil((COOP.reviveAssisted + 0.5) / TICK);
    for (let i = 0; i < ticks && p1.downed; i++) {
      p0.x = p1.x + 20;
      p0.y = p1.y;
      g.tick();
    }
    expect(p1.downed).toBe(false);
    expect(p1.hp).toBeGreaterThan(0);
    // now both fall
    for (const p of [p1, p0]) {
      p.stats.revives = 0;
      p.iframes = 0;
      p.dashT = 0;
      p.shieldReady = false;
      g.setCtx(p);
      g.hurtPlayer(9999, p.x, p.y, { ignoreIframes: true });
    }
    expect(g.phase).toBe('ended');
  });

  it('splits a chest between the players and tags every prize with its owner', () => {
    const g = duo({ godMode: true });
    const res = g.openChest(4);
    expect(res.entries.length).toBe(4);
    expect(res.entries.filter((e) => e.player === 0).length).toBe(2);
    expect(res.entries.filter((e) => e.player === 1).length).toBe(2);
  });

  it('a one-shot hazard strikes each player once', () => {
    const g = duo();
    const [p0, p1] = g.players;
    for (const p of g.players) {
      p.iframes = 0;
      p.stats.revives = 9;
      p.hp = 500;
    }
    p1.x = p0.x + 30;
    p1.y = p0.y;
    const h0 = p0.hp, h1 = p1.hp;
    g.spawnHazard('circle', 'stomp', (p0.x + p1.x) / 2, p0.y, { r: 120, tele: 0.01, active: 0.5, dmg: 20 });
    for (let i = 0; i < 20; i++) g.tick();
    expect(h0 - p0.hp).toBeGreaterThan(0);
    expect(h1 - p1.hp).toBeGreaterThan(0);
    expect(h0 - p0.hp).toBeLessThan(40); // once, not every tick
  });

  it('is deterministic for the same seed and inputs', () => {
    const a = duo({ seed: 777, godMode: true });
    const b = duo({ seed: 777, godMode: true });
    runFor(a, 40);
    runFor(b, 40);
    expect(a.kills).toBe(b.kills);
    expect(a.level).toBe(b.level);
    expect(a.players[1].x).toBeCloseTo(b.players[1].x, 6);
    expect(a.active.length).toBe(b.active.length);
  });

  it('plays several minutes of a co-op night without stalling', () => {
    const g = duo({ godMode: true, seed: 4242 });
    runFor(g, 240);
    expect(g.phase).not.toBe('draft');
    expect(g.time).toBeGreaterThan(230);
    expect(g.kills).toBeGreaterThan(50);
    expect(g.players.every((p) => p.weapons.list.length >= 1)).toBe(true);
    expect(g.players[1].weapons.list.length).toBeLessThanOrEqual(4);
  });
});

describe('co-op XP (D-57)', () => {
  it('a party needs more XP per level, ramping in over the first six levels', () => {
    const solo = makeGame({ seed: 1 });
    const pair = duo();
    expect(pair.xpCurve(1)).toBe(solo.xpCurve(1)); // the night still opens with quick level-ups
    expect(pair.xpCurve(4)).toBeGreaterThan(solo.xpCurve(4));
    for (const lvl of [7, 12, 30]) expect(pair.xpCurve(lvl)).toBeCloseTo(solo.xpCurve(lvl) * COOP.xp[2], 6);
    const six = makeGame({ seed: 1, players: Array.from({ length: 6 }, (_, i) => ({ character: 'carny', name: `P${i}` })) });
    expect(six.xpCurve(10)).toBeCloseTo(solo.xpCurve(10) * COOP.xp[6], 6);
    for (let n = 2; n <= 6; n++) expect(COOP.xp[n]).toBeGreaterThan(COOP.xp[n - 1]);
  });
});
