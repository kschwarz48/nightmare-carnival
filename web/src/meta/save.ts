// Versioned persistent save (Godot SaveManager port, doc 08 §18 + 09 M8 "migration safety").
// localStorage JSON with a migration chain, a backup slot, and corruption recovery.

import { ACHIEVEMENTS, BOSS_UNLOCKS, EARNED_UNLOCKS, PERKS, QUEST_UNLOCKS, SECRET_UNLOCKS, UNLOCKS } from '../data/meta';
import { PET_MAP } from '../data/pets';
import { CHARACTERS } from '../data/characters';
import { CURSE } from '../data/difficulty';
import { EVOLUTION_IDS, PASSIVES, WEAPONS } from '../data/weapons';
import { TIER_IDS, isTierId, nextTier, type TierId } from '../data/tiers';
import { MAP_IDS, isMapId, type MapId } from '../data/maps';

export const SAVE_VERSION = 7;
const KEY = 'nightmare_carnival_save';
const BACKUP = 'nightmare_carnival_save_backup';
/** a save's text from before its first migration is kept once under this prefix and its old version (D-97) */
export const PRE_MIGRATION = 'nightmare_carnival_save_v';

/** Each map's final boss on Normal: its achievement is how a save from before the world tiers shows the map won (D-97). */
export const NORMAL_FINALS: Record<MapId, string> = { carnival_core: 'beat_ringmaster', fun_house: 'beat_proprietor', boardwalk: 'beat_leviathan', ghost_train: 'beat_night_express' };

/** World-tier progress (D-97): the tiers open, each tier's wins per map, the unlock ceremonies already shown. */
export interface TierProgress {
  unlocked: TierId[];
  wins: Record<TierId, Partial<Record<MapId, number>>>;
  seen: TierId[];
}

const freshTiers = (): TierProgress => ({ unlocked: ['normal'], wins: { normal: {}, nightmare: {}, hell: {} }, seen: [] });

/** A valid tier record from whatever a save holds (Normal always open; unknown tiers and maps dropped). */
function cleanTiers(raw: unknown): TierProgress {
  const t = freshTiers();
  if (!raw || typeof raw !== 'object') return t;
  const r = raw as Partial<TierProgress>;
  if (Array.isArray(r.unlocked)) for (const id of r.unlocked) if (isTierId(id) && !t.unlocked.includes(id)) t.unlocked.push(id);
  t.unlocked.sort((a, b) => TIER_IDS.indexOf(a) - TIER_IDS.indexOf(b));
  if (r.wins && typeof r.wins === 'object') {
    for (const tier of TIER_IDS) {
      const w = (r.wins as Record<string, unknown>)[tier];
      if (!w || typeof w !== 'object') continue;
      for (const [map, n] of Object.entries(w)) if (isMapId(map) && typeof n === 'number' && isFinite(n) && n >= 1) t.wins[tier][map] = Math.floor(n);
    }
  }
  if (Array.isArray(r.seen)) for (const id of r.seen) if (isTierId(id) && !t.seen.includes(id)) t.seen.push(id);
  return t;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  ambience: number;
  muted: boolean;
  reducedFlash: boolean;
  shake: number; // 0..1
  highContrast: boolean;
  uiScale: number;
  damageNumbers: boolean;
  aimMode: 'auto' | 'hybrid' | 'manual';
  quality: 'low' | 'medium' | 'high';
  showFps: boolean;
  bindings: Record<string, string[]>;
  tutorialsSeen: string[];
  dyslexiaFont: boolean;
  /** 0..1: how solid the players' own attacks are drawn (fade them to read enemy shots in a crowd; 0 hides them, D-83) */
  abilityOpacity: number;
  /** the damage meter in a night (D-85): shown at all (the meter key toggles it), and unfolded (its header) */
  damageMeter: boolean;
  meterOpen: boolean;
  /** controllers (D-104): whose button prompts to show (the pad's own, or always Xbox's or PlayStation's), how
   *  hard it vibrates (0..1, 0: never), and the sticks' dead zone */
  padPrompts: 'auto' | 'xbox' | 'playstation';
  rumble: number;
  stickDeadzone: number;
}

