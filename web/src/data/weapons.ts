// Weapons, evolutions and passives (doc 06). Godot-implemented weapons keep their .tres numbers;
// the rest follow doc 06 base values + the generic per-level template (06 §2).

export type WeaponKind =
  | 'cards' | 'mallet' | 'tarot' | 'bumper' | 'plush' | 'tophat' | 'popcorn' | 'darts' | 'fireworks'
  | 'cotton' | 'rings' | 'cannon' | 'snowcone' | 'grill' | 'laser' | 'orbs' | 'bell' | 'mirror' | 'calliope'
  // the world tiers' (D-97)
  | 'lantern' | 'chains' | 'breath'
  // the Night Express's (D-98)
  | 'whistle';

export type Archetype = 'crit' | 'aoe' | 'dot' | 'orbit' | 'summon' | 'mobility';

export interface WeaponDef {
  id: string;
  name: string;
  kind: WeaponKind;
  desc: string;
  /** Short per-level gain lines shown on draft cards (index = level reached, 2..8). */
  levelText: string[];
  damage: number;
  cooldown: number;
  area: number;
  amount: number;
  speed: number;
  pierce: number;
  duration: number;
  knockback: number;
  critBonus?: number;
  /** Per-level deltas, index 0 = Lv1 (always 0). */
  lv: { dmg: number[]; cd: number[]; area: number[]; amount: number[]; pierce?: number[]; dur?: number[]; spd?: number[] };
  maxLevel: number;
  evolvesTo?: string;
  evoPassive?: string;
  isEvolution?: boolean;
  evolvedFrom?: string;
  signature?: string;
  unlock?: string; // Lost & Found unlock id (draft-gated)
  archetypes: Archetype[];
  /** Directional weapons respect manual/hybrid aim (D-20). */
  aimable: boolean;
  isSummon?: boolean;
  weight: number;
  lore: string;
}

const Z8 = [0, 0, 0, 0, 0, 0, 0, 0];
const W = (d: WeaponDef) => d;

/**
 * Evolutions level again (D-61): Evo Lv 1 → 8. `plan` spells out Lv 2-8, one letter per level, mostly
 * damage with the weapon's own strengths in between: d +10% damage, D +16% damage, a +12% area,
 * s +12% speed, c -8% cooldown, n +1 of `noun`, p +1 pierce, u +15% duration, m +2% clone power.
 */
function evoLevels(d: { damage: number; cooldown: number; area: number; speed: number; duration: number }, plan: string, noun: string): { lv: WeaponDef['lv']; levelText: string[] } {
  const lv = { dmg: [...Z8], cd: [...Z8], area: [...Z8], amount: [...Z8], pierce: [...Z8], dur: [...Z8], spd: [...Z8] };
  const levelText = ['', ''];
  const dmgStep = (f: number) => (d.damage >= 5 ? Math.max(1, Math.round(d.damage * f)) : Math.round(d.damage * f * 1000) / 1000);
  [...plan].forEach((c, j) => {
    const i = j + 1;
    switch (c) {
      case 'd':
      case 'D': {
        const n = dmgStep(c === 'D' ? 0.16 : 0.1);
        lv.dmg[i] = n;
        levelText.push(`+${n} damage`);
        break;
      }
      case 'a':
        lv.area[i] = Math.round(d.area * 0.12 * 100) / 100;
        levelText.push('+12% area');
        break;
      case 's':
        lv.spd[i] = d.speed >= 10 ? Math.round(d.speed * 0.12) : Math.round(d.speed * 0.12 * 100) / 100;
        levelText.push('+12% speed');
        break;
      case 'c':
        lv.cd[i] = -Math.round(d.cooldown * 0.08 * 1000) / 1000;
        levelText.push('−8% cooldown');
        break;
      case 'n':
        lv.amount[i] = 1;
        levelText.push(`+1 ${noun}`);
        break;
      case 'p':
        lv.pierce[i] = 1;
        levelText.push('+1 pierce');
        break;
      case 'u':
        lv.dur[i] = Math.round(d.duration * 0.15 * 100) / 100;
        levelText.push('+15% duration');
        break;
      case 'm':
        lv.dmg[i] = 0.02;
        levelText.push('+2% clone power');
        break;
    }
  });
  return { lv, levelText };
}

const EVO = (d: Omit<WeaponDef, 'lv' | 'maxLevel' | 'levelText' | 'weight' | 'isEvolution'>, plan: string, noun = 'shot'): WeaponDef => ({
  ...d, ...evoLevels(d, plan, noun), maxLevel: 8, weight: 1, isEvolution: true,
});

