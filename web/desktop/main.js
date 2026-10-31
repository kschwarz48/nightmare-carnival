// @ts-check
// Nightmare Carnival for Windows: a thin, locked-down Electron shell around the hosted game.
//
// The game itself is the same build the browser plays (https://nightmare-carnival.netlify.app), so an
// ordinary game update ships with the web deploy and reaches desktop players through the in-game
// "Restart & Update" prompt. Only changes to this shell need a new installer, and those arrive through
// electron-updater (GitHub Releases), downloaded in the background and installed only when the game
// says it's safe (never mid-match).
//
// Security (Electron's checklist): the page runs sandboxed with context isolation and no Node; web
// security stays on; navigation and new windows are pinned to the game's origin (other https links
// open in the default browser); every permission is denied except fullscreen and clipboard writes;
// the preload bridge exposes a handful of validated calls and nothing else.
const { app, BrowserWindow, ipcMain, shell, session, dialog, screen, powerSaveBlocker } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const PROD_URL = 'https://nightmare-carnival.netlify.app/';

// ------------------------------------------------------------------ game URL (production, or a local dev server)
/** A local dev server may stand in for the hosted game (--game-url= or NC_GAME_URL); nothing else may. */
function pickGameUrl() {
  const arg = process.argv.find((a) => a.startsWith('--game-url='));
  const raw = arg ? arg.slice('--game-url='.length) : process.env.NC_GAME_URL;
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')) return u.toString();
    } catch {
      /* fall through to production */
    }
    log(`ignored game url override ${raw} (only a local dev server may replace the hosted game)`);
  }
  return PROD_URL;
}

// ------------------------------------------------------------------ logging (a small file for diagnosing launches and updates)
let logFile = '';
function log(msg) {
  try {
    if (!logFile) logFile = path.join(app.getPath('userData'), 'nc-desktop.log');
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 512 * 1024) fs.renameSync(logFile, `${logFile}.old`);
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* logging is best effort */
  }
}

const GAME_URL = pickGameUrl();
const GAME_ORIGIN = new URL(GAME_URL).origin;
const OFFLINE_PAGE = path.join(__dirname, 'shell', 'offline.html');
const DEVTOOLS = !app.isPackaged || process.argv.includes('--devtools');

app.setAppUserModelId('com.nightmarecarnival.game');
app.enableSandbox();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
}

// ------------------------------------------------------------------ window state (bounds and fullscreen survive restarts)
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const area = screen.getDisplayMatching(s.bounds).workArea;
    // keep the window on a screen that still exists
    if (s.bounds.x + 100 > area.x + area.width || s.bounds.y + 50 > area.y + area.height || s.bounds.x + s.bounds.width < area.x + 100) delete s.bounds.x;
    return s;
  } catch {
    return { bounds: { width: 1600, height: 900 }, fullscreen: false, maximized: false };
  }
}
function saveState() {
  if (!win) return;
  try {
    const s = { bounds: win.getNormalBounds(), fullscreen: win.isFullScreen(), maximized: win.isMaximized() };
    fs.writeFileSync(stateFile(), JSON.stringify(s));
  } catch {
    /* best effort */
  }
}

// ------------------------------------------------------------------ what the game is doing (for updates, closing, sleep)
/** Reported by the page: whether a restart now would interrupt anything (a night, a lobby, a connection). */
let gameSession = { state: 'boot', safe: true };
let sleepBlocker = -1;
function setSession(s) {
  gameSession = s;
  // a night played on a controller sends no keyboard or mouse input: keep the display awake through it
  const playing = s.state === 'match';
  if (playing && sleepBlocker < 0) sleepBlocker = powerSaveBlocker.start('prevent-display-sleep');
  if (!playing && sleepBlocker >= 0) {
    powerSaveBlocker.stop(sleepBlocker);
    sleepBlocker = -1;
  }
}

/** @type {BrowserWindow | null} */
let win = null;
let quitting = false;

