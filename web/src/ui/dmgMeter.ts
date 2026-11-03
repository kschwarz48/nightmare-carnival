// The damage meter (D-85), after the MMO addons: a bar per weapon in a solo night, a bar per player in co-op,
// each with its damage tonight and, in brackets, its damage per second (a weapon's since it joined the build,
// a player's over the night). Hover a bar for its breakdown: in co-op, that player's damage by weapon. Click
// the header to fold it away; the meter key (M) or Settings hides it.

import { WEAPONS, type WeaponDef, type WeaponKind } from '../data/weapons';
import type { Assets } from '../render/assets';
import type { Game } from '../sim/game';
import type { Player } from '../sim/player';
import { dps, lineOf, meterState, type MeterLine } from '../sim/meter';
import { h, uiZoom } from './dom';

/** A bar colour per weapon kind, as the MMO meters colour a class or a spell school. */
const KIND_COL: Record<WeaponKind, string> = {
  cards: '#e04a4e', mallet: '#d8893a', tarot: '#9d6bff', bumper: '#3fb8c8', plush: '#ff7cc0', tophat: '#8a70d8',
  popcorn: '#e8c43e', darts: '#ff6f8e', fireworks: '#f05ad2', cotton: '#ff9ccf', rings: '#f2b84e', cannon: '#8fa4b8',
  snowcone: '#6cc8f4', grill: '#ff7a3a', laser: '#4fe08a', orbs: '#b38aff', bell: '#c8a050', mirror: '#9fd8e8', calliope: '#d8a860',
  lantern: '#ffe08a', chains: '#8fd3ff', breath: '#ff6a3a', whistle: '#e6e2d6',
};
/** What isn't a weapon's: its name, colour and icon. */
const OTHER: Record<string, { name: string; col: string; icon: (a: Assets) => string }> = {
  revive: { name: 'Spare Balloon', col: '#ff6a8a', icon: (a) => a.uiIcon('revive') },
  // the world tiers' passives (D-97)
  soul_jar: { name: 'Soul Jar', col: '#8fd3ff', icon: (a) => a.passiveIcon('soul_jar') },
  brimstone: { name: 'Brimstone', col: '#ff6a3a', icon: (a) => a.passiveIcon('brimstone') },
  spark_trail: { name: 'Live Wire', col: '#ffe066', icon: (a) => a.portrait('ride_operator') },
  other: { name: 'Other', col: '#a8a0b8', icon: (a) => a.uiIcon('other') },
};

/** 1,234 · 12.3K · 123K · 1.23M: the meter's short numbers. */
export function abbr(n: number): string {
  if (n < 1e4) return Math.round(n).toLocaleString('en-US');
  if (n < 1e6) return `${(n / 1e3).toFixed(n < 1e5 ? 1 : 0)}K`;
  if (n < 1e9) return `${(n / 1e6).toFixed(n < 1e7 ? 2 : n < 1e8 ? 1 : 0)}M`;
  return `${(n / 1e9).toFixed(2)}B`;
}
const abbrDps = (n: number) => (n < 100 ? n.toFixed(1) : abbr(n));

interface Row {
  /** a weapon line or another source (solo), or a player's index (co-op) */
  key: string;
  icon: string;
  name: string;
  col: string;
  total: number;
  dps: number;
}

/** A weapon line's current form in `p`'s build (an evolution once it has evolved). */
const formOf = (p: Player | undefined, key: string): { def: WeaponDef; level: number } | null => {
  const w = p?.weapons.list.find((x) => lineOf(x.def.id) === key);
  if (w) return { def: w.def, level: w.level };
  return WEAPONS[key] ? { def: WEAPONS[key], level: 0 } : null;
};

export class DamageMeter {
  root: HTMLDivElement;
  private rowsEl: HTMLDivElement;
  private segEl: HTMLElement;
  private tip = h('div', { class: 'tray-tip dm-tip hidden' });
  /** the rows on screen: their order and look (rebuilt when either changes), and their live parts */
  private key = '';
  private live: { fill: HTMLElement; val: HTMLElement }[] = [];
  private refreshT = 0;
  /** which bar the pointer rests on (its row key), for the breakdown */
  private hover: string | null = null;
  private last: { g: Game; local: number; coop: boolean } | null = null;
  /** shown at all (Settings, the meter key) and unfolded (its header) */
  on = true;
  open = true;
  /** the header was clicked: fold or unfold (the app remembers it) */
  onFold: ((open: boolean) => void) | null = null;

