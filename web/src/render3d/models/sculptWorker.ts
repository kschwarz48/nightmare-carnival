// A sculpt worker (engineering optimization pass): builds characters and creatures off the main thread
// and posts back their geometry and baked rig as transferable buffers (see sculptPool.ts). It runs the
// very same builders as the page, so what comes back is identical to a sculpt made in place.
import { characterModel } from './characters';
import { creatureModel } from './creatures';
import { packModel, type SculptJob } from './sculptPack';

self.onmessage = (e: MessageEvent<SculptJob>) => {
  const job = e.data;
  try {
    const m = job.kind === 'character' ? characterModel(job.id) : creatureModel(job.id);
    const { packed, transfer } = packModel(m);
    (self as unknown as Worker).postMessage({ ...job, packed }, transfer);
  } catch (err) {
    (self as unknown as Worker).postMessage({ ...job, error: String(err) });
  }
};
