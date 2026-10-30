// Quest-state framework for hidden, multi-step environmental Easter eggs (Zombies-style).
// A map registers quest chains; each chain is a deterministic state machine advanced by sim time
// and gameplay hooks (kills, boss defeats). Chains communicate only through `bus.emit('quest', …)`
// cues — renderer/audio turn those into diegetic feedback. There is deliberately no quest UI.

import type { Enemy } from '../entities';
import type { Game } from '../game';

export interface QuestCue {
  chain: string;
  event: string;
  x?: number;
  y?: number;
  /** Generic numeric payload (lamp index, pitch, progress…). */
  a?: number;
  b?: number;
  text?: string;
}

export abstract class QuestChain {
  abstract readonly id: string;
  stage = 0;
  constructor(protected g: Game) {}
  /** Called once when the run starts. */
  init(): void {}
  update(_dt: number): void {}
  onKill(_e: Enemy): void {}
  /** Return true to take over the default handling of this boss defeat. */
  onBossDefeated(_id: string): boolean {
    return false;
  }
  get complete(): boolean {
    return false;
  }
  protected cue(event: string, data: Omit<QuestCue, 'chain' | 'event'> = {}): void {
    this.g.bus.emit('quest', { chain: this.id, event, ...data });
  }
}

export type ChainFactory = (g: Game) => QuestChain;

/** Map id → quest chains available on that map. Future maps register their own chains here. */
const REGISTRY: Record<string, ChainFactory[]> = {};

export function registerQuestChains(mapId: string, ...factories: ChainFactory[]): void {
  (REGISTRY[mapId] ??= []).push(...factories);
}

export class QuestSystem {
  chains: QuestChain[] = [];

  constructor(g: Game, mapId: string) {
    for (const make of REGISTRY[mapId] ?? []) this.chains.push(make(g));
    for (const c of this.chains) c.init();
  }

  get<T extends QuestChain>(id: string): T | undefined {
    return this.chains.find((c) => c.id === id) as T | undefined;
  }

  update(dt: number): void {
    for (const c of this.chains) c.update(dt);
  }

  onKill(e: Enemy): void {
    for (const c of this.chains) c.onKill(e);
  }

  onBossDefeated(id: string): boolean {
    let handled = false;
    for (const c of this.chains) handled = c.onBossDefeated(id) || handled;
    return handled;
  }
}
