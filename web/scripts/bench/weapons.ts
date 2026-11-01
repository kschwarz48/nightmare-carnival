// Weapon audit (D-74): every weapon's real damage output, measured the same way. One weapon at a time,
// held by the same character (the Carny: no damage quirk), in three fights:
//
//   • horde — an open floor kept at 120 Possessed Stuffies (4x their 18:00 health), each one killed
//             replaced at once somewhere 200-500 px out, the player kiting a circle: how much crowd the
//             weapon can process (useful damage per second; a stronger weapon never runs out of targets);
//   • night — the Carnival Core's own crowd from 15:00 to 17:30 (the real director and waves, the real
//             map and its walls), a pilot that holds its ground until the crowd is ~150 px away (a
//             confident player, so close-range weapons get their chance) in god mode. No level-ups or
//             chests, so the loadout stays as set. Reports kills per minute and the hits the pilot
//             would have taken per minute (what knockback, slows and reach save you) — its damage is
//             capped by how fast the director feeds the crowd in, so it ranks safety, not power;
//   • tank  — a boss's body (80 px, endless health, never burnt, chilled, slowed or shoved) standing on an
//             empty floor, the player circle-strafing it at 150, 220 or 300 px, whichever suits the weapon
//             best: single-target damage per second.
//
// Useful damage only (overkill is not counted). Three loadouts: the base weapon at Lv 8 with no charms;
// the evolution at Evo Lv 1 with its own charm at Lv 1 (the moment it evolves); and the evolution at
// Evo Lv 8 with a full late kit — Strongman Belt, Energy Drink, Foam Finger, Extra Token and Spinning
// Top at Lv 5, plus its own charm at Lv 5.
//
//   npx vite-node scripts/bench/weapons.ts [out.json] [--only=id,id] [--seeds=2]
//
// The Funhouse Mirror only replays your other weapons, so it is measured beside Throwing Cards (Lv 8;
// Royal Flush with the kit for the Hall of Mirrors) and reported as the share of damage it adds.
import { writeFileSync } from 'node:fs';
import { makeGame } from '../../tests/helpers';
import { CARNIVAL_LAYOUT, applyLayout } from '../../src/data/map';
import { WEAPONS, BASE_WEAPON_IDS } from '../../src/data/weapons';
import { Nav } from '../../src/sim/nav';
import { BossPart } from '../../src/sim/entities';
import type { BossBase } from '../../src/sim/bosses/boss';
import type { Game } from '../../src/sim/game';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const only = arg('only')?.split(',');
const SEEDS = [7, 31, 59].slice(0, Number(arg('seeds') ?? 1));
const outPath = process.argv.slice(2).find((a) => a.endsWith('.json'));
const KIT = ['strongman_belt', 'energy_drink', 'foam_finger', 'extra_token', 'spinning_top'];
const NIGHT = { from: 900, to: 1050 };
const TANK = { warm: 6, seconds: 30 };
const HORDE = { warm: 6, seconds: 30 };

interface Loadout { weapon: string; level: number; passives: Record<string, number>; extra?: string }
interface Result { dps: number; kills: number; hits: number }

/** An empty floor at 18:00: no props, slicks or arms, and nothing spawns but what the bench places. */
function floor(l: Loadout, seed: number): Game {
  const g = makeGame({ character: 'carny', seed, godMode: true });
  applyLayout({ ...CARNIVAL_LAYOUT, props: [], greaseSlicks: [], tiltAWhirl: null });
  g.nav = new Nav();
  g.director.update = () => {};
  g.events.update = () => {};
  g.time = 1080;
  equip(g, l);
  return g;
}

/** Kite a circle of radius `r` around (cx, cy). */
function circle(g: Game, cx: number, cy: number, r: number, step = 0.35): void {
  const p = g.player;
  const a = Math.atan2(p.y - cy, p.x - cx) + step;
  const tx = cx + Math.cos(a) * r - p.x, ty = cy + Math.sin(a) * r - p.y;
  const tl = Math.hypot(tx, ty) || 1;
  g.inputs[0].moveX = tx / tl;
  g.inputs[0].moveY = ty / tl;
}

