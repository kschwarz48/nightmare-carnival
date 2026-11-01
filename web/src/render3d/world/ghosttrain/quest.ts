// The Last Train Home's fixtures, drawn (D-80): the station clocks' hands (stopped at one minute to midnight
// until wound, then keeping the night's time), the torn timetable pages glowing in the carriages, the signal
// battery in the lamp room and in its carrier's hand, the train's own signal lamp on the tender's front corner (dark
// and flickering, then red, green when switched; D-84), the signal box's levers, the four lost passengers on the End
// of the Line's platform (and in their seats once punched), Ada's letter, the coal and the boiler's gauge in
// the tender, Stillwater's church clock (Mira's hour), Saint Vesper's bell ropes, the phantom doors. Nothing
// here is UI: everything is a thing in the world that changes when the quest moves on.

import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { GameRenderer3D } from '../../renderer3d';
import { E, PHANTOM_AT, REGIONS, S, TRAIN, TRANSIT, V, regionAt, trainOrigin } from '../../../data/ghosttrain';
import { END, JUNCTION, LT_TRAIN, PHANTOM_DOOR, STATION_CLOCK, STILLWATER, VESPER } from '../../../data/gtStations';
import { LAST_TRAIN } from '../../../data/lastTrain';
import type { LastTrainChain } from '../../../sim/quest/lastTrain';
import { LT, gaugeAt } from '../../../sim/quest/lastTrain';
import { trainNow } from '../../../sim/ghosttrain';
import { ActorBatch } from '../../core/batch';
import { ModelBuilder, SURF, box, cone, cyl, ellipsoid, lathe, sphere } from '../../core/geo';
import { actorMaterial, pool } from '../../core/materials';
import type { Frame } from '../../../render/atlas';
import { CHURCH_FACE } from './kit';
import type { TrainRender } from './train';

const B = (fn: (m: ModelBuilder) => void, ao = 0.2) => {
  const m = new ModelBuilder();
  fn(m);
  return m.build({ ao });
};
/** A clock hand (points up +y from its pivot), unit length 1 (scaled per clock). */
const HAND = () => B((m) => {
  m.add(box(0.07, 1, 0.04), { col: 0x14100e, pos: [0, 0.4, 0], surf: SURF.iron });
  m.add(cone(0.08, 0.16, 4), { col: 0x14100e, pos: [0, 0.94, 0], surf: SURF.iron });
}, 0);
const PAGE = () => B((m) => {
  m.add(box(18, 1, 24), { col: 0xf0e8d0, pos: [0, 2, 0], rot: [0, 0.3, 0], surf: SURF.cloth, emit: 0.9 });
  for (let i = 0; i < 5; i++) m.add(box(14, 1.2, 0.8), { col: 0x2a2018, pos: [0, 2.2, -8 + i * 4], rot: [0, 0.3, 0], surf: SURF.paint });
}, 0);
const LETTER = () => B((m) => {
  m.add(box(16, 1, 10), { col: 0xf8f0e0, pos: [0, 34, 0], surf: SURF.cloth, emit: 1 });
  m.add(sphere(2, 6, 4), { col: 0x8a1410, pos: [0, 35, 0], surf: SURF.paint });
}, 0);
/** The train's signal lamp (D-84): an iron post on the tender's front corner, a lamp head with its lens to the camera
 *  and the line ahead (the lens's colour is the glow drawn over it). */
