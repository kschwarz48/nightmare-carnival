// The Boardwalk (D-68): Penhallow's Boardwalk, the third map. A long promenade runs east-west across the
// world; the attractions and rides rise behind it to the north, a wide beach falls away to the south, the
// sea beyond, and the pier strikes out from the west end into the fog. Coordinates: x east, y south (sim
// space). Design: docs/BOARDWALK.md; the hidden quest's positions are at the bottom (solution:
// docs/EASTER_EGG_BOARDWALK.md).
//
// Everything here is pure: the shoreline, the tide and the coaster's timetable are functions of sim time
// and replicated state, so a guest predicts the same water and the same train as the host.

import type { LightDef, MapLayout, Prop } from './map';

export const BW_HALF = 4000;
/** the playable bounds: the hills to the north, the pier's end to the south */
export const BW_BOUNDS = { minX: -3900, maxX: 3900, minY: -2200, maxY: 2920 };
/** where the camera may look (a little past the bounds; the ocean shows to the south) */
export const BW_CAMERA = { minX: -3950, maxX: 3950, minY: -2300, maxY: 3300 };

// ---------------------------------------------------------------- the bands, north to south
export const PROMENADE = { x0: -3950, x1: 3950, y0: -820, y1: -130 };
/** the façades' front line: every building's south face stands on it */
export const FACADE_Y = -820;
export const RIDES_Y0 = -2250;

// ---------------------------------------------------------------- the shore and the tide
/** The mean waterline (y) at x: the beach is ~1250 deep, the shore wanders a little. */
export function shoreBase(x: number): number {
  return 1150 + 70 * Math.sin(x * 0.00105 + 0.6) + 35 * Math.sin(x * 0.0029 + 2.1);
}
export const TIDE = { period: 75, amp: 60, lowAt: -0.45 };
/** +1 high water, -1 low water. */
export function tideRise(t: number): number {
  return Math.sin((t / TIDE.period) * Math.PI * 2);
}
export function isLowTide(t: number): boolean {
  return tideRise(t) < TIDE.lowAt;
}
/** How far shallow water may be waded (players stop where it gets deeper than this). */
export const WADE = 150;

/**
 * The sea's state, rebuilt every tick by the map's own logic on the host and in a guest's mirror alike
 * (like the Fun House's dynamic walls): sim time, how far the sea has gone out (the quest's low water,
 * 0..1), and a running surge (a rogue wave: how far up the beach it reaches right now, 0 = none).
 */
export const SEA = { t: 0, retreat: 0, surge: 0, surgeX0: -1e5, surgeX1: 1e5 };
/** How far south the low water pushes the shore (the quest, stage 9). */
export const RETREAT = 650;

/** The waterline at x right now. */
export function shoreY(x: number, t = SEA.t, retreat = SEA.retreat): number {
  return shoreBase(x) - TIDE.amp * tideRise(t) + RETREAT * retreat;
}

// ---------------------------------------------------------------- the pier
export interface Rect { x0: number; x1: number; y0: number; y1: number }
/** The pier's decks: the neck over the sand, the bait platform, the long walk, the side dock, the end. */
export const PIER = {
  neck: { x0: -3060, x1: -2740, y0: -140, y1: 1500 } as Rect,
  bait: { x0: -3400, x1: -2400, y0: 1500, y1: 1950 } as Rect,
  walk: { x0: -3050, x1: -2750, y0: 1950, y1: 2400 } as Rect,
  dock: { x0: -2750, x1: -2100, y0: 2150, y1: 2340 } as Rect,
  end: { x0: -3350, x1: -2450, y0: 2400, y1: 2930 } as Rect,
};
export const PIER_DECKS: Rect[] = [PIER.neck, PIER.bait, PIER.walk, PIER.dock, PIER.end];
const inRect = (r: Rect, x: number, y: number, m = 0) => x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m;
export function onDeck(x: number, y: number, m = 0): boolean {
  for (const r of PIER_DECKS) if (inRect(r, x, y, m)) return true;
  return false;
}

/** Water depth at (x, y): <= 0 on land and on the pier's decks, how far past the waterline otherwise. */
export function waterDepth(x: number, y: number): number {
  if (onDeck(x, y)) return 0;
  return y - shoreY(x);
}

/** How far the sea floor has dropped at depth `d` (the floor shader's own curve: keep the two in step). */
export function seabedHeight(d: number): number {
  return d > 40 ? -Math.min(90, (d - 40) * 0.2) : 0;
}

/** Where the water's surface sits at depth `d` (the ocean shader's own curve: it settles lower offshore). */
export function seaSurfaceHeight(d: number): number {
  return d > 300 ? -Math.min(40, (d - 300) * 0.12) : 0;
}

/**
 * Keep a player out of deep water (movement and prediction call this after the props): the nearest of
 * the wading limit up the beach and the closest point on any deck.
 */
