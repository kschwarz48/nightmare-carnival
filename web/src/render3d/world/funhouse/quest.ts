// The Unreflected's visuals (D-63): everything the hidden quest shows, drawn from its replicated state
// (so every co-op screen sees the same house). No quest UI: the world itself changes.
// - the cracked hand mirror on the Lost & Found counter, glinting;
// - the performers' faces, which exist only in reflections (the mirror-only layer), with a faint
//   smudge on the glass itself so the clue survives low quality (no reflections) too;
// - each freed performer's head back on its dress form in the gallery;
// - the anamorphic mural: the bow order smeared across the chamber floor, sharpening as you near the
//   brass footprints, crisp from them (and for good once read);
// - the great curtain parting on the projector, its ring of warm-up bulbs, its beam through the maze;
// - the four pivot mirrors turning to their states; the crystal blazing when the beam arrives;
// - the four stopped clocks' hands (the quest's times, all night), the vanity's mirrored clock;
// - Mira's Reflection drifting at her carrier's shoulder.

import * as THREE from 'three';
import type { Game } from '../../../sim/game';
import type { GameRenderer3D } from '../../renderer3d';
import { REACH, UR, type UnreflectedChain } from '../../../sim/quest/unreflected';
import { MAZE, PANEL, UNREFLECTED } from '../../../data/funhouse';
import { ModelBuilder, SURF, cone, cyl, ellipsoid, lathe, sphere, torus, tube, weather } from '../../core/geo';
import { PAL, eyes } from '../../models/kit';
import { pool } from '../../core/materials';
import { FUNHOUSE_PROPS } from './models';
import { MIRROR_ONLY_LAYER } from './mirrors';
import type { FunhouseWorld } from './world';

const U = UNREFLECTED;
/** Pivot mirror yaw per state: '|', '/', '—', '\\' (model's glass runs along its local z). */
const PIVOT_YAW = [0, -Math.PI / 4, Math.PI / 2, Math.PI / 4];
/** Emblem colours: strongman, ballerina, clown, magician. */
const COLS: [number, number, number][] = [[1, 0.62, 0.3], [1, 0.62, 0.82], [1, 0.95, 0.9], [0.72, 0.52, 1]];

/** A performer's face (v: 0 strongman, 1 ballerina, 2 clown, 3 magician): pale, hollow-eyed, open-mouthed. */
function faceGeo(v: number): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(ellipsoid(20, 26, 12, 16, 12), { col: weather(0xdfe8ee, 0.2, 0.05), surf: SURF.porcelain, emit: 0.35 });
  for (const s of [-1, 1]) m.add(ellipsoid(5, 6.5, 3, 10, 8), { col: 0x0a0e12, pos: [s * 8, 5, 10], surf: SURF.paint });
  m.add(ellipsoid(6, 8, 3, 10, 8), { col: 0x14060a, pos: [0, -12, 10], surf: SURF.paint });
  if (v === 0) m.add(tube([[-12, -4, 11], [-4, -6, 12.5], [4, -6, 12.5], [12, -4, 11]], 2.4, 5, 10), { col: 0x2a1a10, surf: SURF.cloth });
  if (v === 1) m.add(sphere(9, 10, 8), { col: 0x3a2418, pos: [0, 26, -4], surf: SURF.cloth });
  if (v === 2) {
    m.add(sphere(4, 8, 6), { col: PAL.hotRed, pos: [0, -2, 13], surf: SURF.latex });
    m.add(torus(20, 4, 6, 18), { col: 0xe8e0d0, pos: [0, -26, 0], rot: [Math.PI / 2, 0, 0], surf: SURF.cloth });
  }
  if (v === 3) {
    m.add(cyl(14, 14, 24, 14), { col: PAL.ink, pos: [0, 36, -2], surf: SURF.velvet });
    m.add(cyl(22, 22, 2, 16), { col: PAL.ink, pos: [0, 24, -2], surf: SURF.velvet });
    m.add(cone(5, 12, 6), { col: 0x1a1018, pos: [0, -26, 6], rot: [Math.PI, 0, 0], surf: SURF.cloth });
  }
  return m.build({ ao: 0.1 });
}

