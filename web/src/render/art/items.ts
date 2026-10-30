// Pickups, projectiles, summons, enemy bullets, particles and UI icons.

import { DANGER, INK, PAL, circle, ellipse, fillInk, glove, grin, hose, ink, lighten, pieEye, roundRect, shade, shine, shoe, stripes, type Ctx } from './kit';

// ---------------------------------------------------------------- pickups
/** Ticket stub — blue (small) → green (medium) → magenta (large); never the danger red (D-27). */
export function ticket(ctx: Ctx, w: number, h: number, tier: number): void {
  const cols = [['#8fd8ff', '#2f7fd0'], ['#a8ff9a', '#2f9a4a'], ['#ffb0f0', '#c83aa8'], ['#ffe98a', '#d9a43a']][tier];
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.25);
  const tw = w * 0.78, th = h * 0.5;
  ctx.beginPath();
  ctx.moveTo(-tw / 2, -th / 2);
  ctx.lineTo(tw / 2, -th / 2);
  ctx.arc(tw / 2, 0, th * 0.22, -Math.PI / 2, Math.PI / 2, true);
  ctx.lineTo(tw / 2, th / 2);
  ctx.lineTo(-tw / 2, th / 2);
  ctx.arc(-tw / 2, 0, th * 0.22, Math.PI / 2, -Math.PI / 2, true);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 0, 0, tw / 2, cols[0], cols[1]), Math.max(1.2, w * 0.07));
  ctx.setLineDash([1.5, 1.5]);
  ink(ctx, 1);
  ctx.beginPath();
  ctx.moveTo(tw * 0.18, -th / 2 + 1);
  ctx.lineTo(tw * 0.18, th / 2 - 1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `bold ${th * 0.6}px Georgia`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', -tw * 0.12, 0.5);
  ctx.restore();
}

export function hotdog(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  ellipse(ctx, cx, cy + 3, w * 0.42, h * 0.2);
  fillInk(ctx, '#e8b060', 2);
  ellipse(ctx, cx, cy, w * 0.45, h * 0.13);
  fillInk(ctx, '#c8462a', 2);
  ink(ctx, 2);
  ctx.strokeStyle = '#f6cf4f';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) ctx.lineTo(cx - w * 0.35 + i * w * 0.14, cy - 1 + (i % 2 ? 2 : -2));
  ctx.stroke();
  shine(ctx, cx - w * 0.2, cy - 2, 2, 0.6);
}

export function funnelCake(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  ellipse(ctx, cx, cy + 3, w * 0.44, h * 0.3);
  fillInk(ctx, '#fffaf0', 2);
  ink(ctx, 4);
  ctx.strokeStyle = '#d99a4a';
  ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const a = i * 1.7;
    ctx.lineTo(cx + Math.cos(a) * w * 0.3 * (0.4 + (i % 3) * 0.3), cy + Math.sin(a) * h * 0.2 * (0.4 + (i % 2) * 0.5));
  }
  ctx.stroke();
  ctx.fillStyle = '#fffaf0';
  for (let i = 0; i < 12; i++) {
    circle(ctx, cx + Math.cos(i * 2.3) * w * 0.25, cy + Math.sin(i * 2.3) * h * 0.15, 1);
    ctx.fill();
  }
}

export function goldenTicket(ctx: Ctx, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,240,150,0.9)');
  g.addColorStop(1, 'rgba(255,200,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ticket(ctx, w, h, 3);
}

