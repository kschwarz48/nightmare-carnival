// Carnival Core set dressing (doc 03, doc 02 §7). Props are drawn front-on in 3/4 view, anchored
// at their ground footprint, so they y-sort naturally with characters.

import type { PropKind } from '../../data/map';
import { INK, PAL, artRng, bulb, circle, ellipse, fillInk, glove, grin, ink, lighten, pieEye, posterText, roundRect, shade, shine, softShadow, stripes, vstripes, type Ctx } from './kit';

export const PROP_ART: Partial<Record<PropKind | string, { w: number; h: number; ay: number }>> = {
  carousel: { w: 400, h: 390, ay: 0.86 },
  ticket_booth: { w: 230, h: 260, ay: 0.86 },
  prize_stand: { w: 280, h: 220, ay: 0.82 },
  stall_ringtoss: { w: 214, h: 200, ay: 0.8 },
  stall_bottles: { w: 214, h: 200, ay: 0.8 },
  stall_darts: { w: 214, h: 200, ay: 0.8 },
  stall_shooting: { w: 240, h: 210, ay: 0.8 },
  popcorn_cart: { w: 120, h: 150, ay: 0.86 },
  cotton_stand: { w: 180, h: 180, ay: 0.82 },
  hotdog_stand: { w: 190, h: 180, ay: 0.82 },
  fence_h: { w: 120, h: 70, ay: 0.78 },
  fence_v: { w: 40, h: 120, ay: 0.5 },
  gate_arch: { w: 300, h: 240, ay: 0.92 },
  funhouse: { w: 500, h: 330, ay: 0.82 },
  coaster_ruin: { w: 920, h: 280, ay: 0.85 },
  tilt_a_whirl: { w: 600, h: 420, ay: 0.5 },
  lamp: { w: 44, h: 160, ay: 0.95 },
  barrel: { w: 46, h: 58, ay: 0.85 },
  crate: { w: 52, h: 54, ay: 0.85 },
  hay: { w: 60, h: 46, ay: 0.85 },
  tree_dead: { w: 130, h: 190, ay: 0.93 },
  trash: { w: 70, h: 34, ay: 0.6 },
  balloon_post: { w: 60, h: 130, ay: 0.95 },
  bench: { w: 96, h: 56, ay: 0.8 },
  strongman_tower: { w: 100, h: 320, ay: 0.95 },
  dunk_tank: { w: 160, h: 160, ay: 0.82 },
  caravan: { w: 290, h: 200, ay: 0.86 },
  pennant_pole: { w: 44, h: 170, ay: 0.96 },
  sign_midway: { w: 170, h: 130, ay: 0.95 },
  bleachers: { w: 320, h: 120, ay: 0.8 },
  tent_small: { w: 250, h: 230, ay: 0.85 },
  tombstone_prize: { w: 80, h: 90, ay: 0.9 },
  clown_statue: { w: 120, h: 190, ay: 0.92 },
  rail: { w: 100, h: 44, ay: 0.7 },
  ferris_base: { w: 300, h: 60, ay: 0.7 },
};

export function drawProp(ctx: Ctx, kind: string, w: number, h: number, variant = 0): void {
  switch (kind) {
    case 'carousel': return carousel(ctx, w, h);
    case 'ticket_booth': return ticketBooth(ctx, w, h);
    case 'prize_stand': return prizeStand(ctx, w, h);
    case 'stall_ringtoss': return stall(ctx, w, h, 'RING TOSS', variant ? '#3f7fd0' : '#c8322d', 'rings');
    case 'stall_bottles': return stall(ctx, w, h, 'MILK BOTTLES', '#4f9a3a', 'bottles');
    case 'stall_darts': return stall(ctx, w, h, 'BALLOON POP', '#9a4ad0', 'balloons');
    case 'stall_shooting': return stall(ctx, w, h, 'SHOOTING GALLERY', '#d9a43a', 'ducks');
    case 'popcorn_cart': return popcornCart(ctx, w, h);
    case 'cotton_stand': return foodStand(ctx, w, h, 'COTTON CANDY', '#ff7bb0', 'cotton');
    case 'hotdog_stand': return foodStand(ctx, w, h, 'HOT DOGS', '#f08a2c', 'hotdog');
    case 'fence_h': return fenceH(ctx, w, h);
    case 'fence_v': return fenceV(ctx, w, h);
    case 'gate_arch': return gateArch(ctx, w, h, variant);
    case 'funhouse': return funhouse(ctx, w, h);
    case 'coaster_ruin': return coaster(ctx, w, h);
    case 'tilt_a_whirl': return tiltBase(ctx, w, h);
    case 'lamp': return lamp(ctx, w, h);
    case 'barrel': return barrel(ctx, w, h);
    case 'crate': return crate(ctx, w, h);
    case 'hay': return hay(ctx, w, h);
    case 'tree_dead': return tree(ctx, w, h, variant);
    case 'trash': return trash(ctx, w, h, variant);
    case 'balloon_post': return balloonPost(ctx, w, h);
    case 'bench': return bench(ctx, w, h);
    case 'strongman_tower': return striker(ctx, w, h);
    case 'dunk_tank': return dunkProp(ctx, w, h);
    case 'caravan': return caravan(ctx, w, h);
    case 'pennant_pole': return pennantPole(ctx, w, h);
    case 'sign_midway': return midwaySign(ctx, w, h);
    case 'bleachers': return bleachers(ctx, w, h);
    case 'tent_small': return smallTent(ctx, w, h, variant);
    case 'tombstone_prize': return prizePile(ctx, w, h);
    case 'clown_statue': return clownStatue(ctx, w, h);
    case 'rail': return rail(ctx, w, h);
    case 'ferris_base': return ferrisBase(ctx, w, h);
  }
}

function base(ctx: Ctx, cx: number, by: number, rx: number, ry: number): void {
  softShadow(ctx, cx, by, rx, ry, 0.45);
}

