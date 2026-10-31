// Weapon / passive / evolution icons for the HUD tray, draft cards and the Carnival-pedia.
// Each icon is painted inside a 64×64 badge.

import { INK, PAL, circle, ellipse, fillInk, glove, hose, ink, pieEye, roundRect, shade, shine, shoe, stripes, vstripes, type Ctx } from './kit';
import { card, cannonball, derbyCar, dart, kernel, plushPet, ring, rocket, tarotCard } from './items';

function sub(ctx: Ctx, x: number, y: number, w: number, h: number, fn: (c: Ctx, w: number, h: number) => void, rot = 0): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot);
  ctx.translate(-w / 2, -h / 2);
  fn(ctx, w, h);
  ctx.restore();
}

export function badge(ctx: Ctx, w: number, h: number, color: string, evo: boolean): void {
  const cx = w / 2, cy = h / 2;
  if (evo) {
    // golden sunburst
    ctx.save();
    ctx.fillStyle = '#ffe9a0';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - 0.1) * w * 0.5, cy + Math.sin(a - 0.1) * h * 0.5);
      ctx.lineTo(cx + Math.cos(a + 0.1) * w * 0.5, cy + Math.sin(a + 0.1) * h * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  circle(ctx, cx, cy, w * 0.42);
  fillInk(ctx, shade(ctx, cx, cy, w * 0.42, color, '#1a1028'), 3);
  circle(ctx, cx, cy, w * 0.36);
  ink(ctx, 1.4);
  ctx.strokeStyle = evo ? '#ffe36a' : 'rgba(255,240,200,0.55)';
  ctx.setLineDash([2, 2.5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function weaponIcon(ctx: Ctx, w: number, h: number, kind: string, evo: boolean): void {
  const bg: Record<string, string> = {
    cards: '#a83040', mallet: '#a86a30', tarot: '#6a3a9a', bumper: '#2f6f9f', plush: '#c86a9a', tophat: '#8a2030',
    popcorn: '#c8a030', darts: '#c8406a', fireworks: '#3a3a9a', cotton: '#e07ab0', rings: '#3a8a6a', cannon: '#7a3020',
    snowcone: '#3a8ac8', grill: '#c84a20', laser: '#5a2aa0', orbs: '#2a6aa0', bell: '#a0802a', mirror: '#4a7a8a',
    calliope: '#7a2a40',
  };
  badge(ctx, w, h, bg[kind] ?? '#5a4a6a', evo);
  const s = w / 64;
  ctx.save();
  ctx.scale(s, s);
  switch (kind) {
    case 'cards':
      for (let i = 0; i < 3; i++) sub(ctx, 16 + i * 5, 14, 22, 30, (c, ww, hh) => card(c, ww, hh, evo), -0.4 + i * 0.35);
      break;
    case 'mallet':
      ctx.save();
      ctx.translate(32, 34);
      ctx.rotate(-0.6);
      roundRect(ctx, -3, -4, 6, 26, 2);
      fillInk(ctx, PAL.woodLight, 2);
      roundRect(ctx, -14, -16, 28, 14, 5);
      fillInk(ctx, evo ? '#ffd23a' : PAL.red, 2.4);
      ctx.restore();
      break;
    case 'tarot':
      sub(ctx, 18, 12, 28, 40, (c, ww, hh) => tarotCard(c, ww, hh, evo));
      break;
    case 'bumper':
      sub(ctx, 12, 18, 40, 28, (c, ww, hh) => derbyCar(c, ww, hh, evo));
      break;
    case 'plush':
      sub(ctx, 14, 12, 36, 40, (c, ww, hh) => plushPet(c, ww, hh, evo ? 1 : 0, 0));
      break;
    case 'tophat':
      ellipse(ctx, 32, 42, 18, 5);
      fillInk(ctx, '#1a1418', 2.4);
      roundRect(ctx, 21, 16, 22, 26, 2);
      fillInk(ctx, '#1a1418', 2.4);
      ctx.fillStyle = evo ? PAL.gold : PAL.red;
      ctx.fillRect(21.5, 33, 21, 4);
      for (const side of [-1, 1]) {
        ellipse(ctx, 32 + side * 3, 12, 2.4, 6, side * 0.2);
        fillInk(ctx, '#fffaf0', 1.4);
      }
      break;
    case 'popcorn':
      ctx.beginPath();
      ctx.moveTo(20, 24);
      ctx.lineTo(44, 24);
      ctx.lineTo(40, 50);
      ctx.lineTo(24, 50);
      ctx.closePath();
      vstripes(ctx, 18, 24, 28, 26, PAL.red, '#fffaf0', 5);
      ink(ctx, 2);
      ctx.beginPath();
      ctx.moveTo(20, 24);
      ctx.lineTo(44, 24);
      ctx.lineTo(40, 50);
      ctx.lineTo(24, 50);
      ctx.closePath();
      ctx.stroke();
      for (const [x, y] of [[22, 20], [30, 16], [38, 20], [26, 12], [35, 11]] as [number, number][]) sub(ctx, x - 6, y - 6, 12, 12, kernel);
      break;
    case 'darts':
      for (let i = 0; i < 3; i++) sub(ctx, 12, 16 + i * 10, 40, 12, dart, -0.5);
      if (evo) {
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = '#ff7bb0';
          circle(ctx, 44 + Math.cos(i) * 6, 18 + Math.sin(i) * 6, 3);
          ctx.fill();
        }
      }
      break;
    case 'fireworks':
      sub(ctx, 14, 26, 36, 14, (c, ww, hh) => rocket(c, ww, hh, evo), -0.9);
      ctx.fillStyle = evo ? '#ffe36a' : '#ff7bb0';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        circle(ctx, 42 + Math.cos(a) * 9, 20 + Math.sin(a) * 9, 2);
        ctx.fill();
      }
      break;
    case 'cotton':
      for (const [x, y, r] of [[28, 24, 10], [37, 22, 9], [32, 16, 9]] as [number, number, number][]) {
        circle(ctx, x, y, r);
        fillInk(ctx, evo ? '#ff9ac8' : '#ffc6e0', 2);
      }
      ink(ctx, 4);
      ctx.strokeStyle = '#fffaf0';
      ctx.beginPath();
      ctx.moveTo(32, 30);
      ctx.lineTo(28, 52);
      ctx.stroke();
      break;
    case 'rings':
      sub(ctx, 12, 14, 26, 26, (c, ww, hh) => ring(c, ww, hh, evo));
      sub(ctx, 26, 24, 26, 26, (c, ww, hh) => ring(c, ww, hh, evo));
      break;
    case 'cannon':
      sub(ctx, 8, 20, 48, 24, cannonball, -0.3);
      break;
    case 'snowcone':
      ctx.beginPath();
      ctx.moveTo(22, 30);
      ctx.lineTo(42, 30);
      ctx.lineTo(32, 54);
      ctx.closePath();
      fillInk(ctx, '#f7eedb', 2);
      circle(ctx, 32, 24, 12);
      fillInk(ctx, shade(ctx, 32, 24, 12, '#e0f8ff', evo ? '#3a6ad0' : '#4fb8f0'), 2.4);
      shine(ctx, 28, 19, 2.4);
      break;
    case 'grill':
      ellipse(ctx, 32, 40, 16, 6);
      fillInk(ctx, '#3a3040', 2.4);
      for (let i = 0; i < 3; i++) {
        const fx = 22 + i * 10;
        ctx.beginPath();
        ctx.moveTo(fx - 5, 38);
        ctx.quadraticCurveTo(fx - 6, 26, fx, 14 + (i % 2) * 6);
        ctx.quadraticCurveTo(fx + 6, 26, fx + 5, 38);
        ctx.closePath();
        fillInk(ctx, shade(ctx, fx, 28, 10, '#fff36a', evo ? '#ff2a00' : '#ff7a1a'), 1.6);
      }
      break;
    case 'laser':
      for (let i = 0; i < (evo ? 6 : 3); i++) {
        const a = (i / (evo ? 6 : 3)) * Math.PI * 2 + 0.3;
        ctx.strokeStyle = ['#ff3aa0', '#3affd0', '#ffe03a'][i % 3];
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(32, 32);
        ctx.lineTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22);
        ctx.stroke();
      }
      circle(ctx, 32, 32, 6);
      fillInk(ctx, '#fffaf0', 2);
      break;
    case 'orbs':
      for (let i = 0; i < (evo ? 5 : 3); i++) {
        const a = (i / (evo ? 5 : 3)) * Math.PI * 2;
        const x = 32 + Math.cos(a) * 13, y = 32 + Math.sin(a) * 13;
        circle(ctx, x, y, evo ? 6 : 7);
        fillInk(ctx, shade(ctx, x, y, 7, '#e8fbff', evo ? '#a05ae8' : '#4f9ae8'), 2);
        shine(ctx, x - 2, y - 2, 1.4);
      }
      break;
    case 'bell':
      roundRect(ctx, 29, 14, 6, 40, 2);
      fillInk(ctx, PAL.red, 2);
      ctx.beginPath();
      ctx.moveTo(24, 22);
      ctx.quadraticCurveTo(24, 10, 32, 10);
      ctx.quadraticCurveTo(40, 10, 40, 22);
      ctx.closePath();
      fillInk(ctx, shade(ctx, 32, 16, 9, '#fff3a0', PAL.gold), 2.4);
      if (evo) {
        ctx.fillStyle = '#fff36a';
        ctx.font = 'bold 10px Georgia';
        ctx.fillText('DING', 34, 50);
      }
      break;
    case 'calliope': {
      // a little steam organ: brass pipes over a red cabinet with a keyboard, steam at the pipe tops
      const tops = [22, 15, 11, 15, 22];
      for (let k = 0; k < 5; k++) {
        const x = 17 + k * 6.4;
        roundRect(ctx, x, tops[k], 4.8, 38 - tops[k], 1.8);
        fillInk(ctx, shade(ctx, x + 2.4, tops[k] + 5, 9, '#fff2b0', PAL.gold), 1.5);
        ellipse(ctx, x + 2.4, tops[k] + 5, 1.5, 1.1);
        ctx.fillStyle = INK;
        ctx.fill();
      }
      roundRect(ctx, 13, 36, 38, 16, 3);
      fillInk(ctx, shade(ctx, 32, 40, 22, '#e8685e', PAL.red), 2.4);
      roundRect(ctx, 16.5, 41, 31, 7, 1.5);
      fillInk(ctx, '#f8f2e2', 1.3);
      ctx.fillStyle = INK;
      for (let k = 0; k < 4; k++) ctx.fillRect(20.5 + k * 7, 41, 2.6, 4.2);
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#f4f8ff';
      for (const [x, y, r] of [[21, 13, 3], [32.5, 8, 3.6], [44, 13, 3]]) {
        circle(ctx, x, y, r);
        ctx.fill();
      }
      ctx.restore();
      if (evo) {
        ctx.fillStyle = '#fff36a';
        ctx.font = 'bold 13px Georgia';
        ctx.fillText('♪', 6, 30);
        ctx.fillText('♫', 48, 30);
      }
      break;
    }
    case 'mirror':
      ellipse(ctx, 32, 32, 16, 21);
      fillInk(ctx, shade(ctx, 32, 32, 18, '#e8f8ff', '#7ab0c8'), 3);
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 3;
      ellipse(ctx, 32, 32, 16, 21);
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.7;
      pieEye(ctx, 27, 30, 3, 4, 0.5, 0);
      pieEye(ctx, 37, 30, 3, 4, -0.5, 0);
      ctx.restore();
      if (evo) {
        ellipse(ctx, 14, 32, 6, 9);
        fillInk(ctx, '#b0d8e8', 1.6);
        ellipse(ctx, 50, 32, 6, 9);
        fillInk(ctx, '#b0d8e8', 1.6);
      }
      break;
  }
  ctx.restore();
}

