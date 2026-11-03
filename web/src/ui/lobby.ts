// Online co-op screens (D-52): the Multiplayer menu (name, host, join), the join-by-code screen and
// the lobby — a marquee with the lobby code, both players' cards, a character grid (characters are
// exclusive, as in Vampire Survivors), ready toggles and, for the host, the world tier, map and the start lever.

import { CHARACTERS, CHARACTER_MAP } from '../data/characters';
import { CURSE } from '../data/difficulty';
import { MAPS, MAP_IDS, type MapId } from '../data/maps';
import { TIERS, TIER_IDS, type TierId } from '../data/tiers';
import { WEAPONS } from '../data/weapons';
import { PETS, PET_MAP } from '../data/pets';
import { ACHIEVEMENTS } from '../data/meta';
import type { LobbyState } from '../net/protocol';
import type { Reach } from '../net/peer';
import { CODE_LENGTH } from '../net/codes';
import { mapButtons, tierButtons, type UICtx } from './screens';
import { h } from './dom';

const btn = (label: string | Node, onclick: () => void, cls = '', extra: Record<string, unknown> = {}) => h('button', { class: `btn ${cls}`, 'data-nav': '', onclick, ...extra }, label);

const NAME_KEY = 'nc-player-name';
export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}
export function storeName(n: string): void {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* private mode: the name just isn't remembered */
  }
}

// ===================================================================== multiplayer menu
const REACH_TEXT: Record<Reach, [string, string]> = {
  relay: ['ok', 'Connection check: ready (a relay is available).'],
  direct: ['ok', 'Connection check: ready for online play.'],
  local: ['warn', 'Connection check: your browser is hiding your address from peer-to-peer play, so joining across the internet will likely fail. Opera / Opera GX: Settings → Privacy & security → WebRTC → "Use any suitable network interface", and turn off its VPN.'],
  blocked: ['warn', 'Connection check: this browser is blocking peer-to-peer connections (WebRTC). Opera / Opera GX: Settings → Privacy & security → WebRTC → "Use any suitable network interface", and turn off its VPN. Or try Chrome or Edge.'],
};

/** `focus`: opened from the Midway's Invite Friends / Join a Friend (D-75): that choice is the default, and the
 *  name is selected, ready to type over. */
export function multiplayerMenu(c: UICtx, o: { name: string; status: string; busy: boolean; reach: Reach | null; host: (name: string) => void; join: (name: string) => void; back: () => void; focus?: 'host' | 'join' }): HTMLElement {
  const input = h('input', { class: 'mp-input', type: 'text', maxlength: '16', value: o.name, placeholder: 'Your name', 'aria-label': 'Your name', 'data-nav': '', spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
  const nm = () => input.value.trim() || 'Player';
  if (o.focus && !o.busy) {
    setTimeout(() => {
      if (!input.isConnected) return;
      input.focus();
      input.select();
    }, 30);
  }
  const join = o.focus === 'join';
  return h('div', { class: 'screen dim mp' }, h('div', { class: 'panel bulbs mp-panel' },
    h('h2', { class: 'title-text' }, 'Online Night'),
    h('div', { class: 'muted' }, 'Play the same night with up to five friends: shared tickets and levels, your own builds. One of you hosts; the others join with the host’s code.'),
    h('label', { class: 'mp-label' }, 'Your name', input),
    h('div', { class: 'menu' },
      btn('Host a Game', () => { c.click(); o.host(nm()); }, '', { 'data-default': join ? undefined : '', disabled: o.busy || undefined }),
      btn('Join a Game', () => { c.click(); o.join(nm()); }, 'purple', { 'data-default': join ? '' : undefined, disabled: o.busy || undefined }),
      btn('Back', () => { c.click(); o.back(); }, 'small red'),
    ),
    h('div', { class: `mp-status${o.status ? '' : ' hidden'}` }, o.status),
    h('div', { class: `mp-check ${o.reach ? REACH_TEXT[o.reach][0] : 'pending'}` }, o.reach ? REACH_TEXT[o.reach][1] : 'Connection check: testing…'),
    h('div', { class: 'muted mp-fine' }, 'Alpha: connections are peer-to-peer (WebRTC) with matchmaking by the free PeerJS service. The host’s computer runs the night — the host should have the steadier connection.'),
  ));
}

// ===================================================================== join by code
export function joinScreen(c: UICtx, o: { status: string; tone: 'info' | 'warn'; busy: boolean; join: (code: string) => void; back: () => void }): HTMLElement {
  const input = h('input', { class: 'mp-input code', type: 'text', maxlength: String(CODE_LENGTH + 2), placeholder: 'ABC234', 'aria-label': 'Lobby code', 'data-nav': '', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'characters' }) as HTMLInputElement;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') o.join(input.value);
    e.stopPropagation();
  });
  setTimeout(() => input.focus(), 30);
  return h('div', { class: 'screen dim mp' }, h('div', { class: 'panel bulbs mp-panel' },
    h('h2', { class: 'title-text' }, 'Join a Game'),
    h('div', { class: 'muted' }, 'Type the six-character code from the host’s lobby.'),
    input,
    h('div', { class: 'menu' },
      btn(o.busy ? 'Connecting…' : 'Join', () => { c.click(); o.join(input.value); }, '', { 'data-default': '', disabled: o.busy || undefined }),
      btn('Back', () => { c.click(); o.back(); }, 'small red'),
    ),
    h('div', { class: `mp-status ${o.tone}${o.status ? '' : ' hidden'}` }, o.status),
  ));
}

