// §240 prerequisite — DOES A TRIAL BOOT INHERIT THE VIEWER'S TUNED AESTHETICS?
// Acceptance. The claim to hold from now on: a `?trial=1` boot — §33's
// throwaway verdict boot, loaded in a hidden iframe to read a candidate spec's
// build asserts — is VIRGIN of aesthetics the way `state.js` already keeps it
// virgin of the session ("a virgin boot is the battery's own standard for a
// verdict"), and a trial that is killed mid-build cannot cost the viewer their
// tuning.
//
// The reading this measures (filed in roadmap §240 as a prerequisite of the
// shareable link): `aesthetics.js` merges `aestheticsOverrides` at module
// evaluation with no trial guard, reads `?dialcol=` / `?metal=` the same way,
// and `reconfTrialBoot()` builds the iframe's URL from `location.search`. If
// it holds, every §33 verdict is measured on a TUNED build, a link payload
// rides into the trial, and — the sharper half — the §23 crash-recovery
// marker is ARMED by the trial's merge and never confirmed when the trial is
// superseded (`reconfKillTrial` removes the iframe before `confirmAestheticsBoot`
// runs), so the viewer's next real boot drops their overrides and warns.
//
// Rows, each in a fresh browser context (overrides live in localStorage, so a
// shared context would test whatever ran before):
//   A  CONTROL, must-hit — the plain boot applies a seeded override. Proves the
//      seeding and the read are real; every "virgin" row below would also pass
//      if this probe could not seed or could not read.
//   B  CONTROL, must-miss — the guard that EXISTS: `state.js` returns virgin
//      defaults under ?trial=1. A seeded `crownRotation` reads back through
//      `__clock` on the plain boot and reads 0 on the trial. The fix, when it
//      lands, copies this guard.
//   1  A seeded override is NOT applied under ?trial=1.
//   2  A link's finish param (`?dialcol=`, the shipped one) is NOT applied
//      under ?trial=1 — and the passthrough is read off `reconfTrialBoot`'s
//      own source, so the row tests the URL the parent actually builds.
//   3  A trial killed mid-build leaves the viewer's overrides in place and the
//      next plain boot silent — the §23 marker must not be armed by a trial.
//      The marker is watched from a SECOND page of the same origin: the
//      building page's main thread does not answer `evaluate` on this
//      container even between §239's breaths (measured: every poll timed out
//      until __clock), so a poll from inside it resolves only after the build
//      is done and reads a marker already confirmed — a row that would pass
//      on any tree. The sibling page reads the same localStorage from its own
//      thread, and the kill is `page.close()`, the iframe removal
//      `reconfKillTrial` performs.
//
// Values are read through the module singleton (`import('./src/aesthetics.js')`
// returns the instance main.js booted from), not through the panel or the
// scene: the panel is hidden since §146 and the scene's lights would be a
// second transcription of what the merge did.
//
// NOT probe-dial-colour-link.mjs (whose colour wins on a PLAIN boot — this asks
// whether a TRIAL boot should see any of it). NOT probe-238-boot-screen.mjs /
// probe-239-boot-yield.mjs (they boot with overrides only to time the build).
//
// Run: cd tools && node probe-240-trial-boot.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8464);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const BASE = `http://127.0.0.1:${PORT}/index.html`;

const TUNED_KEY = 1.2;          // lighting.keyLight.intensity — shipped 2.4, live, geometry-free, no _bounds to clamp it
const TUNED_CROWN = 1.234;      // crownRotation — a session-tier value state.js restores and __clock exposes; the guard that exists, as the control
const LINK_COL = '#1b3a5c';     // a navy nobody reaches by accident (probe-dial-colour-link's)
const OVERRIDES = { lighting: { keyLight: { intensity: TUNED_KEY } } };