function isGameUrl(url) {
  try {
    return new URL(url).origin === GAME_ORIGIN;
  } catch {
    return false;
  }
}
function isOfflinePage(url) {
  try {
    return new URL(url).protocol === 'file:' && path.normalize(decodeURIComponent(new URL(url).pathname).replace(/^\/(\w:)/, '$1')) === path.normalize(OFFLINE_PAGE);
  } catch {
    return false;
  }
}
/** Open a link in the default browser: https only, never a local file or another scheme. */
function openExternal(url) {
  try {
    if (new URL(url).protocol === 'https:') void shell.openExternal(url);
  } catch {
    /* ignore malformed links */
  }
}

function showOffline(reason) {
  if (!win) return;
  log(`showing the offline page: ${reason}`);
  void win.loadFile(OFFLINE_PAGE, { query: { reason: String(reason).slice(0, 200) } });
}

function loadGame() {
  if (!win) return;
  log(`loading ${GAME_URL}`);
  win.loadURL(GAME_URL).catch((e) => showOffline(e?.message ?? e));
}

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    ...st.bounds,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    backgroundColor: '#07040c',
    title: 'Nightmare Carnival',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    fullscreen: !!st.fullscreen,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: false,
      devTools: DEVTOOLS,
      // a host's night keeps simulating when the window is minimized (the game also has a worker clock)
      backgroundThrottling: false,
      additionalArguments: [`--nc-shell-version=${app.getVersion()}`],
    },
  });
  win.removeMenu();
  if (st.maximized) win.maximize();
  win.once('ready-to-show', () => win?.show());

  const wc = win.webContents;
  // the page stays on the game's origin (or the bundled offline page); other links open outside
  wc.on('will-navigate', (e, url) => {
    if (isGameUrl(url) || isOfflinePage(url)) return;
    e.preventDefault();
    openExternal(url);
  });
  wc.on('will-redirect', (e, url) => {
    if (!isGameUrl(url) && !isOfflinePage(url)) e.preventDefault();
  });
  wc.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (isMainFrame && isGameUrl(url) && code !== -3) showOffline(`${desc} (${code})`);
  });
  wc.on('render-process-gone', (_e, d) => {
    log(`renderer gone: ${d.reason} (${d.exitCode})`);
    if (d.reason !== 'clean-exit') showOffline(`The game stopped unexpectedly (${d.reason}).`);
  });
  wc.on('unresponsive', () => log('renderer unresponsive'));
  // F11 / Alt+Enter: fullscreen; F12 / Ctrl+Shift+I: developer tools (development and --devtools only)
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) {
      e.preventDefault();
      win?.setFullScreen(!win.isFullScreen());
    } else if (DEVTOOLS && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      e.preventDefault();
      wc.toggleDevTools();
    }
  });

  // leaving in the middle of a night or a lobby asks first
  win.on('close', (e) => {
    saveState();
    if (quitting || gameSession.safe) return;
    e.preventDefault();
    const choice = dialog.showMessageBoxSync(/** @type {BrowserWindow} */ (win), {
      type: 'question',
      buttons: ['Keep Playing', 'Leave the Carnival'],
      defaultId: 0,
      cancelId: 0,
      title: 'Nightmare Carnival',
      message: 'Leave in the middle of the night?',
      detail: gameSession.state === 'lobby' ? 'Your party is still in the lobby.' : 'The night is still going. Your party will carry on without you.',
    });
    if (choice === 1) {
      quitting = true;
      win?.close();
    }
  });
  win.on('resize', saveState);
  win.on('move', saveState);
  win.on('closed', () => (win = null));

  loadGame();
}

// ------------------------------------------------------------------ permissions: fullscreen and clipboard writes, nothing else
function lockDownSession() {
  const ses = session.defaultSession;
  const allowed = new Set(['fullscreen', 'clipboard-sanitized-write']);
  ses.setPermissionRequestHandler((wc, permission, cb, details) => cb(allowed.has(permission) && isGameUrl(details.requestingUrl || wc.getURL())));
  ses.setPermissionCheckHandler((_wc, permission, origin) => allowed.has(permission) && isGameUrl(origin));
  ses.setDevicePermissionHandler(() => false);
  // no other window, frame or webview may be created by the page
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (ev) => ev.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
}

