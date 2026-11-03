// The weapons' new shapes (D-103): the Snow-Cone Machine's slush and the Blizzard's roaming storms, the Hot-Dog Grill's
// burning trail, the Mallet's whacks and their daze, the Strongman Bell's fissures, the Crystal Orbs' swelling orbit and
// grind; and the progression around them: the tier shelves' core-stat ranks reaching a guest whole, and a hidden quest
// solved on a higher tier paying once.
import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { WEAPONS } from '../src/data/weapons';
import { PERKS, tierAchievements, ACHIEVEMENTS } from '../src/data/meta';
import { TIERS } from '../src/data/tiers';
import { cleanProfile } from '../src/net/protocol';
import { SaveManager } from '../src/meta/save';
import type { Enemy } from '../src/sim/entities';
import type { Game } from '../src/sim/game';

/** A quiet floor: nothing spawns but what the test places. */
function quiet(weapon: string, level = 1): Game {
  const g = makeGame({ godMode: true, seed: 3 });
  g.director.update = () => {};
  g.events.update = () => {};
  g.weapons.list.length = 0;
  const w = g.weapons.add(weapon)!;
  w.level = level;
  return g;
}

function put(g: Game, id: string, dx: number, dy: number, hpMult = 50): Enemy {
  const p = g.player;
  return g.spawnEnemy(id, p.x + dx, p.y + dy, { exact: true, hpMult })!;
}

const run = (g: Game, ticks: number, each?: () => void) => {
  for (let i = 0; i < ticks; i++) {
    each?.();
    if (g.phase === 'draft') g.chooseDraft(0, 0);
    g.tick();
  }
};

describe('the weapons\' new shapes (D-103)', () => {
  it('Snow-Cone Machine: a snow cone splats into slush that bites, chills and freezes what stays in it', () => {
    const g = quiet('snowcone', 8);
    const e = put(g, 'possessed_stuffie', 220, 0, 200);
    e.def = { ...e.def, speed: 0 };
    const hp0 = e.hp;
    let froze = false;
    run(g, 240, () => {
      if (e.frozenT > 0) froze = true;
    });
    const slush = g.zones.filter((z) => z.alive && z.kind === 'slush');
    expect(slush.length).toBeGreaterThan(0);
    expect(slush[0].src).toBe('snowcone');
    expect(e.hp).toBeLessThan(hp0);
    expect(froze).toBe(true);
    expect(g.player.dmgBy.get('snowcone') ?? 0).toBeGreaterThan(0);
  });

  it('Blizzard Machine: its storms roam after the crowd and bite what they cover', () => {
    const g = quiet('blizzard', 1);
    const e = put(g, 'puppet_soldier', 300, 0, 100);
    e.def = { ...e.def, speed: 0 };
    run(g, 30);
    const storms = g.zones.filter((z) => z.alive && z.kind === 'storm');
    expect(storms.length).toBe(WEAPONS.blizzard.amount);
    const d0 = Math.min(...storms.map((z) => Math.hypot(z.x - e.x, z.y - e.y)));
    run(g, 240);
    const d1 = Math.min(...storms.map((z) => Math.hypot(z.x - e.x, z.y - e.y)));
    expect(d1).toBeLessThan(d0);
    expect(g.player.dmgBy.get('snowcone') ?? 0).toBeGreaterThan(0);
    // dropped, they blow out
    g.weapons.list.length = 0;
    run(g, 90);
    expect(g.zones.some((z) => z.alive && z.kind === 'storm')).toBe(false);
  });

  it('Hot-Dog Grill: it drips burning grease along the way you walk, and where you stand when you stand', () => {
    const g = quiet('grill', 1);
    const p = g.player;
    const x0 = p.x;
    run(g, 120, () => {
      g.inputs[0].moveX = 1;
      g.inputs[0].moveY = 0;
    });
    const trail = g.zones.filter((z) => z.alive && z.kind === 'burn' && z.src === 'grill');
    expect(trail.length).toBeGreaterThan(4);
    // laid behind you, along the path walked
    for (const z of trail) expect(z.x).toBeGreaterThanOrEqual(x0 - 1);
    expect(Math.max(...trail.map((z) => z.x))).toBeLessThan(p.x);
    g.inputs[0].moveX = 0;
    const before = g.zones.filter((z) => z.alive && z.kind === 'burn').length;
    run(g, 60);
    expect(g.zones.some((z) => z.alive && z.kind === 'burn' && Math.hypot(z.x - p.x, z.y - p.y) < 5)).toBe(true);
    expect(g.zones.filter((z) => z.alive && z.kind === 'burn').length).toBeGreaterThan(0);
    expect(before).toBeGreaterThan(0);
  });

  it('Whack-a-Mole Mallet: it whacks the nearest creatures in turn and dazes them, but never pins one down', () => {
    const g = quiet('mallet', 2);
    const a = put(g, 'possessed_stuffie', 120, 0);
    const b = put(g, 'possessed_stuffie', -150, 0);
    const far = put(g, 'possessed_stuffie', 600, 0);
    const hp = [a.hp, b.hp, far.hp];
    let dazed = 0, firstUntil = -1;
    run(g, 90, () => {
      if (a.dazeT > 0) {
        dazed++;
        if (firstUntil < 0) firstUntil = a.dazeUntil;
      }
    });
    expect(a.hp).toBeLessThan(hp[0]);
    expect(b.hp).toBeLessThan(hp[1]); // its second whack
    expect(far.hp).toBe(hp[2]); // out of reach
    expect(dazed).toBeGreaterThan(0);
    // dazed, it stands still; and a whack just after its daze leaves no new one
    expect(firstUntil).toBeGreaterThan(0);
    expect(g.slowFactor(a)).toBeGreaterThanOrEqual(0);
  });

  it('Strongman Bell: a fissure bursts up under what lies along it, not beside it; the High Striker splits a star of them', () => {
    const g = quiet('bell', 1);
    const on = put(g, 'puppet_soldier', 200, 0);
    const off = put(g, 'puppet_soldier', 0, 200);
    for (const e of [on, off]) e.def = { ...e.def, speed: 0 };
    const hp = [on.hp, off.hp];
    run(g, 60);
    expect(on.hp).toBeLessThan(hp[0]);
    expect(off.hp).toBe(hp[1]);
    const h = quiet('high_striker', 1);
    const cracks: number[] = [];
    const push = h.fx.own.bind(h.fx);
    h.fx.own = ((type: string, ...rest: unknown[]) => {
      if (type === 'crack') cracks.push(1);
      return (push as (...a: unknown[]) => unknown)(type, ...rest);
    }) as typeof h.fx.own;
    put(h, 'puppet_soldier', 200, 0);
    run(h, 50);
    expect(cracks.length).toBeGreaterThanOrEqual(WEAPONS.high_striker.amount * 4);
  });

  it('Crystal Orbs: the orbit swells out once a turn, and the orbs grind harder on what stays in them', () => {
    const g = quiet('orbs', 1);
    const w = g.weapons.get('orbs')!;
    const radii: number[] = [];
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      w.angle = a;
      radii.push(g.weapons.orbRadius(w));
    }
    expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(1.6);
    // the grind: repeated hits on one creature bite harder
    const e = put(g, 'carnival_brute', 0, 0, 1000);
    e.def = { ...e.def, speed: 0, knockbackTaken: 0 };
    const hits: number[] = [];
    const dmg = g.damageEnemy.bind(g);
    g.damageEnemy = (t, amount, crit, kb, sx, sy, weapon) => {
      if (t === e && weapon === 'orbs' && !crit) hits.push(amount);
      return dmg(t, amount, crit, kb, sx, sy, weapon);
    };
    run(g, 600, () => {
      e.x = g.player.x + g.weapons.orbRadius(w) * Math.cos(w.angle);
      e.y = g.player.y + g.weapons.orbRadius(w) * Math.sin(w.angle);
    });
    expect(hits.length).toBeGreaterThan(3);
    expect(Math.max(...hits)).toBeGreaterThan(Math.min(...hits) * 1.4);
  });
});

