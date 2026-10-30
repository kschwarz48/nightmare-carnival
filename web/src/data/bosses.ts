// Boss metadata (doc 05). Attack logic lives in src/sim/bosses/*.

export interface BossDef {
  id: 'carnival_tent' | 'ferris_wheel' | 'puppet_king' | 'ringmaster' | 'calliope';
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

export const BOSSES: BossDef[] = [
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

export const ALL_BOSSES: BossDef[] = [...BOSSES, CALLIOPE_DEF];
export const BOSS_MAP = Object.fromEntries(ALL_BOSSES.map((b) => [b.id, b])) as Record<BossDef['id'], BossDef>;
