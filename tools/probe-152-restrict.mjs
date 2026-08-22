// §152 — THE ACCEPTANCE FOR THE RESTRICTION, at a scale a person can iterate at.
//
// The claim the whole entry rests on: a restricted run's rows are BYTE-
// IDENTICAL to a full run's on the pairs both ran, and unioning a restricted
// run with a full run's payload reproduces that full payload exactly. Proving
// that against the real sweeps costs ~2 x 51 min; proving it on two cheap axes
// with a hand-picked changed set costs a couple of minutes and exercises every
// line that could break it — the pair-loop filter, the two declared tables'
// index bookkeeping, the confirm tier's candidate filter, and all four union
// branches.
//
// This is probe-127-split.mjs's shape and probe-127-split.mjs's argument: the
// merge that makes a partition legal has to be testable without the workload
// the partition exists to shorten.
//
//   node tools/probe-152-restrict.mjs ['Unit A' 'Unit B' ...]
//
// The default changed set is deliberately MIXED — one heavy unit that appears
// in the hull candidates and one light unit that appears in nothing — because
// a set of only-heavy or only-light units exercises one side of every filter.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { unionCheck } from './battery-union.mjs';

const CHANGED = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['Alarm link', 'Maintaining detent'];
const AXES = ['crown', 'alarmToggle'];
const port = process.env.PORT || '8553';
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
await page.evaluate(async () => { window.__I = await import('./src/inspect.js'); });
await page.evaluate(() => window.__clock.beginSweepHold());

const run = async (name, opts) => {
  await page.evaluate(([n, o]) => window.__I.start(window.__clock, n, o), [name, opts]);
  for (let i = 0; i < 1800; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const st = await page.evaluate((n) => {
      const s = window.__I.status(n);
      return s.state === 'running' ? { state: 'running' } : s;
    }, name);
    if (st.state === 'error') throw new Error(`${name}: ${st.error}`);
    if (st.state !== 'running') return st;
  }
  throw new Error(`${name} never finished`);
};

// The four sweeps, at options cheap enough to run twice. `sweptOverlap` is the
// exception that proves the point about cost: its hull tier is whole either
// way, so the probe runs it at `confirm: true` and the difference it measures
// IS the confirm tier.
const CASES = [
  { name: 'inspection', opts: { includeExcluded: true, yieldEvery: 64, axes: AXES } },
  { name: 'clearances', opts: { yieldEvery: 64, axes: AXES } },
  { name: 'expectedContacts', opts: { yieldEvery: 64, axes: AXES } },
  { name: 'sweptOverlap', opts: { yieldEvery: 64 } },
];

const fail = [];
const rows = [];
for (const { name, opts } of CASES) {
  const full = await run(name, opts);
  const restricted = await run(name, { ...opts, pairsTouching: CHANGED });
  const merged = unionCheck(name, full.result, restricted.result, new Set(CHANGED));
  const a = JSON.stringify(canon(merged), null, 1).split('\n');
  const b = JSON.stringify(canon(full.result), null, 1).split('\n');
  const same = a.length === b.length && a.every((l, i) => l === b[i]);
  if (!same) {
    // Name the first divergence. "not identical" is a verdict; the line that
    // stopped matching is a diagnosis, and this probe exists to be iterated on.
    const i = a.findIndex((l, k) => l !== b[k]);
    fail.push({ check: name, why: 'the union is not byte-identical to the full run',
      firstDiff: { line: i, union: a[i] ?? '(ends)', full: b[i] ?? '(ends)',
        context: b.slice(Math.max(0, i - 4), i + 2) } });
  }
  rows.push({
    check: name,
    fullMs: full.ms,
    restrictedMs: restricted.ms,
    saved: `${(100 * (1 - restricted.ms / full.ms)).toFixed(1)}%`,
    unionMatchesFull: same,
  });
}

// The two fields that are wall-clock or work-done rather than verdict, and so
// are expected to move between a full and a restricted run. `--report`'s own
// `ms` exemption, applied to the census the same reasoning covers: a census
// counts what a run DID, and a restricted run did less on purpose.
function canon(r) {
  const c = JSON.parse(JSON.stringify(r));
  delete c.census;
  if (c.sound?.staticVsSwept) delete c.sound.staticVsSwept.pairsTested;
  return c;
}

console.table(rows);

