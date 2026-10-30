// The painted ground layout for the 3D midway floor: paths, plaza, promenade, grease slicks and a
// scatter of decals (spilled popcorn, lost tickets, puddles, cracks, tufts) baked into a canvas.
// The alpha channel stores the surface type (dirt/grass, cobbles, planks) for the ground shader.

import { MAP_HALF, PATHS, PLAZA, PROMENADE, SEA_Y, TILT_A_WHIRL, GREASE_SLICKS } from '../../data/map';
import { artRng } from '../../render/art/kit';

export const EXTENT = 3200; // half-size of the ground plane (world units)
const PAINT = 2048;

function worldToPaint(v: number): number {
  return ((v + EXTENT) / (EXTENT * 2)) * PAINT;
}

/** R,G,B = albedo; A = surface type (1 grass/dirt, ~0.67 cobble, ~0.33 planks). Never 0: canvas is premultiplied. */
export function paintGround(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = PAINT;
  const ctx = c.getContext('2d')!;
  const s = PAINT / (EXTENT * 2);
  const r = artRng(1931);
  // base: trampled night grass / packed dirt
  ctx.fillStyle = '#4a4a3a';
  ctx.fillRect(0, 0, PAINT, PAINT);
  // blotchy variation
  for (let i = 0; i < 1400; i++) {
    const x = r() * PAINT, y = r() * PAINT, rad = 10 + r() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const k = r();
    const col = k < 0.4 ? '74,70,50' : k < 0.7 ? '50,58,40' : k < 0.9 ? '86,74,56' : '40,44,34';
    g.addColorStop(0, `rgba(${col},0.35)`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // outside the fence: dark woods floor
  ctx.fillStyle = 'rgba(14,16,20,0.78)';
  const m0 = worldToPaint(-MAP_HALF), m1 = worldToPaint(MAP_HALF);
  ctx.fillRect(0, 0, PAINT, m0);
  ctx.fillRect(0, 0, m0, PAINT);
  ctx.fillRect(m1, 0, PAINT - m1, PAINT);
  // dirt paths
  const strokePath = (pts: [number, number][], w: number, col: string) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(worldToPaint(x), worldToPaint(y)) : ctx.moveTo(worldToPaint(x), worldToPaint(y))));
    ctx.lineWidth = w * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = col;
    ctx.stroke();
  };
  for (const p of PATHS) {
    strokePath(p.pts, p.w + 40, 'rgba(70,58,44,0.55)');
    strokePath(p.pts, p.w, '#7a6248');
    strokePath(p.pts, p.w * 0.55, 'rgba(140,112,82,0.35)');
  }
  // plaza ring (cobbles: alpha ~0.5)
  ctx.save();
  ctx.beginPath();
  ctx.arc(worldToPaint(PLAZA.x), worldToPaint(PLAZA.y), PLAZA.r * s, 0, Math.PI * 2);
  ctx.fillStyle = '#857a6c';
  ctx.fill();
  ctx.restore();
  // tilt-a-whirl pad, grease slicks
  ctx.beginPath();
  ctx.ellipse(worldToPaint(TILT_A_WHIRL.x), worldToPaint(TILT_A_WHIRL.y), 300 * s, 210 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30,24,40,0.6)';
  ctx.fill();
  for (const gs of GREASE_SLICKS) {
    const x = worldToPaint(gs.x), y = worldToPaint(gs.y), rad = gs.r * s;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(200,170,60,0.75)');
    g.addColorStop(0.8, 'rgba(140,120,40,0.45)');
    g.addColorStop(1, 'rgba(140,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // decals: spilled popcorn, lost tickets, puddles, cracks, tufts
  for (let i = 0; i < 2600; i++) {
    const x = r() * PAINT, y = r() * PAINT;
    const k = r();
    if (k < 0.35) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '255,240,200' : '240,200,120'},${0.25 + r() * 0.3})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    } else if (k < 0.5) {
      ctx.fillStyle = `rgba(${['200,60,60', '80,140,220', '230,200,90'][Math.floor(r() * 3)]},0.35)`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r() * 3);
      ctx.fillRect(-2, -1, 4, 2);
      ctx.restore();
    } else if (k < 0.56) {
      ctx.fillStyle = 'rgba(30,40,60,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + r() * 8, 2 + r() * 4, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (k < 0.62) {
      ctx.strokeStyle = 'rgba(20,16,12,0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14);
      ctx.lineTo(x + (r() - 0.5) * 20, y + (r() - 0.5) * 20);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '70,84,52' : '56,66,44'},0.5)`;
      ctx.fillRect(x, y, 1, 2 + r() * 2);
    }
  }
  // surface-type channel → alpha: write via a second pass using composite ops
  const img = ctx.getImageData(0, 0, PAINT, PAINT);
  const d = img.data;
  const plazaR = (PLAZA.r * s) ** 2;
  const px0 = worldToPaint(PLAZA.x), py0 = worldToPaint(PLAZA.y);
  const promY0 = worldToPaint(PROMENADE.y0), seaY = worldToPaint(SEA_Y);
  for (let y = 0; y < PAINT; y++) {
    for (let x = 0; x < PAINT; x++) {
      const i = (y * PAINT + x) * 4;
      let a = 255; // grass/dirt
      const dx = x - px0, dy = y - py0;
      if (dx * dx + dy * dy < plazaR) a = 170; // cobbles
      if (y >= promY0 && y < seaY && x > m0 && x < m1) a = 85; // planks
      d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
