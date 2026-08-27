// §152 — WHAT A CHECK COMPUTES, split from the harness that schedules it.
//
// An incremental run may inherit a base run's rows only when the code that
// PRODUCED them is identical to what this run would use, and CHECK_CODE_FILES
// is that claim written as a digest. Digesting the whole harness made the
// claim true and made it expensive: every edit to ci-battery.mjs voided every
// stored verdict, including edits to code that cannot reach a stored row at
// all. Measured over 84 first-parent merges, 6 touch the harness without also
// touching src/inspect.js — and all six diffs are fresh-per-run code (five
// SPEC_POINTS additions and one paths-ignore gate), so all six voided the key
// for nothing.
//
// SO THE BOUNDARY IS INHERITABLE-PAYLOAD-PRODUCING vs FRESH-PER-RUN, not
// gates vs scheduling. This file is the first side: what a check is asked to
// compute (BATTERY's `opts` and the slice wiring), the in-page protocol that
// computes it (runCheck), the boot a payload is measured on (virginBoot,
// prepPage), and which checks may be narrowed (RESTRICTABLE). It is digested.
// Everything that runs fresh every run — the spec boots, the paths-ignore
// gate, the fingerprint and digest anchors, the partition, the cost column,
// the logging — stays in ci-battery.mjs and is not, because nothing any of it
// produces is ever stored for a later run to inherit.
//
// Two consequences worth keeping. SCHEDULING VALUES ARE PASSED IN, NEVER
// IMPORTED (CHECK_TIMEOUT_MS, BOOT_TIMEOUT_MS): a guard someone widens is
// wall clock and never a verdict, so it must not be able to move this digest.
// And ci-battery.mjs imports FROM here and never the reverse — a cycle would
// put the fresh side back inside the digested one, which is the whole thing
// this split undoes.
//
// `fails` and `note` are read only while a run reports and so are fresh-side
// by that test; they ride along anyway, an accepted residue. Splitting them
// from `opts` would make two name-keyed tables someone keeps in step, which is
// the failure tools/payload.sh's header names. A rare `note` edit voids the
// key.
import { INSPECTION_SLICES, CLEARANCE_SLICES, EXPECTED_CONTACT_SLICES, mergeInspection, mergeExtrema } from './battery-split.mjs';

// Why yieldEvery 64: measured, not guessed — see CLAUDE.md's yield-throttling
// trap. The default 16 is tuned for a human-visible tab; 384 wedged a tab.
// Headless Chromium is launched with background-timer throttling disabled, so
// the setTimeout(0) naps cost microseconds here, but 64 keeps each blocking
// chunk short enough that the status() poll stays live either way.
export const YIELD_EVERY = 64;