function handMirrorGeo(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  m.add(torus(11, 1.6, 6, 20), { col: PAL.gold, scale: [1, 1.3, 1], surf: SURF.gold });
  m.add(ellipsoid(10, 13, 1, 14, 10), { col: 0xc8e0ea, surf: SURF.glass, emit: 0.5 });
  m.add(cyl(1.8, 2.2, 18, 8), { col: PAL.gold, pos: [0, -22, 0], surf: SURF.gold });
  m.add(sphere(2.6, 8, 6), { col: PAL.gold, pos: [0, -32, 0], surf: SURF.gold });
  return m.build({ ao: 0 });
}

function miraGeo(): THREE.BufferGeometry {
  // a girl of glass: a dancer's dress, a bun, arms held out a little, pale and cold
  const m = new ModelBuilder();
  const glass = 0x9fdcec;
  m.add(lathe([[0, 0], [14, 0], [10, 14], [6, 26], [5, 34], [0, 35]], 12, 6), { col: glass, surf: SURF.glass, emit: 0.28 });
  m.add(ellipsoid(5.5, 6.5, 5.5, 12, 8), { col: glass, pos: [0, 41, 0], surf: SURF.glass, emit: 0.34 });
  m.add(sphere(3.4, 8, 6), { col: glass, pos: [0, 46, -3], surf: SURF.glass, emit: 0.34 });
  for (const s of [-1, 1]) m.add(tube([[s * 4, 31, 0], [s * 10, 26, 3], [s * 13, 21, 6]], 1.2, 4, 6), { col: glass, surf: SURF.glass, emit: 0.28 });
  eyes(m, { x: 2, y: 42, z: 5, r: 0.9, color: 0x0a2a30, part: 0 });
  return m.build({ ao: 0 });
}

export class QuestVisuals {
  private yaws = U.beamPivots.map(() => 0);
  private yawInit = false;
  private layered = false;
  private mat = new THREE.Matrix4();
  private tmp = new THREE.Matrix4();

  constructor(private w: FunhouseWorld) {}

