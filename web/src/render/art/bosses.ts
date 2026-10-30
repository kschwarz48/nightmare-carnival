// Boss artwork (doc 05) — cut-out parts assembled and animated by the renderer.

import { DANGER, INK, PAL, artRng, bulb, circle, ellipse, fillInk, glove, grin, hose, ink, lighten, pieEye, roundRect, shade, shine, shoe, vstripes, type Ctx } from './kit';

// ================================================================= THE CARNIVAL TENT
/** Main canvas body of the big top (w 320 × h 280), base at bottom. */
export function tentBody(ctx: Ctx, w: number, h: number, awake: boolean): void {
  const cx = w / 2, base = h - 20;
  // shadowy interior door frame
  ctx.beginPath();
  ctx.moveTo(cx - 140, base);
  ctx.lineTo(cx - 128, base - 120);
  ctx.quadraticCurveTo(cx - 70, base - 150, cx, base - 228);
  ctx.quadraticCurveTo(cx + 70, base - 150, cx + 128, base - 120);
  ctx.lineTo(cx + 140, base);
  ctx.quadraticCurveTo(cx, base + 16, cx - 140, base);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  vstripes(ctx, cx - 150, base - 240, 300, 260, awake ? '#c8322d' : '#a83a35', awake ? '#f2e6cc' : '#d8cbb0', 12);
  // canvas fold shading
  const g = ctx.createLinearGradient(cx - 150, 0, cx + 150, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.35)');
  g.addColorStop(0.45, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - 150, base - 240, 300, 260);
  // patches + rips
  ctx.fillStyle = '#7a6a50';
  roundRect(ctx, cx - 96, base - 70, 22, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#1a0e10';
  ctx.beginPath();
  ctx.moveTo(cx + 70, base - 90);
  ctx.lineTo(cx + 84, base - 70);
  ctx.lineTo(cx + 74, base - 72);
  ctx.lineTo(cx + 82, base - 52);
  ctx.lineTo(cx + 66, base - 74);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ink(ctx, 4.5);
  ctx.beginPath();
  ctx.moveTo(cx - 140, base);
  ctx.lineTo(cx - 128, base - 120);
  ctx.quadraticCurveTo(cx - 70, base - 150, cx, base - 228);
  ctx.quadraticCurveTo(cx + 70, base - 150, cx + 128, base - 120);
  ctx.lineTo(cx + 140, base);
  ctx.quadraticCurveTo(cx, base + 16, cx - 140, base);
  ctx.closePath();
  ctx.stroke();
  // scalloped valance with bulbs
  ctx.beginPath();
  ctx.moveTo(cx - 130, base - 118);
  for (let i = 0; i < 10; i++) {
    const x0 = cx - 130 + i * 26;
    ctx.quadraticCurveTo(x0 + 13, base - 96, x0 + 26, base - 118);
  }
  ctx.lineTo(cx + 130, base - 128);
  ctx.quadraticCurveTo(cx, base - 160, cx - 130, base - 128);
  ctx.closePath();
  fillInk(ctx, awake ? '#3a1a5a' : '#2e2440', 3);
  for (let i = 0; i < 10; i++) bulb(ctx, cx - 117 + i * 26, base - 106, 3.4, i % 2 ? '#ffd36a' : '#ff6aa0', awake || i % 3 !== 0);
  // peak pennant + pole
  ink(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(cx, base - 228);
  ctx.lineTo(cx, base - 262);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, base - 262);
  ctx.lineTo(cx + 30, base - 254);
  ctx.lineTo(cx, base - 244);
  ctx.closePath();
  fillInk(ctx, PAL.yellow, 2);
  // marquee sign
  roundRect(ctx, cx - 70, base - 190, 140, 30, 8);
  fillInk(ctx, '#2a1430', 3);
  ctx.font = '18px "Rye", Georgia';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = awake ? '#ff4a5a' : PAL.gold;
  ctx.fillText(awake ? 'BIG TOP!!' : 'BIG TOP', cx, base - 174);
}

/** The canvas maw (open amount 0..1) — pennant-flag teeth. */
export function tentMaw(ctx: Ctx, w: number, h: number, open: number, hot = false): void {
  const cx = w / 2, cy = h * 0.42;
  const mh = 18 + open * 62;
  ctx.beginPath();
  ctx.moveTo(cx - 70, cy);
  ctx.quadraticCurveTo(cx, cy - mh * 0.55, cx + 70, cy);
  ctx.quadraticCurveTo(cx, cy + mh * 1.3, cx - 70, cy);
  ctx.closePath();
  const g = ctx.createRadialGradient(cx, cy + mh * 0.3, 4, cx, cy + mh * 0.3, 80);
  g.addColorStop(0, hot ? '#ffcf4a' : '#5a0f1a');
  g.addColorStop(1, hot ? '#c8322d' : '#12040a');
  fillInk(ctx, g, 4);
  // pennant teeth top & bottom
  const cols = ['#f6cf4f', '#4fd6e0', '#ff7bb0', '#9be15d'];
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    const x = cx - 64 + t * 128;
    const yTop = cy - mh * 0.55 * Math.sin(Math.PI * t) * 0.5 - 2;
    ctx.beginPath();
    ctx.moveTo(x - 7, yTop);
    ctx.lineTo(x + 7, yTop);
    ctx.lineTo(x, yTop + 14 + open * 6);
    ctx.closePath();
    fillInk(ctx, cols[i % 4], 2);
    const yBot = cy + mh * 1.3 * Math.sin(Math.PI * t) * 0.5 + 2;
    ctx.beginPath();
    ctx.moveTo(x - 7, yBot);
    ctx.lineTo(x + 7, yBot);
    ctx.lineTo(x, yBot - 12 - open * 6);
    ctx.closePath();
    fillInk(ctx, cols[(i + 2) % 4], 2);
  }
  if (open > 0.6) {
    // uvula-like hanging pennant string
    ink(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + mh * 0.5);
    ctx.stroke();
  }
}

