// Icons for the Nightmare and Hell shelves of the Lost & Found (D-97): the cast's inked badge style, in the tier's
// colours (spectral blue for Nightmare, ember for Hell), each with its own symbol.

import { INK, circle, fillInk, ink, shade, shine, type Ctx } from './kit';
import { badge } from './icons';

const COLD = { body: '#bfe6ff', dark: '#3a5a8a', glow: '#e8f7ff' };
const HOT = { body: '#ffb24a', dark: '#8a2410', glow: '#fff1c0' };

function heart(ctx: Ctx, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.8, cy - s * 1.1, cx, cy - s * 0.4);
  ctx.bezierCurveTo(cx + s * 0.8, cy - s * 1.1, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.closePath();
}

function flame(ctx: Ctx, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 1.2);
  ctx.bezierCurveTo(cx + s * 0.35, cy - s * 0.6, cx + s * 0.9, cy - s * 0.2, cx + s * 0.7, cy + s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.55, cy + s * 0.95, cx - s * 0.55, cy + s * 0.95, cx - s * 0.7, cy + s * 0.45);
  ctx.bezierCurveTo(cx - s * 0.9, cy - s * 0.1, cx - s * 0.2, cy - s * 0.35, cx, cy - s * 1.2);
  ctx.closePath();
}

