// §79's instrument — the offline acceptance, scripted. Not part of the PR
// battery (it exercises the RELEASE machinery, which the battery's source
// tree deliberately never runs): use it when touching sw.js,
// stamp-release.mjs, the registration, or the update toast.
//
//   cd tools && npm ci && node offline-check.mjs
//
// What it builds: two stamped release trees from the CURRENT WORKING TREE
// (uncommitted changes included — this is a pre-land check), served behind a
// repointed symlink, which is the QA topology. Tree A's files are backdated
// 10 s: Last-Modified has one-second granularity, and two trees stamped in
// the same second make every conditional revalidation answer 304 — the
// update check then honestly reports "nothing changed", which reads as a bug
// in the reload dance but is an artifact no real deploy can produce
// (releases are never seconds apart). Found the hard way; see BUILT §79.
//
// What it asserts (20): worker controls on first load · one cache, named for
// the scope AND the version · version.json and /__state NOT cached · precache
// complete · OFFLINE: index boots, deep link boots, explain.html renders ·
// deploy → toast → Reload lands on the NEW version and drops the old cache ·
// TWO ENVIRONMENTS UNDER ONE ORIGIN keep one cache each and both still boot
// offline (§88) · the source tree registers NO worker · a hand-registered stub
// dismantles itself having cached nothing · console silent (rule 6) in all
// three trees.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { cpSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, utimesSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VA = '0.0.0-offline-check-a', VB = '0.0.0-offline-check-b';

// §88 — the cache name is the worker's SCOPE PATH and its version, so a name
// cannot be written here without saying where the release is served from. That
// is the whole content of the change this mirrors: before it, the name was the
// version alone, and two releases sharing an origin evicted each other.
const cacheName = (scopePath, version) => `timesim-${scopePath}-${version}`;

const freePort = () => new Promise((res, rej) => {
  const srv = createServer();
  srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => res(p)); });
  srv.on('error', rej);
});
const waitFor = async (url, ms) => {
  const t0 = Date.now();
  for (;;) {
    try { await fetch(url); return; } catch { if (Date.now() - t0 > ms) throw new Error(`server never answered at ${url}`); }
    await new Promise((r) => setTimeout(r, 150));
  }
};
const touchTree = (dir, when) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) touchTree(p, when);
    else utimesSync(p, when, when);
  }
};

// Two stamped trees from the working tree — the release payload as
// tools/payload.sh defines it (§88: the app, vendor/ and the licences; no
// repo documentation, no dev_server.py). Copied by name rather than shelling
// out to payload.sh because this must include UNCOMMITTED work — it is a
// pre-land check, and git archive only sees what is committed.
const work = mkdtempSync(join(tmpdir(), 'timesim-offline-'));
const build = (name, version) => {
  const dir = join(work, name);
  for (const f of ['index.html', 'explain.html', 'test-geometry.html', 'sw.js', 'manifest.webmanifest', 'src', 'vendor'])
    cpSync(join(ROOT, f), join(dir, f), { recursive: true });
  execFileSync('node', [join(ROOT, 'tools/stamp-release.mjs'), version], { cwd: dir, stdio: 'pipe' });
  return dir;
};
console.log('building two stamped trees…');
const relA = build('a', VA);
const relB = build('b', VB);
touchTree(relA, new Date(Date.now() - 10_000)); // see header: defeat 1 s Last-Modified granularity
const site = join(work, 'site');
symlinkSync(relA, site);

