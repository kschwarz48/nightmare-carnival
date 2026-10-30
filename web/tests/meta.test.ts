import { describe, expect, it } from 'vitest';
import { SaveManager, migrate, SAVE_VERSION, type StorageLike } from '../src/meta/save';
import { DIFFICULTY_MAP } from '../src/data/difficulty';
import { makeGame, runFor } from './helpers';
import { dailySeedString, hashSeed, Rng } from '../src/core/rng';

function mem(): StorageLike & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe('save system', () => {
  it('persists and reloads', () => {
    const st = mem();
    const a = new SaveManager(st);
    a.data.lostTickets = 500;
    a.save();
    const b = new SaveManager(st);
    expect(b.data.lostTickets).toBe(500);
  });

  it('migrates a Godot-era v1 save to the current version', () => {
    const v1 = { lost_tickets: 321, unlocks: ['crystal_orbs'], perks: { might: 2 }, pedia: ['living_balloon'], settings: { master_volume: 0.4, reduce_flashes: true } };
    const d = migrate(v1);
    expect(d.version).toBe(SAVE_VERSION);
    expect(d.lostTickets).toBe(321);
    expect(d.unlocks).toContain('w_orbs');
    expect(d.perks.might).toBe(2);
    expect(d.settings.master).toBe(0.4);
    expect(d.settings.reducedFlash).toBe(true);
    expect(d.daily).toEqual({});
  });

  it('recovers from a corrupted save via the backup slot', () => {
    const st = mem();
    const a = new SaveManager(st);
    a.data.lostTickets = 77;
    a.save();
    a.data.lostTickets = 88;
    a.save(); // backup now holds 77
    st.setItem('nightmare_carnival_save', '{broken json');
    const b = new SaveManager(st);
    expect(b.recovered).toBe(true);
    expect(b.data.lostTickets).toBe(77);
  });

  it('perks: escalating cost, cap, and refunds', () => {
    const s = new SaveManager(mem());
    s.data.lostTickets = 10000;
    const c0 = s.perkCost('might');
    expect(s.buyPerk('might')).toBe(true);
    expect(s.perkCost('might')).toBeGreaterThan(c0);
    for (let i = 0; i < 10; i++) s.buyPerk('might');
    expect(s.perkLevel('might')).toBe(5);
    expect(s.perkMaxed('might')).toBe(true);
    expect(s.metaStats().find((m) => m.axis === 'might')!.value).toBeCloseTo(0.25);
    const before = s.data.lostTickets;
    const refunded = s.refundPerks();
    expect(s.data.lostTickets).toBe(before + refunded);
    expect(s.perkLevel('might')).toBe(0);
  });

  it('character unlock needs the requirement AND the price', () => {
    const s = new SaveManager(mem());
    s.data.lostTickets = 1000;
    expect(s.characterAvailable('ride_operator')).toBe(false);
    expect(s.buyCharacter('ride_operator')).toBe(false);
    s.grantAchievements(['beat_ferris_wheel']);
    expect(s.characterRequirementMet('ride_operator')).toBe(true);
    expect(s.buyCharacter('ride_operator')).toBe(true);
    expect(s.characterAvailable('ride_operator')).toBe(true);
    expect(s.difficultyAvailable('carnival')).toBe(true);
    expect(s.difficultyAvailable('nightmare')).toBe(false);
  });

  it('achievements pay Lost Tickets exactly once', () => {
    const s = new SaveManager(mem());
    const a = s.grantAchievements(['first_night']);
    expect(a.length).toBe(1);
    const lt = s.data.lostTickets;
    expect(s.grantAchievements(['first_night']).length).toBe(0);
    expect(s.data.lostTickets).toBe(lt);
  });

  it('meta perks apply to new runs', () => {
    const g = makeGame({ meta: [{ axis: 'maxHp', value: 0.3 }, { axis: 'might', value: 0.25 }] });
    expect(g.player.stats.maxHp()).toBeCloseTo(130);
    expect(g.player.stats.might).toBeCloseTo(1.25);
  });
});

describe('difficulty & modes', () => {
  it('tiers scale enemy HP/damage and cap population', () => {
    const m = makeGame({ difficulty: 'midway' });
    const n = makeGame({ difficulty: 'nightmare' });
    const em = m.spawnEnemy('evil_clown', 0, 800)!;
    const en = n.spawnEnemy('evil_clown', 0, 800)!;
    expect(en.maxHp / em.maxHp).toBeCloseTo(DIFFICULTY_MAP.nightmare.hpMult, 2);
    expect(en.dmg / em.dmg).toBeCloseTo(DIFFICULTY_MAP.nightmare.dmgMult, 2);
    for (const g of [m, n]) {
      runFor(g, 400);
      expect(g.active.length).toBeLessThanOrEqual(g.diff.cap + 80); // swarm overlay may briefly exceed by its size
    }
  });

  it('Curse makes enemies tougher and pays more', () => {
    const a = makeGame({ curse: false, seed: 5 });
    const b = makeGame({ curse: true, seed: 5 });
    expect(b.spawnEnemy('evil_clown', 0, 800)!.maxHp).toBeGreaterThan(a.spawnEnemy('evil_clown', 0, 800)!.maxHp);
    a.time = b.time = 600;
    a.endRun(false);
    b.endRun(false);
    expect(b.endStats!.lostTickets).toBeGreaterThan(a.endStats!.lostTickets);
  });

  it('daily seed is deterministic per UTC date', () => {
    const d = new Date(Date.UTC(2026, 9, 30, 12));
    expect(dailySeedString(d)).toBe('20261030');
    const r1 = new Rng(hashSeed('daily20261030')), r2 = new Rng(hashSeed('daily20261030'));
    expect(r1.next()).toBe(r2.next());
  });
});
