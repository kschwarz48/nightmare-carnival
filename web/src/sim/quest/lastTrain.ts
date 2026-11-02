// "The Last Train Home" — the Ghost Train's hidden quest chain (D-80, reworked in D-90; solution:
// docs/EASTER_EGG_GHOST_TRAIN.md). The train goes at the whistle since D-90, so the quest is a journey down the line,
// station by station, mending each stopped clock with the help of the place it stands in.
//
//   0 TICKET      Ask at Hollow Junction's booking office: a ticket for THE LAST TRAIN HOME, "not valid until the
//                 line keeps time". Every station clock has stopped.
//   1 KEY         The clocks' winding key lies somewhere about the Junction (one of five places a night).
//   2 JUNCTION    Wind the Junction's clock while the train stands in: aboard, the sleeper's compartment doors
//                 slide open (they were shut all night).
//   3 PAGES       Four torn pages of a timetable, one in each compartment: the thirteenth train calls where the
//                 clocks keep time and goes at the guard's whistle; its footnote has the signal box's levers.
//   4 STATIONS    Each station's clock has its own trouble (any order; the train goes on at the whistle):
//                 Saint Vesper's  light three grave lamps with a taper from the chapel candles (it burns down), then
//                                 keep the vigil at the empty grave while the dead rise; wind the clock.
//                 the Cinder Works gather three pieces of brass about the yard into the crucible, then walk the
//                                 ladle of molten brass along the tub rails to the clock (it stops cold when
//                                 nobody walks with it); wind the clock.
//                 Stillwater      wake the three moments the village is frozen in (stand in each), reel the
//                                 pendulum out of the still pond, carry it to the clock and hang it; wind it.
//   5 PREPARE     Back at the Junction: the signal battery from the lamp room fitted to the train's lamp box (its
//                 signal lamp burns red), and the signal box's levers pulled in the footnote's order.
//   6 SIGNAL      On a journey, a signal stands at danger: show it green from the lamp box as the engine passes,
//                 and the points take the train to the End of the Line. Missed, it runs on as usual, and the signal
//                 stands again on the next journey.
//   7 PUNCH       At the End of the Line, take the Conductor's spare punch from the ticket box.
//   8 PASSENGERS  Punch the tickets of the four lost passengers on its platform (Ada Penhallow, Theo Fairweather,
//                 Mira, Eli Marrow) while the train stands there: they board.
//   9 DELIVERIES  Each has one errand along the line, any order: Ada's letter (from her table in the dining car) to
//                 the Junction's post box; Theo's coal (three shovelfuls from the Cinder Works' chute into the
//                 tender, then three stokes on the move with the boiler's needle at the top); Mira's hour (turn
//                 Stillwater's church clock to tonight's hour while the train is in); Eli's bells (ring Saint
//                 Vesper's three bells in tonight's order while the train is in).
//  10 LAST TICKET Punch your own ticket at the End of the Line's barrier while a train stands there.
//  11 EXPRESS     When the Night Express falls (the final boss: 34:00, once every other boss has fallen)…
//  12 FINALE      …the Conductor comes for the passengers: the secret boss.
//  13 HOMEWARD    Defeat him: the last train home pulls out, every window lit…
//  14 COMPLETE    …the true dawn, an achievement, the Conductor's Punch unlocked.
//
// Everything is a press of interact within reach, or standing somewhere. Co-op: one shared chain, any standing player
// can act, and whatever is carried (the key, a taper, brass, the pendulum, the battery, the punch, Ada's letter, a
// shovel of coal) passes to the nearest standing player if its carrier falls. The host runs it; guests receive its
// state as bytes (`netState`), including `eFrom` (when the End of the Line opened for the hidden quest).

import { dist2 } from '../../core/math';
import { Rng } from '../../core/rng';
import { CONDUCTOR_DEF } from '../../data/bosses';
import { C, E, J, REGIONS, S, TRANSIT, TRAIN, V, inTrainLocal, legSpeed, regionAt, trackY, trainOrigin, walkRect } from '../../data/ghosttrain';
import { CINDER, END, JUNCTION, LT_KEY_SPOTS, LT_STILL, LT_TRAIN, LT_VESPER, LT_WORKS, PASSENGERS, STATION_CLOCK, STILLWATER, VESPER } from '../../data/gtStations';
import { LAST_TRAIN } from '../../data/lastTrain';
import { DAWN_TIME } from '../../data/waves';
import { createBoss } from '../bosses';
import type { Game } from '../game';
import { runOf, trainNow } from '../ghosttrain';
import { QuestChain } from './quest';

export const LT = { Ticket: 0, Key: 1, Junction: 2, Pages: 3, Stations: 4, Prepare: 5, Signal: 6, Punch: 7, Passengers: 8, Deliveries: 9, LastTicket: 10, Express: 11, Finale: 12, Homeward: 13, Complete: 14 } as const;
/** Each station's clock, step by step (`step[r]`): Saint Vesper's lamps, vigil, wind; the Works' brass, ladle, wind;
 *  Stillwater's moments, pond, pendulum, wind. A clock whose step is at its last is running. */