const results = [];
const check = (name, ok, note = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  (${note})` : ''}`); };
const IGNORE = /net::ERR|Failed to load resource|WebGL|GroupMarkerNotSet|GPU stall|swiftshader/; // infra noise + the tolerated /__state class, same as ci-battery
const wireNoise = (page, sink) => {
  page.on('pageerror', (e) => sink.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') sink.push(`${m.type()}: ${m.text()}`); });
};

// Three roots: the "QA symlink" (one release at the server root), the editable
// source tree, and — for §88 — the work directory itself, which already holds
// both stamped trees as a/ and b/ and so IS a two-environment origin.
const relPort = await freePort(), devPort = await freePort(), multiPort = await freePort();
const servers = [
  spawn('python3', ['-m', 'http.server', String(relPort), '--bind', '127.0.0.1', '--directory', site], { stdio: 'ignore' }),
  spawn('python3', ['-m', 'http.server', String(devPort), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' }),
  spawn('python3', ['-m', 'http.server', String(multiPort), '--bind', '127.0.0.1', '--directory', work], { stdio: 'ignore' }),
];
const browser = await chromium.launch();
try {
  await waitFor(`http://127.0.0.1:${relPort}/index.html`, 15000);

  // ---- release tree ----
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const noise = [];
  wireNoise(page, noise);
  await page.goto(`http://127.0.0.1:${relPort}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
  check('release: worker active and controlling on first load', true);

  const cacheA = cacheName('/', VA), cacheB = cacheName('/', VB); // served at the server root
  const keys = await page.evaluate(() => caches.keys());
  check('release: one cache, named for the scope and the version', keys.length === 1 && keys[0] === cacheA, keys.join());
  const vjson = await page.evaluate(async (k) => !!(await (await caches.open(k)).match('version.json')), cacheA);
  check('release: version.json NOT in the cache', !vjson);
  const stateCached = await page.evaluate(async (k) => !!(await (await caches.open(k)).match('/__state')), cacheA);
  check('release: /__state NOT in the cache', !stateCached);
  const counts = await page.evaluate(async (k) => (await (await caches.open(k)).keys()).length, cacheA);
  // 19 since §88 made test-geometry.html a stamped, precached document; it was
  // 18 while that page shipped unstamped and uncached.
  check('release: precache complete', counts === 19, `${counts}/19`);

  // ---- offline: the whole point ----
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  check('OFFLINE: index.html boots, movement up', true);
  const ver = await page.evaluate(() => document.querySelector('meta[name="app-version"]')?.content);
  check('OFFLINE: served build is the stamped release', ver === VA, String(ver));
  await page.goto(`http://127.0.0.1:${relPort}/index.html?lang=de`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  check('OFFLINE: deep link (?lang=de) boots', true);
  await page.goto(`http://127.0.0.1:${relPort}/explain.html`, { waitUntil: 'load' });
  const explainOk = await page.evaluate(() => document.querySelectorAll('details.mech').length > 0);
  check('OFFLINE: explain.html loads with content', explainOk);
  await page.goto(`http://127.0.0.1:${relPort}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  await ctx.setOffline(false);

  // ---- a release lands: repoint the "QA symlink", expect the ONE toast ----
  unlinkSync(site); symlinkSync(relB, site);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForSelector('#clock-update.show', { timeout: 30000 });
  check('update: toast appears after deploy (focus poll)', true);
  await page.click('#clock-update button:not(.dismiss)');
  await page.waitForFunction((v) => document.querySelector('meta[name="app-version"]')?.content === v, VB, { timeout: 30000 });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  check('update: Reload crosses the worker boundary to the NEW release', true);
  await page.waitForFunction(async (k) => (await caches.keys()).join() === k, cacheB, { timeout: 30000 });
  check('update: old release cache dropped on activation', true);

  let bad = noise.filter((n) => !IGNORE.test(n));
  check('release: console silent throughout (rule 6)', bad.length === 0, bad.slice(0, 3).join(' | '));
  await ctx.close();

  // ---- source tree: no worker, and a hand-registered one dismantles ----
  const dctx = await browser.newContext();
  const dpage = await dctx.newPage();
  const dnoise = [];
  wireNoise(dpage, dnoise);
  await dpage.goto(`http://127.0.0.1:${devPort}/index.html`, { waitUntil: 'load' });
  await dpage.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  const devRegs = await dpage.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
  check('dev: source tree registers NO worker', devRegs === 0);
  const gone = await dpage.evaluate(async () => {
    const reg = await navigator.serviceWorker.register('sw.js');
    await new Promise((res) => {
      const w = reg.installing || reg.waiting || reg.active;
      if (!w || w.state === 'activated') return res();
      w.addEventListener('statechange', () => { if (w.state === 'activated' || w.state === 'redundant') res(); });
    });
    await new Promise((r) => setTimeout(r, 500)); // let activate's unregister land
    return (await navigator.serviceWorker.getRegistrations()).length === 0;
  });
  check('dev: hand-registered stub unregisters itself', gone);
  const cachesEmpty = await dpage.evaluate(async () => (await caches.keys()).length === 0);
  check('dev: stub cached nothing', cachesEmpty);
  bad = dnoise.filter((n) => !IGNORE.test(n));
  check('dev: boot silent (rule 6)', bad.length === 0, bad.slice(0, 3).join(' | '));
  await dctx.close();

  // ---- §88: two environments, one origin ----
  //
  // The GitHub Pages topology, minimally reproduced: the SAME origin serving
  // two stamped releases at two paths (/a/ and /b/ here; /timesim/testing/ and
  // /timesim/development/ there). Cache Storage is partitioned by ORIGIN, not
  // by path, so both workers' caches land in one bucket and each activation
  // sees the other's keys.
  //
  // This is the regression, and it is not hypothetical — it is what the flat
  // `timesim-<version>` name did: activation deleted every `timesim-`-prefixed
  // key that was not its own, so bringing up the second environment threw away
  // the first's precache and §79's offline guarantee survived only for
  // whichever environment was visited last. Order matters: a is brought up
  // FIRST and b second, so under the old name it is a's cache that is gone.
  //
  // WHICH OF THE TWO CHECKS BELOW ACTUALLY FIRES, measured against the
  // pre-§88 worker rather than assumed. The CACHE-KEY check is the
  // discriminator: it read back one key, `timesim-<b's version>`, a's having
  // been deleted. The OFFLINE BOOT check passed anyway — three ways of asking
  // (reload; reload after a CDP Network.clearBrowserCache; a fresh page after
  // closing both) all still booted a, because python3's http.server sends no
  // Cache-Control and the browser answered from its own caches. So the offline
  // boot is kept as a statement of the GUARANTEE, end to end, and is not
  // evidence about the service worker's cache on its own. Do not "strengthen"
  // it by clearing the HTTP cache — that was tried and changed nothing.
  const mctx = await browser.newContext();
  const mnoise = [];
  const bootAt = async (path) => {
    const p = await mctx.newPage();
    wireNoise(p, mnoise);
    await p.goto(`http://127.0.0.1:${multiPort}${path}index.html`, { waitUntil: 'load' });
    await p.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
    await p.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
    return p;
  };
  const pa = await bootAt('/a/');
  const pb = await bootAt('/b/');
  const mkeys = (await pa.evaluate(() => caches.keys())).sort();
  const want = [cacheName('/a/', VA), cacheName('/b/', VB)].sort();
  check('two environments: one cache each, named for its own scope — neither evicted the other',
    mkeys.length === 2 && mkeys.join() === want.join(), mkeys.join(' '));

  await mctx.setOffline(true);
  await pa.reload({ waitUntil: 'load' });
  await pa.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  const va = await pa.evaluate(() => document.querySelector('meta[name="app-version"]')?.content);
  await pb.reload({ waitUntil: 'load' });
  await pb.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  const vb = await pb.evaluate(() => document.querySelector('meta[name="app-version"]')?.content);
  // Named for what it holds, not for what it would be nice to hold: see the
  // section comment above — this one passed against the broken worker too.
  check('two environments: OFFLINE, both boot, each its own build',
    va === VA && vb === VB, `${va} / ${vb}`);
  await mctx.setOffline(false);

  bad = mnoise.filter((n) => !IGNORE.test(n));
  check('two environments: console silent (rule 6)', bad.length === 0, bad.slice(0, 3).join(' | '));
  await mctx.close();
} finally {
  await browser.close();
  for (const s of servers) s.kill();
  rmSync(work, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
