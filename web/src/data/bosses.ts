// Boss metadata (doc 05). Attack logic lives in src/sim/bosses/*.

export interface BossDef {
  id: 'carnival_tent' | 'ferris_wheel' | 'puppet_king' | 'ringmaster' | 'calliope'
    | 'crooked_twins' | 'looking_glass' | 'stringmistress' | 'proprietor' | 'unreflected'
    | 'barker' | 'drowned_captain' | 'last_ride' | 'leviathan' | 'commodore';
  name: string;
  title: string;
  gate: number;
  hp: number;
  contact: number;
  radius: number;
  enrage: number;
  phases: { at: number; name: string }[];
  intro: string;
  defeat: string;
  unlocks: string;
  lore: string;
  barColor: string;
}

/** The Carnival Core's schedule. (`BOSSES` below is the active map's; see maps.ts.) */
export const CARNIVAL_BOSSES: BossDef[] = [
  {
    id: 'carnival_tent', name: 'The Carnival Tent', title: 'The Big Top Awakens', gate: 360, hp: 6500, contact: 16, radius: 120, enrage: 100,
    phases: [{ at: 1, name: 'Setting Up' }, { at: 0.6, name: 'The Big Inhale' }, { at: 0.3, name: 'Brought the House Down' }],
    intro: 'The big top inhales. Its flaps peel back into a canvas maw. The show is starting.',
    defeat: 'The tent deflates into a smoking heap of striped canvas.', unlocks: 'Carnival-pedia entry',
    lore: 'It was scenery all along. It was waiting for a full house.', barColor: '#e04a4a',
  },
  {
    id: 'ferris_wheel', name: 'The Ferris Wheel', title: 'Off Its Axle', gate: 720, hp: 19000, contact: 20, radius: 150, enrage: 100,
    phases: [{ at: 1, name: 'Spinning Up' }, { at: 0.6, name: 'Off the Rails' }, { at: 0.3, name: 'Catastrophic Failure' }],
    intro: 'Its lights flare blood-red. With a shriek of tearing steel, the wheel wrenches free.',
    defeat: 'The wheel topples, lights popping one by one.', unlocks: 'The Ride Operator',
    lore: 'Forty gondolas. Forty screaming faces. It always wanted to see the rest of the carnival.', barColor: '#ff8a3d',
  },
  {
    id: 'puppet_king', name: 'The Puppet King', title: 'Dancing on Strings', gate: 1080, hp: 32000, contact: 22, radius: 105, enrage: 100,
    phases: [{ at: 1, name: 'The Performance' }, { at: 0.6, name: 'Cut the Strings' }, { at: 0.3, name: 'No Strings on Me' }],
    intro: 'Strings descend from the dark. A king-sized marionette is lowered into the ring.',
    defeat: 'He clatters apart into painted wood and tangled string.', unlocks: 'The Lost Child',
    lore: 'Someone is working the crossbar. You never see their hand.', barColor: '#a76ad6',
  },
  {
    id: 'ringmaster', name: 'The Ringmaster', title: 'The Grand Finale', gate: 1440, hp: 56000, contact: 24, radius: 70, enrage: 120,
    phases: [{ at: 1, name: 'Step Right Up' }, { at: 0.66, name: 'The Greatest Show' }, { at: 0.33, name: "The Devil's Own" }],
    intro: '"Ladies and gentlemen… for the grand finale… YOU."',
    defeat: 'The demon shatters in a column of light. The gates groan open.', unlocks: 'The Ringleader · Endless',
    lore: 'Master of the carnival. At dawn’s edge, he stops pretending to be a man.', barColor: '#ff4d2e',
  },
];

/** Secret boss — only reachable through the Last Song Easter egg. Not part of the gate timeline. */
export const CALLIOPE_DEF: BossDef = {
  id: 'calliope', name: 'The Calliope', title: 'The Last Song', gate: 99999, hp: 62000, contact: 24, radius: 120, enrage: 130,
  phases: [{ at: 1, name: 'Overture' }, { at: 0.66, name: 'Fugue' }, { at: 0.33, name: 'Requiem' }],
  intro: 'The Big Top ruins split. Brass pipes rise out of the dark, wheezing a song no one finished.',
  defeat: 'The last note rings out. Somewhere, a carousel finally stops.', unlocks: 'True Dawn',
  lore: 'The steam organ was the carnival’s heart long before the Ringmaster bought it. It only wanted to be heard.', barColor: '#7dffb0',
};

