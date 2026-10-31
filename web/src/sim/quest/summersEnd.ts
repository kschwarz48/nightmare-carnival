// "Summer's End" — the Boardwalk's hidden quest chain (D-68; solution: docs/EASTER_EGG_BOARDWALK.md).
//
//   0 CONCH       At low tide a conch shows at the waterline (one of four places a night). Pick it up:
//                 Ada, the Commodore's daughter, speaks through it.
//   1 MARINA      Hold it to the Arcade's drowned fortune machine: Madame Marina prints a card.
//   2 PHOTOGRAPH  The 1933 photograph in the Gift Shop shows Ada with four keepsakes; the shelves hold
//                 eight look-alike souvenirs. Take the four that are hers.
//   3 GAMES       The park's games kept the real ones: knock down the shooting gallery's six ducks in
//                 time, drop the Crane's claw on its prize, catch the Sea Wheel's green-lantern car at the
//                 bottom, brake the Undertow as it comes home. Any order.
//   4 WRECK       At low tide, set each keepsake in the Gala Queen's porthole engraved with it (each
//                 press turns a porthole's keepsake; the engravings change every night).
//   5 KEY         Take the bait shop's rod; fish the foghorn key out of the bubbling water off the little
//                 dock (cast, wait for the bite, pull).
//   6 FOGHORN     Unlock the foghorn: the drowned ship answers with her call sign (short and long blasts,
//                 a new one every night; the lighthouse flashes it too). Answer on the SHORT/LONG chains.
//   7 GALA QUEEN  She moors at the pier's end. Take St. Elmo's fire from her bow and carry it to the four
//                 tide lamps before it burns out (lit lamps stay lit; more fire waits on the ship).
//   8 LOW WATER   The sea goes out, all the way out, and stays out: the seabed shows the founder's bell.
//   9 BELL        Stay with the bell while the pier's hoist winches it up (it settles back when left).
//  10 LEDGER      Read the Commodore's ledger in the Gift Shop's back cabinet; the bell follows its reader.
//  11 ACCOUNT     When the Leviathan's head is up, ring the bell at it three times. While the account is
//                 open it cannot die; rung thrice, it is bound and goes down…
//  12 FINALE      …and the Commodore comes up the boards to collect: the secret boss.
//  13 COMPLETE    Defeat him: the Boardwalk's True Dawn, an achievement, Ada's Conch unlocked.
//
// Everything a player does is a press of interact (E, or A on a pad) within reach, except staying with
// the bell. Co-op: one shared chain, any standing player can act, nothing needs two players at once, and
// whatever is carried (the rod, the fire, the bell) passes to the nearest standing player if its carrier
// falls. The host runs it; guests receive its state as a few bytes (`netState`). Nothing can be lost for
// good: every miss can be retried, and the only thing that ends it is the night itself.

import { dist2 } from '../../core/math';
import { Rng } from '../../core/rng';
import { COMMODORE_DEF } from '../../data/bosses';
import { ADA, GAME_NAMES, KEEPSAKE_GAME, KEEPSAKES, SUMMERS_END, isLowTide, shoreBase, trainU, wheelFromBottom } from '../../data/boardwalk';
import { DAWN_TIME } from '../../data/waves';
import { createBoss } from '../bosses';
import type { LeviathanBoss } from '../bosses/leviathan';
import type { Enemy } from '../entities';
import type { Game } from '../game';
import { QuestChain } from './quest';

export const SE = { Conch: 0, Marina: 1, Photograph: 2, Games: 3, Wreck: 4, Key: 5, Foghorn: 6, GalaQueen: 7, LowWater: 8, Bell: 9, Ledger: 10, Account: 11, Finale: 12, Complete: 13 } as const;

export type SEKind = 'conch' | 'marina' | 'photo' | 'shelf' | 'gallery' | 'crane' | 'wheel' | 'brake' | 'porthole' | 'rod' | 'cast' | 'reel' | 'foghorn' | 'short' | 'long' | 'fire' | 'lamp' | 'cabinet' | 'strike';

