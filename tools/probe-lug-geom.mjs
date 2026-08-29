// THE LUGS, READ OFF THE METAL — and the across-the-lugs assert's hand-copied
// term checked against the geometry it copies.
//
// REPORT. Written for the case-redesign scope (roadmap): the width cap moves
// to the case BODY (lugs excluded), and the lug spec is opened for options.
// Before options can be priced, the shipped lug has to be read off the built
// meshes — and the one known drift hazard verified: the across-the-lugs boot
// assert (main.js) prices lug reach as `CASE_R_OUT + 1.7 mm`, where 1.7 is
// `lugH − LUG_ROOT` hand-copied from geometry.js. If the two ever part, the
// assert prices a lug that is not there.
//
// What this is NOT: no other instrument touches the lugs at all (INDEX.md,
// searched: lug/strap/spring bar — zero rows).
//
// Control: the measured lug tip radius must agree with the assert's formula
// to within the mesh's own tessellation (0.01 u) — that is the hand-copy
// being checked, and agreement today is the baseline the redesign edits
// against. Disagreement exits 2: the assert already prices phantom metal.
//
// Run: node tools/probe-lug-geom.mjs   (ROOT= for another worktree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8516', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
await page.goto('http://127.0.0.1:8516/index.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 120000 });

const res = await page.evaluate(async () => {
  const THREE = await import('three');
  const clock = window.__clock;
  const v = new THREE.Vector3();
  const lugs = [], bars = [];
  clock.scene.traverse((o) => {
    if (o.name === 'caseLug') lugs.push(o);
    if (o.name === 'caseSpringBar') bars.push(o);
  });
  const ext = (o) => {
    o.updateWorldMatrix(true, true);
    const p = o.geometry.attributes.position;
    let rMin = Infinity, rMax = 0, zMin = Infinity, zMax = -Infinity;
    const pts = [];
    for (let i = 0; i < p.count; i++) {
      o.localToWorld(v.fromBufferAttribute(p, i));
      const r = Math.hypot(v.x, v.y);
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
      zMin = Math.min(zMin, v.z); zMax = Math.max(zMax, v.z);
      pts.push([v.x, v.y]);
    }
    return { rMin, rMax, zMin, zMax, pts };
  };
  const L = lugs.map(ext), B = bars.map(ext);
  // Across-the-tips is a CALLIPER read: the span ALONG the lug pair's own
  // axis, jaws flat on the two tip faces. It is NOT 2×max radius — the lug is
  // a box standing off its pair axis by the strap half-span, so its outer
  // CORNERS reach ~58.5 u radially while the tip FACES sit at ~52.7 along the
  // axis; the first cut of this probe read the corner and disagreed with the
  // assert by 11.5 u, which was this probe's error and is why this comment
  // exists. Recover the pair axis from the metal: the two lugs of a pair
  // stand at ±(strap half-span) across it, so the MEAN of their centroids
  // cancels the offsets and points along the axis.
  const centroid = (l) => {
    let x = 0, y = 0;
    for (const [px, py] of l.pts) { x += px; y += py; }
    return [x / l.pts.length, y / l.pts.length];
  };
  const cs = L.map(centroid);
  // pair = the two centroids with the smallest mutual angle to a common axis:
  // sum all centroid directions with sign folded to a half-plane.
  let ax = 0, ay = 0;
  for (const [x, y] of cs) { const s = (x * cs[0][0] + y * cs[0][1]) >= 0 ? 1 : -1; ax += s * x; ay += s * y; }
  const n = Math.hypot(ax, ay); ax /= n; ay /= n;
  let tipsAcross = 0;
  for (const l of L) for (const [px, py] of l.pts) tipsAcross = Math.max(tipsAcross, Math.abs(px * ax + py * ay));
  tipsAcross *= 2;
  // Span between the two bars of one pair (z of bar centres, and the XY gap):
  return {
    nLugs: lugs.length, nBars: bars.length,
    lugR: L.map((l) => ({ rMin: +l.rMin.toFixed(4), rMax: +l.rMax.toFixed(4), zMin: +l.zMin.toFixed(3), zMax: +l.zMax.toFixed(3) })),
    barR: B.map((b) => ({ rMin: +b.rMin.toFixed(4), rMax: +b.rMax.toFixed(4), zMin: +b.zMin.toFixed(3), zMax: +b.zMax.toFixed(3) })),
    tipsAcross,
  };
});

const MM = 0.378947, UNIT_MM_INV = 1 / MM;
const CASE_R_OUT = 48.2007;                          // main.js:1815's value, restated for the check below
const assertFormula = CASE_R_OUT + 1.7 * UNIT_MM_INV; // the boot assert's expression
console.log(`lugs ${res.nLugs}, spring bars ${res.nBars}`);
for (const l of res.lugR) console.log(`  lug  r ${l.rMin}..${l.rMax}  z ${l.zMin}..${l.zMax}`);
for (const b of res.barR) console.log(`  bar  r ${b.rMin}..${b.rMax}  z ${b.zMin}..${b.zMax}`);
console.log(`\nacross the lug tips MEASURED: ${res.tipsAcross.toFixed(4)} u = ${(res.tipsAcross * MM).toFixed(3)} mm`);
console.log(`the boot assert's formula:    2×(CASE_R_OUT + 1.7 mm) = ${(2 * assertFormula).toFixed(4)} u = ${(2 * assertFormula * MM).toFixed(3)} mm`);
const drift = Math.abs(res.tipsAcross - 2 * assertFormula);
let ok = true;
if (drift > 0.02) { ok = false; console.log(`\nCONTROL FAIL: measured tips and the assert's formula disagree by ${drift.toFixed(4)} u — the hand-copied 1.7 has drifted from geometry.js`); }
else console.log(`\nCONTROL PASS: the hand-copied 1.7 still matches the metal (drift ${drift.toFixed(4)} u)`);
await browser.close(); srv.kill();
process.exit(ok ? 0 : 2);
