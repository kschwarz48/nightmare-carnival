// Map registry (D-63). A map is a floor plan plus everything that differs between nights on it: waves,
// the boss schedule and the boss that holds the dawn, scenery bosses, carnival events, the miniboss,
// the hidden quest chains (registered separately, keyed by the same id) and the renderer's world.
// `useMap` makes one the active map: it swaps the live bindings in map.ts, waves.ts, bosses.ts and
// events.ts, so systems written for one map keep importing the same names.

import { applyLayout, CARNIVAL_LAYOUT, type MapLayout } from './map';
import { FUNHOUSE_LAYOUT } from './funhouse';
import { BOARDWALK_LAYOUT } from './boardwalk';
import { GHOST_TRAIN_LAYOUT } from './gtStations';
import { applyWaves, CARNIVAL_ACTS, CARNIVAL_ENDLESS, CARNIVAL_VICTORY, CARNIVAL_WAVES, FUNHOUSE_ACTS, FUNHOUSE_ENDLESS, FUNHOUSE_VICTORY, FUNHOUSE_WAVES, BOARDWALK_ACTS, BOARDWALK_ENDLESS, BOARDWALK_VICTORY, BOARDWALK_WAVES, GHOST_ACTS, GHOST_ACT_GATES, GHOST_DAWN, GHOST_ENDLESS, GHOST_VICTORY, GHOST_WAVES, type WaveDef } from './waves';
import { applyBossSchedule, BOARDWALK_BOSSES, CARNIVAL_BOSSES, FUNHOUSE_BOSSES, GHOST_BOSSES, type BossDef } from './bosses';
import { applyEvents, BOARDWALK_EVENTS, BOARDWALK_SCHEDULE, CARNIVAL_EVENTS, CARNIVAL_SCHEDULE, FUNHOUSE_EVENTS, FUNHOUSE_SCHEDULE, GHOST_EVENTS, GHOST_SCHEDULE, type EventId } from './events';

export type MapId = 'carnival_core' | 'fun_house' | 'boardwalk' | 'ghost_train';
export const MAP_IDS: MapId[] = ['carnival_core', 'fun_house', 'boardwalk', 'ghost_train'];

export interface MapDef {
  id: MapId;
  name: string;
  /** one line for the map picker */
  tagline: string;
  layout: MapLayout;
  waves: WaveDef[];
  victoryLap: WaveDef;
  endless: WaveDef;
  acts: string[];
  /** when the dawn comes (default 25:00) and when Acts II–IV begin (default 6:00 / 12:00 / 18:00) */
  dawn?: number;
  actGates?: number[];
  /** the scheduled bosses, in gate order */
  bosses: BossDef[];
  /** bosses standing as dormant scenery from the first second (the Big Top and the Ferris Wheel) */
  scenery: BossDef['id'][];
  /** the boss who holds back the dawn (D-01): the night can't end until he falls */
  finalBoss: BossDef['id'];
  /** the miniboss the director sends on `minibossInterval` */
  miniboss: string;
  events: EventId[];
  scheduledEvents: { time: number; id: EventId }[];
  /** the renderer's world builder */
  world: 'carnival' | 'funhouse' | 'boardwalk' | 'ghosttrain';
  /** title card when a night starts */
  intro: { title: string; sub: string };
  /** the hidden quest whose progress the save remembers, and the banner while its finale holds the dawn */
  quest: { id: string; hold: { text: string; sub: string } };
}

