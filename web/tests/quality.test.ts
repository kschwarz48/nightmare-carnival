// Upgrade qualities (D-99): Common / Uncommon / Rare / Legendary on every upgrade a level-up or a prize wheel offers,
// scaling that level's gains; the odds lean with Luck; Luck no longer rolls crits; the qualities ride the wire.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { Rng } from '../src/core/rng';
import { QUALITIES, packQualities, qualityGain, qualityOdds, rollQuality, unpackQualities } from '../src/data/quality';
import { WEAPONS } from '../src/data/weapons';
import { applyDraftChoice, generateDraft, grantChest, passiveLevelText, weaponLevelText } from '../src/sim/draft';
import { qualityBonus } from '../src/sim/weapons';
import { PlayerStats } from '../src/sim/stats';

describe('upgrade qualities', () => {
  it('scale amounts ×1 / ×1.5 / ×2 / ×2⅔ and counts one more a step; penalties stay as they are', () => {
    expect(QUALITIES.map((q) => qualityGain('might', 6, q))).toEqual([6, 9, 12, 16]);
    expect(QUALITIES.map((q) => qualityGain('amount', 1, q))).toEqual([1, 2, 3, 4]);
    expect(qualityGain('might', -0.1, 'legendary')).toBe(-0.1);
  });

  it('lean with Luck, and sum to one', () => {
    const base = qualityOdds(1), lucky = qualityOdds(2);
    expect(base.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(base[0]).toBeGreaterThan(0.65);
    expect(base[3]).toBeLessThan(0.03);
    expect(lucky[3]).toBeGreaterThan(base[3] * 2);
    expect(lucky[0]).toBeLessThan(base[0]);
    // what the rolls do follows the odds
    const r = new Rng(7), n = 20000, seen = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) seen[QUALITIES.indexOf(rollQuality(r, 1))]++;
    for (let k = 0; k < 4; k++) expect(seen[k] / n).toBeCloseTo(base[k], 1);
  });

  it("grow a weapon's level: Throwing Cards' second level +1 card is +4 at Legendary, the third's +4 damage +10⅔", () => {
    const g = makeGame({ godMode: true });
    const w = g.weapons.list[0];
    expect(w.def.id).toBe('throwing_cards');
    const count0 = g.weapons.amount(w);
    g.weapons.levelUp('throwing_cards', 'legendary');
    expect(g.weapons.amount(w)).toBe(count0 + 4);
    const dmg2 = g.weapons.damage(w) / g.player.stats.might;
    g.weapons.levelUp('throwing_cards', 'legendary');
    expect(g.weapons.damage(w) / g.player.stats.might - dmg2).toBeCloseTo(4 * (8 / 3), 5);
    // the same run, rebuilt from its qualities (what a guest does with the wire's code), gives the same bonus
    expect(qualityBonus(w.def, unpackQualities(packQualities(w.quals), w.level))).toEqual(w.bonus);
    // an evolution starts its own run
    for (let i = 0; i < 6; i++) g.weapons.levelUp('throwing_cards');
    g.player.addPassive('lucky_ticket');
    g.weapons.evolve('throwing_cards');
    expect(w.quals).toEqual([0]);
    expect(w.bonus.amount).toBe(0);
  });

  it("grow a passive's level, and say so on its card", () => {
    const g = makeGame({ godMode: true });
    const m0 = g.player.stats.might;
    g.player.addPassive('strongman_belt', 'rare');
    expect(g.player.stats.might).toBeCloseTo(m0 + 0.2, 6);
    expect(g.player.passiveQ.get('strongman_belt')).toEqual([2]);
    expect(passiveLevelText({ id: 'strongman_belt', name: '', desc: 'x', effects: [{ axis: 'might', perLevel: [0.1, 0.1] }], maxLevel: 5, weight: 1, lore: '' }, 0, 'legendary')).toBe('+26.7% Might');
    expect(weaponLevelText(WEAPONS.throwing_cards, 2, 'uncommon')).toBe('+2 cards');
    expect(weaponLevelText(WEAPONS.throwing_cards, 2, 'common')).toBe(WEAPONS.throwing_cards.levelText[2]);
  });

  it('a new weapon starts with more damage at a better quality', () => {
    const g = makeGame({ godMode: true });
    g.weapons.add('mallet', 'rare');
    const w = g.weapons.get('mallet')!;
    expect(w.bonus.dmg).toBeCloseTo(WEAPONS.mallet.damage * 0.5, 6);
  });

  it('deals every weapon and passive card a quality, which the pick applies', () => {
    const g = makeGame({ godMode: true, seed: 11 });
    let dealt = 0;
    for (let k = 0; k < 60; k++) {
      for (const o of generateDraft(g, new Rng(k + 1))) {
        if (o.kind === 'new_weapon' || o.kind === 'level_weapon' || o.kind === 'passive') {
          expect(QUALITIES).toContain(o.rarity);
          dealt++;
        }
      }
    }
    expect(dealt).toBeGreaterThan(100);
    const opt = generateDraft(g, new Rng(3)).find((o) => o.kind === 'level_weapon' || o.kind === 'passive')!;
    applyDraftChoice(g, { ...opt, rarity: 'legendary' });
    if (opt.kind === 'level_weapon') expect(g.weapons.get(opt.refId)!.quals.at(-1)).toBe(3);
    else expect(g.player.passiveQ.get(opt.refId)?.at(-1)).toBe(3);
  });

  it("rolls a quality for each of a prize wheel's prizes", () => {
    const g = makeGame({ godMode: true, seed: 5 });
    g.player.addPassive('spinning_top');
    const res = grantChest(g, 5);
    expect(res.entries.length).toBe(5);
    for (const e of res.entries) if (e.type === 'level' || e.type === 'passive') expect(QUALITIES).toContain(e.quality);
  });

  it('no longer lets Luck roll crits', () => {
    const s = new PlayerStats();
    s.critChance = 0.2;
    s.luck = 3;
    expect(s.critRoll(0.21)).toBe(false);
    expect(s.critRoll(0.19)).toBe(true);
  });

  it('never takes a weapon below a third of its own cooldown', () => {
    const g = makeGame({ godMode: true });
    g.weapons.add('orbs');
    const w = g.weapons.get('orbs')!;
    for (let i = 0; i < 7; i++) g.weapons.levelUp('orbs', 'legendary');
    expect(g.weapons.cooldown(w) / g.player.stats.cooldown).toBeGreaterThanOrEqual(WEAPONS.orbs.cooldown / 3 - 1e-9);
    // and no table at Common comes near that floor
    for (const d of Object.values(WEAPONS)) {
      const sum = d.lv.cd.reduce((a, b) => a + b, 0);
      if (d.cooldown > 0) expect(d.cooldown + sum, d.id).toBeGreaterThan(d.cooldown / 3);
    }
  });
});
