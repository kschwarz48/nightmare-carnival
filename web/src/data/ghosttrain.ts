// The Ghost Train (D-80): the Midnight Line, the fourth map. Five stations and the moving train are separate
// places ("regions") far apart in one world; each station has a parked copy of the train's carriages on its
// track, and the transit region holds one more. The train is a timetable: a pure function of sim time and one
// replicated number (`eFrom`, when the End of the Line becomes a stop), so a guest predicts the same doors
// and the same train as the host. At departure the host moves everything inside a station's copy into the
// transit copy, and at arrival into the next station's (sim/ghosttrain.ts). Design: docs/GHOST_TRAIN.md.
// Coordinates: x east, y south (sim space); the train runs east, its locomotive at the east end.

import type { LightDef, MapLayout, Prop } from './map';

// ---------------------------------------------------------------- the places
export interface Region {
  id: 'junction' | 'vesper' | 'cinder' | 'stillwater' | 'end' | 'transit';
  name: string;
  /** a short name for boards and whispers */
  short: string;
  cx: number;
  cy: number;
}
export const REGIONS: Region[] = [
  { id: 'junction', name: 'Hollow Junction', short: 'HOLLOW JCT.', cx: 0, cy: 0 },
  { id: 'vesper', name: "Saint Vesper's Halt", short: "ST. VESPER'S", cx: 6400, cy: 0 },
  { id: 'cinder', name: 'The Cinder Works', short: 'CINDER WORKS', cx: 0, cy: 4800 },
  { id: 'stillwater', name: 'Stillwater', short: 'STILLWATER', cx: 6400, cy: 4800 },
  { id: 'end', name: 'The End of the Line', short: 'END OF THE LINE', cx: 0, cy: 9600 },
  { id: 'transit', name: 'The Midnight Line', short: 'IN TRANSIT', cx: 6400, cy: 9600 },
];
export const J = 0, V = 1, C = 2, S = 3, E = 4, TRANSIT = 5;
/** a station region's half extents */
export const REGION_HW = 2300, REGION_HH = 1300;

/** The region containing (x, y), or -1 in the dark between them. */
export function regionAt(x: number, y: number): number {
  for (let i = 0; i < REGIONS.length; i++) {
    const r = REGIONS[i];
    if (Math.abs(x - r.cx) <= REGION_HW + 200 && Math.abs(y - r.cy) <= REGION_HH + 200) return i;
  }
  return -1;
}

/** The track's centre line in a station region (the train stands on it, the platform south of it). */
export const trackY = (r: number) => REGIONS[r].cy - 1000;

// ---------------------------------------------------------------- the train
/**
 * The carriages in the train's own frame: x along it (east, the front, positive), y across it (south, the
 * platform side, positive). Walkable interiors are 220 across; gangways 100. The locomotive (not walkable)
 * stands east of the tender.
 */
export const TRAIN = { halfW: 110, wallT: 12, gangHalf: 50, rear: -1690, front: 1690, loco0: 1700, locoFront: 2300, dx: -305, doorW: 84 };
export type CarId = 'tender' | 'baggage' | 'coach' | 'dining' | 'funeral' | 'sleeper' | 'observation';
export interface CarDef { id: CarId; name: string; x0: number; x1: number; doors: number[] }
export const CARS: CarDef[] = [
  { id: 'tender', name: 'the tender', x0: 1390, x1: 1690, doors: [1540] },
  { id: 'baggage', name: 'the baggage car', x0: 900, x1: 1360, doors: [1010, 1250] },
  { id: 'coach', name: 'the coach', x0: 390, x1: 870, doors: [470, 790] },
  { id: 'dining', name: 'the dining car', x0: -120, x1: 360, doors: [-40, 280] },
  { id: 'funeral', name: 'Car 13', x0: -610, x1: -150, doors: [-380] },
  { id: 'sleeper', name: 'the sleeper', x0: -1120, x1: -640, doors: [-1040, -720] },
  { id: 'observation', name: 'the observation car', x0: -1690, x1: -1150, doors: [-1290] },
];
/** where the observation car's open rear platform begins (west of here: railings, the night) */
export const REAR_PLATFORM_X = -1570;
/** Where enemies board a moving train: out of the tender's coal, and over the rear platform's railing. */
export const MOUTHS = { front: { x: 1662, y: 0 }, rear: { x: -1668, y: 0 } };

