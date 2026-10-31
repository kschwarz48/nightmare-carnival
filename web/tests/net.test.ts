// Online co-op networking (D-52): binary codec, snapshot serialization, replication into a mirror
// Game, input packets and message validation, and the full host/guest flow over an in-memory network
// with latency, jitter and loss — lobby, start, drafts, prize wheel, pause, disconnect and reconnect.

import { describe, expect, it } from 'vitest';
import { makeGame, autoDraft } from './helpers';
import { Game } from '../src/sim/game';
import { TICK } from '../src/sim/constants';
import { Reader, StringDict, Writer } from '../src/net/codec';
import { SnapshotEncoder, decodeSnapshot, encodeSnapshot, presentCount, type View } from '../src/net/snapshot';
import { Replica } from '../src/net/replica';
import { LoopbackNet, type LoopbackLink } from '../src/net/link';
import { generateCode, isValidCode, normalizeCode, CODE_ALPHABET } from '../src/net/codes';
import {
  CHAT_MAX, PROTO, cleanChat, cleanProfile, decodeInputPacket, encodeInputPacket, parseGuestMsg, parseHostMsg,
  type GuestProfile,
} from '../src/net/protocol';
import { GuestSession, HostSession, LINK_TIMEOUT, RECONNECT_WAIT, runConfigFromStart, type HostProfile } from '../src/net/session';
import { COOP } from '../src/data/progression';
import { addHazardPull } from '../src/sim/movement';
import { createBoss } from '../src/sim/bosses';
import { BOSS_MAP } from '../src/data/bosses';

const UNLOCKED = ['w_orbs', 'w_cannon', 'w_laser', 'w_bell', 'w_mirror', 'p_season_pass', 'p_coin_purse', 'p_rabbits_foot'];
const duo = (seed = 99, o: Parameters<typeof makeGame>[0] = {}) =>
  makeGame({ seed, players: [{ character: 'carny', name: 'Host' }, { character: 'strongman', name: 'Guest' }], ...o });
const wide = (g: Game, i = 1): View => ({ x: g.players[i].x, y: g.players[i].y, hx: 5000, hy: 5000 });
const mirrorOf = (g: Game) => new Game({ ...g.cfg, godMode: false });

/** Drive both players in slow circles so the night has movement, kills and pickups. */
function steerAll(g: Game): void {
  g.players.forEach((p, i) => {
    const a = g.realTime * 0.4 + i * Math.PI;
    g.inputs[i].moveX = Math.cos(a) * 0.8 - p.x / 1500;
    g.inputs[i].moveY = Math.sin(a) * 0.8 - p.y / 1500;
  });
}

function playFor(g: Game, seconds: number, each?: () => void): void {
  for (let i = 0; i < seconds / TICK && g.phase !== 'ended'; i++) {
    if (g.phase === 'draft') autoDraft(g);
    steerAll(g);
    g.tick();
    each?.();
  }
}

// ===================================================================================== codec
describe('binary codec', () => {
  it('round-trips every field type and refuses truncated input', () => {
    const w = new Writer(4);
    w.u8(250);
    w.i8(-100);
    w.u16(65000);
    w.i16(-30000);
    w.u32(4000000000);
    w.f32(3.25);
    w.frac(0.5);
    w.pos(-1234.75);
    w.str('Steam Calliope ✓');
    const buf = w.done();
    const r = new Reader(buf);
    expect([r.u8(), r.i8(), r.u16(), r.i16(), r.u32(), r.f32()]).toEqual([250, -100, 65000, -30000, 4000000000, 3.25]);
    expect(r.frac()).toBeCloseTo(0.5, 2);
    expect(r.pos()).toBe(-1234.75);
    expect(r.str()).toBe('Steam Calliope ✓');
    expect(r.left).toBe(0);
    expect(() => new Reader(buf.slice(0, buf.byteLength - 3)).str()).toThrow(RangeError);
    const t = new Reader(buf.slice(0, 5));
    t.u8();
    t.i8();
    t.u16();
    expect(() => t.i16()).toThrow(RangeError);
  });

  it('clamps out-of-range values instead of wrapping', () => {
    const w = new Writer();
    w.i8(500);
    w.u16(-5);
    w.i16(99999);
    w.f32(NaN);
    // a decaying timer read a hair below zero (hurt flash, dash, i-frames) must not wrap to 252
    w.u8(-0.0166 * 255);
    w.u8(300);
    w.u8(NaN);
    const r = new Reader(w.done());
    expect([r.i8(), r.u16(), r.i16(), r.f32(), r.u8(), r.u8(), r.u8()]).toEqual([127, 0, 32767, 0, 0, 255, 0]);
  });

  it('syncs the string dictionary incrementally and ignores gaps', () => {
    const a = new StringDict();
    const b = new StringDict();
    const ids = ['card', 'firework', 'stomp', 'card'].map((s) => a.id(s));
    expect(ids[0]).toBe(ids[3]);
    const w = new Writer();
    a.writeFrom(w, b.size);
    b.readInto(new Reader(w.done()));
    expect(b.get(ids[1])).toBe('firework');
    // entries beyond the receiver's size with a gap are ignored (they will be resent)
    a.id('late');
    const w2 = new Writer();
    a.writeFrom(w2, b.size + 1);
    b.readInto(new Reader(w2.done()));
    expect(b.size).toBe(4);
    const w3 = new Writer();
    a.writeFrom(w3, b.size);
    b.readInto(new Reader(w3.done()));
    expect(b.get(a.id('late'))).toBe('late');
  });
});