// ===================================================================== lobby
export interface LobbyActions {
  pick: (id: string) => void;
  ready: (r: boolean) => void;
  /** host only: the night's world tier (D-97) and the Curse */
  tier: (t: TierId, curse: boolean) => void;
  /** host only: choose the night's map (D-63) */
  map?: (id: MapId) => void;
  start: () => void;
  leave: () => void;
  /** host with the Midway unlocked: take everyone back to the hub instead of starting (D-60) */
  midway?: () => void;
  /** step into the Lost & Found and come back to this lobby, seat kept (D-74) */
  lostfound?: () => void;
}

export function lobbyScreen(c: UICtx, lobby: LobbyState, me: number, o: { canStart: boolean; status: string; tone: 'info' | 'warn'; actions: LobbyActions }): HTMLElement {
  const s = c.save;
  const host = me === 0;
  const mine = lobby.players[me];
  const myChar = mine?.character ?? null;
  const guests = lobby.players.filter((p, i) => p && i > 0).length;
  const copy = () => {
    // the live button (the lobby refreshes in place, so this closure's own copy may not be the one on screen)
    const live = (): HTMLElement => document.querySelector<HTMLElement>('.mp-code .btn') ?? copyBtn;
    void navigator.clipboard?.writeText(lobby.code).then(
      () => (live().textContent = 'Copied!'),
      () => (live().textContent = 'Copy failed'),
    );
  };
  const copyBtn = btn('Copy', () => { c.click(); copy(); }, 'small purple');
  // the world tier (D-97): whom tonight counts for. On Normal only the Ghost Train matters (it opens Nightmare): its
  // other maps still open through their bosses' achievements, as they always have.
  const tier = TIERS[lobby.tier] ?? TIERS.normal;
  const visiting = (counts: boolean | undefined) => counts === false && (lobby.tier !== 'normal' || lobby.map === 'ghost_train');
  const card = (i: number) => {
    const p = lobby.players[i];
    if (!p) return h('div', { class: 'mp-card empty' }, h('div', { class: 'mp-who' }, `Player ${i + 1}`), h('div', { class: 'mp-wait' }, 'Open seat'), i === guests + 1 ? h('div', { class: 'muted' }, 'Send a friend the code above.') : null);
    const ch = p.character ? CHARACTER_MAP[p.character] : null;
    return h('div', { class: `mp-card p${i + 1}${p.ready ? ' ready' : ''}${p.connected ? '' : ' gone'}` },
      h('div', { class: 'mp-who' }, `Player ${i + 1}${i === me ? ' (you)' : ''}${i === 0 ? ' · Host' : ''}`),
      ch ? h('img', { class: 'mp-portrait', src: c.assets.portrait(ch.id), alt: '' }) : h('div', { class: 'mp-portrait none' }, '?'),
      h('div', { class: 'mp-name' }, p.name),
      h('div', { class: 'mp-char' }, ch ? ch.name : 'Choosing…'),
      h('div', { class: `mp-badge${p.ready ? ' on' : ''}${p.away ? ' away' : ''}` }, !p.connected ? 'Reconnecting…' : p.away ? 'At the Lost & Found' : p.ready ? 'READY' : 'Not ready'),
      i !== me && p.rtt ? h('div', { class: 'mp-ping' }, `${p.rtt} ms`) : null,
      visiting(p.counts) ? h('div', { class: 'mp-visit', title: `${tier.name}'s ${MAPS[lobby.map]?.name ?? 'night'} isn't open on their save: tonight won't count toward their own campaign` }, 'Visiting') : null,
    );
  };
  const grid = h('div', { class: 'mp-grid' }, ...CHARACTERS.map((ch) => {
    const avail = s.characterAvailable(ch.id);
    const sel = ch.id === myChar;
    // characters may repeat in a party: dots show who else picked this one
    const pickers = lobby.players.map((p, i) => (p?.character === ch.id && i !== me ? i : -1)).filter((i) => i >= 0);
    return h('div', {
      class: `char-card${sel ? ' sel' : ''}${avail ? '' : ' locked'}`,
      'data-nav': avail ? '' : undefined,
      title: avail ? ch.title + (pickers.length ? ` — also picked by ${pickers.map((i) => lobby.players[i]!.name).join(', ')}` : '') : 'Locked on this save',
      onclick: () => { if (!avail || lobby.inRun) return; c.click(); o.actions.pick(ch.id); },
    }, h('img', { src: c.assets.portrait(ch.id), alt: ch.name }), pickers.length ? h('div', { class: 'picked' }, ...pickers.map((i) => h('i', { class: `p${i + 1}` }))) : null, h('div', { class: `nm${avail && ch.name.replace('The ', '').length > 8 ? ' long' : ''}` }, avail ? ch.name.replace('The ', '') : '???'));
  }));
  const chDef = myChar ? CHARACTER_MAP[myChar] : null;
  const detail = chDef
    ? h('div', { class: 'mp-detail' }, h('b', {}, chDef.name), ' — ', chDef.quirkName, h('div', { class: 'muted' }, `Starts with ${WEAPONS[chDef.startWeapon].name}. ${chDef.quirkDesc}`))
    : h('div', { class: 'mp-detail muted' }, 'Pick your fool. Friends may pick the same one.');
  const tierRow = host
    ? h('div', { class: 'diff-row tier-row' }, ...tierButtons(c, lobby.tier, (t) => o.actions.tier(t, lobby.curse)),
        h('div', { class: `toggle${lobby.curse ? ' on' : ''}${s.curseAvailable() ? '' : ' disabled'}`, 'data-nav': '', onclick: () => { if (!s.curseAvailable()) return; c.click(); o.actions.tier(lobby.tier, !lobby.curse); } }, h('span', { class: 'box' }), s.curseAvailable() ? 'Curse' : `Curse (locked \u2014 ${CURSE.unlock.reqText})`))
    : h('div', { class: `muted tier-desc tier-${tier.id}` }, h('b', {}, `${tier.name}: ${tier.title}`), `${lobby.curse ? ' \u00b7 Cursed' : ''} (the host chooses)`);
  const mapRow = host && o.actions.map
    ? h('div', { class: 'diff-row map-row' }, ...mapButtons(c, lobby.tier, lobby.map, (m) => o.actions.map!(m)))
    : h('div', { class: 'muted' }, `Tonight: ${MAPS[lobby.map]?.name ?? lobby.map}${host ? '' : ' (the host chooses)'}`);
  // a guest hears whether tonight counts for them; the host, for whom it doesn't
  const visitors = lobby.players.flatMap((p, i) => (p && i > 0 && visiting(p.counts) ? [p.name] : []));
  const mineCounts = s.countsFor(lobby.tier, lobby.map) || !visiting(false);
  const countLine = host
    ? visitors.length ? h('div', { class: 'muted tier-note warn' }, `Tonight won't count toward ${visitors.join(', ')}'s own campaign (not open on their save); they keep their Lost Tickets and achievements.`) : null
    : h('div', { class: `muted tier-note${mineCounts ? '' : ' warn'}` }, mineCounts
      ? `Tonight counts toward your own ${tier.name} campaign.`
      : `Tonight won't count toward your own campaign: ${s.tierUnlocked(lobby.tier) ? `${MAPS[lobby.map]?.name} isn't open on ${tier.name} on your save yet` : `${tier.name} isn't open on your save (${tier.unlockText.toLowerCase()})`}. You keep your Lost Tickets and achievements.`);
  const ready = !!mine?.ready;
  const actions = h('div', { class: 'cs-actions' },
    btn('Leave', () => { c.click(); o.actions.leave(); }, 'small red'),
    o.actions.midway ? btn('Back to the Midway', () => { c.click(); o.actions.midway!(); }, 'small') : null,
    o.actions.lostfound ? btn('Lost & Found', () => { c.click(); o.actions.lostfound!(); }, 'small purple', { title: 'Spend Lost Tickets without leaving the lobby' }) : null,
    btn(ready ? 'Not Ready' : 'Ready!', () => { if (!myChar) return; c.click(); o.actions.ready(!ready); }, ready ? 'small' : 'purple', { disabled: !myChar || undefined, 'data-default': host ? undefined : '' }),
    host ? btn('Start the Night!', () => { if (!o.canStart) return; c.click(); o.actions.start(); }, '', { disabled: !o.canStart || undefined, 'data-default': '' }) : null,
  );
  const hint = host
    ? o.canStart ? 'Everyone is ready — pull the lever!' : !guests ? 'Share the code; friends join from Multiplayer → Join a Game (up to six players).' : 'Start unlocks when everyone has picked a character and is ready.'
    : 'The host starts the night when everyone is ready.';
  return h('div', { class: 'screen dim mp lobby' }, h('div', { class: 'panel bulbs mp-lobby' },
    h('div', { class: 'mp-head' },
      h('h2', { class: 'title-text' }, 'Choose Your Fools'),
      h('div', { class: 'mp-code' }, h('small', {}, 'LOBBY CODE'), h('b', {}, lobby.code || '······'), host ? copyBtn : null),
    ),
    h('div', { class: 'mp-cards six' }, ...lobby.players.map((_, i) => card(i))),
    grid,
    detail,
    tierRow,
    mapRow,
    countLine,
    h('div', { class: 'muted mp-hint' }, hint),
    actions,
    h('div', { class: `mp-status ${o.tone}${o.status ? '' : ' hidden'}` }, o.status),
  ));
}

