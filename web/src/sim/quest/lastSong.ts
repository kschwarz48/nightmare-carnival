// "The Last Song" — the Carnival Core's hidden quest chain (solution: docs/EASTER_EGG_SOLUTION.md).
//
//   0 DORMANT   Zoltana the fortune automaton sits dark beside Madame Zelda's caravan.
//   1 SOULS     Using her (interact: E, or A on a pad, D-98) wakes four cold "ghost lamps"; kills near a lamp feed it souls.
//   2 MELODY    All four lit → the dead carousel lurches into motion and its music box plays the
//               lamps' notes in a per-run order (also painted on the canopy, starting at the brass
//               skull). Touch the lamps (interact) in that order.
//   3 CALLING   Song complete → Zoltana calls; asking her prints the next fortune.
//   4 STRIKER   Ring the High Striker three times: strike it (interact, on its pad) as the puck light peaks.
//   5 CARRYING  A Ghost Ticket follows the player. Defeat the Ringmaster while carrying it…
//   6 FINALE    …and the dawn is refused: the Calliope rises from the Big Top ruins.
//   7 COMPLETE  Defeat the Calliope → True Dawn, permanent unlock, achievement.

import { dist2 } from '../../core/math';
import { Rng } from '../../core/rng';
import { CALLIOPE_DEF } from '../../data/bosses';
import { FORTUNES, LAST_SONG } from '../../data/quests';
import { DAWN_TIME } from '../../data/waves';
import { createBoss } from '../bosses';
import type { Enemy } from '../entities';
import type { Game } from '../game';
import { QuestChain } from './quest';

export const LS = { Dormant: 0, Souls: 1, Melody: 2, Calling: 3, Striker: 4, Carrying: 5, Finale: 6, Complete: 7 } as const;

export class LastSongChain extends QuestChain {
  readonly id = LAST_SONG.id;
  souls = [0, 0, 0, 0];
  lit = [false, false, false, false];
  /** Lamp indices in song order (per-run, seeded). */
  order = [0, 1, 2, 3];
  progress = 0;
  rings = 0;
  carrying = false;
  finaleT = -1;
  musicT = 0;
  /** Seconds before the same thing answers another press (a held or mashed key never double-counts; D-98). */
  private cool = new Map<string, number>();
  private idleIdx = 0;

  init(): void {
    // Separate RNG stream so the quest never perturbs gameplay randomness.
    const r = new Rng((this.g.cfg.seed ^ 0x5eed1931) >>> 0);
    r.shuffle(this.order);
    this.idleIdx = r.int(0, FORTUNES.idle.length - 1);
  }

  get complete(): boolean {
    return this.stage === LS.Complete;
  }

  /** 0..1 puck height on the High Striker (triangle wave, peaks at the bell). */
  strikerHeight(): number {
    const ph = (this.g.realTime % LAST_SONG.striker.period) / LAST_SONG.striker.period;
    return 1 - Math.abs(ph * 2 - 1);
  }

  strikerInWindow(): boolean {
    return this.strikerHeight() >= 1 - LAST_SONG.striker.window;
  }

