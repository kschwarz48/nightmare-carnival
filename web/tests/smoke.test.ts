import { describe, it, expect } from 'vitest';
import { makeGame, runFor } from './helpers';

describe('smoke', () => {
  it('runs 3 minutes', () => {
    const g = makeGame();
    const t0 = performance.now();
    runFor(g, 180);
    const ms = performance.now() - t0;
    console.log('3min sim ms', ms.toFixed(0), 'kills', g.kills, 'lvl', g.level, 'hp', g.player.hp.toFixed(0), 'alive', g.active.length, 'phase', g.phase, 'weapons', g.weapons.list.map(w=>w.def.id+':'+w.level).join(','), 'passives', [...g.player.passives].join(','));
    expect(g.kills).toBeGreaterThan(50);
    expect(g.phase).toBe('play');
  });
});
