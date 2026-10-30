// World renderer: orthographic top-down camera over a y-sorted 2.5D scene. Reads simulation state
// (never mutates it), interpolates positions between fixed ticks, and draws every layer.

import * as THREE from 'three';
import { clamp, lerp } from '../core/math';
import { LIGHTS, MAP_HALF, PROPS, SEA_Y, STRING_LIGHTS, TILT_A_WHIRL } from '../data/map';
import { ENEMY_ART } from './art/enemies';
import { PROP_ART } from './art/props';
import type { Assets } from './assets';
import type { Frame } from './atlas';
import { FxSystem } from './fx';
import { Ground } from './ground';
import { LightRig } from './lights';
import { PostFx } from './post';
import { ShapeBatch } from './shapes';
import { SpriteLayer } from './sprites';
import type { Game } from '../sim/game';
import type { Enemy, Hazard } from '../sim/entities';
import type { BossBase } from '../sim/bosses/boss';
import type { TentBoss } from '../sim/bosses/tent';
import type { FerrisBoss } from '../sim/bosses/ferris';
import type { PuppetBoss } from '../sim/bosses/puppet';
import type { RingmasterBoss } from '../sim/bosses/ringmaster';
import { FERRIS_HOME } from '../sim/bosses/ferris';

export const VIEW_H = 1000; // world units visible vertically

/** Depth from sim y so southern things draw in front (y-sort through the depth buffer). */
function zOf(y: number): number {
  return 0.1 + ((y + 3000) / 6000) * 0.8;
}

const DANGER: [number, number, number] = [1, 0.29, 0.16];
const CAUTION: [number, number, number] = [1, 0.82, 0.25];

export interface RenderSettings {
  highContrast: boolean;
  reducedFlash: boolean;
  shake: number;
  damageNumbers: boolean;
  quality: 'low' | 'medium' | 'high';
}

