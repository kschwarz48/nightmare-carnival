// The 1933 photograph in the Gift Shop (D-69): Ada at nine on the boardwalk, the Gala Queen behind her on
// her last departure, and the four keepsakes she had with her that night laid out on the boards in front of
// her, big and plain so they can be matched against the souvenirs on the stands. Painted in sepia on a
// canvas from the quest's replicated keepsake mask, so every screen in a party shows the same four.

import * as THREE from 'three';
import { KEEPSAKES } from '../../../data/boardwalk';

const W = 640, H = 436;
/** the print inside its mount: left, top, right, bottom */
const P = { x0: 20, y0: 20, x1: W - 20, y1: H - 52 };
const PAPER = '#e6d8b8', LIGHT = '#d4c09a', MID = '#a2855e', DARK = '#4a3622', INK = '#22160c';

type Ctx = CanvasRenderingContext2D;

/** A painted outline: fill, then a dark edge so the shape reads at a distance. */
function shape(c: Ctx, fill: string, path: (c: Ctx) => void, edge = 3): void {
  c.beginPath();
  path(c);
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = edge;
  c.strokeStyle = INK;
  c.stroke();
}

// ---------------------------------------------------------------- the keepsakes, each in a ~110 px box
const DRAW: Record<(typeof KEEPSAKES)[number], (c: Ctx) => void> = {
  pinwheel: (c) => {
    c.lineWidth = 6;
    c.strokeStyle = DARK;
    c.beginPath();
    c.moveTo(0, -8);
    c.lineTo(0, 52);
    c.stroke();
    for (let k = 0; k < 4; k++) {
      c.save();
      c.translate(0, -18);
      c.rotate((k * Math.PI) / 2);
      shape(c, k % 2 ? PAPER : MID, (q) => {
        q.moveTo(0, 0);
        q.lineTo(36, -6);
        q.quadraticCurveTo(30, -26, 8, -34);
        q.closePath();
      });
      c.restore();
    }
    shape(c, DARK, (q) => q.arc(0, -18, 5, 0, Math.PI * 2), 2);
  },
  'tin pail': (c) => {
    shape(c, MID, (q) => {
      q.moveTo(-34, -22);
      q.lineTo(34, -22);
      q.lineTo(24, 40);
      q.lineTo(-24, 40);
      q.closePath();
    });
    c.fillStyle = LIGHT;
    c.fillRect(-14, -16, 8, 50);
    shape(c, DARK, (q) => q.ellipse(0, -22, 34, 8, 0, 0, Math.PI * 2));
    c.lineWidth = 4;
    c.strokeStyle = INK;
    c.beginPath();
    c.arc(0, -22, 34, Math.PI * 1.08, Math.PI * 1.92);
    c.stroke();
    // a starfish painted on its side
    shape(c, PAPER, (q) => {
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 5 : 13;
        q.lineTo(6 + Math.cos(a) * r, 12 + Math.sin(a) * r);
      }
      q.closePath();
    }, 2);
  },
  'sailor doll': (c) => {
    for (const s of [-1, 1]) shape(c, DARK, (q) => q.rect(s * 7 - 5, 26, 10, 26), 2);
    shape(c, DARK, (q) => {
      q.moveTo(-20, -10);
      q.lineTo(20, -10);
      q.lineTo(24, 30);
      q.lineTo(-24, 30);
      q.closePath();
    });
    shape(c, PAPER, (q) => {
      q.moveTo(-18, -10);
      q.lineTo(18, -10);
      q.lineTo(0, 10);
      q.closePath();
    }, 2);
    for (const s of [-1, 1]) shape(c, DARK, (q) => q.ellipse(s * 26, 6, 6, 16, s * 0.3, 0, Math.PI * 2), 2);
    shape(c, LIGHT, (q) => q.arc(0, -24, 15, 0, Math.PI * 2));
    c.fillStyle = INK;
    for (const s of [-1, 1]) c.fillRect(s * 5 - 2, -27, 4, 4);
    shape(c, PAPER, (q) => q.ellipse(0, -38, 19, 5, 0, 0, Math.PI * 2), 2);
    shape(c, PAPER, (q) => q.ellipse(0, -43, 11, 6, 0, Math.PI, 0), 2);
  },
  'paper boat': (c) => {
    shape(c, PAPER, (q) => {
      q.moveTo(-50, 4);
      q.lineTo(50, 4);
      q.lineTo(34, 30);
      q.lineTo(-34, 30);
      q.closePath();
    });
    shape(c, LIGHT, (q) => {
      q.moveTo(-28, 4);
      q.lineTo(0, -40);
      q.lineTo(28, 4);
      q.closePath();
    });
    c.lineWidth = 2;
    c.strokeStyle = DARK;
    c.beginPath();
    c.moveTo(0, -40);
    c.lineTo(0, 4);
    c.moveTo(-50, 4);
    c.lineTo(-34, 18);
    c.moveTo(50, 4);
    c.lineTo(34, 18);
    c.stroke();
  },
  'silk ribbon': (c) => {
    for (const s of [-1, 1]) {
      shape(c, MID, (q) => {
        q.moveTo(0, 0);
        q.bezierCurveTo(s * 18, -34, s * 50, -22, s * 40, 0);
        q.bezierCurveTo(s * 48, 18, s * 18, 20, 0, 0);
      });
      shape(c, DARK, (q) => {
        q.moveTo(s * 4, 4);
        q.lineTo(s * 22, 46);
        q.lineTo(s * 14, 40);
        q.lineTo(s * 10, 50);
        q.lineTo(-s * 2, 8);
        q.closePath();
      }, 2);
    }
    shape(c, DARK, (q) => q.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2));
  },
  'seahorse charm': (c) => {
    shape(c, LIGHT, (q) => {
      q.moveTo(4, -40);
      q.bezierCurveTo(20, -42, 26, -30, 18, -18);
      q.lineTo(34, -18);
      q.lineTo(34, -10);
      q.lineTo(16, -8);
      q.bezierCurveTo(26, 8, 22, 26, 8, 34);
      q.bezierCurveTo(-4, 42, -18, 40, -16, 28);
      q.bezierCurveTo(-14, 20, -2, 22, -4, 30);
      q.bezierCurveTo(-10, 30, -10, 24, -4, 22);
      q.bezierCurveTo(4, 14, 0, 0, -6, -8);
      q.bezierCurveTo(-12, -18, -8, -36, 4, -40);
    });
    c.fillStyle = INK;
    c.beginPath();
    c.arc(10, -28, 3, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = DARK;
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.moveTo(-6 + k * 2, -16 + k * 11);
      c.lineTo(8 + k, -14 + k * 11);
      c.stroke();
    }
    c.lineWidth = 4;
    c.strokeStyle = INK;
    c.beginPath();
    c.arc(4, -48, 7, 0, Math.PI * 2);
    c.stroke();
  },
  jacks: (c) => {
    const jack = (x: number, y: number, a: number) => {
      c.save();
      c.translate(x, y);
      c.rotate(a);
      for (let k = 0; k < 3; k++) {
        const r = (k * Math.PI) / 3;
        c.lineWidth = 5;
        c.strokeStyle = DARK;
        c.beginPath();
        c.moveTo(-Math.cos(r) * 18, -Math.sin(r) * 18);
        c.lineTo(Math.cos(r) * 18, Math.sin(r) * 18);
        c.stroke();
        for (const s of [-1, 1]) shape(c, LIGHT, (q) => q.arc(s * Math.cos(r) * 18, s * Math.sin(r) * 18, 4.5, 0, Math.PI * 2), 2);
      }
      c.restore();
    };
    jack(-26, 14, 0.2);
    jack(16, -14, 0.9);
    jack(22, 26, 0.5);
    shape(c, MID, (q) => q.arc(-20, -26, 11, 0, Math.PI * 2));
    c.fillStyle = PAPER;
    c.beginPath();
    c.arc(-24, -30, 3.5, 0, Math.PI * 2);
    c.fill();
  },
  kite: (c) => {
    shape(c, LIGHT, (q) => {
      q.moveTo(0, -50);
      q.lineTo(30, -12);
      q.lineTo(0, 30);
      q.lineTo(-30, -12);
      q.closePath();
    });
    shape(c, MID, (q) => {
      q.moveTo(0, -50);
      q.lineTo(30, -12);
      q.lineTo(0, -12);
      q.closePath();
    }, 2);
    shape(c, MID, (q) => {
      q.moveTo(0, 30);
      q.lineTo(-30, -12);
      q.lineTo(0, -12);
      q.closePath();
    }, 2);
    c.lineWidth = 3;
    c.strokeStyle = DARK;
    c.beginPath();
    c.moveTo(0, 30);
    c.bezierCurveTo(16, 40, -14, 48, 6, 58);
    c.stroke();
    for (const [x, y] of [[8, 38], [-4, 47], [6, 56]] as [number, number][]) {
      shape(c, DARK, (q) => {
        q.moveTo(x - 7, y - 4);
        q.lineTo(x + 7, y + 4);
        q.lineTo(x + 7, y - 4);
        q.lineTo(x - 7, y + 4);
        q.closePath();
      }, 1.5);
    }
  },
};

