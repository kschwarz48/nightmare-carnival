// Creature variants in a night (D-97, data/variants.ts): the abilities a kind gains on Nightmare and Hell, run in
// the host's simulation with its seeded randomness. Every strike is an existing replicated kind (hazards, which
// guests already draw with their telegraphs; the Reflection Thief's illusions); the states a guest must see
// (phasing, wrath, plating, an ability's tell) ride the enemy flags (net/snapshot.ts EF).

import type { Game } from './game';
import type { Enemy } from './entities';
import { ABILITY_BITS as B, VARIANT_NUMBERS as N, variantBits } from '../data/variants';

/** what a guest is told (EF bits 16..128) */
export const VF = { phased: 1, wrath: 2, plated: 4, tell: 8 };

const range = (g: Game, r: [number, number]) => g.rng.range(r[0], r[1]);

/** A kind's variant for this night's tier, set as it spawns (illusions and minis get none). */
export function initVariant(g: Game, e: Enemy): void {
  e.vAb = g.tier === 'normal' || e.illusion ? 0 : variantBits(g.tier, e.def.id);
  // (only a creature with an ability draws on the night's randomness: Normal's nights stay as they were)
  e.vT = e.vAb ? g.rng.range(2, 5) : 0;
  e.vT2 = 0;
  e.vState = 0;
  e.vFlags = 0;
  e.vHits = e.vAb & B.harden ? N.harden.hits : 0;
  e.vDecoyT = 0;
  e.vRaged = false;
  if (e.vHits > 0) e.vFlags |= VF.plated;
}