// ===================================================================================== snapshots
describe('snapshot serialization', () => {
  it('round-trips a busy co-op night within quantisation limits', () => {
    const g = duo(31, { godMode: true });
    playFor(g, 150);
    const dict = new StringDict();
    const guestDict = new StringDict();
    const fx = g.fx.drain().slice(-50);
    const buf = encodeSnapshot(g, { seq: 7, ackInput: 42, dict, dictFrom: 0, view: wide(g), fx, sfx: [{ id: 'hit', x: 10, y: 20, vol: 0.5, pitch: 1.2 }, { id: 'toll' }] });
    const s = decodeSnapshot(buf, guestDict);
    expect(s.seq).toBe(7);
    expect(s.ackInput).toBe(42);
    expect(s.tick).toBe(g.tickCount);
    expect(s.time).toBeCloseTo(g.time, 3);
    expect(s.level).toBe(g.level);
    expect(s.kills).toBe(g.kills);
    expect(s.phase).toBe(g.phase);
    expect(s.players.length).toBe(2);
    s.players.forEach((p, i) => {
      const src = g.players[i];
      expect(p.x).toBeCloseTo(src.x, 2);
      expect(p.hp).toBeCloseTo(Math.max(0, src.hp), 0);
      expect(p.weapons.map((w) => w.id)).toEqual(src.weapons.list.map((w) => w.def.id));
      expect(p.weapons.map((w) => w.level)).toEqual(src.weapons.list.map((w) => w.level));
      expect(p.passives.map((v) => v.id).sort()).toEqual([...src.passives.keys()].sort());
    });
    const alive = g.active.filter((e) => e.alive);
    expect(presentCount(s.enemies)).toBe(alive.length);
    expect(s.enemies.recs.length).toBe(alive.length); // a first snapshot carries every part
    for (const r of s.enemies.recs.slice(0, 40)) {
      const src = g.enemies[r.slot];
      expect(r.S!.uid).toBe(src.uid & 0xffff);
      expect(r.S!.def).toBe(src.def.id);
      expect(Math.abs(r.M!.x - src.x)).toBeLessThanOrEqual(0.125);
      expect(Math.abs(r.M!.y - src.y)).toBeLessThanOrEqual(0.125);
      expect(r.T).toBeTruthy();
    }
    expect(presentCount(s.projs)).toBe(g.projs.filter((p) => p.alive).length);
    expect(presentCount(s.pickups)).toBe(g.pickups.filter((p) => p.alive).length);
    expect(presentCount(s.hazards)).toBe(g.hazards.filter((h) => h.alive).length);
    expect(presentCount(s.summons)).toBe(g.summons.filter((m) => m.alive).length);
    for (const p of s.projs.recs) expect(g.projs[p.slot].kind).toBe(p.S!.kind);
    expect(s.sfx.map((e) => e.id)).toEqual(['hit', 'toll']);
    expect(s.sfx[0].x).toBe(10);
    expect(s.fx.length).toBe(fx.filter((e) => e.type === 'shake' || e.type === 'flash' || Math.abs(e.x - g.players[1].x) < 5000 * 1.3).length);
    expect(s.quest?.order.length).toBe(4);
  });

  it('only sends what is near the receiving player (interest management)', () => {
    const g = duo(8, { godMode: true });
    playFor(g, 90);
    const [p0, p1] = g.players;
    p0.x = -1500;
    p1.x = 1500;
    const view: View = { x: p1.x, y: p1.y, hx: 500, hy: 400 };
    const s = decodeSnapshot(encodeSnapshot(g, { seq: 1, ackInput: 0, dict: new StringDict(), dictFrom: 0, view, fx: [], sfx: [] }), new StringDict());
    for (const e of s.enemies.recs) expect(Math.abs(e.M!.x - view.x)).toBeLessThan(500 * 1.9 + 1);
    for (const p of s.pickups.recs) expect(Math.abs(p.M!.x - view.x)).toBeLessThan(500 * 1.25 + 1);
    expect(s.players.length).toBe(2); // both players always
  });

  it('a truncated or corrupted snapshot throws instead of producing garbage', () => {
    const g = duo(3, { godMode: true });
    playFor(g, 20);
    const buf = encodeSnapshot(g, { seq: 1, ackInput: 0, dict: new StringDict(), dictFrom: 0, view: wide(g), fx: [], sfx: [] });
    expect(() => decodeSnapshot(buf.slice(0, buf.byteLength >> 1), new StringDict())).toThrow(RangeError);
    const bad = new Uint8Array(buf.slice(0));
    bad[0] = 99;
    expect(() => decodeSnapshot(bad.buffer, new StringDict())).toThrow(RangeError);
  });

  it('keeps a dense late-night snapshot within a sane datagram budget', () => {
    const g = duo(4242, { godMode: true });
    playFor(g, 60);
    // flood the night: 450 enemies, 300 projectiles, 400 bullets, 250 tickets around the guest
    const p1 = g.players[1];
    for (let i = 0; i < 450; i++) g.spawnEnemy('possessed_stuffie', p1.x + Math.cos(i) * (200 + (i % 9) * 60), p1.y + Math.sin(i) * (160 + (i % 7) * 50));
    for (let i = 0; i < 250; i++) g.spawnPickup('ticket', p1.x + Math.cos(i * 1.7) * 300, p1.y + Math.sin(i * 1.7) * 250, 1);
    for (let i = 0; i < 300; i++) {
      const pr = g.projs.find((p) => !p.alive)!;
      Object.assign(pr, { alive: true, kind: 'card', x: p1.x + i, y: p1.y, vx: 300, vy: 0, r: 8, life: 1, maxLife: 1, owner: i % 2 });
    }
    for (let i = 0; i < 400; i++) {
      const b = g.bullets.find((x) => !x.alive)!;
      Object.assign(b, { alive: true, kind: 'spiral', x: p1.x - i, y: p1.y + 50, vx: -100, vy: 30, r: 6, z: 0 });
    }
    const dict = new StringDict();
    const view: View = { x: p1.x, y: p1.y, hx: 960, hy: 760 };
    const enc = new SnapshotEncoder();
    const first = enc.encode(g, { seq: 1, ackInput: 0, ackSnap: 0, dict, dictFrom: 0, view, fx: [], sfx: [] });
    const s = decodeSnapshot(first, new StringDict());
    expect(presentCount(s.enemies)).toBeGreaterThan(400);
    expect(presentCount(s.bullets)).toBe(400);
    // the night moves on 3 ticks; the guest has acknowledged snapshot 1
    for (let i = 0; i < 3; i++) {
      steerAll(g);
      g.tick();
    }
    const steady = enc.encode(g, { seq: 2, ackInput: 0, ackSnap: 1, dict, dictFrom: dict.size, view, fx: [], sfx: [] });
    expect(first.byteLength).toBeLessThan(48000);
    expect(steady.byteLength).toBeLessThan(first.byteLength * 0.6);
    console.info(`[net] dense snapshot: ${presentCount(s.enemies)} enemies, ${presentCount(s.projs)} projs, ${presentCount(s.bullets)} bullets, ${presentCount(s.pickups)} pickups -> ${first.byteLength} B full, ${steady.byteLength} B delta (x20 Hz = ${((steady.byteLength * 20) / 1024).toFixed(0)} KB/s) ${JSON.stringify(enc.sizes)}`);
  });
});

