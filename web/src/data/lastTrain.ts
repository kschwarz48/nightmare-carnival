// "The Last Train Home" — the Ghost Train's hidden quest (D-80, reworked in D-90): its tuning and its words. The
// state machine is sim/quest/lastTrain.ts; where everything stands is data/gtStations.ts; the full solution
// (developers only) is docs/EASTER_EGG_GHOST_TRAIN.md.

export const LAST_TRAIN = {
  id: 'last_train',
  /** reach (sim units) for each kind of fixture */
  reach: { booking: 110, board: 140, key: 80, clock: 90, page: 80, candles: 90, gravelamp: 80, scrap: 80, crucible: 110, pendulum: 90, lamproom: 100, lampbox: 80, lever: 34, punch: 100, passenger: 90, letter: 90, postbox: 90, chute: 100, coal: 90, stoke: 90, church: 120, rope: 52, ticket: 100 },
  /** Saint Vesper's: seconds a taper burns, seconds of vigil at the empty grave */
  taper: 26,
  vigil: 30,
  /** the Cinder Works: the ladle's speed along its rails (units/s) while somebody is this close to it */
  ladleSpeed: 46,
  ladleNear: 150,
  /** Stillwater: seconds standing in a frozen moment to wake it; seconds on the bank to reel in the pendulum */
  moment: 8,
  reel: 12,
  /** each journey's signal stands this far along its leg (fraction, seeded 0.3..0.7 a night). The train's lamp shows
   *  green this long after a press at its lamp box, and the signal is called out this many seconds before the engine
   *  passes it (D-84) */
  greenFor: 3,
  callAhead: 2.5,
  /** the boiler's pressure needle swings with this period (s); a stoke counts while it's this close to the top */
  gaugePeriod: 2.4,
  gaugeWindow: 0.16,
  stokes: 3,
  coalLoads: 3,
  levers: 5,
  leverSteps: 3,
  /** seconds from the Night Express's fall to the Conductor stepping out of the dark */
  finaleDelay: 7,
  /** seconds of the last train home before the true dawn */
  homeward: 14,
};

/** The frozen moments at Stillwater, by index. */
export const MOMENTS = ['The woman at the well', 'The boy with the kite', 'The signalman at his gate'];

