// A/B switches for the benchmarks (engineering optimization pass): `?legacy` turns this pass's rendering
// and loading changes off, so one build can be measured both ways under identical conditions.
//   ?legacy            all of them
//   ?legacy=tiles,workers   just those (tiles, compile, workers, shaderchecks; the performance milestone, D-96:
//                           lod, areas, aa)
// Nothing in the game sets these; a URL without ?legacy behaves normally.

const legacy = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('legacy') : null;
const has = (k: string) => legacy !== null && (legacy === '' || legacy === 'all' || legacy.split(',').includes(k));

export const LEGACY = {
  /** every fragment evaluates every pooled light (no tiled culling) */
  tiles: has('tiles'),
  /** new batches compile their shaders on first draw (no background compile) */
  compile: has('compile'),
  /** sculpting and sound synthesis on the main thread (no workers) */
  workers: has('workers'),
  /** shipped builds read every shader program's info log */
  shaderChecks: has('shaderchecks'),
  /** (D-96) the crowd always draws its full sculpts (no distance models) */
  lod: has('lod'),
  /** (D-96) worlds draw every area's kit every frame (no area filing) */
  areas: has('areas'),
  /** (D-96) the canvas asks for a multisampled default framebuffer */
  aa: has('aa'),
};