// ---------------------------------------------------------------- the dead carousel
function carousel(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.86;
  base(ctx, cx, by, 200, 50);
  // platform
  ellipse(ctx, cx, by - 10, 180, 44);
  fillInk(ctx, shade(ctx, cx, by - 20, 180, '#8a6a4a', '#4a3020'), 4);
  ellipse(ctx, cx, by - 22, 170, 38);
  fillInk(ctx, shade(ctx, cx, by - 30, 170, '#b8906a', '#6a4a30'), 3);
  // brass poles and frozen horses
  const r = artRng(5);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 0.05 + (i / 6) * Math.PI * 0.9;
    const px = cx + Math.cos(a) * 140, py = by - 26 + Math.sin(a) * 30;
    ink(ctx, 2.5);
    ctx.strokeStyle = PAL.brass;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, by - 230);
    ctx.stroke();
    // horse silhouette
    ctx.save();
    ctx.translate(px, py - 52 - r() * 20);
    ctx.scale(i % 2 ? -0.9 : 0.9, 0.9);
    ellipse(ctx, 0, 0, 24, 11);
    fillInk(ctx, i % 3 === 0 ? '#e8dcc4' : i % 3 === 1 ? '#c8a8d8' : '#a8d0e8', 2.4);
    ctx.beginPath();
    ctx.moveTo(14, -4);
    ctx.quadraticCurveTo(22, -24, 30, -22);
    ctx.lineTo(34, -12);
    ctx.lineTo(22, -2);
    ctx.closePath();
    fillInk(ctx, i % 3 === 0 ? '#e8dcc4' : i % 3 === 1 ? '#c8a8d8' : '#a8d0e8', 2.4);
    ctx.fillStyle = INK;
    circle(ctx, 27, -17, 1.6);
    ctx.fill();
    for (const lx of [-14, -6, 8, 16]) {
      roundRect(ctx, lx - 2.5, 6, 5, 14, 2);
      fillInk(ctx, '#e8dcc4', 1.6);
    }
    ctx.restore();
  }
  // center column with mirror panels
  roundRect(ctx, cx - 36, by - 220, 72, 190, 6);
  fillInk(ctx, shade(ctx, cx, by - 120, 60, '#8a3a5a', '#3a1428'), 3);
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, cx - 28 + i * 20, by - 200, 16, 60, 4);
    fillInk(ctx, shade(ctx, cx - 20 + i * 20, by - 180, 14, '#c8e8f8', '#5a7a9a'), 2);
  }
  // canopy
  ctx.beginPath();
  ctx.moveTo(cx - 195, by - 228);
  ctx.quadraticCurveTo(cx, by - 380, cx + 195, by - 228);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 ? '#f2e6cc' : '#c8322d';
    ctx.beginPath();
    ctx.moveTo(cx, by - 380);
    ctx.lineTo(cx - 200 + i * 30, by - 220);
    ctx.lineTo(cx - 170 + i * 30, by - 220);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ink(ctx, 4);
  ctx.beginPath();
  ctx.moveTo(cx - 195, by - 228);
  ctx.quadraticCurveTo(cx, by - 380, cx + 195, by - 228);
  ctx.closePath();
  ctx.stroke();
  // scalloped rim with bulbs (some dead)
  ctx.beginPath();
  ctx.moveTo(cx - 195, by - 228);
  for (let i = 0; i < 13; i++) {
    const x0 = cx - 195 + i * 30;
    ctx.quadraticCurveTo(x0 + 15, by - 196, x0 + 30, by - 228);
  }
  ctx.lineTo(cx + 195, by - 240);
  ctx.lineTo(cx - 195, by - 240);
  ctx.closePath();
  fillInk(ctx, '#3a1a5a', 3);
  for (let i = 0; i < 13; i++) bulb(ctx, cx - 180 + i * 30, by - 210, 4, i % 2 ? '#ffd36a' : '#ff7ab0', r() > 0.3);
  // finial + broken sign
  circle(ctx, cx, by - 384, 10);
  fillInk(ctx, PAL.gold, 3);
  posterText(ctx, 'CAROUSEL', cx, by - 290, 30, '#ffd36a');
}

function ticketBooth(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.86;
  base(ctx, cx, by, 110, 30);
  roundRect(ctx, cx - 95, by - 150, 190, 150, 6);
  ctx.save();
  ctx.clip();
  vstripes(ctx, cx - 95, by - 150, 190, 150, '#c8322d', '#f2e6cc', 10);
  ctx.restore();
  ink(ctx, 4);
  roundRect(ctx, cx - 95, by - 150, 190, 150, 6);
  ctx.stroke();
  // window
  roundRect(ctx, cx - 50, by - 128, 100, 64, 10);
  fillInk(ctx, '#ffe9a0', 3);
  ctx.fillStyle = 'rgba(80,40,20,0.35)';
  ctx.fillRect(cx - 46, by - 90, 92, 22);
  // empty stool + ghostly ticket roll
  circle(ctx, cx + 20, by - 96, 12);
  fillInk(ctx, '#f7eedb', 2.4);
  // roof
  ctx.beginPath();
  ctx.moveTo(cx - 112, by - 146);
  ctx.lineTo(cx, by - 230);
  ctx.lineTo(cx + 112, by - 146);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx, by - 190, 100, '#5a2a7a', '#2a0a3a'), 4);
  posterText(ctx, 'TICKETS', cx, by - 168, 26, '#ffd36a');
  for (let i = 0; i < 9; i++) bulb(ctx, cx - 96 + i * 24, by - 146, 3.6, i % 2 ? '#ffd36a' : '#ff7ab0', i !== 4);
  // counter
  roundRect(ctx, cx - 60, by - 64, 120, 10, 3);
  fillInk(ctx, PAL.woodLight, 2.4);
  ctx.fillStyle = '#ffe9a0';
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(cx - 30 + i * 18, by - 52);
    ctx.rotate(0.2 * (i - 1.5));
    ctx.fillRect(-5, 0, 10, 16);
    ink(ctx, 1.2);
    ctx.strokeRect(-5, 0, 10, 16);
    ctx.restore();
  }
}

