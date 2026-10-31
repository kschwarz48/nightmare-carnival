// The midway in 3D: every map prop instanced from data/map.ts, the animated attractions (carousel,
// Tilt-a-Whirl arms, High Striker), flickering lamps, sagging string lights, painted signage, and
// the Last Song's quest props reacting to the chain's state — soul lamps that brighten as they are
// fed, carousel plaques that spell the melody, Zoltana's eyes, the striker's racing puck.

import * as THREE from 'three';
import { PROPS, STRING_LIGHTS, TILT_A_WHIRL, type Prop } from '../../data/map';
import { LAST_SONG } from '../../data/quests';
import type { Game } from '../../sim/game';
import { LS, type LastSongChain } from '../../sim/quest';
import { ActorBatch, StaticBatch } from '../core/batch';
import { ModelBuilder, SURF, cyl, sphere, tube, sagPoints, type V3 } from '../core/geo';
import { actorMaterial, pool } from '../core/materials';
import { ENEMY_MODELS, geometryFor } from '../models';
import * as P from '../models/props';
import { LAMP_LIGHT_H } from '../models/props';
import type { GameRenderer3D } from '../renderer3d';

interface KindSpec {
  build: (p: Prop) => THREE.BufferGeometry;
  key?: (p: Prop) => string;
  dither?: boolean;
  anim?: boolean;
  yaw?: (p: Prop) => number;
}

export const PROP_SPECS: Partial<Record<string, KindSpec>> = {
  carousel: { build: () => P.carouselBase() },
  ticket_booth: { build: () => P.ticketBooth(), dither: true },
  prize_stand: { build: () => P.prizeStand(), dither: true },
  stall_ringtoss: { build: (p) => P.stallKind('stall_ringtoss', p.variant ?? 0), key: (p) => `stall_ringtoss_${p.variant ?? 0}`, dither: true },
  stall_bottles: { build: () => P.stallKind('stall_bottles'), dither: true },
  stall_darts: { build: () => P.stallKind('stall_darts'), dither: true },
  stall_shooting: { build: () => P.stallKind('stall_shooting'), dither: true },
  popcorn_cart: { build: () => P.popcornCart(), dither: true },
  cotton_stand: { build: () => P.cottonStand(), dither: true },
  hotdog_stand: { build: () => P.hotdogStand(), dither: true },
  gate_arch: { build: () => P.gateArch(), dither: true },
  ferris_base: { build: () => P.ferrisDeck() },
  funhouse: { build: () => P.funhouse(), dither: true },
  coaster_ruin: { build: (p) => P.coasterRuin(p.w ?? 900), dither: true },
  tilt_a_whirl: { build: () => P.tiltBase() },
  lamp: { build: () => P.lampPost(false), dither: true },
  ghost_lamp: { build: () => P.lampPost(true), dither: true },
  barrel: { build: () => P.barrel() },
  crate: { build: () => P.crate() },
  hay: { build: () => P.hay() },
  tree_dead: { build: (p) => P.deadTree(Math.abs(Math.round(p.x / 7)) % 3), key: (p) => `tree_${Math.abs(Math.round(p.x / 7)) % 3}`, dither: true },
  trash: { build: (p) => P.trash((p.variant ?? Math.abs(Math.round(p.x))) % 3), key: (p) => `trash_${(p.variant ?? Math.abs(Math.round(p.x))) % 3}` },
  balloon_post: { build: () => P.balloonPost(), anim: true, dither: true },
  bench: { build: () => P.bench() },
  pennant_pole: { build: () => P.pennantPole(), anim: true, dither: true },
  sign_midway: { build: () => P.signMidway(), dither: true },
  tombstone_prize: { build: () => P.tombstonePrize() },
  clown_statue: { build: () => P.clownStatue(), dither: true },
  bleachers: { build: () => P.bleachers(), dither: true },
  tent_small: { build: (p) => P.tentSmall(p.variant ?? 0), key: (p) => `tent_${p.variant ?? 0}`, anim: true, dither: true },
  caravan: { build: () => P.caravan(), dither: true, yaw: (p) => (p.flip ? Math.PI : 0) },
  dunk_tank: { build: () => P.dunkTank(), dither: true },
  strongman_tower: { build: () => P.strongmanTower(), dither: true },
  fortune_machine: { build: () => P.fortuneMachine(), dither: true },
  striker_pad: { build: () => P.strikerPad() },
};

