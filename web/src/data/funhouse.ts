// The Fun House (D-63): Professor Grinwell's Palace of Illusions, the second map. A 4400 × 4400 interior:
// the Grand Entrance (south), the Rotunda (centre), the Hall of Mirrors maze (west), the Crooked
// Corridor (east), the Puppet Gallery (north-west) and the Chamber of Illusions (north-east). Walls block
// the player only; enemies come through them (the house lets *them* pass). Every doorway is at least
// 210 wide and every room has two or more ways out. Coordinates: x right, y down (sim space).
// Design: docs/FUN_HOUSE.md. The hidden quest's positions are at the bottom (solution:
// docs/EASTER_EGG_FUN_HOUSE.md).

import type { LightDef, MapLayout, Prop } from './map';

export const FH_HALF = 2200;
const B = 2140; // the playable bound
const T = 40; // wall thickness
const props: Prop[] = [];
const add = (p: Prop) => props.push(p);

/** A horizontal wall from x0 to x1 at y, with doorways [centre, width]. */
function wallH(x0: number, x1: number, y: number, style: string, doors: [number, number][] = [], t = T): void {
  const cuts = doors.map(([c, w]) => [c - w / 2, c + w / 2]).sort((a, b) => a[0] - b[0]);
  let a = x0;
  for (const [d0, d1] of [...cuts, [x1, x1]]) {
    if (d0 - a > 8) add({ kind: 'fh_wall', x: (a + d0) / 2, y, hw: (d0 - a) / 2, hh: t / 2, w: d0 - a, style });
    a = Math.max(a, d1);
  }
}
/** A vertical wall from y0 to y1 at x, with doorways [centre, height]. */
function wallV(y0: number, y1: number, x: number, style: string, doors: [number, number][] = [], t = T): void {
  const cuts = doors.map(([c, w]) => [c - w / 2, c + w / 2]).sort((a, b) => a[0] - b[0]);
  let a = y0;
  for (const [d0, d1] of [...cuts, [y1, y1]]) {
    if (d0 - a > 8) add({ kind: 'fh_wall', x, y: (a + d0) / 2, hw: t / 2, hh: (d0 - a) / 2, w: d0 - a, style, yaw: Math.PI / 2 });
    a = Math.max(a, d1);
  }
}

// ---------------------------------------------------------------- the shell
wallH(-FH_HALF, FH_HALF, -B - 30, 'outer', [], 60);
wallH(-FH_HALF, FH_HALF, B + 30, 'outer', [], 60);
wallV(-FH_HALF, FH_HALF, -B - 30, 'outer', [], 60);
wallV(-FH_HALF, FH_HALF, B + 30, 'outer', [], 60);

// The Grand Entrance's north wall: two maze doors, the Rotunda's grand arch, the corridor door
export const MAZE = { x0: -B, y0: -1350, cw: 230, ch: 225, cols: 6, rows: 10 };
const mazeCx = (c: number) => MAZE.x0 + MAZE.cw * (c + 0.5);
const mazeCy = (r: number) => MAZE.y0 + MAZE.ch * (r + 0.5);
wallH(-B, B, 900, 'deco', [[mazeCx(1), 200], [mazeCx(4), 200], [0, 520], [1450, 300]]);
// The middle band: maze | Rotunda | corridor
wallV(-1350, 900, -760, 'deco', [[mazeCy(4), 200]]);
wallV(-1350, 900, 760, 'deco', [[100, 300]]);
// The north band's south wall: gallery → maze (the projector's beam), gallery → Rotunda, chamber → Rotunda, chamber → corridor
wallH(-B, B, -1350, 'gallery', [[mazeCx(3), 200], [-480, 300], [300, 400], [1450, 300]]);
// Gallery | chamber
wallV(-B, -1350, -200, 'curtain', [[-1750, 280]]);

