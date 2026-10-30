// The six playable characters (doc 01 §6) — original 1930s rubber-hose designs.
// Each is drawn facing right in an 80×96 unit box, feet at y≈88, with a parametric pose
// (walk phase, idle breathe, hurt recoil) so frames are generated, not hand-placed.

import { INK, PAL, circle, ellipse, fillInk, glove, grin, hose, ink, lighten, pieEye, roundRect, shade, shine, shoe, stripes, type Ctx } from './kit';

export type CharMode = 'idle' | 'walk' | 'hurt';
export const CHAR_W = 80;
export const CHAR_H = 96;

interface Pose {
  sw: number; // leg swing -1..1
  bob: number; // vertical bob
  arm: number; // arm swing
  squash: number;
  hurt: boolean;
}

function pose(phase: number, mode: CharMode): Pose {
  const s = Math.sin(phase * Math.PI * 2);
  if (mode === 'walk') return { sw: s, bob: Math.abs(Math.cos(phase * Math.PI * 2)) * 3, arm: -s, squash: 1 + Math.abs(s) * 0.04, hurt: false };
  if (mode === 'hurt') return { sw: 0.3, bob: -2, arm: 0.9, squash: 0.9, hurt: true };
  return { sw: 0, bob: s * 1.2, arm: s * 0.15, squash: 1 + s * 0.025, hurt: false };
}

function legs(ctx: Ctx, p: Pose, hipY: number, col: string, shoeCol: string, spread = 7, len = 1, shoeR = 6.5): void {
  const fy = 88;
  for (const side of [-1, 1]) {
    const hx = 40 + side * spread * 0.6;
    const fx = 40 + side * spread + p.sw * side * 9 * len;
    const lift = p.sw * side > 0 ? -p.sw * side * 3 : 0;
    hose(ctx, hx, hipY, hx + side * 2 - p.sw * side * 4, (hipY + fy) / 2, fx, fy - 4 + lift, 5.5, col);
    shoe(ctx, fx, fy - 2 + lift, shoeR, shoeCol, 1);
  }
}

function arm(ctx: Ctx, sx: number, sy: number, swing: number, side: number, col: string, gloveCol = '#fffaf0', len = 1, gloveR = 5): { x: number; y: number } {
  const ex = sx + side * 4 + swing * 9 * len;
  const ey = sy + 18 * len - Math.abs(swing) * 3;
  hose(ctx, sx, sy, sx + side * 9, sy + 8 * len, ex, ey, 4.5, col);
  glove(ctx, ex, ey, gloveR, Math.PI / 2 + swing * 0.5, gloveCol);
  return { x: ex, y: ey };
}

function head(ctx: Ctx, x: number, y: number, r: number, skin: string, p: Pose, opts: { eyeY?: number; eyeSep?: number; eyeR?: number; mouth?: 'grin' | 'o' | 'smile' | 'grim'; nose?: string; cheeks?: boolean } = {}): void {
  circle(ctx, x, y, r);
  fillInk(ctx, shade(ctx, x, y, r, lighten(skin, 0.3), skin), 3);
  const ey = y + (opts.eyeY ?? -2);
  const sep = opts.eyeSep ?? r * 0.42;
  const er = opts.eyeR ?? r * 0.3;
  if (p.hurt) {
    pieEye(ctx, x + 2 - sep / 2, ey, er * 0.8, er, 0, 0, { dead: true });
    pieEye(ctx, x + 2 + sep / 2, ey, er * 0.8, er, 0, 0, { dead: true });
  } else {
    pieEye(ctx, x + 2 - sep / 2, ey, er * 0.8, er * 1.15, 0.6, 0.1);
    pieEye(ctx, x + 2 + sep / 2, ey, er * 0.8, er * 1.15, 0.6, 0.1);
  }
  if (opts.cheeks) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ff7a8a';
    circle(ctx, x - r * 0.45, y + r * 0.35, r * 0.18);
    ctx.fill();
    circle(ctx, x + r * 0.62, y + r * 0.35, r * 0.18);
    ctx.fill();
    ctx.restore();
  }
  if (opts.nose) {
    ellipse(ctx, x + r * 0.18, y + r * 0.2, r * 0.16, r * 0.13);
    fillInk(ctx, opts.nose, 2);
  }
  const m = p.hurt ? 'o' : opts.mouth ?? 'smile';
  ink(ctx, 2.2);
  if (m === 'grin') grin(ctx, x + 2, y + r * 0.42, r * 0.95, r * 0.28, 5, '#4a1012', 2);
  else if (m === 'o') {
    ellipse(ctx, x + 3, y + r * 0.5, r * 0.16, r * 0.2);
    fillInk(ctx, '#3a0b10', 2);
  } else if (m === 'grim') {
    ctx.beginPath();
    ctx.moveTo(x - r * 0.25, y + r * 0.52);
    ctx.lineTo(x + r * 0.45, y + r * 0.48);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x + 3, y + r * 0.3, r * 0.35, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
}

