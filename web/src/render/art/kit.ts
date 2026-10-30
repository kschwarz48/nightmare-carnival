// Rubber-hose ink toolkit (doc 02 §4–5): thick ink outlines, pie-cut eyes, white gloves,
// noodle limbs, creepy grins, highlights. Every asset in the game is painted with these
// primitives onto Canvas2D at boot — original, resolution-independent vector art.

export type Ctx = CanvasRenderingContext2D;

export const INK = '#17110e';
export const CREAM = '#f7eedb';
export const BONE = '#efe4cc';
export const DANGER = '#ff4a2a';

/** Shared palette (doc 02 §3): faded candy colours, midnight sepias, neon accents. */
export const PAL = {
  red: '#c8322d', redDark: '#8e1f1c', pink: '#ef8fb3', candy: '#ff7bb0', magenta: '#e0338f',
  cyan: '#4fd6e0', toxic: '#9be15d', acid: '#c6f04a', orange: '#f08a2c', coal: '#ff6a2a',
  yellow: '#f6cf4f', gold: '#f2c14e', mustard: '#d9a43a', cream: CREAM, bone: BONE,
  wood: '#8a5a36', woodDark: '#5a3820', woodLight: '#b8875a', sepia: '#a88b6a', rust: '#9a4a2a',
  tin: '#a9b2b8', tinDark: '#6c757b', brass: '#c79a3b', navy: '#1c1a3a', purple: '#6a3a9a',
  violet: '#8a5ad0', teal: '#2f8f8a', mint: '#8fe0c0', blue: '#3f7fd0', sky: '#7fc4f0',
  green: '#4f9a3a', brown: '#6a4630', grey: '#7a7480', black: '#1a1418', white: '#fffaf0',
};

export function ink(ctx: Ctx, lw: number): void {
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/** Fill the current path, then ink it. */
export function fillInk(ctx: Ctx, fill: string | CanvasGradient, lw = 3): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ink(ctx, lw);
  ctx.stroke();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Radial gradient shading so flat fills read as rounded cartoon volume. */
export function shade(ctx: Ctx, x: number, y: number, r: number, light: string, dark: string): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  return g;
}

export function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    r = Math.round(r * (1 + amt));
    g = Math.round(g * (1 + amt));
    b = Math.round(b * (1 + amt));
  }
  return `rgb(${r},${g},${b})`;
}

/** Specular highlight — the glossy "rubber" shine of 1930s cel art. */
export function shine(ctx: Ctx, x: number, y: number, r: number, a = 0.85): void {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#fffaf0';
  ellipse(ctx, x, y, r, r * 0.6, -0.6);
  ctx.fill();
  ctx.globalAlpha = a * 0.8;
  circle(ctx, x + r * 1.1, y + r * 0.7, r * 0.28);
  ctx.fill();
  ctx.restore();
}

/**
 * Pie-cut eye: white ellipse, ink outline, black pupil with the classic wedge notch.
 * `look` = pupil offset (-1..1), `mad` tilts a brow lid over it.
 */
export function pieEye(ctx: Ctx, x: number, y: number, rx: number, ry: number, lookX = 0, lookY = 0, opts: { lid?: number; lidSide?: number; dead?: boolean; glow?: string; lw?: number } = {}): void {
  const lw = opts.lw ?? Math.max(1.5, rx * 0.28);
  ellipse(ctx, x, y, rx, ry);
  fillInk(ctx, opts.glow ?? '#fffaf0', lw);
  if (opts.dead) {
    ink(ctx, lw);
    ctx.beginPath();
    ctx.moveTo(x - rx * 0.5, y - ry * 0.5);
    ctx.lineTo(x + rx * 0.5, y + ry * 0.5);
    ctx.moveTo(x + rx * 0.5, y - ry * 0.5);
    ctx.lineTo(x - rx * 0.5, y + ry * 0.5);
    ctx.stroke();
    return;
  }
  const px = x + lookX * rx * 0.35, py = y + lookY * ry * 0.3;
  const pr = rx * 0.62, pry = ry * 0.7;
  ctx.fillStyle = INK;
  ctx.beginPath();
  // pupil with a pie-wedge cut toward the upper-right
  ctx.ellipse(px, py, pr, pry, 0, -0.35, Math.PI * 2 - 1.05);
  ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fill();
  if (opts.lid) {
    ctx.save();
    ellipse(ctx, x, y, rx, ry);
    ctx.clip();
    ctx.fillStyle = INK;
    const side = opts.lidSide ?? 1;
    ctx.beginPath();
    ctx.moveTo(x - rx * 1.2, y - ry * 1.2 + (side < 0 ? ry * opts.lid : 0));
    ctx.lineTo(x + rx * 1.2, y - ry * 1.2 + (side > 0 ? ry * opts.lid : 0));
    ctx.lineTo(x + rx * 1.2, y - ry * 1.3);
    ctx.lineTo(x - rx * 1.2, y - ry * 1.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ink(ctx, lw);
    ellipse(ctx, x, y, rx, ry);
    ctx.stroke();
  }
}

/** Noodle (rubber-hose) limb: an ink stroke with a coloured core. */
export function hose(ctx: Ctx, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, w: number, color: string, outline = 2.4): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + outline * 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** Puffy white cartoon glove (four fingers, cuff). */
export function glove(ctx: Ctx, x: number, y: number, r: number, ang = 0, color = '#fffaf0', fist = false): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const lw = Math.max(1.6, r * 0.22);
  // cuff
  roundRect(ctx, -r * 1.25, -r * 0.55, r * 0.6, r * 1.1, r * 0.25);
  fillInk(ctx, color, lw);
  // palm + fingers
  ctx.beginPath();
  if (fist) {
    ctx.ellipse(r * 0.15, 0, r * 0.85, r * 0.75, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(-r * 0.7, -r * 0.55);
    ctx.quadraticCurveTo(-r * 0.2, -r * 1.0, r * 0.35, -r * 0.75);
    ctx.quadraticCurveTo(r * 1.15, -r * 0.6, r * 0.95, -r * 0.15);
    ctx.quadraticCurveTo(r * 1.35, 0.05 * r, r * 0.95, r * 0.3);
    ctx.quadraticCurveTo(r * 1.1, r * 0.75, r * 0.4, r * 0.75);
    ctx.quadraticCurveTo(-r * 0.2, r * 1.0, -r * 0.7, r * 0.55);
    ctx.closePath();
  }
  fillInk(ctx, color, lw);
  ink(ctx, lw * 0.6);
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.25);
  ctx.lineTo(r * 0.45, -r * 0.3);
  ctx.moveTo(-r * 0.15, r * 0.15);
  ctx.lineTo(r * 0.45, r * 0.15);
  ctx.stroke();
  ctx.restore();
}

