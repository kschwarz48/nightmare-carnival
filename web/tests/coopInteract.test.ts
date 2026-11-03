// The first map answers a guest's interact as the host's (D-99: a playtest found only the host could use Zoltana), and
// promptly (D-101: a playtest found a guest's E took several tries or came late). A press rides the guest's input
// packets with where the guest stood on its own screen and the clocks it showed; the host uses it at its next tick.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { makeGame } from './helpers';
import { PRESS_LATE, PRESS_REACH } from '../src/sim/constants';
import { LoopbackNet } from '../src/net/link';
import { GuestSession, HostSession, runConfigFromStart, type HostProfile } from '../src/net/session';
import type { GuestProfile } from '../src/net/protocol';
import { LAST_SONG } from '../src/data/quests';
import { LS, type LastSongChain } from '../src/sim/quest/lastSong';

const hostProfile: HostProfile = { name: 'H', meta: [], rerolls: 0, banishes: 0, canSkip: false, aimMode: 'auto' };
const guestProfile: GuestProfile = { name: 'G', meta: [], rerolls: 0, banishes: 0, canSkip: false, aimMode: 'auto', chars: ['carny', 'strongman'] };

describe('the first map in co-op', () => {
  it("wakes Zoltana at a guest's press", () => {
    const net = new LoopbackNet({});
    const host = new HostSession('PROBE1', hostProfile);
    const [h, gl] = net.pair();
    host.accept(h);
    let now = 1000;
    const guest = new GuestSession(gl, guestProfile, null, now);
    guest.onStart = (cfg) => new Game(runConfigFromStart(cfg));
    const run = (ms: number, frame?: () => void) => { const end = now + ms; while (now < end) { now += 1000 / 60; net.pump(now); frame?.(); host.update(now, 1000 / 60); guest.update(now); } };
    run(300);
    host.setCharacter('carny'); guest.pick('strongman'); run(200);
    host.setReady(true); guest.setReady(true); run(200);
    const cfg = host.start({ seed: 3, unlocked: [], questMemory: {} })!;
    const g = new Game({ ...runConfigFromStart(cfg), godMode: true });
    host.attachGame(g);
    run(400);
    const ls = g.quests.get<LastSongChain>('last_song')!;
    const M = LAST_SONG.machine;
    g.players[1].x = g.players[1].px = M.x; g.players[1].y = g.players[1].py = M.y;
    let pressed = false, frames = 0;
    run(1500, () => {
      const gs = guest;
      if (gs.state === 'run' && gs.game && gs.game.phase === 'play') {
        if (!pressed && gs.replica && ++frames > 30) { gs.interact(); pressed = true; }
        gs.step(0, 0, 0, 0, false);
      }
      if (g.phase === 'play') { host.beforeTick(g); g.tick(); }
      g.players[1].x = g.players[1].px = M.x; g.players[1].y = g.players[1].py = M.y;
    });
    expect(pressed).toBe(true);
    expect(ls.stage).toBe(LS.Souls);
  });

  it("uses a guest's press at the host's next tick, though a backlog of their inputs waits ahead of it", () => {
    const net = new LoopbackNet({ latency: 30 });
    const host = new HostSession('PROBE2', hostProfile);
    const [h, gl] = net.pair();
    host.accept(h);
    let now = 1000;
    const guest = new GuestSession(gl, guestProfile, null, now);
    guest.onStart = (cfg) => new Game(runConfigFromStart(cfg));
    const run = (ms: number, frame?: () => void) => { const end = now + ms; while (now < end) { now += 1000 / 60; net.pump(now); frame?.(); host.update(now, 1000 / 60); guest.update(now); } };
    run(300);
    host.setCharacter('carny'); guest.pick('strongman'); run(200);
    host.setReady(true); guest.setReady(true); run(200);
    const cfg = host.start({ seed: 4, unlocked: [], questMemory: {} })!;
    const g = new Game({ ...runConfigFromStart(cfg), godMode: true });
    host.attachGame(g);
    run(400);
    const ls = g.quests.get<LastSongChain>('last_song')!;
    const M = LAST_SONG.machine;
    const put = () => { g.players[1].x = g.players[1].px = M.x; g.players[1].y = g.players[1].py = M.y; };
    // the host struggles: its night ticks at half speed for a while, and the guest's inputs pile up ahead of the press
    put();
    let k = 0;
    run(400, () => {
      if (guest.replica && guest.game?.phase === 'play') guest.step(0, 0, 0, 0, false);
      if (++k % 2 === 0) {
        host.beforeTick(g);
        g.tick();
        put();
      }
    });
    const seat = (host as unknown as { seats: { queue: unknown[] }[] }).seats[1];
    expect(seat.queue.length).toBeGreaterThan(8);
    guest.interact();
    run(80); // the press crosses the link
    let ticks = 0;
    while (ls.stage === LS.Dormant && ticks < 60) {
      host.beforeTick(g);
      g.tick();
      put();
      ticks++;
    }
    expect(ls.stage).toBe(LS.Souls);
    expect(ticks).toBe(1);
    expect(seat.queue.length).toBeGreaterThan(6); // the backlog was still there: the press didn't wait for it
  });

  it("finds what was in reach where the guest stood on its own screen, within a short reach of its copy", () => {
    const M = LAST_SONG.machine;
    const press = (copyX: number, seenX: number) => {
      const g = makeGame({ players: [{ character: 'carny', name: 'H' }, { character: 'strongman', name: 'G' }], godMode: true });
      const ls = g.quests.get<LastSongChain>('last_song')!;
      g.players[1].x = g.players[1].px = M.x + copyX;
      g.players[1].y = g.players[1].py = M.y;
      g.inputs[1].interact = true;
      g.inputs[1].press = { x: M.x + seenX, y: M.y, time: g.time, realTime: g.realTime };
      g.tick();
      return ls.stage;
    };
    // its copy here a step out of reach (their inputs still queued), where they stood in reach: Zoltana answers
    expect(press(M.r + 60, M.r - 30)).toBe(LS.Souls);
    // a spot further from its copy than anyone could be is not believed
    expect(press(M.r + 60 + PRESS_REACH, M.r - 30)).toBe(LS.Dormant);
  });

  it('judges a High Striker swing by the light the guest saw', () => {
    const s = LAST_SONG.striker;
    const swing = (seenAgo: number | null) => {
      const g = makeGame({ players: [{ character: 'carny', name: 'H' }, { character: 'strongman', name: 'G' }], godMode: true });
      const ls = g.quests.get<LastSongChain>('last_song')!;
      ls.stage = LS.Striker;
      // the light at the bell a while ago; now it has fallen out of the window
      const top = s.period * 10 + s.period / 2;
      g.realTime = top + 0.35;
      expect(ls.strikerInWindow()).toBe(false);
      g.players[1].x = g.players[1].px = s.padX;
      g.players[1].y = g.players[1].py = s.padY;
      g.inputs[1].interact = true;
      g.inputs[1].press = seenAgo === null ? null : { x: s.padX, y: s.padY, time: g.time, realTime: g.realTime - seenAgo };
      g.tick();
      return ls.rings;
    };
    expect(swing(0.35)).toBe(1); // their screen showed the light at the bell: a ring
    expect(swing(null)).toBe(0); // the host's own swing now: a miss
    expect(swing(PRESS_LATE + 0.5)).toBe(0); // a clock that far back isn't believed: judged now, a miss
  });
});
