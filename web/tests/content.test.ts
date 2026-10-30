import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { WEAPONS, PASSIVES, BASE_WEAPON_IDS, EVOLUTION_IDS, PASSIVE_IDS } from '../src/data/weapons';
import { ENEMIES } from '../src/data/enemies';
import { SECRET_UNLOCKS, UNLOCKS } from '../src/data/meta';
import { CHARACTERS } from '../src/data/characters';
import { WAVES } from '../src/data/waves';
import { PROPS } from '../src/data/map';
import { ENEMY_ART } from '../src/render/art/enemies';
import { BULLETS } from '../src/render/assets';
import { PROP_SPECS } from '../src/render3d/world/props';
import { ENEMY_MODELS } from '../src/render3d/models';
import { generateDraft, readyEvolutions, grantChest } from '../src/sim/draft';
import { RECIPES } from '../src/audio/synth';
import type { Game } from '../src/sim/game';

function surround(g: Game, n = 40, id = 'possessed_stuffie'): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = 70 + (i % 5) * 45;
    const e = g.spawnEnemy(id, g.player.x + Math.cos(a) * d, g.player.y + Math.sin(a) * d);
    if (e) e.hp = e.maxHp = 1e6; // tanky targets so we measure damage, not kills
  }
}

describe('content integrity', () => {
  it('every evolution chain is complete and reachable (D-09)', () => {
    const unlockIds = new Set(UNLOCKS.map((u) => u.id));
    for (const id of BASE_WEAPON_IDS) {
      const w = WEAPONS[id];
      expect(w.evolvesTo, id).toBeTruthy();
      expect(WEAPONS[w.evolvesTo!], id).toBeTruthy();
      expect(WEAPONS[w.evolvesTo!].evolvedFrom).toBe(id);
      expect(PASSIVES[w.evoPassive!], `${id} passive`).toBeTruthy();
      if (w.unlock) expect(unlockIds.has(w.unlock) || SECRET_UNLOCKS.includes(w.unlock), `${id} unlock`).toBe(true);
      const p = PASSIVES[w.evoPassive!];
      if (p.unlock) expect(unlockIds.has(p.unlock)).toBe(true);
      expect(w.lv.dmg.length).toBe(8);
      expect(w.levelText.length).toBeGreaterThanOrEqual(9);
    }
    expect(EVOLUTION_IDS.length).toBe(19); // 18 + the Easter egg's Grand Requiem
    expect(WEAPONS.grand_menagerie.evolvedFrom).toBe('tophat'); // D-07
  });

  it('every character starts with a valid signature weapon', () => {
    for (const c of CHARACTERS) expect(WEAPONS[c.startWeapon]?.signature, c.id).toBe(c.id);
  });

  it('every wave references real enemies; every enemy & prop has art; every bullet kind has a sprite', () => {
    for (const w of WAVES) for (const [id] of w.enemies) expect(ENEMIES[id], `${w.id}:${id}`).toBeTruthy();
    for (const id of Object.keys(ENEMIES)) expect(ENEMY_ART[id], id).toBeTruthy();
    for (const id of Object.keys(ENEMIES)) expect(ENEMY_MODELS[id], `3D model: ${id}`).toBeTruthy();
    for (const p of PROPS) expect(PROP_SPECS[p.kind] || p.kind === 'fence_h' || p.kind === 'fence_v' || p.kind === 'rail', `3D prop: ${p.kind}`).toBeTruthy();
    const kinds = ['pie', 'musket', 'ticket', 'popcorn', 'spiral', 'spark', 'ring', 'hellfire', 'star', 'crown', 'spoke'];
    for (const k of kinds) expect(BULLETS).toContain(k);
  });

  it('every SFX recipe renders finite, non-silent audio', () => {
    for (const [id, make] of Object.entries(RECIPES)) {
      const d = make();
      expect(d.length, id).toBeGreaterThan(100);
      let peak = 0;
      for (const v of d) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, id).toBeGreaterThan(0.01);
    }
  });
});

describe('weapons', () => {
  const all = [...BASE_WEAPON_IDS, ...EVOLUTION_IDS].filter((id) => WEAPONS[id].kind !== 'mirror');
  for (const id of all) {
    it(`${id} deals damage`, () => {
      const g = makeGame({ godMode: true, character: 'carny' });
      g.weapons.list.length = 0;
      g.weapons.add(id);
      g.player.moving = true;
      g.input.moveX = id === 'bumper' || id === 'demolition_derby' ? 0.6 : 0; // surge/aura need movement
      surround(g);
      for (let i = 0; i < 60 * 6; i++) {
        if (g.phase === 'draft') g.chooseDraft(0);
        g.tick();
      }
      expect(g.weaponDamage.get(id) ?? 0, id).toBeGreaterThan(0);
    });
  }

  it('funhouse mirror clones replay attacks for extra damage', () => {
    const base = (mirror: boolean) => {
      const g = makeGame({ godMode: true, seed: 9 });
      g.weapons.list.length = 0;
      g.weapons.add('throwing_cards');
      if (mirror) {
        g.weapons.add('mirror');
        for (let i = 0; i < 7; i++) g.weapons.levelUp('mirror');
      }
      surround(g, 60);
      for (let i = 0; i < 600; i++) g.tick();
      return g.weaponDamage.get('throwing_cards') ?? 0;
    };
    expect(base(true)).toBeGreaterThan(base(false) * 1.15);
  });

  it('levels cap at 8, slots cap at the party size (6 solo, VS), evolution replaces the slot', () => {
    const g = makeGame();
    for (let i = 0; i < 20; i++) g.weapons.levelUp('throwing_cards');
    expect(g.weapons.get('throwing_cards')!.level).toBe(8);
    expect(g.slots.weapons).toBe(6);
    for (const id of BASE_WEAPON_IDS) if (id !== 'lucky_ticket') g.weapons.add(id);
    expect(g.weapons.list.length).toBe(6);
    expect(g.weapons.add('darts') ?? g.weapons.add('mallet')).toBeNull();
    expect(readyEvolutions(g)).toEqual([]);
    g.player.addPassive('lucky_ticket');
    expect(readyEvolutions(g)).toEqual(['throwing_cards']);
    g.weapons.evolve('throwing_cards');
    expect(g.weapons.has('royal_flush')).toBe(true);
    expect(g.weapons.has('throwing_cards')).toBe(false);
    expect(g.weapons.list.length).toBe(6);
  });
});

