// THE BATTERY'S PLAN, shared: the measured cost column and the partition that balances
// it. Moved here verbatim from tools/ci-battery.mjs (§338 landing 3) so that a second
// harness, tools/battery-native.mjs, plans its shards from the SAME column and the SAME
// rule rather than a copy of either; ci-battery.mjs imports both back. Pure data and a
// pure function: importing this runs nothing.


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
//
// EVERY ROW BELOW IS ONE HOSTED CI RUN'S: the push battery of run 39895692050
// (`main` at 14fd806c, the merge of #768; ubuntu-24.04 / SwiftShader, 3
// shards, Linux/X64), each task's wall from its `[shard i] task… N s` log
// line, by the convention of the refresh recorded next (whole checks in
// seconds rounded, floor 1; slices in ms; a split check's whole row the sum of
// its slices).
//
// Why: #768's static mesh-pair memo in src/inspect.js made the sweep checks
// several times faster, so the column it left behind was wrong in the way
// that mis-partitions — the checks moved RELATIVE to each other. `expectedContacts` 1538 → 287, `inspection` 929 → 122, `clearances`
// 947 → 144 and `sweptOverlap` 294 → 41 (5.4x–7.6x), while
// `undeclaredClearance` (its own engine) held at 151 → 155 and every small row
// moved by a few seconds at most. That run, partitioned by the stale column, ended
// its shards at 365.2 / 265.4 / 330.9 s of check time, +13.9% over the ideal
// 320.5 s; the same walls under this column land 321.0 / 319.8 / 320.7 s
// (+0.2%; K=2: +15.6% → +0.1%). That is in-sample. OUT OF SAMPLE, PR #768's
// own whole run on the self-hosted Linux/ARM64 host (run 39891935777, a
// different machine this column never saw) partitions +19.3% over ideal at
// K=3 under the stale column and +7.0% under this one (K=2: +16.1% → +1.2%).
// The longest single task is now `expectedContacts:wind` at 60.1 s, well
// under a shard's 320 s, so the residue is the machines' different ratios
// (§127's lesson), not task granularity.
//
// HISTORY — the refresh before this one, whose numbers are no longer any
// row's. EVERY ROW WAS THEN ONE HOSTED CI RUN'S, and the paragraph above that
// argued against a CI-derived column was overtaken by how far the dev-container
// column had drifted. The source was the push battery of run 39720040054
// (`main` at abcceb8, ubuntu-latest / SwiftShader, 3 shards, Linux/X64): each
// task's wall from its `[shard i] task… N s` log line — the same wall
// `--report` writes as `ms` / `sliceMs`. A whole-check row is that check's
// wall in seconds rounded (floor 1); a split check's whole row is the sum of
// its slices, which matters only to `--no-split` and to an axis added later
// (its projection divides the whole row by pose count). The comments on
// individual rows below say how the EARLIER values were reached and are kept
// as history; none of their numbers is the row's any more.
//
// Why: the old column had drifted 3.8x (`expectedContacts` 404 against 1538
// measured — and 16 of its 17 slices were projections), 3.3x (`clearances`,
// 14 of 17 projected) and 5.6x (`inspection` 166 against 929), while
// `undeclaredClearance` ran at 0.47x its prototype-seeded 320. LPT balanced
// that column to ~569 s a shard and the shards actually ended at 1086 / 1762 /
// 1316 s of check time, 27.8% over the ideal 1352 s. Against the same run the
// refreshed column partitions to within 0.1 s of ideal, which is in-sample and
// proves nothing; the claim is the OUT-OF-SAMPLE one. Run 39712407468 (the
// push before, main at 4bab2c4, on a runner 1.44x slower overall) gives task
// walls this column never saw: the old column's partition of them lands
// 1549 / 2461 / 1843 s (max +26.2% over ideal), this column's 1923 / 1979 /
// 1951 s (max +1.4%). A runner's speed moves every row together; what moved
// the partition was the checks' RELATIVE drift, which one CI run fixes for the
// next. Refresh from a hosted push's log or `--report`, never a dev container.
export const COSTS = {
  'support': 9,
  'graph': 1,
  // §161 — 12 fixtures over throwaway objects, no scene and no poses. 1 is
  // this column's floor for sub-second checks (see `slenderness` below);
  // `--report` refreshes it like every row.
  'aestheticsMerge': 1,
  'axisEntry': 6,
  // §111 raised this from 17 (the governor row's 449 phases); §113's stubby
  // pallets halved the row's mesh work — measured 21 s.
  'penetration': 49,
  'alarmHandoffs': 2,
  'windArrestHandoff': 1,
  'stemClutchHandoff': 2,
  'strikeHandoff': 1,      // §198 — three posed phases, two rows
  'maintDetentHandoff': 1, // TODO 210 — three posed phases, one row
  'escapementHandoff': 1,  // TODO 226 step 3b — fourteen posed phases, one row
  'stockFloor': 8,
  // §233 — one swept registry (shared with stockFloor's cost, but measured
  // separately since it is its own call), then a per-mesh axis descent over
  // 272 revolves. No pose sweep and no BVH. Measured 6.6 s on the first full
  // local run, which is the number here; refresh it like every row.
  'turning': 8,
  // §70/§261 — one reference, 25 press poses twice (the control re-reads
  // the stroke) and 2,880 rays round the wheel's own frame. Measured on the
  // dev container; refresh with --report like every row.
  'lineSpec': 2,
  // TODO 181 — the census walks the dense pose net (1892 poses) over the 687
  // meshes JMP_SITE visits, corner bounds per pose and the exact walk only
  // where they cannot decide; the bounded rows' meshClearance to the region
  // box is Lipschitz-pruned against each row's running minimum. Measured
  // 14.6 s on the dev container.
  // TODO 202 step 4 — every labelled mesh against the base plate over the 43
  // digest poses, memoised on (geometry, world matrix) because most of the
  // population is fixed metal; measured 22.7 s on the dev container (203 s
  // before the memo).
  'plateSeats': 21,
  'jumperMovers': 10,
  // §54's own record in docs/BUILT.md measured this check at 4 ms over 454
  // meshes — one computeBoundingBox per mesh, no swept registry, no BVH, no
  // pose sweep. TODO 78's bearing walk adds a handful of Box3.setFromObject
  // calls inside one unit. 1 is this column's floor for sub-second checks;
  // --report refreshes it like every row.
  'slenderness': 1,
  // TODO 100 — no scene sweep and no poses: it reads each geometry's authored
  // shape once. Measured alongside meshIntegrity, which walks the same roster.
  'outlines': 1,
  'meshIntegrity': 1,
  // 3 → 11 with §182's declaration audit: 140 rows measured over the same 70
  // poses the tiers walk. The audit stops refining a row once its verdict
  // cannot change, which is what keeps this a +2.6 s column and not a +33 s
  // one (uncapped it measured 41.4).
  'intraUnit': 19,
  'assembly': 4,
  // §194 — both walk the 23-row registry. meshPhase reads two silhouette
  // gauges per row over the 43-pose net (2048 bins each, outline edges only);
  // transmits sweeps each row's declared inputs with span refinement, so its
  // cost is rows × inputs × halvings rather than rows × poses. MEASURED at
  // 10.4 s and 5.1 s on the container that ran the landing battery — the first
  // guesses here were 34 and 22, which is the kind of stale number this column
  // exists to be corrected out of (it costs wall clock, never a verdict).
  'meshPhase': 14,
  'transmits': 6,
  'meshCoverage': 1,   // §135 item 4 — 85 rotors pairwise × the 43-pose net, bounding boxes only; a guess until measured (the column's rule: corrected from a run, never trusted)
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
  'expectedContacts': 287,   // the sum of its slices below
  'oscillator': 1,
  // §104 — the cost moved 1 → 14: the alarm half's endpoint rows STEP the
  // shipped tick law (120 ticks at two winds), which is the row's whole
  // point; a stale 1 here costs wall clock, never a verdict.
  'equalisation': 5,
  'chainLength': 1,
  'restoring': 30,
  'transfers': 1,
  'lubrication': 1,
  'serviceClass': 1,   // TODO 299 — one collectUnits walk and a pure judge, lubrication's class
  // TODO 298 — one collectUnits walk and a pure judge run six times: a lubrication-class cost
  'modules': 1,
  // §122 — the verdict tier's two fixes moved this column's three largest
  // rows, and every moved entry here is the OLD CI-calibrated value scaled
  // by its measured local before/after ratio (one container, same-day runs,
  // full battery both sides: clearances ×0.50, inspection ×0.21 with slices
  // ×0.17–0.28, support ×0.47, intraUnit ×0.56, assembly ×0.69). Scaling
  // rather than transplanting keeps the header's own lesson: local absolute
  // times are not CI's, but a measured RATIO on one box transfers, and this
  // column's job is the relative partition. Checks the fixes cannot touch
  // (expectedContacts' exact tier, sweptOverlap, penetration) measured
  // 0.97–1.09 — inside the noise band — and keep their rows.
  //
  // MEASURED BEFORE §127 TIER 2A, which landed on main while this branch was
  // open and made a whole run refine a SUPERSET of the intervals it used to
  // (the refinement reference went per-axis). That is strictly more work in
  // this sweep, so `clearances` here is a LOWER bound on what the check now
  // costs, and it is also the projection base the 14 new `clearances:*` slices
  // divide by pose count. Left as measured rather than guessed upward: this
  // column balances shards and nothing else, so an under-estimate costs wall
  // clock and never a verdict (the header's own rule), and the first sliced
  // run's `--report` replaces every row of it with a measured one.
  // TODO 236 — the alarmPull axis (n 96, 97 poses per sweep) is new work in
  // every split check, and the edits it owes this column follow the column's
  // own rule: a ratio from one local run transfers, its absolute times do not.
  // Measured on one 4-vCPU dev container, 3 shards, full battery, 2026-10-13.
  //  · a NEW slice row = its local ms × (this table ÷ local) over the same
  //    run's unchanged slices: inspection 0.1049 (14 slices), undeclared
  //    0.6587 (15); clearances and expectedContacts carry no slice rows, so
  //    their factor is the whole-check row over the run's whole check less the
  //    new slice (0.1038, 0.1064);
  //  · a whole-check row whose work grew = old × total ÷ (total − alarmPull
  //    slice), the axis's own measured share: inspection ×1.0398, clearances
  //    ×1.0411, undeclaredClearance ×1.0105, expectedContacts ×1.0392.
  // Every other row is untouched: the checks that walk AXES unsliced grew too,
  // but no pre-236 run on this box measured by how much.
  'inspection': 122,   // the sum of its slices below
  'clearances': 144,   // the sum of its slices below
  // TODO 164 — PROTOTYPE-MEASURED, not yet CI-calibrated: the planning probe
  // (`scratchpad/164/engine.mjs`, the prototype `checkUndeclaredClearance` was
  // ported from) measured 317 s dense over all 14 axes on a dev container,
  // against an exhaustive reference at 1258 s. Seeded here at the prototype's
  // total and per-axis milliseconds so the partition has something better than
  // a pose-count guess on its first run; `--report` replaces every row of it
  // with a measured one; the header's own rule (a stale cost costs wall clock,
  // never a verdict).
  'undeclaredClearance': 155,   // the sum of its slices below
  'sweptOverlap': 41,

  // §127 — the per-axis walls of the split checks, in MILLISECONDS (`--report`'s
  // `sliceMs`; here the per-task line of the CI log, which is the same wall).
  // Every split check has every slice measured (since run 39720040054; every
  // row below is run 39895692050's), so nothing below is projected; a slice
  // with no row (an axis added later) is
  // projected from its pose count and labelled `projected` until a sliced run
  // measures it.
  'expectedContacts:beat': 12800,
  'expectedContacts:crown': 4400,
  'expectedContacts:reserve': 9600,
  'expectedContacts:wind': 60100,
  'expectedContacts:arrest': 9100,
  'expectedContacts:train': 38800,
  'expectedContacts:jumperEngage': 46700,
  'expectedContacts:handSet': 30400,
  'expectedContacts:alarm': 11000,
  'expectedContacts:alarmStrike': 6500,
  'expectedContacts:alarmWind': 6300,
  'expectedContacts:alarmToggle': 3200,
  'expectedContacts:stemSlip': 6700,
  'expectedContacts:alarmPress': 5300,
  'expectedContacts:maintHold': 17100,
  'expectedContacts:alarmPull': 5200,
  'expectedContacts:position': 14200,

  'inspection:beat': 6900,
  'inspection:crown': 2500,
  'inspection:reserve': 4300,
  'inspection:wind': 31900,
  'inspection:arrest': 6000,
  'inspection:train': 11100,
  'inspection:jumperEngage': 14400,
  'inspection:handSet': 4500,
  'inspection:alarm': 11500,
  'inspection:alarmStrike': 3700,
  'inspection:alarmWind': 3300,
  'inspection:alarmToggle': 1400,
  'inspection:stemSlip': 1500,
  'inspection:alarmPress': 1700,
  'inspection:maintHold': 7500,
  'inspection:alarmPull': 1500,
  'inspection:position': 8200,

  'clearances:beat': 10400,
  'clearances:crown': 6700,
  'clearances:reserve': 5900,
  'clearances:wind': 40700,
  'clearances:arrest': 5400,
  'clearances:train': 21300,
  'clearances:jumperEngage': 15900,
  'clearances:handSet': 2200,
  'clearances:alarm': 1500,
  'clearances:alarmStrike': 2200,
  'clearances:alarmWind': 1800,
  'clearances:alarmToggle': 1500,
  'clearances:stemSlip': 1600,
  'clearances:alarmPress': 1500,
  'clearances:maintHold': 11100,
  'clearances:alarmPull': 1500,
  'clearances:position': 12900,

  'undeclaredClearance:beat': 9100,
  'undeclaredClearance:crown': 2800,
  'undeclaredClearance:reserve': 3400,
  'undeclaredClearance:wind': 17500,
  'undeclaredClearance:arrest': 3700,
  'undeclaredClearance:train': 24500,
  'undeclaredClearance:jumperEngage': 24900,
  'undeclaredClearance:handSet': 4200,
  'undeclaredClearance:alarm': 3700,
  'undeclaredClearance:alarmStrike': 17100,
  'undeclaredClearance:alarmWind': 9600,
  'undeclaredClearance:alarmToggle': 2400,
  'undeclaredClearance:stemSlip': 3700,
  'undeclaredClearance:alarmPress': 2400,
  'undeclaredClearance:maintHold': 11600,
  'undeclaredClearance:alarmPull': 3300,
  'undeclaredClearance:position': 11500,
};

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
export function partition(entries, k) {
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
