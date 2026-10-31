// Playtest tuning (D-62): firing squads come half as Evil Clowns; evolutions level from Evo Lv 1 to 8;
// the Funhouse Mirror's clones add a capped share of your damage, split between them.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { COOP } from '../src/data/progression';
import { DIFFICULTIES } from '../src/data/difficulty';
import { EVOLUTION_IDS, WEAPONS } from '../src/data/weapons';
import { WAVES } from '../src/data/waves';
import { generateDraft, grantChest } from '../src/sim/draft';
import type { Game } from '../src/sim/game';

/** The share of a discrete attack that the mirror's clones replay, summed over all of them. */
function replayShare(g: Game, clones: number): number {
  for (const s of g.summons) if (s.kind === 'clone') s.alive = false;
  for (let i = 0; i < clones; i++) {
    const s = g.spawnSummon()!;
    s.kind = 'clone';
    s.weapon = 'mirror';
    s.alive = true;
    s.x = g.player.x + 100 + i * 20;
    s.y = g.player.y;
  }
  g.weapons.clones = g.summons.filter((s) => s.alive && s.kind === 'clone');
  const mults: number[] = [];
  (g.weapons as unknown as { cast: (w: unknown, fn: (x: number, y: number, m: number) => void) => void }).cast(g.weapons.get('throwing_cards'), (_x, _y, m) => mults.push(m));
  expect(mults[0]).toBe(1); // you, at full power
  return mults.slice(1).reduce((a, b) => a + b, 0);
}

describe('playtest tuning (D-62)', () => {
  it('the firing squads after the Ferris Wheel come half as Evil Clowns, keeping the crowd as dense', () => {
    const g = makeGame({ godMode: true, seed: 3 });
    g.time = 800; // Act III
    g.tick();
    const count = (id: string) => g.active.filter((e) => e.def.id === id).length;
    const s0 = count('puppet_soldier'), c0 = count('evil_clown');
    const wave = { ...WAVES.find((w) => w.id === 'w_1200')!, enemies: [['puppet_soldier', 1]] as [string, number][] };
    expect(g.director.spawnOne(wave)).toBe(true);
    const n = 3 + Math.min(3, g.act - 2);
    const muskets = count('puppet_soldier') - s0, clowns = count('evil_clown') - c0;
    expect(muskets + clowns).toBe(n);
    expect(muskets).toBe(Math.max(2, Math.floor(n / 2)));
    expect(clowns).toBeGreaterThanOrEqual(n - muskets);
  });

  it("a party faces a crowd dense enough to earn a solo night's XP, within the enemy pool", () => {
    expect(COOP.density.slice(1)).toEqual([1, 2, 2.3, 2.5, 2.6, 2.6]);
    for (let n = 2; n <= 6; n++) expect(COOP.density[n]).toBeGreaterThanOrEqual(COOP.density[n - 1]);
    const midway = DIFFICULTIES.find((d) => d.id === 'midway')!;
    for (let n = 1; n <= 6; n++) expect(midway.cap * COOP.density[n]).toBeLessThanOrEqual(520);
    const duo = makeGame({ players: [{ character: 'carny' }, { character: 'strongman' }] });
    expect(duo.director.cap).toBe(Math.round(midway.cap * 2));
  });

  it("a party's tickets are worth 1.5x, with the crowd kept as dense (D-66)", () => {
    expect(COOP.xpGain[1]).toBe(1);
    for (let n = 2; n <= 6; n++) expect(COOP.xpGain[n]).toBe(1.5);
    // the same character, the same ticket: solo banks 1x, a party (two to six) 1.5x
    const solo = makeGame({ character: 'carny', seed: 5 });
    solo.addXp(3);
    for (const n of [2, 3, 6]) {
      const party = makeGame({ seed: 5, players: Array.from({ length: n }, () => ({ character: 'carny' })) });
      party.addXp(3);
      expect(party.level).toBe(1);
      expect(party.xp / solo.xp).toBeCloseTo(1.5, 6);
    }
  });

  it('every evolution levels from Evo Lv 1 to 8, mostly in damage', () => {
    for (const id of EVOLUTION_IDS) {
      const d = WEAPONS[id];
      expect(d.maxLevel, id).toBe(8);
      for (let l = 2; l <= 8; l++) expect(d.levelText[l], `${id} Lv${l}`).toBeTruthy();
      expect(d.lv.dmg.filter((x) => x > 0).length, id).toBeGreaterThanOrEqual(4);
    }
    const g = makeGame({ godMode: true });
    g.weapons.list.length = 0;
    g.weapons.add('royal_flush');
    const w = g.weapons.get('royal_flush')!;
    const d1 = g.weapons.damage(w), s1 = g.weapons.speed(w), c1 = g.weapons.cooldown(w), n1 = g.weapons.amount(w);
    for (let i = 0; i < 12; i++) g.weapons.levelUp('royal_flush');
    expect(w.level).toBe(8);
    expect(g.weapons.damage(w)).toBeGreaterThan(d1 * 1.4);
    expect(g.weapons.speed(w)).toBeGreaterThan(s1);
    expect(g.weapons.cooldown(w)).toBeLessThan(c1);
    expect(g.weapons.amount(w)).toBe(n1 + 1);
  });

  it('level-up cards and prize wheels can level an evolved weapon', () => {
    const g = makeGame({ godMode: true, seed: 4 });
    g.weapons.list.length = 0;
    g.weapons.add('royal_flush');
    let seen = false;
    for (let k = 0; k < 30 && !seen; k++) seen = generateDraft(g).some((o) => o.kind === 'level_weapon' && o.refId === 'royal_flush' && o.level === 2);
    expect(seen).toBe(true);
    const res = grantChest(g, 1);
    expect(res.entries[0]).toMatchObject({ type: 'level', id: 'royal_flush', level: 2 });
  });

  it('mirror clones add a capped share of your damage, split between however many there are', () => {
    const g = makeGame({ godMode: true, seed: 9 });
    g.weapons.list.length = 0;
    g.weapons.add('throwing_cards');
    g.weapons.add('mirror');
    expect(replayShare(g, 1)).toBeCloseTo(0.12, 6); // Lv 1: one clone at 12% of you
    expect(replayShare(g, 4)).toBeCloseTo(0.12, 6); // more clones (Amount) share it rather than multiply it
    for (let i = 0; i < 7; i++) g.weapons.levelUp('mirror');
    expect(replayShare(g, 2)).toBeCloseTo(0.3, 6); // Lv 8: 30% between two clones
    g.weapons.evolve('mirror');
    expect(g.weapons.has('hall_of_mirrors')).toBe(true);
    expect(replayShare(g, 3)).toBeCloseTo(0.36, 6); // the Hall of Mirrors: 36%
    for (let i = 0; i < 7; i++) g.weapons.levelUp('hall_of_mirrors');
    expect(replayShare(g, 3)).toBeCloseTo(0.5, 6); // Evo Lv 8: half again your damage, in total
    expect(replayShare(g, 6)).toBeCloseTo(0.5, 6);
  });
});
