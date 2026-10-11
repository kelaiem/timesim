// THE DIAL-SIDE BAND'S FREE VOLUME, OVER THE POSE NET — where, between the base
// plate's dial face and the dial's back, a folded action group could stand.
//
// REPORT with fatal controls (exit 2 when a control fails). §261 step 2. It
// replaces the entry's first map, a vertex-binned grid at the BUILD pose, with
// a surface scan at every pose of §152's digest net, and its verdict on the
// free annulus (r 24–40 by two-thirds of the circle, 2.6 mm deep) is what the
// fold is sited on — or not at all, by the entry's own refusal point (§112's
// rods were true at the rest pose and false over their travel).
//
// What it is NOT: `probe-interplate-demand.mjs` asks what pins the
// three-quarter plate's UNDERSIDE (the gap between the plates, z > 0); this
// asks what stands in the band on the OTHER side of the base plate (z < 0).
// Its raycast footprint and its control style are borrowed from there.
// `probe-261-height-ledger.mjs` measures the stack's faces, not this band's
// tenants; `probe-187-casing-path` is the case's question.
//
// METHOD. A polar grid of cells over the band (r 0..R_MAX, DR × DAZ), one ray
// per cell centre cast along +z from in front of the whole movement. Every
// mesh's hits are kept DOUBLE-SIDED and paired entry/exit into the solid
// intervals that ray crosses (instruments skill: a ray cast inside a solid,
// or culled by its face, measures nothing — this one starts outside
// everything and sees both faces). Rays are cast against one mesh at a time,
// only in the cells under that mesh's box, so a pose costs the meshes that are
// in the band, not the movement.
//
//  · THE GROUND IS NOT AN OBSTACLE. The two walls are cast separately: the
//    dial plate (mesh `dialPlate`) is the band's floor and the base plate (the
//    HELD fixture, mesh `backPlate`, TODO 187) its ceiling, PER CELL — so a
//    pocket cut into the plate's dial face (TODO 172) or a sub-dial well in the
//    dial deepens that cell's band, and neither wall is ever a tenant. The
//    dial's feet and every other Dial-unit mesh ARE tenants.
//  · THE POSE NET. `digestPoses()` (every axis at f ∈ {0, 0.5, 1} unioned with
//    the fingerprint's combined states), each entered by resetInputs+setPose,
//    the way unitDigests walks it. A cell's occupancy is the UNION over poses,
//    with the pose that first claimed each interval kept for the report.
//  · AN OPEN MESH reads as an odd number of crossings. Those (mesh, cell)
//    incidences are counted per unit and filled conservatively, first hit to
//    last — the error runs toward COUNTING metal, never toward a free cell.
//
// CONTROLS (fatal):
//  C1 a known tenant: the §29 centre chain fills the r < 2 cells (at least
//     half of the band's depth), owned by the Dial unit's tube chain.
//  C2 both faces: every cell the report calls FREE at the fold's depth, and a
//     sample of occupied ones, re-cast from BEHIND (−z from past the plate)
//     must read the same intervals to 1e-4.
//  C3 the pose net is applied: some cell is occupied at a net pose and free
//     at the reference pose (resetInputs + setPose({})), and the keyless works' swept lane at full pull is
//     among them (the crown axis at f = 1).
//  C4 walls found: the floor and ceiling read in at least 90 % of the plate's
//     cells, and no wall mesh appears in any tenant table.
//  C5 a planted block of known extent, set in the band at a cell nobody owns,
//     reads exactly its own z interval on that cell's ray, and nothing in a
//     cell three units away.
//  C6 a planted pin of ⌀ 0.1, set inside that cell but off its ray: the ray
//     must MISS it (or the control tests nothing) and the surface pass must
//     give the cell the pin's whole height.
//
// Run from tools/: node probe-261-dial-band.mjs   (ROOT= for another tree)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dialBandScan } from './dial-band-scan.mjs';   // the scan itself, shared with probe-261-fold-site.mjs
const ROOT = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8594;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'warning' && !/WebGL|GPU stall|GroupMarker/.test(m.text())) warns.push(m.text()); });
page.on('pageerror', (e) => warns.push('PAGEERROR ' + String(e)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => !!window.__clock || !!window.__bootError, null, { timeout: 300000 });
const bootError = await page.evaluate(() => (window.__bootError ? String(window.__bootError) : null));
if (bootError) { console.log('boot failed: ' + bootError); process.exit(2); }

// The grid. DR and DAZ put a cell at about 1 u of arc at r 24 (the annulus's
// inner edge) and 1.9 u at the plate's rim, finer than any member the fold
// would place (the column wheel's skirt is 0.617 u deep and ~6 u across).
const GRID = { DR: 0.5, DAZ_DEG: 2.5 };

const t0 = Date.now();
const res = await page.evaluate(dialBandScan, { GRID });

// ---------------------------------------------------------------------------
const MM = 0.378947;            // u → mm, UNIT_MM (§39)
const CASE_R_IN = 44.16;        // plateR + 1 mm (§186), read off the stack table in §261; a REPORT boundary, not a gate
const f = (x, d = 3) => x.toFixed(d);
console.log(`band: dial back z ${f(res.Z_FLOOR, 4)} .. plate dial face z ${f(res.Z_CEIL, 4)} = ${f(res.Z_CEIL - res.Z_FLOOR)} u (${f((res.Z_CEIL - res.Z_FLOOR) * MM)} mm) nominal`);
console.log(`grid: ${res.NR} rings × ${res.NA} az = ${res.NR * res.NA} cells to r ${f(res.R_MAX, 2)}; ${res.poses} poses (reference + §152 digest net); ${res.tenantsCount} tenant meshes, ${res.meshScans} mesh placements scanned; ${res.raysCast} rays`);
console.log(`scan wall clock ${((Date.now() - t0) / 1000).toFixed(0)} s (after boot)`);
console.log(`walls read per cell: floor ${res.wallsFound.floor}, ceiling ${res.wallsFound.ceil} (of ${res.plateCells} inside the dial)`);
console.log(`surface pass reached cells no ray did (thin members), by unit: ${Object.entries(res.surfOnly).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([u, n]) => `${u} ${n}`).join(', ') || 'none'}`);
console.log(`open-mesh incidences (odd crossings, filled first-to-last): ${res.openIncidences}${res.openIncidences ? ' — ' + Object.entries(res.openByUnit).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([u, n]) => `${u} ${n}`).join(', ') : ''}`);

// The scratch map's own shape, re-measured: occupancy (union over the net, as a
// fraction of each cell's band) in 2 u × 15° bins, mean over the bin's cells.
const RB = 2, AB = 15;
const bins = new Map();
for (const c of res.cells) {
  if (c.depth <= 0) continue;
  const key = `${Math.floor(c.r / RB)}|${Math.floor(c.az / AB)}`;
  const b = bins.get(key) || { s: 0, n: 0, sb: 0 };
  b.s += c.filled / c.depth; b.sb += c.refFilled / c.depth; b.n++;
  bins.set(key, b);
}
console.log(`\nOCCUPANCY, pose-net union, % of band depth (rows r in ${RB} u, columns az in ${AB}°):`);
console.log('   r \\ az ' + Array.from({ length: 360 / AB }, (_, j) => String(j * AB).padStart(4)).join(''));
for (let ri = 0; ri * RB < res.R_MAX; ri++) {
  let line = `${String(ri * RB).padStart(4)}-${String((ri + 1) * RB).padEnd(4)}`;
  for (let ai = 0; ai < 360 / AB; ai++) {
    const b = bins.get(`${ri}|${ai}`);
    line += b ? String(Math.round(100 * b.s / b.n)).padStart(4) : '   .';
  }
  console.log(line);
}

// The verdict on the annulus: per 1-u ring, the az arcs whose cells all keep a
// contiguous free gap of at least NEED u, at three depths. 3.1 is the column
// wheel's whole stack (~2.8 u: skirt band 0.617 + castellations 0.617 + base
// 0.633 + driver band 0.90) plus two CLEAR_MARGINs, read off §261's own fold
// scope; it is a SCOPING depth, not a design.
const NEEDS = [1.0, 2.0, 3.1];
// Runs of az columns in which EVERY cell of the ring keeps a gap ≥ need, as
// [fromDeg, lengthDeg], longest first. Walked from a blocked column so a run
// that wraps through 0° is one run, not two.
function arcs(rLo, rHi, need) {
  const n = res.NA, step = 360 / n, ok = new Array(n).fill(true);
  let any = false;
  for (const c of res.cells) if (c.r >= rLo && c.r < rHi) { any = true; if (!(c.gap >= need)) ok[Math.floor(c.az / step)] = false; }
  if (!any) return [];
  const b0 = ok.indexOf(false);
  if (b0 < 0) return [[0, 360]];
  const out = [];
  let start = null;
  for (let i = 1; i <= n; i++) {
    const j = (b0 + i) % n;
    if (ok[j] && start === null) start = j;
    if ((!ok[j] || i === n) && start !== null) { out.push([start * step, ((j - start + n) % n || n) * step]); start = null; }
  }
  return out.sort((x, y) => y[1] - x[1]);
}
console.log(`\nFREE ARCS by ring — every cell in the arc keeps a contiguous free gap ≥ need (pose-net union):`);
for (let r = 18; r < Math.ceil(res.R_MAX); r += 2) {
  const row = NEEDS.map((need) => {
    const a = arcs(r, r + 2, need);
    const total = a.reduce((t, [, len]) => t + len, 0);
    return `≥${need}u: ${String(Math.round(total)).padStart(3)}° (longest ${a.length ? `${a[0][1]}° from ${a[0][0]}°` : '—'})`;
  });
  console.log(`  r ${String(r).padStart(2)}–${String(r + 2).padEnd(2)}  ${row.join('   ')}`);
}

// Who lives in the annulus, over the net: units by the number of cells they
// reach between r 24 and the case's inner wall (CASE_R_IN = plateR + 1 mm,
// 44.16 u; everything outboard of it reads as the case and is not the band's),
// with the deepest single interval they occupy there.
const annulus = new Map();
for (const c of res.cells) if (c.r >= 24 && c.r < CASE_R_IN) for (const [u, d] of Object.entries(c.units)) {
  const a = annulus.get(u) || { cells: 0, deep: 0 }; a.cells++; a.deep = Math.max(a.deep, d); annulus.set(u, a);
}
console.log(`\nTENANTS of r 24–${CASE_R_IN} over the net (cells reached, deepest interval):`);
for (const [u, a] of [...annulus].sort((x, y) => y[1].cells - x[1].cells).slice(0, 24))
  console.log(`  ${u.padEnd(40)} ${String(a.cells).padStart(5)} cells  ${f(a.deep)} u`);

// What the pose net added over the reference pose: cells occupied only away from it.
const added = res.cells.filter((c) => c.filled - c.refFilled > 0.05);
const addedBy = {};
for (const c of added) for (const u of Object.keys(c.units)) addedBy[u] = (addedBy[u] || 0) + 1;
console.log(`\nPOSE NET over REFERENCE POSE: ${added.length} cells gained > 0.05 u of occupancy away from it; units present there: ` +
  Object.entries(addedBy).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([u, n]) => `${u} ${n}`).join(', '));

