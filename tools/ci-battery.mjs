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
//   penetration  every budget row OK or waived (waived rows reported as debt)
//   alarmHandoffs every declared hand-off of the §35 arming run within ±tol
//                of touch at both parities, or waived citing its TODO item
//   stockFloor   0 degenerate AND 0 unwaived (waived rows reported as debt)
//   intraUnit    0 unwaived mover-vs-fixture intersections inside a unit
//                (TODO 5's interim; waived rows reported as debt)
//   expectedContacts 0 unwaived floor rows and 0 unmatched contact selectors
//                (TODO 6's per-contact floors; waived rows reported as debt)
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
//         --shards N        run the battery across N browser contexts,
//                           partitioned by the measured `cost` column
//                           (default 2; 1 is the pre-§81 single-file run).
//         --report FILE     write every check's FULL payload as JSON — the
//                           "same rows, same numbers" instrument §80 and §81
//                           are both accepted against.
// Exits 0 only when every gate passes; failing gates dump their payloads.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const YIELD_EVERY = 64;
// Per check. This is a WEDGED-TAB GUARD, not a budget: no check is supposed
// to approach it, and a check that does has told us something. TODO 27 is the
// worked example — drilling the chain's 211 joints tripled that mesh
// (14,312 → 46,144 triangles) and `sweptOverlap` went 352 s → ~1400 s on this
// runner class, blowing the old 20-minute guard while REPORTING the same
// green result (0 CONFIRMED, 59,216 pairs).
//
// §80 BLAMED THE REGISTRY FOR THAT, AND MEASURED, THE REGISTRY WAS NOT IT.
// This comment used to read "the cost is the §36 registry's own"; building the
// registry ran 63.8 s of `sweptOverlap`'s 1816 s on a dev container — 3.5%.
// §80 took it to 3.5 s and the whole hull phase (registry + all 59,216 pair
// tests) to 3.6 s, which moved the check to ~1755 s. The other 96.5% is the
// CONFIRM TIER: 15 raw hull overlaps, each re-measured by an uncapped
// `measureClearance` BVH sweep over all 9 axes, and TODO 27's chain is on two
// of them. Roadmap §82 owns that; the guard stays at 45 minutes until it
// lands, because it has to clear the honest cost of the check with room to
// spare — still ~1.5x the slowest check, which is what a guard is for.
const CHECK_TIMEOUT_MS = 45 * 60 * 1000;
const BOOT_TIMEOUT_MS = 120 * 1000;