/** Two window-eyes on the canvas. state 0 closed, 1 open, 2 furious. */
export function tentEyes(ctx: Ctx, w: number, h: number, state: number): void {
  const cy = h / 2;
  for (const side of [-1, 1]) {
    const x = w / 2 + side * 46;
    if (state === 0) {
      ink(ctx, 4);
      ctx.beginPath();
      ctx.moveTo(x - 20, cy);
      ctx.quadraticCurveTo(x, cy + 10, x + 20, cy);
      ctx.stroke();
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * 10, cy + 5);
        ctx.lineTo(x + k * 12, cy + 12);
        ctx.stroke();
      }
    } else {
      pieEye(ctx, x, cy, 18, 22, side * -0.4, 0.3, { lid: state === 2 ? 0.6 : 0.25, lidSide: -side, glow: state === 2 ? '#ffe36a' : '#fff6dc', lw: 4 });
    }
  }
}

/** A striped tent-pole leg ending in a giant boot (w 70 × h 170, top at y=0). */
export function tentLeg(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  roundRect(ctx, cx - 11, 0, 22, h - 34, 9);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#f2e6cc';
  ctx.fillRect(cx - 12, 0, 24, h);
  ctx.fillStyle = '#c8322d';
  for (let y = -10; y < h; y += 24) {
    ctx.beginPath();
    ctx.moveTo(cx - 12, y);
    ctx.lineTo(cx + 12, y + 12);
    ctx.lineTo(cx + 12, y + 24);
    ctx.lineTo(cx - 12, y + 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ink(ctx, 3.5);
  roundRect(ctx, cx - 11, 0, 22, h - 34, 9);
  ctx.stroke();
  shoe(ctx, cx - 4, h - 22, 20, '#3a1d14');
}

export function tentFire(ctx: Ctx, w: number, h: number, phase: number): void {
  const r = artRng(7 + Math.floor(phase * 10));
  for (let i = 0; i < 14; i++) {
    const x = 20 + r() * (w - 40), y = h * 0.35 + r() * h * 0.55;
    const s = 10 + r() * 16;
    flame(ctx, x, y, s, phase + i);
  }
}

export function flame(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  const wob = Math.sin(t * 7) * 0.2;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y);
  ctx.quadraticCurveTo(x - s * 0.6, y - s * 0.8, x + wob * s, y - s * 1.6);
  ctx.quadraticCurveTo(x + s * 0.6, y - s * 0.8, x + s * 0.5, y);
  ctx.closePath();
  fillInk(ctx, shade(ctx, x, y - s * 0.5, s, '#fff36a', '#ff5a1a'), 2);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.22, y);
  ctx.quadraticCurveTo(x, y - s * 0.9, x + s * 0.22, y);
  ctx.closePath();
  ctx.fillStyle = '#fffbe0';
  ctx.fill();
}

