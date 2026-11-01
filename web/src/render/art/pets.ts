// The companions' portraits (D-84) for the Companions panel and character select: the same inked style as the
// icons, after the real Milo (a black-and-white Cavapoo: a charcoal bed-head and ears, a pale muzzle and brows, a
// white chest, the tip of his tongue showing) and the real Augustus (a Russian Blue: silver-blue all over, big ears,
// green-gold eyes, a grey nose).

import { circle, ellipse, fillInk, ink, shade, type Ctx } from './kit';

/** A pet's portrait in a w x h box (drawn on a 64-unit grid). */
export function petPortrait(ctx: Ctx, w: number, h: number, id: string): void {
  const s = Math.min(w, h) / 64;
  ctx.save();
  ctx.translate((w - 64 * s) / 2, (h - 64 * s) / 2);
  ctx.scale(s, s);
  circle(ctx, 32, 32, 30);
  fillInk(ctx, shade(ctx, 32, 28, 34, id === 'milo' ? '#6a4a3a' : '#2e4a5a', id === 'milo' ? '#24161a' : '#101a24'), 3);
  ctx.save();
  circle(ctx, 32, 32, 28.5);
  ctx.clip();
  if (id === 'milo') milo(ctx);
  else if (id === 'augustus') augustus(ctx);
  ctx.restore();
  ctx.restore();
}

/** A row of curls along an arc (fluff on a coat's edge). */
function curls(ctx: Ctx, cx: number, cy: number, r: number, a0: number, a1: number, n: number, rr: number, col: string): void {
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    circle(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, rr);
    fillInk(ctx, col, 1.4);
  }
}

