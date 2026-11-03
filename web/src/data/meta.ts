// Lost & Found perks and unlocks, achievements, payout (doc 01 §8–9, D-21, D-22).

import type { StatAxis } from './weapons';
import type { TierId } from './tiers';

export interface PerkDef {
  id: string;
  name: string;
  desc: string;
  axis: StatAxis | 'reroll' | 'banish';
  mag: number;
  base: number;
  growth: number;
  cap: number;
  /** a tier's shelf (D-97): sold once that tier is open */
  tier?: TierId;
  /** owned once and switched on or off in the Lost & Found (Devil's Bargain) */
  switchable?: boolean;
}

// D-78: about seven times the old prices across the store (perks ~22,100 LT to max, attractions 8,500,
// performers 16,100: ~46,700 in all, against ~6,800 before), so it takes a few dozen winning nights to own
// everything; a winning night on Midway pays roughly 800–1,500 LT (`scripts/payout.ts`)
export const PERKS: PerkDef[] = [
  { id: 'max_hp', name: 'Hearty Stew', desc: '+6% Max HP', axis: 'maxHp', mag: 0.06, base: 120, growth: 1.6, cap: 5 },
  { id: 'might', name: 'Brass Knuckles', desc: '+5% Might', axis: 'might', mag: 0.05, base: 160, growth: 1.7, cap: 5 },
  { id: 'speed', name: 'Worn Sneakers', desc: '+4% Move speed', axis: 'moveSpeed', mag: 0.04, base: 140, growth: 1.7, cap: 4 },
  { id: 'pickup', name: 'Ticket Magnet', desc: '+10% Pickup radius', axis: 'pickup', mag: 0.1, base: 100, growth: 1.6, cap: 4 },
  { id: 'luck', name: 'Four-Leaf Clover', desc: '+5% Luck', axis: 'luck', mag: 0.05, base: 180, growth: 1.7, cap: 4 },
  { id: 'greed', name: 'Piggy Bank', desc: '+8% Greed (Lost Tickets)', axis: 'greed', mag: 0.08, base: 160, growth: 1.65, cap: 5 },
  { id: 'armor', name: 'Padded Vest', desc: '+1 Armor', axis: 'armor', mag: 1, base: 400, growth: 2.2, cap: 2 },
  // D-76: base regeneration, every night (it was the Funnel Cake passive in the drafts)
  { id: 'regen', name: 'Funnel Cake', desc: '+0.2 HP regen per second', axis: 'regen', mag: 0.2, base: 200, growth: 1.7, cap: 5 },
  { id: 'revive', name: 'Spare Balloon', desc: '+1 Revive per run', axis: 'revive', mag: 1, base: 1500, growth: 2.0, cap: 1 },
  { id: 'reroll', name: 'Re-Spin Token', desc: '+1 draft Reroll per run', axis: 'reroll', mag: 1, base: 250, growth: 1.9, cap: 3 },
  { id: 'banish', name: 'Banish Stamp', desc: '+1 draft Banish per run', axis: 'banish', mag: 1, base: 300, growth: 1.9, cap: 3 },
  // the Nightmare shelf (D-97, sim/tierPerks.ts): ~41,000 Lost Tickets; mechanics more than numbers
  { id: 'second_chance', tier: 'nightmare', name: 'Second Chance', desc: 'Once a night, a blow that would down you leaves you on 30% health, untouchable for a moment, the crowd blown back', axis: 'secondChance', mag: 1, base: 5000, growth: 1, cap: 1 },
  { id: 'soul_collector', tier: 'nightmare', name: 'Soul Collector', desc: 'Each elite or miniboss you kill gives a soul for 30 s: +4/6/8% Might each, up to 3', axis: 'soulCollector', mag: 1, base: 2500, growth: 1.7, cap: 3 },
  { id: 'prize_hunter', tier: 'nightmare', name: 'Prize Hunter', desc: 'Elites are 50/100% more likely to carry a prize chest (for the whole party)', axis: 'prizeHunter', mag: 1, base: 3000, growth: 1.8, cap: 2 },
  { id: 'opening_act', tier: 'nightmare', name: 'Opening Act', desc: 'Every night opens with a draft already waiting for you', axis: 'openingAct', mag: 1, base: 3500, growth: 1, cap: 1 },
  { id: 'second_wind', tier: 'nightmare', name: 'Second Wind', desc: 'Food heals 20/40/60% more and lends +20% Might for 4 s', axis: 'secondWind', mag: 1, base: 2000, growth: 1.6, cap: 3 },
  // the Hell shelf: ~92,000
  { id: 'devils_bargain', tier: 'hell', switchable: true, name: "Devil's Bargain", desc: '−25% Max HP, +30% Might. Click it once owned to switch it off or on', axis: 'bargain', mag: 1, base: 8000, growth: 1, cap: 1 },
  { id: 'final_act', tier: 'hell', name: 'Final Act', desc: "+12/24% Might in the night's last five minutes before dawn", axis: 'finalAct', mag: 1, base: 6000, growth: 1.8, cap: 2 },
  { id: 'unfinished_business', tier: 'hell', name: 'Unfinished Business', desc: 'Each boss beaten tonight: +3/4/5% Might and +2/3/4% Max HP for the rest of the night', axis: 'unfinished', mag: 1, base: 5000, growth: 1.7, cap: 3 },
  { id: 'infernal_resilience', tier: 'hell', name: 'Infernal Resilience', desc: '10/17/25% less damage from telegraphed strikes: marked ground, explosions, boss attacks', axis: 'infernal', mag: 1, base: 4500, growth: 1.7, cap: 3 },
  { id: 'ember_heart', tier: 'hell', name: 'Ember Heart', desc: 'Below 35% health: +1/2 HP a second and +2/4 Armor', axis: 'emberHeart', mag: 1, base: 5000, growth: 1.8, cap: 2 },
];

