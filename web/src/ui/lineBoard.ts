// The Ghost Train's departures line on the HUD (D-80): under the clock, where the train is and when it goes,
// by the night's clock. At a station with the train in: "ST. VESPER'S → CINDER WORKS · departs in 0:23";
// with it away: "next train · 1:42 · to CINDER WORKS"; aboard: "next stop CINDER WORKS · 0:12". Plus the
// moments that matter as words on the line: DOORS CLOSING, ALL ABOARD, the last train. It is the station
// clocks' and boards' information, readable at a glance, so the timetable never has to be guessed.

import { E, J, REGIONS, TRANSIT, nextArrival, regionAt, trainAt, type TrainState } from '../data/ghosttrain';
import { h } from './dom';

const mmss = (s: number) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

/** The line's state in words for a player standing at (x, y) at sim time t. */
export function lineText(t: number, eFrom: number, x: number, y: number): { text: string; urgent: boolean } | null {
  const st: TrainState = trainAt(t, eFrom);
  const here = regionAt(x, y);
  if (here < 0) return null;
  const name = (r: number) => REGIONS[r].short;
  if (here === TRANSIT) {
    if (st.phase !== 'travel') return null;
    const via = st.passing ? ` (through ${name(E)})` : '';
    return { text: `next stop ${name(st.to)}${via} · ${mmss(st.arriveIn)}`, urgent: st.arriveIn < 6 };
  }
  if (st.phase === 'dwell' && st.at === here) {
    if (!Number.isFinite(st.departIn)) return { text: `${name(here)} · this train terminates here`, urgent: false };
    const urgent = st.departIn < 10;
    const tail = !st.doors ? (st.t < 3 ? 'doors opening' : 'DOORS CLOSED') : st.departIn < 10 ? 'ALL ABOARD' : `departs in ${mmss(st.departIn)}`;
    return { text: `${name(here)} → ${name(st.to)} · ${tail}${st.doors && st.departIn < 10 ? ` · ${mmss(st.departIn)}` : ''}`, urgent };
  }
  // the train is elsewhere: when does it next come here?
  const at = nextArrival(here, t, eFrom, 1200);
  if (!Number.isFinite(at)) return { text: here === E ? `${name(E)} · no train calls here tonight… yet` : `${name(here)} · the last train has gone`, urgent: false };
  const coming = trainAt(at + 0.5, eFrom);
  const to = coming.phase === 'dwell' ? coming.to : J;
  const toText = !Number.isFinite(coming.departIn) ? 'terminates here' : `to ${name(to)}`;
  return { text: `next train ${mmss(at - t)} · ${toText}`, urgent: false };
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
