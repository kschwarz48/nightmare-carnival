// The Prize Wheel (D-34): chests open as a haunted midway prize booth. A creaking backboard rises
// out of the dark, the crank is pulled, the wheel spins against a ticking brass clapper and lands on
// the prize the simulation ALREADY awarded (the wheel presents the result — it never rolls again).
// Extra rolls get bonus spins; evolutions get their own storm-lit show. Any input fast-forwards,
// Back/Esc skips to the summary. It lives in the renderer's overlay scene (D-61), drawn after the
// world with a fresh depth buffer, so no telegraph or x-ray silhouette shows through it, yet it still
// gets the world's bloom and grade. A slot-machine show: rim lights ride the wheel, the marquee races
// with its spin, a blip climbs with every peg, and a jackpot bell rings the win. The prize card names
// the item, its level and (in co-op) who won it.

import * as THREE from 'three';
import type { ChestEntry } from '../sim/draft';
import type { Assets } from '../render/assets';
import { ModelBuilder, SURF, box, cone, cyl, ellipsoid, extrude, rbox, smoothShape, sphere, starShape, torus, weather } from './core/geo';
import { actorMaterial, setObjectState } from './core/materials';
import { ActorBatch } from './core/batch';
import { PAL, bulb, eyes } from './models/kit';
import { signMesh } from './world/props';

export interface PrizeUi {
  /** Co-op: player names by slot (null in solo) */
  owners: string[] | null;
  title(text: string, style: 'normal' | 'bonus' | 'evolution' | 'voucher'): void;
  caption(entry: ChestEntry | null, icon: string): void;
  summary(entries: ChestEntry[], icons: string[]): void;
  hide(): void;
}

export interface PrizeSound {
  play(id: string, o?: { vol?: number; pitch?: number }): void;
}

type Phase = 'idle' | 'rise' | 'crank' | 'spin' | 'reveal' | 'summary' | 'sink';

const N = 10;
const SEG = (Math.PI * 2) / N;
/** bright midway paint (cherry, cream, gold, teal, magenta, violet, royal blue), barely weathered */
const SEG_COLS = [0xa8121e, 0xf0e2c0, 0xd08a10, 0x0e8078, 0x8e1e70, 0xf0e2c0, 0x4422a0, 0xd08a10, 0x15409a, 0xf0e2c0];
/** lights on the wheel's rim, two per wedge, riding the spin */
const RIM_N = N * 2;
/** the prize card's face, in pixels (the card is 220 x 300 units) */
const CARD_W = 512, CARD_H = 700;
const KIND: Record<ChestEntry['type'], [string, string]> = {
  new: ['NEW!', '#c8283a'], level: ['LEVEL UP', '#a8781e'], passive: ['CHARM', '#22807a'],
  evolution: ['EVOLUTION', '#6a3fc0'], voucher: ['LOST & FOUND', '#7a4f22'], heal: ['A SMALL MERCY', '#8a3a4a'],
};
/** midway bulbs in every colour (D-62): red, orange, yellow, green, cyan, blue, violet, pink; saturated, so
 *  the hue survives the glow and tone mapping instead of washing out to white */
const BULB_COLS: [number, number, number][] = [[1, 0.06, 0.06], [1, 0.42, 0.02], [1, 0.82, 0.04], [0.12, 1, 0.16], [0.04, 0.78, 1], [0.16, 0.26, 1], [0.66, 0.12, 1], [1, 0.12, 0.56]];
/** the co-op player colours (style.css .p1-.p6) */
const PLAYER_HEX = ['#ffd27a', '#8af4ff', '#ff8fb0', '#a8ff7a', '#c7a2ff', '#ffb066'];