const LAMP_POST = () => B((m) => {
  m.add(cyl(2.6, 3.2, 150, 8), { col: 0x14120e, pos: [0, 75, 0], surf: SURF.iron });
  m.add(box(22, 26, 16), { col: 0x14120e, pos: [0, 162, 0], surf: SURF.iron });
  m.add(box(26, 4, 20), { col: 0x14120e, pos: [0, 177, 0], surf: SURF.iron });
  m.add(cyl(7.5, 7.5, 2, 14), { col: 0x2a2620, pos: [0, 162, 8.5], rot: [Math.PI / 2, 0, 0], surf: SURF.glass });
  m.add(cyl(7.5, 7.5, 2, 14), { col: 0x2a2620, pos: [11.5, 162, 0], rot: [0, 0, Math.PI / 2], surf: SURF.glass });
  m.add(box(30, 3, 3), { col: 0x14120e, pos: [-14, 120, 0], surf: SURF.iron });
}, 0.1);
/** Its lamp box on the tender's front wall: riveted iron, a socket for the battery. */
const LAMP_BOX = () => B((m) => {
  m.add(box(30, 34, 16), { col: 0x2a2e26, pos: [0, 40, 0], surf: SURF.iron });
  m.add(box(32, 4, 18), { col: 0x14120e, pos: [0, 58, 0], surf: SURF.iron });
  for (const x of [-11, 11]) for (const y of [28, 52]) m.add(sphere(1.4, 4, 3), { col: 0x8a7a50, pos: [x, y, 8.2], surf: SURF.brass });
}, 0.2);
/** The signal battery: a squat cell in a tarred case, two brass terminals, a carrying strap. */
const BATTERY = () => B((m) => {
  m.add(box(16, 18, 11), { col: 0x1e2a22, pos: [0, 9, 0], surf: SURF.rubber });
  for (const x of [-4.5, 4.5]) m.add(cyl(1.8, 1.8, 3, 8), { col: 0xc8a050, pos: [x, 19.5, 0], surf: SURF.brass });
  m.add(box(2, 8, 2), { col: 0x5a3a20, pos: [-7, 22, 0], surf: SURF.cloth });
  m.add(box(2, 8, 2), { col: 0x5a3a20, pos: [7, 22, 0], surf: SURF.cloth });
  m.add(box(16, 2, 2), { col: 0x5a3a20, pos: [0, 26, 0], surf: SURF.cloth });
  m.add(box(10, 4, 0.6), { col: 0xd8ccb0, pos: [0, 10, 5.8], surf: SURF.paint });
}, 0.2);
/** A lost passenger: a pale, translucent child in their clothes from the night they were lost. */
const PASSENGER = (k: number) => B((m) => {
  const pale = [0xc8e0ff, 0xd8e8ff, 0xd0f0ff, 0xc8d8ff][k];
  const seat = 0; // standing models; the seated ones are lowered
  m.add(lathe([[0, 0], [12, 2], [10, 26], [8, 46], [5, 52], [0, 53]], 12, 6), { col: pale, pos: [0, seat, 0], surf: SURF.cloth, emit: 0.9 });
  m.add(sphere(9, 12, 10), { col: pale, pos: [0, 62, 0], surf: SURF.skin, emit: 1 });
  if (k === 0) m.add(cyl(16, 16, 1.4, 16), { col: pale, pos: [0, 70, 0], surf: SURF.cloth, emit: 0.8 }); // Ada's sun hat
  if (k === 1) m.add(ellipsoid(9.5, 4, 10, 10, 6), { col: pale, pos: [0, 69, 1], surf: SURF.cloth, emit: 0.8 }); // Theo's cap
  if (k === 2) m.add(lathe([[0, 30], [13, 30], [10, 46], [0, 48]], 12, 4), { col: 0xe8f0ff, surf: SURF.cloth, emit: 0.9 }); // Mira's pinafore
  if (k === 3) m.add(box(4, 10, 2), { col: 0xffffff, pos: [0, 44, 7], surf: SURF.cloth, emit: 0.9 }); // Eli's collar
  for (const s of [-1, 1]) m.add(sphere(1.4, 6, 4), { col: 0x203040, pos: [s * 3.2, 63, 8], surf: SURF.paint });
}, 0.1);

export class GtQuest {
  private hand: ActorBatch;
  private pages: ActorBatch;
  private letter: ActorBatch;
  private lampPost: ActorBatch;
  private lampBox: ActorBatch;
  private battery: ActorBatch;
  private folk: ActorBatch[] = [];
  private glowF: Frame | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();

  constructor(root: THREE.Object3D) {
    const mat = actorMaterial({ emitBoost: 2.2 });
    this.hand = new ActorBatch(HAND(), mat, 32, { shadow: false });
    this.pages = new ActorBatch(PAGE(), mat, 24, { shadow: false });
    this.letter = new ActorBatch(LETTER(), mat, 8, { shadow: false });
    this.lampPost = new ActorBatch(LAMP_POST(), mat, 8, { shadow: false });
    this.lampBox = new ActorBatch(LAMP_BOX(), mat, 8, { shadow: false });
    this.battery = new ActorBatch(BATTERY(), mat, 10, { shadow: false });
    const ghostMat = actorMaterial({ transparent: true, opacity: 0.55, emitBoost: 2 });
    ghostMat.depthWrite = false;
    for (let k = 0; k < 4; k++) this.folk.push(new ActorBatch(PASSENGER(k), ghostMat, 8, { shadow: false, order: 6 }));
    for (const b of [this.hand, this.pages, this.letter, this.lampPost, this.lampBox, this.battery, ...this.folk]) {
      b.rim = [0, 0, 0, 0];
      root.add(b.mesh);
    }
  }

