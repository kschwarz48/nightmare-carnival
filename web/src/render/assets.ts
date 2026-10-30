// Builds every in-game sprite frame into texture atlases at boot (procedural vector art, see
// ASSET_MANIFEST.md). Also produces DOM images (portraits, icons) on demand.

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
    // ---- characters
    for (const c of CHARACTERS) {
      for (let i = 0; i < 2; i++) A.add(`char_${c.id}_idle${i}`, CHAR_W, CHAR_H, (ctx) => drawCharacter(ctx, c.id, i * 0.5, 'idle'), { ax: 0.5, ay: 0.917 });
      for (let i = 0; i < 4; i++) A.add(`char_${c.id}_walk${i}`, CHAR_W, CHAR_H, (ctx) => drawCharacter(ctx, c.id, i / 4, 'walk'), { ax: 0.5, ay: 0.917 });
      A.add(`char_${c.id}_hurt`, CHAR_W, CHAR_H, (ctx) => drawCharacter(ctx, c.id, 0, 'hurt'), { ax: 0.5, ay: 0.917 });
    }
    A.add('shield_balloon', 30, 54, drawShieldBalloon, { ay: 1 });
    onProgress?.(0.15);
    // ---- enemies
    for (const [id, art] of Object.entries(ENEMY_ART)) {
      for (let i = 0; i < 4; i++) A.add(`en_${id}_walk${i}`, art.w, art.h, (ctx, w, h) => drawEnemy(ctx, id, w, h, i / 4, 'walk'), { ax: 0.5, ay: art.ay });
      A.add(`en_${id}_windup`, art.w, art.h, (ctx, w, h) => drawEnemy(ctx, id, w, h, 0.15, 'windup'), { ax: 0.5, ay: art.ay });
      if (id === 'whack_a_mole' || id === 'jack_in_the_box') A.add(`en_${id}_alt`, art.w, art.h, (ctx, w, h) => drawEnemy(ctx, id, w, h, 0, 'alt'), { ax: 0.5, ay: art.ay });
    }
    A.add('snake_seg', 58, 50, drawSnakeSegment, { ay: 0.7 });
    onProgress?.(0.35);
    // ---- bosses (lower res: they're big)
    const br = 1.25;
    A.add('tent_body_0', 320, 300, (c, w, h) => B.tentBody(c, w, h, false), { res: br, ay: 0.93 });
    A.add('tent_body_1', 320, 300, (c, w, h) => B.tentBody(c, w, h, true), { res: br, ay: 0.93 });
    for (let i = 0; i < 4; i++) A.add(`tent_maw_${i}`, 170, 120, (c, w, h) => B.tentMaw(c, w, h, i / 3), { res: br });
    A.add('tent_maw_hot', 170, 120, (c, w, h) => B.tentMaw(c, w, h, 1, true), { res: br });
    for (let i = 0; i < 3; i++) A.add(`tent_eyes_${i}`, 150, 60, (c, w, h) => B.tentEyes(c, w, h, i), { res: br });
    A.add('tent_leg', 70, 170, B.tentLeg, { res: br, ay: 0 });
    for (let i = 0; i < 2; i++) A.add(`tent_fire_${i}`, 320, 260, (c, w, h) => B.tentFire(c, w, h, i * 0.5), { res: 1, ay: 0.93 });
    A.add('tent_wreck', 320, 160, B.tentWreck, { res: 1, ay: 0.9 });
    A.add('ferris_rim_0', 330, 330, (c, w, h) => B.ferrisRim(c, w, h, 0.4), { res: br });
    A.add('ferris_rim_1', 330, 330, (c, w, h) => B.ferrisRim(c, w, h, 1), { res: br });
    A.add('ferris_hub_0', 80, 80, (c, w, h) => B.ferrisHub(c, w, h, false), { res: 1.5 });
    A.add('ferris_hub_1', 80, 80, (c, w, h) => B.ferrisHub(c, w, h, true), { res: 1.5 });
    for (let i = 0; i < 5; i++) A.add(`ferris_gondola_${i}`, 46, 48, (c, w, h) => B.ferrisGondola(c, w, h, false, i), { res: 2, ay: 0.08 });
    A.add('ferris_gondola_open', 46, 48, (c, w, h) => B.ferrisGondola(c, w, h, true, 0), { res: 2, ay: 0.08 });
    A.add('ferris_stand', 280, 220, B.ferrisStand, { res: 1, ay: 0.96 });
    A.add('ferris_wreck', 300, 170, B.ferrisWreck, { res: 1, ay: 0.85 });
    A.add('pk_body', 120, 150, B.pkBody, { res: br, ay: 0.1 });
    A.add('pk_head_0', 80, 90, (c, w, h) => B.pkHead(c, w, h, true, false), { res: br, ay: 0.85 });
    A.add('pk_head_1', 80, 90, (c, w, h) => B.pkHead(c, w, h, true, true), { res: br, ay: 0.85 });
    A.add('pk_head_2', 80, 90, (c, w, h) => B.pkHead(c, w, h, false, true), { res: br, ay: 0.85 });
    A.add('pk_arm', 30, 92, B.pkArm, { res: 1.5, ay: 0.05 });
    A.add('pk_leg', 30, 82, B.pkLeg, { res: 1.5, ay: 0.05 });
    A.add('pk_crossbar', 150, 90, B.pkCrossbar, { res: 1.25 });
    A.add('pk_wreck', 200, 130, B.pkWreck, { res: 1, ay: 0.85 });
    for (const p of ['idle0', 'idle1', 'whip', 'bow', 'hat', 'cane'] as B.RMPose[]) A.add(`rm_h_${p}`, 150, 205, (c, w, h) => B.ringmasterHuman(c, w, h, p), { res: br, ay: 0.96 });
    for (const [i, p] of (['idle0', 'idle1', 'whip'] as B.RMPose[]).entries()) {
      A.add(`rm_d_${p}`, 170, 240, (c, w, h) => B.ringmasterDemon(c, w, h, p, i * 0.7), { res: br, ay: 0.96 });
    }
    onProgress?.(0.55);
    // ---- props
    for (const [kind, art] of Object.entries(PROP_ART)) {
      if (!art) continue;
      const variants = kind === 'stall_ringtoss' || kind === 'tent_small' ? 2 : kind === 'gate_arch' ? 3 : kind === 'tree_dead' || kind === 'trash' ? 3 : 1;
      for (let v = 0; v < variants; v++) {
        const res = art.w * art.h > 60000 ? 0.85 : art.w * art.h > 20000 ? 1.1 : 1.6;
        A.add(`prop_${kind}_${v}`, art.w, art.h, (c, w, h) => drawProp(c, kind, w, h, v), { res, ax: 0.5, ay: art.ay });
      }
    }
    A.add('tilt_arm', 300, 70, tiltArm, { res: 1, ax: 0.0, ay: 0.5 });
    onProgress?.(0.7);
    // ---- pickups
    for (let t = 0; t < 4; t++) A.add(`ticket_${t}`, 22, 22, (c, w, h) => I.ticket(c, w, h, t), { res: 2.5 });
    A.add('bank', 40, 40, (c, w, h) => I.ticket(c, w, h, 2), { res: 2 });
    A.add('food', 40, 30, I.hotdog, { res: 2 });
    A.add('funnel', 34, 28, I.funnelCake, { res: 2 });
    A.add('golden', 44, 44, I.goldenTicket, { res: 2 });
    A.add('chest', 52, 50, (c, w, h) => I.chest(c, w, h, false), { res: 2, ay: 0.92 });
    A.add('chest_open', 52, 50, (c, w, h) => I.chest(c, w, h, true), { res: 2, ay: 0.92 });
    // ---- player projectiles
    A.add('p_card', 16, 22, (c, w, h) => I.card(c, w, h, false), { res: 2.5 });
    A.add('p_gold_card', 18, 24, (c, w, h) => I.card(c, w, h, true), { res: 2.5 });
    A.add('p_tarot', 18, 26, (c, w, h) => I.tarotCard(c, w, h, false), { res: 2.5 });
    A.add('p_death_card', 28, 38, (c, w, h) => I.tarotCard(c, w, h, true), { res: 2.5 });
    A.add('p_dart', 30, 12, I.dart, { res: 2.5 });
    A.add('p_shrapnel', 12, 12, I.shrapnel, { res: 2.5 });
    A.add('p_ring', 30, 30, (c, w, h) => I.ring(c, w, h, false), { res: 2 });
    A.add('p_ring_big', 40, 40, (c, w, h) => I.ring(c, w, h, true), { res: 2 });
    A.add('p_rocket', 30, 14, (c, w, h) => I.rocket(c, w, h, false), { res: 2.5 });
    A.add('p_shell', 44, 20, (c, w, h) => I.rocket(c, w, h, true), { res: 2.5 });
    A.add('p_kernel', 14, 14, I.kernel, { res: 2.5 });
    A.add('p_cannonball', 56, 28, I.cannonball, { res: 2 });
    A.add('p_derby', 52, 38, (c, w, h) => I.derbyCar(c, w, h, false), { res: 2 });
    A.add('p_ghost', 52, 38, (c, w, h) => I.derbyCar(c, w, h, true), { res: 2 });
    // ---- summons
    for (let v = 0; v < 4; v++) for (let f = 0; f < 2; f++) A.add(`s_plush_${v}_${f}`, 34, 40, (c, w, h) => I.plushPet(c, w, h, v, f * 0.25), { res: 2, ay: 0.9 });
    for (let f = 0; f < 2; f++) {
      A.add(`s_rabbit_${f}`, 34, 50, (c, w, h) => I.rabbit(c, w, h, f * 0.25), { res: 2, ay: 0.92 });
      A.add(`s_dove_${f}`, 44, 36, (c, w, h) => I.dove(c, w, h, f * 0.25 + 0.1), { res: 2 });
      A.add(`s_lion_${f}`, 64, 54, (c, w, h) => I.lion(c, w, h, f * 0.25), { res: 2, ay: 0.9 });
      A.add(`s_elephant_${f}`, 84, 70, (c, w, h) => I.elephant(c, w, h, f * 0.25), { res: 1.6, ay: 0.92 });
      A.add(`s_acrobat_${f}`, 40, 40, (c, w, h) => I.acrobat(c, w, h, f * 0.5), { res: 2 });
    }
    A.add('s_mirror', 70, 96, I.mirrorFrame, { res: 1.6, ay: 0.917 });
    // ---- enemy bullets
    for (const b of BULLETS) A.add(`b_${b}`, b === 'crown' ? 44 : b === 'spoke' ? 54 : b === 'star' ? 30 : 26, b === 'crown' ? 44 : b === 'spoke' ? 54 : b === 'star' ? 30 : 26, (c, w, h) => I.enemyBullet(c, w, h, b), { res: 2 });
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
