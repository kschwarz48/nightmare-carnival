// Long-session check (performance milestone): several nights on every map back to back in one page, as a player
// keeps playing, measuring what stays behind after each night: the JS heap after a full collection, the renderer's
// live geometries, textures and shader programs, and the page's DOM nodes. Growth that keeps climbing from round to
// round is a leak; a step up on a map's first visit that then holds steady is its models and shaders being built.
//
//   cd desktop && npx electron bench.js --serve=../dist-bench --jsflags=--expose-gc --eval=../scripts/bench/long-session.js --out=../../artifacts/perf/long-session.json
//
// Runs inside the page (the runner wraps it in an async function; its return value is the result). Each night
// plays `SIM` seconds headless with the autopilot, then `REAL` seconds of real frames, then goes back to the menu.
// It also times each start (the synchronous startRun: a map's world is built on its first visit) and the worst
// frame of the night's first seconds of real frames, so a first visit's stall shows against later ones.
const nc = window.__nc, app = nc.app;
const ROUNDS = 3, SIM = 150, REAL = 6;
const maps = ['carnival_core', 'fun_house', 'boardwalk', 'ghost_train'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** the longest gap between frames over the next `ms` */
const worstFrame = (ms) => new Promise((res) => {
  let last = 0, worst = 0;
  const t0 = performance.now();
  const step = (t) => {
    if (last) worst = Math.max(worst, t - last);
    last = t;
    if (t - t0 < ms) requestAnimationFrame(step);
    else res(Math.round(worst));
  };
  requestAnimationFrame(step);
});
const collect = async () => {
  for (let i = 0; i < 3; i++) {
    window.gc?.();
    await sleep(150);
  }
};
const snap = async (label, extra = {}) => {
  await collect();
  const info = app.renderer.renderer.info;
  return {
    label, ...extra,
    heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1),
    totalHeapMB: +(performance.memory.totalJSHeapSize / 1048576).toFixed(1),
    geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0,
    dom: document.getElementsByTagName('*').length,
  };
};
const out = [await snap('boot (menu)')];
app.save.data.funhouseTester = app.save.data.boardwalkTester = app.save.data.ghosttrainTester = true;
const t0 = performance.now();
for (let round = 0; round < ROUNDS; round++) {
  for (const map of maps) {
    const s0 = performance.now();
    app.startRun({ character: ['carny', 'strongman', 'fortune_teller'][round % 3], difficulty: 'midway', curse: false, map, seed: 900 + round });
    const startMs = Math.round(performance.now() - s0);
    const g = app.game;
    g.cfg.godMode = true;
    // the first real seconds of the night, before the fast-forward: new models, shaders and the world's first draws
    app.autopilot = true;
    const firstWorstMs = await worstFrame(3000);
    nc.advance(SIM);
    app.draft.hide();
    app.overlayPause = false;
    app.hud.root.style.display = '';
    app.autopilot = true;
    const keeper = setInterval(() => {
      if (app.prize.active) { app.prize.finishNow(); app.overlayPause = false; }
      if (app.game?.phase === 'draft') app.pickDraft(0);
    }, 200);
    await sleep(REAL * 1000);
    clearInterval(keeper);
    const during = { startMs, firstWorstMs, enemies: g.active.length, nightHeapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) };
    app.autopilot = false;
    app.toMenu();
    await sleep(1500);
    out.push(await snap(`${map} round ${round + 1}`, { ...during, nightMs: Math.round(performance.now() - s0) }));
  }
}
return { minutes: +((performance.now() - t0) / 60000).toFixed(1), gcExposed: typeof window.gc === 'function', samples: out };