function prizeStand(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.82;
  base(ctx, cx, by, 140, 32);
  roundRect(ctx, cx - 125, by - 110, 250, 110, 6);
  fillInk(ctx, shade(ctx, cx, by - 60, 120, '#7a4a2a', '#3a2010'), 4);
  // shelves of creepy prizes
  for (let row = 0; row < 2; row++) {
    roundRect(ctx, cx - 115, by - 60 - row * 40, 230, 6, 2);
    fillInk(ctx, PAL.woodLight, 2);
    for (let i = 0; i < 7; i++) {
      const x = cx - 100 + i * 33, y = by - 66 - row * 40;
      const col = ['#c8a070', '#f0a0c8', '#90d0f0', '#b0e080', '#ffd36a'][(i + row) % 5];
      circle(ctx, x, y - 14, 10);
      fillInk(ctx, col, 2);
      circle(ctx, x - 4, y - 16, 1.8);
      ctx.fillStyle = INK;
      ctx.fill();
      circle(ctx, x + 4, y - 16, 1.8);
      ctx.fill();
      ink(ctx, 1.4);
      ctx.beginPath();
      ctx.arc(x, y - 12, 4, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
  }
  // awning
  ctx.beginPath();
  ctx.moveTo(cx - 140, by - 110);
  for (let i = 0; i < 10; i++) {
    const x0 = cx - 140 + i * 28;
    ctx.quadraticCurveTo(x0 + 14, by - 88, x0 + 28, by - 110);
  }
  ctx.lineTo(cx + 140, by - 150);
  ctx.lineTo(cx - 140, by - 150);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  vstripes(ctx, cx - 140, by - 150, 280, 64, '#e98fb4', '#f2e6cc', 10);
  ctx.restore();
  ink(ctx, 3.5);
  ctx.beginPath();
  ctx.moveTo(cx - 140, by - 110);
  for (let i = 0; i < 10; i++) {
    const x0 = cx - 140 + i * 28;
    ctx.quadraticCurveTo(x0 + 14, by - 88, x0 + 28, by - 110);
  }
  ctx.lineTo(cx + 140, by - 150);
  ctx.lineTo(cx - 140, by - 150);
  ctx.closePath();
  ctx.stroke();
  posterText(ctx, 'PRIZES!', cx, by - 172, 30, '#ffd36a');
}

function stall(ctx: Ctx, w: number, h: number, label: string, col: string, kind: string): void {
  const cx = w / 2, by = h * 0.8;
  base(ctx, cx, by, 110, 26);
  // counter
  roundRect(ctx, cx - 95, by - 60, 190, 60, 4);
  fillInk(ctx, shade(ctx, cx, by - 30, 100, lighten(col, 0.2), lighten(col, -0.35)), 4);
  ctx.fillStyle = '#f2e6cc';
  ctx.fillRect(cx - 94, by - 60, 188, 8);
  // back wall
  roundRect(ctx, cx - 92, by - 130, 184, 72, 2);
  fillInk(ctx, '#2a1a2a', 3);
  // game contents
  if (kind === 'rings') {
    for (let i = 0; i < 6; i++) {
      roundRect(ctx, cx - 78 + i * 28, by - 104, 10, 34, 3);
      fillInk(ctx, ['#5fb8e8', '#9be15d', '#ff7bb0'][i % 3], 2);
    }
  } else if (kind === 'bottles') {
    for (let row = 0; row < 3; row++) for (let i = 0; i <= row; i++) {
      const x = cx - (row * 14) / 2 + i * 14 - 0, y = by - 70 - (2 - row) * 18;
      roundRect(ctx, x - 5, y - 16, 10, 16, 3);
      fillInk(ctx, '#fffaf0', 1.6);
    }
  } else if (kind === 'balloons') {
    for (let i = 0; i < 12; i++) {
      const x = cx - 75 + (i % 6) * 30, y = by - 110 + Math.floor(i / 6) * 26;
      ellipse(ctx, x, y, 9, 11);
      fillInk(ctx, ['#ff5a7a', '#ffd23a', '#4fd6e0', '#c890ff'][i % 4], 1.8);
      shine(ctx, x - 3, y - 4, 1.6, 0.8);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const x = cx - 70 + i * 35, y = by - 86;
      ellipse(ctx, x, y, 12, 8);
      fillInk(ctx, PAL.yellow, 2);
      circle(ctx, x + 8, y - 8, 6);
      fillInk(ctx, PAL.yellow, 2);
      ctx.fillStyle = PAL.orange;
      ctx.fillRect(x + 12, y - 9, 6, 3);
      circle(ctx, x + 8, y - 9, 1.4);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  }
  // posts + awning
  for (const sx of [-92, 88]) {
    roundRect(ctx, cx + sx, by - 150, 6, 90, 2);
    fillInk(ctx, PAL.woodLight, 2);
  }
  ctx.beginPath();
  ctx.moveTo(cx - 104, by - 140);
  for (let i = 0; i < 8; i++) {
    const x0 = cx - 104 + i * 26;
    ctx.quadraticCurveTo(x0 + 13, by - 118, x0 + 26, by - 140);
  }
  ctx.lineTo(cx + 104, by - 172);
  ctx.lineTo(cx - 104, by - 172);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  vstripes(ctx, cx - 104, by - 172, 208, 60, col, '#f2e6cc', 8);
  ctx.restore();
  ink(ctx, 3.5);
  ctx.beginPath();
  ctx.moveTo(cx - 104, by - 140);
  for (let i = 0; i < 8; i++) {
    const x0 = cx - 104 + i * 26;
    ctx.quadraticCurveTo(x0 + 13, by - 118, x0 + 26, by - 140);
  }
  ctx.lineTo(cx + 104, by - 172);
  ctx.lineTo(cx - 104, by - 172);
  ctx.closePath();
  ctx.stroke();
  roundRect(ctx, cx - 88, by - 196, 176, 26, 8);
  fillInk(ctx, '#1a1028', 3);
  posterText(ctx, label, cx, by - 183, label.length > 12 ? 13 : 16, '#ffd36a', { outline: 2.4 });
}

function popcornCart(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.86;
  base(ctx, cx, by, 60, 16);
  for (const side of [-1, 1]) {
    circle(ctx, cx + side * 34, by - 12, 12);
    fillInk(ctx, '#c8322d', 3);
    circle(ctx, cx + side * 34, by - 12, 4);
    fillInk(ctx, PAL.gold, 1.6);
  }
  roundRect(ctx, cx - 44, by - 64, 88, 44, 4);
  fillInk(ctx, shade(ctx, cx, by - 42, 50, '#ff5a4a', '#8a1a1a'), 3.5);
  roundRect(ctx, cx - 38, by - 120, 76, 58, 6);
  fillInk(ctx, 'rgba(255,240,200,0.85)', 3);
  ctx.fillStyle = '#fff6dc';
  const r = artRng(9);
  for (let i = 0; i < 30; i++) {
    circle(ctx, cx - 32 + r() * 64, by - 70 - r() * 30, 3 + r() * 2);
    ctx.fill();
  }
  ink(ctx, 3);
  roundRect(ctx, cx - 38, by - 120, 76, 58, 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 46, by - 118);
  ctx.quadraticCurveTo(cx, by - 150, cx + 46, by - 118);
  ctx.closePath();
  fillInk(ctx, '#c8322d', 3);
  posterText(ctx, 'POPCORN', cx, by - 42, 15, '#ffd36a', { outline: 2.4 });
}

function foodStand(ctx: Ctx, w: number, h: number, label: string, col: string, kind: string): void {
  const cx = w / 2, by = h * 0.82;
  base(ctx, cx, by, 96, 24);
  roundRect(ctx, cx - 82, by - 70, 164, 70, 5);
  fillInk(ctx, shade(ctx, cx, by - 36, 90, lighten(col, 0.25), lighten(col, -0.3)), 4);
  // giant mascot on the roof
  if (kind === 'cotton') {
    for (const [x, y, r] of [[-14, -140, 22], [12, -146, 20], [0, -162, 18]] as [number, number, number][]) {
      circle(ctx, cx + x, by + y, r);
      fillInk(ctx, '#ffc6e0', 3);
    }
    pieEye(ctx, cx - 8, by - 148, 5, 6.5, 0.2, 0.2, { lid: 0.4, lidSide: 1 });
    pieEye(ctx, cx + 8, by - 148, 5, 6.5, -0.2, 0.2, { lid: 0.4, lidSide: -1 });
    grin(ctx, cx, by - 138, 22, 4, 6, '#5a1018', 2);
  } else {
    ellipse(ctx, cx, by - 140, 60, 16);
    fillInk(ctx, '#e8b060', 3);
    ellipse(ctx, cx, by - 146, 62, 11);
    fillInk(ctx, '#c8462a', 3);
    pieEye(ctx, cx + 22, by - 150, 5, 6, 0.4, 0);
    pieEye(ctx, cx + 36, by - 150, 5, 6, 0.4, 0);
    grin(ctx, cx + 30, by - 142, 16, 3, 5, '#5a1018', 2);
  }
  ctx.beginPath();
  ctx.moveTo(cx - 92, by - 70);
  for (let i = 0; i < 7; i++) {
    const x0 = cx - 92 + i * 26.3;
    ctx.quadraticCurveTo(x0 + 13, by - 50, x0 + 26.3, by - 70);
  }
  ctx.lineTo(cx + 92, by - 108);
  ctx.lineTo(cx - 92, by - 108);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  vstripes(ctx, cx - 92, by - 108, 184, 60, col, '#f2e6cc', 8);
  ctx.restore();
  ink(ctx, 3.5);
  ctx.beginPath();
  ctx.moveTo(cx - 92, by - 70);
  for (let i = 0; i < 7; i++) {
    const x0 = cx - 92 + i * 26.3;
    ctx.quadraticCurveTo(x0 + 13, by - 50, x0 + 26.3, by - 70);
  }
  ctx.lineTo(cx + 92, by - 108);
  ctx.lineTo(cx - 92, by - 108);
  ctx.closePath();
  ctx.stroke();
  posterText(ctx, label, cx, by - 30, 17, '#fffaf0', { outline: 3 });
}

function fenceH(ctx: Ctx, w: number, h: number): void {
  // wrought-iron spear fence with a brick plinth (tileable horizontally)
  const by = h * 0.78;
  roundRect(ctx, -2, by - 14, w + 4, 18, 2);
  fillInk(ctx, shade(ctx, w / 2, by - 6, w / 2, '#7a4a3a', '#3a2018'), 3);
  ink(ctx, 1.2);
  for (let x = 10; x < w; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, by - 14);
    ctx.lineTo(x, by + 3);
    ctx.stroke();
  }
  ink(ctx, 4);
  ctx.beginPath();
  ctx.moveTo(0, by - 46);
  ctx.lineTo(w, by - 46);
  ctx.moveTo(0, by - 24);
  ctx.lineTo(w, by - 24);
  ctx.stroke();
  for (let x = 6; x < w; x += 15) {
    ink(ctx, 3.5);
    ctx.beginPath();
    ctx.moveTo(x, by - 14);
    ctx.lineTo(x, by - 56);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4, by - 54);
    ctx.lineTo(x, by - 64);
    ctx.lineTo(x + 4, by - 54);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
  }
  ctx.strokeStyle = '#4a3a5a';
  ctx.lineWidth = 1.2;
  for (let x = 6; x < w; x += 15) {
    ctx.beginPath();
    ctx.moveTo(x, by - 16);
    ctx.lineTo(x, by - 54);
    ctx.stroke();
  }
}

function fenceV(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  ink(ctx, 5);
  ctx.beginPath();
  ctx.moveTo(cx - 6, 0);
  ctx.lineTo(cx - 6, h);
  ctx.moveTo(cx + 6, 0);
  ctx.lineTo(cx + 6, h);
  ctx.stroke();
  for (let y = 8; y < h; y += 18) {
    circle(ctx, cx, y, 5);
    fillInk(ctx, '#3a2e44', 2.4);
    ctx.fillStyle = '#6a5a70';
    circle(ctx, cx - 1, y - 1, 1.8);
    ctx.fill();
  }
}

function gateArch(ctx: Ctx, w: number, h: number, variant: number): void {
  const cx = w / 2, by = h * 0.92;
  for (const side of [-1, 1]) {
    roundRect(ctx, cx + side * 128 - 14, by - 170, 28, 172, 6);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#f2e6cc';
    ctx.fillRect(cx + side * 128 - 14, by - 170, 28, 172);
    ctx.fillStyle = '#c8322d';
    for (let y = by - 180; y < by; y += 22) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 128 - 14, y);
      ctx.lineTo(cx + side * 128 + 14, y + 11);
      ctx.lineTo(cx + side * 128 + 14, y + 22);
      ctx.lineTo(cx + side * 128 - 14, y + 11);
      ctx.fill();
    }
    ctx.restore();
    ink(ctx, 3.5);
    roundRect(ctx, cx + side * 128 - 14, by - 170, 28, 172, 6);
    ctx.stroke();
    circle(ctx, cx + side * 128, by - 178, 12);
    fillInk(ctx, PAL.gold, 3);
  }
  ctx.beginPath();
  ctx.moveTo(cx - 140, by - 160);
  ctx.quadraticCurveTo(cx, by - 250, cx + 140, by - 160);
  ctx.lineTo(cx + 140, by - 128);
  ctx.quadraticCurveTo(cx, by - 212, cx - 140, by - 128);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx, by - 180, 140, '#5a2a7a', '#2a0a3a'), 4);
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const x = cx - 130 + t * 260;
    const y = by - 148 - Math.sin(t * Math.PI) * 44;
    bulb(ctx, x, y, 4, i % 2 ? '#ffd36a' : '#ff7ab0', i % 4 !== 1);
  }
  const label = ['GATE 1', 'MIDWAY', 'GATE 3'][variant] ?? 'MIDWAY';
  posterText(ctx, label, cx, by - 196, 26, '#ffd36a');
}

