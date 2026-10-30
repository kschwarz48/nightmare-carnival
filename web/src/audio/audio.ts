// Web Audio engine (doc 02 §9). Buses: master → music / sfx / ambience / ui. The original score
// ("Freaky Funk Circus" by Bradley Schwarz) plays on the menus and through every boss fight; the night
// between bosses gets a quieter procedural music-box waltz that darkens with each Act (D-55). Quest
// chimes dip the music so they always carry. SFX are synthesized at boot.

import { RECIPES, SR } from './synth';

type Cue = 'menu' | 'act1' | 'act2' | 'act3' | 'act4' | 'boss_carnival_tent' | 'boss_ferris_wheel' | 'boss_puppet_king' | 'boss_ringmaster' | 'boss_ringmaster_2' | 'boss_ringmaster_3' | 'dawn' | 'endless' | 'silence' | 'results';

const BASE = import.meta.env.BASE_URL ?? './';

/** The procedural night score: a slow waltz in 3/4 led by a slightly broken music box. */
interface NightTheme {
  bpm: number;
  root: number; // MIDI note of the tonic
  melody: number[]; // scale degree per beat (-1 = rest)
  bass: number[]; // semitone offset of each bar's chord root
  counter: number; // 0..1: a detuned calliope shadowing the tune an octave down
  pulse: number; // 0..1: a heartbeat on the downbeat
  warp: number; // music-box pitch wobble
  vol: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 11, 12, 14, 15];
