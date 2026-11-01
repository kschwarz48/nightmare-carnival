// The Midnight Line's own fixtures on the Ghost Train (D-80): not a hidden quest, but they answer interact
// the same way (the HUD asks every chain on the map). Every station's clock and the Junction's departures
// board tell the timetable (the next trains, by station time); and from 29:00 the phantom doors stand open on
// every platform but the End of the Line's, one step to its platform, so nobody is stranded when the last
// train has gone and the Night Express is coming.

import { dist2 } from '../../core/math';
import { E, PHANTOM_AT, regionAt } from '../../data/ghosttrain';
import { JUNCTION, PHANTOM_ARRIVAL, PHANTOM_DOOR, STATION_CLOCK } from '../../data/gtStations';
import { QuestChain } from './quest';

export type LineKind = 'timetable' | 'phantom';

export class LineChain extends QuestChain {
  readonly id = 'gt_line';
  private cool = new Map<string, number>();
  private opened = false;

  interaction(x: number, y: number): { kind: LineKind; i: number; x: number; y: number; label: string } | null {
    const r = regionAt(x, y);
    if (r < 0 || r > E) return null;
    if (r < E && this.g.time >= PHANTOM_AT) {
      const d = PHANTOM_DOOR[r];
      if (dist2(x, y, d.x, d.y) < 95 * 95) return { kind: 'phantom', i: r, x: d.x, y: d.y, label: 'Step through the door' };
    }
    const c = STATION_CLOCK[r];
    if (dist2(x, y, c.x, c.y) < 85 * 85) return { kind: 'timetable', i: r, x: c.x, y: c.y, label: 'Check the timetable' };
    if (r === 0 && dist2(x, y, JUNCTION.board.x, JUNCTION.board.y) < 140 * 140) return { kind: 'timetable', i: 0, x: JUNCTION.board.x, y: JUNCTION.board.y, label: 'Read the departures board' };
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
      // the hidden quest's fixtures answer first where they overlap (its chain is asked before this one)
      if (g.quests.chains.some((c) => c !== this && c.interaction?.(p.x, p.y, p.index))) continue;
      const it = this.interaction(p.x, p.y);
      if (!it) continue;
      const key = `${it.kind}${it.i}:${p.index}`;
      if (this.cool.has(key)) continue;
      this.cool.set(key, 1.5);
      if (it.kind === 'timetable') this.cue('gt_timetable', { x: it.x, y: it.y, a: it.i, b: p.index });
      else {
        // through the door: out onto the End of the Line's platform (a step apart for each player)
        p.x = p.px = PHANTOM_ARRIVAL.x + (p.index % 3) * 60;
        p.y = p.py = PHANTOM_ARRIVAL.y + Math.floor(p.index / 3) * 50;
        p.vx = p.vy = 0;
        p.iframes = Math.max(p.iframes, 1.2);
        this.cue('gt_phantom_through', { x: p.x, y: p.y, a: it.i, b: p.index });
      }
    }
  }
}
