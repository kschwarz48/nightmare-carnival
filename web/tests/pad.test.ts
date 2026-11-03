// Controllers (D-104): Xbox and PlayStation pads read the same way whatever the browser reports (Chrome's standard
// layout, Firefox's raw DualSense), the pad in use is the last one touched, a round dead zone, menu moves that
// repeat, and the prompts' names.

import { describe, expect, it } from 'vitest';
import { NAV_DELAY, NAV_RATE, PAD, PadReader, deadzone, padKind, padLabel, standardize, type PadLike } from '../src/input/pad';
import { glyphName, padHtml, padPlain } from '../src/ui/glyphs';
import { freshSave, migrate } from '../src/meta/save';

const XBOX_ID = 'Xbox 360 Controller (XInput STANDARD GAMEPAD)';
const DS_CHROME = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const DS_FIREFOX = '54c-ce6-DualSense Wireless Controller';

/** A pad with these buttons held (by index) and these axes. */
function pad(o: { id?: string; index?: number; mapping?: string; held?: number[]; axes?: number[]; buttons?: number } = {}): PadLike {
  const n = o.buttons ?? 17;
  return {
    id: o.id ?? XBOX_ID,
    index: o.index ?? 0,
    mapping: o.mapping ?? 'standard',
    connected: true,
    axes: o.axes ?? [0, 0, 0, 0],
    buttons: Array.from({ length: n }, (_, i) => ({ pressed: !!o.held?.includes(i), value: o.held?.includes(i) ? 1 : 0 })),
  };
}

describe('which pad it is (D-104)', () => {
  it('knows a PlayStation pad by its name or Sony’s vendor id, in Chrome’s and Firefox’s spelling', () => {
    expect(padKind(DS_CHROME)).toBe('playstation');
    expect(padKind(DS_FIREFOX)).toBe('playstation');
    expect(padKind('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)')).toBe('playstation');
    expect(padKind('DualSense Edge Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0df2)')).toBe('playstation');
  });

  it('reads everything else as an Xbox pad', () => {
    expect(padKind(XBOX_ID)).toBe('xbox');
    expect(padKind('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')).toBe('xbox');
    expect(padKind('Unknown Gamepad (Vendor: 2dc8 Product: 6001)')).toBe('xbox');
    // a product id with 054c in it isn't Sony's vendor id
    expect(padKind('Some Pad (Vendor: 1234 Product: 1054c)')).toBe('xbox');
  });

  it('names it for a sentence without the browser’s notes', () => {
    expect(padLabel(DS_CHROME)).toBe('DualSense Wireless Controller');
    expect(padLabel(DS_FIREFOX)).toBe('DualSense Wireless Controller');
    expect(padLabel(XBOX_ID)).toBe('Xbox 360 Controller');
  });
});

describe('the standard layout (D-104)', () => {
  it('takes a standard pad as it is', () => {
    const s = standardize(pad({ held: [PAD.A, PAD.RB], axes: [0.5, -0.25, 0.1, 0.9] }));
    expect(s.down[PAD.A]).toBe(true);
    expect(s.down[PAD.RB]).toBe(true);
    expect(s.down[PAD.B]).toBe(false);
    expect([s.lx, s.ly, s.rx, s.ry]).toEqual([0.5, -0.25, 0.1, 0.9]);
  });

  it('puts Firefox’s raw DualSense into the standard order: Cross is A, Square is X, the right stick’s Y is axis 5', () => {
    // raw: 0 Square, 1 Cross, 2 Circle, 3 Triangle, 4 L1, 5 R1, …, 9 Options, 12 PS, 13 touchpad
    const raw = (held: number[], axes = [0, 0, 0, -1, -1, 0]) => standardize(pad({ id: DS_FIREFOX, mapping: '', held, axes, buttons: 15 }));
    expect(raw([1]).down[PAD.A]).toBe(true);
    expect(raw([0]).down[PAD.X]).toBe(true);
    expect(raw([2]).down[PAD.B]).toBe(true);
    expect(raw([3]).down[PAD.Y]).toBe(true);
    expect(raw([9]).down[PAD.MENU]).toBe(true);
    expect(raw([13]).down[PAD.TOUCHPAD]).toBe(true);
    const s = raw([], [0.2, 0.3, -0.4, -1, -1, 0.7]);
    expect([s.lx, s.ly, s.rx, s.ry]).toEqual([0.2, 0.3, -0.4, 0.7]);
    expect(s.lt).toBe(0);
  });

  it('reads a raw pad’s D-pad from its hat (axis 9): up, the diagonals, and its rest', () => {
    const hat = (v: number) => {
      const axes = [0, 0, 0, -1, -1, 0, 0, 0, 0, v];
      const d = standardize(pad({ id: DS_FIREFOX, mapping: '', axes, buttons: 15 })).down;
      return ['UP', 'RIGHT', 'DOWN', 'LEFT'].filter((k) => d[PAD[k as 'UP']]).join('+');
    };
    expect(hat(-1)).toBe('UP');
    expect(hat(-5 / 7)).toBe('UP+RIGHT');
    expect(hat(-3 / 7)).toBe('RIGHT');
    expect(hat(1 / 7)).toBe('DOWN');
    expect(hat(5 / 7)).toBe('LEFT');
    expect(hat(1)).toBe('UP+LEFT');
    expect(hat(3.2857)).toBe('');
  });

  it('counts an analog trigger past half as held, and ignores broken axes', () => {
    const p = pad();
    (p.buttons as { pressed: boolean; value: number }[])[PAD.RT] = { pressed: false, value: 0.7 };
    const s = standardize({ ...p, axes: [NaN, 0.3, Infinity, 0] });
    expect(s.down[PAD.RT]).toBe(true);
    expect(s.lx).toBe(0);
    expect(s.rx).toBe(0);
  });
});

