// TODO 186 B1 — THE ACCEPTANCE FOR THE SPEC-POINT SWEEPS, at a scale a person
// can iterate at. Exits non-zero on any failed control.
//
// The harness sweeps each silent spec point restricted to the units it
// changes and UNIONS the result with a base it is entitled to: this run's
// default build (FULL) or the point's own stored whole payload (INCREMENTAL).
// Both are §152's claim carried to a second pair of builds, so this is
// probe-152-restrict.mjs's argument carried with it — and NOT that probe: that
// one proves the tree-to-tree union over five sweeps; this one proves the
// build-to-build union (a unit list that may differ) over the three a point
// sweeps. It calls battery-points.mjs's own
// sweepPoint / judgePoint / decidePointMode, never a copy.
//
//   1  THE KEY SEES A POINT: `studr=4.71` changes its hairspring and the
//      2-leg route ADDS a unit, and both land in the changed set (must-hit —
//      a key that saw nothing would union every point to the default).
//   2  FULL UNION == FULL SWEEP: for `studr=4.71` and the 2-leg route (a point
//      that ADDS a unit), the point swept restricted to its changed units and
//      unioned with the default's payload is byte-identical to the point swept
//      whole.
//   3  INCREMENTAL UNION == FULL SWEEP: that whole payload stored as a
//      baseline, a fresh restricted sweep over a hand-picked mixed set unioned
//      against it reproduces it byte for byte.
//   4  A BROKEN POINT FAILS: the same point with its hairspring blown up after
//      the key is taken judges FINDING, and unmutated it judges CLEAN.
//   5  NO CACHE ENTRY RUNS FULL: decidePointMode over every way a stored file
//      can fail to qualify, each must answer FULL; only a whole, current,
//      matching entry answers INCREMENTAL.
//   6  THE CEILING NEVER READS CLEAN: a point whose deadline has passed is
//      SKIPPED, and judges 'skipped'.
//
// Axes crown + alarmToggle (the two cheap ones probe-152 uses); ~20 min on a
// 4-vCPU dev container.
//
//   node tools/probe-186-points.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepPage, runCheck, virginBoot, BATTERY } from './battery-checks.mjs';
import { unionCheck } from './battery-union.mjs';
import { POINT_CHECKS, POINTS_FORMAT_VERSION, decidePointMode, judgePoint, sweepPoint } from './battery-points.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AXES = ['crown', 'alarmToggle'];
const STUDR = { name: 'studr=4.71', q: 'studr=4.71' };
const ROUTE = { name: 'route=2-leg', q: 'route=-16,-27.71,-6;-16,-27.71,3;-18.5,-32.04,3&routebush=0,0.33' };
const BALSTEP = { name: 'balstep=60', q: 'balstep=60' };
const BOOT = 300000, CHECK = 3600000;

const port = await new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const stateDir = mkdtempSync(join(tmpdir(), 'probe-186-'));
const srv = spawn('python3', [join(ROOT, 'dev_server.py'), String(port)], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, TMPDIR: stateDir } });
process.on('exit', () => { srv.kill(); rmSync(stateDir, { recursive: true, force: true }); });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; ; i++) { try { await fetch(`${base}/index.html`); break; } catch { if (i > 100) throw new Error('no server'); await new Promise((r) => setTimeout(r, 200)); } }
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const inTurn = (fn) => fn();

