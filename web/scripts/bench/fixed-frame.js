// One fixed frame for comparing builds or switches (D-96): a Carnival night 20 seconds in with the crowd cleared, the
// renderer's clock and effects reset and the film grain off, drawn with no time passing; returns it as a PNG.
//   cd desktop && npx electron bench.js --serve=../dist-bench [--query=legacy=aa] --eval=../scripts/bench/fixed-frame.js --out=x.json
const nc = window.__nc, app = nc.app, R = app.renderer;
app.startRun({ character: 'carny', difficulty: 'midway', curse: false, map: 'carnival_core', seed: 777 });
const g = app.game;
g.cfg.godMode = true;
nc.advance(20);
app.draft.hide();
app.overlayPause = true;
app.hud.root.style.display = 'none';
await new Promise((r) => setTimeout(r, 1000));
// nothing that depends on how the bot played: no crowd, pickups or shots, the player placed and posed
for (const e of g.active) e.alive = false;
for (const list of [g.pickups, g.projs, g.bullets, g.hazards, g.zones, g.summons]) for (const o of list) o.alive = false;
const p = g.player;
p.x = p.px = 0;
p.y = p.py = 300;
p.vx = p.vy = 0;
p.moving = false;
p.animT = 0;
p.faceX = 0;
p.faceY = 1;
p.facing = 1;
R.post.grade.uniforms.uGrain.value = 0;
R.fx.clear();
R.yaw.clear(); // facings are smoothed from frame to frame: start each from where it points
R.time = 100;
R.snapCamera(g.player.x, g.player.y);
for (let i = 0; i < 3; i++) R.render(g, 1, 0);
return { shots: { frame: R.renderer.domElement.toDataURL('image/png') } };