const WALTZ = [4, -1, 2, 3, 2, 1, 0, -1, 4, 6, -1, -1, 4, -1, 7, 6, 5, 4, 3, 1, 2, 0, -1, -1];
const WALTZ_LOW = [0, -1, 2, 3, -1, 1, 0, 6, -1, 4, -1, -1, 2, -1, 3, 1, 0, 6, 4, 3, 1, 0, -1, -1];
const WALTZ_BASS = [0, 5, 0, 7, 0, 3, 5, 7];
const NIGHT: Record<string, NightTheme> = {
  act1: { bpm: 72, root: 57, melody: WALTZ, bass: WALTZ_BASS, counter: 0, pulse: 0, warp: 0.002, vol: 0.9 },
  act2: { bpm: 76, root: 57, melody: WALTZ, bass: WALTZ_BASS, counter: 0.5, pulse: 0.25, warp: 0.004, vol: 0.95 },
  act3: { bpm: 80, root: 56, melody: WALTZ_LOW, bass: WALTZ_BASS, counter: 0.8, pulse: 0.55, warp: 0.008, vol: 1 },
  act4: { bpm: 86, root: 55, melody: WALTZ_LOW, bass: [0, 1, 0, 7, 0, 1, 6, 7], counter: 1, pulse: 0.8, warp: 0.012, vol: 1 },
  endless: { bpm: 90, root: 55, melody: WALTZ_LOW, bass: [0, 1, 0, 7, 0, 1, 6, 7], counter: 1, pulse: 1, warp: 0.015, vol: 1 },
};
/** Bradley's loop runs a touch faster as the Ringmaster sheds his skins. */
const BOSS_RATE: Record<string, number> = { boss_ringmaster_2: 1.03, boss_ringmaster_3: 1.06 };

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private musicFilter!: BiquadFilterNode;
  /** dips the whole music bus under quest chimes (separate from the volume setting) */
  private musicDuck!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private tracks: { intro?: AudioBuffer; loop?: AudioBuffer; loopStart: number; loopEnd: number } = { loopStart: 0, loopEnd: 0 };
  private trackSrc: AudioBufferSourceNode | null = null;
  private trackGain: GainNode | null = null;
  private currentTrack = '';
  private lastPlay = new Map<string, number>();
  private active = new Map<string, number>();
  private scoreTimer = 0;
  private score: NightTheme | null = null;
  private scoreGain: GainNode | null = null;
  private nextNote = 0;
  private step = 0;
  private ambSrc: AudioBufferSourceNode | null = null;
  private droneNodes: AudioNode[] = [];
  volumes = { master: 0.8, music: 0.7, sfx: 0.8, ambience: 0.6, muted: false };
  cue: Cue = 'silence';
  unlocked = false;
  private pickupCombo = 0;
  private pickupT = 0;

  /** Must be called from a user gesture (browser autoplay policy). Safe to call repeatedly. */
  async unlock(): Promise<void> {
    if (this.unlocked) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC() as AudioContext;
      const ctx = this.ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 20000;
      this.music = ctx.createGain();
      this.musicDuck = ctx.createGain();
      this.music.connect(this.musicDuck).connect(this.musicFilter).connect(this.master);
      this.sfx = ctx.createGain();
      this.sfx.connect(this.master);
      this.amb = ctx.createGain();
      this.amb.connect(this.master);
      this.unlocked = true;
      this.applyVolumes();
      this.buildSfx();
      this.loadTracks();
      this.startAmbience();
      const c = this.cue;
      this.cue = 'silence';
      this.setCue(c);
    } catch (e) {
      console.warn('audio unavailable', e);
    }
  }

  private buildSfx(): void {
    const ctx = this.ctx!;
    for (const [id, make] of Object.entries(RECIPES)) {
      const data = make();
      const buf = ctx.createBuffer(1, data.length, SR);
      buf.copyToChannel(data, 0);
      this.buffers.set(id, buf);
    }
  }

  private async loadTracks(): Promise<void> {
    const ctx = this.ctx!;
    const load = async (file: string) => {
      const res = await fetch(`${BASE}audio/${file}`);
      return await ctx.decodeAudioData(await res.arrayBuffer());
    };
    try {
      const [intro, loop] = await Promise.all([load('freaky_funk_circus_intro.mp3'), load('freaky_funky_circus_loop.mp3')]);
      this.tracks.intro = intro;
      this.tracks.loop = loop;
      // trim encoder padding/silence so the loop is seamless
      const d = loop.getChannelData(0);
      let s = 0, e = d.length - 1;
      while (s < d.length && Math.abs(d[s]) < 0.002) s++;
      while (e > s && Math.abs(d[e]) < 0.002) e--;
      this.tracks.loopStart = s / loop.sampleRate;
      this.tracks.loopEnd = e / loop.sampleRate;
      const c = this.cue;
      this.currentTrack = '';
      this.cue = 'silence';
      this.setCue(c);
    } catch (e) {
      console.warn('music failed to load', e);
    }
  }

  applyVolumes(): void {
    if (!this.unlocked) return;
    const v = this.volumes;
    const t = this.ctx!.currentTime;
    this.master.gain.setTargetAtTime(v.muted ? 0 : v.master, t, 0.05);
    this.music.gain.setTargetAtTime(v.music * 0.75, t, 0.05);
    this.sfx.gain.setTargetAtTime(v.sfx * 0.9, t, 0.05);
    this.amb.gain.setTargetAtTime(v.ambience * 0.5, t, 0.05);
  }

  // ---------------------------------------------------------------- SFX
  play(id: string, o: { vol?: number; pitch?: number; pan?: number } = {}): void {
    if (!this.unlocked || this.volumes.muted) return;
    const buf = this.buffers.get(id) ?? this.buffers.get(ALIASES[id] ?? 'pop');
    if (!buf) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    // throttle: per-id minimum interval and concurrency cap
    const minGap = THROTTLE[id] ?? 0.035;
    const last = this.lastPlay.get(id) ?? -1;
    if (now - last < minGap) return;
    const act = this.active.get(id) ?? 0;
    if (act >= (CONCURRENCY[id] ?? 6)) return;
    this.lastPlay.set(id, now);
    this.active.set(id, act + 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (o.pitch ?? 1) * (0.94 + Math.random() * 0.12);
    const g = ctx.createGain();
    g.gain.value = Math.min(1.5, o.vol ?? 0.6);
    let node: AudioNode = g;
    if (o.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      node = p;
    }
    node.connect(this.sfx);
    src.connect(g);
    src.onended = () => this.active.set(id, Math.max(0, (this.active.get(id) ?? 1) - 1));
    src.start();
  }

  /** Ticket pickup chime that climbs in pitch when collected in quick succession. */
  pickup(): void {
    const now = performance.now();
    if (now - this.pickupT > 400) this.pickupCombo = 0;
    this.pickupT = now;
    this.pickupCombo = Math.min(14, this.pickupCombo + 1);
    this.play('pickup', { vol: 0.35, pitch: 1 + this.pickupCombo * 0.045 });
  }

  // ---------------------------------------------------------------- music
  /**
   * Secret-quest chimes must be heard over the score: dip the music for `sec` seconds (it keeps
   * playing underneath and swells back). Repeated calls extend the dip.
   */
  duckMusic(sec = 2, level = 0.28): void {
    if (!this.unlocked) return;
    const g = this.musicDuck.gain, t = this.ctx!.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(level, t, 0.04);
    g.setTargetAtTime(1, t + sec, 0.45);
  }

  setCue(cue: Cue | string): void {
    const c = cue as Cue;
    if (c === this.cue) return;
    this.cue = c;
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const boss = c.startsWith('boss_');
    // Bradley Schwarz's "Freaky Funk Circus" scores the menus and the boss fights; the night between
    // bosses gets the quieter waltz, which darkens with each Act
    const night = NIGHT[c];
    if (night) this.startScore(night);
    else this.stopScore();
    if (c === 'menu' || c === 'results' || c === 'dawn') this.playTrack('intro', 1, 20000);
    else if (boss) this.playTrack('loop', BOSS_RATE[c] ?? 1, 20000);
    else if (night) this.fadeOutTrack(2);
    else if (c === 'silence') this.duckTrack(0);
    // dread drone grows with the Act (doc 02 §9: motifs bent darker as the night deepens)
    const dread = c === 'act2' ? 0.15 : c === 'act3' ? 0.28 : c === 'act4' ? 0.38 : c === 'endless' ? 0.4 : 0;
    this.setDrone(dread);
    void t;
  }

  private playTrack(which: 'intro' | 'loop', rate: number, cutoff: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.musicFilter.frequency.setTargetAtTime(cutoff, t, 0.8);
    if (this.currentTrack === which && this.trackSrc) {
      this.trackSrc.playbackRate.setTargetAtTime(rate, t, 0.5);
      this.trackGain!.gain.setTargetAtTime(1, t, 0.6);
      return;
    }
    const buf = which === 'intro' ? this.tracks.intro : this.tracks.loop;
    if (!buf) return;
    this.fadeOutTrack(1.2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (which === 'loop') {
      src.loop = true;
      src.loopStart = this.tracks.loopStart;
      src.loopEnd = this.tracks.loopEnd;
    } else {
      // the intro track flows into the loop for menus/results
      src.onended = () => {
        if (this.trackSrc === src && (this.cue === 'menu' || this.cue === 'results' || this.cue === 'dawn')) {
          this.currentTrack = '';
          this.playTrack('loop', 1, 20000);
        }
      };
    }
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(1, t, 0.4);
    src.connect(g).connect(this.music);
    src.start(t, which === 'loop' ? this.tracks.loopStart : 0);
    this.trackSrc = src;
    this.trackGain = g;
    this.currentTrack = which;
  }

  private duckTrack(level: number): void {
    if (!this.trackGain) return;
    this.trackGain.gain.setTargetAtTime(level, this.ctx!.currentTime, 0.5);
  }

  private fadeOutTrack(sec: number): void {
    if (!this.trackSrc || !this.trackGain) return;
    const t = this.ctx!.currentTime;
    const src = this.trackSrc;
    this.trackGain.gain.setTargetAtTime(0, t, sec / 4);
    try {
      src.stop(t + sec);
    } catch {
      /* already stopped */
    }
    this.trackSrc = null;
    this.trackGain = null;
    this.currentTrack = '';
  }

  // ---------------------------------------------------------------- procedural night score
  private startScore(theme: NightTheme): void {
    if (this.score === theme) return;
    const ctx = this.ctx!;
    if (!this.scoreGain) {
      this.scoreGain = ctx.createGain();
      this.scoreGain.connect(this.music);
    }
    this.scoreGain.gain.setTargetAtTime(0.85, ctx.currentTime, 0.8);
    const wasRunning = !!this.score;
    this.score = theme;
    if (!wasRunning) {
      this.nextNote = ctx.currentTime + 0.4;
      this.step = 0;
      window.clearInterval(this.scoreTimer);
      this.scoreTimer = window.setInterval(() => this.scheduler(), 25);
    }
  }

  private stopScore(): void {
    if (!this.score) return;
    this.score = null;
    window.clearInterval(this.scoreTimer);
    if (this.scoreGain) this.scoreGain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.6);
  }

  private scheduler(): void {
    const ctx = this.ctx;
    const th = this.score;
    if (!ctx || !th) return;
    const beat = 60 / th.bpm;
    while (this.nextNote < ctx.currentTime + 0.2) {
      this.scheduleNight(th, this.step, this.nextNote, beat);
      this.nextNote += beat;
      this.step++;
    }
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number, lp = 3000, vib = 0): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (vib) {
      const l = ctx.createOscillator();
      const lg = ctx.createGain();
      l.frequency.value = 5;
      lg.gain.value = freq * vib;
      l.connect(lg).connect(o.frequency);
      l.start(t);
      l.stop(t + dur + 0.05);
    }
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.scoreGain!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** A music-box tine: a bright pluck with a faint inharmonic overtone, ringing out. */
  private chime(freq: number, t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    for (const [mult, v] of [[1, 1], [2.76, 0.18]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (mult > 1 ? 0.35 : 1));
      o.connect(g).connect(this.scoreGain!);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }

  private heartbeat(t: number, vol: number): void {
    const ctx = this.ctx!;
    for (const [dt, v] of [[0, 1], [0.24, 0.6]] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(70, t + dt);
      o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.16);
      g.gain.setValueAtTime(vol * v, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.22);
      o.connect(g).connect(this.scoreGain!);
      o.start(t + dt);
      o.stop(t + dt + 0.25);
    }
  }

  private scheduleNight(th: NightTheme, step: number, t: number, beat: number): void {
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const inBar = step % 3;
    const bar = Math.floor(step / 3);
    const chord = th.root + th.bass[bar % th.bass.length];
    // a hushed oom-pah-pah: a low bowed note on the downbeat, a soft minor chord on two and three
    if (inBar === 0) {
      this.note(mtof(chord - 24), t, beat * 2.8, 'triangle', 0.15 * th.vol, 360);
      if (th.pulse) this.heartbeat(t, 0.3 * th.pulse);
    } else {
      for (const iv of [0, 3, 7]) this.note(mtof(chord - 12 + iv), t, beat * 0.6, 'triangle', 0.022 * th.vol, 1100);
    }
    // the music box carries the tune, a little out of tune, more so as the night deepens
    const deg = th.melody[step % th.melody.length];
    if (deg >= 0) {
      const semis = MINOR[deg % MINOR.length] + (deg >= MINOR.length ? 12 : 0);
      const f = mtof(th.root + 12 + semis) * (1 + (Math.random() - 0.5) * th.warp);
      this.chime(f, t, beat * 2.4, 0.09 * th.vol);
      if (th.counter) this.note(f * 0.502, t, beat * 0.95, 'square', 0.018 * th.counter * th.vol, 1500, 0.006 + th.warp);
    }
  }

  // ---------------------------------------------------------------- ambience & dread drone
  private startAmbience(): void {
    const ctx = this.ctx!;
    // 12 s loop: night wind + distant creaking + a faraway music-box carousel
    const len = 12 * SR;
    const buf = ctx.createBuffer(2, len, SR);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        const n = Math.random() * 2 - 1;
        lp += 0.02 * (n - lp);
        const gust = 0.5 + 0.5 * Math.sin(t * 0.5 + ch) * Math.sin(t * 0.21);
        d[i] = lp * 0.5 * gust;
      }
      // music box melody far away (minor)
      const mel = [76, 79, 83, 79, 76, 74, 76, 71, 72, 76, 79, 76, 74, 72, 71, -1];
      for (let k = 0; k < mel.length; k++) {
        if (mel[k] < 0) continue;
        const f = 440 * Math.pow(2, (mel[k] - 69) / 12) * 0.997;
        const st = Math.floor(k * 0.75 * SR);
        for (let i = 0; i < SR * 0.7 && st + i < len; i++) {
          const env = Math.exp(-i / (SR * 0.25));
          d[st + i] += Math.sin((2 * Math.PI * f * i) / SR) * env * 0.035 * (ch ? 0.8 : 1);
        }
      }
      // a warped calliope phrase, far off and slipping out of tune (wow & flutter)
      const cal = [67, 71, 74, 71, 67, 66, 67];
      for (let k = 0; k < cal.length; k++) {
        const st = Math.floor((5.2 + k * 0.42) * SR);
        const f0 = 440 * Math.pow(2, (cal[k] - 69) / 12);
        for (let i = 0; i < SR * 0.38 && st + i < len; i++) {
          const wow = 1 + 0.012 * Math.sin((i / SR) * 2 * Math.PI * 0.9 + k) - k * 0.004;
          const ph = (f0 * wow * i) / SR;
          const sq = (ph % 1) < 0.5 ? 1 : -1;
          const env = Math.min(1, i / (SR * 0.02)) * Math.exp(-i / (SR * 0.3));
          d[st + i] += sq * env * 0.012 * (ch ? 0.7 : 1);
        }
      }
      // groaning metal (the old rides settling) and a chain rattle
      for (const at of [0.8, 9.6]) {
        const st = Math.floor(at * SR);
        for (let i = 0; i < SR * 1.4 && st + i < len; i++) {
          const f = 48 + 10 * Math.sin(i / 2600) + 4 * Math.sin(i / 310);
          const env = Math.sin((Math.PI * i) / (SR * 1.4));
          d[st + i] += ((((f * i) / SR) % 1) * 2 - 1) * env * 0.035;
        }
      }
      for (let k = 0; k < 7; k++) {
        const st = Math.floor((3.6 + k * 0.07 + (k % 2) * 0.02) * SR);
        for (let i = 0; i < SR * 0.05 && st + i < len; i++) d[st + i] += (Math.random() * 2 - 1) * Math.exp(-i / (SR * 0.01)) * 0.06 * (ch ? 0.6 : 1);
      }
      // creaks
      for (const at of [2.3, 7.9]) {
        const st = Math.floor(at * SR);
        for (let i = 0; i < SR * 0.6; i++) {
          const f = 90 + 40 * Math.sin(i / 800);
          d[st + i] += Math.sin((2 * Math.PI * f * i) / SR) * 0.05 * Math.sin((Math.PI * i) / (SR * 0.6)) * (Math.random() < 0.5 ? 1 : 0.6);
        }
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.amb);
    src.start();
    this.ambSrc = src;
  }

  private droneGain: GainNode | null = null;
  private setDrone(level: number): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    if (!this.droneGain) {
      this.droneGain = ctx.createGain();
      this.droneGain.gain.value = 0;
      this.droneGain.connect(this.music);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 600;
      f.connect(this.droneGain);
      for (const fr of [55, 55.4, 82.4, 65.4]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = fr;
        const g = ctx.createGain();
        g.gain.value = 0.08;
        o.connect(g).connect(f);
        o.start();
        this.droneNodes.push(o);
      }
      // theremin-like wail
      const th = ctx.createOscillator();
      th.type = 'sine';
      th.frequency.value = 660;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lg = ctx.createGain();
      lg.gain.value = 220;
      lfo.connect(lg).connect(th.frequency);
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.5;
      const vg = ctx.createGain();
      vg.gain.value = 9;
      vib.connect(vg).connect(th.frequency);
      const tg = ctx.createGain();
      tg.gain.value = 0.025;
      th.connect(tg).connect(this.droneGain);
      th.start();
      lfo.start();
      vib.start();
      this.droneNodes.push(th, lfo, vib);
    }
    this.droneGain.gain.setTargetAtTime(level, ctx.currentTime, 2);
  }

  /** Duck everything briefly (pause menu muffles the music). */
  setPausedFilter(paused: boolean): void {
    if (!this.unlocked) return;
    this.musicFilter.frequency.setTargetAtTime(paused ? 700 : 20000, this.ctx!.currentTime, 0.2);
    if (this.scoreGain) this.scoreGain.gain.setTargetAtTime(paused ? 0.25 : this.score ? 0.85 : 0, this.ctx!.currentTime, 0.2);
  }
}

const ALIASES: Record<string, string> = {
  springs: 'springs', stuffing: 'stuffing', bonk: 'bonk', slide: 'slide', splash: 'splash', wood: 'wood', ceramic: 'ceramic',
  crumple: 'crumple', boards: 'boards', derail: 'derail', brute: 'brute', snap: 'snap',
};

const THROTTLE: Record<string, number> = {
  pop: 0.03, squeak: 0.05, card: 0.06, popcorn: 0.025, crackle: 0.05, whack: 0.06, dart: 0.05, pickup: 0.025, bite: 0.07, pew: 0.06,
  rocket: 0.05, stomp: 0.08, boom: 0.06, honk: 0.25, clank: 0.05, hurt: 0.12, frost: 0.1, flame: 0.1, spray: 0.1, ringtoss: 0.08,
};
const CONCURRENCY: Record<string, number> = { pop: 8, popcorn: 6, crackle: 5, pickup: 6, boom: 4, stomp: 3, roar: 2, warning: 1, demon: 1 };
