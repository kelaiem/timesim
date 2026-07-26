// §28 layer 1 — give every asset a per-release URL, so a browser CANNOT serve
// a stale one, and emit the version.json layer 2 polls.
//
// Why not the content-hashed bundle §28 proposed. That plan assumed GitHub
// Pages; this project deploys differently (.github/workflows/release.yml):
// each release is uploaded whole into  <releases>/<version>/  and a QA symlink
// is repointed at it. So a per-release URL ALREADY EXISTS — the release
// directory is the fingerprint, and it is exact rather than content-derived.
// Rewriting the asset base to that absolute path gives layer 1's guarantee
// with no bundler, no hashing step and no new toolchain.
//
// It also keeps two things a bundle would have broken:
//   · `await import('./src/inspect.js')` from the console — CLAUDE.md's
//     documented way to run the battery, and the project's core tool.
//   · the importmap, which keeps `three` a single shared instance.
//
// The mechanism: index.html loads main.js from an ABSOLUTE versioned path, and
// every relative import inside the module graph (./geometry.js, ./inspect.js,
// …) resolves against THAT url — so the whole graph inherits the version for
// free. The importmap entries are rewritten for the same reason.
//
// Usage:  node tools/stamp-release.mjs <version> <base-url-path>
//   e.g.  node tools/stamp-release.mjs 0.1.3 /releases/0.1.3
import { readFileSync, writeFileSync } from 'node:fs';

const [version, basePath] = process.argv.slice(2);
if (!version || !basePath) {
  console.error('usage: node tools/stamp-release.mjs <version> <base-url-path>');
  process.exit(1);
}
const base = basePath.replace(/\/+$/, '');

let html = readFileSync('index.html', 'utf8');
const before = html;
// Only ./-relative asset URLs are rewritten. Anything already absolute, or
// remote, is left exactly as it is.
html = html.replace(/(["'])\.\/(vendor|src)\//g, `$1${base}/$2/`);
if (html === before) {
  console.error('stamp-release: no ./vendor or ./src asset URLs found in index.html — refusing to emit a release that would not be versioned');
  process.exit(1);
}
writeFileSync('index.html', html);

// version.json is what layer 2 polls. Served no-store; it is the one file that
// must never come from a cache, since its whole job is to reveal a stale one.
writeFileSync('version.json', JSON.stringify({ version }) + '\n');

const rewrites = (html.match(new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(vendor|src)/`, 'g')) || []).length;
console.log(`stamp-release: ${version} — ${rewrites} asset URL(s) rebased to ${base}/, version.json written`);
