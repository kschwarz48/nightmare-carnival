// The run simulation: a fixed-timestep, render-free model of one night at the carnival.
// Owns every pool, the spatial grid, the player, the director, weapons, bosses and events.
// Port of the Godot GameState/EnemyDirector/Player/Health/Hitbox stack (docs 07–08).

import { EventBus } from '../core/events';
import { SpatialGrid } from '../core/grid';
import { clamp, dist2, segDist2, TAU } from '../core/math';
import { Rng } from '../core/rng';
import { CHARACTER_MAP } from '../data/characters';
import { CURSE, DIFFICULTY_MAP, timeScaling, type DifficultyDef } from '../data/difficulty';
import { ENEMIES, ELITE_AFFIXES, type EnemyDef } from '../data/enemies';
import { GREASE_SLICKS, MAP_HALF, PLAYER_BOUNDS, PLAYER_SPAWN, PROPS, TILT_A_WHIRL, type Prop } from '../data/map';
import { ACT_GATES, DAWN_TIME } from '../data/waves';
import { computePayout } from '../data/meta';
import type { BossBase } from './bosses/boss';
import { Director } from './director';
import { applyDraftChoice, generateDraft, grantChest, type DraftOption } from './draft';
import { updateEnemy } from './enemyAI';
import {
  BossPart, Enemy, EnemyBullet, Hazard, Pickup, PlayerProjectile, Summon, Zone,
  type BulletKind, type HazardShape, type PickupKind, type Target, type ZoneKind,
} from './entities';
import { CarnivalEvents } from './carnivalEvents';
import { QuestSystem, type QuestCue } from './quest';
import { activeMapId, MAPS, useMap, type MapDef, type MapId } from '../data/maps';
import { refreshFunhouseWalls, updateFunhouseHazards } from './funhouse';
import { dispelDecoys } from './funhouseAI';
import { HUB_NPCS } from '../data/hub';
import { CHESTS, COOP, HEALING, TICKETS, voucherValue, xpToNext } from '../data/progression';
import { FxQueue } from './fx';
import { Player } from './player';
import { Weapons } from './weapons';
import { addHazardPull, moveBody, steer } from './movement';

import { TICK, VIEW_HALF_X, VIEW_HALF_Y } from './constants';
export { TICK, VIEW_HALF_X, VIEW_HALF_Y };
const GEM_CAP = 400;
const IFRAMES = 0.45;

export interface RunConfig {
  character: string;
  difficulty: DifficultyDef['id'];
  curse: boolean;
  seed: number;
  daily?: boolean;
  dailyMod?: string;
  aimMode?: 'auto' | 'hybrid' | 'manual';
  /** Meta perks applied (axis → total). */
  meta?: { axis: string; value: number }[];
  rerolls?: number;
  banishes?: number;
  canSkip?: boolean;
  unlocked?: Set<string>;
  /** Co-op party (D-51): one entry per player; absent = solo with `character`. Player 0 uses the top-level meta/rerolls. */
  players?: { character: string; name?: string; meta?: { axis: string; value: number }[]; rerolls?: number; banishes?: number; canSkip?: boolean; aimMode?: 'auto' | 'hybrid' | 'manual' }[];
  /** Test hooks */
  godMode?: boolean;
  /** Persistent quest memory from the save (e.g. how often the Last Song was completed). */
  questMemory?: Record<string, number>;
  /**
   * The Midway hub (D-60): a peaceful walk around the first map instead of a night. `npcs` are the
   * cast to stand at their games (the hosting save's unlocked starters); `at` keeps players where they
   * stood when the hub is rebuilt for someone joining.
   */
  hub?: { npcs: string[]; at?: { x: number; y: number }[] };
  /** which map the night is on (D-63); the Carnival Core when absent */
  map?: MapId;
}

export interface InputState {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  aimActive: boolean;
  /** an interact press (E, or A on a pad) for the next tick to use; cleared once a tick has run (D-67) */
  interact?: boolean;
}

export interface RunStats {
  won: boolean;
  time: number;
  kills: number;
  bosses: number;
  bossIds: string[];
  level: number;
  lostTickets: number;
  damageDealt: number;
  damageTaken: number;
  evolutions: string[];
  weapons: { id: string; level: number; damage: number }[];
  passives: { id: string; level: number }[];
  character: string;
  difficulty: string;
  curse: boolean;
  endless: boolean;
  endlessTime: number;
  daily: boolean;
  score: number;
  maxLevelReached: number;
  enemiesSeen: string[];
  achievementsHit: string[];
  trueEnding: boolean;
  voucherTickets: number;
  questStage: number;
  /** the map the night was on (D-63) */
  map: MapId;
}

export type GameEvents = {
  levelup: { level: number };
  draft: { options: DraftOption[]; player?: number };
  draft_done: { player: number };
  boss_warning: { id: string };
  boss_spawn: { id: string };
  boss_phase: { id: string; phase: number; name: string };
  boss_defeated: { id: string; noHit: boolean };
  player_hurt: { amount: number; hp: number; player?: number };
  player_revive: { player?: number };
  player_downed: { player: number };
  shield_pop: { player?: number };
  run_end: { stats: RunStats };
  dawn: {};
  act: { act: number };
  carnival_event: { id: string; banner: string };
  chest: { items: string[]; evolution?: string; entries?: import('./draft').ChestEntry[]; rolls?: number; src?: string; opener?: number };
  evolved: { from: string; to: string };
  sfx: { id: string; x?: number; y?: number; vol?: number; pitch?: number };
  banner: { text: string; sub?: string; style?: string };
  discover: { id: string };
  pickup: { kind: PickupKind; value: number; player?: number };
  stall: {};
  music: { cue: string };
  quest: QuestCue;
  meta_currency: { amount: number; source: string; player?: number };
  balloon_drift: { x: number; y: number; dirX: number; dirY: number; size: number };
};

type Phase = 'play' | 'draft' | 'dawn' | 'ended';

export class Game {
  cfg: RunConfig;
  rng: Rng;
  bus = new EventBus<GameEvents>();
  fx = new FxQueue();
  diff: DifficultyDef;
  time = 0; // run clock (seconds)
  realTime = 0; // total simulated seconds (includes stalls/dawn)
  tickCount = 0;
  phase: Phase = 'play';
  act = 1;
  /** Every player in the run (index = network slot). */
  players: Player[] = [];
  /** Per-player input (host fills remote slots from the network). */
  inputs: InputState[] = [];
  /**
   * The *current* player context (D-51): systems written for one player (weapons, enemy AI, bosses,
   * drafts) read `player` / `input` / `weapons`, and the tick points them at the right player while
   * it updates that player's weapons, each enemy's target, each boss's target, a draft, a pickup.
   * Outside the tick they point at player 0.
   */
  player: Player;
  input: InputState;

  // pools
  enemies: Enemy[] = [];
  active: Enemy[] = []; // active enemies (unordered)
  projs: PlayerProjectile[] = [];
  bullets: EnemyBullet[] = [];
  hazards: Hazard[] = [];
  pickups: Pickup[] = [];
  zones: Zone[] = [];
  summons: Summon[] = [];
  bosses: BossBase[] = [];
  bossParts: BossPart[] = [];
  bossRemains: { id: string; x: number; y: number }[] = [];

  grid: SpatialGrid;
  director: Director;
  weapons: Weapons;
  events: CarnivalEvents;

  nextUid = 1;
  kills = 0;
  bossKills = 0;
  bossIds: string[] = [];
  level = 1;
  xp = 0;
  xpToNext = 0;
  /** The Midway hub (D-60): no night, just the grounds and the cast. */
  readonly hub: boolean;
  /** the map this night is on (D-63) */
  readonly mapId: MapId;
  readonly map: MapDef;
  /** the Fun House: seconds left of the Mirrors Shuffle (every pivot turns every 3 s) */
  pivotShuffleT = 0;
  /** the Fun House: the hidden quest has opened the dressing room's glass door */
  funhouseDoorOpen = false;
  /** the cast standing at their games in the hub */
  hubNpcs: Player[] = [];
  pendingLevels = 0;
  /** Per-player draft hands while a level-up is open; null once that player has chosen. */
  drafts: (DraftOption[] | null)[] = [];
  /** Player 0's hand (solo API). */
  get draftOptions(): DraftOption[] {
    return this.drafts[0] ?? [];
  }
  set draftOptions(v: DraftOption[]) {
    this.drafts[0] = v;
  }
  nextDraftRarity = 'common';
  /** Player 0's banished cards (solo API; each player has their own set). */
  get banished(): Set<string> {
    return this.players[0].banished;
  }
  evolutions: string[] = [];
  damageDealt = 0;
  damageTaken = 0;
  weaponDamage = new Map<string, number>();
  enemiesSeen = new Set<string>();
  gemsOnGround = 0;
  bankPickup: Pickup | null = null;
  foodTimer = 0;
  goldenTimer = 0;
  hitstop = 0;
  darkness = 0; // 0..1 (Lights Out event)
  ticketMult = 1;
  stalled = false; // clock held at 24:59 by the Ringmaster (D-01)
  victoryLap = false;
  dawnT = 0;
  endless = false;
  endlessStart = 0;
  ringmasterDefeated = false;
  /** The Ringmaster has fallen this run (a win, even if the Easter-egg finale follows). */
  ringmasterSlain = false;
  finaleActive = false;
  trueEnding = false;
  vouchersTaken = 0;
  voucherPaid = 0;
  quests!: QuestSystem;
  wonPayoutBanked = 0;
  endStats: RunStats | null = null;
  /** Per-player end-of-run stats (co-op: each client shows and banks its own). */
  endStatsAll: RunStats[] = [];
  tiltAngle = 0;
  achievementsHit = new Set<string>();
  maxGems = GEM_CAP;
  view = { hx: VIEW_HALF_X, hy: VIEW_HALF_Y };

