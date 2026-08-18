// §127 — the acceptance for the split, at a scale a person can iterate at.
//
// The tranche's whole claim is that slicing `inspection` along its axis loop
// and merging the parts produces the payload a whole run produces, BYTE FOR
// BYTE. Proving that against the real check costs ~2 x 17 min; proving it over
// two cheap axes costs about a minute, and it exercises every line that could
// break it — the union by pair, the key ORDER inside each row, the re-derived
// summary, the census sum, the units assert.
//
// It also prints checkAxisEntry, because the identity is only meaningful if
// canonical entry holds: a slice starts from resetInputs() in its own context,
// so if entering an axis did not reproduce that axis's poses, the merge would
// be assembling two different movements and the byte comparison would be the
// thing hiding it.
//
//   node tools/probe-127-split.mjs [axisA axisB]
//
// Default pair is crown + alarmToggle (49 poses each, and they touch different
// halves of the movement — a pair that shares no moving part would not exercise
// the union at all).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mergeInspection } from './battery-split.mjs';

const [axisA = 'crown', axisB = 'alarmToggle'] = process.argv.slice(2);
const port = process.env.PORT || '8463';
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
  await page.evaluate(([n, o]) => window.__I.start(window.__clock, n, o), [name, opts]);
  for (let i = 0; i < 900; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const st = await page.evaluate((n) => {
      const s = window.__I.status(n);
      return s.state === 'running' ? { state: 'running' } : s;
    }, name);
    if (st.state === 'done') return st;
    if (st.state === 'error') throw new Error(`${name} threw:\n${st.error}`);
  }
  throw new Error(`${name} never finished`);
};

const axisMeta = await page.evaluate(() => window.__I.AXES.map((a) => ({ name: a.name, n: a.n })));
let bad = 0;

// ---- canonical axis entry ---------------------------------------------------
const entry = (await run('axisEntry', {})).result;
console.log(`axisEntry: ${entry.pairsTested} ordered pairs, ${entry.violations.length} violations`);
if (entry.violations.length) {
  bad++;
  for (const v of entry.violations.slice(0, 8)) console.log(`  VIOLATION ${v.prev} → ${v.axis}@${v.f}  ${v.worst.unit} ${v.worst.delta}`);
}
console.log(`  leak (report): ${entry.leak.pairsLeaking}/${entry.pairsTested} hand-offs move something without the entry`);
for (const u of entry.leak.units.slice(0, 12)) console.log(`    ${u.unit.padEnd(28)} worst ${u.worst}  in ${u.pairs} pairs`);

// ---- the identity ----------------------------------------------------------
const opts = { includeExcluded: true, yieldEvery: 64 };
const whole = (await run('inspection', { ...opts, axes: [axisA, axisB] })).result;
const partA = (await run('inspection', { ...opts, axes: [axisA] })).result;
const partB = (await run('inspection', { ...opts, axes: [axisB] })).result;
const merged = mergeInspection([{ slice: axisA, result: partA }, { slice: axisB, result: partB }],
  axisMeta.filter((a) => a.name === axisA || a.name === axisB));

// The census's two MS fields are wall clock — they sum, they do not compare,
// which is the same exemption `ms` has in --report. Everything else, including
// every counter, must be identical.
const strip = (r) => {
  const c = { ...r, census: { ...r.census } };
  delete c.census.exactMs; delete c.census.verdictMs;
  return JSON.stringify(c, null, 1);
};
const a = strip(whole), b = strip(merged);
console.log(`\nwhole [${axisA},${axisB}]: ${whole.report.length} pairs, ${whole.units.length} units`);
console.log(`merged ${axisA} + ${axisB}: ${merged.report.length} pairs, ${merged.units.length} units`);
if (a === b) {
  console.log('IDENTICAL — merged payload matches the whole run byte for byte (census ms exempt)');
} else {
  bad++;
  console.log('DIFFERENT — the merge does not reproduce the whole run:');
  const la = a.split('\n'), lb = b.split('\n');
  let shown = 0;
  for (let i = 0; i < Math.max(la.length, lb.length) && shown < 20; i++) {
    if (la[i] !== lb[i]) { console.log(`  L${i}\n   whole:  ${la[i]}\n   merged: ${lb[i]}`); shown++; }
  }
}
console.log(`\ncensus ms (informational): whole exact ${whole.census.exactMs} verdict ${whole.census.verdictMs}`
  + ` · merged exact ${merged.census.exactMs} verdict ${merged.census.verdictMs}`);

await browser.close();
srv.kill();
process.exit(bad ? 1 : 0);