export function tentWreck(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, base = h - 16;
  ctx.beginPath();
  ctx.moveTo(cx - 150, base);
  ctx.quadraticCurveTo(cx - 120, base - 60, cx - 40, base - 70);
  ctx.quadraticCurveTo(cx + 10, base - 100, cx + 60, base - 60);
  ctx.quadraticCurveTo(cx + 140, base - 50, cx + 150, base);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  vstripes(ctx, cx - 160, base - 110, 320, 120, '#7a2a28', '#a89880', 12);
  ctx.restore();
  ink(ctx, 4);
  ctx.beginPath();
  ctx.moveTo(cx - 150, base);
  ctx.quadraticCurveTo(cx - 120, base - 60, cx - 40, base - 70);
  ctx.quadraticCurveTo(cx + 10, base - 100, cx + 60, base - 60);
  ctx.quadraticCurveTo(cx + 140, base - 50, cx + 150, base);
  ctx.closePath();
  ctx.stroke();
  // broken poles
  ink(ctx, 5);
  ctx.strokeStyle = PAL.woodDark;
  ctx.beginPath();
  ctx.moveTo(cx - 20, base - 70);
  ctx.lineTo(cx - 50, base - 130);
  ctx.moveTo(cx + 40, base - 60);
  ctx.lineTo(cx + 85, base - 108);
  ctx.stroke();
  pieEye(ctx, cx - 30, base - 40, 10, 12, 0, 0, { dead: true });
  pieEye(ctx, cx + 30, base - 44, 10, 12, 0, 0, { dead: true });
}

// ================================================================= THE FERRIS WHEEL
export function ferrisRim(ctx: Ctx, w: number, h: number, lights: number): void {
  const cx = w / 2, cy = h / 2, R = w / 2 - 14;
  ink(ctx, 6);
  ctx.strokeStyle = '#4a3a50';
  // spokes
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ink(ctx, 6);
    ctx.stroke();
    ctx.strokeStyle = '#8a7a90';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // double rim
  for (const rr of [R, R - 16]) {
    circle(ctx, cx, cy, rr);
    ink(ctx, 9);
    ctx.stroke();
    ctx.strokeStyle = '#b8a0c0';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  // cross bracing
  ink(ctx, 2);
  ctx.strokeStyle = '#6a5a70';
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const b = ((i + 1) / 20) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.lineTo(cx + Math.cos(b) * (R - 16), cy + Math.sin(b) * (R - 16));
    ctx.stroke();
  }
  // bulbs
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const on = lights > 0.05 && (i / 30 < lights || i % 3 === 0);
    bulb(ctx, cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8), 3.4, lights > 0.6 ? '#ff4a4a' : i % 2 ? '#ffd36a' : '#ff6aa0', on);
  }
}

export function ferrisHub(ctx: Ctx, w: number, h: number, angry: boolean): void {
  const cx = w / 2, cy = h / 2;
  circle(ctx, cx, cy, 34);
  fillInk(ctx, shade(ctx, cx, cy, 34, '#e8d8b0', '#9a8058'), 4);
  // face
  pieEye(ctx, cx - 12, cy - 6, 8, 10, 0, 0.3, { lid: angry ? 0.6 : 0.2, lidSide: 1, glow: angry ? '#ff7a5a' : undefined });
  pieEye(ctx, cx + 12, cy - 6, 8, 10, 0, 0.3, { lid: angry ? 0.6 : 0.2, lidSide: -1, glow: angry ? '#ff7a5a' : undefined });
  grin(ctx, cx, cy + 10, 34, 6, 8, '#3a0b10', 2.4);
  // bolts
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    circle(ctx, cx + Math.cos(a) * 29, cy + Math.sin(a) * 29, 2.2);
    fillInk(ctx, '#c8b890', 1.2);
  }
}

export function ferrisGondola(ctx: Ctx, w: number, h: number, open: boolean, hue = 0): void {
  const cx = w / 2;
  const cols = ['#c8322d', '#3f7fd0', '#f6cf4f', '#4f9a3a', '#e98fb4'];
  const col = cols[hue % cols.length];
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, 8);
  ctx.stroke();
  // roof
  ctx.beginPath();
  ctx.moveTo(cx - 20, 14);
  ctx.quadraticCurveTo(cx, 2, cx + 20, 14);
  ctx.closePath();
  fillInk(ctx, lighten(col, -0.2), 2.5);
  // car
  roundRect(ctx, cx - 18, 14, 36, 30, 7);
  fillInk(ctx, shade(ctx, cx, 28, 20, lighten(col, 0.3), col), 3);
  // door/window face
  roundRect(ctx, cx - 12, 18, 24, 16, 4);
  fillInk(ctx, open ? '#1a0408' : '#ffe9b0', 2);
  if (open) {
    pieEye(ctx, cx - 5, 23, 3, 3.6, 0, 0.4, { glow: '#ffef8a' });
    pieEye(ctx, cx + 5, 23, 3, 3.6, 0, 0.4, { glow: '#ffef8a' });
    ellipse(ctx, cx, 30.5, 4, 3);
    fillInk(ctx, '#ff4a2a', 1.4);
  }
}

