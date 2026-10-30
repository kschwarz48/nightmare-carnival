// Enemy roster artwork (doc 04) — personified carnival attractions in rubber-hose style.
// Each design has a unique silhouette and one readable "tell" (the wind-up pose).
// drawEnemy paints a frame facing right; `phase` animates the walk cycle (0..1).

import { DANGER, INK, PAL, circle, ellipse, fillInk, glove, grin, hose, ink, lighten, pieEye, roundRect, shade, shine, shoe, stripes, vstripes, type Ctx } from './kit';

export type EnemyMode = 'walk' | 'windup' | 'alt';

/** Frame box (world units) + anchor for each enemy art key. */
export const ENEMY_ART: Record<string, { w: number; h: number; ay: number }> = {
  living_balloon: { w: 54, h: 72, ay: 0.93 },
  swarm_balloon: { w: 50, h: 66, ay: 0.93 },
  wind_up_monkey: { w: 62, h: 64, ay: 0.92 },
  possessed_stuffie: { w: 66, h: 68, ay: 0.92 },
  mini_stuffie: { w: 66, h: 68, ay: 0.92 },
  cotton_candy_slime: { w: 70, h: 60, ay: 0.9 },
  whack_a_mole: { w: 58, h: 64, ay: 0.9 },
  evil_clown: { w: 64, h: 86, ay: 0.93 },
  jack_in_the_box: { w: 56, h: 86, ay: 0.93 },
  dunk_tank_clown: { w: 74, h: 80, ay: 0.92 },
  puppet_soldier: { w: 54, h: 82, ay: 0.93 },
  carousel_horse: { w: 92, h: 84, ay: 0.9 },
  bumper_car: { w: 82, h: 66, ay: 0.88 },
  walking_ticket_booth: { w: 86, h: 116, ay: 0.94 },
  roller_coaster_snake: { w: 70, h: 58, ay: 0.7 },
  carnival_brute: { w: 116, h: 124, ay: 0.93 },
};

export function drawEnemy(ctx: Ctx, id: string, w: number, h: number, phase: number, mode: EnemyMode): void {
  const s = Math.sin(phase * Math.PI * 2);
  const c = Math.cos(phase * Math.PI * 2);
  switch (id) {
    case 'living_balloon': return balloon(ctx, w, h, s, mode, '#e8384f', '#ff8a9a');
    case 'swarm_balloon': return balloon(ctx, w, h, s, mode, '#d42a8a', '#ff86c8');
    case 'wind_up_monkey': return monkey(ctx, w, h, s, c, mode);
    case 'possessed_stuffie':
    case 'mini_stuffie': return stuffie(ctx, w, h, s, mode, id === 'mini_stuffie');
    case 'cotton_candy_slime': return slime(ctx, w, h, s, mode);
    case 'whack_a_mole': return mole(ctx, w, h, s, mode);
    case 'evil_clown': return clown(ctx, w, h, s, c, mode);
    case 'jack_in_the_box': return jack(ctx, w, h, s, mode);
    case 'dunk_tank_clown': return dunkTank(ctx, w, h, s, mode);
    case 'puppet_soldier': return puppet(ctx, w, h, s, mode);
    case 'carousel_horse': return horse(ctx, w, h, s, c, mode);
    case 'bumper_car': return bumperCar(ctx, w, h, s, mode);
    case 'walking_ticket_booth': return booth(ctx, w, h, s, mode);
    case 'roller_coaster_snake': return snakeHead(ctx, w, h, s, mode);
    case 'carnival_brute': return brute(ctx, w, h, s, c, mode);
  }
}

// ---------------------------------------------------------------- Living Balloon
function balloon(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode, col: string, light: string): void {
  const cx = w / 2, cy = 27 + s * 1.5;
  // string legs
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy + 20);
  ctx.quadraticCurveTo(cx - 8 + s * 4, cy + 32, cx - 6 + s * 5, h - 4);
  ctx.moveTo(cx + 3, cy + 20);
  ctx.quadraticCurveTo(cx + 8 - s * 4, cy + 32, cx + 6 - s * 5, h - 4);
  ctx.stroke();
  // body
  ctx.beginPath();
  ctx.moveTo(cx, cy + 21);
  ctx.bezierCurveTo(cx - 25, cy + 12, cx - 22, cy - 24, cx, cy - 22);
  ctx.bezierCurveTo(cx + 22, cy - 24, cx + 25, cy + 12, cx, cy + 21);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx, cy, 22, light, col), 3);
  shine(ctx, cx - 8, cy - 11, 4.2);
  // gnashing knot-mouth
  const open = mode === 'windup' ? 1 : 0.5 + 0.5 * Math.abs(s);
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + 18);
  ctx.lineTo(cx + 5, cy + 18);
  ctx.lineTo(cx + 3, cy + 22 + open * 3);
  ctx.lineTo(cx - 3, cy + 22 + open * 3);
  ctx.closePath();
  fillInk(ctx, lighten(col, -0.3), 2);
  ctx.fillStyle = '#fff6dc';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 3 - 1.2, cy + 18.5);
    ctx.lineTo(cx + i * 3 + 1.2, cy + 18.5);
    ctx.lineTo(cx + i * 3, cy + 20.5 + open);
    ctx.fill();
  }
  // pie eyes + angry brows
  pieEye(ctx, cx - 6, cy - 2, 4.6, 6, 0.5, 0.3, { lid: 0.55, lidSide: 1 });
  pieEye(ctx, cx + 7, cy - 2, 4.6, 6, 0.5, 0.3, { lid: 0.55, lidSide: -1 });
  // grin
  ink(ctx, 2);
  ctx.beginPath();
  ctx.arc(cx + 1, cy + 6, 7, 0.25, Math.PI - 0.25);
  ctx.stroke();
}