export const CLOCK_STEPS = [0, 3, 3, 4] as const;

export type LTKind = 'booking' | 'board' | 'key' | 'clock' | 'page' | 'candles' | 'gravelamp' | 'scrap' | 'crucible' | 'pendulum' | 'lamproom' | 'lampbox' | 'lever' | 'punch' | 'passenger' | 'letter' | 'postbox' | 'chute' | 'coal' | 'stoke' | 'church' | 'rope' | 'ticket';

export interface LTInteraction {
  kind: LTKind;
  i: number;
  x: number;
  y: number;
  label: string;
}

/** Seconds before the same thing answers another press. */
const COOLDOWN: Partial<Record<LTKind, number>> = { booking: 2.5, board: 2, clock: 1, lampbox: 0.4, lever: 0.35, stoke: 0.4, church: 0.35, rope: 0.5, passenger: 0.5, candles: 1, gravelamp: 0.5 };

/** The boiler's needle (0..1, 1 at the top of its swing) at sim time t. */
export function gaugeAt(t: number): number {
  return 0.5 - 0.5 * Math.cos((t / LAST_TRAIN.gaugePeriod) * Math.PI * 2);
}

/** A point `d` units along a polyline, and the polyline's length. */
export function alongPath(path: { x: number; y: number }[], d: number): { x: number; y: number } {
  let left = Math.max(0, d);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], L = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= L) return { x: a.x + ((b.x - a.x) * left) / L, y: a.y + ((b.y - a.y) * left) / L };
    left -= L;
  }
  return { ...path[path.length - 1] };
}
export function pathLength(path: { x: number; y: number }[]): number {
  let n = 0;
  for (let i = 1; i < path.length; i++) n += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return n;
}
export const LADLE_LEN = pathLength(LT_WORKS.ladle);

export class LastTrainChain extends QuestChain {
  readonly id = LAST_TRAIN.id;
  /** where the winding key lies tonight (an index of LT_KEY_SPOTS), and who carries it */
  keyAt = 0;
  keyBy = 255;
  /** which of each compartment's two places holds its page tonight (bit per compartment), and the pages taken */
  pageAt = 0;
  pages = 0;
  /** the station clocks running (bit per station J, V, C, S), and how far each station's trouble is mended */
  clocks = 0;
  step = [0, 0, 0, 0];
  /** Saint Vesper's: the grave lamps lit (bits), the taper's carrier and its seconds left, the vigil (0..1) */
  lamps = 0;
  taperBy = 255;
  taperT = 0;
  vigil = 0;
  /** the Cinder Works: which three of the five places hold brass tonight (bits), the ones taken, who carries one,
   *  how many are in the crucible, and how far the ladle has come along its rails (units) */
  scrapAt = 0b00111;
  scrapsTaken = 0;
  scrapBy = 255;
  crucible = 0;
  ladle = 0;
  /** Stillwater: each frozen moment's waking (0..1), the pond's reeling (0..1), who carries the pendulum */
  moments = [0, 0, 0];
  reel = 0;
  pendulumBy = 255;
  /** the Junction again: who carries the battery, whether it is in the train's lamp box, the seconds the lamp still
   *  shows green; the lever order tonight (three of five), how far along it the frame is */
  batteryBy = 255;
  batteryIn = 0;
  greenT = 0;
  levers = [0, 1, 2];
  leverStep = 0;
  /** where each leg's signal stands (0..1 of its leg, by the station it leaves), and the journey it cleared on */
  sigAt = [0.5, 0.5, 0.5, 0.5, 0.5];
  clearedTrip = 255;
  /** when the End of the Line opened for the hidden quest (Infinity: not yet; the final act opens it for everyone) */
  eFrom = Infinity;
  punchBy = 255;
  /** the passengers aboard (bit per passenger), and their errands done */
  boarded = 0;
  tasks = 0;
  letterBy = 255;
  /** Eli's bells: the order (rope indices, west to east) and how far along it */
  bellOrder = [0, 1, 2];
  bellStep = 0;
  /** Theo's coal: who carries a shovelful, how many are in the tender, the good stokes so far */
  coalBy = 255;
  coal = 0;
  stokes = 0;
  /** Mira's hour: where the church clock stands and where it should */
  hour = 12;
  targetHour = 3;
  finaleT = -1;
  homewardT = -1;
  private rng!: Rng;
  private cool = new Map<string, number>();
  /** journeys whose signal has been called out, the train's distance along the leg at the last tick (host-side) */
  private called = new Set<number>();
  private lastDist = 0;
  /** host-side pacing for the creatures each mending stirs up */
  private stirT = 0;

