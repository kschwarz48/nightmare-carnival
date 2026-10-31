// The Boardwalk's bosses (D-68): each warns, wakes near the party inside a stage drawn round everyone,
// telegraphs, reaches every phase and pays out; land bosses keep out of deep water; the Last Ride's cars
// ride its path; the Captain's ship keeps to the sea; the Leviathan's tentacles can be cut and it holds
// the dawn; the Commodore (secret) runs its three phases; and every one fights a bot without faults.

import { describe, expect, it } from 'vitest';
import { makeGame, smartDraft, smartPilot } from './helpers';
import { BOARDWALK_BOSSES, COMMODORE_DEF } from '../src/data/bosses';
import { BW_BOUNDS, shoreY, waterDepth } from '../src/data/boardwalk';
import { createBoss } from '../src/sim/bosses';
import type { Game } from '../src/sim/game';
import type { BossBase } from '../src/sim/bosses/boss';
import { LAST_RIDE, type LastRideBoss } from '../src/sim/bosses/lastRide';
import type { DrownedCaptainBoss } from '../src/sim/bosses/captain';
import { LEVIATHAN, type LeviathanBoss } from '../src/sim/bosses/leviathan';

const bw = (o: Parameters<typeof makeGame>[0] = {}) => makeGame({ map: 'boardwalk', godMode: true, seed: 5, ...o });

function tickN(g: Game, n: number): void {
  for (let i = 0; i < n; i++) {
    if (g.phase === 'draft') g.chooseDraft(0);
    g.tick();
  }
}

function hitBoss(g: Game, b: BossBase, frac: number, stopAtPhase = 99): void {
  let guard = 0;
  while (b.hp > b.maxHp * frac && !b.dead && b.phase < stopAtPhase && guard++ < 8000) {
    for (const p of b.parts.filter((q) => q.alive && !q.invuln && q.kind === 'body')) g.damageTarget(p, b.maxHp * 0.01, false, 0, 0, 0, 'test');
    g.tick();
  }
}

const onMap = (x: number, y: number) => x >= BW_BOUNDS.minX && x <= BW_BOUNDS.maxX && y >= BW_BOUNDS.minY && y <= BW_BOUNDS.maxY;
const SEA_BORN = new Set(['drowned_captain', 'leviathan']);

