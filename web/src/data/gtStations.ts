// The Ghost Train's five stations (D-80): what stands on each platform and in each station's grounds, and
// where the hidden quest's fixtures are. Every station shares a shape: the parked carriages along the track
// at the north, a long platform south of them (canopy columns, benches, lamps, the station clock), and the
// station's own grounds south of that, laid out as a place to fight in: open ground in the middle (where the
// bosses are met), structures toward the edges, lanes and choke points between them.
//
//   Hollow Junction    the grand terminal: concourse, booking office, departures board, signal box, forecourt
//   Saint Vesper's     a halt in a graveyard: headstones in blocks, mausoleums, dead yews, the chapel's belfry
//   The Cinder Works   the foundry yard: blast furnaces, slag heaps, chimneys, coke ovens, the coal chute
//   Stillwater         the village where the clocks stopped: cottages, the still pond, the church tower
//   The End of the Line  a terminus that should not exist: broken columns, the ticket barrier, then nothing
//
// The quest's fixtures in the carriages are in the train's own frame (`LT_TRAIN`): the same spot in every copy,
// so a page in Car 13 is in Car 13 wherever the train is. Design: docs/GHOST_TRAIN.md; the solution:
// docs/EASTER_EGG_GHOST_TRAIN.md (developers only).

import type { Prop } from './map';
import { C, E, GHOST_TRAIN_LAYOUT, GT_PROPS, J, REGIONS, S, TRAIN, V, trackY, trainOrigin, walkRect } from './ghosttrain';

/** The platform's south edge (y offset from the track); the station's grounds begin past it. */
export const PLATFORM_DEPTH = 270;
/** The End of the Line's ground ends here (y offset from the region's centre): beyond is the drop. */
export const END_EDGE = 640;

const props: Prop[] = [];
const add = (p: Prop) => props.push(p);
/** a door's world x at station r */
const doorXs = (r: number) => {
  const o = trainOrigin(r);
  const xs: number[] = [];
  for (const c of [1540, 1010, 1250, 470, 790, -40, 280, -380, -1040, -720, -1290]) xs.push(o.x + c);
  return xs;
};
const clearOfDoors = (r: number, x: number, m = 80) => doorXs(r).every((d) => Math.abs(d - x) > m);

// ---------------------------------------------------------------- what every platform has
/** The station clock of each station: a post clock on the platform (the quest winds them). */
export const STATION_CLOCK: { x: number; y: number }[] = [
  { x: REGIONS[J].cx - 120, y: trackY(J) + 190 },
  { x: REGIONS[V].cx + 600, y: trackY(V) + 190 },
  { x: REGIONS[C].cx - 520, y: trackY(C) + 190 },
  { x: REGIONS[S].cx + 820, y: trackY(S) + 190 },
  { x: REGIONS[E].cx - 900, y: trackY(E) + 190 },
];
/** The phantom doors (from 29:00): a door frame standing on each platform but the End of the Line's. */
export const PHANTOM_DOOR: { x: number; y: number }[] = [
  { x: REGIONS[J].cx + 1500, y: trackY(J) + 215 },
  { x: REGIONS[V].cx - 1500, y: trackY(V) + 215 },
  { x: REGIONS[C].cx + 1650, y: trackY(C) + 215 },
  { x: REGIONS[S].cx - 1500, y: trackY(S) + 215 },
];
/** Where the phantom doors let out: the End of the Line's platform, west of the barrier. */
export const PHANTOM_ARRIVAL = { x: REGIONS[E].cx - 1150, y: trackY(E) + 200 };