export class GameRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.OrthographicCamera;
  lights = new LightRig();
  ground: Ground;
  post: PostFx;
  fx: FxSystem;
  flat: SpriteLayer;
  shadows: SpriteLayer;
  world: SpriteLayer;
  pickupsL: SpriteLayer;
  proj: SpriteLayer;
  fxNormal: SpriteLayer;
  fxAdd: SpriteLayer;
  bullets: SpriteLayer;
  overhead: SpriteLayer;
  numbers: SpriteLayer;
  teleFill: ShapeBatch;
  zoneShapes: ShapeBatch;
  addShapes: ShapeBatch;
  teleLine: ShapeBatch;
  wireShapes: ShapeBatch;
  camX = 0;
  camY = 0;
  time = 0;
  settings: RenderSettings = { highContrast: false, reducedFlash: false, shake: 1, damageNumbers: true, quality: 'high' };
  private f: (k: string) => Frame;
  private viewW = 1600;
  private pixelRatio = 1;
  dawn = 0;
  private enemyFrames = new Map<string, Frame[]>();

  constructor(private canvas: HTMLCanvasElement, private assets: Assets) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x07060c);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.OrthographicCamera(-800, 800, 500, -500, -10, 10);
    this.camera.position.z = 5;
    const tex = assets.atlas.textures;
    const A = assets.atlas;
    this.f = (k: string) => A.get(k);
    this.ground = new Ground(this.lights);
    this.scene.add(this.ground.mesh);
    this.flat = new SpriteLayer(tex, 64, 'alpha', this.lights, { depthTest: false, order: 1 });
    this.teleFill = new ShapeBatch(40000, false, 2);
    this.zoneShapes = new ShapeBatch(30000, false, 3);
    this.shadows = new SpriteLayer(tex, 1200, 'alpha', this.lights, { lit: false, depthTest: false, order: 4 });
    this.world = new SpriteLayer(tex, 2600, 'cutout', this.lights, { minLight: 0.5, order: 5 });
    this.pickupsL = new SpriteLayer(tex, 900, 'cutout', this.lights, { lit: false, order: 5 });
    this.proj = new SpriteLayer(tex, 1400, 'alpha', this.lights, { lit: false, depthTest: false, order: 6 });
    this.fxNormal = new SpriteLayer(tex, 1600, 'alpha', this.lights, { lit: true, minLight: 0.55, depthTest: false, order: 7 });
    this.addShapes = new ShapeBatch(60000, true, 8);
    this.fxAdd = new SpriteLayer(tex, 1800, 'add', this.lights, { lit: false, depthTest: false, order: 9 });
    this.bullets = new SpriteLayer(tex, 1500, 'alpha', this.lights, { lit: false, depthTest: false, order: 10 });
    this.teleLine = new ShapeBatch(30000, false, 11);
    this.wireShapes = new ShapeBatch(8000, false, 12);
    this.overhead = new SpriteLayer(tex, 600, 'add', this.lights, { lit: false, depthTest: false, order: 13 });
    this.numbers = new SpriteLayer(tex, 900, 'alpha', this.lights, { lit: false, depthTest: false, order: 14 });
    for (const l of [this.flat, this.shadows, this.world, this.pickupsL, this.proj, this.fxNormal, this.fxAdd, this.bullets, this.overhead, this.numbers]) l.addTo(this.scene);
    for (const s of [this.teleFill, this.zoneShapes, this.addShapes, this.teleLine, this.wireShapes]) this.scene.add(s.mesh);
    this.fx = new FxSystem(assets);
    this.post = new PostFx();
    // cache enemy walk frames
    for (const id of Object.keys(ENEMY_ART)) {
      const arr: Frame[] = [];
      for (let i = 0; i < 4; i++) arr.push(A.get(`en_${id}_walk${i}`));
      this.enemyFrames.set(id, arr);
    }
  }

  resize(w: number, h: number, pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.viewW = VIEW_H * aspect;
    this.camera.left = -this.viewW / 2;
    this.camera.right = this.viewW / 2;
    this.camera.top = VIEW_H / 2;
    this.camera.bottom = -VIEW_H / 2;
    this.camera.updateProjectionMatrix();
    this.post.resize(w, h);
  }

  get viewWidth(): number {
    return this.viewW;
  }

  /** World → CSS pixel position (for DOM overlays such as off-screen indicators). */
  worldToScreen(x: number, y: number, cssW: number, cssH: number): { x: number; y: number } {
    return { x: ((x - this.camX) / this.viewW + 0.5) * cssW, y: ((y - this.camY) / VIEW_H + 0.5) * cssH };
  }

  snapCamera(x: number, y: number): void {
    this.camX = x;
    this.camY = y;
  }

  // =================================================================== frame
  render(g: Game, alpha: number, dt: number, opts: { menu?: boolean } = {}): void {
    this.time += dt;
    this.fx.reducedFlash = this.settings.reducedFlash;
    this.fx.shakeScale = this.settings.shake;
    this.fx.showNumbers = this.settings.damageNumbers && !opts.menu;
    this.fx.particleBudget = this.settings.quality === 'low' ? 500 : this.settings.quality === 'medium' ? 1000 : 1700;
    this.fx.handle(g.fx.drain());
    this.fx.update(dt);
    const p = g.player;
    const px = lerp(p.px, p.x, alpha), py = lerp(p.py, p.y, alpha);
    // camera: smooth follow with a little look-ahead, clamped so we never see far past the fence
    let lookX = p.vx * 0.12, lookY = p.vy * 0.12;
    // frame an awake boss: bias the camera toward it so its body isn't hidden under the HUD
    for (const b of g.bosses) {
      if (!b.awake || b.dead) continue;
      const lift = b.def.id === 'puppet_king' ? 200 : b.def.id === 'ferris_wheel' ? 60 : b.def.id === 'carnival_tent' ? 170 : 100;
      const dx = b.x - px, dy = b.y - lift - py;
      if (Math.abs(dx) < this.viewW * 0.9 && Math.abs(dy) < VIEW_H * 0.9) {
        lookX += dx * 0.3;
        lookY += dy * 0.42 - 40;
      }
      break;
    }
    const k = 1 - Math.exp(-dt * (opts.menu ? 1.5 : 7));
    this.camX += (px + lookX - this.camX) * k;
    this.camY += (py + lookY - this.camY) * k;
    const mx = MAP_HALF + 120 - this.viewW / 2, myTop = MAP_HALF + 120 - VIEW_H / 2, myBot = SEA_Y + 260 - VIEW_H / 2;
    this.camX = clamp(this.camX, -mx, mx);
    this.camY = clamp(this.camY, -myTop, myBot);
    const cx = this.camX + this.fx.shakeX, cy = this.camY + this.fx.shakeY;
    this.camera.position.set(cx, -cy, 5);
    this.camera.updateMatrixWorld();

    // ---- lighting
    this.updateLighting(g, px, py);
    this.ground.update(this.time);

    for (const l of [this.flat, this.shadows, this.world, this.pickupsL, this.proj, this.fxNormal, this.fxAdd, this.bullets, this.overhead, this.numbers]) l.begin();
    for (const s of [this.teleFill, this.zoneShapes, this.addShapes, this.teleLine, this.wireShapes]) s.begin();

    const vx0 = cx - this.viewW / 2 - 300, vx1 = cx + this.viewW / 2 + 300;
    const vy0 = cy - VIEW_H / 2 - 400, vy1 = cy + VIEW_H / 2 + 300;
    const inView = (x: number, y: number) => x > vx0 && x < vx1 && y > vy0 && y < vy1;

    this.drawProps(g, inView);
    this.drawZones(g, inView);
    this.drawHazards(g);
    this.drawPickups(g, alpha, inView);
    this.drawEnemies(g, alpha, inView);
    for (const b of g.bosses) this.drawBoss(b, alpha);
    this.drawSummons(g, alpha);
    this.drawWeaponsVisuals(g, px, py);
    this.drawPlayer(g, px, py);
    this.drawProjectiles(g, alpha);
    this.drawBullets(g, alpha);
    this.drawOverhead(inView);
    this.fx.draw(this.fxNormal, this.fxAdd, this.addShapes, this.numbers);

    for (const l of [this.flat, this.shadows, this.world, this.pickupsL, this.proj, this.fxNormal, this.fxAdd, this.bullets, this.overhead, this.numbers]) l.end();
    for (const s of [this.teleFill, this.zoneShapes, this.addShapes, this.teleLine, this.wireShapes]) s.end();

    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    // post overlay
    const lowHp = g.player.hp / g.player.stats.maxHp();
    this.post.update({
      time: this.time,
      lowHp: opts.menu ? 0 : clamp(1 - lowHp / 0.3, 0, 1),
      hurt: opts.menu ? 0 : Math.max(0, g.player.hurtFlash / 0.3) * (this.settings.reducedFlash ? 0.3 : 1),
      darkness: g.darkness,
      flash: this.fx.screenFlash,
      flashCol: this.fx.screenFlashCol,
      dawn: this.dawn,
      vignette: opts.menu ? 0.55 : 0.4,
      fog: this.settings.quality === 'low' ? 0 : 1,
      camX: cx,
      camY: cy,
    });
    this.renderer.autoClear = false;
    this.renderer.render(this.post.scene, this.post.camera);
    this.renderer.autoClear = true;
  }

  // =================================================================== lighting
  private updateLighting(g: Game, px: number, py: number): void {
    const L = this.lights;
    L.begin();
    const dark = g.darkness;
    const dawn = this.dawn;
    // ambient: midnight blue-violet → near-black during Lights Out → warm at dawn
    const ar = lerp(lerp(0.56, 0.1, dark), 1.1, dawn);
    const ag = lerp(lerp(0.52, 0.09, dark), 0.92, dawn);
    const ab = lerp(lerp(0.74, 0.18, dark), 0.8, dawn);
    L.setAmbient(ar, ag, ab);
    // player lantern (gameplay-relevant "seen" bubble, doc 02 §3)
    L.add(px, py - 10, 360 + dark * 60, 0.85 + dark * 0.6, 1.0, 0.86, 0.62);
    // boss glows
    for (const b of g.bosses) {
      if (!b.awake || b.dead) continue;
      const c = b.def.id === 'ringmaster' ? (b as RingmasterBoss).demon > 0.5 ? [1, 0.35, 0.15] : [1, 0.75, 0.5] : b.def.id === 'ferris_wheel' ? [1, 0.3, 0.3] : b.def.id === 'puppet_king' ? [0.75, 0.5, 1] : [1, 0.6, 0.35];
      L.add(b.x, b.y - 60, 520, 0.7, c[0], c[1], c[2]);
    }
    this.fx.addLights(L);
    // map lights nearest the camera (flickering), then lamp posts
    const lightsOn = 1 - dark * 0.92;
    const cands: { d: number; i: number }[] = [];
    for (let i = 0; i < LIGHTS.length; i++) {
      const l = LIGHTS[i];
      const d = Math.hypot(l.x - this.camX, l.y - this.camY) - l.r;
      if (d < 1300) cands.push({ d, i });
    }
    cands.sort((a, b) => a.d - b.d);
    for (const c of cands) {
      const l = LIGHTS[c.i];
      const t = this.time * 7 + c.i * 13.1;
      const fl = l.flicker > 0 ? 1 - l.flicker * (Math.sin(t) * 0.5 + 0.5) * (Math.sin(t * 2.7) > 0.6 ? 1 : 0.15) : 1;
      L.add(l.x, l.y, l.r, l.intensity * fl * lightsOn, l.color[0], l.color[1], l.color[2]);
    }
    for (const pr of PROPS) {
      if (pr.kind !== 'lamp') continue;
      if (Math.abs(pr.x - this.camX) > this.viewW * 0.7 || Math.abs(pr.y - this.camY) > VIEW_H * 0.8) continue;
      const fl = (Math.sin(this.time * 9 + pr.x) > 0.93 ? 0.4 : 1) * lightsOn;
      L.add(pr.x, pr.y - 60, 230, 0.55 * fl, 1, 0.8, 0.5);
    }
    L.end();
  }

  // =================================================================== props
  private drawProps(g: Game, inView: (x: number, y: number) => boolean): void {
    const W = this.world;
    for (const pr of PROPS) {
      const art = PROP_ART[pr.kind];
      if (!art) continue;
      if (pr.kind === 'fence_h' || pr.kind === 'rail') {
        const tile = this.f(`prop_${pr.kind}_0`);
        const len = pr.w ?? 120;
        const n = Math.ceil(len / art.w);
        for (let i = 0; i < n; i++) {
          const x = pr.x - len / 2 + art.w * (i + 0.5);
          if (!inView(x, pr.y)) continue;
          W.draw(tile, x, pr.y, zOf(pr.y), 1.02, 1);
        }
        continue;
      }
      if (pr.kind === 'fence_v') {
        const tile = this.f('prop_fence_v_0');
        const len = pr.w ?? 120;
        const n = Math.ceil(len / art.h);
        for (let i = 0; i < n; i++) {
          const y = pr.y - len / 2 + art.h * (i + 0.5);
          if (!inView(pr.x, y)) continue;
          W.draw(tile, pr.x, y, zOf(y), 1, 1.02);
        }
        continue;
      }
      if (!inView(pr.x, pr.y)) continue;
      if (pr.kind === 'tilt_a_whirl') {
        this.flat.draw(this.f('prop_tilt_a_whirl_0'), pr.x, pr.y, 0.05);
        // rotating arms (doc 03 §4 hazard) — sim angle drives the visual
        const arm = this.f('tilt_arm');
        for (let k = 0; k < 2; k++) this.flat.draw(arm, TILT_A_WHIRL.x, TILT_A_WHIRL.y, 0.06, TILT_A_WHIRL.armLen / 280, 1, g.tiltAngle + k * Math.PI);
        continue;
      }
      if (pr.kind === 'trash') {
        this.flat.draw(this.f(`prop_trash_${(pr.variant ?? Math.abs(Math.round(pr.x))) % 3}`), pr.x, pr.y, 0.05);
        continue;
      }
      let v = pr.variant ?? 0;
      if (pr.kind === 'gate_arch') v = pr.x < -100 ? 0 : pr.x > 100 ? 2 : 1;
      if (pr.kind === 'tree_dead') v = Math.abs(Math.round(pr.x / 7)) % 3;
      const key = `prop_${pr.kind}_${v}`;
      if (!this.assets.atlas.has(key)) continue;
      const sway = pr.kind === 'balloon_post' || pr.kind === 'pennant_pole' ? Math.sin(this.time * 1.5 + pr.x) * 0.03 : 0;
      W.draw(this.f(key), pr.x, pr.y, zOf(pr.y), pr.flip ? -1 : 1, 1, sway);
    }
    // Ferris Wheel stand stays at home all night
    W.draw(this.f('ferris_stand'), FERRIS_HOME.x, FERRIS_HOME.y + 190, zOf(FERRIS_HOME.y + 190));
    // boss remains
    for (const r of g.bossRemains) {
      const key = r.id === 'carnival_tent' ? 'tent_wreck' : r.id === 'ferris_wheel' ? 'ferris_wreck' : r.id === 'puppet_king' ? 'pk_wreck' : '';
      if (key && inView(r.x, r.y)) W.draw(this.f(key), r.x, r.y + 30, zOf(r.y + 30));
    }
  }

  private drawOverhead(inView: (x: number, y: number) => boolean): void {
    const S = this.wireShapes;
    const glow = this.f('fx_glow_0');
    for (let i = 0; i < STRING_LIGHTS.length; i++) {
      const [x1, y1, x2, y2] = STRING_LIGHTS[i];
      if (!inView(x1, y1) && !inView(x2, y2)) continue;
      // hang the wire above the ground (lift) with a sag
      const lift = 150;
      const n = 10;
      let lx = x1, ly = y1 - lift;
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const x = lerp(x1, x2, t), y = lerp(y1, y2, t) - lift + Math.sin(t * Math.PI) * 40 + Math.sin(this.time * 1.2 + i) * 3 * Math.sin(t * Math.PI);
        S.line(lx, ly, x, y, 1.4, 0.05, 0.04, 0.06, 0.85);
        if (k < n) {
          const on = Math.sin(this.time * 3 + i * 7 + k * 1.7) > -0.85;
          const col = (k + i) % 3 === 0 ? [1, 0.45, 0.7] : (k + i) % 3 === 1 ? [1, 0.85, 0.4] : [0.45, 0.9, 1];
          if (on) this.overhead.draw(glow, x, y + 4, 0.98, 0.42, 0.42, 0, col[0], col[1], col[2], 0.85);
        }
        lx = x;
        ly = y;
      }
    }
  }

  // =================================================================== zones & hazards
  private drawZones(g: Game, inView: (x: number, y: number) => boolean): void {
    const S = this.zoneShapes;
    const A = this.addShapes;
    for (const z of g.zones) {
      if (!z.alive || !inView(z.x, z.y)) continue;
      const fade = Math.min(1, z.life / 0.5) * Math.min(1, (z.maxLife - z.life) / 0.2 + 0.2);
      switch (z.kind) {
        case 'web': {
          S.circle(z.x, z.y, z.r, 1, 0.55, 0.8, 0.22 * fade, 0.1 * fade);
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + z.x;
            S.line(z.x, z.y, z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r, 1.2, 1, 0.85, 0.95, 0.55 * fade);
          }
          for (const rr of [0.35, 0.65, 0.95]) S.ring(z.x, z.y, z.r * rr - 1.2, z.r * rr + 1.2, 1, 0.85, 0.95, 0.5 * fade, 0.5 * fade);
          break;
        }
        case 'burn':
          A.circle(z.x, z.y, z.r, 1, 0.45, 0.1, 0.35 * fade, 0);
          if (Math.random() < 0.15) this.fxAddFlame(z.x + (Math.random() - 0.5) * z.r, z.y + (Math.random() - 0.5) * z.r);
          break;
        case 'spark':
          A.circle(z.x, z.y, z.r, 0.4, 0.85, 1, 0.3 * fade, 0);
          break;
        case 'sticky_patch':
          S.circle(z.x, z.y, z.r, 1, 0.5, 0.78, 0.45 * fade, 0.25 * fade);
          S.ring(z.x, z.y, z.r - 3, z.r, 0.6, 0.2, 0.4, 0.6 * fade, 0.6 * fade);
          break;
      }
    }
  }

  private fxAddFlame(x: number, y: number): void {
    this.fx.handle([{ type: 'spark', x, y, a: 1, b: 0, c: 0, style: 'fire' }]);
  }

  private drawHazards(g: Game): void {
    const F = this.teleFill, L = this.teleLine, A = this.addShapes;
    const hc = this.settings.highContrast;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 18);
    for (const h of g.hazards) {
      if (!h.alive) continue;
      const tele = h.tele > 0;
      const prog = tele ? 1 - h.tele / Math.max(0.001, h.teleMax) : 1;
      let [r, gg, b] = DANGER;
      if (h.style === 'swarm_lane') [r, gg, b] = CAUTION;
      if (h.safe) {
        this.drawSafe(h);
        continue;
      }
      if (h.dmg <= 0 && !tele && h.style !== 'lane' && h.style !== 'rail') continue;
      const fillA = tele ? (hc ? 0.3 : 0.16) + prog * (hc ? 0.3 : 0.22) : 0.55;
      const lineA = tele ? (hc ? 1 : 0.75) * (0.6 + 0.4 * pulse) : 1;
      switch (h.shape) {
        case 'circle': {
          if (h.style === 'hellfire' || h.style === 'fire_trail') {
            A.circle(h.x, h.y, h.r * 1.2, 1, 0.45, 0.1, 0.5, 0);
            if (Math.random() < 0.25) this.fxAddFlame(h.x + (Math.random() - 0.5) * h.r, h.y + (Math.random() - 0.5) * h.r);
            F.ring(h.x, h.y, h.r - 2, h.r, r, gg, b, 0.6, 0.6);
            break;
          }
          if (h.style === 'roll' || h.style === 'lunge') break; // the boss body is the visual
          if (h.style === 'phantom_wheel' && !tele) {
            const rim = this.f('ferris_rim_1');
            this.world.draw(rim, h.x, h.y, zOf(h.y + 100), 0.55, 0.55, this.time * 9, 1, 0.6, 0.6, 1, 1, 0.3, 0.2, 0.35);
            break;
          }
          if (h.style === 'spotlight') {
            A.circle(h.x, h.y, h.r, 1, 0.95, 0.7, tele ? 0.25 + prog * 0.35 : 0.9, 0.05);
            L.ring(h.x, h.y, h.r - 3, h.r, r, gg, b, lineA, lineA);
            break;
          }
          if (h.style === 'maw') {
            for (let k = 0; k < 3; k++) {
              const rr = ((this.time * 1.5 + k / 3) % 1) * 420;
              A.ring(h.x, h.y, Math.max(0, 420 - rr - 4), 420 - rr, 0.8, 0.9, 1, 0.25, 0.05);
            }
            F.circle(h.x, h.y, h.r, r, gg, b, 0.45, 0.2);
            break;
          }
          if (h.style === 'flail' && !tele) {
            A.ring(h.x, h.y, h.r - 10, h.r, r, gg, b, 0.6, 0.2);
            for (let k = 0; k < 3; k++) {
              const a = this.time * 9 + (k * Math.PI * 2) / 3;
              A.sector(h.x, h.y, h.r * 0.3, h.r, a, 0.3, r, gg, b, 0.35, 0.05);
            }
            break;
          }
          F.circle(h.x, h.y, h.r, r, gg, b, fillA, fillA * 0.7);
          if (tele) {
            // inner disc grows to the rim at impact: the readable "time until it lands"
            F.circle(h.x, h.y, h.r * prog, r, gg, b, 0.25 + 0.2 * prog, 0.35);
            L.ring(h.x, h.y, h.r - (hc ? 4 : 2.5), h.r, r, gg, b, lineA, lineA);
          } else {
            A.circle(h.x, h.y, h.r, 1, 0.7, 0.4, 0.6 * (h.active / h.activeMax), 0);
          }
          break;
        }
        case 'ring': {
          if (tele) break;
          const segs = h.gapHalf > 0;
          if (segs) {
            const a0 = h.angle + h.gapHalf, a1 = h.angle - h.gapHalf + Math.PI * 2;
            F.ring(h.x, h.y, Math.max(0, h.r2), h.r, r, gg, b, 0.7, 0.7, a0, a1);
            A.ring(h.x, h.y, Math.max(0, h.r2), h.r, 1, 0.6, 0.4, 0.35, 0.35, a0, a1);
          } else {
            F.ring(h.x, h.y, Math.max(0, h.r2), h.r, r, gg, b, 0.7, 0.7);
            A.ring(h.x, h.y, Math.max(0, h.r2), h.r, 1, 0.6, 0.4, 0.3, 0.3);
          }
          break;
        }
        case 'annulus': {
          if (h.style === 'fire_ring' && !tele) {
            A.ring(h.x, h.y, Math.max(0, h.r2), h.r, 1, 0.42, 0.08, 0.5, 0.1);
            for (let k = 0; k < 6; k++) {
              const a = Math.random() * Math.PI * 2;
              const d = h.r2 + Math.random() * (h.r - h.r2) * 0.5;
              this.fxAddFlame(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d);
            }
            L.ring(h.x, h.y, Math.max(0, h.r2 - 3), h.r2, r, gg, b, 1, 1);
          } else {
            F.ring(h.x, h.y, Math.max(0, h.r2), h.r, r, gg, b, fillA, fillA * 0.3);
            L.ring(h.x, h.y, Math.max(0, h.r2 - 3), h.r2, r, gg, b, lineA, lineA);
          }
          break;
        }
        case 'line': {
          const w = Math.max(4, h.r2);
          if (tele) {
            const styleA = h.style === 'swarm_lane' ? 0.12 + prog * 0.12 : fillA;
            F.line(h.x, h.y, h.x2, h.y2, w, r, gg, b, styleA, styleA * 0.4);
            // edges + chevrons running along the lane
            this.laneEdges(h, w, r, gg, b, lineA * (h.style === 'swarm_lane' ? 0.6 : 1));
          } else if (h.dmg > 0) {
            const isBar = h.style === 'pole' || h.style === 'crossbar' || h.style === 'spoke';
            if (isBar) {
              F.line(h.x, h.y, h.x2, h.y2, w, 0.25, 0.15, 0.1, 1);
              F.line(h.x, h.y, h.x2, h.y2, w * 0.6, r, gg, b, 0.9);
            } else if (h.style === 'spot_beam') {
              A.line(h.x, h.y, h.x2, h.y2, w, 1, 0.92, 0.6, 0.55, 0);
              L.line(h.x, h.y, h.x2, h.y2, 2.5, r, gg, b, 0.8);
            } else if (h.style === 'string_sweep' || h.style === 'tangle') {
              A.line(h.x, h.y, h.x2, h.y2, w + 4, 1, 0.95, 0.85, 0.9, 0);
              L.line(h.x, h.y, h.x2, h.y2, 2, r, gg, b, 1);
            } else {
              const fade = h.active / h.activeMax;
              A.line(h.x, h.y, h.x2, h.y2, w + 6, 1, h.style === 'hellwhip' ? 0.5 : 0.8, 0.4, 0.9 * fade, 0);
              F.line(h.x, h.y, h.x2, h.y2, w * 0.5, r, gg, b, fade);
            }
          }
          break;
        }
        case 'sector':
          F.sector(h.x, h.y, h.r2, h.r, h.angle, h.half, r, gg, b, fillA, fillA * 0.5);
          break;
      }
    }
  }

  private laneEdges(h: Hazard, w: number, r: number, g: number, b: number, a: number): void {
    const L = this.teleLine;
    const dx = h.x2 - h.x, dy = h.y2 - h.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy * w, ny = ux * w;
    L.line(h.x + nx, h.y + ny, h.x2 + nx, h.y2 + ny, 2.2, r, g, b, a);
    L.line(h.x - nx, h.y - ny, h.x2 - nx, h.y2 - ny, 2.2, r, g, b, a);
    // chevrons travelling down the lane
    const step = 90;
    const off = (this.time * 260) % step;
    for (let d = off; d < len; d += step) {
      const cx = h.x + ux * d, cy = h.y + uy * d;
      const s = Math.min(w * 0.7, 26);
      L.line(cx - ux * s * 0.6 + nx * 0.5, cy - uy * s * 0.6 + ny * 0.5, cx, cy, 2.4, r, g, b, a * 0.8);
      L.line(cx - ux * s * 0.6 - nx * 0.5, cy - uy * s * 0.6 - ny * 0.5, cx, cy, 2.4, r, g, b, a * 0.8);
    }
  }

  private drawSafe(h: Hazard): void {
    const L = this.teleLine, A = this.addShapes;
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 6);
    if (h.style === 'safe_pocket') {
      A.circle(h.x, h.y, h.r, 0.35, 1, 0.55, 0.3 * pulse, 0.05);
      L.ring(h.x, h.y, h.r - 3, h.r, 0.4, 1, 0.6, 0.9, 0.9);
    } else if (h.style === 'treat_marker') {
      L.ring(h.x, h.y, h.r - 3, h.r, 0.5, 1, 0.55, 0.6 * pulse, 0.6 * pulse);
    } else if (h.style === 'chest_marker') {
      A.circle(h.x, h.y, h.r * 1.6, 1, 0.85, 0.3, 0.25 * pulse, 0);
    } else if (h.style === 'swarm_lane') {
      const w = h.r2;
      const prog = 1 - h.tele / Math.max(0.001, h.teleMax);
      this.teleFill.line(h.x, h.y, h.x2, h.y2, w, CAUTION[0], CAUTION[1], CAUTION[2], 0.1 + prog * 0.12, 0.02);
      this.laneEdges(h, w, CAUTION[0], CAUTION[1], CAUTION[2], 0.55);
    } else if (h.style === 'lane') {
      this.teleFill.line(h.x, h.y, h.x2, h.y2, h.r2, DANGER[0], DANGER[1], DANGER[2], 0.2, 0.05);
    } else if (h.style === 'inhale_warn') {
      for (let k = 0; k < 3; k++) {
        const rr = ((this.time * 1.2 + k / 3) % 1) * h.r;
        L.ring(h.x, h.y, Math.max(0, h.r - rr - 3), h.r - rr, 0.8, 0.9, 1, 0.5, 0.5);
      }
    }
  }

  // =================================================================== pickups
  private drawPickups(g: Game, alpha: number, inView: (x: number, y: number) => boolean): void {
    const W = this.pickupsL, Sh = this.shadows, Add = this.fxAdd;
    const glow = this.f('fx_glow_0');
    const T = [this.f('ticket_0'), this.f('ticket_1'), this.f('ticket_2')];
    for (const pk of g.pickups) {
      if (!pk.alive) continue;
      const x = lerp(pk.px, pk.x, alpha), y = lerp(pk.py, pk.y, alpha);
      if (!inView(x, y)) continue;
      const bob = Math.sin(this.time * 4 + pk.x * 0.1) * 3;
      switch (pk.kind) {
        case 'ticket': {
          const tier = pk.value >= 8 ? 2 : pk.value >= 3 ? 1 : 0;
          const s = tier === 2 ? 1.25 : tier === 1 ? 1.05 : 0.9;
          W.draw(T[tier], x, y - 8 + bob * 0.5, zOf(y - 30), s, s, Math.sin(this.time * 3 + pk.y) * 0.3);
          if (tier === 2) Add.draw(glow, x, y - 8, 0.97, 0.5, 0.5, 0, 1, 0.4, 0.85, 0.5);
          break;
        }
        case 'bank': {
          const s = 1 + Math.min(1.2, pk.value / 400) + Math.sin(this.time * 8) * 0.08;
          Add.draw(glow, x, y - 14, 0.97, s * 1.4, s * 1.4, 0, 1, 0.35, 0.85, 0.8);
          W.draw(this.f('bank'), x, y - 14 + bob, zOf(y - 30), s, s, Math.sin(this.time * 2) * 0.2);
          break;
        }
        case 'food':
        case 'funnel':
          Add.draw(glow, x, y - 10, 0.97, 1.1, 1.1, 0, 0.4, 1, 0.45, 0.6 + 0.3 * Math.sin(this.time * 6));
          Sh.draw(this.f('shadow'), x, y + 4, 0.06, 0.5, 0.5, 0, 1, 1, 1, 0.5);
          W.draw(this.f(pk.kind), x, y - 12 + bob, zOf(y - 30));
          break;
        case 'golden':
          Add.draw(glow, x, y - 10, 0.97, 1.8 + Math.sin(this.time * 5) * 0.2, 1.8, 0, 1, 0.85, 0.35, 0.9);
          W.draw(this.f('golden'), x, y - 14 + bob, zOf(y - 30), 1, 1, Math.sin(this.time * 2) * 0.3);
          break;
        case 'chest':
          Add.draw(glow, x, y - 22, 0.97, 1.6, 1.6, 0, 1, 0.8, 0.4, 0.55 + 0.25 * Math.sin(this.time * 4));
          Sh.draw(this.f('shadow'), x, y + 2, 0.06, 0.9, 0.7, 0, 1, 1, 1, 0.6);
          W.draw(this.f('chest'), x, y + Math.min(0, Math.sin(this.time * 6)) * 6, zOf(y), 1 + Math.max(0, Math.sin(this.time * 6)) * 0.05, 1);
          break;
      }
    }
  }

  // =================================================================== enemies
  private drawEnemies(g: Game, alpha: number, inView: (x: number, y: number) => boolean): void {
    const W = this.world, Sh = this.shadows;
    const shadow = this.f('shadow');
    for (const e of g.active) {
      if (!e.alive) continue;
      const x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha);
      if (!inView(x, y)) continue;
      const id = e.def.id;
      if (id === 'roller_coaster_snake') {
        this.drawSnake(e, x, y);
        continue;
      }
      const art = ENEMY_ART[id];
      if (!art) continue;
      let frame: Frame;
      let sx = e.face * e.scale, sy = e.scale;
      let yo = 0;
      const spawnPop = Math.min(1, e.spawnT * 4);
      if (id === 'whack_a_mole' && e.hidden) {
        frame = this.f('en_whack_a_mole_alt');
        sx = sy = 0.9;
        W.draw(frame, x, y, zOf(y), sx, sy * (0.9 + 0.1 * Math.sin(this.time * 20)));
        continue;
      }
      if (e.windup > 0 && (e.state === 1 || e.def.behavior === 'formation' || e.def.behavior === 'spawner' || e.def.behavior === 'brute' || e.def.behavior === 'ambusher')) {
        frame = this.f(`en_${id}_windup`);
        // telegraph squash/shake
        sx *= 1 + Math.sin(this.time * 40) * 0.04 * e.windup;
        sy *= 1 - 0.08 * e.windup;
      } else if (id === 'jack_in_the_box' && e.state === 2) {
        frame = this.f('en_jack_in_the_box_alt');
        yo = -Math.sin(Math.min(1, 1 - e.t / 0.45) * Math.PI) * 60;
      } else {
        const fr = this.enemyFrames.get(id)!;
        frame = fr[Math.floor(e.animT * 8) & 3];
      }
      // squash & stretch bob
      const bob = 1 + Math.sin(e.animT * 10 + e.idx) * 0.035;
      sy *= bob * spawnPop;
      sx *= (2 - bob) * spawnPop;
      if (e.def.behavior === 'flyby') {
        yo -= 10;
      }
      const ds = e.def.radius * 2.2 / (art.w * 0.55);
      const scale = Math.max(0.75, Math.min(1.4, ds));
      sx *= scale;
      sy *= scale;
      // statuses
      let tr = 1, tg = 1, tb = 1;
      let fr_ = 1, fg = 1, fb = 1, fa = e.flash * 0.85;
      if (e.frozenT > 0) {
        tr = 0.6; tg = 0.85; tb = 1.25;
      } else if (e.stickyT > 0) {
        tr = 1.15; tg = 0.75; tb = 0.95;
      }
      if (e.burnT > 0 && Math.sin(this.time * 30 + e.idx) > 0.5) {
        fr_ = 1; fg = 0.5; fb = 0.1; fa = Math.max(fa, 0.35);
      }
      if (e.invuln) fa = Math.max(fa, 0.3);
      Sh.draw(shadow, x, y + 2, 0.06, e.r * e.scale / 22, e.r * e.scale / 22, 0, 1, 1, 1, e.def.behavior === 'flyby' ? 0.3 : 0.55);
      const z = zOf(y);
      if (e.elite) {
        // golden rim: a slightly larger silhouette pass behind the sprite
        const pulse = 0.75 + 0.25 * Math.sin(this.time * 6);
        W.draw(frame, x, y + yo + 2, z - 0.00002, sx * 1.12, sy * 1.1, 0, 1, 1, 1, 1, 1, 0.82 * pulse, 0.2, 1);
      }
      W.draw(frame, x, y + yo, z, sx, sy, e.def.behavior === 'flyby' ? Math.atan2(e.dirY, e.dirX) * 0.15 : 0, tr, tg, tb, 1, fr_, fg, fb, fa);
      if (e.elite) {
        // little crown
        this.fxAdd.draw(this.f('fx_star_0'), x, y + yo - art.h * sy * 0.95, 0.97, 1.1, 1.1, this.time * 2, 1, 0.85, 0.3, 0.9);
      }
      if (e.shield > 0) this.addShapes.ring(x, y - art.h * sy * 0.4, art.w * 0.45, art.w * 0.45 + 3, 0.5, 0.8, 1, 0.6, 0.3);
    }
  }

  private drawSnake(e: Enemy, x: number, y: number): void {
    if (e.state === 0 || e.state === 1) return; // off-screen or telegraph (the rail is drawn by hazards)
    const W = this.world, Sh = this.shadows;
    const head = this.f(e.windup > 0 ? 'en_roller_coaster_snake_windup' : `en_roller_coaster_snake_walk${Math.floor(this.time * 10) & 3}`);
    const seg = this.f('snake_seg');
    const segs = 9, spacing = 30;
    const ang = Math.atan2(e.dirY, e.dirX);
    const face = Math.cos(ang) >= 0 ? 1 : -1;
    const rot = face > 0 ? ang * 0.35 : (ang - Math.PI) * 0.35;
    for (let i = segs; i >= 1; i--) {
      const d = i * spacing;
      if (d > e.n1) continue;
      const sx = x - e.dirX * d, sy = y - e.dirY * d + Math.sin(this.time * 14 - i) * 2;
      Sh.draw(this.f('shadow'), sx, sy + 4, 0.06, 0.8, 0.6, 0, 1, 1, 1, 0.5);
      W.draw(seg, sx, sy, zOf(sy), face, 1, rot, 1, 1, 1, 1, 1, 1, 1, e.flash * 0.8);
    }
    Sh.draw(this.f('shadow'), x, y + 4, 0.06, 0.9, 0.7, 0, 1, 1, 1, 0.5);
    W.draw(head, x, y, zOf(y), face, 1, rot, 1, 1, 1, 1, 1, 1, 1, e.flash * 0.8);
  }

  // =================================================================== bosses
  private drawBoss(b: BossBase, alpha: number): void {
    const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
    switch (b.def.id) {
      case 'carnival_tent': return this.drawTent(b as TentBoss, x, y);
      case 'ferris_wheel': return this.drawFerris(b as FerrisBoss, x, y);
      case 'puppet_king': return this.drawPuppet(b as PuppetBoss, x, y);
      case 'ringmaster': return this.drawRingmaster(b as RingmasterBoss, x, y);
    }
  }

  private bossFlash(b: BossBase): number {
    return b.flash * 0.6 + (b.transitioning ? 0.4 + 0.4 * Math.sin(this.time * 30) : 0);
  }

  private drawTent(b: TentBoss, x: number, y: number): void {
    if (b.removed) return;
    const W = this.world;
    const P = b.pose;
    const awake = b.awake;
    const collapse = P.collapse ?? 0;
    const breathe = 1 + Math.sin(this.time * (awake ? 2.4 : 0.8)) * (awake ? 0.025 : 0.01);
    const lift = awake && !b.dead ? 70 + Math.sin(this.time * 3) * 4 : b.dead ? 70 * (1 - Math.min(1, b.deathT / 2.4)) : 0;
    const baseY = y + 70;
    const z = zOf(baseY);
    const fl = this.bossFlash(b);
    this.shadows.draw(this.f('shadow'), x, baseY, 0.06, 5.6, 3, 0, 1, 1, 1, 0.65);
    // legs (awake): back pair first
    if (lift > 2) {
      const legs = [[-110, 1], [110, 1], [-55, 0], [55, 0]] as const;
      for (let i = 0; i < 4; i++) {
        const [lx, back] = legs[i];
        const raise = P.leg === i ? P.legT * 50 : 0;
        const walk = Math.sin(this.time * 4 + i * 1.6) * 6;
        W.draw(this.f('tent_leg'), x + lx, baseY - lift - 10 - raise + walk * 0.3, z - (back ? 0.0004 : 0.0001), 1, (lift + 10) / 140, 0, 1, 1, 1, 1, 1, 1, 1, fl * 0.5);
      }
    }
    const sy = breathe * (1 - collapse * 0.55);
    W.draw(this.f(awake ? 'tent_body_1' : 'tent_body_0'), x, baseY - lift, z, breathe * (1 + collapse * 0.15), sy, Math.sin(this.time * 1.7) * 0.015 * (awake ? 1 : 0), 1, 1, 1, 1, 1, 1, 1, fl);
    if (awake || b.dead) {
      const maw = b.dead ? 0 : P.maw;
      const mawKey = b.windup > 0 && b.attackName === 'exhale' ? 'tent_maw_hot' : `tent_maw_${Math.min(3, Math.round(maw * 3))}`;
      W.draw(this.f(mawKey), x, baseY - lift - 105 * sy, z + 0.0001, 1, sy);
    }
    const eyes = !awake ? 0 : b.phase >= 1 || b.windup > 0 ? 2 : 1;
    W.draw(this.f(`tent_eyes_${eyes}`), x, baseY - lift - 172 * sy, z + 0.0002, 1, sy * (awake ? 1 : 0.9));
    if ((P.fire ?? 0) > 0 && !b.dead) W.draw(this.f(`tent_fire_${Math.floor(this.time * 8) & 1}`), x, baseY - lift, z + 0.0003, 1.05, sy);
  }

  private drawFerris(b: FerrisBoss, x: number, y: number): void {
    if (b.removed) return;
    const W = this.world;
    const P = b.pose;
    const home = !b.awake || (P.free ?? 0) < 0.5;
    const cx = home ? FERRIS_HOME.x : x;
    const cy = home ? FERRIS_HOME.y : y;
    const z = zOf(cy + 175);
    const fl = this.bossFlash(b);
    const wob = (P.wobble ?? 0) * Math.sin(this.time * 9) * 0.06;
    if (!home) this.shadows.draw(this.f('shadow'), cx, cy + 165, 0.06, 4.6, 1.6, 0, 1, 1, 1, 0.6);
    const lit = b.awake && (P.lights ?? 0) > 0.5 ? 'ferris_rim_1' : 'ferris_rim_0';
    W.draw(this.f(lit), cx, cy, z, 1, 1, b.spin + wob, 1, 1, 1, 1, 1, 0.4, 0.3, fl + (P.rimGlow ?? 0) * (0.3 + 0.3 * Math.sin(this.time * 20)));
    for (let i = 0; i < b.gondolas; i++) {
      const gp = b.gondolaPos(i);
      const gx = home ? gp.x - x + cx : gp.x, gy = home ? gp.y - y + cy : gp.y;
      const open = b.awake && (b.attackName === 'spiral' || b.windup > 0);
      W.draw(this.f(open ? 'ferris_gondola_open' : `ferris_gondola_${i % 5}`), gx, gy, z + 0.0001, 1, 1, Math.sin(this.time * 2 + i) * 0.12);
    }
    W.draw(this.f(b.awake ? 'ferris_hub_1' : 'ferris_hub_0'), cx, cy, z + 0.0002, 1, 1, wob, 1, 1, 1, 1, 1, 1, 1, fl);
  }

  private drawPuppet(b: PuppetBoss, x: number, y: number): void {
    if (b.removed) return;
    const W = this.world;
    const fl = this.bossFlash(b);
    const up = b.descend * 600;
    const hover = b.free ? 0 : 40 + Math.sin(this.time * 2) * 10;
    const stag = b.staggerT > 0;
    const bodyY = y - 60 - hover - up + (stag ? 40 : 0);
    const z = zOf(y + 60);
    const dance = b.pose.dance ?? 0;
    this.shadows.draw(this.f('shadow'), x, y + 60, 0.06, 3.4, 1.4, 0, 1, 1, 1, b.descend > 0.5 ? 0.2 : 0.6);
    // strings from the dark above
    const topY = this.camY - VIEW_H / 2 - 40;
    if (!b.free) {
      const S = this.wireShapes;
      const joints: [number, number][] = [[x - 45, bodyY + 30 - b.hands[0] * 40], [x + 45, bodyY + 30 - b.hands[1] * 40], [x, bodyY - 70], [x - 30, bodyY + 150], [x + 30, bodyY + 150]];
      for (const [jx, jy] of joints) S.line(jx, jy, x + (jx - x) * 1.6, topY, 1.2, 0.92, 0.9, 0.85, 0.75);
      W.draw(this.f('pk_crossbar'), x + Math.sin(this.time * 2) * 20, topY + 20, 0.95, 1, 1, Math.sin(this.time * 2) * 0.15);
      // P2 cuttable strings: thick glowing cords with HP pips
      for (const s of b.strings) {
        const hpT = s.maxHp > 0 ? s.hp / s.maxHp : 1;
        this.addShapes.line(s.x, s.y, s.x + (s.x - x) * 1.4, topY, 7, 1, 0.85, 0.3, 0.75 + 0.25 * Math.sin(this.time * 10), 0);
        this.teleLine.line(s.x, s.y, s.x + (s.x - x) * 1.4, topY, 2, 1, 1, 0.9, 1);
        this.teleLine.ring(s.x, s.y, 18, 22, 1, 0.85, 0.3, 0.9, 0.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpT);
      }
    }
    // legs dangle, arms dance
    const legSw = b.free ? Math.sin(this.time * 12) * 0.6 : Math.sin(dance * 2) * 0.35;
    W.draw(this.f('pk_leg'), x - 22, bodyY + 135, z - 0.0002, 1, 1, legSw);
    W.draw(this.f('pk_leg'), x + 22, bodyY + 135, z - 0.0002, 1, 1, -legSw);
    const flail = (b.pose.flail ?? 0) > 0;
    const armA0 = flail ? this.time * 14 : Math.sin(dance * 3) * 0.5 + 0.2 - b.hands[0] * 2.2;
    const armA1 = flail ? -this.time * 14 + 1 : -Math.sin(dance * 3 + 1) * 0.5 - 0.2 + b.hands[1] * 2.2;
    W.draw(this.f('pk_arm'), x - 46, bodyY + 18, z - 0.0001, 1.1, 1.1, armA0);
    W.draw(this.f('pk_arm'), x + 46, bodyY + 18, z - 0.0001, -1.1, 1.1, armA1);
    W.draw(this.f('pk_body'), x, bodyY, z, 1, 1, stag ? 0.3 : Math.sin(dance) * 0.06, 1, 1, 1, 1, 1, 1, 1, fl);
    const headKey = (b.pose.crownGone ?? 0) > 0 ? 'pk_head_2' : b.phase >= 1 || b.windup > 0 ? 'pk_head_1' : 'pk_head_0';
    W.draw(this.f(headKey), x + Math.sin(dance * 2) * 4, bodyY + 6, z + 0.0001, b.face, 1, stag ? 0.5 : Math.sin(dance * 1.5) * 0.12, 1, 1, 1, 1, 1, 1, 1, fl);
  }

  private drawRingmaster(b: RingmasterBoss, x: number, y: number): void {
    if (b.removed) return;
    const W = this.world;
    const fl = this.bossFlash(b);
    const demon = b.demon > 0.5;
    let pose = Math.floor(this.time * 2.5) & 1 ? 'idle1' : 'idle0';
    const P = b.pose;
    if ((P.whip ?? 0) > 0.05 || b.attackName === 'whip' || b.attackName === 'hellwhip') pose = (P.whip ?? 0) > 0.05 ? 'whip' : pose;
    if (!demon) {
      if ((P.bow ?? 0) > 0.3) pose = 'bow';
      else if ((P.hat ?? 0) > 0) pose = 'hat';
      else if ((P.cane ?? 0) > 0.05) pose = 'cane';
    }
    const key = demon ? `rm_d_${pose === 'whip' ? 'whip' : pose === 'idle1' ? 'idle1' : 'idle0'}` : `rm_h_${pose}`;
    if ((P.spotlight ?? 0) > 0) this.addShapes.circle(x, y, 140, 1, 0.95, 0.75, 0.3, 0);
    this.shadows.draw(this.f('shadow'), x, y + 70, 0.06, 2.2, 1, 0, 1, 1, 1, 0.6);
    const tf = b.demon > 0 && b.demon < 1 ? 1 - Math.abs(b.demon - 0.5) * 2 : 0;
    W.draw(this.f(key), x, y + 70, zOf(y + 70), b.face * (demon ? 1.1 : 1), demon ? 1.1 : 1, 0, 1, 1, 1, 1, 1, demon ? 0.6 : 1, demon ? 0.3 : 1, Math.max(fl, tf));
  }

  // =================================================================== summons / weapons / player
  private drawSummons(g: Game, alpha: number): void {
    const W = this.world, Sh = this.shadows;
    const shadow = this.f('shadow');
    const p = g.player;
    for (const s of g.summons) {
      if (!s.alive) continue;
      const x = lerp(s.px, s.x, alpha), y = lerp(s.py, s.y, alpha);
      const fi = Math.floor(s.animT * 8) & 1;
      let key = '';
      switch (s.kind) {
        case 'plush': key = `s_plush_${s.variant % 4}_${fi}`; break;
        case 'rabbit': key = `s_rabbit_${fi}`; break;
        case 'dove': key = `s_dove_${fi}`; break;
        case 'lion': key = `s_lion_${fi}`; break;
        case 'elephant': key = `s_elephant_${fi}`; break;
        case 'acrobat': key = `s_acrobat_${fi}`; break;
        case 'clone': {
          const ch = this.f(`char_${p.char.id}_${p.moving ? `walk${Math.floor(p.animT * 6) & 3}` : `idle${Math.floor(this.time * 2) & 1}`}`);
          W.draw(ch, x, y, zOf(y), p.facing, 1, 0, 0.7, 0.9, 1.15, 1, 0.5, 0.85, 1, 0.35 + 0.1 * Math.sin(this.time * 8));
          W.draw(this.f('s_mirror'), x, y, zOf(y) - 0.00005);
          continue;
        }
      }
      if (!key) continue;
      Sh.draw(shadow, x, y + 2, 0.06, 0.6, 0.5, 0, 1, 1, 1, 0.45);
      const flying = s.kind === 'dove' || s.kind === 'acrobat';
      W.draw(this.f(key), x, y - (flying ? 20 : 0), zOf(y), s.face, 1);
    }
  }

  private drawWeaponsVisuals(g: Game, px: number, py: number): void {
    const A = this.addShapes;
    const glow = this.f('fx_glow_0');
    for (const w of g.weapons.list) {
      const k = w.def.kind;
      if (k === 'laser' && w.active) {
        const n = g.weapons.amount(w);
        const L = 260 * g.weapons.area(w);
        const cols = [[1, 0.25, 0.65], [0.25, 1, 0.85], [1, 0.9, 0.25], [0.6, 0.4, 1]];
        for (let i = 0; i < n; i++) {
          const a = g.weapons.beamAngle(w, i, n);
          const c = cols[i % cols.length];
          const ex = px + Math.cos(a) * L, ey = py - 20 + Math.sin(a) * L;
          A.line(px, py - 20, ex, ey, 16, c[0], c[1], c[2], 0.35, 0);
          A.line(px, py - 20, ex, ey, 4, 1, 1, 1, 0.9, 0.3);
          this.fxAdd.draw(glow, ex, ey, 0.97, 0.6, 0.6, 0, c[0], c[1], c[2], 0.8);
        }
      } else if (k === 'orbs' && w.active) {
        const n = g.weapons.amount(w);
        const R = g.weapons.orbRadius(w);
        const evo = w.def.isEvolution;
        const size = ((evo ? 22 : 14) * g.weapons.area(w)) / (evo ? 1.7 : 1);
        for (let i = 0; i < n; i++) {
          const a = w.angle + (i * Math.PI * 2) / n;
          const ox = px + Math.cos(a) * R, oy = py + Math.sin(a) * R;
          const hue = (this.time * 0.5 + i / n) % 1;
          const c = [0.5 + 0.5 * Math.sin(hue * 6.28), 0.5 + 0.5 * Math.sin(hue * 6.28 + 2), 0.5 + 0.5 * Math.sin(hue * 6.28 + 4)];
          this.fxAdd.draw(glow, ox, oy - 10, 0.97, size / 18, size / 18, 0, c[0], c[1], c[2], 0.9);
          this.proj.draw(this.f('fx_glow_0'), ox, oy - 10, 0.96, size / 40, size / 40, 0, 1, 1, 1, 1);
          A.circle(ox, oy - 10, size * 0.7, c[0] * 0.6 + 0.4, c[1] * 0.6 + 0.4, c[2] * 0.6 + 0.4, 0.8, 0.2);
        }
      } else if (k === 'rings' && w.def.isEvolution) {
        const n = g.weapons.amount(w);
        const size = 16 * g.weapons.area(w);
        for (let i = 0; i < n; i++) {
          const dir = i % 2 === 0 ? 1 : -1;
          const R = 115 + i * 52;
          const a = w.angle * dir * (1 - i * 0.12) + (i * Math.PI * 2) / n;
          const ox = px + Math.cos(a) * R, oy = py + Math.sin(a) * R;
          this.proj.draw(this.f('p_ring_big'), ox, oy - 10, 0.96, size / 18, size / 18 * 0.7, a);
          this.fxAdd.draw(glow, ox, oy - 10, 0.97, size / 24, size / 24, 0, 0.8, 0.55, 1, 0.5);
        }
      } else if (k === 'bumper' && w.def.isEvolution && g.player.moving) {
        A.circle(px, py, 60 * g.weapons.area(w), 1, 0.85, 0.3, 0.12, 0);
        A.ring(px, py, 60 * g.weapons.area(w) - 3, 60 * g.weapons.area(w), 1, 0.85, 0.3, 0.5, 0.5);
      }
    }
  }

  private drawPlayer(g: Game, px: number, py: number): void {
    const p = g.player;
    const W = this.world;
    const id = p.char.id;
    let key: string;
    if (p.hurtFlash > 0.15) key = `char_${id}_hurt`;
    else if (p.moving || p.dashT > 0) key = `char_${id}_walk${Math.floor(p.animT * 6) & 3}`;
    else key = `char_${id}_idle${Math.floor(this.time * 2) & 1}`;
    const frame = this.f(key);
    this.shadows.draw(this.f('shadow'), px, py + 2, 0.06, 0.75, 0.6, 0, 1, 1, 1, 0.65);
    // bumper surge: ride a car + afterimages
    if (p.dashT > 0) {
      const car = this.f('p_derby');
      for (let k = 1; k <= 3; k++) W.draw(frame, px - p.dashX * k * 22, py - p.dashY * k * 22, zOf(py) - 0.0001 * k, p.facing, 1, 0, 1, 1, 1, 1, 1, 0.8, 0.4, 0.5 + k * 0.12);
      W.draw(car, px, py + 6, zOf(py + 7), p.facing, 1, Math.atan2(p.dashY, p.dashX) * 0.2);
    }
    const strobe = p.hurtFlash > 0 ? (Math.floor(this.time * 30) & 1 ? 1 : 0) : 0;
    const iBlink = p.iframes > 0 && p.hurtFlash <= 0 && p.iframes < 5 ? (Math.floor(this.time * 20) & 1 ? 0.25 : 0) : 0;
    const fa = Math.max(strobe * 0.8, iBlink);
    const fr = strobe ? (Math.floor(this.time * 15) & 1 ? 1 : 1) : 1, fg = strobe ? (Math.floor(this.time * 15) & 1 ? 0.2 : 1) : 1, fb = strobe ? (Math.floor(this.time * 15) & 1 ? 0.2 : 1) : 1;
    const breathe = p.moving ? 1 : 1 + Math.sin(this.time * 3) * 0.02;
    W.draw(frame, px, py, zOf(py) + 0.002, p.facing * (2 - breathe), breathe, 0, 1, 1, 1, 1, fr, fg, fb, fa);
    // Lost Child balloon shield
    if (p.char.quirk === 'balloon_shield' && p.shieldReady) {
      W.draw(this.f('shield_balloon'), px - 18 * p.facing, py - 50 + Math.sin(this.time * 2) * 4, zOf(py) + 0.0021, 1, 1, Math.sin(this.time * 1.5) * 0.15);
    }
    if (p.reviveFx > 0) p.reviveFx -= 1 / 60;
  }

  // =================================================================== projectiles & bullets
  private drawProjectiles(g: Game, alpha: number): void {
    const P = this.proj, Add = this.fxAdd;
    const glow = this.f('fx_glow_0');
    for (const p of g.projs) {
      if (!p.alive) continue;
      const x = lerp(p.px, p.x, alpha), y = lerp(p.py, p.y, alpha);
      let key = '';
      let s = 1;
      let rot = p.rot;
      let yo = -16;
      switch (p.kind) {
        case 'card': key = 'p_card'; s = Math.max(1, p.r / 9); break;
        case 'gold_card': key = 'p_gold_card'; s = Math.max(1, p.r / 9); Add.draw(glow, x, y + yo, 0.97, 0.4, 0.4, 0, 1, 0.85, 0.3, 0.6); break;
        case 'tarot': key = 'p_tarot'; rot = p.rot + Math.PI / 2; Add.draw(glow, x, y + yo, 0.97, 0.35, 0.35, 0, 0.7, 0.4, 1, 0.5); break;
        case 'death_card': key = 'p_death_card'; rot = p.rot + Math.PI / 2; s = p.area; Add.draw(glow, x, y + yo, 0.97, 0.8, 0.8, 0, 0.6, 0.2, 1, 0.8); break;
        case 'dart': key = 'p_dart'; break;
        case 'shrapnel': key = 'p_shrapnel'; rot += g.realTime * 20; break;
        case 'ring': key = 'p_ring'; s = p.r / 14; yo = -10; break;
        case 'cannonball': key = 'p_cannonball'; s = Math.max(0.9, p.r / 20); yo = -14; break;
        case 'derby_car': key = 'p_ghost'; s = p.r / 22; yo = -6; rot = Math.cos(p.rot) >= 0 ? p.rot * 0.2 : 0; break;
        case 'bumper_ghost': key = 'p_ghost'; s = p.r / 22; yo = -6; rot = 0; break;
        case 'rocket':
        case 'shell':
        case 'kernel': {
          // lobbed: parabolic height
          const t = 1 - p.life / p.maxLife;
          const h = Math.sin(t * Math.PI) * p.arc;
          key = p.kind === 'kernel' ? 'p_kernel' : p.kind === 'shell' ? 'p_shell' : 'p_rocket';
          const vy = p.vy - Math.cos(t * Math.PI) * p.arc * Math.PI / p.maxLife;
          rot = Math.atan2(vy, p.vx);
          if (p.kind === 'kernel') rot = t * 12;
          yo = -h - 10;
          this.shadows.draw(this.f('shadow'), x, y, 0.06, 0.3, 0.3, 0, 1, 1, 1, 0.4);
          if (p.kind !== 'kernel') {
            Add.draw(glow, x - Math.cos(rot) * 12, y + yo - Math.sin(rot) * 12, 0.97, 0.35, 0.35, 0, 1, 0.6, 0.2, 0.9);
            // landing reticle so explosions read
            this.teleLine.ring(p.tx, p.ty, 6, 8, 1, 0.8, 0.4, 0.35 * t, 0.35 * t);
          }
          break;
        }
        default: key = 'p_card';
      }
      P.draw(this.f(key), x, y + yo, 0.96, s, s, rot);
    }
  }

  private drawBullets(g: Game, alpha: number): void {
    const B = this.bullets, Add = this.fxAdd;
    const glow = this.f('fx_glow_0');
    for (const b of g.bullets) {
      if (!b.alive) continue;
      const x = lerp(b.px, b.x, alpha), y = lerp(b.py, b.y, alpha);
      const s = b.r / 8;
      Add.draw(glow, x, y - 10 - b.z, 0.97, s * 0.55, s * 0.55, 0, 1, 0.35, 0.15, 0.7);
      const key = `b_${b.kind === 'gondola' || b.kind === 'kernel_big' ? 'spiral' : b.kind}`;
      B.draw(this.f(key), x, y - 10 - b.z, 0.98, s, s, b.kind === 'pie' || b.kind === 'popcorn' || b.kind === 'crown' || b.kind === 'spoke' || b.kind === 'ticket' ? b.rot : 0);
    }
  }
}