describe('the Boardwalk bosses (D-68)', () => {
  for (const def of BOARDWALK_BOSSES) {
    it(`${def.name}: warns, wakes on its stage, telegraphs, reaches every phase, pays out`, () => {
      const g = bw();
      g.weapons.list.length = 0;
      const warnings: string[] = [];
      const phases: number[] = [];
      g.bus.on('boss_warning', (e) => warnings.push(e.id));
      g.bus.on('boss_phase', (e) => e.id === def.id && phases.push(e.phase));
      for (const other of BOARDWALK_BOSSES) if (other.gate < def.gate) g.director['spawned'].add(other.id), g.director['warned'].add(other.id);
      g.time = def.gate - 5;
      tickN(g, 60 * 12);
      expect(warnings).toContain(def.id);
      const b = g.bosses.find((x) => x.def.id === def.id)!;
      expect(b).toBeTruthy();
      expect(b.awake && b.introDone).toBe(true);
      // the stage was drawn round everyone standing
      expect(b.ringR).toBeGreaterThan(500);
      for (const p of g.players) expect(Math.hypot(p.x - b.ringX, p.y - b.ringY)).toBeLessThanOrEqual(b.ringR);
      let tele = false, threat = false;
      for (let i = 0; i < 60 * 14; i++) {
        g.tick();
        if (g.hazards.some((h) => h.alive && h.owner === b.uid && h.tele > 0)) tele = true;
        if (g.hazards.some((h) => h.alive && h.owner === b.uid) || g.bullets.some((x) => x.alive)) threat = true;
        expect(onMap(b.x, b.y)).toBe(true);
        if (!SEA_BORN.has(def.id)) expect(waterDepth(b.x, b.y)).toBeLessThan(120);
      }
      expect(threat).toBe(true);
      expect(tele).toBe(true);
      for (let ph = 1; ph < def.phases.length; ph++) {
        hitBoss(g, b, 0, ph);
        expect(b.phase).toBe(ph);
        tickN(g, 60 * 7);
        expect(onMap(b.x, b.y)).toBe(true);
      }
      expect(phases).toEqual(def.phases.slice(1).map((_, i) => i + 1));
      let opened = 0;
      g.bus.on('chest', (e) => e.src === 'boss' && opened++);
      hitBoss(g, b, 0);
      tickN(g, 60 * 6);
      expect(b.dead).toBe(true);
      expect(b.ringR).toBe(0);
      expect(g.bossIds).toContain(def.id);
      expect(g.achievementsHit.has(`beat_${def.id}`)).toBe(true);
      if (def.id !== 'leviathan') expect(opened + g.pickups.filter((p) => p.alive && p.kind === 'chest' && p.src === 'boss').length).toBeGreaterThan(0);
      expect(g.hazards.filter((h) => h.alive && h.owner === b.uid).length).toBe(0);
    });
  }

  it("the Last Ride's cars ride the lead car's path, a car-length apart", () => {
    const g = bw();
    g.weapons.list.length = 0;
    const b = createBoss(g, BOARDWALK_BOSSES[2], { immediate: true, noChest: true }) as LastRideBoss;
    g.bosses.push(b);
    tickN(g, 60 * 8);
    expect(b.cars.length).toBe(LAST_RIDE.cars * 2);
    let prevX = b.x, prevY = b.y;
    for (let k = 0; k < LAST_RIDE.cars; k++) {
      const d = Math.hypot(b.cars[k * 2] - prevX, b.cars[k * 2 + 1] - prevY);
      expect(d).toBeLessThan(LAST_RIDE.gap * 1.6);
      prevX = b.cars[k * 2];
      prevY = b.cars[k * 2 + 1];
    }
    // hitting a car is hitting the train
    const hp = b.hp;
    const car = b.parts.find((p) => p.kind === 'contact' && !p.invuln)!;
    expect(car).toBeTruthy();
    g.damageTarget(car, 500, false, 0, 0, 0, 'test');
    expect(b.hp).toBeLessThan(hp);
  });

  it("the Drowned Captain's ship keeps to the sea, off his stretch of the shore", () => {
    const g = bw();
    g.weapons.list.length = 0;
    g.player.x = 600;
    g.player.y = shoreY(600) - 200;
    const b = createBoss(g, BOARDWALK_BOSSES[1], { immediate: true, noChest: true }) as DrownedCaptainBoss;
    g.bosses.push(b);
    tickN(g, 60 * 10);
    expect(waterDepth(b.shipX, b.shipY)).toBeGreaterThan(500);
    expect(b.ship).toBe(1);
  });

  it("the Leviathan's tentacles can be cut, and each cut hurts it", () => {
    const g = bw();
    g.weapons.list.length = 0;
    const b = createBoss(g, BOARDWALK_BOSSES[3], { immediate: true, noChest: true }) as LeviathanBoss;
    g.bosses.push(b);
    tickN(g, 60 * 4);
    let cut = false;
    for (let i = 0; i < 60 * 30 && !cut; i++) {
      g.tick();
      const t = b.parts.find((p) => p.kind === 'tentacle' && !p.invuln && p.hp > 0);
      if (t) {
        const hp = b.hp;
        g.damageTarget(t, 1e6, false, 0, 0, 0, 'test');
        expect(b.hp).toBeLessThan(hp);
        expect(hp - b.hp).toBeCloseTo(b.maxHp * LEVIATHAN.cutShare, 0);
        cut = true;
      }
    }
    expect(cut).toBe(true);
  });

  it('the Leviathan holds the dawn; its defeat ends the night in a win', () => {
    const g = bw();
    g.weapons.list.length = 0;
    for (const id of ['barker', 'drowned_captain', 'last_ride']) g.director['spawned'].add(id), g.director['warned'].add(id);
    g.time = 1436;
    tickN(g, 60 * 10);
    const lv = g.bosses.find((x) => x.def.id === 'leviathan')!;
    expect(lv.awake).toBe(true);
    g.time = 1498;
    tickN(g, 60 * 5);
    expect(g.stalled).toBe(true);
    expect(g.time).toBeLessThan(1500);
    hitBoss(g, lv, 0);
    tickN(g, 60 * 5);
    expect(g.ringmasterDefeated).toBe(true);
    tickN(g, 60 * 12);
    expect(g.phase).toBe('ended');
    expect(g.endStats?.won).toBe(true);
    expect(g.endStats?.achievementsHit).toContain('beat_leviathan');
  });

  it('the Commodore (secret) attacks, reaches all three phases and dies cleanly', () => {
    const g = bw();
    g.weapons.list.length = 0;
    const b = createBoss(g, COMMODORE_DEF, { immediate: true, noChest: true });
    g.bosses.push(b);
    const phases: number[] = [];
    g.bus.on('boss_phase', (e) => e.id === 'commodore' && phases.push(e.phase));
    tickN(g, 60 * 4);
    expect(b.introDone).toBe(true);
    let threat = false;
    for (let i = 0; i < 60 * 10; i++) {
      g.tick();
      if (g.hazards.some((h) => h.alive && h.owner === b.uid) || g.bullets.some((x) => x.alive)) threat = true;
    }
    expect(threat).toBe(true);
    hitBoss(g, b, 0, 1);
    tickN(g, 60 * 5);
    hitBoss(g, b, 0, 2);
    tickN(g, 60 * 7);
    expect(phases).toEqual([1, 2]);
    hitBoss(g, b, 0);
    tickN(g, 60 * 5);
    expect(b.dead && b.removed).toBe(true);
  });

  it('every Boardwalk boss fights a bot with a real loadout without faults', () => {
    for (const def of [...BOARDWALK_BOSSES, COMMODORE_DEF]) {
      const g = bw({ seed: 77 });
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
});

describe('a Boardwalk boss holds its stage (D-71)', () => {
  it('reels anyone who walks out of the ring back in, so a fight never stalls out of reach', () => {
    const g = bw();
    const b = createBoss(g, BOARDWALK_BOSSES[1], { immediate: true, noChest: true });
    g.bosses.push(b);
    for (let i = 0; i < 60 * 3; i++) g.tick();
    expect(b.ringR).toBeGreaterThan(0);
    // stand far outside the ring and do nothing: the stage draws the player back to its edge
    g.player.x = g.player.px = b.ringX;
    g.player.y = g.player.py = b.ringY - b.ringR - 700;
    const before = Math.hypot(g.player.x - b.ringX, g.player.y - b.ringY);
    for (let i = 0; i < 60 * 4; i++) g.tick();
    const after = Math.hypot(g.player.x - b.ringX, g.player.y - b.ringY);
    expect(after).toBeLessThan(before - 400);
  });
});