/** Ada at nine: a sailor dress, a dark bob, white socks, standing for the camera with her hands folded. */
function ada(c: Ctx, x: number, y: number): void {
  // legs and Mary Janes
  for (const s of [-1, 1]) {
    c.fillStyle = PAPER;
    c.fillRect(x + s * 10 - 5, y + 80, 10, 34);
    shape(c, INK, (q) => q.ellipse(x + s * 11, y + 116, 9, 5, 0, 0, Math.PI * 2), 1);
  }
  // the dress: a white sailor top, a pleated skirt, the square collar and its dark bow
  shape(c, '#ece2c8', (q) => {
    q.moveTo(x - 20, y - 14);
    q.lineTo(x + 20, y - 14);
    q.lineTo(x + 34, y + 82);
    q.lineTo(x - 34, y + 82);
    q.closePath();
  });
  c.lineWidth = 2;
  c.strokeStyle = MID;
  for (let k = -3; k <= 3; k++) {
    c.beginPath();
    c.moveTo(x + k * 6, y + 40);
    c.lineTo(x + k * 9.5, y + 82);
    c.stroke();
  }
  shape(c, DARK, (q) => {
    q.moveTo(x - 22, y - 14);
    q.lineTo(x + 22, y - 14);
    q.lineTo(x + 6, y + 16);
    q.lineTo(x - 6, y + 16);
    q.closePath();
  }, 2);
  shape(c, '#ece2c8', (q) => {
    q.moveTo(x - 10, y - 14);
    q.lineTo(x + 10, y - 14);
    q.lineTo(x, y + 6);
    q.closePath();
  }, 1.5);
  shape(c, INK, (q) => {
    q.moveTo(x, y + 14);
    q.lineTo(x - 12, y + 8);
    q.lineTo(x - 12, y + 22);
    q.closePath();
    q.moveTo(x, y + 14);
    q.lineTo(x + 12, y + 8);
    q.lineTo(x + 12, y + 22);
    q.closePath();
  }, 1);
  // arms, the hands folded in front
  for (const s of [-1, 1]) {
    shape(c, '#ece2c8', (q) => {
      q.moveTo(x + s * 20, y - 12);
      q.quadraticCurveTo(x + s * 30, y + 20, x + s * 8, y + 40);
      q.lineTo(x + s * 2, y + 34);
      q.quadraticCurveTo(x + s * 20, y + 18, x + s * 14, y - 8);
      q.closePath();
    }, 2);
  }
  shape(c, LIGHT, (q) => q.arc(x, y + 38, 7, 0, Math.PI * 2), 1.5);
  // the face, the bob, a ribbon in her hair
  shape(c, LIGHT, (q) => q.ellipse(x, y - 34, 17, 19, 0, 0, Math.PI * 2), 2);
  shape(c, INK, (q) => {
    q.moveTo(x - 20, y - 26);
    q.quadraticCurveTo(x - 24, y - 58, x, y - 56);
    q.quadraticCurveTo(x + 24, y - 58, x + 20, y - 26);
    q.lineTo(x + 14, y - 26);
    q.quadraticCurveTo(x + 12, y - 44, x - 2, y - 44);
    q.quadraticCurveTo(x - 12, y - 44, x - 14, y - 26);
    q.closePath();
  }, 1);
  c.fillStyle = INK;
  for (const s of [-1, 1]) c.fillRect(x + s * 6 - 1.5, y - 34, 3, 3);
  c.lineWidth = 1.5;
  c.strokeStyle = DARK;
  c.beginPath();
  c.arc(x, y - 27, 5, 0.2, Math.PI - 0.2);
  c.stroke();
  shape(c, MID, (q) => q.ellipse(x + 14, y - 52, 8, 5, 0.5, 0, Math.PI * 2), 1.5);
}

