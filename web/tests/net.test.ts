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
  PROTO, cleanProfile, decodeInputPacket, encodeInputPacket, parseGuestMsg, parseHostMsg,
  type GuestProfile,
} from '../src/net/protocol';
import { GuestSession, HostSession, LINK_TIMEOUT, RECONNECT_WAIT, runConfigFromStart, type HostProfile } from '../src/net/session';

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
    const r = new Reader(w.done());
    expect([r.i8(), r.u16(), r.i16(), r.f32()]).toEqual([127, 0, 32767, 0]);
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
    if (gs.state === 'run' && gs.game && gs.game.phase === 'play' && !gs.pausedBy) {
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
  it('seats a guest, enforces distinct characters and readiness, then starts both machines', () => {
    const h = new Harness({ latency: 40 });
    h.run(300);
    expect(h.guest.state).toBe('lobby');
    expect(h.host.lobby.players[1]?.name).toBe('Brother');
    h.host.setCharacter('carny');
    h.run(200);
    h.guest.pick('carny'); // taken
    h.run(200);
    expect(h.host.lobby.players[1]?.character).toBeNull();
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

  it('refuses a third player, a wrong version, and strangers once the run has begun', () => {
    const h = new Harness();
    h.run(100);
    const first = h.guest;
    const third = h.connect(null, 'Intruder');
    let reason = '';
    third.onClosed = (r) => (reason = r);
    h.run(100);
    expect(third.state).toBe('closed');
    expect(reason).toMatch(/full/);
    expect(first.state).toBe('lobby');

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

  it('drops a guest that floods invalid traffic', () => {
    const h = new Harness();
    h.run(100);
    for (let i = 0; i < 80; i++) h.guestLink.sendRaw('{"t":"draft","op":"explode"}');
    h.run(100);
    expect(h.host.seat).toBeNull();
    expect(h.guest.state).toBe('closed');
  });

  it('frees the seat when the guest leaves the lobby, and tells the guest when the host closes', () => {
    const h = new Harness();
    h.run(100);
    h.guest.leave();
    h.run(100);
    expect(h.host.seat).toBeNull();
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
    const frame = h.playFrame(() => [Math.cos(h.now / 900), Math.sin(h.now / 1300)]);
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
    const drawn = gs.replica!.localDrawPos();
    expect(Math.hypot(drawn.x - g.players[1].x, drawn.y - g.players[1].y)).toBeLessThan(40);
    // diagnostics are live
    expect(h.host.diag.snapRate).toBeGreaterThan(15);
    expect(gs.diag.rtt).toBeGreaterThan(60);
    expect(gs.diag.rtt).toBeLessThan(200);
    console.info(`[net] 90 s co-op over 45±15 ms, 3% loss: host ${h.host.diag.bytesPerSec.toFixed(0)} B/s @ ${h.host.diag.snapRate.toFixed(1)} Hz, last snap ${h.host.diag.snapBytes} B; starved ${h.host.diag.starved}, dropped ${h.host.diag.dropped}; guest rtt ${gs.diag.rtt.toFixed(0)} ms, snaps lost ${gs.diag.snapLost}, pred err ${gs.diag.predErr.toFixed(2)}`);
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
    expect(h.host.guestConnected).toBe(false);
    expect(h.host.waitingFor).toBe('Brother');
    expect(h.host.paused).toBe(true);
    const tWait = g.time;
    h.run(2000, frame);
    expect(g.time).toBe(tWait); // the run holds while we wait
    // rejoin with the same token: back in the same seat with a fresh mirror
    const back = h.connect(token, 'Brother');
    h.run(800, frame);
    expect(h.host.guestConnected).toBe(true);
    expect(h.host.waitingFor).toBeNull();
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
    expect(h.host.waitingFor).toBeNull();
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
