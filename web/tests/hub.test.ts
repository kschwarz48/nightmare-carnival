// The Midway hub (D-60): unlocked by fully completing the first night; a peaceful walk around the
// grounds with the cast at their games; shared online, with joining open while the party is there.

import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { SaveManager, type StorageLike } from '../src/meta/save';
import { HUB_EXITS, HUB_NPCS, HUB_SPOTS } from '../src/data/hub';
import { CHARACTERS } from '../src/data/characters';
import { PLAYER_BOUNDS } from '../src/data/map';
import { collideBody } from '../src/sim/movement';
import { LoopbackNet } from '../src/net/link';
import { GuestSession, HostSession, runConfigFromStart, type HostProfile } from '../src/net/session';
import type { GuestProfile } from '../src/net/protocol';

function mem(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

const ALL = HUB_NPCS.map((n) => n.char);
const hub = (players = [{ character: 'carny', name: 'Kevin' }]) =>
  new Game({ character: players[0].character, difficulty: 'midway', curse: false, seed: 9, players, hub: { npcs: ALL } });

describe('the Midway hub (D-60)', () => {
  it('opens only once the first night is fully completed (the Last Song carried to True Dawn)', () => {
    const s = new SaveManager(mem());
    expect(s.hubUnlocked()).toBe(false);
    s.data.quests.last_song = { completions: 0, bestStage: 6 }; // got as far as the finale, but no True Dawn
    expect(s.hubUnlocked()).toBe(false);
    s.data.quests.last_song.completions = 1;
    expect(s.hubUnlocked()).toBe(true);
  });

  it('is peaceful: nothing spawns, nothing fires, the clock stands still, and the party walks the grounds', () => {
    const g = hub();
    const x0 = g.player.x;
    for (let i = 0; i < 60 * 60; i++) {
      g.inputs[0].moveX = i < 60 ? 1 : 0;
      g.tick();
    }
    expect(g.active.length).toBe(0);
    expect(g.enemies.some((e) => e.alive)).toBe(false);
    expect(g.projs.some((p) => p.alive)).toBe(false);
    expect(g.player.weapons.list.length).toBe(0);
    expect(g.time).toBe(0);
    expect(g.phase).toBe('play');
    expect(g.player.x - x0).toBeGreaterThan(150); // a second of walking right
    expect(g.player.hp).toBe(g.player.stats.maxHp());
    // the Big Top and the Ferris Wheel stand as scenery and never wake
    expect(g.bosses.map((b) => b.def.id).sort()).toEqual(['carnival_tent', 'ferris_wheel']);
    expect(g.bosses.every((b) => !b.awake)).toBe(true);
  });

  it('puts only the unlocked cast at their games, on open ground inside the map', () => {
    const g = new Game({ character: 'carny', difficulty: 'midway', curse: false, seed: 1, hub: { npcs: ['carny', 'strongman'] } });
    expect(g.hubNpcs.map((n) => n.char.id)).toEqual(['carny', 'strongman']);
    for (const d of HUB_NPCS) {
      expect(CHARACTERS.some((c) => c.id === d.char), d.char).toBe(true);
      expect(d.lines.length).toBeGreaterThanOrEqual(3);
      // standing where a player could walk up to them: inside the bounds, not inside a solid prop
      const probe = new Game({ character: 'carny', difficulty: 'midway', curse: false, seed: 1, hub: { npcs: [] } }).player;
      probe.x = d.x;
      probe.y = d.y;
      collideBody(probe, []);
      expect(Math.hypot(probe.x - d.x, probe.y - d.y), `${d.char} stands clear of props`).toBeLessThan(1);
      expect(d.x > PLAYER_BOUNDS.minX && d.x < PLAYER_BOUNDS.maxX && d.y > PLAYER_BOUNDS.minY && d.y < PLAYER_BOUNDS.maxY).toBe(true);
    }
    // one of the cast points the way to each coming attraction
    const said = HUB_NPCS.flatMap((n) => n.lines).join(' ').toLowerCase();
    for (const e of HUB_EXITS) expect(said, e.id).toContain(e.label.toLowerCase().replace('the ', '').split(' ')[0]);
    for (const sp of [HUB_SPOTS.booth, HUB_SPOTS.bigTop, ...HUB_EXITS]) expect(sp.x > PLAYER_BOUNDS.minX && sp.x < PLAYER_BOUNDS.maxX && sp.y < PLAYER_BOUNDS.maxY).toBe(true);
  });

  it('keeps players where they stood when it is rebuilt for someone joining', () => {
    const g = new Game({ character: 'carny', difficulty: 'midway', curse: false, seed: 1, players: [{ character: 'carny' }, { character: 'strongman' }], hub: { npcs: [], at: [{ x: -400, y: 500 }, { x: 300, y: 600 }] } });
    expect([g.players[0].x, g.players[0].y, g.players[1].x, g.players[1].y]).toEqual([-400, 500, 300, 600]);
  });
});

// ------------------------------------------------------------------ online
const hostProfile: HostProfile = { name: 'Kevin', meta: [], rerolls: 0, banishes: 0, canSkip: false, aimMode: 'auto' };
const guestProfile = (name: string): GuestProfile => ({ name, meta: [], rerolls: 0, banishes: 0, canSkip: false, aimMode: 'auto', chars: ['carny', 'strongman'], pref: 'strongman' });

describe('the Midway online (D-60)', () => {
  it('friends who join walk onto the host\'s Midway, joining stays open, and the Big Top leads everyone to character select', () => {
    const net = new LoopbackNet({ latency: 20 });
    const host = new HostSession('MIDWAY', hostProfile);
    let now = 1000;
    const guests: GuestSession[] = [];
    const join = (name: string) => {
      const [h, gl] = net.pair();
      host.accept(h);
      const gs = new GuestSession(gl, guestProfile(name), null, now);
      gs.onStart = (cfg) => new Game(runConfigFromStart(cfg));
      guests.push(gs);
      return gs;
    };
    const run = (ms: number) => {
      const end = now + ms;
      while (now < end) {
        now += 1000 / 60;
        net.pump(now);
        host.update(now, 1000 / 60);
        for (const gs of guests) gs.update(now);
      }
    };
    join('Ann');
    run(300);
    // the host walks onto the Midway with whoever is seated
    host.hostCharacter = 'carny';
    const at = [{ x: 0, y: 330 }, { x: 60, y: 360 }];
    let cfg = host.startHub({ seed: 5, unlocked: [], questMemory: {}, npcs: ['carny', 'strongman'], at });
    host.attachGame(new Game(runConfigFromStart(cfg)));
    run(300);
    expect(guests[0].state).toBe('run');
    expect(guests[0].game!.hub).toBe(true);
    expect(guests[0].game!.players.map((p) => p.char.id)).toEqual(['carny', 'strongman']); // the guest walks as their last fool
    expect(guests[0].game!.hubNpcs.map((n) => n.char.id)).toEqual(['carny', 'strongman']); // the host's cast
    // someone new turns up mid-hub: let in (a night would refuse them), and the rebuilt hub reaches everyone
    const bo = join('Bo');
    run(300);
    expect(bo.state).not.toBe('closed');
    expect(host.guests.map((s) => s.profile.name)).toEqual(['Ann', 'Bo']);
    cfg = host.startHub({ seed: 6, unlocked: [], questMemory: {}, npcs: ['carny'], at: [...at, { x: -60, y: 360 }] });
    host.attachGame(new Game(runConfigFromStart(cfg)));
    run(300);
    for (const gs of guests) {
      expect(gs.game!.hub).toBe(true);
      expect(gs.game!.players.length).toBe(3);
    }
    expect(guests[0].game!.players[1].x).toBe(60); // Ann is still where she stood
    // the Big Top: everyone to the lobby's character select, ready for a normal night
    host.toLobby();
    run(300);
    for (const gs of guests) {
      expect(gs.state).toBe('lobby');
      expect(gs.game).toBeNull();
    }
    expect(host.inHub).toBe(false);
  });
});
