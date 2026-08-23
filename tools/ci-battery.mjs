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
//   unit digests the same anchor for §152's per-unit key, when one was asked
//                for: if two virgin boots disagree about a unit's digest, a
//                digest difference does not mean the geometry moved and every
//                skip taken on that reading is unfounded.
//
// WHAT A CHECK COMPUTES IS NOT IN THIS FILE (§152). BATTERY, the in-page
// start/status protocol, the virgin boot a payload is measured on and the
// sweep hold that page is held under all live in tools/battery-checks.mjs,
// which is DIGESTED: an incremental run may inherit a stored row only when
// the code that produced it is unchanged. Everything here runs fresh every
// run — the partition, the cost column, the spec boots, the anchors, the
// logging — and so cannot stale a stored row. That boundary, and what it was
// measured against, is argued in battery-checks.mjs's own header.
//
// Usage:  node tools/ci-battery.mjs            (from anywhere; paths are
//         resolved from this file). Needs python3 on PATH for dev_server.py
//         and a Playwright Chromium (npx playwright install chromium).
//         --shards N        run the battery across N browser contexts,
//                           partitioned by the measured COSTS column below
//                           (default 3; 1 is the pre-§81 single-file run).
//         --report FILE     write every check's FULL payload as JSON — the
//                           "same rows, same numbers" instrument §80 and §81
//                           are both accepted against.
//         --no-split        run each divisible check whole instead of as
//                           per-axis tasks (§127). The reference the split
//                           has to agree with, kept for the same reason
//                           `--shards 1` is.
//         --digests FILE    write this tree's per-unit key (§152)
//         --digests-base FILE  the key of the tree this one is judged against
//         --baseline FILE   that tree's --report, whose rows a restricted run
//                           inherits for the pairs nobody touched
//         --no-incremental  run everything whatever the digests say — the
//                           reference an incremental run must agree with
//         --matrix i/N --tasks-out FILE   (§127 tier 3) run worker i of N:
//                           the BROWSER half only, for the global shards this
//                           worker owns, written to FILE. Evaluates no gates
//                           and writes no report.
//         --collect FILE…   the ASSEMBLY half over those files — the same
//                           gates in the same order, and --report. Launches
//                           no browser.
//         --only NAME[,NAME]  a probe/iteration flag CI never passes: narrow
//                           the run to these checks (or `check:axis` slices)
//                           so the assembly half is exercisable in minutes.
// Exits 0 only when every gate passes; failing gates dump their payloads.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { assertCosts, buildTasks } from './battery-split.mjs';
import { BATTERY, RESTRICTABLE, prepPage, runCheck, virginBoot } from './battery-checks.mjs';
import { unionCheck } from './battery-union.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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

// §81 — THE MEASURED COST COLUMN, AND WHY IT IS DATA. The harness shards the
// battery across K browser contexts and partitions the tasks by these numbers
// (longest-processing-time greedy, below), so the wall is max(shard) instead
// of sum(checks). A partition written as code would have to be re-argued every
// time a check gets faster; a partition computed from a measured column is
// re-derived by editing the column. `--report` writes the same numbers back
// out as `ms` — and `sliceMs` for a split check — which is how they get
// refreshed. They are used ONLY to balance the shards: a stale number costs
// wall clock, never a wrong verdict.
//
// TWO UNITS, ON PURPOSE, because both halves are refreshed from `--report`
// fields that carry them: a CHECK's cost is its wall in SECONDS, a SLICE's is
// the axis's wall in MILLISECONDS (keyed `check:axis`). buildTasks divides the
// slice rows by 1000; nothing else reads either.
//
// §152 MOVED THEM OUT OF THE CHECK TABLES. Refreshing this column is the most
// routine harness edit there is, and both battery-checks.mjs and
// battery-split.mjs are CHECK_CODE_FILES — the digest that decides whether a
// stored verdict may be inherited. A cost is wall clock and no check can read
// one, so a refresh must not void a single stored row. This file is not
// digested, which is what makes that true.
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
// them (two runs of one tree: 4082.8 s and 2459.1 s of check time). §81 wrote
// that this "does not matter here — the partition is decided by RATIOS between
// checks, which are stable".
//
// §127 MEASURED THAT CLAIM AND IT IS FALSE. The first CI run of the split
// harness put every task's CI time against this column: the ratio spreads
// 1.14x (`inspection:alarmWind`) to 2.69x (`inspection:beat`) — a 2.4x spread
// in the RATIO, not in the absolute times. `expectedContacts` runs 2.14x and
// `sweptOverlap` 1.31x, so their relative order is not the same on the two
// machines. The cause is not mysterious: these checks are not one workload,
// they are BVH tri-tri work, raycast arbitration and matrix walks in different
// mixtures, and a runner's cache and clock do not scale those alike.
//
// The consequence is bounded and worth stating rather than fixing blind: that
// CI run's partition landed 1329.4 s against an ideal 3-way split of 1209.3 s,
// 9.9% over. That is wall clock, never a verdict (the rule above), and it is
// an argument for MORE, SMALLER tasks rather than for a CI-derived column —
// a column measured on one runner is just as wrong on the next one, and finer
// tasks make any single mis-estimate cost less.
//
// The per-slice seed projection for an axis that has never been measured is
// buildTasks' business, and the first sliced run showed how rough a proxy it
// is: the projection erred -25% (`wind`) to +44% (`alarmWind`), and it
// mis-ranked the column — `wind` projected at 349.1 s and measured 261.7 s,
// `train` projected 47.0 s and measured 66.6 s. Per-pose cost is dominated by
// how many pair candidates survive the broad phase at that pose, which varies
// by axis and is not a function of pose count. An axis added later gets the
// same rough seed and the same correction on its first sliced `--report`; what
// the pair does NOT let anyone do is quietly keep a projection while believing
// it was measured.
const COSTS = {
  'support': 15,
  'graph': 1,
  'axisEntry': 2,
  // §111 raised this from 17 (the governor row's 449 phases); §113's stubby
  // pallets halved the row's mesh work — measured 21 s.
  'penetration': 18,
  'alarmHandoffs': 1,
  'windArrestHandoff': 1,
  'stemClutchHandoff': 1,
  'stockFloor': 6,
  // §54's own record in docs/BUILT.md measured this check at 4 ms over 454
  // meshes — one computeBoundingBox per mesh, no swept registry, no BVH, no
  // pose sweep. TODO 78's bearing walk adds a handful of Box3.setFromObject
  // calls inside one unit. 1 is this column's floor for sub-second checks;
  // --report refreshes it like every row.
  'slenderness': 1,
  'meshIntegrity': 10,
  'intraUnit': 6,
  'assembly': 4,
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
  'expectedContacts': 389,
  'oscillator': 1,
  // §104 — the cost moved 1 → 14: the alarm half's endpoint rows STEP the
  // shipped tick law (120 ticks at two winds), which is the row's whole
  // point; a stale 1 here costs wall clock, never a verdict.
  'equalisation': 16,
  'chainLength': 1,
  'restoring': 3,
  'inspection': 762,
  'clearances': 545,
  'sweptOverlap': 260,

  // §127 — the per-axis walls of the one split check, in MILLISECONDS
  // (`--report`'s `sliceMs`). A slice with no row here is projected from its
  // pose count and labelled `projected` until a sliced run measures it.
  'inspection:beat': 54109,
  'inspection:crown': 24335,
  'inspection:reserve': 22954,
  'inspection:wind': 261735,
  // TODO 71 — seeded from stemSlip's measured cost (same n, and nearly every
  // pose rebuilds the chain); --report refreshes it like every row.
  'inspection:arrest': 55000,
  'inspection:train': 66580,
  'inspection:jumperEngage': 70719,
  'inspection:handSet': 65625,
  'inspection:alarm': 55597,
  'inspection:alarmStrike': 59415,
  'inspection:alarmWind': 76736,
  'inspection:alarmToggle': 32844,
  // TODO 50 — measured on a dev container battery run.
  'inspection:stemSlip': 55000,
};