  /** The train's signal lamp's colour now (a dark lamp sputters now and then, softly: no strobe), and how bright. */
  private lampLight(ch: LastTrainChain, t: number): [number, number, number, number] {
    const s = ch.lamp();
    if (s === 2) return [0.3, 1, 0.45, 1];
    if (s === 1) return [1, 0.18, 0.12, 1];
    const f = Math.sin(t * 2.3) * Math.sin(t * 5.9 + 1.3);
    return [1, 0.7, 0.35, 0.05 + Math.max(0, f - 0.6)];
  }

  /** The quest's own lights: the train's signal lamp wherever the train is, a shovel of coal, the phantom doors. */
  addLights(g: Game, time: number, train: TrainRender): void {
    const ch = g.quests?.get<LastTrainChain>('last_train');
    if (ch) {
      const c = ch.coalBy === 255 ? null : g.players[ch.coalBy];
      if (c) pool.add(c.x, c.y, 200, 0.8, 1, 0.45, 0.15, 40, 1.6);
      const [r, gg, b, k] = this.lampLight(ch, time);
      for (let i = 0; i < REGIONS.length; i++) {
        const off = train.shownAt(i);
        if (off === null || k < 0.2) continue;
        const o = trainOrigin(i);
        pool.add(o.x + off + LT_TRAIN.lamp.x, o.y + LT_TRAIN.lamp.y + 20, 240, 0.9 * k, r, gg, b, 150, 1.6);
      }
    }
    if (g.time >= PHANTOM_AT) for (const d of PHANTOM_DOOR) pool.add(d.x, d.y + 40, 220, 0.9, 0.7, 0.85, 1, 80, 1.6);
  }

  /** A clock hand on a face at (x, h, z), facing +Z, at angle a (0 = twelve o'clock), of length len. */
  private drawHand(x: number, h: number, z: number, a: number, len: number, w: number): void {
    this.e.set(0, 0, -a);
    this.q.setFromEuler(this.e);
    this.v.set(x, h, z);
    this.sc.set(w, len, 1);
    this.m.compose(this.v, this.q, this.sc);
    this.hand.addMatrix(this.m);
  }