export interface RunRecord {
  date: string;
  character: string;
  /** the world tier (D-97; the old difficulty on older records) */
  difficulty: string;
  won: boolean;
  time: number;
  kills: number;
  level: number;
  lostTickets: number;
  curse: boolean;
  endless: boolean;
  daily: boolean;
}

export interface SaveData {
  version: number;
  lostTickets: number;
  totalEarned: number;
  perks: Record<string, number>;
  unlocks: string[]; // purchased Lost & Found unlocks + characters
  achievements: string[];
  pedia: string[];
  stats: { runs: number; wins: number; kills: number; bestTime: number; bossKills: Record<string, number>; playSeconds: number };
  history: RunRecord[];
  daily: Record<string, { score: number; won: boolean; character: string }>;
  /** the last night's choices (`difficulty`: the old per-night difficulty, kept on older saves, unused) */
  last: { character: string; difficulty?: string; curse: boolean; map?: string; tier?: TierId };
  settings: Settings;
  /** Easter-egg memory per quest chain (D-32): completions and furthest stage ever reached. */
  quests: Record<string, { completions: number; bestStage: number }>;
  /** the world tiers (D-97) */
  tiers: TierProgress;
  /** the Midway hub was opened by the alpha-testing unlock (D-60), not by finishing the Last Song */
  midwayTester?: boolean;
  /** alpha testing aid: `?unlock=funhouse` opens the Fun House on this save (D-63) */
  funhouseTester?: boolean;
  /** alpha testing aid: `?unlock=boardwalk` opens the Boardwalk on this save (D-68) */
  boardwalkTester?: boolean;
  /** alpha testing aid: `?unlock=ghosttrain` opens the Ghost Train on this save (D-80) */
  ghosttrainTester?: boolean;
  /** the companion chosen (D-84): it follows you if its achievement has been earned */
  pet?: string;
  /** owned weapons and passives the player has left out of their drafts (D-78); they stay owned */
  disabled?: string[];
  /** Lost Tickets spent at the Lost & Found since the last refund (D-78), so a later price change can refund exactly */
  spent?: number;
  /** a one-time message for the player (D-78: the Lost & Found's refund), cleared once the Lost & Found shows it */
  notice?: string;
}

export const DEFAULT_BINDINGS: Record<string, string[]> = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space'],
  /** talk / use in the Midway hub (D-60); confirm and the pad's A button work too */
  interact: ['KeyE'],
  reroll: ['KeyR'],
  banish: ['KeyB'],
  skip: ['KeyX'],
  /** open the co-op chat line (D-65) */
  chat: ['KeyT'],
  /** show or hide the damage meter (D-85) */
  meter: ['KeyM'],
  /** the build sheet (D-99) */
  build: ['KeyC'],
};

export function defaultSettings(): Settings {
  return {
    master: 0.8, music: 0.7, sfx: 0.8, ambience: 0.6, muted: false, reducedFlash: false, shake: 1, highContrast: false,
    uiScale: 1, damageNumbers: true, aimMode: 'auto', quality: 'high', showFps: false,
    bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)), tutorialsSeen: [], dyslexiaFont: false,
    abilityOpacity: 1, damageMeter: true, meterOpen: true, padPrompts: 'auto', rumble: 0.8, stickDeadzone: 0.18,
  };
}

export function freshSave(): SaveData {
  return {
    version: SAVE_VERSION, lostTickets: 0, totalEarned: 0, perks: {}, unlocks: [], achievements: [], pedia: [],
    stats: { runs: 0, wins: 0, kills: 0, bestTime: 0, bossKills: {}, playSeconds: 0 },
    history: [], daily: {}, last: { character: 'carny', curse: false, tier: 'normal' }, settings: defaultSettings(), quests: {},
    tiers: freshTiers(),
  };
}

/**
 * What the Lost & Found charged before D-78 ([base, growth] for perks; flat prices for attractions and
 * performers), so the new prices can refund every save's purchases at the price that was paid.
 */
