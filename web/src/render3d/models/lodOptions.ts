// How far the crowd's distance models are simplified (D-96): about 30% of the triangles, no fold that moves the
// surface more than 1.2 model units (finer than the sculpts' own mesh cells, 1.5 to 3 units).
import type { SimplifyOptions } from '../core/simplify';

export const LOD_OPTIONS: SimplifyOptions = { ratio: 0.3, maxError: 1.2 };
