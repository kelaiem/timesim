#!/usr/bin/env node
// §52 — the inspector battery as a CI gate.
//
// Standing rule 4 ("the battery is clean before anything lands") was enforced
// entirely by discipline; this harness is that rule as an exit code. It boots
// the sim in headless Chromium against the repo's own dev server and runs the
// battery exactly as CLAUDE.md prescribes for automated panes — one check at a
// time via start()/status(), never startAll, yieldEvery 64 on the long sweeps
// — then evaluates every gate the rule names, plus two the rule implies:
//
//   boot         __clock.bootWarns empty (standing rule 6 — boot is silent)
//   support      0 failures
//   graph        every violation list empty (declared `todo` edges allowed)
//   penetration  every budget row OK
//   stockFloor   0 degenerate AND 0 unwaived (waived rows reported as debt)
//   inspection   includeExcluded: true, 0 FORBIDDEN pairs
//   clearances   0 violations
//   sweptOverlap 0 CONFIRMED (tight / refuted rows are reports, not failures)
//   fingerprint  the same geometry hash from two VIRGIN boots (fresh browser
//                context, state file deleted between them) — §52's determinism
//                anchor: if the identity build does not hash the same twice on
//                this hardware, nothing above can be trusted.
//
// Why the harness takes the sweep hold for the whole run: only
// buildSweptRegistry/checkLowCorridor hold it themselves, so during the other
// sweeps the rAF loop keeps rendering — on CI's software GL (SwiftShader)
// those paints are pure overhead stolen from the sweep. The checks drive
// poses through setPose and never need a paint, so the geometry-frozen page
// is exactly what they want. beginSweepHold is a counter, so the two checks
// that take it anyway nest cleanly.
//
// Why yieldEvery 64: measured, not guessed — see CLAUDE.md's yield-throttling
// trap. The default 16 is tuned for a human-visible tab; 384 wedged a tab.
// Headless Chromium is launched with background-timer throttling disabled, so
// the setTimeout(0) naps cost microseconds here, but 64 keeps each blocking
// chunk short enough that the status() poll stays live either way.
//
// Usage:  node tools/ci-battery.mjs            (from anywhere; paths are
//         resolved from this file). Needs python3 on PATH for dev_server.py
//         and a Playwright Chromium (npx playwright install chromium).
// Exits 0 only when every gate passes; failing gates dump their payloads.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const YIELD_EVERY = 64;
const CHECK_TIMEOUT_MS = 20 * 60 * 1000; // per check — clearances is the long pole
const BOOT_TIMEOUT_MS = 120 * 1000;

