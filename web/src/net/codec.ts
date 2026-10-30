// Binary codec for the network layer (D-52): a growable little-endian writer, a bounds-checked
// reader (malformed input throws instead of reading garbage), and a string dictionary that is
// synchronised to the peer until acknowledged, so repeated strings (kinds, styles, ids) cost 2 bytes.

const enc = new TextEncoder();
const dec = new TextDecoder();

export class Writer {
  private buf: ArrayBuffer;
  private dv: DataView;
  private u8a: Uint8Array;
  o = 0;

  constructor(size = 8192) {
    this.buf = new ArrayBuffer(size);
    this.dv = new DataView(this.buf);
    this.u8a = new Uint8Array(this.buf);
  }

  private need(n: number): void {
    if (this.o + n <= this.buf.byteLength) return;
    let size = this.buf.byteLength * 2;
    while (size < this.o + n) size *= 2;
    const next = new ArrayBuffer(size);
    new Uint8Array(next).set(this.u8a.subarray(0, this.o));
    this.buf = next;
    this.dv = new DataView(next);
    this.u8a = new Uint8Array(next);
  }

  reset(): this {
    this.o = 0;
    return this;
  }
  u8(v: number): void {
    this.need(1);
    this.dv.setUint8(this.o, v & 0xff);
    this.o += 1;
  }
  i8(v: number): void {
    this.need(1);
    this.dv.setInt8(this.o, Math.max(-128, Math.min(127, Math.round(v))));
    this.o += 1;
  }
  u16(v: number): void {
    this.need(2);
    this.dv.setUint16(this.o, Math.max(0, Math.min(65535, Math.round(v))), true);
    this.o += 2;
  }
  i16(v: number): void {
    this.need(2);
    this.dv.setInt16(this.o, Math.max(-32768, Math.min(32767, Math.round(v))), true);
    this.o += 2;
  }
  u32(v: number): void {
    this.need(4);
    this.dv.setUint32(this.o, v >>> 0, true);
    this.o += 4;
  }
  f32(v: number): void {
    this.need(4);
    this.dv.setFloat32(this.o, Number.isFinite(v) ? v : 0, true);
    this.o += 4;
  }
  /** Unit fraction 0..1 in a byte. */
  frac(v: number): void {
    this.u8(Math.max(0, Math.min(255, Math.round(v * 255))));
  }
  /** World position at quarter-unit precision (±8191). */
  pos(v: number): void {
    this.i16(v * 4);
  }
  str(s: string): void {
    const b = enc.encode(s.length > 512 ? s.slice(0, 512) : s);
    this.u16(b.length);
    this.need(b.length);
    this.u8a.set(b, this.o);
    this.o += b.length;
  }
  /** Unsigned LEB128 (1 byte below 128). */
  varint(v: number): void {
    let n = Math.max(0, Math.floor(v));
    while (n >= 0x80) {
      this.u8((n & 0x7f) | 0x80);
      n = Math.floor(n / 128);
    }
    this.u8(n);
  }
  /** Raw bytes, as given. */
  bytes(b: Uint8Array): void {
    this.need(b.length);
    this.u8a.set(b, this.o);
    this.o += b.length;
  }
  /** Patch a byte already written (bitmaps filled in after the fact). */
  setU8(at: number, v: number): void {
    this.u8a[at] = v & 0xff;
  }
  getU8(at: number): number {
    return this.u8a[at];
  }
  /** The bytes written so far, without copying (valid until the next write). */
  view(): Uint8Array {
    return this.u8a.subarray(0, this.o);
  }
  /** Long text (u32 length, up to 256 KB) — the bosses' JSON. */
  text(s: string): void {
    const b = enc.encode(s);
    const n = Math.min(b.length, 262144);
    this.u32(n);
    this.need(n);
    this.u8a.set(b.subarray(0, n), this.o);
    this.o += n;
  }
  /** A copy of the written bytes, ready to send. */
  done(): ArrayBuffer {
    return this.buf.slice(0, this.o);
  }
}

export class Reader {
  private dv: DataView;
  private u8a: Uint8Array;
  o = 0;
  readonly length: number;

  constructor(buf: ArrayBuffer) {
    this.dv = new DataView(buf);
    this.u8a = new Uint8Array(buf);
    this.length = buf.byteLength;
  }
  private take(n: number): number {
    if (this.o + n > this.length) throw new RangeError('net: message truncated');
    const at = this.o;
    this.o += n;
    return at;
  }
  get left(): number {
    return this.length - this.o;
  }
  u8(): number {
    return this.dv.getUint8(this.take(1));
  }
  i8(): number {
    return this.dv.getInt8(this.take(1));
  }
  u16(): number {
    return this.dv.getUint16(this.take(2), true);
  }
  i16(): number {
    return this.dv.getInt16(this.take(2), true);
  }
  u32(): number {
    return this.dv.getUint32(this.take(4), true);
  }
  f32(): number {
    return this.dv.getFloat32(this.take(4), true);
  }
  frac(): number {
    return this.u8() / 255;
  }
  pos(): number {
    return this.i16() / 4;
  }
  str(): string {
    const n = this.u16();
    const at = this.take(n);
    return dec.decode(this.u8a.subarray(at, at + n));
  }
  varint(): number {
    let v = 0, mul = 1;
    for (let i = 0; i < 5; i++) {
      const b = this.u8();
      v += (b & 0x7f) * mul;
      if (!(b & 0x80)) return v;
      mul *= 128;
    }
    throw new RangeError('net: varint too long');
  }
  /** A copy of the next `n` bytes. */
  bytes(n: number): Uint8Array {
    const at = this.take(n);
    return this.u8a.slice(at, at + n);
  }
  text(): string {
    const n = this.u32();
    if (n > 262144) throw new RangeError('net: text too long');
    const at = this.take(n);
    return dec.decode(this.u8a.subarray(at, at + n));
  }
}

/**
 * Strings ↔ small ids. The host appends; the guest mirrors. Every snapshot carries the entries the
 * guest has not acknowledged yet (it reports its dictionary size with each input packet), so a lost
 * snapshot never loses a definition.
 */
export class StringDict {
  readonly list: string[] = [''];
  private map = new Map<string, number>([['', 0]]);
  static readonly MAX = 4096;

  id(s: string | undefined): number {
    if (!s) return 0;
    let i = this.map.get(s);
    if (i === undefined) {
      if (this.list.length >= StringDict.MAX) return 0;
      i = this.list.length;
      this.list.push(s);
      this.map.set(s, i);
    }
    return i;
  }
  get(i: number): string {
    return this.list[i] ?? '';
  }
  get size(): number {
    return this.list.length;
  }
  /** Write entries [from, size) (capped), as the sender. */
  writeFrom(w: Writer, from: number, cap = 96): void {
    const start = Math.max(1, Math.min(from, this.list.length));
    const n = Math.min(cap, this.list.length - start);
    w.u16(start);
    w.u8(n);
    for (let k = 0; k < n; k++) w.str(this.list[start + k]);
  }
  /** Read entries written by `writeFrom`, as the receiver (gaps are ignored; they will be resent). */
  readInto(r: Reader): void {
    const start = r.u16();
    const n = r.u8();
    for (let k = 0; k < n; k++) {
      const s = r.str();
      const i = start + k;
      if (i === this.list.length && i < StringDict.MAX) {
        this.list.push(s);
        this.map.set(s, i);
      }
    }
  }
}