export function passiveIcon(ctx: Ctx, w: number, h: number, id: string): void {
  const bg: Record<string, string> = {
    strongman_belt: '#7a3a20', energy_drink: '#3a8a3a', spectacles: '#3a5a9a', foam_finger: '#2a5ab0', extra_token: '#a08020',
    spinning_top: '#9a3a6a', caffeine: '#5a3a20', running_shoes: '#a03030', sugar_rush: '#c06aa0', funnel_cake: '#b08040',
    safety_goggles: '#4a6a7a', magnet_glove: '#902a2a', lucky_ticket: '#3a8a5a', season_pass: '#3a4aa0', coin_purse: '#8a6a20',
    rabbits_foot: '#6a6a6a', hand_mirror: '#2a6a7a',
  };
  badge(ctx, w, h, bg[id] ?? '#5a4a6a', false);
  const s = w / 64;
  ctx.save();
  ctx.scale(s, s);
  switch (id) {
    case 'strongman_belt':
      roundRect(ctx, 12, 26, 40, 12, 4);
      fillInk(ctx, '#3a2a1a', 2.4);
      roundRect(ctx, 25, 22, 14, 20, 3);
      fillInk(ctx, shade(ctx, 32, 32, 10, '#fff3a0', PAL.gold), 2.4);
      break;
    case 'energy_drink':
      roundRect(ctx, 22, 14, 20, 38, 5);
      fillInk(ctx, shade(ctx, 32, 32, 18, '#b0ff8a', '#2a9a2a'), 2.4);
      ctx.fillStyle = '#fff36a';
      ctx.beginPath();
      ctx.moveTo(34, 20);
      ctx.lineTo(27, 34);
      ctx.lineTo(32, 34);
      ctx.lineTo(29, 46);
      ctx.lineTo(37, 30);
      ctx.lineTo(32, 30);
      ctx.closePath();
      ctx.fill();
      break;
    case 'spectacles':
      for (const x of [22, 42]) {
        circle(ctx, x, 32, 9);
        fillInk(ctx, 'rgba(200,240,255,0.7)', 2.6);
        shine(ctx, x - 3, 29, 1.6);
      }
      ink(ctx, 2.6);
      ctx.beginPath();
      ctx.moveTo(31, 31);
      ctx.quadraticCurveTo(32, 27, 33, 31);
      ctx.stroke();
      break;
    case 'foam_finger':
      ctx.beginPath();
      ctx.moveTo(20, 52);
      ctx.lineTo(20, 30);
      ctx.quadraticCurveTo(20, 24, 26, 24);
      ctx.lineTo(28, 24);
      ctx.lineTo(28, 10);
      ctx.quadraticCurveTo(32, 6, 36, 10);
      ctx.lineTo(36, 24);
      ctx.quadraticCurveTo(44, 24, 44, 32);
      ctx.lineTo(44, 52);
      ctx.closePath();
      fillInk(ctx, shade(ctx, 32, 30, 20, '#7ab0ff', '#2a5ad0'), 2.6);
      ctx.fillStyle = '#fffaf0';
      ctx.font = 'bold 11px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText('#1', 32, 44);
      break;
    case 'extra_token':
      circle(ctx, 32, 32, 15);
      fillInk(ctx, shade(ctx, 32, 32, 15, '#fff3a0', PAL.gold), 2.6);
      ctx.fillStyle = '#7a5a10';
      ctx.font = 'bold 16px Georgia';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+1', 32, 33);
      break;
    case 'spinning_top':
      ctx.beginPath();
      ctx.moveTo(18, 28);
      ctx.quadraticCurveTo(32, 14, 46, 28);
      ctx.lineTo(32, 52);
      ctx.closePath();
      stripes(ctx, 16, 14, 32, 40, '#e8384f', '#f6cf4f', 4, 0);
      ink(ctx, 2.4);
      ctx.beginPath();
      ctx.moveTo(18, 28);
      ctx.quadraticCurveTo(32, 14, 46, 28);
      ctx.lineTo(32, 52);
      ctx.closePath();
      ctx.stroke();
      roundRect(ctx, 30, 10, 4, 10, 1);
      fillInk(ctx, PAL.woodLight, 1.6);
      break;
    case 'caffeine':
      roundRect(ctx, 18, 24, 24, 24, 4);
      fillInk(ctx, '#f7eedb', 2.4);
      ctx.beginPath();
      ctx.arc(44, 34, 6, -Math.PI / 2, Math.PI / 2);
      ink(ctx, 3);
      ctx.stroke();
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(20, 26, 20, 5);
      ink(ctx, 1.6);
      ctx.strokeStyle = '#fffaf0';
      for (const x of [24, 30, 36]) {
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.quadraticCurveTo(x + 3, 15, x, 10);
        ctx.stroke();
      }
      break;
    case 'running_shoes':
      shoe(ctx, 28, 36, 13, PAL.red);
      ink(ctx, 2);
      ctx.strokeStyle = '#fffaf0';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(8, 26 + i * 6);
        ctx.lineTo(16, 26 + i * 6);
        ctx.stroke();
      }
      break;
    case 'sugar_rush':
      for (const [x, y, r] of [[28, 26, 10], [37, 24, 9], [32, 17, 9]] as [number, number, number][]) {
        circle(ctx, x, y, r);
        fillInk(ctx, '#ff9ac8', 2);
      }
      ctx.beginPath();
      ctx.moveTo(24, 32);
      ctx.lineTo(40, 32);
      ctx.lineTo(32, 54);
      ctx.closePath();
      fillInk(ctx, '#f7eedb', 2);
      break;
    case 'funnel_cake':
      ellipse(ctx, 32, 36, 18, 12);
      fillInk(ctx, '#fffaf0', 2);
      ink(ctx, 3.4);
      ctx.strokeStyle = '#d99a4a';
      ctx.beginPath();
      for (let i = 0; i < 14; i++) ctx.lineTo(32 + Math.cos(i * 1.9) * 12 * (0.5 + (i % 3) * 0.25), 36 + Math.sin(i * 1.9) * 8 * (0.5 + (i % 2) * 0.4));
      ctx.stroke();
      break;
    case 'safety_goggles':
      roundRect(ctx, 12, 24, 40, 16, 8);
      fillInk(ctx, '#3a3040', 2.4);
      for (const x of [22, 42]) {
        circle(ctx, x, 32, 6.5);
        fillInk(ctx, '#bfe8ff', 2);
        shine(ctx, x - 2, 30, 1.4);
      }
      break;
    case 'magnet_glove':
      ctx.beginPath();
      ctx.arc(32, 30, 14, Math.PI, 0);
      ink(ctx, 12);
      ctx.stroke();
      ctx.strokeStyle = PAL.red;
      ctx.lineWidth = 8;
      ctx.stroke();
      for (const x of [18, 46]) {
        roundRect(ctx, x - 5, 30, 10, 12, 1);
        fillInk(ctx, '#c8ccd0', 2);
      }
      break;
    case 'lucky_ticket':
      ctx.save();
      ctx.translate(32, 32);
      ctx.rotate(-0.3);
      roundRect(ctx, -20, -10, 40, 20, 3);
      fillInk(ctx, shade(ctx, 0, 0, 20, '#b8ffb0', '#2f9a4a'), 2.4);
      ctx.fillStyle = INK;
      ctx.font = 'bold 11px Georgia';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('777', 0, 1);
      ctx.restore();
      break;
    case 'season_pass':
      roundRect(ctx, 16, 14, 32, 38, 4);
      fillInk(ctx, '#f7eedb', 2.4);
      ctx.fillStyle = PAL.red;
      ctx.fillRect(16.5, 14.5, 31, 9);
      ctx.fillStyle = INK;
      ctx.font = 'bold 8px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText('PASS', 32, 36);
      ctx.fillText('★★★', 32, 46);
      break;
    case 'coin_purse':
      ctx.beginPath();
      ctx.moveTo(20, 28);
      ctx.quadraticCurveTo(14, 52, 32, 52);
      ctx.quadraticCurveTo(50, 52, 44, 28);
      ctx.closePath();
      fillInk(ctx, shade(ctx, 32, 40, 16, '#c87a4a', '#7a3a1a'), 2.4);
      roundRect(ctx, 20, 22, 24, 8, 3);
      fillInk(ctx, PAL.gold, 2);
      circle(ctx, 32, 18, 5);
      fillInk(ctx, PAL.gold, 1.6);
      break;
    case 'hand_mirror': {
      // Mira's cracked hand mirror: a gilt oval on a handle, a crack, a pale face just behind you
      ctx.save();
      ctx.translate(32, 32);
      ctx.rotate(-0.35);
      roundRect(ctx, -3.5, 10, 7, 20, 3);
      fillInk(ctx, PAL.gold, 2);
      ellipse(ctx, 0, -6, 15, 19);
      fillInk(ctx, shade(ctx, 0, -6, 18, '#e8fbff', '#6aa8bc'), 3);
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 3;
      ellipse(ctx, 0, -6, 15, 19);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      ellipse(ctx, 4, -9, 5, 6.5);
      fillInk(ctx, '#ffffff', 1);
      ctx.globalAlpha = 1;
      ink(ctx, 1.6);
      ctx.beginPath();
      ctx.moveTo(-9, -20);
      ctx.lineTo(-2, -8);
      ctx.lineTo(-6, 0);
      ctx.lineTo(3, 9);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'rabbits_foot':
      ellipse(ctx, 32, 36, 9, 14, 0.3);
      fillInk(ctx, '#fffaf0', 2.4);
      for (const [x, y] of [[26, 46], [31, 49], [36, 47]] as [number, number][]) {
        circle(ctx, x, y, 2.6);
        fillInk(ctx, '#ffb0c8', 1.2);
      }
      ink(ctx, 1.6);
      ctx.strokeStyle = PAL.gold;
      ctx.beginPath();
      ctx.moveTo(32, 22);
      ctx.lineTo(32, 12);
      ctx.stroke();
      circle(ctx, 32, 11, 3);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** Generic UI glyphs (Lost & Found perks, HUD). */
export function uiIcon(ctx: Ctx, w: number, h: number, id: string): void {
  const map: Record<string, string> = {
    max_hp: 'sugar_rush', might: 'strongman_belt', speed: 'running_shoes', pickup: 'magnet_glove', luck: 'lucky_ticket',
    greed: 'coin_purse', armor: 'safety_goggles', revive: 'rabbits_foot', reroll: 'spinning_top', banish: 'season_pass',
  };
  if (map[id]) {
    passiveIcon(ctx, w, h, map[id]);
    return;
  }
  badge(ctx, w, h, '#5a4a6a', false);
  void glove;
  void hose;
}
