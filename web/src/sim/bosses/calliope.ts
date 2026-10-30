// SECRET BOSS — THE CALLIOPE (Easter egg finale, docs/EASTER_EGG_SOLUTION.md).
// The steam organ at the heart of the carnival rises from the Big Top ruins when the Ringmaster
// falls while the player carries the Ghost Ticket. It never moves; it plays.
// P1 Overture: note rings, steam vents, pipe volleys.  P2 Fugue: echoing vents, bellows, the Lamp
// Crescendo (stand in the lamp that sings — they light in the song's order).  P3 Requiem: all of it, faster.

import { TAU } from '../../core/math';
import type { BossDef } from '../../data/bosses';
import { LAST_SONG } from '../../data/quests';
import type { Game } from '../game';
import type { Co } from '../script';
import { BossBase, type Attack, type BossOpts } from './boss';

export class CalliopeBoss extends BossBase {
  rise = 0; // 0..1 emergence (render)
  pump = 0; // bellows pump animation driver
  /** Which pipe is sounding (render), -1 none. */
  pipeLit = -1;
  readonly pipes = 9;

  constructor(g: Game, def: BossDef, opts?: BossOpts) {
    super(g, def, opts);
    this.x = this.px = LAST_SONG.finaleAt.x;
    this.y = this.py = LAST_SONG.finaleAt.y;
    this.noRoam = true;
    this.pose = { glow: 0, steam: 0, mouth: 0 };
  }

  pipeTip(i: number): { x: number; y: number } {
    const t = i / (this.pipes - 1) - 0.5;
    return { x: this.x + t * 230, y: this.y - 30 };
  }

  protected tickBoss(dt: number): void {
    this.pump += dt * (this.casting ? 7 : 3);
    this.pose.steam = Math.max(0, this.pose.steam - dt);
    this.pose.mouth = Math.max(0, this.pose.mouth - dt * 2);
  }

  protected *intro(): Co {
    const g = this.g;
    this.anim = 'intro';
    this.banner('THE CALLIOPE', 'The Last Song');
    this.sfx('demon', 1, 0.6);
    for (let i = 0; i < 180; i++) {
      this.rise = i / 180;
      if (i % 20 === 0) g.fx.push('shake', this.x, this.y, 0.45);
      if (i % 6 === 0) g.fx.push('spark', this.x + g.rng.range(-140, 140), this.y + g.rng.range(-40, 40), 3, 0, 0, 'smoke');
      yield 1 / 60;
    }
    this.rise = 1;
    this.sfx('roar', 1, 0.7);
    g.fx.push('ring', this.x, this.y, 340, 0, 0, 'gravity');
    yield 0.6;
  }

  attacks(phase: number): Attack[] {
    if (phase === 0) return [
      { name: 'rings', w: 1.2, fn: () => this.noteRings(3.2, 18, 0) },
      { name: 'vents', w: 1, fn: () => this.steamVents(6, 1.0) },
      { name: 'volley', w: 1, fn: () => this.pipeVolley(5) },
    ];
    if (phase === 1) return [
      { name: 'echo', w: 1, fn: () => this.echoVents() },
      { name: 'bellows', w: 0.9, fn: () => this.bellows() },
      { name: 'crescendo', w: 1.2, fn: () => this.lampCrescendo(1.5) },
      { name: 'rings', w: 0.8, fn: () => this.noteRings(2.6, 20, 0.8) },
    ];
    return [
      { name: 'rings', w: 1, fn: () => this.noteRings(3.6, 22, 1.4) },
      { name: 'crescendo', w: 1.3, fn: () => this.lampCrescendo(1.15) },
      { name: 'volley', w: 1, fn: () => this.pipeVolley(9) },
      { name: 'vents', w: 0.8, fn: () => this.steamVents(9, 0.85) },
    ];
  }

