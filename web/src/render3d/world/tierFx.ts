// The tiers' particles (D-97): Nightmare's wisps drifting low and slow over everything, Hell's embers rising on the
// heat. One field that wraps round the camera (a fixed count, no allocation), drawn into the glow billboards.

import type { BillboardLayer } from '../core/billboard';
import type { Frame } from '../../render/atlas';

const N = 120;
/** the field's tile (world units): wider than the view at play zoom, so the wrap is never seen */
const W = 2000;
const H = 1500;

interface Speck { ox: number; oy: number; h: number; sp: number; ph: number; s: number }

const wrap = (v: number, c: number, size: number) => c + ((((v - c) % size) + size * 1.5) % size) - size / 2;

export class TierMotes {
  private specks: Speck[] = [];
  constructor() {
    let seed = 9713;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) this.specks.push({ ox: rnd() * W, oy: rnd() * H, h: rnd(), sp: 0.4 + rnd() * 0.8, ph: rnd() * 100, s: rnd() });
  }

  draw(layer: BillboardLayer, glow: Frame, time: number, cx: number, cy: number, kind: 'wisps' | 'embers', strength: number): void {
    if (strength <= 0.01) return;
    for (const m of this.specks) {
      const t = time * m.sp + m.ph;
      if (kind === 'wisps') {
        // pale spirits: a slow wander low over the ground, breathing in and out of sight
        const x = wrap(m.ox + Math.cos(t * 0.31) * 60 + time * 9, cx, W);
        const y = wrap(m.oy + Math.sin(t * 0.23) * 40, cy, H);
        const h = 14 + m.h * 70 + Math.sin(t * 0.9) * 12;
        const breathe = Math.max(0, Math.sin(t * 0.45 + m.s * 6));
        const size = 0.09 + m.s * 0.08;
        layer.draw(glow, x, y, h, size, size * 1.25, 0, 0.5, 0.92, 1.15, strength * breathe * 0.55);
      } else {
        // embers: lifted from the ground on the heat, swaying, flickering out near the top
        const rise = (m.h * 260 + time * (38 + m.sp * 30)) % 260;
        const x = wrap(m.ox + Math.sin(t * 1.3) * 14 + time * 16, cx, W);
        const y = wrap(m.oy - rise * 0.25, cy, H);
        const life = rise / 260;
        const flick = 0.55 + 0.45 * Math.sin(time * 11 + m.ph * 5);
        const size = 0.05 + m.s * 0.06;
        layer.draw(glow, x, y, 8 + rise, size, size, 0, 1.45, 0.55 + 0.25 * (1 - life), 0.12, strength * flick * (1 - life) * Math.min(1, life * 6) * 0.95);
      }
    }
  }
}
