// Build and (optionally) deploy the web game (engineering optimization pass).
//
//   npm run deploy                 build into dist/ and carry the live builds' assets forward (no upload)
//   npm run deploy -- --deploy     ...then publish to Netlify production (needs the owner's go-ahead)
//   options: --no-build (reuse dist/), --site=https://nightmare-carnival.netlify.app, --keep=3,
//            --dist=<folder> (another build folder, for testing the carry-forward)
//
// Why the carry-forward: a deploy replaces the whole site, but games already running (a co-op night in
// progress, a Windows app left open) still belong to the old build. Every build's version.json lists its
// fingerprinted assets, so this script downloads the assets of the live build and the builds it kept
// (up to --keep builds back) into the new dist/ before publishing. Old games can keep loading whatever
// they need until they reach a safe moment and take the "Restart & Update" offer. Asset names are content
// hashes, so old and new files never collide.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const dist = join(root, arg('dist', 'dist'));
const flag = (k) => process.argv.includes(`--${k}`);
const SITE = arg('site', 'https://nightmare-carnival.netlify.app').replace(/\/$/, '');
const KEEP = Number(arg('keep', '3'));

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
}

if (arg('dist', 'dist') !== 'dist' && !flag('no-build')) throw new Error('--dist needs --no-build (npm run build always writes dist/)');
if (!flag('no-build')) run('npm', ['run', 'build']);
const manifestPath = join(dist, 'version.json');
if (!existsSync(manifestPath)) throw new Error('dist/version.json is missing: build first');
const next = JSON.parse(readFileSync(manifestPath, 'utf8'));
console.log(`new build ${next.id} (version ${next.version}, protocol ${next.proto}, sim ${next.sim}), ${next.assets.length} assets`);

// the live build and the builds it kept
let live = null;
try {
  const r = await fetch(`${SITE}/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (r.ok) live = await r.json();
} catch (e) {
  console.warn(`could not read the live version.json (${e.message}); nothing to carry forward`);
}
const keep = live ? [{ id: live.id, time: live.time, assets: live.assets ?? [] }, ...(live.previous ?? [])].filter((b) => b.id !== next.id).slice(0, KEEP) : [];
let copied = 0, missing = 0;
for (const b of keep) {
  for (const a of b.assets ?? []) {
    if (!/^assets\/[A-Za-z0-9._-]+$/.test(a)) continue; // only fingerprinted assets, never anything else
    const out = join(dist, a);
    if (existsSync(out)) continue;
    const r = await fetch(`${SITE}/${a}`);
    if (!r.ok) {
      missing++;
      continue;
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(await r.arrayBuffer()));
    copied++;
  }
}
next.previous = keep.map((b) => ({ id: b.id, time: b.time, assets: b.assets }));
writeFileSync(manifestPath, JSON.stringify(next, null, 1));
console.log(live ? `live build ${live.id}: kept ${keep.length} earlier build(s) available (${copied} files copied, ${missing} no longer on the site)` : 'no live build found: nothing carried');

if (flag('deploy')) {
  run('npx', ['netlify-cli', 'deploy', '--prod', `--dir=${arg('dist', 'dist')}`, '--no-build']);
  const r = await fetch(`${SITE}/version.json?t=${Date.now()}`, { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
  console.log(r?.id === next.id ? `live now: ${r.id}` : `warning: the live version.json reports ${r?.id ?? 'nothing'}, expected ${next.id}`);
} else console.log('dist/ is ready. Publish with: npm run deploy -- --deploy --no-build');
