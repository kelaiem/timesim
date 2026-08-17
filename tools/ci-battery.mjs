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
//   axisEntry    every ordered pair of pose axes reproduces the entered axis
//                exactly (TODO 54); the leak tier beside it is a report
//   penetration  every budget row OK or waived (waived rows reported as debt)
//   alarmHandoffs every declared hand-off of the §35 arming run within ±tol
//                of touch at both parities, or waived citing its TODO item
//   stockFloor   0 degenerate AND 0 unwaived (waived rows reported as debt)
//   intraUnit    0 unwaived intersections inside a unit — movers vs
//                fixtures over every unit, fixture pairs and cross-frame
//                mover pairs inside INTRA_TIER_SCOPE — and 0 unmatched
//                declared selectors (TODO 5/§121; out-of-scope FF/MM rows
//                and waived rows reported as debt)
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
//                           (default 3; 1 is the pre-§81 single-file run).
//         --report FILE     write every check's FULL payload as JSON — the
//                           "same rows, same numbers" instrument §80 and §81
//                           are both accepted against.
//         --no-split        run each divisible check whole instead of as
//                           per-axis tasks (§127). The reference the split
//                           has to agree with, kept for the same reason
//                           `--shards 1` is.
// Exits 0 only when every gate passes; failing gates dump their payloads.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { INSPECTION_SLICES, mergeInspection, buildTasks } from './battery-split.mjs';

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
// of them. Roadmap §82 still owns that tier and has not landed.
//
// §81 SHARDED THE HARNESS AND THIS GUARD DID NOT MOVE, which took two wrong
// answers to establish. The entry's acceptance asked for 45 → 20; §81 first
// tried 45 → 40, derived from `sweptOverlap` measuring 26.2 min inside a
// 2-shard run on a DEV CONTAINER. The first CI run said 2184.6 s (36.4 min)
// for the same check, so 40 would have left a WEDGE guard 1.10x of headroom
// over a healthy run. Reverted to 45 before shipping.
//
// THE SECOND WRONG ANSWER WAS THE EXPLANATION. That revert was written up as
// "ubuntu-latest is ~1.45x slower than the dev container" — a tidy ratio, from
// one run. The next CI run of the same harness on the same tree came in at
// 2459.1 s of check time against the first run's 4082.8 s: a 1.66x SPREAD
// between two CI runs, wall 22.3 min against 36.7. There is no stable
// dev-vs-CI ratio to derive anything from; the dev container sits inside CI's
// own spread (2807.8 s).
//
// So the rule is not about which machine. A GUARD IS SIZED BY THE SLOW TAIL OF
// THE ENVIRONMENT IT RUNS IN, AND ONE RUN DOES NOT MEASURE A TAIL. Both wrong
// answers here came from a single green run — which is the trap worth
// remembering, because a green run is exactly what makes a too-tight guard
// look justified right up until it fires on a healthy build.
//
// 45 was 1.24x over the worst `sweptOverlap` then observed (36.4 min CI),
// which is thinner than a guard should be — and deliberately NOT raised to
// fit the check, because raising a guard to fit a check is how the 45/60
// pair got into trouble; the number that has to come down is
// `sweptOverlap`'s, and that is roadmap §82's confirm tier.
//
// TODO 38 then GREW THE WORKLOAD BY DESIGN — the `alarmWind` axis adds 109
// poses to the confirm tier's per-candidate sweeps (902/793 = 1.137x the
// axis-sample total) and its hull growth moved the candidate list 21 → 23 —
// so the guard follows the workload by arithmetic, which is a re-derivation,
// not an accommodation: leaving 45 would have thinned the headroom to
// 45 / (36.4 x measured growth) ≈ 1.03x, the exact fires-on-a-healthy-run
// failure the 40-minute mistake above documents. That took the guard to 59.
//
// §82 THEN LANDED AND THE CAVEAT CAME DUE. The confirm tier went from
// fifteen sequential uncapped sweeps to one batched capped sweep, and its
// arbiter's two vendored defects were patched (vendor/README.md):
// `sweptOverlap` measured 1870 s → 352 s on the same machine, and the
// slowest single check is now `inspection` (688–719 s across this landing's
// local runs). Same arithmetic, new binding check: projected CI worst =
// 12.0 min local x 1.66 (CI's own measured spread over local, above)
// = 19.9 min; guard = 1.24 x 19.9 = 24.7 → 25 min. §82's filing wrote 20,
// derived when `inspection` measured 567 s — the number moved because the
// check grew (TODO 27's chain, TODO 38's axis, three landings of report
// growth since), and following the stale target instead of the arithmetic
// is exactly the 40-minute mistake again.
//
// TODO 38's GOING-WIND AXIS then spent part of §82's win, knowingly: 720
// poses at the train axis's own density standard grew every dense sweep
// (`inspection` 719 → 991 s, `clearances` 534 → 744 s on the same
// machine), and the guard follows the workload by the same arithmetic —
// projected CI worst = 16.5 min × 1.66 = 27.4 min; guard = 1.24 × 27.4
// = 34.0 → 35. The axis's n is derived (96/fusee-rev, 3.75 rev each
// way), so the number that could come down here is inspection's
// per-pose cost, not the coverage — that is roadmap-scale work if
// anyone wants the minutes back. ONE MORE PASS IS OWED: a local run is
// not a CI tail — re-derive from several CI runs of this harness once
// they exist, per the standing rule above.
//
// Note also what sharding can and cannot buy: the wall is now max(shard), but
// this guard and battery.yml's job cap are both set by the slowest single
// CHECK, which no partition subdivides. Sharding moved the wall 2.2x and moved
// neither timeout.
const CHECK_TIMEOUT_MS = 35 * 60 * 1000;
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
// editing the column. `--report` writes the same column back out as `ms`,
// which is how they get refreshed. They are used ONLY to balance the shards:
// a stale number costs wall clock, never a wrong verdict.
//
// §127 REFRESHED THEM, and the drift is the argument for doing it: against the
// post-§80 numbers this column used to carry, the measured ratios were 0.77
// (`inspection`), 0.73 (`clearances`), 0.95 (`expectedContacts`) and 0.61
// (`sweptOverlap`). A uniform factor would have been a faster machine and
// harmless; a spread that wide is the checks moving relative to each other —
// §82 took `sweptOverlap` down, `expectedContacts` grew — and THAT is what
// mis-partitions. These are one full green run of this harness on a 4-vCPU
// container (2026-08-17, 2029.1 s of check time): the stale column put
// `inspection`+`expectedContacts` on one shard for a 1150.7 s wall where the
// refreshed one splits at 1021.9 s, and at K=3 lands on `inspection` alone.
// They are dev-container numbers, and CI's absolute times swing widely around
// them (two runs of one tree: 4082.8 s and 2459.1 s of check time). That does
// not matter here — the partition is decided by RATIOS between checks, which
// are stable, and the slow CI run split 2184.6 s against 1898.2 s on exactly
// this column.
const BATTERY = [
  { name: 'support', opts: {}, cost: 15,
    gate: '0 failures',
    fails: (r) => r.failures },
  { name: 'graph', opts: {}, cost: 1,
    gate: 'every violation list empty (todo allowed)',
    fails: (r) => Object.entries(r)
      .filter(([k]) => k !== 'todo')
      .flatMap(([k, v]) => (Array.isArray(v) && v.length ? [{ [k]: v }] : [])) },
  // TODO 54 — the pose contract every sweep below rests on, so it reads early:
  // if canonical axis entry does not hold, the sweeps' findings are a function
  // of AXES' declaration order and §127's partition is measuring a different
  // movement in each shard. Its leak tier is a report (see checkAxisEntry).
  { name: 'axisEntry', opts: {}, cost: 2,
    gate: 'every ordered axis pair reproduces the entered axis exactly',
    fails: (r) => r.violations,
    note: (r) => `${r.pairsTested} ordered pairs; without the entry ${r.leak.pairsLeaking} leak, `
      + `${r.leak.units.length} units move (worst ${r.leak.units[0]?.unit ?? '—'} ${r.leak.units[0]?.worst ?? 0})` },
  // §111 raised this from 17 (the governor row's 449 phases); §113's stubby
  // pallets halved the row's mesh work — measured 21 s.
  { name: 'penetration', opts: {}, cost: 18,
    gate: 'every budget row OK or waived (waived rows reported as debt)',
    fails: (r) => r.filter((row) => row.status !== 'OK' && row.status !== 'WAIVED'),
    note: (r) => { const w = r.filter((row) => row.status === 'WAIVED').length; return w ? `${w} waived (accepted debt)` : null; } },
  { name: 'alarmHandoffs', opts: {}, cost: 1,
    gate: 'every declared hand-off within ±tol of touch at both parities, or waived',
    fails: (r) => r.unwaived,
    note: (r) => `${r.rows.length} hand-offs, ${r.waivedCount} waived (accepted debt)` },
  // §47 — the going side's two arrest contacts, the same instrument as the
  // alarm rows through its own pose table (full wind = shut, slack = free).
  { name: 'windArrestHandoff', opts: {}, cost: 1,
    gate: 'the arrest shut at full wind and free at slack, both contacts',
    fails: (r) => r.unwaived,
    note: (r) => `${r.rows.length} hand-offs, ${r.waivedCount} waived (accepted debt)` },
  { name: 'stockFloor', opts: {}, cost: 6,
    gate: '0 degenerate and 0 unwaived',
    fails: (r) => [...r.degenerate, ...r.violations],
    note: (r) => `${r.rowsChecked} rows, ${r.waivedCount} waived (accepted debt)` },
  { name: 'intraUnit', opts: { yieldEvery: YIELD_EVERY }, cost: 6,
    gate: '0 unwaived intra-unit intersections (MF everywhere; FF/MM inside INTRA_TIER_SCOPE), 0 unmatched selectors',
    fails: (r) => [...r.violations, ...r.unmatchedSelectors.map((u) => ({ unmatchedIntraUnitSelector: u }))],
    note: (r) => `${r.movers} movers in ${r.frames} frames over ${r.poses} poses; pairs MF ${r.tiers.MF}/FF ${r.tiers.FF}/MM ${r.tiers.MM}, `
      + `${r.outOfScope.length} out of scope (reported), ${r.waived.length} waived (accepted debt), ${r.unmeasurable.length} unmeasurable (reported)` },
  // 147 → 243 with §94 tier A's three sub-dial rows. Two of them pair a
  // 3-mesh and a 4-mesh unit against the DIAL's 147 meshes, and the pair
  // loop is quadratic in exactly that. Measured, unscaled, on the container
  // that ran the landing battery — where the unchanged checks scatter
  // 0.99–1.43x against this column, so no single factor was applied (the
  // header's own lesson about one run).
  // 243 → 281 with TODO 41's Dial ⇄ Power reserve row — a fourth
  // small-unit × Dial pair of the same quadratic class. The landing ran
  // base and changed trees side by side on one container, so the changed
  // tree's 305 s is deflated by the base's own drift on the same run
  // (264 s against this column's 243): 305 × 243/264 ≈ 281. The partition
  // does not move either way: shard 1's total is 1336 against
  // sweptOverlap's 1573 alone.
  // 281 → 320 with §94 tier C's two reserve-train rows (7 → 9 pairs, one
  // of them another Dial pair of the quadratic class). Measured unscaled
  // on the tier's landing container; the partition still does not move —
  // sweptOverlap alone (1787 there) exceeds the other shard's 1245 total.
  // §107 — TODO 5's other half. `intraUnit` above compares movers against
  // their own unit's FIXTURES, so two meshes that always move together were
  // never measured by anything: §104's governor anchor shipped with one pallet
  // blade 0.236 clear of the arm carrying it, through a fully green battery,
  // and the owner found it by looking at the screen. §48's rule holds — `ok`
  // is always true and the rows are the product — so what is gated is what the
  // population supports: the units in ASSEMBLY_SCOPE. Everything else reports.
  { name: 'assembly', opts: {}, cost: 4,
    gate: '0 undeclared, unwaived splits among the scoped units',
    fails: (r) => r.violations,
    note: (r) => `${r.rowsChecked} split rigid groups over ${r.poses} poses, `
      + `${r.outOfScope.length} out of scope (reported), ${r.waived.length} waived (accepted debt)` },
  { name: 'expectedContacts', opts: { yieldEvery: YIELD_EVERY }, cost: 389,
    gate: '0 unwaived floor rows, 0 unmatched contact selectors',
    fails: (r) => [...r.violations, ...r.unmatched.map((u) => ({ unmatchedContactSelector: u }))],
    note: (r) => `${r.results.length} pairs, ${r.waivedCount} waived (accepted debt)` },
  { name: 'oscillator', opts: {}, cost: 1,
    gate: 'the spring is cut to the beat, in real hairspring stock',
    fails: (r) => r.failures,
    note: (r) => `implied ${r.impliedHz} Hz vs spec ${r.specHz} Hz, ribbon ${r.spring.h_mm.toFixed(4)} mm (stock ${r.spring.windowMm[0]}–${r.spring.windowMm[1]})` },
  // TODO 32 — the going spring's torque law is DERIVED now, and this holds
  // the derivation: set-up quantised to the ratchet, the fusee's level
  // product an identity at float noise, and both ribbons' published sections
  // still describing the metal the records' k was computed from.
  // §104 — the cost moved 1 → 14: the alarm half's endpoint rows STEP the
  // shipped tick law (120 ticks at two winds), which is the row's whole
  // point; a stale 1 here costs wall clock, never a verdict.
  { name: 'equalisation', opts: {}, cost: 16,
    gate: 'set-up on a ratchet click, level product at float noise, sections declared = cut',
    fails: (r) => r.failures,
    note: (r) => r.summary },
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
  { name: 'inspection', opts: { includeExcluded: true, yieldEvery: YIELD_EVERY }, cost: 762,
    slices: INSPECTION_SLICES, merge: mergeInspection,   // §127 — divisible along its axis loop
    gate: '0 FORBIDDEN pairs',
    fails: (r) => r.report.filter((row) => row.class === 'FORBIDDEN'),
    note: (r) => `${r.units.length} units, ${r.report.length} contacting pairs` },
  { name: 'clearances', opts: { yieldEvery: YIELD_EVERY }, cost: 545,
    gate: '0 violations',
    fails: (r) => r.violations,
    note: (r) => `${r.results.length} budgets` },
  { name: 'sweptOverlap', opts: { yieldEvery: YIELD_EVERY }, cost: 260,
    gate: '0 CONFIRMED',
    fails: (r) => r.sound.staticVsSwept.violations,
    note: (r) => {
      const s = r.sound.staticVsSwept;
      return `${s.pairsTested} pairs, tight ${s.tight.length}, refuted ${s.refutedByRefinement.length}`;
    } },
];

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

