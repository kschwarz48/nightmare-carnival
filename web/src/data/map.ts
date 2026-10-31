// The Carnival Core (doc 03, D-05) — one hand-authored 4400×4400 map. Godot's world.gd layout is the
// spatial reference (Big Top center, Carousel west, Ticket Booth east, Prize Stand SW, stalls SE,
// north fence with three gates). Solids block the PLAYER only; enemies walk through (VS model, doc 03 §3).
// Coordinates: x right, y DOWN (north = negative y), matching the Godot project.
//
// D-63: these exports are the ACTIVE map's layout. They're live bindings, swapped by `applyLayout`
// (through `useMap` in maps.ts) when a run on another map starts; the Carnival Core is the default, so
// everything that imports them keeps working unchanged. Read them at call time, never cache them.

import { LAST_SONG } from './quests';

export let MAP_HALF = 2200;
export let MAP_MIN = -MAP_HALF;
export let MAP_MAX = MAP_HALF;
/** The sea wall: the player can't go further south than this (the Fun House: its south wall). */
export let SEA_Y = 1960;
export let PLAYER_BOUNDS = { minX: -2140, maxX: 2140, minY: -2140, maxY: SEA_Y - 30 };

export type PropKind =
  | 'carousel' | 'ticket_booth' | 'prize_stand' | 'stall_ringtoss' | 'stall_bottles' | 'stall_darts' | 'stall_shooting'
  | 'popcorn_cart' | 'cotton_stand' | 'hotdog_stand' | 'fence_h' | 'fence_v' | 'gate_arch' | 'ferris_base'
  | 'funhouse' | 'coaster_ruin' | 'tilt_a_whirl' | 'lamp' | 'light_pole' | 'barrel' | 'crate' | 'hay' | 'tree_dead'
  | 'trash' | 'balloon_post' | 'bench' | 'strongman_tower' | 'dunk_tank' | 'caravan' | 'pennant_pole' | 'sign_midway'
  | 'bleachers' | 'tent_small' | 'tombstone_prize' | 'clown_statue' | 'rail'
  // The Last Song (D-32): four soul lamps, Zoltana's fortune automaton, the High Striker's mallet pad
  | 'ghost_lamp' | 'fortune_machine' | 'striker_pad'
  // The Fun House (D-63): walls and mirror panels, the rooms' furniture and machinery
  | 'fh_wall' | 'fh_mirror' | 'fh_column' | 'fh_booth' | 'fh_counter' | 'fh_face' | 'fh_poster' | 'fh_barker'
  | 'fh_kaleidoscope' | 'fh_mannequin' | 'fh_plinth' | 'fh_marionette_rack' | 'fh_musicbox' | 'fh_projector'
  | 'fh_curtain' | 'fh_stage' | 'fh_clock' | 'fh_vanity' | 'fh_crystal' | 'fh_mark' | 'fh_mural' | 'fh_bench'
  | 'fh_piston' | 'fh_pivot' | 'fh_lamp' | 'fh_rope' | 'fh_trunk' | 'fh_chandelier';

export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  /** Collision: circle radius (r) or AABB half extents (hw/hh). None = decorative. */
  r?: number;
  hw?: number;
  hh?: number;
  w?: number; // visual width/length for stretchable props (fences, walls)
  flip?: boolean;
  variant?: number;
  label?: string;
  /** Fun House walls: style (deco, mirror, crooked, gallery, curtain, door) and which side shows glass */
  style?: string;
  /** decorative yaw (radians) */
  yaw?: number;
}

const props: Prop[] = [];
const add = (p: Prop) => props.push(p);

// --- Landmarks (Godot reference positions) ---
add({ kind: 'carousel', x: -990, y: -150, r: 175 });
add({ kind: 'ticket_booth', x: 1090, y: 340, hw: 100, hh: 80 });
add({ kind: 'prize_stand', x: -1195, y: 660, hw: 125, hh: 70 });
add({ kind: 'stall_ringtoss', x: 415, y: 865, hw: 95, hh: 60 });
add({ kind: 'stall_bottles', x: 795, y: 865, hw: 95, hh: 60 });
add({ kind: 'stall_darts', x: 605, y: 1205, hw: 95, hh: 60 });
add({ kind: 'ferris_base', x: 1250, y: -1720, hw: 150, hh: 46 });
add({ kind: 'funhouse', x: -1350, y: -1720, hw: 230, hh: 110 });
add({ kind: 'coaster_ruin', x: -150, y: -1840, w: 900 });
add({ kind: 'tilt_a_whirl', x: -380, y: -1520 });
add({ kind: 'strongman_tower', x: 520, y: -1560, hw: 40, hh: 30 });
add({ kind: 'bleachers', x: 640, y: 400, hw: 150, hh: 40 });