export function walkClamp(p: { x: number; y: number }): void {
  if (onDeck(p.x, p.y)) return;
  const lim = shoreY(p.x) + WADE;
  if (p.y <= lim) return;
  let bx = p.x, by = lim, bd = (p.y - lim) ** 2;
  for (const r of PIER_DECKS) {
    const cx = Math.min(r.x1, Math.max(r.x0, p.x)), cy = Math.min(r.y1, Math.max(r.y0, p.y));
    const d = (cx - p.x) ** 2 + (cy - p.y) ** 2;
    if (d < bd) {
      bd = d;
      bx = cx;
      by = cy;
    }
  }
  p.x = bx;
  p.y = by;
}

// ---------------------------------------------------------------- the buildings (façade row)
export interface Building { id: string; x0: number; x1: number; y0: number; y1: number; name: string; open?: boolean }
/** Buildings standing on the façade line, west to east. `open` ones are entered (walls with doors). */
export const BUILDINGS: Building[] = [
  { id: 'fishmarket', x0: -3900, x1: -3260, y0: -1240, y1: FACADE_Y, name: 'Penhallow Fish & Tackle Co.' },
  { id: 'clamshack', x0: -3160, x1: -2810, y0: -1080, y1: FACADE_Y, name: 'The Clam Shack' },
  { id: 'tintype', x0: -2760, x1: -2360, y0: -1150, y1: FACADE_Y, name: 'Tintype Portraits' },
  { id: 'arcade', x0: -1900, x1: -700, y0: -1520, y1: FACADE_Y, name: "Neptune's Palace of Amusements", open: true },
  { id: 'pavilion', x0: -150, x1: 850, y0: -1450, y1: FACADE_Y, name: 'The Grand Pavilion' },
  { id: 'taffy', x0: 1000, x1: 1400, y0: -1100, y1: FACADE_Y, name: 'Salt & Sugar Taffy Works' },
  { id: 'giftshop', x0: 1450, x1: 2350, y0: -1460, y1: FACADE_Y, name: 'Seashell Souvenirs & Curiosities', open: true },
  { id: 'station', x0: 2500, x1: 3100, y0: -1250, y1: FACADE_Y, name: 'The Undertow' },
  { id: 'ballroom', x0: 3290, x1: 3740, y0: -1150, y1: FACADE_Y, name: 'The Starlight Ballroom' },
];
export const BUILDING = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<string, Building>;
export const ARCADE = BUILDING.arcade;
export const GIFTSHOP = BUILDING.giftshop;
/** The entered buildings' doorways: [building, wall, centre along the wall, width]. */
export const DOORS: { b: string; wall: 's' | 'e' | 'w'; c: number; w: number }[] = [
  { b: 'arcade', wall: 's', c: -1600, w: 230 },
  { b: 'arcade', wall: 's', c: -1000, w: 230 },
  { b: 'arcade', wall: 'e', c: -1170, w: 210 },
  { b: 'giftshop', wall: 's', c: 1900, w: 230 },
  { b: 'giftshop', wall: 'w', c: -1150, w: 210 },
];
export const WALL_T = 30;

/** Is (x, y) inside an entered building (for the renderer's cut-away and the ambience)? */
export function insideBuilding(x: number, y: number): Building | null {
  for (const b of BUILDINGS) if (b.open && x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return b;
  return null;
}

// ---------------------------------------------------------------- the rides
/** The Sea Wheel: hub height, radius, twenty gondolas, one turn every 80 s. */
export const WHEEL = { x: 300, y: -1900, hubH: 360, r: 320, cars: 20, period: 80, platformY: -1790 };
/** Gondola k's angle (radians, 0 = east, -π/2 = the bottom) at sim time t. */
export function wheelAngle(k: number, t: number): number {
  return (k / WHEEL.cars) * Math.PI * 2 - (t / WHEEL.period) * Math.PI * 2;
}
/** 0 when gondola k is at the bottom (boarding), growing to 1 as it gets half a turn away. */
export function wheelFromBottom(k: number, t: number): number {
  const a = wheelAngle(k, t) + Math.PI / 2;
  const w = Math.atan2(Math.sin(a), Math.cos(a));
  return Math.abs(w) / Math.PI;
}
export const PLUNGE = { x: -1300, y: -1880, h: 900, period: 30 };
export const KRAKEN = { x: -2600, y: -1660, arms: 6, armLen: 230, period: 9 };

// ---------------------------------------------------------------- the Undertow (the coaster)
/**
 * The track's control points (x, y, height), a closed loop: west out of the station, up the lift hill to
 * the north (through the gap between the Gift Shop and the station), the first drop east, a speed hill,
 * south past the Ballroom's east end and over the promenade high on its trestle, a low dip over the beach
 * (the crossing), a turnaround on the sand, back north over the promenade, between the Ballroom and the
 * station, and the brake run into the station. It never passes through a building but its own station.
 */
export const TRACK: [number, number, number][] = [
  [2560, -1040, 40], [2440, -1150, 36], [2425, -1380, 70], [2410, -1640, 220], [2400, -1900, 400], [2430, -2100, 540],
  [2560, -2190, 560], [2720, -2120, 330], [2860, -2010, 120], [3040, -1930, 250], [3230, -1880, 320], [3420, -1800, 190],
  [3620, -1680, 100], [3790, -1500, 180], [3840, -1200, 250], [3835, -880, 270], [3810, -540, 250], [3760, -220, 170],
  [3700, 60, 60], [3650, 240, 26], [3560, 420, 70], [3400, 520, 130], [3230, 480, 160], [3150, 320, 190],
  [3160, 40, 230], [3185, -300, 250], [3195, -640, 230], [3195, -930, 150], [3180, -1060, 80], [3000, -1060, 45],
  [2800, -1050, 40],
];
/** The crossing: where the track dips low over the beach and anything under it gets hit. */
export const CROSSING = { x: 3650, y: 240, r: 150, warn: 2.5 };

const TN = TRACK.length;
function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
/** A point on the closed track at u (0..1). */
export function trackAt(u: number): [number, number, number] {
  const f = (((u % 1) + 1) % 1) * TN;
  const i = Math.floor(f), t = f - i;
  const a = TRACK[(i - 1 + TN) % TN], b = TRACK[i], c = TRACK[(i + 1) % TN], d = TRACK[(i + 2) % TN];
  return [cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t)];
}

