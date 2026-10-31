// "The Unreflected" — the Fun House's hidden quest chain (D-63; solution: docs/EASTER_EGG_FUN_HOUSE.md).
//
//   0 DORMANT    A cracked hand mirror glints on the Lost & Found counter in the Grand Entrance.
//   1 FACES      Picking it up curses the party's sight: four maze mirrors now show a performer's face
//                in their reflections. Touch the glass where each face looks out to free it.
//   2 MURAL      The freed faces return to their plinths in the Puppet Gallery. The smeared mural in the
//                Chamber of Illusions resolves from its brass footprints: the performers' bow order.
//   3 OVERTURE   Touch the plinths in that order (a wrong one stops the music box: start again).
//   4 PROJECTOR  The gallery's great curtain parts on a prism projector: keep someone beside it for
//                30 seconds while it warms (it cools slowly when left).
//   5 BEAM       Its beam runs down into the maze. Turn the four pivot mirrors on their plates to lead
//                it to the crystal at the Heart; the Heart's north glass turns to water.
//   6 VANITY     In Mira's dressing room her vanity shows the hour he took her, as a mirror shows it.
//                Of the house's four stopped clocks, strike the one that truly shows that hour.
//
// Everything a player does by hand is a press of interact (E, or A on a pad) within reach (D-67): the
// mirror, the glass, the footprints, a plinth, a pivot (one notch a press), the vanity, a clock. Only
// the projector still asks someone to stay beside it.
//   7 CARRYING   Mira's Reflection follows whoever found the hour. Defeat the Proprietor while she does…
//   8 FINALE     …and the house shatters: the Unreflected rises in the Rotunda.
//   9 COMPLETE   Defeat it → the Fun House's True Dawn, an achievement, Mira's Hand Mirror unlocked.
//
// Co-op: one shared chain, any standing player can act, nothing ever needs two players at once.
// The host runs it; guests receive its state as a few bytes (`netState`).

import { dist2 } from '../../core/math';
import { Rng } from '../../core/rng';
import { UNREFLECTED_DEF } from '../../data/bosses';
import { PERFORMER_NAMES, UNREFLECTED, beamTrace, mirroredTime } from '../../data/funhouse';
import { DAWN_TIME } from '../../data/waves';
import { createBoss } from '../bosses';
import type { Game } from '../game';
import { QuestChain } from './quest';

export const UR = { Dormant: 0, Faces: 1, Mural: 2, Overture: 3, Projector: 4, Beam: 5, Vanity: 6, Carrying: 7, Finale: 8, Complete: 9 } as const;

/** Something in the house a player can use with interact right now (D-67). */
export interface Interaction {
  kind: 'mirror' | 'face' | 'mark' | 'plinth' | 'pivot' | 'vanity' | 'clock';
  /** which face, plinth, pivot or clock */
  i: number;
  x: number;
  y: number;
  /** what the prompt says */
  label: string;
}

/** How near a player must stand to use each kind (sim units). */
export const REACH: Record<Interaction['kind'], number> = { mirror: 120, face: 115, mark: 90, plinth: 115, pivot: 100, vanity: 115, clock: 105 };
/** Seconds before the same thing answers another press (a held or mashed key never double-counts). */
const COOLDOWN: Record<Interaction['kind'], number> = { mirror: 0, face: 0, mark: 0, plinth: 0.35, pivot: 0.2, vanity: 0, clock: 1.2 };

/** Where a player stands to strike a clock: a step out from its wall. */
export function clockSpot(k: number): { x: number; y: number } {
  const c = UNREFLECTED.clocks[k];
  return c.face === 'w' ? { x: c.x - 70, y: c.y } : { x: c.x, y: c.y + 70 };
}

export class UnreflectedChain extends QuestChain {
  readonly id = UNREFLECTED.id;
  /** bit per face freed (strongman, ballerina, clown, magician) */
  freed = 0;
  /** the performers' bow order (plinth indices), shown by the mural; per run */
  order = [0, 1, 2, 3];
  progress = 0;
  muralSeen = false;
  charge = 0;
  /** the four beam pivots' states (0..3); per-run starts, never already solved */
  pivots = [0, 0, 0, 0];
  vanitySeen = false;
  /** the four clocks' times [h, m]; one shows the true hour, one its mirror image (the trap) */
  times: [number, number][] = [[3, 0], [6, 15], [9, 30], [10, 45]];
  trueClock = 0;
  /** the player index Mira's Reflection follows (255: nobody) */
  carrier = 255;
  finaleT = -1;
  private faceSeen = false;
  private chargeQ = 0;
  /** per-thing cooldowns after a press (kind + index → seconds left) */
  private cool = new Map<string, number>();