describe('the dead zone (D-104)', () => {
  it('is round: a gentle diagonal stays a diagonal instead of snapping onto an axis', () => {
    const [x, y] = deadzone(0.2, 0.2, 0.18);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeCloseTo(x, 6);
  });

  it('is still inside, a crawl just past it, and full at the rim (a worn stick that stops at 0.95 too)', () => {
    expect(deadzone(0.1, 0.1, 0.18)).toEqual([0, 0]);
    expect(Math.hypot(...deadzone(0.2, 0, 0.18))).toBeLessThan(0.05);
    expect(Math.hypot(...deadzone(0.95, 0, 0.18))).toBeCloseTo(1, 6);
    expect(Math.hypot(...deadzone(0.7, 0.7, 0.18))).toBeCloseTo(1, 6);
  });
});

describe('reading the pads (D-104)', () => {
  it('reports a press once, as it goes down', () => {
    const r = new PadReader();
    expect(r.read([pad({ held: [PAD.A] })], 0).pressed).toEqual([PAD.A]);
    expect(r.read([pad({ held: [PAD.A] })], 16).pressed).toEqual([]);
    expect(r.read([pad()], 32).pressed).toEqual([]);
    expect(r.read([pad({ held: [PAD.A] })], 48).pressed).toEqual([PAD.A]);
  });

  it('takes a first pad at once, and says so', () => {
    const r = new PadReader();
    const out = r.read([null, pad({ index: 1, id: DS_CHROME, held: [PAD.A] })], 0);
    expect(out.switched).toBe(true);
    expect(out.touched).toBe(true);
    expect(r.index).toBe(1);
    expect(r.kind).toBe('playstation');
  });

  it('follows the pad last touched: a second pad pressed takes over, one sitting there doesn’t', () => {
    const r = new PadReader();
    r.read([pad({ index: 0, held: [PAD.A] }), pad({ index: 1, id: DS_CHROME })], 0);
    expect(r.index).toBe(0);
    // the second pad sits still: nothing changes
    expect(r.read([pad({ index: 0 }), pad({ index: 1, id: DS_CHROME })], 16).switched).toBe(false);
    // its Cross: it's the pad in use now, and the press counts
    const out = r.read([pad({ index: 0 }), pad({ index: 1, id: DS_CHROME, held: [PAD.A] })], 32);
    expect(out.switched).toBe(true);
    expect(out.pressed).toEqual([PAD.A]);
    expect(r.kind).toBe('playstation');
  });

  it('doesn’t let a pad that only holds a button steal it, nor fire that button when it takes over', () => {
    const r = new PadReader();
    // a wheel's pedal held down from the start
    r.read([pad({ index: 0, held: [PAD.A] }), pad({ index: 1, held: [PAD.RT] })], 0);
    r.read([pad({ index: 0 }), pad({ index: 1, held: [PAD.RT] })], 16);
    expect(r.read([pad({ index: 0 }), pad({ index: 1, held: [PAD.RT] })], 32).switched).toBe(false);
    expect(r.index).toBe(0);
    // it's picked up for real (a new press): RT, held all along, doesn't fire
    const out = r.read([pad({ index: 0 }), pad({ index: 1, held: [PAD.RT, PAD.B] })], 48);
    expect(out.switched).toBe(true);
    expect(out.pressed).toEqual([PAD.B]);
  });

  it('notices the pad in use gone, and takes the one left', () => {
    const r = new PadReader();
    r.read([pad({ index: 0, held: [PAD.A] }), pad({ index: 1, id: DS_CHROME })], 0);
    const out = r.read([null, pad({ index: 1, id: DS_CHROME })], 16);
    expect(out.lost).toBe(true);
    expect(r.index).toBe(1);
    const gone = new PadReader();
    gone.read([pad({ held: [PAD.A] })], 0);
    const last = gone.read([null], 16);
    expect(last.lost).toBe(true);
    expect(gone.index).toBe(-1);
    expect(gone.state).toBeNull();
  });

  it('touched: a press, or a stick past the dead zone; a stick at rest is not', () => {
    const r = new PadReader();
    r.read([pad()], 0);
    expect(r.read([pad({ axes: [0.1, 0, 0, 0] })], 16).touched).toBe(false);
    expect(r.read([pad({ axes: [0.6, 0, 0, 0] })], 32).touched).toBe(true);
    expect(r.read([pad({ axes: [0, 0, 0, -0.6] })], 48).touched).toBe(true);
  });

  it('moves a menu once on a push, then repeats after a pause while held', () => {
    const r = new PadReader();
    const dirs = (t: number, held: number[] = [PAD.DOWN]) => r.read([pad({ held })], t).nav.map((n) => n.dir);
    expect(dirs(0)).toEqual(['down']);
    expect(dirs(100)).toEqual([]);
    expect(dirs(NAV_DELAY)).toEqual(['down']);
    expect(dirs(NAV_DELAY + NAV_RATE - 1)).toEqual([]);
    expect(dirs(NAV_DELAY + NAV_RATE)).toEqual(['down']);
    expect(dirs(NAV_DELAY + NAV_RATE + 16, [])).toEqual([]);
    expect(dirs(NAV_DELAY + NAV_RATE + 32)).toEqual(['down']);
  });

  it('moves a menu by the stick’s stronger axis only (a diagonal doesn’t move it twice), and marks it the stick’s', () => {
    const r = new PadReader();
    const out = r.read([pad({ axes: [0.7, 0.5, 0, 0] })], 0);
    expect(out.nav).toEqual([{ dir: 'right', stick: true }]);
    const d = new PadReader().read([pad({ held: [PAD.UP] })], 0);
    expect(d.nav).toEqual([{ dir: 'up', stick: false }]);
  });

  it('keeps the sticks after its dead zone (the Settings’ one)', () => {
    const r = new PadReader();
    r.deadzone = 0.3;
    r.read([pad({ axes: [0.25, 0, 0, 0.94] })], 0);
    expect(r.lx).toBe(0);
    expect(r.ry).toBeCloseTo(1, 6);
  });
});

