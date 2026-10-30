// The 2.5D world renderer (D-35). A fixed, angled orthographic camera looks down on a fully 3D
// carnival: procedural models in instanced batches, a moon that casts long cold shadows, a lantern
// spotlight on the player, a pool of flickering practical lights, ground mist, and a vintage grade.
// Gameplay stays on the 2D plane: sim (x, y) → world (X = x, Z = y), Y up. Reads the simulation,
// never mutates it, and interpolates positions between fixed ticks.

import * as THREE from 'three';
import { clamp, lerp } from '../core/math';
import { LIGHTS, MAP_HALF, PROPS, SEA_Y } from '../data/map';
import type { Assets } from '../render/assets';
import type { Frame } from '../render/atlas';
import { FxSystem } from '../render/fx';
import type { Game } from '../sim/game';
import type { Enemy, Hazard } from '../sim/entities';
import { ActorBatch } from './core/batch';
import { BillboardLayer, DecalBatch, camBasis } from './core/billboard';
import { actorMaterial, ink, pool, shared } from './core/materials';
import { CHARACTERS, ENEMY_MODELS, ITEM_MODELS, geometryFor, type ModelDef } from './models';
import { Ground3D } from './world/ground';
import { LightShafts, Motes } from './world/atmosphere';
import { LAST_SONG } from '../data/quests';
import { PropSet } from './world/props';
import { BossRigs } from './bosses';
import { Post3D } from './post';
import type { LastSongChain } from '../sim/quest';

import { ELEVATION } from './core/view';

export { ELEVATION };
const SIN_EL = Math.sin(ELEVATION);
const COS_EL = Math.cos(ELEVATION);
/** Visible frustum height (world units) at 16:9; narrower on ultra-wide so the spawn band stays off-screen. */
const FRUSTUM_H = 1000;
/**
 * Actors are drawn larger than their collision radius (as the 2D sprites were) and stretched a
 * little vertically to offset the camera's foreshortening, so silhouettes read at gameplay zoom.
 */
export const ACTOR_SCALE = 1.28;
export const ACTOR_STRETCH = 1.12;

const DANGER: [number, number, number] = [1, 0.25, 0.12];
const CAUTION: [number, number, number] = [1, 0.8, 0.25];

export interface RenderSettings {
  highContrast: boolean;
  reducedFlash: boolean;
  shake: number;
  damageNumbers: boolean;
  quality: 'low' | 'medium' | 'high';
}

export class GameRenderer3D {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.OrthographicCamera;
  post: Post3D;
  fx: FxSystem;
  ground: Ground3D;
  shafts: LightShafts;
  motes = new Motes();
  props: PropSet;
  bosses: BossRigs;
  hemi: THREE.HemisphereLight;
  moon: THREE.DirectionalLight;
  lantern: THREE.SpotLight;
  spot: THREE.SpotLight;
  // billboard + decal layers
  fxNormal: BillboardLayer;
  fxAdd: BillboardLayer;
  glow: BillboardLayer;
  numbers: BillboardLayer;
  teleFill: DecalBatch;
  zoneShapes: DecalBatch;
  addShapes: DecalBatch;
  teleLine: DecalBatch;
  wire: DecalBatch;
  camX = 0;
  camY = 0;
  time = 0;
  dawn = 0;
  /** 0..1: the Ringmaster's demon form bleeds red into the moonlight and fog. */
  moonTint = 0;
  settings: RenderSettings = { highContrast: false, reducedFlash: false, shake: 1, damageNumbers: true, quality: 'high' };
  private batches = new Map<string, ActorBatch>();
  private batchList: ActorBatch[] = [];
  private yaw = new Map<number, number>();
  private yawSweep = 0;
  private viewW = 1600;
  private viewH = FRUSTUM_H;
  private cssW = 1600;
  private cssH = 900;
  private pr = 1;
  private f: (k: string) => Frame;
  private tmpV = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpE = new THREE.Euler();
  private tmpS = new THREE.Vector3();
  private shadowQuality = '';
  // player animation state (stride-synced run, idle cross-fade, attack flourish, hurt)
  private pStride = 0;
  private pMove = 0;
  private pCastT = 9;
  private pPrevCd = 0;
  private pPrevX = 0;
  private pPrevY = 0;
  /** Dev-only inspection zoom (1 = gameplay framing) and camera lock. */
  zoom = 1;
  inspect: { x: number; y: number } | null = null;