/** The ride: a dwell in the station, then one lap, the train's speed set by its height (gravity) and the lift. */
export const RIDE = { dwell: 12, cars: 5, carGap: 0.0085 };
const SAMPLES = 1200;
const RUN: { t: Float32Array; u: Float32Array; total: number } = (() => {
  const t = new Float32Array(SAMPLES + 1), u = new Float32Array(SAMPLES + 1);
  let time = 0, prev = trackAt(0);
  for (let i = 1; i <= SAMPLES; i++) {
    const uu = i / SAMPLES;
    const p = trackAt(uu);
    const ds = Math.hypot(p[0] - prev[0], p[1] - prev[1], (p[2] - prev[2]) * 1.2);
    // the lift hill is a slow clank; elsewhere the train runs as fast as it has fallen
    const lifting = uu > 0.06 && uu < 0.205;
    const v = lifting ? 120 : 150 + 21 * Math.sqrt(Math.max(0, 600 - p[2]));
    time += ds / v;
    t[i] = time;
    u[i] = uu;
    prev = p;
  }
  return { t, u, total: time };
})();
export const LAP = RUN.total;
export const RIDE_PERIOD = RIDE.dwell + LAP;
/** Where the head of the train is (track u) at sim time `t`, and whether it is standing in the station. */
export function trainU(t: number, speed = 1): { u: number; dwelling: boolean } {
  const c = ((t * speed) % RIDE_PERIOD + RIDE_PERIOD) % RIDE_PERIOD;
  if (c < RIDE.dwell) return { u: 0, dwelling: true };
  const tt = c - RIDE.dwell;
  let lo = 0, hi = SAMPLES;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (RUN.t[m] < tt) lo = m;
    else hi = m;
  }
  const k = (tt - RUN.t[lo]) / Math.max(1e-6, RUN.t[hi] - RUN.t[lo]);
  return { u: RUN.u[lo] + (RUN.u[hi] - RUN.u[lo]) * k, dwelling: false };
}
/** The track u nearest the crossing, and the time into a lap when the head of the train passes it. */
export const CROSSING_U = (() => {
  let best = 0, bd = Infinity;
  for (let i = 0; i <= 2000; i++) {
    const p = trackAt(i / 2000);
    const d = (p[0] - CROSSING.x) ** 2 + (p[1] - CROSSING.y) ** 2;
    if (d < bd) {
      bd = d;
      best = i / 2000;
    }
  }
  return best;
})();
export const CROSSING_T = (() => {
  for (let i = 1; i <= SAMPLES; i++) if (RUN.u[i] >= CROSSING_U) return RIDE.dwell + RUN.t[i];
  return RIDE.dwell;
})();
/** Seconds until the train's head next reaches the crossing (at the normal schedule). */
export function crossingIn(t: number, speed = 1): number {
  const c = ((t * speed) % RIDE_PERIOD + RIDE_PERIOD) % RIDE_PERIOD;
  const d = CROSSING_T - c;
  return (d >= 0 ? d : d + RIDE_PERIOD) / speed;
}
/** The support bents: every ~130 units of track, a pair of posts from the ground to the rails. */
export const BENTS: { x: number; y: number; h: number; a: number }[] = (() => {
  const out: { x: number; y: number; h: number; a: number }[] = [];
  let acc = 0, prev = trackAt(0);
  for (let i = 1; i <= 3000; i++) {
    const p = trackAt(i / 3000);
    acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    if (acc >= 130 && p[2] > 30) {
      acc = 0;
      out.push({ x: p[0], y: p[1], h: p[2], a: Math.atan2(p[1] - prev[1], p[0] - prev[0]) });
    }
    prev = p;
  }
  return out;
})();

// ---------------------------------------------------------------- props
const props: Prop[] = [];
const add = (p: Prop) => props.push(p);

