// The Ghost Train's roster and bosses (D-80) for the Carnival-pedia: the same rubber-hose ink as the other
// maps, in the line's palette: photograph greys, mourning black, bottle-green iron, coal and ember, brass.

import { circle, ellipse, fillInk, hose, ink, pieEye, roundRect, shade, softShadow, type Ctx } from './kit';
import type { EnemyMode } from './enemies';

export const GHOST_TRAIN_ART: Record<string, { w: number; h: number; ay: number }> = {
  gt_ticketless: { w: 60, h: 96, ay: 0.95 },
  gt_coalborn: { w: 56, h: 52, ay: 0.9 },
  gt_porter: { w: 84, h: 110, ay: 0.95 },
  gt_navvy: { w: 96, h: 122, ay: 0.95 },
  gt_railcrawler: { w: 86, h: 54, ay: 0.9 },
  gt_mourner: { w: 62, h: 104, ay: 0.95 },
  gt_signalman: { w: 66, h: 98, ay: 0.95 },
  gt_commuter: { w: 60, h: 100, ay: 0.95 },
  gt_newsboy: { w: 56, h: 80, ay: 0.95 },
  gt_mimic: { w: 70, h: 60, ay: 0.9 },
  gt_gravebound: { w: 60, h: 94, ay: 0.95 },
  gt_moth: { w: 74, h: 48, ay: 0.8 },
  gt_pallbearer: { w: 96, h: 96, ay: 0.95 },
  gt_slag: { w: 90, h: 104, ay: 0.95 },
  gt_riveter: { w: 70, h: 98, ay: 0.95 },
  gt_hound: { w: 92, h: 60, ay: 0.9 },
  gt_stillfolk: { w: 60, h: 98, ay: 0.95 },
  gt_watcher: { w: 52, h: 128, ay: 0.96 },
  gt_bellwraith: { w: 66, h: 96, ay: 0.92 },
  gt_collected: { w: 96, h: 96, ay: 0.95 },
  gt_puncher: { w: 62, h: 98, ay: 0.95 },
  gt_inspector: { w: 92, h: 128, ay: 0.95 },
};

const GREY = '#a4aab0';
/** A passenger or railwayman: legs, a long coat, arms, a pale head, a hat; `prop` paints whatever they carry. */
function figure(ctx: Ctx, w: number, h: number, s: number, mode: EnemyMode, o: { coat: string; skin?: string; hat?: 'cap' | 'peak' | 'bowler' | 'veil' | 'none'; hatCol?: string; eye?: string; scale?: number; prop?: (cx: number, hy: number) => void; skirt?: boolean }): void {
  const k = o.scale ?? 1, cx = w / 2, skin = o.skin ?? GREY;
  const hy = h - 78 * k;
  if (!o.skirt) for (const side of [-1, 1]) hose(ctx, cx + side * 6 * k, h - 34 * k, cx + side * 7 * k + s * side * 5, h - 20 * k, cx + side * 8 * k, h - 6, 5 * k, '#24201c');
  // the coat
  ctx.beginPath();
  ctx.moveTo(cx - 14 * k, hy + 14 * k);
  ctx.lineTo(cx + 14 * k, hy + 14 * k);
  ctx.lineTo(cx + (o.skirt ? 22 : 17) * k, h - (o.skirt ? 6 : 26 * k));
  ctx.lineTo(cx - (o.skirt ? 22 : 17) * k, h - (o.skirt ? 6 : 26 * k));
  ctx.closePath();
  fillInk(ctx, shade(ctx, cx - 6, hy + 30, 40 * k, o.coat, '#0e0c0c'), 3);
  const reach = mode === 'windup' ? -10 : 0;
  for (const side of [-1, 1]) hose(ctx, cx + side * 12 * k, hy + 18 * k, cx + side * 18 * k, hy + 30 * k + reach, cx + side * 20 * k, hy + 42 * k + s * 3 + reach, 4 * k, o.coat);
  ellipse(ctx, cx, hy, 10 * k, 12 * k);
  fillInk(ctx, shade(ctx, cx - 3, hy - 4, 14 * k, skin, '#5a6066'), 3);
  const eye = o.eye ?? '#d8e8ff';
  pieEye(ctx, cx - 4 * k, hy + 1, 2.2 * k, 2.8 * k, 0, 0, { glow: eye });
  pieEye(ctx, cx + 4 * k, hy + 1, 2.2 * k, 2.8 * k, 0, 0, { glow: eye });
  const hc = o.hatCol ?? '#1a1816';
  switch (o.hat ?? 'cap') {
    case 'cap':
      ctx.beginPath();
      ctx.ellipse(cx, hy - 8 * k, 11 * k, 5 * k, 0, Math.PI, 0);
      fillInk(ctx, hc, 2.4);
      break;
    case 'peak':
      roundRect(ctx, cx - 10 * k, hy - 18 * k, 20 * k, 9 * k, 2);
      fillInk(ctx, hc, 2.4);
      roundRect(ctx, cx - 3 * k, hy - 16 * k, 6 * k, 4 * k, 1);
      fillInk(ctx, '#c8a050', 1.2);
      break;
    case 'bowler':
      ellipse(ctx, cx, hy - 12 * k, 9 * k, 7 * k);
      fillInk(ctx, '#101012', 2.4);
      ellipse(ctx, cx, hy - 6 * k, 13 * k, 2.6 * k);
      fillInk(ctx, '#101012', 2);
      break;
    case 'veil':
      ctx.beginPath();
      ctx.moveTo(cx - 13 * k, hy - 8 * k);
      ctx.lineTo(cx + 13 * k, hy - 8 * k);
      ctx.lineTo(cx + 15 * k, hy + 16 * k);
      ctx.lineTo(cx - 15 * k, hy + 16 * k);
      ctx.closePath();
      ctx.fillStyle = 'rgba(14,12,16,0.82)';
      ctx.fill();
      ink(ctx, 2.4);
      ctx.stroke();
      break;
  }
  o.prop?.(cx, hy);
}