  constructor(private canvas: HTMLCanvasElement, readonly assets: Assets) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x030306);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.OrthographicCamera(-800, 800, 500, -500, 10, 9000);
    this.scene.fog = new THREE.FogExp2(0x0b1324, 0.00022);
    this.scene.background = new THREE.Color(0x030306);
    this.scene.add(this.camera); // camera-parented overlays (the prize wheel) render in-scene

    // ---- lights: cold moon (shadows), dim sky/ground fill, the lantern, a boss spotlight
    this.hemi = new THREE.HemisphereLight(0x34477a, 0x2a1a10, 0.62);
    this.moon = new THREE.DirectionalLight(0x9fb4dc, 1.25);
    this.moon.castShadow = true;
    this.moon.shadow.bias = -0.0006;
    this.moon.shadow.normalBias = 1.5;
    const sc = this.moon.shadow.camera;
    sc.left = -1500; sc.right = 1500; sc.top = 1300; sc.bottom = -1300; sc.near = 10; sc.far = 6000;
    this.scene.add(this.moon, this.moon.target, this.hemi);
    this.lantern = new THREE.SpotLight(0xffc98a, 330000, 1300, 0.62, 0.7, 2);
    this.lantern.castShadow = true;
    this.lantern.shadow.bias = -0.0008;
    this.lantern.shadow.normalBias = 1.2;
    this.lantern.shadow.camera.near = 20;
    this.lantern.shadow.camera.far = 1600;
    this.scene.add(this.lantern, this.lantern.target);
    this.spot = new THREE.SpotLight(0xfff0d0, 0, 1600, 0.3, 0.5, 2);
    this.scene.add(this.spot, this.spot.target);
    this.buildEnvironment();

    this.ground = new Ground3D(this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(this.ground.mesh);
    this.shafts = new LightShafts(this.scene);

    const tex = assets.atlas.textures;
    this.f = (k: string) => assets.atlas.get(k);
    this.teleFill = new DecalBatch(40000, false, 3, { lift: 1.2 });
    this.zoneShapes = new DecalBatch(30000, false, 3, { lift: 1.0 });
    this.addShapes = new DecalBatch(60000, true, 6, { lift: 1.6 });
    this.teleLine = new DecalBatch(30000, false, 12, { lift: 2.0, depthTest: false });
    this.wire = new DecalBatch(8000, false, 11, { lift: 2.0, depthTest: false });
    for (const s of [this.teleFill, this.zoneShapes, this.addShapes, this.teleLine, this.wire]) this.scene.add(s.mesh);
    this.fxNormal = new BillboardLayer(tex, 1600, 'alpha', { lit: true, minLight: 0.35, order: 7 });
    this.fxAdd = new BillboardLayer(tex, 2200, 'add', { lit: false, order: 9 });
    this.glow = new BillboardLayer(tex, 1600, 'add', { lit: false, order: 8 });
    this.numbers = new BillboardLayer(tex, 900, 'alpha', { lit: false, depthTest: false, order: 14 });
    for (const l of [this.fxNormal, this.fxAdd, this.glow, this.numbers]) l.addTo(this.scene);
    this.fx = new FxSystem(assets);
    this.props = new PropSet(this.scene);
    this.bosses = new BossRigs(this.scene);
    this.post = new Post3D(this.renderer, this.scene, this.camera);
  }

  /** A tiny dark environment (navy sky, warm carnival glows near the horizon) so brass and glass reflect something. */
  private buildEnvironment(): void {
    const env = new THREE.Scene();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(10, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(vec3(0.05,0.035,0.03), vec3(0.06,0.08,0.14), smoothstep(-0.2, 0.6, h)); c += vec3(0.5,0.28,0.1) * exp(-pow((h-0.05)/0.08, 2.0)) * 0.6; gl_FragColor = vec4(c, 1.0); }',
      }),
    );
    env.add(sky);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? 0xffb347 : 0xff5a3a).multiplyScalar(4) }));
      blob.position.set(Math.cos(a) * 8, 0.6 + (i % 3) * 0.4, Math.sin(a) * 8);
      env.add(blob);
    }
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbfd0ff).multiplyScalar(5) }));
    moon.position.set(-5, 7, -4);
    env.add(moon);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(env, 0.02).texture;
    pm.dispose();
  }

  // =================================================================== sizing & projection
  resize(w: number, h: number, pixelRatio: number): void {
    this.cssW = w;
    this.cssH = h;
    this.pr = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.viewH = Math.min(FRUSTUM_H, 1880 / aspect) / this.zoom;
    this.viewW = this.viewH * aspect;
    this.camera.left = -this.viewW / 2;
    this.camera.right = this.viewW / 2;
    this.camera.top = this.viewH / 2;
    this.camera.bottom = -this.viewH / 2;
    this.camera.updateProjectionMatrix();
    this.applyQuality();
    this.post.setSize(w, h, pixelRatio);
    // ink lines stay ~1.3 CSS px wide whatever the zoom
    ink.uInkThick.value = (1.6 * this.viewH) / h;
  }

  private applyQuality(): void {
    const q = this.settings.quality;
    this.post.setQuality(q);
    if (q === this.shadowQuality) return;
    this.shadowQuality = q;
    const ms = q === 'high' ? 2048 : 1024;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.moon.castShadow = q !== 'low';
    this.lantern.castShadow = q === 'high';
    this.moon.shadow.mapSize.set(ms, ms);
    this.lantern.shadow.mapSize.set(q === 'high' ? 1024 : 512, q === 'high' ? 1024 : 512);
    this.moon.shadow.map?.dispose();
    this.moon.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    this.lantern.shadow.map?.dispose();
    this.lantern.shadow.map = null as unknown as THREE.WebGLRenderTarget;
  }

  get viewWidth(): number {
    return this.viewW;
  }

  /** Mouse-aim correction: ground distances appear compressed vertically by sin(elevation). */
  get aimScaleY(): number {
    return 1 / SIN_EL;
  }

  /** World (sim x/y, height h) → CSS pixels. */
  worldToScreen(x: number, y: number, cssW: number, cssH: number, h = 0): { x: number; y: number } {
    const sx = (x - this.camX) / this.viewW;
    const sy = ((y - this.camY) * SIN_EL - h * COS_EL) / this.viewH;
    return { x: (sx + 0.5) * cssW, y: (sy + 0.5) * cssH };
  }

  snapCamera(x: number, y: number): void {
    this.camX = x;
    this.camY = y;
  }

  // =================================================================== batches
  private batch(key: string, def: ModelDef, cap: number): ActorBatch {
    let b = this.batches.get(key);
    if (!b) {
      const rig = def.rig?.();
      const mat = actorMaterial({ animA: def.anim?.a, animB: def.anim?.b, emitBoost: def.emitBoost ?? 3, boneTex: rig?.tex, matte: !!rig || key.startsWith('s_') });
      b = new ActorBatch(geometryFor(key, def), mat, cap, { shadow: def.shadow ?? false, outline: !!rig || key.startsWith('s_') });
      if (def.rim) b.rim = def.rim;
      this.batches.set(key, b);
      this.batchList.push(b);
      this.scene.add(b.mesh);
      if (b.outline) this.scene.add(b.outline);
    }
    return b;
  }

  private smoothYaw(uid: number, target: number, dt: number, rate = 10): number {
    let cur = this.yaw.get(uid);
    if (cur === undefined) cur = target;
    let d = target - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    cur += d * (1 - Math.exp(-dt * rate));
    this.yaw.set(uid, cur);
    return cur;
  }

  // =================================================================== frame
  render(g: Game, alpha: number, dt: number, opts: { menu?: boolean } = {}): void {
    this.time += dt;
    shared.uTime.value = this.time;
    if (this.settings.quality !== this.shadowQuality) this.applyQuality();
    const fx = this.fx;
    fx.reducedFlash = this.settings.reducedFlash;
    fx.shakeScale = this.settings.shake;
    fx.showNumbers = this.settings.damageNumbers && !opts.menu;
    fx.particleBudget = this.settings.quality === 'low' ? 500 : this.settings.quality === 'medium' ? 1000 : 1700;
    fx.handle(g.fx.drain());
    fx.update(dt);
    const p = g.player;
    const px = lerp(p.px, p.x, alpha), py = lerp(p.py, p.y, alpha);

    // ---- camera: smooth follow + look-ahead, frame an awake boss, clamp to the map
    let lookX = p.vx * 0.12, lookY = p.vy * 0.12;
    for (const b of g.bosses) {
      if (!b.awake || b.dead) continue;
      const dx = b.x - px, dy = b.y - 60 - py;
      if (Math.abs(dx) < this.viewW * 0.9 && Math.abs(dy) < this.viewH * 1.1) {
        lookX += dx * 0.3;
        lookY += dy * 0.35;
      }
      break;
    }
    const k = 1 - Math.exp(-dt * (opts.menu ? 1.5 : 7));
    this.camX += (px + lookX - this.camX) * k;
    this.camY += (py + lookY - this.camY) * k;
    if (this.inspect) {
      this.camX = this.inspect.x;
      this.camY = this.inspect.y;
    }
    const halfGroundH = this.viewH / 2 / SIN_EL;
    const mx = MAP_HALF + 140 - this.viewW / 2;
    this.camX = clamp(this.camX, -mx, mx);
    this.camY = clamp(this.camY, -MAP_HALF - 60 + halfGroundH * 0.7, SEA_Y + 320 - halfGroundH * 0.75);
    const cx = this.camX + fx.shakeX, cy = this.camY + fx.shakeY;
    const D = 3000;
    this.camera.position.set(cx, SIN_EL * D, cy + COS_EL * D);
    this.camera.lookAt(cx, 0, cy);
    this.camera.updateMatrixWorld();
    camBasis.uCamRight.value.set(1, 0, 0);
    camBasis.uCamUp.value.set(0, COS_EL, -SIN_EL);
    (pool.uniforms.uViewDir.value as THREE.Vector3).set(0, SIN_EL, COS_EL);

    // ---- lighting
    this.updateLighting(g, px, py, cx, cy, opts.menu ?? false);
    this.ground.update(this.time, this.dawn);
    shared.uMistTime.value = this.time;
    shared.uMistWind.value.set(Math.cos(g.director.wind), Math.sin(g.director.wind));
    shared.uMistDensity.value = (this.settings.quality === 'low' ? 0.28 : 0.36) * (1 + g.darkness * 0.5) * (1 - this.dawn * 0.6);
    const lsq = g.quests?.get<LastSongChain>('last_song');
    this.shafts.update(this.time, g.darkness, this.dawn, (x, y) => {
      const li = LAST_SONG.lamps.findIndex((l) => l.x === x && l.y === y);
      if (!lsq || li < 0) return 0;
      return lsq.lit[li] ? 1.2 : (lsq.souls[li] / LAST_SONG.soulsPerLamp) * 0.5;
    });

    // occluder dithering focus: the player's framebuffer position and view depth
    const sp = this.worldToScreen(px, py, this.cssW, this.cssH, 40);
    this.tmpV.set(px, 40, py).applyMatrix4(this.camera.matrixWorldInverse);
    shared.uFocus.value.set(sp.x * this.pr, (this.cssH - sp.y) * this.pr, -this.tmpV.z, 150 * this.pr * (this.cssH / this.viewH));

    for (const b of this.batchList) b.begin();
    for (const l of [this.fxNormal, this.fxAdd, this.glow, this.numbers]) l.begin();
    for (const s of [this.teleFill, this.zoneShapes, this.addShapes, this.teleLine, this.wire]) s.begin();

    const vx0 = cx - this.viewW / 2 - 260, vx1 = cx + this.viewW / 2 + 260;
    const vy0 = cy - halfGroundH - 320, vy1 = cy + halfGroundH + 260;
    const inView = (x: number, y: number) => x > vx0 && x < vx1 && y > vy0 && y < vy1;

    this.props.update(g, this, inView, dt);
    this.motes.draw(this.glow, this.f('fx_glow_0'), this.time, inView, (1 - g.darkness * 0.8) * (1 - this.dawn));
    this.drawZones(g, inView);
    this.drawHazards(g);
    this.drawPickups(g, alpha, inView);
    this.drawEnemies(g, alpha, inView, dt);
    this.bosses.update(g, this, alpha, dt);
    this.drawSummons(g, alpha, dt);
    this.drawWeaponVisuals(g, px, py);
    this.drawPlayer(g, px, py, dt);
    this.drawProjectiles(g, alpha);
    this.drawBullets(g, alpha);
    fx.draw(this.fxNormal, this.fxAdd, this.addShapes, this.numbers);

    for (const b of this.batchList) b.end();
    for (const l of [this.fxNormal, this.fxAdd, this.glow, this.numbers]) l.end();
    for (const s of [this.teleFill, this.zoneShapes, this.addShapes, this.teleLine, this.wire]) s.end();
    if (++this.yawSweep > 600) {
      this.yawSweep = 0;
      const live = new Set<number>();
      for (const e of g.active) live.add(e.uid);
      for (const id of this.yaw.keys()) if (id >= 0 && !live.has(id)) this.yaw.delete(id);
    }

    const lowHp = p.hp / p.stats.maxHp();
    const fsp = this.worldToScreen(px, py, 1, 1, 30);
    this.post.update({
      time: this.time,
      lowHp: opts.menu ? 0 : clamp(1 - lowHp / 0.3, 0, 1),
      hurt: opts.menu ? 0 : Math.max(0, p.hurtFlash / 0.3) * (this.settings.reducedFlash ? 0.3 : 1),
      darkness: g.darkness,
      flash: fx.screenFlash * (this.settings.reducedFlash ? 0.35 : 1),
      flashCol: fx.screenFlashCol,
      dawn: this.dawn,
      vignette: opts.menu ? 0.7 : 0.55,
      focusU: fsp.x,
      focusV: 1 - fsp.y,
      highContrast: this.settings.highContrast,
    });
    this.post.renderFrame();
  }

  // =================================================================== lighting
  private updateLighting(g: Game, px: number, py: number, cx: number, cy: number, menu: boolean): void {
    const dark = g.darkness;
    const dawn = this.dawn;
    // moonlight: cold, from the west-north-west, a little brighter through gaps in the cloud
    const cloud = 0.85 + 0.15 * Math.sin(this.time * 0.07) * Math.sin(this.time * 0.031 + 1);
    this.moon.intensity = lerp(lerp(1.05 * cloud, 0.12, dark), 2.4, dawn);
    const mt = this.moonTint;
    this.moon.color.setRGB(lerp(lerp(0.62, 0.9, mt), 1.0, dawn), lerp(lerp(0.7, 0.25, mt), 0.78, dawn), lerp(lerp(0.86, 0.18, mt), 0.6, dawn));
    (this.scene.fog as THREE.FogExp2).color.setRGB(lerp(0.027, 0.07, mt), lerp(0.03, 0.012, mt), lerp(0.05, 0.01, mt));
    // snap the shadow frustum to texels so shadows don't shimmer while the camera glides
    const texel = 3000 / this.moon.shadow.mapSize.x;
    const tx = Math.round(cx / texel) * texel, ty = Math.round(cy / texel) * texel;
    this.moon.position.set(tx - 1500, 2400, ty - 900);
    this.moon.target.position.set(tx, 0, ty);
    this.moon.target.updateMatrixWorld();
    this.hemi.intensity = lerp(lerp(0.5, 0.08, dark), 1.2, dawn);
    // the lantern: a warm cone from above and slightly behind the player — long radial shadows
    const lanternOn = menu ? 0.5 : 1;
    this.lantern.position.set(px - 40, 640, py + 210);
    this.lantern.target.position.set(px, 0, py - 20);
    this.lantern.target.updateMatrixWorld();
    this.lantern.intensity = 330000 * lanternOn * (1 + dark * 0.4) * (1 - dawn * 0.7);
    this.lantern.distance = 1300 + dark * 150;

    pool.scale = 1 - dark * 0.88;
    pool.begin(cx, cy, this.viewW * 0.75 + 400);
    // the player's own glow (independent of Lights Out: it is the "seen" bubble)
    pool.add(px, py, 300, 0.5 / Math.max(0.12, pool.scale), 1.0, 0.82, 0.58, 60, 4);
    for (const b of g.bosses) {
      if (!b.awake || b.dead) continue;
      const c = this.bosses.glowColor(b);
      pool.add(b.x, b.y, 560, 1.1, c[0], c[1], c[2], 180, 3);
    }
    this.fx.addLights({ add: (x, y, r, i, cr, cg, cb) => pool.add(x, y, r, i * 1.4, cr, cg, cb, 70, 2) });
    for (let i = 0; i < LIGHTS.length; i++) {
      const l = LIGHTS[i];
      const t = this.time * 7 + i * 13.1;
      const fl = l.flicker > 0 ? 1 - l.flicker * (Math.sin(t) * 0.5 + 0.5) * (Math.sin(t * 2.7) > 0.6 ? 1 : 0.15) : 1;
      pool.add(l.x, l.y, l.r * 1.05, l.intensity * 1.15 * fl, l.color[0], l.color[1], l.color[2], 150);
    }
    this.props.addLights(g, this.time);
    pool.end();
  }

  // =================================================================== zones & hazards (ground decals)
  private drawZones(g: Game, inView: (x: number, y: number) => boolean): void {
    const S = this.zoneShapes, A = this.addShapes;
    for (const z of g.zones) {
      if (!z.alive || !inView(z.x, z.y)) continue;
      const fade = Math.min(1, z.life / 0.5) * Math.min(1, (z.maxLife - z.life) / 0.2 + 0.2);
      switch (z.kind) {
        case 'web':
          S.circle(z.x, z.y, z.r, 0.85, 0.75, 0.85, 0.16 * fade, 0.06 * fade);
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + z.x;
            S.line(z.x, z.y, z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r, 1.2, 0.95, 0.9, 0.95, 0.5 * fade);
          }
          for (const rr of [0.35, 0.65, 0.95]) S.ring(z.x, z.y, z.r * rr - 1.2, z.r * rr + 1.2, 0.95, 0.9, 0.95, 0.45 * fade, 0.45 * fade);
          break;
        case 'burn':
          A.circle(z.x, z.y, z.r, 1, 0.4, 0.08, 0.32 * fade, 0);
          if (Math.random() < 0.15) this.fx.handle([{ type: 'spark', x: z.x + (Math.random() - 0.5) * z.r, y: z.y + (Math.random() - 0.5) * z.r, a: 1, b: 0, c: 0, style: 'fire' }]);
          break;
        case 'spark':
          A.circle(z.x, z.y, z.r, 0.4, 0.8, 1, 0.28 * fade, 0);
          break;
        case 'sticky_patch':
          S.circle(z.x, z.y, z.r, 0.75, 0.4, 0.6, 0.42 * fade, 0.2 * fade);
          S.ring(z.x, z.y, z.r - 3, z.r, 0.5, 0.18, 0.35, 0.6 * fade, 0.6 * fade);
          break;
        case 'grease':
          S.circle(z.x, z.y, z.r, 0.55, 0.45, 0.15, 0.35 * fade, 0.1 * fade);
          break;
        case 'ice':
          A.circle(z.x, z.y, z.r, 0.5, 0.75, 1, 0.22 * fade, 0.05 * fade);
          break;
      }
    }
  }

  private drawHazards(g: Game): void {
    const F = this.teleFill, L = this.teleLine, A = this.addShapes;
    const hc = this.settings.highContrast;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 18);
    for (const h of g.hazards) {
      if (!h.alive) continue;
      if (this.bosses.drawHazard(h, this)) continue;
      const tele = h.tele > 0;
      const prog = tele ? 1 - h.tele / Math.max(0.001, h.teleMax) : 1;
      const [r, gg, b] = DANGER;
      if (h.safe) {
        this.drawSafe(h);
        continue;
      }
      if (h.dmg <= 0 && !tele && h.style !== 'lane' && h.style !== 'rail') continue;
      const fillA = tele ? (hc ? 0.3 : 0.16) + prog * (hc ? 0.3 : 0.22) : 0.5;
      const lineA = tele ? (hc ? 1 : 0.8) * (0.6 + 0.4 * pulse) : 1;
      switch (h.shape) {
        case 'circle': {
          if (h.style === 'hellfire' || h.style === 'fire_trail') {
            A.circle(h.x, h.y, h.r * 1.2, 1, 0.42, 0.08, 0.5, 0);
            if (Math.random() < 0.25) this.fx.handle([{ type: 'spark', x: h.x + (Math.random() - 0.5) * h.r, y: h.y + (Math.random() - 0.5) * h.r, a: 1, b: 0, c: 0, style: 'fire' }]);
            L.ring(h.x, h.y, h.r - 2, h.r, r, gg, b, 0.6, 0.6);
            break;
          }
          if (h.style === 'roll' || h.style === 'lunge' || h.style === 'phantom_wheel' && !tele) break;
          if (h.style === 'spotlight') {
            A.circle(h.x, h.y, h.r, 1, 0.95, 0.7, tele ? 0.2 + prog * 0.3 : 0.7, 0.05);
            L.ring(h.x, h.y, h.r - 3, h.r, r, gg, b, lineA, lineA);
            break;
          }
          if (h.style === 'maw') {
            for (let k = 0; k < 3; k++) {
              const rr = ((this.time * 1.5 + k / 3) % 1) * 420;
              A.ring(h.x, h.y, Math.max(0, 420 - rr - 4), 420 - rr, 0.8, 0.9, 1, 0.22, 0.04);
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
            F.circle(h.x, h.y, h.r * prog, r, gg, b, 0.25 + 0.2 * prog, 0.35);
            L.ring(h.x, h.y, h.r - (hc ? 4 : 2.5), h.r, r, gg, b, lineA, lineA);
          } else {
            A.circle(h.x, h.y, h.r, 1, 0.6, 0.35, 0.55 * (h.active / Math.max(0.001, h.activeMax)), 0);
          }
          break;
        }
        case 'ring': {
          if (tele) break;
          if (h.gapHalf > 0) {
            const a0 = h.angle + h.gapHalf, a1 = h.angle - h.gapHalf + Math.PI * 2;
            F.ring(h.x, h.y, Math.max(0, h.r2), h.r, r, gg, b, 0.7, 0.7, a0, a1);
            A.ring(h.x, h.y, Math.max(0, h.r2), h.r, 1, 0.55, 0.35, 0.35, 0.35, a0, a1);
          } else {
            F.ring(h.x, h.y, Math.max(0, h.r2), h.r, r, gg, b, 0.7, 0.7);
            A.ring(h.x, h.y, Math.max(0, h.r2), h.r, 1, 0.55, 0.35, 0.3, 0.3);
          }
          break;
        }
        case 'annulus': {
          if (h.style === 'fire_ring' && !tele) {
            A.ring(h.x, h.y, Math.max(0, h.r2), h.r, 1, 0.4, 0.06, 0.5, 0.1);
            for (let k = 0; k < 6; k++) {
              const a = Math.random() * Math.PI * 2;
              const d = h.r2 + Math.random() * (h.r - h.r2) * 0.5;
              this.fx.handle([{ type: 'spark', x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d, a: 1, b: 0, c: 0, style: 'fire' }]);
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
            F.line(h.x, h.y, h.x2, h.y2, w, r, gg, b, fillA, fillA * 0.4);
            this.laneEdges(h, w, r, gg, b, lineA);
          } else if (h.dmg > 0) {
            const isBar = h.style === 'pole' || h.style === 'crossbar' || h.style === 'spoke';
            if (isBar) {
              F.line(h.x, h.y, h.x2, h.y2, w, 0.25, 0.15, 0.1, 0.9);
              F.line(h.x, h.y, h.x2, h.y2, w * 0.6, r, gg, b, 0.85);
            } else if (h.style === 'spot_beam') {
              A.line(h.x, h.y, h.x2, h.y2, w, 1, 0.92, 0.6, 0.5, 0);
              L.line(h.x, h.y, h.x2, h.y2, 2.5, r, gg, b, 0.8);
            } else if (h.style === 'string_sweep' || h.style === 'tangle') {
              A.line(h.x, h.y, h.x2, h.y2, w + 4, 1, 0.95, 0.85, 0.85, 0);
              L.line(h.x, h.y, h.x2, h.y2, 2, r, gg, b, 1);
            } else {
              const fade = h.active / Math.max(0.001, h.activeMax);
              A.line(h.x, h.y, h.x2, h.y2, w + 6, 1, h.style === 'hellwhip' ? 0.45 : 0.75, 0.35, 0.85 * fade, 0);
              F.line(h.x, h.y, h.x2, h.y2, w * 0.5, r, gg, b, fade);
            }
          }
          break;
        }
        case 'sector':
          F.sector(h.x, h.y, h.r2, h.r, h.angle, h.half, r, gg, b, fillA, fillA * 0.5);
          if (tele) L.ring(h.x, h.y, h.r - 2.5, h.r, r, gg, b, lineA, lineA, h.angle - h.half, h.angle + h.half);
          break;
      }
    }
  }

  laneEdges(h: Hazard, w: number, r: number, g: number, b: number, a: number): void {
    const L = this.teleLine;
    const dx = h.x2 - h.x, dy = h.y2 - h.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy * w, ny = ux * w;
    L.line(h.x + nx, h.y + ny, h.x2 + nx, h.y2 + ny, 2.2, r, g, b, a);
    L.line(h.x - nx, h.y - ny, h.x2 - nx, h.y2 - ny, 2.2, r, g, b, a);
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
    switch (h.style) {
      case 'safe_pocket':
        A.circle(h.x, h.y, h.r, 0.35, 1, 0.55, 0.28 * pulse, 0.05);
        L.ring(h.x, h.y, h.r - 3, h.r, 0.4, 1, 0.6, 0.9, 0.9);
        break;
      case 'treat_marker':
        L.ring(h.x, h.y, h.r - 3, h.r, 0.5, 1, 0.55, 0.6 * pulse, 0.6 * pulse);
        break;
      case 'chest_marker':
        A.circle(h.x, h.y, h.r * 1.6, 1, 0.8, 0.3, 0.22 * pulse, 0);
        break;
      case 'swarm_lane': {
        const prog = 1 - h.tele / Math.max(0.001, h.teleMax);
        this.teleFill.line(h.x, h.y, h.x2, h.y2, h.r2, CAUTION[0], CAUTION[1], CAUTION[2], 0.1 + prog * 0.12, 0.02);
        this.laneEdges(h, h.r2, CAUTION[0], CAUTION[1], CAUTION[2], 0.55);
        break;
      }
      case 'lane':
        this.teleFill.line(h.x, h.y, h.x2, h.y2, h.r2, DANGER[0], DANGER[1], DANGER[2], 0.2, 0.05);
        break;
      case 'inhale_warn':
        for (let k = 0; k < 3; k++) {
          const rr = ((this.time * 1.2 + k / 3) % 1) * h.r;
          L.ring(h.x, h.y, Math.max(0, h.r - rr - 3), h.r - rr, 0.8, 0.9, 1, 0.5, 0.5);
        }
        break;
    }
  }

  // =================================================================== pickups
  private drawPickups(g: Game, alpha: number, inView: (x: number, y: number) => boolean): void {
    const glowF = this.f('fx_glow_0');
    const G = this.glow;
    for (const pk of g.pickups) {
      if (!pk.alive) continue;
      const x = lerp(pk.px, pk.x, alpha), y = lerp(pk.py, pk.y, alpha);
      if (!inView(x, y)) continue;
      const bob = Math.sin(this.time * 4 + pk.x * 0.1) * 3;
      switch (pk.kind) {
        case 'ticket': {
          // neon tickets: tilted toward the camera so the sign reads, gently buzzing, with a halo
          const tier = pk.value >= 8 ? 2 : pk.value >= 3 ? 1 : 0;
          const b = this.batch(`ticket${tier}`, ITEM_MODELS[`ticket${tier}`], 900);
          const buzz = 0.82 + 0.18 * Math.sin(this.time * 6 + pk.x * 0.3) * (Math.sin(this.time * 23 + pk.y) > 0.92 ? 0.3 : 1);
          this.tmpE.set(-0.75, Math.sin(this.time * 1.3 + pk.x * 0.02) * 0.5, 0, 'YXZ');
          this.tmpQ.setFromEuler(this.tmpE);
          const sc = 1.15;
          this.tmpM.compose(this.tmpV.set(x, 14 + bob, y), this.tmpQ, this.tmpS.set(sc, sc, sc));
          const i = b.addMatrix(this.tmpM);
          b.tint(i, 1, 1, 1, buzz);
          const nc = NEON[tier];
          G.draw(glowF, x, y, 14 + bob, 0.36 + tier * 0.08, 0.36 + tier * 0.08, 0, nc[0], nc[1], nc[2], 0.3 * buzz);
          this.addShapes.circle(x, y, 11 + tier * 3, nc[0], nc[1], nc[2], 0.1 * buzz, 0);
          break;
        }
        case 'bank': {
          const s = 1 + Math.min(1.2, pk.value / 400);
          const b = this.batch('bank', ITEM_MODELS.bank, 40);
          b.add(x, y, 16 + bob, this.time, s);
          G.draw(glowF, x, y, 16, s * 1.3, s * 1.3, 0, 1, 0.6, 0.3, 0.6);
          break;
        }
        case 'food':
        case 'funnel': {
          const b = this.batch(pk.kind, ITEM_MODELS[pk.kind], 40);
          b.add(x, y, 4 + bob * 0.5, this.time * 0.8, 1);
          G.draw(glowF, x, y, 10, 1.0, 1.0, 0, 0.4, 1, 0.45, 0.45 + 0.25 * Math.sin(this.time * 6));
          break;
        }
        case 'golden': {
          const b = this.batch('golden', ITEM_MODELS.golden, 20);
          b.add(x, y, 18 + bob, this.time * 2, 1);
          G.draw(glowF, x, y, 18, 1.7 + Math.sin(this.time * 5) * 0.2, 1.7, 0, 1, 0.8, 0.3, 0.85);
          break;
        }
        case 'chest': {
          const b = this.batch('chest', ITEM_MODELS.chest, 20);
          const hop = Math.max(0, Math.sin(this.time * 6)) * 4;
          b.add(x, y, hop, Math.sin(this.time * 1.3) * 0.15, 1.15);
          G.draw(glowF, x, y, 20, 1.6, 1.6, 0, 1, 0.75, 0.35, 0.5 + 0.25 * Math.sin(this.time * 4));
          break;
        }
      }
    }
  }

  // =================================================================== enemies
  private drawEnemies(g: Game, alpha: number, inView: (x: number, y: number) => boolean, dt: number): void {
    const star = this.f('fx_star_0');
    for (const e of g.active) {
      if (!e.alive) continue;
      const x = lerp(e.px, e.x, alpha), y = lerp(e.py, e.y, alpha);
      if (!inView(x, y)) continue;
      const id = e.def.id;
      if (id === 'roller_coaster_snake') {
        this.drawSnake(e, x, y, dt);
        continue;
      }
      let key = id;
      if (id === 'whack_a_mole' && e.hidden) key = 'mole_hole';
      if (id === 'jack_in_the_box' && e.state === 2) key = 'jack_open';
      const def = ENEMY_MODELS[key];
      if (!def) continue;
      const b = this.batch(key, def, id === 'swarm_balloon' || id === 'living_balloon' || id === 'possessed_stuffie' ? 700 : 400);
      const rig = def.rig?.();
      const moving = Math.hypot(e.vx, e.vy) > 6;
      const flyer = e.def.behavior === 'flyby' || id === 'living_balloon';
      // face the direction of travel (smoothed); idle enemies keep their last heading
      const target = moving ? Math.atan2(e.vx, e.vy) : flyer ? 0 : this.yaw.get(e.uid) ?? 0;
      const yaw = flyer ? Math.sin(this.time * 0.8 + e.idx) * 0.4 : this.smoothYaw(e.uid, target, dt, 9);
      const pop = Math.min(1, e.spawnT * 4);
      let s = e.scale * (0.35 + 0.65 * pop) * (e.elite ? 1.18 : 1);
      let h = (def.hover ?? 0) + (flyer ? Math.sin(this.time * 2 + e.idx) * 5 : 0);
      if (id === 'jack_in_the_box' && e.state === 2) h += Math.sin(Math.min(1, 1 - e.t / 0.45) * Math.PI) * 30;
      if (id === 'whack_a_mole' && !e.hidden) h -= (1 - Math.min(1, e.t * 6)) * 20;
      const i = b.add(x, y, h, yaw, s * ACTOR_SCALE, 1, ACTOR_STRETCH * (1 - 0.08 * e.windup), 1);
      if (i < 0) continue;
      const telegraph = e.windup > 0 ? e.windup : 0;
      const flash = Math.min(1, e.flash * 0.9 + (e.invuln ? 0.25 : 0));
      if (rig) {
        // locomotion at a stride rate matched to the enemy's speed, each on its own phase;
        // the wind-up clip is driven directly by the sim's telegraph
        const rate = flyer ? 0.55 : Math.max(0.7, Math.min(2.4, e.speed / 85));
        const ra = rig.row('move', (moving || flyer ? e.animT * rate : this.time * 0.25) + e.idx * 0.37);
        if (telegraph > 0.02 && rig.has('attack')) b.anim(i, ra, rig.row('attack', telegraph), flash, Math.min(1, telegraph * 2.5));
        else b.anim(i, ra, ra, flash, 0);
        if (!def.shadow) this.zoneShapes.circle(x, y, e.r * s * 1.25 + 6, 0, 0, 0, flyer ? 0.18 : 0.42, 0);
      } else b.anim(i, e.animT * 9 + e.idx, telegraph, flash, moving || flyer ? 1 : 0.15);
      // statuses tint the model; elites wear a gold rim and a crown spark
      if (e.frozenT > 0) b.tint(i, 0.55, 0.8, 1.3);
      else if (e.stickyT > 0) b.tint(i, 1.2, 0.7, 0.95);
      else if (e.burnT > 0 && Math.sin(this.time * 30 + e.idx) > 0.4) b.tint(i, 1.4, 0.7, 0.4);
      if (id === 'living_balloon' || id === 'swarm_balloon') {
        const c = BALLOON_TINTS[e.idx % BALLOON_TINTS.length];
        b.tint(i, c[0], c[1], c[2]);
      }
      if (e.elite) {
        const pulse = 0.75 + 0.25 * Math.sin(this.time * 6);
        b.rimLight(i, 1.0, 0.78, 0.25, 1.4 * pulse);
        this.fxAdd.draw(star, x, y, h + 60 * s + 30, 1.1, 1.1, this.time * 2, 1, 0.85, 0.3, 0.9);
      }
      if (telegraph > 0.05) b.rimLight(i, 1, 0.3, 0.12, 0.8 + telegraph * 1.6);
      if (e.shield > 0) this.addShapes.ring(x, y, e.r + 10, e.r + 14, 0.5, 0.8, 1, 0.6, 0.3);
    }
  }

  private drawSnake(e: Enemy, x: number, y: number, dt: number): void {
    if (e.state === 0 || e.state === 1) return; // off-screen or telegraphing (the rail is a hazard)
    const head = this.batch('roller_coaster_snake', ENEMY_MODELS.roller_coaster_snake, 12);
    const seg = this.batch('snake_seg', ENEMY_MODELS.snake_seg, 120);
    const yaw = Math.atan2(e.dirX, e.dirY);
    const segs = 9, spacing = 34;
    for (let i = segs; i >= 1; i--) {
      const d = i * spacing;
      if (d > e.n1) continue;
      const sx = x - e.dirX * d, sy = y - e.dirY * d;
      const k = seg.add(sx, sy, Math.abs(Math.sin(this.time * 14 - i)) * 2, yaw, ACTOR_SCALE);
      seg.anim(k, this.time * 6, 0, e.flash * 0.8, 1);
    }
    const k = head.add(x, y, 0, yaw, 1.1 * ACTOR_SCALE);
    head.anim(k, this.time * 6, e.windup, e.flash * 0.8, 1);
    void dt;
  }

  // =================================================================== summons / weapons / player
  private drawSummons(g: Game, alpha: number, dt: number): void {
    const p = g.player;
    for (let si = 0; si < g.summons.length; si++) {
      const s = g.summons[si];
      if (!s.alive) continue;
      const x = lerp(s.px, s.x, alpha), y = lerp(s.py, s.y, alpha);
      const moving = Math.hypot(s.x - s.px, s.y - s.py) > 0.05;
      const yaw = this.smoothYaw(-1000 - si, moving ? Math.atan2(s.x - s.px, s.y - s.py) : (s.face > 0 ? Math.PI / 2 : -Math.PI / 2), dt, 8);
      if (s.kind === 'clone') {
        const def = CHARACTERS[p.char.id];
        const rig = def.rig!();
        const b = this.batch(`char_${p.char.id}`, def, 6);
        const i = b.add(x, y, 0, yaw, (def.scale ?? 1) * ACTOR_SCALE, 1, ACTOR_STRETCH, 1);
        const row = moving ? rig.row('move', s.animT * 1.1) : rig.row('idle', this.time / 2.8 + si * 0.3);
        b.anim(i, row, row, 0, 0);
        b.tint(i, 0.45, 0.65, 1.0);
        b.rimLight(i, 0.5, 0.85, 1, 1.4 + 0.3 * Math.sin(this.time * 8));
        continue;
      }
      const key = `s_${s.kind}`;
      const def = ITEM_MODELS[key];
      if (!def) continue;
      const b = this.batch(key, def, 60);
      const h = (def.hover ?? 0) + (def.hover ? Math.sin(this.time * 3 + si) * 6 : 0);
      const i = b.add(x, y, h, yaw, ACTOR_SCALE * (s.kind === 'plush' ? 1 + (s.variant % 4) * 0.08 : 1), 1, ACTOR_STRETCH, 1);
      b.anim(i, s.animT * 9 + si, 0, 0, moving || def.hover ? 1 : 0.2);
      if (s.kind === 'plush') {
        const c = PLUSH_TINTS[s.variant % PLUSH_TINTS.length];
        b.tint(i, c[0], c[1], c[2]);
      }
    }
  }

  private drawWeaponVisuals(g: Game, px: number, py: number): void {
    const A = this.addShapes;
    const glowF = this.f('fx_glow_0');
    for (const w of g.weapons.list) {
      const k = w.def.kind;
      if (k === 'laser' && w.active) {
        const n = g.weapons.amount(w);
        const L = 260 * g.weapons.area(w);
        const cols = [[1, 0.25, 0.55], [0.25, 1, 0.8], [1, 0.85, 0.25], [0.6, 0.4, 1]];
        for (let i = 0; i < n; i++) {
          const a = g.weapons.beamAngle(w, i, n);
          const c = cols[i % cols.length];
          const ex = px + Math.cos(a) * L, ey = py + Math.sin(a) * L;
          A.line(px, py, ex, ey, 16, c[0], c[1], c[2], 0.35, 0);
          A.line(px, py, ex, ey, 4, 1, 1, 1, 0.85, 0.3);
          this.fxAdd.draw(glowF, ex, ey, 20, 0.6, 0.6, 0, c[0], c[1], c[2], 0.8);
          pool.add(ex, ey, 160, 0.5, c[0], c[1], c[2], 40, 1.5);
        }
      } else if (k === 'orbs' && w.active) {
        const n = g.weapons.amount(w);
        const R = g.weapons.orbRadius(w);
        const evo = w.def.isEvolution;
        const size = ((evo ? 22 : 14) * g.weapons.area(w)) / (evo ? 1.7 : 1);
        const b = this.batch('orb', { build: () => orbGeo(), rim: [0, 0, 0, 0] }, 24);
        for (let i = 0; i < n; i++) {
          const a = w.angle + (i * Math.PI * 2) / n;
          const ox = px + Math.cos(a) * R, oy = py + Math.sin(a) * R;
          const hue = (this.time * 0.5 + i / n) % 1;
          const c = [0.5 + 0.5 * Math.sin(hue * 6.28), 0.5 + 0.5 * Math.sin(hue * 6.28 + 2), 0.5 + 0.5 * Math.sin(hue * 6.28 + 4)];
          const j = b.add(ox, oy, 26, 0, size / 10);
          b.tint(j, c[0] * 0.6 + 0.4, c[1] * 0.6 + 0.4, c[2] * 0.6 + 0.4, 1.4);
          this.fxAdd.draw(glowF, ox, oy, 26, size / 18, size / 18, 0, c[0], c[1], c[2], 0.8);
        }
      } else if (k === 'rings' && w.def.isEvolution) {
        const n = g.weapons.amount(w);
        const size = 16 * g.weapons.area(w);
        const b = this.batch('ring', ITEM_MODELS.ring, 24);
        for (let i = 0; i < n; i++) {
          const dir = i % 2 === 0 ? 1 : -1;
          const R = 115 + i * 52;
          const a = w.angle * dir * (1 - i * 0.12) + (i * Math.PI * 2) / n;
          const ox = px + Math.cos(a) * R, oy = py + Math.sin(a) * R;
          const j = b.add(ox, oy, 22, a, size / 11);
          b.tint(j, 0.9, 0.7, 1.2, 1.5);
          this.fxAdd.draw(glowF, ox, oy, 22, size / 24, size / 24, 0, 0.8, 0.55, 1, 0.5);
        }
      } else if (k === 'bumper' && w.def.isEvolution && g.player.moving) {
        const R = 60 * g.weapons.area(w);
        A.circle(px, py, R, 1, 0.85, 0.3, 0.12, 0);
        A.ring(px, py, R - 3, R, 1, 0.85, 0.3, 0.5, 0.5);
      }
    }
  }

  /** Skeletal rows for the player: [rowA, rowB, blend]. */
  private playerRows(g: Game, dt: number, rigName: string): [number, number, number] {
    const p = g.player;
    const rig = CHARACTERS[rigName].rig!();
    const moved = Math.hypot(p.x - this.pPrevX, p.y - this.pPrevY);
    this.pPrevX = p.x;
    this.pPrevY = p.y;
    const moving = p.moving || p.dashT > 0;
    this.pMove += ((moving ? 1 : 0) - this.pMove) * (1 - Math.exp(-dt * 10));
    // stride-locked phase so feet don't skate: ~92 world units per full cycle
    this.pStride += Math.min(moved, 40) / 92;
    // the signature weapon firing triggers the attack flourish
    const sig = g.weapons.list.find((w) => w.def.id === p.char.startWeapon || w.def.evolvedFrom === p.char.startWeapon);
    if (sig) {
      if (sig.cd > this.pPrevCd + 0.05) this.pCastT = 0;
      this.pPrevCd = sig.cd;
    }
    this.pCastT += dt / 0.42;
    const idle = rig.row('idle', this.time / 2.8);
    const run = rig.row(p.dashT > 0 && rig.has('dash') ? 'dash' : 'move', this.pStride);
    if (p.hurtFlash > 0) return [this.pMove > 0.5 ? run : idle, rig.row('hurt', 1 - p.hurtFlash / 0.3), 0.85];
    if (this.pCastT < 1) {
      const w = Math.min(1, Math.sin(Math.min(1, this.pCastT) * Math.PI) * 1.6);
      return [this.pMove > 0.5 ? run : idle, rig.row('cast', this.pCastT), w * (this.pMove > 0.5 ? 0.7 : 1)];
    }
    if (this.pMove > 0.97) return [run, run, 0];
    if (this.pMove < 0.03) return [idle, idle, 0];
    return [run, idle, 1 - this.pMove];
  }

  private drawPlayer(g: Game, px: number, py: number, dt: number): void {
    const p = g.player;
    const def = CHARACTERS[p.char.id];
    const b = this.batch(`char_${p.char.id}`, def, 6);
    const moving = p.moving || p.dashT > 0;
    const target = moving ? Math.atan2(p.vx, p.vy) : this.yaw.get(-1) ?? 0;
    const yaw = this.smoothYaw(-1, target, dt, 12);
    const s = def.scale ?? 1;
    const [ra, rb, bl] = this.playerRows(g, dt, p.char.id);
    if (p.dashT > 0) {
      // bumper surge afterimages
      for (let k = 1; k <= 3; k++) {
        const j = b.add(px - p.dashX * k * 22, py - p.dashY * k * 22, 0, yaw, s * ACTOR_SCALE, 1, ACTOR_STRETCH, 1);
        b.anim(j, ra, rb, 0.5, bl);
        b.tint(j, 1, 0.8, 0.5, 1);
        b.rimLight(j, 1, 0.6, 0.3, 1.2);
      }
    }
    const i = b.add(px, py, 0, yaw, s * ACTOR_SCALE, 1, ACTOR_STRETCH, 1);
    const strobe = p.hurtFlash > 0 ? (Math.floor(this.time * 30) & 1 ? 0.6 : 0) : 0;
    const iBlink = p.iframes > 0 && p.hurtFlash <= 0 && p.iframes < 5 ? (Math.floor(this.time * 20) & 1 ? 0.3 : 0) : 0;
    b.anim(i, ra, rb, Math.max(strobe, iBlink), bl);
    if (strobe) b.tint(i, 1.4, 0.5, 0.5);
    // the balloon shield bobs above the Lost Child
    if (p.char.quirk === 'balloon_shield' && p.shieldReady) {
      const bb = this.batch('shield_balloon', ENEMY_MODELS.living_balloon, 2);
      const j = bb.add(px - 22 * p.facing, py + 4, 58 + Math.sin(this.time * 2) * 4, Math.sin(this.time) * 0.3, 0.75);
      bb.tint(j, 1.2, 0.5, 0.55);
      bb.anim(j, this.time * 2, 0, 0, 0);
    }
    // the Ghost Ticket orbits whoever carries it to the Ringmaster (D-32)
    const ls = g.quests?.get<LastSongChain>('last_song');
    if (ls?.carrying) {
      const gt = this.batch('ghost_ticket', ITEM_MODELS.golden, 1);
      const a = this.time * 1.4;
      const j = gt.add(px + Math.cos(a) * 46, py + Math.sin(a) * 30, 64 + Math.sin(this.time * 3) * 6, a * 2, 1.1);
      gt.tint(j, 0.35, 1.0, 0.7, 1.6);
      this.glow.draw(this.f('fx_glow_0'), px + Math.cos(a) * 46, py + Math.sin(a) * 30, 64, 0.9, 0.9, 0, 0.4, 1, 0.7, 0.6);
      pool.add(px, py, 220, 0.6, 0.45, 1, 0.7, 70, 3);
    }
    if (p.reviveFx > 0) p.reviveFx -= 1 / 60;
  }

  // =================================================================== projectiles & bullets
  private drawProjectiles(g: Game, alpha: number): void {
    const glowF = this.f('fx_glow_0');
    for (const pr of g.projs) {
      if (!pr.alive) continue;
      const x = lerp(pr.px, pr.x, alpha), y = lerp(pr.py, pr.y, alpha);
      const def = ITEM_MODELS[pr.kind] ?? ITEM_MODELS.card;
      const b = this.batch(`p_${pr.kind}`, def, 600);
      let h = 22;
      let yaw = Math.atan2(pr.vx, pr.vy);
      let pitch = 0, roll = 0;
      let s = 1;
      switch (pr.kind) {
        case 'card': case 'gold_card': s = Math.max(1, pr.r / 9); roll = this.time * 18; break;
        case 'tarot': case 'death_card': s = pr.kind === 'death_card' ? pr.area : 1; yaw = pr.rot; break;
        case 'shrapnel': roll = g.realTime * 20; break;
        case 'ring': s = pr.r / 12; yaw = pr.rot; h = 14; break;
        case 'cannonball': s = Math.max(0.9, pr.r / 20); roll = pr.rot; h = 14; break;
        case 'derby_car': case 'bumper_ghost': s = pr.r / 22; h = 4; break;
        case 'rocket': case 'shell': case 'kernel': {
          const t = 1 - pr.life / pr.maxLife;
          h = 14 + Math.sin(t * Math.PI) * pr.arc;
          pitch = -Math.cos(t * Math.PI) * 0.9;
          if (pr.kind === 'kernel') roll = t * 12;
          else {
            this.fxAdd.draw(glowF, x - Math.sin(yaw) * 10, y - Math.cos(yaw) * 10, h, 0.35, 0.35, 0, 1, 0.6, 0.2, 0.9);
            this.teleLine.ring(pr.tx, pr.ty, 6, 8, 1, 0.8, 0.4, 0.35 * t, 0.35 * t);
          }
          break;
        }
        case 'note': yaw = pr.rot; h = 26; this.fxAdd.draw(glowF, x, y, h, 0.35, 0.35, 0, 0.5, 1, 0.7, 0.5); break;
      }
      if (pitch !== 0 || roll !== 0) {
        this.tmpE.set(pitch, yaw, roll, 'YXZ');
        this.tmpQ.setFromEuler(this.tmpE);
        this.tmpM.compose(this.tmpV.set(x, h, y), this.tmpQ, new THREE.Vector3(s, s, s));
        b.addMatrix(this.tmpM);
      } else b.add(x, y, h, yaw, s);
    }
  }

  private drawBullets(g: Game, alpha: number): void {
    const glowF = this.f('fx_glow_0');
    for (const bl of g.bullets) {
      if (!bl.alive) continue;
      const x = lerp(bl.px, bl.x, alpha), y = lerp(bl.py, bl.y, alpha);
      const key = `b_${bl.kind}`;
      const def = ITEM_MODELS[key] ?? ITEM_MODELS.b_spiral;
      const b = this.batch(key, def, 700);
      const s = bl.r / 8;
      const h = 18 + bl.z;
      const spin = bl.kind === 'pie' || bl.kind === 'popcorn' || bl.kind === 'crown' || bl.kind === 'spoke' || bl.kind === 'ticket' ? bl.rot : Math.atan2(bl.vx, bl.vy);
      b.add(x, y, h, spin, s);
      // a hot halo on the ground and in the air: enemy fire must always read
      this.glow.draw(glowF, x, y, h, s * 0.6, s * 0.6, 0, 1, 0.35, 0.15, 0.75);
      this.addShapes.circle(x, y, bl.r * 1.4, 1, 0.3, 0.1, 0.25, 0);
    }
  }
}

const BALLOON_TINTS: [number, number, number][] = [
  [0.62, 0.1, 0.08], [0.66, 0.46, 0.1], [0.12, 0.34, 0.34], [0.38, 0.14, 0.42], [0.62, 0.55, 0.4], [0.24, 0.38, 0.12],
];
/** Neon colours per ticket tier (blue → green → magenta, D-27). */
const NEON: [number, number, number][] = [[0.12, 0.5, 1], [0.15, 0.95, 0.4], [1, 0.23, 0.82]];
const PLUSH_TINTS: [number, number, number][] = [[0.75, 0.55, 0.4], [0.9, 0.85, 0.75], [0.6, 0.62, 0.68], [0.85, 0.6, 0.6]];

function orbGeo(): THREE.BufferGeometry {
  const g = ITEM_MODELS.b_spark.build();
  return g;
}

export const _unused = { PROPS };