  /**
   * What a player standing at (x, y) could use with interact right now (D-98: the first map answers E like the others;
   * it was walk-up): Zoltana, a lit ghost lamp, the High Striker's pad. The HUD shows its prompt.
   */
  interaction(x: number, y: number): { kind: 'zoltana' | 'lamp' | 'striker'; i: number; x: number; y: number; label: string } | null {
    if (this.stage === LS.Finale) return null;
    const m = LAST_SONG.machine, s = LAST_SONG.striker;
    let best: { kind: 'zoltana' | 'lamp' | 'striker'; i: number; x: number; y: number; label: string } | null = null, bd = Infinity;
    const offer = (kind: 'zoltana' | 'lamp' | 'striker', i: number, px: number, py: number, reach: number, label: string) => {
      const d = dist2(x, y, px, py);
      if (d < reach * reach && d < bd) {
        bd = d;
        best = { kind, i, x: px, y: py, label };
      }
    };
    offer('zoltana', 0, m.x, m.y, m.r, this.stage === LS.Dormant ? 'Look into the fortune booth' : 'Ask Zoltana');
    for (let i = 0; i < 4; i++) {
      if (!this.lit[i]) continue;
      const l = LAST_SONG.lamps[i];
      if (this.stage < LS.Melody) offer('lamp', i, l.x, l.y, LAST_SONG.touchRadius, 'Listen to the lamp');
      else if (this.stage === LS.Melody && !this.played(i)) offer('lamp', i, l.x, l.y, LAST_SONG.touchRadius, 'Touch the ghost lamp');
    }
    offer('striker', 0, s.padX, s.padY, s.padR + 12, this.stage === LS.Striker ? 'Strike the bell when the light is at the top' : 'Ring the High Striker');
    return best;
  }

  update(dt: number): void {
    const g = this.g;
    if (g.phase !== 'play') return;
    for (const [k, t] of this.cool) if (t - dt <= 0) this.cool.delete(k); else this.cool.set(k, t - dt);
    // presses: each player who pressed interact uses the nearest thing in reach (co-op shares the chain, D-51)
    for (const p of g.players) {
      if (p.dead || p.downed || !g.inputs[p.index]?.interact) continue;
      const it = this.interaction(p.x, p.y) as { kind: 'zoltana' | 'lamp' | 'striker'; i: number } | null;
      if (!it) continue;
      const key = `${it.kind}${it.i}`;
      if (this.cool.has(key)) continue;
      this.cool.set(key, it.kind === 'striker' ? 0.35 : 0.3);
      if (it.kind === 'zoltana') this.onMachine();
      else if (it.kind === 'lamp') this.onTouchLamp(it.i);
      else this.onPad();
    }
    // the carousel's music box gives away the order once it has woken
    if (this.stage >= LS.Melody && this.stage < LS.Finale) {
      this.musicT -= dt;
      const c = LAST_SONG.carousel;
      if (this.musicT <= 0 && g.players.some((p) => !p.dead && dist2(p.x, p.y, c.x, c.y) < c.hearRange ** 2)) {
        this.musicT = c.interval;
        this.cue('musicbox', { x: c.x, y: c.y });
      }
    }
    // finale countdown → the Calliope rises
    if (this.stage === LS.Finale && this.finaleT >= 0) {
      this.finaleT -= dt;
      if (this.finaleT <= 0) {
        this.finaleT = -1;
        const b = createBoss(g, CALLIOPE_DEF, { immediate: true, noChest: true });
        b.x = b.px = LAST_SONG.finaleAt.x;
        b.y = b.py = LAST_SONG.finaleAt.y;
        g.bosses.push(b);
        this.cue('calliope_rises', { x: b.x, y: b.y });
      }
    }
  }

  private onMachine(): void {
    const m = LAST_SONG.machine;
    const say = (text: string, ev = 'fortune') => this.cue(ev, { x: m.x, y: m.y, text });
    switch (this.stage) {
      case LS.Dormant:
        this.stage = LS.Souls;
        say(FORTUNES.awaken, 'awaken');
        break;
      case LS.Souls:
        say(FORTUNES.awaken);
        break;
      case LS.Melody:
        say(FORTUNES.lampsLit);
        break;
      case LS.Calling:
        this.stage = LS.Striker;
        say(FORTUNES.melodySolved);
        break;
      case LS.Striker:
        say(FORTUNES.melodySolved);
        break;
      case LS.Carrying:
        say(FORTUNES.ticket);
        break;
      case LS.Complete:
        say(FORTUNES.completed);
        break;
      default:
        say(FORTUNES.idle[this.idleIdx++ % FORTUNES.idle.length]);
    }
  }

