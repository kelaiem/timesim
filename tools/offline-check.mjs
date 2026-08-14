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
// What it asserts (28): worker controls on first load · one cache, named for
// the scope AND the version · version.json and /__state NOT cached · precache
// complete · OFFLINE: index boots, deep link boots, explain.html renders,
// primer.html renders · the localized primer boots from cache in EACH of the
// five non-English locales and the ?lang=zh-Hant deep link stays Traditional
// (§116) · primer.html renders (§95 — this boot is also the assert that catches a
// mis-listed primer seed: the stamper tolerates an absent primer because
// archived pre-§95 trees legitimately lack one, so only HERE, where the tree
// is built from the source checkout, can absence-by-typo be told apart) ·
// deploy → toast → clicking Reload shows progress at once (buttons disabled,
// message staged — the dance is allowed to be slow, not to be silent) →
// Reload lands on the NEW version and drops the old cache ·
// TWO ENVIRONMENTS UNDER ONE ORIGIN keep one cache each and both still boot
// offline (§88) · the source tree registers NO worker · a hand-registered stub
// dismantles itself having cached nothing · console silent (rule 6) in all
// three trees.
//
// HOW IT FAILS is part of what it asserts. A check that cannot report its own
// failure is not a gate, and this one spent three CI runs proving it: silence,
// then the 20-minute job cap, which GitHub reports as `cancelled` — a word
// that reads like somebody's force-push, not like a red test. So: every phase
// is named (`mark`) and budgeted (PHASE_BUDGET_MS), a failed row prints the
// page state that explains it instead of throwing the run away, cleanup is
// raced rather than trusted, and the process kills its own children on the way
// out. Exit 0 all pass · 1 a check failed · 2 the run was ended by a budget.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { cpSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, utimesSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
  for (const f of ['index.html', 'explain.html', 'primer.html', 'test-geometry.html', 'sw.js', 'manifest.webmanifest', 'favicon.svg', 'favicon.png', 'apple-touch-icon.png', 'src', 'vendor'])
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
// A row whose PREMISE failed is not a pass and not an independent failure —
// say so rather than letting one fault print twice or, worse, letting the
// cascade abort the sections that would still have been measurable.
const skip = (name, why) => { results.push({ name, ok: false, skipped: true }); console.log(`SKIP  ${name}  (${why})`); };

// The exit path, in one place, because there are now three ways to reach it:
// the end of the run, the watchdog, and a fault. Children are killed
// explicitly — CI's cap had to terminate headless_shell and three python3
// servers as orphans, and a process that leaks its children on the way out
// is a second way to look hung.
let procs = [];
// Playwright's Browser exposes NO process handle — `process()` lives on
// BrowserServer and ElectronApplication only, and `browser.process?.()`
// silently does nothing, which is a comment that lies rather than a fallback
// that works. The PID comes from the OS instead: on Linux, this process's
// direct children are chromium and the three python3 servers. Best-effort and
// guarded — where /proc is absent the raced close is still what bounds the
// run; this only stops a wedged browser being left behind, which is the
// difference between a rerun and a puzzled `ps`.
const childPids = () => {
  try {
    return readdirSync('/proc/self/task')
      .flatMap((t) => readFileSync(`/proc/self/task/${t}/children`, 'utf8').trim().split(/\s+/))
      .filter(Boolean).map(Number);
  } catch { return []; }
};
const TOTAL_ROWS = 28;   // the header's list; a short run must say so rather than report a tidy N/N
const summarize = (code) => {
  const failed = results.filter((r) => !r.ok), skipped = results.filter((r) => r.skipped);
  if (code === 2) console.log(`INCOMPLETE: ${results.length} of ${TOTAL_ROWS} rows were measured before the run was ended`);
  console.log(`\n${results.length - failed.length}/${results.length} checks pass${skipped.length ? ` (${skipped.length} skipped)` : ''}`);
  for (const s of procs) { try { s.kill('SIGKILL'); } catch { /* already gone */ } }
  for (const pid of childPids()) { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
  process.exit(code ?? (failed.length ? 1 : 0));
};

// The state a failed update row owes the next reader, and the reason it is
// bounded: the page that fails this check is exactly the page that may not
// answer, so an unbounded evaluate() here would re-create the hang this file
// exists to remove.
const dumpState = async (page, err) => {
  const head = String(err).split('\n')[0];
  const state = await Promise.race([
    page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      return {
        url: location.href,
        meta: document.querySelector('meta[name="app-version"]')?.content,
        controller: navigator.serviceWorker.controller?.scriptURL,
        clockUp: !!window.__clock,
        toastShown: document.getElementById('clock-update')?.classList.contains('show'),
        regs: regs.map((r) => ({ scope: r.scope, installing: r.installing?.state, waiting: r.waiting?.state, active: r.active?.state })),
        caches: await caches.keys(),
      };
    }).catch((e) => ({ evaluateFailed: String(e).split('\n')[0] })),
    new Promise((r) => setTimeout(() => r({ evaluateTimedOut: '5s — the page is not answering' }), 5000)),
  ]);
  return `${head} · ${JSON.stringify(state)}`;
};