/** The whole print: sky, sea and the ship, the railing, Ada, the four keepsakes; then age, then the mount. */
function paint(c: Ctx, mask: number): void {
  const w = P.x1 - P.x0, h = P.y1 - P.y0;
  c.fillStyle = '#d8cbaa';
  c.fillRect(0, 0, W, H);
  c.save();
  c.beginPath();
  c.rect(P.x0, P.y0, w, h);
  c.clip();
  c.translate(P.x0, P.y0);
  const hz = h * 0.4;
  let g = c.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, '#c4ab84');
  g.addColorStop(1, '#e4d4b2');
  c.fillStyle = g;
  c.fillRect(0, 0, w, hz);
  g = c.createLinearGradient(0, hz, 0, h * 0.6);
  g.addColorStop(0, '#988060');
  g.addColorStop(1, '#b49c78');
  c.fillStyle = g;
  c.fillRect(0, hz, w, h * 0.2);
  c.strokeStyle = 'rgba(232,220,192,0.45)';
  c.lineWidth = 1.5;
  for (let k = 0; k < 9; k++) {
    const y = hz + 6 + k * 8, x = (k * 97) % w;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 60 + (k % 3) * 30, y);
    c.stroke();
  }
  // the Gala Queen on the horizon, steaming out with her lights strung stem to stern
  const sx = w * 0.12;
  c.fillStyle = 'rgba(60,44,30,0.35)';
  for (let k = 0; k < 6; k++) {
    c.beginPath();
    c.arc(sx + 70 + k * 20, hz - 50 - k * 4, 10 + k * 3, 0, Math.PI * 2);
    c.fill();
  }
  shape(c, DARK, (q) => {
    q.moveTo(sx, hz - 14);
    q.lineTo(sx + 170, hz - 14);
    q.lineTo(sx + 156, hz + 2);
    q.lineTo(sx + 12, hz + 2);
    q.closePath();
  }, 1.5);
  shape(c, MID, (q) => q.rect(sx + 30, hz - 26, 112, 12), 1.5);
  shape(c, LIGHT, (q) => q.rect(sx + 48, hz - 34, 70, 8), 1.5);
  for (const fx of [60, 92]) shape(c, DARK, (q) => q.rect(sx + fx, hz - 54, 12, 22), 1.5);
  c.strokeStyle = DARK;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(sx + 4, hz - 14);
  c.lineTo(sx + 84, hz - 60);
  c.lineTo(sx + 166, hz - 14);
  c.stroke();
  // the railing behind her and the boards under her
  const ry = h * 0.6;
  g = c.createLinearGradient(0, ry, 0, h);
  g.addColorStop(0, '#b29a74');
  g.addColorStop(1, '#cdb994');
  c.fillStyle = g;
  c.fillRect(0, ry, w, h - ry);
  c.strokeStyle = 'rgba(58,40,24,0.5)';
  c.lineWidth = 2;
  for (let y = ry + 8, k = 0; y < h; y += 8 + k * 2.2, k++) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
  c.fillStyle = DARK;
  c.fillRect(0, ry - 34, w, 6);
  c.fillRect(0, ry - 14, w, 4);
  for (let x = 14; x < w; x += 46) c.fillRect(x, ry - 36, 6, 36);
  ada(c, w * 0.5, h * 0.24 + 40);
  // her four things, laid out on the boards in front of her
  const mine: number[] = [];
  for (let i = 0; i < KEEPSAKES.length; i++) if (mask & (1 << i)) mine.push(i);
  mine.forEach((i, k) => {
    c.save();
    c.translate(w * (0.14 + k * 0.24), h * 0.83);
    c.scale(0.92, 0.92);
    c.fillStyle = 'rgba(40,26,14,0.25)';
    c.beginPath();
    c.ellipse(4, 52, 40, 9, 0, 0, Math.PI * 2);
    c.fill();
    DRAW[KEEPSAKES[i]](c);
    c.restore();
  });
  // age: a vignette, grain, a few scratches and foxing
  g = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
  g.addColorStop(0, 'rgba(40,24,10,0)');
  g.addColorStop(1, 'rgba(40,24,10,0.55)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 2600; k++) {
    c.fillStyle = rnd() > 0.5 ? 'rgba(255,245,220,0.10)' : 'rgba(30,18,8,0.10)';
    c.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
  }
  c.strokeStyle = 'rgba(250,240,215,0.35)';
  c.lineWidth = 1;
  for (let k = 0; k < 5; k++) {
    const x = rnd() * w;
    c.beginPath();
    c.moveTo(x, rnd() * h * 0.3);
    c.lineTo(x + (rnd() - 0.5) * 40, h * (0.5 + rnd() * 0.5));
    c.stroke();
  }
  for (let k = 0; k < 7; k++) {
    c.fillStyle = 'rgba(120,80,40,0.12)';
    c.beginPath();
    c.arc(rnd() * w, rnd() * h, 3 + rnd() * 7, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  c.lineWidth = 2;
  c.strokeStyle = 'rgba(60,42,24,0.6)';
  c.strokeRect(P.x0, P.y0, w, h);
  c.fillStyle = '#3a2614';
  c.font = 'italic 30px Georgia, "Times New Roman", serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('Ada — the summer of ’33', W / 2, H - 26);
}

export class Photograph {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private texture: THREE.CanvasTexture;
  private shown = -1;

  constructor(w: number, h: number) {
    this.canvas.width = W;
    this.canvas.height = H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    // lit by its own lamp: the emissive keeps it legible in the shop's dark, like the painted signs
    const mat = new THREE.MeshStandardMaterial({ map: this.texture, emissive: new THREE.Color(0xffffff), emissiveMap: this.texture, emissiveIntensity: 0.48, roughness: 0.65, metalness: 0 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    this.mesh.receiveShadow = true;
  }

  /** Paint the print for tonight's keepsakes (a bitmask over KEEPSAKES); unchanged masks cost nothing. */
  show(mask: number): void {
    if (mask === this.shown) return;
    this.shown = mask;
    const c = this.canvas.getContext('2d');
    if (!c) return;
    paint(c, mask);
    this.texture.needsUpdate = true;
  }
}