  constructor(private assets: Assets, private colors: string[]) {
    this.segEl = h('span', { class: 'dm-seg' }, 'Tonight');
    const head = h('div', { class: 'dm-head', onclick: () => this.fold(!this.open) },
      h('span', { class: 'dm-title' }, 'Damage'), this.segEl, h('span', { class: 'dm-btn' }));
    this.rowsEl = h('div', { class: 'dm-rows' });
    this.root = h('div', { class: 'dmeter' }, head, this.rowsEl);
  }

  fold(open: boolean): void {
    this.open = open;
    this.root.classList.toggle('folded', !open);
    this.hideTip();
    this.onFold?.(open);
  }

  /** Refresh (four times a second: the numbers run constantly; a guest's arrive once a second). */
  update(g: Game, local: number, coop: boolean, dt: number): void {
    this.root.classList.toggle('hidden', !this.on);
    this.root.classList.toggle('folded', !this.open);
    this.root.classList.toggle('coop', coop);
    if (!this.on) {
      this.hideTip();
      return;
    }
    this.last = { g, local, coop };
    this.refreshT -= dt;
    if (this.refreshT > 0) return;
    this.refreshT = 0.25;
    const rows = this.rows(g, local, coop);
    this.segEl.textContent = coop ? 'Tonight · party' : 'Tonight';
    const key = `${coop}|` + rows.map((r) => `${r.key}:${r.name}:${r.icon.length}`).join('|');
    if (key !== this.key) {
      this.key = key;
      this.live = [];
      this.rowsEl.replaceChildren(...rows.map((r, i) => {
        const fill = h('i', { class: 'dm-fill' });
        const val = h('span', { class: 'dm-val' });
        this.live.push({ fill, val });
        return h('div', { class: 'dm-row', style: `--c:${r.col}`, onpointerenter: (ev: PointerEvent) => this.showTip(ev.currentTarget as HTMLElement, r.key), onpointerleave: () => this.hideTip() },
          fill, h('img', { class: 'dm-ico', src: r.icon, alt: '' }), h('span', { class: 'dm-name' }, h('b', {}, `${i + 1}.`), r.name), val);
      }));
    }
    const top = Math.max(1, ...rows.map((r) => r.total));
    rows.forEach((r, i) => {
      const L = this.live[i];
      if (!L) return;
      L.fill.style.width = `${(r.total / top) * 100}%`;
      const txt = `${abbr(r.total)} (${abbrDps(r.dps)})`;
      if (L.val.textContent !== txt) L.val.textContent = txt;
    });
    if (this.hover !== null) this.fillTip(this.hover);
  }

  /** Solo: a row per weapon line (and other sources once they deal any). Co-op: a row per player. */
  private rows(g: Game, local: number, coop: boolean): Row[] {
    const m = meterState(g);
    const now = g.time;
    let rows: Row[];
    if (coop) {
      rows = g.players.map((p) => {
        const total = (m[p.index]?.lines ?? []).reduce((n, l) => n + l.dmg, 0);
        return { key: String(p.index), icon: this.assets.portrait(p.char.id), name: p.name, col: this.colors[p.index % this.colors.length], total, dps: dps(total, now, 0) };
      });
    } else rows = this.lineRows(g, g.players[local], m[local]?.lines ?? []);
    return rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }

  /** `p`'s damage by source, as rows (their weapons in their current form). */
  private lineRows(g: Game, p: Player | undefined, lines: MeterLine[]): Row[] {
    const out: Row[] = [];
    for (const l of lines) {
      const f = formOf(p, l.key);
      if (f) out.push({ key: l.key, icon: this.assets.weaponIcon(f.def.id), name: f.def.name, col: KIND_COL[f.def.kind] ?? '#c8b8a0', total: l.dmg, dps: dps(l.dmg, g.time, l.since) });
      else if (l.dmg > 0) {
        const o = OTHER[l.key] ?? OTHER.other;
        out.push({ key: l.key, icon: o.icon(this.assets), name: o.name, col: o.col, total: l.dmg, dps: dps(l.dmg, g.time, 0) });
      }
    }
    return out;
  }

