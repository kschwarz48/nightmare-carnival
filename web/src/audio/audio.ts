// Web Audio engine (doc 02 §9). Buses: master → music / sfx / ambience / ui. The original score
// ("Freaky Funk Circus" by Bradley Schwarz) plays on the title menus and through every boss fight; the
// night between bosses gets a quieter procedural music-box waltz that darkens with each Act (D-55), and
// the Midway hub a hushed, broken carousel waltz of its own (D-61), and the Fun House a waltz that runs
// backwards over glass harmonics, with an indoor ambience of its own (D-63), and the Boardwalk a slow
// detuned seaside waltz with a bell buoy tolling under it, over three ambiences that crossfade with where
// the listener stands: the promenade, the beach, the pier (D-68); the Ghost Train's night Bradley's second
// song, "CircularCus" (D-81; a lonely railway waltz over the clack of the rail joints stands in if it can't
// load), over two ambiences, the stations' night and the carriages' rattle, that crossfade as you board and
// alight (D-80). Quest chimes dip the music so they always carry. SFX are synthesized at boot.

import { RECIPES, SR } from './synth';
import { LEGACY } from '../core/flags';

type Cue = 'menu' | 'midway' | 'act1' | 'act2' | 'act3' | 'act4' | 'boss_carnival_tent' | 'boss_ferris_wheel' | 'boss_puppet_king' | 'boss_ringmaster' | 'boss_ringmaster_2' | 'boss_ringmaster_3' | 'dawn' | 'endless' | 'silence' | 'results';

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
  /** 0..1: glass harmonics ringing high over the chords (the Fun House) */
  glass?: number;
  /** 0..1: a bell buoy tolling low every few bars, and the sea breathing under the chords (the Boardwalk) */
  buoy?: number;
  /** 0..1: the clack of wheels over the rail joints, and a whistle far down the line (the Ghost Train) */
  rails?: number;
}