/** The world position of a region's copy of the train (its local origin). */
export function trainOrigin(r: number): { x: number; y: number } {
  const g = REGIONS[r];
  return { x: g.cx + TRAIN.dx, y: r === TRANSIT ? g.cy : trackY(r) };
}

/** Is local (lx, ly) inside a carriage or gangway (the walkable train)? */
export function inTrainLocal(lx: number, ly: number, m = 0): boolean {
  if (lx < TRAIN.rear - m || lx > TRAIN.front + m || Math.abs(ly) > TRAIN.halfW + m) return false;
  for (const c of CARS) if (lx >= c.x0 - m && lx <= c.x1 + m) return true;
  return Math.abs(ly) <= TRAIN.gangHalf + m; // between cars: the gangway
}

/** Is world (x, y) inside region r's copy of the train (its whole footprint, walls included)? */
export function inCopy(r: number, x: number, y: number, m = 8): boolean {
  const o = trainOrigin(r);
  return x >= o.x + TRAIN.rear - m && x <= o.x + TRAIN.front + m && Math.abs(y - o.y) <= TRAIN.halfW + TRAIN.wallT + m;
}

/** The car at local x (or null in a gangway / outside). */
export function carAtLocal(lx: number): CarDef | null {
  for (const c of CARS) if (lx >= c.x0 && lx <= c.x1) return c;
  return null;
}

// ---------------------------------------------------------------- the timetable
export const DWELL = [45, 40, 40, 40, 50];
/** seconds between neighbouring stations, and Stillwater to the Junction running through the End of the Line */
export const LEG = 35, PASS_LEG = 60;
/** the train pulls into the Junction this far into the night (out of the fog) */
export const FIRST_ARRIVAL = 30;
/** the final act: from here every loop stops at the End of the Line */
export const FINAL_ACT = 1500;
/** the last train: the first arrival at the End of the Line at or after this terminates there (the train stays) */
export const TERMINUS_FROM = 1560;
/** the phantom doors at the other stations open (straight to the End of the Line), and the final boss comes */
export const PHANTOM_AT = 1740, FINAL_BOSS_AT = 1800;
/** doors open this long after a stop, and close this long before departure */
export const DOOR_OPEN_AFTER = 2, DOOR_CLOSE_BEFORE = 3;
/** the speed profile: seconds pulling out (accelerating) and braking in; the cruise speed (units/s) */
export const ACCEL = 7, BRAKE = 8, CRUISE = 720;

export interface TrainState {
  /** approaching the Junction at the night's start, standing at a station, or between stations */
  phase: 'approach' | 'dwell' | 'travel';
  /** dwell/approach: the station; travel: the station left */
  at: number;
  /** travel/approach: the station ahead; dwell: the next stop */
  to: number;
  /** seconds into this phase, and its length */
  t: number;
  len: number;
  /** travel: how far along the leg (0..1), eased out of one station and into the next */
  k: number;
  /** travel: units along the leg so far, and its length */
  dist: number;
  legDist: number;
  /** this leg runs through the End of the Line without stopping */
  passing: boolean;
  doors: boolean;
  /** dwell: seconds to departure (Infinity otherwise) */
  departIn: number;
  /** travel/approach: seconds to arrival (Infinity otherwise) */
  arriveIn: number;
  /** which loop (0 from the first arrival) */
  loop: number;
}

/** Units along a leg of `len` seconds after `t` (accelerate, cruise, brake; length CRUISE x (len - (ACCEL+BRAKE)/2)). */
export function legDistance(t: number, len: number): number {
  const v = CRUISE, a = ACCEL, b = BRAKE, tt = Math.max(0, Math.min(len, t));
  const cruiseEnd = len - b;
  if (tt <= a) return (v * tt * tt) / (2 * a);
  if (tt <= cruiseEnd) return (v * a) / 2 + v * (tt - a);
  const r = len - tt;
  return legLength(len) - (v * r * r) / (2 * b);
}
export function legLength(len: number): number {
  return CRUISE * (len - (ACCEL + BRAKE) / 2);
}
/** The train's speed (units/s) `t` into a leg of `len` seconds. */
export function legSpeed(t: number, len: number): number {
  if (t <= 0 || t >= len) return 0;
  if (t < ACCEL) return (CRUISE * t) / ACCEL;
  if (t > len - BRAKE) return (CRUISE * (len - t)) / BRAKE;
  return CRUISE;
}