// ---------------------------------------------------------------- Wind-Up Monkey
function monkey(ctx: Ctx, w: number, h: number, s: number, c: number, mode: EnemyMode): void {
  const cx = w / 2 - 2, by = 40 + Math.abs(s) * -2;
  const wind = mode === 'windup';
  // legs
  for (const side of [-1, 1]) {
    hose(ctx, cx + side * 5, by + 10, cx + side * 8, by + 16, cx + side * 8 + s * side * 6, h - 7, 4.5, '#8a5a2a');
    shoe(ctx, cx + side * 8 + s * side * 6, h - 5, 4.8, '#3a1d14');
  }
  // winding key on the back
  ctx.save();
  ctx.translate(cx - 15, by - 2);
  ctx.rotate(wind ? s * 3 : s * 0.5);
  ink(ctx, 2.2);
  ctx.strokeStyle = PAL.brass;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-7, 0);
  ctx.stroke();
  for (const sy of [-1, 1]) {
    ellipse(ctx, -9, sy * 4, 3.4, 4.5);
    fillInk(ctx, PAL.brass, 1.8);
  }
  ctx.restore();
  // tin body (vest)
  ellipse(ctx, cx, by, 13, 14);
  fillInk(ctx, shade(ctx, cx, by, 14, '#e44a3a', '#9a2218'), 3);
  ctx.fillStyle = PAL.gold;
  for (const yy of [-5, 2, 9]) {
    circle(ctx, cx + 3, by + yy, 1.4);
    ctx.fill();
  }
  // cymbal arms: clashing in windup
  const spread = wind ? 2 + Math.abs(s) * 3 : 13 + c * 3;
  for (const side of [-1, 1]) {
    const hx = cx + side * spread + 6, hy = by - 6;
    hose(ctx, cx + side * 9, by - 4, cx + side * 12, by - 12, hx, hy, 4, '#8a5a2a');
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(side * 1.3);
    ellipse(ctx, 0, 0, 9, 3);
    fillInk(ctx, shade(ctx, 0, 0, 9, '#fff2a8', PAL.brass), 2);
    ctx.restore();
  }
  // head
  const hy = by - 17;
  circle(ctx, cx + 2, hy, 11);
  fillInk(ctx, shade(ctx, cx + 2, hy, 11, '#b07a4a', '#6a4020'), 3);
  for (const side of [-1, 1]) {
    circle(ctx, cx + 2 + side * 11, hy - 1, 4);
    fillInk(ctx, '#e8b88a', 2);
  }
  ellipse(ctx, cx + 4, hy + 3, 7.5, 6);
  fillInk(ctx, '#f0c8a0', 2);
  const er = wind ? 4.2 : 3.2;
  pieEye(ctx, cx - 1, hy - 3, er * 0.85, er, 0.6, 0, { glow: wind ? '#fff36a' : undefined });
  pieEye(ctx, cx + 7, hy - 3, er * 0.85, er, 0.6, 0, { glow: wind ? '#fff36a' : undefined });
  grin(ctx, cx + 4, hy + 4, 9, 2.5, 4, '#4a1012', 1.6);
  // fez
  roundRect(ctx, cx - 3, hy - 16, 10, 7, 1.5);
  fillInk(ctx, PAL.red, 2);
}

// ---------------------------------------------------------------- Possessed Stuffie
function stuffie(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode, mini: boolean): void {
  const cx = w / 2, by = 44 + Math.abs(s) * 2;
  const col = mini ? '#9a7ac0' : '#8a6ab8';
  for (const side of [-1, 1]) {
    ellipse(ctx, cx + side * 9 + s * side * 4, h - 9, 7, 6);
    fillInk(ctx, shade(ctx, cx + side * 9, h - 9, 7, lighten(col, 0.3), col), 2.6);
  }
  // lumpy body
  ctx.beginPath();
  ctx.moveTo(cx - 17, by + 10);
  ctx.bezierCurveTo(cx - 22, by - 8, cx - 12, by - 16, cx, by - 15);
  ctx.bezierCurveTo(cx + 14, by - 16, cx + 22, by - 6, cx + 17, by + 10);
  ctx.bezierCurveTo(cx + 10, by + 17, cx - 10, by + 17, cx - 17, by + 10);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx, by, 18, lighten(col, 0.35), col), 3);
  // stitches + leaking stuffing
  ink(ctx, 1.3);
  ctx.beginPath();
  ctx.moveTo(cx, by - 12);
  ctx.lineTo(cx, by + 12);
  for (let y = by - 10; y < by + 12; y += 4) {
    ctx.moveTo(cx - 2.5, y);
    ctx.lineTo(cx + 2.5, y + 1.5);
  }
  ctx.stroke();
  ctx.fillStyle = '#fffaf0';
  circle(ctx, cx + 11, by + 5, 3);
  ctx.fill();
  circle(ctx, cx + 13.5, by + 3, 2.2);
  ctx.fill();
  // stubby arms swiping
  const swipe = mode === 'windup' ? -0.9 : s * 0.4;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 16, by - 4);
    ctx.rotate(side * (0.6 + swipe * side));
    ellipse(ctx, side * 5, 3, 6, 8);
    fillInk(ctx, col, 2.4);
    ctx.restore();
  }
  // head with ears
  const hy = by - 24;
  for (const side of [-1, 1]) {
    circle(ctx, cx + side * 11, hy - 9, 6);
    fillInk(ctx, col, 2.6);
    circle(ctx, cx + side * 11, hy - 9, 3);
    ctx.fillStyle = '#e8a0c0';
    ctx.fill();
  }
  circle(ctx, cx, hy, 14);
  fillInk(ctx, shade(ctx, cx, hy, 14, lighten(col, 0.35), col), 3);
  // button eyes: one hanging by a thread
  circle(ctx, cx - 6, hy - 2, 3.6);
  fillInk(ctx, '#1a1418', 1.6);
  ctx.fillStyle = '#fffaf0';
  circle(ctx, cx - 7, hy - 3, 0.9);
  ctx.fill();
  ink(ctx, 1);
  ctx.beginPath();
  ctx.moveTo(cx + 6, hy - 3);
  ctx.quadraticCurveTo(cx + 8, hy + 3, cx + 7, hy + 6);
  ctx.stroke();
  circle(ctx, cx + 7, hy + 7, 3.2);
  fillInk(ctx, mode === 'windup' ? DANGER : '#1a1418', 1.6);
  // stitched grin
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(cx - 7, hy + 6);
  ctx.quadraticCurveTo(cx, hy + 11, cx + 3, hy + 6);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const x = cx - 6 + i * 3;
    ctx.beginPath();
    ctx.moveTo(x, hy + 6.5);
    ctx.lineTo(x, hy + 10);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- Cotton-Candy Slime
