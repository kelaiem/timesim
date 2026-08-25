// §169 — does stockFloor now SEE both swept springs, and at their wire?
// Before this, a hand-swept solid was measured by its geometry-local box, so
// the two coils reported the space they occupy as the metal they are made of
// and both passed the §50 floor while their 0.05 mm wire sat a third of the
// way under it. §163's blade was a BoxGeometry and so reported honestly as a
// waived row; replacing it with a coil would have traded a visible debt for
// an invisible one.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8485', '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await p.goto('http://127.0.0.1:8485/index.html?hud=0&sync=0', { waitUntil: 'load', timeout: 90000 });
await p.waitForFunction(() => !!window.__clock, null, { timeout: 90000 });
const out = await p.evaluate(async () => {
  const I = await import('./src/inspect.js');
  const clock = window.__clock;
  const census = await I.stockCensus(clock, {});
  const SPRINGS = /alarmColPawlSpring$|alarmPusherReturnSpring/;
  const res = await I.checkStockFloor(clock, {});
  return {
    rows: census.thinnestFirst.filter((r) => SPRINGS.test(r.mesh)),
    notMeasured: census.notMeasured.filter((r) => SPRINGS.test(r.mesh)),
    counted: census.thinnestFirst.length,
    waived: res.waived.length, violations: res.violations.length, degenerate: res.degenerate.length,
    springWaivers: res.waived.filter((w) => SPRINGS.test(w.mesh)),
    ok: res.ok,
  };
});
console.log(`census: ${out.counted} rows counted`);
console.log('\nthe two swept springs, as the ruler now reads them:');
for (const r of out.rows)
  console.log(`   ${r.mesh.padEnd(26)} ${String(r.thinnestMM).padStart(7)} mm  via ${r.via}  — ${r.source}`);
if (!out.rows.length) console.log('   (neither appears — the census is not seeing them)');
for (const r of out.notMeasured) console.log(`   NOT MEASURED ${r.mesh}: ${r.why}`);
console.log('\nstockFloor: waived ' + out.waived + ', violations ' + out.violations + ', degenerate ' + out.degenerate);
for (const w of out.springWaivers)
  console.log(`   waived  ${w.mesh.padEnd(26)} ${w.mm} mm vs floor ${w.floorMM} (${w.kind}) — debt ${w.debt}`);
const ok = out.ok && out.rows.length === 2 && out.springWaivers.length === 2;
console.log('\n' + (ok ? 'probe OK — both springs measured at their wire, both visible as accepted debt' : 'probe FAILED'));
await b.close(); srv.kill();
process.exit(ok ? 0 : 1);