// The battery, in the order the gates are REPORTED: cheap and synchronous
// first so a broken graph reads first, the expensive sweeps last. Each entry
// names the gate standing rule 4 states for it and how to judge the check's
// payload — plus `cost`, its measured wall clock in seconds.
//
// §81 — WHY THE COST IS DATA. The harness shards the battery across K browser
// contexts and partitions the checks by `cost` (longest-processing-time
// greedy, below), so the wall is max(shard) instead of sum(checks). A
// partition written as code would have to be re-argued every time a check
// gets faster; a partition computed from a measured column is re-derived by
// editing the column. These numbers are one full run of this harness on a
// 4-vCPU dev container after §80 landed — `--report` writes the same column
// back out as `ms`, which is how they get refreshed. They are used ONLY to
// balance the shards: a stale number costs wall clock, never a wrong verdict.
const BATTERY = [
  { name: 'support', opts: {}, cost: 29,
    gate: '0 failures',
    fails: (r) => r.failures },
  { name: 'graph', opts: {}, cost: 2,
    gate: 'every violation list empty (todo allowed)',
    fails: (r) => Object.entries(r)
      .filter(([k]) => k !== 'todo')
      .flatMap(([k, v]) => (Array.isArray(v) && v.length ? [{ [k]: v }] : [])) },
  { name: 'penetration', opts: {}, cost: 21,
    gate: 'every budget row OK or waived (waived rows reported as debt)',
    fails: (r) => r.filter((row) => row.status !== 'OK' && row.status !== 'WAIVED'),
    note: (r) => { const w = r.filter((row) => row.status === 'WAIVED').length; return w ? `${w} waived (accepted debt)` : null; } },
  { name: 'alarmHandoffs', opts: {}, cost: 2,
    gate: 'every declared hand-off within ±tol of touch at both parities, or waived',
    fails: (r) => r.unwaived,
    note: (r) => `${r.rows.length} hand-offs, ${r.waivedCount} waived (accepted debt)` },
  { name: 'stockFloor', opts: {}, cost: 3,
    gate: '0 degenerate and 0 unwaived',
    fails: (r) => [...r.degenerate, ...r.violations],
    note: (r) => `${r.rowsChecked} rows, ${r.waivedCount} waived (accepted debt)` },
  { name: 'intraUnit', opts: { yieldEvery: YIELD_EVERY }, cost: 4,
    gate: '0 unwaived mover-vs-fixture intersections',
    fails: (r) => r.violations,
    note: (r) => `${r.movers} movers over ${r.poses} poses, ${r.waived.length} waived (accepted debt)` },
  { name: 'expectedContacts', opts: { yieldEvery: YIELD_EVERY }, cost: 169,
    gate: '0 unwaived floor rows, 0 unmatched contact selectors',
    fails: (r) => [...r.violations, ...r.unmatched.map((u) => ({ unmatchedContactSelector: u }))],
    note: (r) => `${r.results.length} pairs, ${r.waivedCount} waived (accepted debt)` },
  { name: 'oscillator', opts: {}, cost: 1,
    gate: 'the spring is cut to the beat, in real hairspring stock',
    fails: (r) => r.failures,
    note: (r) => `implied ${r.impliedHz} Hz vs spec ${r.specHz} Hz, ribbon ${r.spring.h_mm.toFixed(4)} mm (stock ${r.spring.windowMm[0]}–${r.spring.windowMm[1]})` },
  // §48's no-spring audit, gated for the first time (TODO 29). It was
  // exported and never registered, so nothing could run it — a clean report
  // from an instrument nobody runs looks like coverage and is not. §48's own
  // rule that it is a REPORT is kept: `ok` is always true and the rows are
  // the product, so what is gated is the part that CAN be gated — every
  // reversing part either has a restoring element, is driven both ways, or is
  // waived against a filed TODO. The control is gated too: a positive control
  // that quietly stops passing is how this class of check dies.
  { name: 'restoring', opts: { yieldEvery: YIELD_EVERY }, cost: 3,
    gate: '0 unwaived restored-by-nothing, 0 malformed, 0 stale, control PASS',
    fails: (r) => [
      ...r.unwaived,
      ...r.malformedDeclarations,
      ...r.staleDeclarations,
      ...(String(r.control).startsWith('PASS') ? [] : [{ control: r.control }]),
    ],
    note: (r) => `${r.population} reversing units, ${r.twoWayDriven.length} two-way, `
      + `${r.restoredByDeclaredElement.length} sprung, ${r.waived.length} waived (accepted debt)` },
  { name: 'inspection', opts: { includeExcluded: true, yieldEvery: YIELD_EVERY }, cost: 985,
    gate: '0 FORBIDDEN pairs',
    fails: (r) => r.report.filter((row) => row.class === 'FORBIDDEN'),
    note: (r) => `${r.units.length} units, ${r.report.length} contacting pairs` },
  { name: 'clearances', opts: { yieldEvery: YIELD_EVERY }, cost: 497,
    gate: '0 violations',
    fails: (r) => r.violations,
    note: (r) => `${r.results.length} budgets` },
  { name: 'sweptOverlap', opts: { yieldEvery: YIELD_EVERY }, cost: 1990,
    gate: '0 CONFIRMED',
    fails: (r) => r.sound.staticVsSwept.violations,
    note: (r) => {
      const s = r.sound.staticVsSwept;
      return `${s.pairsTested} pairs, tight ${s.tight.length}, refuted ${s.refutedByRefinement.length}`;
    } },
];

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

// §81 tranche B — the partition, longest-processing-time greedy: sort the
// checks by measured cost descending and drop each onto the shard that is
// currently lightest. LPT is the classic 4/3-competitive heuristic for
// makespan, which is more than enough here because ONE check dominates the
// column — `sweptOverlap` at ~33 min against ~29 min for the other eleven put
// together, so every sensible partition converges on {sweptOverlap} against
// {the rest} and the wall is that check's own cost plus a boot. That also
// says what more shards can and cannot buy: K > 2 cannot go below the
// slowest single check, because no check is subdivided. When §82 takes
// `sweptOverlap` out of the dominant slot the column moves and this
// re-partitions on its own — which is the whole reason it reads a column
// instead of naming the checks.
function partition(entries, k) {
  const shards = Array.from({ length: k }, () => ({ entries: [], cost: 0 }));
  for (const e of [...entries].sort((a, b) => b.cost - a.cost)) {
    const lightest = shards.reduce((m, s) => (s.cost < m.cost ? s : m));
    lightest.entries.push(e);
    lightest.cost += e.cost;
  }
  // Report each shard's checks in the canonical BATTERY order, so a shard's
  // own log reads like the battery it came from.
  for (const s of shards) s.entries.sort((a, b) => entries.indexOf(a) - entries.indexOf(b));
  return shards.filter((s) => s.entries.length);
}

