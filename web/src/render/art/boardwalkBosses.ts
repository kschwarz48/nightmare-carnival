// The Boardwalk bosses' 2D portraits (D-68): the boss bar, the warning card and the bestiary. Same ink,
// same rubber-hose shading as the other maps' portraits; 200×200 canvases.

import { INK, circle, ellipse, fillInk, grin, ink, pieEye, roundRect, shade, shine, softShadow, vstripes, type Ctx } from './kit';

export function drawBoardwalkPortrait(ctx: Ctx, id: string): boolean {
  switch (id) {
    case 'barker': barker(ctx); return true;
    case 'drowned_captain': captain(ctx); return true;
    case 'last_ride': lastRide(ctx); return true;
    case 'leviathan': leviathan(ctx); return true;
    case 'commodore': commodore(ctx); return true;
  }
  return false;
}

function barker(ctx: Ctx): void {
  softShadow(ctx, 100, 190, 76, 9);
  // the candy-striped blazer
  ctx.beginPath();
  ctx.moveTo(38, 200);
  ctx.lineTo(54, 128);
  ctx.lineTo(146, 128);
  ctx.lineTo(162, 200);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  vstripes(ctx, 30, 120, 140, 90, '#b8262a', '#efe4cc', 9);
  ctx.restore();
  ink(ctx, 3);
  ctx.stroke();
  // the megaphone, up at his mouth
  ctx.beginPath();
  ctx.moveTo(120, 106);
  ctx.lineTo(186, 78);
  ctx.lineTo(192, 132);
  ctx.lineTo(122, 118);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 160, 100, 40, '#d8483a', '#7a1a14'), 3);
  ellipse(ctx, 189, 105, 6, 27);
  fillInk(ctx, '#d8b04a', 2.4);
  // the face: a waxed moustache over too many teeth
  ellipse(ctx, 92, 96, 32, 36);
  fillInk(ctx, shade(ctx, 84, 84, 40, '#f4d8b8', '#c8a080'), 3);
  pieEye(ctx, 80, 86, 4.5, 5.5, 0.3, 0);
  pieEye(ctx, 104, 86, 4.5, 5.5, 0.3, 0);
  grin(ctx, 92, 112, 42, 13, 9, '#3a0b10', 2.6);
  ink(ctx, 4);
  ctx.beginPath();
  ctx.moveTo(92, 102);
  ctx.quadraticCurveTo(76, 98, 66, 106);
  ctx.moveTo(92, 102);
  ctx.quadraticCurveTo(108, 98, 118, 106);
  ctx.stroke();
  // the straw boater with its red band
  ellipse(ctx, 92, 62, 52, 10);
  fillInk(ctx, '#e0c888', 3);
  roundRect(ctx, 64, 34, 56, 28, 4);
  fillInk(ctx, '#e0c888', 3);
  roundRect(ctx, 64, 48, 56, 8, 1);
  fillInk(ctx, '#a8202a', 2);
}

function captain(ctx: Ctx): void {
  softShadow(ctx, 100, 190, 76, 9);
  // the greatcoat, gold buttons and epaulettes
  ctx.beginPath();
  ctx.moveTo(34, 200);
  ctx.lineTo(52, 124);
  ctx.lineTo(148, 124);
  ctx.lineTo(166, 200);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 90, 140, 80, '#2a4048', '#0e181c'), 3);
  for (const x of [88, 112]) for (let i = 0; i < 3; i++) {
    circle(ctx, x, 150 + i * 16, 3.4);
    fillInk(ctx, '#d8b04a', 1.6);
  }
  for (const x of [52, 148]) {
    ellipse(ctx, x, 126, 18, 7);
    fillInk(ctx, '#d8b04a', 2.4);
  }
  // a drowned face: grey-green, hollow-eyed, a beard of kelp
  ellipse(ctx, 100, 92, 30, 36);
  fillInk(ctx, shade(ctx, 92, 80, 40, '#a8b8b0', '#5a6a62'), 3);
  pieEye(ctx, 88, 86, 5, 6, 0, 0.1, { glow: '#9ff8ff' });
  pieEye(ctx, 112, 86, 5, 6, 0, 0.1, { glow: '#9ff8ff' });
  ink(ctx, 3);
  for (let i = 0; i < 7; i++) {
    const x = 80 + i * 6.5;
    ctx.strokeStyle = i % 2 ? '#3a4424' : '#2e3a1e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 110);
    ctx.quadraticCurveTo(x + (i - 3) * 2, 130, x + (i - 3) * 3, 146 + (i % 3) * 6);
    ctx.stroke();
  }
  // the peaked cap
  ellipse(ctx, 100, 56, 40, 14);
  fillInk(ctx, '#b8b8a8', 3);
  roundRect(ctx, 70, 54, 60, 10, 3);
  fillInk(ctx, INK, 2.4);
  ellipse(ctx, 100, 66, 30, 6);
  fillInk(ctx, '#0a0c0e', 2.4);
  circle(ctx, 100, 54, 6);
  fillInk(ctx, '#d8b04a', 2);
}