export function ferrisStand(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  ink(ctx, 10);
  ctx.strokeStyle = '#3a2e44';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, 20);
    ctx.lineTo(cx + side * 120, h - 10);
    ctx.stroke();
  }
  ink(ctx, 5);
  ctx.strokeStyle = '#7a6a80';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, 20);
    ctx.lineTo(cx + side * 120, h - 10);
    ctx.stroke();
  }
  ink(ctx, 4);
  ctx.beginPath();
  ctx.moveTo(cx - 70, h * 0.62);
  ctx.lineTo(cx + 70, h * 0.62);
  ctx.moveTo(cx - 40, h * 0.36);
  ctx.lineTo(cx + 40, h * 0.36);
  ctx.stroke();
  circle(ctx, cx, 20, 12);
  fillInk(ctx, '#6a5a70', 3);
  // ticket hut at the base
  roundRect(ctx, cx - 30, h - 46, 60, 40, 4);
  ctx.save();
  ctx.clip();
  vstripes(ctx, cx - 30, h - 46, 60, 40, '#c8322d', '#f2e6cc', 6);
  ctx.restore();
  ink(ctx, 3);
  roundRect(ctx, cx - 30, h - 46, 60, 40, 4);
  ctx.stroke();
}

export function ferrisWreck(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h * 0.6;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.45);
  ink(ctx, 8);
  ctx.strokeStyle = '#4a3a50';
  circle(ctx, 0, 0, 120);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 120, Math.sin(a) * 120);
    ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(cx - 90 + i * 60, cy + 20 - (i % 2) * 30);
    ctx.rotate(-0.5 + i * 0.4);
    roundRect(ctx, -16, -12, 32, 24, 6);
    fillInk(ctx, ['#c8322d', '#3f7fd0', '#f6cf4f', '#4f9a3a'][i], 2.5);
    ctx.restore();
  }
  pieEye(ctx, cx - 12, cy - 6, 8, 10, 0, 0, { dead: true });
  pieEye(ctx, cx + 12, cy - 6, 8, 10, 0, 0, { dead: true });
}

// ================================================================= THE PUPPET KING
export function pkBody(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  // ermine-trimmed royal robe over a wooden torso
  ctx.beginPath();
  ctx.moveTo(cx - 34, 10);
  ctx.quadraticCurveTo(cx - 54, 70, cx - 46, h - 8);
  ctx.quadraticCurveTo(cx, h + 4, cx + 46, h - 8);
  ctx.quadraticCurveTo(cx + 54, 70, cx + 34, 10);
  ctx.quadraticCurveTo(cx, 0, cx - 34, 10);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx, 50, 50, '#9a4ad0', '#4a1a78'), 4);
  // ermine trim
  ctx.fillStyle = '#fffaf0';
  roundRect(ctx, cx - 48, h - 22, 96, 14, 6);
  ctx.fill();
  ink(ctx, 2.5);
  ctx.stroke();
  ctx.fillStyle = INK;
  for (let i = 0; i < 8; i++) {
    ellipse(ctx, cx - 40 + i * 11.5, h - 15, 1.4, 2.6);
    ctx.fill();
  }
  // wooden chest plate with painted heart medal
  roundRect(ctx, cx - 18, 16, 36, 40, 8);
  fillInk(ctx, shade(ctx, cx, 34, 22, '#e8b878', '#a8743a'), 3);
  ink(ctx, 1.4);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 14, 22 + i * 9);
    ctx.quadraticCurveTo(cx, 24 + i * 9, cx + 14, 22 + i * 9);
    ctx.stroke();
  }
  circle(ctx, cx, 36, 7);
  fillInk(ctx, PAL.gold, 2);
  ctx.fillStyle = PAL.red;
  ctx.beginPath();
  ctx.moveTo(cx, 40);
  ctx.bezierCurveTo(cx - 6, 35, cx - 3, 31, cx, 34);
  ctx.bezierCurveTo(cx + 3, 31, cx + 6, 35, cx, 40);
  ctx.fill();
  // joint pegs
  for (const [jx, jy] of [[cx - 34, 16], [cx + 34, 16]] as [number, number][]) {
    circle(ctx, jx, jy, 5);
    fillInk(ctx, PAL.woodDark, 2);
  }
}