function dwellState(at: number, t: number, loop: number, to: number): TrainState {
  const len = DWELL[at];
  const departIn = len - t;
  return { phase: 'dwell', at, to, t, len, k: 0, dist: 0, legDist: 0, passing: false, doors: t >= DOOR_OPEN_AFTER && departIn > DOOR_CLOSE_BEFORE, departIn, arriveIn: Infinity, loop };
}
function travelState(at: number, to: number, t: number, len: number, loop: number, passing: boolean): TrainState {
  const D = legLength(len), d = legDistance(t, len);
  return { phase: 'travel', at, to, t, len, k: d / D, dist: d, legDist: D, passing, doors: false, departIn: Infinity, arriveIn: len - t, loop };
}

/**
 * Where the train is at sim time `t`. `eFrom`: the End of the Line is a stop on any loop whose departure from
 * Stillwater comes at or after it (the final act, or earlier once the hidden quest throws the points).
 */
export function trainAt(t: number, eFrom = FINAL_ACT): TrainState {
  if (t < FIRST_ARRIVAL) {
    const len = FIRST_ARRIVAL, D = legLength(len), d = legDistance(t, len);
    return { phase: 'approach', at: J, to: J, t, len, k: d / D, dist: d, legDist: D, passing: false, doors: false, departIn: Infinity, arriveIn: len - t, loop: -1 };
  }
  let s = FIRST_ARRIVAL;
  for (let loop = 0; loop < 200; loop++) {
    for (let st = 0; st < 4; st++) {
      const d = DWELL[st];
      const stopE = st === S && s + d >= eFrom;
      if (t < s + d) return dwellState(st, t - s, loop, st < S ? st + 1 : stopE ? E : J);
      s += d;
      if (st < S) {
        if (t < s + LEG) return travelState(st, st + 1, t - s, LEG, loop, false);
        s += LEG;
      } else if (!stopE) {
        if (t < s + PASS_LEG) return travelState(S, J, t - s, PASS_LEG, loop, true);
        s += PASS_LEG;
      } else {
        if (t < s + LEG) return travelState(S, E, t - s, LEG, loop, false);
        s += LEG;
        // the last train of the night: it terminates at the End of the Line and stands there, doors open
        if (s >= TERMINUS_FROM) return { ...dwellState(E, t - s, loop, E), len: Infinity, departIn: Infinity, doors: t - s >= DOOR_OPEN_AFTER };
        if (t < s + DWELL[E]) return dwellState(E, t - s, loop, J);
        s += DWELL[E];
        if (t < s + LEG) return travelState(E, J, t - s, LEG, loop, false);
        s += LEG;
      }
    }
  }
  return dwellState(J, 0, 0, V);
}

/** The next time (after `t`) the train arrives at station `st`, and whether it will stop (looking ahead `horizon` s). */
export function nextArrival(st: number, t: number, eFrom = FINAL_ACT, horizon = 900): number {
  // step forward phase by phase (cheap: a few dozen at most)
  let now = t, guard = 0;
  while (guard++ < 64 && now < t + horizon) {
    const s = trainAt(now, eFrom);
    if (s.phase === 'dwell' && s.at === st && now > t) return now - s.t;
    if ((s.phase === 'travel' || s.phase === 'approach') && s.to === st && !(s.passing && st === E)) return now + s.arriveIn;
    now += (s.phase === 'dwell' ? s.departIn : s.arriveIn) + 0.01;
  }
  return Infinity;
}

// ---------------------------------------------------------------- the carriages' walls and furniture
/** One solid piece in the train's frame (a circle `r` or a box `hw` x `hh`), with what it is. */
interface Piece { kind: string; x: number; y: number; r?: number; hw?: number; hh?: number; variant?: number; yaw?: number }

