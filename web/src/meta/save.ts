// Versioned persistent save (Godot SaveManager port, doc 08 §18 + 09 M8 "migration safety").
// localStorage JSON with a migration chain, a backup slot, and corruption recovery.

import { ACHIEVEMENTS, PERKS, SECRET_UNLOCKS, UNLOCKS } from '../data/meta';
import { CHARACTERS } from '../data/characters';
import { CURSE, DIFFICULTIES } from '../data/difficulty';
import { EVOLUTION_IDS, WEAPONS } from '../data/weapons';

export const SAVE_VERSION = 4;
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
  /** 0.15..1: how solid the players' own attacks are drawn (fade them to read enemy shots in a crowd) */
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
  last: { character: string; difficulty: string; curse: boolean };
  settings: Settings;
  /** Easter-egg memory per quest chain (D-32): completions and furthest stage ever reached. */
  quests: Record<string, { completions: number; bestStage: number }>;
  /** the Midway hub was opened by the alpha-testing unlock (D-60), not by finishing the Last Song */
  midwayTester?: boolean;
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
    this.data.lostTickets -= c;
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
    this.save();
    return total;
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
  buyUnlock(id: string): boolean {
    const u = UNLOCKS.find((x) => x.id === id);
    if (!u || this.isUnlocked(id) || this.data.lostTickets < u.cost) return false;
    this.data.lostTickets -= u.cost;
    this.data.unlocks.push(id);
    this.save();
    return true;
  }
  hasAchievement(id: string): boolean {
    return this.data.achievements.includes(id);
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
    this.data.lostTickets -= c.unlock.cost;
    this.data.unlocks.push(`char_${id}`);
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
  dailyAvailable(): boolean {
    return this.data.stats.runs >= 1;
  }
  unlockedSet(): Set<string> {
    return new Set(this.data.unlocks);
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
    // derived achievements
    const allChars = CHARACTERS.every((c) => this.characterAvailable(c.id));
    if (allChars && !this.hasAchievement('all_characters')) out.push(...this.grantAchievements(['all_characters']));
    // secret evolutions (the Easter egg's reward) don't count toward Full House
    const allEvos = EVOLUTION_IDS.filter((e) => !SECRET_UNLOCKS.includes(WEAPONS[WEAPONS[e].evolvedFrom!]?.unlock ?? '')).every((e) => this.data.pedia.includes(e));
    if (allEvos && !this.hasAchievement('full_house')) out.push(...this.grantAchievements(['full_house']));
    return out;
  }
}
