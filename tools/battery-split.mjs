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
// have been a magic constant balancing a partition. That projection still
// stands in for a slice nobody has measured yet (buildTasks below), and a
// MEASURED per-axis wall wins wherever one exists.
//
// §152 MOVED THE MEASURED MS OUT OF THIS TABLE, into ci-battery.mjs's COSTS
// map, keyed `inspection:<axis>`. This file is one of CHECK_CODE_FILES — the
// digest that decides whether a stored verdict may be inherited — and a cost
// is wall clock, never a verdict (§81's rule). Refreshing the column from
// `--report` is the most routine harness edit there is, and it must not void
// every stored row for numbers no check can read. The FACTS stay here, where
// the assert that holds them true against the page's own axes reads them.
export const INSPECTION_SLICES = [
  { axis: 'beat', poses: 97 },
  { axis: 'crown', poses: 49 },
  { axis: 'reserve', poses: 61 },
  { axis: 'wind', poses: 721 },
  // TODO 71 — the arrest's arming band, cycled (see the axis's own comment).
  { axis: 'arrest', poses: 97 },
  { axis: 'train', poses: 97 },
  { axis: 'jumperEngage', poses: 121 },
  { axis: 'handSet', poses: 121 },
  { axis: 'alarm', poses: 97 },
  { axis: 'alarmStrike', poses: 110 },
  { axis: 'alarmWind', poses: 110 },
  { axis: 'alarmToggle', poses: 49 },
  // TODO 50 — the stem clutch's own reversal (one coupling pitch, cycled).
  // poses = n 96 plus the endpoint, the same accounting as every row above.
  { axis: 'stemSlip', poses: 97 },
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
//
// §108's census is a report of WORK DONE, so every slice's counters add: the
// slices between them did the whole run's poses. Shared by both merges below
// rather than written twice, because "how a census reassembles" is one answer
// and a second copy of it is a second thing to keep in step.
function sumCensus(parts) {
  const census = JSON.parse(JSON.stringify(parts[0].result.census));
  for (const p of parts.slice(1)) for (const k of Object.keys(census)) {
    if (k === 'out') for (const kk of Object.keys(census.out)) census.out[kk] += p.result.census.out[kk];
    else census[k] += p.result.census[k];
  }
  census.exactMs = +census.exactMs.toFixed(1);
  census.verdictMs = +census.verdictMs.toFixed(1);
  return census;
}

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
    // §122 fix two — coverage is a function of class (every EXPECTED row is
    // marked raw-after-first-confirmed), so the merge re-derives it below the
    // way it re-derives summary; here it only guards against a slice that
    // disagrees, the class check's own pattern.
    if ((row.coverage ?? null) !== (row.class === 'EXPECTED' ? 'raw-after-first-confirmed' : null))
      throw new Error(`${row.pair} carries coverage '${row.coverage}' against class ${row.class}`);
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
    if (r.class === 'EXPECTED') r.coverage = 'raw-after-first-confirmed'; // §122 — before summary, so key order matches a whole run's rows byte for byte
    r.summary = Object.entries(r.axes)
      .map(([ax, fs]) => `${ax}: ${fs.length}/${nOf.get(ax) + 1} poses (f ${Math.min(...fs)}–${Math.max(...fs)})`)
      .join('; ');
  }
  const census = sumCensus(parts);
  const swept = new Set(parts.map((p) => p.slice));
  // §152 — CARRY THE RESTRICTION THROUGH. Every slice of one run was given the
  // same `pairsTouching`, so they all carry the same record; dropping it here
  // made the merged payload look like a WHOLE run to the union step, which
  // then returned it untouched and gated a restricted `inspection` on its own
  // partial rows. It passed — 3 contacting pairs where a full run finds 81 —
  // which is precisely the stale green this entry exists to make impossible.
  // A disagreement between slices is a harness bug, so it throws rather than
  // picking one, the same way the unit list above does.
  const restriction = parts[0].result.restriction;
  for (const p of parts) {
    if (JSON.stringify(p.result.restriction) !== JSON.stringify(restriction)) {
      throw new Error(`slice ${p.slice} was restricted differently than ${parts[0].slice}`);
    }
  }
  return { units, report, axes: order.filter((n) => swept.has(n)), census,
    ...(restriction ? { restriction } : {}) };
}

