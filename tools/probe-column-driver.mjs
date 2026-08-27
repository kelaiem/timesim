// TODO 103 — the column driver's outline, and the bore it is supposed to turn on.
//
// ACCEPTANCE. A self-crossing outline does not just describe the metal wrongly,
// it can silently CHANGE it: `ExtrudeGeometry` hands a folded ring to earcut,
// earcut resolves the fold however it likes, and a hole declared inside the
// ring can end up on the wrong side of the result. Measured on the shipped
// driver before TODO 103's fix, the pivot bore read 120 of 120 sample points
// FILLED — the hole the part turns on was solid metal, on a part whose
// `INTRA_UNIT_CONTACTS` row declares that very bore as a running fit on
// `alarmColStud`. A declared joint excuses the pair from the sweep, so nothing
// downstream could see it either.
//
//   1. the bore is OPEN — no cap triangle covers its interior;
//   2. the annulus just outside it IS metal, so the bore is a hole cut in the
//      part rather than an absence of part.
//
// The two are a pair on purpose: either alone passes on a driver that is not
// there at all. Outline simplicity is probe-outline-simple's, movement-wide.
// TODO 103 — the column driver's outline, and the bore it is supposed to turn on.
//
// ACCEPTANCE. Three things, and the middle one is why this file exists rather
// than a line in probe-outline-simple: a self-crossing outline does not just
// describe the metal wrongly, it can silently CHANGE it. `ExtrudeGeometry`
// hands a folded ring to earcut, earcut resolves the fold however it likes,
// and a hole declared inside the ring can end up on the wrong side of the
// result. Measured on the shipped driver before TODO 103's fix: the pivot
// bore read 120 of 120 sample points FILLED — the hole the part turns on was
// solid metal, on a part whose `INTRA_UNIT_CONTACTS` row declares that very
// bore as a running fit on `alarmColStud`. A declared joint excuses the pair
// from the sweep, so nothing downstream could see it either.
//
//   1. the authored outline is a simple polygon;
//   2. the bore is OPEN — no cap triangle covers its interior;
//   3. the annulus just outside the bore IS metal, so the bore is a hole cut
//      in the part rather than an absence of part.
//
// 2 and 3 are a pair on purpose. Either alone passes on a driver that is not
// there at all.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const srv = spawn('python3', ['-m', 'http.server', '8527', '--bind', '127.0.0.1'], { cwd: '/home/user/timesim', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(180000);
await page.goto('http://127.0.0.1:8527/index.html?schematic=0', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => !!window.__clock, null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
const r = await page.evaluate(() => {
  const clock = window.__clock;
  let m = null;
  for (const e of clock.labelEntries) e.obj.traverse((o) => { if (o.isMesh && o.name === 'alarmColDriver') m = o; });
  const g = m.geometry, pos = g.attributes.position, idx = g.index;
  g.computeBoundingBox();
  const zMax = g.boundingBox.max.z;
  const at = (i) => { const k = idx ? idx.getX(i) : i; return [pos.getX(k), pos.getY(k), pos.getZ(k)]; };
  const n = idx ? idx.count : pos.count;
  const tris = [];
  for (let i = 0; i + 2 < n; i += 3) {
    const a = at(i), b = at(i + 1), c = at(i + 2);
    if (Math.abs(a[2] - zMax) > 1e-6 || Math.abs(b[2] - zMax) > 1e-6 || Math.abs(c[2] - zMax) > 1e-6) continue;
    tris.push([a, b, c]);
  }
  const inTri = (p, [a, b, c]) => {
    const d = (u, v, w) => (u[0] - w[0]) * (v[1] - w[1]) - (v[0] - w[0]) * (u[1] - w[1]);
    const d1 = d(p, a, b), d2 = d(p, b, c), d3 = d(p, c, a);
    const neg = (d1 < 0) || (d2 < 0) || (d3 < 0), pos2 = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(neg && pos2);
  };
  // Local frame: the mesh sits in a group at the column position. Sample a ring
  // just OUTSIDE the bore — that annulus is the metal the bore is cut INTO.
  const boreR = 0.65, hubR = 0.967;
  const rTest = (boreR + hubR) / 2;
  let covered = 0, total = 0;
  for (let k = 0; k < 180; k++) {
    const t = (2 * Math.PI * k) / 180;
    const p = [rTest * Math.cos(t), rTest * Math.sin(t)];
    total++;
    if (tris.some((T) => inTri(p, T))) covered++;
  }
  // and inside the bore itself, which must be EMPTY
  let insideBore = 0, boreTotal = 0;
  for (let k = 0; k < 120; k++) {
    const t = (2 * Math.PI * k) / 120;
    const p = [boreR * 0.6 * Math.cos(t), boreR * 0.6 * Math.sin(t)];
    boreTotal++;
    if (tris.some((T) => inTri(p, T))) insideBore++;
  }
  return { capTris: tris.length, rTest: +rTest.toFixed(3),
    annulusCovered: covered, annulusTotal: total,
    boreFilled: insideBore, boreTotal };
});
await browser.close(); srv.kill();

console.log('alarmColDriver — the bore it turns on:\n');
console.log(`  cap triangles                  ${r.capTris}`);
console.log(`  annulus at r=${r.rTest} in metal   ${r.annulusCovered}/${r.annulusTotal}`);
console.log(`  bore interior filled           ${r.boreFilled}/${r.boreTotal}`);

const fails = [];
if (r.boreFilled !== 0)
  fails.push(`the pivot bore is FILLED at ${r.boreFilled}/${r.boreTotal} sample points — `
    + `the driver has no hole to turn on`);
if (r.annulusCovered !== r.annulusTotal)
  fails.push(`the metal around the bore is missing at ${r.annulusTotal - r.annulusCovered}`
    + ` of ${r.annulusTotal} points — the bore is an absence of part, not a hole in one`);
console.log('');
if (fails.length) { for (const f of fails) console.log('FAIL — ' + f); process.exitCode = 1; }
else console.log('PASS — the bore is open, and it is cut in metal.');
