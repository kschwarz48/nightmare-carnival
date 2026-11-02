// In-run HUD (doc 02 §8): XP marquee bar, level stub, moon→sun clock, Act name, HP bar, weapon /
// passive tray, boss bar with phase segments, banners, boss warnings, toasts, coach marks, and the
// level-up draft + chest reveal overlays. D-85: the live Lost Tickets count, the damage meter
// (dmgMeter.ts) and, in co-op, the party frames (D-91: over the health bar).

import { ACT_NAMES, DAWN_TIME } from '../data/waves';
import { BOSS_MAP } from '../data/bosses';
import { PASSIVES, WEAPONS } from '../data/weapons';
import { EVENTS } from '../data/events';
import type { Assets } from '../render/assets';
import type { Game } from '../sim/game';
import type { Player } from '../sim/player';
import type { DraftOption } from '../sim/draft';
import { readyEvolutions } from '../sim/draft';
import { kitOf, passiveFeeds, recipeState, type Kit } from './recipes';
import { UR, type UnreflectedChain } from '../sim/quest/unreflected';
import { SE, type SummersEndChain } from '../sim/quest/summersEnd';
import { UNREFLECTED } from '../data/funhouse';
import { SUMMERS_END } from '../data/boardwalk';
import { FocusNav, fmtNum, fmtTime, h, uiZoom } from './dom';
import { DamageMeter } from './dmgMeter';
import { liveLt } from '../sim/meter';
import { CHARACTER_MAP } from '../data/characters';
import { PET_MAP } from '../data/pets';

/** Player colours for UI (Player 1 lamp-gold, 2 ghost-teal, 3 rose, 4 lime, 5 violet, 6 tangerine); match PLAYER_COLS and `.p1`…`.p6` in style.css. */
export const PLAYER_CSS = ['#ffd27a', '#8af4ff', '#ff8fb0', '#a8ff7a', '#c7a2ff', '#ffb066'];

/** The screen the HUD draws over: its size and a world → screen projection (`h`: height above the floor). */
export interface HudScreen {
  w: number;
  h: number;
  toScreen: (x: number, y: number, h?: number) => { x: number; y: number };
  /** how tall a playable character stands (world units, feet to the top of the head or hat) */
  headH?: (charId: string) => number;
}

/** How high each boss's overhead bar floats (world units above its feet; D-65). */
const BAR_H: Record<string, number> = {
  carnival_tent: 330, ferris_wheel: 300, puppet_king: 320, ringmaster: 250, calliope: 330,
  crooked_twins: 360, looking_glass: 330, stringmistress: 300, proprietor: 300, unreflected: 330,
  barker: 300, drowned_captain: 320, last_ride: 200, leviathan: 380, commodore: 300,
};
/** An item marker (points down at what it marks; coloured by the CSS through `currentColor`). */
const MARK_SVG = '<svg viewBox="0 0 24 24"><path d="M4 3 L12 21 L20 3 L12 8 Z" fill="currentColor" stroke="#17110e" stroke-width="2.2" stroke-linejoin="round"/></svg>';
/** What gets a bouncing arrow over it, and how high above the ground the arrow hangs (D-71). */
const MARKED: Partial<Record<string, number>> = { chest: 74, food: 48, funnel: 48, golden: 66 };

/** An arrow round your character toward a chest or a golden ticket (points along +x; coloured by the CSS). */
const ARROW_SVG = '<svg viewBox="0 0 24 24"><path d="M3 4 L21 12 L3 20 L8 12 Z" fill="currentColor" stroke="#17110e" stroke-width="2.4" stroke-linejoin="round"/></svg>';
/** A coffin, for a fallen teammate's off-screen marker (D-91); its cross takes their colour. */
const COFFIN_SVG = '<svg viewBox="0 0 24 24"><path d="M9 1.5 L15 1.5 L19 6.5 L16 22.5 L8 22.5 L5 6.5 Z" fill="#6a3a22" stroke="#17110e" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 6 V16 M8.6 9.4 H15.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
/** How far in from the screen's edge an off-screen marker's centre stands (it and its notch fit inside). */
const EDGE_IN = 46;
/** The party frames' distance from the bottom of the screen (D-91: over the health bar; match `.hud .party`). */
const PARTY_BOTTOM = 128;
const onScreen = (s: { x: number; y: number }, screen: HudScreen) => s.x > 0 && s.x < screen.w && s.y > 0 && s.y < screen.h;

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

/**
 * An evolution recipe at a glance (D-71): the weapon at its top level + the passive = the evolution, as icons
 * with their names, each requirement ticked once it's met (only this player's own passive counts, D-74); the
 * band lights up gold when it's ready. A weapon you own is lit even below its top level (D-75), dim if you
 * don't have it. `levelAfter` is the weapon's level once an offered card is taken; `passiveAfter` marks a
 * recipe shown on the passive's own card (taking it brings the passive). D-79: read from the kit of the
 * player it is shown to (see `recipes.ts`).
 */
