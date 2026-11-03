// Static batches filed by area (D-96). A world's kit is instanced one batch per kind of prop, and a batch is never
// frustum-culled, so a map larger than the view (the Ghost Train's six places, the Boardwalk's 8,000-unit front)
// drew every lamp, bench and booth on the map every frame, in the picture and in the moon's shadow. Filing each
// kind's batch by area, and drawing only the areas the view reaches, changes nothing on screen: a hidden area lies
// wholly outside the view, its margin wider than anything standing near its edge reaches.
import type { StaticBatch } from '../core/batch';
import { LEGACY } from '../../core/flags';

/** Area filing on (dev tools switch it off to compare: nothing on screen should change; `?legacy=areas`). */
export const areaFiling = { on: !LEGACY.areas };

export interface Area {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export class AreaBatches {
  private lists: StaticBatch[][];

  /** `areas` in world units; `margin`: how far past an area's edge its things may reach into view */
  constructor(readonly areas: readonly Area[], private margin = 400) {
    this.lists = areas.map(() => []);
  }

  /** The area a point lies in (the first that holds it), or -1. */
  at(x: number, y: number): number {
    return this.areas.findIndex((a) => x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1);
  }

  add(area: number, b: StaticBatch): void {
    this.lists[area].push(b);
  }

  /** Show the batches of the areas the view rectangle reaches. */
  update(v: Area): void {
    const m = this.margin;
    for (let i = 0; i < this.areas.length; i++) {
      const a = this.areas[i];
      const seen = !areaFiling.on || (v.x1 > a.x0 - m && v.x0 < a.x1 + m && v.y1 > a.y0 - m && v.y0 < a.y1 + m);
      for (const b of this.lists[i]) b.mesh.visible = seen;
    }
  }
}
