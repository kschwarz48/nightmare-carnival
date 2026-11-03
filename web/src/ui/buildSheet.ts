// The build sheet (D-99): press C in a night for a full look at your build — every weapon and passive with its level
// and the quality of each level taken, where each evolution recipe stands, and every character stat as the night's
// base (character, Lost & Found, companion) plus what this night's items add. Solo, the night holds while it's open.

import { QUALITIES, QUALITY } from '../data/quality';
import { PASSIVES } from '../data/weapons';
import type { Assets } from '../render/assets';
import type { Game } from '../sim/game';
import type { Player } from '../sim/player';
import { PlayerStats } from '../sim/stats';
import { h } from './dom';
import { kitOf } from './recipes';
import { evoRecipe } from './hud';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const signed = (v: number, f: (x: number) => string) => (Math.abs(v) < 1e-6 ? '' : `${v > 0 ? '+' : '−'} ${f(Math.abs(v))}`);
const num = (v: number) => String(Math.round(v * 10) / 10);

/** One row of the stat table: its name, the night's base, what items add (as text), and a tip. */
type Row = [string, string, string, string];

function statRows(p: Player): Row[] {
  const s = p.stats, b = p.baseStats ?? Object.assign(new PlayerStats(), s);
  const row = (name: string, base: number, now: number, f: (x: number) => string, tip: string): Row => [name, f(base), signed(now - base, f), tip];
  return [
    row('Max HP', b.maxHp(), s.maxHp(), (x) => String(Math.round(x)), 'Health'),
    row('Might', b.might, s.might, pct, 'All damage'),
    row('Crit chance', b.critChance, s.critChance, pct, 'The chance a hit is critical'),
    row('Crit damage', b.critDamage, s.critDamage, pct, 'What a critical hit deals'),
    row('Luck', b.luck, s.luck, pct, 'Better upgrade qualities; a 4th card'),
    row('Projectiles', b.amount, s.amount, (x) => `+${Math.round(x)}`, 'Added to every weapon'),
    row('Cooldown', b.cooldown, s.cooldown, pct, 'Weapon cooldowns (lower is faster)'),
    row('Area', b.area, s.area, pct, 'Weapon size'),
    row('Duration', b.duration, s.duration, pct, 'How long effects last'),
    row('Projectile speed', b.projSpeed, s.projSpeed, pct, 'How fast shots fly'),
    row('Move speed', b.moveSpeed(), s.moveSpeed(), (x) => String(Math.round(x)), 'Units a second'),
    row('Armor', b.armor, s.armor, num, 'Taken off every hit'),
    row('Regen', b.regen, s.regen, (x) => `${num(x)}/s`, 'Health a second'),
    row('Pickup radius', b.pickupRadius(), s.pickupRadius(), (x) => String(Math.round(x)), 'How far tickets come to you'),
    row('Greed', b.greed, s.greed, pct, 'Lost Tickets at the end of the night'),
    row('XP', b.xp, s.xp, pct, 'What every ticket is worth'),
    row('Revives', b.revives, s.revives, (x) => String(Math.round(x)), 'Spare lives tonight'),
  ];
}

/** Each level's quality as a row of small pips in its colour. */
function pips(quals: number[], max: number): HTMLElement {
  return h('span', { class: 'bs-pips' }, ...Array.from({ length: max }, (_, k) => {
    const q = k < quals.length ? QUALITIES[quals[k] ?? 0] : null;
    return h('i', { class: q ? `on q-${q}` : '', title: q ? QUALITY[q].name : 'not yet' });
  }));
}

export function buildSheetEl(assets: Assets, g: Game, p: Player, close: () => void, holds: boolean): HTMLElement {
  const kit = kitOf(g, p);
  const ws = g.weapons;
  const weapons = p.weapons.list.map((w) => {
    // the weapon's own numbers, with this player's stats (the game's context is this player's while it's drawn)
    const ctx = g.player;
    g.setCtx(p);
    const dmg = ws.damage(w), cd = ws.cooldown(w), area = ws.area(w), amt = ws.amount(w);
    g.setCtx(ctx);
    return h('div', { class: 'bs-item' },
      h('img', { src: assets.weaponIcon(w.def.id), alt: '' }),
      h('div', { class: 'bs-main' },
        h('div', { class: 'bs-name' }, w.def.name, h('span', { class: 'bs-lv' }, `${w.def.isEvolution ? '✦ ' : ''}Lv ${w.level}/${w.def.maxLevel}`)),
        pips(w.quals, w.def.maxLevel),
        h('div', { class: 'bs-nums' }, `Damage ${num(dmg)} · Cooldown ${num(cd)}s · Area ${pct(area)} · Count ${amt}`)));
  });
  const passives = [...p.passives].map(([id, lv]) => {
    const d = PASSIVES[id];
    return h('div', { class: 'bs-item' },
      h('img', { src: assets.passiveIcon(id), alt: '' }),
      h('div', { class: 'bs-main' },
        h('div', { class: 'bs-name' }, d?.name ?? id, h('span', { class: 'bs-lv' }, `Lv ${lv}/${d?.maxLevel ?? 5}`)),
        pips(p.passiveQ.get(id) ?? [], d?.maxLevel ?? 5),
        h('div', { class: 'bs-nums' }, d?.desc ?? '')));
  });
  // every recipe a weapon held leads to, where it stands
  const recipes = p.weapons.list.filter((w) => !w.def.isEvolution && w.def.evolvesTo).map((w) => evoRecipe(assets, kit, w.def.id)).filter((x): x is HTMLElement => !!x);
  const rows = statRows(p);
  return h('div', { class: 'build-sheet', onclick: (e: Event) => { if (e.target === e.currentTarget) close(); } },
    h('div', { class: 'bs-panel panel bulbs' },
      h('div', { class: 'bs-head' },
        h('img', { class: 'bs-portrait', src: assets.portrait(p.char.id), alt: '' }),
        h('div', {}, h('h2', { class: 'title-text' }, 'Your Build'), h('div', { class: 'muted' }, `${p.char.name} · Level ${g.level}${holds ? ' · the night holds' : ''}`)),
        h('button', { class: 'btn small red', 'data-nav': '', onclick: close }, 'Close (C)')),
      h('div', { class: 'bs-cols' },
        h('div', { class: 'bs-col' },
          h('div', { class: 'section-title' }, 'Weapons'), ...(weapons.length ? weapons : [h('div', { class: 'muted' }, 'None yet')]),
          h('div', { class: 'section-title' }, 'Passives'), ...(passives.length ? passives : [h('div', { class: 'muted' }, 'None yet')])),
        h('div', { class: 'bs-col' },
          h('div', { class: 'section-title' }, 'Evolutions'),
          ...(recipes.length ? recipes : [h('div', { class: 'muted' }, 'No recipe in reach: evolutions need a weapon at its last level and its passive.')]),
          h('div', { class: 'bs-legend' }, ...QUALITIES.map((q) => h('span', { class: `q-${q}` }, h('i', {}), QUALITY[q].name)))),
        h('div', { class: 'bs-col bs-stats' },
          h('div', { class: 'section-title' }, 'Stats'),
          h('div', { class: 'bs-table' },
            h('div', { class: 'bs-th' }, h('span', {}, ''), h('span', {}, 'Base'), h('span', {}, 'Items')),
            ...rows.map(([name, base, add, tip]) => h('div', { class: 'bs-tr', title: tip }, h('span', {}, name), h('span', {}, base), h('span', { class: add ? 'up' : '' }, add || '—'))))))));
}