export class PrizeWheel {
  root = new THREE.Group();
  private wheel = new THREE.Group();
  private board = new THREE.Group();
  private pointer = new THREE.Group();
  private lever = new THREE.Group();
  private jaw = new THREE.Group();
  private gears: THREE.Group[] = [];
  private card = new THREE.Group();
  private cardFace: THREE.Mesh;
  private cardCanvas = document.createElement('canvas');
  private cardTex: THREE.CanvasTexture;
  private cardEntry: ChestEntry | null = null;
  private images = new Map<string, HTMLImageElement>();
  private rimBulbs: ActorBatch;
  private rimMats: THREE.Matrix4[] = [];
  private hemi: THREE.HemisphereLight;
  private chase = 0;
  private spinV = 0;
  private prevAngle = 0;
  private winT = -1;
  private iconMeshes: THREE.Mesh[] = [];
  private highlight: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  private dim: THREE.Mesh;
  private dimMat: THREE.MeshBasicMaterial;
  private mat = actorMaterial({ emitBoost: 1.6, envIntensity: 0.45 });
  private bulbs: ActorBatch;
  private bulbMats: THREE.Matrix4[] = [];
  private spot: THREE.SpotLight;
  private fill: THREE.PointLight;
  private loader = new THREE.TextureLoader();
  private texCache = new Map<string, THREE.Texture>();
  private phase: Phase = 'idle';
  private t = 0;
  private spinIdx = 0;
  private entries: ChestEntry[] = [];
  private icons: string[] = [];
  private onDone: (() => void) | null = null;
  private angle = 0;
  private from = 0;
  private to = 0;
  private dur = 1;
  private lastPeg = 0;
  private pointerKick = 0;
  private flash = 0;
  private lastSkip = -9;
  private clock = 0;
  private evoShow = false;