  init(): void {
    const r = (this.rng = new Rng((this.g.cfg.seed ^ 0x13181899) >>> 0));
    this.keyAt = r.int(0, LT_KEY_SPOTS.length - 1);
    this.pageAt = r.int(0, 15);
    this.sigAt = [0, 1, 2, 3, 4].map(() => 0.3 + r.next() * 0.4);
    const pool = [0, 1, 2, 3, 4];
    r.shuffle(pool);
    this.levers = pool.slice(0, LAST_TRAIN.leverSteps);
    const spots = [0, 1, 2, 3, 4];
    r.shuffle(spots);
    this.scrapAt = spots.slice(0, 3).reduce((m, k) => m | (1 << k), 0);
    this.bellOrder = [0, 1, 2];
    do r.shuffle(this.bellOrder);
    while (this.bellOrder[0] === 0 && this.bellOrder[1] === 1);
    this.targetHour = r.int(1, 11);
    this.hour = 12;
  }

  get complete(): boolean {
    return this.stage === LT.Complete;
  }

  /** The sleeper's compartments stand open once the Junction's clock runs (the doors' walls read this, D-90). */
  get compartmentsOpen(): boolean {
    return this.stage >= LT.Pages;
  }

  /** The page in compartment k tonight, in the train's own frame. */
  pageSpot(k: number): { x: number; y: number } {
    return LT_TRAIN.pages[k][(this.pageAt >> k) & 1];
  }

  /** Where the ladle of molten brass stands on its rails now. */
  ladleAt(): { x: number; y: number } {
    return alongPath(LT_WORKS.ladle, this.ladle);
  }

  /** Is station r's clock running? */
  running(r: number): boolean {
    return !!(this.clocks & (1 << r));
  }

  /** A fixture in the train's frame, in the copy of the carriages the player at (x, y) is in (null if not in one). */
  private inTrain(x: number, y: number, at: { x: number; y: number }): { x: number; y: number } | null {
    const r = regionAt(x, y);
    if (r < 0) return null;
    const o = trainOrigin(r);
    if (!inTrainLocal(x - o.x, y - o.y, 8)) return null;
    return { x: o.x + at.x, y: o.y + at.y };
  }

  /** The train is standing at station r with its doors open. */
  private trainIn(r: number): boolean {
    const st = trainNow(this.g);
    return st.phase === 'dwell' && st.at === r && st.doors;
  }

  /** The journey's signal (at the Signal stage): seconds until the engine passes it (Infinity once past, or none). */
  signalAhead(): { leg: number; inS: number } {
    const st = trainNow(this.g);
    if (st.phase !== 'travel' || runOf(this.g).empty || st.at > E) return { leg: -1, inS: Infinity };
    const leg = st.at;
    const d = this.sigAt[leg] * st.legDist - st.dist;
    if (d < 0) return { leg, inS: Infinity };
    return { leg, inS: d / Math.max(60, legSpeed(st.t, st.len)) };
  }

  /** What the train's own signal lamp shows: 0 dark (flickering), 1 red, 2 green. */
  lamp(): 0 | 1 | 2 {
    if (this.stage > LT.Signal) return 2;
    if (!this.batteryIn) return 0;
    return this.greenT > 0 ? 2 : 1;
  }

