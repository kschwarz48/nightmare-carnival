// Input: rebindable keyboard actions, mouse aim, and controllers (D-104: Xbox and PlayStation pads through
// pad.ts). Emits UI navigation events for controller-first menus, each with where it came from.
//
// The pad's layout (names in the Xbox / PlayStation style):
//   left stick / D-pad   move, and move a menu's focus     right stick   aim, and scroll a long page
//   A / Cross            confirm, interact                 B / Circle    back
//   X / Square           reroll                            Y / Triangle  banish (a draft); a co-op notice's action
//   LB / L1              skip (a draft); previous tab       RB / R1       chat; next tab
//   View / Create        the build sheet (and the PlayStation touchpad)
//   Menu / Options       pause                             R3            the damage meter: open, folded, hidden

import { DEFAULT_BINDINGS } from '../meta/save';
import { PAD, PadReader, padLabel, type PadKind, type PadLike } from './pad';

export type NavEvent = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause' | 'reroll' | 'banish' | 'skip' | 'interact' | 'chat' | 'meter' | 'build' | 'prev' | 'next';
/** Where a navigation event came from: the keyboard, a pad's buttons or D-pad, or a pad's left stick. */
export type NavSource = 'key' | 'pad' | 'stick';

/** What each pad button sends (the D-pad and the left stick send the directions). */
const PAD_EVENTS: Partial<Record<number, NavEvent>> = {
  [PAD.A]: 'confirm', [PAD.B]: 'back', [PAD.X]: 'reroll', [PAD.Y]: 'banish', [PAD.LB]: 'prev', [PAD.RB]: 'next',
  [PAD.VIEW]: 'build', [PAD.TOUCHPAD]: 'build', [PAD.MENU]: 'pause', [PAD.R3]: 'meter',
};

/** The mouse must travel this far (px) to take over from a pad: a nudged desk doesn't flip the prompts. */
const MOUSE_TAKEOVER = 4;

export class Input {
  private keys = new Set<string>();
  bindings: Record<string, string[]> = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  mouseX = 0;
  mouseY = 0;
  mouseActive = false;
  private mouseMovedAt = 0;
  /** the pads (D-104): which is in use, and its sticks */
  readonly pad = new PadReader();
  usingGamepad = false;
  /** the Settings' button prompts: the pad's own look, or always Xbox's or PlayStation's */
  promptStyle: 'auto' | PadKind = 'auto';
  /** 0..1: the Settings' vibration strength (0: none) */
  rumbleScale = 1;
  /** the D-pad walks as well as navigating (off while a pad menu over the night, like the quick chat, uses it) */
  dpadMoves = true;
  /** stand still whatever is held (a pad menu over the night is open) */
  holdMove = false;
  private listeners: ((e: NavEvent, src: NavSource) => void)[] = [];
  /** a pad was picked up (a first one, or another) or went away; `inUse`: it was what the player was playing with */
  onPad: ((e: 'connected' | 'disconnected', inUse: boolean) => void) | null = null;
  /** When true, keyboard events are being captured for rebinding. */
  captureBinding: ((code: string) => void) | null = null;
  /** what a pad's button does to a capture waiting for a key: it gives up (a pad has no keys to bind; D-104) */
  captureCancel: (() => void) | null = null;
  moveX = 0;
  moveY = 0;
  aimX = 1;
  aimY = 0;
  /** Screen→ground correction for mouse aim under the angled camera (set by the renderer). */
  aimScaleY = 1;
  aimActive = false;

