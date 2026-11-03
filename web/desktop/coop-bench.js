// @ts-check
// Co-op benchmark (performance milestone, D-96): a host window and a guest window in one Electron process, each
// with its own in-memory storage (two fresh saves, two peers), joined over real WebRTC through the PeerJS broker
// as every co-op night is. The host's autopilot plays a night on the chosen map; then both windows measure the
// same stretch of real frames: frame pacing, the CPU split (net, sim, render, HUD) and the link's diagnostics
// (RTT, jitter, snapshot rate and size, the host's encoding and the guest's decoding per snapshot, messages/s).
// Both windows share this PC's CPU and GPU, so read their costs, not their frame rates, as a real pair's.
//
//   cd desktop && npx electron coop-bench.js --serve=../dist-bench [--map=ghost_train] [--seconds=30] [--out=file.json]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { serveDir } = require('./serve');

const arg = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const MAP = arg('map', 'ghost_train');
const SECONDS = Number(arg('seconds', '30'));
const OUT = path.resolve(arg('out', path.join(__dirname, '..', '..', 'artifacts', 'perf', 'coop.json')));
app.commandLine.appendSwitch('enable-precise-memory-info');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.setPath('userData', path.join(require('node:os').tmpdir(), 'nc-coop-bench'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const serve = arg('serve', '');
  const url = serve ? (await serveDir(serve)).url : arg('url', 'http://127.0.0.1:5173/');
  const win = (x, partition) => new BrowserWindow({ x, y: 40, width: 1280, height: 720, useContentSize: true, show: true, backgroundColor: '#07040c', webPreferences: { partition, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  const host = win(20, 'nc-coop-host'), guest = win(1320, 'nc-coop-guest');
  const js = (w, code) => w.webContents.executeJavaScript(code, true);
  await Promise.all([host.loadURL(url), guest.loadURL(url)]);
  const ready = async (w) => {
    for (let i = 0; i < 600; i++) {
      if (await js(w, '!!(window.__nc && window.__nc.app && window.__nc.app.renderer)')) return;
      await sleep(200);
    }
    throw new Error('the game did not boot');
  };
  await Promise.all([ready(host), ready(guest)]);
  const out = { at: new Date().toISOString(), url: serve ? `serve ${serve}` : url, map: MAP, seconds: SECONDS, versions: { electron: process.versions.electron, chrome: process.versions.chrome } };
  // each window's first visit to the map builds its world: timed here, solo, so the co-op night starts warm
  const firstStart = `(async () => { const a = window.__nc.app; a.save.data.funhouseTester = a.save.data.boardwalkTester = a.save.data.ghosttrainTester = true;
    const t0 = performance.now(); a.startRun({ character: 'carny', difficulty: 'midway', curse: false, map: '${MAP}', seed: 5 }); const ms = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 1500)); a.toMenu(); return Math.round(ms); })()`;
  out.firstStartMs = { host: await js(host, firstStart), guest: await js(guest, firstStart) };
  console.log('first start (world build) ms', JSON.stringify(out.firstStartMs));
  const code = await js(host, `window.__nc.coop.host('Kevin')`);
  if (typeof code !== 'string' || code.length < 4) throw new Error(`hosting failed: ${JSON.stringify(code)}`);
  const joined = await js(guest, `window.__nc.coop.join(${JSON.stringify(code)}, 'Brother', 'strongman').then((l) => !!l && typeof l === 'object')`);
  if (!joined) throw new Error('the guest could not join');
  await sleep(1500);
  await js(host, `window.__nc.app.net.host.setMap('${MAP}')`);
  await sleep(500);
  const state = await js(host, `window.__nc.coop.start('carny')`);
  console.log('started', code, state);
  await js(host, `(() => { const a = window.__nc.app; window.__nc.coop.autopick(true); a.autopilot = true; const t = setInterval(() => { if (a.game) { a.game.cfg.godMode = true; clearInterval(t); } }, 100); })()`);
  await js(guest, `window.__nc.coop.autopick(true)`);
  // the night settles in (crowd, first drafts), then both measure the same stretch
  await sleep(20000);
  const [h, g] = await Promise.all([js(host, `window.__nc.measure(${SECONDS})`), js(guest, `window.__nc.measure(${SECONDS})`)]);
  Object.assign(out, { host: h, guest: g });
  console.log('HOST', JSON.stringify(h));
  console.log('GUEST', JSON.stringify(g));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('saved', OUT);
  app.quit();
}).catch((e) => {
  console.error(String(e));
  app.exit(2);
});
