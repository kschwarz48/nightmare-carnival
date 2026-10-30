// Application conductor: screen state machine, fixed-timestep loop (60 Hz sim, interpolated
// render), sim → audio/HUD/save event wiring, tutorials, the attract-mode menu background, online
// co-op (lobby, host loop, guest mirror loop — D-52), and the development-only timeline tools
// (stripped from production builds).

import { AudioEngine } from './audio/audio';
import { Input, type NavEvent } from './input/input';
import { SaveManager } from './meta/save';
import { Assets } from './render/assets';
import { GameRenderer3D } from './render3d/renderer3d';
import { Game, TICK, type RunConfig, type RunStats } from './sim/game';
import { hashSeed } from './core/rng';
import { CHARACTERS, CHARACTER_MAP } from './data/characters';
import { BOSS_MAP } from './data/bosses';
import { PERKS } from './data/meta';
import { WEAPONS, PASSIVES } from './data/weapons';
import { ENEMIES } from './data/enemies';
import { DIFFICULTIES } from './data/difficulty';
import { DraftView, Hud } from './ui/hud';
import { FortuneCard, PrizeOverlay } from './ui/prize';
import { PrizeWheel } from './render3d/prizeWheel';
import { LAST_SONG } from './data/quests';
import { SECRET_UNLOCKS } from './data/meta';
import type { QuestCue } from './sim/quest';
import { FocusNav, h } from './ui/dom';
import * as S from './ui/screens';
import { dailyInfo } from './ui/screens';
import * as L from './ui/lobby';
import { GuestSession, HostSession, runConfigFromStart } from './net/session';
import type { GuestProfile, StartCfg } from './net/protocol';
import { isValidCode, normalizeCode } from './net/codes';
import { describeNetConfig, loadNetConfig } from './net/config';
import { HubHud, type HubLabel } from './ui/hubHud';
import { HUB_EXITS, HUB_NPCS, HUB_SPAWN, HUB_SPOTS } from './data/hub';
import { NetError, hostLobby, joinLobby, probeReach, reachAdvice, type HostHandle, type Reach } from './net/peer';
import { VIEW_HALF_X, VIEW_HALF_Y } from './sim/constants';

/** The online session this tab is part of (D-52). */
type NetCtx = { role: 'host'; host: HostSession; handle: HostHandle | null } | { role: 'guest'; guest: GuestSession; code: string };
type CoopStatus = { text: string; action?: { label: string; fn: () => void } } | null;

/** How long each secret-quest sound dips the music, in seconds (souls come too often to duck for). */
const QUEST_DUCK: Record<string, number> = {
  awaken: 2.5, lamp_lit: 2.6, carousel_wakes: 3, musicbox: 2.6, hum: 1.4, note: 1.6, note_true: 1.6, sour: 1.8,
  melody_solved: 3.4, ding: 1.4, clunk: 1, ticket: 2.6, finale: 3.2, calliope_rises: 2.4, complete: 3,
};

