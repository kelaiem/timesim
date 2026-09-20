// §234 fold — WHERE DID THE CAP BEARING SETTLE, AND WHAT REFUSED EVERY BEARING
// NEARER THE SHORT WAY IN? A REPORT, with two controls.
//
// `CAP_SOLVE` in main.js walks the setting cap's bearing about the minute
// wheel (0°, then ±1°, ±2°, … to ±60°) and, for each, BUILDS that candidate's
// whole setting metal — the fold's two legs, the three bevel corners, the
// rise and the cap pinion — with the movement's own builder into a scratch
// group, then asks the reserve train's own swing solve (`solveReserveSwing`,
// the function the reserve build later calls on the cut tree) whether some
// w1 swing within ±30° clears it, and holds the candidate off the winding
// transfer arbor besides. The first bearing with an open window wins. That
// derivation is silent at boot when it succeeds, so this is where the SCAN
// TABLE is read out: every bearing tried, the clause that refused it and by
// how much, and the reserve swing that came closest — read from
// `__clock.settingFold`, which the build publishes for exactly this purpose.
//
// Controls, both against the metal rather than the solve's own record:
//   (a) each leg's L/D re-read from its cylinder (`settingTraverse1/2`) must
//       equal the figure the solve published, and the corner K's world position
//       must be the fold corner's mesh position;
//   (b) the reserve's w1 bearing, read from `rsvWheel1`'s world position about
//       the barrel, must be the swing the cap bearing was solved against (the
//       build warns if the confirmation disagrees; this reads the wheel).
//
// A REPORT: exits 0 whatever the table says; the controls exit 1 when they
// fail, because a table that disagrees with the metal is not a report of it.
//
//   node tools/probe-234-cap-bearing.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = process.env.PORT || 8577;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: '..', stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const bootWarnings = [];
page.on('console', (m) => {
  if (m.type() !== 'warning') return;
  const t = m.text();
  if (/WebGL|GroupMarker|GL Driver|swiftshader|Deprecation|coplanar/i.test(t)) return;
  bootWarnings.push(t);
});
page.on('pageerror', (e) => console.error('PAGEERROR', String(e).slice(0, 300)));
let booted = true;
await page.goto(`http://127.0.0.1:${PORT}/index.html?n=${Date.now()}`, { waitUntil: 'load', timeout: 90000 })
  .catch(() => { booted = false; });
if (booted) await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 }).catch(() => { booted = false; });
if (!booted) { console.error('the tree did not boot — nothing below can be measured'); await browser.close(); srv.kill(); process.exit(1); }

const R = await page.evaluate(() => {
  const c = window.__clock;
  const F = c.settingFold;
  if (!F) return { noFold: true };
  const find = (n) => { let m = null; c.scene.traverse((o) => { if (!m && o.name === n && (o.isMesh || n === 'rsvWheel1')) m = o; }); return m; };
  const wp = (o) => { const v = o.position.clone(); o.getWorldPosition(v); return { x: v.x, y: v.y, z: v.z }; };
  const legs = {};
  for (const n of ['settingTraverse1', 'settingTraverse2']) {
    const o = find(n); if (!o) { legs[n] = null; continue; }
    const p = o.geometry.parameters;
    legs[n] = { len: p.height, r: p.radiusTop, ld: p.height / (2 * p.radiusTop) };
  }
  const fold = find('mwCornerFoldIn');
  const w1 = find('rsvWheel1');
  const bx = c.P.barrel.x, by = c.P.barrel.y;
  const w1p = w1 ? wp(w1) : null;
  return { F, legs, foldAt: fold ? wp(fold) : null, w1At: w1p,
    w1BearingDeg: w1p ? Math.atan2(w1p.y - by, w1p.x - bx) * 180 / Math.PI : null };
});
await browser.close();
srv.kill();

