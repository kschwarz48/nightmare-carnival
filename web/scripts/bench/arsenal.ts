// Arsenal bench (D-103): every weapon at five investment points in seven fights, and weapons side by side.
//
// One weapon at a time, held by the Carny (no damage quirk), in god mode, with no level-ups or chests:
//
//   • boss    — a boss's body (80 px, endless health, never burnt, chilled, slowed or shoved), the player
//               circle-strafing it at 150 or 260 px, whichever suits the weapon: sustained single-target damage;
//   • elite   — one Carnival Brute with endless health that chases the player around a circle: a single durable
//               target that burns, chills, slows and is shoved like any creature (so damage over time counts);
//   • group   — 12 Puppet Soldiers (300 health) kept alive 150-350 px out: a small, durable group;
//   • swarm   — 120 Possessed Stuffies at 4x health kept alive 200-500 px out, the player kiting a circle: how much
//               crowd the weapon can process (a strong weapon never runs out of targets);
//   • runners — 40 Evil Clowns at 3x health (fast chasers) kept alive 300-550 px out: hitting what moves;
//   • mixed   — 50 Stuffies (2x), 20 Evil Clowns (2x) and 6 Puppet Soldiers kept alive: weak, fast and durable at once;
//   • night   — the Carnival Core's own crowd from 15:00 to 17:30 (its director, waves, map and walls), a confident
//               pilot: kills per minute and the hits the pilot would have taken per minute.
//
// The pilot aims at the nearest target, as a player with a mouse or a right stick does.
//
// Per fight: useful damage per second (overkill isn't counted), overkill (the share of a weapon's damage that went
// past what its targets had left), uptime (the share of quarter seconds in which it did useful damage) and kills.
//
// Investment points: L1, L4, L8 (the base weapon, no charms); E1 (the evolution at Evo Lv 1 with its own charm at
// Lv 1, the moment it evolves); E8 (Evo Lv 8 with a late kit: Strongman Belt, Energy Drink, Foam Finger, Extra
// Token and Spinning Top at Lv 5, plus its own charm at Lv 5).
//
//   npx vite-node scripts/bench/arsenal.ts out.json [--only=id,id] [--levels=L8,E8] [--fights=boss,swarm] [--seeds=2]
//   npx vite-node scripts/bench/arsenal.ts out.json --pairs [--levels=L8,E8]
//
// --pairs measures builds of two weapons against each alone (counterfactuals): each weapon's share of the pair's
// useful damage, what it does beside the other against what it does alone, and what adding it changes in kills
// and hits taken on the night. The Funhouse Mirror only replays your other weapons: it is measured beside
// Throwing Cards and reported as the share of damage it adds.
import { writeFileSync } from 'node:fs';
import { makeGame } from '../../tests/helpers';
import { CARNIVAL_LAYOUT, applyLayout } from '../../src/data/map';
import { WEAPONS, BASE_WEAPON_IDS } from '../../src/data/weapons';
import { Nav } from '../../src/sim/nav';
import { BossPart } from '../../src/sim/entities';
import { lineOf } from '../../src/sim/meter';
import type { BossBase } from '../../src/sim/bosses/boss';
import type { Game } from '../../src/sim/game';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const only = arg('only')?.split(',');
const SEEDS = [7, 31, 59].slice(0, Number(arg('seeds') ?? 1));
const outPath = process.argv.slice(2).find((a) => a.endsWith('.json'));
const LEVELS = (arg('levels') ?? 'L1,L4,L8,E1,E8').split(',');
const FIGHTS = (arg('fights') ?? 'boss,elite,group,swarm,runners,mixed,night').split(',');
const PAIRS = process.argv.includes('--pairs');
const KIT = ['strongman_belt', 'energy_drink', 'foam_finger', 'extra_token', 'spinning_top'];
const NIGHT = { from: 900, to: 1050 };
const WARM = 5, SECS = 25;

interface Loadout { weapons: { id: string; level: number }[]; passives: Record<string, number> }
interface Line { useful: number; over: number; buckets: Set<number> }
interface Fight { dps: number; over: number; up: number; kills: number; hits?: number; lines: Record<string, { dps: number; up: number }> }

