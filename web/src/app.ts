// Application conductor: screen state machine, fixed-timestep loop (60 Hz sim, interpolated
// render), sim → audio/HUD/save event wiring, tutorials, the attract-mode menu background, online
// co-op (lobby, host loop, guest mirror loop — D-52), and the development-only timeline tools
// (stripped from production builds).

import { MAPS, type MapId, MAP_LOCK, useMap } from './data/maps';
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
import { DraftView, Hud, PLAYER_CSS, type HudScreen } from './ui/hud';
import { kitOf } from './ui/recipes';
import { ChatBox } from './ui/chat';
import { perf, SEC } from './core/perf';

/** The in-page developer tools (window.__nc): dev builds, or a production build made with VITE_DEVTOOLS=1
 *  for benchmarking the shipped bundle. Never set for a deploy. */
const DEVTOOLS = import.meta.env.DEV || import.meta.env.VITE_DEVTOOLS === '1';
import { PerfHud, perfHudAllowed } from './ui/perfHud';
import { BUILD, UpdateChecker, noteUpdateExpected, takeUpdateResult } from './platform/updates';
import { desktop, type SessionState, type ShellUpdate } from './platform/desktop';
import { UpdatePrompt, type UpdateOffer } from './ui/updatePrompt';

/** "Later" puts an update offer away for this long (it comes back at the next safe moment after). */
const UPDATE_LATER_MS = 30 * 60 * 1000;
import { FortuneCard, PrizeOverlay } from './ui/prize';
import { PrizeWheel } from './render3d/prizeWheel';
import { LAST_SONG } from './data/quests';
import { QUEST_UNLOCKS, UNLOCKS } from './data/meta';
import { MIRA, PERFORMER_NAMES, PERFORMER_NOTES } from './data/funhouse';
import type { UnreflectedChain } from './sim/quest/unreflected';
import { ADA, CALL, GAME_NAMES, KEEPSAKES, SUMMERS_END, TIDE, callLength, nextTideTurn, shoreMix } from './data/boardwalk';
import { SE, type SummersEndChain } from './sim/quest/summersEnd';
import { LT, type LastTrainChain } from './sim/quest/lastTrain';
import { LT_TEXT } from './data/lastTrain';
import { PASSENGERS } from './data/gtStations';
import { CRUISE, REGIONS as GT_REGIONS, TRANSIT, legSpeed, regionAt as gtRegionAt, type TrainState } from './data/ghosttrain';
import { trainNow } from './sim/ghosttrain';
import { WHISTLE } from './sim/quest/gtLine';
import { LineBoard, lineText } from './ui/lineBoard';
import type { QuestCue } from './sim/quest';
import { FocusNav, h, morph, uiZoom, zoomFor } from './ui/dom';
import * as S from './ui/screens';
import { dailyInfo } from './ui/screens';
import * as L from './ui/lobby';
import { GuestSession, HostSession, runConfigFromStart } from './net/session';
import type { GuestProfile, StartCfg } from './net/protocol';
import { isValidCode, normalizeCode } from './net/codes';
import { describeNetConfig, loadNetConfig } from './net/config';
import { HubHud, type HubLabel } from './ui/hubHud';
import { HUB_EXITS, HUB_GATE_MAP, HUB_NPCS, HUB_SPAWN, HUB_SPOTS } from './data/hub';
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