const fails = [];
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(64)} ${JSON.stringify(got)}${ok ? '' : `  (wanted ${JSON.stringify(want)})`}`);
  if (!ok) fails.push(name);
};

// Seed BEFORE the app's modules evaluate: an init script runs on every
// navigation in the context, ahead of index.html, so the seed is what
// aesthetics.js finds at import — the same store a tuned viewer carries.
async function context({ overrides = null, state = null } = {}) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(({ o, s }) => {
    try {
      if (o) localStorage.setItem('aestheticsOverrides', JSON.stringify(o));
      if (s) localStorage.setItem('timesim-state', JSON.stringify(s));
    } catch { }
  }, { o: overrides, s: state });
  return ctx;
}
async function boot(ctx, qs) {
  const page = await ctx.newPage();
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
  page.on('pageerror', (e) => { fails.push('pageerror'); console.log('  PAGEERROR', String(e).slice(0, 200)); });
  await page.goto(BASE + qs, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });
  return { page, warns };
}
const effective = (page) => page.evaluate(async () => {
  const A = await import('./src/aesthetics.js');
  return { keyLight: A.aesthetics.lighting.keyLight.intensity, face: A.aesthetics.dial.face.color,
    defaultKeyLight: A.AESTHETICS_DEFAULTS.lighting.keyLight.intensity, defaultFace: A.AESTHETICS_DEFAULTS.dial.face.color };
});
const crownRotation = (page) => page.evaluate(() => window.__clock.crownRotation);
const stored = (page) => page.evaluate(() => ({
  overrides: localStorage.getItem('aestheticsOverrides'),
  pending: localStorage.getItem('aestheticsBootPending'),
}));

console.log(`§240 — is a trial boot virgin of aesthetics? (override keyLight ${TUNED_KEY} vs shipped, link colour ${LINK_COL})\n`);

{ // A — must-hit
  const ctx = await context({ overrides: OVERRIDES });
  const { page } = await boot(ctx, '');
  const e = await effective(page);
  check('A. CONTROL: plain boot applies the seeded override', e.keyLight, TUNED_KEY);
  check('A. CONTROL: the shipped default is not the seed (the row can fail)', e.defaultKeyLight !== TUNED_KEY, true);
  await ctx.close();
}
{ // B — must-miss, the guard that exists
  const ctx = await context({ state: { crownRotation: TUNED_CROWN } });
  const plain = await boot(ctx, '');
  check('B. CONTROL: plain boot restores the seeded session (crownRotation)', await crownRotation(plain.page), TUNED_CROWN);
  await plain.page.close();
  const trial = await boot(ctx, '?trial=1');
  check('B. CONTROL: ?trial=1 boots the session tier virgin (state.js guard)', await crownRotation(trial.page), 0);
  await ctx.close();
}
{ // 1 — the finding
  const ctx = await context({ overrides: OVERRIDES });
  const { page } = await boot(ctx, '?trial=1');
  const e = await effective(page);
  check('1. ?trial=1 does NOT apply the viewer\'s tuned override', e.keyLight, e.defaultKeyLight);
  await ctx.close();
}
{ // 2 — the link's finish param rides into the trial
  // the passthrough, read off the parent's own source: the iframe URL is
  // location.search with the candidate key set and the mode keys deleted —
  // nothing strips a finish param. If this stops matching, the row below is
  // testing a URL the parent no longer builds, and must be re-read.
  const src = await (await fetch(`http://127.0.0.1:${PORT}/src/main.js`)).text();
  const fn = src.slice(src.indexOf('function reconfTrialBoot()'), src.indexOf('function reconfTrialBoot()') + 1200);
  check('2. reconfTrialBoot builds the trial URL from location.search', /new URLSearchParams\(location\.search\)/.test(fn) && /p\.set\('trial', '1'\)/.test(fn), true);
  const stripsFinish = /p\.delete\('dialcol'\)|DIAL_COL_PARAM/.test(fn);
  console.log(`        (parent strips the dial-colour param before the trial: ${stripsFinish})`);
  const ctx = await context();
  const { page } = await boot(ctx, `?trial=1&dialcol=${LINK_COL.slice(1)}`);
  const e = await effective(page);
  check('2. ?trial=1 does NOT apply a link\'s finish param (dialcol)', e.face, e.defaultFace);
  await ctx.close();
}
{ // 3 — a superseded trial must not cost the viewer their tuning
  const ctx = await context({ overrides: OVERRIDES });
  // the watcher first: a sibling page of the same origin, whose own main
  // thread answers while the trial's is building
  const watcher = await ctx.newPage();
  await watcher.goto(`http://127.0.0.1:${PORT}/vendor/LICENSE-three.txt`, { waitUntil: 'load', timeout: 60000 });
  const page = await ctx.newPage();
  await page.goto(BASE + '?trial=1', { waitUntil: 'commit', timeout: 120000 });
  // wait for the trial's merge to have run — the marker armed — or for the
  // trial to have finished, which is the one case the kill below cannot test
  const t0 = Date.now();
  let seen = null;
  while (Date.now() - t0 < 60000) {
    seen = await watcher.evaluate(() => ({ pending: localStorage.getItem('aestheticsBootPending'), overrides: localStorage.getItem('aestheticsOverrides') }));
    if (seen.pending === '1') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const armedAt = Date.now() - t0;
  console.log(`        (trial armed the §23 marker after ${armedAt} ms: ${seen.pending === '1'})`);
  check('3. a trial in flight arms the §23 marker? (must be false)', seen.pending === '1', false);
  // kill it the way reconfKillTrial does — the frame goes away before confirm
  await page.close();
  await watcher.close();
  const { page: next, warns } = await boot(ctx, '');
  const after = await stored(next);
  check('3. after a killed trial the viewer\'s overrides survive', after.overrides !== null, true);
  check('3. after a killed trial the next plain boot does not warn §23', warns.filter((w) => w.includes('§23')).length, 0);
  const e = await effective(next);
  check('3. after a killed trial the next plain boot still applies the tuning', e.keyLight, TUNED_KEY);
  await ctx.close();
}

await browser.close();
srv.kill();
console.log(`\n${fails.length ? `FAIL — ${fails.length} row(s): ${fails.join('; ')}` : 'PASS — a trial boot is virgin of aesthetics and cannot cost the viewer their tuning'}`);
process.exit(fails.length ? 1 : 0);