// ===================================================================================== replication
describe('replication into the guest mirror', () => {
  it('mirrors players, enemies, pickups, hazards, bosses and the shared quest through lossy deltas', () => {
    const host = duo(77, { godMode: true });
    const mirror = mirrorOf(host);
    const rep = new Replica(mirror, 1);
    const dict = new StringDict();
    const enc = new SnapshotEncoder();
    let seq = 0, now = 0, lost = 0, rnd = 9;
    const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    // the guest's acks reach the host a few snapshots late; 20% of snapshots never arrive
    const acks: number[] = [];
    const send = () => {
      const ack = acks.length > 3 ? acks[acks.length - 4] : 0;
      const buf = enc.encode(host, { seq: ++seq, ackInput: 0, ackSnap: ack, dict, dictFrom: rep.dict.size, view: wide(host), fx: host.fx.drain(), sfx: [] });
      if (rand() < 0.2) {
        lost++;
        return;
      }
      rep.apply(decodeSnapshot(buf, rep.dict), now);
      acks.push(rep.last!.seq);
    };
    playFor(host, 150, () => {
      now += TICK * 1000;
      if (host.tickCount % 3 === 0) send();
    });
    // (the Tent and the Ferris Wheel stand on the field from the first second, as solid bosses)
    for (let i = 0; i < 90; i++) {
      steerAll(host);
      host.tick();
    }
    // one last snapshot that does arrive
    const buf = enc.encode(host, { seq: ++seq, ackInput: 0, ackSnap: acks[acks.length - 4] ?? 0, dict, dictFrom: rep.dict.size, view: wide(host), fx: [], sfx: [] });
    rep.apply(decodeSnapshot(buf, rep.dict), now + 50);
    expect(lost).toBeGreaterThan(100);
    expect(mirror.level).toBe(host.level);
    expect(mirror.kills).toBe(host.kills);
    expect(mirror.time).toBeCloseTo(host.time, 3);
    expect(mirror.active.length).toBe(host.active.filter((e) => e.alive).length);
    for (const e of mirror.active) {
      const src = host.enemies[e.idx];
      expect(src.alive).toBe(true);
      expect(src.uid & 0xffff).toBe(e.uid);
      expect(src.def.id).toBe(e.def.id);
      expect(Math.abs(src.x - e.x)).toBeLessThanOrEqual(0.125);
      expect(Math.abs(src.flash - e.flash)).toBeLessThan(0.01);
    }
    // every live pickup / projectile on the host exists on the mirror with the right kind and place
    host.pickups.forEach((p, i) => {
      if (!p.alive) return;
      expect(mirror.pickups[i].alive).toBe(true);
      expect(mirror.pickups[i].kind).toBe(p.kind);
      expect(Math.abs(mirror.pickups[i].x - p.x)).toBeLessThanOrEqual(0.125);
    });
    host.projs.forEach((p, i) => {
      if (!p.alive) return;
      expect(mirror.projs[i].alive).toBe(true);
      expect(mirror.projs[i].kind).toBe(p.kind);
    });
    // the remote player (player 0 on the guest) is interpolated from the snapshot
    expect(mirror.players[0].x).toBeCloseTo(host.players[0].x, 2);
    expect(mirror.players[0].weapons.list.map((w) => w.def.id)).toEqual(host.players[0].weapons.list.map((w) => w.def.id));
    // passives rebuild the guest's stats exactly (weapon visuals derive area/amount from them)
    for (const i of [0, 1]) expect(mirror.players[i].stats.maxHp()).toBeCloseTo(host.players[i].stats.maxHp(), 3);
    expect(mirror.pickups.filter((p) => p.alive).length).toBe(host.pickups.filter((p) => p.alive).length);
    expect(mirror.hazards.filter((h) => h.alive).length).toBe(host.hazards.filter((h) => h.alive).length);
    expect(mirror.bosses.length).toBe(host.bosses.length);
    if (host.bosses.length) {
      expect(mirror.bosses[0].def.id).toBe(host.bosses[0].def.id);
      expect(mirror.bosses[0].hp).toBeCloseTo(host.bosses[0].hp, 0);
      expect(mirror.bosses[0].x).toBeCloseTo(host.bosses[0].x, 2);
    }
    const lsH = host.quests.get<{ order: number[]; stage: number } & import('../src/sim/quest').QuestChain>('last_song')!;
    const lsM = mirror.quests.get<{ order: number[]; stage: number } & import('../src/sim/quest').QuestChain>('last_song')!;
    expect(lsM.order).toEqual(lsH.order);
    expect(lsM.stage).toBe(lsH.stage);
    // the mirror was never ticked
    expect(mirror.tickCount).toBe(host.tickCount);
    expect(rep.received).toBeGreaterThan(100);
  });

  it('drops stale and reordered snapshots and counts gaps', () => {
    const host = duo(5, { godMode: true });
    const rep = new Replica(mirrorOf(host), 1);
    const dict = new StringDict();
    const snap = (seq: number) => decodeSnapshot(encodeSnapshot(host, { seq, ackInput: 0, dict, dictFrom: 0, view: wide(host), fx: [], sfx: [] }), rep.dict);
    rep.apply(snap(1), 0);
    rep.apply(snap(4), 150);
    rep.apply(snap(3), 160); // late: ignored
    expect(rep.last?.seq).toBe(4);
    expect(rep.dropped).toBe(2);
  });

  it('predicts the local character from input and reconciles to the host without drift', () => {
    const host = duo(12, { godMode: true });
    const mirror = mirrorOf(host);
    const rep = new Replica(mirror, 1);
    const dict = new StringDict();
    const inputs: { seq: number; mx: number; my: number }[] = [];
    let seq = 0, snap = 0, now = 0, applied = 0;
    const delay = 6; // ticks of one-way latency
    for (let t = 0; t < 600; t++) {
      now += TICK * 1000;
      const a = t * 0.02;
      const mx = Math.cos(a), my = Math.sin(a * 0.7);
      rep.predict(++seq, mx, my);
      inputs.push({ seq, mx, my });
      // the host applies the guest's inputs `delay` ticks late
      const due = inputs.find((i) => i.seq === applied + 1 && i.seq <= seq - delay);
      if (due) {
        host.inputs[1].moveX = due.mx;
        host.inputs[1].moveY = due.my;
        applied = due.seq;
      }
      host.inputs[0].moveX = host.inputs[0].moveY = 0;
      host.tick();
      if (host.phase === 'draft') autoDraft(host);
      if (t % 3 === 0) rep.apply(decodeSnapshot(encodeSnapshot(host, { seq: ++snap, ackInput: applied, dict, dictFrom: rep.dict.size, view: wide(host), fx: [], sfx: [] }), rep.dict), now);
      rep.frame(TICK);
    }
    // after the last reconcile + replay, the prediction sits where the host will put the guest
    const pend = inputs.filter((i) => i.seq > applied);
    for (const i of pend) {
      host.inputs[1].moveX = i.mx;
      host.inputs[1].moveY = i.my;
      host.tick();
    }
    const p = mirror.players[1];
    expect(Math.hypot(p.x - host.players[1].x, p.y - host.players[1].y)).toBeLessThan(6);
    expect(rep.predErr).toBeLessThan(6);
  });
});

// ===================================================================================== protocol
describe('protocol validation', () => {
  it('round-trips input packets and clamps hostile values', () => {
    const buf = encodeInputPacket({ ackSnap: 12, dictSize: 40, inputs: [{ seq: 9, mx: 1, my: 0, ax: 0, ay: -1, aim: true }, { seq: 10, mx: -0.5, my: 0.5, ax: 1, ay: 0, aim: false }] });
    const p = decodeInputPacket(buf)!;
    expect(p.ackSnap).toBe(12);
    expect(p.dictSize).toBe(40);
    expect(p.inputs.map((i) => i.seq)).toEqual([9, 10]);
    expect(p.inputs[0].aim).toBe(true);
    expect(p.inputs[1].mx).toBeCloseTo(-0.5, 1);
    // a forged packet with (127,127) movement is normalised to the unit disc
    const forged = new Uint8Array(buf.slice(0));
    forged[12] = 127;
    forged[13] = 127;
    const f = decodeInputPacket(forged.buffer)!;
    expect(Math.hypot(f.inputs[0].mx, f.inputs[0].my)).toBeLessThanOrEqual(1.0001);
    expect(decodeInputPacket(new ArrayBuffer(3))).toBeNull();
    expect(decodeInputPacket(new Uint8Array([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200]).buffer)).toBeNull(); // claims 200 inputs
    expect(decodeInputPacket(new ArrayBuffer(4096))).toBeNull();
  });

  it('rejects malformed, oversized and unknown guest messages', () => {
    expect(parseGuestMsg('not json')).toBeNull();
    expect(parseGuestMsg(JSON.stringify({ t: 'nope' }))).toBeNull();
    expect(parseGuestMsg(JSON.stringify({ t: 'pick', character: 'mime' }))).toBeNull();
    expect(parseGuestMsg(JSON.stringify({ t: 'pick', character: 'carny' }))).toEqual({ t: 'pick', character: 'carny' });
    expect(parseGuestMsg(JSON.stringify({ t: 'draft', op: 'choose' }))).toBeNull();
    expect(parseGuestMsg(JSON.stringify({ t: 'draft', op: 'choose', index: 99 }))).toBeNull();
    expect(parseGuestMsg(JSON.stringify({ t: 'ready', ready: 'yes' }))).toBeNull();
    expect(parseGuestMsg('x'.repeat(20000))).toBeNull();
    expect(parseGuestMsg(42)).toBeNull();
    const view = parseGuestMsg(JSON.stringify({ t: 'view', hx: 1e9, hy: -5 }));
    expect(view).toEqual({ t: 'view', hx: 2400, hy: 200 });
  });

  it('clamps a guest profile to what a real save could hold', () => {
    const p = cleanProfile({ name: '  <b>Mal</b>lory\u0007 the Very Long Named  ', meta: [{ axis: 'might', value: 50 }, { axis: 'might', value: 1 }, { axis: 'hax', value: 3 }, { axis: 'reroll', value: 9 }], rerolls: 50, banishes: -2, canSkip: 'sure', aimMode: 'cheat', chars: ['carny', 'nope'] })!;
    expect(p.name.length).toBeLessThanOrEqual(16);
    expect(p.name).not.toMatch(/[<>]/);
    expect(p.meta).toEqual([{ axis: 'might', value: 0.25 }]);
    expect(p.rerolls).toBe(3);
    expect(p.banishes).toBe(0);
    expect(p.canSkip).toBe(false);
    expect(p.aimMode).toBe('auto');
    expect(p.chars).toEqual(['carny']);
  });

  it('only replays whitelisted host events', () => {
    expect(parseHostMsg(JSON.stringify({ t: 'ev', type: 'banner', e: { text: 'hi' } }))).not.toBeNull();
    expect(parseHostMsg(JSON.stringify({ t: 'ev', type: 'eval', e: 'alert(1)' }))).toBeNull();
    expect(parseHostMsg(JSON.stringify({ t: 'start', cfg: { seed: 1, players: [{ character: 'bogus' }] } }))).toBeNull();
  });

  it('generates unambiguous lobby codes', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const c = generateCode();
      expect(isValidCode(c)).toBe(true);
      seen.add(c);
    }
    expect(seen.size).toBeGreaterThan(1990);
    expect(CODE_ALPHABET).not.toMatch(/[01IOL]/);
    expect(normalizeCode(' abc-d2f ')).toBe('ABCD2F');
    expect(isValidCode('ABCD0F')).toBe(false);
    expect(isValidCode('ABCDE')).toBe(false);
  });
});

