// Lost & Found perks and unlocks, achievements, payout (doc 01 §8–9, D-21, D-22).

import type { StatAxis } from './weapons';

export interface PerkDef {
  id: string;
  name: string;
  desc: string;
  axis: StatAxis | 'reroll' | 'banish';
  mag: number;
  base: number;
  growth: number;
  cap: number;
}

export const PERKS: PerkDef[] = [
  { id: 'max_hp', name: 'Hearty Stew', desc: '+6% Max HP', axis: 'maxHp', mag: 0.06, base: 30, growth: 1.5, cap: 5 },
  { id: 'might', name: 'Brass Knuckles', desc: '+5% Might', axis: 'might', mag: 0.05, base: 40, growth: 1.6, cap: 5 },
  { id: 'speed', name: 'Worn Sneakers', desc: '+4% Move speed', axis: 'moveSpeed', mag: 0.04, base: 35, growth: 1.6, cap: 4 },
  { id: 'pickup', name: 'Ticket Magnet', desc: '+10% Pickup radius', axis: 'pickup', mag: 0.1, base: 25, growth: 1.5, cap: 4 },
  { id: 'luck', name: 'Four-Leaf Clover', desc: '+5% Luck', axis: 'luck', mag: 0.05, base: 45, growth: 1.6, cap: 4 },
  { id: 'greed', name: 'Piggy Bank', desc: '+8% Greed (Lost Tickets)', axis: 'greed', mag: 0.08, base: 40, growth: 1.55, cap: 5 },
  { id: 'armor', name: 'Padded Vest', desc: '+1 Armor', axis: 'armor', mag: 1, base: 90, growth: 2.0, cap: 2 },
  { id: 'revive', name: 'Spare Balloon', desc: '+1 Revive per run', axis: 'revive', mag: 1, base: 200, growth: 2.0, cap: 1 },
  { id: 'reroll', name: 'Re-Spin Token', desc: '+1 draft Reroll per run', axis: 'reroll', mag: 1, base: 60, growth: 1.8, cap: 3 },
  { id: 'banish', name: 'Banish Stamp', desc: '+1 draft Banish per run', axis: 'banish', mag: 1, base: 70, growth: 1.8, cap: 3 },
];

export interface UnlockDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  kind: 'weapon' | 'passive' | 'feature';
  ref?: string;
}

export const UNLOCKS: UnlockDef[] = [
  { id: 'w_orbs', name: 'Crystal Orbs', desc: 'Adds Crystal Orbs to the draft pool.', cost: 60, kind: 'weapon', ref: 'orbs' },
  { id: 'w_cannon', name: 'Carnival Cannon', desc: 'Adds the Carnival Cannon to the draft pool.', cost: 90, kind: 'weapon', ref: 'cannon' },
  { id: 'w_laser', name: 'Laser Light Show', desc: 'Adds the Laser Light Show to the draft pool.', cost: 110, kind: 'weapon', ref: 'laser' },
  { id: 'w_bell', name: 'Strongman Bell', desc: 'Adds the Strongman Bell to the draft pool.', cost: 110, kind: 'weapon', ref: 'bell' },
  { id: 'w_mirror', name: 'Funhouse Mirror', desc: 'Adds the Funhouse Mirror to the draft pool.', cost: 160, kind: 'weapon', ref: 'mirror' },
  { id: 'p_season_pass', name: 'Season Pass', desc: 'Adds Season Pass (+XP) to the draft pool.', cost: 80, kind: 'passive', ref: 'season_pass' },
  { id: 'p_coin_purse', name: 'Coin Purse', desc: 'Adds Coin Purse (+Greed) to the draft pool.', cost: 80, kind: 'passive', ref: 'coin_purse' },
  { id: 'p_rabbits_foot', name: "Rabbit's Foot", desc: "Adds Rabbit's Foot (+Revive) to the draft pool.", cost: 180, kind: 'passive', ref: 'rabbits_foot' },
  { id: 'f_skip', name: 'Skip Ticket', desc: 'Lets you skip a draft (heals 10 HP).', cost: 50, kind: 'feature' },
];

