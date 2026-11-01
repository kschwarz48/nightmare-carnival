// The Midway hub (D-60): once the first night is fully completed (its secret quest, the Last Song,
// carried through to True Dawn), the carnival stops being a battlefield and becomes home. The map
// loads peacefully: the ticket booth sells the Lost & Found, the starting cast you have unlocked
// wait at their games with stories to tell, the Big Top starts the first night again, and signs mark
// where the next attractions will open. Positions are sim units on the first map.

export interface HubNpc {
  /** character id: only shown once that character is unlocked on the hosting save */
  char: string;
  x: number;
  y: number;
  /** the attraction they keep */
  at: string;
  /** what they say, one line per press */
  lines: string[];
}

export interface HubSpot {
  id: string;
  x: number;
  y: number;
  /** interaction reach (sim units) */
  r: number;
  label: string;
  sub?: string;
}

/** Where everyone appears: the plaza in front of the Big Top. */
export const HUB_SPAWN = { x: 0, y: 330 };

/** Walk up to these and press interact. */
export const HUB_SPOTS = {
  booth: { id: 'booth', x: 1090, y: 440, r: 150, label: 'Ticket Booth', sub: 'Spend your Lost Tickets' } as HubSpot,
  bigTop: { id: 'bigtop', x: 0, y: 120, r: 120, label: 'The Big Top', sub: 'Begin the First Night' } as HubSpot,
};

/** The attractions' gates: the Fun House and the Boardwalk open as a save progresses; the Ghost Train is still to come. */
export const HUB_EXITS: HubSpot[] = [
  { id: 'funhouse', x: -1350, y: -1555, r: 130, label: 'The Fun House', sub: 'Open: a night in the Palace of Illusions' },
  { id: 'boardwalk', x: 1620, y: 1820, r: 140, label: 'The Boardwalk', sub: "Open: a night on Penhallow's Boardwalk" },
  { id: 'train', x: 2040, y: -520, r: 140, label: 'The Ghost Train', sub: 'The Midnight Line' },
];
/** The map each gate leads to (D-71: a gate's label says whether it's open, or what opens it). */
export const HUB_GATE_MAP: Record<string, 'fun_house' | 'boardwalk' | 'ghost_train'> = { funhouse: 'fun_house', boardwalk: 'boardwalk', train: 'ghost_train' };

/** The starting cast, each beside the game they know best. */
export const HUB_NPCS: HubNpc[] = [
  {
    char: 'carny', x: 415, y: 770, at: 'the Ring Toss',
    lines: [
      'Step right up, step right up — ah, it\'s you. Still breathing! That puts you ahead of most of my customers.',
      'Every game on this midway is rigged, friend. The trick is learning who rigged it, and what they wanted to win.',
      'The Ringmaster ran this place on borrowed time. Now the clock\'s stopped, the rides keep turning anyway. Funny, that.',
    ],
  },
  {
    char: 'strongman', x: 615, y: -1475, at: 'the High Striker',
    lines: [
      'Three rings on the bell. You did that. I have tried for forty years.',
      'Strength is not in the arms. It is in getting up after the night knocks you down. Again. And again.',
      'Some nights the puck rises on its own and rings for nobody. I do not watch it anymore.',
    ],
  },
  {
    char: 'fortune_teller', x: -1355, y: 1090, at: 'Zoltana\'s cabinet',
    lines: [
      'Zoltana is quiet now that the song is sung. Quiet is not the same as asleep.',
      'The cards keep turning up mirrors. A face that is yours, smiling a smile that is not.',
      'Mark me: the Fun House doors creak open at midnight, and the reflections inside have started walking about without anyone in front of them. When the chains come off, that is where the night goes next.',
    ],
  },
  {
    char: 'ride_operator', x: -990, y: 60, at: 'the carousel',
    lines: [
      'A fine carousel. Mine had sea horses, hand-carved in Genoa, and a brass ring nobody ever caught. I made sure of that.',
      'I sold the summer to the sea, friend, and the sea always collects. I am settling my account one night at a time. Keep your hands inside the car.',
      'Heard a whistle past the east fence last night. There is no station out there, and never was. Still, I counted the cars of that ghost train going by: thirteen, all lit, all empty. Someday it stops for somebody.',
    ],
  },
  {
    char: 'lost_child', x: -1195, y: 565, at: 'the Prize Stand',
    lines: [
      'I won a prize! Then the prize won me. Now we take turns.',
      'Grown-ups never look at the balloons. The balloons always look at the grown-ups.',
      'The gulls fly south to the boardwalk every night. The pier lights come on by themselves, and there\'s music down there that isn\'t ours.',
    ],
  },
  {
    char: 'mira', x: -1065, y: -1475, at: 'the Fun House doors',
    lines: [
      'The air out here does not bend. I keep waiting for it to.',
      'I danced for him every night, longer than I can count, and the seats were always empty. You are the first audience I have ever had. Do not clap. Run.',
      'Every mirror is a door if you know how to knock. Mine still answer me. They fight for me now, instead of keeping me in.',
    ],
  },
  {
    char: 'ringleader', x: 120, y: 125, at: 'the Big Top',
    lines: [
      'Ladies and gentlemen, ghouls and goblins — the greatest show on earth begins again, whenever you are ready!',
      'The tent remembers every act that ever played in it. It would like you to play again. It insists, really.',
      'The Big Top is only the first ring, my friend. This carnival goes on much further than the fences let on.',
    ],
  },
];
