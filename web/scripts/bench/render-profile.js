// Where the frame's CPU goes in a heavy night (performance milestone): a late crowd on a map, played by the
// autopilot in real time, its seconds marked for the CPU profiler (desktop/bench.js --profiles saves them).
//   cd desktop && npx electron bench.js --serve=../dist-bench --eval=../scripts/bench/render-profile.js --profiles=../../artifacts/perf/render
const nc = window.__nc, app = nc.app;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LATE = { weapons: ['throwing_cards:8', 'grill:5', 'popcorn:7', 'mallet:7', 'death_card:2', 'darts:6'], passives: ['caffeine', 'energy_drink', 'strongman_belt', 'spectacles', 'foam_finger', 'sugar_rush'] };
const out = {};
app.save.data.funhouseTester = app.save.data.boardwalkTester = app.save.data.ghosttrainTester = true;
for (const [name, map, t] of [['boardwalk', 'boardwalk', 1260], ['funhouse', 'fun_house', 1260], ['ghosttrain', 'ghost_train', 1300]]) {
  console.log(`${name}: starting`);
  app.startRun({ character: 'carny', difficulty: 'midway', curse: false, map, seed: 777 });
  const g = app.game;
  g.cfg.godMode = true;
  nc.advance(t);
  g.weapons.list.length = 0;
  for (const spec of LATE.weapons) {
    const [id, lv] = spec.split(':');
    g.weapons.add(id);
    for (let i = 1; i < Number(lv); i++) g.weapons.levelUp(id);
  }
  g.player.passives.clear();
  for (const id of LATE.passives) g.player.addPassive(id);
  app.draft.hide();
  app.overlayPause = false;
  app.hud.root.style.display = '';
  app.autopilot = true;
  const keep = setInterval(() => {
    if (app.prize.active) { app.prize.finishNow(); app.overlayPause = false; }
    if (g.phase === 'draft') app.pickDraft(0);
    const wave = g.director.activeWave();
    for (let i = 0; i < 40 && g.active.length < 400; i++) g.director.spawnOne(wave);
  }, 200);
  console.log(`${name}: fast-forwarded, ${g.active.length} creatures`);
  await sleep(4000);
  console.log(`${name}: profiling`);
  console.profile(name);
  await sleep(8000);
  console.profileEnd(name);
  clearInterval(keep);
  out[name] = { enemies: g.active.length };
  app.autopilot = false;
  app.toMenu();
  await sleep(500);
}
return out;