// ===================================================================================== sessions
const hostProfile: HostProfile = { name: 'Kevin', meta: [], rerolls: 1, banishes: 1, canSkip: true, aimMode: 'auto' };
const guestProfile = (name = 'Brother'): GuestProfile => ({ name, meta: [{ axis: 'might', value: 0.1 }], rerolls: 2, banishes: 0, canSkip: false, aimMode: 'auto', chars: ['carny', 'strongman', 'fortune_teller'] });

/** A host and guest wired over the loopback network, with a clock and a full co-op run harness. */
class Harness {
  now = 1000;
  net: LoopbackNet;
  host = new HostSession('ABC234', hostProfile);
  guest!: GuestSession;
  hostLink!: LoopbackLink;
  guestLink!: LoopbackLink;
  game: Game | null = null;
  notices: string[] = [];
  events: string[] = [];
  constructor(opts: ConstructorParameters<typeof LoopbackNet>[0] = {}) {
    this.net = new LoopbackNet(opts);
    this.host.onNotice = (t) => this.notices.push(t);
    this.connect();
  }
  connect(token?: string | null, name = 'Brother'): GuestSession {
    const [h, g] = this.net.pair();
    this.hostLink = h;
    this.guestLink = g;
    this.host.accept(h);
    const gs = new GuestSession(g, guestProfile(name), token, this.now);
    gs.onStart = (cfg) => new Game(runConfigFromStart(cfg));
    // the guest's "UI": replay events on the mirror, pick the first card, finish prize wheels at once
    gs.onEvent = (type, e) => {
      this.events.push(type);
      gs.game?.bus.emit(type as never, e as never);
      if (type === 'draft') gs.draft('choose', 0);
      if (type === 'chest') gs.prizeDone();
    };
    this.guest = gs;
    return gs;
  }
  /** Advance wall time by `ms`, pumping the network and both sessions every frame. */
  run(ms: number, frame?: (now: number) => void): void {
    const end = this.now + ms;
    while (this.now < end) {
      this.now += 1000 / 60;
      this.net.pump(this.now);
      frame?.(this.now);
      this.host.update(this.now, 1000 / 60);
      this.guest.update(this.now);
    }
  }
  /** Lobby → start with the default picks. */
  startRun(): Game {
    this.host.setCharacter('carny');
    this.guest.pick('strongman');
    this.run(200);
    this.host.setReady(true);
    this.guest.setReady(true);
    this.run(200);
    const cfg = this.host.start({ seed: 2024, unlocked: UNLOCKED, questMemory: {} })!;
    expect(cfg).toBeTruthy();
    const g = new Game({ ...runConfigFromStart(cfg), godMode: true });
    this.host.attachGame(g);
    this.game = g;
    this.run(200);
    return g;
  }
  /** A co-op frame: host ticks its sim (unless paused / drafting), guest predicts and sends inputs. */
  playFrame = (guestInput: () => [number, number]) => () => {
    const g = this.game!;
    const gs = this.guest;
    if (gs.state === 'run' && gs.game && gs.game.phase === 'play' && !gs.pausedBy && !gs.replica?.frozen) {
      const [mx, my] = guestInput();
      gs.step(mx, my, 0, 0, false);
      gs.replica!.frame(1 / 60);
    }
    if (!this.host.paused && this.host.prizeReady && g.phase === 'play') {
      g.inputs[0].moveX = Math.cos(g.realTime * 0.5) * 0.7 - g.players[0].x / 1500;
      g.inputs[0].moveY = Math.sin(g.realTime * 0.5) * 0.7 - g.players[0].y / 1500;
      this.host.beforeTick(g);
      g.tick();
      this.host.captureFx(g.fx.events);
      g.fx.drain();
    }
    if (g.phase === 'draft' && g.draftPending(0)) g.chooseDraft(0, 0);
  };
}