// The battery, in the order the gates are REPORTED: cheap and synchronous
// first so a broken graph reads first, the expensive sweeps last. Each entry
// names the gate standing rule 4 states for it and how to judge the check's
// payload. Its measured wall clock lives in ci-battery.mjs's COSTS, keyed by
// the name below.
export const BATTERY = [
  { name: 'support', opts: {},
    gate: '0 failures',
    fails: (r) => r.failures },
  { name: 'graph', opts: {},
    gate: 'every violation list empty (todo allowed)',
    fails: (r) => Object.entries(r)
      .filter(([k]) => k !== 'todo')
      .flatMap(([k, v]) => (Array.isArray(v) && v.length ? [{ [k]: v }] : [])) },
  // §161 — the override merge's guarantees, over a fixture table. First in the
  // report because it is the cheapest thing here and the only one that needs
  // no scene: a pure function against throwaway objects, with a control row
  // asserting it left the live schema (and therefore the fingerprint read on
  // this same boot) untouched. It gates what an imported file and a shared
  // link will both rest on — the type anchor, the `_bounds` clamp and the
  // unknown-key refusal — which until now were asserted only by a paragraph.
  { name: 'aestheticsMerge', opts: {},
    gate: 'every fixture matches exactly, and the live schema is unmoved',
    fails: (r) => r.failures,
    note: (r) => `${r.fixtures} fixtures — ${r.applied} applied, ${r.refused} refused, `
      + `${r.clamped} clamped; control ${r.control}` },
  // TODO 54 — the pose contract every sweep below rests on, so it reads early:
  // if canonical axis entry does not hold, the sweeps' findings are a function
  // of AXES' declaration order and §127's partition is measuring a different
  // movement in each shard. Its leak tier is a report (see checkAxisEntry).
  { name: 'axisEntry', opts: {},
    gate: 'every ordered axis pair reproduces the entered axis exactly',
    fails: (r) => r.violations,
    note: (r) => `${r.pairsTested} ordered pairs; without the entry ${r.leak.pairsLeaking} leak, `
      + `${r.leak.units.length} units move (worst ${r.leak.units[0]?.unit ?? '—'} ${r.leak.units[0]?.worst ?? 0})` },
  { name: 'penetration', opts: {},
    gate: 'every budget row OK or waived (waived rows reported as debt)',
    fails: (r) => r.filter((row) => row.status !== 'OK' && row.status !== 'WAIVED'),
    note: (r) => { const w = r.filter((row) => row.status === 'WAIVED').length; return w ? `${w} waived (accepted debt)` : null; } },
  { name: 'alarmHandoffs', opts: {},
    gate: 'every declared hand-off within ±tol of touch at both parities, or waived',
    fails: (r) => r.unwaived,
    note: (r) => `${r.rows.length} hand-offs, ${r.waivedCount} waived (accepted debt)` },
  // §47 — the going side's two arrest contacts, the same instrument as the
  // alarm rows through its own pose table (full wind = shut, slack = free).
  { name: 'windArrestHandoff', opts: {},
    gate: 'the arrest shut at full wind and free at slack, both contacts',
    fails: (r) => r.unwaived,
    note: (r) => `${r.rows.length} hand-offs, ${r.waivedCount} waived (accepted debt)` },
  // TODO 50 — the stem clutch's coupling: contact at every engaged parity
  // (seated faces, backlash tip-on-valley, camming ramps — the yoke spring
  // holds the one-sided constraint closed), free pulled out.
  { name: 'stemClutchHandoff', opts: {},
    gate: 'the coupling in contact seated/backlash/camming and free pulled out',
    fails: (r) => r.unwaived,
    note: (r) => `${r.rows.length} hand-offs, ${r.waivedCount} waived (accepted debt)` },
  { name: 'stockFloor', opts: {},
    gate: '0 degenerate and 0 unwaived',
    fails: (r) => [...r.degenerate, ...r.violations],
    note: (r) => `${r.rowsChecked} rows, ${r.waivedCount} waived (accepted debt)` },
  // §54 / TODO 78 — §50's floor and this ceiling are one pair, and this half
  // had never run in CI: `checkSlenderness` was exported and never registered
  // in inspect.js's CHECKS, so every λ in the source was a hand number and
  // SLENDER_WAIVERS waived rows in a report nothing produced. A REPORT (§40),
  // and for the same reason meshIntegrity is: docs/BUILT.md §54 records 8 rows
  // over the ceiling and 6 unwaived at its own landing, so gating `unwaived`
  // on arrival would land CI red on day one — which §54's banner names as how
  // a check gets switched off. What IS gated is what can be held: the
  // synthetic control, and every declared bearing table's validity (malformed,
  // and a declared support with no metal at it — the INTRA_UNIT_CONTACTS
  // stale-selector precedent, and §48's no-spring rule made geometric).
  // §137 adds one more gateable tier to the same list: WAIVER STALENESS. A
  // SLENDER_WAIVERS entry naming a unit with no over-ceiling row is a standing
  // excuse whose debt was already paid, waiting for a new offender to hide
  // under — so deleting a fix's waiver becomes structurally part of the fix.
  // It gates without touching §54's report covenant, because it judges the
  // TABLE rather than the λ rows.
  { name: 'slenderness', opts: {},
    gate: 'control PASS, 0 malformed and 0 unsupported bearing declarations, 0 stale waivers — the λ rows are a REPORT (§40)',
    fails: (r) => [
      ...(String(r.control).startsWith('PASS') ? [] : [{ control: r.control }]),
      ...r.bearings.malformed,
      ...r.bearings.unsupported,
      ...(r.staleWaivers || []),
    ],
    note: (r) => `${r.counted} meshes, ${r.exemptByKind} exempt by kind; ${r.over} over ceiling `
      + `(${r.unwaived} unwaived — untriaged, §40); ${r.bearings.declaredMeshes} declare `
      + `${r.bearings.stations} bearings, overhang K ${r.overhangK}` },
  // §77 tiers 0+1 — a REPORT (§40): the zeroArea and inverted rows land red
  // by design (3,233 zero-area triangles and 4 inverted bodies measured on
  // arrival, triaged into TODO.md) and are NOT gated; what is gated is what
  // can be held on day one — the in-check synthetic controls and every
  // declared sub-body table's validity (a malformed table is a stale
  // selector, the INTRA_UNIT_CONTACTS precedent).
  // TODO 100 — a cut outline is a simple polygon, or it is not an outline.
  // Unlike meshIntegrity and slenderness above, this one GATES ITS ROWS rather
  // than reporting them, and it can because the movement was measured clean
  // first: §175 cut the pallet fork's five crossings and §177 the column
  // driver's 31, and only then was there a gate to add. §54's banner names
  // landing a check red as how a check gets switched off.
  //
  // The third gate is coverage, and it is the one that matters most. The first
  // version of this sweep read 3 geometries of 573 and answered `0 crossings`
  // — a clean result for a question it was not asking — because `weldGeometry`
  // dropped the source shape. An EXTRUDE with no readable shape therefore
  // fails; a cylinder or a box never had one and is counted instead.
  { name: 'outlines', opts: { yieldEvery: YIELD_EVERY },
    gate: 'controls PASS, 0 self-crossing rings, and every extrude\'s authored shape is readable',
    fails: (r) => [...(String(r.control).startsWith('PASS') ? [] : [{ control: r.control }]),
      ...r.violations,
      ...r.noShape.map((n) => ({ extrudeWithNoReadableShape: `${n.unit} / ${n.mesh}` }))],
    note: (r) => `${r.read} of ${r.geometries} geometries carry an authored shape, ${r.rings} rings tested; `
      + `${r.withoutShape.map((w) => `${w.count} ${w.type}`).join(', ')} never had one` },
  { name: 'meshIntegrity', opts: { yieldEvery: YIELD_EVERY },
    gate: 'controls PASS and 0 malformed sub-body declarations — zeroArea/inverted rows are a REPORT (§40)',
    fails: (r) => [...(String(r.control).startsWith('PASS') ? [] : [{ control: r.control }]), ...r.subBodies.malformed],
    note: (r) => `${r.geometries} geometries / ${r.triangles} tris: zeroArea ${r.zeroArea.total} in ${r.zeroArea.geometries} geometries (${r.zeroArea.exactZero} exact), `
      + `${r.inverted.rows.length} inverted, subBodies ${r.subBodies.bodies} in ${r.subBodies.declaredGeometries} geometries; `
      + `pairs ${r.subBodies.pairs.tested} tested / ${r.subBodies.pairs.skippedDeclaredOverlap} declared / ${r.subBodies.pairs.rows.length} interior` },
  // TODO 104 tier A rides this row's gate rather than a row of its own: the
  // declarations it judges are the same table whose stale selectors already
  // fail here, and they are measured inside the same pose loop. `declaredApart`
  // is the failure — a row excusing a pair that never comes within
  // DECLARED_CONTACT_REACH. `declaredNeverCompared` is REPORTED beside it and
  // is a different defect (a row filed against a tier that cannot see the
  // pair); nothing measured here establishes where such a row should live, so
  // it is not gated, and neither is a row whose query THREW — a pair the
  // geometry cannot measure is not a pair that is far apart, which is the
  // tiers' own `unmeasurable` rule. What does fail beside `declaredApart` is
  // `declaredDegenerate`: a row whose two labels name the one same mesh
  // resolves to no pair at all and would drop out of every count in silence.
  { name: 'intraUnit', opts: { yieldEvery: YIELD_EVERY },
    gate: '0 unwaived intra-unit intersections (MF everywhere; FF/MM inside INTRA_TIER_SCOPE), 0 unmatched selectors, 0 declared rows that excuse nothing, 0 malformed declarations',
    fails: (r) => [...r.violations, ...r.unmatchedSelectors.map((u) => ({ unmatchedIntraUnitSelector: u })),
      ...r.declaredApart.map((d) => ({ declarationExcusesNothing: `${d.unit} / ${d.a} \u21c4 ${d.b}`, nearestD: d.nearestD, tiers: d.tiers, why: d.why })),
      ...r.declaredDegenerate.map((d) => ({ malformedDeclaration: `${d.unit} / ${d.a} \u21c4 ${d.b}`, why: 'both labels name the one same mesh — the row resolves to no pair at all' }))],
    note: (r) => `${r.movers} movers in ${r.frames} frames over ${r.poses} poses; pairs MF ${r.tiers.MF}/FF ${r.tiers.FF}/MM ${r.tiers.MM}, `
      + `${r.outOfScope.length} out of scope (reported), ${r.waived.length} waived (accepted debt), ${r.unmeasurable.length} unmeasurable (reported); `
      + `${r.declared.length} declarations (reach ${r.declaredReach}, ${r.declaredNeverCompared.length} no tier compares, `
      + `${r.declaredUnmeasurable.length} unmeasurable \u2014 both reported)` },
  // §107 — TODO 5's other half. `intraUnit` above compares movers against
  // their own unit's FIXTURES, so two meshes that always move together were
  // never measured by anything: §104's governor anchor shipped with one pallet
  // blade 0.236 clear of the arm carrying it, through a fully green battery,
  // and the owner found it by looking at the screen. §48's rule holds — `ok`
  // is always true and the rows are the product — so what is gated is what the
  // population supports: the units in ASSEMBLY_SCOPE. Everything else reports.
  { name: 'assembly', opts: {},
    gate: '0 undeclared, unwaived splits among the scoped units',
    fails: (r) => r.violations,
    note: (r) => `${r.rowsChecked} split rigid groups over ${r.poses} poses, `
      + `${r.outOfScope.length} out of scope (reported), ${r.waived.length} waived (accepted debt)` },
  { name: 'expectedContacts', opts: { yieldEvery: YIELD_EVERY },
    slices: EXPECTED_CONTACT_SLICES, merge: mergeExtrema,   // §127 tier 2a — same axis loop, rows merged as extrema
    gate: '0 unwaived floor rows, 0 unmatched contact selectors',
    fails: (r) => [...r.violations, ...r.unmatched.map((u) => ({ unmatchedContactSelector: u }))],
    note: (r) => `${r.results.length} pairs, ${r.waivedCount} waived (accepted debt)` },
  { name: 'oscillator', opts: {},
    gate: 'the spring is cut to the beat, in real hairspring stock',
    fails: (r) => r.failures,
    note: (r) => `implied ${r.impliedHz} Hz vs spec ${r.specHz} Hz, ribbon ${r.spring.h_mm.toFixed(4)} mm (stock ${r.spring.windowMm[0]}–${r.spring.windowMm[1]})` },
  // TODO 32 — the going spring's torque law is DERIVED now, and this holds
  // the derivation: set-up quantised to the ratchet, the fusee's level
  // product an identity at float noise, and both ribbons' published sections
  // still describing the metal the records' k was computed from.
  { name: 'equalisation', opts: {},
    gate: 'set-up on a ratchet click, level product at float noise, sections declared = cut',
    fails: (r) => r.failures,
    note: (r) => r.summary },
  // TODO 40 row 3's missing instrument. The row named the hole and left it:
  // nothing in the battery ever stated that a chain is a fixed length of
  // steel, so the run's closure error was invisible to every green run. The
  // tolerance is not a judgement call — `buildChainLinkGeometry` lays
  // `N = round(len / CHAIN_PITCH)` links, so half a pitch is the granularity
  // at which the run demonstrably becomes a different chain. It costs 38 ms
  // (41 curve evaluations), which is why it reads here rather than being
  // deferred behind the sweeps.
  { name: 'chainLength', opts: {},
    gate: "the run's length constant across the reserve to half a link pitch, or waived",
    fails: (r) => r.violations,
    note: (r) => { const row = r.rows[0]; return `spread ${row.spread} u (${row.spreadPct}%) against ${row.tol} u; `
      + `links ${row.linkCounts.join('/')}${row.waived ? ' — WAIVED (accepted debt)' : ''}`; } },
  // §48's no-spring audit, gated for the first time (TODO 29). It was
  // exported and never registered, so nothing could run it — a clean report
  // from an instrument nobody runs looks like coverage and is not. §48's own
  // rule that it is a REPORT is kept: `ok` is always true and the rows are
  // the product, so what is gated is the part that CAN be gated — every
  // reversing part either has a restoring element, is driven both ways, or is
  // waived against a filed TODO. The control is gated too: a positive control
  // that quietly stops passing is how this class of check dies.
  //
  // §162 (TODO 87 finding 4) adds the MEMBER tier beside it. The unit gate
  // above cannot see a unit with two reciprocators answering with one of them,
  // which is how 'Alarm switch' passed on the click arm's blade while the
  // pusher's return stayed a rate constant with no metal. The tier derives the
  // bodies (clusterByFrame over each unit's reversing meshes) and asks the
  // question per body — REPORTED movement-wide, GATED inside
  // RESTORING_MEMBER_SCOPE, §121's convention for a tier arriving on a
  // movement nobody has triaged for it. Two things are held everywhere, not
  // just in scope: a member selector that resolves to no mesh in its unit
  // (INTRA_UNIT_CONTACTS' rule — a declaration pointing at absent metal reads
  // as an answer and is not one), and a waiver naming a body that IS answered.
  { name: 'restoring', opts: { yieldEvery: YIELD_EVERY },
    gate: '0 unwaived restored-by-nothing, 0 malformed, 0 stale, control PASS; member tier: 0 unwaived in scope, 0 unmatched selectors, 0 stale waivers',
    fails: (r) => [
      ...r.unwaived,
      ...r.malformedDeclarations,
      ...r.staleDeclarations,
      ...(r.memberUnwaived || []),
      ...(r.unmatchedMemberSelectors || []),
      ...(r.memberStaleWaivers || []).map((k) => ({ staleMemberWaiver: k })),
      ...(String(r.control).startsWith('PASS') ? [] : [{ control: r.control }]),
    ],
    note: (r) => `${r.population} reversing units, ${r.twoWayDriven.length} two-way, `
      + `${r.restoredByDeclaredElement.length} sprung, ${r.waived.length} waived (accepted debt)`
      + `; members ${(r.memberRows || []).length} bodies (${r.memberUnitWide} unit-wide, `
      + `${r.memberUndeclared} undeclared — REPORTED, §121's convention), `
      + `scope ${(r.memberScope || []).join('/')}: ${(r.memberWaived || []).length} waived` },
  // §137 — the transfer audit. Same shape as `restoring`: the rows are the
  // product (`ok` is always true), and the gate holds what CAN be held — a
  // declaration that is malformed, names a part that no longer exists, whose
  // own arithmetic no longer recomputes, or that busts its declared envelope
  // without a cited TODO. The control is gated for the same reason as §48's:
  // a classifier that quietly stops catching bad rows is a dead instrument.
  { name: 'transfers', opts: {},
    gate: '0 malformed, 0 stale, 0 mismatched, 0 unwaived envelope misses, 0 stale waivers, control PASS',
    fails: (r) => [
      ...r.malformed, ...r.stale, ...r.mismatched, ...r.unwaived,
      ...(r.staleWaivers || []),
      ...(String(r.control).startsWith('PASS') ? [] : [{ control: r.control }]),
    ],
    note: (r) => `${r.population} transfers (`
      + Object.entries(r.byIdiom).map(([k, n]) => `${n} ${k}`).join(', ')
      + `), ${r.waived.length} waived (accepted debt)` },
  { name: 'inspection', opts: { includeExcluded: true, yieldEvery: YIELD_EVERY },
    slices: INSPECTION_SLICES, merge: mergeInspection,   // §127 — divisible along its axis loop
    gate: '0 FORBIDDEN pairs',
    fails: (r) => r.report.filter((row) => row.class === 'FORBIDDEN'),
    note: (r) => `${r.units.length} units, ${r.report.length} contacting pairs` },
  { name: 'clearances', opts: { yieldEvery: YIELD_EVERY },
    slices: CLEARANCE_SLICES, merge: mergeExtrema,   // §127 tier 2a — the battery's long pole, divided by axis
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

// The four checks a changed-unit list may narrow, and the only four. Each was
// measured separately (roadmap §152's per-check table); `sweptOverlap` leads
// because 96.5% of it is a confirm tier over 18 candidates that 35 of the 56
// units appear in none of.
export const RESTRICTABLE = new Set(['sweptOverlap', 'inspection', 'clearances', 'expectedContacts']);

// A local copy rather than an import: ci-battery.mjs imports from here, so
// reaching back for a formatter would be a cycle — and the header's rule is
// that nothing fresh-side is imported into the digested side.
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

// Boot a VIRGIN page: fresh browser context (no localStorage) after deleting
// the dev server's state file, so nothing of a previous session leaks in —
// the determinism gate is only meaningful between two boots that start equal.
//
// `bootTimeoutMs` is passed in rather than declared here: it is a scheduling
// guard, and widening a guard must not void the check-code key.
export async function virginBoot(browser, base, bootTimeoutMs) {
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
  await page.goto(`${base}/index.html`, { waitUntil: 'load', timeout: bootTimeoutMs });
  try {
    await page.waitForFunction(() => !!window.__clock, null, { timeout: bootTimeoutMs });
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
    const lines = [`the build never finished booting (no __clock after ${secs(bootTimeoutMs)})`];
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

// Take the sweep hold for the whole run and snapshot the boot warns, in one
// eval — the state every shard's page is left in before its first check.
//
// Why the harness takes the sweep hold at all: only buildSweptRegistry and
// checkLowCorridor hold it themselves, so during the other sweeps the rAF loop
// keeps rendering — on CI's software GL (SwiftShader) those paints are pure
// overhead stolen from the sweep. The checks drive poses through setPose and
// never need a paint, so the geometry-frozen page is exactly what they want.
// beginSweepHold is a counter, so the two checks that take it anyway nest
// cleanly.
//
// It lives on the digested side because it is PAYLOAD-LOAD-BEARING and not an
// optimisation: rows appear without it (CLAUDE.md's trap), so a page prepared
// differently is a page that measures differently.
export async function prepPage(page) {
  return page.evaluate(() => {
    window.__clock.beginSweepHold(); // frozen for the whole battery — see above
    return window.__clock.bootWarns.slice();
  });
}

// The in-page start/status protocol, which is what a check's payload IS: what
// is started, with which opts, and what shape is read back.
//
// `timeoutMs` is passed in for virginBoot's reason — it is a wedged-tab guard,
// scheduling rather than verdict.
export async function runCheck(page, name, opts, timeoutMs) {
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
    if (Date.now() - t0 > timeoutMs) throw new Error(`check ${name} exceeded ${secs(timeoutMs)}`);
  }
}