export function evoRecipe(assets: Assets, kit: Kit, weaponId: string, levelAfter?: number, passiveAfter = false): HTMLElement | null {
  const st = recipeState(kit, weaponId, levelAfter, passiveAfter);
  if (!st) return null;
  const d = WEAPONS[weaponId], evo = WEAPONS[d.evolvesTo!], pas = PASSIVES[d.evoPassive!];
  const { owned, lv, haveLv, mine, ready } = st;
  const part = (icon: string, name: string, ok: boolean | null | 'have', note: string) =>
    h('div', { class: `rp${ok === null ? ' out' : ok === 'have' ? ' have' : ok ? ' ok' : ''}` }, h('img', { src: icon, alt: '' }), h('b', {}, name), note ? h('small', {}, `${ok === true ? '✓ ' : ''}${note}`) : null);
  return h('div', { class: `recipe${ready ? ' ready' : ''}` },
    h('div', { class: 'rh' }, ready ? (passiveAfter ? '✦ READY with this card' : '✦ READY: next level-up or chest') : '✦ EVOLUTION'),
    h('div', { class: 'rrow' },
      part(assets.weaponIcon(weaponId), d.name, haveLv ? true : owned ? 'have' : false, owned ? `Lv ${lv}/${d.maxLevel}` : 'not owned'),
      h('span', { class: 'op' }, '+'),
      part(assets.passiveIcon(d.evoPassive!), pas.name, mine, passiveAfter ? 'this card' : mine ? 'have it' : 'need it'),
      h('span', { class: 'op' }, '='),
      part(assets.weaponIcon(evo.id), evo.name, null, ''),
    ));
}

/** The overhead bar slot the Fun House projector's warm-up uses (no creature has a negative uid). */
const PROJECTOR_BAR = -7001;
/** ...and the Boardwalk hoist's, winching the founder's bell up (D-79). */
const BELL_BAR = -7002;

