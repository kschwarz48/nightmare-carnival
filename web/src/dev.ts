// Development-only timeline & testing tools. Imported dynamically under import.meta.env.DEV only,
// so none of this ships in production builds.
import type { App } from './app';
import { CHARACTERS } from './data/characters';
import { WEAPONS, PASSIVES } from './data/weapons';
import { h } from './ui/dom';

export function installDevTools(app: App): void {
    
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
        app.hud.update(g, app.fps, sec, { w: cssW, h: cssH, toScreen: (x, y) => app.renderer.worldToScreen(x, y, cssW, cssH) });
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
    app.ui.append(panel);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') panel.classList.toggle('hidden');
    });
    console.info('%cNightmare Carnival dev tools: window.__nc (press ` for the panel)', 'color:#f2c14e');
  }
