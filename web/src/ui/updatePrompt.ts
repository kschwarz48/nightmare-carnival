// The "Restart & Update" card (engineering optimization pass): a small marquee panel at the bottom of the
// screen, shown only at a safe moment (src/app.ts decides when). It never blocks play and never restarts
// by itself; "Later" puts it away until the next safe moment after a while.
import { h } from './dom';

export interface UpdateOffer {
  /** 'game': a newer web build is live; 'shell': the Windows app downloaded a new version of itself */
  kind: 'game' | 'shell';
  version?: string;
}

export class UpdatePrompt {
  readonly root = h('div', { class: 'update-prompt panel hidden', role: 'dialog', 'aria-live': 'polite' });
  private title = h('div', { class: 'up-title' });
  private text = h('div', { class: 'up-text' });
  private status = h('div', { class: 'up-status' });
  // (data-nav: a menu's D-pad reaches them, D-104)
  private go = h('button', { class: 'btn small', 'data-nav': '' }, 'Restart & Update') as HTMLButtonElement;
  private later = h('button', { class: 'btn small purple', 'data-nav': '' }, 'Later') as HTMLButtonElement;
  offer: UpdateOffer | null = null;

  constructor(onRestart: (o: UpdateOffer) => void, onLater: (o: UpdateOffer) => void) {
    this.go.onclick = () => this.offer && onRestart(this.offer);
    this.later.onclick = () => {
      if (this.offer) onLater(this.offer);
      this.hide();
    };
    this.root.append(h('div', { class: 'up-bulbs' }), this.title, this.text, this.status, h('div', { class: 'up-buttons' }, this.go, this.later));
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  show(o: UpdateOffer): void {
    this.offer = o;
    this.root.classList.remove('note');
    this.title.textContent = 'Nightmare Carnival Update Available';
    this.text.textContent = o.kind === 'shell'
      ? `A new version of the Windows app${o.version ? ` (${o.version})` : ''} is ready. Restart to install it.`
      : 'A new version is ready. Restart the game to apply the latest improvements.';
    this.go.textContent = o.kind === 'shell' ? 'Restart & Install' : 'Restart & Update';
    this.status.textContent = '';
    this.go.disabled = false;
    this.root.classList.remove('hidden');
  }

  /** A note under the text (restarting, or why it couldn't). */
  setStatus(text: string, busy = false): void {
    this.status.textContent = text;
    this.go.disabled = busy;
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  /** A passing note with no buttons (after an update), gone after a few seconds. */
  note(text: string): void {
    this.offer = null;
    this.title.textContent = 'Nightmare Carnival';
    this.text.textContent = text;
    this.status.textContent = '';
    this.root.classList.add('note');
    this.root.classList.remove('hidden');
    setTimeout(() => {
      this.root.classList.remove('note');
      if (!this.offer) this.hide();
    }, 6000);
  }
}