// §81 tranche B — the partition, longest-processing-time greedy: sort the
// TASKS by measured cost descending and drop each onto the shard that is
// currently lightest. LPT is the classic 4/3-competitive heuristic for
// makespan.
//
// §81 wrote here that "K > 2 cannot go below the slowest single check, because
// no check is subdivided," and that sentence was true of every partition this
// function could be handed — the atom was a whole check, so one dominant check
// WAS the floor (§82 took `sweptOverlap` out of that slot and `inspection`
// walked straight into it, which is §108's finding 2). §127 subdivides, so the
// floor is now the largest TASK. What has not changed is why the column is
// data: a partition written as code would be re-argued every time a check got
// faster, and this one re-partitions by editing a number.
//
// It still cannot go below the largest single task, and slices are not free of
// that either — `wind` is 44% of `inspection`'s poses, so an axis split has its
// own floor. Going below THAT means slicing inside an axis, which §127 declines
// to do (`alarmToggle`'s column advances cumulatively within its own sweep, so
// an index range in it is not reproducible).
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
// Default 3 since §127, and the reason the old 2 was right is the reason it
// stopped being: "the partition cannot use a third shard anyway while one
// check owns the critical path" was true while the atom was a whole check —
// `inspection` was the critical path and a third shard sat idle beside it.
// Subdivided, it is not: measured on the landing container, K=2 walls at
// 1021.9 s and K=3 at 676.7 s. Still not cpus().length — ubuntu-latest has 4
// vCPU, the checks are single-threaded JS holding their page's main thread,
// and the fourth core has the harness and dev_server.py on it. K=4's 545.1 s
// is real on paper and unmeasured under contention; take it when someone has
// measured it rather than because the arithmetic allows it.
//
// A shard count is not a guard: like the cost column, a wrong one costs wall
// clock and never a verdict, which is why one measured run is enough to move
// it and is deliberately NOT enough to move CHECK_TIMEOUT_MS above.
// `--shards 1` is the pre-§81 single-file run, kept because it is the
// reference the sharded run has to agree with.
const SHARDS = (() => {
  const raw = argOf('--shards') ?? process.env.BATTERY_SHARDS ?? '3';
  const k = Number(raw);
  // Refuse a garbage count rather than silently falling back: `--shards tow`
  // quietly running 2 is how a run gets misreported as a sharded one.
  if (!Number.isInteger(k) || k < 1) throw new Error(`--shards wants a positive integer, got "${raw}"`);
  return k;   // capped against the TASK count at the call site (§127 — tasks, not checks, are what a shard holds)
})();
// Every check's FULL payload, written as JSON. This is §81's (and §80's)
// acceptance instrument: "same rows, same numbers" is a diff of two of these
// across the change, not a reading of the PASS/FAIL column — a gate reports
// only whether its failure list is empty, so a report that moved while
// staying empty passes the gate and fails the entry.
const REPORT_PATH = argOf('--report');
// TODO 36 — run the spec-boot tier ALONE. The sweeps take tens of minutes and
// this tier takes about one, so iterating on the declared set (or debugging a
// single spec that stopped building) should not require the whole battery.
// It is a focused-check flag in CLAUDE.md's sense, not a second gate: the
// full run always includes these points.
const SPEC_ONLY = argv.includes('--spec-only');
// §127 — split the divisible checks into per-axis tasks. ON by default, since
// the point is to shorten the wall CI actually runs; `--no-split` is the
// reference the split has to agree with, kept for exactly the reason
// `--shards 1` is kept. The two flags answer different questions: --no-split
// changes what the TASKS are, --shards changes how they are grouped, and a
// report that moves under either is a bug in the check that moved.
const SPLIT = !argv.includes('--no-split');

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