  protected onPhase(phase: number): Co | null {
    this.banner(phase === 1 ? 'FUGUE' : 'REQUIEM', phase === 1 ? 'The music remembers you' : 'Every soul in the carnival, singing at once');
    this.sfx('demon', 1, phase === 1 ? 0.8 : 0.55);
    this.g.bus.emit('music', { cue: phase === 1 ? 'boss_ringmaster_2' : 'boss_ringmaster_3' });
    return null;
  }

  /** Rotating rings of notes with three readable gaps; `homing` makes later notes curl after you. */
  private *noteRings(dur: number, n: number, curl: number): Co {
    this.anim = 'play';
    this.pose.glow = 1;
    this.sfx('calliope', 0.9, 0.8);
    yield this.tele(0.6);
    const steps = Math.round(dur / 0.4);
    let off = this.g.rng.angle();
    for (let s = 0; s < steps; s++) {
      this.pipeLit = s % this.pipes;
      const tip = this.pipeTip(this.pipeLit);
      for (let i = 0; i < n; i++) {
        if (i % 6 === 0 || i % 6 === 1) continue;
        const a = off + (i * TAU) / n;
        this.bullet('note', tip.x, tip.y, a, 150, 12, { life: 6, r: 8, turn: curl * (s % 2 ? 1 : -1) * 0.25 });
      }
      off += 0.19;
      if (s % 2 === 0) this.sfx('pew', 0.25, 0.7 + (s % 4) * 0.1);
      yield 0.4;
    }
    this.pipeLit = -1;
    this.pose.glow = 0;
  }

  private *steamVents(n: number, tele: number): Co {
    const g = this.g;
    this.anim = 'vent';
    for (let i = 0; i < n; i++) {
      const a = g.rng.angle();
      const d = i === 0 ? 0 : g.rng.range(80, 360);
      const x = g.player.x + Math.cos(a) * d, y = g.player.y + Math.sin(a) * d;
      this.hz('circle', 'steam', x, y, { r: 58, tele: this.tele(tele) + i * 0.08, active: 1.0, dmg: 14, tick: 0.45 });
    }
    this.pose.steam = 1.2;
    this.sfx('flame', 0.7, 0.6);
    yield this.tele(tele) + 1.2;
  }

  private *pipeVolley(lanes: number): Co {
    const g = this.g;
    this.anim = 'volley';
    const t = this.tele(0.85);
    const shots: { x: number; y: number; a: number }[] = [];
    for (let k = 0; k < lanes; k++) {
      const tip = this.pipeTip(Math.round((k / Math.max(1, lanes - 1)) * (this.pipes - 1)));
      const a = this.angleToPlayer(tip.x, tip.y) + (k - (lanes - 1) / 2) * 0.12;
      shots.push({ x: tip.x, y: tip.y, a });
      this.hz('line', 'lane', tip.x, tip.y, { x2: tip.x + Math.cos(a) * 900, y2: tip.y + Math.sin(a) * 900, r2: 16, tele: t, active: 0.01, dmg: 0 });
    }
    this.pose.mouth = 1;
    this.sfx('creak', 0.8, 0.6);
    yield t;
    for (let burst = 0; burst < 6; burst++) {
      for (const s of shots) this.bullet('note', s.x, s.y, s.a, 420, 13, { life: 3, r: 7 });
      this.sfx('pew', 0.3, 1.2);
      yield 0.08;
    }
    yield 0.8;
    void g;
  }