const fail = [];
const check = (ok, what, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`); if (!ok) fail.push({ what, detail }); };

// What varies between two runs that measured the same thing: the census (work
// done), the sliced-run scaffolding, and the restriction record — the same
// three exemptions probe-152-restrict makes.
function canon(r) {
  const c = JSON.parse(JSON.stringify(r));
  delete c.census; delete c.rawMins; delete c.controlRaw; delete c.restriction;
  return JSON.stringify(c);
}
const firstDiff = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return `at ${i}: …${a.slice(Math.max(0, i - 80), i + 80)}… vs …${b.slice(Math.max(0, i - 80), i + 80)}…`; };

async function boot(q) {
  const P = await virginBoot(browser, base, BOOT, q ? `?trial=1&${q}` : '');
  await prepPage(P.page);
  return P;
}
async function sweepAll(page, extra = {}) {
  const out = {};
  for (const name of POINT_CHECKS) {
    const e = BATTERY.find((x) => x.name === name);
    out[name] = (await runCheck(page, name, { ...e.opts, axes: AXES, ...extra }, CHECK)).result;
  }
  return out;
}
const digestsOf = (page) => page.evaluate(() => window.__I.unitDigests(window.__clock));
const changedOf = (page, a, b) => page.evaluate(([x, y]) => window.__I.digestChangedUnits(x, y), [a, b]);

// ---- the default, once -------------------------------------------------------
const D = await boot('');
const dRaw = await digestsOf(D.page);
const defaults = await sweepAll(D.page);
await D.context.close();

// ---- 2/3/4 per point ------------------------------------------------------------
for (const point of [STUDR, ROUTE]) {
  console.log(`1/2  ${point.name}: restricted + the default's payload == the point swept whole`);
  const P = await boot(point.q);
  const pQ = await digestsOf(P.page);
  const changed = await changedOf(P.page, dRaw, pQ);
  if (point === STUDR) check(changed.includes('Hairspring'), 'studr=4.71: the hairspring is in the changed set (must-hit)', changed.join(', '));
  if (point === ROUTE) check(changed.includes('Applied route'), 'route: the added unit is in the changed set', changed.join(', '));
  const whole = await sweepAll(P.page);
  await P.context.close();
  const got = await sweepPoint({ browser, base, point, mode: 'full', against: dRaw, bootInTurn: inTurn, bootTimeoutMs: BOOT, checkTimeoutMs: CHECK, opts: { axes: AXES } });
  const j = judgePoint(point, got, { defaults, entry: null });
  check(j.row.verdict === 'clean', `${point.name}: judged CLEAN (full)`, j.row.why ?? JSON.stringify(j.row.perCheck ?? {}).slice(0, 300));
  for (const name of POINT_CHECKS) {
    if (!j.merged) break;
    const a = canon(j.merged[name]), b = canon(whole[name]);
    check(a === b, `${point.name}: ${name} union is byte-identical to the whole sweep`, a === b ? `${a.length} bytes` : firstDiff(a, b));
  }

  if (point !== STUDR) continue;
  console.log(`3  ${point.name}: restricted + its STORED whole payload == the whole sweep`);
  {
    // The stored entry is the whole sweep; the changed set is hand-picked and
    // MIXED (the probe-152 rule): one unit this point moved, one it did not,
    // and Chain, which every real incremental set carries.
    const entry = { verdict: 'clean', digests: pQ, result: whole };
    const pick = ['Hairspring', 'Alarm link', 'Chain'];
    const P2 = await boot(point.q);
    const head = {};
    for (const name of POINT_CHECKS) {
      const e = BATTERY.find((x) => x.name === name);
      head[name] = (await runCheck(P2.page, name, { ...e.opts, axes: AXES, pairsTouching: pick }, CHECK)).result;
    }
    await P2.context.close();
    for (const name of POINT_CHECKS) {
      const u = canon(unionCheck(name, entry.result[name], head[name], new Set(pick), { point: true }));
      const b = canon(whole[name]);
      check(u === b, `${point.name}: incremental ${name} union is byte-identical to the whole sweep`, u === b ? `${u.length} bytes` : firstDiff(u, b));
    }
  }

  console.log(`4  ${point.name}: a broken point fails`);
  {
    // Blow the hairspring up AFTER the key is taken — the shape a real defect
    // in a changed unit has when the sweep reaches it.
    const mutate = () => {
      const e = window.__clock.labelEntries.find((x) => x.name === 'Hairspring');
      e.obj.scale.multiplyScalar(6);
      e.obj.updateMatrixWorld(true);
    };
    const bad = await sweepPoint({ browser, base, point, mode: 'full', against: dRaw, bootInTurn: inTurn, bootTimeoutMs: BOOT, checkTimeoutMs: CHECK, opts: { axes: AXES }, mutate });
    const jb = judgePoint(point, bad, { defaults, entry: null });
    const n = jb.row.perCheck ? Object.values(jb.row.perCheck).reduce((a, c) => a + c.failCount, 0) : 0;
    check(jb.row.verdict === 'finding', `${point.name} with its hairspring ×6: judged FINDING`, `${jb.row.verdict}, ${n} failing row(s)`);
  }
}

// ---- 5 — no cache entry runs full ------------------------------------------------
console.log('5  every unqualified stored file sends the point FULL');
{
  const checkCode = { 'src/inspect.js': 'a' };
  const entry = { verdict: 'clean', digests: dRaw, result: Object.fromEntries(POINT_CHECKS.map((c) => [c, {}])) };
  const good = { formatVersion: POINTS_FORMAT_VERSION, checkCode, whole: true, points: { [STUDR.name]: entry } };
  const cases = [
    ['no stored file', null],
    ['an older format', { ...good, formatVersion: POINTS_FORMAT_VERSION - 1 }],
    ['a PR-written (not whole) file', { ...good, whole: false }],
    ['a moved check-code digest', { ...good, checkCode: { 'src/inspect.js': 'b' } }],
    ['no entry for this point', { ...good, points: {} }],
    ['an entry with no whole payload', { ...good, points: { [STUDR.name]: { ...entry, verdict: 'skipped' } } }],
    ['an entry missing a check', { ...good, points: { [STUDR.name]: { ...entry, result: { inspection: {} } } } }],
  ];
  for (const [what, stored] of cases) {
    const d = decidePointMode({ name: STUDR.name, stored, checkCode, incremental: true });
    check(d.mode === 'full', `${what} → FULL`, d.why);
  }
  check(decidePointMode({ name: STUDR.name, stored: good, checkCode, incremental: false }).mode === 'full', 'a non-PR run → FULL whatever is stored');
  check(decidePointMode({ name: STUDR.name, stored: good, checkCode, incremental: true }).mode === 'incremental', 'a whole, current, matching entry → INCREMENTAL (the control that FULL is not the only answer)');
}

// ---- 6 — the ceiling --------------------------------------------------------------
console.log('6  the PR ceiling never reads clean');
{
  const got = await sweepPoint({ browser, base, point: STUDR, mode: 'full', against: dRaw, bootInTurn: inTurn, bootTimeoutMs: BOOT, checkTimeoutMs: CHECK, deadline: Date.now() - 1 });
  const j = judgePoint(STUDR, got, { defaults, entry: null });
  check(j.row.verdict === 'skipped' && !j.merged, 'a spent ceiling → SKIPPED, with no whole payload to store', `${j.row.verdict}: ${j.row.why}`);
}

await browser.close();
console.log(fail.length ? `\nFAIL — ${fail.length} control(s)` : '\nPASS — every control');
process.exit(fail.length ? 1 : 0);
