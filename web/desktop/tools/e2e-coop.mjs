// Cross-client co-op check (engineering optimization pass): the real desktop shell hosts, a separate
// Chromium client (an Electron window driven like a browser tab) joins with the lobby code, and the night
// starts on both over WebRTC (PeerJS signalling, as in every co-op game). It checks the locked-down shell
// doesn't get in the way of peer connections, and that a desktop host and a non-shell guest on the same
// build play together.
//
//   node tools/e2e-coop.mjs --url=http://127.0.0.1:4174/     (a VITE_DEVTOOLS=1 build of the game)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.join(here, '..');
const URL_ = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://127.0.0.1:4174/').slice(6);
const DEBUG = 9231;
const electron = createRequire(path.join(DESKTOP, 'package.json'))('electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

let ws = null, seq = 0;
const pending = new Map();
async function attach() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG}/json`)).json();
      const page = list.find((t) => t.type === 'page' && t.url.startsWith(new URL(URL_).origin));
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
        ws.onmessage = (m) => {
          const d = JSON.parse(m.data);
          if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
        };
        return;
      }
    } catch { /* not up yet */ }
    await sleep(300);
  }
  throw new Error('could not attach to the shell');
}
function evaluate(expression) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  return new Promise((r) => pending.set(id, (d) => r(d.result?.result?.value ?? (d.result?.exceptionDetails ? { error: d.result.exceptionDetails.text } : undefined))));
}
async function waitFor(expression, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await evaluate(expression)) return true; } catch { /* reloading */ }
    await sleep(300);
  }
  return false;
}

const host = spawn(electron, ['.', `--game-url=${URL_}`, `--remote-debugging-port=${DEBUG}`, '--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'], { cwd: DESKTOP, stdio: 'ignore' });
let guest = null;
try {
  await attach();
  check('the desktop shell boots the game', await waitFor('!!(window.__nc && window.__nc.app && window.__nc.app.renderer)', 90000));
  const code = await evaluate('window.__nc.coop.host("DesktopHost")');
  check('the shell hosts a lobby', typeof code === 'string' && /^[A-Z0-9]{6}$/.test(code), String(code));
  // the guest: an ordinary Chromium page (not the shell), joining with the code
  const dir = mkdtempSync(path.join(tmpdir(), 'nc-coop-'));
  const evalFile = path.join(dir, 'guest.js');
  writeFileSync(evalFile, `
    const nc = window.__nc, app = nc.app;
    const lobby = await nc.coop.join(${JSON.stringify(code)}, 'BrowserGuest', 'strongman');
    for (let i = 0; i < 300 && !(app.net && app.net.guest && app.net.guest.state === 'run'); i++) await new Promise((r) => setTimeout(r, 200));
    const gs = app.net && app.net.guest;
    await new Promise((r) => setTimeout(r, 6000));
    return { joined: !!lobby, state: gs && gs.state, snapshots: gs && gs.replica ? gs.replica.received : 0, rtt: gs ? Math.round(gs.diag.rtt) : null, route: gs ? gs.diag.route : null, unreliable: gs ? gs.diag.unreliable : null, players: app.game ? app.game.players.length : 0 };`);
  const out = path.join(dir, 'guest.json');
  guest = spawn(electron, [path.join(DESKTOP, 'bench.js'), `--url=${URL_}`, `--out=${out}`, `--eval=${evalFile}`, '--size=1280x720'], { cwd: DESKTOP, stdio: 'ignore' });
  // the host waits for the guest in its lobby, then starts the night
  check('the guest reaches the host’s lobby', await waitFor(`(() => { const l = window.__nc.app.net && window.__nc.app.net.host && window.__nc.app.net.host.lobby; return !!(l && l.players.filter((p) => p && p.connected).length >= 2 && l.players[1] && l.players[1].ready) })()`, 120000));
  await evaluate('window.__nc.coop.start("carny")');
  check('the night starts on the host with both players', await waitFor('!!(window.__nc.app.game && window.__nc.app.game.players.length === 2 && window.__nc.app.state === "playing")', 30000));
  // the guest window reports when done
  const done = await new Promise((r) => guest.on('exit', r));
  const res = JSON.parse((await import('node:fs')).readFileSync(out, 'utf8')).out;
  check('the guest plays the night: snapshots arrive over WebRTC', res && res.state === 'run' && res.snapshots > 20, JSON.stringify(res));
  const hostDiag = await evaluate('(() => { const d = window.__nc.app.net.host.diag; return { rtt: Math.round(d.rtt), route: d.route, unreliable: d.unreliable, snapRate: Math.round(d.snapRate) } })()');
  check('the host streams to the guest on the datagram channel', hostDiag && hostDiag.unreliable === true, JSON.stringify(hostDiag));
  void done;
} catch (e) {
  failures++;
  console.log(`FAIL  ${e?.message ?? e}`);
} finally {
  host.kill();
  guest?.kill();
  console.log(failures ? `${failures} failure(s)` : 'all passed');
  process.exit(failures);
}