// West game row
add({ kind: 'stall_shooting', x: -1780, y: -620, hw: 110, hh: 65 });
add({ kind: 'dunk_tank', x: -1780, y: -200, r: 70 });
add({ kind: 'stall_ringtoss', x: -1780, y: 230, hw: 95, hh: 60, variant: 1 });
add({ kind: 'caravan', x: -1700, y: 1150, hw: 130, hh: 60 });
add({ kind: 'caravan', x: -1250, y: 1300, hw: 130, hh: 60, flip: true });

// East concession row
add({ kind: 'popcorn_cart', x: 1720, y: -520, r: 48 });
add({ kind: 'cotton_stand', x: 1760, y: -140, hw: 80, hh: 55 });
add({ kind: 'hotdog_stand', x: 1720, y: 760, hw: 85, hh: 55 });
add({ kind: 'popcorn_cart', x: 1500, y: 1180, r: 48 });
add({ kind: 'tent_small', x: 1780, y: 1500, r: 110 });
add({ kind: 'tent_small', x: -560, y: 1250, r: 100, variant: 1 });
add({ kind: 'clown_statue', x: 0, y: -980, r: 40 });

// North fence with three gates (Godot: y=-1150, gaps at x=-1000/0/1000, 240 wide)
const FENCE_Y = -1150;
for (const [a, b] of [[-2140, -1120], [-880, -120], [120, 880], [1120, 2140]]) {
  add({ kind: 'fence_h', x: (a + b) / 2, y: FENCE_Y, hw: (b - a) / 2, hh: 18, w: b - a });
}
for (const gx of [-1000, 0, 1000]) add({ kind: 'gate_arch', x: gx, y: FENCE_Y, label: gx === 0 ? 'MIDWAY' : gx < 0 ? 'GATE 1' : 'GATE 3' });

// Perimeter wrought-iron fence (visual; bounds also enforced by PLAYER_BOUNDS)
add({ kind: 'fence_h', x: 0, y: -2170, w: 4400 });
add({ kind: 'fence_v', x: -2170, y: -100, w: 4140 });
add({ kind: 'fence_v', x: 2170, y: -100, w: 4140 });
// Sea-wall railing along the plank promenade
add({ kind: 'rail', x: 0, y: SEA_Y - 6, w: 4400 });

// Street furniture (deterministic scatter, authored seeds)
const lampSpots: [number, number][] = [
  [-260, -420], [260, -420], [-430, 0], [430, 0], [-260, 420], [260, 420],
  [-140, -800], [140, -800], [-140, 900], [140, 900], [-140, 1450], [140, 1450],
  [-700, 120], [700, -120], [-1400, -150], [1400, 340], [-1500, 650], [1300, 850],
  [-1000, -1350], [1000, -1350], [0, -1400], [-1800, 1650], [-900, 1650], [900, 1650], [1800, 1650],
  [-1650, -1000], [1650, -1000], [1700, 300], [-1650, 900], [-700, -1900], [700, -1950],
];
const isSoulLamp = (x: number, y: number) => LAST_SONG.lamps.some((l) => l.x === x && l.y === y);
for (const [x, y] of lampSpots) add({ kind: isSoulLamp(x, y) ? 'ghost_lamp' : 'lamp', x, y, r: 10 });
add({ kind: 'fortune_machine', x: LAST_SONG.machine.x, y: LAST_SONG.machine.y, r: 34 });
add({ kind: 'striker_pad', x: LAST_SONG.striker.padX, y: LAST_SONG.striker.padY });

const decor: [PropKind, number, number, number?][] = [
  ['barrel', -620, -620], ['barrel', -660, -600], ['crate', -600, -560], ['hay', 640, -640], ['hay', 690, -610],
  ['crate', 1450, -900], ['barrel', 1490, -880], ['tree_dead', -1950, -1500], ['tree_dead', 1950, -1300], ['tree_dead', -1900, 1350],
  ['tree_dead', 2000, 300], ['tree_dead', -900, -1980], ['tree_dead', 1700, -2000], ['trash', 300, 200], ['trash', -350, 640],
  ['trash', 900, -300], ['trash', -1150, 1000], ['trash', 1250, 1450], ['balloon_post', 220, 820], ['balloon_post', 990, 850],
  ['balloon_post', -1400, 600], ['bench', -300, 1550], ['bench', 300, 1550], ['bench', 1200, 1600], ['bench', -1300, 1600],
  ['hay', -1500, -1300], ['hay', -1460, -1270], ['crate', 1650, 1180], ['crate', 1690, 1210], ['barrel', -1550, 400],
  ['pennant_pole', -480, -480], ['pennant_pole', 480, -480], ['pennant_pole', -480, 480], ['pennant_pole', 480, 480],
  ['tombstone_prize', -1900, 1850], ['tombstone_prize', 1950, 1850], ['sign_midway', 0, -1260], ['trash', -50, 1300],
  ['barrel', 800, 1450], ['crate', -800, 1480], ['hay', 1900, -700], ['hay', -1950, -900], ['tree_dead', 600, -2050],
  ['trash', -1700, -1450], ['crate', 1100, -1500], ['barrel', 1950, 1100], ['trash', 520, -900], ['trash', -560, -1000],
];
for (const [kind, x, y, variant] of decor) {
  const solid = kind === 'barrel' || kind === 'crate' || kind === 'hay' || kind === 'tree_dead' || kind === 'bench';
  add({ kind, x, y, variant, r: solid ? (kind === 'tree_dead' ? 22 : kind === 'bench' ? 0 : 20) : undefined });
}

