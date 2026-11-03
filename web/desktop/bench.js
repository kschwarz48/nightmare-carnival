// @ts-check
// Benchmark runner (engineering optimization pass): opens the game full screen on the primary display
// in Electron's Chromium, on the real GPU, and drives the in-page scenarios (src/devBench.ts) through
// the dev tools. Background throttling and occlusion detection are off, so frames keep coming even if
// another window covers this one. Results are saved as JSON.
//
//   npx electron bench.js --url=http://127.0.0.1:5173/ --out=../artifacts/bench/render.json
//     [--uncapped]           no vsync or frame-rate cap: shows headroom above the display's refresh
//     [--only=name,name]     run only these scenarios
//     [--qualities]          also run the late Carnival crowd at Medium and Low
//     [--gc]                 trace the V8 garbage collector during each scenario (adds a little overhead)
//     [--serve=../dist-bench] serve that folder itself (on a free local port) instead of --url: a production
//                            build benchmarked with no dev server or other browser competing for the GPU
//     [--repeat=N]           run each scenario N times (results labelled #1..#N)
//     [--query=legacy=lod]   a query string for the page (the A/B switches in src/core/flags.ts)
//     [--jsflags="--expose-gc"] V8 flags for the page (window.gc for scripts/bench/long-session.js, traces)
//     [--console]            echo the page's console
//     [--eval=file.js]       run an experiment in the page instead of the scenarios ([--cpuprofile=file] from boot,
//                            [--profiles=prefix] only what it marks with console.profile, [--shot=file.png] at the end)
//
// The page must expose window.__nc: a dev server, or a production build made with VITE_DEVTOOLS=1
// (`VITE_DEVTOOLS=1 npx vite build --outDir dist-bench`).
const { app, BrowserWindow, screen } = require('electron');
const { serveDir } = require('./serve');
const fs = require('node:fs');
const path = require('node:path');

const arg = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const flag = (name) => process.argv.includes(`--${name}`);
let URL_ = arg('url', 'http://127.0.0.1:5173/');
const SERVE = arg('serve', '');
const REPEAT = Math.max(1, Number(arg('repeat', '1')) || 1);

const OUT = path.resolve(arg('out', path.join(__dirname, '..', 'artifacts', 'bench', 'render.json')));
const ONLY = arg('only', '');

// a fresh profile every run: the same new save, so the same unlocks and the same bot builds
const profile = path.join(require('node:os').tmpdir(), 'nc-bench-profile');
fs.rmSync(profile, { recursive: true, force: true });
app.setPath('userData', profile);
app.commandLine.appendSwitch('enable-precise-memory-info');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
if (arg('jsflags', '')) app.commandLine.appendSwitch('js-flags', arg('jsflags', ''));
if (flag('uncapped')) {
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-frame-rate-limit');
}

// a heavy late-game build (lots of fire, popcorn, cards and darts on screen) for the late scenarios
const LATE = { weapons: ['throwing_cards:8', 'grill:5', 'popcorn:7', 'mallet:7', 'death_card:2', 'darts:6'], passives: ['caffeine', 'energy_drink', 'strongman_belt', 'spectacles', 'foam_finger', 'sugar_rush'] };
/** @type {Array<Record<string, unknown>>} */
let SCENARIOS = [
  { name: 'menu (attract demo)', menu: true, seconds: 10, warm: 2 },
  { name: 'carnival early 2:00', map: 'carnival_core', t: 120, seconds: 15 },
  { name: 'carnival mid 10:00', map: 'carnival_core', t: 600, seconds: 15 },
  { name: 'carnival late, crowd 400', map: 'carnival_core', t: 1260, crowd: 400, seconds: 20, ...LATE },
  { name: 'carnival boss: Ringmaster', map: 'carnival_core', t: 1380, crowd: 150, boss: 'ringmaster', seconds: 20, ...LATE },
  { name: 'fun house late, crowd 400', map: 'fun_house', t: 1260, crowd: 400, seconds: 20, ...LATE },
  { name: 'boardwalk late, crowd 400', map: 'boardwalk', t: 1260, crowd: 400, seconds: 20, ...LATE },
  { name: 'boardwalk boss: Leviathan', map: 'boardwalk', t: 1380, crowd: 150, boss: 'leviathan', seconds: 20, ...LATE },
  { name: 'ghost train early 2:00', map: 'ghost_train', t: 120, seconds: 15 },
  { name: 'ghost train mid 10:00', map: 'ghost_train', t: 600, seconds: 15 },
  { name: 'ghost train late, crowd 400', map: 'ghost_train', t: 1300, crowd: 400, seconds: 20, ...LATE },
  { name: 'ghost train boss: Night Express', map: 'ghost_train', t: 1380, crowd: 150, boss: 'night_express', seconds: 20, ...LATE },
];
if (flag('qualities')) {
  SCENARIOS.push({ name: 'carnival late, crowd 400 (Medium)', map: 'carnival_core', t: 1260, crowd: 400, seconds: 12, quality: 'medium', ...LATE });
  SCENARIOS.push({ name: 'carnival late, crowd 400 (Low)', map: 'carnival_core', t: 1260, crowd: 400, seconds: 12, quality: 'low', ...LATE });
}
if (ONLY) SCENARIOS = SCENARIOS.filter((s) => ONLY.split(',').some((o) => String(s.name).toLowerCase().includes(o.toLowerCase())));