// A HEARTBEAT, because this job's worst failure mode prints nothing at all.
// Twice on CI (two different runners, §107's PR) the run went silent right
// after the update toast and was killed by the 20-minute job cap, having
// emitted 12 of its 22 lines — no assertion failed, no error was thrown, and
// there was nothing in the log to say where it stopped. Every await in that
// region is bounded (4 s announcement, 2 s fallback, Playwright's 30 s/60 s),
// so a genuine fault there should have thrown inside a minute; silence for
// nineteen means either one unbounded wait or a blocked event loop, and the
// log could not tell those apart.
//
// This does: `mark()` names the phase, and a 10 s timer prints how long that
// phase has been running. If the ticks keep coming, the loop is alive and one
// await is stuck — and the tick names it. If the ticks stop, the event loop
// itself is blocked, which is a different bug entirely. Either way the next
// run says which, instead of costing 20 minutes to say nothing.
//
// IT HAPPENED A THIRD TIME, and the tick above named the wrong await — so
// here is the half the paragraph was missing. The run wedged at "waiting for
// the new version meta after reload" for 1168 s on `main` itself (dispatch
// 31665517744), and that wait is genuinely bounded: sabotage the symlink so
// the new version can never appear and it throws TimeoutError at 30 s and
// the process exits at 50 s. What was stuck is the phase `mark()` never
// named — CLEANUP. The wait threw at 30 s, `finally` called
// `browser.close()` on a renderer that no longer answers, the close never
// returned, and because a `finally` that never completes never lets its
// exception out, the error was never printed and the heartbeat went on
// reciting the LAST phase for the rest of the cap. CI corroborates it: the
// killed job terminates headless_shell as an ORPHAN, so the browser was
// still alive. Hence, below: every phase is marked including cleanup, the
// cleanup is bounded, and a failed check reports rather than throws.
//
// AND THE TICK NOW ACTS ON WHAT IT SEES, because the second half of the
// measurement was the surprise: a Playwright bound is not always honoured.
// The sabotage case (page healthy, version simply never arrives) throws at
// its 30 s as documented — but with the renderer wedged, the same
// `waitForFunction(..., { timeout: 30000 })` was measured sitting for 455 s,
// still not rejected. Cancelling that wait needs an answer from the very
// renderer that has stopped answering. So the bound that can actually be
// enforced is the one OUT HERE, in a process that is still running: if any
// phase outlives PHASE_BUDGET_MS, the tick stops narrating and ends the run
// with the phase named. 180 s is 3x the longest await this file declares
// (the 60 s __clock waits) — every phase below is marked precisely so no
// legitimate one comes near it.
const PHASE_BUDGET_MS = 180_000;
let phase = 'startup', phaseAt = Date.now();
const mark = (name) => { phase = name; phaseAt = Date.now(); };
const beat = setInterval(() => {
  const ms = Date.now() - phaseAt, s = (ms / 1000).toFixed(0);
  if (ms > PHASE_BUDGET_MS) {
    console.log(`\nSTUCK: "${phase}" has run ${s}s, past the ${PHASE_BUDGET_MS / 1000}s phase budget — its own await did not honour its timeout`);
    summarize(2);
  }
  if (s >= 10) console.log(`  … still in "${phase}" after ${s}s`);
}, 10000);
beat.unref?.();
// The backstop for anything the bounds above still miss. 12 min is ~5x the
// measured 2 min 29 s job and ~half offline.yml's 20-minute cap: the point is
// to die INSIDE the cap, because a job-timeout kill is reported as
// `cancelled` with no output, which is the failure mode this whole file is
// arguing with. Exiting on our own terms prints the phase and the results so
// far. Do not raise it to "be safe" — that hands the run back to the cap.
const RUN_BUDGET_MS = 12 * 60 * 1000;
const watchdog = setTimeout(() => {
  console.log(`\nWATCHDOG: ${(RUN_BUDGET_MS / 60000).toFixed(0)} min budget spent, stuck in "${phase}" for ${((Date.now() - phaseAt) / 1000).toFixed(0)}s`);
  summarize(2);
}, RUN_BUDGET_MS);
watchdog.unref?.();
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
procs = servers;
try {
  mark('release: first load, worker install');
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
  // Was 27 at §95 tier two: 20 + favicon.png (Safari SVG fallback) +
  // apple-touch-icon.png (iOS home screen) + primer.html (the novice
  // explainer, an unstamped seed like the other documents) + the four modules
  // its localization pulls in (the shared page-i18n engine, the primer's own
  // i18n module and its two locale tables — dynamic imports, so they reach
  // this manifest through the stamper's module walk, not through the
  // document's).
  //
  // 33 since §116: six more locale tables, three locales across two pages,
  // arriving by that same walk. The count is worth asserting exactly because
  // it is the cheap half of the guarantee — a table MISSING from the manifest
  // shows up here, while a table listed but absent from the tree does not
  // (addAll is all-or-nothing, so the worker simply never activates and this
  // line is never reached). §116 hit that second failure and it presents as a
  // hang, not a number: the per-locale offline boots below are what actually
  // prove each table arrived.
  check('release: precache complete', counts === 33, `${counts}/33`);

  // ---- offline: the whole point ----
  mark('offline: booting the documents');
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  check('OFFLINE: index.html boots, movement up', true);
  const ver = await page.evaluate(() => document.querySelector('meta[name="app-version"]')?.content);
  check('OFFLINE: served build is the stamped release', ver === VA, String(ver));
  await page.goto(`http://127.0.0.1:${relPort}/index.html?lang=de`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  check('OFFLINE: deep link (?lang=de) boots', true);
  // §116 — zh-Hant is the one code carrying a SCRIPT subtag, so it is the one
  // that travels through the URL, the resolution ladder and documentElement.lang
  // as something other than a two-letter word. Asserting the resolved lang and
  // not merely that the page booted is the point: falling back to Simplified
  // would boot perfectly.
  await page.goto(`http://127.0.0.1:${relPort}/index.html?lang=zh-Hant`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  const hantLang = await page.evaluate(() => document.documentElement.lang);
  check('OFFLINE: deep link (?lang=zh-Hant) boots and stays Traditional', hantLang === 'zh-Hant', hantLang);
  await page.goto(`http://127.0.0.1:${relPort}/explain.html`, { waitUntil: 'load' });
  const explainOk = await page.evaluate(() => document.querySelectorAll('details.mech').length > 0);
  check('OFFLINE: explain.html loads with content', explainOk);
  await page.goto(`http://127.0.0.1:${relPort}/primer.html`, { waitUntil: 'load' });
  const primerOk = await page.evaluate(() => document.querySelectorAll('details.mech').length > 0);
  check('OFFLINE: primer.html loads with content (also the mis-listed-seed assert — see header)', primerOk);
  // §95 tier two — a LOCALIZED boot, offline. The locale tables arrive by
  // dynamic import, which is the one class of URL that reaches the precache
  // through the module walk rather than through a document's own markup; a
  // German reader offline is exactly who would find that gap, and English
  // prose under a German header is what they would see instead of a failure.
  //
  // §116 — EVERY locale, not just German. The count above cannot tell one
  // missing table from another, and a per-locale dynamic import is exactly the
  // kind of thing that gets added to a LOADERS map and forgotten in a file
  // name; this loop is what makes each one prove itself from cache.
  for (const code of ['de', 'fr', 'ja', 'zh', 'zh-Hant']) {
    await page.goto(`http://127.0.0.1:${relPort}/primer.html?lang=${code}`, { waitUntil: 'load' });
    const ok = await page.evaluate((c) =>
      document.documentElement.lang === c
      && !/^What you are looking at/.test(document.querySelector('p.intro')?.textContent || ''), code);
    check(`OFFLINE: primer.html localizes (${code} table came from the cache)`, ok);
  }
  await page.goto(`http://127.0.0.1:${relPort}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
  await ctx.setOffline(false);

  // ---- a release lands: repoint the "QA symlink", expect the ONE toast ----
  mark('deploying release B');
  unlinkSync(site); symlinkSync(relB, site);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  mark('waiting for the update toast');
  await page.waitForSelector('#clock-update.show', { timeout: 30000 });
  check('update: toast appears after deploy (focus poll)', true);
  // The dance, narrated. swReload's own comment calls the announcement
  // LOAD-SENSITIVE and its degradation benign, so when this row fails the
  // first question is always "which stage was late?" — and the answer used
  // to require reproducing it locally. These listeners cost nothing and put
  // the stages in the CI log: healthy is updatefound ~1.1 s and
  // controllerchange ~1.3 s against swReload's 4 s bound. They are page
  // console.log (not error/warning), so the rule-6 silence check below is
  // untouched, and they die with the document at reload — which is the
  // point, since every stage worth timing happens before it.
  mark('instrumenting the update dance');
  page.on('console', (m) => { if (m.text().startsWith('DANCE')) console.log(`  [sw] ${m.text()}`); });
  await page.evaluate(() => {
    const t0 = Date.now(), log = (m) => console.log(`DANCE +${Date.now() - t0}ms ${m}`);
    navigator.serviceWorker.getRegistration().then((r) => {
      log(`registration installing=${r?.installing?.state} waiting=${r?.waiting?.state} active=${r?.active?.state}`);
      r?.addEventListener('updatefound', () => {
        const i = r.installing;
        log(`updatefound installing=${i?.state}`);
        i?.addEventListener('statechange', () => log(`installing -> ${i.state}`));
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => log('controllerchange'));
    // NO `beforeunload` listener here, and the omission is load-bearing: an
    // earlier draft logged one and the very run that carried it wedged at the
    // reload for 455 s while the stock file passed the same tree minutes
    // later. A page carrying a beforeunload handler can put a dialog in front
    // of its own navigation, which is a fine way to make an instrument
    // manufacture the hang it was written to observe. The three listeners
    // above are the informative ones; the unload is already visible as the
    // navigation itself.
  });
  mark('clicking Reload on the toast');
  await page.click('#clock-update button:not(.dismiss)', { timeout: 30000 });
  // The dance's first act is now SYNCHRONOUS feedback — buttons disabled,
  // message staged — because a dance that is allowed to be slow (the
  // no-timeout rule) must not be silent: a mid-install click with a mute
  // toast was reported as a dead button. Read the toast right after the
  // click; if the reload crosses before the probe can ask, the destroyed
  // context IS the dance working, not a missed observation.
  try {
    const fb = await page.evaluate(() => ({
      disabled: !!document.querySelector('#clock-update button:not(.dismiss)')?.disabled,
      msg: document.querySelector('#clock-update span')?.textContent || '',
    }));
    check('update: clicking Reload shows progress (buttons disabled, message staged)',
      fb.disabled && fb.msg !== 'A new version is available', JSON.stringify(fb));
  } catch {
    check('update: clicking Reload shows progress (buttons disabled, message staged)', true,
      'the reload crossed before the probe read the toast');
  }
  mark('waiting for the new version meta after reload');
  let crossed = false;
  try {
    // 60 s, up from 30: CI run 31753984029 (attempt 1) watched a healthy
    // ~2.6 s promotion stall past 30 s under runner load and pass untouched
    // on re-run — the bound was the flaky assumption, not the dance. The
    // dance itself has no timeout by design; this is only how long the
    // HARNESS is willing to watch it.
    await page.waitForFunction((v) => document.querySelector('meta[name="app-version"]')?.content === v, VB, { timeout: 60000 });
    mark('waiting for __clock on the new release');
    await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
    crossed = true;
    check('update: Reload crosses the worker boundary to the NEW release', true);
  } catch (e) {
    check('update: Reload crosses the worker boundary to the NEW release', false, await dumpState(page, e));
  }
  if (crossed) {
    mark('waiting for the old cache to be dropped');
    try {
      await page.waitForFunction(async (k) => (await caches.keys()).join() === k, cacheB, { timeout: 30000 });
      check('update: old release cache dropped on activation', true);
    } catch (e) {
      check('update: old release cache dropped on activation', false, await dumpState(page, e));
    }
  } else {
    skip('update: old release cache dropped on activation', 'the reload never crossed, so there is no activation to measure');
  }
  mark('release tree done');

  let bad = noise.filter((n) => !IGNORE.test(n));
  check('release: console silent throughout (rule 6)', bad.length === 0, bad.slice(0, 3).join(' | '));
  await ctx.close();

  // ---- source tree: no worker, and a hand-registered one dismantles ----
  mark('dev tree: no worker, stub dismantles');
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
  mark('two environments under one origin');
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
  // THE PHASE THAT COST NINETEEN MINUTES. It was unmarked, so the heartbeat
  // kept reciting the previous one, and it was unbounded, so the exception on
  // its way out never got out: a `finally` that never completes never
  // rethrows. Both halves are fixed here — named, so a tick can accuse it,
  // and raced, so a renderer that stopped answering cannot hold the process.
  // 10 s because a healthy close is milliseconds; the loser is killed rather
  // than awaited, which is also what stops the orphaned headless_shell CI had
  // to reap.
  mark('cleanup: closing the browser');
  await Promise.race([
    browser.close().catch(() => { /* a wedged renderer: the kill below is the answer */ }),
    new Promise((r) => setTimeout(r, 10000)),
  ]);
  try { browser.process()?.kill('SIGKILL'); } catch { /* already exited */ }
  mark('cleanup: stopping the servers');
  for (const s of servers) s.kill();
  rmSync(work, { recursive: true, force: true });
  mark('cleanup: done');
}
summarize();
