import { describe, expect, it } from 'vitest';
import { makeGame, runFor } from './helpers';
import { PlayerStats } from '../src/sim/stats';
import { computePayout } from '../src/data/meta';
import { Player } from '../src/sim/player';

describe('player stats & movement', () => {
  it('applies every stat axis and floors cooldown', () => {
    const s = new PlayerStats();
    s.apply('might', 0.5);
    s.apply('cooldown', 0.9);
    s.apply('area', 0.2);
    s.apply('amount', 1);
    s.apply('maxHp', 0.5);
    s.apply('moveSpeed', 0.1);
    s.apply('pickup', 0.25);
    expect(s.might).toBeCloseTo(1.5);
    expect(s.cooldown).toBeCloseTo(0.3); // floor
    expect(s.amount).toBe(1);
    expect(s.maxHp()).toBeCloseTo(150);
    expect(s.moveSpeed()).toBeCloseTo(242);
    expect(s.pickupRadius()).toBeCloseTo(75);
  });

  it('gaining max HP from a passive also heals the difference', () => {
    const p = new Player('carny');
    p.initHp();
    p.hp = 50;
    p.addPassive('sugar_rush');
    expect(p.stats.maxHp()).toBeCloseTo(112);
    expect(p.hp).toBeCloseTo(62);
  });

  it('moves with input and is blocked by props and bounds', () => {
    const g = makeGame();
    const x0 = g.player.x;
    g.input.moveX = 1;
    for (let i = 0; i < 60; i++) g.tick();
    expect(g.player.x - x0).toBeGreaterThan(180); // ~220 px/s
    // walk into the ticket booth (solid AABB at 1090,340 ±100×80)
    g.player.x = 900;
    g.player.y = 340;
    for (let i = 0; i < 120; i++) g.tick();
    expect(g.player.x).toBeLessThan(1090 - 100);
    // map bounds
    g.player.x = 2100;
    g.input.moveX = 1;
    g.player.y = -1500;
    for (let i = 0; i < 120; i++) g.tick();
    expect(g.player.x).toBeLessThanOrEqual(2140);
  });

  it('character identities differ', () => {
    const ids = ['carny', 'strongman', 'fortune_teller', 'ride_operator', 'lost_child', 'ringleader'];
    const sigs = ids.map((id) => {
      const g = makeGame({ character: id });
      return `${g.player.stats.maxHp()}|${g.player.stats.moveSpeed()}|${g.weapons.list[0].def.id}|${g.player.char.quirk}`;
    });
    expect(new Set(sigs).size).toBe(6);
  });
});

describe('damage, i-frames, shields, revives', () => {
  it('armor reduces damage to a minimum of 1 and i-frames block repeat hits', () => {
    const g = makeGame();
    g.player.stats.armor = 5;
    const hp0 = g.player.hp;
    expect(g.hurtPlayer(3, 0, 0)).toBe(true);
    expect(g.player.hp).toBeCloseTo(hp0 - 1);
    expect(g.hurtPlayer(50, 0, 0)).toBe(false); // i-frames
    for (let i = 0; i < 30; i++) g.tick();
    expect(g.hurtPlayer(50, 0, 0)).toBe(true);
  });

  it('Lost Child balloon shield absorbs one hit then regrows', () => {
    const g = makeGame({ character: 'lost_child' });
    const hp0 = g.player.hp;
    g.hurtPlayer(30, 0, 0);
    expect(g.player.hp).toBe(hp0);
    expect(g.player.shieldReady).toBe(false);
    g.player.iframes = 0;
    g.hurtPlayer(10, 0, 0);
    expect(g.player.hp).toBeLessThan(hp0);
    g.player.shieldT = 0.01;
    g.tick();
    expect(g.player.shieldReady).toBe(true);
  });

  it('revives at 50% instead of dying, then dies for real', () => {
    const g = makeGame({ character: 'lost_child' });
    g.player.shieldReady = false;
    expect(g.player.stats.revives).toBe(1);
    g.hurtPlayer(9999, 0, 0);
    expect(g.phase).toBe('play');
    expect(g.player.hp).toBeCloseTo(g.player.stats.maxHp() * 0.5);
    g.player.iframes = 0;
    g.hurtPlayer(9999, 0, 0);
    expect(g.phase).toBe('ended');
    expect(g.endStats?.won).toBe(false);
  });

  it('enemy damage, knockback and kill drop tickets', () => {
    const g = makeGame();
    const e = g.spawnEnemy('possessed_stuffie', g.player.x + 100, g.player.y)!;
    const hp = e.hp;
    g.damageEnemy(e, 10, false, 1, g.player.x, g.player.y, 'test');
    expect(e.hp).toBeCloseTo(hp - 10);
    expect(e.kbT).toBeGreaterThan(0);
    const gems = g.gemsOnGround;
    g.damageEnemy(e, 999, true, 0, 0, 0, 'test');
    expect(e.alive).toBe(false);
    expect(g.kills).toBe(1);
    expect(g.gemsOnGround).toBeGreaterThan(gems);
  });

  it('elite shielded affix absorbs hits; frozen enemies take +25%', () => {
    const g = makeGame({ difficulty: 'nightmare' });
    const e = g.spawnEnemy('evil_clown', 300, 300)!;
    e.shield = 2;
    expect(g.damageEnemy(e, 10, false, 0, 0, 0, '')).toBe(0);
    expect(g.damageEnemy(e, 10, false, 0, 0, 0, '')).toBe(0);
    e.frozenT = 1;
    expect(g.damageEnemy(e, 10, false, 0, 0, 0, '')).toBeCloseTo(12.5);
  });
});

