// Shared simulation constants (kept separate to avoid import cycles with game.ts).
export const TICK = 1 / 60;
/** On-screen half extent in world units — spawn band & leash reference (Godot VIEW_HALF). */
export const VIEW_HALF_X = 980;
export const VIEW_HALF_Y = 680; // taller ground view under the angled 2.5D camera
/** D-79: every knockback lands a fifth softer than before. */
export const KB_SCALE = 0.8;
/**
 * D-79 (after the Crystal Orbs' barrier, D-74): knockback wears off. Each push adds one to a creature's
 * fatigue, which fades over KB_FATIGUE_S seconds; a push lands at fatigue^-KB_WEAR (the orbs' shove at ^-1.25).
 * Steady pushes 4 / 2 / 1 / 0.5 times a second land at 29 / 45 / 65 / 86% of a fresh one.
 */
export const KB_FATIGUE_S = 1.2;
export const KB_WEAR = 0.75;
/** `Game.credit` for damage that is nobody's: the night's own (the Boardwalk's coaster running the crowd down; D-85). */
export const NOBODY = -2;
/**
 * A co-op guest's interact press (D-101): where they stood on their own screen is believed within PRESS_REACH of
 * their copy on the host, and the clocks it showed up to PRESS_LATE seconds back.
 */
export const PRESS_REACH = 200;
export const PRESS_LATE = 1;