/** Text painted onto a sign: Rye lettering in cream with a warm glow. */
export function signMesh(text: string, w: number, h: number, o: { color?: string; glow?: number; bg?: string } = {}): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const ctx = c.getContext('2d')!;
  if (o.bg) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  let size = c.height * 0.72;
  ctx.font = `${size}px Rye, serif`;
  while (ctx.measureText(text).width > c.width * 0.92 && size > 8) {
    size -= 2;
    ctx.font = `${size}px Rye, serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a0f0a';
  ctx.fillText(text, c.width / 2 + 3, c.height / 2 + 4);
  ctx.fillStyle = o.color ?? '#e8d8b0';
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({
    map: tex, transparent: !o.bg, alphaTest: o.bg ? 0 : 0.3, roughness: 0.7, metalness: 0,
    emissive: new THREE.Color(0xffffff), emissiveMap: tex, emissiveIntensity: o.glow ?? 0.6,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

/** How long a melody lamp's emblem wisp floats before it fades (s). */
const WISP_T = 3.6;

export class PropSet {
  private statics: StaticBatch[] = [];
  private animated: { batch: StaticBatch; props: Prop[] }[] = [];
  private lamps: StaticBatch | null = null;
  private lampProps: Prop[] = [];
  /** Soul lamps, re-batched each frame: [cold/green glass, played/red glass]. */
  private ghost: [ActorBatch, ActorBatch] | null = null;
  private ghostProps: Prop[] = [];
  private zoltana: StaticBatch | null = null;
  private pad: StaticBatch | null = null;
  private carouselTop: ActorBatch;
  private horses: ActorBatch;
  private plaques: ActorBatch[] = [];
  private tiltArms: ActorBatch;
  private puck: ActorBatch;
  private bell: ActorBatch;
  private bulbs: StaticBatch;
  private bulbInfo: { x: number; y: number; run: number; k: number }[] = [];
  private bulbH: number[] = [];
  private glowF: import('../../render/atlas').Frame | null = null;
  private carouselAngle = 0;
  private carouselSpeed = 0.04;
  private carousel = PROPS.find((p) => p.kind === 'carousel')!;
  private tower = PROPS.find((p) => p.kind === 'strongman_tower')!;
  private bellFlash = 0;
  /** emblem wisps rising from melody lamps that were just played: lamp index and age (s) */
  private wisps: { lamp: number; t: number }[] = [];

  constructor(private scene: THREE.Object3D) {
    // ---- group static props by model key
    const groups = new Map<string, { spec: KindSpec; props: Prop[] }>();
    for (const p of PROPS) {
      const spec = PROP_SPECS[p.kind];
      if (!spec) continue;
      const key = spec.key ? spec.key(p) : p.kind;
      let gr = groups.get(key);
      if (!gr) groups.set(key, (gr = { spec, props: [] }));
      gr.props.push(p);
    }
    for (const [key, gr] of groups) {
      if (key === 'ghost_lamp') {
        // a lamp whose note has been played swaps to its red-glass twin, so these re-batch every frame
        this.ghostProps = gr.props;
        this.ghost = [false, true].map((red) => {
          const b = new ActorBatch(P.lampPost(true, red), actorMaterial({ dither: gr.spec.dither, emitBoost: 2.6, envIntensity: 0.5, detail: true }), gr.props.length, { shadow: true });
          scene.add(b.mesh);
          return b;
        }) as [ActorBatch, ActorBatch];
        continue;
      }
      const geo = gr.spec.build(gr.props[0]);
      const mat = actorMaterial({ dither: gr.spec.dither, emitBoost: 2.6, envIntensity: 0.5, detail: true });
      const b = new StaticBatch(geo, mat, gr.props.length, { shadow: true });
      b.rim = [0, 0, 0, 0];
      for (const p of gr.props) b.add(p.x, p.y, 0, gr.spec.yaw ? gr.spec.yaw(p) : 0, 1);
      b.freeze();
      scene.add(b.mesh);
      if (key === 'lamp') { this.lamps = b; this.lampProps = gr.props; }
      else if (key === 'fortune_machine') this.zoltana = b;
      else if (key === 'striker_pad') this.pad = b;
      else if (gr.spec.anim) this.animated.push({ batch: b, props: gr.props });
      this.statics.push(b);
    }
    // ---- fences and rails: tiled sections along their length
    const section = (kind: 'fence' | 'rail', len: number) => (kind === 'fence' ? P.fenceSection(len) : P.railSection(len));
    for (const kind of ['fence', 'rail'] as const) {
      const list = PROPS.filter((p) => (kind === 'fence' ? p.kind === 'fence_h' || p.kind === 'fence_v' : p.kind === 'rail'));
      if (!list.length) continue;
      const SEG = 120;
      let count = 0;
      for (const p of list) count += Math.ceil((p.w ?? SEG) / SEG);
      const b = new StaticBatch(section(kind, SEG), actorMaterial({ dither: kind === 'fence', detail: true }), count, { shadow: true });
      b.rim = [0, 0, 0, 0];
      for (const p of list) {
        const len = p.w ?? SEG;
        const n = Math.ceil(len / SEG);
        const vertical = p.kind === 'fence_v';
        for (let i = 0; i < n; i++) {
          const o = -len / 2 + SEG * (i + 0.5);
          b.add(vertical ? p.x : p.x + o, vertical ? p.y + o : p.y, 0, vertical ? Math.PI / 2 : 0, 1, (len / n) / SEG, 1, 1);
        }
      }
      b.freeze();
      scene.add(b.mesh);
      this.statics.push(b);
    }
    // ---- dynamic attractions
    const dyn = (geo: THREE.BufferGeometry, cap: number, shadow = true, emit = 2.6) => {
      const b = new ActorBatch(geo, actorMaterial({ emitBoost: emit, dither: true, detail: true }), cap, { shadow });
      b.rim = [0, 0, 0, 0];
      scene.add(b.mesh);
      return b;
    };
    this.carouselTop = dyn(P.carouselTop(), 1);
    this.horses = dyn(geometryFor('carousel_horse', ENEMY_MODELS.carousel_horse), 12);
    // emblem plaques: one on the carousel, plus room for the wisps played lamps send up (D-58)
    for (let k = 0; k < 6; k++) this.plaques.push(dyn(P.plaque(k), k === 5 ? 7 : k >= 1 && k <= 4 ? 3 : 1, false, 3));
    this.tiltArms = dyn(P.tiltArm(), 2);
    this.puck = dyn(P.strikerPuck(), 1, false, 3);
    this.bell = dyn(P.strikerBell(), 1, false, 3);
    // ---- string lights: wires (one static mesh) + bulbs (instanced, chase/flicker per bulb)
    const wire = new ModelBuilder();
    let nb = 0;
    for (let r = 0; r < STRING_LIGHTS.length; r++) {
      const [x1, y1, x2, y2] = STRING_LIGHTS[r];
      const pts = sagPoints([x1, 140, y1], [x2, 140, y2], 34, 10);
      wire.add(tube(pts, 0.7, 4, 20), { col: 0x0c0a0a, surf: SURF.rubber });
      for (let k = 1; k < 10; k++) {
        this.bulbInfo.push({ x: pts[k][0], y: pts[k][2], run: r, k });
        nb++;
      }
    }
    const wm = new THREE.Mesh(wire.build({ ao: 0 }), actorMaterial({}));
    wm.frustumCulled = false;
    scene.add(wm);
    const bulbGeo = new ModelBuilder().add(sphere(3.6, 8, 6), { col: 0xffffff, emit: 1, surf: SURF.bulb }).add(cyl(1.2, 1.2, 2.4, 5), { col: 0x6a5428, pos: [0, 2.8, 0], surf: SURF.brass }).build({ ao: 0 });
    this.bulbs = new StaticBatch(bulbGeo, actorMaterial({ emitBoost: 2.6 }), nb, { shadow: false });
    this.bulbs.rim = [0, 0, 0, 0];
    for (let i = 0; i < this.bulbInfo.length; i++) {
      const b = this.bulbInfo[i];
      const pts = sagPoints([STRING_LIGHTS[b.run][0], 140, STRING_LIGHTS[b.run][1]], [STRING_LIGHTS[b.run][2], 140, STRING_LIGHTS[b.run][3]], 34, 10);
      this.bulbs.add(b.x, b.y, pts[b.k][1] - 4, 0, 1);
      this.bulbH.push(pts[b.k][1] - 4);
    }
    this.bulbs.freeze();
    scene.add(this.bulbs.mesh);
    // ---- painted signs
    const signs: [string, number, number, number, number, number, number, number?][] = [];
    const hdrY = P.BOOTH.headerY + P.BOOTH.headerH * 0.42, hdrZ = P.BOOTH.headerZ + 3.4;
    for (const p of PROPS) {
      if (p.kind === 'gate_arch') signs.push([p.label ?? 'MIDWAY', p.x, p.y, 230, 30, 238, 6]);
      if (p.kind === 'ticket_booth') signs.push(['TICKETS', p.x, p.y, 140, 26, 190, 70, -0.2]);
      if (p.kind === 'prize_stand') signs.push(['PRIZES', p.x, p.y, 128, 20, hdrY, (p.hh ?? 70) + hdrZ]);
      if (p.kind === 'stall_ringtoss') signs.push(['RING TOSS', p.x, p.y, 98, 18, hdrY, (p.hh ?? 60) + hdrZ]);
      if (p.kind === 'stall_bottles') signs.push(['KNOCK EM DOWN', p.x, p.y, 98, 18, hdrY, (p.hh ?? 60) + hdrZ]);
      if (p.kind === 'stall_darts') signs.push(['POP-A-BALLOON', p.x, p.y, 98, 18, hdrY, (p.hh ?? 60) + hdrZ]);
      if (p.kind === 'stall_shooting') signs.push(['SHOOTING GALLERY', p.x, p.y, 114, 18, hdrY, (p.hh ?? 65) + hdrZ]);
      if (p.kind === 'sign_midway') signs.push(['THE MIDWAY', p.x, p.y, 150, 34, 110, 3]);
      if (p.kind === 'funhouse') signs.push(['FUN HOUSE', p.x, p.y, 260, 44, 236, 60]);
      if (p.kind === 'fortune_machine') signs.push(['ZOLTANA', p.x, p.y, 60, 12, 168, 16]);
      if (p.kind === 'strongman_tower') signs.push(['HIGH STRIKER', p.x, p.y, 70, 12, 300, 9]);
      if (p.kind === 'hotdog_stand') signs.push(['RED HOTS', p.x, p.y, 120, 20, 112, 56]);
      if (p.kind === 'cotton_stand') signs.push(['CANDY FLOSS', p.x, p.y, 120, 18, 118, 50]);
    }
    for (const [text, x, y, w, h, hy, dz, tilt] of signs) {
      const m = signMesh(text, w, h, { glow: 0.55 });
      m.position.set(x, hy, y + dz);
      m.rotation.x = tilt ?? 0;
      scene.add(m);
    }
  }

  /** A played melody lamp sends up a wisp of its emblem (the carousel's plaque for that lamp). */
  wisp(lamp: number): void {
    if (lamp >= 0 && lamp < 4) this.wisps.push({ lamp, t: 0 });
  }

  private quest(g: Game): LastSongChain | undefined {
    return g.quests?.get<LastSongChain>('last_song');
  }

  update(g: Game, r: GameRenderer3D, inView: (x: number, y: number) => boolean, dt: number): void {
    const t = r.time;
    const ls = this.quest(g);
    const stage = ls?.stage ?? 0;
    // swaying canvas, balloons and pennants
    for (const a of this.animated) {
      for (let i = 0; i < a.props.length; i++) a.batch.anim(i, t * 1.6 + a.props[i].x * 0.01, 0, 0, 1);
      a.batch.refresh();
    }
    // lamps burn steady (a few are failing); Lights Out kills them
    const lightsOn = 1 - g.darkness * 0.92;
    if (this.lamps) {
      for (let i = 0; i < this.lampProps.length; i++) {
        const p = this.lampProps[i];
        const fl = lampFlicker(p, t) * lightsOn;
        this.lamps.tint(i, 1, 1, 1, fl);
        // the lantern wears a soft warm halo, so the light visibly comes from the lamp head
        if (fl > 0.1 && inView(p.x, p.y)) r.glow.draw(this.glowF ??= r.assets.atlas.get('fx_glow_0'), p.x, p.y, LAMP_LIGHT_H, 0.8, 0.8, 0, 1, 0.6, 0.3, 0.42 * fl);
      }
      this.lamps.refresh();
    }
    // soul lamps: dark glass that fills with ghost-light as souls are fed; lit lamps burn green, and a
    // lamp whose note has been played burns red until a wrong note resets the melody
    if (this.ghost) {
      const [cold, red] = this.ghost;
      cold.begin();
      red.begin();
      for (let i = 0; i < this.ghostProps.length; i++) {
        const p = this.ghostProps[i];
        const li = LAST_SONG.lamps.findIndex((l) => l.x === p.x && l.y === p.y);
        const lit = ls?.lit[li] ?? false;
        const played = !!ls && li >= 0 && ls.played(li);
        const fill = ls ? ls.souls[li] / LAST_SONG.soulsPerLamp : 0;
        const e = played ? 0.7 : lit ? 0.85 + 0.15 * Math.sin(t * 3 + i) : stage >= LS.Souls ? 0.05 + fill * 0.55 * (0.8 + 0.2 * Math.sin(t * 6 + i)) : 0.04;
        const b = played ? red : cold;
        b.tint(b.add(p.x, p.y, 0, 0, 1), 1, 1, 1, e);
      }
      cold.end();
      red.end();
    }
    // Zoltana's eyes: half-asleep until spoken to; bright whenever she has something new to say
    if (this.zoltana) {
      const m = LAST_SONG.machine;
      const near = Math.hypot(g.player.x - m.x, g.player.y - m.y) < m.r * 2.5;
      this.zoltana.tint(0, 1, 1, 1, (near ? 1 : 0.35) * (0.8 + 0.2 * Math.sin(t * 2.3)));
      this.zoltana.refresh();
    }
    if (this.pad) {
      this.pad.tint(0, 1, 1, 1, stage === LS.Striker ? 0.6 + 0.4 * Math.sin(t * 8) : 0.15);
      this.pad.refresh();
    }
    // the carousel creaks round; once the lamps are lit it wakes and turns properly
    const want = stage >= LS.Melody && stage < LS.Complete ? 0.32 : 0.035;
    this.carouselSpeed += (want - this.carouselSpeed) * (1 - Math.exp(-dt * 0.6));
    this.carouselAngle += this.carouselSpeed * dt;
    const c = this.carousel;
    const yaw = this.carouselAngle;
    for (const b of [this.carouselTop, this.horses, this.tiltArms, this.puck, this.bell, ...this.plaques]) b.begin();
    if (inView(c.x, c.y)) {
      this.carouselTop.add(c.x, c.y, 0, yaw, 1);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.26 - yaw;
        const hx = c.x + Math.cos(a) * 128, hy = c.y + Math.sin(a) * 128;
        const bob = 26 + Math.sin(this.carouselAngle * 6 + i * 1.7) * 10;
        // horses face along the direction of travel (tangent)
        const k = this.horses.add(hx, hy, bob - 30, Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI, 0.8);
        this.horses.anim(k, this.carouselAngle * 20 + i, 0, 0, 0.3);
      }
      // plaques: the brass skull, then the four emblems in the night's order, then stars
      const order = ls?.order ?? [0, 1, 2, 3];
      const glow = stage >= LS.Melody ? 1 : 0.25;
      let star = 0;
      for (let slot = 0; slot < 12; slot++) {
        const kind = slot === 0 ? 0 : slot <= 4 ? 1 + order[slot - 1] : 5;
        const a = (slot / 12) * Math.PI * 2 - yaw;
        const px = c.x + Math.cos(a) * 201, py = c.y + Math.sin(a) * 201;
        const b = this.plaques[kind];
        const k = b.add(px, py, 150, Math.atan2(Math.cos(a), Math.sin(a)), 1.25);
        b.tint(k, 1, 1, 1, kind === 5 ? 0.4 : glow * (0.85 + 0.15 * Math.sin(t * 4 + slot)));
        if (kind === 5) star++;
      }
      void star;
    }
    // melody wisps: the lamp's emblem rises out of its lantern, glowing red, sways and fades away
    for (const w of this.wisps) w.t += dt;
    this.wisps = this.wisps.filter((w) => w.t < WISP_T);
    for (const w of this.wisps) {
      const L = LAST_SONG.lamps[w.lamp];
      if (!inView(L.x, L.y)) continue;
      const u = w.t / WISP_T;
      const s = Math.min(1, w.t / 0.35) * Math.min(1, (WISP_T - w.t) / 0.8);
      const hgt = LAMP_LIGHT_H + 34 + 96 * (1 - (1 - u) * (1 - u));
      const b = this.plaques[1 + w.lamp];
      b.tint(b.add(L.x, L.y, hgt, 0.35 * Math.sin(w.t * 2.2), 1.3 * s), 1, 0.62, 0.5, 1.5 + 0.4 * Math.sin(w.t * 9));
      r.glow.draw(this.glowF ??= r.assets.atlas.get('fx_glow_0'), L.x, L.y, hgt + 6, 1.5, 1.5, 0, 1, 0.42, 0.32, 0.55 * s);
    }
    // Tilt-a-Whirl arms follow the sim's hazard angle exactly
    const whirl = TILT_A_WHIRL;
    if (whirl && inView(whirl.x, whirl.y)) {
      for (let k = 0; k < 2; k++) {
        const a = g.tiltAngle + k * Math.PI;
        this.tiltArms.add(whirl.x, whirl.y, 0, -a, whirl.armLen / 260);
      }
    }
    // High Striker: the puck races on the rail during the timing trial, else it twitches at rest
    const tw = this.tower;
    if (inView(tw.x, tw.y)) {
      const hgt = stage === LS.Striker && ls ? ls.strikerHeight() : 0.04 + Math.max(0, Math.sin(t * 0.7)) * 0.03;
      this.puck.add(tw.x, tw.y + 8, 30 + hgt * 262, 0, 1);
      if (stage === LS.Striker && ls?.strikerInWindow()) this.bellFlash = 1;
      this.bellFlash = Math.max(0, this.bellFlash - dt * 2.5);
      const bi = this.bell.add(tw.x, tw.y - 4, 296, 0, 1);
      this.bell.tint(bi, 1, 1, 1, 0.3 + this.bellFlash * 2);
    }
    for (const b of [this.carouselTop, this.horses, this.tiltArms, this.puck, this.bell, ...this.plaques]) b.end();
    // string-light chase: a slow travelling wave, a few dead bulbs, Lights Out kills them
    for (let i = 0; i < this.bulbInfo.length; i++) {
      const b = this.bulbInfo[i];
      // steady, saturated carnival bulbs; only the odd one stutters like a dying neon sign
      const seed = b.run * 31 + b.k * 17;
      const dead = seed % 29 === 0 ? 0.04 : 1;
      const on = seed % 9 === 0 ? dyingNeon(t, seed) : 0.94 + 0.06 * Math.sin(t * 0.7 + seed);
      const col = BULB_COLS[(b.k + b.run * 2) % BULB_COLS.length];
      const lum = on * dead * lightsOn;
      this.bulbs.tint(i, col[0], col[1], col[2], lum);
      // each bulb wears a soft halo of its own colour
      if (lum > 0.1 && inView(b.x, b.y)) r.glow.draw(this.glowF ??= r.assets.atlas.get('fx_glow_0'), b.x, b.y, this.bulbH[i], 0.34, 0.34, 0, col[0], col[1], col[2], 0.55 * lum);
    }
    this.bulbs.refresh();
  }

  addLights(g: Game, time: number): void {
    const lightsOn = 1 - g.darkness * 0.92;
    for (const p of this.lampProps) {
      const fl = lampFlicker(p, time) * lightsOn;
      pool.add(p.x, p.y, 320, 1.55 * fl, 1, 0.56, 0.24, LAMP_LIGHT_H);
    }
    const ls = this.quest(g);
    for (let i = 0; i < this.ghostProps.length; i++) {
      const p = this.ghostProps[i];
      const li = LAST_SONG.lamps.findIndex((l) => l.x === p.x && l.y === p.y);
      if (ls && li >= 0 && ls.played(li)) pool.add(p.x, p.y, 300, 1.4, 1, 0.16, 0.1, LAMP_LIGHT_H, 2);
      else if (ls?.lit[li]) pool.add(p.x, p.y, 300, 1.0 + 0.2 * Math.sin(time * 3 + i), 0.45, 1, 0.7, LAMP_LIGHT_H, 2);
      else if (ls && ls.stage >= LS.Souls && ls.souls[li] > 0) pool.add(p.x, p.y, 160, 0.25 + 0.5 * (ls.souls[li] / LAST_SONG.soulsPerLamp), 0.45, 1, 0.7, LAMP_LIGHT_H);
    }
    // a few soft pools along each string-light run
    for (let r = 0; r < STRING_LIGHTS.length; r++) {
      const [x1, y1, x2, y2] = STRING_LIGHTS[r];
      // the run's mixed colours wash the ground beneath in a warm, rosy light
      pool.add((x1 + x2) / 2, (y1 + y2) / 2, 240, 0.5 * lightsOn, 1, 0.5, 0.38, 110);
    }
    for (const p of PROPS) {
      const hh = p.hh ?? 0;
      switch (p.kind) {
        case 'stall_ringtoss': case 'stall_bottles': case 'stall_darts': case 'stall_shooting': case 'prize_stand':
          pool.add(p.x, p.y + hh - 12, 230, 1.15 * lightsOn, 1, 0.62, 0.26, 92);
          break;
        case 'ticket_booth':
          pool.add(p.x, p.y + hh + 24, 220, 1.0 * lightsOn, 1, 0.66, 0.3, 80);
          break;
        case 'caravan':
          pool.add(p.x - 20, p.y + 70, 200, 0.75 * lightsOn, 1, 0.6, 0.3, 80);
          break;
        case 'popcorn_cart':
          pool.add(p.x, p.y + 20, 150, 0.8 * lightsOn, 1, 0.8, 0.4, 70);
          break;
        case 'funhouse':
          pool.add(p.x, p.y + 140, 300, 0.8 * lightsOn, 0.8, 0.85, 0.3, 120);
          break;
      }
    }
    const m = LAST_SONG.machine;
    pool.add(m.x, m.y + 30, 180, 0.5, 0.7, 0.5, 1, 120);
    if (this.bellFlash > 0) pool.add(this.tower.x, this.tower.y, 320, this.bellFlash * 1.6, 1, 0.85, 0.4, 290, 3);
  }
}

/** Saturated carnival bulb colours: red, amber, teal, rose, cobalt. */
const BULB_COLS: [number, number, number][] = [[1, 0.16, 0.08], [1, 0.52, 0.05], [0.08, 0.85, 0.55], [1, 0.22, 0.55], [0.22, 0.45, 1]];

/** Street lamps burn steady; a few (about one in six, picked by position) are failing and stutter, never in step. */
export function lampFlicker(p: { x: number; y: number }, t: number): number {
  const v = Math.sin(p.x * 12.9898 + p.y * 78.233) * 43758.5453;
  const h = v - Math.floor(v);
  if (h >= 0.15) return 0.97 + 0.03 * Math.sin(t * 0.6 + h * 40);
  return dyingNeon(t, Math.floor(h * 997) + 1);
}

/** A failing tube: steady most of the time, then a burst of irregular stutters. */
export function dyingNeon(t: number, seed: number): number {
  const cycle = 3.2 + (seed % 5) * 0.9;
  const ph = (t + seed * 1.37) % cycle;
  if (ph > 0.85) return 1;
  const s = Math.sin(t * 47 + seed) * Math.sin(t * 13.3 + seed * 2.1);
  return s > 0.05 ? 1 : 0.06;
}

export const _unused = { cyl } as Record<string, unknown> & { v?: V3 };