function slime(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2, by = h - 18;
  // paper cone stuck in it
  ctx.save();
  ctx.translate(cx + 14, by - 18);
  ctx.rotate(0.6);
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.lineTo(0, 18);
  ctx.closePath();
  stripes(ctx, -6, 0, 12, 18, '#f7eedb', '#4fb8e0', 2.5, 0.3);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.lineTo(0, 18);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  // fluffy blob body with oozing base
  const sq = 1 + s * 0.06;
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(sq, 1 / sq);
  ctx.beginPath();
  const puffs: [number, number, number][] = [[-18, -4, 11], [-8, -16, 13], [7, -18, 12], [18, -6, 11], [12, 4, 10], [-12, 4, 10], [0, 0, 14]];
  for (const [px, py, pr] of puffs) {
    ctx.moveTo(px + pr, py);
    ctx.arc(px, py, pr, 0, Math.PI * 2);
  }
  ctx.fillStyle = shade(ctx, 0, -6, 24, '#ffd6ec', '#ff7ab8');
  ctx.fill();
  ink(ctx, 2.6);
  ctx.stroke();
  ctx.fillStyle = shade(ctx, 0, -6, 24, '#ffd6ec', '#ff7ab8');
  for (const [px, py, pr] of puffs) {
    circle(ctx, px, py, pr - 2.4);
    ctx.fill();
  }
  // drips
  ctx.fillStyle = '#ff7ab8';
  for (const dx of [-14, 2, 15]) {
    ellipse(ctx, dx, 10 + Math.abs(s) * 2, 3, 5);
    ctx.fill();
  }
  shine(ctx, -9, -18, 3.5, 0.8);
  const wide = mode === 'windup' ? 1.3 : 1;
  pieEye(ctx, -6, -8, 3.8 * wide, 4.8 * wide, 0.4, 0.2);
  pieEye(ctx, 6, -9, 3.8 * wide, 4.8 * wide, 0.4, 0.2);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(-7, 1);
  ctx.quadraticCurveTo(0, 7 + s, 8, 1);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- Whack-a-Mole
function mole(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  if (mode === 'alt') {
    // travelling dirt mound (burrowed telegraph)
    ellipse(ctx, cx, h - 12, 22, 9);
    fillInk(ctx, shade(ctx, cx, h - 14, 20, '#9a7048', '#5a3a20'), 2.6);
    ctx.fillStyle = '#4a2e18';
    for (const [x, y] of [[-10, -2], [4, -5], [12, 0], [-3, 1]] as [number, number][]) {
      circle(ctx, cx + x, h - 12 + y, 2);
      ctx.fill();
    }
    return;
  }
  // the hole
  ellipse(ctx, cx, h - 10, 24, 9);
  fillInk(ctx, '#2a1810', 2.6);
  // body popping up
  const up = mode === 'windup' ? 0.6 : 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h - 10);
  ellipse(ctx, cx, h - 10, 24, 9);
  ctx.clip();
  const by = h - 26 + (1 - up) * 22 + s * 1.5;
  ellipse(ctx, cx, by, 16, 20);
  fillInk(ctx, shade(ctx, cx, by, 20, '#a8784a', '#6a4424'), 3);
  ellipse(ctx, cx, by + 6, 9, 10);
  fillInk(ctx, '#e8c098', 2);
  // glove paws holding the hole edge
  glove(ctx, cx - 15, by + 6, 4.5, Math.PI * 0.85);
  glove(ctx, cx + 15, by + 6, 4.5, Math.PI * 0.15);
  // face
  pieEye(ctx, cx - 5, by - 9, 3.4, 4.4, 0.3, 0.2);
  pieEye(ctx, cx + 6, by - 9, 3.4, 4.4, 0.3, 0.2);
  ellipse(ctx, cx + 1, by - 2, 4.5, 3.4);
  fillInk(ctx, '#e86a7a', 1.8);
  grin(ctx, cx + 1, by + 2, 12, 3, 2, '#4a1012', 1.6);
  // hard hat
  ctx.beginPath();
  ctx.arc(cx, by - 14, 12, Math.PI, 0);
  ctx.closePath();
  fillInk(ctx, PAL.yellow, 2.2);
  ctx.restore();
  ink(ctx, 2.6);
  ctx.beginPath();
  ctx.ellipse(cx, h - 10, 24, 9, 0, 0, Math.PI);
  ctx.stroke();
}

