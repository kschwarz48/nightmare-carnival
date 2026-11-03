// Offline sample synthesizer: renders original cartoon-foley SFX (doc 02 §9 "boings, honks,
// slide-whistles, kazoo, balloon squeaks, wind-up clockwork, pop/deflate, springs…") into
// Float32Arrays at boot. No third-party audio is used.

export const SR = 32000;

type Wave = 'sine' | 'square' | 'saw' | 'tri' | 'noise';

interface Voice {
  wave: Wave;
  f0: number; // start freq
  f1?: number; // end freq (exponential sweep)
  dur: number;
  vol?: number;
  attack?: number;
  decay?: number; // exponential decay rate (1/s); 0 = linear release
  delay?: number;
  vib?: number; // vibrato depth (fraction)
  vibRate?: number;
  lp?: number; // one-pole low-pass cutoff (Hz)
  hp?: number; // high-pass cutoff
  curve?: number; // sweep curve exponent
  duty?: number;
}

let noiseSeed = 1234567;
function rnd(): number {
  noiseSeed = (noiseSeed * 1103515245 + 12345) & 0x7fffffff;
  return noiseSeed / 0x7fffffff;
}

function render(voices: Voice[], extra = 0.05): Float32Array {
  let len = 0;
  for (const v of voices) len = Math.max(len, (v.delay ?? 0) + v.dur);
  const n = Math.ceil((len + extra) * SR);
  const out = new Float32Array(n);
  for (const v of voices) {
    const start = Math.floor((v.delay ?? 0) * SR);
    const vn = Math.floor(v.dur * SR);
    let phase = 0;
    let lpY = 0, hpY = 0, hpX = 0;
    const lpA = v.lp ? 1 - Math.exp((-2 * Math.PI * v.lp) / SR) : 1;
    const hpA = v.hp ? Math.exp((-2 * Math.PI * v.hp) / SR) : 0;
    const att = Math.max(1, Math.floor((v.attack ?? 0.005) * SR));
    const vol = v.vol ?? 0.5;
    for (let i = 0; i < vn && start + i < n; i++) {
      const t = i / vn;
      const tt = i / SR;
      const f1 = v.f1 ?? v.f0;
      let f = v.f0 * Math.pow(f1 / v.f0, Math.pow(t, v.curve ?? 1));
      if (v.vib) f *= 1 + Math.sin(tt * Math.PI * 2 * (v.vibRate ?? 6)) * v.vib;
      phase += f / SR;
      phase -= Math.floor(phase);
      let s: number;
      switch (v.wave) {
        case 'sine': s = Math.sin(phase * Math.PI * 2); break;
        case 'square': s = phase < (v.duty ?? 0.5) ? 1 : -1; break;
        case 'saw': s = phase * 2 - 1; break;
        case 'tri': s = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4; break;
        default: s = rnd() * 2 - 1;
      }
      if (v.lp) {
        lpY += lpA * (s - lpY);
        s = lpY;
      }
      if (v.hp) {
        const y = hpA * (hpY + s - hpX);
        hpX = s;
        hpY = y;
        s = y;
      }
      let env = i < att ? i / att : 1;
      if (v.decay) env *= Math.exp(-v.decay * tt);
      else env *= 1 - t;
      out[start + i] += s * env * vol;
    }
  }
  // soft clip + gentle fade-out tail
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * 1.3) * 0.85;
  const fade = Math.min(n, Math.floor(0.01 * SR));
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

const V = (wave: Wave, f0: number, f1: number | undefined, dur: number, o: Partial<Voice> = {}): Voice => ({ wave, f0, f1, dur, ...o });

/**
 * A steamship's horn (D-79, the Gala Queen's call sign; the old one borrowed the barker's car horn): two low
 * brassy tones a minor third apart and a sub an octave down, beating a little against each other, swelling
 * in as the steam comes up to pressure (the pitch rising into tune with it), held, then sagging off; a breath
 * of steam as it opens, a resonant bell, and a soft reflection off the water. `dur` includes the release.
 */
function shipHorn(dur: number, f0 = 92.5): Float32Array {
  const n = Math.ceil((dur + 0.8) * SR);
  const dry = new Float32Array(n);
  const att = Math.min(0.16, dur * 0.3), rel = Math.min(0.24, dur * 0.35);
  const fq = [f0, f0 * 1.1892, f0 * 0.5], amp = [1, 0.72, 0.35], ph = [0, 0, 0];
  // state-variable filters: the bell's formant (a resonant band over a low-pass body) and the steam's hiss;
  // a one-pole low-pass keeps some of the raw reed's buzz (it carries on small speakers, which lose the lows)
  const fF = 2 * Math.sin((Math.PI * 520) / SR), qF = 1 / 1.1;
  const fN = 2 * Math.sin((Math.PI * 1400) / SR), qN = 0.5;
  const aB = 1 - Math.exp((-2 * Math.PI * 2200) / SR);
  let low = 0, band = 0, nLow = 0, nBand = 0, buzz = 0;
  const end = Math.floor(dur * SR);
  for (let i = 0; i < end; i++) {
    const t = i / SR;
    const env = t < att ? 1 - (1 - t / att) ** 2 : t > dur - rel ? Math.max(0, (dur - t) / rel) ** 1.5 : 1;
    const bend = (t < att ? 0.93 + 0.07 * (t / att) : t > dur - rel ? 1 - 0.03 * ((t - (dur - rel)) / rel) : 1) * (1 + 0.003 * Math.sin(t * Math.PI * 2 * 5.2));
    let s = 0;
    for (let k = 0; k < 3; k++) {
      ph[k] += (fq[k] * bend * (1 + k * 0.0016)) / SR;
      ph[k] -= Math.floor(ph[k]);
      s += (ph[k] * 2 - 1) * amp[k];
    }
    const hi = s - low - qF * band;
    band += fF * hi;
    low += fF * band;
    buzz += aB * (s - buzz);
    let v = low * 0.5 + band * 1.1 + buzz * 0.22;
    const nz = rnd() * 2 - 1, nHi = nz - nLow - qN * nBand;
    nBand += fN * nHi;
    nLow += fN * nBand;
    v += nBand * (0.05 + 0.25 * Math.max(0, 1 - t / 0.12));
    dry[i] = v * env;
  }
  // two quiet, darker repeats off the water
  const out = new Float32Array(n);
  const d1 = Math.floor(0.21 * SR), d2 = Math.floor(0.47 * SR);
  let lp = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const e = (i >= d1 ? dry[i - d1] * 0.22 : 0) + (i >= d2 ? dry[i - d2] * 0.09 : 0);
    lp += 0.2 * (e - lp);
    out[i] = dry[i] + lp;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  const k = 0.9 / (peak || 1);
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * k * 1.2) * 0.85;
  const fade = Math.floor(0.02 * SR);
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