export let PROPS: Prop[] = props;

/** String-light runs between anchor points (visual + light pools). */
export let STRING_LIGHTS: [number, number, number, number][] = [
  [-260, -420, 260, -420], [-430, 0, -260, -420], [260, -420, 430, 0], [-430, 0, -260, 420], [430, 0, 260, 420], [-260, 420, 260, 420],
  [-140, -800, 140, -800], [-140, 900, 140, 900], [-140, 1450, 140, 1450], [-140, -800, -260, -420], [140, -800, 260, -420],
  [-1400, -150, -700, 120], [700, -120, 1400, 340], [-1000, -1350, 0, -1400], [0, -1400, 1000, -1350],
  [-1800, 1650, -900, 1650], [-900, 1650, -140, 1450], [140, 1450, 900, 1650], [900, 1650, 1800, 1650],
  [-1650, -1000, -1000, -1350], [1000, -1350, 1650, -1000], [1700, 300, 1400, 340], [-1650, 900, -1500, 650],
];

export interface LightDef {
  x: number; y: number; r: number; color: [number, number, number]; intensity: number; flicker: number;
}

/** Light pools (doc 02 §3). Flicker 0..1 = how much it sputters. */
export let LIGHTS: LightDef[] = [
  { x: 0, y: 0, r: 620, color: [1.0, 0.82, 0.55], intensity: 0.9, flicker: 0.05 },
  { x: -990, y: -150, r: 430, color: [1.0, 0.55, 0.8], intensity: 0.9, flicker: 0.25 },
  { x: 1090, y: 340, r: 330, color: [0.55, 0.85, 1.0], intensity: 0.85, flicker: 0.15 },
  { x: -1195, y: 660, r: 300, color: [1.0, 0.45, 0.75], intensity: 0.8, flicker: 0.3 },
  { x: 605, y: 1000, r: 420, color: [1.0, 0.75, 0.45], intensity: 0.85, flicker: 0.1 },
  { x: 1250, y: -1650, r: 560, color: [1.0, 0.35, 0.35], intensity: 0.75, flicker: 0.2 },
  { x: -1350, y: -1650, r: 420, color: [0.5, 1.0, 0.6], intensity: 0.7, flicker: 0.4 },
  { x: -380, y: -1520, r: 330, color: [0.7, 0.5, 1.0], intensity: 0.7, flicker: 0.3 },
  { x: 1740, y: -320, r: 380, color: [1.0, 0.85, 0.5], intensity: 0.8, flicker: 0.12 },
  { x: 1720, y: 800, r: 320, color: [1.0, 0.6, 0.35], intensity: 0.8, flicker: 0.15 },
  { x: -1780, y: -200, r: 420, color: [0.45, 0.8, 1.0], intensity: 0.75, flicker: 0.2 },
  { x: 0, y: -1150, r: 330, color: [1.0, 0.8, 0.5], intensity: 0.75, flicker: 0.1 },
  { x: -1000, y: -1150, r: 260, color: [1.0, 0.7, 0.5], intensity: 0.6, flicker: 0.3 },
  { x: 1000, y: -1150, r: 260, color: [1.0, 0.7, 0.5], intensity: 0.6, flicker: 0.3 },
  { x: 0, y: 1650, r: 520, color: [0.6, 0.75, 1.0], intensity: 0.65, flicker: 0.05 },
  { x: -1300, y: 1650, r: 420, color: [1.0, 0.75, 0.5], intensity: 0.6, flicker: 0.2 },
  { x: 1300, y: 1650, r: 420, color: [1.0, 0.75, 0.5], intensity: 0.6, flicker: 0.2 },
  { x: -1450, y: 1220, r: 340, color: [0.95, 0.6, 0.4], intensity: 0.55, flicker: 0.35 },
  { x: 1780, y: 1500, r: 320, color: [0.8, 0.45, 1.0], intensity: 0.6, flicker: 0.25 },
  { x: 520, y: -1560, r: 260, color: [1.0, 0.9, 0.4], intensity: 0.6, flicker: 0.2 },
];

