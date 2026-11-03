// Controllers (D-104): Xbox and PlayStation pads, read the same way whatever the browser reports. Chrome, Edge and
// the Windows app give both the W3C "standard" layout; Firefox can give a PlayStation pad raw (DirectInput order:
// Square, Cross, Circle, Triangle…, the right stick's Y on axis 5, the D-pad as a hat on axis 9), which is put into
// the standard order here. The pad in use is the last one touched (a second pad, or a wheel or a pedal that reports
// itself as one, doesn't steal it by sitting there). The sticks get a round dead zone: a square one snaps a gentle
// diagonal onto an axis. Pure: no DOM, so the tests drive it with plain objects.

export type PadKind = 'xbox' | 'playstation';

/** The standard layout's buttons, by index. */
export const PAD = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16, TOUCHPAD: 17,
} as const;
export type PadButton = keyof typeof PAD;
const BUTTONS = 18;

/** What the game reads from a Gamepad (the browser's, or a test's). */
export interface PadLike {
  id: string;
  index: number;
  mapping: string;
  connected: boolean;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

/**
 * Which pad's names and symbols to show: Sony's vendor id (054c; Firefox writes it 54c) or its names make a
 * PlayStation pad, anything else reads as an Xbox one (every XInput pad reports itself as an Xbox 360 controller).
 */
export function padKind(id: string): PadKind {
  const s = id.toLowerCase();
  if (/dualsense|dualshock|playstation|\bps[345]\b|sony/.test(s) || /(^|[^0-9a-f])0?54c([^0-9a-f]|$)/.test(s)) return 'playstation';
  return 'xbox';
}

/** A pad's name for a sentence ("DualSense Wireless Controller"), without the browser's vendor and mapping notes. */
export function padLabel(id: string): string {
  const s = id.replace(/\(.*?\)/g, '').replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, '').replace(/\s+/g, ' ').trim();
  return s || (padKind(id) === 'playstation' ? 'PlayStation controller' : 'Controller');
}

/** A raw PlayStation pad's buttons (Firefox) → the standard indices. */
const SONY_RAW = [PAD.X, PAD.A, PAD.B, PAD.Y, PAD.LB, PAD.RB, PAD.LT, PAD.RT, PAD.VIEW, PAD.MENU, PAD.L3, PAD.R3, PAD.HOME, PAD.TOUCHPAD];

/** One pad in the standard layout: buttons held (by index) and the sticks and triggers, raw. */
export interface PadState {
  down: boolean[];
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  lt: number;
  rt: number;
}

const ax = (a: readonly number[], i: number) => (Number.isFinite(a[i]) ? a[i] : 0);

export function standardize(p: PadLike): PadState {
  const down = new Array<boolean>(BUTTONS).fill(false);
  const held = (i: number) => {
    const b = p.buttons[i];
    return !!b && (b.pressed || b.value > 0.5);
  };
  const a = p.axes;
  if (p.mapping !== 'standard' && padKind(p.id) === 'playstation') {
    SONY_RAW.forEach((s, raw) => {
      if (held(raw)) down[s] = true;
    });
    // the hat: -1 up, then clockwise in steps of 2/7; anything past ±1 is its rest
    const hat = a.length > 9 ? ax(a, 9) : 9;
    if (Math.abs(hat) <= 1.05) {
      const k = Math.round((hat + 1) * 3.5) % 8;
      if (k === 7 || k <= 1) down[PAD.UP] = true;
      if (k >= 1 && k <= 3) down[PAD.RIGHT] = true;
      if (k >= 3 && k <= 5) down[PAD.DOWN] = true;
      if (k >= 5 && k <= 7) down[PAD.LEFT] = true;
    }
    return { down, lx: ax(a, 0), ly: ax(a, 1), rx: ax(a, 2), ry: ax(a, 5), lt: (ax(a, 3) + 1) / 2, rt: (ax(a, 4) + 1) / 2 };
  }
  for (let i = 0; i < BUTTONS; i++) down[i] = held(i);
  return { down, lx: ax(a, 0), ly: ax(a, 1), rx: ax(a, 2), ry: ax(a, 3), lt: p.buttons[6]?.value ?? 0, rt: p.buttons[7]?.value ?? 0 };
}

/**
 * A round dead zone, rescaled: just past `inner` is a crawl and `outer` is full (worn sticks rarely reach 1). A
 * square dead zone (each axis on its own) snaps a gentle diagonal onto the nearer axis.
 */
export function deadzone(x: number, y: number, inner: number, outer = 0.94): [number, number] {
  const m = Math.hypot(x, y);
  if (!(m > inner)) return [0, 0];
  const k = Math.min(1, (m - inner) / Math.max(0.01, outer - inner)) / m;
  return [x * k, y * k];
}

export type PadDir = 'up' | 'down' | 'left' | 'right';
const DIRS: PadDir[] = ['up', 'down', 'left', 'right'];
const DPAD: Record<PadDir, number> = { up: PAD.UP, down: PAD.DOWN, left: PAD.LEFT, right: PAD.RIGHT };