export function drawCharacter(ctx: Ctx, id: string, phase: number, mode: CharMode): void {
  const p = pose(phase, mode);
  ctx.save();
  // squash around the feet
  ctx.translate(40, 88);
  ctx.scale(1 / p.squash, p.squash);
  if (p.hurt) ctx.rotate(-0.12);
  ctx.translate(-40, -88 - p.bob);
  switch (id) {
    case 'carny': carny(ctx, p); break;
    case 'strongman': strongman(ctx, p); break;
    case 'fortune_teller': fortune(ctx, p); break;
    case 'ride_operator': rideOp(ctx, p); break;
    case 'lost_child': lostChild(ctx, p); break;
    case 'ringleader': ringleader(ctx, p); break;
    default: carny(ctx, p);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- The Carny
function carny(ctx: Ctx, p: Pose): void {
  legs(ctx, p, 62, '#2a2230', '#3a1d14');
  // back arm
  arm(ctx, 34, 44, p.arm * -1, -1, '#f2e6cc');
  // torso: striped vest over shirt
  ctx.beginPath();
  ctx.moveTo(29, 42);
  ctx.quadraticCurveTo(26, 64, 31, 68);
  ctx.lineTo(50, 68);
  ctx.quadraticCurveTo(55, 62, 51, 42);
  ctx.closePath();
  stripes(ctx, 24, 40, 34, 32, PAL.red, '#f2e6cc', 4, 0);
  ink(ctx, 3);
  ctx.stroke();
  // buttons
  ctx.fillStyle = PAL.gold;
  for (const by of [50, 57, 64]) {
    circle(ctx, 41, by, 1.6);
    fillInk(ctx, PAL.gold, 1.2);
  }
  // bow tie
  ctx.beginPath();
  ctx.moveTo(41, 42);
  ctx.lineTo(35, 38);
  ctx.lineTo(35, 46);
  ctx.closePath();
  ctx.moveTo(41, 42);
  ctx.lineTo(47, 38);
  ctx.lineTo(47, 46);
  ctx.closePath();
  fillInk(ctx, PAL.redDark, 1.8);
  head(ctx, 41, 26, 13, '#f3d7b6', p, { mouth: 'grin', nose: '#e8a48a', cheeks: true });
  // handlebar mustache
  ink(ctx, 1.5);
  ctx.fillStyle = '#4a2a18';
  ctx.beginPath();
  ctx.moveTo(43, 31);
  ctx.quadraticCurveTo(36, 28, 33, 33);
  ctx.quadraticCurveTo(37, 31, 43, 33);
  ctx.quadraticCurveTo(50, 31, 54, 33);
  ctx.quadraticCurveTo(51, 28, 43, 31);
  ctx.fill();
  ctx.stroke();
  // straw boater hat
  ellipse(ctx, 41, 15, 16, 4.5);
  fillInk(ctx, '#e8c873', 2.4);
  roundRect(ctx, 32, 5, 18, 10, 3);
  fillInk(ctx, '#e8c873', 2.4);
  ctx.fillStyle = PAL.red;
  ctx.fillRect(32.5, 10.5, 17, 3.2);
  // front arm holding a fan of cards
  const g = arm(ctx, 47, 45, p.arm, 1, '#f2e6cc');
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(g.x + 3, g.y - 4);
    ctx.rotate(-0.5 + i * 0.35);
    roundRect(ctx, -3, -9, 6.5, 9.5, 1.2);
    fillInk(ctx, '#fffaf0', 1.4);
    ctx.fillStyle = i === 1 ? INK : PAL.red;
    circle(ctx, 0.2, -4.5, 1.4);
    ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- The Strongman
function strongman(ctx: Ctx, p: Pose): void {
  legs(ctx, p, 64, '#3a2a22', '#2a1d16', 9, 0.8, 7.5);
  // back arm (beefy)
  arm(ctx, 26, 42, -p.arm, -1, '#e9b98f', '#fffaf0', 0.95, 6.5);
  // barrel chest in a leopard singlet
  ctx.beginPath();
  ctx.moveTo(22, 40);
  ctx.quadraticCurveTo(14, 58, 27, 69);
  ctx.lineTo(55, 69);
  ctx.quadraticCurveTo(66, 58, 58, 40);
  ctx.quadraticCurveTo(40, 33, 22, 40);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 40, 52, 22, '#f0c98f', '#d29a5c'), 3);
  // singlet
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(24, 50);
  ctx.quadraticCurveTo(18, 62, 27, 69);
  ctx.lineTo(55, 69);
  ctx.quadraticCurveTo(62, 60, 56, 47);
  ctx.lineTo(48, 38);
  ctx.lineTo(44, 40);
  ctx.closePath();
  ctx.fillStyle = '#d98a2c';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#4a2a14';
  const spots: [number, number][] = [[28, 58], [35, 52], [44, 60], [51, 53], [38, 65], [49, 66], [30, 66], [46, 46]];
  for (const [sx, sy] of spots) {
    ellipse(ctx, sx, sy, 2.4, 1.8, 0.4);
    ctx.fill();
  }
  ctx.restore();
  ink(ctx, 2.6);
  ctx.beginPath();
  ctx.moveTo(24, 50);
  ctx.quadraticCurveTo(18, 62, 27, 69);
  ctx.lineTo(55, 69);
  ctx.quadraticCurveTo(62, 60, 56, 47);
  ctx.lineTo(48, 38);
  ctx.lineTo(44, 40);
  ctx.closePath();
  ctx.stroke();
  // belt
  roundRect(ctx, 25, 64, 31, 6, 2);
  fillInk(ctx, '#2a1d16', 2);
  roundRect(ctx, 37, 63, 8, 8, 1.5);
  fillInk(ctx, PAL.gold, 1.8);
  head(ctx, 42, 26, 12, '#e9b98f', p, { mouth: 'grim', eyeR: 3.4 });
  // bald shine + spit curl
  shine(ctx, 37, 18, 3, 0.7);
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.arc(42, 14.5, 2.5, Math.PI * 0.2, Math.PI * 1.7);
  ctx.stroke();
  // curly mustache
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(44, 31);
  ctx.bezierCurveTo(38, 27, 31, 31, 33, 35);
  ctx.bezierCurveTo(35, 31, 40, 32, 44, 33);
  ctx.bezierCurveTo(48, 32, 53, 31, 55, 35);
  ctx.bezierCurveTo(57, 31, 50, 27, 44, 31);
  ctx.fill();
  // front arm, flexing
  hose(ctx, 56, 43, 66, 40, 63, 31 + p.arm * 3, 7, '#e9b98f');
  circle(ctx, 61, 38, 5.5);
  fillInk(ctx, '#e9b98f', 2.4);
  glove(ctx, 63, 29 + p.arm * 3, 6, -Math.PI / 2, '#fffaf0', true);
}

// ---------------------------------------------------------------- The Fortune Teller
function fortune(ctx: Ctx, p: Pose): void {
  // long robe hides the legs: shoes peek out
  for (const side of [-1, 1]) shoe(ctx, 40 + side * 7 + p.sw * side * 6, 86, 5.5, '#2a1240', 1);
  ctx.beginPath();
  ctx.moveTo(30, 40);
  ctx.quadraticCurveTo(20, 70, 22 + p.sw * 2, 86);
  ctx.quadraticCurveTo(40, 90, 58 - p.sw * 2, 86);
  ctx.quadraticCurveTo(60, 70, 50, 40);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 40, 60, 30, '#8a4ac0', '#4a1f76'), 3);
  // stars on robe
  ctx.fillStyle = PAL.gold;
  for (const [sx, sy] of [[31, 60], [46, 54], [37, 74], [50, 76], [28, 79]] as [number, number][]) star(ctx, sx, sy, 2.4);
  // sash
  ctx.beginPath();
  ctx.moveTo(31, 52);
  ctx.quadraticCurveTo(40, 58, 51, 50);
  ink(ctx, 5);
  ctx.strokeStyle = PAL.gold;
  ctx.stroke();
  head(ctx, 41, 27, 12, '#e7c2a0', p, { mouth: 'smile', eyeR: 3.6 });
  // heavy lashes
  ink(ctx, 1.4);
  for (const ex of [36, 47]) {
    ctx.beginPath();
    ctx.moveTo(ex - 3, 21);
    ctx.lineTo(ex - 4, 18.5);
    ctx.moveTo(ex, 20.5);
    ctx.lineTo(ex, 17.5);
    ctx.moveTo(ex + 3, 21);
    ctx.lineTo(ex + 4, 18.5);
    ctx.stroke();
  }
  // headscarf with coins
  ctx.beginPath();
  ctx.moveTo(27, 26);
  ctx.quadraticCurveTo(27, 10, 42, 11);
  ctx.quadraticCurveTo(56, 11, 55, 24);
  ctx.quadraticCurveTo(48, 18, 41, 19);
  ctx.quadraticCurveTo(33, 19, 27, 26);
  ctx.closePath();
  fillInk(ctx, '#c8322d', 2.4);
  for (let i = 0; i < 6; i++) {
    circle(ctx, 30 + i * 4.6, 20 + Math.sin(i) * 0.6, 1.5);
    fillInk(ctx, PAL.gold, 1);
  }
  // hoop earring
  ink(ctx, 1.6);
  ctx.strokeStyle = PAL.gold;
  ctx.beginPath();
  ctx.arc(31, 33, 2.8, 0, Math.PI * 2);
  ctx.stroke();
  // arms cradling a glowing crystal ball
  hose(ctx, 33, 44, 30, 54, 37, 58, 4.5, '#8a4ac0');
  hose(ctx, 49, 44, 54, 52, 47, 58, 4.5, '#8a4ac0');
  const g = ctx.createRadialGradient(42, 56, 1, 42, 56, 12);
  g.addColorStop(0, 'rgba(160,240,255,0.9)');
  g.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = g;
  circle(ctx, 42, 56, 12);
  ctx.fill();
  circle(ctx, 42, 56, 6.5);
  fillInk(ctx, shade(ctx, 42, 56, 6.5, '#e8fbff', '#5fb8e8'), 2);
  shine(ctx, 40, 54, 1.6, 0.9);
  glove(ctx, 36, 59, 4, 0.2);
  glove(ctx, 48, 59, 4, Math.PI - 0.2);
}