/** Unlocks that are never sold — earned only through discovery (each map's hidden quest). */
export const SECRET_UNLOCKS = ['w_calliope', 'p_hand_mirror', 'p_ada_conch'];
/** Which hidden quest grants which of them. */
export const QUEST_UNLOCKS: Record<string, string[]> = { last_song: ['w_calliope'], unreflected: ['p_hand_mirror'], summers_end: ['p_ada_conch'] };

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_night', name: 'First Night', desc: 'Finish your first run.', reward: 20 },
  { id: 'beat_tent', name: 'Strike the Tent', desc: 'Defeat the Carnival Tent.', reward: 40 },
  { id: 'beat_ferris_wheel', name: 'Off the Rails', desc: 'Defeat the Ferris Wheel.', reward: 60 },
  { id: 'beat_puppet_king', name: 'No Strings Attached', desc: 'Defeat the Puppet King.', reward: 80 },
  { id: 'beat_ringmaster', name: 'Show’s Over', desc: 'Defeat the Ringmaster and see the dawn.', reward: 150 },
  { id: 'reach_12', name: 'Halfway House', desc: 'Survive to 12:00.', reward: 30 },
  { id: 'win_carnival', name: 'Carnival Champion', desc: 'Win on Carnival difficulty.', reward: 150 },
  { id: 'win_nightmare', name: 'Nightmare Survivor', desc: 'Win on Nightmare difficulty.', reward: 300 },
  { id: 'win_cursed', name: 'Cursed and Victorious', desc: 'Win with the Curse active.', reward: 200 },
  { id: 'first_evolution', name: 'Evolutionist', desc: 'Evolve a weapon.', reward: 30 },
  { id: 'full_house', name: 'Full House', desc: 'Discover every evolution.', reward: 400 },
  { id: 'kills_1000', name: 'Crowd Control', desc: 'Defeat 1,000 enemies in one run.', reward: 40 },
  { id: 'kills_5000', name: 'Midway Massacre', desc: 'Defeat 5,000 enemies in one run.', reward: 100 },
  { id: 'level_40', name: 'Ticket Hoarder', desc: 'Reach level 40 in one run.', reward: 60 },
  { id: 'all_characters', name: 'The Whole Troupe', desc: 'Unlock all six characters.', reward: 150 },
  { id: 'endless_30', name: 'Lock-In', desc: 'Survive to 30:00 in Endless.', reward: 120 },
  { id: 'daily_run', name: 'Daily Special', desc: 'Complete a Daily Run.', reward: 30 },
  { id: 'no_hit_boss', name: 'Untouchable', desc: 'Defeat a boss without taking damage during the fight.', reward: 80 },
  { id: 'last_song', name: 'The Last Song', desc: 'Hear the whole song.', reward: 400 },
  // the Fun House (D-63)
  { id: 'beat_crooked_twins', name: 'Untied', desc: 'Defeat the Crooked Twins.', reward: 40 },
  { id: 'beat_looking_glass', name: 'Seven Years', desc: 'Defeat the Looking Glass.', reward: 60 },
  { id: 'beat_stringmistress', name: 'Cut the Cradle', desc: 'Defeat the Stringmistress.', reward: 80 },
  { id: 'beat_proprietor', name: 'The House Loses', desc: "Defeat the Proprietor and see the Fun House's dawn.", reward: 150 },
  { id: 'unreflected', name: 'Through the Looking Glass', desc: 'Bring Mira home.', reward: 400 },
  // the Boardwalk (D-68)
  { id: 'beat_barker', name: 'No Sale', desc: 'Defeat the Boardwalk Barker.', reward: 40 },
  { id: 'beat_drowned_captain', name: 'Abandon Ship', desc: 'Defeat the Drowned Captain.', reward: 60 },
  { id: 'beat_last_ride', name: 'End of the Line', desc: 'Defeat the Last Ride.', reward: 80 },
  { id: 'beat_leviathan', name: 'Low Tide', desc: "Defeat the Leviathan and see the Boardwalk's dawn.", reward: 150 },
  { id: 'summers_end', name: "Summer's End", desc: 'Close the Commodore\'s account.', reward: 400 },
];

/** End-of-run payout (doc 01 §8). */
export function computePayout(o: { seconds: number; bosses: number; kills: number; won: boolean; greed: number; endlessExtraSeconds?: number }): number {
  const base = Math.floor(Math.min(o.seconds, 1500) / 6) + 50 * o.bosses + Math.floor(o.kills / 25) + (o.won ? 100 : 0)
    + Math.floor((o.endlessExtraSeconds ?? 0) / 4);
  return Math.round(base * o.greed);
}