for (let r = 0; r < 5; r++) {
  const g = REGIONS[r], ty = trackY(r);
  const colY = ty + PLATFORM_DEPTH - 22;
  // canopy columns along the platform's south edge (the End of the Line's are broken stumps)
  for (let x = g.cx - 1900; x <= g.cx + 1900; x += 380) {
    if (!clearOfDoors(r, x, 70)) continue;
    add({ kind: r === E ? 'gt_column_broken' : 'gt_column', x, y: colY, r: 13, variant: r });
  }
  // gas lamps on the platform, between the columns (their light is the platform's)
  for (let x = g.cx - 1710; x <= g.cx + 1710; x += 760) {
    if (!clearOfDoors(r, x, 60)) continue;
    add({ kind: 'gt_lamp', x, y: ty + 168, r: 8, variant: r === E ? 1 : 0 });
  }
  // benches facing the train, kept off the doors
  for (let x = g.cx - 1520; x <= g.cx + 1520; x += 760) {
    if (!clearOfDoors(r, x, 120) || r === E) continue;
    add({ kind: 'gt_bench', x, y: ty + 222, hw: 44, hh: 12 });
  }
  add({ kind: 'gt_clock', x: STATION_CLOCK[r].x, y: STATION_CLOCK[r].y, r: 14, variant: r });
  // the station's nameboards hang from the canopy (decorative)
  for (const dx of [-1140, 1140]) add({ kind: 'gt_nameboard', x: g.cx + dx, y: ty + 238, variant: r });
  if (r < 4) add({ kind: 'gt_phantom', x: PHANTOM_DOOR[r].x, y: PHANTOM_DOOR[r].y });
}

// ---------------------------------------------------------------- Hollow Junction
/** Hollow Junction's fixtures. */
export const JUNCTION = (() => {
  const { cx, cy } = REGIONS[J];
  return {
    /** the booking office, and where its clerk is asked: at its window, on the south face (D-84: it was behind it) */
    office: { x: cx - 900, y: cy - 380 },
    booking: { x: cx - 900, y: cy - 280 },
    board: { x: cx + 40, y: cy - 520 },
    levers: { x: cx - 1850, y: cy - 420 },
    lamproom: { x: cx - 2010, y: cy - 290 },
    postbox: { x: cx + 560, y: cy - 608 },
  };
})();
{
  const { cx, cy } = REGIONS[J];
  // the concourse: the departures board, the booking office, waiting benches, the great iron pillars
  add({ kind: 'gt_board', x: JUNCTION.board.x, y: JUNCTION.board.y, hw: 130, hh: 12 });
  add({ kind: 'gt_booking', x: JUNCTION.office.x, y: JUNCTION.office.y, hw: 150, hh: 70 });
  add({ kind: 'gt_postbox', x: JUNCTION.postbox.x, y: JUNCTION.postbox.y, r: 14 });
  for (const [x, y] of [[-1350, -150], [1350, -150], [-700, 160], [700, 160], [-1850, 160], [1850, 160]]) add({ kind: 'gt_pillar', x: cx + x, y: cy + y, r: 24 });
  for (const [x, y] of [[-460, -260], [460, -260], [-460, -40], [460, -40]]) add({ kind: 'gt_waitbench', x: cx + x, y: cy + y, hw: 80, hh: 15 });
  for (const [x, y, v] of [[1180, -330, 0], [-1450, 60, 1], [1500, 420, 0], [-260, 380, 1]]) add({ kind: 'gt_cart', x: cx + x, y: cy + y, hw: 52, hh: 26, variant: v });
  // the signal box (the lever frame on its east face; the lamp room under it) and the water tower
  add({ kind: 'gt_signalbox', x: cx - 2010, y: cy - 420, hw: 120, hh: 100 });
  add({ kind: 'gt_watertower', x: cx + 1950, y: cy - 400, r: 80 });
  // the forecourt: a dry fountain, a hearse at the cab stand, and the terminal's façade along the south
  add({ kind: 'gt_fountain', x: cx, y: cy + 560, r: 110 });
  add({ kind: 'gt_hearse', x: cx - 1450, y: cy + 720, hw: 120, hh: 46 });
  add({ kind: 'gt_terminal', x: cx, y: cy + 1060, hw: 900, hh: 200 });
  add({ kind: 'gt_parcels', x: cx - 1950, y: cy + 1000, hw: 300, hh: 240 });
  add({ kind: 'gt_hotel', x: cx + 1950, y: cy + 1000, hw: 300, hh: 240 });
  for (const [x, y] of [[-560, 420], [560, 420], [-560, 760], [560, 760], [-1150, 320], [1150, 320], [-1100, 860], [1100, 860]]) add({ kind: 'gt_lamppost', x: cx + x, y: cy + y, r: 9 });
  for (const [x, y] of [[880, 520], [-900, 540], [1500, 760], [-1800, 520]]) add({ kind: 'gt_luggage_pile', x: cx + x, y: cy + y, hw: 34, hh: 24 });
}