const V4_PERKS: Record<string, [number, number]> = {
  max_hp: [30, 1.5], might: [40, 1.6], speed: [35, 1.6], pickup: [25, 1.5], luck: [45, 1.6], greed: [40, 1.55], armor: [90, 2.0],
  regen: [50, 1.6], revive: [200, 2.0], reroll: [60, 1.8], banish: [70, 1.8],
};
const V4_BOUGHT: Record<string, number> = {
  w_orbs: 60, w_cannon: 90, w_laser: 110, w_bell: 110, w_mirror: 160, p_season_pass: 80, p_coin_purse: 80, p_rabbits_foot: 180, f_skip: 50,
  char_fortune_teller: 150, char_ride_operator: 250, char_lost_child: 350, char_ringleader: 500,
};

/** Migration chain: each step upgrades from version n to n+1. */
const MIGRATIONS: Record<number, (d: any) => any> = {
  // v1 → v2: Godot-style meta {lost_tickets, unlocks, perks, pedia, settings} → web schema
  1: (d) => {
    const s = freshSave();
    s.lostTickets = d.lost_tickets ?? d.lostTickets ?? 0;
    s.unlocks = Array.isArray(d.unlocks) ? d.unlocks.map((u: string) => (u === 'crystal_orbs' ? 'w_orbs' : u)) : [];
    s.perks = d.perks ?? {};
    s.pedia = d.pedia ?? [];
    if (d.settings?.master_volume !== undefined) s.settings.master = d.settings.master_volume;
    if (d.settings?.reduce_flashes !== undefined) s.settings.reducedFlash = !!d.settings.reduce_flashes;
    s.version = 2;
    return s;
  },
  // v2 → v3: daily scores + achievements + stats.bossKills
  2: (d) => {
    d.daily ??= {};
    d.achievements ??= [];
    d.stats ??= { runs: 0, wins: 0, kills: 0, bestTime: 0, bossKills: {}, playSeconds: 0 };
    d.stats.bossKills ??= {};
    d.stats.playSeconds ??= 0;
    d.totalEarned ??= d.lostTickets ?? 0;
    d.version = 3;
    return d;
  },
  // v3 → v4: quest memory for the Last Song (and future maps' chains)
  3: (d) => {
    d.quests ??= {};
    d.version = 4;
    return d;
  },
  // v4 → v5 (D-78): the Lost & Found's new prices. Everything bought there (perks, attractions, performers)
  // is refunded at the price paid and locked again, to be bought anew under the new rules. What was earned
  // stays: achievements, the hidden quests' rewards (re-granted from their achievements, now including
  // Running Shoes for the Commodore). The Whole Troupe means all seven performers now and nobody owns one
  // any more, so it is withdrawn with its reward, to be earned again (reward and all).
  4: (d) => {
    let refund = 0;
    const perks = d.perks && typeof d.perks === 'object' ? d.perks : {};
    for (const [id, lvl] of Object.entries(perks)) {
      const p = V4_PERKS[id];
      if (!p || typeof lvl !== 'number') continue;
      for (let i = 0; i < Math.min(lvl, 10); i++) refund += Math.round(p[0] * Math.pow(p[1], i));
    }
    const unlocks: string[] = Array.isArray(d.unlocks) ? d.unlocks.filter((u: unknown) => typeof u === 'string') : [];
    for (const id of new Set(unlocks)) refund += V4_BOUGHT[id] ?? 0;
    d.perks = {};
    d.unlocks = [...new Set(unlocks.filter((id) => !(id in V4_BOUGHT)))];
    const ach: string[] = Array.isArray(d.achievements) ? d.achievements : [];
    for (const [quest, ids] of Object.entries(QUEST_UNLOCKS)) if (ach.includes(quest)) for (const id of ids) if (!d.unlocks.includes(id)) d.unlocks.push(id);
    if (ach.includes('all_characters')) {
      d.achievements = ach.filter((a) => a !== 'all_characters');
      refund -= ACHIEVEMENTS.find((a) => a.id === 'all_characters')?.reward ?? 0;
    }
    refund = Math.max(0, refund);
    d.lostTickets = (typeof d.lostTickets === 'number' && isFinite(d.lostTickets) ? Math.max(0, d.lostTickets) : 0) + refund;
    d.spent = 0;
    if (refund > 0) d.notice = `The Lost & Found has new prices. Everything you had bought there was refunded: +${refund.toLocaleString('en-US')} Lost Tickets to spend again.`;
    d.version = 5;
    return d;
  },
  // v5 → v6 (D-97): the world tiers. The per-night difficulties are retired and what an older save has won carries
  // over: each map whose final boss it has beaten counts as won on Normal, and a save that has finished the Ghost
  // Train (the Normal campaign) opens Nightmare. Nothing in an older save is a Nightmare completion, so never Hell.
  // Everything else stays (the old difficulties' achievements too, shown as retired).
  5: (d) => {
    const ach: string[] = Array.isArray(d.achievements) ? d.achievements.filter((a: unknown) => typeof a === 'string') : [];
    const t = freshTiers();
    for (const map of MAP_IDS) if (ach.includes(NORMAL_FINALS[map])) t.wins.normal[map] = 1;
    if (ach.includes(NORMAL_FINALS.ghost_train)) t.unlocked.push('nightmare');
    d.tiers = t;
    d.last = { ...(d.last && typeof d.last === 'object' ? d.last : {}), tier: 'normal' };
    d.version = 6;
    return d;
  },
  // v6 → v7 (D-98): each map's final boss gives its weapon and its hidden quest the passive that evolves it. What the
  // save has beaten and solved is given now; the Funhouse Mirror and the Undertow, which were sold, are refunded at the
  // price paid (kept: they are its anyway once their boss falls, and nobody loses a weapon they own).
  6: (d) => {
    const ach: string[] = Array.isArray(d.achievements) ? d.achievements.filter((a: unknown) => typeof a === 'string') : [];
    const unlocks: string[] = Array.isArray(d.unlocks) ? d.unlocks.filter((u: unknown) => typeof u === 'string') : [];
    let refund = 0;
    for (const [id, price] of [['w_mirror', 1000], ['w_undertow', 2000]] as const) if (unlocks.includes(id)) refund += price;
    for (const table of [BOSS_UNLOCKS, QUEST_UNLOCKS]) for (const [a, ids] of Object.entries(table)) if (ach.includes(a)) for (const id of ids) if (!unlocks.includes(id)) unlocks.push(id);
    d.unlocks = unlocks;
    if (refund > 0) {
      d.lostTickets = (typeof d.lostTickets === 'number' && isFinite(d.lostTickets) ? Math.max(0, d.lostTickets) : 0) + refund;
      d.spent = Math.max(0, (typeof d.spent === 'number' ? d.spent : 0) - refund);
      d.notice = `The Funhouse Mirror and the Undertow are no longer sold: each map's final boss now gives its weapon. What you paid for them is back: +${refund.toLocaleString('en-US')} Lost Tickets.`;
    }
    d.version = 7;
    return d;
  },
};