export function chest(ctx: Ctx, w: number, h: number, open = false): void {
  const cx = w / 2, by = h - 4;
  roundRect(ctx, cx - w * 0.4, by - h * 0.45, w * 0.8, h * 0.45, 4);
  fillInk(ctx, shade(ctx, cx, by - h * 0.25, w * 0.5, '#d89a5a', '#7a4a20'), 3);
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(cx - w * 0.4, by - h * 0.32, w * 0.8, 4);
  ctx.fillRect(cx - 3, by - h * 0.45, 6, h * 0.45);
  if (!open) {
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.42, by - h * 0.45);
    ctx.quadraticCurveTo(cx, by - h * 0.85, cx + w * 0.42, by - h * 0.45);
    ctx.closePath();
    fillInk(ctx, shade(ctx, cx, by - h * 0.6, w * 0.5, '#e8aa6a', '#8a5226'), 3);
    stripesLid(ctx, cx, by, w, h);
  } else {
    const g = ctx.createRadialGradient(cx, by - h * 0.5, 2, cx, by - h * 0.5, w * 0.5);
    g.addColorStop(0, 'rgba(255,250,200,0.95)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  roundRect(ctx, cx - 5, by - h * 0.5, 10, 10, 2);
  fillInk(ctx, PAL.gold, 2);
  ctx.fillStyle = INK;
  circle(ctx, cx, by - h * 0.47, 1.6);
  ctx.fill();
}
function stripesLid(ctx: Ctx, cx: number, by: number, w: number, h: number): void {
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(cx - 3, by - h * 0.8, 6, h * 0.36);
  ink(ctx, 2);
  ctx.strokeRect(cx - 3, by - h * 0.8, 6, h * 0.36);
}

// ---------------------------------------------------------------- player projectiles
export function card(ctx: Ctx, w: number, h: number, gold = false): void {
  const cx = w / 2, cy = h / 2;
  roundRect(ctx, cx - w * 0.3, cy - h * 0.42, w * 0.6, h * 0.84, 2.5);
  fillInk(ctx, gold ? shade(ctx, cx, cy, w * 0.5, '#fff6b0', '#e8b030') : '#fffaf0', 2);
  ctx.fillStyle = gold ? INK : PAL.red;
  ctx.font = `bold ${h * 0.42}px Georgia`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gold ? '♛' : '♥', cx, cy + 1);
}

export function tarotCard(ctx: Ctx, w: number, h: number, death = false): void {
  const cx = w / 2, cy = h / 2;
  roundRect(ctx, cx - w * 0.32, cy - h * 0.44, w * 0.64, h * 0.88, 3);
  fillInk(ctx, death ? shade(ctx, cx, cy, w * 0.6, '#5a2a7a', '#1a0a2a') : shade(ctx, cx, cy, w * 0.6, '#8a4ac0', '#4a1f76'), 2);
  ink(ctx, 1.2);
  ctx.strokeStyle = PAL.gold;
  roundRect(ctx, cx - w * 0.24, cy - h * 0.36, w * 0.48, h * 0.72, 2);
  ctx.stroke();
  if (death) {
    // skull
    circle(ctx, cx, cy - 2, w * 0.17);
    fillInk(ctx, '#f2e6cc', 1.4);
    ctx.fillStyle = INK;
    circle(ctx, cx - w * 0.07, cy - 3, w * 0.05);
    ctx.fill();
    circle(ctx, cx + w * 0.07, cy - 3, w * 0.05);
    ctx.fill();
  } else {
    ctx.fillStyle = PAL.gold;
    ctx.font = `${h * 0.36}px Georgia`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☾', cx, cy);
  }
}

export function dart(ctx: Ctx, w: number, h: number): void {
  const cy = h / 2;
  ink(ctx, 2);
  ctx.strokeStyle = '#c8ccd0';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, cy);
  ctx.lineTo(w * 0.95, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.05, cy - h * 0.35);
  ctx.lineTo(w * 0.35, cy);
  ctx.lineTo(w * 0.05, cy + h * 0.35);
  ctx.closePath();
  fillInk(ctx, PAL.red, 1.4);
  roundRect(ctx, w * 0.3, cy - 2.5, w * 0.25, 5, 2);
  fillInk(ctx, PAL.yellow, 1.2);
}

export function shrapnel(ctx: Ctx, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.5);
  ctx.lineTo(w * 0.6, h * 0.15);
  ctx.lineTo(w * 0.9, h * 0.55);
  ctx.lineTo(w * 0.45, h * 0.85);
  ctx.closePath();
  fillInk(ctx, '#ff7bb0', 1.4);
}