// ---------------------------------------------------------------- Evil Clown
function clown(ctx: Ctx, w: number, h: number, s: number, c: number, mode: EnemyMode): void {
  const cx = w / 2;
  const lurch = mode === 'windup' ? 0.25 : s * 0.12;
  ctx.save();
  ctx.translate(cx, h - 6);
  ctx.rotate(lurch);
  ctx.translate(-cx, -(h - 6));
  // lanky legs + giant shoes
  for (const side of [-1, 1]) {
    const fx = cx + side * 6 + s * side * 11;
    hose(ctx, cx + side * 4, 50, cx + side * 8, 62, fx, h - 10, 4.5, side < 0 ? '#3a8ad0' : PAL.yellow);
    shoe(ctx, fx, h - 7, 8.5, PAL.red);
  }
  // baggy polka-dot suit
  ctx.beginPath();
  ctx.moveTo(cx - 13, 30);
  ctx.quadraticCurveTo(cx - 19, 46, cx - 12, 54);
  ctx.lineTo(cx + 12, 54);
  ctx.quadraticCurveTo(cx + 19, 46, cx + 13, 30);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#f0ece0';
  ctx.fillRect(cx - 20, 28, 40, 28);
  ctx.fillStyle = PAL.red;
  for (const [x, y] of [[-8, 36], [4, 34], [-2, 44], [9, 45], [-10, 50], [3, 52]] as [number, number][]) {
    circle(ctx, cx + x, y, 2.6);
    ctx.fill();
  }
  ctx.restore();
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(cx - 13, 30);
  ctx.quadraticCurveTo(cx - 19, 46, cx - 12, 54);
  ctx.lineTo(cx + 12, 54);
  ctx.quadraticCurveTo(cx + 19, 46, cx + 13, 30);
  ctx.closePath();
  ctx.stroke();
  // ruffle collar
  for (let i = 0; i < 7; i++) {
    circle(ctx, cx - 12 + i * 4, 30, 3.4);
    fillInk(ctx, i % 2 ? '#7ec8e3' : '#fffaf0', 1.6);
  }
  // swinging arms
  for (const side of [-1, 1]) {
    const sw = side * c * 8;
    hose(ctx, cx + side * 11, 34, cx + side * 18, 40, cx + side * 16 + sw, 50, 4, '#f0ece0');
    glove(ctx, cx + side * 16 + sw, 52, 4.5, Math.PI / 2);
  }
  // head: frizz hair, too-wide grin, rolling eyes
  const hy = 18;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      circle(ctx, cx + side * (12 + k * 2), hy - 4 + k * 4, 5);
      fillInk(ctx, '#ff6a2a', 2);
    }
  }
  circle(ctx, cx, hy, 12);
  fillInk(ctx, shade(ctx, cx, hy, 12, '#ffffff', '#e8e2d8'), 3);
  const roll = mode === 'windup' ? -1 : s;
  pieEye(ctx, cx - 5, hy - 3, 3.6, 4.6, roll, -0.6, { glow: mode === 'windup' ? '#ffe3a0' : undefined });
  pieEye(ctx, cx + 5, hy - 3, 3.6, 4.6, -roll, 0.6, { glow: mode === 'windup' ? '#ffe3a0' : undefined });
  grin(ctx, cx, hy + 4, 20, 3.4, 7, '#7a0f18', 1.8);
  circle(ctx, cx + 1, hy + 1.5, 3.4);
  fillInk(ctx, shade(ctx, cx + 1, hy + 1.5, 3.4, '#ff8a8a', PAL.red), 1.8);
  // tiny hat
  roundRect(ctx, cx - 3, hy - 19, 9, 8, 1.5);
  fillInk(ctx, '#2a2230', 2);
  ctx.restore();
}

