import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { BossBase, BossOpts } from './boss';
import { FerrisBoss } from './ferris';
import { PuppetBoss } from './puppet';
import { RingmasterBoss } from './ringmaster';
import { TentBoss } from './tent';
import { CalliopeBoss } from './calliope';

export function createBoss(g: Game, def: BossDef, opts?: BossOpts): BossBase {
  switch (def.id) {
    case 'carnival_tent': return new TentBoss(g, def, opts);
    case 'ferris_wheel': return new FerrisBoss(g, def, opts);
    case 'puppet_king': return new PuppetBoss(g, def, opts);
    case 'ringmaster': return new RingmasterBoss(g, def, opts);
    case 'calliope': return new CalliopeBoss(g, def, opts);
  }
}