/** Paint the shelf item `id`'s icon; false if it isn't one of theirs. */
export function tierIcon(ctx: Ctx, w: number, h: number, id: string): boolean {
  const cx = w / 2, cy = h / 2, s = w * 0.18;
  const cold = ['second_chance', 'soul_collector', 'prize_hunter', 'opening_act', 'second_wind', 'deaths_door', 'soul_jar'].includes(id);
  const hot = ['devils_bargain', 'final_act', 'unfinished_business', 'infernal_resilience', 'ember_heart', 'brimstone', 'cinder_heart'].includes(id);
  if (!cold && !hot) return false;
  const c = cold ? COLD : HOT;
  badge(ctx, w, h, cold ? '#2c3f66' : '#5a1a10', false);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (id) {
    case 'second_chance': {
      heart(ctx, cx, cy + s * 0.1, s * 1.15);
      fillInk(ctx, shade(ctx, cx - s * 0.4, cy - s * 0.4, s * 1.6, '#ff8da0', '#8a1a30'));
      // the mend across it
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.2, cy - s * 0.5);
      ctx.lineTo(cx + s * 0.15, cy - s * 0.05);
      ctx.lineTo(cx - s * 0.15, cy + s * 0.25);
      ctx.lineTo(cx + s * 0.1, cy + s * 0.65);
      ctx.strokeStyle = c.glow;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      shine(ctx, cx - s * 0.55, cy - s * 0.35, s * 0.3);
      break;
    }
    case 'soul_collector': {
      // a jar of wisps
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.8, cy - s * 0.6);
      ctx.lineTo(cx + s * 0.8, cy - s * 0.6);
      ctx.quadraticCurveTo(cx + s * 1.1, cy + s * 1.1, cx, cy + s * 1.1);
      ctx.quadraticCurveTo(cx - s * 1.1, cy + s * 1.1, cx - s * 0.8, cy - s * 0.6);
      ctx.closePath();
      fillInk(ctx, 'rgba(160,210,255,0.35)');
      for (const [dx, dy, r] of [[-0.35, 0.45, 0.32], [0.3, 0.25, 0.4], [0, 0.75, 0.25]]) {
        flame(ctx, cx + dx * s, cy + dy * s, r * s);
        ctx.fillStyle = c.glow;
        ctx.fill();
      }
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(cx - s * 0.9, cy - s * 0.95, s * 1.8, s * 0.4);
      ink(ctx, 2);
      ctx.strokeRect(cx - s * 0.9, cy - s * 0.95, s * 1.8, s * 0.4);
      break;
    }
    case 'prize_hunter': {
      // a chest with a spectral eye on it
      ctx.beginPath();
      ctx.rect(cx - s * 1.1, cy - s * 0.2, s * 2.2, s * 1.1);
      fillInk(ctx, '#8a5a2a');
      ctx.beginPath();
      ctx.moveTo(cx - s * 1.1, cy - s * 0.2);
      ctx.quadraticCurveTo(cx, cy - s * 1.2, cx + s * 1.1, cy - s * 0.2);
      ctx.closePath();
      fillInk(ctx, '#a8743a');
      circle(ctx, cx, cy + s * 0.25, s * 0.32);
      fillInk(ctx, c.body, 2);
      circle(ctx, cx, cy + s * 0.25, s * 0.12);
      ctx.fillStyle = INK;
      ctx.fill();
      break;
    }
    case 'opening_act': {
      // drawn-back curtains on a lit stage
      ctx.beginPath();
      ctx.rect(cx - s * 1.2, cy - s * 1.1, s * 2.4, s * 2.1);
      fillInk(ctx, shade(ctx, cx, cy, s * 1.4, c.glow, c.dark), 2.4);
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + sgn * s * 1.2, cy - s * 1.1);
        ctx.quadraticCurveTo(cx + sgn * s * 0.2, cy - s * 0.2, cx + sgn * s * 0.75, cy + s * 1.0);
        ctx.lineTo(cx + sgn * s * 1.2, cy + s * 1.0);
        ctx.closePath();
        fillInk(ctx, '#a8203a', 2);
      }
      break;
    }
    case 'second_wind': {
      // a gust: three arcs
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      for (let pass = 0; pass < 2; pass++) {
        for (const [y, len] of [[-0.6, 1.1], [0, 1.5], [0.6, 0.9]]) {
          ctx.beginPath();
          ctx.moveTo(cx - s * 1.2, cy + y * s);
          ctx.lineTo(cx - s * 1.2 + len * s, cy + y * s);
          ctx.arc(cx - s * 1.2 + len * s, cy + y * s - s * 0.3, s * 0.3, Math.PI / 2, -Math.PI * 0.9, true);
          ctx.stroke();
        }
        ctx.strokeStyle = c.glow;
        ctx.lineWidth = 2.6;
      }
      break;
    }
    case 'devils_bargain': {
      // a signed contract under a pair of horns
      ctx.beginPath();
      ctx.rect(cx - s * 0.8, cy - s * 0.3, s * 1.6, s * 1.4);
      fillInk(ctx, '#f0e0c0', 2.2);
      ctx.strokeStyle = '#7a1a10';
      ctx.lineWidth = 1.6;
      for (const y of [0.05, 0.35, 0.65]) {
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.55, cy + y * s);
        ctx.lineTo(cx + s * 0.5, cy + y * s);
        ctx.stroke();
      }
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + sgn * s * 0.35, cy - s * 0.35);
        ctx.quadraticCurveTo(cx + sgn * s * 1.2, cy - s * 0.6, cx + sgn * s * 0.9, cy - s * 1.35);
        ctx.quadraticCurveTo(cx + sgn * s * 0.85, cy - s * 0.8, cx + sgn * s * 0.05, cy - s * 0.55);
        ctx.closePath();
        fillInk(ctx, shade(ctx, cx + sgn * s * 0.6, cy - s * 0.9, s, '#ff6a3a', '#5a0a04'), 2);
      }
      break;
    }
    case 'final_act': {
      // an hourglass running out, embers in the glass
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.8, cy - s * 1.1);
      ctx.lineTo(cx + s * 0.8, cy - s * 1.1);
      ctx.lineTo(cx + s * 0.1, cy);
      ctx.lineTo(cx + s * 0.8, cy + s * 1.1);
      ctx.lineTo(cx - s * 0.8, cy + s * 1.1);
      ctx.lineTo(cx - s * 0.1, cy);
      ctx.closePath();
      fillInk(ctx, 'rgba(255,220,180,0.35)', 2.4);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.6, cy + s * 1.0);
      ctx.lineTo(cx + s * 0.6, cy + s * 1.0);
      ctx.lineTo(cx, cy + s * 0.35);
      ctx.closePath();
      ctx.fillStyle = c.body;
      ctx.fill();
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(cx - s * 1.0, cy - s * 1.3, s * 2.0, s * 0.25);
      ctx.fillRect(cx - s * 1.0, cy + s * 1.05, s * 2.0, s * 0.25);
      break;
    }
    case 'unfinished_business': {
      // a cracked crown
      ctx.beginPath();
      ctx.moveTo(cx - s * 1.1, cy + s * 0.8);
      ctx.lineTo(cx - s * 1.1, cy - s * 0.5);
      ctx.lineTo(cx - s * 0.5, cy);
      ctx.lineTo(cx, cy - s * 0.9);
      ctx.lineTo(cx + s * 0.5, cy);
      ctx.lineTo(cx + s * 1.1, cy - s * 0.5);
      ctx.lineTo(cx + s * 1.1, cy + s * 0.8);
      ctx.closePath();
      fillInk(ctx, shade(ctx, cx - s * 0.4, cy - s * 0.4, s * 1.8, '#ffe28a', '#8a5a10'));
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.1, cy - s * 0.5);
      ctx.lineTo(cx - s * 0.2, cy + s * 0.1);
      ctx.lineTo(cx + s * 0.15, cy + s * 0.4);
      ctx.lineTo(cx - s * 0.05, cy + s * 0.8);
      ink(ctx, 2);
      ctx.stroke();
      circle(ctx, cx - s * 0.6, cy + s * 0.35, s * 0.16);
      ctx.fillStyle = '#ff4a2a';
      ctx.fill();
      break;
    }
    case 'infernal_resilience': {
      // a shield with a flame on it
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 1.2);
      ctx.lineTo(cx + s * 1.0, cy - s * 0.8);
      ctx.quadraticCurveTo(cx + s * 1.0, cy + s * 0.6, cx, cy + s * 1.25);
      ctx.quadraticCurveTo(cx - s * 1.0, cy + s * 0.6, cx - s * 1.0, cy - s * 0.8);
      ctx.closePath();
      fillInk(ctx, shade(ctx, cx - s * 0.4, cy - s * 0.5, s * 1.8, '#9aa4b0', '#2a2e36'));
      flame(ctx, cx, cy + s * 0.1, s * 0.6);
      fillInk(ctx, shade(ctx, cx, cy, s * 0.7, c.glow, '#ff4a10'), 1.8);
      break;
    }
    case 'deaths_door': {
      // a door ajar on a pale light, a key in the lock
      ctx.beginPath();
      ctx.rect(cx - s * 0.9, cy - s * 1.2, s * 1.8, s * 2.4);
      fillInk(ctx, shade(ctx, cx, cy, s * 1.6, c.glow, c.dark), 2.4);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.9, cy - s * 1.2);
      ctx.lineTo(cx + s * 0.3, cy - s * 0.95);
      ctx.lineTo(cx + s * 0.3, cy + s * 1.45);
      ctx.lineTo(cx - s * 0.9, cy + s * 1.2);
      ctx.closePath();
      fillInk(ctx, '#3a2a1a', 2.2);
      circle(ctx, cx + s * 0.05, cy + s * 0.15, s * 0.14);
      ctx.fillStyle = '#d8b04a';
      ctx.fill();
      break;
    }
    case 'soul_jar': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.6, cy - s * 0.8);
      ctx.lineTo(cx + s * 0.6, cy - s * 0.8);
      ctx.quadraticCurveTo(cx + s * 1.2, cy + s * 0.2, cx + s * 0.7, cy + s * 1.15);
      ctx.lineTo(cx - s * 0.7, cy + s * 1.15);
      ctx.quadraticCurveTo(cx - s * 1.2, cy + s * 0.2, cx - s * 0.6, cy - s * 0.8);
      ctx.closePath();
      fillInk(ctx, 'rgba(150,220,255,0.4)');
      flame(ctx, cx, cy + s * 0.35, s * 0.55);
      ctx.fillStyle = c.glow;
      ctx.fill();
      ctx.fillStyle = '#c8a070';
      ctx.fillRect(cx - s * 0.5, cy - s * 1.15, s * 1.0, s * 0.38);
      ink(ctx, 1.8);
      ctx.strokeRect(cx - s * 0.5, cy - s * 1.15, s * 1.0, s * 0.38);
      break;
    }
    case 'brimstone': {
      // a glowing lump, cracked with fire
      ctx.beginPath();
      ctx.moveTo(cx - s * 1.0, cy + s * 0.3);
      ctx.lineTo(cx - s * 0.6, cy - s * 0.7);
      ctx.lineTo(cx + s * 0.3, cy - s * 0.95);
      ctx.lineTo(cx + s * 1.05, cy - s * 0.2);
      ctx.lineTo(cx + s * 0.7, cy + s * 0.85);
      ctx.lineTo(cx - s * 0.4, cy + s * 0.95);
      ctx.closePath();
      fillInk(ctx, shade(ctx, cx - s * 0.3, cy - s * 0.4, s * 1.6, '#5a4a40', '#1a1210'));
      ctx.strokeStyle = '#ff8a2a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.5, cy - s * 0.3);
      ctx.lineTo(cx + s * 0.05, cy + s * 0.1);
      ctx.lineTo(cx + s * 0.6, cy - s * 0.2);
      ctx.moveTo(cx + s * 0.05, cy + s * 0.1);
      ctx.lineTo(cx - s * 0.05, cy + s * 0.7);
      ctx.stroke();
      break;
    }
    case 'cinder_heart': {
      heart(ctx, cx, cy + s * 0.1, s * 1.05);
      fillInk(ctx, shade(ctx, cx - s * 0.4, cy - s * 0.4, s * 1.6, '#4a3a34', '#120a08'));
      ctx.strokeStyle = '#ff9a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.5, cy - s * 0.2);
      ctx.lineTo(cx, cy + s * 0.15);
      ctx.lineTo(cx + s * 0.45, cy - s * 0.25);
      ctx.moveTo(cx, cy + s * 0.15);
      ctx.lineTo(cx, cy + s * 0.65);
      ctx.stroke();
      break;
    }
    case 'ember_heart': {
      heart(ctx, cx, cy + s * 0.15, s * 1.15);
      fillInk(ctx, shade(ctx, cx - s * 0.4, cy - s * 0.4, s * 1.6, '#ff7a3a', '#5a0a04'));
      flame(ctx, cx, cy + s * 0.25, s * 0.5);
      ctx.fillStyle = c.glow;
      ctx.fill();
      break;
    }
  }
  ctx.restore();
  return true;
}