// §127 tier 2a — THE OTHER TWO SWEEPS DIVIDE ALONG THE SAME LOOP, but their
// rows are EXTREMA rather than a union: `clearances` and `expectedContacts`
// each report one row per declared table entry, carrying the smallest
// clearance found anywhere in pose space and WHERE it was found. So the merge
// does not combine rows — it PICKS one, and the picked row is the winning
// slice's verbatim, because that slice measured it at the pose it names.
//
// What makes the pick reproduce a whole run exactly is `sweepClearances`'
// per-axis refinement reference (§127 tier 2a in inspect.js): before it, a
// slice refined a superset of a whole run's intervals and could return a
// lower minimum, so the winner would have been a function of the partition.
//
// THE TIE RULE IS THE WHOLE RUN'S OWN. The engine records a new minimum on a
// strict `d < st.min`, so when two poses reach the same value the FIRST one
// swept keeps the row — and axes are swept in AXES order. Hence: strict `<`
// over parts walked in axis order, so the earliest axis keeps a tie. One `>=`
// here and every tied row would silently be attributed to the wrong pose,
// with every gate still green.
//
// A CAPPED row is not a number: the check writes `"≥ x.xx"` when every query
// for that pair was pruned at its cap — the bound proven, no minimum measured
// (see checkClearances' own note). Capped therefore sorts as Infinity, and a
// row capped in EVERY slice takes the first part's row: the string is derived
// from the row's floor and the band, so it is constant across slices, which is
// asserted rather than assumed.
//
// A DEAD AXIS is legal and costs milliseconds: `sweepClearances` skips an axis
// no live pair names, so that slice returns every row capped and merges away.
export function mergeExtrema(parts, axisMeta) {
  const order = axisMeta.map((a) => a.name);
  const at = (name) => {
    const i = order.indexOf(name);
    if (i < 0) throw new Error(`slice ${name} names no axis in AXES — the merge cannot order it`);
    return i;
  };
  // Parts arrive in slice-declaration order, which IS AXES order (assertSlices
  // holds that). Sorted anyway, because the tie rule is the only thing keeping
  // a tied row's pose attribution true and it must not depend on the order the
  // harness happened to hand them over in.
  parts = [...parts].sort((x, y) => at(x.slice) - at(y.slice));
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].slice === parts[i - 1].slice) throw new Error(`axis ${parts[i].slice} was swept by two slices`);
  }
  const rows0 = parts[0].result.results;
  for (const p of parts) {
    const rows = p.result.results;
    if (rows.length !== rows0.length) {
      throw new Error(`slice ${p.slice} reported ${rows.length} rows and ${parts[0].slice} reported ${rows0.length}`
        + ' — the two ran against different tables, so their rows cannot be compared by index');
    }
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].pair !== rows0[i].pair) {
        throw new Error(`row ${i} is ${rows[i].pair} in slice ${p.slice} and ${rows0[i].pair} in ${parts[0].slice}`);
      }
    }
  }
  // THE WINNER IS DECIDED ON RAW FLOATS, NOT ON THE ROW'S `min`. The row's
  // number is rounded to four decimals for the report, and the whole run's
  // own recording rule is strict `<` on raw values — so a merge that compares
  // rounded rows resolves DISPLAY-PRECISION TIES by the first-axis rule where
  // the whole run had a strict raw order. Not theoretical: the first 13-axis
  // run attributed a floor row's 0.16 to `beat f=0` where the whole run's raw
  // minimum was at `alarmStrike f=0.6972`, one report line of drift with the
  // verdict unchanged. Every slice therefore carries `rawMins` (a narrowed
  // run's field — see checkClearances), the merge REFUSES a slice without it,
  // and the field is dropped from the merged payload so its shape stays a
  // whole run's. A capped row travels as null (Infinity does not survive
  // page.evaluate's JSON), read back as Infinity here.
  for (const p of parts) {
    if (!Array.isArray(p.result.rawMins) || p.result.rawMins.length !== rows0.length) {
      throw new Error(`slice ${p.slice} carries no rawMins — merging on the rows' rounded minima would `
        + 'mis-attribute every display-precision tie, so the merge refuses rather than guesses');
    }
  }
  const raw = (p, i) => (p.result.rawMins[i] === null ? Infinity : p.result.rawMins[i]);
  const results = rows0.map((_, i) => {
    let best = parts[0];
    let capped = typeof best.result.results[i].min === 'string' ? best.result.results[i].min : null;
    for (const p of parts.slice(1)) {
      const row = p.result.results[i];
      if (typeof row.min === 'string') {
        if (capped !== null && row.min !== capped) {
          throw new Error(`row ${i} (${row.pair}) is capped at ${capped} in one slice and ${row.min} in ${p.slice}`
            + ' — the cap is the row\'s own floor plus the band and cannot differ between slices');
        }
        capped ??= row.min;
      }
      if (raw(p, i) < raw(best, i)) best = p;   // strict on RAW: the earliest axis keeps a true tie
    }
    return best.result.results[i];
  });
  const census = sumCensus(parts);
  // §152 — CARRY THE RESTRICTION THROUGH, for mergeInspection's reason above:
  // a merged payload that loses this record looks like a WHOLE run to the
  // union step, which then returns it untouched and gates a restricted sweep
  // on its own partial rows. Every slice of one run was given the same
  // `pairsTouching`, so `keptIndices` is identical across them by
  // construction; a disagreement is a harness bug and throws.
  const restriction = parts[0].result.restriction;
  for (const p of parts) {
    if (JSON.stringify(p.result.restriction) !== JSON.stringify(restriction)) {
      throw new Error(`slice ${p.slice} was restricted differently than ${parts[0].slice}`);
    }
  }
  // The derived fields are RE-DERIVED from the merged rows, never carried: a
  // slice's own `violations` list judges only its axis. These two expressions
  // are the checks' own, and their twins live in battery-union.mjs's
  // unionCheck — edit one and the other is the second place to look.
  //
  // The payload's KEY ORDER is part of the acceptance, so each shape is built
  // exactly as its check's return statement builds it (checkClearances and
  // checkExpectedContacts in inspect.js). `unmatched` is what tells the two
  // apart here — the merge is handed no check name — and it is a property of
  // the TABLE, not of the pose net, so every slice computes the same list and
  // a disagreement is a bug rather than something to union.
  if (parts[0].result.unmatched !== undefined) {
    const unmatched = parts[0].result.unmatched;
    for (const p of parts) {
      if (JSON.stringify(p.result.unmatched) !== JSON.stringify(unmatched)) {
        throw new Error(`slice ${p.slice} reported different unmatched contact selectors than ${parts[0].slice}`
          + ' — that list is read off the declared table, so it cannot depend on which axis ran');
      }
    }
    return {
      violations: results.filter((r) => !r.ok && !r.waived),
      waivedCount: results.filter((r) => !r.ok && r.waived).length,
      unmatched, results, census,
      ...(restriction ? { restriction } : {}),
    };
  }
  return { violations: results.filter((r) => !r.ok), results, census,
    ...(restriction ? { restriction } : {}) };
}

