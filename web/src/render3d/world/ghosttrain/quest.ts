// The Last Train Home's fixtures, drawn (D-80, reworked in D-90): the station clocks' hands (stopped at one minute
// to midnight until wound, then keeping the night's time), the brass key lying about the Junction, the sleeper's
// compartment doors (shut until the Junction's clock runs) and the torn pages in the compartments; each station's
// trouble: Saint Vesper's grave lamps, altar candles, taper and vigil, the Cinder Works' brass, crucible and ladle on
// its rails, Stillwater's frozen moments (villagers in the Still Folk's likeness, stopped mid-step), the jetty on the
// still pond and the pendulum; the signal battery, the
// train's own signal lamp (dark and flickering, then red, green when switched; D-84), the signal box's levers, the
// four lost passengers, Ada's letter, the coal and the boiler's gauge, Stillwater's church clock, Saint Vesper's
// bell ropes, the phantom doors. Nothing here is UI: everything is a thing in the world that changes when the
// quest moves on (the progress rings on the ground are the places' own glow).

import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { GameRenderer3D } from '../../renderer3d';
import { C, E, PHANTOM_AT, REGIONS, S, TRANSIT, V, trainOrigin } from '../../../data/ghosttrain';
import { END, JUNCTION, LT_KEY_SPOTS, LT_STILL, LT_TRAIN, LT_VESPER, LT_WORKS, PHANTOM_DOOR, STATION_CLOCK, STILLWATER, VESPER } from '../../../data/gtStations';
import { LAST_TRAIN } from '../../../data/lastTrain';
import type { LastTrainChain } from '../../../sim/quest/lastTrain';
import { CLOCK_STEPS, LADLE_LEN, LT, alongPath } from '../../../sim/quest/lastTrain';
import { trainNow } from '../../../sim/ghosttrain';
import { ActorBatch } from '../../core/batch';
import { ModelBuilder, SURF, box, cone, cyl, ellipsoid, lathe, sphere, torus } from '../../core/geo';
import { actorMaterial, pool } from '../../core/materials';
import type { Frame } from '../../../render/atlas';
import { CHURCH_FACE } from './kit';
import type { TrainRender } from './train';

const B = (fn: (m: ModelBuilder) => void, ao = 0.2) => {
  const m = new ModelBuilder();
  fn(m);
  return m.build({ ao });
};
/** Where a grave lamp's lantern hangs from its post (model units, before GRAVE_LAMP_S), and its flame's height. */
const GRAVE_LANTERN = { dx: -18, h: 53 };
const GRAVE_LAMP_S = 1.15;
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
  m.add(lathe([[0, 0], [12, 2], [10, 26], [8, 46], [5, 52], [0, 53]], 12, 6), { col: pale, surf: SURF.cloth, emit: 0.9 });
  m.add(sphere(9, 12, 10), { col: pale, pos: [0, 62, 0], surf: SURF.skin, emit: 1 });
  if (k === 0) m.add(cyl(16, 16, 1.4, 16), { col: pale, pos: [0, 70, 0], surf: SURF.cloth, emit: 0.8 }); // Ada's sun hat
  if (k === 1) m.add(ellipsoid(9.5, 4, 10, 10, 6), { col: pale, pos: [0, 69, 1], surf: SURF.cloth, emit: 0.8 }); // Theo's cap
  if (k === 2) m.add(lathe([[0, 30], [13, 30], [10, 46], [0, 48]], 12, 4), { col: 0xe8f0ff, surf: SURF.cloth, emit: 0.9 }); // Mira's pinafore
  if (k === 3) m.add(box(4, 10, 2), { col: 0xffffff, pos: [0, 44, 7], surf: SURF.cloth, emit: 0.9 }); // Eli's collar
  for (const s of [-1, 1]) m.add(sphere(1.4, 6, 4), { col: 0x203040, pos: [s * 3.2, 63, 8], surf: SURF.paint });
}, 0.1);

