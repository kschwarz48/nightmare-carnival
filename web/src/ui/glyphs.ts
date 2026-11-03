// Button prompts (D-104): a pad's buttons drawn as their own caps (Xbox's coloured letters, PlayStation's shapes) and
// named its way ("RB" / "R1"), wherever the game shows a key. `padUi` is what the player is using right now (the app
// sets it every frame); `devText` marks a line that reads one way for the keyboard and another for a pad, and
// `refreshDevText` re-draws every such line on screen when the player picks up the pad or puts it down.

import type { PadKind } from '../input/pad';
import { h } from './dom';

export type Glyph = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'VIEW' | 'MENU' | 'L3' | 'R3' | 'LS' | 'RS' | 'DPAD' | 'TOUCHPAD';

/** What the player is using now: a pad (and whose look its prompts take) or the keyboard and mouse. */
export const padUi: { on: boolean; kind: PadKind } = { on: false, kind: 'xbox' };

/** Update `padUi`; true when it changed (the app then refreshes the lines that read differently). */
export function setPadUi(on: boolean, kind: PadKind): boolean {
  if (padUi.on === on && padUi.kind === kind) return false;
  padUi.on = on;
  padUi.kind = kind;
  return true;
}

const NAMES: Record<PadKind, Record<Glyph, string>> = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', VIEW: 'View', MENU: 'Menu', L3: 'LS', R3: 'RS', LS: 'Left stick', RS: 'Right stick', DPAD: 'D-pad', TOUCHPAD: 'View' },
  playstation: { A: 'Cross', B: 'Circle', X: 'Square', Y: 'Triangle', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', VIEW: 'Create', MENU: 'Options', L3: 'L3', R3: 'R3', LS: 'Left stick', RS: 'Right stick', DPAD: 'D-pad', TOUCHPAD: 'Touchpad' },
};

/** A button's name for a sentence ("R3 brings it back"). */
export function glyphName(b: Glyph, kind: PadKind = padUi.kind): string {
  return NAMES[kind][b];
}

const svg = (body: string) => `<svg viewBox="0 0 20 20" aria-hidden="true">${body}</svg>`;
const PS_FACE: Record<'A' | 'B' | 'X' | 'Y', string> = {
  A: svg('<path d="M5.4 5.4L14.6 14.6M14.6 5.4L5.4 14.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  B: svg('<circle cx="10" cy="10" r="5.4" fill="none" stroke="currentColor" stroke-width="2.4"/>'),
  X: svg('<rect x="5" y="5" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4"/>'),
  Y: svg('<path d="M10 4.4L15.8 14.5H4.2Z" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/>'),
};
const ICON = {
  view: svg('<rect x="3" y="4.6" width="9.4" height="7.4" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="7.6" y="8" width="9.4" height="7.4" rx="1.3" fill="currentColor"/>'),
  menu: svg('<path d="M4.5 6h11M4.5 10h11M4.5 14h11" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>'),
  dpad: svg('<path d="M7.6 2.6h4.8v5h5v4.8h-5v5H7.6v-5h-5V7.6h5z" fill="currentColor"/>'),
};

/** A button's cap as HTML (static markup, safe to set). */
export function glyphHtml(b: Glyph, kind: PadKind = padUi.kind): string {
  const ps = kind === 'playstation';
  const name = NAMES[kind][b];
  const cap = (cls: string, inner: string) => `<span class="pg ${cls}" role="img" aria-label="${name}">${inner}</span>`;
  switch (b) {
    case 'A': case 'B': case 'X': case 'Y':
      return ps ? cap(`face ps-${b.toLowerCase()}`, PS_FACE[b]) : cap(`face xb-${b.toLowerCase()}`, b);
    case 'VIEW':
      return ps ? cap('bar', 'Create') : cap('round', ICON.view);
    case 'MENU':
      return ps ? cap('bar', 'Options') : cap('round', ICON.menu);
    case 'TOUCHPAD':
      return ps ? cap('bar pad', 'Touchpad') : cap('round', ICON.view);
    case 'DPAD':
      return cap('round dpad', ICON.dpad);
    case 'LS': case 'RS':
      return cap('stick', b[0]);
    case 'L3': case 'R3':
      return cap('stick click', ps ? b : `${b[0]}S`);
    default:
      return cap('bar', name);
  }
}

/** A button's cap as an element. */
export function glyph(b: Glyph, kind: PadKind = padUi.kind): HTMLElement {
  return h('span', { class: 'pg-wrap', html: glyphHtml(b, kind) });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TOKEN = /\{(A|B|X|Y|LB|RB|LT|RT|VIEW|MENU|L3|R3|LS|RS|DPAD|TOUCHPAD)\}/g;

/** Text with `{A}`-style tokens drawn as caps (the rest escaped), for an element's HTML. */
export function padHtml(text: string, kind: PadKind = padUi.kind): string {
  let out = '', at = 0;
  for (const m of text.matchAll(TOKEN)) {
    out += esc(text.slice(at, m.index)) + glyphHtml(m[1] as Glyph, kind);
    at = m.index! + m[0].length;
  }
  return out + esc(text.slice(at));
}

/** Text with `{A}`-style tokens, the tokens spelled as names ("Press Cross"), for plain-text places. */
export function padPlain(text: string, kind: PadKind = padUi.kind): string {
  return text.replace(TOKEN, (_, b: Glyph) => NAMES[kind][b]);
}

/**
 * A line that reads `key` for the keyboard and mouse and `pad` (with `{A}`-style tokens) for a pad; it follows the
 * player's switches through `refreshDevText`.
 */
export function devText(key: string, pad: string, tag: 'span' | 'div' | 'small' = 'span', attrs: Record<string, unknown> = {}): HTMLElement {
  const el = h(tag, { ...attrs, 'data-key-text': key, 'data-pad-text': pad });
  fillDevText(el);
  return el;
}

function fillDevText(el: HTMLElement): void {
  const want = padUi.on ? `pad:${padUi.kind}` : 'key';
  if (el.dataset.devShown === want) return;
  el.dataset.devShown = want;
  if (padUi.on) el.innerHTML = padHtml(el.dataset.padText ?? '');
  else el.textContent = el.dataset.keyText ?? '';
}

/** Re-draw every keyboard-or-pad line under `root` for what the player is using now. */
export function refreshDevText(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-pad-text]').forEach(fillDevText);
}
