// Easter-egg quest content for the Carnival Core (developer-facing solution: docs/EASTER_EGG_SOLUTION.md).
// Positions are in sim space (y down). Nothing in the player-facing UI references these stages.

export type LampSymbol = 'moon' | 'key' | 'eye' | 'crown';

export interface QuestLamp {
  id: LampSymbol;
  x: number;
  y: number;
  /** Pitch (Hz) the lamp sings when touched during the melody stage. */
  note: number;
}

export const MAP_ID = 'carnival_core';

export const LAST_SONG = {
  id: 'last_song',
  /** Zoltana, the fortune-telling automaton beside Madame Zelda's caravan. */
  machine: { x: -1440, y: 1050, r: 120 },
  /** Four "ghost lamps" replace ordinary lamp posts (map.ts marks them kind 'ghost_lamp'). */
  lamps: [
    { id: 'moon', x: -1650, y: -1000, note: 392.0 },
    { id: 'key', x: 1650, y: -1000, note: 466.16 },
    { id: 'eye', x: 1300, y: 850, note: 523.25 },
    { id: 'crown', x: -1500, y: 650, note: 622.25 },
  ] as QuestLamp[],
  /** Kills within this radius of an awakened lamp feed it a soul. */
  soulRadius: 240,
  soulsPerLamp: 14,
  /** Walking within this radius of a lit lamp "touches" it during the melody. */
  touchRadius: 85,
  /** The carousel plays the song's order on its music box when the player is within this range. */
  carousel: { x: -990, y: -150, hearRange: 950, interval: 7.5 },
  /** The High Striker: step onto the pad as the puck light reaches the bell. */
  striker: { x: 520, y: -1560, padX: 520, padY: -1488, padR: 52, period: 2.4, window: 0.17, rings: 3, rearm: 95 },
  /** The secret finale rises where the Big Top stood. */
  finaleAt: { x: 0, y: -40 },
  finaleDelay: 4,
};

export const FORTUNES = {
  awaken: 'Four lamps went dark the night the music died. Feed them the restless, and they will remember the song.',
  lampsLit: 'Something old turns over in the dark. Listen where the painted horses ride — the brass skull leads the way.',
  melodySolved: 'The song is sung, but the bell is mute. Strike when the light kisses the crown — thrice, as it was in thirty-one.',
  ticket: 'You hold a ticket to the last show. When the Master takes his final bow, the Calliope will play for you.',
  idle: [
    'Your future is printed on cheap paper. Read it twice.',
    'The carousel remembers every rider. It sings only for those who listen.',
    'Not every lamp on the midway was lit by human hands.',
    'Some prizes cannot be won with tickets alone.',
  ],
  completed: 'The music has ended. Thank you for listening. Come back tomorrow night — we never close.',
};
