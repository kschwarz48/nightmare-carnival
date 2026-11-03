// Level-up draft (doc 06 §4, Godot DraftGenerator/UpgradeData/EvolutionSystem/ChestReward).
// weight = base × build relevance; guaranteed evolution cards; ≥1 branch option. Every card dealt rolls its quality
// (D-99: Common / Uncommon / Rare / Legendary, by the acting player's Luck), which scales what it gives.

import { Rng } from '../core/rng';
import { PASSIVES, WEAPONS, BASE_WEAPON_IDS, PASSIVE_IDS } from '../data/weapons';
import type { Game } from './game';
import type { Player } from './player';
import { HEALING, voucherValue } from '../data/progression';
import { SECRET_UNLOCKS } from '../data/meta';
import { NEW_WEAPON_DMG, QUALITY, QUALITIES, qualityGain, rollQuality, type Quality } from '../data/quality';
import type { PassiveDef, StatAxis, WeaponDef } from '../data/weapons';

/** A card's quality (D-99), or an evolution's own look. */
export type Rarity = Quality | 'evolution';

export interface DraftOption {
  kind: 'new_weapon' | 'level_weapon' | 'passive' | 'evolution' | 'heal' | 'voucher';
  refId: string;
  title: string;
  desc: string;
  level: number; // level after taking it
  rarity: Rarity;
  isNew: boolean;
  /** Shown but not selectable (the voucher once the run cap is reached). */
  disabled?: boolean;
}

/** A player's build as a dealt hand carries it (D-79): weapons and passives, each with its level. */
export interface DraftBuild {
  w: [string, number][];
  p: [string, number][];
}

export function buildOf(p: Player): DraftBuild {
  return { w: p.weapons.list.map((w): [string, number] => [w.def.id, w.level]), p: [...p.passives] };
}

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'evolution'];

// ---------------------------------------------------------------- what a card says at its quality (D-99)
const trim = (x: number) => String(Math.round(x * 10) / 10);
/** The count noun a weapon's level text uses (+1 card, +1 beam), for a count a quality has grown. */
function countNoun(def: WeaponDef): string {
  for (const t of def.levelText) {
    const m = /\+1 ([a-z]+)/i.exec(t);
    if (m && m[1] !== 'pierce') return m[1];
  }
  return 'shot';
}
const plural = (n: number, word: string) => (n === 1 || word.endsWith('s') ? word : `${word}s`);

/** A weapon level's gains as a card says them: its own words at Common, the numbers scaled above it. */
export function weaponLevelText(def: WeaponDef, level: number, q: Quality): string {
  const own = def.levelText[level] || 'Improved';
  if (q === 'common') return own;
  const Q = QUALITY[q], i = level - 1, lv = def.lv;
  const parts: string[] = [];
  const dmg = lv.dmg[i] ?? 0, cd = lv.cd[i] ?? 0, area = lv.area[i] ?? 0, amt = lv.amount[i] ?? 0;
  const pc = lv.pierce?.[i] ?? 0, dur = lv.dur?.[i] ?? 0, spd = lv.spd?.[i] ?? 0;
  if (amt) { const n = amt > 0 ? amt * (1 + Q.idx) : amt; parts.push(`${n > 0 ? '+' : ''}${n} ${plural(Math.abs(n), countNoun(def))}`); }
  if (dmg) parts.push(`${dmg > 0 ? '+' : ''}${trim(dmg > 0 ? dmg * Q.mult : dmg)} damage`);
  if (area) parts.push(`${area > 0 ? '+' : ''}${trim((area > 0 ? area * Q.mult : area) * 100)}% area`);
  if (cd) parts.push(`${cd < 0 ? '\u2212' : '+'}${trim(Math.abs(cd < 0 ? cd * Q.mult : cd))}s cooldown`);
  if (pc) parts.push(`+${pc > 0 ? pc * (1 + Q.idx) : pc} pierce`);
  if (dur) parts.push(`${dur > 0 ? '+' : ''}${trim(dur > 0 ? dur * Q.mult : dur)}s duration`);
  if (spd) parts.push(`${spd > 0 ? '+' : ''}${trim(spd > 0 ? spd * Q.mult : spd)} speed`);
  return parts.length ? parts.join(', ') : own;
}

