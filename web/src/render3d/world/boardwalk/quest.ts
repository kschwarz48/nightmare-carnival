// Summer's End in the world (D-68): everything the hidden quest changes, drawn from its (replicated) state
// and sim time alone, so every screen in a party sees the same thing. The conch at the low-tide waterline;
// Ada's keepsakes as souvenirs on the Gift Shop's shelves and as prizes at the games; the Crane's claw and
// the Sea Wheel's green lantern; the wreck's portholes and their engravings; the rod, the float and the
// bubbles; the lighthouse flashing the call sign; the Gala Queen moored at the pier with St. Elmo's fire
// on her bow; the four tide lamps; the founder's bell in the mud, on its chain, and following its ringer.

import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { GameRenderer3D } from '../../renderer3d';
import { ARCADE_FIX, KEEPSAKES, PIER_FIX, SHOP_FIX, SUMMERS_END, isLowTide, seabedHeight, trainU, waterDepth, wheelFromBottom } from '../../../data/boardwalk';
import { SE, type SummersEndChain } from '../../../sim/quest/summersEnd';
import { ModelBuilder, SURF, box, cone, cyl, ellipsoid, extrude, sphere, torus, tube, weather, type V3 } from '../../core/geo';
import { ActorBatch, StaticBatch } from '../../core/batch';
import { actorMaterial, pool } from '../../core/materials';
import { PAL } from '../../models/kit';
import { Rides } from './rides';
import { galaQueenGeometry } from '../../boardwalkBosses';
import { Strand } from '../../funhouseBosses';
import type { Frame } from '../../../render/atlas';
import { PHOTO } from './furnishings';
import { Photograph } from './photo';

const S = SUMMERS_END;
/** How each keepsake stands on the shelf: flat things face the camera, round ones turn a little. */
const KEEP_YAW = [0, 0.5, 0.3, 0.15, 0, 0, 0.4, 0];

/** One of Ada's eight keepsakes (and their look-alike souvenirs), about a hand high. */
function keepsakeModel(i: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  switch (KEEPSAKES[i]) {
    case 'pinwheel':
      m.add(cyl(0.8, 0.8, 22, 6), { col: PAL.woodPale, pos: [0, 11, 0], surf: SURF.wood });
      for (let k = 0; k < 4; k++) m.add(extrude([[0, 0], [7, 2], [3, 8]], 0.4, 0, 1), { col: [0xb8262a, 0xe8dcc0, 0x1a5a8a, 0xd8a830][k], pos: [0, 22, 0.6], rot: [0, 0, (k * Math.PI) / 2], surf: SURF.paint });
      break;
    case 'tin pail':
      m.add(cyl(6, 4.6, 9, 12, true), { col: weather(0x3a7ab0, 0.4), pos: [0, 4.5, 0], surf: SURF.iron });
      m.add(torus(5.6, 0.5, 4, 12, Math.PI), { col: PAL.iron, pos: [0, 9, 0], surf: SURF.iron });
      break;
    case 'sailor doll':
      m.add(ellipsoid(4, 6, 3.4, 10, 8), { col: 0x1f2a4a, pos: [0, 6, 0], surf: SURF.cloth });
      m.add(sphere(3.6, 10, 8), { col: PAL.skinPale, pos: [0, 14, 0], surf: SURF.porcelain });
      m.add(cyl(3.4, 3.6, 1.6, 10), { col: PAL.bone, pos: [0, 17.6, 0], surf: SURF.cloth });
      break;
    case 'paper boat':
      m.add(extrude([[-8, 0], [8, 0], [5, 4], [-5, 4]], 5, 0, 1), { col: 0xe8e0c8, pos: [0, 0, -2.5], surf: SURF.paint });
      m.add(cone(4, 8, 3), { col: 0xe8e0c8, pos: [0, 8, 0], surf: SURF.paint });
      break;
    case 'silk ribbon':
      m.add(tube([[-6, 4, 0], [-2, 8, 2], [2, 4, -2], [6, 8, 0]], 1.1, 4, 12), { col: 0xc83a6a, surf: SURF.velvet });
      m.add(sphere(2, 8, 6), { col: 0xc83a6a, pos: [0, 6, 0], surf: SURF.velvet });
      break;
    case 'seahorse charm':
      m.add(tube([[0, 2, 0], [2, 6, 0], [0, 10, 0], [2, 14, 0], [4, 15, 0]], (u) => 1.6 - u * 0.6, 5, 10), { col: PAL.gold, surf: SURF.gold });
      m.add(torus(1.6, 0.4, 4, 8), { col: PAL.gold, pos: [0, 17, 0], surf: SURF.gold });
      break;
    case 'jacks':
      for (let k = 0; k < 3; k++) {
        const x = (k - 1) * 7;
        for (const r of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2]] as V3[]) {
          m.add(cyl(0.7, 0.7, 8, 5), { col: 0xd8d0c0, pos: [x, 4, (k % 2) * 4], rot: r, surf: SURF.iron });
        }
      }
      m.add(sphere(3, 10, 8), { col: 0xb8262a, pos: [12, 3, 3], surf: SURF.rubber });
      break;
    case 'kite':
      m.add(extrude([[0, 0], [6, 9], [0, 22], [-6, 9]], 0.4, 0, 1), { col: 0xd8a830, pos: [0, 4, 0], surf: SURF.canvas });
      m.add(tube([[0, 4, 0], [2, 0, 1], [-1, -6, 0]], 0.3, 3, 6), { col: PAL.bone, surf: SURF.cloth });
      break;
  }
  return m.build({ ao: 0 });
}

