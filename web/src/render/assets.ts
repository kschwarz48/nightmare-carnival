// Builds every in-game sprite frame into texture atlases at boot (procedural vector art, see
// ASSET_MANIFEST.md). Also produces DOM images (portraits, icons) on demand.

import { drawFunhousePortrait } from './art/funhouseBosses';
import { drawBoardwalkPortrait } from './art/boardwalkBosses';
import { AtlasBuilder, paintToDataURL } from './atlas';
import { CHAR_H, CHAR_W, drawCharacter, drawShieldBalloon } from './art/characters';
import { ENEMY_ART, drawEnemy, drawSnakeSegment } from './art/enemies';
import * as B from './art/bosses';
import * as I from './art/items';
import { PROP_ART, drawProp, tiltArm } from './art/props';
import { passiveIcon, uiIcon, weaponIcon } from './art/icons';
import { CHARACTERS } from '../data/characters';
import { WEAPONS } from '../data/weapons';
import { posterText, PAL, type Ctx } from './art/kit';

export const PARTICLES = ['confetti', 'latex', 'stuffing', 'button', 'spring', 'gear', 'star', 'sugar', 'splinter', 'shard', 'board', 'smoke', 'glow', 'spark', 'ring', 'droplet', 'flame', 'snow', 'note'];
export const BULLETS = ['pie', 'musket', 'ticket', 'popcorn', 'spiral', 'spark', 'bolt', 'ring', 'hellfire', 'star', 'crown', 'spoke', 'note'];

export class Assets {
  atlas = new AtlasBuilder();
  private dom = new Map<string, string>();

  build(onProgress?: (p: number) => void): void {
    const A = this.atlas;
    // The 2.5D renderer draws characters, enemies, bosses, props, pickups and projectiles as 3D
    // models (render3d/); the atlas now only holds FX particles, the soft shadow and damage digits.
    onProgress?.(0.2);
    // ---- particles
    for (const p of PARTICLES) {
      const n = p === 'confetti' ? 6 : p === 'splinter' || p === 'shard' || p === 'sugar' ? 3 : p === 'latex' || p === 'board' ? 2 : 1;
      const sz = p === 'glow' || p === 'smoke' ? 64 : p === 'ring' ? 64 : p === 'spark' ? 32 : 14;
      for (let v = 0; v < n; v++) A.add(`fx_${p}_${v}`, sz, sz, (c, w, h) => I.particle(c, w, h, p, v), { res: sz > 30 ? 1 : 2.5 });
    }
    // soft shadow + digits
    A.add('shadow', 64, 32, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.6)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.scale(1, h / w);
      c.beginPath();
      c.arc(w / 2, (h / 2) * (w / h), w / 2, 0, Math.PI * 2);
      c.fill();
    }, { res: 1 });
    for (const ch of '0123456789') {
      A.add(`d_${ch}`, 14, 20, (c, w, h) => I.digit(c, w, h, ch, false), { res: 2.5 });
      A.add(`dc_${ch}`, 14, 20, (c, w, h) => I.digit(c, w, h, ch, true), { res: 2.5 });
    }
    onProgress?.(0.9);
    A.build(4096);
    onProgress?.(1);
  }

  // ---------------------------------------------------------------- DOM images
  private cached(key: string, make: () => string): string {
    let v = this.dom.get(key);
    if (!v) {
      v = make();
      this.dom.set(key, v);
    }
    return v;
  }

  portrait(charId: string): string {
    return this.cached(`portrait_${charId}`, () => paintToDataURL(120, 120, (ctx) => {
      const c = CHARACTERS.find((x) => x.id === charId)!;
      const g = ctx.createRadialGradient(60, 50, 10, 60, 60, 80);
      g.addColorStop(0, c.palette.accent);
      g.addColorStop(1, '#1a1028');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 120, 120);
      // sunburst
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#fff6dc';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(60, 60);
        ctx.lineTo(60 + Math.cos(a) * 120, 60 + Math.sin(a) * 120);
        ctx.lineTo(60 + Math.cos(a + 0.18) * 120, 60 + Math.sin(a + 0.18) * 120);
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(60, 4);
      ctx.scale(1.7, 1.7);
      ctx.translate(-40, 0);
      drawCharacter(ctx, charId, 0.25, 'idle');
      ctx.restore();
    }, 2));
  }

  /** Full-body character art for the select screen (animated by CSS). */
  charFull(charId: string, frame = 0): string {
    return this.cached(`full_${charId}_${frame}`, () => paintToDataURL(CHAR_W, CHAR_H, (ctx) => drawCharacter(ctx, charId, frame / 4, frame < 0 ? 'hurt' : 'walk'), 3));
  }

  weaponIcon(id: string): string {
    return this.cached(`wi_${id}`, () => {
      const d = WEAPONS[id];
      return paintToDataURL(64, 64, (ctx, w, h) => weaponIcon(ctx, w, h, d.kind, !!d.isEvolution), 1.5);
    });
  }
  passiveIcon(id: string): string {
    return this.cached(`pi_${id}`, () => paintToDataURL(64, 64, (ctx, w, h) => passiveIcon(ctx, w, h, id), 1.5));
  }
  uiIcon(id: string): string {
    return this.cached(`ui_${id}`, () => paintToDataURL(64, 64, (ctx, w, h) => uiIcon(ctx, w, h, id), 1.5));
  }
  enemyImage(id: string): string {
    return this.cached(`en_${id}`, () => {
      const art = ENEMY_ART[id] ?? ENEMY_ART.living_balloon;
      return paintToDataURL(art.w, art.h, (ctx, w, h) => drawEnemy(ctx, id, w, h, 0.1, 'walk'), 2.5);
    });
  }
  bossImage(id: string): string {
    return this.cached(`boss_${id}`, () => paintToDataURL(200, 200, (ctx) => drawBossPortrait(ctx, id), 1.5));
  }
  logo(): string {
    return this.cached('logo', () => paintToDataURL(900, 300, drawLogo, 1.5));
  }
}