  interaction(x: number, y: number, who = this.g.player.index): LTInteraction | null {
    const R = LAST_TRAIN.reach;
    const list: LTInteraction[] = [];
    const here = regionAt(x, y);
    const push = (kind: LTKind, i: number, at: { x: number; y: number } | null, label: string) => {
      if (at) list.push({ kind, i, x: at.x, y: at.y, label });
    };
    // the booking clerk answers at every stage (the ticket first, then a hint)
    if (this.stage < LT.Finale && here === J) push('booking', 0, JUNCTION.booking, this.stage === LT.Ticket ? 'Ask at the booking office' : 'Ask the booking clerk');
    switch (this.stage) {
      case LT.Key:
        if (here === J && this.keyBy === 255) push('key', 0, LT_KEY_SPOTS[this.keyAt], 'Pick up the brass key');
        if (here === J) push('clock', J, STATION_CLOCK[J], 'Look at the stopped clock');
        break;
      case LT.Junction:
        if (here === J) push('clock', J, STATION_CLOCK[J], this.keyBy === who ? 'Wind the station clock' : 'Look at the stopped clock');
        break;
      case LT.Pages:
        for (let k = 0; k < 4; k++) if (!(this.pages & (1 << k))) push('page', k, this.inTrain(x, y, this.pageSpot(k)), 'Pick up the torn page');
        break;
      case LT.Stations:
        if (here >= V && here <= S) {
          const st = this.step[here];
          push('clock', here, STATION_CLOCK[here], st === CLOCK_STEPS[here] - 1 && this.keyBy === who ? 'Wind the station clock' : here === S && st === 2 && this.pendulumBy === who ? 'Hang the pendulum' : 'Look at the stopped clock');
        }
        if (here === V && this.step[V] === 0) {
          if (this.taperBy === 255) push('candles', 0, LT_VESPER.candles, 'Light a taper at the altar candles');
          if (this.taperBy === who) LT_VESPER.lamps.forEach((l, k) => { if (!(this.lamps & (1 << k))) push('gravelamp', k, l, 'Light the grave lamp'); });
        }
        if (here === C && this.step[C] === 0) {
          if (this.scrapBy === 255) LT_WORKS.scrapSpots.forEach((sp, k) => { if ((this.scrapAt & (1 << k)) && !(this.scrapsTaken & (1 << k))) push('scrap', k, sp, 'Pick up the brass cog'); });
          if (this.scrapBy === who) push('crucible', 0, LT_WORKS.crucible, 'Melt the cog in the crucible');
        }
        if (here === S && this.step[S] === 2 && this.pendulumBy === 255) push('pendulum', 0, LT_STILL.bank, 'Pick up the pendulum');
        break;
      case LT.Prepare:
        if (here === J) {
          if (!this.batteryIn && this.batteryBy === 255) push('lamproom', 0, JUNCTION.lamproom, 'Take the signal battery');
          if (this.leverStep < LAST_TRAIN.leverSteps) {
            push('board', 1, JUNCTION.board, 'Read the departures board');
            for (let k = 0; k < LAST_TRAIN.levers; k++) push('lever', k, { x: JUNCTION.levers.x, y: JUNCTION.levers.y + (k - 2) * 38 }, `Pull lever ${k + 1}`);
          }
        }
        if (!this.batteryIn && this.batteryBy === who) push('lampbox', 0, this.inTrain(x, y, LT_TRAIN.lampbox), 'Fit the battery to the signal lamp');
        break;
      case LT.Signal:
        push('lampbox', 1, this.inTrain(x, y, LT_TRAIN.lampbox), 'Switch the signal lamp to green');
        break;
      case LT.Deliveries:
        if (!(this.tasks & 1)) {
          if (this.letterBy === 255) push('letter', 0, this.inTrain(x, y, LT_TRAIN.letter), 'Take Ada\'s letter');
          else if (this.letterBy === who && here === J) push('postbox', 0, JUNCTION.postbox, 'Post Ada\'s letter');
        }
        if (!(this.tasks & 2)) {
          if (this.coal < LAST_TRAIN.coalLoads) {
            if (this.coalBy === 255 && here === C) push('chute', 0, CINDER.chute, 'Take a shovel of coal');
            if (this.coalBy === who) push('coal', 0, this.inTrain(x, y, LT_TRAIN.firebox), 'Shovel the coal into the tender');
          } else if (regionAt(x, y) === TRANSIT) push('stoke', 0, this.inTrain(x, y, LT_TRAIN.firebox), 'Stoke the firebox');
        }
        if (!(this.tasks & 4) && here === S) push('church', 0, STILLWATER.church, 'Turn the church clock\'s hands');
        if (!(this.tasks & 8) && here === V) VESPER.ropes.forEach((rp, k) => push('rope', k, rp, `Ring the ${['west', 'middle', 'east'][k]} bell`));
        break;
    }
    if (here === E) {
      if (this.stage === LT.Punch) push('punch', 0, END.barrier, 'Take the Conductor\'s punch');
      if (this.stage === LT.Passengers && this.punchBy === who) END.passengers.forEach((p, k) => { if (!(this.boarded & (1 << k))) push('passenger', k, p, `Punch ${PASSENGERS[k]}'s ticket`); });
      if (this.stage === LT.LastTicket && this.punchBy === who) push('ticket', 0, END.barrier, 'Punch your own ticket');
    }
    let best: LTInteraction | null = null, bd = Infinity;
    for (const it of list) {
      const d = dist2(x, y, it.x, it.y);
      if (d < (R[it.kind] ?? 90) ** 2 && d < bd) {
        best = it;
        bd = d;
      }
    }
    return best;
  }

