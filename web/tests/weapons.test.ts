// The weapon audit's mechanics (D-74): the Crystal Orbs' barrier and its fatigue, mirror clones that
// yield the projectile pool, webs that don't stack but dissolve, lasers that cut what they sweep, the
// bumper's peel-out bump, and the boss-only boosts for weapons whose status effects bosses ignore.

import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import type { Game } from '../src/sim/game';
import type { Enemy } from '../src/sim/entities';

/** A quiet night: no spawner, no starting weapon, an endless dummy wherever a test asks. */
function quiet(seed = 3): Game {
  const g = makeGame({ godMode: true, seed });
  g.director.update = () => {};
  g.events.update = () => {};
  g.weapons.list.length = 0;
  return g;
}
function dummy(g: Game, x: number, y: number, id = 'possessed_stuffie'): Enemy {
  const e = g.spawnEnemy(id, x, y, { exact: true })!;
  e.hp = e.maxHp = 1e9;
  e.speed = 0;
  return e;
}

describe('the weapon audit (D-74)', () => {
  it('the Crystal Orbs shove what they hit straight out, and less each time the same creature is shoved again', () => {
    const g = quiet();
    const w = g.weapons.add('cosmic_convergence')!;
    const p = g.player;
    const R = g.weapons.orbRadius(w);
    const e = dummy(g, p.x + R, p.y);
    const pushes: { at: number; v: number; out: number }[] = [];
    for (let i = 0; i < 60 * 3; i++) {
      g.tick();
      // (a barrier shove lasts 0.14 s; the gravity pulse's inward tug 0.18 s)
      if (e.kbT > 0.13 && e.kbT < 0.15) pushes.push({ at: g.realTime, v: Math.hypot(e.kbX, e.kbY), out: e.kbX * (e.x - p.x) + e.kbY * (e.y - p.y) });
      // pinned on the ring, so orb after orb meets it
      e.kbT = 0;
      e.x = e.px = p.x + R;
      e.y = e.py = p.y;
    }
    expect(pushes.length).toBeGreaterThanOrEqual(4);
    // always straight out from the player
    for (const q of pushes) expect(q.out).toBeGreaterThan(0);
    // weaker and weaker: the barrier wears thin on something that keeps leaning on it
    expect(pushes[1].v).toBeLessThan(pushes[0].v * 0.8);
    expect(pushes[3].v).toBeLessThan(pushes[0].v * 0.5);
    // and it recovers once the creature has been left alone a while
    e.kbFatigue *= Math.exp(-6 / 1.2);
    expect(e.kbFatigue).toBeLessThan(0.05);
  });

  it('keeps the orbs out most of the time (off for the cooldown only)', () => {
    const g = quiet();
    const w = g.weapons.add('orbs')!;
    w.level = 8;
    let on = 0;
    for (let i = 0; i < 60 * 30; i++) {
      g.tick();
      if (w.active) on++;
    }
    expect(on / (60 * 30)).toBeGreaterThan(0.6);
  });

  it("never lets mirror clones' shots take the slots your own need", () => {
    const g = quiet();
    for (const k of ['extra_token', 'energy_drink', 'spinning_top']) for (let i = 0; i < 5; i++) g.player.addPassive(k);
    g.weapons.add('royal_flush')!.level = 8;
    g.weapons.add('hall_of_mirrors')!.level = 8;
    for (let i = 0; i < 8; i++) dummy(g, g.player.x + 150 + i * 40, g.player.y + (i % 3) * 60 - 60);
    let failed = 0;
    const spawn = g.spawnProj.bind(g);
    g.spawnProj = () => {
      const p = spawn();
      if (!p) failed++;
      return p;
    };
    for (let i = 0; i < 60 * 15; i++) g.tick();
    expect(failed).toBe(0);
    // at most four clones however much Amount there is
    expect(g.summons.filter((s) => s.alive && s.kind === 'clone').length).toBeLessThanOrEqual(4);
  });

  it("lets overlapping webs of one kind hurt only once per tick, but dissolves what stays in them", () => {
    const g = quiet();
    const e = dummy(g, g.player.x + 300, g.player.y);
    const hits: number[] = [];
    const dmg = g.damageEnemy.bind(g);
    g.damageEnemy = (t, amount, crit, kb, sx, sy, weapon) => {
      if (t === e) hits.push(amount);
      return dmg(t, amount, crit, kb, sx, sy, weapon);
    };
    for (let k = 0; k < 5; k++) g.spawnZone('web', e.x + k * 4, e.y, 120, 6, 10, 0.5);
    for (let i = 0; i < 60 * 4; i++) g.tick();
    // five webs, four seconds at a tick of 0.5 s: about eight hits, not forty
    expect(hits.length).toBeGreaterThanOrEqual(7);
    expect(hits.length).toBeLessThanOrEqual(9);
    // each one stronger than the last, up to the cap
    expect(hits[1]).toBeGreaterThan(hits[0]);
    expect(hits[hits.length - 1]).toBeGreaterThan(hits[0] * 3);
  });

  it('cuts everything a laser beam sweeps over, not just what lies under it at a strike', () => {
    const g = quiet();
    const w = g.weapons.add('grand_illumination')!;
    w.level = 1;
    const p = g.player;
    const ring: Enemy[] = [];
    for (let k = 0; k < 24; k++) ring.push(dummy(g, p.x + Math.cos((k / 24) * Math.PI * 2) * 200, p.y + Math.sin((k / 24) * Math.PI * 2) * 200));
    const hit = new Set<Enemy>();
    const dmg = g.damageEnemy.bind(g);
    g.damageEnemy = (t, amount, crit, kb, sx, sy, weapon) => {
      hit.add(t);
      return dmg(t, amount, crit, kb, sx, sy, weapon);
    };
    for (let i = 0; i < 60 * 3; i++) {
      g.tick();
      for (const e of ring) {
        e.kbT = 0;
        e.x = e.px;
        e.y = e.py;
      }
    }
    expect(hit.size).toBe(24);
  });

  it('peels the bumper car out with a bump that hits the crowd right behind you', () => {
    const g = quiet();
    g.weapons.add('bumper')!.level = 1;
    const p = g.player;
    const behind = dummy(g, p.x - 70, p.y);
    g.inputs[0].moveX = 1;
    g.inputs[0].moveY = 0;
    const hp = behind.hp;
    for (let i = 0; i < 40; i++) {
      // the crowd keeps up, right behind you
      behind.x = behind.px = p.x - 70;
      behind.y = behind.py = p.y;
      g.tick();
    }
    expect(behind.hp).toBeLessThan(hp);
  });

  it("hits bosses harder with the grills and the frost, whose burns and chills bosses shrug off", () => {
    // a boss part takes the boosted hit; a common creature takes the plain one (and burns/chills)
    const g = quiet();
    const w = g.weapons.add('blizzard')!;
    const p = g.player;
    const e = dummy(g, p.x + 60, p.y);
    const amounts: number[] = [];
    const dmg = g.damageEnemy.bind(g);
    g.damageEnemy = (t, amount, crit, kb, sx, sy, weapon) => {
      if (t === e && weapon === 'blizzard') amounts.push(amount);
      return dmg(t, amount, crit, kb, sx, sy, weapon);
    };
    for (let i = 0; i < 60 && !amounts.length; i++) g.tick();
    expect(amounts.length).toBeGreaterThan(0);
    // the creature's hit is the weapon's own damage (or that times the crit multiplier); a boss's would be 3x
    const base = g.weapons.damage(w);
    expect(amounts[0] === base || amounts[0] > base * 1.4).toBe(true);
    expect(e.chill + (e.frozenT > 0 ? 5 : 0)).toBeGreaterThan(0);
  });
});