export interface UnlockDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  kind: 'weapon' | 'passive' | 'feature';
  ref?: string;
  /** an achievement the attraction waits for before it can be bought (D-78), and how the shop names it */
  req?: string;
  reqText?: string;
  /** a world tier's (D-97) */
  tier?: TierId;
}

export const UNLOCKS: UnlockDef[] = [
  { id: 'w_orbs', name: 'Crystal Orbs', desc: 'Adds Crystal Orbs to the draft pool.', cost: 400, kind: 'weapon', ref: 'orbs' },
  { id: 'w_cannon', name: 'Carnival Cannon', desc: 'Adds the Carnival Cannon to the draft pool.', cost: 600, kind: 'weapon', ref: 'cannon' },
  { id: 'w_laser', name: 'Laser Light Show', desc: 'Adds the Laser Light Show to the draft pool.', cost: 750, kind: 'weapon', ref: 'laser' },
  { id: 'w_bell', name: 'Strongman Bell', desc: 'Adds the Strongman Bell to the draft pool.', cost: 750, kind: 'weapon', ref: 'bell' },
  { id: 'w_mirror', name: 'Funhouse Mirror', desc: 'Adds the Funhouse Mirror to the draft pool.', cost: 1000, kind: 'weapon', ref: 'mirror' },
  // D-78: the Commodore's coaster car, sold once the Boardwalk has been survived (no hidden quest needed)
  { id: 'w_undertow', name: 'The Undertow', desc: "Adds the Undertow, the Boardwalk's coaster car, to the draft pool.", cost: 2000, kind: 'weapon', ref: 'bumper', req: 'beat_leviathan', reqText: 'Defeat the Leviathan' },
  { id: 'p_season_pass', name: 'Season Pass', desc: 'Adds Season Pass (+XP) to the draft pool.', cost: 500, kind: 'passive', ref: 'season_pass' },
  { id: 'p_coin_purse', name: 'Coin Purse', desc: 'Adds Coin Purse (+Greed) to the draft pool.', cost: 600, kind: 'passive', ref: 'coin_purse' },
  { id: 'p_rabbits_foot', name: "Rabbit's Foot", desc: "Adds Rabbit's Foot (+Revive) to the draft pool.", cost: 1500, kind: 'passive', ref: 'rabbits_foot' },
  { id: 'f_skip', name: 'Skip Ticket', desc: 'Lets you skip a draft (heals 10 HP).', cost: 400, kind: 'feature' },
  // the world tiers' weapons and passives (D-97)
  { id: 'w_lantern', tier: 'nightmare', name: "Watchman's Lantern", desc: "Adds the Watchman's Lantern (a sweeping beam that burns what it lights) to the draft pool.", cost: 3000, kind: 'weapon', ref: 'lantern', req: 'nm_fun_house', reqText: 'Win the Fun House on Nightmare' },
  { id: 'w_chains', tier: 'nightmare', name: 'Spirit Chains', desc: 'Adds Spirit Chains (links that leap from creature to creature) to the draft pool.', cost: 3500, kind: 'weapon', ref: 'chains', req: 'nm_fun_house', reqText: 'Win the Fun House on Nightmare' },
  { id: 'w_breath', tier: 'hell', name: 'Fire Breath', desc: 'Adds Fire Breath (a cone of flame that sets creatures alight) to the draft pool.', cost: 5000, kind: 'weapon', ref: 'breath', req: 'hell_fun_house', reqText: 'Win the Fun House on Hell' },
  { id: 'p_deaths_door', tier: 'nightmare', name: "Death's Door", desc: "Adds Death's Door (more Might the less health you have) to the draft pool.", cost: 2500, kind: 'passive', ref: 'deaths_door', req: 'nm_boardwalk', reqText: 'Win the Boardwalk on Nightmare' },
  { id: 'p_soul_jar', tier: 'nightmare', name: 'Soul Jar', desc: 'Adds the Soul Jar (a spectral blast every so many kills) to the draft pool.', cost: 2500, kind: 'passive', ref: 'soul_jar', req: 'nm_boardwalk', reqText: 'Win the Boardwalk on Nightmare' },
  { id: 'p_brimstone', tier: 'hell', name: 'Brimstone', desc: 'Adds Brimstone (hits set creatures alight; the burning burst) to the draft pool.', cost: 4000, kind: 'passive', ref: 'brimstone', req: 'hell_boardwalk', reqText: 'Win the Boardwalk on Hell' },
  { id: 'p_cinder_heart', tier: 'hell', name: 'Cinder Heart', desc: 'Adds Cinder Heart (burning creatures near you heal you) to the draft pool.', cost: 4000, kind: 'passive', ref: 'cinder_heart', req: 'hell_boardwalk', reqText: 'Win the Boardwalk on Hell' },
];

