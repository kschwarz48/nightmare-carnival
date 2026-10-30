// Allocation-free uniform spatial grid (linked-list cells). Rebuilt once per tick from the
// active enemy list; used for separation, weapon hit queries and nearest-enemy searches.
// Port of the Godot SpatialHash, but bounded to the map so cells are a flat Int32Array.

export class SpatialGrid {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly minX: number;
  readonly minY: number;
  private head: Int32Array;
  private next: Int32Array;
  private stamp: Int32Array; // visit stamps for de-duplicating multi-cell queries
  private stampId = 1;
  count = 0;

  constructor(minX: number, minY: number, width: number, height: number, cell: number, capacity: number) {
    this.cell = cell;
    this.minX = minX;
    this.minY = minY;
    this.cols = Math.ceil(width / cell) + 1;
    this.rows = Math.ceil(height / cell) + 1;
    this.head = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(capacity).fill(-1);
    this.stamp = new Int32Array(capacity);
  }

  clear(): void {
    this.head.fill(-1);
    this.count = 0;
  }

  private cellIndex(x: number, y: number): number {
    let cx = Math.floor((x - this.minX) / this.cell);
    let cy = Math.floor((y - this.minY) / this.cell);
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  insert(id: number, x: number, y: number): void {
    const c = this.cellIndex(x, y);
    this.next[id] = this.head[c];
    this.head[c] = id;
    this.count++;
  }

  /**
   * Visit every id whose cell overlaps the AABB around (x,y,r). Visitor returns true to stop.
   * Callers do the precise distance test themselves.
   */
  query(x: number, y: number, r: number, visit: (id: number) => boolean | void): void {
    const c = this.cell;
    let x0 = Math.floor((x - r - this.minX) / c), x1 = Math.floor((x + r - this.minX) / c);
    let y0 = Math.floor((y - r - this.minY) / c), y1 = Math.floor((y + r - this.minY) / c);
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 >= this.cols) x1 = this.cols - 1;
    if (y1 >= this.rows) y1 = this.rows - 1;
    for (let cy = y0; cy <= y1; cy++) {
      const row = cy * this.cols;
      for (let cx = x0; cx <= x1; cx++) {
        let id = this.head[row + cx];
        while (id !== -1) {
          const nxt = this.next[id];
          if (visit(id) === true) return;
          id = nxt;
        }
      }
    }
  }

  /** Begin a de-duplicated query pass (for segment sweeps that query several points). */
  beginStamp(): number {
    this.stampId++;
    if (this.stampId > 2e9) {
      this.stamp.fill(0);
      this.stampId = 1;
    }
    return this.stampId;
  }
  markOnce(id: number, stampId: number): boolean {
    if (this.stamp[id] === stampId) return false;
    this.stamp[id] = stampId;
    return true;
  }
}