export function ring(ctx: Ctx, w: number, h: number, big = false): void {
  const cx = w / 2, cy = h / 2, r = w * 0.4;
  circle(ctx, cx, cy, r);
  ink(ctx, w * 0.2);
  ctx.stroke();
  ctx.strokeStyle = big ? '#c890ff' : '#f6cf4f';
  ctx.lineWidth = w * 0.12;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = w * 0.03;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -2.5, -1.4);
  ctx.stroke();
}

export function rocket(ctx: Ctx, w: number, h: number, shell = false): void {
  const cy = h / 2;
  roundRect(ctx, w * 0.2, cy - h * 0.18, w * 0.55, h * 0.36, 3);
  stripes(ctx, w * 0.2, cy - h * 0.18, w * 0.55, h * 0.36, shell ? '#9a4ad0' : PAL.red, '#fffaf0', 3, 0.8);
  ink(ctx, 1.8);
  roundRect(ctx, w * 0.2, cy - h * 0.18, w * 0.55, h * 0.36, 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.75, cy - h * 0.2);
  ctx.lineTo(w * 0.98, cy);
  ctx.lineTo(w * 0.75, cy + h * 0.2);
  ctx.closePath();
  fillInk(ctx, PAL.yellow, 1.8);
  ctx.fillStyle = '#ffb030';
  ctx.beginPath();
  ctx.moveTo(w * 0.2, cy - h * 0.12);
  ctx.lineTo(w * 0.02, cy);
  ctx.lineTo(w * 0.2, cy + h * 0.12);
  ctx.closePath();
  ctx.fill();
}

export function kernel(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  for (const [x, y, r] of [[-0.18, -0.1, 0.24], [0.15, -0.14, 0.22], [0.02, 0.14, 0.26]] as [number, number, number][]) {
    circle(ctx, cx + x * w, cy + y * h, r * w);
    fillInk(ctx, '#fff6dc', 1.4);
  }
  ellipse(ctx, cx, cy + h * 0.2, w * 0.14, h * 0.1);
  fillInk(ctx, '#e8a030', 1.2);
}

/** The human cannonball (helmeted daredevil, arms forward). */
export function cannonball(ctx: Ctx, w: number, h: number): void {
  const cy = h / 2;
  // speed streaks
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(2, cy + i * 7);
    ctx.lineTo(w * 0.3, cy + i * 7);
    ctx.stroke();
  }
  ellipse(ctx, w * 0.55, cy, w * 0.3, h * 0.25);
  fillInk(ctx, shade(ctx, w * 0.55, cy, w * 0.3, '#ff7a6a', '#a81a1a'), 2.4);
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(w * 0.35, cy - 2, w * 0.4, 4);
  circle(ctx, w * 0.82, cy, h * 0.22);
  fillInk(ctx, shade(ctx, w * 0.82, cy, h * 0.22, '#f0f0f0', '#a0a8b0'), 2.4);
  ellipse(ctx, w * 0.88, cy - 1, h * 0.1, h * 0.07);
  fillInk(ctx, '#7fc4f0', 1.2);
  glove(ctx, w * 0.97, cy - h * 0.18, 3.4, 0);
  glove(ctx, w * 0.97, cy + h * 0.18, 3.4, 0);
}

export function derbyCar(ctx: Ctx, w: number, h: number, ghost = false): void {
  ctx.save();
  if (ghost) ctx.globalAlpha = 0.75;
  const cx = w / 2, cy = h / 2;
  roundRect(ctx, cx - w * 0.42, cy - h * 0.32, w * 0.84, h * 0.64, h * 0.3);
  fillInk(ctx, '#2a2230', 2.4);
  roundRect(ctx, cx - w * 0.33, cy - h * 0.26, w * 0.62, h * 0.52, h * 0.2);
  fillInk(ctx, shade(ctx, cx, cy, w * 0.4, ghost ? '#b0f0ff' : '#ffe36a', ghost ? '#3fa0d0' : '#e8a020'), 2.4);
  pieEye(ctx, cx + w * 0.22, cy - h * 0.1, 3, 3.4, 0.8, 0, { glow: '#fff8d0' });
  pieEye(ctx, cx + w * 0.22, cy + h * 0.12, 3, 3.4, 0.8, 0, { glow: '#fff8d0' });
  ctx.restore();
}