describe('XP & leveling', () => {
  it('XP curve rises (with one-level plateaus at 20 and 40) and levels open a draft', () => {
    const g = makeGame();
    let prev = 0;
    for (let l = 1; l < 80; l++) {
      const c = g.xpCurve(l);
      if (l === 21 || l === 41) expect(c).toBeLessThan(g.xpCurve(l - 1)); // just after a plateau
      else expect(c).toBeGreaterThan(prev);
      if (l === 20 || l === 40) expect(c).toBeGreaterThan(g.xpCurve(l + 1)); // the plateau itself
      prev = c;
    }
    g.addXp(g.xpToNext * 3); // several levels at once
    expect(g.level).toBeGreaterThan(2);
    expect(g.phase).toBe('draft');
    const pending = g.pendingLevels;
    g.chooseDraft(0);
    expect(g.pendingLevels).toBe(pending - 1);
  });

  it('pickups magnetize within radius and are collected', () => {
    const g = makeGame();
    g.spawnPickup('ticket', g.player.x + 40, g.player.y, 3);
    const xp0 = g.xp + g.level * 1000;
    for (let i = 0; i < 30; i++) g.tick();
    expect(g.xp + g.level * 1000).toBeGreaterThan(xp0);
  });

  it('ground gem cap overflows into the Ticket Bank', () => {
    const g = makeGame();
    g.maxGems = 5;
    for (let i = 0; i < 20; i++) g.dropTickets(1500, 1500, 1);
    expect(g.gemsOnGround).toBe(5);
    expect(g.bankPickup?.value).toBe(15);
  });
});

describe('payout', () => {
  it('matches doc 01 §8 formula with greed', () => {
    expect(computePayout({ seconds: 600, bosses: 1, kills: 500, won: false, greed: 1 })).toBe(100 + 50 + 20);
    expect(computePayout({ seconds: 1500, bosses: 4, kills: 10000, won: true, greed: 1.3 })).toBe(Math.round((250 + 200 + 400 + 100) * 1.3));
  });
});

describe('pause / determinism', () => {
  it('the sim does not advance while a draft is open', () => {
    const g = makeGame();
    g.addXp(g.xpToNext + 1);
    expect(g.phase).toBe('draft');
    const t = g.time;
    for (let i = 0; i < 60; i++) g.tick();
    expect(g.time).toBe(t);
    g.chooseDraft(0);
    g.tick();
    expect(g.time).toBeGreaterThan(t);
  });

  it('same seed + same inputs → identical state (Daily Run determinism)', () => {
    const a = makeGame({ seed: 4242 });
    const b = makeGame({ seed: 4242 });
    runFor(a, 90);
    runFor(b, 90);
    expect(a.kills).toBe(b.kills);
    expect(a.player.x).toBeCloseTo(b.player.x, 6);
    expect(a.level).toBe(b.level);
    expect(a.weapons.list.map((w) => w.def.id + w.level)).toEqual(b.weapons.list.map((w) => w.def.id + w.level));
  });
});