/** Something on the boardwalk a player can use with interact right now. */
export interface SEInteraction {
  kind: SEKind;
  i: number;
  x: number;
  y: number;
  label: string;
}

/** How near a player must stand to use each kind (sim units). */
export const SE_REACH: Record<SEKind, number> = {
  conch: 110, marina: 120, photo: 120, shelf: 75, gallery: 130, crane: 120, wheel: 140, brake: 110, porthole: 85, rod: 110,
  cast: 120, reel: 120, foghorn: 130, short: 70, long: 70, fire: 130, lamp: 120, cabinet: 110, strike: 1e9,
};
/** Seconds before the same thing answers another press (a held or mashed key never double-counts). */
const COOLDOWN: Partial<Record<SEKind, number>> = { marina: 2.5, shelf: 0.3, porthole: 0.2, short: 0.25, long: 0.25, crane: 1.6, wheel: 1, brake: 1.2, cast: 0.6, foghorn: 2, strike: SUMMERS_END.strikeCool, gallery: 1 };

export class SummersEndChain extends QuestChain {
  readonly id = SUMMERS_END.id;
  /** which of the waterline spots the conch washed up at tonight */
  conch = 0;
  /** Ada's four keepsakes tonight (bitmask over KEEPSAKES: one for each game), and which have been taken */
  keepsakes = 0;
  taken = 0;
  photoSeen = false;
  /** the games won back (bit per game) */
  won = 0;
  /** porthole k's engraving (a game index), and what it shows now */
  engraved = [0, 1, 2, 3];
  holes = [0, 0, 0, 0];
  /** the Sea Wheel gondola carrying the green lantern */
  greenCar = 0;
  /** the shooting gallery's round: seconds left (-1: none) and ducks down */
  galleryT = -1;
  galleryHit = 0;
  /** the call sign: one bit a blast (1 long), how many blasts, how many answered right so far */
  callSign = 0;
  callLen = 4;
  heard = 0;
  /** who holds the rod (255: nobody); the cast (0 idle, 1 out, 2 biting) and its clock */
  rodBy = 255;
  cast = 0;
  castT = 0;
  biteAt = 0;
  /** who carries St. Elmo's fire, and how long it has left; which tide lamps are lit */
  fireBy = 255;
  fireT = 0;
  lit = 0;
  /** 0..1 how far the sea has gone out (refreshSea reads it) */
  retreat = 0;
  /** seconds someone has stayed with the bell; who carries it after the ledger; times it has rung */
  bellT = 0;
  bellBy = 255;
  strikes = 0;
  bound = false;
  finaleT = -1;
  private rng!: Rng;
  private cool = new Map<string, number>();
  /** how many times Marina has been asked for a hint tonight (host-side; each answer is plainer) */
  private hints = 0;
  private ducks = new Set<number>();
  private pressureT = 0;

  init(): void {
    // its own random stream, so the quest never perturbs gameplay randomness
    const r = (this.rng = new Rng((this.g.cfg.seed ^ 0x5e5e1933) >>> 0));
    this.conch = r.int(0, SUMMERS_END.conchXs.length - 1);
    // one keepsake for each game, chosen from that game's pair
    this.keepsakes = 0;
    for (let game = 0; game < 4; game++) {
      const pair = KEEPSAKE_GAME.map((gm, i) => (gm === game ? i : -1)).filter((i) => i >= 0);
      this.keepsakes |= 1 << pair[r.int(0, pair.length - 1)];
    }
    this.engraved = [0, 1, 2, 3];
    r.shuffle(this.engraved);
    // each porthole starts showing something other than its engraving
    this.holes = this.engraved.map((e) => (e + 1 + r.int(0, 2)) % 4);
    this.greenCar = r.int(0, 19);
    // a call sign of four blasts that isn't all one kind
    do this.callSign = r.int(0, 15);
    while (this.callSign === 0 || this.callSign === 15);
    this.callLen = 4;
  }

  get complete(): boolean {
    return this.stage === SE.Complete;
  }

  /** While the account is open the Leviathan cannot die (it must be bound by the bell). */
  get holdsLeviathan(): boolean {
    return this.stage === SE.Account && !this.bound;
  }

