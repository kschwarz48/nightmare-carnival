// Development-only timeline & testing tools. Imported dynamically under import.meta.env.DEV only,
// so none of this ships in production builds.
import type { MapId } from './data/maps';
import type { App } from './app';
import { CHARACTERS } from './data/characters';
import { WEAPONS, PASSIVES } from './data/weapons';
import { h } from './ui/dom';
import { createBoss } from './sim/bosses';
import { BOSS_MAP } from './data/bosses';
import { pool } from './render3d/core/materials';
import { SEARCHLIGHTS } from './render3d/renderer3d';
import { isLowTide, shoreY } from './data/boardwalk';
import type { SummersEndChain } from './sim/quest/summersEnd';
import { refreshSea } from './sim/boardwalk';

/**
 * The threejs-qa-release canvas inspector's pixel metrics, ported to run in-page on the live
 * framebuffer (same 160×90 luminance grid, 4-bit colour buckets and edge threshold), so captures
 * taken in the in-app browser carry the same measured evidence as the Playwright inspector.
 */
function pixelMetrics(px: Uint8Array, width: number, height: number) {
  const stepX = Math.max(1, Math.floor(width / 160)), stepY = Math.max(1, Math.floor(height / 90));
  const cols = Math.floor(width / stepX), rows = Math.floor(height / stepY);
  const lum = new Float64Array(cols * rows);
  const buckets = new Map<string, number>();
  let samples = 0;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const o = (gy * stepY * width + gx * stepX) * 4;
      const r = px[o], g = px[o + 1], b = px[o + 2];
      lum[gy * cols + gx] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
      samples++;
    }
  }
  const sorted = Array.from(lum).sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const p5 = sorted[Math.floor(sorted.length * 0.05)], p95 = sorted[Math.floor(sorted.length * 0.95)];
  let entropy = 0, dominant = 0;
  for (const c of buckets.values()) {
    const p = c / samples;
    entropy -= p * Math.log2(p);
    dominant = Math.max(dominant, c);
  }
  let edges = 0, checked = 0;
  for (let gy = 0; gy < rows - 1; gy++) {
    for (let gx = 0; gx < cols - 1; gx++) {
      const i = gy * cols + gx;
      if (Math.max(Math.abs(lum[i] - lum[i + 1]), Math.abs(lum[i] - lum[i + cols])) > 12) edges++;
      checked++;
    }
  }
  const r2 = (v: number, d: number) => +v.toFixed(d);
  return {
    colorBuckets: buckets.size,
    colorEntropyBits: r2(entropy, 2),
    edgeDensity: r2(edges / checked, 3),
    luminance: { mean: r2(mean, 1), p5: r2(p5, 1), p95: r2(p95, 1), contrast: r2(p95 - p5, 1) },
    dominantColorShare: r2(dominant / samples, 3),
  };
}

