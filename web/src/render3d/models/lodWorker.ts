// The crowd's distance models, simplified off the main thread (D-96; see models/lod.ts and core/simplify.ts).
import { simplifyGeometry } from '../core/simplify';
import { packGeometry, unpackGeometry, type PackedGeometry } from './sculptPack';
import { LOD_OPTIONS } from './lodOptions';

self.onmessage = (e: MessageEvent<{ key: string; geo: PackedGeometry }>) => {
  const { key, geo } = e.data;
  try {
    const s = simplifyGeometry(unpackGeometry(geo), LOD_OPTIONS);
    if (!s) {
      (self as unknown as Worker).postMessage({ key, lod: null });
      return;
    }
    const { packed, transfer } = packGeometry(s);
    (self as unknown as Worker).postMessage({ key, lod: packed }, transfer);
  } catch (err) {
    (self as unknown as Worker).postMessage({ key, lod: null, error: String(err) });
  }
};