// ------------------------------------------------------------------ the bridge (see preload.js): every call checks its sender
function fromGame(e) {
  const url = e.senderFrame?.url ?? '';
  return isGameUrl(url) || isOfflinePage(url);
}
const SESSION_STATES = new Set(['boot', 'menu', 'hub', 'lobby', 'connecting', 'loading', 'match', 'reconnecting', 'results']);

ipcMain.handle('nc:info', (e) => {
  if (!fromGame(e)) return null;
  return { shellVersion: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, gameUrl: GAME_URL, packaged: app.isPackaged, shellUpdate };
});
ipcMain.on('nc:session', (e, s) => {
  if (!fromGame(e) || !s || typeof s !== 'object') return;
  const state = String(s.state);
  if (!SESSION_STATES.has(state)) return;
  setSession({ state, safe: s.safe === true });
});
ipcMain.handle('nc:reload-latest', async (e) => {
  if (!fromGame(e) || !win) return false;
  // a fresh copy of the hosted game, bypassing any cached page (the assets are fingerprinted)
  log('reloading the latest game build');
  await win.webContents.session.clearCache().catch(() => {});
  loadGame();
  return true;
});
ipcMain.handle('nc:retry', (e) => {
  if (!fromGame(e)) return false;
  loadGame();
  return true;
});
ipcMain.handle('nc:fullscreen', (e, on) => {
  if (!fromGame(e) || !win) return false;
  if (typeof on === 'boolean') win.setFullScreen(on);
  return win.isFullScreen();
});
ipcMain.on('nc:quit', (e) => {
  if (!fromGame(e)) return;
  quitting = true;
  app.quit();
});

// ------------------------------------------------------------------ shell updates (electron-updater, GitHub Releases)
/** @type {{ version: string; ready: boolean } | null} */
let shellUpdate = null;
/** @type {null | (() => void)} */
let installShellUpdate = null;
ipcMain.handle('nc:install-shell-update', (e) => {
  if (!fromGame(e) || !shellUpdate?.ready || !installShellUpdate) return { ok: false, reason: 'none' };
  // never mid-match: the game offers this only in a safe state, and the shell checks again
  if (!gameSession.safe) return { ok: false, reason: 'busy' };
  installShellUpdate();
  return { ok: true };
});
function setupShellUpdates() {
  // development only: pretend an update finished downloading, to exercise the deferral (--fake-shell-update=9.9.9)
  const fake = process.argv.find((a) => a.startsWith('--fake-shell-update='));
  if (!app.isPackaged && fake) {
    setTimeout(() => {
      shellUpdate = { version: fake.split('=')[1] || '9.9.9', ready: true };
      log(`fake shell update ${shellUpdate.version} ready`);
      win?.webContents.send('nc:shell-update', shellUpdate);
    }, Number(process.env.NC_FAKE_SHELL_DELAY ?? 8000));
    installShellUpdate = () => {
      log('fake shell update: would quit and install now');
      quitting = true;
      setImmediate(() => app.quit());
    };
    return;
  }
  if (!app.isPackaged) return; // a development shell never updates itself
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    log(`electron-updater unavailable: ${e}`);
    return;
  }
  autoUpdater.autoDownload = true; // in the background
  autoUpdater.autoInstallOnAppQuit = true; // or whenever the player next quits
  autoUpdater.on('update-available', (i) => log(`shell update available: ${i.version}`));
  autoUpdater.on('update-downloaded', (i) => {
    log(`shell update downloaded: ${i.version}`);
    shellUpdate = { version: i.version, ready: true };
    win?.webContents.send('nc:shell-update', shellUpdate);
  });
  autoUpdater.on('error', (err) => log(`shell update error: ${err?.message ?? err}`));
  const check = () => autoUpdater.checkForUpdates().catch((err) => log(`shell update check failed: ${err?.message ?? err}`));
  setTimeout(check, 20000);
  setInterval(check, 4 * 3600 * 1000);
  installShellUpdate = () => {
    log(`installing shell update ${shellUpdate?.version}`);
    quitting = true;
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
  };
}

app.whenReady().then(() => {
  log(`starting shell ${app.getVersion()} (Electron ${process.versions.electron}), game ${GAME_URL}`);
  lockDownSession();
  createWindow();
  setupShellUpdates();
});
app.on('before-quit', () => (quitting = true));
app.on('window-all-closed', () => app.quit());
