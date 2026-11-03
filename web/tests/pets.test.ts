// Companions (D-84): Milo and Augustus. Each brings its passive to the player it follows (and only theirs), each is
// earned by an achievement any map can give (each player's own in co-op), the save offers only an earned one, and a
// party's companions reach every screen in the start config.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { Game } from '../src/sim/game';
import { PETS, PET_MAP } from '../src/data/pets';
import { ACHIEVEMENTS } from '../src/data/meta';
import { SaveManager, type StorageLike } from '../src/meta/save';
import { cleanProfile, parseHostMsg } from '../src/net/protocol';
import { runConfigFromStart } from '../src/net/session';

const mem = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

describe('companions (D-84)', () => {
  it('each has an achievement to earn it and a passive that lands on its own player only', () => {
    for (const p of PETS) expect(ACHIEVEMENTS.some((a) => a.id === p.achievement), p.id).toBe(true);
    const base = makeGame().player.stats, solo = makeGame({ pet: 'milo' });
    expect(solo.player.pet).toBe('milo');
    expect(solo.player.stats.pickupMult - base.pickupMult).toBeCloseTo(0.3, 5);
    expect(solo.player.stats.xp - base.xp).toBeCloseTo(0.06, 5);
    const duo = makeGame({ players: [{ character: 'carny', name: 'A' }, { character: 'strongman', name: 'B', pet: 'augustus' }] });
    expect([duo.players[0].pet, duo.players[1].pet]).toEqual([null, 'augustus']);
    expect(duo.players[1].stats.moveSpeedMult).toBeCloseTo(1.08, 5);
    expect(duo.players[1].stats.critChance).toBeCloseTo(0.11, 5);
    expect(duo.players[0].stats.moveSpeedMult).toBeCloseTo(1, 5);
  });

  it('Fetch!: two golden tickets in a night bring Milo to whoever picked them up', () => {
    const g = makeGame({ godMode: true, players: [{ character: 'carny', name: 'A' }, { character: 'strongman', name: 'B' }] });
    const b = g.players[1];
    for (let k = 0; k < 2; k++) {
      g.spawnPickup('golden', b.x, b.y, 0);
      for (let i = 0; i < 30; i++) g.tick();
    }
    expect(b.goldens).toBe(2);
    g.endRun(false);
    expect(g.endStatsAll[1].achievementsHit).toContain('pet_milo');
    expect(g.endStatsAll[0].achievementsHit).not.toContain('pet_milo');
  });

  it('Nine Lives: the dawn seen without ever falling below half health brings Augustus; a deep wound does not', () => {
    const kept = makeGame({ godMode: false });
    kept.player.x = kept.player.px = 0;
    kept.hurtPlayer(kept.player.stats.maxHp() * 0.3, 0, 0, { ignoreIframes: true });
    kept.endRun(true);
    expect(kept.endStats!.achievementsHit).toContain('pet_augustus');
    const hurt = makeGame({ godMode: false });
    hurt.hurtPlayer(hurt.player.stats.maxHp() * 0.6, 0, 0, { ignoreIframes: true });
    hurt.endRun(true);
    expect(hurt.player.lowHp).toBeLessThan(0.5);
    expect(hurt.endStats!.achievementsHit).not.toContain('pet_augustus');
    const lost = makeGame({ godMode: false });
    lost.endRun(false);
    expect(lost.endStats!.achievementsHit).not.toContain('pet_augustus');
  });

  it('the save offers a companion only once its achievement is earned', () => {
    const s = new SaveManager(mem());
    s.data.pet = 'augustus';
    expect(s.petUnlocked('augustus')).toBe(false);
    expect(s.petChoice()).toBeUndefined();
    s.data.achievements.push(PET_MAP.augustus.achievement);
    expect(s.petChoice()).toBe('augustus');
  });

  it('a party\'s companions travel in their profiles and the start config, and land on the right players', () => {
    expect(cleanProfile({ name: 'B', pet: 'milo' })?.pet).toBe('milo');
    expect(cleanProfile({ name: 'B', pet: 'a dragon' })?.pet).toBeUndefined();
    const players = [
      { character: 'carny', name: 'Host', meta: [], aimMode: 'auto', rerolls: 0, banishes: 0, canSkip: false, pet: 'augustus' },
      { character: 'strongman', name: 'Guest', meta: [], aimMode: 'auto', rerolls: 0, banishes: 0, canSkip: false, pet: 'milo' },
      { character: 'carny', name: 'Third', meta: [], aimMode: 'auto', rerolls: 0, banishes: 0, canSkip: false, pet: 'a dragon' },
    ];
    const msg = parseHostMsg(JSON.stringify({ t: 'start', slot: 1, epoch: 1, cfg: { seed: 5, tier: 'normal', curse: false, unlocked: [], questMemory: {}, players } }));
    expect(msg?.t).toBe('start');
    const cfg = (msg as Extract<NonNullable<typeof msg>, { t: 'start' }>).cfg;
    expect(cfg.players.map((p) => p.pet)).toEqual(['augustus', 'milo', undefined]);
    const g = new Game(runConfigFromStart(cfg));
    expect(g.players.map((p) => p.pet)).toEqual(['augustus', 'milo', null]);
    expect(g.players[1].stats.pickupMult).toBeCloseTo(1.3, 5);
  });
});
