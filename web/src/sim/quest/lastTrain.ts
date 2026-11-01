// "The Last Train Home" — the Ghost Train's hidden quest chain (D-80; solution: docs/EASTER_EGG_GHOST_TRAIN.md).
// Half again as long as the Boardwalk's, and built on the train: most steps can only be done while the train
// stands at a particular station, or at a particular moment of a journey, so the timetable is part of the
// puzzle (a miss waits for the next time round, never fails the quest).
//
//   0 TICKET      Ask at Hollow Junction's booking office: an unpunched ticket for THE LAST TRAIN HOME.
//   1 PAGES       Four torn timetable pages are aboard (the baggage car, the dining car, Car 13, the sleeper;
//                 one of two places in each, a night). Collect them; the mended timetable lists the thirteenth
//                 train, and the signal-box route in its footnote.
//   2 CLOCKS      Wind each station's clock while its train is standing in: Saint Vesper's, the Cinder Works and
//                 Stillwater in any order, then the Junction's master clock.
//   3 BATTERY     Take the signal battery from the lamp room under the Junction's signal box.
//   4 SIGNALS     Fit it to the lamp box at the front of the tender: the train's own signal lamp (dark and
//                 flickering all night until then) burns red. On each of the four legs a signal stands at danger;
//                 a press at the lamp box shows green for 3 s, and a signal passed while the lamp is green
//                 clears (D-84: it was a lantern shown from the tender).
//   5 POINTS      Pull the Junction signal box's levers in the footnote's order: the End of the Line becomes a
//                 stop (the next train from Stillwater calls there).
//   6 BRIDGE      On the way there the train crosses the bridge over the drop: pull the whistle cord in the
//                 tender while it's on the bridge.
//   7 PUNCH       At the End of the Line, take the Conductor's spare punch from the ticket box.
//   8 PASSENGERS  Punch the tickets of the four lost passengers on its platform (Ada Penhallow, Theo
//                 Fairweather, Mira, Eli Marrow) while the train stands there: they board.
//   9 DELIVERIES  Each has one errand along the line, any order: Ada's letter (from her table in the dining car)
//                 to the Junction's post box; Theo's coal (three shovelfuls from the Cinder Works' chute into the
//                 tender, then three stokes on the move with the boiler's needle at the top); Mira's hour (turn
//                 Stillwater's church clock to tonight's hour while the train is in); Eli's bells (ring Saint
//                 Vesper's three bells in tonight's order while the train is in).
//  10 LAST TICKET Punch your own ticket at the End of the Line's barrier while a train stands there.
//  11 EXPRESS     When the Night Express falls (the final boss, 30:00, at the End of the Line)…
//  12 FINALE      …the Conductor comes for the passengers: the secret boss.
//  13 HOMEWARD    Defeat him: the last train home pulls out, every window lit…
//  14 COMPLETE    …the true dawn, an achievement, the Conductor's Punch unlocked.
//
// Everything is a press of interact within reach. Co-op: one shared chain, any standing player can act, and
// whatever is carried (the battery, the punch, Ada's letter, a shovel of coal) passes to the nearest standing
// player if its carrier falls. The host runs it; guests receive its state as bytes (`netState`), including
// the one number the timetable needs (`eFrom`: when the End of the Line becomes a stop).

import { dist2 } from '../../core/math';
import { Rng } from '../../core/rng';
import { CONDUCTOR_DEF } from '../../data/bosses';
import { C, E, J, REGIONS, S, TRANSIT, V, inTrainLocal, legSpeed, regionAt, trainOrigin } from '../../data/ghosttrain';
import { CINDER, END, JUNCTION, LT_TRAIN, PASSENGERS, STATION_CLOCK, STILLWATER, VESPER } from '../../data/gtStations';
import { LAST_TRAIN } from '../../data/lastTrain';
import { DAWN_TIME } from '../../data/waves';
import { createBoss } from '../bosses';
import type { Game } from '../game';
import { trainNow } from '../ghosttrain';
import { QuestChain } from './quest';

