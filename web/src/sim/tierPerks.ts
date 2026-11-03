// The Nightmare and Hell shelves of the Lost & Found in a night (D-97, docs/WORLD_TIER_DESIGN.md §6). Each player's
// own, from their save's levels: they reach the night as meta stats like any perk (PlayerStats' tier fields, a level
// each; a guest's are validated against the shelf's caps on arrival). Their changing bonuses (souls, the night's
// last act, bosses beaten, low health) touch only stats the host alone reads (might, maximum health, armour), so a
// guest's prediction never depends on them.

import type { Game } from './game';
import type { Player } from './player';
import { ignite, type Enemy } from './entities';
import { DAWN_TIME } from '../data/waves';

export const TIER_PERK = {
  /** Second Chance: once a night, a blow that would down you leaves you standing */
  secondChance: { hpFrac: 0.3, iframes: 2.5, r: 240, shove: 5 },
  /** Soul Collector: a soul for each elite or miniboss you kill, lasting `life` s; might per soul by level */
  soul: { life: 30, max: 3, might: [0, 0.04, 0.06, 0.08] },
  /** Prize Hunter: the elites' chest odds, by the party's best level */
  prizeHunter: [1, 1.5, 2],
  /** Opening Act: a draft waiting this long into the night */
  openingAt: 1.5,
  /** Second Wind: food heals more by level, and lends might for a while */
  secondWind: { heal: [1, 1.2, 1.4, 1.6], might: 0.2, t: 4 },
  /** Final Act: might in the night's last `last` seconds before dawn */
  finalAct: { might: [0, 0.12, 0.24], last: 300 },
  /** Unfinished Business: per boss beaten tonight (up to `max`), might and maximum health by level */
  unfinished: { might: [0, 0.03, 0.04, 0.05], hp: [0, 0.02, 0.03, 0.04], max: 6 },
  /** Infernal Resilience: what telegraphed strikes (hazards, explosions) still do, by level */
  infernal: [1, 0.9, 0.83, 0.75],
  /** Ember Heart: below `below` of your health, health a second and armour by level */
  emberHeart: { below: 0.35, regen: [0, 1, 2], armor: [0, 2, 4] },
  /** the tiers' passives: the Soul Jar's kills per blast (by level), its blast; Brimstone's ignite chance per level, its
   *  burn and burst; Cinder Heart's healing per burning creature nearby (by level), its reach and cap */
  soulJar: { kills: [0, 40, 37, 34, 31, 28], r: 210, dmg: [0, 40, 52, 64, 76, 90] },
  brimstone: { chance: 0.04, t: 3, dps: [0, 5, 7, 9, 11, 13], burstR: 75, burst: [0, 10, 14, 18, 22, 26] },
  cinderHeart: { heal: [0, 0.12, 0.18, 0.24, 0.3, 0.36], r: 170, max: 6 },
  /** Devil's Bargain (switchable): maximum health and might while it is on */
  bargain: { hp: -0.25, might: 0.3 },
};

/** The might, maximum health and armour the shelves' changing bonuses add right now. */
function bonusesOf(g: Game, p: Player): { might: number; hp: number; armor: number } {
  const s = p.stats, T = TIER_PERK;
  const low = s.emberHeart > 0 && p.hp > 0 && p.hp < s.maxHp() * T.emberHeart.below;
  const last = s.finalAct > 0 && !g.endless && g.time >= DAWN_TIME - T.finalAct.last;
  const bosses = Math.min(g.bossKills, T.unfinished.max);
  // Death's Door: its might grows as health falls
  const door = s.deathsDoor > 0 && p.hp > 0 ? s.deathsDoor * Math.max(0, 1 - p.hp / s.maxHp()) : 0;
  return {
    might: door + p.souls * (T.soul.might[s.soulCollector] ?? 0) + (last ? T.finalAct.might[s.finalAct] ?? 0 : 0) + bosses * (T.unfinished.might[s.unfinished] ?? 0) + (p.windT > 0 ? T.secondWind.might : 0),
    hp: bosses * (T.unfinished.hp[s.unfinished] ?? 0),
    armor: low ? T.emberHeart.armor[s.emberHeart] ?? 0 : 0,
  };
}

/** Each tick for each standing player: the timers, Ember Heart's healing and the bonuses (applied as differences). */
export function tickTierPerks(g: Game, p: Player, dt: number): void {
  const s = p.stats;
  if (p.soulT > 0 && (p.soulT -= dt) <= 0) p.souls = 0;
  if (p.windT > 0) p.windT -= dt;
  if (s.emberHeart > 0 && p.hp > 0 && p.hp < s.maxHp() * TIER_PERK.emberHeart.below) p.hp = Math.min(s.maxHp(), p.hp + (TIER_PERK.emberHeart.regen[s.emberHeart] ?? 0) * dt);
  // Cinder Heart: each burning creature close by warms you
  if (s.cinderHeart > 0 && p.hp > 0 && p.hp < s.maxHp()) {
    const C = TIER_PERK.cinderHeart;
    let n = 0;
    g.forEachEnemyInCircle(p.x, p.y, C.r, (e) => void (e.burnT > 0 && n < C.max && n++));
    if (n) p.hp = Math.min(s.maxHp(), p.hp + n * (C.heal[s.cinderHeart] ?? 0) * dt);
  }
  const now = bonusesOf(g, p), b = p.tierBonus;
  if (now.might !== b.might) {
    s.might += now.might - b.might;
    b.might = now.might;
  }
  if (now.armor !== b.armor) {
    s.armor += now.armor - b.armor;
    b.armor = now.armor;
  }
  if (now.hp !== b.hp) {
    // more maximum health arrives filled (as a level's would); less only trims what is over the new maximum
    const before = s.maxHp();
    s.maxHpMult += now.hp - b.hp;
    b.hp = now.hp;
    p.hp = Math.min(s.maxHp(), p.hp + Math.max(0, s.maxHp() - before));
  }
}