describe('draft generation', () => {
  it('respects slot caps, max levels, unlocks and banishes', () => {
    const g = makeGame({ unlocked: new Set() });
    for (const id of BASE_WEAPON_IDS) if (g.weapons.list.length < g.slots.weapons) g.weapons.add(id);
    for (const id of PASSIVE_IDS) if (g.player.passives.size < g.slots.passives) g.player.addPassive(id);
    for (let k = 0; k < 40; k++) {
      const opts = generateDraft(g);
      for (const o of opts) {
        expect(o.kind).not.toBe('new_weapon');
        if (o.kind === 'passive') expect(g.player.passiveLevel(o.refId)).toBeGreaterThan(0);
      }
    }
    // unlock gating: orbs never appear without the unlock
    const g2 = makeGame({ unlocked: new Set() });
    for (let k = 0; k < 200; k++) for (const o of generateDraft(g2)) expect(o.refId).not.toBe('orbs');
    // banish
    g2.banished.add('fireworks');
    for (let k = 0; k < 100; k++) for (const o of generateDraft(g2)) expect(o.refId).not.toBe('fireworks');
  });

  it('guarantees the evolution card when ready; Fortune Teller sees 4 cards', () => {
    const g = makeGame({ character: 'fortune_teller' });
    for (let i = 0; i < 8; i++) g.weapons.levelUp('tarot');
    g.player.addPassive('spectacles');
    const opts = generateDraft(g);
    expect(opts.length).toBe(4);
    expect(opts[0].kind).toBe('evolution');
    expect(opts[0].refId).toBe('tarot');
  });

  it('chests grant upgrades to equipped items but never evolve: the evolution waits for a level-up card (D-57)', () => {
    const g = makeGame();
    for (let i = 0; i < 7; i++) g.weapons.levelUp('throwing_cards');
    g.player.addPassive('lucky_ticket');
    const r = grantChest(g, 3);
    expect(r.evolution).toBeUndefined();
    expect(r.items.length).toBe(3);
    expect(r.entries.every((e) => e.type !== 'evolution')).toBe(true);
    expect(g.weapons.has('throwing_cards')).toBe(true);
    // the next level-up offers it
    g.addXp(g.xpToNext - g.xp + 0.01);
    expect(g.draftOptions.some((o) => o.kind === 'evolution' && o.refId === 'throwing_cards')).toBe(true);
  });
});

describe('enemies', () => {
  for (const id of Object.keys(ENEMIES)) {
    it(`${id} behaves without errors or NaN`, () => {
      const g = makeGame({ godMode: true });
      g.weapons.list.length = 0; // no weapons: let the AI run its full cycle
      const e = g.spawnEnemy(id, g.player.x + 300, g.player.y + 50)!;
      if (ENEMIES[id].behavior === 'flyby') {
        e.dirX = -1;
        e.dirY = 0;
      }
      g.director.bossActive = true;
      for (let i = 0; i < 60 * 12; i++) {
        g.tick();
        if (!e.alive) break;
        expect(Number.isFinite(e.x) && Number.isFinite(e.y), id).toBe(true);
      }
    });
  }

  it('wind-up monkeys telegraph before dashing; flybys despawn; jacks pop with a telegraphed blast', () => {
    const g = makeGame({ godMode: true });
    g.weapons.list.length = 0;
    const m = g.spawnEnemy('wind_up_monkey', g.player.x + 200, g.player.y)!;
    let sawWindup = false, sawCharge = false;
    for (let i = 0; i < 240; i++) {
      g.tick();
      if (m.state === 1) sawWindup = true;
      if (m.state === 2) {
        sawCharge = true;
        expect(sawWindup).toBe(true);
      }
    }
    expect(sawCharge).toBe(true);
    const j = g.spawnEnemy('jack_in_the_box', g.player.x + 150, g.player.y)!;
    let blast = false;
    for (let i = 0; i < 300; i++) {
      g.tick();
      if (g.hazards.some((h) => h.alive && h.style === 'jack')) blast = true;
    }
    expect(blast).toBe(true);
    expect(j.alive).toBe(false);
  });

  it('puppet soldiers march in a formation that volleys together', () => {
    const g = makeGame({ godMode: true });
    g.weapons.list.length = 0;
    const n = g.director.spawnFormation(g.player.x + 700, g.player.y, 5);
    expect(n).toBe(5);
    let volleys = 0;
    for (let i = 0; i < 60 * 8; i++) {
      g.tick();
      for (const f of g.director.formations.values()) if (f.fired) volleys++;
    }
    expect(volleys).toBeGreaterThan(0);
    expect(g.bullets.some((b) => b.alive && b.kind === 'musket') || volleys > 0).toBe(true);
  });
});
