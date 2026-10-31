// The Fun House's roster (D-63) for the Carnival-pedia: the same rubber-hose ink as the first map's
// monsters, in the house's own palette: porcelain, silvered glass, dry wood, bruised velvet.

import { circle, ellipse, fillInk, glove, grin, hose, ink, pieEye, roundRect, shade, shine, shoe, type Ctx } from './kit';
import type { EnemyMode } from './enemies';

export const FUNHOUSE_ART: Record<string, { w: number; h: number; ay: number }> = {
  grinning_mannequin: { w: 58, h: 92, ay: 0.94 },
  grand_mannequin: { w: 58, h: 92, ay: 0.94 },
  doppelganger: { w: 60, h: 88, ay: 0.94 },
  glasswalker: { w: 62, h: 98, ay: 0.95 },
  marionette: { w: 60, h: 92, ay: 0.9 },
  splitter: { w: 76, h: 66, ay: 0.9 },
  splitter_mid: { w: 76, h: 66, ay: 0.9 },
  splitter_small: { w: 76, h: 66, ay: 0.9 },
  crooked_clown: { w: 60, h: 104, ay: 0.95 },
  reflection_thief: { w: 66, h: 92, ay: 0.94 },
};

export function drawFunhouseEnemy(ctx: Ctx, id: string, w: number, h: number, s: number, c: number, mode: EnemyMode): boolean {
  switch (id) {
    case 'grinning_mannequin':
    case 'grand_mannequin': mannequin(ctx, w, h, s, mode); return true;
    case 'doppelganger': doppelganger(ctx, w, h, s, c, mode); return true;
    case 'glasswalker': glasswalker(ctx, w, h, s, mode); return true;
    case 'marionette': marionette(ctx, w, h, s, c, mode); return true;
    case 'splitter':
    case 'splitter_mid':
    case 'splitter_small': splitter(ctx, w, h, s, mode); return true;
    case 'crooked_clown': crookedClown(ctx, w, h, s, c, mode); return true;
    case 'reflection_thief': thief(ctx, w, h, s, mode); return true;
  }
  return false;
}

const PORCELAIN = '#e9e1d2';

// ---------------------------------------------------------------- Grinning Mannequin
function mannequin(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  // a jointed shop dummy, mid-stride, frozen in a pose it should not be able to hold
  for (const side of [-1, 1]) {
    const k = side * (mode === 'windup' ? 0.4 : s * 0.25);
    hose(ctx, cx + side * 5, 54, cx + side * 6 + k * 10, 68, cx + side * 7 + k * 16, h - 8, 5, PORCELAIN);
    circle(ctx, cx + side * 6 + k * 10, 68, 3.4);
    fillInk(ctx, '#c9bfae', 1.6);
  }
  ellipse(ctx, cx, 44, 13, 17);
  fillInk(ctx, shade(ctx, cx - 4, 38, 18, '#fff8ea', '#b9ad98'), 3);
  // the seam where the torso screws on
  ink(ctx, 1.4);
  ctx.beginPath();
  ctx.moveTo(cx - 12, 48);
  ctx.quadraticCurveTo(cx, 51, cx + 12, 48);
  ctx.stroke();
  for (const side of [-1, 1]) {
    hose(ctx, cx + side * 12, 32, cx + side * 21, 40 + s * 3, cx + side * 18, 54, 4, PORCELAIN);
    circle(ctx, cx + side * 18, 56, 4);
    fillInk(ctx, PORCELAIN, 2);
  }
  // the egg-smooth head with a painted, too-wide grin
  const hy = 16;
  ellipse(ctx, cx, hy, 11, 13);
  fillInk(ctx, shade(ctx, cx - 3, hy - 4, 14, '#ffffff', '#cbbfac'), 3);
  shine(ctx, cx - 4, hy - 6, 3);
  ctx.fillStyle = '#1a1014';
  for (const side of [-1, 1]) {
    ellipse(ctx, cx + side * 4, hy - 2, 1.8, mode === 'windup' ? 0.6 : 2.4);
    ctx.fill();
  }
  grin(ctx, cx, hy + 5, 16, 2.6, 8, '#6a1018', 1.6);
}