/** The carriages' shells: north and south walls (doors cut in the south), end walls with gangways, gangway sides. */
function shellPieces(withDoors: boolean): Piece[] {
  const out: Piece[] = [];
  const W = TRAIN.halfW, T = TRAIN.wallT, G = TRAIN.gangHalf;
  const wallY = W + T / 2;
  for (let i = 0; i < CARS.length; i++) {
    const c = CARS[i];
    out.push({ kind: 'gt_wall', x: (c.x0 + c.x1) / 2, y: -wallY, hw: (c.x1 - c.x0) / 2 + T / 2, hh: T / 2 });
    // the south wall, cut at the doors
    const cuts = withDoors ? c.doors.map((d) => [d - TRAIN.doorW / 2, d + TRAIN.doorW / 2]).sort((a, b) => a[0] - b[0]) : [];
    let a = c.x0 - T / 2;
    for (const [d0, d1] of [...cuts, [c.x1 + T / 2, c.x1 + T / 2]]) {
      if (d0 - a > 2) out.push({ kind: 'gt_wall', x: (a + d0) / 2, y: wallY, hw: (d0 - a) / 2, hh: T / 2 });
      a = d1;
    }
    // end walls: closed at the train's two ends (the locomotive; the rear platform's railing), a gangway elsewhere
    for (const [x, open] of [[c.x0, i < CARS.length - 1], [c.x1, i > 0]] as [number, boolean][]) {
      if (!open) out.push({ kind: 'gt_wall', x, y: 0, hw: T / 2, hh: W + T });
      else for (const s of [-1, 1]) out.push({ kind: 'gt_wall', x, y: s * (G + (W - G) / 2 + T / 2), hw: T / 2, hh: (W - G) / 2 + T / 2 });
    }
    // the gangway to the next car west: its two sides
    if (i < CARS.length - 1) {
      const n = CARS[i + 1];
      for (const s of [-1, 1]) out.push({ kind: 'gt_wall', x: (n.x1 + c.x0) / 2, y: s * (G + T / 2), hw: (c.x0 - n.x1) / 2, hh: T / 2 });
    }
  }
  return out;
}

/** What stands inside each car (solid): coal, trunks, seats, tables, the catafalque, the compartments, armchairs. */
function furniturePieces(): Piece[] {
  const out: Piece[] = [];
  const add = (p: Piece) => out.push(p);
  // the tender: heaps of coal down the middle, a lane along either side (the firebox at its east end)
  for (const [x, y, r] of [[1450, -40, 38], [1530, 48, 34], [1600, -30, 30]] as [number, number, number][]) add({ kind: 'gt_coal', x, y, r });
  // the baggage car: trunks and crates in staggered stacks
  for (const [x, y, hw, hh, v] of [[940, -66, 34, 30, 0], [1080, 58, 44, 34, 1], [1150, -54, 30, 42, 2], [1300, 40, 36, 30, 0], [1210, 82, 26, 18, 3], [990, 76, 22, 22, 3]] as [number, number, number, number, number][]) add({ kind: 'gt_luggage', x, y, hw, hh, variant: v });
  // the coach: seat pairs along both walls, a clear aisle and the doorways kept open
  for (let x = 430; x <= 840; x += 68) {
    for (const s of [-1, 1]) {
      if (s > 0 && CARS[2].doors.some((d) => Math.abs(d - x) < 60)) continue;
      add({ kind: 'gt_seat', x, y: s * 84, hw: 20, hh: 24, variant: s > 0 ? 1 : 0 });
    }
  }
  // the dining car: tables in two rows with a lamp each, a wider middle
  for (let x = -80; x <= 330; x += 104) {
    for (const s of [-1, 1]) {
      if (s > 0 && CARS[3].doors.some((d) => Math.abs(d - x) < 56)) continue;
      add({ kind: 'gt_table', x, y: s * 70, hw: 26, hh: 22, variant: s > 0 ? 1 : 0 });
    }
  }
  // Car 13: the catafalque in the middle (two lanes round it), a candle stand at each corner
  add({ kind: 'gt_catafalque', x: -380, y: 0, hw: 90, hh: 34 });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) add({ kind: 'gt_candles', x: -380 + sx * 112, y: sy * 50, r: 9 });
  // the sleeper: a partition down its length with a compartment door every 120, the corridor along the south
  {
    const c = CARS[5], py = -12, gaps = [-1060, -940, -820, -700];
    let a = c.x0;
    for (const gx of [...gaps, c.x1 + 999]) {
      const g0 = gx - 26;
      const end = Math.min(g0, c.x1);
      if (end - a > 4) add({ kind: 'gt_partition', x: (a + end) / 2, y: py, hw: (end - a) / 2, hh: 4 });
      a = gx + 26;
      if (a > c.x1) break;
    }
    // the bulkheads between compartments
    for (const bx of [-1000, -880, -760]) add({ kind: 'gt_partition', x: bx, y: -61, hw: 4, hh: 49, variant: 1 });
  }
  // the observation car: armchairs; the rear platform's railing has its gap (enemies come over it)
  for (const [x, y] of [[-1220, -70], [-1300, 60], [-1390, -60], [-1470, 66], [-1520, -24]] as [number, number][]) add({ kind: 'gt_armchair', x, y, r: 18 });
  for (const s of [-1, 1]) add({ kind: 'gt_rail', x: REAR_PLATFORM_X, y: s * 78, hw: 4, hh: 32 });
  return out;
}
const SHELL_DOORS = shellPieces(true);
const SHELL_SEALED = shellPieces(false);
const FURNITURE = furniturePieces();
/** For the renderer: the furniture in the train's frame (the same in every copy). */
export const TRAIN_FURNITURE = FURNITURE;