export function pkHead(ctx: Ctx, w: number, h: number, crown: boolean, mad: boolean): void {
  const cx = w / 2, cy = h * 0.6;
  // hinged jaw
  roundRect(ctx, cx - 18, cy + 8, 36, 18, 6);
  fillInk(ctx, shade(ctx, cx, cy + 16, 18, '#f0c890', '#b88050'), 3);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy + 10);
  ctx.lineTo(cx - 18, cy + 24);
  ctx.moveTo(cx + 18, cy + 10);
  ctx.lineTo(cx + 18, cy + 24);
  ctx.stroke();
  circle(ctx, cx, cy, 26);
  fillInk(ctx, shade(ctx, cx, cy, 26, '#f8dcb0', '#c89060'), 3.5);
  // painted rosy cheeks
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#e83a4a';
  circle(ctx, cx - 16, cy + 6, 6);
  ctx.fill();
  circle(ctx, cx + 16, cy + 6, 6);
  ctx.fill();
  ctx.restore();
  pieEye(ctx, cx - 9, cy - 5, 6, 7.5, 0, 0.3, { lid: mad ? 0.7 : 0.4, lidSide: 1, glow: mad ? '#ffe36a' : undefined });
  pieEye(ctx, cx + 9, cy - 5, 6, 7.5, 0, 0.3, { lid: mad ? 0.7 : 0.4, lidSide: -1, glow: mad ? '#ffe36a' : undefined });
  // painted sneer
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 12);
  ctx.quadraticCurveTo(cx, cy + 6, cx + 14, cy + 14);
  ctx.stroke();
  // curly painted mustache
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 7);
  ctx.bezierCurveTo(cx - 8, cy + 3, cx - 18, cy + 8, cx - 16, cy + 13);
  ctx.bezierCurveTo(cx - 12, cy + 8, cx - 6, cy + 9, cx, cy + 9);
  ctx.bezierCurveTo(cx + 6, cy + 9, cx + 12, cy + 8, cx + 16, cy + 13);
  ctx.bezierCurveTo(cx + 18, cy + 8, cx + 8, cy + 3, cx, cy + 7);
  ctx.fill();
  if (crown) drawCrown(ctx, cx + 4, cy - 24, 1);
}

export function drawCrown(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.18);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-18, 8);
  ctx.lineTo(-20, -10);
  ctx.lineTo(-10, -2);
  ctx.lineTo(0, -16);
  ctx.lineTo(10, -2);
  ctx.lineTo(20, -10);
  ctx.lineTo(18, 8);
  ctx.closePath();
  fillInk(ctx, shade(ctx, 0, -2, 18, '#fff3a0', PAL.gold), 3);
  for (const [gx, gy, c] of [[-10, 3, PAL.red], [0, 2, '#4fd6e0'], [10, 3, '#9be15d']] as [number, number, string][]) {
    circle(ctx, gx, gy, 2.6);
    fillInk(ctx, c, 1.4);
  }
  ctx.restore();
}

/** Wooden arm with glove (w 30 × h 90, pivot at top). */
export function pkArm(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  roundRect(ctx, cx - 7, 2, 14, 38, 6);
  fillInk(ctx, shade(ctx, cx, 20, 10, '#9a4ad0', '#4a1a78'), 2.6);
  circle(ctx, cx, 42, 5);
  fillInk(ctx, PAL.woodDark, 2);
  roundRect(ctx, cx - 6, 42, 12, 32, 5);
  fillInk(ctx, shade(ctx, cx, 58, 10, '#e8b878', '#a8743a'), 2.6);
  glove(ctx, cx, h - 10, 9, Math.PI / 2);
}

export function pkLeg(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  roundRect(ctx, cx - 7, 2, 14, 34, 6);
  fillInk(ctx, shade(ctx, cx, 18, 10, '#f2e6cc', '#c8b898'), 2.6);
  circle(ctx, cx, 38, 5);
  fillInk(ctx, PAL.woodDark, 2);
  roundRect(ctx, cx - 6, 38, 12, 28, 5);
  fillInk(ctx, shade(ctx, cx, 50, 10, '#f2e6cc', '#c8b898'), 2.6);
  shoe(ctx, cx + 2, h - 10, 10, '#c8322d');
}