function funhouse(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.82;
  base(ctx, cx, by, 250, 40);
  // facade
  ctx.beginPath();
  ctx.moveTo(cx - 230, by);
  ctx.lineTo(cx - 230, by - 180);
  ctx.quadraticCurveTo(cx - 200, by - 230, cx - 150, by - 220);
  ctx.quadraticCurveTo(cx, by - 300, cx + 150, by - 220);
  ctx.quadraticCurveTo(cx + 200, by - 230, cx + 230, by - 180);
  ctx.lineTo(cx + 230, by);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  stripes(ctx, cx - 240, by - 310, 480, 320, '#2a8a6a', '#1a5a4a', 22, 0.4);
  ctx.restore();
  ink(ctx, 4.5);
  ctx.beginPath();
  ctx.moveTo(cx - 230, by);
  ctx.lineTo(cx - 230, by - 180);
  ctx.quadraticCurveTo(cx - 200, by - 230, cx - 150, by - 220);
  ctx.quadraticCurveTo(cx, by - 300, cx + 150, by - 220);
  ctx.quadraticCurveTo(cx + 200, by - 230, cx + 230, by - 180);
  ctx.lineTo(cx + 230, by);
  ctx.closePath();
  ctx.stroke();
  // giant clown face; the mouth is the entrance
  circle(ctx, cx, by - 120, 96);
  fillInk(ctx, shade(ctx, cx, by - 130, 96, '#fffaf0', '#d8d0c0'), 4);
  pieEye(ctx, cx - 36, by - 150, 22, 28, 0.3, 0.3, { lid: 0.35, lidSide: 1, glow: '#d0ffd8' });
  pieEye(ctx, cx + 36, by - 150, 22, 28, -0.3, 0.3, { lid: 0.35, lidSide: -1, glow: '#d0ffd8' });
  circle(ctx, cx, by - 112, 16);
  fillInk(ctx, shade(ctx, cx, by - 112, 16, '#ff8a8a', '#c8322d'), 3);
  ctx.beginPath();
  ctx.moveTo(cx - 70, by - 82);
  ctx.quadraticCurveTo(cx, by - 40, cx + 70, by - 82);
  ctx.lineTo(cx + 46, by);
  ctx.lineTo(cx - 46, by);
  ctx.closePath();
  fillInk(ctx, '#0a0408', 4);
  ctx.fillStyle = '#fff6dc';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 60 + i * 18, by - 78 + Math.abs(i - 3) * 1.5);
    ctx.lineTo(cx - 48 + i * 18, by - 78 + Math.abs(i - 3) * 1.5);
    ctx.lineTo(cx - 54 + i * 18, by - 62);
    ctx.closePath();
    ctx.fill();
  }
  posterText(ctx, 'FUN HOUSE', cx, by - 248, 34, '#9be15d');
  for (let i = 0; i < 9; i++) bulb(ctx, cx - 200 + i * 50, by - 190 - Math.sin((i / 8) * Math.PI) * 60, 5, '#9be15d', i % 3 !== 0);
}