// ---------------------------------------------------------------- Saint Vesper's Halt
/** The chapel's three bell ropes (Eli's bells), west to east. */
export const VESPER = (() => {
  const { cx, cy } = REGIONS[V];
  return {
    ropes: [{ x: cx + 1080, y: cy + 600 }, { x: cx + 1200, y: cy + 600 }, { x: cx + 1320, y: cy + 600 }],
    shelter: { x: cx + 1680, y: trackY(V) + 205 },
  };
})();
{
  const { cx, cy } = REGIONS[V];
  const ty = trackY(V);
  add({ kind: 'gt_shelter', x: VESPER.shelter.x, y: VESPER.shelter.y, hw: 150, hh: 34 });
  // an iron railing along the platform's back, with gates
  const railY = ty + PLATFORM_DEPTH + 30;
  const gates = [-1500, -700, 0, 700, 1500];
  let a = cx - 2240;
  for (const gx of [...gates, 2400]) {
    const b = Math.min(cx + gx - 90, cx + 2240);
    if (b - a > 20) add({ kind: 'gt_railing', x: (a + b) / 2, y: railY, hw: (b - a) / 2, hh: 5, w: b - a });
    a = cx + gx + 90;
  }
  // the graveyard: blocks of headstones with wide paths between them (the middle kept open for the Widow)
  const blocks: [number, number][] = [[-1900, -360], [-1300, -360], [700, -360], [1300, -360], [1900, -360], [-1900, 60], [-1300, 60], [1300, 60], [1900, 60], [-1900, 480], [-1250, 480], [-600, 820], [600, 820], [1900, 480], [-1900, 900]];
  let n = 0;
  for (const [bx, by] of blocks) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const v = (n++ * 7) % 5;
      add({ kind: 'gt_headstone', x: cx + bx + (i - 1) * 110, y: cy + by + j * 120, hw: 18, hh: 7, variant: v });
    }
  }
  add({ kind: 'gt_mausoleum', x: cx - 1600, y: cy + 260, hw: 92, hh: 74, variant: 0 });
  add({ kind: 'gt_mausoleum', x: cx + 1620, y: cy - 150, hw: 92, hh: 74, variant: 1 });
  add({ kind: 'gt_angel', x: cx - 700, y: cy + 140, r: 26 });
  add({ kind: 'gt_angel', x: cx + 700, y: cy + 380, r: 26 });
  for (const [x, y] of [[-2100, -120], [-950, -480], [1000, 160], [2120, 820], [-450, 1120], [1650, 1100], [-1650, 1120], [180, 1160]]) add({ kind: 'gt_yew', x: cx + x, y: cy + y, r: 30 });
  // the chapel (its porch and bell ropes on the north face) and the lych gate
  add({ kind: 'gt_chapel', x: cx + 1200, y: cy + 880, hw: 250, hh: 230 });
  add({ kind: 'gt_lychgate', x: cx, y: railY + 4 });
  for (const [x, y] of [[-250, -380], [250, -380], [-250, 600], [250, 600], [950, 520], [-1000, 700]]) add({ kind: 'gt_lamppost', x: cx + x, y: cy + y, r: 9, variant: 1 });
}