// The two extrema sweeps' rosters. Same axes as INSPECTION_SLICES above and
// the same FACT per row (`poses` = n + 1, asserted against the page), because
// there is one axis list and three checks that walk it — the assert catches an
// axis added to inspect.js and sliced nowhere, which would simply never be
// swept by that check.
//
// Declared separately rather than sharing one array: a check's roster is a
// claim about THAT check's loop, and the day one of them stops sweeping an
// axis, the roster that has to change is its own.
export const CLEARANCE_SLICES = [
  { axis: 'beat', poses: 97 },
  { axis: 'crown', poses: 49 },
  { axis: 'reserve', poses: 61 },
  { axis: 'wind', poses: 721 },
  { axis: 'arrest', poses: 97 },
  { axis: 'train', poses: 97 },
  { axis: 'jumperEngage', poses: 121 },
  { axis: 'handSet', poses: 121 },
  { axis: 'alarm', poses: 97 },
  { axis: 'alarmStrike', poses: 110 },
  { axis: 'alarmWind', poses: 110 },
  { axis: 'alarmToggle', poses: 49 },
  { axis: 'stemSlip', poses: 97 },
];

export const EXPECTED_CONTACT_SLICES = [
  { axis: 'beat', poses: 97 },
  { axis: 'crown', poses: 49 },
  { axis: 'reserve', poses: 61 },
  { axis: 'wind', poses: 721 },
  { axis: 'arrest', poses: 97 },
  { axis: 'train', poses: 97 },
  { axis: 'jumperEngage', poses: 121 },
  { axis: 'handSet', poses: 121 },
  { axis: 'alarm', poses: 97 },
  { axis: 'alarmStrike', poses: 110 },
  { axis: 'alarmWind', poses: 110 },
  { axis: 'alarmToggle', poses: 49 },
  { axis: 'stemSlip', poses: 97 },
];