  onKill(e: Enemy): void {
    if (this.stage !== LS.Souls) return;
    // a kill feeds the nearest unlit lamp in range
    let best = -1, bd = LAST_SONG.soulRadius ** 2;
    for (let i = 0; i < 4; i++) {
      if (this.lit[i]) continue;
      const l = LAST_SONG.lamps[i];
      const d = dist2(e.x, e.y, l.x, l.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best < 0) return;
    const l = LAST_SONG.lamps[best];
    this.souls[best]++;
    this.cue('soul', { x: e.x, y: e.y, a: best });
    if (this.souls[best] >= LAST_SONG.soulsPerLamp) {
      this.lit[best] = true;
      this.cue('lamp_lit', { x: l.x, y: l.y, a: best, b: l.note });
      if (this.lit.every(Boolean)) {
        this.stage = LS.Melody;
        this.musicT = 2.5;
        this.cue('carousel_wakes', { x: LAST_SONG.carousel.x, y: LAST_SONG.carousel.y });
      }
    }
  }

  /** True once lamp `i`'s note has been played in the current attempt (it burns red; a wrong note clears it). */
  played(i: number): boolean {
    return this.order.indexOf(i) < this.progress;
  }

  private onTouchLamp(i: number): void {
    const l = LAST_SONG.lamps[i];
    if (!this.lit[i]) return;
    if (this.stage !== LS.Melody) {
      // before the song a lit lamp hums its note; once the song is sung every lamp has been played
      if (this.stage < LS.Melody) this.cue('hum', { x: l.x, y: l.y, a: i, b: l.note });
      return;
    }
    // a played lamp stays silent until a wrong note resets the song
    if (this.played(i)) return;
    this.cue('note', { x: l.x, y: l.y, a: i, b: l.note });
    if (this.order[this.progress] === i) {
      this.progress++;
      // the lamp sends up a wisp of its emblem, the one painted on the carousel (D-58)
      this.cue('lamp_wisp', { x: l.x, y: l.y, a: i });
      if (this.progress >= 4) {
        this.stage = LS.Calling;
        const m = LAST_SONG.machine;
        this.cue('melody_solved', { x: m.x, y: m.y });
      } else this.cue('note_true', { x: l.x, y: l.y, a: this.progress });
    } else {
      this.progress = 0;
      this.cue('sour', { x: l.x, y: l.y, a: i });
    }
  }

  private onPad(): void {
    const s = LAST_SONG.striker;
    const hit = this.strikerInWindow();
    if (this.stage !== LS.Striker) {
      // a toy otherwise: it rings, but nothing answers
      this.cue(hit ? 'ding' : 'clunk', { x: s.x, y: s.y, a: 0, b: 0 });
      return;
    }
    if (!hit) {
      this.cue('clunk', { x: s.x, y: s.y, a: this.rings, b: 1 });
      return;
    }
    this.rings++;
    this.cue('ding', { x: s.x, y: s.y, a: this.rings, b: 1 });
    if (this.rings >= s.rings) {
      this.stage = LS.Carrying;
      this.carrying = true;
      this.cue('ticket', { x: s.x, y: s.y });
    }
  }

  onBossDefeated(id: string): boolean {
    const g = this.g;
    if (id === 'ringmaster' && this.stage === LS.Carrying) {
      this.stage = LS.Finale;
      this.carrying = false;
      this.finaleT = LAST_SONG.finaleDelay;
      g.finaleActive = true;
      this.cue('finale', { x: LAST_SONG.finaleAt.x, y: LAST_SONG.finaleAt.y });
      return true; // no victory lap: the dawn is refused
    }
    if (id === 'calliope' && this.stage === LS.Finale) {
      this.stage = LS.Complete;
      g.finaleActive = false;
      g.trueEnding = true;
      g.ringmasterDefeated = true;
      g.achievementsHit.add('last_song');
      if (!g.endless) g.time = Math.max(g.time, DAWN_TIME);
      this.cue('complete', {});
      return true;
    }
    return false;
  }
}
