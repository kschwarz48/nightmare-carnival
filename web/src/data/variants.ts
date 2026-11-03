// Creature variants (D-97, docs/WORLD_TIER_DESIGN.md §8): on Nightmare every creature turns spectral and on Hell
// infernal (a look, sim/variants.ts and the renderer), and about half of each map's kinds gain an ability from a
// shared set, chosen to suit how each already fights. Bosses, minis and the creatures that are a set-piece's
// machinery (the gallery's ducks, the coaster snake, the bumper cars, the popping moles) keep their own rules.

import type { TierId } from './tiers';

export type VariantAbility =
  // Nightmare
  | 'phase' | 'decoy' | 'blink' | 'wail' | 'haunt'
  // Hell
  | 'blast' | 'trail' | 'ember' | 'enrage' | 'quake' | 'harden';

export const ABILITY_BITS: Record<VariantAbility, number> = {
  phase: 1, decoy: 2, blink: 4, wail: 8, haunt: 16, blast: 32, trail: 64, ember: 128, enrage: 256, quake: 512, harden: 1024,
};

/** What each ability does, its numbers, and its tell (shown in the Carnival-pedia). */
export const ABILITIES: Record<VariantAbility, { name: string; desc: string }> = {
  phase: { name: 'Phasing', desc: 'Every few seconds it shimmers, then turns intangible for 2 s: it can neither be hurt nor hurt you.' },
  decoy: { name: 'Ectoplasm', desc: 'When first hurt, and every 12 s after, it sheds two one-hit illusions of itself.' },
  blink: { name: 'Blink', desc: 'Vanishes and reappears beside you; a pale ring marks where, 0.7 s before.' },
  wail: { name: 'Wail', desc: 'A widening pale ring that slows whoever it reaches.' },
  haunt: { name: 'Haunting', desc: 'Dying, it leaves a spirit that bursts a moment later: mind the circle.' },
  blast: { name: 'Volatile', desc: 'Dying, it explodes after a short fuse: mind the circle.' },
  trail: { name: 'Firewalker', desc: 'Leaves burning ground behind it.' },
  ember: { name: 'Fire-Lobber', desc: 'Lobs a fireball where you stand; the landing circle shows where.' },
  enrage: { name: 'Wrath', desc: 'Below 40% health it flares: faster and harder hitting.' },
  quake: { name: 'Tremor', desc: 'Stamps out a shockwave ring every few seconds.' },
  harden: { name: 'Infernal Plating', desc: 'Its first hits only do half damage, until the plating cracks.' },
};

type Table = Record<string, VariantAbility[]>;

export const VARIANTS: Record<Exclude<TierId, 'normal'>, Table> = {
  nightmare: {
    // the Carnival Core
    living_balloon: ['haunt'], possessed_stuffie: ['decoy'], evil_clown: ['phase'], wind_up_monkey: ['blink'], jack_in_the_box: ['blink'],
    dunk_tank_clown: ['wail'], carousel_horse: ['phase'], walking_ticket_booth: ['phase'], carnival_brute: ['wail'],
    // the Fun House
    grinning_mannequin: ['phase'], marionette: ['blink'], splitter: ['haunt'], crooked_clown: ['decoy'], doppelganger: ['wail'],
    // the Boardwalk
    drowned: ['phase'], shore_crawler: ['haunt'], ticket_taker: ['blink'], taffy_horror: ['wail'], coaster_wraith: ['phase'], lantern_angler: ['decoy'], barnacle_brute: ['wail'],
    // the Ghost Train
    gt_ticketless: ['phase'], gt_porter: ['wail'], gt_mourner: ['haunt'], gt_commuter: ['blink'], gt_moth: ['haunt'], gt_hound: ['blink'], gt_navvy: ['decoy'], gt_watcher: ['wail'], gt_collected: ['haunt'], gt_newsboy: ['phase'],
  },
  hell: {
    living_balloon: ['blast'], cotton_candy_slime: ['trail'], evil_clown: ['enrage'], wind_up_monkey: ['blast'], dunk_tank_clown: ['ember'],
    carousel_horse: ['trail'], walking_ticket_booth: ['harden'], carnival_brute: ['quake', 'harden'], possessed_stuffie: ['enrage'],
    grinning_mannequin: ['harden'], marionette: ['ember'], splitter: ['blast'], crooked_clown: ['enrage'], reflection_thief: ['trail'],
    drowned: ['trail'], shore_crawler: ['blast'], taffy_horror: ['harden'], arcade_automaton: ['ember'], coaster_wraith: ['trail'], barnacle_brute: ['quake', 'harden'], tidecaller: ['enrage'],
    gt_ticketless: ['enrage'], gt_coalborn: ['trail'], gt_porter: ['harden'], gt_navvy: ['quake'], gt_railcrawler: ['blast'], gt_signalman: ['ember'], gt_slag: ['trail'], gt_riveter: ['harden'], gt_hound: ['enrage'], gt_pallbearer: ['quake'],
  },
};

/** The abilities a kind has on a tier, as bits. */
export function variantBits(tier: TierId, id: string): number {
  if (tier === 'normal') return 0;
  let bits = 0;
  for (const a of VARIANTS[tier][id] ?? []) bits |= ABILITY_BITS[a];
  return bits;
}

export const VARIANT_NUMBERS = {
  phase: { every: [6, 9] as [number, number], tell: 0.8, hold: 2 },
  decoy: { every: 12, count: 2 },
  blink: { every: [7, 10] as [number, number], tell: 0.7, reach: 520, near: 90 },
  wail: { every: [8, 11] as [number, number], tell: 0.6, reach: 420, slow: 0.45, slowT: 1.5 },
  haunt: { tele: 1.0, r: 58, dmg: 8 },
  blast: { tele: 0.8, r: 72, dmg: 12 },
  trail: { every: 1.1, life: 3, r: 30, dps: 7 },
  ember: { every: [5, 7] as [number, number], tele: 1.1, r: 62, dmg: 11, reach: 560 },
  enrage: { below: 0.4, speed: 1.4, dmg: 1.4 },
  quake: { every: 7, r: 220, dmg: 10 },
  harden: { hits: 4, mult: 0.5 },
};