function horde(l: Loadout, seed: number): number {
  const g = floor(l, seed);
  let counting = false;
  const m = meter(g, () => counting);
  const p = g.player;
  const cx = p.x, cy = p.y;
  p.x = p.px = cx + 220;
  for (let i = 0; i < (HORDE.warm + HORDE.seconds) * 60; i++) {
    counting = i >= HORDE.warm * 60;
    let alive = 0;
    for (const e of g.active) if (e.alive) alive++;
    for (let k = alive; k < 120; k++) {
      const a = g.rng.angle(), d = g.rng.range(200, 500);
      g.spawnEnemy('possessed_stuffie', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, { exact: true, hpMult: 4 });
    }
    circle(g, cx, cy, 220, 0.3);
    if (g.phase === 'draft') g.chooseDraft(0, 0);
    g.tick();
  }
  applyLayout(CARNIVAL_LAYOUT);
  return m.useful / HORDE.seconds;
}

function equip(g: Game, l: Loadout): void {
  g.weapons.list.length = 0;
  for (const [id, n] of Object.entries(l.passives)) for (let i = 0; i < n; i++) g.player.addPassive(id);
  g.player.hp = g.player.stats.maxHp();
  for (const id of [l.weapon, l.extra].filter(Boolean) as string[]) g.weapons.add(id)!.level = id === l.weapon ? l.level : 8;
}

/** Count useful damage (no overkill) while `on()` says so. */
function meter(g: Game, on: () => boolean): { useful: number } {
  const m = { useful: 0 };
  const dmg = g.damageEnemy.bind(g);
  g.damageEnemy = (e, amount, crit, kb, sx, sy, weapon) => {
    const before = e.alive ? Math.max(0, e.hp) : 0;
    const r = dmg(e, amount, crit, kb, sx, sy, weapon);
    if (on() && !e.isBoss) m.useful += before - Math.max(0, e.alive ? e.hp : 0);
    return r;
  };
  return m;
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
  // a slow circle about the plaza, off the fences
  fx += -p.y / 6000 - p.x / 2500;
  fy += p.x / 6000 - (p.y - 300) / 2500;
  const l = Math.hypot(fx, fy) || 1;
  g.input.moveX = fx / l;
  g.input.moveY = fy / l;
}

function night(l: Loadout, seed: number): Result {
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
  const k0 = g.kills;
  while (g.time < NIGHT.to && g.phase !== 'ended') {
    if (g.phase === 'draft') g.chooseDraft(0, 0);
    pilot(g);
    g.tick();
  }
  const mins = (NIGHT.to - NIGHT.from) / 60;
  return { dps: m.useful / (NIGHT.to - NIGHT.from), kills: (g.kills - k0) / mins, hits: hits / mins };
}

function tank(l: Loadout, seed: number): number {
  return Math.max(...[150, 220, 300].map((r) => tankAt(l, seed, r)));
}

/** A boss as the weapons meet one: an 80 px body that can't be burnt, chilled, slowed or shoved. */
function tankAt(l: Loadout, seed: number, R: number): number {
  const g = floor(l, seed);
  let counting = false, dealt = 0;
  const p = g.player;
  const cx = p.x, cy = p.y;
  const part = new BossPart();
  part.uid = 1 << 30;
  part.x = cx;
  part.y = cy;
  part.r = 80;
  const boss = {
    def: { id: 'bench_target' }, parts: [part], removed: false, solid: false, solidR: 0, x: cx, y: cy, ringR: 0,
    takeDamage: (_: BossPart, amount: number) => {
      if (counting) dealt += amount;
      return amount;
    },
    update() {},
    contactCheck() {},
  };
  g.bosses.push(boss as unknown as BossBase);
  g.bossParts.push(part);
  p.x = p.px = cx + R;
  for (let i = 0; i < (TANK.warm + TANK.seconds) * 60; i++) {
    counting = i >= TANK.warm * 60;
    circle(g, cx, cy, R, 120 / R);
    if (g.phase === 'draft') g.chooseDraft(0, 0);
    g.tick();
  }
  applyLayout(CARNIVAL_LAYOUT); // the next night needs its floor back (useMap skips a map already active)
  return dealt / TANK.seconds;
}

