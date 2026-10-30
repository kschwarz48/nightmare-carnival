// Menu screens: title, character select (+difficulty/curse), daily run, pause, results, Lost &
// Found, Carnival-pedia, settings. Every interactive element carries data-nav for controller play.

import { CHARACTERS, CHARACTER_MAP } from '../data/characters';
import { DIFFICULTIES, CURSE } from '../data/difficulty';
import { ACHIEVEMENTS, PERKS, UNLOCKS } from '../data/meta';
import { BOSSES } from '../data/bosses';
import { ENEMIES, PEDIA_ENEMIES } from '../data/enemies';
import { PASSIVES, WEAPONS, BASE_WEAPON_IDS, EVOLUTION_IDS, PASSIVE_IDS } from '../data/weapons';
import { dailySeedString, hashSeed, Rng } from '../core/rng';
import type { Assets } from '../render/assets';
import type { AudioEngine } from '../audio/audio';
import type { SaveManager, Settings } from '../meta/save';
import { DEFAULT_BINDINGS } from '../meta/save';
import type { Input } from '../input/input';
import type { RunStats } from '../sim/game';
import { h, fmtNum, fmtTime } from './dom';

export interface UICtx {
  save: SaveManager;
  assets: Assets;
  audio: AudioEngine;
  input: Input;
  click: () => void;
  go: (screen: string, arg?: any) => void;
  startRun: (o: { character: string; difficulty: string; curse: boolean; daily?: boolean }) => void;
  applySettings: () => void;
}

const btn = (label: string | Node, onclick: () => void, cls = '', extra: Record<string, any> = {}) => h('button', { class: `btn ${cls}`, 'data-nav': '', onclick, ...extra }, label);

// ===================================================================== loading
export function loadingScreen(): { el: HTMLElement; set: (p: number, tip?: string) => void } {
  const fill = h('div', { class: 'fill' });
  const tip = h('div', { class: 'tip' }, 'Painting the midway…');
  const el = h('div', { class: 'screen loading' }, h('h1', { class: 'title-text', style: { fontSize: '3em' } }, 'NIGHTMARE CARNIVAL'), h('div', { class: 'bar' }, fill), tip);
  return { el, set: (p, t) => { fill.style.width = `${Math.round(p * 100)}%`; if (t) tip.textContent = t; } };
}

// ===================================================================== title
export function titleScreen(c: UICtx): HTMLElement {
  const s = c.save;
  const menu = h('div', { class: 'menu' },
    btn('Step Right Up', () => { c.click(); c.go('charselect'); }, '', { 'data-default': '' }),
    btn('Daily Run', () => { c.click(); c.go('daily'); }, 'purple', { disabled: !s.dailyAvailable() || undefined, title: s.dailyAvailable() ? '' : 'Finish one run to unlock' }),
    btn('Multiplayer', () => { c.click(); c.go('mp'); }, 'purple'),
    btn('Lost & Found', () => { c.click(); c.go('lostfound'); }),
    btn('Carnival-pedia', () => { c.click(); c.go('pedia'); }),
    btn('Settings', () => { c.click(); c.go('settings', 'title'); }),
  );
  return h('div', { class: 'screen title' },
    h('img', { class: 'logo', src: c.assets.logo(), alt: 'Nightmare Carnival' }),
    h('div', { class: 'tagline' }, 'Survive from midnight to dawn'),
    menu,
    h('div', { class: 'wallet' }, h('span', { class: 'ticket-count' }, fmtNum(s.data.lostTickets))),
    h('div', { class: 'corner-left' }, s.recovered ? 'Your save was restored from its backup slot.' : 'WASD / arrows / left stick to move · weapons fire automatically · Esc to pause'),
    h('div', { class: 'corner' }, `Runs ${s.data.stats.runs} · Wins ${s.data.stats.wins}`, h('br'), 'Music: "Freaky Funk Circus" — Bradley Schwarz'),
  );
}