/** GC events from a V8 trace: count and total milliseconds per event name. */
function gcSummary(events) {
  /** @type {Record<string, {n: number, ms: number}>} */
  const by = {};
  const open = new Map();
  for (const e of events) {
    if (!/GC|Scavenge|MarkCompact/i.test(e.name || '')) continue;
    if (e.ph === 'X') {
      const b = (by[e.name] ??= { n: 0, ms: 0 });
      b.n++;
      b.ms += (e.dur || 0) / 1000;
    } else if (e.ph === 'B') open.set(`${e.tid}:${e.name}`, e.ts);
    else if (e.ph === 'E') {
      const k = `${e.tid}:${e.name}`;
      const t0 = open.get(k);
      if (t0 !== undefined) {
        const b = (by[e.name] ??= { n: 0, ms: 0 });
        b.n++;
        b.ms += (e.ts - t0) / 1000;
        open.delete(k);
      }
    }
  }
  for (const v of Object.values(by)) v.ms = Math.round(v.ms * 100) / 100;
  return by;
}

app.whenReady().then(async () => {
  if (SERVE) {
    URL_ = (await serveDir(SERVE)).url;
    console.log('serving', path.resolve(SERVE), 'at', URL_);
  }
  // --query=legacy=aa: a query string for the page (the A/B switches in src/core/flags.ts)
  if (arg('query', '')) URL_ += `${URL_.includes('?') ? '&' : '?'}${arg('query', '')}`;
  const d = screen.getPrimaryDisplay();
  // --size=1920x1080: a window with exactly that much page (the default is full screen)
  const size = arg('size', '');
  const [sw, sh] = size ? size.split('x').map(Number) : [0, 0];
  const win = new BrowserWindow({
    x: d.bounds.x, y: d.bounds.y, width: sw || d.bounds.width, height: sh || d.bounds.height, useContentSize: !!size, fullscreen: !size, frame: !size ? true : false, show: true, backgroundColor: '#07040c',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
  });
  // a page that dies (out of memory, a GPU process crash) ends the run with its reason instead of hanging it
  win.webContents.on('render-process-gone', (_e, d) => {
    console.error(`the page's process is gone: ${d.reason} (exit code ${d.exitCode})`);
    app.exit(3);
  });
  // --console: echo the page's console (an experiment's progress lines)
  if (flag('console')) win.webContents.on('console-message', (e) => console.log(`[page${e.level === 'warning' || e.level === 'error' ? ` ${e.level}` : ''}] ${e.message}`));
  const dbg = win.webContents.debugger;
  const traceGc = flag('gc');
  /** @type {any[]} */
  let traceBuf = [];
  if (traceGc) {
    dbg.attach('1.3');
    dbg.on('message', (_e, method, params) => {
      if (method === 'Tracing.dataCollected') traceBuf.push(...params.value);
    });
  }
  const js = (code) => win.webContents.executeJavaScript(code, true);
  // --cpuprofile with --eval: sample from the very start of the page load (boot included)
  const prof = arg('cpuprofile', '');
  if (prof) {
    if (!traceGc) dbg.attach('1.3');
    await dbg.sendCommand('Profiler.enable');
    await dbg.sendCommand('Profiler.setSamplingInterval', { interval: 200 });
    await dbg.sendCommand('Profiler.start');
  }
  const t0 = Date.now();
  try {
    await win.loadURL(URL_);
  } catch (e) {
    console.error(`could not load ${URL_}: ${e}`);
    app.exit(2);
    return;
  }
  // boot: wait for the dev tools (the game installs them once it's ready)
  for (let i = 0; i < 600; i++) {
    if (await js('!!(window.__nc && window.__nc.app && window.__nc.app.renderer)')) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  // --profiles=prefix: only the stretches an experiment marks with console.profile('name') / console.profileEnd('name'),
  // each saved as <prefix>-name.cpuprofile; enabled once the page is up (the profiler started before the load hangs
  // it), and nothing is sampled outside the marks, so fast-forwards run at full speed
  const marks = arg('profiles', '');
  if (marks) {
    if (!traceGc && !prof) dbg.attach('1.3');
    await dbg.sendCommand('Profiler.enable');
    await dbg.sendCommand('Profiler.setSamplingInterval', { interval: 200 });
    dbg.on('message', (_e, method, params) => {
      if (method !== 'Profiler.consoleProfileFinished') return;
      const file = path.resolve(`${marks}-${String(params.title || 'profile').replace(/[^a-z0-9]+/gi, '-')}.cpuprofile`);
      fs.writeFileSync(file, JSON.stringify(params.profile));
      console.log('console profile saved', file);
    });
  }
  const boot = await js('window.__nc.bootInfo()');
  boot.wallMsToDevtools = Date.now() - t0;
  console.log('boot', JSON.stringify(boot));
  // --eval=file.js: run an experiment script in the page instead (its last expression's value is printed)
  const evalFile = arg('eval', '');
  if (evalFile) {
    const out = await js(`(async () => { ${fs.readFileSync(path.resolve(evalFile), 'utf8')} })()`).catch((e) => ({ error: String(e) }));
    if (prof) {
      const { profile } = await dbg.sendCommand('Profiler.stop');
      fs.writeFileSync(path.resolve(prof), JSON.stringify(profile));
      console.log('cpuprofile saved', path.resolve(prof));
    }
    // --shot=file.png: a screenshot of the window (canvas and HUD) once the experiment is done
    const shot = arg('shot', '');
    if (shot) {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.resolve(shot), img.toPNG());
      console.log('screenshot saved', path.resolve(shot));
    }
    console.log('EVAL', JSON.stringify(out, null, 1));
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), eval: evalFile, out }, null, 1));
    app.quit();
    return;
  }
  const results = [];
  const runs = REPEAT > 1 ? SCENARIOS.flatMap((sc) => Array.from({ length: REPEAT }, (_, i) => ({ ...sc, name: `${sc.name} #${i + 1}` }))) : SCENARIOS;
  for (const sc of runs) {
    if (traceGc) {
      traceBuf = [];
      await dbg.sendCommand('Tracing.start', { categories: 'disabled-by-default-v8.gc,v8', transferMode: 'ReportEvents' });
    }
    let r;
    try {
      r = await js(`window.__nc.benchRun(${JSON.stringify(sc)})`);
    } catch (e) {
      r = { name: sc.name, error: String(e) };
    }
    if (traceGc) {
      const done = new Promise((res) => dbg.once('message', function wait(_e, method) { if (method === 'Tracing.tracingComplete') res(null); else dbg.once('message', wait); }));
      await dbg.sendCommand('Tracing.end');
      await Promise.race([done, new Promise((res) => setTimeout(res, 5000))]);
      r.gc = gcSummary(traceBuf);
    }
    console.log(JSON.stringify(r));
    results.push(r);
  }
  const versions = { electron: process.versions.electron, chrome: process.versions.chrome };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), url: SERVE ? `serve ${SERVE}` : URL_, uncapped: flag('uncapped'), window: size || 'fullscreen', display: { size: d.size, scale: d.scaleFactor, hz: d.displayFrequency }, versions, boot, results }, null, 1));
  console.log('saved', OUT);
  app.quit();
});