  /** Where the conch lies tonight. */
  conchSpot(): { x: number; y: number } {
    const x = SUMMERS_END.conchXs[this.conch];
    return { x, y: shoreBase(x) + 30 };
  }

  /** The keepsake each game holds tonight (index into KEEPSAKES). */
  keepsakeFor(game: number): number {
    for (let i = 0; i < KEEPSAKES.length; i++) if (this.keepsakes & (1 << i) && KEEPSAKE_GAME[i] === game) return i;
    return 0;
  }

  /** The Leviathan, if it is up and in reach of the bell's carrier. */
  private leviathanInReach(x: number, y: number): LeviathanBoss | null {
    const b = this.g.bosses.find((q) => q.def.id === 'leviathan' && q.awake && !q.dead) as LeviathanBoss | undefined;
    if (!b || !b.headUp) return null;
    return dist2(b.x, b.y, x, y) < SUMMERS_END.strikeRange ** 2 ? b : null;
  }

  /** What player `who`, standing at (x, y), could use with interact right now: the nearest in reach, or null. */
  interaction(x: number, y: number, who = this.g.player.index): SEInteraction | null {
    const S = SUMMERS_END;
    const g = this.g;
    const list: SEInteraction[] = [];
    switch (this.stage) {
      case SE.Conch:
        if (isLowTide(g.time)) {
          const c = this.conchSpot();
          list.push({ kind: 'conch', i: 0, x: c.x, y: c.y, label: 'Pick up the conch' });
        }
        // before anything else, Madame Marina will tell a fortune: how the night's story begins
        list.push({ kind: 'marina', i: 1, x: S.marina.x, y: S.marina.y, label: 'Ask Madame Marina' });
        break;
      case SE.Marina:
        list.push({ kind: 'marina', i: 0, x: S.marina.x, y: S.marina.y, label: 'Hold the conch to the glass' });
        break;
      case SE.Photograph:
        list.push({ kind: 'photo', i: 0, x: S.photo.x, y: S.photo.y, label: 'Look at the photograph' });
        if (this.photoSeen) S.shelf.forEach(([sx, sy], i) => { if (!(this.taken & (1 << i))) list.push({ kind: 'shelf', i, x: sx, y: sy, label: `Take the ${KEEPSAKES[i]}` }); });
        break;
      case SE.Games:
        if (!(this.won & 1)) list.push({ kind: 'gallery', i: 0, x: S.gallery.x, y: S.gallery.y, label: this.galleryT >= 0 ? 'Knock down the ducks!' : 'Play the shooting gallery' });
        if (!(this.won & 2)) list.push({ kind: 'crane', i: 0, x: S.crane.x, y: S.crane.y, label: 'Drop the claw' });
        if (!(this.won & 4)) list.push({ kind: 'wheel', i: 0, x: S.wheel.x, y: S.wheel.y, label: 'Reach into the car' });
        if (!(this.won & 8)) list.push({ kind: 'brake', i: 0, x: S.brake.x, y: S.brake.y, label: 'Pull the brake' });
        break;
      case SE.Wreck:
        S.portholes.forEach((h, i) => list.push({ kind: 'porthole', i, x: h.x, y: h.y, label: isLowTide(g.time) ? 'Turn the porthole' : 'The water is over the wreck' }));
        break;
      case SE.Key:
        if (this.rodBy === 255) list.push({ kind: 'rod', i: 0, x: S.rod.x, y: S.rod.y, label: 'Take the fishing rod' });
        else if (this.rodBy === who) list.push(this.cast === 0 ? { kind: 'cast', i: 0, x: S.fishing.x, y: S.fishing.y, label: 'Cast the line' } : { kind: 'reel', i: 0, x: S.fishing.x, y: S.fishing.y, label: 'Pull!' });
        break;
      case SE.Foghorn:
        list.push({ kind: 'foghorn', i: 0, x: S.foghorn.x, y: S.foghorn.y, label: 'Sound the foghorn' });
        list.push({ kind: 'short', i: 0, x: S.short.x, y: S.short.y, label: 'Pull the SHORT chain' });
        list.push({ kind: 'long', i: 1, x: S.long.x, y: S.long.y, label: 'Pull the LONG chain' });
        break;
      case SE.GalaQueen:
        if (this.fireBy === 255 || this.fireBy === who) list.push({ kind: 'fire', i: 0, x: S.berth.x, y: S.berth.y, label: this.fireBy === who ? 'Take fresh fire' : "Take St. Elmo's fire" });
        if (this.fireBy === who) S.lamps.forEach((L, i) => { if (!(this.lit & (1 << i))) list.push({ kind: 'lamp', i, x: L.x, y: L.y, label: 'Light the tide lamp' }); });
        break;
      case SE.Ledger:
        list.push({ kind: 'cabinet', i: 0, x: S.cabinet.x, y: S.cabinet.y, label: 'Open the ledger' });
        break;
      case SE.Account:
        if (this.bellBy === who && this.leviathanInReach(x, y)) list.push({ kind: 'strike', i: 0, x, y, label: 'Ring the bell' });
        break;
    }
    let best: SEInteraction | null = null, bd = Infinity;
    for (const it of list) {
      const d = dist2(x, y, it.x, it.y);
      if (d < SE_REACH[it.kind] ** 2 && d < bd) {
        best = it;
        bd = d;
      }
    }
    return best;
  }

