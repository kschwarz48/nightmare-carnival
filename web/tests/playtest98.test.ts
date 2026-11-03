// D-98, the owner's playtest batch: no hidden quest gates progress (the Midway opens on the first dawn, the Ghost Train
// goes at the whistle); each map's final boss gives its weapon and its hidden quest the passive that evolves it; the
// first map answers E like the others; in co-op every player's own pickup radius pulls tickets.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { SaveManager, migrate, type StorageLike } from '../src/meta/save';
import { BOSS_UNLOCKS, QUEST_UNLOCKS, UNLOCKS } from '../src/data/meta';
import { PASSIVES, WEAPONS } from '../src/data/weapons';
import { LAST_SONG } from '../src/data/quests';
import { LS, type LastSongChain } from '../src/sim/quest/lastSong';
import type { Game } from '../src/sim/game';

const mem = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

describe('each map: its final boss gives a weapon, its hidden quest the passive that evolves it', () => {
  it('pairs every map', () => {
    const pairs: [string, string][] = [['beat_ringmaster', 'last_song'], ['beat_proprietor', 'unreflected'], ['beat_leviathan', 'summers_end'], ['beat_night_express', 'last_train']];
    for (const [boss, quest] of pairs) {
      const w = Object.values(WEAPONS).find((d) => d.unlock === BOSS_UNLOCKS[boss][0])!;
      expect(w, boss).toBeTruthy();
      const partner = PASSIVES[w.evoPassive!];
      expect(QUEST_UNLOCKS[quest], quest).toContain(partner.unlock);
    }
    // none of the bosses' weapons is sold any more
    for (const ids of Object.values(BOSS_UNLOCKS)) for (const id of ids) expect(UNLOCKS.find((u) => u.id === id)).toBeUndefined();
  });

  it('grants them as the achievements come, and opens the Midway on the first dawn', () => {
    const s = new SaveManager(mem());
    expect(s.hubUnlocked()).toBe(false);
    s.grantAchievements(['beat_ringmaster']);
    expect(s.isUnlocked('w_calliope')).toBe(true);
    expect(s.hubUnlocked()).toBe(true);
    s.grantAchievements(['last_song', 'beat_night_express', 'last_train']);
    expect(s.isUnlocked('p_last_song')).toBe(true);
    expect(s.isUnlocked('w_whistle')).toBe(true);
    expect(s.isUnlocked('p_conductor_watch')).toBe(true);
  });

  it('migrates a v6 save: grants what it has beaten and solved, refunds the Mirror and the Undertow it bought', () => {
    const v6 = { version: 6, lostTickets: 100, spent: 5000, unlocks: ['w_orbs', 'w_mirror', 'w_undertow'], achievements: ['beat_ringmaster', 'beat_proprietor', 'beat_leviathan', 'unreflected'], tiers: { unlocked: ['normal'], wins: { normal: {}, nightmare: {}, hell: {} }, seen: [] } };
    const d = migrate(JSON.parse(JSON.stringify(v6)));
    expect(d.version).toBe(7);
    expect(d.lostTickets).toBe(100 + 3000);
    expect(d.spent).toBe(2000);
    expect(d.notice).toContain('+3,000 Lost Tickets');
    expect([...d.unlocks].sort()).toEqual(['p_hand_mirror', 'w_calliope', 'w_mirror', 'w_orbs', 'w_undertow']);
    // idempotent
    expect(migrate(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
});

describe('the first map answers E', () => {
  const press = (g: Game, x: number, y: number) => {
    g.player.x = g.player.px = x;
    g.player.y = g.player.py = y;
    g.inputs[0].interact = true;
    g.tick();
    for (let i = 0; i < 20; i++) g.tick();
  };

  it('walking up to Zoltana does nothing until interact is pressed; the HUD has a prompt for her', () => {
    const g = makeGame({ godMode: true, seed: 5 });
    g.weapons.list.length = 0;
    const ls = g.quests.get<LastSongChain>('last_song')!;
    const M = LAST_SONG.machine;
    g.player.x = g.player.px = M.x;
    g.player.y = g.player.py = M.y;
    for (let i = 0; i < 30; i++) g.tick();
    expect(ls.stage).toBe(LS.Dormant);
    expect(ls.interaction(M.x, M.y)?.label).toBe('Look into the fortune booth');
    press(g, M.x, M.y);
    expect(ls.stage).toBe(LS.Souls);
    // the High Striker answers a press timed to the light, standing on its pad
    ls.stage = LS.Striker;
    const S = LAST_SONG.striker;
    g.realTime = Math.floor(g.realTime / S.period + 1) * S.period + S.period * 0.5 - 1 / 60;
    g.player.x = g.player.px = S.padX;
    g.player.y = g.player.py = S.padY;
    g.inputs[0].interact = true;
    g.tick();
    expect(ls.rings).toBe(1);
  });
});

describe('the magnet in co-op', () => {
  it("pulls with a player's own radius even when a teammate stands nearer the ticket", () => {
    const g = makeGame({ godMode: true, players: [{ character: 'carny' }, { character: 'strongman' }] });
    const [a, b] = g.players;
    for (let i = 0; i < 5; i++) a.addPassive('magnet_glove');
    a.x = a.px = 0; a.y = a.py = 600;
    b.x = b.px = 280; b.y = b.py = 600;
    // 150 from A (inside A's 169), 130 from B (outside B's 75)
    const pk = g.spawnPickup('ticket', 150, 600, 1);
    const ta = a.runTickets;
    for (let i = 0; i < 60 && pk.alive; i++) g.tick();
    expect(pk.alive).toBe(false);
    expect(a.runTickets).toBe(ta + 1);
  });
});

describe('the Night Express Whistle', () => {
  it('rolls a ring of steam out that hits each creature once and scalds it', () => {
    const g = makeGame({ godMode: true, seed: 2 });
    g.weapons.list.length = 0;
    g.weapons.add('steam_whistle');
    const p = g.player;
    const near = g.spawnEnemy('carnival_brute', p.x + 100, p.y)!;
    const far = g.spawnEnemy('carnival_brute', p.x + 600, p.y)!;
    for (const e of [near, far]) {
      e.hp = e.maxHp = 1e6;
      e.speed = 0;
    }
    for (let i = 0; i < 120; i++) g.tick();
    expect(near.hp).toBeLessThan(1e6);
    expect(near.burnT > 0 || near.hp < 1e6 - 15).toBe(true);
    expect(far.hp).toBe(1e6);
  });
});