function milo(ctx: Ctx): void {
  const dark = '#2e2c2e', grey = '#5a5658', pale = '#e6e0d6';
  // the white chest, curly
  ellipse(ctx, 32, 62, 24, 14);
  fillInk(ctx, pale, 2);
  curls(ctx, 32, 62, 20, Math.PI * 1.05, Math.PI * 1.95, 8, 4, pale);
  // the floppy ears, long and wavy
  for (const sx of [-1, 1]) {
    ellipse(ctx, 32 + sx * 17, 36, 8.5, 16, sx * 0.22);
    fillInk(ctx, shade(ctx, 32 + sx * 16, 30, 16, grey, dark), 2.2);
    ink(ctx, 1.2);
    ctx.strokeStyle = '#6a6668';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(32 + sx * 17, 30 + k * 8, 3.5, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
  }
  // the head: a charcoal dome with a bed-head of curls on top
  circle(ctx, 32, 30, 16.5);
  fillInk(ctx, shade(ctx, 30, 24, 18, grey, dark), 2.4);
  curls(ctx, 32, 30, 15, Math.PI * 1.15, Math.PI * 1.85, 7, 3.6, dark);
  for (const [x, y] of [[27, 13], [33, 11.5], [38, 13.5]] as [number, number][]) {
    ellipse(ctx, x, y, 2, 4.5, (x - 33) * 0.08);
    fillInk(ctx, dark, 1.2);
  }
  // the pale muzzle and brows
  ellipse(ctx, 32, 38.5, 11, 8.5);
  fillInk(ctx, shade(ctx, 32, 36, 12, '#f2ece2', '#bdb6ac'), 1.8);
  for (const sx of [-1, 1]) {
    ellipse(ctx, 32 + sx * 7, 25, 4, 2.2, sx * -0.3);
    fillInk(ctx, '#b0aaa4', 1);
  }
  // the eyes: dark and round, peering out of the fluff
  for (const sx of [-1, 1]) {
    circle(ctx, 32 + sx * 7.2, 29.5, 3.2);
    fillInk(ctx, '#120e10', 1.4);
    circle(ctx, 32 + sx * 7.2 + 1, 28.4, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  // the nose, the mouth, the tip of the tongue
  ctx.beginPath();
  ctx.moveTo(28.2, 35);
  ctx.quadraticCurveTo(32, 33, 35.8, 35);
  ctx.quadraticCurveTo(34, 39.2, 32, 39.4);
  ctx.quadraticCurveTo(30, 39.2, 28.2, 35);
  fillInk(ctx, '#141012', 1.4);
  ink(ctx, 1.3);
  ctx.beginPath();
  ctx.moveTo(32, 39.4);
  ctx.lineTo(32, 41.6);
  ctx.moveTo(28.6, 41.4);
  ctx.quadraticCurveTo(30.4, 43, 32, 41.6);
  ctx.quadraticCurveTo(33.6, 43, 35.4, 41.4);
  ctx.stroke();
  ellipse(ctx, 33.2, 43.4, 1.9, 1.5);
  fillInk(ctx, '#ef7f96', 1);
}

function augustus(ctx: Ctx): void {
  const blue = '#7c8794', deep = '#56606c', inner = '#b9a2aa';
  // shoulders
  ellipse(ctx, 32, 63, 22, 13);
  fillInk(ctx, shade(ctx, 30, 58, 22, blue, deep), 2);
  // the big ears
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(32 + sx * 6, 22);
    ctx.lineTo(32 + sx * 18, 3.5);
    ctx.lineTo(32 + sx * 19, 27);
    ctx.closePath();
    fillInk(ctx, shade(ctx, 32 + sx * 14, 14, 14, blue, deep), 2.2);
    ctx.beginPath();
    ctx.moveTo(32 + sx * 9, 21.5);
    ctx.lineTo(32 + sx * 17, 8.5);
    ctx.lineTo(32 + sx * 17.2, 24);
    ctx.closePath();
    fillInk(ctx, inner, 1);
  }
  // the head: a short wedge, broad at the whisker pads
  ctx.beginPath();
  ctx.moveTo(14, 30);
  ctx.quadraticCurveTo(15, 16, 32, 15);
  ctx.quadraticCurveTo(49, 16, 50, 30);
  ctx.quadraticCurveTo(50, 46, 32, 50);
  ctx.quadraticCurveTo(14, 46, 14, 30);
  fillInk(ctx, shade(ctx, 30, 24, 22, '#9aa4b0', deep), 2.4);
  // silver tipping: a few light strokes on the brow
  ink(ctx, 1);
  ctx.strokeStyle = 'rgba(220, 228, 236, 0.5)';
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(26 + k * 4, 18.5);
    ctx.lineTo(27 + k * 4, 22);
    ctx.stroke();
  }
  // the eyes: almond, green-gold, the pupils narrowed
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(32 + sx * 8, 31);
    ctx.rotate(sx * -0.18);
    ellipse(ctx, 0, 0, 5.2, 3.6);
    fillInk(ctx, shade(ctx, -1, -1, 6, '#e0e878', '#8aa430'), 1.6);
    ellipse(ctx, 0, 0, 1.1, 3.2);
    ctx.fillStyle = '#141814';
    ctx.fill();
    circle(ctx, 1.6, -1.2, 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }
  // the whisker pads, the grey nose, the mouth, the whiskers
  for (const sx of [-1, 1]) {
    ellipse(ctx, 32 + sx * 3.6, 41.5, 4, 3);
    fillInk(ctx, '#8e98a4', 1.2);
  }
  ctx.beginPath();
  ctx.moveTo(29.4, 37);
  ctx.lineTo(34.6, 37);
  ctx.lineTo(32, 40);
  ctx.closePath();
  fillInk(ctx, '#4a525c', 1.2);
  ink(ctx, 1.1);
  ctx.beginPath();
  ctx.moveTo(32, 40);
  ctx.lineTo(32, 42);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(236, 240, 244, 0.85)';
  ctx.lineWidth = 0.8;
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(32 + sx * 6, 41 + k * 1.6);
    ctx.lineTo(32 + sx * 22, 38 + k * 3.4);
    ctx.stroke();
  }
}
