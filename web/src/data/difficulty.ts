// The Curse and time scaling (doc 01 §10, doc 03 §7.3, D-02). The per-night difficulties that lived here (Midway,
// Carnival, Nightmare) are retired: the world tiers (data/tiers.ts, D-97) set a night's numbers now.

import { TICKETS } from './progression';

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