export const LT = { Ticket: 0, Pages: 1, Clocks: 2, Battery: 3, Signals: 4, Points: 5, Bridge: 6, Punch: 7, Passengers: 8, Deliveries: 9, LastTicket: 10, Express: 11, Finale: 12, Homeward: 13, Complete: 14 } as const;

export type LTKind = 'booking' | 'board' | 'page' | 'clock' | 'lamproom' | 'lampbox' | 'lever' | 'whistle' | 'punch' | 'passenger' | 'letter' | 'postbox' | 'chute' | 'coal' | 'stoke' | 'church' | 'rope' | 'ticket';

export interface LTInteraction {
  kind: LTKind;
  i: number;
  x: number;
  y: number;
  label: string;
}

/** Seconds before the same thing answers another press. */
const COOLDOWN: Partial<Record<LTKind, number>> = { booking: 2.5, board: 2, clock: 1, lampbox: 0.4, lever: 0.35, whistle: 1.2, stoke: 0.4, church: 0.35, rope: 0.5, passenger: 0.5 };

/** The boiler's needle (0..1, 1 at the top of its swing) at sim time t. */
export function gaugeAt(t: number): number {
  return 0.5 - 0.5 * Math.cos((t / LAST_TRAIN.gaugePeriod) * Math.PI * 2);
}

export class LastTrainChain extends QuestChain {
  readonly id = LAST_TRAIN.id;
  /** which of each car's two hiding places holds its page tonight (bit per car), and the pages taken */
  pageAt = 0;
  pages = 0;
  /** the station clocks wound (bit per station J, V, C, S) */
  clocks = 0;
  /** who carries the signal battery; whether it is in the train's lamp box; seconds the lamp still shows green */
  batteryBy = 255;
  batteryIn = 0;
  greenT = 0;
  /** the signals cleared (bit per leg: J→V, V→C, C→S, Stillwater onward), and where each stands (0..1 of its leg) */
  signals = 0;
  sigAt = [0.5, 0.5, 0.5, 0.5];
  /** the lever order tonight (three of five) and how far along it the frame is */
  levers = [0, 1, 2];
  leverStep = 0;
  /** when the End of the Line became a stop (Infinity: not yet; the final act opens it for everyone anyway) */
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
  /** the leg whose signal (or the bridge) has been called out this journey (host-side) */
  private called = new Set<string>();
  /** the train's distance along the leg at the last tick, to see a signal passed (host-side) */
  private lastDist = 0;

  init(): void {
    const r = (this.rng = new Rng((this.g.cfg.seed ^ 0x13181899) >>> 0));
    this.pageAt = r.int(0, 15);
    this.sigAt = [0, 1, 2, 3].map(() => 0.3 + r.next() * 0.4);
    const pool = [0, 1, 2, 3, 4];
    r.shuffle(pool);
    this.levers = pool.slice(0, LAST_TRAIN.leverSteps);
    this.bellOrder = [0, 1, 2];
    do r.shuffle(this.bellOrder);
    while (this.bellOrder[0] === 0 && this.bellOrder[1] === 1);
    this.targetHour = r.int(1, 11);
    this.hour = 12;
  }

  get complete(): boolean {
    return this.stage === LT.Complete;
  }

  /** The page in car k tonight, in the train's own frame. */
  pageSpot(k: number): { x: number; y: number } {
    return LT_TRAIN.pages[k][(this.pageAt >> k) & 1];
  }

  /** A fixture in the train's frame, in the copy of the carriages the player at (x, y) is in (null if not in one). */
  private inTrain(x: number, y: number, at: { x: number; y: number }): { x: number; y: number } | null {
    const r = regionAt(x, y);
    if (r < 0) return null;
    const o = trainOrigin(r);
    if (!inTrainLocal(x - o.x, y - o.y, 8)) return null;
    return { x: o.x + at.x, y: o.y + at.y };
  }

