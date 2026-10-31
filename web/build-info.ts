// Build identity (engineering optimization pass): every build gets a unique id (commit + build time), a
// human-readable version, its network protocol number and a fingerprint of the simulation code. The
// game reads them as __NC_BUILD__; the build also publishes them as version.json, which running games
// poll to learn that a newer build is live (src/platform/updates.ts), and which lists this build's
// assets so a deploy can keep them available for games still playing it (scripts/deploy.mjs).
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

export interface BuildInfo {
  /** unique per build: short commit (+ if the tree had uncommitted changes) and build time */
  id: string;
  /** the human-readable version (package.json) */
  version: string;
  commit: string;
  /** ISO time of the build */
  time: string;
  /** the co-op wire protocol (src/net/protocol.ts PROTO): different numbers can't talk at all */
  proto: number;
  /** fingerprint of src/sim, src/data and src/net: different values must not share a night */
  sim: string;
}

function git(cmd: string, root: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** A hash of every simulation, data and protocol source file (line endings normalised). */
export function simFingerprint(root: string): string {
  const h = createHash('sha256');
  for (const f of ['src/sim', 'src/data', 'src/net'].flatMap((d) => files(join(root, d))).sort()) {
    h.update(relative(root, f).replace(/\\/g, '/'));
    h.update(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
  }
  return h.digest('hex').slice(0, 12);
}

export function computeBuildInfo(root: string, dev: boolean): BuildInfo {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  const proto = Number(/export const PROTO = (\d+)/.exec(readFileSync(join(root, 'src/net/protocol.ts'), 'utf8'))?.[1] ?? 0);
  const commit = git('rev-parse --short HEAD', root) || 'local';
  const dirty = git('status --porcelain -- .', root) ? '+' : '';
  const now = new Date();
  return {
    id: dev ? 'dev' : `${commit}${dirty}-${now.getTime().toString(36)}`,
    version: pkg.version,
    commit: `${commit}${dirty}`,
    time: now.toISOString(),
    proto,
    sim: simFingerprint(root),
  };
}

/** Defines __NC_BUILD__ and emits version.json (with the build's asset list) next to index.html. */
export function buildInfo(root: string): Plugin {
  let info: BuildInfo;
  return {
    name: 'nc-build-info',
    config(_c, env) {
      info = computeBuildInfo(root, env.command === 'serve');
      return { define: { __NC_BUILD__: JSON.stringify(info) } };
    },
    generateBundle(_o, bundle) {
      const assets = Object.keys(bundle).filter((f) => f.startsWith('assets/')).sort();
      let desktop: unknown = null;
      try {
        desktop = JSON.parse(readFileSync(join(root, 'desktop-release.json'), 'utf8'));
      } catch {
        desktop = null;
      }
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ ...info, assets, desktop, previous: [] }, null, 1) });
    },
  };
}
