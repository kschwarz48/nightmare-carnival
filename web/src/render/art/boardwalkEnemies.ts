// The Boardwalk's roster (D-68) for the Carnival-pedia: the same rubber-hose ink as the other maps'
// monsters, in the shore's own palette: drowned grey-green, wet navy and cream, rust, taffy pink, brass.

import { circle, ellipse, fillInk, glove, grin, hose, ink, pieEye, roundRect, shade, shine, vstripes, type Ctx } from './kit';
import type { EnemyMode } from './enemies';

export const BOARDWALK_ART: Record<string, { w: number; h: number; ay: number }> = {
  drowned: { w: 60, h: 92, ay: 0.94 },
  shore_crawler: { w: 78, h: 54, ay: 0.9 },
  ticket_taker: { w: 58, h: 98, ay: 0.95 },
  taffy_horror: { w: 76, h: 66, ay: 0.9 },
  arcade_automaton: { w: 58, h: 100, ay: 0.95 },
  coaster_wraith: { w: 70, h: 86, ay: 0.92 },
  barnacle_brute: { w: 76, h: 96, ay: 0.95 },
  great_barnacle: { w: 76, h: 96, ay: 0.95 },
  lantern_angler: { w: 80, h: 70, ay: 0.9 },
  prize_collector: { w: 74, h: 98, ay: 0.95 },
  tidecaller: { w: 66, h: 108, ay: 0.95 },
  tin_duck: { w: 60, h: 56, ay: 0.92 },
};

export function drawBoardwalkEnemy(ctx: Ctx, id: string, w: number, h: number, s: number, _c: number, mode: EnemyMode): boolean {
  switch (id) {
    case 'drowned': drowned(ctx, w, h, s, mode); return true;
    case 'shore_crawler': crab(ctx, w, h, s, mode); return true;
    case 'ticket_taker': usher(ctx, w, h, s, mode); return true;
    case 'taffy_horror': taffy(ctx, w, h, s, mode); return true;
    case 'arcade_automaton': automaton(ctx, w, h, s, mode); return true;
    case 'coaster_wraith': wraith(ctx, w, h, s, mode); return true;
    case 'barnacle_brute':
    case 'great_barnacle': barnacle(ctx, w, h, s, mode); return true;
    case 'lantern_angler': angler(ctx, w, h, s, mode); return true;
    case 'prize_collector': collector(ctx, w, h, s, mode); return true;
    case 'tidecaller': tidecaller(ctx, w, h, s, mode); return true;
    case 'tin_duck': duck(ctx, w, h, s, mode); return true;
  }
  return false;
}

const SKIN = '#8a9a8a';

function drowned(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  for (const side of [-1, 1]) hose(ctx, cx + side * 6, 56, cx + side * 7 + s * side * 6, 72, cx + side * 8, h - 6, 5, SKIN);
  // the striped wool bathing suit
  ellipse(ctx, cx, 46, 14, 17);
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? '#d8cdb0' : '#23304a';
    ctx.fillRect(cx - 16, 28 + i * 4, 32, 4);
  }
  ctx.restore();
  ink(ctx, 3);
  ctx.stroke();
  // arms reaching out ahead
  for (const side of [-1, 1]) hose(ctx, cx + side * 12, 36, cx + side * 20, 34 - (mode === 'windup' ? 8 : 0), cx + side * 24, 40 + s * 3, 4, SKIN);
  const hy = 16;
  ellipse(ctx, cx, hy, 11, 13);
  fillInk(ctx, shade(ctx, cx - 3, hy - 4, 14, '#a8b8a8', '#4a5a52'), 3);
  // the rubber cap
  ctx.beginPath();
  ctx.arc(cx, hy - 2, 11.5, Math.PI, 0);
  fillInk(ctx, '#b0aa9a', 2.4);
  pieEye(ctx, cx - 4, hy + 1, 2.4, 3, 0, 0, { glow: '#d8f0d0' });
  pieEye(ctx, cx + 4, hy + 1, 2.4, 3, 0, 0, { glow: '#d8f0d0' });
  ellipse(ctx, cx, hy + 7, 3, 2.4);
  fillInk(ctx, '#0a0a0a', 1.4);
  // kelp over a shoulder
  ctx.strokeStyle = '#2e3a1e';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx + 8, 30);
  ctx.quadraticCurveTo(cx + 14, 44, cx + 10, 58);
  ctx.stroke();
}