  update(dt: number): void {
    const g = this.g;
    if (g.phase !== 'play') return;
    const S = SUMMERS_END;
    const up = g.players.filter((p) => g.isUp(p));
    const near = (x: number, y: number, r: number) => up.some((p) => dist2(p.x, p.y, x, y) < r * r);
    for (const [k, t] of this.cool) if (t - dt <= 0) this.cool.delete(k); else this.cool.set(k, t - dt);
    // presses first: each player who pressed uses the nearest thing in reach
    for (const p of up) {
      if (!g.inputs[p.index]?.interact) continue;
      const it = this.interaction(p.x, p.y, p.index);
      if (!it) continue;
      const key = `${it.kind}${it.i}`;
      if (this.cool.has(key)) continue;
      const cd = COOLDOWN[it.kind] ?? 0;
      if (cd > 0) this.cool.set(key, cd);
      this.use(it, p.index);
    }
    // whatever is carried passes to the nearest standing player if its carrier falls
    const pass = (by: number): number => {
      if (by === 255) return 255;
      const c = g.players[by];
      if (c && g.isUp(c)) return by;
      return up.length ? g.nearestLiving(c?.x ?? 0, c?.y ?? 0).index : by;
    };
    this.rodBy = pass(this.rodBy);
    this.fireBy = pass(this.fireBy);
    this.bellBy = pass(this.bellBy);
    switch (this.stage) {
      case SE.Games:
        if (this.galleryT >= 0) {
          this.galleryT -= dt;
          if (this.galleryT <= 0) this.endGallery(false);
        }
        break;
      case SE.Key:
        if (this.cast > 0) {
          this.castT += dt;
          if (this.cast === 1 && this.castT >= this.biteAt) {
            this.cast = 2;
            this.cue('se_bite', { x: S.fishing.x, y: S.fishing.y + 90 });
          } else if (this.cast === 2 && this.castT > this.biteAt + S.fishing.window) {
            this.cast = 0;
            this.cue('se_missed', { x: S.fishing.x, y: S.fishing.y + 90 });
          }
        }
        break;
      case SE.GalaQueen:
        if (this.fireBy !== 255) {
          this.fireT -= dt;
          if (this.fireT <= 0) {
            this.fireBy = 255;
            this.fireT = 0;
            this.cue('se_guttered', {});
          }
        }
        break;
      case SE.LowWater:
        this.retreat = Math.min(1, this.retreat + dt / S.retreatTime);
        if (this.retreat >= 1) {
          this.stage = SE.Bell;
          this.bellT = 0;
          this.cue('se_bell_seen', { x: S.bell.x, y: S.bell.y });
        }
        break;
      case SE.Bell: {
        const held = near(S.bell.x, S.bell.y, S.bell.r);
        this.bellT = held ? this.bellT + dt : Math.max(0, this.bellT - S.bell.decay * dt);
        // the sea doesn't give it up quietly: the drowned climb out of the mud round it
        this.pressureT -= dt;
        if (held && this.pressureT <= 0) {
          this.pressureT = 4.5;
          for (let i = 0; i < 2 + Math.min(2, g.act - 1); i++) {
            const a = g.rng.angle();
            g.spawnEnemy('drowned', S.bell.x + Math.cos(a) * 280, S.bell.y + Math.sin(a) * 220, { exact: true });
          }
        }
        if (this.bellT >= S.bell.hold) {
          this.stage = SE.Ledger;
          this.cue('se_bell_up', { x: S.bell.x, y: S.bell.y });
        }
        break;
      }
      case SE.Finale:
        if (this.finaleT >= 0) {
          this.finaleT -= dt;
          if (this.finaleT <= 0) {
            this.finaleT = -1;
            const b = createBoss(g, COMMODORE_DEF, { immediate: true, noChest: true });
            g.bosses.push(b);
            this.cue('se_rises', { x: b.x, y: b.y });
          }
        }
        break;
    }
  }