/** Paths painted on the ground: polylines with width (midway avenues, plaza ring, promenade). */
export type PathDef = { pts: [number, number][]; w: number; style: 'dirt' | 'planks' | 'cobble' };
export let PATHS: PathDef[] = [
  { pts: [[0, -2100], [0, -1150], [0, -420]], w: 230, style: 'dirt' },
  { pts: [[0, 420], [0, 1100], [0, 1700]], w: 230, style: 'dirt' },
  { pts: [[-2100, 0], [-1200, 0], [-430, 0]], w: 200, style: 'dirt' },
  { pts: [[430, 0], [1100, 120], [2100, 120]], w: 200, style: 'dirt' },
  { pts: [[-1000, -1150], [-1000, -700], [-700, -380]], w: 170, style: 'dirt' },
  { pts: [[1000, -1150], [1000, -700], [700, -380]], w: 170, style: 'dirt' },
  { pts: [[-1000, -1400], [-1000, -2100]], w: 150, style: 'dirt' },
  { pts: [[1000, -1400], [1250, -1650]], w: 150, style: 'dirt' },
  { pts: [[350, 520], [600, 1000], [800, 1500]], w: 160, style: 'dirt' },
  { pts: [[-350, 520], [-900, 900], [-1300, 1300]], w: 160, style: 'dirt' },
];
/** The plaza ring around the Big Top. */
export let PLAZA = { x: 0, y: 0, r: 470 };
/** Promenade (boardwalk planks) strip. */
export let PROMENADE = { y0: 1700, y1: SEA_Y };

/** Fixed hazard: the Tilt-a-Whirl's rotating arm (doc 03 §4). */
export let TILT_A_WHIRL: { x: number; y: number; armLen: number; period: number } | null = { x: -380, y: -1520, armLen: 260, period: 7 };
/** Popcorn grease slicks near carts (slide = reduced friction). */
export let GREASE_SLICKS: { x: number; y: number; r: number }[] = [
  { x: 1690, y: -430, r: 90 }, { x: 1470, y: 1100, r: 80 }, { x: 1650, y: 680, r: 70 },
];

/** Player spawn: just south of the Big Top plaza, facing the tent. */
export let PLAYER_SPAWN = { x: 0, y: 330 };

/**
 * Walls that come and go during a night (D-63): the Fun House's pivoting mirror panels (a pure function
 * of sim time) and doors its hidden quest opens. Rebuilt every tick by the map's own logic, on the host
 * and in a guest's mirror alike, so prediction collides with the same walls. Empty on the Carnival Core.
 */
export let DYNAMIC_WALLS: Prop[] = [];
export function setDynamicWalls(w: Prop[]): void {
  DYNAMIC_WALLS = w;
}

/** Everything a map's floor plan defines (D-63). */
export interface MapLayout {
  half: number;
  seaY: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  spawn: { x: number; y: number };
  props: Prop[];
  stringLights: [number, number, number, number][];
  lights: LightDef[];
  paths: PathDef[];
  plaza: { x: number; y: number; r: number };
  promenade: { y0: number; y1: number };
  tiltAWhirl: { x: number; y: number; armLen: number; period: number } | null;
  greaseSlicks: { x: number; y: number; r: number }[];
}

/** The Carnival Core's layout, as declared above. */
export const CARNIVAL_LAYOUT: MapLayout = {
  half: MAP_HALF, seaY: SEA_Y, bounds: { ...PLAYER_BOUNDS }, spawn: { ...PLAYER_SPAWN }, props: PROPS, stringLights: STRING_LIGHTS,
  lights: LIGHTS, paths: PATHS, plaza: { ...PLAZA }, promenade: { ...PROMENADE }, tiltAWhirl: TILT_A_WHIRL, greaseSlicks: GREASE_SLICKS,
};

/** Make `l` the active layout (see the note at the top). */
export function applyLayout(l: MapLayout): void {
  MAP_HALF = l.half;
  MAP_MIN = -l.half;
  MAP_MAX = l.half;
  SEA_Y = l.seaY;
  PLAYER_BOUNDS = { ...l.bounds };
  PLAYER_SPAWN = { ...l.spawn };
  PROPS = l.props;
  STRING_LIGHTS = l.stringLights;
  LIGHTS = l.lights;
  PATHS = l.paths;
  PLAZA = { ...l.plaza };
  PROMENADE = { ...l.promenade };
  TILT_A_WHIRL = l.tiltAWhirl;
  GREASE_SLICKS = l.greaseSlicks;
  DYNAMIC_WALLS = [];
}