describe('progression around them (D-103)', () => {
  it("a tier shelf's ranks add to Normal's on the same stat, for the host and for a guest", () => {
    const s = new SaveManager({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
    s.data.perks = { might: 5, nm_might: 5, hell_might: 2 };
    const meta = s.metaStats();
    expect(meta.filter((m) => m.axis === 'might')).toEqual([{ axis: 'might', value: expect.closeTo(0.25 + 0.2 + 0.08, 6) }]);
    // a guest's profile keeps it whole: every perk on an axis at its cap is the ceiling
    const clean = cleanProfile({ name: 'G', meta, chars: [] })!;
    expect(clean.meta[0].value).toBeCloseTo(0.53, 6);
    const cap = PERKS.filter((p) => p.axis === 'might').reduce((t, p) => t + p.mag * p.cap, 0);
    expect(cleanProfile({ name: 'G', meta: [{ axis: 'might', value: 9 }], chars: [] })!.meta[0].value).toBeCloseTo(cap, 6);
  });

  it('a hidden quest solved on Nightmare or Hell pays once more, and on Normal nothing new', () => {
    expect(tierAchievements('nightmare', 'carnival_core', false, 1, ['last_song'])).toContain('nm_last_song');
    expect(tierAchievements('hell', 'ghost_train', false, 1, ['last_train'])).toContain('hell_last_train');
    expect(tierAchievements('nightmare', 'fun_house', false, 1, [])).not.toContain('nm_unreflected');
    expect(tierAchievements('normal', 'carnival_core', false, 1, ['last_song'])).toEqual([]);
    for (const id of ['nm_last_song', 'nm_unreflected', 'nm_summers_end', 'nm_last_train', 'hell_last_song', 'hell_unreflected', 'hell_summers_end', 'hell_last_train']) {
      expect(ACHIEVEMENTS.find((a) => a.id === id)?.reward ?? 0, id).toBeGreaterThan(0);
    }
    // the higher tiers pay more for the night (+75% / +150%)
    expect([TIERS.nightmare.greed, TIERS.hell.greed]).toEqual([0.75, 1.5]);
  });
});
