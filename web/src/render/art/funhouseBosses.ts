// The Fun House bosses' 2D portraits (D-63): the boss bar, the warning card and the bestiary. Same ink,
// same rubber-hose shading as the first map's portraits; 200×200 canvases.

import { INK, circle, ellipse, fillInk, grin, ink, pieEye, roundRect, shade, shine, softShadow, stripes, vstripes, type Ctx } from './kit';

export function drawFunhousePortrait(ctx: Ctx, id: string): boolean {
  switch (id) {
    case 'crooked_twins': twins(ctx); return true;
    case 'looking_glass': glass(ctx); return true;
    case 'stringmistress': strings(ctx); return true;
    case 'proprietor': proprietor(ctx); return true;
    case 'unreflected': unreflected(ctx); return true;
  }
  return false;
}

function twins(ctx: Ctx): void {
  softShadow(ctx, 100, 186, 80, 10);
  // the rope between them
  ink(ctx, 3);
  ctx.strokeStyle = '#c8a870';
  ctx.beginPath();
  ctx.moveTo(62, 112);
  ctx.quadraticCurveTo(100, 150, 140, 128);
  ctx.stroke();
  // Stilts: striped stilt-legs, a mustard waistcoat, a long face under a pointed hat
  for (const x of [52, 70]) {
    vstripes(ctx, x - 5, 110, 10, 74, '#e8d8b8', '#9a2a24', 5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.strokeRect(x - 5, 110, 10, 74);
  }
  roundRect(ctx, 44, 70, 34, 44, 8);
  fillInk(ctx, shade(ctx, 56, 80, 30, '#d8b058', '#8a6a2a'), 3);
  ellipse(ctx, 61, 52, 13, 17);
  fillInk(ctx, shade(ctx, 58, 46, 16, '#fff6e8', '#cfc0a8'), 3);
  pieEye(ctx, 56, 48, 2.6, 3.4, 0.2, 0);
  pieEye(ctx, 66, 48, 2.6, 3.4, 0.2, 0);
  circle(ctx, 61, 56, 3);
  fillInk(ctx, '#e83a2a', 1.6);
  ctx.beginPath();
  ctx.moveTo(48, 40);
  ctx.lineTo(76, 36);
  ctx.lineTo(70, 4);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  stripes(ctx, 40, 0, 40, 42, '#f0e6d0', '#2a3a5a', 7);
  ctx.restore();
  ink(ctx, 3);
  ctx.stroke();
  circle(ctx, 70, 4, 5);
  fillInk(ctx, '#e83a2a', 2);
  // Barrel: a staved barrel and a round clown face on top
  roundRect(ctx, 112, 112, 60, 70, 18);
  fillInk(ctx, shade(ctx, 132, 130, 50, '#a8784a', '#5a3a22'), 3);
  for (const y of [124, 147, 170]) {
    ctx.strokeStyle = '#3a3a40';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(114, y);
    ctx.lineTo(170, y);
    ctx.stroke();
  }
  circle(ctx, 142, 96, 22);
  fillInk(ctx, shade(ctx, 136, 88, 24, '#fff6e8', '#cfc0a8'), 3);
  pieEye(ctx, 134, 92, 3, 4, -0.2, 0);
  pieEye(ctx, 150, 92, 3, 4, -0.2, 0);
  circle(ctx, 142, 101, 5);
  fillInk(ctx, '#e83a2a', 1.8);
  grin(ctx, 142, 108, 18, 6, 4);
  ellipse(ctx, 142, 74, 20, 6);
  fillInk(ctx, INK, 2);
  roundRect(ctx, 130, 56, 24, 18, 8);
  fillInk(ctx, INK, 2);
}

function glass(ctx: Ctx): void {
  softShadow(ctx, 100, 188, 60, 9);
  // clawed gilt legs
  ink(ctx, 6);
  ctx.strokeStyle = '#b8933e';
  for (const [x0, x1] of [[78, 52], [92, 82], [108, 118], [122, 148]]) {
    ctx.beginPath();
    ctx.moveTo(x0, 150);
    ctx.quadraticCurveTo((x0 + x1) / 2, 166, x1, 186);
    ctx.stroke();
  }
  // the oval glass in its frame
  ellipse(ctx, 100, 86, 56, 76);
  fillInk(ctx, '#b8933e', 3);
  ellipse(ctx, 100, 86, 46, 66);
  fillInk(ctx, shade(ctx, 84, 60, 70, '#c8dce4', '#56707c'), 3);
  // the face that lives in it: uneven hollow eyes, a grin of too many teeth
  ellipse(ctx, 82, 70, 11, 15, 0.2);
  fillInk(ctx, '#05090c', 2);
  ellipse(ctx, 118, 74, 9, 11, -0.3);
  fillInk(ctx, '#05090c', 2);
  circle(ctx, 84, 72, 2.2);
  fillInk(ctx, '#ffffff', 0);
  circle(ctx, 117, 76, 1.8);
  fillInk(ctx, '#ffffff', 0);
  grin(ctx, 100, 112, 70, 18, 10, '#05090c', 2.5);
  // a crack and the shine
  ink(ctx, 2);
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(130, 30);
  ctx.lineTo(118, 52);
  ctx.lineTo(128, 64);
  ctx.lineTo(112, 92);
  ctx.stroke();
  shine(ctx, 76, 44, 12, 0.6);
  // the crest
  circle(ctx, 100, 8, 8);
  fillInk(ctx, '#d8b058', 2.4);
}

function strings(ctx: Ctx): void {
  // strings up into the dark from the crossbar
  ink(ctx, 1.6);
  ctx.strokeStyle = '#e8e0d0';
  for (const x of [64, 84, 116, 136]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (x - 100) * 0.1, 30);
    ctx.stroke();
  }
  roundRect(ctx, 56, 26, 88, 8, 3);
  fillInk(ctx, '#a88a68', 2.4);
  // eight long legs from under the skirt
  ink(ctx, 4);
  ctx.strokeStyle = '#1c1420';
  for (let k = 0; k < 8; k++) {
    const s = k < 4 ? -1 : 1, i = k % 4;
    ctx.beginPath();
    ctx.moveTo(100 + s * 14, 150);
    ctx.quadraticCurveTo(100 + s * (40 + i * 12), 120 + i * 6, 100 + s * (50 + i * 14), 176 + i * 4);
    ctx.stroke();
  }
  // the velvet bodice and skirt
  ctx.beginPath();
  ctx.moveTo(84, 96);
  ctx.lineTo(116, 96);
  ctx.lineTo(132, 158);
  ctx.lineTo(68, 158);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 96, 110, 50, '#4a2a58', '#1a0e20'), 3);
  // arms up to the bar
  ink(ctx, 4);
  ctx.strokeStyle = '#2a1630';
  ctx.beginPath();
  ctx.moveTo(86, 100);
  ctx.lineTo(70, 36);
  ctx.moveTo(114, 100);
  ctx.lineTo(130, 36);
  ctx.stroke();
  // the porcelain head, black glass eyes, a hair bun with a pin
  circle(ctx, 100, 74, 21);
  fillInk(ctx, shade(ctx, 94, 66, 22, '#fffaf2', '#cfc4b4'), 3);
  ellipse(ctx, 100, 52, 18, 9);
  fillInk(ctx, INK, 2);
  circle(ctx, 100, 42, 9);
  fillInk(ctx, INK, 2);
  ellipse(ctx, 92, 74, 4, 5);
  fillInk(ctx, '#05080a', 1.4);
  ellipse(ctx, 108, 74, 4, 5);
  fillInk(ctx, '#05080a', 1.4);
  ellipse(ctx, 100, 86, 4.5, 2.2);
  fillInk(ctx, '#9a1a20', 1.4);
}

