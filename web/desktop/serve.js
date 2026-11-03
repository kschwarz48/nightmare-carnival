// @ts-check
// A static file server for the benchmark runners (bench.js --serve, coop-bench.js): the built game (html, js, css,
// wasm, images, audio) on a free local port, uncached, so a production build is measured with no dev server or
// other browser competing for the GPU.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

/** @returns {Promise<{ server: http.Server, url: string }>} */
function serveDir(dir) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
    let file = path.join(root, u);
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': TYPES[/** @type {keyof typeof TYPES} */ (path.extname(file).toLowerCase())] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    const a = server.address();
    resolve({ server, url: `http://127.0.0.1:${a && typeof a === 'object' ? a.port : 0}/` });
  }));
}

module.exports = { serveDir };
