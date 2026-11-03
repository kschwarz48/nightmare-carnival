// The on-screen keyboard (D-104): a pad has no keys, so a text field it opens (your name, a lobby code, a chat line)
// brings up a board of keys to pick with the D-pad or the stick and A. X deletes, Y types a space, LB is Shift, Menu
// is done, B closes it keeping what was typed. A lobby code's board has only the code's own characters. A real
// keyboard types into it too, while it's up.

import { CODE_ALPHABET } from '../net/codes';
import type { NavEvent } from '../input/input';
import { FocusNav, h } from './dom';
import { padHtml } from './glyphs';

export interface OskOptions {
  title: string;
  value: string;
  max: number;
  /** 'code': the lobby code's characters, in capitals; 'text': letters, digits and a little punctuation */
  kind: 'code' | 'text';
  /** what Done does, for its key ("Join", "Send") */
  doneLabel?: string;
  /** each change, as it's typed (the field behind follows) */
  change?: (v: string) => void;
  /** Done: the board closes and the field's action follows (join, send) */
  done: (v: string) => void;
  /** closed without Done (B, Esc): what was typed stays */
  close?: (v: string) => void;
}

const TEXT_ROWS = ['1234567890', 'QWERTYUIOP', "ASDFGHJKL'", '⇧ZXCVBNM-.'];
const CODE_COLS = 8;

export class Osk {
  readonly el: HTMLElement;
  readonly nav: FocusNav;
  value: string;
  private shift: boolean;
  private shown = h('div', { class: 'osk-text' });
  private letters: HTMLButtonElement[] = [];
  private shiftKey: HTMLButtonElement | null = null;
  private doneKey: HTMLButtonElement;
  private onKey = (e: KeyboardEvent) => this.typed(e);

  constructor(private o: OskOptions) {
    this.value = o.value.slice(0, o.max);
    this.shift = o.kind === 'text' && !this.value;
    const key = (label: string, fn: () => void, cls = '', span = 1) =>
      h('button', { class: `osk-key ${cls}`, 'data-nav': '', style: span > 1 ? { gridColumn: `span ${span}` } : undefined, onclick: fn }, label) as HTMLButtonElement;
    const letter = (ch: string) => {
      const b = key(ch, () => this.type(this.cased(ch)));
      if (/[A-Z]/.test(ch)) this.letters.push(b);
      return b;
    };
    this.doneKey = key(o.doneLabel ?? 'Done', () => this.done(), 'wide done', o.kind === 'code' ? CODE_COLS : 2);
    let grid: HTMLElement;
    if (o.kind === 'code') {
      const keys = [...CODE_ALPHABET].map(letter);
      keys.push(key('⌫', () => this.erase(), 'erase'));
      grid = h('div', { class: 'osk-grid code', style: { gridTemplateColumns: `repeat(${CODE_COLS}, 1fr)` } }, ...keys, this.doneKey);
    } else {
      const rows = TEXT_ROWS.flatMap((row) => [...row].map((ch) => {
        if (ch !== '⇧') return letter(ch);
        this.shiftKey = key('⇧', () => this.setShift(!this.shift), 'shift');
        return this.shiftKey;
      }));
      grid = h('div', { class: 'osk-grid text' }, ...rows,
        letter('!'), letter('?'), letter(','),
        key('Space', () => this.type(' '), 'wide', 3), key('⌫', () => this.erase(), 'wide erase', 2), this.doneKey);
    }
    const hint = h('div', { class: 'osk-hint', html: padHtml(o.kind === 'code' ? '{A} type · {X} delete · {MENU} done · {B} close' : '{A} type · {X} delete · {Y} space · {LB} shift · {MENU} done · {B} close') });
    this.el = h('div', { class: 'osk-back' }, h('div', { class: 'osk panel bulbs', role: 'dialog', 'aria-label': o.title },
      h('div', { class: 'osk-title' }, o.title),
      h('div', { class: `osk-field${o.kind === 'code' ? ' code' : ''}` }, this.shown, h('span', { class: 'osk-caret' })),
      grid, hint));
    this.nav = new FocusNav(this.el);
    this.draw();
    window.addEventListener('keydown', this.onKey, true);
  }

  /** Put the board's focus on its first key (or Done, for a code already whole). */
  start(): void {
    const full = this.o.kind === 'code' && this.value.length >= this.o.max;
    this.nav.focus(full ? this.doneKey : this.nav.items()[0] ?? null);
  }

  private cased(ch: string): string {
    return this.o.kind === 'text' && !this.shift ? ch.toLowerCase() : ch;
  }

  private setShift(on: boolean): void {
    this.shift = on;
    this.draw();
  }

  private type(ch: string): void {
    if (this.value.length >= this.o.max) return;
    this.value += ch;
    // Shift is for one letter (it's on for the first)
    if (this.o.kind === 'text' && ch !== ' ') this.shift = false;
    this.changed();
    // a whole code: straight to Join
    if (this.o.kind === 'code' && this.value.length >= this.o.max) this.nav.focus(this.doneKey);
  }

  private erase(): void {
    if (!this.value) return;
    this.value = this.value.slice(0, -1);
    if (this.o.kind === 'text' && !this.value) this.shift = true;
    this.changed();
  }

  private changed(): void {
    this.draw();
    this.o.change?.(this.value);
  }

  private draw(): void {
    this.shown.textContent = this.value;
    this.el.classList.toggle('empty', !this.value);
    for (const b of this.letters) b.textContent = this.cased((b.textContent ?? '').toUpperCase());
    this.shiftKey?.classList.toggle('on', this.shift);
  }

  private done(): void {
    this.dispose();
    this.o.done(this.value);
  }

  close(): void {
    this.dispose();
    this.o.close?.(this.value);
  }

  private dispose(): void {
    window.removeEventListener('keydown', this.onKey, true);
    this.el.remove();
  }

  /**
   * A real keyboard while the board is up: it types, Backspace deletes, Enter is Done and Esc closes (the arrows go on
   * to move the board's focus).
   */
  private typed(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.done();
    else if (e.key === 'Escape') this.close();
    else if (e.key === 'Backspace') this.erase();
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ch = this.o.kind === 'code' ? e.key.toUpperCase() : e.key;
      if (this.o.kind !== 'code' || CODE_ALPHABET.includes(ch)) this.type(ch);
    } else return;
    e.stopPropagation();
    e.preventDefault();
  }

  /** A pad's or the keyboard's navigation while the board is up; everything stops here. */
  handle(e: NavEvent): void {
    if (e === 'up' || e === 'down' || e === 'left' || e === 'right') this.nav.move(e);
    else if (e === 'confirm') this.nav.activate();
    else if (e === 'back') this.close();
    else if (e === 'reroll') this.erase();
    else if (e === 'banish' && this.o.kind === 'text') this.type(' ');
    else if (e === 'prev' && this.o.kind === 'text') this.setShift(!this.shift);
    else if (e === 'pause') this.done();
  }
}