  /** Is the player at (x, y) in the moving train's tender? */
  private inTender(x: number, y: number): boolean {
    const o = trainOrigin(TRANSIT);
    const lx = x - o.x;
    return regionAt(x, y) === TRANSIT && lx >= LT_TRAIN.tender.x0 - 10 && lx <= LT_TRAIN.tender.x1;
  }

  /** The train is standing at station r with its doors open. */
  private trainIn(r: number): boolean {
    const st = trainNow(this.g);
    return st.phase === 'dwell' && st.at === r && st.doors;
  }

  /** The leg the train is on (0 J→V, 1 V→C, 2 C→S, 3 Stillwater onward; -1 none) and seconds until it passes that
   *  leg's signal (Infinity once past it, or off the legs with signals). */
  signalAhead(): { leg: number; inS: number } {
    const st = trainNow(this.g);
    if (st.phase !== 'travel' || st.at > S) return { leg: -1, inS: Infinity };
    const leg = st.at;
    const d = this.sigAt[leg] * st.legDist - st.dist;
    if (d < 0) return { leg, inS: Infinity };
    return { leg, inS: d / Math.max(60, legSpeed(st.t, st.len)) };
  }

  /** What the train's own signal lamp shows: 0 dark (flickering), 1 red, 2 green. */
  lamp(): 0 | 1 | 2 {
    if (this.stage > LT.Signals) return 2;
    if (this.stage < LT.Signals || !this.batteryIn) return 0;
    return this.greenT > 0 ? 2 : 1;
  }

  /** Is the train on the bridge over the drop (on the way from Stillwater to the End of the Line)? */
  onBridge(): boolean {
    const st = trainNow(this.g);
    return st.phase === 'travel' && st.at === S && st.to === E && !st.passing && st.t >= LAST_TRAIN.bridge[0] && st.t <= LAST_TRAIN.bridge[1];
  }

