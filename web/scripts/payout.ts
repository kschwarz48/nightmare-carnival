// What a night pays in Lost Tickets (D-78), to price the Lost & Found against: full nights on each map with
// the smart pilot and draft policy, winning (god mode) and as they fall (mortal), on Midway with no perks.
// Usage: npx vite-node scripts/payout.ts [seeds=2] [map] [god|mortal]

import { makeGame, smartDraft, smartPilot } from '../tests/helpers';
import type { MapId } from '../src/data/maps';

const seeds = [11, 22, 33, 44].slice(0, Number(process.argv[2] ?? 2));
const maps: MapId[] = process.argv[3] ? [process.argv[3] as MapId] : ['carnival_core', 'fun_house', 'boardwalk'];
const modes = process.argv[4] ? [process.argv[4] as 'god' | 'mortal'] : (['god', 'mortal'] as const);

for (const mode of modes) {
  for (const map of maps) {
    for (const seed of seeds) {
      const g = makeGame({ seed, map, godMode: mode === 'god' });
      let vouchers = 0;
      g.bus.on('meta_currency', (e) => (vouchers += e.amount));
      for (let s = 0; g.phase !== 'ended' && s < 2600 * 60; s++) {
        smartDraft(g);
        if (g.phase === 'draft') g.chooseDraft(0);
        smartPilot(g);
        g.tick();
      }
      const st = g.endStats;
      if (!st) {
        console.log(`${mode} ${map} seed ${seed}: still going at ${(g.time / 60).toFixed(1)} min (phase ${g.phase})`);
        continue;
      }
      console.log(`${mode.padEnd(6)} ${map.padEnd(13)} seed ${seed}: ${st.won ? 'won ' : 'lost'} at ${(g.time / 60).toFixed(1)} min, ${g.bossKills} bosses, ${g.kills} kills, level ${g.level} → ${st.lostTickets} LT (+${vouchers} vouchers)`);
    }
  }
}
