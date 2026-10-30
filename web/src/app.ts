// Application conductor: screen state machine, fixed-timestep loop (60 Hz sim, interpolated
// render), sim → audio/HUD/save event wiring, tutorials, the attract-mode menu background, and the
// development-only timeline tools (stripped from production builds).

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

type State = 'loading' | 'press' | 'title' | 'charselect' | 'daily' | 'lostfound' | 'pedia' | 'settings' | 'playing' | 'paused' | 'results';

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

  constructor() {
    this.input = new Input(this.canvas);
    this.input.onNav((e) => this.onNav(e));
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
    this.draft = new DraftView(this.assets, (i) => this.pickDraft(i), () => this.game?.rerollDraft(), (i) => this.game?.banishDraft(i), () => this.game?.skipDraft());
    this.prizeUi = new PrizeOverlay(() => this.prize.skip(false));
    this.prize = new PrizeWheel(this.renderer.camera, this.assets, this.prizeUi, this.audio);
    this.ctx = {
      save: this.save, assets: this.assets, audio: this.audio, input: this.input,
      click: () => this.audio.play('ui_click', { vol: 0.5 }),
      go: (s, arg) => this.go(s as State, arg),
      startRun: (o) => this.startRun(o),
      applySettings: () => this.applySettings(),
    };
    this.applySettings();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.makeDemo();
    ld.el.remove();
    this.go('press');
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
      this.renderer.settings = { highContrast: s.highContrast, reducedFlash: s.reducedFlash, shake: s.shake, damageNumbers: s.damageNumbers, quality: s.quality };
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
    this.screenEl?.remove();
    this.screenEl = null;
    this.state = state;
    let el: HTMLElement | null = null;
    switch (state) {
      case 'press':
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
        el = S.pauseScreen(this.ctx, { weapons: g.weapons.list.map((w) => w.def.id), passives: [...g.player.passives.keys()], time: g.time, kills: g.kills }, () => this.resume(), () => this.abandon());
        break;
      }
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

  private pressed(): void {
    this.audio.unlock().then(() => this.audio.setCue('menu'));
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
    this.game?.bus.clear();
    this.game = new Game(cfg);
    this.wireGame(this.game);
    this.renderer.fx.clear();
    this.renderer.dawn = 0;
    this.renderer.snapCamera(this.game.player.x, this.game.player.y);
    this.dawnT = -1;
    this.hud.reset();
    this.hud.root.classList.remove('under');
    this.hud.setPortrait(o.character);
    if (!this.hud.root.isConnected) this.ui.append(this.hud.root);
    this.ui.append(this.draft.root, this.prizeUi.root, this.fortune.root);
    this.draft.hide();
    this.prizeUi.hide();
    this.fortune.hide();
    this.overlayPause = false;
    this.acc = 0;
    this.runStart = performance.now();
    this.go('playing');
    this.audio.setCue('act1');
    this.hud.banner(o.daily ? 'DAILY RUN' : 'MIDNIGHT', o.daily ? dailyInfo().modName : 'The gates lock behind you…', 'gold', 3);
    this.tutorial('move', 'Move with <b>WASD</b>, the <b>arrow keys</b> or the <b>left stick</b>. Your weapons fire on their own.');
  }

  private wireGame(g: Game): void {
    const a = this.audio;
    const camPan = (x?: number) => (x === undefined ? 0 : Math.max(-1, Math.min(1, (x - this.renderer.camX) / (this.renderer.viewWidth * 0.6))));
    g.bus.on('sfx', (e) => {
      if (e.x !== undefined && Math.abs(e.x - this.renderer.camX) > this.renderer.viewWidth * 0.9) return;
      a.play(e.id, { vol: e.vol, pitch: e.pitch, pan: camPan(e.x) });
    });
    g.bus.on('pickup', (e) => {
      if (e.kind === 'ticket') a.pickup();
      else if (e.kind === 'food' || e.kind === 'funnel') a.play('heal', { vol: 0.6 });
      else if (e.kind === 'golden') a.play('evolve', { vol: 0.5, pitch: 1.4 });
      else if (e.kind === 'bank') a.play('levelup', { vol: 0.5, pitch: 1.2 });
      if (e.kind === 'ticket') this.tutorial('tickets', '<b>Tickets</b> are XP. Walk near them to collect — fill the bar to level up.');
    });
    g.bus.on('levelup', () => a.play('levelup', { vol: 0.55 }));
    g.bus.on('draft', (e) => {
      this.draft.show(g, e.options);
      this.tutorial('draft', 'Pick one prize. Weapons level to <b>8</b>; a maxed weapon + its matching passive can <b>EVOLVE</b>.');
    });
    g.bus.on('player_hurt', () => {
      a.play('hurt', { vol: 0.6 });
      this.input.rumble(0.5, 120);
    });
    g.bus.on('shield_pop', () => this.hud.toastMsg('Balloon Shield popped!'));
    g.bus.on('player_revive', () => this.hud.banner('SECOND WIND!', 'A revive balloon carries you back up', 'gold'));
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
      // the prize wheel PRESENTS what the sim already granted (entries) — it never rolls again (D-34)
      a.play('chest', { vol: 0.6 });
      this.overlayPause = true;
      const fillers = [...g.weapons.list.map((w) => this.assets.weaponIcon(w.def.id)), ...[...g.player.passives.keys()].map((id) => this.assets.passiveIcon(id))];
      const entries = e.entries ?? e.items.map((label) => ({ type: 'level' as const, id: g.weapons.list[0]?.def.id ?? 'throwing_cards', label }));
      this.prize.start(entries, fillers, () => {
        this.overlayPause = false;
      });
    });
    g.bus.on('meta_currency', (e) => {
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
    g.chooseDraft(i);
    if (g.phase !== 'draft') this.draft.hide();
  }

  /** The Last Song's cues: every step answers with sound and light, never with UI checklists (D-32). */
  private onQuest(g: Game, q: QuestCue): void {
    const a = this.audio;
    const pan = (x?: number) => (x === undefined ? 0 : Math.max(-1, Math.min(1, (x - this.renderer.camX) / (this.renderer.viewWidth * 0.6))));
    const bell = (note: number, vol = 0.45, x?: number) => a.play('bellnote', { vol, pitch: note / 523.25, pan: pan(x) });
    const fx = (type: string, x: number, y: number, style: string, aa = 1) => this.renderer.fx.handle([{ type: type as never, x, y, a: aa, b: 0, c: 0, style }]);
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
        const rec = (s.data.quests[q.chain] ??= { completions: 0, bestStage: 0 });
        rec.completions++;
        rec.bestStage = Math.max(rec.bestStage, 7);
        s.save();
        this.hud.banner('THE LAST SONG', 'The music has ended. The Steam Calliope will remember you.', 'gold', 5);
        break;
      }
    }
  }

  private resume(): void {
    this.screenEl?.remove();
    this.screenEl = null;
    this.go('playing');
  }

  private abandon(): void {
    const g = this.game;
    if (!g) return;
    this.screenEl?.remove();
    this.screenEl = null;
    this.state = 'playing';
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
    const canEndless = st.won && !st.endless && s.endlessAvailable();
    setTimeout(() => {
      this.screenEl?.remove();
      this.state = 'results';
      this.hud.root.classList.add('under');
      if (st.trueEnding) notes.unshift('The Steam Calliope now plays in the draft pool.');
      const el = S.resultsScreen(this.ctx, st, { achievements: earned.map((a) => `${a.name} — ${a.desc} (+${a.reward} LT)`), newUnlocks: notes, dailyBest }, {
        again: () => this.lastRun && this.startRun(this.lastRun),
        menu: () => this.toMenu(),
        lostfound: () => this.toMenu('lostfound'),
        endless: canEndless ? () => this.goEndless() : undefined,
      });
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
    this.hud.root.remove();
    this.draft.hide();
    this.prizeUi.hide();
    this.fortune.hide();
    this.game?.bus.clear();
    this.game = null;
    this.renderer.fx.clear();
    this.renderer.dawn = 0;
    this.makeDemo();
    this.go(next);
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
    if (this.state === 'playing' && this.game) {
      if (this.prize.active) {
        if (e === 'confirm') this.prize.skip(false);
        else if (e === 'back' || e === 'pause') this.prize.skip(true);
        return;
      }
      if (this.draft.visible) {
        const g = this.game;
        if (e === 'reroll') g.rerollDraft();
        else if (e === 'banish') this.draft.toggleBanish();
        else if (e === 'skip') g.skipDraft();
        else if (e === 'confirm') this.draft.nav.activate();
        else if (e === 'up' || e === 'down' || e === 'left' || e === 'right') {
          this.draft.nav.move(e);
          this.audio.play('ui_hover', { vol: 0.3 });
        }
        if (g.phase !== 'draft') this.draft.hide();
        return;
      }
      if (e === 'pause' && this.game.phase === 'play') {
        this.audio.play('ui_click');
        this.go('paused');
      }
      return;
    }
    if (this.state === 'paused' && (e === 'pause' || e === 'back')) {
      this.resume();
      return;
    }
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
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.25) dt = 0.25;
    this.fps += (1 / Math.max(0.001, dt) - this.fps) * 0.05;
    const g = this.game;
    const playing = this.state === 'playing' && g;
    // player screen position for mouse aim
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const target = playing ? g!.player : this.demo!.player;
    const sp = this.renderer.worldToScreen(target.x, target.y, cssW, cssH, 30);
    this.input.poll(sp.x, sp.y);
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
      this.prize.update(dt, (k) => {
        this.renderer.fx.screenFlash = Math.max(this.renderer.fx.screenFlash, k);
        this.renderer.fx.screenFlashCol = [1, 0.85, 0.7];
      });
      this.fortune.update(dt);
      if (!this.overlayPause && g!.phase !== 'draft') {
        this.acc += dt * this.simSpeed;
        let n = 0;
        const maxTicks = Math.max(5, Math.ceil(this.simSpeed * 5));
        while (this.acc >= TICK && n < maxTicks) {
          g!.tick();
          this.acc -= TICK;
          n++;
        }
        if (n >= maxTicks) this.acc = 0;
      }
      if (this.dawnT >= 0) {
        this.dawnT += dt;
        this.renderer.dawn = Math.min(1, this.dawnT / 4);
      }
      const alpha = this.overlayPause || g!.phase === 'draft' ? 1 : Math.min(1, this.acc / TICK);
      this.renderer.render(g!, alpha, dt);
      this.hud.update(g!, this.fps, dt, { w: cssW, h: cssH, toScreen: (x, y) => this.renderer.worldToScreen(x, y, cssW, cssH) });
    } else if (this.state === 'paused' || this.state === 'results') {
      if (g) this.renderer.render(g, 1, dt);
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
