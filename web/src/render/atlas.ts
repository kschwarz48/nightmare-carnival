// Texture atlas packer. Art is painted procedurally into frames (Canvas2D) and shelf-packed
// into a few large canvases that become Three.js textures. Frames carry UVs, world size and anchor.

import * as THREE from 'three';
import type { Ctx } from './art/kit';

export interface Frame {
  atlas: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Size in world units. */
  w: number;
  h: number;
  /** Anchor (0..1) from left / top — usually the feet. */
  ax: number;
  ay: number;
}

interface Pending {
  key: string;
  pw: number;
  ph: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
  draw: (ctx: Ctx, w: number, h: number) => void;
}

export class AtlasBuilder {
  private pending: Pending[] = [];
  frames = new Map<string, Frame>();
  textures: THREE.Texture[] = [];
  canvases: HTMLCanvasElement[] = [];

  /**
   * Register a frame. `w`/`h` are world units; `res` = pixels per world unit.
   * The draw callback receives a context already scaled so 1 unit = 1 world unit.
   */
  add(key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void, opts: { res?: number; ax?: number; ay?: number } = {}): void {
    const res = opts.res ?? 2;
    this.pending.push({ key, w, h, pw: Math.ceil(w * res) + 4, ph: Math.ceil(h * res) + 4, ax: opts.ax ?? 0.5, ay: opts.ay ?? 0.5, draw });
  }

  build(size = 4096): void {
    // tallest first for tight shelves
    this.pending.sort((a, b) => b.ph - a.ph);
    let canvas = this.newCanvas(size);
    let ctx = canvas.getContext('2d')!;
    let x = 0, y = 0, shelf = 0;
    for (const p of this.pending) {
      if (p.pw > size || p.ph > size) throw new Error(`frame too large ${p.key}`);
      if (x + p.pw > size) {
        x = 0;
        y += shelf;
        shelf = 0;
      }
      if (y + p.ph > size) {
        canvas = this.newCanvas(size);
        ctx = canvas.getContext('2d')!;
        x = 0;
        y = 0;
        shelf = 0;
      }
      ctx.save();
      ctx.translate(x + 2, y + 2);
      ctx.beginPath();
      ctx.rect(0, 0, p.pw - 4, p.ph - 4);
      ctx.clip();
      ctx.scale((p.pw - 4) / p.w, (p.ph - 4) / p.h);
      try {
        p.draw(ctx, p.w, p.h);
      } catch (e) {
        console.error('art error', p.key, e);
      }
      ctx.restore();
      const ai = this.canvases.length - 1;
      this.frames.set(p.key, {
        atlas: ai,
        u0: (x + 2) / size,
        v0: 1 - (y + 2) / size,
        u1: (x + p.pw - 2) / size,
        v1: 1 - (y + p.ph - 2) / size,
        w: p.w,
        h: p.h,
        ax: p.ax,
        ay: p.ay,
      });
      x += p.pw;
      shelf = Math.max(shelf, p.ph);
    }
    for (const c of this.canvases) {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = 4;
      t.needsUpdate = true;
      this.textures.push(t);
    }
    this.pending = [];
  }

  private newCanvas(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    this.canvases.push(c);
    return c;
  }

  get(key: string): Frame {
    const f = this.frames.get(key);
    if (!f) throw new Error(`missing frame ${key}`);
    return f;
  }
  has(key: string): boolean {
    return this.frames.has(key);
  }
}

/** Paint a single image (portrait/icon) onto its own canvas → data URL for the DOM UI. */
export function paintToDataURL(w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void, res = 2): string {
  const c = document.createElement('canvas');
  c.width = Math.round(w * res);
  c.height = Math.round(h * res);
  const ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  draw(ctx, w, h);
  return c.toDataURL('image/png');
}