describe('lobby and session flow', () => {
  it('chat (D-65): lines are cleaned, validated, relayed to the whole party in order, and floods are dropped', () => {
    expect(cleanChat('  hello\u0000   there\n')).toBe('hello there');
    expect(cleanChat('x'.repeat(500))!.length).toBe(CHAT_MAX);
    expect(cleanChat('   ')).toBeNull();
    expect(cleanChat(42)).toBeNull();
    expect(parseGuestMsg(JSON.stringify({ t: 'chat', text: '<b>hi</b>' }))).toEqual({ t: 'chat', text: '<b>hi</b>' });
    expect(parseGuestMsg(JSON.stringify({ t: 'chat', text: '' }))).toBeNull();
    expect(parseHostMsg(JSON.stringify({ t: 'chat', from: 9, name: 'A', text: 'hi' }))).toBeNull();
    expect(parseHostMsg(JSON.stringify({ t: 'chat', from: 1, name: '<x>Bo', text: 'hi' }))).toEqual({ t: 'chat', from: 1, name: 'xBo', text: 'hi' });
    const h = new Harness({ latency: 30 });
    h.run(300);
    const atHost: string[] = [], atGuest: string[] = [];
    h.host.onChat = (from, name, text) => atHost.push(`${from}:${name}:${text}`);
    h.guest.onChat = (from, name, text) => atGuest.push(`${from}:${name}:${text}`);
    h.guest.say('hello from the guest');
    h.run(200);
    h.host.say('and from the host');
    h.run(200);
    expect(atHost).toEqual(['1:Brother:hello from the guest', '0:Kevin:and from the host']);
    expect(atGuest).toEqual(atHost);
    // a burst of ten lines once the bucket is full: the first four go through, the flood is dropped (no disconnect)
    h.run(3000);
    for (let i = 0; i < 10; i++) h.guest.say(`spam ${i}`);
    h.run(300);
    expect(atHost.filter((l) => l.includes('spam')).length).toBe(4);
    expect(h.guest.state).not.toBe('closed');
    // the bucket refills: a line a little later goes through again
    h.run(1500);
    h.guest.say('later');
    h.run(200);
    expect(atGuest.at(-1)).toBe('1:Brother:later');
  });

  it('a miniboss carries its health to guests for its overhead bar (D-65)', () => {
    const host = duo(31, { godMode: true });
    const mirror = mirrorOf(host);
    const rep = new Replica(mirror, 1);
    const e = host.spawnEnemy(host.map.miniboss, host.players[1].x + 200, host.players[1].y)!;
    e.hp = e.maxHp * 0.4;
    const enc = new SnapshotEncoder();
    const buf = enc.encode(host, { seq: 1, ackInput: 0, ackSnap: 0, dict: new StringDict(), dictFrom: 0, view: wide(host), fx: [], sfx: [] });
    rep.apply(decodeSnapshot(buf, rep.dict), 0);
    const m = mirror.enemies[e.idx];
    expect(m.alive).toBe(true);
    expect(m.def.id).toBe(host.map.miniboss);
    expect(m.hp / m.maxHp).toBeCloseTo(0.4, 2);
  });

  it('the host picks the night\'s map (D-63): every guest sees it in the lobby and builds the same house', () => {
    const h = new Harness({ latency: 30 });
    h.run(300);
    expect(h.guest.lobby?.map).toBe('carnival_core');
    h.host.setMap('fun_house');
    h.run(200);
    expect(h.guest.lobby?.map).toBe('fun_house');
    const g = h.startRun();
    expect(g.mapId).toBe('fun_house');
    h.run(300);
    expect(h.guest.game?.mapId).toBe('fun_house');
    expect(h.guest.game?.quests.get('unreflected')).toBeTruthy();
    // the map can't change under a running night, and an unknown map id never survives the wire
    h.host.setMap('carnival_core');
    expect(h.host.lobby.map).toBe('fun_house');
    const start = parseHostMsg(JSON.stringify({ t: 'start', slot: 1, cfg: { seed: 5, map: 'the_moon', players: [{ character: 'carny', name: 'A', meta: [], aimMode: 'auto' }] } }));
    expect(start && start.t === 'start' ? start.cfg.map : 'x').toBeUndefined();
    const lob = parseHostMsg(JSON.stringify({ t: 'lobby', lobby: { code: 'ABC234', players: [], map: 'the_moon' } }));
    expect(lob && lob.t === 'lobby' ? lob.lobby.map : 'x').toBe('carnival_core');
  });

  it('seats a guest, lets characters repeat, requires readiness, then starts both machines', () => {
    const h = new Harness({ latency: 40 });
    h.run(300);
    expect(h.guest.state).toBe('lobby');
    expect(h.host.lobby.players[1]?.name).toBe('Brother');
    h.host.setCharacter('carny');
    h.run(200);
    h.guest.pick('carny'); // the same fool as the host is fine (D-54)
    h.run(200);
    expect(h.host.lobby.players[1]?.character).toBe('carny');
    h.guest.pick('strongman');
    h.guest.setReady(true);
    h.run(200);
    expect(h.host.canStart()).toBe(false); // host not ready yet
    h.host.setReady(true);
    h.run(200);
    expect(h.guest.lobby?.players[0]?.ready).toBe(true);
    expect(h.host.canStart()).toBe(true);
    h.host.setCharacter('fortune_teller'); // changing un-readies
    expect(h.host.canStart()).toBe(false);
    h.host.setReady(true);
    h.run(200);
    let built: ReturnType<typeof runConfigFromStart> | null = null;
    h.guest.onStart = (cfg) => {
      built = runConfigFromStart(cfg);
      return new Game(built);
    };
    h.host.start({ seed: 5, unlocked: UNLOCKED, questMemory: {} });
    h.run(200);
    expect(h.guest.state).toBe('run');
    expect(built!.players!.map((p) => p.character)).toEqual(['fortune_teller', 'strongman']);
    expect(built!.players![1].meta).toEqual([{ axis: 'might', value: 0.1 }]);
    expect(h.guest.replica).toBeTruthy();
  });

  it('refuses a seventh player, a wrong version, and strangers once the run has begun', () => {
    const h = new Harness();
    h.run(100);
    const party = [h.guest];
    for (let k = 2; k <= 5; k++) {
      party.push(h.connect(null, `Friend ${k}`));
      h.run(100);
    }
    expect(party.map((gs) => gs.state)).toEqual(['lobby', 'lobby', 'lobby', 'lobby', 'lobby']);
    expect(party.map((gs) => gs.slot)).toEqual([1, 2, 3, 4, 5]);
    const seventh = h.connect(null, 'Intruder');
    let reason = '';
    seventh.onClosed = (r) => (reason = r);
    h.run(100);
    expect(seventh.state).toBe('closed');
    expect(reason).toMatch(/full/);
    expect(party[0].state).toBe('lobby');

    // wrong protocol version
    const [a, b] = h.net.pair();
    h.host.accept(a);
    let rej = '';
    b.onMsg = (raw) => (rej = String(raw));
    b.sendMsg({ t: 'hello', v: PROTO + 1, profile: guestProfile('Old') });
    h.net.pump(h.now + 100);
    expect(rej).toMatch(/version/);

    // garbage instead of hello
    const [c, d] = h.net.pair();
    h.host.accept(c);
    let rej2 = '';
    d.onMsg = (raw) => (rej2 = String(raw));
    d.sendRaw('{"t":"pick","character":"carny"}');
    h.net.pump(h.now + 200);
    expect(rej2).toMatch(/bad_hello/);
  });

  it('a tab whose loop stalls (no updates for a while) does not mistake its own sleep for a dead link', () => {
    const h = new Harness({ latency: 30 });
    h.run(300);
    expect(h.guest.state).toBe('lobby');
    // the guest's loop stops for 12 s; the host keeps pinging and the guest's link still answers
    let end = h.now + 12000;
    while (h.now < end) {
      h.now += 1000 / 60;
      h.net.pump(h.now);
      h.host.update(h.now, 1000 / 60);
    }
    h.guest.update(h.now);
    expect(h.guest.state).toBe('lobby');
    expect(h.host.connected(1)).toBe(true);
    // and the other way round: the host's loop stalls while the guest keeps talking
    end = h.now + 12000;
    while (h.now < end) {
      h.now += 1000 / 60;
      h.net.pump(h.now);
      h.guest.update(h.now);
    }
    h.host.update(h.now, 1000 / 60);
    expect(h.host.connected(1)).toBe(true);
    expect(h.guest.state).toBe('lobby');
  });

  it('drops a guest that floods invalid traffic', () => {
    const h = new Harness();
    h.run(100);
    for (let i = 0; i < 80; i++) h.guestLink.sendRaw('{"t":"draft","op":"explode"}');
    h.run(100);
    expect(h.host.guests.length).toBe(0);
    expect(h.guest.state).toBe('closed');
  });

  it('frees the seat when the guest leaves the lobby, and tells the guest when the host closes', () => {
    const h = new Harness();
    h.run(100);
    h.guest.leave();
    h.run(100);
    expect(h.host.guests.length).toBe(0);
    const g2 = h.connect(null, 'Again');
    h.run(100);
    expect(g2.state).toBe('lobby');
    let why = '';
    g2.onClosed = (r) => (why = r);
    h.host.close();
    h.run(100);
    expect(g2.state).toBe('closed');
    expect(why).toMatch(/closed/i);
  });
});

