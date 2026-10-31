// In-run HUD (doc 02 §8): XP marquee bar, level stub, moon→sun clock, Act name, HP bar, weapon /
// passive tray, boss bar with phase segments, banners, boss warnings, toasts, coach marks, and the
// level-up draft + chest reveal overlays.

import { ACT_NAMES, DAWN_TIME } from '../data/waves';
import { BOSS_MAP } from '../data/bosses';
import { PASSIVES, WEAPONS } from '../data/weapons';
import { EVENTS } from '../data/events';
import type { Assets } from '../render/assets';
import type { Game } from '../sim/game';
import type { DraftOption } from '../sim/draft';
import { readyEvolutions } from '../sim/draft';
import type { UnreflectedChain } from '../sim/quest/unreflected';
import { FocusNav, fmtTime, h } from './dom';

/** Player colours for UI (Player 1 lamp-gold, 2 ghost-teal, 3 rose, 4 lime, 5 violet, 6 tangerine); match PLAYER_COLS and `.p1`…`.p6` in style.css. */
export const PLAYER_CSS = ['#ffd27a', '#8af4ff', '#ff8fb0', '#a8ff7a', '#c7a2ff', '#ffb066'];

/** The screen the HUD draws over: its size and a world → screen projection (`h`: height above the floor). */
export interface HudScreen {
  w: number;
  h: number;
  toScreen: (x: number, y: number, h?: number) => { x: number; y: number };
}

/** How high each boss's overhead bar floats (world units above its feet; D-65). */
const BAR_H: Record<string, number> = {
  carnival_tent: 330, ferris_wheel: 300, puppet_king: 320, ringmaster: 250, calliope: 330,
  crooked_twins: 360, looking_glass: 330, stringmistress: 300, proprietor: 300, unreflected: 330,
};
/** A chest arrow (points along +x; rotated toward its chest). */
const ARROW_SVG = '<svg viewBox="0 0 24 24"><path d="M3 4 L21 12 L3 20 L8 12 Z" fill="#f2c14e" stroke="#17110e" stroke-width="2.4" stroke-linejoin="round"/></svg>';

/** What the co-op layer of the HUD shows (set by the app every frame during an online run). */
export interface CoopHud {
  /** this machine's player slot */
  local: number;
  /** players who dropped and are reconnecting */
  gone?: number[];
  /** round-trip latency to the other machine (ms) */
  ping?: number;
  /** multi-line diagnostics text, or null when the panel is closed */
  diag?: string | null;
  /** a waiting note (partner choosing, paused, reconnecting) with an optional action */
  status?: { text: string; action?: { label: string; fn: () => void } } | null;
}

export class Hud {
  root: HTMLDivElement;
  private xpFill: HTMLDivElement;
  private lvl: HTMLDivElement;
  private time: HTMLDivElement;
  private sun: HTMLElement;
  private act: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private hpGhost: HTMLDivElement;
  private hpTxt: HTMLDivElement;
  private hpWrap: HTMLDivElement;
  private extras: HTMLDivElement;
  private tray: HTMLDivElement;
  private statsR: HTMLDivElement;
  private boss: HTMLDivElement;
  private toast: HTMLDivElement;
  private bannerEl: HTMLDivElement | null = null;
  private bannerT = 0;
  private warnEl: HTMLDivElement | null = null;
  private coachEl: HTMLDivElement | null = null;
  private coachT = 0;
  private fpsEl: HTMLDivElement;
  private preview: HTMLDivElement;
  private trayKey = '';
  private lastHp = -1;
  private bossKey = '';
  private indicators: HTMLDivElement;
  private partner: HTMLDivElement;
  private whispers: HTMLDivElement;
  private tags: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private pingEl: HTMLDivElement;
  private diagEl: HTMLDivElement;
  private statusKey = '';
  private partnerKey = '';
  coopInfo: CoopHud | null = null;
  showFps = false;
  /** numbers for the damage you take (follows the damage-numbers setting; D-65) */
  showHurt = true;
  /** every whisper is also written into the chat log (D-65) */
  onWhisper: ((text: string, sub?: string) => void) | null = null;
  private splats: HTMLDivElement;
  private hurtAcc = 0;
  private hurtT = 0;
  private barLayer: HTMLDivElement;
  private bars = new Map<number, { el: HTMLDivElement; fill: HTMLElement; key: string }>();
  private arrowLayer: HTMLDivElement;
  private arrows: HTMLDivElement[] = [];
  private partyH = 0;
  /** the interact prompt over something the local player can use (D-67) */
  private promptEl: HTMLDivElement;
  private promptKey = '';
  /** the prompt names the pad's button instead of the key (set by the app from the input in use) */
  padKeys = false;

