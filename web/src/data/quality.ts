// Upgrade qualities (D-99): every upgrade a level-up or a prize wheel offers rolls Common, Uncommon, Rare or Legendary,
// and the quality scales that level's gains — amounts ×1 / ×1.5 / ×2 / ×2⅔ (+6 damage: +9 / +12 / +16), counts one
// more a step (+1 card: +2 / +3 / +4). A new weapon's quality is its damage from the start (it has no level gain yet).
// Penalties (a level that costs something) never scale. The odds lean with the acting player's Luck.

import type { StatAxis } from './weapons';

export type Quality = 'common' | 'uncommon' | 'rare' | 'legendary';
export const QUALITIES: readonly Quality[] = ['common', 'uncommon', 'rare', 'legendary'];

export const QUALITY: Record<Quality, { idx: number; mult: number; name: string; color: string }> = {
  common: { idx: 0, mult: 1, name: 'Common', color: '#e8dcc0' },
  uncommon: { idx: 1, mult: 1.5, name: 'Uncommon', color: '#39ff7a' },
  rare: { idx: 2, mult: 2, name: 'Rare', color: '#3aa8ff' },
  legendary: { idx: 3, mult: 8 / 3, name: 'Legendary', color: '#ff9a2a' },
};

/** The weights of each quality at a Luck (1 at base): Common 100, Uncommon 28·L, Rare 10·L^1.5, Legendary 2.5·L². */
export function qualityWeights(luck: number): number[] {
  const L = Math.max(0.5, luck);
  return [100, 28 * L, 10 * L ** 1.5, 2.5 * L * L];
}

/** Each quality's chance at a Luck, summing to 1 (Luck 1: ~71% / 20% / 7% / 1.8%). */
export function qualityOdds(luck: number): number[] {
  const w = qualityWeights(luck);
  const t = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / t);
}

export function rollQuality(rng: { weighted(w: number[]): number }, luck: number): Quality {
  return QUALITIES[rng.weighted(qualityWeights(luck))];
}

/** Stat axes that count (cards, pierce, revives, armour, the tiers' passive levels): a quality adds one more a step. */
const COUNT_AXES = new Set<string>(['amount', 'revive', 'armor', 'soulJar', 'brimstone', 'cinderHeart']);

/** A level's gain `g` on `axis` at quality `q` (a penalty, g ≤ 0, as it is). */
export function qualityGain(axis: StatAxis | string, g: number, q: Quality): number {
  if (g <= 0 || q === 'common') return g;
  return COUNT_AXES.has(axis) ? g * (1 + QUALITY[q].idx) : g * QUALITY[q].mult;
}

/** A new weapon's damage from its quality (a fraction of its base damage, added for good). */
export const NEW_WEAPON_DMG: Record<Quality, number> = { common: 0, uncommon: 0.25, rare: 0.5, legendary: 0.8 };

/** A run of qualities (one per level) as base-4 digits in a u16 (eight levels at most), for the wire. */
export function packQualities(q: number[]): number {
  let code = 0;
  for (let k = Math.min(8, q.length) - 1; k >= 0; k--) code = code * 4 + (q[k] & 3);
  return code;
}
export function unpackQualities(code: number, n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < Math.min(8, n); k++) {
    out.push(code & 3);
    code = Math.floor(code / 4);
  }
  return out;
}
