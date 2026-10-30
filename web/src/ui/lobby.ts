// Online co-op screens (D-52): the Multiplayer menu (name, host, join), the join-by-code screen and
// the lobby — a marquee with the lobby code, both players' cards, a character grid (characters are
// exclusive, as in Vampire Survivors), ready toggles and, for the host, difficulty and the start lever.

import { CHARACTERS, CHARACTER_MAP } from '../data/characters';
import { DIFFICULTIES, CURSE } from '../data/difficulty';
import { WEAPONS } from '../data/weapons';
import type { LobbyState } from '../net/protocol';
import type { Reach } from '../net/peer';
import { CODE_LENGTH } from '../net/codes';
import type { UICtx } from './screens';
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

export function multiplayerMenu(c: UICtx, o: { name: string; status: string; busy: boolean; reach: Reach | null; host: (name: string) => void; join: (name: string) => void; back: () => void }): HTMLElement {
  const input = h('input', { class: 'mp-input', type: 'text', maxlength: '16', value: o.name, placeholder: 'Your name', 'aria-label': 'Your name', 'data-nav': '', spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
  const nm = () => input.value.trim() || 'Player';
  return h('div', { class: 'screen dim mp' }, h('div', { class: 'panel bulbs mp-panel' },
    h('h2', { class: 'title-text' }, 'Online Night'),
    h('div', { class: 'muted' }, 'Play the same night with up to five friends: shared tickets and levels, your own builds. One of you hosts; the others join with the host’s code.'),
    h('label', { class: 'mp-label' }, 'Your name', input),
    h('div', { class: 'menu' },
      btn('Host a Game', () => { c.click(); o.host(nm()); }, '', { 'data-default': '', disabled: o.busy || undefined }),
      btn('Join a Game', () => { c.click(); o.join(nm()); }, 'purple', { disabled: o.busy || undefined }),
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
  difficulty: (id: string, curse: boolean) => void;
  start: () => void;
  leave: () => void;
  /** host with the Midway unlocked: take everyone back to the hub instead of starting (D-60) */
  midway?: () => void;
}

export function lobbyScreen(c: UICtx, lobby: LobbyState, me: number, o: { canStart: boolean; status: string; tone: 'info' | 'warn'; actions: LobbyActions }): HTMLElement {
  const s = c.save;
  const host = me === 0;
  const mine = lobby.players[me];
  const myChar = mine?.character ?? null;
  const guests = lobby.players.filter((p, i) => p && i > 0).length;
  const copy = () => {
    void navigator.clipboard?.writeText(lobby.code).then(
      () => (copyBtn.textContent = 'Copied!'),
      () => (copyBtn.textContent = 'Copy failed'),
    );
  };
  const copyBtn = btn('Copy', () => { c.click(); copy(); }, 'small purple');
  const card = (i: number) => {
    const p = lobby.players[i];
    if (!p) return h('div', { class: 'mp-card empty' }, h('div', { class: 'mp-who' }, `Player ${i + 1}`), h('div', { class: 'mp-wait' }, 'Open seat'), i === guests + 1 ? h('div', { class: 'muted' }, 'Send a friend the code above.') : null);
    const ch = p.character ? CHARACTER_MAP[p.character] : null;
    return h('div', { class: `mp-card p${i + 1}${p.ready ? ' ready' : ''}${p.connected ? '' : ' gone'}` },
      h('div', { class: 'mp-who' }, `Player ${i + 1}${i === me ? ' (you)' : ''}${i === 0 ? ' · Host' : ''}`),
      ch ? h('img', { class: 'mp-portrait', src: c.assets.portrait(ch.id), alt: '' }) : h('div', { class: 'mp-portrait none' }, '?'),
      h('div', { class: 'mp-name' }, p.name),
      h('div', { class: 'mp-char' }, ch ? ch.name : 'Choosing…'),
      h('div', { class: `mp-badge${p.ready ? ' on' : ''}` }, !p.connected ? 'Reconnecting…' : p.ready ? 'READY' : 'Not ready'),
      i !== me && p.rtt ? h('div', { class: 'mp-ping' }, `${p.rtt} ms`) : null,
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
    }, h('img', { src: c.assets.portrait(ch.id), alt: ch.name }), pickers.length ? h('div', { class: 'picked' }, ...pickers.map((i) => h('i', { class: `p${i + 1}` }))) : null, h('div', { class: 'nm' }, avail ? ch.name.replace('The ', '') : '???'));
  }));
  const chDef = myChar ? CHARACTER_MAP[myChar] : null;
  const detail = chDef
    ? h('div', { class: 'mp-detail' }, h('b', {}, chDef.name), ' — ', chDef.quirkName, h('div', { class: 'muted' }, `Starts with ${WEAPONS[chDef.startWeapon].name}. ${chDef.quirkDesc}`))
    : h('div', { class: 'mp-detail muted' }, 'Pick your fool. Friends may pick the same one.');
  const diffRow = host
    ? h('div', { class: 'diff-row' }, ...DIFFICULTIES.map((d) => {
        const ok = s.difficultyAvailable(d.id);
        return h('button', { class: `diff-btn${d.id === lobby.difficulty ? ' sel' : ''}`, 'data-nav': '', disabled: !ok || undefined, title: ok ? d.desc : `Locked — ${d.unlock?.reqText}`, onclick: () => { c.click(); o.actions.difficulty(d.id, lobby.curse); } }, ok ? d.name : `🔒 ${d.name}`);
      }), h('div', { class: `toggle${lobby.curse ? ' on' : ''}${s.curseAvailable() ? '' : ' disabled'}`, 'data-nav': '', onclick: () => { if (!s.curseAvailable()) return; c.click(); o.actions.difficulty(lobby.difficulty, !lobby.curse); } }, h('span', { class: 'box' }), s.curseAvailable() ? 'Curse' : `Curse (locked — ${CURSE.unlock.reqText})`))
    : h('div', { class: 'muted' }, `Difficulty: ${DIFFICULTIES.find((d) => d.id === lobby.difficulty)?.name ?? lobby.difficulty}${lobby.curse ? ' · Cursed' : ''} (the host chooses)`);
  const ready = !!mine?.ready;
  const actions = h('div', { class: 'cs-actions' },
    btn('Leave', () => { c.click(); o.actions.leave(); }, 'small red'),
    o.actions.midway ? btn('Back to the Midway', () => { c.click(); o.actions.midway!(); }, 'small') : null,
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
    diffRow,
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

// ===================================================================== in-run notices
/** A small modal for network trouble: the host left, the connection dropped, a refused join. */
export function netNotice(c: UICtx, title: string, text: string, actions: { label: string; fn: () => void; cls?: string }[]): HTMLElement {
  return h('div', { class: 'screen dim mp' }, h('div', { class: 'panel bulbs mp-panel' },
    h('h2', { class: 'title-text' }, title),
    h('div', { class: 'mp-status warn' }, text),
    h('div', { class: 'menu' }, ...actions.map((a, i) => btn(a.label, () => { c.click(); a.fn(); }, a.cls ?? '', i === 0 ? { 'data-default': '' } : {}))),
  ));
}
