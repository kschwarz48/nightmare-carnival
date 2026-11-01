// Prints the Ghost Train's timetable (D-80): every arrival and departure across a night, with the End of the
// Line opening at the final act (or earlier: pass a time, e.g. `npx vite-node scripts/gt_timetable.ts 700`).
import { DWELL, FINAL_ACT, REGIONS, trainAt } from '../src/data/ghosttrain';

const eFrom = Number(process.argv[2] ?? FINAL_ACT);
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
let prev = trainAt(0, eFrom);
const rows: string[] = [];
for (let t = 0.05; t <= 2200; t += 0.05) {
  const s = trainAt(t, eFrom);
  if (s.phase !== prev.phase || s.at !== prev.at) {
    if (s.phase === 'dwell') rows.push(`${mmss(t).padStart(5)}  arrive ${REGIONS[s.at].name.padEnd(22)} (dwell ${DWELL[s.at]} s, then ${REGIONS[s.to].name})`);
    else if (s.phase === 'travel') rows.push(`${mmss(t).padStart(5)}  depart ${REGIONS[s.at].name.padEnd(22)} → ${REGIONS[s.to].name}${s.passing ? ' (through the End of the Line)' : ''}, ${s.len} s, ${Math.round(s.legDist)} units`);
  }
  prev = s;
}
console.log(`eFrom = ${mmss(eFrom)}\n${rows.join('\n')}`);
