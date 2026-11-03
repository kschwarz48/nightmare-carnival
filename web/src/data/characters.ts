// The seven-character roster (doc 01 §6, D-13, D-78). Each has a distinct opener, stat identity and quirk.

import type { StatAxis } from './weapons';
import type { TierId } from './tiers';

export type QuirkId = 'xp_bonus' | 'shove' | 'fortune' | 'spark_trail' | 'balloon_shield' | 'ringleader' | 'mirror_aura' | 'lamplight' | 'fireproof';

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  desc: string;
  quirkName: string;
  quirkDesc: string;
  quirk: QuirkId;
  hp: number;
  speed: number;
  pickup: number;
  startWeapon: string;
  mods: Partial<Record<StatAxis, number>>;
  /** Unlock: null = default; otherwise an achievement-style requirement + Lost Ticket price. */
  unlock: null | { req: string; reqText: string; cost: number };
  palette: { main: string; accent: string; skin: string };
  lore: string;
  /** a world tier's performer (D-97): sold once its map is won on that tier; not part of the Whole Troupe */
  tier?: TierId;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'carny', name: 'The Carny', title: 'Balanced all-rounder',
    desc: 'A fast-talking game-stall barker who knows every trick on the midway.',
    quirkName: 'Knows the Games', quirkDesc: '+10% XP from Tickets.', quirk: 'xp_bonus',
    hp: 100, speed: 220, pickup: 75, startWeapon: 'throwing_cards',
    mods: { xp: 0.1 }, unlock: null,
    palette: { main: '#c8322d', accent: '#f2c14e', skin: '#f3d7b6' },
    lore: 'Three throws for a nickel, folks. Tonight the prize is getting out alive.',
  },
  {
    id: 'strongman', name: 'The Strongman', title: 'Tank · melee',
    desc: 'Bends horseshoes for breakfast. Slower, but nothing pushes him around.',
    quirkName: 'Iron Constitution', quirkDesc: '+50% HP, +1 armor. Shoves away anything that hits him.', quirk: 'shove',
    hp: 150, speed: 187, pickup: 75, startWeapon: 'mallet',
    mods: { armor: 1 }, unlock: null,
    palette: { main: '#2b2b2b', accent: '#e8a33d', skin: '#e9b98f' },
    lore: 'He rang the bell so hard it never stopped ringing. That was the night it all woke up.',
  },
  {
    id: 'fortune_teller', name: 'The Fortune Teller', title: 'Glass cannon · crits',
    desc: 'Sees how the night ends. Hits hard, breaks easily.',
    quirkName: 'Second Sight', quirkDesc: '+25% Might, +10% crit. Always sees 4 draft cards and previews the next draft.', quirk: 'fortune',
    hp: 75, speed: 220, pickup: 75, startWeapon: 'tarot',
    mods: { might: 0.25, critChance: 0.1 },
    unlock: { req: 'reach_12', reqText: 'Survive to 12:00 once', cost: 800 },
    palette: { main: '#5b2a86', accent: '#f0c75e', skin: '#e7c2a0' },
    lore: 'Madame Zelda read her own palm once. She has been running ever since.',
  },
  {
    // D-78: the Ride Operator became the Boardwalk's founder (its secret boss), with the same quirk and opener;
    // the id stays, so older saves and the protocol still know him
    id: 'ride_operator', name: 'The Commodore', title: 'Mobility · area',
    desc: 'Ezra Penhallow, who built the Boardwalk, in a white suit gone green. He rides his own coaster and never stops moving.',
    quirkName: 'Live Wire', quirkDesc: '+20% move speed, +10% area. Leaves a crackling spark trail while moving.', quirk: 'spark_trail',
    hp: 100, speed: 264, pickup: 75, startWeapon: 'bumper',
    mods: { area: 0.1 },
    unlock: { req: 'beat_leviathan', reqText: 'Defeat the Leviathan', cost: 6000 },
    palette: { main: '#d8d0b8', accent: '#3ad8b0', skin: '#d0c4b2' },
    lore: 'He promised the sea a summer that would never end, and paid for it with other people. The bill came due. He is working it off, one night at a time.',
  },
  {
    id: 'lost_child', name: 'The Lost Child', title: 'Fragile · companion',
    desc: 'Separated from their parents at the gate. Their plush friend is fiercer than it looks.',
    quirkName: 'Balloon Shield', quirkDesc: 'A balloon absorbs one hit, then regrows. Starts with a revive balloon. Plush pets +20%.', quirk: 'balloon_shield',
    hp: 60, speed: 230, pickup: 70, startWeapon: 'plush',
    mods: { revive: 1 },
    unlock: { req: 'beat_puppet_king', reqText: 'Defeat the Puppet King', cost: 1800 },
    palette: { main: '#e98fb4', accent: '#7ec8e3', skin: '#f6dcc4' },
    lore: '"Have you seen my mommy?" asks the child. The carnival has. The carnival remembers everyone.',
  },
  {
    id: 'ringleader', name: 'The Ringleader', title: 'Summoner',
    desc: "The Ringmaster's former apprentice. Commands the acts, not the whip.",
    quirkName: 'Showstopper', quirkDesc: 'Summons inherit +40% Might. Non-summon weapons deal −15%.', quirk: 'ringleader',
    hp: 90, speed: 215, pickup: 75, startWeapon: 'tophat',
    mods: {},
    unlock: { req: 'beat_ringmaster', reqText: 'Defeat the Ringmaster', cost: 3000 },
    palette: { main: '#8d1d2c', accent: '#f2d16b', skin: '#ecc7a5' },
    lore: 'Every show needs someone in the center ring. Tonight it will be someone new.',
  },
  {
    // D-78: the girl the Fun House kept behind its glass; bought once the Fun House has been survived
    id: 'mira', name: 'Mira', title: 'Reflections · aura',
    desc: 'The girl the Fun House kept behind its glass, out in the night air at last. Her reflections fight beside her.',
    quirkName: 'Glass Halo', quirkDesc: 'Her mirror clones carry an aura of broken glass that cuts every enemy inside it once a second.', quirk: 'mirror_aura',
    hp: 85, speed: 225, pickup: 75, startWeapon: 'mirror',
    mods: {},
    unlock: { req: 'beat_proprietor', reqText: 'Defeat the Proprietor', cost: 4500 },
    palette: { main: '#7fb8c8', accent: '#cfc0ff', skin: '#ecdcd0' },
    lore: 'Professor Grinwell kept her dancing in the glass from 1931 on, for an audience that never came. She knows every trick a mirror can play, and a few it should not.',
  },
  // the world tiers' performers (D-97)
  {
    id: 'watchman', name: 'The Night Watchman', title: 'Control · damage over time', tier: 'nightmare',
    desc: "The carnival's last night guard, who never clocked off: lantern up, keys at his belt, forty years of rounds.",
    quirkName: 'Lamplight', quirkDesc: "Creatures in his lantern's light take 15% more damage from everything, and phasing spectres are forced solid there.", quirk: 'lamplight',
    hp: 110, speed: 205, pickup: 75, startWeapon: 'lantern',
    mods: { duration: 0.1 }, unlock: { req: 'nm_carnival_core', reqText: 'Win the Carnival Core on Nightmare', cost: 6000 },
    palette: { main: '#2e3a52', accent: '#e8c86a', skin: '#d8b496' },
    lore: 'He locked the gates the night it woke and has walked his rounds ever since. The dead know his lantern.',
  },
  {
    id: 'fire_eater', name: 'The Fire-Eater', title: 'Area · burning', tier: 'hell',
    desc: 'A sideshow fire-breather who swallowed a coal from the Infernal Carnival on a dare, and kept it.',
    quirkName: 'Fireproof', quirkDesc: 'Burning ground never hurts him, and creatures he sets alight take 20% more damage.', quirk: 'fireproof',
    hp: 100, speed: 215, pickup: 75, startWeapon: 'breath',
    mods: { area: 0.1 }, unlock: { req: 'hell_carnival_core', reqText: 'Win the Carnival Core on Hell', cost: 10000 },
    palette: { main: '#8a1e12', accent: '#ffb24a', skin: '#c99068' },
    lore: 'Salvatore drank paraffin for a living until the night the fire drank back.',
  },
];

export const CHARACTER_MAP: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