/** The loadout for weapon `id` at investment point `lv`. */
function loadout(id: string, lv: string, extra: { id: string; level: number }[] = []): Loadout {
  const d = WEAPONS[id];
  const kit = Object.fromEntries([...KIT, d.evoPassive!].map((k) => [k, 5]));
  switch (lv) {
    case 'L1': return { weapons: [{ id, level: 1 }, ...extra], passives: {} };
    case 'L4': return { weapons: [{ id, level: 4 }, ...extra], passives: {} };
    case 'L8': return { weapons: [{ id, level: 8 }, ...extra], passives: {} };
    case 'E1': return { weapons: [{ id: d.evolvesTo!, level: 1 }, ...extra], passives: { [d.evoPassive!]: 1 } };
    default: return { weapons: [{ id: d.evolvesTo!, level: 8 }, ...extra], passives: kit };
  }
}

function equip(g: Game, l: Loadout): void {
  g.weapons.list.length = 0;
  for (const [id, n] of Object.entries(l.passives)) for (let i = 0; i < n; i++) g.player.addPassive(id);
  g.player.hp = g.player.stats.maxHp();
  for (const w of l.weapons) {
    const inst = g.weapons.add(w.id);
    if (inst) inst.level = w.level;
  }
}

/** Useful damage, overkill and active quarter seconds per weapon line while `on()` says so; kills too. */
function meter(g: Game, on: () => boolean) {
  const lines = new Map<string, Line>();
  let kills = 0;
  const line = (k: string) => {
    let l = lines.get(k);
    if (!l) lines.set(k, (l = { useful: 0, over: 0, buckets: new Set() }));
    return l;
  };
  const dmg = g.damageEnemy.bind(g);
  g.damageEnemy = (e, amount, crit, kb, sx, sy, weapon) => {
    const before = e.alive ? Math.max(0, e.hp) : 0;
    const r = dmg(e, amount, crit, kb, sx, sy, weapon);
    if (on() && r > 0) {
      const useful = before - Math.max(0, e.alive ? e.hp : 0);
      const l = line(WEAPONS[weapon] ? lineOf(weapon) : 'other');
      l.useful += useful;
      l.over += Math.max(0, r - useful);
      if (useful > 0) l.buckets.add(Math.floor(g.realTime * 4));
      if (!e.alive) kills++;
    }
    return r;
  };
  return { lines, line, kills: () => kills };
}

function summarize(m: ReturnType<typeof meter>, secs: number, extra: Partial<Fight> = {}): Fight {
  let useful = 0, over = 0;
  const all = new Set<number>();
  const lines: Fight['lines'] = {};
  for (const [k, l] of m.lines) {
    useful += l.useful;
    over += l.over;
    for (const b of l.buckets) all.add(b);
    lines[k] = { dps: l.useful / secs, up: Math.min(1, l.buckets.size / (secs * 4)) };
  }
  return { dps: useful / secs, over: useful + over > 0 ? over / (useful + over) : 0, up: Math.min(1, all.size / (secs * 4)), kills: (m.kills() / secs) * 60, lines, ...extra };
}

/** An empty floor at 18:00: no props, slicks or arms, and nothing spawns but what the bench places. */
function floor(l: Loadout, seed: number): Game {
  const g = makeGame({ character: 'carny', seed, godMode: true });
  applyLayout({ ...CARNIVAL_LAYOUT, props: [], greaseSlicks: [], tiltAWhirl: null });
  g.nav = new Nav();
  g.director.update = () => {};
  g.events.update = () => {};
  // the loadout stays as set: no level-ups (a draft's first card could add a weapon mid-fight) and no chests
  g.addXp = () => {};
  g.openChest = () => ({ items: [], entries: [] });
  g.time = 1080;
  equip(g, l);
  return g;
}

/**
 * Point the aim at the nearest target, as a player with a mouse or a right stick does (in auto aim, a weapon that
 * fires "where you face" points where you walk, and a kiting bench pilot walks away from the crowd).
 */
function aim(g: Game): void {
  const p = g.player;
  p.aimMode = 'hybrid';
  const t = g.nearestTarget(p.x, p.y, 900);
  const inp = g.inputs[0];
  inp.aimActive = !!t;
  if (t) {
    inp.aimX = t.x - p.x;
    inp.aimY = t.y - p.y;
  }
}

