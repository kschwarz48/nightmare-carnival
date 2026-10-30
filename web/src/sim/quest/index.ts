// Quest registry for every map. Importing this module registers the chains.
import { MAP_ID } from '../../data/quests';
import { LastSongChain } from './lastSong';
import { registerQuestChains } from './quest';

registerQuestChains(MAP_ID, (g) => new LastSongChain(g));

export { QuestSystem, QuestChain, type QuestCue } from './quest';
export { LastSongChain, LS } from './lastSong';