// ---------------------------------------------------------------- Jack-in-the-Box
function jack(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2, by = h - 6;
  const open = mode === 'alt';
  const jit = mode === 'windup' ? s * 1.5 : 0;
  if (open) {
    // spring + clown head bursting out
    ink(ctx, 2.2);
    ctx.strokeStyle = '#c0c8cc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const y = by - 34 - i * 2.6;
      ctx.lineTo(cx + (i % 2 ? 7 : -7), y);
    }
    ctx.stroke();
    const hy = by - 66;
    circle(ctx, cx, hy, 12);
    fillInk(ctx, '#fffaf0', 2.6);
    pieEye(ctx, cx - 5, hy - 3, 3.4, 4.2, 0.5, 0.4, { lid: 0.5, lidSide: 1 });
    pieEye(ctx, cx + 5, hy - 3, 3.4, 4.2, -0.5, 0.4, { lid: 0.5, lidSide: -1 });
    grin(ctx, cx, hy + 4, 16, 3.5, 6, '#7a0f18', 1.6);
    // jester hat
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, hy - 10);
      ctx.quadraticCurveTo(cx + side * 10, hy - 22, cx + side * 17, hy - 12);
      ctx.lineTo(cx + side * 6, hy - 6);
      ctx.closePath();
      fillInk(ctx, side < 0 ? PAL.red : PAL.yellow, 2);
      circle(ctx, cx + side * 17, hy - 12, 2.5);
      fillInk(ctx, PAL.gold, 1.4);
    }
  }
  // the box
  ctx.save();
  ctx.translate(jit, 0);
  roundRect(ctx, cx - 17, by - 34, 34, 34, 3);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#e8384f';
  ctx.fillRect(cx - 17, by - 34, 34, 34);
  ctx.fillStyle = PAL.yellow;
  ctx.beginPath();
  ctx.moveTo(cx - 17, by - 34);
  ctx.lineTo(cx + 17, by);
  ctx.lineTo(cx + 17, by - 10);
  ctx.lineTo(cx - 7, by - 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a8ad0';
  ctx.beginPath();
  ctx.moveTo(cx + 17, by - 34);
  ctx.lineTo(cx - 17, by);
  ctx.lineTo(cx - 17, by - 10);
  ctx.lineTo(cx + 7, by - 34);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ink(ctx, 3);
  roundRect(ctx, cx - 17, by - 34, 34, 34, 3);
  ctx.stroke();
  // letter J
  ctx.font = 'bold 16px Georgia';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeText('J', cx, by - 12);
  ctx.fillText('J', cx, by - 12);
  // crank
  ink(ctx, 2.4);
  ctx.beginPath();
  ctx.moveTo(cx + 17, by - 18);
  ctx.lineTo(cx + 23, by - 18);
  ctx.lineTo(cx + 23 + Math.cos(s * 3) * 5, by - 18 + Math.sin(s * 3) * 5);
  ctx.stroke();
  // lid
  if (!open) {
    ctx.save();
    ctx.translate(cx - 18, by - 34);
    ctx.rotate(mode === 'windup' ? -0.15 - Math.abs(s) * 0.25 : 0);
    roundRect(ctx, 0, -5, 36, 6, 2);
    fillInk(ctx, '#c8a050', 2.4);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(cx - 18, by - 34);
    ctx.rotate(-1.9);
    roundRect(ctx, 0, -5, 36, 6, 2);
    fillInk(ctx, '#c8a050', 2.4);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Dunk-Tank Clown
function dunkTank(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2, by = h - 6;
  // wheels
  for (const side of [-1, 1]) {
    circle(ctx, cx + side * 18, by - 6, 6.5);
    fillInk(ctx, '#3a3040', 2.4);
    ink(ctx, 1.5);
    ctx.beginPath();
    ctx.moveTo(cx + side * 18 + Math.cos(s * 6) * 5, by - 6 + Math.sin(s * 6) * 5);
    ctx.lineTo(cx + side * 18 - Math.cos(s * 6) * 5, by - 6 - Math.sin(s * 6) * 5);
    ctx.stroke();
  }
  // water tank (glass)
  roundRect(ctx, cx - 24, by - 40, 48, 32, 5);
  ctx.fillStyle = 'rgba(120,190,230,0.85)';
  ctx.fill();
  ctx.fillStyle = 'rgba(80,150,210,0.95)';
  ctx.fillRect(cx - 23, by - 26 + s, 46, 17);
  ink(ctx, 3);
  roundRect(ctx, cx - 24, by - 40, 48, 32, 5);
  ctx.stroke();
  shine(ctx, cx - 16, by - 34, 3, 0.6);
  // target
  circle(ctx, cx + 28, by - 30, 7);
  fillInk(ctx, '#fffaf0', 2);
  circle(ctx, cx + 28, by - 30, 4.4);
  ctx.fillStyle = PAL.red;
  ctx.fill();
  circle(ctx, cx + 28, by - 30, 1.8);
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  // seat plank + clown on it
  roundRect(ctx, cx - 20, by - 46, 40, 6, 2);
  fillInk(ctx, PAL.wood, 2);
  const hy = by - 60;
  // body
  ellipse(ctx, cx - 2, by - 52, 10, 9);
  fillInk(ctx, '#3a8ad0', 2.6);
  // throwing arm
  const back = mode === 'windup';
  hose(ctx, cx + 4, by - 55, cx + (back ? -2 : 14), by - (back ? 72 : 62), cx + (back ? -10 : 20), by - (back ? 70 : 58), 4, '#3a8ad0');
  const hx = cx + (back ? -10 : 20), hyy = by - (back ? 70 : 58);
  glove(ctx, hx, hyy, 4.5, back ? -2.4 : 0.3);
  // pie in hand
  ellipse(ctx, hx + 2, hyy - 5, 7, 3.4);
  fillInk(ctx, '#e8c873', 1.8);
  ellipse(ctx, hx + 2, hyy - 6.5, 5.5, 2);
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  // head
  circle(ctx, cx - 2, hy, 9);
  fillInk(ctx, '#fffaf0', 2.6);
  pieEye(ctx, cx - 5, hy - 2, 2.6, 3.4, 0.6, 0);
  pieEye(ctx, cx + 2, hy - 2, 2.6, 3.4, 0.6, 0);
  grin(ctx, cx - 1, hy + 3, 11, 2.4, 4, '#7a0f18', 1.4);
  circle(ctx, cx + 1, hy + 1, 2.4);
  fillInk(ctx, PAL.red, 1.4);
  for (const side of [-1, 1]) {
    circle(ctx, cx - 2 + side * 10, hy - 2, 4);
    fillInk(ctx, '#4fd66a', 1.8);
  }
}

// ---------------------------------------------------------------- Puppet Soldier
function puppet(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2;
  const jerk = Math.round(s * 2) / 2; // jerky marionette motion
  // control strings up out of frame
  ctx.save();
  ctx.globalAlpha = 0.6;
  ink(ctx, 0.8);
  ctx.strokeStyle = '#e8e2d8';
  ctx.beginPath();
  ctx.moveTo(cx - 10, 0);
  ctx.lineTo(cx - 12, 44);
  ctx.moveTo(cx + 10, 0);
  ctx.lineTo(cx + 13, 44);
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, 10);
  ctx.stroke();
  ctx.restore();
  // wooden legs (stiff)
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 5, 54);
    ctx.rotate(jerk * side * 0.35);
    roundRect(ctx, -3, 0, 6, 20, 2);
    fillInk(ctx, '#f0ece0', 2);
    roundRect(ctx, -4, 17, 9, 6, 2);
    fillInk(ctx, '#1a1418', 2);
    ctx.restore();
  }
  // tin-toy uniform
  roundRect(ctx, cx - 11, 32, 22, 24, 4);
  fillInk(ctx, shade(ctx, cx, 42, 14, '#d0384a', '#8a1a26'), 2.8);
  ink(ctx, 1.5);
  ctx.strokeStyle = PAL.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 11, 35);
  ctx.lineTo(cx + 11, 52);
  ctx.moveTo(cx + 11, 35);
  ctx.lineTo(cx - 11, 52);
  ctx.stroke();
  // musket raised in windup
  const aim = mode === 'windup' ? -0.15 : 0.9;
  ctx.save();
  ctx.translate(cx + 6, 42);
  ctx.rotate(aim);
  roundRect(ctx, -2, -4, 30, 4.5, 1.5);
  fillInk(ctx, PAL.woodDark, 1.8);
  roundRect(ctx, 20, -5, 12, 3, 1);
  fillInk(ctx, '#a9b2b8', 1.4);
  if (mode === 'windup') {
    ctx.fillStyle = DANGER;
    circle(ctx, 34, -3.5, 2.4);
    ctx.fill();
  }
  ctx.restore();
  glove(ctx, cx + 10, 44, 4, 0.3);
  // head
  circle(ctx, cx, 22, 9.5);
  fillInk(ctx, shade(ctx, cx, 22, 9.5, '#f8e0c0', '#d8b088'), 2.6);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ff6a7a';
  circle(ctx, cx - 5, 25, 2.2);
  ctx.fill();
  circle(ctx, cx + 6, 25, 2.2);
  ctx.fill();
  ctx.restore();
  pieEye(ctx, cx - 3.5, 21, 2.4, 3, 0.6, 0);
  pieEye(ctx, cx + 4, 21, 2.4, 3, 0.6, 0);
  ink(ctx, 1.4);
  ctx.beginPath();
  ctx.moveTo(cx - 3, 27);
  ctx.lineTo(cx + 4, 27);
  ctx.moveTo(cx - 3, 27);
  ctx.lineTo(cx - 3, 30);
  ctx.moveTo(cx + 4, 27);
  ctx.lineTo(cx + 4, 30);
  ctx.stroke();
  // shako hat with plume
  roundRect(ctx, cx - 7, 4, 14, 12, 2);
  fillInk(ctx, '#1a1418', 2.2);
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(cx - 6.5, 13, 13, 2);
  ellipse(ctx, cx + 2, 2, 3, 5, 0.3);
  fillInk(ctx, '#fffaf0', 1.4);
}