/** Kite a circle of radius `r` around (cx, cy). */
function circle(g: Game, cx: number, cy: number, r: number, step = 0.35): void {
  aim(g);
  const p = g.player;
  const a = Math.atan2(p.y - cy, p.x - cx) + step;
  const tx = cx + Math.cos(a) * r - p.x, ty = cy + Math.sin(a) * r - p.y;
  const tl = Math.hypot(tx, ty) || 1;
  g.inputs[0].moveX = tx / tl;
  g.inputs[0].moveY = ty / tl;
}

/** A crowd kept topped up: `kinds` (id, count, health multiplier) spawned `near`..`far` px from the player. */
function crowd(l: Loadout, seed: number, kinds: [string, number, number][], near: number, far: number, R = 220): Fight {
  const g = floor(l, seed);
  let counting = false;
  const m = meter(g, () => counting);
  const p = g.player;
  const cx = p.x, cy = p.y;
  p.x = p.px = cx + R;
  for (let i = 0; i < (WARM + SECS) * 60; i++) {
    counting = i >= WARM * 60;
    const have = new Map<string, number>();
    for (const e of g.active) if (e.alive) have.set(e.def.id, (have.get(e.def.id) ?? 0) + 1);
    for (const [id, n, hp] of kinds) {
      for (let k = have.get(id) ?? 0; k < n; k++) {
        const a = g.rng.angle(), d = g.rng.range(near, far);
        g.spawnEnemy(id, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { exact: true, hpMult: hp });
      }
    }
    circle(g, cx, cy, R, 0.3);
    if (g.phase === 'draft') g.chooseDraft(0, 0);
    g.tick();
  }
  applyLayout(CARNIVAL_LAYOUT);
  return summarize(m, SECS);
}

/** A boss as the weapons meet one: an 80 px body that can't be burnt, chilled, slowed or shoved. */
function bossAt(l: Loadout, seed: number, R: number): Fight {
  const g = floor(l, seed);
  let counting = false;
  const per = new Map<string, number>();
  const p = g.player;
  const cx = p.x, cy = p.y;
  const part = new BossPart();
  part.uid = 1 << 30;
  part.x = cx;
  part.y = cy;
  part.r = 80;
  const buckets = new Set<number>();
  const boss = {
    def: { id: 'bench_target' }, parts: [part], removed: false, solid: false, solidR: 0, x: cx, y: cy, ringR: 0,
    takeDamage: (_: BossPart, amount: number) => amount,
    update() {},
    contactCheck() {},
  };
  g.bosses.push(boss as unknown as BossBase);
  g.bossParts.push(part);
  // the body's damage, by the weapon that dealt it
  const dt = g.damageTarget.bind(g);
  g.damageTarget = (t, amount, crit, kb, sx, sy, weapon) => {
    const d = dt(t, amount, crit, kb, sx, sy, weapon);
    if (counting && t.isBoss && d > 0) {
      const k = WEAPONS[weapon] ? lineOf(weapon) : 'other';
      per.set(k, (per.get(k) ?? 0) + d);
      buckets.add(Math.floor(g.realTime * 4));
    }
    return d;
  };
  p.x = p.px = cx + R;
  for (let i = 0; i < (WARM + SECS) * 60; i++) {
    counting = i >= WARM * 60;
    circle(g, cx, cy, R, 120 / R);
    if (g.phase === 'draft') g.chooseDraft(0, 0);
    g.tick();
  }
  applyLayout(CARNIVAL_LAYOUT);
  const total = [...per.values()].reduce((a, b) => a + b, 0);
  return { dps: total / SECS, over: 0, up: buckets.size / (SECS * 4), kills: 0, lines: Object.fromEntries([...per].map(([k, v]) => [k, { dps: v / SECS, up: 0 }])) };
}