// Serialises the virgin boots. Two shards booting at once would race on the
// dev server's single /__state file — one shard's DELETE against another's
// startup GET — and a virgin boot is only virgin if nothing else is touching
// that file. The boots cost ~26 s each and the checks are the expensive part,
// so serialising them costs a fraction of what the sharding saves.
function serialiser() {
  let tail = Promise.resolve();
  return (fn) => {
    const next = tail.then(fn, fn);
    tail = next.then(() => {}, () => {});
    return next;
  };
}

const argv = process.argv.slice(2);
const argOf = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1];
};
// Default 2, not cpus().length: the runner this gate lives on (ubuntu-latest)
// has 4 vCPU, the checks are single-threaded JS holding their page's main
// thread, and the partition above cannot use a third shard anyway while one
// check owns the critical path. `--shards 1` is the pre-§81 single-file run,
// kept because it is the reference the sharded run has to agree with.
const SHARDS = (() => {
  const raw = argOf('--shards') ?? process.env.BATTERY_SHARDS ?? '2';
  const k = Number(raw);
  // Refuse a garbage count rather than silently falling back: `--shards tow`
  // quietly running 2 is how a run gets misreported as a sharded one.
  if (!Number.isInteger(k) || k < 1) throw new Error(`--shards wants a positive integer, got "${raw}"`);
  return Math.min(k, BATTERY.length);   // more shards than checks is just idle boots
})();
// Every check's FULL payload, written as JSON. This is §81's (and §80's)
// acceptance instrument: "same rows, same numbers" is a diff of two of these
// across the change, not a reading of the PASS/FAIL column — a gate reports
// only whether its failure list is empty, so a report that moved while
// staying empty passes the gate and fails the entry.
const REPORT_PATH = argOf('--report');

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
  try {
    await page.waitForFunction(() => !!window.__clock, null, { timeout: BOOT_TIMEOUT_MS });
  } catch {
    // TODO 30 — a boot that DIES is not a boot that is slow, and until now the
    // two were indistinguishable here: __clock never appears, this times out,
    // and the timeout carries no message. The diagnosis existed the whole time
    // and was thrown away by ordering — `errors` already holds the pageerror,
    // and the `if (errors.length)` check below is unreachable once this throws.
    // main.js now publishes the warn buffer and the fatal error from its first
    // lines, on their own surface, so read all three and say what happened.
    // RACED, not awaited: a boot can fail by WEDGING as well as by dying (see
    // CLAUDE.md's yield-throttling trap), and evaluate() on a blocked main
    // thread never resolves — reading the diagnosis must not become a second
    // way for CI to hang with no message.
    const d = await Promise.race([
      page.evaluate(() => ({
        warns: window.__bootWarns ? window.__bootWarns.slice() : null,
        err: window.__bootError || null,
      })).catch(() => ({ warns: null, err: null })),
      new Promise((r) => setTimeout(() => r({ warns: null, err: null, wedged: true }), 10000)),
    ]);
    const lines = [`the build never finished booting (no __clock after ${secs(BOOT_TIMEOUT_MS)})`];
    if (d.wedged) lines.push('and its main thread did not answer in 10s — the page is WEDGED, not dead.');
    if (d.err) lines.push(`fatal: ${d.err.message}`, ...(d.err.stack ? [d.err.stack] : []));
    if (d.warns === null) {
      if (!d.wedged) lines.push('__bootWarns is absent too — main.js did not reach its first 60 lines (a parse or import failure).');
    } else if (d.warns.length) lines.push(`${d.warns.length} boot warn(s) before it died:`, ...d.warns.map((w) => `  · ${w}`));
    else lines.push('no boot warns were recorded before it died.');
    if (errors.length) lines.push('page errors:', ...errors.map((e) => `  · ${e}`));
    throw new Error(lines.join('\n'));
  }
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
  const shards = partition(BATTERY, SHARDS);
  const bootInTurn = serialiser();
  console.log(`${shards.length} shard(s), partitioned by measured cost:`);
  shards.forEach((s, i) => console.log(
    `  shard ${i}  ~${Math.round(s.cost / 60)} min  ${s.entries.map((e) => e.name).join(' ')}`));

  // Every shard is a VIRGIN boot running a subset of the battery, and that is
  // sound for exactly one reason, which is worth stating because the whole
  // tranche rests on it: `start()` in inspect.js calls `clock.resetInputs()`
  // before every check, so a check's result cannot depend on which checks ran
  // before it on that page. (It has to — some of what setPose writes is
  // CUMULATIVE, §80's finding at walkPoses.) Sharding therefore changes the
  // GROUPING of checks and nothing a check can observe. If a report ever
  // moves between `--shards 1` and `--shards 2`, that invariant has broken
  // and the check that moved is the bug, not the harness.
  const results = new Map();  // name → { result, ms }
  // Each shard catches its own failure instead of rejecting: one shard dying
  // must not throw away what the others measured, because the surviving
  // reports are how you tell a broken harness from a broken build.
  const shardOut = await Promise.all(shards.map(async (shard, i) => {
    const tag = shards.length > 1 ? `[shard ${i}] ` : '';
    let context = null;
    try {
      const boot = await bootInTurn(async () => {
        console.log(`${tag}boot (virgin)…`);
        const p = await virginBoot(browser, base);
        console.log(`${tag}  __clock up at ${secs(Date.now() - t0)}`);
        return p;
      });
      context = boot.context;
      const page = boot.page;
      const warns = await page.evaluate(() => {
        window.__clock.beginSweepHold(); // frozen for the whole battery — see header
        return window.__clock.bootWarns.slice();
      });
      // The fingerprint is read on shard 0 only. It is not a per-shard property
      // — it is the identity build's hash, and shard 0's boot is as virgin as
      // any other. Reading it here rather than on its own boot keeps the boot
      // count at shards + 1, which is what the double-boot anchor needs.
      const fp = i === 0
        ? await page.evaluate(() => window.__I.fingerprint(window.__clock))
        : null;
      for (const { name, opts } of shard.entries) {
        const t = Date.now();
        const { result, ms } = await runCheck(page, name, opts);
        results.set(name, { result, ms });
        console.log(`${tag}${name}… ${secs(ms)} (at ${secs(t - t0 + ms)})`);
      }
      return { warns, fp };
    } catch (err) {
      console.error(`${tag}shard FAILED: ${err.message}`);
      return { warns: [], fp: null, error: String(err.message) };
    } finally {
      await context?.close().catch(() => {});
    }
  }));

  // Boot silence is gated on EVERY shard, not just the first: each is a real
  // virgin boot of the same tree, so a warning that only some boots produce is
  // a nondeterminism this gate should not be able to miss.
  gate('boot silent (rule 6)', shardOut.flatMap((s, i) => s.warns.map((w) => ({ shard: i, warn: w }))));
  gate('every shard completed', shardOut.flatMap((s, i) => (s.error ? [{ shard: i, error: s.error }] : [])));

  const fpA = shardOut[0].fp;
  if (fpA) console.log(`  fingerprint A: ${fpA.hash} (${fpA.units} units, ${fpA.poseCount} poses)`);

  // Gates are evaluated in canonical BATTERY order regardless of which shard
  // produced which result, so the log a human reads (and a report diff) does
  // not depend on the partition.
  for (const { name, gate: gateDesc, fails, note } of BATTERY) {
    const got = results.get(name);
    // A shard that dies takes its remaining checks with it. Say which ones
    // rather than throwing on the first missing payload: a battery that
    // reports "sweptOverlap never ran" is diagnosable, and one that dies with
    // a TypeError reading `result` of undefined is not.
    if (!got) { gate(`${name}: ${gateDesc}`, [{ neverRan: name, reason: 'its shard failed before reaching it' }]); continue; }
    gate(`${name}: ${gateDesc}`, fails(got.result), note?.(got.result));
  }

  // Determinism anchor: a SECOND virgin boot must reproduce the hash exactly.
  // Deliberately NOT sharded — its whole content is that two virgin contexts
  // of this tree agree, so it stays one boot after the shards have closed.
  console.log('boot B (virgin, fresh context)…');
  const B = await virginBoot(browser, base);
  const fpB = await B.page.evaluate(() => window.__I.fingerprint(window.__clock));
  console.log(`  fingerprint B: ${fpB.hash}`);
  gate('fingerprint deterministic across virgin boots',
    fpA && fpA.hash === fpB.hash && fpA.units === fpB.units ? [] : [{ bootA: fpA, bootB: fpB }],
    `hash ${fpA ? fpA.hash : 'shard 0 never reported one'}`);
  await B.context.close();

  const failed = gates.filter((g) => !g.pass);
  const totalMs = Date.now() - t0;
  console.log(`\n${gates.length - failed.length}/${gates.length} gates pass · total ${secs(totalMs)}`
    + ` (checks ${secs([...results.values()].reduce((a, r) => a + r.ms, 0))} across ${shards.length} shard(s))`);

  if (REPORT_PATH) {
    // Sorted keys and 2-space JSON so two runs diff line-for-line. `ms` is
    // here to refresh the cost column and is the ONE field expected to move
    // between runs — diff with it filtered out when comparing reports.
    const report = {
      fingerprint: fpA,
      checks: Object.fromEntries(BATTERY.map(({ name }) =>
        [name, results.has(name)
          ? { ms: results.get(name).ms, result: results.get(name).result }
          : { neverRan: true }])),
    };
    writeFileSync(resolve(REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`report written to ${resolve(REPORT_PATH)}`);
  }

  if (failed.length) {
    console.error(`FAILED: ${failed.map((g) => g.name).join(' · ')}`);
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  server?.kill();
  rmSync(stateDir, { recursive: true, force: true });
}
