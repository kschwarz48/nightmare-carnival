// Baked ground data for the 3D midway floor (D-45): contact occlusion under every prop footprint —
// a tight dark core where a structure meets the ground plus a wide soft skirt — in a small linear
// texture the ground shader reads. The visible layout itself (paths, plaza, promenade, pads) is
// analytic in the shader (ground.ts), so it stays crisp at any zoom.

import { PROPS } from '../../data/map';

export const EXTENT = 3200; // half-size of the ground plane (world units)
const SIZE = 1024;

/** R = ambient/contact occlusion (1 open … 0 fully occluded). */
export function bakeGroundData(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const s = SIZE / (EXTENT * 2);
  const P = (v: number) => (v + EXTENT) * s;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const pass = (alpha: number, grow: number, blur: number, line: number) => {
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    for (const p of PROPS) {
      if (p.kind === 'fence_h' || p.kind === 'fence_v' || p.kind === 'rail') {
        const len = p.w ?? 0;
        ctx.lineWidth = line * s;
        ctx.beginPath();
        if (p.kind === 'fence_v') {
          ctx.moveTo(P(p.x), P(p.y - len / 2));
          ctx.lineTo(P(p.x), P(p.y + len / 2));
        } else {
          ctx.moveTo(P(p.x - len / 2), P(p.y));
          ctx.lineTo(P(p.x + len / 2), P(p.y));
        }
        ctx.stroke();
      } else if (p.r) {
        ctx.beginPath();
        ctx.arc(P(p.x), P(p.y), (p.r + grow) * s, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.hw && p.hh) {
        ctx.fillRect(P(p.x - p.hw - grow), P(p.y - p.hh - grow), (p.hw + grow) * 2 * s, (p.hh + grow) * 2 * s);
      }
    }
    ctx.restore();
  };
  pass(0.32, 36, 9, 30); // wide soft skirt
  pass(0.5, 4, 2.2, 10); // tight contact core
  return c;
}
