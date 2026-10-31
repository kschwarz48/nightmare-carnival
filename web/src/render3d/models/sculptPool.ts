// The sculpt worker pool (engineering optimization pass). Every creature and character sculpt took
// tens to hundreds of milliseconds on the main thread (a character 0.6–0.8 s), and boot pre-built only
// the first map's crowd and one character, so a co-op partner's character, the Midway's cast or a later
// map's crowd froze the frame that first drew them. Now a few workers sculpt everything in parallel:
// boot waits for the creatures and the requested characters, and the rest of the cast arrives in the
// background. A model the page needs before its worker delivers is simply built in place, as before.
import { CHARACTER_IDS, hasCharacterModel, installCharacterModel } from './characters';
import { CREATURE_IDS, hasCreatureModel, installCreatureModel } from './creatures';
import { unpackModel, type PackedModel, type SculptJob } from './sculptPack';

type Reply = SculptJob & { packed?: PackedModel; error?: string };

/** Background sculpting still running after boot (tests and benchmarks can wait on it). */
export let sculptsPending: Promise<void> = Promise.resolve();

/**
 * Sculpt the crowd in workers. Resolves true once every creature and every character in `first` is
 * installed (the rest of the cast keeps coming in the background), or false if workers are unavailable,
 * in which case the caller sculpts on the main thread.
 */
export async function sculptInWorkers(onProgress: (p: number) => void, first: string[]): Promise<boolean> {
  if (typeof Worker === 'undefined' || typeof navigator === 'undefined') return false;
  const firstChars = first.filter((id) => CHARACTER_IDS.includes(id));
  const jobs: SculptJob[] = [
    ...firstChars.map((id) => ({ kind: 'character' as const, id })),
    ...CREATURE_IDS.map((id) => ({ kind: 'creature' as const, id })),
    ...CHARACTER_IDS.filter((id) => !firstChars.includes(id)).map((id) => ({ kind: 'character' as const, id })),
  ].filter((j) => (j.kind === 'character' ? !hasCharacterModel(j.id) : !hasCreatureModel(j.id)));
  const needed = new Set(jobs.filter((j) => j.kind === 'creature' || firstChars.includes(j.id)).map((j) => `${j.kind}:${j.id}`));
  const neededTotal = needed.size;
  if (!jobs.length) return true;
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1, jobs.length));
  let workers: Worker[];
  try {
    workers = Array.from({ length: n }, () => new Worker(new URL('./sculptWorker.ts', import.meta.url), { type: 'module' }));
  } catch {
    return false;
  }
  let next = 0;
  let failed = false;
  let resolveNeeded!: (ok: boolean) => void;
  const neededDone = new Promise<boolean>((r) => (resolveNeeded = r));
  let resolveAll!: () => void;
  sculptsPending = new Promise<void>((r) => (resolveAll = r));
  let live = n;
  const feed = (w: Worker) => {
    if (next >= jobs.length) {
      w.terminate();
      if (--live === 0) {
        resolveAll();
        resolveNeeded(!failed);
      }
      return;
    }
    w.postMessage(jobs[next++]);
  };
  for (const w of workers) {
    w.onmessage = (e: MessageEvent<Reply>) => {
      const r = e.data;
      if (r.packed) {
        const m = unpackModel(r.packed);
        if (r.kind === 'character') installCharacterModel(r.id, m);
        else installCreatureModel(r.id, m);
      } else failed = true;
      if (needed.delete(`${r.kind}:${r.id}`)) {
        onProgress(1 - needed.size / Math.max(1, neededTotal));
        if (!needed.size) resolveNeeded(!failed);
      }
      feed(w);
    };
    w.onerror = () => {
      // a worker that can't start (blocked, unsupported): fall back to sculpting on the page
      failed = true;
      w.terminate();
      if (--live === 0) {
        resolveAll();
        resolveNeeded(false);
      } else resolveNeeded(false);
    };
    feed(w);
  }
  const ok = await neededDone;
  if (!ok) return false;
  return true;
}
