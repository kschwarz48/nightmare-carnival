// Companions (D-84): pets that follow you through every night and around the Midway, each with a small passive of
// its own. Each is brought along by an achievement that can be earned on any map (data/meta.ts), and chosen in
// character select or from the Midway's menu. The models are render3d/models/pets.ts; the portraits render/art/pets.ts.

import type { StatAxis } from './weapons';

export type PetId = 'milo' | 'augustus';

export interface PetDef {
  id: PetId;
  name: string;
  breed: string;
  /** the achievement that brings them along */
  achievement: string;
  /** the passive, as shown and as applied to the player's stats when a night (or the Midway) begins */
  buffName: string;
  buff: string;
  effects: { axis: StatAxis; v: number }[];
  lore: string;
}

export const PETS: PetDef[] = [
  {
    id: 'milo', name: 'Milo', breed: 'Cavapoo', achievement: 'pet_milo',
    buffName: 'Fetch', buff: '+30% pickup radius, +6% XP', effects: [{ axis: 'pickup', v: 0.3 }, { axis: 'xp', v: 0.06 }],
    lore: 'A black-and-white Cavapoo with a bed-head and the tip of his tongue always showing. He brings back every ticket he can find, and a few he should not.',
  },
  {
    id: 'augustus', name: 'Augustus', breed: 'Russian Blue', achievement: 'pet_augustus',
    buffName: 'Feline Grace', buff: '+8% move speed, +6% crit chance', effects: [{ axis: 'moveSpeed', v: 0.08 }, { axis: 'critChance', v: 0.06 }],
    lore: 'A Russian Blue with silver-tipped fur and lamp-green eyes. He has seen nine nights like this one, and none of them impressed him.',
  },
];

export const PET_MAP: Record<string, PetDef> = Object.fromEntries(PETS.map((p) => [p.id, p]));

export function isPetId(v: unknown): v is PetId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PET_MAP, v);
}