export function migrate(raw: any): SaveData {
  let d = raw;
  if (!d || typeof d !== 'object') return freshSave();
  let v = typeof d.version === 'number' ? d.version : 1;
  let guard = 0;
  while (v < SAVE_VERSION && guard++ < 20) {
    const step = MIGRATIONS[v];
    if (!step) break;
    d = step(d);
    v = d.version;
  }
  // fill any missing fields with defaults (forward compatibility)
  const base = freshSave();
  const out: SaveData = { ...base, ...d, settings: { ...base.settings, ...(d.settings ?? {}) }, stats: { ...base.stats, ...(d.stats ?? {}) }, last: { ...base.last, ...(d.last ?? {}) }, quests: { ...(d.quests ?? {}) }, tiers: cleanTiers(d.tiers) };
  if (!isTierId(out.last.tier) || !out.tiers.unlocked.includes(out.last.tier)) out.last.tier = 'normal';
  out.settings.bindings = { ...DEFAULT_BINDINGS, ...(out.settings.bindings ?? {}) };
  const st = out.settings, num = (v: unknown, lo: number, hi: number, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def);
  if (st.padPrompts !== 'xbox' && st.padPrompts !== 'playstation') st.padPrompts = 'auto';
  st.rumble = num(st.rumble, 0, 1, 0.8);
  st.stickDeadzone = num(st.stickDeadzone, 0.05, 0.4, 0.18);
  out.version = SAVE_VERSION;
  if (typeof out.lostTickets !== 'number' || !isFinite(out.lostTickets) || out.lostTickets < 0) out.lostTickets = 0;
  return out;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

export class SaveManager {
  data: SaveData;
  private store: StorageLike;
  recovered = false;

  constructor(store?: StorageLike) {
    let s: StorageLike;
    try {
      s = store ?? window.localStorage;
      s.setItem('__nc_probe', '1');
      s.removeItem('__nc_probe');
    } catch {
      s = memoryStorage();
    }
    this.store = s;
    this.data = this.load();
  }

  private load(): SaveData {
    const parse = (k: string): SaveData | null => {
      try {
        const txt = this.store.getItem(k);
        if (!txt) return null;
        const raw = JSON.parse(txt);
        // the first time a newer version reads a save, its text is kept once under its old version (D-97), besides the
        // backup slot (which the next save overwrites)
        const v = raw && typeof raw === 'object' && typeof raw.version === 'number' ? raw.version : 1;
        if (k === KEY && v < SAVE_VERSION && !this.store.getItem(PRE_MIGRATION + v)) this.store.setItem(PRE_MIGRATION + v, txt);
        return migrate(raw);
      } catch {
        return null;
      }
    };
    const main = parse(KEY);
    if (main) return main;
    const backup = parse(BACKUP);
    if (backup) {
      this.recovered = true;
      return backup;
    }
    return freshSave();
  }

  save(): void {
    try {
      const txt = JSON.stringify(this.data);
      const prev = this.store.getItem(KEY);
      if (prev) this.store.setItem(BACKUP, prev);
      this.store.setItem(KEY, txt);
    } catch {
      /* storage full / blocked: keep playing in memory */
    }
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = freshSave();
    this.data.settings = settings;
    this.save();
  }

  // ---------------------------------------------------------------- perks
  perkLevel(id: string): number {
    return this.data.perks[id] ?? 0;
  }
  perkCost(id: string): number {
    const p = PERKS.find((x) => x.id === id);
    if (!p) return 0;
    return Math.round(p.base * Math.pow(p.growth, this.perkLevel(id)));
  }
  perkMaxed(id: string): boolean {
    const p = PERKS.find((x) => x.id === id);
    return !!p && this.perkLevel(id) >= p.cap;
  }
  /** Is this perk's shelf open (a tier's shelf opens with its tier, D-97)? */
  perkShelfOpen(id: string): boolean {
    const p = PERKS.find((x) => x.id === id);
    return !!p && (!p.tier || this.tierUnlocked(p.tier));
  }
  /** A switchable perk (Devil's Bargain) that is owned: is it on? */
  perkOn(id: string): boolean {
    return this.perkLevel(id) > 0 && !(this.data.disabled ?? []).includes(id);
  }
  buyPerk(id: string): boolean {
    if (this.perkMaxed(id) || !this.perkShelfOpen(id)) return false;
    const c = this.perkCost(id);
    if (this.data.lostTickets < c) return false;
    this.pay(c);
    this.data.perks[id] = this.perkLevel(id) + 1;
    this.save();
    return true;
  }
  refundPerks(): number {
    let total = 0;
    for (const p of PERKS) {
      const lvl = this.perkLevel(p.id);
      for (let i = 0; i < lvl; i++) total += Math.round(p.base * Math.pow(p.growth, i));
    }
    this.data.perks = {};
    this.data.lostTickets += total;
    this.data.spent = Math.max(0, (this.data.spent ?? 0) - total);
    this.save();
    return total;
  }
  private pay(c: number): void {
    this.data.lostTickets -= c;
    this.data.spent = (this.data.spent ?? 0) + c;
  }
  /** Meta stat bonuses for a new run, one per axis (D-103: the tier shelves' ranks add to Normal's on the same axis). */
  metaStats(): { axis: string; value: number }[] {
    const out: { axis: string; value: number }[] = [];
    for (const p of PERKS) {
      const lvl = this.perkLevel(p.id);
      if (p.switchable && !this.perkOn(p.id)) continue;
      if (lvl <= 0 || p.axis === 'reroll' || p.axis === 'banish') continue;
      const have = out.find((m) => m.axis === p.axis);
      if (have) have.value += p.mag * lvl;
      else out.push({ axis: p.axis, value: p.mag * lvl });
    }
    return out;
  }

  // ---------------------------------------------------------------- unlocks
  isUnlocked(id: string): boolean {
    return this.data.unlocks.includes(id);
  }
  /** Can this attraction be bought yet? (some wait for an achievement, D-78) */
  unlockRequirementMet(id: string): boolean {
    const u = UNLOCKS.find((x) => x.id === id);
    return !!u && (!u.req || this.hasAchievement(u.req));
  }
  buyUnlock(id: string): boolean {
    const u = UNLOCKS.find((x) => x.id === id);
    if (!u || this.isUnlocked(id) || !this.unlockRequirementMet(id) || this.data.lostTickets < u.cost) return false;
    this.pay(u.cost);
    this.data.unlocks.push(id);
    this.save();
    return true;
  }
  /** Is this owned weapon or passive in the player's drafts? (they can leave any out, D-78) */
  inPool(id: string): boolean {
    return this.isUnlocked(id) && !(this.data.disabled ?? []).includes(id);
  }
  setInPool(id: string, on: boolean): void {
    const off = new Set(this.data.disabled ?? []);
    if (on) off.delete(id);
    else off.add(id);
    this.data.disabled = [...off];
    this.save();
  }
  hasAchievement(id: string): boolean {
    return this.data.achievements.includes(id);
  }
  /** Has this save earned companion `id` (D-84)? */
  petUnlocked(id: string): boolean {
    const p = PET_MAP[id];
    return !!p && this.hasAchievement(p.achievement);
  }
  /** The companion that comes along: the one chosen, while it is earned (none otherwise). */
  petChoice(): string | undefined {
    const id = this.data.pet;
    return id && this.petUnlocked(id) ? id : undefined;
  }
  characterAvailable(id: string): boolean {
    const c = CHARACTERS.find((x) => x.id === id);
    if (!c) return false;
    if (!c.unlock) return true;
    return this.isUnlocked(`char_${id}`);
  }
  characterRequirementMet(id: string): boolean {
    const c = CHARACTERS.find((x) => x.id === id);
    if (!c || !c.unlock) return true;
    return this.hasAchievement(c.unlock.req);
  }
  buyCharacter(id: string): boolean {
    const c = CHARACTERS.find((x) => x.id === id);
    if (!c || !c.unlock || this.characterAvailable(id) || !this.characterRequirementMet(id)) return false;
    if (this.data.lostTickets < c.unlock.cost) return false;
    this.pay(c.unlock.cost);
    this.data.unlocks.push(`char_${id}`);
    // the last performer bought earns the Whole Troupe at once (D-75: it waited for some other achievement)
    this.claimDerived();
    this.save();
    return true;
  }
  // ---------------------------------------------------------------- world tiers (D-97)
  tierUnlocked(t: TierId): boolean {
    return this.data.tiers.unlocked.includes(t);
  }
  /** Open a tier; whether it was newly opened. */
  unlockTier(t: TierId): boolean {
    if (this.tierUnlocked(t)) return false;
    this.data.tiers.unlocked.push(t);
    this.data.tiers.unlocked.sort((a, b) => TIER_IDS.indexOf(a) - TIER_IDS.indexOf(b));
    return true;
  }
  /** Close a tier again (the dev tools only): the tiers above it close too, and its last-played choice falls back. */
  lockTier(t: TierId): void {
    if (t === 'normal') return;
    const i = TIER_IDS.indexOf(t);
    this.data.tiers.unlocked = this.data.tiers.unlocked.filter((x) => TIER_IDS.indexOf(x) < i);
    if (!this.tierUnlocked(this.data.last.tier ?? 'normal')) this.data.last.tier = 'normal';
  }
  /** How often this save has won `map` on `tier`. */
  tierWins(t: TierId, map: MapId): number {
    return this.data.tiers.wins[t]?.[map] ?? 0;
  }
  /**
   * Can `map` be chosen on `tier`? Normal keeps its own rules (`mapAvailable`); on Nightmare and Hell the Carnival
   * Core opens with the tier and each next map once the one before it has been won on that tier.
   */
  mapAvailableOn(t: TierId, map: MapId): boolean {
    if (t === 'normal') return this.mapAvailable(map);
    if (!this.tierUnlocked(t)) return false;
    const i = MAP_IDS.indexOf(map);
    return i === 0 || (i > 0 && this.tierWins(t, MAP_IDS[i - 1]) > 0);
  }
  /** Does a night of `map` on `tier` count for this save's own campaign: the tier open here and the map open on it? */
  countsFor(t: TierId, map: MapId): boolean {
    return this.tierUnlocked(t) && this.mapAvailableOn(t, map);
  }
  /**
   * A won night of `map` on `tier` that counts for this save (the caller checks `countsFor`): one more win, and what
   * it opened, the next map on this tier or (the Ghost Train) the next tier.
   */
  recordTierWin(t: TierId, map: MapId): { maps: MapId[]; tier: TierId | null } {
    const before = MAP_IDS.filter((m) => this.mapAvailableOn(t, m));
    (this.data.tiers.wins[t] ??= {})[map] = this.tierWins(t, map) + 1;
    const maps = MAP_IDS.filter((m) => !before.includes(m) && this.mapAvailableOn(t, m));
    const nt = map === 'ghost_train' ? nextTier(t) : null;
    return { maps, tier: nt && this.unlockTier(nt) ? nt : null };
  }
  /** The tier a menu opens on: the last one played, while it is open. */
  lastTier(): TierId {
    const t = this.data.last.tier;
    return t && this.tierUnlocked(t) ? t : 'normal';
  }
  /** The tier to show `map` on: `prefer` when it is open there, else the highest tier it is open on (else Normal). */
  bestTierFor(map: MapId, prefer: TierId): TierId {
    if (this.mapAvailableOn(prefer, map)) return prefer;
    return [...TIER_IDS].reverse().find((t) => this.mapAvailableOn(t, map)) ?? 'normal';
  }
  /** Every tier and map this save has open, as `tier:map` (a guest's profile carries them, D-97). */
  openPairs(): string[] {
    return TIER_IDS.flatMap((t) => MAP_IDS.filter((m) => this.countsFor(t, m)).map((m) => `${t}:${m}`));
  }
  /** Has this save finished the campaign on `t` (its Ghost Train won)? */
  tierComplete(t: TierId): boolean {
    return this.tierWins(t, 'ghost_train') > 0;
  }
  curseAvailable(): boolean {
    return this.hasAchievement(CURSE.unlock.req);
  }
  endlessAvailable(): boolean {
    return this.hasAchievement('beat_ringmaster');
  }
  /** The Midway hub (D-60): the first night survived (D-98: it waited for the Last Song, the first night's hidden quest). */
  hubUnlocked(): boolean {
    return this.hasAchievement('beat_ringmaster') || (this.data.quests.last_song?.completions ?? 0) > 0 || !!this.data.midwayTester;
  }
  /**
   * Which nights can be chosen (D-63): the Carnival Core always; the Fun House once the first night
   * has been survived (the Ringmaster beaten), or with the Midway open, or with the alpha tester flag.
   */
  mapAvailable(id: string): boolean {
    if (id === 'carnival_core') return true;
    if (id === 'fun_house') return this.hasAchievement('beat_ringmaster') || this.hubUnlocked() || !!this.data.funhouseTester;
    // the Boardwalk (D-68): once the Fun House has been survived (the Proprietor beaten), or the alpha tester flag
    if (id === 'boardwalk') return this.hasAchievement('beat_proprietor') || !!this.data.boardwalkTester;
    // the Ghost Train (D-80): once the Boardwalk has been survived (the Leviathan beaten), or the tester flag
    if (id === 'ghost_train') return this.hasAchievement('beat_leviathan') || !!this.data.ghosttrainTester;
    return false;
  }
  dailyAvailable(): boolean {
    return this.data.stats.runs >= 1;
  }
  /** What this save brings to a night's draft pool: everything owned, less what the player left out (D-78). */
  unlockedSet(): Set<string> {
    const off = new Set(this.data.disabled ?? []);
    return new Set(this.data.unlocks.filter((u) => !off.has(u)));
  }

  // ---------------------------------------------------------------- pedia
  discover(id: string): boolean {
    if (this.data.pedia.includes(id)) return false;
    this.data.pedia.push(id);
    return true;
  }

  /** Award achievements; returns newly earned definitions (Lost Tickets credited). */
  grantAchievements(ids: string[]): typeof ACHIEVEMENTS {
    const out: typeof ACHIEVEMENTS = [];
    for (const id of ids) {
      if (this.hasAchievement(id)) continue;
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (!a) continue;
      this.data.achievements.push(id);
      this.data.lostTickets += a.reward;
      this.data.totalEarned += a.reward;
      out.push(a);
    }
    this.claimRewards();
    out.push(...this.claimDerived());
    return out;
  }

  /** What the achievements held give (D-98: a map's weapon for its final boss, the quest's passive): newly added ids. */
  claimRewards(): string[] {
    const got: string[] = [];
    for (const table of [BOSS_UNLOCKS, QUEST_UNLOCKS]) {
      for (const [a, ids] of Object.entries(table)) {
        if (!this.hasAchievement(a)) continue;
        for (const id of ids) if (!this.data.unlocks.includes(id)) {
          this.data.unlocks.push(id);
          got.push(id);
        }
      }
    }
    return got;
  }

  /**
   * Achievements that follow from the save itself (every performer unlocked, every evolution discovered):
   * awarded (with their Lost Tickets) whenever they're met, and returned. Checked when achievements are
   * granted, when a performer is bought and when the Lost & Found opens (D-75), so an older save that
   * already qualifies gets them too.
   */
  claimDerived(): typeof ACHIEVEMENTS {
    const out: typeof ACHIEVEMENTS = [];
    // (the world tiers' performers aren't part of it, D-97)
    const allChars = CHARACTERS.filter((c) => !c.tier).every((c) => this.characterAvailable(c.id));
    if (allChars && !this.hasAchievement('all_characters')) out.push(...this.grantAchievements(['all_characters']));
    // evolutions that need something never sold (a hidden quest's reward, D-78: the Hand Mirror for the Hall
    // of Mirrors, Running Shoes for the Last Lap) don't count toward Full House
    const neverSold = [...SECRET_UNLOCKS, ...EARNED_UNLOCKS];
    // nor do the world tiers' (D-97): Full House stays a Normal-carnival achievement
    const tierUnlock = (id: string) => !!UNLOCKS.find((u) => u.id === id)?.tier;
    const counts = (e: string) => {
      const base = WEAPONS[WEAPONS[e].evolvedFrom!];
      const via = [base?.unlock ?? '', PASSIVES[base?.evoPassive ?? '']?.unlock ?? ''];
      return !via.some((u) => neverSold.includes(u) || tierUnlock(u));
    };
    const allEvos = EVOLUTION_IDS.filter(counts).every((e) => this.data.pedia.includes(e));
    if (allEvos && !this.hasAchievement('full_house')) out.push(...this.grantAchievements(['full_house']));
    return out;
  }
}
