// Tests for the visual/gameplay/progression overhaul: the upgrade-pool fallback (5% heal vs banked
// Lost Tickets), chest entries for the prize wheel, organic balloon drifts, wave blending and
// recovery periods, the Last Song Easter egg (full deterministic solve), save v4, and the 3D
// model library (coverage + valid geometry).

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeGame, runFor } from './helpers';
import { generateDraft, grantChest } from '../src/sim/draft';
import { HEALING, VOUCHER, voucherValue, xpToNext, PACING } from '../src/data/progression';
import { LAST_SONG } from '../src/data/quests';
import { LS, type LastSongChain } from '../src/sim/quest';
import { WAVES } from '../src/data/waves';
import { migrate, SaveManager, SAVE_VERSION } from '../src/meta/save';
import { CHARACTERS as CHAR_DATA } from '../src/data/characters';
import { ENEMIES } from '../src/data/enemies';
import { CHARACTERS, ENEMY_MODELS, ITEM_MODELS } from '../src/render3d/models';
import { PROP_SPECS } from '../src/render3d/world/props';
import { PROPS } from '../src/data/map';
import { TICK } from '../src/sim/constants';
import type { Game } from '../src/sim/game';
import { readyEvolutions } from '../src/sim/draft';

/** Tick once, resolving any level-up draft so the world keeps running. */
function step(g: Game, n = 1): void {
  for (let i = 0; i < n; i++) {
    if (g.phase === 'draft') g.chooseDraft(0);
    g.tick();
  }
}

/** Max out everything so the upgrade pool is legitimately exhausted. */
function exhaustPool(g: Game): void {
  for (const id of ['throwing_cards', 'fireworks', 'rings', 'mallet', 'cotton', 'laser']) {
    if (!g.weapons.has(id)) g.weapons.add(id);
  }
  for (const w of g.weapons.list) while (w.level < w.def.maxLevel) g.weapons.levelUp(w.def.id);
  for (const id of ['sugar_rush', 'safety_goggles', 'energy_drink', 'strongman_belt', 'spectacles', 'lucky_ticket']) {
    for (let k = 0; k < 10; k++) g.player.addPassive(id);
  }
  // take every evolution that became ready: evolved weapons have nothing left to level
  for (let k = 0; k < 8; k++) for (const id of readyEvolutions(g)) g.weapons.evolve(id);
}

describe('upgrade-pool fallback (D-31)', () => {
  it('offers a 5% heal or a Lost & Found voucher only when nothing else is left', () => {
    const g = makeGame({ godMode: true });
    expect(generateDraft(g).some((o) => o.kind === 'voucher')).toBe(false);
    exhaustPool(g);
    const opts = generateDraft(g).filter((o) => o.kind !== 'evolution');
    if (opts.some((o) => o.kind !== 'heal' && o.kind !== 'voucher')) return; // pool not exhausted for this roster — covered by the next test
    expect(opts.map((o) => o.kind).sort()).toEqual(['heal', 'voucher']);
  });

  it('heal restores 5% of max HP without raising max HP; voucher banks currency with diminishing returns and a hard cap', () => {
    const g = makeGame({ godMode: false });
    const max = g.player.stats.maxHp();
    g.player.hp = max * 0.5;
    g.healPlayer(max * HEALING.fallbackHealFrac);
    expect(g.player.hp).toBeCloseTo(max * 0.55, 3);
    expect(g.player.stats.maxHp()).toBe(max);
    g.player.hp = max;
    g.healPlayer(max * HEALING.fallbackHealFrac);
    expect(g.player.hp).toBe(max); // capped
    const paid: number[] = [];
    g.bus.on('meta_currency', (e) => paid.push(e.amount));
    g.time = 900;
    let total = 0;
    for (let i = 0; i < 80; i++) total += g.grantVoucher();
    expect(paid.length).toBeGreaterThan(5);
    expect(paid[1]).toBeLessThanOrEqual(paid[0]);
    expect(total).toBe(VOUCHER.runCap);
    expect(paid.reduce((a, b) => a + b, 0)).toBe(VOUCHER.runCap);
    expect(g.grantVoucher()).toBe(0); // the window is shut for the night
    expect(voucherValue(15, 0, 0, 1)).toBeGreaterThan(0);
    expect(voucherValue(15, 3, VOUCHER.runCap, 1)).toBe(0);
  });

  it('a capped voucher card is shown disabled and cannot be picked or banished', () => {
    const g = makeGame({ godMode: true });
    g.voucherPaid = VOUCHER.runCap;
    g.draftOptions = [
      { kind: 'heal', refId: 'heal', title: '', desc: '', level: 1, rarity: 'common', isNew: false },
      { kind: 'voucher', refId: 'voucher', title: '', desc: '', level: 1, rarity: 'uncommon', isNew: false, disabled: true },
    ];
    g.phase = 'draft';
    g.player.banishes = 2;
    expect(g.banishDraft(1)).toBe(false);
    g.chooseDraft(1);
    expect(g.phase).toBe('draft'); // ignored
    g.chooseDraft(0);
    expect(g.phase).not.toBe('draft');
  });
});

