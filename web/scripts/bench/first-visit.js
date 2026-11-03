// A map's first night on a fresh page (D-96 check): over the 8 seconds from the start, when the night first draws (after
// its world is built and compiled behind the veil; at once in builds without it), the worst single frame, and when the
// last frame over 100 ms ended (smooth from then on).
//   cd desktop && npx electron bench.js --serve=../dist-bench --eval=../scripts/bench/first-visit.js --out=../../artifacts/perf/first-visit.json
const nc = window.__nc, app = nc.app, R = app.renderer;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
app.save.data.funhouseTester = app.save.data.boardwalkTester = app.save.data.ghosttrainTester = true;
const render = R.render;
for (const map of ['fun_house', 'boardwalk', 'ghost_train']) {
  let drawnAt = 0, last = 0, running = true;
  const gaps = [];
  R.render = function (g, ...rest) {
    if (!drawnAt && g === app.game) drawnAt = performance.now();
    return render.call(this, g, ...rest);
  };
  const t0 = performance.now();
  app.startRun({ character: 'carny', difficulty: 'midway', curse: false, map, seed: 3 });
  app.autopilot = true;
  const step = (t) => {
    if (last) gaps.push([t, t - last]);
    last = t;
    if (running) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  await sleep(8000);
  running = false;
  // the worst frame in the 8 seconds from the start, and when the last frame over 100 ms ended (smooth from then on)
  const worst = Math.max(...gaps.map((x) => x[1]));
  const lastBig = gaps.filter((x) => x[1] > 100).pop();
  out.push({ map, nightDrawsAfterMs: Math.round(drawnAt - t0), worstFrameMs: Math.round(worst), smoothFromMs: lastBig ? Math.round(lastBig[0] - t0) : 0, framesOver100: gaps.filter((x) => x[1] > 100).length });
  app.autopilot = false;
  app.toMenu();
  await sleep(800);
}
R.render = render;
return out;
