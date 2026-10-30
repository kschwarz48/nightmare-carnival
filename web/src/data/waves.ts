// Wave timeline (doc 03 §7.4/7.6), ported from resources/waves/w_0000..w_2400.tres.
// Exactly one wave is active: the latest-started one whose window contains "now".

export interface WaveDef {
  id: string;
  start: number; // seconds
  enemies: [string, number][]; // [enemyId, weight]
  minAlive: number;
  maxAlive: number;
  interval: number;
  batch: number;
  swarm?: { enemy: string; interval: number; size: number };
  eliteBurst?: number;
}

export const WAVES: WaveDef[] = [
  { id: 'w_0000', start: 0, enemies: [['living_balloon', 100]], minAlive: 22, maxAlive: 60, interval: 0.8, batch: 3 },
  { id: 'w_0100', start: 60, enemies: [['living_balloon', 70], ['wind_up_monkey', 30]], minAlive: 22, maxAlive: 85, interval: 1.0, batch: 2 },
  { id: 'w_0200', start: 120, enemies: [['living_balloon', 65], ['wind_up_monkey', 35]], minAlive: 28, maxAlive: 120, interval: 0.95, batch: 3, swarm: { enemy: 'swarm_balloon', interval: 8, size: 28 } },
  { id: 'w_0300', start: 180, enemies: [['possessed_stuffie', 55], ['living_balloon', 15], ['wind_up_monkey', 30]], minAlive: 30, maxAlive: 150, interval: 0.9, batch: 3, swarm: { enemy: 'swarm_balloon', interval: 7.5, size: 32 } },
  { id: 'w_0400', start: 240, enemies: [['possessed_stuffie', 50], ['wind_up_monkey', 25], ['evil_clown', 25]], minAlive: 42, maxAlive: 200, interval: 0.85, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 6, size: 40 } },
  { id: 'w_0500', start: 300, enemies: [['possessed_stuffie', 45], ['evil_clown', 35], ['wind_up_monkey', 20]], minAlive: 54, maxAlive: 240, interval: 0.8, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 4.5, size: 46 }, eliteBurst: 4 },
  // Act II — The Crowd
  { id: 'w_0600', start: 360, enemies: [['possessed_stuffie', 35], ['evil_clown', 30], ['cotton_candy_slime', 20], ['whack_a_mole', 15]], minAlive: 60, maxAlive: 220, interval: 0.85, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 6, size: 30 } },
  { id: 'w_0800', start: 480, enemies: [['possessed_stuffie', 28], ['evil_clown', 26], ['cotton_candy_slime', 16], ['jack_in_the_box', 12], ['dunk_tank_clown', 18]], minAlive: 68, maxAlive: 240, interval: 0.8, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 5.5, size: 34 } },
  { id: 'w_1000', start: 600, enemies: [['evil_clown', 30], ['possessed_stuffie', 24], ['dunk_tank_clown', 20], ['whack_a_mole', 14], ['jack_in_the_box', 12]], minAlive: 78, maxAlive: 260, interval: 0.75, batch: 5, swarm: { enemy: 'swarm_balloon', interval: 5, size: 38 }, eliteBurst: 3 },
  // Act III — The Parade
  { id: 'w_1200', start: 720, enemies: [['puppet_soldier', 26], ['carousel_horse', 22], ['bumper_car', 20], ['evil_clown', 20], ['walking_ticket_booth', 12]], minAlive: 80, maxAlive: 270, interval: 0.75, batch: 5, swarm: { enemy: 'swarm_balloon', interval: 5, size: 40 } },
  { id: 'w_1400', start: 840, enemies: [['puppet_soldier', 24], ['carousel_horse', 22], ['bumper_car', 20], ['cotton_candy_slime', 16], ['possessed_stuffie', 18]], minAlive: 86, maxAlive: 280, interval: 0.7, batch: 5, swarm: { enemy: 'swarm_balloon', interval: 4.5, size: 44 } },
  { id: 'w_1600', start: 960, enemies: [['carousel_horse', 24], ['puppet_soldier', 22], ['bumper_car', 22], ['evil_clown', 20], ['walking_ticket_booth', 12]], minAlive: 92, maxAlive: 280, interval: 0.68, batch: 6, swarm: { enemy: 'swarm_balloon', interval: 4, size: 48 }, eliteBurst: 4 },
  // Act IV — Last Call
  { id: 'w_1800', start: 1080, enemies: [['roller_coaster_snake', 14], ['carousel_horse', 22], ['puppet_soldier', 22], ['evil_clown', 22], ['possessed_stuffie', 20]], minAlive: 96, maxAlive: 280, interval: 0.66, batch: 6, swarm: { enemy: 'swarm_balloon', interval: 4, size: 52 } },
  { id: 'w_2000', start: 1260, enemies: [['roller_coaster_snake', 18], ['bumper_car', 22], ['puppet_soldier', 22], ['evil_clown', 20], ['carousel_horse', 18], ['jack_in_the_box', 8]], minAlive: 100, maxAlive: 280, interval: 0.62, batch: 6, swarm: { enemy: 'swarm_balloon', interval: 3.5, size: 56 }, eliteBurst: 4 },
  { id: 'w_2200', start: 1380, enemies: [['roller_coaster_snake', 20], ['carousel_horse', 22], ['bumper_car', 22], ['puppet_soldier', 18], ['evil_clown', 18], ['walking_ticket_booth', 6]], minAlive: 108, maxAlive: 280, interval: 0.6, batch: 7, swarm: { enemy: 'swarm_balloon', interval: 3, size: 60 }, eliteBurst: 5 },
  { id: 'w_2400', start: 1440, enemies: [['living_balloon', 70], ['evil_clown', 20], ['possessed_stuffie', 10]], minAlive: 140, maxAlive: 280, interval: 0.5, batch: 8, swarm: { enemy: 'swarm_balloon', interval: 2.5, size: 70 } },
];

/** Victory lap after the Ringmaster falls before 25:00 (D-01). */
export const VICTORY_LAP_WAVE: WaveDef = {
  id: 'victory_lap', start: 0, enemies: [['living_balloon', 85], ['mini_stuffie', 15]], minAlive: 150, maxAlive: 280, interval: 0.3, batch: 10,
  swarm: { enemy: 'swarm_balloon', interval: 2.2, size: 60 },
};

/** Endless / Lock-In loops a dense Act IV mix (D-17). */
export const ENDLESS_WAVE: WaveDef = {
  id: 'endless', start: 0,
  enemies: [['roller_coaster_snake', 10], ['carousel_horse', 18], ['bumper_car', 16], ['puppet_soldier', 18], ['evil_clown', 18], ['possessed_stuffie', 12], ['dunk_tank_clown', 8], ['walking_ticket_booth', 4]],
  minAlive: 130, maxAlive: 400, interval: 0.5, batch: 8, swarm: { enemy: 'swarm_balloon', interval: 3, size: 64 }, eliteBurst: 6,
};

export const ACT_GATES = [360, 720, 1080];
export const DAWN_TIME = 1500;
export const ACT_NAMES = ['Act I — Warm-Up', 'Act II — The Crowd', 'Act III — The Parade', 'Act IV — Last Call'];