function star(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------- The Ride Operator
function rideOp(ctx: Ctx, p: Pose): void {
  legs(ctx, p, 62, '#2f5f8f', '#2a1d16');
  arm(ctx, 33, 44, -p.arm, -1, '#2f5f8f');
  // overalls
  roundRect(ctx, 29, 40, 23, 29, 6);
  fillInk(ctx, shade(ctx, 40, 52, 18, '#4f8fc8', '#2a5a8f'), 3);
  // bib + straps
  roundRect(ctx, 33, 44, 15, 12, 3);
  fillInk(ctx, '#3a74b0', 2);
  ctx.fillStyle = PAL.gold;
  circle(ctx, 34.5, 45, 1.5);
  ctx.fill();
  circle(ctx, 46.5, 45, 1.5);
  ctx.fill();
  // pocket wrench
  ink(ctx, 2.2);
  ctx.strokeStyle = '#a9b2b8';
  ctx.beginPath();
  ctx.moveTo(44, 47);
  ctx.lineTo(48, 41);
  ctx.stroke();
  head(ctx, 41, 26, 12.5, '#d9a77e', p, { mouth: 'grin', cheeks: true });
  // cap with goggles
  ctx.beginPath();
  ctx.moveTo(28, 22);
  ctx.quadraticCurveTo(29, 10, 42, 10);
  ctx.quadraticCurveTo(54, 10, 54, 21);
  ctx.closePath();
  fillInk(ctx, PAL.yellow, 2.4);
  ellipse(ctx, 56, 21, 7, 2.5);
  fillInk(ctx, PAL.yellow, 2);
  for (const gx of [36, 46]) {
    circle(ctx, gx, 15, 3.6);
    fillInk(ctx, '#bfe8ff', 2);
    shine(ctx, gx - 1, 14, 1, 0.8);
  }
  // front arm holds a lever with a spark
  const g = arm(ctx, 48, 45, p.arm, 1, '#2f5f8f');
  ink(ctx, 3);
  ctx.strokeStyle = '#7a7480';
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + 6, g.y - 13);
  ctx.stroke();
  circle(ctx, g.x + 6, g.y - 14, 3);
  fillInk(ctx, PAL.red, 1.6);
  ctx.strokeStyle = '#fff36a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(g.x + 9, g.y - 17);
  ctx.lineTo(g.x + 12, g.y - 15);
  ctx.lineTo(g.x + 11, g.y - 20);
  ctx.lineTo(g.x + 15, g.y - 19);
  ctx.stroke();
}