export function pressStart(c: UICtx, onStart: () => void): HTMLElement {
  const el = h('div', { class: 'screen title', 'data-nav': '', onclick: onStart },
    h('img', { class: 'logo', src: c.assets.logo(), alt: 'Nightmare Carnival' }),
    h('div', { class: 'tagline' }, 'A 1930s cartoon-horror survivors-like'),
    h('div', { class: 'press-start' }, 'Click or press any button'),
  );
  return el;
}

// ===================================================================== character select
export function charSelectScreen(c: UICtx): HTMLElement {
  const s = c.save;
  let selChar = s.characterAvailable(s.data.last.character) ? s.data.last.character : 'carny';
  let selDiff = s.difficultyAvailable(s.data.last.difficulty) ? s.data.last.difficulty : 'midway';
  let curse = s.curseAvailable() && s.data.last.curse;
  const grid = h('div', { class: 'char-grid panel' });
  const detail = h('div', { class: 'char-detail panel' });
  const render = () => {
    grid.replaceChildren(...CHARACTERS.map((ch) => {
      const avail = s.characterAvailable(ch.id);
      return h('div', { class: `char-card${ch.id === selChar ? ' sel' : ''}${avail ? '' : ' locked'}`, 'data-nav': '', onclick: () => { c.click(); selChar = ch.id; render(); } },
        h('img', { src: c.assets.portrait(ch.id), alt: ch.name }), h('div', { class: 'nm' }, avail ? ch.name.replace('The ', '') : '???'));
    }));
    const ch = CHARACTER_MAP[selChar];
    const avail = s.characterAvailable(ch.id);
    const statBar = (label: string, v: number, max: number) => [h('span', {}, label), h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, (v / max) * 100)}%` } }))];
    const might = 1 + (ch.mods.might ?? 0);
    const w = WEAPONS[ch.startWeapon];
    detail.replaceChildren(
      h('div', { class: 'hero' }, h('img', { src: c.assets.charFull(ch.id, 1), alt: '' }), h('div', {}, h('h3', {}, avail ? ch.name : '??? Locked'), h('div', { class: 'sub' }, ch.title), h('div', { class: 'muted', style: { marginTop: '0.4em' } }, avail ? ch.desc : ch.unlock?.reqText ?? ''))),
      h('div', { class: 'stat-row' }, ...statBar('Health', ch.hp, 150), ...statBar('Speed', ch.speed, 264), ...statBar('Might', might, 1.25)),
      h('div', { class: 'quirk' }, h('b', {}, ch.quirkName), ' — ', ch.quirkDesc),
      h('div', { class: 'weapon-line' }, h('img', { src: c.assets.weaponIcon(w.id), alt: '' }), h('div', {}, h('b', {}, w.name), h('div', { class: 'muted' }, w.desc))),
      avail ? '' : h('div', { class: 'unlock-note' }, s.characterRequirementMet(ch.id) ? `Requirement met! Unlock in the Lost & Found for ${ch.unlock!.cost} Lost Tickets.` : `Locked — ${ch.unlock!.reqText}, then ${ch.unlock!.cost} Lost Tickets.`),
      h('div', { class: 'section-title', style: { margin: '0.4em 0 0' } }, 'Difficulty'),
      h('div', { class: 'diff-row' }, ...DIFFICULTIES.map((d) => {
        const ok = s.difficultyAvailable(d.id);
        return h('button', { class: `diff-btn${d.id === selDiff ? ' sel' : ''}`, 'data-nav': '', disabled: !ok || undefined, title: ok ? d.desc : `Locked — ${d.unlock?.reqText}`, onclick: () => { c.click(); selDiff = d.id; render(); } }, ok ? d.name : `🔒 ${d.name}`);
      })),
      h('div', { class: 'muted' }, DIFFICULTIES.find((d) => d.id === selDiff)!.desc),
      h('div', { class: `toggle${curse ? ' on' : ''}${s.curseAvailable() ? '' : ' disabled'}`, 'data-nav': '', onclick: () => { c.click(); curse = !curse; render(); } },
        h('span', { class: 'box' }), s.curseAvailable() ? `Curse — faster, denser, tougher · +35% Lost Tickets` : `Curse (locked — ${CURSE.unlock.reqText})`),
      h('div', { class: 'cs-actions' },
        btn('Back', () => { c.click(); c.go('title'); }, 'small red'),
        btn('Start the Night!', () => { if (!avail) return; c.click(); c.startRun({ character: selChar, difficulty: selDiff, curse }); }, '', { disabled: !avail || undefined, 'data-default': '' }),
      ),
    );
  };
  render();
  return h('div', { class: 'screen charselect dim' }, h('h2', { class: 'title-text' }, 'Choose Your Fool'), h('div', { class: 'layout' }, grid, detail));
}

// ===================================================================== daily run
export function dailyInfo(): { seed: string; character: string; mod: string; modName: string } {
  const seed = dailySeedString();
  const r = new Rng(hashSeed('daily' + seed));
  const character = r.pick(CHARACTERS).id;
  const mods = [['none', 'Standard night'], ['glass', 'Glass Cannon: +30% Might, −30% Max HP'], ['curse', 'Cursed: the Curse is active']];
  const m = r.pick(mods);
  return { seed, character, mod: m[0], modName: m[1] };
}

export function dailyScreen(c: UICtx): HTMLElement {
  const d = dailyInfo();
  const best = c.save.data.daily[d.seed];
  const ch = CHARACTER_MAP[d.character];
  const recent = Object.entries(c.save.data.daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  return h('div', { class: 'screen dim' }, h('div', { class: 'panel bulbs', style: { padding: '1.6em 2.4em', width: 'min(620px, 94vw)', textAlign: 'center' } },
    h('h2', { class: 'title-text', style: { fontSize: '2.4em' } }, 'Daily Run'),
    h('div', { class: 'progress-line' }, `Seed ${d.seed} (UTC)`),
    h('div', { style: { display: 'flex', gap: '1em', alignItems: 'center', justifyContent: 'center', margin: '1em 0' } }, h('img', { src: c.assets.portrait(ch.id), style: { width: '96px', height: '96px', borderRadius: '50%', border: '3px solid #17110e' } }), h('div', { style: { textAlign: 'left' } }, h('h3', {}, ch.name), h('div', {}, 'Carnival difficulty'), h('div', { class: 'muted' }, d.modName))),
    h('p', { class: 'muted' }, 'Everyone gets the same seed today: same character, same draws, same night. All characters and weapons are available. Scores are kept locally on this device — there is no online leaderboard.'),
    h('div', { class: 'payout', style: { fontSize: '1.4em' } }, best ? `Your best today: ${fmtNum(best.score)}${best.won ? ' ✦' : ''}` : 'No attempt yet today'),
    recent.length ? h('div', { class: 'muted', style: { margin: '0.6em 0' } }, 'Recent: ' + recent.map(([k, v]) => `${k.slice(4, 6)}/${k.slice(6)} ${fmtNum(v.score)}`).join(' · ')) : null,
    h('div', { class: 'cs-actions' }, btn('Back', () => { c.click(); c.go('title'); }, 'small red'), btn('Begin', () => { c.click(); c.startRun({ character: d.character, difficulty: 'carnival', curse: d.mod === 'curse', daily: true }); }, '', { 'data-default': '' })),
  ));
}

// ===================================================================== pause
export function pauseScreen(c: UICtx, g: { weapons: string[]; passives: string[]; time: number; kills: number }, onResume: () => void, onQuit: () => void, quitLabel = 'Abandon Night'): HTMLElement {
  return h('div', { class: 'screen pause dim' }, h('div', { class: 'panel bulbs' },
    h('h2', { class: 'title-text', style: { fontSize: '2.6em' } }, 'Intermission'),
    h('div', { class: 'muted' }, `${fmtTime(g.time)} · ${fmtNum(g.kills)} defeated`),
    h('div', { class: 'build-summary' }, ...g.weapons.map((id) => h('img', { src: c.assets.weaponIcon(id), title: WEAPONS[id]?.name })), ...g.passives.map((id) => h('img', { src: c.assets.passiveIcon(id), title: PASSIVES[id]?.name }))),
    btn('Resume', () => { c.click(); onResume(); }, '', { 'data-default': '' }),
    btn('Settings', () => { c.click(); c.go('settings', 'pause'); }),
    btn(quitLabel, () => { c.click(); onQuit(); }, 'red'),
  ));
}

// ===================================================================== results
export function resultsScreen(c: UICtx, st: RunStats, extra: { achievements: string[]; newUnlocks: string[]; dailyBest: boolean }, actions: { again: () => void; againLabel?: string; menu: () => void; lostfound: () => void; endless?: () => void }): HTMLElement {
  const total = Math.max(1, st.weapons.reduce((n, w) => n + w.damage, 0));
  const ch = CHARACTER_MAP[st.character];
  const won = st.won;
  const flavor = st.trueEnding ? 'The last note fades. The Calliope falls silent, and for one night the carnival truly sleeps.' : st.endless ? `Locked in for ${fmtTime(st.endlessTime)} past dawn.` : won ? 'The sun crests the sea. The rides fall silent — until tomorrow night.' : st.time >= 1440 ? 'So close to dawn… the Ringmaster takes a bow over you.' : st.time >= 720 ? 'The carnival claims another fool. Your ticket stubs scatter in the wind.' : 'Lights out. The calliope plays on without you.';
  const payout = h('div', { class: 'payout' }, '+0');
  let shown = 0;
  const step = () => {
    shown = Math.min(st.lostTickets, shown + Math.max(1, Math.ceil(st.lostTickets / 40)));
    payout.textContent = `+${fmtNum(shown)} Lost Tickets`;
    if (shown < st.lostTickets) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  const rows = st.weapons.slice().sort((a, b) => b.damage - a.damage).map((w) => h('tr', {}, h('td', {}, h('img', { src: c.assets.weaponIcon(w.id) })), h('td', {}, WEAPONS[w.id]?.name ?? w.id), h('td', {}, WEAPONS[w.id]?.isEvolution ? '✦' : `Lv ${w.level}`), h('td', { class: 'barcell' }, h('i', { style: { width: `${(w.damage / total) * 100}%` } })), h('td', {}, fmtNum(w.damage))));
  const buttons = h('div', { class: 'cs-actions' });
  if (actions.endless && won && !st.endless) buttons.append(btn('Lock In (Endless)', () => { c.click(); actions.endless!(); }, 'red'));
  buttons.append(btn(actions.againLabel ?? (st.daily ? 'Menu' : 'Run Again'), () => { c.click(); (st.daily && !actions.againLabel ? actions.menu : actions.again)(); }, '', { 'data-default': '' }), btn('Lost & Found', () => { c.click(); actions.lostfound(); }, 'purple'), btn('Main Menu', () => { c.click(); actions.menu(); }, 'small'));
  return h('div', { class: 'screen results dim' }, h('div', { class: 'panel bulbs' },
    h('h1', { class: `title-text ${won ? 'win' : 'lose'}` }, st.trueEnding ? 'THE LAST SONG' : st.endless ? 'CURTAIN CALL' : won ? 'DAWN!' : 'YOU DIED'),
    h('div', { class: 'flavor' }, flavor),
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '0.8em' } }, h('img', { src: c.assets.portrait(st.character), style: { width: '64px', height: '64px', borderRadius: '50%', border: '3px solid #17110e' } }), h('div', {}, h('b', {}, ch?.name ?? ''), h('div', { class: 'muted' }, `${st.difficulty[0].toUpperCase()}${st.difficulty.slice(1)}${st.curse ? ' · Cursed' : ''}${st.daily ? ' · Daily' : ''}`))),
    h('div', { class: 'stat-grid' },
      h('div', {}, h('b', {}, fmtTime(st.time)), 'Survived'), h('div', {}, h('b', {}, fmtNum(st.kills)), 'Defeated'),
      h('div', {}, h('b', {}, String(st.level)), 'Level'), h('div', {}, h('b', {}, `${st.bosses}/4`), 'Bosses'),
      h('div', {}, h('b', {}, fmtNum(st.damageDealt)), 'Damage dealt'), h('div', {}, h('b', {}, fmtNum(st.damageTaken)), 'Damage taken'),
      h('div', {}, h('b', {}, String(st.evolutions.length)), 'Evolutions'), h('div', {}, h('b', {}, fmtNum(st.score)), st.daily ? `Score${extra.dailyBest ? ' (best!)' : ''}` : 'Score'),
    ),
    h('table', { class: 'dmg-table' }, ...rows),
    payout,
    st.voucherTickets > 0 ? h('div', { class: 'unlock-note' }, `+${fmtNum(st.voucherTickets)} Lost Tickets were already banked from Lost & Found vouchers.`) : null,
    ...extra.achievements.map((a, i) => h('div', { class: 'achievement', style: { animationDelay: `${0.4 + i * 0.15}s` } }, `★ ${a}`)),
    ...extra.newUnlocks.map((u) => h('div', { class: 'unlock-note' }, u)),
    buttons,
  ));
}

// ===================================================================== lost & found
export function lostFoundScreen(c: UICtx): HTMLElement {
  const s = c.save;
  const root = h('div', { class: 'screen lostfound dim' });
  const render = () => {
    const perks = PERKS.map((p) => {
      const lvl = s.perkLevel(p.id), maxed = s.perkMaxed(p.id), cost = s.perkCost(p.id);
      const can = !maxed && s.data.lostTickets >= cost;
      return h('div', { class: `lf-item${maxed ? ' owned' : can ? '' : ' cant'}`, 'data-nav': '', onclick: () => { if (s.buyPerk(p.id)) { c.audio.play('buy', { vol: 0.6 }); render(); } else c.audio.play('deny', { vol: 0.5 }); } },
        h('img', { src: c.assets.uiIcon(p.id), alt: '' }), h('div', { class: 'nm' }, p.name), h('div', { class: 'ds' }, p.desc),
        h('div', { class: 'pips' }, ...Array.from({ length: p.cap }, (_, i) => h('i', { class: i < lvl ? 'on' : '' }))),
        h('div', { class: 'cost', style: { gridColumn: '2' } }, maxed ? 'MAXED' : `${cost} LT`));
    });
    const chars = CHARACTERS.filter((ch) => ch.unlock).map((ch) => {
      const owned = s.characterAvailable(ch.id), met = s.characterRequirementMet(ch.id);
      const can = !owned && met && s.data.lostTickets >= ch.unlock!.cost;
      return h('div', { class: `lf-item${owned ? ' owned' : met ? (can ? '' : ' cant') : ' locked'}`, 'data-nav': '', onclick: () => { if (s.buyCharacter(ch.id)) { c.audio.play('buy', { vol: 0.6 }); render(); } else c.audio.play('deny', { vol: 0.5 }); } },
        h('img', { src: c.assets.portrait(ch.id), alt: '', style: { borderRadius: '50%' } }), h('div', { class: 'nm' }, ch.name), h('div', { class: 'ds' }, owned ? 'Unlocked' : met ? ch.title : `Requires: ${ch.unlock!.reqText}`),
        h('div', { class: 'cost', style: { gridColumn: '2' } }, owned ? 'OWNED' : `${ch.unlock!.cost} LT`));
    });
    const unlocks = UNLOCKS.map((u) => {
      const owned = s.isUnlocked(u.id), can = !owned && s.data.lostTickets >= u.cost;
      const icon = u.kind === 'weapon' ? c.assets.weaponIcon(u.ref!) : u.kind === 'passive' ? c.assets.passiveIcon(u.ref!) : c.assets.uiIcon('reroll');
      return h('div', { class: `lf-item${owned ? ' owned' : can ? '' : ' cant'}`, 'data-nav': '', onclick: () => { if (s.buyUnlock(u.id)) { c.audio.play('buy', { vol: 0.6 }); render(); } else c.audio.play('deny', { vol: 0.5 }); } },
        h('img', { src: icon, alt: '' }), h('div', { class: 'nm' }, u.name), h('div', { class: 'ds' }, u.desc), h('div', { class: 'cost', style: { gridColumn: '2' } }, owned ? 'OWNED' : `${u.cost} LT`));
    });
    root.replaceChildren(h('div', { class: 'panel bulbs' },
      h('div', { class: 'lf-head' }, h('h2', { class: 'title-text' }, 'Lost & Found'), h('span', { class: 'ticket-count' }, fmtNum(s.data.lostTickets)), h('div', {}, btn('Refund perks', () => { const n = s.refundPerks(); c.audio.play('ui_back'); if (n) render(); }, 'small purple'), ' ', btn('Back', () => { c.click(); c.go('title'); }, 'small red', { 'data-default': '' }))),
      h('div', { class: 'muted' }, 'Spend the Lost Tickets you carry out of each night. Perks are a head start — the night is still won in the drafts.'),
      h('div', { class: 'section-title' }, 'Permanent Perks'), h('div', { class: 'lf-grid' }, ...perks),
      h('div', { class: 'section-title' }, 'Performers'), h('div', { class: 'lf-grid' }, ...chars),
      h('div', { class: 'section-title' }, 'New Attractions'), h('div', { class: 'lf-grid' }, ...unlocks),
      h('div', { class: 'section-title' }, 'Achievements'),
      h('div', { class: 'lf-grid' }, ...ACHIEVEMENTS.map((a) => h('div', { class: `lf-item${s.hasAchievement(a.id) ? '' : ' locked'}` }, h('img', { src: c.assets.uiIcon('luck'), alt: '' }), h('div', { class: 'nm' }, a.name), h('div', { class: 'ds' }, a.desc), h('div', { class: 'cost', style: { gridColumn: '2' } }, s.hasAchievement(a.id) ? '✓ Earned' : `+${a.reward} LT`)))),
    ));
  };
  render();
  return root;
}

// ===================================================================== carnival-pedia
export function pediaScreen(c: UICtx): HTMLElement {
  const s = c.save;
  const root = h('div', { class: 'screen pedia dim' });
  let tab = 'enemies';
  let sel = '';
  const known = (id: string) => s.data.pedia.includes(id);
  const tabs: [string, string][] = [['enemies', 'Enemies'], ['bosses', 'Bosses'], ['weapons', 'Weapons'], ['evolutions', 'Evolutions'], ['passives', 'Passives'], ['characters', 'Performers']];
  const entries = (): { id: string; name: string; img: string; lore: string; stats: string; known: boolean }[] => {
    switch (tab) {
      case 'enemies': return PEDIA_ENEMIES.map((id) => { const e = ENEMIES[id]; return { id, name: e.name, img: c.assets.enemyImage(id), lore: `${e.lore} Tell: ${e.tell}`, stats: `${e.role} · HP ${e.hp} · Speed ${e.speed} · Contact ${e.contact}${e.eliteName ? ` · Elite: ${e.eliteName}` : ''}`, known: known(id) }; });
      case 'bosses': return BOSSES.map((b) => ({ id: b.id, name: b.name, img: c.assets.bossImage(b.id), lore: `${b.lore} ${b.intro}`, stats: `Arrives ${fmtTime(b.gate)} · Phases: ${b.phases.map((p) => p.name).join(' → ')} · Unlocks: ${b.unlocks}`, known: known(b.id) }));
      case 'weapons': return BASE_WEAPON_IDS.map((id) => { const w = WEAPONS[id]; return { id, name: w.name, img: c.assets.weaponIcon(id), lore: `${w.desc} ${w.lore}`, stats: `Damage ${w.damage} · Cooldown ${w.cooldown}s${w.evolvesTo ? ` · Lv8 + ${PASSIVES[w.evoPassive!].name} → ${WEAPONS[w.evolvesTo].name}` : ''}${w.signature ? ` · Signature of ${CHARACTER_MAP[w.signature].name}` : ''}`, known: known(id) || CHARACTERS.some((ch) => ch.startWeapon === id && s.characterAvailable(ch.id)) }; });
      case 'evolutions': return EVOLUTION_IDS.map((id) => { const w = WEAPONS[id]; const base = WEAPONS[w.evolvedFrom!]; return { id, name: w.name, img: c.assets.weaponIcon(id), lore: `${w.desc} ${w.lore}`, stats: `${base.name} (Lv8) + ${PASSIVES[base.evoPassive!].name}`, known: known(id) }; });
      case 'passives': return PASSIVE_IDS.map((id) => { const p = PASSIVES[id]; return { id, name: p.name, img: c.assets.passiveIcon(id), lore: p.lore, stats: `${p.desc} · Max level ${p.maxLevel}`, known: known(id) }; });
      default: return CHARACTERS.map((ch) => ({ id: ch.id, name: ch.name, img: c.assets.portrait(ch.id), lore: `${ch.desc} ${ch.lore}`, stats: `${ch.quirkName}: ${ch.quirkDesc}`, known: s.characterAvailable(ch.id) }));
    }
  };
  const render = () => {
    const list = entries();
    const nKnown = list.filter((e) => e.known).length;
    const all = PEDIA_ENEMIES.length + BOSSES.length + BASE_WEAPON_IDS.length + EVOLUTION_IDS.length + PASSIVE_IDS.length;
    const allKnown = [...PEDIA_ENEMIES, ...BOSSES.map((b) => b.id), ...BASE_WEAPON_IDS, ...EVOLUTION_IDS, ...PASSIVE_IDS].filter((id) => known(id)).length;
    const cur = list.find((e) => e.id === sel && e.known);
    root.replaceChildren(h('div', { class: 'panel bulbs' },
      h('div', { class: 'lf-head' }, h('h2', { class: 'title-text' }, 'Carnival-pedia'), h('div', { class: 'progress-line' }, `Discovered ${allKnown} / ${all}`), btn('Back', () => { c.click(); c.go('title'); }, 'small red', { 'data-default': '' })),
      h('div', { class: 'tabs' }, ...tabs.map(([id, nm]) => h('button', { class: `tab${tab === id ? ' sel' : ''}`, 'data-nav': '', onclick: () => { c.click(); tab = id; sel = ''; render(); } }, nm))),
      h('div', { class: 'muted' }, `${nKnown} / ${list.length} in this wing`),
      cur ? h('div', { class: 'pedia-detail' }, h('img', { src: cur.img, alt: '' }), h('div', {}, h('h3', {}, cur.name), h('p', {}, cur.lore), h('div', { class: 'muted' }, cur.stats))) : null,
      h('div', { class: 'pedia-grid', style: { marginTop: '0.8em' } }, ...list.map((e) => h('div', { class: `pedia-entry${e.known ? '' : ' unknown'}${sel === e.id ? ' sel' : ''}`, 'data-nav': '', onclick: () => { if (!e.known) return; c.click(); sel = e.id; render(); } }, h('img', { src: e.img, alt: '' }), h('div', { class: 'nm' }, e.known ? e.name : '???')))),
    ));
  };
  render();
  return root;
}

// ===================================================================== settings
export function settingsScreen(c: UICtx, back: () => void): HTMLElement {
  const st = c.save.data.settings;
  const root = h('div', { class: 'screen settings dim' });
  const change = () => { c.save.save(); c.applySettings(); };
  const slider = (label: string, key: keyof Settings, min = 0, max = 1, stepv = 0.05) => {
    const inp = h('input', { type: 'range', min, max, step: stepv, value: String(st[key]) }) as HTMLInputElement;
    inp.oninput = () => { (st as any)[key] = parseFloat(inp.value); change(); };
    const row = h('div', { class: 'setting', 'data-nav': '' }, h('label', {}, label), inp);
    (row as any).navAdjust = (d: number) => { inp.value = String(Math.max(min, Math.min(max, parseFloat(inp.value) + d * stepv * 2))); inp.oninput!(new Event('input')); };
    return row;
  };
  const toggle = (label: string, key: keyof Settings) => {
    const box = h('div', { class: `toggle${st[key] ? ' on' : ''}` }, h('span', { class: 'box' }));
    const row = h('div', { class: 'setting', 'data-nav': '', onclick: () => { (st as any)[key] = !st[key]; box.classList.toggle('on', !!st[key]); c.click(); change(); } }, h('label', {}, label), box);
    return row;
  };
  const select = (label: string, key: keyof Settings, opts: [string, string][]) => {
    const sel = h('select', {}, ...opts.map(([v, t]) => h('option', { value: v, selected: st[key] === v || undefined }, t))) as HTMLSelectElement;
    sel.onchange = () => { (st as any)[key] = sel.value; change(); };
    const row = h('div', { class: 'setting', 'data-nav': '' }, h('label', {}, label), sel);
    (row as any).navAdjust = (d: number) => { const i = Math.max(0, Math.min(opts.length - 1, sel.selectedIndex + d)); sel.selectedIndex = i; sel.onchange!(new Event('change')); };
    return row;
  };
  const bindRows = Object.keys(DEFAULT_BINDINGS).map((action) => {
    const codes = st.bindings[action] ?? DEFAULT_BINDINGS[action];
    const buttons = [0, 1].map((slot) => {
      const b = h('button', {}, (codes[slot] ?? '—').replace('Key', '').replace('Arrow', '↕'));
      b.onclick = (ev) => {
        ev.stopPropagation();
        b.classList.add('listening');
        b.textContent = 'press…';
        c.input.captureBinding = (code) => {
          const list = (st.bindings[action] ?? [...DEFAULT_BINDINGS[action]]).slice();
          list[slot] = code;
          st.bindings[action] = list.filter(Boolean);
          change();
          render();
        };
      };
      return b;
    });
    return h('div', { class: 'setting', 'data-nav': '', onclick: () => buttons[0].click() }, h('label', {}, action[0].toUpperCase() + action.slice(1)), h('div', { class: 'bind' }, ...buttons));
  });
  const render = () => {
    root.replaceChildren(h('div', { class: 'panel bulbs' },
      h('h2', { class: 'title-text' }, 'Settings'),
      h('h3', {}, 'Audio'),
      slider('Master volume', 'master'), slider('Music', 'music'), slider('Sound effects', 'sfx'), slider('Ambience', 'ambience'), toggle('Mute all', 'muted'),
      h('h3', {}, 'Visuals & Accessibility'),
      select('Graphics quality', 'quality', [['high', 'High'], ['medium', 'Medium'], ['low', 'Low (handheld)']]),
      slider('Screen shake', 'shake'), slider('Your attacks: opacity', 'abilityOpacity', 0.15, 1, 0.05), toggle('Reduced flashing', 'reducedFlash'), toggle('High-contrast telegraphs', 'highContrast'), toggle('Damage numbers', 'damageNumbers'),
      slider('UI scale', 'uiScale', 0.8, 1.5, 0.05), toggle('Dyslexia-friendly font', 'dyslexiaFont'), toggle('Show FPS / perf', 'showFps'),
      h('h3', {}, 'Gameplay'),
      select('Aiming', 'aimMode', [['auto', 'Auto (classic)'], ['hybrid', 'Hybrid — aim with mouse / right stick when used'], ['manual', 'Manual — directional weapons follow your aim']]),
      h('h3', {}, 'Controls (keyboard — click a key to rebind)'), ...bindRows,
      h('div', { class: 'muted', style: { margin: '0.4em' } }, 'Gamepad: left stick move · right stick aim · A confirm · B back · Start pause · X reroll · Y banish · LB skip'),
      h('h3', {}, 'Data'),
      h('div', { class: 'cs-actions' },
        btn('Replay tutorial tips', () => { st.tutorialsSeen = []; change(); c.click(); }, 'small purple'),
        btn('Reset all progress', () => { if (confirm('Erase all Lost Tickets, unlocks and records? Settings are kept.')) { c.save.reset(); c.click(); } }, 'small red'),
        btn('Back', () => { c.click(); back(); }, 'small', { 'data-default': '' }),
      ),
    ));
  };
  render();
  return root;
}
