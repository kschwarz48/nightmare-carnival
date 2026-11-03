// The crowd's distance models (D-96). A batch asks for its model's plainer copy the first time it is drawn; one
// worker simplifies the models one after another (render3d/core/simplify.ts) and the copy is attached when it
// arrives, a moment later. Until then, without workers, or for a model that is already plain, the full model draws.
import type * as THREE from 'three';
import { packGeometry, unpackGeometry, type PackedGeometry } from './sculptPack';

let worker: Worker | null | undefined;
/** null: no plainer copy (asked, and none came back) */
const done = new Map<string, THREE.BufferGeometry | null>();
const asked = new Set<string>();
/** bumps whenever a copy arrives, so the renderer looks again */
export let lodArrivals = 0;

function start(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') return (worker = null);
  try {
    worker = new Worker(new URL('./lodWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return (worker = null);
  }
  worker.onmessage = (e: MessageEvent<{ key: string; lod: PackedGeometry | null }>) => {
    done.set(e.data.key, e.data.lod ? unpackGeometry(e.data.lod) : null);
    lodArrivals++;
  };
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** Ask for `key`'s plainer copy (once). */
export function requestLod(key: string, geo: THREE.BufferGeometry): void {
  if (asked.has(key)) return;
  asked.add(key);
  const w = start();
  if (!w) {
    done.set(key, null);
    return;
  }
  const { packed, transfer } = packGeometry(geo);
  w.postMessage({ key, geo: packed }, transfer);
}

/** `key`'s plainer copy: undefined while it is coming, null if there is none. */
export function lodFor(key: string): THREE.BufferGeometry | null | undefined {
  return done.get(key);
}
