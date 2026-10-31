// Carnival Events (doc 03 §5, D-16). Timed spice that creates positional decisions.

export type EventId =
  | 'lights_out' | 'funnel_cake' | 'stampede' | 'clown_car' | 'last_ticket' | 'carousel_spins' | 'calliope' | 'formation' | 'mole_brigade'
  // the Fun House (D-63)
  | 'house_lights' | 'mirror_shuffle' | 'laughing_gallery' | 'kaleidoscope'
  // the Boardwalk (D-68)
  | 'fog_bank' | 'rogue_wave' | 'undertow_runs' | 'short_circuit' | 'washed_ashore' | 'ships_light';

export interface EventDef {
  id: EventId;
  name: string;
  banner: string;
  duration: number;
  minAct: number;
  weights: [number, number, number, number]; // per act
  desc: string;
}

export const EVENTS: Record<EventId, EventDef> = {
  lights_out: { id: 'lights_out', name: 'The Lights Go Out', banner: 'THE LIGHTS GO OUT!', duration: 15, minAct: 2, weights: [0, 1, 1.2, 1.2], desc: 'Darkness to your lantern bubble; survive for bonus Tickets.' },
  funnel_cake: { id: 'funnel_cake', name: 'Free Funnel Cake!', banner: 'FREE FUNNEL CAKE!', duration: 12, minAct: 1, weights: [1.2, 1, 1, 0.8], desc: 'Healing treats rain over a marked stall.' },
  stampede: { id: 'stampede', name: 'Stampede!', banner: 'STAMPEDE!', duration: 6, minAct: 2, weights: [0, 0.8, 1.3, 1.3], desc: 'A wall of carousel horses charges a flashing lane.' },
  clown_car: { id: 'clown_car', name: 'Clown Car', banner: 'THE CLOWN CAR HAS ARRIVED!', duration: 3, minAct: 1, weights: [0.6, 1.2, 1, 1], desc: 'An elite clown pack bursts out — clear it for a chest.' },
  last_ticket: { id: 'last_ticket', name: 'Last Ticket', banner: 'THE LAST TICKET — CLAIM IT!', duration: 30, minAct: 1, weights: [0.8, 1, 1, 1], desc: 'A guarded reward chest appears somewhere nearby.' },
  carousel_spins: { id: 'carousel_spins', name: 'Carousel Spins Up', banner: 'THE CAROUSEL SPINS UP!', duration: 18, minAct: 2, weights: [0, 0.9, 1.2, 1], desc: 'The dead carousel flings horses outward in rings.' },
  calliope: { id: 'calliope', name: 'Calliope Crescendo', banner: 'CALLIOPE CRESCENDO!', duration: 20, minAct: 2, weights: [0, 0.6, 1, 1.4], desc: 'All spawn rates +50% — and Tickets +50%.' },
  formation: { id: 'formation', name: 'The Parade Marches', banner: 'THE PARADE MARCHES IN!', duration: 4, minAct: 3, weights: [0, 0, 1, 0.8], desc: 'A marching column of Puppet Soldiers.' },
  mole_brigade: { id: 'mole_brigade', name: 'Mole Brigade', banner: 'MOLE BRIGADE!', duration: 5, minAct: 2, weights: [0, 1, 0.8, 0.6], desc: 'A row of moles pops up in sequence.' },
  house_lights: { id: 'house_lights', name: 'The House Lights Fail', banner: 'THE HOUSE LIGHTS FAIL!', duration: 15, minAct: 2, weights: [0, 1, 1.2, 1.2], desc: 'Darkness to your lantern bubble; survive for bonus Tickets.' },
  mirror_shuffle: { id: 'mirror_shuffle', name: 'The Mirrors Shuffle', banner: 'THE MIRRORS SHUFFLE!', duration: 15, minAct: 2, weights: [0, 1, 1, 1], desc: 'Every pivoting panel in the maze turns every few seconds.' },
  laughing_gallery: { id: 'laughing_gallery', name: 'The Laughing Gallery', banner: 'THE MANNEQUINS ARE LAUGHING!', duration: 4, minAct: 1, weights: [0.8, 1, 1, 0.8], desc: 'A ring of mannequins wakes around you. Keep your eyes on them.' },
  kaleidoscope: { id: 'kaleidoscope', name: 'The Kaleidoscope Turns', banner: 'THE KALEIDOSCOPE TURNS!', duration: 14, minAct: 2, weights: [0, 0.9, 1.2, 1.2], desc: 'The Rotunda\'s mirrored column throws turning beams of light.' },
  fog_bank: { id: 'fog_bank', name: 'The Fog Comes In', banner: 'THE FOG COMES IN!', duration: 16, minAct: 2, weights: [0, 1, 1.2, 1.2], desc: 'Fog off the sea to your lantern bubble, and the Drowned walk in with it. Survive for bonus Tickets.' },
  rogue_wave: { id: 'rogue_wave', name: 'Rogue Wave', banner: 'ROGUE WAVE!', duration: 6, minAct: 1, weights: [0.8, 1, 1, 1], desc: 'A wall of water runs up the beach. Get off the sand, or find where it breaks.' },
  undertow_runs: { id: 'undertow_runs', name: 'The Undertow Runs', banner: 'THE UNDERTOW RUNS!', duration: 4, minAct: 2, weights: [0, 0.8, 1.2, 1], desc: 'Riders spill off the coaster: a pack of Coaster Wraiths.' },
  short_circuit: { id: 'short_circuit', name: 'Short Circuit', banner: 'SHORT CIRCUIT!', duration: 12, minAct: 2, weights: [0, 1, 1, 1], desc: 'Arcs leap between the promenade\'s lamps. Keep clear of the lines.' },
  washed_ashore: { id: 'washed_ashore', name: 'Washed Ashore', banner: 'SOMETHING WASHED ASHORE!', duration: 30, minAct: 1, weights: [0.8, 1, 1, 1], desc: 'A sea-chest on the sand, and what came in with it guarding it.' },
  ships_light: { id: 'ships_light', name: "The Ship's Light", banner: 'A LIGHT OUT ON THE WATER…', duration: 14, minAct: 2, weights: [0, 0.8, 1.1, 1.2], desc: 'A ghost ship\'s searchlight hunts you across the boards. Stay out of the beam.' },
};

