// §127 tier 2a — the acceptance for slicing the two EXTREMA sweeps, at a
// scale a person can iterate at.
//
// `clearances` and `expectedContacts` divide along the same axis loop
// `inspection` does, but their rows are minima rather than a union: the merge
// PICKS a winning slice's row instead of combining rows, so what has to be
// proven is different. Three things, and all three are here because each fails
// silently — a wrong pick is still a well-formed row that every gate accepts:
//
//   1. IDENTITY. Whole run over two axes == the two slices merged, byte for
//      byte. This is what tier 0's per-axis refinement reference bought: until
//      it, a slice refined a superset of a whole run's intervals and could
//      report a lower minimum, so the answer was a function of the partition.
//   2. COMPOSITION WITH §152. The same identity while RESTRICTED, and the
//      merged payload must still carry the restriction record — dropping it is
//      the mergeInspection bug (a restricted sweep gating on its own partial
//      rows, every gate green), and the union step downstream cannot tell.
//   3. THE TIE RULE, synthetically. The whole run records a minimum on a
//      strict `<`, so a tied row belongs to the earliest axis. Nothing in the
//      real movement is guaranteed to tie, so the case is built: one `>=` in
//      the merge would ship the wrong pose attribution on every tied row and
//      no natural run would necessarily catch it.
//
// Proving 1 and 2 against the real 13-axis checks costs the battery's long
// pole twice over; two cheap axes cost minutes.
//
//   node tools/probe-127-extrema.mjs [axisA axisB]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mergeExtrema } from './battery-split.mjs';