/** A quest whisper stays on screen this many times as long as it asks for (D-71). */
const WHISPER_HOLD = 2;

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
  /** the equipment bar's hover tooltip, and the night it describes (D-71) */
  private tip = h('div', { class: 'tray-tip hidden' });
  private tipGame: Game | null = null;
  /** whose build the tray's tooltips read (the local player, as the HUD last drew it; D-79) */
  private tipWho: Player | null = null;
  private statsR: HTMLDivElement;
  /** the corner's lines: kills, the Lost Tickets earned so far (D-85), the difficulty */
  private killsEl = h('div', {});
  private ltNum = h('span', { class: 'ticket-count' });
  private ltEl = h('div', { class: 'lt-live' }, this.ltNum, h('small', {}, 'LT'));
  private diffEl = h('div', {});
  private lastLt = -1;
  /** the damage meter (D-85) */
  meter: DamageMeter;
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
  /** cooldown dials on the tray (the Undertow's, D-84): each weapon's slot index and its sweep */
  private dials: { i: number; el: HTMLElement }[] = [];
  private lastHp = -1;
  private bossKey = '';
  private indicators: HTMLDivElement;
  /** co-op: the party frames (D-85: down the left, after the MMO's; they were cards over the health bar) */
  private party: HTMLDivElement;
  private partyKey = '';
  private partyLive: { index: number; frame: HTMLElement; fill: HTMLElement; num: HTMLElement; st: HTMLElement }[] = [];
  /** the build card a party portrait shows on hover: whose, and the build it was drawn from */
  private buildTip = h('div', { class: 'tray-tip pf-tip hidden' });
  private buildFor: number | null = null;
  private buildKey = '';
  /** the party frames' height, measured with `keepOut` (the chat box sits over them) */
  private partyH = 0;
  /** the off-screen markers on show, by what they mark (D-91: kept from frame to frame, so a portrait isn't rebuilt) */
  private edges = new Map<string, { el: HTMLElement; ptr: HTMLElement }>();
  private edgeSeen = new Set<string>();
  /** where the meter and the party frames stand (the edge arrows keep clear of them), measured four times a second */
  private keepOut: { x: number; y: number; w: number; h: number }[] = [];
  private keepOutT = 0;
  private whispers: HTMLDivElement;
  private tags: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private pingEl: HTMLDivElement;
  private diagEl: HTMLDivElement;
  private statusKey = '';
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
  /** the Fun House projector's warm-up as last seen (D-76): its charge, rising (1) / falling (-1) / still, and when it moved */
  private proj = { v: 0, trend: 0, at: 0 };
  /** the founder's bell on the hoist as last seen (D-79): its progress, rising / slipping / still, when it moved (ms) */
  private bellBar = { v: 0, trend: 0, at: 0 };
  private arrowLayer: HTMLDivElement;
  private arrows: HTMLDivElement[] = [];
  private markers: HTMLDivElement[] = [];
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
    this.statsR = h('div', { class: 'stats-right' }, this.killsEl, this.ltEl, this.diffEl);
    this.meter = new DamageMeter(assets, PLAYER_CSS);
    this.boss = h('div', { class: 'boss hidden' });
    this.toast = h('div', { class: 'toast' });
    this.fpsEl = h('div', { class: 'fps hidden' });
    this.indicators = h('div', { class: 'passthrough' });
    this.party = h('div', { class: 'party hidden' });
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
    this.root.append(xp, this.lvl, this.preview, clock, this.act, this.hpWrap, this.tray, this.statsR, this.boss, this.toast, this.fpsEl, this.indicators, this.party, this.meter.root, this.tags, this.statusEl, this.pingEl, this.diagEl);
  }

  setPortrait(charId: string): void {
    (this.hpWrap.querySelector('.portrait img') as HTMLImageElement).src = this.assets.portrait(charId);
    this.trayKey = '';
    this.bossKey = '';
  }

  update(g: Game, fps: number, dt: number, screen: HudScreen): void {
    this.tipGame = g;
    const p = g.player;
    this.tipWho = p;
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
    // (health rounds up, never past the maximum shown: a full Strongman read 187 / 186)
    this.hpTxt.textContent = `${Math.max(0, Math.min(Math.ceil(p.hp), Math.round(maxHp)))} / ${Math.round(maxHp)}`;
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
      this.dials = [];
      const wg = h('div', { class: 'group' });
      for (let i = 0; i < slots.weapons; i++) {
        const w = g.weapons.list[i];
        if (!w) {
          wg.append(h('div', { class: 'slot empty' }));
          continue;
        }
        const max = w.level >= w.def.maxLevel;
        const lv = max ? (w.def.isEvolution ? '✦MAX' : 'MAX') : w.def.isEvolution ? `✦${w.level}` : String(w.level);
        const id = w.def.id;
        // the Undertow launches on its own when it's ready: its slot shows when that will be
        const dial = id === 'bumper' ? h('div', { class: 'cd' }) : null;
        if (dial) this.dials.push({ i, el: dial });
        wg.append(h('div', { class: `slot${ready.has(id) ? ' evo-ready' : ''}`, onpointerenter: (ev: PointerEvent) => this.showTip(ev.currentTarget as HTMLElement, 'weapon', id), onpointerleave: () => this.hideTip() }, h('img', { src: this.assets.weaponIcon(id), alt: w.def.name }), dial, h('span', { class: `lv${max ? ' max' : ''}${w.def.isEvolution ? ' evo' : ''}` }, lv)));
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
        const id = e[0];
        pg.append(h('div', { class: 'slot', onpointerenter: (ev: PointerEvent) => this.showTip(ev.currentTarget as HTMLElement, 'passive', id), onpointerleave: () => this.hideTip() }, h('img', { src: this.assets.passiveIcon(id), alt: d.name }), h('span', { class: `lv${e[1] >= d.maxLevel ? ' max' : ''}` }, e[1] >= d.maxLevel ? 'MAX' : String(e[1]))));
      }
      this.hideTip();
      this.tray.replaceChildren(wg, pg);
    }
    // the grey sweeps back clockwise as the weapon recharges, like an MMO's cooldowns (D-84)
    for (const d of this.dials) {
      const w = g.weapons.list[d.i];
      const f = w ? Math.max(0, Math.min(1, w.cd / g.weapons.cooldown(w))) : 0;
      d.el.style.setProperty('--cd', `${((1 - f) * 360).toFixed(1)}deg`);
    }
    const kills = `☠ ${g.kills.toLocaleString('en-US')}`;
    if (this.killsEl.textContent !== kills) this.killsEl.textContent = kills;
    const diff = `🎪 ${g.diff.name}${g.cfg.curse ? ' · Cursed' : ''}${g.cfg.daily ? ' · Daily' : ''}`;
    if (this.diffEl.textContent !== diff) this.diffEl.textContent = diff;
    // the Lost Tickets earned so far tonight (D-85): it bumps when a boss, a voucher or the victory lap pays
    const local = this.coopInfo?.local ?? p.index;
    const lt = liveLt(g, local);
    if (lt !== this.lastLt) {
      if (this.lastLt >= 0 && lt - this.lastLt >= 20) {
        this.ltEl.classList.remove('bump');
        void this.ltEl.offsetWidth;
        this.ltEl.classList.add('bump');
      }
      this.lastLt = lt;
      this.ltNum.textContent = fmtNum(lt);
    }
    this.meter.update(g, local, g.players.length > 1, dt);
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
    this.updateCoop(g, screen);
    // (measuring reads the layout, so not every frame)
    this.keepOutT -= dt;
    if (this.keepOutT <= 0) {
      this.keepOutT = 0.25;
      const party = this.partyRect();
      this.partyH = party?.h ?? 0;
      this.keepOut = [this.meter.rect(), party].filter((r): r is NonNullable<typeof r> => !!r);
    }
    this.updateIndicators(g, screen);
    this.updateBars(g, screen);
    this.updateChestArrows(g, screen);
    this.updateItemMarkers(g, screen);
    this.updatePrompt(g, screen);
  }

  /** "E  Turn the mirror": floats over whatever the local player could use right now (D-67). */
  private updatePrompt(g: Game, screen: HudScreen): void {
    const p = g.player;
    let it: { kind: string; i: number; x: number; y: number; label: string } | null = null;
    if (g.phase === 'play' && g.isUp(p)) for (const c of g.quests?.chains ?? []) it ??= c.interaction?.(p.x, p.y, p.index) ?? null;
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

  /** How far up from the bottom the chat box sits: above the health bar and its portrait, and above the party frames
   *  when they're up (D-91: they moved there from the top left). */
  chatBottom(): number {
    return this.party.classList.contains('hidden') || !this.partyH ? 118 : PARTY_BOTTOM + this.partyH + 12;
  }

  /** The party frames' box in UI pixels, or null without them. */
  private partyRect(): { x: number; y: number; w: number; h: number } | null {
    if (this.party.classList.contains('hidden')) return null;
    return { x: this.party.offsetLeft, y: this.party.offsetTop, w: this.party.offsetWidth, h: this.party.offsetHeight };
  }

  /** An edge marker's x, moved in past the meter or the party frames when it would sit on them (D-85). */
  private clearX(x: number, y: number, screenW: number): number {
    for (const r of this.keepOut) {
      if (y < r.y - EDGE_IN || y > r.y + r.h + EDGE_IN || x < r.x - EDGE_IN || x > r.x + r.w + EDGE_IN) continue;
      x = r.x > screenW / 2 ? r.x - EDGE_IN : r.x + r.w + EDGE_IN;
    }
    return x;
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
      // (a label that changes, like the projector's countdown, is rewritten in place: rebuilding the bar
      // would replay its fill from empty, D-76)
      const key = `${name === null ? 'boss' : 'named'}|${color}|${segs.join(',')}`;
      let b = this.bars.get(uid);
      if (!b || b.key !== key) {
        b?.el.remove();
        const fill = h('i', { style: { background: `linear-gradient(180deg, ${color}, #7a0a14)` } });
        const bar = h('div', { class: 'b' }, fill, ...segs.map((at) => h('span', { class: 'seg', style: { left: `${at * 100}%` } })));
        const el = h('div', { class: `ohbar ${name !== null ? 'mini' : 'boss'}` }, name !== null ? h('span', { class: 'nm' }, name) : null, bar);
        this.barLayer.append(el);
        b = { el, fill, key };
        this.bars.set(uid, b);
      }
      if (name !== null) {
        const nm = b.el.firstElementChild as HTMLElement;
        if (nm.textContent !== name) nm.textContent = name;
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
    // the Fun House projector (D-76): how far it has warmed, live, and what it wants from you
    const ch = g.mapId === 'fun_house' ? g.quests?.get<UnreflectedChain>('unreflected') : undefined;
    if (ch && ch.stage === UR.Projector) {
      const pr = this.proj;
      // rising, falling or still (a guest's copy changes in steps, so a trend holds a moment between them)
      if (ch.charge !== pr.v) {
        pr.trend = ch.charge > pr.v ? 1 : -1;
        pr.v = ch.charge;
        pr.at = g.realTime;
      } else if (g.realTime - pr.at > 0.6) pr.trend = 0;
      const left = Math.max(1, Math.ceil(UNREFLECTED.charge - ch.charge));
      const label = pr.trend > 0 ? `Warming up · stay in the ring (${left}s)` : pr.trend < 0 ? 'Cooling down · back into the ring!' : 'Stand in the ring to start the projector';
      const P = UNREFLECTED.projector;
      put(PROJECTOR_BAR, P.x, P.y, 230, ch.charge / UNREFLECTED.charge, '#ffcf6a', label, [0.25, 0.5, 0.75]);
    }
    // the founder's bell (D-79): how far the hoist has winched it, live, and what it wants from you
    const se = g.mapId === 'boardwalk' ? g.quests?.get<SummersEndChain>('summers_end') : undefined;
    if (se && se.stage === SE.Bell) {
      const bl = this.bellBar, now = performance.now();
      if (se.bellT !== bl.v) {
        bl.trend = se.bellT > bl.v ? 1 : -1;
        bl.v = se.bellT;
        bl.at = now;
      } else if (now - bl.at > 600) bl.trend = 0;
      const B = SUMMERS_END.bell;
      const left = Math.max(1, Math.ceil(B.hold - se.bellT));
      const label = bl.trend > 0 ? `Winching up · stay by the bell (${left}s)` : bl.trend < 0 ? 'Slipping back · stand by the bell!' : 'Stand in the ring to winch the bell up';
      put(BELL_BAR, B.x, B.y, 190, se.bellT / B.hold, '#ffcf6a', label, [0.25, 0.5, 0.75]);
    }
    for (const [uid, b] of this.bars) {
      if (seen.has(uid)) continue;
      b.el.remove();
      this.bars.delete(uid);
    }
  }

  /** Arrows circling your character toward the nearest chests and golden tickets (D-65; D-91: golden tickets too, and
   *  bigger); gone once you're on top of one. */
  private updateChestArrows(g: Game, screen: HudScreen): void {
    const p = g.player;
    const list = g.pickups
      .filter((pk) => pk.alive && (pk.kind === 'chest' || pk.kind === 'golden'))
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
      const R = 98 + i * 13;
      if (el.dataset.kind !== c.pk.kind) el.dataset.kind = c.pk.kind;
      el.style.left = `${ps.x + Math.cos(a) * R}px`;
      el.style.top = `${ps.y + Math.sin(a) * R}px`;
      el.style.transform = `translate(-50%, -50%) rotate(${a}rad)`;
      el.style.opacity = String(i === 0 ? 1 : 0.7);
    });
  }

  /** A bouncing arrow over each chest, food and golden ticket on screen (D-71), so they're easy to spot. */
  private updateItemMarkers(g: Game, screen: HudScreen): void {
    const list = g.pickups.filter((pk) => pk.alive && MARKED[pk.kind] !== undefined).slice(0, 12);
    while (this.markers.length < list.length) {
      const el = h('div', { class: 'item-mark', html: MARK_SVG });
      this.arrowLayer.append(el);
      this.markers.push(el);
    }
    this.markers.forEach((el, i) => {
      const pk = list[i];
      const s = pk ? screen.toScreen(pk.x, pk.y, MARKED[pk.kind]!) : null;
      const on = !!s && s.x > -30 && s.x < screen.w + 30 && s.y > -30 && s.y < screen.h + 30;
      el.style.display = on ? '' : 'none';
      if (!on || !s) return;
      el.style.left = `${s.x}px`;
      el.style.top = `${s.y}px`;
      if (el.dataset.kind !== pk.kind) el.dataset.kind = pk.kind;
    });
  }

  /** Online co-op: the party frames, name tags (or edge arrows), waiting notes, latency. */
  private updateCoop(g: Game, screen: HudScreen): void {
    const info = this.coopInfo;
    const on = !!info && g.players.length > 1;
    this.party.classList.toggle('hidden', !on);
    this.pingEl.classList.toggle('hidden', !on || info?.ping === undefined);
    this.diagEl.classList.toggle('hidden', !on || !info?.diag);
    if (!on || !info) {
      if (this.tags.childElementCount) this.tags.replaceChildren();
      this.statusEl.classList.add('hidden');
      this.statusKey = '';
      this.hideBuild();
      return;
    }
    this.updateParty(g, info);
    // name tags over the other players' heads (D-91: they sat at face height); off screen, their marker at the edge
    // (updateIndicators)
    const kids: HTMLElement[] = [];
    for (const q of g.players) {
      if (q.index === info.local || !onScreen(screen.toScreen(q.x, q.y), screen)) continue;
      const s = screen.toScreen(q.x, q.y, (q.downed ? 64 : screen.headH?.(q.char.id) ?? 150) + 12);
      kids.push(h('div', { class: `coop-tag p${q.index + 1}`, style: { left: `${s.x}px`, top: `${s.y}px` } }, q.downed ? `⚰ ${q.name}` : q.name));
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

  /**
   * A frame per teammate, stacked over your own health bar (D-85, after the MMO party frames; D-91 moved them
   * there from the top left): their portrait, name, health and what is happening to them. Built once per party;
   * the bars and lines update in place, so a portrait under the pointer stays put. Hover a portrait for their
   * build.
   */
  private updateParty(g: Game, info: CoopHud): void {
    const others = g.players.filter((q) => q.index !== info.local);
    const key = others.map((q) => `${q.index}|${q.char.id}|${q.name}`).join(';');
    if (key !== this.partyKey) {
      this.partyKey = key;
      this.partyLive = [];
      this.hideBuild();
      this.party.classList.toggle('many', others.length > 3);
      this.party.replaceChildren(...others.map((q) => {
        const fill = h('i');
        const num = h('span', { class: 'pf-num' });
        const st = h('div', { class: 'pf-st' });
        const frame = h('div', { class: `pf p${q.index + 1}` },
          h('div', { class: 'pf-portrait', onpointerenter: (ev: PointerEvent) => this.showBuild(ev.currentTarget as HTMLElement, q.index), onpointerleave: () => this.hideBuild() }, h('img', { src: this.assets.portrait(q.char.id), alt: '' })),
          h('div', { class: 'pf-body' }, h('div', { class: 'pf-name' }, q.name), h('div', { class: 'pf-bar' }, fill, num), st));
        this.partyLive.push({ index: q.index, frame, fill, num, st });
        return frame;
      }));
    }
    for (const L of this.partyLive) {
      const q = g.players[L.index];
      if (!q) continue;
      const gone = !!info.gone?.includes(q.index);
      const max = q.stats.maxHp();
      L.fill.style.width = `${Math.max(0, Math.min(100, (q.hp / max) * 100))}%`;
      const num = `${Math.max(0, Math.min(Math.ceil(q.hp), Math.round(max)))} / ${Math.round(max)}`;
      if (L.num.textContent !== num) L.num.textContent = num;
      const st = gone ? 'Reconnecting…' : q.downed ? (others.length > 2 ? 'In a coffin!' : 'In a coffin — stand by to revive!') : q.dead ? 'Down' : '';
      if (L.st.textContent !== st) L.st.textContent = st;
      L.frame.classList.toggle('down', q.downed || q.dead || gone);
    }
    if (this.buildFor !== null) this.fillBuild(g, this.buildFor);
  }

  /** A teammate's build on their portrait (D-85): their weapons and charms, each with its level. */
  private showBuild(portrait: HTMLElement, index: number): void {
    const g = this.tipGame;
    if (!g) return;
    this.buildFor = index;
    this.buildKey = '';
    this.fillBuild(g, index);
    this.buildTip.classList.remove('hidden');
    if (!this.buildTip.isConnected) this.root.append(this.buildTip);
    // to the right of the frame, clear of its name and health (rects are screen pixels; the UI layer is zoomed, D-74)
    const z = uiZoom.v;
    const r = (portrait.parentElement ?? portrait).getBoundingClientRect(), t = this.buildTip.getBoundingClientRect();
    this.buildTip.style.left = `${(r.right + 14) / z}px`;
    this.buildTip.style.top = `${Math.max(8, Math.min(innerHeight - t.height - 8, r.top - 6)) / z}px`;
  }

  private hideBuild(): void {
    this.buildFor = null;
    this.buildTip.classList.add('hidden');
  }

  private fillBuild(g: Game, index: number): void {
    const q = g.players[index];
    if (!q) return this.hideBuild();
    const ws = q.weapons.list, ps = [...q.passives];
    const key = `${q.char.id}|${q.pet}|` + ws.map((w) => `${w.def.id}:${w.level}`).join(',') + '|' + ps.map(([id, l]) => `${id}:${l}`).join(',');
    if (key === this.buildKey) return;
    this.buildKey = key;
    const slot = (icon: string, name: string, lv: string) => h('div', { class: 'slot', title: name }, h('img', { src: icon, alt: name }), h('span', { class: `lv${lv.includes('MAX') ? ' max' : ''}` }, lv));
    const weapons = ws.map((w) => {
      const max = w.level >= w.def.maxLevel;
      return slot(this.assets.weaponIcon(w.def.id), w.def.name, max ? (w.def.isEvolution ? '✦MAX' : 'MAX') : w.def.isEvolution ? `✦${w.level}` : String(w.level));
    });
    const charms = ps.map(([id, l]) => slot(this.assets.passiveIcon(id), PASSIVES[id]?.name ?? id, l >= (PASSIVES[id]?.maxLevel ?? 99) ? 'MAX' : String(l)));
    const pet = q.pet ? PET_MAP[q.pet] : undefined;
    this.buildTip.replaceChildren(
      h('div', { class: 'tt-head' }, h('img', { src: this.assets.portrait(q.char.id), alt: '' }), h('div', {}, h('b', { style: { color: PLAYER_CSS[q.index % PLAYER_CSS.length] } }, q.name), h('small', {}, `${CHARACTER_MAP[q.char.id]?.name ?? ''}${pet ? ` · with ${pet.name}` : ''}`))),
      h('div', { class: 'pf-label' }, 'Weapons'),
      h('div', { class: 'pf-slots' }, ...(weapons.length ? weapons : [h('span', { class: 'pf-none' }, 'none yet')])),
      h('div', { class: 'pf-label' }, 'Charms'),
      h('div', { class: 'pf-slots' }, ...(charms.length ? charms : [h('span', { class: 'pf-none' }, 'none yet')])),
    );
  }

  /**
   * Markers at the screen's edge for what is off it (D-91: bigger circles, each with a notch toward what it marks):
   * chests, food and golden tickets; bosses, their face in red; in co-op, each teammate's portrait in their colour,
   * a coffin while they are down.
   */
  private updateIndicators(g: Game, screen: HudScreen): void {
    this.edgeSeen.clear();
    for (let i = 0; i < g.pickups.length; i++) {
      const pk = g.pickups[i];
      if (!pk.alive) continue;
      const mk = pk.kind === 'chest' ? ['#f2c14e', '★'] : pk.kind === 'food' ? ['#6fe07a', '+'] : pk.kind === 'golden' ? ['#ffe066', '$'] : null;
      if (mk) this.edgeMark(screen, `pk${i}:${pk.gen}`, pk.x, pk.y, 'item', mk[0], () => [mk[1]]);
    }
    for (const b of g.bosses) if (b.awake && !b.dead) this.edgeMark(screen, `boss${b.uid}`, b.x, b.y, 'boss', '#ff4a2a', () => [h('img', { src: this.assets.bossImage(b.def.id), alt: '' })]);
    const info = this.coopInfo;
    if (info && g.players.length > 1) for (const q of g.players) {
      if (q.index === info.local) continue;
      const down = q.downed || q.dead;
      this.edgeMark(screen, `mate${q.index}:${q.char.id}:${down ? 1 : 0}`, q.x, q.y, down ? 'mate down' : 'mate', PLAYER_CSS[q.index % PLAYER_CSS.length],
        () => [down ? h('span', { class: 'coffin', html: COFFIN_SVG }) : h('img', { src: this.assets.portrait(q.char.id), alt: '' })]);
    }
    for (const [k, m] of this.edges) if (!this.edgeSeen.has(k)) {
      m.el.remove();
      this.edges.delete(k);
    }
  }

  /** One off-screen marker (made the first time, moved after): at the edge nearest (wx, wy), clear of the party
   *  frames and the meter, its notch turned toward it. Nothing while it's on screen. */
  private edgeMark(screen: HudScreen, key: string, wx: number, wy: number, cls: string, col: string, content: () => (Node | string)[]): void {
    const s = screen.toScreen(wx, wy);
    if (onScreen(s, screen)) return;
    this.edgeSeen.add(key);
    let m = this.edges.get(key);
    if (!m) {
      const ptr = h('b');
      const el = h('div', { class: `indicator ${cls}` }, ptr, h('i', {}, ...content()));
      el.style.setProperty('--pc', col);
      this.indicators.append(el);
      m = { el, ptr };
      this.edges.set(key, m);
    }
    const y = Math.max(EDGE_IN + 100, Math.min(screen.h - EDGE_IN - 70, s.y)), x = this.clearX(Math.max(EDGE_IN, Math.min(screen.w - EDGE_IN, s.x)), y, screen.w);
    m.el.style.left = `${x}px`;
    m.el.style.top = `${y}px`;
    m.ptr.style.transform = `rotate(${Math.atan2(s.y - y, s.x - x).toFixed(3)}rad)`;
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
    // on screen twice as long as asked (D-71: quest lines faded before they were read), fading in and out
    // as quickly as before
    const total = dur * WHISPER_HOLD;
    if (typeof el.animate === 'function') {
      const fin = Math.min(0.2, 0.5 / total), fout = 1 - Math.min(0.3, 0.9 / total);
      el.style.animation = 'none';
      el.animate([
        { opacity: 0, transform: 'translateY(14px)', filter: 'blur(4px)', offset: 0 },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)', offset: fin },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)', offset: fout },
        { opacity: 0, transform: 'translateY(-18px)', filter: 'blur(3px)', offset: 1 },
      ], { duration: total * 1000, easing: 'ease-out', fill: 'forwards' });
    } else el.style.animationDuration = `${total}s`;
    this.whispers.append(el);
    setTimeout(() => el.remove(), total * 1000);
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

  /** The Boardwalk's tide turning (D-71): a short notice, or a toast if a bigger banner is up. */
  tide(going: 'out' | 'in'): void {
    const [text, sub] = going === 'out' ? ['THE TIDE IS GOING OUT', 'the sea draws back off the sand'] : ['THE TIDE IS COMING IN', 'get off the flats'];
    if (this.bannerT > 0) this.toastMsg(text.charAt(0) + text.slice(1).toLowerCase());
    else this.banner(text, sub, 'tide', 2.6);
  }

  /**
   * The equipment bar's tooltip (D-71): hover a slot to see what it is and does, its level, what its next
   * level brings, and its evolution recipe (or, for a passive, which evolutions it feeds).
   */
  private showTip(slot: HTMLElement, kind: 'weapon' | 'passive', id: string): void {
    const g = this.tipGame, p = this.tipWho;
    if (!g || !p) return;
    const kit = kitOf(g, p);
    const body: (HTMLElement | null)[] = [];
    if (kind === 'weapon') {
      const d = WEAPONS[id], lv = kit.weapons.get(id) ?? 1;
      const next = lv < d.maxLevel ? d.levelText?.[lv + 1] : '';
      body.push(
        h('div', { class: 'tt-head' }, h('img', { src: this.assets.weaponIcon(id), alt: '' }), h('div', {}, h('b', {}, d.name), h('small', {}, `${d.isEvolution ? '✦ Evolution · ' : ''}Level ${lv} / ${d.maxLevel}`))),
        h('div', { class: 'tt-desc' }, d.desc),
        next ? h('div', { class: 'tt-next' }, h('span', {}, 'Next level'), next) : lv >= d.maxLevel ? h('div', { class: 'tt-next max' }, 'Top level reached') : null,
        d.isEvolution && d.evolvedFrom ? h('div', { class: 'tt-note' }, `Evolved from ${WEAPONS[d.evolvedFrom].name}`) : evoRecipe(this.assets, kit, id),
      );
    } else {
      const d = PASSIVES[id], lv = kit.passives.get(id) ?? 0;
      const feeds = Object.values(WEAPONS).filter((wd) => wd.evoPassive === id && !wd.isEvolution);
      const owned = feeds.filter((wd) => kit.weapons.has(wd.id));
      body.push(
        h('div', { class: 'tt-head' }, h('img', { src: this.assets.passiveIcon(id), alt: '' }), h('div', {}, h('b', {}, d.name), h('small', {}, `Passive · Level ${lv} / ${d.maxLevel}`))),
        h('div', { class: 'tt-desc' }, `${d.desc} per level`),
        ...owned.map((wd) => evoRecipe(this.assets, kit, wd.id)),
        !owned.length && feeds.length ? h('div', { class: 'tt-note' }, `Evolves ${feeds.map((wd) => `${wd.name} into ${WEAPONS[wd.evolvesTo!].name}`).join(' · ')}`) : null,
      );
    }
    this.tip.replaceChildren(...body.filter((x): x is HTMLElement => !!x));
    this.tip.classList.remove('hidden');
    if (!this.tip.isConnected) this.root.append(this.tip);
    // (rects are in screen pixels; the UI layer is zoomed to the window, D-74)
    const z = uiZoom.v;
    const r = slot.getBoundingClientRect(), t = this.tip.getBoundingClientRect();
    this.tip.style.left = `${Math.max(8, Math.min(innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2)) / z}px`;
    this.tip.style.top = `${Math.max(8, r.top - t.height - 12) / z}px`;
  }

  private hideTip(): void {
    this.tip.classList.add('hidden');
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
    this.lastLt = -1;
    this.partyKey = '';
    this.hideBuild();
    this.meter.reset();
    for (const m of this.edges.values()) m.el.remove();
    this.edges.clear();
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

  /**
   * `who` is the player the hand was dealt to and `kit` their build (D-79: both used to come from the game's
   * context, which pointed at whoever picked up the ticket that set off the level-up).
   */
  show(g: Game, options: DraftOption[], who: Player, kit: Kit): void {
    this.root.classList.remove('hidden');
    const p = who;
    const cards = options.map((o, i) => {
      const icon = o.kind === 'passive' ? this.assets.passiveIcon(o.refId) : o.kind === 'heal' ? this.assets.passiveIcon('funnel_cake') : o.kind === 'voucher' ? this.assets.passiveIcon('coin_purse') : this.assets.weaponIcon(o.kind === 'evolution' ? WEAPONS[o.refId].evolvesTo! : o.refId);
      const evoLv = o.kind === 'level_weapon' && WEAPONS[o.refId]?.isEvolution;
      const lvlTxt = o.kind === 'evolution' ? 'EVOLUTION!' : o.kind === 'new_weapon' ? 'New weapon' : o.kind === 'passive' ? (o.isNew ? 'New passive' : `Level ${o.level}`) : o.kind === 'heal' ? 'A small mercy' : o.kind === 'voucher' ? 'Permanent currency' : `${evoLv ? '✦ Evo Level' : 'Level'} ${o.level}${o.level === 8 ? ' — MAX' : ''}`;
      // the evolution it leads to, as a recipe band (D-71): weapon + passive = evolution, ticked as you go
      let hint = '';
      const recipes: (HTMLElement | null)[] = [];
      if (o.kind === 'new_weapon' || o.kind === 'level_weapon') recipes.push(evoRecipe(this.assets, kit, o.refId, o.level));
      else if (o.kind === 'passive') {
        // every evolution this passive feeds (D-75: only those of weapons already owned showed, and dim), the
        // ones whose weapon you have first and lit; a weapon that has already evolved needs it no more
        for (const w of passiveFeeds(kit, o.refId)) recipes.push(evoRecipe(this.assets, kit, w, undefined, true));
      } else if (o.kind === 'evolution') hint = `Replaces ${WEAPONS[o.refId].name}`;
      const rarityName = o.rarity === 'evolution' ? '✦ EVOLUTION ✦' : o.rarity.toUpperCase();
      return h('div', { class: `card ${o.rarity}${o.kind === 'voucher' ? ' voucher' : ''}${o.disabled ? ' disabled' : ''}`, 'data-nav': o.disabled ? undefined : '', 'data-default': i === 0 ? '' : undefined, onclick: () => (o.disabled ? undefined : this.banishMode ? this.doBanish(i) : this.onPick(i)) },
        h('div', { class: 'rib' }, rarityName),
        o.isNew && o.kind !== 'evolution' ? h('div', { class: 'new' }, 'NEW!') : null,
        h('img', { src: icon, alt: '' }),
        h('div', { class: 'nm' }, o.title),
        h('div', { class: 'lvl' }, lvlTxt),
        h('div', { class: 'desc' }, o.desc),
        ...recipes.filter((x): x is HTMLElement => !!x).slice(0, 2),
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
