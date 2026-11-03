// Player state (doc 01 §6–7). Built from a CharacterDef + meta perks.

import { CHARACTER_MAP, type CharacterDef } from '../data/characters';
import { PASSIVES, type StatAxis } from '../data/weapons';
import { QUALITY, qualityGain, type Quality } from '../data/quality';
import { PlayerStats } from './stats';
import type { Weapons } from './weapons';

export class Player {
  /** Slot in the party (0 = host / solo). */
  index = 0;
  name = 'Player 1';
  /** the companion following this player (D-84; its passive is already in the stats), or none */
  pet: string | null = null;
  /** this night so far: the lowest health fraction reached, and the golden tickets picked up (the pets' achievements) */
  lowHp = 1;
  goldens = 0;
  /** This player's arsenal (each player owns one; the game points `g.weapons` at it as context). */
  weapons!: Weapons;
  /** Co-op: fallen into a coffin, waiting to be revived (D-51). */
  downed = false;
  /** Coffin revive progress 0..1, and whether a teammate is speeding it up. */
  reviveT = 0;
  reviveAssist = false;
  /** co-op: chest prizes this player has been dealt so far tonight (small chests go to whoever has fewest) */
  chestPrizes = 0;
  /** How this player's aimable weapons pick a direction (their own setting in co-op). */
  aimMode: 'auto' | 'hybrid' | 'manual' = 'auto';
  /** Draft cards this player has banished. */
  banished = new Set<string>();
  /** the quality of each level of each passive (QUALITY indices, D-99) */
  passiveQ = new Map<string, number[]>();
  /** the stats this player started the night with (character, Lost & Found, companion): the build sheet's base (D-99) */
  baseStats: PlayerStats | null = null;
  /** Lost & Found / hidden-quest unlocks this player's own save has added to their draft pool (D-74). */
  unlocked = new Set<string>();
  char: CharacterDef;
  stats = new PlayerStats();
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  r = 12;
  hp = 100;
  iframes = 0;
  hurtFlash = 0;
  faceX = 1; // last move direction (unit)
  faceY = 0;
  facing = 1; // sprite facing -1/1
  moving = false;
  animT = 0;
  slowT = 0;
  slowF = 1;
  /** a Ticket Taker's stub (D-68): while it lasts, the crowd comes for this player faster */
  markedT = 0;
  /** the Nightmare and Hell shelves tonight (D-97, sim/tierPerks.ts): Soul Collector's souls and their clock, whether
   *  Second Chance has been spent, Second Wind's clock, and the changing bonuses already in the stats */
  souls = 0;
  soulT = 0;
  secondChanceUsed = false;
  windT = 0;
  tierBonus = { might: 0, hp: 0, armor: 0 };
  /** the Soul Jar: kills since it last broke */
  jarKills = 0;
  /** this player's own share of the night, for the co-op leaderboard (D-71) */
  runDmg = 0;
  runBossDmg = 0;
  runKills = 0;
  runHurt = 0;
  runDowns = 0;
  runRevives = 0;
  runTickets = 0;
  /** Lost Tickets from this night's vouchers (banked as they were taken; the live count shows them, D-85) */
  runVouchers = 0;
  /**
   * The damage meter (D-85): this night's damage by source — a weapon's line (an evolution's is its base
   * weapon's; a mirror clone's replays are the mirror's) or another source ('revive', 'spark_trail') — and
   * the night's clock when each weapon line joined this player's build.
   */
  dmgBy = new Map<string, number>();
  dmgSince = new Map<string, number>();
  pullX = 0;
  pullY = 0;
  dashT = 0; // bumper-car surge remaining
  dashX = 0;
  dashY = 0;
  dashSpeed = 0;
  regenAcc = 0;
  sparkAcc = 0;
  shieldReady = false;
  shieldT = 0;
  reviveFx = 0;
  dead = false;
  /** passive id -> level */
  passives = new Map<string, number>();
  /** Recorded stat additions from meta perks (for results screen). */
  rerolls = 0;
  banishes = 0;
  canSkip = false;
  /** Damage taken during the current boss fight (Untouchable achievement). */
  bossDamageTaken = 0;

  constructor(charId: string) {
    this.char = CHARACTER_MAP[charId] ?? CHARACTER_MAP.carny;
    const c = this.char;
    this.stats.baseHp = c.hp;
    this.stats.baseSpeed = c.speed;
    this.stats.basePickup = c.pickup;
    for (const [axis, v] of Object.entries(c.mods)) this.stats.apply(axis as StatAxis, v as number);
    if (c.quirk === 'shove') this.stats.knockbackShove = 5;
    if (c.quirk === 'balloon_shield') this.shieldReady = true;
    this.r = c.id === 'strongman' ? 14 : c.id === 'lost_child' ? 11 : 12;
  }

  initHp(): void {
    this.hp = this.stats.maxHp();
  }

  passiveLevel(id: string): number {
    return this.passives.get(id) ?? 0;
  }

  addPassive(id: string, q: Quality = 'common'): void {
    const def = PASSIVES[id];
    if (!def) return;
    const lvl = this.passiveLevel(id);
    if (lvl >= def.maxLevel) return;
    const oldMax = this.stats.maxHp();
    // the level's quality scales its gains (D-99)
    for (const eff of def.effects) this.stats.apply(eff.axis, qualityGain(eff.axis, eff.perLevel[lvl] ?? 0, q));
    this.passives.set(id, lvl + 1);
    const qs = this.passiveQ.get(id) ?? [];
    qs[lvl] = QUALITY[q].idx;
    this.passiveQ.set(id, qs);
    const newMax = this.stats.maxHp();
    if (newMax > oldMax) this.hp += newMax - oldMax; // growing max HP also heals the difference
  }
}