export const CARNIVAL_EVENTS: EventId[] = ['lights_out', 'funnel_cake', 'stampede', 'clown_car', 'last_ticket', 'carousel_spins', 'calliope', 'formation', 'mole_brigade'];
export const FUNHOUSE_EVENTS: EventId[] = ['house_lights', 'funnel_cake', 'clown_car', 'last_ticket', 'calliope', 'mirror_shuffle', 'laughing_gallery', 'kaleidoscope'];
export const BOARDWALK_EVENTS: EventId[] = ['fog_bank', 'funnel_cake', 'clown_car', 'last_ticket', 'calliope', 'rogue_wave', 'undertow_runs', 'short_circuit', 'washed_ashore', 'ships_light'];

/** Authored timeline beats (doc 03 §7.4). */
export const CARNIVAL_SCHEDULE: { time: number; id: EventId }[] = [
  { time: 180, id: 'funnel_cake' },
  { time: 480, id: 'clown_car' },
  { time: 900, id: 'formation' },
  { time: 1260, id: 'calliope' },
];
export const FUNHOUSE_SCHEDULE: { time: number; id: EventId }[] = [
  { time: 180, id: 'funnel_cake' },
  { time: 480, id: 'clown_car' },
  { time: 900, id: 'laughing_gallery' },
  { time: 1260, id: 'calliope' },
];
export const BOARDWALK_SCHEDULE: { time: number; id: EventId }[] = [
  { time: 180, id: 'funnel_cake' },
  { time: 480, id: 'washed_ashore' },
  { time: 900, id: 'undertow_runs' },
  { time: 1260, id: 'calliope' },
];

// The active map's pool and beats (maps.ts `useMap`); the Carnival Core by default.
export let EVENT_POOL: EventId[] = CARNIVAL_EVENTS;
export let SCHEDULED_EVENTS: { time: number; id: EventId }[] = CARNIVAL_SCHEDULE;
export function applyEvents(pool: EventId[], scheduled: { time: number; id: EventId }[]): void {
  EVENT_POOL = pool;
  SCHEDULED_EVENTS = scheduled;
}
