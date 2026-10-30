// Enemy roster (doc 04). Base numbers ported from resources/enemies/*.tres (newest tuning, D-03);
// behaviours/params extended where the bible describes mechanics Godot never built.

export type BehaviorId =
  | 'chaser'
  | 'erratic'
  | 'burst_charger'
  | 'line_charger'
  | 'bumper'
  | 'flyby'
  | 'shooter'
  | 'formation'
  | 'spawner'
  | 'ambusher'
  | 'pop_up'
  | 'rail_strafer'
  | 'brute';

export type DeathFx =
  | 'pop' | 'springs' | 'stuffing' | 'sugar' | 'bonk' | 'deflate' | 'confetti' | 'splash'
  | 'wood' | 'ceramic' | 'boards' | 'derail' | 'crumple' | 'brute';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  contact: number;
  tickets: number;
  behavior: BehaviorId;
  radius: number;
  sep: number;
  knockbackTaken: number;
  canElite: boolean;
  eliteName?: string;
  contactSlow?: number;
  contactSlowTime?: number;
  dropsChest?: boolean;
  chestMin?: number;
  chestMax?: number;
  params: Record<string, number | string>;
  deathFx: DeathFx;
  hitSfx: string;
  deathSfx: string;
  /** Visual height multiplier relative to hit radius (sprites read bigger than hitboxes). */
  drawScale: number;
  act: number;
  role: string;
  lore: string;
  tell: string;
  /** Hard cap on how many may be alive at once (snakes, booths). */
  maxAlive?: number;
}

const E = (d: EnemyDef) => d;

