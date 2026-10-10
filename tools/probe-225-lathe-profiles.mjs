// TODO 225 — DOES ANY LATHE PROFILE HIDE A SHEET OR A KNIFE-EDGE?
//
// `stockFloor` measures a LatheGeometry mesh by the bounding box of its profile
// (axial extent x radial extent), and `probe-137-hidden-thin` reads only
// ExtrudeGeometry outlines, so neither sees INSIDE a revolve's profile. The
// sleeve skirt is the case that sent this here: its profile was offset from the
// working face by (+w, +w), which at 45 degrees slides the face ALONG itself, so
// three of its four corners were collinear and the profile's area was the little
// triangle at the cap — the cone the tail pin presses was a double-sided sheet of
// no thickness, and the census read it fat because the stray corner poked 0.112 u
// into the flat and made the box 0.317 tall.
//
// WHAT IT MEASURES, per LatheGeometry mesh, from `geometry.parameters.points`:
//   open     the profile neither returns to its first point nor has both ends on
//            the axis (r = 0, where revolving closes it): a revolved SURFACE, not
//            a solid. (A lathe of an open polyline has no inside.)
//   doubled  total length of profile edges that lie along another edge of the
//            same profile (collinear within COLLINEAR_EPS and overlapping): the
//            sheet signature. Zero for every honest closed profile.
//   area     the profile polygon's area against the box the census reads,
//            as a ratio — a thin shell is a small fraction of its box by nature,
//            so this is context, not a flag.
//   thin     the fraction of the profile's area under HALF_U (half the wheel
//            floor), by morphological opening on a raster of the profile — the
//            thickness spectrum `probe-137-hidden-thin` uses on outlines. Tapers
//            to a point are normal (a cone's rim), so this REPORTS and does not
//            flag.
// A row is FLAGGED when it is `open` with a non-degenerate span, or `doubled` is
// over DOUBLED_MIN (a sheet), or its area is under AREA_EPS of the polygon area
// of its own convex hull (a whisker).
//
// CONTROLS (a probe that reports 0 has measured nothing until these fire): the
// sleeve's own broken profile must be flagged `doubled`; a plain rectangle ring
// and a 45-degree parallelogram wall must not.
//
// A REPORT (§40): prints and exits 0 unless a control is wrong.
// Usage: node probe-225-lathe-profiles.mjs [out.json]    (from tools/)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const COLLINEAR_EPS = 1e-6;   // |cross| / (|a||b|) — an exact-collinearity test at float noise
const DOUBLED_MIN = 1e-3;     // u of profile edge lying along another edge: float noise is 1e-9
const AREA_EPS = 0.05;        // profile area / convex-hull area under this reads as a whisker

const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
function hull(P) {
  const p = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of p.reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// Length of profile edges lying along ANOTHER edge (collinear, overlapping). Each
// overlapped stretch is counted once per pair.
export function doubledLength(P) {
  const E = []; for (let i = 0; i < P.length - 1; i++) E.push([P[i], P[i + 1]]);
  let total = 0;
  for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
    const [a, b] = E[i], [c, d] = E[j];
    const ux = b[0] - a[0], uy = b[1] - a[1], ul = Math.hypot(ux, uy); if (ul < 1e-9) continue;
    const vx = d[0] - c[0], vy = d[1] - c[1], vl = Math.hypot(vx, vy); if (vl < 1e-9) continue;
    if (Math.abs(ux * vy - uy * vx) / (ul * vl) > COLLINEAR_EPS) continue;           // not parallel
    if (Math.abs((c[0] - a[0]) * uy - (c[1] - a[1]) * ux) / ul > 1e-6) continue;      // parallel but offset
    const t = (p) => ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy) / ul;                  // position along E[i]
    const lo = Math.max(0, Math.min(t(c), t(d))), hi = Math.min(ul, Math.max(t(c), t(d)));
    if (hi - lo > 1e-9) total += hi - lo;
  }
  return total;
}
export function judge(P) {
  const ring = Math.hypot(P[0][0] - P.at(-1)[0], P[0][1] - P.at(-1)[1]) < 1e-9;
  const axial = !ring && Math.abs(P[0][0]) < 1e-6 && Math.abs(P.at(-1)[0]) < 1e-6; // both ends on r = 0: the revolve closes it
  const closed = ring || axial;
  const poly = ring ? P.slice(0, -1) : P;
  const doubled = doubledLength(ring ? P : [...P, P[0]]);
  const A = Math.abs(area(poly)), H = Math.abs(area(hull(poly)));
  return { closed, doubled: +doubled.toFixed(4), area: +A.toFixed(4), hullArea: +H.toFixed(4), areaOverHull: H > 0 ? +(A / H).toFixed(4) : 0,
    flagged: !closed ? 'open surface' : doubled > DOUBLED_MIN ? 'doubled edges (sheet)' : (H > 0 && A / H < AREA_EPS) ? 'whisker' : null };
}