if (R.noFold) { console.error('window.__clock.settingFold is not published — this tree predates the fold, or the surface moved'); process.exit(1); }
const F = R.F;
const f = (v, d = 3) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : String(v));
console.log('§234 fold — the cap bearing, solved jointly with the reserve\'s swing on the candidate metal');
console.log(`  bearing ${f(F.bearingDeg, 2)}° from the short way in (the a+(b−a)≠b rule: 0 first, then ±1 step, ±2, … — the step half a margin's arc at the cap's station, to the quarter-degree); reserve swing ${f(F.swingDeg, 2)}° (its step the same law at w1's station)`);
console.log(`  A (${f(F.A.x, 4)}, ${f(F.A.y, 4)})  K (${f(F.K.x, 4)}, ${f(F.K.y, 4)})  B (${f(F.B.x, 4)}, ${f(F.B.y, 4)})`);
console.log(`  run heading ${f(F.runHeadingDeg, 2)}°, leg 1 heading ${f(F.leg1HeadingDeg, 2)}° (α ${f(F.alphaDeg, 2)}° off the run, side ${F.side}), leg 2 swing β2 ${f(F.beta2Deg, 2)}° (column bearing φ ${f(F.phiDeg, 2)}°, needCol ${f(F.needCol, 4)})`);
console.log(`  Σ ${f(F.shaftAngleDeg, 2)}°, fold module ${f(F.module, 4)} (BEVEL_MODULE ${f(F.templateModule, 4)}; blanks' thinnest extent ${f(F.blankThinnest, 4)} u against STOCK_MIN_U ${f(F.stockMinU, 4)})`);
console.log(`  leg 1 ${f(F.len1)} u at r ${f(F.leg1R, 4)} → L/D ${f(F.len1 / (2 * F.leg1R), 2)};  leg 2 ${f(F.len2)} u at r ${f(F.leg2R, 4)} → L/D ${f(F.len2 / (2 * F.leg2R), 2)};  target ${F.turnLdTarget}, ceiling ${F.turnLdMax}`);
console.log('');
console.log('  the scan (bearing → the worst clause at the best swing; ≥ 0 is open):');
for (const row of F.scan) {
  const open = row.m >= 0;
  console.log(`    ${(row.d >= 0 ? '+' : '') + f(row.d, 2)}°  ${open ? 'OPEN  ' : 'shut  '} ${row.clause.padEnd(58)} ${isFinite(row.m) ? f(row.m) : '−∞'}${row.s !== null ? `  at swing ${f(row.s, 2)}°` : ''}`);
}
console.log('');
let bad = 0;
// (a) the legs as cut
for (const [n, len, r] of [['settingTraverse1', F.len1, F.leg1R], ['settingTraverse2', F.len2, F.leg2R]]) {
  const L = R.legs[n];
  const ok = L && Math.abs(L.len - len) < 1e-9 && Math.abs(L.r - r) < 1e-9;
  if (!ok) bad++;
  console.log(`  CONTROL (a) ${n}: mesh ${L ? `${f(L.len)} u at r ${f(L.r, 4)} (L/D ${f(L.ld, 2)})` : 'MISSING'} vs published ${f(len)} / ${f(r, 4)}  ${ok ? 'ok' : 'DISAGREES'}`);
}
{
  const ok = R.foldAt && Math.hypot(R.foldAt.x - F.K.x, R.foldAt.y - F.K.y) < 1e-9;
  if (!ok) bad++;
  console.log(`  CONTROL (a) fold corner: mesh at (${R.foldAt ? `${f(R.foldAt.x, 4)}, ${f(R.foldAt.y, 4)}` : 'MISSING'}) vs K  ${ok ? 'ok' : 'DISAGREES'}`);
}
// (b) the reserve's wheel
{
  const want = F.rsvLineDeg + F.swingDeg;
  const ok = R.w1BearingDeg !== null && Math.abs(((R.w1BearingDeg - want + 540) % 360) - 180) < 1e-6;
  if (!ok) bad++;
  console.log(`  CONTROL (b) rsvWheel1 bearing about the barrel ${f(R.w1BearingDeg, 4)}° vs line ${f(F.rsvLineDeg, 4)}° + swing ${f(F.swingDeg, 2)}° = ${f(want, 4)}°  ${ok ? 'ok' : 'DISAGREES'}`);
}
if (bootWarnings.length) console.log(`  boot warnings (${bootWarnings.length}):\n    ` + bootWarnings.map((w) => w.slice(0, 200)).join('\n    '));
else console.log('  boot silent');
process.exit(bad ? 1 : 0);
