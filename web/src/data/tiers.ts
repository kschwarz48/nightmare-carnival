// World tiers (D-97, docs/WORLD_TIER_DESIGN.md): the whole carnival in three versions, Normal → Nightmare → Hell,
// each opened by finishing the one before. A tier is chosen before the map (solo at character select, in co-op by
// the host); it sets the night's numbers here, the creatures' variants (data/variants.ts) and the world's look
// (render3d/tierLook.ts). They replace the old per-night difficulties (Midway / Carnival / Nightmare, D-02): Normal
// plays Midway's numbers, and the Daily Run keeps the old Carnival's as its own fixed scaling.

export type TierId = 'normal' | 'nightmare' | 'hell';
export const TIER_IDS: readonly TierId[] = ['normal', 'nightmare', 'hell'];

export interface TierDef {
  id: TierId;
  index: number;
  name: string;
  /** the carnival this tier is: The Cursed / Haunted / Infernal Carnival */
  title: string;
  desc: string;
  /** how it opens, for locked choices */
  unlockText: string;
  /** the tier's colour in menus */
  color: string;
  hpMult: number;
  dmgMult: number;
  /** the crowd's cap before party density, events and the Curse */
  cap: number;
  /** spawn interval multiplier (below 1: faster) */
  spawnMult: number;
  /** creature move speed multiplier */
  speedMult: number;
  /** Lost Tickets: added to every player's greed */
  greed: number;
  minibossInterval: number;
  eliteAffixes: number;
  eliteChanceMult: number;
  /** the value of every ticket (XP), so builds keep pace with the tougher crowd */
  xpMult: number;
}

export const TIERS: Record<TierId, TierDef> = {
  normal: {
    id: 'normal', index: 0, name: 'Normal', title: 'The Cursed Carnival', color: '#f2c14e',
    desc: 'The carnival as you found it: discover it, open its maps, solve its secrets.',
    unlockText: '',
    hpMult: 1, dmgMult: 1, cap: 180, spawnMult: 1, speedMult: 1, greed: 0, minibossInterval: 140, eliteAffixes: 0, eliteChanceMult: 1, xpMult: 1,
  },
  nightmare: {
    id: 'nightmare', index: 1, name: 'Nightmare', title: 'The Haunted Carnival', color: '#8fd3ff',
    desc: 'The carnival has crossed over. Spectral creatures phase, blink and wail; the Lost & Found has new stock. +75% Lost Tickets.',
    unlockText: 'Finish the Ghost Train on Normal',
    hpMult: 1.45, dmgMult: 1.2, cap: 230, spawnMult: 0.92, speedMult: 1.04, greed: 0.75, minibossInterval: 125, eliteAffixes: 1, eliteChanceMult: 1.3, xpMult: 1.12,
  },
  hell: {
    id: 'hell', index: 2, name: 'Hell', title: 'The Infernal Carnival', color: '#ff6a3a',
    desc: 'The carnival burns. Infernal creatures explode, ignite the ground and harden; the final shelf of the Lost & Found opens. +150% Lost Tickets.',
    unlockText: 'Finish the Ghost Train on Nightmare',
    hpMult: 2.2, dmgMult: 1.5, cap: 280, spawnMult: 0.85, speedMult: 1.08, greed: 1.5, minibossInterval: 110, eliteAffixes: 2, eliteChanceMult: 1.6, xpMult: 1.25,
  },
};

/** The Daily Run's own scaling: the old Carnival difficulty, kept so dailies play as before (on the Normal world). */
export const DAILY_SCALING: TierDef = {
  ...TIERS.normal,
  hpMult: 1.5, dmgMult: 1.25, cap: 280, greed: 0.3, minibossInterval: 120, eliteAffixes: 1, eliteChanceMult: 1.25,
};

export function isTierId(v: unknown): v is TierId {
  return typeof v === 'string' && (TIER_IDS as readonly string[]).includes(v);
}

/** The tier a campaign completion opens, or null after Hell. */
export function nextTier(t: TierId): TierId | null {
  return TIER_IDS[TIERS[t].index + 1] ?? null;
}

/** Is `t` at least `atLeast` (Nightmare includes Nightmare and Hell)? */
export function tierAtLeast(t: TierId, atLeast: TierId): boolean {
  return TIERS[t].index >= TIERS[atLeast].index;
}