/** A wall from (x0, y) to (x1, y) or (x, y0) to (x, y1), with doorways [centre, width]. */
function wallH(x0: number, x1: number, y: number, style: string, doors: [number, number][] = []): void {
  const cuts = doors.map(([c, w]) => [c - w / 2, c + w / 2]).sort((a, b) => a[0] - b[0]);
  let a = x0;
  for (const [d0, d1] of [...cuts, [x1, x1]]) {
    if (d0 - a > 8) add({ kind: 'bw_wall', x: (a + d0) / 2, y, hw: (d0 - a) / 2, hh: WALL_T / 2, w: d0 - a, style });
    a = Math.max(a, d1);
  }
}
function wallV(y0: number, y1: number, x: number, style: string, doors: [number, number][] = []): void {
  const cuts = doors.map(([c, w]) => [c - w / 2, c + w / 2]).sort((a, b) => a[0] - b[0]);
  let a = y0;
  for (const [d0, d1] of [...cuts, [y1, y1]]) {
    if (d0 - a > 8) add({ kind: 'bw_wall', x, y: (a + d0) / 2, hw: WALL_T / 2, hh: (d0 - a) / 2, w: d0 - a, style, yaw: Math.PI / 2 });
    a = Math.max(a, d1);
  }
}

// the façade row: solid buildings, and the two that are entered (walls with doors)
for (const b of BUILDINGS) {
  if (!b.open) {
    add({ kind: 'bw_building', x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, hw: (b.x1 - b.x0) / 2, hh: (b.y1 - b.y0) / 2, label: b.id });
    continue;
  }
  const doors = (wall: 's' | 'e' | 'w') => DOORS.filter((d) => d.b === b.id && d.wall === wall).map((d): [number, number] => [d.c, d.w]);
  wallH(b.x0, b.x1, b.y1 - WALL_T / 2, b.id, doors('s'));
  wallH(b.x0, b.x1, b.y0 + WALL_T / 2, b.id);
  wallV(b.y0, b.y1, b.x0 + WALL_T / 2, b.id, doors('w'));
  wallV(b.y0, b.y1, b.x1 - WALL_T / 2, b.id, doors('e'));
}

// ---- the Arcade's floor: machines in rows, the gallery along the back, Marina and the Crane in the corners
export const ARCADE_FIX = {
  marina: { x: -1820, y: -1440 },
  crane: { x: -800, y: -1440 },
  gallery: { x0: -1520, x1: -1080, y: -1470, counterY: -1390 },
  sailor: { x: -1300, y: -930 },
  booth: { x: -900, y: -1180 },
};
add({ kind: 'bw_fortune', x: ARCADE_FIX.marina.x, y: ARCADE_FIX.marina.y, hw: 44, hh: 34 });
add({ kind: 'bw_crane', x: ARCADE_FIX.crane.x, y: ARCADE_FIX.crane.y, hw: 52, hh: 40 });
add({ kind: 'bw_gallery', x: (ARCADE_FIX.gallery.x0 + ARCADE_FIX.gallery.x1) / 2, y: ARCADE_FIX.gallery.counterY, hw: (ARCADE_FIX.gallery.x1 - ARCADE_FIX.gallery.x0) / 2, hh: 22 });
add({ kind: 'bw_sailor', x: ARCADE_FIX.sailor.x, y: ARCADE_FIX.sailor.y, r: 40 });
add({ kind: 'bw_changebooth', x: ARCADE_FIX.booth.x, y: ARCADE_FIX.booth.y, hw: 50, hh: 40 });
// two rows of cabinets, broken into short runs so the floor never turns into a corridor
for (const [y, xs] of [[-1240, [-1700, -1560, -1420, -1180, -1040]], [-1060, [-1720, -1580, -1440, -1160]]] as [number, number[]][]) {
  xs.forEach((x, i) => add({ kind: 'bw_cabinet', x, y, hw: 40, hh: 26, variant: (i + (y > -1100 ? 2 : 0)) % 4 }));
}
// three skee-ball alleys side by side along the west wall, their ring boards at the wall
for (let k = 0; k < 3; k++) add({ kind: 'bw_skeeball', x: -1815, y: -1300 + k * 120, hw: 45, hh: 26, yaw: Math.PI / 2 });

// ---- the Gift Shop: souvenir stands, cases, the counter and register, the photograph on its easel
export const SHOP_FIX = {
  photo: { x: 1925, y: -1372 },
  register: { x: 2200, y: -960 },
  cabinet: { x: 2290, y: -1410 },
  spinner: { x: 1640, y: -930 },
};
// each stand is built to its own length (the variant carries it), so nothing on it is stretched
for (const [x, y, w] of [[1700, -1270, 280], [2120, -1270, 220], [1660, -1110, 240], [2080, -1110, 260]] as [number, number, number][]) {
  add({ kind: 'bw_shelf', x, y, hw: w / 2, hh: 22, variant: w });
}
add({ kind: 'bw_counter', x: 2200, y: -990, hw: 110, hh: 30 });
add({ kind: 'bw_case', x: 1980, y: -930, hw: 60, hh: 24 });
add({ kind: 'bw_spinner', x: SHOP_FIX.spinner.x, y: SHOP_FIX.spinner.y, r: 24 });
add({ kind: 'bw_photo', x: SHOP_FIX.photo.x, y: SHOP_FIX.photo.y, hw: 64, hh: 52 });
add({ kind: 'bw_cabinet_tall', x: SHOP_FIX.cabinet.x, y: SHOP_FIX.cabinet.y, hw: 40, hh: 22 });

