// @ts-check
// Count the pixels that differ between two PNGs of the same size (by more than `tolerance` in any channel).
//   npx electron imgdiff.js a.png b.png [tolerance] [mask.png]
// With mask.png: the differing pixels in white on black, and the 8 busiest 64-pixel cells listed.
// --exclude=x,y,w,h leaves a box out of the count (something that varies run to run, such as a player's pose).
const { app, nativeImage } = require('electron');
const path = require('node:path');
const [a, b, tol, maskOut] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const ex = (process.argv.find((x) => x.startsWith('--exclude=')) || '').slice(10).split(',').map(Number);
app.whenReady().then(() => {
  const A = nativeImage.createFromPath(path.resolve(a)), B = nativeImage.createFromPath(path.resolve(b));
  const sa = A.getSize(), sb = B.getSize();
  if (sa.width !== sb.width || sa.height !== sb.height) {
    console.log(`sizes differ: ${sa.width}x${sa.height} vs ${sb.width}x${sb.height}`);
    app.exit(1);
    return;
  }
  const pa = A.toBitmap(), pb = B.toBitmap(), t = Number(tol ?? 2);
  const mask = Buffer.alloc(pa.length);
  const cells = new Map();
  let n = 0, max = 0;
  for (let i = 0; i < pa.length; i += 4) {
    const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
    mask[i + 3] = 255;
    const qx = (i / 4) % sa.width, qy = Math.floor(i / 4 / sa.width);
    if (ex.length === 4 && qx >= ex[0] && qx < ex[0] + ex[2] && qy >= ex[1] && qy < ex[1] + ex[3]) continue;
    if (d > t) {
      n++;
      mask[i] = mask[i + 1] = mask[i + 2] = 255;
      const px = (i / 4) % sa.width, py = Math.floor(i / 4 / sa.width);
      const k = `${Math.floor(px / 64) * 64},${Math.floor(py / 64) * 64}`;
      cells.set(k, (cells.get(k) ?? 0) + 1);
    }
    if (d > max) max = d;
  }
  console.log(`${n} of ${pa.length / 4} pixels differ by more than ${t} (largest difference ${max})`);
  if (maskOut) {
    require('node:fs').writeFileSync(path.resolve(maskOut), nativeImage.createFromBitmap(mask, { width: sa.width, height: sa.height }).toPNG());
    console.log('busiest cells (x,y: pixels):', [...cells.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `${k}: ${v}`).join('  '));
  }
  app.quit();
});