function coaster(ctx: Ctx, w: number, h: number): void {
  const by = h * 0.85;
  // trestles
  ink(ctx, 6);
  ctx.strokeStyle = '#3a2a1a';
  const track: [number, number][] = [];
  for (let i = 0; i <= 30; i++) {
    const x = (i / 30) * w;
    const y = by - 70 - Math.sin(i * 0.45) * 60 - (i > 18 && i < 24 ? 60 : 0);
    track.push([x, y]);
  }
  for (let i = 0; i <= 30; i += 2) {
    const [x, y] = track[i];
    if (i === 20) continue; // broken section
    ink(ctx, 6);
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 3;
    ctx.stroke();
    if (i % 4 === 0 && i < 30) {
      ink(ctx, 2.5);
      ctx.strokeStyle = '#5a3a20';
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(track[i + 2][0], track[i + 2][1] + 20);
      ctx.stroke();
    }
  }
  // rails (with a snapped gap)
  for (const off of [0, 8]) {
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= 30; i++) {
      if (i === 20 || i === 21) {
        pen = false;
        continue;
      }
      const [x, y] = track[i];
      if (!pen) ctx.moveTo(x, y + off);
      else ctx.lineTo(x, y + off);
      pen = true;
    }
    ink(ctx, 7);
    ctx.stroke();
    ctx.strokeStyle = '#c8b8d0';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // a derailed car hanging off the break
  ctx.save();
  ctx.translate(track[19][0] + 10, track[19][1] + 30);
  ctx.rotate(0.9);
  roundRect(ctx, -24, -14, 48, 28, 6);
  fillInk(ctx, shade(ctx, 0, 0, 24, '#6ae0b0', '#1a7a5a'), 3);
  ctx.restore();
}

