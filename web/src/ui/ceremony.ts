// The world tiers' unlock ceremonies (D-97, docs/WORLD_TIER_DESIGN.md §9): over the live carnival (the menu's
// scene or the Midway) the lights flicker and the world crosses into the new tier's look while its sting plays, then
// NIGHTMARE UNLOCKED / HELL UNLOCKED and what is new. Shown once per save (`tiers.seen`); any key, click or button
// skips it once its first moment has passed.

import { h } from './dom';
import { devText } from './glyphs';
import { TIERS, type TierId } from '../data/tiers';

const NEWS: Record<Exclude<TierId, 'normal'>, string[]> = {
  nightmare: [
    'Every map again, crossed over into the realm of the dead: its creatures spectral, half of them with new tricks (phasing, blinking, wailing, haunting), its bosses with a spectral choir.',
    "Nightmare's maps open one by one by winning them on Nightmare, starting with the Carnival Core. No secrets needed.",
    "The Lost & Found's Nightmare Shelf is open, and the night pays 75% more Lost Tickets.",
    'Normal stays open: switch worlds from the Midway menu, at character select or in the lobby.',
  ],
  hell: [
    'The carnival burns: creatures that explode, set the ground alight, lob fire, harden and rage; bosses that call down a firestorm.',
    "Hell's maps open one by one by winning them on Hell, starting with the Carnival Core.",
    "The Lost & Found's Hell Shelf is open, and the night pays two and a half times the Lost Tickets.",
  ],
};

export function ceremonyEl(tier: Exclude<TierId, 'normal'>, done: () => void): { el: HTMLElement; skip: () => void } {
  const t = TIERS[tier];
  let ready = false;
  let closed = false;
  const close = () => {
    if (!ready || closed) return;
    closed = true;
    el.classList.add('out');
    setTimeout(() => {
      el.remove();
      done();
    }, 450);
  };
  const el = h('div', { class: `ceremony tier-${tier}`, onclick: () => close() },
    h('div', { class: 'cer-veil' }),
    h('div', { class: 'cer-card' },
      h('div', { class: 'cer-kicker' }, t.title.toUpperCase()),
      h('h1', { class: 'cer-title title-text' }, `${t.name.toUpperCase()} UNLOCKED`),
      h('ul', { class: 'cer-news' }, ...NEWS[tier].map((line) => h('li', {}, line))),
      devText('Press any key to continue', 'Press {A} to continue', 'div', { class: 'cer-hint' }),
    ),
  );
  // the scene's crossing-over plays first; the card and its hint follow
  setTimeout(() => el.classList.add('shown'), 1600);
  setTimeout(() => {
    ready = true;
    el.classList.add('ready');
  }, 2600);
  return { el, skip: close };
}