  update(dt: number): void {
    const g = this.g;
    if (g.phase !== 'play') return;
    const up = g.players.filter((p) => g.isUp(p));
    for (const [k, t] of this.cool) if (t - dt <= 0) this.cool.delete(k); else this.cool.set(k, t - dt);
    for (const p of up) {
      if (!g.inputs[p.index]?.interact) continue;
      const it = this.interaction(p.x, p.y, p.index);
      if (!it) continue;
      const key = `${it.kind}${it.i}`;
      if (this.cool.has(key)) continue;
      this.cool.set(key, COOLDOWN[it.kind] ?? 0.25);
      this.use(it, p.index);
    }
    // whatever is carried passes to the nearest standing player if its carrier falls
    const pass = (by: number): number => {
      if (by === 255) return 255;
      const c = g.players[by];
      if (c && g.isUp(c)) return by;
      return up.length ? g.nearestLiving(c?.x ?? 0, c?.y ?? 0).index : by;
    };
    this.keyBy = pass(this.keyBy);
    this.scrapBy = pass(this.scrapBy);
    this.pendulumBy = pass(this.pendulumBy);
    this.batteryBy = pass(this.batteryBy);
    this.punchBy = pass(this.punchBy);
    this.letterBy = pass(this.letterBy);
    this.coalBy = pass(this.coalBy);
    // a taper burns down (and goes out with its carrier)
    if (this.taperBy !== 255) {
      this.taperT -= dt;
      const c = g.players[this.taperBy];
      if (this.taperT <= 0 || !c || !g.isUp(c)) {
        this.cue('lt_taper_out', c ? { x: c.x, y: c.y } : {});
        this.taperBy = 255;
        this.taperT = 0;
      }
    }
    this.greenT = Math.max(0, this.greenT - dt);
    if (this.stage === LT.Stations) this.mend(dt, up);
    this.judgeSignal();
    if (this.stage === LT.Finale && this.finaleT >= 0) {
      this.finaleT -= dt;
      if (this.finaleT <= 0) {
        this.finaleT = -1;
        const b = createBoss(g, CONDUCTOR_DEF, { immediate: true, noChest: true });
        g.bosses.push(b);
        this.cue('lt_conductor', { x: b.x, y: b.y });
      }
    }
    if (this.stage === LT.Homeward && this.homewardT >= 0) {
      this.homewardT -= dt;
      if (this.homewardT <= 0) this.finish();
    }
  }

  /** The standing players within r of (x, y). */
  private within(up: { x: number; y: number }[], x: number, y: number, r: number): number {
    let n = 0;
    for (const p of up) if (dist2(p.x, p.y, x, y) <= r * r) n++;
    return n;
  }

  /** Creatures of the place stirred up round (x, y) by a mending (a few at a time, never in view of anyone). */
  private stir(x: number, y: number, ids: string[], every: number, dt: number): void {
    const g = this.g;
    this.stirT -= dt;
    if (this.stirT > 0) return;
    this.stirT = every;
    const r = regionAt(x, y);
    if (r < 0 || r >= TRANSIT) return;
    const w = walkRect(r), top = trackY(r) + TRAIN.halfW + 60;
    for (let k = 0; k < 2; k++) {
      const a = g.rng.angle(), d = g.rng.range(330, 460);
      const sx = Math.max(w.minX + 40, Math.min(w.maxX - 40, x + Math.cos(a) * d));
      const sy = Math.max(top, Math.min(w.maxY - 40, y + Math.sin(a) * d));
      const e = g.spawnEnemy(ids[g.rng.int(0, ids.length - 1)], sx, sy, { exact: true });
      if (e) e.leashExempt = true;
    }
  }

  /** The stations' clocks, mended by standing and walking (host): the vigil, the ladle, the moments, the pond. */
  private mend(dt: number, up: { x: number; y: number }[]): void {
    const L = LAST_TRAIN;
    // Saint Vesper's: the vigil at the empty grave (it fills while anyone keeps it, and slips back while nobody does)
    if (this.step[V] === 1) {
      const v = LT_VESPER.vigil;
      if (this.within(up, v.x, v.y, v.r)) {
        this.vigil = Math.min(1, this.vigil + dt / L.vigil);
        this.stir(v.x, v.y, ['gt_gravebound', 'gt_gravebound', 'gt_mourner'], 3.2, dt);
      } else this.vigil = Math.max(0, this.vigil - (dt / L.vigil) * 0.35);
      if (this.vigil >= 1) {
        this.step[V] = 2;
        this.cue('lt_vigil_done', { x: v.x, y: v.y });
      }
    }
    // the Cinder Works: the ladle rolls on while anyone walks beside it, and stops cold when nobody does
    if (this.step[C] === 1) {
      const at = this.ladleAt();
      if (this.within(up, at.x, at.y, L.ladleNear)) {
        this.ladle = Math.min(LADLE_LEN, this.ladle + L.ladleSpeed * dt);
        this.stir(at.x, at.y, ['gt_coalborn', 'gt_coalborn', 'gt_riveter', 'gt_hound'], 3.6, dt);
      }
      if (this.ladle >= LADLE_LEN) {
        this.step[C] = 2;
        this.cue('lt_ladle_done', { x: at.x, y: at.y });
      }
    }
    // Stillwater: each frozen moment wakes while somebody stands in it; then the pendulum is reeled out of the pond
    if (this.step[S] === 0) {
      LT_STILL.moments.forEach((m, k) => {
        if (this.moments[k] >= 1) return;
        if (this.within(up, m.x, m.y, m.r)) {
          this.moments[k] = Math.min(1, this.moments[k] + dt / L.moment);
          this.stir(m.x, m.y, ['gt_stillfolk', 'gt_stillfolk', 'gt_newsboy'], 3, dt);
          if (this.moments[k] >= 1) {
            const n = this.moments.filter((v) => v >= 1).length;
            this.cue('lt_moment', { x: m.x, y: m.y, a: k, b: n });
            if (n === 3) this.step[S] = 1;
          }
        } else this.moments[k] = Math.max(0, this.moments[k] - (dt / L.moment) * 0.25);
      });
    } else if (this.step[S] === 1) {
      const b = LT_STILL.bank;
      if (this.within(up, b.x, b.y, b.r)) {
        this.reel = Math.min(1, this.reel + dt / L.reel);
        this.stir(b.x, b.y, ['gt_stillfolk', 'gt_watcher', 'gt_stillfolk'], 3.4, dt);
      } else this.reel = Math.max(0, this.reel - (dt / L.reel) * 0.3);
      if (this.reel >= 1) {
        this.step[S] = 2;
        this.cue('lt_reeled', { x: b.x, y: b.y });
      }
    }
  }