  /** The same vents twice: once as a warning, once 1.4 s later — the fugue's echo. */
  private *echoVents(): Co {
    const g = this.g;
    this.anim = 'vent';
    const spots: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const a = g.rng.angle();
      const d = i === 0 ? 0 : g.rng.range(90, 340);
      spots.push({ x: g.player.x + Math.cos(a) * d, y: g.player.y + Math.sin(a) * d });
    }
    for (const s of spots) this.hz('circle', 'steam', s.x, s.y, { r: 58, tele: this.tele(0.9), active: 0.9, dmg: 14, tick: 0.45 });
    yield 1.4;
    for (const s of spots) this.hz('circle', 'steam', s.x, s.y, { r: 66, tele: this.tele(0.7), active: 0.9, dmg: 14, tick: 0.45 });
    this.pose.steam = 1.4;
    yield 1.8;
  }

  /** Bellows draw breath (pull), then blow a cone of notes. */
  private *bellows(): Co {
    this.anim = 'bellows';
    const t = this.tele(0.7);
    this.hz('circle', 'inhale_warn', this.x, this.y, { r: 420, tele: t, active: 0.01, dmg: 0, safe: true });
    this.sfx('inhale', 0.9, 0.7);
    yield t;
    this.hz('circle', 'maw', this.x, this.y, { r: 60, tele: 0.01, active: 2.2, dmg: 18, tick: 0.5, pull: 120 });
    yield 2.2;
    this.pose.mouth = 1;
    const base = this.angleToPlayer();
    for (let i = 0; i < 26; i++) this.bullet('note', this.x, this.y - 20, base + this.g.rng.range(-0.6, 0.6), this.g.rng.range(180, 320), 14, { life: 4, r: 8 });
    this.sfx('popcornburst', 1, 0.6);
    yield 0.9;
  }

  /**
   * Lamp Crescendo — four ghost lamps ring the player; they light one at a time in the same order
   * the carousel sang. The whole floor erupts except the lit lamp. The safe lamp is always shown
   * (green), so the fight stays readable even for players who never learned the song.
   */
  private *lampCrescendo(beat: number): Co {
    const g = this.g;
    this.anim = 'crescendo';
    const order = (g.quests.get('last_song') as { order?: number[] } | undefined)?.order ?? [0, 1, 2, 3];
    const cx = g.player.x, cy = g.player.y;
    const R = 240;
    const pos = [0, 1, 2, 3].map((k) => ({ x: cx + Math.cos(-Math.PI / 2 + (k * TAU) / 4) * R, y: cy + Math.sin(-Math.PI / 2 + (k * TAU) / 4) * R }));
    for (let k = 0; k < 4; k++) this.hz('circle', 'lamp_ring', pos[k].x, pos[k].y, { r: 70, tele: beat * 4 + 0.6, active: 0.01, dmg: 0, safe: true, tag: k });
    this.sfx('calliope', 1, 0.7);
    yield 0.6;
    for (let k = 0; k < 4; k++) {
      const s = pos[order[k]];
      const note = LAST_SONG.lamps[order[k]].note;
      this.hz('circle', 'safe_lamp', s.x, s.y, { r: 70, tele: beat, active: 0.01, dmg: 0, safe: true, tag: order[k] });
      this.hz('circle', 'crescendo', cx, cy, { r: 900, tele: beat, active: 0.22, dmg: 22, holeX: s.x, holeY: s.y, holeR: 64 });
      g.bus.emit('sfx', { id: 'bellnote', vol: 0.9, pitch: note / 523.25 });
      yield beat + 0.15;
      g.fx.push('shake', cx, cy, 0.35);
    }
    yield 0.6;
  }

  protected *defeatSequence(): Co {
    const g = this.g;
    for (let i = 0; i < 200; i++) {
      if (i % 14 === 0) {
        const tip = this.pipeTip(g.rng.int(0, this.pipes - 1));
        g.fx.push('explosion', tip.x, tip.y, 60, 0, 0, 'boss');
        g.fx.push('spark', tip.x, tip.y, 8, 0, 0, 'smoke');
        this.sfx('boom', 0.5, 0.6 + g.rng.next() * 0.5);
      }
      this.rise = Math.max(0, 1 - Math.max(0, i - 100) / 100);
      yield 1 / 60;
    }
    g.fx.push('boss_death', this.x, this.y, 1, 0, 0, 'calliope');
    g.fx.push('flash', this.x, this.y, 1, 0, 0, 'light');
    yield 0.3;
  }
}