  update(g: Game, r: GameRenderer3D, inView: (x: number, y: number) => boolean, dt: number): void {
    const ch = g.quests?.get<UnreflectedChain>('unreflected');
    if (!ch) return;
    const st = ch.stage, t = r.time, w = this.w;
    const glowF = r.f('fx_glow_0');
    const up = g.players.filter((p) => g.isUp(p));
    const nearest = (x: number, y: number) => up.reduce((d, p) => Math.min(d, Math.hypot(p.x - x, p.y - y)), Infinity);

    // ---- the stopped clocks: their hands show this night's times from the first second
    const hand = w.batch('fh_q_hand', () => FUNHOUSE_PROPS.fh_clock_hand(0), 12, 1.4);
    U.clocks.forEach((c, k) => {
      if (!inView(c.x, c.y)) return;
      const [hh, mm] = ch.times[k] ?? [12, 0];
      const yaw = c.face === 'w' ? -Math.PI / 2 : 0;
      this.hand(hand, c.x, c.y, yaw, 150, 8.6, ((((hh % 12) + mm / 60) / 12) * Math.PI * 2), 0.62, 1);
      this.hand(hand, c.x, c.y, yaw, 150, 9.4, (mm / 60) * Math.PI * 2, 1, 1);
    });

    // ---- the hand mirror on the counter, until someone picks it up
    if (st === UR.Dormant && inView(U.counter.x, U.counter.y)) {
      const hm = w.batch('fh_q_handmirror', handMirrorGeo, 1, 2);
      this.mat.makeTranslation(U.counter.x - 24, 78, U.counter.y + 6);
      this.mat.multiply(this.tmp.makeRotationY(0.5)).multiply(this.tmp.makeRotationX(-Math.PI / 2 + 0.12));
      hm.addMatrix(this.mat);
      const tw = Math.max(0, Math.sin(t * 1.7)) ** 12;
      r.glow.draw(glowF, U.counter.x - 24, U.counter.y + 6, 82, 0.5 + tw, 0.5 + tw, 0, 0.8, 0.95, 1, 0.25 + tw * 0.75);
    }

    // ---- the faces in the glass (only in reflections), and a smudge on the glass for everyone
    const facesV = [0, 1, 2, 3].map((v) => w.batch(`fh_q_face${v}`, () => faceGeo(v), 1, 2.2));
    if (!this.layered) {
      for (const b of facesV) b.mesh.layers.set(MIRROR_ONLY_LAYER);
      this.layered = true;
    }
    if (st === UR.Faces) {
      U.faces.forEach((f, i) => {
        if (ch.freed & (1 << i)) return;
        const d = nearest(f.x, f.y);
        const k = 1 - Math.min(1, Math.max(0, (d - 60) / (U.faceReveal - 60)));
        if (k <= 0) return;
        const [, rr] = f.key.split(':').map(Number);
        const glassY = MAZE.y0 + MAZE.ch * (rr + 1) + PANEL;
        // the face hangs just in front of the glass, looking out: the reflection shows it, the room doesn't
        const j = facesV[i].add(f.x, glassY + 34, 70 + Math.sin(t * 1.3 + i) * 4, Math.PI + Math.sin(t * 0.7 + i) * 0.2, 1.3 * (0.6 + 0.4 * k));
        facesV[i].tint(j, 0.8 + 0.2 * k, 0.95, 1, 0.6 + k);
        r.glow.draw(glowF, f.x, glassY + 4, 80, 0.9, 1.1, 0, 0.7, 0.9, 1, 0.12 + 0.18 * k * (0.7 + 0.3 * Math.sin(t * 3 + i)));
      });
    }

    // ---- the freed performers' heads, back on their dress forms
    U.plinths.forEach((p, i) => {
      if (!(ch.freed & (1 << i)) || !inView(p.x, p.y)) return;
      const b = w.batch(`fh_q_bust${i}`, () => faceGeo(i), 1, 1.6);
      b.add(p.x, p.y + 4, 170 + (i === 3 ? 4 : 0), 0, 0.56);
      // the overture: the plinths already played this attempt glow
      if (st === UR.Overture) {
        const played = ch.order.slice(0, ch.progress).includes(i);
        if (played) r.addShapes.circle(p.x, p.y, REACH.plinth, COLS[i][0], COLS[i][1], COLS[i][2], 0.22, 0);
      }
    });
    if (st === UR.Overture) for (const p of U.plinths) r.teleLine.ring(p.x, p.y, REACH.plinth - 3, REACH.plinth, 0.9, 0.8, 0.6, 0.18 + 0.1 * Math.sin(t * 2), 0.18 + 0.1 * Math.sin(t * 2));

    // ---- the anamorphic mural: smeared until seen from the footprints
    if (inView(U.mural.x, U.mural.y)) {
      const dm = nearest(U.mark.x, U.mark.y);
      const ready = st >= UR.Mural;
      const sharp = ch.muralSeen ? 1 : ready ? Math.max(0, 1 - dm / 420) ** 2 : 0;
      const smear = 1 + 4.5 * (1 - sharp);
      const order = ch.muralSeen || ready ? ch.order : [2, 0, 3, 1];
      order.forEach((who, k) => this.emblem(r, who, U.mural.x + (k - 1.5) * 92, U.mural.y - (smear - 1) * 14 * (k % 2 ? 1 : -1), smear, 0.2 + 0.38 * sharp));
      // the footprints glow once the faces are home
      if (ready && !ch.muralSeen) r.addShapes.circle(U.mark.x, U.mark.y, REACH.mark, 1, 0.85, 0.5, 0.18 + 0.1 * Math.sin(t * 3), 0);
    }

    // ---- the projector: the great curtain parts; its warm-up bulbs; its beam
    w.greatCurtain && (w.greatCurtain.mesh.visible = st < UR.Projector);
    if (st >= UR.Projector && inView(U.projector.x, U.projector.y)) {
      const drape = w.batch('fh_q_drape', () => FUNHOUSE_PROPS.fh_curtain(3), 2, 1.6);
      for (const s of [-1, 1]) drape.add(U.projector.x + s * 150, U.projector.y + 70, 0, 0, 1, 0.42, 1, 1);
      const P = U.projector;
      const lit = Math.min(10, Math.floor((ch.charge / U.charge) * 10 + 1e-6));
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        const x = P.x + Math.cos(a) * P.r, y = P.y + Math.sin(a) * P.r;
        const on = k < lit || st > UR.Projector;
        r.addShapes.circle(x, y, 12, 1, 0.82, 0.45, on ? 0.85 : 0.12, 0);
        r.teleLine.ring(x, y, 9, 12, 1, 0.8, 0.5, on ? 0.9 : 0.3, on ? 0.9 : 0.3);
      }
      if (st === UR.Projector) r.addShapes.ring(P.x, P.y, P.r - 6, P.r, 1, 0.85, 0.55, 0.12 + 0.08 * Math.sin(t * 2.5), 0.12);
      const lamp = st > UR.Projector ? 1 : ch.charge / U.charge;
      r.glow.draw(glowF, P.x, P.y + 40, 104, 0.6 + lamp, 0.6 + lamp, 0, 1, 0.92, 0.7, 0.2 + 0.6 * lamp);
      pool.add(P.x, P.y + 30, 260, 0.3 + 0.9 * lamp, 1, 0.85, 0.6, 110, 2);
    }
    if (st >= UR.Beam) {
      const tr = ch.beam();
      for (let k = 1; k < tr.pts.length; k++) {
        const a = tr.pts[k - 1], b = tr.pts[k];
        r.addShapes.line(a.x, a.y, b.x, b.y, 26, 1, 0.9, 0.65, 0.22, 0);
        r.addShapes.line(a.x, a.y, b.x, b.y, 9, 1, 0.98, 0.9, 0.85, 0.3);
        if (k > 1) r.glow.draw(glowF, a.x, a.y, 30, 0.8, 0.8, 0, 1, 0.95, 0.75, 0.6);
      }
      const end = tr.pts[tr.pts.length - 1];
      r.glow.draw(glowF, end.x, end.y, 40, tr.hit ? 2.4 : 1, tr.hit ? 2.4 : 1, 0, tr.hit ? 0.7 : 1, tr.hit ? 1 : 0.8, tr.hit ? 0.95 : 0.5, tr.hit ? 0.9 : 0.55);
      if (tr.hit) pool.add(U.crystal.x, U.crystal.y, 420, 1.4, 0.6, 1, 0.92, 140, 3);
      if (st === UR.Beam) for (const pv of U.beamPivots) r.addShapes.ring(pv.x, pv.y, REACH.pivot - 5, REACH.pivot, 1, 0.9, 0.6, 0.25 + 0.1 * Math.sin(t * 3), 0.25);
    }
    // the pivot mirrors themselves, turning to their states
    const pm = w.batch('fh_q_pivotmirror', () => FUNHOUSE_PROPS.fh_pivot_mirror(0), 4, 1.8);
    U.beamPivots.forEach((pv, i) => {
      const target = PIVOT_YAW[ch.pivots[i] ?? 0];
      if (!this.yawInit) this.yaws[i] = target;
      let d = target - this.yaws[i];
      while (d > Math.PI / 2) d -= Math.PI;
      while (d < -Math.PI / 2) d += Math.PI;
      this.yaws[i] += d * Math.min(1, dt * 6);
      if (inView(pv.x, pv.y)) pm.add(pv.x, pv.y, 0, this.yaws[i], 1);
    });
    this.yawInit = true;

