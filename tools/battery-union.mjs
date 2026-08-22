// §152 — REASSEMBLING A RESTRICTED RUN INTO A WHOLE-MOVEMENT VERDICT.
//
// A restricted run measures only the pairs touching a changed unit. Gating on
// that alone would gate LESS than standing rule 4's bar — the untouched pairs
// would simply be unexamined, and a report that says nothing about them looks
// exactly like one that cleared them. So the restricted payload is UNIONED
// with the baseline's: fresh rows for the pairs this tree moved, the previous
// full run's rows for the pairs it did not, and the gates then run over a
// payload describing every pair, the way they always have.
//
// Split out of ci-battery.mjs for battery-split.mjs's reason, stated there:
// the acceptance is a byte-level identity, and a merge that can only be
// exercised by running the whole battery cannot be tested at the scale a
// person iterates at. tools/probe-152-restrict.mjs imports this module and
// proves the identity on two cheap axes in about two minutes.
//
// THE INVARIANT EVERY BRANCH BELOW KEEPS: the union of a restricted run and
// the baseline it was restricted against must be BYTE-IDENTICAL to what a full
// run of the same tree would have produced — on the pairs the baseline is
// entitled to speak for. Where that entitlement cannot be established the
// function THROWS, and the harness answers a throw by running everything.

// A pair "touches" the changed set if either of its units is in it — the same
// predicate inspect.js's resolvePairsTouching applies, restated here because
// this module runs in Node with no page to ask.
const touches = (changed, a, b) => changed.has(a) || changed.has(b);

// `inspection` — a UNION BY PAIR, and the same sort a whole run applies.
//
// The restricted run holds every pair that touches the changed set (including
// pairs that stopped contacting, which is why the baseline's rows for those
// pairs must be DROPPED rather than merged: head is authoritative wherever it
// looked). `units` and `axes` come from head; `census` is a report of work
// this run did and is head's too.
export function unionInspection(base, head, changed) {
  if (JSON.stringify(base.units) !== JSON.stringify(head.units)) {
    throw new Error('inspection: the baseline collected a different unit list — its rows cannot describe this tree');
  }
  if (JSON.stringify(base.axes) !== JSON.stringify(head.axes)) {
    throw new Error('inspection: the baseline swept a different axis set — its rows describe a different pose net');
  }
  const rows = [
    ...head.report,
    ...base.report.filter((r) => {
      const [a, b] = r.pair.split(' ⇄ ');
      return !touches(changed, a, b);
    }),
  ];
  // runInspection's own comparator, so the merged order is the order a full
  // run writes and a --report diff stays line-for-line.
  rows.sort((x, y) => (x.class === y.class ? x.pair.localeCompare(y.pair) : x.class === 'FORBIDDEN' ? -1 : 1));
  const out = { ...head, report: rows };
  // The restriction record is scaffolding for this merge, not a finding. It
  // comes off here so a unioned payload has the SHAPE of a full run's — which
  // is the whole acceptance, and would fail on one extra key.
  delete out.restriction;
  return out;
}

// The two DECLARED-TABLE checks — `clearances` and `expectedContacts`.
//
// Their rows are a table in a fixed order, so the union is positional: walk
// the baseline's rows, and wherever the restricted run kept that index, take
// its row instead. `keptIndices` is what makes this exact — a pair STRING is
// not a key here, because two budget rows may name the same pair with
// different axes, and the surviving subset alone cannot rebuild the order.
export function unionRowTable(base, head, { rowsKey, violationsFrom }) {
  const kept = head.restriction?.keptIndices;
  if (!kept) throw new Error(`${rowsKey}: a restricted payload arrived with no keptIndices — the union cannot place its rows`);
  const baseRows = base[rowsKey];
  if (!Array.isArray(baseRows)) throw new Error(`${rowsKey}: the baseline has no ${rowsKey} array`);
  if (kept.length !== head[rowsKey].length) {
    throw new Error(`${rowsKey}: ${kept.length} kept indices for ${head[rowsKey].length} rows`);
  }
  if (kept.some((i) => i >= baseRows.length)) {
    throw new Error(`${rowsKey}: a kept index is past the baseline's ${baseRows.length} rows — the table changed shape, so the baseline cannot be trusted for the rows it kept`);
  }
  const rows = baseRows.slice();
  kept.forEach((idx, k) => { rows[idx] = head[rowsKey][k]; });
  const out = { ...head, [rowsKey]: rows };
  delete out.restriction;
  Object.assign(out, violationsFrom(rows));
  // `unmatched` — the stale-selector list — is computed per row, so a
  // restricted run only ever reports it for the rows it kept. Inherit the
  // baseline's entries for the rest.
  //
  // It is reasoning-free rather than merely safe: a selector goes stale
  // because a mesh was renamed (its unit is then in the changed set, so its
  // row ran) or because the TABLE was edited (inspect.js moved, so nothing was
  // restricted at all). Merging anyway means nobody has to re-derive that
  // argument to trust the gate.
  if (Array.isArray(base.unmatched) && Array.isArray(head.unmatched)) {
    const keptPairs = new Set(kept.map((idx) => rows[idx]?.pair));
    out.unmatched = [...head.unmatched, ...base.unmatched.filter((u) => !keptPairs.has(u.pair))];
  }
  return out;
}

