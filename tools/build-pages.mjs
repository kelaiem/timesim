// §88 — turn one extracted payload tree into one deployable GitHub Pages
// environment. The workflow (.github/workflows/pages.yml) extracts the tree
// with `git archive` — the same payload definition release.yml uses, so Pages
// and QA serve the same bytes — and this script finishes it.
//
//   node tools/build-pages.mjs <dir> <version> <environment>
//
// Three steps, in order:
//
//   1. Run tools/stamp-release.mjs INSIDE <dir>. That is the whole of §28
//      layer 1 plus §79's precache bake, unchanged and unforked: the Pages
//      environments are stamped releases, not a second kind of build. Nothing
//      here re-implements any of it, which is the point — a fork of the
//      stamper is how the two topologies would silently drift apart.
//
//   2. Non-production environments get `<meta name="robots" content="noindex">`.
//      A project Pages site serves all three environments under ONE origin, and
//      robots.txt is only honoured at the ORIGIN root — which this repo does
//      not own (kelaiem.github.io/robots.txt is the user site's). The meta tag
//      is the only exclusion signal a project site can actually give, so it is
//      the one used. Production says nothing and is indexable.
//
//   3. `<meta name="app-environment">` in both documents, and an `environment`
//      field in version.json. Same reasoning §28 gives for baking app-version
//      into the document rather than fetching it: what a viewer is LOOKING AT
//      has to be readable from the bytes that were served, or a cached document
//      answers for a deploy it is not running. Nothing in src/ reads either —
//      they exist so a bug report can name its environment without guessing
//      from the URL.
//
// The version strings themselves are resolved by the workflow, from git, and
// are never invented here: production and testing carry a release tag, and
// development carries `git describe` — literally "N commits past 2.1.9" —
// because that is what the tip of main IS.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir, version, environment] = process.argv.slice(2);
if (!dir || !version || !environment) {
  console.error('usage: node tools/build-pages.mjs <dir> <version> <environment>');
  process.exit(1);
}
const ENVIRONMENTS = new Set(['production', 'testing', 'development']);
if (!ENVIRONMENTS.has(environment)) {
  console.error(`build-pages: unknown environment ${JSON.stringify(environment)} — expected one of ${[...ENVIRONMENTS].join(', ')}`);
  process.exit(1);
}
const HERE = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir);
for (const f of ['index.html', 'explain.html', 'sw.js']) {
  if (!existsSync(join(root, f))) {
    console.error(`build-pages: ${dir} is not a payload tree — ${f} is missing`);
    process.exit(1);
  }
}

// 1. the release stamp, run from inside the tree it stamps
execFileSync('node', [join(HERE, 'stamp-release.mjs'), version], { cwd: root, stdio: 'inherit' });

// 2 + 3. the environment's own two marks, inserted AFTER stamping so the §79
// precache manifest — which is a by-product of the stamping walk — is not
// affected. Both documents are precached by PATH, unstamped, so editing them
// here cannot invalidate a key the worker will ask for.
const marks = [`<meta name="app-environment" content="${environment}" />`];
if (environment !== 'production') marks.push('<meta name="robots" content="noindex" />');
for (const doc of ['index.html', 'explain.html']) {
  const p = join(root, doc);
  let html = readFileSync(p, 'utf8');
  if (!html.includes('</head>')) {
    console.error(`build-pages: ${doc} has no </head> to insert the environment marks before`);
    process.exit(1);
  }
  html = html.replace('</head>', `${marks.join('\n')}\n</head>`);
  writeFileSync(p, html);
}

// version.json gains the environment beside the version it already carried.
// main.js reads .version and ignores the rest, so this is additive; it is here
// so `curl <env>/version.json` answers both halves of "what is deployed where".
const vjson = join(root, 'version.json');
const parsed = JSON.parse(readFileSync(vjson, 'utf8'));
if (parsed.version !== version) {
  console.error(`build-pages: stamp wrote version ${parsed.version}, expected ${version}`);
  process.exit(1);
}
writeFileSync(vjson, JSON.stringify({ version, environment }) + '\n');

console.log(`build-pages: ${environment} — ${version}${environment === 'production' ? '' : ', noindex'}`);
