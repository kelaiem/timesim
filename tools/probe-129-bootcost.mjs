// §129 — WHAT DOES THE SITING SOLVE COST TO BOOT?
//
// A build-time solve whose running time is a function of the LAYOUT is a
// boot-time hazard, and identity being fast is luck rather than evidence. The
// §129 solve is four deep — station azimuth × idler tooth count × side × finger
// azimuth × plane × cross azimuth — and its cost is not the grid size but how
// much survives pruning at each level. Move the alarm corner or the crown and
// the obstacle field shifts so that far more candidates clear the cheap early
// tests, and the expensive inner loops run combinatorially more often.
//
// The battery found this the only way it can: four spec points came back
// WEDGED — no __clock inside the boot timeout and a main thread that would not
// answer a trivial evaluate() in ten seconds. Nothing thrown, nothing logged,
// still computing. That failure mode is invisible to every gate that needs a
// __clock to speak, so it needs its own instrument, and this is it.
//
// Measured before the fix: identity 9.3 s, ?alarmaz=90 and ?crownaz=90 both
// past 60 s. The point of a bounded solve is that this spread collapses.
//
// Run: node tools/probe-129-bootcost.mjs
//      BUDGET=25 node tools/probe-129-bootcost.mjs    (tighter ceiling)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const port = process.env.PORT || '8561';
// The ceiling is a MULTIPLE of identity, not an absolute: this runs on
// whatever hardware it runs on, and what matters is that a moved station does
// not cost qualitatively more than the design one.
const BUDGET = Number(process.env.BUDGET || 3);
const CAP_MS = Number(process.env.CAP || 90000);
const srv = spawn('python3', ['-m', 'http.server', port, '--bind', '127.0.0.1'],
  { cwd: '..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();

// The spec points that moved the alarm corner or the crown — the ones whose
// obstacle fields differ most from identity, which is exactly where a solve
// that prunes by luck stops pruning.
const POINTS = ['', '?alarmaz=90', '?alarmaz=175', '?alarmaz=180', '?crownaz=90',
  '?alarmmod=200', '?alarmr=20', '?alarmr=46'];
const rows = [];
for (const q of POINTS) {
  const t0 = Date.now();
  let ms = null;
  try {
    await page.goto(`http://127.0.0.1:${port}/index.html${q}`, { waitUntil: 'load', timeout: CAP_MS });
    await page.waitForFunction(() => !!window.__clock, null, { timeout: CAP_MS });
    ms = Date.now() - t0;
  } catch (e) { ms = null; }
  rows.push({ q: q || 'identity', ms });
  console.log(`  ${(q || 'identity').padEnd(16)} ${ms === null ? `WEDGED (past ${(CAP_MS / 1000).toFixed(0)}s)` : `${(ms / 1000).toFixed(1)}s`}`);
}
const base = rows[0].ms;
console.log('');
let bad = 0;
if (base === null) { console.log('  IDENTITY ITSELF DID NOT BOOT — nothing else here means anything'); bad++; }
else {
  for (const r of rows.slice(1)) {
    const ok = r.ms !== null && r.ms <= base * BUDGET;
    if (!ok) bad++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.q.padEnd(16)} `
      + `${r.ms === null ? 'never booted' : `${(r.ms / base).toFixed(1)}× identity`}   want ≤ ${BUDGET}×`);
  }
}
console.log(bad ? `\n${bad} spec point(s) cost more than a bounded solve should`
  : `\nevery moved station boots within ${BUDGET}× identity (${(base / 1000).toFixed(1)}s)`);
await browser.close();
srv.kill();
process.exit(bad ? 1 : 0);
