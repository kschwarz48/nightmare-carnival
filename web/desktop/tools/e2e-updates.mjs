// End-to-end check of the desktop shell and the live-update system (engineering optimization pass).
//
//   node tools/e2e-updates.mjs          (from web/desktop; opens the app for about two minutes)
//
// It builds the game (with the dev tools, VITE_DEVTOOLS=1) into web/dist-e2e, serves it on
// http://127.0.0.1:4180 from a tiny static server of its own, launches the real shell (main.js) against
// it with Chromium's remote debugging, and drives these scenarios through the page:
//   security  the bridge exists; no Node in the page; window.open is denied; navigation is pinned
//   A         a new build goes live while the player is at the menu: Restart & Update is offered at once
//   E         Restart & Update reloads into the new build, which confirms it ("Updated to version …")
//   B         a new build goes live during a night: nothing shows until the night ends
//   D         the server disappears before the restart: the app stays put and says so
//   F         a shell update (faked) arrives: refused mid-night, offered after, installs from the card
// Each step prints PASS/FAIL; the exit code is the number of failures.
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.join(here, '..');
const WEB = path.join(DESKTOP, '..');
const DIST = path.join(WEB, 'dist-e2e');
const PORT = 4180, DEBUG = 9230;
const electron = createRequire(path.join(DESKTOP, 'package.json'))('electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

function build(label) {
  console.log(`building the game (${label})…`);
  const r = spawnSync('npx', ['vite', 'build', '--outDir', 'dist-e2e', '--logLevel', 'error'], { cwd: WEB, env: { ...process.env, VITE_DEVTOOLS: '1' }, shell: true, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('build failed');
}

// ---- a static server for dist-e2e that can be switched off (the "offline" scenario)
let serving = true;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  if (!serving) return req.socket.destroy();
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, url === '/' ? 'index.html' : url);
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', file.endsWith('version.json') || file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable');
  createReadStream(file).pipe(res);
});

// ---- Chromium remote debugging: evaluate in the page (a fresh connection per call, so a reload of
// the page can never leave a stale one behind)
let ws = null, seq = 0;
const pending = new Map();
async function pageTarget() {
  const list = await (await fetch(`http://127.0.0.1:${DEBUG}/json`)).json();
  return list.find((t) => t.type === 'page' && t.url.startsWith(`http://127.0.0.1:${PORT}`)) ?? null;
}
async function attach() {
  for (let i = 0; i < 100; i++) {
    try {
      if (await pageTarget()) return;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  throw new Error('could not attach to the page');
}
async function call(method, params) {
  const t = await pageTarget();
  if (!t) throw new Error('no page');
  const sock = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  try {
    return await new Promise((r) => {
      const id = ++seq;
      sock.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === id) r(d); };
      sock.send(JSON.stringify({ id, method, params }));
      setTimeout(() => r({}), 15000);
    });
  } finally {
    sock.close();
  }
}
/** The expression's value; undefined if it threw (a page still booting must never pass a check). */
async function evaluate(expression) {
  const d = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return d.result?.exceptionDetails ? undefined : d.result?.result?.value;
}
const booted = () => waitFor('!!(window.__nc && window.__nc.app && window.__nc.app.renderer)', 120000);
async function waitFor(expression, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await evaluate(expression)) return true;
    } catch {
      /* the page is reloading */
    }
    await sleep(250);
  }
  return false;
}
/** A screenshot of the page (canvas and HUD) into web/artifacts/e2e/<name>.png. */
async function screenshot(name) {
  const d = await call('Page.captureScreenshot', { format: 'png' });
  if (!d.result?.data) return;
  const out = path.join(WEB, 'artifacts', 'e2e', `${name}.png`);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(d.result.data, 'base64'));
  console.log(`      screenshot ${out}`);
}
const promptText = () => evaluate(`(() => { const p = document.querySelector('.update-prompt'); return p && !p.classList.contains('hidden') ? p.textContent : '' })()`);

