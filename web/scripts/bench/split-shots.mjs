// Write the PNG data URLs an --eval experiment returned (its `shots` map) out as files.
//   node scripts/bench/split-shots.mjs ../artifacts/perf/lod-compare.json ../artifacts/perf/lod
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [file, dir] = process.argv.slice(2);
const j = JSON.parse(readFileSync(file, 'utf8'));
const shots = (j.out ?? j).shots ?? {};
mkdirSync(dir, { recursive: true });
for (const [name, url] of Object.entries(shots)) {
  writeFileSync(join(dir, `${name}.png`), Buffer.from(String(url).split(',')[1], 'base64'));
  console.log(join(dir, `${name}.png`));
}
const { shots: _s, ...rest } = j.out ?? j;
console.log(JSON.stringify(rest, null, 1));