// §152 — THE COSTS TABLE IS AN INPUT, AND IT IS CHECKED BEFORE IT IS USED.
//
// The measured column lives outside the digested files now, which means the
// table and the battery it describes are two lists someone keeps in step —
// exactly the drift tools/payload.sh's header names. So it is declared and
// then asserted, both ways, and a mismatch THROWS with the offender named:
//
//   · a BATTERY entry with no cost row would hand `partition` an undefined
//     cost: its comparator returns NaN, and the shard that takes the task
//     carries a NaN total that never compares as the lightest again, so the
//     partition silently stops balancing while reporting a shard list that
//     looks ordinary. `resolveAxes`' rule covers this — a mistake that
//     matches nothing must never pass for a clean answer.
//   · a cost row naming no check (or no slice of one) is the other half of
//     the same drift: a check renamed here and not there, refreshed forever
//     against nothing.
//
// A SLICE row is legal but not required: a newly declared axis has no measured
// wall until a sliced `--report` writes one, and buildTasks below projects its
// share from the pose count until then. What is not legal is a slice key that
// names an axis no check slices.
//
// The roster is derived from `entries` alone rather than taking the slice
// table as a second argument, for this function's own reason: a second list
// passed in is a second list to keep in step.
export function assertCosts(entries, costs) {
  const legal = new Set();
  const missing = [];
  for (const e of entries) {
    legal.add(e.name);
    if (costs[e.name] === undefined) missing.push(e.name);
    for (const s of e.slices ?? []) legal.add(`${e.name}:${s.axis}`);
  }
  if (missing.length) {
    throw new Error(`COSTS has no row for ${missing.join(', ')} — the partition would balance on undefined`);
  }
  const orphans = Object.keys(costs).filter((k) => !legal.has(k));
  if (orphans.length) {
    throw new Error(`COSTS names ${orphans.join(', ')}, which is no check and no slice of one`);
  }
}

// One entry per unit of schedulable work: a whole check, or one slice of a
// split check. This is what `partition` balances now.
//
// A slice's seed cost is its share of the check's measured cost BY POSE COUNT
// — a projection, and labelled one, because nothing had ever measured a single
// axis's wall. It is only ever used to balance shards, so a wrong projection
// costs wall clock and never a verdict (§81's rule, inherited). Once a sliced
// run has written the slice's `ms` back through `--report` and into COSTS, the
// measured number wins.
export function buildTasks(entries, split, costs) {
  const tasks = [];
  for (const e of entries) {
    if (!split || !e.slices) { tasks.push({ key: e.name, name: e.name, opts: e.opts, cost: costs[e.name], entry: e }); continue; }
    const totalPoses = e.slices.reduce((a, s) => a + s.poses, 0);
    for (const s of e.slices) {
      const ms = costs[`${e.name}:${s.axis}`];
      tasks.push({
        key: `${e.name}:${s.axis}`, name: e.name, slice: s.axis, entry: e,
        opts: { ...e.opts, axes: [s.axis] },
        cost: ms !== undefined ? ms / 1000 : (costs[e.name] * s.poses) / totalPoses,
        projected: ms === undefined,
      });
    }
  }
  return tasks;
}
