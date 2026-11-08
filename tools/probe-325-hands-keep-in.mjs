// §325 remainder — WHAT WOULD THE FREE CASE COST IF THE HANDS' SWEPT DISC WERE A KEEP-IN? A REPORT (it prints and judges nothing).
//   node tools/probe-325-hands-keep-in.mjs ['k=v&…' spec]        (boots the preview once; needs the three env vars in CLAUDE.md)
// fitFreeCase takes the counted metal's plan hulls, the pins and the ports; the hands' sweep is not among them, so the hands' axis can
// stand close to the opening on one side. This refits the outline with a disc about the hands' axis added as one more polygon, searching
// the strap axis exactly as tools/free-outline.mjs does (layout.js fitFreeCase at each c: a scan, then golden section).
//   · the fit GROWS every polygon by the rim margin M, so a disc that must stand inside the OPENING enters at radius
//     L + CLEAR_MARGIN + g − M, where g is how far the opening stands inside the outline (read from the build: the nearest reach of the
//     outline minus that of the opening);
//   · the disc is a 192-gon with its VERTICES on the circle's circumscribing radius, so no edge undercuts it.
import { bootForm } from './boot-form.mjs';
import { fitFreeCase, polyArea, UNIT_MM, CLEAR_MARGIN } from '../src/layout.js';

const SPEC = process.argv[2] ?? 'alarm=0&barrelstep=-140&rsvaz=0&rsvidl=2&frame=lands';
const mm2 = UNIT_MM * UNIT_MM;
const EXPR = `(() => { const c = window.__clock, S = c.scene, T = c.dialTrack, f = c.formFootprint;
  const hull = f.hull.map((p) => (Array.isArray(p) ? p : [p.x, p.y]));
  let ax = null; S.traverse((o) => { if (o.name === 'minutePipe' && !ax) { ax = o.parent; } });
  const reachAt = (poly, az) => { const dx = Math.cos(az), dy = Math.sin(az); let best = 0;
    for (let j = 0; j < poly.length; j++) { const a = poly[j], b = poly[(j + 1) % poly.length], ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue; const t = (a[0] * ey - a[1] * ex) / den, u = (a[0] * dy - a[1] * dx) / den; if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t); } return best; };
  return { free: JSON.parse(JSON.stringify(f.free)), hull, areaMm2: f.areaMm2, margin: f.margin,
    openingNear: T ? T.nearestMid : null };
})()`;
const { extra, bootError } = await bootForm(`case=free&${SPEC}`, EXPR);
if (bootError || !extra) { console.log('BOOT ERROR', bootError); process.exit(2); }
const F = extra.free, M = F.margin;
// the frame check: the polygons and the hull must be one frame (the hands' axis is the origin of the hull's)
const bx = (pts) => { let lo = Infinity, hi = -Infinity; for (const [x] of pts) { lo = Math.min(lo, x); hi = Math.max(hi, x); } return [lo, hi]; };
const polyX = bx(F.polys.flat()), hullX = bx(extra.hull);
console.log(`frame check: polygons x ${polyX.map((v) => v.toFixed(2)).join('..')}  hull x ${hullX.map((v) => v.toFixed(2)).join('..')}  (equal frames agree)`);

