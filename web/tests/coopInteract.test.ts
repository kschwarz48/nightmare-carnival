// The first map answers a guest's interact as the host's (D-99: a playtest found only the host could use Zoltana; the
// press travels as the guest's interact count in its inputs, here over the loopback link).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
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
});
