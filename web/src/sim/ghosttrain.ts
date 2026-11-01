// The Ghost Train's machinery (D-80): the timetable's doors, the journeys, and where creatures come from.
//
// - Doors are walls while a station's train is away or its doors are shut; refreshed every tick from the
//   timetable, on the host and in a guest's mirror alike (prediction collides with the same doors).
// - Departure moves everything inside the station's copy of the carriages into the transit copy, at the same
//   place in the same car; arrival moves everything in the transit copy into the next station's (host only;
//   guests see it through the snapshot, whose interpolation snaps on a jump).
// - Stations spawn from the map's waves (each creature has a home); the moving train has its own journey
//   spawner, boarding at its two ends only: out of the tender's coal and over the rear platform's railing.
// - Bosses fight at stations and hold still while nobody is in their place.

import { E, FINAL_ACT, FINAL_BOSS_AT, MOUTHS, REGIONS, REGION_HW, TRANSIT, TRAIN, carAtLocal, doorWalls, inTrainLocal, regionAt, trackY, trainAt, trainOrigin, walkRect, type TrainState } from '../data/ghosttrain';
import { setDynamicWalls, type Prop } from '../data/map';
import { ENEMIES } from '../data/enemies';
import type { Enemy } from './entities';
import type { Game } from './game';
import type { Player } from './player';
import { VIEW_HALF_X, VIEW_HALF_Y } from './constants';

const DOORS: Prop[][] = REGIONS.slice(0, 5).map((_, r) => doorWalls(r));

/** When the End of the Line becomes a stop: the hidden quest's points, or the final act for everyone. */
export function eFromOf(g: Game): number {
  const q = g.quests?.get<{ eFrom?: number } & import('./quest').QuestChain>('last_train');
  return Math.min(FINAL_ACT, q?.eFrom ?? Infinity);
}

/** The train right now. */
export function trainNow(g: Game): TrainState {
  return trainAt(g.time, eFromOf(g));
}

/** Which place a player (or anything) is in: a station 0..4, the moving train 5, or -1. */
export const placeOf = (x: number, y: number) => regionAt(x, y);

/** The doors: every station's copy is shut unless the train stands there with its doors open. */
export function refreshTrainDoors(g: Game): void {
  const st = trainNow(g);
  const walls: Prop[] = [];
  for (let r = 0; r < 5; r++) if (!(st.phase === 'dwell' && st.at === r && st.doors)) walls.push(...DOORS[r]);
  setDynamicWalls(walls);
}

/** The train's state at the end of the last tick (host), to see departures and arrivals. */
interface Prev { phase: TrainState['phase']; at: number }
const prevOf = new WeakMap<Game, Prev>();

/** Move everything inside region `from`'s copy of the carriages into region `to`'s, at the same place. */
export function moveAboard(g: Game, from: number, to: number): number {
  const a = trainOrigin(from), b = trainOrigin(to);
  const dx = b.x - a.x, dy = b.y - a.y;
  // inside a car or a gangway, or in a doorway (D-84: not someone on the platform pressed against its side, who
  // used to be carried off in the wall)
  const inside = (x: number, y: number) => inTrainLocal(x - a.x, y - a.y, TRAIN.wallT);
  let moved = 0;
  for (const p of g.players) {
    if (!inside(p.x, p.y)) continue;
    p.x += dx;
    p.y += dy;
    p.px = p.x;
    p.py = p.y;
    moved++;
  }
  for (const e of g.active) {
    if (!e.alive || !inside(e.x, e.y)) continue;
    e.x += dx;
    e.y += dy;
    e.px = e.x;
    e.py = e.y;
    // a creature's remembered spot (a leap's landing, a lunge's end) moves with it
    if (e.def.behavior.startsWith('gt_') && Math.abs(e.tx - (e.x - dx)) < 2500 && Math.abs(e.ty - (e.y - dy)) < 2500) {
      e.tx += dx;
      e.ty += dy;
    }
  }
  for (const k of g.pickups) {
    if (!k.alive || !inside(k.x, k.y)) continue;
    k.x += dx;
    k.y += dy;
    k.px = k.x;
    k.py = k.y;
  }
  for (const pr of g.projs) {
    if (!pr.alive || !inside(pr.x, pr.y)) continue;
    pr.x += dx;
    pr.y += dy;
    pr.px = pr.x;
    pr.py = pr.y;
    pr.ox += dx;
    pr.oy += dy;
    pr.tx += dx;
    pr.ty += dy;
  }
  for (const bl of g.bullets) {
    if (!bl.alive || !inside(bl.x, bl.y)) continue;
    bl.x += dx;
    bl.y += dy;
    bl.px = bl.x;
    bl.py = bl.y;
    bl.ox += dx;
    bl.oy += dy;
  }
  for (const h of g.hazards) {
    if (!h.alive || !inside(h.x, h.y)) continue;
    h.x += dx;
    h.y += dy;
    h.x2 += dx;
    h.y2 += dy;
    h.holeX += dx;
    h.holeY += dy;
  }
  for (const z of g.zones) {
    if (!z.alive || !inside(z.x, z.y)) continue;
    z.x += dx;
    z.y += dy;
  }
  for (const s of g.summons) {
    if (!s.alive || !inside(s.x, s.y)) continue;
    s.x += dx;
    s.y += dy;
    s.px = s.x;
    s.py = s.y;
    s.tx += dx;
    s.ty += dy;
  }
  return moved;
}