const avg = (f: (seed: number) => number) => SEEDS.reduce((a, s) => a + f(s), 0) / SEEDS.length;
function measure(l: Loadout) {
  const n = SEEDS.map((s) => night(l, s));
  return { horde: avg((s) => horde(l, s)), tank: avg((s) => tank(l, s)), kills: n.reduce((a, r) => a + r.kills, 0) / n.length, hits: n.reduce((a, r) => a + r.hits, 0) / n.length };
}

const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0));
const cell = (r: ReturnType<typeof measure>) => `${fmt(r.horde).padStart(6)} ${fmt(r.tank).padStart(6)} ${fmt(r.kills).padStart(4)} ${r.hits.toFixed(0).padStart(3)}`;
const rows: Record<string, unknown>[] = [];
console.log(`weapon audit: night ${NIGHT.from / 60}:00-${(NIGHT.to / 60).toFixed(1)} min, tank ${TANK.seconds}s; seeds ${SEEDS.join(',')}`);
console.log('columns per loadout: horde dps · tank dps · night kills/min · night hits taken/min');
console.log('weapon'.padEnd(18), 'base Lv 8'.padEnd(24), '|', 'evolution'.padEnd(20), 'Evo Lv 1'.padEnd(24), '|', 'Evo Lv 8 + kit');
for (const id of BASE_WEAPON_IDS) {
  if (only && !only.includes(id)) continue;
  const evo = WEAPONS[id].evolvesTo!;
  const own = WEAPONS[id].evoPassive!;
  const kit = Object.fromEntries([...KIT, own].map((k) => [k, 5]));
  if (id === 'mirror') {
    const share = (a: ReturnType<typeof measure>, b: ReturnType<typeof measure>) => ({ dps: a.horde / b.horde - 1, tank: a.tank / b.tank - 1 });
    const ref = measure({ weapon: 'throwing_cards', level: 8, passives: {} });
    const refKit = measure({ weapon: 'royal_flush', level: 8, passives: kit });
    const b = share(measure({ weapon: 'throwing_cards', level: 8, passives: {}, extra: 'mirror' }), ref);
    const e8 = share(measure({ weapon: 'royal_flush', level: 8, passives: kit, extra: 'hall_of_mirrors' }), refKit);
    const pc = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;
    console.log('mirror (adds)'.padEnd(18), `${pc(b.dps).padStart(6)} horde ${pc(b.tank).padStart(5)} tank`.padEnd(24), '|', evo.padEnd(20), ''.padEnd(24), '|', `${pc(e8.dps)} horde ${pc(e8.tank)} tank`);
    rows.push({ id, evo, mirrorShare: { base: b, evo8: e8 } });
    continue;
  }
  const b8 = measure({ weapon: id, level: 8, passives: {} });
  const e1 = measure({ weapon: evo, level: 1, passives: { [own]: 1 } });
  const e8 = measure({ weapon: evo, level: 8, passives: kit });
  console.log(id.padEnd(18), cell(b8).padEnd(24), '|', evo.padEnd(20), cell(e1).padEnd(24), '|', cell(e8));
  rows.push({ id, evo, base8: b8, evo1: e1, evo8kit: e8 });
}
if (outPath) writeFileSync(outPath, JSON.stringify({ night: NIGHT, tank: TANK, seeds: SEEDS, rows }, null, 2));