  /** The journey's signal at the Signal stage (host): called out a few seconds ahead, judged as the engine passes. */
  private judgeSignal(): void {
    const g = this.g;
    const st = trainNow(g), run = runOf(g);
    if (st.phase !== 'travel' || run.empty) {
      this.lastDist = 0;
      if (st.phase !== 'travel') this.called.clear();
      return;
    }
    if (this.stage === LT.Signal && st.at <= E) {
      const d = this.sigAt[st.at] * st.legDist, s = this.signalAhead();
      if (s.inS <= LAST_TRAIN.callAhead && !this.called.has(st.loop)) {
        this.called.add(st.loop);
        this.cue('lt_signal_ahead', { a: st.at });
      }
      if (this.lastDist < d && st.dist >= d) {
        if (this.greenT > 0) {
          // the points swing over: this journey goes to the End of the Line, and every train out of Stillwater calls
          // there from now on (a whole second, so a guest's copy is exactly the host's)
          this.eFrom = Math.floor(g.time);
          run.to = E;
          run.passing = false;
          this.clearedTrip = st.loop;
          this.stage = LT.Punch;
          this.cue('lt_signal', { a: st.at });
        } else this.cue('lt_signal_missed', { a: st.at, b: st.to });
      }
    }
    this.lastDist = st.dist;
  }

