// Boss time-to-kill against strong late builds (D-69). Each late boss is met the way a night meets it: the
// clock is set just before its gate with the act's crowd up, the director wakes it, and a bot with the kind
// of build a player has by then (evolutions included) fights it in god mode, so only damage decides how
// long it lasts. The secret bosses are summoned at the 24:00 build.
// Usage: npx vite-node scripts/bossttk.ts [seeds=2] [maps=carnival_core,fun_house,boardwalk]
import { makeGame, smartDraft, smartPilot } from '../tests/helpers';
import { BOSS_MAP, CALLIOPE_DEF, COMMODORE_DEF, UNREFLECTED_DEF, type BossDef } from '../src/data/bosses';
import { MAPS, type MapId } from '../src/data/maps';
import { createBoss } from '../src/sim/bosses';
import type { Game } from '../src/sim/game';

type Build = { weapons: [string, boolean][]; passives: [string, number][] };
/** By 18:00 a strong run has six weapons, two evolved; by 24:00, four evolved and the passives near full. */
const BUILDS: Record<'b3' | 'b4', Build[]> = {
  b3: [
    { weapons: [['throwing_cards', true], ['popcorn', true], ['orbs', false], ['laser', false], ['bell', false], ['darts', false]], passives: [['lucky_ticket', 3], ['foam_finger', 3], ['spectacles', 3], ['energy_drink', 3]] },
    { weapons: [['grill', true], ['rings', true], ['mallet', false], ['fireworks', false], ['cannon', false], ['tarot', false]], passives: [['strongman_belt', 3], ['spectacles', 3], ['energy_drink', 3], ['caffeine', 2]] },
  ],
  b4: [
    { weapons: [['throwing_cards', true], ['popcorn', true], ['orbs', true], ['fireworks', true], ['laser', false], ['bell', false]], passives: [['lucky_ticket', 5], ['foam_finger', 5], ['extra_token', 4], ['spectacles', 5], ['energy_drink', 5]] },
    { weapons: [['grill', true], ['rings', true], ['mallet', true], ['tarot', true], ['cannon', false], ['darts', false]], passives: [['strongman_belt', 5], ['energy_drink', 5], ['spectacles', 5], ['caffeine', 4], ['foam_finger', 4]] },
  ],
};

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

/** Seconds the boss lasted from waking to its fall (or the cap), and the phase it reached. */
function fight(map: MapId, def: BossDef, build: Build, seed: number, secret: boolean): { t: number; phase: number } {
  const g = makeGame({ map, seed, character: 'carny' });
  g.cfg.godMode = true;
  equip(g, build);
  const dir = (g as unknown as { director: { spawned: Set<string>; warned: Set<string> } }).director;
  const gates = MAPS[map].bosses;
  for (const bd of gates) if (bd.gate < def.gate || secret) {
    dir.spawned.add(bd.id);
    dir.warned.add(bd.id);
  }
  g.time = (secret ? 1440 : def.gate) - 25;
  let boss = secret ? null : undefined;
  if (secret) {
    for (let i = 0; i < 25 * 60; i++) {
      smartPilot(g);
      g.tick();
    }
    const b = createBoss(g, def, { immediate: true, noChest: true });
    b.x = b.px = g.player.x;
    b.y = b.py = g.player.y - 380;
    g.bosses.push(b);
  }
  // counted in ticks: the clock stalls at 24:59 while a final boss lives, so sim time can't time the fight
  let woke = -1, down = -1;
  g.bus.on('boss_defeated', (e: { id: string }) => { if (e.id === def.id && down < 0) down = 1; });
  for (let i = 0; i < 60 * 420; i++) {
    smartPilot(g);
    if (g.phase === 'draft') g.chooseDraft(0);
    g.tick();
    const b = g.bosses.find((q) => q.def.id === def.id);
    if (b && b.awake && woke < 0) woke = i;
    if (down > 0 && woke >= 0) return { t: (i - woke) / 60, phase: b?.phase ?? 2 };
    boss = b ?? boss;
  }
  const b = g.bosses.find((q) => q.def.id === def.id);
  return { t: woke >= 0 ? 420 : -1, phase: b?.phase ?? -1 };
}

const seeds = Number(process.argv[2] ?? 2);
const maps = (process.argv[3] ?? 'carnival_core,fun_house,boardwalk').split(',') as MapId[];
const SECRET: Partial<Record<MapId, BossDef>> = { carnival_core: CALLIOPE_DEF, fun_house: UNREFLECTED_DEF, boardwalk: COMMODORE_DEF };
for (const map of maps) {
  const list: [BossDef, 'b3' | 'b4', boolean][] = [];
  const gates = MAPS[map].bosses;
  list.push([gates[2], 'b3', false], [gates[3], 'b4', false]);
  const s = SECRET[map];
  if (s) list.push([BOSS_MAP[s.id], 'b4', true]);
  for (const [def, tier, secret] of list) {
    const ts: number[] = [];
    for (let k = 0; k < seeds; k++) for (const build of BUILDS[tier]) ts.push(Math.round(fight(map, def, build, 101 + k * 17, secret).t));
    const mean = ts.reduce((a, b) => a + b, 0) / ts.length;
    console.log(`${map.padEnd(13)} ${def.id.padEnd(16)} hp ${String(def.hp).padStart(6)}  ttk ${ts.join('/').padEnd(24)} mean ${mean.toFixed(0)}s`);
  }
}

// ---- and how long each boss lasts in an ordinary bot night (the bot's own drafting, god mode), for scale
if (process.argv[4] === 'natural') {
  for (const map of maps) {
    for (let k = 0; k < seeds; k++) {
      const g = makeGame({ map, seed: 301 + k * 13, character: 'carny' });
      g.cfg.godMode = true;
      const woke = new Map<string, number>(), took: string[] = [];
      g.bus.on('boss_defeated', (e: { id: string }) => took.push(`${e.id} ${Math.round(g.time - (woke.get(e.id) ?? g.time))}s (evos ${g.evolutions.length}, L${g.level})`));
      for (let i = 0; i < 1700 * 60 && g.phase !== 'ended'; i++) {
        smartDraft(g);
        if (g.phase === 'draft') g.chooseDraft(0);
        smartPilot(g);
        g.tick();
        for (const b of g.bosses) if (b.awake && !woke.has(b.def.id)) woke.set(b.def.id, g.time);
      }
      console.log(`${map.padEnd(13)} natural seed ${301 + k * 13}: ${took.join(' | ')}`);
    }
  }
}