/** The map's machinery, once per tick on the host (after everything has moved). */
export function updateGhostTrain(g: Game, dt: number): void {
  refreshTrainDoors(g);
  const st = trainNow(g);
  const prev = prevOf.get(g);
  if (prev) {
    if (prev.phase === 'dwell' && st.phase === 'travel') {
      moveAboard(g, prev.at, TRANSIT);
      g.bus.emit('train', { what: 'depart', at: prev.at, to: st.to });
    } else if (prev.phase === 'travel' && st.phase === 'dwell') {
      moveAboard(g, TRANSIT, st.at);
      g.bus.emit('train', { what: 'arrive', at: st.at, to: st.to });
    } else if (prev.phase === 'approach' && st.phase === 'dwell') g.bus.emit('train', { what: 'arrive', at: st.at, to: st.to });
  }
  prevOf.set(g, { phase: st.phase, at: st.at });
  confine(g);
  bossesFollow(g, dt);
  journeySpawns(g, st, dt);
}

/** How long each boss has stood at a station nobody is at. */
const emptyFor = new WeakMap<object, number>();
/**
 * A boss left behind on a platform follows the party down the line (D-80): once nobody has been at its station
 * for a few seconds and somebody stands at another, it is waiting there. (While everyone rides, it holds still
 * where it is.) The End of the Line's two never leave it.
 */
function bossesFollow(g: Game, dt: number): void {
  for (const b of g.bosses) {
    const gb = b as typeof b & { relocate?: (r: number) => void; final?: boolean; home?: number };
    if (b.dead || !gb.relocate || gb.final) continue;
    const r = regionAt(b.x, b.y);
    if (anyoneIn(g, r)) {
      emptyFor.set(b, 0);
      continue;
    }
    const t = (emptyFor.get(b) ?? 0) + dt;
    emptyFor.set(b, t);
    if (t < FOLLOW_AFTER) continue;
    const to = bossStation(g, false);
    if (to === null || to === r) continue;
    gb.relocate(to);
    emptyFor.set(b, 0);
    g.bus.emit('banner', { text: `${b.def.name.toUpperCase()} IS WAITING`, sub: `on the platform at ${REGIONS[to].name}`, style: 'danger' });
  }
}
/** seconds a boss's station stands empty before it follows the party */
export const FOLLOW_AFTER = 4;

