// TODO 60 — the focused instruments this change can move, before the full
// battery. Extending the tower arbor past leg B's pinion puts steel through
// two bores that had none, so the checks at risk are the ones that judge
// contact INSIDE a unit and the ones that judge a rigid group's connectedness:
//
//   support      — the arbor is a declared support for the whole unit
//   graph        — no new part, but the arbor's role changes
//   stockFloor   — a degenerate solid was REMOVED; the census should drop it
//   intraUnit    — the new bearing contacts, if the bores are tight enough
//   assembly     — subSleeveB is gone, so leg B must still read as ONE body
//   penetration  — the arbor now crosses two more bands
//
// Deliberately NOT here: clearances, inspection and sweptOverlap. They are the
// slow pair sweeps and they cannot see this class at all — a wheel with an
// empty bore collides with nothing, which is the whole reason TODO 60 survived
// three green batteries. Run the battery for those; run this to iterate.
//
// Run: cd tools && node probe-60-checks.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '8532';
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => {
  if (m.type() === 'warning' && !/GroupMarker|GL Driver|WebGL/.test(m.text())) console.log('BOOTWARN', m.text());
});
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });

const res = await page.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const out = [];
  const UNIT = 'Alarm winding arrest';

  clock.resetInputs();
  const support = I.checkSupportGeometry(clock);
  const sFail = (support.rows || []).filter((r) => !r.ok);
  out.push(`support     : ${sFail.length} failures`
    + (sFail.length ? ` ${JSON.stringify(sFail.slice(0, 4))}` : '')
    + `  |  arrest row: ${JSON.stringify((support.rows || []).find((r) => /winding arrest/i.test(r.edge)) || null)}`);

  clock.resetInputs();
  const graph = I.checkMechanicalGraph(clock);
  out.push(`graph       : notInGraph ${JSON.stringify(graph.notInGraph)}, ungrounded ${JSON.stringify(graph.ungrounded)}, `
    + `undriven ${JSON.stringify(graph.undriven)}, missingFromScene ${JSON.stringify(graph.missingFromScene)}, `
    + `anchors ${graph.anchorFailures ? graph.anchorFailures.length : '?'}`);

  clock.resetInputs();
  const stock = await I.checkStockFloor(clock);
  const arrestStock = (stock.violations || []).filter((v) => JSON.stringify(v).includes('sub') || JSON.stringify(v).includes('arrest'));
  out.push(`stockFloor  : degenerate ${stock.degenerate.length} ${JSON.stringify(stock.degenerate.slice(0, 6))}, `
    + `unwaived ${stock.violations.length}, waived ${stock.waivedCount}`
    + (arrestStock.length ? `  |  arrest rows: ${JSON.stringify(arrestStock.slice(0, 4))}` : ''));

  clock.resetInputs();
  const intra = await I.checkIntraUnit(clock, { samplesPerAxis: 5 });
  const arrestRows = (intra.violations || []).filter((v) => v.unit === UNIT);
  out.push(`intraUnit   : unwaived ${intra.violations.length}, unmatched ${JSON.stringify(intra.unmatchedSelectors || [])}`
    + `  |  ${UNIT}: ${arrestRows.length}`
    + (arrestRows.length ? ` ${JSON.stringify(arrestRows.slice(0, 6))}` : ''));

  clock.resetInputs();
  const asm = await I.checkAssembly(clock);
  const arrestSplit = (asm.violations || []).filter((v) => JSON.stringify(v).includes('rrest') || JSON.stringify(v).includes('sub'));
  out.push(`assembly    : undeclared unwaived ${asm.violations.length}`
    + (arrestSplit.length ? `  |  arrest: ${JSON.stringify(arrestSplit.slice(0, 4))}` : '  |  arrest: none'));

  clock.resetInputs();
  const pen = I.checkPenetrationBudgets(clock);
  const penFail = (pen.violations || pen.failures || []);
  out.push(`penetration : ${penFail.length} over budget`
    + (penFail.length ? ` ${JSON.stringify(penFail.slice(0, 4))}` : ''));

  return out;
});

console.log(res.join('\n'));
await browser.close();
srv.kill();