// --- TODO 36 — THE RECONFIGURE SURFACE, BOOTED --------------------------
//
// Every gate above boots the DEFAULT spec. Six §33 handles, the §22 knobs,
// deep links and saved variants reached the builders through a path no check
// had ever executed — and TODO 35 was the bill: a build that did not boot at
// all for ?alarmaz= 175-180, shipped in a PR whose battery read 15/15 green,
// found only because §74 Tier B swept corner azimuths by hand.
//
// THE ASSERTION IS LIVENESS, NOT SILENCE, and that is the whole design. A
// moved station legitimately warns — that IS its true verdict — so demanding
// a silent boot would gate the wrong thing and make every honest red look
// like a defect. What this holds is narrower and absolute: the build must
// EXIST. No __clock means no instrument can speak at all, which is the one
// outcome that is always wrong (TODO 30's class, arriving from a spec value).
//
// So a point that warns PASSES, and its warning count is reported as data.
// A point that dies FAILS and says how it died, because virginBoot's TODO 30
// diagnosis separates dead from wedged from merely slow.
//
// DECLARED, NOT SWEPT. A sweep would find the same 175-180 band and then
// re-find it every run with nobody able to say whether that was expected.
// Each row states what it is for, so a point that is EXPECTED to warn says so
// beside itself, and a point that starts warning when it used to be silent is
// a visible change in the report rather than a silent one.
const SPEC_POINTS = [
  // The identity, as a control: if this ever warns, the trial harness itself
  // is lying, because the default spec is what every gate above boots.
  { name: 'identity', q: '', expect: 'silent', why: 'the control — the same spec every other gate boots' },
  // §33 step 1 / step 2 — the stem and crown azimuths, each a shipped handle.
  { name: 'crownaz=90', q: 'crownaz=90', expect: 'any', why: '§33 step 1 — the crown a quarter turn round' },
  { name: 'stemaz=200', q: 'stemaz=200', expect: 'any', why: '§33 step 2 — the stem decoupled from the barrel' },
  // §33 step 3 — solveLayout's own arrangement angles.
  { name: 'barrelstep=-20', q: 'barrelstep=-20', expect: 'any', why: '§33 step 3 — the barrel step off its default -35' },
  { name: 'escstep=-70', q: 'escstep=-70', expect: 'any', why: '§33 step 3 — the escape step off its default -57.9' },
  { name: 'balstep=60', q: 'balstep=60', expect: 'any', why: '§33 step 3 — a balance TARGET the solver must move off' },
  // The alarm corner, including the band that did not build. 175 is TODO 35's
  // own regression case and is here so it can never come back unnoticed.
  { name: 'alarmaz=90', q: 'alarmaz=90', expect: 'any', why: '§33 — the alarm corner at 90°' },
  { name: 'alarmaz=175', q: 'alarmaz=175', expect: 'any', why: "TODO 35's regression case — this exact spec did not build" },
  { name: 'alarmaz=180', q: 'alarmaz=180', expect: 'any', why: "TODO 35's regression case, the far edge of the band" },
  { name: 'alarmmod=200', q: 'alarmmod=200', expect: 'any', why: '§33 — the whole alarm module round to 200°' },
  // §94 tier A — the small-seconds station. Three points, each measured on
  // this tree before it was written down (roadmap §74 kept the arithmetic;
  // every number below was re-measured, and one of its figures moved):
  //   · 20 is the OUTWARD point, and it boots SILENT here — §74 measured 1
  //     warning at this value, so the tree has improved under it since;
  //   · 16 is inside the [16, 17] window where solveKeyless reports the side
  //     sign nearly degenerate (balance −0.48 off the stem line). It is here
  //     BECAUSE it warns: the window is documented by a row that expects it,
  //     not suppressed. It also fouls the §34 selector post against the
  //     moved well, which is the second warning and the honest one;
  //   · 24 is past the two-bar's closure window (1.95 ≤ d4 ≤ 23.55, the
  //     first NaN §74 measured). It must BOOT — the solve reports the
  //     refusal and keeps D4 rather than handing the build a NaN layout —
  //     so this row is the guard on that fallback, not on the bound.
  // The warning count is non-monotonic in d4 (17 → 1, 17.5 → 5, 20 → 0), so
  // read these as three declared points, never as a range to interpolate.
  { name: 'd4=20', q: 'd4=20', expect: 'any', why: '§94 tier A — the small-seconds station moved out; measured silent on this tree' },
  { name: 'd4=16', q: 'd4=16', expect: 'any', why: '§94 tier A — inside the keyless side-sign window: this point is EXPECTED to warn' },
  { name: 'd4=24', q: 'd4=24', expect: 'any', why: '§94 tier A — past the two-bar closure: must fall back to D4 and warn, never NaN' },
  // §94 tier C — the reserve station. Four points, each measured on this
  // tree before it was written down:
  //   · 20 is the OUTWARD point, and it boots silent;
  //   · 8 is inside the window and EXPECTED to warn twice — w2's tip
  //     against its own shrunken well ring (4.29 vs 4.10) and §34's
  //     selector post fouling the moved 12-well ring (−0.27 vs 0.15), the
  //     same instrument that polices d4 16's move, one station over;
  //   · 30 is past the well window (3.55, 27.54]. It must BOOT — there is
  //     no fallback to hide behind, because an off-face well is nonsense,
  //     not NaN: solveKeyless warns with the window, builds, and the
  //     battery judges the result;
  //   · reserveh=48&rsvr=27 is the JOINT row C3's bound exists for: at
  //     48 h w2 carries 32 teeth, so the tip-vs-well threshold the default
  //     hours keep OUTSIDE the window (rsvr 28.44) moves inside it
  //     (26.60) — the worst case neither key shows alone (tip 11.86
  //     against the well's 11.60; reserveh=48's own fusee warn rides
  //     along, same as its solo row).
  { name: 'rsvr=20', q: 'rsvr=20', expect: 'any', why: '§94 tier C — the reserve station moved out; measured silent on this tree' },
  { name: 'rsvr=8', q: 'rsvr=8', expect: 'any', why: '§94 tier C — inside the window, EXPECTED to warn: w2 tip vs its shrunken well, §34 post vs the moved ring' },
  { name: 'rsvr=30', q: 'rsvr=30', expect: 'any', why: '§94 tier C — past the well window: must warn and BOOT (an off-face well is nonsense, not NaN)' },
  { name: 'reserveh=48&rsvr=27', q: 'reserveh=48&rsvr=27', expect: 'any', why: '§94 tier C — the joint case: 48 h teeth meet a well the station outran; neither key alone shows it' },
  // §98 — the alarm corner's radius, §76's pin. Three points, measured on
  // this tree before written down (all at the default balance):
  //   · 14 is the INWARD pin and boots silent;
  //   · 20 is past the dogleg's ≈19.9 reach — the setting chain's own
  //     assert reports with numbers (i2 37 t cannot reach the arbor,
  //     needs ≥ 38 t), which is the interior bound doing this window's
  //     work exactly as the §98 filing scoped it;
  //   · 46 is past the stem's (0, plateR + 2.2) window — the solver's own
  //     warn fires and the boot proceeds (nonsense, not NaN), with the
  //     dogleg reporting no route at any bearing behind it.
  { name: 'alarmr=14', q: 'alarmr=14', expect: 'any', why: '§98 — the corner pinned inward; measured silent on this tree' },
  { name: 'alarmr=20', q: 'alarmr=20', expect: 'any', why: '§98 — past the dogleg reach: the chain\'s own assert reports, boot proceeds' },
  { name: 'alarmr=46', q: 'alarmr=46', expect: 'any', why: '§98 — past the stem window: the solver warns with both bounds, boot proceeds' },
  // §97 — the shared well radius. Three points, measured before written:
  //   · 8 is the interior value and boots silent (wells and both hands
  //     shrink together, every consumer reading the solve);
  //   · 13 is over the derived ceiling (11.85): the solver warns and KEEPS
  //     the ceiling — a larger well breaches the centre bore, TODO 33's
  //     degeneracy, so this key clamps where rsvr builds-and-judges;
  //   · 1 is under the derived floor (1.40): the solver clamps to the
  //     floor and warns, and the reserve train's tip check then reports
  //     w2 reaching through even the clamped well (5.23 vs 1.05) — two
  //     instruments composing on one nonsense spec.
  { name: 'subdialr=8', q: 'subdialr=8', expect: 'any', why: '§97 — the wells resized inward; measured silent on this tree' },
  { name: 'subdialr=13', q: 'subdialr=13', expect: 'any', why: '§97 — over the ceiling: clamps to it and warns (TODO 33\'s degeneracy stays closed)' },
  { name: 'subdialr=1', q: 'subdialr=1', expect: 'any', why: '§97 — under the floor: clamps to it and warns; the train\'s tip check reports the rest' },
  // §93 made the MODE itself a deep link, so entering it is now a boot-time
  // path: rings measured off six parts, the schematic tier forced, the panel
  // rows opened — all before a viewer has clicked anything. Silent, because
  // this point changes no station: it is the default spec with the tool open.
  { name: 'reconf=1', q: 'reconf=1', expect: 'silent', why: '§93 — reconfigure mode entered at boot from its own deep link' },
  // §22's two knobs, at both ends of their clamped ranges.
  { name: 'vph=28800', q: 'vph=28800', expect: 'any', why: '§22 — the fastest rate in RATE_TABLE, a re-geared escape mesh' },
  { name: 'reserveh=48', q: 'reserveh=48', expect: 'any', why: "§22 — the reserve clamp's upper end, the deepest fusee groove stack" },
];

