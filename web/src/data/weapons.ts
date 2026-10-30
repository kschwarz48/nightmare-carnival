// Weapons, evolutions and passives (doc 06). Godot-implemented weapons keep their .tres numbers;
// the rest follow doc 06 base values + the generic per-level template (06 §2).

export type WeaponKind =
  | 'cards' | 'mallet' | 'tarot' | 'bumper' | 'plush' | 'tophat' | 'popcorn' | 'darts' | 'fireworks'
  | 'cotton' | 'rings' | 'cannon' | 'snowcone' | 'grill' | 'laser' | 'orbs' | 'bell' | 'mirror' | 'calliope';

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
    desc: 'A huge mallet swing that smashes everything in an arc around you.',
    levelText: ['', '', '+2nd swing behind', '+8 damage', '−12% cooldown, +20% area', '+3rd overhead slam', '+10 damage, +20% area', '−12% cooldown', '+14 damage, +25% area'],
    damage: 22, cooldown: 1.3, area: 1.8, amount: 1, speed: 0, pierce: 0, duration: 0, knockback: 1.8,
    lv: { dmg: [0, 0, 8, 0, 0, 10, 0, 14], cd: [0, 0, 0, -0.12, 0, 0, -0.12, 0], area: [0, 0, 0, 0.2, 0, 0.2, 0, 0.25], amount: [0, 1, 0, 0, 1, 0, 0, 0] },
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
  bumper: W({
    id: 'bumper', name: 'Bumper Car', kind: 'bumper', signature: 'ride_operator',
    desc: 'Periodically surge forward in a bumper car, ramming foes (brief invulnerability).',
    levelText: ['', '', '+15% area', '+6 damage', '−0.25s cooldown', '+1 escort car, +15% area', '+8 damage', '−0.25s cooldown', '+1 escort car, +10 damage'],
    damage: 18, cooldown: 2.2, area: 1, amount: 1, speed: 560, pierce: 99, duration: 0.32, knockback: 3,
    lv: { dmg: [0, 0, 6, 0, 0, 8, 0, 10], cd: [0, 0, 0, -0.25, 0, 0, -0.25, 0], area: [0, 0.15, 0, 0, 0.15, 0, 0, 0], amount: [0, 0, 0, 0, 1, 0, 0, 1] },
    maxLevel: 8, evolvesTo: 'demolition_derby', evoPassive: 'running_shoes', archetypes: ['mobility'], aimable: false, weight: 0.9,
    lore: 'Car 7 was always the one that hit the hardest. Now it drives you.',
  }),
  plush: W({
    id: 'plush', name: 'Plush Companion', kind: 'plush', signature: 'lost_child', isSummon: true,
    desc: 'Plush pets orbit you and pounce on the nearest threat.',
    levelText: ['', '', '+1 pet', '+4 damage', '+1 pet', '+5 damage', '+1 pet', '+6 damage', 'Faster pounces'],
    damage: 8, cooldown: 0.8, area: 1, amount: 1, speed: 420, pierce: 0, duration: 0, knockback: 1,
    lv: { dmg: [0, 0, 4, 0, 5, 0, 6, 0], cd: [0, -0.1, 0, -0.1, 0, -0.1, 0, -0.1], area: Z8, amount: [0, 1, 0, 1, 0, 1, 0, 0] },
    maxLevel: 8, evolvesTo: 'nightmare_menagerie', evoPassive: 'sugar_rush', archetypes: ['summon'], aimable: false, weight: 1,
    lore: 'Won at the ring toss. It still remembers being loved.',
  }),
  tophat: W({
    id: 'tophat', name: 'Top Hat', kind: 'tophat', signature: 'ringleader', isSummon: true,
    desc: 'Pulls helpers from the hat — rabbits that kick and doves that dive.',
    levelText: ['', '', '+1 helper', '+3 damage', '+1s duration, −0.4s cooldown', '+1 helper', '+4 damage', '+1s duration, −0.4s cooldown', '+1 helper, +6 damage'],
    damage: 9, cooldown: 4.0, area: 1, amount: 1, speed: 300, pierce: 0, duration: 7, knockback: 1,
    lv: { dmg: [0, 0, 3, 0, 0, 4, 0, 6], cd: [0, 0, 0, -0.4, 0, 0, -0.4, 0], area: Z8, amount: [0, 1, 0, 0, 1, 0, 0, 1], dur: [0, 0, 0, 1, 0, 0, 1, 0] },
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
    damage: 11, cooldown: 1.0, area: 1, amount: 1, speed: 720, pierce: 2, duration: 0.75, knockback: 0.5,
    lv: { dmg: [0, 0, 0, 3, 0, 0, 4, 0], cd: [0, 0, 0, 0, 0, 0, 0, -0.1], area: Z8, amount: [0, 1, 0, 0, 1, 0, 0, 1], pierce: [0, 0, 1, 0, 0, 1, 0, 0] },
    maxLevel: 8, evolvesTo: 'sharpshooter', evoPassive: 'spectacles', archetypes: ['crit'], aimable: true, weight: 1,
    lore: 'Three throws for a ticket. Infinite throws for you.',
  }),
  fireworks: W({
    id: 'fireworks', name: 'Fireworks', kind: 'fireworks',
    desc: 'Rockets lobbed one-by-one that explode in scattered, dazzling bursts.',
    levelText: ['', '', '+1 rocket', '+6 damage', '−0.25s cooldown, +15% area', '+1 rocket', '+8 damage, +15% area', '+1 rocket, −0.25s cooldown', '+1 rocket, +12 damage, +20% area'],
    damage: 18, cooldown: 2.6, area: 1, amount: 1, speed: 280, pierce: 0, duration: 0.6, knockback: 1,
    lv: { dmg: [0, 0, 6, 0, 0, 8, 0, 12], cd: [0, 0, 0, -0.25, 0, 0, -0.25, 0], area: [0, 0, 0, 0.15, 0, 0.15, 0, 0.2], amount: [0, 1, 0, 0, 1, 0, 1, 1] },
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
    levelText: ['', '', '+1 ring', '+5 damage', '−0.15s cooldown, +10% area', '+1 ring', '+7 damage, +10% area', '+1 ring, −0.15s cooldown', '+1 ring, +11 damage, +15% area'],
    damage: 13, cooldown: 1.5, area: 1, amount: 1, speed: 480, pierce: 999, duration: 1.8, knockback: 0.8,
    lv: { dmg: [0, 0, 5, 0, 0, 7, 0, 11], cd: [0, 0, 0, -0.15, 0, 0, -0.15, 0], area: [0, 0, 0, 0.1, 0, 0.1, 0, 0.15], amount: [0, 1, 0, 0, 1, 0, 1, 1] },
    maxLevel: 8, evolvesTo: 'saturn_rings', evoPassive: 'strongman_belt', archetypes: ['orbit'], aimable: true, weight: 1,
    lore: 'Land one on a bottle, win a prize. Land one on a clown, win the night.',
  }),
  cannon: W({
    id: 'cannon', name: 'Carnival Cannon', kind: 'cannon', unlock: 'w_cannon',
    desc: 'Fires a human cannonball in a piercing line with huge knockback.',
    levelText: ['', '', '+20% area', '+10 damage', '−0.3s cooldown', '+20% area', '+12 damage', '−0.3s cooldown', '+1 cannonball, +16 damage'],
    damage: 40, cooldown: 2.6, area: 1, amount: 1, speed: 640, pierce: 999, duration: 1.2, knockback: 3.5, critBonus: 0.1,
    lv: { dmg: [0, 0, 10, 0, 0, 12, 0, 16], cd: [0, 0, 0, -0.3, 0, 0, -0.3, 0], area: [0, 0.2, 0, 0, 0.2, 0, 0, 0], amount: [0, 0, 0, 0, 0, 0, 0, 1] },
    maxLevel: 8, evolvesTo: 'cannonball_special', evoPassive: 'energy_drink', archetypes: ['crit', 'mobility'], aimable: true, weight: 0.9,
    lore: 'The Great Zambini was never seen again. His helmet still flies nightly.',
  }),
  snowcone: W({
    id: 'snowcone', name: 'Snow-Cone Machine', kind: 'snowcone',
    desc: 'A frost cone that chills enemies — five chills freeze them solid.',
    levelText: ['', '', '+15% area', '+2 damage', '−0.12s cooldown', '+15% area', '+3 damage', '−0.12s cooldown', '+2 side cones, +4 damage'],
    damage: 6, cooldown: 1.2, area: 1, amount: 1, speed: 0, pierce: 0, duration: 1.2, knockback: 0.3,
    lv: { dmg: [0, 0, 2, 0, 0, 3, 0, 4], cd: [0, 0, 0, -0.12, 0, 0, -0.12, 0], area: [0, 0.15, 0, 0, 0.15, 0, 0, 0], amount: [0, 0, 0, 0, 0, 0, 0, 2] },
    maxLevel: 8, evolvesTo: 'blizzard', evoPassive: 'caffeine', archetypes: ['dot'], aimable: true, weight: 1,
    lore: 'Blue raspberry. The colour of lips after midnight.',
  }),
  grill: W({
    id: 'grill', name: 'Hot-Dog Grill', kind: 'grill',
    desc: 'A flamethrower cone that sets enemies burning.',
    levelText: ['', '', '+15% area', '+2 damage/tick', '−0.1s cooldown', '+2 damage/tick, longer burn', '+15% area', '+3 damage/tick', '+1 rear flame, −0.1s cooldown'],
    damage: 5, cooldown: 0.8, area: 1, amount: 1, speed: 0, pierce: 0, duration: 3, knockback: 0,
    lv: { dmg: [0, 0, 2, 0, 2, 0, 3, 0], cd: [0, 0, 0, -0.1, 0, 0, 0, -0.1], area: [0, 0.15, 0, 0, 0, 0.15, 0, 0], amount: [0, 0, 0, 0, 0, 0, 0, 1], dur: [0, 0, 0, 0, 0.5, 0, 0, 0] },
    maxLevel: 8, evolvesTo: 'inferno_grill', evoPassive: 'strongman_belt', archetypes: ['dot', 'aoe'], aimable: true, weight: 1,
    lore: 'Foot-longs, charred. Also anything else that gets too close.',
  }),
  laser: W({
    id: 'laser', name: 'Laser Light Show', kind: 'laser', unlock: 'w_laser',
    desc: 'Rotating neon beams sweep around you.',
    levelText: ['', '', '+1 beam', '+2 damage/tick', '+15% length, +0.5s duration', '+1 beam', '+3 damage/tick', '+15% length, +0.5s duration', '+1 beam'],
    damage: 7, cooldown: 2.5, area: 1, amount: 1, speed: 1.7, pierce: 0, duration: 3, knockback: 0.2,
    lv: { dmg: [0, 0, 2, 0, 0, 3, 0, 0], cd: Z8, area: [0, 0, 0, 0.15, 0, 0, 0.15, 0], amount: [0, 1, 0, 0, 1, 0, 0, 1], dur: [0, 0, 0, 0.5, 0, 0, 0.5, 0] },
    maxLevel: 8, evolvesTo: 'grand_illumination', evoPassive: 'spinning_top', archetypes: ['orbit', 'dot'], aimable: false, weight: 0.9,
    lore: 'The disco tent never closed. Its lights learned to cut.',
  }),
  orbs: W({
    id: 'orbs', name: 'Crystal Orbs', kind: 'orbs', unlock: 'w_orbs',
    desc: 'Fortune-teller orbs orbit you, grinding through anything they touch.',
    levelText: ['', '', '+1 orb, −0.2s cooldown', '+1 orb, +4 damage', '−0.2s cooldown, +15% area', '+1 orb, +5 damage', '+1 orb, −0.2s cooldown', '+6 damage, +15% area', '+1 orb, −0.2s cooldown'],
    damage: 10, cooldown: 3, area: 1, amount: 1, speed: 2.6, pierce: 0, duration: 3, knockback: 1,
    lv: { dmg: [0, 0, 4, 0, 5, 0, 6, 0], cd: [0, -0.2, 0, -0.2, 0, -0.2, 0, -0.2], area: [0, 0, 0, 0.15, 0, 0, 0.15, 0], amount: [0, 1, 1, 0, 1, 1, 0, 1], dur: [0, 0, 0, 0.5, 0, 0.5, 0, 0.5] },
    maxLevel: 8, evolvesTo: 'cosmic_convergence', evoPassive: 'foam_finger', archetypes: ['orbit'], aimable: false, weight: 1,
    lore: 'Ask the Magic 8-Ball if you will survive. Reply hazy. Try again.',
  }),
  bell: W({
    id: 'bell', name: 'Strongman Bell', kind: 'bell', unlock: 'w_bell',
    desc: 'An overhead high-striker slam that sends out a shockwave ring.',
    levelText: ['', '', '+15% area', '+5 damage', '−0.15s cooldown', '+15% area', '+2nd ring, +6 damage', '+15% area', '−0.15s cooldown, +8 damage'],
    damage: 16, cooldown: 1.7, area: 1, amount: 1, speed: 0, pierce: 0, duration: 0.5, knockback: 1.6,
    lv: { dmg: [0, 0, 5, 0, 0, 6, 0, 8], cd: [0, 0, 0, -0.15, 0, 0, 0, -0.15], area: [0, 0.15, 0, 0, 0.15, 0, 0.15, 0], amount: [0, 0, 0, 0, 0, 1, 0, 0] },
    maxLevel: 8, evolvesTo: 'high_striker', evoPassive: 'lucky_ticket', archetypes: ['aoe'], aimable: false, weight: 0.9,
    lore: 'Ring the bell, win a cigar. Ring it hard enough and the ground answers.',
  }),
  mirror: W({
    id: 'mirror', name: 'Funhouse Mirror', kind: 'mirror', unlock: 'w_mirror', isSummon: true,
    desc: 'Conjures a mirror clone that re-fires your attacks from its own position, at 12% of your damage (up to 30%, shared between clones).',
    levelText: ['', '', '+3% clone power', '+1s duration', '+3% clone power', '+1 clone (sharing the power)', '+1s duration', '+4% clone power', '+8% clone power'],
    // D-61: `damage` is the clones' total share of your damage, split between however many there are
    damage: 0.12, cooldown: 3.0, area: 1, amount: 1, speed: 0, pierce: 0, duration: 4, knockback: 0,
    lv: { dmg: [0, 0.03, 0, 0.03, 0, 0, 0.04, 0.08], cd: Z8, area: Z8, amount: [0, 0, 0, 0, 1, 0, 0, 0], dur: [0, 0, 1, 0, 0, 1, 0, 0] },
    maxLevel: 8, evolvesTo: 'hall_of_mirrors', evoPassive: 'season_pass', archetypes: ['summon'], aimable: false, weight: 0.8,
    lore: 'In the funhouse there are two of you. Only one of you is scared.',
  }),

  steam_calliope: W({
    id: 'steam_calliope', name: 'Steam Calliope', kind: 'calliope', unlock: 'w_calliope',
    desc: 'A tiny haunted organ plays spiralling notes that drift outward through the crowd.',
    levelText: ['', '', '+2 notes', '+3 damage', '−0.25s cooldown', '+2 notes, +1 pierce', '+4 damage', '−0.25s cooldown', '+2 notes, +5 damage'],
    damage: 9, cooldown: 2.2, area: 1, amount: 6, speed: 230, pierce: 1, duration: 1.8, knockback: 0.4,
    lv: { dmg: [0, 0, 3, 0, 0, 4, 0, 5], cd: [0, 0, 0, -0.25, 0, 0, -0.25, 0], area: Z8, amount: [0, 2, 0, 0, 2, 0, 0, 2], pierce: [0, 0, 0, 0, 1, 0, 0, 0] },
    maxLevel: 8, evolvesTo: 'grand_requiem', evoPassive: 'magnet_glove', archetypes: ['aoe', 'dot'], aimable: false, weight: 0.9,
    lore: 'Pulled from the Big Top ruins at dawn. It still knows the last song.',
  }),

  // ---------------- Evolutions (06 §5 + D-07) ----------------
  royal_flush: EVO({
    id: 'royal_flush', name: 'Royal Flush', kind: 'cards', evolvedFrom: 'throwing_cards',
    desc: 'A 52-card storm: golden cards spiral the whole screen, piercing everything, critting hard.',
    damage: 18, cooldown: 0.65, area: 1.2, amount: 6, speed: 560, pierce: 999, duration: 1.7, knockback: 1, critBonus: 0.18,
    archetypes: ['crit'], aimable: true, lore: 'Ace, king, queen, jack, ten — and your name on the river card.',
  }, 'dsdcdnD', 'card'),
  whack_frenzy: EVO({
    id: 'whack_frenzy', name: 'Whack Frenzy', kind: 'mallet', evolvedFrom: 'mallet',
    desc: 'A continuous whirlwind of mallet smashes; every fourth spin ground-pounds.',
    damage: 26, cooldown: 0.45, area: 2.6, amount: 2, speed: 0, pierce: 0, duration: 0, knockback: 2.2,
    archetypes: ['aoe'], aimable: false, lore: 'Whack. Whack. Whack. Whack. Whack.',
  }, 'dadcdaD', 'mallet'),
  death_card: EVO({
    id: 'death_card', name: 'The Death Card', kind: 'tarot', evolvedFrom: 'tarot',
    desc: 'Slow homing reaper cards that crit for massive damage and burst on impact.',
    damage: 110, cooldown: 1.6, area: 1.3, amount: 2, speed: 260, pierce: 0, duration: 4.5, knockback: 1.5, critBonus: 0.45,
    archetypes: ['crit'], aimable: false, lore: 'Not an ending. A transformation. Yours.',
  }, 'dsdcdnD', 'reaper card'),
  demolition_derby: EVO({
    id: 'demolition_derby', name: 'Demolition Derby', kind: 'bumper', evolvedFrom: 'bumper',
    desc: 'A permanent ramming aura while you move, and phantom cars that pinball through the crowd.',
    damage: 22, cooldown: 1.6, area: 1.4, amount: 3, speed: 520, pierce: 999, duration: 0.3, knockback: 2.5,
    archetypes: ['mobility'], aimable: false, lore: 'No brakes. No exits. No survivors.',
  }, 'dadsdnD', 'phantom car'),
  nightmare_menagerie: EVO({
    id: 'nightmare_menagerie', name: 'Nightmare Menagerie', kind: 'plush', evolvedFrom: 'plush', isSummon: true,
    desc: 'A ravenous pack of plush pets roams the screen, shredding the crowd.',
    damage: 18, cooldown: 0.5, area: 1, amount: 6, speed: 520, pierce: 0, duration: 0, knockback: 1,
    archetypes: ['summon'], aimable: false, lore: 'Every prize nobody claimed came looking for an owner.',
  }, 'dsdndsD', 'plush pet'),
  grand_menagerie: EVO({
    id: 'grand_menagerie', name: 'Grand Menagerie', kind: 'tophat', evolvedFrom: 'tophat', isSummon: true,
    desc: 'A permanent three-ring troupe: a pouncing lion, a stomping elephant and tumbling acrobats.',
    damage: 24, cooldown: 3.0, area: 1.2, amount: 4, speed: 340, pierce: 0, duration: 999, knockback: 1.5,
    archetypes: ['summon'], aimable: false, lore: 'Ladies and gentlemen — the greatest show in the dark!',
  }, 'dadcdaD', 'act'),
  kettle_korn: EVO({
    id: 'kettle_korn', name: 'Kettle-Korn Cannon', kind: 'popcorn', evolvedFrom: 'popcorn',
    desc: 'A constantly-popping field of kettle corn blankets the ground around you.',
    damage: 20, cooldown: 0.16, area: 1.5, amount: 1, speed: 0, pierce: 0, duration: 0.5, knockback: 0.8,
    archetypes: ['aoe'], aimable: false, lore: 'Sweet and salty. Mostly salty.',
  }, 'dadadcD', 'kernel'),
  sharpshooter: EVO({
    id: 'sharpshooter', name: "Sharpshooter's Bouquet", kind: 'darts', evolvedFrom: 'darts',
    desc: 'Crit-heavy dart volleys that blossom into shrapnel flowers on every hit.',
    damage: 20, cooldown: 0.7, area: 1.2, amount: 4, speed: 820, pierce: 4, duration: 0.8, knockback: 0.6, critBonus: 0.3,
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
    desc: 'Lays persistent candy-web fields under the crowd that bind and dissolve.',
    damage: 10, cooldown: 0.9, area: 1.3, amount: 2, speed: 0, pierce: 0, duration: 4.5, knockback: 0,
    archetypes: ['dot'], aimable: true, lore: 'You are stuck here. So are they. Only one of you is melting.',
  }, 'dadudaD', 'web'),
  saturn_rings: EVO({
    id: 'saturn_rings', name: "Saturn's Rings", kind: 'rings', evolvedFrom: 'rings',
    desc: 'Giant slow rings orbit you permanently, shredding everything they pass.',
    damage: 26, cooldown: 0.35, area: 2.4, amount: 3, speed: 1.1, pierce: 999, duration: 999, knockback: 1.4,
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
    desc: 'A wide freezing storm around you; frozen enemies shatter into icy shrapnel.',
    damage: 12, cooldown: 0.8, area: 1.5, amount: 1, speed: 0, pierce: 0, duration: 1.6, knockback: 0.3,
    archetypes: ['dot', 'aoe'], aimable: false, lore: 'Brain freeze, permanently.',
  }, 'dadudaD', 'storm'),
  inferno_grill: EVO({
    id: 'inferno_grill', name: 'Inferno Grill', kind: 'grill', evolvedFrom: 'grill',
    desc: 'Rolling waves of flame that leave the ground burning.',
    damage: 14, cooldown: 1.2, area: 1.5, amount: 1, speed: 0, pierce: 0, duration: 4, knockback: 0.5,
    archetypes: ['dot', 'aoe'], aimable: false, lore: 'The grill is always hot. The grill is always hungry.',
  }, 'dadudcD', 'wave'),
  grand_illumination: EVO({
    id: 'grand_illumination', name: 'Grand Illumination', kind: 'laser', evolvedFrom: 'laser',
    desc: 'Six long neon beams counter-rotate forever — a light-show death carousel.',
    damage: 12, cooldown: 0, area: 1.6, amount: 6, speed: 1.4, pierce: 0, duration: 999, knockback: 0.3,
    archetypes: ['orbit', 'dot'], aimable: false, lore: 'All the lights of the midway, aimed inward.',
  }, 'dadsdaD', 'beam'),
  cosmic_convergence: EVO({
    id: 'cosmic_convergence', name: 'Cosmic Convergence', kind: 'orbs', evolvedFrom: 'orbs',
    desc: 'Seven giant orbs orbit permanently while a gravity pulse drags enemies into them.',
    damage: 22, cooldown: 3.0, area: 1.7, amount: 7, speed: 2.2, pierce: 0, duration: 999, knockback: 1,
    archetypes: ['orbit'], aimable: false, lore: 'The orb sees all. Now it pulls all.',
  }, 'dadsdcD', 'orb'),
  high_striker: EVO({
    id: 'high_striker', name: 'High Striker', kind: 'bell', evolvedFrom: 'bell',
    desc: 'Giant slams strike foes across the screen — some ring the bell for a jackpot crit.',
    damage: 34, cooldown: 1.3, area: 1.5, amount: 4, speed: 0, pierce: 0, duration: 0.5, knockback: 2,
    archetypes: ['aoe', 'crit'], aimable: false, lore: 'DING DING DING! We have a winner!',
  }, 'dadcdnD', 'slam'),
  grand_requiem: EVO({
    id: 'grand_requiem', name: 'Grand Requiem', kind: 'calliope', evolvedFrom: 'steam_calliope',
    desc: 'An endless spiral of homing notes, punctuated by thunderous chords that shake the midway.',
    damage: 16, cooldown: 0.3, area: 1.4, amount: 3, speed: 260, pierce: 3, duration: 2.2, knockback: 0.6,
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
  | 'armor' | 'luck' | 'greed' | 'xp' | 'regen' | 'maxHp' | 'moveSpeed' | 'pickup' | 'revive';

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
  running_shoes: P({ id: 'running_shoes', name: 'Running Shoes', desc: '+8% Move speed', effects: [{ axis: 'moveSpeed', perLevel: flat(0.08) }], maxLevel: 5, weight: 1, lore: 'The laces tie themselves when the music starts.' }),
  sugar_rush: P({ id: 'sugar_rush', name: 'Sugar Rush', desc: '+12% Max HP', effects: [{ axis: 'maxHp', perLevel: flat(0.12) }], maxLevel: 5, weight: 1, lore: 'A paper cone of pure pink courage.' }),
  funnel_cake: P({ id: 'funnel_cake', name: 'Funnel Cake', desc: '+0.4 HP regen per second', effects: [{ axis: 'regen', perLevel: flat(0.4) }], maxLevel: 5, weight: 1, lore: 'Powdered sugar heals all wounds. Most of them.' }),
  safety_goggles: P({ id: 'safety_goggles', name: 'Safety Goggles', desc: '+1 Armor (flat damage reduction)', effects: [{ axis: 'armor', perLevel: flat(1) }], maxLevel: 5, weight: 1, lore: 'Required for the Hammer Strike. Ignored by everyone.' }),
  magnet_glove: P({ id: 'magnet_glove', name: 'Magnet Glove', desc: '+25% Pickup radius', effects: [{ axis: 'pickup', perLevel: flat(0.25) }], maxLevel: 5, weight: 1, lore: 'Tickets cling to it. So do screams.' }),
  lucky_ticket: P({ id: 'lucky_ticket', name: 'Lucky Ticket', desc: '+10% Luck (crits, rarer drafts, 4th card)', effects: [{ axis: 'luck', perLevel: flat(0.1) }], maxLevel: 5, weight: 1, lore: 'Number 777. The winning number. For someone.' }),
  season_pass: P({ id: 'season_pass', name: 'Season Pass', desc: '+10% XP gain', effects: [{ axis: 'xp', perLevel: flat(0.1) }], maxLevel: 5, unlock: 'p_season_pass', weight: 0.9, lore: 'Valid every night. Every single night.' }),
  coin_purse: P({ id: 'coin_purse', name: 'Coin Purse', desc: '+15% Greed (more Lost Tickets)', effects: [{ axis: 'greed', perLevel: flat(0.15) }], maxLevel: 5, unlock: 'p_coin_purse', weight: 0.8, lore: 'It jingles even when empty.' }),
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
