// Ghost Train smoke run (D-80): a headless night with an autopilot that rides the train between stations.
import { makeGame, autopilot, autoDraft } from '../tests/helpers';
import { regionAt, TRANSIT, trainOrigin, REGIONS } from '../src/data/ghosttrain';
import { trainNow } from '../src/sim/ghosttrain';
import { PHANTOM_DOOR } from '../src/data/gtStations';

const secs = Number(process.argv[2] ?? 600);
const g = makeGame({ map: 'ghost_train', godMode: true, seed: 7 } as never);
const t0 = performance.now();
let transfers = 0, lastR = -9, maxAlive = 0, maxAboard = 0, bossesSeen = new Set<string>();
const counts: Record<number, number> = {};
for (let i = 0; i < secs * 60 && g.phase !== 'ended'; i++) {
  autoDraft(g);
  const p = g.player;
  const st = trainNow(g);
  const r = regionAt(p.x, p.y);
  // ride: during a dwell at the player's station, walk into the parked train's coach; otherwise kite
  if (st.phase === 'dwell' && st.at === r && st.departIn > 6) {
    const o = trainOrigin(r);
    const tx = o.x + 600, ty = o.y;
    const dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy) || 1;
    // through the coach's door: go to the door first, then in
    const door = { x: o.x + 470, y: o.y + 150 };
    const inside = Math.abs(p.y - o.y) < 100;
    const gx = inside ? tx : door.x, gy = inside ? ty : (Math.abs(p.x - door.x) < 30 ? o.y : door.y);
    const ddx = gx - p.x, ddy = gy - p.y, dl = Math.hypot(ddx, ddy) || 1;
    g.input.moveX = ddx / dl;
    g.input.moveY = ddy / dl;
    void dx; void dy; void l;
  } else if (st.phase === 'dwell' && r === st.at && st.departIn <= 6 && st.departIn > 3) {
    // get off at the next stop: step out of the doors
    const o = trainOrigin(r);
    g.input.moveX = 0;
    g.input.moveY = p.y < o.y + 140 ? 1 : 0;
  } else if (g.time >= 1741 && r >= 0 && r < 4) {
    // the phantom doors: through to the End of the Line
    const d = PHANTOM_DOOR[r];
    const dx = d.x - p.x, dy = d.y + 40 - p.y, l = Math.hypot(dx, dy) || 1;
    g.input.moveX = l > 30 ? dx / l : 0;
    g.input.moveY = l > 30 ? dy / l : 0;
    if (l < 60) g.inputs[0].interact = true;
  } else if (r === TRANSIT) {
    g.input.moveX = 0; g.input.moveY = 0;
  } else autopilot(g);
  if (r !== lastR) {
    if (lastR !== -9) transfers++;
    lastR = r;
  }
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