// ---------------------------------------------------------------- summons
export function plushPet(ctx: Ctx, w: number, h: number, variant: number, phase: number): void {
  const cx = w / 2, by = h - 6 - Math.abs(Math.sin(phase * Math.PI * 2)) * 3;
  const cols = ['#c8a070', '#f0a0c8', '#90d0f0', '#b0e080'];
  const col = cols[variant % 4];
  for (const side of [-1, 1]) {
    ellipse(ctx, cx + side * 6, h - 6, 4, 3.4);
    fillInk(ctx, col, 1.8);
  }
  ellipse(ctx, cx, by - 9, 10, 9);
  fillInk(ctx, shade(ctx, cx, by - 9, 10, lighten(col, 0.4), col), 2.4);
  const hy = by - 21;
  if (variant % 4 === 1) {
    // bunny ears
    for (const side of [-1, 1]) {
      ellipse(ctx, cx + side * 4, hy - 11, 3, 8, side * 0.2);
      fillInk(ctx, col, 1.8);
    }
  } else if (variant % 4 === 2) {
    // octopus tentacle tufts
    for (let i = -1; i <= 1; i++) {
      ellipse(ctx, cx + i * 5, hy - 9, 2.5, 4);
      fillInk(ctx, col, 1.6);
    }
  } else {
    for (const side of [-1, 1]) {
      circle(ctx, cx + side * 7, hy - 6, 4);
      fillInk(ctx, col, 1.8);
    }
  }
  circle(ctx, cx, hy, 9);
  fillInk(ctx, shade(ctx, cx, hy, 9, lighten(col, 0.4), col), 2.4);
  circle(ctx, cx - 3, hy - 1, 2);
  fillInk(ctx, INK, 1);
  circle(ctx, cx + 3.5, hy - 1, 2);
  fillInk(ctx, INK, 1);
  ctx.fillStyle = '#fffaf0';
  circle(ctx, cx - 3.6, hy - 1.8, 0.6);
  ctx.fill();
  circle(ctx, cx + 2.9, hy - 1.8, 0.6);
  ctx.fill();
  grin(ctx, cx + 0.5, hy + 2.5, 8, 2, 3, '#5a1018', 1.2);
}

export function rabbit(ctx: Ctx, w: number, h: number, phase: number): void {
  const cx = w / 2, by = h - 4 - Math.abs(Math.sin(phase * Math.PI * 2)) * 7;
  ellipse(ctx, cx, by - 10, 10, 9);
  fillInk(ctx, '#fffaf0', 2.2);
  for (const side of [-1, 1]) {
    ellipse(ctx, cx + side * 4, by - 34, 3.4, 9, side * 0.2);
    fillInk(ctx, '#fffaf0', 2);
    ellipse(ctx, cx + side * 4, by - 34, 1.6, 6, side * 0.2);
    ctx.fillStyle = '#ffb0c8';
    ctx.fill();
  }
  circle(ctx, cx + 2, by - 22, 8);
  fillInk(ctx, '#fffaf0', 2.2);
  pieEye(ctx, cx + 4, by - 24, 2, 2.6, 0.6, 0);
  ellipse(ctx, cx + 8.5, by - 20, 1.6, 1.3);
  ctx.fillStyle = '#ff7aa0';
  ctx.fill();
  shoe(ctx, cx + 6, by - 2, 5, '#fffaf0');
}

