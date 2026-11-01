// Versioned persistent save (Godot SaveManager port, doc 08 §18 + 09 M8 "migration safety").
// localStorage JSON with a migration chain, a backup slot, and corruption recovery.

import { ACHIEVEMENTS, EARNED_UNLOCKS, PERKS, QUEST_UNLOCKS, SECRET_UNLOCKS, UNLOCKS } from '../data/meta';
import { PET_MAP } from '../data/pets';
import { CHARACTERS } from '../data/characters';
import { CURSE, DIFFICULTIES } from '../data/difficulty';
import { EVOLUTION_IDS, PASSIVES, WEAPONS } from '../data/weapons';

export const SAVE_VERSION = 5;
const KEY = 'nightmare_carnival_save';
const BACKUP = 'nightmare_carnival_save_backup';

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
}

export interface RunRecord {
  date: string;
  character: string;
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
  last: { character: string; difficulty: string; curse: boolean; map?: string };
  settings: Settings;
  /** Easter-egg memory per quest chain (D-32): completions and furthest stage ever reached. */
  quests: Record<string, { completions: number; bestStage: number }>;
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
};

export function defaultSettings(): Settings {
  return {
    master: 0.8, music: 0.7, sfx: 0.8, ambience: 0.6, muted: false, reducedFlash: false, shake: 1, highContrast: false,
    uiScale: 1, damageNumbers: true, aimMode: 'auto', quality: 'high', showFps: false,
    bindings: JSON.parse(JSON.stringify(DEFAULT_BINDINGS)), tutorialsSeen: [], dyslexiaFont: false,
    abilityOpacity: 1,
  };
}

export function freshSave(): SaveData {
  return {
    version: SAVE_VERSION, lostTickets: 0, totalEarned: 0, perks: {}, unlocks: [], achievements: [], pedia: [],
    stats: { runs: 0, wins: 0, kills: 0, bestTime: 0, bossKills: {}, playSeconds: 0 },
    history: [], daily: {}, last: { character: 'carny', difficulty: 'midway', curse: false }, settings: defaultSettings(), quests: {},
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
  const out: SaveData = { ...base, ...d, settings: { ...base.settings, ...(d.settings ?? {}) }, stats: { ...base.stats, ...(d.stats ?? {}) }, last: { ...base.last, ...(d.last ?? {}) }, quests: { ...(d.quests ?? {}) } };
  out.settings.bindings = { ...DEFAULT_BINDINGS, ...(out.settings.bindings ?? {}) };
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
        return migrate(JSON.parse(txt));
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
  buyPerk(id: string): boolean {
    if (this.perkMaxed(id)) return false;
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
  /** Meta stat bonuses for a new run. */
  metaStats(): { axis: string; value: number }[] {
    const out: { axis: string; value: number }[] = [];
    for (const p of PERKS) {
      const lvl = this.perkLevel(p.id);
      if (lvl > 0 && p.axis !== 'reroll' && p.axis !== 'banish') out.push({ axis: p.axis, value: p.mag * lvl });
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
  difficultyAvailable(id: string): boolean {
    const d = DIFFICULTIES.find((x) => x.id === id);
    return !!d && (!d.unlock || this.hasAchievement(d.unlock.req));
  }
  curseAvailable(): boolean {
    return this.hasAchievement(CURSE.unlock.req);
  }
  endlessAvailable(): boolean {
    return this.hasAchievement('beat_ringmaster');
  }
  /** The Midway hub (D-60): the first night fully completed — its secret quest carried to True Dawn. */
  hubUnlocked(): boolean {
    return (this.data.quests.last_song?.completions ?? 0) > 0 || !!this.data.midwayTester;
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
    out.push(...this.claimDerived());
    return out;
  }

  /**
   * Achievements that follow from the save itself (every performer unlocked, every evolution discovered):
   * awarded (with their Lost Tickets) whenever they're met, and returned. Checked when achievements are
   * granted, when a performer is bought and when the Lost & Found opens (D-75), so an older save that
   * already qualifies gets them too.
   */
  claimDerived(): typeof ACHIEVEMENTS {
    const out: typeof ACHIEVEMENTS = [];
    const allChars = CHARACTERS.every((c) => this.characterAvailable(c.id));
    if (allChars && !this.hasAchievement('all_characters')) out.push(...this.grantAchievements(['all_characters']));
    // evolutions that need something never sold (a hidden quest's reward, D-78: the Hand Mirror for the Hall
    // of Mirrors, Running Shoes for the Last Lap) don't count toward Full House
    const neverSold = [...SECRET_UNLOCKS, ...EARNED_UNLOCKS];
    const counts = (e: string) => {
      const base = WEAPONS[WEAPONS[e].evolvedFrom!];
      return !neverSold.includes(base?.unlock ?? '') && !neverSold.includes(PASSIVES[base?.evoPassive ?? '']?.unlock ?? '');
    };
    const allEvos = EVOLUTION_IDS.filter(counts).every((e) => this.data.pedia.includes(e));
    if (allEvos && !this.hasAchievement('full_house')) out.push(...this.grantAchievements(['full_house']));
    return out;
  }
}