/** A confident pilot: steps away from what's within ~150 px (harder from wind-ups and bullets), else circles. */
function pilot(g: Game): void {
  const p = g.player;
  let fx = 0, fy = 0;
  g.forEachEnemyInCircle(p.x, p.y, 150, (e) => {
    const dx = p.x - e.x, dy = p.y - e.y;
    const d2 = Math.max(400, dx * dx + dy * dy);
    const w = (e.windup > 0 || e.state === 2 ? 3 : 1) * (e.r / 12);
    fx += (dx / Math.sqrt(d2)) * (4000 / d2) * w;
    fy += (dy / Math.sqrt(d2)) * (4000 / d2) * w;
  });
  for (const b of g.bullets) {
    if (!b.alive) continue;
    const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
    if (d2 > 160 * 160) continue;
    fx += (dx / Math.sqrt(d2 + 1)) * (6000 / Math.max(300, d2));
    fy += (dy / Math.sqrt(d2 + 1)) * (6000 / Math.max(300, d2));
  }
  fx += -p.y / 6000 - p.x / 2500;
  fy += p.x / 6000 - (p.y - 300) / 2500;
  const l = Math.hypot(fx, fy) || 1;
  g.input.moveX = fx / l;
  g.input.moveY = fy / l;
  aim(g);
}

function night(l: Loadout, seed: number): Fight {
  const g = makeGame({ character: 'carny', seed, godMode: true });
  equip(g, l);
  g.time = NIGHT.from;
  g.addXp = () => {};
  g.openChest = () => ({ items: [], entries: [] });
  const m = meter(g, () => true);
  let hits = 0;
  const hurt = g.hurtPlayer.bind(g);
  g.hurtPlayer = (amount, sx, sy, o) => {
    const p = g.player;
    if (p.iframes <= 0 && p.dashT <= 0 && g.phase === 'play') hits++;
    return hurt(amount, sx, sy, o);
  };
  while (g.time < NIGHT.to && g.phase !== 'ended') {
    if (g.phase === 'draft') g.chooseDraft(0, 0);
    pilot(g);
    g.tick();
  }
  const secs = NIGHT.to - NIGHT.from;
  return summarize(m, secs, { hits: (hits / secs) * 60 });
}

const FIGHT: Record<string, (l: Loadout, seed: number) => Fight> = {
  boss: (l, s) => [150, 260].map((r) => bossAt(l, s, r)).sort((a, b) => b.dps - a.dps)[0],
  elite: (l, s) => crowd(l, s, [['carnival_brute', 1, 100]], 150, 200, 200),
  group: (l, s) => crowd(l, s, [['puppet_soldier', 12, 1]], 150, 350),
  swarm: (l, s) => crowd(l, s, [['possessed_stuffie', 120, 4]], 200, 500),
  runners: (l, s) => crowd(l, s, [['evil_clown', 40, 3]], 300, 550),
  mixed: (l, s) => crowd(l, s, [['possessed_stuffie', 50, 2], ['evil_clown', 20, 2], ['puppet_soldier', 6, 1]], 200, 500),
  night,
};

/** Average fights over the seeds (lines averaged too). */
function run(fight: string, l: Loadout): Fight {
  const rs = SEEDS.map((s) => FIGHT[fight](l, s));
  const n = rs.length;
  const lines: Fight['lines'] = {};
  for (const r of rs) for (const [k, v] of Object.entries(r.lines)) {
    lines[k] ??= { dps: 0, up: 0 };
    lines[k].dps += v.dps / n;
    lines[k].up += v.up / n;
  }
  const avg = (f: (r: Fight) => number) => rs.reduce((a, r) => a + f(r), 0) / n;
  return { dps: avg((r) => r.dps), over: avg((r) => r.over), up: avg((r) => r.up), kills: avg((r) => r.kills), hits: rs[0].hits === undefined ? undefined : avg((r) => r.hits ?? 0), lines };
}

const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0));
const out: Record<string, unknown> = { seeds: SEEDS, levels: LEVELS, fights: FIGHTS, rows: [] as unknown[] };
const rows = out.rows as unknown[];

