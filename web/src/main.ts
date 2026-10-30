import '@fontsource/rye/400.css';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/600.css';
import './ui/style.css';
import { App } from './app';

function fatal(msg: string): void {
  const el = document.getElementById('ui');
  if (el) el.innerHTML = `<div class="screen"><div class="panel" style="padding:2em;max-width:36em;text-align:center"><h2 class="title-text">The show can't go on</h2><p>${msg}</p></div></div>`;
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!hasWebGL()) fatal('Nightmare Carnival needs WebGL. Please enable hardware acceleration or try another browser.');
else {
  const app = new App();
  app.boot().catch((e) => {
    console.error(e);
    fatal(`Something broke while opening the gates: ${String(e?.message ?? e)}`);
  });
}