// ---------------------------------------------------------------- the Hall of Mirrors
// H[r][c]: a panel on the south side of cell (c, r); V[r][c]: on its east side. 1 = glass, 2 = the quest's
// door. The beam's lanes (column 3 rows 0-2, row 2 cols 3-5, column 5 rows 2-7, row 7 cols 2-5, column 2
// rows 5-7) stay open; the Heart is cells (1-2, 4-5); the sealed dressing room is (1-2, 3), right behind
// the Heart's north wall, whose two south-facing panels H[3][1], H[3][2] are the door the quest opens (the
// camera looks north, so only south-facing glass is seen face-on). Pivoting panels replace V[7][0],
// V[8][3] and the open V[3][3].
export const MAZE_H: number[][] = [
  [0, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 1],
  [0, 1, 1, 1, 1, 0],
  [1, 2, 2, 0, 0, 0],
  [0, 0, 0, 1, 0, 0],
  [0, 1, 0, 0, 1, 0],
  [0, 0, 0, 1, 0, 0],
  [0, 1, 1, 0, 1, 1],
  [0, 0, 1, 0, 0, 0],
];
export const MAZE_V: number[][] = [
  [0, 1, 1, 1, 0],
  [0, 0, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [1, 0, 1, 0, 1],
  [0, 0, 0, 0, 1],
  [1, 0, 1, 0, 1],
  [0, 1, 1, 0, 1],
  [0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
];
export const PANEL = 12; // half thickness
export function mazePanelH(r: number, c: number): Prop {
  return { kind: 'fh_mirror', x: mazeCx(c), y: MAZE.y0 + MAZE.ch * (r + 1), hw: MAZE.cw / 2 + PANEL, hh: PANEL, w: MAZE.cw + PANEL * 2, style: 'mirror' };
}
export function mazePanelV(r: number, c: number): Prop {
  return { kind: 'fh_mirror', x: MAZE.x0 + MAZE.cw * (c + 1), y: mazeCy(r), hw: PANEL, hh: MAZE.ch / 2 + PANEL, w: MAZE.ch + PANEL * 2, style: 'mirror', yaw: Math.PI / 2 };
}
/** Panels whose reflections misbehave: the warped (funhouse) glass and the lagging glass. */
const WARPED = new Set(['h:5:1', 'h:4:3', 'v:1:3', 'v:8:1']);
const LAGGING = new Set(['h:6:3', 'v:6:2']);
for (let r = 0; r < MAZE_H.length; r++) for (let c = 0; c < 6; c++) if (MAZE_H[r][c] === 1) {
  const k = `h:${r}:${c}`;
  add({ ...mazePanelH(r, c), variant: WARPED.has(k) ? 1 : LAGGING.has(k) ? 2 : 0, label: k });
}
for (let r = 0; r < MAZE_V.length; r++) for (let c = 0; c < 5; c++) if (MAZE_V[r][c] === 1) {
  const k = `v:${r}:${c}`;
  add({ ...mazePanelV(r, c), variant: WARPED.has(k) ? 1 : LAGGING.has(k) ? 2 : 0, label: k });
}

/**
 * Pivoting mirror panels (the maze reshapes): each swings between two positions around a shared
 * corner, a pure function of sim time so guests predict it. They grind and flash for `warn` seconds
 * before each turn.
 */
export const PIVOTS: { a: Prop; b: Prop; period: number; phase: number }[] = [
  { a: mazePanelV(7, 0), b: mazePanelH(6, 0), period: 22, phase: 0 },
  { a: mazePanelV(8, 3), b: mazePanelH(8, 3), period: 26, phase: 7 },
  { a: mazePanelV(3, 3), b: mazePanelH(3, 3), period: 18, phase: 11 },
];
export const PIVOT_WARN = 1.5;
/** 0 = position a, 1 = position b; `shuffle` (the Mirrors Shuffle event) flips them every 3 s. */
export function pivotState(i: number, t: number, shuffle = false): number {
  if (shuffle) return Math.floor(t / 3 + i) % 2;
  const p = PIVOTS[i];
  return Math.floor((t + p.phase) / (p.period / 2)) % 2;
}
/** Seconds until pivot i turns next (for the warning flash). */
export function pivotNextIn(i: number, t: number, shuffle = false): number {
  if (shuffle) return 3 - ((t + i * 3) % 3);
  const p = PIVOTS[i], half = p.period / 2;
  return half - ((t + p.phase) % half);
}
/** The dressing room's door: the Heart's north wall, two south-facing glass panels. */
export const DOOR_PANELS: Prop[] = [{ ...mazePanelH(3, 1), style: 'door', label: 'h:3:1' }, { ...mazePanelH(3, 2), style: 'door', label: 'h:3:2' }];

// ---------------------------------------------------------------- the Rotunda
export const ROTUNDA = { x: 0, y: -225, r: 700 };
add({ kind: 'fh_kaleidoscope', x: ROTUNDA.x, y: ROTUNDA.y, r: 95 });
{
  const doorsAt = [Math.PI, 0.45, Math.PI / 2, -1.95, -1.25]; // west door, east door, the grand arch, the two north doors
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    if (doorsAt.some((d) => Math.abs(Math.atan2(Math.sin(a - d), Math.cos(a - d))) < 0.3)) continue;
    add({ kind: 'fh_column', x: ROTUNDA.x + Math.cos(a) * ROTUNDA.r, y: ROTUNDA.y + Math.sin(a) * ROTUNDA.r, r: 32 });
  }
}
for (const [x, y] of [[-420, 520], [420, 520], [-560, -980], [560, -980]] as [number, number][]) add({ kind: 'fh_chandelier', x, y });

// ---------------------------------------------------------------- the Crooked Corridor
// a slalom of offset walls, alternately from the east and the west, each lane ~700 wide
for (const [y, fromEast] of [[550, true], [150, false], [-250, true], [-650, false], [-1050, true]] as [number, boolean][]) {
  const x0 = fromEast ? 1480 : 760, x1 = fromEast ? B : 1420;
  add({ kind: 'fh_wall', x: (x0 + x1) / 2, y, hw: (x1 - x0) / 2, hh: 30, w: x1 - x0, style: 'crooked' });
}
/** Conveyor strips: rectangles that push anyone standing on them (u/s). */
export const CONVEYORS: { x: number; y: number; hw: number; hh: number; vx: number; vy: number }[] = [
  { x: 1450, y: 760, hw: 260, hh: 60, vx: 150, vy: 0 },
  { x: 1810, y: 350, hw: 60, hh: 150, vx: 0, vy: -150 },
  { x: 1100, y: -50, hw: 60, hh: 150, vx: 0, vy: 150 },
  { x: 1810, y: -850, hw: 60, hh: 150, vx: 0, vy: -150 },
];
/** Piston stomps: telegraphed `tele` s, then a blow of radius r; a pure function of sim time. */
export const PISTONS: { x: number; y: number; r: number; period: number; phase: number }[] = [
  { x: 1100, y: 700, r: 95, period: 6.5, phase: 0 },
  { x: 1800, y: -50, r: 95, period: 7.5, phase: 2.5 },
  { x: 1100, y: -850, r: 95, period: 6, phase: 4 },
  { x: 1900, y: 760, r: 85, period: 8, phase: 1.2 },
];
export const PISTON_TELE = 1.2;
for (const p of PISTONS) add({ kind: 'fh_piston', x: p.x, y: p.y });

// ---------------------------------------------------------------- the Puppet Gallery
for (const [x, y, v] of [[-1700, -1650, 0], [-1000, -1720, 1], [-700, -1580, 2], [-450, -1880, 0], [-1950, -1500, 1], [-1150, -1500, 2], [-380, -1520, 1]] as [number, number, number][]) {
  add({ kind: 'fh_mannequin', x, y, r: 22, variant: v });
}
for (const y of [-1950, -1650]) add({ kind: 'fh_marionette_rack', x: -2085, y, hw: 30, hh: 120, yaw: Math.PI / 2 });
add({ kind: 'fh_musicbox', x: -600, y: -2010, r: 70 });

// ---------------------------------------------------------------- the Chamber of Illusions
export const STAGE = { x: 950, y: -1960, hw: 650, hh: 140 };
add({ kind: 'fh_stage', x: STAGE.x, y: STAGE.y, w: STAGE.hw * 2 });
add({ kind: 'fh_curtain', x: STAGE.x, y: -2110, w: STAGE.hw * 2 + 120, variant: 1 });
for (const x of [-60, 1960]) add({ kind: 'fh_curtain', x, y: -1750, w: 260, variant: 2, yaw: Math.PI / 2 });
for (let k = 0; k < 4; k++) add({ kind: 'fh_bench', x: 520 + k * 290, y: -1560 });
/** Stage trapdoors (the Chamber's hazard during events and the Proprietor's fight). */
export const TRAPDOORS: { x: number; y: number }[] = [
  { x: 560, y: -1960 }, { x: 820, y: -1900 }, { x: 1080, y: -1960 }, { x: 1340, y: -1900 },
];

// ---------------------------------------------------------------- the Grand Entrance
// the giant grin over the Rotunda's arch, on the entrance hall's north wall (the camera looks north, so
// only south-facing walls are seen face-on: everything painted or hung faces south)
add({ kind: 'fh_face', x: 0, y: 900 + 24 });
for (const x of [-420, 420]) add({ kind: 'fh_booth', x, y: 1860, hw: 80, hh: 60 });
for (const x of [-1300, 1300]) add({ kind: 'fh_barker', x, y: 1300, r: 36, flip: x > 0 });
for (const [x, y, v] of [[-2000, 922, 0], [-1450, 922, 1], [-650, 922, 2], [650, 922, 3], [1100, 922, 1], [1900, 922, 0], [630, -1328, 2], [1000, -1328, 3], [-1700, -2118, 1], [-450, -2118, 3]] as [number, number, number][]) {
  add({ kind: 'fh_poster', x, y, variant: v });
}
for (const [x, y] of [[-700, 1650], [700, 1650], [-1700, 1450], [1700, 1450]] as [number, number][]) add({ kind: 'fh_bench', x, y });
for (const [x, y] of [[-900, 1500], [0, 1500], [900, 1500]] as [number, number][]) add({ kind: 'fh_chandelier', x, y });
for (const [x, y] of [[1650, 1950], [-1650, 1950], [-1950, -300], [1350, -1950]] as [number, number][]) add({ kind: 'fh_trunk', x, y, hw: 40, hh: 30 });

// ---------------------------------------------------------------- lamps (wall sconces and floor lamps)
for (const [x, y] of [[-1500, 1200], [1500, 1200], [-300, 1150], [300, 1150], [-1500, 2000], [1500, 2000], [-680, -600], [680, -600], [-680, 480], [680, 480], [1250, 380], [1900, -150], [1250, -450], [1900, -1150], [-1500, -1900], [-900, -1550], [-350, -2050], [200, -1650], [1700, -1650]] as [number, number][]) {
  add({ kind: 'fh_lamp', x, y, r: 10 });
}

// ---------------------------------------------------------------- the hidden quest's fixtures ("The Unreflected")
export const UNREFLECTED = {
  id: 'unreflected',
  /** the Lost & Found counter where the cracked hand mirror lies */
  counter: { x: -760, y: 1250, r: 90 },
  /** the four maze panels hiding a performer's face (cell key, the spot in front of the glass) */
  faces: [
    { key: 'h:1:0', who: 'strongman', x: mazeCx(0), y: mazeCy(2) - 60 },
    { key: 'h:2:3', who: 'ballerina', x: mazeCx(3), y: mazeCy(3) - 60 },
    { key: 'h:7:1', who: 'clown', x: mazeCx(1), y: mazeCy(8) - 60 },
    { key: 'h:7:4', who: 'magician', x: mazeCx(4), y: mazeCy(8) - 60 },
  ],
  faceReveal: 320,
  faceTouch: 100,
  /** the performers' plinths in the gallery, west to east */
  plinths: [
    { who: 'strongman', x: -1850, y: -2000 },
    { who: 'ballerina', x: -1550, y: -2000 },
    { who: 'clown', x: -1250, y: -2000 },
    { who: 'magician', x: -950, y: -2000 },
  ],
  plinthR: 95,
  /** the anamorphic mural and the brass footprints it's meant to be seen from */
  mural: { x: 950, y: -1700 },
  mark: { x: 950, y: -1580, r: 60 },
  markHold: 2,
  /** the prism projector behind the gallery's great curtain, aimed down the maze door */
  projector: { x: mazeCx(3), y: -1580, r: 150 },
  charge: 30,
  chargeDecay: 0.5,
  /**
   * the four pivot mirrors in the maze (cells) and the Heart's crystal. Each stands in the north part of
   * its cell: three of the cells have glass on their south side, which hides the south part from the
   * camera (it looks north), so the mirror and its plate stay in sight.
   */
  beamPivots: [
    { c: 3, r: 2, x: mazeCx(3), y: mazeCy(2) - 60 },
    { c: 5, r: 2, x: mazeCx(5), y: mazeCy(2) - 60 },
    { c: 5, r: 7, x: mazeCx(5), y: mazeCy(7) - 60 },
    { c: 2, r: 7, x: mazeCx(2), y: mazeCy(7) - 60 },
  ],
  pivotPlate: 70,
  pivotStep: 1.25,
  /** the solution: '\\' = 3, '/' = 1 (see beamTrace) */
  beamSolution: [3, 3, 1, 3],
  crystal: { x: mazeCx(2), y: -260, r: 40 },
  heart: { x: (mazeCx(1) + mazeCx(2)) / 2, y: (mazeCy(4) + mazeCy(5)) / 2 },
  /** Mira's dressing room behind the Heart's north glass, and her vanity against its far wall */
  dressing: { x0: MAZE.x0 + MAZE.cw, x1: MAZE.x0 + MAZE.cw * 3, y0: MAZE.y0 + MAZE.ch * 3, y1: MAZE.y0 + MAZE.ch * 4 },
  vanity: { x: MAZE.x0 + MAZE.cw * 2, y: MAZE.y0 + MAZE.ch * 3 + 46 },
  /** the four stopped clocks; each shows one of the per-run times */
  clocks: [
    { id: 'entrance', x: 900, y: 935, face: 's' },
    { id: 'rotunda', x: -115, y: -1322, face: 's' },
    { id: 'corridor', x: 2000, y: -205, face: 's' },
    { id: 'chamber', x: 1700, y: -2112, face: 's' },
  ],
  clockHold: 2,
  /** the finale rises at the Rotunda's heart */
  finaleAt: { x: ROTUNDA.x, y: ROTUNDA.y + 220 },
  finaleDelay: 4,
};
add({ kind: 'fh_counter', x: UNREFLECTED.counter.x, y: UNREFLECTED.counter.y, hw: 110, hh: 36 });
for (const p of UNREFLECTED.plinths) add({ kind: 'fh_plinth', x: p.x, y: p.y, r: 40, label: p.who });
add({ kind: 'fh_projector', x: UNREFLECTED.projector.x, y: UNREFLECTED.projector.y, r: 34 });
add({ kind: 'fh_curtain', x: UNREFLECTED.projector.x, y: UNREFLECTED.projector.y + 70, w: 240, variant: 3 });
add({ kind: 'fh_mural', x: UNREFLECTED.mural.x, y: UNREFLECTED.mural.y });
add({ kind: 'fh_mark', x: UNREFLECTED.mark.x, y: UNREFLECTED.mark.y });
for (const p of UNREFLECTED.beamPivots) add({ kind: 'fh_pivot', x: p.x, y: p.y });
add({ kind: 'fh_crystal', x: UNREFLECTED.crystal.x, y: UNREFLECTED.crystal.y, r: 26 });
add({ kind: 'fh_vanity', x: UNREFLECTED.vanity.x, y: UNREFLECTED.vanity.y, hw: 70, hh: 24 });
for (const c of UNREFLECTED.clocks) add({ kind: 'fh_clock', x: c.x, y: c.y, label: c.id, yaw: c.face === 'w' ? -Math.PI / 2 : 0 });

/** The four performers whose faces the mirrors kept (plinth order west to east), and their music-box notes (Hz). */
export const PERFORMERS = ['strongman', 'ballerina', 'clown', 'magician'] as const;
export const PERFORMER_NAMES = ['The Strongman', 'The Ballerina', 'The Clown', 'The Magician'];
export const PERFORMER_NOTES = [523.25, 659.25, 783.99, 987.77];

/** Mira's whispers: the quest's only words. Each is a clue spoken in the world, never a checklist. */
export const MIRA = {
  awaken: ['A cracked hand mirror.', 'in it, a girl stands just behind your shoulder. "Find us in the glass."'],
  faceSeen: ["A face in the glass that isn't yours.", 'touch the glass where it looks out'],
  faceFreed: (who: string, k: number) => [`${who} is free.`, `${['', 'one', 'two', 'three', 'four'][k] ?? k} of four`],
  facesDone: ['Four faces, home on their plinths.', 'the painter saw them take their bows. Stand where the painter stood.'],
  mural: ['From the brass footprints, the smear becomes a picture.', 'the performers, in the order they bowed'],
  plinthTrue: (k: number) => ['The music box answers.', `${['', 'one', 'two', 'three'][k] ?? k} of four`],
  plinthSour: ['The music box grinds to a stop.', 'begin the overture again'],
  overture: ['The overture plays.', "behind the gallery's great curtain, something with a lens wakes up"],
  projector: ['The old projector rattles to life.', 'stay with it while it warms'],
  beam: ['A beam of light pours down into the maze.', 'turn the mirrors on their plates. Lead it to the heart.'],
  door: ['"You found my room."', 'the glass at the heart of the maze is water now'],
  vanity: ['"The hour he took me."', 'read it the way the glass does. One clock in the house still shows it.'],
  wrongClock: ['Not that hour.', 'somewhere, the house laughs'],
  mira: ["Mira's Reflection follows you.", '"Take me to him."'],
  finale: ['THE HOUSE SHATTERS', "Mira's reflection screams, and the glass gives way"],
  complete: ['THE UNREFLECTED', 'Mira steps out of the glass and into the morning.'],
};

/**
 * The projector's beam through the maze for the four pivot mirrors' states (0 and 2 stand edge-on and
 * stop it, 1 is '/', 3 is '\'). It enters at the top of column 3 going south, turns at pivots, stops
 * at any panel, and is solved when it reaches the Heart's crystal. Shared by the sim and the renderer.
 */
export function beamTrace(states: number[]): { pts: { x: number; y: number }[]; hit: boolean } {
  const P = UNREFLECTED.projector;
  const pts = [{ x: P.x, y: P.y }];
  const crystal = { c: 2, r: Math.floor((UNREFLECTED.crystal.y - MAZE.y0) / MAZE.ch) };
  let c = 3, r = 0, dx = 0, dy = 1;
  for (let step = 0; step < 64; step++) {
    if (c === crystal.c && r === crystal.r) {
      pts.push({ x: UNREFLECTED.crystal.x, y: UNREFLECTED.crystal.y });
      return { pts, hit: true };
    }
    const pi = UNREFLECTED.beamPivots.findIndex((p) => p.c === c && p.r === r);
    if (pi >= 0) {
      const pv = UNREFLECTED.beamPivots[pi];
      pts.push({ x: pv.x, y: pv.y });
      const s = ((states[pi] % 4) + 4) % 4;
      if (s === 1) [dx, dy] = [-dy, -dx];
      else if (s === 3) [dx, dy] = [dy, dx];
      else return { pts, hit: false };
    }
    // the panel between this cell and the next (or the maze's edge)
    const nc = c + dx, nr = r + dy;
    let wall = 0;
    if (nc < 0 || nc >= MAZE.cols || nr < 0 || nr >= MAZE.rows) wall = 1;
    else if (dy > 0) wall = MAZE_H[r]?.[c] ?? 1;
    else if (dy < 0) wall = MAZE_H[nr]?.[c] ?? 1;
    else if (dx > 0) wall = MAZE_V[r]?.[c] ?? 1;
    else wall = MAZE_V[r]?.[nc] ?? 1;
    if (wall) {
      pts.push({ x: mazeCx(c) + dx * MAZE.cw * 0.5, y: mazeCy(r) + dy * MAZE.ch * 0.5 });
      return { pts, hit: false };
    }
    c = nc;
    r = nr;
  }
  return { pts, hit: false };
}

/** A clock time seen in a mirror: the hands flip left to right (2:50 reads as 9:10). Minutes are multiples of 5. */
export function mirroredTime(h: number, m: number): [number, number] {
  const total = ((12 * 60 - ((h % 12) * 60 + m)) % 720 + 720) % 720;
  const hh = Math.floor(total / 60);
  return [hh === 0 ? 12 : hh, total % 60];
}

/** Light pools: warm bulbs in the entrance, cold glass in the maze, amber in the corridor, violet in the gallery, stage light in the chamber. */
const LIGHTS: LightDef[] = [
  { x: 0, y: 1500, r: 620, color: [1, 0.78, 0.5], intensity: 0.85, flicker: 0.08 },
  { x: -420, y: 1860, r: 300, color: [1, 0.7, 0.4], intensity: 0.8, flicker: 0.2 },
  { x: 420, y: 1860, r: 300, color: [1, 0.7, 0.4], intensity: 0.8, flicker: 0.2 },
  { x: -760, y: 1250, r: 260, color: [0.7, 0.85, 1], intensity: 0.7, flicker: 0.12 },
  { x: 0, y: 2000, r: 520, color: [1, 0.35, 0.25], intensity: 0.6, flicker: 0.3 },
  { x: -1500, y: 1350, r: 380, color: [1, 0.75, 0.5], intensity: 0.6, flicker: 0.25 },
  { x: 1500, y: 1350, r: 380, color: [1, 0.75, 0.5], intensity: 0.6, flicker: 0.25 },
  { x: 0, y: -225, r: 760, color: [0.95, 0.6, 1], intensity: 0.8, flicker: 0.06 },
  { x: -420, y: 520, r: 300, color: [1, 0.8, 0.55], intensity: 0.55, flicker: 0.15 },
  { x: 420, y: 520, r: 300, color: [1, 0.8, 0.55], intensity: 0.55, flicker: 0.15 },
  { x: -1910, y: -1125, r: 380, color: [0.55, 0.75, 1], intensity: 0.65, flicker: 0.18 },
  { x: -1680, y: -225, r: 330, color: [0.45, 1, 0.85], intensity: 0.7, flicker: 0.1 },
  { x: -1450, y: 450, r: 380, color: [0.6, 0.8, 1], intensity: 0.6, flicker: 0.22 },
  { x: -990, y: 680, r: 300, color: [0.6, 0.75, 1], intensity: 0.55, flicker: 0.3 },
  { x: -1910, y: 680, r: 300, color: [0.6, 0.75, 1], intensity: 0.55, flicker: 0.3 },
  { x: -1000, y: -900, r: 320, color: [0.65, 0.8, 1], intensity: 0.55, flicker: 0.25 },
  { x: 1450, y: 650, r: 400, color: [1, 0.65, 0.3], intensity: 0.65, flicker: 0.35 },
  { x: 1100, y: -50, r: 380, color: [1, 0.6, 0.28], intensity: 0.6, flicker: 0.4 },
  { x: 1800, y: -450, r: 380, color: [1, 0.62, 0.3], intensity: 0.6, flicker: 0.35 },
  { x: 1450, y: -1000, r: 380, color: [1, 0.65, 0.3], intensity: 0.6, flicker: 0.3 },
  { x: -1600, y: -1850, r: 420, color: [0.7, 0.5, 1], intensity: 0.6, flicker: 0.2 },
  { x: -900, y: -1750, r: 380, color: [0.75, 0.5, 1], intensity: 0.55, flicker: 0.25 },
  { x: -600, y: -2000, r: 300, color: [1, 0.8, 0.5], intensity: 0.7, flicker: 0.12 },
  { x: -1335, y: -1560, r: 260, color: [1, 0.9, 0.7], intensity: 0.5, flicker: 0.4 },
  { x: 950, y: -1950, r: 560, color: [1, 0.9, 0.7], intensity: 0.85, flicker: 0.05 },
  { x: 500, y: -1650, r: 320, color: [1, 0.35, 0.4], intensity: 0.55, flicker: 0.15 },
  { x: 1400, y: -1650, r: 320, color: [0.4, 0.55, 1], intensity: 0.55, flicker: 0.15 },
  { x: 950, y: -1460, r: 220, color: [1, 0.85, 0.5], intensity: 0.5, flicker: 0.1 },
];

export const FUNHOUSE_LAYOUT: MapLayout = {
  half: FH_HALF,
  seaY: B + 10,
  bounds: { minX: -B, maxX: B, minY: -B, maxY: B },
  spawn: { x: 0, y: 1450 },
  props,
  stringLights: [],
  lights: LIGHTS,
  paths: [],
  plaza: { x: 0, y: 0, r: 0 },
  promenade: { y0: 1e5, y1: 1e5 },
  tiltAWhirl: null,
  greaseSlicks: [],
};

/** Floor regions for the renderer (and anything that needs "where am I"): rectangles, first match wins. */
export const FLOOR_ZONES: { id: 'maze' | 'dressing' | 'rotunda' | 'corridor' | 'gallery' | 'chamber' | 'entrance'; x0: number; x1: number; y0: number; y1: number }[] = [
  { id: 'dressing', ...UNREFLECTED.dressing },
  { id: 'maze', x0: -B, x1: -760, y0: -1350, y1: 900 },
  { id: 'corridor', x0: 760, x1: B, y0: -1350, y1: 900 },
  { id: 'rotunda', x0: -760, x1: 760, y0: -1350, y1: 900 },
  { id: 'gallery', x0: -B, x1: -200, y0: -B, y1: -1350 },
  { id: 'chamber', x0: -200, x1: B, y0: -B, y1: -1350 },
  { id: 'entrance', x0: -B, x1: B, y0: 900, y1: B },
];
export function floorZone(x: number, y: number): (typeof FLOOR_ZONES)[number]['id'] {
  for (const z of FLOOR_ZONES) if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z.id;
  return 'entrance';
}
