import { describe, expect, it } from 'vitest';
import { SaveManager, migrate, SAVE_VERSION, type StorageLike } from '../src/meta/save';
import { TIERS } from '../src/data/tiers';
import { makeGame, runFor } from './helpers';
import { generateDraft } from '../src/sim/draft';
import { CHARACTERS } from '../src/data/characters';
import { PERKS, UNLOCKS } from '../src/data/meta';
import { EVOLUTION_IDS, WEAPONS } from '../src/data/weapons';
import { MIRA_HALO } from '../src/sim/weapons';
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
    // the Orbs (renamed on the way) and two perk levels come back as Lost Tickets at the old prices (D-78)
    expect(d.lostTickets).toBe(321 + 60 + 40 + 64);
    expect(d.unlocks).toEqual([]);
    expect(d.perks).toEqual({});
    expect(d.pedia).toEqual(['living_balloon']);
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
    s.data.lostTickets = 10000;
    expect(s.characterAvailable('ride_operator')).toBe(false);
    expect(s.buyCharacter('ride_operator')).toBe(false);
    s.grantAchievements(['beat_ferris_wheel']);
    // D-78: the Commodore waits for the Boardwalk to be survived, and costs 6,000
    expect(s.characterRequirementMet('ride_operator')).toBe(false);
    expect(s.buyCharacter('ride_operator')).toBe(false);
    s.grantAchievements(['beat_leviathan']);
    expect(s.characterRequirementMet('ride_operator')).toBe(true);
    s.data.lostTickets = 5999;
    expect(s.buyCharacter('ride_operator')).toBe(false);
    s.data.lostTickets = 6000;
    expect(s.buyCharacter('ride_operator')).toBe(true);
    expect(s.characterAvailable('ride_operator')).toBe(true);
    expect(s.data.lostTickets).toBe(0);
    expect(s.data.spent).toBe(6000);
  });

  it('earns The Whole Troupe the moment the last performer is bought, and on an older save that qualifies (D-75)', () => {
    const s = new SaveManager(mem());
    s.data.lostTickets = 20000;
    s.grantAchievements(['reach_12', 'beat_puppet_king', 'beat_ringmaster', 'beat_proprietor', 'beat_leviathan']);
    for (const id of ['fortune_teller', 'ride_operator', 'lost_child', 'ringleader']) expect(s.buyCharacter(id)).toBe(true);
    expect(s.hasAchievement('all_characters')).toBe(false);
    const lt = s.data.lostTickets;
    expect(s.buyCharacter('mira')).toBe(true);
    expect(s.hasAchievement('all_characters')).toBe(true);
    expect(s.data.lostTickets).toBe(lt - 4500 + 150); // the price, then the achievement's reward
    // a save that bought everyone before this fix gets it (once) the next time it's checked
    const old = new SaveManager(mem());
    old.data.unlocks.push(...CHARACTERS.filter((c) => c.unlock).map((c) => `char_${c.id}`));
    expect(old.claimDerived().map((a) => a.id)).toEqual(['all_characters']);
    expect(old.claimDerived()).toEqual([]);
  });

  it('sells base HP regeneration as a permanent perk, and Funnel Cake is no longer drafted (D-76)', () => {
    const s = new SaveManager(mem());
    s.data.lostTickets = 1000;
    expect(s.perkCost('regen')).toBe(200);
    expect(s.buyPerk('regen')).toBe(true);
    expect(s.perkCost('regen')).toBe(340);
    expect(s.buyPerk('regen')).toBe(true);
    const meta = s.metaStats().find((m) => m.axis === 'regen');
    expect(meta?.value).toBeCloseTo(0.4, 5);
    const g = makeGame({ meta: s.metaStats() });
    expect(g.player.stats.regen).toBeCloseTo(0.4, 5);
    // regenerates without any passive
    g.player.hp = 50;
    for (let i = 0; i < 60 * 5; i++) g.tick();
    expect(g.player.hp).toBeGreaterThan(51);
    for (let k = 0; k < 200; k++) for (const o of generateDraft(g)) expect(o.refId).not.toBe('funnel_cake');
  });

  it('prices the Lost & Found about seven times higher than before (D-78)', () => {
    const total = (ps: typeof PERKS) => ps.reduce((t, p) => t + Array.from({ length: p.cap }, (_, i) => Math.round(p.base * Math.pow(p.growth, i))).reduce((a, b) => a + b, 0), 0);
    const perkTotal = total(PERKS.filter((p) => !p.tier));
    const unlockTotal = UNLOCKS.filter((u) => !u.tier).reduce((t, u) => t + u.cost, 0);
    expect(UNLOCKS.filter((u) => u.tier).reduce((t, u) => t + u.cost, 0)).toBe(24500);
    const castTotal = CHARACTERS.filter((c) => !c.tier).reduce((t, c) => t + (c.unlock?.cost ?? 0), 0);
    expect(CHARACTERS.filter((c) => c.tier).reduce((t, c) => t + (c.unlock?.cost ?? 0), 0)).toBe(16000);
    expect(perkTotal).toBe(22097);
    // the tiers' shelves (D-97)
    expect(total(PERKS.filter((p) => p.tier === 'nightmare'))).toBe(41195);
    expect(total(PERKS.filter((p) => p.tier === 'hell'))).toBe(91905);
    expect(unlockTotal).toBe(8500);
    expect(castTotal).toBe(16100);
    expect(CHARACTERS.length).toBe(9); // the seven and the world tiers' two (D-97)
  });

  it('refunds everything bought at the old prices, keeps what was earned, and grants what the new rules give (D-78)', () => {
    const v4 = {
      version: 4, lostTickets: 1000, totalEarned: 5000, perks: { might: 5, regen: 2, revive: 1 },
      unlocks: ['w_orbs', 'w_mirror', 'f_skip', 'char_fortune_teller', 'char_ringleader', 'w_calliope'],
      achievements: ['first_night', 'all_characters', 'summers_end', 'last_song', 'beat_leviathan'], pedia: ['hall_of_mirrors'], quests: { last_song: { completions: 1, bestStage: 7 } },
    };
    const d = migrate(v4);
    expect(d.version).toBe(SAVE_VERSION);
    // Brass Knuckles 40+64+102+164+262, Funnel Cake 50+80, the Spare Balloon 200, the Orbs 60, the Mirror 160,
    // the Skip Ticket 50, the Fortune Teller 150, the Ringleader 500; less the Whole Troupe's 150, withdrawn
    const refund = 632 + 130 + 200 + 60 + 160 + 50 + 150 + 500 - 150;
    expect(d.lostTickets).toBe(1000 + refund);
    expect(d.notice).toContain(`+${refund.toLocaleString('en-US')} Lost Tickets`);
    expect(d.perks).toEqual({});
    expect(d.spent).toBe(0);
    expect(d.totalEarned).toBe(5000);
    expect([...d.unlocks].sort()).toEqual(['p_ada_conch', 'p_running_shoes', 'w_calliope']);
    expect(d.achievements).toEqual(['first_night', 'summers_end', 'last_song', 'beat_leviathan']);
    expect(d.pedia).toEqual(['hall_of_mirrors']);
    expect(d.quests.last_song.completions).toBe(1);
    // nothing bought, nothing to say
    const plain = migrate({ version: 4, lostTickets: 50, perks: {}, unlocks: [], achievements: ['first_night'] });
    expect(plain.lostTickets).toBe(50);
    expect(plain.notice).toBeUndefined();
    // once migrated it never refunds again
    const st = mem();
    st.setItem('nightmare_carnival_save', JSON.stringify(v4));
    const a = new SaveManager(st);
    a.save();
    const b = new SaveManager(st);
    expect(b.data.lostTickets).toBe(1000 + refund);
  });

  it('owned weapons and passives can be left out of the drafts and put back (D-78)', () => {
    const s = new SaveManager(mem());
    s.data.lostTickets = 5000;
    expect(s.buyUnlock('w_orbs')).toBe(true);
    expect(s.inPool('w_orbs')).toBe(true);
    s.setInPool('w_orbs', false);
    expect(s.isUnlocked('w_orbs')).toBe(true); // still owned
    expect(s.inPool('w_orbs')).toBe(false);
    expect(s.unlockedSet().has('w_orbs')).toBe(false);
    const g = makeGame({ unlocked: s.unlockedSet(), seed: 7 });
    for (let k = 0; k < 300; k++) for (const o of generateDraft(g)) expect(o.refId).not.toBe('orbs');
    s.setInPool('w_orbs', true);
    expect(s.unlockedSet().has('w_orbs')).toBe(true);
    const g2 = makeGame({ unlocked: s.unlockedSet(), seed: 7 });
    let seen = false;
    for (let k = 0; k < 300 && !seen; k++) seen = generateDraft(g2).some((o) => o.refId === 'orbs');
    expect(seen).toBe(true);
    // a Daily Run keeps the full pool whatever is switched off
    s.setInPool('w_orbs', false);
    const daily = makeGame({ unlocked: s.unlockedSet(), seed: 7, daily: true });
    let dailySeen = false;
    for (let k = 0; k < 300 && !dailySeen; k++) dailySeen = generateDraft(daily).some((o) => o.refId === 'orbs');
    expect(dailySeen).toBe(true);
  });

  it('sells the Undertow once the Boardwalk is survived; Running Shoes come from the Commodore (D-78)', () => {
    const s = new SaveManager(mem());
    s.data.lostTickets = 5000;
    expect(s.unlockRequirementMet('w_undertow')).toBe(false);
    expect(s.buyUnlock('w_undertow')).toBe(false);
    s.grantAchievements(['beat_leviathan']);
    expect(s.buyUnlock('w_undertow')).toBe(true);
    expect(WEAPONS.bumper.name).toBe('The Undertow');
    expect(WEAPONS.bumper.unlock).toBe('w_undertow');
    // without the unlocks neither is ever drafted; the Commodore still starts with his coaster car
    const g = makeGame({ unlocked: new Set(), seed: 3 });
    for (let k = 0; k < 300; k++) for (const o of generateDraft(g)) {
      expect(o.refId).not.toBe('bumper');
      expect(o.refId).not.toBe('running_shoes');
    }
    expect(makeGame({ character: 'ride_operator', unlocked: new Set() }).player.weapons.has('bumper')).toBe(true);
    const shod = makeGame({ unlocked: new Set(['p_running_shoes']), seed: 3 });
    let seen = false;
    for (let k = 0; k < 400 && !seen; k++) seen = generateDraft(shod).some((o) => o.refId === 'running_shoes');
    expect(seen).toBe(true);
  });

  it("evolves the Funhouse Mirror with Mira's Hand Mirror; Full House skips evolutions that need a quest's reward (D-78)", () => {
    expect(WEAPONS.mirror.evoPassive).toBe('hand_mirror');
    expect(WEAPONS.mirror.signature).toBe('mira');
    const s = new SaveManager(mem());
    s.data.pedia = EVOLUTION_IDS.filter((e) => !['hall_of_mirrors', 'demolition_derby', 'grand_requiem'].includes(e));
    expect(s.claimDerived().map((a) => a.id)).toContain('full_house');
  });

  it("Mira's clones cut what stands in their Glass Halo once a second, even with only the mirror (D-78)", () => {
    for (const character of ['mira', 'carny']) {
      const g = makeGame({ character, seed: 5, godMode: true });
      if (character === 'carny') {
        g.player.weapons.list.length = 0;
        g.player.weapons.add('mirror');
      }
      expect(g.player.weapons.has('mirror')).toBe(true);
      g.time = 30;
      let clone = null as null | { x: number; y: number };
      for (let i = 0; i < 400 && !clone; i++) {
        g.tick();
        clone = g.summons.find((s) => s.alive && s.kind === 'clone') ?? null;
      }
      expect(clone, character).not.toBeNull();
      const e = g.spawnEnemy('possessed_stuffie', clone!.x + 20, clone!.y, { exact: true, hpMult: 50 })!;
      e.speed = 0;
      const hp = e.hp;
      for (let i = 0; i < 125; i++) {
        e.x = e.px = clone!.x + 20;
        e.y = e.py = clone!.y;
        g.tick();
      }
      const lost = hp - e.hp;
      if (character === 'mira') expect(lost).toBeGreaterThanOrEqual(MIRA_HALO.dmg * 2 * 0.9); // two cuts or more, at the halo's damage
      else expect(lost).toBe(0); // anyone else's mirror needs a weapon to reflect
    }
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
    const m = makeGame({ tier: 'normal' });
    const n = makeGame({ tier: 'nightmare' });
    const em = m.spawnEnemy('evil_clown', 0, 800)!;
    const en = n.spawnEnemy('evil_clown', 0, 800)!;
    expect(en.maxHp / em.maxHp).toBeCloseTo(TIERS.nightmare.hpMult, 2);
    expect(en.dmg / em.dmg).toBeCloseTo(TIERS.nightmare.dmgMult, 2);
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