// DECLARED HERE, ASSERTED AGAINST THE BATTERY IT DESCRIBES — both ways, and it
// throws. The column and the checks are two lists someone keeps in step now
// that they live in different files, so the drift tools/payload.sh's header
// names is live here: a check with no cost would leave `partition` balancing on
// `undefined` (the `resolveAxes` precedent — a mistake that matches nothing
// must not pass for a clean answer), and a cost naming no check is a row
// refreshed forever against nothing. assertCosts owns the argument in full.
assertCosts(BATTERY, COSTS);

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
// Default 3 since §127 — and it was briefly 4, which is worth keeping because
// the revert is the more useful measurement.
//
// The fourth shard was taken on a controlled A/B on one dev container, K=3 then
// K=4, same tree: wall 846.9 s → 740.5 s (−12.6%) for check time 2083.1 s →
// 2338.6 s (+12.3%). A real trade — buy wall with CPU — and CI bills wall.
//
// ON UBUNTU-LATEST THE SAME TRADE LOSES, MEASURED:
//
//   K=3, run 1   1474.8 s wall   3627.9 s checks
//   K=3, run 2   1483.7 s wall   3695.6 s checks
//   K=4          1515.2 s wall   4713.1 s checks
//
// Contention there is +28.7% against the K=3 mean, more than DOUBLE the
// +12.3% the dev container showed, and it consumes the whole gain: the wall
// comes out +2.4% WORSE while burning ~1000 s more CPU. Four single-threaded
// pages plus this harness, dev_server.py and SwiftShader's software rasteriser
// do not fit on that runner's four vCPU the way they fit on a dev container's.
//
// THE LESSON IS THE SAME ONE THE COST COLUMN LEARNED, and it is why both are
// written down instead of quietly corrected: a coefficient measured on one
// machine does not transfer to another. The column's per-check RATIOS spread
// 1.14x–2.69x between these two machines; the contention coefficient differs
// by 2.3x between them. A local A/B can say a partition change is SOUND. It
// cannot say what it is WORTH on the runner, and this one predicted the wrong
// sign.
//
// K=5 is refused by arithmetic and would be regardless: the largest single
// task (`clearances`) is 552.6 s against an ideal 4-way split of 584.7 s, so
// another shard cannot go below the task it cannot subdivide. The way past K=3
// is not more shards — it is slicing `clearances`, which is roadmap §127's
// remainder.
//
// A shard count is not a guard: like the cost column, a wrong one costs wall
// clock and never a verdict, which is why measurement may move it freely and
// is deliberately NOT enough to move CHECK_TIMEOUT_MS above.
// `--shards 1` is the pre-§81 single-file run, kept because it is the
// reference the sharded run has to agree with — and the report is now known
// identical at 1, 2, 3 and 4.
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

// §127 tier 3 — THE SAME RUN ACROSS PROCESSES.
//
// The seam is where `shardOut` is produced: everything above it is browser
// work, everything below is assembly over payloads whose ORIGIN is irrelevant.
// `--matrix i/N --tasks-out FILE` runs the browser half for one worker and
// writes what it measured; `--collect FILE…` runs the assembly half over the
// workers' files and is the only side that gates. The single-process path is
// untouched and stays the reference, exactly as `--shards 1` and `--no-split`
// are: a run with neither flag must report byte for byte what it reports today.
//
// NO COORDINATION, and that is the whole reason this can be a matrix at all:
// `buildTasks` and `partition` are pure functions of in-repo data, so every
// worker derives the IDENTICAL global partition from nothing but the tree.
// Worker i runs global shards [i*SHARDS, (i+1)*SHARDS) of
// partition(tasks, N*SHARDS) — an ownership rule with no message passing in it,
// which is what lets the collector name work that never arrived.
//
// Landing A is the harness change and its local proof. No workflow change, no
// matrix in CI, and no claim about wall clock — that is Landing B's, measured
// on the runner, because BUILT §127's K=4 revert is the worked example of a
// dev container predicting the wrong sign.
const MATRIX = (() => {
  const raw = argOf('--matrix');
  if (raw === null) return null;
  // Parsed as strictly as `--shards` is, and for a sharper version of the same
  // reason: `--matrix 1/tow` silently running worker 0 would produce a green
  // report of half the battery, which is this landing's whole hazard.
  const m = /^(\d+)\/(\d+)$/.exec(String(raw).trim());
  if (!m) throw new Error(`--matrix wants i/N, got "${raw}"`);
  const i = Number(m[1]);
  const n = Number(m[2]);
  if (n < 1) throw new Error(`--matrix ${raw}: N must be at least 1`);
  if (i >= n) throw new Error(`--matrix ${raw}: worker index must be 0 ≤ i < N`);
  return { i, n };
})();
const TASKS_OUT = argOf('--tasks-out');
// Variadic: every argument up to the next flag. An empty list is refused for
// readJsonOr's reason turned inside out — a collector with nothing to collect
// would assemble an empty battery and report it as a clean one.
const COLLECT = (() => {
  const at = argv.indexOf('--collect');
  if (at === -1) return null;
  const files = [];
  for (let i = at + 1; i < argv.length && !argv[i].startsWith('--'); i++) files.push(argv[i]);
  if (!files.length) throw new Error('--collect wants at least one worker file');
  return files;
})();
// A PROBE AND ITERATION FLAG, and CI never passes it: it narrows the run to the
// named checks (or the named `check:axis` slices) so the ASSEMBLY half can be
// exercised end to end in minutes instead of an hour. It is not a second gate
// and it is not a way to land less — every gate a narrowed run evaluates is
// evaluated over what it actually ran, and a full run is what standing rule 4
// names. Unknown names THROW, the `resolveAxes` / `pairsTouching` discipline: a
// name that matches nothing would otherwise report a green battery of no work.
//
// The spec-boot tier is narrowed with it, to its own identity control. The tier
// is 26 boots and none of them is a check, so keeping all of them would dominate
// the wall of a run whose point is the merge — and dropping the tier entirely
// would take its two gates out of the path the probe is proving.
const ONLY = (() => {
  const raw = argOf('--only');
  if (raw === null) return null;
  const keys = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  if (!keys.length) throw new Error('--only wants at least one check or slice key');
  // The legal key space is exactly COSTS' — a check, or a slice of one.
  const legal = new Set();
  for (const e of BATTERY) {
    legal.add(e.name);
    for (const s of e.slices ?? []) legal.add(`${e.name}:${s.axis}`);
  }
  const unknown = keys.filter((k) => !legal.has(k));
  if (unknown.length) throw new Error(`--only names ${unknown.join(', ')}, which is no check and no slice of one`);
  if (!SPLIT && keys.some((k) => k.includes(':'))) {
    throw new Error('--only names a slice under --no-split, which runs the whole check — say the check instead');
  }
  return new Set(keys);
})();

// The flag combinations that cannot mean anything, refused rather than
// resolved: every one of them would run or report something OTHER than what
// was asked for, which is the failure this landing exists to make impossible.
if (MATRIX && !TASKS_OUT) throw new Error('--matrix wants --tasks-out FILE to write what it measured');
if (TASKS_OUT && !MATRIX) throw new Error('--tasks-out is what a --matrix worker writes; there is no worker here');
if (MATRIX && COLLECT) throw new Error('--matrix runs the browser half and --collect the assembly half; run them separately');
if (MATRIX && REPORT_PATH) throw new Error('a worker evaluates no gates, so it has no report to write — pass --report to the --collect');
if ((MATRIX || COLLECT) && SPEC_ONLY) throw new Error('--spec-only is one process\'s worth of work; there is nothing to distribute');
// The collector takes the run's SHAPE from the worker files, because that is
// the only source that can be right about what was supposed to run. A shape
// flag on this side could disagree with the workers, and a collector that
// disagrees with its workers about the task list is the one thing that must
// never be resolved silently.
if (COLLECT) {
  for (const flag of ['--digests', '--digests-base']) {
    if (argOf(flag) !== null) throw new Error(`${flag} is the §152 preflight's, which runs in each worker`);
  }
  for (const flag of ['--shards', '--only']) {
    if (argOf(flag) !== null) throw new Error(`${flag} describes what the WORKERS ran; --collect reads it from their files`);
  }
  if (!SPLIT) throw new Error('--no-split describes what the WORKERS ran; --collect reads it from their files');
}

