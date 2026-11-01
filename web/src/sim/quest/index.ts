// Quest registry for every map. Importing this module registers the chains.
import { MAP_ID } from '../../data/quests';
import { LastSongChain } from './lastSong';
import { registerQuestChains } from './quest';
import { UnreflectedChain } from './unreflected';
import { SummersEndChain } from './summersEnd';
import { LastTrainChain } from './lastTrain';
import { LineChain } from './gtLine';

registerQuestChains(MAP_ID, (g) => new LastSongChain(g));
registerQuestChains('fun_house', (g) => new UnreflectedChain(g));
registerQuestChains('boardwalk', (g) => new SummersEndChain(g));
// the Ghost Train (D-80): the hidden quest first (its fixtures answer interact before the line's own)
registerQuestChains('ghost_train', (g) => new LastTrainChain(g), (g) => new LineChain(g));

export { QuestSystem, QuestChain, type QuestCue } from './quest';
export { LastSongChain, LS } from './lastSong';
export { UnreflectedChain, UR, clockSpot } from './unreflected';
export { SummersEndChain, SE } from './summersEnd';
export { LastTrainChain, LT } from './lastTrain';
