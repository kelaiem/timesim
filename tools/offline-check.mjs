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
// What it asserts (17): worker controls on first load · one cache, named for
// the version · version.json and /__state NOT cached · precache complete ·
// OFFLINE: index boots, deep link boots, explain.html renders · deploy →
// toast → Reload lands on the NEW version and drops the old cache · the
// source tree registers NO worker · a hand-registered stub dismantles itself
// having cached nothing · console silent (rule 6) in both trees.
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

// Two stamped trees from the working tree — exactly the release payload's
// app half (the payload excludes tools/, but stamping runs FROM tools
// against the tree, same as release.yml).
const work = mkdtempSync(join(tmpdir(), 'timesim-offline-'));
const build = (name, version) => {
  const dir = join(work, name);
  for (const f of ['index.html', 'explain.html', 'sw.js', 'manifest.webmanifest', 'dev_server.py', 'src', 'vendor'])
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

const relPort = await freePort(), devPort = await freePort();
const servers = [
  spawn('python3', ['-m', 'http.server', String(relPort), '--bind', '127.0.0.1', '--directory', site], { stdio: 'ignore' }),
  spawn('python3', ['-m', 'http.server', String(devPort), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' }),
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

  const keys = await page.evaluate(() => caches.keys());
  check('release: one cache, named for the version', keys.length === 1 && keys[0] === `timesim-${VA}`, keys.join());
  const vjson = await page.evaluate(async (k) => !!(await (await caches.open(k)).match('version.json')), `timesim-${VA}`);
  check('release: version.json NOT in the cache', !vjson);
  const stateCached = await page.evaluate(async (k) => !!(await (await caches.open(k)).match('/__state')), `timesim-${VA}`);
  check('release: /__state NOT in the cache', !stateCached);
  const counts = await page.evaluate(async (k) => (await (await caches.open(k)).keys()).length, `timesim-${VA}`);
  check('release: precache complete', counts === 18, `${counts}/18`);

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
  await page.waitForFunction(async (k) => (await caches.keys()).join() === k, `timesim-${VB}`, { timeout: 30000 });
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
} finally {
  await browser.close();
  for (const s of servers) s.kill();
  rmSync(work, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