  constructor(private assets: Assets) {
    this.root = h('div', { class: 'hud' });
    const xp = h('div', { class: 'xp' }, (this.xpFill = h('div', { class: 'fill' })), h('div', { class: 'bulbs' }));
    this.lvl = h('div', { class: 'lvl' }, '1');
    this.preview = h('div', { class: 'rarity-preview hidden' });
    this.sun = h('i');
    this.time = h('div', { class: 'time' }, '0:00');
    const clock = h('div', { class: 'clock' }, h('div', { class: 'moon' }, this.sun), this.time);
    this.act = h('div', { class: 'act' }, ACT_NAMES[0]);
    this.hpFill = h('div', { class: 'fill' });
    this.hpGhost = h('div', { class: 'ghost' });
    this.hpTxt = h('div', { class: 'txt' }, '100 / 100');
    this.extras = h('div', { class: 'extras' });
    this.hpWrap = h('div', { class: 'hp' }, h('div', { class: 'portrait' }, h('img', { alt: '' })), this.extras, h('div', { class: 'bar' }, this.hpGhost, this.hpFill, this.hpTxt));
    this.tray = h('div', { class: 'tray' });
    this.statsR = h('div', { class: 'stats-right' });
    this.boss = h('div', { class: 'boss hidden' });
    this.toast = h('div', { class: 'toast' });
    this.fpsEl = h('div', { class: 'fps hidden' });
    this.indicators = h('div', { class: 'passthrough' });
    this.partner = h('div', { class: 'coop-party hidden' });
    this.whispers = h('div', { class: 'whispers' });
    this.tags = h('div', { class: 'passthrough' });
    this.statusEl = h('div', { class: 'coop-status hidden' });
    this.pingEl = h('div', { class: 'net-ping hidden' });
    this.diagEl = h('div', { class: 'net-diag hidden' });
    this.splats = h('div', { class: 'passthrough' });
    this.barLayer = h('div', { class: 'passthrough' });
    this.arrowLayer = h('div', { class: 'passthrough' });
    this.promptEl = h('div', { class: 'quest-prompt hidden' });
    this.root.append(this.barLayer, this.arrowLayer, this.splats, this.promptEl);
    this.root.append(xp, this.lvl, this.preview, clock, this.act, this.hpWrap, this.tray, this.statsR, this.boss, this.toast, this.fpsEl, this.indicators, this.partner, this.tags, this.statusEl, this.pingEl, this.diagEl);
  }

  setPortrait(charId: string): void {
    (this.hpWrap.querySelector('.portrait img') as HTMLImageElement).src = this.assets.portrait(charId);
    this.trayKey = '';
    this.bossKey = '';
  }

