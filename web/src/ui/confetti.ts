// Confetti (D-105): the prize wheel's win thrown in paper and tinsel by the prize's rarity. A pinch for a Common, a
// handful for an Uncommon, both cannons for a Rare, and for a Legendary an absurd celebration: volley after volley
// from both corners, bursts from the card, a downpour from the top, streamers and gold stars, for nearly three
// seconds. A canvas over the whole window that draws only while paper is in the air.

import type { Quality } from '../data/quality';

/** What was won: a prize's rarity, or the kinds of prize that have their own celebration. */
export type ConfettiKind = Quality | 'evolution' | 'party' | 'voucher' | 'heal';

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  /** the paper's flip about its long axis (drawn as its height narrowing and widening) */
  flip: number;
  vf: number;
  w: number;
  h: number;
  col: string;
  /** 0 paper, 1 sequin, 2 star, 3 streamer */
  shape: number;
  life: number;
  sway: number;
}

const CARNIVAL = ['#ff4d5e', '#ffd23f', '#3ad1ff', '#7fe05a', '#ff8ac0', '#b98aff', '#fff4d6', '#ff9a2a'];
const ACCENT: Record<ConfettiKind, string[]> = {
  common: ['#fff4d6', '#e8d29a', '#d8b46a'],
  uncommon: ['#39ff7a', '#9dffbc', '#1fcf5a'],
  rare: ['#3aa8ff', '#9fd6ff', '#1f6fe2'],
  legendary: ['#ff9a2a', '#ffd23f', '#fff1b0', '#ff6a1a'],
  evolution: ['#ff6a3a', '#ffb02a', '#ff3a2a', '#ffe08a'],
  party: ['#ffd27a', '#8af4ff', '#ff8fb0', '#a8ff7a', '#c7a2ff', '#ffb066'],
  voucher: ['#ffd23f', '#f2c14e', '#fff1b0'],
  heal: ['#ff8ac0', '#ffc0d8', '#fff4d6'],
};
/** the most bits in the air at once (a Legendary's waves stay under it) */
const CAP = 2600;

export class Confetti {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private bits: Bit[] = [];
  private waves: { at: number; fn: () => void }[] = [];
  private raf = 0;
  private last = 0;
  private clock = 0;
  private dpr = 1;
  /** a sound with each volley (the app plays it) */
  sound: (id: string, vol: number, pitch?: number) => void = () => {};

  /** Throw confetti for what was won. */
  celebrate(kind: ConfettiKind): void {
    this.mount();
    const at = (t: number, fn: () => void) => this.waves.push({ at: this.clock + t, fn });
    const card = (n: number, speed = 1, stars = 0) => () => {
      this.burst(0.5, 0.46, n, speed, kind);
      for (let i = 0; i < stars; i++) this.add(0.5, 0.46, this.radial(0.9 * speed), kind, 2);
    };
    const cannons = (n: number, power = 1) => () => {
      this.cannon(0, n, power, kind);
      this.cannon(1, n, power, kind);
      this.sound('paperburst', 0.55, 0.95 + Math.random() * 0.1);
    };
    const rain = (n: number) => () => {
      for (let i = 0; i < n; i++) this.add(Math.random(), -0.05 - Math.random() * 0.25, { vx: (Math.random() - 0.5) * 0.15, vy: 0.05 + Math.random() * 0.2 }, kind, Math.random() < 0.08 ? 3 : Math.random() < 0.25 ? 1 : 0);
    };
    switch (kind) {
      case 'common':
        at(0, card(40, 0.75));
        this.sound('paperburst', 0.32, 1.15);
        break;
      case 'heal':
        at(0, card(26, 0.6));
        break;
      case 'uncommon':
        at(0, card(90, 0.95));
        this.sound('paperburst', 0.45, 1.05);
        break;
      case 'voucher':
        // a shower of gold from the top
        at(0, rain(110));
        at(0, card(40, 0.8));
        break;
      case 'rare':
        at(0, cannons(80));
        at(0.05, card(110, 1.1, 10));
        this.sound('crackle', 0.35);
        break;
      case 'party':
        at(0, cannons(110));
        at(0.1, card(140, 1.15, 16));
        at(0.45, rain(140));
        break;
      case 'evolution':
        at(0, cannons(130, 1.1));
        at(0.05, card(170, 1.25, 24));
        at(0.5, cannons(80));
        this.sound('crackle', 0.45);
        break;
      case 'legendary':
        // the absurd one: everything, again and again
        this.sound('cymbal', 0.75);
        this.sound('crackle', 0.55);
        at(0, cannons(220, 1.15));
        at(0.04, card(200, 1.35, 50));
        at(0, () => this.streamers(26, kind));
        at(0.25, rain(260));
        at(0.6, cannons(170, 1.05));
        at(0.6, () => this.streamers(20, kind));
        at(1.0, card(180, 1.25, 40));
        at(1.0, () => this.sound('crackle', 0.5, 1.15));
        at(1.45, rain(240));
        at(1.9, cannons(150, 1.2));
        at(2.4, card(160, 1.1, 30));
        at(2.4, () => this.sound('cymbal', 0.5, 1.2));
        break;
    }
    this.start();
  }