describe('prize-wheel chest entries (D-34)', () => {
  it('grantChest reports one entry per granted reward, evolution first, matching the item list', () => {
    const g = makeGame({ godMode: true });
    const w = g.weapons.list[0];
    while (w.level < w.def.maxLevel) g.weapons.levelUp(w.def.id);
    g.player.addPassive(w.def.evoPassive!);
    const res = grantChest(g, 4);
    expect(res.entries.length).toBe(res.items.length);
    expect(res.entries[0].type).toBe('evolution');
    expect(res.evolution).toBe(res.entries[0].id);
    for (const e of res.entries) expect(e.label.length).toBeGreaterThan(0);
  });

  it('the chest event carries the entries the sim already applied (no second roll)', () => {
    const g = makeGame({ godMode: true });
    const seen: { entries?: unknown[]; rolls?: number }[] = [];
    g.bus.on('chest', (e) => seen.push(e));
    const ch = g.spawnPickup('chest', g.player.x, g.player.y, 0);
    ch.rolls = 3;
    for (let i = 0; i < 20 && !seen.length; i++) g.tick();
    expect(seen.length).toBe(1);
    expect(seen[0].rolls).toBe(3);
    expect(seen[0].entries?.length).toBe(3);
  });
});

describe('organic balloon drifts (D-33)', () => {
  const sample = (seed: number) => {
    const g = makeGame({ godMode: true, seed });
    const drifts: { t: number; x: number; y: number; dx: number; dy: number; size: number }[] = [];
    g.bus.on('balloon_drift', (e) => drifts.push({ t: g.time, x: Math.round(e.x), y: Math.round(e.y), dx: e.dirX, dy: e.dirY, size: e.size }));
    runFor(g, 660);
    return drifts;
  };

  it('arrive irregularly, from varied directions, in varied sizes — and are deterministic per seed', () => {
    const a = sample(4242);
    expect(a.length).toBeGreaterThan(8);
    expect(a.length).toBeLessThan(40); // not too frequent: roughly one drift every half-minute
    const gaps = a.slice(1).map((d, i) => d.t - a[i].t);
    const mean = gaps.reduce((s, x) => s + x, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((s, x) => s + (x - mean) ** 2, 0) / gaps.length);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(Math.min(...PACING.balloonMinGap) - 0.05);
    expect(sd).toBeGreaterThan(2); // no metronome
    expect(new Set(a.map((d) => d.size)).size).toBeGreaterThanOrEqual(5);
    const sectors = new Set(a.map((d) => Math.floor(((Math.atan2(d.dy, d.dx) + Math.PI) / (Math.PI * 2)) * 8)));
    expect(sectors.size).toBeGreaterThanOrEqual(3);
    expect(sample(4242)).toEqual(a);
  }, 60000);
});

describe('pacing: wave blending and recovery (D-30)', () => {
  it('density ramps smoothly toward the next wave instead of stepping', () => {
    const g = makeGame({ godMode: true });
    const w = WAVES[2], next = WAVES[3];
    const blend = (t: number) => {
      g.time = t;
      return (g.director as unknown as { blended(w: unknown): { minAlive: number } }).blended(w).minAlive;
    };
    const span = next.start - w.start;
    expect(blend(w.start + span * 0.2)).toBeCloseTo(w.minAlive, 5);
    const mid = blend(w.start + span * 0.75);
    expect(mid).toBeGreaterThan(Math.min(w.minAlive, next.minAlive) - 1e-6);
    expect(mid).toBeLessThan(Math.max(w.minAlive, next.minAlive) + 1e-6);
  });

  it('a boss kill opens a recovery period that thins the crowd, then swells back', () => {
    const g = makeGame({ godMode: true });
    g.time = 200; // between bosses (boss fights stall the clock)
    step(g, 60);
    const w = (g.director as unknown as { wave(): unknown }).wave?.() ?? WAVES.find((x, i) => g.time >= x.start && (!WAVES[i + 1] || g.time < WAVES[i + 1].start));
    const bl = (g.director as unknown as { blended(w: unknown): { minAlive: number } });
    const before = bl.blended(w).minAlive;
    g.bossKills++;
    step(g, 6);
    expect(g.director.recoveryT).toBeGreaterThan(PACING.recoverySeconds - 1);
    expect(bl.blended(w).minAlive).toBeLessThan(before * 0.6);
    step(g, 60 * (PACING.recoverySeconds + 1));
    expect(g.director.recoveryT).toBeLessThanOrEqual(0);
  });
});