  constructor(overlay: THREE.Scene, private assets: Assets, private ui: PrizeUi, private sfx: PrizeSound) {
    overlay.add(this.root);
    this.root.position.set(0, 0, -1300);
    this.root.visible = false;
    // dim the world behind the booth
    this.dimMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false });
    this.dim = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), this.dimMat);
    this.dim.position.z = -300;
    this.dim.renderOrder = 20;
    this.root.add(this.dim);
    this.root.add(this.board);
    // ---- backboard: arched, velvet and peeling gold leaf, a marquee of bulbs
    const bm = new ModelBuilder();
    const arch = smoothShape([[-330, -330], [330, -330], [340, 120], [300, 260], [170, 350], [0, 380], [-170, 350], [-300, 260], [-340, 120]], 60);
    bm.add(extrude(arch, 30, 6, 30), { col: weather(PAL.velvet, 0.5, 0.008, PAL.woodPale), pos: [0, 0, -40], surf: SURF.velvet });
    bm.add(extrude(arch, 10, 3, 30), { col: weather(PAL.gold, 0.35, 0.01), pos: [0, 0, -58], scale: [1.04, 1.04, 1], surf: SURF.gold });
    // pedestal and the booth counter
    bm.add(rbox(520, 90, 120, 8, 2), { col: weather(PAL.redDeep, 0.5, 0.01, PAL.woodPale), pos: [0, -380, 10], surf: SURF.wood });
    bm.add(rbox(540, 14, 130, 4, 1), { col: PAL.gold, pos: [0, -330, 10], surf: SURF.gold });
    for (let i = 0; i < 5; i++) bm.add(extrude(starShape(5, 16, 7), 3, 0.6, 1), { col: PAL.mustard, pos: [-200 + i * 100, -380, 72], surf: SURF.paint });
    // the jester on top of the board (its jaw laughs on a win)
    bm.add(ellipsoid(44, 50, 30, 18, 12), { col: weather(PAL.bone, 0.3, 0.02), pos: [0, 400, -10], surf: SURF.porcelain });
    for (const s of [-1, 1]) bm.add(cone(18, 60, 8), { col: s > 0 ? PAL.redDeep : PAL.teal, pos: [s * 44, 450, -10], rot: [0, 0, -s * 0.9], surf: SURF.cloth });
    for (const s of [-1, 1]) bm.add(sphere(9, 8, 6), { col: PAL.gold, pos: [s * 92, 478, -10], surf: SURF.gold });
    eyes(bm, { x: 15, y: 412, z: 18, r: 7, color: PAL.amber, glow: 1.2, part: 0 });
    for (const s of [-1, 1]) bm.add(ellipsoid(10, 4, 3, 8, 6), { col: PAL.ink, pos: [s * 15, 424, 20], rot: [0, 0, s * 0.3], surf: SURF.porcelain });
    const boardMesh = new THREE.Mesh(bm.build({ ao: 0.1 }), this.mat);
    this.board.add(boardMesh);
    const jm = new ModelBuilder();
    jm.add(ellipsoid(26, 12, 14, 14, 8), { col: weather(PAL.bone, 0.3), surf: SURF.porcelain });
    jm.add(ellipsoid(20, 6, 6, 12, 6), { col: PAL.blood, pos: [0, 4, 8], surf: SURF.latex });
    this.jaw.position.set(0, 372, 6);
    this.jaw.add(new THREE.Mesh(jm.build({ ao: 0 }), this.mat));
    this.board.add(this.jaw);
    const sign = signMesh('PRIZE WHEEL', 360, 54, { glow: 0.35, color: '#f0dca8' });
    sign.position.set(0, 300, -10);
    this.board.add(sign);
    // marquee bulbs around the arch (instanced so they can chase)
    const bulbGeo = new ModelBuilder();
    bulb(bulbGeo, [0, 0, 0], 5.5, 0xffffff, 0, undefined, 1);
    const pts = arch.getSpacedPoints(44);
    this.bulbs = new ActorBatch(bulbGeo.build({ ao: 0 }), actorMaterial({ emitBoost: 2.4 }), pts.length, { receive: false });
    for (let i = 0; i < pts.length; i++) this.bulbMats.push(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(pts[i].x * 0.97, pts[i].y * 0.97, -12));
    this.board.add(this.bulbs.mesh);
    // ---- the wheel: painted wedges, brass rim and pegs, a sun-faced hub, icons on every wedge
    this.board.add(this.wheel);
    const wm = new ModelBuilder();
    for (let i = 0; i < N; i++) {
      const a0 = i * SEG, a1 = a0 + SEG;
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      for (let k = 0; k <= 8; k++) {
        const a = a0 + ((a1 - a0) * k) / 8;
        s.lineTo(Math.cos(a) * 250, Math.sin(a) * 250);
      }
      s.lineTo(0, 0);
      wm.add(extrude(s, 14, 0, 8), { col: weather(SEG_COLS[i], 0.12, 0.004, PAL.woodPale), surf: SURF.paint });
      wm.add(cyl(4, 4, 18, 8), { col: PAL.brass, pos: [Math.cos(a0) * 262, Math.sin(a0) * 262, 6], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
      wm.add(box(240, 3, 4), { col: PAL.gold, pos: [Math.cos(a0) * 120, Math.sin(a0) * 120, 8], rot: [0, 0, a0], surf: SURF.gold });
    }
    wm.add(torus(256, 9, 8, 64), { col: weather(PAL.gold, 0.1, 0.01), surf: SURF.gold });
    wm.add(cyl(46, 46, 26, 24), { col: PAL.gold, rot: [Math.PI / 2, 0, 0], pos: [0, 0, 6], surf: SURF.gold });
    wm.add(extrude(starShape(12, 62, 40), 8, 1, 1), { col: weather(PAL.gold, 0.25), pos: [0, 0, 10], surf: SURF.gold });
    eyes(wm, { x: 14, y: 8, z: 22, r: 7, color: PAL.hotRed, glow: 1, part: 0 });
    wm.add(ellipsoid(16, 6, 3, 10, 6), { col: PAL.ink, pos: [0, -14, 22], surf: SURF.porcelain });
    this.wheel.add(new THREE.Mesh(wm.build({ ao: 0 }), this.mat));
    // rim lights: two per wedge, between the pegs, riding the wheel round
    const rim = new ModelBuilder();
    bulb(rim, [0, 0, 0], 7, 0xffffff, 0, undefined, 1);
    this.rimBulbs = new ActorBatch(rim.build({ ao: 0 }), actorMaterial({ emitBoost: 2.4 }), RIM_N, { receive: false });
    for (let i = 0; i < RIM_N; i++) {
      const a = (i + 0.5) * (SEG / 2);
      this.rimMats.push(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(Math.cos(a) * 282, Math.sin(a) * 282, 8));
    }
    this.wheel.add(this.rimBulbs.mesh);
    for (let i = 0; i < N; i++) {
      const a = i * SEG + SEG / 2;
      const im = new THREE.Mesh(new THREE.PlaneGeometry(76, 76), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.1 }));
      im.position.set(Math.cos(a) * 168, Math.sin(a) * 168, 16);
      im.rotation.z = a - Math.PI / 2;
      this.wheel.add(im);
      this.iconMeshes.push(im);
    }
    // a glowing wedge that flares over the winning slot (in board space: the slot under the pointer)
    const hs = new THREE.Shape();
    hs.moveTo(0, 0);
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI / 2 - SEG / 2 + (SEG * k) / 8;
      hs.lineTo(Math.cos(a) * 252, Math.sin(a) * 252);
    }
    hs.lineTo(0, 0);
    this.highlight = new THREE.Mesh(new THREE.ShapeGeometry(hs), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.4).multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.highlight.position.z = 26;
    this.board.add(this.highlight);
    // gears grinding behind the wheel
    for (const [x, y, r, teeth] of [[-250, -170, 90, 14], [255, -150, 70, 11], [0, -250, 60, 9]] as [number, number, number, number][]) {
      const g = new THREE.Group();
      g.position.set(x, y, -24);
      const gm = new ModelBuilder();
      gm.add(extrude(starShape(teeth, r, r * 0.82), 12, 1, 1), { col: weather(PAL.brass, 0.35, 0.02), surf: SURF.brass });
      gm.add(cyl(r * 0.25, r * 0.25, 18, 12), { col: PAL.iron, rot: [Math.PI / 2, 0, 0], surf: SURF.iron });
      g.add(new THREE.Mesh(gm.build({ ao: 0 }), this.mat));
      g.userData.ratio = 260 / r * (this.gears.length % 2 ? -1 : 1);
      this.board.add(g);
      this.gears.push(g);
    }
    // the clapper at 12 o'clock
    this.pointer.position.set(0, 290, 40);
    const pm = new ModelBuilder();
    pm.add(extrude([[-16, 0], [16, 0], [0, -64]], 8, 2, 1), { col: PAL.gold, surf: SURF.gold });
    pm.add(sphere(12, 10, 8), { col: PAL.blood, surf: SURF.latex });
    this.pointer.add(new THREE.Mesh(pm.build({ ao: 0 }), this.mat));
    this.board.add(this.pointer);
    // the crank lever on the right
    this.lever.position.set(320, -150, 30);
    const lm = new ModelBuilder();
    lm.add(cyl(8, 8, 150, 8), { col: PAL.iron, pos: [0, 75, 0], surf: SURF.iron });
    lm.add(sphere(22, 12, 10), { col: PAL.blood, pos: [0, 155, 0], surf: SURF.latex });
    lm.add(cyl(20, 26, 30, 12), { col: PAL.brass, rot: [0, 0, Math.PI / 2], surf: SURF.brass });
    this.lever.add(new THREE.Mesh(lm.build({ ao: 0 }), this.mat));
    this.board.add(this.lever);
    // the prize card that leaps out on a reveal: a painted face naming the prize, its level and its winner
    const cm = new ModelBuilder();
    cm.add(rbox(220, 300, 8, 12, 2), { col: PAL.cream, surf: SURF.paint, emit: 0.15 });
    cm.add(rbox(232, 312, 6, 14, 2), { col: PAL.gold, pos: [0, 0, -3], surf: SURF.gold });
    this.card.add(new THREE.Mesh(cm.build({ ao: 0 }), this.mat));
    this.cardCanvas.width = CARD_W;
    this.cardCanvas.height = CARD_H;
    this.cardTex = new THREE.CanvasTexture(this.cardCanvas);
    this.cardTex.colorSpace = THREE.SRGBColorSpace;
    this.cardTex.anisotropy = 4;
    this.cardFace = new THREE.Mesh(new THREE.PlaneGeometry(216, 296), new THREE.MeshBasicMaterial({ map: this.cardTex, transparent: true, color: new THREE.Color(0.93, 0.93, 0.93) }));
    this.cardFace.position.set(0, 0, 4.5);
    this.card.add(this.cardFace);
    this.card.visible = false;
    this.root.add(this.card);
    // stage lighting for the booth
    // inverse-square with a hard cutoff: the stage lights touch the booth, never the world behind
    this.spot = new THREE.SpotLight(0xffd9a0, 0, 1900, 0.5, 0.6, 2);
    this.spot.position.set(0, 900, 900);
    this.spot.target.position.set(0, 0, 0);
    this.root.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight(0xff9a5a, 0, 950, 2);
    this.fill.position.set(-300, -100, 500);
    this.root.add(this.fill);
    // a warm wash over the whole booth: the show is lit, not lurking
    this.hemi = new THREE.HemisphereLight(0xfff0d6, 0x4a2c20, 0);
    this.root.add(this.hemi);
    for (const o of [boardMesh]) o.renderOrder = 21;
  }

  /**
   * Showing the booth adds its spot and fill lights to the scene, and three.js then rebuilds every
   * visible material's shader for the new light count — a multi-second stall on the night's first chest.
   * Compile those programs ahead of time instead: the booth counts as shown for one asynchronous compile
   * pass (which gathers the scene synchronously) and is hidden again before any frame draws. `target`
   * must be the render target the scene really draws into (the post chain's linear buffer): a program's
   * output colour space and tone mapping depend on it, so compiling for the canvas would miss.
   */
  prewarm(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.WebGLRenderTarget | null): Promise<unknown> {
    if (this.root.visible) return Promise.resolve();
    const prev = renderer.getRenderTarget();
    this.root.visible = this.card.visible = true;
    renderer.setRenderTarget(target);
    // the prize icons only get their pictures when a chest opens: compile them as textured too
    const icons = this.iconMeshes.map((m) => m.material as THREE.MeshBasicMaterial).filter((m) => !m.map);
    const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    blank.colorSpace = THREE.SRGBColorSpace;
    blank.needsUpdate = true;
    for (const m of icons) m.map = blank;
    try {
      return renderer.compileAsync(scene, camera).catch(() => undefined);
    } finally {
      for (const m of icons) m.map = null;
      blank.dispose();
      renderer.setRenderTarget(prev);
      this.root.visible = this.card.visible = false;
    }
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  private tex(url: string): THREE.Texture {
    let t = this.texCache.get(url);
    if (!t) {
      t = this.loader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      this.texCache.set(url, t);
    }
    return t;
  }

  iconFor(e: ChestEntry): string {
    switch (e.type) {
      case 'passive': return this.assets.passiveIcon(e.id);
      case 'voucher': return this.assets.passiveIcon('coin_purse');
      case 'heal': return this.assets.passiveIcon('funnel_cake');
      default: return this.assets.weaponIcon(e.id);
    }
  }

  /** Present an already-granted chest. `fillers` are icons for the losing wedges (cosmetic only). */
  start(entries: ChestEntry[], fillers: string[], onDone: () => void): void {
    this.entries = entries.length ? entries : [{ type: 'voucher', id: 'voucher', label: 'Nothing but dust and an old ticket stub' }];
    this.icons = this.entries.map((e) => this.iconFor(e));
    this.onDone = onDone;
    this.spinIdx = 0;
    this.root.visible = true;
    this.phase = 'rise';
    this.t = 0;
    this.angle = this.prevAngle = 0;
    this.card.visible = false;
    this.winT = -1;
    this.fillers = fillers.length ? fillers : this.icons;
    this.sfx.play('wheel_rise', { vol: 0.7 });
    this.ui.title('PRIZE WHEEL', 'normal');
    this.ui.caption(null, '');
    this.prepareSpin();
  }

  private fillers: string[] = [];
  private winSlot = 0;

  private prepareSpin(): void {
    const e = this.entries[this.spinIdx];
    this.evoShow = e.type === 'evolution';
    // dress the wheel: the real prize in one wedge, cosmetic fillers elsewhere
    this.winSlot = Math.floor(Math.random() * N);
    for (let i = 0; i < N; i++) {
      const url = i === this.winSlot ? this.icons[this.spinIdx] : this.fillers[(i * 7 + this.spinIdx * 3) % this.fillers.length];
      (this.iconMeshes[i].material as THREE.MeshBasicMaterial).map = this.tex(url);
      (this.iconMeshes[i].material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
    // land the winning wedge's centre under the clapper (12 o'clock = +90°)
    const target = Math.PI / 2 - (this.winSlot * SEG + SEG / 2);
    const turns = this.spinIdx === 0 ? 4 : 2;
    const base = this.angle - (this.angle % (Math.PI * 2));
    let to = base + turns * Math.PI * 2 + target;
    while (to < this.angle + Math.PI * 2 * (turns - 0.5)) to += Math.PI * 2;
    this.from = this.angle;
    this.to = to;
    this.dur = this.evoShow ? 4.4 : this.spinIdx === 0 ? 2.8 : 1.5;
    this.lastPeg = Math.floor(this.angle / SEG);
  }

  /** Input: fast-forward the current beat; `all` (Back/Esc or a double tap) jumps to the summary. */
  skip(all = false): void {
    if (this.phase === 'idle' || this.phase === 'sink') return;
    const now = this.clock;
    if (this.phase === 'summary') {
      this.close();
      return;
    }
    if (all || now - this.lastSkip < 0.35) {
      this.angle = this.to;
      this.phase = 'summary';
      this.t = 0;
      this.card.visible = false;
      this.highlight.material.opacity = 0;
      this.ui.summary(this.entries, this.icons);
      this.sfx.play('fanfare', { vol: 0.5 });
      return;
    }
    this.lastSkip = now;
    if (this.phase === 'rise' || this.phase === 'crank') {
      this.phase = 'spin';
      this.t = this.dur;
    } else if (this.phase === 'spin') this.t = this.dur;
    else if (this.phase === 'reveal') this.t = 99;
  }

  /** Tear down instantly (dev timeline tools, run end). */
  finishNow(): void {
    if (this.phase === 'idle') return;
    this.phase = 'idle';
    this.root.visible = false;
    this.ui.hide();
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }

  private close(): void {
    this.phase = 'sink';
    this.t = 0;
    this.ui.hide();
    this.sfx.play('ui_click', { vol: 0.4 });
  }

  private startReveal(): void {
    const e = this.entries[this.spinIdx];
    this.phase = 'reveal';
    this.t = 0;
    this.winT = 0;
    this.card.visible = true;
    this.drawCard(e, this.icons[this.spinIdx]);
    this.ui.caption(e, this.icons[this.spinIdx]);
    // the jackpot: a bell, a shower of coins, the fanfare
    this.sfx.play('slot_win', { vol: 0.6 });
    if (e.type === 'evolution') {
      this.sfx.play('thunder', { vol: 0.8 });
      this.sfx.play('evolve', { vol: 0.9 });
      this.flash = 1;
    } else if (e.type === 'voucher') {
      this.sfx.play('coin_shower', { vol: 0.7 });
      this.sfx.play('fanfare', { vol: 0.45, pitch: 0.9 });
    } else {
      this.sfx.play('coin_shower', { vol: 0.5 });
      this.sfx.play('fanfare', { vol: 0.5, pitch: e.type === 'new' ? 1.12 : 1 });
    }
  }

  private image(url: string): HTMLImageElement {
    let im = this.images.get(url);
    if (!im) {
      im = new Image();
      im.src = url;
      this.images.set(url, im);
    }
    return im;
  }

  /** Paint the card's face: the kind on a ribbon, the icon, the item's name and level, and whose it is. */
  private drawCard(e: ChestEntry, icon: string): void {
    this.cardEntry = e;
    const x = this.cardCanvas.getContext('2d');
    if (!x) return;
    const W = CARD_W, H = CARD_H;
    const rr = (px: number, py: number, w: number, h: number, r: number) => {
      x.beginPath();
      x.moveTo(px + r, py);
      x.arcTo(px + w, py, px + w, py + h, r);
      x.arcTo(px + w, py + h, px, py + h, r);
      x.arcTo(px, py + h, px, py, r);
      x.arcTo(px, py, px + w, py, r);
      x.closePath();
    };
    x.clearRect(0, 0, W, H);
    // cream card stock, a gilt double rule
    const bg = x.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fffaea');
    bg.addColorStop(1, '#f1dfb4');
    x.fillStyle = bg;
    rr(0, 0, W, H, 30);
    x.fill();
    x.strokeStyle = '#b8862e';
    x.lineWidth = 9;
    rr(16, 16, W - 32, H - 32, 22);
    x.stroke();
    x.lineWidth = 2.5;
    rr(30, 30, W - 60, H - 60, 14);
    x.stroke();
    // the kind, on a ribbon
    const [kind, col] = KIND[e.type];
    x.fillStyle = col;
    rr(44, 48, W - 88, 70, 14);
    x.fill();
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#fff4d6';
    x.font = '600 44px Oswald, "Arial Narrow", sans-serif';
    x.fillText(e.type === 'evolution' ? `✦ ${kind} ✦` : kind, W / 2, 85);
    // the prize itself
    const im = this.image(icon);
    if (im.complete && im.naturalWidth) x.drawImage(im, W / 2 - 115, 136, 230, 230);
    else im.addEventListener('load', () => this.cardEntry === e && this.drawCard(e, icon), { once: true });
    // its name: as large as fits, on up to two lines
    const name = e.name ?? e.label.replace(/^New: /, '').replace(/ Lv \d+$/, '');
    x.fillStyle = '#2a1a14';
    let size = 54;
    const fits = (s: string) => x.measureText(s).width <= W - 96;
    x.font = `400 ${size}px Rye, Georgia, serif`;
    while (size > 34 && !fits(name)) x.font = `400 ${(size -= 2)}px Rye, Georgia, serif`;
    if (fits(name)) x.fillText(name, W / 2, 418);
    else {
      const words = name.split(' ');
      let cut = 1;
      while (cut < words.length - 1 && fits(words.slice(0, cut + 1).join(' '))) cut++;
      x.fillText(words.slice(0, cut).join(' '), W / 2, 396);
      x.fillText(words.slice(cut).join(' '), W / 2, 446);
    }
    // its level (or what it's worth)
    const lvl = e.type === 'evolution' ? 'Evolved!' : e.note ?? (e.max ? 'MAX LEVEL' : e.level ? `Level ${e.level}` : '');
    x.fillStyle = e.max ? '#a8781e' : '#6a4a34';
    x.font = '600 40px Oswald, "Arial Narrow", sans-serif';
    x.fillText(lvl, W / 2, 506);
    // and whose it is
    const owner = this.ui.owners && e.player !== undefined ? this.ui.owners[e.player] ?? `Player ${e.player + 1}` : null;
    if (owner) {
      x.fillStyle = '#1c1218';
      rr(52, 560, W - 104, 96, 16);
      x.fill();
      x.fillStyle = '#d8c8a8';
      x.font = '600 22px Oswald, "Arial Narrow", sans-serif';
      x.fillText('WON BY', W / 2, 584);
      x.fillStyle = PLAYER_HEX[e.player! % PLAYER_HEX.length];
      let os = 40;
      x.font = `600 ${os}px Oswald, "Arial Narrow", sans-serif`;
      while (os > 24 && x.measureText(owner).width > W - 140) x.font = `600 ${(os -= 2)}px Oswald, "Arial Narrow", sans-serif`;
      x.fillText(owner, W / 2, 626);
    } else {
      x.fillStyle = '#b8862e';
      x.font = '400 30px Rye, Georgia, serif';
      x.fillText('★  YOUR PRIZE  ★', W / 2, 606);
    }
    this.cardTex.needsUpdate = true;
  }

  update(dt: number, screenFlash: (k: number) => void): void {
    this.clock += dt;
    if (this.phase === 'idle') return;
    this.t += dt;
    const t = this.t;
    const time = this.clock;
    // dim + rise/sink
    let up = 1;
    if (this.phase === 'rise') up = Math.min(1, t / 0.7);
    if (this.phase === 'sink') up = Math.max(0, 1 - t / 0.45);
    const ease = 1 - Math.pow(1 - up, 3);
    this.board.position.y = (1 - ease) * -900;
    this.dimMat.opacity = 0.72 * ease;
    this.spot.intensity = 3.0e6 * ease * (this.evoShow ? 0.75 : 1);
    this.fill.intensity = 2.0e5 * ease;
    this.hemi.intensity = 0.6 * ease;
    this.spot.color.setRGB(1, this.evoShow ? 0.55 : 0.9, this.evoShow ? 0.4 : 0.72);
    // the lights race with the wheel: the marquee chase runs at the wheel's own speed and slows as it
    // does; a win strobes every bulb for a moment
    this.spinV = Math.abs(this.angle - this.prevAngle) / Math.max(dt, 1e-3);
    this.prevAngle = this.angle;
    this.chase += dt * (4 + this.spinV * 2.4);
    const strobe = this.winT >= 0 && this.winT < 1.1 ? (Math.floor(this.winT * 10) % 2 ? 0.25 : 1) : -1;
    if (this.winT >= 0) this.winT += dt;
    this.bulbs.begin();
    for (let i = 0; i < this.bulbMats.length; i++) {
      const on = strobe >= 0 ? strobe : Math.sin(this.chase - i * 0.9) > 0 ? 1 : 0.22;
      const k = this.bulbs.addMatrix(this.bulbMats[i]);
      const c = BULB_COLS[i % BULB_COLS.length];
      if (this.evoShow) this.bulbs.tint(k, 1, i % 2 ? 0.3 : 0.75, 0.15, on * ease);
      else this.bulbs.tint(k, c[0], c[1], c[2], on * ease);
    }
    this.bulbs.end();
    // the rim lights ride the wheel in every colour, every other one lit, swapping as the chase runs
    this.rimBulbs.begin();
    const swap = Math.floor(this.chase / 1.6) % 2;
    for (let i = 0; i < RIM_N; i++) {
      const on = strobe >= 0 ? strobe : (i + swap) % 2 ? 0.35 : 1;
      const k = this.rimBulbs.addMatrix(this.rimMats[i]);
      const c = BULB_COLS[(i * 3) % BULB_COLS.length];
      this.rimBulbs.tint(k, c[0], c[1], c[2], on * ease);
    }
    this.rimBulbs.end();
    // lever: pulled during the crank beat
    const pull = this.phase === 'crank' ? Math.sin(Math.min(1, t / 0.45) * Math.PI) : 0;
    this.lever.rotation.z = -pull * 1.1;
    switch (this.phase) {
      case 'rise':
        if (t >= 0.7) {
          this.phase = 'crank';
          this.t = 0;
          this.sfx.play('wheel_crank', { vol: 0.8 });
        }
        break;
      case 'crank':
        if (t >= 0.45) {
          this.phase = 'spin';
          this.t = 0;
          this.sfx.play('slot_spin', { vol: 0.55 });
          if (this.evoShow) this.sfx.play('drumroll', { vol: 0.7 });
        }
        break;
      case 'spin': {
        const k = Math.min(1, t / this.dur);
        // evolutions crawl agonisingly slowly into place; normal spins ease out with a tiny settle
        const e = this.evoShow ? 1 - Math.pow(1 - k, 5) : 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.015;
        this.angle = this.from + (this.to - this.from) * Math.min(1, e);
        const peg = Math.floor(this.angle / SEG);
        if (peg !== this.lastPeg) {
          this.lastPeg = peg;
          this.pointerKick = 1;
          this.sfx.play('wheel_tick', { vol: 0.5, pitch: 0.9 + Math.random() * 0.2 });
          // a slot machine's blip on every peg, climbing as the wheel slows toward the prize
          this.sfx.play('slot_blip', { vol: 0.3, pitch: 0.85 + k * 0.8 });
        }
        if (k >= 1) {
          this.angle = this.to;
          this.startReveal();
        }
        break;
      }
      case 'reveal': {
        const hold = this.evoShow ? 1.9 : 1.5; // long enough to read the card
        const pop = Math.min(1, t / 0.35);
        const p = 1 - Math.pow(1 - pop, 3);
        this.card.position.set(0, 50 + p * 30, 120 + p * 200);
        this.card.scale.setScalar(0.25 + p * 1.25 + Math.sin(Math.min(1, t / 0.5) * Math.PI) * 0.08);
        this.card.rotation.y = (1 - p) * Math.PI * 2;
        this.highlight.material.opacity = 0.55 + 0.35 * Math.sin(time * 14);
        this.jaw.rotation.x = Math.abs(Math.sin(time * 16)) * 0.35;
        if (t >= hold) {
          this.highlight.material.opacity = 0;
          this.jaw.rotation.x = 0;
          this.card.visible = false;
          this.spinIdx++;
          if (this.spinIdx >= this.entries.length) {
            this.phase = 'summary';
            this.t = 0;
            this.ui.summary(this.entries, this.icons);
          } else {
            this.ui.title(this.entries[this.spinIdx].type === 'evolution' ? 'EVOLUTION!' : 'BONUS SPIN!', this.entries[this.spinIdx].type === 'evolution' ? 'evolution' : 'bonus');
            this.ui.caption(null, '');
            this.prepareSpin();
            this.phase = 'crank';
            this.t = 0;
            this.sfx.play('wheel_crank', { vol: 0.6, pitch: 1.15 });
          }
        }
        break;
      }
      case 'summary':
        this.highlight.material.opacity = 0;
        break;
      case 'sink':
        if (t >= 0.45) {
          this.phase = 'idle';
          this.root.visible = false;
          const cb = this.onDone;
          this.onDone = null;
          cb?.();
        }
        break;
    }
    this.wheel.rotation.z = this.angle;
    for (const g of this.gears) g.rotation.z = -this.angle * (g.userData.ratio as number) * 0.35;
    this.pointerKick = Math.max(0, this.pointerKick - dt * 9);
    this.pointer.rotation.z = Math.sin(this.pointerKick * Math.PI) * 0.35;
    // a storm-lit evolution show: lightning flickers through the booth
    if (this.evoShow && (this.phase === 'spin' || this.phase === 'reveal') && Math.random() < dt * 1.6) this.flash = Math.max(this.flash, 0.7);
    if (this.flash > 0) {
      screenFlash(this.flash * 0.5);
      this.flash = Math.max(0, this.flash - dt * 3);
    }
    setObjectState(this.mat, time * 3, 0, 0, 0, [1, 1, 1, ease], [1, 0.75, 0.4, 0.35 * ease]);
  }
}
