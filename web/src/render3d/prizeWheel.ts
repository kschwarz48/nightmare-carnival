// The Prize Wheel (D-34): chests open as a haunted midway prize booth. A creaking backboard rises
// out of the dark, the crank is pulled, the wheel spins against a ticking brass clapper and lands on
// the prize the simulation ALREADY awarded (the wheel presents the result — it never rolls again).
// Extra rolls get bonus spins; evolutions get their own storm-lit show. Any input fast-forwards,
// Back/Esc skips to the summary. Built in the main scene, parented to the camera, so it receives
// the same bloom and grade as the world.

import * as THREE from 'three';
import type { ChestEntry } from '../sim/draft';
import type { Assets } from '../render/assets';
import { ModelBuilder, SURF, box, cone, cyl, ellipsoid, extrude, rbox, smoothShape, sphere, starShape, torus, weather } from './core/geo';
import { actorMaterial, setObjectState } from './core/materials';
import { ActorBatch } from './core/batch';
import { PAL, bulb, eyes } from './models/kit';
import { signMesh } from './world/props';

export interface PrizeUi {
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
const SEG_COLS = [PAL.velvet, PAL.cream, PAL.redDeep, PAL.mustard, PAL.teal, PAL.cream, PAL.plum, PAL.mustard, PAL.navy, PAL.cream];

export class PrizeWheel {
  root = new THREE.Group();
  private wheel = new THREE.Group();
  private board = new THREE.Group();
  private pointer = new THREE.Group();
  private lever = new THREE.Group();
  private jaw = new THREE.Group();
  private gears: THREE.Group[] = [];
  private card = new THREE.Group();
  private cardIcon: THREE.Mesh;
  private iconMeshes: THREE.Mesh[] = [];
  private highlight: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  private dim: THREE.Mesh;
  private dimMat: THREE.MeshBasicMaterial;
  private mat = actorMaterial({ emitBoost: 3.2, envIntensity: 0.8 });
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