type State = 'loading' | 'press' | 'title' | 'charselect' | 'daily' | 'lostfound' | 'pedia' | 'settings' | 'playing' | 'paused' | 'results' | 'mp' | 'mp_join' | 'lobby' | 'netmsg' | 'hub' | 'midway' | 'charswap' | 'pets';

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
  /** the chat box (D-65): co-op talk, plus every quest whisper and fortune, bottom-left */
  chat = new ChatBox();
  /** the developer performance overlay (F2; dev builds, or ?devhud), created on first use */
  perfHud: PerfHud | null = null;
  /** live updates (engineering optimization pass): the deploy's version.json, polled; offered at safe moments */
  updates = new UpdateChecker(new URL('version.json', document.baseURI).toString());
  private updatePrompt: UpdatePrompt | null = null;
  private updateDismissed = { id: '', at: 0 };
  private shellUpdate: ShellUpdate | null = null;
  private shellDismissedAt = 0;
  private sessionKey = '';
  state: State = 'loading';
  game: Game | null = null;
  demo: Game | null = null;
  private screenEl: HTMLElement | null = null;
  /** the cursor shows the sight (body.aiming) */
  private aimCursor = false;
  private nav: FocusNav | null = null;
  private acc = 0;
  private last = performance.now();
  fps = 60;
  private settingsBack: () => void = () => this.go('title');
  private lastRun: { character: string; difficulty: string; curse: boolean; daily?: boolean; map?: MapId } | null = null;
  private dawnT = -1;
  simSpeed = 1;
  autopilot = false;
  /** boot phases (ms): building the 2D art, sculpting and creating the renderer, and page time when ready */
  bootTimes = { assets: 0, renderer: 0, ready: 0, firstFrame: 0, firstFramePrograms: 0 };
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
  /** where the Lost & Found's Back returns to when it was opened from the co-op lobby (D-74), or 'party':
   *  wherever the co-op party is by then (a guest who went shopping from the results, D-75) */
  private lfReturn: State | 'party' | null = null;
  /** guest: finished its prize wheel at this mirror time, waiting for the host's night to resume */
  private guestPrizeAt = -1;
  /** the Boardwalk's last announced turn of the tide (its time, rounded), so each is told once */
  private tideSaid = -1;
  /** the hoist's winch as last heard (D-79): the bell's progress, rising (1) / slipping (-1) / still, when it moved, the next sound */
  private winch = { v: 0, trend: 0, at: 0, next: 0 };
  /** the Ghost Train's line under the clock, and what the train last was (for its sounds) */
  private lineBoard = new LineBoard();
  private lastTrain: TrainState | null = null;
  /** the night the line's workings were last explained in (the first time the train comes in, D-90) */
  private lineTaught: Game | null = null;
  private chuffAcc = 0;
  private chestQueue: (() => void)[] = [];

  constructor() {
    this.input = new Input(this.canvas);
    this.input.onNav((e) => this.onNav(e));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3' && this.net) {
        this.showNetDiag = !this.showNetDiag;
        e.preventDefault();
      }
      // the developer performance overlay (dev builds, or a shipped build opened with ?devhud)
      if (e.key === 'F2' && perfHudAllowed()) {
        e.preventDefault();
        void this.togglePerfHud();
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
    // the sound effects render in a worker while the art is built (they used to freeze the first key press)
    this.audio.prewarm();
    const t0 = performance.now();
    this.assets.build((p) => ld.set(p * 0.7, tips[Math.min(tips.length - 1, Math.floor(p * tips.length))]));
    const t1 = performance.now();
    const { warmModels } = await import('./render3d/models');
    await warmModels((p) => ld.set(0.7 + p * 0.3, 'Sculpting the crowd…'), [this.save.data.last.character]);
    ld.set(1, 'Opening the gates…');
    this.renderer = new GameRenderer3D(this.canvas, this.assets);
    const t2 = performance.now();
    this.bootTimes = { assets: t1 - t0, renderer: t2 - t1, ready: 0, firstFrame: 0, firstFramePrograms: 0 };
    if (import.meta.env.DEV) console.info(`[boot] assets ${(t1 - t0).toFixed(0)} ms, renderer ${(t2 - t1).toFixed(0)} ms`);
    this.input.aimScaleY = this.renderer.aimScaleY;
    this.hud = new Hud(this.assets);
    // the damage meter remembers whether it was folded (D-85)
    this.hud.meter.onFold = (open) => {
      this.save.data.settings.meterOpen = open;
      this.save.save();
    };
    // the chat box (D-65): above the HUD, under the menus; whispers of the hidden quests are written in it
    this.ui.append(this.chat.root);
    this.hud.onWhisper = (text, sub) => this.chat.add({ kind: 'quest', text, sub });
    this.chat.onSend = (text) => {
      if (this.net?.role === 'host') this.net.host.say(text);
      else if (this.net?.role === 'guest') this.net.guest.say(text);
    };
    this.chat.onOpenChange = (open) => {
      if (open) this.input.releaseAll();
    };
    this.hubHud = new HubHud((code) => void navigator.clipboard?.writeText(code));
    // alpha testing aid: ?unlock=funhouse opens the Fun House on this save (D-63)
    if (new URLSearchParams(location.search).get('unlock') === 'funhouse') {
      this.save.data.funhouseTester = true;
      this.save.save();
    }
    // alpha testing aid: ?unlock=boardwalk opens the Boardwalk on this save (D-68)
    if (new URLSearchParams(location.search).get('unlock') === 'boardwalk') {
      this.save.data.boardwalkTester = true;
      this.save.save();
    }
    // alpha testing aid: ?unlock=ghosttrain opens the Ghost Train on this save (D-80)
    if (new URLSearchParams(location.search).get('unlock') === 'ghosttrain') {
      this.save.data.ghosttrainTester = true;
      this.save.save();
    }
    // alpha testing aid: ?unlock=midway opens the hub on this save without finishing the Last Song
    if (new URLSearchParams(location.search).get('unlock') === 'midway') {
      this.save.data.midwayTester = true;
      this.save.save();
    }
    // the Ghost Train's song comes down once audio unlocks if this save can play the map (D-81); otherwise when a
    // night there first asks for it
    if (this.save.mapAvailable('ghost_train')) this.audio.loadLineSong();
    this.draft = new DraftView(this.assets, (i) => this.pickDraft(i), () => this.rerollDraft(), (i) => this.banishDraft(i), () => this.skipDraft());
    this.prizeUi = new PrizeOverlay(() => this.prize.skip(false));
    this.prize = new PrizeWheel(this.renderer.overlay, this.assets, this.prizeUi, this.audio);
    this.ctx = {
      save: this.save, assets: this.assets, audio: this.audio, input: this.input,
      click: () => this.audio.play('ui_click', { vol: 0.5 }),
      go: (s, arg) => this.go(s as State, arg),
      startRun: (o) => this.startRun(o),
      applySettings: () => this.applySettings(),
      quit: desktop ? () => this.exitGame() : undefined,
    };
    this.applySettings();
    window.addEventListener('resize', () => {
      this.resize();
      this.sendView();
    });
    this.resize();
    this.makeDemo();
    // compile the scene's shaders while the loading screen still shows (the first frame used to, frozen)
    ld.set(1, 'Lighting the lamps…');
    await this.renderer.warmUp(this.demo!);
    ld.el.remove();
    this.go('press');
    this.prewarmPrize();
    this.bootTimes.ready = performance.now();
    if (DEVTOOLS) import('./dev').then((m) => m.installDevTools(this));
    this.setupUpdates();
    requestAnimationFrame((t) => this.frame(t));
  }

  private resize(): void {
    const w = window.innerWidth, hgt = window.innerHeight;
    const q = this.save.data.settings.quality;
    const pr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1);
    this.renderer.resize(w, hgt, pr);
    // the UI layer's automatic zoom (D-74): 1 at 1080p, 1.33 at 1440p, 2 at 4K
    uiZoom.v = zoomFor(w, hgt);
    document.documentElement.style.setProperty('--ui-zoom', uiZoom.v.toFixed(4));
  }

  /** The HUD's view of the screen, in UI pixels (the layer is zoomed to the window, D-74). */
  private hudScreen(cssW: number, cssH: number): HudScreen {
    const z = uiZoom.v;
    return {
      w: cssW / z,
      h: cssH / z,
      toScreen: (x, y, hh) => {
        const s = this.renderer.worldToScreen(x, y, cssW, cssH, hh ?? 0);
        return { x: s.x / z, y: s.y / z };
      },
      headH: (id) => this.renderer.charTop(id),
    };
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
    if (this.hud) {
      this.hud.showFps = s.showFps;
      this.hud.showHurt = s.damageNumbers;
      this.hud.meter.on = s.damageMeter;
      this.hud.meter.open = s.meterOpen;
    }
  }

  // =================================================================== screens
  go(state: State, arg?: any): void {
    if (state === 'settings') {
      const from = arg;
      this.settingsBack = from === 'pause' ? () => this.go('paused') : () => this.go('title');
    }
    // leaving the Lost & Found (D-74): back to the co-op lobby it was opened from, and whatever was bought
    // there reaches the session (the host uses everyone's current perks and unlocks for the next night)
    if (this.state === 'lostfound' && state !== 'lostfound') {
      let ret = state === 'title' && this.net ? this.lfReturn : null;
      this.lfReturn = null;
      // a guest who went shopping from the results goes back to wherever the party is now (D-75)
      if (ret === 'party') ret = this.game?.hub ? 'hub' : !this.game ? 'lobby' : 'netmsg';
      // the host hasn't moved on yet: a waiting note instead (its own go() passes the purchases on)
      if (ret === 'netmsg') return this.partyWait();
      if (ret) state = ret;
      this.syncProfile(state === 'lobby');
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
        this.audio.setAmbience('carnival');
        break;
      case 'midway':
        el = this.midwayMenuEl();
        break;
      case 'pets':
        el = L.petPanel(this.ctx, this.save.petChoice() ?? null, (id) => this.setPet(id), () => this.go('midway'));
        break;
      case 'charswap':
        el = L.characterPanel(this.ctx, this.game?.hub ? this.game.players[this.localIndex]?.char.id ?? this.hubCharacter() : this.hubCharacter(), (id) => this.swapCharacter(id), () => this.go('midway'));
        break;
      case 'press':
        this.audio.setCue('menu');
        el = S.pressStart(this.ctx, () => this.pressed());
        break;
      case 'title':
        this.audio.setCue('menu');
        this.audio.setAmbience('carnival');
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
          name: L.loadName(), status: this.mpStatus, busy: this.mpBusy, reach: this.netReach, focus: arg?.focus,
          host: (n) => void this.hostGame(n),
          join: (n) => {
            L.storeName(n);
            this.mpStatus = '';
            // leaving your own Midway to join a friend's: the friend's grounds replace it once connected
            if (this.game?.hub && !this.net) {
              this.endRunView();
              this.makeDemo();
            }
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
  startRun(o: { character: string; difficulty: string; curse: boolean; daily?: boolean; seed?: number; map?: MapId }): void {
    this.audio.unlock();
    this.lastRun = o;
    const map: MapId = o.daily ? 'carnival_core' : o.map && this.save.mapAvailable(o.map) ? o.map : 'carnival_core';
    if (!o.daily) {
      this.save.data.last = { character: o.character, difficulty: o.difficulty, curse: o.curse, map };
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
      map,
      pet: o.daily ? undefined : this.save.petChoice(),
    };
    this.localIndex = 0;
    const intro = MAPS[map].intro;
    this.beginRun(new Game(cfg), o.character, o.daily ? 'DAILY RUN' : intro.title, o.daily ? dailyInfo().modName : intro.sub);
  }

  /** Common run setup for solo, the co-op host's night and the co-op guest's mirror. */
  private beginRun(g: Game, character: string, title: string, sub: string, keepChat = false): void {
    this.hubHud.root.remove();
    // a new night, a fresh chat log (D-75); a guest rejoining its night keeps that night's lines
    if (!keepChat) this.chat.clear();
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
    this.audio.endBossSong();
    this.audio.setCue(this.game?.mapId === 'fun_house' ? 'fh_act1' : this.game?.mapId === 'boardwalk' ? 'bw_act1' : this.game?.mapId === 'ghost_train' ? 'gt_act1' : 'act1');
    this.lastTrain = null;
    if (!this.lineBoard.el.isConnected) this.hud.root.append(this.lineBoard.el);
    this.lineBoard.update(null);
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
      // the hand reads the build of the player it was dealt to, as it was dealt (D-79)
      const who = g.players[e.player ?? this.localIndex] ?? g.player;
      this.draft.show(g, e.options, who, kitOf(g, who, e.build));
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
    // a Fun House night has its own score between bosses (D-63); boss fights keep Bradley's song
    const prefix = g.mapId === 'fun_house' ? 'fh_' : g.mapId === 'boardwalk' ? 'bw_' : g.mapId === 'ghost_train' ? 'gt_' : '';
    const houseCue = (c: string) => (prefix && /^(act[1-4]|endless)$/.test(c) ? `${prefix}${c}` : c);
    a.setAmbience(g.mapId === 'fun_house' ? 'funhouse' : g.mapId === 'boardwalk' ? 'boardwalk' : g.mapId === 'ghost_train' ? 'ghosttrain' : 'carnival');
    g.bus.on('music', (e) => a.setCue(houseCue(e.cue)));
    g.bus.on('act', (e) => {
      a.setCue(houseCue(`act${e.act}`));
      this.hud.banner(['', 'ACT I', 'ACT II', 'ACT III', 'ACT IV'][e.act], (MAPS[g.mapId].acts[e.act - 1] ?? '').split('— ')[1] ?? '', 'gold', 2.6);
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
    if (q.chain === 'unreflected') {
      this.onUnreflected(g, q);
      return;
    }
    if (q.chain === 'summers_end') {
      this.onSummersEnd(g, q);
      return;
    }
    if (q.chain === 'last_train' || q.chain === 'gt_line') {
      this.onLastTrain(g, q);
      return;
    }
    const a = this.audio;
    const pan = (x?: number) => (x === undefined ? 0 : Math.max(-1, Math.min(1, (x - this.renderer.camX) / (this.renderer.viewWidth * 0.6))));
    const bell = (note: number, vol = 0.45, x?: number) => a.play('bellnote', { vol, pitch: note / 523.25, pan: pan(x) });
    const fx = (type: string, x: number, y: number, style: string, aa = 1) => this.renderer.fx.handle([{ type: type as never, x, y, a: aa, b: 0, c: 0, style }]);
    // the secret quest's chimes and fortunes must carry over the music (D-55)
    const duck = QUEST_DUCK[q.event] ?? (q.text ? 2.2 : 0);
    if (duck) a.duckMusic(duck);
    if (q.text) {
      this.fortune.show(q.text, q.event === 'idle' ? 6 : 10);
      this.chat.add({ kind: 'fortune', who: 'Zoltana', text: q.text });
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
        if (q.a !== undefined) this.renderer.props.wisp?.(q.a);
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
        for (const id of QUEST_UNLOCKS.last_song) if (!s.data.unlocks.includes(id)) s.data.unlocks.push(id);
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

  /** The Unreflected's cues (D-63): Mira's whispers, the gallery's music box, glass, the projector, clocks. */
  private onUnreflected(g: Game, q: QuestCue): void {
    const a = this.audio;
    const pan = (x?: number) => (x === undefined ? 0 : Math.max(-1, Math.min(1, (x - this.renderer.camX) / (this.renderer.viewWidth * 0.6))));
    const bell = (hz: number, vol = 0.45, x?: number) => a.play('bellnote', { vol, pitch: hz / 523.25, pan: pan(x) });
    const fx = (type: string, style: string, aa = 1) => {
      if (q.x !== undefined && q.y !== undefined) this.renderer.fx.handle([{ type: type as never, x: q.x, y: q.y, a: aa, b: 0, c: 0, style }]);
    };
    const say = (line: string[], dur = 5) => {
      a.duckMusic(Math.min(3, dur * 0.5));
      this.hud.whisper(line[0], line[1], dur);
    };
    const chain = g.quests.get<UnreflectedChain>('unreflected');
    const tune = (gap = 420, vol = 0.45) => (chain?.order ?? [0, 1, 2, 3]).forEach((j, k) => setTimeout(() => bell(PERFORMER_NOTES[j], vol, q.x), k * gap));
    const flash = (r: number, gg: number, b: number, k = 0.3) => {
      this.renderer.fx.screenFlash = Math.max(this.renderer.fx.screenFlash, k);
      this.renderer.fx.screenFlashCol = [r, gg, b];
    };
    switch (q.event) {
      case 'u_awaken':
        say(MIRA.awaken, 7);
        a.play('glint', { vol: 0.8, pan: pan(q.x) });
        a.play('mirror', { vol: 0.5, pitch: 0.7 });
        fx('spark', 'frost', 1.4);
        break;
      case 'u_face_seen':
        say(MIRA.faceSeen, 4);
        a.play('mirror', { vol: 0.6, pan: pan(q.x) });
        break;
      case 'u_face':
        say(MIRA.faceFreed(PERFORMER_NAMES[q.a ?? 0], q.b ?? 1), 3.5);
        bell(PERFORMER_NOTES[q.a ?? 0], 0.55, q.x);
        a.play('ripple', { vol: 0.6, pan: pan(q.x) });
        fx('ring', 'frost', 120);
        this.input.rumble(0.25, 140);
        break;
      case 'u_faces_done':
        say(MIRA.facesDone, 8);
        setTimeout(() => a.play('toll', { vol: 0.5, pitch: 1.3 }), 600);
        break;
      case 'u_mural': {
        // the emblems in this night's order (D-75), so the clue reads even if the floor's shapes don't
        const names = ['the dumbbell', 'the tutu', 'the red nose', 'the top hat'];
        const order = chain?.order ?? [];
        say(order.length === 4 ? [MIRA.mural[0], `${MIRA.mural[1]}: ${order.map((j) => names[j]).join(', ')}`] : MIRA.mural, 9);
        tune(460, 0.4);
        fx('ring', 'gravity', 160);
        break;
      }
      case 'u_note':
        bell(PERFORMER_NOTES[q.a ?? 0], 0.6, q.x);
        if ((q.b ?? 0) < 4) say(MIRA.plinthTrue(q.b ?? 1), 2.5);
        fx('ring', 'gravity', 90);
        break;
      case 'u_sour':
        say(MIRA.plinthSour, 3);
        a.play('sour', { vol: 0.55, pan: pan(q.x) });
        break;
      case 'u_overture':
        say(MIRA.overture, 7);
        tune(220, 0.5);
        setTimeout(() => a.play('clunk', { vol: 0.7 }), 1100);
        break;
      case 'u_charge':
        if (q.a === 1) say(MIRA.projector, 4);
        a.play('clunk', { vol: 0.5, pan: pan(q.x) });
        a.play('hum', { vol: 0.3 + (q.a ?? 0) * 0.1, pan: pan(q.x) });
        break;
      case 'u_beam':
        say(MIRA.beam, 7);
        a.play('laser', { vol: 0.6, pan: pan(q.x) });
        flash(1, 0.95, 0.75, 0.2);
        break;
      case 'u_pivot':
        a.play('clank', { vol: 0.5, pan: pan(q.x) });
        a.play('glint', { vol: 0.35, pan: pan(q.x), pitch: 0.8 + (q.b ?? 0) * 0.1 });
        break;
      case 'u_door':
        say(MIRA.door, 7);
        a.play('ripple', { vol: 0.9 });
        a.play('mirror', { vol: 0.7, pitch: 0.6 });
        flash(0.5, 1, 0.9, 0.3);
        break;
      case 'u_vanity':
        say(MIRA.vanity, 10);
        a.play('toll', { vol: 0.45, pitch: 1.6 });
        break;
      case 'u_wrong_clock':
        say(MIRA.wrongClock, 3);
        a.play('laugh', { vol: 0.6, pan: pan(q.x), pitch: 0.8 });
        break;
      case 'u_mira':
        say(MIRA.mira, 7);
        a.play('ghost_ticket', { vol: 0.8 });
        for (let k = 0; k < 3; k++) setTimeout(() => a.play('toll', { vol: 0.55 }), 300 + k * 700);
        flash(0.6, 1, 0.95, 0.3);
        break;
      case 'u_finale':
        this.hud.banner(MIRA.finale[0], MIRA.finale[1], 'danger', 3.5);
        a.play('shatter', { vol: 1 });
        setTimeout(() => a.play('shatter', { vol: 0.8, pitch: 0.7 }), 500);
        this.renderer.fx.shake = Math.max(this.renderer.fx.shake, 0.8);
        flash(0.8, 1, 1, 0.6);
        break;
      case 'u_rises':
        a.play('rumble', { vol: 0.9 });
        a.play('demon', { vol: 0.6 });
        break;
      case 'u_complete': {
        // permanent: Mira's Hand Mirror joins the draft pool for good
        const s = this.save;
        for (const id of QUEST_UNLOCKS.unreflected) if (!s.data.unlocks.includes(id)) s.data.unlocks.push(id);
        const rec = (s.data.quests[q.chain] ??= { completions: 0, bestStage: 0 });
        rec.completions++;
        rec.bestStage = Math.max(rec.bestStage, 9);
        s.save();
        this.hud.banner(MIRA.complete[0], MIRA.complete[1], 'gold', 5);
        a.play('fanfare', { vol: 0.8 });
        break;
      }
    }
  }

  /**
   * Summer's End (D-68): Ada answers through the shells, the machines and bells answer for themselves,
   * and nothing ever reads like a checklist. The lighthouse flashes the call sign as the horn sounds it.
   */
  /**
   * The Ghost Train each frame (D-80): the line under the clock, the ambience's mix (the stations' night against
   * the carriages' rattle, quickening with the train), and the train's own sounds, read off the train (so a guest
   * hears exactly what the host does): the whistle and the bell when somebody pulls the cord (D-90: it keeps no
   * timetable), the doors, the chuff pulling out, the brakes coming in, the rush over the bridge. Heard full
   * aboard and at the station it stands at or is pulling into or out of; a far whistle everywhere else.
   */
  private ghostTrainFrame(g: Game, dt: number): void {
    if (g.mapId !== 'ghost_train') return;
    const me = g.players[this.localIndex] ?? g.player;
    const st = trainNow(g);
    this.lineBoard.update(g.phase === 'play' ? lineText(st, me.x, me.y) : null);
    const here = gtRegionAt(me.x, me.y);
    const riding = here === TRANSIT;
    const speed = st.phase === 'travel' ? legSpeed(st.t, st.len) / CRUISE : 0;
    this.audio.setLineMix(riding ? 1 : 0, speed);
    const prev = this.lastTrain;
    this.lastTrain = st;
    if (!prev || g.phase !== 'play') return;
    const a = this.audio;
    // how loud the train is where I am
    const near = riding || (st.phase === 'dwell' && st.at === here) || (st.phase === 'travel' && (st.at === here || (st.to === here && st.arriveIn < 12)));
    const vol = near ? 1 : 0.2;
    const crossed = (p: number, c: number, at: number) => p > at && c <= at;
    if (st.phase === 'dwell' && prev.phase === 'dwell' && st.at === prev.at) {
      // somebody pulled the whistle cord: the whistle, the bell, "All aboard!"; the doors shut as it goes
      if (!Number.isFinite(prev.departIn) && Number.isFinite(st.departIn)) {
        a.play('gt_whistle', { vol: 0.9 * vol });
        a.play('gt_bell', { vol: 0.65 * vol });
        if (near && st.at === here) this.hud.toastMsg('All aboard!');
      }
      // …and if nobody was aboard when it was due to go, the guard waits for them
      if (Number.isFinite(prev.departIn) && prev.departIn < 1 && !Number.isFinite(st.departIn) && !st.terminated && st.at === here) this.hud.toastMsg('Nobody aboard: the train waits');
      if (prev.t < 2 && st.t >= 2) a.play('gt_doors', { vol: 0.7 * (near ? 1 : 0) });
    }
    // pulling up at a station: a loud double blast for everyone there and aboard, a distant one elsewhere (D-84)
    if (st.phase === 'dwell' && prev.phase !== 'dwell') {
      const there = riding || st.at === here;
      a.play('gt_arrive', { vol: there ? 1 : 0.22 });
      if (there && !riding) this.hud.toastMsg('The train is in');
      // the first time the train comes in, how the line works (D-90): it waits for the whistle
      if (there && this.lineTaught !== g) {
        this.lineTaught = g;
        this.hud.whisper('The train waits at the platform', 'Pull the whistle cord at the front of the tender to go on to the next station.', 8);
      }
    }
    if (st.phase === 'travel') {
      // the doors shut as the departure count reaches 0 (D-84), and it pulls away
      if (prev.phase === 'dwell') {
        a.play('gt_doors', { vol: 0.8 * (near ? 1 : 0) });
        a.play('gt_chuff', { vol: 0.8 * vol });
      }
      // chuffs quickening as it pulls away, then the run
      if (st.t < 9 && near) {
        this.chuffAcc += dt * (0.8 + speed * 5);
        if (this.chuffAcc >= 1) {
          this.chuffAcc = 0;
          a.play('gt_chuff', { vol: 0.55 * vol, pitch: 0.9 + speed * 0.3 });
        }
      }
      if (crossed(prev.arriveIn, st.arriveIn, 6.5) && (riding || st.to === here)) a.play('gt_brake', { vol: 0.75 });
      if (riding && st.at === 3 && st.t >= 13 && prev.t < 13) a.play('gt_rush', { vol: 0.8 });
    }
    if (st.phase === 'approach' && st.arriveIn < 18 && prev.arriveIn >= 18) a.play('gt_whistle', { vol: 0.5 });
  }

  /** Is this machine's player aboard the moving Ghost Train? */
  private aboard(g: Game): boolean {
    const me = g.players[this.localIndex] ?? g.player;
    return gtRegionAt(me.x, me.y) === TRANSIT;
  }

  /** The Last Train Home's cues (and the line's: the board or a clock read, the whistle cord, the phantom doors). */
  private onLastTrain(g: Game, q: QuestCue): void {
    const a = this.audio;
    const pan = (x?: number) => (x === undefined ? 0 : Math.max(-1, Math.min(1, (x - this.renderer.camX) / (this.renderer.viewWidth * 0.6))));
    const fx = (type: string, style: string, aa = 1) => {
      if (q.x !== undefined && q.y !== undefined) this.renderer.fx.handle([{ type: type as never, x: q.x, y: q.y, a: aa, b: 0, c: 0, style }]);
    };
    const say = (line: string[], dur = 5) => {
      a.duckMusic(Math.min(3, dur * 0.5));
      this.hud.whisper(line[0], line[1] || undefined, dur);
    };
    const card = (line: string[], who: string, dur = 10) => {
      a.duckMusic(3);
      a.play('fortune', { vol: 0.7 });
      this.fortune.show(`${line[0]} ${line[1] ?? ''}`, dur, who);
      this.chat.add({ kind: 'fortune', who, text: line[1] || line[0] });
    };
    const ch = g.quests?.get<LastTrainChain>('last_train');
    const lever = (m: number) => [m % 5, Math.floor(m / 5) % 5, Math.floor(m / 25) % 5];
    const place = (r: number) => GT_REGIONS[r]?.name ?? '';
    switch (q.event) {
      // ---- the line's own
      case 'gt_board': {
        // the departures board or a station clock: where the train is and how to make it go, never when (D-90)
        if ((q.b ?? 0) !== this.localIndex) break;
        const r = q.a ?? 0, st = trainNow(g);
        const there = st.phase === 'dwell' && st.at === r;
        const where = there
          ? (st.terminated ? 'The last train stands here. It goes no further tonight.' : `The train stands here. Pull the whistle cord at the front of the tender to go on to ${place(st.to)}.`)
          : st.phase === 'dwell' ? `The train stands at ${place(st.at)}.` : st.phase === 'approach' ? 'The train is coming in out of the fog.' : `The train is on its way to ${place(st.to)}.`;
        a.play('gt_tick', { vol: 0.6 });
        this.hud.whisper(r === 0 ? 'The departures board: trains leave at the guard\'s whistle' : `${place(r)} — the station clock`, where, 6);
        break;
      }
      case 'gt_whistle':
        // a pull that sends the train off is heard from the train itself (ghostTrainFrame); the others here
        if (q.a !== WHISTLE.go) a.play('gt_whistle', { vol: 0.9, pan: pan(q.x) });
        if (q.a === WHISTLE.terminus && q.x !== undefined && q.y !== undefined && Math.hypot((g.players[this.localIndex] ?? g.player).x - q.x, (g.players[this.localIndex] ?? g.player).y - q.y) < 300) this.hud.whisper('This train terminates here', 'The Midnight Line goes no further tonight.', 4);
        break;
      case 'gt_phantom_open':
        this.hud.banner('THE DOORS HAVE OPENED', 'On every platform, a door stands open to the End of the Line', 'danger', 4);
        a.play('gt_toll', { vol: 0.8 });
        break;
      case 'gt_phantom_through':
        a.play('gt_doors', { vol: 0.8, pan: pan(q.x) });
        fx('ring', 'frost', 120);
        break;
      // ---- the quest
      case 'lt_ticket':
        card(LT_TEXT.ticket, 'THE BOOKING OFFICE');
        a.play('gt_punch', { vol: 0.4 });
        break;
      case 'lt_hint': {
        const [who, text] = LT_TEXT.hint[q.a ?? 0] ?? LT_TEXT.hint[0];
        card([text, ''], who, 9);
        break;
      }
      case 'lt_board_levers':
        say(LT_TEXT.boardLevers(lever(q.b ?? 0)), 7);
        a.play('papercrinkle', { vol: 0.6, pan: pan(q.x) });
        break;
      case 'lt_key':
        say(LT_TEXT.key, 6);
        a.play('glint', { vol: 0.8, pan: pan(q.x) });
        fx('spark', 'gold', 8);
        break;
      case 'lt_clock_trouble': {
        // what a stopped clock needs: the Junction's (no key, or the train away), a station's trouble, or only the key
        const r = q.a ?? 0, b = q.b ?? 0;
        const line = r === 0 ? (b === 1 ? LT_TEXT.clockTrainAway : LT_TEXT.clockKeyless) : b === 9 ? LT_TEXT.needsKey : LT_TEXT.trouble[r]?.[b] ?? LT_TEXT.needsKey;
        say(line, 7);
        a.play('gt_tick', { vol: 0.6, pitch: 0.7, pan: pan(q.x) });
        break;
      }
      case 'lt_junction_clock':
        card(LT_TEXT.junctionClock, 'HOLLOW JUNCTION', 9);
        a.play('gt_tick', { vol: 0.8, pan: pan(q.x) });
        setTimeout(() => a.play('gt_chime', { vol: 0.8 }), 300);
        setTimeout(() => a.play('gt_doors', { vol: 0.7 }), 900);
        fx('ring', 'gold', 90);
        break;
      case 'lt_page':
        say(LT_TEXT.page(q.b ?? 1), 4);
        a.play('papercrinkle', { vol: 0.8, pan: pan(q.x) });
        fx('spark', 'gold', 6);
        break;
      case 'lt_pages':
        card(LT_TEXT.pagesDone(lever(q.a ?? 0)), 'THE MENDED TIMETABLE', 14);
        a.play('gt_chime', { vol: 0.7 });
        break;
      // ---- the stations' clocks (D-90)
      case 'lt_taper':
        say(LT_TEXT.taper, 4);
        a.play('flame', { vol: 0.6, pan: pan(q.x) });
        break;
      case 'lt_taper_out':
        say(LT_TEXT.taperOut, 4);
        a.play('steam_hiss', { vol: 0.4, pan: pan(q.x) });
        break;
      case 'lt_gravelamp':
        say(LT_TEXT.gravelamp(q.b ?? 1), 3);
        a.play('flame', { vol: 0.7, pan: pan(q.x) });
        a.play('bellnote', { vol: 0.4, pitch: 0.8 + (q.b ?? 1) * 0.1 });
        fx('ring', 'gold', 60);
        break;
      case 'lt_vigil':
        card(LT_TEXT.vigil, "SAINT VESPER'S", 8);
        a.play('gt_toll', { vol: 0.6 });
        break;
      case 'lt_vigil_done':
        say(LT_TEXT.vigilDone, 6);
        a.play('gt_toll', { vol: 1 });
        fx('ring', 'frost', 200);
        break;
      case 'lt_scrap':
        say(LT_TEXT.scrap, 3);
        a.play('clank', { vol: 0.6, pan: pan(q.x) });
        break;
      case 'lt_crucible':
        say(LT_TEXT.crucible(q.a ?? 1), (q.a ?? 1) >= 3 ? 8 : 3);
        a.play('gt_furnace', { vol: 0.8, pan: pan(q.x) });
        fx('spark', 'fire', 10);
        break;
      case 'lt_ladle_done':
        say(LT_TEXT.ladleDone, 6);
        a.play('steam_hiss', { vol: 0.9, pan: pan(q.x) });
        a.play('clank', { vol: 0.8 });
        fx('spark', 'fire', 16);
        break;
      case 'lt_moment':
        say(LT_TEXT.moment(q.a ?? 0, q.b ?? 1), (q.b ?? 1) >= 3 ? 7 : 4);
        a.play('gt_chime', { vol: 0.6, pitch: 0.9 + (q.b ?? 1) * 0.1, pan: pan(q.x) });
        fx('ring', 'frost', 110);
        break;
      case 'lt_reeled':
        say(LT_TEXT.reeled, 6);
        a.play('splash', { vol: 0.8, pan: pan(q.x) });
        break;
      case 'lt_pendulum':
        say(LT_TEXT.pendulum, 4);
        a.play('clank', { vol: 0.5, pan: pan(q.x) });
        break;
      case 'lt_pendulum_hung':
        say(LT_TEXT.pendulumHung, 4);
        a.play('gt_tick', { vol: 0.9, pan: pan(q.x) });
        break;
      case 'lt_clock':
        say(LT_TEXT.clock(place(q.a ?? 0), q.b ?? 1), 6);
        a.play('gt_tick', { vol: 0.8, pan: pan(q.x) });
        setTimeout(() => a.play('gt_chime', { vol: 0.7, pan: pan(q.x) }), 300);
        fx('ring', 'gold', 90);
        break;
      case 'lt_clocks':
        this.hud.banner(LT_TEXT.clocks[0].toUpperCase(), LT_TEXT.clocks[1], 'gold', 5);
        a.play('gt_chime', { vol: 0.9 });
        break;
      case 'lt_battery':
        say(LT_TEXT.battery, 7);
        a.play('glint', { vol: 0.7, pan: pan(q.x) });
        break;
      case 'lt_battery_in':
        say(LT_TEXT.batteryIn, 4);
        a.play('clank', { vol: 0.7, pan: pan(q.x) });
        a.play('gt_tick', { vol: 0.8, pan: pan(q.x) });
        break;
      case 'lt_lever':
        say(LT_TEXT.lever(q.b ?? 1), 4);
        a.play('clank', { vol: 0.8, pan: pan(q.x) });
        break;
      case 'lt_lever_wrong':
        say(LT_TEXT.leverWrong, 4);
        a.play('gt_chain', { vol: 0.7, pan: pan(q.x) });
        break;
      case 'lt_prepared':
        card(LT_TEXT.prepared, 'ROUTE 13', 9);
        a.play('gt_bell', { vol: 0.8 });
        break;
      case 'lt_green':
        a.play('clank', { vol: 0.45, pitch: 1.4, pan: pan(q.x) });
        break;
      case 'lt_signal_ahead':
        // everyone aboard hears the call: anyone at the lamp box can switch it to green (D-84)
        if (this.aboard(g)) say(LT_TEXT.signalAhead, 3);
        a.play('gt_bell', { vol: 0.6 });
        break;
      case 'lt_signal_missed':
        if (this.aboard(g)) say(LT_TEXT.signalMissed(place(q.b ?? 0)), 5);
        a.play('sour', { vol: 0.4 });
        break;
      case 'lt_signal':
        this.hud.banner('THE POINTS SWING OVER', 'The train is bound for the End of the Line', 'gold', 4);
        a.play('clank', { vol: 0.8 });
        a.play('gt_whistle', { vol: 1 });
        break;
      case 'lt_punch':
        say(LT_TEXT.punch, 7);
        a.play('gt_punch', { vol: 0.8, pan: pan(q.x) });
        break;
      case 'lt_passenger_wait':
        say(LT_TEXT.passengerWait, 3);
        break;
      case 'lt_passenger':
        say(LT_TEXT.passenger(PASSENGERS[q.a ?? 0], q.b ?? 1), 5);
        a.play('gt_punch', { vol: 0.8, pan: pan(q.x) });
        a.play('bellnote', { vol: 0.5, pitch: 1 + (q.b ?? 1) * 0.12 });
        fx('ring', 'frost', 80);
        break;
      case 'lt_passengers':
        card(LT_TEXT.tasksIntro(q.a ?? 3, [(q.b ?? 0) % 3, Math.floor((q.b ?? 0) / 3) % 3, Math.floor((q.b ?? 0) / 9) % 3]), 'FOUR LOST PASSENGERS', 16);
        break;
      case 'lt_letter':
        say(LT_TEXT.letter, 6);
        a.play('papercrinkle', { vol: 0.6 });
        break;
      case 'lt_posted':
        say(LT_TEXT.posted, 4);
        a.play('bellnote', { vol: 0.5, pitch: 0.9 });
        break;
      case 'lt_chute_wait':
        say(['The chute is empty.', 'It only runs while a train stands at the Works.'], 3);
        break;
      case 'lt_chute':
        a.play('gt_shovel', { vol: 0.8, pan: pan(q.x) });
        break;
      case 'lt_coal':
        say(LT_TEXT.coal(q.a ?? 1), 4);
        a.play('gt_shovel', { vol: 0.8, pan: pan(q.x) });
        fx('spark', 'fire', 6);
        break;
      case 'lt_stoke':
        say(LT_TEXT.stoke(q.a ?? 1), 3);
        a.play('gt_furnace', { vol: 0.8 });
        fx('spark', 'fire', 10);
        break;
      case 'lt_stoke_bad':
        say(LT_TEXT.stokeBad, 3);
        a.play('steam_hiss', { vol: 0.6 });
        break;
      case 'lt_hour_wait':
        say(LT_TEXT.hourWait, 3);
        break;
      case 'lt_hour':
        say(LT_TEXT.hour(q.a ?? 12), 2.5);
        a.play('gt_chime', { vol: 0.6, pitch: 0.8 + (q.a ?? 12) * 0.02 });
        break;
      case 'lt_bell_wait':
        say(LT_TEXT.bellWait, 3);
        break;
      case 'lt_bell':
        a.play('gt_toll', { vol: 0.8, pitch: [0.8, 1, 1.2][q.a ?? 0] });
        break;
      case 'lt_bell_wrong':
        say(LT_TEXT.bellWrong, 4);
        a.play('sour', { vol: 0.5 });
        break;
      case 'lt_task':
        say(LT_TEXT.task(PASSENGERS[q.a ?? 0], q.b ?? 1), 5);
        for (const [k, p] of [[0, 1], [1, 1.26], [2, 1.5]] as const) setTimeout(() => a.play('bellnote', { vol: 0.5, pitch: p }), k * 160);
        fx('ring', 'gold', 140);
        break;
      case 'lt_deliveries':
        card(['Every passenger has done what they came to do.', 'Punch the last ticket at the End of the Line, while a train stands there.'], 'THE LAST TRAIN HOME', 9);
        break;
      case 'lt_ticket_wait':
        say(LT_TEXT.lastTicketWait, 3);
        break;
      case 'lt_last_ticket':
        card(LT_TEXT.lastTicket, 'THE LAST TICKET', 10);
        a.play('gt_punch', { vol: 1 });
        a.play('fanfare', { vol: 0.5 });
        break;
      case 'lt_finale':
        this.hud.banner(LT_TEXT.finale[0].toUpperCase(), LT_TEXT.finale[1], 'danger', 5);
        a.play('rumble', { vol: 0.9 });
        break;
      case 'lt_conductor':
        a.play('demon', { vol: 0.5 });
        a.play('gt_punch', { vol: 1 });
        break;
      case 'lt_homeward':
        this.hud.banner(LT_TEXT.homeward[0].toUpperCase(), LT_TEXT.homeward[1], 'gold', 6);
        a.play('gt_whistle', { vol: 1 });
        break;
      case 'lt_complete': {
        const s = this.save;
        for (const id of QUEST_UNLOCKS.last_train ?? []) if (!s.data.unlocks.includes(id)) s.data.unlocks.push(id);
        const rec = (s.data.quests[q.chain] ??= { completions: 0, bestStage: 0 });
        rec.completions++;
        rec.bestStage = Math.max(rec.bestStage, LT.Complete);
        s.save();
        this.hud.banner(LT_TEXT.complete[0], LT_TEXT.complete[1], 'gold', 6);
        a.play('fanfare', { vol: 0.8 });
        break;
      }
    }
  }


  private onSummersEnd(g: Game, q: QuestCue): void {
    const a = this.audio;
    const pan = (x?: number) => (x === undefined ? 0 : Math.max(-1, Math.min(1, (x - this.renderer.camX) / (this.renderer.viewWidth * 0.6))));
    const fx = (type: string, style: string, aa = 1) => {
      if (q.x !== undefined && q.y !== undefined) this.renderer.fx.handle([{ type: type as never, x: q.x, y: q.y, a: aa, b: 0, c: 0, style }]);
    };
    const say = (line: string[], dur = 5) => {
      a.duckMusic(Math.min(3, dur * 0.5));
      this.hud.whisper(line[0], line[1] || undefined, dur);
    };
    const flash = (r: number, gg: number, b: number, k = 0.3) => {
      this.renderer.fx.screenFlash = Math.max(this.renderer.fx.screenFlash, k);
      this.renderer.fx.screenFlashCol = [r, gg, b];
    };
    const bell = (pitch: number, vol = 0.5) => a.play('bellnote', { vol, pitch, pan: pan(q.x) });
    /**
     * the call sign on the ship's horn (and the lighthouse's lens), from far out on the water. D-79: it could
     * not be heard over a fight, so everything else sinks very low while it sounds, and the horn is a
     * steamship's (it was the barker's car horn)
     */
    const call = () => {
      const bits = q.a ?? 0, len = q.b ?? 4;
      this.renderer.playCallSign(bits, len);
      a.spotlight(callLength(bits, len) + 0.6);
      let t = CALL.lead;
      for (let k = 0; k < len; k++) {
        const long = (bits >> k) & 1;
        setTimeout(() => a.play(long ? 'shiphorn_l' : 'shiphorn_s', { vol: 1.3, spot: true }), t * 1000);
        t += (long ? CALL.long : CALL.short) + CALL.gap;
      }
    };
    switch (q.event) {
      case 'se_conch':
        say(ADA.conch, 7);
        a.play('ripple', { vol: 0.8, pan: pan(q.x) });
        a.play('surge', { vol: 0.35 });
        fx('spark', 'splash', 6);
        break;
      case 'se_marina':
        a.play('fortune', { vol: 0.8, pan: pan(q.x) });
        this.fortune.show(`${ADA.marina[0]} ${ADA.marina[1]}`, 10, 'MADAME MARINA');
        this.chat.add({ kind: 'fortune', who: 'Madame Marina', text: ADA.marina[1] });
        a.duckMusic(3);
        break;
      case 'se_hint': {
        const [head, text] = ADA.hint[q.a ?? 0] ?? ADA.hint[0];
        a.play('fortune', { vol: 0.8, pan: pan(q.x) });
        this.fortune.show(`${head} ${text}`, 11, 'MADAME MARINA');
        this.chat.add({ kind: 'fortune', who: 'Madame Marina', text });
        a.duckMusic(3);
        break;
      }
      case 'se_photo':
        say(ADA.photo, 8);
        a.play('glint', { vol: 0.6, pan: pan(q.x) });
        break;
      case 'se_shelf':
        say(ADA.shelfTrue(q.b ?? 1), 3);
        bell(1 + (q.b ?? 1) * 0.12, 0.55);
        fx('ring', 'gravity', 70);
        break;
      case 'se_shelf_false': {
        // D-79: a wrong souvenir puts every one taken back on the shelves (b: those), with a glint on each
        const back = q.b ?? 0;
        let n = 0;
        for (let m = back; m; m &= m - 1) n++;
        say(ADA.shelfFalse(n), n ? 4.5 : 4);
        a.play('sour', { vol: 0.5, pan: pan(q.x) });
        if (n) a.play('clatter', { vol: 0.55, pan: pan(q.x) });
        SUMMERS_END.shelf.forEach(([sx, sy], i) => {
          if (back & (1 << i)) this.renderer.fx.handle([{ type: 'spark', x: sx, y: sy - 27, a: 8, b: 0, c: 0, style: 'gold' }]);
        });
        break;
      }
      case 'se_games':
        say(ADA.gamesOpen, 6);
        a.play('slot_spin', { vol: 0.6 });
        break;
      case 'se_gallery':
        say(ADA.galleryStart, 3);
        a.play('whistle', { vol: 0.8, pan: pan(q.x) });
        break;
      case 'se_duck':
        a.play('ding', { vol: 0.6, pan: pan(q.x), pitch: 0.9 + (q.a ?? 0) * 0.05 });
        break;
      case 'se_gallery_lost':
        say(ADA.galleryLost, 3);
        a.play('sour', { vol: 0.5, pan: pan(q.x) });
        break;
      case 'se_won':
        say(ADA.gameWon(GAME_NAMES[q.a ?? 0], q.b ?? 1), 4);
        a.play('slot_win', { vol: 0.7, pan: pan(q.x) });
        fx('ring', 'gold', 110);
        this.input.rumble(0.3, 160);
        break;
      case 'se_miss':
        say(q.a === 1 ? ADA.craneMiss : q.a === 2 ? ADA.wheelMiss : ADA.brakeMiss, 3);
        a.play('clunk', { vol: 0.6, pan: pan(q.x) });
        break;
      case 'se_wreck':
        say(ADA.wreck, 7);
        a.play('toll', { vol: 0.5, pitch: 0.8 });
        break;
      case 'se_wreck_high':
        say(ADA.wreckHigh, 3);
        break;
      case 'se_porthole':
        a.play('clank', { vol: 0.5, pan: pan(q.x) });
        a.play('glint', { vol: 0.3, pan: pan(q.x), pitch: 0.8 + (q.b ?? 0) * 0.1 });
        break;
      case 'se_wreck_done':
        say(ADA.wreckDone, 7);
        for (let k = 0; k < 2; k++) setTimeout(() => a.play('toll', { vol: 0.55, pitch: 0.7 }), 300 + k * 800);
        flash(0.5, 0.9, 1, 0.25);
        break;
      case 'se_rod':
        say(ADA.rod, 5);
        break;
      case 'se_cast':
        say(ADA.cast, 2.5);
        a.play('whoosh', { vol: 0.5, pan: pan(q.x) });
        setTimeout(() => a.play('splash', { vol: 0.4, pan: pan(q.x) }), 300);
        break;
      case 'se_bite':
        this.hud.whisper(ADA.bite[0], undefined, 1.2);
        a.play('splash', { vol: 0.9, pan: pan(q.x) });
        this.input.rumble(0.5, 200);
        break;
      case 'se_missed':
        say(ADA.missed, 2.5);
        a.play('splash', { vol: 0.5, pan: pan(q.x) });
        break;
      case 'se_key':
        say(ADA.key, 6);
        a.play('ding', { vol: 0.8, pan: pan(q.x) });
        fx('ring', 'gold', 90);
        break;
      case 'se_call':
        say(ADA.callSign, 5);
        a.play('clunk', { vol: 0.7, pan: pan(q.x), spot: true });
        call();
        break;
      case 'se_chain': {
        // the pier's own foghorn answering her (D-79): higher and nearer than her horn, and heard over a fight too
        const long = !!q.a;
        a.play(long ? 'shiphorn_l' : 'shiphorn_s', { vol: 1.1, pan: pan(q.x), pitch: 1.5, spot: true });
        a.spotlight((long ? CALL.long : CALL.short) / 1.5 + 0.35, 0.3);
        break;
      }
      case 'se_wrong_call':
        say(ADA.wrongCall, 3);
        a.play('sour', { vol: 0.5, pan: pan(q.x) });
        setTimeout(call, 1400);
        break;
      case 'se_moored':
        say(ADA.moored, 7);
        // she sounds her horn as she sails in to the pier (D-79), then the bells
        a.play('shiphorn_l', { vol: 1.2, pitch: 0.94, spot: true });
        a.spotlight(1.9, 0.25);
        for (let k = 0; k < 3; k++) setTimeout(() => a.play('toll', { vol: 0.6 }), 1700 + k * 700);
        a.play('ghost_ticket', { vol: 0.7 });
        flash(0.5, 1, 0.95, 0.3);
        break;
      case 'se_fire':
        say(ADA.fire, 5);
        a.play('lamp_lit', { vol: 0.6, pan: pan(q.x) });
        break;
      case 'se_lamp':
        say(ADA.lamp(q.b ?? 1), 3);
        a.play('lamp_lit', { vol: 0.8, pan: pan(q.x) });
        bell(0.8 + (q.b ?? 1) * 0.15, 0.6);
        fx('ring', 'frost', 140);
        this.input.rumble(0.3, 160);
        break;
      case 'se_guttered':
        say(ADA.guttered, 4);
        a.play('poof', { vol: 0.6 });
        break;
      case 'se_low_water':
        say(ADA.lowWater, 7);
        a.play('surge', { vol: 1 });
        a.play('rumble', { vol: 0.6 });
        this.renderer.fx.shake = Math.max(this.renderer.fx.shake, 0.5);
        break;
      case 'se_bell_seen':
        say(ADA.bell, 6);
        a.play('toll', { vol: 0.4, pitch: 0.6 });
        break;
      case 'se_bell_up':
        say(ADA.bellUp, 6);
        a.play('toll', { vol: 0.8, pitch: 0.7 });
        flash(1, 0.9, 0.6, 0.2);
        break;
      case 'se_ledger':
        a.play('fortune', { vol: 0.7, pan: pan(q.x) });
        say(ADA.ledger, 10);
        this.chat.add({ kind: 'fortune', who: 'The Ledger', text: ADA.ledger[1] });
        setTimeout(() => say(ADA.ledger2, 7), 9000);
        break;
      case 'se_strike':
        say(ADA.strike(q.a ?? 1), 3);
        a.play('toll', { vol: 1, pitch: 0.65 });
        flash(0.9, 0.95, 1, 0.35);
        this.renderer.fx.shake = Math.max(this.renderer.fx.shake, 0.5);
        fx('ring', 'bell', 260);
        break;
      case 'se_bound':
        this.hud.banner(ADA.bound[0], ADA.bound[1], 'danger', 3.5);
        a.play('roar', { vol: 1, pitch: 0.5 });
        a.play('surge', { vol: 1 });
        flash(0.6, 1, 0.9, 0.5);
        break;
      case 'se_finale':
        this.hud.banner(ADA.finale[0], ADA.finale[1], 'danger', 3.5);
        a.play('toll', { vol: 1, pitch: 0.55 });
        break;
      case 'se_rises':
        a.play('rumble', { vol: 0.9 });
        a.play('demon', { vol: 0.5 });
        break;
      case 'se_complete': {
        // permanent: Ada's Conch joins the draft pool for good
        const s = this.save;
        for (const id of QUEST_UNLOCKS.summers_end) if (!s.data.unlocks.includes(id)) s.data.unlocks.push(id);
        const rec = (s.data.quests[q.chain] ??= { completions: 0, bestStage: 0 });
        rec.completions++;
        rec.bestStage = Math.max(rec.bestStage, 13);
        s.save();
        this.hud.banner(ADA.complete[0], ADA.complete[1], 'gold', 5);
        a.play('fanfare', { vol: 0.8 });
        break;
      }
    }
    void KEEPSAKES;
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
    // the furthest the night's hidden quest got (persisted progress memory, not run state)
    const qrec = (s.data.quests[MAPS[st.map ?? 'carnival_core'].quest.id] ??= { completions: 0, bestStage: 0 });
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
    const beforeUnlocks = UNLOCKS.filter((u) => s.unlockRequirementMet(u.id)).map((u) => u.id);
    const beforeDiffs = DIFFICULTIES.filter((d) => s.difficultyAvailable(d.id)).map((d) => d.id);
    const beforeCurse = s.curseAvailable();
    const earned = s.grantAchievements(st.achievementsHit);
    const notes: string[] = [];
    for (const c of CHARACTERS) if (!beforeChars.includes(c.id) && s.characterRequirementMet(c.id)) notes.push(`${c.name} can now be unlocked in the Lost & Found!`);
    for (const u of UNLOCKS) if (u.req && !beforeUnlocks.includes(u.id) && s.unlockRequirementMet(u.id)) notes.push(`${u.name} can now be bought in the Lost & Found!`);
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
      if (st.trueEnding) notes.unshift(st.map === 'fun_house' ? "Mira's Hand Mirror now appears in the draft pool (and evolves the Funhouse Mirror)." : st.map === 'boardwalk' ? "Ada's Conch and Running Shoes now appear in the draft pool." : 'The Steam Calliope now plays in the draft pool.');
      if (this.hubJustUnlocked) {
        notes.unshift('THE MIDWAY IS YOURS: from now on the carnival opens as your hub. Walk the grounds, visit the cast, and enter the Big Top for another night.');
        this.hubJustUnlocked = false;
      }
      const actions = net
        ? net.role === 'host'
          ? { again: () => this.coopToLobby(), againLabel: this.save.hubUnlocked() ? 'Back to the Midway' : 'Back to the Lobby', menu: () => this.toMenu(), lostfound: () => this.coopLostFound() }
          : { again: () => this.guestFollow(g.players[0]?.name ?? 'the host'), againLabel: 'Wait for Host', menu: () => this.toMenu(), lostfound: () => this.guestLostFound() }
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

  toMenu(next: State = 'title'): void {
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
  // =================================================================== live updates (engineering optimization pass)
  /** What the game is doing, for the update system and the Windows app: would a restart now interrupt anything? */
  session(): { state: SessionState; safe: boolean } {
    const s = this.state;
    if (s === 'loading') return { state: 'boot', safe: true };
    if (s === 'playing' || this.nightPaused) return { state: 'match', safe: false };
    // a finished night: the offer may show, and taking it leaves any party behind (the player's choice)
    if (s === 'results') return { state: 'results', safe: true };
    if (this.net) return { state: s === 'hub' || s === 'midway' ? 'hub' : 'lobby', safe: false };
    if (s === 'mp_join' && this.mpBusy) return { state: 'connecting', safe: false };
    if (s === 'hub' || s === 'midway') return { state: 'hub', safe: true };
    return { state: 'menu', safe: true };
  }

  /** Tell the shell when the session changes; reaching a safe moment checks for (and offers) an update. */
  private trackSession(): void {
    const s = this.session();
    const key = `${s.state}:${s.safe}`;
    if (key === this.sessionKey) return;
    const wasSafe = this.sessionKey.endsWith(':true');
    this.sessionKey = key;
    desktop?.setSession(s.state, s.safe);
    if (!s.safe) this.updatePrompt?.hide();
    else if (!wasSafe) {
      void this.updates.check().then(() => this.offerUpdate());
      this.offerUpdate();
    }
  }

  private setupUpdates(): void {
    const p = new UpdatePrompt(
      (o) => void this.restartToUpdate(o),
      (o) => {
        if (o.kind === 'shell') this.shellDismissedAt = Date.now();
        else this.updateDismissed = { id: this.updates.latest?.id ?? '', at: Date.now() };
      },
    );
    this.updatePrompt = p;
    this.ui.append(p.root);
    this.updates.onChange = () => {
      this.offerUpdate();
      this.showDownload();
    };
    this.updates.start();
    desktop?.onShellUpdate((u) => {
      this.shellUpdate = u;
      this.offerUpdate();
    });
    void desktop?.info().then((i) => {
      if (i?.shellUpdate?.ready) {
        this.shellUpdate = i.shellUpdate;
        this.offerUpdate();
      }
    });
    // a lazily loaded file that's gone (an old build's chunk after a deploy) means it's time to update
    window.addEventListener('vite:preloadError', (e) => {
      e.preventDefault();
      void this.updates.check(true).then(() => this.offerUpdate());
    });
    const r = takeUpdateResult();
    if (r === 'updated') p.note(`Updated to version ${BUILD.version} (${BUILD.commit}).`);
    else if (r === 'stale') p.note('The update hasn’t reached you yet. It will be offered again shortly.');
  }

  /** Show the update card if there's something to offer and nothing would be interrupted. */
  private offerUpdate(): void {
    const p = this.updatePrompt;
    if (!p || p.visible || !this.session().safe) return;
    if (this.shellUpdate?.ready && Date.now() - this.shellDismissedAt > UPDATE_LATER_MS) {
      p.show({ kind: 'shell', version: this.shellUpdate.version });
      return;
    }
    const latest = this.updates.latest;
    if (!this.updates.available || !latest) return;
    if (latest.id === this.updateDismissed.id && Date.now() - this.updateDismissed.at < UPDATE_LATER_MS) return;
    p.show({ kind: 'game', version: latest.version });
  }

  /**
   * Restart & Update: only at a safe moment; the save is written and any party left politely first.
   * A game update reloads the latest hosted build (the Windows app bypasses its cache; a browser adds a
   * cache-busting ?v=), and the new page confirms it got the build it expected (takeUpdateResult).
   */
  private async restartToUpdate(o: UpdateOffer): Promise<void> {
    const p = this.updatePrompt!;
    if (!this.session().safe) {
      p.setStatus('Finish the night first. The update will wait.');
      return;
    }
    if (o.kind === 'shell') {
      if (!desktop) return;
      p.setStatus('Installing…', true);
      this.save.save();
      if (this.net) this.leaveNet(true);
      const r = await desktop.installShellUpdate();
      if (!r.ok) p.setStatus(r.reason === 'busy' ? 'Finish the night first.' : 'The update couldn’t be installed. Try again later.');
      return;
    }
    p.setStatus('Checking the carnival…', true);
    const m = await this.updates.check(true);
    if (!m) {
      p.setStatus('Can’t reach the carnival right now. Check your connection and try again.');
      return;
    }
    if (!this.updates.available) {
      p.hide();
      return;
    }
    this.save.save();
    if (this.net) this.leaveNet(true);
    noteUpdateExpected(m.id);
    p.setStatus('Restarting…', true);
    if (desktop) {
      if (!(await desktop.reloadLatest())) p.setStatus('The restart didn’t work. Close and reopen the game to update.');
      return;
    }
    const u = new URL(location.href);
    u.searchParams.set('v', m.id);
    location.replace(u.toString());
  }

  /**
   * The Windows app's download: browsers only, and only once a release is published. It shows on the
   * press screen and the title menu, and on the Midway, which takes the menu's place once a save has
   * it (D-60): most returning players never see the title menu.
   */
  private showDownload(): void {
    const w = this.updates.latest?.desktop?.windows;
    const url = w && typeof w.url === 'string' && w.url.startsWith('https://') ? w.url : null;
    const dl = !desktop && url ? { version: String(w!.version ?? ''), url } : undefined;
    if (!this.ctx || this.ctx.desktopDownload?.url === dl?.url) return;
    this.ctx.desktopDownload = dl;
    this.hubHud?.setDownload(dl);
    // the screen already showing gets it at once (no re-render: the press screen starts on any click)
    if ((this.state === 'press' || this.state === 'title') && this.screenEl && !this.screenEl.querySelector('.download')) {
      const badge = S.downloadBadge(this.ctx);
      if (badge) this.screenEl.append(badge);
    }
  }

  /** Open or close the developer performance overlay (F2), creating it on first use. */
  togglePerfHud(): void {
    if (!this.perfHud) {
      this.perfHud = new PerfHud();
      this.ui.append(this.perfHud.root);
    }
    this.perfHud.toggle();
  }

  /** A chat line from the party, in its speaker's colour (D-65). */
  private chatLine(from: number, name: string, text: string): void {
    this.chat.add({ kind: 'player', who: name, color: PLAYER_CSS[from % PLAYER_CSS.length], text });
    if (!this.chat.isOpen) this.audio.play('ui_hover', { vol: 0.5, pitch: 1.4 });
  }

  /**
   * The chat box (D-65): in a night, on the Midway and in a co-op lobby (a solo night shows it once a quest
   * has written in it, and T opens it read-only to look back, D-72). It sits above whatever the bottom-left
   * corner holds.
   */
  private updateChat(dt: number): void {
    const c = this.chat;
    c.canSend = !!this.net;
    c.toggleCodes = this.input.bindings.chat ?? [];
    const g = this.game;
    const run = this.state === 'playing' && !this.screenEl && !!g && !g.hub;
    const hub = this.state === 'hub' && !this.screenEl;
    const lobby = this.state === 'lobby' && !!this.net;
    const show = (run && (c.canSend || c.lineCount > 0)) || ((hub || lobby) && c.canSend);
    c.place(show, run ? this.hud.chatBottom() : 18);
    c.update(dt);
  }

  private onNav(e: NavEvent): void {
    if (e === 'chat') {
      this.chat.open();
      return;
    }
    if (e === 'meter') {
      // the damage meter, shown or hidden (D-85); in a night only
      if (this.state !== 'playing' || !this.game || this.game.hub) return;
      const st = this.save.data.settings;
      st.damageMeter = !st.damageMeter;
      this.save.save();
      this.hud.meter.on = st.damageMeter;
      this.audio.play('ui_click', { vol: 0.4 });
      if (!st.damageMeter) this.hud.toastMsg(`Damage meter hidden \u2014 ${this.input.keyName(this.input.bindings.meter?.[0] ?? 'KeyM')} brings it back`);
      return;
    }
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
      if ((e === 'interact' || e === 'confirm') && this.game.phase === 'play') this.interactPress();
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

  /**
   * A night stands paused: its pause menu, or the Settings opened from it. The night stays behind both; the
   * attract demo must not run there, since its night would take over the map's shared walls, bounds and
   * camera places from one that is only paused (D-82).
   */
  private get nightPaused(): boolean {
    return this.state === 'paused' || (this.state === 'settings' && !!this.game && !this.game.hub);
  }

  // =================================================================== main loop
  private frame(t: number): void {
    requestAnimationFrame((tt) => this.frame(tt));
    // the frame's CPU sections (net, sim, render, HUD) for the developer overlay and the benchmarks
    perf.beginFrame(t);
    if (!this.bootTimes.firstFrame) {
      // the first frame after boot draws the attract demo for the first time (boot diagnostics)
      const p0 = this.renderer.renderer.info.programs?.length ?? 0, f0 = performance.now();
      this.frameBody(t);
      this.bootTimes.firstFrame = performance.now() - f0;
      this.bootTimes.firstFramePrograms = (this.renderer.renderer.info.programs?.length ?? 0) - p0;
    } else this.frameBody(t);
    perf.endFrame();
  }

  private frameBody(t: number): void {
    this.lastFrameAt = performance.now();
    this.trackSession();
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.25) dt = 0.25;
    this.fps += (1 / Math.max(0.001, dt) - this.fps) * 0.05;
    const g = this.game;
    const net = this.net;
    const n0 = perf.now();
    if (net?.role === 'host') net.host.update(t, dt * 1000);
    else if (net?.role === 'guest') net.guest.update(t);
    perf.mark(SEC.net, n0);
    this.updateChat(dt);
    const playing = this.state === 'playing' && g;
    // over the night the cursor is the shooting-gallery sight, since the mouse aims; elsewhere the arrow (D-93)
    const aiming = !!playing && !g.hub && !this.screenEl && !this.draft.visible && !this.prize.active;
    if (aiming !== this.aimCursor) {
      this.aimCursor = aiming;
      document.body.classList.toggle('aiming', aiming);
    }
    // player screen position for mouse aim
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const target = g && (playing || this.nightPaused || g.hub) ? g.player : this.demo!.player;
    const sp = this.renderer.worldToScreen(target.x, target.y, cssW, cssH, 30);
    this.input.poll(sp.x, sp.y);
    if (net?.role === 'guest' && g && (this.state === 'playing' || this.nightPaused || this.state === 'results' || g.hub)) {
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
      if (DEVTOOLS && this.autopilot) {
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
      // co-op host: the night also holds for a pause, a prize wheel or a dropped partner on either side;
      // solo, it waits while the chat log is open for reading back (D-72)
      const held = (!!hs && (hs.paused || !hs.prizeReady)) || (!net && this.chat.isOpen);
      if (!this.overlayPause && g!.phase !== 'draft' && !held) {
        const s0 = perf.now();
        this.acc += dt * this.simSpeed;
        let n = 0;
        const maxTicks = Math.max(5, Math.ceil(this.simSpeed * 5));
        while (this.acc >= TICK && n < maxTicks) {
          hs?.beforeTick(g!);
          g!.tick();
          perf.tick();
          this.acc -= TICK;
          n++;
        }
        if (n >= maxTicks) this.acc = 0;
        perf.mark(SEC.sim, s0);
      }
      hs?.captureFx(g!.fx.events); // the guest's copy of this frame's sparks, before the renderer drains them
      if (g!.phase === 'draft' && this.draft.visible && !g!.draftPending(this.localIndex)) this.draft.hide();
      if (this.dawnT >= 0) {
        this.dawnT += dt;
        this.renderer.dawn = Math.min(1, this.dawnT / 4);
      }
      const alpha = this.overlayPause || g!.phase === 'draft' || held ? 1 : Math.min(1, this.acc / TICK);
      const r0 = perf.now();
      this.renderer.render(g!, alpha, dt);
      const h0 = perf.mark(SEC.render, r0);
      this.stageTug(g!);
      this.updateCoopHud();
      this.hud.padKeys = this.input.usingGamepad;
      this.hud.update(g!, this.fps, dt, this.hudScreen(cssW, cssH));
      this.boardwalkFrame(g!);
      this.ghostTrainFrame(g!, dt);
      perf.mark(SEC.hud, h0);
    } else if ((this.nightPaused || this.state === 'results') && g) {
      hs?.captureFx(g.fx.events);
      useMap(g.mapId); // a night that isn't ticking doesn't take its map back by itself
      const r0 = perf.now();
      this.renderer.render(g, 1, dt);
      perf.mark(SEC.render, r0);
    } else if (this.demo) {
      // attract mode behind the menus
      const s0 = perf.now();
      this.demoAutopilot(this.demo);
      this.acc += dt;
      let n = 0;
      while (this.acc >= TICK && n < 4) {
        if (this.demo.phase === 'draft') this.demo.chooseDraft(0);
        this.demo.tick();
        perf.tick();
        this.acc -= TICK;
        n++;
      }
      if (this.demo.time > 400 || this.demo.phase === 'ended') this.makeDemo();
      const r0 = perf.mark(SEC.sim, s0);
      this.renderer.render(this.demo, Math.min(1, this.acc / TICK), dt, { menu: true });
      perf.mark(SEC.render, r0);
    }
    this.perfHud?.update(this.game ?? this.demo, net ? (net.role === 'host' ? net.host.diag : net.guest.diag) : null);
  }

  // =================================================================== online co-op (D-52)
  private profileBase(name: string) {
    const perk = (id: string) => this.save.perkLevel(id);
    return { name, meta: this.save.metaStats(), rerolls: perk('reroll'), banishes: perk('banish'), canSkip: this.save.isUnlocked('f_skip'), aimMode: this.save.data.settings.aimMode ?? 'auto', pet: this.save.petChoice() };
  }

  private guestProfile(name: string): GuestProfile {
    // `unlocks`: the host keeps the draft-pool ones (D-74: a guest drafts from their own save's unlocks)
    return { ...this.profileBase(name), chars: CHARACTERS.filter((c) => this.save.characterAvailable(c.id)).map((c) => c.id), pref: this.hubCharacter(), unlocks: [...this.save.unlockedSet()] };
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

  /** Walk onto the Midway alone (a co-op host rebuilds the shared one instead); a rebuilt one keeps you where you stood. */
  private startHub(): void {
    if (this.net?.role === 'host') return this.restartHub();
    const was = this.game?.hub ? this.game.players[0] : null;
    this.endRunView();
    const ch = this.hubCharacter();
    const pet = this.save.petChoice();
    const g = new Game({ character: ch, difficulty: 'midway', curse: false, seed: (Math.random() * 2 ** 31) | 0, players: [{ character: ch, name: L.loadName() || 'You', pet }], pet, hub: { npcs: this.hubCast(), at: was ? [{ x: was.x, y: was.y }] : undefined } });
    this.beginHub(g, 0);
  }

  /**
   * Choose a companion on the Midway (D-84): it follows you at once (the Midway rebuilt where everyone stands) and into
   * the next night. In a party the host rebuilds it; a guest's new profile reaches the host, whose lobby change does.
   */
  private setPet(id: string | null): void {
    this.save.data.pet = id ?? undefined;
    this.save.save();
    const n = this.net;
    if (n?.role === 'host') {
      n.host.setSelf(this.profileBase(n.host.self.name));
      this.restartHub(true);
    } else if (n?.role === 'guest') n.guest.sendProfile(this.guestProfile(n.guest.profile.name));
    else if (this.game?.hub) return this.startHub();
    this.go('hub');
  }

  /**
   * Swap Character on the Midway (D-84): you walk on as them, and your next night starts with them. Solo, the
   * Midway is rebuilt where you stand; in a party the pick goes through the lobby, whose change rebuilds the
   * shared Midway for everyone (refreshLobby).
   */
  private swapCharacter(id: string): void {
    const n = this.net;
    this.save.data.last.character = id;
    this.save.save();
    if (n?.role === 'host') n.host.setCharacter(id);
    else if (n?.role === 'guest') {
      n.guest.pick(id);
      n.guest.sendProfile(this.guestProfile(n.guest.profile.name));
    } else return this.startHub();
    this.go('hub');
  }

  /**
   * Co-op host: (re)build the Midway for everyone seated, keeping each where they stood, and send it out.
   * `keepShop`: the party changed while the host shops at the Lost & Found, so the shop stays open (D-75).
   */
  private restartHub(keepShop = false): void {
    if (this.net?.role !== 'host') return this.startHub();
    const hs = this.net.host;
    const old = this.game?.hub ? this.game : null;
    if (!hs.hostCharacter) hs.hostCharacter = this.hubCharacter();
    this.hubParty = this.hubPartyKey();
    const names = [hs.self.name, ...hs.guests.map((s) => s.profile.name)];
    const at = names.map((nm, i) => {
      const p = old?.players.find((q) => q.name === nm);
      return p ? { x: p.x, y: p.y } : { x: HUB_SPAWN.x + (i - 2) * 60, y: HUB_SPAWN.y + 30 };
    });
    const cfg = hs.startHub({ seed: (Math.random() * 2 ** 31) | 0, unlocked: [...this.save.unlockedSet()], questMemory: {}, npcs: this.hubCast(), at });
    this.endRunView();
    const g = new Game(runConfigFromStart(cfg));
    hs.attachGame(g);
    this.beginHub(g, 0, keepShop);
  }

  private hubPartyKey(): string {
    if (this.net?.role !== 'host') return '';
    const hs = this.net.host;
    // everyone's character and companion too: a Swap Character on the Midway, or a new pet, rebuilds it for the party (D-84)
    return `${hs.hostCharacter}:${hs.self.pet ?? ''}|` + hs.guests.map((s) => `${s.index}:${s.profile.name}:${s.connected}:${s.character ?? ''}:${s.profile.pet ?? ''}`).join('|');
  }

  /** Guest: the host is on the Midway; build the mirror the session will feed. */
  private startGuestHub(cfg: StartCfg): Game {
    void this.audio.unlock();
    this.mpStatus = '';
    this.mpBusy = false;
    this.endRunView();
    const g = new Game(runConfigFromStart(cfg));
    // a guest shopping at the Lost & Found when the host brings everyone here keeps shopping (D-75)
    this.beginHub(g, this.net?.role === 'guest' ? this.net.guest.slot : 1, true);
    setTimeout(() => this.sendView(), 0);
    return g;
  }

  /** Step into a built hub world (solo, the host's, or a guest's mirror). */
  /** `keepShop`: someone at the Lost & Found stays there, the grounds waiting behind it (D-75) — only when
   *  the network rebuilds the Midway, never when the player is the one leaving the shop for it. */
  private beginHub(g: Game, local: number, keepShop = false): void {
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
    this.hubHud.setNotice(this.save.data.notice);
    if (keepShop && this.state === 'lostfound') {
      this.hubHud.root.classList.add('under');
      // Back from the shop now leads here, wherever it was going to lead before
      if (this.lfReturn) this.lfReturn = 'party';
      return;
    }
    // a guest still reading the night's results keeps reading: the grounds wait behind them (D-84)
    if (keepShop && this.state === 'results') {
      this.hubHud.root.classList.add('under');
      this.relabelResults('Back to the Midway');
      return;
    }
    this.go('hub');
  }

  /** The results' first button, once the host has moved the party on (D-84): it now leads after them. */
  private relabelResults(label: string): void {
    const b = this.screenEl?.querySelector<HTMLButtonElement>('button[data-default]');
    if (b) b.textContent = label;
  }

  /** Guest, from the results (D-84): follow the party once the host has moved it on; until then, wait for them. */
  private guestFollow(host: string): void {
    const n = this.net;
    if (n?.role !== 'guest') return this.toMenu();
    if (this.game?.hub) return this.go('hub');
    if (!this.game) {
      n.guest.setReady(false, false);
      return this.go('lobby');
    }
    this.hud.toastMsg(`Waiting for ${host} to head back to the lobby…`);
  }

  /** Solo / host frame on the Midway: walk (menus over it leave everyone idle), tick, render, labels. */
  private hubFrame(dt: number, cssW: number, cssH: number, hs: HostSession | null): void {
    const g = this.game!;
    const walking = this.state === 'hub' && !this.hubTalk;
    g.inputs[this.localIndex].moveX = walking ? this.input.moveX : 0;
    g.inputs[this.localIndex].moveY = walking ? this.input.moveY : 0;
    const s0 = perf.now();
    this.acc += dt;
    let n = 0;
    while (this.acc >= TICK && n < 5) {
      hs?.beforeTick(g);
      g.tick();
      perf.tick();
      this.acc -= TICK;
      n++;
    }
    if (n >= 5) this.acc = 0;
    g.setCtx(g.players[this.localIndex] ?? g.players[0]);
    const r0 = perf.mark(SEC.sim, s0);
    this.renderer.render(g, Math.min(1, this.acc / TICK), dt);
    const h0 = perf.mark(SEC.render, r0);
    this.updateHubHud(cssW, cssH);
    perf.mark(SEC.hud, h0);
    this.perfHud?.update(g, hs ? hs.diag : null);
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
    // (labels over heads: each character's own height, D-91; they were at a fixed height, across faces)
    g.hubNpcs.forEach((n, i) => {
      const s = toS(n.x, n.y, this.renderer.charTop(n.char.id) + 12);
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
      // open: its own line; locked: a padlock and what opens it; the Ghost Train is still to come (D-71)
      const map = HUB_GATE_MAP[e.id], open = !!map && this.save.mapAvailable(map);
      const sub = open ? e.sub : map ? `Locked: ${MAP_LOCK[map].replace('Locked \u2014 ', '')}` : e.sub;
      if (shown(s)) labels.push({ x: s.x, y: s.y, text: open ? e.label : `\u{1F512} ${e.label}`, sub, kind: 'exit' });
      consider('exit', i, e.x, e.y, e.r);
    });
    this.renderer.hubOpen = new Set(HUB_EXITS.filter((e) => HUB_GATE_MAP[e.id] && this.save.mapAvailable(HUB_GATE_MAP[e.id])).map((e) => e.id));
    if (g.players.length > 1) {
      g.players.forEach((p, i) => {
        if (i === this.localIndex) return;
        const s = toS(p.x, p.y, this.renderer.charTop(p.char.id) + 12);
        if (shown(s)) labels.push({ x: s.x, y: s.y, text: p.name, kind: 'player', cls: `p${i + 1}` });
      });
    }
    // the labels are placed in the UI layer, which is zoomed to the window (D-74)
    for (const l of labels) {
      l.x /= uiZoom.v;
      l.y /= uiZoom.v;
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
      else if (HUB_EXITS[t.i].id === 'funhouse' && this.save.mapAvailable('fun_house')) {
        prompt = this.net?.role === 'guest' ? { key: '…', text: 'The Fun House', sub: 'the host leads the way in' } : { key, text: 'Enter the Fun House', sub: 'a night in the Palace of Illusions' };
      } else if (HUB_EXITS[t.i].id === 'boardwalk' && this.save.mapAvailable('boardwalk')) {
        prompt = this.net?.role === 'guest' ? { key: '…', text: 'The Boardwalk', sub: 'the host leads the way down to the shore' } : { key, text: 'Go down to the Boardwalk', sub: "a night on Penhallow's Boardwalk" };
      } else if (HUB_EXITS[t.i].id === 'train' && this.save.mapAvailable('ghost_train')) {
        // (D-84: it said "coming soon" behind a ✕ though E already boarded it)
        prompt = this.net?.role === 'guest' ? { key: '…', text: 'The Ghost Train', sub: 'the host leads the way onto the platform' } : { key, text: 'Board the Ghost Train', sub: 'a night on the Midnight Line' };
      } else prompt = { key: '✕', text: HUB_EXITS[t.i].label, sub: HUB_EXITS[t.i].id === 'funhouse' ? 'chained shut — survive the first night to open it' : HUB_EXITS[t.i].id === 'boardwalk' ? 'chained shut — survive the Fun House to open it' : 'chained shut — survive the Boardwalk to open it' };
    }
    const hs = this.net?.role === 'host' ? this.net.host : null;
    this.hubHud.root.classList.toggle('under', this.state !== 'hub');
    this.hubHud.update({ labels, prompt, dialogue, code: hs ? hs.lobby.code : null, party: g.players.map((p) => p.name) });
    this.hubHud.setNotice(this.save.data.notice);
  }

  /** Interact during a night (E, or A on a pad; D-67): the sim uses it next tick; a guest sends it to the host. */
  private interactPress(): void {
    const g = this.game;
    if (!g || g.hub) return;
    if (this.net?.role === 'guest') this.net.guest.interact();
    else g.inputs[this.localIndex].interact = true;
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
        // the Fun House's gate opens once the first night has been survived (D-63)
        for (const [gate, map] of Object.entries(HUB_GATE_MAP)) {
          if (HUB_EXITS[t.i].id === gate && this.save.mapAvailable(map) && this.net?.role !== 'guest') {
            this.audio.play('select', { vol: 0.6 });
            if (this.net?.role === 'host') {
              this.net.host.setMap(map);
              return this.hubToRunLobby();
            }
            this.save.data.last.map = map;
            return this.go('charselect');
          }
        }
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

  /** Close the Windows app (D-84): a party is told goodbye first, so friends see the lobby close, not a lost line. */
  private exitGame(): void {
    this.leaveNet(true);
    setTimeout(() => desktop?.quit(), 200);
  }

  /** The Midway's pause menu: what the main menu used to offer, minus what the grounds already have. */
  private midwayMenuEl(): HTMLElement {
    const role = this.net?.role ?? null;
    const items: { label: string; fn: () => void; cls?: string }[] = [{ label: 'Back to the Midway', fn: () => this.go('hub') }];
    if (!role) {
      // both go through the online menu first, so you can set the name you play under (D-75: Invite Friends
      // opened the lobby at once with the last name used)
      items.push({ label: 'Invite Friends', fn: () => this.go('mp', { focus: 'host' }) });
      items.push({ label: 'Join a Friend', fn: () => this.go('mp', { focus: 'join' }) });
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
    items.push({ label: 'Swap Character', fn: () => this.go('charswap') }, { label: 'Companions', fn: () => this.go('pets') });
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
    if (desktop) items.push({ label: 'Exit Game', cls: 'small red', fn: () => this.exitGame() });
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
      session.onChat = (from, name, text) => this.chatLine(from, name, text);
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
      gs.onChat = (from, name, text) => this.chatLine(from, name, text);
      gs.onStart = (c, resume) => this.startGuestRun(c, resume);
      gs.onEvent = (type, e) => this.guestEvent(type, e);
      gs.onToLobby = () => this.guestToLobby();
      gs.onClosed = (reason) => this.netClosed(reason);
      // refused for a version mismatch: look for an update now, so the player can take it straight away
      gs.onVersionRefused = () => void this.updates.check(true).then(() => this.offerUpdate());
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
        map: n.role === 'host' ? (id) => n.host.setMap(id) : undefined,
        start: () => this.startHostRun(),
        leave: () => this.leaveNet(false, 'mp'),
        midway: n.role === 'host' && this.save.hubUnlocked() ? () => this.restartHub() : undefined,
        lostfound: () => this.lobbyLostFound(),
      },
    });
  }

  /** From the co-op lobby into the Lost & Found, keeping the seat (D-74): shown as away, not ready, meanwhile. */
  private lobbyLostFound(): void {
    const n = this.net;
    if (!n) return;
    if (n.role === 'host') n.host.setAway(true);
    else n.guest.setReady(false, true);
    this.lfReturn = 'lobby';
    this.go('lostfound');
  }

  /** Tell the co-op session this save's current perks and unlocks; `back` clears the lobby's away badge. */
  private syncProfile(back: boolean): void {
    const n = this.net;
    if (!n) return;
    if (n.role === 'host') {
      n.host.setSelf(this.profileBase(n.host.self.name));
      if (back) n.host.setAway(false);
    } else {
      n.guest.sendProfile(this.guestProfile(n.guest.profile.name));
      if (back) n.guest.setReady(false, false);
    }
  }

  /** Lobby changed: rebuild the screen if anything but the latency readout changed. */
  private refreshLobby(): void {
    // co-op host on the Midway: someone joined or left, so rebuild the hub around the new party (D-60)
    if (this.net?.role === 'host' && this.net.host.inHub && this.game?.hub) {
      if (this.hubPartyKey() !== this.hubParty) this.restartHub(true);
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
    // someone picked, readied or changed a setting: update the open lobby in place (D-71). Rebuilding it
    // replayed the screen's entrance, so the whole menu flashed for everyone at every click
    if (this.screenEl?.isConnected && this.screenEl.classList.contains('lobby')) morph(this.screenEl, this.lobbyEl());
    else this.go('lobby');
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
    this.beginRun(g, cfg.players[me].character, resume ? 'BACK IN THE NIGHT' : 'MIDNIGHT', resume ? 'Reconnected to the host' : withYou(cfg.players.filter((_, i) => i !== me).map((p) => p.name)), resume);
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
  /**
   * The Boardwalk's per-frame presentation, solo, host and guest alike: the ambience beds follow where this
   * player stands (D-68; until D-71 only a guest's did), and the tide's turns are announced a few seconds
   * ahead (D-71).
   */
  private boardwalkFrame(g: Game): void {
    if (g.mapId !== 'boardwalk') return;
    this.audio.setShoreMix(...shoreMix(g.player.x, g.player.y));
    const turn = nextTideTurn(g.time), at = Math.round(g.time + turn.in);
    if (g.phase === 'play' && turn.in <= TIDE.warn && at !== this.tideSaid) {
      this.tideSaid = at;
      this.hud.tide(turn.going);
      this.audio.play('surge', { vol: 0.3 });
    }
    // the pier's hoist winching the founder's bell up (D-79): its ratchet while someone stays by the bell, a
    // slip and a groan while it settles back (a guest's copy of the progress moves in steps: a trend holds a
    // moment between them)
    const ch = g.quests?.get<SummersEndChain>('summers_end');
    if (ch?.stage === SE.Bell && g.phase === 'play') {
      const w = this.winch, now = performance.now();
      if (ch.bellT !== w.v) {
        w.trend = ch.bellT > w.v ? 1 : -1;
        w.v = ch.bellT;
        w.at = now;
      } else if (now - w.at > 600) w.trend = 0;
      if (w.trend !== 0 && now >= w.next) {
        const B = SUMMERS_END.bell, r = this.renderer;
        const near = Math.max(0, 1 - Math.hypot(B.x - r.camX, B.y - r.camY) / 1600);
        if (near > 0) this.audio.play(w.trend > 0 ? 'winch' : 'winch_slip', { vol: (w.trend > 0 ? 0.6 : 0.42) * near, pan: Math.max(-1, Math.min(1, (B.x - r.camX) / (r.viewWidth * 0.6))) });
        w.next = now + (w.trend > 0 ? 560 : 900);
      }
    }
  }

  private guestFrame(dt: number, now: number, cssW: number, cssH: number): void {
    const gs = (this.net as Extract<NetCtx, { role: 'guest' }>).guest;
    const g = this.game!;
    const rep = gs.replica;
    // only walk while the host's night is actually running (otherwise the host discards the steps)
    const live = (this.state === 'playing' || (this.state === 'hub' && g.hub)) && g.phase === 'play' && !gs.pausedBy && !this.prize.active && !!rep && !rep.frozen;
    const s0 = perf.now();
    if (live) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= TICK && n < 5) {
        gs.step(this.input.moveX, this.input.moveY, this.input.aimX, this.input.aimY, this.input.aimActive);
        perf.tick();
        this.acc -= TICK;
        n++;
      }
      if (n >= 5) this.acc = 0;
    } else this.acc = 0;
    rep?.frame(dt);
    perf.mark(SEC.sim, s0);
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
    const r0 = perf.now();
    this.renderer.render(g, rep ? rep.alpha(now) : 1, dt, { local, shotOffset: rep && local ? rep.shotOffset(local) : undefined });
    const h0 = perf.mark(SEC.render, r0);
    this.stageTug(g);
    if (this.state === 'playing') {
      this.updateCoopHud();
      this.hud.padKeys = this.input.usingGamepad;
      this.hud.update(g, this.fps, dt, this.hudScreen(cssW, cssH));
      this.boardwalkFrame(g);
      this.ghostTrainFrame(g, dt);
    } else if (g.hub) this.updateHubHud(cssW, cssH);
    perf.mark(SEC.hud, h0);
    this.perfHud?.update(g, gs.diag);
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

  /**
   * Co-op host, from the results (D-75): everyone back to the Midway (or the lobby), and the Lost & Found opens
   * here. It used to close the lobby. Back returns to the grounds, or to the lobby (shown away meanwhile).
   */
  private coopLostFound(): void {
    if (this.net?.role !== 'host') return this.toMenu('lostfound');
    this.coopToLobby();
    if (this.game?.hub) this.go('lostfound');
    else this.lobbyLostFound();
  }

  /**
   * Co-op guest, from the results (D-75): the Lost & Found without leaving the party. When the host takes
   * everyone on meanwhile, the shop stays open; Back returns to wherever the party is by then.
   */
  private guestLostFound(): void {
    if (this.net?.role !== 'guest') return this.toMenu('lostfound');
    this.lfReturn = 'party';
    this.go('lostfound');
  }

  /** Guest, back from the Lost & Found before the host has moved on: a waiting note (the next move is the host's). */
  private partyWait(): void {
    const host = this.net?.role === 'guest' ? this.net.guest.lobby?.players[0]?.name ?? 'the host' : 'the host';
    this.go('netmsg', {
      title: 'The Night Is Over',
      text: `Waiting for ${host} to head back to the Midway…`,
      actions: [{ label: 'Lost & Found', fn: () => this.guestLostFound() }, { label: 'Leave the Party', fn: () => this.toMenu(), cls: 'small red' }],
    });
  }

  /** Guest: the host took everyone back to the lobby. */
  private guestToLobby(): void {
    this.endRunView();
    this.makeDemo();
    // shopping at the Lost & Found: stay there (shown away in the lobby) until Back, which then follows the
    // party (the host may still take everyone on to the Midway) (D-75)
    if (this.state === 'lostfound' && this.net?.role === 'guest') {
      this.lfReturn = 'party';
      this.net.guest.setReady(false, true);
      return;
    }
    // still reading the results: likewise (shown away), until their first button leads on (D-84)
    if (this.state === 'results' && this.net?.role === 'guest') {
      this.net.guest.setReady(false, true);
      this.relabelResults('Back to the Lobby');
      return;
    }
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