// The battery, in the order the checks are run: cheap and synchronous first so
// a broken graph fails in seconds, the expensive sweeps last. Each entry names
// the gate standing rule 4 states for it and how to judge the check's payload.
const BATTERY = [
  { name: 'support', opts: {},
    gate: '0 failures',
    fails: (r) => r.failures },
  { name: 'graph', opts: {},
    gate: 'every violation list empty (todo allowed)',
    fails: (r) => Object.entries(r)
      .filter(([k]) => k !== 'todo')
      .flatMap(([k, v]) => (Array.isArray(v) && v.length ? [{ [k]: v }] : [])) },
  { name: 'penetration', opts: {},
    gate: 'every budget row OK',
    fails: (r) => r.filter((row) => row.status !== 'OK') },
  { name: 'stockFloor', opts: {},
    gate: '0 degenerate and 0 unwaived',
    fails: (r) => [...r.degenerate, ...r.violations],
    note: (r) => `${r.rowsChecked} rows, ${r.waivedCount} waived (accepted debt)` },
  { name: 'inspection', opts: { includeExcluded: true, yieldEvery: YIELD_EVERY },
    gate: '0 FORBIDDEN pairs',
    fails: (r) => r.report.filter((row) => row.class === 'FORBIDDEN'),
    note: (r) => `${r.units.length} units, ${r.report.length} contacting pairs` },
  { name: 'clearances', opts: { yieldEvery: YIELD_EVERY },
    gate: '0 violations',
    fails: (r) => r.violations,
    note: (r) => `${r.results.length} budgets` },
  { name: 'sweptOverlap', opts: { yieldEvery: YIELD_EVERY },
    gate: '0 CONFIRMED',
    fails: (r) => r.sound.staticVsSwept.violations,
    note: (r) => {
      const s = r.sound.staticVsSwept;
      return `${s.pairsTested} pairs, tight ${s.tight.length}, refuted ${s.refutedByRefinement.length}`;
    } },
];

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, deadlineMs) {
  const t0 = Date.now();
  for (;;) {
    try { await fetch(url); return; } catch {
      if (Date.now() - t0 > deadlineMs) throw new Error(`dev server never answered at ${url}`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

// Boot a VIRGIN page: fresh browser context (no localStorage) after deleting
// the dev server's state file, so nothing of a previous session leaks in —
// the determinism gate is only meaningful between two boots that start equal.
async function virginBoot(browser, base) {
  await fetch(`${base}/__state`, { method: 'DELETE' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // A virgin boot 404s /__state BY DESIGN (state.js falls back to defaults);
    // that resource error is the one console error a clean boot produces.
    if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/__state')) errors.push(m.text());
  });
  await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: BOOT_TIMEOUT_MS });
  await page.waitForFunction(() => !!window.__clock, null, { timeout: BOOT_TIMEOUT_MS });
  await page.evaluate(async () => { window.__I = await import('./src/inspect.js'); });
  if (errors.length) throw new Error(`page errors during boot:\n${errors.join('\n')}`);
  return { context, page };
}

async function runCheck(page, name, opts) {
  const t0 = Date.now();
  await page.evaluate(([n, o]) => window.__I.start(window.__clock, n, o), [name, opts]);
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    const st = await page.evaluate((n) => {
      const s = window.__I.status(n);
      return s.state === 'running' ? { state: 'running' } : s;
    }, name);
    if (st.state === 'done') return { result: st.result, ms: Date.now() - t0 };
    if (st.state === 'error') throw new Error(`check ${name} threw:\n${st.error}`);
    if (Date.now() - t0 > CHECK_TIMEOUT_MS) throw new Error(`check ${name} exceeded ${secs(CHECK_TIMEOUT_MS)}`);
  }
}

const gates = [];
const gate = (name, failures, note) => {
  const pass = failures.length === 0;
  gates.push({ name, pass, failures, note });
  console.log(`  gate ${pass ? 'PASS' : 'FAIL'}  ${name}${note ? `  (${note})` : ''}`);
  if (!pass) console.log(JSON.stringify(failures, null, 2));
};

let server, browser;
const stateDir = mkdtempSync(join(tmpdir(), 'timesim-ci-'));
try {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  // TMPDIR points at a private fresh dir so /__state starts absent and a
  // developer's real saved state is never read or clobbered by a CI run.
  server = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)],
    { cwd: ROOT, env: { ...process.env, TMPDIR: stateDir }, stdio: 'ignore' });
  await waitForServer(`${base}/index.html`, 15000);

  browser = await chromium.launch({ args: [
    // An automated pane throttles setTimeout(0) to ~1s, turning the sweeps'
    // cooperative yields into hours of idle (the CLAUDE.md trap). These keep
    // the headless page foreground-scheduled so a yield costs what it says.
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ] });

  const t0 = Date.now();
  console.log('boot A (virgin)…');
  const A = await virginBoot(browser, base);
  console.log(`  __clock up at ${secs(Date.now() - t0)}`);

  const bootWarns = await A.page.evaluate(() => window.__clock.bootWarns.slice());
  gate('boot silent (rule 6)', bootWarns);

  const fpA = await A.page.evaluate(() => {
    window.__clock.beginSweepHold(); // frozen for the whole battery — see header
    return window.__I.fingerprint(window.__clock);
  });
  console.log(`  fingerprint A: ${fpA.hash} (${fpA.units} units, ${fpA.poseCount} poses)`);

  for (const { name, opts, gate: gateDesc, fails, note } of BATTERY) {
    process.stdout.write(`${name}… `);
    const { result, ms } = await runCheck(A.page, name, opts);
    console.log(secs(ms));
    gate(`${name}: ${gateDesc}`, fails(result), note?.(result));
  }
  await A.context.close();

  // Determinism anchor: a SECOND virgin boot must reproduce the hash exactly.
  console.log('boot B (virgin, fresh context)…');
  const B = await virginBoot(browser, base);
  const fpB = await B.page.evaluate(() => window.__I.fingerprint(window.__clock));
  console.log(`  fingerprint B: ${fpB.hash}`);
  gate('fingerprint deterministic across virgin boots',
    fpA.hash === fpB.hash && fpA.units === fpB.units ? [] : [{ bootA: fpA, bootB: fpB }],
    `hash ${fpA.hash}`);
  await B.context.close();

  const failed = gates.filter((g) => !g.pass);
  console.log(`\n${gates.length - failed.length}/${gates.length} gates pass · total ${secs(Date.now() - t0)}`);
  if (failed.length) {
    console.error(`FAILED: ${failed.map((g) => g.name).join(' · ')}`);
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  server?.kill();
  rmSync(stateDir, { recursive: true, force: true });
}
