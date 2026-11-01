// Evolution recipes as the HUD reads them (D-79): what one player holds, and where each recipe stands for
// them. Kept apart from the HUD's page code so it can be tested without a page.

import { WEAPONS } from '../data/weapons';
import type { Game } from '../sim/game';
import type { Player } from '../sim/player';
import { isUnlockedFor, type DraftBuild } from '../sim/draft';

/**
 * One player's weapons and passives (by id, with their levels) for the recipe bands. Always read from that
 * player, never from whoever the game's context happens to point at: a level-up a teammate set off by picking
 * up the ticket was shown against the teammate's build (D-79). On a guest it is read from the build the host
 * dealt the hand from, so a pick made a moment ago counts before the snapshot carrying it arrives.
 */
export interface Kit {
  weapons: Map<string, number>;
  passives: Map<string, number>;
  /** whether an item with this unlock id is in this player's draft pool */
  unlocked: (unlock?: string) => boolean;
}

const pairs = (a: unknown): a is [string, number][] =>
  Array.isArray(a) && a.every((x) => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'number');

/** Player `p`'s kit: from the dealt hand's build when there is one (and it reads right), else from `p` itself. */
export function kitOf(g: Game, p: Player, build?: DraftBuild): Kit {
  const use = !!build && pairs(build.w) && pairs(build.p);
  return {
    weapons: new Map(use ? build!.w : p.weapons.list.map((w): [string, number] => [w.def.id, w.level])),
    passives: new Map(use ? build!.p : [...p.passives]),
    unlocked: (u) => isUnlockedFor(g, p, u),
  };
}

export interface RecipeState {
  /** the weapon is held (or comes with the offered card), at level `lv` of its top level `max` */
  owned: boolean;
  lv: number;
  max: number;
  haveLv: boolean;
  /** the passive is held (or comes with the offered card) */
  mine: boolean;
  ready: boolean;
}

/**
 * Where weapon `weaponId`'s evolution recipe stands for a kit (null if it has none). `levelAfter` is the
 * weapon's level once an offered card is taken; `passiveAfter` marks a recipe shown on the passive's own card.
 */
export function recipeState(kit: Kit, weaponId: string, levelAfter?: number, passiveAfter = false): RecipeState | null {
  const d = WEAPONS[weaponId];
  if (!d?.evolvesTo || !d.evoPassive) return null;
  const have = kit.weapons.get(weaponId);
  const lv = Math.min(d.maxLevel, levelAfter ?? have ?? 0);
  const haveLv = lv >= d.maxLevel;
  const mine = passiveAfter || (kit.passives.get(d.evoPassive) ?? 0) >= 1;
  return { owned: levelAfter !== undefined || have !== undefined, lv, max: d.maxLevel, haveLv, mine, ready: haveLv && mine };
}

/**
 * The weapons whose evolutions a passive feeds and can still come of it for this kit (D-75): held weapons
 * first, then those in the player's draft pool; a weapon already evolved needs it no more.
 */
export function passiveFeeds(kit: Kit, passiveId: string): string[] {
  const evolved = new Set<string>();
  for (const id of kit.weapons.keys()) {
    const from = WEAPONS[id]?.evolvedFrom;
    if (from) evolved.add(from);
  }
  return Object.values(WEAPONS)
    .filter((w) => w.evoPassive === passiveId && !w.isEvolution && !evolved.has(w.id) && (kit.weapons.has(w.id) || kit.unlocked(w.unlock)))
    .sort((a, b) => Number(kit.weapons.has(b.id)) - Number(kit.weapons.has(a.id)))
    .map((w) => w.id);
}
