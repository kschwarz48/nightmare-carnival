// The Fun House's bosses (D-63): each warns, wakes, attacks with telegraphs, reaches every phase and pays
// out; the Proprietor holds the dawn like the Ringmaster; the secret boss runs its three phases; and a
// whole accelerated night on the map plays out.

import { describe, expect, it } from 'vitest';
import { makeGame, runFor, smartDraft, smartPilot } from './helpers';
import { FUNHOUSE_BOSSES, UNREFLECTED_DEF } from '../src/data/bosses';
import { createBoss } from '../src/sim/bosses';
import type { Game } from '../src/sim/game';
import type { BossBase } from '../src/sim/bosses/boss';
import type { LookingGlassBoss } from '../src/sim/bosses/lookingGlass';
import type { TwinsBoss } from '../src/sim/bosses/twins';
import { PLAYER_BOUNDS } from '../src/data/map';

const fh = (o: Parameters<typeof makeGame>[0] = {}) => makeGame({ map: 'fun_house', godMode: true, seed: 5, ...o });

function tickN(g: Game, n: number): void {
  for (let i = 0; i < n; i++) {
    if (g.phase === 'draft') g.chooseDraft(0);
    g.tick();
  }
}

function hitBoss(g: Game, b: BossBase, frac: number, stopAtPhase = 99): void {
  let guard = 0;
  while (b.hp > b.maxHp * frac && !b.dead && b.phase < stopAtPhase && guard++ < 6000) {
    // the body only: a reflection struck shatters, it doesn't hurt the glass
    for (const p of b.parts.filter((q) => q.alive && !q.invuln && q.kind === 'body')) g.damageTarget(p, b.maxHp * 0.01, false, 0, 0, 0, 'test');
    g.tick();
  }
}

const inside = (x: number, y: number) => x >= PLAYER_BOUNDS.minX && x <= PLAYER_BOUNDS.maxX && y >= PLAYER_BOUNDS.minY && y <= PLAYER_BOUNDS.maxY;

