// Progression & economy tuning — the single home for XP, ticket, chest, healing and voucher curves.
// See docs/PROGRESSION.md for the measured curves and the reasoning behind every number here.

/**
 * XP needed to go from `level` to `level + 1`.
 * Piecewise-linear like the classic survivors curve: cheap early levels (a level every ~10 s in
 * the first minute), a steady climb through the midgame, and two "plateau" levels (20 and 40) that
 * cost double so the big power spikes around the first and third bosses get room to breathe.
 */
export const XP_CURVE = {
  first: 5,
  bands: [
    { upTo: 10, step: 5 },
    { upTo: 20, step: 9 },
    { upTo: 40, step: 13 },
    { upTo: Infinity, step: 16 },
  ],
  plateaus: { 20: 2, 40: 2 } as Record<number, number>,
};

const xpCache: number[] = [];
export function xpToNext(level: number): number {
  const l = Math.max(1, Math.floor(level));
  if (xpCache[l] !== undefined) return xpCache[l];
  let cost = XP_CURVE.first;
  for (let i = 2; i <= l; i++) {
    const band = XP_CURVE.bands.find((b) => i <= b.upTo)!;
    cost += band.step;
  }
  const v = cost * (XP_CURVE.plateaus[l] ?? 1);
  xpCache[l] = v;
  return v;
}

/** Ticket (XP) value economy. */
export const TICKETS = {
  /** Enemy ticket value grows with run time so XP keeps pace with the rising curve. */
  perMinute: 0.035,
  eliteMult: 5,
  /** After a boss falls the crowd thins for a while (recovery period) — kills there pay a little more. */
  recoveryBonus: 1.25,
  victoryLapMult: 3,
  endlessMult: 1.5,
  calliopeCrescendoMult: 1.5,
};

/** Healing economy (food pickups, fallbacks). */
export const HEALING = {
  foodFirst: [30, 50] as [number, number],
  /** Food interval range per Act (seconds) — pressure rises, so healing becomes a little more frequent. */
  foodInterval: [[70, 110], [65, 100], [60, 95], [55, 90]] as [number, number][],
  foodHealFrac: 0.2,
  foodHealMin: 20,
  funnelHealFrac: 0.12,
  /** Upgrade-pool-exhausted fallback (D-31). */
  fallbackHealFrac: 0.05,
};

/** Reward chests: sources and cadence (fewer, bigger moments now that each one is a prize-wheel show). */
export const CHESTS = {
  bossRolls: [4, 6] as [number, number],
  bruteRolls: [1, 2] as [number, number],
  eliteChance: 0.05,
  eventRolls: 2,
};

/**
 * Lost & Found Voucher — the fallback reward when every upgrade is owned (D-31). Paid into the
 * persistent meta currency immediately. Diminishing returns + a per-run cap keep it from becoming
 * a farm (Endless included): a winning night pays roughly 900–1,200 LT; vouchers top out at 120 LT.
 */
export const VOUCHER = {
  base: 6,
  perMinute: 0.25,
  decay: 0.9,
  min: 1,
  runCap: 120,
};

/** Value of the next voucher; 0 once this run's cap is reached (the window is shut for the night). */
export function voucherValue(minutes: number, taken: number, alreadyPaid: number, greed: number): number {
  if (alreadyPaid >= VOUCHER.runCap) return 0;
  const raw = (VOUCHER.base + VOUCHER.perMinute * minutes) * Math.pow(VOUCHER.decay, taken) * greed;
  const v = Math.max(VOUCHER.min, Math.round(raw));
  return Math.min(v, VOUCHER.runCap - alreadyPaid);
}

/** Spawn pacing helpers used by the director. */
export const PACING = {
  /** Fraction of each wave window over which density ramps toward the next wave's values. */
  waveBlendStart: 0.45,
  /** Breathing room after a boss falls. */
  recoverySeconds: 24,
  recoveryMinAliveScale: 0.35,
  recoveryIntervalScale: 2.0,
  /** Organic balloon drifts (replaces the fixed swarm metronome, D-33). */
  balloonMinGap: [10, 9, 8, 7] as number[],
  balloonMeanExtra: [9, 7, 6, 5] as number[],
  balloonSpeed: [300, 440] as [number, number],
};