/** Keep every creature on the ground of the place it's in (walls do most of it; flyers and shoves the rest). */
function confine(g: Game): void {
  for (const e of g.active) {
    if (!e.alive) continue;
    const r = regionAt(e.x, e.y);
    if (r < 0) continue;
    const w = walkRect(r);
    if (r === TRANSIT) {
      // inside the carriages, whatever it is: along the train, then across the car (or the gangway) it's in
      const o = trainOrigin(TRANSIT);
      const lx = Math.max(TRAIN.rear + 6, Math.min(TRAIN.front - 6, e.x - o.x));
      const half = (carAtLocal(lx) ? TRAIN.halfW : TRAIN.gangHalf) - 6;
      e.x = o.x + lx;
      e.y = o.y + Math.max(-half, Math.min(half, e.y - o.y));
      continue;
    }
    if (e.x < w.minX) e.x = w.minX;
    else if (e.x > w.maxX) e.x = w.maxX;
    if (e.y > w.maxY) e.y = w.maxY;
    else if (e.y < w.minY - 300) e.y = w.minY - 300;
  }
  for (const b of g.bosses) {
    const r = regionAt(b.x, b.y);
    if (r < 0 || r === TRANSIT) continue;
    const w = walkRect(r);
    const ty = trackY(r) + TRAIN.halfW + 80;
    b.x = Math.max(w.minX + 80, Math.min(w.maxX - 80, b.x));
    b.y = Math.max(ty, Math.min(w.maxY - 80, b.y));
  }
  // players are never left inside a train's walls (D-84). Aboard: in a car or a gangway, nowhere else. At a station
  // whose train is away: out of its carriages' footprint and back on the platform (knocked in as the doors shut, a
  // player waited there a whole loop of the line for the doors to open again)
  const st = trainNow(g);
  for (const p of g.players) {
    if (p.dead) continue;
    const r = regionAt(p.x, p.y);
    if (r < 0) continue;
    const o = trainOrigin(r), lx = p.x - o.x, ly = p.y - o.y;
    if (r === TRANSIT) {
      if (inTrainLocal(lx, ly)) continue;
      const x = Math.max(TRAIN.rear + p.r, Math.min(TRAIN.front - p.r, lx));
      const half = (carAtLocal(x) ? TRAIN.halfW : TRAIN.gangHalf) - p.r;
      p.x = p.px = o.x + x;
      p.y = p.py = o.y + Math.max(-half, Math.min(half, ly));
      continue;
    }
    if ((st.phase === 'dwell' && st.at === r) || !inTrainLocal(lx, ly, TRAIN.wallT)) continue;
    p.y = p.py = o.y + TRAIN.halfW + TRAIN.wallT + p.r + 2;
    p.px = p.x;
  }
}

// ---------------------------------------------------------------- the journeys
/**
 * How hard a journey is at time t (D-80; docs/GHOST_TRAIN.md §6): creatures boarding per second from each
 * end, how many may be aboard at once (for a party of one), and the toughness of what boards.
 */
export function journeyPace(t: number): { rate: number; cap: number; hp: number } {
  const m = t / 60;
  // D-84: unchanged for the first ten minutes or so (hard enough), then a much denser carriage: the late journeys
  // had grown easy
  const late = Math.max(0, m - 11);
  return {
    rate: Math.min(2.6, 0.42 + 0.034 * m + 0.05 * late),
    cap: Math.round(Math.min(110, 18 + 1.25 * m + 1.6 * late)),
    hp: 1 + Math.max(0, m - 8) * 0.012,
  };
}
/** What boards a moving train, by act (weights): from Act II mostly meat, navvies above all (D-84), few with tricks. */
const JOURNEY: [string, number][][] = [
  [['gt_ticketless', 70], ['gt_coalborn', 22], ['gt_porter', 8]],
  [['gt_ticketless', 40], ['gt_coalborn', 16], ['gt_porter', 14], ['gt_navvy', 12], ['gt_railcrawler', 10], ['gt_mourner', 5], ['gt_signalman', 3]],
  [['gt_ticketless', 30], ['gt_coalborn', 12], ['gt_porter', 14], ['gt_navvy', 22], ['gt_railcrawler', 12], ['gt_mourner', 5], ['gt_signalman', 3], ['gt_mimic', 2]],
  [['gt_ticketless', 24], ['gt_coalborn', 10], ['gt_porter', 14], ['gt_navvy', 28], ['gt_railcrawler', 12], ['gt_collected', 6], ['gt_mourner', 3], ['gt_signalman', 2], ['gt_puncher', 1]],
];
const acc = new WeakMap<Game, { front: number; rear: number; side: number }>();

