// The damage meter's numbers (D-85): each player's damage tonight by source, when each weapon joined their
// build, and the Lost Tickets they have earned so far. The host's sim keeps them (`Player.dmgBy` and
// `dmgSince`, `Game.liveTickets`); a guest's mirror never ticks, so the host sends them about once a second
// and the guest keeps the last word in `Game.netMeter`.

import { WEAPONS } from '../data/weapons';
import type { Game } from './game';

/** A weapon's line: an evolution's damage is its base weapon's (it is the same slot, the same weapon). */
export const lineOf = (id: string): string => WEAPONS[id]?.evolvedFrom ?? id;

/** Damage that isn't a weapon's: the Spare Balloon's burst on a revive, the Ride Operator's spark trail (and a catch-all). */
export const OTHER_SOURCES: readonly string[] = ['revive', 'spark_trail', 'other'];

/** Can `key` be a meter source? (weapon lines and the other sources; what a guest accepts from the wire) */
export const isSource = (key: string): boolean => !!WEAPONS[key] || OTHER_SOURCES.includes(key);

export interface MeterLine {
  key: string;
  dmg: number;
  /** the night's clock when it joined the build (0 for the other sources) */
  since: number;
}
export interface MeterPlayer {
  /** Lost Tickets earned so far tonight */
  lt: number;
  lines: MeterLine[];
}

/** Every player's meter, by player index: from the sim, or on a guest the host's last word. */
export function meterState(g: Game): MeterPlayer[] {
  if (g.netMeter) return g.netMeter;
  return g.players.map((p) => {
    const keys = new Set([...p.dmgSince.keys(), ...p.dmgBy.keys()]);
    return { lt: g.liveTickets(p), lines: [...keys].map((key) => ({ key, dmg: p.dmgBy.get(key) ?? 0, since: p.dmgSince.get(key) ?? 0 })) };
  });
}

/** Player `i`'s Lost Tickets so far tonight (the HUD's count), without building the whole meter. */
export function liveLt(g: Game, i: number): number {
  if (g.netMeter) return g.netMeter[i]?.lt ?? 0;
  const p = g.players[i];
  return p ? g.liveTickets(p) : 0;
}

/** Damage per second since it joined the build (the night's clock for a player or another source). */
export function dps(dmg: number, now: number, since: number): number {
  return dmg / Math.max(3, now - since);
}