function tiltBase(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  ellipse(ctx, cx, cy + 8, 290, 200);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ellipse(ctx, cx, cy, 285, 195);
  fillInk(ctx, shade(ctx, cx, cy, 285, '#5a4a7a', '#2a1a3a'), 5);
  // painted spiral on the platform (the arm's danger track)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 270, 182, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,90,60,0.22)' : 'rgba(255,220,90,0.12)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 300, (i / 12) * Math.PI * 2, ((i + 1) / 12) * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    bulb(ctx, cx + Math.cos(a) * 276, cy + Math.sin(a) * 188, 4, i % 2 ? '#c890ff' : '#ffd36a', i % 5 !== 0);
  }
  circle(ctx, cx, cy, 40);
  fillInk(ctx, shade(ctx, cx, cy, 40, '#c8b8d8', '#5a4a6a'), 4);
  posterText(ctx, 'TILT-A-WHIRL', cx, cy - 120, 28, '#c890ff');
}

/** The rotating arm with a teacup car at the end (drawn by renderer rotated). */
export function tiltArm(ctx: Ctx, w: number, h: number): void {
  const cy = h / 2;
  roundRect(ctx, 0, cy - 9, w - 50, 18, 6);
  fillInk(ctx, shade(ctx, w / 2, cy, w / 2, '#ffb0a0', '#c8322d'), 3);
  ellipse(ctx, w - 30, cy, 30, 26);
  fillInk(ctx, shade(ctx, w - 30, cy, 30, '#c8f0ff', '#3f7fd0'), 3.5);
  ellipse(ctx, w - 30, cy, 18, 15);
  fillInk(ctx, '#1a2a4a', 2);
  pieEye(ctx, w - 36, cy - 4, 4, 5, 0.4, 0, { glow: '#ffef8a' });
  pieEye(ctx, w - 24, cy - 4, 4, 5, 0.4, 0, { glow: '#ffef8a' });
}

function lamp(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.95;
  base(ctx, cx, by, 14, 5);
  roundRect(ctx, cx - 9, by - 10, 18, 10, 3);
  fillInk(ctx, '#2a2230', 2.4);
  roundRect(ctx, cx - 3, by - 130, 6, 122, 2);
  fillInk(ctx, '#3a2e44', 2.4);
  ink(ctx, 2.5);
  ctx.beginPath();
  ctx.arc(cx + 8, by - 130, 8, Math.PI, Math.PI * 1.8);
  ctx.stroke();
  circle(ctx, cx, by - 142, 11);
  const g = ctx.createRadialGradient(cx, by - 142, 1, cx, by - 142, 11);
  g.addColorStop(0, '#fffbe0');
  g.addColorStop(1, '#ffc850');
  fillInk(ctx, g, 2.4);
  roundRect(ctx, cx - 8, by - 156, 16, 5, 2);
  fillInk(ctx, '#2a2230', 2);
}

function barrel(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.85;
  base(ctx, cx, by, 22, 6);
  roundRect(ctx, cx - 18, by - 44, 36, 44, 10);
  fillInk(ctx, shade(ctx, cx, by - 22, 22, '#b8875a', '#5a3820'), 3);
  for (const y of [by - 36, by - 10]) {
    ctx.fillStyle = '#4a4040';
    ctx.fillRect(cx - 18, y, 36, 4);
  }
  ellipse(ctx, cx, by - 44, 16, 4);
  fillInk(ctx, '#7a5236', 2);
}

function crate(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.85;
  base(ctx, cx, by, 24, 6);
  roundRect(ctx, cx - 22, by - 42, 44, 42, 3);
  fillInk(ctx, shade(ctx, cx, by - 21, 24, '#d8a870', '#7a5230'), 3);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(cx - 22, by - 42);
  ctx.lineTo(cx + 22, by);
  ctx.moveTo(cx + 22, by - 42);
  ctx.lineTo(cx - 22, by);
  ctx.stroke();
  ctx.font = '8px Georgia';
  ctx.fillStyle = '#5a3820';
  ctx.textAlign = 'center';
  ctx.fillText('FRAGILE', cx, by - 4);
}

function hay(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.85;
  base(ctx, cx, by, 28, 7);
  roundRect(ctx, cx - 26, by - 30, 52, 30, 8);
  fillInk(ctx, shade(ctx, cx, by - 15, 28, '#f0d070', '#a8862a'), 3);
  ink(ctx, 1.2);
  ctx.strokeStyle = '#8a6a1a';
  const r = artRng(3);
  for (let i = 0; i < 14; i++) {
    const x = cx - 22 + r() * 44, y = by - 26 + r() * 22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6, y - 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#7a4a2a';
  ctx.fillRect(cx - 12, by - 30, 3, 30);
  ctx.fillRect(cx + 9, by - 30, 3, 30);
}

function tree(ctx: Ctx, w: number, h: number, v: number): void {
  const cx = w / 2, by = h * 0.93;
  base(ctx, cx, by, 34, 9);
  const r = artRng(11 + v);
  const branch = (x: number, y: number, a: number, len: number, wid: number, d: number) => {
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    ink(ctx, wid + 3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + ex) / 2 + (r() - 0.5) * 20, (y + ey) / 2, ex, ey);
    ctx.stroke();
    ctx.strokeStyle = '#3a2a30';
    ctx.lineWidth = wid;
    ctx.stroke();
    if (d > 0) {
      branch(ex, ey, a - 0.5 - r() * 0.3, len * 0.68, wid * 0.62, d - 1);
      branch(ex, ey, a + 0.45 + r() * 0.3, len * 0.66, wid * 0.62, d - 1);
    }
  };
  branch(cx, by, -Math.PI / 2, 70, 14, 4);
  // crow eyes in the branches
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = '#ffe36a';
    circle(ctx, cx - 20 + i * 36, by - 120 + i * 14, 2);
    ctx.fill();
  }
}

function trash(ctx: Ctx, w: number, h: number, v: number): void {
  const r = artRng(31 + v * 7);
  for (let i = 0; i < 6; i++) {
    const x = 8 + r() * (w - 16), y = 6 + r() * (h - 12);
    const k = Math.floor(r() * 3);
    if (k === 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r() * 3);
      ctx.fillStyle = '#ffe9a0';
      ctx.fillRect(-6, -3, 12, 6);
      ink(ctx, 1);
      ctx.strokeRect(-6, -3, 12, 6);
      ctx.restore();
    } else if (k === 1) {
      circle(ctx, x, y, 2.5);
      fillInk(ctx, '#fff6dc', 1);
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r() * 3);
      roundRect(ctx, -5, -6, 10, 12, 1);
      stripes(ctx, -5, -6, 10, 12, '#c8322d', '#fffaf0', 2, 0);
      ctx.restore();
    }
  }
}

