// Bradley's song on boss fights (D-70): it starts from its first note when a fight begins and always plays
// through to its end, even if the boss falls first; only then does the night's music come back. A fight
// that outlasts it hears it again from the top. The Ghost Train's night is his second song (D-81) under the
// same rules. Driven through a stand-in AudioContext (node has none).

import { describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../src/audio/audio';

interface FakeSource {
  buffer: unknown;
  playbackRate: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> };
  loop: boolean;
  /** when it was told to start (audio time), from where in the buffer, and for how long */
  at: number;
  offset: number;
  dur?: number;
  stopped: boolean;
  onended: (() => void) | null;
}

function engine() {
  const param = () => ({ value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const node = () => ({ connect: (n: unknown) => n, disconnect: () => {} });
  const sources: FakeSource[] = [];
  const ctx = {
    currentTime: 0,
    createGain: () => ({ ...node(), gain: param() }),
    createBufferSource: () => {
      const s = {
        ...node(), buffer: null, loop: false, loopStart: 0, loopEnd: 0, playbackRate: param(), onended: null, at: -1, offset: -1, dur: undefined as number | undefined, stopped: false,
        start(t = 0, off = 0, dur?: number) { this.at = t; this.offset = off; this.dur = dur; },
        stop() { this.stopped = true; },
      };
      sources.push(s as unknown as FakeSource);
      return s;
    },
  };
  const a = new AudioEngine() as unknown as Record<string, unknown> & AudioEngine;
  Object.assign(a, {
    unlocked: true, ctx, music: ctx.createGain(), musicFilter: { frequency: param() },
    tracks: { intro: { duration: 102 }, loop: { duration: 102 }, loopStart: 11.98, loopEnd: 101.4 },
    startScore: vi.fn(), stopScore: vi.fn(), setDrone: vi.fn(),
  });
  const playing = () => sources.filter((s) => !s.stopped);
  const r = a as unknown as Record<string, unknown>;
  return { a, ctx, sources, playing, score: r.startScore as ReturnType<typeof vi.fn>, drone: r.setDrone as ReturnType<typeof vi.fn> };
}

/** The engine with the Ghost Train's song already fetched. */
function lineEngine() {
  const e = engine();
  const line = { duration: 98.55 };
  Object.assign(e.a, { line, lineEnd: 98.5, lineState: 'ready' });
  return { ...e, line, intro: (e.a as unknown as { tracks: { intro: unknown } }).tracks.intro };
}

describe("Bradley's song on boss fights (D-70)", () => {
  it('starts from the top, plays out after the boss falls, then the night comes back', () => {
    const { a, sources, playing, score } = engine();
    // (the map's waltz plays only when Bradley's night song can't load, D-98)
    Object.assign(a, { lineState: 'failed' });
    a.setCue('bw_act3');
    expect(score).toHaveBeenCalledTimes(1);
    a.setCue('silence');
    a.setCue('boss_last_ride');
    expect(sources).toHaveLength(1);
    expect(sources[0].offset).toBe(0);
    expect(sources[0].loop).toBe(false);
    // the boss falls: the song is not cut, and the waltz waits
    a.setCue('bw_act3');
    expect(playing()).toHaveLength(1);
    expect(score).toHaveBeenCalledTimes(1);
    sources[0].onended!();
    expect(score).toHaveBeenCalledTimes(2);
  });

  it('a fight that outlasts the song hears it again from the top', () => {
    const { a, sources } = engine();
    a.setCue('boss_leviathan');
    sources[0].onended!();
    expect(sources).toHaveLength(2);
    expect(sources[1].offset).toBe(0);
  });

  it('a boss arriving while it plays out keeps it going; a phase can quicken it; a new night cuts it', () => {
    const { a, sources, playing } = engine();
    a.setCue('boss_ringmaster');
    a.setCue('act4');
    a.setCue('silence');
    a.setCue('boss_ringmaster_2');
    expect(sources).toHaveLength(1);
    expect(sources[0].playbackRate.setTargetAtTime).toHaveBeenCalledWith(1.03, 0, 0.5);
    // dawn and the results wait for its end too
    a.setCue('dawn');
    expect(playing()).toHaveLength(1);
    a.endBossSong();
    expect(playing()).toHaveLength(0);
  });
});

describe("the Ghost Train's night: Bradley's second song (D-81)", () => {
  it('plays from its first note instead of the waltz, clean of the dread drone, and carries on through the Acts', () => {
    const { a, sources, playing, score, drone, line } = lineEngine();
    a.setCue('gt_act1');
    expect(sources).toHaveLength(1);
    expect(sources[0].buffer).toBe(line);
    expect([sources[0].offset, sources[0].dur, sources[0].loop]).toEqual([0, 98.5, false]);
    expect(score).not.toHaveBeenCalled();
    a.setCue('gt_act3');
    expect(playing()).toEqual([sources[0]]);
    expect(drone).toHaveBeenLastCalledWith(0);
  });

  it('a boss cuts it for the boss song played through; after that it comes back from the top', () => {
    const { a, sources, playing, line, intro } = lineEngine();
    a.setCue('gt_act2');
    a.setCue('silence');
    a.setCue('boss_stationmaster');
    expect(sources[0].stopped).toBe(true);
    expect(sources[1].buffer).toBe(intro);
    expect(sources[1].offset).toBe(0);
    // the boss falls: the boss song plays out first
    a.setCue('gt_act2');
    expect(playing()).toEqual([sources[1]]);
    sources[1].onended!();
    expect(sources).toHaveLength(3);
    expect(sources[2].buffer).toBe(line);
    expect(sources[2].offset).toBe(0);
  });

  it('at its end plays again from the top after a breath; a boss arriving in the breath stops it before it starts', () => {
    const { a, ctx, sources, line, intro } = lineEngine();
    a.setCue('gt_act1');
    ctx.currentTime = 98.5;
    sources[0].onended!();
    expect(sources[1].buffer).toBe(line);
    expect([sources[1].at, sources[1].offset]).toEqual([99.5, 0]);
    a.setCue('silence');
    a.setCue('boss_stoker');
    expect(sources[1].stopped).toBe(true);
    expect(sources[2].buffer).toBe(intro);
  });

  it('a new night on the line hears it from its first note', () => {
    const { a, sources } = lineEngine();
    a.setCue('gt_act3');
    a.endBossSong();
    a.setCue('gt_act1');
    expect(sources[0].stopped).toBe(true);
    expect(sources[1].offset).toBe(0);
  });

  it('comes in when it arrives; if it cannot be had, the railway waltz stands in', async () => {
    const flush = () => new Promise((r) => setTimeout(r, 0));
    const buf = { duration: 98.55, sampleRate: 100, getChannelData: () => new Float32Array([0.4, 0.3, 0]) };
    const ok = engine();
    Object.assign(ok.a, { fetchTrack: vi.fn(() => Promise.resolve(buf)) });
    ok.a.setCue('gt_act1');
    expect(ok.sources).toHaveLength(0);
    expect(ok.score).not.toHaveBeenCalled();
    await flush();
    expect(ok.sources).toHaveLength(1);
    expect(ok.sources[0].buffer).toBe(buf);
    expect(ok.sources[0].dur).toBeCloseTo(0.01);

    const bad = engine();
    Object.assign(bad.a, { fetchTrack: vi.fn(() => Promise.reject(new Error('offline'))) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    bad.a.setCue('gt_act1');
    await flush();
    expect(bad.sources).toHaveLength(0);
    expect(bad.score).toHaveBeenCalledTimes(1);
  });
});

describe("only Bradley's songs (D-98)", () => {
  it("every map's night and the Midway play his night song; bosses keep the boss song", () => {
    for (const cue of ['act1', 'fh_act2', 'bw_act3', 'gt_act4', 'endless', 'midway']) {
      const { a, sources, score, line } = lineEngine();
      a.setCue(cue);
      expect(score, cue).not.toHaveBeenCalled();
      expect(sources.at(-1)?.buffer, cue).toBe(line);
    }
    const { a, sources, intro } = lineEngine();
    a.setCue('boss_ringmaster');
    expect(sources.at(-1)?.buffer).toBe(intro);
  });

  it('takes the songs down in key and tempo on the higher tiers', () => {
    const { a, sources } = lineEngine();
    const withDetune = sources as unknown as { detune?: { value: number } }[];
    const ctx = (a as unknown as { ctx: { createBufferSource: () => unknown } }).ctx;
    const make = ctx.createBufferSource;
    ctx.createBufferSource = () => Object.assign(make() as object, { detune: { value: 0, setTargetAtTime: () => {} } });
    a.setTier('nightmare');
    a.setCue('act1');
    expect(withDetune.at(-1)?.detune?.value).toBe(-200);
    a.setTier('hell');
    a.setCue('boss_ringmaster');
    expect(withDetune.at(-1)?.detune?.value).toBe(-300);
  });
});