/** Every SFX id used by the game → its recipe. */
export const RECIPES: Record<string, () => Float32Array> = {
  // ---- enemy deaths & hits
  pop: () => render([V('noise', 1, 1, 0.08, { vol: 0.7, decay: 40, hp: 900 }), V('sine', 900, 160, 0.09, { vol: 0.5, decay: 25 })]),
  squeak: () => render([V('square', 1400, 2200, 0.07, { vol: 0.18, decay: 20, lp: 4000, vib: 0.04, vibRate: 40 })]),
  clank: () => render([V('square', 620, 600, 0.12, { vol: 0.25, decay: 25, lp: 3500 }), V('square', 931, 900, 0.1, { vol: 0.18, decay: 30, lp: 4000 }), V('noise', 1, 1, 0.04, { vol: 0.3, decay: 60, hp: 2000 })]),
  springs: () => render([V('tri', 300, 900, 0.25, { vol: 0.35, vib: 0.2, vibRate: 28, decay: 8 }), V('square', 1200, 1100, 0.1, { vol: 0.12, decay: 30, lp: 3000, delay: 0.02 })]),
  thump: () => render([V('sine', 160, 60, 0.15, { vol: 0.7, decay: 18 }), V('noise', 1, 1, 0.05, { vol: 0.25, decay: 50, lp: 1200 })]),
  stuffing: () => render([V('noise', 1, 1, 0.18, { vol: 0.45, decay: 18, lp: 1800 }), V('sine', 220, 90, 0.12, { vol: 0.35, decay: 20 })]),
  squish: () => render([V('sine', 300, 120, 0.16, { vol: 0.45, vib: 0.15, vibRate: 30, decay: 12 }), V('noise', 1, 1, 0.1, { vol: 0.2, decay: 25, lp: 900 })]),
  sugar: () => render([V('noise', 1, 1, 0.22, { vol: 0.3, decay: 15, hp: 3000 }), V('sine', 2200, 3200, 0.12, { vol: 0.12, decay: 25 })]),
  bonk: () => render([V('sine', 520, 300, 0.12, { vol: 0.5, decay: 20 }), V('tri', 1040, 600, 0.08, { vol: 0.2, decay: 30 })]),
  honk: () => render([V('saw', 300, 280, 0.22, { vol: 0.3, lp: 1400, vib: 0.03, vibRate: 12, attack: 0.01, decay: 3 }), V('saw', 452, 430, 0.22, { vol: 0.2, lp: 1500, decay: 3 })]),
  slide: () => render([V('sine', 1300, 350, 0.5, { vol: 0.35, vib: 0.02, vibRate: 7, attack: 0.02, curve: 0.7, decay: 1.5 })]),
  splash: () => render([V('noise', 1, 1, 0.35, { vol: 0.5, decay: 9, lp: 2600, hp: 300 }), V('sine', 400, 120, 0.15, { vol: 0.3, decay: 15 })]),
  knock: () => render([V('sine', 380, 260, 0.08, { vol: 0.5, decay: 35 }), V('noise', 1, 1, 0.03, { vol: 0.3, decay: 80, lp: 2500 })]),
  wood: () => render([V('sine', 460, 300, 0.08, { vol: 0.45, decay: 35 }), V('sine', 640, 420, 0.07, { vol: 0.35, decay: 40, delay: 0.05 }), V('sine', 380, 260, 0.08, { vol: 0.3, decay: 40, delay: 0.11 })]),
  ceramic: () => render([V('noise', 1, 1, 0.25, { vol: 0.4, decay: 14, hp: 2500 }), V('sine', 2600, 2500, 0.2, { vol: 0.15, decay: 18 }), V('sine', 3700, 3600, 0.15, { vol: 0.1, decay: 22 })]),
  crumple: () => render([V('noise', 1, 1, 0.3, { vol: 0.5, decay: 10, lp: 2200 }), V('square', 200, 80, 0.25, { vol: 0.15, decay: 8, lp: 600 })]),
  boards: () => render([V('noise', 1, 1, 0.5, { vol: 0.55, decay: 6, lp: 1600 }), V('sine', 120, 50, 0.4, { vol: 0.5, decay: 6 }), V('sine', 1800, 2400, 0.3, { vol: 0.12, decay: 6, delay: 0.1 })]),
  derail: () => render([V('saw', 1800, 600, 0.6, { vol: 0.25, lp: 3000, vib: 0.05, vibRate: 30, decay: 4 }), V('noise', 1, 1, 0.6, { vol: 0.4, decay: 5, lp: 2500 }), V('sine', 90, 40, 0.5, { vol: 0.5, decay: 5, delay: 0.1 })]),
  brute: () => render([V('saw', 140, 70, 0.5, { vol: 0.4, lp: 600, decay: 4 }), V('noise', 1, 1, 0.4, { vol: 0.4, decay: 7, lp: 1200 })]),
  // ---- enemy tells
  windup: () => render([V('square', 900, 900, 0.03, { vol: 0.12, lp: 3000 }), V('square', 900, 900, 0.03, { vol: 0.12, lp: 3000, delay: 0.08 }), V('square', 900, 900, 0.03, { vol: 0.12, lp: 3000, delay: 0.16 }), V('square', 1100, 1100, 0.03, { vol: 0.14, lp: 3000, delay: 0.24 })]),
  cymbal: () => render([V('noise', 1, 1, 0.45, { vol: 0.45, decay: 7, hp: 5000 }), V('square', 3100, 3000, 0.3, { vol: 0.06, decay: 9 })]),
  whinny: () => render([V('saw', 700, 1300, 0.35, { vol: 0.22, lp: 2500, vib: 0.08, vibRate: 22, decay: 2, curve: 0.5 }), V('saw', 1300, 600, 0.3, { vol: 0.2, lp: 2200, vib: 0.1, vibRate: 25, delay: 0.3, decay: 3 })]),
  zap: () => render([V('saw', 2400, 300, 0.18, { vol: 0.25, lp: 5000, decay: 10 }), V('noise', 1, 1, 0.12, { vol: 0.2, decay: 20, hp: 3000 })]),
  throw: () => render([V('noise', 1, 1, 0.16, { vol: 0.3, decay: 14, hp: 800, lp: 3000 })]),
  musket: () => render([V('noise', 1, 1, 0.22, { vol: 0.6, decay: 16, lp: 3500 }), V('sine', 200, 60, 0.12, { vol: 0.5, decay: 20 })]),
  chachunk: () => render([V('noise', 1, 1, 0.06, { vol: 0.5, decay: 40, lp: 2500 }), V('sine', 300, 150, 0.06, { vol: 0.4, decay: 30 }), V('noise', 1, 1, 0.08, { vol: 0.5, decay: 35, lp: 1500, delay: 0.13 }), V('sine', 180, 90, 0.08, { vol: 0.5, decay: 25, delay: 0.13 })]),
  ticketspray: () => render([V('noise', 1, 1, 0.3, { vol: 0.35, decay: 8, hp: 2500 }), V('square', 1600, 1800, 0.2, { vol: 0.06, decay: 10 })]),
  musicbox: () => render([523, 659, 784, 659, 523, 784].map((f, i) => V('sine', f * 2, f * 2, 0.35, { vol: 0.16, decay: 8, delay: i * 0.18 }))),
  boing: () => render([V('sine', 180, 600, 0.35, { vol: 0.5, vib: 0.18, vibRate: 18, decay: 5, curve: 0.4 })]),
  dig: () => render([V('noise', 1, 1, 0.2, { vol: 0.4, decay: 12, lp: 900 })]),
  railwarn: () => render([V('square', 880, 880, 0.12, { vol: 0.16, lp: 3000 }), V('square', 660, 660, 0.12, { vol: 0.16, lp: 3000, delay: 0.16 }), V('square', 880, 880, 0.12, { vol: 0.16, lp: 3000, delay: 0.32 }), V('square', 660, 660, 0.12, { vol: 0.16, lp: 3000, delay: 0.48 })]),
  train: () => render([V('saw', 330, 300, 0.6, { vol: 0.2, lp: 1800, decay: 2 }), V('saw', 415, 380, 0.6, { vol: 0.18, lp: 1800, decay: 2 }), V('noise', 1, 1, 0.6, { vol: 0.25, decay: 3, lp: 1400 })]),
  grunt: () => render([V('saw', 120, 90, 0.3, { vol: 0.35, lp: 700, vib: 0.06, vibRate: 15, decay: 5 })]),
  stomp: () => render([V('sine', 110, 35, 0.35, { vol: 0.9, decay: 9 }), V('noise', 1, 1, 0.2, { vol: 0.4, decay: 14, lp: 700 })]),
  // ---- player weapons
  card: () => render([V('noise', 1, 1, 0.07, { vol: 0.25, decay: 35, hp: 2500, lp: 7000 }), V('sine', 1800, 1200, 0.05, { vol: 0.08, decay: 40 })]),
  whack: () => render([V('noise', 1, 1, 0.1, { vol: 0.5, decay: 30, lp: 2200 }), V('sine', 240, 90, 0.12, { vol: 0.6, decay: 22 })]),
  tarot: () => render([V('sine', 880, 1320, 0.15, { vol: 0.12, decay: 12, vib: 0.02, vibRate: 10 }), V('noise', 1, 1, 0.08, { vol: 0.12, decay: 30, hp: 3000 })]),
  deathcard: () => render([V('saw', 220, 110, 0.4, { vol: 0.2, lp: 1200, vib: 0.05, vibRate: 6, decay: 4 }), V('sine', 1760, 880, 0.3, { vol: 0.1, decay: 6 })]),
  coaster: () => render([V('sine', 760, 520, 0.05, { vol: 0.28, decay: 40 }), V('sine', 760, 520, 0.05, { vol: 0.24, decay: 40, delay: 0.06 }), V('noise', 1, 1, 0.5, { vol: 0.34, attack: 0.05, decay: 4, lp: 1700, hp: 220, delay: 0.08 }), V('saw', 210, 110, 0.45, { vol: 0.1, lp: 1100, decay: 3, delay: 0.08 })]),
  horn: () => render([V('square', 420, 410, 0.18, { vol: 0.18, lp: 1800, duty: 0.3 }), V('square', 530, 520, 0.18, { vol: 0.14, lp: 1800, duty: 0.3 })]),
  engine: () => render([V('saw', 70, 110, 0.4, { vol: 0.22, lp: 500, vib: 0.2, vibRate: 25, decay: 3 })]),
  hatpop: () => render([V('sine', 300, 1100, 0.12, { vol: 0.4, decay: 15, curve: 0.5 }), V('noise', 1, 1, 0.15, { vol: 0.25, decay: 15, hp: 1500, delay: 0.05 })]),
  popcornlaunch: () => render([V('noise', 1, 1, 0.06, { vol: 0.25, decay: 40, lp: 3000 })]),
  popcorn: () => render([V('noise', 1, 1, 0.035, { vol: 0.45, decay: 70, hp: 1500 }), V('sine', 1400, 600, 0.03, { vol: 0.2, decay: 60 })]),
  dart: () => render([V('noise', 1, 1, 0.08, { vol: 0.25, decay: 30, hp: 3500 }), V('sine', 2400, 1600, 0.06, { vol: 0.08, decay: 40 })]),
  rocket: () => render([V('noise', 1, 1, 0.35, { vol: 0.3, decay: 6, hp: 1200, lp: 5000 }), V('sine', 500, 1600, 0.3, { vol: 0.1, decay: 5 })]),
  crackle: () => render(Array.from({ length: 9 }, (_, i) => V('noise', 1, 1, 0.03, { vol: 0.35, decay: 70, hp: 2000, delay: i * 0.035 + (i % 3) * 0.01 })).concat([V('sine', 150, 50, 0.25, { vol: 0.5, decay: 12 })])),
  boom: () => render([V('sine', 90, 30, 0.6, { vol: 0.9, decay: 6 }), V('noise', 1, 1, 0.5, { vol: 0.6, decay: 7, lp: 1100 })]),
  spray: () => render([V('noise', 1, 1, 0.3, { vol: 0.3, decay: 8, lp: 3000, hp: 600 })]),
  ringtoss: () => render([V('noise', 1, 1, 0.18, { vol: 0.2, decay: 12, hp: 2000, lp: 6000 }), V('sine', 700, 900, 0.18, { vol: 0.1, decay: 10, vib: 0.1, vibRate: 30 })]),
  cannon: () => render([V('sine', 70, 28, 0.5, { vol: 1, decay: 7 }), V('noise', 1, 1, 0.35, { vol: 0.6, decay: 9, lp: 1400 }), V('sine', 1200, 300, 0.2, { vol: 0.1, decay: 10, delay: 0.05 })]),
  frost: () => render([V('noise', 1, 1, 0.3, { vol: 0.28, decay: 9, hp: 4000 }), V('sine', 2400, 3000, 0.25, { vol: 0.08, decay: 8, vib: 0.05, vibRate: 40 })]),
  flame: () => render([V('noise', 1, 1, 0.4, { vol: 0.4, decay: 6, lp: 1600, hp: 200 })]),
  laser: () => render([V('saw', 1800, 900, 0.4, { vol: 0.12, lp: 4000, vib: 0.03, vibRate: 30, decay: 3 }), V('sine', 120, 120, 0.4, { vol: 0.2, decay: 3 })]),
  orbs: () => render([V('sine', 660, 990, 0.4, { vol: 0.15, decay: 5, vib: 0.03, vibRate: 8 }), V('sine', 990, 1320, 0.4, { vol: 0.1, decay: 5, delay: 0.05 })]),
  gravity: () => render([V('sine', 300, 60, 0.6, { vol: 0.5, decay: 4, curve: 0.5 }), V('saw', 90, 45, 0.5, { vol: 0.12, lp: 400, decay: 4 })]),
  ding: () => render([V('sine', 1568, 1568, 0.9, { vol: 0.35, decay: 4 }), V('sine', 3136, 3136, 0.6, { vol: 0.12, decay: 6 }), V('sine', 2350, 2350, 0.7, { vol: 0.1, decay: 5 })]),
  mirror: () => render([V('sine', 1200, 2400, 0.3, { vol: 0.15, decay: 6, vib: 0.08, vibRate: 20 }), V('sine', 1800, 3600, 0.3, { vol: 0.1, decay: 6, delay: 0.06 })]),
  bite: () => render([V('noise', 1, 1, 0.05, { vol: 0.4, decay: 50, lp: 2500 }), V('sine', 500, 300, 0.05, { vol: 0.25, decay: 40 })]),
  roar: () => render([V('saw', 110, 70, 0.9, { vol: 0.45, lp: 700, vib: 0.08, vibRate: 13, decay: 2 }), V('saw', 165, 100, 0.9, { vol: 0.3, lp: 900, vib: 0.1, vibRate: 11, decay: 2 }), V('noise', 1, 1, 0.8, { vol: 0.3, decay: 3, lp: 900 })]),
  // ---- player / UI
  select: () => render([V('square', 660, 660, 0.06, { vol: 0.15, lp: 3000, decay: 20 }), V('square', 990, 990, 0.1, { vol: 0.15, lp: 3000, decay: 15, delay: 0.06 })]),
  ui_hover: () => render([V('sine', 1200, 1300, 0.04, { vol: 0.08, decay: 50 })]),
  ui_click: () => render([V('square', 800, 1000, 0.05, { vol: 0.12, lp: 3500, decay: 30 })]),
  ui_back: () => render([V('square', 700, 450, 0.08, { vol: 0.12, lp: 3000, decay: 25 })]),
  buy: () => render([1047, 1319, 1568, 2093].map((f, i) => V('square', f, f, 0.12, { vol: 0.1, lp: 5000, decay: 14, delay: i * 0.05 })).concat([V('noise', 1, 1, 0.2, { vol: 0.15, decay: 12, hp: 5000, delay: 0.05 })])),
  deny: () => render([V('square', 200, 150, 0.2, { vol: 0.15, lp: 1200, decay: 8 })]),
  pickup: () => render([V('sine', 1568, 1568, 0.08, { vol: 0.12, decay: 28 }), V('sine', 2093, 2093, 0.07, { vol: 0.07, decay: 30, delay: 0.02 })]),
  heal: () => render([523, 659, 784, 1047].map((f, i) => V('tri', f, f, 0.2, { vol: 0.2, decay: 9, delay: i * 0.05 }))),
  hurt: () => render([V('saw', 300, 120, 0.2, { vol: 0.35, lp: 1500, decay: 10 }), V('noise', 1, 1, 0.12, { vol: 0.3, decay: 25, lp: 2000 })]),
  levelup: () => render([523, 659, 784, 1047, 1319].map((f, i) => V('square', f, f, 0.18, { vol: 0.12, lp: 4000, decay: 8, delay: i * 0.07, vib: 0.01, vibRate: 7 })).concat([V('tri', 1047, 1047, 0.6, { vol: 0.15, decay: 4, delay: 0.35 })])),
  evolve: () => render([392, 523, 659, 784, 1047, 1319, 1568].map((f, i) => V('saw', f, f, 0.35, { vol: 0.1, lp: 3500, decay: 5, delay: i * 0.08 })).concat([V('noise', 1, 1, 0.8, { vol: 0.25, decay: 3, hp: 4000, delay: 0.5 }), V('sine', 80, 40, 0.8, { vol: 0.5, decay: 4, delay: 0.5 })])),
  chest: () => render([V('noise', 1, 1, 0.1, { vol: 0.3, decay: 25, lp: 2000 }), ...[784, 988, 1175, 1568].map((f, i) => V('sine', f, f, 0.3, { vol: 0.15, decay: 8, delay: 0.15 + i * 0.06 }))]),
  inflate: () => render([V('sine', 300, 900, 0.3, { vol: 0.2, decay: 4, vib: 0.05, vibRate: 20 })]),
  revive: () => render([V('sine', 300, 1200, 0.6, { vol: 0.3, decay: 3 }), V('tri', 600, 2400, 0.6, { vol: 0.15, decay: 3, delay: 0.1 })]),
  shield: () => render([V('noise', 1, 1, 0.1, { vol: 0.7, decay: 35, hp: 900 }), V('sine', 1200, 200, 0.15, { vol: 0.4, decay: 15 })]),
  banner: () => render([V('square', 523, 523, 0.12, { vol: 0.12, lp: 3000, decay: 10 }), V('square', 784, 784, 0.2, { vol: 0.12, lp: 3000, decay: 8, delay: 0.1 })]),
  warning: () => render([0, 0.45, 0.9].flatMap((d) => [V('saw', 440, 660, 0.35, { vol: 0.18, lp: 2400, delay: d, decay: 2 }), V('saw', 660, 440, 0.08, { vol: 0.12, lp: 2400, delay: d + 0.35 })]).concat([V('sine', 55, 55, 1.4, { vol: 0.35, decay: 1.5 })])),
  victory: () => render([523, 523, 523, 659, 784, 659, 784, 1047].map((f, i) => V('square', f, f, i === 7 ? 0.9 : 0.16, { vol: 0.13, lp: 4000, decay: i === 7 ? 2 : 10, delay: [0, 0.15, 0.3, 0.45, 0.6, 0.85, 1.0, 1.2][i], vib: 0.015, vibRate: 6 })).concat([V('saw', 262, 262, 1.2, { vol: 0.12, lp: 1200, decay: 1.5, delay: 1.2 })])),
  defeat: () => render([V('saw', 392, 370, 0.35, { vol: 0.2, lp: 1500, vib: 0.03, vibRate: 6 }), V('saw', 370, 349, 0.35, { vol: 0.2, lp: 1500, delay: 0.38, vib: 0.03, vibRate: 6 }), V('saw', 349, 330, 0.35, { vol: 0.2, lp: 1500, delay: 0.76, vib: 0.03, vibRate: 6 }), V('saw', 330, 220, 1.1, { vol: 0.22, lp: 1300, delay: 1.14, vib: 0.06, vibRate: 5, decay: 1.2 })]),
  // ---- bosses
  inhale: () => render([V('noise', 1, 1, 1.4, { vol: 0.4, attack: 0.8, decay: 0.6, lp: 900, hp: 150 })]),
  crash: () => render([V('noise', 1, 1, 0.7, { vol: 0.7, decay: 5, lp: 2500 }), V('sine', 80, 30, 0.7, { vol: 0.8, decay: 5 }), V('square', 900, 400, 0.4, { vol: 0.1, decay: 6, lp: 2500 })]),
  whistle: () => render([V('sine', 2400, 900, 0.8, { vol: 0.2, curve: 1.5, decay: 1 })]),
  fire: () => render([V('noise', 1, 1, 1.0, { vol: 0.45, decay: 2, lp: 1200, hp: 100, attack: 0.1 })]),
  bellow: () => render([V('saw', 95, 85, 1.0, { vol: 0.4, lp: 600, vib: 0.05, vibRate: 7, decay: 2 }), V('saw', 142, 128, 1.0, { vol: 0.3, lp: 700, decay: 2 })]),
  spew: () => render([V('noise', 1, 1, 0.5, { vol: 0.45, decay: 6, lp: 1800 }), V('saw', 200, 80, 0.4, { vol: 0.2, lp: 600, decay: 6 })]),
  glow: () => render([V('sine', 200, 600, 0.8, { vol: 0.25, decay: 2, vib: 0.05, vibRate: 12 })]),
  popcornburst: () => render(Array.from({ length: 16 }, (_, i) => V('noise', 1, 1, 0.03, { vol: 0.4, decay: 70, hp: 1500, delay: i * 0.03 }))),
  flap: () => render([V('noise', 1, 1, 0.25, { vol: 0.4, decay: 12, lp: 1200 }), V('noise', 1, 1, 0.25, { vol: 0.35, decay: 12, lp: 1100, delay: 0.25 })]),
  shriek: () => render([V('saw', 1400, 900, 1.0, { vol: 0.25, lp: 3500, vib: 0.06, vibRate: 30, decay: 2 }), V('square', 1900, 1500, 0.9, { vol: 0.1, lp: 3000, vib: 0.08, vibRate: 25, decay: 2 })]),
  creak: () => render([V('saw', 110, 160, 0.8, { vol: 0.25, lp: 900, vib: 0.15, vibRate: 18, decay: 2 })]),
  pew: () => render([V('square', 1400, 500, 0.1, { vol: 0.12, lp: 4000, decay: 20 })]),
  whoosh: () => render([V('noise', 1, 1, 0.5, { vol: 0.4, attack: 0.15, decay: 4, lp: 1500, hp: 300 })]),
  rev: () => render([V('saw', 60, 180, 1.0, { vol: 0.3, lp: 700, vib: 0.15, vibRate: 30, decay: 1, curve: 0.6 })]),
  drumroll: () => render(Array.from({ length: 22 }, (_, i) => V('noise', 1, 1, 0.05, { vol: 0.25 + i * 0.01, decay: 40, lp: 3000, hp: 400, delay: i * 0.045 })).concat([V('noise', 1, 1, 0.5, { vol: 0.5, decay: 6, hp: 4000, delay: 1.0 })])),
  clack: () => render([V('sine', 700, 500, 0.06, { vol: 0.4, decay: 40 }), V('sine', 900, 600, 0.06, { vol: 0.3, decay: 40, delay: 0.07 })]),
  snap: () => render([V('noise', 1, 1, 0.05, { vol: 0.6, decay: 60, hp: 2500 }), V('sine', 1800, 300, 0.12, { vol: 0.25, decay: 20 })]),
  twang: () => render([V('saw', 220, 210, 0.7, { vol: 0.25, lp: 2000, vib: 0.03, vibRate: 9, decay: 4 }), V('saw', 330, 320, 0.7, { vol: 0.12, lp: 2000, decay: 4 })]),
  slam: () => render([V('sine', 130, 40, 0.4, { vol: 0.9, decay: 8 }), V('noise', 1, 1, 0.25, { vol: 0.4, decay: 14, lp: 1500 })]),
  glint: () => render([V('sine', 2600, 3400, 0.3, { vol: 0.15, decay: 7 }), V('sine', 3900, 5200, 0.25, { vol: 0.08, decay: 8, delay: 0.05 })]),
  windmill: () => render(Array.from({ length: 6 }, (_, i) => V('noise', 1, 1, 0.12, { vol: 0.3, decay: 14, lp: 1300, hp: 300, delay: i * 0.12 }))),
  laugh: () => render(Array.from({ length: 6 }, (_, i) => V('saw', 220 - i * 8, 180 - i * 8, 0.14, { vol: 0.2, lp: 1400, vib: 0.06, vibRate: 9, decay: 8, delay: i * 0.17 }))),
  spotlight: () => render([V('noise', 1, 1, 0.08, { vol: 0.6, decay: 40, lp: 1800 }), V('sine', 60, 50, 0.6, { vol: 0.4, decay: 3 })]),
  poof: () => render([V('noise', 1, 1, 0.3, { vol: 0.4, decay: 10, lp: 2400, hp: 400 })]),
  whipwind: () => render([V('noise', 1, 1, 0.5, { vol: 0.25, attack: 0.4, decay: 0.5, lp: 1200, hp: 300 })]),
  whipcrack: () => render([V('noise', 1, 1, 0.05, { vol: 0.9, decay: 60, hp: 2000 }), V('sine', 3000, 800, 0.06, { vol: 0.3, decay: 40 })]),
  canetap: () => render([V('sine', 900, 880, 0.12, { vol: 0.35, decay: 25 }), V('sine', 1800, 1760, 0.1, { vol: 0.12, decay: 30 })]),
  hatspin: () => render([V('tri', 300, 900, 0.7, { vol: 0.2, vib: 0.2, vibRate: 14, decay: 2 })]),
  rumble: () => render([V('sine', 45, 40, 1.4, { vol: 0.6, attack: 0.4, decay: 1 }), V('noise', 1, 1, 1.4, { vol: 0.2, attack: 0.4, decay: 1, lp: 300 })]),
  demon: () => render([V('saw', 70, 45, 1.6, { vol: 0.4, lp: 500, vib: 0.1, vibRate: 6, decay: 1 }), V('saw', 105, 66, 1.6, { vol: 0.3, lp: 600, vib: 0.12, vibRate: 5, decay: 1 }), V('noise', 1, 1, 1.4, { vol: 0.3, decay: 1.5, lp: 600 })]),
  bossdie: () => render([V('sine', 220, 30, 2.0, { vol: 0.6, decay: 1.2, curve: 0.6 }), V('noise', 1, 1, 1.6, { vol: 0.5, decay: 1.6, lp: 1600 }), V('saw', 440, 60, 1.6, { vol: 0.15, lp: 1500, decay: 1.4 })]),
  swarmwarn: () => render([V('square', 1200, 1200, 0.06, { vol: 0.1, lp: 3000 }), V('square', 1200, 1200, 0.06, { vol: 0.1, lp: 3000, delay: 0.1 })]),
  carhorn: () => render([V('square', 350, 340, 0.25, { vol: 0.2, lp: 1500, duty: 0.3 }), V('square', 350, 340, 0.4, { vol: 0.2, lp: 1500, duty: 0.3, delay: 0.32 })]),
  stampede: () => render(Array.from({ length: 14 }, (_, i) => V('sine', 120, 50, 0.12, { vol: 0.5, decay: 25, delay: i * 0.08 + (i % 2) * 0.03 }))),
  calliope: () => render([392, 494, 587, 494, 392, 330, 392].map((f, i) => V('square', f * 2, f * 2, 0.22, { vol: 0.1, lp: 2500, vib: 0.02, vibRate: 6, decay: 4, delay: i * 0.22 }))),
  // ---- the Last Song (quest) — base pitch C5 (523.25 Hz); played with pitch = note / 523.25
  bellnote: () => render([V('sine', 523.25, 523.25, 1.4, { vol: 0.3, decay: 2.6 }), V('sine', 1046.5, 1046.5, 0.9, { vol: 0.1, decay: 4 }), V('sine', 1570.5, 1570.5, 0.6, { vol: 0.06, decay: 6 }), V('tri', 523.25 * 0.997, 523.25 * 0.997, 1.2, { vol: 0.08, decay: 3, vib: 0.006, vibRate: 5 })]),
  soul: () => render([V('sine', 900, 1800, 0.45, { vol: 0.12, decay: 5, vib: 0.06, vibRate: 11 }), V('noise', 1, 1, 0.4, { vol: 0.08, attack: 0.1, decay: 6, hp: 3000 })]),
  hum: () => render([V('sine', 220, 220, 1.1, { vol: 0.18, attack: 0.15, decay: 2, vib: 0.01, vibRate: 3 }), V('sine', 330, 331, 1.1, { vol: 0.1, attack: 0.2, decay: 2 })]),
  sour: () => render([V('saw', 466, 440, 0.6, { vol: 0.14, lp: 1600, vib: 0.04, vibRate: 7, decay: 4 }), V('saw', 493, 470, 0.6, { vol: 0.12, lp: 1600, decay: 4 })]),
  clunk: () => render([V('sine', 140, 70, 0.25, { vol: 0.6, decay: 14 }), V('noise', 1, 1, 0.12, { vol: 0.35, decay: 25, lp: 900 })]),
  lamp_lit: () => render([392, 494, 587, 784].map((f, i) => V('sine', f, f, 1.6, { vol: 0.1, attack: 0.05, decay: 1.6, delay: i * 0.09, vib: 0.008, vibRate: 4 })).concat([V('noise', 1, 1, 0.8, { vol: 0.08, attack: 0.2, decay: 2.5, hp: 4000 })])),
  carousel_wake: () => render([196, 262, 330, 392, 523].map((f, i) => V('square', f, f * 1.002, 1.4, { vol: 0.07, lp: 1800, vib: 0.03, vibRate: 5, attack: 0.08, decay: 1.2, delay: i * 0.12 })).concat([V('saw', 98, 98, 1.6, { vol: 0.1, lp: 500, decay: 1 })])),
  fortune: () => render([V('sine', 1318, 1318, 0.5, { vol: 0.1, decay: 5 }), V('sine', 1760, 1760, 0.5, { vol: 0.08, decay: 5, delay: 0.12 }), V('sine', 2637, 2637, 0.8, { vol: 0.06, decay: 4, delay: 0.24 }), V('saw', 80, 60, 0.5, { vol: 0.1, lp: 300, decay: 6 })]),
  ghost_ticket: () => render([523, 659, 784, 1047, 1319, 1568].map((f, i) => V('sine', f, f, 0.5, { vol: 0.1, decay: 6, delay: i * 0.06 })).concat([V('noise', 1, 1, 1.0, { vol: 0.1, attack: 0.3, decay: 2, hp: 5000 })])),
  toll: () => render([V('sine', 110, 110, 3, { vol: 0.5, decay: 1.2 }), V('sine', 277, 276, 2.4, { vol: 0.2, decay: 1.5 }), V('sine', 412, 411, 2, { vol: 0.12, decay: 1.8 }), V('noise', 1, 1, 0.1, { vol: 0.3, decay: 30, lp: 1500 })]),
  // ---- the prize wheel
  wheel_tick: () => render([V('square', 2200, 1800, 0.018, { vol: 0.14, decay: 120, lp: 5000 }), V('noise', 1, 1, 0.012, { vol: 0.2, decay: 200, hp: 3000 })]),
  wheel_crank: () => render([V('saw', 70, 130, 0.5, { vol: 0.25, lp: 700, vib: 0.2, vibRate: 22, decay: 3 }), V('noise', 1, 1, 0.08, { vol: 0.4, decay: 30, lp: 2000, delay: 0.42 }), V('sine', 180, 90, 0.12, { vol: 0.5, decay: 20, delay: 0.42 })]),
  wheel_rise: () => render([V('saw', 55, 90, 0.9, { vol: 0.2, lp: 400, vib: 0.1, vibRate: 9, attack: 0.1, decay: 1.5 }), V('noise', 1, 1, 0.9, { vol: 0.12, attack: 0.3, decay: 2, lp: 800 })]),
  fanfare: () => render([523, 659, 784, 1047].map((f, i) => V('square', f, f, i === 3 ? 0.7 : 0.14, { vol: 0.11, lp: 3800, decay: i === 3 ? 3 : 12, delay: i * 0.1, vib: 0.012, vibRate: 6 })).concat([V('noise', 1, 1, 0.4, { vol: 0.12, decay: 6, hp: 5000, delay: 0.3 })])),
  thunder: () => render([V('noise', 1, 1, 1.6, { vol: 0.7, decay: 2.2, lp: 700 }), V('sine', 60, 30, 1.4, { vol: 0.6, decay: 2.5 }), V('noise', 1, 1, 0.12, { vol: 0.5, decay: 30, hp: 1500 })]),
  // the prize wheel as a slot machine (D-61): the reel's whir, a blip per peg, the jackpot bell, a shower of coins
  slot_spin: () => render([V('saw', 160, 880, 0.6, { vol: 0.13, lp: 2600, curve: 0.6, decay: 2.2 }), V('square', 320, 1760, 0.6, { vol: 0.05, lp: 4000, curve: 0.6, decay: 2.5, duty: 0.25 }), V('noise', 1, 1, 0.5, { vol: 0.08, hp: 2200, lp: 7000, decay: 3 })]),
  slot_blip: () => render([V('square', 1568, 1568, 0.05, { vol: 0.1, decay: 55, lp: 6000, duty: 0.3 }), V('sine', 3136, 3136, 0.04, { vol: 0.05, decay: 80 })]),
  slot_win: () => render(Array.from({ length: 12 }, (_, i) => {
    const f = i % 2 ? 1760 : 2093;
    return [V('sine', f, f, 0.32, { vol: 0.13, decay: 9, delay: i * 0.08 }), V('sine', f * 2.76, f * 2.76, 0.18, { vol: 0.035, decay: 15, delay: i * 0.08 })];
  }).flat()),
  coin_shower: () => render(Array.from({ length: 18 }, (_, i) => [
    V('sine', 2500 + ((i * 37) % 5) * 260, 2380 + ((i * 53) % 4) * 190, 0.14, { vol: 0.07, decay: 22, delay: i * 0.055 + ((i * 7) % 3) * 0.012 }),
    V('sine', 5200 + ((i * 29) % 6) * 280, 5000, 0.06, { vol: 0.022, decay: 40, delay: i * 0.055 }),
  ]).flat()),
  coins: () => render(Array.from({ length: 8 }, (_, i) => V('sine', 2400 + (i % 3) * 300, 2300, 0.12, { vol: 0.08, decay: 25, delay: i * 0.05 }))),
  // ---- the Fun House (D-63): glass, porcelain, strings, goo, and the house's own voice
  shatter: () => render([V('noise', 1, 1, 0.5, { vol: 0.55, decay: 7, hp: 2200 }), ...[3100, 4300, 2600, 5200, 3700].map((f, i) => V('sine', f, f * 0.97, 0.35, { vol: 0.1, decay: 9, delay: i * 0.035 })), V('sine', 180, 60, 0.2, { vol: 0.3, decay: 18 })]),
  glass_hit: () => render([V('sine', 2900, 2850, 0.18, { vol: 0.16, decay: 16 }), V('sine', 4100, 4000, 0.14, { vol: 0.08, decay: 20 }), V('noise', 1, 1, 0.04, { vol: 0.2, decay: 60, hp: 3500 })]),
  ripple: () => render([V('sine', 900, 1500, 0.9, { vol: 0.16, vib: 0.12, vibRate: 7, attack: 0.1, decay: 2.2 }), V('sine', 1350, 2250, 0.9, { vol: 0.08, vib: 0.14, vibRate: 6, attack: 0.15, decay: 2.2, delay: 0.08 })]),
  squelch: () => render([V('sine', 240, 90, 0.22, { vol: 0.45, vib: 0.2, vibRate: 26, decay: 10 }), V('noise', 1, 1, 0.16, { vol: 0.25, decay: 16, lp: 700 })]),
  splat: () => render([V('noise', 1, 1, 0.2, { vol: 0.5, decay: 14, lp: 1100 }), V('sine', 180, 60, 0.15, { vol: 0.4, decay: 18 })]),
  grind: () => render([V('saw', 70, 64, 0.9, { vol: 0.25, lp: 500, vib: 0.2, vibRate: 22, attack: 0.08, decay: 2 }), V('noise', 1, 1, 0.9, { vol: 0.2, attack: 0.08, decay: 2, lp: 900, hp: 150 })]),
  wail: () => render([V('saw', 520, 340, 1.1, { vol: 0.22, lp: 1800, vib: 0.06, vibRate: 5, attack: 0.15, decay: 1.6, curve: 0.6 }), V('saw', 780, 500, 1.1, { vol: 0.12, lp: 2000, vib: 0.07, vibRate: 5.5, attack: 0.15, decay: 1.6 })]),
  thud: () => render([V('sine', 110, 40, 0.3, { vol: 0.8, decay: 10 }), V('noise', 1, 1, 0.12, { vol: 0.35, decay: 25, lp: 900 })]),
  // ---- the Boardwalk (D-68): seawater, chitin, a ticket punch, taffy, clockwork, the drop, the tide
  gurgle: () => render([...Array.from({ length: 6 }, (_, i) => V('sine', 180 + ((i * 53) % 90), 90 + ((i * 31) % 40), 0.09, { vol: 0.2, decay: 30, delay: i * 0.06, vib: 0.3, vibRate: 30 })), V('noise', 1, 1, 0.45, { vol: 0.12, lp: 500, decay: 5 })]),
  clatter: () => render([...Array.from({ length: 5 }, (_, i) => V('square', 1800 + (i % 3) * 400, 1500, 0.02, { vol: 0.1, decay: 120, delay: i * 0.035, lp: 4000 })), V('noise', 1, 1, 0.05, { vol: 0.15, decay: 60, hp: 3000 })]),
  punch: () => render([V('noise', 1, 1, 0.03, { vol: 0.4, decay: 90, hp: 2500 }), V('sine', 900, 400, 0.05, { vol: 0.3, decay: 60, delay: 0.04 }), V('square', 220, 160, 0.06, { vol: 0.12, decay: 50, delay: 0.05, lp: 1500 })]),
  stretch: () => render([V('saw', 200, 520, 0.5, { vol: 0.18, lp: 1200, vib: 0.08, vibRate: 14, curve: 0.7, decay: 2.5 }), V('sine', 300, 780, 0.5, { vol: 0.1, vib: 0.1, vibRate: 11, decay: 2.5 })]),
  crank: () => render([...Array.from({ length: 10 }, (_, i) => V('noise', 1, 1, 0.015, { vol: 0.22, decay: 150, hp: 1800, delay: 0.8 * Math.sqrt(i / 10) })), V('saw', 80, 120, 0.85, { vol: 0.08, lp: 500, decay: 1.5 })]),
  scream: () => render([V('saw', 900, 520, 1.0, { vol: 0.18, lp: 2400, vib: 0.05, vibRate: 7, attack: 0.05, decay: 1.4, curve: 0.8 }), V('saw', 1350, 780, 1.0, { vol: 0.09, lp: 2600, vib: 0.06, vibRate: 7.5, decay: 1.4 }), V('noise', 1, 1, 0.9, { vol: 0.07, hp: 1200, lp: 4000, decay: 2 })]),
  crack: () => render([V('noise', 1, 1, 0.12, { vol: 0.6, decay: 30, hp: 1500 }), V('sine', 160, 60, 0.25, { vol: 0.5, decay: 14 }), V('noise', 1, 1, 0.3, { vol: 0.2, decay: 10, lp: 900, delay: 0.05 })]),
  lure: () => render([V('sine', 660, 660, 1.4, { vol: 0.12, attack: 0.3, decay: 1.4, vib: 0.01, vibRate: 5 }), V('sine', 990, 985, 1.4, { vol: 0.07, attack: 0.4, decay: 1.6 }), V('sine', 1320, 1310, 1.0, { vol: 0.04, attack: 0.5, decay: 2 })]),
  jingle: () => render([...Array.from({ length: 10 }, (_, i) => V('sine', 3000 + ((i * 211) % 1200), 2900, 0.1, { vol: 0.06, decay: 30, delay: i * 0.03 + ((i * 7) % 4) * 0.01 })), V('sine', 120, 50, 0.25, { vol: 0.5, decay: 12 })]),
  conch: () => render([V('saw', 110, 104, 1.6, { vol: 0.22, lp: 700, attack: 0.25, decay: 1.2, vib: 0.015, vibRate: 4 }), V('saw', 165, 158, 1.6, { vol: 0.1, lp: 900, attack: 0.3, decay: 1.3 }), V('noise', 1, 1, 1.4, { vol: 0.05, lp: 500, attack: 0.3, decay: 1.5 })]),
  surge: () => render([V('noise', 1, 1, 1.2, { vol: 0.32, lp: 1400, hp: 150, attack: 0.25, decay: 2 }), V('noise', 1, 1, 0.6, { vol: 0.18, hp: 2500, delay: 0.5, decay: 4 })]),
  // (new sounds go last: the noise generator is shared, so the order keeps every earlier sound identical)
  // the Gala Queen's call (D-79): a short and a long blast of a steamship's horn
  shiphorn_s: () => shipHorn(0.5),
  shiphorn_l: () => shipHorn(1.4),
  // the pier's hoist winching the founder's bell up (a ratchet, the drum's groan, the chain), and it slipping back
  winch: () => render([
    ...Array.from({ length: 7 }, (_, i) => V('noise', 1, 1, 0.02, { vol: 0.32, decay: 120, hp: 1500, lp: 6000, delay: i * 0.085 })),
    ...Array.from({ length: 7 }, (_, i) => V('square', 900, 700, 0.025, { vol: 0.08, decay: 90, lp: 3000, delay: i * 0.085 + 0.004 })),
    V('saw', 58, 66, 0.6, { vol: 0.22, lp: 380, attack: 0.05, decay: 1.5, vib: 0.08, vibRate: 11 }),
    ...Array.from({ length: 5 }, (_, i) => V('sine', 2600 + ((i * 331) % 700), 2400, 0.06, { vol: 0.05, decay: 40, delay: 0.05 + i * 0.11 })),
  ]),
  winch_slip: () => render([
    ...Array.from({ length: 3 }, (_, i) => V('noise', 1, 1, 0.03, { vol: 0.25, decay: 80, hp: 1200, lp: 4000, delay: i * 0.22 })),
    V('saw', 90, 60, 0.7, { vol: 0.12, lp: 500, decay: 2, vib: 0.1, vibRate: 7 }),
  ]),  // ---- the Ghost Train (D-80): the line's own voice (whistle, bell, chuff, brakes, doors), then its people
  // a steam whistle: three detuned reeds in a minor chord over the breath of the steam
  gt_whistle: () => render([
    V('saw', 494, 498, 1.3, { vol: 0.16, lp: 2600, attack: 0.08, decay: 1.1, vib: 0.006, vibRate: 6 }),
    V('saw', 587, 590, 1.3, { vol: 0.13, lp: 2600, attack: 0.1, decay: 1.1, vib: 0.007, vibRate: 6.4 }),
    V('saw', 740, 744, 1.3, { vol: 0.1, lp: 2800, attack: 0.12, decay: 1.1, vib: 0.008, vibRate: 5.7 }),
    V('noise', 1, 1, 1.3, { vol: 0.12, hp: 1800, lp: 6000, attack: 0.05, decay: 1.2 }),
  ]),
  // the train pulling up (D-84): two blasts, a short and a long, loud enough to carry across the station
  gt_arrive: () => render(([[0, 0.55], [0.8, 1.7]] as [number, number][]).flatMap(([d, len]) => [
    V('saw', 494, 498, len, { vol: 0.24, lp: 2600, attack: 0.06, decay: 0.6, vib: 0.006, vibRate: 6, delay: d }),
    V('saw', 587, 590, len, { vol: 0.2, lp: 2600, attack: 0.08, decay: 0.6, vib: 0.007, vibRate: 6.4, delay: d }),
    V('saw', 740, 744, len, { vol: 0.16, lp: 2800, attack: 0.1, decay: 0.6, vib: 0.008, vibRate: 5.7, delay: d }),
    V('noise', 1, 1, len, { vol: 0.17, hp: 1800, lp: 6000, attack: 0.05, decay: 0.7, delay: d }),
  ])),
  // a station hand bell: inharmonic partials ringing out
  gt_bell: () => render([...[1, 2.4, 3.9, 5.4].map((m, i) => V('sine', 1180 * m, 1180 * m, 1.2 - i * 0.2, { vol: 0.16 / (1 + i), decay: 3 + i * 2 })), ...[1, 2.4].map((m) => V('sine', 1180 * m, 1180 * m, 0.9, { vol: 0.08, decay: 4, delay: 0.32 }))]),
  gt_chuff: () => render([V('noise', 1, 1, 0.22, { vol: 0.45, lp: 1200, hp: 120, decay: 12 }), V('sine', 70, 45, 0.18, { vol: 0.35, decay: 16 })]),
  gt_brake: () => render([V('sine', 2900, 2400, 1.2, { vol: 0.08, vib: 0.02, vibRate: 23, attack: 0.1, decay: 1.6 }), V('sine', 3480, 3000, 1.0, { vol: 0.05, vib: 0.03, vibRate: 19, attack: 0.15, decay: 2 }), V('noise', 1, 1, 1.2, { vol: 0.14, hp: 2000, lp: 7000, decay: 1.8 })]),
  gt_doors: () => render([V('noise', 1, 1, 0.25, { vol: 0.3, lp: 1800, decay: 10 }), V('sine', 150, 60, 0.2, { vol: 0.55, decay: 14, delay: 0.18 }), V('square', 420, 380, 0.05, { vol: 0.1, decay: 60, lp: 2500, delay: 0.2 })]),
  gt_rush: () => render([V('noise', 1, 1, 1.0, { vol: 0.4, lp: 2400, hp: 200, attack: 0.25, decay: 2.5 }), V('saw', 60, 40, 1.0, { vol: 0.15, lp: 300, attack: 0.3, decay: 2 })]),
  gt_tick: () => render([V('noise', 1, 1, 0.02, { vol: 0.35, decay: 150, hp: 3000 }), V('sine', 2200, 2000, 0.03, { vol: 0.12, decay: 90 })]),
  gt_toll: () => render([...[1, 2.0, 2.4, 3.0, 4.2].map((m, i) => V('sine', 196 * m, 196 * m, 3 - i * 0.4, { vol: 0.2 / (1 + i * 0.7), decay: 1.2 + i * 0.6 }))]),
  // the world tiers' unlock ceremonies (D-97): Nightmare's a detuned choir swelling out of a low bell, its chord
  // drifting out of tune; Hell's a sub-bass drop under an anvil strike and a low brass cluster that burns out
  tier_nightmare: () => render([
    V('sine', 98, 98, 4, { vol: 0.4, decay: 0.9 }), V('sine', 246, 245, 3.2, { vol: 0.12, decay: 1.1 }),
    ...[0, 3, 7, 10].map((st, i) => V('saw', 196 * Math.pow(2, st / 12), 196 * Math.pow(2, st / 12) * 0.985, 3.6, { vol: 0.055, lp: 1400 + i * 300, attack: 0.9, decay: 0.9, vib: 0.02, vibRate: 4.3 + i * 0.6, delay: 0.25 + i * 0.12 })),
    ...[0, 7].map((st) => V('sine', 784 * Math.pow(2, st / 12), 760 * Math.pow(2, st / 12), 3, { vol: 0.05, attack: 1.2, decay: 1, vib: 0.03, vibRate: 5.1, delay: 0.8 })),
    V('noise', 1, 1, 2.4, { vol: 0.06, hp: 2500, lp: 6000, attack: 1.0, decay: 1.2, delay: 0.4 }),
  ], 0.4),
  tier_hell: () => render([
    V('sine', 90, 32, 1.6, { vol: 0.6, decay: 1.4 }), V('noise', 1, 1, 0.5, { vol: 0.45, lp: 900, hp: 40, decay: 6 }),
    ...[1, 2.76, 4.1, 5.9].map((m, i) => V('sine', 620 * m, 620 * m, 1.6 - i * 0.25, { vol: 0.14 / (1 + i), decay: 2.2 + i, delay: 0.05 })),
    ...[0, 1, 6].map((st, i) => V('saw', 65 * Math.pow(2, st / 12), 62 * Math.pow(2, st / 12), 3, { vol: 0.09, lp: 700, attack: 0.35, decay: 0.8, delay: 0.3 + i * 0.05 })),
    V('noise', 1, 1, 2.6, { vol: 0.16, lp: 2600, hp: 300, attack: 0.6, decay: 1.1, delay: 0.5 }),
  ], 0.4),
  // something whispering from Zoltana's booth (D-98, the first night's opening): breathy syllables over a faint hum
  whisper: () => render([
    ...[0, 0.17, 0.4, 0.55, 0.84, 1.02, 1.28, 1.45].map((d, i) => V('noise', 1, 1, 0.2 + (i % 3) * 0.06, { vol: 0.15 + (i % 2) * 0.05, hp: 1500 + (i % 3) * 450, lp: 4400 + (i % 2) * 1500, attack: 0.05, decay: 4.5, delay: d })),
    V('sine', 196, 174, 1.8, { vol: 0.025, attack: 0.5, decay: 1.1, vib: 0.01, vibRate: 3.1 }),
  ], 0.3),
  // a heartbeat at very low health (D-98): lub-dub, low and dull
  heartbeat: () => render([
    V('sine', 62, 42, 0.16, { vol: 0.8, decay: 14 }), V('noise', 1, 1, 0.06, { vol: 0.25, lp: 260, decay: 40 }),
    V('sine', 56, 38, 0.15, { vol: 0.6, decay: 15, delay: 0.24 }), V('noise', 1, 1, 0.05, { vol: 0.18, lp: 240, decay: 40, delay: 0.24 }),
  ]),
  gt_chime: () => render([...[1, 2.76, 5.4].map((m, i) => V('sine', 880 * m, 880 * m, 1.4 - i * 0.3, { vol: 0.15 / (1 + i), decay: 2.5 + i * 2 }))]),
  gt_furnace: () => render([V('noise', 1, 1, 1.1, { vol: 0.5, lp: 600, hp: 60, attack: 0.08, decay: 2.2 }), V('saw', 55, 45, 1.0, { vol: 0.2, lp: 260, attack: 0.1, decay: 2 }), V('noise', 1, 1, 0.6, { vol: 0.12, hp: 3000, decay: 4, delay: 0.1 })]),
  gt_shovel: () => render([V('noise', 1, 1, 0.25, { vol: 0.35, hp: 1500, lp: 5000, decay: 9 }), ...Array.from({ length: 6 }, (_, i) => V('square', 700 + (i % 3) * 180, 500, 0.03, { vol: 0.08, decay: 70, delay: 0.18 + i * 0.04, lp: 2500 }))]),
  gt_sizzle: () => render([V('noise', 1, 1, 0.7, { vol: 0.3, hp: 3500, lp: 9000, attack: 0.02, decay: 3 })]),
  gt_siren: () => render([V('saw', 300, 620, 1.6, { vol: 0.2, lp: 1600, attack: 0.2, curve: 0.6, decay: 0.8 }), V('saw', 304, 626, 1.6, { vol: 0.14, lp: 1700, attack: 0.2, curve: 0.6, decay: 0.8 })]),
  gt_rivet: () => render(Array.from({ length: 6 }, (_, i) => V('noise', 1, 1, 0.025, { vol: 0.4, decay: 110, hp: 1800, delay: i * 0.05 }))),
  gt_chain: () => render([...Array.from({ length: 8 }, (_, i) => V('square', 1400 + ((i * 197) % 600), 1200, 0.03, { vol: 0.09, decay: 80, delay: i * 0.045, lp: 4000 })), V('noise', 1, 1, 0.4, { vol: 0.15, hp: 2500, decay: 6 })]),
  gt_punch: () => render([V('noise', 1, 1, 0.025, { vol: 0.55, decay: 120, hp: 2500 }), V('square', 1800, 1200, 0.03, { vol: 0.15, decay: 90, lp: 4000 }), V('noise', 1, 1, 0.025, { vol: 0.4, decay: 120, hp: 2000, delay: 0.09 }), V('sine', 600, 300, 0.05, { vol: 0.25, decay: 50, delay: 0.09 })]),
  gt_rewind: () => render([V('noise', 1, 1, 0.8, { vol: 0.4, lp: 3000, hp: 300, attack: 0.55, decay: 2 }), V('sine', 300, 1600, 0.75, { vol: 0.16, attack: 0.5, curve: 0.4, decay: 2 })]),
  gt_fog: () => render([V('noise', 1, 1, 2.2, { vol: 0.3, lp: 500, attack: 0.6, decay: 1.2 }), V('sine', 110, 104, 2.2, { vol: 0.12, attack: 0.8, decay: 1 })]),
  steam_hiss: () => render([V('noise', 1, 1, 0.7, { vol: 0.32, hp: 2500, lp: 8000, attack: 0.01, decay: 4 })]),
  steamhiss: () => render([V('noise', 1, 1, 0.5, { vol: 0.3, hp: 2500, lp: 8000, decay: 5 }), V('sine', 200, 80, 0.15, { vol: 0.3, decay: 20 })]),
  mourn: () => render([V('saw', 392, 330, 1.2, { vol: 0.18, lp: 1400, vib: 0.05, vibRate: 4.5, attack: 0.25, decay: 1.4, curve: 0.7 }), V('sine', 784, 660, 1.2, { vol: 0.06, vib: 0.05, vibRate: 4.6, attack: 0.3, decay: 1.6 })]),
  ghostgasp: () => render([V('noise', 1, 1, 0.35, { vol: 0.3, lp: 2200, hp: 400, attack: 0.05, decay: 6 }), V('sine', 520, 300, 0.3, { vol: 0.08, vib: 0.1, vibRate: 9, decay: 6 })]),
  ghostsigh: () => render([V('noise', 1, 1, 0.8, { vol: 0.28, lp: 1500, hp: 300, attack: 0.15, decay: 3 }), V('sine', 330, 220, 0.8, { vol: 0.07, attack: 0.2, decay: 3 })]),
  papercrinkle: () => render(Array.from({ length: 8 }, (_, i) => V('noise', 1, 1, 0.03, { vol: 0.18, decay: 80, hp: 3500, delay: i * 0.03 + ((i * 7) % 3) * 0.01 }))),
  paperburst: () => render([V('noise', 1, 1, 0.35, { vol: 0.35, hp: 2500, decay: 9 }), ...Array.from({ length: 6 }, (_, i) => V('noise', 1, 1, 0.03, { vol: 0.15, decay: 80, hp: 4000, delay: 0.05 + i * 0.04 }))]),
  trunkslam: () => render([V('sine', 120, 45, 0.25, { vol: 0.7, decay: 12 }), V('noise', 1, 1, 0.12, { vol: 0.35, lp: 1500, decay: 25 }), V('square', 300, 260, 0.06, { vol: 0.1, decay: 50, lp: 2000, delay: 0.03 })]),
  bellcrack: () => render([...[1, 2.4, 3.9].map((m, i) => V('sine', 1180 * m * 0.97, 1180 * m * 0.9, 0.5, { vol: 0.14 / (1 + i), decay: 7 })), V('noise', 1, 1, 0.15, { vol: 0.3, hp: 2000, decay: 20 })]),
  bellding: () => render([V('sine', 1760, 1760, 0.4, { vol: 0.14, decay: 7 }), V('sine', 4224, 4224, 0.2, { vol: 0.05, decay: 12 })]),
  bonehit: () => render([V('noise', 1, 1, 0.04, { vol: 0.4, decay: 70, hp: 1800 }), V('sine', 700, 500, 0.05, { vol: 0.25, decay: 60 })]),
  bonecrumble: () => render([...Array.from({ length: 7 }, (_, i) => V('noise', 1, 1, 0.04, { vol: 0.25, decay: 60, hp: 1500, delay: i * 0.05 })), V('sine', 200, 90, 0.2, { vol: 0.3, decay: 15 })]),
  cinderpop: () => render([V('noise', 1, 1, 0.1, { vol: 0.5, decay: 40, hp: 800 }), V('sine', 500, 150, 0.1, { vol: 0.35, decay: 30 }), V('noise', 1, 1, 0.4, { vol: 0.12, hp: 4000, decay: 6, delay: 0.05 })]),
  coffinbreak: () => render([V('noise', 1, 1, 0.5, { vol: 0.5, lp: 1800, decay: 7 }), V('sine', 110, 40, 0.4, { vol: 0.6, decay: 8 }), ...Array.from({ length: 4 }, (_, i) => V('sine', 400 + i * 90, 260, 0.06, { vol: 0.18, decay: 40, delay: 0.1 + i * 0.07 }))]),
  crumble: () => render([V('noise', 1, 1, 0.6, { vol: 0.45, lp: 1400, decay: 6 }), V('sine', 90, 40, 0.4, { vol: 0.4, decay: 8 })]),
  crunch: () => render([V('noise', 1, 1, 0.12, { vol: 0.5, decay: 28, lp: 3000 }), V('square', 240, 120, 0.08, { vol: 0.12, decay: 40, lp: 1200 })]),
  firebox: () => render([V('noise', 1, 1, 0.6, { vol: 0.45, lp: 900, decay: 6 }), V('sine', 80, 40, 0.4, { vol: 0.4, decay: 8 }), V('noise', 1, 1, 0.5, { vol: 0.15, hp: 4000, decay: 6, delay: 0.1 })]),
  lampsmash: () => render([V('noise', 1, 1, 0.3, { vol: 0.4, hp: 2500, decay: 12 }), V('sine', 2800, 2600, 0.2, { vol: 0.12, decay: 18 }), V('sine', 300, 120, 0.1, { vol: 0.3, decay: 30 })]),
  mothflap: () => render([V('noise', 1, 1, 0.06, { vol: 0.15, lp: 1200, decay: 40 }), V('noise', 1, 1, 0.06, { vol: 0.12, lp: 1200, decay: 40, delay: 0.07 })]),
  mothpuff: () => render([V('noise', 1, 1, 0.25, { vol: 0.25, lp: 2500, hp: 600, decay: 12 })]),
  slagcrack: () => render([V('noise', 1, 1, 0.3, { vol: 0.5, hp: 600, lp: 3000, decay: 10 }), V('sine', 140, 50, 0.35, { vol: 0.5, decay: 9 }), V('noise', 1, 1, 0.6, { vol: 0.15, hp: 3500, decay: 5, delay: 0.1 })]),
  sizzle: () => render([V('noise', 1, 1, 0.25, { vol: 0.25, hp: 3500, decay: 12 })]),
};