  update(g: Game, fps: number, dt: number, screen: HudScreen): void {
    const p = g.player;
    this.xpFill.style.width = `${Math.min(100, (g.xp / g.xpToNext) * 100)}%`;
    this.lvl.textContent = String(g.level);
    const t = Math.min(g.time, DAWN_TIME);
    this.time.textContent = g.endless ? fmtTime(g.time) : fmtTime(t);
    this.time.classList.toggle('stalled', g.stalled);
    this.sun.style.transform = `translateY(${100 - Math.min(1, t / DAWN_TIME) * 100}%)`;
    this.act.textContent = g.endless ? 'LOCKED IN — Endless' : g.victoryLap ? 'Victory Lap — Dawn approaches' : ACT_NAMES[g.act - 1];
    // HP
    const maxHp = p.stats.maxHp();
    const pct = Math.max(0, Math.min(100, (p.hp / maxHp) * 100));
    this.hpFill.style.width = `${pct}%`;
    this.hpGhost.style.width = `${pct}%`;
    this.hpTxt.textContent = `${Math.max(0, Math.ceil(p.hp))} / ${Math.round(maxHp)}`;
    if (this.lastHp >= 0 && p.hp < this.lastHp - 0.01) {
      this.hpWrap.classList.remove('flash');
      void this.hpWrap.offsetWidth;
      this.hpWrap.classList.add('flash');
      this.hurtAcc += this.lastHp - p.hp;
    }
    this.lastHp = p.hp;
    // the damage you take pops off your character as a number; hits within a moment add up (D-65)
    this.hurtT -= dt;
    if (this.hurtAcc >= 0.5 && this.hurtT <= 0) {
      if (this.showHurt) this.popHurt(screen, p.x, p.y, this.hurtAcc, this.hurtAcc >= maxHp * 0.15);
      this.hurtAcc = 0;
      this.hurtT = 0.16;
    }
    const ex: string[] = [];
    if (p.stats.revives > 0) ex.push(`🎈×${p.stats.revives}`);
    if (p.char.quirk === 'balloon_shield') ex.push(p.shieldReady ? 'Shield ✦' : `Shield ${Math.ceil(p.shieldT)}s`);
    if (p.rerolls > 0) ex.push(`Reroll ${p.rerolls}`);
    if (p.banishes > 0) ex.push(`Banish ${p.banishes}`);
    const exTxt = ex.join(' · ');
    if (this.extras.textContent !== exTxt) this.extras.textContent = exTxt;
    // Fortune Teller rarity preview
    if (p.char.quirk === 'fortune') {
      this.preview.classList.remove('hidden');
      const r = g.nextDraftRarity;
      this.preview.textContent = `Next draft: ${r}`;
      this.preview.style.background = r === 'evolution' ? '#f2c14e' : r === 'rare' ? '#9a3aa0' : r === 'uncommon' ? '#3a9a5a' : '#5a7a9a';
      this.preview.style.color = r === 'evolution' ? '#17110e' : '#f7eedb';
    } else this.preview.classList.add('hidden');
    // tray (rebuilt only when the build changes)
    const ready = new Set(readyEvolutions(g));
    const slots = g.slots;
    const key = `${slots.weapons}/${slots.passives}|` + g.weapons.list.map((w) => `${w.def.id}:${w.level}${ready.has(w.def.id) ? '!' : ''}`).join(',') + '|' + [...p.passives].map(([id, l]) => `${id}:${l}`).join(',');
    if (key !== this.trayKey) {
      this.trayKey = key;
      const wg = h('div', { class: 'group' });
      for (let i = 0; i < slots.weapons; i++) {
        const w = g.weapons.list[i];
        if (!w) {
          wg.append(h('div', { class: 'slot empty' }));
          continue;
        }
        const max = w.level >= w.def.maxLevel;
        const lv = max ? (w.def.isEvolution ? '✦MAX' : 'MAX') : w.def.isEvolution ? `✦${w.level}` : String(w.level);
        wg.append(h('div', { class: `slot${ready.has(w.def.id) ? ' evo-ready' : ''}`, title: w.def.name }, h('img', { src: this.assets.weaponIcon(w.def.id), alt: w.def.name }), h('span', { class: `lv${max ? ' max' : ''}${w.def.isEvolution ? ' evo' : ''}` }, lv)));
      }
      const pg = h('div', { class: 'group' });
      const ps = [...p.passives];
      for (let i = 0; i < slots.passives; i++) {
        const e = ps[i];
        if (!e) {
          pg.append(h('div', { class: 'slot empty' }));
          continue;
        }
        const d = PASSIVES[e[0]];
        pg.append(h('div', { class: 'slot', title: d.name }, h('img', { src: this.assets.passiveIcon(e[0]), alt: d.name }), h('span', { class: `lv${e[1] >= d.maxLevel ? ' max' : ''}` }, e[1] >= d.maxLevel ? 'MAX' : String(e[1]))));
      }
      this.tray.replaceChildren(wg, pg);
    }
    this.statsR.replaceChildren(h('div', {}, `☠ ${g.kills.toLocaleString('en-US')}`), h('div', {}, `🎪 ${g.diff.name}${g.cfg.curse ? ' · Cursed' : ''}${g.cfg.daily ? ' · Daily' : ''}`));
    // boss bar
    const b = g.bosses.find((x) => x.awake && !x.dead && x.introDone);
    if (b) {
      const bk = b.def.id + (b.encore ? 'e' : '');
      if (bk !== this.bossKey) {
        this.bossKey = bk;
        const segs = b.def.phases.slice(1).map((ph) => h('div', { class: 'seg', style: { left: `${ph.at * 100}%` } }));
        this.boss.replaceChildren(h('div', { class: 'name' }, b.encore ? `Encore! ${b.def.name}` : b.def.name), h('div', { class: 'phase' }), h('div', { class: 'bar' }, h('div', { class: 'fill', style: { background: `linear-gradient(180deg, ${b.def.barColor}, #7a0a14)` } }), ...segs));
      }
      this.boss.classList.remove('hidden');
      this.root.classList.add('boss-on');
      this.boss.classList.toggle('enraged', b.enraged);
      (this.boss.querySelector('.fill') as HTMLDivElement).style.width = `${(b.hp / b.maxHp) * 100}%`;
      (this.boss.querySelector('.phase') as HTMLDivElement).textContent = `${b.def.phases[b.phase].name}${b.enraged ? ' — ENCORE!' : ''}`;
    } else {
      this.boss.classList.add('hidden');
      this.root.classList.remove('boss-on');
      this.bossKey = '';
    }
    // banners / coach timers
    if (this.bannerEl) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) {
        this.bannerEl.remove();
        this.bannerEl = null;
      }
    }
    if (this.coachEl) {
      this.coachT -= dt;
      if (this.coachT <= 0) {
        this.coachEl.remove();
        this.coachEl = null;
      }
    }
    this.fpsEl.classList.toggle('hidden', !this.showFps);
    if (this.showFps) this.fpsEl.textContent = `${fps.toFixed(0)} fps · ${g.active.length} enemies · ${g.projs.reduce((n, q) => n + (q.alive ? 1 : 0), 0)} proj`;
    this.updateIndicators(g, screen);
    this.updateCoop(g, screen);
    this.updateBars(g, screen);
    this.updateChestArrows(g, screen);
    this.updatePrompt(g, screen);
  }

  /** "E  Turn the mirror": floats over whatever the local player could use right now (D-67). */
  private updatePrompt(g: Game, screen: HudScreen): void {
    const p = g.player;
    const it = g.phase === 'play' && g.isUp(p) ? g.quests?.get<UnreflectedChain>('unreflected')?.interaction(p.x, p.y) ?? null : null;
    const key = it ? `${it.kind}${it.i}|${it.label}|${this.padKeys}` : '';
    if (key !== this.promptKey) {
      this.promptKey = key;
      this.promptEl.classList.toggle('hidden', !it);
      if (it) this.promptEl.replaceChildren(h('span', { class: 'key' }, this.padKeys ? 'A' : 'E'), h('span', {}, it.label));
    }
    if (!it) return;
    const s = screen.toScreen(it.x, it.y, 150);
    this.promptEl.style.left = `${Math.max(90, Math.min(screen.w - 90, s.x))}px`;
    this.promptEl.style.top = `${Math.max(70, Math.min(screen.h - 150, s.y))}px`;
  }

  /** How far up from the bottom the chat box sits: above the health bar, its portrait and any party cards. */
  chatBottom(): number {
    return 118 + (this.partner.classList.contains('hidden') ? 0 : this.partyH + 8);
  }

  private popHurt(screen: HudScreen, x: number, y: number, amount: number, big: boolean): void {
    const s = screen.toScreen(x, y, 95);
    const el = h('div', { class: `hurt-num${big ? ' big' : ''}`, style: { left: `${s.x + (Math.random() - 0.5) * 28}px`, top: `${s.y}px` } }, `-${Math.max(1, Math.round(amount))}`);
    this.splats.append(el);
    while (this.splats.childElementCount > 10) this.splats.firstElementChild!.remove();
    setTimeout(() => el.remove(), 1000);
  }

  /** Health bars floating over the awake bosses and the minibosses (D-65). */
  private updateBars(g: Game, screen: HudScreen): void {
    const seen = new Set<number>();
    const put = (uid: number, x: number, y: number, height: number, frac: number, color: string, name: string | null, segs: number[]) => {
      const s = screen.toScreen(x, y, height);
      seen.add(uid);
      const key = `${name ?? ''}|${color}|${segs.join(',')}`;
      let b = this.bars.get(uid);
      if (!b || b.key !== key) {
        b?.el.remove();
        const fill = h('i', { style: { background: `linear-gradient(180deg, ${color}, #7a0a14)` } });
        const bar = h('div', { class: 'b' }, fill, ...segs.map((at) => h('span', { class: 'seg', style: { left: `${at * 100}%` } })));
        const el = h('div', { class: `ohbar ${name ? 'mini' : 'boss'}` }, name ? h('span', { class: 'nm' }, name) : null, bar);
        this.barLayer.append(el);
        b = { el, fill, key };
        this.bars.set(uid, b);
      }
      const on = s.x > -100 && s.x < screen.w + 100 && s.y > 20 && s.y < screen.h + 60;
      b.el.style.display = on ? '' : 'none';
      if (!on) return;
      b.el.style.left = `${s.x}px`;
      b.el.style.top = `${s.y}px`;
      b.fill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    };
    for (const b of g.bosses) {
      if (!b.awake || !b.introDone || b.dead || b.removed) continue;
      const tall = b.def.id === 'ringmaster' && (b as unknown as { demon: number }).demon > 0.5 ? 340 : BAR_H[b.def.id] ?? 280;
      put(b.uid, b.x, b.y, tall, b.hp / Math.max(1e-6, b.maxHp), b.def.barColor, null, b.def.phases.slice(1).map((ph) => ph.at));
    }
    for (const e of g.active) {
      if (!e.alive || e.def.id !== g.map.miniboss) continue;
      put(e.uid, e.x, e.y, 200 * e.scale, e.hp / Math.max(1e-6, e.maxHp), '#ff5a3a', e.def.name, []);
    }
    for (const [uid, b] of this.bars) {
      if (seen.has(uid)) continue;
      b.el.remove();
      this.bars.delete(uid);
    }
  }

  /** Small arrows circling your character toward the nearest chests (D-65); gone once you're on top of one. */
  private updateChestArrows(g: Game, screen: HudScreen): void {
    const p = g.player;
    const list = g.pickups
      .filter((pk) => pk.alive && pk.kind === 'chest')
      .map((pk) => ({ pk, d: Math.hypot(pk.x - p.x, pk.y - p.y) }))
      .filter((c) => c.d > 170)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    while (this.arrows.length < list.length) {
      const el = h('div', { class: 'chest-arrow', html: ARROW_SVG });
      this.arrowLayer.append(el);
      this.arrows.push(el);
    }
    const ps = screen.toScreen(p.x, p.y, 40);
    this.arrows.forEach((el, i) => {
      const c = list[i];
      el.style.display = c ? '' : 'none';
      if (!c) return;
      const s = screen.toScreen(c.pk.x, c.pk.y, 20);
      const a = Math.atan2(s.y - ps.y, s.x - ps.x);
      const R = 78 + i * 10;
      el.style.left = `${ps.x + Math.cos(a) * R}px`;
      el.style.top = `${ps.y + Math.sin(a) * R}px`;
      el.style.transform = `translate(-50%, -50%) rotate(${a}rad)`;
      el.style.opacity = String(i === 0 ? 1 : 0.7);
    });
  }

  /** Online co-op: the partner's card, name tags (or edge arrows), waiting notes, latency. */
  private updateCoop(g: Game, screen: HudScreen): void {
    const info = this.coopInfo;
    const on = !!info && g.players.length > 1;
    this.partner.classList.toggle('hidden', !on);
    this.pingEl.classList.toggle('hidden', !on || info?.ping === undefined);
    this.diagEl.classList.toggle('hidden', !on || !info?.diag);
    if (!on || !info) {
      if (this.tags.childElementCount) this.tags.replaceChildren();
      this.statusEl.classList.add('hidden');
      this.statusKey = '';
      return;
    }
    // a card per teammate: portrait, health, and what is happening to them
    const others = g.players.filter((q) => q.index !== info.local);
    const cards = others.map((q) => {
      const gone = !!info.gone?.includes(q.index);
      const pct = Math.max(0, Math.min(100, (q.hp / q.stats.maxHp()) * 100));
      const st = gone ? 'Reconnecting…' : q.downed ? (others.length > 2 ? 'In a coffin!' : 'In a coffin — stand by to revive!') : q.dead ? 'Down' : '';
      return { q, gone, pct, st };
    });
    const pk = cards.map((c) => `${c.q.index}|${c.q.char.id}|${c.q.name}|${Math.round(c.pct)}|${c.st}`).join(';');
    if (pk !== this.partnerKey) {
      this.partnerKey = pk;
      this.partner.classList.toggle('many', others.length > 2);
      this.partner.replaceChildren(...cards.map(({ q, gone, pct, st }) =>
        h('div', { class: `coop-partner p${q.index + 1}${q.downed || gone ? ' down' : ''}` },
          h('img', { src: this.assets.portrait(q.char.id), alt: '' }),
          h('div', {}, h('div', {}, q.name), h('div', { class: 'bar' }, h('i', { style: { width: `${pct}%` } })), st ? h('div', { class: 'st' }, st) : null),
        )));
      this.partyH = this.partner.offsetHeight;
    }
    // name tags over the other players, or an arrow at the screen edge when they are off-screen
    const kids: HTMLElement[] = [];
    for (const q of g.players) {
      if (q.index === info.local) continue;
      const s = screen.toScreen(q.x, q.y);
      const cls = `p${q.index + 1}`;
      if (s.x > 0 && s.x < screen.w && s.y > 60 && s.y < screen.h) kids.push(h('div', { class: `coop-tag ${cls}`, style: { left: `${s.x}px`, top: `${s.y - 74}px` } }, q.downed ? `⚰ ${q.name}` : q.name));
      else {
        const m = 30;
        const x = Math.max(m, Math.min(screen.w - m, s.x)), y = Math.max(m + 100, Math.min(screen.h - m - 70, s.y));
        kids.push(h('div', { class: 'indicator', style: { left: `${x}px`, top: `${y}px` } }, h('i', { style: { background: PLAYER_CSS[q.index % PLAYER_CSS.length], color: '#17110e' } }, q.downed ? '⚰' : q.name.slice(0, 1).toUpperCase())));
      }
    }
    this.tags.replaceChildren(...kids);
    const sk = info.status ? info.status.text + (info.status.action?.label ?? '') : '';
    if (sk !== this.statusKey) {
      this.statusKey = sk;
      this.statusEl.classList.toggle('hidden', !info.status);
      if (info.status) {
        const a = info.status.action;
        this.statusEl.replaceChildren(h('span', {}, info.status.text), ...(a ? [h('button', { class: 'btn small', onclick: a.fn }, a.label)] : []));
      }
    }
    if (info.ping !== undefined) {
      this.pingEl.textContent = `● ${Math.round(info.ping)} ms`;
      this.pingEl.classList.toggle('bad', info.ping > 160);
    }
    if (info.diag) this.diagEl.textContent = info.diag;
  }

  /** Edge arrows pointing at off-screen chests, food and bosses. */
  private updateIndicators(g: Game, screen: HudScreen): void {
    const marks: { x: number; y: number; col: string; txt: string }[] = [];
    for (const pk of g.pickups) {
      if (!pk.alive) continue;
      if (pk.kind === 'chest') marks.push({ x: pk.x, y: pk.y, col: '#f2c14e', txt: '★' });
      else if (pk.kind === 'food') marks.push({ x: pk.x, y: pk.y, col: '#6fe07a', txt: '+' });
      else if (pk.kind === 'golden') marks.push({ x: pk.x, y: pk.y, col: '#ffe98a', txt: '$' });
    }
    for (const b of g.bosses) if (b.awake && !b.dead) marks.push({ x: b.x, y: b.y, col: '#ff4a2a', txt: '!' });
    const kids: HTMLElement[] = [];
    const m = 30;
    for (const mk of marks) {
      const s = screen.toScreen(mk.x, mk.y);
      if (s.x > 0 && s.x < screen.w && s.y > 0 && s.y < screen.h) continue;
      const x = Math.max(m, Math.min(screen.w - m, s.x)), y = Math.max(m + 100, Math.min(screen.h - m - 70, s.y));
      kids.push(h('div', { class: 'indicator', style: { left: `${x}px`, top: `${y}px` } }, h('i', { style: { background: mk.col, color: '#17110e' } }, mk.txt)));
    }
    if (kids.length || this.indicators.childElementCount) this.indicators.replaceChildren(...kids);
  }

  banner(text: string, sub?: string, style = '', dur = 2.6): void {
    this.bannerEl?.remove();
    this.bannerEl = h('div', { class: `banner ${style}` }, h('div', { class: 't' }, text), sub ? h('div', { class: 's' }, sub) : null);
    this.bannerT = dur;
    this.root.append(this.bannerEl);
  }

  /**
   * A whisper (secret-quest feedback): ghostly italic lines that rise and fade near the top of the
   * screen — enough to notice that something happened, without spelling out what to do next.
   */
  whisper(text: string, sub?: string, dur = 4.2): void {
    // whispers that arrive together stack instead of printing over each other; a repeat of one still
    // showing is dropped, and at most three are on screen at once
    if (!this.whispers.isConnected) this.root.append(this.whispers);
    const key = `${text}|${sub ?? ''}`;
    if ([...this.whispers.children].some((c) => (c as HTMLElement).dataset.key === key)) return;
    this.onWhisper?.(text, sub);
    while (this.whispers.childElementCount >= 3) this.whispers.firstElementChild!.remove();
    const el = h('div', { class: 'whisper', 'data-key': key }, h('div', { class: 't' }, text), sub ? h('div', { class: 's' }, sub) : null);
    el.style.animationDuration = `${dur}s`;
    this.whispers.append(el);
    setTimeout(() => el.remove(), dur * 1000);
  }

  warning(bossId: string, reducedFlash: boolean): void {
    this.warnEl?.remove();
    const b = BOSS_MAP[bossId as keyof typeof BOSS_MAP];
    this.root.classList.toggle('reduced-flash', reducedFlash);
    this.warnEl = h('div', { class: 'warning' }, h('img', { src: this.assets.bossImage(bossId), alt: '' }), h('div', { class: 't' }, 'WARNING!'), h('div', { class: 's' }, b ? `${b.name} — ${b.title}` : ''));
    this.root.append(this.warnEl);
    const el = this.warnEl;
    setTimeout(() => el.remove(), 3000);
  }

  eventBanner(id: string): void {
    const def = EVENTS[id as keyof typeof EVENTS];
    this.banner(def?.banner ?? id, def?.desc, 'gold', 3);
  }

  toastMsg(msg: string, ms = 2600): void {
    const el = h('div', {}, msg);
    this.toast.append(el);
    setTimeout(() => el.remove(), ms);
    while (this.toast.childElementCount > 5) this.toast.firstElementChild?.remove();
  }

  coach(html: string, dur = 6): void {
    this.coachEl?.remove();
    this.coachEl = h('div', { class: 'coach', html });
    this.coachT = dur;
    this.root.append(this.coachEl);
  }

  dawnTitle(): HTMLElement {
    const el = h('div', { class: 'dawn-title' }, h('div', { class: 't' }, 'DAWN'), h('div', { class: 's' }, 'The gates groan open. You survived the night.'));
    this.root.append(el);
    return el;
  }

  reset(): void {
    this.bannerEl?.remove();
    this.bannerEl = null;
    this.warnEl?.remove();
    this.coachEl?.remove();
    this.coachEl = null;
    this.toast.replaceChildren();
    this.root.querySelectorAll('.dawn-title').forEach((e) => e.remove());
    this.lastHp = -1;
    this.trayKey = '';
    this.bossKey = '';
  }
}

