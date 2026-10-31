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

/** The Carnival Core's night. (`WAVES` below is the active map's; see maps.ts.) */
export const CARNIVAL_WAVES: WaveDef[] = [
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
export const CARNIVAL_VICTORY: WaveDef = {
  id: 'victory_lap', start: 0, enemies: [['living_balloon', 85], ['mini_stuffie', 15]], minAlive: 150, maxAlive: 280, interval: 0.3, batch: 10,
  swarm: { enemy: 'swarm_balloon', interval: 2.2, size: 60 },
};

/** Endless / Lock-In loops a dense Act IV mix (D-17). */
export const CARNIVAL_ENDLESS: WaveDef = {
  id: 'endless', start: 0,
  enemies: [['roller_coaster_snake', 10], ['carousel_horse', 18], ['bumper_car', 16], ['puppet_soldier', 18], ['evil_clown', 18], ['possessed_stuffie', 12], ['dunk_tank_clown', 8], ['walking_ticket_booth', 4]],
  minAlive: 130, maxAlive: 400, interval: 0.5, batch: 8, swarm: { enemy: 'swarm_balloon', interval: 3, size: 64 }, eliteBurst: 6,
};

export const ACT_GATES = [360, 720, 1080];
export const DAWN_TIME = 1500;
export const CARNIVAL_ACTS = ['Act I — Warm-Up', 'Act II — The Crowd', 'Act III — The Parade', 'Act IV — Last Call'];

// ---------------------------------------------------------------- the Fun House (D-63)
// Same clock and the same crowd curve as the Carnival Core (minimum/maximum alive, interval, batch), so
// the night is as long and as dense; the roster is the house's own: seven new enemies arriving act by
// act, plus clowns, jack-in-the-boxes and balloons.
export const FUNHOUSE_WAVES: WaveDef[] = [
  // Act I — Admission: balloons and marionettes while you find your feet (the first world's balloons and
  // wind-up monkeys); the mannequins step off their stands at 3:00, where the stuffies arrive (D-64)
  { id: 'f_0000', start: 0, enemies: [['living_balloon', 92], ['marionette', 8]], minAlive: 22, maxAlive: 60, interval: 0.8, batch: 3 },
  { id: 'f_0100', start: 60, enemies: [['living_balloon', 70], ['marionette', 30]], minAlive: 22, maxAlive: 85, interval: 1.0, batch: 2 },
  { id: 'f_0200', start: 120, enemies: [['living_balloon', 65], ['marionette', 35]], minAlive: 28, maxAlive: 120, interval: 0.95, batch: 3, swarm: { enemy: 'swarm_balloon', interval: 8, size: 28 } },
  { id: 'f_0300', start: 180, enemies: [['grinning_mannequin', 55], ['living_balloon', 15], ['marionette', 30]], minAlive: 30, maxAlive: 150, interval: 0.9, batch: 3, swarm: { enemy: 'swarm_balloon', interval: 7.5, size: 32 } },
  { id: 'f_0400', start: 240, enemies: [['grinning_mannequin', 50], ['marionette', 22], ['evil_clown', 28]], minAlive: 42, maxAlive: 200, interval: 0.85, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 6, size: 40 } },
  { id: 'f_0500', start: 300, enemies: [['grinning_mannequin', 47], ['evil_clown', 35], ['marionette', 18]], minAlive: 54, maxAlive: 240, interval: 0.8, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 4.5, size: 46 }, eliteBurst: 4 },
  // Act II — The Mirrors: crooked clowns and splitters join (the dunk-tank clowns' and slimes' slots)
  { id: 'f_0600', start: 360, enemies: [['grinning_mannequin', 30], ['evil_clown', 25], ['splitter', 18], ['crooked_clown', 15], ['jack_in_the_box', 12]], minAlive: 60, maxAlive: 220, interval: 0.85, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 6, size: 30 } },
  { id: 'f_0800', start: 480, enemies: [['grinning_mannequin', 26], ['evil_clown', 24], ['splitter', 16], ['jack_in_the_box', 14], ['crooked_clown', 20]], minAlive: 68, maxAlive: 240, interval: 0.8, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 5.5, size: 34 } },
  { id: 'f_1000', start: 600, enemies: [['evil_clown', 26], ['grinning_mannequin', 22], ['crooked_clown', 20], ['marionette', 16], ['jack_in_the_box', 12], ['splitter', 4]], minAlive: 78, maxAlive: 260, interval: 0.75, batch: 5, swarm: { enemy: 'swarm_balloon', interval: 5, size: 38 }, eliteBurst: 3 },
  // Act III — The Gallery Wakes: glasswalkers and doppelgangers (the carousel horses' and soldiers' tier)
  { id: 'f_1200', start: 720, enemies: [['doppelganger', 26], ['glasswalker', 24], ['evil_clown', 26], ['splitter', 12], ['reflection_thief', 12]], minAlive: 80, maxAlive: 270, interval: 0.75, batch: 5, swarm: { enemy: 'swarm_balloon', interval: 5, size: 40 } },
  { id: 'f_1400', start: 840, enemies: [['doppelganger', 24], ['glasswalker', 22], ['grinning_mannequin', 22], ['splitter', 12], ['crooked_clown', 20]], minAlive: 86, maxAlive: 280, interval: 0.7, batch: 5, swarm: { enemy: 'swarm_balloon', interval: 4.5, size: 44 } },
  { id: 'f_1600', start: 960, enemies: [['glasswalker', 26], ['doppelganger', 24], ['evil_clown', 26], ['splitter', 12], ['reflection_thief', 12]], minAlive: 92, maxAlive: 280, interval: 0.68, batch: 6, swarm: { enemy: 'swarm_balloon', interval: 4, size: 48 }, eliteBurst: 4 },
  // Act IV — Closing Time
  { id: 'f_1800', start: 1080, enemies: [['reflection_thief', 14], ['glasswalker', 22], ['doppelganger', 22], ['evil_clown', 26], ['grinning_mannequin', 16]], minAlive: 96, maxAlive: 280, interval: 0.66, batch: 6, swarm: { enemy: 'swarm_balloon', interval: 4, size: 52 } },
  { id: 'f_2000', start: 1260, enemies: [['reflection_thief', 18], ['doppelganger', 22], ['glasswalker', 20], ['evil_clown', 24], ['splitter', 10], ['jack_in_the_box', 6]], minAlive: 100, maxAlive: 280, interval: 0.62, batch: 6, swarm: { enemy: 'swarm_balloon', interval: 3.5, size: 56 }, eliteBurst: 4 },
  { id: 'f_2200', start: 1380, enemies: [['reflection_thief', 20], ['glasswalker', 24], ['doppelganger', 22], ['evil_clown', 24], ['splitter', 10]], minAlive: 108, maxAlive: 280, interval: 0.6, batch: 7, swarm: { enemy: 'swarm_balloon', interval: 3, size: 60 }, eliteBurst: 5 },
  { id: 'f_2400', start: 1440, enemies: [['living_balloon', 62], ['evil_clown', 20], ['grinning_mannequin', 8], ['marionette', 10]], minAlive: 140, maxAlive: 280, interval: 0.5, batch: 8, swarm: { enemy: 'swarm_balloon', interval: 2.5, size: 70 } },
];
export const FUNHOUSE_VICTORY: WaveDef = {
  id: 'f_victory_lap', start: 0, enemies: [['living_balloon', 80], ['marionette', 20]], minAlive: 150, maxAlive: 280, interval: 0.3, batch: 10,
  swarm: { enemy: 'swarm_balloon', interval: 2.2, size: 60 },
};
export const FUNHOUSE_ENDLESS: WaveDef = {
  id: 'f_endless', start: 0,
  enemies: [['doppelganger', 18], ['glasswalker', 18], ['grinning_mannequin', 16], ['splitter', 14], ['crooked_clown', 14], ['marionette', 10], ['reflection_thief', 4], ['evil_clown', 6]],
  minAlive: 130, maxAlive: 400, interval: 0.5, batch: 8, swarm: { enemy: 'swarm_balloon', interval: 3, size: 64 }, eliteBurst: 6,
};
export const FUNHOUSE_ACTS = ['Act I — Admission', 'Act II — The Mirrors', 'Act III — The Gallery Wakes', 'Act IV — Closing Time'];