  constructor(private target: HTMLElement) {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());
    // the pointer anywhere (a menu's panel too) takes over from a pad once it really moves; over the night it aims
    window.addEventListener('mousemove', (e) => {
      const far = Math.hypot(e.clientX - this.mouseX, e.clientY - this.mouseY) > MOUSE_TAKEOVER;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (!far && this.usingGamepad) return;
      this.usingGamepad = false;
      if (e.target === this.target) {
        this.mouseActive = true;
        this.mouseMovedAt = performance.now();
      }
    });
    window.addEventListener('mousedown', () => (this.usingGamepad = false));
    // (the reader notices a pad gone on its next read; listening keeps the browser's pad events going)
    window.addEventListener('gamepaddisconnected', () => {});
  }

  /** The look of the button prompts: the pad in use's, unless the Settings choose one. */
  get padKind(): PadKind {
    return this.promptStyle === 'auto' ? this.pad.kind : this.promptStyle;
  }

  /** The pad in use, for the Settings: its name, or null without one. */
  get padName(): string | null {
    return this.pad.index >= 0 ? padLabel(this.pad.id) : null;
  }

  onNav(fn: (e: NavEvent, src: NavSource) => void): void {
    this.listeners.push(fn);
  }
  private emit(e: NavEvent, src: NavSource = 'key'): void {
    for (const fn of this.listeners) fn(e, src);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (this.captureBinding && down) {
      e.preventDefault();
      const cb = this.captureBinding;
      this.captureBinding = this.captureCancel = null;
      cb(e.code);
      return;
    }
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') return;
    // the chat key opens the chat line (D-65): never typed into it, and never left held (its key-up lands in
    // the line, which keeps it from the game)
    if (down && (this.bindings.chat ?? []).includes(e.code)) {
      e.preventDefault();
      this.usingGamepad = false;
      this.emit('chat');
      return;
    }
    if (down) {
      // the keyboard has the prompts before its key acts (a key-up of what it opens reads the keyboard's)
      this.usingGamepad = false;
      if (!this.keys.has(e.code)) {
        for (const [action, codes] of Object.entries(this.bindings)) {
          if (!codes.includes(e.code)) continue;
          if (action === 'pause') this.emit('pause');
          if (action === 'confirm') this.emit('confirm');
          if (action === 'interact') this.emit('interact');
          if (action === 'reroll') this.emit('reroll');
          if (action === 'banish') this.emit('banish');
          if (action === 'skip') this.emit('skip');
          if (action === 'meter') this.emit('meter');
          if (action === 'build') this.emit('build');
          if (action === 'up') this.emit('up');
          if (action === 'down') this.emit('down');
          if (action === 'left') this.emit('left');
          if (action === 'right') this.emit('right');
        }
        if (e.code === 'Backspace') this.emit('back');
      }
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    } else this.keys.delete(e.code);
  }

  /** Forget every held key (the chat line took the keyboard: nobody keeps walking while typing). */
  releaseAll(): void {
    this.keys.clear();
    this.moveX = this.moveY = 0;
  }

  private held(action: string): boolean {
    for (const c of this.bindings[action] ?? []) if (this.keys.has(c)) return true;
    return false;
  }

  /** Poll once per frame. `center` = player's CSS screen position for mouse aim. */
  poll(centerX: number, centerY: number): void {
    let mx = 0, my = 0;
    if (this.held('left')) mx -= 1;
    if (this.held('right')) mx += 1;
    if (this.held('up')) my -= 1;
    if (this.held('down')) my += 1;
    // mouse aim
    const dx = this.mouseX - centerX, dy = this.mouseY - centerY;
    if (this.mouseActive && Math.hypot(dx, dy) > 8) {
      this.aimX = dx;
      this.aimY = dy * this.aimScaleY;
    }
    this.aimActive = this.mouseActive && performance.now() - this.mouseMovedAt < 1500;
    // the pads
    const pads = (navigator.getGamepads ? navigator.getGamepads() : []) as readonly (PadLike | null)[];
    const r = this.pad.read(pads, performance.now());
    if (r.lost) {
      // the pad in use went away: the app says so, and pauses a night it was playing
      const was = this.usingGamepad;
      this.usingGamepad = false;
      this.onPad?.('disconnected', was);
    }
    if (r.touched) this.usingGamepad = true;
    if (r.switched) this.onPad?.('connected', this.usingGamepad);
    const p = this.pad;
    if (p.state) {
      if (p.lx || p.ly) {
        mx = p.lx;
        my = p.ly;
      }
      if (this.dpadMoves) {
        if (p.held('UP')) my = -1;
        if (p.held('DOWN')) my = 1;
        if (p.held('LEFT')) mx = -1;
        if (p.held('RIGHT')) mx = 1;
      }
      if (Math.hypot(p.rx, p.ry) > 0.2) {
        this.aimX = p.rx;
        this.aimY = p.ry;
        this.aimActive = true;
      }
      for (const b of r.pressed) {
        // a key capture waiting in the Settings gives up at any pad button, which does nothing else
        if (this.captureBinding) {
          const cancel = this.captureCancel;
          this.captureBinding = this.captureCancel = null;
          cancel?.();
          continue;
        }
        const ev = PAD_EVENTS[b];
        if (ev) this.emit(ev, 'pad');
      }
      for (const n of r.nav) this.emit(n.dir, n.stick ? 'stick' : 'pad');
    }
    const l = Math.hypot(mx, my);
    if (l > 1) {
      mx /= l;
      my /= l;
    }
    if (this.holdMove) mx = my = 0;
    this.moveX = mx;
    this.moveY = my;
  }

  /** The right stick's up and down, for scrolling a long page (0 without a pad). */
  get scrollY(): number {
    return this.pad.state ? this.pad.ry : 0;
  }

  rumble(strength: number, ms: number): void {
    if (!this.usingGamepad || this.rumbleScale <= 0) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = this.pad.index >= 0 ? pads[this.pad.index] : null;
    const act = (pad as any)?.vibrationActuator;
    const k = Math.min(1, strength * this.rumbleScale);
    if (act?.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: k, weakMagnitude: k * 0.6 }).catch(() => {});
  }

  keyName(code: string): string {
    return code.replace('Key', '').replace('Digit', '').replace('Arrow', '↑→↓←'.includes(code) ? '' : '');
  }
}
