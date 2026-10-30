import { defineConfig, type Plugin } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Dev-server-only visual QA endpoint: the in-page dev tools POST a PNG data URL here and it is saved
 * under artifacts/visual/<run>/<name>.png, so before/after captures of the real game are kept on disk.
 */
function visualCaptures(): Plugin {
  const root = resolve(__dirname, 'artifacts/visual');
  return {
    name: 'nc-visual-captures',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__capture', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const { run, name, png, meta } = JSON.parse(body) as { run: string; name: string; png: string; meta?: unknown };
            const safe = (s: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(s);
            if (!safe(run) || !safe(name) || !png.startsWith('data:image/png;base64,')) throw new Error('bad capture');
            const file = join(root, run, `${name}.png`);
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, Buffer.from(png.slice('data:image/png;base64,'.length), 'base64'));
            if (meta) writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify(meta, null, 2));
            res.end(JSON.stringify({ ok: true, file }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [visualCaptures()],
  server: { port: 5173, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
  },
} as any);
