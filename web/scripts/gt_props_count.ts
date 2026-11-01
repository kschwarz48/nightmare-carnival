import { STATION_PROPS } from '../src/data/gtStations';
import { GT_PROPS } from '../src/data/ghosttrain';
const c: Record<string, number> = {};
for (const p of STATION_PROPS) c[p.kind] = (c[p.kind] ?? 0) + 1;
console.log('station props', STATION_PROPS.length, 'all props', GT_PROPS.length, 'solid', GT_PROPS.filter((p) => p.r || (p.hw && p.hh)).length);
console.log(JSON.stringify(c));