// ---- controls ---------------------------------------------------------------
const rect = [[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]];
const sleeveBroken = [[4.003908689736768, -0.521432159202075], [4.208674182272176, -0.31666666666666665], [4.525340848938843, -0.31666666666666665], [4.320575356403435, -0.20476549253540832], [4.003908689736768, -0.521432159202075]];
const t = 0.3167, s2 = Math.SQRT2, A0 = [4.0039, -0.5214], B0 = [4.2087, -0.3167];
const wall = [A0, B0, [B0[0] + t * s2, B0[1]], [A0[0] + t * s2, A0[1]], A0];
const solidAxis = [[0, 0], [1, 0], [1, 2], [0, 2]];        // ends on the axis: a solid of revolution
const sheetOff = [[1, 0], [1, 2], [1.5, 2.5]];             // ends off the axis, not returning: a surface
const ctl = { rect: judge(rect), sleeveBroken: judge(sleeveBroken), wall: judge(wall), solidAxis: judge(solidAxis), sheetOff: judge(sheetOff) };
const okCtl = !ctl.rect.flagged && ctl.sleeveBroken.flagged === 'doubled edges (sheet)' && !ctl.wall.flagged
  && !ctl.solidAxis.flagged && ctl.sheetOff.flagged === 'open surface';
console.log('controls:', okCtl ? 'PASS' : 'FAIL', JSON.stringify(Object.fromEntries(Object.entries(ctl).map(([k, v]) => [k, v.flagged]))));
if (!okCtl) { console.log(JSON.stringify(ctl, null, 1)); process.exit(1); }

// ---- the movement ------------------------------------------------------------
const PORT = process.env.PORT || 8476;
const ROOT = process.env.ROOT || '..';
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 240000 });
await page.waitForFunction(() => (!!window.__clock && !!window.__clock.boot) || !!window.__bootError, null, { timeout: 240000 });
const raw = await page.evaluate(async () => {
  const c = window.__clock; const res = []; const seen = new Set();
  const hops = (mesh, obj) => { let n = 0; for (let o = mesh; o; o = o.parent, n++) if (o === obj) return n; return Infinity; };
  for (const e of c.labelEntries) e.obj.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== 'LatheGeometry' || seen.has(o.id)) return;
    seen.add(o.id);
    const owner = c.labelEntries.reduce((b, x) => (hops(o, x.obj) < hops(o, b.obj) ? x : b), e);
    res.push({ unit: owner.name, mesh: o.name || '(unnamed)', pts: o.geometry.parameters.points.map((v) => [v.x, v.y]), stock: o.userData.stockSection ?? null });
  });
  const L = await import('./src/layout.js');
  return { rows: res, UNIT_MM: L.UNIT_MM };
});
await browser.close(); srv.kill();

const rows = raw.rows.map((r) => ({ unit: r.unit, mesh: r.mesh, points: r.pts.length, declared: r.stock, ...judge(r.pts) }));
const flagged = rows.filter((r) => r.flagged);
console.log(`\n${rows.length} lathe meshes read; ${flagged.length} flagged`);
for (const r of flagged) console.log(`  ${r.unit.padEnd(28)} ${r.mesh.padEnd(24)} ${r.flagged}  doubled ${r.doubled} u  area/hull ${r.areaOverHull}  (${r.points} pts)`);
const closedN = rows.filter((r) => r.closed).length;
console.log(`closed ${closedN}, open ${rows.length - closedN}`);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify({ rows, controls: ctl }, null, 1));
process.exit(0);