// `--only` applied to the battery table. A bare check name takes the whole
// check (every slice it declares); a `check:axis` key takes that slice alone,
// and the entry's slice list is narrowed WITH it — the "declared slices are
// the page's axes" gate compares the two lists, so narrowing one and not the
// other would report the flag's own selection as an axis nobody swept.
//
// The roster gate below deliberately keeps reading the WHOLE table: "every
// check the page registers has a battery row" is a claim about the declared
// battery, not about what this invocation chose to run.
function selectBattery(entries, only) {
  if (!only) return entries;
  const out = [];
  for (const e of entries) {
    const whole = only.has(e.name);
    const slices = e.slices?.filter((s) => whole || only.has(`${e.name}:${s.axis}`));
    if (!whole && !slices?.length) continue;
    out.push(e.slices ? { ...e, slices } : e);
  }
  return out;
}
// The axes a narrowed run covers — the roster its slice gates and merges are
// held against. null (the whole page's roster) whenever `--only` is absent.
function selectedAxes(entries, only) {
  if (!only) return null;
  return new Set(entries.flatMap((e) => (e.slices ?? []).map((s) => s.axis)));
}

// §152 — THE INCREMENTAL INPUTS AND OUTPUTS.
//
// The prize is not making a check faster; it is not running one that provably
// cannot change its answer. A pair sweep's verdict is f(geometry, pose net,
// check code), so a run that can show all three unchanged since a run that
// already passed may inherit that run's verdict for the pairs involved.
//
//   --digests FILE        write this tree's per-unit key (inspect.js's
//                         unitDigests) plus the CHECK-CODE digest below
//   --digests-base FILE   the same file from the tree this one is judged
//                         against — normally the merge base's, restored from
//                         the cache battery.yml writes on every push to main
//   --baseline FILE       that tree's --report. The restricted run inherits
//                         its rows for the pairs nobody touched, so the gate
//                         is still evaluated over the WHOLE movement
//   --no-incremental      run everything, whatever the digests say. The
//                         reference the incremental run has to agree with,
//                         kept for the reason `--shards 1` and `--no-split`
//                         are kept
//
// INCREMENTAL ENGAGES ONLY when all three of --digests-base, --baseline and a
// matching check-code digest are present. Anything missing, unreadable or
// moved falls back to a FULL run and SAYS SO: the failure mode this feature
// can have is a stale green, so every uncertainty resolves towards more work
// rather than less. That is check-shipped-list.mjs's split between "a finding"
// and "nothing could be read", applied to a gate instead of a report.
const DIGESTS_OUT = argOf('--digests');
const DIGESTS_BASE = argOf('--digests-base');
const BASELINE_PATH = argOf('--baseline');
const NO_INCREMENTAL = argv.includes('--no-incremental');

// The third argument of the verdict, and the one the scene cannot carry.
//
// The per-unit key is measured FROM THE BUILT ARTIFACT, so it covers
// layout.js's derived constants, src/aesthetics.json, a vendored tessellation
// change and a builder edit anywhere in main.js without naming one of them —
// the paths-ignore lesson applied rather than repeated. What it cannot cover
// is the code doing the checking, and AXES (the pose net) lives in inspect.js,
// so one file carries both.
//
// The rule is therefore blunt and total: any difference in these files runs
// the whole battery. Measured cost of the bluntness against the PRE-SPLIT list
// (inspect.js and the whole harness), over 80 first-parent merges: 56% of them
// touch one of those, so the incremental path was available on 30%. Most of
// the residue is inspect.js's, and it does not move here — the split below
// recovers the 6 harness-only merges and nothing more, measured by
// tools/probe-152-fresh.mjs. The cause is structural rather than incidental —
// standing rule 3 sends every new part's declaration into inspect.js, which is
// also where the sweep engines live — and splitting the declaration tables out
// is the only thing that moves that number (roadmap §152's Landing 4, gated on
// its own measurement).
//
// WHICH FILES BELONG ON THE LIST IS ITSELF A CLAIM, and the claim is narrower
// than "the harness": a stored row may be inherited only when the code that
// PRODUCED it is unchanged, so what has to be digested is
// inheritable-payload-producing code. Code that runs fresh every run cannot
// stale a stored row, because nothing it produces is ever stored. Measured
// over 84 first-parent merges, 6 touch the harness without also touching
// inspect.js — five SPEC_POINTS additions and one paths-ignore gate, every one
// of them fresh-side, every one voiding the key for nothing.
//
// So the list is the digested pair (battery-checks.mjs holds what a check
// computes, battery-split.mjs the slice facts and the merge that reassembles
// them), battery-union.mjs — which SHAPES the merged payload every gate then
// reads, and was missing from this list from the start — and inspect.js, which
// carries the engines and the pose net both. ci-battery.mjs is deliberately
// absent: everything left in it runs fresh. tools/probe-152-fresh.mjs is the
// instrument for that split, and it induces both halves rather than asserting
// them.
const CHECK_CODE_FILES = ['src/inspect.js', 'tools/battery-checks.mjs',
  'tools/battery-split.mjs', 'tools/battery-union.mjs'];
function checkCodeDigest() {
  const out = {};
  for (const f of CHECK_CODE_FILES) {
    out[f] = createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex');
  }
  return out;
}

// §152 — THE SHAPE OF WHAT IS WRITTEN, stamped on both artifacts this harness
// produces and checked on both it reads.
//
// The residual hazard the digest above cannot cover: the report WRITER is
// fresh-side, and correctly so — it produces nothing a later run inherits as a
// verdict. But the FILE it writes is read back by the next run's union, which
// does read it as one. So a writer that changes the report's shape cannot void
// the check-code key, and must not silently hand the union a payload shaped
// like something else. This version field is what closes that class instead:
// bump it whenever the report or digests object changes shape, and every
// artifact written under an older shape falls out of the incremental path
// rather than being read as if it matched.
//
// 1 is the implicit unversioned format every artifact written before §152's
// third landing carries — which is why an ABSENT field counts as a mismatch
// rather than as a pass.
const REPORT_FORMAT_VERSION = 2;

// Read a JSON side-input. Returns null and says why rather than throwing: a
// missing baseline is the ordinary case on the first PR after this lands, and
// it must cost a full run rather than a crash.
function readJsonOr(path, what) {
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (err) {
    console.log(`  ${what}: unreadable (${err.message}) — falling back to a FULL run`);
    return null;
  }
}