// ---------------------------------------------------------------- the Fun House (D-63): same gates
export const FUNHOUSE_BOSSES: BossDef[] = [
  {
    id: 'crooked_twins', name: 'The Crooked Twins', title: 'Two Bodies, One Grudge', gate: 360, hp: 7200, contact: 16, radius: 70, enrage: 100,
    phases: [{ at: 1, name: 'The Act' }, { at: 0.6, name: 'The Quarrel' }, { at: 0.25, name: 'Alone' }],
    intro: 'A tall one and a round one, roped at the waist, step out of the same mirror.',
    defeat: 'The rope goes slack. Both of them finally lie still, still holding on.', unlocks: '—',
    lore: 'Stilts and Barrel were the act that opened every show. They never learned to perform apart.', barColor: '#e0a04a',
  },
  {
    id: 'looking_glass', name: 'The Looking Glass', title: 'Which One Is Real?', gate: 720, hp: 20000, contact: 20, radius: 95, enrage: 100,
    phases: [{ at: 1, name: 'Reflection' }, { at: 0.66, name: 'Refraction' }, { at: 0.33, name: 'Shatter' }],
    intro: 'Every mirror in the house turns to look at you. One of them climbs out of its frame.',
    defeat: 'Ten thousand splinters of you rain onto the floor, and stop smiling.', unlocks: '—',
    lore: 'Grinwell\'s first mirror. It has been looking at people for a hundred years and learned to want things.', barColor: '#9ad8ff',
  },
  {
    id: 'stringmistress', name: 'The Stringmistress', title: 'Everyone Dances', gate: 1080, hp: 33000, contact: 22, radius: 85, enrage: 100,
    phases: [{ at: 1, name: 'The Cradle' }, { at: 0.66, name: 'The Web' }, { at: 0.33, name: 'Cut Loose' }],
    intro: 'Something long-fingered lowers itself from the dark above the house, humming.',
    defeat: 'Her strings snap one by one, and everything she was holding falls down.', unlocks: '—',
    lore: 'Every marionette in the gallery was strung by her hands. Some of them were people first.', barColor: '#c79bff',
  },
  {
    id: 'proprietor', name: 'The Proprietor', title: 'The House Always Wins', gate: 1440, hp: 58000, contact: 24, radius: 75, enrage: 120,
    phases: [{ at: 1, name: 'The Illusionist' }, { at: 0.66, name: 'The House Itself' }, { at: 0.33, name: 'The Grin' }],
    intro: '"Welcome, welcome! Professor Ignatius Grinwell — at your service. Forever."',
    defeat: 'The grin cracks from ear to ear. The doors of the Fun House swing open on the dawn.', unlocks: 'Endless',
    lore: 'He built the Palace of Illusions in 1931 and never left it. The house grew around him like a smile.', barColor: '#ff5a4a',
  },
];

/** Secret boss — only reachable through the Unreflected (the Fun House's hidden quest). */
export const UNREFLECTED_DEF: BossDef = {
  id: 'unreflected', name: 'The Unreflected', title: 'Through the Looking Glass', gate: 99999, hp: 64000, contact: 24, radius: 110, enrage: 130,
  phases: [{ at: 1, name: 'The Other Side' }, { at: 0.66, name: 'Every Face' }, { at: 0.33, name: 'No Reflection' }],
  intro: 'The house shatters inward. On the other side of the glass, something wearing Grinwell\'s smile has been waiting.',
  defeat: 'The last mirror breaks with a sound like a sigh. Mira steps out of the glass and into the morning.', unlocks: 'True Dawn',
  lore: 'What the mirrors kept: every stolen face, worn at once by the reflection Grinwell traded his own for.', barColor: '#b8fff0',
};