// ---------------------------------------------------------------- Carousel Horse
function horse(ctx: Ctx, w: number, h: number, s: number, c: number, mode: EnemyMode): void {
  const cx = w / 2 - 4, by = 46;
  const rear = mode === 'windup';
  ctx.save();
  if (rear) {
    ctx.translate(cx - 18, by + 18);
    ctx.rotate(-0.4);
    ctx.translate(-(cx - 18), -(by + 18));
  }
  // brass pole through its back
  ctx.save();
  const pg = ctx.createLinearGradient(cx - 3, 0, cx + 3, 0);
  pg.addColorStop(0, '#8a6a2a');
  pg.addColorStop(0.5, '#ffe38a');
  pg.addColorStop(1, '#8a6a2a');
  ctx.fillStyle = pg;
  ctx.fillRect(cx - 2.5, 0, 5, h - 8);
  ink(ctx, 1.6);
  ctx.strokeRect(cx - 2.5, 0, 5, h - 8);
  ctx.restore();
  // legs (gallop)
  const legs: [number, number][] = [[-18, s], [-10, -s], [12, -c], [20, c]];
  for (const [lx, sw] of legs) {
    ctx.save();
    ctx.translate(cx + lx, by + 10);
    ctx.rotate(sw * 0.5 + (rear && lx > 0 ? -1 : 0));
    roundRect(ctx, -3.5, 0, 7, 20, 3);
    fillInk(ctx, '#f7eedb', 2.4);
    roundRect(ctx, -4.5, 17, 9, 6, 2);
    fillInk(ctx, PAL.gold, 2);
    ctx.restore();
  }
  // body
  ellipse(ctx, cx, by + 4, 26, 13);
  fillInk(ctx, shade(ctx, cx, by, 26, '#ffffff', '#e0d4bc'), 3);
  // saddle + painted ribbons
  ctx.beginPath();
  ctx.ellipse(cx - 2, by - 3, 11, 7, 0, Math.PI, 0);
  ctx.closePath();
  fillInk(ctx, PAL.red, 2);
  ctx.fillStyle = PAL.cyan;
  ctx.fillRect(cx - 24, by + 6, 48, 3);
  ink(ctx, 1.2);
  ctx.strokeRect(cx - 24, by + 6, 48, 3);
  // tail
  ctx.beginPath();
  ctx.moveTo(cx - 25, by);
  ctx.quadraticCurveTo(cx - 40, by - 6 + s * 4, cx - 34, by + 14);
  ctx.quadraticCurveTo(cx - 32, by + 4, cx - 25, by + 4);
  fillInk(ctx, '#f6cf4f', 2);
  // neck + head
  ctx.beginPath();
  ctx.moveTo(cx + 16, by - 4);
  ctx.quadraticCurveTo(cx + 22, by - 26, cx + 30, by - 30);
  ctx.lineTo(cx + 40, by - 22);
  ctx.quadraticCurveTo(cx + 44, by - 14, cx + 38, by - 12);
  ctx.quadraticCurveTo(cx + 30, by - 14, cx + 26, by - 2);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx + 30, by - 20, 16, '#ffffff', '#e0d4bc'), 3);
  // mane
  ctx.fillStyle = '#f6cf4f';
  for (let i = 0; i < 4; i++) {
    ellipse(ctx, cx + 20 + i * 3, by - 18 - i * 3, 4, 3, -0.8);
    ctx.fill();
    ink(ctx, 1.4);
    ctx.stroke();
  }
  // wild eye + teeth
  pieEye(ctx, cx + 33, by - 23, 3.2, 3.8, 1, 0, { glow: rear ? '#ffe3a0' : undefined });
  ctx.fillStyle = '#fff6dc';
  ctx.fillRect(cx + 37, by - 15, 5, 2.4);
  ink(ctx, 1.2);
  ctx.strokeRect(cx + 37, by - 15, 5, 2.4);
  // bridle
  ink(ctx, 1.6);
  ctx.strokeStyle = PAL.red;
  ctx.beginPath();
  ctx.moveTo(cx + 30, by - 28);
  ctx.lineTo(cx + 40, by - 15);
  ctx.stroke();
  ctx.restore();
  if (rear) {
    ctx.fillStyle = 'rgba(160,130,100,0.6)';
    for (let i = 0; i < 4; i++) {
      circle(ctx, cx + 10 + i * 8, h - 8 - (i % 2) * 3, 4 + (i % 2));
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- Bumper Car
function bumperCar(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2, by = h - 10;
  // pole with crackling spark
  ink(ctx, 2);
  ctx.strokeStyle = '#a9b2b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 14, by - 22);
  ctx.lineTo(cx - 18, 4);
  ctx.stroke();
  if (mode === 'windup' || Math.abs(s) > 0.7) {
    ctx.strokeStyle = '#fff36a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 18, 4);
    ctx.lineTo(cx - 12, 0);
    ctx.lineTo(cx - 20, -2);
    ctx.lineTo(cx - 14, -6);
    ctx.stroke();
  }
  // rubber bumper base (teeth)
  roundRect(ctx, cx - 34, by - 16, 68, 18, 9);
  fillInk(ctx, '#2a2230', 3);
  ctx.fillStyle = '#fff6dc';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + 12 + i * 3.4, by - 6);
    ctx.lineTo(cx + 15 + i * 3.4, by - 6);
    ctx.lineTo(cx + 13.5 + i * 3.4, by - 1);
    ctx.fill();
  }
  // car body
  ctx.beginPath();
  ctx.moveTo(cx - 28, by - 14);
  ctx.quadraticCurveTo(cx - 30, by - 32, cx - 10, by - 34);
  ctx.lineTo(cx + 14, by - 30);
  ctx.quadraticCurveTo(cx + 32, by - 24, cx + 30, by - 14);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx, by - 24, 30, '#ff8a6a', '#c8322d'), 3);
  shine(ctx, cx - 14, by - 28, 3.4, 0.7);
  // headlight eyes + grin
  const glow = mode === 'windup' ? '#fff36a' : '#fffaf0';
  pieEye(ctx, cx + 18, by - 22, 4, 4.6, 0.6, 0, { glow, lid: 0.4, lidSide: -1 });
  pieEye(ctx, cx + 6, by - 24, 3.6, 4.2, 0.6, 0, { glow, lid: 0.4, lidSide: -1 });
  ctx.font = 'bold 10px Georgia';
  ctx.fillStyle = PAL.yellow;
  ctx.textAlign = 'center';
  ctx.fillText('7', cx - 16, by - 18);
}

