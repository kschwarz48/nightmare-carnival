// Player state (doc 01 §6–7). Built from a CharacterDef + meta perks.

import { CHARACTER_MAP, type CharacterDef } from '../data/characters';
import { PASSIVES, type StatAxis } from '../data/weapons';
import { PlayerStats } from './stats';
import type { Weapons } from './weapons';

export class Player {
  /** Slot in the party (0 = host / solo). */
  index = 0;
  name = 'Player 1';
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

  addPassive(id: string): void {
    const def = PASSIVES[id];
    if (!def) return;
    const lvl = this.passiveLevel(id);
    if (lvl >= def.maxLevel) return;
    const oldMax = this.stats.maxHp();
    for (const eff of def.effects) this.stats.apply(eff.axis, eff.perLevel[lvl] ?? 0);
    this.passives.set(id, lvl + 1);
    const newMax = this.stats.maxHp();
    if (newMax > oldMax) this.hp += newMax - oldMax; // growing max HP also heals the difference
  }
}