function journeySpawns(g: Game, st: TrainState, dt: number): void {
  if (st.phase !== 'travel') return;
  const riders = g.players.filter((p) => g.isUp(p) && regionAt(p.x, p.y) === TRANSIT);
  if (!riders.length) return;
  // a moment's quiet pulling out, none in the last seconds braking in (what's aboard arrives with you)
  if (st.t < 3 || st.arriveIn < 5) return;
  const pace = journeyPace(g.time);
  const dens = g.partyScale.density * (riders.length / Math.max(1, g.players.length) * 0.5 + 0.5);
  let aboard = 0;
  for (const e of g.active) if (e.alive && regionAt(e.x, e.y) === TRANSIT) aboard++;
  const cap = Math.round(pace.cap * dens);
  if (aboard >= cap) return;
  const a = acc.get(g) ?? { front: 0, rear: 0.5, side: 0 };
  acc.set(g, a);
  const rate = pace.rate * dens * g.events.spawnRateMult;
  a.front += dt * rate;
  a.rear += dt * rate;
  const o = trainOrigin(TRANSIT);
  const table = JOURNEY[Math.min(3, g.act - 1)];
  for (const end of ['front', 'rear'] as const) {
    while (a[end] >= 1 && aboard < cap) {
      a[end] -= 1;
      let id = table[g.rng.weighted(table.map((x) => x[1]))][0];
      // coal things climb out of the tender; nothing that phases through walls boards
      if (id === 'gt_coalborn' && end === 'rear') id = 'gt_ticketless';
      if (ENEMIES[id]?.maxAlive) {
        let n = 0;
        for (const e of g.active) if (e.alive && e.def.id === id) n++;
        if (n >= ENEMIES[id].maxAlive!) id = 'gt_ticketless';
      }
      // where it comes aboard (D-84): now and then over the ends as before (the coal things always out of the tender),
      // mostly just out of sight to the left or right of someone riding, anywhere along the carriages, so the crowd
      // closes in from both sides at once
      const rider = riders[g.rng.int(0, riders.length - 1)];
      const lx = rider.x - o.x + (end === 'front' ? 1 : -1) * (VIEW_HALF_X * 1.05 + g.rng.range(0, 280));
      let x: number, y: number;
      if (id === 'gt_coalborn' || g.rng.chance(0.3) || lx < TRAIN.rear + 30 || lx > TRAIN.front - 30) {
        const m = MOUTHS[end];
        x = o.x + m.x + g.rng.range(-10, 10);
        y = o.y + m.y + g.rng.range(-60, 60);
      } else {
        const half = (carAtLocal(lx) ? TRAIN.halfW : TRAIN.gangHalf) - 22;
        x = o.x + lx;
        y = o.y + g.rng.range(-half, half);
      }
      const e = g.spawnEnemy(id, x, y, { exact: true, elite: g.rng.chance(g.director.eliteChance() * 0.8), hpMult: pace.hp });
      if (!e) return;
      e.leashExempt = true;
      aboard++;
    }
  }
}

// ---------------------------------------------------------------- where the stations' crowds come from
/** The standing players at stations (not riding), each with their place. */
function stationPlayers(g: Game): { p: Player; r: number }[] {
  const out: { p: Player; r: number }[] = [];
  for (const p of g.players) {
    if (!g.isUp(p)) continue;
    const r = regionAt(p.x, p.y);
    if (r >= 0 && r < TRANSIT) out.push({ p, r });
  }
  return out;
}

/**
 * The anchor for the next station spawn: a standing player at a station, the one whose place has the fewest
 * creatures per player (so a party split between stations each gets a fair crowd). Null if everyone rides.
 * `skip`: a station left out (where a boss is being fought, D-84).
 */