const SCAN_U = 2.5, TOL_U = 0.05;
const fit = (polys, c) => {
  try { const r = fitFreeCase(polys, { margin: M, rc: F.rc, need: F.need, c, pins: F.pins.map(([x, y, n]) => [x, y, n]), ports: F.ports ?? [] });
    return r.flat.top && r.flat.bot ? r : { area: Infinity }; } catch { return { area: Infinity }; }
};
const solveAxis = (polys) => {
  let lo = Infinity, hi = -Infinity; for (const P of polys) for (const [x] of P) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  const mid = (lo + hi) / 2, half = Math.max(SCAN_U, (hi - lo) / 2 - F.need), scan = [];
  for (let c = mid - half; c <= mid + half + 1e-9; c += SCAN_U) scan.push({ c, r: fit(polys, c) });
  let k = 0; for (let i = 1; i < scan.length; i++) if (scan[i].r.area < scan[k].r.area) k = i;
  if (!Number.isFinite(scan[k].r.area)) return null;
  const g = (Math.sqrt(5) - 1) / 2; let a = scan[Math.max(0, k - 1)].c, b = scan[Math.min(scan.length - 1, k + 1)].c;
  let x1 = b - g * (b - a), x2 = a + g * (b - a), f1 = fit(polys, x1), f2 = fit(polys, x2);
  while (b - a > TOL_U) { if (f1.area <= f2.area) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = fit(polys, x1); } else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = fit(polys, x2); } }
  let best = f1.area <= f2.area ? { c: x1, r: f1 } : { c: x2, r: f2 }; if (scan[k].r.area < best.r.area) best = scan[k];
  return best;
};
const reachOf = (pts) => { let lo = Infinity, hi = 0; for (let i = 0; i < 720; i++) { const az = (i / 720) * 2 * Math.PI, dx = Math.cos(az), dy = Math.sin(az); let best = 0;
  for (let j = 0; j < pts.length; j++) { const a = pts[j], b = pts[(j + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue; const t = (a[0] * ey - a[1] * ex) / den, u = (a[0] * dy - a[1] * dx) / den; if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t); }
  lo = Math.min(lo, best); hi = Math.max(hi, best); } return { lo, hi }; };
const bbox = (pts) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x1 - x0, y1 - y0]; };

const base = solveAxis(F.polys);
if (!base) { console.log('no strap axis admits the baseline fit'); process.exit(1); }
const baseReach = reachOf(base.r.pts), baseReachHull = (() => { let lo = Infinity, hi = 0; for (let i = 0; i < 720; i++) { const az = (i / 720) * 2 * Math.PI; const r = reachOfRay(extra.hull, az); lo = Math.min(lo, r); hi = Math.max(hi, r); } return { lo, hi }; })();
function reachOfRay(poly, az) { const dx = Math.cos(az), dy = Math.sin(az); let best = 0; for (let j = 0; j < poly.length; j++) { const a = poly[j], b = poly[(j + 1) % poly.length], ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue; const t = (a[0] * ey - a[1] * ex) / den, u = (a[0] * dy - a[1] * dx) / den; if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t); } return best; }
// g: the opening stands inside the outline by this much on the nearest side (landing 7 measured the opening 14 u from the axis; the outline is reached from the axis at baseReach.lo)
const OPENING_NEAR = 14.0, g = baseReach.lo - OPENING_NEAR;
console.log(`baseline: c ${base.c.toFixed(2)}, area ${(base.r.area * mm2).toFixed(1)} mm², outline reach ${baseReach.lo.toFixed(1)}..${baseReach.hi.toFixed(1)}, box ${bbox(base.r.pts).map((v) => (v * UNIT_MM).toFixed(1)).join(' x ')} mm; the engine's own area ${extra.areaMm2?.toFixed(1)}; opening inset g ${g.toFixed(2)} (opening near ${OPENING_NEAR} per landing 7)`);

const disc = (R, n = 192) => Array.from({ length: n }, (_, i) => { const a = (i / n) * 2 * Math.PI, r = R / Math.cos(Math.PI / n); return [r * Math.cos(a), r * Math.sin(a)]; });
for (const [name, L] of [['hour hand', 24.3], ['minute hand', 40.79]]) {
  const R = L + CLEAR_MARGIN + g - M, polys = [...F.polys, disc(R)], s = solveAxis(polys);
  if (!s) { console.log(`${name} ${L}: no strap axis admits a fit`); continue; }
  const rch = reachOf(s.r.pts), bb = bbox(s.r.pts);
  console.log(`${name.padEnd(11)} disc ${L} (entered at ${R.toFixed(2)}): c ${s.c.toFixed(2)}, area ${(s.r.area * mm2).toFixed(1)} mm² (x${(s.r.area / base.r.area).toFixed(2)}), outline reach ${rch.lo.toFixed(1)}..${rch.hi.toFixed(1)}, box ${bb.map((v) => (v * UNIT_MM).toFixed(1)).join(' x ')} mm`);
}