/** A stick pushed this far moves a menu's focus (its stronger axis only, so a diagonal doesn't move it twice). */
const NAV_PUSH = 0.6;
/** A held direction repeats after this long, then this often (ms). */
export const NAV_DELAY = 380;
export const NAV_RATE = 120;

export interface PadRead {
  /** buttons pressed since the last read, on the pad in use (standard indices) */
  pressed: number[];
  /** menu moves this read: a direction just pushed, or one held long enough to repeat; `stick`: the left stick's */
  nav: { dir: PadDir; stick: boolean }[];
  /** the pad in use was touched: a button pressed, or a stick past its dead zone */
  touched: boolean;
  /** the pad in use changed (a first pad, or another one picked up) */
  switched: boolean;
  /** the pad in use is gone (unplugged, out of battery) */
  lost: boolean;
}

export class PadReader {
  /** the pad in use: its index in the browser's list, its id, and whose names its buttons go by */
  index = -1;
  id = '';
  kind: PadKind = 'xbox';
  /** the sticks' dead zone (the Settings' "Stick dead zone") */
  deadzone = 0.18;
  /** the pad in use this read, and its sticks after the dead zone */
  state: PadState | null = null;
  lx = 0;
  ly = 0;
  rx = 0;
  ry = 0;
  private prev = new Map<number, boolean[]>();
  private pushed = new Map<number, boolean>();
  private repeat: Record<PadDir, number> = { up: 0, down: 0, left: 0, right: 0 };

  read(pads: readonly (PadLike | null | undefined)[], now: number): PadRead {
    const out: PadRead = { pressed: [], nav: [], touched: false, switched: false, lost: false };
    const live: { p: PadLike; s: PadState; fresh: boolean }[] = [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const s = standardize(p);
      const was = this.prev.get(p.index);
      const press = s.down.some((d, i) => d && !was?.[i]);
      const push = Math.hypot(s.lx, s.ly) > 0.5 || Math.hypot(s.rx, s.ry) > 0.5;
      const pushNew = push && !this.pushed.get(p.index);
      this.pushed.set(p.index, push);
      live.push({ p, s, fresh: press || pushNew });
    }
    let cur = live.find((l) => l.p.index === this.index) ?? null;
    if (!cur && this.index >= 0) {
      out.lost = true;
      this.index = -1;
      this.id = '';
    }
    // another pad touched while the one in use sits still takes over; with none in use, the first touched (or the
    // only one there)
    const other = live.find((l) => l !== cur && l.fresh);
    if (other && !(cur?.fresh)) cur = other;
    else if (!cur && live.length) cur = live[0];
    if (cur && cur.p.index !== this.index) {
      this.index = cur.p.index;
      this.id = cur.p.id;
      this.kind = padKind(cur.p.id);
      this.repeat = { up: 0, down: 0, left: 0, right: 0 };
      out.switched = true;
    }
    this.state = cur?.s ?? null;
    if (cur) {
      const s = cur.s, was = this.prev.get(cur.p.index);
      for (let i = 0; i < BUTTONS; i++) if (s.down[i] && !was?.[i]) out.pressed.push(i);
      [this.lx, this.ly] = deadzone(s.lx, s.ly, this.deadzone);
      [this.rx, this.ry] = deadzone(s.rx, s.ry, this.deadzone);
      out.touched = out.pressed.length > 0 || this.lx !== 0 || this.ly !== 0 || this.rx !== 0 || this.ry !== 0;
      const m = Math.hypot(s.lx, s.ly);
      const horiz = Math.abs(s.lx) > Math.abs(s.ly);
      const stickDir: PadDir | null = m < NAV_PUSH ? null : horiz ? (s.lx < 0 ? 'left' : 'right') : s.ly < 0 ? 'up' : 'down';
      for (const d of DIRS) {
        const dpad = s.down[DPAD[d]];
        const on = dpad || stickDir === d;
        if (!on) {
          this.repeat[d] = 0;
          continue;
        }
        if (this.repeat[d] === 0) {
          out.nav.push({ dir: d, stick: !dpad });
          this.repeat[d] = now + NAV_DELAY;
        } else if (now >= this.repeat[d]) {
          out.nav.push({ dir: d, stick: !dpad });
          this.repeat[d] = now + NAV_RATE;
        }
      }
    } else this.lx = this.ly = this.rx = this.ry = 0;
    // remember every pad's buttons (the next pad picked up mustn't fire what it already held), forget the gone
    const seen = new Set<number>();
    for (const l of live) {
      this.prev.set(l.p.index, l.s.down);
      seen.add(l.p.index);
    }
    for (const k of [...this.prev.keys()]) {
      if (!seen.has(k)) {
        this.prev.delete(k);
        this.pushed.delete(k);
      }
    }
    return out;
  }

  /** Is this button held on the pad in use? */
  held(b: PadButton): boolean {
    return !!this.state?.down[PAD[b]];
  }
}