  constructor(cfg: RunConfig) {
    this.cfg = cfg;
    this.hub = !!cfg.hub;
    // the map first: everything below reads the active layout, waves and schedule (D-63)
    this.mapId = cfg.hub ? 'carnival_core' : cfg.map ?? 'carnival_core';
    this.map = MAPS[this.mapId];
    useMap(this.mapId);
    this.rng = new Rng(cfg.seed);
    this.diff = DIFFICULTY_MAP[cfg.difficulty] ?? DIFFICULTY_MAP.midway;
    const party = cfg.players?.length ? cfg.players.slice(0, COOP.maxPlayers) : [{ character: cfg.character }];
    party.forEach((pc, i) => {
      const pl = new Player(pc.character);
      pl.index = i;
      pl.name = pc.name ?? `Player ${i + 1}`;
      const meta = i === 0 ? cfg.meta : pc.meta;
      for (const m of meta ?? []) pl.stats.apply(m.axis as any, m.value);
      if (cfg.daily && cfg.dailyMod === 'glass') {
        pl.stats.might += 0.3;
        pl.stats.maxHpMult -= 0.3;
      }
      pl.rerolls = (i === 0 ? cfg.rerolls : pc.rerolls) ?? 0;
      pl.banishes = (i === 0 ? cfg.banishes : pc.banishes) ?? 0;
      pl.canSkip = !!(i === 0 ? cfg.canSkip : pc.canSkip);
      pl.aimMode = (i === 0 ? cfg.aimMode : pc.aimMode) ?? 'auto';
      pl.initHp();
      const at = cfg.hub?.at?.[i];
      pl.x = pl.px = at?.x ?? PLAYER_SPAWN.x + (i - (party.length - 1) / 2) * 70;
      pl.y = pl.py = at?.y ?? PLAYER_SPAWN.y;
      pl.faceY = -1;
      pl.faceX = 0;
      this.players.push(pl);
      this.inputs.push({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, aimActive: false });
    });
    this.player = this.players[0];
    this.input = this.inputs[0];

    for (let i = 0; i < 560; i++) {
      const e = new Enemy();
      e.idx = i;
      this.enemies.push(e);
    }
    for (let i = 0; i < 900; i++) this.projs.push(new PlayerProjectile());
    for (let i = 0; i < 1400; i++) this.bullets.push(new EnemyBullet());
    for (let i = 0; i < 160; i++) this.hazards.push(new Hazard());
    for (let i = 0; i < 700; i++) this.pickups.push(new Pickup());
    for (let i = 0; i < 220; i++) this.zones.push(new Zone());
    for (let i = 0; i < 64; i++) this.summons.push(new Summon());

    this.grid = new SpatialGrid(-MAP_HALF - 200, -MAP_HALF - 200, MAP_HALF * 2 + 400, MAP_HALF * 2 + 400, 64, this.enemies.length);
    this.xpToNext = this.xpCurve(1);
    this.director = new Director(this);
    for (const pl of this.players) pl.weapons = new Weapons(this);
    this.weapons = this.players[0].weapons;
    this.events = new CarnivalEvents(this);
    for (const pl of this.players) {
      this.setCtx(pl);
      if (!this.hub) pl.weapons.add(pl.char.startWeapon);
    }
    this.setCtx(this.players[0]);
    // the Midway's cast: unlocked starters waiting at their games (they never move)
    for (const id of cfg.hub?.npcs ?? []) {
      const def = HUB_NPCS.find((n) => n.char === id);
      if (!def) continue;
      const npc = new Player(id);
      npc.index = -10 - this.hubNpcs.length;
      npc.name = npc.char.name;
      npc.x = npc.px = def.x;
      npc.y = npc.py = def.y;
      npc.faceY = 1;
      npc.initHp();
      npc.weapons = new Weapons(this); // empty: the renderer's animation reads it
      this.hubNpcs.push(npc);
    }
    this.foodTimer = this.rng.range(HEALING.foodFirst[0], HEALING.foodFirst[1]);
    this.goldenTimer = this.rng.range(150, 330);
    this.director.init();
    this.quests = new QuestSystem(this, this.mapId);
    if (this.mapId === 'fun_house') refreshFunhouseWalls(this);
  }