// ---------------------------------------------------------------- Doppelganger
function doppelganger(ctx: Ctx, w: number, h: number, s: number, c: number, mode: EnemyMode): void {
  const cx = w / 2;
  const chrome = (x: number, y: number, r: number) => shade(ctx, x - r * 0.3, y - r * 0.4, r * 1.4, '#f4fbff', '#5a6a7a');
  // a silvered copy of a person, a beat out of step
  for (const side of [-1, 1]) {
    const fx = cx + side * 6 + s * side * 9;
    hose(ctx, cx + side * 4, 54, cx + side * 6, 66, fx, h - 10, 5, '#b8c8d4');
    shoe(ctx, fx, h - 7, 7, '#4a5a68');
  }
  roundRect(ctx, cx - 12, 30, 24, 26, 8);
  fillInk(ctx, chrome(cx, 40, 16), 3);
  for (const side of [-1, 1]) {
    const sw = side * c * 7 + (mode === 'windup' ? side * 6 : 0);
    hose(ctx, cx + side * 11, 34, cx + side * 17, 42, cx + side * 15 + sw, 52, 4, '#b8c8d4');
    glove(ctx, cx + side * 15 + sw, 54, 4.2, Math.PI / 2, '#dfe9f0');
  }
  const hy = 18;
  circle(ctx, cx, hy, 11);
  fillInk(ctx, chrome(cx, hy, 12), 3);
  shine(ctx, cx - 4, hy - 5, 3.4);
  // blank, mirrored eyes and the faint crack where its face meets the glass
  for (const side of [-1, 1]) {
    ellipse(ctx, cx + side * 4, hy - 1, 2.4, 3);
    fillInk(ctx, mode === 'windup' ? '#ffffff' : '#9fd8ff', 1.4);
  }
  ink(ctx, 1.2);
  ctx.beginPath();
  ctx.moveTo(cx + 6, hy - 10);
  ctx.lineTo(cx + 2, hy - 2);
  ctx.lineTo(cx + 7, hy + 4);
  ctx.stroke();
}

// ---------------------------------------------------------------- Glasswalker
function glasswalker(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  ctx.save();
  // a faceted figure of broken mirror, all knees and elbows
  const shard = (pts: [number, number][], light: string, dark: string) => {
    ctx.beginPath();
    ctx.moveTo(cx + pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(cx + x, y);
    ctx.closePath();
    fillInk(ctx, shade(ctx, cx, 40, 40, light, dark), 2.2);
  };
  for (const side of [-1, 1]) {
    const k = side * s * 6;
    shard([[side * 4, 58], [side * 9 + k, 74], [side * 6 + k, h - 6], [side * 2 + k * 0.5, 74]], '#e8f6ff', '#6a8aa8');
  }
  shard([[-10, 28], [10, 28], [7, 60], [-7, 60]], '#f2fbff', '#7896b4');
  for (const side of [-1, 1]) {
    const raise = mode === 'windup' ? -16 : 0;
    shard([[side * 9, 30], [side * 22, 40 + raise], [side * 26, 60 + raise], [side * 18, 44 + raise]], '#e4f4ff', '#6688a8');
  }
  shard([[-8, 8], [8, 6], [10, 22], [0, 28], [-9, 20]], '#ffffff', '#88a8c4');
  // the glow of the room behind the glass
  ctx.globalAlpha = 0.85;
  for (const side of [-1, 1]) {
    circle(ctx, cx + side * 3.5, 16, 2);
    ctx.fillStyle = mode === 'windup' ? '#ffffff' : '#7dffd8';
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Marionette
function marionette(ctx: Ctx, w: number, h: number, s: number, c: number, mode: EnemyMode): void {
  const cx = w / 2;
  const lift = mode === 'windup' ? -8 : s * 3;
  // strings up into the dark
  ink(ctx, 1);
  ctx.strokeStyle = 'rgba(230, 220, 200, 0.7)';
  ctx.beginPath();
  for (const x of [-14, -6, 6, 14]) {
    ctx.moveTo(cx + x, 0);
    ctx.lineTo(cx + x * 1.2, 36 + lift);
  }
  ctx.stroke();
  ctx.save();
  ctx.translate(0, lift);
  const wood = '#b88a5a';
  for (const side of [-1, 1]) {
    const dangle = side * c * 6;
    hose(ctx, cx + side * 4, 56, cx + side * 6 + dangle, 70, cx + side * 5 + dangle * 1.6, h - 14, 4, wood);
    circle(ctx, cx + side * 5 + dangle * 1.6, h - 12, 4);
    fillInk(ctx, '#5a3a24', 1.6);
  }
  roundRect(ctx, cx - 10, 32, 20, 26, 5);
  fillInk(ctx, shade(ctx, cx, 40, 18, '#c84a5a', '#5a1420'), 3);
  for (const side of [-1, 1]) {
    hose(ctx, cx + side * 9, 34, cx + side * 18, 32 - s * 4, cx + side * 20, 46, 3.6, wood);
    circle(ctx, cx + side * 20, 47, 3.4);
    fillInk(ctx, wood, 1.6);
  }
  const hy = 20;
  circle(ctx, cx, hy, 11);
  fillInk(ctx, shade(ctx, cx - 3, hy - 4, 13, '#e8c8a0', '#9a6a40'), 3);
  // a hinged jaw hanging open, painted cheeks, one eye cracked
  pieEye(ctx, cx - 4, hy - 2, 2.6, 3.2, 0, 0);
  pieEye(ctx, cx + 4, hy - 2, 2.6, 3.2, 0, 0, { dead: true });
  roundRect(ctx, cx - 5, hy + 4 + (mode === 'windup' ? 3 : 1), 10, 4, 1);
  fillInk(ctx, '#3a1a10', 1.4);
  ctx.restore();
}

// ---------------------------------------------------------------- Splitter
function splitter(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2, cy = h - 26;
  const bulge = mode === 'windup' ? 4 : s * 2;
  // a lump of flesh shaped like a bad reflection: too many eyes, a mouth that wanders
  ctx.beginPath();
  ctx.moveTo(cx - 28 - bulge, cy + 18);
  ctx.bezierCurveTo(cx - 34, cy - 20, cx - 6, cy - 30 - bulge, cx + 4, cy - 22);
  ctx.bezierCurveTo(cx + 26, cy - 34, cx + 36 + bulge, cy, cx + 28, cy + 18);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx - 6, cy - 10, 34, '#e89aa0', '#6a2232'), 3);
  ink(ctx, 1.4);
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - 22);
  ctx.quadraticCurveTo(cx + 2, cy, cx - 1, cy + 18);
  ctx.stroke();
  for (const [x, y, r] of [[-12, -8, 4.4], [8, -12, 3.6], [16, 0, 2.8], [-4, -2, 2.4]] as [number, number, number][]) {
    pieEye(ctx, cx + x, cy + y, r, r * 1.1, s * 0.6, 0);
  }
  grin(ctx, cx + 2, cy + 8, 22, 3, 7, '#3a0b10', 1.6);
  shine(ctx, cx - 16, cy - 16, 3.6, 0.6);
}

