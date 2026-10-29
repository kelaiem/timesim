#!/usr/bin/env node
// §325 — THE FREE OUTLINE, held: the form case with no construction — the counted metal's own plan, given its lug
// ends, grown by the rim margin, closed by FREE_RC and opened by the margin's round (layout.js fitFreeCase), cut
// from the GENERATED table src/free-outlines.js. Pure Node over layout.js and a fixture of the measured metal
// (tools/data/probe-325-metal.json: each counted mesh's plan hull and every pin, published by a ?case=free boot;
// `--refresh` re-measures it through boot-form.mjs).
//
//   T  the field toolkit. T1 the distance transform is EXACT on cell centres (against brute force; the control:
//      a mask with one cell moved reads differently); T2 an offset of a circle is a circle (every vertex at r ± g to
//      the offset's accuracy; the control: read against g + 0.05 it fails); T3 the shape's inset is signed by the
//      polygon's own inside (point-in-polygon at 5000 random points).
//   F  the fit, on the measured metal. F1 it HOLDS: every metal edge stands at least the rim margin from every
//      outline edge and every pin its own need (freeWorst, exact); F2 it is TIGHT: within 0.01 u of the margin, and
//      the outline pulled in 0.02 u refuses the metal (F1's control: an outline that held by being loose passes F1
//      alone); F3 the lug ends are exactly straight and each runs the strap's need either side of the axis; F4 it
//      is CONCAVE and simple (its area under its own convex hull's — the claim that it follows the metal inward);
//      F5 the committed row IS the fit at its axis on this metal (area to 1e-3, margin held); F6 the axis is the
//      area's BRACKETED MINIMUM (c ± the tool's scan step enclose more — finer, the area is flat to raster noise); F7 it encloses less than the fitted tonneau (§317) — the
//      ranking printed.
//   R  the case's rings (form-case.js formCaseLoops under the free kind). R1 every depth to the bezel's opening is
//      an EXACT offset carried onto the outer loop's vertices with no edge running backwards and no crossing; the
//      control: the mitre offset §289 reads on every other kind folds on this outline at the opening's depth.
//   D  the dial frame: the outline carried through the Y-flip is the same area, simple, CCW.
// An ACCEPTANCE test: exits non-zero on any failure.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from '../src/layout.js';
import { FREE_OUTLINES } from '../src/free-outlines.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = join(ROOT, 'tools/data/probe-325-metal.json');
let fails = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) fails++; };
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const M = L.PLATE_RIM_MARGIN, mm2 = L.UNIT_MM * L.UNIT_MM;

if (process.argv.includes('--refresh') || !existsSync(FIX)) {
  const { bootForm } = await import('./boot-form.mjs');
  const r = await bootForm('case=free');
  if (!r.ff?.free?.polys) { console.error('refresh: the boot published no plan hulls', r.bootError ?? ''); process.exit(1); }
  const { key, polys, pins, rc, need, margin } = r.ff.free;
  writeFileSync(FIX, JSON.stringify({ query: 'case=free', key, rc, need, margin, polys, pins }));
  console.log(`refreshed ${FIX}: ${polys.length} plan hulls, ${pins.length} pins`);
}
const FX = JSON.parse(readFileSync(FIX, 'utf8'));
const ROW = FREE_OUTLINES[FX.key];
const pins = FX.pins.map(([x, y, n]) => [x, y, n]);

// ── T: the field toolkit ──────────────────────────────────────────────────────────────────────────────────────
{
  const W = 40, H = 31, h = 0.1, mask = new Uint8Array(W * H);
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 25; i++) mask[Math.floor(rnd() * W * H)] = 1;
  const brute = (m) => { const out = new Float64Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let d = Infinity;
      for (let q = 0; q < W * H; q++) if (m[q]) d = Math.min(d, Math.hypot(i - (q % W), j - Math.floor(q / W)) * h);
      out[j * W + i] = d; } return out; };
  const f = L.fieldEdt(mask, W, H, h), b = brute(mask);
  let err = 0; for (let i = 0; i < W * H; i++) err = Math.max(err, Math.abs(f[i] - b[i]));
  const moved = mask.slice(); const k = moved.indexOf(1); moved[k] = 0; moved[(k + 7) % (W * H)] = 1;
  const b2 = brute(moved); let diff = 0; for (let i = 0; i < W * H; i++) diff = Math.max(diff, Math.abs(f[i] - b2[i]));
  ok('T1 the distance transform is exact on the cell centres', err < 1e-12 && diff > 0.05, `worst ${err.toExponential(1)} against brute force; the control (one cell moved) reads ${diff.toFixed(3)} apart`);

  const circ = Array.from({ length: 720 }, (_, i) => [10 * Math.cos((i * (2 * Math.PI)) / 720), 10 * Math.sin((i * (2 * Math.PI)) / 720)]);
  const acc = L.FREE_SIMPLIFY + 10 * (1 - Math.cos(Math.PI / 720)) + 1e-3;
  let e = 0, eCtl = 0;
  for (const g of [3, -3]) { const o = L.freeOffset(circ, g); for (const [x, y] of o.pts) { e = Math.max(e, Math.abs(Math.hypot(x, y) - (10 + g))); eCtl = Math.max(eCtl, Math.abs(Math.hypot(x, y) - (10 + g + 0.05))); } }
  ok('T2 an offset of a circle is a circle', e <= acc && eCtl > acc, `every vertex within ${e.toFixed(4)} of r ± g (accuracy ${acc.toFixed(4)}); the control (g + 0.05) reads ${eCtl.toFixed(4)}`);
}

