// The Midnight Line's own fixtures on the Ghost Train (D-80): not a hidden quest, but they answer interact
// the same way (the HUD asks every chain on the map).
//
// - The whistle cord at the front of every tender (D-90): pulled while the train stands at a station, it goes to the
//   next stop; aboard a moving train it only whistles. The train keeps no timetable since D-90. (D-95 had the guard
//   refuse the whistle until the hidden quest's timetable was mended; since D-98 the hidden quest gates nothing.)
// - The Junction's departures board and every station clock say where the train is and how to make it go.
// - From 33:00 the phantom doors stand open on every platform but the End of the Line's, one step to its platform,
//   so nobody is stranded when the last train has gone and the Night Express is coming.
//
// It also carries the train to guests: the host's run is this chain's bytes (`packRun`).

import { dist2 } from '../../core/math';
import { E, PHANTOM_AT, RUN_BYTES, TRANSIT, packRun, regionAt, trainOrigin, unpackRun } from '../../data/ghosttrain';
import { JUNCTION, LT_TRAIN, PHANTOM_ARRIVAL, PHANTOM_DOOR, STATION_CLOCK } from '../../data/gtStations';
import { pullWhistle, runOf } from '../ghosttrain';
import { QuestChain } from './quest';

export type LineKind = 'board' | 'phantom' | 'whistle';
/** what a pull on the whistle cord did (the cue's `a`): it goes, it was going, the last train, aboard a moving train,
 *  the guard won't yet (no timetable) */
export const WHISTLE = { go: 0, going: 1, terminus: 2, ride: 3, locked: 4 } as const;

export class LineChain extends QuestChain {
  readonly id = 'gt_line';
  private cool = new Map<string, number>();
  private opened = false;

  interaction(x: number, y: number): { kind: LineKind; i: number; x: number; y: number; label: string } | null {
    const r = regionAt(x, y);
    if (r < 0) return null;
    // the whistle cord, in whichever copy of the tender the player stands in
    const o = trainOrigin(r), w = LT_TRAIN.whistle;
    if (dist2(x, y, o.x + w.x, o.y + w.y) < 80 * 80) return { kind: 'whistle', i: r, x: o.x + w.x, y: o.y + w.y, label: r === TRANSIT ? 'Pull the whistle cord' : 'Pull the whistle cord: depart' };
    if (r > E) return null;
    if (r < E && this.g.time >= PHANTOM_AT) {
      const d = PHANTOM_DOOR[r];
      if (dist2(x, y, d.x, d.y) < 95 * 95) return { kind: 'phantom', i: r, x: d.x, y: d.y, label: 'Step through the door' };
    }
    const c = STATION_CLOCK[r];
    if (dist2(x, y, c.x, c.y) < 85 * 85) return { kind: 'board', i: r, x: c.x, y: c.y, label: 'Look at the station clock' };
    if (r === 0 && dist2(x, y, JUNCTION.board.x, JUNCTION.board.y) < 140 * 140) return { kind: 'board', i: 0, x: JUNCTION.board.x, y: JUNCTION.board.y, label: 'Read the timetable board' };
    return null;
  }

  update(dt: number): void {
    const g = this.g;
    if (g.phase !== 'play') return;
    for (const [k, t] of this.cool) if (t - dt <= 0) this.cool.delete(k); else this.cool.set(k, t - dt);
    if (!this.opened && g.time >= PHANTOM_AT) {
      this.opened = true;
      this.cue('gt_phantom_open', {});
    }
    for (const p of g.players) {
      if (!g.isUp(p) || !g.inputs[p.index]?.interact) continue;
      const at = g.pressPoint(p); // where they pressed (D-101)
      // the hidden quest's fixtures answer first where they overlap (its chain is asked before this one)
      if (g.quests.chains.some((c) => c !== this && c.interaction?.(at.x, at.y, p.index))) continue;
      const it = this.interaction(at.x, at.y);
      if (!it) continue;
      const key = `${it.kind}${it.i}:${p.index}`;
      if (this.cool.has(key)) continue;
      this.cool.set(key, it.kind === 'whistle' ? 1.2 : 1.5);
      if (it.kind === 'board') this.cue('gt_board', { x: it.x, y: it.y, a: it.i, b: p.index });
      else if (it.kind === 'whistle') {
        const did = it.i === TRANSIT ? 'ride' : pullWhistle(g, it.i);
        if (did === 'away') continue;
        this.cue('gt_whistle', { x: it.x, y: it.y, a: WHISTLE[did], b: it.i });
      } else {
        // through the door: out onto the End of the Line's platform (a step apart for each player)
        p.x = p.px = PHANTOM_ARRIVAL.x + (p.index % 3) * 60;
        p.y = p.py = PHANTOM_ARRIVAL.y + Math.floor(p.index / 3) * 50;
        p.vx = p.vy = 0;
        p.iframes = Math.max(p.iframes, 1.2);
        this.cue('gt_phantom_through', { x: p.x, y: p.y, a: it.i, b: p.index });
      }
    }
  }

  // ---- co-op: the train itself (D-90: it is no longer a function of the clock a guest can work out alone)
  netState(): number[] {
    return packRun(runOf(this.g));
  }

  applyNet(v: number[]): void {
    if (v.length >= RUN_BYTES) unpackRun(v, 0, runOf(this.g));
  }
}