describe('the prompts’ names (D-104)', () => {
  it('names the buttons Xbox’s way or PlayStation’s', () => {
    expect(glyphName('A', 'xbox')).toBe('A');
    expect(glyphName('A', 'playstation')).toBe('Cross');
    expect(glyphName('RB', 'playstation')).toBe('R1');
    expect(glyphName('VIEW', 'playstation')).toBe('Create');
    expect(glyphName('R3', 'xbox')).toBe('RS');
  });

  it('draws a line’s tokens as caps and escapes the rest', () => {
    const html = padHtml('{A} <b>go</b>', 'playstation');
    expect(html).toContain('ps-a');
    expect(html).toContain('&lt;b&gt;go&lt;/b&gt;');
    expect(padHtml('{LB}{RB} wing', 'xbox')).toContain('LB');
    expect(padPlain('{R3} brings it back', 'playstation')).toBe('R3 brings it back');
    expect(padPlain('{A} more', 'playstation')).toBe('Cross more');
  });
});

describe('the controller settings (D-104)', () => {
  it('start as the controller’s own prompts, a firm rumble and the old dead zone', () => {
    const st = freshSave().settings;
    expect(st.padPrompts).toBe('auto');
    expect(st.rumble).toBe(0.8);
    expect(st.stickDeadzone).toBe(0.18);
  });

  it('come to an older save as the defaults, and a broken value is put right', () => {
    const old = freshSave() as any;
    delete old.settings.padPrompts;
    delete old.settings.rumble;
    delete old.settings.stickDeadzone;
    expect(migrate(JSON.parse(JSON.stringify(old))).settings).toMatchObject({ padPrompts: 'auto', rumble: 0.8, stickDeadzone: 0.18 });
    const bad = freshSave() as any;
    Object.assign(bad.settings, { padPrompts: 'gamecube', rumble: 7, stickDeadzone: -1 });
    expect(migrate(JSON.parse(JSON.stringify(bad))).settings).toMatchObject({ padPrompts: 'auto', rumble: 1, stickDeadzone: 0.05 });
    const ps = freshSave() as any;
    ps.settings.padPrompts = 'playstation';
    expect(migrate(JSON.parse(JSON.stringify(ps))).settings.padPrompts).toBe('playstation');
  });
});