/** Big oval cartoon shoe. */
export function shoe(ctx: Ctx, x: number, y: number, r: number, color: string, face = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face, 1);
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, 0);
  ctx.quadraticCurveTo(-r * 0.7, -r * 0.7, 0, -r * 0.65);
  ctx.quadraticCurveTo(r * 1.3, -r * 0.6, r * 1.25, r * 0.05);
  ctx.quadraticCurveTo(r * 1.2, r * 0.4, 0, r * 0.35);
  ctx.quadraticCurveTo(-r * 0.7, r * 0.35, -r * 0.6, 0);
  ctx.closePath();
  fillInk(ctx, shade(ctx, r * 0.3, -r * 0.2, r, lighten(color, 0.35), color), Math.max(1.5, r * 0.22));
  shine(ctx, r * 0.6, -r * 0.3, r * 0.22, 0.6);
  ctx.restore();
}

/** Wide toothy carnival grin. */
export function grin(ctx: Ctx, x: number, y: number, w: number, h: number, teeth = 6, color = '#3a0b10', lw = 2.5): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y + h * 2, x + w / 2, y);
  ctx.quadraticCurveTo(x, y + h * 0.6, x - w / 2, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  // teeth
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#fff6dc';
  for (let i = 0; i < teeth; i++) {
    const tx = x - w / 2 + (w / teeth) * (i + 0.1);
    ctx.fillRect(tx, y - 2, (w / teeth) * 0.8, h * 0.55);
  }
  ctx.restore();
  ink(ctx, lw);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y + h * 2, x + w / 2, y);
  ctx.quadraticCurveTo(x, y + h * 0.6, x - w / 2, y);
  ctx.closePath();
  ctx.stroke();
}

/** Diagonal candy stripes clipped to the current path (call after building the path). */
export function stripes(ctx: Ctx, x: number, y: number, w: number, h: number, a: string, b: string, step: number, angle = 0.6): void {
  ctx.save();
  ctx.clip();
  ctx.fillStyle = a;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = b;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  const big = Math.max(w, h) * 1.6;
  for (let i = -big; i < big; i += step * 2) ctx.fillRect(i, -big, step, big * 2);
  ctx.restore();
}

/** Vertical stripes (tents, booths). */
export function vstripes(ctx: Ctx, x: number, y: number, w: number, h: number, a: string, b: string, n: number): void {
  ctx.save();
  ctx.clip();
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? b : a;
    ctx.fillRect(x + i * sw, y, sw + 0.5, h);
  }
  ctx.restore();
}

/** Soft drop shadow ellipse (baked into some props). */
export function softShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.35): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.scale(1, ry / rx);
  ctx.beginPath();
  ctx.arc(x, y * (rx / ry), rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Marquee bulb (lit or dead). */
export function bulb(ctx: Ctx, x: number, y: number, r: number, color: string, lit = true): void {
  if (lit) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = g;
    circle(ctx, x, y, r * 3);
    ctx.fill();
    ctx.restore();
  }
  circle(ctx, x, y, r);
  fillInk(ctx, lit ? '#fff6c8' : '#4a4038', Math.max(1, r * 0.35));
}

/** Simple seeded RNG for deterministic art scatter. */
export function artRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bold poster lettering with ink outline + drop shadow. */
export function posterText(ctx: Ctx, text: string, x: number, y: number, size: number, fill: string, opts: { font?: string; align?: CanvasTextAlign; outline?: number; shadow?: boolean } = {}): void {
  ctx.save();
  ctx.font = `${size}px ${opts.font ?? '"Rye", Georgia, serif'}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (opts.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(text, x + size * 0.06, y + size * 0.08);
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = opts.outline ?? Math.max(2, size * 0.14);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}