describe('a synchronized co-op run over a lossy network', () => {
  it('replicates the night, resolves both drafts and the prize wheel, and keeps prediction tight', () => {
    const h = new Harness({ latency: 45, jitter: 15, loss: 0.03, dupe: 0.01, seed: 7 });
    h.run(200);
    const g = h.startRun();
    const gs = h.guest;
    expect(gs.state).toBe('run');
    // the guest UI: answer drafts by choosing the first card, finish prize wheels immediately
    let guestDrafts = 0, guestPrizes = 0;
    gs.onEvent = (type, e) => {
      h.events.push(type);
      gs.game?.bus.emit(type as never, e as never);
      if (type === 'draft') {
        guestDrafts++;
        gs.draft('choose', 0);
      }
      if (type === 'chest') {
        guestPrizes++;
        gs.prizeDone();
      }
    };
    g.bus.on('chest', () => h.host.prizeHostDone());
    const play = h.playFrame(() => [Math.cos(h.now / 900), Math.sin(h.now / 1300)]);
    // sample how far the guest's drawn self is from the host's truth while walking normally (not
    // during the host-side bumper-car dash, which the guest cannot predict, nor right after it)
    const gaps: number[] = [];
    let lastDash = -1e9;
    const frame = () => {
      play();
      const r = gs.replica;
      if (g.players[1].dashT > 0) lastDash = h.now;
      if (r && gs.game?.phase === 'play' && !r.frozen && g.phase === 'play' && h.now - lastDash > 600) {
        const d = r.localDrawPos();
        gaps.push(Math.hypot(d.x - g.players[1].x, d.y - g.players[1].y));
      }
    };
    h.run(90_000, frame);
    // a chest for the pair: split prizes, both screens show the wheel, the night waits for both
    const p1 = g.players[1];
    g.spawnPickup('chest', p1.x, p1.y, 0);
    h.run(3000, frame);
    expect(g.phase).not.toBe('ended');
    expect(g.time).toBeGreaterThan(60);
    expect(g.level).toBeGreaterThan(3);
    expect(guestDrafts).toBeGreaterThanOrEqual(g.level - 2);
    expect(g.players[1].weapons.list.length + g.players[1].passives.size).toBeGreaterThan(2); // the guest's picks landed
    expect(guestPrizes).toBeGreaterThanOrEqual(1);
    expect(h.events).toContain('levelup');
    // the mirror agrees with the host
    const m = gs.game!;
    expect(m.level).toBe(g.level);
    expect(Math.abs(m.time - g.time)).toBeLessThan(0.5);
    expect(Math.abs(m.kills - g.kills)).toBeLessThan(40);
    expect(m.players[1].weapons.list.map((w) => w.def.id)).toEqual(g.players[1].weapons.list.map((w) => w.def.id));
    // prediction: the guest sees itself close to where the host has it (one-way latency ≈ 45 ms)
    // the prediction leads the host by the inputs still in flight (~45 ms one way + buffering)
    gaps.sort((a, b) => a - b);
    const median = gaps[gaps.length >> 1], p90 = gaps[Math.floor(gaps.length * 0.9)];
    expect(gaps.length).toBeGreaterThan(2000);
    expect(median).toBeLessThan(25);
    expect(p90).toBeLessThan(45);
    // diagnostics are live
    expect(h.host.diag.snapRate).toBeGreaterThan(15);
    expect(gs.diag.rtt).toBeGreaterThan(60);
    expect(gs.diag.rtt).toBeLessThan(200);
    console.info(`[net] 90 s co-op over 45±15 ms, 3% loss: host ${h.host.diag.bytesPerSec.toFixed(0)} B/s @ ${h.host.diag.snapRate.toFixed(1)} Hz, last snap ${h.host.diag.snapBytes} B; starved ${h.host.diag.starved}, dropped ${h.host.diag.dropped}; guest rtt ${gs.diag.rtt.toFixed(0)} ms, snaps lost ${gs.diag.snapLost}; drawn-vs-host gap median ${median.toFixed(1)} p90 ${p90.toFixed(1)} (n=${gaps.length})`);
  });

  it('applies every guest input once, even when the host ticks unevenly (144 Hz display, bursty frames)', () => {
    for (const mode of ['144hz', 'bursty'] as const) {
      const h = new Harness({ latency: 35, jitter: 10, seed: 3 });
      h.run(100);
      const g = h.startRun();
      g.addXp(-1e9); // no level-ups: this test is about movement only
      const gs = h.guest;
      const sent: number[] = [];
      let acc = 0, frame = 0;
      // the guest walks right for two seconds at its own steady 60 Hz
      const step = (ms: number) => {
        const end = h.now + ms;
        while (h.now < end) {
          const dtMs = mode === '144hz' ? 1000 / 144 : 1000 / 60;
          h.now += dtMs;
          frame++;
          h.net.pump(h.now);
          h.host.update(h.now, dtMs);
          gs.update(h.now);
          gs.replica?.frame(dtMs / 1000);
          if (frame % (mode === '144hz' ? 2.4 : 1) < 1 && gs.state === 'run' && gs.game?.phase === 'play' && sent.length < 120) {
            gs.step(1, 0, 0, 0, false);
            sent.push(1);
          }
          // the host's sim: 144 Hz frames tick every ~2.4 frames; bursty frames run 4 ticks every 4th frame
          if (mode === '144hz') {
            acc += dtMs;
            while (acc >= 1000 / 60) {
              acc -= 1000 / 60;
              h.host.beforeTick(g);
              g.tick();
            }
          } else if (frame % 4 === 0) {
            for (let k = 0; k < 4; k++) {
              h.host.beforeTick(g);
              g.tick();
            }
          }
          g.fx.drain();
          if (g.phase === 'draft') autoDraft(g);
        }
      };
      h.host.beforeTick(g); // the night is running when the guest starts walking
      g.tick();
      const startX = g.players[1].x;
      step(3000);
      // 120 inputs of full-right movement at the Strongman's speed, applied exactly once each
      const moved = g.players[1].x - startX;
      const speed = g.players[1].stats.moveSpeed();
      expect(h.host.diag.dropped).toBe(0);
      expect(moved).toBeGreaterThan(speed * 1.9); // ~2 s of walking (a few repeats may add a step or two)
      expect(moved).toBeLessThan(speed * 2.15);
      // and the guest's prediction agrees with the host once everything has landed
      expect(Math.abs(gs.replica!.localDrawPos().x - g.players[1].x)).toBeLessThan(10);
    }
  });

  it('holds the guest still while the host lingers on a prize wheel (no snap-back afterwards)', () => {
    const h = new Harness({ latency: 40, jitter: 8, seed: 11 });
    h.run(100);
    const g = h.startRun();
    g.addXp(-1e9);
    let hostDoneAt = Infinity;
    g.bus.on('chest', () => (hostDoneAt = h.now + 2500)); // the host watches its wheel for 2.5 s
    const frame = h.playFrame(() => [1, 0]);
    const tick = () => {
      if (h.now >= hostDoneAt) {
        hostDoneAt = Infinity;
        h.host.prizeHostDone();
      }
      frame();
    };
    h.run(1000, tick);
    g.spawnPickup('chest', g.players[1].x, g.players[1].y, 0);
    h.run(500, tick);
    expect(h.host.prizeReady).toBe(false);
    const droppedBefore = h.host.diag.dropped;
    h.run(1500, tick); // guest finished its wheel at once, host still watching
    expect(h.guest.replica!.frozen).toBe(true);
    h.run(2000, tick); // host done: the night runs again
    expect(h.host.prizeReady).toBe(true);
    // only the steps in flight when the freeze began were discarded, not seconds of walking
    expect(h.host.diag.dropped - droppedBefore).toBeLessThan(12);
    expect(Math.abs(h.guest.replica!.localDrawPos().x - g.players[1].x)).toBeLessThan(25);
  });

  it('pauses for everyone when either player pauses', () => {
    const h = new Harness({ latency: 30 });
    h.run(100);
    const g = h.startRun();
    const frame = h.playFrame(() => [1, 0]);
    h.run(2000, frame);
    const t0 = g.time;
    h.guest.pause(true);
    h.run(1500, frame);
    expect(h.host.paused).toBe(true);
    expect(g.time - t0).toBeLessThan(0.2);
    h.guest.pause(false);
    h.run(1000, frame);
    expect(g.time - t0).toBeGreaterThan(0.6);
    let by: string | null = 'x';
    h.guest.onPause = (b) => (by = b);
    h.host.setPaused(true);
    h.run(200, frame);
    expect(by).toBe('Kevin');
    expect(h.guest.pausedBy).toBe('Kevin');
    h.host.setPaused(false);
    h.run(200, frame);
    expect(h.guest.pausedBy).toBeNull();
  });

  it('survives a guest dropping mid-run: the host waits, the guest rejoins its seat with its token', () => {
    const h = new Harness({ latency: 30 });
    h.run(100);
    const g = h.startRun();
    const frame = h.playFrame(() => [0.5, 0.5]);
    h.run(5000, frame);
    const token = h.guest.token;
    expect(token).toBeTruthy();
    // the network dies without a goodbye
    h.guestLink.severed = true;
    h.hostLink.severed = true;
    h.run(LINK_TIMEOUT + 1500, frame);
    expect(h.host.connected(1)).toBe(false);
    expect(h.host.hold).toEqual({ why: 'reconnect', who: [1] });
    expect(h.host.paused).toBe(true);
    const tWait = g.time;
    h.run(2000, frame);
    expect(g.time).toBe(tWait); // the run holds while we wait
    // rejoin with the same token: back in the same seat with a fresh mirror
    const back = h.connect(token, 'Brother');
    h.run(800, frame);
    expect(h.host.connected(1)).toBe(true);
    expect(h.host.hold.why).not.toBe('reconnect');
    expect(back.state).toBe('run');
    expect(back.game).not.toBeNull();
    h.run(3000, frame);
    expect(g.time).toBeGreaterThan(tWait + 2);
    expect(back.game!.level).toBe(g.level);
    expect(h.notices.some((n) => /reconnected/.test(n))).toBe(true);
  });

  it('carries on without a guest who never returns', () => {
    const h = new Harness({ latency: 30 });
    h.run(100);
    const g = h.startRun();
    const frame = h.playFrame(() => [0, 0]);
    h.run(1000, frame);
    h.guestLink.severed = true;
    h.hostLink.severed = true;
    h.run(LINK_TIMEOUT + RECONNECT_WAIT + 2000, frame);
    expect(h.host.hold.why).not.toBe('reconnect');
    expect(h.host.paused).toBe(false);
    const t = g.time;
    h.run(2000, frame);
    expect(g.time).toBeGreaterThan(t + 1.5);
  });

  it('ends the guest’s session cleanly when the host leaves mid-run', () => {
    const h = new Harness({ latency: 30 });
    h.run(100);
    h.startRun();
    let why = '';
    h.guest.onClosed = (r) => (why = r);
    h.host.close('The host ended the run.');
    h.run(300);
    expect(h.guest.state).toBe('closed');
    expect(why).toBe('The host ended the run.');
  });

  it('pays each player their own end-of-run stats', () => {
    const h = new Harness({ latency: 20 });
    h.run(100);
    const g = h.startRun();
    let guestStats: { character?: string; lostTickets?: number } | null = null;
    h.guest.onEvent = (type, e) => {
      if (type === 'run_end') guestStats = (e as { stats: { character: string; lostTickets: number } }).stats;
    };
    h.run(3000, h.playFrame(() => [0, 1]));
    g.endRun(false);
    h.run(300);
    expect(guestStats).not.toBeNull();
    expect(guestStats!.character).toBe('strongman');
    expect(g.endStatsAll[0].character).toBe('carny');
  });
});

