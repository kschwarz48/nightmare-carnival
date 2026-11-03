// @ts-check
// Crop (and optionally scale) a PNG with Electron's image tools, for looking closely at benchmark captures.
//   npx electron crop.js in.png out.png x y w h [outWidth]
const { app, nativeImage } = require('electron');
const [inp, out, x, y, w, h, ow] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
app.whenReady().then(() => {
  let img = nativeImage.createFromPath(require('node:path').resolve(inp)).crop({ x: +x, y: +y, width: +w, height: +h });
  if (ow) img = img.resize({ width: +ow, quality: 'best' });
  require('node:fs').writeFileSync(require('node:path').resolve(out), img.toPNG());
  app.quit();
});