export const MAPS: Record<MapId, MapDef> = {
  carnival_core: {
    id: 'carnival_core',
    name: 'The Carnival Core',
    tagline: 'The midway, the Big Top, the Ferris Wheel — where it began.',
    layout: CARNIVAL_LAYOUT,
    waves: CARNIVAL_WAVES,
    victoryLap: CARNIVAL_VICTORY,
    endless: CARNIVAL_ENDLESS,
    acts: CARNIVAL_ACTS,
    bosses: CARNIVAL_BOSSES,
    scenery: ['carnival_tent', 'ferris_wheel'],
    finalBoss: 'ringmaster',
    miniboss: 'carnival_brute',
    events: CARNIVAL_EVENTS,
    scheduledEvents: CARNIVAL_SCHEDULE,
    world: 'carnival',
    intro: { title: 'MIDNIGHT', sub: 'The gates lock behind you…' },
    quest: { id: 'last_song', hold: { text: 'THE CALLIOPE PLAYS ON…', sub: 'The dawn will not come until the song ends' } },
  },
  fun_house: {
    id: 'fun_house',
    name: 'The Fun House',
    tagline: "Professor Grinwell's Palace of Illusions. Trust nothing you see.",
    layout: FUNHOUSE_LAYOUT,
    waves: FUNHOUSE_WAVES,
    victoryLap: FUNHOUSE_VICTORY,
    endless: FUNHOUSE_ENDLESS,
    acts: FUNHOUSE_ACTS,
    bosses: FUNHOUSE_BOSSES,
    scenery: [],
    finalBoss: 'proprietor',
    miniboss: 'grand_mannequin',
    events: FUNHOUSE_EVENTS,
    scheduledEvents: FUNHOUSE_SCHEDULE,
    world: 'funhouse',
    intro: { title: 'ADMIT ONE', sub: 'The doors swing shut. Somewhere, the house is laughing.' },
    quest: { id: 'unreflected', hold: { text: 'THE GLASS HOLDS THE DAWN…', sub: 'Nothing leaves the house while the Unreflected stands' } },
  },
  boardwalk: {
    id: 'boardwalk',
    name: 'The Boardwalk',
    tagline: "Penhallow's Boardwalk, the beach and the pier. Something lives in the water.",
    layout: BOARDWALK_LAYOUT,
    waves: BOARDWALK_WAVES,
    victoryLap: BOARDWALK_VICTORY,
    endless: BOARDWALK_ENDLESS,
    acts: BOARDWALK_ACTS,
    bosses: BOARDWALK_BOSSES,
    scenery: [],
    finalBoss: 'leviathan',
    miniboss: 'great_barnacle',
    events: BOARDWALK_EVENTS,
    scheduledEvents: BOARDWALK_SCHEDULE,
    world: 'boardwalk',
    intro: { title: 'LAST CALL AT THE SHORE', sub: 'The rides are still running. Nobody is running them.' },
    quest: { id: 'summers_end', hold: { text: 'THE TIDE HOLDS THE DAWN…', sub: 'The sea will not give back the morning until the account is closed' } },
  },
  ghost_train: {
    id: 'ghost_train',
    name: 'The Ghost Train',
    tagline: 'The Midnight Line: five stations, one train, and it never waits. The last night of all.',
    layout: GHOST_TRAIN_LAYOUT,
    waves: GHOST_WAVES,
    victoryLap: GHOST_VICTORY,
    endless: GHOST_ENDLESS,
    acts: GHOST_ACTS,
    dawn: GHOST_DAWN,
    actGates: GHOST_ACT_GATES,
    bosses: GHOST_BOSSES,
    scenery: [],
    finalBoss: 'night_express',
    miniboss: 'gt_inspector',
    events: GHOST_EVENTS,
    scheduledEvents: GHOST_SCHEDULE,
    world: 'ghosttrain',
    intro: { title: 'THE MIDNIGHT LINE', sub: 'A whistle in the fog. The last train of the night is coming in.' },
    quest: { id: 'last_train', hold: { text: 'THE LAST TRAIN HOLDS THE DAWN…', sub: 'The morning will not come until every ticket is punched' } },
  },
};

/** What a locked map's button says it takes to open it (the solo picker and the co-op lobby). */
export const MAP_LOCK: Record<MapId, string> = {
  carnival_core: '',
  fun_house: 'Locked — survive the first night',
  boardwalk: 'Locked — survive the Fun House',
  ghost_train: 'Locked — survive the Boardwalk',
};

let active: MapId = 'carnival_core';

/** Make `id` the active map (cheap when it already is). */
export function useMap(id: MapId): void {
  if (id === active) return;
  active = id;
  const m = MAPS[id];
  applyLayout(m.layout);
  applyWaves(m.waves, m.victoryLap, m.endless, m.acts, m.dawn ?? 1500, m.actGates ?? [360, 720, 1080]);
  applyBossSchedule(m.bosses);
  applyEvents(m.events, m.scheduledEvents);
}

export function activeMapId(): MapId {
  return active;
}

export function isMapId(v: unknown): v is MapId {
  return typeof v === 'string' && (MAP_IDS as string[]).includes(v);
}