// ---- D-90: the clocks' trouble
/** The station clocks' winding key: a brass bow, a long shank, a square bit. Lying on its side. */
const KEY = () => B((m) => {
  m.add(torus(6, 1.6, 6, 14), { col: 0xc8a050, pos: [-14, 2, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
  m.add(cyl(1.4, 1.4, 22, 8), { col: 0xc8a050, pos: [2, 2, 0], rot: [0, 0, Math.PI / 2], surf: SURF.brass });
  m.add(box(5, 4, 4), { col: 0xb8903e, pos: [14, 2, 0], surf: SURF.brass });
}, 0);
/** A sleeper compartment's sliding door: varnished panels as high as the partition (it slides away inside it), a brass
 *  number plate, a pull and a brass top rail. */
const COMP_DOOR = () => B((m) => {
  m.add(box(50, 62, 6), { col: 0x5a3420, pos: [0, 31, 0], surf: SURF.wood });
  for (const y of [44, 18]) m.add(box(40, 20, 1), { col: 0x6a4026, pos: [0, y, 3.4], surf: SURF.wood });
  m.add(box(10, 5, 1.2), { col: 0xc8a050, pos: [0, 57, 3.6], surf: SURF.brass });
  m.add(box(3, 10, 2), { col: 0xc8a050, pos: [18, 31, 3.8], surf: SURF.brass });
  m.add(box(52, 3, 7), { col: 0xb8902e, pos: [0, 63.5, 0], surf: SURF.brass });
}, 0.2);
/** A grave lamp: a lantern hung from an iron crook planted between two headstones (its flame is the glow drawn in it,
 *  at GRAVE_LANTERN). */
const GRAVE_LAMP = () => B((m) => {
  const iron = 0x1a1a1c, lx = GRAVE_LANTERN.dx;
  m.add(box(3.6, 72, 3.6), { col: iron, pos: [0, 36, 0], surf: SURF.iron });
  m.add(cone(3, 5, 4), { col: iron, pos: [0, 74, 0], rot: [0, Math.PI / 4, 0], surf: SURF.iron });
  m.add(torus(-lx / 2, 1.5, 6, 14, Math.PI), { col: iron, pos: [lx / 2, 70, 0], surf: SURF.iron });
  m.add(cyl(0.7, 0.7, 6, 4), { col: iron, pos: [lx, 66, 0], surf: SURF.iron });
  m.add(cone(8, 6, 4), { col: iron, pos: [lx, 61, 0], rot: [0, Math.PI / 4, 0], surf: SURF.iron });
  m.add(box(9.6, 12, 9.6), { col: 0xb8b0a0, pos: [lx, 52, 0], surf: SURF.glass });
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) m.add(box(1.4, 13, 1.4), { col: iron, pos: [lx + x, 52, z], surf: SURF.iron });
  m.add(box(12, 2.4, 12), { col: iron, pos: [lx, 45, 0], surf: SURF.iron });
  m.add(cyl(2, 2.6, 3, 8), { col: 0xe8e0c8, pos: [lx, 47.6, 0], surf: SURF.cloth });
}, 0.1);
/** The chapel's altar candles, brought out to the porch on an iron stand. */
const CANDLES = () => B((m) => {
  m.add(cyl(2, 3, 34, 8), { col: 0x1a1a1c, pos: [0, 17, 0], surf: SURF.iron });
  m.add(cyl(16, 16, 2, 14), { col: 0x1a1a1c, pos: [0, 34, 0], surf: SURF.iron });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    m.add(cyl(1.6, 1.6, 9 + (k % 3) * 3, 6), { col: 0xe8e0c8, pos: [Math.cos(a) * 11, 39 + (k % 3) * 1.5, Math.sin(a) * 11], surf: SURF.cloth });
  }
  m.add(cyl(2, 2, 16, 6), { col: 0xe8e0c8, pos: [0, 43, 0], surf: SURF.cloth });
}, 0.1);
/** A brass cog off some machine (D-91: twice the size, polished on its rim and teeth so it catches the light; drawn
 *  tilted to face the camera, see COG_TILT). Its axis is +y. */
const SCRAP = () => B((m) => {
  const R = COG.r, teeth = 12, th = 4.4;
  m.add(cyl(R, R, th, 28), { col: 0xc8a050, surf: SURF.brass, emit: 0.18 });
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2;
    m.add(box(5.4, th, 4.6), { col: 0xd8b060, pos: [Math.cos(a) * (R + 2.2), 0, Math.sin(a) * (R + 2.2)], rot: [0, -a, 0], surf: SURF.brass, emit: 0.22 });
  }
  // the web of the wheel: a dark ring between rim and hub, four spokes across it, the hub and its bore
  m.add(torus(R * 0.62, R * 0.2, 6, 24), { col: 0x5a4220, pos: [0, th / 2 + 0.2, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
  for (let k = 0; k < 4; k++) m.add(box(R * 1.5, th + 0.8, 3), { col: 0xb8903e, rot: [0, (k * Math.PI) / 4, 0], surf: SURF.brass, emit: 0.12 });
  m.add(cyl(R * 0.3, R * 0.3, th + 1.6, 16), { col: 0xc8a050, surf: SURF.brass, emit: 0.18 });
  m.add(cyl(R * 0.13, R * 0.13, th + 2, 10), { col: 0x1a1208, surf: SURF.iron });
}, 0);
/** The cogs' size, how far a lying one tips back toward the camera (radians from flat: 40° faces it square at the
 *  game's 50° view), and how deep it's sunk in the cinders. */
const COG = { r: 22, tilt: 0.7, sink: 10 };
/** The crucible on its iron legs by the west furnace (its melt is the glow over it). */
const CRUCIBLE = () => B((m) => {
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    m.add(cyl(2.4, 2.4, 30, 6), { col: 0x1a1a1c, pos: [Math.cos(a) * 18, 15, Math.sin(a) * 18], surf: SURF.iron });
  }
  m.add(lathe([[0, 26], [20, 27], [26, 40], [27, 56], [24, 58], [0, 50]], 16), { col: 0x2a2624, surf: SURF.iron });
  m.add(cyl(23, 23, 1, 16), { col: 0x3a2010, pos: [0, 55, 0], surf: SURF.rubber });
}, 0.2);
/** The ladle: a small crucible of molten brass riding a tub wagon (on the yard's rails). */
const LADLE = () => B((m) => {
  m.add(box(46, 14, 34), { col: 0x2a2624, pos: [0, 16, 0], surf: SURF.iron });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.add(cyl(7, 7, 4, 10), { col: 0x1a1a1c, pos: [sx * 16, 7, sz * 18], rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
  m.add(lathe([[0, 22], [14, 23], [18, 34], [18, 46], [0, 40]], 14), { col: 0x3a3430, surf: SURF.iron });
  m.add(cyl(16, 16, 1, 14), { col: 0xff9a3a, pos: [0, 45.5, 0], surf: SURF.bulb, emit: 2 });
  m.add(box(4, 30, 4), { col: 0x1a1a1c, pos: [-24, 34, 0], rot: [0, 0, 0.5], surf: SURF.iron });
}, 0.2);
/** Stillwater's frozen moments (D-90): villagers in the Still Folk's likeness (their sculpted models), stopped mid-step
 *  where they stood, frost-pale; when one wakes it takes the step it was stopped in, the frost leaves it, and it's gone
 *  in a breath of light (MOMENT_WAKE seconds). */
const MOMENT_FIGURES: { key: string; clip: string; t: number; yaw: number }[] = [
  { key: 'gt_stillfolk', clip: 'attack', t: 0.62, yaw: -Math.PI / 2 }, // the woman at the well, reaching for its rope
  { key: 'gt_newsboy', clip: 'move', t: 0.3, yaw: Math.PI / 2 }, // the boy with the kite, running, its string held up
  { key: 'gt_signalman', clip: 'move', t: 0.22, yaw: Math.PI / 2 }, // the signalman at his gate, lamp lit for his shift
];
const MOMENT_WAKE = 1.6;
const FROZEN_TINT: [number, number, number, number] = [0.6, 0.74, 1, 0.45];
const FROZEN_RIM: [number, number, number, number] = [0.6, 0.82, 1, 1.2];
/** The boy's kite, stopped in the air: a diamond of faded cloth on its spars, a tail of bows. */
const KITE = () => B((m) => {
  m.add(box(22, 22, 0.8), { col: 0xb8a890, rot: [0, 0, Math.PI / 4], surf: SURF.cloth });
  m.add(box(10, 10, 1), { col: 0x8a3a30, pos: [0, 0, -0.2], rot: [0, 0, Math.PI / 4], surf: SURF.cloth });
  m.add(box(0.9, 31, 1.2), { col: 0x3a2a1c, pos: [0, 0, 0.6], surf: SURF.wood });
  m.add(box(31, 0.9, 1.2), { col: 0x3a2a1c, pos: [0, 0, 0.6], surf: SURF.wood });
  for (let k = 0; k < 4; k++) m.add(box(5, 2.4, 0.6), { col: k % 2 ? 0xb8a890 : 0x8a3a30, pos: [Math.sin(k * 1.2) * 4, -20 - k * 8, 0], rot: [0, 0, 0.5], surf: SURF.cloth });
}, 0);
/** A length of string (unit length along +y, scaled and turned per use). */
const STRING = () => B((m) => {
  m.add(cyl(0.45, 0.45, 1, 4), { col: 0xd8d0c0, pos: [0, 0.5, 0], surf: SURF.cloth });
}, 0);
/** The bank where the pendulum is reeled in: a little jetty of planks on two stringers out over the still pond's edge
 *  (+z, out over the water), posts at its middle and its end. */
const BANK = () => B((m) => {
  for (let k = 0; k < 9; k++) m.add(box(40, 2.6, 8), { col: 0x4a3c2e, pos: [0, 4, -12 + k * 9.5], rot: [0, ((k % 3) - 1) * 0.03, 0], surf: SURF.wood });
  for (const sx of [-1, 1]) {
    m.add(box(3, 3, 86), { col: 0x2e261e, pos: [sx * 15, 1.5, 28], surf: SURF.wood });
    for (const z of [20, 66]) m.add(cyl(2.6, 2.6, 18, 6), { col: 0x2e261e, pos: [sx * 19, 3, z], surf: SURF.wood });
  }
}, 0.2);
/** The jetty's heading (out over the pond). */
const JETTY_YAW = -0.8;
/** The station clock's pendulum: a brass rod and a heavy bob. */
const PENDULUM = () => B((m) => {
  m.add(cyl(0.8, 0.8, 34, 6), { col: 0xb8903e, pos: [0, -17, 0], surf: SURF.brass });
  m.add(cyl(7, 7, 2.4, 16), { col: 0xc8a050, pos: [0, -36, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
}, 0);

export class GtQuest {
  private hand: ActorBatch;
  private pages: ActorBatch;
  private letter: ActorBatch;
  private lampPost: ActorBatch;
  private lampBox: ActorBatch;
  private battery: ActorBatch;
  private key: ActorBatch;
  private compDoor: ActorBatch;
  private graveLamp: ActorBatch;
  private candles: ActorBatch;
  private scrap: ActorBatch;
  private crucible: ActorBatch;
  private ladle: ActorBatch;
  private bank: ActorBatch;
  private pendulum: ActorBatch;
  private kite: ActorBatch;
  private string: ActorBatch;
  private folk: ActorBatch[] = [];
  private all: ActorBatch[];
  /** when each of Stillwater's moments was seen to wake: Infinity while frozen, -Infinity if awake when first seen */
  private woke = [NaN, NaN, NaN];
  private glowF: Frame | null = null;
  private starF: Frame | null = null;
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
    this.key = new ActorBatch(KEY(), mat, 6, { shadow: false });
    this.compDoor = new ActorBatch(COMP_DOOR(), mat, REGIONS.length * 4, { shadow: false });
    this.graveLamp = new ActorBatch(GRAVE_LAMP(), mat, 4, { shadow: true });
    this.candles = new ActorBatch(CANDLES(), mat, 2, { shadow: true });
    this.scrap = new ActorBatch(SCRAP(), mat, 8, { shadow: false });
    this.crucible = new ActorBatch(CRUCIBLE(), mat, 2, { shadow: true });
    this.ladle = new ActorBatch(LADLE(), mat, 2, { shadow: true });
    this.bank = new ActorBatch(BANK(), mat, 2, { shadow: false });
    this.pendulum = new ActorBatch(PENDULUM(), mat, 4, { shadow: false });
    this.kite = new ActorBatch(KITE(), mat, 2, { shadow: true });
    this.string = new ActorBatch(STRING(), mat, 2, { shadow: false });
    const ghostMat = actorMaterial({ transparent: true, opacity: 0.55, emitBoost: 2 });
    ghostMat.depthWrite = false;
    for (let k = 0; k < 4; k++) this.folk.push(new ActorBatch(PASSENGER(k), ghostMat, 8, { shadow: false, order: 6 }));
    this.all = [this.hand, this.pages, this.letter, this.lampPost, this.lampBox, this.battery, this.key, this.compDoor, this.graveLamp, this.candles, this.scrap, this.crucible, this.ladle, this.bank, this.pendulum, this.kite, this.string, ...this.folk];
    for (const b of this.all) {
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

  /** The quest's own lights: the train's signal lamp wherever the train is, flames, melt, the phantom doors. */
  addLights(g: Game, time: number, train: TrainRender): void {
    const ch = g.quests?.get<LastTrainChain>('last_train');
    if (ch) {
      // each player's own shovelful of glowing coal, each player's own taper (D-95: one of each at a time before)
      for (const p of g.players) {
        if (ch.coalCarry & (1 << p.index)) pool.add(p.x, p.y, 200, 0.8, 1, 0.45, 0.15, 40, 1.6);
        if (ch.tapers & (1 << p.index)) pool.add(p.x, p.y, 170, 0.7, 1, 0.75, 0.4, 50, 1.6);
      }
      // the grave lamps lit, the candles always; the crucible's melt, the ladle on its rails
      LT_VESPER.lamps.forEach((l, k) => { if (ch.lamps & (1 << k) || ch.running(V)) pool.add(l.x + GRAVE_LANTERN.dx * GRAVE_LAMP_S, l.y, 190, 0.8, 1, 0.75, 0.4, 60, 1.6); });
      pool.add(LT_VESPER.candles.x, LT_VESPER.candles.y, 150, 0.6, 1, 0.78, 0.45, 50, 1.6);
      if (ch.crucible > 0 && ch.step[C] < 2) pool.add(LT_WORKS.crucible.x, LT_WORKS.crucible.y, 220, 0.4 + ch.crucible * 0.25, 1, 0.5, 0.15, 60, 1.6);
      // the brass cogs lying about the yard, each in its own warm pool so it reads on the black cinders (D-91)
      if (ch.stage === LT.Stations && ch.step[C] === 0) LT_WORKS.scrapSpots.forEach((sp, k) => {
        if (ch.scrapAt & (1 << k) && !(ch.scrapsTaken & (1 << k))) pool.add(sp.x, sp.y, 170, 0.75, 1, 0.75, 0.35, 34, 1.6);
      });
      if (ch.step[C] === 1) {
        const l = ch.ladleAt();
        pool.add(l.x, l.y, 260, 1, 1, 0.55, 0.2, 60, 1.6);
      }
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

  /** A ring on the ground filling clockwise from the top as `k` (0..1) rises: a place being kept or mended. */
  private progress(r: GameRenderer3D, x: number, y: number, rad: number, k: number, col: [number, number, number], live: boolean): void {
    r.zoneShapes.ring(x, y, rad - 7, rad, col[0], col[1], col[2], 0.16, 0.16);
    if (k > 0.002) r.addShapes.ring(x, y, rad - 7, rad, col[0], col[1], col[2], live ? 0.7 : 0.35, live ? 0.7 : 0.35, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
  }

  /** A brass cog tipped back toward the camera at height h, turned `spin` about its own axis. */
  private cog(x: number, y: number, h: number, spin: number, s: number): void {
    this.e.set(COG.tilt, spin, 0, 'XYZ');
    this.q.setFromEuler(this.e);
    this.v.set(x, h, y);
    this.sc.set(s, s, s);
    this.m.compose(this.v, this.q, this.sc);
    this.scrap.addMatrix(this.m);
    this.e.set(0, 0, 0, 'XYZ');
  }

  /** The boy's kite, stopped in the air over his shoulder, its string taut from his raised hand. */
  private kiteAt(x: number, y: number): void {
    const hx = x + 12, hy = y + 9, hh = 74, kx = x - 46, ky = y - 34, kh = 190;
    this.e.set(-0.7, 0, 0.25);
    this.q.setFromEuler(this.e);
    this.v.set(kx, kh, ky);
    this.sc.set(1, 1, 1);
    this.m.compose(this.v, this.q, this.sc);
    const i = this.kite.addMatrix(this.m);
    this.kite.tint(i, FROZEN_TINT[0] + 0.25, FROZEN_TINT[1] + 0.2, FROZEN_TINT[2], 0.6);
    this.v.set(kx - hx, kh - 12 - hh, ky - hy);
    const len = this.v.length();
    this.q.setFromUnitVectors(this.sc.set(0, 1, 0), this.v.normalize());
    this.v.set(hx, hh, hy);
    this.sc.set(1, len, 1);
    this.m.compose(this.v, this.q, this.sc);
    this.string.addMatrix(this.m);
  }

  update(g: Game, r: GameRenderer3D, train: TrainRender, inView: (x: number, y: number) => boolean): void {
    const ch = g.quests?.get<LastTrainChain>('last_train');
    const t = r.time;
    const glow = (this.glowF ??= r.assets.atlas.get('fx_glow_0'));
    const star = (this.starF ??= r.assets.atlas.get('fx_star_0'));
    const G = r.glow;
    for (const b of this.all) b.begin();
    const stage = ch?.stage ?? 0;
    // ---- the station clocks: stopped at 11:59 until wound, then the night's own time from midnight
    for (let k = 0; k < 5; k++) {
      const c = STATION_CLOCK[k];
      if (!inView(c.x, c.y)) continue;
      const wound = k < 4 && !!ch?.running(k);
      const mins = wound ? g.time / 60 : 11 * 60 + 59;
      const hourA = ((mins / 60) % 12) / 12 * Math.PI * 2, minA = ((mins % 60) / 60) * Math.PI * 2;
      this.drawHand(c.x, 168, c.y + 7.4, hourA, 11, 18);
      this.drawHand(c.x, 168, c.y + 7.8, minA, 16, 12);
      if (wound) G.draw(glow, c.x, c.y, 168, 0.45, 0.45, 0, 1, 0.95, 0.8, 0.35);
      else if (ch && k < 4 && ((k === 0 && stage === LT.Junction) || (stage === LT.Stations && k > 0 && ch.step[k] === CLOCK_STEPS[k] - 1))) G.draw(glow, c.x, c.y, 168, 0.5, 0.5, 0, 0.7, 0.85, 1, 0.25 + 0.15 * Math.sin(t * 2));
      // Stillwater's pendulum, swinging under its clock once hung
      if (k === S && ch && ch.step[S] >= 3) {
        this.e.set(0, 0, Math.sin(t * 2.6) * 0.35);
        this.q.setFromEuler(this.e);
        this.v.set(c.x, 150, c.y + 8);
        this.sc.set(0.7, 0.7, 0.7);
        this.m.compose(this.v, this.q, this.sc);
        this.pendulum.addMatrix(this.m);
      }
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
    // ---- the stations' standing fixtures: Saint Vesper's grave lamps and altar candles, the Works' crucible, the bank
    // (an unlit lamp catches the eye faintly while it's the clock's trouble, more while somebody carries a taper)
    LT_VESPER.lamps.forEach((l, k) => {
      if (!inView(l.x, l.y)) return;
      this.graveLamp.add(l.x, l.y, 0, 0, GRAVE_LAMP_S);
      const fx = l.x + GRAVE_LANTERN.dx * GRAVE_LAMP_S, fh = GRAVE_LANTERN.h * GRAVE_LAMP_S;
      if (ch && (ch.lamps & (1 << k) || ch.running(V))) {
        G.draw(glow, fx, l.y, fh, 0.45, 0.45, 0, 1, 0.75, 0.35, 0.8 + 0.1 * Math.sin(t * 9 + k));
        G.draw(glow, fx, l.y, fh, 0.14, 0.14, 0, 1, 0.92, 0.7, 1);
      }
      else if (stage === LT.Stations && ch && ch.step[V] === 0) {
        const taper = ch.tapers !== 0;
        G.draw(glow, fx, l.y, fh, 0.26, 0.26, 0, 0.7, 0.85, 1, (taper ? 0.3 : 0.12) + (taper ? 0.15 : 0.06) * Math.sin(t * 2.4 + k));
      }
    });
    {
      const cd = LT_VESPER.candles;
      if (inView(cd.x, cd.y)) {
        this.candles.add(cd.x, cd.y, 0, 0, 1);
        G.draw(glow, cd.x, cd.y, 50, 0.4, 0.4, 0, 1, 0.8, 0.45, 0.8 + 0.12 * Math.sin(t * 7));
      }
      const cr = LT_WORKS.crucible;
      if (inView(cr.x, cr.y)) {
        this.crucible.add(cr.x, cr.y, 0, 0.4, 1);
        const melt = ch ? (ch.step[C] >= 1 ? 1 : ch.crucible / 3) : 0;
        if (melt > 0) G.draw(glow, cr.x, cr.y, 58, 0.5 + melt * 0.3, 0.5 + melt * 0.3, 0, 1, 0.5, 0.15, 0.4 + melt * 0.5);
      }
      const bk = LT_STILL.bank;
      if (inView(bk.x, bk.y)) this.bank.add(bk.x, bk.y, 0, JETTY_YAW, 1);
    }
    if (!ch) {
      for (const b of this.all) b.end();
      return;
    }
    const lamp = this.lampLight(ch, t);
    // ---- in every copy of the carriages that's drawn: the compartment doors, the pages, the letter, the passengers
    for (let i = 0; i < REGIONS.length; i++) {
      const off = train.shownAt(i);
      if (off === null) continue;
      const o = trainOrigin(i);
      const ox = o.x + off, oy = o.y;
      // (sampled along the whole train: three points 1500 apart missed a close camera's view of a car between them)
      if (![-1700, -1150, -600, -50, 500, 1050, 1600].some((dx) => inView(ox + dx, oy))) continue;
      // the train's own signal lamp, and its lamp box (the battery in it once fitted; a glow while it waits for one)
      {
        const lx = ox + LT_TRAIN.lamp.x, ly = oy + LT_TRAIN.lamp.y, bx = ox + LT_TRAIN.lampbox.x, by = oy + LT_TRAIN.lampbox.y;
        this.lampPost.add(lx, ly, 0, 0, 1);
        G.draw(glow, lx, ly + 9, 162, 0.62, 0.62, 0, lamp[0], lamp[1], lamp[2], 0.9 * lamp[3]);
        this.lampBox.add(bx, by, 0, 0, 1);
        if (ch.batteryIn) this.battery.add(bx, by + 2, 60, 0, 0.9);
        else if (stage === LT.Prepare && ch.batteryBy !== 255) G.draw(glow, bx, by, 50, 0.35, 0.35, 0, 0.6, 0.85, 1, 0.45 + 0.25 * Math.sin(t * 3));
      }
      // the sleeper's compartment doors: shut until the Junction's clock runs, then slid away inside the partition
      // (toward the car's middle, where the partition runs long enough to take them)
      const open = ch.compartmentsOpen ? 1 : 0;
      for (const x of LT_TRAIN.compartments) this.compDoor.add(ox + x + open * 52 * (x < -880 ? 1 : -1), oy + LT_TRAIN.partitionY, 0, 0, 1);
      // a torn page drifting in each compartment, turning in a draught that isn't there (high enough to show over the
      // partition)
      if (stage === LT.Pages) for (let k = 0; k < 4; k++) {
        if (ch.pages & (1 << k)) continue;
        const p = ch.pageSpot(k);
        const bob = Math.sin(t * 2 + k) * 3;
        this.pages.add(ox + p.x, oy + p.y, 16 + bob, t * 0.3 + k, 1);
        G.draw(glow, ox + p.x, oy + p.y, 20 + bob, 0.35, 0.35, 0, 1, 0.95, 0.8, 0.5 + 0.2 * Math.sin(t * 3 + k));
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
      // (the boiler's gauge for Theo's stokes is a HUD dial since D-98: ui/stokeGauge.ts)
    }
    // ---- the brass key, lying where it was dropped (a glint now and then catches the eye)
    if (stage === LT.Key && ch.keyBy === 255) {
      const k = LT_KEY_SPOTS[ch.keyAt];
      if (inView(k.x, k.y)) {
        this.key.add(k.x, k.y, 0, 0.6, 1);
        const tw = Math.max(0, Math.sin(t * 1.7)) ** 6;
        G.draw(glow, k.x, k.y, 6, 0.2 + tw * 0.5, 0.2 + tw * 0.5, t, 1, 0.9, 0.55, 0.35 + tw * 0.6);
      }
    }
    // ---- Saint Vesper's: the vigil at the empty grave, kept while somebody stands in it
    if (stage === LT.Stations && ch.step[V] === 1) {
      const v = LT_VESPER.vigil;
      const live = g.players.some((p) => g.isUp(p) && (p.x - v.x) ** 2 + (p.y - v.y) ** 2 <= v.r * v.r);
      this.progress(r, v.x, v.y, v.r, ch.vigil, [0.7, 0.8, 1], live);
      // a pale light in the empty grave, brighter as the watch goes on
      G.draw(glow, v.x - 18, v.y, 12, 0.5, 0.5, 0, 0.6, 0.75, 1, 0.15 + ch.vigil * 0.35);
    }
    // ---- the Cinder Works: brass about the yard; the ladle along the yard's tub rails to the clock (the spur is the
    // floor's own, D-90)
    // (D-91: twice the size, tipped up to face you, a warm glow and glints that flare in turn; and still there while
    // somebody carries another one: they used to vanish until the carried one was in the crucible)
    if (stage === LT.Stations && ch.step[C] === 0) LT_WORKS.scrapSpots.forEach((sp, k) => {
      if (!(ch.scrapAt & (1 << k)) || ch.scrapsTaken & (1 << k) || !inView(sp.x, sp.y)) return;
      this.cog(sp.x, sp.y, COG.r * Math.sin(COG.tilt) + 2 - COG.sink * 0.3, t * 0.35 + k * 1.9, 1);
      G.draw(glow, sp.x, sp.y, 14, 1.15, 1.15, 0, 1, 0.72, 0.32, 0.5 + 0.14 * Math.sin(t * 1.8 + k));
      for (let j = 0; j < 4; j++) {
        // each glint rises and fades over about half a second, four to a cog in turn (one every second and a half or
        // so): a twinkle, not a flash
        const f = Math.max(0, Math.sin(t * 1.1 + k * 1.7 + (j * Math.PI) / 2)) ** 10;
        if (f < 0.03) continue;
        const a = j * 1.7 + k;
        const gx = sp.x + Math.cos(a) * 24, gy = sp.y + Math.sin(a) * 10, gh = 14 + (j % 3) * 12;
        G.draw(glow, gx, gy, gh, 0.25 + f * 0.35, 0.25 + f * 0.35, 0, 1, 0.9, 0.6, f * 0.6);
        G.draw(star, gx, gy, gh, 1 + f * 2.4, 1 + f * 2.4, t * 0.7 + j, 1, 0.97, 0.82, Math.min(1, f * 1.3));
      }
    });
    if (stage === LT.Stations && ch.step[C] === 1) {
      const l = ch.ladleAt(), ahead = alongPath(LT_WORKS.ladle, ch.ladle + 4);
      const near = g.players.some((p) => g.isUp(p) && (p.x - l.x) ** 2 + (p.y - l.y) ** 2 <= LAST_TRAIN.ladleNear ** 2);
      this.ladle.add(l.x, l.y, 0, Math.atan2(ahead.x - l.x, ahead.y - l.y) + Math.PI / 2, 1);
      G.draw(glow, l.x, l.y, 50, 0.55, 0.55, 0, 1, 0.55, 0.2, near ? 0.9 : 0.45);
      this.progress(r, l.x, l.y, 46, ch.ladle / LADLE_LEN, [1, 0.6, 0.25], near);
    }
    // ---- Stillwater: the three moments the village is frozen in, each a villager stopped mid-step (a ring round the
    // place while it waits to be woken); one woken takes its step and is gone. Then the pond's glint, the pendulum
    LT_STILL.moments.forEach((mo, k) => {
      const woken = ch.moments[k] >= 1 || ch.running(S) || ch.step[S] > 0;
      if (!woken) this.woke[k] = Infinity;
      else if (this.woke[k] === Infinity) this.woke[k] = t;
      else if (Number.isNaN(this.woke[k])) this.woke[k] = -Infinity;
      const since = t - this.woke[k];
      if (since > MOMENT_WAKE || !inView(mo.x, mo.y)) return;
      const f = MOMENT_FIGURES[k];
      if (since < 0) {
        // frost on the ground where it stopped, so it never reads as one of the Still Folk at a standstill
        r.zoneShapes.circle(mo.x, mo.y, 34, 0.7, 0.85, 1, 0.16, 0);
        r.figure(f.key, mo.x, mo.y, f.yaw, f.clip, f.t, FROZEN_TINT, FROZEN_RIM);
        if (k === 1) this.kiteAt(mo.x, mo.y);
        if (stage === LT.Stations && ch.step[S] === 0) {
          const live = g.players.some((p) => g.isUp(p) && (p.x - mo.x) ** 2 + (p.y - mo.y) ** 2 <= mo.r * mo.r);
          this.progress(r, mo.x, mo.y, mo.r, ch.moments[k], [0.75, 0.9, 1], live);
        }
        return;
      }
      // the step it was stopped in, the frost going out of it, then a breath of light and it's gone
      const u = since / MOMENT_WAKE, warm = Math.min(1, u * 2.2), flash = Math.max(0, (u - 0.75) / 0.25);
      const walk = since * 34, mix = (a: number) => a + (1 - a) * warm;
      r.figure(f.key, mo.x + Math.sin(f.yaw) * walk, mo.y + Math.cos(f.yaw) * walk, f.yaw, 'move', f.t + since * 0.8,
        [mix(FROZEN_TINT[0]) + flash * 1.4, mix(FROZEN_TINT[1]) + flash * 1.4, mix(FROZEN_TINT[2]) + flash * 1.4, mix(FROZEN_TINT[3]) + flash * 3],
        [FROZEN_RIM[0], FROZEN_RIM[1], FROZEN_RIM[2], FROZEN_RIM[3] * (1 - warm) + flash * 2]);
    });
    if (stage === LT.Stations && ch.step[S] === 1) {
      const b = LT_STILL.bank;
      const live = g.players.some((p) => g.isUp(p) && (p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= b.r * b.r);
      this.progress(r, b.x, b.y, b.r, ch.reel, [0.75, 0.9, 1], live);
      const pd = STILLWATER.pond;
      G.draw(glow, pd.x + 60, pd.y - 40, 2, 0.35, 0.35, 0, 1, 0.9, 0.6, 0.3 + 0.4 * Math.max(0, Math.sin(t * 1.3)) ** 4);
    }
    if (stage === LT.Stations && ch.step[S] === 2 && ch.pendulumBy === 255) {
      // lying on the jetty's planks where it was landed, still dripping
      const b = LT_STILL.bank, px = b.x + Math.sin(JETTY_YAW) * 26, py = b.y + Math.cos(JETTY_YAW) * 26;
      this.e.set(Math.PI / 2, 0, 0.4);
      this.q.setFromEuler(this.e);
      this.v.set(px, 7, py);
      this.sc.set(1, 1, 1);
      this.m.compose(this.v, this.q, this.sc);
      this.pendulum.addMatrix(this.m);
      G.draw(glow, px, py, 9, 0.3, 0.3, 0, 1, 0.85, 0.5, 0.4 + 0.2 * Math.sin(t * 3));
    }
    // ---- the four lost passengers waiting on the End of the Line's platform (until punched)
    for (let k = 0; k < 4; k++) {
      if (ch.boarded & (1 << k)) continue;
      const p = END.passengers[k];
      if (!inView(p.x, p.y)) continue;
      const fi = this.folk[k].add(p.x, p.y, 0, Math.sin(t * 0.3 + k) * 0.4, 1);
      this.folk[k].tint(fi, 1, 1, 1, stage >= LT.Passengers ? 1 : 0.5);
    }
    // ---- carried things: the key, a taper, brass, the pendulum, the signal battery, the punch, the letter, coal
    const carried = (by: number, col: [number, number, number], h: number, sz: number) => {
      const p = by === 255 ? null : g.players[by];
      if (!p) return;
      G.draw(glow, p.x + 14, p.y, h, sz, sz, 0, col[0], col[1], col[2], 0.7);
    };
    const kb = ch.keyBy === 255 || stage >= LT.Prepare ? null : g.players[ch.keyBy];
    if (kb) this.key.add(kb.x + 16, kb.y + 6, 30, 0.4, 0.8);
    for (const p of g.players) {
      const bit = 1 << p.index;
      if (ch.tapers & bit) {
        const left = Math.max(0, ch.taperT[p.index] / LAST_TRAIN.taper);
        G.draw(glow, p.x + 14, p.y, 58, 0.18 + left * 0.18, 0.18 + left * 0.18, 0, 1, 0.75, 0.35, 0.95);
      }
      if (ch.scrapCarry & bit) this.cog(p.x + 18, p.y + 6, 40, t * 1.5 + p.index, 0.6);
      if (ch.coalCarry & bit) G.draw(glow, p.x + 14, p.y, 40, 0.35, 0.35, 0, 1, 0.45, 0.15, 0.7);
    }
    const pb = ch.pendulumBy === 255 ? null : g.players[ch.pendulumBy];
    if (pb) {
      this.e.set(0, 0, Math.sin(t * 4) * 0.3);
      this.q.setFromEuler(this.e);
      this.v.set(pb.x + 18, 62, pb.y + 6);
      this.sc.set(0.8, 0.8, 0.8);
      this.m.compose(this.v, this.q, this.sc);
      this.pendulum.addMatrix(this.m);
    }
    const bat = ch.batteryBy === 255 ? null : g.players[ch.batteryBy];
    if (bat) {
      this.battery.add(bat.x + 18, bat.y + 4, 22, 0.3, 1);
      G.draw(glow, bat.x + 18, bat.y + 4, 46, 0.22, 0.22, 0, 0.6, 0.85, 1, 0.45);
    }
    carried(ch.punchBy, [1, 0.88, 0.5], 50, 0.25);
    carried(ch.letterBy, [1, 0.95, 0.85], 50, 0.25);
    // ---- fixtures waiting to be used
    if (stage === LT.Prepare && !ch.batteryIn && ch.batteryBy === 255) {
      this.battery.add(JUNCTION.lamproom.x, JUNCTION.lamproom.y - 6, 0, 0.4, 1.1);
      G.draw(glow, JUNCTION.lamproom.x, JUNCTION.lamproom.y - 6, 16, 0.45, 0.45, 0, 0.6, 0.85, 1, 0.5 + 0.3 * Math.sin(t * 2));
    }
    if (stage === LT.Prepare && ch.leverStep < LAST_TRAIN.leverSteps) for (let k = 0; k < LAST_TRAIN.levers; k++) {
      const done = ch.levers.slice(0, ch.leverStep).includes(k);
      G.draw(glow, JUNCTION.levers.x, JUNCTION.levers.y + (k - 2) * 38, 90, 0.2, 0.2, 0, done ? 0.4 : 1, done ? 1 : 0.8, done ? 0.5 : 0.5, 0.45);
    }
    if (stage === LT.Punch) G.draw(glow, END.barrier.x, END.barrier.y, 70, 0.3, 0.3, 0, 1, 0.9, 0.6, 0.5 + 0.3 * Math.sin(t * 3));
    const st = trainNow(g);
    if (stage === LT.Deliveries && !(ch.tasks & 8) && st.phase === 'dwell' && st.at === V) for (const rp of VESPER.ropes) G.draw(glow, rp.x, rp.y, 100, 0.25, 0.25, 0, 0.9, 0.85, 1, 0.35);
    // the phantom doors: from 33:00 each stands open on light
    if (g.time >= PHANTOM_AT) for (let k = 0; k < 4; k++) {
      const d = PHANTOM_DOOR[k];
      if (!inView(d.x, d.y)) continue;
      G.draw(glow, d.x, d.y, 80, 1.1, 1.6, 0, 0.75, 0.85, 1, 0.55 + 0.15 * Math.sin(t * 2 + k));
    }
    // the End of the Line goes dark for the finale; the last train home lights its windows
    if (stage === LT.Homeward) {
      const c = REGIONS[E];
      for (let i = 0; i < 6; i++) G.draw(glow, trainOrigin(E).x - 1200 + i * 500, c.cy - 1000, 70, 1.2, 1.2, 0, 1, 0.85, 0.6, 0.6);
    }
    for (const b of this.all) b.end();
  }
}