export function pkCrossbar(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  roundRect(ctx, cx - 70, cy - 7, 140, 14, 5);
  fillInk(ctx, shade(ctx, cx, cy, 70, '#c89a5a', '#7a5228'), 3);
  roundRect(ctx, cx - 7, cy - 40, 14, 80, 5);
  fillInk(ctx, shade(ctx, cx, cy, 40, '#c89a5a', '#7a5228'), 3);
  for (const [x, y] of [[-66, 0], [66, 0], [0, -36], [0, 36]] as [number, number][]) {
    circle(ctx, cx + x, cy + y, 4);
    fillInk(ctx, PAL.brass, 1.6);
  }
}

export function pkWreck(ctx: Ctx, w: number, h: number): void {
  const r = artRng(42);
  for (let i = 0; i < 9; i++) {
    ctx.save();
    ctx.translate(20 + r() * (w - 40), h * 0.5 + r() * h * 0.35);
    ctx.rotate(r() * Math.PI * 2);
    roundRect(ctx, -6, -18, 12, 36, 5);
    fillInk(ctx, i % 2 ? '#9a4ad0' : '#e8b878', 2.4);
    ctx.restore();
  }
  drawCrown(ctx, w * 0.6, h * 0.55, 1.2);
  ink(ctx, 1);
  ctx.strokeStyle = '#e8e2d8';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(r() * w, r() * h);
    ctx.bezierCurveTo(r() * w, r() * h, r() * w, r() * h, r() * w, r() * h);
    ctx.stroke();
  }
}

// ================================================================= THE RINGMASTER
export type RMPose = 'idle0' | 'idle1' | 'whip' | 'bow' | 'hat' | 'cane';

