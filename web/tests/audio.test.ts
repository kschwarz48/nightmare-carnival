// Bradley's song on boss fights (D-70): it starts from its first note when a fight begins and always plays
// through to its end, even if the boss falls first; only then does the night's music come back. A fight
// that outlasts it hears it again from the top. Driven through a stand-in AudioContext (node has none).

import { describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../src/audio/audio';

interface FakeSource {
  playbackRate: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> };
  loop: boolean;
  offset: number;
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
        ...node(), buffer: null, loop: false, loopStart: 0, loopEnd: 0, playbackRate: param(), onended: null, offset: -1, stopped: false,
        start(_t: number, off = 0) { this.offset = off; },
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
  return { a, sources, playing, score: (a as unknown as Record<string, unknown>).startScore as ReturnType<typeof vi.fn> };
}

describe("Bradley's song on boss fights (D-70)", () => {
  it('starts from the top, plays out after the boss falls, then the night comes back', () => {
    const { a, sources, playing, score } = engine();
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