export function installDevTools(app: App): void {
    
    const api = {
      app,
      /** The practical-light pool and searchlights (lighting inspection). */
      pool,
      searchlights: SEARCHLIGHTS,
      /** Freeze a run for visual inspection: optional restart, teleport, zoom and camera offset. */
      shot(o: { restart?: boolean; char?: string; map?: MapId; t?: number; zoom?: number; x?: number; y?: number; dx?: number; dy?: number; hud?: boolean } = {}) {
        if (!app.game || o.restart) {
          app.startRun({ character: o.char ?? 'carny', difficulty: 'midway', curse: false, map: o.map });
          api.advance(o.t ?? 30);
        }
        const g = app.game!;
        if (g.phase === 'draft') app.pickDraft(0);
        app.draft.hide();
        app.overlayPause = true;
        app.hud.root.style.display = o.hud ? '' : 'none';
        app.renderer.zoom = o.zoom ?? 1;
        app.renderer.resize(innerWidth, innerHeight, Math.min(2, devicePixelRatio || 1));
        if (o.x !== undefined && o.y !== undefined) {
          g.player.x = g.player.px = o.x;
          g.player.y = g.player.py = o.y;
        }
        app.renderer.snapCamera(g.player.x + (o.dx ?? 0), g.player.y + (o.dy ?? 0));
        app.renderer.inspect = (o.zoom ?? 1) > 1 ? { x: g.player.x + (o.dx ?? 0), y: g.player.y + (o.dy ?? 0) } : null;
        return { enemies: g.active.length, t: Math.round(g.time) };
      },
      /** Spawn a boss awake right next to the player (visual testing). */
      spawnBoss(id: string, dx = 0, dy = -420) {
        const g = app.game;
        const def = BOSS_MAP[id as keyof typeof BOSS_MAP];
        if (!g || !def) return 'no game / unknown boss';
        const b = createBoss(g, def, { immediate: true, noChest: true });
        b.x = b.px = g.player.x + dx;
        b.y = b.py = g.player.y + dy;
        g.bosses.push(b);
        return b.def.id;
      },
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
            app.prize.finishNow();
            app.overlayPause = false;
          }
          g.tick();
          if (i % 30 === 0) app.renderer.fx.handle(g.fx.drain());
          if (i % 30 === 0) app.renderer.fx.update(0.5);
        }
        for (let k = 0; k < 3; k++) app.renderer.render(g, 1, 1 / 60);
        const cssW = window.innerWidth, cssH = window.innerHeight;
        app.hud.update(g, app.fps, sec, { w: cssW, h: cssH, toScreen: (x, y, hh) => app.renderer.worldToScreen(x, y, cssW, cssH, hh ?? 0) });
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
        return { msPerFrame: +total.toFixed(2), simMs: +(simMs / frames).toFixed(2), renderMs: +(total - simMs / frames).toFixed(2), enemies: g.active.length, projs: g.projs.filter((p) => p.alive).length, bullets: g.bullets.filter((b) => b.alive).length, billboards: app.renderer.fxAdd.count + app.renderer.fxNormal.count + app.renderer.glow.count, drawCalls: app.renderer.renderer.info.render.calls, triangles: app.renderer.renderer.info.render.triangles };
      },
      /** Render one frame and measure it: pixel metrics plus this frame's renderer totals (all passes). */
      metrics() {
        const r = app.renderer;
        const g = app.game ?? app.demo!;
        const gl = r.renderer.getContext();
        r.render(g, 1, 0);
        const w = gl.drawingBufferWidth, hgt = gl.drawingBufferHeight;
        const px = new Uint8Array(w * hgt * 4);
        gl.readPixels(0, 0, w, hgt, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const info = r.renderer.info;
        return { ...pixelMetrics(px, w, hgt), size: [w, hgt], renderer: { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0 } };
      },
      /** Render a frame, measure it and save it (dev server) as artifacts/visual/<run>/<name>.png + .json. */
      async capture(run: string, name: string) {
        const m = api.metrics();
        const r = app.renderer;
        r.render(app.game ?? app.demo!, 1, 0);
        const png = r.renderer.domElement.toDataURL('image/png');
        const meta = { ...m, diagnostics: (window as any).__THREE_GAME_DIAGNOSTICS__, at: new Date().toISOString() };
        const res = await fetch('/__capture', { method: 'POST', body: JSON.stringify({ run, name, png, meta }) });
        return { saved: (await res.json()).file as string, ...m };
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
      /**
       * Two-tab co-op harness (D-52): `await __nc.coop.host()` in one tab prints the code; in another
       * tab `await __nc.coop.join('CODE')`; then `__nc.coop.start()` in the host tab. Real PeerJS.
       */
      coop: {
        async host(name = 'Host') {
          const a = app as any;
          if (a.state === 'press') app.go('title');
          app.go('mp' as never);
          await a.hostGame(name);
          return a.net?.host?.lobby?.code ?? a.mpStatus;
        },
        async join(code: string, name = 'Guest', character = 'strongman') {
          const a = app as any;
          if (a.state === 'press') app.go('title');
          try {
            localStorage.setItem('nc-player-name', name);
          } catch {
            /* ignore */
          }
          app.go('mp_join' as never);
          await a.joinGame(code);
          for (let i = 0; i < 50 && !a.net?.guest?.lobby; i++) await new Promise((r) => setTimeout(r, 100));
          a.net?.guest?.pick(character);
          await new Promise((r) => setTimeout(r, 300));
          a.net?.guest?.setReady(true);
          return a.net?.guest?.lobby ?? a.mpStatus;
        },
        start(character = 'carny') {
          const a = app as any;
          const hs = a.net?.host;
          if (!hs) return 'not hosting';
          if (hs.hostCharacter !== character) hs.setCharacter(character);
          hs.setReady(true);
          a.startHostRun();
          return a.state;
        },
        /** Pick the first card / skip prize wheels automatically on this tab (testing only). */
        autopick(on = true) {
          const a = app as any;
          clearInterval(a.__autopick);
          if (on) a.__autopick = setInterval(() => {
            if (app.draft.visible) app.pickDraft(0);
            if (app.prize.active) app.prize.skip(false);
          }, 150);
        },
        diag() {
          const a = app as any;
          return a.net ? (a.net.role === 'host' ? a.net.host.diag : a.net.guest.diag) : null;
        },
      },
    };
    (window as any).__nc = api;

    // ---- the threejs-qa-release determinism contract: seed, named states, freeze, diagnostics
    let seed = 42;
    const freeze = () => {
      app.draft.hide();
      app.overlayPause = true;
    };
    const run = (char = 'carny', map: MapId = 'carnival_core') => {
      app.overlayPause = false;
      app.renderer.zoom = 1;
      app.renderer.inspect = null;
      if (map === 'fun_house') app.save.data.funhouseTester = true;
      if (map === 'boardwalk') app.save.data.boardwalkTester = true;
      app.startRun({ character: char, difficulty: 'midway', curse: false, seed, map });
      app.game!.cfg.godMode = true;
      return app.game!;
    };
    /** a minute into a Fun House night, then the player stood at (x, y) */
    const house = (x: number, y: number) => {
      const g = run('carny', 'fun_house');
      api.advance(60);
      g.player.x = g.player.px = x;
      g.player.y = g.player.py = y;
      api.advance(0.5);
    };
    /** a Boardwalk night (D-68) a minute in, the player placed at (x, y) */
    const shore = (x: number, y: number, t = 60) => { const g = run('carny', 'boardwalk'); api.advance(t); g.player.x = g.player.px = x; g.player.y = g.player.py = y; api.advance(0.5); return g; };
    /** the Boardwalk's new crowd (D-68), one of each in two rows on the wet sand, held mid-stride */
    const bestiary = () => {
      const g = shore(300, 700, 20);
      for (const e of g.active) g.despawnEnemy(e);
      const ids = ['drowned', 'shore_crawler', 'ticket_taker', 'taffy_horror', 'arcade_automaton', 'coaster_wraith', 'barnacle_brute', 'lantern_angler', 'prize_collector', 'tidecaller', 'great_barnacle'];
      ids.forEach((id, i) => {
        const e = g.spawnEnemy(id, 300 + ((i % 6) - 2.5) * 105, 640 + Math.floor(i / 6) * 150, { exact: true, noScale: true });
        if (e) {
          e.spawnT = 3;
          e.emerge = 0;
        }
      });
    };
    /** Summer's End set to a stage by `set`, the player at (x, y), at low tide if asked, the crowd cleared */
    const egg = (x: number, y: number, set: (c: SummersEndChain) => void, lowTide = false) => {
      const g = shore(x, y, 20);
      for (const e of g.active) g.despawnEnemy(e);
      if (lowTide) while (!isLowTide(g.time)) g.time += 0.5;
      const c = g.quests.get<SummersEndChain>('summers_end')!;
      set(c);
      refreshSea(g);
      api.advance(0.2);
    };
    /** a crowd of the given creatures closing on a player at (x, y), a few seconds into the fight */
    const melee = (x: number, y: number, crowd: Record<string, number>, secs = 5) => {
      const g = shore(x, y, 45);
      let i = 0;
      for (const [id, n] of Object.entries(crowd)) {
        for (let k = 0; k < n; k++, i++) {
          const a = i * 2.39996, r = 260 + (i % 4) * 70;
          g.spawnEnemy(id, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, { exact: true });
        }
      }
      api.advance(secs);
    };
    /** the drowned coming up out of the surf and the sand around a player at the waterline, caught mid-climb;
     *  further out, sea things swimming in with their heads above the swell */
    const rising = () => {
      const g = shore(500, 0, 200);
      for (const e of g.active) g.despawnEnemy(e);
      const sy = shoreY(500);
      g.player.x = g.player.px = 500;
      g.player.y = g.player.py = sy - 70;
      for (let i = 0; i < 6; i++) g.spawnEnemy('drowned', 500 + (i - 2.5) * 70, sy - 150 + (i % 3) * 110, { exact: true });
      for (let i = 0; i < 3; i++) g.spawnEnemy('shore_crawler', 330 + i * 160, sy + 120, { exact: true });
      for (const [id, dx, d] of [['drowned', -250, 330], ['lantern_angler', 230, 300], ['barnacle_brute', 20, 380]] as [string, number, number][]) {
        const e = g.spawnEnemy(id, 500 + dx, shoreY(500 + dx) + d, { exact: true });
        if (e) e.emerge = 0, e.spawnT = 3;
      }
      api.advance(0.45);
    };
    /** a chest opened at the player, the prize wheel stepped `frames` into its show */
    const wheel = (frames: number) => {
      const g = run();
      api.advance(20);
      g.spawnPickup('chest', g.player.x, g.player.y, 0);
      for (let i = 0; i < 30 && !app.prize.active; i++) g.tick();
      for (let i = 0; i < frames; i++) app.prize.update(1 / 60, () => {});
      // what the app's own frame eases to while a wheel is up: less bloom, the booth graded as a lit show
      app.renderer.post.bloomScale = 0.35;
      app.renderer.overlayFocus = 1;
    };
    const STATES: Record<string, () => void> = {
      /** a minute into a night: the opening crowd around the player on the plaza */
      'active-play-desktop': () => { run(); api.advance(60); },
      /** late in a night: Act IV density with an evolved arsenal */
      'late-combat': () => { const g = run('ride_operator'); api.jump(1150); api.advance(45); g.cfg.godMode = true; },
      /** the Ringmaster's stage: boss lighting, telegraphs, summons */
      'boss-ringmaster': () => { run(); api.advance(20); api.spawnBoss('ringmaster', 0, -380); api.advance(5); },
      // the Fun House, room by room (D-67)
      'fh-entrance': () => house(0, 1450),
      'fh-maze': () => house(-1450, -330),
      'fh-maze-dark': () => house(-1795, 390),
      'fh-rotunda': () => house(0, -100),
      'fh-corridor': () => house(1450, -420),
      'fh-gallery': () => house(-1300, -1780),
      'fh-chamber': () => house(950, -1640),
      // the Boardwalk, region by region (D-68)
      'bw-plaza': () => shore(0, -470),
      'bw-arcade-row': () => shore(-1300, -560),
      'bw-coaster': () => shore(3300, -420),
      'bw-wharf-gate': () => shore(-2900, -420),
      'bw-beach': () => shore(300, 420),
      'bw-shore': () => shore(1200, 980),
      'bw-pier': () => shore(-2900, 1700),
      'bw-pier-end': () => shore(-2900, 2650),
      'bw-arcade': () => shore(-1300, -1150),
      'bw-giftshop': () => shore(1900, -1120),
      'bw-wheel': () => shore(300, -1650),
      // the Boardwalk's bosses (D-68), woken next to the player and a few seconds into the fight
      'bw-boss-barker': () => { shore(-400, -500, 20); api.spawnBoss('barker', 0, -300); api.advance(7); },
      'bw-boss-captain': () => { const g = shore(600, 0, 20); g.player.y = g.player.py = shoreY(600) - 180; api.spawnBoss('drowned_captain', 0, 260); api.advance(8); },
      'bw-boss-ride': () => { shore(1100, 400, 20); api.spawnBoss('last_ride', 0, -380); api.advance(8); },
      'bw-boss-leviathan': () => { const g = shore(-600, 0, 20); g.player.y = g.player.py = shoreY(-600) - 220; api.spawnBoss('leviathan', 0, 300); api.advance(7); },
      'bw-boss-commodore': () => { shore(-2900, 2500, 20); api.spawnBoss('commodore', 0, -320); api.advance(7); },
      'bw-bestiary': bestiary,
      // Summer's End in the world (D-68): the chain set to a stage, the player stood where it happens
      'bw-egg-shop': () => egg(1900, -1180, (c) => { c.stage = 2; c.photoSeen = true; }),
      'bw-egg-games': () => egg(-1150, -1300, (c) => { c.stage = 3; }),
      'bw-egg-wheel': () => egg(300, -1700, (c) => { c.stage = 3; }),
      'bw-egg-wreck': () => egg(1300, 1180, (c) => { c.stage = 4; }, true),
      'bw-egg-pier': () => egg(-2600, 2600, (c) => { c.stage = 7; c.lit = 1; }),
      'bw-egg-bell': () => egg(-2200, 1700, (c) => { c.stage = 9; c.retreat = 1; c.bellT = 12; }),
      'bw-rising': rising,
      /** the midway's crowd on the promenade, the undertow's on the beach: the new enemies fighting */
      'bw-midway-combat': () => melee(-600, -480, { drowned: 8, ticket_taker: 4, taffy_horror: 3, arcade_automaton: 4, evil_clown: 4, shore_crawler: 5 }),
      'bw-beach-combat': () => melee(1200, 700, { coaster_wraith: 3, barnacle_brute: 3, lantern_angler: 3, prize_collector: 2, tidecaller: 2, drowned: 6 }),
      /** the prize wheel mid-spin, and as it lands */
      'prize-wheel': () => wheel(80),
      'prize-wheel-landed': () => wheel(330),
    };
    (window as any).__THREE_GAME_TEST_HOOKS__ = {
      seed(n: number) { seed = n | 0; },
      async setState(name: string) {
        const enter = STATES[name];
        if (!enter) throw new Error(`Unknown test state: ${name}`);
        enter();
        freeze();
        app.renderer.snapCamera(app.game!.player.x, app.game!.player.y);
        return { state: name };
      },
      setPausedForScreenshot(on: boolean) { app.overlayPause = on; },
      hideDebugUi() { panel.classList.add('hidden'); },
      states: Object.keys(STATES),
    };
    Object.defineProperty(window, '__THREE_GAME_DIAGNOSTICS__', {
      configurable: true,
      get: () => {
        const g = app.game;
        const info = app.renderer.renderer.info;
        return {
          frame: info.render.frame,
          state: g ? g.phase : 'menu',
          time: g ? +g.time.toFixed(2) : 0,
          player: g ? { x: Math.round(g.player.x), y: Math.round(g.player.y) } : null,
          enemies: g ? g.active.length : 0,
          renderer: { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures },
        };
      },
    });
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