  /** A player (index `who`) used `it`. */
  private use(it: SEInteraction, who: number): void {
    const g = this.g;
    const S = SUMMERS_END;
    switch (it.kind) {
      case 'conch':
        this.stage = SE.Marina;
        this.cue('se_conch', { x: it.x, y: it.y, text: ADA.conch.join('|') });
        break;
      case 'marina':
        if (this.stage === SE.Conch) {
          this.cue('se_hint', { x: it.x, y: it.y, a: Math.min(this.hints++, ADA.hint.length - 1) });
          break;
        }
        this.stage = SE.Photograph;
        this.cue('se_marina', { x: it.x, y: it.y });
        break;
      case 'photo':
        this.photoSeen = true;
        this.cue('se_photo', { x: it.x, y: it.y, a: this.keepsakes });
        break;
      case 'shelf': {
        if (this.keepsakes & (1 << it.i)) {
          this.taken |= 1 << it.i;
          const n = popcount(this.taken);
          this.cue('se_shelf', { x: it.x, y: it.y, a: it.i, b: n });
          if (n >= 4) {
            this.stage = SE.Games;
            this.cue('se_games', {});
          }
        } else this.cue('se_shelf_false', { x: it.x, y: it.y, a: it.i });
        break;
      }
      case 'gallery':
        if (this.galleryT < 0) this.startGallery();
        break;
      case 'crane': {
        const off = (((g.time / S.crane.period) % 0.5) + 0.5) % 0.5;
        if (off < S.crane.window || off > 0.5 - S.crane.window) this.winGame(1, it.x, it.y);
        else this.cue('se_miss', { x: it.x, y: it.y, a: 1 });
        break;
      }
      case 'wheel':
        if (wheelFromBottom(this.greenCar, g.time) < S.wheel.window) this.winGame(2, it.x, it.y);
        else this.cue('se_miss', { x: it.x, y: it.y, a: 2 });
        break;
      case 'brake': {
        const tr = trainU(g.time);
        if (!tr.dwelling && tr.u >= S.brake.u0) this.winGame(3, it.x, it.y);
        else this.cue('se_miss', { x: it.x, y: it.y, a: 3 });
        break;
      }
      case 'porthole':
        if (!isLowTide(g.time)) {
          this.cue('se_wreck_high', { x: it.x, y: it.y });
          this.cool.set(`porthole${it.i}`, 2);
          break;
        }
        this.holes[it.i] = (this.holes[it.i] + 1) % 4;
        this.cue('se_porthole', { x: it.x, y: it.y, a: it.i, b: this.holes[it.i] });
        if (this.holes.every((h, k) => h === this.engraved[k])) {
          this.stage = SE.Key;
          this.cue('se_wreck_done', { x: S.portholes[1].x, y: S.portholes[1].y });
        }
        break;
      case 'rod':
        this.rodBy = who;
        this.cue('se_rod', { x: it.x, y: it.y });
        break;
      case 'cast':
        this.cast = 1;
        this.castT = 0;
        this.biteAt = S.fishing.biteMin + this.rng.next() * (S.fishing.biteMax - S.fishing.biteMin);
        this.cue('se_cast', { x: S.fishing.x, y: S.fishing.y + 90 });
        break;
      case 'reel':
        if (this.cast === 2) {
          this.cast = 0;
          this.rodBy = 255;
          this.stage = SE.Foghorn;
          this.heard = 0;
          this.cue('se_key', { x: S.fishing.x, y: S.fishing.y + 90 });
        } else {
          this.cast = 0;
          this.cue('se_missed', { x: S.fishing.x, y: S.fishing.y + 90 });
        }
        break;
      case 'foghorn':
        this.heard = 0;
        this.cue('se_call', { x: S.foghorn.x, y: S.foghorn.y, a: this.callSign, b: this.callLen });
        break;
      case 'short':
      case 'long': {
        const want = (this.callSign >> this.heard) & 1;
        const got = it.kind === 'long' ? 1 : 0;
        this.cue('se_chain', { x: it.x, y: it.y, a: got });
        if (want === got) {
          this.heard++;
          if (this.heard >= this.callLen) {
            this.stage = SE.GalaQueen;
            this.cue('se_moored', { x: S.berth.x, y: S.berth.y });
          }
        } else {
          this.heard = 0;
          this.cue('se_wrong_call', { x: S.foghorn.x, y: S.foghorn.y, a: this.callSign, b: this.callLen });
        }
        break;
      }
      case 'fire':
        this.fireBy = who;
        this.fireT = S.fireTime;
        this.cue('se_fire', { x: it.x, y: it.y });
        break;
      case 'lamp':
        this.lit |= 1 << it.i;
        this.cue('se_lamp', { x: it.x, y: it.y, a: it.i, b: popcount(this.lit) });
        if (popcount(this.lit) >= 4) {
          this.fireBy = 255;
          this.stage = SE.LowWater;
          this.cue('se_low_water', {});
        }
        break;
      case 'cabinet':
        this.bellBy = who;
        this.stage = SE.Account;
        this.cue('se_ledger', { x: it.x, y: it.y });
        break;
      case 'strike': {
        const p = g.players[who];
        const lev = p ? this.leviathanInReach(p.x, p.y) : null;
        if (!lev) break;
        this.strikes++;
        this.cue('se_strike', { x: p.x, y: p.y, a: this.strikes });
        lev.flash = 1;
        lev.pose.roar = 1;
        if (this.strikes >= 3) {
          this.bound = true;
          this.cue('se_bound', { x: lev.x, y: lev.y });
          lev.bind();
        }
        break;
      }
    }
  }

