import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { BOSSES } from '../src/data/bosses';
import type { Game } from '../src/sim/game';
import type { BossBase } from '../src/sim/bosses/boss';

function tickN(g: Game, n: number): void {
  for (let i = 0; i < n; i++) {
    if (g.phase === 'draft') g.chooseDraft(0);
    g.tick();
  }
}

function hitBoss(g: Game, b: BossBase, frac: number, stopAtPhase = 99): void {
  // keep damaging until hp ≤ frac × max (respecting transition invulnerability)
  let guard = 0;
  while (b.hp > b.maxHp * frac && !b.dead && b.phase < stopAtPhase && guard++ < 6000) {
    const parts = b.parts.filter((p) => p.alive && !p.invuln);
    for (const p of parts) g.damageTarget(p, b.maxHp * 0.01, false, 0, 0, 0, 'test');
    g.tick();
  }
}

describe('bosses', () => {
  for (const def of BOSSES) {
    it(`${def.name}: warns, wakes, reaches every phase, and pays out on defeat`, () => {
      const g = makeGame({ godMode: true });
      g.weapons.list.length = 0;
      const warnings: string[] = [];
      const phases: number[] = [];
      g.bus.on('boss_warning', (e) => warnings.push(e.id));
      g.bus.on('boss_phase', (e) => e.id === def.id && phases.push(e.phase));
      // clear earlier bosses so the gate isn't held (D-24)
      for (const b of g.bosses) if (b.def.id !== def.id) { b.dead = true; b.removed = true; }
      g.bosses = g.bosses.filter((b) => !b.removed);
      for (const other of BOSSES) if (other.gate < def.gate) g.director['spawned'].add(other.id), g.director['warned'].add(other.id);
      g.time = def.gate - 5;
      tickN(g, 60 * 12);
      expect(warnings).toContain(def.id);
      const b = g.bosses.find((x) => x.def.id === def.id)!;
      expect(b).toBeTruthy();
      expect(b.awake).toBe(true);
      expect(b.introDone).toBe(true);
      // let it attack a while: hazards/bullets must appear (telegraphs exist)
      let sawThreat = false;
      for (let i = 0; i < 60 * 10; i++) {
        g.tick();
        if (g.hazards.some((h) => h.alive && h.owner === b.uid) || g.bullets.some((x) => x.alive)) sawThreat = true;
      }
      expect(sawThreat).toBe(true);
      for (let ph = 1; ph < def.phases.length; ph++) {
        hitBoss(g, b, 0, ph);
        expect(b.phase).toBe(ph);
        tickN(g, 60 * 3);
        // Puppet King P2: body is invulnerable until the strings are cut
        if (def.id === 'puppet_king' && b.phase === 1) {
          const pk = b as any;
          expect(pk.strings.length).toBe(4);
          for (const s of [...pk.strings]) g.damageTarget(s, 1e9, false, 0, 0, 0, 'test');
          expect(pk.staggerT).toBeGreaterThan(0);
        }
      }
      expect(phases).toEqual(def.phases.slice(1).map((_, i) => i + 1));
      const chests0 = g.pickups.filter((p) => p.alive && p.kind === 'chest').length;
      hitBoss(g, b, 0);
      tickN(g, 60 * 4);
      expect(b.dead).toBe(true);
      expect(g.bossIds).toContain(def.id);
      expect(g.pickups.filter((p) => p.alive && p.kind === 'chest').length).toBeGreaterThan(chests0);
      expect(g.hazards.filter((h) => h.alive && h.owner === b.uid).length).toBe(0);
    });
  }

  it('soft enrage (Encore) kicks in past the timer', () => {
    const g = makeGame({ godMode: true });
    g.time = 355;
    tickN(g, 60 * 8);
    const b = g.bosses.find((x) => x.def.id === 'carnival_tent')!;
    expect(b.awake).toBe(true);
    b.fightT = b.enrageT + 1;
    g.tick();
    expect(b.enraged).toBe(true);
  });

  it('bosses never stack: the Ferris Wheel waits for the Tent (D-24)', () => {
    const g = makeGame({ godMode: true });
    g.weapons.list.length = 0;
    g.time = 355;
    tickN(g, 60 * 8);
    g.time = 725;
    tickN(g, 60 * 5);
    const fw = g.bosses.find((x) => x.def.id === 'ferris_wheel')!;
    expect(fw.awake).toBe(false);
    const tent = g.bosses.find((x) => x.def.id === 'carnival_tent')!;
    hitBoss(g, tent, 0);
    tickN(g, 60 * 10);
    expect(fw.awake).toBe(true);
  });

  it('the Ringmaster holds back the dawn; his defeat → victory lap → dawn → win (D-01)', () => {
    const g = makeGame({ godMode: true });
    g.weapons.list.length = 0;
    for (const b of g.bosses) { b.dead = true; b.removed = true; }
    g.bosses = [];
    for (const id of ['carnival_tent', 'ferris_wheel', 'puppet_king']) g.director['spawned'].add(id), g.director['warned'].add(id);
    g.time = 1436;
    tickN(g, 60 * 10);
    const rm = g.bosses.find((x) => x.def.id === 'ringmaster')!;
    expect(rm.awake).toBe(true);
    g.time = 1498;
    tickN(g, 60 * 5);
    expect(g.stalled).toBe(true);
    expect(g.time).toBeLessThan(1500);
    expect(g.phase).toBe('play');
    hitBoss(g, rm, 0);
    tickN(g, 60 * 4);
    expect(g.ringmasterDefeated).toBe(true);
    tickN(g, 60 * 10);
    expect(g.phase).toBe('ended');
    expect(g.endStats?.won).toBe(true);
    expect(g.endStats?.achievementsHit).toContain('beat_ringmaster');
  });

  it('Endless / Lock-In continues past dawn and summons an Encore Ringmaster', () => {
    const g = makeGame({ godMode: true });
    for (const b of g.bosses) { b.dead = true; b.removed = true; }
    g.bosses = [];
    g.time = 1500;
    g.ringmasterDefeated = true;
    g.endRun(true);
    const banked = g.endStats!.lostTickets;
    expect(banked).toBeGreaterThan(0);
    g.startEndless();
    expect(g.endless).toBe(true);
    tickN(g, 60 * 302);
    expect(g.time).toBeGreaterThan(1790);
    expect(g.bosses.some((b) => b.encore)).toBe(true);
    g.endRun(false);
    expect(g.endStats!.endless).toBe(true);
    expect(g.endStats!.lostTickets).toBeGreaterThanOrEqual(0);
  });
});
