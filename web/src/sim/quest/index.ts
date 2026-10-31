// Quest registry for every map. Importing this module registers the chains.
import { MAP_ID } from '../../data/quests';
import { LastSongChain } from './lastSong';
import { registerQuestChains } from './quest';
import { UnreflectedChain } from './unreflected';
import { SummersEndChain } from './summersEnd';

registerQuestChains(MAP_ID, (g) => new LastSongChain(g));
registerQuestChains('fun_house', (g) => new UnreflectedChain(g));
registerQuestChains('boardwalk', (g) => new SummersEndChain(g));

export { QuestSystem, QuestChain, type QuestCue } from './quest';
export { LastSongChain, LS } from './lastSong';
export { UnreflectedChain, UR, clockSpot } from './unreflected';
export { SummersEndChain, SE } from './summersEnd';
