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
//   5 BEAM       Its beam runs down into the maze. Turn the four pivot mirrors (stand on their plates)
//                to lead it to the crystal at the Heart; the Heart's north glass turns to water.
//   6 VANITY     In Mira's dressing room her vanity shows the hour he took her, as a mirror shows it.
//                Of the house's four stopped clocks, stand at the one that truly shows that hour.
//   7 CARRYING   Mira's Reflection follows whoever found the hour. Defeat the Proprietor while she does…
//   8 FINALE     …and the house shatters: the Unreflected rises in the Rotunda.
//   9 COMPLETE   Defeat it → the Fun House's True Dawn, an achievement, Mira's Hand Mirror unlocked.
//
// Co-op: one shared chain, any standing player can act, nothing ever needs two players at once.
// The host runs it; guests receive its state as a few bytes (`netState`).

import { dist2 } from '../../core/math';
import { Rng } from '../../core/rng';
import { UNREFLECTED_DEF } from '../../data/bosses';
import { UNREFLECTED, beamTrace, mirroredTime } from '../../data/funhouse';
import { DAWN_TIME } from '../../data/waves';
import { createBoss } from '../bosses';
import type { Game } from '../game';
import { QuestChain } from './quest';

export const UR = { Dormant: 0, Faces: 1, Mural: 2, Overture: 3, Projector: 4, Beam: 5, Vanity: 6, Carrying: 7, Finale: 8, Complete: 9 } as const;

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
  private markT = 0;
  private plateT = [0, 0, 0, 0];
  private clockT = [0, 0, 0, 0];
  private plinthIn: boolean[][] = [];
  private chargeQ = 0;

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

  update(dt: number): void {
    const g = this.g;
    if (g.phase !== 'play') return;
    const up = g.players.filter((p) => g.isUp(p));
    const near = (x: number, y: number, r: number) => up.some((p) => dist2(p.x, p.y, x, y) < r * r);
    const U = UNREFLECTED;
    switch (this.stage) {
      case UR.Dormant: {
        const c = U.counter;
        if (near(c.x, c.y, c.r)) {
          this.stage = UR.Faces;
          this.cue('u_awaken', { x: c.x, y: c.y });
        }
        break;
      }
      case UR.Faces: {
        U.faces.forEach((f, i) => {
          if (this.freed & (1 << i)) return;
          if (!this.faceSeen && near(f.x, f.y, U.faceReveal)) {
            this.faceSeen = true;
            this.cue('u_face_seen', { x: f.x, y: f.y });
          }
          if (near(f.x, f.y, U.faceTouch)) {
            this.freed |= 1 << i;
            const n = [0, 1, 2, 3].filter((k) => this.freed & (1 << k)).length;
            this.cue('u_face', { x: f.x, y: f.y, a: i, b: n });
            if (n === 4) {
              this.stage = UR.Mural;
              this.cue('u_faces_done', {});
            }
          }
        });
        break;
      }
      case UR.Mural: {
        const m = U.mark;
        this.markT = near(m.x, m.y, m.r) ? this.markT + dt : 0;
        if (this.markT >= U.markHold) {
          this.muralSeen = true;
          this.stage = UR.Overture;
          this.progress = 0;
          this.cue('u_mural', { x: U.mural.x, y: U.mural.y });
        }
        break;
      }
      case UR.Overture: {
        for (const p of up) {
          const ins = (this.plinthIn[p.index] ??= [false, false, false, false]);
          U.plinths.forEach((pl, j) => {
            const d = dist2(p.x, p.y, pl.x, pl.y);
            if (d < U.plinthR * U.plinthR) {
              if (ins[j]) return;
              ins[j] = true;
              this.touchPlinth(j);
            } else if (d > (U.plinthR + 45) ** 2) ins[j] = false;
          });
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
      case UR.Beam: {
        U.beamPivots.forEach((pv, i) => {
          if (!near(pv.x, pv.y, U.pivotPlate)) {
            this.plateT[i] = 0;
            return;
          }
          this.plateT[i] += dt;
          if (this.plateT[i] < U.pivotStep) return;
          this.plateT[i] -= U.pivotStep;
          this.pivots[i] = (this.pivots[i] + 1) % 4;
          this.cue('u_pivot', { x: pv.x, y: pv.y, a: i, b: this.pivots[i] });
          if (this.beam().hit) {
            this.stage = UR.Vanity;
            g.funhouseDoorOpen = true;
            this.cue('u_door', { x: U.crystal.x, y: U.crystal.y });
          }
        });
        break;
      }
      case UR.Vanity: {
        const v = U.vanity;
        if (!this.vanitySeen && near(v.x, v.y + 40, 95)) {
          this.vanitySeen = true;
          this.cue('u_vanity', { x: v.x, y: v.y });
        }
        for (let k = 0; k < 4; k++) {
          const s = clockSpot(k);
          if (!near(s.x, s.y, 90)) {
            this.clockT[k] = 0;
            continue;
          }
          if (this.clockT[k] < 0) continue; // struck already: step away to try again
          this.clockT[k] += dt;
          if (this.clockT[k] < U.clockHold) continue;
          this.clockT[k] = -1;
          if (k === this.trueClock) {
            const who = g.nearestLiving(s.x, s.y);
            this.carrier = who.index;
            this.stage = UR.Carrying;
            this.cue('u_mira', { x: s.x, y: s.y, a: k });
          } else this.cue('u_wrong_clock', { x: s.x, y: s.y, a: k });
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
