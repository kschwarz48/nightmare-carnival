// The Ghost Train's line on the HUD (D-80): under the clock, where the train is and what it is doing. Since D-90
// the train goes at the whistle and keeps no timetable, so the line says where it is and how to make it go, never
// when. At a station with the train in: "ST. VESPER'S → CINDER WORKS · pull the whistle cord to depart"; once
// it is pulled: ALL ABOARD; with the train away: "the train is at STILLWATER"; aboard: "next stop CINDER WORKS".

import { E, REGIONS, TRANSIT, regionAt, type TrainState } from '../data/ghosttrain';
import { h } from './dom';

/** The line's state in words for a player standing at (x, y). */
export function lineText(st: TrainState, x: number, y: number): { text: string; urgent: boolean } | null {
  const here = regionAt(x, y);
  if (here < 0) return null;
  const name = (r: number) => REGIONS[r].short;
  if (here === TRANSIT) {
    if (st.phase !== 'travel') return null;
    const via = st.passing ? ` (through ${name(E)})` : '';
    return { text: st.arriveIn < 8 ? `arriving · ${name(st.to)}${via}` : `next stop ${name(st.to)}${via}`, urgent: st.arriveIn < 8 };
  }
  if (st.phase === 'dwell' && st.at === here) {
    if (st.terminated) return { text: `${name(here)} · this train terminates here`, urgent: false };
    if (Number.isFinite(st.departIn)) return { text: `${name(here)} → ${name(st.to)} · ALL ABOARD`, urgent: true };
    if (!st.doors) return { text: `${name(here)} → ${name(st.to)} · doors opening`, urgent: false };
    return { text: `${name(here)} → ${name(st.to)} · pull the whistle cord in the tender to depart`, urgent: false };
  }
  if (st.phase === 'approach') return { text: 'the train is coming in', urgent: false };
  if (st.phase === 'dwell') return { text: `the train is at ${name(st.at)}`, urgent: false };
  return { text: st.to === here ? 'the train is on its way here' : `the train is on its way to ${name(st.to)}`, urgent: false };
}

export class LineBoard {
  readonly el = h('div', { class: 'line-board hidden' });
  private key = '';

  update(text: { text: string; urgent: boolean } | null): void {
    const k = text ? `${text.urgent ? '!' : ''}${text.text}` : '';
    if (k === this.key) return;
    this.key = k;
    this.el.classList.toggle('hidden', !text);
    this.el.classList.toggle('urgent', !!text?.urgent);
    this.el.textContent = text?.text ?? '';
  }
}