// ---------------------------------------------------------------- Walking Ticket Booth
function booth(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2, by = h - 6;
  // stubby legs
  for (const side of [-1, 1]) {
    hose(ctx, cx + side * 12, by - 18, cx + side * 14, by - 10, cx + side * 14 + s * side * 5, by - 5, 5.5, '#3a2a22');
    shoe(ctx, cx + side * 14 + s * side * 5, by - 3, 6.5, '#2a1d16');
  }
  // booth body
  const top = 30;
  roundRect(ctx, cx - 30, top, 60, by - 18 - top, 3);
  ctx.save();
  ctx.clip();
  vstripes(ctx, cx - 30, top, 60, by - 18 - top, '#c8322d', '#f2e6cc', 6);
  ctx.restore();
  ink(ctx, 3);
  roundRect(ctx, cx - 30, top, 60, by - 18 - top, 3);
  ctx.stroke();
  // roof
  ctx.beginPath();
  ctx.moveTo(cx - 38, top + 2);
  ctx.lineTo(cx, top - 24);
  ctx.lineTo(cx + 38, top + 2);
  ctx.closePath();
  fillInk(ctx, '#3a1a3a', 3);
  ctx.font = '9px "Rye", Georgia';
  ctx.textAlign = 'center';
  ctx.fillStyle = PAL.gold;
  ctx.fillText('TICKETS', cx, top - 4);
  // single window-eye
  roundRect(ctx, cx - 18, top + 10, 36, 24, 5);
  fillInk(ctx, '#fff3c0', 2.6);
  const look = mode === 'windup' ? 0 : s;
  circle(ctx, cx + look * 6, top + 22, 8);
  fillInk(ctx, '#fffaf0', 2);
  circle(ctx, cx + look * 6 + 1, top + 22, 4.6);
  ctx.fillStyle = mode === 'windup' ? DANGER : INK;
  ctx.fill();
  // ticket slot mouth (spits paper on windup)
  const open = mode === 'windup' ? 6 : 2;
  roundRect(ctx, cx - 14, top + 42, 28, open + 2, 2);
  fillInk(ctx, '#2a0a10', 2);
  if (mode === 'windup') {
    ctx.fillStyle = '#ffe9a0';
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(cx - 8 + i * 8, top + 48);
      ctx.rotate(-0.3 + i * 0.3);
      ctx.fillRect(-3, 0, 6, 10);
      ink(ctx, 1);
      ctx.strokeRect(-3, 0, 6, 10);
      ctx.restore();
    }
  }
  // bulbs along roof
  for (let i = -3; i <= 3; i++) {
    circle(ctx, cx + i * 10, top + 1, 2);
    fillInk(ctx, i % 2 ? '#fff6c8' : '#ffd36a', 1);
  }
  // arms
  for (const side of [-1, 1]) {
    hose(ctx, cx + side * 30, top + 30, cx + side * 40, top + 36, cx + side * 38, top + 46 + s * side * 3, 4.5, '#3a2a22');
    glove(ctx, cx + side * 38, top + 48 + s * side * 3, 5, Math.PI / 2);
  }
}

