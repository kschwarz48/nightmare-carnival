// Application conductor: screen state machine, fixed-timestep loop (60 Hz sim, interpolated
// render), sim → audio/HUD/save event wiring, tutorials, the attract-mode menu background, and the
// development-only timeline tools (stripped from production builds).

import { AudioEngine } from './audio/audio';
import { Input, type NavEvent } from './input/input';
import { SaveManager } from './meta/save';
import { Assets } from './render/assets';
import { GameRenderer, VIEW_H } from './render/renderer';
import { Game, TICK, type RunConfig, type RunStats } from './sim/game';
import { hashSeed } from './core/rng';
import { CHARACTERS, CHARACTER_MAP } from './data/characters';
import { BOSS_MAP } from './data/bosses';
import { PERKS } from './data/meta';
import { WEAPONS, PASSIVES } from './data/weapons';
import { ENEMIES } from './data/enemies';
import { DIFFICULTIES } from './data/difficulty';
import { ChestView, DraftView, Hud } from './ui/hud';
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
  renderer!: GameRenderer;
  hud!: Hud;
  draft!: DraftView;
  chest!: ChestView;
  state: State = 'loading';
  game: Game | null = null;
  demo: Game | null = null;
  private screenEl: HTMLElement | null = null;
  private nav: FocusNav | null = null;
  private acc = 0;
  private last = performance.now();
  private fps = 60;
  private settingsBack: () => void = () => this.go('title');
  private lastRun: { character: string; difficulty: string; curse: boolean; daily?: boolean } | null = null;
  private dawnT = -1;
  simSpeed = 1;
  autopilot = false;
  private lastPediaToast = 0;
  private overlayPause = false;
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
    this.assets.build((p) => ld.set(p, tips[Math.min(tips.length - 1, Math.floor(p * tips.length))]));
    ld.set(1, 'Opening the gates…');
    this.renderer = new GameRenderer(this.canvas, this.assets);
    this.hud = new Hud(this.assets);
    this.draft = new DraftView(this.assets, (i) => this.pickDraft(i), () => this.game?.rerollDraft(), (i) => this.game?.banishDraft(i), () => this.game?.skipDraft());
    this.chest = new ChestView(this.assets, () => this.closeChest());
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
    if (import.meta.env.DEV) this.installDevTools();
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
  startRun(o: { character: string; difficulty: string; curse: boolean; daily?: boolean }): void {
    this.audio.unlock();
    this.lastRun = o;
    if (!o.daily) {
      this.save.data.last = { character: o.character, difficulty: o.difficulty, curse: o.curse };
      this.save.save();
    }
    const perk = (id: string) => this.save.perkLevel(id);
    const seed = o.daily ? hashSeed('nc-daily-' + dailyInfo().seed) : (Math.random() * 2 ** 31) | 0;
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
    };
    this.game?.bus.clear();
    this.game = new Game(cfg);
    this.wireGame(this.game);
    this.renderer.fx.clear();
    this.renderer.dawn = 0;
    this.renderer.snapCamera(this.game.player.x, this.game.player.y);
    this.dawnT = -1;
    this.hud.reset();
    this.hud.setPortrait(o.character);
    if (!this.hud.root.isConnected) this.ui.append(this.hud.root);
    this.ui.append(this.draft.root, this.chest.root);
    this.draft.hide();
    this.chest.hide();
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
      a.play('chest', { vol: 0.8 });
      this.overlayPause = true;
      this.chest.show(e.items, e.evolution);
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

  private pickDraft(i: number): void {
    const g = this.game;
    if (!g) return;
    g.chooseDraft(i);
    if (g.phase !== 'draft') this.draft.hide();
  }

  private closeChest(): void {
    if (!this.chest.canClose()) return;
    this.chest.hide();
    this.overlayPause = false;
    this.audio.play('ui_click', { vol: 0.4 });
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
    this.chest.hide();
    const canEndless = st.won && !st.endless && s.endlessAvailable();
    setTimeout(() => {
      this.screenEl?.remove();
      this.state = 'results';
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
    g.startEndless();
    this.go('playing');
  }

  private toMenu(next: State = 'title'): void {
    this.hud.root.remove();
    this.draft.hide();
    this.chest.hide();
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
      if (this.chest.visible) {
        if (e === 'confirm' || e === 'back' || e === 'pause') this.closeChest();
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
    const sp = this.renderer.worldToScreen(target.x, target.y - 20, cssW, cssH);
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
      this.chest.update(dt);
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

  private demoAutopilot(g: Game): void {
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

  // =================================================================== dev tools (DEV builds only)
  private installDevTools(): void {
    const app = this;
    const api = {
      app,
      jump(sec: number) {
        const g = app.game;
        if (!g) return;
        g.time = sec;
      },
      speed(x: number) {
        app.simSpeed = x;
      },
      auto(on = true) {
        app.autopilot = on;
      },
      /** Synchronously simulate `sec` seconds (autopilot + auto-draft), then render. */
      advance(sec: number) {
        const g = app.game;
        if (!g) return;
        const n = Math.round(sec * 60);
        for (let i = 0; i < n && g.phase !== 'ended'; i++) {
          app.demoAutopilot(g);
          if (g.phase === 'draft') app.pickDraft(0);
          if (app.overlayPause) {
            app.chest.hide();
            app.overlayPause = false;
          }
          g.tick();
          if (i % 30 === 0) app.renderer.fx.handle(g.fx.drain());
          if (i % 30 === 0) app.renderer.fx.update(0.5);
        }
        for (let k = 0; k < 3; k++) app.renderer.render(g, 1, 1 / 60);
        const cssW = window.innerWidth, cssH = window.innerHeight;
        app.hud.update(g, app.fps, 1 / 60, { w: cssW, h: cssH, toScreen: (x, y) => app.renderer.worldToScreen(x, y, cssW, cssH) });
        return { t: g.time, lvl: g.level, kills: g.kills, alive: g.active.length, hp: Math.round(g.player.hp), phase: g.phase };
      },
      /** Render `frames` frames synchronously (sim ticking) and report average ms per frame. */
      bench(frames = 120) {
        const g = app.game ?? app.demo!;
        const gl = app.renderer.renderer.getContext();
        const t0 = performance.now();
        let simMs = 0;
        for (let i = 0; i < frames; i++) {
          const s0 = performance.now();
          app.demoAutopilot(g);
          if (g.phase === 'draft') g.chooseDraft(0);
          g.tick();
          simMs += performance.now() - s0;
          app.renderer.render(g, 1, 1 / 60);
        }
        gl.finish();
        const total = (performance.now() - t0) / frames;
        return { msPerFrame: +total.toFixed(2), simMs: +(simMs / frames).toFixed(2), renderMs: +(total - simMs / frames).toFixed(2), enemies: g.active.length, projs: g.projs.filter((p) => p.alive).length, bullets: g.bullets.filter((b) => b.alive).length, sprites: app.renderer.world.count + app.renderer.proj.count + app.renderer.fxAdd.count + app.renderer.fxNormal.count + app.renderer.bullets.count };
      },
      god(on = true) {
        if (app.game) app.game.cfg.godMode = on;
      },
      level(n = 1) {
        const g = app.game;
        if (!g) return;
        for (let i = 0; i < n; i++) g.addXp(g.xpToNext - g.xp + 0.01);
      },
      give(id: string) {
        const g = app.game;
        if (!g) return;
        if (WEAPONS[id]) {
          g.weapons.add(id);
          for (let i = 0; i < 8; i++) g.weapons.levelUp(id);
        } else if (PASSIVES[id]) g.player.addPassive(id);
      },
      evolve(id: string) {
        app.game?.weapons.evolve(id);
      },
      killAll() {
        const g = app.game;
        if (!g) return;
        for (const e of g.active) if (e.alive) g.killEnemy(e);
      },
      bossHp(frac: number) {
        const g = app.game;
        if (!g) return;
        for (const b of g.bosses) if (b.awake && !b.dead) b.hp = b.maxHp * frac;
      },
      win() {
        app.game?.endRun(true);
      },
      tickets(n: number) {
        app.save.data.lostTickets += n;
        app.save.save();
      },
      unlockAll() {
        for (const a of ['reach_12', 'beat_tent', 'beat_ferris_wheel', 'beat_puppet_king', 'beat_ringmaster', 'win_carnival']) if (!app.save.data.achievements.includes(a)) app.save.data.achievements.push(a);
        for (const c of CHARACTERS) if (c.unlock && !app.save.data.unlocks.includes(`char_${c.id}`)) app.save.data.unlocks.push(`char_${c.id}`);
        for (const u of ['w_orbs', 'w_cannon', 'w_laser', 'w_bell', 'w_mirror', 'p_season_pass', 'p_coin_purse', 'p_rabbits_foot', 'f_skip']) if (!app.save.data.unlocks.includes(u)) app.save.data.unlocks.push(u);
        app.save.data.stats.runs = Math.max(1, app.save.data.stats.runs);
        app.save.save();
      },
    };
    (window as any).__nc = api;
    // compact on-screen dev panel, toggled with the backquote key
    const panel = h('div', { class: 'devpanel hidden' });
    const b = (label: string, fn: () => void) => h('button', { onclick: fn }, label);
    panel.append(
      b('×1', () => api.speed(1)), b('×4', () => api.speed(4)), b('×16', () => api.speed(16)),
      b('+1m', () => app.game && api.jump(app.game.time + 60)),
      b('→5:55', () => api.jump(355)), b('→11:55', () => api.jump(715)), b('→17:55', () => api.jump(1075)), b('→23:55', () => api.jump(1435)),
      b('god', () => api.god(!app.game?.cfg.godMode)), b('auto', () => api.auto(!app.autopilot)), b('lvl+5', () => api.level(5)), b('boss 10%', () => api.bossHp(0.1)), b('kill all', () => api.killAll()),
      b('unlock all', () => api.unlockAll()), b('+1000 LT', () => api.tickets(1000)),
    );
    this.ui.append(panel);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') panel.classList.toggle('hidden');
    });
    console.info('%cNightmare Carnival dev tools: window.__nc (press ` for the panel)', 'color:#f2c14e');
  }
}

export const _unused = { VIEW_H, PERKS, CHARACTER_MAP };