  private showTip(row: HTMLElement, key: string): void {
    this.hover = key;
    this.fillTip(key);
    this.tip.classList.remove('hidden');
    // on the HUD itself, beside the meter (as the tray's tooltips are)
    const host = this.root.parentElement ?? this.root;
    if (this.tip.parentElement !== host) host.append(this.tip);
    // beside the meter, level with the bar (rects are screen pixels; the UI layer is zoomed, D-74)
    const z = uiZoom.v;
    const r = row.getBoundingClientRect(), m = this.root.getBoundingClientRect(), t = this.tip.getBoundingClientRect();
    this.tip.style.left = `${Math.max(8, m.left - t.width - 10) / z}px`;
    this.tip.style.top = `${Math.max(8, Math.min(innerHeight - t.height - 8, r.top - 8)) / z}px`;
  }

  private hideTip(): void {
    this.hover = null;
    this.tip.classList.add('hidden');
  }

  /** The breakdown under the pointer: a player's damage by weapon (co-op), or the one weapon's numbers (solo). */
  private fillTip(key: string): void {
    const L = this.last;
    if (!L) return;
    const { g, local, coop } = L;
    const m = meterState(g);
    if (coop) {
      const p = g.players[Number(key)];
      if (!p) return this.hideTip();
      const rows = this.lineRows(g, p, m[p.index]?.lines ?? []).sort((a, b) => b.total - a.total);
      const total = rows.reduce((n, r) => n + r.total, 0);
      this.tip.replaceChildren(
        h('div', { class: 'tt-head' }, h('img', { src: this.assets.portrait(p.char.id), alt: '' }), h('div', {}, h('b', { style: { color: this.colors[p.index % this.colors.length] } }, p.name), h('small', {}, `${abbr(total)} damage · ${abbrDps(dps(total, g.time, 0))} per second`))),
        h('div', { class: 'dm-break' }, ...rows.map((r) => h('div', { class: 'dm-brow', style: `--c:${r.col}` },
          h('img', { src: r.icon, alt: '' }), h('span', { class: 'nm' }, r.name), h('span', { class: 'v' }, `${abbr(r.total)} (${abbrDps(r.dps)})`), h('span', { class: 'pc' }, `${total > 0 ? Math.round((r.total / total) * 100) : 0}%`)))),
      );
      return;
    }
    const p = g.players[local];
    const line = (m[local]?.lines ?? []).find((l) => l.key === key);
    if (!p || !line) return this.hideTip();
    const total = (m[local]?.lines ?? []).reduce((n, l) => n + l.dmg, 0);
    const f = formOf(p, key), o = OTHER[key] ?? OTHER.other;
    const pc = total > 0 ? Math.round((line.dmg / total) * 100) : 0;
    const note = key === 'mirror' ? 'Everything the mirror clones deal: their replays of your attacks, and Mira’s Glass Halo.' : f?.def.evolvedFrom ? `With its ${WEAPONS[f.def.evolvedFrom].name} days before it evolved.` : '';
    this.tip.replaceChildren(
      h('div', { class: 'tt-head' }, h('img', { src: f ? this.assets.weaponIcon(f.def.id) : o.icon(this.assets), alt: '' }), h('div', {}, h('b', {}, f ? f.def.name : o.name), h('small', {}, f ? (f.level ? `${f.def.isEvolution ? '✦ Evolution · ' : ''}Level ${f.level} / ${f.def.maxLevel}` : 'Weapon') : 'Not a weapon'))),
      h('div', { class: 'tt-desc' }, `${abbr(line.dmg)} damage tonight · ${abbrDps(dps(line.dmg, g.time, f ? line.since : 0))} per second${f ? ' since you took it' : ''} · ${pc}% of yours`),
      ...(note ? [h('div', { class: 'tt-note' }, note)] : []),
    );
  }

  /** Where the meter stands, in UI pixels (for the edge arrows to keep clear of it), or null when it is away. */
  rect(): { x: number; y: number; w: number; h: number } | null {
    if (!this.on || !this.root.isConnected) return null;
    return { x: this.root.offsetLeft, y: this.root.offsetTop, w: this.root.offsetWidth, h: this.root.offsetHeight };
  }

  reset(): void {
    this.key = '';
    this.live = [];
    this.refreshT = 0;
    this.rowsEl.replaceChildren();
    this.hideTip();
  }
}
