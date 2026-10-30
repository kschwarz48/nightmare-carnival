// Player combat stats (doc 01 §7, Godot PlayerStats). Accumulators are modified by passives,
// character mods and meta perks; computed getters are what gameplay reads.

import type { StatAxis } from '../data/weapons';

export class PlayerStats {
  baseHp = 100;
  baseSpeed = 220;
  basePickup = 60;

  might = 1;
  cooldown = 1; // < 1 = faster
  area = 1;
  duration = 1;
  projSpeed = 1;
  amount = 0;
  critChance = 0.05;
  critDamage = 2;
  armor = 0;
  luck = 1;
  greed = 1;
  xp = 1;
  regen = 0;
  revives = 0;
  maxHpMult = 1;
  moveSpeedMult = 1;
  pickupMult = 1;
  knockbackShove = 0;

  maxHp(): number {
    return this.baseHp * this.maxHpMult;
  }
  moveSpeed(): number {
    return this.baseSpeed * this.moveSpeedMult;
  }
  pickupRadius(): number {
    return this.basePickup * this.pickupMult;
  }

  apply(axis: StatAxis, v: number): void {
    switch (axis) {
      case 'might': this.might += v; break;
      case 'cooldown': this.cooldown = Math.max(0.3, this.cooldown - v); break;
      case 'area': this.area += v; break;
      case 'duration': this.duration += v; break;
      case 'projSpeed': this.projSpeed += v; break;
      case 'amount': this.amount += Math.round(v); break;
      case 'critChance': this.critChance += v; break;
      case 'critDamage': this.critDamage += v; break;
      case 'armor': this.armor += v; break;
      case 'luck': this.luck += v; break;
      case 'greed': this.greed += v; break;
      case 'xp': this.xp += v; break;
      case 'regen': this.regen += v; break;
      case 'maxHp': this.maxHpMult += v; break;
      case 'moveSpeed': this.moveSpeedMult += v; break;
      case 'pickup': this.pickupMult += v; break;
      case 'revive': this.revives += Math.round(v); break;
    }
  }

  /** Effective crit chance with a luck re-roll (doc 01 §7: luck affects crit re-rolls). */
  critRoll(rand: number, bonus = 0): boolean {
    const c = Math.min(0.95, (this.critChance + bonus) * (0.6 + 0.4 * this.luck));
    return rand < c;
  }
}