// ===================================================================== the Midway menu (D-60)
/** The hub's pause menu: a plain panel of choices. */
export function menuPanel(c: UICtx, title: string, text: string, actions: { label: string; fn: () => void; cls?: string }[]): HTMLElement {
  return h('div', { class: 'screen dim mp' }, h('div', { class: 'panel bulbs mp-panel' },
    h('h2', { class: 'title-text' }, title),
    text ? h('div', { class: 'muted' }, text) : null,
    h('div', { class: 'menu' }, ...actions.map((a, i) => btn(a.label, () => { c.click(); a.fn(); }, a.cls ?? '', i === 0 ? { 'data-default': '' } : {}))),
  ));
}

/** Swap Character on the Midway (D-84): every performer this save owns; the one you walk as is picked. */
export function characterPanel(c: UICtx, current: string, pick: (id: string) => void, back: () => void): HTMLElement {
  const s = c.save;
  const cur = CHARACTER_MAP[current as keyof typeof CHARACTER_MAP];
  return h('div', { class: 'screen dim mp' }, h('div', { class: 'panel bulbs mp-panel swap-panel' },
    h('h2', { class: 'title-text' }, 'Swap Character'),
    h('div', { class: 'muted' }, 'Who you walk the Midway as, and who starts your next night.'),
    h('div', { class: 'mp-grid swap-grid' }, ...CHARACTERS.map((ch) => {
      const avail = s.characterAvailable(ch.id);
      return h('div', {
        class: `char-card${ch.id === current ? ' sel' : ''}${avail ? '' : ' locked'}`,
        'data-nav': avail ? '' : undefined,
        'data-default': ch.id === current ? '' : undefined,
        title: avail ? ch.title : 'Locked on this save',
        onclick: () => { if (!avail) return; c.click(); pick(ch.id); },
      }, h('img', { src: c.assets.portrait(ch.id), alt: ch.name }), h('div', { class: `nm${avail && ch.name.replace('The ', '').length > 8 ? ' long' : ''}` }, avail ? ch.name.replace('The ', '') : '???'));
    })),
    // the one you walk as, in full: who they are, their quirk, the weapon they start with
    cur ? h('div', { class: 'swap-detail' },
      h('img', { class: 'swap-full', src: c.assets.charFull(cur.id, 1), alt: '' }),
      h('div', { class: 'swap-text' },
        h('h3', {}, cur.name), h('div', { class: 'sub' }, cur.title),
        h('div', { class: 'quirk' }, h('b', {}, cur.quirkName), ' — ', cur.quirkDesc),
        h('div', { class: 'weapon-line' }, h('img', { src: c.assets.weaponIcon(cur.startWeapon), alt: '' }), h('div', {}, h('b', {}, WEAPONS[cur.startWeapon].name), h('div', { class: 'muted' }, WEAPONS[cur.startWeapon].desc))))) : null,
    h('div', { class: 'menu' }, btn('Back', () => { c.click(); back(); }, 'small red')),
  ));
}

