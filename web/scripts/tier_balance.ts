// The world tiers' balance check (D-97, docs/WORLD_TIER_DESIGN.md §10): bot nights per tier, map, Lost & Found
// progression and party size, reporting how long the bots last, whether they win, the level reached, damage taken and
// the Lost Tickets paid. Bots aren't players: this rules out the extremes (a tier nobody could survive, or one that
// plays itself); human playtests settle the rest.
//   npx vite-node scripts/tier_balance.ts [tiers=normal,nightmare,hell] [map=carnival_core] [builds=fresh,mid,full] [party=1] [seeds=11,22,33]
import { makeGame, smartPilot, smartDraft } from '../tests/helpers';
import { PERKS } from '../src/data/meta';
import type { TierId } from '../src/data/tiers';

const [tiersArg, mapArg, buildsArg, partyArg, seedsArg] = process.argv.slice(2);
const tiers = (tiersArg ?? 'normal,nightmare,hell').split(',') as TierId[];
const map = (mapArg ?? 'carnival_core') as never;
const builds = (buildsArg ?? 'fresh,mid,full').split(',');
const party = Number(partyArg ?? 1);
const seeds = (seedsArg ?? '11,22,33').split(',').map(Number);

/** a save's Lost & Found as meta stats: none, half of Normal's perks, or all of Normal's and both tier shelves */
function meta(build: string): { axis: string; value: number }[] {
  const out: { axis: string; value: number }[] = [];
  for (const p of PERKS) {
    if (p.axis === 'reroll' || p.axis === 'banish' || p.switchable) continue;
    const lvl = build === 'fresh' ? 0 : build === 'mid' ? (p.tier ? 0 : Math.ceil(p.cap / 2)) : p.cap;
    if (lvl > 0) out.push({ axis: p.axis, value: p.mag * lvl });
  }
  return out;
}

const CHARS = ['carny', 'strongman', 'fortune_teller', 'ride_operator', 'lost_child', 'ringleader'];
console.log(`map ${map}, party ${party}, seeds ${seeds.join(',')}`);
console.log('tier       build  result (time / level / bosses / W=won, D=downs)            mean hurt   mean LT');
for (const tier of tiers) {
  for (const build of builds) {
    const cells: string[] = [];
    let hurt = 0, lt = 0;
    for (const seed of seeds) {
      const m = meta(build);
      const players = Array.from({ length: party }, (_, i) => ({ character: CHARS[(i + seed) % CHARS.length], meta: m }));
      const g = makeGame({ character: players[0].character, tier, seed, map, meta: m, players: party > 1 ? players : undefined });
      let s = 0;
      while (g.phase !== 'ended' && s < 2400 * 60) {
        if (g.draftPending(0)) smartDraft(g);
        if (g.phase === 'draft') for (let i = 1; i < g.players.length; i++) if (g.draftPending(i)) g.chooseDraft(0, i);
        for (let i = 0; i < g.players.length; i++) {
          g.setCtx(g.players[i]);
          smartPilot(g);
        }
        g.setCtx(g.players[0]);
        g.tick();
        s++;
      }
      const downs = g.players.reduce((n, p) => n + p.runDowns, 0);
      cells.push(`${Math.round(g.time)}s/L${g.level}/${g.bossKills}b${g.endStats?.won ? 'W' : ''}${downs ? `/D${downs}` : ''}`);
      hurt += g.damageTaken;
      lt += g.endStats?.lostTickets ?? 0;
    }
    console.log(`${tier.padEnd(10)} ${build.padEnd(6)} ${cells.join('  ').padEnd(60)} ${Math.round(hurt / seeds.length).toString().padStart(8)}  ${Math.round(lt / seeds.length).toString().padStart(8)}`);
  }
}