// ---- the promenade: lamps along both edges, palms on the sea side, benches, bins, telescopes, carts
/** The rail's stair gaps (centre x, width): the pier's mouth is the widest after the grand stairs. */
export const STAIRS: [number, number][] = [[-2900, 330], [-2000, 300], [-1100, 300], [0, 480], [1100, 300], [2000, 300], [2900, 300], [3600, 260]];
{
  let a = PROMENADE.x0;
  for (const [c, w] of [...STAIRS, [PROMENADE.x1, 0]] as [number, number][]) {
    const d0 = c - w / 2;
    if (d0 - a > 20) add({ kind: 'bw_rail', x: (a + d0) / 2, y: PROMENADE.y1, hw: (d0 - a) / 2, hh: 7, w: d0 - a });
    a = c + w / 2;
  }
}
/** Is (x, y) clear of the coaster's support posts (lamps and palms never stand inside a bent)? */
const clearOfBents = (x: number, y: number) => !BENTS.some((b) => Math.hypot(b.x - x, b.y - y) < 110);
for (let x = -3800; x <= 3800; x += 400) {
  if (clearOfBents(x, FACADE_Y + 40)) add({ kind: 'bw_lamp', x, y: FACADE_Y + 40 });
  if (!STAIRS.some(([c, w]) => Math.abs(x - c) < w / 2 + 40) && clearOfBents(x, PROMENADE.y1 - 34)) add({ kind: 'bw_lamp', x, y: PROMENADE.y1 - 34, variant: 1 });
}
for (let x = -3600; x <= 3600; x += 400) {
  if (STAIRS.some(([c, w]) => Math.abs(x + 200 - c) < w / 2 + 70) || !clearOfBents(x + 200, PROMENADE.y1 - 70)) continue;
  add({ kind: 'bw_palm', x: x + 200, y: PROMENADE.y1 - 70, r: 16, variant: Math.abs(Math.round(x / 400)) % 3 });
}
for (const [x, y, k] of [
  [-3450, -400, 'bw_bench'], [-2450, -380, 'bw_bench'], [-1650, -420, 'bw_bench'], [-600, -400, 'bw_bench'], [650, -410, 'bw_bench'],
  [1650, -400, 'bw_bench'], [2450, -390, 'bw_bench'], [3350, -400, 'bw_bench'],
  [-3100, -250, 'bw_telescope'], [-1300, -230, 'bw_telescope'], [480, -230, 'bw_telescope'], [2300, -240, 'bw_telescope'],
  [-2200, -700, 'bw_bin'], [-400, -690, 'bw_bin'], [900, -700, 'bw_bin'], [2420, -700, 'bw_bin'], [3500, -700, 'bw_bin'],
  [-3300, -620, 'bw_cart'], [1250, -600, 'bw_cart'], [3000, -620, 'bw_cart'],
  [-500, -640, 'bw_vending'], [2400, -650, 'bw_vending'], [-2650, -680, 'bw_vending'],
  [700, -650, 'bw_scale'], [-1500, -680, 'bw_kiosk'],
] as [number, number, string][]) {
  const solid = k === 'bw_bench' ? undefined : k === 'bw_cart' || k === 'bw_kiosk' ? 30 : 18;
  add({ kind: k as Prop['kind'], x, y, r: solid });
}
// the bandstand in the grand plaza, and the ticket booth at the wheel walk
add({ kind: 'bw_bandstand', x: 0, y: -470, r: 120 });
add({ kind: 'bw_ticketbooth', x: -560, y: -900, hw: 60, hh: 50 });
add({ kind: 'bw_tossbooth', x: -300, y: -930, hw: 110, hh: 60 });
// the iron arch over the pier's mouth
add({ kind: 'bw_wharfgate', x: -2900, y: PROMENADE.y1 + 10 });

// ---- the rides' footings (the rest of each ride is overhead or turning in the air)
add({ kind: 'bw_wheel', x: WHEEL.x, y: WHEEL.y, hw: 60, hh: 40 });
add({ kind: 'bw_wheel_deck', x: WHEEL.x, y: WHEEL.platformY });
add({ kind: 'bw_plunge', x: PLUNGE.x, y: PLUNGE.y, r: 80 });
add({ kind: 'bw_kraken', x: KRAKEN.x, y: KRAKEN.y, r: 90 });
for (const b of BENTS) {
  // posts either side of the rails; only those standing on walkable ground block a player
  const nx = -Math.sin(b.a), ny = Math.cos(b.a);
  for (const s of [-1, 1]) add({ kind: 'bw_bent_post', x: b.x + nx * 46 * s, y: b.y + ny * 46 * s, r: 11 });
}

