// Model registry: every entity kind maps to a procedural geometry builder plus how it animates,
// how it is scaled into the world, and its readability rim. Geometry is built lazily and cached.

import * as THREE from 'three';
import { CHARACTER_IDS, characterModel } from './characters';
import type { Rig } from '../sculpt/rig';
import { ENEMY_MODELS } from './enemies';
import { ITEM_MODELS } from './items';

export type Anim = { a: [number, number, number, number]; b: [number, number, number, number] };

export interface ModelDef {
  build: () => THREE.BufferGeometry;
  anim?: Anim;
  /** Designed footprint radius (model units) — entities are scaled so this matches their sim radius. */
  radius?: number;
  /** Rim light colour + strength: silhouettes stay readable in the dark. */
  rim?: [number, number, number, number];
  shadow?: boolean;
  /** Hover height above the ground (balloons, doves). */
  hover?: number;
  /** Fixed world scale (ignores sim radius). */
  scale?: number;
  emitBoost?: number;
  /** Sculpted + skeletal models: the rig whose bone texture skins the geometry. */
  rig?: () => Rig;
}

const cache = new Map<string, THREE.BufferGeometry>();

export function geometryFor(key: string, def: ModelDef): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    g = def.build();
    cache.set(key, g);
  }
  return g;
}

export const CHARACTERS: Record<string, ModelDef> = Object.fromEntries(
  CHARACTER_IDS.map((id) => [id, { build: () => characterModel(id).geo, rig: () => characterModel(id).rig, rim: [0.75, 0.72, 0.68, 0.22], shadow: true, scale: 1.08 } as ModelDef]),
);

export { ENEMY_MODELS, ITEM_MODELS };

/** Build the sculpted crowd ahead of time (yielding so the loading screen stays alive). */
export async function warmModels(onProgress: (p: number) => void, characters: string[] = []): Promise<void> {
  const { CREATURE_IDS, creatureModel } = await import('./creatures');
  const jobs: (() => unknown)[] = [...CREATURE_IDS.map((id) => () => creatureModel(id)), ...characters.map((id) => () => characterModel(id))];
  for (let i = 0; i < jobs.length; i++) {
    jobs[i]();
    onProgress((i + 1) / jobs.length);
    await new Promise((r) => setTimeout(r, 0));
  }
}
