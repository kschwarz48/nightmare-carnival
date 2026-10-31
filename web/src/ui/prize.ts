// DOM layer for the Prize Wheel (titles, the prize caption, the closing summary) and for Zoltana's
// fortune cards — the Last Song's only "text", delivered diegetically by the automaton.

import type { ChestEntry } from '../sim/draft';
import type { PrizeUi } from '../render3d/prizeWheel';
import { h } from './dom';

const KIND_LABEL: Record<ChestEntry['type'], string> = {
  evolution: '✦ EVOLUTION ✦', level: 'LEVEL UP', passive: 'CHARM', new: 'NEW!', voucher: 'LOST & FOUND', heal: 'A SMALL MERCY',
};

export class PrizeOverlay implements PrizeUi {
  root = h('div', { class: 'prize-ui hidden' });
  /** Co-op: player names by slot, so every prize shows whose it is (null in solo). */
  owners: string[] | null = null;
  private titleEl = h('div', { class: 'prize-title' });
  private capEl = h('div', { class: 'prize-cap' });
  private sumEl = h('div', { class: 'prize-sum' });
  private hint = h('div', { class: 'prize-hint' }, 'Confirm / Click: hurry it along  ·  Back: skip to the prizes');

  constructor(onClick: () => void) {
    this.root.append(this.titleEl, this.capEl, this.sumEl, this.hint);
    this.root.onclick = onClick;
  }

  title(text: string, style: 'normal' | 'bonus' | 'evolution' | 'voucher'): void {
    this.root.classList.remove('hidden');
    this.sumEl.replaceChildren();
    this.sumEl.classList.remove('on');
    this.hint.classList.remove('hidden');
    // the booth's own sign already reads PRIZE WHEEL: a plain spin gets no second title on top of it,
    // only the special ones (bonus spin, voucher) announce themselves
    this.titleEl.className = `prize-title ${style}${style === 'normal' ? ' hidden' : ''}`;
    this.titleEl.textContent = style === 'normal' ? '' : text;
    this.titleEl.style.animation = 'none';
    void this.titleEl.offsetWidth;
    this.titleEl.style.animation = '';
  }

  caption(e: ChestEntry | null, icon: string): void {
    if (!e) {
      this.capEl.classList.remove('on');
      return;
    }
    this.capEl.className = `prize-cap on ${e.type}`;
    this.capEl.replaceChildren(h('img', { src: icon, alt: '' }), h('div', {}, h('small', {}, this.who(e), KIND_LABEL[e.type]), h('b', {}, e.label)));
  }

  summary(entries: ChestEntry[], icons: string[]): void {
    this.root.classList.remove('hidden');
    this.capEl.classList.remove('on');
    this.titleEl.className = `prize-title ${entries.some((e) => e.type === 'evolution') ? 'evolution' : 'normal'}`;
    this.titleEl.textContent = this.owners ? 'THE WINNINGS' : entries.length > 1 ? 'YOUR WINNINGS' : 'YOUR PRIZE';
    this.sumEl.replaceChildren(...entries.map((e, i) => h('div', { class: `item ${e.type}`, style: { animationDelay: `${0.08 + i * 0.12}s` } }, h('img', { src: icons[i], alt: '' }), h('span', {}, this.who(e), e.label))), h('div', { class: 'muted cont' }, 'Press any button to continue'));
    this.sumEl.classList.add('on');
    this.hint.classList.add('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.capEl.classList.remove('on');
    this.sumEl.classList.remove('on');
  }

  private who(e: ChestEntry): HTMLElement | null {
    if (!this.owners || e.player === undefined) return null;
    return h('span', { class: `who p${e.player + 1}` }, this.owners[e.player] ?? `P${e.player + 1}`);
  }
}

/** A fortune card slid out of a fortune machine (Zoltana's, or Madame Marina's). Fades on its own; never blocks play. */
export class FortuneCard {
  root = h('div', { class: 'fortune hidden' });
  private timer = 0;

  show(text: string, seconds = 9, who = 'ZOLTANA'): void {
    this.root.replaceChildren(h('div', { class: 'fortune-head' }, `❖ ${who} SPEAKS ❖`), h('div', { class: 'fortune-text' }, text), h('div', { class: 'fortune-foot' }, '— your fortune —'));
    this.root.classList.remove('hidden');
    this.root.style.animation = 'none';
    void this.root.offsetWidth;
    this.root.style.animation = '';
    this.timer = seconds;
  }

  update(dt: number): void {
    if (this.timer <= 0) return;
    this.timer -= dt;
    if (this.timer <= 0) this.root.classList.add('hidden');
  }

  hide(): void {
    this.timer = 0;
    this.root.classList.add('hidden');
  }
}