/** The door gaps of a station's copy, as walls (present while its doors are shut or the train is away). */
export function doorWalls(r: number): Prop[] {
  const o = trainOrigin(r), wallY = TRAIN.halfW + TRAIN.wallT / 2;
  const out: Prop[] = [];
  for (const c of CARS) for (const d of c.doors) out.push({ kind: 'gt_door', x: o.x + d, y: o.y + wallY, hw: TRAIN.doorW / 2 + 1, hh: TRAIN.wallT / 2 });
  return out;
}

// ---------------------------------------------------------------- props
const props: Prop[] = [];
const add = (p: Prop) => props.push(p);
const place = (r: number, list: Piece[]) => {
  const o = trainOrigin(r);
  for (const p of list) add({ kind: p.kind as Prop['kind'], x: o.x + p.x, y: o.y + p.y, r: p.r, hw: p.hw, hh: p.hh, variant: p.variant, yaw: p.yaw });
};
for (let r = 0; r < REGIONS.length; r++) {
  place(r, r === TRANSIT ? SHELL_SEALED : SHELL_DOORS);
  place(r, FURNITURE);
  // the locomotive (not walkable) at the east end
  const o = trainOrigin(r);
  add({ kind: 'gt_loco', x: o.x + (TRAIN.loco0 + TRAIN.locoFront) / 2, y: o.y, hw: (TRAIN.locoFront - TRAIN.loco0) / 2, hh: TRAIN.halfW + TRAIN.wallT });
}

/** The platform's edge beyond the train (nobody steps down onto the tracks) and the station's outer bounds. */
for (let r = 0; r < 5; r++) {
  const g = REGIONS[r], ty = trackY(r), o = trainOrigin(r), edge = ty + TRAIN.halfW + TRAIN.wallT / 2;
  const west = o.x + TRAIN.rear - TRAIN.wallT, east = o.x + TRAIN.locoFront;
  add({ kind: 'gt_edge', x: (g.cx - REGION_HW + west) / 2, y: edge, hw: (west - (g.cx - REGION_HW)) / 2, hh: TRAIN.wallT / 2 });
  add({ kind: 'gt_edge', x: (east + g.cx + REGION_HW) / 2, y: edge, hw: (g.cx + REGION_HW - east) / 2, hh: TRAIN.wallT / 2 });
}