// ---- the beach
export const TOWERS: { x: number; y: number }[] = [{ x: -1900, y: 420 }, { x: 300, y: 520 }, { x: 2300, y: 440 }];
TOWERS.forEach((t, i) => add({ kind: 'bw_lifeguard', x: t.x, y: t.y, r: 46, variant: i }));
/** The Gala Queen's wreck, lying along the waterline (its portholes face the beach). */
export const WRECK = { x: 1300, y: 1135, len: 620, a: -0.12 };
add({ kind: 'bw_wreck', x: WRECK.x, y: WRECK.y, hw: 300, hh: 70 });
for (const [x, y, k, v] of [
  [-900, 860, 'bw_rowboat', 0], [2900, 760, 'bw_ribs', 0], [-450, 300, 'bw_firepit', 0],
  [-2500, 600, 'bw_umbrella', 0], [-2350, 700, 'bw_umbrella', 1], [-1200, 450, 'bw_umbrella', 2], [-1050, 560, 'bw_umbrella', 0],
  [900, 420, 'bw_umbrella', 1], [1700, 620, 'bw_umbrella', 2], [1850, 520, 'bw_umbrella', 0], [3300, 600, 'bw_umbrella', 1],
  [-2450, 640, 'bw_chair', 0], [-1120, 520, 'bw_chair', 1], [1780, 560, 'bw_chair', 0], [3240, 650, 'bw_chair', 1],
  [-1600, 940, 'bw_driftwood', 0], [600, 980, 'bw_driftwood', 1], [2500, 1000, 'bw_driftwood', 0], [-3500, 900, 'bw_driftwood', 1],
  [500, 140, 'bw_sign', 0], [2600, 200, 'bw_sign', 1], [-3400, 300, 'bw_sign', 2],
  [3600, 980, 'bw_rocks', 0], [3780, 1100, 'bw_rocks', 1], [3450, 1080, 'bw_rocks', 2], [-3750, 1000, 'bw_rocks', 1],
] as [number, number, string, number][]) {
  const solid = k === 'bw_rowboat' ? 50 : k === 'bw_rocks' ? 55 : k === 'bw_ribs' ? undefined : k === 'bw_firepit' ? 30 : k === 'bw_driftwood' ? undefined : undefined;
  add({ kind: k as Prop['kind'], x, y, r: solid, variant: v });
}

// ---- the pier
export const PIER_FIX = {
  baitShop: { x0: -3360, x1: -2960, y0: 1560, y1: 1800 },
  rod: { x: -2930, y: 1700 },
  crane: { x: -2460, y: 1870 },
  fishing: { x: -2140, y: 2410 },
  trawler: { x: -2240, y: 2500 },
  foghorn: { x0: -3050, x1: -2750, y0: 2790, y1: 2920 },
  short: { x: -2960, y: 2765 },
  long: { x: -2840, y: 2765 },
  lighthouse: { x: -3260, y: 2840 },
  berth: { x: -2440, y: 2660 },
};
add({ kind: 'bw_baitshop', x: (PIER_FIX.baitShop.x0 + PIER_FIX.baitShop.x1) / 2, y: (PIER_FIX.baitShop.y0 + PIER_FIX.baitShop.y1) / 2, hw: 200, hh: 120 });
add({ kind: 'bw_hoist', x: PIER_FIX.crane.x, y: PIER_FIX.crane.y, r: 46 });
add({ kind: 'bw_foghorn', x: (PIER_FIX.foghorn.x0 + PIER_FIX.foghorn.x1) / 2, y: (PIER_FIX.foghorn.y0 + PIER_FIX.foghorn.y1) / 2, hw: 150, hh: 65 });
add({ kind: 'bw_lighthouse', x: PIER_FIX.lighthouse.x, y: PIER_FIX.lighthouse.y, r: 40 });
add({ kind: 'bw_trawler', x: PIER_FIX.trawler.x, y: PIER_FIX.trawler.y });
for (const [x, y] of [[-2700, 1600], [-2560, 1600], [-3200, 1880], [-3060, 1880]] as [number, number][]) add({ kind: 'bw_crates', x, y, r: 30 });
for (const [x, y] of [[-2640, 1880], [-3300, 2500], [-2550, 2500], [-2200, 2200]] as [number, number][]) add({ kind: 'bw_nets', x, y });
/** Hanging lanterns along the pier (every ~300 along the neck and the walk, at the platforms' corners). */
export const PIER_LAMPS: { x: number; y: number }[] = [];
for (let y = 100; y <= 1450; y += 300) PIER_LAMPS.push({ x: -3050, y }, { x: -2750, y });
for (const [x, y] of [[-3390, 1510], [-2410, 1510], [-3390, 1940], [-2410, 1940], [-3040, 2150], [-2760, 2150], [-2110, 2160], [-3340, 2410], [-2460, 2410], [-3340, 2920], [-2460, 2920]] as [number, number][]) PIER_LAMPS.push({ x, y });
for (const l of PIER_LAMPS) add({ kind: 'bw_pierlamp', x: l.x, y: l.y });
for (const r of PIER_DECKS) {
  // bollards along the decks' sea edges
  for (let x = r.x0 + 60; x < r.x1 - 40; x += 260) if (r !== PIER.neck) add({ kind: 'bw_bollard', x, y: r.y1 - 14, r: 10 });
}

export const BW_PROPS = props;