describe('the Fun House bosses (D-63)', () => {
  for (const def of FUNHOUSE_BOSSES) {
    it(`${def.name}: warns, wakes near the party, telegraphs, reaches every phase, pays out`, () => {
      const g = fh();
      g.weapons.list.length = 0;
      const warnings: string[] = [];
      const phases: number[] = [];
      g.bus.on('boss_warning', (e) => warnings.push(e.id));
      g.bus.on('boss_phase', (e) => e.id === def.id && phases.push(e.phase));
      for (const other of FUNHOUSE_BOSSES) if (other.gate < def.gate) g.director['spawned'].add(other.id), g.director['warned'].add(other.id);
      g.time = def.gate - 5;
      tickN(g, 60 * 12);
      expect(warnings).toContain(def.id);
      const b = g.bosses.find((x) => x.def.id === def.id)!;
      expect(b).toBeTruthy();
      expect(b.awake && b.introDone).toBe(true);
      expect(inside(b.x, b.y)).toBe(true);
      let tele = false, threat = false;
      for (let i = 0; i < 60 * 12; i++) {
        g.tick();
        if (g.hazards.some((h) => h.alive && h.owner === b.uid && h.tele > 0)) tele = true;
        if (g.hazards.some((h) => h.alive && h.owner === b.uid) || g.bullets.some((x) => x.alive)) threat = true;
        expect(inside(b.x, b.y)).toBe(true);
      }
      expect(threat).toBe(true);
      expect(tele).toBe(true);
      for (let ph = 1; ph < def.phases.length; ph++) {
        hitBoss(g, b, 0, ph);
        expect(b.phase).toBe(ph);
        tickN(g, 60 * 6);
        if (def.id === 'looking_glass' && ph === 1) expect((b as LookingGlassBoss).decoys.length).toBe(2);
        if (def.id === 'crooked_twins' && ph === 2) expect((b as TwinsBoss).alone).toBe(true);
      }
      expect(phases).toEqual(def.phases.slice(1).map((_, i) => i + 1));
      // the reward chest: still on the floor, or already opened (a leap can end the fight on top of you)
      let opened = 0;
      g.bus.on('chest', (e) => e.src === 'boss' && opened++);
      hitBoss(g, b, 0);
      tickN(g, 60 * 5);
      expect(b.dead).toBe(true);
      expect(g.bossIds).toContain(def.id);
      expect(g.achievementsHit.has(`beat_${def.id}`)).toBe(true);
      if (def.id !== 'proprietor') expect(opened + g.pickups.filter((p) => p.alive && p.kind === 'chest' && p.src === 'boss').length).toBeGreaterThan(0);
      expect(g.hazards.filter((h) => h.alive && h.owner === b.uid).length).toBe(0);
    });
  }

  it('the Looking Glass\'s reflections shatter when struck instead of hurting it', () => {
    const g = fh();
    g.weapons.list.length = 0;
    const b = createBoss(g, FUNHOUSE_BOSSES[1], { immediate: true, noChest: true }) as LookingGlassBoss;
    g.bosses.push(b);
    tickN(g, 60 * 3);
    hitBoss(g, b, 0, 1);
    tickN(g, 60 * 2);
    expect(b.decoys.length).toBe(2);
    const hp = b.hp;
    const d = b.decoys[0];
    g.damageTarget(d, 1e9, false, 0, 0, 0, 'test');
    expect(b.decoys.length).toBe(1);
    expect(b.hp).toBe(hp);
  });

  it("the Looking Glass's swap survives its reflections all shattering during the wind-up", () => {
    const g = fh();
    g.weapons.list.length = 0;
    const b = createBoss(g, FUNHOUSE_BOSSES[1], { immediate: true, noChest: true }) as LookingGlassBoss;
    g.bosses.push(b);
    tickN(g, 60 * 3);
    hitBoss(g, b, 0, 1);
    tickN(g, 60 * 2);
    expect(b.decoys.length).toBe(2);
    const co = b as unknown as { co: { start(c: unknown): void }; swap(): unknown; busy: boolean };
    co.busy = true;
    co.co.start(co.swap());
    tickN(g, 6);
    for (const d of b.decoys.slice()) g.damageTarget(d, 1e9, false, 0, 0, 0, 'test');
    expect(b.decoys.length).toBe(0);
    expect(() => tickN(g, 60)).not.toThrow();
  });

  it('every Fun House boss fights a bot with a real loadout without faults', () => {
    for (const def of [...FUNHOUSE_BOSSES, UNREFLECTED_DEF]) {
      const g = fh({ seed: 77 });
      for (const id of ['orbs', 'laser', 'bell', 'mirror']) {
        g.weapons.add(id);
        for (let k = 0; k < 7; k++) g.weapons.levelUp(id);
      }
      const b = createBoss(g, def, { immediate: true, noChest: true });
      g.bosses.push(b);
      const hp0 = b.hp;
      for (let i = 0; i < 60 * 90 && !b.removed; i++) {
        smartDraft(g);
        if (g.phase === 'draft') g.chooseDraft(0);
        smartPilot(g);
        g.tick();
      }
      expect(b.hp).toBeLessThan(hp0);
    }
  });

  it('the Proprietor holds the dawn; his defeat ends the night in a win', () => {
    const g = fh();
    g.weapons.list.length = 0;
    for (const id of ['crooked_twins', 'looking_glass', 'stringmistress']) g.director['spawned'].add(id), g.director['warned'].add(id);
    g.time = 1436;
    tickN(g, 60 * 10);
    const pr = g.bosses.find((x) => x.def.id === 'proprietor')!;
    expect(pr.awake).toBe(true);
    g.time = 1498;
    tickN(g, 60 * 5);
    expect(g.stalled).toBe(true);
    expect(g.time).toBeLessThan(1500);
    hitBoss(g, pr, 0);
    tickN(g, 60 * 4);
    expect(g.ringmasterDefeated).toBe(true);
    tickN(g, 60 * 12);
    expect(g.phase).toBe('ended');
    expect(g.endStats?.won).toBe(true);
    expect(g.endStats?.achievementsHit).toContain('beat_proprietor');
  });

  it('the Unreflected (secret) attacks, reaches all three phases and dies cleanly', () => {
    const g = fh();
    g.weapons.list.length = 0;
    const b = createBoss(g, UNREFLECTED_DEF, { immediate: true, noChest: true });
    g.bosses.push(b);
    const phases: number[] = [];
    g.bus.on('boss_phase', (e) => e.id === 'unreflected' && phases.push(e.phase));
    tickN(g, 60 * 4);
    expect(b.introDone).toBe(true);
    let threat = false;
    for (let i = 0; i < 60 * 8; i++) {
      g.tick();
      if (g.hazards.some((h) => h.alive && h.owner === b.uid) || g.bullets.some((x) => x.alive)) threat = true;
    }
    expect(threat).toBe(true);
    hitBoss(g, b, 0, 1);
    tickN(g, 60 * 4);
    hitBoss(g, b, 0, 2);
    tickN(g, 60 * 6);
    expect(phases).toEqual([1, 2]);
    hitBoss(g, b, 0);
    tickN(g, 60 * 5);
    expect(b.dead && b.removed).toBe(true);
  });
});

describe('a whole night in the Fun House (god mode, accelerated)', () => {
  it('meets all four bosses in order and reaches dawn', () => {
    const g = fh({ seed: 909 });
    const log: string[] = [];
    g.bus.on('boss_spawn', (e) => log.push(`${g.time.toFixed(0)} spawn ${e.id} lvl ${g.level}`));
    g.bus.on('boss_defeated', (e) => log.push(`${g.time.toFixed(0)} defeated ${e.id}`));
    g.bus.on('dawn', () => log.push(`${g.time.toFixed(0)} dawn`));
    let maxAlive = 0;
    for (let s = 0; s < 2600 && g.phase !== 'ended'; s++) {
      runFor(g, 1);
      maxAlive = Math.max(maxAlive, g.active.length);
    }
    console.log(log.join('\n'), '\nlevel', g.level, 'kills', g.kills, 'maxAlive', maxAlive);
    expect(g.bossIds).toEqual(['crooked_twins', 'looking_glass', 'stringmistress', 'proprietor']);
    expect(g.phase).toBe('ended');
    expect(g.endStats?.won).toBe(true);
    expect(g.kills).toBeGreaterThan(1500);
  });
});
