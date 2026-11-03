// World tiers (D-97, docs/WORLD_TIER_DESIGN.md): the save migration, the unlock rules, each tier's numbers and the
// co-op tier sync with its eligibility rules.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { Game } from '../src/sim/game';
import { SaveManager, migrate, NORMAL_FINALS, PRE_MIGRATION, SAVE_VERSION, freshSave, type StorageLike } from '../src/meta/save';
import { DAILY_SCALING, TIERS, TIER_IDS, nextTier, tierAtLeast } from '../src/data/tiers';
import { MAP_IDS } from '../src/data/maps';
import { LoopbackNet } from '../src/net/link';
import { GuestSession, HostSession, runConfigFromStart, type HostProfile } from '../src/net/session';
import { PROTO, parseHostMsg, type GuestProfile } from '../src/net/protocol';

function mem(init: Record<string, string> = {}): StorageLike & { m: Map<string, string> } {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

/** A v5 save as the live alpha writes them (D-78 onward), with the given achievements and extras. */
function v5(achievements: string[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 5, lostTickets: 4321, totalEarned: 9876, perks: { might: 3, greed: 2 }, unlocks: ['w_orbs', 'char_mira', 'w_calliope'],
    achievements, pedia: ['evil_clown', 'w_orbs'], stats: { runs: 40, wins: 9, kills: 52000, bestTime: 1500, bossKills: { ringmaster: 4 }, playSeconds: 36000 },
    history: [{ date: '2026-10-01T00:00:00.000Z', character: 'carny', difficulty: 'carnival', won: true, time: 1500, kills: 2000, level: 40, lostTickets: 900, curse: false, endless: false, daily: false }],
    daily: { '20261001': { score: 5000, won: true, character: 'mira' } }, last: { character: 'mira', difficulty: 'nightmare', curse: true, map: 'boardwalk' },
    settings: { master: 0.5, music: 0.2 }, quests: { last_song: { completions: 2, bestStage: 6 }, unreflected: { completions: 0, bestStage: 3 } },
    pet: 'milo', spent: 1200, midwayTester: true,
    ...extra,
  };
}

const ALL_FINALS = Object.values(NORMAL_FINALS);

// ===================================================================================== the migration
describe('save v6: the world-tier migration', () => {
  it('a fresh v5 save gets Normal only, no wins, no ceremonies seen', () => {
    const d = migrate(v5([]));
    expect(d.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(7);
    expect(d.tiers).toEqual({ unlocked: ['normal'], wins: { normal: {}, nightmare: {}, hell: {} }, seen: [] });
    expect(d.last.tier).toBe('normal');
  });

  it('a partly played save carries its Normal wins over from the final bosses, opening no tier', () => {
    const d = migrate(v5(['first_night', 'beat_ringmaster', 'beat_proprietor']));
    expect(d.tiers.unlocked).toEqual(['normal']);
    expect(d.tiers.wins.normal).toEqual({ carnival_core: 1, fun_house: 1 });
    expect(d.tiers.wins.nightmare).toEqual({});
  });

  it('a save that finished the Ghost Train opens Nightmare, never Hell', () => {
    const d = migrate(v5(['beat_ringmaster', 'beat_proprietor', 'beat_leviathan', 'beat_night_express', 'win_carnival', 'win_nightmare']));
    expect(d.tiers.unlocked).toEqual(['normal', 'nightmare']);
    expect(d.tiers.wins.normal).toEqual({ carnival_core: 1, fun_house: 1, boardwalk: 1, ghost_train: 1 });
    expect(d.tiers.wins.nightmare).toEqual({});
    expect(d.tiers.wins.hell).toEqual({});
    // the ceremony is still to be shown (the reveal for testers who already finished)
    expect(d.tiers.seen).toEqual([]);
  });

  it('a Ghost Train win alone (a tester flag skipped the maps before it) still opens Nightmare', () => {
    const d = migrate(v5(['beat_night_express'], { ghosttrainTester: true }));
    expect(d.tiers.unlocked).toEqual(['normal', 'nightmare']);
    expect(d.tiers.wins.normal).toEqual({ ghost_train: 1 });
  });

  it('keeps everything else of a rich save exactly', () => {
    const raw = v5([...ALL_FINALS, 'win_carnival', 'win_nightmare', 'full_house']);
    const before = JSON.parse(JSON.stringify(raw));
    const d = migrate(raw);
    expect(d.lostTickets).toBe(4321);
    expect(d.totalEarned).toBe(9876);
    expect(d.perks).toEqual({ might: 3, greed: 2 });
    // (D-98, on through v7: what its bosses give)
    expect(d.unlocks).toEqual(['w_orbs', 'char_mira', 'w_calliope', 'w_mirror', 'w_undertow', 'w_whistle']);
    expect(d.achievements).toEqual(before.achievements);
    expect(d.pedia).toEqual(before.pedia);
    expect(d.stats).toEqual(before.stats);
    expect(d.history).toEqual(before.history);
    expect(d.daily).toEqual(before.daily);
    expect(d.quests).toEqual(before.quests);
    expect(d.pet).toBe('milo');
    expect(d.spent).toBe(1200);
    expect(d.midwayTester).toBe(true);
    expect(d.settings.master).toBe(0.5);
    expect(d.last.character).toBe('mira');
    expect(d.last.map).toBe('boardwalk');
    expect(d.last.curse).toBe(true);
  });

  it('is deterministic and idempotent', () => {
    const raw = v5([...ALL_FINALS]);
    const a = migrate(JSON.parse(JSON.stringify(raw)));
    const b = migrate(JSON.parse(JSON.stringify(raw)));
    expect(a).toEqual(b);
    expect(migrate(JSON.parse(JSON.stringify(a)))).toEqual(a);
  });

  it('runs the whole chain from a v1 (Godot-era) save', () => {
    const d = migrate({ lost_tickets: 77, unlocks: ['crystal_orbs'], perks: {}, pedia: [] });
    expect(d.version).toBe(7);
    expect(d.lostTickets).toBeGreaterThanOrEqual(77);
    expect(d.tiers.unlocked).toEqual(['normal']);
  });

  it('cleans a damaged tier record: Normal always open, unknown tiers and maps and bad counts dropped', () => {
    const d = migrate({ ...freshSave(), tiers: { unlocked: ['hell', 'bogus', 'hell'], wins: { normal: { carnival_core: 2.7, nowhere: 3, fun_house: -1 }, nightmare: 'x', limbo: { carnival_core: 1 } }, seen: ['nightmare', 7] }, last: { character: 'carny', curse: false, tier: 'purgatory' } });
    expect(d.tiers.unlocked).toEqual(['normal', 'hell']);
    expect(d.tiers.wins).toEqual({ normal: { carnival_core: 2 }, nightmare: {}, hell: {} });
    expect(d.tiers.seen).toEqual(['nightmare']);
    expect(d.last.tier).toBe('normal');
  });

  it('falls back to Normal when the last tier played is not open', () => {
    const d = migrate({ ...freshSave(), last: { character: 'carny', curse: false, tier: 'hell' } });
    expect(d.last.tier).toBe('normal');
  });

  it('keeps the text of an older save once, under its old version, before migrating it', () => {
    const txt = JSON.stringify(v5(['beat_night_express']));
    const store = mem({ nightmare_carnival_save: txt });
    const s = new SaveManager(store);
    expect(s.tierUnlocked('nightmare')).toBe(true);
    expect(store.m.get(PRE_MIGRATION + '5')).toBe(txt);
    s.save();
    // the next load reads v6: no copy of it, and the v5 copy stays as it was
    store.m.set(PRE_MIGRATION + '5', txt);
    const again = new SaveManager(store);
    expect(again.tierUnlocked('nightmare')).toBe(true);
    expect(store.m.get(PRE_MIGRATION + '6')).toBeUndefined();
    expect(store.m.get(PRE_MIGRATION + '5')).toBe(txt);
    // a second read of a v5 save never overwrites the first copy
    const store2 = mem({ nightmare_carnival_save: txt, [PRE_MIGRATION + '5']: 'first' });
    new SaveManager(store2);
    expect(store2.m.get(PRE_MIGRATION + '5')).toBe('first');
  });

  it('recovers from a corrupt main save through the backup, migrating it too', () => {
    const store = mem({ nightmare_carnival_save: '{not json', nightmare_carnival_save_backup: JSON.stringify(v5(['beat_night_express'])) });
    const s = new SaveManager(store);
    expect(s.recovered).toBe(true);
    expect(s.tierUnlocked('nightmare')).toBe(true);
    expect(s.data.lostTickets).toBe(4321);
  });
});

// ===================================================================================== the rules
describe('world tiers: unlocks and maps', () => {
  it('orders the tiers and opens each from the one before', () => {
    expect(TIER_IDS).toEqual(['normal', 'nightmare', 'hell']);
    expect(nextTier('normal')).toBe('nightmare');
    expect(nextTier('nightmare')).toBe('hell');
    expect(nextTier('hell')).toBeNull();
    expect(tierAtLeast('hell', 'nightmare')).toBe(true);
    expect(tierAtLeast('normal', 'nightmare')).toBe(false);
    // each tier is tougher than the one before on every axis, and pays more
    for (const k of ['hpMult', 'dmgMult', 'cap', 'greed', 'eliteAffixes', 'eliteChanceMult', 'xpMult', 'speedMult'] as const) {
      expect(TIERS.nightmare[k]).toBeGreaterThan(TIERS.normal[k]);
      expect(TIERS.hell[k]).toBeGreaterThan(TIERS.nightmare[k]);
    }
    expect(TIERS.nightmare.spawnMult).toBeLessThan(1);
    expect(TIERS.hell.spawnMult).toBeLessThan(TIERS.nightmare.spawnMult);
  });

  it('keeps Normal on its own rules (bosses, the Midway, tester flags)', () => {
    const s = new SaveManager(mem());
    expect(MAP_IDS.map((m) => s.mapAvailableOn('normal', m))).toEqual([true, false, false, false]);
    s.grantAchievements(['beat_ringmaster']);
    expect(s.mapAvailableOn('normal', 'fun_house')).toBe(true);
    s.data.boardwalkTester = true;
    expect(s.mapAvailableOn('normal', 'boardwalk')).toBe(true);
    // a Normal win records but opens nothing by itself (Normal's maps follow their bosses)
    expect(s.recordTierWin('normal', 'carnival_core')).toEqual({ maps: [], tier: null });
    expect(s.tierWins('normal', 'carnival_core')).toBe(1);
  });

  it('chains Nightmare and Hell map by map, with no Easter egg needed', () => {
    const s = new SaveManager(mem());
    for (const m of MAP_IDS) expect(s.mapAvailableOn('nightmare', m)).toBe(false);
    s.data.ghosttrainTester = true;
    // the Normal campaign's end opens Nightmare
    expect(s.countsFor('normal', 'ghost_train')).toBe(true);
    expect(s.recordTierWin('normal', 'ghost_train')).toEqual({ maps: [], tier: 'nightmare' });
    expect(s.tierUnlocked('nightmare')).toBe(true);
    expect(MAP_IDS.map((m) => s.mapAvailableOn('nightmare', m))).toEqual([true, false, false, false]);
    expect(s.recordTierWin('nightmare', 'carnival_core')).toEqual({ maps: ['fun_house'], tier: null });
    expect(s.recordTierWin('nightmare', 'fun_house')).toEqual({ maps: ['boardwalk'], tier: null });
    expect(s.recordTierWin('nightmare', 'boardwalk')).toEqual({ maps: ['ghost_train'], tier: null });
    expect(s.tierUnlocked('hell')).toBe(false);
    expect(s.recordTierWin('nightmare', 'ghost_train')).toEqual({ maps: [], tier: 'hell' });
    expect(MAP_IDS.map((m) => s.mapAvailableOn('hell', m))).toEqual([true, false, false, false]);
    // a second win opens nothing new; Hell's Ghost Train opens no tier
    expect(s.recordTierWin('nightmare', 'ghost_train')).toEqual({ maps: [], tier: null });
    expect(s.tierWins('nightmare', 'ghost_train')).toBe(2);
    for (const m of MAP_IDS) s.recordTierWin('hell', m);
    expect(s.tierComplete('hell')).toBe(true);
    expect(s.data.quests).toEqual({});
    // earlier tiers stay open, their records untouched
    expect(s.tierWins('normal', 'ghost_train')).toBe(1);
    expect(s.mapAvailableOn('nightmare', 'ghost_train')).toBe(true);
  });

  it('only counts a night for a save that has its tier and map open', () => {
    const s = new SaveManager(mem());
    expect(s.countsFor('nightmare', 'carnival_core')).toBe(false);
    expect(s.countsFor('normal', 'fun_house')).toBe(false);
    s.unlockTier('nightmare');
    expect(s.countsFor('nightmare', 'carnival_core')).toBe(true);
    expect(s.countsFor('nightmare', 'fun_house')).toBe(false);
    expect(s.countsFor('hell', 'carnival_core')).toBe(false);
    expect(s.openPairs()).toEqual(['normal:carnival_core', 'nightmare:carnival_core']);
  });

  it('picks the tier a map is open on, preferring the one asked for', () => {
    const s = new SaveManager(mem());
    s.unlockTier('nightmare');
    s.grantAchievements(['beat_ringmaster']);
    expect(s.bestTierFor('fun_house', 'nightmare')).toBe('normal');
    expect(s.bestTierFor('carnival_core', 'nightmare')).toBe('nightmare');
    s.recordTierWin('nightmare', 'carnival_core');
    expect(s.bestTierFor('fun_house', 'normal')).toBe('normal');
    expect(s.bestTierFor('fun_house', 'hell')).toBe('nightmare');
  });

  it('closes a tier and those above it (the dev tools), the last tier falling back', () => {
    const s = new SaveManager(mem());
    s.unlockTier('nightmare');
    s.unlockTier('hell');
    s.data.last.tier = 'hell';
    s.lockTier('nightmare');
    expect(s.data.tiers.unlocked).toEqual(['normal']);
    expect(s.lastTier()).toBe('normal');
    s.lockTier('normal');
    expect(s.data.tiers.unlocked).toEqual(['normal']);
  });
});

// ===================================================================================== each tier's night
describe('world tiers: the night', () => {
  it('scales the crowd by the tier', () => {
    const base = makeGame({ tier: 'normal' }).spawnEnemy('evil_clown', 0, 800)!;
    for (const t of ['nightmare', 'hell'] as const) {
      const g = makeGame({ tier: t });
      expect(g.tier).toBe(t);
      const e = g.spawnEnemy('evil_clown', 0, 800)!;
      expect(e.maxHp / base.maxHp).toBeCloseTo(TIERS[t].hpMult, 2);
      expect(e.dmg / base.dmg).toBeCloseTo(TIERS[t].dmgMult, 2);
      expect(e.speed / base.speed).toBeCloseTo(TIERS[t].speedMult, 2);
      expect(g.diff.cap).toBe(TIERS[t].cap);
    }
  });

  it('keeps the Daily Run on its own scaling and the Midway on Normal', () => {
    const d = makeGame({ tier: 'hell', daily: true, dailyMod: 'none' });
    expect(d.tier).toBe('normal');
    expect(d.diff).toBe(DAILY_SCALING);
    const hub = new Game({ character: 'carny', tier: 'hell', curse: false, seed: 1, hub: { npcs: [] } });
    expect(hub.tier).toBe('normal');
    expect(makeGame({ tier: 'bogus' as never }).tier).toBe('normal');
  });

  it('pays more on the higher tiers and reports the tier in the night\'s results', () => {
    const run = (t: 'normal' | 'hell') => {
      const g = makeGame({ tier: t, godMode: true });
      g.time = 600;
      g.kills = 3000;
      g.endRun(true);
      return g.endStats!;
    };
    const n = run('normal'), h = run('hell');
    expect(h.tier).toBe('hell');
    expect(n.tier).toBe('normal');
    expect(h.lostTickets).toBeGreaterThan(n.lostTickets);
    // the old difficulties' wins are no longer earned
    expect(h.achievementsHit).not.toContain('win_nightmare');
    expect(h.achievementsHit).not.toContain('win_carnival');
  });
});

// ===================================================================================== co-op
const hostProfile: HostProfile = { name: 'Kevin', meta: [], rerolls: 0, banishes: 0, canSkip: false, aimMode: 'auto' };
const guestOf = (open?: string[]): GuestProfile => ({ name: 'Brother', meta: [], rerolls: 0, banishes: 0, canSkip: false, aimMode: 'auto', chars: ['carny', 'strongman'], open });

function party(open?: string[]) {
  const net = new LoopbackNet({});
  const host = new HostSession('TIERS2', hostProfile);
  const [h, g] = net.pair();
  host.accept(h);
  let now = 1000;
  const guest = new GuestSession(g, guestOf(open), null, now);
  guest.onStart = (cfg) => new Game(runConfigFromStart(cfg));
  const run = (ms: number) => {
    const end = now + ms;
    while (now < end) {
      now += 1000 / 60;
      net.pump(now);
      host.update(now, 1000 / 60);
      guest.update(now);
    }
  };
  run(300);
  return { host, guest, run };
}

describe('world tiers in co-op', () => {
  it('syncs the host\'s tier to every guest and into the night', () => {
    expect(PROTO).toBe(21); // (D-99: the upgrades' qualities on the wire)
    const { host, guest, run } = party(['normal:carnival_core', 'nightmare:carnival_core']);
    host.setTier('nightmare', true);
    host.setCharacter('carny');
    guest.pick('strongman');
    run(200);
    expect(guest.lobby?.tier).toBe('nightmare');
    expect(guest.lobby?.curse).toBe(true);
    host.setReady(true);
    guest.setReady(true);
    run(200);
    const cfg = host.start({ seed: 7, unlocked: [], questMemory: {} })!;
    expect(cfg.tier).toBe('nightmare');
    run(300);
    expect(guest.game?.tier).toBe('nightmare');
    expect(guest.game?.diff.hpMult).toBe(TIERS.nightmare.hpMult);
  });

  it('tells the lobby whom a night counts for, from each guest\'s own progress', () => {
    const { host, guest, run } = party(['normal:carnival_core']);
    expect(host.lobby.players[0]?.counts).toBe(true);
    expect(host.lobby.players[1]?.counts).toBe(true);
    host.setTier('hell', false);
    run(200);
    expect(host.lobby.players[1]?.counts).toBe(false);
    expect(guest.lobby?.players[1]?.counts).toBe(false);
    // the guest opens Nightmare and Hell's first map: the profile update changes the answer
    guest.sendProfile(guestOf(['normal:carnival_core', 'hell:carnival_core']));
    run(200);
    expect(host.lobby.players[1]?.counts).toBe(true);
    host.setMap('fun_house');
    run(100);
    expect(host.lobby.players[1]?.counts).toBe(false);
  });

  it('validates the tier and the open pairs on arrival', () => {
    const start = (tier: unknown) => parseHostMsg(JSON.stringify({ t: 'start', slot: 1, epoch: 1, cfg: { seed: 5, tier, curse: false, unlocked: [], questMemory: {}, players: [{ character: 'carny', name: 'A' }] } }));
    const ok = start('hell');
    expect(ok && ok.t === 'start' && ok.cfg.tier).toBe('hell');
    const bad = start('purgatory');
    expect(bad && bad.t === 'start' && bad.cfg.tier).toBe('normal');
    const lobby = parseHostMsg(JSON.stringify({ t: 'lobby', you: 1, lobby: { code: 'ABC234', players: [{ name: 'A', character: 'carny', ready: false, counts: false }], map: 'fun_house', tier: 'nightmare', curse: false, inRun: false } }));
    expect(lobby && lobby.t === 'lobby' && lobby.lobby.tier).toBe('nightmare');
    expect(lobby && lobby.t === 'lobby' && lobby.lobby.players[0]?.counts).toBe(false);
  });

  it('drops unknown pairs from a guest profile', async () => {
    const { cleanProfile } = await import('../src/net/protocol');
    const p = cleanProfile({ ...guestOf(), open: ['normal:carnival_core', 'hell:nowhere', 'heaven:fun_house', 42, 'nightmare:ghost_train'] });
    expect(p?.open).toEqual(['normal:carnival_core', 'nightmare:ghost_train']);
  });
});

// ===================================================================================== the tiers' shelves
describe('the Nightmare and Hell shelves', () => {
  const withMeta = (meta: { axis: string; value: number }[], o: Record<string, unknown> = {}) => makeGame({ meta, godMode: false, ...o });

  it('sells a shelf only once its tier is open, and switches the Bargain on and off', async () => {
    const s = new SaveManager(mem());
    s.data.lostTickets = 1e6;
    expect(s.buyPerk('second_chance')).toBe(false);
    s.unlockTier('nightmare');
    expect(s.buyPerk('second_chance')).toBe(true);
    expect(s.buyPerk('devils_bargain')).toBe(false);
    s.unlockTier('hell');
    expect(s.buyPerk('devils_bargain')).toBe(true);
    expect(s.metaStats()).toContainEqual({ axis: 'bargain', value: 1 });
    s.setInPool('devils_bargain', false);
    expect(s.metaStats().some((m) => m.axis === 'bargain')).toBe(false);
    // a guest's shelf levels arrive within the shelf's caps
    const { cleanProfile } = await import('../src/net/protocol');
    const p = cleanProfile({ ...guestOf(), meta: [{ axis: 'soulCollector', value: 9 }, { axis: 'secondChance', value: 1 }] });
    expect(p?.meta).toEqual([{ axis: 'soulCollector', value: 3 }, { axis: 'secondChance', value: 1 }]);
  });

  it("Devil's Bargain trades a quarter of the health for 30% might", () => {
    const base = withMeta([]).player.stats;
    const g = withMeta([{ axis: 'bargain', value: 1 }]);
    expect(g.player.stats.maxHp()).toBeCloseTo(base.maxHp() * 0.75, 3);
    expect(g.player.stats.might).toBeCloseTo(base.might + 0.3, 5);
  });

  it('Second Chance saves one fatal blow a night', () => {
    const g = withMeta([{ axis: 'secondChance', value: 1 }]);
    g.phase = 'play';
    const p = g.player;
    p.hp = 5;
    p.iframes = 0;
    expect(g.hurtPlayer(50, p.x + 10, p.y)).toBe(true);
    expect(p.hp).toBeCloseTo(p.stats.maxHp() * 0.3, 3);
    expect(p.iframes).toBeGreaterThan(2);
    expect(g.phase).toBe('play');
    p.hp = 5;
    p.iframes = 0;
    g.hurtPlayer(50, p.x + 10, p.y);
    expect(g.phase).toBe('ended');
  });

  it('Soul Collector: elites give souls of might that fade', () => {
    const g = withMeta([{ axis: 'soulCollector', value: 2 }]);
    const m0 = g.player.stats.might;
    for (let i = 0; i < 4; i++) {
      const e = g.spawnEnemy('evil_clown', 400, 400 + i * 30)!;
      e.elite = true;
      g.killEnemy(e);
    }
    expect(g.player.souls).toBe(3);
    g.tick();
    expect(g.player.stats.might).toBeCloseTo(m0 + 3 * 0.06, 5);
    g.player.soulT = 0.001;
    g.tick();
    g.tick();
    expect(g.player.souls).toBe(0);
    expect(g.player.stats.might).toBeCloseTo(m0, 5);
  });

  it('Prize Hunter raises the elites\' chest odds by the party\'s best level', async () => {
    const { eliteChestMult } = await import('../src/sim/tierPerks');
    expect(eliteChestMult(withMeta([]))).toBe(1);
    expect(eliteChestMult(withMeta([{ axis: 'prizeHunter', value: 2 }]))).toBe(2);
    const duo = makeGame({ players: [{ character: 'carny' }, { character: 'strongman', meta: [{ axis: 'prizeHunter', value: 1 }] }] });
    expect(eliteChestMult(duo)).toBe(1.5);
  });

  it('Opening Act opens a draft for its owner alone at the start of the night', () => {
    const duo = makeGame({ players: [{ character: 'carny' }, { character: 'strongman', meta: [{ axis: 'openingAct', value: 1 }] }] });
    let n = 0;
    while (duo.phase === 'play' && n++ < 200) duo.tick();
    expect(duo.phase).toBe('draft');
    expect(duo.draftPending(0)).toBe(false);
    expect(duo.draftPending(1)).toBe(true);
    expect(duo.level).toBe(1);
    duo.chooseDraft(0, 1);
    expect(duo.phase).toBe('play');
    for (let i = 0; i < 200; i++) duo.tick();
    expect(duo.openingActDone).toBe(true);
  });

  it('Second Wind, Final Act, Unfinished Business, Infernal Resilience and Ember Heart', async () => {
    const { mealHeal, telegraphedDamage } = await import('../src/sim/tierPerks');
    const { DAWN_TIME } = await import('../src/data/waves');
    const w = withMeta([{ axis: 'secondWind', value: 3 }]);
    expect(mealHeal(w.player, 10)).toBeCloseTo(16, 5);
    expect(w.player.windT).toBeGreaterThan(0);
    const f = withMeta([{ axis: 'finalAct', value: 2 }]);
    const fm = f.player.stats.might;
    f.time = DAWN_TIME - 200;
    f.tick();
    expect(f.player.stats.might).toBeCloseTo(fm + 0.24, 5);
    const u = withMeta([{ axis: 'unfinished', value: 3 }]);
    const um = u.player.stats.might, uMult = u.player.stats.maxHpMult;
    u.bossKills = 2;
    u.tick();
    expect(u.player.stats.might).toBeCloseTo(um + 0.1, 5);
    expect(u.player.stats.maxHp()).toBeCloseTo(u.player.stats.baseHp * (uMult + 0.08), 5);
    const r = withMeta([{ axis: 'infernal', value: 3 }]);
    expect(telegraphedDamage(r.player, 20)).toBeCloseTo(15, 5);
    const e = withMeta([{ axis: 'emberHeart', value: 2 }]);
    const a0 = e.player.stats.armor;
    e.player.hp = e.player.stats.maxHp() * 0.2;
    const hp0 = e.player.hp;
    for (let i = 0; i < 60; i++) e.tick();
    expect(e.player.stats.armor).toBe(a0 + 4);
    expect(e.player.hp).toBeGreaterThan(hp0 + 1.5);
  });
});

// ===================================================================================== creature variants
describe('creature variants', () => {
  it('gives about half of each map\'s kinds an ability per tier, none on Normal', async () => {
    const { VARIANTS, variantBits, ABILITY_BITS } = await import('../src/data/variants');
    const { ENEMIES } = await import('../src/data/enemies');
    for (const t of ['nightmare', 'hell'] as const) {
      for (const id of Object.keys(VARIANTS[t])) expect(ENEMIES[id], id).toBeTruthy();
      expect(Object.keys(VARIANTS[t]).length).toBeGreaterThanOrEqual(25);
    }
    expect(variantBits('normal', 'evil_clown')).toBe(0);
    expect(variantBits('nightmare', 'evil_clown')).toBe(ABILITY_BITS.phase);
    expect(variantBits('hell', 'carnival_brute')).toBe(ABILITY_BITS.quake | ABILITY_BITS.harden);
    // no Nightmare ability on Hell, and the other way round
    for (const a of Object.values(VARIANTS.hell).flat()) expect(['blast', 'trail', 'ember', 'enrage', 'quake', 'harden']).toContain(a);
    for (const a of Object.values(VARIANTS.nightmare).flat()) expect(['phase', 'decoy', 'blink', 'wail', 'haunt']).toContain(a);
  });

  it('phasing: a shimmer, then two seconds untouchable and harmless, then solid again', async () => {
    const { phased } = await import('../src/sim/variants');
    const g = makeGame({ tier: 'nightmare', godMode: true });
    const e = g.spawnEnemy('evil_clown', 300, 300)!;
    expect(e.vAb).toBeGreaterThan(0);
    e.vT = 0.01;
    let n = 0;
    while (!phased(e) && n++ < 120) g.tick();
    expect(phased(e)).toBe(true);
    expect(g.damageEnemy(e, 50, false, 0, 0, 0, '')).toBe(0);
    for (let i = 0; i < 150; i++) g.tick();
    expect(phased(e)).toBe(false);
    expect(g.damageEnemy(e, 1, false, 0, 0, 0, '')).toBeGreaterThan(0);
  });

  it('plating halves the first hits; wrath flares below 40%; a volatile one explodes', () => {
    const g = makeGame({ tier: 'hell', godMode: true });
    const b = g.spawnEnemy('carnival_brute', 400, 400)!;
    b.hp = b.maxHp = 1000;
    expect(g.damageEnemy(b, 10, false, 0, 0, 0, '')).toBeCloseTo(5, 5);
    for (let i = 0; i < 3; i++) g.damageEnemy(b, 10, false, 0, 0, 0, '');
    expect(b.vHits).toBe(0);
    expect(g.damageEnemy(b, 10, false, 0, 0, 0, '')).toBeCloseTo(10, 5);
    const c = g.spawnEnemy('evil_clown', 500, 500)!;
    const sp = c.speed, dmg = c.dmg;
    c.hp = c.maxHp * 0.3;
    g.tick();
    expect(c.speed).toBeCloseTo(sp * 1.4, 5);
    expect(c.dmg).toBeCloseTo(dmg * 1.4, 5);
    const v = g.spawnEnemy('living_balloon', 600, 600)!;
    const before = g.hazards.filter((h) => h.alive).length;
    g.killEnemy(v);
    expect(g.hazards.filter((h) => h.alive && h.style === 'blast').length).toBe(1);
    expect(g.hazards.filter((h) => h.alive).length).toBe(before + 1);
  });

  it('ectoplasm sheds two harmless one-hit illusions', () => {
    const g = makeGame({ tier: 'nightmare', godMode: true });
    const e = g.spawnEnemy('possessed_stuffie', 300, 300)!;
    e.hp = e.maxHp = 500;
    g.damageEnemy(e, 5, false, 0, 0, 0, '');
    const ill = g.active.filter((x) => x.alive && x.illusion && x.illusionOf === e.uid);
    expect(ill.length).toBe(2);
    for (const x of ill) {
      expect(x.noContact).toBe(true);
      expect(x.tickets).toBe(0);
      expect(x.vAb).toBe(0);
    }
  });

  it("guests see a variant's states", () => {
    const { host, guest, run } = party(['normal:carnival_core', 'nightmare:carnival_core']);
    host.setTier('nightmare', false);
    host.setCharacter('carny');
    guest.pick('strongman');
    run(200);
    host.setReady(true);
    guest.setReady(true);
    run(200);
    const cfg = host.start({ seed: 9, unlocked: [], questMemory: {} })!;
    const g = new Game({ ...runConfigFromStart(cfg), godMode: true });
    host.attachGame(g);
    run(300);
    const e = g.spawnEnemy('evil_clown', g.players[1].x + 120, g.players[1].y)!;
    e.vFlags = 1 | 4;
    e.vAb = 0; // hold the states still for the check
    for (let i = 0; i < 30; i++) {
      host.beforeTick(g);
      g.tick();
      run(1000 / 60);
    }
    const m = guest.game!.active.find((x) => x.alive && x.def.id === 'evil_clown' && Math.abs(x.x - e.x) < 40);
    expect(m?.vFlags).toBe(5);
  });
});

describe("the bosses' tier attacks", () => {
  it('telegraph a choir on Nightmare and a firestorm on Hell, harder for the final boss, none on Normal', async () => {
    const { tickBossTier } = await import('../src/sim/variants');
    const count = (t: 'normal' | 'nightmare' | 'hell', final: boolean) => {
      const g = makeGame({ tier: t, godMode: true });
      const b = { x: g.player.x + 300, y: g.player.y, awake: true, dead: false, tierT: 0, def: { id: final ? g.map.finalBoss : 'carnival_tent' } };
      tickBossTier(g, b, 1 / 60);
      const hz = g.hazards.filter((h) => h.alive);
      for (const h of hz) expect(h.tele).toBeGreaterThan(0.4);
      return { n: hz.length, styles: new Set(hz.map((h) => h.style)), next: b.tierT };
    };
    expect(count('normal', true).n).toBe(0);
    const nm = count('nightmare', false), nmF = count('nightmare', true);
    expect(nm.styles).toEqual(new Set(['wail_ring', 'haunt_burst']));
    expect(nmF.n).toBeGreaterThan(nm.n);
    const h = count('hell', false), hF = count('hell', true);
    expect(h.styles.has('fireball')).toBe(true);
    expect(hF.styles.has('quake_ring')).toBe(true);
    expect(hF.n).toBeGreaterThan(h.n);
    expect(hF.next).toBeLessThan(9);
  });
});

describe('tier achievements', () => {
  it('name each map on each tier, the campaigns, the Curse and parties; none on Normal', async () => {
    const { tierAchievements, ACHIEVEMENTS } = await import('../src/data/meta');
    expect(tierAchievements('normal', 'ghost_train', true, 4)).toEqual([]);
    expect(tierAchievements('nightmare', 'fun_house', true, 3)).toEqual(['nm_fun_house', 'nm_cursed', 'tier_party']);
    expect(tierAchievements('hell', 'ghost_train', false, 1)).toEqual(['hell_ghost_train']);
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const t of ['nightmare', 'hell'] as const) for (const m of MAP_IDS) for (const id of tierAchievements(t, m, true, 6)) expect(ids.has(id), id).toBe(true);
    // Hell's campaign is the biggest reward in the game
    const top = Math.max(...ACHIEVEMENTS.map((a) => a.reward));
    expect(ACHIEVEMENTS.find((a) => a.id === 'hell_ghost_train')!.reward).toBe(top);
  });
});

describe("the tiers' passives", () => {
  const withPassive = (id: string, lv = 5) => {
    const g = makeGame({ godMode: true });
    for (let i = 0; i < lv; i++) g.player.addPassive(id);
    return g;
  };

  it('are sold once their map is won on their tier', () => {
    const s = new SaveManager(mem());
    s.data.lostTickets = 1e6;
    expect(s.buyUnlock('p_deaths_door')).toBe(false);
    s.grantAchievements(['nm_boardwalk']);
    expect(s.buyUnlock('p_deaths_door')).toBe(true);
    expect(s.buyUnlock('p_brimstone')).toBe(false);
  });

  it("Death's Door: more might the less health", () => {
    const g = withPassive('deaths_door');
    const m0 = g.player.stats.might;
    g.tick();
    expect(g.player.stats.might).toBeCloseTo(m0, 3);
    g.player.hp = g.player.stats.maxHp() * 0.1;
    g.tick();
    expect(g.player.stats.might).toBeCloseTo(m0 + 0.4 * 0.9, 2);
  });

  it('the Soul Jar breaks in a blast every so many kills', () => {
    const g = withPassive('soul_jar');
    const p = g.player;
    const ring = Array.from({ length: 6 }, (_, i) => g.spawnEnemy('evil_clown', p.x + 60 * Math.cos(i), p.y + 60 * Math.sin(i))!);
    for (const e of ring) e.hp = e.maxHp = 500;
    g.tick(); // (into the spatial grid the blast looks through)
    for (const e of ring) e.hp = 500;
    for (let i = 0; i < 27; i++) g.killEnemy(g.spawnEnemy('evil_clown', p.x + 900, p.y)!);
    expect(ring.every((e) => e.hp === 500)).toBe(true);
    g.killEnemy(g.spawnEnemy('evil_clown', p.x + 900, p.y)!);
    expect(p.jarKills).toBe(0);
    expect(ring.every((e) => e.hp < 500)).toBe(true);
  });

  it('Brimstone sets creatures alight and the burning burst; Cinder Heart heals near them', () => {
    const g = withPassive('brimstone');
    const p = g.player;
    const e = g.spawnEnemy('carnival_brute', p.x + 300, p.y)!;
    e.hp = e.maxHp = 1e6;
    for (let i = 0; i < 200 && e.burnT <= 0; i++) g.damageEnemy(e, 1, false, 0, p.x, p.y, 'throwing_cards');
    expect(e.burnT).toBeGreaterThan(0);
    const near = g.spawnEnemy('carnival_brute', e.x + 30, e.y)!;
    near.hp = near.maxHp = 1e6;
    g.tick();
    near.hp = 1e6;
    e.burnT = Math.max(e.burnT, 1);
    g.killEnemy(e);
    expect(near.hp).toBeLessThan(1e6);
    const c = withPassive('cinder_heart');
    const q = c.player;
    q.hp = q.stats.maxHp() * 0.5;
    const hot = c.spawnEnemy('carnival_brute', q.x + 60, q.y)!;
    hot.burnT = 99;
    hot.burnDps = 0;
    const hp0 = q.hp;
    for (let i = 0; i < 60; i++) c.tick();
    expect(q.hp).toBeGreaterThan(hp0 + 0.3); // one burning creature: 0.36 a second at level 5
  });
});

describe("the tiers' weapons", () => {
  const armed = (id: string) => {
    const g = makeGame({ godMode: true, seed: 3 });
    g.weapons.list.length = 0;
    g.weapons.add(id);
    return g;
  };
  const crowd = (g: Game, n: number, dx = 120) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const e = g.spawnEnemy('carnival_brute', g.player.x + dx + i * 40, g.player.y + (i % 2) * 20)!;
      e.hp = e.maxHp = 1e6;
      e.speed = 0;
      out.push(e);
    }
    return out;
  };

  it("the Watchman's Lantern burns what its sweeping beam lights", () => {
    const g = armed('lantern');
    const [e] = crowd(g, 1);
    g.player.faceX = 1;
    g.player.faceY = 0;
    for (let i = 0; i < 240; i++) g.tick();
    expect(e.hp).toBeLessThan(1e6);
    expect(g.weaponDamage.get('lantern') ?? 0).toBeGreaterThan(0);
  });

  it('Spirit Chains leap through several creatures and bind the last', () => {
    const g = armed('chains');
    const es = crowd(g, 5, 100);
    for (let i = 0; i < 150; i++) g.tick();
    expect(es.filter((e) => e.hp < 1e6).length).toBeGreaterThanOrEqual(3);
    expect(es.some((e) => e.slowT > 0 && e.slowF <= 0.5)).toBe(true);
  });

  it('Fire Breath sets what is in its cone alight', () => {
    const g = armed('breath');
    const [e] = crowd(g, 1, 90);
    g.player.faceX = 1;
    g.player.faceY = 0;
    for (let i = 0; i < 200; i++) g.tick();
    expect(e.hp).toBeLessThan(1e6);
    expect(e.burnT > 0 || (g.weaponDamage.get('breath') ?? 0) > 0).toBe(true);
  });
});
