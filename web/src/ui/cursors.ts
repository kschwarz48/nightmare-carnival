// The game's own cursors (D-93), drawn at start in the UI's poster style: ink outlines, gilt, a 1930s cartoon glove.
//   --cur       the gilt arrow, everywhere
//   --cur-hand  the white cartoon glove pointing, over anything that can be clicked
//   --cur-aim   the shooting-gallery sight, over the night while you fight (the mouse aims; body.aiming)
//   --cur-no    the arrow with a red "no", over what can't be used yet
//   --cur-help  the arrow with a "?" tag, over what has a tooltip
// Each is drawn at 1x and 2x (crisp on high-DPI screens) and set as a CSS variable on the root, which the
// stylesheet uses; until then, or without a canvas, the browser's own cursors stand in (style.css's :root).
// 32 px is the largest a custom cursor can be everywhere in the window (Chromium hides bigger ones near its edge).

type Draw = (c: CanvasRenderingContext2D) => void;

const SIZE = 32;
const INK = '#17110e';
const TAU = Math.PI * 2;

/** The arrow (tip at 3, 2.5). */
const ARROW = 'M3 2.5 L3 24.5 L8.6 19.6 L12.6 28.4 L16.6 26.6 L12.6 18 L20.4 18 Z';

function shadow(c: CanvasRenderingContext2D, paths: Path2D[]): void {
  c.save();
  c.translate(1.3, 1.8);
  c.fillStyle = 'rgba(0, 0, 0, 0.42)';
  c.lineWidth = 3.4;
  c.strokeStyle = 'rgba(0, 0, 0, 0.42)';
  for (const p of paths) {
    c.stroke(p);
    c.fill(p);
  }
  c.restore();
}

/** Ink round each piece, then fill them all: one outline round the whole shape, none between its pieces. */
function sticker(c: CanvasRenderingContext2D, paths: Path2D[], fill: string | CanvasGradient, ink = 3.4): void {
  c.lineWidth = ink;
  c.strokeStyle = INK;
  for (const p of paths) c.stroke(p);
  c.fillStyle = fill;
  for (const p of paths) c.fill(p);
}

const gilt = (c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#fff2b8');
  g.addColorStop(0.32, '#f2c14e');
  g.addColorStop(0.75, '#c8902e');
  g.addColorStop(1, '#8a5a18');
  return g;
};

/** The gilt arrow: a bevel down its edge and a ruby at the base of its head. */
const arrow: Draw = (c) => {
  const p = new Path2D(ARROW);
  shadow(c, [p]);
  sticker(c, [p], gilt(c, 3, 2, 15, 28));
  c.lineWidth = 1.1;
  c.strokeStyle = 'rgba(255, 249, 226, 0.9)';
  c.beginPath();
  c.moveTo(4.7, 6.5);
  c.lineTo(4.7, 20.6);
  c.stroke();
  c.beginPath();
  c.arc(8.4, 15.4, 2.2, 0, TAU);
  c.fillStyle = '#c8322d';
  c.fill();
  c.lineWidth = 1.1;
  c.strokeStyle = INK;
  c.stroke();
  c.beginPath();
  c.arc(7.7, 14.7, 0.75, 0, TAU);
  c.fillStyle = '#ffd9cf';
  c.fill();
};

/** The arrow with a badge at its foot. */
const badged = (badge: Draw): Draw => (c) => {
  arrow(c);
  badge(c);
};

/** A red "no": a ring with a bar across it. */
const no: Draw = badged((c) => {
  const x = 24, y = 23.5, r = 5.6;
  c.beginPath();
  c.arc(x, y, r + 1.4, 0, TAU);
  c.fillStyle = INK;
  c.fill();
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = '#f7eedb';
  c.fill();
  c.lineWidth = 2.2;
  c.strokeStyle = '#c8322d';
  c.stroke();
  c.beginPath();
  c.moveTo(x - r * 0.68, y + r * 0.68);
  c.lineTo(x + r * 0.68, y - r * 0.68);
  c.stroke();
});

/** A gilt tag with a "?". */
const help: Draw = badged((c) => {
  const x = 24.2, y = 23.2, r = 6;
  c.beginPath();
  c.arc(x, y, r + 1.4, 0, TAU);
  c.fillStyle = INK;
  c.fill();
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = gilt(c, x - r, y - r, x + r, y + r);
  c.fill();
  c.fillStyle = INK;
  c.font = 'bold 10px Georgia, serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('?', x, y + 0.6);
});

/** The cartoon glove pointing up (fingertip at 12, 1.6): a puffy white glove, the three stitches on its back, a
 *  rolled cuff with a gilt edge. */
