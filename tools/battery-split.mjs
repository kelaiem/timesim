// §127 — the battery's partition atom, and the reassembly that makes it legal.
//
// Split out of ci-battery.mjs rather than left inside it for one reason: the
// acceptance for this tranche is that a merged payload is BYTE-IDENTICAL to a
// whole run's, and a merge that can only be exercised by running the whole
// battery cannot be tested at the scale a person iterates at.
// tools/probe-127-split.mjs imports this module and proves the identity on a
// two-axis sweep in about a minute.
// §127 — THE PARTITION'S ATOM BECOMES A TASK. §81 shards whole checks, so the
// wall can never go below the slowest single CHECK: `inspection` at ~36% of all
// check time was the floor, and §108 measured it and said so. A check whose
// outer loop is `for (const axis of AXES)` divides along that loop — each axis
// is a sweep of the same units over its own poses, and the findings are a UNION
// (a FORBIDDEN pair is forbidden if any axis reaches it), so slices merge.
//
// What makes it legal is TODO 54's canonical axis entry: a slice runs in its
// own browser context, starting from resetInputs(), so it must land the same
// poses a whole run lands. Before that the poses depended on AXES' declaration
// order and this partition would have quietly changed the report — §81's own
// invariant, with the atom made finer.
//
// WHY THE AXES ARE NAMED HERE. The partition is computed BEFORE any browser
// boots, so the harness cannot ask the page what the axes are — and an axis
// carries a `pose` function that could not cross page.evaluate anyway. So the
// list is declared, and then ASSERTED against window.__I.AXES on the first
// boot (assertSlices below): a slice naming an axis that no longer exists, or
// an axis nobody sliced, fails the run instead of silently sweeping less. That
// is the same declare-then-assert shape the paths-ignore check uses, and for
// the same reason — this file's couplings to inspect.js are all by string.
//
// `poses` is n + 1 for that axis, a FACT the assert also checks. It seeded the
// first partition — a slice's cost as its share of the check's measured cost —
// because no per-axis wall had ever been measured and a made-up number would
// have been a magic constant balancing a partition. `ms` is the MEASURED wall,
// written back from `--report` exactly as the check costs are, and it wins.
//
// KEEP BOTH, because the first sliced run showed how rough the proxy is: the
// projection erred -25% (`wind`) to +44% (`alarmWind`), and it mis-ranked the
// column — `wind` projected at 349.1 s and measured 261.7 s, `train` projected
// 47.0 s and measured 66.6 s. Per-pose cost is dominated by how many pair
// candidates survive the broad phase at that pose, which varies by axis and is
// not a function of pose count. An axis added later gets the same rough seed
// and the same correction on the next `--report`; what the pair does NOT let
// anyone do is quietly keep a projection while believing it was measured.
export const INSPECTION_SLICES = [
  { axis: 'beat', poses: 97, ms: 54109 },
  { axis: 'crown', poses: 49, ms: 24335 },
  { axis: 'reserve', poses: 61, ms: 22954 },
  { axis: 'wind', poses: 721, ms: 261735 },
  { axis: 'train', poses: 97, ms: 66580 },
  { axis: 'jumperEngage', poses: 121, ms: 70719 },
  { axis: 'handSet', poses: 121, ms: 65625 },
  { axis: 'alarm', poses: 97, ms: 55597 },
  { axis: 'alarmStrike', poses: 110, ms: 59415 },
  { axis: 'alarmWind', poses: 110, ms: 76736 },
  { axis: 'alarmToggle', poses: 49, ms: 32844 },
  // TODO 50 — the stem clutch's own reversal (one coupling pitch, cycled).
  // ms measured on the session's dev container battery run; poses = n 96
  // plus the endpoint, the same accounting as every row above.
  { axis: 'stemSlip', poses: 97, ms: 55000 },
];