  interaction(x: number, y: number, who = this.g.player.index): LTInteraction | null {
    const g = this.g;
    const R = LAST_TRAIN.reach;
    const list: LTInteraction[] = [];
    const here = regionAt(x, y);
    const push = (kind: LTKind, i: number, at: { x: number; y: number } | null, label: string) => {
      if (at) list.push({ kind, i, x: at.x, y: at.y, label });
    };
    // the booking clerk answers at every stage (the ticket first, then a hint)
    if (this.stage < LT.Finale && here === J) push('booking', 0, JUNCTION.booking, this.stage === LT.Ticket ? 'Ask at the booking office' : 'Ask the booking clerk');
    switch (this.stage) {
      case LT.Pages:
        if (here === J) push('board', 0, JUNCTION.board, 'Read the departures board');
        for (let k = 0; k < 4; k++) if (!(this.pages & (1 << k))) push('page', k, this.inTrain(x, y, this.pageSpot(k)), 'Pick up the torn page');
        break;
      case LT.Clocks:
        for (let r = 0; r < 4; r++) if (!(this.clocks & (1 << r)) && here === r) push('clock', r, STATION_CLOCK[r], 'Wind the station clock');
        break;
      case LT.Battery:
        if (here === J) push('lamproom', 0, JUNCTION.lamproom, 'Take the signal battery');
        break;
      case LT.Signals:
        // the lamp box at the front of the tender, in whichever copy of the train the player stands in
        if (!this.batteryIn) {
          if (this.batteryBy === who) push('lampbox', 0, this.inTrain(x, y, LT_TRAIN.lampbox), 'Fit the battery to the signal lamp');
        } else push('lampbox', 1, this.inTrain(x, y, LT_TRAIN.lampbox), 'Switch the signal lamp to green');
        break;
      case LT.Points:
        if (here === J) {
          push('board', 1, JUNCTION.board, 'Read the departures board');
          for (let k = 0; k < LAST_TRAIN.levers; k++) push('lever', k, { x: JUNCTION.levers.x, y: JUNCTION.levers.y + (k - 2) * 38 }, `Pull lever ${k + 1}`);
        }
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
    // the whistle cord is in every tender; it does nothing but whistle, except on the bridge at the Bridge stage
    if (this.inTender(x, y)) push('whistle', 0, this.inTrain(x, y, LT_TRAIN.whistle), 'Pull the whistle cord');
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
    void g;
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
      const cd = COOLDOWN[it.kind] ?? 0.25;
      this.cool.set(key, cd);
      this.use(it, p.index);
    }
    // whatever is carried passes to the nearest standing player if its carrier falls
    const pass = (by: number): number => {
      if (by === 255) return 255;
      const c = g.players[by];
      if (c && g.isUp(c)) return by;
      return up.length ? g.nearestLiving(c?.x ?? 0, c?.y ?? 0).index : by;
    };
    this.batteryBy = pass(this.batteryBy);
    this.greenT = Math.max(0, this.greenT - dt);
    this.punchBy = pass(this.punchBy);
    this.letterBy = pass(this.letterBy);
    this.coalBy = pass(this.coalBy);
    // the calls: a signal in sight ahead (while someone carries the lantern), the bridge coming up
    const st = trainNow(g);
    if (st.phase !== 'travel') {
      this.called.clear();
      this.lastDist = 0;
    } else {
      // the signals (with the battery in): called out a few seconds ahead, and judged as the engine passes each
      if (this.stage === LT.Signals && this.batteryIn && st.at <= S && !(this.signals & (1 << st.at))) {
        const leg = st.at, d = this.sigAt[leg] * st.legDist, s = this.signalAhead();
        const key = `sig${st.loop}:${leg}`;
        if (s.inS <= LAST_TRAIN.callAhead && !this.called.has(key)) {
          this.called.add(key);
          this.cue('lt_signal_ahead', { a: leg });
        }
        if (this.lastDist < d && st.dist >= d) {
          if (this.greenT > 0) {
            this.signals |= 1 << leg;
            this.cue('lt_signal', { a: leg, b: popcount(this.signals) });
            if (this.signals === 15) {
              this.stage = LT.Points;
              this.cue('lt_signals', {});
            }
          } else this.cue('lt_signal_missed', { a: leg });
        }
      }
      this.lastDist = st.dist;
      if (this.stage === LT.Bridge && this.onBridge() && !this.called.has(`bridge${st.loop}`)) {
        this.called.add(`bridge${st.loop}`);
        this.cue('lt_bridge_ahead', {});
      }
    }
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

  /** A player (index `who`) used `it`. */
  private use(it: LTInteraction, who: number): void {
    const g = this.g;
    const at = { x: it.x, y: it.y };
    switch (it.kind) {
      case 'booking':
        if (this.stage === LT.Ticket) {
          this.stage = LT.Pages;
          this.cue('lt_ticket', at);
        } else this.cue('lt_hint', { ...at, a: Math.min(this.stage, 11) });
        break;
      case 'board':
        this.cue(it.i === 0 ? 'lt_board_torn' : 'lt_board_levers', { ...at, a: 4 - popcount(this.pages), b: this.levers[0] + this.levers[1] * 5 + this.levers[2] * 25 });
        break;
      case 'page':
        this.pages |= 1 << it.i;
        this.cue('lt_page', { ...at, a: it.i, b: popcount(this.pages) });
        if (this.pages === 15) {
          this.stage = LT.Clocks;
          this.cue('lt_pages', { a: this.levers[0] + this.levers[1] * 5 + this.levers[2] * 25 });
        }
        break;
      case 'clock': {
        const r = it.i;
        if (!this.trainIn(r)) {
          this.cue('lt_clock_no', { ...at, a: 0 });
          break;
        }
        if (r === J && (this.clocks & 0b1110) !== 0b1110) {
          this.cue('lt_clock_no', { ...at, a: 1 });
          break;
        }
        this.clocks |= 1 << r;
        this.cue('lt_clock', { ...at, a: r, b: popcount(this.clocks) });
        if (this.clocks === 15) {
          this.stage = LT.Battery;
          this.cue('lt_clocks', {});
        }
        break;
      }
      case 'lamproom':
        this.batteryBy = who;
        this.stage = LT.Signals;
        this.cue('lt_battery', at);
        break;
      case 'lampbox':
        if (it.i === 0) {
          this.batteryIn = 1;
          this.batteryBy = 255;
          this.cue('lt_battery_in', at);
        } else {
          this.greenT = LAST_TRAIN.greenFor;
          this.cue('lt_green', at);
        }
        break;
      case 'lever':
        if (this.levers[this.leverStep] === it.i) {
          this.leverStep++;
          this.cue('lt_lever', { ...at, a: it.i, b: this.leverStep });
          if (this.leverStep >= LAST_TRAIN.leverSteps) {
            // a whole second, so a guest's copy of it is exactly the host's (the timetable compares against it)
            this.eFrom = Math.ceil(g.time);
            this.stage = LT.Bridge;
            this.cue('lt_points', { ...at, a: this.eFrom });
          }
        } else {
          this.leverStep = 0;
          this.cue('lt_lever_wrong', { ...at, a: it.i });
        }
        break;
      case 'whistle':
        if (this.stage === LT.Bridge && this.onBridge()) {
          this.stage = LT.Punch;
          this.cue('lt_bridge', at);
        } else this.cue('lt_whistle', at);
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

  // ---- co-op: the whole chain in a few bytes
  netState(): number[] {
    const ef = Number.isFinite(this.eFrom) ? Math.min(0xfffe, this.eFrom) : 0xffff;
    return [
      this.stage, this.pageAt, this.pages, this.clocks, this.batteryBy, this.signals,
      ...this.sigAt.map((f) => Math.round(((f - 0.3) / 0.4) * 255)),
      this.levers[0] + this.levers[1] * 5 + this.levers[2] * 25, this.leverStep, ef >> 8, ef & 255,
      this.punchBy, this.boarded, this.tasks, this.letterBy, this.bellOrder[0] + this.bellOrder[1] * 3 + this.bellOrder[2] * 9, this.bellStep,
      this.coalBy, this.coal, this.stokes, this.hour, this.targetHour,
      Math.min(255, Math.max(0, Math.round(this.finaleT * 8))), Math.min(255, Math.max(0, Math.round(this.homewardT * 8))),
      this.batteryIn, Math.min(255, Math.ceil(this.greenT * 40)),
    ];
  }

  applyNet(v: number[]): void {
    if (v.length < 27) return;
    this.stage = v[0];
    this.pageAt = v[1];
    this.pages = v[2];
    this.clocks = v[3];
    this.batteryBy = v[4];
    this.signals = v[5];
    this.sigAt = [v[6], v[7], v[8], v[9]].map((b) => 0.3 + (b / 255) * 0.4);
    this.levers = [v[10] % 5, Math.floor(v[10] / 5) % 5, Math.floor(v[10] / 25) % 5];
    this.leverStep = v[11];
    const ef = (v[12] << 8) | v[13];
    this.eFrom = ef === 0xffff ? Infinity : ef;
    this.punchBy = v[14];
    this.boarded = v[15];
    this.tasks = v[16];
    this.letterBy = v[17];
    this.bellOrder = [v[18] % 3, Math.floor(v[18] / 3) % 3, Math.floor(v[18] / 9) % 3];
    this.bellStep = v[19];
    this.coalBy = v[20];
    this.coal = v[21];
    this.stokes = v[22];
    this.hour = v[23];
    this.targetHour = v[24];
    this.finaleT = this.stage === LT.Finale && v[25] > 0 ? v[25] / 8 : -1;
    this.homewardT = this.stage === LT.Homeward ? v[26] / 8 : -1;
    this.batteryIn = v[27] ?? 0;
    this.greenT = (v[28] ?? 0) / 40;
  }
}

function popcount(m: number): number {
  let n = 0;
  for (let b = m; b; b &= b - 1) n++;
  return n;
}

/** The regions, for the cues' readers. */
export const LT_PLACES = REGIONS;