function crab(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2, cy = 30;
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    const x0 = cx + side * 12, y0 = cy + 2 + k * 3;
    hose(ctx, x0, y0, x0 + side * (12 + k), y0 - 6 + s * side * 2, x0 + side * (18 + k * 2), h - 6 - (k % 2) * 2, 2.6, '#6e2a20');
  }
  ellipse(ctx, cx, cy, 20, 12);
  fillInk(ctx, shade(ctx, cx - 6, cy - 5, 22, '#a84a3a', '#3a1614'), 3);
  // bottle caps on the shell
  for (const [x, y, col] of [[-8, -3, '#a82a20'], [6, -5, '#c8a040'], [10, 2, '#2a6a40']] as [number, number, string][]) {
    circle(ctx, cx + x, cy + y, 3);
    fillInk(ctx, col, 1.4);
  }
  // claws up when it's about to dart
  const up = mode === 'windup' ? -10 : 0;
  for (const side of [-1, 1]) {
    hose(ctx, cx + side * 14, cy - 2, cx + side * 22, cy - 10 + up, cx + side * 24, cy - 16 + up, 3.4, '#6e2a20');
    ellipse(ctx, cx + side * 25, cy - 19 + up, side < 0 ? 8 : 6, side < 0 ? 6 : 5);
    fillInk(ctx, '#8a3a2a', 2.4);
  }
  for (const side of [-1, 1]) {
    ink(ctx, 1.6);
    ctx.beginPath();
    ctx.moveTo(cx + side * 4, cy - 10);
    ctx.lineTo(cx + side * 5, cy - 18);
    ctx.stroke();
    circle(ctx, cx + side * 5, cy - 19, 2.4);
    fillInk(ctx, '#d8e04a', 1.2);
  }
}

function usher(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  for (const side of [-1, 1]) hose(ctx, cx + side * 5, 58, cx + side * 6 + s * side * 4, 76, cx + side * 6, h - 6, 4.4, '#1c1618');
  roundRect(ctx, cx - 13, 30, 26, 32, 6);
  fillInk(ctx, shade(ctx, cx - 4, 36, 24, '#8a2a32', '#3a0e12'), 3);
  for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
    circle(ctx, cx + side * 4, 36 + i * 7, 1.4);
    fillInk(ctx, '#d8b04a', 1);
  }
  const punch = mode === 'windup' ? -16 : 0;
  hose(ctx, cx - 12, 34, cx - 20, 46 + punch, cx - 18, 56 + punch * 1.6, 4, '#5a1a22');
  glove(ctx, cx - 18, 58 + punch * 1.6, 4);
  hose(ctx, cx + 12, 34, cx + 18, 46, cx + 16, 56, 4, '#5a1a22');
  glove(ctx, cx + 16, 58, 4);
  const hy = 18;
  ellipse(ctx, cx, hy, 9, 12);
  fillInk(ctx, shade(ctx, cx - 3, hy - 4, 12, '#c8c8b8', '#6a6a60'), 3);
  pieEye(ctx, cx - 3.4, hy - 1, 1.8, 2.2, 0, 0, { glow: '#ff3b2a' });
  pieEye(ctx, cx + 3.4, hy - 1, 1.8, 2.2, 0, 0, { glow: '#ff3b2a' });
  grin(ctx, cx, hy + 5, 12, 2.2, 7, '#3a0b10', 1.4);
  // the pillbox cap
  roundRect(ctx, cx - 8, hy - 18, 16, 8, 2);
  fillInk(ctx, '#7a1a22', 2.4);
  roundRect(ctx, cx - 8, hy - 12, 16, 2, 1);
  fillInk(ctx, '#d8b04a', 1);
}

