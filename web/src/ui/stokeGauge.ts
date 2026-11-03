// The Last Train Home's boiler gauge on the HUD (D-98: it was painted on the tender floor, too small to read). Theo's
// stokes: while the train runs with the tender full, whoever stands at the firebox sees the engine's pressure dial —
// a steam-age gauge, not the carnival's: a bolted brass bezel, an aged cream face sooted at the rim, hand-lettered
// pounds, the red sector where a stoke takes, a black spade needle — and three firebox pips for the stokes landed.

import { h } from './dom';

/** the dial's sweep (degrees either side of straight up) */
const SWEEP = 120;
const ang = (f: number) => -SWEEP + 2 * SWEEP * f;

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${(cx + Math.cos(t) * r).toFixed(2)} ${(cy + Math.sin(t) * r).toFixed(2)}`;
  };
  return `M ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
}

function face(window: number): string {
  const ticks: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const f = i / 40, a = ((ang(f) - 90) * Math.PI) / 180;
    const major = i % 5 === 0, r0 = major ? 56 : 61, r1 = 67;
    ticks.push(`<line x1="${(100 + Math.cos(a) * r0).toFixed(2)}" y1="${(100 + Math.sin(a) * r0).toFixed(2)}" x2="${(100 + Math.cos(a) * r1).toFixed(2)}" y2="${(100 + Math.sin(a) * r1).toFixed(2)}" stroke="#241608" stroke-width="${major ? 2.4 : 1.1}" stroke-linecap="round"/>`);
    if (major) {
      const rn = 45;
      ticks.push(`<text x="${(100 + Math.cos(a) * rn).toFixed(2)}" y="${(100 + Math.sin(a) * rn + 4).toFixed(2)}" text-anchor="middle" class="sg-num">${i * 5}</text>`);
    }
  }
  const bolts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = 100 + Math.cos(a) * 89, y = 100 + Math.sin(a) * 89;
    bolts.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4.2" fill="url(#sgBolt)" stroke="#1c1006" stroke-width="1"/><line x1="${(x - 2.4).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + 2.4).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#3a2610" stroke-width="1"/>`);
  }
  return `<svg viewBox="0 0 200 200" class="sg-svg" aria-hidden="true">
  <defs>
    <radialGradient id="sgBrass" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#f4d58a"/><stop offset="0.45" stop-color="#b08436"/><stop offset="0.8" stop-color="#6a4818"/><stop offset="1" stop-color="#3a260c"/></radialGradient>
    <radialGradient id="sgBolt" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#e8c878"/><stop offset="1" stop-color="#5a3c14"/></radialGradient>
    <radialGradient id="sgFace" cx="50%" cy="44%" r="62%"><stop offset="0" stop-color="#f6ecd2"/><stop offset="0.7" stop-color="#e2d0a4"/><stop offset="1" stop-color="#b89a62"/></radialGradient>
    <radialGradient id="sgSoot" cx="50%" cy="50%" r="50%"><stop offset="0.62" stop-color="#1a0e04" stop-opacity="0"/><stop offset="1" stop-color="#1a0e04" stop-opacity="0.55"/></radialGradient>
    <linearGradient id="sgGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.38"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
  </defs>
  <circle cx="100" cy="100" r="97" fill="#20140a"/>
  <circle cx="100" cy="100" r="94" fill="url(#sgBrass)" stroke="#2a1a08" stroke-width="2"/>
  ${bolts.join('')}
  <circle cx="100" cy="100" r="79" fill="#2a1c0e" stroke="#120a04" stroke-width="2"/>
  <circle cx="100" cy="100" r="74" fill="url(#sgFace)"/>
  <path d="${arc(100, 100, 64, ang(1 - window), SWEEP)}" class="sg-red" stroke-width="10" fill="none"/>
  <path d="${arc(100, 100, 64, ang(0), ang(1 - window))}" stroke="#3a2a14" stroke-opacity="0.35" stroke-width="3" fill="none"/>
  ${ticks.join('')}
  <text x="100" y="74" text-anchor="middle" class="sg-label">BOILER</text>
  <text x="100" y="126" text-anchor="middle" class="sg-unit">LBS</text>
  <text x="100" y="146" text-anchor="middle" class="sg-maker">MIDNIGHT LINE · No 13</text>
  <circle cx="100" cy="100" r="74" fill="url(#sgSoot)"/>
  <g class="sg-needle">
    <path d="M 100 33 L 104.5 96 L 100 112 L 95.5 96 Z" fill="#141008" stroke="#000" stroke-width="0.8"/>
    <circle cx="100" cy="118" r="6.5" fill="#141008"/>
  </g>
  <circle cx="100" cy="100" r="9" fill="url(#sgBolt)" stroke="#2a1a08" stroke-width="1.4"/>
  <circle cx="100" cy="100" r="3" fill="#2a1a08"/>
  <path d="M 44 70 A 62 62 0 0 1 120 38 A 70 70 0 0 0 52 92 Z" fill="url(#sgGlass)"/>
</svg>`;
}

export class StokeGauge {
  readonly el: HTMLElement;
  private needle: SVGGElement;
  private pips: HTMLElement[];
  private shown = false;
  private hot = false;
  private lastStokes = -1;

  constructor(window: number) {
    this.pips = [0, 1, 2].map(() => h('i', { class: 'sg-pip' }));
    this.el = h('div', { class: 'stoke-gauge hidden' },
      h('div', { class: 'sg-title' }, 'STOKE THE FIREBOX'),
      h('div', { class: 'sg-dial', html: face(window) }),
      h('div', { class: 'sg-door' }, ...this.pips),
      h('div', { class: 'sg-hint' }, 'Stoke when the needle swings into the red'),
    );
    this.needle = this.el.querySelector('.sg-needle') as SVGGElement;
  }

  /** Each frame: the gauge's state for the local player, or null to put it away. */
  update(st: { needle: number; stokes: number; window: number } | null): void {
    if (!st) {
      if (this.shown) {
        this.shown = false;
        this.el.classList.add('hidden');
      }
      return;
    }
    if (!this.shown) {
      this.shown = true;
      this.el.classList.remove('hidden');
    }
    this.needle.setAttribute('transform', `rotate(${ang(st.needle).toFixed(2)} 100 100)`);
    const hot = st.needle >= 1 - st.window;
    if (hot !== this.hot) {
      this.hot = hot;
      this.el.classList.toggle('hot', hot);
    }
    if (st.stokes !== this.lastStokes) {
      this.lastStokes = st.stokes;
      this.pips.forEach((p, i) => p.classList.toggle('lit', i < st.stokes));
    }
  }

  /** A stoke landed (the fire roars) or was mistimed (it chokes): the dial answers. */
  pulse(good: boolean): void {
    const cls = good ? 'roar' : 'choke';
    this.el.classList.remove('roar', 'choke');
    void this.el.offsetWidth;
    this.el.classList.add(cls);
  }
}
