// The pad's chat (D-104): RB opens a list of quick lines to send with one press (in co-op), "Type a message…" for the
// on-screen keyboard, and the chat log beside it to read back with the right stick. Solo it is the log alone. B or RB
// closes it. While it's open in a co-op night you stand still (as typing on the keyboard does); solo the night waits.

import { FocusNav, h } from './dom';

export const QUICK_LINES = ['Help!', 'Revive me!', 'Over here!', 'On my way!', 'Wait for me!', 'Let’s go!', 'Nice one!', 'Thanks!', 'Sorry!', 'Ready!'];

export class QuickChat {
  readonly root = h('div', { class: 'quickchat panel hidden' });
  readonly nav = new FocusNav(this.root);
  isOpen = false;
  /** a line picked, to send */
  onPick: (text: string) => void = () => {};
  /** "Type a message…": the app opens the on-screen keyboard */
  onType: () => void = () => {};

  /** Open beside the chat log (`bottom`: where the chat box sits); without `canSend` there is nothing to list. */
  open(canSend: boolean, bottom: number): void {
    this.isOpen = true;
    this.root.classList.toggle('hidden', !canSend);
    this.root.style.bottom = `${Math.round(bottom)}px`;
    if (!canSend) return;
    this.root.replaceChildren(
      h('div', { class: 'qc-title' }, 'Quick chat'),
      ...QUICK_LINES.map((t, i) => h('button', { class: 'qc-line', 'data-nav': '', 'data-default': i === 0 ? '' : undefined, onclick: () => this.onPick(t) }, t)),
      h('button', { class: 'qc-line type', 'data-nav': '', onclick: () => this.onType() }, 'Type a message…'),
    );
    this.nav.current = null;
    this.nav.ensure();
  }

  close(): void {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }
}