/**
 * Companions (D-84): each pet with its passive; the earned ones to choose (it follows you here at once, and into the
 * next night), the rest saying what brings them along.
 */
export function petPanel(c: UICtx, current: string | null, pick: (id: string | null) => void, back: () => void): HTMLElement {
  const s = c.save;
  const card = (id: string | null) => {
    const p = id ? PET_MAP[id] : null;
    const owned = !p || s.petUnlocked(p.id);
    const ach = p ? ACHIEVEMENTS.find((a) => a.id === p.achievement) : undefined;
    return h('div', {
      class: `pet-card${current === id ? ' sel' : ''}${owned ? '' : ' locked'}`,
      'data-nav': owned ? '' : undefined,
      'data-default': current === id ? '' : undefined,
      onclick: () => { if (!owned) return; c.click(); pick(id); },
    },
      p ? h('img', { src: c.assets.petPortrait(p.id), alt: p.name }) : h('div', { class: 'pet-none' }, '—'),
      h('div', { class: 'nm' }, p ? p.name : 'No companion'),
      h('div', { class: 'ds' }, p ? `${p.breed} · ${p.buffName}: ${p.buff}` : 'Walk the night alone'),
      p && !owned ? h('div', { class: 'lock' }, `🔒 ${ach?.name}: ${ach?.desc}`) : null);
  };
  const cur = current ? PET_MAP[current] : null;
  return h('div', { class: 'screen dim mp' }, h('div', { class: 'panel bulbs mp-panel pets' },
    h('h2', { class: 'title-text' }, 'Companions'),
    h('div', { class: 'muted' }, 'A companion follows you everywhere, its own passive on your stats. Each is earned by an achievement you can finish on any map.'),
    h('div', { class: 'pet-grid' }, card(null), ...PETS.map((p) => card(p.id))),
    cur ? h('div', { class: 'mp-detail' }, h('b', {}, cur.name), ` — ${cur.lore}`) : null,
    h('div', { class: 'menu' }, btn('Back', () => { c.click(); back(); }, 'small red')),
  ));
}