function balloonPost(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.95;
  roundRect(ctx, cx - 3, by - 60, 6, 60, 2);
  fillInk(ctx, PAL.woodLight, 2);
  const cols = ['#ff5a7a', '#ffd23a', '#4fd6e0', '#9be15d', '#c890ff'];
  for (let i = 0; i < 5; i++) {
    const bx = cx - 18 + i * 9, byy = by - 96 - (i % 2) * 14;
    ink(ctx, 1);
    ctx.beginPath();
    ctx.moveTo(cx, by - 58);
    ctx.lineTo(bx, byy + 10);
    ctx.stroke();
    ellipse(ctx, bx, byy, 9, 11);
    fillInk(ctx, cols[i], 2);
    shine(ctx, bx - 3, byy - 4, 1.8, 0.8);
  }
}

function bench(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.8;
  base(ctx, cx, by, 46, 8);
  for (const side of [-1, 1]) {
    ink(ctx, 4);
    ctx.beginPath();
    ctx.moveTo(cx + side * 34, by);
    ctx.lineTo(cx + side * 34, by - 20);
    ctx.stroke();
  }
  roundRect(ctx, cx - 44, by - 26, 88, 9, 2);
  fillInk(ctx, PAL.woodLight, 2.4);
  roundRect(ctx, cx - 44, by - 44, 88, 9, 2);
  fillInk(ctx, PAL.woodLight, 2.4);
}

function striker(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.95;
  base(ctx, cx, by, 44, 10);
  roundRect(ctx, cx - 30, by - 22, 60, 22, 4);
  fillInk(ctx, '#c8322d', 3);
  roundRect(ctx, cx - 8, by - 290, 16, 270, 4);
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(0, by - 290, 0, by - 20);
  g.addColorStop(0, '#ff3a3a');
  g.addColorStop(0.5, '#ffd23a');
  g.addColorStop(1, '#4fd66a');
  ctx.fillStyle = g;
  ctx.fillRect(cx - 8, by - 290, 16, 270);
  ctx.restore();
  ink(ctx, 3);
  roundRect(ctx, cx - 8, by - 290, 16, 270, 4);
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    ink(ctx, 1.4);
    ctx.beginPath();
    ctx.moveTo(cx - 8, by - 50 - i * 26);
    ctx.lineTo(cx + 8, by - 50 - i * 26);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 20, by - 290);
  ctx.quadraticCurveTo(cx - 20, by - 318, cx, by - 318);
  ctx.quadraticCurveTo(cx + 20, by - 318, cx + 20, by - 290);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx, by - 304, 20, '#fff3a0', PAL.gold), 3);
  posterText(ctx, 'HIGH STRIKER', cx, by - 10, 9, '#ffd36a', { outline: 2 });
}

function dunkProp(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.82;
  base(ctx, cx, by, 74, 18);
  roundRect(ctx, cx - 62, by - 80, 124, 80, 8);
  ctx.fillStyle = 'rgba(110,180,230,0.85)';
  ctx.fill();
  ctx.fillStyle = 'rgba(60,120,200,0.95)';
  ctx.fillRect(cx - 60, by - 46, 120, 44);
  ink(ctx, 4);
  roundRect(ctx, cx - 62, by - 80, 124, 80, 8);
  ctx.stroke();
  roundRect(ctx, cx - 50, by - 92, 100, 10, 3);
  fillInk(ctx, PAL.wood, 2.4);
  circle(ctx, cx + 76, by - 100, 16);
  fillInk(ctx, '#fffaf0', 3);
  circle(ctx, cx + 76, by - 100, 10);
  ctx.fillStyle = PAL.red;
  ctx.fill();
  // a sunken clown wig floating
  for (let i = 0; i < 5; i++) {
    circle(ctx, cx - 10 + i * 6, by - 46, 5);
    fillInk(ctx, '#ff6a2a', 1.6);
  }
}

function caravan(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.86;
  base(ctx, cx, by, 140, 26);
  for (const side of [-1, 1]) {
    circle(ctx, cx + side * 90, by - 22, 22);
    fillInk(ctx, PAL.red, 3.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ink(ctx, 2);
      ctx.beginPath();
      ctx.moveTo(cx + side * 90, by - 22);
      ctx.lineTo(cx + side * 90 + Math.cos(a) * 18, by - 22 + Math.sin(a) * 18);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.moveTo(cx - 130, by - 40);
  ctx.lineTo(cx - 120, by - 150);
  ctx.quadraticCurveTo(cx, by - 200, cx + 120, by - 150);
  ctx.lineTo(cx + 130, by - 40);
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx, by - 110, 130, '#5a2a8a', '#2a0a4a'), 4);
  ctx.fillStyle = PAL.gold;
  for (let i = 0; i < 6; i++) {
    const x = cx - 100 + i * 40;
    ctx.font = '20px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(i % 2 ? '☾' : '★', x, by - 60);
  }
  roundRect(ctx, cx - 26, by - 140, 52, 50, 24);
  fillInk(ctx, '#ffe9a0', 3);
  circle(ctx, cx, by - 118, 12);
  fillInk(ctx, shade(ctx, cx, by - 118, 12, '#e8fbff', '#5fb8e8'), 2);
  posterText(ctx, 'MADAME ZELDA', cx, by - 162, 14, '#ffd36a', { outline: 2.4 });
}

function pennantPole(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.96;
  roundRect(ctx, cx - 3, by - 150, 6, 150, 2);
  fillInk(ctx, PAL.woodLight, 2);
  ctx.beginPath();
  ctx.moveTo(cx + 3, by - 148);
  ctx.lineTo(cx + 22, by - 140);
  ctx.lineTo(cx + 3, by - 130);
  ctx.closePath();
  fillInk(ctx, PAL.red, 2);
  circle(ctx, cx, by - 154, 5);
  fillInk(ctx, PAL.gold, 2);
}

