import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { EVENTS, type EventId } from '../src/data/events';

describe('carnival events', () => {
  for (const id of Object.keys(EVENTS) as EventId[]) {
    it(`${id} runs to completion`, () => {
      const g = makeGame({ godMode: true });
      g.time = 800;
      g.act = 3;
      const banners: string[] = [];
      g.bus.on('carnival_event', (e) => banners.push(e.id));
      g.events.start(id);
      expect(banners).toEqual([id]);
      for (let i = 0; i < 60 * (EVENTS[id].duration + 3); i++) {
        if (g.phase === 'draft') g.chooseDraft(0);
        g.tick();
      }
      expect(g.events.isRunning(id)).toBe(false);
      if (id === 'lights_out') expect(g.darkness).toBeLessThan(0.5);
    });
  }
  it('Lights Out darkens and Calliope boosts spawns while active', () => {
    const g = makeGame({ godMode: true });
    g.events.start('lights_out');
    for (let i = 0; i < 300; i++) g.tick();
    expect(g.darkness).toBeGreaterThan(0.8);
    g.events.start('calliope');
    g.tick();
    expect(g.events.spawnRateMult).toBeGreaterThan(1.5);
  });
});
