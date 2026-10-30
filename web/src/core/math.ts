// Small allocation-free math helpers. The simulation uses plain numbers (x, y) rather than
// vector objects in hot loops so nothing is allocated per tick.

export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function smoothstep(a: number, b: number, t: number): number {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}
export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(dist2(ax, ay, bx, by));
}
/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
export function angleDiff(a: number, b: number): number {
  return wrapAngle(b - a);
}
/** Squared distance from point P to segment AB. */
export function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + abx * t, cy = ay + aby * t;
  return dist2(px, py, cx, cy);
}
/** Is point inside the arc sector centered at (cx,cy), facing angle `a`, half-width `half`, radius r. */
export function inSector(px: number, py: number, cx: number, cy: number, a: number, half: number, r: number, pr = 0): boolean {
  const dx = px - cx, dy = py - cy;
  const d2 = dx * dx + dy * dy;
  const rr = r + pr;
  if (d2 > rr * rr) return false;
  if (d2 < pr * pr) return true;
  return Math.abs(angleDiff(a, Math.atan2(dy, dx))) <= half + (pr > 0 ? Math.atan2(pr, Math.sqrt(d2)) : 0);
}
export function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
export function easeInCubic(t: number): number {
  return t * t * t;
}
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}