// ---------------------------------------------------------------- Roller-Coaster Snake (head; segments separate)
function snakeHead(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode): void {
  const cx = w / 2, cy = h * 0.55;
  // wheels
  for (const side of [-1, 1]) {
    circle(ctx, cx + side * 16, cy + 14, 5);
    fillInk(ctx, '#3a3040', 2);
  }
  // front car body
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy + 12);
  ctx.lineTo(cx - 26, cy - 10);
  ctx.quadraticCurveTo(cx - 20, cy - 20, cx + 6, cy - 18);
  ctx.quadraticCurveTo(cx + 30, cy - 14, cx + 32, cy + 4);
  ctx.lineTo(cx + 28, cy + 12);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx, cy, 30, '#7af0c0', '#1f8f6a'), 3);
  // track-rail grin
  ctx.fillStyle = '#2a0a10';
  roundRect(ctx, cx + 4, cy + 2, 26, 8, 3);
  ctx.fill();
  ctx.fillStyle = '#c8ccd0';
  for (let i = 0; i < 5; i++) ctx.fillRect(cx + 6 + i * 5, cy + 2, 2.4, 8);
  ink(ctx, 2);
  roundRect(ctx, cx + 4, cy + 2, 26, 8, 3);
  ctx.stroke();
  // headlight eyes
  const glow = mode === 'windup' ? '#fff36a' : '#fff8d0';
  pieEye(ctx, cx + 12, cy - 9, 5, 5.5, 0.8, 0, { glow, lid: 0.45, lidSide: -1 });
  pieEye(ctx, cx + 25, cy - 7, 4.4, 5, 0.8, 0, { glow, lid: 0.45, lidSide: -1 });
  ctx.fillStyle = PAL.yellow;
  ctx.font = 'bold 9px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText('XX', cx - 12, cy + 2);
  void s;
}

export function drawSnakeSegment(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h * 0.55;
  for (const side of [-1, 1]) {
    circle(ctx, cx + side * 14, cy + 12, 4.6);
    fillInk(ctx, '#3a3040', 2);
  }
  roundRect(ctx, cx - 22, cy - 14, 44, 26, 6);
  fillInk(ctx, shade(ctx, cx, cy, 24, '#6ae0b0', '#1a7a5a'), 3);
  roundRect(ctx, cx - 16, cy - 10, 32, 10, 3);
  fillInk(ctx, '#123a2e', 2);
  ctx.fillStyle = PAL.yellow;
  ctx.fillRect(cx - 22, cy + 4, 44, 3);
  ink(ctx, 1.2);
  ctx.strokeRect(cx - 22, cy + 4, 44, 3);
}

// ---------------------------------------------------------------- Carnival Brute (miniboss)
function brute(ctx: Ctx, w: number, h: number, s: number, c: number, mode: EnemyMode): void {
  const cx = w / 2, by = h - 8;
  const slam = mode === 'windup';
  for (const side of [-1, 1]) {
    hose(ctx, cx + side * 12, by - 32, cx + side * 16, by - 18, cx + side * 18 + s * side * 5, by - 8, 9, '#2a1d16');
    shoe(ctx, cx + side * 18 + s * side * 5, by - 5, 10, '#1a1418');
  }
  // massive torso in a striped singlet
  ctx.beginPath();
  ctx.moveTo(cx - 32, by - 82);
  ctx.quadraticCurveTo(cx - 46, by - 50, cx - 24, by - 28);
  ctx.lineTo(cx + 24, by - 28);
  ctx.quadraticCurveTo(cx + 46, by - 50, cx + 32, by - 82);
  ctx.quadraticCurveTo(cx, by - 92, cx - 32, by - 82);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#e9b98f';
  ctx.fillRect(cx - 50, by - 95, 100, 70);
  ctx.fillStyle = '#5a1a3a';
  ctx.beginPath();
  ctx.rect(cx - 50, by - 62, 100, 40);
  ctx.fill();
  ctx.fillStyle = '#f2e6cc';
  for (let y = by - 60; y < by - 25; y += 8) ctx.fillRect(cx - 50, y, 100, 3.5);
  ctx.restore();
  ink(ctx, 3.5);
  ctx.beginPath();
  ctx.moveTo(cx - 32, by - 82);
  ctx.quadraticCurveTo(cx - 46, by - 50, cx - 24, by - 28);
  ctx.lineTo(cx + 24, by - 28);
  ctx.quadraticCurveTo(cx + 46, by - 50, cx + 32, by - 82);
  ctx.quadraticCurveTo(cx, by - 92, cx - 32, by - 82);
  ctx.closePath();
  ctx.stroke();
  // prize chest strapped to belt
  roundRect(ctx, cx - 12, by - 40, 24, 16, 3);
  fillInk(ctx, PAL.woodLight, 2.4);
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(cx - 2, by - 40, 4, 16);
  // arms (raised for the slam)
  for (const side of [-1, 1]) {
    const hx = cx + side * (slam ? 22 : 44), hy = by - (slam ? 112 : 56 + c * side * 4);
    hose(ctx, cx + side * 30, by - 76, cx + side * 50, by - (slam ? 100 : 72), hx, hy, 12, '#e9b98f');
    glove(ctx, hx, hy, 9, slam ? -Math.PI / 2 : Math.PI / 2, '#fffaf0', true);
  }
  // small head, handlebar mustache, angry pie eyes
  const hy = by - 96;
  circle(ctx, cx, hy, 13);
  fillInk(ctx, shade(ctx, cx, hy, 13, '#f8d0a8', '#d29a6c'), 3);
  pieEye(ctx, cx - 5, hy - 3, 3.4, 4, 0.2, 0.3, { lid: 0.6, lidSide: 1, glow: slam ? '#ffe3a0' : undefined });
  pieEye(ctx, cx + 5, hy - 3, 3.4, 4, -0.2, 0.3, { lid: 0.6, lidSide: -1, glow: slam ? '#ffe3a0' : undefined });
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx, hy + 4);
  ctx.bezierCurveTo(cx - 6, hy + 1, cx - 14, hy + 4, cx - 13, hy + 9);
  ctx.bezierCurveTo(cx - 9, hy + 5, cx - 4, hy + 6, cx, hy + 6);
  ctx.bezierCurveTo(cx + 4, hy + 6, cx + 9, hy + 5, cx + 13, hy + 9);
  ctx.bezierCurveTo(cx + 14, hy + 4, cx + 6, hy + 1, cx, hy + 4);
  ctx.fill();
  shine(ctx, cx - 5, hy - 9, 2.4, 0.6);
}