    // ---- Mira's vanity: her mirrored clock, once the door is open
    if (st >= UR.Vanity && inView(U.vanity.x, U.vanity.y)) {
      const clk = w.batch('fh_q_vclock', () => FUNHOUSE_PROPS.fh_clock(0), 1, 1.6);
      const s = 0.5;
      clk.add(U.vanity.x, U.vanity.y - 8, 126 - 150 * s, 0, s, -1, 1, 1);
      const [vh, vm] = ch.vanityTime;
      this.hand(hand, U.vanity.x, U.vanity.y - 8, 0, 126, 8.6 * s, (((vh % 12) + vm / 60) / 12) * Math.PI * 2, 0.62 * s, s);
      this.hand(hand, U.vanity.x, U.vanity.y - 8, 0, 126, 9.4 * s, (vm / 60) * Math.PI * 2, s, s);
      if (!ch.vanitySeen) r.glow.draw(glowF, U.vanity.x, U.vanity.y - 6, 126, 1.4, 1.4, 0, 0.8, 0.95, 1, 0.25 + 0.15 * Math.sin(t * 2));
    }

    // ---- Mira's Reflection at her carrier's shoulder
    if (st === UR.Carrying) {
      const c = g.players[ch.carrier];
      if (c && inView(c.x, c.y)) {
        const mb = w.batch('fh_q_mira', miraGeo, 1, 2.4);
        const a = t * 1.1;
        const x = c.x + Math.cos(a) * 48, y = c.y + Math.sin(a) * 30;
        const j = mb.add(x, y, 22 + Math.sin(t * 2.3) * 5, Math.atan2(c.x - x, c.y - y), 1.25);
        mb.tint(j, 0.85, 1, 1, 0.8);
        r.glow.draw(glowF, x, y, 50, 1.1, 1.1, 0, 0.6, 1, 0.95, 0.16);
        pool.add(x, y, 180, 0.4, 0.6, 1, 0.95, 60, 3);
      }
    }
  }

  /** A clock hand on a wall clock's face (yaw: the clock's facing; h: the face's centre height). */
  private hand(b: ReturnType<FunhouseWorld['batch']>, x: number, y: number, yaw: number, h: number, depth: number, ang: number, len: number, s: number): void {
    this.mat.makeTranslation(x, 0, y);
    this.mat.multiply(this.tmp.makeRotationY(yaw));
    this.mat.multiply(this.tmp.makeTranslation(0, h, depth));
    this.mat.multiply(this.tmp.makeRotationZ(-ang));
    this.mat.multiply(this.tmp.makeScale(s, len, s));
    b.addMatrix(this.mat);
  }

  /** A performer's emblem painted on the chamber floor, stretched `smear` times north-south. */
  private emblem(r: GameRenderer3D, who: number, x: number, y: number, smear: number, a: number): void {
    const [cr, cg, cb] = COLS[who];
    const S = r.addShapes, L = r.teleLine;
    const sy = (v: number) => y + v * smear;
    r.zoneShapes.circle(x, y, 40, 0.05, 0.03, 0.05, 0.5 * a, 0);
    switch (who) {
      case 0: // the strongman's dumbbell
        S.line(x - 24, sy(0), x + 24, sy(0), 6, cr, cg, cb, a);
        for (const s of [-1, 1]) S.circle(x + s * 26, sy(0), 11, cr, cg, cb, a, a * 0.6);
        break;
      case 1: // the ballerina's tutu and head
        S.circle(x, sy(-18), 8, cr, cg, cb, a);
        S.line(x - 26, sy(4), x + 26, sy(4), 10 * smear ** 0.3, cr, cg, cb, a);
        S.line(x, sy(-10), x, sy(26), 4, cr, cg, cb, a);
        break;
      case 2: // the clown: a face, its nose, its ruff
        S.circle(x, sy(-4), 17, cr, cg, cb, a * 0.8, a * 0.5);
        S.circle(x, sy(-2), 5, 1, 0.2, 0.15, a);
        S.line(x - 24, sy(18), x + 24, sy(18), 7, cr, cg, cb, a);
        break;
      default: // the magician's top hat
        S.line(x - 13, sy(-6), x + 13, sy(-6), 26, cr, cg, cb, a);
        S.line(x - 26, sy(8), x + 26, sy(8), 6, cr, cg, cb, a);
    }
    L.ring(x, y, 44, 46, cr, cg, cb, a * 0.5, a * 0.5);
  }
}
