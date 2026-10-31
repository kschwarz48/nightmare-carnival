// Packing a sculpted model (geometry + baked rig) into plain typed arrays and back, so a worker can
// build it and the page can install it without copying (engineering optimization pass).
import * as THREE from 'three';
import { Rig, type RigData } from '../sculpt/rig';
import type { SculptModel } from './characters';

export interface SculptJob { kind: 'character' | 'creature'; id: string }

type Arr = Float32Array | Uint32Array | Uint16Array | Int16Array | Uint8Array | Int8Array | Int32Array;

export interface PackedModel {
  attrs: { name: string; array: Arr; itemSize: number; normalized: boolean }[];
  index: Uint32Array | Uint16Array | null;
  rig: RigData;
}

export function packModel(m: SculptModel): { packed: PackedModel; transfer: Transferable[] } {
  const g = m.geo;
  const transfer: Transferable[] = [];
  const attrs = Object.entries(g.attributes).map(([name, a]) => {
    const ba = a as THREE.BufferAttribute;
    const array = (ba.array as Arr).slice();
    transfer.push(array.buffer);
    return { name, array, itemSize: ba.itemSize, normalized: ba.normalized };
  });
  const index = g.index ? ((g.index.array as Uint32Array | Uint16Array).slice() as Uint32Array | Uint16Array) : null;
  if (index) transfer.push(index.buffer);
  const rig = m.rig.pack();
  const data = rig.data.slice();
  transfer.push(data.buffer);
  return { packed: { attrs, index, rig: { ...rig, data } }, transfer };
}

export function unpackModel(p: PackedModel): SculptModel {
  const geo = new THREE.BufferGeometry();
  for (const a of p.attrs) geo.setAttribute(a.name, new THREE.BufferAttribute(a.array, a.itemSize, a.normalized));
  if (p.index) geo.setIndex(new THREE.BufferAttribute(p.index, 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return { geo, rig: Rig.restore(p.rig) };
}
