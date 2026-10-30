import { describe, it, expect } from 'vitest';
import { makeGame, runFor } from './helpers';

// Accelerated end-to-end night: autopilot + auto-draft, god mode so the bot survives.
describe('full run (god mode, accelerated)', () => {
  it('plays all four Acts, defeats every boss, reaches dawn and pays out', () => {
    const g = makeGame({ godMode: true, seed: 777 });
    const log: string[] = [];
    g.bus.on('boss_spawn', (e) => log.push(`${g.time.toFixed(0)} spawn ${e.id} lvl ${g.level}`));
    g.bus.on('boss_defeated', (e) => log.push(`${g.time.toFixed(0)} defeated ${e.id}`));
    g.bus.on('evolved', (e) => log.push(`${g.time.toFixed(0)} evolved ${e.to}`));
    g.bus.on('dawn', () => log.push(`${g.time.toFixed(0)} dawn`));
    const acts = new Set<number>();
    g.bus.on('act', (e) => acts.add(e.act));
    let maxAlive = 0;
    for (let s = 0; s < 2600 && g.phase !== 'ended'; s++) {
      runFor(g, 1);
      maxAlive = Math.max(maxAlive, g.active.length);
    }
    console.log(log.join('\n'), '\nlevel', g.level, 'kills', g.kills, 'maxAlive', maxAlive, 'LT', g.endStats?.lostTickets);
    expect([...acts].sort()).toEqual([2, 3, 4]);
    expect(g.bossIds).toEqual(['carnival_tent', 'ferris_wheel', 'puppet_king', 'ringmaster']);
    expect(g.phase).toBe('ended');
    expect(g.endStats?.won).toBe(true);
    expect(g.endStats!.lostTickets).toBeGreaterThan(300);
    expect(maxAlive).toBeLessThanOrEqual(180 + 110); // Midway cap + one flyby swarm overlay
  });
});