  update(g: Game, r: GameRenderer3D, train: TrainRender, inView: (x: number, y: number) => boolean): void {
    const ch = g.quests?.get<LastTrainChain>('last_train');
    const t = r.time;
    const glow = (this.glowF ??= r.assets.atlas.get('fx_glow_0'));
    const G = r.glow;
    for (const b of [this.hand, this.pages, this.letter, this.lampPost, this.lampBox, this.battery, ...this.folk]) b.begin();
    const stage = ch?.stage ?? 0;
    // ---- the station clocks: stopped at 11:59 until wound, then the night's own time from midnight
    for (let k = 0; k < 5; k++) {
      const c = STATION_CLOCK[k];
      if (!inView(c.x, c.y)) continue;
      const wound = k < 4 && ch ? !!(ch.clocks & (1 << k)) || stage > LT.Clocks : false;
      const mins = wound ? g.time / 60 : 11 * 60 + 59;
      const hourA = ((mins / 60) % 12) / 12 * Math.PI * 2, minA = ((mins % 60) / 60) * Math.PI * 2;
      this.drawHand(c.x, 168, c.y + 7.4, hourA, 11, 18);
      this.drawHand(c.x, 168, c.y + 7.8, minA, 16, 12);
      if (wound) G.draw(glow, c.x, c.y, 168, 0.45, 0.45, 0, 1, 0.95, 0.8, 0.35);
      else if (stage === LT.Clocks && ch && !(ch.clocks & (1 << k))) G.draw(glow, c.x, c.y, 168, 0.5, 0.5, 0, 0.7, 0.85, 1, 0.25 + 0.15 * Math.sin(t * 2));
    }
    // the church clock at Stillwater: Mira's hour (the hour hand where it was left; the minute hand at twelve)
    {
      const cx = REGIONS[S].cx, cz = REGIONS[S].cy + 960 + CHURCH_FACE.z + 4;
      if (inView(cx, cz)) {
        const hr = ch?.hour ?? 12;
        this.drawHand(cx, CHURCH_FACE.h, cz, (hr / 12) * Math.PI * 2, 36, 60);
        this.drawHand(cx, CHURCH_FACE.h, cz + 0.6, 0, 52, 40);
        if (stage === LT.Deliveries && ch && !(ch.tasks & 4)) G.draw(glow, cx, cz, CHURCH_FACE.h, 1.2, 1.2, 0, 0.8, 0.9, 1, 0.25 + 0.15 * Math.sin(t * 1.5));
      }
    }
    if (!ch) {
      for (const b of [this.hand, this.pages, this.letter, this.lampPost, this.lampBox, this.battery, ...this.folk]) b.end();
      return;
    }
    const lamp = this.lampLight(ch, t);
    // ---- in every copy of the carriages that's drawn: the pages, the letter, the passengers in their seats
    for (let i = 0; i < REGIONS.length; i++) {
      const off = train.shownAt(i);
      if (off === null) continue;
      const o = trainOrigin(i);
      const ox = o.x + off, oy = o.y;
      if (!inView(ox, oy) && !inView(ox + 1500, oy) && !inView(ox - 1500, oy)) continue;
      // the train's own signal lamp, and its lamp box (the battery in it once fitted; a glow while it waits for one)
      {
        const lx = ox + LT_TRAIN.lamp.x, ly = oy + LT_TRAIN.lamp.y, bx = ox + LT_TRAIN.lampbox.x, by = oy + LT_TRAIN.lampbox.y;
        this.lampPost.add(lx, ly, 0, 0, 1);
        G.draw(glow, lx, ly + 9, 162, 0.62, 0.62, 0, lamp[0], lamp[1], lamp[2], 0.9 * lamp[3]);
        this.lampBox.add(bx, by, 0, 0, 1);
        if (ch.batteryIn || stage > LT.Signals) this.battery.add(bx, by + 2, 26, 0, 0.9);
        else if (stage === LT.Signals) G.draw(glow, bx, by, 50, 0.35, 0.35, 0, 0.6, 0.85, 1, 0.45 + 0.25 * Math.sin(t * 3));
      }
      if (stage === LT.Pages) for (let k = 0; k < 4; k++) {
        if (ch.pages & (1 << k)) continue;
        const p = ch.pageSpot(k);
        const bob = Math.sin(t * 2 + k) * 3;
        this.pages.add(ox + p.x, oy + p.y, 2 + bob, t * 0.3 + k, 1);
        G.draw(glow, ox + p.x, oy + p.y, 12, 0.35, 0.35, 0, 1, 0.95, 0.8, 0.5 + 0.2 * Math.sin(t * 3 + k));
      }
      if (stage === LT.Deliveries && !(ch.tasks & 1) && ch.letterBy === 255) {
        this.letter.add(ox + LT_TRAIN.letter.x, oy + LT_TRAIN.letter.y - 30, 0, 0, 1);
        G.draw(glow, ox + LT_TRAIN.letter.x, oy + LT_TRAIN.letter.y - 30, 36, 0.3, 0.3, 0, 1, 0.95, 0.85, 0.5);
      }
      if (stage >= LT.Deliveries) for (let k = 0; k < 4; k++) {
        if (!(ch.boarded & (1 << k))) continue;
        const s = LT_TRAIN.seats[k];
        const at = (ch.tasks & (1 << k)) ? 1 : 0.7;
        const fi = this.folk[k].add(ox + s.x, oy + s.y, -14, Math.PI, 1);
        this.folk[k].tint(fi, 1, 1, 1, at);
      }
      // the boiler's gauge on the tender floor beside the firebox (Theo's stokes): the needle's swing, the green
      if (i === TRANSIT && stage === LT.Deliveries && !(ch.tasks & 2) && ch.coal >= LAST_TRAIN.coalLoads) {
        const gx = ox + LT_TRAIN.firebox.x - 50, gy = oy + 60;
        const needle = gaugeAt(g.time);
        r.zoneShapes.circle(gx, gy, 34, 0.08, 0.07, 0.06, 0.85, 0.85);
        const top = 1 - LAST_TRAIN.gaugeWindow;
        for (let a = 0; a < 16; a++) {
          const f = a / 15, ang = Math.PI + f * Math.PI;
          const inGreen = f >= top;
          r.addShapes.circle(gx + Math.cos(ang) * 28, gy + Math.sin(ang) * 28, 2.6, inGreen ? 0.3 : 0.8, inGreen ? 1 : 0.6, inGreen ? 0.4 : 0.4, 0.8, 0);
        }
        const na = Math.PI + needle * Math.PI;
        r.addShapes.line(gx, gy, gx + Math.cos(na) * 30, gy + Math.sin(na) * 30, 2.2, 1, 0.3, 0.2, 1, 0);
        for (let s = 0; s < ch.stokes; s++) r.addShapes.circle(gx - 20 + s * 20, gy + 16, 4, 1, 0.6, 0.2, 0.9, 0);
      }
    }
    // ---- the four lost passengers waiting on the End of the Line's platform (until punched)
    for (let k = 0; k < 4; k++) {
      if (ch.boarded & (1 << k)) continue;
      const p = END.passengers[k];
      if (!inView(p.x, p.y)) continue;
      const fi = this.folk[k].add(p.x, p.y, 0, Math.sin(t * 0.3 + k) * 0.4, 1);
      this.folk[k].tint(fi, 1, 1, 1, stage >= LT.Passengers ? 1 : 0.5);
    }
    // ---- carried things: the signal battery, the punch, the letter, a shovel of coal
    const carried = (by: number, col: [number, number, number], h: number, sz: number) => {
      const p = by === 255 ? null : g.players[by];
      if (!p) return;
      G.draw(glow, p.x + 14, p.y, h, sz, sz, 0, col[0], col[1], col[2], 0.7);
    };
    const bat = ch.batteryBy === 255 ? null : g.players[ch.batteryBy];
    if (bat) {
      this.battery.add(bat.x + 18, bat.y + 4, 22, 0.3, 1);
      G.draw(glow, bat.x + 18, bat.y + 4, 46, 0.22, 0.22, 0, 0.6, 0.85, 1, 0.45);
    }
    carried(ch.punchBy, [1, 0.88, 0.5], 50, 0.25);
    carried(ch.letterBy, [1, 0.95, 0.85], 50, 0.25);
    carried(ch.coalBy, [1, 0.45, 0.15], 40, 0.35);
    // ---- fixtures waiting to be used
    if (stage === LT.Battery) {
      this.battery.add(JUNCTION.lamproom.x, JUNCTION.lamproom.y - 6, 0, 0.4, 1.1);
      G.draw(glow, JUNCTION.lamproom.x, JUNCTION.lamproom.y - 6, 16, 0.45, 0.45, 0, 0.6, 0.85, 1, 0.5 + 0.3 * Math.sin(t * 2));
    }
    if (stage === LT.Points) for (let k = 0; k < LAST_TRAIN.levers; k++) {
      const done = k === ch.levers[ch.leverStep - 1] && ch.leverStep > 0;
      G.draw(glow, JUNCTION.levers.x, JUNCTION.levers.y + (k - 2) * 38, 90, 0.2, 0.2, 0, done ? 0.4 : 1, done ? 1 : 0.8, done ? 0.5 : 0.5, 0.45);
    }
    if (stage === LT.Punch) G.draw(glow, END.barrier.x, END.barrier.y, 70, 0.3, 0.3, 0, 1, 0.9, 0.6, 0.5 + 0.3 * Math.sin(t * 3));
    const st = trainNow(g);
    if (stage === LT.Deliveries && !(ch.tasks & 8) && st.phase === 'dwell' && st.at === V) for (const rp of VESPER.ropes) G.draw(glow, rp.x, rp.y, 100, 0.25, 0.25, 0, 0.9, 0.85, 1, 0.35);
    // the phantom doors: from 29:00 each stands open on light
    if (g.time >= PHANTOM_AT) for (let k = 0; k < 4; k++) {
      const d = PHANTOM_DOOR[k];
      if (!inView(d.x, d.y)) continue;
      G.draw(glow, d.x, d.y, 80, 1.1, 1.6, 0, 0.75, 0.85, 1, 0.55 + 0.15 * Math.sin(t * 2 + k));
    }
    // the Stillwater pond's still mirror of the lamps is the floor's; the End of the Line goes dark for the finale
    if (stage === LT.Finale || stage === LT.Homeward) {
      const c = REGIONS[E];
      if (stage === LT.Homeward) for (let i = 0; i < 6; i++) G.draw(glow, trainOrigin(E).x - 1200 + i * 500, c.cy - 1000, 70, 1.2, 1.2, 0, 1, 0.85, 0.6, 0.6);
    }
    void STILLWATER;
    void TRAIN;
    void regionAt;
    for (const b of [this.hand, this.pages, this.letter, this.lampPost, this.lampBox, this.battery, ...this.folk]) b.end();
  }
}