// ---------------------------------------------------------------- Crooked Clown
function crookedClown(ctx: Ctx, w: number, h: number, s: number, c: number, mode: EnemyMode): void {
  const cx = w / 2;
  ctx.save();
  // stretched tall and leaning, as if a funhouse mirror had kept him
  ctx.translate(cx, h);
  ctx.transform(1, 0, -0.18 + s * 0.04, 1, 0, 0);
  ctx.translate(-cx, -h);
  for (const side of [-1, 1]) {
    const fx = cx + side * 5 + s * side * 6;
    hose(ctx, cx + side * 4, 62, cx + side * 6, 80, fx, h - 10, 3.6, side < 0 ? '#6a3aa0' : '#2a8a7a');
    shoe(ctx, fx, h - 7, 7.5, '#a8202a');
  }
  roundRect(ctx, cx - 9, 30, 18, 34, 6);
  fillInk(ctx, shade(ctx, cx, 44, 20, '#f2e6c8', '#9a8a6a'), 3);
  ctx.fillStyle = '#6a3aa0';
  for (let k = 0; k < 4; k++) {
    roundRect(ctx, cx - 9, 32 + k * 8, 18, 3, 1);
    ctx.fill();
  }
  // juggling pins: one cocked back to throw
  for (const side of [-1, 1]) {
    const throwing = side > 0 && mode === 'windup';
    const hx = cx + side * 16, hy = throwing ? 22 : 50 + c * 3;
    hose(ctx, cx + side * 8, 34, cx + side * 14, 40, hx, hy, 3.2, '#f2e6c8');
    ellipse(ctx, hx, hy - 7, 3, 7, side * 0.4);
    fillInk(ctx, '#fff6e0', 1.6);
  }
  const hy = 16;
  ellipse(ctx, cx, hy, 7, 11);
  fillInk(ctx, shade(ctx, cx, hy, 10, '#ffffff', '#d8d0c0'), 3);
  pieEye(ctx, cx - 3, hy - 2, 2.2, 3.2, s, 0);
  pieEye(ctx, cx + 3, hy - 3, 2.2, 3.4, -s, 0);
  grin(ctx, cx, hy + 5, 10, 2, 5, '#5a0a14', 1.4);
  circle(ctx, cx, hy + 1, 2.2);
  fillInk(ctx, '#e8202a', 1.4);
  ctx.restore();
}

// ---------------------------------------------------------------- Reflection Thief
function thief(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  // a hooded figure in moth-eaten velvet, a hand mirror held up like a lantern
  ctx.beginPath();
  ctx.moveTo(cx - 8, 18);
  ctx.quadraticCurveTo(cx - 24, 50, cx - 20 + s * 2, h - 6);
  ctx.lineTo(cx + 20 - s * 2, h - 6);
  ctx.quadraticCurveTo(cx + 24, 50, cx + 8, 18);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx - 4, 40, 40, '#4a3a6a', '#140c20'), 3);
  ellipse(ctx, cx, 18, 12, 14);
  fillInk(ctx, shade(ctx, cx, 14, 14, '#3a2c54', '#0c0814'), 3);
  for (const side of [-1, 1]) {
    circle(ctx, cx + side * 4, 20, 1.8);
    ctx.fillStyle = '#e8f6ff';
    ctx.fill();
  }
  const my = mode === 'windup' ? 26 : 42;
  hose(ctx, cx + 8, 36, cx + 18, 40, cx + 22, my + 8, 3.4, '#2a1e3c');
  roundRect(ctx, cx + 20, my + 8, 3, 12, 1);
  fillInk(ctx, '#b8933e', 1.4);
  ellipse(ctx, cx + 21.5, my, 8, 10);
  fillInk(ctx, '#b8933e', 2.4);
  ellipse(ctx, cx + 21.5, my, 6, 8);
  fillInk(ctx, shade(ctx, cx + 20, my - 3, 9, '#ffffff', '#88aacc'), 1.4);
  if (mode === 'windup') shine(ctx, cx + 20, my - 3, 3.4);
}
