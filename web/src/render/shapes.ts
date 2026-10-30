// Dynamic vector-shape batch (telegraphs, beams, cones, rings, slashes). Rebuilt each frame into
// one non-indexed triangle buffer with per-vertex RGBA. World coords are y-down.

import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec4 color;
varying vec4 vCol;
void main() {
  vCol = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, -position.y, position.z, 1.0);
}`;
const FRAG = /* glsl */ `
varying vec4 vCol;
void main() { gl_FragColor = vCol; }`;

export class ShapeBatch {
  mesh: THREE.Mesh;
  private pos: Float32Array;
  private col: Float32Array;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private n = 0; // vertices
  readonly cap: number;
  z = 0;

  constructor(capVerts: number, additive: boolean, order: number) {
    this.cap = capVerts;
    this.pos = new Float32Array(capVerts * 3);
    this.col = new Float32Array(capVerts * 4);
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    this.colAttr = new THREE.BufferAttribute(this.col, 4);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = order;
  }

  begin(): void {
    this.n = 0;
  }
  end(): void {
    const g = this.mesh.geometry;
    g.setDrawRange(0, this.n);
    if (this.n > 0) {
      this.posAttr.clearUpdateRanges();
      this.posAttr.addUpdateRange(0, this.n * 3);
      this.posAttr.needsUpdate = true;
      this.colAttr.clearUpdateRanges();
      this.colAttr.addUpdateRange(0, this.n * 4);
      this.colAttr.needsUpdate = true;
    }
  }

  private v(x: number, y: number, r: number, g: number, b: number, a: number): void {
    if (this.n >= this.cap) return;
    const i3 = this.n * 3, i4 = this.n * 4;
    this.pos[i3] = x;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = this.z;
    this.col[i4] = r;
    this.col[i4 + 1] = g;
    this.col[i4 + 2] = b;
    this.col[i4 + 3] = a;
    this.n++;
  }

  tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, r: number, g: number, b: number, a: number, a2 = a, a3 = a): void {
    if (this.n + 3 > this.cap) return;
    this.v(x1, y1, r, g, b, a);
    this.v(x2, y2, r, g, b, a2);
    this.v(x3, y3, r, g, b, a3);
  }

  /** Filled circle; `edgeA` lets the rim fade (soft glow) or brighten. */
  circle(x: number, y: number, rad: number, r: number, g: number, b: number, a: number, edgeA = a, seg = 0): void {
    const n = seg || Math.max(12, Math.min(64, Math.round(rad / 6)));
    let px = x + rad, py = y;
    for (let i = 1; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      const nx = x + Math.cos(t) * rad, ny = y + Math.sin(t) * rad;
      this.tri(x, y, px, py, nx, ny, r, g, b, a, edgeA, edgeA);
      px = nx;
      py = ny;
    }
  }

  /** Annulus band between r0 and r1, optional angular range [a0, a1]. */
  ring(x: number, y: number, r0: number, r1: number, r: number, g: number, b: number, a: number, aOuter = a, a0 = 0, a1 = Math.PI * 2, seg = 0): void {
    const span = a1 - a0;
    const n = seg || Math.max(12, Math.min(96, Math.round((r1 * Math.abs(span)) / 10)));
    for (let i = 0; i < n; i++) {
      const t0 = a0 + (span * i) / n, t1 = a0 + (span * (i + 1)) / n;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      const ix0 = x + c0 * r0, iy0 = y + s0 * r0, ox0 = x + c0 * r1, oy0 = y + s0 * r1;
      const ix1 = x + c1 * r0, iy1 = y + s1 * r0, ox1 = x + c1 * r1, oy1 = y + s1 * r1;
      this.tri(ix0, iy0, ox0, oy0, ox1, oy1, r, g, b, a, aOuter, aOuter);
      this.tri(ix0, iy0, ox1, oy1, ix1, iy1, r, g, b, a, aOuter, a);
    }
  }

  sector(x: number, y: number, r0: number, r1: number, ang: number, half: number, r: number, g: number, b: number, a: number, aOuter = a): void {
    this.ring(x, y, r0, r1, r, g, b, a, aOuter, ang - half, ang + half);
  }

  /** Thick line (quad) with soft edges: centre alpha a, edge alpha aEdge. */
  line(x1: number, y1: number, x2: number, y2: number, w: number, r: number, g: number, b: number, a: number, aEdge = a): void {
    const dx = x2 - x1, dy = y2 - y1;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * w, ny = (dx / l) * w;
    if (aEdge === a) {
      this.tri(x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, r, g, b, a);
      this.tri(x1 + nx, y1 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny, r, g, b, a);
    } else {
      // centre spine at full alpha, edges fade
      this.tri(x1, y1, x2, y2, x2 + nx, y2 + ny, r, g, b, a, a, aEdge);
      this.tri(x1, y1, x2 + nx, y2 + ny, x1 + nx, y1 + ny, r, g, b, a, aEdge, aEdge);
      this.tri(x1, y1, x2, y2, x2 - nx, y2 - ny, r, g, b, a, a, aEdge);
      this.tri(x1, y1, x2 - nx, y2 - ny, x1 - nx, y1 - ny, r, g, b, a, aEdge, aEdge);
    }
  }

  rectOutline(x: number, y: number, hw: number, hh: number, w: number, r: number, g: number, b: number, a: number): void {
    this.line(x - hw, y - hh, x + hw, y - hh, w, r, g, b, a);
    this.line(x + hw, y - hh, x + hw, y + hh, w, r, g, b, a);
    this.line(x + hw, y + hh, x - hw, y + hh, w, r, g, b, a);
    this.line(x - hw, y + hh, x - hw, y - hh, w, r, g, b, a);
  }
}