// ---------------------------------------------------------------- light pools (room tone)
/**
 * Room tone only: the lamps, signs, ride lights, pier lanterns and the lighthouse add the rest, each from
 * a fixture you can see (render3d/world/boardwalk/lighting.ts).
 */
const LIGHTS: LightDef[] = [
  { x: 0, y: -470, r: 520, color: [1, 0.78, 0.52], intensity: 0.5, flicker: 0.05 },
  { x: -1300, y: -1170, r: 560, color: [0.55, 0.85, 1], intensity: 0.55, flicker: 0.3 },
  { x: 1900, y: -1140, r: 480, color: [1, 0.72, 0.5], intensity: 0.5, flicker: 0.15 },
  { x: 2800, y: -1000, r: 400, color: [1, 0.4, 0.35], intensity: 0.5, flicker: 0.2 },
  { x: 350, y: -1130, r: 460, color: [1, 0.8, 0.55], intensity: 0.45, flicker: 0.08 },
  { x: -2900, y: 1720, r: 420, color: [1, 0.7, 0.4], intensity: 0.45, flicker: 0.25 },
  { x: -2900, y: 2650, r: 460, color: [0.6, 0.75, 1], intensity: 0.4, flicker: 0.1 },
];

// ---------------------------------------------------------------- Summer's End (the hidden quest; D-68)
// Positions, tuning and Ada's lines. The solution is in docs/EASTER_EGG_BOARDWALK.md (developer-only).

/** Ada's keepsakes: two for each of the park's four games; each night one of each pair is hers. */
export const KEEPSAKES = ['pinwheel', 'tin pail', 'sailor doll', 'paper boat', 'silk ribbon', 'seahorse charm', 'jacks', 'kite'] as const;
/** which game holds each keepsake: 0 the shooting gallery, 1 the Crane, 2 the Sea Wheel, 3 the Undertow */
export const KEEPSAKE_GAME = [2, 1, 0, 1, 3, 0, 3, 2];
export const GAME_NAMES = ['the shooting gallery', 'the Crane', 'the Sea Wheel', 'the Undertow'];

export const SUMMERS_END = {
  id: 'summers_end',
  /** where the conch can wash up (one per night), at the low-tide waterline */
  conchXs: [-1500, -300, 900, 2700],
  marina: { x: ARCADE_FIX.marina.x, y: ARCADE_FIX.marina.y + 70 },
  photo: { x: SHOP_FIX.photo.x, y: SHOP_FIX.photo.y + 100 },
  /** the eight souvenirs on the Gift Shop's stands (where a player stands to take each one) */
  shelf: [[1600, -1230], [1700, -1230], [1800, -1230], [2060, -1230], [2180, -1230], [1610, -1070], [1720, -1070], [2080, -1070]] as [number, number][],
  gallery: { x: (ARCADE_FIX.gallery.x0 + ARCADE_FIX.gallery.x1) / 2, y: ARCADE_FIX.gallery.counterY + 50 },
  galleryDucks: 6,
  galleryTime: 25,
  crane: { x: ARCADE_FIX.crane.x, y: ARCADE_FIX.crane.y + 70, period: 2.2, window: 0.075 },
  wheel: { x: WHEEL.x, y: WHEEL.platformY + 40, window: 0.035 },
  brake: { x: 2580, y: FACADE_Y + 40, u0: 0.93 },
  /** the wreck's portholes (where a player stands to set a keepsake in each) */
  portholes: [0, 1, 2, 3].map((k) => ({ x: WRECK.x - 200 + k * 130, y: WRECK.y + 112 })),
  rod: { x: PIER_FIX.rod.x, y: PIER_FIX.rod.y + 40 },
  fishing: { x: PIER_FIX.fishing.x, y: PIER_FIX.fishing.y - 70, biteMin: 1.5, biteMax: 4, window: 0.9 },
  foghorn: { x: (PIER_FIX.foghorn.x0 + PIER_FIX.foghorn.x1) / 2, y: PIER_FIX.foghorn.y0 - 40 },
  short: { x: PIER_FIX.short.x, y: PIER_FIX.short.y - 30 },
  long: { x: PIER_FIX.long.x, y: PIER_FIX.long.y - 30 },
  berth: { x: PIER_FIX.berth.x - 50, y: PIER_FIX.berth.y },
  fireTime: 120,
  /** the four tide lamps: the bait platform, the second lifeguard tower, the Pavilion stairs, the lift hill */
  lamps: [{ x: -2650, y: 1900 }, { x: 300, y: 610 }, { x: 250, y: -170 }, { x: 2290, y: -1700 }],
  retreatTime: 8,
  bell: { x: -2160, y: 1870, r: 170, hold: 28, decay: 0.5 },
  cabinet: { x: SHOP_FIX.cabinet.x, y: SHOP_FIX.cabinet.y + 70 },
  strikeRange: 1000,
  strikeCool: 1.3,
  finaleDelay: 4,
};

