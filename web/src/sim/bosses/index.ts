import type { BossDef } from '../../data/bosses';
import type { Game } from '../game';
import type { BossBase, BossOpts } from './boss';
import { FerrisBoss } from './ferris';
import { PuppetBoss } from './puppet';
import { RingmasterBoss } from './ringmaster';
import { TentBoss } from './tent';
import { CalliopeBoss } from './calliope';
import { TwinsBoss } from './twins';
import { LookingGlassBoss } from './lookingGlass';
import { StringmistressBoss } from './stringmistress';
import { ProprietorBoss } from './proprietor';
import { UnreflectedBoss } from './unreflected';

export function createBoss(g: Game, def: BossDef, opts?: BossOpts): BossBase {
  switch (def.id) {
    case 'carnival_tent': return new TentBoss(g, def, opts);
    case 'ferris_wheel': return new FerrisBoss(g, def, opts);
    case 'puppet_king': return new PuppetBoss(g, def, opts);
    case 'ringmaster': return new RingmasterBoss(g, def, opts);
    case 'calliope': return new CalliopeBoss(g, def, opts);
    // the Fun House (D-63)
    case 'crooked_twins': return new TwinsBoss(g, def, opts);
    case 'looking_glass': return new LookingGlassBoss(g, def, opts);
    case 'stringmistress': return new StringmistressBoss(g, def, opts);
    case 'proprietor': return new ProprietorBoss(g, def, opts);
    case 'unreflected': return new UnreflectedBoss(g, def, opts);
  }
}
