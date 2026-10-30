// Carnival Events (doc 03 §5, D-16). Timed spice that creates positional decisions.

export type EventId =
  | 'lights_out' | 'funnel_cake' | 'stampede' | 'clown_car' | 'last_ticket' | 'carousel_spins' | 'calliope' | 'formation' | 'mole_brigade';

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
};

/** Authored timeline beats (doc 03 §7.4). */
export const SCHEDULED_EVENTS: { time: number; id: EventId }[] = [
  { time: 180, id: 'funnel_cake' },
  { time: 480, id: 'clown_car' },
  { time: 900, id: 'formation' },
  { time: 1260, id: 'calliope' },
];