export class BoardwalkQuest {
  private group = new THREE.Group();
  private mat = actorMaterial({ dither: true, detail: true, emitBoost: 2.4 });
  /** the keepsakes: one batch each (shelf copies, prizes at the games, the portholes' contents) */
  private keep: ActorBatch[];
  /** brass engravings over the portholes (a darker copy of the keepsake) */
  private engr: ActorBatch[];
  private conch: THREE.Mesh;
  private ship: THREE.Mesh;
  private bell: THREE.Group;
  private lamps: StaticBatch;
  private claw: THREE.Mesh;
  private float: THREE.Mesh;
  private rod: THREE.Mesh;
  private chain: Strand;
  /** the 1933 photograph on its easel in the Gift Shop, painted with tonight's four keepsakes */
  private photo: Photograph;
  private glowF: Frame | null = null;
  /** the call sign the lighthouse is flashing: its pattern, length and when it began (render time) */
  private call: { bits: number; len: number; t0: number } | null = null;

  constructor(root: THREE.Object3D) {
    root.add(this.group);
    const mk = (geo: THREE.BufferGeometry, n: number, emit = 0) => {
      const b = new ActorBatch(geo, actorMaterial({ dither: true, detail: true, emitBoost: 2.2 + emit }), n, { shadow: false });
      b.rim = [0, 0, 0, 0];
      this.group.add(b.mesh);
      return b;
    };
    this.keep = KEEPSAKES.map((_, i) => mk(keepsakeModel(i), 8, 0.6));
    this.engr = KEEPSAKES.map((_, i) => mk(keepsakeModel(i), 4));
    const pm = new ModelBuilder();
    for (let k = 0; k < 4; k++) {
      const h = S.portholes[k];
      pm.add(cyl(26, 26, 2, 18), { col: weather(0x8a6a34, 0.45, 0.2, 0x3f6a5a), pos: [h.x, 118, h.y - 70], rot: [Math.PI / 2 - 0.35, 0, 0], surf: SURF.brass });
    }
    const plates = new THREE.Mesh(pm.build({ ao: 0 }), this.mat);
    plates.frustumCulled = false;
    this.group.add(plates);
    const one = (geo: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(geo, this.mat);
      m.frustumCulled = false;
      m.visible = false;
      this.group.add(m);
      return m;
    };
    const cm = new ModelBuilder();
    cm.add(cone(9, 26, 9), { col: 0xe8c0a0, rot: [0, 0, -1.3], surf: SURF.porcelain });
    cm.add(ellipsoid(8, 6, 7, 10, 8), { col: 0xf0d8c0, pos: [-8, 2, 0], surf: SURF.porcelain });
    cm.add(ellipsoid(5, 3, 5, 8, 6), { col: 0xc87a6a, pos: [-10, 4, 3], surf: SURF.skin });
    this.conch = one(cm.build({ ao: 0 }));
    this.ship = one(galaQueenGeometry());
    // the founder's bell: bronze, barnacled, a crack down one side
    this.bell = new THREE.Group();
    this.group.add(this.bell);
    const bm = new ModelBuilder();
    bm.add(cyl(14, 24, 34, 18, true), { col: weather(0x6a5a2a, 0.5, 0.15, 0x3f6a5a), pos: [0, 17, 0], surf: SURF.brass });
    bm.add(sphere(14, 14, 8), { col: weather(0x6a5a2a, 0.5, 0.15, 0x3f6a5a), pos: [0, 34, 0], scale: [1, 0.5, 1], surf: SURF.brass });
    bm.add(torus(24, 2.4, 6, 20), { col: weather(0x7a6a3a, 0.4), pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.brass });
    bm.add(torus(4, 1.6, 6, 10), { col: PAL.iron, pos: [0, 42, 0], surf: SURF.iron });
    bm.add(sphere(4, 8, 6), { col: PAL.iron, pos: [0, 4, 0], surf: SURF.iron });
    for (let k = 0; k < 10; k++) bm.add(cone(1.4, 2.6, 6), { col: 0xcfc6b0, pos: [Math.cos(k) * 18, 10 + (k % 3) * 6, Math.sin(k) * 18], surf: SURF.bone });
    const bell = new THREE.Mesh(bm.build({ ao: 0.2 }), this.mat);
    bell.frustumCulled = false;
    this.bell.add(bell);
    this.bell.visible = false;
    // the four tide lamps: iron posts with a glass lantern, dark until lit
    const lm = new ModelBuilder();
    lm.add(cyl(3, 4, 110, 8), { col: PAL.iron, pos: [0, 55, 0], surf: SURF.iron });
    lm.add(box(18, 22, 18), { col: 0x1a2020, pos: [0, 120, 0], surf: SURF.glass });
    lm.add(cone(13, 12, 4), { col: PAL.iron, pos: [0, 137, 0], rot: [0, Math.PI / 4, 0], surf: SURF.iron });
    lm.add(cyl(9, 11, 6, 8), { col: PAL.iron, pos: [0, 3, 0], surf: SURF.iron });
    this.lamps = new StaticBatch(lm.build({ ao: 0.2 }), actorMaterial({ dither: true, detail: true, emitBoost: 2.2 }), 4, { shadow: true });
    this.group.add(this.lamps.mesh);
    for (const L of S.lamps) this.lamps.add(L.x, L.y - 30, 0, 0, 1);
    this.lamps.freeze();
    // the Crane's claw, the float, the rod
    const kl = new ModelBuilder();
    kl.add(cyl(0.6, 0.6, 30, 4), { col: PAL.iron, pos: [0, 15, 0], surf: SURF.iron });
    for (let k = 0; k < 3; k++) kl.add(tube([[0, 0, 0], [Math.cos((k * Math.PI * 2) / 3) * 6, -4, Math.sin((k * Math.PI * 2) / 3) * 6], [Math.cos((k * Math.PI * 2) / 3) * 3, -9, Math.sin((k * Math.PI * 2) / 3) * 3]], 0.9, 4, 6), { col: PAL.brass, surf: SURF.brass });
    this.claw = one(kl.build({ ao: 0 }));
    const fm = new ModelBuilder();
    fm.add(sphere(4, 10, 8), { col: 0xe8e0d0, pos: [0, 2, 0], surf: SURF.paint });
    fm.add(sphere(4.1, 10, 8), { col: 0xb8262a, pos: [0, 4.5, 0], scale: [1, 0.5, 1], surf: SURF.paint });
    fm.add(cyl(0.5, 0.5, 6, 4), { col: PAL.ink, pos: [0, 9, 0], surf: SURF.paint });
    this.float = one(fm.build({ ao: 0 }));
    const rm = new ModelBuilder();
    rm.add(cyl(0.8, 1.6, 110, 6), { col: PAL.woodDark, pos: [0, 55, 0], surf: SURF.wood });
    rm.add(cyl(4, 4, 4, 10), { col: PAL.iron, pos: [0, 12, 3], rot: [0, 0, Math.PI / 2], surf: SURF.iron });
    this.rod = one(rm.build({ ao: 0 }));
    this.chain = new Strand(this.group, this.mat, 8, 1.8);
    this.photo = new Photograph(PHOTO.w, PHOTO.h);
    this.photo.mesh.position.set(SHOP_FIX.photo.x, PHOTO.cy + 0.4 * Math.sin(PHOTO.lean), SHOP_FIX.photo.y + PHOTO.cz + 0.4 * Math.cos(PHOTO.lean));
    this.photo.mesh.rotation.x = -PHOTO.lean;
    this.group.add(this.photo.mesh);
  }