// ---------------------------------------------------------------- the Boardwalk (D-68)
// Same clock and the same crowd curve again (minimum/maximum alive, interval, batch). The roster is the
// shore's own: crawlers and the drowned come up out of the surf in Act I; the midway's ticket takers, taffy
// and automatons join in Act II; wraiths off the coaster, barnacle brutes, anglers and the prize collector
// in Act III; the tidecallers in Act IV. Balloons, clowns, wind-up monkeys and stuffies keep their places.
export const BOARDWALK_WAVES: WaveDef[] = [
  // Act I — Low Tide
  { id: 'b_0000', start: 0, enemies: [['living_balloon', 90], ['shore_crawler', 10]], minAlive: 22, maxAlive: 60, interval: 0.8, batch: 3 },
  { id: 'b_0100', start: 60, enemies: [['living_balloon', 62], ['shore_crawler', 26], ['wind_up_monkey', 12]], minAlive: 22, maxAlive: 85, interval: 1.0, batch: 2 },
  { id: 'b_0200', start: 120, enemies: [['living_balloon', 58], ['shore_crawler', 30], ['wind_up_monkey', 12]], minAlive: 28, maxAlive: 120, interval: 0.95, batch: 3, swarm: { enemy: 'swarm_balloon', interval: 8, size: 28 } },
  { id: 'b_0300', start: 180, enemies: [['drowned', 50], ['living_balloon', 15], ['shore_crawler', 25], ['possessed_stuffie', 10]], minAlive: 30, maxAlive: 150, interval: 0.9, batch: 3, swarm: { enemy: 'swarm_balloon', interval: 7.5, size: 32 } },
  { id: 'b_0400', start: 240, enemies: [['drowned', 46], ['shore_crawler', 22], ['evil_clown', 24], ['possessed_stuffie', 8]], minAlive: 42, maxAlive: 200, interval: 0.85, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 6, size: 40 } },
  { id: 'b_0500', start: 300, enemies: [['drowned', 44], ['evil_clown', 34], ['shore_crawler', 22]], minAlive: 54, maxAlive: 240, interval: 0.8, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 4.5, size: 46 }, eliteBurst: 4 },
  // Act II — The Midway
  { id: 'b_0600', start: 360, enemies: [['drowned', 32], ['evil_clown', 25], ['taffy_horror', 18], ['ticket_taker', 13], ['arcade_automaton', 12]], minAlive: 60, maxAlive: 220, interval: 0.85, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 6, size: 30 } },
  { id: 'b_0800', start: 480, enemies: [['drowned', 26], ['evil_clown', 24], ['taffy_horror', 16], ['arcade_automaton', 14], ['ticket_taker', 20]], minAlive: 68, maxAlive: 240, interval: 0.8, batch: 4, swarm: { enemy: 'swarm_balloon', interval: 5.5, size: 34 } },
  { id: 'b_1000', start: 600, enemies: [['evil_clown', 26], ['drowned', 22], ['ticket_taker', 20], ['shore_crawler', 16], ['arcade_automaton', 12], ['taffy_horror', 4]], minAlive: 78, maxAlive: 260, interval: 0.75, batch: 5, swarm: { enemy: 'swarm_balloon', interval: 5, size: 38 }, eliteBurst: 3 },
  // Act III — The Undertow
  { id: 'b_1200', start: 720, enemies: [['coaster_wraith', 24], ['barnacle_brute', 24], ['evil_clown', 22], ['lantern_angler', 18], ['prize_collector', 12]], minAlive: 80, maxAlive: 270, interval: 0.75, batch: 5, swarm: { enemy: 'swarm_balloon', interval: 5, size: 40 } },
  { id: 'b_1400', start: 840, enemies: [['lantern_angler', 24], ['coaster_wraith', 22], ['drowned', 22], ['barnacle_brute', 14], ['ticket_taker', 18]], minAlive: 86, maxAlive: 280, interval: 0.7, batch: 5, swarm: { enemy: 'swarm_balloon', interval: 4.5, size: 44 } },
  { id: 'b_1600', start: 960, enemies: [['barnacle_brute', 24], ['coaster_wraith', 22], ['evil_clown', 22], ['lantern_angler', 20], ['prize_collector', 12]], minAlive: 92, maxAlive: 280, interval: 0.68, batch: 6, swarm: { enemy: 'swarm_balloon', interval: 4, size: 48 }, eliteBurst: 4 },
  // Act IV — High Water
  { id: 'b_1800', start: 1080, enemies: [['tidecaller', 14], ['coaster_wraith', 22], ['lantern_angler', 22], ['evil_clown', 22], ['drowned', 20]], minAlive: 96, maxAlive: 280, interval: 0.66, batch: 6, swarm: { enemy: 'swarm_balloon', interval: 4, size: 52 } },
  { id: 'b_2000', start: 1260, enemies: [['tidecaller', 18], ['barnacle_brute', 22], ['lantern_angler', 20], ['evil_clown', 20], ['coaster_wraith', 14], ['arcade_automaton', 6]], minAlive: 100, maxAlive: 280, interval: 0.62, batch: 6, swarm: { enemy: 'swarm_balloon', interval: 3.5, size: 56 }, eliteBurst: 4 },
  { id: 'b_2200', start: 1380, enemies: [['tidecaller', 20], ['coaster_wraith', 22], ['barnacle_brute', 22], ['lantern_angler', 18], ['evil_clown', 18]], minAlive: 108, maxAlive: 280, interval: 0.6, batch: 7, swarm: { enemy: 'swarm_balloon', interval: 3, size: 60 }, eliteBurst: 5 },
  { id: 'b_2400', start: 1440, enemies: [['living_balloon', 60], ['drowned', 22], ['evil_clown', 10], ['shore_crawler', 8]], minAlive: 140, maxAlive: 280, interval: 0.5, batch: 8, swarm: { enemy: 'swarm_balloon', interval: 2.5, size: 70 } },
];
export const BOARDWALK_VICTORY: WaveDef = {
  id: 'b_victory_lap', start: 0, enemies: [['living_balloon', 80], ['shore_crawler', 20]], minAlive: 150, maxAlive: 280, interval: 0.3, batch: 10,
  swarm: { enemy: 'swarm_balloon', interval: 2.2, size: 60 },
};
export const BOARDWALK_ENDLESS: WaveDef = {
  id: 'b_endless', start: 0,
  enemies: [['coaster_wraith', 16], ['barnacle_brute', 16], ['lantern_angler', 16], ['drowned', 14], ['ticket_taker', 12], ['taffy_horror', 8], ['tidecaller', 6], ['evil_clown', 8], ['prize_collector', 4]],
  minAlive: 130, maxAlive: 400, interval: 0.5, batch: 8, swarm: { enemy: 'swarm_balloon', interval: 3, size: 64 }, eliteBurst: 6,
};
export const BOARDWALK_ACTS = ['Act I — Low Tide', 'Act II — The Midway', 'Act III — The Undertow', 'Act IV — High Water'];

// The active map's (maps.ts `useMap`); the Carnival Core by default.
export let WAVES: WaveDef[] = CARNIVAL_WAVES;
export let VICTORY_LAP_WAVE: WaveDef = CARNIVAL_VICTORY;
export let ENDLESS_WAVE: WaveDef = CARNIVAL_ENDLESS;
export let ACT_NAMES: string[] = CARNIVAL_ACTS;
export function applyWaves(w: WaveDef[], victory: WaveDef, endless: WaveDef, acts: string[]): void {
  WAVES = w;
  VICTORY_LAP_WAVE = victory;
  ENDLESS_WAVE = endless;
  ACT_NAMES = acts;
}