// ===================================================================================== parties of six (D-54)
/** A host and up to five guests over one lossy loopback network, each guest with its own "UI". */
class Party {
  now = 1000;
  net: LoopbackNet;
  host = new HostSession('PARTY6', hostProfile);
  guests: { gs: GuestSession; link: LoopbackLink; hostLink: LoopbackLink; name: string }[] = [];
  game: Game | null = null;
  constructor(n: number, opts: ConstructorParameters<typeof LoopbackNet>[0] = {}) {
    this.net = new LoopbackNet(opts);
    for (let k = 0; k < n; k++) this.join(`Friend ${k + 1}`);
  }
  join(name: string, token?: string | null): GuestSession {
    const [h, g] = this.net.pair();
    this.host.accept(h);
    const gs = new GuestSession(g, guestProfile(name), token, this.now);
    gs.onStart = (cfg) => new Game(runConfigFromStart(cfg));
    gs.onEvent = (type, e) => {
      gs.game?.bus.emit(type as never, e as never);
      if (type === 'draft') gs.draft('choose', 0);
      if (type === 'chest') gs.prizeDone();
    };
    const entry = { gs, link: g, hostLink: h, name };
    const old = this.guests.findIndex((x) => x.name === name);
    if (old >= 0) this.guests[old] = entry;
    else this.guests.push(entry);
    return gs;
  }
  run(ms: number, frame?: () => void): void {
    const end = this.now + ms;
    while (this.now < end) {
      this.now += 1000 / 60;
      this.net.pump(this.now);
      frame?.();
      this.host.update(this.now, 1000 / 60);
      for (const x of this.guests) x.gs.update(this.now);
    }
  }
  startRun(chars: string[]): Game {
    this.host.setCharacter(chars[0]);
    this.guests.forEach((x, k) => x.gs.pick(chars[k + 1]));
    this.run(200);
    this.host.setReady(true);
    for (const x of this.guests) x.gs.setReady(true);
    this.run(200);
    const cfg = this.host.start({ seed: 606, unlocked: UNLOCKED, questMemory: {} })!;
    expect(cfg).toBeTruthy();
    const g = new Game({ ...runConfigFromStart(cfg), godMode: true });
    g.bus.on('chest', () => this.host.prizeHostDone());
    this.host.attachGame(g);
    this.game = g;
    this.run(300);
    return g;
  }
  /** Every guest walks its own circle; the host ticks whenever nothing holds the night. */
  frame = (): void => {
    const g = this.game!;
    this.guests.forEach((x, k) => {
      const gs = x.gs;
      if (gs.state === 'run' && gs.game && gs.game.phase === 'play' && !gs.pausedBy && !gs.replica?.frozen) {
        const a = g.realTime * 0.6 + k * 1.1;
        gs.step(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0, 0, false);
        gs.replica!.frame(1 / 60);
      }
    });
    if (!this.host.paused && this.host.prizeReady && g.phase === 'play') {
      g.inputs[0].moveX = Math.cos(g.realTime * 0.5) * 0.7 - g.players[0].x / 1500;
      g.inputs[0].moveY = Math.sin(g.realTime * 0.5) * 0.7 - g.players[0].y / 1500;
      this.host.beforeTick(g);
      g.tick();
      this.host.captureFx(g.fx.events);
      g.fx.drain();
    }
    if (g.phase === 'draft' && g.draftPending(0)) g.chooseDraft(0, 0);
  };
}