export const WEAPONS: Record<string, WeaponDef> = {
  // ---------------- Signature weapons ----------------
  throwing_cards: W({
    id: 'throwing_cards', name: 'Throwing Cards', kind: 'cards', signature: 'carny',
    desc: 'A fan of razor playing cards flung at the nearest threat.',
    levelText: ['', '', '+1 card', '+4 damage', '−12% cooldown', '+1 card', '+6 damage', '−12% cooldown', '+1 card, +10 damage'],
    damage: 10, cooldown: 1.1, area: 1, amount: 1, speed: 520, pierce: 1, duration: 1.4, knockback: 1, critBonus: 0.03,
    lv: { dmg: [0, 0, 4, 0, 0, 6, 0, 10], cd: [0, 0, 0, -0.12, 0, 0, -0.12, 0], area: Z8, amount: [0, 1, 0, 0, 1, 0, 0, 1] },
    maxLevel: 8, evolvesTo: 'royal_flush', evoPassive: 'lucky_ticket', archetypes: ['crit'], aimable: true, weight: 1.2,
    lore: 'The Carny never loses a hand. These never miss a throat.',
  }),
  mallet: W({
    id: 'mallet', name: 'Whack-a-Mole Mallet', kind: 'mallet', signature: 'strongman',
    desc: 'The mallet comes down on the nearest creatures one after another: every whack crushes what is under it and leaves it dazed.',
    levelText: ['', '', '+1 whack', '+6 damage', '−0.15s cooldown, +15% area', '+1 whack', '+8 damage', '−0.15s cooldown, +15% area', '+1 whack, +10 damage'],
    damage: 18, cooldown: 1.4, area: 1, amount: 1, speed: 0, pierce: 0, duration: 0, knockback: 1.2,
    lv: { dmg: [0, 0, 6, 0, 0, 8, 0, 10], cd: [0, 0, 0, -0.15, 0, 0, -0.15, 0], area: [0, 0, 0, 0.15, 0, 0, 0.15, 0], amount: [0, 1, 0, 0, 1, 0, 0, 1] },
    maxLevel: 8, evolvesTo: 'whack_frenzy', evoPassive: 'energy_drink', archetypes: ['aoe'], aimable: false, weight: 1,
    lore: 'Retired from the whack-a-mole stall after the moles started whacking back.',
  }),
  tarot: W({
    id: 'tarot', name: 'Tarot Toss', kind: 'tarot', signature: 'fortune_teller',
    desc: 'Homing tarot cards that seek out random foes. Crits often.',
    levelText: ['', '', '+1 card', '+4 damage', '−10% cooldown', '+1 card, +1 pierce', '+5 damage', '−10% cooldown', '+1 card, +8 damage'],
    damage: 12, cooldown: 1.2, area: 1, amount: 1, speed: 380, pierce: 0, duration: 2.6, knockback: 0.6, critBonus: 0.08,
    lv: { dmg: [0, 0, 4, 0, 0, 5, 0, 8], cd: [0, 0, 0, -0.1, 0, 0, -0.1, 0], area: Z8, amount: [0, 1, 0, 0, 1, 0, 0, 1], pierce: [0, 0, 0, 0, 1, 0, 0, 0] },
    maxLevel: 8, evolvesTo: 'death_card', evoPassive: 'spectacles', archetypes: ['crit'], aimable: false, weight: 1,
    lore: 'The cards already know who dies tonight.',
  }),
  // D-78: the Commodore's coaster car (it was the Ride Operator's bumper car; the id stays for older saves).
  // Sold after the Boardwalk is survived; the Commodore always starts with it.
  bumper: W({
    id: 'bumper', name: 'The Undertow', kind: 'bumper', signature: 'ride_operator', unlock: 'w_undertow',
    desc: "Periodically launch forward in the Undertow's lead car on a rail of light, ramming foes (brief invulnerability); every launch rattles everything around you.",
    levelText: ['', '', '+15% area', '+6 damage', '−0.25s cooldown', '+1 coupled car, +15% area', '+8 damage', '−0.25s cooldown', '+1 coupled car, +10 damage'],
    damage: 22, cooldown: 2.2, area: 1, amount: 1, speed: 560, pierce: 99, duration: 0.32, knockback: 3,
    lv: { dmg: [0, 0, 6, 0, 0, 8, 0, 10], cd: [0, 0, 0, -0.25, 0, 0, -0.25, 0], area: [0, 0.15, 0, 0, 0.15, 0, 0, 0], amount: [0, 0, 0, 0, 1, 0, 0, 1] },
    maxLevel: 8, evolvesTo: 'demolition_derby', evoPassive: 'running_shoes', archetypes: ['mobility'], aimable: false, weight: 0.9,
    lore: 'The Undertow ran its last lap the night the Gala Queen went down. Its lead car still knows the way.',
  }),
  plush: W({
    id: 'plush', name: 'Plush Companion', kind: 'plush', signature: 'lost_child', isSummon: true,
    desc: 'Plush pets orbit you and pounce on the nearest threat.',
    levelText: ['', '', '+1 pet', '+5 damage', '+1 pet', '+6 damage', '+1 pet', '+8 damage', 'Faster pounces'],
    damage: 13, cooldown: 0.8, area: 1, amount: 1, speed: 420, pierce: 0, duration: 0, knockback: 1,
    lv: { dmg: [0, 0, 5, 0, 6, 0, 8, 0], cd: [0, -0.1, 0, -0.1, 0, -0.1, 0, -0.1], area: Z8, amount: [0, 1, 0, 1, 0, 1, 0, 0] },
    maxLevel: 8, evolvesTo: 'nightmare_menagerie', evoPassive: 'sugar_rush', archetypes: ['summon'], aimable: false, weight: 1,
    lore: 'Won at the ring toss. It still remembers being loved.',
  }),
  tophat: W({
    id: 'tophat', name: 'Top Hat', kind: 'tophat', signature: 'ringleader', isSummon: true,
    desc: 'Pulls helpers from the hat — rabbits that kick and doves that dive.',
    levelText: ['', '', '+1 helper', '+4 damage', '+1s duration, −0.4s cooldown', '+1 helper', '+5 damage', '+1s duration, −0.4s cooldown', '+1 helper, +8 damage'],
    damage: 12, cooldown: 4.0, area: 1, amount: 1, speed: 300, pierce: 0, duration: 7, knockback: 1,
    lv: { dmg: [0, 0, 4, 0, 0, 5, 0, 8], cd: [0, 0, 0, -0.4, 0, 0, -0.4, 0], area: Z8, amount: [0, 1, 0, 0, 1, 0, 0, 1], dur: [0, 0, 0, 1, 0, 0, 1, 0] },
    maxLevel: 8, evolvesTo: 'grand_menagerie', evoPassive: 'strongman_belt', archetypes: ['summon'], aimable: false, weight: 0.9,
    lore: 'There is always something else in the hat. Something hungry.',
  }),
  // ---------------- Draftable arsenal ----------------
  popcorn: W({
    id: 'popcorn', name: 'Popcorn Popper', kind: 'popcorn',
    desc: 'Lobs kernels that land and POP into small bursts.',
    levelText: ['', '', '+1 kernel', '+3 damage', '+15% area', '+1 kernel', '+4 damage', '+15% area, −0.15s cooldown', '+1 kernel'],
    damage: 12, cooldown: 1.4, area: 1, amount: 2, speed: 0, pierce: 0, duration: 0.6, knockback: 0.8,
    lv: { dmg: [0, 0, 3, 0, 0, 4, 0, 0], cd: [0, 0, 0, 0, 0, 0, -0.15, 0], area: [0, 0, 0, 0.15, 0, 0, 0.15, 0], amount: [0, 1, 0, 0, 1, 0, 0, 1] },
    maxLevel: 8, evolvesTo: 'kettle_korn', evoPassive: 'foam_finger', archetypes: ['aoe'], aimable: false, weight: 1,
    lore: 'Butter-flavoured shrapnel.',
  }),
  darts: W({
    id: 'darts', name: 'Balloon Darts', kind: 'darts',
    desc: 'Fast piercing darts that burst into shrapnel at the end of their flight.',
    levelText: ['', '', '+1 dart', '+1 pierce', '+3 damage', '+1 dart', '+1 pierce', '+4 damage', '+1 dart, −0.1s cooldown'],
    damage: 13, cooldown: 1.0, area: 1, amount: 1, speed: 720, pierce: 2, duration: 0.75, knockback: 0.5,
    lv: { dmg: [0, 0, 0, 3, 0, 0, 4, 0], cd: [0, 0, 0, 0, 0, 0, 0, -0.1], area: Z8, amount: [0, 1, 0, 0, 1, 0, 0, 1], pierce: [0, 0, 1, 0, 0, 1, 0, 0] },
    maxLevel: 8, evolvesTo: 'sharpshooter', evoPassive: 'spectacles', archetypes: ['crit'], aimable: true, weight: 1,
    lore: 'Three throws for a ticket. Infinite throws for you.',
  }),
  fireworks: W({
    id: 'fireworks', name: 'Fireworks', kind: 'fireworks',
    desc: 'Rockets lobbed one-by-one that explode in scattered, dazzling bursts.',
    levelText: ['', '', '+1 rocket', '+5 damage', '−0.25s cooldown, +15% area', '+1 rocket', '+6 damage, +15% area', '+1 rocket, −0.25s cooldown', '+1 rocket, +9 damage, +20% area'],
    damage: 16, cooldown: 2.6, area: 1, amount: 1, speed: 280, pierce: 0, duration: 0.6, knockback: 1,
    lv: { dmg: [0, 0, 5, 0, 0, 6, 0, 9], cd: [0, 0, 0, -0.25, 0, 0, -0.25, 0], area: [0, 0, 0, 0.15, 0, 0.15, 0, 0.2], amount: [0, 1, 0, 0, 1, 0, 1, 1] },
    maxLevel: 8, evolvesTo: 'grand_finale', evoPassive: 'extra_token', archetypes: ['aoe'], aimable: false, weight: 1.1,
    lore: 'The show ends with a bang. Every night. Forever.',
  }),
  cotton: W({
    id: 'cotton', name: 'Cotton-Candy Gun', kind: 'cotton',
    desc: 'A sticky cone of spun sugar that slows and dissolves enemies over time.',
    levelText: ['', '', '+15% area', '+2 damage/tick', '−0.1s cooldown', '+15% area, +0.5s stick', '+2 damage/tick', '−0.1s cooldown', '+1 rear cone, +3 damage/tick'],
    damage: 4, cooldown: 0.9, area: 1, amount: 1, speed: 0, pierce: 0, duration: 2, knockback: 0,
    lv: { dmg: [0, 0, 2, 0, 0, 2, 0, 3], cd: [0, 0, 0, -0.1, 0, 0, -0.1, 0], area: [0, 0.15, 0, 0, 0.15, 0, 0, 0], amount: [0, 0, 0, 0, 0, 0, 0, 1], dur: [0, 0, 0, 0, 0.5, 0, 0, 0] },
    maxLevel: 8, evolvesTo: 'sticky_situation', evoPassive: 'spinning_top', archetypes: ['dot'], aimable: true, weight: 1,
    lore: 'Pink, sweet, and absolutely inescapable.',
  }),
  rings: W({
    id: 'rings', name: 'Ring Toss', kind: 'rings',
    desc: 'Boomerang rings that fly out, curve back, and pierce everything.',
    levelText: ['', '', '+1 ring', '+3 damage', '−0.15s cooldown, +10% area', '+1 ring', '+4 damage, +10% area', '+1 ring, −0.15s cooldown', '+1 ring, +6 damage, +15% area'],
    damage: 11, cooldown: 1.65, area: 1, amount: 1, speed: 480, pierce: 999, duration: 1.8, knockback: 0.8,
    lv: { dmg: [0, 0, 3, 0, 0, 4, 0, 6], cd: [0, 0, 0, -0.15, 0, 0, -0.15, 0], area: [0, 0, 0, 0.1, 0, 0.1, 0, 0.15], amount: [0, 1, 0, 0, 1, 0, 1, 1] },
    maxLevel: 8, evolvesTo: 'saturn_rings', evoPassive: 'strongman_belt', archetypes: ['orbit'], aimable: true, weight: 1,
    lore: 'Land one on a bottle, win a prize. Land one on a clown, win the night.',
  }),
  cannon: W({
    id: 'cannon', name: 'Carnival Cannon', kind: 'cannon', unlock: 'w_cannon',
    desc: 'Fires a human cannonball in a piercing line with huge knockback.',
    levelText: ['', '', '+20% area', '+10 damage', '−0.3s cooldown', '+20% area', '+12 damage', '−0.3s cooldown', '+1 cannonball, +16 damage'],
    damage: 34, cooldown: 2.6, area: 1, amount: 1, speed: 640, pierce: 999, duration: 1.2, knockback: 3.5, critBonus: 0.1,
    lv: { dmg: [0, 0, 10, 0, 0, 12, 0, 16], cd: [0, 0, 0, -0.3, 0, 0, -0.3, 0], area: [0, 0.2, 0, 0, 0.2, 0, 0, 0], amount: [0, 0, 0, 0, 0, 0, 0, 1] },
    maxLevel: 8, evolvesTo: 'cannonball_special', evoPassive: 'energy_drink', archetypes: ['crit', 'mobility'], aimable: true, weight: 0.9,
    lore: 'The Great Zambini was never seen again. His helmet still flies nightly.',
  }),
  snowcone: W({
    id: 'snowcone', name: 'Snow-Cone Machine', kind: 'snowcone',
    desc: 'Lobs snow cones into the crowd: each splats into slush that chills whatever wades through it, and five chills freeze it solid.',
    levelText: ['', '', '+15% area', '+2 damage', '−0.15s cooldown', '+1 snow cone', '+3 damage', '+0.6s slush', '+1 snow cone, +4 damage'],
    damage: 8, cooldown: 1.3, area: 1, amount: 1, speed: 0, pierce: 0, duration: 2.4, knockback: 0.3,
    lv: { dmg: [0, 0, 2, 0, 0, 3, 0, 4], cd: [0, 0, 0, -0.15, 0, 0, 0, 0], area: [0, 0.15, 0, 0, 0, 0, 0, 0], amount: [0, 0, 0, 0, 1, 0, 0, 1], dur: [0, 0, 0, 0, 0, 0, 0.6, 0] },
    maxLevel: 8, evolvesTo: 'blizzard', evoPassive: 'caffeine', archetypes: ['dot'], aimable: true, weight: 1,
    lore: 'Blue raspberry. The colour of lips after midnight.',
  }),
  grill: W({
    id: 'grill', name: 'Hot-Dog Grill', kind: 'grill',
    desc: 'Your grill cart drips burning grease as you go: a trail of fire for whatever follows you. Standing still, it drips where you stand.',
    levelText: ['', '', '+15% area', '+2 damage', '+0.5s burning trail', '+3 damage', '+15% area', '+3 damage', '+4 damage, +0.5s burning trail'],
    damage: 6, cooldown: 0.8, area: 1, amount: 1, speed: 0, pierce: 0, duration: 3, knockback: 0,
    lv: { dmg: [0, 0, 2, 0, 3, 0, 3, 4], cd: Z8, area: [0, 0.15, 0, 0, 0, 0.15, 0, 0], amount: Z8, dur: [0, 0, 0, 0.5, 0, 0, 0, 0.5] },
    maxLevel: 8, evolvesTo: 'inferno_grill', evoPassive: 'strongman_belt', archetypes: ['dot', 'aoe'], aimable: true, weight: 1,
    lore: 'Foot-longs, charred. Also anything else that gets too close.',
  }),
  laser: W({
    id: 'laser', name: 'Laser Light Show', kind: 'laser', unlock: 'w_laser',
    desc: 'Rotating neon beams sweep around you.',
    levelText: ['', '', '+1 beam', '+3 damage', '+15% length, +0.5s duration', '+1 beam', '+5 damage', '+15% length, +0.5s duration', '+1 beam, +5 damage'],
    damage: 11, cooldown: 2.5, area: 1, amount: 1, speed: 1.7, pierce: 0, duration: 3, knockback: 0.2,
    lv: { dmg: [0, 0, 3, 0, 0, 5, 0, 5], cd: Z8, area: [0, 0, 0, 0.15, 0, 0, 0.15, 0], amount: [0, 1, 0, 0, 1, 0, 0, 1], dur: [0, 0, 0, 0.5, 0, 0, 0.5, 0] },
    maxLevel: 8, evolvesTo: 'grand_illumination', evoPassive: 'spinning_top', archetypes: ['orbit', 'dot'], aimable: false, weight: 0.9,
    lore: 'The disco tent never closed. Its lights learned to cut.',
  }),
  // the world tiers' weapons (D-97): sold at the Lost & Found once the Fun House is won on their tier
  lantern: W({
    id: 'lantern', name: "Watchman's Lantern", kind: 'lantern', unlock: 'w_lantern', signature: 'watchman',
    desc: 'A beam of lantern light sweeps back and forth before you, burning whatever it touches for as long as it stays in it.',
    levelText: ['', '', '+2 damage', '+12% length', '+2 damage', '+12% length, +1 beam', '+3 damage', '+12% length', '+3 damage'],
    damage: 7, cooldown: 0, area: 1, amount: 1, speed: 2.1, pierce: 0, duration: 999, knockback: 0.15,
    lv: { dmg: [0, 2, 0, 2, 0, 3, 0, 3], cd: Z8, area: [0, 0, 0.12, 0, 0.12, 0, 0.12, 0], amount: [0, 0, 0, 0, 1, 0, 0, 0] },
    maxLevel: 8, evolvesTo: 'last_light', evoPassive: 'deaths_door', archetypes: ['dot'], aimable: true, weight: 0.9,
    lore: "The last night guard's lantern. Whatever it shows can't hide, and what can't hide can be hurt.",
  }),
  chains: W({
    id: 'chains', name: 'Spirit Chains', kind: 'chains', unlock: 'w_chains',
    desc: 'Spectral chains leap from creature to creature, each link a little weaker, and bind the last one fast.',
    levelText: ['', '', '+3 damage', '+1 link, −0.15s cooldown', '+4 damage', '−0.15s cooldown', '+4 damage, +1 link', '−0.15s cooldown', '+5 damage, +1 link'],
    damage: 22, cooldown: 0.9, area: 1, amount: 1, speed: 1, pierce: 0, duration: 1.5, knockback: 0.4,
    lv: { dmg: [0, 3, 0, 4, 0, 4, 0, 5], cd: [0, 0, -0.15, 0, -0.15, 0, -0.15, 0], area: Z8, amount: [0, 0, 1, 0, 0, 1, 0, 1] },
    maxLevel: 8, evolvesTo: 'reapers_chain', evoPassive: 'soul_jar', archetypes: ['crit'], aimable: false, weight: 0.9,
    lore: 'Forged for something that kept walking out of its grave. It still remembers the way.',
  }),
  breath: W({
    id: 'breath', name: 'Fire Breath', kind: 'breath', unlock: 'w_breath', signature: 'fire_eater',
    desc: 'A roaring cone of flame where you face, setting everything in it alight.',
    levelText: ['', '', '+1 damage, +10% reach', '−0.2s cooldown, +0.2s duration', '+2 damage, +10% reach', '−0.2s cooldown, +0.2s duration', '+2 damage, +10% reach', '−0.2s cooldown, +0.3s duration', '+3 damage, +10% reach'],
    damage: 5, cooldown: 2.4, area: 1, amount: 1, speed: 1, pierce: 0, duration: 1.2, knockback: 0.1,
    lv: { dmg: [0, 1, 0, 2, 0, 2, 0, 3], cd: [0, 0, -0.2, 0, -0.2, 0, -0.2, 0], area: [0, 0.1, 0, 0.1, 0, 0.1, 0, 0.1], amount: Z8, dur: [0, 0, 0.2, 0, 0.2, 0, 0.3, 0] },
    maxLevel: 8, evolvesTo: 'hellmouth', evoPassive: 'brimstone', archetypes: ['aoe', 'dot'], aimable: true, weight: 0.9,
    lore: 'The Fire-Eater swallowed a coal from the Infernal Carnival on a dare. It never went out.',
  }),
  orbs: W({
    id: 'orbs', name: 'Crystal Orbs', kind: 'orbs', unlock: 'w_orbs',
    desc: 'Fortune-teller orbs orbit you, swelling outward with every turn: they grind harder the longer they stay on a creature, and shove the crowd back out.',
    levelText: ['', '', '+1 orb, −0.2s cooldown', '+1 orb, +6 damage', '−0.2s cooldown, +15% area', '+1 orb, +7 damage', '+1 orb, −0.2s cooldown', '+9 damage, +15% area', '+1 orb, −0.2s cooldown'],
    damage: 14, cooldown: 3, area: 1, amount: 1, speed: 2.6, pierce: 0, duration: 3, knockback: 1,
    lv: { dmg: [0, 0, 6, 0, 7, 0, 9, 0], cd: [0, -0.2, 0, -0.2, 0, -0.2, 0, -0.2], area: [0, 0, 0, 0.15, 0, 0, 0.15, 0], amount: [0, 1, 1, 0, 1, 1, 0, 1], dur: [0, 0, 0, 0.5, 0, 0.5, 0, 0.5] },
    maxLevel: 8, evolvesTo: 'cosmic_convergence', evoPassive: 'foam_finger', archetypes: ['orbit'], aimable: false, weight: 1,
    lore: 'Ask the Magic 8-Ball if you will survive. Reply hazy. Try again.',
  }),
  bell: W({
    id: 'bell', name: 'Strongman Bell', kind: 'bell', unlock: 'w_bell',
    desc: 'An overhead slam splits the ground: a fissure races out toward the nearest creature, bursting up under all it crosses.',
    levelText: ['', '', '+15% reach', '+5 damage', '−0.15s cooldown', '+15% reach', '+1 fissure, +6 damage', '+15% reach', '+1 fissure, −0.15s cooldown, +8 damage'],
    damage: 20, cooldown: 1.6, area: 1, amount: 1, speed: 0, pierce: 0, duration: 0.5, knockback: 1.4,
    lv: { dmg: [0, 0, 5, 0, 0, 6, 0, 8], cd: [0, 0, 0, -0.15, 0, 0, 0, -0.15], area: [0, 0.15, 0, 0, 0.15, 0, 0.15, 0], amount: [0, 0, 0, 0, 0, 1, 0, 1] },
    maxLevel: 8, evolvesTo: 'high_striker', evoPassive: 'lucky_ticket', archetypes: ['aoe'], aimable: false, weight: 0.9,
    lore: 'Ring the bell, win a cigar. Ring it hard enough and the ground answers.',
  }),
  mirror: W({
    id: 'mirror', name: 'Funhouse Mirror', kind: 'mirror', signature: 'mira', unlock: 'w_mirror', isSummon: true,
    desc: 'Conjures a mirror clone that re-fires your attacks from its own position, at 12% of your damage (up to 30%, shared between clones).',
    levelText: ['', '', '+3% clone power', '+1s duration', '+3% clone power', '+1 clone (sharing the power)', '+1s duration', '+4% clone power', '+8% clone power'],
    // D-61: `damage` is the clones' total share of your damage, split between however many there are
    damage: 0.12, cooldown: 3.0, area: 1, amount: 1, speed: 0, pierce: 0, duration: 4, knockback: 0,
    lv: { dmg: [0, 0.03, 0, 0.03, 0, 0, 0.04, 0.08], cd: Z8, area: Z8, amount: [0, 0, 0, 0, 1, 0, 0, 0], dur: [0, 0, 1, 0, 0, 1, 0, 0] },
    // D-78: Mira's own Hand Mirror evolves it (it was the Season Pass)
    maxLevel: 8, evolvesTo: 'hall_of_mirrors', evoPassive: 'hand_mirror', archetypes: ['summon'], aimable: false, weight: 0.8,
    lore: 'In the funhouse there are two of you. Only one of you is scared.',
  }),

  // D-98: the Night Express's, for seeing the Ghost Train's dawn (its partner is the Last Train Home's watch)
  steam_whistle: W({
    id: 'steam_whistle', name: 'Night Express Whistle', kind: 'whistle', unlock: 'w_whistle',
    desc: 'A shriek of steam: a ring of scalding vapour rolls out from you, shoving the crowd back and scalding all it passes.',
    levelText: ['', '', '+4 damage', '+12% reach, −0.2s cooldown', '+5 damage', '+12% reach, +1 ring', '+5 damage, −0.2s cooldown', '+12% reach, −0.2s cooldown', '+6 damage'],
    damage: 14, cooldown: 2.8, area: 1, amount: 1, speed: 1, pierce: 0, duration: 0.5, knockback: 1.5,
    lv: { dmg: [0, 4, 0, 5, 0, 5, 0, 6], cd: [0, 0, -0.2, 0, 0, -0.2, -0.2, 0], area: [0, 0, 0.12, 0, 0.12, 0, 0.12, 0], amount: [0, 0, 0, 0, 1, 0, 0, 0] },
    maxLevel: 8, evolvesTo: 'last_call', evoPassive: 'conductor_watch', archetypes: ['aoe'], aimable: false, weight: 0.9,
    lore: 'Pulled from the Night Express as it went into the dark. It still screams for the last train.',
  }),
  steam_calliope: W({
    id: 'steam_calliope', name: 'Steam Calliope', kind: 'calliope', unlock: 'w_calliope',
    desc: 'A tiny haunted organ plays spiralling notes that drift outward through the crowd.',
    levelText: ['', '', '+2 notes', '+5 damage', '−0.25s cooldown', '+2 notes, +1 pierce', '+6 damage', '−0.25s cooldown', '+2 notes, +8 damage'],
    damage: 19, cooldown: 1.8, area: 1, amount: 6, speed: 230, pierce: 1, duration: 1.8, knockback: 0.4,
    lv: { dmg: [0, 0, 5, 0, 0, 6, 0, 8], cd: [0, 0, 0, -0.25, 0, 0, -0.25, 0], area: Z8, amount: [0, 2, 0, 0, 2, 0, 0, 2], pierce: [0, 0, 0, 0, 1, 0, 0, 0] },
    maxLevel: 8, evolvesTo: 'grand_requiem', evoPassive: 'last_song_score', archetypes: ['aoe', 'dot'], aimable: false, weight: 0.9,
    lore: 'Pulled from the Big Top ruins at dawn. It still knows the last song.',
  }),

  // ---------------- Evolutions (06 §5 + D-07) ----------------
  royal_flush: EVO({
    id: 'royal_flush', name: 'Royal Flush', kind: 'cards', evolvedFrom: 'throwing_cards',
    desc: 'A 52-card storm: golden cards spiral the whole screen, piercing everything, critting hard.',
    damage: 17, cooldown: 0.65, area: 1.2, amount: 6, speed: 560, pierce: 999, duration: 1.7, knockback: 1, critBonus: 0.18,
    archetypes: ['crit'], aimable: true, lore: 'Ace, king, queen, jack, ten — and your name on the river card.',
  }, 'dsdcdnD', 'card'),
  whack_frenzy: EVO({
    id: 'whack_frenzy', name: 'Whack Frenzy', kind: 'mallet', evolvedFrom: 'mallet',
    desc: 'A frenzy of whacks on everything near you, and every fourth round a ground-pound that dazes the whole crowd around you.',
    damage: 46, cooldown: 0.45, area: 1.4, amount: 2, speed: 0, pierce: 0, duration: 0, knockback: 1.6,
    archetypes: ['aoe'], aimable: false, lore: 'Whack. Whack. Whack. Whack. Whack.',
  }, 'dndcdaD', 'whack'),
  death_card: EVO({
    id: 'death_card', name: 'The Death Card', kind: 'tarot', evolvedFrom: 'tarot',
    desc: 'Slow homing reaper cards that crit for massive damage and burst on impact.',
    damage: 70, cooldown: 1.6, area: 1.3, amount: 2, speed: 260, pierce: 0, duration: 4.5, knockback: 1.5, critBonus: 0.45,
    archetypes: ['crit'], aimable: false, lore: 'Not an ending. A transformation. Yours.',
  }, 'dsdcdnd', 'reaper card'),
  demolition_derby: EVO({
    id: 'demolition_derby', name: 'The Last Lap', kind: 'bumper', evolvedFrom: 'bumper',
    desc: 'A permanent ramming aura while you move, and runaway coaster cars that tear through the crowd.',
    damage: 66, cooldown: 1.6, area: 1.4, amount: 3, speed: 520, pierce: 999, duration: 0.3, knockback: 2.5,
    archetypes: ['mobility'], aimable: false, lore: 'The ride never ends. Keep your hands inside the car.',
  }, 'dadsdnD', 'runaway car'),
  nightmare_menagerie: EVO({
    id: 'nightmare_menagerie', name: 'Nightmare Menagerie', kind: 'plush', evolvedFrom: 'plush', isSummon: true,
    desc: 'A ravenous pack of plush pets roams the screen; every bite mauls whatever crowds its prey.',
    damage: 33, cooldown: 0.4, area: 1, amount: 6, speed: 520, pierce: 0, duration: 0, knockback: 1,
    archetypes: ['summon'], aimable: false, lore: 'Every prize nobody claimed came looking for an owner.',
  }, 'dsdndsD', 'plush pet'),
  grand_menagerie: EVO({
    id: 'grand_menagerie', name: 'Grand Menagerie', kind: 'tophat', evolvedFrom: 'tophat', isSummon: true,
    desc: 'A permanent three-ring troupe: a pouncing lion, a stomping elephant and tumbling acrobats.',
    damage: 72, cooldown: 3.0, area: 1.2, amount: 4, speed: 340, pierce: 0, duration: 999, knockback: 1.5,
    archetypes: ['summon'], aimable: false, lore: 'Ladies and gentlemen — the greatest show in the dark!',
  }, 'dadcdaD', 'act'),
  kettle_korn: EVO({
    id: 'kettle_korn', name: 'Kettle-Korn Cannon', kind: 'popcorn', evolvedFrom: 'popcorn',
    desc: 'A constantly-popping field of kettle corn blankets the ground around you.',
    damage: 28, cooldown: 0.16, area: 1.5, amount: 1, speed: 0, pierce: 0, duration: 0.5, knockback: 0.8,
    archetypes: ['aoe'], aimable: false, lore: 'Sweet and salty. Mostly salty.',
  }, 'dadadcD', 'kernel'),
  sharpshooter: EVO({
    id: 'sharpshooter', name: "Sharpshooter's Bouquet", kind: 'darts', evolvedFrom: 'darts',
    desc: 'Crit-heavy dart volleys that blossom into shrapnel flowers on every hit.',
    damage: 15, cooldown: 0.7, area: 1.2, amount: 4, speed: 820, pierce: 4, duration: 0.8, knockback: 0.6, critBonus: 0.2,
    archetypes: ['crit'], aimable: true, lore: 'A bouquet for the deceased. Delivered at speed.',
  }, 'dsdpdnD', 'dart'),
  grand_finale: EVO({
    id: 'grand_finale', name: 'Grand Finale', kind: 'fireworks', evolvedFrom: 'fireworks',
    desc: 'A relentless screen-clearing barrage — every fourth volley launches a giant chrysanthemum shell.',
    damage: 30, cooldown: 1.1, area: 1.6, amount: 5, speed: 320, pierce: 0, duration: 0.65, knockback: 1,
    archetypes: ['aoe'], aimable: false, lore: 'Oooooh. Aaaaah. Run.',
  }, 'dadcdnD', 'firework'),
  sticky_situation: EVO({
    id: 'sticky_situation', name: 'Sticky Situation', kind: 'cotton', evolvedFrom: 'cotton',
    desc: 'Lays persistent candy-web fields under the crowd that bind and dissolve — the longer something stays stuck, the faster it melts.',
    damage: 26, cooldown: 0.9, area: 1.3, amount: 2, speed: 0, pierce: 0, duration: 4.5, knockback: 0,
    archetypes: ['dot'], aimable: true, lore: 'You are stuck here. So are they. Only one of you is melting.',
  }, 'dadudaD', 'web'),
  saturn_rings: EVO({
    id: 'saturn_rings', name: "Saturn's Rings", kind: 'rings', evolvedFrom: 'rings',
    desc: 'Giant slow rings orbit you permanently, shredding everything they pass.',
    damage: 76, cooldown: 0.35, area: 2.4, amount: 3, speed: 2.2, pierce: 999, duration: 999, knockback: 1.4,
    archetypes: ['orbit'], aimable: false, lore: 'Land the ring on the planet. Win the planet.',
  }, 'dadsdaD', 'ring'),
  cannonball_special: EVO({
    id: 'cannonball_special', name: 'Cannonball Special', kind: 'cannon', evolvedFrom: 'cannon',
    desc: 'Rapid-fire human cannonballs that tear piercing lines and explode at range.',
    damage: 55, cooldown: 0.7, area: 1.4, amount: 2, speed: 760, pierce: 999, duration: 1.1, knockback: 4, critBonus: 0.15,
    archetypes: ['crit', 'mobility'], aimable: true, lore: 'Two Zambinis! Three! The family business.',
  }, 'dsdcdaD', 'cannonball'),
  blizzard: EVO({
    id: 'blizzard', name: 'Blizzard Machine', kind: 'snowcone', evolvedFrom: 'snowcone',
    desc: 'Snowstorms roam the midway after the crowd, raining ice on all they cover; what they freeze shatters into icy shrapnel when it dies.',
    damage: 24, cooldown: 0.4, area: 1, amount: 2, speed: 1, pierce: 0, duration: 1.6, knockback: 0.15,
    archetypes: ['dot', 'aoe'], aimable: false, lore: 'Brain freeze, permanently.',
  }, 'dndadnD', 'storm'),
  inferno_grill: EVO({
    id: 'inferno_grill', name: 'Inferno Grill', kind: 'grill', evolvedFrom: 'grill',
    desc: 'A river of fire follows you, and the grill vents rolling waves of flame that set the crowd alight.',
    damage: 30, cooldown: 1.2, area: 1.5, amount: 1, speed: 0, pierce: 0, duration: 4, knockback: 0.5,
    archetypes: ['dot', 'aoe'], aimable: false, lore: 'The grill is always hot. The grill is always hungry.',
  }, 'dadudcD', 'wave'),
  grand_illumination: EVO({
    id: 'grand_illumination', name: 'Grand Illumination', kind: 'laser', evolvedFrom: 'laser',
    desc: 'Six long neon beams counter-rotate forever — a light-show death carousel.',
    damage: 29, cooldown: 0, area: 1.6, amount: 6, speed: 1.4, pierce: 0, duration: 999, knockback: 0.3,
    archetypes: ['orbit', 'dot'], aimable: false, lore: 'All the lights of the midway, aimed inward.',
  }, 'dadsdaD', 'beam'),
  last_light: EVO({
    id: 'last_light', name: 'The Last Light', kind: 'lantern', evolvedFrom: 'lantern',
    desc: 'Three long beams of grave-light turn about you and sweep before you at once.',
    damage: 29, cooldown: 0, area: 1.35, amount: 3, speed: 2.4, pierce: 0, duration: 999, knockback: 0.2,
    archetypes: ['dot'], aimable: true, lore: "The lantern at Death's Door: it shows the way out, and nothing follows.",
  }, 'dadsdaD', 'beam'),
  reapers_chain: EVO({
    id: 'reapers_chain', name: "The Reaper's Chain", kind: 'chains', evolvedFrom: 'chains',
    desc: 'The chain leaps twice as far through twice as many, losing nothing, and binds every link it passes.',
    damage: 70, cooldown: 0.6, area: 1.6, amount: 5, speed: 1, pierce: 0, duration: 2, knockback: 0.5,
    archetypes: ['crit'], aimable: false, lore: 'Every soul in the jar pulls on it.',
  }, 'dndcdnD', 'link'),
  last_call: EVO({
    id: 'last_call', name: 'Last Call', kind: 'whistle', evolvedFrom: 'steam_whistle',
    desc: 'The whistle screams three times over: ring after ring of scalding steam rolls out through the crowd.',
    damage: 48, cooldown: 2.0, area: 1.55, amount: 3, speed: 1, pierce: 0, duration: 0.55, knockback: 1.8,
    archetypes: ['aoe'], aimable: false, lore: 'All aboard. Nobody else is getting off.',
  }, 'dacdadD', 'ring'),
  hellmouth: EVO({
    id: 'hellmouth', name: 'Hellmouth', kind: 'breath', evolvedFrom: 'breath',
    desc: 'Fire pours from you without end, front and back, and every burning thing bursts.',
    damage: 18, cooldown: 0, area: 1.3, amount: 2, speed: 1, pierce: 0, duration: 999, knockback: 0.15,
    archetypes: ['aoe', 'dot'], aimable: true, lore: 'The coal got out.',
  }, 'dadsdaD', 'flame'),
  cosmic_convergence: EVO({
    id: 'cosmic_convergence', name: 'Cosmic Convergence', kind: 'orbs', evolvedFrom: 'orbs',
    desc: 'Seven giant orbs orbit permanently, swelling outward and grinding down what they catch, while a gravity pulse drags the crowd into them from afar.',
    damage: 86, cooldown: 3.0, area: 1.7, amount: 7, speed: 2.2, pierce: 0, duration: 999, knockback: 1.25,
    archetypes: ['orbit'], aimable: false, lore: 'The orb sees all. Now it pulls all.',
  }, 'dadsdcD', 'orb'),
  high_striker: EVO({
    id: 'high_striker', name: 'High Striker', kind: 'bell', evolvedFrom: 'bell',
    desc: 'The slam splits the ground all around you in a star of fissures, each ringing the bell at its tip, some for a jackpot crit.',
    damage: 56, cooldown: 1.3, area: 1.3, amount: 6, speed: 0, pierce: 0, duration: 0.5, knockback: 1.8,
    archetypes: ['aoe', 'crit'], aimable: false, lore: 'DING DING DING! We have a winner!',
  }, 'dadcdnD', 'fissure'),
  grand_requiem: EVO({
    id: 'grand_requiem', name: 'Grand Requiem', kind: 'calliope', evolvedFrom: 'steam_calliope',
    desc: 'An endless spiral of homing notes, punctuated by thunderous chords that shake the midway.',
    damage: 21, cooldown: 0.3, area: 1.4, amount: 3, speed: 260, pierce: 3, duration: 2.2, knockback: 0.6,
    archetypes: ['aoe', 'dot'], aimable: false, lore: 'Every soul in the carnival, singing at once.',
  }, 'dsdndaD', 'note'),
  hall_of_mirrors: EVO({
    id: 'hall_of_mirrors', name: 'Hall of Mirrors', kind: 'mirror', evolvedFrom: 'mirror', isSummon: true,
    desc: 'Three permanent clones orbit you and mirror your entire arsenal: together, 36% of your damage, 50% at Evo Lv 8.',
    damage: 0.36, cooldown: 0, area: 1, amount: 3, speed: 0, pierce: 0, duration: 999, knockback: 0,
    archetypes: ['summon'], aimable: false, lore: 'Which one is you? Does it matter anymore?',
  }, 'mmmmmmm', 'clone'),
};

