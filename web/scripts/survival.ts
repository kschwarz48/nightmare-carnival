import { makeGame, smartPilot, smartDraft } from '../tests/helpers';
const chars = ['carny', 'strongman', 'fortune_teller', 'ride_operator', 'lost_child', 'ringleader', 'mira'];
const diffs = (process.argv[2] ?? 'normal').split(',') as any[];
// the world tiers (D-97), then an optional map (D-64), e.g. `npx vite-node scripts/survival.ts normal,nightmare fun_house`
const map = (process.argv[3] ?? 'carnival_core') as any;
for (const diff of diffs) for (const c of chars) {
  const res: string[] = [];
  for (const seed of [11, 22, 33]) {
    const g = makeGame({ character: c, tier: diff, seed, map });
    let s = 0;
    while (g.phase !== 'ended' && s < 1700 * 60) { smartDraft(g); smartPilot(g); g.tick(); s++; }
    res.push(`${Math.round(g.time)}s/L${g.level}/${g.bossKills}b${g.endStats?.won ? 'W' : ''}`);
  }
  console.log(diff.padEnd(9), c.padEnd(15), res.join('  '));
}