export function dove(ctx: Ctx, w: number, h: number, phase: number): void {
  const cx = w / 2, cy = h / 2;
  const flap = Math.sin(phase * Math.PI * 2);
  ellipse(ctx, cx, cy, 11, 7);
  fillInk(ctx, '#fffaf0', 2);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy);
    ctx.quadraticCurveTo(cx - 8, cy - side * (12 + flap * 6), cx - 14, cy - side * (4 + flap * 8));
    ctx.quadraticCurveTo(cx - 6, cy - side * 2, cx - 2, cy);
    fillInk(ctx, '#f0ece0', 1.8);
  }
  circle(ctx, cx + 10, cy - 3, 5);
  fillInk(ctx, '#fffaf0', 1.8);
  pieEye(ctx, cx + 11, cy - 4, 1.6, 2, 0.6, 0);
  ctx.beginPath();
  ctx.moveTo(cx + 14.5, cy - 3);
  ctx.lineTo(cx + 19, cy - 2);
  ctx.lineTo(cx + 14.5, cy - 0.5);
  ctx.closePath();
  fillInk(ctx, PAL.orange, 1);
}

export function lion(ctx: Ctx, w: number, h: number, phase: number): void {
  const cx = w / 2, by = h - 6;
  const s = Math.sin(phase * Math.PI * 2);
  for (const [lx, sw] of [[-14, s], [-6, -s], [8, -s], [16, s]] as [number, number][]) {
    hose(ctx, cx + lx, by - 14, cx + lx + sw * 3, by - 8, cx + lx + sw * 5, by - 2, 4.5, '#e0a040');
  }
  ellipse(ctx, cx, by - 18, 20, 10);
  fillInk(ctx, shade(ctx, cx, by - 18, 20, '#f8c870', '#c8862a'), 2.4);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(cx - 20, by - 20);
  ctx.quadraticCurveTo(cx - 32, by - 30 + s * 3, cx - 30, by - 14);
  ctx.stroke();
  // mane + face
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    circle(ctx, cx + 16 + Math.cos(a) * 11, by - 28 + Math.sin(a) * 11, 5);
    fillInk(ctx, '#a8521a', 1.6);
  }
  circle(ctx, cx + 16, by - 28, 9);
  fillInk(ctx, '#f8c870', 2.2);
  pieEye(ctx, cx + 13, by - 31, 2, 2.6, 0.6, 0, { lid: 0.5, lidSide: 1 });
  pieEye(ctx, cx + 20, by - 31, 2, 2.6, 0.6, 0, { lid: 0.5, lidSide: -1 });
  grin(ctx, cx + 17, by - 26, 10, 2.4, 4, '#5a1018', 1.2);
}

export function elephant(ctx: Ctx, w: number, h: number, phase: number): void {
  const cx = w / 2, by = h - 6;
  const s = Math.sin(phase * Math.PI * 2);
  for (const [lx, sw] of [[-16, s], [-6, -s], [8, -s], [18, s]] as [number, number][]) {
    roundRect(ctx, cx + lx - 4 + sw * 2, by - 18, 9, 18, 3);
    fillInk(ctx, '#9aa4b8', 2);
  }
  ellipse(ctx, cx, by - 26, 26, 16);
  fillInk(ctx, shade(ctx, cx, by - 26, 26, '#c8d0e0', '#7a8498'), 2.6);
  // circus blanket
  roundRect(ctx, cx - 14, by - 40, 24, 14, 3);
  fillInk(ctx, PAL.red, 2);
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(cx - 14, by - 30, 24, 3);
  circle(ctx, cx + 22, by - 32, 12);
  fillInk(ctx, '#b0bacc', 2.4);
  ellipse(ctx, cx + 14, by - 32, 7, 10);
  fillInk(ctx, '#9aa4b8', 2);
  hose(ctx, cx + 30, by - 30, cx + 40, by - 22 + s * 4, cx + 36, by - 10, 6, '#b0bacc');
  pieEye(ctx, cx + 25, by - 36, 2.2, 2.8, 0.6, 0);
  // little fez
  roundRect(ctx, cx + 19, by - 50, 8, 7, 1.5);
  fillInk(ctx, PAL.red, 1.6);
}