// ---- THE NEGATIVE CONTROL: an induced stale green ------------------------
//
// Everything above shows the union is FAITHFUL — it reproduces a full run
// exactly. Faithful is not the same as safe, and the difference is the whole
// risk of this feature: the union inherits whatever the baseline said, so if
// the KEY ever misses a change, a restricted run will confidently report the
// previous tree's verdict for geometry that has moved. That is the stale
// green, and it is worth demonstrating rather than describing.
//
// So: perturb a unit's metal, then restrict a sweep to a changed set that does
// NOT name it — exactly what a missed key would produce — and confirm the
// union comes back with the stale rows. It must NOT match the full run of the
// perturbed tree. If it does, this probe is measuring nothing.
//
// What catches it in production is the unfiltered push-to-`main` run, which is
// never incremental and re-measures every merged tree whole.
{
  const AX = ['crown'];
  const before = await run('inspection', { includeExcluded: true, yieldEvery: 64, axes: AX });
  const moved = await page.evaluate(() => {
    // Drive a mesh of one unit through another. Any real perturbation would
    // do; a large one keeps the probe's single axis enough to see it.
    const c = window.__clock;
    const e = c.labelEntries.find((x) => x.name === 'Maintaining detent');
    let m = null;
    (function walk(o) { if (!m && o.isMesh && o.geometry?.attributes?.position) m = o; for (const ch of o.children) walk(ch); })(e.obj);
    // A SCALE, not a nudge: the first draft translated the mesh 3 units and
    // the full run reported the same rows, so the control proved nothing —
    // the part simply landed in free space. Blowing it up guarantees new
    // contacts on any axis, which is what a negative control needs.
    m.userData.__probeS = m.scale.clone();
    m.scale.setScalar(20);
    m.updateMatrix();
    return e.name;
  });
  const afterFull = await run('inspection', { includeExcluded: true, yieldEvery: 64, axes: AX });
  // The changed set a MISSED key would hand the sweeps: everything except the
  // unit that actually moved.
  const wrongSet = ['Alarm link'];
  const afterRestricted = await run('inspection', { includeExcluded: true, yieldEvery: 64, axes: AX, pairsTouching: wrongSet });
  const stale = unionCheck('inspection', before.result, afterRestricted.result, new Set(wrongSet));
  await page.evaluate(() => {
    const c = window.__clock;
    const e = c.labelEntries.find((x) => x.name === 'Maintaining detent');
    let m = null;
    (function walk(o) { if (!m && o.isMesh && o.geometry?.attributes?.position) m = o; for (const ch of o.children) walk(ch); })(e.obj);
    m.scale.copy(m.userData.__probeS); m.updateMatrix();
  });
  // The claim is NOT that the union equals the pre-perturbation payload — the
  // wrong set still names a unit the blown-up part now touches, so the
  // restricted run legitimately finds some of the new rows. The claim is that
  // it MISSES the rest, silently, and reports the result as a verdict.
  const pairsOf = (r) => new Set(r.report.map((x) => x.pair));
  const beforeP = pairsOf(before.result), fullP = pairsOf(afterFull.result), unionP = pairsOf(stale);
  const newPairs = [...fullP].filter((k) => !beforeP.has(k));
  const missed = newPairs.filter((k) => !unionP.has(k));
  console.log(`negative control (${moved} perturbed, restricted to ${wrongSet.join(', ')}): `
    + `a full run finds ${newPairs.length} new contacting pair(s); the union MISSES ${missed.length} of them`);
  if (!newPairs.length) fail.push({ check: 'negative control', why: 'the perturbation produced no new pairs — the control proves nothing' });
  else if (!missed.length) fail.push({ check: 'negative control', why: 'the union caught every new pair, so this changed set was not actually wrong' });
  else console.log(`  missed: ${missed.slice(0, 4).join(' · ')}${missed.length > 4 ? ' …' : ''}`);
  console.log('  ^ THIS IS THE STALE GREEN, induced on purpose. Nothing in a restricted run can');
  console.log('    see it; what catches it is the unfiltered push-to-main run, which is never incremental.');
}

// The throw path is half the contract: a name that matches nothing must fail
// loudly, because a typo that silently restricted every sweep to no work would
// report a green battery of nothing done.
let threw = null;
try {
  await run('clearances', { yieldEvery: 64, axes: ['crown'], pairsTouching: ['Nonexistent part'] });
} catch (err) { threw = String(err.message); }
if (!threw || !/unknown unit name/.test(threw)) {
  fail.push({ check: 'resolvePairsTouching', why: `an unknown unit name did not throw (got ${threw})` });
}
console.log(`unknown-name throw: ${threw ? 'OK' : 'DID NOT THROW'}`);
console.log(`changed set: ${CHANGED.join(', ')} · axes: ${AXES.join(', ')}`);

await browser.close(); srv.kill();
if (fail.length) { console.error('FAILED:', JSON.stringify(fail, null, 1)); process.exitCode = 1; }
else console.log('PASS — every restricted run unions back to its full run byte for byte');
