// Model registry: every entity kind maps to a procedural geometry builder plus how it animates,
// how it is scaled into the world, and its readability rim. Geometry is built lazily and cached.

import * as THREE from 'three';
import { CHARACTER_ANIM, CHARACTER_MODELS } from './characters';
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
  Object.entries(CHARACTER_MODELS).map(([id, build]) => [id, { build, anim: CHARACTER_ANIM[id], rim: [0.75, 0.68, 0.55, 0.55], shadow: true, scale: 1.08 } as ModelDef]),
);

export { ENEMY_MODELS, ITEM_MODELS };
