// Level-up draft (doc 06 §4, Godot DraftGenerator/UpgradeData/EvolutionSystem/ChestReward).
// weight = base × rarity(luck) × build relevance; guaranteed evolution cards; ≥1 branch option.

import { Rng } from '../core/rng';
import { PASSIVES, WEAPONS, BASE_WEAPON_IDS, PASSIVE_IDS } from '../data/weapons';
import type { Game } from './game';
import { MAX_PASSIVES, MAX_WEAPONS } from './weapons';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'evolution';

export interface DraftOption {
  kind: 'new_weapon' | 'level_weapon' | 'passive' | 'evolution' | 'heal';
  refId: string;
  title: string;
  desc: string;
  level: number; // level after taking it
  rarity: Rarity;
  isNew: boolean;
}

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'evolution'];

export function readyEvolutions(g: Game): string[] {
  const out: string[] = [];
  for (const w of g.weapons.list) {
    const d = w.def;
    if (!d.evolvesTo || w.level < d.maxLevel) continue;
    if (d.evoPassive && g.player.passiveLevel(d.evoPassive) < 1) continue;
    out.push(d.id);
  }
  return out;
}

function isUnlocked(g: Game, unlock?: string): boolean {
  if (!unlock) return true;
  if (g.cfg.daily) return true; // Daily Run: full pool (D-18)
  return !!g.cfg.unlocked?.has(unlock);
}

interface Cand { opt: DraftOption; w: number; branch: boolean }

function candidates(g: Game): Cand[] {
  const out: Cand[] = [];
  const luck = g.player.stats.luck;
  const rw = (r: Rarity) => (r === 'rare' ? 1 + 0.5 * (luck - 1) : r === 'uncommon' ? 1 + 0.25 * (luck - 1) : 1);
  const owned = g.weapons.list;
  const ownedIds = new Set(owned.map((w) => w.def.id));
  const evolvedFrom = new Set(owned.filter((w) => w.def.isEvolution).map((w) => w.def.evolvedFrom));

  // Level owned weapons
  for (const w of owned) {
    if (w.def.isEvolution || w.level >= w.def.maxLevel) continue;
    if (g.banished.has(w.def.id)) continue;
    const next = w.level + 1;
    const rarity: Rarity = next === w.def.maxLevel ? 'rare' : 'common';
    let rel = 1.5;
    if (w.def.evoPassive && g.player.passiveLevel(w.def.evoPassive) >= 1) rel = 3;
    out.push({
      w: w.def.weight * rel * rw(rarity), branch: false,
      opt: { kind: 'level_weapon', refId: w.def.id, title: w.def.name, desc: w.def.levelText[next] || 'Improved', level: next, rarity, isNew: false },
    });
  }
  // New weapons
  if (owned.length < MAX_WEAPONS) {
    for (const id of BASE_WEAPON_IDS) {
      const d = WEAPONS[id];
      if (ownedIds.has(id) || evolvedFrom.has(id) || g.banished.has(id) || !isUnlocked(g, d.unlock)) continue;
      const rarity: Rarity = d.weight < 1 ? 'uncommon' : 'common';
      // signature weapons of other characters are a little rarer
      const sig = d.signature && d.signature !== g.player.char.id ? 0.7 : 1;
      out.push({
        w: d.weight * sig * rw(rarity), branch: true,
        opt: { kind: 'new_weapon', refId: id, title: d.name, desc: d.desc, level: 1, rarity, isNew: true },
      });
    }
  }
  // Passives
  const heldPassives = g.player.passives.size;
  for (const id of PASSIVE_IDS) {
    const d = PASSIVES[id];
    const lvl = g.player.passiveLevel(id);
    if (lvl >= d.maxLevel || g.banished.has(id) || !isUnlocked(g, d.unlock)) continue;
    if (lvl === 0 && heldPassives >= MAX_PASSIVES) continue;
    let rel = 1;
    if (lvl === 0) {
      for (const w of owned) if (w.def.evoPassive === id) rel = 2.5;
    } else rel = 1.2;
    const rarity: Rarity = id === 'extra_token' || id === 'rabbits_foot' ? 'rare' : d.weight < 1 ? 'uncommon' : 'common';
    out.push({
      w: d.weight * rel * rw(rarity), branch: lvl === 0,
      opt: { kind: 'passive', refId: id, title: d.name, desc: d.desc, level: lvl + 1, rarity, isNew: lvl === 0 },
    });
  }
  return out;
}

export function draftCount(g: Game, rng: Rng): number {
  let n = 3;
  if (g.player.char.quirk === 'fortune') n = 4;
  else if (rng.chance(Math.min(0.5, Math.max(0, (g.player.stats.luck - 1) * 0.5)))) n = 4;
  return n;
}

