// The base every boss rig builds on: one actor material (and its shadow-depth twin) for the whole
// model, helpers to hang meshes and joints, and the per-frame object state (flash, wind-up, rim).

import * as THREE from 'three';
import type { BossBase } from '../sim/bosses/boss';
import { actorDepthMaterial, actorMaterial, setObjectState } from './core/materials';

export abstract class Rig {
  group = new THREE.Group();
  mat = actorMaterial({ emitBoost: 3, matte: true, detail: true });
  depth = actorDepthMaterial(this.mat);
  constructor(scene: THREE.Scene) {
    this.group.visible = false;
    scene.add(this.group);
  }
  mesh(geo: THREE.BufferGeometry, parent: THREE.Object3D = this.group, shadow = true): THREE.Mesh {
    const m = new THREE.Mesh(geo, this.mat);
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.customDepthMaterial = this.depth;
    m.frustumCulled = false;
    parent.add(m);
    return m;
  }
  node(parent: THREE.Object3D = this.group, x = 0, y = 0, z = 0): THREE.Group {
    const n = new THREE.Group();
    n.position.set(x, y, z);
    parent.add(n);
    return n;
  }
  state(b: BossBase, time: number, tint: [number, number, number, number] = [1, 1, 1, 1], rim: [number, number, number, number] = [0.9, 0.5, 0.3, 0.5]): void {
    const fl = b.flash * 0.7 + (b.transitioning ? 0.45 + 0.15 * Math.sin(time * 5) : 0);
    setObjectState(this.mat, time * 2, b.windup, Math.min(1, fl), 1, tint, b.windup > 0.05 ? [1, 0.3, 0.12, 0.8 + b.windup * 1.5] : rim);
  }
}
