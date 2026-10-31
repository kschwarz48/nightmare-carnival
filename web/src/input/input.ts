// Input: rebindable keyboard actions, mouse aim, and gamepad (left stick move, right stick aim,
// A/B/Start/X/Y + D-pad for menus). Emits UI navigation events for controller-first menus.

import { DEFAULT_BINDINGS } from '../meta/save';

export type NavEvent = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause' | 'reroll' | 'banish' | 'skip' | 'interact' | 'chat';

export class Input {
  private keys = new Set<string>();
  bindings: Record<string, string[]> = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  mouseX = 0;
  mouseY = 0;
  mouseActive = false;
  private mouseMovedAt = 0;
  gamepadIndex = -1;
  usingGamepad = false;
  private padPrev: boolean[] = [];
  private navRepeat = new Map<string, number>();
  private listeners: ((e: NavEvent) => void)[] = [];
  /** When true, keyboard events are being captured for rebinding. */
  captureBinding: ((code: string) => void) | null = null;
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
    target.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.mouseActive = true;
      this.mouseMovedAt = performance.now();
      this.usingGamepad = false;
    });
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = (e as GamepadEvent).gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadIndex = -1;
      this.usingGamepad = false;
    });
  }

  onNav(fn: (e: NavEvent) => void): void {
    this.listeners.push(fn);
  }
  private emit(e: NavEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (this.captureBinding && down) {
      e.preventDefault();
      const cb = this.captureBinding;
      this.captureBinding = null;
      cb(e.code);
      return;
    }
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') return;
    // the chat key opens the chat line (D-65): never typed into it, and never left held (its key-up lands in
    // the line, which keeps it from the game)
    if (down && (this.bindings.chat ?? []).includes(e.code)) {
      e.preventDefault();
      this.emit('chat');
      return;
    }
    if (down) {
      if (!this.keys.has(e.code)) {
        for (const [action, codes] of Object.entries(this.bindings)) {
          if (!codes.includes(e.code)) continue;
          if (action === 'pause') this.emit('pause');
          if (action === 'confirm') this.emit('confirm');
          if (action === 'interact') this.emit('interact');
          if (action === 'reroll') this.emit('reroll');
          if (action === 'banish') this.emit('banish');
          if (action === 'skip') this.emit('skip');
          if (action === 'up') this.emit('up');
          if (action === 'down') this.emit('down');
          if (action === 'left') this.emit('left');
          if (action === 'right') this.emit('right');
        }
        if (e.code === 'Backspace') this.emit('back');
      }
      this.keys.add(e.code);
      this.usingGamepad = false;
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
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    if (this.gamepadIndex >= 0) pad = pads[this.gamepadIndex] ?? null;
    if (!pad) for (const p of pads) if (p) { pad = p; this.gamepadIndex = p.index; break; }
    if (pad) {
      const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
      const lx = dz(pad.axes[0] ?? 0), ly = dz(pad.axes[1] ?? 0);
      const rx = dz(pad.axes[2] ?? 0), ry = dz(pad.axes[3] ?? 0);
      if (Math.hypot(lx, ly) > 0) {
        mx = lx;
        my = ly;
        this.usingGamepad = true;
      }
      if (pad.buttons[12]?.pressed) my = -1;
      if (pad.buttons[13]?.pressed) my = 1;
      if (pad.buttons[14]?.pressed) mx = -1;
      if (pad.buttons[15]?.pressed) mx = 1;
      if (Math.hypot(rx, ry) > 0.2) {
        this.aimX = rx;
        this.aimY = ry;
        this.aimActive = true;
        this.usingGamepad = true;
      }
      const btn = (i: number) => !!pad!.buttons[i]?.pressed;
      const edge = (i: number, ev: NavEvent) => {
        const b = btn(i);
        if (b && !this.padPrev[i]) {
          this.usingGamepad = true;
          this.emit(ev);
        }
        this.padPrev[i] = b;
      };
      edge(0, 'confirm');
      edge(1, 'back');
      edge(9, 'pause');
      edge(8, 'pause');
      edge(2, 'reroll');
      edge(3, 'banish');
      edge(4, 'skip');
      // D-pad / stick navigation with key-repeat
      const navDir = (name: NavEvent, active: boolean) => {
        const now = performance.now();
        const t = this.navRepeat.get(name) ?? 0;
        if (active) {
          if (t === 0) {
            this.emit(name);
            this.navRepeat.set(name, now + 380);
          } else if (now > t) {
            this.emit(name);
            this.navRepeat.set(name, now + 120);
          }
        } else this.navRepeat.set(name, 0);
      };
      navDir('up', btn(12) || ly < -0.6);
      navDir('down', btn(13) || ly > 0.6);
      navDir('left', btn(14) || lx < -0.6);
      navDir('right', btn(15) || lx > 0.6);
    }
    const l = Math.hypot(mx, my);
    if (l > 1) {
      mx /= l;
      my /= l;
    }
    this.moveX = mx;
    this.moveY = my;
  }

  rumble(strength: number, ms: number): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = this.gamepadIndex >= 0 ? pads[this.gamepadIndex] : null;
    const act = (pad as any)?.vibrationActuator;
    if (act?.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch(() => {});
  }

  keyName(code: string): string {
    return code.replace('Key', '').replace('Digit', '').replace('Arrow', '↑→↓←'.includes(code) ? '' : '');
  }
}