  /** A player (index `who`) used `it`. */
  private use(it: LTInteraction, who: number): void {
    const g = this.g;
    const at = { x: it.x, y: it.y };
    switch (it.kind) {
      case 'booking':
        if (this.stage === LT.Ticket) {
          this.stage = LT.Key;
          this.cue('lt_ticket', at);
        } else this.cue('lt_hint', { ...at, a: Math.min(this.stage, 11) });
        break;
      case 'board':
        this.cue('lt_board_levers', { ...at, b: this.levers[0] + this.levers[1] * 5 + this.levers[2] * 25 });
        break;
      case 'key':
        this.keyBy = who;
        this.stage = LT.Junction;
        this.cue('lt_key', at);
        break;
      case 'clock':
        this.useClock(it.i, who, at);
        break;
      case 'page':
        this.pages |= 1 << it.i;
        this.cue('lt_page', { ...at, a: it.i, b: popcount(this.pages) });
        if (this.pages === 15) {
          this.stage = LT.Stations;
          this.cue('lt_pages', { a: this.levers[0] + this.levers[1] * 5 + this.levers[2] * 25 });
        }
        break;
      case 'candles':
        this.taperBy = who;
        this.taperT = LAST_TRAIN.taper;
        this.cue('lt_taper', at);
        break;
      case 'gravelamp':
        this.lamps |= 1 << it.i;
        this.cue('lt_gravelamp', { ...at, a: it.i, b: popcount(this.lamps) });
        if (this.lamps === 7) {
          this.step[V] = 1;
          this.taperBy = 255;
          this.taperT = 0;
          this.cue('lt_vigil', LT_VESPER.vigil);
        }
        break;
      case 'scrap':
        this.scrapsTaken |= 1 << it.i;
        this.scrapBy = who;
        this.cue('lt_scrap', at);
        break;
      case 'crucible':
        this.scrapBy = 255;
        this.crucible++;
        this.cue('lt_crucible', { ...at, a: this.crucible });
        if (this.crucible >= 3) {
          this.step[C] = 1;
          this.ladle = 0;
        }
        break;
      case 'pendulum':
        this.pendulumBy = who;
        this.cue('lt_pendulum', at);
        break;
      case 'lamproom':
        this.batteryBy = who;
        this.cue('lt_battery', at);
        break;
      case 'lampbox':
        if (it.i === 0) {
          this.batteryIn = 1;
          this.batteryBy = 255;
          this.cue('lt_battery_in', at);
          this.prepared();
        } else {
          this.greenT = LAST_TRAIN.greenFor;
          this.cue('lt_green', at);
        }
        break;
      case 'lever':
        if (this.levers[this.leverStep] === it.i) {
          this.leverStep++;
          this.cue('lt_lever', { ...at, a: it.i, b: this.leverStep });
          if (this.leverStep >= LAST_TRAIN.leverSteps) this.prepared();
        } else {
          this.leverStep = 0;
          this.cue('lt_lever_wrong', { ...at, a: it.i });
        }
        break;
      case 'punch':
        this.punchBy = who;
        this.stage = LT.Passengers;
        this.cue('lt_punch', at);
        break;
      case 'passenger':
        if (!this.trainIn(E)) {
          this.cue('lt_passenger_wait', at);
          break;
        }
        this.boarded |= 1 << it.i;
        this.cue('lt_passenger', { ...at, a: it.i, b: popcount(this.boarded) });
        if (this.boarded === 15) {
          this.stage = LT.Deliveries;
          this.cue('lt_passengers', { a: this.targetHour, b: this.bellOrder[0] + this.bellOrder[1] * 3 + this.bellOrder[2] * 9 });
        }
        break;
      case 'letter':
        this.letterBy = who;
        this.cue('lt_letter', at);
        break;
      case 'postbox':
        this.letterBy = 255;
        this.cue('lt_posted', at);
        this.taskDone(0, at);
        break;
      case 'chute':
        if (!this.trainIn(C)) {
          // the chute only runs while a train stands at the Works (it feeds the tender)
          this.cue('lt_chute_wait', at);
          break;
        }
        this.coalBy = who;
        this.cue('lt_chute', at);
        break;
      case 'coal':
        this.coalBy = 255;
        this.coal++;
        this.cue('lt_coal', { ...at, a: this.coal });
        break;
      case 'stoke':
        if (trainNow(g).phase !== 'travel') break;
        if (gaugeAt(g.time) >= 1 - LAST_TRAIN.gaugeWindow) {
          this.stokes++;
          this.cue('lt_stoke', { ...at, a: this.stokes });
          if (this.stokes >= LAST_TRAIN.stokes) this.taskDone(1, at);
        } else {
          this.stokes = 0;
          this.cue('lt_stoke_bad', at);
        }
        break;
      case 'church':
        if (!this.trainIn(S)) {
          this.cue('lt_hour_wait', at);
          break;
        }
        this.hour = (this.hour % 12) + 1;
        this.cue('lt_hour', { ...at, a: this.hour });
        if (this.hour === this.targetHour) this.taskDone(2, at);
        break;
      case 'rope':
        if (!this.trainIn(V)) {
          this.cue('lt_bell_wait', at);
          break;
        }
        if (this.bellOrder[this.bellStep] === it.i) {
          this.bellStep++;
          this.cue('lt_bell', { ...at, a: it.i, b: this.bellStep });
          if (this.bellStep >= 3) this.taskDone(3, at);
        } else {
          this.bellStep = 0;
          this.cue('lt_bell_wrong', { ...at, a: it.i });
        }
        break;
      case 'ticket':
        if (!this.trainIn(E)) {
          this.cue('lt_ticket_wait', at);
          break;
        }
        this.stage = LT.Express;
        this.cue('lt_last_ticket', at);
        break;
    }
  }

  /** A press at station r's clock: it says what it needs, or (with the key, its trouble mended) it is wound. */
  private useClock(r: number, who: number, at: { x: number; y: number }): void {
    if (r === J) {
      if (this.stage === LT.Key || this.keyBy !== who) {
        this.cue('lt_clock_trouble', { ...at, a: J, b: 0 });
        return;
      }
      if (!this.trainIn(J)) {
        this.cue('lt_clock_trouble', { ...at, a: J, b: 1 });
        return;
      }
      this.clocks |= 1;
      this.stage = LT.Pages;
      this.cue('lt_junction_clock', at);
      return;
    }
    const step = this.step[r], last = CLOCK_STEPS[r] - 1;
    if (r === S && step === 2 && this.pendulumBy === who) {
      this.pendulumBy = 255;
      this.step[S] = 3;
      this.cue('lt_pendulum_hung', at);
      return;
    }
    if (step < last || this.keyBy !== who) {
      // what this clock needs (b: the step it is at; 9: only the key)
      this.cue('lt_clock_trouble', { ...at, a: r, b: step < last ? step : 9 });
      return;
    }
    this.step[r] = CLOCK_STEPS[r];
    this.clocks |= 1 << r;
    this.cue('lt_clock', { ...at, a: r, b: popcount(this.clocks) });
    if (this.clocks === 15) {
      this.stage = LT.Prepare;
      this.cue('lt_clocks', {});
    }
  }

  /** The battery fitted and the levers set: the train is ready for the End of the Line. */
  private prepared(): void {
    if (this.stage !== LT.Prepare || !this.batteryIn || this.leverStep < LAST_TRAIN.leverSteps) return;
    this.stage = LT.Signal;
    this.cue('lt_prepared', {});
  }