const [axisA = 'crown', axisB = 'alarmToggle'] = process.argv.slice(2);
const port = process.env.PORT || '8563';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch({ args: [
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
// index.html does not import the inspector; ci-battery.mjs installs it the
// same way, and every probe that drives checks has to.
await page.evaluate(async () => { window.__I = await import('./src/inspect.js'); });
await page.evaluate(() => window.__clock.beginSweepHold());

const run = async (name, opts) => {
  const t0 = Date.now();
  await page.evaluate(([n, o]) => window.__I.start(window.__clock, n, o), [name, opts]);
  for (let i = 0; i < 900; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const st = await page.evaluate((n) => {
      const s = window.__I.status(n);
      return s.state === 'running' ? { state: 'running' } : s;
    }, name);
    if (st.state === 'done') return { result: st.result, ms: Date.now() - t0 };
    if (st.state === 'error') throw new Error(`${name} threw:\n${st.error}`);
  }
  throw new Error(`${name} never finished`);
};

const axisMeta = (await page.evaluate(() => window.__I.AXES.map((a) => ({ name: a.name, n: a.n }))))
  .filter((a) => a.name === axisA || a.name === axisB);
const failed = [];

// The census counts WORK, and work is what slicing changes: a slice's query
// bound starts at its pair's cap rather than inheriting an earlier axis's
// running minimum (deliberately — see sweepClearances' §127 comment), so the
// same poses can be pruned at different depths. The ROWS are the verdict and
// they must be identical; the census is compared separately and reported.
const canon = (r) => {
  const c = { ...r };
  delete c.census;
  // The probe's "whole" runs are themselves narrowed (two axes of fourteen),
  // so they carry rawMins like any slice; the merge drops the field so a
  // merged payload keeps a whole run's shape. Exempt here, asserted absent
  // from the merge's output in the tie section below.
  delete c.rawMins;
  return JSON.stringify(c, null, 1);
};
const censusDelta = (whole, merged) => {
  const out = [];
  const walk = (a, b, prefix) => {
    for (const k of Object.keys(a)) {
      if (k === 'exactMs' || k === 'verdictMs') continue;   // wall clock — the report's own `ms` exemption
      if (typeof a[k] === 'object' && a[k]) walk(a[k], b[k] || {}, `${prefix}${k}.`);
      else if (a[k] !== b[k]) out.push(`${prefix}${k} whole ${a[k]} merged ${b[k]} (${b[k] - a[k] >= 0 ? '+' : ''}${b[k] - a[k]})`);
    }
  };
  walk(whole, merged, '');
  return out;
};

const compare = (label, whole, merged) => {
  const a = canon(whole), b = canon(merged);
  if (a === b) {
    console.log(`  IDENTICAL — ${label}: merged rows match the whole run byte for byte`);
  } else {
    failed.push(label);
    console.log(`  DIFFERENT — ${label}:`);
    const la = a.split('\n'), lb = b.split('\n');
    let shown = 0;
    for (let i = 0; i < Math.max(la.length, lb.length) && shown < 20; i++) {
      if (la[i] !== lb[i]) { console.log(`    L${i}\n     whole:  ${la[i]}\n     merged: ${lb[i]}`); shown++; }
    }
  }
  const deltas = censusDelta(whole.census, merged.census);
  // A nonzero count delta is not a failure — see canon's note — but it is
  // worth a look: it says the two runs did measurably different WORK for the
  // same verdict, which is the first place a bound change would show up.
  console.log(deltas.length
    ? `    census counts differ (informational, worth a look): ${deltas.join('; ')}`
    : '    census counts identical');
};

const opts = { yieldEvery: 64 };
const timings = [];

// ---- 1. the identity, whole vs merged ---------------------------------------
const sliced = {};
for (const check of ['clearances', 'expectedContacts']) {
  console.log(`\n${check} — whole [${axisA},${axisB}] vs ${axisA} + ${axisB} merged`);
  const whole = await run(check, { ...opts, axes: [axisA, axisB] });
  const partA = await run(check, { ...opts, axes: [axisA] });
  const partB = await run(check, { ...opts, axes: [axisB] });
  const parts = [{ slice: axisA, result: partA.result }, { slice: axisB, result: partB.result }];
  const merged = mergeExtrema(parts, axisMeta);
  sliced[check] = parts;
  console.log(`  ${whole.result.results.length} rows · whole ${(whole.ms / 1000).toFixed(1)}s`
    + ` · slices ${(partA.ms / 1000).toFixed(1)}s + ${(partB.ms / 1000).toFixed(1)}s`
    + ` = ${((partA.ms + partB.ms) / 1000).toFixed(1)}s summed, max ${(Math.max(partA.ms, partB.ms) / 1000).toFixed(1)}s`);
  timings.push({ check, whole: whole.ms, a: partA.ms, b: partB.ms });
  compare(`${check} whole vs merged`, whole.result, merged);
}

// ---- 2. composition with §152's restriction ---------------------------------
// A changed set that actually KEEPS rows in both declared tables, which is the
// only way `keptIndices` and the restriction record get exercised: 'Hour wheel'
// appears in both (three budgets, two floors rows), 'Stop lever' in the budgets
// alone — mixed on purpose, probe-152-restrict.mjs's reason. A set touching
// neither table keeps zero rows and the comparison is vacuous.
const TOUCHING = ['Hour wheel', 'Stop lever'];
for (const check of ['clearances', 'expectedContacts']) {
  console.log(`\n${check} — restricted to pairs touching ${TOUCHING.join(', ')}`);
  const whole = await run(check, { ...opts, axes: [axisA, axisB], pairsTouching: TOUCHING });
  const partA = await run(check, { ...opts, axes: [axisA], pairsTouching: TOUCHING });
  const partB = await run(check, { ...opts, axes: [axisB], pairsTouching: TOUCHING });
  const merged = mergeExtrema(
    [{ slice: axisA, result: partA.result }, { slice: axisB, result: partB.result }], axisMeta);
  console.log(`  ${whole.result.results.length} rows kept of the declared table`);
  if (!merged.restriction) {
    failed.push(`${check} restricted: the merged payload lost its restriction record`);
    console.log('  MISSING — the merged payload carries no restriction record: the union step would'
      + ' take it for a whole run and gate on partial rows');
  } else if (JSON.stringify(merged.restriction) !== JSON.stringify(whole.result.restriction)) {
    failed.push(`${check} restricted: the merged restriction record differs from the whole run's`);
    console.log(`  MISMATCH — restriction record\n    whole:  ${JSON.stringify(whole.result.restriction)}`
      + `\n    merged: ${JSON.stringify(merged.restriction)}`);
  } else {
    console.log(`  restriction record carried: ${merged.restriction.keptIndices.length} kept indices`);
  }
  compare(`${check} restricted whole vs merged`, whole.result, merged);
}

// ---- 3. the tie rule, synthetic ---------------------------------------------
// Built, not found: the two axes need not produce a tie on any row, and the
// rule they would exercise is the one a single `>=` gets wrong.
{
  console.log('\ntie rule — equal minima, two axes');
  const base = sliced.clearances[0].result;
  const row = base.results.findIndex((r) => typeof r.min === 'number');
  if (row < 0) {
    failed.push('tie rule: no numeric row to build a tie from');
    console.log('  SKIPPED — every row is capped, so no tie can be built (that is itself worth a look)');
  } else {
    const clone = () => JSON.parse(JSON.stringify(base));
    const first = clone(), second = clone();
    first.results[row].at = `${axisA} f=0.1234`;
    second.results[row].at = `${axisB} f=0.5678`;
    second.results[row].min = first.results[row].min;   // the tie, at both precisions
    second.rawMins = [...first.rawMins];
    // Handed over in the WRONG order too, so the merge's own sort is what
    // decides — the harness's hand-over order must not be load-bearing.
    const merged = mergeExtrema(
      [{ slice: axisB, result: second }, { slice: axisA, result: first }], axisMeta);
    const got = merged.results[row].at;
    if (got === first.results[row].at) {
      console.log(`  CORRECT — row ${row} (${base.results[row].pair}) tied at ${first.results[row].min}`
        + ` and kept ${axisA}'s pose (${got})`);
    } else {
      failed.push('tie rule: a tied row was attributed to the later axis');
      console.log(`  WRONG — tied row ${row} reports ${got}, expected ${first.results[row].at}`
        + ' — the whole run records on a strict `<`, so the earliest axis keeps a tie');
    }

    // THE DISPLAY-PRECISION NEAR-TIE — the case the first full-scale run
    // caught: two axes whose minima round to the same four decimals with a
    // strict raw order underneath. The whole run records on raw floats, so
    // the merge must too; comparing the rows' rounded `min` here attributed
    // a real row's 0.16 to `beat f=0` where the whole run's raw minimum was
    // at `alarmStrike f=0.6972`. The LATER axis must win this one.
    const nf = clone(), ns = clone();
    nf.results[row].at = `${axisA} f=0.1234`;
    ns.results[row].at = `${axisB} f=0.5678`;
    ns.results[row].min = nf.results[row].min;                 // rounded: identical
    ns.rawMins = [...nf.rawMins];
    ns.rawMins[row] = nf.rawMins[row] - 1e-6;                  // raw: strictly lower, invisible at 4 decimals
    const nearMerged = mergeExtrema(
      [{ slice: axisA, result: nf }, { slice: axisB, result: ns }], axisMeta);
    if (nearMerged.results[row].at === ns.results[row].at) {
      console.log(`  CORRECT — near-tie (raw ${ns.rawMins[row]} vs ${nf.rawMins[row]}, same rounded min)`
        + ` went to the raw winner (${nearMerged.results[row].at})`);
    } else {
      failed.push('near-tie: the merge compared rounded minima, not raw');
      console.log(`  WRONG — near-tied row went to ${nearMerged.results[row].at}, expected ${ns.results[row].at}`);
    }
    if (nearMerged.rawMins !== undefined) {
      failed.push('merged payload carries rawMins — its shape must be a whole run\'s');
    }
  }
}

console.log('');
for (const t of timings) {
  console.log(`${t.check}: whole ${(t.whole / 1000).toFixed(1)}s · summed slices `
    + `${((t.a + t.b) / 1000).toFixed(1)}s · largest slice ${(Math.max(t.a, t.b) / 1000).toFixed(1)}s`);
}
if (failed.length) {
  console.log(`\nFAILED (${failed.length}):`);
  for (const f of failed) console.log(`  · ${f}`);
} else {
  console.log('\nPASS — both sweeps slice and merge back to their whole run, restricted and not, and the tie rule holds');
}

await browser.close();
srv.kill();
process.exit(failed.length ? 1 : 0);
