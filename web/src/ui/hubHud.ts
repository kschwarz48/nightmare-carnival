// The Midway hub's screen layer (D-60): labels over the cast and the landmarks, the interact prompt,
// the dialogue box, and the co-op lobby code. Pure view: the app decides what to show every frame.

import { h } from './dom';

export interface HubLabel {
  x: number;
  y: number;
  text: string;
  sub?: string;
  kind: 'npc' | 'spot' | 'exit' | 'player';
  /** player colour class (p1…p6) for party name tags */
  cls?: string;
}

export interface HubView {
  labels: HubLabel[];
  prompt: { text: string; sub?: string; key: string } | null;
  dialogue: { name: string; at: string; portrait: string; text: string; page: string } | null;
  /** co-op: the lobby code friends join with, and who is here */
  code: string | null;
  party: string[];
}

export class HubHud {
  root = h('div', { class: 'hubhud' });
  private labels = h('div', { class: 'hub-labels' });
  private prompt = h('div', { class: 'hub-prompt hidden' });
  private dialogue = h('div', { class: 'hub-dialogue hidden' });
  private code = h('div', { class: 'hub-code hidden' });
  private keys = { prompt: '', dialogue: '', code: '' };

  constructor(onCopy: (code: string) => void) {
    const title = h('div', { class: 'hub-title' }, h('div', { class: 't' }, 'THE MIDWAY'), h('div', { class: 's' }, 'the carnival is yours'));
    const hint = h('div', { class: 'hub-hint' }, 'E / A: talk & use  ·  Esc: menu');
    this.code.onclick = () => {
      const c = this.code.dataset.code;
      if (c) onCopy(c);
    };
    this.root.append(this.labels, title, hint, this.code, this.prompt, this.dialogue);
  }

  /** Replay the title card (each time the hub is entered). */
  welcome(): void {
    const t = this.root.querySelector('.hub-title') as HTMLElement | null;
    if (!t) return;
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
  }

  update(v: HubView): void {
    this.labels.replaceChildren(...v.labels.map((l) =>
      h('div', { class: `hub-label ${l.kind}${l.cls ? ' ' + l.cls : ''}`, style: { left: `${l.x}px`, top: `${l.y}px` } }, h('b', {}, l.text), l.sub ? h('small', {}, l.sub) : null)));
    const pk = v.prompt ? `${v.prompt.key}|${v.prompt.text}|${v.prompt.sub ?? ''}` : '';
    if (pk !== this.keys.prompt) {
      this.keys.prompt = pk;
      this.prompt.classList.toggle('hidden', !v.prompt);
      if (v.prompt) this.prompt.replaceChildren(h('span', { class: 'key' }, v.prompt.key), h('span', {}, v.prompt.text), ...(v.prompt.sub ? [h('small', {}, v.prompt.sub)] : []));
    }
    const d = v.dialogue;
    const dk = d ? `${d.name}|${d.text}|${d.page}` : '';
    if (dk !== this.keys.dialogue) {
      this.keys.dialogue = dk;
      this.dialogue.classList.toggle('hidden', !d);
      if (d) {
        this.dialogue.replaceChildren(
          h('img', { src: d.portrait, alt: '' }),
          h('div', { class: 'body' }, h('div', { class: 'who' }, d.name, h('small', {}, ` · at ${d.at}`)), h('div', { class: 'line' }, d.text), h('div', { class: 'more' }, d.page)),
        );
      }
    }
    const ck = v.code ? `${v.code}|${v.party.join(',')}` : '';
    if (ck !== this.keys.code) {
      this.keys.code = ck;
      this.code.classList.toggle('hidden', !v.code);
      this.code.dataset.code = v.code ?? '';
      if (v.code) this.code.replaceChildren(h('small', {}, 'LOBBY CODE · click to copy'), h('b', {}, v.code), h('div', { class: 'party' }, `${v.party.length} on the Midway: ${v.party.join(', ')}`));
    }
  }
}