// ===================================================================== draft overlay
export class DraftView {
  root: HTMLDivElement;
  nav: FocusNav;
  constructor(private assets: Assets, private onPick: (i: number) => void, private onReroll: () => void, private onBanish: (i: number) => void, private onSkip: () => void) {
    this.root = h('div', { class: 'screen draft hidden' });
    this.nav = new FocusNav(this.root);
  }

  private banishMode = false;

  show(g: Game, options: DraftOption[]): void {
    this.root.classList.remove('hidden');
    const p = g.player;
    const cards = options.map((o, i) => {
      const icon = o.kind === 'passive' ? this.assets.passiveIcon(o.refId) : o.kind === 'heal' ? this.assets.passiveIcon('funnel_cake') : o.kind === 'voucher' ? this.assets.passiveIcon('coin_purse') : this.assets.weaponIcon(o.kind === 'evolution' ? WEAPONS[o.refId].evolvesTo! : o.refId);
      const evoLv = o.kind === 'level_weapon' && WEAPONS[o.refId]?.isEvolution;
      const lvlTxt = o.kind === 'evolution' ? 'EVOLUTION!' : o.kind === 'new_weapon' ? 'New weapon' : o.kind === 'passive' ? (o.isNew ? 'New passive' : `Level ${o.level}`) : o.kind === 'heal' ? 'A small mercy' : o.kind === 'voucher' ? 'Permanent currency' : `${evoLv ? '✦ Evo Level' : 'Level'} ${o.level}${o.level === 8 ? ' — MAX' : ''}`;
      let hint = '';
      if (o.kind === 'new_weapon' || o.kind === 'level_weapon') {
        const d = WEAPONS[o.refId];
        if (d.evolvesTo && d.evoPassive) hint = `Lv8 + ${PASSIVES[d.evoPassive].name} → ${WEAPONS[d.evolvesTo].name}`;
      } else if (o.kind === 'passive') {
        const evos = Object.values(WEAPONS).filter((w) => w.evoPassive === o.refId && g.weapons.has(w.id));
        if (evos.length) hint = `Evolves: ${evos.map((w) => WEAPONS[w.evolvesTo!].name).join(', ')}`;
      } else if (o.kind === 'evolution') hint = `Replaces ${WEAPONS[o.refId].name}`;
      const rarityName = o.rarity === 'evolution' ? '✦ EVOLUTION ✦' : o.rarity.toUpperCase();
      return h('div', { class: `card ${o.rarity}${o.kind === 'voucher' ? ' voucher' : ''}${o.disabled ? ' disabled' : ''}`, 'data-nav': o.disabled ? undefined : '', 'data-default': i === 0 ? '' : undefined, onclick: () => (o.disabled ? undefined : this.banishMode ? this.doBanish(i) : this.onPick(i)) },
        h('div', { class: 'rib' }, rarityName),
        o.isNew && o.kind !== 'evolution' ? h('div', { class: 'new' }, 'NEW!') : null,
        h('img', { src: icon, alt: '' }),
        h('div', { class: 'nm' }, o.title),
        h('div', { class: 'lvl' }, lvlTxt),
        h('div', { class: 'desc' }, o.desc),
        hint ? h('div', { class: 'evo-hint' }, hint) : null,
        h('div', { class: 'key' }, String(i + 1)));
    });
    // big, readable actions (D-61): an icon, what it does, how many are left, and its key
    const act = (cls: string, ico: string, label: string, sub: string, count: number | null, key: string, on: () => void) =>
      h('button', { class: `btn act ${cls}`, 'data-nav': '', onclick: on },
        h('span', { class: 'ico' }, ico),
        h('span', { class: 'lbl' }, h('b', {}, label), h('small', {}, sub)),
        count !== null ? h('span', { class: 'count', title: 'left tonight' }, String(count)) : null,
        h('span', { class: 'kbd' }, key));
    const actions = h('div', { class: 'draft-actions' });
    if (p.rerolls > 0) actions.append(act('purple reroll', '↻', 'Reroll', 'deal a fresh hand', p.rerolls, 'R', () => this.onReroll()));
    if (p.banishes > 0) actions.append(act(`red banish${this.banishMode ? ' on' : ''}`, '⊘', ...this.banishText(), p.banishes, 'B', () => this.toggleBanish()));
    if (p.canSkip) actions.append(act('skip', '♥', 'Skip', 'take +10 HP instead', null, 'X', () => this.onSkip()));
    this.root.classList.toggle('banishing', this.banishMode);
    this.root.replaceChildren(
      h('h2', { class: 'title-text' }, 'LEVEL UP!'),
      h('div', { class: 'lvl-sub' }, `Level ${g.level} — pick your prize`),
      h('div', { class: 'cards' }, ...cards),
      actions,
    );
    this.nav.current = null;
    this.nav.ensure();
  }