/** Ada, through the shells (and Madame Marina's cards). Never instructions: what she remembers. */
export const ADA = {
  conch: ['Is someone there? I can hear the sea in you.', 'hold me to something that tells fortunes'],
  marina: ['THE FORTUNE READS:', '"Four small things went down to the water with her. The photograph remembers."'],
  /** asked before the conch is found: how to begin, a little plainer each time she's asked */
  hint: [
    ['THE FORTUNE READS:', '"When the tide runs out, the sea leaves a voice on the sand. Find it at the water\'s edge, and bring it to me."'],
    ['THE FORTUNE READS:', '"A shell that holds the sea. It shows at the waterline only while the tide is out."'],
    ['THE FORTUNE READS:', '"The tide turns every minute or so. When the water draws back, walk the shore and look for the conch."'],
  ] as [string, string][],
  photo: ['That was me, the summer I was nine.', 'I had my things with me. Those ones, not the others.'],
  shelfTrue: (n: number): [string, string] => ['Yes… that one was mine.', `${n} of four`],
  shelfFalse: ['That isn\'t mine.', 'mine is in the photograph'],
  gamesOpen: ['The games kept the real ones. They always keep something.', 'win them back'],
  gameWon: (name: string, n: number): [string, string] => [`${name} gives it back.`, n < 4 ? `${n} of four` : 'all four'],
  galleryStart: ['Six ducks.', 'knock them all down before they get away'],
  galleryLost: ['They got away.', 'try again'],
  craneMiss: ['The claw comes up empty.', 'watch it, then drop'],
  wheelMiss: ['Not that car.', 'the one with the green lantern, when it comes down'],
  brakeMiss: ['Too soon, or too late.', 'pull it as the train comes home'],
  wreck: ['The Gala Queen. We were on her when the lights went out.', 'when the tide is low, give her back my things'],
  wreckHigh: ['The sea is over her.', 'wait for the tide to go out'],
  wreckDone: ['She remembers us now.', 'Father kept a key for the horn in the water by the pier'],
  rod: ['The bait shop\'s rod.', 'the water bubbles out past the little dock'],
  cast: ['The line goes out.', 'wait for it'],
  bite: ['Now!', ''],
  missed: ['It got away.', 'cast again'],
  key: ['The key to the foghorn.', 'the ship is out there. She is waiting for the call'],
  callSign: ['Listen…', 'she calls the way she always did. Answer her'],
  wrongCall: ['That isn\'t her call.', 'listen again'],
  moored: ['She came in. She came back.', 'take the light from her bow before it burns out'],
  fire: ['St. Elmo\'s fire.', 'the tide lamps are cold. Light them'],
  lamp: (n: number): [string, string] => ['The lamp takes the light.', n < 4 ? `${n} of four` : ''],
  guttered: ['The flame went out.', 'there is more on the ship'],
  lowWater: ['The sea is going out. All the way out.', 'Father\'s bell is down there'],
  bell: ['Father\'s bell. Stay with it.', 'the crane will bring it up'],
  bellUp: ['The bell is up.', 'his ledger is in the shop where he left it'],
  ledger: ['THE LEDGER. Accounts with Old Mother Tide:', 'Penhallow — the Boardwalk — paid in guests. Grinwell, I. — the Palace of Illusions — paid in reflections. The Ringmaster — the Carnival — paid in song.'],
  ledger2: ['She comes up for her payment at the end of every night.', 'ring Father\'s bell at her three times'],
  waiting: ['The bell waits for something from the sea.', ''],
  strike: (n: number): [string, string] => ['The bell rings out across the water.', n < 3 ? `${n} of three` : ''],
  held: ['It will not die while the account is open.', 'ring the bell at it'],
  bound: ['THE ACCOUNT IS CALLED', 'Old Mother Tide goes back into the deep'],
  finale: ['THE COMMODORE', 'he comes to collect what he is owed'],
  complete: ["SUMMER'S END", 'Ada walks up out of the surf and onto the beach, into the morning'],
};

/**
 * How much of each ambience a listener at (x, y) hears (D-68): the promenade and the park behind it, the
 * beach, the pier. Weights in 0..1, crossfading over a couple of hundred units.
 */
export function shoreMix(x: number, y: number): [number, number, number] {
  const ss = (a: number, b: number, v: number) => {
    const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  const prom = 1 - ss(PROMENADE.y1 - 60, PROMENADE.y1 + 260, y);
  const pierZone = ss(-1900, -2350, x) * ss(1100, 1500, y);
  const pier = pierZone * (1 - prom);
  const beach = Math.max(0, 1 - prom - pier);
  return [prom, beach, pier];
}

/** Where the promenade's lamps stand (Short Circuit arcs between them). */
export const BW_LAMP_SPOTS: [number, number][] = props.filter((p) => p.kind === 'bw_lamp').map((p) => [p.x, p.y]);

export const BOARDWALK_LAYOUT: MapLayout = {
  half: BW_HALF,
  seaY: BW_BOUNDS.maxY + 10,
  bounds: { ...BW_BOUNDS },
  spawn: { x: 0, y: -470 },
  props,
  stringLights: [],
  lights: LIGHTS,
  paths: [],
  plaza: { x: 0, y: 0, r: 0 },
  promenade: { y0: 1e5, y1: 1e5 },
  tiltAWhirl: null,
  greaseSlicks: [],
  camera: { ...BW_CAMERA },
  walkClamp,
};
