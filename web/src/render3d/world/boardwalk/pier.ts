// The Boardwalk's pier (D-68): weathered decks of cross planks on stringers, edge beams, rails along the
// neck and the long walk, and pilings standing in the sea (the water sits lower offshore, so they show),
// with cross-bracing under the platforms. One merged static mesh for the timber, one for the iron.

import * as THREE from 'three';
import { PIER, PIER_DECKS, type Rect, shoreBase } from '../../../data/boardwalk';
import { C, SURF, box, cyl, weather } from '../../core/geo';
import { ModelBuilder, PAL } from '../../models/kit';

const timber = weather(0x5a5048, 0.45, 0.03, 0x8a8278);
const darkTimber = weather(0x2e2924, 0.4, 0.04);

/** Where the pier's pilings stand (also the foam rings' and the spray's anchors). */
export function pilings(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const r of PIER_DECKS) {
    const edges: [number, number, number, number][] = [[r.x0, r.y0, r.x0, r.y1], [r.x1, r.y0, r.x1, r.y1], [r.x0, r.y1, r.x1, r.y1]];
    if (r !== PIER.neck) edges.push([r.x0, r.y0, r.x1, r.y0]);
    for (const [x0, y0, x1, y1] of edges) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.round(len / 130));
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
        // only where the sea is (the neck crosses the sand on short posts)
        if (y > shoreBase(x) - 120 && !out.some((p) => Math.abs(p.x - x) < 40 && Math.abs(p.y - y) < 40)) out.push({ x, y });
      }
    }
  }
  return out;
}

export function pierGeometry(): THREE.BufferGeometry {
  const m = new ModelBuilder();
  const deck = (r: Rect, along: 'x' | 'y') => {
    const w = r.x1 - r.x0, d = r.y1 - r.y0, cx = (r.x0 + r.x1) / 2, cz = (r.y0 + r.y1) / 2;
    // stringers beneath, planks across them with a little gap and a lot of variation
    for (let i = 0; i < 5; i++) {
      if (along === 'y') m.add(box(16, 14, d), { col: darkTimber, pos: [r.x0 + 30 + ((w - 60) * i) / 4, -12, cz], surf: SURF.wood });
      else m.add(box(w, 14, 16), { col: darkTimber, pos: [cx, -12, r.y0 + 30 + ((d - 60) * i) / 4], surf: SURF.wood });
    }
    const span = along === 'y' ? d : w;
    const n = Math.floor(span / 26);
    for (let i = 0; i < n; i++) {
      const t = -span / 2 + 13 + i * 26;
      const k = Math.sin(i * 12.9898 + cx * 0.01) * 43758.5453;
      const v = k - Math.floor(k);
      if (v > 0.965) continue; // a missing board here and there: the water shows through
      const col = weather(v > 0.5 ? 0x625850 : 0x544a42, 0.5, 0.05, 0x908880);
      if (along === 'y') m.add(box(w - 6 - v * 8, 5, 23), { col, pos: [cx + (v - 0.5) * 4, -2.5, cz + t], surf: SURF.wood });
      else m.add(box(23, 5, d - 6 - v * 8), { col, pos: [cx + t, -2.5, cz + (v - 0.5) * 4], surf: SURF.wood });
    }
    // edge beams (their faces show above the water)
    m.add(box(w + 10, 22, 10), { col: darkTimber, pos: [cx, -16, r.y1], surf: SURF.wood });
    m.add(box(w + 10, 22, 10), { col: darkTimber, pos: [cx, -16, r.y0], surf: SURF.wood });
    m.add(box(10, 22, d), { col: darkTimber, pos: [r.x0, -16, cz], surf: SURF.wood });
    m.add(box(10, 22, d), { col: darkTimber, pos: [r.x1, -16, cz], surf: SURF.wood });
  };
  deck(PIER.neck, 'y');
  deck(PIER.bait, 'x');
  deck(PIER.walk, 'y');
  deck(PIER.dock, 'x');
  deck(PIER.end, 'x');
  // rails along the neck and the long walk (open at the platforms)
  for (const r of [PIER.neck, PIER.walk]) {
    for (const x of [r.x0 + 6, r.x1 - 6]) {
      const y0 = r === PIER.neck ? r.y0 + 80 : r.y0, y1 = r.y1;
      for (let y = y0; y <= y1; y += 120) m.add(box(7, 52, 7), { col: timber, pos: [x, 26, y], surf: SURF.wood });
      m.add(box(6, 6, y1 - y0), { col: timber, pos: [x, 50, (y0 + y1) / 2], surf: SURF.wood });
      m.add(box(4, 4, y1 - y0), { col: timber, pos: [x, 28, (y0 + y1) / 2], surf: SURF.wood });
    }
  }
  // pilings: timber posts from the deck down into the sea, with barnacle-dark feet and cross-bracing
  const ps = pilings();
  for (const p of ps) {
    m.add(cyl(9, 11, 130, 8), { col: weather(0x3a342e, 0.5, 0.05, 0x22201c), pos: [p.x, -70, p.y], surf: SURF.wood });
    m.add(cyl(12, 12.5, 26, 8), { col: weather(0x1c2420, 0.6, 0.1, 0x3a4a3a), pos: [p.x, -52, p.y], surf: SURF.rubber });
  }
  for (const r of PIER_DECKS) {
    if (r === PIER.neck) continue;
    // diagonal bracing under each platform's south face (seen from the shore side camera)
    const n = Math.max(1, Math.round((r.x1 - r.x0) / 130));
    for (let i = 0; i < n; i++) {
      const x0 = r.x0 + ((r.x1 - r.x0) * i) / n, x1 = r.x0 + ((r.x1 - r.x0) * (i + 1)) / n;
      const mx = (x0 + x1) / 2, len = Math.hypot(x1 - x0, 50);
      m.add(box(len, 5, 5), { col: darkTimber, pos: [mx, -34, r.y1 - 4], rot: [0, 0, (i % 2 ? 1 : -1) * Math.atan2(50, x1 - x0)], surf: SURF.wood });
    }
  }
  // a few mooring cleats and coils of rope on the decks
  for (const [x, y] of [[-2420, 1700], [-2420, 1850], [-2120, 2250], [-2470, 2600], [-2470, 2750]] as [number, number][]) {
    m.add(box(26, 6, 8), { col: PAL.iron, pos: [x, 3, y], surf: SURF.iron });
    m.add(cyl(14, 14, 6, 12), { col: C(0x6a5a40), pos: [x - 30, 3, y], surf: SURF.cloth });
  }
  return m.build({ ao: 0.25 });
}