const SIX = ['carny', 'carny', 'strongman', 'strongman', 'fortune_teller', 'carny'];
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('parties of up to six players (D-54)', () => {
  it('seats five guests in compact seats and starts a six-player night with repeated characters', () => {
    const p = new Party(5, { latency: 30 });
    p.run(300);
    expect(p.guests.map((x) => x.gs.slot)).toEqual([1, 2, 3, 4, 5]);
    // a guest leaving the lobby closes the gap: the seats behind it move up
    p.guests[1].gs.leave();
    p.run(200);
    p.guests.splice(1, 1);
    expect(p.guests.map((x) => x.gs.slot)).toEqual([1, 2, 3, 4]);
    p.join('Late Friend');
    p.run(300);
    expect(p.guests.map((x) => x.gs.slot)).toEqual([1, 2, 3, 4, 5]);
    const g = p.startRun(SIX);
    expect(g.players.map((pl) => pl.char.id)).toEqual(SIX);
    expect(g.players.map((pl) => pl.name)).toEqual(['Kevin', 'Friend 1', 'Friend 3', 'Friend 4', 'Friend 5', 'Late Friend']);
    for (const x of p.guests) {
      expect(x.gs.state).toBe('run');
      expect(x.gs.game!.players.length).toBe(6);
      expect(x.gs.game!.players[x.gs.slot].name).toBe(x.name); // each mirror predicts its own player
    }
    expect(g.slots).toEqual({ weapons: 2, passives: 4 });
  });

  it('plays a six-player night over a lossy network: every mirror tracks the host, inputs land, drafts wait for all', () => {
    const p = new Party(5, { latency: 45, jitter: 15, loss: 0.03, dupe: 0.01, seed: 11 });
    p.run(300);
    const g = p.startRun(SIX);
    const start = g.players.map((pl) => ({ x: pl.x, y: pl.y }));
    const lvl0 = g.level;
    const gaps: number[] = [];
    const reach = [0, 0, 0, 0, 0, 0];
    let tick = 0;
    p.run(40000, () => {
      p.frame();
      g.players.forEach((pl, i) => (reach[i] = Math.max(reach[i], dist(pl, start[i]))));
      // a six-player party levels slowly (D-57): top up a level every ~8 s so the drafts get exercised
      if (++tick % 480 === 0 && tick < 2100 && g.phase === 'play') g.addXp(g.xpToNext - g.xp + 0.01);
      if (g.phase !== 'play') return;
      for (const x of p.guests) {
        const i = x.gs.slot, rep = x.gs.replica!;
        if (rep.last && g.players[i].dashT <= 0) gaps.push(dist(rep.localDrawPos(), g.players[i]));
      }
    });
    p.run(3000, p.frame); // the last level-up's drafts resolve
    expect(g.level).toBeGreaterThan(lvl0 + 2); // shared XP levelled the party, and every draft resolved
    expect(g.phase).toBe('play');
    for (let i = 1; i < 6; i++) {
      expect(reach[i], `player ${i} moved`).toBeGreaterThan(100);
      expect(g.players[i].weapons.list.length + g.players[i].passives.size, `player ${i} drafted`).toBeGreaterThan(1);
    }
    // every guest sees the whole party where the host has it (the others ~100 ms behind)
    for (const x of p.guests) {
      const m = x.gs.game!;
      for (let i = 0; i < 6; i++) if (i !== x.gs.slot) expect(dist(m.players[i], g.players[i]), `guest ${x.gs.slot} sees player ${i}`).toBeLessThan(60);
      expect(m.level).toBe(g.level);
    }
    gaps.sort((a, b) => a - b);
    const med = gaps[gaps.length >> 1], p90 = gaps[Math.floor(gaps.length * 0.9)];
    const d = p.host.diag;
    console.log(`[net] six players, 40 s over 45±15 ms, 3% loss: host upload ${(d.bytesPerSec / 1024).toFixed(1)} KB/s for ${d.peers?.length} guests (${d.peers?.map((q) => q.kbps.toFixed(1)).join(' / ')}), biggest snapshot ${d.snapBytes} B, dropped inputs ${d.dropped}; drawn-vs-host gap median ${med.toFixed(1)} p90 ${p90.toFixed(1)}`);
    expect(d.peers?.length).toBe(5);
    expect(d.dropped).toBeLessThan(30);
    expect(med).toBeLessThan(30);
  });

  it('holds the night for everyone while one guest reconnects; its rejoin restarts only its own stream', () => {
    const p = new Party(5, { latency: 30 });
    p.run(300);
    const g = p.startRun(SIX);
    p.run(3000, p.frame);
    const victim = p.guests[2];
    const token = victim.gs.token;
    victim.link.severed = true;
    victim.hostLink.severed = true;
    p.run(LINK_TIMEOUT + 1500, p.frame);
    expect(p.host.hold).toEqual({ why: 'reconnect', who: [3] });
    expect(p.guests[0].gs.hold).toEqual({ why: 'reconnect', who: [3] }); // the others are told who
    const tWait = g.time;
    const seqBefore = p.guests[0].gs.replica!.last!.seq;
    p.run(1500, p.frame);
    expect(g.time).toBe(tWait); // held
    expect(p.guests[0].gs.replica!.last!.seq).toBeGreaterThan(seqBefore); // the others still get snapshots
    const back = p.join(victim.name, token);
    p.run(1000, p.frame);
    expect(back.state).toBe('run');
    expect(back.slot).toBe(3);
    expect(p.host.hold.why).not.toBe('reconnect');
    p.run(3000, p.frame);
    expect(g.time).toBeGreaterThan(tWait + 2);
    for (const x of p.guests) for (let i = 0; i < 6; i++) if (i !== x.gs.slot) expect(dist(x.gs.game!.players[i], g.players[i])).toBeLessThan(60);
  });

  it('follows Vampire Survivors weapon slots (holding at its floor of two beyond four players), passives shrinking half as fast', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => COOP.slots[n])).toEqual([6, 4, 3, 2, 2, 2]);
    // D-61: passives lose half as many slots as weapons, 6 - (6 - weapons) / 2 (three players' 4.5 rounds up)
    expect([1, 2, 3, 4, 5, 6].map((n) => COOP.passiveSlots[n])).toEqual([6, 5, 5, 4, 4, 4]);
    for (let n = 1; n <= 6; n++) expect(COOP.passiveSlots[n]).toBe(Math.ceil(6 - (6 - COOP.slots[n]) / 2));
    for (const n of [5, 6]) {
      const g = makeGame({ seed: 3, players: Array.from({ length: n }, (_, i) => ({ character: 'carny', name: `P${i}` })) });
      expect(g.players.length).toBe(n);
      expect(g.slots).toEqual({ weapons: 2, passives: 4 });
      expect(g.partyScale.density).toBeGreaterThan(COOP.density[4]);
    }
  });

  it('shares small chests fairly across a party of six', () => {
    const g = makeGame({ seed: 8, players: Array.from({ length: 6 }, (_, i) => ({ character: 'carny', name: `P${i}` })) });
    const got = [0, 0, 0, 0, 0, 0];
    for (let k = 0; k < 12; k++) {
      g.setCtx(g.players[k % 2]); // the same two players keep opening the chests
      const r = g.openChest([1, 3, 5][k % 3]);
      for (const e of r.entries) got[e.player!]++;
    }
    expect(Math.max(...got) - Math.min(...got)).toBeLessThanOrEqual(1);
  });

  it('pulls players into an inhale across its whole warning circle, and the guest predicts the same pull', () => {
    const g = makeGame({ seed: 5, godMode: true });
    g.weapons.list.length = 0;
    const p = g.player;
    const maw = { x: p.x - 300, y: p.y, r: 70, pull: 170, pullR: 420 };
    // the pull reaches the warning circle's edge and grows toward the maw
    p.pullX = p.pullY = 0;
    addHazardPull(p, maw);
    const out300 = Math.hypot(p.pullX, p.pullY);
    expect(out300).toBeGreaterThan(100);
    p.pullX = p.pullY = 0;
    addHazardPull(p, { ...maw, x: p.x - 100 });
    expect(Math.hypot(p.pullX, p.pullY)).toBeGreaterThan(out300);
    p.pullX = p.pullY = 0;
    addHazardPull(p, { ...maw, x: p.x - 500 });
    expect(p.pullX).toBe(0); // beyond its reach
    expect(maw.pull).toBeLessThan(187); // even at the maw, the slowest fool (the Strongman) can walk out
    // in the sim, a player standing 300 units out is dragged a long way in a second
    const x0 = p.x;
    const h = g.spawnHazard('circle', 'maw', p.x - 300, p.y, { r: 70, tele: 0.01, active: 3, dmg: 0, pull: 170, pullR: 420 });
    for (let i = 0; i < 60; i++) g.tick();
    expect(x0 - p.x).toBeGreaterThan(90);
    h.alive = false;
  });

  it('a guest predicts the inhale the host applies, so its drawn self stays with the host', () => {
    const p = new Party(1, { latency: 40, jitter: 10, seed: 4 });
    p.run(300);
    const g = p.startRun(['carny', 'strongman']);
    g.addXp(-1e9);
    const gs = p.guests[0].gs;
    const me = g.players[1];
    g.spawnHazard('circle', 'maw', me.x - 320, me.y, { r: 70, tele: 0.01, active: 4, dmg: 0, pull: 170, pullR: 420, safe: false });
    const x0 = me.x;
    const gaps: number[] = [];
    p.run(2500, () => {
      // the guest stands still: only the pull moves it
      if (gs.state === 'run' && gs.game?.phase === 'play' && !gs.replica?.frozen) {
        gs.step(0, 0, 0, 0, false);
        gs.replica!.frame(1 / 60);
      }
      if (!p.host.paused && p.host.prizeReady && g.phase === 'play') {
        p.host.beforeTick(g);
        g.tick();
        g.fx.drain();
      }
      if (gs.replica?.last) gaps.push(dist(gs.replica.localDrawPos(), me));
    });
    expect(x0 - me.x).toBeGreaterThan(150); // the host dragged the guest's fool toward the maw
    gaps.sort((a, b) => a - b);
    // predicted, not corrected after the fact: the drawn self leads the host by about the inputs in flight
    expect(gaps[Math.floor(gaps.length * 0.9)]).toBeLessThan(25);
  });

  it('a guest predicts a stage ring reeling it in, so it glides back instead of snapping (D-61)', () => {
    const p = new Party(1, { latency: 40, jitter: 10, seed: 4 });
    p.run(300);
    const g = p.startRun(['carny', 'strongman']);
    g.addXp(-1e9);
    const gs = p.guests[0].gs;
    const me = g.players[1];
    // the Puppet King's stage, with the guest 480 units off its edge
    const king = createBoss(g, BOSS_MAP.puppet_king, { immediate: true });
    king.ringX = me.x - 1300;
    king.ringY = me.y;
    g.bosses.push(king);
    const x0 = me.x;
    const gaps: number[] = [];
    let seen = false;
    p.run(2500, () => {
      // the guest stands still: only the ring moves it
      if (gs.state === 'run' && gs.game?.phase === 'play' && !gs.replica?.frozen) {
        gs.step(0, 0, 0, 0, false);
        gs.replica!.frame(1 / 60);
      }
      if (!p.host.paused && p.host.prizeReady && g.phase === 'play') {
        p.host.beforeTick(g);
        g.tick();
        g.fx.drain();
      }
      if (gs.game?.bosses.some((b) => b.ringR > 0)) seen = true;
      // how far each host update moved the guest's own fool from where it had predicted itself
      if (gs.replica?.last && seen) gaps.push(gs.replica.predErr);
    });
    expect(seen).toBe(true); // the ring reached the guest's mirror with the boss
    expect(x0 - me.x).toBeGreaterThan(300); // the host reeled the guest's fool back toward the stage
    gaps.sort((a, b) => a - b);
    // predicted, not snapped: the host's updates agree with where the guest already drew itself
    expect(gaps[Math.floor(gaps.length * 0.9)]).toBeLessThan(4);
  });
});
