// Camera constants shared by the renderer and anything that must line up visuals with the sim plane.

/** Camera elevation above the horizon. */
export const ELEVATION = (50 * Math.PI) / 180;
/** Southward shift that makes a point at height h project onto the sim position it represents. */
export const COT_EL = 1 / Math.tan(ELEVATION);
