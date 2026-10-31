// The sound-effect synthesizer in a worker (engineering optimization pass): all 152 recipes used to
// render on the main thread the moment audio unlocked (the first key press), freezing the title
// screen for ~1.6 s. The worker renders them at boot instead, in the same order as before (the noise
// generator is shared, so the order is what keeps every sound identical), and hands each one over.
import { RECIPES } from './synth';

self.onmessage = () => {
  for (const [id, make] of Object.entries(RECIPES)) {
    const data = make();
    (self as unknown as Worker).postMessage({ id, data }, [data.buffer]);
  }
  (self as unknown as Worker).postMessage({ done: true });
};