// ---------------------------------------------------------------- The Lost Child
function lostChild(ctx: Ctx, p: Pose): void {
  // smaller: draw scaled around feet
  ctx.save();
  ctx.translate(40, 88);
  ctx.scale(0.86, 0.86);
  ctx.translate(-40, -88);
  legs(ctx, p, 66, '#f6dcc4', '#c8322d', 6, 0.8, 6);
  // socks
  arm(ctx, 34, 50, -p.arm, -1, '#7ec8e3');
  // striped shirt + pinafore
  ctx.beginPath();
  ctx.moveTo(31, 47);
  ctx.lineTo(27, 70);
  ctx.quadraticCurveTo(40, 74, 53, 70);
  ctx.lineTo(49, 47);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 40, 58, 18, '#f8b5cf', '#d9729d'), 3);
  roundRect(ctx, 33, 47, 14, 9, 3);
  stripes(ctx, 33, 47, 14, 9, '#7ec8e3', '#fffaf0', 2.2, 0);
  ink(ctx, 2);
  roundRect(ctx, 33, 47, 14, 9, 3);
  ctx.stroke();
  // big head, big eyes
  circle(ctx, 41, 30, 15);
  fillInk(ctx, shade(ctx, 41, 30, 15, '#fff0e0', '#f0c8a8'), 3);
  if (p.hurt) {
    pieEye(ctx, 36, 29, 3.6, 4.4, 0, 0, { dead: true });
    pieEye(ctx, 47, 29, 3.6, 4.4, 0, 0, { dead: true });
  } else {
    pieEye(ctx, 36, 29, 4, 5.4, 0.4, 0.2);
    pieEye(ctx, 47, 29, 4, 5.4, 0.4, 0.2);
  }
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ff7a8a';
  circle(ctx, 31, 36, 2.6);
  ctx.fill();
  circle(ctx, 52, 36, 2.6);
  ctx.fill();
  ctx.restore();
  ink(ctx, 1.8);
  ctx.beginPath();
  if (p.hurt) ctx.arc(42, 41, 2.4, Math.PI + 0.3, -0.3);
  else ctx.arc(42, 36.5, 3, 0.4, Math.PI - 0.4);
  ctx.stroke();
  // hair bow + pigtails
  for (const side of [-1, 1]) {
    ellipse(ctx, 41 + side * 15, 24, 4, 6, side * 0.3);
    fillInk(ctx, '#7a4a2a', 2);
  }
  ctx.beginPath();
  ctx.moveTo(41, 16);
  ctx.lineTo(33, 11);
  ctx.lineTo(33, 20);
  ctx.closePath();
  ctx.moveTo(41, 16);
  ctx.lineTo(49, 11);
  ctx.lineTo(49, 20);
  ctx.closePath();
  fillInk(ctx, PAL.red, 1.8);
  // front arm clutching a little teddy
  arm(ctx, 48, 51, p.arm * 0.3, 1, '#7ec8e3', '#fffaf0', 0.7, 4);
  circle(ctx, 52, 62, 5.5);
  fillInk(ctx, '#b07a4a', 2);
  circle(ctx, 49, 57, 2);
  fillInk(ctx, '#b07a4a', 1.4);
  circle(ctx, 55, 57, 2);
  fillInk(ctx, '#b07a4a', 1.4);
  ctx.fillStyle = INK;
  circle(ctx, 51, 61, 0.8);
  ctx.fill();
  circle(ctx, 53.5, 61, 0.8);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- The Ringleader