export type StatAxis =
  | 'might' | 'cooldown' | 'area' | 'duration' | 'projSpeed' | 'amount' | 'critChance' | 'critDamage'
  | 'armor' | 'luck' | 'greed' | 'xp' | 'regen' | 'maxHp' | 'moveSpeed' | 'pickup' | 'revive'
  | TierPerkAxis;

/** The Nightmare and Hell shelves' perks (D-97, sim/tierPerks.ts): a level each, Devil's Bargain on or off. */
export type TierPerkAxis =
  | 'secondChance' | 'soulCollector' | 'prizeHunter' | 'openingAct' | 'secondWind'
  | 'bargain' | 'finalAct' | 'unfinished' | 'infernal' | 'emberHeart'
  // the tiers' passives (D-97): Death's Door, the Soul Jar, Brimstone, Cinder Heart
  | 'deathsDoor' | 'soulJar' | 'brimstone' | 'cinderHeart';

export interface PassiveDef {
  id: string;
  name: string;
  desc: string;
  effects: { axis: StatAxis; perLevel: number[] }[]; // perLevel[i] = amount gained when reaching level i+1
  maxLevel: number;
  unlock?: string;
  weight: number;
  lore: string;
}

const flat = (v: number, n = 5) => Array(n).fill(v);
const P = (d: PassiveDef) => d;