/** Human Ringmaster full body (w 150 × h 200, feet at bottom). */
export function ringmasterHuman(ctx: Ctx, w: number, h: number, pose: RMPose): void {
  const cx = w / 2, fy = h - 8;
  const bob = pose === 'idle1' ? 2 : 0;
  ctx.save();
  if (pose === 'bow') {
    ctx.translate(cx, fy - 60);
    ctx.rotate(0.55);
    ctx.translate(-cx, -(fy - 60));
  }
  // legs: striped trousers, spats
  for (const side of [-1, 1]) {
    hose(ctx, cx + side * 9, fy - 70, cx + side * 11, fy - 40, cx + side * 13, fy - 12, 9, '#2a2230');
    shoe(ctx, cx + side * 13, fy - 7, 11, '#1a1418');
  }
  // tailcoat
  ctx.beginPath();
  ctx.moveTo(cx - 26, fy - 128 + bob);
  ctx.quadraticCurveTo(cx - 40, fy - 90, cx - 38, fy - 40);
  ctx.lineTo(cx - 18, fy - 62);
  ctx.lineTo(cx + 18, fy - 62);
  ctx.lineTo(cx + 38, fy - 40);
  ctx.quadraticCurveTo(cx + 40, fy - 90, cx + 26, fy - 128 + bob);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx, fy - 95, 40, '#e0384a', '#7a0a18'), 4);
  // waistcoat + shirt
  ctx.beginPath();
  ctx.moveTo(cx - 12, fy - 128 + bob);
  ctx.lineTo(cx, fy - 70);
  ctx.lineTo(cx + 12, fy - 128 + bob);
  ctx.closePath();
  fillInk(ctx, PAL.gold, 2.5);
  for (let i = 0; i < 4; i++) {
    circle(ctx, cx, fy - 118 + i * 12 + bob, 2);
    fillInk(ctx, '#fffaf0', 1.2);
  }
  // gold frogging
  ink(ctx, 2);
  ctx.strokeStyle = PAL.gold;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 24, fy - 116 + i * 10 + bob);
    ctx.lineTo(cx - 14, fy - 116 + i * 10 + bob);
    ctx.moveTo(cx + 24, fy - 116 + i * 10 + bob);
    ctx.lineTo(cx + 14, fy - 116 + i * 10 + bob);
    ctx.stroke();
  }
  // back arm (cane)
  const caneUp = pose === 'cane';
  hose(ctx, cx - 24, fy - 122 + bob, cx - 38, fy - 104, cx - 36, caneUp ? fy - 128 : fy - 86, 8, '#c8283a');
  glove(ctx, cx - 36, caneUp ? fy - 130 : fy - 84, 7, Math.PI / 2);
  ink(ctx, 4);
  ctx.beginPath();
  ctx.moveTo(cx - 36, caneUp ? fy - 130 : fy - 84);
  ctx.lineTo(cx - 40, caneUp ? fy - 70 : fy - 10);
  ctx.stroke();
  ctx.strokeStyle = '#2a1418';
  ctx.lineWidth = 2;
  ctx.stroke();
  circle(ctx, cx - 36, caneUp ? fy - 134 : fy - 88, 4);
  fillInk(ctx, PAL.gold, 1.6);
  // head
  const hy = fy - 148 + bob;
  circle(ctx, cx, hy, 18);
  fillInk(ctx, shade(ctx, cx, hy, 18, '#fbe0c4', '#d8a888'), 3.5);
  pieEye(ctx, cx - 6, hy - 4, 4.4, 5.6, 0.4, 0.2, { lid: 0.45, lidSide: 1 });
  pieEye(ctx, cx + 7, hy - 4, 4.4, 5.6, 0.4, 0.2, { lid: 0.45, lidSide: -1 });
  grin(ctx, cx + 1, hy + 6, 20, 3.6, 7, '#5a0a14', 2);
  // curled mustache + goatee
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx, hy + 4);
  ctx.bezierCurveTo(cx - 9, hy, cx - 22, hy + 2, cx - 20, hy - 6);
  ctx.bezierCurveTo(cx - 16, hy + 4, cx - 6, hy + 6, cx, hy + 6);
  ctx.bezierCurveTo(cx + 6, hy + 6, cx + 16, hy + 4, cx + 20, hy - 6);
  ctx.bezierCurveTo(cx + 22, hy + 2, cx + 9, hy, cx, hy + 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 3, hy + 15);
  ctx.lineTo(cx + 1, hy + 24);
  ctx.lineTo(cx + 4, hy + 15);
  ctx.fill();
  // top hat (tipped in hat pose)
  ctx.save();
  if (pose === 'hat') {
    ctx.translate(cx + 22, hy - 30);
    ctx.rotate(0.6);
    ctx.translate(-(cx + 22), -(hy - 30));
  }
  ellipse(ctx, cx, hy - 16, 22, 5.5);
  fillInk(ctx, '#1a1418', 3);
  roundRect(ctx, cx - 14, hy - 52, 28, 36, 3);
  fillInk(ctx, '#1a1418', 3);
  ctx.fillStyle = PAL.red;
  ctx.fillRect(cx - 13.5, hy - 26, 27, 5);
  shine(ctx, cx - 8, hy - 44, 2.4, 0.4);
  ctx.restore();
  // front arm: whip
  const crack = pose === 'whip';
  const hx = cx + (crack ? 46 : 30), hhy = fy - (crack ? 132 : 92);
  hose(ctx, cx + 24, fy - 122 + bob, cx + 42, fy - 108, hx, hhy, 8, '#c8283a');
  glove(ctx, hx, hhy, 7, crack ? -0.6 : Math.PI / 2);
  ink(ctx, 3);
  ctx.strokeStyle = '#3a2418';
  ctx.beginPath();
  ctx.moveTo(hx, hhy);
  if (crack) ctx.bezierCurveTo(hx + 30, hhy - 30, hx + 50, hhy + 10, hx + 60, hhy - 20);
  else ctx.bezierCurveTo(hx + 10, hhy + 30, hx - 6, hhy + 50, hx + 8, hhy + 70);
  ctx.stroke();
  ctx.restore();
}