// readJsonOr's convention applied to the shape rather than the bytes: an
// artifact this harness cannot read AS THE FORMAT IT EXPECTS is not an
// artifact it may inherit from, and every uncertainty resolves towards more
// work and says so.
function atReportFormat(obj, what) {
  if (!obj) return null;
  if (obj.formatVersion !== REPORT_FORMAT_VERSION) {
    console.log(`  ${what}: format v${obj.formatVersion ?? 'unversioned'} against this harness's `
      + `v${REPORT_FORMAT_VERSION} — falling back to a FULL run`);
    return null;
  }
  return obj;
}

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
  // §94 tier A — the small-seconds station, re-measured for the §125
  // margins tweak (the DEFAULT is 18.7778 now — the well-maximizing
  // station under the furniture law):
  //   · 20 is an OUTWARD point in the |K| band and warns once — stop
  //     work's mast against the cock height, the wall §125 measured at
  //     20–21 both before and after the frame program (non-monotonic:
  //     20 warns, 22.9 is silent — declared points, never a range);
  //   · 22.9 is the Tier B ceiling default, kept as a measured-silent
  //     point: the frame program's negotiations re-solve there and the
  //     plate stays flat, which is what lets ?d4= walk the whole band;
  //   · 16 is inside the [16, 17] window where solveKeyless reports the
  //     side sign nearly degenerate (balance −0.48 off the stem line),
  //     one warn, measured;
  //   · 24 is past the two-bar's closure window (1.95 ≤ d4 ≤ 23.55). It
  //     must BOOT — the solve reports the refusal and keeps D4 rather than
  //     handing the build a NaN layout — the guard on that fallback.
  { name: 'd4=20', q: 'd4=20', expect: 'any', why: '§125 — an outward station in the |K| band: stop work warns once, measured' },
  { name: 'd4=22.9', q: 'd4=22.9', expect: 'any', why: '§125 — the Tier B ceiling, measured silent: the frame program re-solves across the band' },
  { name: 'd4=16', q: 'd4=16', expect: 'any', why: '§94 tier A — inside the keyless side-sign window: this point is EXPECTED to warn' },
  { name: 'd4=24', q: 'd4=24', expect: 'any', why: '§94 tier A — past the two-bar closure: must fall back to D4 and warn, never NaN' },
  // §94 tier C — the reserve station. Four points, each measured on this
  // tree before it was written down:
  //   · 20 is the OUTWARD point, and it boots silent;
  //   · 8 is inside the window and EXPECTED to warn — four now, measured
  //     for §125 Tier B (the well follows its own station, so a shrunken
  //     station means a shrunken well twice over): w2's tip against the
  //     centre keep-out AND against its own well wall, §34's selector post
  //     fouling the moved 12-well ring (−0.27 vs 0.15), and the alarm
  //     setting bearing re-sweeping off its incumbent;
  //   · 30 is past the well window (3.55, 23.24] — §125 Tier B's one
  //     closed form, station ≤ (dialRadius + keep-out)/2, since the well
  //     rides its own station. It must BOOT — an off-face well is
  //     nonsense, not NaN: solveKeyless warns with the window, builds,
  //     and the battery judges the result;
  //   · reserveh=48&rsvr=27 was the JOINT tip-vs-well case; Tier B's
  //     per-station well swallowed that threshold (at 27 the well is
  //     23.45 and the 32 t tip fits it easily), and 27 now sits past the
  //     23.24 window instead — the row stays as the measured record of
  //     the two keys composing (the 48 h fusee warn + the window warn).
  { name: 'rsvr=20', q: 'rsvr=20', expect: 'any', why: '§94 tier C — the reserve station moved out; measured silent on this tree' },
  { name: 'rsvr=8', q: 'rsvr=8', expect: 'any', why: '§94 tier C — inside the window, EXPECTED to warn: w2 tip twice, §34 post, alarm bearing re-sweep (4, measured)' },
  { name: 'rsvr=30', q: 'rsvr=30', expect: 'any', why: '§94 tier C — past the well window: must warn and BOOT (an off-face well is nonsense, not NaN)' },
  { name: 'reserveh=48&rsvr=27', q: 'reserveh=48&rsvr=27', expect: 'any', why: '§94 tier C/§125 Tier B — two keys composing: the 48 h fusee warn rides the station\'s window refusal (2, measured)' },
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
  // §97/§125 Tier B — the SECONDS well's radius (the wells split; this key
  // stopped reaching the reserve). Three points, re-measured for Tier B:
  //   · 8 is the interior value and boots silent (the seconds well and its
  //     hand shrink together; the reserve side no longer moves at all);
  //   · 21 is over the derived ceiling (19.35, its station − keep-out): the
  //     solver warns and KEEPS the ceiling — a larger well breaches the
  //     centre bore, TODO 33's degeneracy, so this key clamps where rsvr
  //     builds-and-judges. (13, the old over-ceiling point, is INTERIOR
  //     now and boots silent — the ceiling moved with the station);
  //   · 1 is under the derived floor (1.40): the solver clamps to the
  //     floor and warns — one warn now, measured: the reserve train's tip
  //     check left this row when the key stopped reaching its well.
  { name: 'subdialr=8', q: 'subdialr=8', expect: 'any', why: '§97 — the seconds well resized inward; measured silent on this tree' },
  { name: 'subdialr=21', q: 'subdialr=21', expect: 'any', why: '§97/§125 Tier B — over the per-station ceiling: clamps to it and warns (TODO 33\'s degeneracy stays closed)' },
  { name: 'subdialr=1', q: 'subdialr=1', expect: 'any', why: '§97 — under the floor: clamps to it and warns (1, measured — the train\'s tip check left with the shared radius)' },
  // §125 — the dial's own radius, re-measured for Tier B: the wells' outer
  // edge moved to 42.25, so the spec's legal window is the narrow
  // [42.25, 44.27] between the big well and the alarm crown's metal.
  //   · 43 is the interior value now, and boots silent;
  //   · 20 is far inside the wells' outer edge: the solver warns with the
  //     window and BUILDS — rings off the face are nonsense, not NaN
  //     (30, the old silent point, warns the same way now — measured);
  //   · 47.22 is past the measured metal: the parse-time bracket, the
  //     §125 hand-stack assert (the bigger face's longer hands eat the
  //     alarm lane: 0.068 vs 0.15) and the rim assert all report — three
  //     instruments on one oversized face, measured.
  { name: 'dialr=43', q: 'dialr=43', expect: 'any', why: '§125 Tier B — the interior of the narrowed window; measured silent on this tree' },
  { name: 'dialr=20', q: 'dialr=20', expect: 'any', why: '§125 — inside the wells\' outer edge: must warn and BOOT (rings off the face are nonsense, not NaN)' },
  { name: 'dialr=47.22', q: 'dialr=47.22', expect: 'any', why: '§125 — past the metal: the spec bracket, the hand-stack assert and the rim assert all report (3, measured)' },
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

