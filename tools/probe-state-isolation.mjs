// Is a battery boot VIRGIN when other pages are alive beside it? The control
// for virginBoot's per-context /__state (battery-checks.mjs isolateState),
// which is what lets ci-battery.mjs boot its shards at once instead of in turn.
//
// Until isolateState, every page of a run shared dev_server.py's one state
// file: a boot DELETEd it, then its startup GET read whatever was there some
// seconds later, and any live page could write it in between — main.js
// autosaves every 5 sim-seconds, outside the sweep hold, and step() advances
// sim time. This probe makes that worst case continuous: a writer PUTs a DIRTY
// state (tauIntegrated far from 0) to the shared server every 20 ms while
// three boots run concurrently, and reads each page's τ after boot. τ runs on
// from wherever boot left it (the page is live), so a page READ the dirty state
// iff its τ is at least DIRTY_TAU; a virgin page's τ is the seconds it has run.
//
//   LEGACY  the old virginBoot (DELETE, then a context that talks to the shared
//           server) — MUST read the dirty τ on at least one page, or the probe
//           failed to stage the race and its other half proves nothing.
//   ISOLATED the current virginBoot — NO page may read the dirty τ,
//           and a PUT from an isolated page must NOT reach the shared file
//           (the other direction of the same leak).
//
// Exits non-zero on any miss.   node tools/probe-state-isolation.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { virginBoot } from './battery-checks.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT || '8471';
const base = `http://127.0.0.1:${port}`;
const BOOT = 180000;
const N = 3;
const DIRTY_TAU = 98765.4321;
const dirty = JSON.stringify({ tauIntegrated: DIRTY_TAU, barrelWindTurns: 1.75 });

const stateDir = mkdtempSync(join(tmpdir(), 'timesim-iso-'));
const srv = spawn('python3', [join(ROOT, 'dev_server.py'), port], { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
for (let i = 0; ; i++) {
  try { if ((await fetch(`${base}/index.html`)).ok) break; } catch {}
  if (i > 100) throw new Error('dev server never came up');
  await new Promise((r) => setTimeout(r, 150));
}
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });

// The old boot, verbatim in what it did with state.
async function legacyBoot() {
  await fetch(`${base}/__state`, { method: 'DELETE' });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: BOOT });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: BOOT });
  return { context, page };
}

async function round(label, boot) {
  let writing = true;
  let puts = 0;
  const writer = (async () => {
    while (writing) {
      await fetch(`${base}/__state`, { method: 'PUT', body: dirty }).catch(() => {});
      puts++;
      await new Promise((r) => setTimeout(r, 20));
    }
  })();
  const pages = await Promise.all(Array.from({ length: N }, () => boot()));
  writing = false;
  await writer;
  const taus = [];
  for (const { page } of pages) taus.push(await page.evaluate(() => window.__clock.tau));
  console.log(`${label}: ${N} concurrent boots under ${puts} dirty PUTs — τ after boot [${taus.map((t) => t.toFixed(4)).join(', ')}]`);
  return { pages, taus };
}

let bad = 0;
try {
  const L = await round('LEGACY  ', legacyBoot);
  const leaked = L.taus.filter((t) => t >= DIRTY_TAU).length;
  if (leaked === 0) { bad++; console.log('  FAIL control: the legacy boot read no dirty state — the race was not staged'); }
  else console.log(`  control PASS: ${leaked}/${N} legacy boot(s) were NOT virgin`);
  for (const { context } of L.pages) await context.close();

  const I = await round('ISOLATED', () => virginBoot(browser, base, BOOT));
  const dirtyIso = I.taus.filter((t) => t >= DIRTY_TAU).length;
  if (dirtyIso) { bad++; console.log(`  FAIL: ${dirtyIso}/${N} isolated boot(s) read state`); }
  else console.log(`  PASS: no isolated boot read the dirty state (τ is only the seconds each page has run)`);

  // The other direction: an isolated page's save stays in its context.
  await fetch(`${base}/__state`, { method: 'DELETE' });
  const p0 = I.pages[0].page;
  const st = await p0.evaluate(async () => {
    const put = await fetch('/__state', { method: 'PUT', body: '{"tauIntegrated":7}' });
    const get = await fetch('/__state', { cache: 'no-store' });
    return { put: put.status, get: get.status, body: get.ok ? await get.text() : null };
  });
  const shared = await fetch(`${base}/__state`);
  const ok = st.put === 204 && st.get === 200 && st.body === '{"tauIntegrated":7}' && shared.status === 404;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}: page PUT ${st.put}, its own GET ${st.get} ${st.body}, the shared server ${shared.status}`);
  if (!ok) bad++;
  const p1 = I.pages[1].page;
  const other = await p1.evaluate(async () => (await fetch('/__state', { cache: 'no-store' })).status);
  console.log(`  ${other === 404 ? 'PASS' : 'FAIL'}: a sibling context's GET reads ${other}`);
  if (other !== 404) bad++;
  for (const { context } of I.pages) await context.close();
} finally {
  await browser.close();
  srv.kill();
  rmSync(stateDir, { recursive: true, force: true });
}
console.log(bad ? `FAIL (${bad})` : 'PASS');
process.exit(bad ? 1 : 0);
