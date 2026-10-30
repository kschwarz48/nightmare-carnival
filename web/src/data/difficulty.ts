// Difficulty tiers + Curse (doc 01 §10, doc 03 §7.3, D-02).

import { TICKETS } from './progression';

export interface DifficultyDef {
  id: 'midway' | 'carnival' | 'nightmare';
  name: string;
  desc: string;
  hpMult: number;
  dmgMult: number;
  cap: number;
  greed: number;
  minibossInterval: number;
  eliteAffixes: number; // affixes rolled per elite
  eliteChanceMult: number;
  unlock: null | { req: string; reqText: string };
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: 'midway', name: 'Midway', desc: 'The intended first night. Readable crowds, honest bosses.', hpMult: 1.0, dmgMult: 1.0, cap: 180, greed: 0, minibossInterval: 110, eliteAffixes: 0, eliteChanceMult: 1, unlock: null },
  { id: 'carnival', name: 'Carnival', desc: 'Denser, tougher, +30% Lost Tickets.', hpMult: 1.5, dmgMult: 1.25, cap: 280, greed: 0.3, minibossInterval: 95, eliteAffixes: 1, eliteChanceMult: 1.25, unlock: { req: 'beat_ferris_wheel', reqText: 'Defeat the Ferris Wheel' } },
  { id: 'nightmare', name: 'Nightmare', desc: 'The carnival at full appetite. Elites carry two affixes. +60% Lost Tickets.', hpMult: 2.2, dmgMult: 1.6, cap: 400, greed: 0.6, minibossInterval: 85, eliteAffixes: 2, eliteChanceMult: 1.5, unlock: { req: 'win_carnival', reqText: 'Win on Carnival' } },
];

export const DIFFICULTY_MAP = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d])) as Record<DifficultyDef['id'], DifficultyDef>;

export const CURSE = {
  intervalMult: 0.8,
  capMult: 1.15,
  speedMult: 1.12,
  hpMult: 1.2,
  xpMult: 1.1,
  payoutMult: 1.35,
  unlock: { req: 'beat_puppet_king', reqText: 'Defeat the Puppet King' },
};

/** Time scaling applied to every spawned enemy (doc 03 §7.3). */
export function timeScaling(minutes: number, endlessExtraMinutes = 0) {
  return {
    hp: (1 + 0.06 * minutes) * (1 + 0.12 * endlessExtraMinutes),
    dmg: (1 + 0.04 * minutes) * (1 + 0.06 * endlessExtraMinutes),
    speed: Math.min(1 + 0.01 * minutes, 1.6),
    tickets: 1 + TICKETS.perMinute * minutes,
  };
}