const hand: Draw = (c) => {
  const finger = new Path2D();
  finger.roundRect(8.8, 1.6, 6.6, 14, 3.3);
  const fist = new Path2D();
  fist.roundRect(6.2, 11.2, 16.6, 12.6, 5);
  const knuckles = new Path2D();
  knuckles.arc(17.8, 13.2, 2.9, 0, TAU);
  knuckles.moveTo(23.6, 15.6);
  knuckles.arc(21, 15.6, 2.6, 0, TAU);
  const thumb = new Path2D();
  thumb.ellipse(6.6, 17.6, 3.2, 4.6, -0.55, 0, TAU);
  const cuff = new Path2D('M7.2 22.2 L22 22.2 L23.3 28.2 L5.9 28.2 Z');
  const parts = [finger, fist, knuckles, thumb, cuff];
  shadow(c, parts);
  sticker(c, parts, '#fbf6ea');
  // the folded fingers' creases and the thumb's
  c.lineWidth = 1.1;
  c.strokeStyle = 'rgba(23, 17, 14, 0.55)';
  c.beginPath();
  c.moveTo(15.6, 14.6);
  c.quadraticCurveTo(16.6, 16.4, 18.6, 16.2);
  c.moveTo(19.6, 17.2);
  c.quadraticCurveTo(20.8, 18.6, 22.4, 18);
  c.moveTo(8.4, 15.2);
  c.quadraticCurveTo(9.8, 17.4, 9.4, 19.6);
  c.stroke();
  // the three stitches down the back
  c.lineWidth = 1.2;
  c.strokeStyle = INK;
  c.beginPath();
  for (const x of [12.4, 15, 17.6]) {
    c.moveTo(x, 18.6);
    c.lineTo(x, 21.4);
  }
  c.stroke();
  // the cuff: a gilt edge where it rolls over, two pleats
  c.lineWidth = 1.6;
  c.strokeStyle = '#d9a63a';
  c.beginPath();
  c.moveTo(7.6, 23.8);
  c.lineTo(21.8, 23.8);
  c.stroke();
  c.lineWidth = 1;
  c.strokeStyle = 'rgba(23, 17, 14, 0.6)';
  c.beginPath();
  c.moveTo(11.6, 25.2);
  c.lineTo(11.3, 27.8);
  c.moveTo(17.4, 25.2);
  c.lineTo(17.7, 27.8);
  c.stroke();
};

/** The shooting-gallery sight (centred): a gilt ring, four ticks outside it, a red bead in the middle. */
const aim: Draw = (c) => {
  const x = 16, y = 16, r = 9.4;
  const ring = new Path2D();
  ring.arc(x, y, r, 0, TAU);
  const ticks = new Path2D();
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    ticks.moveTo(x + dx * 12, y + dy * 12);
    ticks.lineTo(x + dx * 15.2, y + dy * 15.2);
  }
  c.lineWidth = 4.6;
  c.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  c.save();
  c.translate(1, 1.4);
  c.stroke(ring);
  c.stroke(ticks);
  c.restore();
  c.strokeStyle = INK;
  c.stroke(ring);
  c.stroke(ticks);
  c.lineWidth = 2.2;
  c.strokeStyle = '#f2c14e';
  c.stroke(ring);
  c.stroke(ticks);
  c.beginPath();
  c.arc(x, y, 2.1, 0, TAU);
  c.fillStyle = '#ff4a3a';
  c.fill();
  c.lineWidth = 1.3;
  c.strokeStyle = INK;
  c.stroke();
};

const CURSORS: { name: string; hot: [number, number]; draw: Draw; fallback: string }[] = [
  { name: 'cur', hot: [3, 3], draw: arrow, fallback: 'auto' },
  { name: 'cur-hand', hot: [12, 2], draw: hand, fallback: 'pointer' },
  { name: 'cur-aim', hot: [16, 16], draw: aim, fallback: 'crosshair' },
  { name: 'cur-no', hot: [3, 3], draw: no, fallback: 'not-allowed' },
  { name: 'cur-help', hot: [3, 3], draw: help, fallback: 'help' },
];

function png(draw: Draw, scale: number): string | null {
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE * scale;
  const c = cv.getContext('2d');
  if (!c) return null;
  c.scale(scale, scale);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  return cv.toDataURL('image/png');
}

/** Draw the cursors and hand them to the stylesheet. Safe to call before anything else is on screen. */
export function installCursors(): void {
  try {
    const root = document.documentElement;
    const test = 'url("data:image/png;base64,AA==")';
    const ok = (v: string) => typeof CSS !== 'undefined' && CSS.supports('cursor', v);
    // image-set picks the 2x drawing on a high-DPI screen; failing that, the 1x one alone
    const set = ok(`image-set(${test} 1x, ${test} 2x) 0 0, auto`) ? 'image-set' : ok(`-webkit-image-set(${test} 1x, ${test} 2x) 0 0, auto`) ? '-webkit-image-set' : null;
    for (const d of CURSORS) {
      const one = png(d.draw, 1);
      if (!one) return;
      const two = set ? png(d.draw, 2) : null;
      const img = set && two ? `${set}(url("${one}") 1x, url("${two}") 2x)` : `url("${one}")`;
      root.style.setProperty(`--${d.name}`, `${img} ${d.hot[0]} ${d.hot[1]}, ${d.fallback}`);
    }
  } catch {
    // the browser's own cursors stay
  }
}
