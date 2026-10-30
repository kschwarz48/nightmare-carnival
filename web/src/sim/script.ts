// Coroutines driven by simulation time — the web replacement for Godot's `await timer`.
// A coroutine is a generator that yields the number of seconds to wait (0/undefined = next tick).
// Because they advance only inside Game.tick, they pause with the game and are deterministic.

export type Co = Generator<number | undefined, void, unknown>;

export class Coroutine {
  private wait = 0;
  done = false;
  constructor(private gen: Co) {}

  step(dt: number): void {
    if (this.done) return;
    this.wait -= dt;
    let guard = 0;
    while (this.wait <= 0 && !this.done) {
      const r = this.gen.next();
      if (r.done) {
        this.done = true;
        return;
      }
      const w = r.value ?? 0;
      if (w <= 0) {
        this.wait = 0.0001; // resume next tick
        return;
      }
      this.wait += w;
      if (++guard > 1000) throw new Error('Coroutine spin');
    }
  }

  cancel(): void {
    this.done = true;
    try {
      this.gen.return(undefined);
    } catch {
      /* ignore */
    }
  }
}

export class CoroutineSet {
  list: Coroutine[] = [];
  start(gen: Co): Coroutine {
    const c = new Coroutine(gen);
    this.list.push(c);
    return c;
  }
  step(dt: number): void {
    for (let i = 0; i < this.list.length; i++) this.list[i].step(dt);
    if (this.list.length > 0) {
      let w = 0;
      for (let i = 0; i < this.list.length; i++) if (!this.list[i].done) this.list[w++] = this.list[i];
      this.list.length = w;
    }
  }
  cancelAll(): void {
    for (const c of this.list) c.cancel();
    this.list.length = 0;
  }
}

/** Helper: wait while a condition holds (polling each tick), with a timeout. */
export function* waitWhile(cond: () => boolean, timeout = 30): Co {
  let t = 0;
  while (cond() && t < timeout) {
    yield 1 / 60;
    t += 1 / 60;
  }
}