// ---------------------------------------------------------------- the Cinder Works
/** The coal chute (Theo's coal), on the platform beside the tender's door. */
export const CINDER = (() => {
  const { cx } = REGIONS[C];
  const o = trainOrigin(C);
  return { chute: { x: o.x + 1540 + 130, y: trackY(C) + 205 } };
})();
{
  const { cx, cy } = REGIONS[C];
  add({ kind: 'gt_chute', x: CINDER.chute.x, y: CINDER.chute.y, hw: 46, hh: 36 });
  add({ kind: 'gt_furnace', x: cx - 1300, y: cy + 320, r: 160, variant: 0 });
  add({ kind: 'gt_furnace', x: cx + 650, y: cy + 760, r: 150, variant: 1 });
  for (const [x, y] of [[-1850, 950], [1850, 180], [-150, 1130]]) add({ kind: 'gt_chimney', x: cx + x, y: cy + y, r: 52 });
  for (const [x, y, r] of [[1500, 900, 115], [-700, 860, 100], [2000, -380, 90]]) add({ kind: 'gt_slagheap', x: cx + x, y: cy + y, r });
  add({ kind: 'gt_cokeovens', x: cx + 1350, y: cy - 220, hw: 300, hh: 62 });
  add({ kind: 'gt_cokeovens', x: cx - 1500, y: cy - 330, hw: 260, hh: 62, variant: 1 });
  for (const [x, y, v] of [[-420, -360, 0], [400, 240, 1], [-1950, 300, 0], [1150, 480, 1], [-900, 1080, 0]]) add({ kind: 'gt_minecart', x: cx + x, y: cy + y, hw: 36, hh: 22, variant: v });
  add({ kind: 'gt_headframe', x: cx - 310, y: cy + 420, hw: 90, hh: 70 });
  for (const [x, y, hw, hh] of [[700, -420, 220, 14], [-2000, 640, 14, 200], [1900, 520, 14, 160]]) add({ kind: 'gt_pipe', x: cx + x, y: cy + y, hw, hh });
  for (const [x, y] of [[300, -380], [-1100, -40], [1000, 150], [-200, 800], [1650, 620], [-1650, 700]]) add({ kind: 'gt_brazier', x: cx + x, y: cy + y, r: 14 });
}

// ---------------------------------------------------------------- Stillwater
/** The church clock's face (Mira's hour), on the tower's north face. */
export const STILLWATER = (() => {
  const { cx, cy } = REGIONS[S];
  return { church: { x: cx, y: cy + 690 }, pond: { x: cx - 760, y: cy + 260, r: 250 } };
})();
{
  const { cx, cy } = REGIONS[S];
  add({ kind: 'gt_stationhouse', x: cx - 900, y: trackY(S) + PLATFORM_DEPTH + 90, hw: 170, hh: 70 });
  add({ kind: 'gt_church', x: cx, y: cy + 960, hw: 250, hh: 250 });
  add({ kind: 'gt_pond', x: STILLWATER.pond.x, y: STILLWATER.pond.y, r: STILLWATER.pond.r });
  add({ kind: 'gt_well', x: cx + 520, y: cy + 180, r: 26 });
  add({ kind: 'gt_marketcross', x: cx + 120, y: cy + 380, r: 22 });
  const cottages: [number, number, number][] = [[-1750, -250, 0], [-1750, 520, 1], [1750, -250, 2], [1750, 520, 0], [-1000, 980, 1], [1000, 980, 2], [-2000, 1080, 0], [2000, 1080, 1]];
  for (const [x, y, v] of cottages) add({ kind: 'gt_cottage', x: cx + x, y: cy + y, hw: 120, hh: 92, variant: v });
  for (const [x, y, hw] of [[-1300, 140, 120], [1300, 140, 120], [-1250, 760, 100], [1250, 760, 100]]) add({ kind: 'gt_picket', x: cx + x, y: cy + y, hw, hh: 5, w: hw * 2 });
  for (const [x, y] of [[-380, -300], [380, -300], [-380, 620], [380, 620], [-1350, 420], [1350, 420], [0, 180]]) add({ kind: 'gt_lamppost', x: cx + x, y: cy + y, r: 9, variant: 2 });
  for (const [x, y] of [[-2100, -400], [2100, 220], [-450, 1150], [520, 1150], [1550, 1150]]) add({ kind: 'gt_willow', x: cx + x, y: cy + y, r: 34 });
}

