// Visual effects (doc 02 §6 "juice"): themed death bursts, impact sparks, explosions, rings,
// slashes, damage numbers, screen shake/flash. Consumes the sim's FxEvent queue. Budgeted pools.

import type { FxEvent } from '../sim/fx';
import type { Assets } from './assets';
import type { Frame } from './atlas';
import type { LightRig } from './lights';
import type { ShapeBatch } from './shapes';
import type { SpriteLayer } from './sprites';

interface Particle {
  alive: boolean;
  f: Frame;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  grav: number; drag: number;
  life: number; max: number;
  rot: number; vr: number;
  s0: number; s1: number;
  r: number; g: number; b: number;
  add: boolean;
  fade: number; // 0 linear, 1 late fade
}

interface Ephemeral {
  alive: boolean;
  kind: 'ring' | 'slash' | 'disk' | 'beam';
  x: number; y: number; x2: number; y2: number;
  r: number; a: number; half: number;
  life: number; max: number;
  cr: number; cg: number; cb: number;
  width: number;
}

interface Num {
  alive: boolean;
  x: number; y: number; vy: number;
  text: string;
  crit: boolean;
  life: number;
  scale: number;
}

interface Flash { x: number; y: number; r: number; life: number; max: number; cr: number; cg: number; cb: number; i: number }

const COLORS: Record<string, [number, number, number]> = {
  firework: [1, 0.55, 0.85], finale: [1, 0.85, 0.35], finale_small: [1, 0.75, 0.4], popcorn: [1, 0.95, 0.75], cannon: [1, 0.6, 0.3],
  frost: [0.6, 0.9, 1], fire: [1, 0.5, 0.15], jack: [1, 0.4, 0.2], boss: [1, 0.55, 0.3], deathcard: [0.75, 0.4, 1], beam: [1, 1, 0.85],
  bell: [1, 0.85, 0.4], jackpot: [1, 0.95, 0.3], pound: [1, 0.8, 0.6], shock: [1, 0.45, 0.25], blizzard: [0.65, 0.92, 1],
  inferno: [1, 0.45, 0.1], gravity: [0.7, 0.5, 1], revive: [1, 0.6, 0.8], mallet: [1, 0.92, 0.7], frenzy: [1, 0.85, 0.5],
  cotton: [1, 0.6, 0.85],
};

export class FxSystem {
  private parts: Particle[] = [];
  private eph: Ephemeral[] = [];
  private nums: Num[] = [];
  private flashes: Flash[] = [];
  shake = 0;
  shakeX = 0;
  shakeY = 0;
  screenFlash = 0;
  screenFlashCol: [number, number, number] = [1, 1, 1];
  reducedFlash = false;
  shakeScale = 1;
  showNumbers = true;
  particleBudget = 1400;
  private frames: Record<string, Frame[]> = {};
  private digit: Record<string, Frame> = {};
  private digitC: Record<string, Frame> = {};
  private rand = Math.random;

  constructor(private assets: Assets) {
    const A = assets.atlas;
    for (const [key] of A.frames) {
      if (!key.startsWith('fx_')) continue;
      const kind = key.slice(3, key.lastIndexOf('_'));
      (this.frames[kind] ??= []).push(A.get(key));
    }
    for (const ch of '0123456789') {
      this.digit[ch] = A.get(`d_${ch}`);
      this.digitC[ch] = A.get(`dc_${ch}`);
    }
    for (let i = 0; i < 1800; i++) this.parts.push({ alive: false } as Particle);
    for (let i = 0; i < 160; i++) this.eph.push({ alive: false } as Ephemeral);
    for (let i = 0; i < 140; i++) this.nums.push({ alive: false } as Num);
  }

  private fr(kind: string): Frame {
    const a = this.frames[kind] ?? this.frames.glow;
    return a[Math.floor(this.rand() * a.length)];
  }