function midwaySign(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.95;
  for (const side of [-1, 1]) {
    roundRect(ctx, cx + side * 60 - 3, by - 70, 6, 70, 2);
    fillInk(ctx, PAL.woodDark, 2);
  }
  roundRect(ctx, cx - 76, by - 120, 152, 56, 10);
  fillInk(ctx, '#1a1028', 3.5);
  posterText(ctx, 'THIS WAY', cx, by - 104, 16, '#ffd36a', { outline: 2.4 });
  posterText(ctx, '→ BIG TOP →', cx, by - 80, 14, '#ff7ab0', { outline: 2.4 });
}

function bleachers(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.8;
  base(ctx, cx, by, 160, 18);
  for (let row = 0; row < 3; row++) {
    roundRect(ctx, cx - 150 + row * 10, by - 20 - row * 24, 300 - row * 20, 12, 2);
    fillInk(ctx, row % 2 ? PAL.woodLight : PAL.wood, 2.4);
  }
  ink(ctx, 3);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 140 + i * 56, by);
    ctx.lineTo(cx - 135 + i * 56, by - 70);
    ctx.stroke();
  }
  // a single abandoned balloon
  ellipse(ctx, cx + 80, by - 92, 9, 11);
  fillInk(ctx, '#ff5a7a', 2);
}

function smallTent(ctx: Ctx, w: number, h: number, v: number): void {
  const cx = w / 2, by = h * 0.85;
  base(ctx, cx, by, 120, 26);
  ctx.beginPath();
  ctx.moveTo(cx - 110, by);
  ctx.lineTo(cx - 100, by - 80);
  ctx.quadraticCurveTo(cx - 40, by - 110, cx, by - 180);
  ctx.quadraticCurveTo(cx + 40, by - 110, cx + 100, by - 80);
  ctx.lineTo(cx + 110, by);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  vstripes(ctx, cx - 120, by - 190, 240, 200, v ? '#3f7fd0' : '#9a4ad0', '#f2e6cc', 10);
  ctx.restore();
  ink(ctx, 4);
  ctx.beginPath();
  ctx.moveTo(cx - 110, by);
  ctx.lineTo(cx - 100, by - 80);
  ctx.quadraticCurveTo(cx - 40, by - 110, cx, by - 180);
  ctx.quadraticCurveTo(cx + 40, by - 110, cx + 100, by - 80);
  ctx.lineTo(cx + 110, by);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 30, by);
  ctx.quadraticCurveTo(cx, by - 90, cx + 30, by);
  ctx.closePath();
  fillInk(ctx, '#0a0408', 3);
  posterText(ctx, v ? 'FREAKS' : 'WONDERS', cx, by - 110, 18, '#ffd36a');
}

function prizePile(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.9;
  base(ctx, cx, by, 34, 8);
  // a giant forgotten teddy slumped against a crate
  roundRect(ctx, cx - 20, by - 26, 40, 26, 3);
  fillInk(ctx, PAL.wood, 2.4);
  circle(ctx, cx, by - 46, 18);
  fillInk(ctx, '#c8a070', 3);
  for (const side of [-1, 1]) {
    circle(ctx, cx + side * 15, by - 60, 7);
    fillInk(ctx, '#c8a070', 2.4);
  }
  circle(ctx, cx - 6, by - 48, 3);
  fillInk(ctx, INK, 1);
  pieEye(ctx, cx + 7, by - 48, 3, 3.6, 0, 0, { dead: true });
  ink(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(cx - 6, by - 38);
  ctx.lineTo(cx + 6, by - 39);
  ctx.stroke();
}

function clownStatue(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.92;
  base(ctx, cx, by, 50, 12);
  roundRect(ctx, cx - 40, by - 30, 80, 30, 4);
  fillInk(ctx, shade(ctx, cx, by - 15, 40, '#a8a0b0', '#5a5260'), 3);
  posterText(ctx, 'WELCOME', cx, by - 15, 12, '#ffd36a', { outline: 2 });
  // stone clown waving
  ellipse(ctx, cx, by - 70, 24, 36);
  fillInk(ctx, shade(ctx, cx, by - 70, 30, '#d8d0e0', '#7a7288'), 3);
  circle(ctx, cx, by - 128, 22);
  fillInk(ctx, shade(ctx, cx, by - 128, 22, '#e8e0f0', '#8a8298'), 3);
  pieEye(ctx, cx - 8, by - 132, 5, 6.5, 0.2, 0.3, { glow: '#ff6a5a' });
  pieEye(ctx, cx + 8, by - 132, 5, 6.5, -0.2, 0.3, { glow: '#ff6a5a' });
  grin(ctx, cx, by - 122, 22, 4, 6, '#3a2a3a', 2);
  glove(ctx, cx + 30, by - 108, 8, -1.2, '#d8d0e0');
  ink(ctx, 5);
  ctx.beginPath();
  ctx.moveTo(cx + 18, by - 84);
  ctx.quadraticCurveTo(cx + 34, by - 92, cx + 30, by - 104);
  ctx.stroke();
  ctx.strokeStyle = '#b8b0c8';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function rail(ctx: Ctx, w: number, h: number): void {
  const by = h * 0.7;
  ink(ctx, 4);
  ctx.beginPath();
  ctx.moveTo(0, by - 26);
  ctx.lineTo(w, by - 26);
  ctx.moveTo(0, by - 12);
  ctx.lineTo(w, by - 12);
  ctx.stroke();
  ctx.strokeStyle = '#d8d0c0';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, by - 26);
  ctx.lineTo(w, by - 26);
  ctx.stroke();
  for (let x = 10; x < w; x += 25) {
    roundRect(ctx, x - 3, by - 30, 6, 32, 2);
    fillInk(ctx, '#d8d0c0', 2);
  }
}

function ferrisBase(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2, by = h * 0.7;
  roundRect(ctx, cx - 150, by - 20, 300, 30, 6);
  fillInk(ctx, shade(ctx, cx, by - 5, 150, '#7a6a80', '#3a2e44'), 3.5);
  for (let i = 0; i < 9; i++) bulb(ctx, cx - 132 + i * 33, by - 6, 3.5, '#ff4a4a', i % 3 !== 1);
}
