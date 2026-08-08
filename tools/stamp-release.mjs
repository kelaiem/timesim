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
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, posix } from 'node:path';

const version = process.argv[2];
if (!version) {
  console.error('usage: node tools/stamp-release.mjs <version>');
  process.exit(1);
}
const q = `?v=${encodeURIComponent(version)}`;
let rewrites = 0;

// §79 — the precache manifest is a BY-PRODUCT of this walk: every URL the
// stamp rewrites is a URL a shipped page will ask for, so collecting them
// here is what makes it impossible to ship a file the worker forgot. Keys
// are root-relative WITH their stamp, because the stamped URL is the one
// the page requests. The three seeds are the unstamped stable URLs: the two
// documents (the symlink's own entry points) and the manifest they link.
// version.json is deliberately absent — it is the one file that must never
// come from a cache — and sw.js caches itself via the browser's own
// registration machinery, not via its own manifest.
// §88 — test-geometry.html joined this list when the payload decided it was
// cargo. It had shipped in every release before that WITHOUT being stamped or
// precached: its importmap and its `./src/geometry.js` import were the only
// unversioned asset URLs left in a release, so that one page could be served
// stale forever. Being in the payload and being stamped are the same decision.
// favicon.svg, favicon.png, and apple-touch-icon.png join the unstamped seeds
// for the manifest's reason: the documents and the manifest all reference them
// by a stable path, and icons missing offline are a small but visible hole in
// pages that otherwise load. Safari uses favicon.png as an SVG fallback.
const SEEDS = ['index.html', 'explain.html', 'test-geometry.html',
  'manifest.webmanifest', 'favicon.svg', 'favicon.png', 'apple-touch-icon.png'];
// A seed is listed by NAME, not discovered by the walk, so a typo or a file the
// payload does not carry is invisible here and fatal at the far end: addAll is
// all-or-nothing, so a worker that precaches one URL the release lacks NEVER
// ACTIVATES, and this script would still exit 0. Caught while adding
// favicon.svg — the seed was in the list a run before the file was in the tree,
// and the stamp reported a healthy 20 precached URLs over a release that could
// not have worked offline at all.
for (const f of SEEDS) {
  if (!existsSync(f)) {
    console.error(`stamp-release: precache seed '${f}' is not in this tree — the worker would list a URL the release does not carry, and addAll being all-or-nothing it would never activate`);
    process.exit(1);
  }
}
const precache = new Set(SEEDS);

// The documents: module entry points, importmap targets, and (explain.html)
// the explainer's module imports. Both carry the baked app-version meta —
// index.html so layer 2 can compare baked-vs-live, explain.html so its §79
// worker registration has the same "am I a release" signal without a fetch.
for (const doc of ['index.html', 'explain.html', 'test-geometry.html']) {
  let html = readFileSync(doc, 'utf8');
  html = html.replace(/(["'])(\.\/(?:vendor|src)\/[^"'?]+?)(["'])/g, (_m, a, url, b) => {
    rewrites++;
    precache.add(url.slice(2) + q);
    return `${a}${url}${q}${b}`;
  });

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
  writeFileSync(doc, html);
}

// Every relative specifier inside the module graph — ./ AND ../, since
// inspect.js reaches up into vendor/. A module's imports resolve against ITS
// OWN url and a query does not propagate, so each one has to carry the
// version itself or that file keeps coming from cache. The first version of
// this matched only ./ and silently left the bvh vendor import unversioned,
// which is why the leftover scan below matches both forms too: a scan that
// looks for less than the rewrite did will always report success. Dynamic
// import('...') specifiers are the same class of URL — inspect.js (the
// documented console entry) and the explain-i18n locale tables come in ONLY
// that way, and shipped unversioned until §79's precache walk needed the
// URLs the pages actually request.
const stampSpec = (file) => (_m, a, url, b) => {
  rewrites++;
  precache.add(posix.normalize(posix.join(posix.dirname(file), url)) + q);
  return `${a}${url}${q}${b}`;
};
for (const f of readdirSync('src').filter((n) => n.endsWith('.js'))) {
  const p = join('src', f);
  const stamp = stampSpec(`src/${f}`);
  const before = readFileSync(p, 'utf8');
  const after = before
    .replace(/(\bfrom\s+['"])(\.\.?\/[^'"?]+?)(['"])/g, stamp)
    .replace(/(\bimport\(\s*['"])(\.\.?\/[^'"?]+?)(['"]\s*\))/g, stamp);
  if (after !== before) writeFileSync(p, after);
}

// Assert the sweep was TOTAL rather than trusting the count: any relative
// asset url still lacking a version would be a file served stale forever, and
// a silently-missed import is exactly how this class of bug survives.
const leftovers = [];
const scan = (p, re) => { const s = readFileSync(p, 'utf8'); let m; while ((m = re.exec(s))) leftovers.push(`${p}: ${m[0].trim()}`); };
for (const doc of ['index.html', 'explain.html', 'test-geometry.html'])
  scan(doc, /["']\.\/(?:vendor|src)\/[^"'?]+["']/g);
for (const f of readdirSync('src').filter((n) => n.endsWith('.js'))) {
  scan(join('src', f), /\bfrom\s+['"]\.\.?\/[^'"?]+['"]/g);
  scan(join('src', f), /\bimport\(\s*['"]\.\.?\/[^'"?]+['"]\s*\)/g);
}
if (leftovers.length) {
  console.error('stamp-release: unversioned asset url(s) left behind — these would be served stale:\n  ' + leftovers.join('\n  '));
  process.exit(1);
}
if (rewrites === 0) {
  console.error('stamp-release: nothing was rewritten — refusing to emit a release that would not be versioned');
  process.exit(1);
}

// §79 — bake the worker. VERSION names the release's cache (activation drops
// every other timesim-* cache), and PRECACHE is the manifest gathered above.
// Both placeholders must exist and must be consumed: a worker shipped with
// VERSION still null is INERT by design (that is the source-tree stub), so
// shipping one in a release would silently deliver no offline support at all.
{
  const sw = readFileSync('sw.js', 'utf8')
    .replace(/^const VERSION = null;.*$/m, `const VERSION = ${JSON.stringify(version)};`)
    .replace(/^const PRECACHE = \[\];.*$/m, `const PRECACHE = ${JSON.stringify([...precache].sort())};`);
  if (/^const (?:VERSION = null|PRECACHE = \[\]);/m.test(sw)) {
    console.error('stamp-release: sw.js placeholder(s) not replaced — the worker would ship inert, offline support silently absent');
    process.exit(1);
  }
  writeFileSync('sw.js', sw);
}

// version.json is what layer 2 polls. Served no-store: it is the one file that
// must never come from a cache, since its whole job is to reveal a stale one.
writeFileSync('version.json', JSON.stringify({ version }) + '\n');
console.log(`stamp-release: ${version} — ${rewrites} url(s) versioned, none left unversioned, ${precache.size} url(s) precached in sw.js, version.json written`);