  private winGame(game: number, x: number, y: number): void {
    this.won |= 1 << game;
    const n = popcount(this.won);
    this.cue('se_won', { x, y, a: game, b: n });
    if (n >= 4) {
      this.stage = SE.Wreck;
      this.cue('se_wreck', { x: SUMMERS_END.portholes[1].x, y: SUMMERS_END.portholes[1].y });
    }
  }

  /** Six tin ducks run the gallery's back wall; knock them all down before the time runs out. */
  private startGallery(): void {
    const g = this.g;
    const G = SUMMERS_END, A = { x0: G.gallery.x - 210, x1: G.gallery.x + 210, y: G.gallery.y - 130 };
    this.galleryT = G.galleryTime;
    this.galleryHit = 0;
    this.ducks.clear();
    for (let k = 0; k < G.galleryDucks; k++) {
      const e = g.spawnEnemy('tin_duck', A.x0 + (k / (G.galleryDucks - 1)) * (A.x1 - A.x0), A.y + (k % 2) * 34, { exact: true, noScale: true });
      if (!e) continue;
      e.dirX = k % 2 ? -1 : 1;
      e.dirY = 0;
      e.n1 = 1; // a gallery duck: runs back and forth between tx and ty, and never wanders off
      e.tx = A.x0;
      e.ty = A.x1;
      e.leashExempt = true;
      e.tickets = 0;
      this.ducks.add(e.uid);
    }
    this.cue('se_gallery', { x: G.gallery.x, y: G.gallery.y });
  }