export const ENEMIES: Record<string, EnemyDef> = {
  living_balloon: E({
    id: 'living_balloon', name: 'Living Balloon', hp: 4, speed: 120, contact: 3, tickets: 1,
    behavior: 'chaser', radius: 11, sep: 16, knockbackTaken: 1, canElite: true, eliteName: 'Lead Balloon',
    params: {}, deathFx: 'pop', hitSfx: 'squeak', deathSfx: 'pop', drawScale: 3.1, act: 1, role: 'Swarm',
    lore: 'A helium balloon that learned to bite. Trivial alone, lethal in a wall.',
    tell: 'Bobs as it floats straight at you.',
  }),
  swarm_balloon: E({
    id: 'swarm_balloon', name: 'Balloon Swarm', hp: 4, speed: 560, contact: 3, tickets: 1,
    behavior: 'flyby', radius: 10, sep: 10, knockbackTaken: 0.3, canElite: false,
    params: {}, deathFx: 'pop', hitSfx: 'squeak', deathSfx: 'pop', drawScale: 3.0, act: 1, role: 'Flyby',
    lore: 'A whole bouquet let go at once. They never look back.',
    tell: 'A yellow caution lane flashes across the screen — then a school of balloons streaks straight along it.',
  }),
  wind_up_monkey: E({
    id: 'wind_up_monkey', name: 'Wind-Up Monkey', hp: 12, speed: 165, contact: 4, tickets: 2,
    behavior: 'burst_charger', radius: 13, sep: 16, knockbackTaken: 1, canElite: true, eliteName: 'Drummer Monkey',
    params: { windup: 0.5, chargeSpeed: 380, chargeTime: 0.4, recover: 0.65, range: 280 },
    deathFx: 'springs', hitSfx: 'clank', deathSfx: 'springs', drawScale: 3.0, act: 1, role: 'Burst charger',
    lore: 'A tin cymbal-monkey. Its key never stops turning.',
    tell: 'Stops, key spins, eyes snap wide — then it dashes in a straight line.',
  }),
  possessed_stuffie: E({
    id: 'possessed_stuffie', name: 'Possessed Stuffie', hp: 32, speed: 80, contact: 5, tickets: 3,
    behavior: 'chaser', radius: 16, sep: 22, knockbackTaken: 0.8, canElite: true, eliteName: 'Stitch-King Stuffie',
    params: {}, deathFx: 'stuffing', hitSfx: 'thump', deathSfx: 'stuffing', drawScale: 2.9, act: 1, role: 'Slow bruiser',
    lore: 'Top-shelf prize. One button eye hangs by a thread.',
    tell: 'Plods in a shambling wall. Keep moving.',
  }),
  cotton_candy_slime: E({
    id: 'cotton_candy_slime', name: 'Cotton-Candy Slime', hp: 60, speed: 35, contact: 8, tickets: 3,
    behavior: 'chaser', radius: 16, sep: 18, knockbackTaken: 0.6, canElite: true, eliteName: 'Floss Tangle',
    contactSlow: 0.4, contactSlowTime: 1.2, params: { patchEvery: 5 },
    deathFx: 'sugar', hitSfx: 'squish', deathSfx: 'sugar', drawScale: 2.7, act: 2, role: 'Snare',
    lore: 'Spun sugar that oozed off its cone and kept going.',
    tell: 'Leaves sticky pink patches. Touching it slows you.',
  }),
  whack_a_mole: E({
    id: 'whack_a_mole', name: 'Whack-a-Mole', hp: 8, speed: 60, contact: 10, tickets: 2,
    behavior: 'pop_up', radius: 13, sep: 16, knockbackTaken: 1, canElite: false,
    params: { burrow: 1.6, surface: 1.3, burrowSpeed: 190 },
    deathFx: 'bonk', hitSfx: 'bonk', deathSfx: 'bonk', drawScale: 2.8, act: 2, role: 'Pop-up ambush',
    lore: 'Lives under the midway. Grins every time.',
    tell: 'A dirt mound travels toward you, then it pops up and swipes.',
  }),
  evil_clown: E({
    id: 'evil_clown', name: 'Evil Clown', hp: 36, speed: 145, contact: 6, tickets: 4,
    behavior: 'erratic', radius: 13, sep: 16, knockbackTaken: 1, canElite: true, eliteName: 'Stilt Clown',
    params: {}, deathFx: 'deflate', hitSfx: 'honk', deathSfx: 'slide', drawScale: 3.4, act: 1, role: 'Fast bruiser',
    lore: 'Too-wide grin, rolling eyes, size 30 shoes.',
    tell: 'Lurches and zig-zags; an occasional honk-hop burst of speed.',
  }),
  jack_in_the_box: E({
    id: 'jack_in_the_box', name: 'Jack-in-the-Box', hp: 15, speed: 60, contact: 6, tickets: 4,
    behavior: 'ambusher', radius: 12, sep: 14, knockbackTaken: 1, canElite: false,
    params: { armRange: 230, armTime: 1.4, leapSpeed: 540, leapTime: 0.45, blast: 25, blastR: 70 },
    deathFx: 'springs', hitSfx: 'clank', deathSfx: 'springs', drawScale: 2.8, act: 2, role: 'Trap / mine',
    lore: 'Plays a tinkling tune. You know how the song ends.',
    tell: 'Lid jitters while the tune plays; a target ring marks where it will land.',
  }),
  dunk_tank_clown: E({
    id: 'dunk_tank_clown', name: 'Dunk-Tank Clown', hp: 30, speed: 70, contact: 6, tickets: 3,
    behavior: 'shooter', radius: 13, sep: 16, knockbackTaken: 1, canElite: true, eliteName: 'Pie-Thrower Pro',
    params: { fire: 1.7, projSpeed: 230, projDmg: 9, projLife: 4, keep: 340, windup: 0.45, proj: 'pie', lead: 0.6 },
    deathFx: 'splash', hitSfx: 'honk', deathSfx: 'splash', drawScale: 3.0, act: 2, role: 'Ranged',
    lore: 'Rolls its own dunk tank around. Never misses on purpose.',
    tell: 'Winds back its arm — then lobs a pie where you are going.',
  }),
  puppet_soldier: E({
    id: 'puppet_soldier', name: 'Puppet Soldier', hp: 180, speed: 50, contact: 10, tickets: 5,
    behavior: 'formation', radius: 14, sep: 18, knockbackTaken: 0.6, canElite: true, eliteName: 'Puppet Officer',
    params: { fire: 2.6, projSpeed: 260, projDmg: 8, projLife: 4.5, keep: 380, windup: 0.7, proj: 'musket', rank: 5 },
    deathFx: 'wood', hitSfx: 'knock', deathSfx: 'wood', drawScale: 3.3, act: 3, role: 'Formation ranged',
    lore: 'A tin-toy regiment on unseen strings. They volley in unison.',
    tell: 'The whole rank raises muskets together before firing.',
  }),
  carousel_horse: E({
    id: 'carousel_horse', name: 'Carousel Horse', hp: 150, speed: 55, contact: 18, tickets: 6,
    behavior: 'line_charger', radius: 18, sep: 22, knockbackTaken: 0.5, canElite: true, eliteName: 'Nightmare Stallion',
    params: { windup: 0.8, chargeSpeed: 380, overshoot: 260, recover: 0.9, range: 440 },
    deathFx: 'ceramic', hitSfx: 'clank', deathSfx: 'ceramic', drawScale: 2.9, act: 3, role: 'Line charger',
    lore: 'Torn off its pole mid-gallop. The brass pole is still through its back.',
    tell: 'Rears up and stamps dust — then charges in a straight line far past you.',
  }),
  bumper_car: E({
    id: 'bumper_car', name: 'Bumper Car', hp: 120, speed: 60, contact: 16, tickets: 5,
    behavior: 'bumper', radius: 17, sep: 22, knockbackTaken: 0.4, canElite: true, eliteName: 'Demolition Dodgem',
    params: { windup: 0.6, ramSpeed: 330, ramTime: 1.4, recover: 0.7, range: 380, bounces: 2 },
    deathFx: 'crumple', hitSfx: 'clank', deathSfx: 'crumple', drawScale: 2.6, act: 3, role: 'Roaming charger',
    lore: 'Drives itself. Its rubber bumper is bared like teeth.',
    tell: 'Pole sparks crackle, then it rams and ricochets.',
  }),
  walking_ticket_booth: E({
    id: 'walking_ticket_booth', name: 'Walking Ticket Booth', hp: 600, speed: 22, contact: 16, tickets: 25,
    behavior: 'spawner', radius: 24, sep: 30, knockbackTaken: 0.15, canElite: false, maxAlive: 4,
    params: { spawnEvery: 4.5, spawnCount: 2, spawnEnemy: 'living_balloon', sprayEvery: 6.5, sprayCount: 7, sprayDmg: 8 },
    deathFx: 'boards', hitSfx: 'knock', deathSfx: 'boards', drawScale: 3.1, act: 3, role: 'Tank / spawner',
    lore: 'Grew stubby legs. Its slot dispenses enemies like tickets.',
    tell: 'Cha-chunk! Prints adds from its slot; sprays razor tickets in an arc.',
  }),
  roller_coaster_snake: E({
    id: 'roller_coaster_snake', name: 'Roller-Coaster Snake', hp: 1200, speed: 250, contact: 20, tickets: 12,
    behavior: 'rail_strafer', radius: 18, sep: 20, knockbackTaken: 0, canElite: false, maxAlive: 2,
    params: { railSpeed: 720, telegraph: 1.1, segments: 9, rest: 1.8 },
    deathFx: 'derail', hitSfx: 'clank', deathSfx: 'derail', drawScale: 2.6, act: 4, role: 'Screen strafer',
    lore: 'A length of track that became a serpent. It rides rails no one laid.',
    tell: 'A glowing rail flashes across the screen — the train follows it.',
  }),
  carnival_brute: E({
    id: 'carnival_brute', name: 'Carnival Brute', hp: 900, speed: 95, contact: 10, tickets: 15,
    behavior: 'brute', radius: 30, sep: 34, knockbackTaken: 0.25, canElite: false,
    dropsChest: true, chestMin: 1, chestMax: 1,
    params: { slamEvery: 4.5, slamTele: 0.95, slamR: 120, slamDmg: 18 },
    deathFx: 'brute', hitSfx: 'thump', deathSfx: 'brute', drawScale: 2.6, act: 1, role: 'Miniboss',
    lore: 'The sideshow strongman nobody beat. Carries the prize chest himself.',
    tell: 'Raises both fists — a ring marks the ground slam.',
  }),
  // Small add spawned by elite Stitch-King Stuffies and splitter affixes.
  mini_stuffie: E({
    id: 'mini_stuffie', name: 'Stuffie Scrap', hp: 12, speed: 110, contact: 3, tickets: 1,
    behavior: 'chaser', radius: 10, sep: 14, knockbackTaken: 1, canElite: false,
    params: {}, deathFx: 'stuffing', hitSfx: 'thump', deathSfx: 'pop', drawScale: 2.9, act: 1, role: 'Add',
    lore: 'What the Stitch-King leaves behind.', tell: 'Small and quick.',
  }),
};

/** Enemies shown in the Carnival-pedia (excludes internal adds). */
export const PEDIA_ENEMIES = Object.keys(ENEMIES).filter((k) => k !== 'mini_stuffie');

export type EliteAffix = 'explosive' | 'splitter' | 'hasted' | 'shielded' | 'magnetic';
export const ELITE_AFFIXES: EliteAffix[] = ['explosive', 'splitter', 'hasted', 'shielded', 'magnetic'];