  private activeParts = 0;
  private spawn(kind: string, x: number, y: number, o: Partial<Particle> = {}): void {
    if (this.activeParts >= this.particleBudget) return;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (p.alive) continue;
      p.alive = true;
      p.f = this.fr(kind);
      p.x = x; p.y = y; p.z = o.z ?? 0;
      p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0;
      p.grav = o.grav ?? 0; p.drag = o.drag ?? 1.5;
      p.life = p.max = o.max ?? 0.6;
      p.rot = o.rot ?? this.rand() * 6.28; p.vr = o.vr ?? 0;
      p.s0 = o.s0 ?? 1; p.s1 = o.s1 ?? 0.6;
      p.r = o.r ?? 1; p.g = o.g ?? 1; p.b = o.b ?? 1;
      p.add = o.add ?? false;
      p.fade = o.fade ?? 0;
      this.activeParts++;
      return;
    }
  }

  private burst(kind: string, x: number, y: number, n: number, speed: number, o: Partial<Particle> = {}): void {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * 6.283;
      const sp = speed * (0.4 + this.rand() * 0.8);
      this.spawn(kind, x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, vz: o.vz !== undefined ? o.vz * (0.6 + this.rand() * 0.8) : 0, vr: (this.rand() - 0.5) * 14, ...o });
    }
  }

  private ephem(kind: Ephemeral['kind'], x: number, y: number, r: number, life: number, col: [number, number, number], o: Partial<Ephemeral> = {}): void {
    for (const e of this.eph) {
      if (e.alive) continue;
      Object.assign(e, { alive: true, kind, x, y, x2: o.x2 ?? x, y2: o.y2 ?? y, r, a: o.a ?? 0, half: o.half ?? 0, life, max: life, cr: col[0], cg: col[1], cb: col[2], width: o.width ?? 6 });
      return;
    }
  }

  private flashLight(x: number, y: number, r: number, life: number, col: [number, number, number], i = 1.4): void {
    if (this.flashes.length > 14) this.flashes.shift();
    this.flashes.push({ x, y, r, life, max: life, cr: col[0], cg: col[1], cb: col[2], i });
  }

  handle(events: FxEvent[]): void {
    for (const e of events) this.one(e);
  }

  private one(e: FxEvent): void {
    switch (e.type) {
      case 'death': this.death(e); break;
      case 'hit':
        if (this.activeParts < this.particleBudget * 0.7) this.spawn('spark', e.x + (this.rand() - 0.5) * 8, e.y - 14, { max: 0.16, s0: 0.5, s1: 0.2, add: true, r: 1, g: 0.95, b: 0.7 });
        break;
      case 'crit':
        this.spawn('star', e.x, e.y - 30, { vy: -60, max: 0.45, s0: 1.4, s1: 0.4, vr: 6 });
        this.spawn('spark', e.x, e.y - 20, { max: 0.22, s0: 1.3, s1: 0.4, add: true, r: 1, g: 0.9, b: 0.3 });
        break;
      case 'explosion': this.explosion(e); break;
      case 'ring': {
        const col = COLORS[e.style] ?? [1, 0.8, 0.5];
        this.ephem('ring', e.x, e.y, e.a, e.style === 'gravity' ? 0.6 : 0.4, col, { width: e.style === 'jackpot' ? 12 : 7 });
        if (e.style === 'jackpot' || e.style === 'revive') this.flashLight(e.x, e.y, e.a * 2, 0.5, col, 2);
        if (e.style === 'pound' || e.style === 'shock' || e.style === 'bell') this.burst('smoke', e.x, e.y, 6, e.a * 1.4, { max: 0.5, s0: 0.5, s1: 1.1, r: 0.8, g: 0.75, b: 0.7 });
        break;
      }
      case 'slash': {
        const col = COLORS[e.style] ?? [1, 1, 1];
        this.ephem('slash', e.x, e.y, e.c, e.style === 'frenzy' ? 0.22 : 0.18, col, { a: e.a, half: e.b });
        if (e.style === 'fire') for (let i = 0; i < 6; i++) {
          const a = e.a + (this.rand() - 0.5) * e.b * 2, d = e.c * (0.3 + this.rand() * 0.7);
          this.spawn('flame', e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, { vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 30, max: 0.4, s0: 1.6, s1: 0.4, add: true });
        }
        if (e.style === 'frost') for (let i = 0; i < 5; i++) {
          const a = e.a + (this.rand() - 0.5) * e.b * 2, d = e.c * this.rand();
          this.spawn('snow', e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, { vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, max: 0.6, s0: 1.2, s1: 0.5 });
        }
        if (e.style === 'cotton') for (let i = 0; i < 6; i++) {
          const a = e.a + (this.rand() - 0.5) * e.b * 2, d = e.c * this.rand();
          this.spawn('sugar', e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, { vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, max: 0.5, s0: 1.4, s1: 0.4 });
        }
        break;
      }
      case 'dmgnum': {
        if (!this.showNumbers) break;
        const n = Math.round(e.a);
        if (n <= 0) break;
        this.number(e.x + (this.rand() - 0.5) * 12, e.y, String(n), e.b > 0);
        break;
      }
      case 'heal':
        this.number(e.x, e.y - 20, String(Math.round(e.a)), false, true);
        this.burst('star', e.x, e.y - 20, 6, 80, { max: 0.6, r: 0.5, g: 1, b: 0.5, s0: 0.8, s1: 0.2 });
        break;
      case 'pickup':
        this.burst('spark', e.x, e.y, 10, 160, { max: 0.4, add: true, r: 0.6, g: 1, b: 0.7 });
        break;
      case 'levelup':
        this.ephem('ring', e.x, e.y, 160, 0.6, [1, 0.9, 0.4], { width: 10 });
        this.burst('star', e.x, e.y - 30, 14, 240, { max: 0.8, s0: 1.2, s1: 0.2, vr: 8 });
        this.flashLight(e.x, e.y, 400, 0.6, [1, 0.9, 0.5], 1.6);
        break;
      case 'evolve':
        this.ephem('ring', e.x, e.y, 320, 0.9, [1, 0.85, 0.3], { width: 16 });
        this.ephem('ring', e.x, e.y, 200, 0.7, [1, 1, 1], { width: 8 });
        this.burst('star', e.x, e.y - 30, 30, 360, { max: 1.1, s0: 1.6, s1: 0.2, vr: 10 });
        this.burst('confetti', e.x, e.y - 30, 40, 300, { vz: 300, grav: 600, max: 1.4, drag: 1.2, s0: 1.2, s1: 1 });
        this.flashLight(e.x, e.y, 700, 1.0, [1, 0.85, 0.4], 2.2);
        this.flash(0.45, [1, 0.9, 0.5]);
        break;
      case 'chest':
        this.burst('confetti', e.x, e.y - 20, 36, 260, { vz: 320, grav: 650, max: 1.3, drag: 1.2 });
        this.burst('star', e.x, e.y - 20, 12, 200, { max: 0.8 });
        this.flashLight(e.x, e.y, 360, 0.7, [1, 0.9, 0.6], 1.8);
        break;
      case 'shake':
        this.shake = Math.min(1.4, this.shake + e.a);
        break;
      case 'flash': {
        const col: [number, number, number] = e.style === 'fire' ? [1, 0.5, 0.2] : e.style === 'gold' ? [1, 0.9, 0.4] : [1, 1, 1];
        this.flash(e.a, col);
        break;
      }
      case 'text':
        this.textNum(e.x, e.y, e.text ?? '');
        break;
      case 'spark': this.sparks(e); break;
      case 'boss_death':
        this.burst('confetti', e.x, e.y - 60, 80, 420, { vz: 380, grav: 600, max: 2, drag: 1 });
        this.burst('smoke', e.x, e.y - 40, 20, 200, { max: 1.4, s0: 1.2, s1: 2.4, r: 0.7, g: 0.65, b: 0.7 });
        this.ephem('ring', e.x, e.y, 520, 1.1, [1, 0.8, 0.4], { width: 18 });
        this.flashLight(e.x, e.y, 900, 1.5, [1, 0.8, 0.5], 2.4);
        this.flash(0.6, [1, 0.95, 0.8]);
        break;
      case 'confetti':
        this.burst('confetti', e.x, e.y, Math.round(24 * e.a), 240, { vz: 260, grav: 600, max: 1.2, drag: 1.2 });
        break;
      case 'dust':
        this.burst('smoke', e.x, e.y, Math.round(6 * e.a), 90 * e.a, { max: 0.6, s0: 0.5, s1: 1.2, r: 0.6, g: 0.5, b: 0.4 });
        break;
    }
  }

  private flash(a: number, col: [number, number, number]): void {
    const v = this.reducedFlash ? a * 0.25 : a;
    if (v > this.screenFlash) {
      this.screenFlash = v;
      this.screenFlashCol = col;
    }
  }

  private death(e: FxEvent): void {
    const s = Math.max(0.6, e.a);
    const x = e.x, y = e.y - 18 * s;
    const elite = e.b > 0;
    const n = elite ? 2 : 1;
    switch (e.style) {
      case 'pop':
        this.burst('latex', x, y, 6 * n, 220 * s, { vz: 120, grav: 500, max: 0.55, s0: 1.3 * s, s1: 0.8 * s });
        this.burst('confetti', x, y, 5 * n, 180 * s, { vz: 160, grav: 500, max: 0.7 });
        this.ephem('ring', x, y, 26 * s, 0.18, [1, 1, 1], { width: 3 });
        break;
      case 'springs':
        this.burst('spring', x, y, 3 * n, 200, { vz: 260, grav: 700, max: 0.8, vr: 12, s0: 1.2 * s, s1: 1 * s });
        this.burst('gear', x, y, 4 * n, 220, { vz: 220, grav: 700, max: 0.8, vr: 14, s0: 1.2 * s, s1: 1 * s });
        break;
      case 'stuffing':
        this.burst('stuffing', x, y, 8 * n, 160 * s, { vz: 120, grav: 300, max: 0.9, drag: 2.5, s0: 1.4 * s, s1: 1.8 * s });
        this.burst('button', x, y, 2 * n, 200, { vz: 220, grav: 700, max: 0.8 });
        break;
      case 'sugar':
        this.burst('sugar', x, y, 14 * n, 160 * s, { vz: 140, grav: 500, max: 0.8, s0: 1.4, s1: 0.6 });
        break;
      case 'bonk':
        this.burst('star', x, y - 10, 5, 120, { vz: 160, grav: 400, max: 0.7, vr: 8 });
        this.burst('smoke', x, y + 10, 4, 60, { max: 0.5, s0: 0.5, s1: 1, r: 0.6, g: 0.5, b: 0.4 });
        break;
      case 'deflate':
        this.burst('confetti', x, y, 10 * n, 200, { vz: 200, grav: 500, max: 0.9 });
        this.burst('smoke', x, y, 3, 60, { max: 0.5, s0: 0.6, s1: 1, r: 0.9, g: 0.9, b: 0.9 });
        break;
      case 'splash':
        this.burst('droplet', x, y, 14 * n, 220, { vz: 260, grav: 700, max: 0.8, s0: 1.2, s1: 0.8 });
        break;
      case 'wood':
        this.burst('splinter', x, y, 9 * n, 240 * s, { vz: 220, grav: 700, max: 0.9, vr: 14, s0: 1.4 * s, s1: 1.2 * s });
        break;
      case 'ceramic':
        this.burst('shard', x, y, 12 * n, 260, { vz: 240, grav: 700, max: 0.9, vr: 14, s0: 1.4, s1: 1.1 });
        break;
      case 'boards':
        this.burst('board', x, y, 10, 280, { vz: 300, grav: 700, max: 1.1, vr: 10, s0: 1.8, s1: 1.6 });
        this.burst('confetti', x, y, 26, 320, { vz: 300, grav: 600, max: 1.3 });
        break;
      case 'derail':
        this.burst('gear', x, y, 10, 320, { vz: 300, grav: 700, max: 1.1, vr: 14, s0: 1.6, s1: 1.2 });
        this.burst('spark', x, y, 16, 320, { max: 0.5, add: true, r: 1, g: 0.85, b: 0.4 });
        this.flashLight(x, y, 220, 0.4, [1, 0.8, 0.4]);
        break;
      case 'crumple':
        this.burst('spark', x, y, 10, 220, { max: 0.4, add: true, r: 0.6, g: 0.9, b: 1 });
        this.burst('gear', x, y, 4, 200, { vz: 200, grav: 700, max: 0.8, vr: 12 });
        break;
      case 'brute':
        this.burst('confetti', x, y - 20, 40, 320, { vz: 300, grav: 600, max: 1.3 });
        this.burst('smoke', x, y, 10, 140, { max: 0.8, s0: 1, s1: 2, r: 0.8, g: 0.7, b: 0.6 });
        this.ephem('ring', x, y, 120, 0.4, [1, 0.8, 0.5], { width: 10 });
        break;
      case 'confetti':
      default:
        this.burst('confetti', x, y, 8, 200, { vz: 200, grav: 500, max: 0.8 });
    }
    if (elite) {
      this.ephem('ring', x, y, 70 * s, 0.35, [1, 0.85, 0.2], { width: 6 });
      this.flashLight(x, y, 200, 0.35, [1, 0.85, 0.3]);
    }
  }

  private explosion(e: FxEvent): void {
    const col = COLORS[e.style] ?? [1, 0.7, 0.4];
    const r = e.a;
    this.ephem('disk', e.x, e.y, r, 0.22, col);
    this.ephem('ring', e.x, e.y, r * 1.1, 0.32, col, { width: 6 });
    const big = e.style === 'finale' || e.style === 'boss';
    this.flashLight(e.x, e.y, r * 3, big ? 0.5 : 0.25, col, big ? 2 : 1.2);
    if (e.style === 'firework' || e.style === 'finale' || e.style === 'finale_small') {
      // chrysanthemum: radial streaking sparks in random festival colours
      const palettes: [number, number, number][] = [[1, 0.4, 0.7], [0.4, 0.9, 1], [1, 0.9, 0.3], [0.6, 1, 0.4], [0.8, 0.5, 1]];
      const pc = palettes[Math.floor(e.b * palettes.length) % palettes.length];
      const n = e.style === 'finale' ? 40 : 18;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + this.rand() * 0.2;
        const sp = r * (2.4 + this.rand());
        this.spawn('spark', e.x, e.y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3.2, max: 0.6 + this.rand() * 0.3, s0: 0.6, s1: 0.1, add: true, r: pc[0], g: pc[1], b: pc[2], grav: 0, vz: 0 });
      }
    } else if (e.style === 'popcorn') {
      this.burst('stuffing', e.x, e.y, 4, r * 3, { vz: 160, grav: 600, max: 0.5, s0: 0.6, s1: 0.5 });
    } else if (e.style === 'frost') {
      this.burst('snow', e.x, e.y, 10, r * 3, { max: 0.6, s0: 1.2, s1: 0.3 });
    } else if (e.style === 'fire' || e.style === 'boss' || e.style === 'jack' || e.style === 'cannon') {
      this.burst('flame', e.x, e.y, 8, r * 2.2, { max: 0.5, add: true, s0: 2, s1: 0.5 });
      this.burst('smoke', e.x, e.y, 5, r * 1.4, { max: 0.9, s0: 1, s1: 2, r: 0.5, g: 0.45, b: 0.5 });
    } else if (e.style === 'deathcard') {
      this.burst('spark', e.x, e.y, 14, r * 3, { max: 0.5, add: true, r: 0.7, g: 0.4, b: 1 });
    } else if (e.style === 'beam') {
      this.burst('spark', e.x, e.y, 14, r * 3, { max: 0.4, add: true, r: 1, g: 1, b: 0.8 });
    }
  }

  private sparks(e: FxEvent): void {
    const n = Math.max(1, Math.round(e.a));
    switch (e.style) {
      case 'electric': this.burst('spark', e.x, e.y, n * 2, 200, { max: 0.3, add: true, r: 0.6, g: 0.9, b: 1 }); break;
      case 'fire': this.burst('flame', e.x, e.y, n, 40, { vy: -60, max: 0.4, add: true, s0: 1.2, s1: 0.3 }); break;
      case 'ice': this.burst('snow', e.x, e.y, n * 3, 80, { max: 0.6 }); break;
      case 'smoke': this.burst('smoke', e.x, e.y, n, 80, { max: 0.7, s0: 0.8, s1: 1.8, r: 0.8, g: 0.78, b: 0.85 }); break;
      case 'magic': this.burst('star', e.x, e.y, n, 140, { max: 0.6, s0: 1, s1: 0.2, r: 1, g: 0.9, b: 1 }); break;
      case 'mirror': this.burst('spark', e.x, e.y, n * 2, 160, { max: 0.5, add: true, r: 0.7, g: 0.95, b: 1 }); break;
      case 'shrapnel': this.burst('spark', e.x, e.y, n, 120, { max: 0.25, add: true, r: 1, g: 0.6, b: 0.8, s0: 0.5 }); break;
      case 'gold': this.burst('star', e.x, e.y, n, 220, { max: 0.7, r: 1, g: 0.9, b: 0.3 }); break;
      case 'dust': this.burst('smoke', e.x, e.y, n, 120, { max: 0.5, s0: 0.5, s1: 1.1, r: 0.7, g: 0.6, b: 0.5 }); break;
      case 'string': this.burst('spark', e.x, e.y, n * 2, 200, { max: 0.4, add: true, r: 1, g: 1, b: 0.9 }); break;
      case 'shield': this.burst('spark', e.x, e.y, 4, 120, { max: 0.25, add: true, r: 0.6, g: 0.8, b: 1 }); break;
      case 'wind': this.spawn('smoke', e.x, e.y, { max: 0.6, s0: 0.3, s1: 0.6, r: 0.8, g: 0.85, b: 1 }); break;
      default: this.burst('spark', e.x, e.y, n, 120, { max: 0.3, add: true });
    }
  }

  private number(x: number, y: number, text: string, crit: boolean, heal = false): void {
    let n: Num | null = null;
    let oldest: Num | null = null;
    for (const c of this.nums) {
      if (!c.alive) {
        n = c;
        break;
      }
      if (!oldest || c.life < oldest.life) oldest = c;
    }
    n ??= oldest!;
    n.alive = true;
    n.x = x;
    n.y = y;
    n.vy = crit ? -90 : -60;
    n.text = heal ? '+' + text : text;
    n.crit = crit || heal;
    n.life = crit ? 0.9 : 0.6;
    n.scale = crit ? 1.45 : 1;
  }

  private textNum(x: number, y: number, text: string): void {
    this.number(x, y, text, true);
  }

  update(dt: number): void {
    this.activeParts = 0;
    for (const p of this.parts) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      this.activeParts++;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.grav) {
        p.vz -= p.grav * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz *= -0.35;
          p.vx *= 0.6;
          p.vy *= 0.6;
          p.vr *= 0.5;
        }
      } else p.z += p.vz * dt;
      p.rot += p.vr * dt;
    }
    for (const e of this.eph) {
      if (!e.alive) continue;
      e.life -= dt;
      if (e.life <= 0) e.alive = false;
    }
    for (const n of this.nums) {
      if (!n.alive) continue;
      n.life -= dt;
      n.y += n.vy * dt;
      n.vy *= Math.exp(-3 * dt);
      if (n.life <= 0) n.alive = false;
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 2.4);
    const s = this.shake * this.shake * 14 * this.shakeScale;
    this.shakeX = (this.rand() - 0.5) * s;
    this.shakeY = (this.rand() - 0.5) * s;
    this.screenFlash = Math.max(0, this.screenFlash - dt * 2.2);
  }

  addLights(lights: LightRig): void {
    for (const f of this.flashes) {
      const t = f.life / f.max;
      lights.add(f.x, f.y, f.r, f.i * t, f.cr, f.cg, f.cb);
    }
  }

  draw(normal: SpriteLayer, add: SpriteLayer, shapesAdd: ShapeBatch, numbers: SpriteLayer): void {
    for (const p of this.parts) {
      if (!p.alive) continue;
      const t = 1 - p.life / p.max;
      const sc = p.s0 + (p.s1 - p.s0) * t;
      const a = p.fade ? Math.min(1, (p.life / p.max) * 3) : 1 - t * t;
      (p.add ? add : normal).draw(p.f, p.x, p.y - p.z, 0.97, sc, sc, p.rot, p.r, p.g, p.b, a);
    }
    for (const e of this.eph) {
      if (!e.alive) continue;
      const t = 1 - e.life / e.max;
      const a = 1 - t;
      switch (e.kind) {
        case 'ring': {
          const r = e.r * (0.25 + 0.75 * Math.sqrt(t));
          shapesAdd.ring(e.x, e.y, Math.max(0, r - e.width), r, e.cr, e.cg, e.cb, a * 0.9, a * 0.2);
          break;
        }
        case 'disk':
          shapesAdd.circle(e.x, e.y, e.r * (0.5 + 0.5 * t), e.cr, e.cg, e.cb, a * 0.55, 0);
          break;
        case 'slash': {
          const sweep = Math.min(1, t * 2.2);
          const a0 = e.a - e.half, a1 = e.a - e.half + e.half * 2 * sweep;
          shapesAdd.ring(e.x, e.y, e.r * 0.45, e.r, e.cr, e.cg, e.cb, a * 0.15, a * 0.85, a0, a1);
          break;
        }
        case 'beam':
          shapesAdd.line(e.x, e.y, e.x2, e.y2, e.width, e.cr, e.cg, e.cb, a, 0);
          break;
      }
    }
    for (const n of this.nums) {
      if (!n.alive) continue;
      const set = n.crit ? this.digitC : this.digit;
      const a = Math.min(1, n.life * 4);
      const pop = n.crit ? 1 + Math.max(0, n.life - 0.7) * 3 : 1;
      const w = 10 * n.scale * pop;
      let x = n.x - (n.text.length - 1) * w * 0.5;
      for (const ch of n.text) {
        const f = set[ch];
        if (f) numbers.draw(f, x, n.y, 0.99, n.scale * pop * 0.8, n.scale * pop * 0.8, 0, 1, 1, 1, a);
        else if (ch === '+') numbers.draw(set['1'], x, n.y, 0.99, 0.01, 0.01, 0, 1, 1, 1, 0);
        x += w;
      }
    }
  }

  clear(): void {
    for (const p of this.parts) p.alive = false;
    for (const e of this.eph) e.alive = false;
    for (const n of this.nums) n.alive = false;
    this.flashes.length = 0;
    this.shake = 0;
    this.screenFlash = 0;
  }
}
