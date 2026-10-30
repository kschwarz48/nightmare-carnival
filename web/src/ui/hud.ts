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
import { FocusNav, fmtTime, h } from './dom';
import { MAX_PASSIVES, MAX_WEAPONS } from '../sim/weapons';

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
  showFps = false;

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
    this.root.append(xp, this.lvl, this.preview, clock, this.act, this.hpWrap, this.tray, this.statsR, this.boss, this.toast, this.fpsEl, this.indicators);
  }

  setPortrait(charId: string): void {
    (this.hpWrap.querySelector('.portrait img') as HTMLImageElement).src = this.assets.portrait(charId);
    this.trayKey = '';
    this.bossKey = '';
  }

  update(g: Game, fps: number, dt: number, screen: { w: number; h: number; toScreen: (x: number, y: number) => { x: number; y: number } }): void {
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
    }
    this.lastHp = p.hp;
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
    const key = g.weapons.list.map((w) => `${w.def.id}:${w.level}${ready.has(w.def.id) ? '!' : ''}`).join(',') + '|' + [...p.passives].map(([id, l]) => `${id}:${l}`).join(',');
    if (key !== this.trayKey) {
      this.trayKey = key;
      const wg = h('div', { class: 'group' });
      for (let i = 0; i < MAX_WEAPONS; i++) {
        const w = g.weapons.list[i];
        if (!w) {
          wg.append(h('div', { class: 'slot empty' }));
          continue;
        }
        const max = w.level >= w.def.maxLevel;
        wg.append(h('div', { class: `slot${ready.has(w.def.id) ? ' evo-ready' : ''}`, title: w.def.name }, h('img', { src: this.assets.weaponIcon(w.def.id), alt: w.def.name }), h('span', { class: `lv${max ? ' max' : ''}` }, w.def.isEvolution ? '✦' : max ? 'MAX' : String(w.level))));
      }
      const pg = h('div', { class: 'group' });
      const ps = [...p.passives];
      for (let i = 0; i < MAX_PASSIVES; i++) {
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
  }

  /** Edge arrows pointing at off-screen chests, food and bosses. */
  private updateIndicators(g: Game, screen: { w: number; h: number; toScreen: (x: number, y: number) => { x: number; y: number } }): void {
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
    const el = h('div', { class: 'whisper' }, h('div', { class: 't' }, text), sub ? h('div', { class: 's' }, sub) : null);
    el.style.animationDuration = `${dur}s`;
    this.root.append(el);
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
      const lvlTxt = o.kind === 'evolution' ? 'EVOLUTION!' : o.kind === 'new_weapon' ? 'New weapon' : o.kind === 'passive' ? (o.isNew ? 'New passive' : `Level ${o.level}`) : o.kind === 'heal' ? 'A small mercy' : o.kind === 'voucher' ? 'Permanent currency' : `Level ${o.level}${o.level === 8 ? ' — MAX' : ''}`;
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
    const actions = h('div', { class: 'draft-actions' });
    if (p.rerolls > 0) actions.append(h('button', { class: 'btn small purple', 'data-nav': '', onclick: () => this.onReroll() }, `Reroll (${p.rerolls}) `, h('span', { class: 'kbd' }, 'R')));
    if (p.banishes > 0) actions.append(h('button', { class: `btn small red${this.banishMode ? ' focus' : ''}`, 'data-nav': '', onclick: () => this.toggleBanish() }, this.banishMode ? 'Choose a card to banish…' : `Banish (${p.banishes}) `, h('span', { class: 'kbd' }, 'B')));
    if (p.canSkip) actions.append(h('button', { class: 'btn small', 'data-nav': '', onclick: () => this.onSkip() }, 'Skip (+10 HP) ', h('span', { class: 'kbd' }, 'X')));
    this.root.replaceChildren(
      h('h2', { class: 'title-text' }, 'LEVEL UP!'),
      h('div', { class: 'lvl-sub' }, `Level ${g.level} — pick your prize`),
      h('div', { class: 'cards' }, ...cards),
      actions,
    );
    this.nav.current = null;
    this.nav.ensure();
  }

  toggleBanish(): void {
    this.banishMode = !this.banishMode;
    this.root.querySelector('.draft-actions .btn.red')?.replaceChildren(this.banishMode ? 'Choose a card to banish…' : 'Banish ', h('span', { class: 'kbd' }, 'B'));
  }

  private doBanish(i: number): void {
    this.banishMode = false;
    this.onBanish(i);
  }

  hide(): void {
    this.banishMode = false;
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