export const LT_TEXT = {
  ticket: ['A grey hand slides a ticket under the booking-office glass.', '"ADMIT ONE. THE LAST TRAIN HOME. Not valid until the line keeps time." Every clock on the line has stopped.'],
  clockKeyless: ['The Junction\'s clock has stopped at a minute to midnight.', 'Its winding key is gone. Somebody dropped it about the station.'],
  clockTrainAway: ['The clock\'s works turn with the line\'s.', 'Wind it while the train is standing in.'],
  key: ['A brass winding key as long as your forearm: the station clocks\'.', 'The Junction\'s clock first, while the train is in.'],
  junctionClock: ['The Junction\'s clock ticks again. Aboard, the sleeper car\'s four compartment doors slide open.', 'A torn timetable page lies in each compartment: gather all four. (The sleeper is the second car from the back.)'],
  page: (n: number) => [`A torn page of a timetable (${n} of 4).`, n === 4 ? 'The timetable is whole again.' : 'The rest are in the other compartments.'],
  pagesDone: [
    'The timetable is whole: THE LAST TRAIN HOME, calling at Saint Vesper\'s, the Cinder Works and Stillwater once each station\'s clock keeps time.',
    'Get every station\'s clock going: look at each one to see what it needs.',
  ],
  /** what a stopped clock says it needs, by station and step (the key's carrier winds it once its trouble is mended) */
  trouble: [
    [],
    [
      ['Saint Vesper\'s clock stopped the hour the last train came in empty.', 'Light the three grave lamps with a taper from the altar candles by the chapel porch, before the taper burns down.'],
      ['The grave lamps burn. The clock waits on a vigil.', 'Keep watch at the empty grave in the middle of the churchyard. The dead will not like it.'],
    ],
    [
      ['The Cinder Works\' clock: its great brass wheel is cracked through.', 'Bring the brass cogs lying about the yard to the crucible by the west furnace: three of them will cast a new wheel.'],
      ['The ladle of molten brass waits on the tub rails.', 'Walk beside it all the way to the clock. It stops cold whenever nobody does.'],
    ],
    [
      ['Stillwater\'s clock has no pendulum, and nothing in Stillwater moves.', 'Three moments the village is frozen in: stand in each until it moves again.'],
      ['Something glints at the bottom of the still pond.', 'Stand on the jetty at the pond\'s edge and reel it in.'],
      ['The pendulum lies on the bank.', 'Carry it to the station clock and hang it.'],
    ],
  ] as string[][][],
  needsKey: ['The clock is ready to be wound.', 'Whoever carries the brass key.'],
  taper: ['A lit taper from the altar candles.', 'It will not burn long. The grave lamps.'],
  taperOut: ['The taper gutters out.', 'Another from the chapel\'s altar candles.'],
  gravelamp: (n: number) => [`A grave lamp burns (${n} of 3).`, n === 3 ? '' : ''],
  vigil: ['Three lamps burn round the churchyard.', 'Now the vigil: stand at the empty grave in its middle.'],
  vigilDone: ['The chapel bell tolls once, by itself.', 'Saint Vesper\'s clock can be wound.'],
  scrap: ['A brass cog off some old machine.', 'Carry it to the crucible by the west furnace.'],
  crucible: (n: number) => [`A brass cog melts in the crucible (${n} of 3).`, n >= 3 ? 'The crucible runs. A ladle of molten brass waits on the tub rails: walk it to the clock.' : 'More brass cogs lie about the yard.'],
  ladleDone: ['The ladle pours into the mould under the clock: a new wheel, still glowing.', 'The Cinder Works\' clock can be wound.'],
  moment: (k: number, n: number) => [`${MOMENTS[k]} moves again (${n} of 3).`, n === 3 ? 'Time runs in Stillwater again. Something glints in the still pond.' : ''],
  reeled: ['Out of the still pond: the station clock\'s pendulum.', 'Carry it to the clock and hang it.'],
  pendulum: ['The pendulum: heavy brass, still dripping.', 'Stillwater\'s clock is on the platform.'],
  pendulumHung: ['The pendulum swings.', 'Wind the clock.'],
  clock: (r: string, n: number) => [`${r}'s clock is ticking again.`, n === 4 ? 'The Midnight Line keeps time again. Back to Hollow Junction.' : `${n} of 4 station clocks running. Pull the whistle cord to go on.`],
  clocks: ['The line keeps time.', 'Back at the Junction: the signal battery for the train\'s lamp, and the levers in the signal box (their order is the footnote on the timetable board).'],
  battery: ['The signal battery: heavy, its brass terminals still bright.', 'The train\'s own signal lamp is dark. Fit the battery to the lamp box at the front of the tender.'],
  batteryIn: ['The train\'s signal lamp burns red.', ''],
  prepared: ['The train is ready for the End of the Line.', 'Pull the whistle. A signal will stand at danger on the way: switch the train\'s lamp to green as it passes.'],
  green: ['The lamp shows green.', ''],
  signalAhead: ['A signal at danger ahead!', 'Switch the train\'s lamp to green, now.'],
  signalMissed: (to: string) => ['The signal stays at danger.', `The train runs on to ${to} as usual. The signal will stand again on the next journey.`],
  signal: ['The signal drops, and the points swing over with a clank.', 'The train is bound for the End of the Line.'],
  boardLevers: (levers: number[]) => ['The timetable\'s footnote:', `"Route 13 — levers ${levers.map((l) => l + 1).join(' · ')}."`],
  lever: (step: number) => [step >= 3 ? 'The points to the End of the Line are set.' : `Lever ${step} of 3 pulled.`, ''],
  leverWrong: ['The frame jams and every lever springs back.', 'The timetable\'s footnote has the order.'],
  punch: ['The Conductor\'s spare punch, left on the ticket box.', 'Four lost passengers wait on this platform. They can only board a train that is standing here.'],
  passengerWait: ['They only board a train standing at the platform.', ''],
  passenger: (name: string, n: number) => [`${name}'s ticket is punched. They board.`, n === 4 ? 'All four are aboard. Each has one thing left to do along the line.' : `${n} of 4 aboard.`],
  tasksIntro: (hour: number, bells: number[]) => [
    'Ada: "My letter, posted at the Junction." · Theo: "The engine\'s cold. Coal from the Works, then stoke it hot." ·',
    `Mira: "Stillwater's church clock to ${hour} o'clock." · Eli: "The bells at Saint Vesper's for my mother: ${bells.map((b) => ['west', 'middle', 'east'][b]).join(', ')}."`,
  ],
  letter: ['Ada\'s letter, addressed in a girl\'s hand: "To Papa, Penhallow\'s Boardwalk."', 'The Junction\'s post box takes letters for anywhere.'],
  posted: ['The letter drops into the box. Somewhere, a pier bell rings once.', ''],
  coal: (n: number) => [`Coal in the tender (${n} of 3).`, n >= 3 ? 'Stoke the firebox on the move: when the boiler gauge swings into the red.' : ''],
  stoke: (n: number) => [`The fire roars (${n} of 3).`, n >= 3 ? 'The engine runs hot. Theo grins.' : ''],
  stokeBad: ['Too soon. The fire chokes and settles.', 'Stoke when the needle swings into the red.'],
  hourWait: ['The church clock only turns while the train is in.', ''],
  hour: (h: number) => [`The church clock: ${h} o'clock.`, ''],
  bellWait: ['The bells only answer while the train is in.', ''],
  bellWrong: ['A sour toll. The ropes go still.', 'Eli remembers the order.'],
  task: (name: string, n: number) => [`${name} is at peace.`, n === 4 ? 'Every passenger is ready. Punch the last ticket at the End of the Line.' : `${n} of 4.`],
  lastTicketWait: ['The barrier only takes tickets while a train stands at the platform.', ''],
  lastTicket: ['Your own ticket: punched. The last train home is booked.', 'When the Night Express falls, its Conductor will come for the passengers.'],
  finale: ['The lamps go out along the End of the Line.', 'Somewhere in the dark, a punch clicks.'],
  homeward: ['The last train home pulls out of the End of the Line, every window lit.', 'Ada, Theo, Mira and Eli wave from the observation car.'],
  complete: ['THE LAST TRAIN HOME', 'Every ticket punched. The Midnight Line runs no more.'],
  hint: [
    ['THE BOOKING CLERK', '"Every journey starts with a ticket. Ask at the window."'],
    ['THE BOOKING CLERK', '"The clocks\' key? Somebody dropped it about the concourse. Look where people sit, and wait, and leave their things. The guard won\'t take her out till the line keeps time."'],
    ['THE BOOKING CLERK', '"Wind the Junction\'s clock while the train is in."'],
    ['THE BOOKING CLERK', '"The sleeper\'s compartments are open at last, and there\'s a torn page in each. The sleeper\'s the second car from the back."'],
    ['THE BOOKING CLERK', '"Each station\'s clock has its own trouble. Look at the clock, and the station will tell you. The whistle cord takes you on."'],
    ['THE BOOKING CLERK', '"The battery is in the lamp room under the signal box. The levers are in the box, and their order is the timetable\'s footnote: read the timetable board on the concourse."'],
    ['THE BOOKING CLERK', '"Get her moving, and give the signal the green as you pass it."'],
    ['THE BOOKING CLERK', '"The punch is on the ticket box at the End of the Line."'],
    ['THE BOOKING CLERK', '"Punch their tickets while the train is in, and they\'ll board."'],
    ['THE BOOKING CLERK', '"Each of them has one errand. Help them all."'],
    ['THE BOOKING CLERK', '"Your own ticket. At the barrier, while a train is in."'],
    ['THE BOOKING CLERK', '"Nothing more I can do. The Night Express must fall."'],
  ],
};

/** The lever frame's order tonight is three distinct levers of five; the bell order a permutation of three. */
export const LEVER_COUNT = LAST_TRAIN.levers;
