// The chat box (D-65): co-op players talk here, and every whisper and fortune of a hidden quest is
// written into it too, so a clue that faded off the screen can still be read back. Bottom-left; new
// lines linger, then fade; T opens the line (Enter sends, Esc closes) whenever a co-op session is up.
// Everything is set as text, never markup.

import { h } from './dom';

export type ChatKind = 'player' | 'quest' | 'fortune' | 'system';
export interface ChatLine {
  kind: ChatKind;
  text: string;
  /** a second, quieter line (a whisper's subtitle) */
  sub?: string;
  /** who said it (players, Zoltana) */
  who?: string;
  /** the speaker's colour (players) */
  color?: string;
}

/** lines kept for scrolling back; lines shown while idle; seconds a new line stays fully visible */
const KEEP = 80;
const SHOW = 7;
const LINGER = 14;
const FADE = 2.5;

export class ChatBox {
  readonly root = h('div', { class: 'chatbox hidden' });
  private log = h('div', { class: 'chat-log' });
  private field = h('input', { class: 'chat-field', type: 'text', maxlength: '140', spellcheck: 'false', autocomplete: 'off', placeholder: 'Say something…   Enter: send · Esc: close' });
  private hint = h('div', { class: 'chat-hint' }, h('span', { class: 'key' }, 'T'), ' chat');
  private born: number[] = [];
  private clock = 0;
  private lastSent = -9;
  isOpen = false;
  /** a co-op session is up: the line can be opened and sent */
  canSend = false;
  onSend: (text: string) => void = () => {};
  /** called when the line opens or closes (the app drops held keys on open) */
  onOpenChange: (open: boolean) => void = () => {};

  constructor() {
    this.root.append(this.log, this.field, this.hint);
    this.field.addEventListener('keydown', (e) => {
      // typing never reaches the game's own key handlers
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = this.field.value.trim();
        if (text && this.clock - this.lastSent > 0.4) {
          this.lastSent = this.clock;
          this.onSend(text);
        }
        this.close();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
    this.field.addEventListener('keyup', (e) => e.stopPropagation());
    this.field.addEventListener('blur', () => this.close());
  }

  get lineCount(): number {
    return this.born.length;
  }

  add(line: ChatLine): void {
    // the same line twice in a row within a few seconds (a cue that fired twice) is written once
    const key = `${line.kind}|${line.who ?? ''}|${line.text}|${line.sub ?? ''}`;
    const last = this.log.lastElementChild as HTMLElement | null;
    if (last && last.dataset.key === key && this.clock - this.born[this.born.length - 1] < 5) return;
    const body: (Node | string)[] = [];
    if (line.kind === 'player') {
      body.push(h('b', { class: 'who', style: { color: line.color ?? 'var(--cream)' } }, line.who ?? 'Player'), h('span', { class: 'say' }, line.text));
    } else if (line.kind === 'fortune') {
      body.push(h('b', { class: 'who' }, line.who ?? 'Zoltana'), h('span', { class: 'say' }, `“${line.text}”`));
    } else if (line.kind === 'quest') {
      body.push(h('span', { class: 'say' }, line.text));
      if (line.sub) body.push(h('span', { class: 'sub' }, line.sub));
    } else body.push(h('span', { class: 'say' }, line.text));
    const el = h('div', { class: `chat-line chat-${line.kind}`, 'data-key': key }, ...body);
    this.log.append(el);
    this.born.push(this.clock);
    while (this.born.length > KEEP) {
      this.log.firstElementChild?.remove();
      this.born.shift();
    }
    if (this.isOpen) this.log.scrollTop = this.log.scrollHeight;
  }

  open(): void {
    if (!this.canSend || this.isOpen || this.root.classList.contains('hidden')) return;
    this.isOpen = true;
    this.root.classList.add('open');
    this.field.value = '';
    this.field.focus();
    this.log.scrollTop = this.log.scrollHeight;
    this.onOpenChange(true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove('open');
    this.field.blur();
    this.onOpenChange(false);
  }

  /** Show or hide the box (hiding closes the line); `bottom` places it above whatever the corner holds. */
  place(visible: boolean, bottom: number): void {
    if (!visible && this.isOpen) this.close();
    this.root.classList.toggle('hidden', !visible);
    this.root.classList.toggle('can-send', this.canSend);
    this.root.style.bottom = `${Math.round(bottom)}px`;
  }

  /** Age the lines: the newest few linger and fade while idle; all of them show while the line is open. */
  update(dt: number): void {
    this.clock += dt;
    if (this.root.classList.contains('hidden')) return;
    const kids = this.log.children;
    const n = kids.length;
    for (let i = 0; i < n; i++) {
      const el = kids[i] as HTMLElement;
      let a = 1;
      if (!this.isOpen) {
        const age = this.clock - this.born[i];
        a = n - i > SHOW ? 0 : age < LINGER ? 1 : Math.max(0, 1 - (age - LINGER) / FADE);
      }
      const s = a <= 0 ? 'none' : '';
      if (el.style.display !== s) el.style.display = s;
      const o = a.toFixed(2);
      if (el.style.opacity !== o) el.style.opacity = o;
    }
  }
}