  /** The Crane's claw at rest, up in its front corner over the prize chute. */
  private parkClaw(): void {
    this.claw.visible = true;
    this.claw.scale.setScalar(1.8);
    this.claw.position.set(ARCADE_FIX.crane.x + 30, 160, ARCADE_FIX.crane.y + 24);
  }

  /** The lighthouse flashes the call sign (and the app sounds it). */
  playCall(bits: number, len: number, now: number): void {
    this.call = { bits, len, t0: now };
  }

  /** How bright the lighthouse lens burns right now: 1 normally, the call sign's pattern while it plays. */
  lensK(now: number): number {
    if (!this.call) return 1;
    let t = now - this.call.t0 - 0.4;
    for (let k = 0; k < this.call.len; k++) {
      const long = (this.call.bits >> k) & 1;
      const d = long ? 0.9 : 0.35;
      if (t >= 0 && t < d) return 3;
      t -= d + 0.35;
    }
    if (t > 0) this.call = null;
    return 0.25;
  }

  update(g: Game, r: GameRenderer3D, dt: number): void {
    const ch = g.quests?.get<SummersEndChain>('summers_end');
    this.group.visible = !!ch;
    if (!ch) return;
    const t = r.time, st = ch.stage;
    const glowF = (this.glowF ??= r.assets.atlas.get('fx_glow_0'));
    const G = r.glow;
    const halo = (x: number, y: number, h: number, s: number, c: [number, number, number], a: number) => G.draw(glowF, x, y, h, s, s, 0, c[0], c[1], c[2], a);
    // ---- the conch: at low tide only, half in the wet sand, glinting
    const cs = ch.conchSpot();
    this.conch.visible = st === SE.Conch && isLowTide(g.time);
    if (this.conch.visible) {
      this.conch.position.set(cs.x, 2, cs.y);
      this.conch.rotation.set(0, 0.6, 0.2);
      if (Math.sin(t * 2.3) > 0.6) halo(cs.x, cs.y, 14, 0.35, [1, 0.9, 0.8], 0.6);
    }
    // ---- the keepsakes: souvenirs on the shelves, prizes at the games, the portholes' contents
    for (const b of this.keep) b.begin();
    for (const b of this.engr) b.begin();
    this.photo.show(ch.keepsakes);
    if (st <= SE.Photograph) {
      // the eight look-alikes stand on the stands' front tier, each turned to show its shape
      S.shelf.forEach(([x, y], i) => {
        if (ch.taken & (1 << i)) return;
        this.keep[i].add(x, y - 27, 36.5, KEEP_YAW[i], 2.4);
      });
    }
    if (st === SE.Photograph && ch.photoSeen) {
      // the photograph remembers: her four things float in front of the easel
      let k = 0;
      for (let i = 0; i < KEEPSAKES.length; i++) {
        if (!(ch.keepsakes & (1 << i))) continue;
        this.keep[i].add(SHOP_FIX.photo.x - 66 + k * 44, SHOP_FIX.photo.y + 112, 50 + Math.sin(t * 1.5 + k) * 4, Math.sin(t * 0.8 + k) * 0.5, 2.2);
        k++;
      }
      halo(SHOP_FIX.photo.x, SHOP_FIX.photo.y + 20, PHOTO.cy, 1.6, [1, 0.85, 0.6], 0.3);
    }
    if (st === SE.Games) {
      const prizes: [number, number, number][] = [[S.gallery.x, S.gallery.y - 120, 60], [S.crane.x, S.crane.y - 70, 26], [0, 0, 0], [S.brake.x, S.brake.y - 30, 70]];
      for (let game = 0; game < 4; game++) {
        if (ch.won & (1 << game)) continue;
        const i = ch.keepsakeFor(game);
        if (game === 2) {
          // the Sea Wheel: her keepsake rides the car with the green lantern
          const p = Rides.gondolaAt(ch.greenCar, g.time);
          this.keep[i].add(p[0], p[1] + 34, p[2] - 30, t, 1.4);
          halo(p[0], p[1] + 34, p[2] - 4, 0.8, [0.4, 1, 0.5], 0.85);
          if (wheelFromBottom(ch.greenCar, g.time) < S.wheel.window) halo(S.wheel.x, S.wheel.y - 40, 40, 1.2, [0.4, 1, 0.5], 0.4);
          continue;
        }
        const [px, py, ph] = prizes[game];
        this.keep[i].add(px, py, ph + Math.sin(t * 2 + game) * 3, t * 0.8, 1.4);
        halo(px, py, ph + 10, 0.7, [1, 0.85, 0.5], 0.35);
      }
      // the Crane's claw swinging over its prize (it's over it twice a swing)
      if (!(ch.won & 2)) {
        const ph = (g.time / S.crane.period) * Math.PI * 2;
        this.claw.visible = true;
        this.claw.scale.setScalar(1.8);
        this.claw.position.set(S.crane.x + Math.sin(ph) * 34, 150, S.crane.y - 70);
        halo(S.crane.x + Math.sin(ph) * 34, S.crane.y - 70, 140, 0.4, [1, 0.9, 0.6], 0.5);
      } else this.parkClaw();
      // the brake lamp warms as the train comes home
      if (!(ch.won & 8)) {
        const tr = trainU(g.time);
        const k = tr.dwelling ? 0 : Math.max(0, (tr.u - 0.85) / 0.15);
        halo(S.brake.x, S.brake.y - 10, 60, 0.5 + 0.6 * k, [1, 0.4 + 0.5 * k, 0.3], 0.3 + 0.6 * k);
      }
    } else this.parkClaw();
    // Madame Marina's crystal stirs while the night's first question is still unasked
    if (st === SE.Conch) halo(ARCADE_FIX.marina.x, ARCADE_FIX.marina.y + 14, 90, 0.5 + 0.08 * Math.sin(t * 2.1), [0.55, 1, 0.9], 0.35);
    // the wreck: brass engravings over the portholes always; her keepsakes in them once the games are won
    S.portholes.forEach((h, k) => {
      // the engraving sits on a brass plate on the hull above the porthole, big enough to read from the sand
      const eng = ch.keepsakeFor(ch.engraved[k]);
      this.engr[eng].add(h.x, h.y - 60, 92, 0, 2.4);
      if (st >= SE.Wreck) {
        const i = ch.keepsakeFor(ch.holes[k]);
        this.keep[i].add(h.x, h.y - 20, 30, 0.2, 2.2);
      }
    });
    for (const b of this.engr) for (let i = 0; i < b.count; i++) b.tint(i, 0.55, 0.42, 0.25, 1);
    for (const b of [...this.keep, ...this.engr]) b.end();
    // ---- the rod, the float and the bubbles
    const holder = ch.rodBy !== 255 ? g.players[ch.rodBy] : undefined;
    this.rod.visible = st === SE.Key;
    if (this.rod.visible) {
      if (holder) {
        this.rod.position.set(holder.x + 14, 40, holder.y);
        this.rod.rotation.set(0.5, 0, -0.5);
      } else {
        this.rod.position.set(PIER_FIX.rod.x, 0, PIER_FIX.rod.y - 10);
        this.rod.rotation.set(0, 0, 0.3);
      }
    }
    this.float.visible = st === SE.Key && ch.cast > 0;
    if (this.float.visible) {
      const bite = ch.cast === 2;
      this.float.position.set(S.fishing.x, -38 - (bite ? 6 + Math.abs(Math.sin(t * 22)) * 5 : Math.sin(t * 2) * 2), S.fishing.y + 90);
    }
    if (st === SE.Key && Math.random() < dt * 4) r.fx.handle([{ type: 'spark', x: S.fishing.x + (Math.random() - 0.5) * 40, y: S.fishing.y + 90 + (Math.random() - 0.5) * 30, a: 1, b: 0, c: 0, style: 'splash' }]);
    // ---- the Gala Queen at the pier, St. Elmo's fire on her bow
    this.ship.visible = st >= SE.GalaQueen && st <= SE.Account;
    if (this.ship.visible) {
      const sx = PIER_FIX.berth.x + 480, sy = PIER_FIX.berth.y + 60;
      this.ship.position.set(sx, -46 + Math.sin(t * 0.6) * 3, sy);
      this.ship.rotation.set(0, Math.PI / 2, Math.sin(t * 0.4) * 0.02);
      this.ship.scale.setScalar(0.9);
      if (st === SE.GalaQueen && ch.fireBy === 255) halo(S.berth.x + 40, S.berth.y, 110, 1.2 + 0.2 * Math.sin(t * 7), [0.45, 0.9, 1], 0.9);
    }
    const fireP = ch.fireBy !== 255 ? g.players[ch.fireBy] : undefined;
    if (st === SE.GalaQueen && fireP) {
      const k = Math.min(1, ch.fireT / 20);
      halo(fireP.x, fireP.y, 170 + Math.sin(t * 9) * 4, 0.7 + 0.4 * k, [0.45, 0.9, 1], 0.6 + 0.3 * k);
    }
    S.lamps.forEach((L, i) => {
      if (ch.lit & (1 << i)) halo(L.x, L.y - 30, 120, 1.1 + 0.1 * Math.sin(t * 5 + i), [0.45, 0.9, 1], 0.8);
    });
    // ---- the founder's bell: in the mud, winched up, hanging from the hoist, then following its ringer
    this.bell.visible = st >= SE.LowWater && st <= SE.Account;
    this.chain.hide();
    if (this.bell.visible) {
      const hookX = PIER_FIX.crane.x + 300, hookY = PIER_FIX.crane.y, hookH = 134;
      const ringer = ch.bellBy !== 255 ? g.players[ch.bellBy] : undefined;
      if (st === SE.Account && ringer) {
        // a ghost of it hangs at its ringer's shoulder
        this.bell.position.set(ringer.x - 30, 120 + Math.sin(t * 2) * 6, ringer.y);
        this.bell.scale.setScalar(0.55);
        this.bell.rotation.set(Math.sin(t * 1.4) * 0.15, 0, 0);
      } else if (st >= SE.Ledger) {
        this.bell.position.set(hookX, hookH - 60, hookY);
        this.bell.scale.setScalar(1.3);
        this.bell.rotation.set(Math.sin(t * 0.8) * 0.06, 0, 0);
        this.chain.set([[hookX, hookH + 100, hookY], [hookX, hookH - 6, hookY]]);
      } else {
        const k = st === SE.Bell ? ch.bellT / S.bell.hold : 0;
        const bed = seabedHeight(Math.max(0, waterDepth(S.bell.x, S.bell.y)));
        const y = bed - 20 + k * (hookH - 60 - bed + 20);
        this.bell.position.set(S.bell.x, y, S.bell.y);
        this.bell.scale.setScalar(1.3);
        this.bell.rotation.set(0.5 * (1 - k), 0, 0.3 * (1 - k));
        if (st === SE.Bell) this.chain.set([[hookX, hookH + 100, hookY], [S.bell.x, y + 56, S.bell.y]]);
      }
    }
  }

  addLights(g: Game): void {
    const ch = g.quests?.get<SummersEndChain>('summers_end');
    if (!ch) return;
    const st = ch.stage;
    if (st === SE.Marina) pool.add(S.marina.x, S.marina.y - 60, 220, 1.1, 0.4, 1, 0.9, 120, 1.4);
    // the wreck catches the moon while her portholes are waiting for their keepsakes
    if (st === SE.Wreck) pool.add(S.portholes[1].x + 65, S.portholes[1].y - 60, 420, 0.9, 0.7, 0.85, 1, 200, 1.6);
    if (st === SE.GalaQueen) {
      const f = ch.fireBy !== 255 ? g.players[ch.fireBy] : undefined;
      if (f) pool.add(f.x, f.y, 260, 1.1, 0.45, 0.9, 1, 170, 2);
      else pool.add(S.berth.x, S.berth.y, 240, 1, 0.45, 0.9, 1, 110, 1.5);
    }
    S.lamps.forEach((L, i) => {
      if (ch.lit & (1 << i)) pool.add(L.x, L.y - 30, 240, 1, 0.45, 0.9, 1, 120, 1.2);
    });
  }
}