export function acrobat(ctx: Ctx, w: number, h: number, phase: number): void {
  const cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(phase * Math.PI * 2);
  ctx.translate(-cx, -cy);
  hose(ctx, cx, cy, cx - 6, cy + 8, cx - 4, cy + 16, 3.6, '#f2e6cc');
  hose(ctx, cx, cy, cx + 6, cy + 8, cx + 5, cy + 16, 3.6, '#f2e6cc');
  ellipse(ctx, cx, cy - 2, 7, 9);
  fillInk(ctx, '#3fb0c0', 2);
  ctx.fillStyle = PAL.yellow;
  ctx.fillRect(cx - 7, cy - 3, 14, 2.4);
  glove(ctx, cx - 10, cy - 6, 3, Math.PI);
  glove(ctx, cx + 10, cy - 6, 3, 0);
  circle(ctx, cx, cy - 14, 6);
  fillInk(ctx, '#fffaf0', 2);
  pieEye(ctx, cx - 2, cy - 15, 1.6, 2, 0.4, 0);
  pieEye(ctx, cx + 2.4, cy - 15, 1.6, 2, 0.4, 0);
  circle(ctx, cx + 0.5, cy - 12.5, 1.4);
  ctx.fillStyle = PAL.red;
  ctx.fill();
  ctx.restore();
}

export function mirrorFrame(ctx: Ctx, w: number, h: number): void {
  // Ornate funhouse-mirror oval frame (clone halo)
  const cx = w / 2, cy = h / 2;
  ellipse(ctx, cx, cy, w * 0.45, h * 0.47);
  ink(ctx, 6);
  ctx.stroke();
  ctx.strokeStyle = PAL.gold;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    circle(ctx, cx + Math.cos(a) * w * 0.45, cy + Math.sin(a) * h * 0.47, 2.6);
    fillInk(ctx, '#fff6c8', 1.2);
  }
}

// ---------------------------------------------------------------- enemy bullets (danger colours)
export function enemyBullet(ctx: Ctx, w: number, h: number, kind: string): void {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.42;
  const glow = (col: string) => {
    const g = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.2);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(255,60,30,0)');
    ctx.fillStyle = g;
    circle(ctx, cx, cy, r * 1.2);
    ctx.fill();
  };
  switch (kind) {
    case 'pie':
      ellipse(ctx, cx, cy, r, r * 0.8);
      fillInk(ctx, '#e8c873', 2);
      ellipse(ctx, cx, cy - 1, r * 0.75, r * 0.55);
      fillInk(ctx, '#fffaf0', 1.5);
      ctx.fillStyle = DANGER;
      circle(ctx, cx, cy - 2, r * 0.22);
      ctx.fill();
      break;
    case 'musket':
    case 'spiral':
    case 'ring':
    case 'bolt':
    case 'note':
      glow('rgba(255,90,40,0.7)');
      circle(ctx, cx, cy, r * 0.62);
      fillInk(ctx, shade(ctx, cx, cy, r * 0.6, '#fff0a0', kind === 'ring' ? '#ff3a7a' : DANGER), 2);
      break;
    case 'hellfire':
      glow('rgba(255,120,20,0.85)');
      circle(ctx, cx, cy, r * 0.6);
      fillInk(ctx, shade(ctx, cx, cy, r * 0.6, '#ffffc0', '#ff5a00'), 2);
      break;
    case 'spark':
      glow('rgba(255,240,80,0.8)');
      ctx.fillStyle = '#fff36a';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = i % 2 ? r * 0.3 : r * 0.8;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
      fillInk(ctx, '#ffd23a', 1.4);
      break;
    case 'ticket':
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(0.4);
      roundRect(ctx, -r, -r * 0.45, r * 2, r * 0.9, 1.5);
      fillInk(ctx, '#ffe9a0', 1.6);
      ctx.fillStyle = DANGER;
      ctx.fillRect(-r * 0.2, -r * 0.45, r * 0.4, r * 0.9);
      ctx.restore();
      break;
    case 'popcorn':
      for (const [x, y, rr] of [[-0.3, -0.1, 0.45], [0.25, -0.2, 0.42], [0.05, 0.3, 0.45]] as [number, number, number][]) {
        circle(ctx, cx + x * r, cy + y * r, rr * r);
        fillInk(ctx, '#fff6dc', 1.4);
      }
      ctx.fillStyle = DANGER;
      circle(ctx, cx, cy, r * 0.2);
      ctx.fill();
      break;
    case 'star': {
      // pennant flag
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r * 0.7);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx - r, cy + r * 0.7);
      ctx.closePath();
      fillInk(ctx, shade(ctx, cx, cy, r, '#ffd06a', DANGER), 2);
      break;
    }
    case 'crown':
      glow('rgba(255,210,60,0.7)');
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r * 0.5);
      ctx.lineTo(cx - r, cy - r * 0.5);
      ctx.lineTo(cx - r * 0.5, cy);
      ctx.lineTo(cx, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.5, cy);
      ctx.lineTo(cx + r, cy - r * 0.5);
      ctx.lineTo(cx + r, cy + r * 0.5);
      ctx.closePath();
      fillInk(ctx, shade(ctx, cx, cy, r, '#fff3a0', PAL.gold), 2.4);
      break;
    case 'spoke':
      ctx.save();
      ctx.translate(cx, cy);
      roundRect(ctx, -r, -r * 0.18, r * 2, r * 0.36, 2);
      fillInk(ctx, shade(ctx, 0, 0, r, '#ffb0a0', '#c82a1a'), 2.4);
      circle(ctx, 0, 0, r * 0.28);
      fillInk(ctx, '#fff0a0', 1.6);
      ctx.restore();
      break;
    default:
      glow('rgba(255,90,40,0.7)');
      circle(ctx, cx, cy, r * 0.6);
      fillInk(ctx, DANGER, 2);
  }
}