function drawBossPortrait(ctx: Ctx, id: string): void {
  ctx.save();
  if (drawFunhousePortrait(ctx, id) || drawBoardwalkPortrait(ctx, id)) {
    ctx.restore();
    return;
  }
  switch (id) {
    case 'carnival_tent':
      ctx.translate(100, 190);
      ctx.scale(0.6, 0.6);
      ctx.translate(-160, -290);
      B.tentBody(ctx, 320, 300, true);
      ctx.translate(75, 140);
      B.tentMaw(ctx, 170, 120, 0.8);
      ctx.translate(10, -50);
      B.tentEyes(ctx, 150, 60, 2);
      break;
    case 'ferris_wheel':
      ctx.translate(100, 100);
      ctx.scale(0.56, 0.56);
      ctx.translate(-165, -165);
      B.ferrisRim(ctx, 330, 330, 1);
      ctx.translate(125, 125);
      B.ferrisHub(ctx, 80, 80, true);
      break;
    case 'puppet_king':
      ctx.translate(40, 70);
      B.pkBody(ctx, 120, 150);
      ctx.translate(20, -66);
      B.pkHead(ctx, 80, 90, true, true);
      break;
    case 'ringmaster':
      ctx.translate(20, -10);
      B.ringmasterDemon(ctx, 170, 240, 'idle0', 0);
      break;
    case 'encore_ringmaster':
      ctx.translate(25, -2);
      B.ringmasterHuman(ctx, 150, 205, 'bow');
      break;
  }
  ctx.restore();
}

function drawLogo(ctx: Ctx, w: number, h: number): void {
  // marquee banner
  ctx.save();
  ctx.fillStyle = '#2a0f30';
  ctx.strokeStyle = '#17110e';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(40, 70);
  ctx.quadraticCurveTo(w / 2, 10, w - 40, 70);
  ctx.lineTo(w - 60, 230);
  ctx.quadraticCurveTo(w / 2, 180, 60, 230);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const x = 50 + t * (w - 100);
    const y = 70 - Math.sin(t * Math.PI) * 52 + 14;
    ctx.fillStyle = i % 2 ? '#ffd36a' : '#ff6aa0';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    const y2 = 230 - Math.sin(t * Math.PI) * 50 - 12;
    ctx.beginPath();
    ctx.arc(x + 6, y2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  posterText(ctx, 'NIGHTMARE', w / 2, 110, 92, PAL.cream, { outline: 12 });
  posterText(ctx, 'CARNIVAL', w / 2, 192, 80, '#ff4a5a', { outline: 12 });
}