/** Demon Ringmaster (taller, horned, coat aflame). */
export function ringmasterDemon(ctx: Ctx, w: number, h: number, pose: RMPose, t = 0): void {
  const cx = w / 2, fy = h - 8;
  const bob = pose === 'idle1' ? 3 : 0;
  // flames behind
  for (let i = 0; i < 9; i++) flame(ctx, cx - 50 + i * 12.5, fy - 40 - (i % 3) * 20, 20 + (i % 2) * 10, t + i);
  for (const side of [-1, 1]) {
    hose(ctx, cx + side * 11, fy - 80, cx + side * 16, fy - 46, cx + side * 15, fy - 14, 10, '#1a0a10');
    // hooves
    ctx.beginPath();
    ctx.moveTo(cx + side * 15 - 9, fy - 14);
    ctx.lineTo(cx + side * 15 + 9, fy - 14);
    ctx.lineTo(cx + side * 15 + 7, fy - 2);
    ctx.lineTo(cx + side * 15 - 7, fy - 2);
    ctx.closePath();
    fillInk(ctx, '#2a1a1a', 2.6);
  }
  // burning coat
  ctx.beginPath();
  ctx.moveTo(cx - 32, fy - 150 + bob);
  ctx.quadraticCurveTo(cx - 52, fy - 100, cx - 48, fy - 34);
  ctx.lineTo(cx - 22, fy - 70);
  ctx.lineTo(cx + 22, fy - 70);
  ctx.lineTo(cx + 48, fy - 34);
  ctx.quadraticCurveTo(cx + 52, fy - 100, cx + 32, fy - 150 + bob);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx, fy - 110, 50, '#a0141e', '#2a0408'), 4);
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 6; i++) flame(ctx, cx - 44 + i * 18, fy - 34, 14, t * 1.3 + i);
  ctx.restore();
  // ribcage-gold waistcoat
  ctx.beginPath();
  ctx.moveTo(cx - 14, fy - 150 + bob);
  ctx.lineTo(cx, fy - 80);
  ctx.lineTo(cx + 14, fy - 150 + bob);
  ctx.closePath();
  fillInk(ctx, '#3a0a10', 2.5);
  ink(ctx, 2);
  ctx.strokeStyle = PAL.gold;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 9 + i * 1.5, fy - 140 + i * 11 + bob);
    ctx.lineTo(cx + 9 - i * 1.5, fy - 140 + i * 11 + bob);
    ctx.stroke();
  }
  // arms: clawed, whip of fire
  hose(ctx, cx - 30, fy - 144 + bob, cx - 54, fy - 120, cx - 52, fy - 96, 9, '#7a0a14');
  claw(ctx, cx - 52, fy - 92);
  const crack = pose === 'whip';
  const hx = cx + (crack ? 58 : 40), hy = fy - (crack ? 150 : 104);
  hose(ctx, cx + 30, fy - 144 + bob, cx + 54, fy - 128, hx, hy, 9, '#7a0a14');
  claw(ctx, hx, hy);
  ink(ctx, 6);
  ctx.strokeStyle = '#ff7a1a';
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  if (crack) ctx.bezierCurveTo(hx + 30, hy - 40, hx + 50, hy + 10, hx + 66, hy - 26);
  else ctx.bezierCurveTo(hx + 14, hy + 30, hx - 6, hy + 60, hx + 10, hy + 84);
  ctx.stroke();
  ctx.strokeStyle = '#fff36a';
  ctx.lineWidth = 2;
  ctx.stroke();
  // demon head: horns, burning eyes, huge grin
  const hy2 = fy - 172 + bob;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 10, hy2 - 14);
    ctx.quadraticCurveTo(cx + side * 34, hy2 - 30, cx + side * 26, hy2 - 58);
    ctx.quadraticCurveTo(cx + side * 22, hy2 - 30, cx + side * 4, hy2 - 18);
    ctx.closePath();
    fillInk(ctx, shade(ctx, cx + side * 20, hy2 - 30, 20, '#f2e6cc', '#8a7a60'), 3);
  }
  circle(ctx, cx, hy2, 21);
  fillInk(ctx, shade(ctx, cx, hy2, 21, '#ff5a4a', '#8a0a14'), 3.5);
  pieEye(ctx, cx - 8, hy2 - 4, 5.5, 6.5, 0, 0.3, { lid: 0.55, lidSide: 1, glow: '#fff36a' });
  pieEye(ctx, cx + 8, hy2 - 4, 5.5, 6.5, 0, 0.3, { lid: 0.55, lidSide: -1, glow: '#fff36a' });
  grin(ctx, cx, hy2 + 7, 30, 5, 10, '#1a0004', 2.4);
  // the burning top hat, crooked
  ctx.save();
  ctx.translate(cx + 4, hy2 - 22);
  ctx.rotate(-0.25);
  ellipse(ctx, 0, 0, 22, 5);
  fillInk(ctx, '#0a0608', 3);
  roundRect(ctx, -13, -38, 26, 38, 3);
  fillInk(ctx, '#0a0608', 3);
  flame(ctx, 0, -38, 16, t * 2);
  ctx.restore();
  void DANGER;
}

function claw(ctx: Ctx, x: number, y: number): void {
  circle(ctx, x, y, 7);
  fillInk(ctx, '#5a0a10', 2.4);
  ctx.fillStyle = '#f2e6cc';
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.2 + i * 0.35;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
    ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
    ctx.lineTo(x + Math.cos(a + 0.25) * 6, y + Math.sin(a + 0.25) * 6);
    ctx.closePath();
    ctx.fill();
    ink(ctx, 1.2);
    ctx.stroke();
  }
}