export function stationAnchor(g: Game, skip = -1): Player | null {
  const list = stationPlayers(g).filter((it) => it.r !== skip);
  if (!list.length) return null;
  const count = new Array(TRANSIT).fill(0), pl = new Array(TRANSIT).fill(0);
  for (const { r } of list) pl[r]++;
  for (const e of g.active) {
    if (!e.alive) continue;
    const r = regionAt(e.x, e.y);
    if (r >= 0 && r < TRANSIT) count[r]++;
  }
  let best = list[0], bs = Infinity;
  for (const it of list) {
    const s = count[it.r] / pl[it.r] + g.rng.next() * 0.5;
    if (s < bs) {
      bs = s;
      best = it;
    }
  }
  return best.p;
}

/** How many creatures stand at stations (the waves' counts; what rides the train has its own), but `skip`. */
export function stationAlive(g: Game, skip = -1): number {
  let n = 0;
  for (const e of g.active) {
    if (!e.alive) continue;
    const r = regionAt(e.x, e.y);
    if (r !== TRANSIT && r !== skip) n++;
  }
  return n;
}

/** A spawn point at the anchor's station: off its screen, on that station's ground, never inside the train. */
export function stationSpawnPoint(g: Game, anchor: Player): { x: number; y: number } {
  const r = Math.max(0, regionAt(anchor.x, anchor.y));
  const w = walkRect(r);
  const minY = trackY(r) + TRAIN.halfW + 40;
  for (let attempt = 0; attempt < 14; attempt++) {
    const x = anchor.x + g.rng.range(-VIEW_HALF_X * 1.5, VIEW_HALF_X * 1.5);
    const y = anchor.y + g.rng.range(-VIEW_HALF_Y * 1.5, VIEW_HALF_Y * 1.5);
    if (Math.abs(x - anchor.x) < VIEW_HALF_X * 0.95 && Math.abs(y - anchor.y) < VIEW_HALF_Y * 0.95) continue;
    if (x < w.minX || x > w.maxX || y < minY || y > w.maxY) continue;
    if (g.players.length > 1 && g.inAnyView(x, y, 0.95)) continue;
    return { x, y };
  }
  // the station's far corners, whichever is furthest from the anchor
  const g0 = REGIONS[r];
  const cands = [[g0.cx - REGION_HW + 120, w.maxY - 100], [g0.cx + REGION_HW - 120, w.maxY - 100], [g0.cx - REGION_HW + 120, minY + 120], [g0.cx + REGION_HW - 120, minY + 120]];
  let best = cands[0], bd = -1;
  for (const c of cands) {
    const d = (c[0] - anchor.x) ** 2 + (c[1] - anchor.y) ** 2;
    if (d > bd) {
      bd = d;
      best = c;
    }
  }
  return { x: best[0], y: best[1] };
}

/** May this creature come at station r (its home), by its EnemyDef `params.home`? */
export function homeOk(id: string, r: number): boolean {
  const h = ENEMIES[id]?.params.home;
  if (typeof h !== 'string' || h === 'any') return true;
  return h.split(',').includes(REGIONS[r].id);
}

// ---------------------------------------------------------------- bosses
/** Is any standing player in region r? */
export function anyoneIn(g: Game, r: number): boolean {
  for (const p of g.players) if (g.isUp(p) && regionAt(p.x, p.y) === r) return true;
  return false;
}

/**
 * Where a boss due now should fight: the station with the most standing players (null while everyone rides:
 * it waits on the next platform). The final boss is the End of the Line's.
 */
export function bossStation(g: Game, final: boolean): number | null {
  if (final) return E;
  const list = stationPlayers(g);
  if (!list.length) return null;
  const n = new Array(TRANSIT).fill(0);
  for (const { r } of list) n[r]++;
  let best = list[0].r;
  for (let r = 0; r < TRANSIT; r++) if (n[r] > n[best]) best = r;
  return best;
}

/** The open ground south of a station's platform where its fights are staged. */
export function arenaOf(r: number): { x: number; y: number } {
  const g = REGIONS[r];
  return { x: g.cx, y: trackY(r) + 820 };
}

/** The final boss arrives at this time (the last train has terminated by then). */
export const FINAL_GATE = FINAL_BOSS_AT;

/** A creature standing still or a projectile parked in the dark between places is lost: drop it. */
export function strayCheck(g: Game, e: Enemy): boolean {
  return regionAt(e.x, e.y) < 0;
}