function taffy(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 30, h - 6);
  ctx.quadraticCurveTo(cx - 32, 26 + s * 2, cx - 8, 14);
  ctx.quadraticCurveTo(cx + 4, 6, cx + 14, 16);
  ctx.quadraticCurveTo(cx + 34, 30 - s * 2, cx + 30, h - 6);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  for (let i = -6; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#e0d2b4' : '#c77a8a';
    ctx.beginPath();
    ctx.moveTo(cx - 40 + i * 9, h);
    ctx.lineTo(cx - 30 + i * 9, h);
    ctx.lineTo(cx - 10 + i * 9, 0);
    ctx.lineTo(cx - 20 + i * 9, 0);
    ctx.fill();
  }
  ctx.restore();
  ink(ctx, 3);
  ctx.stroke();
  // the lashing arm drawn back
  const back = mode === 'windup' ? -10 : 0;
  hose(ctx, cx - 22, 34, cx - 32 + back, 28, cx - 36 + back * 1.4, 36, 5, '#c77a8a');
  pieEye(ctx, cx - 6, 26, 3, 3.4, 0, 0, { glow: '#ff8ab0' });
  pieEye(ctx, cx + 7, 28, 3, 3.4, 0, 0, { glow: '#ff8ab0' });
  grin(ctx, cx, 40, 20, 4, 7, '#2a0a12', 2);
  // the wax-paper twist on top
  ctx.beginPath();
  ctx.moveTo(cx - 6, 8);
  ctx.lineTo(cx + 6, 8);
  ctx.lineTo(cx, 16);
  ctx.closePath();
  fillInk(ctx, '#e8e0c8', 1.6);
}

function automaton(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  for (const side of [-1, 1]) hose(ctx, cx + side * 7, 70, cx + side * 8 + (mode === 'walk' ? Math.sign(s) * side * 3 : 0), 84, cx + side * 8, h - 6, 3.4, '#9a7a3c');
  roundRect(ctx, cx - 17, 10, 34, 62, 4);
  fillInk(ctx, shade(ctx, cx - 6, 24, 34, '#6a3a24', '#2a140c'), 3);
  // the window and the laughing sailor inside
  roundRect(ctx, cx - 12, 18, 24, 22, 2);
  fillInk(ctx, '#2a1020', 2);
  circle(ctx, cx, 28, 6.5);
  fillInk(ctx, '#e0cbb0', 1.8);
  ellipse(ctx, cx, 31, 3, mode === 'windup' ? 2.6 : 1.4);
  fillInk(ctx, '#3a0a0a', 1);
  roundRect(ctx, cx - 5, 20, 10, 3, 1);
  fillInk(ctx, '#e8e4d8', 1);
  // the marquee bulbs and the coin plate
  for (let i = 0; i < 5; i++) {
    circle(ctx, cx - 12 + i * 6, 8, 2);
    fillInk(ctx, i % 2 ? '#ffd27a' : '#ff8a4a', 1);
  }
  roundRect(ctx, cx - 4, 46, 8, 10, 1);
  fillInk(ctx, '#9a7a3c', 1.6);
  // the crank on its side
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(cx + 17, 44);
  ctx.lineTo(cx + 23, 44 + (mode === 'windup' ? -6 : 6));
  ctx.stroke();
}

function wraith(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  // the car
  roundRect(ctx, cx - 26, 52, 52, 26, 8);
  fillInk(ctx, shade(ctx, cx - 8, 58, 30, '#a8282a', '#4a0a0a'), 3);
  roundRect(ctx, cx - 26, 50, 52, 4, 2);
  fillInk(ctx, '#d8b04a', 1.4);
  grin(ctx, cx, 68, 22, 4, 8, '#1a0606', 1.6);
  // the rider: pale, arms up, screaming
  ctx.globalAlpha = 0.9;
  for (const side of [-1, 1]) hose(ctx, cx + side * 6, 38, cx + side * 14, 26 - (mode === 'windup' ? -12 : 0), cx + side * 16, 12 + s * 2, 3, '#d8eef4');
  ellipse(ctx, cx, 42, 9, 12);
  fillInk(ctx, '#d8eef4', 2.4);
  ellipse(ctx, cx, 24, 8, 9);
  fillInk(ctx, shade(ctx, cx - 3, 20, 10, '#ffffff', '#8ab0c0'), 2.4);
  ctx.globalAlpha = 1;
  ellipse(ctx, cx, 28, 3, 4);
  fillInk(ctx, '#0a1418', 1);
  circle(ctx, cx - 3, 22, 1.4);
  fillInk(ctx, '#9ff8ff', 0.8);
  circle(ctx, cx + 3, 22, 1.4);
  fillInk(ctx, '#9ff8ff', 0.8);
}