function lastRide(ctx: Ctx): void {
  softShadow(ctx, 100, 188, 86, 9);
  // a coaster car coming straight at you, a serpent's head reared on its nose
  roundRect(ctx, 24, 108, 152, 70, 18);
  fillInk(ctx, shade(ctx, 90, 130, 90, '#a8282a', '#4a0a0a'), 3);
  roundRect(ctx, 24, 104, 152, 8, 3);
  fillInk(ctx, '#d8b04a', 2.4);
  for (let i = 0; i < 7; i++) {
    circle(ctx, 34 + i * 22, 162, 4.5);
    fillInk(ctx, i % 2 ? '#ffd27a' : '#ff8a4a', 1.6);
  }
  ctx.beginPath();
  ctx.moveTo(80, 110);
  ctx.quadraticCurveTo(70, 70, 100, 46);
  ctx.quadraticCurveTo(130, 70, 120, 110);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 96, 70, 40, '#b8302a', '#5a0e0e'), 3);
  ellipse(ctx, 100, 50, 26, 20);
  fillInk(ctx, shade(ctx, 92, 44, 26, '#c83a2a', '#6a1010'), 3);
  pieEye(ctx, 90, 46, 4.5, 5, 0, 0, { glow: '#ffe8a0' });
  pieEye(ctx, 110, 46, 4.5, 5, 0, 0, { glow: '#ffe8a0' });
  grin(ctx, 100, 62, 30, 9, 7, '#2a0606', 2.4);
  // the riders: pale shapes with their arms up
  for (const x of [56, 144]) {
    ellipse(ctx, x, 90, 9, 10);
    fillInk(ctx, '#d8eef4', 2.4);
    ink(ctx, 3);
    ctx.strokeStyle = '#d8eef4';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 6, 96);
    ctx.lineTo(x - 14, 70);
    ctx.moveTo(x + 6, 96);
    ctx.lineTo(x + 14, 70);
    ctx.stroke();
  }
}

function leviathan(ctx: Ctx): void {
  // the sea, and what is coming up out of it
  ctx.fillStyle = '#0c1a20';
  ctx.fillRect(0, 150, 200, 50);
  ink(ctx, 2);
  ctx.strokeStyle = '#7ab8c8';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(10 + i * 50, 158 + (i % 2) * 6);
    ctx.quadraticCurveTo(30 + i * 50, 150, 50 + i * 50, 158 + (i % 2) * 6);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(26, 160);
  ctx.quadraticCurveTo(20, 70, 100, 36);
  ctx.quadraticCurveTo(180, 70, 174, 160);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 90, 80, 90, '#2a3a3e', '#0a1214'), 3);
  // lamp eyes under a brow of barnacles, and the jaw full of needles
  for (const x of [66, 134]) {
    circle(ctx, x, 92, 12);
    fillInk(ctx, '#c8ffe0', 3);
    circle(ctx, x + 2, 93, 4.5);
    fillInk(ctx, INK, 0);
    shine(ctx, x - 4, 88, 4, 0.8);
  }
  for (let i = 0; i < 9; i++) {
    circle(ctx, 52 + i * 12, 70 - Math.sin((i / 8) * Math.PI) * 14, 4);
    fillInk(ctx, '#cfc6b0', 1.6);
  }
  ctx.beginPath();
  ctx.moveTo(52, 126);
  ctx.quadraticCurveTo(100, 168, 148, 126);
  ctx.closePath();
  fillInk(ctx, '#2a0a10', 3);
  ctx.fillStyle = '#e8ecd8';
  for (let i = 0; i < 9; i++) {
    const x = 58 + i * 10.5;
    ctx.beginPath();
    ctx.moveTo(x - 3, 128);
    ctx.lineTo(x, 142 + (i % 2) * 6);
    ctx.lineTo(x + 3, 128);
    ctx.fill();
  }
  // three lures burning on its crown
  for (const x of [80, 100, 120]) {
    circle(ctx, x, 24 + (x === 100 ? -6 : 0), 5);
    fillInk(ctx, '#d8ffc0', 1.8);
  }
}

function commodore(ctx: Ctx): void {
  softShadow(ctx, 100, 190, 76, 9);
  // the white suit gone green with the sea
  ctx.beginPath();
  ctx.moveTo(38, 200);
  ctx.lineTo(56, 126);
  ctx.lineTo(144, 126);
  ctx.lineTo(162, 200);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 90, 140, 80, '#e0dac8', '#7a8a6a'), 3);
  for (let i = 0; i < 3; i++) {
    circle(ctx, 112, 150 + i * 15, 3.2);
    fillInk(ctx, '#d8b04a', 1.6);
  }
  // the ledger held to his chest
  roundRect(ctx, 54, 140, 46, 56, 4);
  fillInk(ctx, '#5a3420', 3);
  for (let i = 0; i < 4; i++) {
    roundRect(ctx, 60, 148 + i * 11, 34, 3, 1);
    fillInk(ctx, '#c83a2a', 0);
  }
  // an old man's face, white mutton chops, pale burning eyes
  ellipse(ctx, 100, 94, 30, 36);
  fillInk(ctx, shade(ctx, 92, 82, 40, '#e0dccc', '#9aa894'), 3);
  for (const x of [72, 128]) {
    ellipse(ctx, x, 108, 9, 16);
    fillInk(ctx, '#f0ece0', 2.4);
  }
  pieEye(ctx, 88, 88, 4, 5, 0, 0.1, { glow: '#9ff8e0' });
  pieEye(ctx, 112, 88, 4, 5, 0, 0.1, { glow: '#9ff8e0' });
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(90, 116);
  ctx.quadraticCurveTo(100, 112, 110, 116);
  ctx.stroke();
  // the commodore's cap with its gold anchor
  ellipse(ctx, 100, 56, 40, 14);
  fillInk(ctx, '#e8e4d8', 3);
  roundRect(ctx, 70, 54, 60, 10, 3);
  fillInk(ctx, INK, 2.4);
  ellipse(ctx, 100, 66, 30, 6);
  fillInk(ctx, '#0a0c0e', 2.4);
  circle(ctx, 100, 54, 6);
  fillInk(ctx, '#d8b04a', 2);
}
