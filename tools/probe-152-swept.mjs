// §152 probe three — IS `sweptOverlap` REALLY UNRESTRICTABLE?
//
// The filed entry marks it "skip: 96.5% of its cost is the confirm tier,
// which is already restricted to the ~15–23 raw-overlap candidates". Being
// restricted to 18 candidates is not the same as being unable to restrict to
// 0 — the confirm tier is ONE batched sweepClearances over the hull tier's
// violation rows (each a unit pair, `fixed`/`mover`), so filtering that list
// by the changed-unit set is a one-line filter on an array.
//
// What decides whether that is worth doing is the CANDIDATE LIST'S SHAPE: how
// many rows there are, how many distinct units they touch, and the worst
// single unit's incidence. That is what this measures, and it costs the hull
// tier alone — `confirm: false` returns the raw hull overlaps without paying
// the 96.5%, so the whole probe runs in seconds instead of minutes.
//
//   node tools/probe-152-swept.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8552';
const root = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch({ args: [
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
// index.html does not import the inspector; ci-battery.mjs installs it the
// same way, and every probe that drives a check has to.
await p.evaluate(async () => { window.__I = await import('./src/inspect.js'); });
await p.evaluate(() => window.__clock.beginSweepHold());
await p.evaluate(() => window.__I.start(window.__clock, 'sweptOverlap', { confirm: false, yieldEvery: 64 }));
for (let i = 0; i < 900; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const st = await p.evaluate(() => {
    const s = window.__I.status('sweptOverlap');
    return s.state === 'running' ? { state: 'running' } : s;
  });
  if (st.state !== 'running') { if (st.state === 'error') { console.log(st.error); process.exitCode = 1; } break; }
}
const out = await p.evaluate(() => {
  const job = window.__checks.sweptOverlap;
  const s = job.result.sound.staticVsSwept;
  const rows = (s.violations || []).map((v) => [v.fixed, v.mover]);
  const units = [...new Set(rows.flat())].sort();
  const perUnit = Object.fromEntries(units.map((u) => [u, rows.filter((r) => r.includes(u)).length]));
  const allUnits = window.__clock.labelEntries.length;
  return {
    hullTierMs: job.ms,
    registryMs: job.result.census.registryMs,
    hullMs: job.result.census.hullMs,
    pairsTested: s.pairsTested,
    candidateRows: rows.length,
    unitsTouched: units.length,
    unitsUntouched: allUnits - units.length,
    worstUnitIncidence: Math.max(...Object.values(perUnit)),
    perUnit,
    rows,
  };
});
console.log(JSON.stringify(out, null, 1));
console.log(`${out.candidateRows} candidate rows over ${out.unitsTouched} units; `
  + `${out.unitsUntouched} of ${out.unitsTouched + out.unitsUntouched} units appear in NONE of them `
  + `(a change confined to one of those drops the confirm tier entirely); `
  + `worst single unit ${out.worstUnitIncidence}/${out.candidateRows} rows`);
await b.close(); srv.kill();