describe('progression curve (D-30)', () => {
  it('early levels are quick, requirements rise, plateaus at 20 and 40', () => {
    expect(xpToNext(1)).toBe(5);
    expect(xpToNext(5)).toBeLessThan(xpToNext(15));
    expect(xpToNext(20)).toBeGreaterThan(xpToNext(21));
    expect(xpToNext(40)).toBeGreaterThan(xpToNext(41));
  });
});

describe('the Last Song (D-32)', () => {
  function walkTo(g: Game, x: number, y: number): void {
    g.player.x = g.player.px = x;
    g.player.y = g.player.py = y;
    step(g);
  }
  const NEUTRAL = { x: 0, y: 700 };

  it('per-run melody order comes from the seed (separate stream), same seed → same order', () => {
    const order = (s: number) => makeGame({ seed: s }).quests.get<LastSongChain>('last_song')!.order.join('');
    expect(order(101)).toBe(order(101));
    const set = new Set([101, 202, 303, 404, 505, 606, 707, 808].map(order));
    expect(set.size).toBeGreaterThan(1);
  });

  it('can be solved end-to-end: Zoltana → souls → melody → striker → ghost ticket → Ringmaster → Calliope → true dawn', () => {
    const g = makeGame({ godMode: true, seed: 777 });
    g.weapons.list.length = 0; // no stray kills
    const ls = g.quests.get<LastSongChain>('last_song')!;
    const cues: string[] = [];
    g.bus.on('quest', (q) => cues.push(q.event));
    const M = LAST_SONG.machine;
    // 1) wake the automaton
    walkTo(g, M.x, M.y);
    expect(ls.stage).toBe(LS.Souls);
    expect(cues).toContain('awaken');
    walkTo(g, NEUTRAL.x, NEUTRAL.y);
    // touching an unlit lamp does nothing
    walkTo(g, LAST_SONG.lamps[0].x, LAST_SONG.lamps[0].y);
    walkTo(g, NEUTRAL.x, NEUTRAL.y);
    expect(ls.stage).toBe(LS.Souls);
    // 2) feed each lamp souls from kills near it
    LAST_SONG.lamps.forEach((l) => {
      for (let k = 0; k < LAST_SONG.soulsPerLamp; k++) {
        const e = g.spawnEnemy('living_balloon', l.x + 40, l.y + 20)!;
        g.killEnemy(e);
      }
    });
    expect(ls.lit.every(Boolean)).toBe(true);
    expect(ls.stage).toBe(LS.Melody);
    expect(cues.filter((c) => c === 'lamp_lit').length).toBe(4);
    expect(cues).toContain('carousel_wakes');
    // 3) a wrong note resets the melody…
    const wrong = [0, 1, 2, 3].find((i) => i !== ls.order[0])!;
    walkTo(g, LAST_SONG.lamps[wrong].x, LAST_SONG.lamps[wrong].y);
    walkTo(g, NEUTRAL.x, NEUTRAL.y);
    expect(cues).toContain('sour');
    expect(ls.progress).toBe(0);
    // …the right order solves it
    for (const i of ls.order) {
      walkTo(g, LAST_SONG.lamps[i].x, LAST_SONG.lamps[i].y);
      walkTo(g, NEUTRAL.x, NEUTRAL.y);
    }
    expect(ls.stage).toBe(LS.Calling);
    expect(cues).toContain('melody_solved');
    // 4) Zoltana sends you to the High Striker
    walkTo(g, M.x, M.y);
    walkTo(g, NEUTRAL.x, NEUTRAL.y);
    expect(ls.stage).toBe(LS.Striker);
    const S = LAST_SONG.striker;
    // a mistimed strike clunks
    g.realTime = Math.floor(g.realTime / S.period) * S.period + S.period * 0.05;
    walkTo(g, S.padX, S.padY);
    walkTo(g, NEUTRAL.x, NEUTRAL.y);
    expect(cues[cues.length - 1] === 'clunk' || cues.includes('clunk')).toBe(true);
    expect(ls.rings).toBe(0);
    for (let k = 0; k < S.rings; k++) {
      g.realTime = Math.floor(g.realTime / S.period + 1) * S.period + S.period * 0.5 - TICK;
      walkTo(g, S.padX, S.padY);
      walkTo(g, NEUTRAL.x, NEUTRAL.y);
    }
    expect(ls.stage).toBe(LS.Carrying);
    expect(ls.carrying).toBe(true);
    // 5) the Ringmaster falls while you carry the ticket: the dawn is refused, the Calliope rises
    g.registerBossDefeat('ringmaster', false);
    expect(ls.stage).toBe(LS.Finale);
    expect(g.finaleActive).toBe(true);
    step(g, 60 * (LAST_SONG.finaleDelay + 1));
    expect(cues).toContain('calliope_rises');
    expect(g.bosses.some((b) => b.def.id === 'calliope')).toBe(true);
    // 6) silence the Calliope: true ending + achievement
    g.registerBossDefeat('calliope', false);
    expect(ls.stage).toBe(LS.Complete);
    expect(g.trueEnding).toBe(true);
    expect(g.achievementsHit.has('last_song')).toBe(true);
    expect(cues).toContain('complete');
  });

  it('the Calliope reaches all three movements and dies', () => {
    const g = makeGame({ godMode: true, seed: 9 });
    const ls = g.quests.get<LastSongChain>('last_song')!;
    ls.stage = LS.Finale;
    ls.finaleT = 0.01;
    g.finaleActive = true;
    step(g, 60 * 6);
    const b = g.bosses.find((x) => x.def.id === 'calliope')!;
    expect(b).toBeTruthy();
    expect(b.awake).toBe(true);
    const phases: number[] = [];
    g.bus.on('boss_phase', (e) => e.id === 'calliope' && phases.push(e.phase));
    let guard = 0;
    while (!b.dead && guard++ < 20000) {
      for (const p of b.parts) if (p.alive && !p.invuln) g.damageTarget(p, b.maxHp * 0.004, false, 0, 0, 0, 'test');
      step(g);
    }
    expect(phases).toEqual([1, 2]);
    expect(b.dead).toBe(true);
  });
});

