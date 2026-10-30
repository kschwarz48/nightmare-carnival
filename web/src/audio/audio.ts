// Web Audio engine (doc 02 §9). Buses: master → music / sfx / ambience / ui. The original score
// ("Freaky Funk Circus" by Bradley Schwarz) plays on the menu and through the night, darkening per
// Act; each boss gets a procedurally sequenced big-band theme; SFX are synthesized at boot.

import { RECIPES, SR } from './synth';

type Cue = 'menu' | 'act1' | 'act2' | 'act3' | 'act4' | 'boss_carnival_tent' | 'boss_ferris_wheel' | 'boss_puppet_king' | 'boss_ringmaster' | 'boss_ringmaster_2' | 'boss_ringmaster_3' | 'dawn' | 'endless' | 'silence' | 'results';

const BASE = import.meta.env.BASE_URL ?? './';

interface BossTheme {
  bpm: number;
  root: number; // MIDI note of tonic
  motif: number[]; // scale degrees for the calliope melody (-1 = rest)
  bass: number[]; // semitone offsets from root per beat
  stabs: number[]; // eighth-note positions (0..7) of brass stabs per bar
  intensity: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 11, 12, 14, 15];
const THEMES: Record<string, BossTheme> = {
  boss_carnival_tent: { bpm: 138, root: 45, motif: [0, 2, 4, 2, 5, 4, 2, -1, 0, 2, 4, 7, 6, 4, 5, -1], bass: [0, 7, 0, 7, 5, 12, 5, 7], stabs: [1, 3, 6], intensity: 0.8 },
  boss_ferris_wheel: { bpm: 150, root: 43, motif: [4, 3, 2, 1, 0, 1, 2, 4, 5, 4, 3, 2, 1, 2, 0, -1], bass: [0, 7, 3, 7, 5, 12, 7, 11], stabs: [0, 3, 5, 7], intensity: 0.9 },
  boss_puppet_king: { bpm: 126, root: 41, motif: [0, -1, 0, 3, 2, -1, 1, 0, 4, -1, 4, 6, 5, -1, 4, 2], bass: [0, 0, 7, 7, 3, 3, 7, 11], stabs: [2, 6], intensity: 0.85 },
  boss_ringmaster: { bpm: 146, root: 40, motif: [0, 4, 7, 4, 6, 4, 2, 4, 0, 4, 7, 8, 7, 6, 4, -1], bass: [0, 7, 0, 7, 3, 10, 5, 11], stabs: [1, 3, 5, 7], intensity: 1 },
  boss_ringmaster_2: { bpm: 158, root: 40, motif: [7, 6, 4, 6, 7, 8, 7, 4, 2, 4, 6, 4, 2, 1, 0, -1], bass: [0, 7, 3, 7, 5, 12, 7, 11], stabs: [0, 2, 3, 5, 7], intensity: 1.1 },
  boss_ringmaster_3: { bpm: 172, root: 39, motif: [0, 1, 0, 6, 0, 1, 2, 1, 0, 7, 6, 4, 6, 7, 8, 9], bass: [0, 1, 0, 7, 0, 1, 6, 7], stabs: [0, 1, 3, 4, 6, 7], intensity: 1.25 },
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private buffers = new Map<string, AudioBuffer>();
  private tracks: { intro?: AudioBuffer; loop?: AudioBuffer; loopStart: number; loopEnd: number } = { loopStart: 0, loopEnd: 0 };
  private trackSrc: AudioBufferSourceNode | null = null;
  private trackGain: GainNode | null = null;
  private currentTrack = '';
  private lastPlay = new Map<string, number>();
  private active = new Map<string, number>();
  private bossTimer = 0;
  private bossTheme: BossTheme | null = null;
  private bossGain: GainNode | null = null;
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
      this.music.connect(this.musicFilter).connect(this.master);
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
  setCue(cue: Cue | string): void {
    const c = cue as Cue;
    if (c === this.cue) return;
    this.cue = c;
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const boss = c.startsWith('boss_');
    // boss score
    if (boss) this.startBoss(c);
    else this.stopBoss();
    // main track routing
    if (c === 'menu' || c === 'results') this.playTrack('intro', 1, 20000);
    else if (c === 'act1') this.playTrack('loop', 1, 20000);
    else if (c === 'act2') this.playTrack('loop', 0.985, 9000);
    else if (c === 'act3') this.playTrack('loop', 0.97, 6500);
    else if (c === 'act4') this.playTrack('loop', 1.045, 12000);
    else if (c === 'endless') this.playTrack('loop', 1.08, 14000);
    else if (c === 'dawn') this.playTrack('intro', 1, 20000);
    else if (boss) this.duckTrack(0.12);
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

  // ---------------------------------------------------------------- procedural boss score
  private startBoss(cue: string): void {
    const theme = THEMES[cue] ?? THEMES.boss_carnival_tent;
    if (this.bossTheme === theme) return;
    const ctx = this.ctx!;
    if (!this.bossGain) {
      this.bossGain = ctx.createGain();
      this.bossGain.connect(this.music);
    }
    this.bossGain.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
    const wasRunning = !!this.bossTheme;
    this.bossTheme = theme;
    if (!wasRunning) {
      this.nextNote = ctx.currentTime + 0.1;
      this.step = 0;
      window.clearInterval(this.bossTimer);
      this.bossTimer = window.setInterval(() => this.scheduler(), 25);
    }
  }

  private stopBoss(): void {
    if (!this.bossTheme) return;
    this.bossTheme = null;
    window.clearInterval(this.bossTimer);
    if (this.bossGain) this.bossGain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.6);
  }

  private scheduler(): void {
    const ctx = this.ctx;
    const th = this.bossTheme;
    if (!ctx || !th) return;
    const eighth = 60 / th.bpm / 2;
    while (this.nextNote < ctx.currentTime + 0.15) {
      this.scheduleStep(th, this.step, this.nextNote, eighth);
      this.nextNote += eighth;
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
      l.frequency.value = 6;
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
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.bossGain!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private drum(t: number, kind: 'kick' | 'snare' | 'hat', vol: number): void {
    const ctx = this.ctx!;
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(this.bossGain!);
      o.start(t);
      o.stop(t + 0.2);
      return;
    }
    const buf = this.buffers.get(kind === 'snare' ? 'throw' : 'dart');
    if (!buf) return;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = kind === 'snare' ? 0.8 : 1.6;
    const g = ctx.createGain();
    g.gain.value = vol;
    s.connect(g).connect(this.bossGain!);
    s.start(t);
  }

  private scheduleStep(th: BossTheme, step: number, t: number, eighth: number): void {
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const inBar = step % 8;
    const bar = Math.floor(step / 8);
    const I = th.intensity;
    // oompah: tuba bass on the beat, chord "pah" on the off-beat
    if (inBar % 2 === 0) {
      const off = th.bass[(bar * 4 + inBar / 2) % th.bass.length];
      this.note(mtof(th.root - 12 + off), t, eighth * 1.6, 'sawtooth', 0.22 * I, 420);
      this.drum(t, 'kick', 0.5 * I);
    } else {
      for (const iv of [12, 15, 19]) this.note(mtof(th.root + iv), t, eighth * 0.7, 'square', 0.035 * I, 1800);
      this.drum(t, 'hat', 0.25 * I);
    }
    if (inBar === 2 || inBar === 6) this.drum(t, 'snare', 0.5 * I);
    // brass stabs
    if (th.stabs.includes(inBar) && bar % 2 === 1) for (const iv of [0, 3, 7, 10]) this.note(mtof(th.root + 12 + iv), t, eighth * 0.9, 'sawtooth', 0.05 * I, 2600);
    // calliope melody (detuned, vibrato) — the warped carnival voice
    const deg = th.motif[(step) % th.motif.length];
    if (deg >= 0) {
      const semis = MINOR[deg % MINOR.length] + (deg >= MINOR.length ? 12 : 0);
      this.note(mtof(th.root + 24 + semis), t, eighth * 0.95, 'square', 0.06 * I, 3200, 0.012);
      this.note(mtof(th.root + 24 + semis) * 1.006, t, eighth * 0.95, 'triangle', 0.04 * I, 4000);
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
    this.musicFilter.frequency.setTargetAtTime(paused ? 700 : this.cue === 'act2' ? 9000 : this.cue === 'act3' ? 6500 : 20000, this.ctx!.currentTime, 0.2);
    if (this.bossGain) this.bossGain.gain.setTargetAtTime(paused ? 0.25 : this.bossTheme ? 0.9 : 0, this.ctx!.currentTime, 0.2);
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