export function generateDraft(g: Game, rngIn?: Rng): DraftOption[] {
  const rng = rngIn ?? g.rng;
  const count = draftCount(g, rng);
  const picks: DraftOption[] = [];
  for (const id of readyEvolutions(g)) {
    if (picks.length >= count) break;
    const base = WEAPONS[id];
    const evo = WEAPONS[base.evolvesTo!];
    picks.push({ kind: 'evolution', refId: id, title: evo.name, desc: evo.desc, level: 1, rarity: 'evolution', isNew: true });
  }
  const pool = candidates(g);
  const working = pool.slice();
  while (picks.length < count && working.length) {
    const i = rng.weighted(working.map((c) => c.w));
    picks.push(working[i].opt);
    working.splice(i, 1);
  }
  // Always offer at least one branch so a build can pivot (doc 06 §4).
  const hasBranch = picks.some((p) => p.isNew);
  const branches = working.filter((c) => c.branch);
  if (!hasBranch && branches.length && picks.length >= 2) {
    const i = rng.weighted(branches.map((c) => c.w));
    let replace = picks.length - 1;
    while (replace >= 0 && picks[replace].kind === 'evolution') replace--;
    if (replace >= 0) picks[replace] = branches[i].opt;
  }
  if (picks.length === 0) {
    picks.push({ kind: 'heal', refId: 'heal', title: 'Funnel Cake Break', desc: 'Restore 30% HP.', level: 1, rarity: 'common', isNew: false });
  }
  // Pre-roll the Fortune Teller's preview of the next draft (D-10).
  if (g.player.char.quirk === 'fortune' && !rngIn) {
    const preview = generatePreview(g);
    g.nextDraftRarity = preview;
  }
  return picks;
}

function generatePreview(g: Game): Rarity {
  const pool = candidates(g);
  if (readyEvolutions(g).length) return 'evolution';
  let best: Rarity = 'common';
  const r = new Rng(g.rng.state ^ 0x5bd1e995);
  const working = pool.slice();
  for (let k = 0; k < 4 && working.length; k++) {
    const i = r.weighted(working.map((c) => c.w));
    const rr = working[i].opt.rarity;
    if (RARITY_ORDER.indexOf(rr) > RARITY_ORDER.indexOf(best)) best = rr;
    working.splice(i, 1);
  }
  return best;
}

export function applyDraftChoice(g: Game, opt: DraftOption): void {
  switch (opt.kind) {
    case 'new_weapon':
      if (g.weapons.add(opt.refId)) g.bus.emit('discover', { id: opt.refId });
      break;
    case 'level_weapon':
      g.weapons.levelUp(opt.refId);
      break;
    case 'passive':
      if (g.player.passiveLevel(opt.refId) === 0) g.bus.emit('discover', { id: opt.refId });
      g.player.addPassive(opt.refId);
      break;
    case 'evolution':
      g.weapons.evolve(opt.refId);
      break;
    case 'heal':
      g.healPlayer(g.player.stats.maxHp() * 0.3);
      break;
  }
  g.bus.emit('sfx', { id: opt.kind === 'evolution' ? 'evolve' : 'select', vol: 0.6 });
}

/** VS-style chest (doc 03 §6, D-06): N random upgrades to equipped items; evolution first if ready. */
export function grantChest(g: Game, rolls: number): { items: string[]; evolution?: string } {
  const items: string[] = [];
  let evolution: string | undefined;
  const ready = readyEvolutions(g);
  if (ready.length) {
    const evo = g.weapons.evolve(ready[0]);
    if (evo) {
      evolution = evo;
      items.push(`EVOLUTION: ${WEAPONS[evo].name}`);
      rolls--;
    }
  }
  for (let i = 0; i < Math.max(0, rolls); i++) {
    const options: (() => string)[] = [];
    for (const w of g.weapons.list) {
      if (!w.def.isEvolution && w.level < w.def.maxLevel) {
        options.push(() => {
          g.weapons.levelUp(w.def.id);
          return `${w.def.name} Lv ${w.level}`;
        });
      }
    }
    for (const [id, lvl] of g.player.passives) {
      if (lvl < PASSIVES[id].maxLevel) {
        options.push(() => {
          g.player.addPassive(id);
          return `${PASSIVES[id].name} Lv ${g.player.passiveLevel(id)}`;
        });
      }
    }
    if (options.length) {
      items.push(g.rng.pick(options)());
      continue;
    }
    // Everything maxed: a new weapon if there's room, else a heal.
    if (g.weapons.hasRoom()) {
      const cands = BASE_WEAPON_IDS.filter((id) => !g.weapons.has(id) && isUnlocked(g, WEAPONS[id].unlock) && !g.weapons.list.some((w) => w.def.evolvedFrom === id));
      if (cands.length) {
        const id = g.rng.pick(cands);
        g.weapons.add(id);
        g.bus.emit('discover', { id });
        items.push(`New: ${WEAPONS[id].name}`);
        continue;
      }
    }
    g.healPlayer(25);
    items.push('Funnel Cake (+25 HP)');
  }
  // An evolution that became ready from these rolls is granted at the next chest/draft.
  return { items, evolution };
}
