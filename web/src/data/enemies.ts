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
  | 'brute'
  // the Fun House (D-63)
  | 'mannequin'
  | 'doppel'
  | 'glasswalker'
  | 'marionette'
  | 'splitter'
  | 'crooked'
  | 'thief'
  // the Boardwalk (D-68)
  | 'drowned'
  | 'crab'
  | 'usher'
  | 'taffy'
  | 'automaton'
  | 'wraith'
  | 'barnacle'
  | 'angler'
  | 'collector'
  | 'tidecaller'
  | 'duckline';

export type DeathFx =
  | 'pop' | 'springs' | 'stuffing' | 'sugar' | 'bonk' | 'deflate' | 'confetti' | 'splash'
  | 'wood' | 'ceramic' | 'boards' | 'derail' | 'crumple' | 'brute'
  | 'porcelain' | 'glass' | 'strings' | 'goo'
  | 'brine' | 'shell' | 'taffy' | 'tokens' | 'ecto' | 'ink' | 'prizes';

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
  /** the Fun House's Splitter: what it breaks into on death, and how many (D-63) */
  splitInto?: string;
  splitCount?: number;
  /** a sea creature (D-68): swims fast in water, comes up out of it, a little slower on land */
  aquatic?: boolean;
  /** claws its way up out of the sand or the surf when it appears, whether or not it's a swimmer (D-68) */
  rises?: boolean;
  /**
   * a crust (D-68): damage is scaled by `mult` until the shell has soaked up `soak` x max HP of raw
   * damage; then it cracks, and the soft thing inside takes `cracked` x and moves `haste` x faster
   */
  shell?: { mult: number; soak: number; cracked: number; haste: number };
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
  // ================================================================ the Fun House (D-63)
  grinning_mannequin: E({
    id: 'grinning_mannequin', name: 'Grinning Mannequin', hp: 37, speed: 140, contact: 6, tickets: 3,
    behavior: 'mannequin', radius: 14, sep: 18, knockbackTaken: 0.5, canElite: true, eliteName: 'Window Display',
    params: { watch: 520, cone: 0.62 },
    deathFx: 'porcelain', hitSfx: 'clack', deathSfx: 'shatter', drawScale: 3.4, act: 1, role: 'Durable ambusher',
    lore: 'A shop dummy with a painted smile. It was never meant to have knees.',
    tell: 'Frozen while anyone faces it. Turn your back and it sprints.',
  }),
  grand_mannequin: E({
    id: 'grand_mannequin', name: 'The Grand Display', hp: 1035, speed: 130, contact: 12, tickets: 15,
    behavior: 'mannequin', radius: 30, sep: 34, knockbackTaken: 0.1, canElite: false, dropsChest: true, chestMin: 1, chestMax: 2,
    params: { watch: 640, cone: 0.55 },
    deathFx: 'porcelain', hitSfx: 'clack', deathSfx: 'shatter', drawScale: 3.6, act: 2, role: 'Miniboss',
    lore: 'The window display from the old department store. It has been posing for ninety years.',
    tell: 'A giant dummy: frozen while you face it, a stampede when you don\'t.',
  }),
  doppelganger: E({
    id: 'doppelganger', name: 'Doppelganger', hp: 207, speed: 190, contact: 12, tickets: 5,
    behavior: 'doppel', radius: 13, sep: 16, knockbackTaken: 0.7, canElite: true, eliteName: 'Perfect Copy',
    params: { delay: 1.2, lunge: 520, lungeRange: 150, windup: 0.4 },
    deathFx: 'glass', hitSfx: 'glass_hit', deathSfx: 'shatter', drawScale: 3.4, act: 3, role: 'Fast stalker',
    lore: 'Your reflection, a little late, and very tired of copying you.',
    tell: 'Walks your own footsteps a moment behind; gleams before it lunges.',
  }),
  glasswalker: E({
    id: 'glasswalker', name: 'Glasswalker', hp: 172, speed: 90, contact: 16, tickets: 6,
    behavior: 'glasswalker', radius: 14, sep: 16, knockbackTaken: 0.6, canElite: true, eliteName: 'Cathedral Glass',
    params: { hop: 3.2, emerge: 0.9, slash: 22, slashR: 95 },
    deathFx: 'glass', hitSfx: 'glass_hit', deathSfx: 'shatter', drawScale: 3.6, act: 3, role: 'Mirror stepper',
    lore: 'It lives in the space behind the glass and visits.',
    tell: 'A mirror ripples and cracks where it is about to step out — then it slashes.',
  }),
  marionette: E({
    id: 'marionette', name: 'Marionette', hp: 14, speed: 120, contact: 5, tickets: 2,
    behavior: 'marionette', radius: 12, sep: 15, knockbackTaken: 0.9, canElite: true, eliteName: 'Prima Puppet',
    params: { leap: 0.55, rest: 0.5, land: 50, landDmg: 5 },
    deathFx: 'strings', hitSfx: 'knock', deathSfx: 'wood', drawScale: 3.3, act: 1, role: 'Erratic leaper',
    lore: 'Its strings go up into the dark, and something up there is bored.',
    tell: 'Yanked into the air in jerks; it lands with a little thump around it.',
  }),
  splitter: E({
    id: 'splitter', name: 'Splitter', hp: 30, speed: 55, contact: 9, tickets: 1,
    behavior: 'splitter', radius: 22, sep: 26, knockbackTaken: 0.4, canElite: true, eliteName: 'Amalgam', splitInto: 'splitter_mid', splitCount: 2,
    params: {},
    deathFx: 'goo', hitSfx: 'squelch', deathSfx: 'splat', drawScale: 3.0, act: 2, role: 'Durable, multiplies',
    lore: 'What a funhouse mirror would look like if it got out.',
    tell: 'Wobbles and bulges; burst it and it comes apart into smaller ones — twice.',
  }),
  splitter_mid: E({
    id: 'splitter_mid', name: 'Splitter', hp: 12, speed: 75, contact: 7, tickets: 1,
    behavior: 'splitter', radius: 16, sep: 19, knockbackTaken: 0.6, canElite: false, splitInto: 'splitter_small', splitCount: 2,
    params: {},
    deathFx: 'goo', hitSfx: 'squelch', deathSfx: 'splat', drawScale: 3.0, act: 2, role: 'Splitter (half)',
    lore: 'Half of a Splitter, and angrier about it.', tell: 'Bursts into two smaller ones.',
  }),
  splitter_small: E({
    id: 'splitter_small', name: 'Splitter', hp: 5, speed: 100, contact: 5, tickets: 1,
    behavior: 'splitter', radius: 10, sep: 12, knockbackTaken: 1, canElite: false,
    params: {},
    deathFx: 'goo', hitSfx: 'squelch', deathSfx: 'splat', drawScale: 3.0, act: 2, role: 'Splitter (quarter)',
    lore: 'The last of it.', tell: 'Fast and small.',
  }),
  crooked_clown: E({
    id: 'crooked_clown', name: 'Crooked Clown', hp: 34, speed: 80, contact: 7, tickets: 3,
    behavior: 'crooked', radius: 13, sep: 16, knockbackTaken: 1, canElite: true, eliteName: 'Ringmaster\'s Cousin',
    params: { fire: 2.1, projSpeed: 250, projDmg: 10, projLife: 3.6, keep: 360, windup: 0.5, curve: 1.6, side: 1.2 },
    deathFx: 'confetti', hitSfx: 'honk', deathSfx: 'slide', drawScale: 3.6, act: 2, role: 'Ranged (curving)',
    lore: 'A performer stretched by a bad mirror, and he liked it.',
    tell: 'Sidesteps, winds back — and throws bent pins that curve toward you.',
  }),
  reflection_thief: E({
    id: 'reflection_thief', name: 'Reflection Thief', hp: 300, speed: 70, contact: 8, tickets: 10,
    behavior: 'thief', radius: 14, sep: 18, knockbackTaken: 0.5, canElite: true, eliteName: 'Mirror Merchant', maxAlive: 3,
    params: { cast: 5, decoys: 4, blink: 260, blinkCd: 3 },
    deathFx: 'glass', hitSfx: 'glass_hit', deathSfx: 'shatter', drawScale: 3.5, act: 4, role: 'Illusionist',
    lore: 'It sells you your own face back, one decoy at a time.',
    tell: 'Raises a hand mirror: shimmering copies of nearby monsters appear. They\'re harmless — it isn\'t. Blinks away when cornered.',
  }),
  // ================================================================ the Boardwalk (D-68)
  drowned: E({
    id: 'drowned', name: 'The Drowned', hp: 38, speed: 95, contact: 6, tickets: 3,
    behavior: 'drowned', radius: 13, sep: 17, knockbackTaken: 0.8, canElite: true, eliteName: 'Drowned Lifeguard', aquatic: true, rises: true,
    params: { drag: 0.55, lurch: 1.65 },
    deathFx: 'brine', hitSfx: 'gurgle', deathSfx: 'gurgle', drawScale: 3.3, act: 1, role: 'Shambler',
    lore: 'A bather from the summer of \'33, still in the striped suit. The sea gave back what it didn\'t want.',
    tell: 'Claws up out of the surf or the sand; drags itself a few steps, then lurches.',
  }),
  shore_crawler: E({
    id: 'shore_crawler', name: 'Shore Crawler', hp: 15, speed: 175, contact: 4, tickets: 2,
    behavior: 'crab', radius: 13, sep: 16, knockbackTaken: 1, canElite: true, eliteName: 'King Crawler', aquatic: true,
    params: { range: 230, windup: 0.35, dash: 540, dashTime: 0.3, recover: 0.45 },
    deathFx: 'shell', hitSfx: 'clatter', deathSfx: 'clatter', drawScale: 2.6, act: 1, role: 'Scuttling charger',
    lore: 'A crab as big as a dog, its shell crusted with bottle caps and a pennant from the Sea Wheel.',
    tell: 'Scuttles sideways in a zig-zag; raises both claws — then darts straight at you.',
  }),
  ticket_taker: E({
    id: 'ticket_taker', name: 'Ticket Taker', hp: 52, speed: 120, contact: 6, tickets: 5,
    behavior: 'usher', radius: 13, sep: 16, knockbackTaken: 1, canElite: true, eliteName: 'Head Usher', maxAlive: 6,
    params: { keep: 300, fire: 3.2, windup: 0.55, projSpeed: 300, projDmg: 7, projLife: 3.2, mark: 5 },
    deathFx: 'confetti', hitSfx: 'punch', deathSfx: 'punch', drawScale: 3.4, act: 2, role: 'Ranged (marks you)',
    lore: 'Still on duty at the gate. Every guest gets a stub. Every stub gets collected.',
    tell: 'Raises its punch and flicks a ticket stub. If it catches you, you are marked: everything nearby comes for you faster.',
  }),
  taffy_horror: E({
    id: 'taffy_horror', name: 'Taffy Horror', hp: 108, speed: 40, contact: 8, tickets: 6,
    behavior: 'taffy', radius: 17, sep: 20, knockbackTaken: 0.3, canElite: true, eliteName: 'Saltwater Twist', maxAlive: 4,
    contactSlow: 0.35, contactSlowTime: 1,
    params: { range: 270, windup: 0.8, lash: 300, lashW: 24, lashDmg: 11, slow: 0.6, slowT: 1.4, yank: 420 },
    deathFx: 'taffy', hitSfx: 'stretch', deathSfx: 'splat', drawScale: 2.8, act: 2, role: 'Snare (lash & yank)',
    lore: 'Forty pounds of saltwater taffy left on the pulling hooks since the night the power failed.',
    tell: 'Draws back a strand — a sticky line marks where it will lash. Caught, you are slowed and reeled in.',
  }),
  arcade_automaton: E({
    id: 'arcade_automaton', name: 'Arcade Automaton', hp: 47, speed: 60, contact: 6, tickets: 4,
    behavior: 'automaton', radius: 14, sep: 18, knockbackTaken: 0.7, canElite: true, eliteName: 'Grand Mechanical', maxAlive: 5,
    params: { keep: 320, fire: 4, windup: 0.9, coins: 5, spread: 0.9, projSpeed: 240, projDmg: 7, projLife: 3 },
    deathFx: 'tokens', hitSfx: 'clank', deathSfx: 'tokens', drawScale: 3.3, act: 2, role: 'Ranged (volleys)',
    lore: 'A penny-arcade cabinet that walked out on brass legs. The figure in the glass still smiles for a nickel.',
    tell: 'Stops; its crank ratchets round — then it spits a fan of five arcade tokens.',
  }),
  coaster_wraith: E({
    id: 'coaster_wraith', name: 'Coaster Wraith', hp: 270, speed: 70, contact: 18, tickets: 9,
    behavior: 'wraith', radius: 16, sep: 20, knockbackTaken: 0.4, canElite: true, eliteName: 'Front-Car Rider', maxAlive: 4,
    params: { range: 520, tele: 1, charge: 620, kink: 170, over: 260, recover: 0.8 },
    deathFx: 'ecto', hitSfx: 'clank', deathSfx: 'scream', drawScale: 2.9, act: 3, role: 'Rail charger',
    lore: 'A rider who never got off the Undertow. It still screams on the drop.',
    tell: 'A bent rail of light lays itself across the ground — then it rides it, around the bend, at full speed.',
  }),
  barnacle_brute: E({
    id: 'barnacle_brute', name: 'Barnacle Brute', hp: 190, speed: 50, contact: 14, tickets: 6,
    behavior: 'barnacle', radius: 19, sep: 24, knockbackTaken: 0.25, canElite: true, eliteName: 'Reef Wall', aquatic: true,
    shell: { mult: 0.3, soak: 0.5, cracked: 1.25, haste: 1.35 },
    params: { slamEvery: 4.2, slamTele: 0.9, slamR: 110, slamDmg: 16, range: 150 },
    deathFx: 'shell', hitSfx: 'knock', deathSfx: 'crack', drawScale: 2.7, act: 3, role: 'Armored tank',
    lore: 'A pier diver who went down to free a fouled piling in 1931 and stayed. The reef grew over him.',
    tell: 'Shrugs off hits until its crust cracks — then it is soft, angry and faster. Raises both arms for a slam.',
  }),
  lantern_angler: E({
    id: 'lantern_angler', name: 'Lantern Angler', hp: 225, speed: 85, contact: 16, tickets: 9,
    behavior: 'angler', radius: 16, sep: 20, knockbackTaken: 0.5, canElite: true, eliteName: 'Abyssal Lamplighter', aquatic: true, maxAlive: 4,
    params: { lure: 1.6, pull: 130, pullR: 340, range: 260, biteTele: 0.45, biteR: 150, biteDmg: 22, lunge: 520, cool: 3 },
    deathFx: 'ink', hitSfx: 'squelch', deathSfx: 'bite', drawScale: 2.8, act: 3, role: 'Lure & lunge',
    lore: 'It hangs a carnival lantern from its brow. Out on the pier at night, that light looks like help.',
    tell: 'Holds still while its lantern brightens and draws you in — a wedge marks the bite, then it lunges.',
  }),
  prize_collector: E({
    id: 'prize_collector', name: 'Prize Collector', hp: 520, speed: 70, contact: 12, tickets: 18,
    behavior: 'collector', radius: 22, sep: 28, knockbackTaken: 0.2, canElite: false, maxAlive: 3,
    params: { sniff: 520, grabTele: 0.6, grabR: 130, grabDmg: 14, payback: 1.5 },
    deathFx: 'prizes', hitSfx: 'thump', deathSfx: 'jingle', drawScale: 2.9, act: 3, role: 'Ticket thief',
    lore: 'The man from the prize counter, sack over his shoulder. Every ticket on the boards belongs to him now.',
    tell: 'Hoovers up the tickets on the ground and grows with them. Bring it down and it pays them all back, with interest.',
  }),
  tidecaller: E({
    id: 'tidecaller', name: 'Tidecaller', hp: 400, speed: 65, contact: 8, tickets: 14,
    behavior: 'tidecaller', radius: 15, sep: 20, knockbackTaken: 0.4, canElite: true, eliteName: 'Herald of the Tide', aquatic: true, maxAlive: 3,
    params: { keep: 440, call: 7, callTele: 1.2, raise: 3, surge: 9, surgeTele: 0.8, surgeSpeed: 270, surgeLen: 380, surgeDmg: 10 },
    deathFx: 'brine', hitSfx: 'gurgle', deathSfx: 'conch', drawScale: 3.6, act: 4, role: 'Summoner',
    lore: 'Old Mother Tide\'s bell-ringer, crowned in shells, draped in the kelp of the drowned pier.',
    tell: 'Rings its bell: the drowned claw up around you. Lifts its staff: a wave line rolls across the boards.',
  }),
  // the Barker's shooting gallery (boss add, never in waves)
  tin_duck: E({
    id: 'tin_duck', name: 'Tin Duck', hp: 22, speed: 150, contact: 10, tickets: 1,
    behavior: 'duckline', radius: 13, sep: 6, knockbackTaken: 0, canElite: false,
    params: { life: 9 },
    deathFx: 'tokens', hitSfx: 'clank', deathSfx: 'ding', drawScale: 2.6, act: 1, role: 'Boss add',
    lore: 'Shot ten thousand times a summer. They kept score.',
    tell: 'March in a row along a lit lane. Knock them down or step aside.',
  }),
  great_barnacle: E({
    id: 'great_barnacle', name: 'The Great Barnacle', hp: 960, speed: 75, contact: 14, tickets: 15,
    behavior: 'barnacle', radius: 30, sep: 34, knockbackTaken: 0.1, canElite: false, dropsChest: true, chestMin: 1, chestMax: 2, aquatic: true,
    shell: { mult: 0.35, soak: 0.45, cracked: 1.2, haste: 1.3 },
    params: { slamEvery: 4.6, slamTele: 1, slamR: 150, slamDmg: 20, range: 200, ring: 1 },
    deathFx: 'shell', hitSfx: 'knock', deathSfx: 'crack', drawScale: 2.8, act: 2, role: 'Miniboss',
    lore: 'Whatever the barnacles grew on first is long gone. They kept the shape.',
    tell: 'Its slam sends a ring of seawater outward — find the gap. Crack its crust and it speeds up.',
  }),
};

/** Enemies shown in the Carnival-pedia (excludes internal adds). */
export const PEDIA_ENEMIES = Object.keys(ENEMIES).filter((k) => k !== 'mini_stuffie');

export type EliteAffix = 'explosive' | 'splitter' | 'hasted' | 'shielded' | 'magnetic';
export const ELITE_AFFIXES: EliteAffix[] = ['explosive', 'splitter', 'hasted', 'shielded', 'magnetic'];
