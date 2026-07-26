// §28 layer 1 — give every asset a per-release URL, so a browser CANNOT serve
// a stale one, and emit the version.json layer 2 polls.
//
// Why not the content-hashed bundle §28 proposed. That plan assumed GitHub
// Pages; this project deploys differently (.github/workflows/release.yml):
// each release is uploaded whole into <releases>/<version>/ and a QA symlink
// is repointed at it. A bundle would also have cost two things worth more than
// the caching problem: the importmap (three stays ONE shared instance) and
// `await import('./src/inspect.js')` from the console, which is CLAUDE.md's
// documented way to run the battery.
//
// Why URLs stay RELATIVE. The obvious move is to rebase every asset onto an
// absolute /<releases>/<version>/ path — the release directory as fingerprint.
// That works only if the releases directory is itself inside the web root, and
// it is not knowable from this repo: the site is distributed as the SYMLINK,
// and if the web root IS the symlink then /<releases>/... is not in the URL
// space at all and every asset 404s. A deploy that breaks the whole app to fix
// a caching problem is a bad trade, so nothing here depends on the layout:
// paths stay relative and carry ?v=<version>, which changes the cache key
// whether the site is served from the symlink or from the project root.
//
// Usage:  node tools/stamp-release.mjs <version>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const version = process.argv[2];
if (!version) {
  console.error('usage: node tools/stamp-release.mjs <version>');
  process.exit(1);
}
const q = `?v=${encodeURIComponent(version)}`;
let rewrites = 0;

// index.html: the module entry point and the importmap targets.
let html = readFileSync('index.html', 'utf8');
html = html.replace(/(["'])(\.\/(?:vendor|src)\/[^"'?]+?)(["'])/g, (_m, a, url, b) => { rewrites++; return `${a}${url}${q}${b}`; });

// BAKE the version into the document. This is what makes a stale index.html
// detectable: the app compares the version it was BUILT with against the one
// the server serves now. Reading "what am I running" from a runtime fetch
// would report the NEW version even when the browser replayed an old cached
// index.html — the one case layer 2 exists for, silently undetectable.
if (/name=["']app-version["']/.test(html)) {
  html = html.replace(/(<meta\s+name=["']app-version["']\s+content=)["'][^"']*["']/, `$1"${version}"`);
} else {
  html = html.replace(/<\/head>/, `<meta name="app-version" content="${version}" />\n</head>`);
}
writeFileSync('index.html', html);

// Every relative specifier inside the module graph — ./ AND ../, since
// inspect.js reaches up into vendor/. A module's imports resolve against ITS
// OWN url and a query does not propagate, so each one has to carry the
// version itself or that file keeps coming from cache. The first version of
// this matched only ./ and silently left the bvh vendor import unversioned,
// which is why the leftover scan below matches both forms too: a scan that
// looks for less than the rewrite did will always report success.
for (const f of readdirSync('src').filter((n) => n.endsWith('.js'))) {
  const p = join('src', f);
  const before = readFileSync(p, 'utf8');
  const after = before.replace(/(\bfrom\s+['"])(\.\.?\/[^'"?]+?)(['"])/g, (_m, a, url, b) => { rewrites++; return `${a}${url}${q}${b}`; });
  if (after !== before) writeFileSync(p, after);
}

// Assert the sweep was TOTAL rather than trusting the count: any relative
// asset url still lacking a version would be a file served stale forever, and
// a silently-missed import is exactly how this class of bug survives.
const leftovers = [];
const scan = (p, re) => { const s = readFileSync(p, 'utf8'); let m; while ((m = re.exec(s))) leftovers.push(`${p}: ${m[0].trim()}`); };
scan('index.html', /["']\.\/(?:vendor|src)\/[^"'?]+["']/g);
for (const f of readdirSync('src').filter((n) => n.endsWith('.js'))) scan(join('src', f), /\bfrom\s+['"]\.\.?\/[^'"?]+['"]/g);
if (leftovers.length) {
  console.error('stamp-release: unversioned asset url(s) left behind — these would be served stale:\n  ' + leftovers.join('\n  '));
  process.exit(1);
}
if (rewrites === 0) {
  console.error('stamp-release: nothing was rewritten — refusing to emit a release that would not be versioned');
  process.exit(1);
}

// version.json is what layer 2 polls. Served no-store: it is the one file that
// must never come from a cache, since its whole job is to reveal a stale one.
writeFileSync('version.json', JSON.stringify({ version }) + '\n');
console.log(`stamp-release: ${version} — ${rewrites} url(s) versioned, none left unversioned, version.json written`);
