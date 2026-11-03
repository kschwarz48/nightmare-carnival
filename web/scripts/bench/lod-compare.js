// The crowd's distance models next to the full sculpts (D-96 visual check): a lineup of creatures from every map in
// the inspector, seen at play size and closer, and a late night's crowd, each drawn with the full models and with
// the plainer copies. Returns PNG data URLs (scripts/bench/split-shots.mjs writes them out) and the triangle counts.
//
//   cd desktop && npx electron bench.js --serve=../dist-bench --eval=../scripts/bench/lod-compare.js --out=../../artifacts/perf/lod-compare.json
const nc = window.__nc, app = nc.app, R = app.renderer;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (game) => {
  R.render(game, 1, 0);
  return R.renderer.domElement.toDataURL('image/png');
};
const shots = {};
const tris = {};
const both = async (name, game) => {
  for (const mode of ['off', 'on']) {
    R.lodMode = mode;
    for (let i = 0; i < 3; i++) R.render(game, 1, 0);
    await sleep(100);
    shots[`${name}-${mode}`] = shot(game);
    tris[`${name}-${mode}`] = R.renderer.info.render.triangles;
  }
  R.lodMode = 'auto';
};
const waitLods = async () => {
  for (let i = 0; i < 100 && R.lodWaiting.length; i++) {
    R.render(app.game, 1, 0);
    await sleep(100);
  }
};
app.save.data.funhouseTester = app.save.data.boardwalkTester = app.save.data.ghosttrainTester = true;
// 1. the lineup (game lighting, the game's camera)
await nc.inspect.open({ enemies: ['evil_clown', 'carnival_brute', 'marionette', 'ticket_taker', 'drowned', 'tidecaller', 'gt_porter', 'gt_navvy'], gap: 120 });
nc.inspect.view({ zoom: 1, yaw: 20, anim: 'move', t: 0.25 });
await waitLods();
const lineupWaiting = R.lodWaiting.length;
await both('lineup-play-size', app.game);
nc.inspect.view({ zoom: 2.5, yaw: 20, anim: 'move', t: 0.25 });
await both('lineup-zoom-2.5', app.game);
nc.inspect.view({ zoom: 1, yaw: 160, anim: 'move', t: 0.25 });
await both('lineup-play-size-back', app.game);
nc.inspect.close();
// 2. a late night's crowd, frozen
app.startRun({ character: 'carny', difficulty: 'midway', curse: false, map: 'carnival_core', seed: 777 });
const g = app.game;
g.cfg.godMode = true;
nc.advance(1200);
const wave = g.director.activeWave();
for (let i = 0; i < 500 && g.active.length < 300; i++) g.director.spawnOne(wave);
nc.advance(3);
app.draft.hide();
app.overlayPause = true;
app.hud.root.style.display = 'none';
await waitLods();
await both('carnival-late-crowd', g);
app.overlayPause = false;
app.toMenu();
return { canvas: [R.renderer.domElement.width, R.renderer.domElement.height], pxPerUnit: (R.cssH * R.pr) / R.viewH, lineupWaiting, tris, shots };