  /** The canvas, over everything, sized to the window's pixels (made once, on the first win). */
  private mount(): void {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'confetti';
      document.body.append(this.canvas);
      this.ctx = this.canvas.getContext('2d');
    }
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(window.innerWidth * this.dpr), h = Math.round(window.innerHeight * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.raf = this.bits.length || this.waves.length ? requestAnimationFrame(step) : 0;
      if (!this.raf) this.ctx?.clearRect(0, 0, this.canvas!.width, this.canvas!.height);
    };
    this.raf = requestAnimationFrame(step);
  }

  /** A random direction, mostly up, at this speed (in screen heights a second). */
  private radial(speed: number): { vx: number; vy: number } {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
    const v = speed * (0.35 + Math.random() * 0.75);
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v };
  }

  private burst(x: number, y: number, n: number, speed: number, kind: ConfettiKind): void {
    for (let i = 0; i < n; i++) this.add(x, y, this.radial(speed), kind, Math.random() < 0.22 ? 1 : 0);
  }

  /** A cannon at a bottom corner (side 0 left, 1 right) firing up and in. */
  private cannon(side: number, n: number, power: number, kind: ConfettiKind): void {
    for (let i = 0; i < n; i++) {
      const a = (side === 0 ? -1.15 : -Math.PI + 1.15) + (Math.random() - 0.5) * 0.55;
      const v = power * (0.95 + Math.random() * 0.75);
      this.add(side === 0 ? -0.01 : 1.01, 1.02, { vx: Math.cos(a) * v * 0.62, vy: Math.sin(a) * v }, kind, Math.random() < 0.05 ? 3 : Math.random() < 0.2 ? 1 : 0);
    }
  }

  private streamers(n: number, kind: ConfettiKind): void {
    for (let i = 0; i < n; i++) this.add(Math.random() < 0.5 ? 0.02 : 0.98, 1.02, { vx: (Math.random() - 0.5) * 0.5, vy: -(1 + Math.random() * 0.5) }, kind, 3);
  }

  /** One bit at (x, y) in screen fractions, moving at v (screen heights a second). */
  private add(x: number, y: number, v: { vx: number; vy: number }, kind: ConfettiKind, shape: number): void {
    if (this.bits.length >= CAP) return;
    const acc = ACCENT[kind];
    const col = Math.random() < 0.55 ? acc[(Math.random() * acc.length) | 0] : CARNIVAL[(Math.random() * CARNIVAL.length) | 0];
    const s = 0.75 + Math.random() * 0.6;
    this.bits.push({
      x, y, vx: v.vx, vy: v.vy,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 14,
      flip: Math.random() * Math.PI * 2, vf: 6 + Math.random() * 10,
      w: (shape === 3 ? 4 : shape === 2 ? 15 : shape === 1 ? 7 : 11) * s, h: (shape === 3 ? 46 : shape === 2 ? 15 : shape === 1 ? 7 : 6) * s,
      col: shape === 2 ? (Math.random() < 0.7 ? '#ffd23f' : '#fff1b0') : col, shape,
      life: 3.2 + Math.random() * 1.8, sway: Math.random() * Math.PI * 2,
    });
  }

  private update(dt: number): void {
    this.clock += dt;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      if (this.clock < this.waves[i].at) continue;
      const w = this.waves.splice(i, 1)[0];
      w.fn();
    }
    const c = this.ctx, cv = this.canvas;
    if (!c || !cv) return;
    const W = cv.width / this.dpr, H = cv.height / this.dpr, k = H / 1080;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // every bit of a colour (and fade) goes into one path, filled once: a Legendary's two thousand pieces cost a few
    // dozen fills a frame, not thousands of calls
    const paths = new Map<string, Path2D>();
    const path = (key: string) => {
      let pa = paths.get(key);
      if (!pa) paths.set(key, (pa = new Path2D()));
      return pa;
    };
    const alive: Bit[] = [];
    for (const b of this.bits) {
      // paper falls slowly against the air and flutters; stars and sequins drop a little faster
      const drag = b.shape === 3 ? 2.2 : b.shape === 0 ? 1.6 : 1.1;
      b.vx -= b.vx * drag * dt;
      b.vy -= b.vy * drag * dt;
      b.vy += (b.shape === 3 ? 0.32 : b.shape === 0 ? 0.42 : 0.6) * dt;
      b.sway += dt * 3;
      b.x += (b.vx + Math.sin(b.sway) * 0.02) * dt * (H / W);
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      b.flip += b.vf * dt;
      b.life -= dt;
      if (b.life <= 0 || b.y > 1.1) continue;
      alive.push(b);
      const px = b.x * W, py = b.y * H;
      const fade = b.life > 0.6 ? 3 : Math.max(1, Math.ceil(b.life / 0.2));
      const cs = Math.cos(b.rot), sn = Math.sin(b.rot);
      // a point of the bit's own shape, turned and placed
      const P = (u: number, v: number): [number, number] => [px + (u * cs - v * sn) * k, py + (u * sn + v * cs) * k];
      if (b.shape === 3) {
        const pa = path(`s${b.col}|${fade}`), f = Math.sin(b.flip) * b.h * 0.3;
        pa.moveTo(...P(0, -b.h / 2));
        pa.bezierCurveTo(...P(f, -b.h * 0.15), ...P(-f, b.h * 0.15), ...P(0, b.h / 2));
        continue;
      }
      const pa = path(`f${b.col}|${fade}`);
      if (b.shape === 2) {
        const r = b.w / 2;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
          const q = P(Math.cos(a) * rr, Math.sin(a) * rr);
          if (i) pa.lineTo(q[0], q[1]);
          else pa.moveTo(q[0], q[1]);
        }
        pa.closePath();
        continue;
      }
      // paper (a strip, its width narrowing as it flips) or a sequin (a disc seen at a slant)
      const hw = b.w / 2, hh = (b.h / 2) * (b.shape === 1 ? Math.max(0.2, Math.abs(Math.cos(b.flip))) : Math.cos(b.flip));
      if (b.shape === 1) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2, q = P(Math.cos(a) * hw, Math.sin(a) * hh);
          if (i) pa.lineTo(q[0], q[1]);
          else pa.moveTo(q[0], q[1]);
        }
      } else {
        pa.moveTo(...P(-hw, -hh));
        pa.lineTo(...P(hw, -hh));
        pa.lineTo(...P(hw, hh));
        pa.lineTo(...P(-hw, hh));
      }
      pa.closePath();
    }
    for (const [key, pa] of paths) {
      const [col, fade] = key.slice(1).split('|');
      c.globalAlpha = Number(fade) / 3;
      if (key[0] === 's') {
        c.strokeStyle = col;
        c.lineWidth = 4 * k;
        c.stroke(pa);
      } else {
        c.fillStyle = col;
        c.fill(pa);
      }
    }
    c.globalAlpha = 1;
    this.bits = alive;
  }
}