const AXIS_WORDS: Partial<Record<StatAxis, [string, 'pct' | 'neg' | 'n' | 'hp']>> = {
  might: ['Might', 'pct'], cooldown: ['weapon cooldowns', 'neg'], critChance: ['Crit chance', 'pct'], critDamage: ['Crit damage', 'pct'],
  area: ['Area', 'pct'], duration: ['Duration', 'pct'], projSpeed: ['Projectile speed', 'pct'], moveSpeed: ['Move speed', 'pct'],
  maxHp: ['Max HP', 'pct'], luck: ['Luck', 'pct'], greed: ['Greed', 'pct'], xp: ['XP', 'pct'], pickup: ['Pickup radius', 'pct'],
  amount: ['Amount (every weapon)', 'n'], revive: ['Revive', 'n'], armor: ['Armor', 'n'], regen: ['HP regen per second', 'hp'],
  deathsDoor: ['Might at a sliver of health', 'pct'],
};

/** A passive level's gains as a card says them: its own words at Common, the scaled numbers above it. */
export function passiveLevelText(def: PassiveDef, lvl: number, q: Quality): string {
  if (q === 'common') return def.desc;
  const parts: string[] = [];
  for (const eff of def.effects) {
    const g = eff.perLevel[lvl] ?? 0;
    if (!g) continue;
    const v = qualityGain(eff.axis, g, q), w = AXIS_WORDS[eff.axis];
    if (!w) parts.push(`+${Math.round(v)} level${Math.round(v) === 1 ? '' : 's'}`);
    else if (w[1] === 'pct') parts.push(`+${trim(v * 100)}% ${w[0]}`);
    else if (w[1] === 'neg') parts.push(`\u2212${trim(v * 100)}% ${w[0]}`);
    else if (w[1] === 'hp') parts.push(`+${trim(v)} ${w[0]}`);
    else parts.push(`+${Math.round(v)} ${w[0]}`);
  }
  return parts.length ? parts.join(', ') : def.desc;
}

/** A new weapon's card at its quality: its description, and the damage its quality adds. */
export function newWeaponText(def: WeaponDef, q: Quality): string {
  return q === 'common' ? def.desc : `${def.desc} +${Math.round(NEW_WEAPON_DMG[q] * 100)}% damage.`;
}

/** Deal `opt` its quality (D-99): a weapon or a passive card rolls one by the acting player's Luck; its text follows. */
function dealQuality(g: Game, opt: DraftOption, rng: Rng): DraftOption {
  if (opt.kind !== 'new_weapon' && opt.kind !== 'level_weapon' && opt.kind !== 'passive') return opt;
  const q = rollQuality(rng, g.player.stats.luck);
  if (opt.kind === 'new_weapon') return { ...opt, rarity: q, desc: newWeaponText(WEAPONS[opt.refId], q) };
  if (opt.kind === 'level_weapon') return { ...opt, rarity: q, desc: weaponLevelText(WEAPONS[opt.refId], opt.level, q) };
  return { ...opt, rarity: q, desc: passiveLevelText(PASSIVES[opt.refId], opt.level - 1, q) };
}

export function readyEvolutions(g: Game): string[] {
  const out: string[] = [];
  for (const w of g.weapons.list) {
    const d = w.def;
    if (!d.evolvesTo || w.level < d.maxLevel) continue;
    // every build is personal (D-74): only this player's own passive counts toward the evolution
    if (d.evoPassive && g.player.passiveLevel(d.evoPassive) < 1) continue;
    out.push(d.id);
  }
  return out;
}

/** Is an item with this unlock id in the acting player's draft pool? */
export function isUnlocked(g: Game, unlock?: string): boolean {
  return isUnlockedFor(g, g.player, unlock);
}

/** Is an item with this unlock id in player `p`'s draft pool? */
export function isUnlockedFor(g: Game, p: Player, unlock?: string): boolean {
  if (!unlock) return true;
  if (g.cfg.daily) return !SECRET_UNLOCKS.includes(unlock); // Daily Run: full pool (D-18), secrets stay secret
  return p.unlocked.has(unlock); // that player's own save (D-74)
}

interface Cand { opt: DraftOption; w: number; branch: boolean }