function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, light: string, dark: string, lw = 3): void {
  ellipse(ctx, x, y, rx, ry);
  fillInk(ctx, shade(ctx, x - rx * 0.3, y - ry * 0.3, Math.max(rx, ry) * 1.2, light, dark), lw);
}

export function drawGhostTrainEnemy(ctx: Ctx, id: string, w: number, h: number, s: number, _c: number, mode: EnemyMode): boolean {
  const cx = w / 2;
  switch (id) {
    case 'gt_ticketless':
      figure(ctx, w, h, s, mode, { coat: '#4a4438', prop: (x, hy) => { roundRect(ctx, x + 14, hy + 40, 14, 11, 2); fillInk(ctx, '#6a5232', 2); roundRect(ctx, x + 5, hy - 12, 6, 4, 1); fillInk(ctx, '#fff0b0', 1.2); } });
      return true;
    case 'gt_coalborn':
      for (let i = 0; i < 6; i++) blob(ctx, cx - 12 + (i % 3) * 12, h - 14 - Math.floor(i / 3) * 12, 9, 8, '#3a3430', '#0e0c0a', 2.4);
      circle(ctx, cx - 5, h - 26, 2.4);
      fillInk(ctx, '#ffb040', 1);
      circle(ctx, cx + 5, h - 26, 2.4);
      fillInk(ctx, '#ffb040', 1);
      ellipse(ctx, cx, h - 18, 6, 2.4);
      fillInk(ctx, mode === 'windup' ? '#ffd060' : '#ff5a10', 1.4);
      return true;
    case 'gt_porter':
      figure(ctx, w, h, s, mode, { coat: '#5a1a18', hat: 'peak', hatCol: '#2a0e0c', scale: 1.2, prop: (x, hy) => { roundRect(ctx, x - 26, hy + 26, 52, 36, 4); fillInk(ctx, shade(ctx, x - 10, hy + 30, 40, '#7a5028', '#2a1a0c'), 3); for (const y of [34, 46, 56]) { ctx.fillStyle = '#b8902e'; ctx.fillRect(x - 25, hy + y, 50, 2.4); } } });
      return true;
    case 'gt_navvy':
      figure(ctx, w, h, s, mode, { coat: '#2a2622', hat: 'cap', hatCol: '#2a2420', scale: 1.38, prop: (x, hy) => {
        ctx.strokeStyle = '#5a3a20';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + 16, hy + 42);
        ctx.lineTo(x + 4, hy - 4);
        ctx.stroke();
        roundRect(ctx, x - 6, hy - 16, 18, 12, 2);
        fillInk(ctx, '#3a3c40', 2);
      } });
      return true;
    case 'gt_railcrawler': {
      const cy = 24;
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) hose(ctx, cx + side * 10, cy + 2 + k * 3, cx + side * 26, cy - 14 + k * 4 + s * side * 2, cx + side * (34 + k * 2), h - 6, 2.4, '#3a3a3c');
      roundRect(ctx, cx - 14, cy - 8, 28, 18, 5);
      fillInk(ctx, shade(ctx, cx - 4, cy - 4, 20, '#5a4a40', '#1a1412'), 3);
      circle(ctx, cx, cy + 1, 5);
      fillInk(ctx, '#ffe0a0', 2);
      return true;
    }
    case 'gt_mourner':
      figure(ctx, w, h, s, mode, { coat: '#1a181c', hat: 'veil', skirt: true, eye: '#d8e0ff' });
      return true;
    case 'gt_signalman':
      figure(ctx, w, h, s, mode, { coat: '#2a3424', hat: 'cap', hatCol: '#1e2418', prop: (x, hy) => { const up = mode === 'windup' ? -26 : 0; roundRect(ctx, x - 26, hy + 34 + up, 10, 12, 2); fillInk(ctx, '#2a2a2a', 2); circle(ctx, x - 21, hy + 40 + up, 3.4); fillInk(ctx, '#ff3020', 1.4); } });
      return true;
    case 'gt_commuter':
      figure(ctx, w, h, s, mode, { coat: '#2a2a30', hat: 'bowler', skin: '#c8b890', eye: '#fff0c0', prop: (x, hy) => { ctx.strokeStyle = '#101012'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 18, hy + 30); ctx.lineTo(x + 24, hy + 70); ctx.stroke(); } });
      return true;
    case 'gt_newsboy':
      figure(ctx, w, h, s, mode, { coat: '#3a3428', hat: 'cap', hatCol: '#4a4438', scale: 0.8, prop: (x, hy) => { roundRect(ctx, x - 24, hy + 4 + (mode === 'windup' ? -10 : 0), 12, 9, 1); fillInk(ctx, '#e0d8c0', 1.6); } });
      return true;
    case 'gt_mimic': {
      const open = mode === 'windup' ? 0.5 : 0.2;
      roundRect(ctx, cx - 26, h - 30, 52, 24, 4);
      fillInk(ctx, shade(ctx, cx - 8, h - 24, 34, '#7a5028', '#2a1a0c'), 3);
      ctx.save();
      ctx.translate(cx - 26, h - 30);
      ctx.rotate(-open);
      roundRect(ctx, 0, -12, 52, 12, 4);
      fillInk(ctx, '#5a3a1e', 3);
      ctx.restore();
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = '#e0d8c0';
        ctx.beginPath();
        ctx.moveTo(cx - 20 + i * 8, h - 30);
        ctx.lineTo(cx - 16 + i * 8, h - 24);
        ctx.lineTo(cx - 12 + i * 8, h - 30);
        ctx.fill();
      }
      circle(ctx, cx - 8, h - 38 - open * 10, 2.6);
      fillInk(ctx, '#ffd060', 1.2);
      circle(ctx, cx + 8, h - 38 - open * 10, 2.6);
      fillInk(ctx, '#ffd060', 1.2);
      return true;
    }
    case 'gt_gravebound':
      figure(ctx, w, h, s, mode, { coat: '#8a8270', skin: '#8a8468', hat: 'none', eye: '#b8ff90' });
      return true;
    case 'gt_moth':
      for (const side of [-1, 1]) {
        ellipse(ctx, cx + side * 18, 22 + s * 3, 18, 12, side * (0.3 + s * 0.2));
        fillInk(ctx, '#e0d8c8', 2.4);
        circle(ctx, cx + side * 20, 22, 4);
        fillInk(ctx, '#2a2228', 1.2);
      }
      ellipse(ctx, cx, 26, 5, 12);
      fillInk(ctx, '#d8d0c0', 2.4);
      return true;
    case 'gt_pallbearer':
      for (let i = 0; i < 4; i++) {
        const x = cx - 30 + i * 20;
        hose(ctx, x, h - 40, x + s * 2, h - 22, x, h - 6, 4, '#18161a');
        roundRect(ctx, x - 7, h - 62, 14, 24, 4);
        fillInk(ctx, '#18161a', 2.4);
        circle(ctx, x, h - 68, 6);
        fillInk(ctx, GREY, 2.4);
      }
      roundRect(ctx, cx - 44, h - 88 + (mode === 'windup' ? -10 : 0), 88, 16, 4);
      fillInk(ctx, shade(ctx, cx - 10, h - 84, 50, '#4a2a1a', '#140a06'), 3);
      return true;
    case 'gt_slag':
      blob(ctx, cx, h - 44, 34, 38, '#4a3a30', '#140e0a');
      for (const [x, y] of [[-12, -50], [10, -36], [-4, -24], [14, -60]]) {
        ellipse(ctx, cx + x, h + y, 5, 3);
        fillInk(ctx, '#ff8a30', 1);
      }
      for (const side of [-1, 1]) blob(ctx, cx + side * 34, h - 26 + (mode === 'windup' ? -20 : 0), 12, 12, '#3a2e26', '#100a08', 2.4);
      circle(ctx, cx - 7, h - 70, 3);
      fillInk(ctx, '#ffe080', 1);
      circle(ctx, cx + 7, h - 70, 3);
      fillInk(ctx, '#ffe080', 1);
      return true;
    case 'gt_riveter':
      figure(ctx, w, h, s, mode, { coat: '#3a3a3c', skin: '#4a4a4c', hat: 'none', eye: '#ff9a40', prop: (x, hy) => { roundRect(ctx, x - 30, hy + 26 + (mode === 'windup' ? -8 : 0), 16, 9, 2); fillInk(ctx, '#2a2a2a', 2); } });
      return true;
    case 'gt_hound': {
      const cy = 26;
      for (const [dx, ph] of [[-22, 0], [-12, 0.5], [14, 0.25], [24, 0.75]]) hose(ctx, cx + dx, cy + 8, cx + dx + Math.sin((s + ph) * 3) * 4, cy + 18, cx + dx, h - 6, 3.4, '#2a2a2c');
      roundRect(ctx, cx - 28, cy - 6, 50, 20, 8);
      fillInk(ctx, shade(ctx, cx - 10, cy - 2, 30, '#4a4a4c', '#141414'), 3);
      roundRect(ctx, cx - 18, cy + 8, 30, 5, 2);
      fillInk(ctx, '#ff6a18', 1.4);
      roundRect(ctx, cx + 18, cy - 14, 18, 14, 4);
      fillInk(ctx, '#3a3a3c', 2.4);
      circle(ctx, cx + 30, cy - 8, 2.2);
      fillInk(ctx, '#ff8a30', 1);
      return true;
    }
    case 'gt_stillfolk':
      figure(ctx, w, h, s, mode, { coat: '#5a5248', skin: '#8a8a86', hat: 'cap', hatCol: '#4a4440', skirt: true, eye: '#f0e8c8' });
      return true;
    case 'gt_watcher':
      figure(ctx, w, h, 0, mode, { coat: '#101012', skin: '#1a1a1e', hat: 'bowler', scale: 1.5, eye: '#fff8e0', skirt: true });
      return true;
    case 'gt_bellwraith':
      ctx.beginPath();
      ctx.moveTo(cx - 10, 30);
      ctx.quadraticCurveTo(cx - 26, h - 20, cx - 20, h - 8);
      ctx.lineTo(cx + 20, h - 8);
      ctx.quadraticCurveTo(cx + 26, h - 20, cx + 10, 30);
      ctx.closePath();
      fillInk(ctx, shade(ctx, cx - 6, 50, 40, '#d8d0c0', '#5a5448'), 3);
      ellipse(ctx, cx, 24, 11, 13);
      fillInk(ctx, '#c8c0b0', 3);
      ellipse(ctx, cx, 26, 6, 8);
      fillInk(ctx, '#0a0a0e', 1.4);
      ctx.beginPath();
      ctx.moveTo(cx - 24, 54 + (mode === 'windup' ? -12 : 0));
      ctx.lineTo(cx - 32, 70 + (mode === 'windup' ? -12 : 0));
      ctx.lineTo(cx - 16, 70 + (mode === 'windup' ? -12 : 0));
      ctx.closePath();
      fillInk(ctx, '#c8a050', 2.4);
      return true;
    case 'gt_collected':
      blob(ctx, cx, h - 40, 40, 36, '#8a8a90', '#2a2228');
      for (const [x, y] of [[-14, -56], [10, -62], [-2, -36], [18, -38], [-20, -30]]) {
        circle(ctx, cx + x, h + y, 7);
        fillInk(ctx, GREY, 2);
        pieEye(ctx, cx + x - 2, h + y, 1.4, 1.8, 0, 0, { glow: '#d8e0ff' });
        pieEye(ctx, cx + x + 2, h + y, 1.4, 1.8, 0, 0, { glow: '#d8e0ff' });
      }
      return true;
    case 'gt_puncher':
    case 'gt_inspector': {
      const big = id === 'gt_inspector';
      figure(ctx, w, h, s, mode, { coat: big ? '#1a2030' : '#22242c', hat: 'peak', hatCol: '#10141c', scale: big ? 1.4 : 1, eye: big ? '#ffd080' : '#d8e8ff', prop: (x, hy) => { const k = big ? 1.4 : 1, up = mode === 'windup' ? -20 * k : 0; roundRect(ctx, x - 30 * k, hy + 30 * k + up, 8 * k, 16 * k, 2); fillInk(ctx, '#c8a050', 2); } });
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- boss portraits (200 x 200)
export function drawGhostTrainPortrait(ctx: Ctx, id: string): boolean {
  const W = 200;
  const body = (coat: string, hat: 'peak' | 'veil' | 'none', skin: string, eye: string) => {
    softShadow(ctx, 100, 190, 70, 9);
    ctx.beginPath();
    ctx.moveTo(44, 200);
    ctx.lineTo(62, 118);
    ctx.lineTo(138, 118);
    ctx.lineTo(156, 200);
    ctx.closePath();
    fillInk(ctx, shade(ctx, 90, 140, 70, coat, '#0a0a0a'), 3);
    ellipse(ctx, 100, 86, 28, 34);
    fillInk(ctx, shade(ctx, 92, 74, 40, skin, '#3a4046'), 3);
    pieEye(ctx, 89, 84, 4.5, 5.5, 0, 0, { glow: eye });
    pieEye(ctx, 111, 84, 4.5, 5.5, 0, 0, { glow: eye });
    if (hat === 'peak') {
      roundRect(ctx, 70, 46, 60, 22, 4);
      fillInk(ctx, '#10141a', 3);
      roundRect(ctx, 92, 50, 16, 9, 2);
      fillInk(ctx, '#c8a050', 1.6);
      ellipse(ctx, 100, 70, 34, 6);
      fillInk(ctx, '#0a0a0e', 2.4);
    }
    if (hat === 'veil') {
      ctx.beginPath();
      ctx.moveTo(62, 50);
      ctx.lineTo(138, 50);
      ctx.lineTo(146, 132);
      ctx.lineTo(54, 132);
      ctx.closePath();
      ctx.fillStyle = 'rgba(12,10,14,0.85)';
      ctx.fill();
      ink(ctx, 3);
      ctx.stroke();
      circle(ctx, 89, 86, 3);
      fillInk(ctx, '#d8e4ff', 1);
      circle(ctx, 111, 86, 3);
      fillInk(ctx, '#d8e4ff', 1);
    }
  };
  const dial = (x: number, y: number, r: number) => {
    circle(ctx, x, y, r);
    fillInk(ctx, '#f0e8c8', 3);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.fillStyle = '#1a1612';
      ctx.fillRect(x + Math.sin(a) * r * 0.8 - 1, y - Math.cos(a) * r * 0.8 - 1, 2.4, 2.4);
    }
    ctx.strokeStyle = '#1a1612';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + r * 0.5, y - r * 0.3);
    ctx.moveTo(x, y);
    ctx.lineTo(x - r * 0.1, y - r * 0.75);
    ctx.stroke();
  };
  switch (id) {
    case 'stationmaster':
      dial(150, 130, 40);
      body('#1e2a24', 'peak', '#a4aab0', '#ffe8b0');
      circle(ctx, 52, 160, 10);
      fillInk(ctx, '#ff3020', 2.4);
      return true;
    case 'stoker':
      softShadow(ctx, 100, 190, 76, 9);
      ellipse(ctx, 100, 128, 62, 66);
      fillInk(ctx, shade(ctx, 84, 110, 80, '#3a302a', '#0e0a08'), 3);
      roundRect(ctx, 78, 112, 44, 30, 4);
      fillInk(ctx, '#ff7020', 3);
      circle(ctx, 86, 70, 5);
      fillInk(ctx, '#ffb040', 1.4);
      circle(ctx, 114, 70, 5);
      fillInk(ctx, '#ffb040', 1.4);
      roundRect(ctx, 150, 40, 8, 120, 3);
      fillInk(ctx, '#4a3a28', 2.4);
      return true;
    case 'widow':
      body('#18161a', 'veil', '#a4aab0', '#d8e4ff');
      circle(ctx, 154, 150, 12);
      fillInk(ctx, '#9ad8ff', 2.4);
      return true;
    case 'foreman':
      softShadow(ctx, 100, 190, 76, 9);
      roundRect(ctx, 50, 70, 100, 124, 20);
      fillInk(ctx, shade(ctx, 84, 100, 80, '#5a5856', '#1a1816'), 3);
      for (const y of [96, 126, 156]) {
        ctx.fillStyle = '#b8902e';
        ctx.fillRect(50, y, 100, 4);
      }
      circle(ctx, 100, 50, 26);
      fillInk(ctx, '#3a3836', 3);
      circle(ctx, 100, 50, 12);
      fillInk(ctx, '#ffa040', 2.4);
      roundRect(ctx, 6, 110, 40, 30, 6);
      fillInk(ctx, '#2a2a2a', 3);
      return true;
    case 'hour_thief':
      softShadow(ctx, 100, 190, 60, 8);
      roundRect(ctx, 70, 92, 60, 100, 6);
      fillInk(ctx, '#1a1410', 3);
      dial(100, 56, 38);
      ctx.strokeStyle = '#1a1612';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(70, 104);
      ctx.lineTo(20, 168);
      ctx.moveTo(130, 104);
      ctx.lineTo(186, 150);
      ctx.stroke();
      return true;
    case 'unclaimed': {
      // a heap of left luggage on umbrella legs, a trunk's lid for a jaw, two lamps in the dark of it
      softShadow(ctx, 100, 190, 80, 9);
      ctx.strokeStyle = '#1a1612';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (const x of [56, 78, 122, 144]) {
        ctx.moveTo(x, 150);
        ctx.lineTo(x + (x < 100 ? -10 : 10), 188);
      }
      ctx.stroke();
      const cases: [number, number, number, number, string][] = [[40, 112, 70, 44, '#6a4a2e'], [92, 118, 70, 38, '#4a3a5a'], [56, 74, 56, 40, '#7a6a48'], [104, 80, 52, 40, '#5a3a2a'], [70, 44, 60, 34, '#3a2a20']];
      for (const [x, y, w, hh, col] of cases) {
        roundRect(ctx, x, y, w, hh, 5);
        fillInk(ctx, col, 3);
        ctx.fillStyle = '#c8a050';
        ctx.fillRect(x + w / 2 - 3, y + 2, 6, hh - 4);
      }
      circle(ctx, 150, 66, 16);
      fillInk(ctx, '#2a2a2e', 2.4);
      roundRect(ctx, 74, 46, 52, 14, 3);
      fillInk(ctx, '#140c08', 2);
      circle(ctx, 88, 54, 4);
      fillInk(ctx, '#ffd890', 1.2);
      circle(ctx, 112, 54, 4);
      fillInk(ctx, '#ffd890', 1.2);
      return true;
    }
    case 'night_express':
      softShadow(ctx, 100, 190, 86, 10);
      roundRect(ctx, 24, 70, 152, 100, 24);
      fillInk(ctx, shade(ctx, 80, 100, 100, '#2a2a2e', '#08080a'), 3);
      circle(ctx, 100, 106, 30);
      fillInk(ctx, '#14141a', 3);
      circle(ctx, 100, 106, 18);
      fillInk(ctx, '#fff0c0', 2.4);
      roundRect(ctx, 80, 22, 40, 52, 6);
      fillInk(ctx, '#101012', 3);
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = '#d8d0c0';
        ctx.beginPath();
        ctx.moveTo(56 + i * 13, 150);
        ctx.lineTo(62 + i * 13, 140);
        ctx.lineTo(68 + i * 13, 150);
        ctx.fill();
      }
      return true;
    case 'conductor':
      body('#1a2030', 'peak', '#a4aab0', '#ffe8a0');
      roundRect(ctx, 40, 140, 14, 34, 3);
      fillInk(ctx, '#c8a050', 2.4);
      circle(ctx, 160, 156, 11);
      fillInk(ctx, '#ffe0a0', 2.4);
      return true;
  }
  void W;
  return false;
}