if (!PAIRS) {
  console.log(`arsenal: seeds ${SEEDS.join(',')}; fights ${FIGHTS.join(' ')}; dps = useful damage/s (night: kills/min, hits/min)`);
  for (const id of BASE_WEAPON_IDS) {
    if (only && !only.includes(id)) continue;
    for (const lv of LEVELS) {
      if (id === 'mirror') {
        // the share of damage it adds beside Throwing Cards (Royal Flush at E1/E8)
        const ref = lv.startsWith('E') ? 'royal_flush' : 'throwing_cards';
        const refLv = lv === 'E8' ? 8 : lv === 'E1' ? 1 : Number(lv.slice(1));
        const mirror = lv.startsWith('E') ? { id: 'hall_of_mirrors', level: refLv } : { id: 'mirror', level: refLv };
        const base: Loadout = { weapons: [{ id: ref, level: refLv }], passives: lv === 'E8' ? Object.fromEntries([...KIT, 'hand_mirror'].map((k) => [k, 5])) : lv === 'E1' ? { hand_mirror: 1 } : {} };
        const withM: Loadout = { ...base, weapons: [...base.weapons, mirror] };
        const res: Record<string, Fight> = {};
        let line = `${'mirror'.padEnd(15)} ${lv}`;
        for (const f of FIGHTS) {
          const a = run(f, base), b = run(f, withM);
          res[f] = { ...b, dps: b.dps - a.dps };
          line += `  ${f} +${fmt(b.dps - a.dps)}`;
        }
        console.log(line);
        rows.push({ id, lv, fights: res });
        continue;
      }
      const l = loadout(id, lv);
      const res: Record<string, Fight> = {};
      let line = `${(lv.startsWith('E') ? WEAPONS[id].evolvesTo! : id).padEnd(18)} ${lv}`;
      for (const f of FIGHTS) {
        const r = run(f, l);
        res[f] = r;
        line += f === 'night' ? `  night ${fmt(r.kills)}k/m ${r.hits?.toFixed(0)}h/m` : `  ${f} ${fmt(r.dps)}`;
      }
      console.log(line);
      rows.push({ id, lv, fights: res });
    }
  }
} else {
  // long + short, area + single, projectile + persistent, two long, two short, mixed evolved/unevolved
  const pairs: [string, string][] = (arg('pairlist')?.split(';').map((s) => s.split('+') as [string, string])) ?? [
    ['tarot', 'orbs'], ['throwing_cards', 'orbs'], ['tarot', 'mallet'], ['throwing_cards', 'snowcone'], ['throwing_cards', 'grill'],
    ['tarot', 'bell'], ['steam_whistle', 'tarot'], ['throwing_cards', 'cotton'], ['tarot', 'lantern'], ['tarot', 'throwing_cards'],
    ['mallet', 'orbs'], ['grill', 'snowcone'], ['steam_whistle', 'orbs'], ['lantern', 'orbs'],
  ];
  const pf = FIGHTS.filter((f) => f === 'swarm' || f === 'night' || f === 'boss' || f === 'mixed');
  console.log(`pairs: seeds ${SEEDS.join(',')}; fights ${pf.join(' ')}; B's share of the pair's useful damage, B beside A / B alone, and adding B to A`);
  for (const [a, b] of pairs) {
    for (const lv of LEVELS.filter((x) => x === 'L8' || x === 'E8')) {
      const la = loadout(a, lv), lb = loadout(b, lv);
      const both: Loadout = { weapons: [...la.weapons, ...lb.weapons], passives: { ...la.passives, ...lb.passives } };
      const res: Record<string, unknown> = {};
      let line = `${a}+${b}`.padEnd(28) + ` ${lv}`;
      for (const f of pf) {
        const ra = run(f, la), rb = run(f, lb), rab = run(f, both);
        const shareB = rab.dps > 0 ? (rab.lines[b]?.dps ?? 0) / rab.dps : 0;
        const keepB = rb.dps > 0 ? (rab.lines[b]?.dps ?? 0) / rb.dps : 0;
        res[f] = { a: ra, b: rb, ab: rab, shareB, keepB };
        line += f === 'night'
          ? `  night B ${(shareB * 100).toFixed(0)}% kills ${fmt(ra.kills)}->${fmt(rab.kills)} hits ${ra.hits?.toFixed(0)}->${rab.hits?.toFixed(0)}`
          : `  ${f} B ${(shareB * 100).toFixed(0)}% keeps ${(keepB * 100).toFixed(0)}% total ${fmt(ra.dps)}->${fmt(rab.dps)}`;
      }
      console.log(line);
      rows.push({ a, b, lv, fights: res });
    }
  }
}
if (outPath) writeFileSync(outPath, JSON.stringify(out, null, 1));