// ------------------------------------------------------------------------------------------------ run
build('build 1');
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
// the faked shell update lands about a minute and a half in: after A and E, during B's night
// Chromium stops drawing a window that other windows cover (and the game's boot waits on a frame), so
// the test window keeps drawing however the desktop is arranged, as the benchmark runner's does
const KEEP_DRAWING = ['--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'];
const shell = spawn(electron, ['.', `--game-url=http://127.0.0.1:${PORT}/`, `--remote-debugging-port=${DEBUG}`, '--fake-shell-update=9.9.9', ...KEEP_DRAWING], { cwd: DESKTOP, stdio: 'ignore', env: { ...process.env, NC_FAKE_SHELL_DELAY: '90000' } });
let shellExited = false;
shell.on('exit', () => (shellExited = true));
try {
  await attach();
  check('the game boots in the shell', await waitFor('!!(window.__nc && window.__nc.app && window.__nc.app.renderer)', 90000));
  const first = await evaluate('window.__nc.build.id');
  // ---- security
  check('the bridge is there (window.ncDesktop)', await evaluate(`typeof window.ncDesktop === 'object' && typeof window.ncDesktop.setSession === 'function'`));
  const info = await evaluate('window.ncDesktop.info()');
  check('the shell reports its versions', !!info && typeof info.shellVersion === 'string' && !!info.electron, JSON.stringify(info));
  check('no Node in the page', await evaluate(`typeof require === 'undefined' && typeof process === 'undefined'`));
  check('window.open is denied', await evaluate(`window.open('https://example.com') === null`));
  await evaluate(`location.href = 'file:///C:/Windows/win.ini'; true`);
  await sleep(1200);
  check('navigation away from the game is blocked', await evaluate(`location.origin === 'http://127.0.0.1:${PORT}'`));

  // ---- A: an update while at the menu is offered at once
  await sleep(500);
  build('build 2');
  await evaluate('window.__nc.app.updates.check(true).then(() => true)');
  await sleep(600);
  const a = await promptText();
  check('A: a new build at the menu is offered at once', /latest improvements/.test(a), a.slice(0, 80));
  await screenshot('update-card-at-menu');

  // ---- E: Restart & Update loads the new build and confirms it
  await evaluate(`document.querySelector('.update-prompt .up-buttons .btn').click(); true`);
  // the reload may replace the page's debugging target: re-attach until the new build answers
  let second = null;
  for (let i = 0; i < 90 && !second; i++) {
    await sleep(1000);
    try {
      const v = await evaluate('window.__nc && window.__nc.app && window.__nc.app.renderer ? window.__nc.build.id : null');
      if (typeof v === 'string' && v !== first) second = v;
    } catch {
      /* still reloading */
    }
  }
  check('E: the page came back after the restart', !!second);
  if (!second) console.log('      page state:', JSON.stringify(await evaluate(`({ ready: document.readyState, ui: (document.getElementById('ui') || {}).innerText?.slice(0, 160) })`)));
  await booted();
  const live2 = await evaluate(`fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((m) => m.id)`);
  check('E: it is the new build, and the page knows it', second !== first && second === live2, `${first} → ${second}`);
  check('E: the player is told', await waitFor(`(document.querySelector('.update-prompt')?.textContent || '').includes('Updated to version')`, 8000));

  // ---- B: an update during a night waits for the night to end
  await evaluate(`(() => { const app = window.__nc.app; app.startRun({ character: 'carny', difficulty: 'midway', curse: false, map: 'carnival_core', seed: 3 }); app.game.cfg.godMode = true; return true })()`);
  await sleep(1500);
  check('B: the night is under way (an unsafe moment)', await evaluate(`window.__nc.app.session().safe === false`));
  build('build 3');
  await evaluate('window.__nc.app.updates.check(true).then(() => true)');
  await sleep(800);
  check('B: the update is known…', await evaluate('window.__nc.app.updates.available'));
  check('B: …but nothing interrupts the night', (await promptText()) === '');
  // (F) wait for the faked shell update to land (mid-night), then ask to install it: refused
  check('F: the shell update arrives during the night', await waitFor('window.ncDesktop.info().then((i) => !!(i && i.shellUpdate && i.shellUpdate.ready))', 120000));
  check('F: …and the card stays away mid-night', (await promptText()) === '');
  const busy = await evaluate('window.ncDesktop.installShellUpdate()');
  check('F: a shell update is refused mid-night', busy && busy.ok === false && busy.reason === 'busy', JSON.stringify(busy));
  await evaluate(`window.__nc.app.game.endRun(false); true`);
  await sleep(1500);
  const b = await promptText();
  check('B/F: once the night ends, the waiting update is offered', /Update Available/.test(b), b.slice(0, 90));

  // ---- D: the server is gone when the player says Restart: the app stays put and says so
  serving = false;
  // the card currently offers the shell update first; put it away so the game update shows
  await evaluate(`(() => { const btns = document.querySelectorAll('.update-prompt .up-buttons .btn'); if (/Install/.test(btns[0].textContent)) btns[1].click(); return true })()`);
  await evaluate(`window.__nc.app.offerUpdate(); true`);
  await sleep(300);
  await evaluate(`document.querySelector('.update-prompt .up-buttons .btn').click(); true`);
  await sleep(2500);
  const d = await promptText();
  check('D: offline at restart: the app stays and explains', /reach the carnival/i.test(d) && (await evaluate('!!window.__nc.app.renderer')), d.slice(0, 120));
  serving = true;

  // ---- F: the shell update installs from the card at a safe moment
  const ok = await evaluate('window.ncDesktop.installShellUpdate()');
  check('F: at a safe moment the shell update installs (the shell quits to install)', ok && ok.ok === true, JSON.stringify(ok));
  for (let i = 0; i < 40 && !shellExited; i++) await sleep(250);
  check('F: the shell quit to install', shellExited);
} catch (e) {
  failures++;
  console.log(`FAIL  ${e?.message ?? e}`);
} finally {
  if (!shellExited) shell.kill();
  server.close();
  console.log(failures ? `${failures} failure(s)` : 'all passed');
  process.exit(failures);
}
