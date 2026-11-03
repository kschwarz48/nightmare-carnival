// The pad's hint bar (D-104): along the foot of a menu while a pad is in use, what its buttons do there ("A Select ·
// B Back · LB/RB Wing"), and above it the focused item's note (why a map is locked, what a stat counts), which a
// mouse reads as a tooltip.

import { h } from './dom';
import { padHtml, padUi } from './glyphs';

export interface PadBarSpec {
  /** the hints, with `{A}`-style tokens */
  hints: string;
  /** the focused item's note */
  tip?: string;
}

export class PadBar {
  readonly root = h('div', { class: 'padbar hidden' });
  private tipEl = h('div', { class: 'pb-tip hidden' });
  private hintEl = h('div', { class: 'pb-hints' });
  private key = '';

  constructor() {
    this.root.append(this.tipEl, this.hintEl);
  }

  update(spec: PadBarSpec | null): void {
    const k = spec ? `${padUi.kind}|${spec.hints}|${spec.tip ?? ''}` : '';
    if (k === this.key) return;
    this.key = k;
    this.root.classList.toggle('hidden', !spec);
    if (!spec) return;
    this.hintEl.innerHTML = padHtml(spec.hints);
    this.tipEl.textContent = spec.tip ?? '';
    this.tipEl.classList.toggle('hidden', !spec.tip);
  }
}
