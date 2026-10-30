import { describe, it, expect } from 'vitest';
import { makeGame, runFor } from './helpers';

describe('full run (god mode, accelerated)', () => {
  it('reaches dawn', () => {
    const g = makeGame({ godMode: true, seed: 4242 });
    const log: string[] = [];
    g.bus.on('boss_spawn', (e) => log.push(`${g.time.toFixed(0)} spawn ${e.id} lvl ${g.level} ${g.weapons.list.map((w) => w.def.id + w.level).join(',')}`));
    g.bus.on('boss_phase', (e) => log.push(`${g.time.toFixed(0)} phase ${e.id} ${e.phase}`));
    g.bus.on('boss_defeated', (e) => log.push(`${g.time.toFixed(0)} defeated ${e.id}`));
    g.bus.on('evolved', (e) => log.push(`${g.time.toFixed(0)} evolved ${e.to}`));
    g.bus.on('dawn', () => log.push(`${g.time.toFixed(0)} dawn`));
    const t0 = performance.now();
    let maxAlive = 0;
    for (let s = 0; s < 1700 && g.phase !== 'ended'; s++) {
      runFor(g, 1);
      maxAlive = Math.max(maxAlive, g.active.length);
    }
    console.log(log.join('\n'));
    console.log('ms', (performance.now() - t0).toFixed(0), 'time', g.time.toFixed(0), 'kills', g.kills, 'lvl', g.level, 'maxAlive', maxAlive, 'phase', g.phase,
      'weapons', g.weapons.list.map((w) => w.def.id + ':' + w.level).join(','), 'passives', [...g.player.passives].join(','), 'stats', JSON.stringify(g.endStats && { lt: g.endStats.lostTickets, won: g.endStats.won }));
    expect(g.bossKills).toBeGreaterThanOrEqual(1);
  });
});