// ---- controls -------------------------------------------------------------
let ok = true;
const fail = (s) => { ok = false; console.log('CONTROL FAIL: ' + s); };
const pass = (s) => console.log('CONTROL PASS: ' + s);
console.log('');
// C1
{
  const core = res.cells.filter((c) => c.r < 2 && c.depth > 0);
  const frac = core.reduce((s, c) => s + c.filled / c.depth, 0) / Math.max(1, core.length);
  const owners = new Set(core.flatMap((c) => Object.keys(c.units)));
  if (frac < 0.5 || !owners.has('Dial')) fail(`C1 centre chain: r < 2 filled ${f(100 * frac, 1)} % of the band, owners [${[...owners].join(', ')}] — the §29 tube chain was not found where it stands`);
  else pass(`C1 the §29 centre chain fills ${f(100 * frac, 1)} % of the band at r < 2 (owners include Dial: ${[...owners].slice(0, 6).join(', ')})`);
}
// C2
if (res.c2.n === 0) fail('C2 nothing to re-cast — the sample is empty');
else if (res.c2.bad) fail(`C2 both faces: ${res.c2.bad}/${res.c2.n} cells read differently from behind; first r ${f(res.c2.sample.r, 2)} az ${res.c2.sample.az}: fwd ${JSON.stringify(res.c2.sample.fwd)} back ${JSON.stringify(res.c2.sample.back)}`);
else pass(`C2 ${res.c2.n} cells re-cast from behind read the same intervals (worst ${res.c2.worst.toExponential(1)})`);
// C3
{
  const keyless = Object.keys(addedBy).filter((u) => /[Kk]eyless|[Ss]etting lever|[Yy]oke|[Cc]lutch/.test(u));
  if (!added.length) fail('C3 the pose net added no occupancy over the reference pose — the poses were not applied');
  else if (!keyless.length) fail(`C3 the keyless works never swept a cell the reference pose left free (units that did: ${Object.keys(addedBy).slice(0, 8).join(', ')})`);
  else pass(`C3 the pose net is applied: ${added.length} cells gained occupancy away from the reference pose, the keyless lane among them (${keyless.join(', ')})`);
}
// C4
{
  const wallAsTenant = res.cells.some((c) => Object.keys(c.units).some((u) => u === 'Base plate'));
  const cov = Math.min(res.wallsFound.floor, res.wallsFound.ceil) / Math.max(1, res.plateCells);
  if (wallAsTenant) fail('C4 the base plate appears as a tenant — the ground got counted');
  else if (cov < 0.9) fail(`C4 walls read in only ${f(100 * cov, 1)} % of the dial's cells — the band's floor/ceiling were not measured`);
  else pass(`C4 walls read per cell (${f(100 * cov, 1)} % of the dial's cells), and neither wall is a tenant`);
}
// C5
if (!res.plant) fail('C5 no empty cell at r ≈ 30 to plant in — nothing to test the method against');
else {
  const [w0, w1] = res.plant.want, g = res.plant.got;
  const good = g.length === 1 && Math.abs(g[0][0] - w0) < 1e-4 && Math.abs(g[0][1] - w1) < 1e-4 && res.plant.missCount === 0;
  if (!good) fail(`C5 planted block at r ${f(res.plant.r, 2)} az ${res.plant.az}: want [${f(w0, 4)}, ${f(w1, 4)}], read ${JSON.stringify(g)}, must-miss hits ${res.plant.missCount}`);
  else pass(`C5 a planted block at r ${f(res.plant.r, 2)} az ${res.plant.az} reads its own interval [${f(w0, 4)}, ${f(w1, 4)}] to 1e-4, and nothing three units out`);
}
// C6
if (res.plant) {
  const [w0, w1] = res.plant.want, sp = res.plant.pinSurf;
  if (res.plant.pinRayHits) fail(`C6 the pin was meant to sit off the cell's ray and the ray hit it ${res.plant.pinRayHits}× — the control tests nothing`);
  else if (!sp || Math.abs(sp[0] - w0) > 1e-4 || Math.abs(sp[1] - w1) > 1e-4) fail(`C6 a ⌀ 0.1 pin off the ray: surface pass read ${JSON.stringify(sp)}, want [${f(w0, 4)}, ${f(w1, 4)}] — thin members slip between rays`);
  else pass(`C6 a ⌀ 0.1 pin set off the cell's ray is missed by the ray and read whole by the surface pass [${f(sp[0], 4)}, ${f(sp[1], 4)}]`);
}
if (warns.length) console.log(`\nboot warnings (${warns.length}): ${warns.slice(0, 3).join(' | ')}`);
await browser.close();
process.exit(ok ? 0 : 2);