// ---- THE ASSEMBLY HALF -------------------------------------------------
//
// §127 tier 3 — everything from here to the report is arithmetic over payloads
// whose ORIGIN does not matter: the gates, the slice merge, §152's union, the
// spec-boot verdicts, the paths-ignore module-graph walk (pure Node — it reads
// the repo, never the page) and `--report`. One process computes those payloads
// itself; `--collect` reads them off disk. Both call THIS function, because a
// second copy of the gate loop is the two-lists drift tools/payload.sh's header
// names, one level up — the harness would then have two definitions of what
// standing rule 4 is.
//
// Everything it needs arrives as an argument. It reads no mutable module state
// — including its own `gates` list, which is local so that "what did this
// assembly decide" is the return value rather than a global someone else may
// already have written to.
function assemble({
  battery,          // the BATTERY rows this run evaluated (--only narrows it)
  results,          // Map: task key → { result, ms }; the merge writes check names in beside them
  shardRows,        // [{ shard, warns, error? }] tagged with GLOBAL shard index, in that order
  shardCount,       // how many shards the partition produced, whoever ran them
  expectedShards,   // [{ shard, keys }] a collector expects, or null in one process (see the gate)
  axisMeta, checkRoster,
  fpA, fpB, digestsB,
  spec,             // { rows, ms } from the spec-boot tier
  headDigests, restriction, baseline,
  split, specOnly,
  t0,
}) {
  const gates = [];
  const gate = (name, failures, note) => {
    const pass = failures.length === 0;
    gates.push({ name, pass, failures, note });
    console.log(`  gate ${pass ? 'PASS' : 'FAIL'}  ${name}${note ? `  (${note})` : ''}`);
    if (!pass) console.log(JSON.stringify(failures, null, 2));
  };

  let checkMs = 0;   // §127 — task time, summed before slices are merged (see below)
  const sliceMs = new Map();   // check name → { axis: ms }, for the cost column
  // Boot silence is gated on EVERY shard, not just the first: each is a real
  // virgin boot of the same tree, so a warning that only some boots produce is
  // a nondeterminism this gate should not be able to miss.
  if (!specOnly) {
  gate('boot silent (rule 6)', shardRows.flatMap((s) => s.warns.map((w) => ({ shard: s.shard, warn: w }))));
  gate('every shard completed', shardRows.flatMap((s) => (s.error ? [{ shard: s.shard, error: s.error }] : [])));

  // §127 tier 3 — AND ACROSS PROCESSES, A SHARD THAT NEVER ARRIVED IS SILENT.
  // In one process the shard list IS what ran, so there is nothing to compare
  // and this gate does not appear. A collector derives the same partition its
  // workers derived — both from in-repo data alone — so it knows the global
  // shard set by name, and a worker file that never arrives would otherwise
  // assemble into a clean report of less work. That is the shape this landing
  // exists to refuse, and it is the third floor of a discipline already built
  // twice below: §127's `every slice produced a payload`, the gate loop's
  // `neverRan` (which names the check rather than dying on undefined), and
  // §152's `every restricted check was unioned back` — the last of which exists
  // because mergeInspection dropped a restriction record once and a restricted
  // `inspection` gated green on 3 contacting pairs against a full run's 81.
  if (expectedShards) {
    const present = new Set(shardRows.map((s) => s.shard));
    gate('every expected shard was collected',
      expectedShards.filter((s) => !present.has(s.shard))
        .map((s) => ({ shardNeverCollected: s.shard, tasks: s.keys })),
      `${present.size}/${expectedShards.length} shards`);
  }

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
  // TODO 78 — THE ROSTER IS CLOSED. Twice a check has been written, exported
  // and never registered in inspect.js's CHECKS: §48's `restoring` (found by
  // TODO 29, after shipping unrun) and §54's `slenderness` (found by TODO 78,
  // after shipping unrun since §52 while its waiver table and three quoted λ
  // values accumulated in the source). Both times the symptom was the worst
  // one available — a green battery that had simply not run the instrument,
  // which is indistinguishable from coverage. Neither `paths-ignore` nor
  // assertCosts could see it: assertCosts holds BATTERY against COSTS, and a
  // check absent from BOTH is consistent with both.
  //
  // So: every check the PAGE registers must have a BATTERY row, except the
  // ones named here, each of which is not a gate for a stated reason. Read
  // from the page for §127's reason — a second declaration of the roster in
  // this file would be the thing that drifts. An empty roster fails too: it
  // intersects nothing and would otherwise pass for that reason alone, the
  // same hole the paths-ignore gate closes.
  //
  // Held against the WHOLE table, never `--only`'s selection: this is a claim
  // about the battery the repo declares, not about what one invocation chose
  // to run.
  const NOT_IN_BATTERY = new Map([
    ['freeAnnulus', 'a LAYOUT tool — it answers "where is there room", it does not judge'],
    ['sweptRegistry', 'the §36 registry other checks consume; sweptOverlap gates what it produces'],
    ['lowCorridor', 'a REPORT of the low band\'s occupancy, read while siting a part'],
    ['focused', 'the convenience entry point — it runs other checks over named units'],
  ]);
  {
    const inBattery = new Set(BATTERY.map((e) => e.name));
    const unrun = checkRoster.filter((n) => !inBattery.has(n) && !NOT_IN_BATTERY.has(n));
    const phantom = BATTERY.map((e) => e.name).filter((n) => !checkRoster.includes(n));
    const staleExcuse = [...NOT_IN_BATTERY.keys()].filter((n) => !checkRoster.includes(n));
    gate('every registered check has a battery row', [
      ...(checkRoster.length ? [] : [{ error: 'shard 0 never reported window.__I.CHECK_NAMES' }]),
      ...unrun.map((n) => ({ registeredButNeverRun: n })),
      ...phantom.map((n) => ({ batteryRowNamesNoCheck: n })),
      ...staleExcuse.map((n) => ({ excusedCheckNoLongerExists: n })),
    ]);
  }

  if (split) {
    const roster = axisMeta.map((a) => a.name);
    for (const e of battery) {
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

  if (fpA) console.log(`  fingerprint A: ${fpA.hash} (${fpA.units} units, ${fpA.poseCount} poses)`);

  // §152 — UNION BEFORE GATING. A restricted payload describes only the pairs
  // this tree moved; the gates' bar is the whole movement, so the baseline's
  // rows for the untouched pairs are merged back in first. Everything
  // downstream — the gates, the note lines, --report — then reads a payload
  // shaped exactly like a full run's, which is why nothing below this point
  // knows the run was restricted.
  //
  // A union that CANNOT be justified throws (see battery-union.mjs's
  // entitlement argument), and a throw here is a hard failure rather than a
  // fallback: by this point the sweeps have already run restricted, so there
  // is no full result to fall back TO, and reporting a partial payload as a
  // verdict is the one outcome this feature must never produce.
  if (restriction && baseline) {
    const changed = new Set(restriction);
    for (const name of RESTRICTABLE) {
      const got = results.get(name);
      if (!got || !got.result) continue;
      try {
        const merged = unionCheck(name, baseline.checks?.[name]?.result, got.result, changed);
        if (merged !== got.result) {
          results.set(name, { ...got, result: merged, unioned: true });
          console.log(`  ${name}: unioned with the baseline's untouched rows`);
        }
      } catch (err) {
        gate(`${name}: the restricted run unions with its baseline`, [{
          union: String(err.message),
          note: 'the sweeps already ran restricted, so this run cannot produce a whole-movement verdict — re-run with --no-incremental',
        }]);
      }
    }
    // AND EVERY ONE OF THEM MUST HAVE BEEN UNIONED. A restricted payload that
    // reaches a gate un-unioned gates on its own partial rows and PASSES,
    // which is the exact stale green this entry exists to make impossible —
    // and it is not hypothetical: mergeInspection dropped the restriction
    // record on its first outing, so a restricted `inspection` reported 3
    // contacting pairs against a full run's 81 and every gate went green.
    //
    // This is §127's "every slice must produce a payload before the merge
    // runs" at one level up: a check that was ASKED to restrict and cannot
    // show the union that puts it back together has not been checked.
    const notUnioned = [...RESTRICTABLE].filter((n) => results.get(n) && !results.get(n).unioned);
    gate('every restricted check was unioned back to a whole-movement payload',
      notUnioned.map((n) => ({ check: n,
        why: 'it ran restricted and no union was applied — its payload describes only the pairs it swept' })),
      `${RESTRICTABLE.size - notUnioned.length}/${RESTRICTABLE.size} unioned`);
  }

  // Gates are evaluated in canonical BATTERY order regardless of which shard
  // produced which result, so the log a human reads (and a report diff) does
  // not depend on the partition.
  for (const { name, gate: gateDesc, fails, note } of battery) {
    const got = results.get(name);
    // A shard that dies takes its remaining checks with it. Say which ones
    // rather than throwing on the first missing payload: a battery that
    // reports "sweptOverlap never ran" is diagnosable, and one that dies with
    // a TypeError reading `result` of undefined is not.
    // The two ways a payload can be absent are different findings, and a
    // diagnosable failure says which: in one process the shard died partway;
    // across processes the shard's worker never arrived at all (the gate above
    // names it). Same row, honest reason — the point of `neverRan` over a
    // TypeError on `undefined` is that it tells you where to look.
    if (!got) {
      gate(`${name}: ${gateDesc}`, [{ neverRan: name,
        reason: expectedShards ? 'no worker file carried the shard it was on' : 'its shard failed before reaching it' }]);
      continue;
    }
    gate(`${name}: ${gateDesc}`, fails(got.result), note?.(got.result));
  }

  // Determinism anchor: a SECOND virgin boot must reproduce the hash exactly.
  // Deliberately NOT sharded — its whole content is that two virgin contexts
  // of this tree agree, so it stays one boot after the shards have closed.
  gate('fingerprint deterministic across virgin boots',
    fpA && fpB && fpA.hash === fpB.hash && fpA.units === fpB.units ? [] : [{ bootA: fpA, bootB: fpB }],
    `hash ${fpA ? fpA.hash : 'shard 0 never reported one'}`);

  // §152 — THE SAME ANCHOR FOR THE KEY, and it is the property the whole
  // feature rests on: if two virgin boots of one tree do not produce the same
  // per-unit digest, then a digest difference does not mean the geometry
  // moved, and every skip taken on that reading is unfounded. It rides boot B
  // because that is already a second virgin context of this tree — the
  // fingerprint's own reason for being read there.
  //
  // It is also what makes §127 tier 3's independent preflights sound: every
  // worker boots its own tree and derives its own changed-unit set, and this
  // is the gate that says two virgin boots of one tree agree about the key.
  //
  // The gate names the ROWS that differ rather than the fact that they do:
  // a nondeterministic unit is a specific part with a specific cause (a lazily
  // re-tessellated mesh, an unseeded random, a pose-history leak resetInputs
  // does not cover), and the row is what points at it.
  if (headDigests) {
    const drift = Object.keys(headDigests.units).filter((n) => headDigests.units[n].key !== digestsB?.units[n]?.key);
    gate('unit digests deterministic across virgin boots',
      drift.map((n) => ({ unit: n, bootA: headDigests.units[n], bootB: digestsB?.units[n] ?? null })),
      `${headDigests.unitCount} units, ${headDigests.poseCount} poses, place quantum ${headDigests.placeQ}`);
  }
  }

  // The failure list is liveness only. The control is held tighter — identity
  // warning would mean the trial harness itself is lying, since every gate
  // above boots that same spec and found it silent.
  gate('spec boots: every declared spec point builds',
    spec.rows.filter((r) => !r.alive).map((r) => ({
      spec: r.name, why: r.why, outcome: r.wedged ? 'wedged' : 'never produced a __clock',
      fatal: r.fatal ? r.fatal.message : null,
      warnsBeforeDeath: r.warns ? r.warns.length : 'none recorded (main.js did not reach its first lines)',
      pageErrors: r.errors.slice(0, 3),
    })),
    `${spec.rows.filter((r) => r.alive).length}/${spec.rows.length} build`
    + `, ${spec.rows.filter((r) => r.alive && r.warns.length).length} of them with warnings (expected — a moved station warns)`
    + ` · ${secs(spec.ms)}`);
  gate('spec boots: the identity control is silent',
    spec.rows.filter((r) => r.expect === 'silent' && (!r.alive || r.warns.length))
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
  // change that could break this always runs the job that checks it. It reads
  // the repo and never the page, which is why it assembles with the rest of
  // this function rather than needing a browser (§127 tier 3).
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
    + ` (checks ${secs(checkMs)} across ${shardCount} shard(s))`);

  if (REPORT_PATH) {
    // Sorted keys and 2-space JSON so two runs diff line-for-line. `ms` is
    // here to refresh the cost column and is the ONE field expected to move
    // between runs — diff with it filtered out when comparing reports.
    const report = {
      formatVersion: REPORT_FORMAT_VERSION,
      fingerprint: fpA,
      // §152 — a report is a BASELINE for the next run, not only an artifact
      // to diff. It carries the key it was measured at and, when the run was
      // restricted, which units it was restricted to, so a reader can tell a
      // whole verdict from an inherited one without reading the log.
      ...(headDigests ? { digests: headDigests } : {}),
      ...(restriction ? { restrictedTo: restriction } : {}),
      // The WHOLE table, never `--only`'s selection: a row this run did not
      // run reads `neverRan`, which is what a narrowed run's report should say
      // about the rest of the battery rather than omitting it.
      checks: Object.fromEntries(BATTERY.map(({ name }) =>
        [name, results.has(name)
          // §127 — `sliceMs` appears only on a SPLIT run of a split check, and
          // it is what refreshes COSTS' `check:axis` rows. Keeping
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
  return gates;
}

// ---- THE BROWSER HALF ---------------------------------------------------

// One process's share of the global partition. `group` is [{ shard, index }]
// with the GLOBAL index, which is what every row it returns is tagged with:
// a worker's second shard is shard 4 of the run, and a boot warning filed
// under a local 1 would point at another worker's boot.
async function runShardGroup({ browser, base, group, shardCount, axisFilter, t0 }) {
  // Every shard is a VIRGIN boot running a subset of the battery, and that is
  // sound for exactly one reason, which is worth stating because the whole
  // tranche rests on it: `start()` in inspect.js calls `clock.resetInputs()`
  // before every check, so a check's result cannot depend on which checks ran
  // before it on that page. (It has to — some of what setPose writes is
  // CUMULATIVE, §80's finding at walkPoses.) Sharding therefore changes the
  // GROUPING of checks and nothing a check can observe. If a report ever
  // moves between `--shards 1` and `--shards 2`, that invariant has broken
  // and the check that moved is the bug, not the harness. §127 tier 3 spreads
  // the same grouping across PROCESSES, which a check can observe no better.
  const results = new Map();  // task key → { result, ms } — merged to check name in the assembly
  const axisMeta = [];        // §127 — window.__I.AXES as the page reports it, read once
  const checkRoster = [];     // TODO 78 — window.__I.CHECK_NAMES, likewise: the page's roster, not this file's
  let fpA = null;
  // Per PROCESS, which is all it has to be: a worker owns its own dev server
  // and its own TMPDIR, so the /__state file two shards would race over is not
  // shared with any other worker.
  const bootInTurn = serialiser();
  // Each shard catches its own failure instead of rejecting: one shard dying
  // must not throw away what the others measured, because the surviving
  // reports are how you tell a broken harness from a broken build.
  const shardRows = await Promise.all(group.map(async ({ shard, index }) => {
    const tag = shardCount > 1 ? `[shard ${index}] ` : '';
    let context = null;
    try {
      const boot = await bootInTurn(async () => {
        console.log(`${tag}boot (virgin)…`);
        const p = await virginBoot(browser, base, BOOT_TIMEOUT_MS);
        console.log(`${tag}  __clock up at ${secs(Date.now() - t0)}`);
        return p;
      });
      context = boot.context;
      const page = boot.page;
      const warns = await prepPage(page);
      // §127 — the axis roster, from the page rather than from this file's
      // declaration of it. Read on shard 0 for the same reason the fingerprint
      // is: it is a property of the tree, not of the shard. (§127 tier 3: the
      // GLOBAL shard 0, so exactly one worker reads it.)
      if (index === 0) {
        const axes = await page.evaluate(() => window.__I.AXES.map((a) => ({ name: a.name, n: a.n })));
        axisMeta.push(...(axisFilter ? axes.filter((a) => axisFilter.has(a.name)) : axes));
        checkRoster.push(...await page.evaluate(() => window.__I.CHECK_NAMES.slice()));
      }
      // The fingerprint is read on shard 0 only. It is not a per-shard property
      // — it is the identity build's hash, and shard 0's boot is as virgin as
      // any other. Reading it here rather than on its own boot keeps the boot
      // count at shards + 1, which is what the double-boot anchor needs.
      if (index === 0) fpA = await page.evaluate(() => window.__I.fingerprint(window.__clock));
      for (const { key, name, opts } of shard.entries) {
        const t = Date.now();
        const { result, ms } = await runCheck(page, name, opts, CHECK_TIMEOUT_MS);
        results.set(key, { result, ms });
        console.log(`${tag}${key}… ${secs(ms)} (at ${secs(t - t0 + ms)})`);
      }
      return { shard: index, warns };
    } catch (err) {
      console.error(`${tag}shard FAILED: ${err.message}`);
      return { shard: index, warns: [], error: String(err.message) };
    } finally {
      await context?.close().catch(() => {});
    }
  }));
  return { results, axisMeta, checkRoster, shardRows, fpA };
}

// The determinism anchors, both of them, on one second virgin boot. Its
// verdicts are gated in the assembly; what happens here is only the reading.
async function anchorBootB(browser, base, headDigests) {
  console.log('boot B (virgin, fresh context)…');
  const B = await virginBoot(browser, base, BOOT_TIMEOUT_MS);
  const fpB = await B.page.evaluate(() => window.__I.fingerprint(window.__clock));
  console.log(`  fingerprint B: ${fpB.hash}`);
  const digestsB = headDigests
    ? await B.page.evaluate(() => window.__I.unitDigests(window.__clock))
    : null;
  await B.context.close();
  return { fpB, digestsB };
}

// TODO 36 tier one — every declared spec point must BUILD. Runs after the
// shards so it never competes with them for cores; the boots are ~15 s each
// and concurrent (?trial=1 pages share no state), so the whole set costs a
// fraction of one sweep. A point that WARNS passes and its count is data;
// only a point that fails to produce a __clock is a failure.
async function runSpecTier(browser, base, points) {
  console.log(`spec boots (${points.length} declared points)…`);
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
  const rows = new Array(points.length);
  {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(SPEC_BOOT_POOL, points.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= points.length) return;
        const pt = points[i];
        const r = await specBoot(browser, base, pt.q);
        rows[i] = { ...pt, ...r };
      }
    }));
  }
  for (const r of rows) {
    const how = r.alive ? (r.warns.length ? `builds, ${r.warns.length} warn(s)` : 'builds, silent')
      : r.wedged ? 'WEDGED' : 'DEAD';
    console.log(`  ${r.alive ? '·' : '✗'} ${r.name.padEnd(16)} ${how}`);
  }
  return { rows, ms: Date.now() - specT0 };
}

// ---- §127 tier 3: THE COLLECTOR -----------------------------------------
//
// No browser, no dev server: every payload it needs was measured by a worker.
// What it does instead is DERIVE the partition its workers derived — from
// `buildTasks` and `partition` over in-repo data, the same pure functions,
// with no message from any worker involved — and hold the files it was given
// against it. Everything that could make the assembled run smaller than the
// declared one throws or gates by name; nothing about it is resolved by
// taking the collector's word or a worker's word alone.
if (COLLECT) {
  const t0 = Date.now();
  const files = COLLECT.map((path) => {
    // NOT readJsonOr: that convention exists so a missing baseline costs a
    // full run instead of a crash, and there is no "more work" for a collector
    // to fall back to — a worker file it cannot read is work it cannot
    // assemble, and the only safe reading of that is a hard stop.
    const obj = JSON.parse(readFileSync(resolve(path), 'utf8'));
    if (obj.formatVersion !== REPORT_FORMAT_VERSION) {
      throw new Error(`${path}: worker file at format v${obj.formatVersion ?? 'unversioned'} `
        + `against this harness's v${REPORT_FORMAT_VERSION}`);
    }
    return { path, ...obj };
  });

  // ONE RUN, OR IT IS NOT A RUN. The workers derived their groups from the
  // shape below; two files that disagree about it were partitioning different
  // batteries, and their union is not the battery either of them ran.
  const shapeOf = (f) => JSON.stringify({ n: f.matrix.n, shards: f.shards, split: f.split, only: f.only });
  const shapes = new Map(files.map((f) => [shapeOf(f), f.path]));
  if (shapes.size > 1) {
    throw new Error(`the worker files disagree about the run's shape:\n  ${[...shapes]
      .map(([s, p]) => `${p}: ${s}`).join('\n  ')}`);
  }
  const { n } = files[0].matrix;
  const perWorker = files[0].shards;
  const only = files[0].only ? new Set(files[0].only) : null;
  const split = files[0].split;

  // The partition, re-derived here exactly as each worker derived it.
  const battery = selectBattery(BATTERY, only);
  const tasks = buildTasks(battery, split, COSTS);
  const parts = partition(tasks, Math.min(n * perWorker, tasks.length));
  const expectedShards = parts.map((s, i) => ({ shard: i, keys: s.entries.map((e) => e.key) }));
  console.log(`--collect: ${files.length} worker file(s) of ${n} · ${tasks.length} task(s) `
    + `across ${expectedShards.length} shard(s)${split ? '' : ' (--no-split)'}${only ? ` (--only ${[...only].join(',')})` : ''}`);

  // Ownership is arithmetic, so a worker's claim about what it owned is
  // checkable rather than trusted: worker i owns [i*SHARDS, (i+1)*SHARDS) of
  // the shards the partition actually produced. A file that claims otherwise
  // was built from a different tree or a different flag set, and assembling it
  // would silently mix two runs.
  const seen = new Map();   // global shard index → the file that carried it
  for (const f of files) {
    const owed = expectedShards.map((s) => s.shard)
      .filter((s) => s >= f.matrix.i * perWorker && s < (f.matrix.i + 1) * perWorker);
    if (JSON.stringify(owed) !== JSON.stringify(f.ownedShards)) {
      throw new Error(`${f.path}: worker ${f.matrix.i}/${n} carries shards [${f.ownedShards}] `
        + `where this tree's partition gives it [${owed}]`);
    }
    for (const s of f.ownedShards) {
      if (seen.has(s)) throw new Error(`shard ${s} arrives twice: ${seen.get(s)} and ${f.path}`);
      seen.set(s, f.path);
    }
  }

  // §152 composes only if every worker narrowed to the SAME changed set. Each
  // derived it independently from its own preflight boot, which is sound
  // because the digest-determinism gate below holds that two virgin boots of
  // one tree agree — but "sound" is not "assumed", and a union run against
  // inconsistent restrictions would inherit baseline rows for pairs another
  // worker never swept.
  const restrictions = new Map(files.map((f) => [JSON.stringify(f.preflight.restriction ?? null), f.path]));
  if (restrictions.size > 1) {
    throw new Error(`the workers restricted to different unit sets:\n  ${[...restrictions]
      .map(([r, p]) => `${p}: ${r}`).join('\n  ')}`);
  }
  const restriction = files[0].preflight.restriction ?? null;
  const baseline = atReportFormat(readJsonOr(BASELINE_PATH, 'baseline report'), 'baseline report');
  // The union is what puts a restricted payload back to a whole-movement one,
  // and it happens HERE — so a collector without the baseline its workers
  // restricted against would skip it, and every restricted payload would gate
  // on its own partial rows. That is §152's stale green with an extra process
  // in the way, so it is refused rather than reported.
  if (!!baseline !== !!files[0].preflight.baselineUsable) {
    throw new Error(files[0].preflight.baselineUsable
      ? '--collect has no usable --baseline, and its workers restricted against one'
      : '--collect was given a baseline its workers did not use');
  }

  const anchored = files.filter((f) => f.anchors && f.spec);
  if (anchored.length !== 1) {
    throw new Error(`exactly one worker carries the anchors (fingerprints, digests, rosters, spec boots); `
      + `${anchored.length} of ${files.length} do`);
  }
  const [anchor] = anchored;
  if (anchor.matrix.i !== 0) throw new Error(`${anchor.path}: worker ${anchor.matrix.i} carries the anchors, which are worker 0's`);

  // The task payloads themselves, keyed as the partition keys them. A key that
  // arrives twice is two measurements of one task, and there is no rule for
  // choosing between them that is not arbitrary — so it stops here rather than
  // letting whichever file was listed last decide the verdict.
  const results = new Map();
  const carriedBy = new Map();
  for (const f of files) {
    for (const [key, got] of Object.entries(f.tasks)) {
      if (results.has(key)) throw new Error(`task ${key} arrives twice: ${carriedBy.get(key)} and ${f.path}`);
      results.set(key, got);
      carriedBy.set(key, f.path);
    }
  }

  assemble({
    battery,
    results,
    shardRows: files.flatMap((f) => f.shardRows).sort((a, b) => a.shard - b.shard),
    shardCount: expectedShards.length,
    expectedShards,
    axisMeta: anchor.anchors.axisMeta,
    checkRoster: anchor.anchors.checkRoster,
    fpA: anchor.anchors.fpA,
    fpB: anchor.anchors.fpB,
    digestsB: anchor.anchors.digestsB,
    spec: anchor.spec,
    headDigests: anchor.preflight.headDigests,
    restriction,
    baseline,
    split,
    specOnly: false,
    t0,
  });
} else {
// ---- ONE PROCESS: the browser half, and what it does with what it measured
//
// The single-process run and a `--matrix` worker are the SAME path — they
// differ only in how many shards the partition is cut into and which of them
// this process takes. Without --matrix it takes all of them and assembles its
// own payloads; with it, it takes its own and writes them out for a collector.

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

  // ---- §152 PREFLIGHT: the key, and the decision it licenses ---------------
  //
  // One extra VIRGIN boot, taken only when digests were asked for. It costs
  // 8 s here and ~26 s on CI against the four sweeps' 51 min, and it has to
  // come before the partition because what a shard is asked to run depends on
  // what it establishes.
  //
  // Nothing about this boot is special except its timing: the digests are read
  // the way every check is read, through page.evaluate, off a page whose state
  // file has just been deleted.
  //
  // §127 tier 3 — EVERY WORKER RUNS IT, and none of them coordinates: each
  // restores the same baseline cache entry and boots its own tree, so each
  // derives the same changed set. What makes that sound is the
  // digest-determinism gate in the assembly, and what makes it CHECKED is the
  // collector holding the workers' restrictions JSON-equal.
  let headDigests = null;      // this tree's per-unit key
  let restriction = null;      // the changed-unit list every sweep narrows to, or null for a full run
  let baseline = null;         // the baseline --report the union draws its inherited rows from
  if ((DIGESTS_OUT || DIGESTS_BASE || BASELINE_PATH) && !SPEC_ONLY) {
    // The side-inputs are files, so they are read before anything boots: a
    // baseline that cannot be read costs a full run, and finding that out
    // after a boot would just be a slower way to learn it.
    const baseDigests = atReportFormat(readJsonOr(DIGESTS_BASE, 'base digests'), 'base digests');
    baseline = atReportFormat(readJsonOr(BASELINE_PATH, 'baseline report'), 'baseline report');

    console.log('§152 preflight boot (virgin)…');
    const P = await virginBoot(browser, base, BOOT_TIMEOUT_MS);
    headDigests = await P.page.evaluate(() => window.__I.unitDigests(window.__clock));
    headDigests.checkCode = checkCodeDigest();
    headDigests.formatVersion = REPORT_FORMAT_VERSION;
    // The changed set is computed ON THIS PAGE, by inspect.js's own
    // digestChangedUnits, rather than by a second implementation here. The
    // rule that a unit missing from either tree counts as changed, and that
    // the two always-changed lists are UNIONED, is one definition in the
    // module that owns the key — not a Node copy of it that drifts.
    const changed = (!NO_INCREMENTAL && baseDigests && baseline
      && JSON.stringify(baseDigests.checkCode) === JSON.stringify(headDigests.checkCode))
      ? await P.page.evaluate(([b, h]) => window.__I.digestChangedUnits(b, h), [baseDigests, headDigests])
      : null;
    await P.context.close();
    console.log(`  digests: ${headDigests.unitCount} units over ${headDigests.poseCount} poses`);
    if (DIGESTS_OUT) {
      writeFileSync(resolve(DIGESTS_OUT), `${JSON.stringify(headDigests, null, 2)}\n`);
      console.log(`  digests written to ${resolve(DIGESTS_OUT)}`);
    }

    // EVERY BRANCH THAT IS NOT "restrict" SAYS WHY. A feature whose failure
    // mode is a stale green does not get to be quiet about declining to use
    // itself, and "the battery looked fast today" must never be something a
    // reader has to reverse-engineer from a wall clock.
    if (NO_INCREMENTAL) {
      console.log('  --no-incremental: running everything (the reference an incremental run must agree with)');
    } else if (!baseDigests || !baseline) {
      console.log('  no usable baseline: running everything');
    } else if (JSON.stringify(baseDigests.checkCode) !== JSON.stringify(headDigests.checkCode)) {
      const moved = CHECK_CODE_FILES.filter((f) => baseDigests.checkCode?.[f] !== headDigests.checkCode[f]);
      console.log(`  CHECK CODE moved (${moved.join(', ')}): every stored verdict is void — running everything`);
    } else if (!changed.length) {
      // Not a hypothetical: a docs-and-workflow PR that the paths filter did
      // not take out reaches here. It still runs every cheap check, and it
      // still unions, so the report it writes describes the whole movement.
      console.log('  0 units changed: the sweeps have nothing to measure on this tree');
      restriction = changed;
    } else {
      restriction = changed;
      const n = headDigests.unitCount;
      const k = changed.length;
      const pairs = k * (n - k) + (k * (k - 1)) / 2;
      const all = (n * (n - 1)) / 2;
      console.log(`  ${k} unit(s) changed: ${changed.join(', ')}`);
      console.log(`  restricting the four sweeps to ${pairs} of ${all} pairs `
        + `(${(100 * pairs / all).toFixed(1)}%); every other check runs whole`);
    }
  }

  const t0 = Date.now();
  const battery = selectBattery(BATTERY, ONLY);
  const axisFilter = selectedAxes(battery, ONLY);
  const tasks = buildTasks(battery, SPLIT, COSTS);
  // §152 — the restriction reaches the checks the way every other option does,
  // as an opt on the task. Only the four SWEEPS take it: the cheap checks sum
  // to ~76 s and are where a key mistake would hide, so they always run whole.
  if (restriction) {
    for (const t of tasks) {
      if (RESTRICTABLE.has(t.name)) t.opts = { ...t.opts, pairsTouching: restriction };
    }
  }
  // §127 tier 3 — the partition is over N × SHARDS groups, and this worker runs
  // the SHARDS of them that are its own. N is 1 without --matrix, so the single
  // process takes every shard and the arithmetic is the one it has always done.
  // The Math.min clamp against the task count can leave the last workers with
  // NOTHING to run, which is a legitimate outcome and not an error — what the
  // collector holds is that every shard the partition DID produce arrives
  // exactly once, not that every worker had work.
  const workers = MATRIX ? MATRIX.n : 1;
  const shards = SPEC_ONLY ? [] : partition(tasks, Math.min(workers * SHARDS, tasks.length));
  const group = shards.map((shard, index) => ({ shard, index }))
    .filter(({ index }) => !MATRIX || (index >= MATRIX.i * SHARDS && index < (MATRIX.i + 1) * SHARDS));
  const ownsAnchors = !MATRIX || MATRIX.i === 0;
  if (SPEC_ONLY) console.log('--spec-only: skipping the sweeps and the fingerprint anchor.');
  console.log(`${tasks.length} task(s)${SPLIT ? '' : ' (--no-split)'} across ${shards.length} shard(s), partitioned by cost:`);
  shards.forEach((s, i) => console.log(
    `  shard ${i}  ~${Math.round(s.cost / 60)} min  ${s.entries.map((e) => e.key).join(' ')}`
    + (MATRIX ? (Math.floor(i / SHARDS) === MATRIX.i ? '   ← this worker' : `   (worker ${Math.floor(i / SHARDS)})`) : '')));

  const ran = await runShardGroup({ browser, base, group, shardCount: shards.length, axisFilter, t0 });

  // The anchors are worker 0's, because the code above already treats shard 0
  // as the tree's representative — the fingerprint, the axis roster and the
  // check roster are properties of the tree, and reading them twice would only
  // create two answers to hold against each other. Under --matrix the spec-boot
  // tier rides with them until a later landing spreads it.
  const { fpB, digestsB } = (!SPEC_ONLY && ownsAnchors)
    ? await anchorBootB(browser, base, headDigests)
    : { fpB: null, digestsB: null };
  // `--only` narrows this tier to its own control point: the tier stays in the
  // run (with both its gates) at one boot instead of 26.
  const spec = ownsAnchors
    ? await runSpecTier(browser, base, ONLY ? SPEC_POINTS.filter((p) => p.name === 'identity') : SPEC_POINTS)
    : null;

  if (MATRIX) {
    // A worker evaluates NOTHING. It writes what it measured — its task
    // payloads, its shards' boot warns and errors under their GLOBAL indices,
    // the preflight decision it derived, and (worker 0) the anchors — and the
    // collector is the only side that turns any of it into a verdict.
    writeFileSync(resolve(TASKS_OUT), `${JSON.stringify({
      formatVersion: REPORT_FORMAT_VERSION,
      matrix: MATRIX,
      shards: SHARDS,
      split: SPLIT,
      only: ONLY ? [...ONLY] : null,
      ownedShards: group.map((g) => g.index),
      tasks: Object.fromEntries(ran.results),
      shardRows: ran.shardRows,
      preflight: { headDigests, restriction, baselineUsable: !!baseline },
      anchors: ownsAnchors
        ? { fpA: ran.fpA, fpB, digestsB, axisMeta: ran.axisMeta, checkRoster: ran.checkRoster }
        : null,
      spec,
    })}\n`);
    console.log(`worker ${MATRIX.i}/${MATRIX.n}: ${ran.results.size} task payload(s) from shard(s) `
      + `[${group.map((g) => g.index).join(', ')}]${ownsAnchors ? ' + the anchors' : ''} `
      + `written to ${resolve(TASKS_OUT)} · ${secs(Date.now() - t0)}`);
  } else {
    assemble({
      battery,
      results: ran.results,
      shardRows: ran.shardRows,
      shardCount: shards.length,
      expectedShards: null,
      axisMeta: ran.axisMeta,
      checkRoster: ran.checkRoster,
      fpA: ran.fpA,
      fpB,
      digestsB,
      spec,
      headDigests,
      restriction,
      baseline,
      split: SPLIT,
      specOnly: SPEC_ONLY,
      t0,
    });
  }
} finally {
  await browser?.close();
  server?.kill();
  rmSync(stateDir, { recursive: true, force: true });
}

}   // ---- end of the browser path