/**
 * World Tier on the Midway (D-100): the three carnivals as cards, the open ones to choose (the Midway takes on its
 * look and music at once), the locked ones saying what opens them, each open one with how far this save has got.
 */
export function tierPanel(c: UICtx, current: TierId, pick: (t: TierId) => void, back: () => void): HTMLElement {
  const s = c.save;
  const card = (t: TierId) => {
    const d = TIERS[t];
    const ok = s.tierUnlocked(t);
    const won = MAP_IDS.filter((m) => s.tierWins(t, m) > 0).length;
    return h('div', {
      class: `tier-card tier-${t}${t === current ? ' sel' : ''}${ok ? '' : ' locked'}`,
      'data-nav': ok ? '' : undefined,
      'data-default': t === current ? '' : undefined,
      onclick: () => { if (!ok) return; c.click(); pick(t); },
    },
      h('div', { class: 'tc-name' }, ok ? d.name : `\u{1F512} ${d.name}`),
      h('div', { class: 'tc-title' }, d.title),
      h('div', { class: 'tc-desc' }, d.desc),
      h('div', { class: 'tc-foot' },
        t === current ? h('span', { class: 'tc-now' }, 'Current') : null,
        !ok ? d.unlockText : s.tierComplete(t) ? '\u2605 Campaign finished' : `${won} of ${MAP_IDS.length} maps won`));
  };
  return h('div', { class: 'screen dim mp' }, h('div', { class: 'panel bulbs mp-panel tier-panel' },
    h('h2', { class: 'title-text' }, 'World Tier'),
    h('div', { class: 'muted' }, 'Which carnival your nights are played in. The Midway takes on its look and its music.'),
    h('div', { class: 'tier-grid' }, ...TIER_IDS.map(card)),
    h('div', { class: 'menu' }, btn('Back', () => { c.click(); back(); }, 'small red')),
  ));
}

// ===================================================================== in-run notices
/** A small modal for network trouble: the host left, the connection dropped, a refused join. */
export function netNotice(c: UICtx, title: string, text: string, actions: { label: string; fn: () => void; cls?: string }[]): HTMLElement {
  return h('div', { class: 'screen dim mp' }, h('div', { class: 'panel bulbs mp-panel' },
    h('h2', { class: 'title-text' }, title),
    h('div', { class: 'mp-status warn' }, text),
    h('div', { class: 'menu' }, ...actions.map((a, i) => btn(a.label, () => { c.click(); a.fn(); }, a.cls ?? '', i === 0 ? { 'data-default': '' } : {}))),
  ));
}
