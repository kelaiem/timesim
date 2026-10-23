// DOES THE BUILD HOLD ITS LINE SPEC WHEN THE JS ENGINE ROUNDS DIFFERENTLY?
// (TODO 265) — `lineSpec` booted with `Math.atan2` nudged by one ULP, up or
// down or not at all per call, chosen by a hash of its arguments and a seed.
//
// ACCEPTANCE. Chromium 156 built the alarm strike's cam differently from
// Chromium 141 out of the same source, and four `alarm strike` rows failed by
// up to 2.83e-3 (pivSwD). The cause was a SEAM WRITTEN TWICE: each lobe's
// dwell began at the previous drop's last point and its approach ended at the
// rise's first, each pair equal in algebra but computed two ways. three.js
// drops a repeated point only when it is EXACTLY equal, so the engine's last
// ULP of atan2 decided how many points each lobe kept, and the vertex mean
// lineSpec reads the wheel's axis by moved with it. A per-input ULP nudge is
// what an engine change looks like; a uniform scale is not (it keeps every
// comparison's order, and moved nothing when tried).
//
//   1. the shipped tree, unperturbed and under three seeds — 0 lineSpec
//      failures and the cam's seam guard silent.
//   2. CONTROL: the doubled seams restored (the dwell from i = 0, the approach
//      to f = 1) under seed 2 — the four strike rows FAIL and the guard warns.
//      Seed 2 is MEASURED, not derived: it is the seed that reproduced 156's
//      failure on 141. If an unrelated change stops it failing the control,
//      the probe fails and says so; pick a seed that does, never drop the
//      control.
//
// Five boots, about two minutes each.  node tools/probe-265-ulp.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mutantTree, ROOT } from './height-ledger.mjs';

const STRIKE_ROWS = ['pivSwD', 'restGamma', 'camPickupR', 'lift'].map((k) => `alarm strike/${k}`);
const GUARD = /TODO 265: the alarm cam's outline/;

let port = 8761;
async function bootLineSpec(dir, seed) {
  const p0 = port++;
  const srv = spawn('python3', ['-m', 'http.server', String(p0), '--bind', '127.0.0.1'], { cwd: dir, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const warns = [];
    page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GPU stall|GroupMarker/.test(m.text())) warns.push(m.text()); });
    if (seed !== null) {
      await page.addInitScript((k) => {
        const o = Math.atan2, buf = new Float64Array(1), u = new Uint32Array(buf.buffer);
        Math.atan2 = function (y0, x0) {
          const y = o(y0, x0);
          let h = k | 0;
          for (const v of [y0, x0]) { buf[0] = v; h = Math.imul(h ^ u[0], 0x9e3779b1) ^ Math.imul(h ^ u[1], 0x85ebca6b); h ^= h >>> 15; }
          const r = (h >>> 0) % 3;   // 0: unchanged, 1: one ULP up, 2: one ULP down
          if (r === 0 || !isFinite(y) || y === 0) return y;
          buf[0] = y;
          const lo = u[0];   // the bit pattern grows away from zero, so "up" is +1 for a positive y and −1 for a negative
          if ((r === 1) === (y > 0)) { u[0] = lo + 1; if (u[0] === 0) u[1]++; } else { u[0] = lo - 1; if (lo === 0) u[1]--; }
          return buf[0];
        };
      }, seed);
    }
    await page.goto(`http://127.0.0.1:${p0}/index.html`, { waitUntil: 'load', timeout: 300000 });
    await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
    const err = await page.evaluate(() => (window.__bootError ? String(window.__bootError.message || window.__bootError) : null));
    if (err) throw new Error('boot failed: ' + err);
    await page.evaluate(async () => { const I = await import('./src/inspect.js'); window.__I = I; I.start(window.__clock, 'lineSpec'); });
    await page.waitForFunction(() => window.__I.status('lineSpec').state !== 'running', null, { timeout: 300000, polling: 500 });
    const st = await page.evaluate(() => window.__I.status('lineSpec'));
    if (st.state !== 'done') throw new Error('lineSpec ' + st.state + ': ' + st.error);
    const failing = st.result.rows.filter((x) => !x.pass);
    return { failing, warns };
  } finally {
    // browser.close() can wedge in this container; never let it hold the probe
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
    srv.kill();
  }
}

const cases = [
  { name: 'shipped, unperturbed', dir: ROOT, seed: null, fail: [], guard: false },
  ...[2, 5, 7].map((seed) => ({ name: `shipped, atan2 seed ${seed}`, dir: ROOT, seed, fail: [], guard: false })),
  { name: 'CONTROL: seams doubled, atan2 seed 2', seed: 2, fail: STRIKE_ROWS, guard: true,
    patches: [
      { file: 'src/main.js', find: 'for (let i = 1; i <= nDwell; i++) {', to: 'for (let i = 0; i <= nDwell; i++) {' },
      { file: 'src/main.js', find: 'for (let i = 1; i < 6; i++) {', to: 'for (let i = 1; i <= 6; i++) {' },
    ] },
];

let bad = 0;
for (const c of cases) {
  const dir = c.dir || mutantTree(c.patches);
  const { failing, warns } = await bootLineSpec(dir, c.seed);
  const got = failing.map((x) => `${x.ref}/${x.key}`).sort();
  const want = [...c.fail].sort();
  const rowsOk = got.length === want.length && got.every((k, i) => k === want[i]);
  const fired = warns.some((w) => GUARD.test(w));
  const ok = rowsOk && fired === c.guard;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}: ${failing.length} failing${failing.length ? ' — ' + failing.map((x) => `${x.ref}/${x.key} Δ${(x.measured - x.spec).toExponential(2)}`).join(', ') : ''}; `
    + `seam guard ${fired ? 'warned' : 'silent'} (expected ${c.guard ? 'warned' : 'silent'})`);
  if (!rowsOk) console.log(`      expected failing: ${want.join(', ') || 'none'}`);
  const other = warns.filter((w) => !GUARD.test(w));
  if (other.length) console.log(`      other boot warnings: ${other.map((w) => w.slice(0, 160)).join(' | ')}`);
}
console.log(bad ? `probe-265-ulp: ${bad} of ${cases.length} cases FAILED` : `probe-265-ulp: all ${cases.length} cases PASS (the control fails as it must)`);
process.exit(bad ? 1 : 0);