/** Second Chance: a blow that would down `p` leaves them on 30% instead (once a night). Returns whether it did. */
export function trySecondChance(g: Game, p: Player): boolean {
  if (p.stats.secondChance <= 0 || p.secondChanceUsed) return false;
  const T = TIER_PERK.secondChance;
  p.secondChanceUsed = true;
  p.hp = p.stats.maxHp() * T.hpFrac;
  p.iframes = T.iframes;
  p.reviveFx = 1.2;
  g.fx.push('ring', p.x, p.y, T.r, 0, 0, 'revive');
  g.fx.push('flash', p.x, p.y, 0.4);
  g.forEachEnemyInCircle(p.x, p.y, T.r, (e) => g.knockback(e, p.x, p.y, T.shove));
  g.bus.emit('sfx', { id: 'revive', vol: 0.8 });
  return true;
}

/** Soul Collector: `who` killed `e`; an elite or the map's miniboss gives them a soul. */
export function collectSoul(g: Game, who: Player | undefined, e: Enemy): void {
  if (!who || who.stats.soulCollector <= 0 || !(e.elite || e.def.id === g.map.miniboss)) return;
  who.souls = Math.min(TIER_PERK.soul.max, who.souls + 1);
  who.soulT = TIER_PERK.soul.life;
  g.fx.push('ring', e.x, e.y, 70, 0, 0, 'revive');
}

/** Prize Hunter: the elites' chest odds for the party (its best level: a chest is everyone's). */
export function eliteChestMult(g: Game): number {
  let lv = 0;
  for (const p of g.players) lv = Math.max(lv, p.stats.prizeHunter);
  return TIER_PERK.prizeHunter[lv] ?? 1;
}

/** Second Wind: what a meal heals `p` (and it lends might for a while). */
export function mealHeal(p: Player, heal: number): number {
  const lv = p.stats.secondWind;
  if (lv <= 0) return heal;
  p.windT = TIER_PERK.secondWind.t;
  return heal * (TIER_PERK.secondWind.heal[lv] ?? 1);
}

/** Infernal Resilience: what a telegraphed strike does to `p`. */
export function telegraphedDamage(p: Player, amount: number): number {
  return amount * (TIER_PERK.infernal[p.stats.infernal] ?? 1);
}

/** Opening Act: is a night-start draft owed to anyone (and is it time)? */
export function openingActDue(g: Game): boolean {
  return !g.openingActDone && g.time >= TIER_PERK.openingAt && g.players.some((p) => p.stats.openingAct > 0 && !p.dead);
}

/** The Soul Jar: `who` killed something; every so many kills the jar breaks in a spectral blast around them. */
export function fillSoulJar(g: Game, who: Player | undefined): void {
  if (!who || who.stats.soulJar <= 0 || who.dead || who.downed) return;
  const J = TIER_PERK.soulJar, lv = Math.min(5, who.stats.soulJar);
  if (++who.jarKills < J.kills[lv]) return;
  who.jarKills = 0;
  const dmg = J.dmg[lv] * who.stats.might;
  g.fx.push('ring', who.x, who.y, J.r, 0, 0, 'revive');
  g.bus.emit('sfx', { id: 'toll', x: who.x, y: who.y, vol: 0.45 });
  g.creditTo(who.index, () => g.forEachEnemyInCircle(who.x, who.y, J.r, (e) => void g.damageEnemy(e, dmg, false, 3, who.x, who.y, 'soul_jar')));
}

/** Brimstone: a hit by `who` may set `e` alight (the caller has checked they carry it). */
export function brimstoneHit(g: Game, who: Player, e: Enemy): void {
  const B = TIER_PERK.brimstone, lv = Math.min(5, who.stats.brimstone);
  if (e.burnT > 0 || !g.rng.chance(B.chance * lv)) return;
  ignite(e, B.t, B.dps[lv] * who.stats.might, 'brimstone', who.index);
}

let bursting = false;
/** Brimstone: a burning creature lit by a Brimstone carrier bursts as it dies (bursts don't chain). */
export function brimstoneBurst(g: Game, e: Enemy): void {
  if (bursting || e.burnT <= 0) return;
  const who = g.players[e.burnBy];
  if (!who || who.stats.brimstone <= 0) return;
  const B = TIER_PERK.brimstone, lv = Math.min(5, who.stats.brimstone);
  bursting = true;
  try {
    g.fx.push('death', e.x, e.y, 0.9, 0, 0, 'fire');
    g.creditTo(who.index, () => g.forEachEnemyInCircle(e.x, e.y, B.burstR, (o) => void (o !== e && g.damageEnemy(o, B.burst[lv] * who.stats.might, false, 1, e.x, e.y, 'brimstone'))));
  } finally {
    bursting = false;
  }
}
