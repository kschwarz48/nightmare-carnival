// The six-character roster (doc 01 §6, D-13). Each has a distinct opener, stat identity and quirk.

import type { StatAxis } from './weapons';

export type QuirkId = 'xp_bonus' | 'shove' | 'fortune' | 'spark_trail' | 'balloon_shield' | 'ringleader';

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
    unlock: { req: 'reach_12', reqText: 'Survive to 12:00 once', cost: 150 },
    palette: { main: '#5b2a86', accent: '#f0c75e', skin: '#e7c2a0' },
    lore: 'Madame Zelda read her own palm once. She has been running ever since.',
  },
  {
    id: 'ride_operator', name: 'The Ride Operator', title: 'Mobility · area',
    desc: 'Knows where every lever is. Never stops moving.',
    quirkName: 'Live Wire', quirkDesc: '+20% move speed, +10% area. Leaves a crackling spark trail while moving.', quirk: 'spark_trail',
    hp: 100, speed: 264, pickup: 75, startWeapon: 'bumper',
    mods: { area: 0.1 },
    unlock: { req: 'beat_ferris_wheel', reqText: 'Defeat the Ferris Wheel', cost: 250 },
    palette: { main: '#2a6f97', accent: '#f6d743', skin: '#d9a77e' },
    lore: 'Pulled the brake on the Ferris Wheel at midnight. It did not stop.',
  },
  {
    id: 'lost_child', name: 'The Lost Child', title: 'Fragile · companion',
    desc: 'Separated from their parents at the gate. Their plush friend is fiercer than it looks.',
    quirkName: 'Balloon Shield', quirkDesc: 'A balloon absorbs one hit, then regrows. Starts with a revive balloon. Plush pets +20%.', quirk: 'balloon_shield',
    hp: 60, speed: 230, pickup: 70, startWeapon: 'plush',
    mods: { revive: 1 },
    unlock: { req: 'beat_puppet_king', reqText: 'Defeat the Puppet King', cost: 350 },
    palette: { main: '#e98fb4', accent: '#7ec8e3', skin: '#f6dcc4' },
    lore: '"Have you seen my mommy?" asks the child. The carnival has. The carnival remembers everyone.',
  },
  {
    id: 'ringleader', name: 'The Ringleader', title: 'Summoner',
    desc: "The Ringmaster's former apprentice. Commands the acts, not the whip.",
    quirkName: 'Showstopper', quirkDesc: 'Summons inherit +40% Might. Non-summon weapons deal −15%.', quirk: 'ringleader',
    hp: 90, speed: 215, pickup: 75, startWeapon: 'tophat',
    mods: {},
    unlock: { req: 'beat_ringmaster', reqText: 'Defeat the Ringmaster', cost: 500 },
    palette: { main: '#8d1d2c', accent: '#f2d16b', skin: '#ecc7a5' },
    lore: 'Every show needs someone in the center ring. Tonight it will be someone new.',
  },
];

export const CHARACTER_MAP: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