const MINOR = [0, 2, 3, 5, 7, 8, 11, 12, 14, 15];
const WALTZ = [4, -1, 2, 3, 2, 1, 0, -1, 4, 6, -1, -1, 4, -1, 7, 6, 5, 4, 3, 1, 2, 0, -1, -1];
const WALTZ_LOW = [0, -1, 2, 3, -1, 1, 0, 6, -1, 4, -1, -1, 2, -1, 3, 1, 0, 6, 4, 3, 1, 0, -1, -1];
const WALTZ_BASS = [0, 5, 0, 7, 0, 3, 5, 7];
/** The Midway's tune: a slow, lilting carousel phrase that keeps leaning on the leading tone. */
const MIDWAY = [4, -1, 3, 2, 1, 0, 6, -1, -1, 0, -1, 4, 7, 6, 5, 4, -1, 3, 2, 6, 1, 0, -1, -1];
const MIDWAY_BASS = [0, 5, 7, 0, 8, 5, 7, 0];
/** The Fun House (D-63): the night's waltz played backwards, over a bass line that won't resolve. */
const BACKWARDS = [...WALTZ].reverse();
const BACKWARDS_LOW = [...WALTZ_LOW].reverse();
const HOUSE_BASS = [0, 8, 5, 1, 0, 8, 6, 7];
/** The Boardwalk (D-68): a seaside waltz that rises like a swell and falls back, never quite landing. */
const SEASIDE = [0, -1, 2, 4, -1, 3, 2, -1, 1, 0, -1, -1, 4, -1, 5, 7, -1, 6, 4, 3, 2, 1, -1, -1];
const SEASIDE_LOW = [0, -1, 1, 2, -1, 0, 6, -1, 4, 3, -1, -1, 2, -1, 3, 4, -1, 2, 1, 0, 6, 4, -1, -1];
const SHORE_BASS = [0, 5, 3, 7, 0, 8, 5, 7];
/** The Ghost Train (D-80): a railway waltz that keeps leaving the station, falling a step every phrase. */
const LINE = [4, -1, 3, 4, -1, 2, 1, -1, 0, -1, 6, -1, 2, -1, 3, 2, 1, -1, 0, 6, 4, -1, -1, -1];
const LINE_LOW = [0, -1, 6, 0, -1, 4, 3, -1, 2, -1, 1, -1, 0, -1, 1, 0, 6, -1, 4, 3, 2, -1, -1, -1];
const LINE_BASS = [0, 8, 5, 7, 0, 3, 8, 7];
const NIGHT: Record<string, NightTheme> = {
  act1: { bpm: 72, root: 57, melody: WALTZ, bass: WALTZ_BASS, counter: 0, pulse: 0, warp: 0.002, vol: 0.9 },
  act2: { bpm: 76, root: 57, melody: WALTZ, bass: WALTZ_BASS, counter: 0.5, pulse: 0.25, warp: 0.004, vol: 0.95 },
  act3: { bpm: 80, root: 56, melody: WALTZ_LOW, bass: WALTZ_BASS, counter: 0.8, pulse: 0.55, warp: 0.008, vol: 1 },
  act4: { bpm: 86, root: 55, melody: WALTZ_LOW, bass: [0, 1, 0, 7, 0, 1, 6, 7], counter: 1, pulse: 0.8, warp: 0.012, vol: 1 },
  endless: { bpm: 90, root: 55, melody: WALTZ_LOW, bass: [0, 1, 0, 7, 0, 1, 6, 7], counter: 1, pulse: 1, warp: 0.015, vol: 1 },
  // the Midway (D-61): quieter and slower than any night, the music box further out of tune, a faint
  // calliope trailing it, no heartbeat
  midway: { bpm: 58, root: 57, melody: MIDWAY, bass: MIDWAY_BASS, counter: 0.35, pulse: 0, warp: 0.009, vol: 0.55 },
  // the Fun House (D-63): slower, a semitone lower, more out of tune, glass ringing over it
  fh_act1: { bpm: 66, root: 56, melody: BACKWARDS, bass: HOUSE_BASS, counter: 0.25, pulse: 0, warp: 0.006, vol: 0.85, glass: 0.6 },
  fh_act2: { bpm: 70, root: 56, melody: BACKWARDS, bass: HOUSE_BASS, counter: 0.55, pulse: 0.2, warp: 0.009, vol: 0.9, glass: 0.75 },
  fh_act3: { bpm: 74, root: 55, melody: BACKWARDS_LOW, bass: HOUSE_BASS, counter: 0.8, pulse: 0.5, warp: 0.013, vol: 0.95, glass: 0.9 },
  fh_act4: { bpm: 80, root: 54, melody: BACKWARDS_LOW, bass: [0, 1, 8, 7, 0, 1, 6, 7], counter: 1, pulse: 0.8, warp: 0.018, vol: 1, glass: 1 },
  fh_endless: { bpm: 84, root: 54, melody: BACKWARDS_LOW, bass: [0, 1, 8, 7, 0, 1, 6, 7], counter: 1, pulse: 1, warp: 0.02, vol: 1, glass: 1 },
  // the Boardwalk (D-68): slow, low, further out of tune than the first night; the buoy tolls under it
  bw_act1: { bpm: 64, root: 55, melody: SEASIDE, bass: SHORE_BASS, counter: 0.2, pulse: 0, warp: 0.007, vol: 0.85, buoy: 0.7 },
  bw_act2: { bpm: 68, root: 55, melody: SEASIDE, bass: SHORE_BASS, counter: 0.5, pulse: 0.2, warp: 0.01, vol: 0.9, buoy: 0.8 },
  bw_act3: { bpm: 72, root: 54, melody: SEASIDE_LOW, bass: SHORE_BASS, counter: 0.8, pulse: 0.5, warp: 0.014, vol: 0.95, buoy: 0.9 },
  bw_act4: { bpm: 78, root: 53, melody: SEASIDE_LOW, bass: [0, 1, 3, 7, 0, 1, 6, 7], counter: 1, pulse: 0.8, warp: 0.018, vol: 1, buoy: 1 },
  bw_endless: { bpm: 82, root: 53, melody: SEASIDE_LOW, bass: [0, 1, 3, 7, 0, 1, 6, 7], counter: 1, pulse: 1, warp: 0.02, vol: 1, buoy: 1 },
  // the Ghost Train (D-80): a little faster than the Boardwalk, the rails under it, the whistle far off
  gt_act1: { bpm: 70, root: 54, melody: LINE, bass: LINE_BASS, counter: 0.25, pulse: 0, warp: 0.006, vol: 0.85, rails: 0.7 },
  gt_act2: { bpm: 74, root: 54, melody: LINE, bass: LINE_BASS, counter: 0.5, pulse: 0.2, warp: 0.009, vol: 0.9, rails: 0.8 },
  gt_act3: { bpm: 78, root: 53, melody: LINE_LOW, bass: LINE_BASS, counter: 0.8, pulse: 0.5, warp: 0.013, vol: 0.95, rails: 0.9 },
  gt_act4: { bpm: 84, root: 52, melody: LINE_LOW, bass: [0, 1, 8, 7, 0, 1, 6, 7], counter: 1, pulse: 0.8, warp: 0.017, vol: 1, rails: 1 },
  gt_endless: { bpm: 88, root: 52, melody: LINE_LOW, bass: [0, 1, 8, 7, 0, 1, 6, 7], counter: 1, pulse: 1, warp: 0.02, vol: 1, rails: 1 },
};
/** Bradley's song (one file since his 2026-10-30 mix): menus play it from the top, then loop from the groove. */
const SONG = 'freaky_funky_circus.mp3';
/** where the song's main groove starts (s): the menus' loop returns here */
const SONG_GROOVE = 11.98;
/** the new mix is mastered ~2.2 dB louder (-9.7 LUFS) than the old files (-12 LUFS): sit it at their level */
const SONG_GAIN = 0.78;
/** Bradley's loop runs a touch faster as the Ringmaster sheds his skins. */
const BOSS_RATE: Record<string, number> = { boss_ringmaster_2: 1.03, boss_ringmaster_3: 1.06 };
/**
 * Bradley's second song, the Ghost Train's night (D-81): between the bosses there it plays from its first note
 * in place of the railway waltz, and at its end, after a breath, from the top again (it has an intro and fades
 * out, so it repeats whole). Boss fights keep "Freaky Funk Circus". Fetched only once a night needs it or the
 * map is open to the player; the waltz stands in if it can't load.
 */
const LINE_SONG = 'circular_cus.mp3';
/** mastered at -12.8 LUFS, about 1 dB under the boss song as it plays (-9.7 LUFS at SONG_GAIN): left as mixed */
const LINE_SONG_GAIN = 1;
/** the pause between one play-through's last note and the next one's first (s) */
const LINE_BREATH = 1;
/** the cues it plays on: every Act of the Ghost Train's night, and the endless night after its dawn */
const LINE_CUE = /^gt_(act[1-4]|endless)$/;