/** Unlocks that are never sold — earned only through discovery (each map's hidden quest); never in a Daily Run. */
export const SECRET_UNLOCKS = ['w_calliope', 'p_hand_mirror', 'p_ada_conch'];
/** Never sold either, but no secret (D-78): Running Shoes, the Undertow's partner, for beating the Commodore. */
export const EARNED_UNLOCKS = ['p_running_shoes'];
/** Which hidden quest grants which of them (Summer's End is completed by beating the Commodore). */
export const QUEST_UNLOCKS: Record<string, string[]> = { last_song: ['w_calliope'], unreflected: ['p_hand_mirror'], summers_end: ['p_ada_conch', 'p_running_shoes'] };

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: number;
  /** can no longer be earned (D-97: the old difficulties'); shown only on saves that have it */
  retired?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_night', name: 'First Night', desc: 'Finish your first run.', reward: 20 },
  { id: 'beat_tent', name: 'Strike the Tent', desc: 'Defeat the Carnival Tent.', reward: 40 },
  { id: 'beat_ferris_wheel', name: 'Off the Rails', desc: 'Defeat the Ferris Wheel.', reward: 60 },
  { id: 'beat_puppet_king', name: 'No Strings Attached', desc: 'Defeat the Puppet King.', reward: 80 },
  { id: 'beat_ringmaster', name: 'Show’s Over', desc: 'Defeat the Ringmaster and see the dawn.', reward: 150 },
  { id: 'reach_12', name: 'Halfway House', desc: 'Survive to 12:00.', reward: 30 },
  { id: 'win_carnival', name: 'Carnival Champion', desc: 'Won on the old Carnival difficulty.', reward: 150, retired: true },
  { id: 'win_nightmare', name: 'Nightmare Survivor', desc: 'Won on the old Nightmare difficulty.', reward: 300, retired: true },
  { id: 'win_cursed', name: 'Cursed and Victorious', desc: 'Win with the Curse active.', reward: 200 },
  { id: 'first_evolution', name: 'Evolutionist', desc: 'Evolve a weapon.', reward: 30 },
  { id: 'full_house', name: 'Full House', desc: 'Discover every evolution.', reward: 400 },
  { id: 'kills_1000', name: 'Crowd Control', desc: 'Defeat 1,000 enemies in one run.', reward: 40 },
  { id: 'kills_5000', name: 'Midway Massacre', desc: 'Defeat 5,000 enemies in one run.', reward: 100 },
  { id: 'level_40', name: 'Ticket Hoarder', desc: 'Reach level 40 in one run.', reward: 60 },
  { id: 'all_characters', name: 'The Whole Troupe', desc: 'Unlock all seven characters.', reward: 150 },
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
  // the Ghost Train (D-80)
  { id: 'beat_stationmaster', name: 'Mind the Gap', desc: 'Defeat the Stationmaster.', reward: 40 },
  { id: 'beat_stoker', name: 'Banked', desc: 'Defeat the Stoker.', reward: 50 },
  { id: 'beat_widow', name: 'Laid to Rest', desc: "Defeat the Widow of Saint Vesper's.", reward: 60 },
  { id: 'beat_foreman', name: 'Clocked Off', desc: 'Defeat the Iron Foreman.', reward: 80 },
  { id: 'beat_hour_thief', name: 'Thirteen O\'Clock', desc: 'Defeat the Hour Thief.', reward: 100 },
  { id: 'beat_unclaimed', name: 'Lost and Found', desc: 'Defeat the Unclaimed.', reward: 120 },
  { id: 'beat_night_express', name: 'End of the Line', desc: "Defeat the Night Express and see the Ghost Train's dawn.", reward: 180 },
  { id: 'last_train', name: 'The Last Train Home', desc: 'Punch every ticket, and see the Conductor off.', reward: 500 },
  // companions (D-84): each brings a pet along, and each can be earned on any map
  { id: 'pet_milo', name: 'Fetch!', desc: 'Pick up two golden tickets in a single night, on any map. Milo comes along.', reward: 60 },
  { id: 'pet_augustus', name: 'Nine Lives', desc: 'See the dawn on any map without your health ever falling below half. Augustus comes along.', reward: 120 },
  // the world tiers (D-97): earned only by a night that counts for this save (its tier and map open on it)
  { id: 'nm_carnival_core', name: 'The Haunted Midway', desc: 'Win the Carnival Core on Nightmare.', reward: 600 },
  { id: 'nm_fun_house', name: 'Mirror, Mirror, Dead and Gone', desc: 'Win the Fun House on Nightmare.', reward: 800 },
  { id: 'nm_boardwalk', name: 'Drowned Lights', desc: 'Win the Boardwalk on Nightmare.', reward: 1000 },
  { id: 'nm_ghost_train', name: "Nightmare's End", desc: 'Finish the Ghost Train on Nightmare: the Haunted Carnival is beaten, and Hell opens.', reward: 2500 },
  { id: 'hell_carnival_core', name: 'The Burning Big Top', desc: 'Win the Carnival Core on Hell.', reward: 1000 },
  { id: 'hell_fun_house', name: 'Smoke and Mirrors', desc: 'Win the Fun House on Hell.', reward: 1400 },
  { id: 'hell_boardwalk', name: 'The Boiling Sea', desc: 'Win the Boardwalk on Hell.', reward: 1800 },
  { id: 'hell_ghost_train', name: 'Master of the Infernal Carnival', desc: 'Finish the Ghost Train on Hell: every world of the carnival is beaten.', reward: 6000 },
  { id: 'nm_cursed', name: 'Cursed Spirits', desc: 'Win any night on Nightmare with the Curse.', reward: 1500 },
  { id: 'hell_cursed', name: 'Damned', desc: 'Win any night on Hell with the Curse.', reward: 3000 },
  { id: 'tier_party', name: 'Haunted Together', desc: 'Win a night on Nightmare or Hell in a party of three or more.', reward: 600 },
];

/** The tier achievements a won night earns for a save it counts for (D-97). */
export function tierAchievements(tier: TierId, map: string, curse: boolean, partySize: number): string[] {
  if (tier === 'normal') return [];
  const k = tier === 'nightmare' ? 'nm' : 'hell';
  const out = [`${k}_${map}`];
  if (curse) out.push(`${k}_cursed`);
  if (partySize >= 3) out.push('tier_party');
  return out;
}

/** End-of-run payout (doc 01 §8). */
export function computePayout(o: { seconds: number; bosses: number; kills: number; won: boolean; greed: number; endlessExtraSeconds?: number; dawn?: number }): number {
  // D-80: the clock pays to the night's own dawn (the Ghost Train's is 35:00)
  const base = Math.floor(Math.min(o.seconds, o.dawn ?? 1500) / 6) + 50 * o.bosses + Math.floor(o.kills / 25) + (o.won ? 100 : 0)
    + Math.floor((o.endlessExtraSeconds ?? 0) / 4);
  return Math.round(base * o.greed);
}