// `sweptOverlap` — the hull tier ran WHOLE on this tree, so the candidate list
// is head's. Only the CONFIRM verdicts are inherited, and only for candidates
// the restricted run declined to confirm.
//
// The entitlement argument, which is why this is sound: a skipped candidate
// touches no changed unit, so both its units' shape and place digests are
// identical to the baseline's, so its hulls are identical, so the baseline
// judged the same geometry at the same poses with the same code. A candidate
// with no baseline row contradicts that — it would be a pair the baseline's
// hull tier never raised — so it THROWS rather than being quietly dropped.
export function unionSweptOverlap(base, head) {
  const hs = head.sound.staticVsSwept;
  const bs = base.sound.staticVsSwept;
  const skipped = hs.skippedByRestriction || [];
  const rowKey = (v) => v.pair;   // the hull tier's own key, unique by construction
  const baseByPair = new Map();
  for (const bucket of ['violations', 'tight', 'refutedByRefinement']) {
    for (const r of bs[bucket] || []) baseByPair.set(rowKey(r), { bucket, row: r });
  }
  const add = { violations: [], tight: [], refutedByRefinement: [] };
  for (const v of skipped) {
    const hit = baseByPair.get(rowKey(v));
    if (!hit) {
      throw new Error(`sweptOverlap: ${rowKey(v)} is a hull candidate here and appears in no baseline bucket `
        + '— the baseline cannot speak for a candidate it never raised');
    }
    add[hit.bucket].push(hit.row);
  }
  // ORDER IS PART OF THE PAYLOAD. Each bucket is filled by walking the hull
  // tier's candidate list, so appending the inherited rows would reorder them
  // against what a full run writes — and byte-identity is the acceptance, which
  // one swapped row fails. The restricted run therefore carries the candidate
  // order it saw, and each merged bucket is re-sorted into it.
  const order = new Map((head.restriction?.candidateOrder || []).map((k, i) => [k, i]));
  const at = (r) => (order.has(r.pair) ? order.get(r.pair) : Infinity);
  const merged = { ...hs };
  delete merged.skippedByRestriction;
  for (const bucket of ['violations', 'tight', 'refutedByRefinement']) {
    merged[bucket] = [...(hs[bucket] || []), ...add[bucket]].sort((x, y) => at(x) - at(y));
  }
  const out = { ...head, sound: { ...head.sound, staticVsSwept: merged } };
  delete out.restriction;
  return out;
}

// The one entry point the harness calls: given a baseline report, a restricted
// result and the changed set, return the payload the gates and --report see.
//
// A check with no restriction record ran WHOLE and is returned untouched —
// which is every cheap check, deliberately (they sum to ~76 s and they are
// where a key mistake would hide, so nothing skips them).
export function unionCheck(name, baseResult, headResult, changed) {
  if (!headResult || !headResult.restriction) return headResult;
  if (!baseResult) throw new Error(`${name}: restricted, but the baseline has no payload for it`);
  switch (name) {
    case 'inspection':
      return unionInspection(baseResult, headResult, changed);
    case 'clearances':
      return unionRowTable(baseResult, headResult, {
        rowsKey: 'results',
        violationsFrom: (rows) => ({ violations: rows.filter((r) => !r.ok) }),
      });
    case 'expectedContacts':
      return unionRowTable(baseResult, headResult, {
        rowsKey: 'results',
        violationsFrom: (rows) => ({
          violations: rows.filter((r) => !r.ok && !r.waived),
          waivedCount: rows.filter((r) => !r.ok && r.waived).length,
        }),
      });
    case 'sweptOverlap':
      return unionSweptOverlap(baseResult, headResult);
    default:
      throw new Error(`${name}: restricted, but nothing knows how to union it`);
  }
}
