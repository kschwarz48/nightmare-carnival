// "The Last Train Home" — the Ghost Train's hidden quest (D-80): its tuning and its words. The state machine
// is sim/quest/lastTrain.ts; where everything stands is data/gtStations.ts; the full solution (developers
// only) is docs/EASTER_EGG_GHOST_TRAIN.md.

export const LAST_TRAIN = {
  id: 'last_train',
  /** reach (sim units) for each kind of fixture */
  reach: { booking: 110, board: 140, page: 80, clock: 90, lamproom: 100, lampbox: 80, lever: 34, whistle: 80, punch: 100, passenger: 90, letter: 90, postbox: 90, chute: 100, coal: 90, stoke: 90, church: 120, rope: 52, ticket: 100 },
  /** the signal on each leg stands this far along it (fraction of the leg, seeded 0.3..0.7 a night). The train's
   *  lamp shows green this long after a press at its lamp box, and a signal is called out this many seconds before
   *  the engine passes it (D-84) */
  greenFor: 3,
  callAhead: 2.5,
  /** the bridge over the drop: seconds into the leg from Stillwater to the End of the Line */
  bridge: [13, 23] as [number, number],
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

export const LT_TEXT = {
  ticket: ['A grey hand slides a ticket under the booking-office glass.', '"ADMIT ONE. THE LAST TRAIN HOME. Not valid until the timetable is mended."'],
  boardTorn: (missing: number) => ['The departures board is torn.', missing === 4 ? 'Four pages are missing. Somebody tore them out and left them aboard.' : `${missing} page${missing > 1 ? 's' : ''} still missing.`],
  page: (n: number) => [`A torn page of the timetable (${n} of 4).`, n === 4 ? 'The timetable is whole again.' : 'The rest are somewhere aboard.'],
  pagesDone: (levers: number[]) => [
    'The mended timetable lists a thirteenth train: THE LAST TRAIN HOME.',
    `"Calls at every station by station time. Route: levers ${levers.map((l) => l + 1).join(' · ')}. Cancelled 1899."`,
  ],
  clockNo: ['The hands won\'t move.', 'A station clock only starts while its train is standing in.'],
  clockJunction: ['The Junction\'s master clock won\'t start alone.', 'The other three stations must keep time first.'],
  clock: (r: string, n: number) => [`${r}'s clock is ticking again.`, n === 4 ? 'The Midnight Line keeps time again.' : `${n} of 4 station clocks running.`],
  battery: ['The signal battery: heavy, its brass terminals still bright.', 'The train\'s own signal lamp is dark. Fit the battery to the lamp box at the front of the tender.'],
  batteryIn: ['The train\'s signal lamp burns red.', 'A signal stands at danger on every leg. Switch the lamp to green as the train passes each one.'],
  green: ['The lamp shows green.', ''],
  signalAhead: ['A signal at danger ahead!', 'Switch the train\'s lamp to green, now.'],
  signalMissed: ['The signal stays at danger.', 'The lamp has to show green as the train passes it. It will come round again.'],
  signal: (n: number) => ['The signal drops to clear.', n === 4 ? 'The whole line is clear.' : `${n} of 4 signals clear.`],
  signalsDone: ['Every signal shows clear.', 'In the Junction\'s signal box, the points to the End of the Line can be set.'],
  boardLevers: (levers: number[]) => ['The timetable\'s footnote:', `"Route 13 — levers ${levers.map((l) => l + 1).join(' · ')}."`],
  lever: (step: number) => [step >= 3 ? 'The points swing over with a clank.' : `Lever ${step} of 3 pulled.`, step >= 3 ? 'The line now runs to the End of the Line. The next train from Stillwater will call there.' : ''],
  leverWrong: ['The frame jams and every lever springs back.', 'The timetable\'s footnote has the order.'],
  bridgeAhead: ['The train is crossing the bridge over the drop.', 'Pull the whistle cord.'],
  bridge: ['The whistle goes out over the drop, and far below, something answers.', 'The End of the Line is awake.'],
  whistle: ['The whistle screams into the night.', ''],
  punch: ['The Conductor\'s spare punch, left on the ticket box.', 'Four lost passengers wait on this platform. They can only board a train that is standing here.'],
  passengerWait: ['They only board a train standing at the platform.', ''],
  passenger: (name: string, n: number) => [`${name}'s ticket is punched. They board.`, n === 4 ? 'All four are aboard. Each has one thing left to do along the line.' : `${n} of 4 aboard.`],
  tasksIntro: (hour: number, bells: number[]) => [
    'Ada: "My letter, posted at the Junction." · Theo: "The engine\'s cold. Coal from the Works, then stoke it hot." ·',
    `Mira: "Stillwater's church clock to ${hour} o'clock." · Eli: "The bells at Saint Vesper's for my mother: ${bells.map((b) => ['west', 'middle', 'east'][b]).join(', ')}."`,
  ],
  letter: ['Ada\'s letter, addressed in a girl\'s hand: "To Papa, Penhallow\'s Boardwalk."', 'The Junction\'s post box takes letters for anywhere.'],
  posted: ['The letter drops into the box. Somewhere, a pier bell rings once.', ''],
  coal: (n: number) => [`Coal in the tender (${n} of 3).`, n >= 3 ? 'Stoke the firebox on the move: when the needle is at the top.' : ''],
  stoke: (n: number) => [`The fire roars (${n} of 3).`, n >= 3 ? 'The engine runs hot. Theo grins.' : ''],
  stokeBad: ['Too soon. The fire chokes and settles.', 'Stoke when the needle swings to the top.'],
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
    ['THE BOOKING CLERK', '"The timetable came apart on the train. Look in the luggage, the dining car, Car 13 and the sleepers."'],
    ['THE BOOKING CLERK', '"Wind each station\'s clock while its train is in. The Junction\'s last."'],
    ['THE BOOKING CLERK', '"The battery for the train\'s signal lamp is kept in the lamp room under the signal box."'],
    ['THE BOOKING CLERK', '"Fit it at the front of the tender, and show every signal at danger the green as you pass it."'],
    ['THE BOOKING CLERK', '"The signal box. The timetable\'s footnote has the levers."'],
    ['THE BOOKING CLERK', '"Ride to the End of the Line and whistle on the bridge."'],
    ['THE BOOKING CLERK', '"The punch is on the ticket box at the End of the Line."'],
    ['THE BOOKING CLERK', '"Punch their tickets while the train is in, and they\'ll board."'],
    ['THE BOOKING CLERK', '"Each of them has one errand. Help them all."'],
    ['THE BOOKING CLERK', '"Your own ticket. At the barrier, while a train is in."'],
    ['THE BOOKING CLERK', '"Nothing more I can do. The Night Express must fall."'],
  ],
};

/** The lever frame's order tonight is three distinct levers of five; the bell order a permutation of three. */
export const LEVER_COUNT = LAST_TRAIN.levers;