// A spec boot. Deliberately NOT virginBoot: that one imports inspect.js and
// throws on any page error, which is right for a gate that will then run
// checks, and wrong here where the page error IS the measurement. ?trial=1
// carries the state isolation (state.js guards it at the choke point: a trial
// neither reads nor writes /__state), so these need no serialising against
// each other and no DELETE — they cannot race the file they never touch.
async function specBoot(browser, base, q) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  const url = `${base}/index.html?trial=1${q ? `&${q}` : ''}`;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: BOOT_TIMEOUT_MS });
    await page.waitForFunction(() => !!window.__clock, null, { timeout: BOOT_TIMEOUT_MS });
    const warns = await page.evaluate(() => (window.__clock.bootWarns || []).slice());
    return { alive: true, warns, errors };
  } catch {
    // Same three-way diagnosis virginBoot makes, for the same reason: dead,
    // wedged and slow are different findings and a timeout alone says none
    // of them. Raced, so a wedged main thread cannot hang the harness too.
    const d = await Promise.race([
      page.evaluate(() => ({
        warns: window.__bootWarns ? window.__bootWarns.slice() : null,
        err: window.__bootError ? { message: window.__bootError.message } : null,
      })).catch(() => ({ warns: null, err: null })),
      new Promise((r) => setTimeout(() => r({ warns: null, err: null, wedged: true }), 10000)),
    ]);
    return { alive: false, warns: d.warns, fatal: d.err, wedged: d.wedged, errors };
  } finally {
    await context.close().catch(() => {});
  }
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
  const tasks = buildTasks(BATTERY, SPLIT);
  const shards = SPEC_ONLY ? [] : partition(tasks, Math.min(SHARDS, tasks.length));
  if (SPEC_ONLY) console.log('--spec-only: skipping the sweeps and the fingerprint anchor.');
  const bootInTurn = serialiser();
  console.log(`${tasks.length} task(s)${SPLIT ? '' : ' (--no-split)'} across ${shards.length} shard(s), partitioned by cost:`);
  shards.forEach((s, i) => console.log(
    `  shard ${i}  ~${Math.round(s.cost / 60)} min  ${s.entries.map((e) => e.key).join(' ')}`));

  // Every shard is a VIRGIN boot running a subset of the battery, and that is
  // sound for exactly one reason, which is worth stating because the whole
  // tranche rests on it: `start()` in inspect.js calls `clock.resetInputs()`
  // before every check, so a check's result cannot depend on which checks ran
  // before it on that page. (It has to — some of what setPose writes is
  // CUMULATIVE, §80's finding at walkPoses.) Sharding therefore changes the
  // GROUPING of checks and nothing a check can observe. If a report ever
  // moves between `--shards 1` and `--shards 2`, that invariant has broken
  // and the check that moved is the bug, not the harness.
  const results = new Map();  // task key → { result, ms } — merged to check name below
  const axisMeta = [];        // §127 — window.__I.AXES as the page reports it, read once
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
      // §127 — the axis roster, from the page rather than from this file's
      // declaration of it. Read on shard 0 for the same reason the fingerprint
      // is: it is a property of the tree, not of the shard.
      if (i === 0) {
        axisMeta.push(...await page.evaluate(() => window.__I.AXES.map((a) => ({ name: a.name, n: a.n }))));
      }
      // The fingerprint is read on shard 0 only. It is not a per-shard property
      // — it is the identity build's hash, and shard 0's boot is as virgin as
      // any other. Reading it here rather than on its own boot keeps the boot
      // count at shards + 1, which is what the double-boot anchor needs.
      const fp = i === 0
        ? await page.evaluate(() => window.__I.fingerprint(window.__clock))
        : null;
      for (const { key, name, opts } of shard.entries) {
        const t = Date.now();
        const { result, ms } = await runCheck(page, name, opts);
        results.set(key, { result, ms });
        console.log(`${tag}${key}… ${secs(ms)} (at ${secs(t - t0 + ms)})`);
      }
      return { warns, fp };
    } catch (err) {
      console.error(`${tag}shard FAILED: ${err.message}`);
      return { warns: [], fp: null, error: String(err.message) };
    } finally {
      await context?.close().catch(() => {});
    }
  }));

  // Declared OUTSIDE the !SPEC_ONLY block that sets it, because --report reads
  // it after that block closes: as a `const` in there, every --report run died
  // on `fpA is not defined` AFTER printing its gate verdicts. CI never passes
  // --report, so nothing caught it — and CLAUDE.md makes this the file a
  // performance change is accepted against, so the instrument was broken for
  // exactly the use it exists for. null under --spec-only, which has no
  // fingerprint to report.
  let fpA = null;
  let checkMs = 0;   // §127 — task time, summed before slices are merged (see below)
  // Declared out here for the reason the comment above gives about fpA: the
  // --report block below reads it, and CI never passes --report, so a `const`
  // inside the !SPEC_ONLY block would break the instrument for exactly the use
  // it exists for and nothing in CI would notice.
  const sliceMs = new Map();   // check name → { axis: ms }, for the cost column
  // Boot silence is gated on EVERY shard, not just the first: each is a real
  // virgin boot of the same tree, so a warning that only some boots produce is
  // a nondeterminism this gate should not be able to miss.
  if (!SPEC_ONLY) {
  gate('boot silent (rule 6)', shardOut.flatMap((s, i) => s.warns.map((w) => ({ shard: i, warn: w }))));
  gate('every shard completed', shardOut.flatMap((s, i) => (s.error ? [{ shard: i, error: s.error }] : [])));

  // Summed BEFORE the merge writes a whole-check entry beside its slices —
  // afterwards every split check would be counted twice.
  checkMs = [...results.values()].reduce((a, r) => a + r.ms, 0);

  // §127 — ASSEMBLE, then gate. Two things are checked before a merge is
  // trusted, because both failures look like a healthy smaller run:
  //
  //   · the declared slice list must BE the page's axis roster. An axis added
  //     to inspect.js and not sliced here would simply never be swept, and the
  //     report would be a clean partition of less work.
  //   · every slice must have produced a payload. A shard that died takes its
  //     slices with it, and a union of the survivors is a report that gates
  //     green on a sweep that did not happen.
  if (SPLIT) {
    const roster = axisMeta.map((a) => a.name);
    for (const e of BATTERY) {
      if (!e.slices) continue;
      const declared = e.slices.map((s) => s.axis);
      const missing = roster.filter((n) => !declared.includes(n));
      const extra = declared.filter((n) => !roster.includes(n));
      const posesWrong = e.slices.filter((s) => {
        const a = axisMeta.find((m) => m.name === s.axis);
        return a && a.n + 1 !== s.poses;
      }).map((s) => ({ axis: s.axis, declared: s.poses, actual: axisMeta.find((m) => m.name === s.axis).n + 1 }));
      gate(`${e.name}: the declared slices are the page's axes`, [
        ...(roster.length ? [] : [{ error: 'shard 0 never reported window.__I.AXES' }]),
        ...missing.map((n) => ({ axisNotSliced: n })),
        ...extra.map((n) => ({ slicedAxisNotInAXES: n })),
        ...posesWrong.map((p) => ({ slicePoseCountStale: p })),
      ]);

      const parts = e.slices.map((s) => ({ slice: s.axis, got: results.get(`${e.name}:${s.axis}`) }));
      const absent = parts.filter((p) => !p.got).map((p) => ({ sliceNeverRan: p.slice }));
      gate(`${e.name}: every slice produced a payload`, absent);
      if (absent.length || !roster.length) continue;
      sliceMs.set(e.name, Object.fromEntries(parts.map((p) => [p.slice, p.got.ms])));
      // The merge's own consistency checks THROW (two slices claiming an axis,
      // disagreeing unit lists). Caught into a gate rather than left to reject:
      // this runs after every check has been measured, and a harness that dies
      // with a stack trace here would throw away the whole run's payloads —
      // the same argument the missing-payload path above already makes.
      try {
        results.set(e.name, {
          result: e.merge(parts.map((p) => ({ slice: p.slice, result: p.got.result })), axisMeta),
          ms: parts.reduce((a, p) => a + p.got.ms, 0),
        });
      } catch (err) {
        gate(`${e.name}: the slices merge`, [{ mergeFailed: String(err.message) }]);
      }
    }
  }

  fpA = shardOut[0].fp;
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
  if (!SPEC_ONLY) {
  console.log('boot B (virgin, fresh context)…');
  const B = await virginBoot(browser, base);
  const fpB = await B.page.evaluate(() => window.__I.fingerprint(window.__clock));
  console.log(`  fingerprint B: ${fpB.hash}`);
  gate('fingerprint deterministic across virgin boots',
    fpA && fpA.hash === fpB.hash && fpA.units === fpB.units ? [] : [{ bootA: fpA, bootB: fpB }],
    `hash ${fpA ? fpA.hash : 'shard 0 never reported one'}`);
  await B.context.close();
  }
  }

  // TODO 36 tier one — every declared spec point must BUILD. Runs after the
  // shards so it never competes with them for cores; the boots are ~15 s each
  // and concurrent (?trial=1 pages share no state), so the whole set costs a
  // fraction of one sweep. A point that WARNS passes and its count is data;
  // only a point that fails to produce a __clock is a failure.
  console.log(`spec boots (${SPEC_POINTS.length} declared points)…`);
  const specT0 = Date.now();
  // A BOUNDED POOL, not Promise.all — §104's landing measured why. The old
  // "concurrent, ~15 s each" note assumed boots stayed cheap; unbounded, all
  // 26 points boot at once on the runner's 4 vCPUs and each boot's wall
  // stretches ~6×. That margin was real until boots grew: §104's alarm
  // set-up doubled the ribbon's wind frames (61 → 124 k-solves at boot),
  // and the two heaviest points — reserveh=48, the deepest fusee groove
  // stack — crossed BOOT_TIMEOUT_MS on CI (run #335: both DEAD, no page
  // errors, alive solo and alive locally). The pool pins per-boot
  // contention to the SHARDS rationale above (4 vCPU, single-threaded
  // pages): 4 concurrent boots keep each boot's wall within ~2× of solo,
  // so the 120 s timeout keeps its honest meaning — "one roughly
  // uncontended boot must build" — instead of being widened to cover a
  // pile-up the harness itself created. Wall for the tier stays in the
  // same band (26 boots / 4 lanes vs 26-way thrash).
  const SPEC_BOOT_POOL = 4;
  const specRows = new Array(SPEC_POINTS.length);
  {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(SPEC_BOOT_POOL, SPEC_POINTS.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= SPEC_POINTS.length) return;
        const pt = SPEC_POINTS[i];
        const r = await specBoot(browser, base, pt.q);
        specRows[i] = { ...pt, ...r };
      }
    }));
  }
  for (const r of specRows) {
    const how = r.alive ? (r.warns.length ? `builds, ${r.warns.length} warn(s)` : 'builds, silent')
      : r.wedged ? 'WEDGED' : 'DEAD';
    console.log(`  ${r.alive ? '·' : '✗'} ${r.name.padEnd(16)} ${how}`);
  }
  // The failure list is liveness only. The control is held tighter — identity
  // warning would mean the trial harness itself is lying, since every gate
  // above boots that same spec and found it silent.
  gate('spec boots: every declared spec point builds',
    specRows.filter((r) => !r.alive).map((r) => ({
      spec: r.name, why: r.why, outcome: r.wedged ? 'wedged' : 'never produced a __clock',
      fatal: r.fatal ? r.fatal.message : null,
      warnsBeforeDeath: r.warns ? r.warns.length : 'none recorded (main.js did not reach its first lines)',
      pageErrors: r.errors.slice(0, 3),
    })),
    `${specRows.filter((r) => r.alive).length}/${specRows.length} build`
    + `, ${specRows.filter((r) => r.alive && r.warns.length).length} of them with warnings (expected — a moved station warns)`
    + ` · ${secs(Date.now() - specT0)}`);
  gate('spec boots: the identity control is silent',
    specRows.filter((r) => r.expect === 'silent' && (!r.alive || r.warns.length))
      .map((r) => ({ spec: r.name, warns: r.warns, note: 'the default spec is what every other gate boots — if it warns here, the trial path differs from the real one' })));

  // ---- §95 tier two: the SKIP LIST is held true --------------------------
  //
  // battery.yml skips this whole job when every changed file matches its
  // `paths-ignore` list, and every entry on that list makes one claim: "the
  // battery cannot see this file." Until now that claim was kept by reading —
  // and it is the one claim in the repo whose failure is silent by
  // construction, because a wrong entry disarms the gate on exactly the change
  // that needed it, and no run happens to say so.
  //
  // So: walk index.html's transitive module graph and fail if anything the
  // list ignores is ON it. The near miss this exists for is one character
  // wide — `src/*i18n*.js` is the obvious glob for the two pages' tables and
  // it also matches `src/i18n.js`, which src/main.js imports.
  //
  // Reading the list from the YAML rather than restating it here is the whole
  // point: a copy would be a second list someone keeps in step, which is the
  // failure tools/payload.sh's header already names.
  //
  // It is safe to run in-process and costs milliseconds, and it belongs HERE
  // rather than in its own workflow because editing the list touches
  // .github/workflows/**, which the list deliberately does not ignore — so the
  // change that could break this always runs the job that checks it.
  {
    const ymlPath = join(ROOT, '.github/workflows/battery.yml');
    const yml = existsSync(ymlPath) ? readFileSync(ymlPath, 'utf8') : null;
    const block = yml && yml.match(/paths-ignore:\n((?:\s*-\s*'[^']*'\n)+)/);
    const ignored = block ? [...block[1].matchAll(/-\s*'([^']*)'/g)].map((m) => m[1]) : [];
    // READING NOTHING MUST NOT READ AS PASSING. A regex that stops matching —
    // the list reformatted, quotes changed, the key renamed — yields an empty
    // list, and an empty list trivially intersects nothing. That is the failure
    // mode of every instrument that asserts an empty set, and the fix is to
    // check that the instrument SAW something before believing what it says.
    const unreadable = ignored.length === 0
      ? [{ file: '.github/workflows/battery.yml',
        why: yml === null ? 'not found from the harness ROOT'
          : 'its paths-ignore list did not parse — this check would then compare against nothing and pass for that reason alone' }]
      : [];
    // Reachability: the documents' own entry points, then every relative
    // import and dynamic import(), to a fixed point. Same shape as the walk
    // stamp-release.mjs does, and deliberately static — a module that never
    // loads cannot be observed from a boot.
    const graph = new Set();
    const queue = [];
    for (const m of readFileSync(join(ROOT, 'index.html'), 'utf8').matchAll(/["'](\.\/(?:src|vendor)\/[^"'?]+)["']/g))
      queue.push(m[1].slice(2));
    while (queue.length) {
      const f = queue.shift();
      if (graph.has(f) || !existsSync(join(ROOT, f))) continue;
      graph.add(f);
      if (!f.endsWith('.js')) continue;
      const src = readFileSync(join(ROOT, f), 'utf8');
      for (const m of src.matchAll(/\bfrom\s+['"](\.\.?\/[^'"?]+)['"]|\bimport\(\s*['"](\.\.?\/[^'"?]+)['"]/g))
        queue.push(posix.normalize(posix.join(posix.dirname(f), m[1] || m[2])));
    }
    // Minimal glob, scanned rather than chain-replaced (a sentinel pass is
    // how you get a pattern that eats its own placeholder): ** spans
    // separators, * does not — so 'src/*-i18n*.js' cannot silently reach into
    // a subdirectory, while '**/*.md' matches a doc at any depth.
    const matches = (pattern, file) => {
      let re = '';
      for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === '*' && pattern[i + 1] === '*') {
          if (pattern[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
        } else if (pattern[i] === '*') {
          re += '[^/]*';
        } else {
          re += pattern[i].replace(/[.+^${}()|[\]\\?]/, '\\$&');
        }
      }
      return new RegExp(`^${re}$`).test(file);
    };
    gate('battery.yml: nothing it skips is on index.html\'s module graph',
      [...unreadable, ...ignored.flatMap((pattern) => [...graph]
        .filter((f) => matches(pattern, f))
        .map((f) => ({
          pattern, file: f,
          why: 'battery.yml would skip the whole job for a change to this file, and the battery LOADS it',
        })))],
      `${ignored.length} ignore patterns vs ${graph.size} files reachable from index.html`);
  }

  const failed = gates.filter((g) => !g.pass);
  const totalMs = Date.now() - t0;
  console.log(`\n${gates.length - failed.length}/${gates.length} gates pass · total ${secs(totalMs)}`
    + ` (checks ${secs(checkMs)} across ${shards.length} shard(s))`);

  if (REPORT_PATH) {
    // Sorted keys and 2-space JSON so two runs diff line-for-line. `ms` is
    // here to refresh the cost column and is the ONE field expected to move
    // between runs — diff with it filtered out when comparing reports.
    const report = {
      fingerprint: fpA,
      checks: Object.fromEntries(BATTERY.map(({ name }) =>
        [name, results.has(name)
          // §127 — `sliceMs` appears only on a SPLIT run of a split check, and
          // it is what refreshes INSPECTION_SLICES' seed projections. Keeping
          // it off an unsliced run's report means `--no-split` still diffs
          // clean against a pre-§127 baseline, which is how the split was
          // accepted in the first place.
          ? { ms: results.get(name).ms, ...(sliceMs.has(name) ? { sliceMs: sliceMs.get(name) } : {}), result: results.get(name).result }
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
