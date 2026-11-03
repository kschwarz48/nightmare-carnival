// Area filing changes nothing on screen (D-96 check): the same frozen frame drawn with every area shown and with
// only the areas the view reaches, at places either side of the Boardwalk's strip edges and in each of the Ghost
// Train's places; counts the pixels that differ. Saves one pair of PNGs per map (scripts/bench/split-shots.mjs).
//   cd desktop && npx electron bench.js --serve=../dist-bench --eval=../scripts/bench/area-compare.js --out=../../artifacts/perf/area-compare.json
const nc = window.__nc, app = nc.app, R = app.renderer;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const grab = (g) => {
  R.render(g, 1, 0);
  const gl = R.renderer.getContext();
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
};
const diff = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 2 || Math.abs(a[i + 1] - b[i + 1]) > 2 || Math.abs(a[i + 2] - b[i + 2]) > 2) n++;
  return n;
};
const out = { rows: [], shots: {} };
// the grade's film grain changes every frame: off, so only a real difference shows
const grain = R.post.grade.uniforms.uGrain;
const grainWas = grain.value;
grain.value = 0;
app.save.data.boardwalkTester = app.save.data.ghosttrainTester = true;
const spots = {
  boardwalk: [[-3500, -200], [-2300, 0], [-2050, 300], [-1950, -500], [-1300, 0], [0, 0], [1950, 0], [2050, 600], [2300, -300], [3500, 0]],
  ghost_train: [[0, 0], [-1800, 600], [6400, 0], [7900, -500], [0, 4800], [6400, 4800], [0, 9600], [6400, 9600]],
};
for (const [map, list] of Object.entries(spots)) {
  app.startRun({ character: 'carny', difficulty: 'midway', curse: false, map, seed: 777 });
  const g = app.game;
  g.cfg.godMode = true;
  nc.advance(20);
  for (const e of g.active) e.alive = false;
  app.draft.hide();
  app.overlayPause = true;
  await sleep(500);
  for (const [x, y] of list) {
    g.player.x = g.player.px = x;
    g.player.y = g.player.py = y;
    R.snapCamera(x, y);
    await sleep(300);
    // both pictures in one go (no frame of the game's own loop between them, so nothing animated moves on)
    nc.areaFiling.on = true;
    for (let i = 0; i < 3; i++) R.render(g, 1, 0);
    const on = grab(g);
    const callsOn = R.renderer.info.render.calls;
    nc.areaFiling.on = false;
    for (let i = 0; i < 3; i++) R.render(g, 1, 0);
    const off = grab(g);
    const callsOff = R.renderer.info.render.calls;
    out.rows.push({ map, x, y, differing: diff(on, off), of: on.length / 4, drawCalls: [callsOff, callsOn] });
    if (x === list[2][0] && y === list[2][1]) {
      nc.areaFiling.on = true;
      R.render(g, 1, 0);
      out.shots[`${map}-filed`] = R.renderer.domElement.toDataURL('image/png');
      nc.areaFiling.on = false;
      R.render(g, 1, 0);
      out.shots[`${map}-all`] = R.renderer.domElement.toDataURL('image/png');
    }
  }
  nc.areaFiling.on = true;
  app.overlayPause = false;
  app.toMenu();
  await sleep(500);
}
grain.value = grainWas;
return out;