  constructor(camera: THREE.Camera, private assets: Assets, private ui: PrizeUi, private sfx: PrizeSound) {
    camera.add(this.root);
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
    const sign = signMesh('PRIZE WHEEL', 360, 54, { glow: 0.9, color: '#f0dca8' });
    sign.position.set(0, 300, -10);
    this.board.add(sign);
    // marquee bulbs around the arch (instanced so they can chase)
    const bulbGeo = new ModelBuilder();
    bulb(bulbGeo, [0, 0, 0], 7, 0xffffff, 0, undefined, 1);
    const pts = arch.getSpacedPoints(44);
    this.bulbs = new ActorBatch(bulbGeo.build({ ao: 0 }), actorMaterial({ emitBoost: 4 }), pts.length, { receive: false });
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
      wm.add(extrude(s, 14, 0, 8), { col: weather(SEG_COLS[i], 0.45, 0.012, PAL.woodPale), surf: SURF.paint });
      wm.add(cyl(4, 4, 18, 8), { col: PAL.brass, pos: [Math.cos(a0) * 262, Math.sin(a0) * 262, 6], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
      wm.add(box(240, 3, 4), { col: PAL.gold, pos: [Math.cos(a0) * 120, Math.sin(a0) * 120, 8], rot: [0, 0, a0], surf: SURF.gold });
    }
    wm.add(torus(256, 9, 8, 64), { col: weather(PAL.brass, 0.25, 0.02), surf: SURF.brass });
    wm.add(cyl(46, 46, 26, 24), { col: PAL.gold, rot: [Math.PI / 2, 0, 0], pos: [0, 0, 6], surf: SURF.gold });
    wm.add(extrude(starShape(12, 62, 40), 8, 1, 1), { col: weather(PAL.gold, 0.25), pos: [0, 0, 10], surf: SURF.gold });
    eyes(wm, { x: 14, y: 8, z: 22, r: 7, color: PAL.hotRed, glow: 1, part: 0 });
    wm.add(ellipsoid(16, 6, 3, 10, 6), { col: PAL.ink, pos: [0, -14, 22], surf: SURF.porcelain });
    this.wheel.add(new THREE.Mesh(wm.build({ ao: 0 }), this.mat));
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
    // the prize card that leaps out on a reveal
    const cm = new ModelBuilder();
    cm.add(rbox(150, 200, 8, 10, 2), { col: PAL.cream, surf: SURF.paint, emit: 0.15 });
    cm.add(rbox(160, 210, 6, 12, 2), { col: PAL.gold, pos: [0, 0, -3], surf: SURF.gold });
    this.card.add(new THREE.Mesh(cm.build({ ao: 0 }), this.mat));
    this.cardIcon = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.1 }));
    this.cardIcon.position.set(0, 10, 6);
    this.card.add(this.cardIcon);
    this.card.visible = false;
    this.root.add(this.card);
    // stage lighting for the booth
    this.spot = new THREE.SpotLight(0xffd9a0, 0, 2400, 0.55, 0.6, 1.2);
    this.spot.position.set(0, 900, 900);
    this.spot.target.position.set(0, 0, 0);
    this.root.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight(0xff9a5a, 0, 1600, 1.2);
    this.fill.position.set(-300, -100, 500);
    this.root.add(this.fill);
    for (const o of [boardMesh]) o.renderOrder = 21;
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
    this.angle = 0;
    this.card.visible = false;
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
    this.card.visible = true;
    (this.cardIcon.material as THREE.MeshBasicMaterial).map = this.tex(this.icons[this.spinIdx]);
    (this.cardIcon.material as THREE.MeshBasicMaterial).needsUpdate = true;
    this.ui.caption(e, this.icons[this.spinIdx]);
    if (e.type === 'evolution') {
      this.sfx.play('thunder', { vol: 0.8 });
      this.sfx.play('evolve', { vol: 0.9 });
      this.flash = 1;
    } else if (e.type === 'voucher') {
      this.sfx.play('coins', { vol: 0.7 });
      this.sfx.play('fanfare', { vol: 0.5, pitch: 0.9 });
    } else {
      this.sfx.play('fanfare', { vol: 0.6, pitch: e.type === 'new' ? 1.12 : 1 });
    }
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
    this.spot.intensity = 2.6e6 * ease * (this.evoShow ? 0.7 : 1);
    this.fill.intensity = 1.2e5 * ease;
    this.spot.color.setRGB(1, this.evoShow ? 0.55 : 0.85, this.evoShow ? 0.4 : 0.62);
    // marquee chase: faster while spinning, red-gold strobe for evolutions
    const speed = this.phase === 'spin' ? 18 : 5;
    this.bulbs.begin();
    for (let i = 0; i < this.bulbMats.length; i++) {
      const on = Math.sin(time * speed - i * 0.9) > 0 ? 1 : 0.18;
      const k = this.bulbs.addMatrix(this.bulbMats[i]);
      if (this.evoShow) this.bulbs.tint(k, 1, i % 2 ? 0.3 : 0.75, 0.15, on * ease);
      else this.bulbs.tint(k, 1, i % 3 === 0 ? 0.45 : 0.78, i % 3 === 0 ? 0.3 : 0.45, on * ease);
    }
    this.bulbs.end();
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
        }
        if (k >= 1) {
          this.angle = this.to;
          this.startReveal();
        }
        break;
      }
      case 'reveal': {
        const hold = this.evoShow ? 1.9 : 1.15;
        const pop = Math.min(1, t / 0.35);
        const p = 1 - Math.pow(1 - pop, 3);
        this.card.position.set(0, 60 + p * 40, 120 + p * 200);
        this.card.scale.setScalar(0.2 + p * 0.95 + Math.sin(Math.min(1, t / 0.5) * Math.PI) * 0.08);
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