// ── F: the fit on the measured metal ─────────────────────────────────────────────────────────────────────────
ok('F0 the committed table carries this movement', !!ROW, ROW ? `${FX.key}` : `no row for ${FX.key} — run node tools/free-outline.mjs --write`);
if (ROW) {
  const fit = quiet(() => L.fitFreeCase(FX.polys, { margin: FX.margin, rc: FX.rc, need: FX.need, c: ROW.c, pins }));
  const sh = L.freeShapeOf(ROW.pts, { c: ROW.c, rc: ROW.rc, margin: ROW.margin, need: ROW.need, flat: ROW.flat });
  {
    let seed = 11, bad = 0; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pip = (P, x, y) => { let s = false; for (let i = 0, k = P.length - 1; i < P.length; k = i++) if ((P[k][1] > y) !== (P[i][1] > y) && x < P[k][0] + ((y - P[k][1]) * (P[i][0] - P[k][0])) / (P[i][1] - P[k][1])) s = !s; return s; };
    for (let i = 0; i < 5000; i++) { const x = sh.xMin - 5 + (sh.xMax - sh.xMin + 10) * rnd(), y = sh.yMin - 5 + (sh.yMax - sh.yMin + 10) * rnd(), s = sh.inset(x, y);
      if (Math.abs(s) > 1e-6 && (s > 0) !== pip(sh.pts, x, y)) bad++; }
    ok('T3 the inset is signed by the polygon\'s own inside', bad === 0, `${bad} of 5000 points disagree`);
  }
  const w = L.freeWorst(ROW.pts, FX.polys, pins, M);
  ok('F1 the committed outline holds the metal at the rim margin (exact)', w.d >= M - 1e-6, `${w.d.toFixed(4)} u (need ${M}), at (${w.where.map((q) => q.toFixed(2)).join(', ')})`);
  const pulled = L.freeOffset(ROW.pts, -0.02).pts, wc = L.freeWorst(pulled, FX.polys, pins, M);
  ok('F2 it is tight', w.d <= M + 0.01 && wc.d < M, `${(w.d - M).toFixed(4)} u over the margin; pulled in 0.02 it reads ${wc.d.toFixed(4)} (the control)`);
  const straight = (yLine, run) => run && sh.pts.some(([x, y]) => y === yLine && Math.abs(x - run[0]) < 1e-9) && sh.pts.some(([x, y]) => y === yLine && Math.abs(x - run[1]) < 1e-9);
  ok('F3 the lug ends are straight and run the strap\'s need', straight(ROW.flat.yTop, ROW.flat.top) && straight(ROW.flat.yBot, ROW.flat.bot)
    && ROW.flat.halfTop >= ROW.need && ROW.flat.halfBot >= ROW.need,
    `±${ROW.flat.halfTop.toFixed(3)} / ±${ROW.flat.halfBot.toFixed(3)} u about c ${ROW.c} (need ${ROW.need.toFixed(3)})`);
  const xs = ROW.pts.map((p) => p[0]), ys = ROW.pts.map((p) => p[1]);
  const hullA = L.polyArea(L.convexHull2(xs, ys, xs.length)), A = L.polyArea(ROW.pts);
  ok('F4 it is concave and simple', A < hullA - 1 && L.loopSimple(ROW.pts), `${(A * mm2).toFixed(1)} mm² against its convex hull's ${(hullA * mm2).toFixed(1)} mm²`);
  ok('F5 the committed row is the fit at its axis on this metal', Math.abs(fit.area - ROW.area) <= 1e-3 * ROW.area && fit.worst.d >= M,
    `${(fit.area * mm2).toFixed(2)} mm² re-fitted against ${(ROW.area * mm2).toFixed(2)} committed`);
  // the tool's scan step (free-outline.mjs SCAN_U): finer than that the area is flat to the raster's own noise —
  // successive fixed-point rounds at one axis read ~0.3 mm² apart — so the claim held is the scan's, a bracketed minimum
  const SCAN_U = 2.5, side = [-SCAN_U, SCAN_U].map((s) => quiet(() => L.fitFreeCase(FX.polys, { margin: FX.margin, rc: FX.rc, need: FX.need, c: ROW.c + s, pins })).area);
  ok('F6 the strap axis is the area\'s bracketed minimum', side.every((a) => a > fit.area), `c ${ROW.c}: ${(fit.area * mm2).toFixed(2)}; c ∓ ${SCAN_U}: ${side.map((a) => (a * mm2).toFixed(2)).join(' / ')} mm²`);
  const fitted = L.formShapeOf('fitted', [-45.72, 45.72, -43.91, 44.38, 0.445876, 0.162288]);
  ok('F7 it encloses less than the fitted tonneau', A < L.shapeArea(fitted), `free ${(A * mm2).toFixed(1)} mm², fitted tonneau ${(L.shapeArea(fitted) * mm2).toFixed(1)} mm² (${((A / L.shapeArea(fitted) - 1) * 100).toFixed(1)}%)`);

  // ── R: the rings ───────────────────────────────────────────────────────────────────────────────────────────
  const G = L.CASE_CLEAR + L.CASE_BAND_T, tOpen = G + 1 / L.UNIT_MM, lo = G - (G + 1.5 / L.UNIT_MM), hi = G;
  const outer = sh.levelLoop(G, { lo, hi });
  const judge = (ring) => { const n = ring.length, kept = []; let rev = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, ex = ring[j][0] - ring[i][0], ey = ring[j][1] - ring[i][1];
      if (Math.hypot(ex, ey) < 1e-9) continue; if ((outer[j][0] - outer[i][0]) * ex + (outer[j][1] - outer[i][1]) * ey < 0) rev++; kept.push(ring[i]); }
    return { rev, simple: L.loopSimple(kept) }; };
  let worstRing = { rev: 0, simple: true }, off = 0;
  for (const t of [L.CASE_BAND_T, G, G + 0.5 / L.UNIT_MM, tOpen]) {
    const ring = L.projectLoop(outer, sh.levelLoop(G - t, { lo, hi })), j = judge(ring);
    if (j.rev || !j.simple) worstRing = j;
    for (const [x, y] of ring) off = Math.max(off, Math.abs(-sh.inset(x, y) - (G - t)));
  }
  const mitre = (pts, t) => { const n = pts.length, en = [];
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], Lh = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-12; en.push([(b[1] - a[1]) / Lh, -(b[0] - a[0]) / Lh]); }
    return pts.map(([x, y], i) => { const a = en[(i + n - 1) % n], b = en[i], k = 1 + a[0] * b[0] + a[1] * b[1]; return [x - (t * (a[0] + b[0])) / k, y - (t * (a[1] + b[1])) / k]; }); };
  const ctl = judge(mitre(outer, tOpen));
  ok('R1 every ring to the bezel\'s opening is an exact offset that does not fold', !worstRing.rev && worstRing.simple && off <= 0.01 && (ctl.rev > 0 || !ctl.simple),
    `0 reversed edges, simple, within ${off.toFixed(4)} u of the exact offset; the control (§289's mitre at ${tOpen.toFixed(3)}) reads ${ctl.rev} reversed${ctl.simple ? '' : ', crossing'}`);

  // ── D: the dial frame ──────────────────────────────────────────────────────────────────────────────────────
  const dial = L.freeShapeOf(ROW.pts.map(([X, Y]) => [-X, Y]).reverse(), { c: -ROW.c });
  ok('D1 the outline through the dial\'s Y-flip is the same outline', Math.abs(L.polyArea(dial.pts) - A) < 1e-9 && L.polyArea(dial.pts) > 0 && L.loopSimple(dial.pts),
    `${(L.polyArea(dial.pts) * mm2).toFixed(3)} mm², CCW, simple`);
}
console.log(fails ? `${fails} FAILED` : 'all PASS');
process.exit(fails ? 1 : 0);