  private endGallery(won: boolean): void {
    const g = this.g;
    for (const e of g.active) if (e.alive && this.ducks.has(e.uid)) g.despawnEnemy(e);
    this.ducks.clear();
    this.galleryT = -1;
    if (won) this.winGame(0, SUMMERS_END.gallery.x, SUMMERS_END.gallery.y);
    else this.cue('se_gallery_lost', { x: SUMMERS_END.gallery.x, y: SUMMERS_END.gallery.y });
  }

  onKill(e: Enemy): void {
    if (!this.ducks.has(e.uid)) return;
    this.ducks.delete(e.uid);
    this.galleryHit++;
    this.cue('se_duck', { x: e.x, y: e.y, a: this.galleryHit });
    if (this.galleryHit >= SUMMERS_END.galleryDucks) this.endGallery(true);
  }

  onBossDefeated(id: string): boolean {
    const g = this.g;
    if (id === 'leviathan' && this.stage === SE.Account && this.bound) {
      this.stage = SE.Finale;
      this.bellBy = 255;
      this.finaleT = SUMMERS_END.finaleDelay;
      g.finaleActive = true;
      this.cue('se_finale', {});
      return true; // no dawn yet: the Commodore is coming
    }
    if (id === 'commodore' && this.stage === SE.Finale) {
      this.stage = SE.Complete;
      g.finaleActive = false;
      g.trueEnding = true;
      g.ringmasterDefeated = true;
      g.achievementsHit.add('summers_end');
      if (!g.endless) g.time = Math.max(g.time, DAWN_TIME);
      this.cue('se_complete', {});
      return true;
    }
    return false;
  }

  // ---- co-op: the whole chain in a few bytes
  netState(): number[] {
    const pack = (a: number[]) => a.reduce((m, o, i) => m | ((o & 3) << (i * 2)), 0);
    return [
      this.stage, this.conch, this.keepsakes, this.taken, (this.photoSeen ? 1 : 0) | (this.bound ? 2 : 0), this.won, pack(this.engraved), pack(this.holes),
      this.greenCar, this.callSign, this.callLen, this.heard, this.rodBy, this.cast, this.galleryHit, Math.max(0, Math.round(this.galleryT * 8)),
      this.fireBy, Math.max(0, Math.round(this.fireT)), this.lit, Math.round(this.retreat * 250), Math.round((this.bellT / SUMMERS_END.bell.hold) * 250),
      this.bellBy, this.strikes, this.galleryT >= 0 ? 1 : 0,
    ];
  }

  applyNet(v: number[]): void {
    if (v.length < 24) return;
    const unpack = (m: number) => [0, 1, 2, 3].map((i) => (m >> (i * 2)) & 3);
    this.stage = v[0];
    this.conch = v[1];
    this.keepsakes = v[2];
    this.taken = v[3];
    this.photoSeen = !!(v[4] & 1);
    this.bound = !!(v[4] & 2);
    this.won = v[5];
    this.engraved = unpack(v[6]);
    this.holes = unpack(v[7]);
    this.greenCar = v[8];
    this.callSign = v[9];
    this.callLen = v[10];
    this.heard = v[11];
    this.rodBy = v[12];
    this.cast = v[13];
    this.galleryHit = v[14];
    this.galleryT = v[23] ? v[15] / 8 : -1;
    this.fireBy = v[16];
    this.fireT = v[17];
    this.lit = v[18];
    this.retreat = v[19] / 250;
    this.bellT = (v[20] / 250) * SUMMERS_END.bell.hold;
    this.bellBy = v[21];
    this.strikes = v[22];
  }
}

function popcount(m: number): number {
  let n = 0;
  for (let b = m; b; b &= b - 1) n++;
  return n;
}

export const _games = GAME_NAMES;
