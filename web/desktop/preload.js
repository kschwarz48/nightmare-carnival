// @ts-check
// The desktop bridge: the only things the hosted game can ask of the shell. Each call is a fixed IPC
// message with checked arguments (the main process checks the sender again); no Node, no files, no
// arbitrary IPC. The game finds it as window.ncDesktop (src/platform/desktop.ts).
const { contextBridge, ipcRenderer } = require('electron');

const version = (process.argv.find((a) => a.startsWith('--nc-shell-version=')) || '').split('=')[1] || '0.0.0';

contextBridge.exposeInMainWorld('ncDesktop', {
  platform: process.platform,
  shellVersion: version,
  /** shell and engine versions, the game URL, a downloaded shell update if any */
  info: () => ipcRenderer.invoke('nc:info'),
  /** what the game is doing, and whether a restart now would interrupt anything */
  setSession: (state, safe) => ipcRenderer.send('nc:session', { state: String(state), safe: safe === true }),
  /** reload the latest hosted game build (the page's "Restart & Update") */
  reloadLatest: () => ipcRenderer.invoke('nc:reload-latest'),
  /** the offline page's Retry */
  retry: () => ipcRenderer.invoke('nc:retry'),
  setFullscreen: (on) => ipcRenderer.invoke('nc:fullscreen', on === true),
  isFullscreen: () => ipcRenderer.invoke('nc:fullscreen', null),
  /** a shell update finished downloading: cb({ version, ready }); returns an unsubscribe */
  onShellUpdate: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const h = (_e, info) => cb({ version: String(info?.version ?? ''), ready: info?.ready === true });
    ipcRenderer.on('nc:shell-update', h);
    return () => ipcRenderer.removeListener('nc:shell-update', h);
  },
  /** install a downloaded shell update and restart (refused unless the game reported a safe state) */
  installShellUpdate: () => ipcRenderer.invoke('nc:install-shell-update'),
  quit: () => ipcRenderer.send('nc:quit'),
});