/** A track's last sound (s), past the encoder's tail of silence. */
function lastSound(buf: AudioBuffer): number {
  const d = buf.getChannelData(0);
  let e = d.length - 1;
  while (e > 0 && Math.abs(d[e]) < 0.002) e--;
  return e / buf.sampleRate;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private musicFilter!: BiquadFilterNode;
  /** dips the whole music bus under quest chimes (separate from the volume setting) */
  private musicDuck!: GainNode;
  /**
   * the hush (D-79): each bus's own dip while one sound must be heard alone (the Gala Queen's call), and the
   * bus that sound plays on, above it
   */
  private hushM!: GainNode;
  private hushS!: GainNode;
  private hushA!: GainNode;
  private spot!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  /** samples the synth worker has rendered before audio unlocked (see prewarm) */
  private rendered = new Map<string, Float32Array>();
  private synthWorker: Worker | null = null;
  private synthDone = false;
  private tracks: { intro?: AudioBuffer; loop?: AudioBuffer; loopStart: number; loopEnd: number } = { loopStart: 0, loopEnd: 0 };
  private trackSrc: AudioBufferSourceNode | null = null;
  private trackGain: GainNode | null = null;
  private currentTrack = '';
  /** a boss fight's play-through of Bradley's song is under way: it runs to its end before anything else plays */
  private bossSong = false;
  /** the Ghost Train's song (D-81) and its last sound (s); 'wanted' waits for audio to unlock */
  private line: AudioBuffer | null = null;
  private lineEnd = 0;
  private lineState: 'none' | 'wanted' | 'loading' | 'ready' | 'failed' = 'none';
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
      this.hushM = ctx.createGain();
      this.hushS = ctx.createGain();
      this.hushA = ctx.createGain();
      this.music.connect(this.musicDuck).connect(this.musicFilter).connect(this.hushM).connect(this.master);
      this.sfx = ctx.createGain();
      this.sfx.connect(this.hushS).connect(this.master);
      this.amb = ctx.createGain();
      this.amb.connect(this.hushA).connect(this.master);
      this.spot = ctx.createGain();
      this.spot.connect(this.master);
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

  /**
   * Start rendering the sound effects in a worker at boot (engineering optimization pass), so audio
   * unlocking on the first key press only has to wrap finished samples. Without workers (or if the
   * worker fails) the effects are synthesized on unlock, as before.
   */
  prewarm(): void {
    if (this.synthWorker || this.unlocked || typeof Worker === 'undefined' || LEGACY.workers) return;
    try {
      const w = new Worker(new URL('./synthWorker.ts', import.meta.url), { type: 'module' });
      this.synthWorker = w;
      w.onmessage = (e: MessageEvent<{ id?: string; data?: Float32Array; done?: boolean }>) => {
        const m = e.data;
        if (m.done) {
          this.synthDone = true;
          w.terminate();
          return;
        }
        if (m.id && m.data) this.rendered.set(m.id, m.data);
      };
      w.onerror = () => {
        w.terminate();
        this.synthWorker = null;
      };
      w.postMessage('go');
    } catch {
      this.synthWorker = null;
    }
  }

  private wrap(id: string, data: Float32Array): void {
    const buf = this.ctx!.createBuffer(1, data.length, SR);
    buf.copyToChannel(data, 0);
    this.buffers.set(id, buf);
  }

  private buildSfx(): void {
    // the worker's samples are wrapped one by one when first played (see sample)
    if (this.synthWorker || this.synthDone) return;
    for (const [id, make] of Object.entries(RECIPES)) this.wrap(id, make());
  }

  /** A sound's buffer, wrapping the worker's samples on first use. */
  private sample(id: string): AudioBuffer | undefined {
    const b = this.buffers.get(id);
    if (b || !this.ctx) return b;
    const d = this.rendered.get(id);
    if (!d) return undefined;
    this.rendered.delete(id);
    this.wrap(id, d);
    return this.buffers.get(id);
  }

  private async fetchTrack(file: string): Promise<AudioBuffer> {
    const res = await fetch(`${BASE}audio/${file}`);
    return await this.ctx!.decodeAudioData(await res.arrayBuffer());
  }

  private async loadTracks(): Promise<void> {
    try {
      const song = await this.fetchTrack(SONG);
      this.tracks.intro = song;
      this.tracks.loop = song;
      // loop from the groove to the last sound (trimming the encoder's tail of silence)
      const end = lastSound(song);
      this.tracks.loopStart = Math.min(SONG_GROOVE, end / 2);
      this.tracks.loopEnd = end;
      const c = this.cue;
      this.currentTrack = '';
      this.cue = 'silence';
      this.setCue(c);
    } catch (e) {
      console.warn('music failed to load', e);
    }
    // the Ghost Train's song, if it was asked for before audio unlocked, after the menus' song
    if (this.lineState === 'wanted') this.loadLineSong();
  }

  /**
   * Fetch the Ghost Train's song (D-81) unless it's already here or on its way. Safe to call any time: before
   * audio unlocks it only notes the wish. A night that was waiting for it hears it as soon as it arrives (or,
   * if it can't be had, the railway waltz).
   */
  loadLineSong(): void {
    if (this.lineState === 'none') this.lineState = 'wanted';
    if (this.lineState !== 'wanted' || !this.unlocked) return;
    this.lineState = 'loading';
    this.fetchTrack(LINE_SONG)
      .then(
        (buf) => {
          this.line = buf;
          this.lineEnd = lastSound(buf);
          this.lineState = 'ready';
        },
        (e) => {
          console.warn('the Ghost Train song failed to load', e);
          this.lineState = 'failed';
        },
      )
      .then(() => {
        if (LINE_CUE.test(this.cue) && !this.bossSong) this.applyCue(this.cue);
      });
  }

  applyVolumes(): void {
    if (!this.unlocked) return;
    const v = this.volumes;
    const t = this.ctx!.currentTime;
    this.master.gain.setTargetAtTime(v.muted ? 0 : v.master, t, 0.05);
    this.music.gain.setTargetAtTime(v.music * 0.75, t, 0.05);
    this.sfx.gain.setTargetAtTime(v.sfx * 0.9, t, 0.05);
    this.spot.gain.setTargetAtTime(v.sfx * 0.9, t, 0.05);
    this.amb.gain.setTargetAtTime(v.ambience * 0.5, t, 0.05);
  }

  // ---------------------------------------------------------------- SFX
  /** `spot`: on the bus above the hush (see `spotlight`), so it is heard while everything else is low. */
  play(id: string, o: { vol?: number; pitch?: number; pan?: number; spot?: boolean } = {}): void {
    if (!this.unlocked || this.volumes.muted) return;
    const buf = this.sample(id) ?? this.sample(ALIASES[id] ?? 'pop');
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
    node.connect(o.spot ? this.spot : this.sfx);
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

  /**
   * One sound must be heard alone (D-79: the Gala Queen's call sign could not be made out over a fight):
   * the music, the effects and the ambience all sink to `level` for `sec` seconds while sounds played with
   * `spot` ride above them, then everything swells back. A call during a hush extends it.
   */
  spotlight(sec: number, level = 0.06): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    for (const n of [this.hushM, this.hushS, this.hushA]) {
      const g = n.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.setTargetAtTime(level, t, 0.08);
      g.setTargetAtTime(1, t + sec, 0.5);
    }
  }

  setCue(cue: Cue | string): void {
    const c = cue as Cue;
    if (c === this.cue) return;
    this.cue = c;
    if (!this.unlocked) return;
    this.applyCue(c);
  }

  /**
   * Bradley Schwarz's "Freaky Funk Circus" scores the title menus and the boss fights; the night between
   * bosses gets the quieter waltz, which darkens with each Act; the Midway its own hush.
   *
   * A boss fight (D-70) starts the song from the top and lets it play all the way through, even if the boss
   * falls first: cues that arrive meanwhile (the next Act, a boss warning, dawn, the results) wait for its
   * end, and only then does their music come in. A fight that outlasts the song hears it again from the top;
   * a boss that arrives while it is still playing out keeps it going rather than cutting it off.
   *
   * The Ghost Train's night (D-81) is Bradley's second song instead of a waltz, under the same rules: a boss
   * cuts it for the boss song, and it comes back from its first note once that has played out.
   */
  private applyCue(c: Cue): void {
    const boss = c.startsWith('boss_');
    if (this.bossSong && this.trackSrc) {
      // mid play-through: a boss's phase may quicken it; everything else waits for the song's end
      if (boss) this.trackSrc.playbackRate.setTargetAtTime(BOSS_RATE[c] ?? 1, this.ctx!.currentTime, 0.5);
      return;
    }
    const line = LINE_CUE.test(c) && this.lineState !== 'failed';
    const night = line ? undefined : NIGHT[c];
    if (night) this.startScore(night);
    else this.stopScore();
    if (c === 'menu' || c === 'results' || c === 'dawn') this.playTrack('intro', 1, 20000);
    else if (boss) this.playBossSong(BOSS_RATE[c] ?? 1);
    else if (line) this.playLineSong();
    else if (night) this.fadeOutTrack(2);
    else if (c === 'silence') this.duckTrack(0);
    // dread drone grows with the Act (doc 02 §9: motifs bent darker as the night deepens); Bradley's songs play clean
    const act = c.replace('fh_', '').replace('bw_', '').replace('gt_', '');
    const dread = line ? 0 : act === 'act2' ? 0.15 : act === 'act3' ? 0.28 : act === 'act4' ? 0.38 : act === 'endless' ? 0.4 : 0;
    this.setDrone(dread);
  }

  /**
   * The Ghost Train's song (D-81) from its first note, at `when` (audio time; now if earlier); at its end, while
   * the night still wants it, a breath and then from the top again. Already playing (perhaps hushed for a
   * boss's warning), it carries on and comes back up. Not here yet: whatever else plays fades out, and the
   * song comes in when it arrives (see loadLineSong).
   */
  private playLineSong(when = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    if (this.currentTrack === 'line' && this.trackSrc) {
      this.trackGain!.gain.setTargetAtTime(LINE_SONG_GAIN, t, 0.6);
      return;
    }
    const buf = this.line;
    if (!buf) {
      this.fadeOutTrack(2);
      this.loadLineSong();
      return;
    }
    this.fadeOutTrack(1.2);
    const at = Math.max(t, when);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(LINE_SONG_GAIN, at, 0.05);
    src.connect(g).connect(this.music);
    src.onended = () => {
      if (this.trackSrc !== src) return;
      this.trackSrc = null;
      this.trackGain = null;
      this.currentTrack = '';
      if (LINE_CUE.test(this.cue)) this.playLineSong(ctx.currentTime + LINE_BREATH);
    };
    src.start(at, 0, this.lineEnd);
    this.trackSrc = src;
    this.trackGain = g;
    this.currentTrack = 'line';
  }

  /** The song from its first note, once through; at its end, whatever the night has moved on to plays. */
  private playBossSong(rate: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.musicFilter.frequency.setTargetAtTime(20000, t, 0.8);
    const buf = this.tracks.intro;
    if (!buf) return;
    this.fadeOutTrack(0.6);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    if (src.detune) src.detune.value = this.tierDetune;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(SONG_GAIN, t, 0.05);
    src.connect(g).connect(this.music);
    src.onended = () => {
      if (this.trackSrc !== src) return;
      this.trackSrc = null;
      this.trackGain = null;
      this.currentTrack = '';
      this.bossSong = false;
      // still fighting: from the top again; otherwise the music the night has moved on to
      this.applyCue(this.cue);
    };
    src.start(t, 0);
    this.trackSrc = src;
    this.trackGain = g;
    this.currentTrack = 'boss';
    this.bossSong = true;
  }

  /**
   * A new night starts on its own music: cut a boss song still playing out from the last one (and the Ghost
   * Train's song, so a new night there hears it from its first note).
   */
  endBossSong(): void {
    if (!this.bossSong && this.currentTrack !== 'line') return;
    this.fadeOutTrack(1.5);
    // whatever is cued next is applied fresh, even if it matches the last cue
    this.cue = 'silence';
  }

  private playTrack(which: 'intro' | 'loop', rate: number, cutoff: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.musicFilter.frequency.setTargetAtTime(cutoff, t, 0.8);
    if (this.currentTrack === which && this.trackSrc) {
      this.trackSrc.playbackRate.setTargetAtTime(rate, t, 0.5);
      this.trackGain!.gain.setTargetAtTime(SONG_GAIN, t, 0.6);
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
      // menus/results play the song from the top, then loop it from the groove
      src.onended = () => {
        if (this.trackSrc === src && (this.cue === 'menu' || this.cue === 'results' || this.cue === 'dawn')) {
          this.currentTrack = '';
          this.playTrack('loop', 1, 20000);
        }
      };
    }
    src.playbackRate.value = rate;
    if (src.detune) src.detune.value = this.tierDetune;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(SONG_GAIN, t, 0.4);
    src.connect(g).connect(this.music);
    src.start(t, which === 'loop' ? this.tracks.loopStart : 0);
    this.trackSrc = src;
    this.trackGain = g;
    this.currentTrack = which;
  }

  // (both drop a swell still scheduled, e.g. the Ghost Train's song coming back in after its breath)
  private duckTrack(level: number): void {
    if (!this.trackGain) return;
    const t = this.ctx!.currentTime;
    this.trackGain.gain.cancelScheduledValues(t);
    this.trackGain.gain.setTargetAtTime(level, t, 0.5);
  }

  private fadeOutTrack(sec: number): void {
    if (!this.trackSrc || !this.trackGain) return;
    const t = this.ctx!.currentTime;
    const src = this.trackSrc;
    this.trackGain.gain.cancelScheduledValues(t);
    this.trackGain.gain.setTargetAtTime(0, t, sec / 4);
    try {
      src.stop(t + sec);
    } catch {
      /* already stopped */
    }
    this.trackSrc = null;
    this.trackGain = null;
    this.currentTrack = '';
    this.bossSong = false;
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

  // ---------------------------------------------------------------- the world tiers' score (D-97)
  /** the night's tier colours the music: Nightmare a semitone lower and drifting out of tune, Hell two lower */
  private tierPitch = 1;
  private tierWobble = 0;
  private tierDetune = 0;
  setTier(tier: 'normal' | 'nightmare' | 'hell'): void {
    this.tierDetune = tier === 'hell' ? -200 : tier === 'nightmare' ? -100 : 0;
    this.tierPitch = Math.pow(2, this.tierDetune / 1200);
    this.tierWobble = tier === 'nightmare' ? 22 : tier === 'hell' ? 8 : 0;
    if (this.ctx && this.trackSrc?.detune) this.trackSrc.detune.setTargetAtTime(this.tierDetune, this.ctx.currentTime, 0.6);
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number, lp = 3000, vib = 0): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    freq *= this.tierPitch;
    o.frequency.value = freq;
    if (this.tierWobble && o.detune) o.detune.value = (Math.random() * 2 - 1) * this.tierWobble;
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
      o.frequency.value = freq * mult * this.tierPitch;
      if (this.tierWobble && o.detune) o.detune.value = (Math.random() * 2 - 1) * this.tierWobble;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (mult > 1 ? 0.35 : 1));
      o.connect(g).connect(this.scoreGain!);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }

  /** A wheel over a rail joint: a dull double knock. */
  private clack(t: number, vol: number): void {
    const ctx = this.ctx!;
    for (const dt of [0, 0.09]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(180, t + dt);
      o.frequency.exponentialRampToValueAtTime(90, t + dt + 0.06);
      g.gain.setValueAtTime(vol, t + dt);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dt + 0.08);
      o.connect(g).connect(this.scoreGain!);
      o.start(t + dt);
      o.stop(t + dt + 0.1);
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
    // the Boardwalk: a bell buoy far out, tolling low on the first beat of every fourth bar
    if (th.buoy && inBar === 0 && bar % 4 === 0) {
      const b = mtof(chord - 12) * (1 + (Math.random() - 0.5) * 0.004);
      this.chime(b, t, beat * 5, 0.07 * th.buoy * th.vol);
      this.chime(b * 2.76, t + 0.01, beat * 2, 0.02 * th.buoy * th.vol);
    }
    // the Ghost Train: two clacks over each rail joint on every bar, and every eighth bar a whistle far down the line
    if (th.rails) {
      if (inBar === 0 || inBar === 2) this.clack(t + (inBar === 2 ? beat * 0.45 : 0), 0.05 * th.rails * th.vol);
      if (inBar === 0 && bar % 8 === 6) {
        const w = mtof(chord + 12);
        for (const [iv, v] of [[0, 1], [3, 0.8], [7, 0.6]] as const) this.note(w * Math.pow(2, iv / 12), t, beat * 2.6, 'sawtooth', 0.012 * th.rails * th.vol * v, 1400, 0.004);
      }
    }
    // the Fun House: a wet finger round a glass rim, two octaves up, on the off-bars
    if (th.glass && inBar === 2 && bar % 2 === 1) {
      const g = mtof(chord + 31) * (1 + (Math.random() - 0.5) * th.warp * 0.5);
      this.note(g, t, beat * 3.2, 'sine', 0.02 * th.glass * th.vol, 6000, 0.004);
      this.note(g * 1.5, t + beat * 0.5, beat * 2.6, 'sine', 0.012 * th.glass * th.vol, 6000, 0.004);
    }
  }

  // ---------------------------------------------------------------- ambience & dread drone
  private ambKind: 'carnival' | 'funhouse' | 'boardwalk' | 'ghosttrain' = 'carnival';
  private ambBufs = new Map<string, AudioBuffer>();
  /** the Boardwalk's three beds (promenade, beach, pier) and their crossfade gains (D-68) */
  private shore: { src: AudioBufferSourceNode; gain: GainNode }[] = [];

  /** Which place's ambience plays (D-63). Built the first time it is needed, crossfaded in. */
  setAmbience(kind: 'carnival' | 'funhouse' | 'boardwalk' | 'ghosttrain'): void {
    if (kind === this.ambKind) return;
    this.ambKind = kind;
    if (!this.unlocked || !this.ctx) return;
    const old = this.ambSrc;
    if (old) {
      try {
        old.stop(this.ctx.currentTime + 0.05);
      } catch {
        /* already stopped */
      }
    }
    this.ambSrc = null;
    this.stopShore();
    this.startAmbience();
  }

  /**
   * Where the listener stands on the Boardwalk (D-68), as weights for its three beds: the promenade and
   * the park (louder: the calliope, the arcade, the rides), the beach (surf and wind) and the pier (the sea
   * against the pilings, timber, the bell buoy, the foghorn far out). Called every frame; cheap.
   */
  setShoreMix(promenade: number, beach: number, pier: number): void {
    if (this.ambKind !== 'boardwalk' || !this.ctx || this.shore.length < 3) return;
    const t = this.ctx.currentTime;
    const w = [promenade * 1.0, beach * 0.85, pier * 0.95];
    this.shore.forEach((b, i) => b.gain.gain.setTargetAtTime(w[i], t, 0.6));
  }

  /**
   * The Ghost Train (D-80): how much of the carriages' rattle against the stations' night (1 riding, 0 standing
   * at a station), and how fast the train is going (0..1: the rattle's rate and weight). Called every frame.
   */
  setLineMix(riding: number, speed: number): void {
    if (this.ambKind !== 'ghosttrain' || !this.ctx || this.shore.length < 2) return;
    const t = this.ctx.currentTime;
    this.shore[0].gain.gain.setTargetAtTime(1 - riding * 0.75, t, 0.5);
    this.shore[1].gain.gain.setTargetAtTime(riding * (0.25 + 0.75 * speed), t, 0.3);
    this.shore[1].src.playbackRate.setTargetAtTime(0.55 + 0.45 * speed, t, 0.4);
  }

  private stopShore(): void {
    if (!this.ctx) return;
    for (const b of this.shore) {
      try {
        b.src.stop(this.ctx.currentTime + 0.05);
      } catch {
        /* already stopped */
      }
    }
    this.shore = [];
  }

  /** A bed of `sec` seconds, both channels drawn by `draw(data, channel, length)`. */
  private bed(sec: number, draw: (d: Float32Array, ch: number, len: number) => void): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(sec * SR);
    const buf = ctx.createBuffer(2, len, SR);
    for (let ch = 0; ch < 2; ch++) draw(buf.getChannelData(ch), ch, len);
    return buf;
  }

  /** The promenade: a warped calliope from the Pavilion, arcade chimes, the coaster's lift chain, canvas, laughter. */
  private promenadeBed(): AudioBuffer {
    return this.bed(14, (d, ch, len) => {
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += 0.012 * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * 0.32;
      }
      // the calliope, far and slipping
      const cal = [62, 66, 69, 74, 69, 66, 64, 62, 61, 62];
      cal.forEach((m, k) => {
        const st = Math.floor((1 + k * 0.48) * SR);
        const f0 = 440 * Math.pow(2, (m - 69) / 12);
        for (let i = 0; i < SR * 0.44 && st + i < len; i++) {
          const wow = 1 + 0.014 * Math.sin((i / SR) * 2 * Math.PI * 0.8 + k) - k * 0.003;
          const ph = (f0 * wow * i) / SR;
          d[st + i] += ((ph % 1) < 0.5 ? 1 : -1) * Math.min(1, i / (SR * 0.02)) * Math.exp(-i / (SR * 0.32)) * 0.014 * (ch ? 0.7 : 1);
        }
      });
      // arcade chimes: little bright blips, now and then
      for (const [at, f] of [[0.4, 1568], [3.2, 2093], [7.7, 1760], [11.1, 2349]] as [number, number][]) {
        for (let r = 0; r < 3; r++) {
          const st = Math.floor((at + r * 0.09 + ch * 0.01) * SR);
          for (let i = 0; i < SR * 0.08 && st + i < len; i++) d[st + i] += ((((f * (1 + r * 0.25) * i) / SR) % 1) < 0.3 ? 1 : -1) * Math.exp(-i / (SR * 0.025)) * 0.012;
        }
      }
      // the lift hill's chain dogs clacking, and the train's far roar
      for (let k = 0; k < 18; k++) {
        const st = Math.floor((6 + k * 0.16) * SR);
        for (let i = 0; i < SR * 0.03 && st + i < len; i++) d[st + i] += (Math.random() * 2 - 1) * Math.exp(-i / (SR * 0.006)) * 0.05 * (ch ? 0.7 : 1);
      }
      const rs = Math.floor(9.2 * SR);
      let rl = 0;
      for (let i = 0; i < SR * 2.6 && rs + i < len; i++) {
        rl += 0.01 * ((Math.random() * 2 - 1) - rl);
        d[rs + i] += rl * Math.sin((Math.PI * i) / (SR * 2.6)) * 0.9;
      }
      // canvas flapping in the wind
      for (const at of [2.4, 12.5]) {
        for (let k = 0; k < 4; k++) {
          const st = Math.floor((at + k * 0.13) * SR);
          for (let i = 0; i < SR * 0.07 && st + i < len; i++) d[st + i] += (Math.random() * 2 - 1) * Math.exp(-i / (SR * 0.02)) * 0.04;
        }
      }
      // laughter, far off, pitched down
      for (let k = 0; k < 5; k++) {
        const st = Math.floor((4.6 + k * 0.18) * SR);
        const f0 = 200 - k * 8;
        for (let i = 0; i < SR * 0.14 && st + i < len; i++) d[st + i] += ((((f0 * (1 + 0.04 * Math.sin(i / 480)) * i) / SR) % 1) * 2 - 1) * Math.sin((Math.PI * i) / (SR * 0.14)) * 0.01 * (ch ? 0.6 : 1);
      }
    });
  }

  /** The beach: surf (each breaker a swell, a crash and a long hiss), wind, one far gull. */
  private beachBed(): AudioBuffer {
    return this.bed(12, (d, ch, len) => {
      let lp = 0, lp2 = 0;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        const n = Math.random() * 2 - 1;
        lp += 0.05 * (n - lp);
        lp2 += 0.006 * (n - lp2);
        // breakers every ~6 s, slightly out of step between the ears
        const ph = ((t + ch * 0.35) % 6) / 6;
        const crash = ph < 0.12 ? ph / 0.12 : Math.exp(-(ph - 0.12) * 4.5);
        const wind = 0.5 + 0.5 * Math.sin(t * 0.37 + ch) * Math.sin(t * 0.13);
        d[i] = lp * (0.12 + 0.6 * crash) + lp2 * 1.4 * (0.6 + 0.4 * wind);
      }
      const st = Math.floor(8.4 * SR);
      for (let i = 0; i < SR * 0.5 && st + i < len; i++) {
        const f = 1600 - 500 * (i / (SR * 0.5)) + 120 * Math.sin(i / 120);
        d[st + i] += Math.sin((2 * Math.PI * f * i) / SR) * Math.sin((Math.PI * i) / (SR * 0.5)) * 0.008 * (ch ? 0.5 : 1);
      }
    });
  }

  /** The pier: water slapping the pilings, timber creaking, rigging, the bell buoy, the foghorn far out. */
  private pierBed(): AudioBuffer {
    return this.bed(13, (d, ch, len) => {
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += 0.008 * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * 1.2 * (0.7 + 0.3 * Math.sin(i / SR * 0.9 + ch));
      }
      // slaps against the pilings: short, wet, irregular
      for (let k = 0; k < 14; k++) {
        const st = Math.floor(((k * 0.93 + (k % 3) * 0.21 + ch * 0.07) % 13) * SR);
        let l = 0;
        for (let i = 0; i < SR * 0.18 && st + i < len; i++) {
          l += 0.08 * ((Math.random() * 2 - 1) - l);
          d[st + i] += l * Math.exp(-i / (SR * 0.05)) * 0.5;
        }
      }
      // the timber groaning under the swell
      for (const at of [1.6, 7.2]) {
        const st = Math.floor(at * SR);
        for (let i = 0; i < SR * 1.1 && st + i < len; i++) {
          const f = 70 + 25 * Math.sin(i / 1500) + 6 * Math.sin(i / 160);
          d[st + i] += ((((f * i) / SR) % 1) * 2 - 1) * Math.sin((Math.PI * i) / (SR * 1.1)) * 0.03;
        }
      }
      // wind singing in the rigging
      for (let i = 0; i < len; i++) d[i] += Math.sin((2 * Math.PI * (880 + 30 * Math.sin(i / SR * 0.6)) * i) / SR) * 0.0025 * (0.5 + 0.5 * Math.sin(i / SR * 0.4 + ch));
      // the bell buoy, rolling: two strikes, then one
      for (const at of [3.1, 3.9, 10.2]) {
        const st = Math.floor(at * SR);
        for (let i = 0; i < SR * 2.2 && st + i < len; i++) {
          const e = Math.exp(-i / (SR * 0.7));
          d[st + i] += (Math.sin((2 * Math.PI * 392 * i) / SR) + 0.4 * Math.sin((2 * Math.PI * 392 * 2.76 * i) / SR)) * e * 0.02 * (ch ? 0.8 : 1);
        }
      }
      // the foghorn, very far out
      const fs = Math.floor(5.4 * SR);
      for (let i = 0; i < SR * 2.4 && fs + i < len; i++) {
        const env = Math.min(1, i / (SR * 0.4)) * Math.min(1, (SR * 2.4 - i) / (SR * 0.6));
        const ph = (98 * i) / SR;
        d[fs + i] += ((ph % 1) * 2 - 1) * env * 0.022 * (ch ? 0.9 : 1);
      }
    });
  }

  /** The Fun House's insides: no wind; boards settling, a drip, glass ringing, a broken music box, far laughter. */
  private houseAmbience(): AudioBuffer {
    const ctx = this.ctx!;
    const len = 14 * SR;
    const buf = ctx.createBuffer(2, len, SR);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += 0.004 * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * 0.25; // a close, airless room tone
      }
      // boards settling underfoot
      for (const at of [1.1, 4.7, 9.3, 12.2]) {
        const st = Math.floor((at + ch * 0.13) * SR);
        for (let i = 0; i < SR * 0.5 && st + i < len; i++) {
          const f = 120 + 60 * Math.sin(i / 700) + 20 * Math.sin(i / 90);
          d[st + i] += Math.sin((2 * Math.PI * f * i) / SR) * 0.045 * Math.sin((Math.PI * i) / (SR * 0.5));
        }
      }
      // a slow drip
      for (let k = 0; k < 6; k++) {
        const st = Math.floor((0.7 + k * 2.3 + (ch ? 0.02 : 0)) * SR);
        const f0 = 1400 + (k % 3) * 160;
        for (let i = 0; i < SR * 0.12 && st + i < len; i++) d[st + i] += Math.sin((2 * Math.PI * f0 * (1 + i / (SR * 0.2)) * i) / SR) * Math.exp(-i / (SR * 0.025)) * 0.05;
      }
      // glass resonance: two high partials swelling and fading
      for (const [at, f] of [[2.6, 1975], [8.1, 2349]] as [number, number][]) {
        const st = Math.floor(at * SR);
        for (let i = 0; i < SR * 2.4 && st + i < len; i++) {
          const env = Math.sin((Math.PI * i) / (SR * 2.4)) ** 2;
          d[st + i] += (Math.sin((2 * Math.PI * f * i) / SR) + 0.5 * Math.sin((2 * Math.PI * f * 1.502 * i) / SR)) * env * 0.012;
        }
      }
      // a broken music box: a few notes of the waltz, backwards, the spring running down
      const mel = [71, 72, 76, 74, 71, 76, 79];
      mel.forEach((m, k) => {
        const st = Math.floor((5.4 + k * (0.5 + k * 0.06)) * SR);
        const f = 440 * Math.pow(2, (m - 69) / 12) * (1 - k * 0.006);
        for (let i = 0; i < SR * 0.6 && st + i < len; i++) d[st + i] += Math.sin((2 * Math.PI * f * i) / SR) * Math.exp(-i / (SR * 0.22)) * 0.03 * (ch ? 0.8 : 1);
      });
      // far-off laughter, pitched down and smeared
      for (let k = 0; k < 5; k++) {
        const st = Math.floor((10.4 + k * 0.19) * SR);
        const f0 = 190 - k * 9;
        for (let i = 0; i < SR * 0.15 && st + i < len; i++) {
          const ph = (f0 * (1 + 0.04 * Math.sin(i / 500)) * i) / SR;
          d[st + i] += ((ph % 1) * 2 - 1) * Math.sin((Math.PI * i) / (SR * 0.15)) * 0.012 * (ch ? 0.6 : 1);
        }
      }
    }
    return buf;
  }

  /** The stations' night: wind through the cutting, telegraph wires singing, a clock ticking somewhere, a far bell. */
  private stationBed(): AudioBuffer {
    return this.bed(14, (d, ch, len) => {
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        lp += 0.015 * (Math.random() * 2 - 1 - lp);
        d[i] = lp * 0.55 * (0.6 + 0.4 * Math.sin(t * 0.37 + ch));
        // the wires' hum, beating slowly
        d[i] += Math.sin(2 * Math.PI * 182 * t) * 0.004 * (0.5 + 0.5 * Math.sin(t * 0.8 + ch)) + Math.sin(2 * Math.PI * 184.5 * t) * 0.003;
      }
      // a clock ticking far off (one side), and a bell tolling once
      for (let k = 0; k < 14; k++) {
        const st = Math.floor((k + 0.3) * SR);
        for (let i = 0; i < SR * 0.02 && st + i < len; i++) d[st + i] += (Math.random() * 2 - 1) * Math.exp(-i / (SR * 0.004)) * 0.05 * (ch ? 0.4 : 1);
      }
      const st = Math.floor(6.2 * SR);
      for (let i = 0; i < SR * 4 && st + i < len; i++) {
        const tt = i / SR;
        d[st + i] += (Math.sin(2 * Math.PI * 147 * tt) + 0.4 * Math.sin(2 * Math.PI * 147 * 2.4 * tt)) * Math.exp(-tt / 1.4) * 0.03;
      }
    });
  }

  /** The carriages: the clack of the wheels over the joints (four to a bar), the body's creak, the roar under it. */
  private rideBed(): AudioBuffer {
    return this.bed(8, (d, ch, len) => {
      let lp = 0, lp2 = 0;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        const n = Math.random() * 2 - 1;
        lp += 0.03 * (n - lp);
        lp2 += 0.004 * (n - lp2);
        d[i] = lp * 0.35 + lp2 * 1.2 * (0.8 + 0.2 * Math.sin(t * 3.1));
      }
      // clackety-clack: pairs of knocks, a bar of four every second
      for (let k = 0; k < 8 * 4; k++) {
        const st = Math.floor((k * 0.25 + (k % 2) * 0.06 + ch * 0.004) * SR);
        const f = 140 + (k % 4) * 9;
        for (let i = 0; i < SR * 0.07 && st + i < len; i++) {
          const tt = i / SR;
          d[st + i] += Math.sin(2 * Math.PI * f * tt * (1 - tt * 3)) * Math.exp(-tt / 0.018) * 0.22 + (Math.random() * 2 - 1) * Math.exp(-tt / 0.006) * 0.12;
        }
      }
      // the carriage body creaking now and then
      for (const at of [1.7, 5.3]) {
        const st = Math.floor(at * SR);
        for (let i = 0; i < SR * 0.5 && st + i < len; i++) {
          const tt = i / SR;
          d[st + i] += Math.sin(2 * Math.PI * (320 + 40 * Math.sin(tt * 30)) * tt) * Math.sin((Math.PI * i) / (SR * 0.5)) * 0.02;
        }
      }
    });
  }

  private startAmbience(): void {
    const ctx = this.ctx!;
    if (this.ambKind === 'ghosttrain') {
      this.stopShore();
      const beds: [string, () => AudioBuffer][] = [['gt_station', () => this.stationBed()], ['gt_ride', () => this.rideBed()]];
      for (const [key, make] of beds) {
        const b = this.ambBufs.get(key) ?? make();
        this.ambBufs.set(key, b);
        const src = ctx.createBufferSource();
        src.buffer = b;
        src.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = key === 'gt_station' ? 1 : 0;
        src.connect(gain).connect(this.amb);
        src.start();
        this.shore.push({ src, gain });
      }
      return;
    }
    if (this.ambKind === 'boardwalk') {
      this.stopShore();
      const beds: [string, () => AudioBuffer][] = [['bw_prom', () => this.promenadeBed()], ['bw_beach', () => this.beachBed()], ['bw_pier', () => this.pierBed()]];
      for (const [key, make] of beds) {
        const b = this.ambBufs.get(key) ?? make();
        this.ambBufs.set(key, b);
        const src = ctx.createBufferSource();
        src.buffer = b;
        src.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = key === 'bw_prom' ? 1 : 0;
        src.connect(gain).connect(this.amb);
        src.start();
        this.shore.push({ src, gain });
      }
      return;
    }
    if (this.ambKind === 'funhouse') {
      const hb = this.ambBufs.get('funhouse') ?? this.houseAmbience();
      this.ambBufs.set('funhouse', hb);
      const s = ctx.createBufferSource();
      s.buffer = hb;
      s.loop = true;
      s.connect(this.amb);
      s.start();
      this.ambSrc = s;
      return;
    }
    const cached = this.ambBufs.get('carnival');
    if (cached) {
      const s = ctx.createBufferSource();
      s.buffer = cached;
      s.loop = true;
      s.connect(this.amb);
      s.start();
      this.ambSrc = s;
      return;
    }
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
    this.ambBufs.set('carnival', buf);
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