  init(): void {
    // its own random stream, so the quest never perturbs gameplay randomness
    const r = new Rng((this.g.cfg.seed ^ 0x31a17f0e) >>> 0);
    r.shuffle(this.order);
    this.pivots = UNREFLECTED.beamSolution.map((s) => (s + 1 + r.int(0, 2)) % 4);
    // the true hour (never one that a mirror leaves unchanged), its mirror image, and two others
    const pick = (): [number, number] => [r.int(1, 12), r.int(0, 11) * 5];
    const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
    let t = pick();
    while (same(t, mirroredTime(t[0], t[1]))) t = pick();
    const list: [number, number][] = [t, mirroredTime(t[0], t[1])];
    while (list.length < 4) {
      const o = pick();
      if (!list.some((x) => same(x, o) || same(mirroredTime(x[0], x[1]), o))) list.push(o);
    }
    const slots = [0, 1, 2, 3];
    r.shuffle(slots);
    this.times = [[0, 0], [0, 0], [0, 0], [0, 0]];
    slots.forEach((clock, i) => (this.times[clock] = list[i]));
    this.trueClock = slots[0];
  }

  get complete(): boolean {
    return this.stage === UR.Complete;
  }

  /** The hour the vanity's glass shows (the true hour, mirrored). */
  get vanityTime(): [number, number] {
    const t = this.times[this.trueClock];
    return mirroredTime(t[0], t[1]);
  }

  beam(): ReturnType<typeof beamTrace> {
    return beamTrace(this.pivots);
  }