  private banishText(): [string, string] {
    return this.banishMode ? ['Pick a card', 'it leaves for the night'] : ['Banish', 'strike a card for the night'];
  }

  toggleBanish(): void {
    this.banishMode = !this.banishMode;
    this.root.classList.toggle('banishing', this.banishMode);
    const b = this.root.querySelector('.draft-actions .banish');
    b?.classList.toggle('on', this.banishMode);
    const [label, sub] = this.banishText();
    b?.querySelector('.lbl')?.replaceChildren(h('b', {}, label), h('small', {}, sub));
  }

  private doBanish(i: number): void {
    this.banishMode = false;
    this.onBanish(i);
  }

  hide(): void {
    this.banishMode = false;
    this.root.classList.remove('banishing');
    this.root.classList.add('hidden');
  }
  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }
}

export class ChestView {
  root: HTMLDivElement;
  private t = 0;
  constructor(private assets: Assets, private onClose: () => void) {
    this.root = h('div', { class: 'screen chest-pop hidden' });
  }
  show(items: string[], evolution?: string): void {
    this.root.classList.remove('hidden');
    const list = h('div', { class: 'list' });
    items.forEach((txt, i) => {
      const evo = txt.startsWith('EVOLUTION');
      const wid = Object.values(WEAPONS).find((w) => txt.includes(w.name));
      const pid = Object.values(PASSIVES).find((p) => txt.includes(p.name));
      const img = evo && evolution ? this.assets.weaponIcon(evolution) : wid ? this.assets.weaponIcon(wid.id) : pid ? this.assets.passiveIcon(pid.id) : this.assets.passiveIcon('funnel_cake');
      list.append(h('div', { class: `item${evo ? ' evo' : ''}`, style: { animationDelay: `${0.25 + i * 0.32}s` } }, h('img', { src: img, alt: '' }), txt));
    });
    this.root.replaceChildren(h('h2', { class: 'title-text', style: { fontSize: '3em' } }, evolution ? 'EVOLUTION!' : 'PRIZE CHEST!'), list, h('div', { class: 'muted', style: { marginTop: '1.4em' } }, 'Press any button to continue'));
    this.t = 0.6 + items.length * 0.32;
    const close = () => {
      if (this.t > 0) return;
      this.onClose();
    };
    this.root.onclick = close;
  }
  update(dt: number): void {
    this.t -= dt;
  }
  canClose(): boolean {
    return this.t <= 0;
  }
  hide(): void {
    this.root.classList.add('hidden');
  }
  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }
}