function barnacle(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  for (const side of [-1, 1]) hose(ctx, cx + side * 9, 64, cx + side * 11 + s * side * 4, 80, cx + side * 11, h - 8, 7, '#6a5a40');
  ellipse(ctx, cx, 50, 24, 22);
  fillInk(ctx, shade(ctx, cx - 8, 42, 28, '#7a8a8a', '#2a3434'), 3);
  // barnacles all over
  for (let i = 0; i < 10; i++) {
    const a = i * 2.39, r = 6 + (i % 4) * 4;
    circle(ctx, cx + Math.cos(a) * r, 50 + Math.sin(a) * r * 0.8, 2.6);
    fillInk(ctx, '#cfc6b0', 1.2);
  }
  const up = mode === 'windup' ? -18 : 0;
  hose(ctx, cx - 22, 40, cx - 32, 52 + up, cx - 30, 64 + up * 1.6, 6, '#4a5a5a');
  hose(ctx, cx + 22, 40, cx + 32, 52 + up, cx + 30, 64 + up * 1.6, 6, '#4a5a5a');
  circle(ctx, cx + 30, 68 + up * 1.6, 9);
  fillInk(ctx, '#b7ae98', 2.4);
  // the brass diving helmet with its green port
  circle(ctx, cx, 20, 14);
  fillInk(ctx, shade(ctx, cx - 5, 15, 16, '#c8a050', '#5a4020'), 3);
  circle(ctx, cx, 21, 6);
  fillInk(ctx, '#2a5a44', 2);
  shine(ctx, cx - 2, 19, 2, 0.7);
}

function angler(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2 - 4;
  ellipse(ctx, cx, 40, 28, 22);
  fillInk(ctx, shade(ctx, cx - 8, 32, 30, '#3a4048', '#0e1014'), 3);
  // the tail
  ctx.beginPath();
  ctx.moveTo(cx + 24, 40);
  ctx.lineTo(cx + 38, 30 + s * 3);
  ctx.lineTo(cx + 38, 50 - s * 3);
  ctx.closePath();
  fillInk(ctx, '#1a1c20', 2.4);
  // the jaw, dropping wide for the bite
  const open = mode === 'windup' ? 8 : 2;
  ctx.beginPath();
  ctx.moveTo(cx - 24, 44);
  ctx.quadraticCurveTo(cx - 14, 58 + open, cx + 4, 50);
  ctx.closePath();
  fillInk(ctx, '#2a0a10', 2);
  ctx.fillStyle = '#e8ecd8';
  for (let i = 0; i < 6; i++) {
    const x = cx - 22 + i * 4.4;
    ctx.beginPath();
    ctx.moveTo(x - 1, 45);
    ctx.lineTo(x, 52 + (i % 2) * 2);
    ctx.lineTo(x + 1, 45);
    ctx.fill();
  }
  circle(ctx, cx - 12, 32, 2.2);
  fillInk(ctx, '#8aa8b0', 1);
  // the stalk and its lantern
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(cx - 6, 20);
  ctx.quadraticCurveTo(cx - 14, 2, cx - 28, 10);
  ctx.stroke();
  circle(ctx, cx - 28, 14, 5);
  fillInk(ctx, '#d8ffc0', 1.6);
  for (const side of [-1, 1]) hose(ctx, cx + side * 14, 56, cx + side * 20, 62, cx + side * 22, h - 6, 3, '#262a30');
}

