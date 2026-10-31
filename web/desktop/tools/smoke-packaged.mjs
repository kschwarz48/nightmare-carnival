// Smoke test of the packaged app (release/win-unpacked): it starts, loads the game, exposes only the
// bridge, keeps Node away from the page, denies new windows, and its security fuses hold.
//
//   node tools/smoke-packaged.mjs --url=http://127.0.0.1:4174/     (a VITE_DEVTOOLS=1 build of the game)
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXE = path.join(here, '..', 'release', 'win-unpacked', 'Nightmare Carnival.exe');
const URL_ = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://127.0.0.1:4174/').slice(6);
const DEBUG = 9232;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

// the RunAsNode fuse: with it off, ELECTRON_RUN_AS_NODE must not turn the app into a Node runtime
const asNode = spawnSync(EXE, ['-e', 'console.log("node-ran")'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 15000, encoding: 'utf8' });
check('the RunAsNode fuse is off (ELECTRON_RUN_AS_NODE ignored)', !String(asNode.stdout).includes('node-ran'));
spawnSync('taskkill', ['/F', '/IM', 'Nightmare Carnival.exe'], { stdio: 'ignore' });

const app = spawn(EXE, [`--game-url=${URL_}`, `--remote-debugging-port=${DEBUG}`], { stdio: 'ignore' });
let ws = null, seq = 0;
const pending = new Map();
const evaluate = (expression) => {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  return new Promise((r) => pending.set(id, (d) => r(d.result?.result?.value)));
};
try {
  let page = null;
  for (let i = 0; i < 100 && !page; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG}/json`)).json();
      page = list.find((t) => t.type === 'page' && t.url.startsWith(new URL(URL_).origin));
    } catch { /* starting */ }
    if (!page) await sleep(300);
  }
  check('the packaged app opens the game', !!page, page?.url);
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  let booted = false;
  for (let i = 0; i < 300 && !booted; i++) {
    booted = !!(await evaluate('!!(window.__nc && window.__nc.app && window.__nc.app.renderer)'));
    if (!booted) await sleep(300);
  }
  check('the game boots inside the packaged shell', booted);
  const info = await evaluate('window.ncDesktop && window.ncDesktop.info()');
  check('the bridge answers, packaged', !!info && info.packaged === true, JSON.stringify(info));
  check('no Node in the page', await evaluate(`typeof require === 'undefined' && typeof process === 'undefined' && typeof module === 'undefined'`));
  check('window.open is denied', await evaluate(`window.open('https://example.com') === null`));
  check('the page reports its session to the shell', await evaluate(`typeof window.__nc.app.session === 'function' && window.__nc.app.session().state`));
} catch (e) {
  failures++;
  console.log(`FAIL  ${e?.message ?? e}`);
} finally {
  app.kill();
  spawnSync('taskkill', ['/F', '/IM', 'Nightmare Carnival.exe'], { stdio: 'ignore' });
  console.log(failures ? `${failures} failure(s)` : 'all passed');
  process.exit(failures);
}