function proprietor(ctx: Ctx): void {
  // striped lapels and a velvet coat
  ctx.beginPath();
  ctx.moveTo(40, 200);
  ctx.lineTo(56, 128);
  ctx.lineTo(144, 128);
  ctx.lineTo(160, 200);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 90, 140, 70, '#5a2a68', '#22102a'), 3);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(84, 128);
  ctx.lineTo(100, 200);
  ctx.lineTo(116, 128);
  ctx.closePath();
  ctx.clip();
  vstripes(ctx, 84, 128, 32, 72, '#f0e6d0', '#2a1a2a', 6);
  ctx.restore();
  // the long pale face and THE GRIN
  ellipse(ctx, 100, 98, 34, 42);
  fillInk(ctx, shade(ctx, 92, 86, 40, '#fffaf0', '#cfc2ae'), 3);
  pieEye(ctx, 88, 86, 4, 5, 0.1, 0.1, { glow: '#ff3a2a' });
  pieEye(ctx, 112, 86, 4, 5, 0.1, 0.1, { glow: '#ff3a2a' });
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(78, 76);
  ctx.lineTo(94, 80);
  ctx.moveTo(122, 76);
  ctx.lineTo(106, 80);
  ctx.stroke();
  grin(ctx, 100, 112, 62, 20, 12, '#3a0b10', 3);
  // the top hat with its mirror band
  roundRect(ctx, 70, 14, 60, 46, 4);
  fillInk(ctx, INK, 3);
  roundRect(ctx, 70, 44, 60, 9, 2);
  fillInk(ctx, '#9ec8ff', 2);
  ellipse(ctx, 100, 60, 46, 8);
  fillInk(ctx, INK, 3);
}

function unreflected(ctx: Ctx): void {
  // the cloak of stolen faces round a blank glass figure
  const cols = ['#d8c8b0', '#e2b8a8', '#c8d0e0', '#e8dcc0', '#b8a090', '#f0e4d8'];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const x = 100 + Math.cos(a) * 74, y = 104 + Math.sin(a) * 66;
    ellipse(ctx, x, y, 13, 16);
    fillInk(ctx, cols[k % cols.length], 2.2);
    circle(ctx, x - 4, y - 3, 2);
    fillInk(ctx, INK, 0);
    circle(ctx, x + 4, y - 3, 2);
    fillInk(ctx, INK, 0);
    ellipse(ctx, x, y + 6, k % 3 ? 5 : 2.5, 2);
    fillInk(ctx, k % 2 ? '#8f1d18' : INK, 0);
  }
  ctx.beginPath();
  ctx.moveTo(100, 64);
  ctx.lineTo(136, 120);
  ctx.lineTo(120, 190);
  ctx.lineTo(80, 190);
  ctx.lineTo(64, 120);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 90, 100, 70, '#e8fbff', '#7ab8c8'), 3);
  // a face of smooth mirror
  ellipse(ctx, 100, 50, 22, 28);
  fillInk(ctx, shade(ctx, 92, 40, 30, '#ffffff', '#9ac8d8'), 3);
  shine(ctx, 92, 40, 9, 0.7);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(84 + i * 8, 26);
    ctx.lineTo(80 + i * 10, 4 + (i % 2) * 6);
    ctx.lineTo(90 + i * 8, 24);
    ctx.closePath();
    fillInk(ctx, '#f4ffff', 1.6);
  }
}
