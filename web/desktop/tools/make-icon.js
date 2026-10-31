// @ts-check
// Renders the app icon from the game's own branding (the favicon's grinning red face inside a ring of
// the logo's marquee bulbs, on the marquee's plum) to build/icon.png at 512×512; electron-builder makes
// the Windows .ico from it. Run with: npx electron tools/make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const draw = `(() => {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const r = 92;
  const box = () => { x.beginPath(); x.moveTo(16 + r, 16); x.arcTo(S - 16, 16, S - 16, S - 16, r); x.arcTo(S - 16, S - 16, 16, S - 16, r); x.arcTo(16, S - 16, 16, 16, r); x.arcTo(16, 16, S - 16, 16, r); x.closePath(); };
  const g = x.createRadialGradient(S / 2, S * 0.42, 40, S / 2, S / 2, S * 0.62);
  g.addColorStop(0, '#4a1a52'); g.addColorStop(1, '#14081c');
  box(); x.fillStyle = g; x.fill(); x.lineWidth = 16; x.strokeStyle = '#17110e'; x.stroke();
  // the marquee's bulbs round the rim
  const n = 20;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const bx = S / 2 + Math.cos(a) * 196, by = S / 2 + Math.sin(a) * 196;
    const col = i % 2 ? '#ff6aa0' : '#ffd36a';
    x.shadowColor = col; x.shadowBlur = 18;
    x.beginPath(); x.arc(bx, by, 13, 0, Math.PI * 2); x.fillStyle = col; x.fill();
  }
  x.shadowBlur = 0;
  // the favicon's face, scaled up (viewBox 64: circle at 32,30 r22)
  x.save(); x.translate(S / 2, S / 2 + 6); x.scale(6.2, 6.2); x.translate(-32, -30);
  x.beginPath(); x.arc(32, 30, 22, 0, Math.PI * 2); x.fillStyle = '#e8384f'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#17110e'; x.stroke();
  const eye = (cx) => { x.beginPath(); x.ellipse(cx, 27, 5, 7, 0, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); x.beginPath(); x.arc(cx + 1, 28, 3, 0, Math.PI * 2); x.fillStyle = '#17110e'; x.fill(); };
  eye(25); eye(39);
  x.beginPath(); x.moveTo(22, 38); x.quadraticCurveTo(32, 46, 42, 38); x.lineWidth = 3; x.strokeStyle = '#17110e'; x.lineCap = 'round'; x.stroke();
  x.restore();
  return c.toDataURL('image/png');
})()`;

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  await w.loadURL('data:text/html,<!doctype html><title>icon</title>');
  const url = await w.webContents.executeJavaScript(draw);
  const out = path.join(__dirname, '..', 'build', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', out);
  app.quit();
});