// ---------------------------------------------------------------- the Boardwalk (D-68): same gates
export const BOARDWALK_BOSSES: BossDef[] = [
  {
    id: 'barker', name: 'The Boardwalk Barker', title: 'Step Right Up!', gate: 360, hp: 7400, contact: 16, radius: 70, enrage: 100,
    phases: [{ at: 1, name: 'The Pitch' }, { at: 0.6, name: 'The Hard Sell' }, { at: 0.25, name: 'Last Call' }],
    intro: '"Hurry, hurry, hurry! One night only, every night, forever! Step right up!"',
    defeat: 'The megaphone howls with feedback. He topples off his soapbox and his boater rolls away down the boards.', unlocks: '—',
    lore: 'He talked the crowds in off the trolley for forty summers. The crowds stopped coming. He never stopped talking.', barColor: '#e8b04a',
  },
  {
    id: 'drowned_captain', name: 'The Drowned Captain', title: 'All Hands Lost', gate: 720, hp: 20500, contact: 20, radius: 80, enrage: 100,
    phases: [{ at: 1, name: 'Making Landfall' }, { at: 0.66, name: 'The Ghost Fleet' }, { at: 0.33, name: 'Davy Jones' }],
    intro: 'A ship\'s bell rings out over the water. Out past the breakers, a steamer that sank in 1933 shows her lights.',
    defeat: 'He salutes, and goes down with her. Out at sea, the Gala Queen\'s lights go out one porthole at a time.', unlocks: '—',
    lore: 'Captain Josiah Harrow took the Gala Queen out at 11:59 with two hundred and thirteen souls aboard. He has been trying to bring her in ever since.', barColor: '#5ab8c8',
  },
  {
    id: 'last_ride', name: 'The Last Ride', title: 'The Ride Never Ends', gate: 1080, hp: 33500, contact: 22, radius: 60, enrage: 100,
    phases: [{ at: 1, name: 'Boarding' }, { at: 0.66, name: 'Full Speed' }, { at: 0.33, name: 'Derailed' }],
    intro: 'Every light on the Undertow comes on at once. The train leaves the station without its track.',
    defeat: 'The lead car screams down one last drop that isn\'t there, and the whole train comes apart in sparks.', unlocks: '—',
    lore: 'The Undertow ran its last lap the night the Gala Queen went down. The riders are still in their seats.', barColor: '#ff6a4a',
  },
  {
    id: 'leviathan', name: 'The Leviathan', title: 'From Below', gate: 1440, hp: 59000, contact: 24, radius: 95, enrage: 120,
    phases: [{ at: 1, name: 'Stirring' }, { at: 0.66, name: 'The Deep Rises' }, { at: 0.33, name: 'Leviathan' }],
    intro: 'The sea draws back from the beach all at once. Something under the boards has been listening.',
    defeat: 'It goes down slowly, the way a ship goes down. The tide comes back gentle. Out on the water, the sky is getting light.', unlocks: 'Endless',
    lore: 'Old Mother Tide. Commodore Penhallow promised her a summer that would never end, and a share of everyone who came to enjoy it.', barColor: '#3ad8b0',
  },
];

/** Secret boss — only reachable through Summer's End (the Boardwalk's hidden quest). */
export const COMMODORE_DEF: BossDef = {
  id: 'commodore', name: 'The Commodore', title: 'The Founder\'s Bargain', gate: 99999, hp: 66000, contact: 24, radius: 85, enrage: 130,
  phases: [{ at: 1, name: 'The Founder' }, { at: 0.66, name: 'The Bargain' }, { at: 0.33, name: 'Summer\'s End' }],
  intro: 'The ledger closes itself. Down the pier, in a white suit gone green, the man who sold the summer comes to collect.',
  defeat: 'The account is settled. Ezra Penhallow lets go of the ledger, and the tide takes it out with him.', unlocks: 'True Dawn',
  lore: 'He built Penhallow\'s Boardwalk in 1904 and bargained with the sea to keep it full. He paid with other people.', barColor: '#e8e0c0',
};

// The active map's schedule (maps.ts `useMap`); the Carnival Core by default.
export let BOSSES: BossDef[] = CARNIVAL_BOSSES;
export function applyBossSchedule(list: BossDef[]): void {
  BOSSES = list;
}

export const ALL_BOSSES: BossDef[] = [...CARNIVAL_BOSSES, CALLIOPE_DEF, ...FUNHOUSE_BOSSES, UNREFLECTED_DEF, ...BOARDWALK_BOSSES, COMMODORE_DEF];
export const BOSS_MAP = Object.fromEntries(ALL_BOSSES.map((b) => [b.id, b])) as Record<BossDef['id'], BossDef>;