// ---------------------------------------------------------------- particles
export function particle(ctx: Ctx, w: number, h: number, kind: string, v = 0): void {
  const cx = w / 2, cy = h / 2;
  switch (kind) {
    case 'confetti': {
      const cols = ['#ff5a7a', '#ffd23a', '#4fd6e0', '#9be15d', '#c890ff', '#ff9a3a'];
      ctx.fillStyle = cols[v % cols.length];
      ctx.fillRect(cx - w * 0.35, cy - h * 0.18, w * 0.7, h * 0.36);
      break;
    }
    case 'latex':
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.4, cy);
      ctx.quadraticCurveTo(cx, cy - h * 0.5, cx + w * 0.4, cy - h * 0.1);
      ctx.quadraticCurveTo(cx, cy + h * 0.2, cx - w * 0.4, cy);
      fillInk(ctx, ['#e8384f', '#d42a8a'][v % 2], 1.2);
      break;
    case 'stuffing':
      for (const [x, y, r] of [[-0.15, 0, 0.3], [0.15, -0.1, 0.28], [0.05, 0.15, 0.25]] as [number, number, number][]) {
        circle(ctx, cx + x * w, cy + y * h, r * w);
        ctx.fillStyle = '#fffaf0';
        ctx.fill();
      }
      ink(ctx, 1);
      circle(ctx, cx, cy, w * 0.35);
      ctx.stroke();
      break;
    case 'button':
      circle(ctx, cx, cy, w * 0.35);
      fillInk(ctx, '#1a1418', 1.2);
      ctx.fillStyle = '#fffaf0';
      circle(ctx, cx - 1, cy, 0.8);
      ctx.fill();
      circle(ctx, cx + 1, cy, 0.8);
      ctx.fill();
      break;
    case 'spring':
      ink(ctx, 1.6);
      ctx.strokeStyle = '#c0c8cc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) ctx.lineTo(cx + (i % 2 ? 4 : -4), cy - h * 0.35 + i * h * 0.12);
      ctx.stroke();
      break;
    case 'gear': {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = i % 2 ? w * 0.28 : w * 0.4;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      fillInk(ctx, PAL.brass, 1.2);
      circle(ctx, cx, cy, w * 0.1);
      ctx.fillStyle = INK;
      ctx.fill();
      break;
    }
    case 'star':
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? w * 0.18 : w * 0.45;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      fillInk(ctx, '#ffe36a', 1.2);
      break;
    case 'sugar':
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(0.785);
      ctx.fillStyle = ['#ffd6ec', '#ffffff', '#ff9ac8'][v % 3];
      ctx.fillRect(-w * 0.25, -h * 0.25, w * 0.5, h * 0.5);
      ctx.restore();
      break;
    case 'splinter':
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(0.6);
      roundRect(ctx, -w * 0.4, -h * 0.1, w * 0.8, h * 0.2, 1);
      fillInk(ctx, ['#c89a5a', '#9a4ad0', '#d0384a'][v % 3], 1);
      ctx.restore();
      break;
    case 'shard':
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.3, cy + h * 0.3);
      ctx.lineTo(cx, cy - h * 0.4);
      ctx.lineTo(cx + w * 0.35, cy + h * 0.2);
      ctx.closePath();
      fillInk(ctx, ['#fffaf0', '#4fd6e0', '#f6cf4f'][v % 3], 1);
      break;
    case 'board':
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(0.3);
      ctx.fillRect(0, 0, 0, 0);
      roundRect(ctx, -w * 0.42, -h * 0.14, w * 0.84, h * 0.28, 1);
      fillInk(ctx, v % 2 ? '#c8322d' : '#f2e6cc', 1.2);
      ctx.restore();
      break;
    case 'smoke': {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
      g.addColorStop(0, 'rgba(220,210,230,0.9)');
      g.addColorStop(1, 'rgba(160,150,180,0)');
      ctx.fillStyle = g;
      circle(ctx, cx, cy, w * 0.5);
      ctx.fill();
      break;
    }
    case 'glow': {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      circle(ctx, cx, cy, w * 0.5);
      ctx.fill();
      break;
    }
    case 'spark': {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx + w * 0.1, cy);
      ctx.lineTo(cx, h);
      ctx.lineTo(cx - w * 0.1, cy);
      ctx.closePath();
      ctx.moveTo(0, cy);
      ctx.lineTo(cx, cy - h * 0.1);
      ctx.lineTo(w, cy);
      ctx.lineTo(cx, cy + h * 0.1);
      ctx.closePath();
      ctx.fill();
      circle(ctx, cx, cy, w * 0.22);
      ctx.fill();
      break;
    }
    case 'ring': {
      circle(ctx, cx, cy, w * 0.44);
      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.lineWidth = w * 0.06;
      ctx.stroke();
      break;
    }
    case 'droplet':
      ellipse(ctx, cx, cy, w * 0.25, h * 0.35);
      fillInk(ctx, '#7fc4f0', 1);
      break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.3, cy + h * 0.35);
      ctx.quadraticCurveTo(cx - w * 0.35, cy - h * 0.05, cx, cy - h * 0.45);
      ctx.quadraticCurveTo(cx + w * 0.35, cy - h * 0.05, cx + w * 0.3, cy + h * 0.35);
      ctx.closePath();
      ctx.fillStyle = shade(ctx, cx, cy, w * 0.4, '#fff36a', '#ff5a1a');
      ctx.fill();
      break;
    case 'snow':
      ink(ctx, 1.4);
      ctx.strokeStyle = '#e8f8ff';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * w * 0.4, cy - Math.sin(a) * h * 0.4);
        ctx.lineTo(cx + Math.cos(a) * w * 0.4, cy + Math.sin(a) * h * 0.4);
        ctx.stroke();
      }
      break;
    case 'note':
      ctx.fillStyle = '#ffe36a';
      ellipse(ctx, cx - w * 0.1, cy + h * 0.22, w * 0.22, h * 0.16, -0.4);
      ctx.fill();
      ctx.fillRect(cx + w * 0.08, cy - h * 0.38, w * 0.06, h * 0.6);
      break;
  }
}

/** Damage-number digit glyph (0-9 and '!'). */
export function digit(ctx: Ctx, w: number, h: number, ch: string, crit: boolean): void {
  ctx.font = `${crit ? 'bold ' : ''}${h * 0.92}px "Rye", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = h * 0.22;
  ctx.strokeStyle = INK;
  ctx.strokeText(ch, w / 2, h / 2 + 1);
  ctx.fillStyle = crit ? '#ffe03a' : '#fffaf0';
  ctx.fillText(ch, w / 2, h / 2 + 1);
}
