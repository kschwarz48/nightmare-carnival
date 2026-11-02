// Ghost Train smoke run (D-80): a headless night with an autopilot that rides the train between stations.
// D-90: the train goes at the whistle, so the bot fights at each station for a while, walks into the tender, pulls
// the cord, rides, and gets off at the next stop.
//   npx vite-node scripts/gt_smoke.ts [secs] [stay]
import { makeGame, autopilot, autoDraft } from '../tests/helpers';
import { regionAt, TRANSIT, trainOrigin, REGIONS, PHANTOM_AT } from '../src/data/ghosttrain';
import { trainNow } from '../src/sim/ghosttrain';
import { LT_TRAIN, PHANTOM_DOOR } from '../src/data/gtStations';

const secs = Number(process.argv[2] ?? 600);
/** seconds the bot fights at each station before it boards */
const stay = Number(process.argv[3] ?? 75);
const g = makeGame({ map: 'ghost_train', godMode: true, seed: 7 } as never);
const t0 = performance.now();
let transfers = 0, lastR = -9, maxAlive = 0, maxAboard = 0, arrivedAt = 0;
const bossesSeen = new Set<string>();
const counts: Record<number, number> = {};
const steer = (x: number, y: number, slack = 24) => {
  const p = g.player, dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy);
  g.input.moveX = l > slack ? dx / l : 0;
  g.input.moveY = l > slack ? dy / l : 0;
  return l;
};
for (let i = 0; i < secs * 60 && g.phase !== 'ended'; i++) {
  autoDraft(g);
  const p = g.player;
  const st = trainNow(g);
  const r = regionAt(p.x, p.y);
  g.inputs[0].interact = false;
  if (r !== lastR) {
    if (lastR !== -9) transfers++;
    if (r >= 0 && r < TRANSIT) arrivedAt = g.time;
    lastR = r;
  }
  const trainHere = st.phase === 'dwell' && st.at === r && st.doors && !st.terminated;
  if (g.time >= PHANTOM_AT + 1 && r >= 0 && r < 4) {
    // the phantom doors: through to the End of the Line
    const d = PHANTOM_DOOR[r];
    if (steer(d.x, d.y + 40, 30) < 60) g.inputs[0].interact = true;
  } else if (r === TRANSIT) {
    g.input.moveX = g.input.moveY = 0;
  } else if (trainHere && g.time - arrivedAt > stay) {
    // board through the tender's door and pull the cord (once it is pulled, wait aboard)
    const o = trainOrigin(r);
    const inside = Math.abs(p.y - o.y) < 100;
    const cord = { x: o.x + LT_TRAIN.whistle.x - 20, y: o.y + LT_TRAIN.whistle.y + 30 };
    if (!inside) {
      const door = { x: o.x + 1540, y: o.y + 150 };
      if (Math.abs(p.x - door.x) < 26) steer(door.x, o.y, 4);
      else steer(door.x, door.y, 4);
    } else if (Number.isFinite(st.departIn)) {
      g.input.moveX = g.input.moveY = 0;
    } else if (steer(cord.x, cord.y, 10) < 40) g.inputs[0].interact = true;
  } else if (r >= 0 && r < TRANSIT && Math.abs(p.y - trainOrigin(r).y) < 140 && st.phase === 'dwell' && st.at === r) {
    // just come in: step off the train onto the platform
    g.input.moveX = 0;
    g.input.moveY = 1;
  } else autopilot(g);
  counts[r] = (counts[r] ?? 0) + 1;
  g.tick();
  maxAlive = Math.max(maxAlive, g.active.length);
  let aboard = 0;
  for (const e of g.active) if (e.alive && regionAt(e.x, e.y) === TRANSIT) aboard++;
  maxAboard = Math.max(maxAboard, aboard);
  for (const b of g.bosses) bossesSeen.add(`${b.def.id}@${regionAt(b.x, b.y)}${b.dead ? ':dead' : ''}`);
  if (i % (60 * 60) === 0) console.log(`${(g.time / 60).toFixed(1)}m region=${r} lvl=${p.level} alive=${g.active.length} aboard=${aboard} train=${st.phase}@${st.at}->${st.to}`);
}
console.log(JSON.stringify({ phase: g.phase, time: Math.round(g.time), won: g.endStats?.won, secs, ms: Math.round(performance.now() - t0), transfers, maxAlive, maxAboard, counts, bosses: [...bossesSeen], kills: g.kills, level: g.player.level }, null, 1));
void REGIONS;