/** The nearest standing player to `e` within `reach` (or null). */
function target(g: Game, e: Enemy, reach: number) {
  let best = null, bd = reach * reach;
  for (const p of g.players) {
    if (p.dead || p.downed) continue;
    const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

function hazardRoom(g: Game): boolean {
  let n = 0;
  for (const h of g.hazards) if (h.alive) n++;
  return n < g.hazards.length - 24;
}

/** Each tick for each living creature with a variant. */
export function tickVariant(g: Game, e: Enemy, dt: number): void {
  const ab = e.vAb;
  if (!ab || e.hidden || e.emerge > 0 || e.illusion) return;
  // Wrath: below 40%, faster and harder hitting (once)
  if (ab & B.enrage && !e.vRaged && e.hp < e.maxHp * N.enrage.below) {
    e.vRaged = true;
    e.speed *= N.enrage.speed;
    e.dmg *= N.enrage.dmg;
    e.vFlags |= VF.wrath;
    g.fx.push('ring', e.x, e.y, 60, 0, 0, 'revive');
  }
  if (e.vDecoyT > 0) e.vDecoyT -= dt;
  // Firewalker: burning ground behind it while it moves
  if (ab & B.trail) {
    e.vT2 -= dt;
    if (e.vT2 <= 0 && hazardRoom(g)) {
      e.vT2 = N.trail.every;
      g.spawnHazard('circle', 'fire_trail', e.x, e.y, { r: N.trail.r, tele: 0.35, active: N.trail.life, dmg: (N.trail.dps / 2) * g.diff.dmgMult, tick: 0.5, owner: -1 });
    }
  }
  // the timed abilities share one clock: a tell, then the act
  e.vT -= dt;
  if (e.vState === 0) {
    e.vFlags &= ~VF.tell;
    if (e.vT > 0) return;
    if (ab & B.phase) return startTell(e, 1, N.phase.tell);
    if (ab & B.blink) {
      const p = target(g, e, N.blink.reach);
      if (!p) return void (e.vT = 1);
      const a = g.rng.angle();
      e.tx = p.x + Math.cos(a) * N.blink.near;
      e.ty = p.y + Math.sin(a) * N.blink.near;
      g.spawnHazard('circle', 'blink_mark', e.tx, e.ty, { r: e.r + 22, tele: N.blink.tell, active: 0.05, dmg: 0, owner: e.uid });
      return startTell(e, 2, N.blink.tell);
    }
    if (ab & B.wail) {
      if (!target(g, e, N.wail.reach)) return void (e.vT = 1);
      return startTell(e, 3, N.wail.tell);
    }
    if (ab & B.ember) {
      const p = target(g, e, N.ember.reach);
      if (!p || !hazardRoom(g)) return void (e.vT = 1);
      g.spawnHazard('circle', 'fireball', p.x, p.y, { r: N.ember.r, tele: N.ember.tele, active: 0.15, dmg: N.ember.dmg * g.diff.dmgMult, owner: e.uid });
      e.vT = range(g, N.ember.every);
      g.bus.emit('sfx', { id: 'whoosh', x: e.x, y: e.y, vol: 0.4 });
      return;
    }
    if (ab & B.quake) {
      if (!target(g, e, N.quake.r + 200) || !hazardRoom(g)) return void (e.vT = 1);
      g.spawnHazard('ring', 'quake_ring', e.x, e.y, { r: 30, r2: 6, grow: 260, tele: 0.6, active: N.quake.r / 260, dmg: N.quake.dmg * g.diff.dmgMult, owner: e.uid });
      e.vT = N.quake.every;
      return;
    }
    e.vT = 9999;
    return;
  }
  // a tell is running
  if (e.vT > 0) return;
  switch (e.vState) {
    case 1: // shimmer done: intangible
      e.vState = 11;
      e.vFlags = (e.vFlags & ~VF.tell) | VF.phased;
      e.vT = N.phase.hold;
      return;
    case 11: // solid again
      e.vState = 0;
      e.vFlags &= ~VF.phased;
      e.vT = range(g, N.phase.every);
      return;
    case 2: // blink: arrive at the mark
      e.x = e.px = e.tx;
      e.y = e.py = e.ty;
      g.fx.push('ring', e.x, e.y, 80, 0, 0, 'revive');
      e.vState = 0;
      e.vT = range(g, N.blink.every);
      return;
    case 3: // wail: a widening pale ring that slows (and stings)
      g.spawnHazard('ring', 'wail_ring', e.x, e.y, { r: 24, r2: 8, grow: 300, tele: 0.01, active: N.wail.reach / 300, dmg: 3 * g.diff.dmgMult, slow: N.wail.slow, owner: e.uid });
      g.bus.emit('sfx', { id: 'toll', x: e.x, y: e.y, vol: 0.35 });
      e.vState = 0;
      e.vT = range(g, N.wail.every);
      return;
  }
  e.vState = 0;
}

function startTell(e: Enemy, state: number, t: number): void {
  e.vState = state;
  e.vT = t;
  e.vFlags |= VF.tell;
}

/** Is `e` out of reach right now (phasing)? Nothing hurts it, it hurts nothing. */
export function phased(e: Enemy): boolean {
  return (e.vFlags & VF.phased) !== 0;
}

/** A hit on `e`: plating halves it (cracking after a few), ectoplasm sheds illusions. Returns the damage left. */
export function variantHit(g: Game, e: Enemy, dmg: number): number {
  if (e.vHits > 0) {
    dmg *= N.harden.mult;
    if (--e.vHits === 0) {
      e.vFlags &= ~VF.plated;
      g.fx.push('spark', e.x, e.y, 1.2, 0, 0, 'shield');
    }
  }
  if (e.vAb & B.decoy && e.vDecoyT <= 0) {
    e.vDecoyT = N.decoy.every;
    for (let i = 0; i < N.decoy.count; i++) {
      const a = g.rng.angle();
      const c = g.spawnEnemy(e.def.id, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70);
      if (!c) break;
      c.illusion = true;
      c.illusionOf = e.uid;
      c.noContact = true;
      c.hp = c.maxHp = 1;
      c.tickets = 0;
      c.vAb = 0;
      c.vFlags = 0;
    }
    g.fx.push('death', e.x, e.y, 0.8, 0, 0, 'glass');
  }
  return dmg;
}

/** `e` died: a haunting spirit or a volatile blast, after a short fuse. */
export function variantDeath(g: Game, e: Enemy): void {
  if (!e.vAb || e.illusion) return;
  if (e.vAb & B.haunt && hazardRoom(g)) g.spawnHazard('circle', 'haunt_burst', e.x, e.y, { r: N.haunt.r, tele: N.haunt.tele, active: 0.15, dmg: N.haunt.dmg * g.diff.dmgMult, owner: -1 });
  if (e.vAb & B.blast && hazardRoom(g)) g.spawnHazard('circle', 'blast', e.x, e.y, { r: N.blast.r, tele: N.blast.tele, active: 0.15, dmg: N.blast.dmg * g.diff.dmgMult, owner: -1 });
}

// ------------------------------------------------------------------ the bosses' tier attacks
/**
 * The bosses on Nightmare and Hell (D-97, docs/WORLD_TIER_DESIGN.md §8): over their own patterns, a tier attack on
 * its own clock, telegraphed like everything else: Nightmare's spectral choir (a wail ring from the boss and
 * haunting bursts where the players stand), Hell's firestorm (fireballs at and around the players, a tremor ring).
 * The maps' final bosses use it more often and harder; Hell escalates both.
 */
export const BOSS_TIER = {
  nightmare: { every: [11, 14] as [number, number], finalEvery: [8, 10] as [number, number], bursts: 1, finalBursts: 2 },
  hell: { every: [9, 12] as [number, number], finalEvery: [6, 8] as [number, number], balls: 2, finalBalls: 4 },
};

export function tickBossTier(g: Game, b: { x: number; y: number; awake: boolean; dead: boolean; tierT: number; def: { id: string } }, dt: number): void {
  if (g.tier === 'normal' || !b.awake || b.dead) return;
  b.tierT -= dt;
  if (b.tierT > 0) return;
  const final = b.def.id === g.map.finalBoss;
  if (g.tier === 'nightmare') {
    const T = BOSS_TIER.nightmare;
    b.tierT = range(g, final ? T.finalEvery : T.every);
    if (!hazardRoom(g)) return;
    g.spawnHazard('ring', 'wail_ring', b.x, b.y, { r: 40, r2: 10, grow: 320, tele: 0.5, active: 700 / 320, dmg: 5 * g.diff.dmgMult, slow: N.wail.slow, owner: -1 });
    for (const p of g.players) {
      if (p.dead || p.downed) continue;
      for (let k = 0; k < (final ? T.finalBursts : T.bursts); k++) {
        const a = g.rng.angle(), d = k === 0 ? 0 : g.rng.range(80, 160);
        g.spawnHazard('circle', 'haunt_burst', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { r: N.haunt.r + 12, tele: 1.2, active: 0.15, dmg: N.haunt.dmg * 1.5 * g.diff.dmgMult, owner: -1 });
      }
    }
    g.bus.emit('sfx', { id: 'toll', x: b.x, y: b.y, vol: 0.6 });
  } else {
    const T = BOSS_TIER.hell;
    b.tierT = range(g, final ? T.finalEvery : T.every);
    if (!hazardRoom(g)) return;
    for (const p of g.players) {
      if (p.dead || p.downed) continue;
      for (let k = 0; k < (final ? T.finalBalls : T.balls); k++) {
        const a = g.rng.angle(), d = k === 0 ? 0 : g.rng.range(90, 200);
        g.spawnHazard('circle', 'fireball', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { r: N.ember.r + 8, tele: 1.1 + k * 0.15, active: 0.15, dmg: N.ember.dmg * 1.4 * g.diff.dmgMult, owner: -1 });
      }
    }
    if (final) g.spawnHazard('ring', 'quake_ring', b.x, b.y, { r: 50, r2: 8, grow: 280, tele: 0.7, active: 900 / 280, dmg: N.quake.dmg * 1.3 * g.diff.dmgMult, owner: -1 });
    g.bus.emit('sfx', { id: 'whoosh', x: b.x, y: b.y, vol: 0.6 });
  }
}
