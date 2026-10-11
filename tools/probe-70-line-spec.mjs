// DOES THE LINE-SPEC GATE FIRE? — `lineSpec` (§70 steps 1–2, scoped by §261
// step 4) booted on copied trees whose switch is built wrong on purpose, so
// the gate is one somebody has seen fire rather than a comment.
//
// ACCEPTANCE. The check measures the alarm switch's drive line off the posed
// metal and compares each row with its value derived from the reference
// (LINE_SPECS in src/inspect.js). A gate that passes on the shipped tree has
// proved only that it does not fail; this proves it fails, and fails on the
// RIGHT rows, which is what makes its silence on the shipped tree mean
// something. Three boots, each a copied tree (height-ledger's mutantTree):
//
//   1. identity — 0 violations, control PASS.
//   2. the wheel grown, ALARM_COL_BASE_R 5.7 → 5.8 — a fold that resized the
//      wheel without declaring a fork. baseR, rootR, travel and offset must
//      fail (the derived chain follows the base radius), and columns, teeth,
//      step, straddle, straight and carry must NOT, because the build still
//      derives its own pin from its own wheel: the mechanism is coherent, it is
//      just no longer the one specified.
//   3. the offset hand-tuned, ALARM_DRIVE_OFFSET × 1.02 — §163's history, a
//      moment arm "that looked right" in place of the coupling's derivation.
//      offset AND step must fail: a pin at the wrong offset sweeps the driver
//      2·atan(h/d') ≠ one step (§163 measured 29.34° of 30° for its own wrong
//      offset; this one reads 29.44°). carry must NOT fail, and that is the
//      finding worth keeping: the click banks the wheel the rest of the way, so
//      the wheel's whole-actuation carry reads one exact step while the driver
//      under-delivers — the driver's sweep is the row that sees a mis-set
//      coupling, and the first draft of this probe predicted otherwise.
//
// What it is NOT: probe-261-height-cap.mjs fires the height ratchet; this
// fires the mechanism reference. The check's own control (a known shift of
// the pin's line moving the measured offset by exactly that much) holds the
// READER; this holds the GATE.
//
// Run from tools/: node probe-70-line-spec.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mutantTree } from './height-ledger.mjs';

let port = 8611;
async function lineSpecOn(dir) {
  const p0 = port++;
  const srv = spawn('python3', ['-m', 'http.server', String(p0), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const warns = [];
    page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GPU stall|GroupMarker/.test(m.text())) warns.push(m.text()); });
    await page.goto(`http://127.0.0.1:${p0}/index.html`, { waitUntil: 'load', timeout: 300000 });
    await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
    const err = await page.evaluate(() => (window.__bootError ? String(window.__bootError) : null));
    if (err) throw new Error('boot failed: ' + err);
    await page.evaluate(async () => { const I = await import('./src/inspect.js'); window.__I = I; I.start(window.__clock, 'lineSpec'); });
    await page.waitForFunction(() => window.__I.status('lineSpec').state !== 'running', null, { timeout: 300000, polling: 500 });
    const st = await page.evaluate(() => window.__I.status('lineSpec'));
    if (st.state !== 'done') throw new Error('lineSpec ' + st.state + ': ' + st.error);
    return { r: st.result, warns };
  } finally {
    // browser.close() can wedge in this container; never let it hold the probe
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
    srv.kill();
  }
}

const SRC = 'src/main.js';
const cases = [
  { name: 'identity', patches: [], fail: [] },
  { name: 'the wheel grown (ALARM_COL_BASE_R 5.7 → 5.8)', fail: ['baseR', 'rootR', 'travel', 'offset'],
    patches: [{ file: SRC, find: 'const ALARM_COL_BASE_R = 5.7;', to: 'const ALARM_COL_BASE_R = 5.8;' }] },
  { name: 'the offset hand-tuned (ALARM_DRIVE_OFFSET × 1.02)', fail: ['offset', 'step'],
    patches: [{ file: SRC, find: 'const ALARM_DRIVE_OFFSET = ALARM_PUSH_TRAVEL / (2 * Math.tan(ALARM_COL_STEP / 2));',
      to: 'const ALARM_DRIVE_OFFSET = 1.02 * ALARM_PUSH_TRAVEL / (2 * Math.tan(ALARM_COL_STEP / 2));' }] },
];
let ok = true;
for (const c of cases) {
  const { r } = await lineSpecOn(mutantTree(c.patches));
  const failed = r.rows.filter((x) => !x.pass).map((x) => x.key).sort();
  const want = [...c.fail].sort();
  const rowsOk = JSON.stringify(failed) === JSON.stringify(want);
  const ctlOk = String(r.control).startsWith('PASS');
  const good = rowsOk && ctlOk && r.malformed.length === 0;
  if (!good) ok = false;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${c.name}: failing rows [${failed.join(', ')}], want [${want.join(', ')}]; control ${ctlOk ? 'PASS' : r.control}${r.malformed.length ? `; malformed ${JSON.stringify(r.malformed)}` : ''}`);
  for (const x of r.rows.filter((y) => !y.pass)) console.log(`      ${x.key.padEnd(9)} spec ${Number(x.spec).toFixed(6)}  measured ${Number(x.measured).toFixed(6)}`);
}
console.log(ok ? '\nPASS — lineSpec is silent on the shipped switch and names exactly the rows each sabotage moved'
  : '\nFAIL — lineSpec does not fire as declared');
process.exit(ok ? 0 : 2);
