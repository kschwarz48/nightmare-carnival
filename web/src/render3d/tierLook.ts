// The world tiers' looks (D-97, docs/WORLD_TIER_DESIGN.md §9): the same four worlds crossed over into the realm of
// the dead (Nightmare: cold spectral light, ghost flames, pale mist, wisps) or set burning (Hell: ember light, fire
// in the signs, ash and red-black smoke), from one data table over each world's own settings. Every knob is a
// choke point the worlds already share — the moon, the sky's hemisphere light, the shadow fill, the ground mist and
// fog, the practical-light pool (every lamp, bulb and fire passes through it), the emissive of signs and bulbs and
// the grade — so a tier changes all of a world at once, with no new draw calls. Telegraphs, collision and
// navigation stay as they are (telegraph decals don't pass through the pool or the emissive tint).

import type { TierId } from '../data/tiers';
import type { MapId } from '../data/maps';

type V3 = [number, number, number];

export interface TierLook {
  /** the moon's colour at night (multiplied into the world's own) and its strength */
  moon: V3;
  moonK: number;
  /** the sky's and the ground's hemisphere colours (blended into the world's), and its strength */
  sky: V3;
  ground: V3;
  hemiK: number;
  /** colour poured into unlit areas, the ground mist's colour and density, the fog's colour (mixes over the world's by `mix`) */
  fill: V3;
  mist: V3;
  mistK: number;
  fog: V3;
  mix: number;
  /** every practical light: blended toward this colour family (its luminance times `col`) by `k` */
  light: { col: V3; k: number; boost: number };
  /** the emissive of signs, bulbs and windows: toward `col` by `k` */
  emis: { col: V3; k: number };
  /** the grade: saturation, split toning (added to shadows / highlights) and an overall tint */
  sat: number;
  shadow: V3;
  high: V3;
  tint: V3;
  /** the darkest the night goes (the grade's floor: inky blue on Normal) */
  low: V3;
  /** the practical lights' flicker: Hell's burn like fires, Nightmare's breathe slowly */
  flicker: number;
  /** the tier's particles: drifting wisps or rising embers */
  motes: 'wisps' | 'embers' | null;
}

export const NORMAL_LOOK: TierLook = {
  moon: [1, 1, 1], moonK: 1, sky: [1, 1, 1], ground: [1, 1, 1], hemiK: 1,
  fill: [0, 0, 0], mist: [0, 0, 0], mistK: 1, fog: [0, 0, 0], mix: 0,
  light: { col: [1, 1, 1], k: 0, boost: 1 }, emis: { col: [1, 1, 1], k: 0 },
  sat: 1, shadow: [0, 0, 0], high: [0, 0, 0], tint: [1, 1, 1], low: [0.006, 0.009, 0.022], flicker: 0, motes: null,
};

const LOOKS: Record<Exclude<TierId, 'normal'>, TierLook> = {
  // the realm of the dead: a pale cyan moon, ghost-flame lamps, a pale spectral mist low over everything
  nightmare: {
    moon: [0.7, 0.95, 1.15], moonK: 0.85, sky: [0.6, 0.85, 1.1], ground: [0.5, 0.65, 0.85], hemiK: 0.85,
    fill: [0.025, 0.05, 0.1], mist: [0.04, 0.085, 0.11], mistK: 1.15, fog: [0.015, 0.035, 0.05], mix: 0.85,
    light: { col: [0.45, 1.0, 1.05], k: 0.8, boost: 0.95 }, emis: { col: [0.5, 1.0, 1.05], k: 0.65 },
    sat: 0.8, shadow: [-0.004, 0.008, 0.02], high: [-0.02, 0.02, 0.03], tint: [0.92, 1.0, 1.04], low: [0.003, 0.01, 0.02], flicker: 0.18, motes: 'wisps',
  },

  // burning: an ember moon behind smoke, fire in every lamp and sign, a red-black haze
  hell: {
    moon: [1.2, 0.5, 0.35], moonK: 0.7, sky: [1.1, 0.45, 0.32], ground: [1.2, 0.5, 0.3], hemiK: 0.8,
    fill: [0.06, 0.012, 0.01], mist: [0.085, 0.022, 0.012], mistK: 1.0, fog: [0.04, 0.008, 0.005], mix: 0.85,
    light: { col: [1.75, 0.45, 0.12], k: 0.78, boost: 1.2 }, emis: { col: [1.7, 0.42, 0.12], k: 0.68 },
    sat: 1.05, shadow: [0.012, -0.004, -0.008], high: [0.06, 0.0, -0.04], tint: [1.05, 0.92, 0.86], low: [0.018, 0.004, 0.004], flicker: 0.3, motes: 'embers',
  },

};

/** Per-map adjustments (the indoor Fun House keeps its haze lower; the Boardwalk's sea air). */
const MAP_TWEAKS: Partial<Record<MapId, Partial<Record<Exclude<TierId, 'normal'>, Partial<TierLook>>>>> = {
  fun_house: { nightmare: { mistK: 1.1 }, hell: { mistK: 1.0, moonK: 1 } },
  boardwalk: { nightmare: { mistK: 1.5 }, hell: { mistK: 1.3 } },
};

export function tierLook(tier: TierId, map: MapId): TierLook {
  if (tier === 'normal') return NORMAL_LOOK;
  return { ...LOOKS[tier], ...(MAP_TWEAKS[map]?.[tier] ?? {}) };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A world colour (0..1 rgb) under the look: multiplied by `mul`, then mixed toward `over` by `k`. */
export function lookColor(base: V3, mul: V3, over: V3 | null, k: number, out: V3): V3 {
  for (let i = 0; i < 3; i++) out[i] = lerp(base[i] * mul[i], over ? over[i] : base[i] * mul[i], k);
  return out;
}

/** A hex colour multiplied by `mul` (the hemisphere's sky and ground). */
export function tintHex(hex: number, mul: V3): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * mul[0]));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * mul[1]));
  const b = Math.min(255, Math.round((hex & 255) * mul[2]));
  return (r << 16) | (g << 8) | b;
}