// ---------------------------------------------------------------- the End of the Line
/** The ticket barrier (the punch on its box; your own ticket punched at it), and where the four lost passengers wait. */
export const END = (() => {
  const { cx, cy } = REGIONS[E];
  const ty = trackY(E);
  return {
    barrier: { x: cx + 40, y: ty + PLATFORM_DEPTH + 40 },
    passengers: [
      { x: cx - 1500, y: ty + 175 },
      { x: cx - 520, y: ty + 190 },
      { x: cx + 560, y: ty + 180 },
      { x: cx + 1380, y: ty + 190 },
    ],
    buffers: { x: trainOrigin(E).x + TRAIN.locoFront + 140, y: ty },
  };
})();
{
  const { cx, cy } = REGIONS[E];
  const ty = trackY(E);
  // the barrier across the platform's south side: turnstiles with gaps
  const by = ty + PLATFORM_DEPTH + 40;
  for (const [x0, x1] of [[-2240, -900], [-740, -120], [200, 820], [980, 2240]]) add({ kind: 'gt_barrier', x: cx + (x0 + x1) / 2, y: by, hw: (x1 - x0) / 2, hh: 8, w: x1 - x0 });
  add({ kind: 'gt_ticketbox', x: END.barrier.x, y: by + 2, hw: 30, hh: 14 });
  add({ kind: 'gt_buffers', x: END.buffers.x, y: END.buffers.y });
  // the concourse that leads nowhere: broken pillars, a fallen clock face, luggage nobody claimed
  for (const [x, y] of [[-1500, -200], [1500, -200], [-800, 150], [800, 150], [-1900, 320], [1900, 320]]) add({ kind: 'gt_pillar_broken', x: cx + x, y: cy + y, r: 26 });
  add({ kind: 'gt_fallenclock', x: cx + 1200, y: cy + 420, r: 120 });
  for (const [x, y, v] of [[-1200, 420, 0], [-300, 480, 1], [400, -120, 0], [1800, -80, 1], [-1950, -150, 0]]) add({ kind: 'gt_luggage_pile', x: cx + x, y: cy + y, hw: 34, hh: 24, variant: v });
  for (const [x, y] of [[-600, -330], [600, -330], [-1300, 520], [1300, 520]]) add({ kind: 'gt_lamppost', x: cx + x, y: cy + y, r: 9, variant: 3 });
  // the edge of the world (decorative; the ground simply ends)
  add({ kind: 'gt_edge_world', x: cx, y: cy + END_EDGE });
}

// ---------------------------------------------------------------- the stations' bounds (D-84)
/**
 * Every edge a player is held at has something standing on it (it was an invisible wall): a fence down both sides
 * from the platform's edge, and along the south a fence with a gate in its middle, shut and chained. Just outside
 * the walk clamp (walkRect), so nobody brushes them. The Junction's terminal and corner buildings are walls of
 * their own, its gates standing in the gaps between them; the End of the Line's brink has a railing and no gate.
 */
export const STATION_GATES: { x: number; y: number; r: number }[] = [];
{
  const FENCE: Prop['kind'][] = ['gt_railing', 'gt_railing', 'gt_yardwall', 'gt_drystone', 'gt_railing'];
  const GATE_HW = 114;
  for (let r = 0; r < 5; r++) {
    const g = REGIONS[r], w = walkRect(r), kind = FENCE[r];
    const t = kind === 'gt_railing' ? 4 : kind === 'gt_yardwall' ? 9 : 13;
    const xW = w.minX - 24, xE = w.maxX + 24, yS = w.maxY + 26, yN = trackY(r) + TRAIN.halfW + TRAIN.wallT + 14;
    const run = (x0: number, x1: number) => {
      if (x1 - x0 > 20) add({ kind, x: (x0 + x1) / 2, y: yS, hw: (x1 - x0) / 2, hh: t, w: x1 - x0 });
    };
    const side = (x: number, y0: number, y1: number) => {
      if (y1 - y0 > 20) add({ kind, x, y: (y0 + y1) / 2, hw: t, hh: (y1 - y0) / 2 });
    };
    const gate = (x: number) => {
      add({ kind: 'gt_gate', x, y: yS, hw: GATE_HW, hh: 10, variant: r });
      STATION_GATES.push({ x, y: yS, r });
    };
    if (r === J) {
      side(xW, yN, g.cy + 740);
      side(xE, yN, g.cy + 740);
      for (const [a, b] of [[g.cx - 1650, g.cx - 900], [g.cx + 900, g.cx + 1650]]) {
        const mid = (a + b) / 2;
        run(a, mid - GATE_HW);
        gate(mid);
        run(mid + GATE_HW, b);
      }
      continue;
    }
    side(xW, yN, yS);
    side(xE, yN, yS);
    if (r === E) {
      run(xW, xE);
      continue;
    }
    run(xW, g.cx - GATE_HW);
    gate(g.cx);
    run(g.cx + GATE_HW, xE);
  }
}