// §127 — reassemble a sliced `inspection` into the payload a whole run
// produces. Byte-identity is the acceptance, so every field is rebuilt the way
// runInspection builds it rather than concatenated:
//
//   · `report` is a UNION by pair. Two slices cannot both hold one axis, so
//     the per-axis hit lists never collide — and a collision would be a
//     partition bug, so it throws rather than merging.
//   · KEY ORDER is part of the payload. A whole run inserts a pair's axes in
//     sweep order, so the merge re-inserts them in AXES order; the same for
//     the `axes` field and the census counters.
//   · `summary` is RE-DERIVED, not carried, because a slice's summary would
//     quote only its own axis.
//   · `units` must AGREE across slices. A slice that collected a different
//     unit list is a bug in the harness or the build, not a merge input, so
//     it throws — the one thing a union would happily paper over.
//
// The census's two MS fields are wall-clock, so they sum but do not compare
// between runs — the same exemption `ms` has in the report.
export function mergeInspection(parts, axisMeta) {
  const order = axisMeta.map((a) => a.name);
  const nOf = new Map(axisMeta.map((a) => [a.name, a.n]));
  const units = parts[0].result.units;
  for (const p of parts) {
    if (JSON.stringify(p.result.units) !== JSON.stringify(units)) {
      throw new Error(`slice ${p.slice} collected a different unit list than ${parts[0].slice}`);
    }
  }
  const byPair = new Map();
  for (const p of parts) for (const row of p.result.report) {
    let rec = byPair.get(row.pair);
    if (!rec) byPair.set(row.pair, rec = { pair: row.pair, class: row.class, axes: {} });
    if (rec.class !== row.class) throw new Error(`${row.pair} classed ${rec.class} and ${row.class} in two slices`);
    for (const [ax, fs] of Object.entries(row.axes)) {
      if (rec.axes[ax]) throw new Error(`axis ${ax} reported by two slices for ${row.pair}`);
      rec.axes[ax] = fs;
    }
  }
  const report = [...byPair.values()].sort((x, y) =>
    x.class === y.class ? x.pair.localeCompare(y.pair) : x.class === 'FORBIDDEN' ? -1 : 1);
  for (const r of report) {
    const ordered = {};
    for (const ax of order) if (r.axes[ax]) ordered[ax] = r.axes[ax];
    r.axes = ordered;
    r.summary = Object.entries(r.axes)
      .map(([ax, fs]) => `${ax}: ${fs.length}/${nOf.get(ax) + 1} poses (f ${Math.min(...fs)}–${Math.max(...fs)})`)
      .join('; ');
  }
  const census = JSON.parse(JSON.stringify(parts[0].result.census));
  for (const p of parts.slice(1)) for (const k of Object.keys(census)) {
    if (k === 'out') for (const kk of Object.keys(census.out)) census.out[kk] += p.result.census.out[kk];
    else census[k] += p.result.census[k];
  }
  census.exactMs = +census.exactMs.toFixed(1);
  census.verdictMs = +census.verdictMs.toFixed(1);
  const swept = new Set(parts.map((p) => p.slice));
  return { units, report, axes: order.filter((n) => swept.has(n)), census };
}

// One entry per unit of schedulable work: a whole check, or one slice of a
// split check. This is what `partition` balances now.
//
// A slice's seed cost is its share of the check's measured cost BY POSE COUNT
// — a projection, and labelled one, because nothing had ever measured a single
// axis's wall. It is only ever used to balance shards, so a wrong projection
// costs wall clock and never a verdict (§81's rule, inherited). Once a sliced
// run has written `ms` back through `--report`, the measured number wins.
export function buildTasks(entries, split) {
  const tasks = [];
  for (const e of entries) {
    if (!split || !e.slices) { tasks.push({ key: e.name, name: e.name, opts: e.opts, cost: e.cost, entry: e }); continue; }
    const totalPoses = e.slices.reduce((a, s) => a + s.poses, 0);
    for (const s of e.slices) {
      tasks.push({
        key: `${e.name}:${s.axis}`, name: e.name, slice: s.axis, entry: e,
        opts: { ...e.opts, axes: [s.axis] },
        cost: s.ms !== undefined ? s.ms / 1000 : (e.cost * s.poses) / totalPoses,
        projected: s.ms === undefined,
      });
    }
  }
  return tasks;
}