  /** What a player standing at (x, y) could use with interact right now: the nearest in reach, or null. */
  interaction(x: number, y: number): Interaction | null {
    const U = UNREFLECTED;
    const list: Interaction[] = [];
    switch (this.stage) {
      case UR.Dormant:
        list.push({ kind: 'mirror', i: 0, x: U.counter.x, y: U.counter.y, label: 'Pick up the hand mirror' });
        break;
      case UR.Faces:
        U.faces.forEach((f, i) => { if (!(this.freed & (1 << i))) list.push({ kind: 'face', i, x: f.x, y: f.y, label: 'Touch the glass' }); });
        break;
      case UR.Mural:
        list.push({ kind: 'mark', i: 0, x: U.mark.x, y: U.mark.y, label: 'Look from the brass footprints' });
        break;
      case UR.Overture:
        U.plinths.forEach((p, i) => list.push({ kind: 'plinth', i, x: p.x, y: p.y, label: `Touch ${PERFORMER_NAMES[i]}'s plinth` }));
        break;
      case UR.Beam:
        U.beamPivots.forEach((p, i) => list.push({ kind: 'pivot', i, x: p.x, y: p.y, label: 'Turn the mirror' }));
        break;
      case UR.Vanity: {
        const v = U.vanity;
        if (!this.vanitySeen) list.push({ kind: 'vanity', i: 0, x: v.x, y: v.y + 40, label: 'Look into the vanity' });
        for (let k = 0; k < 4; k++) {
          const s = clockSpot(k);
          list.push({ kind: 'clock', i: k, x: s.x, y: s.y, label: 'Strike the hour' });
        }
        break;
      }
    }
    let best: Interaction | null = null, bd = Infinity;
    for (const it of list) {
      const d = dist2(x, y, it.x, it.y);
      if (d < REACH[it.kind] ** 2 && d < bd) {
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
    const near = (x: number, y: number, r: number) => up.some((p) => dist2(p.x, p.y, x, y) < r * r);
    const U = UNREFLECTED;
    for (const [k, t] of this.cool) if (t - dt <= 0) this.cool.delete(k); else this.cool.set(k, t - dt);
    // presses first: each player who pressed uses the nearest thing in reach
    for (const p of up) {
      if (!g.inputs[p.index]?.interact) continue;
      const it = this.interaction(p.x, p.y);
      if (!it) continue;
      const key = `${it.kind}${it.i}`;
      if (this.cool.has(key)) continue;
      if (COOLDOWN[it.kind] > 0) this.cool.set(key, COOLDOWN[it.kind]);
      this.use(it, p.index);
    }
    switch (this.stage) {
      case UR.Faces: {
        // the first face anyone walks near whispers where to look
        if (!this.faceSeen) {
          const f = U.faces.find((q, i) => !(this.freed & (1 << i)) && near(q.x, q.y, U.faceReveal));
          if (f) {
            this.faceSeen = true;
            this.cue('u_face_seen', { x: f.x, y: f.y });
          }
        }
        break;
      }
      case UR.Projector: {
        const P = U.projector;
        this.charge = near(P.x, P.y, P.r) ? this.charge + dt : Math.max(0, this.charge - U.chargeDecay * dt);
        const q = Math.floor((this.charge / U.charge) * 4);
        if (q > this.chargeQ && q < 4) this.cue('u_charge', { x: P.x, y: P.y, a: q });
        this.chargeQ = q;
        if (this.charge >= U.charge) {
          this.charge = U.charge;
          this.stage = UR.Beam;
          this.cue('u_beam', { x: P.x, y: P.y });
        }
        break;
      }
      case UR.Carrying: {
        // she follows someone standing: if her carrier falls, she goes to whoever is nearest
        const c = g.players[this.carrier];
        if (!c || !g.isUp(c)) {
          const n = up.length ? g.nearestLiving(c?.x ?? 0, c?.y ?? 0) : null;
          if (n) this.carrier = n.index;
        }
        break;
      }
      case UR.Finale: {
        if (this.finaleT >= 0) {
          this.finaleT -= dt;
          if (this.finaleT <= 0) {
            this.finaleT = -1;
            const b = createBoss(g, UNREFLECTED_DEF, { immediate: true, noChest: true });
            b.x = b.px = U.finaleAt.x;
            b.y = b.py = U.finaleAt.y;
            g.bosses.push(b);
            this.cue('u_rises', { x: b.x, y: b.y });
          }
        }
        break;
      }
    }
  }

  /** A player (index `who`) used `it`. */
  private use(it: Interaction, who: number): void {
    const g = this.g;
    const U = UNREFLECTED;
    switch (it.kind) {
      case 'mirror':
        this.stage = UR.Faces;
        this.cue('u_awaken', { x: it.x, y: it.y });
        break;
      case 'face': {
        this.freed |= 1 << it.i;
        const n = [0, 1, 2, 3].filter((k) => this.freed & (1 << k)).length;
        this.cue('u_face', { x: it.x, y: it.y, a: it.i, b: n });
        if (n === 4) {
          this.stage = UR.Mural;
          this.cue('u_faces_done', {});
        }
        break;
      }
      case 'mark':
        this.muralSeen = true;
        this.stage = UR.Overture;
        this.progress = 0;
        this.cue('u_mural', { x: U.mural.x, y: U.mural.y });
        break;
      case 'plinth':
        this.touchPlinth(it.i);
        break;
      case 'pivot':
        this.pivots[it.i] = (this.pivots[it.i] + 1) % 4;
        this.cue('u_pivot', { x: it.x, y: it.y, a: it.i, b: this.pivots[it.i] });
        if (this.beam().hit) {
          this.stage = UR.Vanity;
          g.funhouseDoorOpen = true;
          this.cue('u_door', { x: U.crystal.x, y: U.crystal.y });
        }
        break;
      case 'vanity':
        this.vanitySeen = true;
        this.cue('u_vanity', { x: U.vanity.x, y: U.vanity.y });
        break;
      case 'clock':
        if (it.i === this.trueClock) {
          this.carrier = who; // she follows whoever found the hour
          this.stage = UR.Carrying;
          this.cue('u_mira', { x: it.x, y: it.y, a: it.i });
        } else this.cue('u_wrong_clock', { x: it.x, y: it.y, a: it.i });
        break;
    }
  }

  private touchPlinth(j: number): void {
    const pl = UNREFLECTED.plinths[j];
    if (j === this.order[this.progress]) {
      this.progress++;
      this.cue('u_note', { x: pl.x, y: pl.y, a: j, b: this.progress });
      if (this.progress >= 4) {
        this.stage = UR.Projector;
        this.charge = 0;
        this.cue('u_overture', { x: UNREFLECTED.projector.x, y: UNREFLECTED.projector.y });
      }
    } else {
      this.progress = 0;
      this.cue('u_sour', { x: pl.x, y: pl.y, a: j });
    }
  }

  onBossDefeated(id: string): boolean {
    const g = this.g;
    if (id === 'proprietor' && this.stage === UR.Carrying) {
      this.stage = UR.Finale;
      this.carrier = 255;
      this.finaleT = UNREFLECTED.finaleDelay;
      g.finaleActive = true;
      this.cue('u_finale', { x: UNREFLECTED.finaleAt.x, y: UNREFLECTED.finaleAt.y });
      return true; // no dawn yet: the house is breaking
    }
    if (id === 'unreflected' && this.stage === UR.Finale) {
      this.stage = UR.Complete;
      g.finaleActive = false;
      g.trueEnding = true;
      g.ringmasterDefeated = true;
      g.achievementsHit.add('unreflected');
      if (!g.endless) g.time = Math.max(g.time, DAWN_TIME);
      this.cue('u_complete', {});
      return true;
    }
    return false;
  }

  // ---- co-op: the whole chain in a few bytes
  netState(): number[] {
    const v = [this.stage, this.freed, this.order.reduce((m, o, i) => m | ((o & 3) << (i * 2)), 0), this.progress, Math.round((this.charge / UNREFLECTED.charge) * 240),
      this.pivots.reduce((m, o, i) => m | ((o & 3) << (i * 2)), 0), (this.muralSeen ? 1 : 0) | (this.vanitySeen ? 2 : 0), this.trueClock, this.carrier];
    for (const t of this.times) v.push(t[0], t[1]);
    return v;
  }

  applyNet(v: number[]): void {
    if (v.length < 17) return;
    this.stage = v[0];
    this.freed = v[1];
    this.order = [0, 1, 2, 3].map((i) => (v[2] >> (i * 2)) & 3);
    this.progress = v[3];
    this.charge = (v[4] / 240) * UNREFLECTED.charge;
    this.pivots = [0, 1, 2, 3].map((i) => (v[5] >> (i * 2)) & 3);
    this.muralSeen = !!(v[6] & 1);
    this.vanitySeen = !!(v[6] & 2);
    this.trueClock = v[7];
    this.carrier = v[8];
    this.times = [0, 1, 2, 3].map((k) => [v[9 + k * 2], v[10 + k * 2]] as [number, number]);
  }
}