// ---------------------------------------------------------------- dressing (decorative: no colliders)
/** A deterministic scatter for each station's clutter. */
function scatter(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Is (x, y) clear of every solid prop by `m`? (so dressing never pokes out of a wall) */
function clear(x: number, y: number, m: number): boolean {
  for (const p of props) {
    if (p.r && (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + m) ** 2) return false;
    if (p.hw && p.hh && Math.abs(p.x - x) < p.hw + m && Math.abs(p.y - y) < p.hh + m) return false;
  }
  return true;
}
const DRESS: [number, Prop['kind'][], number][] = [
  [J, ['gt_crate', 'gt_barrel', 'gt_sack', 'gt_paper'], 40],
  [V, ['gt_lily', 'gt_grave_flowers', 'gt_leaves', 'gt_rubble'], 70],
  [C, ['gt_coalpile', 'gt_barrel', 'gt_rubble', 'gt_sack', 'gt_crate'], 70],
  [S, ['gt_leaves', 'gt_crate', 'gt_barrel', 'gt_flowerbox'], 46],
  [E, ['gt_paper', 'gt_rubble', 'gt_ticketpile'], 50],
];
for (const [r, kinds, n] of DRESS) {
  const g = REGIONS[r], rnd = scatter(9001 + r * 77);
  const top = trackY(r) + PLATFORM_DEPTH + 40, bottom = r === E ? g.cy + END_EDGE - 60 : g.cy + 1200;
  for (let i = 0, made = 0; i < n * 6 && made < n; i++) {
    const x = g.cx - 2150 + rnd() * 4300, y = top + rnd() * (bottom - top);
    // keep the bosses' ground (round the station's middle) a little clearer
    if (Math.abs(x - g.cx) < 500 && Math.abs(y - (trackY(r) + 820)) < 320 && rnd() < 0.7) continue;
    if (!clear(x, y, 30)) continue;
    add({ kind: kinds[Math.floor(rnd() * kinds.length)], x, y, variant: Math.floor(rnd() * 3), yaw: rnd() * Math.PI * 2 });
    made++;
  }
}
// more light where the yards were darkest: lamp posts along the Works' tub rails and the churchyard's paths
for (const [x, y] of [[-1700, -200], [-800, 300], [200, -60], [900, 400], [1700, 300], [-1300, 900], [500, 1100]]) add({ kind: 'gt_lamppost', x: REGIONS[C].cx + x, y: REGIONS[C].cy + y, r: 9, variant: 0 });
for (const [x, y] of [[-1600, -150], [1600, 300], [-1500, 650], [1000, 900]]) add({ kind: 'gt_lamppost', x: REGIONS[V].cx + x, y: REGIONS[V].cy + y, r: 9, variant: 1 });

// ---------------------------------------------------------------- the quest's fixtures in the carriages
/** In the train's own frame. Pages: two hiding places in each of four cars (one used a night). */
export const LT_TRAIN = {
  pages: [
    [{ x: 1118, y: -10 }, { x: 960, y: 20 }],
    [{ x: -62, y: 4 }, { x: 236, y: -6 }],
    [{ x: -560, y: 78 }, { x: -200, y: -74 }],
    [{ x: -1062, y: -64 }, { x: -822, y: -66 }],
  ],
  /** where each lost passenger sits once aboard: Ada (dining), Theo (coach), Mira (sleeper), Eli (Car 13) */
  seats: [{ x: 128, y: -36 }, { x: 634, y: -60 }, { x: -942, y: -60 }, { x: -380, y: -62 }],
  letter: { x: 128, y: -34 },
  firebox: { x: 1650, y: 30 },
  whistle: { x: 1650, y: -78 },
  /** the train's own signal lamp (D-84): its lamp box inside the tender's front, its post outside on the corner */
  lampbox: { x: 1660, y: 84 },
  lamp: { x: 1702, y: 100 },
  /** anywhere in the tender: the lantern shown to a signal ahead */
  tender: { x: 1540, y: 0, x0: 1390, x1: 1690 },
};

/** The lost passengers, in seat order. */
export const PASSENGERS = ['Ada Penhallow', 'Theo Fairweather', 'Mira', 'Eli Marrow'] as const;

// fold the stations' props into the map's
GT_PROPS.push(...props);
export const STATION_PROPS = props;
export { GHOST_TRAIN_LAYOUT };