  private taskDone(k: number, at: { x: number; y: number }): void {
    this.tasks |= 1 << k;
    this.cue('lt_task', { ...at, a: k, b: popcount(this.tasks) });
    if (this.tasks === 15) {
      this.stage = LT.LastTicket;
      this.cue('lt_deliveries', {});
    }
  }

  onBossDefeated(id: string): boolean {
    const g = this.g;
    if (id === 'night_express' && this.stage === LT.Express) {
      this.stage = LT.Finale;
      this.punchBy = 255;
      this.finaleT = LAST_TRAIN.finaleDelay;
      g.finaleActive = true;
      this.cue('lt_finale', {});
      return true; // no dawn yet: the Conductor is coming
    }
    if (id === 'conductor' && this.stage === LT.Finale) {
      this.stage = LT.Homeward;
      this.homewardT = LAST_TRAIN.homeward;
      this.cue('lt_homeward', {});
      return true;
    }
    return false;
  }

  private finish(): void {
    const g = this.g;
    this.homewardT = -1;
    this.stage = LT.Complete;
    g.finaleActive = false;
    g.trueEnding = true;
    g.ringmasterDefeated = true;
    g.achievementsHit.add('last_train');
    if (!g.endless) g.time = Math.max(g.time, DAWN_TIME);
    this.cue('lt_complete', {});
  }

  // ---- co-op: the whole chain in bytes
  netState(): number[] {
    const ef = Number.isFinite(this.eFrom) ? Math.min(0xfffe, this.eFrom) : 0xffff;
    const u8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const ladle = Math.round(this.ladle);
    return [
      this.stage, this.keyAt, this.keyBy, this.pageAt, this.pages, this.clocks, ...this.step,
      this.lamps, this.taperBy, u8(this.taperT * 8), u8(this.vigil * 255),
      this.scrapAt, this.scrapsTaken, this.scrapBy, this.crucible, ladle >> 8, ladle & 255,
      ...this.moments.map((v) => u8(v * 255)), u8(this.reel * 255), this.pendulumBy,
      this.batteryBy, this.batteryIn, u8(this.greenT * 40), this.levers[0] + this.levers[1] * 5 + this.levers[2] * 25, this.leverStep,
      ...this.sigAt.map((f) => u8(((f - 0.3) / 0.4) * 255)), this.clearedTrip, ef >> 8, ef & 255,
      this.punchBy, this.boarded, this.tasks, this.letterBy, this.bellOrder[0] + this.bellOrder[1] * 3 + this.bellOrder[2] * 9, this.bellStep,
      this.coalBy, this.coal, this.stokes, this.hour, this.targetHour,
      u8(this.finaleT * 8), u8(this.homewardT * 8),
    ];
  }

  applyNet(v: number[]): void {
    if (v.length < NET_BYTES) return;
    let i = 0;
    const n = () => v[i++];
    this.stage = n();
    this.keyAt = n();
    this.keyBy = n();
    this.pageAt = n();
    this.pages = n();
    this.clocks = n();
    this.step = [n(), n(), n(), n()];
    this.lamps = n();
    this.taperBy = n();
    this.taperT = n() / 8;
    this.vigil = n() / 255;
    this.scrapAt = n();
    this.scrapsTaken = n();
    this.scrapBy = n();
    this.crucible = n();
    this.ladle = (n() << 8) | n();
    this.moments = [n() / 255, n() / 255, n() / 255];
    this.reel = n() / 255;
    this.pendulumBy = n();
    this.batteryBy = n();
    this.batteryIn = n();
    this.greenT = n() / 40;
    const lv = n();
    this.levers = [lv % 5, Math.floor(lv / 5) % 5, Math.floor(lv / 25) % 5];
    this.leverStep = n();
    this.sigAt = [n(), n(), n(), n(), n()].map((b) => 0.3 + (b / 255) * 0.4);
    this.clearedTrip = n();
    const ef = (n() << 8) | n();
    this.eFrom = ef === 0xffff ? Infinity : ef;
    this.punchBy = n();
    this.boarded = n();
    this.tasks = n();
    this.letterBy = n();
    const bo = n();
    this.bellOrder = [bo % 3, Math.floor(bo / 3) % 3, Math.floor(bo / 9) % 3];
    this.bellStep = n();
    this.coalBy = n();
    this.coal = n();
    this.stokes = n();
    this.hour = n();
    this.targetHour = n();
    const ft = n(), ht = n();
    this.finaleT = this.stage === LT.Finale && ft > 0 ? ft / 8 : -1;
    this.homewardT = this.stage === LT.Homeward ? ht / 8 : -1;
  }
}

/** How many bytes the chain sends (netState's length). */
export const NET_BYTES = 51;

function popcount(m: number): number {
  let n = 0;
  for (let b = m; b; b &= b - 1) n++;
  return n;
}

/** The regions, for the cues' readers. */
export const LT_PLACES = REGIONS;
