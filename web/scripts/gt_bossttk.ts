// The Ghost Train's bosses' time-to-kill (D-80), on the same footing as scripts/bossttk.ts: the clock set just
// before each gate with the act's crowd up, the director waking the boss where the party stands (a station;
// the Night Express at the End of the Line), and a bot with the build a strong player has by then fighting it
// in god mode. Builds: b2 (12:00: four weapons, one evolved), b3 (18:00), b4 (24:00); the Conductor at b4.
// Usage: npx vite-node scripts/gt_bossttk.ts [seeds=1] [only=id,id]
import { makeGame, smartPilot } from '../tests/helpers';
import { BOSS_MAP, CONDUCTOR_DEF, GHOST_BOSSES, type BossDef } from '../src/data/bosses';
import { E, J, REGIONS, trackY } from '../src/data/ghosttrain';
import { createBoss } from '../src/sim/bosses';
import type { Game } from '../src/sim/game';

type Build = { weapons: [string, boolean][]; passives: [string, number][] };
const BUILDS: Record<'b1' | 'b2' | 'b3' | 'b4', Build[]> = {
  b1: [{ weapons: [['throwing_cards', false], ['popcorn', false]], passives: [['lucky_ticket', 1], ['spectacles', 1]] }],
  b2: [
    { weapons: [['throwing_cards', true], ['popcorn', false], ['orbs', false], ['laser', false]], passives: [['lucky_ticket', 2], ['foam_finger', 2], ['spectacles', 2]] },
    { weapons: [['grill', true], ['rings', false], ['mallet', false], ['fireworks', false]], passives: [['strongman_belt', 2], ['spectacles', 2], ['energy_drink', 2]] },
  ],
  b3: [
    { weapons: [['throwing_cards', true], ['popcorn', true], ['orbs', false], ['laser', false], ['bell', false], ['darts', false]], passives: [['lucky_ticket', 3], ['foam_finger', 3], ['spectacles', 3], ['energy_drink', 3]] },
    { weapons: [['grill', true], ['rings', true], ['mallet', false], ['fireworks', false], ['cannon', false], ['tarot', false]], passives: [['strongman_belt', 3], ['spectacles', 3], ['energy_drink', 3], ['caffeine', 2]] },
  ],
  b4: [
    { weapons: [['throwing_cards', true], ['popcorn', true], ['orbs', true], ['fireworks', true], ['laser', false], ['bell', false]], passives: [['lucky_ticket', 5], ['foam_finger', 5], ['extra_token', 4], ['spectacles', 5], ['energy_drink', 5]] },
    { weapons: [['grill', true], ['rings', true], ['mallet', true], ['tarot', true], ['cannon', false], ['darts', false]], passives: [['strongman_belt', 5], ['energy_drink', 5], ['spectacles', 5], ['caffeine', 4], ['foam_finger', 4]] },
  ],
};
const TIER: Record<string, keyof typeof BUILDS> = { stationmaster: 'b1', stoker: 'b2', widow: 'b3', foreman: 'b3', hour_thief: 'b4', night_express: 'b4', conductor: 'b4' };

function equip(g: Game, b: Build): void {
  for (const [id, evo] of b.weapons) {
    g.weapons.add(id);
    for (let k = 0; k < 8; k++) g.weapons.levelUp(id);
    if (evo) {
      const e = g.weapons.evolve(id);
      if (e) for (let k = 0; k < 8; k++) g.weapons.levelUp(e);
    }
  }
  for (const [id, n] of b.passives) for (let k = 0; k < n; k++) g.player.addPassive(id);
}

function fight(def: BossDef, build: Build, seed: number): { t: number; phase: number } {
  const g = makeGame({ map: 'ghost_train', seed, character: 'carny' } as never);
  g.cfg.godMode = true;
  equip(g, build);
  const dir = (g as unknown as { director: { spawned: Set<string>; warned: Set<string> } }).director;
  const secret = def.id === 'conductor';
  for (const bd of GHOST_BOSSES) if (bd.gate < def.gate || secret) {
    dir.spawned.add(bd.id);
    dir.warned.add(bd.id);
  }
  // the party stands where it meets this boss: the Junction's grounds, or the End of the Line
  const r = def.id === 'night_express' || secret ? E : J;
  const place = () => {
    if (Math.abs(g.player.y - (trackY(r) + 700)) > 1400) {
      g.player.x = g.player.px = REGIONS[r].cx;
      g.player.y = g.player.py = trackY(r) + 700;
    }
  };
  g.time = (secret ? 1860 : def.gate) - 25;
  g.player.x = g.player.px = REGIONS[r].cx;
  g.player.y = g.player.py = trackY(r) + 700;
  if (secret) {
    for (let i = 0; i < 25 * 60; i++) {
      smartPilot(g);
      g.tick();
      place();
    }
    const b = createBoss(g, def, { immediate: true, noChest: true });
    g.bosses.push(b);
  }
  let woke = -1, down = -1;
  g.bus.on('boss_defeated', (e: { id: string }) => { if (e.id === def.id && down < 0) down = 1; });
  for (let i = 0; i < 60 * 420; i++) {
    smartPilot(g);
    if (g.phase === 'draft') g.chooseDraft(0);
    g.tick();
    place();
    const b = g.bosses.find((q) => q.def.id === def.id);
    if (b && b.awake && woke < 0) woke = i;
    if (down > 0 && woke >= 0) return { t: (i - woke) / 60, phase: b?.phase ?? 2 };
  }
  const b = g.bosses.find((q) => q.def.id === def.id);
  return { t: woke >= 0 ? 420 : -1, phase: b?.phase ?? -1 };
}

const seeds = Number(process.argv[2] ?? 1);
const only = (process.argv[3] ?? '').split(',').filter(Boolean);
for (const def of [...GHOST_BOSSES, CONDUCTOR_DEF]) {
  if (only.length && !only.includes(def.id)) continue;
  const ts: number[] = [];
  for (let k = 0; k < seeds; k++) for (const build of BUILDS[TIER[def.id]]) ts.push(Math.round(fight(BOSS_MAP[def.id], build, 101 + k * 17).t));
  const mean = ts.reduce((a, b) => a + b, 0) / ts.length;
  console.log(`ghost_train   ${def.id.padEnd(16)} ${TIER[def.id]} hp ${String(def.hp).padStart(6)}  ttk ${ts.join('/').padEnd(24)} mean ${mean.toFixed(0)}s`);
}