export const PASSIVES: Record<string, PassiveDef> = {
  strongman_belt: P({ id: 'strongman_belt', name: 'Strongman Belt', desc: '+10% Might (all damage)', effects: [{ axis: 'might', perLevel: flat(0.1) }], maxLevel: 5, weight: 1, lore: 'Still smells of liniment and victory.' }),
  energy_drink: P({ id: 'energy_drink', name: 'Energy Drink', desc: '−8% weapon cooldowns', effects: [{ axis: 'cooldown', perLevel: flat(0.08) }], maxLevel: 5, weight: 1, lore: 'Brewed behind the bumper cars. Glows faintly.' }),
  spectacles: P({ id: 'spectacles', name: 'Spectacles', desc: '+5% Crit chance, +20% Crit damage', effects: [{ axis: 'critChance', perLevel: flat(0.05) }, { axis: 'critDamage', perLevel: flat(0.2) }], maxLevel: 5, weight: 1, lore: 'Once belonged to the sharpshooter. One lens is cracked.' }),
  foam_finger: P({ id: 'foam_finger', name: 'Foam Finger', desc: '+12% Area', effects: [{ axis: 'area', perLevel: flat(0.12) }], maxLevel: 5, weight: 1, lore: "WE'RE #1. WE'RE #1." }),
  extra_token: P({ id: 'extra_token', name: 'Extra Token', desc: '+1 Amount at levels 1, 3 and 5', effects: [{ axis: 'amount', perLevel: [1, 0, 1, 0, 1] }], maxLevel: 5, weight: 0.6, lore: 'Found under the skee-ball machine. Still warm.' }),
  spinning_top: P({ id: 'spinning_top', name: 'Spinning Top', desc: '+12% Duration', effects: [{ axis: 'duration', perLevel: flat(0.12) }], maxLevel: 5, weight: 1, lore: 'It has been spinning since 1931.' }),
  caffeine: P({ id: 'caffeine', name: 'Caffeine', desc: '+15% Projectile speed', effects: [{ axis: 'projSpeed', perLevel: flat(0.15) }], maxLevel: 5, weight: 1, lore: "Carny coffee. Don't ask what's in it." }),
  // D-78: earned by beating the Commodore (the Undertow's evolution partner)
  running_shoes: P({ id: 'running_shoes', name: 'Running Shoes', desc: '+8% Move speed', effects: [{ axis: 'moveSpeed', perLevel: flat(0.08) }], maxLevel: 5, unlock: 'p_running_shoes', weight: 1, lore: 'The laces tie themselves when the music starts.' }),
  sugar_rush: P({ id: 'sugar_rush', name: 'Sugar Rush', desc: '+12% Max HP', effects: [{ axis: 'maxHp', perLevel: flat(0.12) }], maxLevel: 5, weight: 1, lore: 'A paper cone of pure pink courage.' }),
  // (Funnel Cake, +0.4 HP regen per second, left the draft pool for the Lost & Found's permanent perks: D-76)
  safety_goggles: P({ id: 'safety_goggles', name: 'Safety Goggles', desc: '+1 Armor (flat damage reduction)', effects: [{ axis: 'armor', perLevel: flat(1) }], maxLevel: 5, weight: 1, lore: 'Required for the Hammer Strike. Ignored by everyone.' }),
  magnet_glove: P({ id: 'magnet_glove', name: 'Magnet Glove', desc: '+25% Pickup radius', effects: [{ axis: 'pickup', perLevel: flat(0.25) }], maxLevel: 5, weight: 1, lore: 'Tickets cling to it. So do screams.' }),
  lucky_ticket: P({ id: 'lucky_ticket', name: 'Lucky Ticket', desc: '+10% Luck (better upgrade qualities, a 4th card)', effects: [{ axis: 'luck', perLevel: flat(0.1) }], maxLevel: 5, weight: 1, lore: 'Number 777. The winning number. For someone.' }),
  season_pass: P({ id: 'season_pass', name: 'Season Pass', desc: '+10% XP gain', effects: [{ axis: 'xp', perLevel: flat(0.1) }], maxLevel: 5, unlock: 'p_season_pass', weight: 0.9, lore: 'Valid every night. Every single night.' }),
  coin_purse: P({ id: 'coin_purse', name: 'Coin Purse', desc: '+15% Greed (more Lost Tickets)', effects: [{ axis: 'greed', perLevel: flat(0.15) }], maxLevel: 5, unlock: 'p_coin_purse', weight: 0.8, lore: 'It jingles even when empty.' }),
  hand_mirror: P({ id: 'hand_mirror', name: "Mira's Hand Mirror", desc: '+6% Might and +6% Area', effects: [{ axis: 'might', perLevel: flat(0.06) }, { axis: 'area', perLevel: flat(0.06) }], maxLevel: 5, unlock: 'p_hand_mirror', weight: 0.8, lore: 'Cracked across the middle. In it, a girl stands just behind your shoulder.' }),
  // the world tiers' passives (D-97, sim/tierPerks.ts): sold at the Lost & Found once their map is won on their tier
  deaths_door: P({ id: 'deaths_door', name: "Death's Door", desc: 'More Might the less health you have: up to +8% per level at a sliver', effects: [{ axis: 'deathsDoor', perLevel: flat(0.08) }], maxLevel: 5, unlock: 'p_deaths_door', weight: 0.8, lore: "The Night Watchman's keyring. One key opens a door nobody should walk back out of." }),
  soul_jar: P({ id: 'soul_jar', name: 'Soul Jar', desc: 'Every 40 kills (fewer each level) the jar breaks in a spectral blast around you', effects: [{ axis: 'soulJar', perLevel: flat(1) }], maxLevel: 5, unlock: 'p_soul_jar', weight: 0.8, lore: 'Corked with wax from the Widow\'s candles. It fills on its own.' }),
  brimstone: P({ id: 'brimstone', name: 'Brimstone', desc: 'Hits may set creatures alight (+4% chance per level); burning creatures burst when they die', effects: [{ axis: 'brimstone', perLevel: flat(1) }], maxLevel: 5, unlock: 'p_brimstone', weight: 0.8, lore: 'A lump of something from under the Infernal Carnival. It never cools.' }),
  cinder_heart: P({ id: 'cinder_heart', name: 'Cinder Heart', desc: 'Burning creatures near you heal you a little (more each level)', effects: [{ axis: 'cinderHeart', perLevel: flat(1) }], maxLevel: 5, unlock: 'p_cinder_heart', weight: 0.8, lore: 'It beats warmer the closer the fire comes.' }),
  // D-98: each map's hidden quest gives the passive that evolves the weapon its final boss gives
  last_song_score: P({ id: 'last_song_score', name: "The Calliope's Score", desc: '+8% Duration and +4% Might', effects: [{ axis: 'duration', perLevel: flat(0.08) }, { axis: 'might', perLevel: flat(0.04) }], maxLevel: 5, unlock: 'p_last_song', weight: 0.8, lore: 'Every note of the Last Song, in a dead bandmaster\'s hand. The calliope plays it louder.' }),
  conductor_watch: P({ id: 'conductor_watch', name: "The Conductor's Watch", desc: '−5% weapon cooldowns and +3% Move speed', effects: [{ axis: 'cooldown', perLevel: flat(0.05) }, { axis: 'moveSpeed', perLevel: flat(0.03) }], maxLevel: 5, unlock: 'p_conductor_watch', weight: 0.8, lore: 'Stopped at a quarter past the last train. Wind it, and the night keeps your time.' }),
  ada_conch: P({ id: 'ada_conch', name: "Ada's Conch", desc: '+12% Pickup radius and +0.25 HP regen per second', effects: [{ axis: 'pickup', perLevel: flat(0.12) }, { axis: 'regen', perLevel: flat(0.25) }], maxLevel: 5, unlock: 'p_ada_conch', weight: 0.8, lore: 'Hold it to your ear. Somebody on the other side is humming a song from 1933.' }),
  rabbits_foot: P({ id: 'rabbits_foot', name: "Rabbit's Foot", desc: '+1 Revive', effects: [{ axis: 'revive', perLevel: [1, 1] }], maxLevel: 2, unlock: 'p_rabbits_foot', weight: 0.35, lore: 'Lucky for you. Less so for the rabbit from the hat.' }),
};

export const BASE_WEAPON_IDS = Object.values(WEAPONS).filter((w) => !w.isEvolution).map((w) => w.id);
export const EVOLUTION_IDS = Object.values(WEAPONS).filter((w) => w.isEvolution).map((w) => w.id);
export const PASSIVE_IDS = Object.keys(PASSIVES);

export function weaponLevelSum(arr: number[] | undefined, level: number): number {
  if (!arr) return 0;
  let s = 0;
  for (let i = 0; i < level && i < arr.length; i++) s += arr[i];
  return s;
}