function candidates(g: Game): Cand[] {
  const out: Cand[] = [];
  // (D-99: Luck rolls each card's quality now; it no longer tilts which items come up)
  const rw = (_r: Rarity) => 1;
  const owned = g.weapons.list;
  const ownedIds = new Set(owned.map((w) => w.def.id));
  const evolvedFrom = new Set(owned.filter((w) => w.def.isEvolution).map((w) => w.def.evolvedFrom));
  // co-op (D-74): every player may take every item, whatever the others hold (it used to be one owner each)
  const banished = g.player.banished;
  const slots = g.slots;

  // Level owned weapons
  for (const w of owned) {
    if (w.level >= w.def.maxLevel) continue; // evolutions level too (D-61)
    if (banished.has(w.def.id)) continue;
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
  if (owned.length < slots.weapons) {
    for (const id of BASE_WEAPON_IDS) {
      const d = WEAPONS[id];
      if (ownedIds.has(id) || evolvedFrom.has(id) || banished.has(id) || !isUnlocked(g, d.unlock)) continue;
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
    if (lvl >= d.maxLevel || banished.has(id) || !isUnlocked(g, d.unlock)) continue;
    if (lvl === 0 && heldPassives >= slots.passives) continue;
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
  // each card dealt rolls its quality (D-99)
  for (let k = 0; k < picks.length; k++) picks[k] = dealQuality(g, picks[k], rng);
  if (picks.length === 0) {
    // Upgrade pool exhausted (D-31): a deliberate choice between a small heal and banked meta currency.
    const heal = Math.max(1, Math.round(g.player.stats.maxHp() * HEALING.fallbackHealFrac));
    const v = voucherValue(g.minutes, g.vouchersTaken, g.voucherPaid, g.player.stats.greed + g.diff.greed);
    picks.push({ kind: 'heal', refId: 'heal', title: 'Funnel Cake Crumbs', desc: `Restore 5% of your max HP (+${heal} HP).`, level: 1, rarity: 'common', isNew: false });
    picks.push(v > 0
      ? { kind: 'voucher', refId: 'voucher', title: 'Lost & Found Voucher', desc: `Bank +${v} Lost Tickets now, for permanent upgrades between nights.`, level: 1, rarity: 'common', isNew: false }
      : { kind: 'voucher', refId: 'voucher', title: 'Lost & Found Voucher', desc: 'The Lost & Found window is shut for tonight — no more vouchers this run.', level: 1, rarity: 'common', isNew: false, disabled: true });
  }
  // Pre-roll the Fortune Teller's preview of the next draft (D-10).
  if (g.player.char.quirk === 'fortune' && !rngIn) {
    const preview = generatePreview(g);
    g.nextDraftRarity = preview;
  }
  return picks;
}

/** The Fortune Teller's glimpse of the next draft (D-10): its best card's quality (D-99), as a separate stream rolls it. */
function generatePreview(g: Game): Rarity {
  if (readyEvolutions(g).length) return 'evolution';
  let best: Rarity = 'common';
  const r = new Rng(g.rng.state ^ 0x5bd1e995);
  for (let k = 0; k < 4; k++) {
    const q = rollQuality(r, g.player.stats.luck);
    if (RARITY_ORDER.indexOf(q) > RARITY_ORDER.indexOf(best)) best = q;
  }
  return best;
}

/** The quality an option was dealt (common for the cards that have none). */
const qualityOf = (opt: DraftOption): Quality => ((QUALITIES as readonly string[]).includes(opt.rarity) ? (opt.rarity as Quality) : 'common');

export function applyDraftChoice(g: Game, opt: DraftOption): void {
  switch (opt.kind) {
    case 'new_weapon':
      if (g.weapons.add(opt.refId, qualityOf(opt))) g.bus.emit('discover', { id: opt.refId });
      break;
    case 'level_weapon':
      g.weapons.levelUp(opt.refId, qualityOf(opt));
      break;
    case 'passive':
      if (g.player.passiveLevel(opt.refId) === 0) g.bus.emit('discover', { id: opt.refId });
      g.player.addPassive(opt.refId, qualityOf(opt));
      break;
    case 'evolution':
      g.weapons.evolve(opt.refId);
      break;
    case 'heal':
      g.healPlayer(g.player.stats.maxHp() * HEALING.fallbackHealFrac);
      break;
    case 'voucher':
      g.grantVoucher();
      break;
  }
  g.bus.emit('sfx', { id: opt.kind === 'evolution' ? 'evolve' : 'select', vol: 0.6 });
}

/** VS-style chest (doc 03 §6, D-06): N random upgrades to equipped items. Evolutions only come from level-up cards (D-57). */
export interface ChestEntry {
  type: 'evolution' | 'level' | 'passive' | 'new' | 'voucher' | 'heal' | 'party';
  id: string;
  label: string;
  /** for the prize card (D-61): the item's name, its new level, whether that's its last, or what it paid */
  name?: string;
  level?: number;
  max?: boolean;
  note?: string;
  /** Co-op: the player this prize went to (D-51). */
  player?: number;
  /** Party Favors (D-74): what each player got from it, each tagged with its player */
  gifts?: ChestEntry[];
  /** the quality it rolled (D-99) */
  quality?: Quality;
}

export function grantChest(g: Game, rolls: number): { items: string[]; evolution?: string; entries: ChestEntry[] } {
  const items: string[] = [];
  const entries: ChestEntry[] = [];
  const evolution: string | undefined = undefined;
  for (let i = 0; i < Math.max(0, rolls); i++) {
    const options: (() => string)[] = [];
    // each prize rolls its quality too (D-99)
    const tag = (q: Quality) => (q === 'common' ? '' : ` (${QUALITY[q].name})`);
    for (const w of g.weapons.list) {
      if (w.level < w.def.maxLevel) {
        options.push(() => {
          const q = rollQuality(g.rng, g.player.stats.luck);
          g.weapons.levelUp(w.def.id, q);
          entries.push({ type: 'level', id: w.def.id, label: `${w.def.name} Lv ${w.level}${tag(q)}`, name: w.def.name, level: w.level, max: w.level >= w.def.maxLevel, quality: q, note: weaponLevelText(w.def, w.level, q) });
          return `${w.def.name} Lv ${w.level}${tag(q)}`;
        });
      }
    }
    for (const [id, lvl] of g.player.passives) {
      if (lvl < PASSIVES[id].maxLevel) {
        options.push(() => {
          const q = rollQuality(g.rng, g.player.stats.luck);
          g.player.addPassive(id, q);
          const lv = g.player.passiveLevel(id);
          entries.push({ type: 'passive', id, label: `${PASSIVES[id].name} Lv ${lv}${tag(q)}`, name: PASSIVES[id].name, level: lv, max: lv >= PASSIVES[id].maxLevel, quality: q, note: passiveLevelText(PASSIVES[id], lv - 1, q) });
          return `${PASSIVES[id].name} Lv ${g.player.passiveLevel(id)}${tag(q)}`;
        });
      }
    }
    if (options.length) {
      items.push(g.rng.pick(options)());
      continue;
    }
    // Everything maxed: a new weapon if there's room, else a heal.
    if (g.weapons.hasRoom()) {
      const cands = BASE_WEAPON_IDS.filter((id) => !g.weapons.has(id) && !g.weapons.list.some((w) => w.def.evolvedFrom === id) && isUnlocked(g, WEAPONS[id].unlock));
      if (cands.length) {
        const id = g.rng.pick(cands);
        g.weapons.add(id);
        g.bus.emit('discover', { id });
        items.push(`New: ${WEAPONS[id].name}`);
        entries.push({ type: 'new', id, label: `New: ${WEAPONS[id].name}`, name: WEAPONS[id].name, level: 1 });
        continue;
      }
    }
    const v = g.grantVoucher();
    if (v > 0) {
      items.push(`Lost & Found Voucher (+${v} LT)`);
      entries.push({ type: 'voucher', id: 'voucher', label: `Lost & Found Voucher (+${v} LT)`, name: 'Lost & Found Voucher', note: `+${v} Lost Tickets` });
    } else {
      // the voucher window is shut for the night: a crumb of funnel cake instead
      const hp = Math.max(1, Math.round(g.player.stats.maxHp() * HEALING.fallbackHealFrac));
      g.healPlayer(hp);
      items.push(`Funnel Cake Crumbs (+${hp} HP)`);
      entries.push({ type: 'heal', id: 'funnel_cake', label: `Funnel Cake Crumbs (+${hp} HP)`, name: 'Funnel Cake Crumbs', note: `+${hp} HP` });
    }
  }
  // An evolution that became ready from these rolls is granted at the next chest/draft.
  return { items, evolution, entries };
}