export const GT_PROPS = props;
/** Station regions' walkable rectangles (the train's copy included; its walls do the rest). */
export function walkRect(r: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const g = REGIONS[r];
  if (r === TRANSIT) {
    const o = trainOrigin(r);
    return { minX: o.x + TRAIN.rear + 4, maxX: o.x + TRAIN.front - 4, minY: o.y - TRAIN.halfW + 4, maxY: o.y + TRAIN.halfW - 4 };
  }
  // the End of the Line's ground ends where the world does (gtStations.END_EDGE)
  return { minX: g.cx - REGION_HW + 60, maxX: g.cx + REGION_HW - 60, minY: trackY(r) - TRAIN.halfW + 4, maxY: r === E ? g.cy + 610 : g.cy + REGION_HH - 40 };
}
/** Where the camera may look in region r. */
export function cameraRect(r: number): { minX: number; maxX: number; minY: number; maxY: number } {
  const g = REGIONS[r];
  if (r === TRANSIT) {
    const o = trainOrigin(r);
    return { minX: o.x + TRAIN.rear - 700, maxX: o.x + TRAIN.locoFront + 500, minY: o.y - 1500, maxY: o.y + 1500 };
  }
  return { minX: g.cx - REGION_HW - 150, maxX: g.cx + REGION_HW + 150, minY: trackY(r) - 1150, maxY: r === E ? g.cy + 1100 : g.cy + REGION_HH + 260 };
}

/** Keep a player on the ground of the place they're in (movement and a guest's prediction call this). */
export function walkClamp(p: { x: number; y: number }): void {
  let r = regionAt(p.x, p.y);
  if (r < 0) {
    // lost in the dark between places: the nearest one
    let bd = Infinity;
    REGIONS.forEach((g, i) => {
      const d = (g.cx - p.x) ** 2 + (g.cy - p.y) ** 2;
      if (d < bd) {
        bd = d;
        r = i;
      }
    });
  }
  const w = walkRect(r);
  if (p.x < w.minX) p.x = w.minX;
  else if (p.x > w.maxX) p.x = w.maxX;
  if (p.y < w.minY) p.y = w.minY;
  else if (p.y > w.maxY) p.y = w.maxY;
}

/**
 * Is (x, y) open ground for something to lie on, in the same place as (fromX, fromY)? At a station: the platform
 * and the grounds south of it, or inside the parked carriages; on the moving train: inside the carriages.
 * (Props are the caller's to test.)
 */
export function openGround(fromX: number, fromY: number, x: number, y: number): boolean {
  const r = regionAt(fromX, fromY);
  if (r < 0 || regionAt(x, y) !== r) return false;
  const o = trainOrigin(r);
  if (inTrainLocal(x - o.x, y - o.y, -16)) return true;
  if (r === TRANSIT) return false;
  const w = walkRect(r);
  return x > w.minX + 20 && x < w.maxX - 20 && y > trackY(r) + TRAIN.halfW + TRAIN.wallT + 30 && y < w.maxY - 20;
}
/** Somewhere open near (x, y) when nothing better was found: a step toward the middle of its car or platform. */
export function nearGround(x: number, y: number): { x: number; y: number } {
  const r = Math.max(0, regionAt(x, y));
  const o = trainOrigin(r);
  if (inTrainLocal(x - o.x, y - o.y)) return { x, y: o.y + (y - o.y) * 0.5 };
  return { x, y: Math.max(y, trackY(r) + TRAIN.halfW + 120) };
}

export const GT_BOUNDS = { minX: -REGION_HW - 100, maxX: 6400 + REGION_HW + 100, minY: -REGION_HH - 100, maxY: 9600 + REGION_HH + 100 };

/** Room tone for each place (the fixtures add the rest, render3d/world/ghosttrain/lighting.ts). */
const LIGHTS: LightDef[] = [];

export const GHOST_TRAIN_LAYOUT: MapLayout = {
  half: 11200,
  seaY: GT_BOUNDS.maxY + 10,
  bounds: { ...GT_BOUNDS },
  spawn: { x: 0, y: trackY(J) + 260 },
  props,
  stringLights: [],
  lights: LIGHTS,
  paths: [],
  plaza: { x: 0, y: 0, r: 0 },
  promenade: { y0: 1e5, y1: 1e5 },
  tiltAWhirl: null,
  greaseSlicks: [],
  camera: { ...GT_BOUNDS },
  walkClamp,
  cameraFor: (x, y) => cameraRect(Math.max(0, regionAt(x, y))),
};