/** "Ann", "Ann and Bo", "Ann, Bo and Cy". */
function listNames(names: string[]): string {
  return names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The night's opening line for a party: who is with you. */
function withYou(names: string[]): string {
  return names.length === 1 ? `${names[0]} is with you — the gates lock behind you both…` : `${listNames(names)} are with you — the gates lock behind you all…`;
}

/**
 * A clock that keeps ticking while the page is not drawing: browsers stop requestAnimationFrame and
 * throttle timers in background tabs, which would freeze the host's night (and drop the guest's
 * keepalives) whenever someone alt-tabs. Messages from a worker keep arriving at full rate. It runs
 * whenever frames have stalled, not only when the tab says it is hidden: a covered window or an
 * embedded browser can stop drawing while still reporting itself visible.
 */
class BackgroundClock {
  private w: Worker | null = null;
  private url = '';
  constructor(fn: () => void, stalled: () => boolean, ms = 16) {
    try {
      this.url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms});`], { type: 'text/javascript' }));
      this.w = new Worker(this.url);
      this.w.onmessage = () => {
        if (document.hidden || stalled()) fn();
      };
    } catch {
      /* no workers: a hidden tab simply pauses (documented) */
    }
  }
  stop(): void {
    this.w?.terminate();
    this.w = null;
    if (this.url) URL.revokeObjectURL(this.url);
  }
}

type State = 'loading' | 'press' | 'title' | 'charselect' | 'daily' | 'lostfound' | 'pedia' | 'settings' | 'playing' | 'paused' | 'results' | 'mp' | 'mp_join' | 'lobby' | 'netmsg' | 'hub' | 'midway';

export class App {
  canvas = document.getElementById('game') as HTMLCanvasElement;
  ui = document.getElementById('ui') as HTMLDivElement;
  save = new SaveManager();
  audio = new AudioEngine();
  input: Input;
  assets = new Assets();
  renderer!: GameRenderer3D;
  hud!: Hud;
  draft!: DraftView;
  prize!: PrizeWheel;
  prizeUi!: PrizeOverlay;
  fortune = new FortuneCard();
  state: State = 'loading';
  game: Game | null = null;
  demo: Game | null = null;
  private screenEl: HTMLElement | null = null;
  private nav: FocusNav | null = null;
  private acc = 0;
  private last = performance.now();
  fps = 60;
  private settingsBack: () => void = () => this.go('title');
  private lastRun: { character: string; difficulty: string; curse: boolean; daily?: boolean } | null = null;
  private dawnT = -1;
  simSpeed = 1;
  autopilot = false;
  private lastPediaToast = 0;
  overlayPause = false;
  private ctx!: S.UICtx;
  private runStart = 0;
  // ---- online co-op (D-52)
  net: NetCtx | null = null;
  /** this machine's player slot: 0 for solo and the host, 1 for a guest */
  localIndex = 0;
  /** reeled in by a boss's stage ring right now (for its twang) */
  private tugging = false;
  private mpStatus = '';
  private mpTone: 'info' | 'warn' = 'info';
  private mpBusy = false;
  private lobbyKey = '';
  private showNetDiag = false;
  private netDesc = '';
  /** this browser's peer-to-peer reach, checked when the multiplayer menu first opens */
  private netReach: Reach | null = null;
  private reachChecking = false;
  private bgClock: BackgroundClock | null = null;
  private bgLast = 0;
  /** when the animation-frame loop last ran (the background clock takes over when it stalls) */
  private lastFrameAt = 0;
  /** the Midway hub's screen layer (D-60) */
  private hubHud!: HubHud;
  /** the conversation open on the Midway: which cast member, which line */
  private hubTalk: { npc: number; line: number } | null = null;
  /** what interact would use right now on the Midway */
  private hubTarget: { kind: 'npc' | 'booth' | 'bigtop' | 'exit'; i: number } | null = null;
  /** co-op host: who was on the Midway when it was last built (it is rebuilt when that changes) */
  private hubParty = '';
  /** this night unlocked the Midway (announced on the results) */
  private hubJustUnlocked = false;
  /** guest: finished its prize wheel at this mirror time, waiting for the host's night to resume */
  private guestPrizeAt = -1;
  private chestQueue: (() => void)[] = [];

  constructor() {
    this.input = new Input(this.canvas);
    this.input.onNav((e) => this.onNav(e));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3' && this.net) {
        this.showNetDiag = !this.showNetDiag;
        e.preventDefault();
      }
    });
    // Leaving the page: say goodbye so nobody waits on a closed tab — except a guest in the middle of
    // a night, who may only be refreshing: their link just drops, the host holds the seat and the
    // night (up to 20 s, or until the host carries on), and they rejoin with the same code.
    window.addEventListener('pagehide', () => {
      if (this.net?.role === 'guest' && this.game) return;
      this.leaveNet(true);
    });
  }

  async boot(): Promise<void> {
    const ld = S.loadingScreen();
    this.ui.append(ld.el);
    const tips = ['Painting the midway…', 'Inflating the balloons…', 'Winding the monkeys…', 'Stitching the stuffies…', 'Oiling the Ferris Wheel…', 'Tuning the calliope…'];
    // let the loading screen paint, then build the art (fonts first so lettering uses Rye)
    try {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
      await document.fonts.load('40px Rye');
    } catch {
      /* fonts optional */
    }
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const t0 = performance.now();
    this.assets.build((p) => ld.set(p * 0.7, tips[Math.min(tips.length - 1, Math.floor(p * tips.length))]));
    const t1 = performance.now();
    const { warmModels } = await import('./render3d/models');
    await warmModels((p) => ld.set(0.7 + p * 0.3, 'Sculpting the crowd…'), [this.save.data.last.character]);
    ld.set(1, 'Opening the gates…');
    this.renderer = new GameRenderer3D(this.canvas, this.assets);
    const t2 = performance.now();
    if (import.meta.env.DEV) console.info(`[boot] assets ${(t1 - t0).toFixed(0)} ms, renderer ${(t2 - t1).toFixed(0)} ms`);
    this.input.aimScaleY = this.renderer.aimScaleY;
    this.hud = new Hud(this.assets);
    this.hubHud = new HubHud((code) => void navigator.clipboard?.writeText(code));
    // alpha testing aid: ?unlock=midway opens the hub on this save without finishing the Last Song
    if (new URLSearchParams(location.search).get('unlock') === 'midway') {
      this.save.data.midwayTester = true;
      this.save.save();
    }
    this.draft = new DraftView(this.assets, (i) => this.pickDraft(i), () => this.rerollDraft(), (i) => this.banishDraft(i), () => this.skipDraft());
    this.prizeUi = new PrizeOverlay(() => this.prize.skip(false));
    this.prize = new PrizeWheel(this.renderer.overlay, this.assets, this.prizeUi, this.audio);
    this.ctx = {
      save: this.save, assets: this.assets, audio: this.audio, input: this.input,
      click: () => this.audio.play('ui_click', { vol: 0.5 }),
      go: (s, arg) => this.go(s as State, arg),
      startRun: (o) => this.startRun(o),
      applySettings: () => this.applySettings(),
    };
    this.applySettings();
    window.addEventListener('resize', () => {
      this.resize();
      this.sendView();
    });
    this.resize();
    this.makeDemo();
    ld.el.remove();
    this.go('press');
    this.prewarmPrize();
    if (import.meta.env.DEV) import('./dev').then((m) => m.installDevTools(this));
    requestAnimationFrame((t) => this.frame(t));
  }

  private resize(): void {
    const w = window.innerWidth, hgt = window.innerHeight;
    const q = this.save.data.settings.quality;
    const pr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1);
    this.renderer.resize(w, hgt, pr);
  }

  applySettings(): void {
    const s = this.save.data.settings;
    this.audio.volumes = { master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience, muted: s.muted };
    this.audio.applyVolumes();
    this.input.bindings = JSON.parse(JSON.stringify(s.bindings));
    document.documentElement.style.setProperty('--ui-scale', String(s.uiScale));
    document.body.classList.toggle('dyslexia', s.dyslexiaFont);
    if (this.renderer) {
      this.renderer.settings = { highContrast: s.highContrast, reducedFlash: s.reducedFlash, shake: s.shake, damageNumbers: s.damageNumbers, quality: s.quality, abilityOpacity: s.abilityOpacity };
      this.resize();
    }
    if (this.hud) this.hud.showFps = s.showFps;
  }

  // =================================================================== screens
  go(state: State, arg?: any): void {
    if (state === 'settings') {
      const from = arg;
      this.settingsBack = from === 'pause' ? () => this.go('paused') : () => this.go('title');
    }
    // once the first night is fully completed, the Midway takes the main menu's place (D-60)
    // (and backing out of any menu opened on a Midway, yours or a friend's, returns to it)
    if (state === 'title' && (this.game?.hub || (!this.net && this.save.hubUnlocked()))) state = 'hub';
    if (state === 'hub' && !this.game?.hub) return this.startHub();
    this.screenEl?.remove();
    this.screenEl = null;
    this.state = state;
    let el: HTMLElement | null = null;
    switch (state) {
      case 'hub':
        this.audio.setPausedFilter(false);
        this.audio.setCue('midway'); // the grounds get a hushed carousel waltz; Bradley's song stays on the title menus
        break;
      case 'midway':
        el = this.midwayMenuEl();
        break;
      case 'press':
        this.audio.setCue('menu');
        el = S.pressStart(this.ctx, () => this.pressed());
        break;
      case 'title':
        this.audio.setCue('menu');
        el = S.titleScreen(this.ctx);
        break;
      case 'charselect':
        el = S.charSelectScreen(this.ctx);
        break;
      case 'daily':
        el = S.dailyScreen(this.ctx);
        break;
      case 'lostfound':
        el = S.lostFoundScreen(this.ctx);
        break;
      case 'pedia':
        el = S.pediaScreen(this.ctx);
        break;
      case 'settings':
        el = S.settingsScreen(this.ctx, () => this.settingsBack());
        break;
      case 'paused': {
        const g = this.game!;
        this.audio.setPausedFilter(true);
        // co-op: a pause stops the night for both players (the partner sees who paused)
        if (this.net?.role === 'host') this.net.host.setPaused(true);
        else if (this.net?.role === 'guest') this.net.guest.pause(true);
        const quit = this.net?.role === 'guest' ? 'Leave the Night' : 'Abandon Night';
        el = S.pauseScreen(this.ctx, { weapons: g.weapons.list.map((w) => w.def.id), passives: [...g.player.passives.keys()], time: g.time, kills: g.kills }, () => this.resume(), () => this.abandon(), quit);
        break;
      }
      case 'mp':
        this.checkReach();
        el = L.multiplayerMenu(this.ctx, {
          name: L.loadName(), status: this.mpStatus, busy: this.mpBusy, reach: this.netReach,
          host: (n) => void this.hostGame(n),
          join: (n) => {
            L.storeName(n);
            this.mpStatus = '';
            this.go('mp_join');
          },
          back: () => {
            this.mpStatus = '';
            this.go('title');
          },
        });
        break;
      case 'mp_join':
        el = L.joinScreen(this.ctx, { status: this.mpStatus, tone: this.mpTone, busy: this.mpBusy, join: (code) => void this.joinGame(code), back: () => this.leaveNet(false, 'mp') });
        break;
      case 'lobby':
        el = this.lobbyEl();
        break;
      case 'netmsg':
        el = L.netNotice(this.ctx, arg?.title ?? 'Connection', arg?.text ?? '', arg?.actions ?? [{ label: 'Back to Menu', fn: () => this.toMenu() }]);
        break;
      case 'playing':
        this.audio.setPausedFilter(false);
        break;
    }
    if (el) {
      this.ui.append(el);
      this.screenEl = el;
      this.nav = new FocusNav(el);
      if (this.input.usingGamepad || state !== 'press') this.nav.ensure();
    } else this.nav = null;
  }

  /** A boss's stage ring (D-61): a twang the moment its strings start reeling you back in. */
  private stageTug(g: Game): void {
    const p = g.players[this.localIndex] ?? g.player;
    const out = !p.dead && !p.downed && g.bosses.some((b) => b.ringR > 0 && (p.x - b.ringX) ** 2 + (p.y - b.ringY) ** 2 > b.ringR * b.ringR);
    if (out && !this.tugging) this.audio.play('twang', { vol: 0.8, pitch: 1.3 });
    this.tugging = out;
  }

  private pressed(): void {
    // the screen we land on picks the music (the title menu Bradley's song, the Midway its waltz)
    void this.audio.unlock();
    this.audio.play('select', { vol: 0.6 });
    this.go('title');
  }

  private makeDemo(): void {
    const ch = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
    this.demo = new Game({ character: ch, difficulty: 'midway', curse: false, seed: (Math.random() * 1e9) | 0, godMode: true, unlocked: new Set(['w_orbs', 'w_laser', 'w_bell', 'w_cannon', 'w_mirror']) });
    // give the attract mode some spectacle
    this.demo.time = 120;
    this.demo.weapons.add('fireworks');
    this.demo.weapons.add('rings');
    for (let i = 0; i < 4; i++) {
      this.demo.weapons.levelUp('fireworks');
      this.demo.weapons.levelUp(this.demo.player.char.startWeapon);
    }
    this.demo.player.x = this.demo.player.px = -300;
    this.demo.player.y = this.demo.player.py = 260;
    this.renderer.snapCamera(-300, 260);
  }

  // =================================================================== runs
  startRun(o: { character: string; difficulty: string; curse: boolean; daily?: boolean; seed?: number }): void {
    this.audio.unlock();
    this.lastRun = o;
    if (!o.daily) {
      this.save.data.last = { character: o.character, difficulty: o.difficulty, curse: o.curse };
      this.save.save();
    }
    const perk = (id: string) => this.save.perkLevel(id);
    const seed = o.seed ?? (o.daily ? hashSeed('nc-daily-' + dailyInfo().seed) : (Math.random() * 2 ** 31) | 0);
    const cfg: RunConfig = {
      character: o.character,
      difficulty: o.difficulty as RunConfig['difficulty'],
      curse: o.curse,
      seed,
      daily: o.daily,
      dailyMod: o.daily ? dailyInfo().mod : undefined,
      meta: o.daily ? [] : this.save.metaStats(),
      rerolls: o.daily ? 1 : perk('reroll'),
      banishes: o.daily ? 1 : perk('banish'),
      canSkip: o.daily || this.save.isUnlocked('f_skip'),
      unlocked: this.save.unlockedSet(),
      aimMode: this.save.data.settings.aimMode,
      questMemory: Object.fromEntries(Object.entries(this.save.data.quests).map(([k, v]) => [k, v.completions])),
    };
    this.localIndex = 0;
    this.beginRun(new Game(cfg), o.character, o.daily ? 'DAILY RUN' : 'MIDNIGHT', o.daily ? dailyInfo().modName : 'The gates lock behind you…');
  }

  /** Common run setup for solo, the co-op host's night and the co-op guest's mirror. */
  private beginRun(g: Game, character: string, title: string, sub: string): void {
    this.hubHud.root.remove();
    this.game?.bus.clear();
    this.game = g;
    g.setCtx(g.players[this.localIndex] ?? g.players[0]);
    this.wireGame(g);
    this.renderer.fx.clear();
    this.renderer.dawn = 0;
    this.renderer.snapCamera(g.player.x, g.player.y);
    this.dawnT = -1;
    this.hud.reset();
    this.hud.root.classList.remove('under');
    this.hud.setPortrait(character);
    this.hud.coopInfo = null;
    if (!this.hud.root.isConnected) this.ui.append(this.hud.root);
    this.ui.append(this.draft.root, this.prizeUi.root, this.fortune.root);
    this.draft.hide();
    this.prizeUi.hide();
    this.prizeUi.owners = g.players.length > 1 ? g.players.map((p) => p.name) : null;
    this.fortune.hide();
    this.overlayPause = false;
    this.chestQueue = [];
    this.guestPrizeAt = -1;
    this.acc = 0;
    this.runStart = performance.now();
    this.go('playing');
    this.prewarmPrize();
    this.audio.setCue('act1');
    this.hud.banner(title, sub, 'gold', 3);
    this.tutorial('move', 'Move with <b>WASD</b>, the <b>arrow keys</b> or the <b>left stick</b>. Your weapons fire on their own.');
  }

  /**
   * Compile the prize booth's shader variants a couple of frames from now, once the scene holds what is
   * about to be on screen, so the first chest opens without a stall (cached programs make repeats cheap).
   */
  private prewarmPrize(): void {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!this.prize.active) void this.prize.prewarm(this.renderer.renderer, this.renderer.overlay, this.renderer.overlayCam, this.renderer.post.composer.readBuffer);
    }));
  }

  private wireGame(g: Game): void {
    const a = this.audio;
    // co-op: events about one player are this machine's only if they are about its player
    const mine = (pl?: number) => (pl ?? 0) === this.localIndex;
    const nameOf = (pl?: number) => g.players[pl ?? 0]?.name ?? 'Your partner';
    const camPan = (x?: number) => (x === undefined ? 0 : Math.max(-1, Math.min(1, (x - this.renderer.camX) / (this.renderer.viewWidth * 0.6))));
    g.bus.on('sfx', (e) => {
      if (e.x !== undefined && Math.abs(e.x - this.renderer.camX) > this.renderer.viewWidth * 0.9) return;
      a.play(e.id, { vol: e.vol, pitch: e.pitch, pan: camPan(e.x) });
    });
    g.bus.on('pickup', (e) => {
      if (!mine(e.player)) return;
      if (e.kind === 'ticket') a.pickup();
      else if (e.kind === 'food' || e.kind === 'funnel') a.play('heal', { vol: 0.6 });
      else if (e.kind === 'golden') a.play('evolve', { vol: 0.5, pitch: 1.4 });
      else if (e.kind === 'bank') a.play('levelup', { vol: 0.5, pitch: 1.2 });
      if (e.kind === 'ticket') this.tutorial('tickets', '<b>Tickets</b> are XP. Walk near them to collect — fill the bar to level up.');
    });
    g.bus.on('levelup', () => a.play('levelup', { vol: 0.55 }));
    g.bus.on('draft', (e) => {
      if (!mine(e.player)) return;
      this.draft.show(g, e.options);
      this.tutorial('draft', 'Pick one prize. Weapons level to <b>8</b>; a maxed weapon + its matching passive can <b>EVOLVE</b>.');
    });
    g.bus.on('player_hurt', (e) => {
      if (!mine(e.player)) return;
      a.play('hurt', { vol: 0.6 });
      this.input.rumble(0.5, 120);
    });
    g.bus.on('shield_pop', (e) => {
      if (mine(e.player)) this.hud.toastMsg('Balloon Shield popped!');
    });
    g.bus.on('player_revive', (e) => {
      if (!mine(e.player)) {
        this.hud.toastMsg(`${nameOf(e.player)} is back on their feet!`);
        return;
      }
      this.hud.banner('SECOND WIND!', g.players.length > 1 ? 'Back on your feet — and into the fray' : 'A revive balloon carries you back up', 'gold');
    });
    g.bus.on('player_downed', (e) => {
      a.play('toll', { vol: 0.7 });
      if (mine(e.player)) this.hud.banner('IN A COFFIN', `The lid creaks open on its own — faster with ${g.players.length > 2 ? 'a friend' : nameOf(1 - this.localIndex)} beside you`, 'danger', 3.4);
      else this.hud.banner(`${nameOf(e.player).toUpperCase()} HAS FALLEN!`, 'Stand by their coffin to bring them back', 'danger', 3.4);
    });
    g.bus.on('boss_warning', (e) => {
      a.play('warning', { vol: 0.9 });
      a.setCue('silence');
      this.hud.warning(e.id, this.save.data.settings.reducedFlash);
      this.input.rumble(0.8, 400);
      this.tutorial('boss', 'Boss incoming! Every attack is <b>telegraphed</b> in red-orange — the inner circle fills just before impact.');
    });
    g.bus.on('boss_spawn', (e) => {
      if (e.id !== 'ringmaster') return;
    });
    g.bus.on('boss_phase', (e) => this.hud.banner(e.name.toUpperCase(), BOSS_MAP[e.id as keyof typeof BOSS_MAP]?.name, 'boss', 2.2));
    g.bus.on('boss_defeated', (e) => {
      const b = BOSS_MAP[e.id as keyof typeof BOSS_MAP];
      this.hud.banner(`${b ? b.name.toUpperCase() : 'ENCORE'} DEFEATED!`, e.noHit ? 'Untouchable!' : b?.defeat, 'gold', 3.2);
      this.save.data.stats.bossKills[e.id] = (this.save.data.stats.bossKills[e.id] ?? 0) + 1;
      // first-ever kill unlocks are awarded at run end via achievements
    });
    g.bus.on('music', (e) => a.setCue(e.cue));
    g.bus.on('act', (e) => {
      a.setCue(`act${e.act}`);
      this.hud.banner(['', 'ACT I', 'ACT II', 'ACT III', 'ACT IV'][e.act], ['', 'Warm-Up', 'The Crowd', 'The Parade', 'Last Call'][e.act], 'gold', 2.6);
    });
    g.bus.on('carnival_event', (e) => {
      a.play(e.id === 'calliope' ? 'calliope' : 'banner', { vol: 0.7 });
      this.hud.eventBanner(e.id);
    });
    g.bus.on('banner', (e) => this.hud.banner(e.text, e.sub, e.style ?? '', 2.8));
    g.bus.on('chest', (e) => {
      // the prize wheel PRESENTS what the sim already granted (entries) — it never rolls again (D-34).
      // Co-op: both screens show the same split wheel; the night resumes once both have watched it.
      const show = () => {
        a.play('chest', { vol: 0.6 });
        this.overlayPause = true;
        const fillers = g.players.flatMap((p) => [...p.weapons.list.map((w) => this.assets.weaponIcon(w.def.id)), ...[...p.passives.keys()].map((id) => this.assets.passiveIcon(id))]);
        const entries = e.entries ?? e.items.map((label) => ({ type: 'level' as const, id: g.weapons.list[0]?.def.id ?? 'throwing_cards', label }));
        this.prize.start(entries, fillers, () => {
          this.overlayPause = false;
          if (this.net?.role === 'host') this.net.host.prizeHostDone();
          else if (this.net?.role === 'guest') {
            this.net.guest.prizeDone();
            this.guestPrizeAt = g.time;
          }
          const next = this.chestQueue.shift();
          if (next) next();
        });
      };
      if (this.prize.active) this.chestQueue.push(show);
      else show();
    });
    g.bus.on('meta_currency', (e) => {
      if (!mine(e.player)) return;
      // Lost & Found vouchers are banked immediately so they survive a lost or abandoned run (D-31)
      this.save.data.lostTickets += e.amount;
      this.save.data.totalEarned += e.amount;
      this.save.save();
      this.hud.toastMsg(`+${e.amount} Lost Tickets banked at the Lost & Found`);
      a.play('coins', { vol: 0.5 });
    });
    g.bus.on('quest', (q) => this.onQuest(g, q));
    g.bus.on('balloon_drift', (e) => {
      // a distant rubbery squeak from the direction the bouquet drifts in
      a.play('squeak', { vol: 0.12 + Math.min(0.2, e.size * 0.004), pitch: 0.55, pan: camPan(e.x) });
    });
    g.bus.on('evolved', (e) => {
      a.play('evolve', { vol: 0.9 });
      this.hud.banner(`${WEAPONS[e.to].name.toUpperCase()}!`, 'EVOLUTION', 'gold', 3);
      this.input.rumble(0.7, 300);
    });
    g.bus.on('discover', (e) => {
      if (this.save.discover(e.id)) {
        const nm = ENEMIES[e.id]?.name ?? BOSS_MAP[e.id as keyof typeof BOSS_MAP]?.name ?? WEAPONS[e.id]?.name ?? PASSIVES[e.id]?.name;
        const now = performance.now();
        if (nm && !g.cfg.daily && now - this.lastPediaToast > 5000) {
          this.lastPediaToast = now;
          this.hud.toastMsg(`New Carnival-pedia entry: ${nm}`);
        }
      }
    });
    g.bus.on('stall', () => a.play('rumble', { vol: 0.8 }));
    g.bus.on('dawn', () => {
      this.dawnT = 0;
      a.play('victory', { vol: 0.9 });
      this.hud.dawnTitle();
    });
    g.bus.on('run_end', (e) => this.onRunEnd(e.stats));
  }

  pickDraft(i: number): void {
    const g = this.game;
    if (!g) return;
    if (this.net?.role === 'guest') {
      // the host applies it; the host re-sends the hand if it was refused
      this.net.guest.draft('choose', i);
      this.draft.hide();
      return;
    }
    g.chooseDraft(i, this.localIndex);
    if (!g.draftPending(this.localIndex)) this.draft.hide();
  }
  private rerollDraft(): void {
    if (this.net?.role === 'guest') this.net.guest.draft('reroll');
    else this.game?.rerollDraft(this.localIndex);
  }
  private banishDraft(i: number): void {
    if (this.net?.role === 'guest') this.net.guest.draft('banish', i);
    else this.game?.banishDraft(i, this.localIndex);
  }
  private skipDraft(): void {
    if (this.net?.role === 'guest') {
      this.net.guest.draft('skip');
      this.draft.hide();
    } else this.game?.skipDraft(this.localIndex);
  }

  /** The Last Song's cues: every step answers with sound and light, never with UI checklists (D-32). */
  private onQuest(g: Game, q: QuestCue): void {
    const a = this.audio;
    const pan = (x?: number) => (x === undefined ? 0 : Math.max(-1, Math.min(1, (x - this.renderer.camX) / (this.renderer.viewWidth * 0.6))));
    const bell = (note: number, vol = 0.45, x?: number) => a.play('bellnote', { vol, pitch: note / 523.25, pan: pan(x) });
    const fx = (type: string, x: number, y: number, style: string, aa = 1) => this.renderer.fx.handle([{ type: type as never, x, y, a: aa, b: 0, c: 0, style }]);
    // the secret quest's chimes and fortunes must carry over the music (D-55)
    const duck = QUEST_DUCK[q.event] ?? (q.text ? 2.2 : 0);
    if (duck) a.duckMusic(duck);
    if (q.text) {
      this.fortune.show(q.text, q.event === 'idle' ? 6 : 10);
      a.play('fortune', { vol: 0.6 });
    }
    switch (q.event) {
      case 'soul':
        a.play('soul', { vol: 0.35, pan: pan(q.x) });
        if (q.x !== undefined && q.y !== undefined) fx('spark', q.x, q.y, 'gravity');
        if (q.a !== undefined) {
          const L = LAST_SONG.lamps[q.a];
          fx('ring', L.x, L.y, 'gravity', 60);
        }
        break;
      case 'lamp_lit': {
        a.play('lamp_lit', { vol: 0.7, pan: pan(q.x) });
        const ls = g.quests.get<{ lit: boolean[] } & import('./sim/quest').QuestChain>('last_song');
        const lit = ls ? ls.lit.filter(Boolean).length : 1;
        const name = q.a !== undefined ? LAST_SONG.lamps[q.a].id : 'lamp';
        this.hud.whisper(`The ${name} lamp remembers…`, LAST_SONG.lamps.map((_, k) => (ls?.lit[k] ? '●' : '○')).join(' ') + (lit >= 4 ? '' : '   the others are still cold'));
        if (q.b) bell(q.b, 0.5, q.x);
        if (q.x !== undefined && q.y !== undefined) {
          fx('ring', q.x, q.y, 'gravity', 220);
          fx('explode', q.x, q.y, 'frost', 120);
        }
        this.input.rumble(0.3, 160);
        break;
      }
      case 'carousel_wakes':
        this.hud.whisper('Something stirs on the carousel…', 'a tune, long forgotten, begins to play', 5);
        a.play('carousel_wake', { vol: 0.8 });
        a.play('rumble', { vol: 0.5 });
        this.renderer.fx.shake = Math.max(this.renderer.fx.shake, 0.5);
        break;
      case 'musicbox': {
        // the melody, in this night's order, drifting from the carousel
        const ls = g.quests.get<{ order: number[] } & import('./sim/quest').QuestChain>('last_song');
        const d = q.x !== undefined ? Math.hypot(g.player.x - q.x, g.player.y - (q.y ?? 0)) : 0;
        const vol = Math.max(0.08, 0.42 * (1 - d / LAST_SONG.carousel.hearRange));
        (ls?.order ?? [0, 1, 2, 3]).forEach((li, k) => setTimeout(() => bell(LAST_SONG.lamps[li].note * 2, vol, q.x), k * 420));
        break;
      }
      case 'hum':
        a.play('hum', { vol: 0.4, pan: pan(q.x) });
        if (q.b) bell(q.b, 0.18, q.x);
        break;
      case 'note':
        if (q.b) bell(q.b, 0.6, q.x);
        if (q.x !== undefined && q.y !== undefined) fx('ring', q.x, q.y, 'gravity', 90);
        break;
      case 'lamp_wisp':
        if (q.a !== undefined) this.renderer.props.wisp(q.a);
        break;
      case 'note_true':
        this.hud.whisper('The note rings true.', `${['', 'one', 'two', 'three'][q.a ?? 0] ?? ''} of four`, 2.6);
        break;
      case 'sour':
        this.hud.whisper('The melody falters.', 'begin again', 2.6);
        a.play('sour', { vol: 0.5, pan: pan(q.x) });
        break;
      case 'melody_solved':
        this.hud.whisper('The song is remembered.', 'somewhere to the south-west, a machine whirs awake', 5.5);
        LAST_SONG.lamps.forEach((l, k) => setTimeout(() => bell(l.note, 0.5), k * 160));
        setTimeout(() => a.play('toll', { vol: 0.6 }), 900);
        break;
      case 'ding':
        if (q.b && q.a) this.hud.whisper(`The bell answers — ${['', 'once', 'twice', 'thrice'][Math.min(3, q.a)] ?? ''}.`, q.a >= 3 ? 'the bell falls silent' : undefined, 3);
        a.play('ding', { vol: q.b ? 0.8 : 0.4, pan: pan(q.x) });
        if (q.b && q.x !== undefined && q.y !== undefined) fx('ring', q.x, q.y - 40, 'bell', 120);
        break;
      case 'clunk':
        a.play('clunk', { vol: 0.55, pan: pan(q.x) });
        break;
      case 'ticket':
        this.hud.whisper('A Ghost Ticket follows you.', 'admit one — to the last show of the night', 6);
        a.play('ghost_ticket', { vol: 0.8 });
        this.renderer.fx.screenFlash = Math.max(this.renderer.fx.screenFlash, 0.25);
        this.renderer.fx.screenFlashCol = [0.5, 1, 0.75];
        break;
      case 'finale':
        a.play('toll', { vol: 0.8 });
        setTimeout(() => a.play('toll', { vol: 0.7 }), 1400);
        this.hud.banner('THE MUSIC DOES NOT STOP', 'The Ghost Ticket burns cold in your hand…', 'danger', 3.5);
        break;
      case 'calliope_rises':
        a.play('rumble', { vol: 0.9 });
        a.play('carousel_wake', { vol: 0.9, pitch: 0.7 });
        break;
      case 'complete': {
        // the reward is permanent: the Steam Calliope joins the draft pool for good
        const s = this.save;
        for (const id of SECRET_UNLOCKS) if (!s.data.unlocks.includes(id)) s.data.unlocks.push(id);
        const wasLocked = !s.hubUnlocked();
        const rec = (s.data.quests[q.chain] ??= { completions: 0, bestStage: 0 });
        rec.completions++;
        rec.bestStage = Math.max(rec.bestStage, 7);
        s.save();
        if (wasLocked) this.hubJustUnlocked = true;
        this.hud.banner('THE LAST SONG', 'The music has ended. The Steam Calliope will remember you.', 'gold', 5);
        break;
      }
    }
  }

  private resume(): void {
    this.screenEl?.remove();
    this.screenEl = null;
    if (this.net?.role === 'host') this.net.host.setPaused(false);
    else if (this.net?.role === 'guest') this.net.guest.pause(false);
    this.go('playing');
  }

  private abandon(): void {
    const g = this.game;
    if (!g) return;
    if (this.net?.role === 'guest') {
      // a guest cannot end the host's night: they step out, and the host carries on
      this.leaveNet(false);
      return;
    }
    this.screenEl?.remove();
    this.screenEl = null;
    this.state = 'playing';
    if (this.net?.role === 'host') this.net.host.setPaused(false);
    g.endRun(false);
  }

  private onRunEnd(st: RunStats): void {
    const s = this.save;
    const g = this.game!;
    s.data.lostTickets += st.lostTickets;
    s.data.totalEarned += st.lostTickets;
    s.data.stats.runs++;
    if (st.won && !st.endless) s.data.stats.wins++;
    s.data.stats.kills += st.kills;
    s.data.stats.bestTime = Math.max(s.data.stats.bestTime, st.time);
    s.data.stats.playSeconds += (performance.now() - this.runStart) / 1000;
    // the furthest the Last Song got (persisted progress memory, not run state)
    const qrec = (s.data.quests.last_song ??= { completions: 0, bestStage: 0 });
    qrec.bestStage = Math.max(qrec.bestStage, st.questStage);
    s.data.history.unshift({ date: new Date().toISOString(), character: st.character, difficulty: st.difficulty, won: st.won, time: st.time, kills: st.kills, level: st.level, lostTickets: st.lostTickets, curse: st.curse, endless: st.endless, daily: st.daily });
    s.data.history = s.data.history.slice(0, 30);
    let dailyBest = false;
    if (st.daily) {
      const seed = dailyInfo().seed;
      const prev = s.data.daily[seed];
      if (!prev || st.score > prev.score) {
        s.data.daily[seed] = { score: st.score, won: st.won, character: st.character };
        dailyBest = true;
      }
    }
    // achievements + new unlock notices
    const beforeChars = CHARACTERS.filter((c) => s.characterRequirementMet(c.id)).map((c) => c.id);
    const beforeDiffs = DIFFICULTIES.filter((d) => s.difficultyAvailable(d.id)).map((d) => d.id);
    const beforeCurse = s.curseAvailable();
    const earned = s.grantAchievements(st.achievementsHit);
    const notes: string[] = [];
    for (const c of CHARACTERS) if (!beforeChars.includes(c.id) && s.characterRequirementMet(c.id)) notes.push(`${c.name} can now be unlocked in the Lost & Found!`);
    for (const d of DIFFICULTIES) if (!beforeDiffs.includes(d.id) && s.difficultyAvailable(d.id)) notes.push(`${d.name} difficulty unlocked!`);
    if (!beforeCurse && s.curseAvailable()) notes.push('The Curse can now be toggled at character select.');
    if (st.achievementsHit.includes('beat_ringmaster') && earned.some((a) => a.id === 'beat_ringmaster')) notes.push('Endless "Lock-In" unlocked — choose to stay after dawn.');
    s.save();
    this.audio.play(st.won ? 'victory' : 'defeat', { vol: 0.8 });
    this.audio.setCue('results');
    this.draft.hide();
    this.prizeUi.hide();
    this.fortune.hide();
    const canEndless = st.won && !st.endless && s.endlessAvailable() && !this.net;
    const net = this.net;
    setTimeout(() => {
      if (this.game !== g) return; // already back in the lobby / menu
      this.screenEl?.remove();
      this.state = 'results';
      this.hud.root.classList.add('under');
      if (st.trueEnding) notes.unshift('The Steam Calliope now plays in the draft pool.');
      if (this.hubJustUnlocked) {
        notes.unshift('THE MIDWAY IS YOURS: from now on the carnival opens as your hub. Walk the grounds, visit the cast, and enter the Big Top for another night.');
        this.hubJustUnlocked = false;
      }
      const actions = net
        ? net.role === 'host'
          ? { again: () => this.coopToLobby(), againLabel: this.save.hubUnlocked() ? 'Back to the Midway' : 'Back to the Lobby', menu: () => this.toMenu(), lostfound: () => this.toMenu('lostfound') }
          : { again: () => this.hud.toastMsg(`Waiting for ${g.players[0]?.name ?? 'the host'} to head back to the lobby…`), againLabel: 'Wait for Host', menu: () => this.toMenu(), lostfound: () => this.toMenu('lostfound') }
        : { again: () => this.lastRun && this.startRun(this.lastRun), menu: () => this.toMenu(), lostfound: () => this.toMenu('lostfound'), endless: canEndless ? () => this.goEndless() : undefined };
      const el = S.resultsScreen(this.ctx, st, { achievements: earned.map((a) => `${a.name} — ${a.desc} (+${a.reward} LT)`), newUnlocks: notes, dailyBest }, { ...actions, menuLabel: net ? (net.role === 'host' ? 'Close the Lobby' : 'Leave') : this.save.hubUnlocked() ? 'To the Midway' : undefined });
      this.ui.append(el);
      this.screenEl = el;
      this.nav = new FocusNav(el);
      this.nav.ensure();
    }, st.won ? 400 : 1100);
    void g;
  }

  private goEndless(): void {
    const g = this.game;
    if (!g) return;
    this.screenEl?.remove();
    this.screenEl = null;
    this.renderer.dawn = 0;
    this.dawnT = -1;
    this.hud.reset();
    this.hud.setPortrait(g.player.char.id);
    this.hud.root.classList.remove('under');
    g.startEndless();
    this.go('playing');
  }

  private toMenu(next: State = 'title'): void {
    this.leaveNet(true);
    this.endRunView();
    this.makeDemo();
    this.go(next);
  }

  /** Tear down the in-run views (HUD, overlays, the game) without leaving any session. */
  private endRunView(): void {
    this.hubHud?.root.remove();
    this.hubTalk = null;
    this.chestQueue = [];
    this.prize.finishNow();
    this.hud.root.remove();
    this.hud.coopInfo = null;
    this.draft.hide();
    this.prizeUi.hide();
    this.fortune.hide();
    this.game?.bus.clear();
    this.game = null;
    this.renderer.fx.clear();
    this.renderer.dawn = 0;
  }

  private tutorial(id: string, html: string): void {
    const st = this.save.data.settings;
    if (st.tutorialsSeen.includes(id) || this.game?.cfg.daily) return;
    st.tutorialsSeen.push(id);
    this.save.save();
    this.hud.coach(html, 7);
  }

  // =================================================================== input
  private onNav(e: NavEvent): void {
    if (this.state === 'press') {
      this.pressed();
      return;
    }
    if (this.state === 'hub') {
      if (e === 'pause' || e === 'back') {
        if (this.hubTalk) this.hubTalk = null;
        else {
          this.audio.play('ui_click');
          this.go('midway');
        }
      } else if (e === 'confirm' || e === 'interact') this.hubInteract();
      return;
    }
    if (this.state === 'midway' && (e === 'pause' || e === 'back')) {
      this.go('hub');
      return;
    }
    if (this.state === 'playing' && this.game) {
      if (this.prize.active) {
        if (e === 'confirm') this.prize.skip(false);
        else if (e === 'back' || e === 'pause') this.prize.skip(true);
        return;
      }
      if (this.draft.visible) {
        const g = this.game;
        if (e === 'reroll') this.rerollDraft();
        else if (e === 'banish') this.draft.toggleBanish();
        else if (e === 'skip') this.skipDraft();
        else if (e === 'confirm') this.draft.nav.activate();
        else if (e === 'up' || e === 'down' || e === 'left' || e === 'right') {
          this.draft.nav.move(e);
          this.audio.play('ui_hover', { vol: 0.3 });
        }
        if (this.net?.role !== 'guest' && !g.draftPending(this.localIndex)) this.draft.hide();
        return;
      }
      if (e === 'pause' && (this.game.phase === 'play' || (this.net && this.game.phase === 'draft'))) {
        this.audio.play('ui_click');
        this.go('paused');
      }
      return;
    }
    if (this.state === 'paused' && (e === 'pause' || e === 'back')) {
      this.resume();
      return;
    }
    // the lobby screens are left with their own buttons (Back would silently drop the session)
    if ((this.state === 'lobby' || this.state === 'mp_join' || this.state === 'netmsg') && (e === 'back' || e === 'pause')) return;
    if (!this.nav) return;
    if (e === 'up' || e === 'down' || e === 'left' || e === 'right') {
      const cur = this.nav.current as any;
      if ((e === 'left' || e === 'right') && cur?.navAdjust) {
        cur.navAdjust(e === 'left' ? -1 : 1);
        return;
      }
      if (this.nav.move(e)) this.audio.play('ui_hover', { vol: 0.3 });
    } else if (e === 'confirm') this.nav.activate();
    else if (e === 'back' || e === 'pause') {
      this.audio.play('ui_back', { vol: 0.5 });
      if (this.state === 'settings') this.settingsBack();
      else if (this.state === 'results') this.toMenu();
      else if (this.state !== 'title') this.go('title');
    }
  }

  // =================================================================== main loop
  private frame(t: number): void {
    requestAnimationFrame((tt) => this.frame(tt));
    this.lastFrameAt = performance.now();
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.25) dt = 0.25;
    this.fps += (1 / Math.max(0.001, dt) - this.fps) * 0.05;
    const g = this.game;
    const net = this.net;
    if (net?.role === 'host') net.host.update(t, dt * 1000);
    else if (net?.role === 'guest') net.guest.update(t);
    const playing = this.state === 'playing' && g;
    // player screen position for mouse aim
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const target = g && (playing || this.state === 'paused' || g.hub) ? g.player : this.demo!.player;
    const sp = this.renderer.worldToScreen(target.x, target.y, cssW, cssH, 30);
    this.input.poll(sp.x, sp.y);
    if (net?.role === 'guest' && g && (this.state === 'playing' || this.state === 'paused' || this.state === 'results' || g.hub)) {
      this.guestFrame(dt, t, cssW, cssH);
      return;
    }
    const hs = net?.role === 'host' && g ? net.host : null;
    if (g?.hub) {
      this.hubFrame(dt, cssW, cssH, hs);
      return;
    }
    if (playing) {
      g!.input.moveX = this.input.moveX;
      g!.input.moveY = this.input.moveY;
      if (import.meta.env.DEV && this.autopilot) {
        this.demoAutopilot(g!);
        if (g!.phase === 'draft') this.pickDraft(0);
      }
      g!.input.aimX = this.input.aimX;
      g!.input.aimY = this.input.aimY;
      g!.input.aimActive = this.input.aimActive;
      const pb = this.renderer.post;
      pb.bloomScale += ((this.prize.active ? 0.35 : 1) - pb.bloomScale) * Math.min(1, dt * 6);
      this.renderer.overlayFocus += ((this.prize.active ? 1 : 0) - this.renderer.overlayFocus) * Math.min(1, dt * 6);
      this.prize.update(dt, (k) => {
        this.renderer.fx.screenFlash = Math.max(this.renderer.fx.screenFlash, k);
        this.renderer.fx.screenFlashCol = [1, 0.85, 0.7];
      });
      this.fortune.update(dt);
      // co-op host: the night also holds for a pause, a prize wheel or a dropped partner on either side
      const held = !!hs && (hs.paused || !hs.prizeReady);
      if (!this.overlayPause && g!.phase !== 'draft' && !held) {
        this.acc += dt * this.simSpeed;
        let n = 0;
        const maxTicks = Math.max(5, Math.ceil(this.simSpeed * 5));
        while (this.acc >= TICK && n < maxTicks) {
          hs?.beforeTick(g!);
          g!.tick();
          this.acc -= TICK;
          n++;
        }
        if (n >= maxTicks) this.acc = 0;
      }
      hs?.captureFx(g!.fx.events); // the guest's copy of this frame's sparks, before the renderer drains them
      if (g!.phase === 'draft' && this.draft.visible && !g!.draftPending(this.localIndex)) this.draft.hide();
      if (this.dawnT >= 0) {
        this.dawnT += dt;
        this.renderer.dawn = Math.min(1, this.dawnT / 4);
      }
      const alpha = this.overlayPause || g!.phase === 'draft' || held ? 1 : Math.min(1, this.acc / TICK);
      this.renderer.render(g!, alpha, dt);
      this.stageTug(g!);
      this.updateCoopHud();
      this.hud.update(g!, this.fps, dt, { w: cssW, h: cssH, toScreen: (x, y) => this.renderer.worldToScreen(x, y, cssW, cssH) });
    } else if (this.state === 'paused' || this.state === 'results') {
      if (g) {
        hs?.captureFx(g.fx.events);
        this.renderer.render(g, 1, dt);
      }
    } else if (this.demo) {
      // attract mode behind the menus
      this.demoAutopilot(this.demo);
      this.acc += dt;
      let n = 0;
      while (this.acc >= TICK && n < 4) {
        if (this.demo.phase === 'draft') this.demo.chooseDraft(0);
        this.demo.tick();
        this.acc -= TICK;
        n++;
      }
      if (this.demo.time > 400 || this.demo.phase === 'ended') this.makeDemo();
      this.renderer.render(this.demo, Math.min(1, this.acc / TICK), dt, { menu: true });
    }
  }

  // =================================================================== online co-op (D-52)
  private profileBase(name: string) {
    const perk = (id: string) => this.save.perkLevel(id);
    return { name, meta: this.save.metaStats(), rerolls: perk('reroll'), banishes: perk('banish'), canSkip: this.save.isUnlocked('f_skip'), aimMode: this.save.data.settings.aimMode ?? 'auto' };
  }

  private guestProfile(name: string): GuestProfile {
    return { ...this.profileBase(name), chars: CHARACTERS.filter((c) => this.save.characterAvailable(c.id)).map((c) => c.id), pref: this.hubCharacter() };
  }

  // =================================================================== the Midway hub (D-60)
  /** The starting cast this save has unlocked: they stand at their games on the Midway. */
  private hubCast(): string[] {
    return HUB_NPCS.filter((n) => this.save.characterAvailable(n.char)).map((n) => n.char);
  }

  /** Who you walk the Midway as: the fool you last played. */
  private hubCharacter(): string {
    const s = this.save;
    return s.characterAvailable(s.data.last.character) ? s.data.last.character : 'carny';
  }

  /** Walk onto the Midway alone (a co-op host rebuilds the shared one instead). */
  private startHub(): void {
    if (this.net?.role === 'host') return this.restartHub();
    this.endRunView();
    const ch = this.hubCharacter();
    const g = new Game({ character: ch, difficulty: 'midway', curse: false, seed: (Math.random() * 2 ** 31) | 0, players: [{ character: ch, name: L.loadName() || 'You' }], hub: { npcs: this.hubCast() } });
    this.beginHub(g, 0);
  }

  /** Co-op host: (re)build the Midway for everyone seated, keeping each where they stood, and send it out. */
  private restartHub(): void {
    if (this.net?.role !== 'host') return this.startHub();
    const hs = this.net.host;
    const old = this.game?.hub ? this.game : null;
    this.hubParty = this.hubPartyKey();
    if (!hs.hostCharacter) hs.hostCharacter = this.hubCharacter();
    const names = [hs.self.name, ...hs.guests.map((s) => s.profile.name)];
    const at = names.map((nm, i) => {
      const p = old?.players.find((q) => q.name === nm);
      return p ? { x: p.x, y: p.y } : { x: HUB_SPAWN.x + (i - 2) * 60, y: HUB_SPAWN.y + 30 };
    });
    const cfg = hs.startHub({ seed: (Math.random() * 2 ** 31) | 0, unlocked: [...this.save.unlockedSet()], questMemory: {}, npcs: this.hubCast(), at });
    this.endRunView();
    const g = new Game(runConfigFromStart(cfg));
    hs.attachGame(g);
    this.beginHub(g, 0);
  }

  private hubPartyKey(): string {
    return this.net?.role === 'host' ? this.net.host.guests.map((s) => `${s.index}:${s.profile.name}:${s.connected}`).join('|') : '';
  }

  /** Guest: the host is on the Midway; build the mirror the session will feed. */
  private startGuestHub(cfg: StartCfg): Game {
    void this.audio.unlock();
    this.mpStatus = '';
    this.mpBusy = false;
    this.endRunView();
    const g = new Game(runConfigFromStart(cfg));
    this.beginHub(g, this.net?.role === 'guest' ? this.net.guest.slot : 1);
    setTimeout(() => this.sendView(), 0);
    return g;
  }

  /** Step into a built hub world (solo, the host's, or a guest's mirror). */
  private beginHub(g: Game, local: number): void {
    this.game?.bus.clear();
    this.game = g;
    this.localIndex = local;
    g.setCtx(g.players[local] ?? g.players[0]);
    this.hubTalk = null;
    this.hubTarget = null;
    this.acc = 0;
    this.renderer.fx.clear();
    this.renderer.dawn = 0;
    this.renderer.snapCamera(g.player.x, g.player.y);
    this.hud.root.remove();
    if (!this.hubHud.root.isConnected) this.ui.append(this.hubHud.root);
    this.hubHud.welcome();
    this.go('hub');
  }

  /** Solo / host frame on the Midway: walk (menus over it leave everyone idle), tick, render, labels. */
  private hubFrame(dt: number, cssW: number, cssH: number, hs: HostSession | null): void {
    const g = this.game!;
    const walking = this.state === 'hub' && !this.hubTalk;
    g.inputs[this.localIndex].moveX = walking ? this.input.moveX : 0;
    g.inputs[this.localIndex].moveY = walking ? this.input.moveY : 0;
    this.acc += dt;
    let n = 0;
    while (this.acc >= TICK && n < 5) {
      hs?.beforeTick(g);
      g.tick();
      this.acc -= TICK;
      n++;
    }
    if (n >= 5) this.acc = 0;
    g.setCtx(g.players[this.localIndex] ?? g.players[0]);
    this.renderer.render(g, Math.min(1, this.acc / TICK), dt);
    this.updateHubHud(cssW, cssH);
  }

  /** Labels over the cast and landmarks, the nearest thing to use, the conversation, the lobby code. */
  private updateHubHud(cssW: number, cssH: number): void {
    const g = this.game!;
    const rep = this.net?.role === 'guest' ? this.net.guest.replica : null;
    const me = rep ? rep.localDrawPos() : g.players[this.localIndex] ?? g.player;
    const toS = (x: number, y: number, hgt: number) => this.renderer.worldToScreen(x, y, cssW, cssH, hgt);
    const shown = (s: { x: number; y: number }) => s.x > -80 && s.x < cssW + 80 && s.y > -40 && s.y < cssH + 120;
    const labels: HubLabel[] = [];
    let best: { kind: 'npc' | 'booth' | 'bigtop' | 'exit'; i: number } | null = null;
    let bd = Infinity;
    const consider = (kind: 'npc' | 'booth' | 'bigtop' | 'exit', i: number, x: number, y: number, r: number) => {
      const d = Math.hypot(me.x - x, me.y - y);
      if (d < r && d < bd) [bd, best] = [d, { kind, i }];
    };
    g.hubNpcs.forEach((n, i) => {
      const s = toS(n.x, n.y, 112);
      if (shown(s)) labels.push({ x: s.x, y: s.y, text: n.char.name, sub: `at ${HUB_NPCS.find((d) => d.char === n.char.id)?.at ?? ''}`, kind: 'npc' });
      consider('npc', i, n.x, n.y, 115);
    });
    for (const [kind, sp] of [['booth', HUB_SPOTS.booth], ['bigtop', HUB_SPOTS.bigTop]] as const) {
      const s = toS(sp.x, sp.y - (kind === 'bigtop' ? 60 : 100), kind === 'bigtop' ? 330 : 190);
      if (shown(s)) labels.push({ x: s.x, y: s.y, text: sp.label, sub: sp.sub, kind: 'spot' });
      consider(kind, 0, sp.x, sp.y, sp.r);
    }
    HUB_EXITS.forEach((e, i) => {
      const s = toS(e.x, e.y - 30, 130);
      if (shown(s)) labels.push({ x: s.x, y: s.y, text: e.label, sub: e.sub, kind: 'exit' });
      consider('exit', i, e.x, e.y, e.r);
    });
    if (g.players.length > 1) {
      g.players.forEach((p, i) => {
        if (i === this.localIndex) return;
        const s = toS(p.x, p.y, 100);
        if (shown(s)) labels.push({ x: s.x, y: s.y, text: p.name, kind: 'player', cls: `p${i + 1}` });
      });
    }
    this.hubTarget = best;
    if (this.hubTalk) {
      const n = g.hubNpcs[this.hubTalk.npc];
      if (!n || Math.hypot(me.x - n.x, me.y - n.y) > 230) this.hubTalk = null;
    }
    let dialogue = null;
    if (this.hubTalk) {
      const n = g.hubNpcs[this.hubTalk.npc];
      const d = HUB_NPCS.find((x) => x.char === n.char.id)!;
      dialogue = { name: n.char.name, at: d.at, portrait: this.assets.portrait(n.char.id), text: d.lines[this.hubTalk.line], page: this.hubTalk.line + 1 < d.lines.length ? 'E / A: more  ·  Esc: goodbye' : 'E / A: goodbye' };
    }
    const key = this.input.usingGamepad ? 'A' : 'E';
    let prompt: { text: string; sub?: string; key: string } | null = null;
    const t = this.hubTarget as { kind: 'npc' | 'booth' | 'bigtop' | 'exit'; i: number } | null;
    if (!dialogue && t) {
      if (t.kind === 'npc') prompt = { key, text: `Talk to ${g.hubNpcs[t.i].char.name}` };
      else if (t.kind === 'booth') prompt = { key, text: 'Ticket Booth', sub: 'spend your Lost Tickets' };
      else if (t.kind === 'bigtop') prompt = this.net?.role === 'guest' ? { key: '…', text: 'The Big Top', sub: 'the host starts the night here' } : { key, text: 'Enter the Big Top', sub: 'begin the First Night' };
      else prompt = { key: '✕', text: HUB_EXITS[t.i].label, sub: 'coming soon: the gates are chained shut' };
    }
    const hs = this.net?.role === 'host' ? this.net.host : null;
    this.hubHud.root.classList.toggle('under', this.state !== 'hub');
    this.hubHud.update({ labels, prompt, dialogue, code: hs ? hs.lobby.code : null, party: g.players.map((p) => p.name) });
  }

  /** Interact on the Midway: talk, shop, start the night, or rattle a chained gate. */
  private hubInteract(): void {
    const g = this.game;
    const t = this.hubTarget;
    if (!g) return;
    if (this.hubTalk && (!t || t.kind !== 'npc' || t.i !== this.hubTalk.npc)) {
      this.hubTalk = null;
      return;
    }
    if (!t) return;
    switch (t.kind) {
      case 'npc': {
        const d = HUB_NPCS.find((x) => x.char === g.hubNpcs[t.i].char.id)!;
        this.audio.play('ui_click', { vol: 0.45 });
        if (this.hubTalk?.npc === t.i) {
          if (this.hubTalk.line + 1 < d.lines.length) this.hubTalk.line++;
          else this.hubTalk = null;
        } else this.hubTalk = { npc: t.i, line: 0 };
        return;
      }
      case 'booth':
        this.audio.play('ui_click', { vol: 0.5 });
        return this.go('lostfound');
      case 'bigtop':
        if (this.net?.role === 'guest') return;
        this.audio.play('select', { vol: 0.6 });
        if (this.net?.role === 'host') return this.hubToRunLobby();
        return this.go('charselect');
      case 'exit':
        this.audio.play('clunk', { vol: 0.5 });
        return;
    }
  }

  /** Co-op host at the Big Top: everyone to character select for the First Night. */
  private hubToRunLobby(): void {
    if (this.net?.role !== 'host') return;
    this.net.host.toLobby();
    this.endRunView();
    this.makeDemo();
    this.go('lobby');
  }

  /** The Midway's pause menu: what the main menu used to offer, minus what the grounds already have. */
  private midwayMenuEl(): HTMLElement {
    const role = this.net?.role ?? null;
    const items: { label: string; fn: () => void; cls?: string }[] = [{ label: 'Back to the Midway', fn: () => this.go('hub') }];
    if (!role) {
      items.push({ label: 'Invite Friends', fn: () => void this.hostGame(L.loadName() || 'Host') });
      items.push({
        label: 'Join a Friend',
        fn: () => {
          this.endRunView();
          this.makeDemo();
          this.go('mp_join');
        },
      });
      if (this.save.dailyAvailable()) items.push({ label: 'Daily Run', fn: () => this.go('daily') });
    } else if (role === 'host') {
      items.push({
        label: 'Close the Lobby',
        fn: () => {
          this.leaveNet(true);
          this.startHub();
        },
      });
    } else items.push({ label: 'Leave the Midway', fn: () => this.toMenu() });
    items.push({ label: 'Carnival-pedia', fn: () => this.go('pedia') }, { label: 'Settings', fn: () => this.go('settings') });
    items.push({
      label: 'Title Screen',
      cls: 'small red',
      fn: () => {
        this.leaveNet(true);
        this.endRunView();
        this.makeDemo();
        this.go('press');
      },
    });
    const g = this.game;
    const text = role === 'host' ? `Lobby code ${this.net!.role === 'host' ? (this.net as Extract<NetCtx, { role: 'host' }>).host.lobby.code : ''} · ${g?.players.length ?? 1} on the Midway` : role === 'guest' ? 'You are on a friend\'s Midway.' : 'Walk the grounds: the ticket booth sells the Lost & Found, and the Big Top begins the night.';
    return L.menuPanel(this.ctx, 'The Midway', text, items);
  }

  private startBgClock(): void {
    if (this.bgClock) return;
    this.bgLast = performance.now();
    this.bgClock = new BackgroundClock(() => this.background(), () => performance.now() - this.lastFrameAt > 250);
  }

  /** Runs only while the tab is hidden: keep the host's night (and everyone's keepalives) going. */
  private background(): void {
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.bgLast) / 1000);
    this.bgLast = now;
    const n = this.net;
    if (!n) return;
    if (n.role === 'guest') {
      n.guest.update(now);
      n.guest.game?.fx.drain();
      return;
    }
    const hs = n.host;
    hs.update(now, dt * 1000);
    const g = this.game;
    // the night, or the Midway (D-60): the host's world is everyone's, so it keeps turning
    if (!g || (this.state !== 'playing' && !g.hub)) return;
    if (!this.overlayPause && g.phase !== 'draft' && !hs.paused && hs.prizeReady) {
      this.acc += dt;
      let k = 0;
      while (this.acc >= TICK && k < 15) {
        hs.beforeTick(g);
        g.tick();
        this.acc -= TICK;
        k++;
      }
      if (k >= 15) this.acc = 0;
    }
    hs.captureFx(g.fx.events);
    g.fx.drain(); // nobody is drawing them
  }

  private async hostGame(name: string): Promise<void> {
    L.storeName(name);
    this.mpBusy = true;
    this.mpStatus = 'Opening a lobby…';
    this.mpTone = 'info';
    this.go('mp');
    const session = new HostSession('', this.profileBase(name));
    try {
      const cfg = await loadNetConfig();
      this.netDesc = describeNetConfig(cfg);
      const handle = await hostLobby(cfg, (link) => session.accept(link), (t) => this.netToast(t, 'warn'));
      if (this.state !== 'mp') {
        handle.close();
        return;
      }
      session.lobby.code = handle.code;
      this.net = { role: 'host', host: session, handle };
      this.localIndex = 0;
      session.onLobby = () => this.refreshLobby();
      session.onNotice = (t, tone) => this.netToast(t, tone);
      const s = this.save;
      session.setCharacter(s.characterAvailable(s.data.last.character) ? s.data.last.character : 'carny');
      session.setDifficulty(s.difficultyAvailable(s.data.last.difficulty) ? s.data.last.difficulty : 'midway', false);
      this.mpBusy = false;
      this.mpStatus = '';
      this.startBgClock();
      if (this.save.hubUnlocked()) this.restartHub(); // friends who join walk onto the Midway (D-60)
      else this.go('lobby');
    } catch (e) {
      this.mpBusy = false;
      this.mpStatus = (e as Error).message;
      this.mpTone = 'warn';
      if (this.state === 'mp') this.go('mp');
    }
  }

  private async joinGame(raw: string): Promise<void> {
    const code = normalizeCode(raw);
    if (!isValidCode(code)) {
      this.mpStatus = 'Lobby codes are six letters and numbers (there is no O, 0, I, L or 1).';
      this.mpTone = 'warn';
      this.go('mp_join');
      return;
    }
    this.mpBusy = true;
    this.mpStatus = `Calling lobby ${code}…`;
    this.mpTone = 'info';
    this.go('mp_join');
    try {
      const cfg = await loadNetConfig();
      this.netDesc = describeNetConfig(cfg);
      const link = await joinLobby(code, cfg);
      if (this.state !== 'mp_join') {
        link.close('left');
        return;
      }
      let token: string | null = null;
      try {
        token = sessionStorage.getItem(`nc-seat-${code}`);
      } catch {
        /* no storage: no reconnect token */
      }
      const gs = new GuestSession(link, this.guestProfile(L.loadName() || 'Player'), token, performance.now());
      this.net = { role: 'guest', guest: gs, code };
      this.localIndex = 1;
      gs.onWelcome = (lobby) => {
        try {
          if (gs.token) sessionStorage.setItem(`nc-seat-${code}`, gs.token);
        } catch {
          /* ignore */
        }
        this.mpBusy = false;
        this.mpStatus = lobby.inRun ? 'Rejoining the night…' : '';
        if (!lobby.inRun) this.go('lobby');
      };
      gs.onLobby = () => this.refreshLobby();
      gs.onStart = (c, resume) => this.startGuestRun(c, resume);
      gs.onEvent = (type, e) => this.guestEvent(type, e);
      gs.onToLobby = () => this.guestToLobby();
      gs.onClosed = (reason) => this.netClosed(reason);
      this.startBgClock();
    } catch (e) {
      this.mpBusy = false;
      const kind = (e as NetError).kind;
      // the lobby was found but no link opened: say why that usually happens, using the connection check
      this.mpStatus = kind === 'timeout' || kind === 'ice' ? `${(e as Error).message} ${reachAdvice(this.netReach)}` : (e as Error).message;
      this.mpTone = 'warn';
      if (this.state === 'mp_join') this.go('mp_join');
    }
  }

  private lobbyKeyOf(): string {
    const n = this.net;
    const lobby = n?.role === 'host' ? n.host.lobby : n?.guest.lobby;
    if (!lobby) return '';
    return JSON.stringify({ ...lobby, players: lobby.players.map((p) => p && { ...p, rtt: 0 }) }) + this.mpStatus + (n?.role === 'host' && n.host.canStart());
  }

  private lobbyEl(): HTMLElement {
    const n = this.net;
    const lobby = n?.role === 'host' ? n.host.lobby : n?.guest.lobby;
    if (!n || !lobby) return L.netNotice(this.ctx, 'Lobby', 'Not connected.', [{ label: 'Back', fn: () => this.go('mp') }]);
    this.lobbyKey = this.lobbyKeyOf();
    return L.lobbyScreen(this.ctx, lobby, this.localIndex, {
      canStart: n.role === 'host' && n.host.canStart(),
      status: this.mpStatus,
      tone: this.mpTone,
      actions: {
        pick: (id) => (n.role === 'host' ? n.host.setCharacter(id) : n.guest.pick(id)),
        ready: (r) => (n.role === 'host' ? n.host.setReady(r) : n.guest.setReady(r)),
        difficulty: (id, curse) => n.role === 'host' && n.host.setDifficulty(id, curse),
        start: () => this.startHostRun(),
        leave: () => this.leaveNet(false, 'mp'),
        midway: n.role === 'host' && this.save.hubUnlocked() ? () => this.restartHub() : undefined,
      },
    });
  }

  /** Lobby changed: rebuild the screen if anything but the latency readout changed. */
  private refreshLobby(): void {
    // co-op host on the Midway: someone joined or left, so rebuild the hub around the new party (D-60)
    if (this.net?.role === 'host' && this.net.host.inHub && this.game?.hub) {
      if (this.hubPartyKey() !== this.hubParty) this.restartHub();
      return;
    }
    if (this.state !== 'lobby') return;
    const n = this.net;
    const lobby = n?.role === 'host' ? n.host.lobby : n?.guest.lobby;
    if (!lobby) return;
    if (this.lobbyKeyOf() === this.lobbyKey) {
      lobby.players.forEach((p, i) => {
        const ping = this.screenEl?.querySelector(`.mp-card.p${i + 1} .mp-ping`);
        if (ping && p?.rtt) ping.textContent = `${p.rtt} ms`;
      });
      return;
    }
    this.go('lobby');
  }

  private netToast(text: string, tone: 'info' | 'warn' = 'info'): void {
    if (this.game && (this.state === 'playing' || this.state === 'paused')) this.hud.toastMsg(text, 4000);
    else {
      this.mpStatus = text;
      this.mpTone = tone;
      if (this.state === 'lobby') this.refreshLobby();
    }
  }

  private startHostRun(): void {
    if (this.net?.role !== 'host') return;
    const hs = this.net.host;
    const cfg = hs.start({
      seed: (Math.random() * 2 ** 31) | 0,
      unlocked: [...this.save.unlockedSet()],
      questMemory: Object.fromEntries(Object.entries(this.save.data.quests).map(([k, v]) => [k, v.completions])),
    });
    if (!cfg) return;
    void this.audio.unlock();
    this.mpStatus = '';
    this.localIndex = 0;
    const g = new Game(runConfigFromStart(cfg));
    hs.attachGame(g);
    this.beginRun(g, cfg.players[0].character, 'MIDNIGHT', withYou(cfg.players.slice(1).map((p) => p.name)));
  }

  /** Guest: the host started (or we rejoined) a night — build the mirror the session will feed. */
  private startGuestRun(cfg: StartCfg, resume: boolean): Game {
    if (cfg.hub) return this.startGuestHub(cfg);
    void this.audio.unlock();
    this.mpStatus = '';
    this.mpBusy = false;
    const me = this.net?.role === 'guest' ? this.net.guest.slot : 1;
    this.localIndex = me;
    if (this.game) this.endRunView();
    const g = new Game(runConfigFromStart(cfg));
    this.beginRun(g, cfg.players[me].character, resume ? 'BACK IN THE NIGHT' : 'MIDNIGHT', resume ? 'Reconnected to the host' : withYou(cfg.players.filter((_, i) => i !== me).map((p) => p.name)));
    setTimeout(() => this.sendView(), 0);
    return g;
  }

  /** Guest: replay a host event on the mirror's bus, so the solo UI wiring handles it. */
  private guestEvent(type: string, e: unknown): void {
    const g = this.net?.role === 'guest' ? this.net.guest.game : null;
    if (!g) return;
    try {
      g.bus.emit(type as never, e as never);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[net] event failed', type, err);
    }
  }

  /** Check once what peer-to-peer connections this browser can make (shown on the multiplayer menu). */
  private checkReach(): void {
    if (this.netReach || this.reachChecking) return;
    this.reachChecking = true;
    void loadNetConfig().then((cfg) => probeReach(cfg)).then((r) => {
      this.netReach = r;
      this.reachChecking = false;
      if (this.state === 'mp') this.go('mp');
    });
  }

  /** Tell the host how much of the world this screen shows (interest management). */
  private sendView(): void {
    if (this.net?.role !== 'guest') return;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.net.guest.sendView(VIEW_HALF_X * Math.max(1, aspect / (16 / 9)), VIEW_HALF_Y * Math.max(1, 16 / 9 / aspect));
  }

  /** Guest frame: predict our own fool, interpolate everything else, render the mirror. */
  private guestFrame(dt: number, now: number, cssW: number, cssH: number): void {
    const gs = (this.net as Extract<NetCtx, { role: 'guest' }>).guest;
    const g = this.game!;
    const rep = gs.replica;
    // only walk while the host's night is actually running (otherwise the host discards the steps)
    const live = (this.state === 'playing' || (this.state === 'hub' && g.hub)) && g.phase === 'play' && !gs.pausedBy && !this.prize.active && !!rep && !rep.frozen;
    if (live) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= TICK && n < 5) {
        gs.step(this.input.moveX, this.input.moveY, this.input.aimX, this.input.aimY, this.input.aimActive);
        this.acc -= TICK;
        n++;
      }
      if (n >= 5) this.acc = 0;
    } else this.acc = 0;
    rep?.frame(dt);
    if (this.state === 'playing') {
      const pb = this.renderer.post;
      pb.bloomScale += ((this.prize.active ? 0.35 : 1) - pb.bloomScale) * Math.min(1, dt * 6);
      this.renderer.overlayFocus += ((this.prize.active ? 1 : 0) - this.renderer.overlayFocus) * Math.min(1, dt * 6);
      this.prize.update(dt, (k) => {
        this.renderer.fx.screenFlash = Math.max(this.renderer.fx.screenFlash, k);
        this.renderer.fx.screenFlashCol = [1, 0.85, 0.7];
      });
      this.fortune.update(dt);
    }
    if (this.dawnT >= 0) {
      this.dawnT += dt;
      this.renderer.dawn = Math.min(1, this.dawnT / 4);
    }
    const local = rep ? rep.localDrawPos(live ? Math.min(1, this.acc / TICK) : 1) : undefined;
    this.renderer.render(g, rep ? rep.alpha(now) : 1, dt, { local });
    this.stageTug(g);
    if (this.state === 'playing') {
      this.updateCoopHud();
      this.hud.update(g, this.fps, dt, { w: cssW, h: cssH, toScreen: (x, y) => this.renderer.worldToScreen(x, y, cssW, cssH) });
    } else if (g.hub) this.updateHubHud(cssW, cssH);
  }

  /** The co-op layer of the HUD: partner card, waiting notes, latency, diagnostics (F3). */
  private updateCoopHud(): void {
    const n = this.net;
    const g = this.game;
    if (!n || !g || g.players.length < 2) {
      this.hud.coopInfo = null;
      return;
    }
    const me = this.localIndex;
    const d = n.role === 'host' ? n.host.diag : n.guest.diag;
    // what the night is waiting on comes from the host (its own sessions, or the 'hold' it broadcasts)
    const hold = n.role === 'host' ? n.host.hold : n.guest.hold;
    const lobby = n.role === 'host' ? n.host.lobby : n.guest.lobby;
    const gone = g.players.filter((p) => p.index !== me && lobby?.players[p.index]?.connected === false).map((p) => p.index);
    const others = hold.who.filter((i) => i !== me);
    const names = listNames(others.map((i) => g.players[i]?.name ?? `Player ${i + 1}`));
    let status: CoopStatus = null;
    if (hold.why === 'reconnect' && others.length) {
      status = { text: `${names} lost connection — waiting for them to rejoin…`, action: n.role === 'host' ? { label: 'Carry on without them', fn: () => n.host.continueWithout() } : undefined };
    } else if (hold.why === 'pause' && others.length) status = { text: `Paused by ${names}` };
    else if (hold.why === 'draft' && others.length && !this.draft.visible) status = { text: `Waiting for ${names} to choose…` };
    else if (hold.why === 'prize' && others.length && !this.prize.active) status = { text: `Waiting for ${names} at the prize wheel…` };
    const diag = this.showNetDiag
      ? [
          `${d.role.toUpperCase()}  rtt ${d.rtt.toFixed(0)} ms  ${d.unreliable ? 'datagram channel' : 'reliable channel only'}  route ${d.route || '?'}`,
          `snapshots ${d.snapRate.toFixed(1)} Hz  ${(d.bytesPerSec / 1024).toFixed(1)} KB/s  last ${d.snapBytes} B  lost ${d.snapLost}  skipped ${d.skipped}`,
          n.role === 'host' ? `guest inputs: queue ${d.inputQueue}  starved ${d.starved}  dropped ${d.dropped}  invalid ${d.invalid}` : `prediction error ${d.predErr.toFixed(1)}  interval ${d.interval.toFixed(0)} ms  invalid ${d.invalid}`,
          ...(d.peers && d.peers.length > 1 ? d.peers.map((q) => `  ${q.name}: ${q.rtt.toFixed(0)} ms  ${q.kbps.toFixed(1)} KB/s  ${q.route || '?'}  queue ${q.queue}`) : []),
          this.netDesc,
        ].join('\n')
      : null;
    this.hud.coopInfo = { local: me, gone, ping: d.rtt, diag, status };
  }

  /** Host, after a co-op night: everyone back to the lobby, connection kept. */
  private coopToLobby(): void {
    if (this.net?.role !== 'host') return this.toMenu();
    this.net.host.backToLobby();
    if (this.save.hubUnlocked()) return this.restartHub(); // everyone walks back onto the Midway (D-60)
    this.endRunView();
    this.makeDemo();
    this.go('lobby');
  }

  /** Guest: the host took everyone back to the lobby. */
  private guestToLobby(): void {
    this.endRunView();
    this.makeDemo();
    this.go('lobby');
  }

  /** Guest: the session ended (host left, connection lost, or the host refused us). */
  private netClosed(reason: string): void {
    const inRun = !!this.game;
    const joining = this.state === 'mp_join';
    const code = this.net?.role === 'guest' ? this.net.code : null;
    this.stopNet();
    if (joining) {
      this.mpBusy = false;
      this.mpStatus = reason;
      this.mpTone = 'warn';
      this.go('mp_join');
      return;
    }
    if (inRun) {
      this.endRunView();
      this.makeDemo();
    }
    const actions = [{ label: 'Back to Menu', fn: () => this.go('title') }, { label: 'Multiplayer', fn: () => this.go('mp'), cls: 'purple' }];
    // a dropped connection (not the host leaving): one click back into the same seat
    if (inRun && code && /lost connection/i.test(reason)) {
      actions.unshift({
        label: 'Rejoin',
        fn: () => {
          this.go('mp_join');
          void this.joinGame(code);
        },
      });
    }
    this.go('netmsg', { title: /lost connection/i.test(reason) ? 'Connection Lost' : 'The Show Is Over', text: reason, actions });
  }

  /** Leave whatever session this tab is in (host: closes the lobby for the guest). */
  private leaveNet(quiet: boolean, next?: State): void {
    const n = this.net;
    if (n?.role === 'host') {
      n.host.close(this.game ? 'The host ended the night.' : 'The host closed the lobby.');
      n.handle?.close();
    } else if (n?.role === 'guest') n.guest.leave();
    const inRun = !!this.game && !!n;
    this.stopNet();
    if (quiet) return;
    if (inRun) {
      this.endRunView();
      this.makeDemo();
    }
    this.mpStatus = '';
    this.go(next ?? 'title');
  }

  private stopNet(): void {
    this.net = null;
    this.localIndex = 0;
    this.bgClock?.stop();
    this.bgClock = null;
    this.mpBusy = false;
  }

  demoAutopilot(g: Game): void {
    const p = g.player;
    let cx = 0, cy = 0, n = 0;
    g.forEachEnemyInCircle(p.x, p.y, 300, (e) => {
      cx += e.x;
      cy += e.y;
      n++;
    });
    let mx = Math.cos(g.realTime * 0.25), my = Math.sin(g.realTime * 0.25);
    if (n) {
      const dx = p.x - cx / n, dy = p.y - cy / n;
      const l = Math.hypot(dx, dy) || 1;
      mx = dx / l - (dy / l) * 0.9;
      my = dy / l + (dx / l) * 0.9;
    }
    mx -= p.x / 900;
    my -= (p.y - 200) / 900;
    const l = Math.hypot(mx, my) || 1;
    g.input.moveX = (mx / l) * 0.8;
    g.input.moveY = (my / l) * 0.8;
  }

}

export const _unused = { PERKS, CHARACTER_MAP };