function collector(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  for (const side of [-1, 1]) hose(ctx, cx + side * 8, 66, cx + side * 9 + s * side * 4, 82, cx + side * 9, h - 6, 6, '#3a2a1e');
  // the sack over the shoulder
  ellipse(ctx, cx + 16, 34, 16, 20);
  fillInk(ctx, shade(ctx, cx + 10, 28, 22, '#a89070', '#5a4a30'), 3);
  // the belly in a check suit
  ellipse(ctx, cx - 2, 52, 22, 22);
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#6a4a2a' : '#8a7a3a';
    ctx.fillRect(cx - 24 + i * 8, 30 + j * 8, 8, 8);
  }
  ctx.restore();
  ink(ctx, 3);
  ctx.stroke();
  const grab = mode === 'windup' ? -12 : 0;
  hose(ctx, cx - 20, 42, cx - 30, 54 + grab, cx - 28, 64 + grab * 1.4, 5, '#6a4a2a');
  glove(ctx, cx - 28, 66 + grab * 1.4, 5, 0, '#c8b8a0');
  const hy = 20;
  ellipse(ctx, cx - 2, hy, 12, 12);
  fillInk(ctx, shade(ctx, cx - 5, hy - 4, 14, '#d8c8a8', '#8a7a60'), 3);
  pieEye(ctx, cx - 6, hy - 1, 1.8, 2, 0, 0);
  pieEye(ctx, cx + 2, hy - 1, 1.8, 2, 0, 0);
  grin(ctx, cx - 2, hy + 6, 14, 2.6, 7, '#2a0a08', 1.6);
  // the green eyeshade
  ellipse(ctx, cx - 2, hy - 9, 13, 3);
  fillInk(ctx, '#5adf8a', 1.6);
}

function tidecaller(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  // the robe of kelp, to the boards
  ctx.beginPath();
  ctx.moveTo(cx - 10, 34);
  ctx.lineTo(cx + 10, 34);
  ctx.lineTo(cx + 20 + s * 2, h - 6);
  ctx.lineTo(cx - 20 + s * 2, h - 6);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx - 4, 50, 40, '#3e4a2a', '#141c14'), 3);
  vstripes(ctx, cx - 16, 70, 32, 26, 'rgba(0,0,0,0)', 'rgba(90,110,60,0.5)', 6);
  // the staff and its bell, raised for the call
  const up = mode === 'windup' ? -14 : 0;
  ink(ctx, 3);
  ctx.strokeStyle = '#8a8070';
  ctx.beginPath();
  ctx.moveTo(cx - 18, h - 6 + up);
  ctx.lineTo(cx - 20, 8 + up);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 26, 14 + up);
  ctx.lineTo(cx - 32, 24 + up);
  ctx.lineTo(cx - 20, 24 + up);
  ctx.closePath();
  fillInk(ctx, '#8a6a3a', 1.6);
  const hy = 24;
  ellipse(ctx, cx, hy, 8, 10);
  fillInk(ctx, shade(ctx, cx - 3, hy - 3, 10, '#a8b8c0', '#4a5a66'), 2.6);
  circle(ctx, cx - 3, hy - 1, 1.6);
  fillInk(ctx, '#7dffd8', 0.8);
  circle(ctx, cx + 3, hy - 1, 1.6);
  fillInk(ctx, '#7dffd8', 0.8);
  // the crown of shells
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 8 + i * 4, hy - 8);
    ctx.lineTo(cx - 6 + i * 4, hy - 16 - (i % 2) * 4);
    ctx.lineTo(cx - 4 + i * 4, hy - 8);
    ctx.closePath();
    fillInk(ctx, i % 2 ? '#e0d8c8' : '#c8a080', 1.2);
  }
}

function duck(ctx: Ctx, w: number, h: number, s: number, _mode: EnemyMode): void {
  const cx = w / 2;
  roundRect(ctx, cx - 12, h - 10, 24, 6, 2);
  fillInk(ctx, '#4a4a4e', 2);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(cx, h - 10);
  ctx.lineTo(cx, h - 18);
  ctx.stroke();
  ellipse(ctx, cx - 2, 30 + s, 18, 12);
  fillInk(ctx, shade(ctx, cx - 6, 26, 18, '#f0c040', '#a07020'), 3);
  circle(ctx, cx + 12, 16 + s, 8);
  fillInk(ctx, shade(ctx, cx + 10, 13, 9, '#f0c040', '#a07020'), 3);
  ctx.beginPath();
  ctx.moveTo(cx + 18, 16 + s);
  ctx.lineTo(cx + 27, 18 + s);
  ctx.lineTo(cx + 18, 20 + s);
  ctx.closePath();
  fillInk(ctx, '#d8602a', 1.6);
  circle(ctx, cx + 13, 14 + s, 1.5);
  fillInk(ctx, '#14100e', 0);
  for (const [r, col] of [[7, '#a8202a'], [4.6, '#e8e0c8'], [2.4, '#a8202a']] as [number, string][]) {
    circle(ctx, cx - 4, 30 + s, r);
    fillInk(ctx, col, 1);
  }
}
