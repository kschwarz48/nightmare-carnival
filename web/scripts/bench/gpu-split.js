// Where the GPU's frame goes (performance milestone): a heavy night frozen in place, then the same frame measured
// with one thing switched off at a time (the crowd, the moon's shadows, bloom, the grade, the Fun House's mirrors,
// half the resolution). GPU milliseconds from timer queries; the difference from the full frame is that part's cost.
//
//   cd desktop && npx electron bench.js --serve=../dist-bench --eval=../scripts/bench/gpu-split.js --out=../../artifacts/perf/gpu-split.json
//
// Runs inside the page (wrapped in an async function by the runner; the return value is the result).
const nc = window.__nc, app = nc.app, R = app.renderer;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LATE = { weapons: ['throwing_cards:8', 'grill:5', 'popcorn:7', 'mallet:7', 'death_card:2', 'darts:6'], passives: ['caffeine', 'energy_drink', 'strongman_belt', 'spectacles', 'foam_finger', 'sugar_rush'] };
const SCENES = [
  { name: 'carnival late, crowd 400', map: 'carnival_core', t: 1260 },
  { name: 'fun house late, crowd 400', map: 'fun_house', t: 1260 },
  { name: 'boardwalk late, crowd 400', map: 'boardwalk', t: 1260 },
  { name: 'ghost train late, crowd 400', map: 'ghost_train', t: 1300 },
];
const probe = async () => {
  await sleep(700); // shader variants and render targets settle
  const a = await nc.gpuProbe(120);
  return { gpu: a.gpu, cpu: a.cpu, drawCalls: a.drawCalls, trianglesM: a.trianglesM };
};
const out = [];
app.save.data.funhouseTester = app.save.data.boardwalkTester = app.save.data.ghosttrainTester = true;
for (const sc of SCENES) {
  app.save.data.settings.quality = 'high';
  app.applySettings();
  app.startRun({ character: 'carny', difficulty: 'midway', curse: false, map: sc.map, seed: 777 });
  const g = app.game;
  g.cfg.godMode = true;
  nc.advance(sc.t);
  g.weapons.list.length = 0;
  for (const spec of LATE.weapons) {
    const [id, lv] = spec.split(':');
    g.weapons.add(id);
    for (let i = 1; i < Number(lv); i++) g.weapons.levelUp(id);
  }
  g.player.passives.clear();
  for (const id of LATE.passives) g.player.addPassive(id);
  const wave = g.director.activeWave();
  for (let i = 0; i < 600 && g.active.length < 400; i++) g.director.spawnOne(wave);
  nc.advance(4); // the crowd closes in, the build fires
  app.draft.hide();
  app.hud.root.style.display = '';
  app.overlayPause = true; // frozen: every measurement draws the same frame
  await sleep(1500);
  const row = { scene: sc.name, enemies: g.active.length, batches: R.batches.size };
  // the crowd's distance models arrive from their worker a moment after each kind is first drawn (D-96)
  for (let i = 0; i < 100 && R.lodWaiting?.length; i++) await sleep(100);
  row.full = await probe();
  if (R.lodMode) {
    R.lodMode = 'off';
    row.fullModels = await probe();
    R.lodMode = 'auto';
  }
  // the crowd (its instanced models, in the main pass and the shadow pass): batches are refilled every frame from
  // the game, so skip the crowd's draw for a while
  R.drawEnemies = () => {};
  row.noCrowd = await probe();
  delete R.drawEnemies;
  // the moon's shadow pass (the map from the last frame kept, so no shader changes)
  R.renderer.shadowMap.autoUpdate = false;
  row.noShadowPass = await probe();
  R.renderer.shadowMap.autoUpdate = true;
  // the silhouettes of creatures behind scenery (D-58)
  const xrays = [...R.batches.values()].flatMap((b) => [b.xray, b.lodXray]).filter(Boolean).map((m) => m.material);
  for (const m of xrays) m.visible = false;
  row.noXray = await probe();
  for (const m of xrays) m.visible = true;
  // bloom, then the vintage grade
  const bloomOn = R.post.bloom.enabled;
  R.post.bloom.enabled = false;
  row.noBloom = await probe();
  R.post.bloom.enabled = bloomOn;
  const fw = R.world?.funhouse;
  if (fw) {
    const bc = fw.beforeComposite;
    fw.beforeComposite = () => {};
    row.noMirrors = await probe();
    fw.beforeComposite = bc;
  }
  // half the pixels in each direction (fill rate)
  const pr = R.pr;
  R.resize(innerWidth, innerHeight, pr * 0.5);
  row.halfRes = await probe();
  R.resize(innerWidth, innerHeight, pr);
  row.full2 = await probe();
  out.push(row);
  app.overlayPause = false;
  app.toMenu();
  await sleep(800);
}
return { canvas: [R.renderer.domElement.width, R.renderer.domElement.height], scenes: out };