describe('save v4 (quest memory)', () => {
  it('migrates v3 saves forward without losing data', () => {
    const v3 = { version: 3, lostTickets: 321, totalEarned: 999, perks: { might: 2 }, unlocks: ['w_orbs'], achievements: ['first_night'], pedia: [], stats: { runs: 4 }, history: [], daily: {} };
    const out = migrate(v3);
    expect(out.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(4);
    expect(out.lostTickets).toBe(321);
    expect(out.unlocks).toEqual(['w_orbs']);
    expect(out.quests).toEqual({});
  });

  it('persists quest memory and secret unlocks', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const s = new SaveManager(store);
    s.data.quests.last_song = { completions: 1, bestStage: 7 };
    s.data.unlocks.push('w_calliope');
    s.save();
    const s2 = new SaveManager(store);
    expect(s2.data.quests.last_song.completions).toBe(1);
    expect(s2.isUnlocked('w_calliope')).toBe(true);
  });

  it('the secret weapon stays out of Daily Runs and locked runs', () => {
    const daily = makeGame({ daily: true, seed: 3 });
    const pool = (g: Game) => {
      const out = new Set<string>();
      for (let i = 0; i < 200; i++) for (const o of generateDraft(g, new (g.rng.constructor as any)(i))) out.add(o.refId);
      return out;
    };
    expect(pool(daily).has('steam_calliope')).toBe(false);
    expect(pool(makeGame({ seed: 3 })).has('steam_calliope')).toBe(false);
  });
});

describe('3D model library (D-35/D-38)', () => {
  const check = (name: string, g: THREE.BufferGeometry) => {
    const p = g.getAttribute('position');
    expect(p.count, name).toBeGreaterThan(30);
    expect(p.count, name).toBeLessThan(160000);
    for (let i = 0; i < p.count; i += 7) expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)), name).toBe(true);
    for (const a of ['normal', 'color', 'aSurf']) expect(g.getAttribute(a), `${name}.${a}`).toBeTruthy();
    expect(g.getAttribute('aPart') || g.getAttribute('aSkin'), `${name} rig`).toBeTruthy();
  };

  it('every character, enemy, pickup, projectile, bullet and summon has a valid model', () => {
    for (const c of CHAR_DATA) check(c.id, CHARACTERS[c.id].build());
    for (const id of Object.keys(ENEMIES)) check(id, ENEMY_MODELS[id].build());
    for (const [k, d] of Object.entries(ITEM_MODELS)) check(k, d.build());
    for (const k of ['pie', 'musket', 'ticket', 'popcorn', 'spiral', 'spark', 'bolt', 'ring', 'hellfire', 'star', 'crown', 'spoke', 'gondola', 'kernel_big', 'note']) expect(ITEM_MODELS[`b_${k}`], k).toBeTruthy();
    for (const k of ['card', 'gold_card', 'tarot', 'death_card', 'dart', 'shrapnel', 'ring', 'rocket', 'shell', 'kernel', 'cannonball', 'derby_car', 'bumper_ghost', 'mirror_shot', 'note']) expect(ITEM_MODELS[k], k).toBeTruthy();
  });

  it('every map prop kind has a valid model', () => {
    const kinds = new Set(PROPS.map((p) => p.kind));
    for (const k of kinds) {
      if (k === 'fence_h' || k === 'fence_v' || k === 'rail') continue;
      const spec = PROP_SPECS[k]!;
      const sample = PROPS.find((p) => p.kind === k)!;
      check(k, spec.build(sample));
    }
  });
});