  // ------------------------------------------------------------------ party
  /** Point the single-player systems at `p` (see `player`). */
  setCtx(p: Player): void {
    this.player = p;
    this.input = this.inputs[p.index];
    this.weapons = p.weapons;
  }
  /** Weapon and passive slots per player for this party size (weapons as VS: 6 / 4 / 3 / 2; passives half as steep, D-61). */
  get slots(): { weapons: number; passives: number } {
    const i = Math.min(COOP.slots.length - 1, this.players.length);
    return { weapons: COOP.slots[i], passives: COOP.passiveSlots[i] };
  }
  get coop(): boolean {
    return this.players.length > 1;
  }
  /** Party-size scaling (D-51): crowd density and enemy/boss toughness. Both 1 in solo. */
  get partyScale(): { density: number; hp: number; xp: number; xpGain: number } {
    const i = Math.min(COOP.density.length - 1, this.players.length);
    return { density: COOP.density[i], hp: COOP.hp[i], xp: COOP.xp[i], xpGain: COOP.xpGain[i] ?? 1 };
  }
  /** Is this player up and fighting? */
  isUp(p: Player): boolean {
    return !p.dead && !p.downed;
  }
  /** The nearest player still standing (falls back to player 0 when nobody is). */
  nearestLiving(x: number, y: number): Player {
    let best = this.players[0], bd = Infinity;
    for (const p of this.players) {
      if (!this.isUp(p)) continue;
      const d = dist2(p.x, p.y, x, y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }
  /** A random standing player to anchor spawns and drops around. */
  spawnAnchor(): Player {
    if (this.players.length === 1) return this.players[0];
    const up = this.players.filter((p) => this.isUp(p));
    return up.length ? up[this.rng.int(0, up.length - 1)] : this.players[0];
  }
  /** Inside some standing player's view rectangle (scaled)? */
  inAnyView(x: number, y: number, k = 1): boolean {
    for (const p of this.players) {
      if (!this.isUp(p)) continue;
      if (Math.abs(x - p.x) < VIEW_HALF_X * k && Math.abs(y - p.y) < VIEW_HALF_Y * k) return true;
    }
    return false;
  }
  private bossTargetFor(b: BossBase): Player {
    if (this.players.length === 1) return this.players[0];
    const st = b as BossBase & { _tgt?: number; _tgtT?: number };
    st._tgtT = (st._tgtT ?? 0) - TICK;
    const cur = this.players[st._tgt ?? 0];
    if (st._tgtT <= 0 || !cur || !this.isUp(cur)) {
      st._tgt = this.nearestLiving(b.x, b.y).index;
      st._tgtT = COOP.bossRetarget;
    }
    return this.players[st._tgt ?? 0];
  }

  // ------------------------------------------------------------------ tick
  /** Advance one fixed step (TICK seconds). */
  tick(): void {
    this.step();
    // an interact press is good for the one tick that sees it (D-67)
    for (const i of this.inputs) i.interact = false;
  }

  private step(): void {
    if (activeMapId() !== this.mapId) useMap(this.mapId); // another game may have switched maps (tests, the attract demo)
    if (this.hub) return this.tickHub();
    if (this.phase === 'ended' || this.phase === 'draft') return;
    let dt = TICK;
    if (this.hitstop > 0) {
      this.hitstop -= TICK;
      dt *= 0.12;
    }
    this.tickCount++;
    this.realTime += dt;

    if (this.phase === 'dawn') {
      this.updateDawn(dt);
      return;
    }

    // Run clock (D-01: stall at 24:59 while the Ringmaster lives).
    if (!this.endless && this.time + dt >= DAWN_TIME - 1 && !this.ringmasterDefeated) {
      const rm = this.bosses.find((b) => b.def.id === this.map.finalBoss);
      if (rm || this.time >= DAWN_TIME - 60) {
        if (!this.stalled) {
          this.stalled = true;
          this.bus.emit('stall', {});
          if (this.finaleActive) this.bus.emit('banner', { ...this.map.quest.hold, style: 'danger' });
          else this.bus.emit('banner', { text: `${(this.map.bosses.find((b) => b.id === this.map.finalBoss)?.name ?? 'The Ringmaster').toUpperCase()} HOLDS BACK THE DAWN!`, sub: 'Defeat him to end the night', style: 'danger' });
        }
        this.time = DAWN_TIME - 1;
      } else this.time += dt;
    } else {
      this.time += dt;
    }
    this.updateAct();

    for (const pl of this.players) {
      this.setCtx(pl);
      if (pl.downed) this.updateDowned(pl, dt);
      else if (!pl.dead) this.updatePlayer(dt);
    }
    const p0 = this.players[0];
    const multi = this.players.length > 1;
    this.setCtx(p0);
    this.rebuildGrid();
    this.director.update(dt);
    if (multi) this.setCtx(this.players[Math.floor(this.time / 15) % this.players.length]);
    this.events.update(dt);
    this.setCtx(p0);
    this.quests.update(dt);
    for (let i = 0; i < this.active.length; i++) {
      const e = this.active[i];
      e.px = e.x;
      e.py = e.y;
      if (multi) this.setCtx(this.nearestLiving(e.x, e.y));
      updateEnemy(this, e, dt);
      this.updateStatuses(e, dt);
    }
    this.setCtx(p0);
    this.separate(dt);
    for (const b of this.bosses) {
      if (multi) this.setCtx(this.bossTargetFor(b));
      b.update(dt);
    }
    this.setCtx(p0);
    if (this.bosses.length) this.bosses = this.bosses.filter((b) => !b.removed);
    for (const pl of this.players) {
      this.setCtx(pl);
      if (this.isUp(pl)) pl.weapons.update(dt);
      pl.weapons.updateProjectiles(dt);
      pl.weapons.updateSummons(dt);
    }
    this.setCtx(p0);
    this.updateBullets(dt);
    this.updateHazards(dt);
    this.updateZones(dt);
    this.updatePickups(dt);
    this.updateContact();
    for (const pl of this.players) {
      if (!this.isUp(pl)) continue;
      this.setCtx(pl);
      this.updateMapHazards(dt);
    }
    this.setCtx(p0);
    if (this.mapId === 'fun_house') this.updateFunhouse(dt);
    this.updateTimers(dt);
    this.cleanupDead();

    // Dawn trigger (D-01).
    if (!this.endless && this.ringmasterDefeated && this.time >= DAWN_TIME - 1e-6 && this.phase === 'play') this.beginDawn();
    if (this.endless) this.checkEndlessAchievements();
  }

  /** The Midway (D-60): nothing spawns, nothing fights, the clock stands still; the party walks the grounds. */
  private tickHub(): void {
    if (activeMapId() !== this.mapId) useMap(this.mapId);
    const dt = TICK;
    this.tickCount++;
    this.realTime += dt;
    for (const p of this.players) {
      this.setCtx(p);
      p.px = p.x;
      p.py = p.y;
      const [mx, my] = steer(p, this.input.moveX, this.input.moveY);
      const speed = p.stats.moveSpeed();
      moveBody(p, mx, my, speed, dt, this.bosses, false);
      p.animT += dt * (p.moving ? speed / 220 : 0.4);
    }
    for (const n of this.hubNpcs) n.animT += dt * 0.4;
    this.setCtx(this.players[0]);
  }

  private updateAct(): void {
    let a = 1;
    for (const g of ACT_GATES) if (this.time >= g) a++;
    if (a !== this.act) {
      this.act = a;
      this.bus.emit('act', { act: a });
    }
  }

  // ------------------------------------------------------------------ player
  private updatePlayer(dt: number): void {
    const p = this.player;
    p.px = p.x;
    p.py = p.y;
    const [mx, my] = steer(p, this.input.moveX, this.input.moveY);
    let slow = 1;
    if (p.slowT > 0) {
      p.slowT -= dt;
      slow = p.slowF;
    } else p.slowF = 1;
    for (const z of this.zones) {
      if (z.alive && z.harmful && z.slow > 0 && dist2(z.x, z.y, p.x, p.y) < z.r * z.r) slow = Math.min(slow, 1 - z.slow);
    }
    const speed = p.stats.moveSpeed() * slow;
    const dashing = p.dashT > 0;
    if (dashing) p.dashT -= dt;
    moveBody(p, mx, my, speed, dt, this.bosses, dashing);
    if (p.moving || p.dashT > 0) p.animT += dt * (speed / 220);
    else p.animT += dt * 0.4;

    if (p.iframes > 0) p.iframes -= dt;
    if (p.hurtFlash > 0) p.hurtFlash -= dt;
    // Regen
    if (p.stats.regen > 0 && p.hp < p.stats.maxHp()) {
      p.regenAcc += p.stats.regen * dt;
      if (p.regenAcc >= 1) {
        const w = Math.floor(p.regenAcc);
        p.hp = Math.min(p.stats.maxHp(), p.hp + w);
        p.regenAcc -= w;
      }
    }
    // Lost Child balloon shield regrow (D-11).
    if (p.char.quirk === 'balloon_shield' && !p.shieldReady) {
      p.shieldT -= dt;
      if (p.shieldT <= 0) {
        p.shieldReady = true;
        this.bus.emit('sfx', { id: 'inflate' });
      }
    }
    // Ride Operator spark trail (D-13).
    if (p.char.quirk === 'spark_trail' && (p.moving || p.dashT > 0)) {
      p.sparkAcc += dt;
      if (p.sparkAcc >= 0.11) {
        p.sparkAcc = 0;
        const z = this.spawnZone('spark', p.x, p.y, 24 * p.stats.area, 1.3, 5 * p.stats.might, 0.35);
        if (z) z.slow = 0;
      }
    }
  }

  /** Damage the player (contact, bullets, hazards). Returns true if damage landed. */
  hurtPlayer(amount: number, srcX: number, srcY: number, opts: { slow?: number; slowT?: number; burn?: boolean; ignoreIframes?: boolean } = {}): boolean {
    const p = this.player;
    if (p.dead || p.downed || this.phase !== 'play') return false;
    if (p.iframes > 0 && !opts.ignoreIframes) return false;
    if (p.dashT > 0) return false; // bumper surge i-frames
    if (this.cfg.godMode) {
      p.iframes = IFRAMES;
      return false;
    }
    if (opts.slow) {
      p.slowF = Math.min(p.slowF, 1 - opts.slow);
      p.slowT = Math.max(p.slowT, opts.slowT ?? 1);
    }
    // Lost Child balloon shield absorbs the hit entirely.
    if (p.shieldReady) {
      p.shieldReady = false;
      p.shieldT = 20 * p.stats.cooldown;
      p.iframes = IFRAMES * 1.6;
      this.fx.push('death', p.x, p.y - 30, 1, 0, 0, 'pop');
      this.bus.emit('shield_pop', { player: p.index });
      this.bus.emit('sfx', { id: 'pop', vol: 1.2 });
      return false;
    }
    const dmg = Math.max(1, amount - p.stats.armor);
    p.hp -= dmg;
    p.iframes = IFRAMES;
    p.hurtFlash = 0.3;
    p.bossDamageTaken += dmg;
    this.damageTaken += dmg;
    this.bus.emit('player_hurt', { amount: dmg, hp: p.hp, player: p.index });
    this.fx.push('shake', p.x, p.y, Math.min(1, 0.25 + dmg / 40));
    if (p.stats.knockbackShove > 0) {
      this.forEachEnemyInCircle(p.x, p.y, 95, (e) => this.knockback(e, p.x, p.y, p.stats.knockbackShove));
    }
    if (p.hp <= 0) this.playerDown();
    return true;
  }

  /**
   * A fallen co-op player (D-51): a coffin that fills over `COOP.reviveAlone` seconds, or
   * `COOP.reviveAssisted` with a standing teammate close by.
   */
  private updateDowned(p: Player, dt: number): void {
    p.px = p.x;
    p.py = p.y;
    p.vx = p.vy = 0;
    let assisted = false;
    for (const o of this.players) if (o !== p && this.isUp(o) && dist2(o.x, o.y, p.x, p.y) < COOP.reviveRadius * COOP.reviveRadius) assisted = true;
    p.reviveAssist = assisted;
    p.reviveT = Math.min(1, p.reviveT + dt / (assisted ? COOP.reviveAssisted : COOP.reviveAlone));
    if (p.reviveT >= 1) {
      p.downed = false;
      p.reviveT = 0;
      p.hp = p.stats.maxHp() * COOP.reviveHpFrac;
      p.iframes = 2.2;
      p.reviveFx = 1.5;
      this.fx.push('ring', p.x, p.y, 200, 0, 0, 'revive');
      this.bus.emit('player_revive', { player: p.index });
      this.bus.emit('sfx', { id: 'revive' });
    }
  }

  private playerDown(): void {
    const p = this.player;
    if (p.stats.revives > 0) {
      p.stats.revives--;
      p.hp = p.stats.maxHp() * 0.5;
      p.iframes = 2.2;
      p.reviveFx = 1.5;
      this.fx.push('ring', p.x, p.y, 260, 0, 0, 'revive');
      this.fx.push('flash', p.x, p.y, 0.6);
      this.forEachEnemyInCircle(p.x, p.y, 260, (e) => {
        this.damageEnemy(e, 60 * p.stats.might, false, 4, p.x, p.y, 'revive');
      });
      this.bus.emit('player_revive', { player: p.index });
      this.bus.emit('sfx', { id: 'revive' });
      return;
    }
    if (this.players.some((o) => o !== p && this.isUp(o))) {
      // co-op: fall into a coffin until revived
      p.downed = true;
      p.hp = 0;
      p.reviveT = 0;
      p.dashT = 0;
      this.fx.push('death', p.x, p.y - 20, 1.2, 0, 0, 'pop');
      this.bus.emit('player_downed', { player: p.index });
      this.bus.emit('sfx', { id: 'toll', vol: 0.7 });
      return;
    }
    for (const o of this.players) o.dead = true;
    this.endRun(false);
  }

  healPlayer(amount: number): void {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(p.stats.maxHp(), p.hp + amount);
    if (p.hp > before) this.fx.push('heal', p.x, p.y - 20, p.hp - before);
  }

  // ------------------------------------------------------------------ enemies
  spawnEnemy(defId: string, x: number, y: number, opts: { elite?: boolean; noScale?: boolean; hpMult?: number } = {}): Enemy | null {
    const def = ENEMIES[defId];
    if (!def) return null;
    if (this.active.length >= this.enemies.length) return null;
    let e: Enemy | null = null;
    for (let i = 0; i < this.enemies.length; i++) {
      const c = this.enemies[(this.nextUid + i) % this.enemies.length];
      if (!c.alive && !c.inActive) {
        e = c;
        break;
      }
    }
    if (!e) return null;
    const minutes = this.time / 60;
    const endlessMin = this.endless ? Math.max(0, (this.time - this.endlessStart) / 60) : 0;
    const sc = opts.noScale ? { hp: 1, dmg: 1, speed: 1, tickets: 1 } : timeScaling(minutes, endlessMin);
    const curseHp = this.cfg.curse ? CURSE.hpMult : 1;
    const curseSpd = this.cfg.curse ? CURSE.speedMult : 1;
    const elite = !!opts.elite && def.canElite;
    e.alive = true;
    e.uid = this.nextUid++;
    e.def = def;
    e.x = e.px = clamp(x, -MAP_HALF + 10, MAP_HALF - 10);
    e.y = e.py = clamp(y, -MAP_HALF + 10, MAP_HALF - 10);
    e.vx = e.vy = 0;
    e.elite = elite;
    e.affixes.length = 0;
    e.shield = 0;
    const eliteHp = elite ? 6 : 1;
    e.maxHp = e.hp = def.hp * sc.hp * this.diff.hpMult * curseHp * eliteHp * (opts.hpMult ?? 1) * this.partyScale.hp;
    e.dmg = def.contact * sc.dmg * this.diff.dmgMult * (elite ? 1.5 : 1);
    e.speed = def.speed * sc.speed * curseSpd * (elite ? 0.85 : 1);
    e.tickets = Math.max(1, Math.round(def.tickets * sc.tickets * (elite ? 5 : 1)));
    e.r = def.radius * (elite ? 1.3 : 1);
    e.scale = elite ? 1.3 : 1;
    e.state = 0;
    e.t = 0;
    e.t2 = 0;
    e.n1 = 0;
    e.n2 = 0;
    e.tx = e.ty = 0;
    e.dirX = 1;
    e.dirY = 0;
    e.group = -1;
    e.hidden = false;
    e.invuln = false;
    e.noContact = false;
    e.illusion = false;
    e.illusionOf = -1;
    e.noSep = false;
    e.leashExempt = false;
    e.kbT = 0;
    e.slowT = 0;
    e.slowF = 1;
    e.chill = 0;
    e.chillT = 0;
    e.frozenT = 0;
    e.burnT = 0;
    e.stickyT = 0;
    e.flash = 0;
    e.face = 1;
    e.animT = this.rng.next() * 10;
    e.spawnT = 0;
    e.windup = 0;
    e.trail = null;
    if (elite && this.diff.eliteAffixes > 0) {
      const pool = ELITE_AFFIXES.slice();
      this.rng.shuffle(pool);
      for (let i = 0; i < this.diff.eliteAffixes; i++) e.affixes.push(pool[i]);
      if (e.affixes.includes('shielded')) e.shield = 4;
      if (e.affixes.includes('hasted')) e.speed = def.speed * sc.speed * curseSpd * 1.15;
    }
    e.inActive = true;
    this.active.push(e);
    if (!this.enemiesSeen.has(def.id)) {
      this.enemiesSeen.add(def.id);
      this.bus.emit('discover', { id: def.id });
    }
    return e;
  }

  /** The Fun House's walls and machinery, once per tick (D-63). */
  private updateFunhouse(dt: number): void {
    if (this.pivotShuffleT > 0) this.pivotShuffleT = Math.max(0, this.pivotShuffleT - dt);
    refreshFunhouseWalls(this);
    updateFunhouseHazards(this, dt);
  }

  /** Recycle without a kill (leash despawn, flyby exit, trap popped). */
  despawnEnemy(e: Enemy): void {
    if (!e.alive) return;
    e.alive = false;
  }

  killEnemy(e: Enemy, srcWeapon = ''): void {
    if (!e.alive) return;
    e.alive = false;
    const d = e.def;
    if (e.illusion) {
      // a Reflection Thief's decoy: it was never there
      this.fx.push('death', e.x, e.y, e.scale * (d.drawScale * d.radius) / 40, 0, 0, 'glass');
      return;
    }
    this.kills++;
    if (d.behavior === 'ambusher' || d.behavior === 'brute' || d.behavior === 'line_charger' || d.behavior === 'rail_strafer') this.clearHazardsOf(e.uid);
    this.dropTickets(e.x, e.y, e.tickets);
    this.fx.push('death', e.x, e.y, e.scale * (d.drawScale * d.radius) / 34, e.elite ? 1 : 0, 0, d.deathFx);
    this.bus.emit('sfx', { id: d.deathSfx, x: e.x, y: e.y, vol: e.elite ? 1 : 0.55 });
    if (d.dropsChest && this.rng.chance(CHESTS.bruteChance)) {
      const ch = this.spawnPickup('chest', e.x, e.y, 0);
      ch.rolls = this.rng.int(CHESTS.bruteRolls[0], CHESTS.bruteRolls[1]);
      ch.src = 'brute';
    } else if (e.elite && this.rng.chance(CHESTS.eliteChance / this.partyScale.density)) {
      // a party's denser crowd brings more elites; the chest odds shrink to match
      const ch = this.spawnPickup('chest', e.x, e.y, 0);
      ch.rolls = 1;
      ch.src = 'elite';
    }
    // Elite specials & affixes.
    if (e.elite) {
      if (d.id === 'possessed_stuffie' || e.affixes.includes('splitter')) {
        for (let i = 0; i < (d.id === 'possessed_stuffie' ? 2 : 3); i++) this.spawnEnemy('mini_stuffie', e.x + this.rng.range(-30, 30), e.y + this.rng.range(-30, 30));
      }
      if (e.affixes.includes('explosive')) {
        this.spawnHazard('circle', 'explosive', e.x, e.y, { r: 90, tele: 0.75, dmg: 14 * this.diff.dmgMult });
      }
    }
    // Blizzard: frozen enemies shatter for AoE.
    const bzOwner = e.frozenT > 0 ? this.players.find((pl) => pl.weapons.has('blizzard')) : undefined;
    if (bzOwner) {
      const w = bzOwner.weapons.get('blizzard')!;
      const dmg = 40 * this.player.stats.might;
      this.fx.push('explosion', e.x, e.y, 70, 0, 0, 'frost');
      this.forEachTargetInCircle(e.x, e.y, 70, (t) => this.damageTarget(t, dmg, false, 0.5, e.x, e.y, w.def.id));
    }
    if (d.behavior === 'thief') dispelDecoys(this, e.uid);
    // the Splitter comes apart into smaller ones (D-63)
    if (d.splitInto) {
      for (let i = 0; i < (d.splitCount ?? 2); i++) {
        const a = this.rng.angle();
        const c = this.spawnEnemy(d.splitInto, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r);
        if (c) this.knockback(c, e.x, e.y, 2.2);
      }
    }
    this.events.onKill(e);
    this.quests.onKill(e);
    this.director.onKill(e);
  }

  /**
   * The single damage entry point for enemies (doc 08 damage formula: base × might × crit,
   * defender applies modifiers). Returns damage dealt.
   */
  damageEnemy(e: Enemy, amount: number, crit: boolean, kb: number, srcX: number, srcY: number, weapon: string): number {
    if (!e.alive || e.hidden || e.invuln) return 0;
    if (e.shield > 0) {
      e.shield--;
      e.flash = 1;
      this.fx.push('spark', e.x, e.y, 1, 0, 0, 'shield');
      return 0;
    }
    let dmg = amount;
    if (e.frozenT > 0) dmg *= 1.25;
    e.hp -= dmg;
    e.flash = 1;
    this.damageDealt += dmg;
    if (weapon) this.weaponDamage.set(weapon, (this.weaponDamage.get(weapon) ?? 0) + dmg);
    this.fx.push('dmgnum', e.x, e.y - e.r * 2, dmg, crit ? 1 : 0);
    if (kb > 0 && e.def.knockbackTaken > 0) this.knockback(e, srcX, srcY, kb * e.def.knockbackTaken);
    if (e.hp <= 0) this.killEnemy(e, weapon);
    return dmg;
  }

  /** 120 ms reversed movement push (doc 06 §1). */
  knockback(e: Enemy, srcX: number, srcY: number, mult: number): void {
    if (e.def.knockbackTaken <= 0 || e.def.behavior === 'rail_strafer') return;
    let dx = e.x - srcX, dy = e.y - srcY;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    e.kbT = 0.12;
    const s = Math.max(60, e.speed) * mult;
    e.kbX = dx * s;
    e.kbY = dy * s;
  }

  damageTarget(t: Target, amount: number, crit: boolean, kb: number, srcX: number, srcY: number, weapon: string): number {
    if (t.isBoss) {
      const part = t as BossPart;
      for (const b of this.bosses) {
        if (b.parts.includes(part)) {
          const d = b.takeDamage(part, amount, crit);
          if (d > 0) {
            this.damageDealt += d;
            if (weapon) this.weaponDamage.set(weapon, (this.weaponDamage.get(weapon) ?? 0) + d);
            this.fx.push('dmgnum', part.x + this.rng.range(-20, 20), part.y - part.r * 0.6, d, crit ? 1 : 0);
          }
          return d;
        }
      }
      return 0;
    }
    return this.damageEnemy(t as Enemy, amount, crit, kb, srcX, srcY, weapon);
  }

  private updateStatuses(e: Enemy, dt: number): void {
    if (!e.alive) return;
    e.spawnT += dt;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 7);
    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) e.slowF = 1;
    }
    if (e.chillT > 0) {
      e.chillT -= dt;
      if (e.chillT <= 0) e.chill = 0;
    }
    if (e.frozenT > 0) e.frozenT -= dt;
    if (e.burnT > 0) {
      e.burnT -= dt;
      e.burnAcc += e.burnDps * dt;
      if (e.burnAcc >= 3) {
        const d = e.burnAcc;
        e.burnAcc = 0;
        this.damageEnemy(e, d, false, 0, e.x, e.y, 'burn');
        if (this.rng.chance(0.3)) this.fx.push('spark', e.x, e.y - 10, 1, 0, 0, 'fire');
      }
    }
    if (e.alive && e.stickyT > 0) {
      e.stickyT -= dt;
      e.burnAcc += e.stickyDps * dt;
      if (e.burnAcc >= 3) {
        const d = e.burnAcc;
        e.burnAcc = 0;
        this.damageEnemy(e, d, false, 0, e.x, e.y, 'cotton');
      }
    }
  }

  /** Effective speed multiplier from statuses (used by AI). */
  slowFactor(e: Enemy): number {
    if (e.frozenT > 0) return 0;
    let f = e.slowF;
    if (e.chill > 0) f *= Math.max(0.5, 1 - e.chill * 0.08);
    if (e.stickyT > 0) f *= 0.6;
    return f;
  }

  applyChill(e: Enemy, stacks: number, freezeTime: number): void {
    if (!e.alive) return;
    e.chill += stacks;
    e.chillT = 2.5;
    if (e.chill >= 5) {
      e.chill = 0;
      e.frozenT = freezeTime;
      this.fx.push('spark', e.x, e.y, 2, 0, 0, 'ice');
    }
  }

  rebuildGrid(): void {
    this.grid.clear();
    const a = this.active;
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e.alive) this.grid.insert(e.idx, e.x, e.y);
    }
  }

  /** Cheap separation + soft body collision so crowds pack instead of stacking (doc 04). */
  private separate(dt: number): void {
    const a = this.active;
    const en = this.enemies;
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (!e.alive || e.noSep || e.hidden) continue;
      const rr = e.def.sep * e.scale;
      let px = 0, py = 0;
      this.grid.query(e.x, e.y, rr, (id) => {
        const o = en[id];
        if (o === e || !o.alive || o.noSep || o.hidden) return;
        const dx = e.x - o.x, dy = e.y - o.y;
        const d2 = dx * dx + dy * dy;
        const lim = (rr + o.def.sep * o.scale) * 0.5;
        if (d2 < lim * lim && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const k = (1 - d / lim);
          px += (dx / d) * k;
          py += (dy / d) * k;
        } else if (d2 <= 0.0001) {
          px += (e.idx % 7) - 3;
          py += (e.idx % 5) - 2;
        }
      });
      const push = 70 * dt * (e.def.behavior === 'brute' ? 0.3 : 1);
      e.x += px * push;
      e.y += py * push;
    }
  }

  private updateContact(): void {
    for (const pl of this.players) {
      if (!this.isUp(pl)) continue;
      this.setCtx(pl);
      this.contactFor();
      for (const b of this.bosses) b.contactCheck();
    }
    this.setCtx(this.players[0]);
  }

  private contactFor(): void {
    const p = this.player;
    if (p.iframes > 0 || p.dead || p.downed) return;
    let hit: Enemy | null = null;
    this.grid.query(p.x, p.y, p.r + 40, (id) => {
      const e = this.enemies[id];
      if (!e.alive || e.hidden || e.noContact || e.illusion) return;
      if (e.def.behavior === 'rail_strafer') return; // snake contact handled per segment in its AI
      const rr = e.r * 0.85 + p.r;
      if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        if (!hit || e.dmg > hit.dmg) hit = e;
      }
    });
    if (hit) {
      const h = hit as Enemy;
      const slow = h.def.contactSlow ?? 0;
      this.hurtPlayer(h.dmg, h.x, h.y, slow ? { slow: h.elite ? slow + 0.15 : slow, slowT: h.def.contactSlowTime } : {});
    }
  }

  // ------------------------------------------------------------------ queries
  forEachEnemyInCircle(x: number, y: number, r: number, cb: (e: Enemy) => void): void {
    const en = this.enemies;
    this.grid.query(x, y, r + 40, (id) => {
      const e = en[id];
      if (!e.alive || e.hidden) return;
      const rr = r + e.r;
      if (dist2(e.x, e.y, x, y) <= rr * rr) cb(e);
    });
  }

  forEachTargetInCircle(x: number, y: number, r: number, cb: (t: Target) => void): void {
    this.forEachEnemyInCircle(x, y, r, cb);
    for (const part of this.bossParts) {
      if (!part.alive || part.invuln) continue;
      const rr = r + part.r;
      if (dist2(part.x, part.y, x, y) <= rr * rr) cb(part);
    }
  }

  forEachTargetOnSegment(ax: number, ay: number, bx: number, by: number, w: number, cb: (t: Target) => void): void {
    const cx = (ax + bx) / 2, cy = (ay + by) / 2;
    const half = Math.hypot(bx - ax, by - ay) / 2 + w + 40;
    const en = this.enemies;
    this.grid.query(cx, cy, half, (id) => {
      const e = en[id];
      if (!e.alive || e.hidden) return;
      const rr = w + e.r;
      if (segDist2(e.x, e.y, ax, ay, bx, by) <= rr * rr) cb(e);
    });
    for (const part of this.bossParts) {
      if (!part.alive || part.invuln) continue;
      const rr = w + part.r;
      if (segDist2(part.x, part.y, ax, ay, bx, by) <= rr * rr) cb(part);
    }
  }

  nearestTarget(x: number, y: number, maxR: number): Target | null {
    let best: Target | null = null;
    let bd = maxR * maxR;
    const en = this.enemies;
    // expanding search keeps this cheap with big crowds
    for (const r of [200, 450, maxR]) {
      if (r > maxR && r !== maxR) continue;
      this.grid.query(x, y, r, (id) => {
        const e = en[id];
        if (!e.alive || e.hidden) return;
        const d = dist2(e.x, e.y, x, y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      });
      if (best) break;
    }
    for (const part of this.bossParts) {
      if (!part.alive || part.invuln) continue;
      const d = dist2(part.x, part.y, x, y) - part.r * part.r;
      if (d < bd) {
        bd = d;
        best = part;
      }
    }
    return best;
  }

  randomTarget(x: number, y: number, r: number): Target | null {
    let chosen: Target | null = null;
    let n = 0;
    const en = this.enemies;
    this.grid.query(x, y, r, (id) => {
      const e = en[id];
      if (!e.alive || e.hidden) return;
      if (dist2(e.x, e.y, x, y) > r * r) return;
      n++;
      if (this.rng.next() * n < 1) chosen = e; // reservoir sample
    });
    for (const part of this.bossParts) {
      if (!part.alive || part.invuln) continue;
      if (dist2(part.x, part.y, x, y) > r * r) continue;
      n += 3;
      if (this.rng.next() * n < 3) chosen = part;
    }
    return chosen;
  }

  findTargetByUid(uid: number): Target | null {
    if (uid <= 0) return null;
    for (const e of this.active) if (e.uid === uid && e.alive) return e;
    for (const p of this.bossParts) if (p.uid === uid && p.alive && !p.invuln) return p;
    return null;
  }

  // ------------------------------------------------------------------ projectiles & summons
  spawnProj(): PlayerProjectile | null {
    for (let i = 0; i < this.projs.length; i++) {
      const p = this.projs[i];
      if (!p.alive) {
        p.alive = true;
        p.gen = (p.gen + 1) & 255;
        p.owner = this.player.index;
        p.hits.reset();
        p.rehit = -1;
        p.homing = 0;
        p.target = -1;
        p.returning = false;
        p.bounces = 0;
        p.mult = 1;
        p.flag = 0;
        p.arc = 0;
        p.rot = 0;
        p.spin = 0;
        p.crit = 0;
        p.area = 1;
        return p;
      }
    }
    return null;
  }



  spawnSummon(): Summon | null {
    for (const s of this.summons) {
      if (!s.alive) {
        s.alive = true;
        s.gen = (s.gen + 1) & 255;
        s.owner = this.player.index;
        s.hits.reset();
        s.state = 0;
        s.t = 0;
        s.cd = 0;
        s.target = -1;
        s.variant = 0;
        return s;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ enemy bullets
  spawnBullet(kind: BulletKind, x: number, y: number, vx: number, vy: number, dmg: number, opts: Partial<EnemyBullet> = {}): EnemyBullet | null {
    for (const b of this.bullets) {
      if (!b.alive) {
        b.alive = true;
        b.gen = (b.gen + 1) & 255;
        b.kind = kind;
        b.x = b.px = x;
        b.y = b.py = y;
        b.vx = vx;
        b.vy = vy;
        b.ax = b.ay = 0;
        b.dmg = dmg;
        b.r = 7;
        b.life = b.maxLife = 5;
        b.rot = Math.atan2(vy, vx);
        b.spin = 0;
        b.bounce = 0;
        b.z = 0;
        b.vz = 0;
        b.grav = 0;
        b.turn = 0;
        b.homing = 0;
        b.returnAt = -1;
        b.onLand = 0;
        Object.assign(b, opts);
        if (opts.life !== undefined) b.maxLife = opts.life;
        return b;
      }
    }
    return null;
  }

  private updateBullets(dt: number): void {
    const multi = this.players.length > 1;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.px = b.x;
      b.py = b.y;
      b.life -= dt;
      if (b.life <= 0) {
        b.alive = false;
        continue;
      }
      if (b.turn !== 0) {
        const c = Math.cos(b.turn * dt), s = Math.sin(b.turn * dt);
        const nvx = b.vx * c - b.vy * s;
        b.vy = b.vx * s + b.vy * c;
        b.vx = nvx;
      }
      if (b.homing > 0) {
        const p = multi ? this.nearestLiving(b.x, b.y) : this.player;
        const want = Math.atan2(p.y - b.y, p.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        let d = want - cur;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        const turn = clamp(d, -b.homing * dt, b.homing * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(cur + turn) * sp;
        b.vy = Math.sin(cur + turn) * sp;
      }
      if (b.returnAt >= 0 && b.maxLife - b.life >= b.returnAt) {
        b.returnAt = -1;
        b.vx = -b.vx;
        b.vy = -b.vy;
      }
      b.vx += b.ax * dt;
      b.vy += b.ay * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      if (b.grav > 0) {
        b.vz -= b.grav * dt;
        b.z += b.vz * dt;
        if (b.z <= 0) {
          b.z = 0;
          if (b.onLand) {
            this.spawnHazard('circle', 'crater', b.x, b.y, { r: 70, tele: 0.01, active: 0.25, dmg: b.dmg });
            this.fx.push('explosion', b.x, b.y, 70, 0, 0, 'boss');
            this.bus.emit('sfx', { id: 'boom', x: b.x, y: b.y, vol: 0.6 });
            b.alive = false;
            continue;
          }
        }
      }
      if (b.bounce > 0) {
        const a = this.arenaBounds();
        if (b.x < a.minX || b.x > a.maxX) {
          b.vx = -b.vx;
          b.bounce--;
        }
        if (b.y < a.minY || b.y > a.maxY) {
          b.vy = -b.vy;
          b.bounce--;
        }
      }
      if (Math.abs(b.x) > MAP_HALF + 300 || Math.abs(b.y) > MAP_HALF + 300) {
        b.alive = false;
        continue;
      }
      if (b.z > 24) continue; // still airborne
      for (const p of this.players) {
        if (!this.isUp(p)) continue;
        const rr = b.r + p.r * 0.8;
        if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
          this.setCtx(p);
          if (this.hurtPlayer(b.dmg, b.x, b.y)) {
            if (b.kind !== 'ring' && b.kind !== 'spoke' && b.kind !== 'crown') {
              b.alive = false;
              break;
            }
          }
        }
      }
    }
    this.setCtx(this.players[0]);
  }

  /** Bounce box for bouncing bullets (around the player's screen). */
  arenaBounds() {
    const p = this.player;
    return { minX: p.x - VIEW_HALF_X, maxX: p.x + VIEW_HALF_X, minY: p.y - VIEW_HALF_Y, maxY: p.y + VIEW_HALF_Y };
  }

  // ------------------------------------------------------------------ hazards
  spawnHazard(shape: HazardShape, style: string, x: number, y: number, o: Partial<Hazard> = {}): Hazard {
    let h: Hazard | null = null;
    for (const c of this.hazards) {
      if (!c.alive) {
        h = c;
        break;
      }
    }
    if (!h) {
      h = new Hazard();
      this.hazards.push(h);
    }
    h.alive = true;
    h.gen = (h.gen + 1) & 255;
    h.shape = shape;
    h.style = style;
    h.x = x;
    h.y = y;
    h.x2 = o.x2 ?? x;
    h.y2 = o.y2 ?? y;
    h.r = o.r ?? 50;
    h.r2 = o.r2 ?? 0;
    h.angle = o.angle ?? 0;
    h.half = o.half ?? 0.5;
    h.tele = h.teleMax = o.tele ?? 1;
    h.active = h.activeMax = o.active ?? 0.15;
    h.dmg = o.dmg ?? 10;
    h.tick = o.tick ?? 0;
    h.tickAcc = 0;
    h.hitPlayer = false;
    h.hitMask = 0;
    h.vx = o.vx ?? 0;
    h.vy = o.vy ?? 0;
    h.grow = o.grow ?? 0;
    h.spinRate = o.spinRate ?? 0;
    h.len = o.len ?? 0;
    h.pull = o.pull ?? 0;
    h.pullR = o.pullR ?? 0;
    h.slow = o.slow ?? 0;
    h.burn = o.burn ?? 0;
    h.owner = o.owner ?? 0;
    h.t = 0;
    h.onActivate = o.onActivate ?? null;
    h.followPlayer = o.followPlayer ?? 0;
    h.safe = o.safe ?? false;
    h.gapHalf = o.gapHalf ?? 0;
    h.holeX = o.holeX ?? 0;
    h.holeY = o.holeY ?? 0;
    h.holeR = o.holeR ?? 0;
    h.tag = o.tag ?? -1;
    return h;
  }

  private updateHazards(dt: number): void {
    for (const h of this.hazards) {
      if (!h.alive) continue;
      h.t += dt;
      if (h.followPlayer > 0 && h.tele > 0) {
        const p = this.nearestLiving(h.x, h.y);
        const k = Math.min(1, h.followPlayer * dt);
        h.x += (p.x - h.x) * k;
        h.y += (p.y - h.y) * k;
      }
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.x2 += h.vx * dt;
      h.y2 += h.vy * dt;
      if (h.spinRate !== 0) {
        h.angle += h.spinRate * dt;
        if (h.shape === 'line' && h.len > 0) {
          h.x2 = h.x + Math.cos(h.angle) * h.len;
          h.y2 = h.y + Math.sin(h.angle) * h.len;
        }
      }
      if (h.tele > 0) {
        h.tele -= dt;
        if (h.tele <= 0 && h.onActivate) {
          const f = h.onActivate;
          h.onActivate = null;
          f();
        }
        continue;
      }
      if (h.grow !== 0) {
        h.r += h.grow * dt;
        if (h.shape === 'ring' || h.shape === 'annulus') h.r2 += h.grow * dt;
      }
      h.active -= dt;
      if (h.active <= 0) {
        h.alive = false;
        continue;
      }
      if (h.safe) continue;
      // Pull (Inhale): applies regardless of contact (shared with the co-op guest's prediction).
      if (h.pull !== 0) for (const p of this.players) if (this.isUp(p)) addHazardPull(p, h);
      if (h.dmg <= 0) continue;
      if (h.tick > 0) {
        h.tickAcc -= dt;
        if (h.tickAcc > 0) continue;
      }
      let landed = false;
      for (const p of this.players) {
        if (!this.isUp(p)) continue;
        const bit = 1 << p.index;
        if (h.tick <= 0 && h.hitMask & bit) continue;
        if (this.hazardTouches(h, p.x, p.y, p.r * 0.75)) {
          this.setCtx(p);
          if (this.hurtPlayer(h.dmg, h.x, h.y, h.slow ? { slow: h.slow, slowT: 0.6 } : {})) {
            h.hitMask |= bit;
            h.hitPlayer = true;
            landed = true;
          }
        }
      }
      if (landed && h.tick > 0) h.tickAcc = h.tick;
    }
    this.setCtx(this.players[0]);
  }

  hazardTouches(h: Hazard, x: number, y: number, r: number): boolean {
    if (h.holeR > 0 && dist2(h.holeX, h.holeY, x, y) < (h.holeR - r) * (h.holeR - r)) return false;
    switch (h.shape) {
      case 'circle': {
        const rr = h.r + r;
        return dist2(h.x, h.y, x, y) < rr * rr;
      }
      case 'ring': {
        // thin expanding ring: band between r2 and r
        const d = Math.sqrt(dist2(h.x, h.y, x, y));
        if (!(d < h.r + r && d > h.r2 - r)) return false;
        if (h.gapHalf > 0) {
          let a = Math.atan2(y - h.y, x - h.x) - h.angle;
          while (a > Math.PI) a -= TAU;
          while (a < -Math.PI) a += TAU;
          if (Math.abs(a) < h.gapHalf) return false;
        }
        return true;
      }
      case 'annulus': {
        const d = Math.sqrt(dist2(h.x, h.y, x, y));
        return d > h.r2 - r && d < h.r + r;
      }
      case 'line': {
        const rr = h.r2 + r;
        return segDist2(x, y, h.x, h.y, h.x2, h.y2) < rr * rr;
      }
      case 'rect': {
        return Math.abs(x - h.x) < h.r + r && Math.abs(y - h.y) < h.r2 + r;
      }
      case 'sector': {
        const dx = x - h.x, dy = y - h.y;
        const d = Math.hypot(dx, dy);
        if (d > h.r + r || d < h.r2) return false;
        let a = Math.atan2(dy, dx) - h.angle;
        while (a > Math.PI) a -= TAU;
        while (a < -Math.PI) a += TAU;
        return Math.abs(a) < h.half;
      }
    }
    return false;
  }

  clearHazardsOf(owner: number): void {
    for (const h of this.hazards) if (h.alive && h.owner === owner) h.alive = false;
  }

  // ------------------------------------------------------------------ zones
  spawnZone(kind: ZoneKind, x: number, y: number, r: number, life: number, dmg: number, tick: number): Zone | null {
    let z: Zone | null = null;
    let oldest: Zone | null = null;
    for (const c of this.zones) {
      if (!c.alive) {
        z = c;
        break;
      }
      if (c.kind === kind && (!oldest || c.life < oldest.life)) oldest = c;
    }
    if (!z) z = oldest;
    if (!z) return null;
    z.alive = true;
    z.gen = (z.gen + 1) & 255;
    z.kind = kind;
    z.x = x;
    z.y = y;
    z.r = r;
    z.life = z.maxLife = life;
    z.dmg = dmg;
    z.tick = tick;
    z.tickAcc = 0;
    z.slow = 0;
    z.harmful = false;
    return z;
  }

  private updateZones(dt: number): void {
    for (const z of this.zones) {
      if (!z.alive) continue;
      z.life -= dt;
      if (z.life <= 0) {
        z.alive = false;
        continue;
      }
      if (z.harmful) continue; // player-affecting slow handled in updatePlayer
      z.tickAcc -= dt;
      if (z.tickAcc > 0) continue;
      z.tickAcc = z.tick;
      const src = z.kind === 'spark' ? 'spark_trail' : z.kind === 'burn' ? 'inferno_grill' : z.kind === 'web' ? 'sticky_situation' : z.kind;
      this.forEachTargetInCircle(z.x, z.y, z.r, (t) => {
        if (!t.isBoss) {
          const e = t as Enemy;
          if (z.slow > 0) {
            e.slowF = Math.min(e.slowF, 1 - z.slow);
            e.slowT = Math.max(e.slowT, z.tick + 0.1);
          }
          if (z.kind === 'burn') {
            e.burnT = Math.max(e.burnT, 1.5);
            e.burnDps = Math.max(e.burnDps, z.dmg);
          }
        }
        this.damageTarget(t, z.dmg, false, 0, z.x, z.y, src);
      });
    }
  }

  // ------------------------------------------------------------------ pickups & XP
  spawnPickup(kind: PickupKind, x: number, y: number, value: number): Pickup {
    let pk: Pickup | null = null;
    for (const c of this.pickups) {
      if (!c.alive) {
        pk = c;
        break;
      }
    }
    if (!pk) {
      pk = new Pickup();
      this.pickups.push(pk);
    }
    pk.alive = true;
    pk.gen = (pk.gen + 1) & 255;
    pk.kind = kind;
    pk.x = pk.px = x;
    pk.y = pk.py = y;
    pk.value = value;
    pk.magnet = false;
    pk.speed = 0;
    pk.t = 0;
    pk.life = kind === 'food' ? 30 : kind === 'golden' ? 45 : kind === 'funnel' ? 14 : 1e9;
    pk.rolls = 0;
    pk.vx = pk.vy = 0;
    if (kind === 'ticket') this.gemsOnGround++;
    return pk;
  }

  dropTickets(x: number, y: number, value: number): void {
    const v = Math.max(1, Math.round(value * this.ticketMult));
    if (this.gemsOnGround >= this.maxGems) {
      // Red Gem Bank (doc 03 §6): vacuum overflow into one accumulating gem.
      if (!this.bankPickup || !this.bankPickup.alive) {
        this.bankPickup = this.spawnPickup('bank', x, y, 0);
      }
      this.bankPickup.value += v;
      return;
    }
    this.spawnPickup('ticket', x + this.rng.range(-6, 6), y + this.rng.range(-6, 6), v);
  }

  private updatePickups(dt: number): void {
    const multi = this.players.length > 1;
    for (const pk of this.pickups) {
      if (!pk.alive) continue;
      pk.px = pk.x;
      pk.py = pk.y;
      pk.t += dt;
      pk.life -= dt;
      if (pk.life <= 0) {
        pk.alive = false;
        if (pk.kind === 'ticket') this.gemsOnGround--;
        continue;
      }
      if (pk.vx !== 0 || pk.vy !== 0) {
        pk.x += pk.vx * dt;
        pk.y += pk.vy * dt;
        pk.vx *= 0.9;
        pk.vy *= 0.9;
        if (Math.abs(pk.vx) < 2 && Math.abs(pk.vy) < 2) pk.vx = pk.vy = 0;
      }
      const p = multi ? this.nearestLiving(pk.x, pk.y) : this.player;
      if (!this.isUp(p)) continue;
      const mag = p.stats.pickupRadius();
      const mag2 = mag * mag;
      const d2 = dist2(pk.x, pk.y, p.x, p.y);
      const grab = pk.kind === 'chest' ? 36 : pk.kind === 'food' || pk.kind === 'funnel' ? 30 : 18;
      if (!pk.magnet && (pk.kind === 'ticket' || pk.kind === 'bank') && d2 < mag2) pk.magnet = true;
      if (pk.magnet) {
        pk.speed = Math.min(pk.speed + 1400 * dt, 1100);
        const d = Math.sqrt(d2) || 1;
        pk.x += ((p.x - pk.x) / d) * pk.speed * dt;
        pk.y += ((p.y - pk.y) / d) * pk.speed * dt;
      }
      if (d2 < (grab + p.r) * (grab + p.r)) {
        this.setCtx(p);
        this.collect(pk);
      }
    }
    this.setCtx(this.players[0]);
  }

  private collect(pk: Pickup): void {
    const p = this.player;
    pk.alive = false;
    switch (pk.kind) {
      case 'ticket':
        this.gemsOnGround--;
        this.addXp(pk.value);
        this.bus.emit('pickup', { kind: 'ticket', value: pk.value, player: p.index });
        break;
      case 'bank':
        this.addXp(pk.value);
        this.fx.push('pickup', pk.x, pk.y, 2, 0, 0, 'bank');
        this.bus.emit('pickup', { kind: 'bank', value: pk.value, player: p.index });
        this.bankPickup = null;
        break;
      case 'food':
      case 'funnel': {
        const heal = pk.kind === 'food' ? Math.max(HEALING.foodHealMin, p.stats.maxHp() * HEALING.foodHealFrac) : Math.max(12, p.stats.maxHp() * HEALING.funnelHealFrac);
        this.healPlayer(heal);
        this.bus.emit('pickup', { kind: pk.kind, value: heal, player: p.index });
        break;
      }
      case 'golden':
        for (const g of this.pickups) if (g.alive && (g.kind === 'ticket' || g.kind === 'bank')) g.magnet = true;
        this.fx.push('flash', p.x, p.y, 0.35, 0, 0, 'gold');
        this.bus.emit('pickup', { kind: 'golden', value: 0, player: p.index });
        break;
      case 'chest': {
        const res = this.openChest(pk.rolls || 1);
        this.fx.push('chest', pk.x, pk.y, res.items.length);
        this.bus.emit('chest', { ...res, rolls: pk.rolls || 1, src: pk.src || 'event', opener: p.index });
        break;
      }
    }
  }

  /**
   * Chest contents (D-34, D-51, D-54). Solo: every roll for the player. Co-op: each roll goes to whoever
   * has been dealt the fewest chest prizes so far tonight, ties going round from the opener (so a duo
   * still alternates, opener first, and a party of six shares 1–5-roll chests evenly over the night);
   * every entry is tagged with its owner, so every prize wheel shows the same wedges.
   */
  openChest(rolls: number): ReturnType<typeof grantChest> {
    const opener = this.player;
    if (this.players.length === 1) return grantChest(this, rolls);
    const n = this.players.length;
    const share = this.players.map(() => 0);
    for (let k = 0; k < rolls; k++) {
      let pick = opener.index, best = Infinity;
      for (let j = 0; j < n; j++) {
        const i = (opener.index + j) % n;
        const v = this.players[i].chestPrizes + share[i];
        if (v < best) [best, pick] = [v, i];
      }
      share[pick]++;
    }
    for (const p of this.players) p.chestPrizes += share[p.index];
    const out: ReturnType<typeof grantChest> = { items: [], entries: [] };
    for (let k = 0; k < n; k++) {
      const pl = this.players[(opener.index + k) % n];
      if (share[pl.index] <= 0) continue;
      this.setCtx(pl);
      const r = grantChest(this, share[pl.index]);
      for (const e of r.entries) e.player = pl.index;
      out.items.push(...r.items);
      out.entries.push(...r.entries);
      if (r.evolution && !out.evolution) out.evolution = r.evolution;
    }
    this.setCtx(opener);
    return out;
  }

  xpCurve(lvl: number): number {
    // data/progression.ts. A party needs more XP per level (D-57), ramping in over the first six levels
    // so a co-op night still opens with a quick run of level-ups.
    const m = this.partyScale.xp;
    return xpToNext(lvl) * (1 + (m - 1) * Math.min(1, (lvl - 1) / 6));
  }

  addXp(value: number): void {
    // a party's tickets are worth more (D-66: its XP per hour is 150% of a solo night's)
    const mult = this.player.stats.xp * (this.cfg.curse ? CURSE.xpMult : 1) * this.partyScale.xpGain;
    this.xp += value * mult;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = this.xpCurve(this.level);
      this.pendingLevels++;
      this.bus.emit('levelup', { level: this.level });
      this.fx.push('levelup', this.player.x, this.player.y);
    }
    if (this.pendingLevels > 0 && this.phase === 'play') this.openDraft();
  }

  /**
   * Open a level-up (D-51): every player draws their own hand from their own build; the night stays
   * paused until every player has chosen (or skipped). Solo behaves exactly as before.
   */
  openDraft(): void {
    if (this.pendingLevels <= 0) return;
    const ctx = this.player;
    this.drafts = this.players.map((pl) => {
      if (pl.dead) return null;
      this.setCtx(pl);
      const hand = generateDraft(this);
      return hand;
    });
    this.setCtx(ctx);
    this.phase = 'draft';
    if (this.drafts.every((d) => d === null)) {
      this.closeDraft();
      return;
    }
    this.drafts.forEach((hand, i) => hand && this.bus.emit('draft', { options: hand, player: i }));
  }

  /** Has this player still to choose in the open level-up? */
  draftPending(pi = 0): boolean {
    return this.phase === 'draft' && !!this.drafts[pi];
  }

  chooseDraft(index: number, pi = 0): void {
    if (!this.draftPending(pi)) return;
    const hand = this.drafts[pi]!;
    const opt = hand[index];
    if (opt?.disabled) return;
    const ctx = this.player;
    this.setCtx(this.players[pi]);
    if (opt) applyDraftChoice(this, opt);
    this.setCtx(ctx);
    this.finishDraft(pi);
  }

  skipDraft(pi = 0): void {
    const pl = this.players[pi];
    if (!this.draftPending(pi) || !pl.canSkip) return;
    const ctx = this.player;
    this.setCtx(pl);
    this.healPlayer(10);
    this.setCtx(ctx);
    this.finishDraft(pi);
  }

  rerollDraft(pi = 0): boolean {
    const pl = this.players[pi];
    if (!this.draftPending(pi) || pl.rerolls <= 0) return false;
    pl.rerolls--;
    this.redraw(pi);
    return true;
  }

  banishDraft(index: number, pi = 0): boolean {
    const pl = this.players[pi];
    if (!this.draftPending(pi) || pl.banishes <= 0) return false;
    const opt = this.drafts[pi]![index];
    if (!opt || opt.kind === 'evolution' || opt.kind === 'heal' || opt.kind === 'voucher') return false;
    pl.banishes--;
    pl.banished.add(opt.refId);
    this.redraw(pi);
    return true;
  }

  private redraw(pi: number): void {
    const ctx = this.player;
    this.setCtx(this.players[pi]);
    const hand = generateDraft(this);
    this.setCtx(ctx);
    this.drafts[pi] = hand;
    this.bus.emit('draft', { options: hand, player: pi });
  }

  private finishDraft(pi: number): void {
    this.drafts[pi] = null;
    this.bus.emit('draft_done', { player: pi });
    if (this.drafts.some((d) => d !== null)) return; // still waiting on a teammate
    this.closeDraft();
  }

  private closeDraft(): void {
    this.pendingLevels--;
    this.phase = 'play';
    for (const pl of this.players) pl.iframes = Math.max(pl.iframes, 0.5);
    if (this.pendingLevels > 0) this.openDraft();
  }

  // ------------------------------------------------------------------ timers & map hazards
  private updateTimers(dt: number): void {
    if (this.director.bossActive) return;
    this.foodTimer -= dt;
    if (this.foodTimer <= 0) {
      const fi = HEALING.foodInterval[Math.min(3, this.act - 1)];
      this.foodTimer = this.rng.range(fi[0], fi[1]);
      this.setCtx(this.spawnAnchor());
      const pos = this.nearbyOpenSpot(200, 470);
      this.setCtx(this.players[0]);
      this.spawnPickup('food', pos.x, pos.y, 0);
    }
    this.goldenTimer -= dt;
    if (this.goldenTimer <= 0) {
      this.goldenTimer = this.rng.range(280, 440);
      this.setCtx(this.spawnAnchor());
      const pos = this.nearbyOpenSpot(250, 520);
      this.setCtx(this.players[0]);
      this.spawnPickup('golden', pos.x, pos.y, 0);
    }
  }

  nearbyOpenSpot(minD: number, maxD: number): { x: number; y: number } {
    const p = this.player;
    for (let i = 0; i < 12; i++) {
      const a = this.rng.angle();
      const d = this.rng.range(minD, maxD);
      const x = clamp(p.x + Math.cos(a) * d, PLAYER_BOUNDS.minX + 40, PLAYER_BOUNDS.maxX - 40);
      const y = clamp(p.y + Math.sin(a) * d, PLAYER_BOUNDS.minY + 40, PLAYER_BOUNDS.maxY - 40);
      let ok = true;
      for (const pr of PROPS) {
        if (pr.r && dist2(pr.x, pr.y, x, y) < (pr.r + 30) ** 2) ok = false;
        else if (pr.hw && pr.hh && Math.abs(x - pr.x) < pr.hw + 30 && Math.abs(y - pr.y) < pr.hh + 30) ok = false;
      }
      if (ok) return { x, y };
    }
    return { x: p.x + 220, y: p.y };
  }

  /** Tilt-a-Whirl rotating arm (doc 03 §4): telegraphed by its glowing track, chip damage. */
  private updateMapHazards(dt: number): void {
    const TW = TILT_A_WHIRL;
    if (!TW) return; // the Fun House runs its own machinery (updateFunhouse)
    if (this.player === this.players[0] || !this.isUp(this.players[0])) this.tiltAngle += (TAU / TW.period) * dt;
    const p = this.player;
    if (dist2(p.x, p.y, TW.x, TW.y) < (TW.armLen + 30) ** 2) {
      for (let k = 0; k < 2; k++) {
        const a = this.tiltAngle + k * Math.PI;
        const ex = TW.x + Math.cos(a) * TW.armLen;
        const ey = TW.y + Math.sin(a) * TW.armLen;
        if (segDist2(p.x, p.y, TW.x, TW.y, ex, ey) < (16 + p.r) ** 2) {
          if (this.hurtPlayer(8 * this.diff.dmgMult, ex, ey)) {
            p.pullX += Math.cos(a + Math.PI / 2) * 900;
            p.pullY += Math.sin(a + Math.PI / 2) * 900;
          }
        }
      }
    }
  }

  private cleanupDead(): void {
    const a = this.active;
    let w = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i].alive) a[w++] = a[i];
      else a[i].inActive = false;
    }
    a.length = w;
  }

  /**
   * Lost & Found Voucher (D-31): pays permanent currency right away through the meta system
   * (the app credits the save on 'meta_currency'). Returns the amount paid.
   */
  grantVoucher(): number {
    const greed = this.player.stats.greed + this.diff.greed;
    const v = voucherValue(this.minutes, this.vouchersTaken, this.voucherPaid, greed);
    if (v <= 0) return 0;
    this.vouchersTaken++;
    this.voucherPaid += v;
    this.bus.emit('meta_currency', { amount: v, source: 'voucher', player: this.player.index });
    this.fx.push('text', this.player.x, this.player.y - 60, 0, 0, 0, 'gold', `+${v} LT`);
    return v;
  }

  // ------------------------------------------------------------------ bosses
  registerBossDefeat(id: string, noHit: boolean): void {
    this.bossKills++;
    this.bossIds.push(id);
    this.bus.emit('boss_defeated', { id, noHit });
    if (noHit) this.achievementsHit.add('no_hit_boss');
    this.achievementsHit.add(id === 'carnival_tent' ? 'beat_tent' : `beat_${id}`);
    if (id === this.map.finalBoss) this.ringmasterSlain = true;
    if (this.quests.onBossDefeated(id)) return;
    if (id === this.map.finalBoss) {
      this.ringmasterDefeated = true;
      if (this.endless) return;
      if (this.time < DAWN_TIME - 1) {
        this.victoryLap = true;
        this.ticketMult = TICKETS.victoryLapMult;
        this.bus.emit('banner', { text: 'VICTORY LAP!', sub: 'Mow them down until dawn', style: 'gold' });
      } else {
        this.time = DAWN_TIME;
      }
    }
  }

  // ------------------------------------------------------------------ dawn / end
  private beginDawn(): void {
    this.phase = 'dawn';
    this.dawnT = 0;
    this.stalled = false;
    this.bus.emit('dawn', {});
    this.bus.emit('music', { cue: 'dawn' });
    this.player.iframes = 999;
  }

  private updateDawn(dt: number): void {
    this.dawnT += dt;
    this.player.px = this.player.x;
    this.player.py = this.player.y;
    // The sunrise pops every enemy, nearest to the light first.
    const reach = this.dawnT * 520;
    for (const e of this.active) {
      if (!e.alive) continue;
      e.px = e.x;
      e.py = e.y;
      if (dist2(e.x, e.y, this.player.x, this.player.y + 2000) < (2000 + reach - 1200) ** 2 || this.dawnT > 5) {
        e.alive = false;
        this.fx.push('death', e.x, e.y, 0.8, 0, 0, 'confetti');
      }
    }
    this.cleanupDead();
    for (const b of this.bullets) b.alive = false;
    for (const h of this.hazards) h.alive = false;
    this.updatePickups(dt);
    if (this.dawnT >= 7.5) this.endRun(true);
  }

  /** Continue into Endless / Lock-In after the dawn screen (D-17). */
  startEndless(): void {
    if (!this.endStats || !this.endStats.won) return;
    this.endless = true;
    this.endlessStart = this.time;
    this.wonPayoutBanked = this.endStats.lostTickets;
    this.endStats = null;
    this.phase = 'play';
    this.player.iframes = 2;
    this.ticketMult = TICKETS.endlessMult;
    this.victoryLap = false;
    this.director.enterEndless();
    this.bus.emit('banner', { text: 'LOCKED IN!', sub: 'The carnival never closes', style: 'danger' });
    this.bus.emit('music', { cue: 'endless' });
  }

  private checkEndlessAchievements(): void {
    if (this.time >= 1800) this.achievementsHit.add('endless_30');
  }

  endRun(won: boolean): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    won = won || this.ringmasterSlain;
    const p = this.player;
    const greed = p.stats.greed + this.diff.greed + (this.cfg.curse ? CURSE.payoutMult - 1 : 0);
    const endlessExtra = this.endless ? this.time - this.endlessStart : 0;
    let lt = computePayout({ seconds: this.time, bosses: this.bossKills, kills: this.kills, won: won || this.endless, greed, endlessExtraSeconds: endlessExtra });
    if (this.endless) lt = Math.max(0, lt - this.wonPayoutBanked); // only the extra beyond what was banked at dawn
    if (this.time >= 720) this.achievementsHit.add('reach_12');
    if (won) {
      if (this.diff.id === 'carnival') this.achievementsHit.add('win_carnival');
      if (this.diff.id === 'nightmare') {
        this.achievementsHit.add('win_nightmare');
        this.achievementsHit.add('win_carnival');
      }
      if (this.cfg.curse) this.achievementsHit.add('win_cursed');
    }
    if (this.kills >= 1000) this.achievementsHit.add('kills_1000');
    if (this.kills >= 5000) this.achievementsHit.add('kills_5000');
    if (this.level >= 40) this.achievementsHit.add('level_40');
    if (this.evolutions.length) this.achievementsHit.add('first_evolution');
    this.achievementsHit.add('first_night');
    if (this.cfg.daily) this.achievementsHit.add('daily_run');
    const score = this.kills + 10 * this.level + 500 * this.bossKills + Math.floor(this.time) + (won ? 2000 : 0);
    this.endStatsAll = this.players.map((pl) => this.statsFor(pl, won, lt, score, endlessExtra));
    const stats = this.endStatsAll[0];
    this.endStats = stats;
    this.bus.emit('run_end', { stats });
  }

  /** End-of-run stats as one player sees them (shared run, their own build). */
  private statsFor(p: Player, won: boolean, lt: number, score: number, endlessExtra: number): RunStats {
    return {
      won,
      time: this.time,
      kills: this.kills,
      bosses: this.bossKills,
      bossIds: this.bossIds.slice(),
      level: this.level,
      lostTickets: lt,
      damageDealt: Math.round(this.damageDealt),
      damageTaken: Math.round(this.damageTaken),
      evolutions: this.evolutions.slice(),
      weapons: p.weapons.list.map((w) => ({ id: w.def.id, level: w.level, damage: Math.round(this.weaponDamage.get(w.def.id) ?? 0) })),
      passives: [...p.passives.entries()].map(([id, level]) => ({ id, level })),
      character: p.char.id,
      difficulty: this.diff.id,
      curse: this.cfg.curse,
      endless: this.endless,
      endlessTime: endlessExtra,
      daily: !!this.cfg.daily,
      score,
      maxLevelReached: this.level,
      enemiesSeen: [...this.enemiesSeen],
      achievementsHit: [...this.achievementsHit],
      trueEnding: this.trueEnding,
      voucherTickets: this.voucherPaid,
      questStage: this.quests.get(this.map.quest.id)?.stage ?? 0,
      map: this.mapId,
    };
  }

  // ------------------------------------------------------------------ helpers
  get minutes(): number {
    return this.time / 60;
  }
  charDef() {
    return CHARACTER_MAP[this.player.char.id];
  }
}