function ringleader(ctx: Ctx, p: Pose): void {
  legs(ctx, p, 62, '#f2e6cc', '#1a1418');
  arm(ctx, 33, 44, -p.arm, -1, PAL.red);
  // tailcoat with tails
  ctx.beginPath();
  ctx.moveTo(29, 41);
  ctx.quadraticCurveTo(24, 62, 22 - p.sw * 2, 74);
  ctx.lineTo(32, 70);
  ctx.lineTo(48, 70);
  ctx.lineTo(58 - p.sw * 2, 74);
  ctx.quadraticCurveTo(56, 60, 51, 41);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 40, 54, 24, '#d0384a', '#7a121e'), 3);
  // shirt front + gold buttons
  ctx.beginPath();
  ctx.moveTo(36, 41);
  ctx.lineTo(40, 62);
  ctx.lineTo(44, 41);
  ctx.closePath();
  fillInk(ctx, '#fffaf0', 2);
  for (const by of [47, 54, 61]) {
    circle(ctx, 34, by, 1.4);
    fillInk(ctx, PAL.gold, 1);
    circle(ctx, 46, by, 1.4);
    fillInk(ctx, PAL.gold, 1);
  }
  // epaulettes
  for (const ex of [29, 51]) {
    ellipse(ctx, ex, 42, 5, 2.4);
    fillInk(ctx, PAL.gold, 1.6);
  }
  head(ctx, 41, 26, 12, '#ecc7a5', p, { mouth: 'smile', eyeR: 3.4 });
  // thin mustache
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(37, 31);
  ctx.quadraticCurveTo(42, 29.5, 49, 31);
  ctx.stroke();
  // top hat
  ellipse(ctx, 41, 15, 13, 3.6);
  fillInk(ctx, '#1a1418', 2.4);
  roundRect(ctx, 33, -1, 16, 16, 2);
  fillInk(ctx, '#1a1418', 2.4);
  ctx.fillStyle = PAL.red;
  ctx.fillRect(33.5, 9.5, 15, 3);
  shine(ctx, 36, 3, 1.6, 0.4);
  // front arm with a baton
  const g = arm(ctx, 48, 45, p.arm, 1, PAL.red);
  ink(ctx, 3);
  ctx.strokeStyle = '#fffaf0';
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + 10, g.y - 14);
  ctx.stroke();
  ink(ctx, 1);
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + 10, g.y - 14);
  ctx.stroke();
  circle(ctx, g.x + 10, g.y - 14, 2);
  fillInk(ctx, PAL.gold, 1.2);
}

/** Lost Child's shield balloon (drawn separately so its state can toggle). */
export function drawShieldBalloon(ctx: Ctx, w: number, h: number): void {
  const x = w / 2, y = h * 0.35;
  ink(ctx, 1.2);
  ctx.beginPath();
  ctx.moveTo(x, y + 14);
  ctx.quadraticCurveTo(x - 4, y + 26, x + 2, h - 2);
  ctx.stroke();
  ellipse(ctx, x, y, 10, 12.5);
  fillInk(ctx, shade(ctx, x, y, 12, '#ffd0e0', '#ff5f9f'), 2.4);
  ctx.beginPath();
  ctx.moveTo(x - 2.5, y + 12);
  ctx.lineTo(x + 2.5, y + 12);
  ctx.lineTo(x, y + 15);
  ctx.closePath();
  fillInk(ctx, '#ff5f9f', 1.5);
  shine(ctx, x - 4, y - 5, 2.4, 0.9);
}
