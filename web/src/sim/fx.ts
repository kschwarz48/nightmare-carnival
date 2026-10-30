// FX events: the simulation emits pure-data visual/audio cues; the renderer and audio consume them.
// This keeps the sim headless (no Three.js / WebAudio imports).

export type FxType =
  | 'death' // enemy death burst (style = DeathFx)
  | 'hit' // small impact spark
  | 'crit'
  | 'explosion' // weapon AoE (style: firework, popcorn, cannon, frost, fire, finale)
  | 'ring' // expanding shockwave ring visual (style)
  | 'slash' // melee arc (angle, half, r)
  | 'dmgnum' // damage number
  | 'heal'
  | 'pickup'
  | 'levelup'
  | 'evolve'
  | 'chest'
  | 'shake'
  | 'flash' // screen flash
  | 'text' // floating world text
  | 'spark' // small particles (style)
  | 'boss_death'
  | 'confetti'
  | 'dust';

export interface FxEvent {
  type: FxType;
  x: number;
  y: number;
  a: number; // generic params
  b: number;
  c: number;
  style: string;
  text?: string;
}

export class FxQueue {
  events: FxEvent[] = [];
  /** Hard cap per tick-drain so a screen-clear can't flood the renderer. */
  max = 1500;
  push(type: FxType, x: number, y: number, a = 0, b = 0, c = 0, style = '', text?: string): void {
    if (this.events.length >= this.max) {
      if (type === 'dmgnum' || type === 'hit' || type === 'spark') return;
      if (this.events.length >= this.max * 3) return; // nobody is draining (headless)
    }
    this.events.push({ type, x, y, a, b, c, style, text });
  }
  drain(): FxEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
